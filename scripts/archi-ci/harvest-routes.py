#!/usr/bin/env python3
"""Récolteur — routes HTTP → grain `endpoint` du manifeste architecture.yaml.

Modèle vivant Somtech (STD-031 §2.7.7, I16). Détecte les endpoints HTTP d'un repo
applicatif depuis les patterns Somtech standard et émet un manifeste `architecture.yaml`
RÉCOLTÉ : une racine, un noeud `api`, et un `endpoint` par (méthode, chemin). Lecture
seule sur les sources — aucun write-back.

Patterns reconnus (par ordre de confiance) :
  1. Next.js App Router  — fichiers `route.ts|js|tsx|mjs` sous `app/` ou `src/app/`
     (méthodes = exports GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS ; chemin = arbo).
  2. Next.js Pages API   — fichiers sous `pages/api/` ou `src/pages/api/` (1 handler
     par fichier ; méthode indéterminée → ANY).
  3. Express             — `app|router.<method>('/chemin', …)` dans les fichiers qui
     importent/instancient Express (best-effort, signalé si non reconnu).

⚠️ RÈGLE 7 : exécuter DEPUIS le repo applicatif cible. Aucune règle métier extraite (I17).
Un pattern non reconnu est SIGNALÉ (stderr), jamais deviné.

Usage :
  python3 harvest-routes.py <racine_repo> --app <slug> [options]
  options : --root-kind webapp|service (défaut webapp) · --root-name "<nom>"
            --out architecture.yaml (défaut: stdout)
"""
import argparse
import os
import re
import sys

HTTP_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "out", "coverage",
             ".turbo", ".vercel", "vendor", "__pycache__"}
CODE_EXT = (".ts", ".tsx", ".js", ".jsx", ".mjs")

# Export d'une méthode HTTP dans un route handler App Router :
#   export async function GET(...)  |  export const POST = ...
_APP_METHOD = re.compile(
    r"export\s+(?:async\s+)?(?:function|const|let|var)\s+(" + "|".join(HTTP_METHODS) + r")\b"
)
# Express : <obj>.<method>('/chemin' | "/chemin" | `/chemin`
_EXPRESS_ROUTE = re.compile(
    r"\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|all)\s*\(\s*[\"'`](/[^\"'`]*)[\"'`]",
    re.IGNORECASE,
)
_EXPRESS_HINT = re.compile(r"require\(['\"]express['\"]\)|from\s+['\"]express['\"]|express\(\)|Router\(\)")


def walk_code(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".git")]
        for fn in filenames:
            if fn.endswith(CODE_EXT):
                yield os.path.join(dirpath, fn)


def _app_dir_to_url(rel_dir):
    """Arbo App Router → chemin URL. Retire les route groups (xxx), garde [dyn]."""
    segments = []
    for seg in rel_dir.replace(os.sep, "/").split("/"):
        if not seg or (seg.startswith("(") and seg.endswith(")")):
            continue  # route group : pas de segment d'URL
        segments.append(seg)
    return "/" + "/".join(segments) if segments else "/"


def harvest_next_app(root):
    """Retourne set[(method, path, 'next-app')]."""
    found = set()
    for base in ("app", os.path.join("src", "app")):
        app_root = os.path.join(root, base)
        if not os.path.isdir(app_root):
            continue
        for path in walk_code(app_root):
            fn = os.path.basename(path)
            if not (fn.startswith("route.") and fn.endswith(CODE_EXT)):
                continue
            rel_dir = os.path.relpath(os.path.dirname(path), app_root)
            rel_dir = "" if rel_dir == "." else rel_dir
            url = _app_dir_to_url(rel_dir)
            try:
                text = open(path, encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            methods = {m.group(1).upper() for m in _APP_METHOD.finditer(text)}
            for m in sorted(methods) or ["ANY"]:
                found.add((m, url, "next-app"))
    return found


def harvest_next_pages_api(root):
    """Retourne set[(method, path, 'next-pages')]."""
    found = set()
    for base in ("pages/api", os.path.join("src", "pages", "api")):
        api_root = os.path.join(root, *base.split("/"))
        if not os.path.isdir(api_root):
            continue
        for path in walk_code(api_root):
            rel = os.path.relpath(path, api_root)
            rel_noext = os.path.splitext(rel)[0].replace(os.sep, "/")
            if rel_noext.endswith("/index"):
                rel_noext = rel_noext[: -len("/index")]
            url = "/api/" + rel_noext if rel_noext else "/api"
            url = url.rstrip("/") or "/api"
            found.add(("ANY", url, "next-pages"))
    return found


def harvest_express(root):
    """Retourne set[(method, path, 'express')] — fichiers Express uniquement."""
    found = set()
    for path in walk_code(root):
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        if not _EXPRESS_HINT.search(text):
            continue  # pas un fichier Express → on ne devine pas
        for m in _EXPRESS_ROUTE.finditer(text):
            obj, method, url = m.group(1), m.group(2).upper(), m.group(3)
            if not re.search(r"(?:^|_)(app|router)$", obj, re.IGNORECASE) and \
               not obj.lower().endswith("router") and obj.lower() not in ("app", "router"):
                continue  # objet peu plausible (évite axios.get, etc.)
            found.add(("ALL" if method == "ALL" else method, url, "express"))
    return found


def slugify(method, url):
    raw = f"{url}_{method}".lower()
    slug = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    slug = re.sub(r"_+", "_", slug)
    return slug or "root"


def emit_yaml(app, root_kind, root_name, endpoints):
    L = [
        "# RÉCOLTÉ — ne pas éditer (source : routes HTTP du code). STD-031 §2.7.7 / I16.",
        "# Régénéré par scripts/archi-ci/harvest-routes.py. Modifier le CODE, pas ce fichier.",
        "# Racine + noeud api = placeholders de TOPOLOGIE, à fusionner (merge-manifests).",
        f"app: {app}",
        "elements:",
        f"  - id: {app}",
        f"    kind: {root_kind}",
        f"    name: {root_name}",
        "    audience: internal",
    ]
    if endpoints:
        L += [
            f"  - id: {app}.api",
            "    kind: api",
            "    name: API HTTP",
            f"    parent: {app}",
            "    audience: internal",
        ]
        used = {}
        for method, url, tech in sorted(endpoints, key=lambda e: (e[1], e[0])):
            base = slugify(method, url)
            slug = base
            n = 2
            while slug in used and used[slug] != (method, url):
                slug = f"{base}_{n}"
                n += 1
            used[slug] = (method, url)
            L += [
                f"  - id: {app}.api.{slug}",
                "    kind: endpoint",
                f"    name: {method} {url}",
                f"    technology: {tech}",
                f"    parent: {app}.api",
                "    audience: internal",
            ]
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("root", nargs="?", default=".", help="Racine du repo à scanner (défaut: .)")
    ap.add_argument("--app", required=True, help="Slug ServiceDesk (racine de namespace)")
    ap.add_argument("--root-kind", default="service", choices=["webapp", "service", "system"])
    ap.add_argument("--root-name", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    root = args.root
    if not os.path.isdir(root):
        print(f"❌ Racine introuvable : {root}", file=sys.stderr)
        sys.exit(1)

    endpoints = set()
    endpoints |= harvest_next_app(root)
    endpoints |= harvest_next_pages_api(root)
    endpoints |= harvest_express(root)

    by_tech = {}
    for _, _, tech in endpoints:
        by_tech[tech] = by_tech.get(tech, 0) + 1

    if not endpoints:
        print("⚠️  Aucun endpoint reconnu (Next.js App Router / Pages API / Express). "
              "Grain endpoints non vérifié — ni conforme, ni en drift.", file=sys.stderr)

    yaml_out = emit_yaml(args.app, args.root_kind, args.root_name or args.app, endpoints)
    if args.out:
        with open(args.out, "w") as f:
            f.write(yaml_out)
        detail = ", ".join(f"{k}:{v}" for k, v in sorted(by_tech.items())) or "aucun"
        print(f"✅ Récolté {len(endpoints)} endpoint(s) [{detail}] → {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(yaml_out)


if __name__ == "__main__":
    main()

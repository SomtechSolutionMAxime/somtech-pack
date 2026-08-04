#!/usr/bin/env python3
"""Récolteur — routes HTTP → grain `endpoint` du manifeste architecture.yaml.

Modèle vivant Somtech (STD-031 §2.7.7, I16). Détecte les endpoints HTTP d'un repo
applicatif depuis les patterns Somtech standard et émet un manifeste `architecture.yaml`
RÉCOLTÉ : une racine, un noeud `api`, et un `endpoint` par (méthode, chemin). Lecture
seule sur les sources — aucun write-back.

Patterns reconnus (par ordre de confiance) :
  1. Supabase Edge Functions — `supabase/functions/<nom>/index.ts` → `/functions/v1/<nom>`.
     C'est la surface HTTP MAJORITAIRE des apps Somtech : leur front est un client Vite/React
     qui parle à Supabase, sans serveur Next.js ni Express. Un récolteur qui ne connaît que
     Next.js et Express déclare donc « aucun endpoint » sur la plupart des dépôts du parc —
     et la doc affirme qu'il n'y a pas d'API là où il y en a des dizaines.
  2. Next.js App Router  — fichiers `route.ts|js|tsx|mjs` sous `app/` ou `src/app/`
     (méthodes = exports GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS ; chemin = arbo).
  3. Next.js Pages API   — fichiers sous `pages/api/` ou `src/pages/api/` (1 handler
     par fichier ; méthode indéterminée → ANY).
  4. Express             — `app|router.<method>('/chemin', …)` dans les fichiers qui
     importent/instancient Express (best-effort, signalé si non reconnu).

La description d'un endpoint vient du commentaire de tête de son fichier — la source la
plus proche du code. Un champ laissé vide n'est pas neutre : il pousse la relecture humaine
à le remplir à la main, et la première projection régénérée l'efface.

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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from frameworks import next_router_dirs  # noqa: E402
from yamlemit import yaml_str as _yaml_str  # noqa: E402

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


def leading_doc(text):
    """Première phrase du commentaire de tête d'un fichier (JSDoc `/** … */` ou `// …`).

    Ni les directives (`@ts-nocheck`, `eslint-…`), ni les en-têtes de licence, ni les
    bannières de séparation ne sont des descriptions : on les écarte.
    """
    lines = text.lstrip("﻿").splitlines()
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    collected = []
    if i < len(lines) and lines[i].lstrip().startswith("/*"):
        for line in lines[i:]:
            body = re.sub(r"^\s*/\*+|\*+/\s*$|^\s*\*\s?", "", line).strip()
            if body:
                collected.append(body)
            if "*/" in line:
                break
    else:
        for line in lines[i:]:
            if not line.lstrip().startswith("//"):
                break
            collected.append(line.lstrip()[2:].strip())
    out = []
    for c in collected:
        if c.startswith("@") or re.match(r"^(eslint|ts-|prettier|@ts|copyright|license)", c, re.I):
            continue
        # Un en-tête qui ne fait que redonner le chemin du fichier ne décrit rien.
        if re.fullmatch(r"[\w./@-]+\.[jt]sx?", c):
            continue
        if not re.sub(r"[=\-–—*_#~]", "", c).strip():  # ligne de séparation
            continue
        out.append(c)
        if c.endswith("."):
            break
    desc = " ".join(out).strip()
    return desc[:280] or None


# Un fichier de test n'est pas une route : `route.test.ts` n'est jamais servi. Le motif
# `startswith("route.")` l'attrapait pourtant — et une fois de plus au détriment du projet
# le plus rigoureux, celui qui teste ses routes (effet pervers nommé en STD-031 §2.7.9).
_TEST_FILE = re.compile(r"\.(test|spec|stories|d)\.[jt]sx?$|(^|/)__tests__/", re.IGNORECASE)


def walk_code(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".git")]
        for fn in filenames:
            if fn.endswith(CODE_EXT) and not _TEST_FILE.search(fn):
                yield os.path.join(dirpath, fn)


def _app_dir_to_url(rel_dir):
    """Arbo App Router → chemin URL. Retire les route groups (xxx), garde [dyn]."""
    segments = []
    for seg in rel_dir.replace(os.sep, "/").split("/"):
        if not seg or (seg.startswith("(") and seg.endswith(")")):
            continue  # route group : pas de segment d'URL
        segments.append(seg)
    return "/" + "/".join(segments) if segments else "/"


def harvest_supabase_functions(root):
    """Retourne set[(method, path, 'supabase-edge', description)].

    Une Edge Function déployée est jointe sur `/functions/v1/<nom>` — c'est le chemin que
    `supabase.functions.invoke('<nom>')` appelle. Un dossier préfixé `_` (`_shared`) est du
    code commun, pas une fonction : il n'est pas déployé et n'a pas d'URL.

    La méthode n'est resserrée que lorsque le code la contrôle explicitement (un garde
    `req.method !== 'POST'`). Sinon `ANY` : Deno.serve répond à tout ce qui arrive, et
    inventer un `POST` là où le code n'en dit rien serait affirmer plus que la source (I17).
    """
    found = set()
    fn_root = os.path.join(root, "supabase", "functions")
    if not os.path.isdir(fn_root):
        return found
    for name in sorted(os.listdir(fn_root)):
        d = os.path.join(fn_root, name)
        if not os.path.isdir(d) or name.startswith("_") or name.startswith("."):
            continue
        entry = next((os.path.join(d, f"index{e}") for e in CODE_EXT
                      if os.path.isfile(os.path.join(d, f"index{e}"))), None)
        if entry is None:
            continue  # dossier sans point d'entrée : pas une fonction déployable
        try:
            text = open(entry, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        guarded = {m.group(1).upper() for m in re.finditer(
            r"req\.method\s*(?:!==?|===?)\s*[\"'](" + "|".join(HTTP_METHODS) + r")[\"']",
            text, re.IGNORECASE)}
        guarded.discard("OPTIONS")  # préflight CORS : présent partout, ne définit rien
        methods = sorted(guarded) if len(guarded) == 1 else ["ANY"]
        for m in methods:
            found.add((m, f"/functions/v1/{name}", "supabase-edge", leading_doc(text)))
    return found


def harvest_next_app(root):
    """Retourne set[(method, path, 'next-app')]."""
    found = set()
    for app_root in next_router_dirs(root)[0]:
        for path in walk_code(app_root):
            fn = os.path.basename(path)
            if os.path.splitext(fn)[0] != "route":
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
                found.add((m, url, "next-app", leading_doc(text)))
    return found


def harvest_next_pages_api(root):
    """Retourne set[(method, path, 'next-pages')]."""
    found = set()
    for pages_root in next_router_dirs(root)[1]:
        api_root = os.path.join(pages_root, "api")
        if not os.path.isdir(api_root):
            continue
        for path in walk_code(api_root):
            rel = os.path.relpath(path, api_root)
            rel_noext = os.path.splitext(rel)[0].replace(os.sep, "/")
            if rel_noext.endswith("/index"):
                rel_noext = rel_noext[: -len("/index")]
            url = "/api/" + rel_noext if rel_noext else "/api"
            url = url.rstrip("/") or "/api"
            try:
                doc = leading_doc(open(path, encoding="utf-8", errors="ignore").read())
            except OSError:
                doc = None
            found.add(("ANY", url, "next-pages", doc))
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
            found.add(("ALL" if method == "ALL" else method, url, "express", None))
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
        for method, url, tech, desc in sorted(endpoints, key=lambda e: (e[1], e[0])):
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
            ]
            if desc:
                L.append(f"    description: {_yaml_str(desc)}")
            L += [f"    parent: {app}.api", "    audience: internal"]
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
    endpoints |= harvest_supabase_functions(root)
    endpoints |= harvest_next_app(root)
    endpoints |= harvest_next_pages_api(root)
    endpoints |= harvest_express(root)

    by_tech = {}
    for _, _, tech, _desc in endpoints:
        by_tech[tech] = by_tech.get(tech, 0) + 1

    if not endpoints:
        print("⚠️  Aucun endpoint reconnu (Edge Functions / Next.js / Express). "
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

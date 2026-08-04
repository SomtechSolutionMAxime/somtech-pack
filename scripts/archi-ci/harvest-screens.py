#!/usr/bin/env python3
"""Récolteur — écrans → grain `screen` du manifeste architecture.yaml.

Modèle vivant Somtech (STD-031 §2.7.7, I16/I17/I19). Émet un `screen` par route d'interface
réellement déclarée dans le code. Lecture seule sur les sources — aucun write-back.

POURQUOI CE RÉCOLTEUR EXISTE.

Le grain `screen` fait partie de la taxonomie du manifeste depuis le début, mais aucun
récolteur ne le remplissait : les écrans étaient donc les seuls éléments écrits entièrement
à la main. Le gate de complétude, lui, ne bloque que sur ce que les récolteurs trouvent —
un grain que personne ne récolte n'est jamais confronté au code. Les écrans dérivaient donc
en silence, sans que rien ne le signale : la seule famille du manifeste sans filet.

Patterns reconnus :
  1. React Router — `<Route path="…" element={<Écran/>} />` (le motif du parc Somtech :
     front Vite/React, routage déclaré dans `App.tsx`).
  2. Next.js App Router — `app/**/page.tsx` (le chemin vient de l'arborescence).
  3. Next.js Pages Router — `pages/**/*.tsx`, hors `api/`, `_app`, `_document`.

La description vient du commentaire de tête du composant d'écran, résolu depuis son import.

⚠️ RÈGLE 7 : exécuter DEPUIS le repo applicatif cible. Aucune règle métier extraite (I17).
Un pattern non reconnu est SIGNALÉ (stderr), jamais deviné.

Usage :
  python3 harvest-screens.py <racine_repo> --app <slug> [options]
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

CODE_EXT = (".tsx", ".jsx", ".ts", ".js", ".mjs")
SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "out", "coverage",
             ".turbo", ".vercel", "vendor", "__pycache__", "supabase"}

# <Route path="/x" element={<Écran />} />  — attributs dans un ordre quelconque.
_ROUTE_OPEN = re.compile(r"<Route\b", re.IGNORECASE)
_ATTR_PATH = re.compile(r"\bpath\s*=\s*[\"'{`]?\s*([^\"'`}\s]+)", re.IGNORECASE)
_ATTR_ELEMENT = re.compile(r"\b(?:element|component)\s*=\s*(?P<val>\{.*|[\"'][^\"']*[\"'])",
                           re.DOTALL)
_JSX_TAG = re.compile(r"<([A-Z][\w.]*)")
_ATTR_INDEX = re.compile(r"\bindex\b(?!\s*=)", re.IGNORECASE)
# Composants d'encadrement : ils protègent ou enveloppent un écran, ils n'en sont pas un.
# `element={<RequireAuth><Inventaire/></RequireAuth>}` décrit l'écran Inventaire — nommer
# cette route « RequireAuth » ferait apparaître le même écran vingt fois dans le modèle.
_WRAPPERS = re.compile(
    r"\A(Require\w*|Protected\w*|Private\w*|Public\w*|Auth\w*|\w*Guard|\w*Layout|Layout\w*"
    r"|Suspense|ErrorBoundary|\w*Provider|\w*Wrapper|Fragment|React\.\w+)\Z",
    re.IGNORECASE,
)


def _route_attrs(text, start):
    """Zone d'attributs d'une balise `<Route …>`, en équilibrant les accolades JSX.

    Un `[^>]*` s'arrêterait au premier `>` — c'est-à-dire au milieu de
    `element={<RequireAuth>…}`, juste avant le composant qui nous intéresse.
    """
    i, depth, n = start, 0, len(text)
    while i < n:
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c in "\"'" and depth == 0:
            j = text.find(c, i + 1)
            i = n if j < 0 else j
        elif c == ">" and depth <= 0:
            return text[start:i]
        i += 1
    return text[start:]


def _screen_name(attrs):
    """Composant d'écran d'une balise Route : le plus profond qui ne soit pas un cadre."""
    m = _ATTR_ELEMENT.search(attrs)
    if not m:
        return None
    tags = [t for t in _JSX_TAG.findall(m.group("val")) if not _WRAPPERS.match(t)]
    return tags[-1] if tags else None
# import Écran from './pages/Écran'   |   const Écran = lazy(() => import('./pages/Écran'))
_IMPORT_DEFAULT = re.compile(r"import\s+([A-Z][\w]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*[\"']([^\"']+)[\"']")
_IMPORT_LAZY = re.compile(
    r"(?:const|let|var)\s+([A-Z][\w]*)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*[\"']([^\"']+)[\"']")


def leading_doc(text):
    """Première phrase du commentaire de tête d'un fichier (JSDoc `/** … */` ou `// …`)."""
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
        if c.startswith("@") or re.match(r"^(eslint|ts-|prettier|copyright|license)", c, re.I):
            continue
        # Un en-tête qui ne fait que redonner le chemin du fichier ne décrit rien.
        if re.fullmatch(r"[\w./@-]+\.[jt]sx?", c):
            continue
        if not re.sub(r"[=\-–—*_#~]", "", c).strip():
            continue
        out.append(c)
        if c.endswith("."):
            break
    desc = " ".join(out).strip()
    return (desc.split(". ")[0].strip() or None) if desc else None


# Un fichier de test n'est pas une route : `route.test.ts` n'est jamais servi. Le motif
# `startswith("route.")` l'attrapait pourtant — et une fois de plus au détriment du projet
# le plus rigoureux, celui qui teste ses routes (effet pervers nommé en STD-031 §2.7.9).
_TEST_FILE = re.compile(r"\.(test|spec|stories|d)\.[jt]sx?$|(^|/)__tests__/", re.IGNORECASE)


def walk_code(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            if fn.endswith(CODE_EXT) and not _TEST_FILE.search(fn):
                yield os.path.join(dirpath, fn)


def _resolve_import(from_file, spec, root):
    """Chemin d'import → fichier réel, ou None. Gère `./x`, `../x`, et l'alias `@/x`."""
    if spec.startswith("."):
        base = os.path.normpath(os.path.join(os.path.dirname(from_file), spec))
    elif spec.startswith("@/"):
        base = os.path.join(root, "src", spec[2:])
    else:
        return None  # paquet npm : hors du repo, donc hors du manifeste de ce repo
    for cand in [base + e for e in CODE_EXT] + [os.path.join(base, "index" + e) for e in CODE_EXT]:
        if os.path.isfile(cand):
            return cand
    return None


def _component_docs(path, text, root):
    """Composant → description, en suivant les imports du fichier de routage."""
    docs = {}
    for rx in (_IMPORT_DEFAULT, _IMPORT_LAZY):
        for m in rx.finditer(text):
            target = _resolve_import(path, m.group(2), root)
            if not target:
                continue
            try:
                docs[m.group(1)] = leading_doc(open(target, encoding="utf-8",
                                                    errors="ignore").read())
            except OSError:
                continue
    return docs


def harvest_react_router(root):
    """Retourne set[(url, name, 'react-router', description)]."""
    found = set()
    for path in walk_code(root):
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        if "<Route" not in text:
            continue
        docs = _component_docs(path, text, root)
        for m in _ROUTE_OPEN.finditer(text):
            attrs = _route_attrs(text, m.end())
            pm = _ATTR_PATH.search(attrs)
            if pm:
                url = pm.group(1)
            elif _ATTR_INDEX.search(attrs):
                url = "/"          # <Route index …> = route par défaut du parent
            else:
                continue           # <Route> de mise en page, sans chemin : pas un écran
            if not url.startswith("/"):
                url = "/" + url
            comp = _screen_name(attrs)
            if comp in ("Navigate", "Outlet"):
                continue           # redirection ou point d'insertion : pas un écran
            found.add((url, comp or url, "react-router", docs.get(comp)))
    return found


def harvest_next_pages(root):
    """Retourne set[(url, name, tech, description)] pour les deux routeurs Next.js.

    Les dossiers de routage viennent de `frameworks.next_router_dirs` : ce sont ceux d'un
    projet Next.js PROUVÉ (config ou dépendance), pas des dossiers reconnus au nom. Sans
    cette preuve, le `src/pages/` d'une app Vite passerait pour un routeur.
    """
    found = set()
    app_dirs, pages_dirs = next_router_dirs(root)
    for page_root, tech in ([(d, "next-app") for d in app_dirs]
                            + [(d, "next-pages") for d in pages_dirs]):
        for path in walk_code(page_root):
            fn = os.path.basename(path)
            stem = os.path.splitext(fn)[0]
            rel_dir = os.path.relpath(os.path.dirname(path), page_root)
            rel_dir = "" if rel_dir == "." else rel_dir.replace(os.sep, "/")
            if tech == "next-app":
                if not stem == "page":
                    continue
                segs = [s for s in rel_dir.split("/") if s and not (s.startswith("(") and s.endswith(")"))]
            else:
                if stem.startswith("_") or rel_dir.split("/")[0] == "api":
                    continue
                segs = [s for s in rel_dir.split("/") if s]
                if stem != "index":
                    segs.append(stem)
            url = "/" + "/".join(segs)
            try:
                desc = leading_doc(open(path, encoding="utf-8", errors="ignore").read())
            except OSError:
                desc = None
            found.add((url, segs[-1] if segs else "index", tech, desc))
    return found


def slugify(url):
    slug = re.sub(r"[^a-z0-9]+", "_", url.lower()).strip("_")
    return re.sub(r"_+", "_", slug) or "root"


def emit_yaml(app, root_kind, root_name, screens):
    L = [
        "# RÉCOLTÉ — ne pas éditer (source : routes d'interface du code). STD-031 §2.7.7 / I16.",
        "# Régénéré par scripts/archi-ci/harvest-screens.py. Modifier le CODE, pas ce fichier.",
        "# La racine est un placeholder de TOPOLOGIE, à fusionner (merge-manifests).",
        f"app: {app}",
        "elements:",
        f"  - id: {app}",
        f"    kind: {root_kind}",
        f"    name: {_yaml_str(root_name)}",
        "    audience: internal",
    ]
    # Les écrans vivent sous un conteneur `<app>.ui`, en miroir des endpoints sous
    # `<app>.api`. Sans ce palier, l'écran de la route `/matrices` et la table `matrices`
    # réclament le même id `<app>.matrices` : la fusion en garde un seul et le modèle perd
    # silencieusement un élément (constaté sur Morasse et Construction Gauthier).
    if screens:
        L += [
            f"  - id: {app}.ui",
            "    kind: webapp",
            "    name: Interface",
            f"    parent: {app}",
            "    audience: internal",
        ]
    used = {}
    for url, name, tech, desc in sorted(screens, key=lambda s: (s[0], s[1])):
        base = slugify(url)
        slug, n = base, 2
        while slug in used and used[slug] != url:
            slug, n = f"{base}_{n}", n + 1
        used[slug] = url
        L += [
            f"  - id: {app}.ui.{slug}",
            "    kind: screen",
            f"    name: {_yaml_str(name)}",
            f"    technology: {_yaml_str(f'route {url} ({tech})')}",
        ]
        if desc:
            L.append(f"    description: {_yaml_str(desc)}")
        L += [f"    parent: {app}.ui", "    audience: internal"]
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("root", nargs="?", default=".", help="Racine du repo à scanner (défaut: .)")
    ap.add_argument("--app", required=True, help="Slug ServiceDesk (racine de namespace)")
    ap.add_argument("--root-kind", default="webapp", choices=["webapp", "service", "system"])
    ap.add_argument("--root-name", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    if not os.path.isdir(args.root):
        print(f"❌ Racine introuvable : {args.root}", file=sys.stderr)
        sys.exit(1)

    screens = harvest_react_router(args.root) | harvest_next_pages(args.root)
    by_tech = {}
    for _, _, tech, _d in screens:
        by_tech[tech] = by_tech.get(tech, 0) + 1

    if not screens:
        print("⚠️  Aucun écran reconnu (React Router / Next.js). Grain screens non vérifié — "
              "ni conforme, ni en drift.", file=sys.stderr)

    yaml_out = emit_yaml(args.app, args.root_kind, args.root_name or args.app, screens)
    if args.out:
        with open(args.out, "w") as f:
            f.write(yaml_out)
        described = sum(1 for s in screens if s[3])
        detail = ", ".join(f"{k}:{v}" for k, v in sorted(by_tech.items())) or "aucun"
        print(f"✅ Récolté {len(screens)} écran(s) ({described} décrit(s)) [{detail}] "
              f"→ {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(yaml_out)


if __name__ == "__main__":
    main()

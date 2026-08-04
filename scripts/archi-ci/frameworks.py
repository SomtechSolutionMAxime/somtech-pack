#!/usr/bin/env python3
"""Localisation des racines de framework — commun aux récolteurs de routes et d'écrans.

POURQUOI CE MODULE EXISTE.

Les récolteurs déduisaient le framework d'un NOM DE DOSSIER : un `app/` à la racine valait
« Next.js App Router », un `src/pages/` valait « Next.js Pages Router ». Deux conventions
très répandues, et deux pièges :

  · en monorepo, `app/` est le dossier de l'application, pas le routeur. Le récolteur y
    entrait quand même et publiait `/src/app/api/assistant` — une URL qui n'existe sur
    aucun serveur, alors que la vraie est `/api/assistant` (mesuré sur ActionProgex) ;
  · dans une app Vite, `src/pages/` est un dossier de composants. Le récolteur en tirait
    une route par fichier (mesuré sur Morasse : 15 écrans inventés).

Dans les deux cas le grain produit était FAUX, pas seulement incomplet — le défaut qu'I19
sanctionne. On demande donc une preuve de framework (`next.config.*` ou la dépendance
déclarée) avant d'appliquer ses conventions, et on part de la racine du projet Next.js
trouvée, pas de celle du dépôt.
"""
import json
import os

SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "out", "coverage",
             ".turbo", ".vercel", "vendor", "__pycache__", "supabase"}
_NEXT_CONFIG = tuple(f"next.config{e}" for e in (".js", ".mjs", ".ts", ".cjs"))


def _declares_next(project_dir):
    pkg = os.path.join(project_dir, "package.json")
    if not os.path.isfile(pkg):
        return False
    try:
        data = json.load(open(pkg, encoding="utf-8", errors="ignore"))
    except (OSError, ValueError):
        return False
    return any("next" in (data.get(s) or {}) for s in ("dependencies", "devDependencies"))


def nextjs_projects(root, max_depth=3):
    """Racines de projets Next.js du dépôt (la racine elle-même, ou des workspaces)."""
    projects = []
    root = os.path.abspath(root)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        if dirpath.count(os.sep) - root.count(os.sep) > max_depth:
            dirnames[:] = []
            continue
        if any(c in filenames for c in _NEXT_CONFIG) or (
                "package.json" in filenames and _declares_next(dirpath)):
            projects.append(dirpath)
            dirnames[:] = []  # un projet Next.js n'en contient pas un autre
    return projects


def next_router_dirs(root):
    """→ (app_router_dirs, pages_dirs) : les dossiers de routage RÉELS, pas supposés."""
    app_dirs, pages_dirs = [], []
    for project in nextjs_projects(root):
        for rel in ("app", os.path.join("src", "app")):
            d = os.path.join(project, rel)
            if os.path.isdir(d):
                app_dirs.append(d)
        for rel in ("pages", os.path.join("src", "pages")):
            d = os.path.join(project, rel)
            if os.path.isdir(d):
                pages_dirs.append(d)
    return app_dirs, pages_dirs

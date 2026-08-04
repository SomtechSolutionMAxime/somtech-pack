#!/usr/bin/env python3
"""Récolteur — écrans → grain `screen` du manifeste architecture.yaml.

┌───────────────────────────────────────────────────────────────────────────────┐
│ PAS ENCORE OPPOSABLE — I19 NON PASSÉ. Cet outil n'est branché à AUCUNE CI.     │
│ Il a fabriqué de fausses adresses à deux revues successives (76 URL sur 98,    │
│ puis 5 restantes + 3 défauts créés par le correctif). STD-031 §2.7.9 : un      │
│ récolteur qui échoue au critère « zéro faux positif » est disqualifié — on ne  │
│ l'oppose pas aux dépôts. Utilisable À LA MAIN pour comparer ; jamais comme     │
│ référence, jamais dans un gate. Décision de Maxime, 2026-08-04 (D-20260804-0006).│
│ Levée : une revue indépendante sur corpus réel sans nouveau défaut.            │
└───────────────────────────────────────────────────────────────────────────────┘

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
# Un chemin ne se lit que s'il est ÉCRIT. `path={ROUTES.HOME}` ou `path={r.path}` (motif
# des routes déclarées dans un tableau) désigne une valeur calculée ailleurs : la récolter
# telle quelle publierait l'URL `/ROUTES.HOME`, qui n'existe sur aucun serveur.
_ATTR_PATH = re.compile(r"""\bpath\s*=\s*(?:\{\s*)?(['"`])(?P<url>[^'"`]*)\1""", re.IGNORECASE)
_ATTR_PATH_ANY = re.compile(r"\bpath\s*=", re.IGNORECASE)
_ATTR_ELEMENT = re.compile(r"\b(?:element|component)\s*=\s*(?P<val>\{.*|[\"'][^\"']*[\"'])",
                           re.DOTALL)
_JSX_TAG = re.compile(r"<([A-Z][\w.]*)")
# Marque un `path=` dont la valeur est calculée : on ne le récolte pas, on le signale.
_UNRESOLVED = object()
# `index` en attribut nu — pas le `index` de `key={index}`, d'où le refus d'un `{` devant.
_ATTR_INDEX = re.compile(r"(?<![\w{.])index\b(?!\s*=)", re.IGNORECASE)
# Composants d'encadrement : ils protègent ou enveloppent un écran, ils n'en sont pas un.
# `element={<RequireAuth><Inventaire/></RequireAuth>}` décrit l'écran Inventaire — nommer
# cette route « RequireAuth » ferait apparaître le même écran vingt fois dans le modèle.
# Liste VOLONTAIREMENT étroite. Une famille large (`Auth\\w*`, `Public\\w*`) écartait des
# écrans bien réels — `AuthCallbackPage`, `PublicProfilePage` — et la route se retrouvait
# nommée par son URL faute de composant. On ne retire que ce qui encadre, jamais ce qui doute.
_WRAPPERS = re.compile(
    r"\A(RequireAuth\w*|RequireRole\w*|RequireModule\w*|ProtectedRoute\w*|PrivateRoute\w*"
    r"|PublicRoute\w*|AuthGuard\w*|RouteGuard\w*|\w+Guard|\w*Layout|Layout\w*"
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


def _element_tags(attrs):
    """Composants JSX de l'attribut `element`, avec leur profondeur d'imbrication."""
    m = _ATTR_ELEMENT.search(attrs)
    if not m:
        return []
    val, out, depth, i = m.group("val"), [], 0, 0
    while i < len(val):
        if val.startswith("</", i):
            depth -= 1
            i = val.find(">", i) + 1 or len(val)
            continue
        if val[i] == "<":
            tag = _JSX_TAG.match(val, i)
            if tag:
                end = val.find(">", i)
                end = len(val) if end < 0 else end
                out.append((depth, tag.group(1)))
                if not val[i:end + 1].rstrip().endswith("/>"):
                    depth += 1
                i = end + 1
                continue
        i += 1
    return out


def _screen_name(attrs, imports=None):
    """Composant d'écran d'une balise Route : le plus PROFOND qui ne soit pas un cadre.

    « Le dernier » ne convient pas : dans `element={<Layout><Écran/><PiedDePage/></Layout>}`
    le dernier est `PiedDePage`. À profondeur égale, on départage par l'import — et seulement
    quand il désigne un candidat unique.
    """
    tags = [(d, t) for d, t in _element_tags(attrs) if not _WRAPPERS.match(t)]
    if not tags:
        return None
    deepest = max(d for d, _ in tags)
    candidates = [t for d, t in tags if d == deepest]
    if len(candidates) > 1 and imports:
        # Un seul des composants de même profondeur vient d'un fichier du dépôt : c'est le
        # seul indice objectif. Si plusieurs le sont, on ne tranche pas au hasard — le nom
        # restera celui de l'adresse, ce qui est moins précis mais jamais faux.
        known = [c for c in candidates if c in imports]
        if len(known) == 1:
            return known[0]
    return candidates[0]
# import Écran from './pages/Écran'   |   const Écran = lazy(() => import('./pages/Écran'))
_IMPORT_DEFAULT = re.compile(r"import\s+([A-Z][\w]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*[\"']([^\"']+)[\"']")
_IMPORT_LAZY = re.compile(
    r"(?:const|let|var)\s+([A-Z][\w]*)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*[\"']([^\"']+)[\"']")
# import { MaPlaceRHRoutes } from './modules/ma-place-rh/routes'
# Un sous-routeur s'exporte le plus souvent NOMMÉ, pas par défaut : sans ce motif, le point
# de montage reste introuvable et les routes du module sont publiées sans leur préfixe.
_IMPORT_NAMED = re.compile(r"import\s*\{([^}]*)\}\s*from\s*[\"']([^\"']+)[\"']")
# Minuscule acceptée : un sous-routeur exporté en fragment se nomme `rasciRoutes`, pas
# `RasciRoutes`. Ne garder que les identifiants capitalisés laissait ces montages invisibles.
# Sans risque de bruit : un import ne sert de montage que si sa cible déclare elle-même des
# routes, et le nom d'un écran reste cherché parmi les balises JSX (donc capitalisé).
_NAMED_PART = re.compile(r"\b([A-Za-z_$][\w$]*)\b(?:\s+as\s+([A-Za-z_$][\w$]*))?")


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


# Emplacements NOMMÉS où vit le code d'interface d'une app — même discipline que pour le
# SQL (harvest-supabase.DISCOVER_GLOBS). Un balayage aveugle du dépôt ramasse des maquettes
# (`modules/maquette/…`), des instantanés de documentation (`DOC/<uuid>/src/…`), des copies
# du dépôt dans lui-même et des dossiers dupliqués par le Finder (« … 2 ») : autant de
# routeurs qui ne sont pas déployés, et donc autant d'écrans inventés.
UI_ROOTS = ("src", "app", "pages")
# Emplacements où un dépôt Somtech range une application : à la racine, ou dans un
# sous-projet (`frontend/`, `apps/web/`, `packages/ui/`…). Ne chercher qu'à la racine
# rendait « aucun écran » sur toute structure en monorepo — et « aucun écran » se lit,
# côté gate, comme « grain non vérifié », donc comme un silence, pas comme une alerte.
_PROJECT_DEPTH = 2
# Noms de dossiers qui signalent du code non déployé, où qu'ils se trouvent.
# Liste VOLONTAIREMENT étroite : uniquement des noms qui désignent du code non déployé de
# façon non ambiguë. `docs`, `archives`, `examples` en ont été RETIRÉS — ce sont des noms de
# modules métier courants, et les écarter faisait disparaître des écrans bien réels sans
# rien signaler. Les instantanés de documentation et les copies du dépôt sont déjà hors
# d'atteinte : ils ne vivent pas sous une racine d'interface (`ui_roots`).
_NOT_SHIPPED = re.compile(r"\A(maquette|maquettes|mockup|mockups|storybook|__mocks__)\Z"
                          r"|\s\d+\Z", re.IGNORECASE)


def _project_dirs(root):
    """Racine du dépôt + sous-projets (dossiers portant un package.json, peu profonds)."""
    dirs = [root]
    root = os.path.abspath(root)
    for dirpath, dirnames, filenames in os.walk(root):
        depth = dirpath.count(os.sep) - root.count(os.sep)
        dirnames[:] = [] if depth >= _PROJECT_DEPTH else [
            d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        if dirpath != root and "package.json" in filenames:
            dirs.append(dirpath)
    return dirs


def ui_roots(root):
    """Racines de code d'interface présentes dans ce dépôt (chemins absolus, dédupliqués)."""
    seen, out = set(), []
    for project in _project_dirs(root):
        for rel in UI_ROOTS:
            d = os.path.join(project, rel)
            real = os.path.realpath(d)
            if os.path.isdir(d) and real not in seen and not any(
                    real.startswith(s + os.sep) for s in seen):
                seen.add(real)
                out.append(d)
    return out


def walk_code(directory):
    """Fichiers de code sous `directory` (récursif), hors dossiers non déployés."""
    for dirpath, dirnames, filenames in os.walk(directory):
        dirnames[:] = [d for d in dirnames
                       if d not in SKIP_DIRS and not d.startswith(".")
                       and not _NOT_SHIPPED.match(d)
                       # un dossier qui porte son propre .git est un autre dépôt
                       and not os.path.isdir(os.path.join(dirpath, d, ".git"))]
        for fn in filenames:
            if fn.endswith(CODE_EXT) and not _TEST_FILE.search(fn):
                yield os.path.join(dirpath, fn)


def walk_ui(root):
    """Fichiers d'interface du dépôt, depuis les emplacements NOMMÉS seulement.

    Distinct de `walk_code`, qui balaie un dossier déjà choisi : les routeurs Next.js sont
    localisés par `frameworks.next_router_dirs`, alors que React Router déclare ses routes
    n'importe où dans le code d'interface — il faut donc borner d'abord.
    """
    for base in ui_roots(root):
        yield from walk_code(base)


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


def _component_files(path, text, root):
    """Composant → fichier du dépôt qui le définit, d'après les imports du fichier."""
    out = {}
    for rx in (_IMPORT_DEFAULT, _IMPORT_LAZY):
        for m in rx.finditer(text):
            target = _resolve_import(path, m.group(2), root)
            if target:
                out[m.group(1)] = target
    for m in _IMPORT_NAMED.finditer(text):
        target = _resolve_import(path, m.group(2), root)
        if not target:
            continue
        for part in _NAMED_PART.finditer(m.group(1)):
            out[part.group(2) or part.group(1)] = target
    return out


def _file_doc(path):
    try:
        return leading_doc(open(path, encoding="utf-8", errors="ignore").read())
    except OSError:
        return None


def _parse_route_tree(text):
    """Arbre des `<Route>` d'un fichier, imbrication comprise.

    Un balayage à plat lit chaque balise isolément et prend son `path` pour une URL. Or
    React Router compose : `<Route path="ma-place-rh/*">` monte un sous-arbre dont les
    enfants déclarent `path="dashboard"`. À plat, ce `dashboard` — un chemin RELATIF — était
    publié comme `/dashboard`, une adresse qui répond 404. Sur Construction Gauthier, 76 des
    98 écrans étaient dans ce cas : le modèle affirmait des URL inexistantes, et il en
    fabriquait une de plus à chaque module ajouté.

    Chaque noeud retient son corps PROPRE — le texte qui lui appartient, débarrassé de celui
    de ses enfants. C'est ce qui permet de repérer un sous-routeur inséré en fragment
    (`{rasciRoutes}`) à l'endroit exact où il est monté, et pas à tous les niveaux au-dessus.
    """
    root = {"path": None, "index": False, "attrs": "", "children": [],
            "tag_start": 0, "body_start": 0, "body_end": len(text), "body": ""}
    stack = [root]
    i = 0
    while i < len(text):
        close = text.find("</Route", i)
        m = _ROUTE_OPEN.search(text, i)
        if m and (close < 0 or m.start() < close):
            attrs = _route_attrs(text, m.end())
            end = m.end() + len(attrs)
            node = {"path": None, "index": False, "attrs": attrs, "children": [],
                    "tag_start": m.start(), "body_start": end + 1,
                    "body_end": end + 1, "body": ""}
            pm = _ATTR_PATH.search(attrs)
            if pm:
                node["path"] = pm.group("url")
            elif _ATTR_PATH_ANY.search(attrs):
                node["path"] = _UNRESOLVED       # chemin calculé : on ne devine pas
            elif _ATTR_INDEX.search(attrs):
                node["index"] = True
            stack[-1]["children"].append(node)
            if not attrs.rstrip().endswith("/"):
                stack.append(node)
            i = end + 1
            continue
        if close < 0:
            break
        if len(stack) > 1:
            stack.pop()["body_end"] = close
        i = close + len("</Route")

    def own(node):
        """Texte du noeud, privé de celui de ses enfants."""
        parts, cursor = [], node["body_start"]
        for child in node["children"]:
            parts.append(text[cursor:child["tag_start"]])
            cursor = max(cursor, child["body_end"])
            own(child)
        parts.append(text[cursor:node["body_end"]])
        node["body"] = "".join(parts)

    own(root)
    return root


def _join_url(prefix, segment):
    """Compose le chemin d'un enfant avec celui de son point de montage."""
    segment = (segment or "").strip()
    if segment.startswith("/"):          # chemin absolu : il ignore son parent
        base = segment
    else:
        base = prefix.rstrip("/") + "/" + segment if segment else prefix
    base = re.sub(r"/{2,}", "/", base)
    return (base if base.startswith("/") else "/" + base) or "/"


def _as_prefix(url):
    """URL d'un noeud vue comme PRÉFIXE de ses enfants : le `/*` final tombe.

    Le dé-suffixage n'a de sens que là. Appliqué aussi aux feuilles, il transformait
    `<Route path="*" element={<NotFound/>}/>` en un écran servi à `/` — une affirmation
    fausse, puisque `/` est capté par la route qui le déclare explicitement.
    """
    return re.sub(r"/\*+$", "", url) or "/"


def _router_files(root):
    """Fichiers déclarant des `<Route>`, avec leur texte et leur table d'imports."""
    files = {}
    for path in walk_ui(root):
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        if "<Route" not in text:
            continue
        files[path] = {"text": text, "tree": _parse_route_tree(blank_imports(text)),
                       "imports": _component_files(path, text, root)}
    return files


# `{rasciRoutes}` — un sous-routeur exporté comme FRAGMENT JSX (`export const rasciRoutes =
# (<Route path="rasci" …>)`) puis inséré dans le parent. Ce n'est pas un composant : il
# n'apparaît dans aucun `element={…}`, donc le montage passait inaperçu et le fichier était
# traité comme une racine — ses chemins relatifs republiés en absolu.
_FRAGMENT_REF = re.compile(r"\{\s*([A-Za-z_$][\w$]*)\s*\}")
# `import { MaPlaceRHRoutes } from …` porte exactement la forme d'un fragment `{X}`. Laissé
# tel quel, chaque import de sous-routeur était compté comme un montage À LA RACINE, en plus
# du montage réel : le module ressortait deux fois, une fois préfixé, une fois nu.
_IMPORT_STMT = re.compile(
    r"^[ \t]*import\s[^;]*?\sfrom\s*[\"'][^\"']+[\"'][ \t]*;?"
    r"|^[ \t]*import\s*\{[^}]*\}\s*from\s*[\"'][^\"']+[\"'][ \t]*;?"
    r"|^[ \t]*import\s*[\"'][^\"']+[\"'][ \t]*;?"
    r"|^[ \t]*export\s*\{[^}]*\}\s*from\s*[\"'][^\"']+[\"'][ \t]*;?",
    re.MULTILINE | re.DOTALL)


def blank_imports(text):
    """Neutralise les instructions d'import/export en préservant les positions."""
    return _IMPORT_STMT.sub(lambda m: " " * len(m.group(0)), text)


def _mount_target(node, imports, files):
    """Fichier de routes monté par ce noeud, s'il délègue à un sous-routeur importé."""
    for _, tag in _element_tags(node["attrs"]):
        target = imports.get(tag)
        if target in files:
            return target
    return None


def _fragment_mounts(body, imports, files):
    """Fichiers de routes insérés en fragment `{identifiant}` dans ce corps de balise."""
    out = []
    for m in _FRAGMENT_REF.finditer(body or ""):
        target = imports.get(m.group(1))
        if target in files and target not in out:
            out.append(target)
    return out


def _flatten(node, prefix, path, files, out, unresolved, seen):
    """Parcourt l'arbre d'un fichier et suit les montages vers les autres fichiers."""
    info = files[path]
    # Sous-routeurs insérés en fragment `{mesRoutes}` directement dans ce noeud.
    for target in _fragment_mounts(node.get("body"), info["imports"], files):
        if target not in seen:
            _flatten(files[target]["tree"], _as_prefix(prefix), target, files, out,
                     unresolved, seen | {target})
    for child in node["children"]:
        if child["path"] is _UNRESOLVED:
            unresolved.append(path)
            continue
        url = prefix if child["index"] else _join_url(prefix, child["path"])
        target = _mount_target(child, info["imports"], files)
        if target and target not in seen:
            _flatten(files[target]["tree"], _as_prefix(url), target, files, out,
                     unresolved, seen | {target})
            continue
        if child["children"] or _fragment_mounts(child.get("body"), info["imports"], files):
            _flatten(child, _as_prefix(url), path, files, out, unresolved, seen)
            # Une route qui porte une route `index` est une MISE EN PAGE : à cette adresse,
            # c'est l'enfant `index` qui s'affiche dans son emplacement. Émettre les deux
            # ferait deux écrans pour une seule adresse — le cadre et son contenu.
            if any(c["index"] for c in child["children"]):
                continue
        if child["path"] is None and not child["index"]:
            continue     # <Route> sans chemin : porte ses enfants, n'est pas un écran
        if child["children"] and not _ATTR_ELEMENT.search(child["attrs"]):
            continue     # regroupement de chemin sans rendu propre : pas un écran non plus
        comp = _screen_name(child["attrs"], info["imports"])
        if comp in ("Navigate", "Outlet"):
            continue         # redirection ou point d'insertion : pas un écran
        doc = None
        if comp and info["imports"].get(comp):
            doc = _file_doc(info["imports"][comp])
        out.add((url, comp or url, "react-router", doc))


def _mounted_files(files):
    """Fichiers de routes montés par un autre — donc jamais des racines."""
    mounted = set()
    for path, info in files.items():
        stack = [info["tree"]]
        while stack:
            node = stack.pop()
            for target in _fragment_mounts(node.get("body"), info["imports"], files):
                if target != path:
                    mounted.add(target)
            for child in node["children"]:
                target = _mount_target(child, info["imports"], files)
                if target and target != path:
                    mounted.add(target)
                stack.append(child)
    return mounted


def harvest_react_router(root):
    """Retourne (set[(url, name, 'react-router', description)], fichiers non résolus)."""
    files = _router_files(root)
    # Un fichier monté par un autre n'est PAS une racine : ses chemins sont relatifs et
    # n'ont de sens qu'une fois préfixés. L'émettre seul reviendrait à publier des URL
    # tronquées — précisément le défaut corrigé ici.
    mounted = _mounted_files(files)
    roots = [p for p in sorted(files) if p not in mounted]

    found, unresolved = set(), []
    for path in roots:
        _flatten(files[path]["tree"], "/", path, files, found, unresolved, {path})

    # Tous montés et aucune racine : les montages forment un cycle, on ne sait pas par où
    # entrer. On n'invente pas un point d'entrée — on le dit.
    orphans = [] if roots else sorted(files)
    return found, unresolved, orphans


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
    # Un écran est identifié par (adresse, composant). La description, elle, dépend de la
    # résolution de l'import : deux entrées identiques à la description près décrivent le
    # MÊME écran et doivent fusionner. Sans cette réduction, elles produisaient deux fois le
    # même id et `validate-manifest` rejetait le manifeste — un gate strict devenait alors
    # insatisfiable sans écrire un fait faux (I18).
    merged = {}
    for url, name, tech, desc in screens:
        key = (url, name, tech)
        if key not in merged or (desc and not merged[key]):
            merged[key] = desc
    used = {}
    for (url, name, tech), desc in sorted(merged.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        base = slugify(url)
        slug, n = base, 2
        # La clé est le COUPLE (url, composant) : deux écrans réellement distincts servis
        # sur la même adresse — cas légitime quand deux modules exposent `/dashboard` —
        # doivent recevoir deux ids. Dédupliquer sur la seule URL les faisait s'écraser, et
        # `validate-manifest` rejetait ensuite le manifeste pour id dupliqué.
        while slug in used and used[slug] != (url, name):
            slug, n = f"{base}_{n}", n + 1
        used[slug] = (url, name)
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

    screens, unresolved, orphans = harvest_react_router(args.root)
    screens |= harvest_next_pages(args.root)
    if orphans:
        print(f"⚠️  {len(orphans)} fichier(s) de routes se montent mutuellement (cycle) : "
              f"aucun point d'entrée déterminable, écrans NON récoltés. "
              f"Fichiers : {', '.join(os.path.relpath(o, args.root) for o in orphans[:5])}",
              file=sys.stderr)
    if unresolved:
        print(f"⚠️  {len(unresolved)} route(s) déclarent un chemin calculé (path={{…}}) : "
              f"non récoltées, à déclarer à la main si ce sont des écrans. "
              f"Fichiers : {', '.join(sorted({os.path.relpath(u, args.root) for u in unresolved})[:5])}",
              file=sys.stderr)
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

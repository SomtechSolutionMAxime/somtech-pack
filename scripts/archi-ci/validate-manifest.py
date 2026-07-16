#!/usr/bin/env python3
"""Valide un manifeste architecture.yaml (modèle vivant Somtech, STD-031).

┌───────────────────────────────────────────────────────────────────────────┐
│ COPIE DISTRIBUÉE — source canonique : repo `architecture`, scripts/         │
│ validate-manifest.py (STD-031). Ne pas diverger : corriger l'original côté  │
│ Architecture, puis re-synchroniser cette copie via le pack. Le schéma       │
│ canonique est copié sous ./schema/architecture-manifest.schema.json.        │
└───────────────────────────────────────────────────────────────────────────┘

Conçu pour tourner dans la CI de n'importe quel repo applicatif (gate de merge) :
ne dépend que de PyYAML. Les listes canoniques (kinds, audience, externes connus)
sont lues depuis schema/architecture-manifest.schema.json — une seule source (I9).

Vérifie :
  - structure (app + pattern, elements non vide, champs requis, pas de clé inconnue)
  - kind ∈ enum du schéma · audience ∈ enum du schéma
  - id qualifié bien formé · racine == app · unicité des ids
  - parent existe localement et n'est pas l'élément lui-même
  - relations[] : from ET to sont des éléments LOCAUX (relation interne)
  - depends_on[] : from local ; to = externe connu OU id qualifié d'un AUTRE repo

Usage :
  python3 validate-manifest.py <chemin/architecture.yaml> [--schema <schema.json>]
  → exit 0 si valide, exit 1 sinon (avec messages d'erreur précis).
"""
import argparse
import json
import os
import re
import sys

try:
    import yaml
except ImportError:
    print("❌ PyYAML requis : pip install pyyaml", file=sys.stderr)
    sys.exit(2)

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SCHEMA = os.path.join(HERE, "schema", "architecture-manifest.schema.json")

# Tirets autorisés dans les segments : les slugs ServiceDesk en contiennent (ma-place-rh,
# construction-gauthier) et Likec4 les accepte comme identifiants (vérifié).
QUALIFIED_ID_RE = re.compile(r"^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)*$")
APP_RE = re.compile(r"^[a-z][a-z0-9-]*$")


def load_schema(path):
    with open(path) as f:
        schema = json.load(f)
    defs = schema.get("$defs", {})
    return {
        "kinds": set(schema["$defs"]["element"]["properties"]["kind"]["enum"]),
        "audiences": set(schema["$defs"]["element"]["properties"]["audience"]["enum"]),
        "externals": set(defs["externalId"]["enum"]),
        "element_props": set(schema["$defs"]["element"]["properties"].keys()),
        "element_required": set(schema["$defs"]["element"]["required"]),
        "relation_props": set(schema["$defs"]["relation"]["properties"].keys()),
        "top_props": set(schema["properties"].keys()),
        "top_required": set(schema["required"]),
    }


def root_of(qid):
    return qid.split(".")[0]


def validate(manifest_path, schema):
    errors = []

    def err(msg):
        errors.append(msg)

    with open(manifest_path) as f:
        try:
            data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            return [f"YAML invalide : {e}"]

    if not isinstance(data, dict):
        return ["Le manifeste doit être un objet YAML (clés app/elements/...)."]

    # ── Top-level ────────────────────────────────────────────────────────────
    for k in data:
        if k not in schema["top_props"]:
            err(f"Clé racine inconnue : '{k}' (attendu : {sorted(schema['top_props'])}).")
    for k in schema["top_required"]:
        if k not in data:
            err(f"Clé racine requise manquante : '{k}'.")

    app = data.get("app")
    if app is not None and not (isinstance(app, str) and APP_RE.match(app)):
        err(f"app='{app}' invalide (minuscules/chiffres/tirets, doit commencer par une lettre).")

    elements = data.get("elements") or []
    if not isinstance(elements, list) or len(elements) == 0:
        err("elements[] doit être une liste non vide.")
        elements = []

    # ── Éléments ─────────────────────────────────────────────────────────────
    ids = {}
    for idx, el in enumerate(elements):
        loc = f"elements[{idx}]"
        if not isinstance(el, dict):
            err(f"{loc} doit être un objet.")
            continue
        for k in el:
            if k not in schema["element_props"]:
                err(f"{loc} : champ inconnu '{k}'.")
        for k in schema["element_required"]:
            if k not in el:
                err(f"{loc} : champ requis manquant '{k}'.")
        eid = el.get("id")
        if eid is not None:
            if not QUALIFIED_ID_RE.match(str(eid)):
                err(f"{loc} : id '{eid}' mal formé (attendu <app>.<comp>[.<sous>] snake_case).")
            elif app and root_of(eid) != app:
                err(f"{loc} : id '{eid}' doit avoir '{app}' comme racine (= app).")
            if eid in ids:
                err(f"{loc} : id '{eid}' dupliqué (déjà défini à elements[{ids[eid]}]).")
            else:
                ids[eid] = idx
        kind = el.get("kind")
        if kind is not None and kind not in schema["kinds"]:
            err(f"{loc} : kind '{kind}' inconnu (attendu : {sorted(schema['kinds'])}).")
        aud = el.get("audience")
        if aud is not None and aud not in schema["audiences"]:
            err(f"{loc} : audience '{aud}' invalide (attendu : {sorted(schema['audiences'])}).")
        name = el.get("name")
        if name is not None and not (isinstance(name, str) and name.strip()):
            err(f"{loc} : name vide.")

    # parent + convention déterministe (racine unique id==app, hiérarchie alignée)
    roots = []
    for idx, el in enumerate(elements):
        if not isinstance(el, dict):
            continue
        eid = el.get("id")
        parent = el.get("parent")
        if parent is None:
            roots.append(eid)
            continue
        if parent == eid:
            err(f"elements[{idx}] : parent '{parent}' ne peut pas être l'élément lui-même.")
            continue
        if parent not in ids:
            err(f"elements[{idx}] : parent '{parent}' n'existe pas dans ce manifeste.")
        # alignement id ↔ parent : id doit être "<parent>.<segment>"
        if eid and isinstance(eid, str) and "." in eid:
            expected_parent = eid.rsplit(".", 1)[0]
            if parent != expected_parent:
                err(f"elements[{idx}] : id '{eid}' implique parent '{expected_parent}', "
                    f"mais parent déclaré = '{parent}' (la hiérarchie des ids doit refléter l'imbrication).")
        elif eid and "." not in str(eid):
            err(f"elements[{idx}] : id '{eid}' sans point ne peut pas avoir de parent.")

    if app:
        if len(roots) == 0:
            err("Aucun élément racine (sans parent). Il faut exactement une racine dont l'id == app.")
        elif len(roots) > 1:
            err(f"Plusieurs racines {roots} — il faut exactement une racine (le conteneur de l'app).")
        elif roots[0] != app:
            err(f"L'élément racine '{roots[0]}' doit avoir l'id == app ('{app}').")

    # ── relations[] (internes) ───────────────────────────────────────────────
    for idx, rel in enumerate(data.get("relations") or []):
        loc = f"relations[{idx}]"
        if not isinstance(rel, dict):
            err(f"{loc} doit être un objet.")
            continue
        for k in rel:
            if k not in schema["relation_props"]:
                err(f"{loc} : champ inconnu '{k}'.")
        for side in ("from", "to"):
            v = rel.get(side)
            if v is None:
                err(f"{loc} : '{side}' requis.")
            elif v not in ids:
                err(f"{loc} : '{side}'='{v}' n'est pas un élément local — "
                    f"une relation interne ne lie que des éléments de ce repo "
                    f"(utiliser depends_on pour une cible externe/cross-repo).")

    # ── depends_on[] (sortantes) ─────────────────────────────────────────────
    for idx, dep in enumerate(data.get("depends_on") or []):
        loc = f"depends_on[{idx}]"
        if not isinstance(dep, dict):
            err(f"{loc} doit être un objet.")
            continue
        for k in dep:
            if k not in schema["relation_props"]:
                err(f"{loc} : champ inconnu '{k}'.")
        frm = dep.get("from")
        if frm is None:
            err(f"{loc} : 'from' requis.")
        elif frm not in ids:
            err(f"{loc} : 'from'='{frm}' doit être un élément local.")
        to = dep.get("to")
        if to is None:
            err(f"{loc} : 'to' requis.")
        elif to in schema["externals"]:
            pass  # externe connu
        elif QUALIFIED_ID_RE.match(str(to)):
            if app and root_of(to) == app:
                err(f"{loc} : 'to'='{to}' vise le même repo — c'est une relation interne, "
                    f"la déclarer dans relations[].")
        else:
            err(f"{loc} : 'to'='{to}' invalide (externe connu {sorted(schema['externals'])} "
                f"ou id qualifié d'un autre repo).")

    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("manifest", help="Chemin du architecture.yaml à valider")
    parser.add_argument("--schema", default=DEFAULT_SCHEMA, help="Chemin du JSON Schema")
    args = parser.parse_args()

    if not os.path.exists(args.manifest):
        print(f"❌ Manifeste introuvable : {args.manifest}", file=sys.stderr)
        sys.exit(1)

    schema = load_schema(args.schema)
    errors = validate(args.manifest, schema)

    if errors:
        print(f"❌ {len(errors)} erreur(s) dans {args.manifest} :")
        for e in errors:
            print(f"   • {e}")
        sys.exit(1)

    print(f"✅ {args.manifest} valide (schéma {os.path.basename(args.schema)}).")


if __name__ == "__main__":
    main()

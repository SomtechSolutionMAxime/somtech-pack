#!/usr/bin/env python3
"""Générateur — grain `table` du manifeste → diagramme ERD Mermaid.

Modèle vivant Somtech (STD-031 §2.7, « publier les vues »). Lit un architecture.yaml
et produit un ERD Mermaid (`erDiagram`) des tables du repo + leurs relations FK.
Dérivé du même manifeste que le gate → une seule source de vérité, zéro dessin manuel.

Portée : éléments `kind: table` (entités) + `relations` FK internes (arêtes). Les FK
cross-repo (`depends_on`) apparaissent comme entités externes annotées. Les colonnes ne
sont pas récoltées (hors champ) → entités sans attributs.

Ne dépend que de PyYAML.

Usage :
  python3 generate-erd.py <architecture.yaml> [--out docs/architecture/erd.md]
                          [--check]   # compare à --out sans écrire ; exit 1 si obsolète
  Défaut sans --out : stdout.
"""
import argparse
import os
import re
import sys

try:
    import yaml
except ImportError:
    print("❌ PyYAML requis : pip install pyyaml", file=sys.stderr)
    sys.exit(2)

BANNER = (
    "<!-- GÉNÉRÉ — ne pas éditer. Vue dérivée de architecture.yaml "
    "(grain table) par scripts/archi-ci/generate-erd.py. STD-031 §2.7. -->\n"
)


def entity_name(qid, app):
    """`<app>.<table>` → `table` (nom d'entité Mermaid : [A-Za-z0-9_])."""
    seg = qid.split(".")[-1]
    safe = re.sub(r"[^A-Za-z0-9_]", "_", seg)
    if safe and safe[0].isdigit():
        safe = "t_" + safe
    return safe or "entity"


def build(data):
    app = data.get("app", "app")
    elements = data.get("elements") or []
    tables = {}  # qid → entity name
    for el in elements:
        if isinstance(el, dict) and el.get("kind") == "table" and el.get("id"):
            tables[el["id"]] = entity_name(el["id"], app)

    lines = ["erDiagram"]
    # Entités (tables locales)
    for qid in sorted(tables):
        lines.append(f"    {tables[qid]} {{")
        lines.append("    }")

    # Arêtes FK internes (relations entre 2 tables locales)
    edges = []
    for rel in data.get("relations") or []:
        if not isinstance(rel, dict):
            continue
        frm, to = rel.get("from"), rel.get("to")
        if frm in tables and to in tables:
            label = str(rel.get("label") or "FK").replace('"', "'")
            edges.append((tables[frm], tables[to], label))

    # FK cross-repo → entité externe annotée. Toute dépendance sortante DEPUIS une table
    # est une référence de données, quel que soit son label (F7 : ne pas exiger « FK »).
    externals = {}
    for dep in data.get("depends_on") or []:
        if not isinstance(dep, dict):
            continue
        frm, to = dep.get("from"), dep.get("to")
        if frm in tables and to:
            ext = entity_name(to, app) + "_ext"
            externals[to] = ext
            label = str(dep.get("label") or "FK").replace('"', "'")
            edges.append((tables[frm], ext, label))

    for ext in sorted(set(externals.values())):
        lines.append(f"    {ext} {{")
        lines.append("        _ externe")
        lines.append("    }")

    for frm, to, label in sorted(edges):
        # child (porte la FK) many-to-one parent référencé
        lines.append(f'    {frm} }}o--|| {to} : "{label}"')

    return app, tables, "\n".join(lines) + "\n"


def render_md(app, tables, mermaid):
    n = len(tables)
    header = f"# ERD — {app}\n\n{BANNER}\n"
    # 0 table → pas de bloc `erDiagram` vide (GitHub rend une erreur Mermaid — F6).
    if n == 0:
        return (
            f"{header}"
            "_Aucune table récoltée dans `architecture.yaml` — pas de diagramme entité-relation "
            "à afficher (service sans schéma de données propre)._\n"
        )
    return (
        f"{header}"
        f"{n} table(s) récoltée(s) depuis `architecture.yaml`.\n\n"
        "```mermaid\n"
        f"{mermaid}"
        "```\n"
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("manifest", help="architecture.yaml source")
    ap.add_argument("--out", default=None, help="Fichier Markdown de sortie (défaut: stdout)")
    ap.add_argument("--check", action="store_true",
                    help="Compare la sortie à --out sans écrire ; exit 1 si obsolète")
    args = ap.parse_args()

    if not os.path.exists(args.manifest):
        print(f"❌ Manifeste introuvable : {args.manifest}", file=sys.stderr)
        sys.exit(2)

    with open(args.manifest) as f:
        data = yaml.safe_load(f) or {}

    app, tables, mermaid = build(data)
    md = render_md(app, tables, mermaid)

    if args.check:
        target = args.out or "docs/architecture/erd.md"
        current = open(target).read() if os.path.exists(target) else ""
        if current == md:
            print(f"✅ ERD à jour : {target}", file=sys.stderr)
            return
        print(f"⚠️  ERD obsolète : {target} — régénérer "
              f"(npx @somtech-solutions/pack generate-erd {args.manifest} --out {target}).",
              file=sys.stderr)
        sys.exit(1)

    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with open(args.out, "w") as f:
            f.write(md)
        print(f"✅ ERD généré ({len(tables)} table(s)) → {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(md)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Fusionne plusieurs manifestes RÉCOLTÉS partiels en un seul manifeste récolté.

Modèle vivant Somtech (STD-031 §2.7.7). Les récolteurs émettent chacun leur grain
(tables, endpoints, topologie). Ce script les unit en un manifeste unique, prêt à
être comparé au fichier committé (diff-manifest) ou validé (validate-manifest).

Règles de fusion :
  - app          : doit être identique partout (sinon erreur).
  - elements     : union par `id`. Le PREMIER fichier gagne pour les scalaires ;
                   les champs absents sont complétés par les fichiers suivants.
                   Un conflit de `kind` sur un même id est SIGNALÉ (stderr, non fatal).
  - relations    : union, dédupliquée par (from, to, label).
  - depends_on   : union, dédupliquée par (from, to, label).

Ne dépend que de PyYAML. Ordre des fichiers = ordre de priorité des scalaires.

Usage :
  python3 merge-manifests.py <a.yaml> <b.yaml> ... --app <slug> [--out <fichier>]
"""
import argparse
import sys

try:
    import yaml
except ImportError:
    print("❌ PyYAML requis : pip install pyyaml", file=sys.stderr)
    sys.exit(2)


def load(path):
    with open(path) as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path} : le manifeste doit être un objet YAML.")
    return data


def merge(paths, app):
    elements = {}          # id → dict
    elem_order = []        # ordre d'apparition
    kind_conflicts = []
    relations = {}         # (from,to,label) → dict
    depends_on = {}

    for path in paths:
        data = load(path)
        a = data.get("app")
        if a and app and a != app:
            raise ValueError(f"{path} : app='{a}' ≠ '{app}' (slug incohérent entre récolteurs).")

        for el in data.get("elements") or []:
            if not isinstance(el, dict) or "id" not in el:
                continue
            eid = el["id"]
            if eid not in elements:
                elements[eid] = dict(el)
                elem_order.append(eid)
            else:
                existing = elements[eid]
                # conflit de kind → signalé, on garde le premier
                if "kind" in el and "kind" in existing and el["kind"] != existing["kind"]:
                    kind_conflicts.append((eid, existing["kind"], el["kind"]))
                # complète les champs absents (le premier fichier reste prioritaire)
                for k, v in el.items():
                    if k not in existing or existing[k] in (None, ""):
                        existing[k] = v

        for kind, bucket in (("relations", relations), ("depends_on", depends_on)):
            for rel in data.get(kind) or []:
                if not isinstance(rel, dict):
                    continue
                key = (rel.get("from"), rel.get("to"), rel.get("label"))
                if key not in bucket:
                    bucket[key] = dict(rel)

    merged = {"app": app, "elements": [elements[i] for i in elem_order]}
    if relations:
        merged["relations"] = list(relations.values())
    if depends_on:
        merged["depends_on"] = list(depends_on.values())
    return merged, kind_conflicts


def emit_yaml(merged):
    """Émission déterministe (ordre de champs stable) pour un diff lisible."""
    L = [
        "# RÉCOLTÉ (fusionné) — ne pas éditer. Union des grains des récolteurs.",
        "# Régénéré par scripts/archi-ci/merge-manifests.py. STD-031 §2.7.7.",
        f"app: {merged['app']}",
        "elements:",
    ]
    field_order = ["id", "kind", "name", "technology", "description", "parent", "audience", "tags"]
    for el in merged["elements"]:
        first = True
        for k in field_order:
            if k not in el:
                continue
            v = el[k]
            if k == "tags" and isinstance(v, list):
                v = "[" + ", ".join(str(x) for x in v) + "]"
            prefix = "  - " if first else "    "
            L.append(f"{prefix}{k}: {v}")
            first = False
    for section in ("relations", "depends_on"):
        rels = merged.get(section)
        if not rels:
            continue
        L.append(f"{section}:")
        for rel in rels:
            L.append(f"  - from: {rel.get('from')}")
            L.append(f"    to: {rel.get('to')}")
            if rel.get("label") is not None:
                L.append(f"    label: {rel.get('label')}")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("manifests", nargs="+", help="Manifestes partiels à fusionner (ordre = priorité)")
    ap.add_argument("--app", required=True, help="Slug ServiceDesk attendu")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    try:
        merged, conflicts = merge(args.manifests, args.app)
    except (ValueError, OSError) as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)

    for eid, k1, k2 in conflicts:
        print(f"⚠️  Conflit de kind sur '{eid}' : gardé '{k1}', ignoré '{k2}'.", file=sys.stderr)

    out = emit_yaml(merged)
    if args.out:
        with open(args.out, "w") as f:
            f.write(out)
        print(f"✅ Fusionné {len(args.manifests)} manifeste(s) → {len(merged['elements'])} "
              f"élément(s) dans {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(out)


if __name__ == "__main__":
    main()

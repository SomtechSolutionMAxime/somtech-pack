#!/usr/bin/env python3
"""Compare le manifeste COMMITTÉ au manifeste RÉCOLTÉ — gate de complétude.

Modèle vivant Somtech (STD-031 §2.7, règle d'or n°9). Comparaison STRUCTURELLE
(ensembles d'ids/arêtes, pas l'ordre ni le format du YAML) entre :
  - COMMITTÉ  : le architecture.yaml versionné dans le repo (ce que la doc affirme) ;
  - RÉCOLTÉ   : ce que les récolteurs ont extrait du code réel (merge-manifests).

Signal de drift (ce que la règle n°9 cible) :
  • élément RÉCOLTÉ absent du committé  → le code a un élément que la doc ignore ;
  • arête   RÉCOLTÉE absente du committé → idem pour une relation/dépendance ;
  • `kind` divergent sur un id commun (hors racine) → la doc décrit mal l'élément.
Ces trois cas BLOQUENT en mode strict.

Signal informatif (jamais bloquant) :
  • élément/arête COMMITTÉ absent du récolté → présent dans la doc mais non retrouvé
    par les récolteurs (ajout manuel légitime : cross-repo, écran, mcp_tool, topologie ;
    OU grain non couvert par un récolteur ; OU élément supprimé du code). À revoir à l'œil.

La racine (élément sans parent / id == app) est exclue de la comparaison de `kind`
(son kind est fixé à la main à l'amorçage — placeholder côté récolté).

Modes :
  warn   (défaut) : rapport écrit, exit 0 (ne bloque jamais).
  strict          : exit 1 si au moins un drift bloquant.

Usage :
  python3 diff-manifest.py <committé.yaml> <récolté.yaml> [--mode warn|strict]
                           [--report <fichier.md>]
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


def index(data):
    """→ (elements:{id:el}, roots:set, edges:{('rel'|'dep',from,to)})."""
    elements, roots = {}, set()
    app = data.get("app")
    for el in data.get("elements") or []:
        if not isinstance(el, dict) or "id" not in el:
            continue
        eid = el["id"]
        elements[eid] = el
        if el.get("parent") is None or eid == app:
            roots.add(eid)
    edges = set()
    soft = set()  # arêtes récoltées « à qualifier » (cible non résoluble par le récolteur)
    for rel in data.get("relations") or []:
        if isinstance(rel, dict) and rel.get("from") and rel.get("to"):
            edges.add(("rel", rel["from"], rel["to"]))
    for dep in data.get("depends_on") or []:
        if isinstance(dep, dict) and dep.get("from") and dep.get("to"):
            key = ("dep", dep["from"], dep["to"])
            edges.add(key)
            if "qualifier" in str(dep.get("label") or "").lower():
                soft.add(key)
    return elements, roots, edges, soft


def compute(committed, harvested):
    c_el, c_roots, c_edges, _c_soft = index(committed)
    h_el, h_roots, h_edges, h_soft = index(harvested)

    # Drift bloquant : récolté (code) absent du committé (doc).
    # On exclut du BLOCAGE les arêtes récoltées « à qualifier » (ex. FK vers auth.users
    # ou une table cross-repo) : le récolteur ne peut pas résoudre leur cible, donc leur
    # absence ne peut pas prouver un défaut de doc (F1). Elles restent listées en informatif.
    missing_elems = sorted(set(h_el) - set(c_el))
    missing_edges = sorted((h_edges - c_edges) - h_soft)
    soft_missing = sorted((h_edges - c_edges) & h_soft)

    # Kind divergent sur ids communs, hors racines
    kind_mismatch = []
    for eid in sorted(set(c_el) & set(h_el)):
        if eid in c_roots or eid in h_roots:
            continue
        ck, hk = c_el[eid].get("kind"), h_el[eid].get("kind")
        if ck and hk and ck != hk:
            kind_mismatch.append((eid, ck, hk))

    # Informatif : committé (doc) absent du récolté (code/récolteur)
    extra_elems = sorted(set(c_el) - set(h_el))
    extra_edges = sorted(c_edges - h_edges)

    return {
        "missing_elems": [(e, h_el[e].get("kind", "?")) for e in missing_elems],
        "missing_edges": missing_edges,
        "kind_mismatch": kind_mismatch,
        "extra_elems": [(e, c_el[e].get("kind", "?")) for e in extra_elems],
        "extra_edges": extra_edges,
        "soft_missing": soft_missing,
    }


def blocking_count(d):
    return len(d["missing_elems"]) + len(d["missing_edges"]) + len(d["kind_mismatch"])


def _fmt_edge(edge):
    kind, frm, to = edge
    arrow = "→" if kind == "rel" else "⇒"  # rel interne vs depends_on
    return f"`{frm}` {arrow} `{to}`"


def render_report(d, mode):
    blocking = blocking_count(d)
    info = len(d["extra_elems"]) + len(d["extra_edges"]) + len(d["soft_missing"])
    L = ["## 🧭 Modèle vivant — complétude du manifeste", ""]

    if blocking == 0:
        L.append("✅ **Aucun drift bloquant.** Le manifeste couvre tout ce que les "
                 "récolteurs ont trouvé dans le code.")
    else:
        verb = "**bloque le merge**" if mode == "strict" else "à corriger (mode `warn` : non bloquant)"
        L.append(f"❌ **{blocking} drift(s)** — le code contient des éléments absents du "
                 f"`architecture.yaml`. {verb}.")
        L.append("")
        if d["missing_elems"]:
            L.append("### Éléments dans le code, absents de la doc")
            for eid, kind in d["missing_elems"]:
                L.append(f"- `{eid}` (`{kind}`)")
            L.append("")
        if d["missing_edges"]:
            L.append("### Relations/dépendances dans le code, absentes de la doc")
            for edge in d["missing_edges"]:
                L.append(f"- {_fmt_edge(edge)}")
            L.append("")
        if d["kind_mismatch"]:
            L.append("### `kind` divergent (doc ≠ code)")
            for eid, ck, hk in d["kind_mismatch"]:
                L.append(f"- `{eid}` : doc dit `{ck}`, code dit `{hk}`")
            L.append("")
        L.append("**Corriger** : mettre à jour `architecture.yaml` **dans cette PR** "
                 "(règle d'or n°9), puis relancer la CI.")
        L.append("")

    if info:
        L.append("<details><summary>ℹ️ Présent dans la doc, non retrouvé par les récolteurs "
                 f"({info}) — informatif, non bloquant</summary>")
        L.append("")
        L.append("Ajouts manuels légitimes (cross-repo, écran, mcp_tool, topologie), grains "
                 "non couverts par un récolteur, ou éléments supprimés du code. À revoir à l'œil.")
        L.append("")
        for eid, kind in d["extra_elems"]:
            L.append(f"- `{eid}` (`{kind}`)")
        for edge in d["extra_edges"]:
            L.append(f"- {_fmt_edge(edge)}")
        for edge in d["soft_missing"]:
            L.append(f"- {_fmt_edge(edge)} — FK récoltée **à qualifier** "
                     "(cible non résoluble : `auth.users`, cross-repo… — non bloquant)")
        L.append("")
        L.append("</details>")
        L.append("")

    L.append(f"<sub>Mode `{mode}` · comparaison structurelle · "
             "STD-031 §2.7 modèle vivant.</sub>")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("committed", help="architecture.yaml versionné")
    ap.add_argument("harvested", help="Manifeste récolté (merge-manifests)")
    ap.add_argument("--mode", default="warn", choices=["warn", "strict"])
    ap.add_argument("--report", default=None, help="Écrit le rapport Markdown dans ce fichier")
    args = ap.parse_args()

    try:
        committed = load(args.committed)
        harvested = load(args.harvested)
    except (ValueError, OSError) as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(2)

    d = compute(committed, harvested)
    report = render_report(d, args.mode)

    if args.report:
        with open(args.report, "w") as f:
            f.write(report)
    sys.stdout.write(report)

    blocking = blocking_count(d)
    if blocking and args.mode == "strict":
        print(f"\n❌ {blocking} drift(s) bloquant(s) — mode strict.", file=sys.stderr)
        sys.exit(1)
    print(f"\n{'⚠️' if blocking else '✅'} {blocking} drift(s) — mode {args.mode} "
          f"({'non bloquant' if args.mode == 'warn' else 'bloquant'}).", file=sys.stderr)


if __name__ == "__main__":
    main()

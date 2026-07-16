#!/usr/bin/env python3
"""Récolteur — schéma Supabase → grain `table` du manifeste architecture.yaml.

┌───────────────────────────────────────────────────────────────────────────┐
│ COPIE DISTRIBUÉE — source canonique : repo `architecture`, scripts/         │
│ harvest-supabase.py (STD-031 §2.7.7). Ne pas diverger : corriger l'original │
│ côté Architecture, puis re-synchroniser cette copie via le pack.            │
└───────────────────────────────────────────────────────────────────────────┘

Modèle vivant Somtech (STD-031 §2.7.7, I16/I17). Lit les migrations SQL d'un repo
(CREATE TABLE + clés étrangères) et émet un manifeste `architecture.yaml` RÉCOLTÉ :
les tables (kind=table) + les relations FK. Lecture seule sur les sources — aucun
write-back. La sortie porte une bannière « RÉCOLTÉ — ne pas éditer ».

⚠️ RÈGLE 7 : à exécuter DEPUIS le repo applicatif cible (là où vivent ses migrations),
pas depuis `architecture`. Cet outil est canonique là-bas, distribué ici par le pack.

Le schéma ne porte que le GRAIN data. La TOPOLOGIE (le service, ses dépendances) vient
du récolteur de config (fly.toml/.mcp.json/env) — ici on émet une racine `service`
minimale, à fusionner. Aucune règle métier n'est extraite (hors champ, I17).

Usage :
  python3 harvest-supabase.py <migrations_dir|fichier.sql ...> --app <slug> [options]
  options : --root-kind service|webapp (défaut service) · --root-name "<nom>"
            --out architecture.yaml (défaut: stdout)
"""
import argparse
import glob
import os
import re
import sys

# ── Parsing SQL (regex, tolérant) ────────────────────────────────────────────
_COMMENT_LINE = re.compile(r"--[^\n]*")
_COMMENT_BLOCK = re.compile(r"/\*.*?\*/", re.DOTALL)
_CREATE_TABLE = re.compile(
    r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\"`]?[\w.]+[\"`]?)\s*\(",
    re.IGNORECASE,
)
_REFERENCES = re.compile(r"REFERENCES\s+([\"`]?[\w.]+[\"`]?)\s*(?:\([^)]*\))?", re.IGNORECASE)
_ALTER_FK = re.compile(
    r"ALTER\s+TABLE\s+(?:ONLY\s+)?([\"`]?[\w.]+[\"`]?).*?REFERENCES\s+([\"`]?[\w.]+[\"`]?)",
    re.IGNORECASE | re.DOTALL,
)


def strip_comments(sql):
    return _COMMENT_LINE.sub("", _COMMENT_BLOCK.sub("", sql))


def bare(name):
    """public.\"Foo\" → foo (sans schéma ni guillemets, minuscule)."""
    n = name.strip().strip('"`')
    if "." in n:
        n = n.split(".")[-1].strip('"`')
    return n.lower()


def extract_body(sql, open_paren_pos):
    """Corps équilibré à partir de la parenthèse ouvrante."""
    depth, i = 0, open_paren_pos
    while i < len(sql):
        if sql[i] == "(":
            depth += 1
        elif sql[i] == ")":
            depth -= 1
            if depth == 0:
                return sql[open_paren_pos + 1:i]
        i += 1
    return sql[open_paren_pos + 1:]


def harvest(sql_text):
    """Retourne (tables:set, fks:set[(from,to)])."""
    sql = strip_comments(sql_text)
    tables, fks = set(), set()
    for m in _CREATE_TABLE.finditer(sql):
        tname = bare(m.group(1))
        tables.add(tname)
        body = extract_body(sql, m.end() - 1)
        for r in _REFERENCES.finditer(body):
            target = bare(r.group(1))
            if target != tname:
                fks.add((tname, target))
    for m in _ALTER_FK.finditer(sql):
        src, target = bare(m.group(1)), bare(m.group(2))
        if src != target:
            fks.add((src, target))
    return tables, fks


def collect_sql(paths):
    files = []
    for p in paths:
        if os.path.isdir(p):
            files += sorted(glob.glob(os.path.join(p, "**", "*.sql"), recursive=True))
        else:
            files.append(p)
    return files


def emit_yaml(app, root_kind, root_name, tables, fks):
    L = [
        "# RÉCOLTÉ — ne pas éditer (source : migrations Supabase). STD-031 §2.7.7 / I16-I17.",
        "# Régénéré par scripts/archi-ci/harvest-supabase.py. Modifier le SCHÉMA, pas ce fichier.",
        "# La racine ci-dessous est un placeholder de TOPOLOGIE à fusionner avec le récolteur de config.",
        f"app: {app}",
        "elements:",
        f"  - id: {app}",
        f"    kind: {root_kind}",
        f"    name: {root_name}",
        "    audience: internal",
    ]
    for t in sorted(tables):
        L += [
            f"  - id: {app}.{t}",
            "    kind: table",
            f"    name: {t}",
            f"    parent: {app}",
            "    audience: internal",
        ]
    rel = [(s, t) for (s, t) in sorted(fks) if s in tables and t in tables]
    if rel:
        L.append("relations:")
        for s, t in rel:
            L += [f"  - from: {app}.{s}", f"    to: {app}.{t}", "    label: FK"]
    # FK vers une table hors de ce repo → dépendance sortante (cross-repo)
    ext = [(s, t) for (s, t) in sorted(fks) if s in tables and t not in tables]
    if ext:
        L.append("depends_on:")
        for s, t in ext:
            L += [f"  - from: {app}.{s}", f"    to: {t}", "    label: FK cross-repo (à qualifier)"]
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("sources", nargs="+", help="Dossier de migrations ou fichiers .sql")
    ap.add_argument("--app", required=True, help="Slug ServiceDesk (racine de namespace)")
    ap.add_argument("--root-kind", default="service", choices=["service", "webapp", "system"])
    ap.add_argument("--root-name", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    files = collect_sql(args.sources)
    if not files:
        print("❌ Aucun fichier .sql trouvé.", file=sys.stderr)
        sys.exit(1)

    tables, fks = set(), set()
    for f in files:
        with open(f) as fh:
            t, k = harvest(fh.read())
            tables |= t
            fks |= k

    if not tables:
        print("⚠️  Aucune table détectée (CREATE TABLE).", file=sys.stderr)

    yaml_out = emit_yaml(args.app, args.root_kind, args.root_name or args.app, tables, fks)
    if args.out:
        with open(args.out, "w") as f:
            f.write(yaml_out)
        print(f"✅ Récolté {len(tables)} table(s) + {len(fks)} FK depuis {len(files)} fichier(s) "
              f"→ {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(yaml_out)


if __name__ == "__main__":
    main()

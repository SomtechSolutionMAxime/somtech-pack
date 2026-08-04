#!/usr/bin/env python3
"""Récolteur — schéma Supabase → grain `table` du manifeste architecture.yaml.

┌───────────────────────────────────────────────────────────────────────────┐
│ COPIE DISTRIBUÉE — source canonique : repo `architecture`, scripts/         │
│ harvest-supabase.py (STD-031 §2.7.7). Ne pas diverger : corriger l'original │
│ côté Architecture, puis re-synchroniser cette copie via le pack.            │
└───────────────────────────────────────────────────────────────────────────┘

Modèle vivant Somtech (STD-031 §2.7.7, I16/I17/I19). Lit le SQL d'un repo et émet un
manifeste `architecture.yaml` RÉCOLTÉ : les tables (kind=table), leurs descriptions et
leurs relations FK. Lecture seule sur les sources — aucun write-back. La sortie porte une
bannière « RÉCOLTÉ — ne pas éditer ».

⚠️ RÈGLE 7 : à exécuter DEPUIS le repo applicatif cible (là où vivent ses migrations),
pas depuis `architecture`. Cet outil est canonique là-bas, distribué ici par le pack.

Le schéma ne porte que le GRAIN data. La TOPOLOGIE (le service, ses dépendances) vient
du récolteur de config (fly.toml/.mcp.json/env) — ici on émet une racine `service`
minimale, à fusionner. Aucune règle métier n'est extraite (hors champ, I17).

CE QUI EST LU, ET CE QUI NE L'EST PAS (discipline I19 — on sous-récolte, on n'invente pas)

Le SQL est d'abord découpé en instructions par `sqlscan` (conscient des littéraux, des
identifiants quotés et du dollar-quoting), puis chaque instruction n'est reconnue que si
elle COMMENCE par le motif attendu. Une instruction ne peut donc jamais déborder sur la
suivante, et un `CREATE TABLE` cité à l'intérieur d'un corps de fonction ou d'un `DO $$ … $$`
n'est PAS récolté : il est SIGNALÉ sur stderr comme grain non vérifié. On préfère une table
manquante — visible dans le rapport de drift — à une table inventée (I17).

Usage :
  python3 harvest-supabase.py <migrations_dir|fichier.sql ...> --app <slug> [options]
  python3 harvest-supabase.py --discover <racine_repo> --app <slug>   (emplacements nommés)
  options : --root-kind service|webapp (défaut service) · --root-name "<nom>"
            --out architecture.yaml (défaut: stdout)
"""
import argparse
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sqlscan import QNAME, fqn, parse_qname, split_statements  # noqa: E402
from yamlemit import yaml_str as _yaml_str  # noqa: E402

# ── Motifs, tous ancrés en DÉBUT d'instruction (`\A`) ────────────────────────
# L'ancrage est le cœur du correctif D-20260731-0001 : couplé au découpage en
# instructions, il rend structurellement impossible qu'un motif s'apparie avec le
# contenu de l'instruction suivante. Aucune borne à régler, donc rien qui se dégrade
# quand le dépôt grossit (invariant d'échelle, STD-031 §2.7.9).
_CREATE_TABLE = re.compile(
    r"\ACREATE\s+(?:(?P<temp>TEMP|TEMPORARY|UNLOGGED|GLOBAL|LOCAL)\s+)*TABLE\s+"
    r"(?:IF\s+NOT\s+EXISTS\s+)?(?P<name>" + QNAME + r")",
    re.IGNORECASE,
)
_DROP_TABLE = re.compile(
    r"\ADROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?P<names>" + QNAME + r"(?:\s*,\s*" + QNAME + r")*)",
    re.IGNORECASE,
)
_ALTER_TABLE = re.compile(
    r"\AALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?P<name>" + QNAME + r")",
    re.IGNORECASE,
)
_RENAME_TO = re.compile(r"\bRENAME\s+TO\s+(?P<name>" + QNAME + r")", re.IGNORECASE)
_SET_SCHEMA = re.compile(r"\bSET\s+SCHEMA\s+(?P<name>" + QNAME + r")", re.IGNORECASE)
_REFERENCES = re.compile(r"\bREFERENCES\s+(?P<name>" + QNAME + r")", re.IGNORECASE)
_COMMENT_ON_TABLE = re.compile(
    r"\ACOMMENT\s+ON\s+TABLE\s+(?P<name>" + QNAME + r")\s+IS\s+(?P<body>'(?:[^']|'')*'|NULL)",
    re.IGNORECASE | re.DOTALL,
)
# Un `CREATE TABLE` qui n'est PAS en tête d'instruction vit forcément dans un littéral ou
# un corps `$$` : on ne le récolte pas, on le compte pour le signaler (grain non vérifié).
_EMBEDDED_CREATE = re.compile(r"(?<!\A)CREATE\s+TABLE\s", re.IGNORECASE)
# `DO $$ … $$` : bloc anonyme EXÉCUTÉ au moment de la migration. Son corps fait donc partie
# du schéma déployé au même titre qu'une instruction de premier niveau, et le motif
# `DO $$ BEGIN IF NOT EXISTS … CREATE TABLE … END $$` est courant. On y descend.
# Un corps de `CREATE FUNCTION`, lui, ne s'exécute QUE si la fonction est appelée : une
# table qui y est écrite n'existe pas du fait de la migration. On n'y descend pas.
_DO_BLOCK = re.compile(r"\ADO\s+(?:LANGUAGE\s+\w+\s+)?(\$(?:\w+)?\$)(?P<body>.*?)\1",
                       re.IGNORECASE | re.DOTALL)
# Dans un corps PL/pgSQL, l'instruction utile est précédée de mots-clés de structure :
# `BEGIN`, `IF … THEN`, `ELSE`, `LOOP`. On les épluche pour retrouver l'ancrage — sans quoi
# la migration défensive `IF NOT EXISTS (…) THEN CREATE TABLE …` resterait invisible.
# Or c'est un motif de projet DISCIPLINÉ : ne pas le lire ferait exactement ce que
# STD-031 §2.7.9 interdit — dégrader la récolte à mesure que le projet devient rigoureux.
_PLPGSQL_PREAMBLE = re.compile(
    r"\A(?:BEGIN|DECLARE|ELSE|LOOP|THEN"
    r"|(?:ELS)?IF\b.*?\bTHEN"
    r"|(?:WHILE|FOR)\b.*?\bLOOP)\s+",
    re.IGNORECASE | re.DOTALL,
)


def extract_body(stmt):
    """Corps parenthésé équilibré d'un CREATE TABLE, ou '' s'il n'y en a pas (AS SELECT)."""
    start = stmt.find("(")
    if start < 0:
        return ""
    depth, i = 0, start
    while i < len(stmt):
        if stmt[i] == "(":
            depth += 1
        elif stmt[i] == ")":
            depth -= 1
            if depth == 0:
                return stmt[start + 1:i]
        i += 1
    return stmt[start + 1:]


def _unquote_literal(lit):
    if lit.upper() == "NULL":
        return None
    return lit[1:-1].replace("''", "'").strip() or None


class Schema:
    """État du schéma reconstruit en rejouant les instructions dans l'ordre.

    Rejouer plutôt qu'accumuler : une table créée puis supprimée ne doit pas survivre dans
    le manifeste, et une table renommée doit y figurer sous son nom final. Un récolteur qui
    se contente d'unir tous les `CREATE TABLE` du dépôt documente l'histoire du schéma, pas
    le schéma (I16 : le manifeste est une photo de l'état, pas un journal).
    """

    def __init__(self):
        self.tables = {}        # (schema, table) → {"description": str|None}
        self.fks = set()        # ((s_sch, s_tbl), (t_sch, t_tbl))
        self.embedded = 0       # CREATE TABLE vus dans un littéral / corps $$ (non récoltés)

    def _drop(self, key):
        self.tables.pop(key, None)
        self.fks = {(s, t) for (s, t) in self.fks if s != key}

    def _rename(self, old, new):
        if old not in self.tables:
            return
        self.tables[new] = self.tables.pop(old)
        self.fks = {((new if s == old else s), (new if t == old else t)) for (s, t) in self.fks}

    def apply(self, stmt, _depth=0):
        m = _DO_BLOCK.match(stmt)
        if m:
            if _depth < 4:  # garde-fou : un DO qui contient un DO reste borné
                for inner in split_statements(m.group("body")):
                    self.apply(inner, _depth + 1)
            return

        if _depth:
            while True:
                peeled = _PLPGSQL_PREAMBLE.sub("", stmt, count=1)
                if peeled == stmt:
                    break
                stmt = peeled

        m = _CREATE_TABLE.match(stmt)
        if m:
            if m.group("temp") and m.group("temp").upper() in ("TEMP", "TEMPORARY"):
                return  # table de session : n'existe pas dans le schéma déployé
            key = parse_qname(m.group("name"))
            self.tables.setdefault(key, {"description": None})
            for r in _REFERENCES.finditer(extract_body(stmt)):
                target = parse_qname(r.group("name"))
                if target != key:
                    self.fks.add((key, target))
            return

        m = _DROP_TABLE.match(stmt)
        if m:
            for raw in re.split(r",", m.group("names")):
                key = parse_qname(raw)
                if key:
                    self._drop(key)
            return

        m = _ALTER_TABLE.match(stmt)
        if m:
            key = parse_qname(m.group("name"))
            rn = _RENAME_TO.search(stmt)
            if rn and not re.search(r"\bRENAME\s+(?:COLUMN|CONSTRAINT)\b", stmt, re.IGNORECASE):
                self._rename(key, (key[0], parse_qname(rn.group("name"))[1]))
                return
            ss = _SET_SCHEMA.search(stmt)
            if ss:
                self._rename(key, (parse_qname(ss.group("name"))[1], key[1]))
                return
            # L'instruction est bornée par le découpage : le `REFERENCES` trouvé ici lui
            # appartient, il ne peut pas venir de centaines de lignes plus loin.
            for r in _REFERENCES.finditer(stmt):
                target = parse_qname(r.group("name"))
                if target != key:
                    self.fks.add((key, target))
            return

        m = _COMMENT_ON_TABLE.match(stmt)
        if m:
            key = parse_qname(m.group("name"))
            if key in self.tables:
                self.tables[key]["description"] = _unquote_literal(m.group("body"))
            return

        if _EMBEDDED_CREATE.search(stmt):
            self.embedded += 1


# ── Découverte des sources ───────────────────────────────────────────────────
# Emplacements NOMMÉS, pas un balayage aveugle du dépôt. Un balayage ramasserait les jeux
# de données de test et les brouillons, et ferait entrer dans le modèle des tables qui
# n'existent nulle part. Cette liste vient des dépôts réels du corpus : le schéma d'une app
# Somtech ne vit pas toujours dans `supabase/migrations` — Morasse tient le sien dans un
# `supabase/_baseline_prod_public.sql` doublé d'un second dossier `scripts/migrations`.
DISCOVER_GLOBS = [
    "supabase/migrations/**/*.sql",
    "supabase/schemas/**/*.sql",
    "supabase/*.sql",           # dumps de référence (_baseline_prod_public.sql, …)
    "scripts/migrations/**/*.sql",
    "db/migrations/**/*.sql",
    "migrations/**/*.sql",
]
# Exclusions : contenu qui n'est pas le schéma déployé.
DISCOVER_EXCLUDE = re.compile(
    r"(^|/)(node_modules|\.git|tmp|temp|fixtures?|__tests__|test|tests)(/|$)"
    r"|(^|/)(seed|seeds)[^/]*\.sql$"
    r"|_(test|qa|sample|example)[^/]*\.sql$",
    re.IGNORECASE,
)


def discover(root):
    """Retourne (fichiers, emplacements_retenus) depuis les emplacements nommés."""
    files, used = [], []
    for pattern in DISCOVER_GLOBS:
        hits = sorted(
            f for f in glob.glob(os.path.join(root, pattern), recursive=True)
            if os.path.isfile(f) and not DISCOVER_EXCLUDE.search(os.path.relpath(f, root))
        )
        hits = [f for f in hits if f not in files]
        if hits:
            used.append((pattern, len(hits)))
            files += hits
    return files, used


def collect_sql(paths):
    files = []
    for p in paths:
        if os.path.isdir(p):
            files += sorted(glob.glob(os.path.join(p, "**", "*.sql"), recursive=True))
        else:
            files.append(p)
    return files


def harvest_files(files):
    schema = Schema()
    for f in files:
        try:
            text = open(f, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        for stmt in split_statements(text):
            schema.apply(stmt)
    return schema


# ── Émission ─────────────────────────────────────────────────────────────────
def emit_yaml(app, root_kind, root_name, schema):
    tables = schema.tables
    L = [
        "# RÉCOLTÉ — ne pas éditer (source : SQL du dépôt). STD-031 §2.7.7 / I16-I17.",
        "# Régénéré par scripts/archi-ci/harvest-supabase.py. Modifier le SCHÉMA, pas ce fichier.",
        "# La racine ci-dessous est un placeholder de TOPOLOGIE à fusionner avec le récolteur de config.",
        f"app: {app}",
        "elements:",
        f"  - id: {app}",
        f"    kind: {root_kind}",
        f"    name: {_yaml_str(root_name)}",
        "    audience: internal",
    ]

    def eid(key):
        schema_name, table = key
        return f"{app}.{table}" if schema_name == "public" else f"{app}.{schema_name}.{table}"

    def parent(key):
        return app if key[0] == "public" else f"{app}.{key[0]}"

    # Un schéma non-public devient un conteneur explicite. Sans lui, `maestro.entities` et
    # `public.entities` s'écraseraient sous le même id et le modèle affirmerait qu'une table
    # vit dans un schéma où elle n'est pas.
    for sch in sorted({s for (s, _) in tables if s != "public"}):
        L += [
            f"  - id: {app}.{sch}",
            "    kind: database",
            f"    name: {_yaml_str(sch)}",
            "    technology: schéma PostgreSQL",
            f"    parent: {app}",
            "    audience: internal",
        ]

    for key in sorted(tables):
        L += [
            f"  - id: {eid(key)}",
            "    kind: table",
            f"    name: {_yaml_str(fqn(key))}",
        ]
        desc = tables[key].get("description")
        if desc:
            L.append(f"    description: {_yaml_str(desc)}")
        L += [f"    parent: {parent(key)}", "    audience: internal"]

    rel = [(s, t) for (s, t) in sorted(schema.fks) if s in tables and t in tables]
    if rel:
        L.append("relations:")
        for s, t in rel:
            L += [f"  - from: {eid(s)}", f"    to: {eid(t)}", "    label: FK"]

    # FK vers une table hors de ce repo → dépendance sortante (cross-repo)
    ext = [(s, t) for (s, t) in sorted(schema.fks) if s in tables and t not in tables]
    if ext:
        L.append("depends_on:")
        for s, t in ext:
            L += [f"  - from: {eid(s)}", f"    to: {fqn(t)}",
                  "    label: FK cross-repo (à qualifier)"]
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("sources", nargs="*", help="Dossier de migrations ou fichiers .sql")
    ap.add_argument("--discover", metavar="RACINE",
                    help="Découvrir le SQL du dépôt depuis les emplacements nommés")
    ap.add_argument("--app", required=True, help="Slug ServiceDesk (racine de namespace)")
    ap.add_argument("--root-kind", default="service", choices=["service", "webapp", "system"])
    ap.add_argument("--root-name", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    if args.discover:
        files, used = discover(args.discover)
        for pattern, count in used:
            print(f"   · {pattern} → {count} fichier(s)", file=sys.stderr)
        files += collect_sql(args.sources)
    else:
        if not args.sources:
            ap.error("fournir des sources, ou --discover <racine_repo>")
        files = collect_sql(args.sources)

    if not files:
        print("❌ Aucun fichier .sql trouvé.", file=sys.stderr)
        sys.exit(1)

    schema = harvest_files(files)

    if not schema.tables:
        print("⚠️  Aucune table détectée (CREATE TABLE). Grain `table` non vérifié — "
              "ni conforme, ni en drift.", file=sys.stderr)
    if schema.embedded:
        print(f"⚠️  {schema.embedded} instruction(s) contiennent un CREATE TABLE dans un "
              f"littéral ou un corps $$ (DO block, EXECUTE). NON récolté — à déclarer à la "
              f"main si ces tables existent vraiment.", file=sys.stderr)

    described = sum(1 for v in schema.tables.values() if v.get("description"))
    yaml_out = emit_yaml(args.app, args.root_kind, args.root_name or args.app, schema)
    if args.out:
        with open(args.out, "w") as f:
            f.write(yaml_out)
        print(f"✅ Récolté {len(schema.tables)} table(s) ({described} décrite(s) via "
              f"COMMENT ON TABLE) + {len(schema.fks)} FK depuis {len(files)} fichier(s) "
              f"→ {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(yaml_out)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Balayage SQL PostgreSQL — découpage en instructions et lecture des identifiants.

Modèle vivant Somtech (STD-031 §2.7.7). Socle commun des récolteurs SQL : il n'extrait
aucun grain lui-même, il donne aux récolteurs une lecture du texte SQL qui ne se laisse
pas tromper par les littéraux.

POURQUOI CE MODULE EXISTE — le fond du défaut D-20260731-0001.

Le récolteur bornait ses appariements avec une classe de caractères (`[^;]*?`). Un `;`
est alors une borne, où qu'il soit — y compris à l'intérieur d'un littéral. Et la mise
en commentaire retirait tout ce qui suivait `--` sur la ligne, y compris quand ces deux
tirets vivaient dans une chaîne. Sur du SQL Supabase réel, les deux se produisent : les
corps de fonctions sont écrits en `$$ … $$` et contiennent `;` et `--` à volonté.

Une classe de caractères ne distinguera jamais un `;` de code d'un `;` de texte : il faut
savoir, à chaque caractère, si on se trouve dans du code, une chaîne, un identifiant quoté,
un corps `$tag$`, ou un commentaire. C'est ce que fait ce module, une fois, pour tout le
monde — au lieu de laisser chaque expression régulière re-tenter le pari.

Reconnu : `--` en fin de ligne · `/* */` **imbriqués** (spécificité PostgreSQL) ·
`'…'` avec `''` doublé · `E'…'` avec échappement backslash · `"…"` identifiant quoté avec
`""` doublé · `$…$ … $…$` dollar-quoting étiqueté.
"""
import re

# Identifiant SQL : quoté ("Foo Bar") ou nu (foo_bar). Un nom qualifié en enchaîne
# plusieurs, séparés par des points — chaque segment pouvant être quoté SÉPARÉMENT.
# C'est la forme que produit `pg_dump` : "public"."archive_matrices". Une expression qui
# cherche `[\w.]+` avec des guillemets seulement aux extrémités ne la voit pas du tout.
# La plage accentuee est bornee explicitement (latin etendu). Ecrite comme une plage
# ouverte partant de `_`, elle engloberait `{`, `|`, `}` et `~` : un identifiant pourrait
# alors avaler de la ponctuation et deborder sur ce qui le suit.
_IDENT = r'(?:"(?:[^"]|"")+"|[A-Za-z_\u00c0-\u024f][\w$\u00c0-\u024f]*)'
QNAME = _IDENT + r'(?:\s*\.\s*' + _IDENT + r')*'
_IDENT_RE = re.compile(_IDENT)


def split_statements(sql):
    """Découpe le SQL en instructions, en ignorant les `;` qui ne sont pas du code.

    Retourne une liste de chaînes : le texte de chaque instruction, commentaires retirés,
    littéraux et corps `$tag$` PRÉSERVÉS (un récolteur peut avoir besoin de leur contenu —
    `COMMENT ON TABLE … IS '…'` par exemple).
    """
    out, buf = [], []
    i, n = 0, len(sql)
    while i < n:
        c = sql[i]

        # -- commentaire de ligne
        if c == "-" and sql.startswith("--", i):
            j = sql.find("\n", i)
            i = n if j < 0 else j + 1
            buf.append("\n")
            continue

        # /* commentaire de bloc, imbricable */
        if c == "/" and sql.startswith("/*", i):
            depth, i = 1, i + 2
            while i < n and depth:
                if sql.startswith("/*", i):
                    depth, i = depth + 1, i + 2
                elif sql.startswith("*/", i):
                    depth, i = depth - 1, i + 2
                else:
                    i += 1
            buf.append(" ")
            continue

        # $tag$ … $tag$
        if c == "$":
            m = re.compile(r"\$([A-Za-z_]\w*)?\$").match(sql, i)
            if m:
                tag = m.group(0)
                end = sql.find(tag, m.end())
                end = n if end < 0 else end + len(tag)
                buf.append(sql[i:end])
                i = end
                continue

        # '…' (littéral) — `''` est un guillemet doublé, pas une fin de chaîne.
        if c == "'":
            # La contre-barre n'échappe QUE dans un littéral préfixé `E`. Ailleurs elle est
            # un caractère ordinaire : PostgreSQL tourne avec `standard_conforming_strings`
            # depuis la 9.1, et les dumps du parc le posent explicitement. Traiter `\` comme
            # un échappement partout fait lire `'\'` — un littéral pourtant complet — comme
            # une chaîne encore ouverte : le balayeur avale alors le `;` et l'instruction
            # suivante, et rouvre exactement la brèche D-20260731-0001 (un ALTER TABLE
            # apparié au REFERENCES d'une AUTRE instruction). Idiome courant du parc :
            # `CHECK (slug NOT LIKE '%\_%' ESCAPE '\')`.
            escaping = i > 0 and sql[i - 1] in "Ee" and (i < 2 or not sql[i - 2].isalnum())
            j = i + 1
            while j < n:
                if sql[j] == "'":
                    if j + 1 < n and sql[j + 1] == "'":
                        j += 2
                        continue
                    j += 1
                    break
                if escaping and sql[j] == "\\" and j + 1 < n:
                    j += 2
                    continue
                j += 1
            buf.append(sql[i:j])
            i = j
            continue

        # "…" (identifiant quoté) — `""` est un guillemet doublé.
        if c == '"':
            j = i + 1
            while j < n:
                if sql[j] == '"':
                    if j + 1 < n and sql[j + 1] == '"':
                        j += 2
                        continue
                    j += 1
                    break
                j += 1
            buf.append(sql[i:j])
            i = j
            continue

        # ; hors de tout ce qui précède = vraie fin d'instruction.
        if c == ";":
            stmt = "".join(buf).strip()
            if stmt:
                out.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(c)
        i += 1

    # Un fichier sans `;` terminal garde quand même sa dernière instruction : elle est
    # bornée par la fin du fichier, jamais par le contenu du fichier suivant.
    stmt = "".join(buf).strip()
    if stmt:
        out.append(stmt)
    return out


def unquote_ident(seg):
    """`"Foo""Bar"` → `Foo"Bar` ; `Foo` → `foo` (repli PostgreSQL sur la minuscule)."""
    seg = seg.strip()
    if seg.startswith('"') and seg.endswith('"') and len(seg) >= 2:
        return seg[1:-1].replace('""', '"')
    return seg.lower()


def parse_qname(raw, default_schema="public"):
    """`"public"."x"` → ('public', 'x') · `x` → ('public', 'x') · `a.b.c` → ('b', 'c').

    Un nom à trois segments est `base.schéma.table` : on garde les deux derniers, la base
    n'ayant pas de sens dans un manifeste par repo.
    """
    segs = [unquote_ident(m.group(0)) for m in _IDENT_RE.finditer(raw or "")]
    if not segs:
        return None
    if len(segs) == 1:
        return (default_schema, segs[0])
    return (segs[-2], segs[-1])


def fqn(schema_table):
    """(schema, table) → `table` si schéma public, sinon `schema.table`."""
    schema, table = schema_table
    return table if schema == "public" else f"{schema}.{table}"

# Spec — Parser BRD déterministe (port Python→TS) + projections

> Référence de logique (LECTURE SEULE, règle d'or n°7) : `Architecture/scripts/extract-brd-yaml.py` (588 l.),
> `validate-brd.py`, fixtures `Architecture/scripts/test-brd/`. Cible : gabarit Somcraft **v2.1.0**.
> Parité = **re-parse round-trip** (PAS byte-à-byte : PyYAML ≠ sérialiseur JS). Cadre : STD-033 §2.12.
> Contrat block_id validé au spike : voir `docs/superpowers/specs/2026-07-10-brd-spike-contrat-block-id-REF.md`.

## Structure du BRD.md (v2.1.0) — sections reconnues

Le parser ne lit QUE 4 familles de sections (regex sur headings) ; tout le reste du MD est **ignoré**.

| Section | Regex heading (JS, `^` sans `$` sauf indiqué) | Amorce |
|---|---|---|
| §4 EA (global) | `^##\s+4\.\s*Exigences d'affaires` | tableau EA |
| §5.X Domaine | `^###\s+5\.\d+\s+Domaine\s+—.*\(code:\s*([A-Z]{3})\)` | pose `currentDomain5` = groupe 1 |
| EF | `^####\s+Exigences fonctionnelles\s*$` | tableau EF du domaine courant |
| RA | `^####\s+Règles d'affaires\s*$` | tableau RA du domaine courant |
| §6.X Domaine | `^###\s+6\.\d+\s+Domaine\s+—.*\(code:\s*([A-Z]{3})\)` | tableau HS (code = groupe 1) |
| §7 Changelog (global) | `^##\s+7\.\s*Changelog` | tableau Changelog |

- EA + Changelog **globaux** (pas de domaine) ; EF/RA/HS **scopés à un domaine** (code 3 lettres du heading).
- §4 et §7 **obligatoires** (absence → erreur). §4/§7 en double → erreur. EF/RA/HS multi-domaines → `extend`.
- Marqueurs Somcraft `<!-- bid:xxx -->` : lignes à **tracker** (dernier bid vu = block_id du prochain tableau) mais
  **ignorées** pour la structure. Absents (fixtures Python) → `md_block_id = null`.

## Schémas de tableaux — en-têtes EXACTS (ordre opposable, comparaison stricte)

| Type | Colonnes (ordre) | n |
|---|---|---|
| EA | `ID` `Énoncé` `Statut` `Priorité` `Owner` | 5 |
| EF | `ID` `Description` `Statut` `Priorité` `Couvre` `Réalisé par` `Testé par` `Owner` | 8 |
| RA | `ID` `Énoncé` `Justification` `Statut` `Encadre` `Testé par` `Owner` | 7 |
| HS | `ID` `Énoncé` `Justification` `Statut` `Re-considéré quand` | 5 |
| Changelog | `Version` `Date` `Demande / Projet` `Sponsor validant` `Mode` `Résumé du changement` | 6 |

## Mapping colonne → clé YAML

`ID→id`, `Énoncé→enonce`, `Description→description`, `Justification→justification`, `Statut→statut`,
`Priorité→priorite`, `Couvre→couvre`, `Encadre→encadre`, `Réalisé par→realise_par`, `Testé par→teste_par`,
`Owner→owner`, `Re-considéré quand→reconsidere_quand`, `Demande / Projet→demande_projet`,
`Sponsor validant→sponsor_validant`, `Mode→mode`, `Résumé du changement→resume`, `Version→version`, `Date→date`.

Colonnes-listes (`Couvre`, `Encadre`, `Réalisé par`, `Testé par`) → `string[]`. Autres → texte libre tel quel.
Pour EF/RA/HS : la clé `domaine` est ajoutée **en dernier** à chaque row.

## Enums & regex

- `ID_REGEX = ^(EA|EF|RA|HS)-[A-Z]{3}-\d{3}$` (padding 3 chiffres obligatoire)
- `TICKET_REGEX = ^T-\d{8}-\d{4}$` (colonne `Réalisé par`)
- `SEMVER_REGEX = ^\d+\.\d+\.\d+$` (colonne `Version`)
- `STATUS = {draft, proposed, accepted, in_force, superseded, deprecated}`
- `PRIORITY = {M, S, C, W}`
- `MODE = {auto, manuel}` **ou vide** (Changelog)
- Cohérence domaine↔ID : `id.split("-")[1]` doit == code du heading (sinon erreur).

## Algorithme (fail-fast, erreurs 1-based)

1. `lines = text.split(/\r\n|\r|\n/)` (⚠️ pas `split("\n")` — gérer `\r`).
2. Sortie : `{ requirements: { ea:[], ef:[], ra:[] }, out_of_scope:[], changelog:[] }`.
3. État : `currentDomain5`, `seenSections` (anti-doublon §4/§7), `currentBlockId` (dernier `<!-- bid:xxx -->` vu).
4. Itère les lignes ; teste les regex de section dans l'ordre EA → §5 → EF → RA → §6 → Changelog. À un match :
   trouver le tableau (`findTableHeader` : 1re ligne `|…` dont 1re cellule == `ID`/`Version`, s'arrête à tout
   nouveau heading `^#{1,6}\s+` → sinon erreur), le parser, taguer chaque row avec `md_block_id = currentBlockId`,
   sauter `i` à la fin du tableau. Une ligne `<!-- bid:xxx -->` met à jour `currentBlockId`.
5. Post-boucle : §4 et §7 présents sinon erreur.

### `splitRow(line)` — gestion des pipes (CRITIQUE)
1. `safe = line.replaceAll("\\|", SENTINEL)` où `SENTINEL = "\x00BRD_ESCAPED_PIPE\x00"` (⚠️ replaceAll / `/\\\|/g`).
2. `parts = safe.split("|")`.
3. Drop `parts[0]` si vide après trim (bord gauche) ; drop `parts[-1]` si vide (bord droit).
4. Chaque cellule : `.trim()` puis `.replaceAll(SENTINEL, "|")`.

### `parseTable` 
- En-tête `splitRow(header)` **=== expected** (comparaison élément par élément, pas `===` d'array).
- Ligne suivante = séparateur `^\|(\s*:?-+:?\s*\|)+\s*$` + bon nombre de cellules.
- Données tant que la ligne est une ligne de tableau ; `len(cells) === n` sinon erreur ; `parseCell` par colonne.

### `parseCell(col, val, lineNo)`
- `ID`→ID_REGEX ; `Statut`→STATUS ; `Priorité`→PRIORITY ; `Mode`→MODE|vide ; `Version`→SEMVER ;
  colonne-liste→`parseListCell` ; sinon texte libre tel quel.

### `parseListCell(col, val, lineNo)`
- Vide après trim → `[]`.
- Trailing comma (`endsWith(",")`) → erreur.
- Si contient `,` : doit matcher `^[^,]+(, [^,]+)+$` (séparateur strict `, `) sinon erreur.
- Split `,`, trim, rejet item vide. Puis validation : `Réalisé par`→TICKET_REGEX ; `Couvre`/`Encadre`→ID_REGEX ;
  `Testé par`→non-vide (pas de regex format).

## Projections (project.js)

Un seul parse → deux projections :
- **`full`** : structure complète (= équivalent sémantique du YAML Python) + `md_block_id` par exigence.
- **`index`** : par exigence, UNIQUEMENT `{ id, titre, statut, domaine, priorite, couvre|encadre, md_block_id }`.
  `titre` = énoncé/description (troncature raisonnable, ex. 80 car. ; documenter le choix). Aucun corps lourd
  (justification, realise_par, teste_par, owner). Cible taille : ≥ 1 ordre de grandeur < MD source.

## Parité (tests, node --test)

- Goldens = sortie du parser Python capturée en `cli/test/fixtures/brd/golden/<fixture>.yaml`.
- Comparaison : re-parse le golden YAML (js-yaml) → objet ; comparer au `full` du parser TS **en ignorant
  `md_block_id`** (Python ne l'a pas). `assert.deepStrictEqual`.
- **Test mutation obligatoire** : une divergence sémantique volontaire (ex. inverser couvre/encadre, ou
  ne pas ajouter `domaine`) doit rendre au moins un test ROUGE — sinon le test ne teste rien.
- Cas invalides : les 9 `invalid-*` (erreur parser) doivent **throw** ; les 3 `invalid-cross-*` sont hors parser
  (relèvent du validateur, non porté ici) → ne pas exiger d'erreur parser dessus.

## Trous connus (à combler côté TS)
- Multi-domaines : aucune fixture Python ≥2 domaines → **ajouter une fixture 2 domaines** (vérifier accumulation + `domaine` par row).
- `Encadre` cassé : pas de fixture (seul `Couvre` cassé) — relève du validateur, pas du parser.
- Dépendance : lib YAML JS (js-yaml). Vérifier qu'elle est déjà dispo ou l'ajouter au package cli.

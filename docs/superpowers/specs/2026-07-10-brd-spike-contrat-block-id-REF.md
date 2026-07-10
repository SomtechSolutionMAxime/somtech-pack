# REF/ADR — SPIKE contrat block_id + emplacement parser (T-20260710-0138)

> **Gate GO/NO-GO** en tête de l'Epic A (E-20260710-0032). Statue les inconnues qui conditionnent
> les Epics B/C/D. Livrable d'investigation — **aucun artefact prod**. Cadre : STD-033 (amendement Epic 0).

## VERDICT : **GO** ✅

Le contrat lecture→écriture est validé empiriquement (BRD bac-à-sable Somcraft, workspace Somtech).
Les Epics A/B/C/D peuvent être engagés. Le plan de repli NO-GO (ci-dessous) reste documenté par précaution.

---

## 1. Contrat `block_id` — validé empiriquement

**Protocole** : BRD bac-à-sable créé (`/interne/sandbox/brd-spike-D-20260710-0009/BRD.md`, doc Somcraft
`79245740-36c6-4fa3-96de-ddab0417f5e5`), 4 types de tableaux (EA/EF/RA/HS), 2 domaines (CON/GOV), pipe échappé,
cellule vide, symétrie couvre/encadre. Séquence : `read_document(include_block_ids=true)` → `update_block` →
re-`read_document`.

| Question du spike | Résultat | Preuve |
|---|---|---|
| **1 tableau = 1 bloc adressable ?** | ✅ OUI | Chaque tableau MD ressort comme un bloc unique `kind:"table"` (grain domaine×type). |
| **L'id de `read_document` est-il accepté tel quel par `update_block` ?** | ✅ OUI, sans préfixe `bid:` | `update_block(block_id="ca6216dd-…")` a retourné succès (`bytes_written:2516`). |
| **Les ids sont-ils STABLES après une écriture `update_block` ?** | ✅ OUI | Après update, les 14 block_ids sont **identiques** au read initial. Le bloc modifié garde son id. |
| **L'écriture est-elle ISOLÉE (seul le bloc ciblé change) ?** | ✅ OUI | Seul le bloc EF a changé (2513→2516 octets) ; tous les autres blocs intacts. |
| **Le pipe échappé `\|` survit-il au round-trip ?** | ✅ OUI | `\|` préservé dans la cellule après update. |
| **Marqueur d'ancrage** | `<!-- bid:xxx -->` inline | `read_document` renvoie le MD **avec** les marqueurs ; `update_block` les ré-injecte automatiquement. |

**Invariant de stabilité read→write** (documenté et opposable) :
> Sous `update_block`, les block_ids sont stables. Un id ne change QUE si le bloc est recréé par une réécriture
> **full-document** (`write_document`) ou par l'insertion d'un **nouveau** bloc. L'architecture option B n'écrit
> JAMAIS le document entier : toute MAJ passe par `update_block` au grain domaine. Donc **les ancres md_block_id
> ne se périment pas en régime normal**. Règle de sûreté : **ne jamais mettre l'index en cache entre un read et
> un write — toujours relire juste avant d'écrire** (l'index est recalculé à la demande, donc un bloc neuf est
> re-capturé au prochain read).

## 2. Politique de concurrence (→ Epic B2)

`update_block` **n'a pas** de champ version/etag → **pas de verrou optimiste natif**. Deux `update_block`
concurrents sur le **même** bloc = last-write-wins (lost update silencieux). Comme chaque écriture cible un bloc
**domaine×type distinct**, les collisions ne surviennent qu'entre deux éditeurs du **même** domaine du **même**
BRD simultanément (rare). **Politique retenue** : read-modify-write court — relire le bloc juste avant d'écrire,
comparer au snapshot lu ; si divergence, **signaler le conflit** (ne pas écraser). Implémentée en Epic B2
(T-20260710-0143), testée par reproduction du lost-update (rouge-avant/vert-après).

## 3. Emplacement du parser TS — tranché

**Décision : le parser vit dans le package CLI `@somtech-solutions/pack` (`cli/src/brd/`)**, exposé à la fois
comme **lib importable** ET comme **sous-commande CLI** (`somtech-pack brd …`).

| Option | Verdict | Raison |
|---|---|---|
| **Lib CLI `@somtech-solutions/pack`** | ✅ **RETENUE** | Déjà le canal de distribution canonique (bundlé au publish, anti-drift) ; **npx-invocable cross-poste** (satisfait skill /brd + agents Orbit, règle « résolution cross-poste ») ; harnais `node --test` déjà en place ; ESM. |
| Module `aims/` | ❌ | Non distribué comme npm → pas de résolution cross-poste propre pour Orbit. |
| Script isolé invoqué par le skill | ❌ | Aucune histoire de packaging/versioning ; réinvente la distribution que le CLI fournit déjà. |

**Architecture du parser — PUR, zéro MCP** :
- **Entrée** = le contenu MD brut **incluant les marqueurs `<!-- bid:xxx -->`** (exactement ce que
  `read_document` renvoie). L'appelant (skill/agent) fait le hop MCP `read_document` ; le parser ne touche
  jamais au réseau → déterministe, testable, zéro dépendance MCP.
- **Traitement** : découpe par marqueurs `bid` → chaque bloc `table` connaît son `md_block_id` ; parse chaque
  tableau en exigences ; associe chaque exigence au `md_block_id` de son tableau.
- **Sorties** : `full` (YAML complet, parité sémantique avec le parser Python) et `index` (léger, avec
  `md_block_id` par exigence). Deux projections **d'un seul parse**.
- **Écriture** (Epic B) : l'appelant rend le tableau domaine×type modifié et appelle `update_block(md_block_id)` —
  le parser fournit le rendu du tableau, l'appelant fait le hop MCP.

**Emplacement des fichiers** (net-new — le repo n'a aucun parser BRD TS/PY) :
```
cli/src/brd/parser.js      # parse pur : MD(+bids) → {ea, ef, ra, hs} structuré  (A2)
cli/src/brd/project.js     # projections index / full à partir du parse          (A3/A4)
cli/src/brd/serialize.js   # sérialisation YAML déterministe                      (A3)
cli/src/commands/brd.js    # sous-commande CLI (project --mode index|full)        (A3/A4)
cli/test/brd-*.test.js     # suite de parité node --test                          (A2+)
```

## 4. Corpus de parité

Référence de logique = parser Python `Architecture/scripts/extract-brd-yaml.py` + fixtures
`Architecture/scripts/test-brd/` (lecture seule, règle d'or n°7). La parité se mesure par **re-parse
round-trip** (PAS byte-à-byte : PyYAML ≠ sérialiseur TS). Le corpus détaillé (quels goldens réutilisables,
lesquels couvrent pipe échappé / cellule vide / symétrie / multi-domaines / cas invalides) est constitué à
partir du rapport de digestion du parser (sous-agent) et matérialisé dans `cli/test/fixtures/brd/` en A2.
Le BRD bac-à-sable Somcraft sert de fixture d'intégration MCP (A3/A4/B) — jamais un BRD client.

## 5. Plan de repli si NO-GO (non déclenché — GO obtenu)

Conservé pour traçabilité. Si le spike avait révélé des ids **instables-pour-écrire** (id changeant sous
`update_block`) :
- **Epic B tombe** (update_block ancré sur md_block_id non fiable) → l'écriture ciblée serait remplacée par une
  réécriture full-document préservante (coût 74 Ko/écriture, mais correcte).
- **Ancrage md_block_id de A4 (index)** deviendrait **lecture seule** (résout-pour-lire mais pas fiable
  pour ancrer une écriture).
- **Restent livrables** : les projections FULL et INDEX **en lecture** (le gain de coût de contexte est acquis
  même sans écriture ciblée), tant que les ids résolvent-pour-lire dans un même cycle read.

→ **Sans objet** : les ids se sont avérés stables. Epic B est GO.

---

## Décisions figées (résumé opposable)

1. **id accepté tel quel** : OUI (sans préfixe `bid:`).
2. **grain d'adressage** : table entière = domaine×type (1 bloc/tableau) — confirmé.
3. **invariant stabilité read→write** : stable sous update_block ; jamais de cache d'index entre read et write ; relire juste avant d'écrire.
4. **politique concurrence** : read-modify-write court + détection de divergence (pas de verrou natif) → Epic B2.
5. **emplacement parser** : `cli/src/brd/` du package `@somtech-solutions/pack` (lib + sous-commande, npx cross-poste).
6. **parser pur zéro-MCP** : entrée = MD+bids (sortie read_document) ; l'appelant fait les hops MCP.
7. **BRD bac-à-sable** : `79245740-36c6-4fa3-96de-ddab0417f5e5` (Somcraft, workspace Somtech, path sandbox).
8. **plan de repli NO-GO** : documenté, non déclenché (GO).

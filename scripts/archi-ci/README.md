# Boîte à outils du modèle vivant (STD-031 §2.7)

Récolteurs et outils qui tiennent `architecture.yaml` fidèle au code, appelés par la CI
installée via le skill **`/setup-archi-ci`** (somtech-pack) et exposés en sous-commandes
`npx @somtech-solutions/pack <cmd>`.

| Script | Sous-commande | Rôle | Source |
|---|---|---|---|
| `harvest-supabase.py` | `harvest-supabase` | SQL du dépôt → grain `table` + FK + descriptions | **copie** — canonique dans `architecture/scripts/` |
| `sqlscan.py` · `frameworks.py` · `yamlemit.py` | — | socles communs (découpage SQL, détection de framework, émission YAML) | pack (D-20260804-0006) |
| `harvest-routes.py` | `harvest-routes` | routes HTTP → grain `endpoint` (Supabase Edge Functions / Next.js / Express) | pack (D-20260715-0004) |
| `harvest-screens.py` | `harvest-screens` | routes d'interface → grain `screen` (React Router / Next.js) | pack (D-20260804-0006) |
| `harvest-config.py` | `harvest-config` | `fly.toml`/`netlify.toml`/`.mcp.json`/env → racine + `depends_on` | pack (D-20260715-0004) |
| `merge-manifests.py` | `merge-manifests` | union des grains récoltés → 1 manifeste | pack (D-20260715-0004) |
| `validate-manifest.py` | `validate-manifest` | valide la **forme** du manifeste (schéma) | **copie** — canonique dans `architecture/scripts/` |
| `diff-manifest.py` | `diff-manifest` | compare committé vs récolté = **gate** (`warn`/`strict`) | pack (D-20260715-0004) |
| `generate-erd.py` | `generate-erd` | grain `table` → ERD Mermaid | pack (D-20260715-0004) |
| `schema/architecture-manifest.schema.json` | — | schéma du manifeste | **copie** — canonique dans `architecture/schemas/` |

## Copies distribuées vs sources canoniques (règle d'or n°7)

`harvest-supabase.py`, `validate-manifest.py` et le schéma sont **canoniques dans le repo
`architecture`** (proches des standards STD-031). Le pack en distribue une **copie
versionnée** (bannière en tête de fichier). Corriger l'original côté Architecture, puis
re-synchroniser ici — ne jamais diverger.

## Dépendances

- **PyYAML** pour `merge-manifests`, `validate-manifest`, `diff-manifest`, `generate-erd`.
- **Aucune** pour `harvest-supabase`, `harvest-routes`, `harvest-screens`, `harvest-config`
  (analyse maison + émission YAML à la main → tournent partout sans `pip install`).

## Un récolteur se prouve sur un corpus réel (I19)

STD-031 §2.7.9 : un récolteur n'est **opposable** aux repos qu'après validation contre des
sources réelles — **zéro faux positif** sur au moins un dépôt discipliné, **invariant
d'échelle** (la précision ne se dégrade pas quand le dépôt grossit), **motifs majoritaires**
des projets disciplinés couverts.

Deux suites, complémentaires et non substituables :

| Suite | Prouve | Corpus |
|---|---|---|
| `scripts/tests/test-archi-ci-toolkit.sh` | le comportement unitaire, cas par cas | fixtures |
| `scripts/tests/test-archi-ci-corpus.sh` | **I19** — ce que le récolteur fait du vrai code | dépôts réels, en **lecture seule** |

La suite de corpus se **saute** proprement là où les dépôts sont absents (CI, autre poste) :
I19 se prouve où le corpus existe, il ne se simule pas. Pointer une autre version des
récolteurs (pour vérifier qu'un test est bien rouge avant un correctif) :
`SOMTECH_ARCHI_CI=/chemin/vers/anciens bash scripts/tests/test-archi-ci-corpus.sh`.

**L'effet pervers à surveiller en priorité** (§2.7.9) : un récolteur ne doit pas se tromper
d'abord sur les projets les plus rigoureux. Schéma isolé dans un schéma dédié, tables
commentées, migrations défensives, tests colocalisés — chacune de ces marques de discipline a
déjà cassé une version de cet outil. La question n'est jamais seulement « est-ce qu'il se
trompe ? », mais « **sur qui se trompe-t-il en premier ?** ».

## Grain non vérifié ≠ conforme

Un récolteur qui ne reconnaît rien (framework non standard, pas de source) **signale** le
grain comme « non vérifié » et ne l'émet pas — il n'est jamais traité comme « conforme ».
Le gate ne bloque que sur ce que les récolteurs ont **effectivement trouvé** dans le code.

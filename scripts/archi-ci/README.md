# Boîte à outils du modèle vivant (STD-031 §2.7)

Récolteurs et outils qui tiennent `architecture.yaml` fidèle au code, appelés par la CI
installée via le skill **`/setup-archi-ci`** (somtech-pack) et exposés en sous-commandes
`npx @somtech-solutions/pack <cmd>`.

| Script | Sous-commande | Rôle | Source |
|---|---|---|---|
| `harvest-supabase.py` | `harvest-supabase` | migrations SQL → grain `table` + FK | **copie** — canonique dans `architecture/scripts/` |
| `harvest-routes.py` | `harvest-routes` | routes HTTP → grain `endpoint` (Next.js App Router / Pages API / Express) | pack (D-20260715-0004) |
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
- **Aucune** pour `harvest-supabase`, `harvest-routes`, `harvest-config` (regex + émission
  YAML à la main → tournent partout sans `pip install`).

## Grain non vérifié ≠ conforme

Un récolteur qui ne reconnaît rien (framework non standard, pas de source) **signale** le
grain comme « non vérifié » et ne l'émet pas — il n'est jamais traité comme « conforme ».
Le gate ne bloque que sur ce que les récolteurs ont **effectivement trouvé** dans le code.

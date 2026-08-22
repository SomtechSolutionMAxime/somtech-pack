# Découpage — Réduire la corvée de MAJ du pack (D-20260722-0004)

- **Demande** : D-20260722-0004 · **App** : Somtech Pack (`2098c2fd-...`)
- **BRD** : absent (pointer NULL **vérifié** `get_brd_pointer` + `brd_coverage has_brd=false`) → stories `Réalisé par : N/A` (voie sanctionnée app-outil, règle d'or n°10)
- **Verdict critique (2e passe, baseline réconciliée)** : **`pret_a_creer = true`** — 5 majeurs + 2 mineurs, **0 bloquant** (corrections de cadrage intégrées aux stories).
- **Hiérarchie CRÉÉE dans ServiceDesk** (voir codes ci-dessous).
- Design : `2026-07-22-fleet-updater-pack-design.md`

## Baseline réconciliée (delta réel)

L'existant **D-20260715-0001** (tout `completed`) livre déjà l'auto-PR **par repo, déclenché au lancement** (`pack-freshness.sh` : `pf_auto_pr`/`pf_build_and_pr`, gardes réseau d'idempotence, lock, PR draft, rollback). **Le delta de cette demande** : une orchestration **centrale, déclenchée sur release `v*`**, qui itère **toute la flotte** (registre SD, dormants inclus) et **réutilise** ce primitive — sans le ré-implémenter.

## Hiérarchie (ordre recommandé)

**Epic 0 — Gouvernance & levée d'inconnues (E-20260722-0003, gate dur)**
- `T-20260722-0021` — SPIKE : 4 inconnues (registre SD, GitHub App mono/cross-org [bloquant possible, en 1er], `pack update --yes` headless + auth registre privé, source de vérité version — confirmer que la garde M1 `pf_main_version` sur origin/main tranche déjà).
- `T-20260722-0022` — ADR : bénir le fleet updater comme unique automatisation centrale (PR-only, jamais `--force`/auto-merge, GitHub App least-privilege, STD-038). **Gate dur** avant Epic 1.

**Epic 1 — Fleet updater : fan-out release-triggered par PR (E-20260722-0004, Track 1)**
- `T-20260722-0023` — Lecteur du registre SD + canary (repos sans `repo_url` remontés).
- `T-20260722-0024` — Provisionner + installer la **GitHub App** least-privilege sur la flotte (dédiée ; dépend du verdict cross-org).
- `T-20260722-0025` — Orchestrateur per-repo : **réplique les pré-gardes** `pf_remote_branch_exists`/`pf_pr_exists` **avant** `pf_build_and_pr` (sinon re-run **destructif**), **pin `pack@<tag>`**, **base-branch paramétrable** (origin/main hardcodé l.185).
- `T-20260722-0026` — Workflow GitHub Actions **ordonné après publish** (`workflow_run`/`needs:`) + **secret registre gaté** + E2E canary.
- `T-20260722-0027` — Fan-out flotte complète + **isolation d'échec** (matrix `fail-fast:false`).
- `T-20260722-0028` — Rapport de run + **rapport de convergence** dans chaque PR (dérive `.somtech.bak` invisible dans le diff git).

**Epic 2 (Track 2) — Rétrécir la surface per-repo (E-20260722-0005, après Track 1 prouvé)**
- `T-20260722-0029` — SPIKE/ADR : cartographie irréductible vs générique.
- `T-20260722-0030` — Migration du générique au global + preuve de reproductibilité clone-seul.

## Corrections de la critique intégrées

1. **🔴→corrigé** `pf_build_and_pr` ne porte QUE le rollback ; l'idempotence est dans `pf_auto_pr`. Appel nu au re-run **supprime la branche de la PR ouverte** → l'orchestrateur (T-0025) réplique les pré-gardes.
2. Fan-out et `publish.yml` partagent `on: push tags v*` → parallèles. **Ordonner** (workflow_run/needs) + **pin `pack@<tag>`** (T-0026, T-0025).
3. Secret auth **registre privé** non gaté → critère ajouté (T-0026).
4. Tension `out_of_scope` « ne pas modifier pf_* » vs hardcode `origin/main` → **base-branch paramétrable** autorisé (T-0025, Epic 1 out_of_scope).
5. Story workflow trop grosse (provisioning App cross-org) → **story dédiée** (T-0024).
6-7. mineurs : source-of-truth version déjà tranchée par M1 ; `installed == tag` (pas « pas de diff ») pour « à jour ».

## Hors découpage (pas oublié)

**Vue « pack version coverage » (drift)** : modifie **ServiceDesk** (app avec BRD v1.10.0) → epic dédié, tracé à une **EF SD à créer**, livré **dans le repo ServiceDesk, session séparée** (règle n°7, anti-pattern ADR-031 évité). Dépend du marqueur de version d'Epic 1.

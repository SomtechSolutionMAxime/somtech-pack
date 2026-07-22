# Découpage — Réduire la corvée de MAJ du pack (D-20260722-0004)

- **Demande** : D-20260722-0004 · **App** : Somtech Pack (`2098c2fd-...`)
- **Grain BRD** : application · **BRD présent** : NON (pointer `brd_document_id` NULL, **vérifié via `get_brd_pointer`** + `brd_coverage has_brd=false`) → stories `Réalisé par : N/A` (voie sanctionnée app-outil, règle d'or n°10)
- **Verdict critique** : **`pret_a_creer = false`** — 1 bloquant + 4 majeurs. **Aucune hiérarchie créée** (gate dur).
- Design : `2026-07-22-fleet-updater-pack-design.md`

## Découpage proposé (4 epics, ordre recommandé)

**Epic 0 — Gouvernance & dé-risquage (prérequis, AVANT tout code)**
- SPIKE ~1j : 3 inconnues dures — (1) registre `applications.repo_url` fiable pour ~20 apps ? (2) GitHub App least-privilege provisionnable — repos clients dans l'org Somtech ou orgs clientes distinctes (cross-org possiblement bloquant) ? (3) `npx pack update --yes` headless en CI + auth registre privé ?
- ADR : bénir le fleet updater comme **unique automatisation centrale** autorisée à pousser (par PR only) dans d'autres repos (exception cadrée à la règle d'or n°7).

**Epic 1 — Fleet updater : fan-out automatisé par PR (Track 1)** ⚠️ *baseline à corriger (voir critique)*
- Auth GitHub App least-privilege + secret CI (L1).
- Résolution du registre depuis SD `applications.repo_url` (repos sans `repo_url` remontés, jamais sautés).
- Workflow fan-out canary chaîné **en aval du publish `v*`** (idempotence par repo×version).
- Rapport de convergence annexé à la PR (car `pack update` converge : la dérive locale part en `.somtech.bak` gitignoré → invisible dans le diff git seul — **fait vérifié** dans `cli/src/commands/update.js`).
- Fan-out flotte complète, matrix `fail-fast:false` (échec isolé par repo).
- ~~Auto-merge du trivial~~ → **retiré du scope** (voir critique).

**Epic 2 — Vue « pack version coverage » (CROSS-APP → ServiceDesk, session séparée)**
- ⚠️ Modifie **ServiceDesk** (app **dotée d'un BRD** v1.10.0), pas le pack → sort en epic dédié pour éviter l'anti-pattern ADR-031. À livrer dans le repo ServiceDesk.
- Amender le BRD ServiceDesk (EF « observabilité couverture de version ») **avant** la story de vue.
- Vue repo → version installée → version courante → retard (repos sans marqueur = « inconnu », jamais omis).

**Epic 3 — Rétrécir la surface per-repo (Track 2, APRÈS Track 1 prouvé)**
- SPIKE/ADR : cartographier irréductible (mcp, app.yaml, hooks contextuels, pin de version) vs générique global + trancher le pin.
- Implémenter la surface mince sans casser la reproductibilité clone-seul.

## Critique adversariale — pourquoi `pret_a_creer = false`

1. **🔴 BLOQUANT — baseline fausse (vérifié en session)** : `scripts/shell/pack-freshness.sh` expose **déjà** `pf_build_and_pr`/`pf_auto_pr`/`pf_acquire_lock` (lock single-writer, idempotence par branche, PR draft, rollback), livré sous **E3 / D-20260715-0001**, **avec** `scripts/tests/test-pack-auto-pr.sh` (T-20260715-0004/0005/0006). Plusieurs stories d'Epic 1 re-spécifient ce comportement livré → risque de double livraison + tickets orphelins. **→ Re-scoper Epic 1 sur le SEUL vrai delta : une orchestration centrale déclenchée sur release `v*` qui itère la flotte et INVOQUE le primitive existant** (aujourd'hui launcher-triggered, pas release-triggered).
2. **🟠 MAJEUR** — l'auto-merge normalise une violation de la règle d'or n°8 → **sortir du scope** (l'ouverture de PR atteint déjà la valeur).
3. **🟠 MAJEUR** — Epic 2 : décision de modèle de données (`version.json` committé vs colonne SD) enfouie dans un G/W/T → **extraire en décision préalable**.
4. **🟠 MAJEUR** — la note du workflow disait `test-pack-auto-pr.sh` absent : **faux**, il existe → recadrer le SPIKE (partir du harnais existant).
5. Mineurs — dépendance de complétude Epic 1↔2 à expliciter ; portée SPIKE inconnue #3 surestimée (le harnais exerce déjà `pack update --yes`).

## Prochaine étape (reco)

Réconcilier avec **E3 / D-20260715-0001** : re-scoper Epic 1 sur le delta réel (orchestration release-triggered qui invoque `pf_auto_pr`), retirer l'auto-merge, extraire la décision de données d'Epic 2, puis **re-lancer le découpage** → création de la hiérarchie seulement quand `pret_a_creer = true`.

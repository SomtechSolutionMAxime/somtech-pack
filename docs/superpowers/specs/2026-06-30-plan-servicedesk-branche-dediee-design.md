# Design — Isolation de la planification dans une branche dédiée (`/plan-servicedesk`)

> Date : 2026-06-30 · App : Somtech Pack (sans BRD → traçabilité EF N/A) · Statut : design validé

## Problème

Quand on exécute `/plan-servicedesk`, l'exercice de planification n'est aujourd'hui **pas** consigné dans une branche isolée :

- **Phase A (brainstorm)** : `superpowers:brainstorming` écrit un design doc et le commite — mais sur la **branche courante**, quelle qu'elle soit. Si on est sur `main` ou sur une branche feature en cours, le commit y atterrit (pas d'isolation).
- **Phase C (découpage)** : le workflow `analyse-decoupage-demande` est en **lecture seule** et ne consigne **rien en fichier**. Le découpage Epic/Story ne vit que dans ServiceDesk (MCP) et dans la conversation.
- `plan-servicedesk` lui-même ne gère **aucune** branche git.

Objectif : `plan-servicedesk` doit consigner **tout son exercice** (design doc du brainstorm **et** trace écrite du découpage) dans une **branche dédiée** `plan/D-AAAAMMJJ-NNNN`, sans casser un travail en cours quand le skill est invoqué tard dans une session.

## Contrainte de fond

`superpowers:brainstorming` est un **plugin externe non modifiable** : il committe sur `HEAD`. Pour isoler le design doc dans `plan/D-xxxx`, il faut donc que `HEAD` soit déjà cette branche **avant** d'invoquer le brainstorm. Conséquence directe : la branche doit exister avant la Phase A, donc le code `D-xxxx` doit exister avant — d'où l'inversion B↔A ci-dessous.

## Décisions

### D1 — Inversion B↔A : Demande d'abord
Nouvel ordre : **B.1 (créer la Demande sur l'énoncé brut) → créer la branche `plan/D-xxxx` → A (brainstorm) → B.2 (mettre à jour la Demande avec le besoin affiné) → C (découpage) → D (Epic/Story)**.

- La Demande naît temporairement « pauvre » (énoncé brut), puis B.2 la met à jour via le mécanisme `update` déjà existant.
- Sans brainstorm (pas de Phase A), B.2 est sautée — la Demande créée en B.1 reste telle quelle.
- Avec un `D-xxxx` déjà passé en argument : la Demande existe, on a le code immédiatement → on crée la branche directement.

### D2 — Garde-fou git adaptatif (avant de basculer de branche)
Évalué juste avant de créer/basculer sur `plan/D-xxxx` :

- **Working tree propre** → créer/basculer `plan/D-xxxx` automatiquement, branché depuis `origin/main`.
- **Travail en cours** (modifs non commitées, ou sur une branche feature active) → **STOP** et proposer à l'utilisateur :
  1. Ranger le travail (commit ou stash) puis isoler sur `plan/D-xxxx` ;
  2. Consigner la planification **sur la branche courante** sans isoler (objectif d'isolation abandonné pour cette invocation, assumé explicitement) ;
  3. Annuler.

Rien n'est rangé ni basculé sans accord explicite. Ce garde-fou répond au cas réel « skill invoqué tard, en plein travail ».

### D3 — Artefacts consignés
- **Design doc** du brainstorm : `docs/superpowers/specs/AAAA-MM-JJ-<slug>-design.md` (produit par superpowers sur `HEAD` = la branche `plan/`).
- **Fichier de découpage dédié** : `docs/superpowers/specs/AAAA-MM-JJ-<slug>-decoupage.md`, **écrit par `plan-servicedesk` lui-même** (le workflow Phase C reste lecture seule). Contenu : grain BRD résolu, EF tracées/manquantes, découpage Epic→Story avec G/W/T, verdict `pret_a_creer`, défauts de la critique adversariale. Existe **même sans brainstorm**.

### D4 — Sort de la branche
Commit + push + **ouverture d'une PR** (visibilité / backup). Le merge sur `main` reste une **décision humaine** via `/merge` — pas de merge automatique (éviter une PR mergée bruyante à chaque planification).

## Edge cases
- `plan/D-xxxx` existe déjà (re-planification) → basculer dessus et ajouter un commit, pas d'erreur.
- Garde-fou option 2 retenue → tous les artefacts vont sur la branche courante, pas de PR de planification distincte.
- Worktree `claude-swt` → `git checkout -b` dans le worktree courant, **jamais** `git worktree add` (règle d'or n°11 respectée par construction).

## Tests
Le skill est un prompt markdown. Test garde-fou anti-régression (type « ordre/sections ») vérifiant que `SKILL.md` documente :
1. Demande créée **avant** la branche, branche créée **avant** le brainstorm (ordre B.1 → branche → A) ;
2. l'écriture du fichier de découpage par le skill ;
3. le garde-fou git adaptatif (3 options quand travail en cours).

Rouge sur la version actuelle (aucune gestion git), vert après. Le test doit être prouvé discriminant.

## Résolution des défauts de la critique (workflow `analyse-decoupage-demande`, `pret_a_creer: false`)

La critique adversariale a relevé 1 bloquant + 3 majeurs + 2 mineurs. Résolutions retenues :

- **R1 (bloquant) — rollback brainstorm échoué après B.1** : le skill **laisse en l'état** (Demande `received` à compléter + branche conservée) et affiche un **message clair** (« Demande D-xxxx créée mais brainstorm interrompu — reprendre via `/plan-servicedesk D-xxxx` »). **Aucune suppression automatique** (la Demande est une entité tracée ; comportement réentrant). À documenter dans le SKILL.md + couvert par le test de contrat.
- **R2 (majeur) — préfixe `plan/`** : **garder `plan/D-xxxx`** (sémantique claire). Tracer une note pour **formaliser le préfixe dans la convention de nommage côté repo Architecture** (CLAUDE.md global, règle d'or n°7) — dette de gouvernance séparée, non bloquante à l'usage.
- **R3 (majeur) — non-régression `superplan`** : retirer toute affirmation « ZÉRO travail ». Le test de contrat **ajoute une assertion `superplan`** : vérifier qu'il lit bien `.claude/skills/plan-servicedesk/SKILL.md` et **ne réimplémente pas** la logique git.
- **R4 (majeur) — sûreté du garde-fou git** : la **validation e2e manuelle** (run réel sur une Demande jetable, working tree propre ET sale, prouvant le STOP + 3 options + absence de commit/checkout non consenti) devient un **critère de fermeture (DoD) explicite** de la story garde-fou — le grep ne prouve que la documentation, pas l'exécution.
- **R5 (mineur) — règle de slug** : avec Phase A → slug du design doc ; **sans Phase A → slug dérivé du titre de la Demande** (à défaut, du code `D-xxxx`). Documenté dans le SKILL.md.
- **R6 (mineur) — déclencheur de la PR** : **figé** — commit + push + ouverture de PR **après la Phase D** (hiérarchie ServiceDesk créée, une fois `pret_a_creer` confirmé).

## Hors-scope
- Modifier `superpowers` (plugin externe).
- L'interaction brainstorm → `writing-plans` (tension préexistante du skill, non introduite ici).
- Le comportement de `superplan` (alias) : hérite automatiquement puisqu'il délègue à `plan-servicedesk` (vérifié par assertion de non-régression, R3 — pas réimplémenté).
- Formalisation du préfixe `plan/` dans le CLAUDE.md global (repo Architecture, R2).

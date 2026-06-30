---
name: plan-servicedesk
description: |
  Pont entre le brainstorm/planification superpowers et la documentation ServiceDesk Somtech.
  Définit le besoin (brainstorming OU systematic-debugging superpowers), crée la Demande, lance le workflow
  analyse-decoupage-demande (validation BRD + découpage Epic/Story G/W/T tracé aux EF), puis
  crée la hiérarchie dans ServiceDesk après validation. Consigne tout l'exercice (design doc + découpage)
  dans une branche git dédiée plan/D-xxxx.
  TRIGGERS : plan-servicedesk, planifier vers servicedesk, documenter le besoin, brainstorm vers servicedesk, debug vers servicedesk, décomposer un besoin, créer la demande et les epics
argument-hint: "[brainstorming|brain | debug] [<besoin libre> | D-AAAAMMJJ-NNNN]"
---

<!-- Pas de `allowed-tools` volontairement : comme les autres skills MCP du pack (merge, pousse-staging,
     /brd), on laisse tous les outils disponibles. Ce skill a besoin des MCP `mcp__servicedesk__*` (demands,
     epics, tickets, applications) ET de l'outil natif `Workflow` — une liste `allowed-tools` restrictive les
     bloquerait. -->
<!-- fin note outils -->

# /plan-servicedesk — du brainstorm à la structure ServiceDesk

L'utilisateur a exécuté : `/plan-servicedesk $ARGUMENTS`. Réponds toujours en **français**.

Ce skill est un **orchestrateur mince**. Il ne réimplémente rien : il **enchaîne des briques qui existent déjà** —
le skill de brainstorming de **superpowers** et le workflow Somtech **`analyse-decoupage-demande`** — en ajoutant
les seuls maillons qu' aucun des deux ne couvre : **créer la Demande** (le workflow en a besoin en entrée),
**consigner l'exercice dans une branche dédiée** `plan/D-xxxx`, et **créer la hiérarchie Epic/Story** une fois la
proposition validée (le workflow est en lecture seule).

> **Pourquoi un pont et pas un fork** : `brainstorming` et `systematic-debugging` viennent du plugin externe
> `superpowers` (mis à jour indépendamment) ; `analyse-decoupage-demande` est un **Workflow** Somtech
> (`~/.claude/workflows/analyse-decoupage-demande.js`). On les **compose**, on ne les copie pas → ce skill
> survit à leurs évolutions.

## Chaîne complète (ordre d'exécution)

> **Inversion B↔A** : la Demande est créée **AVANT** le brainstorm. Raison : `superpowers:brainstorming` committe
> son design doc sur `HEAD` (plugin externe, non modifiable) — il faut donc que la branche `plan/D-xxxx` existe
> avant de l'invoquer, donc que le code `D-xxxx` existe avant, donc que la Demande soit créée d'abord.

```
/plan-servicedesk [brainstorming|brain | debug] [<besoin> | D-xxxx]
   │
   ├─ B.1 Demande   — créer (ou résoudre si D-xxxx passé) la Demande → code D-xxxx   ← ÉCRITURE (confirmée)
   ├─ BR  Branche   — isoler dans plan/D-xxxx (garde-fou git adaptatif)              ← git (conditionnel)
   ├─ A.  Cadrage   — `brainstorming`/`brain` → superpowers:brainstorming
   │                  OU `debug` → superpowers:systematic-debugging  → besoin affiné
   ├─ B.2 MAJ       — mettre à jour la Demande avec le besoin affiné (si Phase A)    ← ÉCRITURE (confirmée)
   ├─ C.  Découpage — Workflow analyse-decoupage-demande <D-xxxx> + écrire le fichier de découpage
   ├─ D.  Hiérarchie— après validation, créer Epics + Stories G/W/T                  ← ÉCRITURE (confirmée)
   └─ E.  Sortie    — commit + push + PR de la branche plan/D-xxxx (merge laissé humain)
```

> **Le mode de cadrage (`brainstorming`/`brain` _ou_ `debug`) et `D-xxxx` sont indépendants.** Une Demande passée
> veut dire « ne recrée pas, pars de celle-ci » (B.1 = *résolution*, B.2 = *mise à jour* si Phase A) — **pas**
> « saute la Phase A ». Si tu passes un mode + une Demande (`/plan-servicedesk brain D-xxxx` ou `debug D-xxxx`),
> on lance la Phase A **en amorçant sur le contenu de la Demande**, puis on la met à jour.
>
> **`brainstorming`/`brain` et `debug` sont mutuellement exclusifs** : on cadre un besoin **ou** on débogue un
> dysfonctionnement, pas les deux. Si les deux sont passés → **stopper et demander de choisir** (ne pas en deviner un).

## Quand l'utiliser / quand ne pas l'utiliser

- ✅ Nouveau besoin client/produit à transformer en travail tracé (Demande → Epic → Story G/W/T tracées au BRD).
- ✅ Besoin déjà clair en tête → sauter le brainstorm (`/plan-servicedesk <besoin>` sans `brainstorming`/`brain`).
- ✅ Demande déjà créée, contenu suffisant → repartir d'elle (`/plan-servicedesk D-AAAAMMJJ-NNNN`) : on saute le cadrage, direct au découpage.
- ✅ Demande déjà créée **mais à challenger/affiner** → `/plan-servicedesk brain D-AAAAMMJJ-NNNN` : brainstorm **amorcé sur le contenu de la Demande**, puis **mise à jour** de la Demande avec le besoin affiné.
- ✅ Le besoin part d'un **dysfonctionnement à comprendre** (pas juste une idée) → `/plan-servicedesk debug <symptôme>` : `superpowers:systematic-debugging` établit la **cause racine**, qui devient le besoin tracé (Demande → découpage). Combinable avec `D-xxxx` (debug amorcé sur la Demande, puis mise à jour).
- ❌ Simple bug isolé **avec fix évident** → créer directement un ticket `incident` (cf. STD-030), pas besoin de tout l'appareil (ni de `debug`). Le mode `debug` sert quand la **cause est incomprise** *et* que le résultat mérite d'être planifié (Demande → découpage).
- ❌ Écrire le plan d'implémentation technique détaillé → c'est `superpowers:writing-plans` (orthogonal ; voir « Articulation »).

## Pré-requis (vérifier, sinon stopper et le signaler)

1. **MCP ServiceDesk** chargé (`mcp__servicedesk__*`). Sinon : signaler, stopper.
2. **Plugin superpowers** présent (si un mode `brainstorming`/`brain` **ou** `debug` est demandé) — sinon proposer de continuer sans (besoin fourni en texte, ou contenu de la Demande si `D-xxxx`). **Cas `brain D-xxxx` / `debug D-xxxx` sans superpowers** : ne **pas** retomber silencieusement en « `D-xxxx` sans Phase A » (qui sauterait la mise à jour) — l'intention reste d'affiner la Demande. Proposer explicitement : (a) éditer le `title`/`description` à la main via la Phase B.2 (update), ou (b) poursuivre en lecture seule sans toucher la Demande. Laisser l'utilisateur choisir.
3. **App cible connue** dans ServiceDesk (`mcp__servicedesk__applications` action `list`). Ne **jamais** inventer un `application_id`.
4. Idéalement un **BRD** pour l'app/module (le workflow le valide). App sans BRD → la traçabilité EF est N/A (règle d'or n°10), le signaler.

## Parsing des arguments

Les signaux sont **orthogonaux** — les détecter séparément, ne pas laisser l'un annuler l'autre :

- **Mode de cadrage (Phase A)** — deux variantes **mutuellement exclusives** :
  - **`brainstorming` _ou_ `brain`** (n'importe où dans `$ARGUMENTS`) → Phase A via `superpowers:brainstorming`
    (cadrer un besoin). `brain` est un alias de `brainstorming` — même comportement.
  - **`debug`** (n'importe où dans `$ARGUMENTS`) → Phase A via `superpowers:systematic-debugging` (comprendre un
    dysfonctionnement et en établir la cause racine).
  - **Si `debug` ET `brainstorming`/`brain` sont présents → STOP** : signaler l'incompatibilité et demander à
    l'utilisateur lequel garder. **Ne pas en choisir un arbitrairement.**
- **Un token `D-AAAAMMJJ-NNNN`** → **Demande existante**. Ça signifie « ne recrée pas la Demande » : la **Phase B.1
  devient une résolution** (et non une création), et la **Phase B.2 une mise à jour** si un mode est passé. Ça
  **n'annule jamais la Phase A** — c'est le mode (ou son absence) qui décide de la Phase A.
- **Le reste de `$ARGUMENTS`** (texte libre) = **énoncé initial du besoin** (base de la Demande B.1, puis amorce de
  la Phase A). Si un `D-xxxx` est passé, l'**amorce du besoin = le contenu de la Demande** ; le texte libre éventuel
  s'ajoute comme précision.
- `$ARGUMENTS` vide et ni mode de cadrage (`brainstorming`/`brain`/`debug`) ni `D-xxxx` → demander l'énoncé du besoin avant de continuer.

> **Résoudre le code `D-xxxx` → UUID (requis dès qu'on appelle `get`/`update`).** Les actions `get` et `update` de
> `mcp__servicedesk__demands` exigent l'**`id` UUID**, et `list` **ne filtre pas par code**. Étape obligatoire avant
> tout `get`/`update` : `mcp__servicedesk__demands` action `list` (filtrer sur `application_id` si l'app est connue,
> sinon paginer `limit`/`offset`), **matcher le `code` `D-AAAAMMJJ-NNNN`** dans les résultats → en extraire l'`id`.
> **Ne jamais passer le code à `get`/`update`**, et **ne pas inventer d'action « get by code »**. (La Phase C, elle,
> passe le **code** directement au Workflow, qui le résout en interne — pas de résolution nécessaire là.)

### Matrice de comportement

| Invocation | Phase B.1 (Demande) | Phase A (brainstorm / debug) | Phase B.2 (MAJ) |
|---|---|---|---|
| _(vide)_ | demander l'énoncé d'abord, puis **create** | sautée | — |
| `<besoin>` | **create** | sautée | — |
| `brain <besoin>` (ou `brainstorming`) | create (sur l'énoncé brut) | brainstorming sur le **texte libre** | **update** (besoin affiné) |
| `debug <symptôme>` | create (sur l'énoncé brut) | systematic-debugging sur le **texte libre** | **update** (cause racine) |
| `D-xxxx` | résolution (existe) → direct Phase C | sautée | — |
| **`brain D-xxxx`** | résolution (existe) | brainstorming sur le **contenu de la Demande** | **update** |
| **`debug D-xxxx`** | résolution (existe) | systematic-debugging sur le **contenu de la Demande** | **update** |
| `brain` + `debug` | **STOP** — modes exclusifs, demander de choisir | — | — |

---

## Phase B.1 — Créer ou résoudre la Demande (EN PREMIER)

> **C'est la première phase d'exécution** (inversion B↔A) : on a besoin du code `D-xxxx` pour nommer la branche
> `plan/D-xxxx` que le brainstorm (Phase A) alimentera.

### Sans `D-xxxx` → créer
1. **Résoudre l'app** (et le module si pertinent) : `mcp__servicedesk__applications` action `list` → `application_id`
   (matcher le nom normalisé, comme `/brd`). 0 match → proposer de corriger ou créer l'app ; **jamais inventer un id**.
2. **Proposer la Demande** puis **afficher la proposition et attendre le GO**. `mcp__servicedesk__demands` action
   `create` exige **tous** ces champs : `title`, `description` (= énoncé brut du besoin), `application_id`,
   `source` ∈ **`{client, admin}`**, `created_by_label`, `module_id?` (optionnel, doit appartenir à `application_id`).
   *(La description est volontairement « brute » à ce stade ; elle sera enrichie en Phase B.2 après le brainstorm.)*
3. Après confirmation : créer la Demande (naît en `received`). Récupérer le **code `D-AAAAMMJJ-NNNN`**.

### Avec `D-xxxx` → résoudre
La Demande existe déjà : résoudre son code → UUID (cf. encadré ci-dessus). On a immédiatement le code pour la branche.

> **Cycle de statut de la Demande, géré par triggers DB — ne jamais le forcer à la main** (STD-030, règle d'or n°5) :
> `received → in_analysis` se déclenche tout seul à la création du **premier epic/ticket enfant** (Phase D),
> puis `in_analysis → in_progress → delivered` suit les enfants. Aucune transition manuelle à faire ici.

## Phase BR — Isoler l'exercice dans une branche dédiée `plan/D-xxxx` (garde-fou git adaptatif)

> **Cette phase s'exécute APRÈS la Demande (B.1) et AVANT le brainstorm (Phase A)** : la branche doit exister avant
> que `superpowers:brainstorming` ne committe son design doc sur `HEAD`. But : consigner tout l'exercice (design doc
> + trace du découpage) dans une branche isolée, sans jamais casser un travail en cours.

**Évaluer l'état git** avant toute bascule :
```bash
git status --porcelain   # vide = working tree propre
git branch --show-current
```

- **Working tree propre** → créer/basculer automatiquement sur `plan/D-xxxx` :
  ```bash
  git fetch origin main
  git checkout -b plan/D-AAAAMMJJ-NNNN origin/main
  ```
  En worktree `claude-swt` : `git checkout -b` dans le worktree courant, **JAMAIS `git worktree add`** (règle d'or n°11).
  Si `plan/D-xxxx` **existe déjà** (re-planification) → `git checkout plan/D-xxxx` et commit additionnel, pas d'erreur.

- **Travail en cours** (modifs non commitées **ou** branche feature active) → **STOP** et présenter exactement **3 options**, ne **rien** ranger/committer/basculer sans accord explicite :
  1. **Ranger** le travail en cours (commit ou stash) puis isoler sur `plan/D-xxxx` ;
  2. **Consigner sur la branche courante** sans isoler (l'objectif d'isolation est abandonné pour cette invocation, à assumer) ;
  3. **Annuler**.

> **Préfixe `plan/`** : sémantique « branche de consignation d'un exercice de planification, isolée, sortie via PR
> sans merge auto ». Formalisation dans la convention de nommage côté repo Architecture (en cours).

## Phase A — Cadrer le besoin (conditionnelle : `brainstorming`/`brain` _ou_ `debug`)

Si un mode de cadrage est demandé (`brainstorming`/`brain` **ou** `debug` — **jamais les deux**, cf. parsing) :

1. **Déterminer l'amorce** :
   - **Avec un `D-xxxx`** : titre + description de la Demande (lue en B.1) comme amorce ; le texte libre éventuel de `$ARGUMENTS` s'ajoute comme précision. *(Si la Demande est en statut terminal `delivered`/`declined`, le signaler : on pourra brainstormer mais pas la mettre à jour — voir Phase B.2.)*
   - **Sans `D-xxxx`** : l'amorce = le texte libre de `$ARGUMENTS` (= la description de la Demande créée en B.1).
2. **Invoquer le skill superpowers** via l'outil `Skill` (le design doc atterrit sur `HEAD` = `plan/D-xxxx`) :
   - mode `brainstorming`/`brain` → `superpowers:brainstorming` (explorer le besoin / la solution) ;
   - mode `debug` → `superpowers:systematic-debugging` (reproduire, isoler, établir la cause racine).
3. Laisser le skill superpowers se dérouler **jusqu'à son terme** (design approuvé ; ou cause racine établie et confirmée). **Ne pas court-circuiter** ce gate.
4. À la sortie, on dispose d'un **besoin affiné** : problème, outcome, périmètre, hors-scope.

> **Rollback (R1) — brainstorm interrompu après B.1** : si la Phase A échoue ou est abandonnée après la création de
> la Demande, **laisser en l'état** : la Demande `received` (à compléter) et la branche `plan/D-xxxx` sont
> **conservées**, **aucune suppression automatique** (la Demande est une entité tracée). Afficher un message clair :
> « Demande D-xxxx créée mais brainstorm interrompu — reprendre via `/plan-servicedesk D-xxxx` ». Comportement réentrant.

> **Mode `debug` — deux garde-fous pratiques** :
> - **Repro requise** : `systematic-debugging` a besoin de **reproduire/investiguer dans un vrai repo**. Si la repro
>   n'est **pas possible**, le mode ne peut pas conclure → **retomber sur `brainstorming`** ou créer un **`incident` direct** (STD-030).
> - **Pas de court-circuit** : une fois la cause racine établie, `debug` suit le **flux complet** identique à
>   `brainstorming` — B.2 → découpage (Phase C) → Epic/Story (Phase D). Il ne shortcut jamais l'analyse.

Si **aucun mode** n'est demandé : le besoin est l'énoncé de la Demande (B.1) tel quel. **Attention** : sans Phase A,
**aucun gate de design** — si l'énoncé est vague, **proposer `brainstorming`** ; s'il décrit un dysfonctionnement mal
compris, **proposer `debug`** — plutôt qu'une Demande bancale.

## Phase B.2 — Mettre à jour la Demande avec le besoin affiné (si Phase A a eu lieu)

1. **Proposer le nouveau `title`/`description`** (besoin affiné par le brainstorm ou cause racine du debug), en **diff lisible** vs l'existant, et **attendre le GO**.
2. Après confirmation : `mcp__servicedesk__demands` action `update` avec `id` (UUID) + `title?`/`description?`. On **ne touche pas** au statut ni à `source`.
3. ⚠️ **Statut terminal** : `update` est **refusé** si la Demande est `delivered`/`declined`. Ne **pas forcer** : signaler et proposer de poursuivre sans réécrire (le besoin affiné sert quand même au découpage) ou de créer une **nouvelle** Demande.

*(Sans Phase A, la Demande créée en B.1 reste telle quelle — pas de B.2.)*

## Phase C — Découpage tracé au BRD (Workflow lecture seule) + consignation

1. Lancer le workflow **`analyse-decoupage-demande`** : outil `Workflow`, `name: "analyse-decoupage-demande"`,
   `args: "D-AAAAMMJJ-NNNN"`. Le workflow, **sans rien écrire**, résout le **BRD au bon grain** (app vs module via
   `module_id`, ADR-031 / STD-033 §2.11), analyse sous plusieurs angles, **propose un découpage Epic → Story G/W/T**
   tracé aux EF, passe une **critique adversariale** et rend un verdict `pret_a_creer`.
2. **Présenter** à l'utilisateur : grain BRD résolu (`brd_grain`) + origine (`brd_resolved_from`), EF manquantes/à amender, défauts de la critique, verdict `pret_a_creer`, découpage proposé. **Ne rien créer encore.**
3. **Consigner le découpage dans un fichier dédié** écrit par le skill (le workflow reste lecture seule) :
   `docs/superpowers/specs/AAAA-MM-JJ-<slug>-decoupage.md` contenant grain BRD, EF tracées/manquantes, découpage
   Epic→Story G/W/T, verdict `pret_a_creer`, défauts de la critique.
   - **Slug** : avec Phase A → **réutiliser le slug du design doc** (`-design.md`) pour rester apparié ; sans Phase A
     → slug dérivé du **titre de la Demande** (à défaut, du code `D-xxxx`).
   - Le fichier est écrit **même sans brainstorm** (Phase A absente).

Deux cas du workflow à relayer fidèlement (ne pas les écraser en Phase D) :

> **EF manquantes** : les ajouter / amender le **BRD d'abord** via `/brd <action> <app>[/<module>]` **au grain
> résolu**, **avant** d'écrire les stories (règle d'or n°10).

> **Fallback module → app** (`brd_resolved_from = "application"` alors que la demande a un `module_id`) : le
> workflow ajoute une **story de gouvernance** « Initialiser le BRD du module ». **Conserver cette story** en Phase D.

## Phase D — Créer la hiérarchie après validation

Le workflow ne crée rien : c'est ici qu'on matérialise la proposition **validée par l'utilisateur**.

1. **GATE DUR — ne créer aucun epic/story tant que `pret_a_creer !== true`.** Si `pret_a_creer: false` ou des défauts
   **bloquants/majeurs**, **STOP** : les régler (amender le découpage, le BRD, relancer la Phase C) **avant** toute
   création. Seule exception : un humain valide explicitement le dépassement (le tracer dans le récap + le fichier de découpage). Pas de création « optimiste ».
2. **Confirmer le découpage** (GO explicite), puis créer dans l'ordre :
   - **Epic(s)** : `mcp__servicedesk__epics` action `create`. Requis : `title`, `problem`, `outcome`,
     `application_id`, `source` ∈ **`{human, agent}`** (≠ enum des demandes !), `created_by_label`. Optionnels utiles :
     `out_of_scope`, `demand_id` (**rattachement à la Demande**, indispensable pour les triggers DB), `sequence_order`.
   - **Story(ies)** : `mcp__servicedesk__tickets` action `create`, `type: "story"`, `epic_id` = l'epic parent,
     **avec `acceptance_criteria` G/W/T** et l'**EF tracée** dans la description (`Réalisé par : <EF-id>` ; `N/A` si app sans BRD).

## Phase E — Sortie : commit + push + PR (déclencheur figé : APRÈS la Phase D)

Une fois la hiérarchie ServiceDesk créée (et `pret_a_creer` confirmé) :

1. **Commit** les artefacts consignés (design doc + `-decoupage.md`) sur `plan/D-xxxx`.
2. **Push** la branche + **ouvrir une PR draft** (visibilité / backup, règle PR-tôt).
3. **Ne JAMAIS merger automatiquement** : le merge sur `main` reste une décision **humaine** via `/merge`.

> **Cas garde-fou option 2** (consigner sur la branche courante) → les artefacts vont sur la branche courante,
> **aucune PR de planification distincte**. **Re-planification** (branche/PR déjà existante) → réutiliser la PR existante.

4. **Récap** : Demande + Epics + Stories créés (codes + URLs), EF tracées, ordre recommandé, branche/PR de consignation,
   et — le cas échéant — le dépassement de gate validé par l'humain. Rappeler le cycle par ticket :
   **COMPRENDRE → CORRIGER → VALIDER → FERMER** (STD-030).

---

## Articulation avec `superpowers:writing-plans`

Ce skill s'arrête au **quoi/pourquoi** (Demande/Epic/Story tracées au BRD). Le **comment** (plan d'implémentation
bite-sized, TDD) relève de `superpowers:writing-plans`, **par story, au moment de l'exécuter** — pas à la
planification. Garder les deux séparés évite de figer des détails techniques dans des stories qui peuvent encore bouger.

## Règles critiques

1. **Composer, jamais forker** : invoquer `superpowers:brainstorming` / `superpowers:systematic-debugging` (Skill)
   et `analyse-decoupage-demande` (Workflow) tels quels. Ne pas réimplémenter leur logique ici.
2. **Aucune écriture ServiceDesk sans GO** : Phases B.1, B.2 et D demandent une confirmation explicite. Le workflow
   (Phase C) est en lecture seule par construction.
3. **Branche d'abord, jamais casser un travail en cours** : le garde-fou git (Phase BR) ne range/commit/bascule
   **rien sans accord explicite**. Working tree sale ou branche feature active → STOP + 3 options. **Jamais
   `git worktree add`** (règle d'or n°11) ; `plan/D-xxxx` créée par `git checkout -b` dans le worktree courant.
4. **Traçabilité BRD obligatoire** : toute story cite une **EF du BRD au bon grain** (STD-033). EF absente →
   amender le BRD **avant** (via `/brd`). App sans BRD → N/A explicitement signalé.
5. **G/W/T obligatoire pour les `story`** (STD-030). Pas de story sans `acceptance_criteria`.
6. **Gate dur `pret_a_creer`** : aucune création d'epic/story tant que la critique du workflow ne rend pas
   `pret_a_creer: true` (sauf dépassement validé explicitement par un humain et tracé).
7. **Statuts dérivés** (Demande/Epic) **jamais fixés à la main** — triggers DB (STD-030).
8. **Attention aux enums `source`** : `demands.source` ∈ `{client, admin}` mais `epics.source` ∈ `{human, agent}`
   — ne pas réutiliser la valeur de la demande pour l'epic. `created_by_label` est requis aux deux niveaux.
9. **Ne jamais inventer un `application_id`** — toujours le résoudre via `mcp__servicedesk__applications`.
10. **Un bug isolé ≠ cette chaîne** : créer un `incident` direct (STD-030). Le mode `debug` ne s'utilise que si la
    **cause est incomprise** *et* que le résultat mérite d'être planifié (Demande → découpage).
11. **Modes de Phase A exclusifs** : `brainstorming`/`brain` et `debug` ne se combinent pas — si les deux sont
    passés, **stopper et demander de choisir** (ne pas en deviner un).
12. **Sortie sans merge auto** : la branche `plan/D-xxxx` se termine en commit + push + PR ; le merge reste humain.

## Cadre opposable

- **STD-030** — gestion des tickets ServiceDesk (hiérarchie Demande→Epic→Story, G/W/T, cycle, statuts dérivés).
- **STD-033** — gestion des BRD (traçabilité EF, résolution de grain app/module §2.8 / §2.11).
- **ADR-031** — 1 produit = 1 app portail, sous-domaines = modules, 1 BRD par module.
- Workflow réutilisé : `~/.claude/workflows/analyse-decoupage-demande.js` (lecture seule, propose le découpage).
- Skills réutilisés : `superpowers:brainstorming` et `superpowers:systematic-debugging` (plugin externe claude-plugins-official).
- Design : `docs/superpowers/specs/2026-06-30-plan-servicedesk-branche-dediee-design.md` (D-20260630-0002).

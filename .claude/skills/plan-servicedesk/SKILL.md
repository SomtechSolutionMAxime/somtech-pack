---
name: plan-servicedesk
description: |
  Pont entre le brainstorm/planification superpowers et la documentation ServiceDesk Somtech.
  Définit le besoin (brainstorming superpowers), crée la Demande, lance le workflow
  analyse-decoupage-demande (validation BRD + découpage Epic/Story G/W/T tracé aux EF), puis
  crée la hiérarchie dans ServiceDesk après validation.
  TRIGGERS : plan-servicedesk, planifier vers servicedesk, documenter le besoin, brainstorm vers servicedesk, décomposer un besoin, créer la demande et les epics
disable-model-invocation: true
argument-hint: "[brainstorming|brain] [<besoin libre> | D-AAAAMMJJ-NNNN]"
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
les deux seuls maillons qu' aucun des deux ne couvre : **créer la Demande** (le workflow en a besoin en entrée) et
**créer la hiérarchie Epic/Story** une fois la proposition validée (le workflow est en lecture seule).

> **Pourquoi un pont et pas un fork** : `brainstorming` vient du plugin externe `superpowers` (mis à jour
> indépendamment) ; `analyse-decoupage-demande` est un **Workflow** Somtech (`~/.claude/workflows/analyse-decoupage-demande.js`).
> On les **compose**, on ne les copie pas → ce skill survit à leurs évolutions.

## Chaîne complète

```
/plan-servicedesk [brainstorming|brain] [<besoin> | D-xxxx]
   │
   ├─ A. Besoin    — (param `brainstorming`/`brain`) Skill superpowers:brainstorming → besoin/spec clair
   ├─ B. Demande   — créer (ou METTRE À JOUR si D-xxxx passé) la Demande   ← ÉCRITURE (confirmée)
   ├─ C. Découpage — Workflow analyse-decoupage-demande <D-xxxx>          ← LECTURE SEULE (valide BRD + propose)
   └─ D. Hiérarchie— après validation, créer Epics + Stories G/W/T        ← ÉCRITURE (confirmée)
```

> **`brainstorming`/`brain` et `D-xxxx` sont indépendants.** Une Demande passée veut dire « ne recrée pas, pars
> de celle-ci » (Phase B = *mise à jour*) — **pas** « saute le brainstorm ». Si tu passes les deux
> (`/plan-servicedesk brain D-xxxx`), on brainstorme **en amorçant sur le contenu de la Demande**, puis on la met à jour.

## Quand l'utiliser / quand ne pas l'utiliser

- ✅ Nouveau besoin client/produit à transformer en travail tracé (Demande → Epic → Story G/W/T tracées au BRD).
- ✅ Besoin déjà clair en tête → sauter le brainstorm (`/plan-servicedesk <besoin>` sans `brainstorming`/`brain`).
- ✅ Demande déjà créée, contenu suffisant → repartir d'elle (`/plan-servicedesk D-AAAAMMJJ-NNNN`) : on saute A et B, direct au découpage.
- ✅ Demande déjà créée **mais à challenger/affiner** → `/plan-servicedesk brain D-AAAAMMJJ-NNNN` : brainstorm **amorcé sur le contenu de la Demande**, puis **mise à jour** de la Demande avec le besoin affiné.
- ❌ Simple bug isolé → créer directement un ticket `incident` (cf. STD-030), pas besoin de tout l'appareil.
- ❌ Écrire le plan d'implémentation technique détaillé → c'est `superpowers:writing-plans` (orthogonal ; voir §6).

## Pré-requis (vérifier, sinon stopper et le signaler)

1. **MCP ServiceDesk** chargé (`mcp__servicedesk__*`). Sinon : signaler, stopper.
2. **Plugin superpowers** présent (si le param `brainstorming`/`brain` est demandé) — sinon proposer de continuer sans (besoin fourni en texte, ou contenu de la Demande si `D-xxxx`). **Cas `brain D-xxxx` sans superpowers** : ne **pas** retomber silencieusement en « `D-xxxx` sans brainstorm » (qui sauterait la mise à jour) — l'intention reste d'affiner la Demande. Proposer explicitement : (a) éditer le `title`/`description` à la main via la Phase B.2 (update), ou (b) poursuivre en lecture seule sans toucher la Demande. Laisser l'utilisateur choisir.
3. **App cible connue** dans ServiceDesk (`mcp__servicedesk__applications` action `list`). Ne **jamais** inventer un `application_id`.
4. Idéalement un **BRD** pour l'app/module (le workflow le valide). App sans BRD → la traçabilité EF est N/A (règle d'or n°10), le signaler.

## Parsing des arguments

Les deux signaux sont **orthogonaux** — les détecter séparément, ne pas laisser l'un annuler l'autre :

- **`brainstorming` _ou_ `brain`** (n'importe où dans `$ARGUMENTS`) **active la Phase A**. `brain` est un simple
  alias de `brainstorming` — même comportement.
- **Un token `D-AAAAMMJJ-NNNN`** → **Demande existante**. Ça signifie « ne recrée pas la Demande » : la **Phase B
  devient une mise à jour** (et non une création). Ça **n'annule jamais la Phase A** — c'est le mot-clé brainstorm
  (ou son absence) qui décide de la Phase A.
- **Le reste de `$ARGUMENTS`** (texte libre) = **énoncé initial du besoin** (amorce du brainstorm, ou base directe
  de la Demande si pas de brainstorm). Si un `D-xxxx` est passé, l'**amorce du besoin = le contenu de la Demande**
  (lu en Phase A/B) ; le texte libre éventuel s'ajoute comme précision.
- `$ARGUMENTS` vide et ni `brainstorming`/`brain` ni `D-xxxx` → demander l'énoncé du besoin avant de continuer.

> **Résoudre le code `D-xxxx` → UUID (requis dès qu'on appelle `get`/`update`).** Les actions `get` et `update` de
> `mcp__servicedesk__demands` exigent l'**`id` UUID**, et `list` **ne filtre pas par code**. Étape obligatoire avant
> tout `get`/`update` : `mcp__servicedesk__demands` action `list` (filtrer sur `application_id` si l'app est connue,
> sinon paginer `limit`/`offset`), **matcher le `code` `D-AAAAMMJJ-NNNN`** dans les résultats → en extraire l'`id`.
> **Ne jamais passer le code à `get`/`update`**, et **ne pas inventer d'action « get by code »**. (La Phase C, elle,
> passe le **code** directement au Workflow, qui le résout en interne — pas de résolution nécessaire là.)

### Matrice de comportement

| Invocation | Phase A (brainstorm) | Phase B (Demande) |
|---|---|---|
| _(vide)_ | sautée | demander l'énoncé d'abord, puis **create** |
| `<besoin>` | sautée | **create** |
| `brain <besoin>` (ou `brainstorming`) | sur le **texte libre** | create |
| `D-xxxx` | sautée | sautée (existe, contenu suffisant) → direct Phase C |
| **`brain D-xxxx`** | sur le **contenu de la Demande** | **update** |

---

## Phase A — Définir le besoin (conditionnelle : param `brainstorming`/`brain`)

Si `brainstorming` ou `brain` est demandé :

1. **Déterminer l'amorce du brainstorm** :
   - **Avec un `D-xxxx`** : lire la Demande (`mcp__servicedesk__demands` action `get`, `id` = l'UUID résolu depuis
     le code) et utiliser son **titre + description** comme amorce. Le texte libre éventuel de `$ARGUMENTS` s'ajoute
     comme précision. *(Si la Demande est en statut terminal `delivered`/`declined`, le signaler : on pourra
     brainstormer mais pas la mettre à jour — voir Phase B.)*
   - **Sans `D-xxxx`** : l'amorce = le texte libre de `$ARGUMENTS`.
2. **Invoquer le skill superpowers** via l'outil `Skill` : `superpowers:brainstorming`, en lui transmettant cette amorce.
3. Laisser le dialogue de brainstorming se dérouler **jusqu'à son approbation** (le skill superpowers présente un
   design et obtient le GO de l'utilisateur). **Ne pas court-circuiter** ce gate.
4. À la sortie, on dispose d'un **besoin affiné** : problème, résultat attendu (outcome), périmètre, hors-scope.

Si `brainstorming`/`brain` n'est **pas** demandé : le besoin est l'énoncé fourni en argument (ou, si un `D-xxxx` est
passé sans brainstorm, le contenu existant de la Demande tel quel ; ou demandé à l'utilisateur si rien).
On considère le besoin « défini » dès qu'on peut en écrire un titre + une description claire. **Attention** : sans
brainstorming il n'y a **aucun gate de design** — la qualité du « pourquoi/quoi » repose entièrement sur l'énoncé
de l'utilisateur. Si l'énoncé est vague ou ambigu, **proposer d'activer `brainstorming`** plutôt que de créer une
Demande bancale.

> Le **plan d'implémentation technique** (`superpowers:writing-plans`) n'est **pas** dans cette chaîne : il se
> rédige plus tard, par story, au moment d'exécuter (voir la section « Articulation » plus bas). Ici on s'arrête au
> **quoi/pourquoi**, pas au comment.

## Phase B — Créer ou mettre à jour la Demande ServiceDesk

Le workflow de découpage prend une **Demande** (`D-…`) en entrée. Trois cas selon les arguments :

### B.0 — Aiguillage
- **Pas de `D-xxxx`** → **créer** la Demande (B.1) à partir du besoin défini.
- **`D-xxxx` + brainstorm** → **mettre à jour** la Demande existante avec le besoin affiné par la Phase A (B.2).
- **`D-xxxx` sans brainstorm** → **ne rien écrire** : on garde la Demande telle quelle, on passe direct en Phase C.

### B.1 — Créer (cas sans `D-xxxx`)
1. **Résoudre l'app** (et le module si pertinent) : `mcp__servicedesk__applications` action `list` → `application_id`
   (matcher le nom normalisé, comme `/brd`). 0 match → proposer de corriger ou créer l'app ; **jamais inventer un id**.
2. **Proposer la Demande** puis **afficher la proposition et attendre le GO**. `mcp__servicedesk__demands` action
   `create` exige **tous** ces champs (sinon l'appel échoue) :
   - `title` (requis)
   - `description` (requis) = énoncé du besoin + outcome + hors-scope issus de la Phase A
   - `application_id` (requis)
   - `source` (requis) ∈ **`{client, admin}`** — `client` si le besoin vient du client, `admin` si interne
   - `created_by_label` (requis) — libellé humain de l'auteur (ex. `"Maxime (plan-servicedesk)"`)
   - `module_id` (optionnel) si la demande est au grain module — doit appartenir à `application_id`
3. Après confirmation : créer la Demande. Elle naît en statut **`received`** (forcé par le serveur). Récupérer
   le **code `D-AAAAMMJJ-NNNN`** retourné.

### B.2 — Mettre à jour (cas `D-xxxx` + brainstorm)
1. La Demande a déjà été lue en Phase A (`get`). **Proposer le nouveau `title`/`description`** (besoin affiné par le
   brainstorm), en **diff lisible** vs l'existant, et **attendre le GO**.
2. Après confirmation : `mcp__servicedesk__demands` action `update` avec `id` (UUID) + `title?`/`description?`
   (au moins un). On **ne touche pas** au statut ni à `source` (immuables ici).
3. ⚠️ **Statut terminal** : `update` est **refusé** si la Demande est `delivered`/`declined`. Si c'est le cas, **ne
   pas forcer** : signaler à l'utilisateur et proposer soit de poursuivre sans réécrire la Demande (le besoin affiné
   sert quand même au découpage), soit de créer une **nouvelle** Demande.

> **Cycle de statut de la Demande, géré par triggers DB — ne jamais le forcer à la main** (STD-030, règle d'or n°5) :
> `received → in_analysis` se déclenche tout seul à la création du **premier epic/ticket enfant** (Phase D),
> puis `in_analysis → in_progress → delivered` suit les enfants. Aucune transition manuelle à faire ici.

## Phase C — Découpage tracé au BRD (Workflow, lecture seule)

Lancer le workflow Somtech **`analyse-decoupage-demande`** avec le code de la Demande :

- Outil `Workflow`, `name: "analyse-decoupage-demande"`, `args: "D-AAAAMMJJ-NNNN"` (le workflow accepte aussi
  `{ demande_code: "D-…" }`).
- Le workflow, **sans rien écrire**, résout le **BRD au bon grain** (app vs module via `module_id`, ADR-031 /
  STD-033 §2.11), analyse la demande sous plusieurs angles (valeur user, traçabilité EF, technique, risques),
  **propose un découpage Epic → Story avec G/W/T**, chaque story **tracée à une EF** du BRD, puis passe une
  **critique adversariale** et rend un verdict `pret_a_creer`.

À la sortie, présenter à l'utilisateur : le **grain BRD résolu** (`brd_grain`) et son **origine** (`brd_resolved_from`),
les **EF manquantes/à amender**, les **défauts** de la critique, le verdict `pret_a_creer`, et le découpage proposé.
**Ne rien créer encore.**

Deux cas du workflow à relayer fidèlement (ne pas les écraser en Phase D) :

> **EF manquantes** : les ajouter / amender le **BRD d'abord** via `/brd <action> <app>[/<module>]` **au grain
> résolu** (`brd_grain`), **avant** d'écrire les stories. Une story sans EF tracée est une violation de
> traçabilité (règle d'or n°10).

> **Fallback module → app** (`brd_resolved_from = "application"` alors que la demande a un `module_id`) : le
> workflow ajoute une **story de gouvernance** « Initialiser le BRD du module » (ou un déclassement explicite au
> grain app). **Conserver cette story** dans la Phase D — ne pas la supprimer du découpage.

## Phase D — Créer la hiérarchie après validation

Le workflow ne crée rien : c'est ici qu'on matérialise la proposition **validée par l'utilisateur**.

1. **GATE DUR — ne créer aucun epic/story tant que `pret_a_creer !== true`.** Si le workflow rend
   `pret_a_creer: false` ou laisse des défauts **bloquants/majeurs**, **STOP** : les régler (amender le découpage,
   le BRD, relancer la Phase C) **avant** toute création. Seule exception : un humain valide explicitement le
   dépassement (le tracer dans le récap). Pas de création « optimiste ».
2. **Confirmer le découpage** avec l'utilisateur (GO explicite), puis créer dans l'ordre :
   - **Epic(s)** : `mcp__servicedesk__epics` action `create`. Champs **requis** :
     `title`, `problem`, `outcome`, `application_id`, `source` ∈ **`{human, agent}`** (≠ enum des demandes !),
     `created_by_label`. Optionnels utiles : `out_of_scope`, `demand_id` (**= rattachement à la Demande**, indispensable
     pour que les triggers DB fassent avancer la demande), `sequence_order` (pour l'ordre recommandé du workflow).
   - **Story(ies)** : `mcp__servicedesk__tickets` action `create`, `type: "story"`, `epic_id` = l'epic parent
     (`epic_id` force `type=story`), **avec `acceptance_criteria` G/W/T** (given/when/then) et l'**EF tracée** citée
     dans la description (`Réalisé par : <EF-id>`).
3. **Récap** : Demande + Epics + Stories créés (codes + URLs), EF tracées, ordre recommandé, et — le cas échéant —
   le dépassement de gate validé par l'humain. Rappeler le cycle de traitement par ticket :
   **COMPRENDRE → CORRIGER → VALIDER → FERMER** (STD-030).

---

## Articulation avec `superpowers:writing-plans`

Ce skill s'arrête au **quoi/pourquoi** (Demande/Epic/Story tracées au BRD). Le **comment** (plan d'implémentation
bite-sized, TDD) relève de `superpowers:writing-plans`, **par story, au moment de l'exécuter** — pas à la
planification. Garder les deux séparés évite de figer des détails techniques dans des stories qui peuvent encore bouger.

## Règles critiques

1. **Composer, jamais forker** : invoquer `superpowers:brainstorming` (Skill) et `analyse-decoupage-demande`
   (Workflow) tels quels. Ne pas réimplémenter leur logique ici.
2. **Aucune écriture ServiceDesk sans GO** : Phases B et D demandent une confirmation explicite. Le workflow
   (Phase C) est en lecture seule par construction.
3. **Traçabilité BRD obligatoire** : toute story cite une **EF du BRD au bon grain** (STD-033). EF absente →
   amender le BRD **avant** (via `/brd`). App sans BRD → N/A explicitement signalé.
4. **G/W/T obligatoire pour les `story`** (STD-030). Pas de story sans `acceptance_criteria`.
5. **Gate dur `pret_a_creer`** : aucune création d'epic/story tant que la critique du workflow ne rend pas
   `pret_a_creer: true` (sauf dépassement validé explicitement par un humain et tracé).
6. **Statuts dérivés** (Demande/Epic) **jamais fixés à la main** — triggers DB (STD-030).
7. **Attention aux enums `source`** : `demands.source` ∈ `{client, admin}` mais `epics.source` ∈ `{human, agent}`
   — ne pas réutiliser la valeur de la demande pour l'epic. `created_by_label` est requis aux deux niveaux.
8. **Ne jamais inventer un `application_id`** — toujours le résoudre via `mcp__servicedesk__applications`.
9. **Un bug isolé ≠ cette chaîne** : créer un `incident` direct (STD-030).

## Cadre opposable

- **STD-030** — gestion des tickets ServiceDesk (hiérarchie Demande→Epic→Story, G/W/T, cycle, statuts dérivés).
- **STD-033** — gestion des BRD (traçabilité EF, résolution de grain app/module §2.8 / §2.11).
- **ADR-031** — 1 produit = 1 app portail, sous-domaines = modules, 1 BRD par module.
- Workflow réutilisé : `~/.claude/workflows/analyse-decoupage-demande.js` (lecture seule, propose le découpage).
- Skill réutilisé : `superpowers:brainstorming` (plugin externe claude-plugins-official).

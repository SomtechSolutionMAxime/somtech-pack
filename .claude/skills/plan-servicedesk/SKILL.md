---
name: plan-servicedesk
description: |
  Pont entre le brainstorm/planification superpowers et la documentation ServiceDesk Somtech.
  Définit le besoin (brainstorming superpowers), crée la Demande, lance le workflow
  analyse-decoupage-demande (validation BRD + découpage Epic/Story G/W/T tracé aux EF), puis
  crée la hiérarchie dans ServiceDesk après validation.
  TRIGGERS : plan-servicedesk, planifier vers servicedesk, documenter le besoin, brainstorm vers servicedesk, décomposer un besoin, créer la demande et les epics
disable-model-invocation: true
argument-hint: "[brainstorming] [<besoin libre> | D-AAAAMMJJ-NNNN]"
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Skill, Task
---

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
/plan-servicedesk [brainstorming] [<besoin> | D-xxxx]
   │
   ├─ A. Besoin    — (param `brainstorming`) Skill superpowers:brainstorming → besoin/spec clair
   ├─ B. Demande   — créer la Demande D-xxxx dans ServiceDesk            ← ÉCRITURE (confirmée)
   ├─ C. Découpage — Workflow analyse-decoupage-demande <D-xxxx>          ← LECTURE SEULE (valide BRD + propose)
   └─ D. Hiérarchie— après validation, créer Epics + Stories G/W/T        ← ÉCRITURE (confirmée)
```

## Quand l'utiliser / quand ne pas l'utiliser

- ✅ Nouveau besoin client/produit à transformer en travail tracé (Demande → Epic → Story G/W/T tracées au BRD).
- ✅ Besoin déjà clair en tête → sauter le brainstorm (`/plan-servicedesk <besoin>` sans `brainstorming`).
- ✅ Demande déjà créée → repartir d'elle (`/plan-servicedesk D-AAAAMMJJ-NNNN`) : on saute A et B.
- ❌ Simple bug isolé → créer directement un ticket `incident` (cf. STD-030), pas besoin de tout l'appareil.
- ❌ Écrire le plan d'implémentation technique détaillé → c'est `superpowers:writing-plans` (orthogonal ; voir §6).

## Pré-requis (vérifier, sinon stopper et le signaler)

1. **MCP ServiceDesk** chargé (`mcp__servicedesk__*`). Sinon : signaler, stopper.
2. **Plugin superpowers** présent (si le param `brainstorming` est demandé) — sinon proposer de continuer sans (besoin fourni en texte).
3. **App cible connue** dans ServiceDesk (`mcp__servicedesk__applications` action `list`). Ne **jamais** inventer un `application_id`.
4. Idéalement un **BRD** pour l'app/module (le workflow le valide). App sans BRD → la traçabilité EF est N/A (règle d'or n°10), le signaler.

## Parsing des arguments

- Le mot-clé `brainstorming` (n'importe où dans `$ARGUMENTS`) **active la Phase A**.
- Un token de la forme `D-AAAAMMJJ-NNNN` → **Demande existante** : sauter A + B, aller directement en Phase C avec ce code.
- Le reste de `$ARGUMENTS` (texte libre) = **énoncé initial du besoin** (sert d'amorce au brainstorm, ou de base directe à la Demande si pas de brainstorm).
- `$ARGUMENTS` vide et pas de `brainstorming` → demander à l'utilisateur l'énoncé du besoin avant de continuer.

---

## Phase A — Définir le besoin (conditionnelle : param `brainstorming`)

Si `brainstorming` est demandé :

1. **Invoquer le skill superpowers** via l'outil `Skill` : `superpowers:brainstorming`. Lui transmettre l'énoncé
   initial (le texte libre de `$ARGUMENTS`) comme amorce.
2. Laisser le dialogue de brainstorming se dérouler **jusqu'à son approbation** (le skill superpowers présente un
   design et obtient le GO de l'utilisateur). **Ne pas court-circuiter** ce gate.
3. À la sortie, on dispose d'un **besoin défini** : problème, résultat attendu (outcome), périmètre, hors-scope.

Si `brainstorming` n'est **pas** demandé : le besoin est l'énoncé fourni en argument (ou demandé à l'utilisateur).
On considère le besoin « défini » dès qu'on peut en écrire un titre + une description claire.

> Le **plan d'implémentation technique** (`superpowers:writing-plans`) n'est **pas** dans cette chaîne : il se
> rédige plus tard, par story, au moment d'exécuter (voir §6). Ici on s'arrête au **quoi/pourquoi**, pas au comment.

## Phase B — Créer la Demande ServiceDesk

> Sauter cette phase si l'utilisateur a fourni un `D-AAAAMMJJ-NNNN` existant.

Le workflow de découpage prend une **Demande** (`D-…`) en entrée. On la crée donc à partir du besoin défini.

1. **Résoudre l'app** (et le module si pertinent) : `mcp__servicedesk__applications` action `list` → `application_id`
   (matcher le nom normalisé, comme `/brd`). 0 match → proposer de corriger ou créer l'app ; **jamais inventer un id**.
2. **Proposer la Demande** (titre, description = énoncé du besoin + outcome + hors-scope issus de la Phase A,
   `source` = `client` ou `admin`, `application_id`, `module_id` si module). **Afficher la proposition et attendre le GO.**
3. Après confirmation : créer via `mcp__servicedesk__demands` action `create`. Récupérer le **code `D-AAAAMMJJ-NNNN`**.

> Statuts de la Demande **dérivés automatiquement** (triggers DB) depuis les enfants — ne **jamais** les fixer à la main (STD-030).

## Phase C — Découpage tracé au BRD (Workflow, lecture seule)

Lancer le workflow Somtech **`analyse-decoupage-demande`** avec le code de la Demande :

- Outil `Workflow`, `name: "analyse-decoupage-demande"`, `args: "D-AAAAMMJJ-NNNN"` (le workflow accepte aussi
  `{ demande_code: "D-…" }`).
- Le workflow, **sans rien écrire**, résout le **BRD au bon grain** (app vs module via `module_id`, ADR-031 /
  STD-033 §2.11), analyse la demande sous plusieurs angles (valeur user, traçabilité EF, technique, risques),
  **propose un découpage Epic → Story avec G/W/T**, chaque story **tracée à une EF** du BRD, puis passe une
  **critique adversariale** et rend un verdict `pret_a_creer`.

À la sortie, présenter à l'utilisateur : les **EF manquantes/à amender** signalées, les **défauts** de la critique,
et le découpage proposé. **Ne rien créer encore.**

> Si le workflow signale des **EF manquantes** : les ajouter / amender le **BRD d'abord** (via `/brd`), **avant**
> d'écrire les stories. Une story sans EF tracée est une violation de traçabilité (règle d'or n°10).

## Phase D — Créer la hiérarchie après validation

Le workflow ne crée rien : c'est ici qu'on matérialise la proposition **validée par l'utilisateur**.

1. **Confirmer le découpage** (ou l'amender avec l'utilisateur). Si la critique du workflow rend `pret_a_creer: false`
   ou s'il reste des défauts **bloquants**, les régler **avant** création.
2. Après GO explicite, créer dans l'ordre :
   - **Epic(s)** : `mcp__servicedesk__epics` action `create` (rattachés à la Demande), avec `problem` / `outcome` / `out_of_scope`.
   - **Story(ies)** : `mcp__servicedesk__tickets` action `create`, `type: "story"`, rattachées à leur epic, **avec
     `acceptance_criteria` G/W/T** (given/when/then) et l'**EF tracée** citée dans la description (`Réalisé par : <EF-id>`).
3. **Récap** : Demande + Epics + Stories créés (codes + URLs), EF tracées, ordre recommandé. Rappeler le cycle de
   traitement par ticket : **COMPRENDRE → CORRIGER → VALIDER → FERMER** (STD-030).

---

## 6. Articulation avec `superpowers:writing-plans`

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
5. **Statuts dérivés** (Demande/Epic) **jamais fixés à la main** — triggers DB (STD-030).
6. **Ne jamais inventer un `application_id`** — toujours le résoudre via `mcp__servicedesk__applications`.
7. **Un bug isolé ≠ cette chaîne** : créer un `incident` direct (STD-030).

## Cadre opposable

- **STD-030** — gestion des tickets ServiceDesk (hiérarchie Demande→Epic→Story, G/W/T, cycle, statuts dérivés).
- **STD-033** — gestion des BRD (traçabilité EF, résolution de grain app/module §2.8 / §2.11).
- **ADR-031** — 1 produit = 1 app portail, sous-domaines = modules, 1 BRD par module.
- Workflow réutilisé : `~/.claude/workflows/analyse-decoupage-demande.js` (lecture seule, propose le découpage).
- Skill réutilisé : `superpowers:brainstorming` (plugin externe claude-plugins-official).

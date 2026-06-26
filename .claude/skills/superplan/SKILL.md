---
name: superplan
description: |
  Alias de /plan-servicedesk — du brainstorm/planification superpowers à la documentation ServiceDesk
  (Demande → découpage Epic/Story G/W/T tracé au BRD). Comportement et arguments identiques à /plan-servicedesk.
  TRIGGERS : superplan, plan vers servicedesk, planifier le besoin, brainstorm vers servicedesk, décomposer un besoin
disable-model-invocation: true
argument-hint: "[brainstorming|brain] [<besoin libre> | D-AAAAMMJJ-NNNN]"
---

# /superplan — alias de /plan-servicedesk

`/superplan` est un **alias** de `/plan-servicedesk`. Toute la logique — Phases A→D, parsing des arguments
(`brainstorming`/`brain`, code `D-AAAAMMJJ-NNNN`, texte libre), garde-fous (gate `pret_a_creer`, statut terminal),
traçabilité BRD — vit **uniquement** dans `plan-servicedesk`. **Ne rien réimplémenter ni dupliquer ici** (anti-drift :
toute évolution du comportement se fait dans `plan-servicedesk`, l'alias en hérite automatiquement).

## Action

Invoquer **immédiatement** le skill `plan-servicedesk` via l'outil `Skill`, en lui transmettant `$ARGUMENTS`
**tels quels** (sans rien retirer ni reformuler) :

- `skill` = `plan-servicedesk`
- `args` = le `$ARGUMENTS` reçu par `/superplan` (le mot-clé `brainstorming`/`brain`, le code `D-…` et le texte
  libre éventuels passent à l'identique).

Ne pose **aucune** question avant cette invocation : `plan-servicedesk` gère lui-même son dialogue, ses confirmations
et ses pré-requis. Réponds toujours en **français**.

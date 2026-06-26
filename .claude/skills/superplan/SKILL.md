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

Déléguer **immédiatement** à `plan-servicedesk` en **lisant puis exécutant** sa source, avec `$ARGUMENTS` **tels
quels** (sans rien retirer ni reformuler — le mot-clé `brainstorming`/`brain`, le code `D-…` et le texte libre
éventuels passent à l'identique) :

1. **`Read`** le `SKILL.md` de `plan-servicedesk`, en essayant dans l'ordre :
   - `.claude/skills/plan-servicedesk/SKILL.md` (installation projet)
   - `~/.claude/skills/plan-servicedesk/SKILL.md` (installation globale)
2. **Exécuter ces instructions** en traitant le `$ARGUMENTS` reçu par `/superplan` comme le `$ARGUMENTS` de
   `plan-servicedesk`.

> **Ne PAS passer par l'outil `Skill`.** `plan-servicedesk` porte `disable-model-invocation: true` (volontaire — c'est
> un workflow lourd à écritures ServiceDesk qu'on ne veut pas voir auto-déclenché). Ce flag **interdit aussi son
> appel via l'outil `Skill`** (« cannot be used with Skill tool due to disable-model-invocation »). La délégation se
> fait donc par **lecture directe de la source** — qui reste l'**unique** `plan-servicedesk/SKILL.md` (zéro duplication).

Ne pose **aucune** question avant de déléguer : `plan-servicedesk` gère lui-même son dialogue, ses confirmations et
ses pré-requis. Réponds toujours en **français**.

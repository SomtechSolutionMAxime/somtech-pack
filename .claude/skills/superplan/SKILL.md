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

Déléguer **immédiatement** à `plan-servicedesk`, en lui transmettant `$ARGUMENTS` **tels quels** (sans rien retirer
ni reformuler — le mot-clé `brainstorming`/`brain`, le code `D-…` et le texte libre éventuels passent à l'identique) :

1. **Voie normale — outil `Skill`** : invoquer `Skill` avec `skill = "plan-servicedesk"` et `args = $ARGUMENTS`.
2. **Fallback** si `plan-servicedesk` n'est **pas** disponible via l'outil `Skill` (sa directive
   `disable-model-invocation: true` peut le retirer du contexte appelable par le modèle — cf. doc Claude Code) :
   localiser puis **`Read`** son `SKILL.md` — d'abord `.claude/skills/plan-servicedesk/SKILL.md` (installation
   projet), sinon `~/.claude/skills/plan-servicedesk/SKILL.md` (installation globale) — et **exécuter ces
   instructions** avec `$ARGUMENTS`. Ce fallback existe uniquement parce que la voie normale est verrouillée ; il ne
   **duplique** aucune logique (la source reste l'unique `plan-servicedesk/SKILL.md`).

Ne pose **aucune** question avant de déléguer : `plan-servicedesk` gère lui-même son dialogue, ses confirmations et
ses pré-requis. Réponds toujours en **français**.

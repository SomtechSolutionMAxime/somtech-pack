---
name: rappel
description: |
  Orchestrateur de RAPPEL cross-fonction : fan-out d'une question de mémoire à travers
  les substrats et DÉLÈGUE à chaque geste de fonction (épisodique → /episodique,
  sémantique → Somcraft, exécutif → ServiceDesk, travail → session). Ne possède aucun
  moteur : il compose, il recoupe. Convenance de découvrabilité — pas load-bearing.
  DÉCLENCHEURS : /rappel, se rappeler d'un contexte, retrouver ce qu'on sait sur X à
  travers plusieurs mémoires, recouper épisodique + sémantique + exécutif, rappel large.
  Pour un rappel PUREMENT épisodique, aller directement à /episodique.
  NE PAS confondre avec /episodique (le geste de fonction qui POSSÈDE le moteur épisodique)
  ni avec /memoire (hub informatif). Un rappel NE FAIT PAS FOI (I3) — promotion via le gate.
  Cadre : STD-039 §2.5 (orchestrateur mince), BRD Mémoire EA-MEM-006, EF-PRO-002.
disable-model-invocation: false
---

# /rappel — orchestrateur de rappel cross-fonction

`/rappel` **compose** un rappel à travers plusieurs mémoires en **déléguant** à chaque
**geste de fonction** — il ne possède **aucun moteur** (STD-039 §2.5, invariant **I2** :
le moteur épisodique appartient à `/episodique`, pas ici). Il **fan-out** la question,
recoupe les résultats, et qualifie ce qui fait foi vs ce qui rappelle.

> C'est une **convenance de fan-out**, pas un point de contrôle : avec le socle
> always-on (invariants dans le CLAUDE.md + STD-039), un agent route déjà correctement
> seul. Pour un rappel **mono-substrat**, invoquer directement le geste de fonction
> (`/episodique`, Somcraft, ServiceDesk) est parfaitement légitime.

## 1. La carte des substrats — vers quel geste déléguer

| Fonction | Geste de fonction (où déléguer) | Ce qu'on y rappelle | Fait foi ? |
|---|---|---|---|
| **Épisodique** | **`/episodique`** (possède le moteur Graphiti, scopé `group_id`) | Le **vécu** : rencontres, transcripts, qui a dit/décidé quoi | ❌ rappelle seulement (I3) |
| **Sémantique** | **Somcraft MCP** (`search_documents`, `read_document`, `read_backlinks`) | Concepts métier **finalisés**, connaissance durable câblée `[[…]]` | ✅ opposable une fois finalisé |
| **Exécutif** | **ServiceDesk MCP** (`tickets`, `epics`, `demands`, `project_decisions`, `graph`) | État du travail, décisions, risques, santé | ✅ opposable |
| **Travail** | Session + `graphify` | Contexte volatil de la tâche courante | ❌ jamais foi |

**Règle d'aiguillage** — « de quelle nature est ce dont je me rappelle ? » :
- vécu / ce qui s'est dit en séance → **`/episodique`** ;
- concept / définition durable → **Somcraft** ;
- état / décision officielle → **ServiceDesk** ;
- contexte immédiat → **travail** (déjà là).

## 2. Frontière D5 (I4) — l'agent fait le pont, jamais un substrat

Aucun pont direct entre substrats. `/rappel` **n'agrège pas via un super-substrat** : il
fait **N appels explicites** (délégations) et recoupe lui-même. En particulier, la lecture
épisodique passe **toujours** par le geste `/episodique` (qui interroge Graphiti en
direct), **jamais** via le SD-Graph (câblage de l'exécutif, pas un accès à l'épisodique).

## 3. Rappel épisodique — déléguer à /episodique

`/rappel` **ne porte pas** le moteur épisodique. Pour la partie épisodique d'un rappel, il
**délègue au geste de fonction `/episodique`**, qui possède le moteur
(`.claude/skills/episodique/scripts/graphiti_search.py`, scopé `group_id`, clé hors bande).

```bash
# Délégation à /episodique (voir son SKILL.md) — clé fournie hors bande (I6) :
python3 .claude/skills/episodique/scripts/graphiti_search.py \
    --group-id "<projet-ou-sujet>" --query "…" --max-facts 10
```

Voir **`/episodique`** pour le détail du geste (bornage `group_id` I5, secret I6, santé).

## 4. Ce qui rappelle ≠ ce qui fait foi (I3)

Un fait revenu de l'épisodique **ne fait pas foi** : il rappelle, il oriente. Pour t'en
servir comme **vérité opposable**, il faut le **promouvoir** via le **gate de promotion**
(domaine CON) vers l'opposable — ServiceDesk (exécutif) ou Somcraft (sémantique). Le rappel
**lit** partout ; il **n'écrit jamais** dans l'opposable en direct.

- Rappel épisodique → **hypothèse / piste** à corroborer.
- Corroboré + conforme au gate → **promu** (là ça fait foi).
- Écriture directe dans l'opposable sans gate = interdit.

## 5. Recette de fan-out (composer les délégations)

1. **Cadrer** : de quoi je me rappelle, et de quelle **nature** (vécu / concept / état / contexte) ?
2. **Déléguer au(x) bon(s) geste(s)** : `/episodique` (borné `group_id`), Somcraft, ServiceDesk — un appel explicite chacun.
3. **Recouper** les retours (ex. un fait épisodique → vérifier la décision opposable dans ServiceDesk, ou le concept dans Somcraft).
4. **Qualifier** : ce qui fait foi (SD / Somcraft finalisé) vs ce qui n'est qu'un rappel (épisodique / travail).
5. **Si un rappel doit devenir opposable** → **gate de promotion**, jamais en direct.

## Références

- `references/memoire-substrats.md` — carte détaillée des substrats et exemples d'aiguillage.
- **STD-039** §2.5 (rôle d'orchestrateur mince), §2.3 (carte fonction → interface), invariants I1-I8.
- **`/episodique`** — geste de fonction qui **possède** le moteur épisodique (délégation).
- **`/memoire`** — hub informatif « quelle mémoire pour quoi ».
- BRD Mémoire — EA-MEM-006, EF-PRO-002, RA-EPI-001 (l'épisodique ne fait pas foi).

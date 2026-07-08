---
name: memoire
description: |
  Hub informatif de la mémoire Somtech (couche 3) : « quelle mémoire pour quoi » et
  vers quel geste de fonction aller. Aiguillage de découvrabilité — il POINTE, il
  n'exécute AUCUN geste et n'est PAS un point de contrôle (les invariants porteurs
  vivent dans le socle always-on, pas ici).
  DÉCLENCHEURS : /memoire, quelle mémoire utiliser, où écrire/lire tel type d'info,
  carte de la mémoire, quel geste de mémoire pour mon besoin, m'orienter dans la mémoire.
  Pour EXÉCUTER un geste, aller au geste de fonction : /episodique (épisodique),
  Somcraft (sémantique), ServiceDesk (exécutif), le gate (promotion), /rappel (fan-out).
  Cadre : STD-039 §2.1/§2.3/§2.5 (modèle socle + 3 couches, carte fonction → interface).
disable-model-invocation: false
---

# /memoire — hub d'aiguillage de la mémoire (informatif)

`/memoire` répond à **« quelle mémoire pour quoi, et par quel geste ? »**. C'est la
**couche 3** du modèle STD-039 : un **aiguillage de découvrabilité** qui **pointe** vers
les gestes de fonction. Il **n'exécute aucun geste** de mémoire et **n'est pas un point
de contrôle**.

> ⚠️ **Les invariants porteurs ne vivent PAS ici.** Ils sont dans le **socle always-on**
> (noyau CLAUDE.md + STD-039) : un agent qui n'invoque jamais `/memoire` doit **quand
> même** les respecter. Mettre une règle load-bearing derrière une invocation la rend
> facultative — interdit (STD-039 §2.1). Ce hub est une **convenance**, pas une barrière.

## Carte fonction → interface canonique (STD-039 §2.3)

| Fonction de mémoire | Interface canonique (le geste) | Écrire | Lire / rappeler |
|---|---|---|---|
| **Travail (TRA)** | Session + `graphify` (ambiant, pas de skill dédié) | contexte de session ; graphe `graphify` jetable | contexte courant ; requête `graphify` |
| **Épisodique (EPI)** | **`/episodique`** (possède le moteur) | encodage d'épisode *(planifié, ED12)* | lecture Graphiti scopée `group_id` |
| **Sémantique (SEM)** | **Somcraft MCP + discipline d'écriture** (pas de skill neuf) | `write_document` + backlinks `[[…]]` | `read_document` / `search_documents` / backlinks |
| **Procédurale (PRO)** | **Les skills / STD eux-mêmes** ; `/skill-creator` (méta) | rédiger un STD (source) + un skill (exécution) | invoquer le skill ; lire le STD |
| **Exécutive (EXE)** | **ServiceDesk MCP + STD-030** (pas de skill neuf) | tickets, décisions, risques, hypothèses | `get` / `list` / SD-Graph |
| **Consolidation (CON)** | **Gate de promotion** (outil MCP `memory_promotion`) | `promote` (sous gate auto) | `list` / `get` / `review` |
| **Routage (ROU)** | Worker d'ingestion (**infra**, pas un geste d'agent) | route par `application_id` / `group_id` | — |
| **Saillance (SAL)** | Paramètre de zone (température) — **pas une interface** | — | — |

**Rappel cross-fonction** : pour composer un rappel à travers plusieurs substrats, voir
l'orchestrateur **`/rappel`** (fan-out qui délègue aux gestes ci-dessus).

## Règle d'aiguillage rapide

- « ce qui s'est **dit / passé** en séance » → **`/episodique`** (borné `group_id`).
- « un **concept / une définition** durable » → **Somcraft** (sémantique).
- « **où on en est / ce qui a été décidé** » → **ServiceDesk** (exécutif).
- « **rendre opposable** un fait qui ne l'était pas » → **gate de promotion** (jamais en direct).
- « **contexte immédiat** de ma tâche » → mémoire de **travail** (déjà là).
- « **rappel large**, plusieurs mémoires à recouper » → **`/rappel`**.

## Ce qu'il faut savoir sans invoquer ce hub (socle always-on)

Ces invariants s'appliquent **toujours**, ce hub ou pas (noyau CLAUDE.md, STD-039 §2.6) :

- **I1** — nommer un geste par sa **fonction**, jamais par son mécanisme.
- **I3** — un **rappel ne fait pas foi** ; la seule remontée vers l'opposable est le **gate**.
- **I4** — **frontière D5** : l'agent fait le pont entre substrats en appels explicites.
- **I5** — toute lecture/écriture **épisodique** est **scopée `group_id`**.

Pour la carte complète et les invariants I2/I6/I7/I8 : **STD-039**
(`/standards/STD-039-interface-usage-memoire.md`).

## Références

- **STD-039** — interface d'usage de la mémoire (modèle socle + 3 couches, carte §2.3, invariants I1-I8).
- Gestes de fonction : **`/episodique`**, **`/rappel`** ; MCP Somcraft / ServiceDesk ; outil `memory_promotion`.
- BRD Mémoire — EA-MEM-006 (explorabilité), EF-PRO-002. ADR-033 (fonctions de mémoire).

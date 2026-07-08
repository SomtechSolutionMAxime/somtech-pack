# Carte des substrats de mémoire — référence de rappel

Détail de la discipline `/rappel`. Source de vérité : **BRD Mémoire — Département IA de
Somtech** (in_force, Somcraft `/architecture/business-requirements/BRD-memoire-somtech.md`)
et **ADR-033** (architecture de la mémoire, taxonomie par fonction).

> Principe ADR-033 : un **graphe est le câblage** d'une région de mémoire, jamais une
> mémoire en soi. Chaque **fonction** de mémoire a **un** système porteur (EA-MEM-007).

## Les cinq fonctions et leurs porteurs

### Épisodique — Graphiti (le vécu conversationnel)
- **Porteur** : instance Graphiti de Somtech (`graphiti.somtech.solutions`), Neo4j Community (ADR-034).
- **Contient** : faits extraits des rencontres/transcripts/sessions encodées — entités, relations, qui a dit/décidé quoi, bi-temporel.
- **Partition** : `group_id` = projet/sujet **interne** (RA-EPI-002). Ce n'est PAS l'isolation client (celle-ci = séparation d'instance par Département IA, ADR-034).
- **Accès rappel** : `scripts/graphiti_search.py` → `POST /search {query, group_ids:[gid], max_facts}` (header `X-API-Key`).
- **Autorité** : ❌ **ne fait pas foi** (RA-EPI-001) — rappelle, oriente, ne tranche pas.
- **Quand** : « qu'est-ce qui s'est dit/passé en rencontre sur X », « le contexte vécu d'un projet ».

### Sémantique — Somcraft (les concepts finalisés)
- **Porteur** : Somcraft (documents .md écrits à 100 % par les agents).
- **Contient** : concepts métier durables, définitions, standards, connaissance câblée par backlinks `[[…]]` (connectome déterministe, EF-SEM-002).
- **Accès rappel** : MCP Somcraft — `search_documents`, `read_document`, `read_backlinks`, `resolve_links`.
- **Autorité** : ✅ **fait foi une fois finalisé** (RA-SEM-006). Un brouillon en cours = mémoire de **travail** (ne fait pas foi) tant qu'il n'est pas finalisé via le gate.
- **Quand** : « c'est quoi le concept/la définition de X », « quelle est la connaissance durable sur Y ».

### Exécutif — ServiceDesk (l'état opposable du travail)
- **Porteur** : ServiceDesk — **registre unique** Somtech, tous clients (RA-EXE-005), partitionné par `application_id`.
- **Contient** : hiérarchie Demande → Epic → Story → Ticket, décisions, risques, hypothèses, santé, avancement — en **réalité miroir** (RA-EXE-002).
- **Accès rappel** : MCP ServiceDesk — `tickets`, `epics`, `demands`, `projects`, `project_decisions`, `project_risks`, `graph` (SD-Graph = câblage exécutif, EF-EXE-005).
- **Autorité** : ✅ **fait foi** (RA-EXE-001, RLS Postgres).
- **Quand** : « où on en est sur X », « qu'a-t-on décidé/quel risque sur Y », « quel ticket couvre Z ».

### Travail — session + graphify (le volatil)
- **Porteur** : contexte de session courante + `/graphify` (graphes jetables) + brouillons Somcraft non finalisés.
- **Autorité** : ❌ jamais foi (RA-TRA-001), jamais promu sans gate.
- **Quand** : contexte immédiat de la tâche — souvent déjà dans le contexte, pas besoin de « rappeler ».

## Frontière D5 (RA-ROU-001 / RA-EPI-005) — l'agent fait le pont

Aucun pont direct entre substrats. Concrètement :

- ❌ **NE PAS** lire l'épisodique « via le SD-Graph » — le SD-Graph câble l'**exécutif**, pas Graphiti.
- ❌ **NE PAS** attendre qu'un service agrège les mémoires pour toi.
- ✅ **Interroger chaque substrat directement** (Graphiti pour l'épisodique, Somcraft pour le sémantique, ServiceDesk pour l'exécutif) et **recouper toi-même**.

## Exemples d'aiguillage

| Question de l'agent | Substrat(s) | Ordre |
|---|---|---|
| « Qu'a-t-on décidé sur l'archi mémoire d'Acceo ? » | Exécutif (décision opposable) + épisodique (le vécu de la discussion) | ServiceDesk `project_decisions` d'abord (fait foi), Graphiti `/search` group_id=acceo pour le contexte |
| « C'est quoi exactement le connectome dans notre modèle ? » | Sémantique | Somcraft `search_documents` "connectome" → `read_document` |
| « Qui a soulevé le risque de poisoning et quand ? » | Épisodique (qui/quand dit) + exécutif (risque tracé) | Graphiti `/search` "poisoning" + ServiceDesk `project_risks` |
| « Où en est la story du gate de promotion ? » | Exécutif | ServiceDesk `tickets`/`epics` |
| « De quoi parlait-on juste avant ? » | Travail | contexte de session (déjà là) |

## Rappel → promotion (ne pas court-circuiter le gate)

Un fait rappelé de l'épisodique est une **piste**, pas une vérité. Pour qu'il **fasse foi**,
il doit être **promu** via le **gate (domaine CON)** vers l'opposable :

```
rappel épisodique (Graphiti)  →  corroboration  →  gate CON  →  opposable (ServiceDesk / Somcraft)
        ne fait pas foi                                              fait foi
```

Le rappel **lit** partout ; il **n'écrit jamais** dans l'opposable en direct (RA-EXE-004, RA-CON-001).

---
name: rappel
description: |
  Discipline de RAPPEL de la mémoire Somtech : quelle mémoire consulter pour quoi,
  comment combiner les substrats, et où passe la frontière avec l'opposable.
  Interroge la mémoire épisodique (Graphiti) EN DIRECT par group_id, la sémantique
  (Somcraft), et l'exécutif (ServiceDesk). Complète /episodique (écriture) par le
  côté lecture/rappel.
  DÉCLENCHEURS : /rappel, /memoire, se rappeler, retrouver le vécu d'un projet,
  qu'est-ce qu'on a décidé/dit sur X, rappel épisodique, interroger Graphiti,
  chercher dans la mémoire, contexte d'une rencontre passée.
  NE PAS confondre avec /episodique (encoder une session en épisode = écriture) ni
  avec une recherche RAG (similarité documentaire pure, hors connectome).
  Cadre : BRD Mémoire EF-EPI-005 + EF-PRO-002, ADR-033 (fonctions de mémoire),
  RA-EPI-005 (rappel direct, frontière D5).
disable-model-invocation: false
---

# /rappel — se rappeler depuis la mémoire Somtech

Ce skill encode **la discipline de rappel** : un agent qui a besoin de contexte ne
« cherche pas au hasard » — il sait **quelle mémoire porte quoi**, l'interroge au bon
endroit, combine les résultats, et sait **ce qui fait foi** vs **ce qui ne fait que
rappeler**.

> Source de vérité : **BRD Mémoire — Département IA de Somtech** (in_force). Ce skill
> opérationnalise **EF-EPI-005** (rappel épisodique direct) et **EF-PRO-002** (un STD/
> une discipline opérationnalisé·e par un skill). Cadre conceptuel : **ADR-033**.

## 1. La carte des substrats — quelle mémoire pour quoi

| Fonction | Substrat | Ce qu'on y rappelle | Comment | Fait foi ? |
|---|---|---|---|---|
| **Épisodique** | Graphiti (`graphiti.somtech.solutions`) | Le **vécu** conversationnel : rencontres, transcripts, qui a dit/décidé quoi, quand | `scripts/graphiti_search.py` — `/search` borné par `group_id` | ❌ rappelle seulement (RA-EPI-001) |
| **Sémantique** | Somcraft | Les **concepts métier finalisés**, la connaissance durable, câblée par backlinks `[[…]]` | MCP Somcraft (`search_documents`, `read_document`, `read_backlinks`) | ✅ opposable une fois finalisé (RA-SEM-006) |
| **Exécutif** | ServiceDesk | L'**état du travail** : demandes/epics/stories/tickets, décisions, risques, hypothèses, santé | MCP ServiceDesk (`tickets`, `epics`, `demands`, `project_decisions`, `graph`) | ✅ opposable (RA-EXE-001) |
| **Travail** | session + graphify | Le **contexte volatil** de la tâche courante, graphes jetables | contexte de session / `/graphify` | ❌ jamais foi (RA-TRA-001) |

**Règle d'aiguillage** — pose-toi « de quelle nature est ce dont je me rappelle ? » :
- « **Qu'est-ce qui s'est dit / passé** en rencontre / session ? » → **épisodique (Graphiti)**.
- « **C'est quoi le concept / la définition / la connaissance** durable ? » → **sémantique (Somcraft)**.
- « **Où on en est / qu'a-t-on décidé** officiellement ? » → **exécutif (ServiceDesk)**.
- « De quoi je parlais **il y a 5 minutes** ? » → **travail** (déjà dans le contexte).

## 2. Frontière D5 — l'agent fait le pont, jamais un substrat

**RA-ROU-001 / RA-EPI-005 (opposable)** : il n'y a **aucun pont direct entre substrats**.
Tu interroges **chaque mémoire directement** et tu **combines toi-même** les résultats.

- Pour l'épisodique → **appelle Graphiti EN DIRECT** via le client fourni. **JAMAIS** via
  le SD-Graph, jamais en passant par un autre service. Le SD-Graph est le câblage de
  l'**exécutif** (EF-EXE-005), pas un accès à l'épisodique.
- Combiner = faire N appels explicites (Graphiti + Somcraft + ServiceDesk) et recouper
  les résultats dans ton raisonnement — pas déléguer à un « super-substrat ».

## 3. Rappel épisodique — utiliser le client Graphiti

Le client de lecture vit dans `scripts/graphiti_search.py` (stdlib pure, aucune dépendance).

```bash
# La clé est un SECRET D'INFRA (règle d'or 12 / STD-038) : jamais dans le pack.
# Elle est fournie au runtime par l'environnement (ou un fichier local non versionné).
export GRAPHITI_AGENT_API_KEY=<clé fournie hors bande>      # OU : export GRAPHITI_ENV_FILE=~/.config/somtech/graphiti.env

python3 .claude/skills/rappel/scripts/graphiti_search.py \
    --group-id "<projet-ou-sujet>" \
    --query "qu'a-t-on décidé sur l'architecture X ?" \
    --max-facts 10
# → {"group_id": "...", "count": N, "facts": [ {"fact": "..."}, ... ]}

# Vérifier la santé de l'instance (sans clé) :
python3 .claude/skills/rappel/scripts/graphiti_search.py --health
```

**Toujours borné par `group_id`** (RA-EPI-002) : une requête interroge **un seul**
périmètre projet/sujet — c'est le cantonnement. Pas de `group_id`, pas de rappel.

**Le secret ne se devine pas** : sans clé, le client échoue proprement **avant tout
appel réseau**. Si la clé n'est pas fournie, ne l'invente pas et ne la cherche pas dans
le code — demande qu'on te la fournisse hors bande (env / fichier local).

## 4. Ce qui rappelle ≠ ce qui fait foi

Un fait revenu de l'**épisodique ne fait PAS foi** (RA-EPI-001) : il rappelle, il oriente.
Pour t'en servir comme **vérité opposable** (décision, concept), il faut le **promouvoir**
via le **flux de promotion / gate (domaine CON)** vers l'opposable — ServiceDesk (exécutif)
ou Somcraft (sémantique). Le rappel **lit** ; il n'écrit jamais dans l'opposable en direct.

- Rappel épisodique → **hypothèse / piste** à corroborer.
- Corroboré + conforme au gate → **promu** dans ServiceDesk ou Somcraft (là ça fait foi).
- Écriture directe dans l'opposable sans gate = interdit (RA-EXE-004 / RA-CON-001).

## 5. Recette de rappel (combiner les substrats)

1. **Cadrer** : de quoi je me rappelle, et de quelle **nature** (vécu / concept / état / contexte) ?
2. **Interroger le bon substrat en premier** (cf. §1), borné (`group_id` pour l'épisodique).
3. **Recouper** avec les autres substrats si besoin (ex. un fait épisodique → vérifier la
   décision opposable correspondante dans ServiceDesk, ou le concept dans Somcraft).
4. **Qualifier** : marquer ce qui fait foi (SD/Somcraft) vs ce qui n'est qu'un rappel (Graphiti).
5. **Si un rappel doit devenir opposable** → passer par le **gate de promotion**, jamais en direct.

## Références

- `references/memoire-substrats.md` — carte détaillée des substrats et exemples d'aiguillage.
- BRD Mémoire (Somcraft `/architecture/business-requirements/BRD-memoire-somtech.md`) — EF-EPI-005, EF-PRO-002, RA-EPI-001/002/005, RA-ROU-001.
- ADR-033 (architecture de la mémoire), ADR-034 (backend Graphiti / Neo4j Community).
- Complémentaire : `/episodique` (côté **écriture** : encoder une session en épisode, EF-EPI-004).

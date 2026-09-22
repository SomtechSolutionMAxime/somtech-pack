---
name: episodique
description: |
  Geste de la mémoire ÉPISODIQUE (le vécu conversationnel : rencontres, transcripts,
  sessions). Interface de fonction portant ses deux gestes au même endroit nommé
  (symétrie, STD-039 I2) : lecture/rappel LIVRÉE ; écriture/encodage LIVRÉE et TESTÉE
  (STD-045) mais PAS MISE EN SERVICE (Loi 25, §2.7 — aucun appel réel). Interroge la
  mémoire épisodique Graphiti EN DIRECT, bornée par group_id.
  DÉCLENCHEURS : /episodique, mémoire épisodique, rappeler le vécu d'un projet,
  interroger l'épisodique, chercher dans les rencontres/transcripts, faits d'un group_id,
  qu'a-t-on dit/décidé en séance sur X, encoder une session en mémoire épisodique.
  NE PAS confondre avec le nom du mécanisme (Graphiti/Neo4j) — on nomme par fonction (I1).
  Le rappel ET l'encodage épisodiques NE FONT PAS FOI (I3) et un épisode ne devient JAMAIS
  opposable (STD-045 §2.6) ; pour rendre un fait opposable, un agent l'écrit lui-même,
  sous sa propre autorité, dans le substrat opposable (autorat de premier rang). Frontière
  D5 (I4) : appel direct, jamais via un autre substrat.
  Cadre : STD-039 (interface d'usage mémoire), STD-045 (encodage), BRD Mémoire
  EF-EPI-005 (lecture) / EF-EPI-004 (encodage), ADR-033/ADR-034/ADR-035.
disable-model-invocation: false
---

# /episodique — le geste de la mémoire épisodique (lecture + écriture)

La mémoire **épisodique** conserve le **vécu conversationnel** : ce qui s'est dit et
décidé en rencontres, transcripts, sessions. `/episodique` est son **interface de
fonction** (couche 1, STD-039 §2.1) : elle porte **tous** les gestes de l'épisodique —
lecture *et* écriture — au **même endroit nommé** (symétrie **I2**). Le mécanisme sous
la surface (le moteur Graphiti) est un **détail de couche 2** que ce skill wrappe ; on
nomme le geste par sa **fonction**, jamais par la techno (**I1**).

> Cadre : **STD-039** (interface d'usage de la mémoire). Backing BRD : **EF-EPI-005**
> (rappel/lecture directe), **EF-EPI-004** (encodage working → épisodique). ADR-033
> (fonctions de mémoire), ADR-034 (backend Graphiti / Neo4j Community).

## Invariants porteurs (toujours vrais ici)

- **I5 — cantonnement `group_id`** : toute lecture/écriture épisodique est **scopée à un
  seul `group_id`** (projet/sujet). Pas de `group_id`, pas de geste. L'isolation Loi 25
  inter-Département IA est une affaire d'**infra** (séparation d'instance, ADR-034), pas
  du skill.
- **I6 — secret hors bande** : la clé d'accès Graphiti (`X-API-Key`) est un **secret
  d'infra** fourni au runtime par l'environnement (`GRAPHITI_AGENT_API_KEY` /
  `GRAPHITI_ENV_FILE`). **Jamais** dans le pack, le code livré, ni le source control
  (STD-038). Absente → échec propre avant tout réseau ; ne jamais l'inventer.
- **I4 — frontière D5** : on interroge Graphiti **en direct**. Jamais via le SD-Graph ni
  un autre substrat. Suivre un faisceau = *sauter* vers l'autre région et la lire avec
  **ses** outils.
- **I3 — ne fait pas foi** : un fait épisodique **rappelle**, il ne prouve pas. Pour le
  rendre opposable → **gate de promotion** (voir `/rappel` §4 et le domaine CON).

## Geste de LECTURE / rappel épisodique (livré)

Moteur : `scripts/graphiti_search.py` (stdlib pure, aucune dépendance). C'est le moteur
**possédé par cette fonction** — les autres gestes (ex. l'orchestrateur `/rappel`)
**délèguent ici**, ils ne le copient pas (I2).

```bash
# Clé fournie hors bande (I6) — jamais dans le repo :
export GRAPHITI_AGENT_API_KEY=<clé>       # OU : export GRAPHITI_ENV_FILE=~/.config/somtech/graphiti.env

python3 .claude/skills/episodique/scripts/graphiti_search.py \
    --group-id "<projet-ou-sujet>" \
    --query "qu'a-t-on décidé sur l'architecture X ?" \
    --max-facts 10
# → {"group_id": "...", "count": N, "facts": [ {"fact": "..."}, ... ]}

# Santé de l'instance (clé si dispo → backend ; sinon /caddy-health keyless) :
python3 .claude/skills/episodique/scripts/graphiti_search.py --health
```

Tests du moteur : `python3 .claude/skills/episodique/scripts/graphiti_search_test.py`
(11 tests unittest, HTTP mocké).

## Geste d'ÉCRITURE / encodage épisodique (livré, testé — PAS mis en service)

L'encodage d'une session saillante en épisode (faisceau **working → épisodique**,
EF-EPI-004) est **entièrement spécifié par STD-045** (Somcraft, `draft`) et **livré**
sur ce même skill (symétrie **I2** : lecture et écriture au même endroit nommé).
Moteur : `scripts/graphiti_encode.py`, colocalisé avec `graphiti_search.py`.

```bash
# Clé fournie hors bande (I6) — jamais dans le repo :
export GRAPHITI_AGENT_API_KEY=<clé>       # OU : export GRAPHITI_ENV_FILE=~/.config/somtech/graphiti.env

python3 .claude/skills/episodique/scripts/graphiti_encode.py \
    --group-id "<projet-ou-sujet>" \
    --session-ref "<identifiant-de-session>" \
    --author-label "Michel (agent)" \
    --statement "Un énoncé autoportant, compréhensible sans le contexte de la session."
# → rapporte "soumis" (jamais "encodé"), puis "confirmé"/"non confirmé" selon
#   qu'une recherche de vérification sur le même group_id a trouvé un fait.
```

Tests du moteur : `python3 .claude/skills/episodique/scripts/graphiti_encode_test.py`
(HTTP mocké — aucun appel réseau réel).

**Contraintes non négociables (STD-045)** :

- **§2.2 — `--group-id` obligatoire**, aucune valeur par défaut, **aucun repli** sur
  `somtech-internal` (contrairement à la chaîne d'ingestion des rencontres).
- **§2.3 — on encode des énoncés, jamais un dialogue ni le transcript** : 1 à 10 énoncés
  autoportants par appel (anti-firehose, RA-EPI-004).
- **§2.3.1 — `--session-ref` obligatoire**, sans espace, ≤128 caractères ; porte
  `source_description = "session <ref>"`, seul élément distinguant un épisode de session
  d'un épisode de rencontre (`meeting <id>`).
- **§2.4 — le geste rapporte « soumis », jamais « encodé »** : un `202` (ou tout 2xx) ne
  prouve rien, la seule preuve est une recherche de confirmation sur le même `group_id`.
- **§2.4.1 — MUST NOT réessayer** un `POST /messages` au seul motif qu'une recherche de
  confirmation est revenue vide (non concluant, jamais négatif — évite les doublons, D5).
- **§2.5 — saillance V1 humaine** : l'invocation elle-même est le filtre ; aucun score
  n'est calculé ni simulé côté skill (I5).
- **§2.6 — I7 : n'appelle JAMAIS `memory_promotion`**, sous aucune condition. L'encodage
  reste non-opposable → non-opposable ; **un épisode ne devient jamais opposable**
  (décision de projet `fdba0e96`, 2026-07-28). Pour rendre un fait opposable, un agent
  compétent l'écrit **lui-même**, sous sa propre autorité, ailleurs (autorat de premier
  rang, §2.6.1) — l'épisode ne s'y « convertit » pas.
- **§2.7 — PAS MIS EN SERVICE** : encoder une session communique son contenu hors Québec
  (moteur d'extraction → OpenAI). Tant qu'aucune EFVP ne couvre ce flux, **rien n'est
  encodé contre une instance réelle** — ce moteur n'a été exercé qu'en HTTP mocké.

## Références

- **STD-039** (Somcraft `/standards/STD-039-interface-usage-memoire.md`) — interface d'usage, invariants I1-I8, carte §2.3.
- BRD Mémoire (`business-requirements/BRD-memoire-somtech.md`) — EF-EPI-004/005, RA-EPI-001..005.
- `/rappel` — orchestrateur de rappel **cross-fonction** qui délègue ici pour l'épisodique.
- `/memoire` — hub informatif « quelle mémoire pour quoi ».

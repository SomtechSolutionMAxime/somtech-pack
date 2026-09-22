---
name: textes-applicables
description: |
  Lit les textes applicables (ADR/STD pointés) d'une application ServiceDesk, à la naissance d'un chef d'équipe, sans dépendre du copier-coller de son orchestrateur. Distingue trois états, jamais deux : textes déclarés (rend les pointeurs, jamais le contenu recopié), aucun texte déclaré (légitime), [non mesuré] (l'appel a échoué).
  DÉCLENCHEURS: /textes-applicables, textes applicables, ADR/STD de mon application, lire les textes applicables à la naissance
---

# Textes applicables — lecture à la naissance d'un chef

Ticket : `T-20260922-0135` (`D-20260921-0016` Q2b). Arbitrage batiscan 2026-09-22 : la conception initiale du ticket (« le champ n'existe pas, il faut inventer une convention `metadata.applicable_texts` ») était **fausse** — mesurée contre le reel, superseded. Le support existe deja, nativement, valide cote serveur.

## Ce que ce skill n'est PAS

Ce n'est **pas** une redite de Q2. Q2 (CHANGELOG, chapitre `chefs-equipe.md` §« Deux listes de textes ») fait deja lire, en **prose**, par l'**orchestrateur** a sa propre naissance, le socle commun + la liste de son application (`applications` action `get_applicable_texts`), pour les coller a la main dans chaque brief de chef.

Ce skill sert un **CHEF** qui veut lire directement les textes applicables de **son** application, **sans dependre** de ce copier-coller — parce qu'un brief peut l'omettre, parce qu'un chef peut naitre sans orchestrateur (execution directe d'un ticket), ou parce qu'il veut verifier par lui-meme ce que son brief lui a rapporte.

## Pré-requis MCP

- `mcp__servicedesk__applications` (action `get_applicable_texts`)
- `mcp__servicedesk__tickets` (action `get`) — pour résoudre l'`application_id` depuis le ticket qui a mandaté ta naissance, si tu en as un

## Le cœur du skill : trois états, jamais deux

| État | Condition | Rendu |
|---|---|---|
| **textes-declares** | l'appel a réussi, au moins un pointeur | la liste des pointeurs (`text_ref`, `title`, `somcraft_uuid`) — **jamais** le contenu du texte, ni son `application_note` |
| **aucun-declare** | l'appel a réussi, la liste est vide | `aucun texte declare` — **légitime**, 33 applications sur 44 n'ont simplement rien à déclarer aujourd'hui |
| **non-mesure** | l'appel a échoué, ou sa réponse est illisible | `[non mesure]` — **jamais** confondu avec `aucun-declare` : une panne n'est pas un état normal |

La logique de classification vit dans `lib/classifier.sh` (fonction `tap_classifie`), pure, testée, mutée. Elle ne fait aucun appel MCP elle-même — c'est toi (le chef, qui as accès au MCP) qui appelles, qui écris la réponse brute dans un fichier JSON, et qui passes ce fichier + ton propre code de succès à `tap_classifie`.

## Workflow, à ta naissance

### 1. Résoudre l'`application_id`

- Si ta naissance est mandatée par un ticket ServiceDesk (`T-YYYYMMDD-NNNN`) : tu l'as déjà lu (règle de naissance générale) — prends son champ `application_id` directement, ne le redemande pas.
- Sinon (chef né hors ticket, ex. travail de domaine) : cherche `.somtech/app.yaml` (STD-027) dans le repo courant pour l'`application_id` lié.
- Si ni l'un ni l'autre : **abstiens-toi** — n'invente pas un `application_id`, dis-le à ton coordonnateur.

### 2. Appeler le MCP et capturer la réponse brute

```
mcp__servicedesk__applications action=get_applicable_texts application_id=<id>
```

Écris le JSON brut de la réponse dans un fichier de ton scratchpad (ex. `applicable-texts.json`). Si l'appel lève une erreur MCP, note-le (pas de fichier, ou fichier vide) — c'est ton `rc_appel`.

### 3. Classifier

```bash
source .claude/skills/textes-applicables/lib/classifier.sh
tap_classifie <fichier-json> <rc-appel>
```

- `rc_appel` = `0` si l'appel MCP a répondu (même avec `success:false` — la lib le détecte), `1` (ou tout non-zéro) s'il a levé une exception/erreur avant de répondre.
- Le code de retour de `tap_classifie` (`0`/`1`/`2`) te dit l'état ; son stdout te donne le rendu.

### 4. Utiliser le résultat

- **textes-declares** : porte ces pointeurs dans ton propre contexte de travail (jamais recopiés dans un brief à un sous-agent sans les identifier comme références — même règle que les maquettes, `chefs-equipe.md` §105 : *"une référence, jamais un contenu ; il ira le chercher avec son propre contexte"*). Si tu as besoin du contenu d'un ADR/STD précis, va le lire toi-même via Somcraft (`somcraft_uuid`) au moment où tu en as besoin.
- **aucun-declare** : continue normalement — ce n'est pas un manque à signaler.
- **non-mesure** : signale-le explicitement (à ton coordonnateur si le blocage est réel) — ne continue jamais en silence comme si l'absence de réponse valait `aucun-declare`.

## Tests

```bash
bash .claude/skills/textes-applicables/tests/test-classifier.sh          # banc unitaire — fixtures synthétiques, les 3 états + non-fuite de contenu
bash .claude/skills/textes-applicables/tests/test-mutations-classifier.sh # banc de mutation — chaque garde retirée doit rougir le banc unitaire
bash .claude/skills/textes-applicables/tests/test-corpus-reel.sh          # corpus figé, capture réelle 2026-09-22 : les DEUX chiffres avec dénominateur
```

Mesure de référence (corpus réel, capture 2026-09-22, `T-20260922-0135`) :
- **11/11** applications à texte déclaré, correctement classées et rendues au bon compte de pointeurs.
- **3/3** applications sans texte déclaré (échantillon), correctement classées `aucun texte declare`.
- **36** pointeurs au total sur les 11 applications chargées — identique à la mesure indépendante de `lionel` du même jour, sur les mêmes données.

---
name: ligne-directe
description: Ouvrir une ligne de discussion avec le dirigeant depuis un agent, et la tenir dans les deux sens — l'agent y pousse ce qui appelle une décision et ses jalons, le dirigeant lui répond depuis son téléphone et la réponse atterrit dans le pane de l'agent. Utilise cette compétence quand un travail va durer au-delà du moment où quelqu'un regarde l'écran, quand tu vas avoir besoin d'un arbitrage que tu ne peux pas trancher seul, ou quand on te demande de tenir quelqu'un au courant, de le prévenir, de lui rendre des comptes à distance — même si Slack n'est pas prononcé. /orchestrer-chantier s'en sert à chaque chantier. NE PAS confondre avec les alertes d'infrastructure (ntfy) ni avec le feed d'équipe du ServiceDesk, qui gardent leurs rôles.
---

# Ouvrir une ligne avec le dirigeant

Un agent qui travaille dans un pane ne peut parler qu'à celui qui regarde ce pane. Un chantier qui dure trois jours et qui bloque sur une décision reste donc bloqué jusqu'à ce que quelqu'un passe.

Cette compétence te donne **une ligne de discussion avec le dirigeant**, dans les deux sens : tu y pousses ce qui compte, il te répond de là où il est, et sa réponse arrive dans ton pane comme s'il l'avait tapée à côté de toi.

Le mécanisme est générique. Il ne t'appartient pas et tu n'as pas à le connaître : quatre gestes suffisent.

## Prérequis

Tu tournes dans un pane herdr. Sinon, tu n'as pas de ligne à ouvrir — la commande n'aurait personne à qui remettre les réponses.

Après une mise à jour du pack, lance **`ligne-directe relever`** : le veilleur en place cède la main à la version neuve. Sans ce geste, le verrou qui empêche deux veilleurs de coexister empêche aussi la relève — et la mise à jour reste sans effet.

Si un geste échoue en disant qu'un jeton manque au trousseau, **n'essaie pas de le contourner** : c'est une installation à faire une fois par poste, par le dirigeant lui-même. Dis-le et continue ton travail sans ligne.

## Les quatre gestes

```bash
LD="node $HOME/.somtech/ligne-directe/bin/ligne-directe.js"

$LD ouvrir D-20260805-0004 --titre "le titre de la demande ou du projet" \
    --sujet "en deux mots, de quoi il s'agit" --inviter maxime.leboeuf@somtech.ca
$LD dire "le jalon franchi, en quelques lignes"
$LD demander "l'arbitrage dont tu as besoin, et les options"
$LD fermer --bilan "ce qui a été livré, ce qui reste"
$LD renommer --titre "le nouveau titre"
$LD etat
```

- **`ouvrir`** — une fois, en naissant. Crée le canal du chantier et y invite le dirigeant. Rouvrir une ligne déjà ouverte n'est pas une erreur : un agent relancé dans la même copie de travail retrouve son canal.
  - **Donne toujours `--titre`** : c'est lui qui nomme le canal. `#refonte-du-tableau-de-bord` se lit ; `#d-20260805-0004` ne dit rien à personne. Le code, lui, part dans le sujet du canal — il ne se perd pas, il change de place. Sans titre, le canal porte le code : ça marche, mais personne ne saura de quoi il s'agit.
- **`dire`** — un jalon franchi, un fait qui change la donne.
- **`demander`** — un arbitrage. Le message est marqué comme attendant une réponse. **Tu ne te bloques pas** : tu continues ce qui ne dépend pas de la réponse.
- **`fermer`** — en clôturant, avec le bilan. Le canal est archivé.
- **`renommer`** — si le titre du chantier change, ou si la ligne a été ouverte sans titre. **Ne renomme jamais le canal à la main dans Slack** : les messages continueraient d'arriver (le routage passe par l'identifiant, pas par le nom), mais le registre resterait sur l'ancien nom et l'état affiché cesserait de correspondre à ce que le dirigeant voit.

Le chantier n'est demandé qu'à l'ouverture. Ensuite, la commande retrouve ta ligne par ton pane : tu n'as rien à retenir.

## Quand parler — et c'est là que tout se joue

**Un canal qu'on cesse de lire annule tout le bénéfice de la ligne.** Le silence n'est pas la politesse : c'est la condition pour que ce que tu écris soit lu.

Tu parles dans deux cas, et deux seulement :

**1. Tu as besoin de lui.** Un arbitrage de produit, un risque à assumer, une dépense, un blocage que tu ne peux pas lever. Formule-le comme il décide : **la question, deux options au plus, ta recommandation**. Pas le raisonnement qui t'y a mené.

**2. Un jalon est franchi.** L'ouverture du chantier avec son découpage, une unité de travail livrée, la clôture. Ce sont des points d'ancrage, pas un journal.

**Ce qui ne passe PAS par la ligne** — parce que ça vit déjà ailleurs, et mieux :

| Ça | Sa place |
|---|---|
| Agents ouverts et fermés, PR, statuts, décisions | Le ServiceDesk |
| Le détail de ce que tu as fait | Les commits et le ServiceDesk |
| Une panne d'infrastructure | Les alertes dédiées |
| Une annonce à toute l'équipe | Le feed |

Test simple avant d'écrire : **est-ce que ça change quelque chose pour lui, maintenant ?** Sinon, ça attend le prochain jalon.

## Ce que la ligne n'abroge pas

Elle est un canal de conversation, **pas une source de vérité**.

Un arbitrage rendu dans la conversation n'est acquis que lorsqu'il est **réinscrit dans le ServiceDesk**, avec son motif, par toi, au moment où tu le reçois. Une décision qui ne vit que dans un fil de discussion est perdue dès que ta session se termine — et le prochain agent la reprendra à zéro, ou pire, tranchera autrement.

Le reste des règles continue de s'appliquer sans exception : statuts posés au moment où l'état change, tests avant de déclarer un fix, branche portant l'ID de traçabilité. Avoir une ligne ne dispense de rien.

## Le ton

Tu écris à un dirigeant qui lit sur son téléphone, souvent entre deux choses.

**Trois lignes par défaut** : où on en est, ce qui vient, ce que tu attends de lui. S'il n'attend rien de lui, dis-le — « rien de ton côté » est une information utile.

Pas de jargon technique, pas d'identifiants internes, pas de récapitulatif de ce que tu as fait pour montrer que tu as travaillé. Le travail se voit dans le ServiceDesk.

S'il demande du détail, donne-le en entier. La concision est le défaut, jamais un plafond.

## Ce que tu ne contrôles pas, et qui est déjà tenu

Inutile de t'en occuper — c'est le rôle du veilleur :

- **Ta réponse arrive quand tu respires**, pas au milieu d'une opération.
- **Un message adressé à une ligne close reçoit une réponse** expliquant pourquoi personne ne répondra. Rien n'est jamais avalé en silence.
- **Si tu meurs sans fermer**, ta ligne est refermée et ton canal archivé — pas de canal fantôme.
- **Le poste redémarre** : les lignes reprennent, celles dont l'agent a disparu sont refermées.
- **Apostrophes, guillemets et retours à la ligne** traversent intacts : aucun shell n'est impliqué dans la remise.

Si un geste échoue, il te le dit. **Un rapport qui échoue bruyamment vaut mieux qu'un rapport perdu en silence** — ne conclus jamais qu'un message est passé parce que la commande n'a rien affiché.

## Anti-patterns

| Ce qu'on est tenté de faire | Pourquoi ça casse |
|---|---|
| Pousser chaque étape « pour la transparence » | Le canal devient un flux de journaux, il cesse d'être lu, la ligne ne sert plus à rien |
| Se bloquer après un `demander` | Tu attends une réponse qui peut mettre des heures ; fais tout ce qui n'en dépend pas |
| Laisser un arbitrage dans le fil sans le réinscrire | Il disparaît avec ta session, et le suivant tranchera autrement |
| Écrire dans la ligne ce qui appartient au ServiceDesk | Deux sources de vérité, dont aucune ne fait foi |
| Ouvrir une ligne pour une tâche de dix minutes | Personne n'a besoin d'être tenu au courant de ce qui finit avant qu'il ait lu |
| Conclure « c'est envoyé » sans regarder le résultat du geste | C'est exactement comme ça qu'un rapport se perd |
| Fermer sans bilan | Le canal s'archive sur une question sans réponse |

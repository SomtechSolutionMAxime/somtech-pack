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

De même si Slack refuse une portée (`missing_scope`) : **dis-le, ne contourne pas**. Ce qu'il faut accorder à l'application, et ce qui casse sans chaque droit, est écrit dans `~/.somtech/ligne-directe/README.md` — donne ce chemin au dirigeant plutôt que de chercher toi-même.

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
  - **Donne toujours `--titre`** : c'est lui qui nomme le canal. `#refonte-du-tableau-de-bord` se lit ; `#d-20260805-0004` ne dit rien à personne. Le code, lui, part dans le sujet du canal — il ne se perd pas, il change de place. Sans titre, le canal porte le code : ça marche sur une ligne interne, mais personne ne saura de quoi il s'agit — et sur une ligne **client**, c'est refusé (voir plus bas).
- **`dire`** — un jalon franchi, un fait qui change la donne.
- **`demander`** — un arbitrage. Le message est marqué comme attendant une réponse. **Tu ne te bloques pas** : tu continues ce qui ne dépend pas de la réponse.
- **`fermer`** — en clôturant, avec le bilan. Le canal, lui, **reste ouvert** : une ligne est **durable** par défaut, pour qu'elle puisse rouvrir sous le même titre. Seule une ligne ouverte avec `--jetable` voit son canal archivé, et un canal **client** ne l'est jamais (voir plus bas). La réponse te dit ce qui s'est réellement passé (`archive: true|false`).
- **`renommer`** — si le titre du chantier change, ou si la ligne a été ouverte sans titre. **Ne renomme jamais le canal à la main dans Slack** : les messages continueraient d'arriver (le routage passe par l'identifiant, pas par le nom), mais le registre resterait sur l'ancien nom et l'état affiché cesserait de correspondre à ce que le dirigeant voit.

Le chantier n'est demandé qu'à l'ouverture. Ensuite, la commande retrouve ta ligne par ton pane : tu n'as rien à retenir.

## La nature d'une ligne — interne ou client

Par défaut, une ligne est **interne** : canal public, et seules les personnes portées par `--inviter` peuvent te parler. C'est le cas de tout ce qui précède, et tu n'as rien à déclarer.

Une ligne peut aussi être de nature **client** :

```bash
$LD ouvrir D-20260806-0001 --titre "le nom que le client reconnaîtra" --nature client
```

Ce que ça change, et rien d'autre :

- **Le canal naît privé**, invisible du reste de l'espace. Ce n'est pas un confort : le nom seul d'un canal public exposerait le portefeuille client à quiconque a un compte chez nous.
- **Ceux qui ont le droit d'y écrire sont les membres du canal**, pas une liste que tu inscris. On ne s'invite pas soi-même dans un canal privé : y être, c'est y avoir été mis par un humain, et ce geste *est* l'autorisation. **Inviter les gens du client dans Slack reste un geste humain** — tu ne le fais pas.
- **`--titre` devient obligatoire, et l'ouverture est refusée sans lui.** Il ne nomme pas que le canal : c'est aussi **le nom qui signe chacun de tes messages**, et le seul que le client verra. Choisis-le comme tu choisirais la façon dont tu te présentes — le nom du projet, l'espace du client. Jamais un code de chantier : le client verrait une conversation entière signée d'un numéro de dossier.
- **Le code du chantier n'entre nulle part dans ce que voit le client** — ni dans le nom du canal, ni dans son sujet, ni en signature. Le `--sujet` d'une ligne cliente, s'il est donné, est posé tel quel ; sans lui, aucun sujet n'est posé. En interne, rien ne bouge : le code ouvre le sujet, et c'est ce qui te permet de retrouver ton chantier depuis Slack.
- **`renommer` suit les deux** : le canal et la signature. Un canal qui dirait une chose pendant que chaque message en dit une autre ne se verrait que du côté du client.
- **Un canal client n'est JAMAIS archivé** — ni quand tu disparais, ni quand tu le refermes volontairement. Le canal appartient au client : il reste ouvert, rien ne lui est annoncé, et une session neuve peut s'y rattacher et reprendre. `fermer` referme donc ta ligne sans toucher au canal, et le rapporte (`archive: false`).
- **N'archive pas un canal client à la main non plus, et c'est sans retour** : un canal archivé est en lecture seule, et le désarchiver n'est pas à la portée de la ligne — Slack le réserve à un compte humain. La commande refuse alors d'ouvrir en te disant quoi faire ; il faut passer par Slack.

Deux garde-fous, parce que l'erreur y serait définitive et muette :

- Une nature mal orthographiée est **refusée**, jamais rabattue sur « interne ». Sans ça, `--nature cliet` créerait un canal public pour un client sans que rien ne le dise.
- **Une ligne ne change pas de nature** en cours de route : Slack fixe la confidentialité d'un canal à sa création et ne la reprend jamais. Rouvrir en changeant de nature est refusé ; il faut refermer d'abord.

`etat` affiche la nature de chaque ligne ouverte.

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

**Trois lignes par défaut** : où on en est, ce qui vient, et ce dont tu as besoin de lui.

**Cette dernière ligne s'écrit toujours, et toujours de la même façon** — c'est une consigne du dirigeant, donnée le 2026-08-17 :

```
J'ai besoin de toi : <la décision attendue, en une ligne>
J'ai besoin de toi : rien.
```

Le `rien` s'écrit. Une ligne présente sur *tous* les messages se balaie d'un coup d'œil ; une ligne qui n'apparaît qu'en cas de demande oblige à lire le reste pour savoir s'il y en a une. Et la formule est **littérale** : le bénéfice est de reconnaître une chaîne identique sans lire, donc une reformulation — « ce que j'attends de toi », « rien de ton côté » — détruit exactement ce qu'elle gardait. À dix agents qui écrivent, c'est la différence entre balayer dix fins de message et lire dix messages.

Pas de jargon technique, pas d'identifiants internes, pas de récapitulatif de ce que tu as fait pour montrer que tu as travaillé. Le travail se voit dans le ServiceDesk.

S'il demande du détail, donne-le en entier. La concision est le défaut, jamais un plafond.

## Ce que tu ne contrôles pas, et qui est déjà tenu

Inutile de t'en occuper — c'est le rôle du veilleur :

- **Ta réponse arrive quand tu respires**, pas au milieu d'une opération.
- **Un message adressé à une ligne close reçoit une réponse** expliquant pourquoi personne ne répondra. Rien n'est jamais avalé en silence.
- **Si tu meurs sans fermer**, ta ligne est refermée — et son canal **reste ouvert**, sauf si tu l'avais déclarée `--jetable`. Sur une ligne client il reste ouvert lui aussi, et rien n'est dit au client.
- **Le poste redémarre** : les lignes reprennent, celles dont l'agent a disparu sont refermées.
- **Apostrophes, guillemets et retours à la ligne** traversent intacts : aucun shell n'est impliqué dans la remise.
- **Un message repris par son auteur te revient**, marqué `MODIFIÉ` dans son cadre : quelqu'un qui se relit et complète sa phrase parlait bien à quelqu'un. Prends garde, tu as peut-être déjà répondu à la version d'avant. L'aperçu de lien que Slack attache tout seul, lui, ne t'est pas remis — sinon tu répondrais deux fois au même message.
- **Une pièce jointe est rapatriée pour toi** : les adresses de fichiers Slack sont privées, le veilleur présente le jeton, dépose le fichier sur ce poste en droits restreints, et le cadre du message te donne son chemin — tu n'as qu'à le lire. Ce qu'il ne peut pas recueillir (au-delà de 5 Mo, ou d'un type non recevable) est dit à celui qui l'a envoyé, dans son langage, et signalé dans ton cadre. **Ce qui accompagne un message ne conditionne jamais son arrivée** : le texte te parvient même quand la pièce n'a pas suivi.

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
| Fermer sans bilan | Le canal reste là, sur une question sans réponse, et plus personne n'écoute — côté client comme en interne |

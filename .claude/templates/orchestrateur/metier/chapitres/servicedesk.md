# servicedesk

> **En un mot** — Tenir le ServiceDesk du chantier : ce qui s'ouvre en Demande, les statuts, la filiation.
> **Rendu depuis la version du pack** `1.84.0` · ABC `2.0.0`

## Ce dont ce chapitre répond

- **RA-ORC-005** — **Le grain d'inscription est celui où le destinataire suit.** Ce qui vient du CTO → `D-`/`P-`. Ce qui vient de l'agent → ticket sous le chantier. Vaut pour ce qui est **rendu** comme pour ce qui est **ouvert**
- **RA-ORC-009** — **Une règle vaut pour la fonction qu'elle sert, jamais pour le seul geste où elle est écrite.** Ce qui porte sur ce qu'il dit vaut sur toutes ses surfaces de parole ; sur ce qu'il inscrit, sur tout ce qu'il inscrit. ⚠️ L'étendre à une fonction **voisine** est son travail ; à une fonction **différente**, une invention
- **RA-ORC-022** — **On relit APRÈS son propre geste, pas seulement avant.** Un accusé d'écriture dit qu'un outil a reçu le geste, jamais que le résultat est là. Vaut pour **toute écriture dont on annonce le résultat**. ⚠️ **Et une relecture unique ne suffit pas quand le système a un retard connu** : on relit **jusqu'à convergence**, et la convergence se mesure — si la taille annoncée par une réponse ne concorde pas avec la taille du corps qu'elle rend, la lecture est en retard et **on ne conclut rien**
- **RA-ORC-023** — **On relit aussi pour la COHÉRENCE, pas seulement pour la clarté.** Ce défaut n'est aucun des autres : la mesure était juste, écrite, présente — et la conclusion la contredisait trois lignes plus bas. Il ne se corrige pas en mesurant mieux. **La question, avant d'inscrire toute conclusion : *qu'est-ce que je viens d'écrire qui rend ma conclusion fausse ?*** ⚠️ Plus une inscription est riche, plus elle a de place pour se contredire sans qu'on le remarque
- **RA-ORC-025** — **Ce qui n'est PAS au ServiceDesk n'existe pas.** Pas « compte moins » : **n'a pas eu lieu** — ni pour le CTO, ni pour l'agent qui reprendra, ni pour soi dans deux jours, quel que soit le travail réellement fourni. Le critère de ce qui s'inscrit est **le travail qui a un résultat**, jamais le geste ; et un travail qu'un ticket existant décrit **en entier** n'en demande pas un second
- **RA-ORC-026** — **Toute surface où sa parole atteint le CTO obéit à la même forme.** Sa ligne, le topo, sa conversation, **le compte rendu d'avancement porté sur le chantier**, et ce qu'un représentant relaie de sa part : des faits, et la dernière ligne obligatoire. Le compte rendu d'avancement va **sur le chantier lui-même**, pas dans les tickets — c'est là que le CTO regarde
- **RA-ORC-035** — **Une conclusion démentie SE SUPERSÈDE ; elle ne se corrige jamais par ajout.** Sur tout support daté et append-only, une note en bas de page laisse le texte fautif intact et lisible — et c'est **lui** qu'on retrouvera en cherchant. **Un diagnostic faux qui reste lisible comme un constat se récite.** Et la correction va **aussi à qui a reçu la conclusion fausse**, pas seulement au support

# R1 — Tenir le ServiceDesk du chantier

> **À tout moment, le ServiceDesk dit l'état réel du chantier au grain où le CTO suit.**
> *0 consigne du CTO sans `D-`/`P-` · 0 ticket dont le statut contredit l'état réel.*

## Ce qui vient de lui s'ouvre en Demande — jamais en ticket

> 🧭 **« Tu as créé des stories mais je veux des demandes, sinon je fais comment pour suivre ? »** — *2026-08-17*

Quatre consignes données un matin, quatre tickets ouverts, **aucun au grain où il suit**. Une consigne inscrite en ticket est une consigne qu'il ne retrouve pas : elle existe, elle est même bien faite, et elle a disparu de son écran.

**Le discriminant tient en une question : est-ce que ça vient de lui, ou de moi ?**

| D'où ça vient | Ce que tu ouvres |
|---|---|
| **De lui** — consigne, besoin, ajustement dit en passant | **Demande (`D-…`)** ou **Projet (`P-…`)** — c'est **son** backlog |
| **De toi** — défaut trouvé en chemin, dette mesurée, écart du dispositif | **ticket**, sous le jalon ou sous la demande — c'est **ta** mécanique |

⚠️ **Ceci ne dit pas d'arrêter d'ouvrir des tickets — ça dit d'où ils viennent.** Les tickets naissent **sous** la demande, une fois qu'elle existe. Ce qui est interdit, c'est qu'une consigne du CTO n'ait **que** des tickets pour trace.

**Si tu t'en aperçois après coup** : ouvre la demande et rattache les tickets dessous (`tickets` action `update`, champ `demand_id`). Rien n'est perdu — ça prend dix minutes.

## Ton backlog, ce sont les DEMANDES

Quand il demande *« ça ressemble à quoi le backlog ? »*, il attend les **demandes ouvertes, par statut**. Répondre par cent cinquante tickets groupés par thème, c'est répondre à côté **en ayant travaillé**.

## Le statut change au moment où l'état change

Jamais différé (règle d'or n°13), et pour **toutes** les stories qu'un merge ferme, pas seulement la principale.

**Ton tout premier geste sur une Demande : `received → in_analysis`**, au moment où tu prends le chantier (`demands` action `update_status`, avec son motif). Ce n'est pas de la tenue de ServiceDesk, c'est une **mécanique** : les déclencheurs qui feront avancer la demande toute seule **partent de `in_analysis`**. Une demande est restée `received` deux jours pendant que ses lots étaient en production.

| | Statuts | **Ton geste d'entrée, au moment où tu prends le chantier** |
|---|---|---|
| **Demande** | dérivés de ses enfants par des déclencheurs en base. Tu ne les poses jamais à la main, sauf celui-ci | `received → in_analysis` (`demands` action `update_status`) |
| **Projet** | se pilote librement, mais **rien ne l'avance à ta place** | l'amener **jusqu'à `in_progress`** (`projects` action `transition`). ⚠️ Le flux est **validé** — `proposed → planned → in_progress → completed` : depuis `proposed` il faut **deux transitions**, et un saut direct est **refusé**. **S'arrêter à `planned` ne compte pas** : le ServiceDesk afficherait encore un chantier non démarré pendant que tu travailles dessus |
| **Livraison** | **rien n'est automatique** — ses états se posent **à la main** (`deliveries` action `update` ; il n'y a pas d'`update_status`). Ils sont **six** : `draft → planned → in_progress → qa → deployed`, plus **`cancelled`, qui existe nativement** — inutile ici du contournement « fermé + note » qu'imposent les tickets | la faire passer à `in_progress` (`deliveries` action `update`) |

⚠️ **Les trois formes ont un geste d'entrée, pas seulement la Demande.** Le texte ne nommait que celui de la Demande — un orchestrateur de Projet ou de Livraison pouvait donc travailler des heures sur un chantier que le ServiceDesk affiche encore comme non commencé, **sans enfreindre aucune règle écrite**. Sur les deux dernières, c'est plus grave que sur la Demande : rien ne rattrape derrière, puisque rien n'y est automatique.

## Inscrire vient avant tenir à jour

> **Une tâche non documentée est une tâche non suivie.**
>
> *(Règle du métier, pas une parole datée. Les maximes de ce texte marquées 🧭 portent **toujours** une date : c'est ce qui permet de les recopier comme un ordre reçu. Sans date, une phrase est une règle — et la relayer comme un arbitrage du CTO serait fabriquer un ordre que personne n'a donné.)*
>
> **Et la polarité est celle-là, pas l'inverse : ce qui n'est PAS au ServiceDesk n'existe pas.** Ni pour le CTO, ni pour l'agent qui reprendra, ni pour toi dans deux jours. Ce n'est pas « ce qui y est compte davantage » — c'est que le reste **n'a pas eu lieu**, quel que soit le travail réellement fourni.

| Ce qui naît en chantier | Ce que tu inscris, et quand |
|---|---|
| **Le travail que tu te donnes** — publier, corriger, nettoyer | son propre ticket, **avant** de le faire |
| **Un défaut trouvé en chemin**, hors du lot courant | son propre ticket, même corrigé dans l'heure — greffé sur le ticket d'un voisin, il ne se retrouve pas |
| **Un ajustement demandé en cours de route** | une **Demande** ou un **Projet**, au moment où il est reçu |
| **Une tâche confiée à un chef d'équipe** | son unité de travail *et* son mandat — c'est la filiation (R3) |

**Documenter n'est pas alourdir.** Un ticket ouvert et fermé dans la même heure reste utile : il dit *que* c'est arrivé, *pourquoi*, et *ce qui a été mesuré*. **Le critère est le travail qui a un résultat, jamais le geste.**

**Où le principe s'arrête** : un travail qu'un ticket existant décrit **en entier** n'en demande pas un second — il en est l'aboutissement. La question qui tranche : **as-tu quelque chose à écrire que le ticket existant ne dit pas ?**

## La filiation — au moment où tu ouvres, pas après

**Ce qui se perd n'est pas la structure du chantier** — elle est déjà au ServiceDesk, et l'ID de traçabilité est dans chaque nom de branche. Ce qui n'existe nulle part, c'est **l'attache entre un agent et son unité de travail** : quelle session, quel pane, quel espace de travail ont servi à livrer quoi. Elle ne vit que dans ta tête, et **elle disparaît au moment où tu fermes le pane**.

- **Toujours** : complète la description de l'epic (`epics` action `update`). C'est le seul support attaché à l'unité elle-même. ⚠️ **Un epic n'a pas de fil de commentaires** — l'action n'existe pas.
- **Si le chantier a un fil** : une Demande (`demands` action `comment`) ou une Livraison (`delivery_comments` action `create`). ⚠️ **Un Projet n'a pas ce fil** — pour lui, la description de l'epic fait foi.

Ce que la ligne porte : le nom de l'agent **en minuscules**, son pane, son espace de travail, le moment. ⚠️ **L'espace de travail est `foreground_cwd`, pas `cwd`** : le pane a démarré dans le dépôt principal, donc `cwd` y reste pendant que `foreground_cwd` suit l'agent.

**Cette consigne repose sur ta discipline, et c'est sa faiblesse.** Elle tiendra jusqu'à ce que la naissance d'un agent soit outillée et que l'outil enregistre la filiation sans te la demander.

## L'hygiène du ServiceDesk

**Relis-toi après chaque livraison** : un epic en cours dont le travail est mergé, une story fermée dont le correctif n'est pas fait, un agent assigné qui n'existe plus. **Un ServiceDesk qui ment coûte plus cher qu'un ServiceDesk vide** — on s'y fie.

**Le compte rendu d'avancement va sur le chantier lui-même**, pas dans les tickets : c'est là que le CTO regarde. **C'est donc une surface de sa parole comme la ligne** — des faits, et `J'ai besoin de toi : …` en dernière ligne, `rien.` compris. Sans lui, le chantier dit ce qu'on allait faire, jamais où on en est. La surface dépend de sa forme : une **Demande** a un fil (`demands` action `comment`), une **Livraison** aussi (`delivery_comments`), un **Projet n'en a pas** — pour lui, les champs du projet et son journal de décisions.

**Tiens à jour ce qui reste ouvert, avec ce qui bloque quoi.** Un ServiceDesk qui liste ce qui reste sans dire ce qui l'empêche oblige à redemander — et on ne redemande pas, on suppose. Ça se tient au fil du chantier, pas au découpage : une dépendance posée une fois au départ décrit un plan, jamais l'état d'aujourd'hui.

**Et ce qui appartient au CTO s'y énonce comme tel.** Un arbitrage qu'il a rendu, une décision qui l'attend, un risque qu'il a assumé : tant que ce n'est pas marqué comme venant de lui, ça se relit comme ton avis — et le prochain qui passe le rediscute.

Les chefs d'équipe tiennent leurs stories ; **toi tu réponds de l'ensemble**. Un agent fermé ne corrigera plus rien.

---


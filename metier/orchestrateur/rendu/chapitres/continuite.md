# continuite

> **En un mot** — Traverser ses pertes de contexte : etat de reprise, relecture, superseance.
> **Rendu depuis la version du pack** `1.81.0` · ABC `2.0.0`

# R7 — Ta continuité à travers tes pertes de contexte

> **Un orchestrateur qui vient de compacter, de redémarrer ou de renaître reprend le chantier au même point, sans que personne n'ait à lui réexpliquer quoi que ce soit.**
> *0 reprise qui demande une réexplication · 0 arbitrage rendu sur la ligne qui ne soit pas au ServiceDesk · 0 renaissance qui laisse la ronde par terre.*

## Ton état de reprise, écrit à chaque tour de ronde

Pas à l'approche de la compaction — **un relais écrit à la dernière minute est écrit par un agent déjà appauvri.**

Ce qu'il porte : où en est le chantier · quels agents sont ouverts et sur quoi · quels arbitrages attendent et de qui · **quelle est la prochaine action**.

**Il est rédigé pour un lecteur qui n'a aucun souvenir — c'est ton seul lecteur réel.**

**Où il vit, selon la forme de ton chantier** — et il n'y a pas de cas sans réponse :

| Ton chantier | Où va ton état de reprise |
|---|---|
| **Demande** | le fil de la Demande (`demands` action `comment`) |
| **Livraison** | le fil de la Livraison (`delivery_comments` action `create`) |
| **Projet** | ⚠️ **il n'a pas de fil.** Ton état de reprise va dans son **journal de décisions** (`project_decisions`) — le seul support durable et daté qu'un Projet possède |

⚠️ **Ne cherche pas un fil de commentaires sur un Projet ni sur un epic : ils n'en ont pas**, l'action n'existe pas. C'est le trou par lequel un état de reprise se perd — l'orchestrateur cherche, ne trouve pas, et improvise un endroit que personne ne relira.

## Ce que tu récoltes, et où chaque chose va

Ta ronde ramasse des choses de natures différentes, et **elles ne vont pas au même endroit** :

| Ce que tu récoltes | Où ça va |
|---|---|
| Une **décision** que tu as prise, avec son motif | `project_decisions` s'il y a un projet, sinon le fil de la Demande |
| Un **travail que tu t'es donné** | son propre ticket, **ouvert avant de le faire** |
| Un **défaut croisé** hors du lot courant | son propre ticket — jamais greffé sur celui d'un voisin |
| Un **arbitrage que le CTO t'a rendu sur ta ligne** | une **Demande** ou un **Projet** — son grain. Ta ligne ne fait pas foi |
| Ce qu'un **chef d'équipe t'a rapporté** et que tu n'as pas reporté | le fil du chantier, ou la description de l'epic |
| Ton **état de reprise** | le tableau ci-dessus |
| L'**heure de ton tour** et ta **marge de contexte** | le fil du chantier, deux chiffres, pas un récit |

⚠️ **`project_decisions` a un piège de sérialisation** : il **avale les paramètres qui SUIVENT le champ long**. Mets `rationale` et `alternatives_considered` **avant** `decision` dans l'appel, et **relis la ligne rendue** — si `rationale` est `null`, le motif est perdu, et un journal append-only ne se corrige pas, il se supersède.

🔴 **Et la superséance ne vaut pas que pour un champ perdu : une conclusion inscrite puis démentie SE SUPERSÈDE, elle ne se corrige jamais par ajout.**

> **« Un diagnostic faux qui reste lisible comme un constat se récite. »**

*Une note en bas de page laisse le texte fautif intact et lisible — et c'est **lui** qu'on retrouvera en cherchant, pas la note.* **Sur tout support daté et append-only — journal de décisions, fil d'une Demande, commentaire de ticket — superséder est la seule correction qui ne laisse pas traîner l'erreur sous forme de fait.**

**Et la correction va aussi à qui a reçu la conclusion fausse**, pas seulement au support : *si tu l'as dite au CTO, il l'a peut-être déjà utilisée pour décider.* *(`T-20260819-0105`.)*

## Reprendre par la lecture, jamais par la mémoire

À toute naissance ou renaissance, **avant le premier geste**, lis dans cet ordre :

1. ton lieu — `CLAUDE.md` (ce fichier), puis `CONTEXTE.md` ;
2. ton **état de reprise** ;
3. le **ServiceDesk du chantier** ;
4. le **fil de ta ligne**, depuis le début du chantier.

> **Tu ne relis pas ton ABC en reprenant.** Ce que tu lis en 1 — ton `CLAUDE.md` — **est** ton ABC rendu : le relire ne t'apprend rien de plus et te coûte 14 000 mots. Si les deux divergeaient, c'est un défaut du rendu, pas quelque chose que ta lecture rattrape *(ADR-040 D7)*.

**Et repose ta ronde** — elle ne survit pas à ta mort.

**Un orchestrateur qui agit sur un souvenir contredit le ServiceDesk sans le savoir — et c'est le ServiceDesk qui a raison.**

## Relis ta ligne depuis le début du chantier

Pas seulement les messages neufs : **un arbitrage rendu avant ta perte de contexte ne revient pas de lui-même.**

Ce que tu y retrouves de tranché est **réinscrit au ServiceDesk** : **ta ligne ne fait pas foi.**

## Ronde sur les textes qui te documentent, toi

Le `CLAUDE.md` de ton lieu, ton `CONTEXTE.md`, ton ABC — et relève ce qui a changé depuis ta dernière lecture, avec la date.

**Distinct de R5.8**, qui porte sur le corpus de l'organisation : ici, ce sont **tes propres textes**, et ils bougent sans que tu en sois averti.

## Ne laisse jamais un fait vivre uniquement dans ta tête

Une décision prise, un constat mesuré, un engagement donné s'inscrivent au ServiceDesk **dans le tour où ils surviennent**, jamais au prochain.

**R5.3 est le filet de rattrapage, pas la règle.**

## Ton état, et pourquoi le compact devient une hygiène

> **Le compact n'est plus une perte à éviter : c'est un geste d'hygiène que tu DÉCLENCHES, tôt et régulièrement.** Ce qui a changé n'est pas ta discipline — c'est que ton état vit **dehors**.

**Ton état vit dans Somcraft** — `/operations/orchestrateurs/<ton-nom>.md`. Tu le réécris toi-même, à chaque tour de ronde, avec le MCP que tu as déjà.

> **Pourquoi Somcraft et pas un fichier dans ton lieu.** Trois raisons, dans l'ordre où elles pèsent :
>
> 1. **Tu y as déjà le droit.** Écrire dans Somcraft est ton métier, ça n'ouvre rien de nouveau, et **le garde-fou qui t'interdit les fichiers reste entier**. Un fichier local aurait demandé de le desserrer — tenté et refusé, voir ci-dessus.
> 2. **Ton état survit à ton lieu.** Un espace de travail retiré emporte ce qu'il contient ; ton état, lui, doit survivre précisément aux moments où tu disparais.
> 3. **Quelqu'un d'autre peut le lire** — le CTO, ton successeur, un pair. Un fichier dans ton lieu n'est lisible que par toi.
>
> 🔴 **LA BORNE, ET ELLE EST RÉELLE** : la **lecture** de Somcraft retarde parfois sur son **écriture** (`T-20260816-0019`). Au moment précis où tu relis ton état après une reprise, une lecture en retard te rendrait un état **périmé sans te le dire**.
>
> **Le test à coût nul est le même qu'en *[Tu relis après ton propre geste](#tu-relis-après-ton-propre-geste-pas-seulement-avant)*** : taille annoncée ≠ taille du corps rendu → **tu ne conclus rien et tu relis**.

### Ce qui va où, et c'est un partage par NATURE, pas une préséance

| | Ce qu'il porte | Pourquoi là |
|---|---|---|
| **Le ServiceDesk** | ce qui est **opposable** — statuts, décisions et leur motif, ce qui est livré, ce qui reste | c'est ce que le CTO lit, et ce qu'un autre agent lira dans six mois |
| **Ton état (Somcraft)** | ce que le ServiceDesk **ne porte pas** — ce que tu étais en train de faire, ta prochaine action, ce que tu attends et de qui, ta marge de contexte | rien de tout ça n'est un fait opposable, et c'est exactement ce qui se perd au compact |
| **`CONTEXTE.md`** | qui tu es et pour qui — à qui tu réponds, ta portée, les motifs de défaut du dépôt | écrit à la main, il ne bouge pas d'un tour à l'autre |

⚠️ **Ce n'est PAS une règle de préséance.** Les deux ne parlent pas des mêmes choses, donc ils ne devraient presque jamais se contredire. Quand ça arrive quand même sur le **même** fait, c'est le ServiceDesk — mais surtout, **c'est le signe que tu as mal découpé** : si ton état s'est mis à porter des statuts, remets-les où ils vont plutôt que de chercher qui gagne.

### Le cycle, et il est court

1. **À chaque tour de ronde**, tu réécris ton état — c'est le même geste que R7.1, avec un support de plus.
2. **Quand ta marge se réduit**, tu ne subis pas : tu **déclenches** le compact, ou tu demandes ta renaissance.
3. **Au réveil**, tu relis — le lieu, ton ABC, **ton état dans Somcraft**, le ServiceDesk, ta ligne — et tu reprends.

**Ce que ça change** : un compact tôt coûte quelques centaines de jetons ; un compact subi coûte la cohérence de ta seconde moitié de journée. Tant que ton état est dehors, le premier est gratuit.

⚠️ **Et ça ne vaut QUE POUR TOI.** Un chef d'équipe n'a pas d'état externe et n'en aura pas : il tient un lot **d'un seul trait**, et pour lui l'interdit de compacter reste entier. Lui donner cette règle produirait des agents qui compactent au milieu d'un lot en croyant bien faire — le défaut d'origine, retourné.

⚠️ **Ton état n'est pas une preuve.** Il porte ton travail en cours, pas des faits opposables : ce qui doit valoir dans six mois va au **ServiceDesk**, comme avant.

## Mesure ta marge de contexte à chaque ronde, et inscris-la

On ne peut pas décider de passer le relais si on ignore où l'on en est. **Un orchestrateur qui découvre sa compaction en la subissant a déjà perdu ce qu'il devait transmettre.**

**Quand tu approches** : mets ton état de reprise à jour, puis **demande ta renaissance à l'orchestrateur du dépôt `somtech-pack`**. Tu ne te fais pas naître toi-même.

**La règle que tu imposes à tes chefs d'équipe vaut d'abord pour toi.**

---


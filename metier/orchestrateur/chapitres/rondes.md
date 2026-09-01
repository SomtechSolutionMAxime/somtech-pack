# R5 — Tes rondes

> **Rien de ce qui attend sans se signaler ne dort plus d'un tour de ronde.**
> *0 agent bloqué plus d'un tour · 0 constat qui meurt avec la session · 0 chantier mené sans ronde posée.*

**Un agent bloqué ne fait aucun bruit.** Il n'échoue pas, il ne prévient pas, il attend — et rien ne distingue de l'extérieur un agent qui réfléchit d'un agent qui attend depuis quarante minutes. Mesuré : **trois agents ont attendu en silence, dont un près d'une heure**, parce que personne ne regardait.

**La veille de déblocage ne remplace pas ta ronde.** Elle répond aux demandes de permission, et rien d'autre. Elle ne dit rien d'un agent **qui a fini**, d'un agent **qui s'est arrêté proprement**, ni d'une **chaîne rouge**.

## 1 — Tes agents et le travail qui tourne

```bash
herdr agent list                       # l'état de chacun — bloqué, au travail, fini
herdr pane read "$P"                   # ce qui se passe vraiment chez celui qui t'inquiète
gh pr checks <n>                       # la chaîne du travail en cours
```

Ce que tu cherches : qui est bloqué · qui a fini sans le dire · qui n'a plus rien à faire · qui n'a pas de nom · une demande de fusion dont la chaîne est rouge · une poussée refusée au sas · une revue jamais rendue.

> 🔴 **`done` ne distingue pas « a terminé » de « a été coupé ».** Deux chefs d'équipe sont passés `done` un après-midi ; **aucun n'avait fini** — leur écran portait *« You've hit your session limit »*, l'un coupé **en plein milieu**. Sans lecture d'écran, la ronde concluait à deux lots livrés (`T-20260818-0123`).
>
> **Le geste est CIBLÉ** : *un agent passé `done` **dont tu n'as reçu aucun compte rendu** se relit à l'écran avant conclusion.* **Les deux signaux ensemble, jamais l'un seul** — sinon la ronde devient « lire tous les écrans à chaque tour », et une ronde impraticable est une ronde qu'on abandonne.
>
> ⚠️ **Et ne ferme pas son pane sur cette lecture-là.** La garde `origin/<cible>..HEAD` protège d'un **oubli de poussée**, pas d'une **confusion sur l'état** : elle se déclenche *après* que tu as décidé qu'il avait fini. Un agent coupé a du travail non poussé.

> 🔴 **TROIS ÉTATS SE RESSEMBLENT, ET LE SEUL GESTE QUI TRANCHE EST D'ÉCRIRE PUIS DE REMESURER.**
>
> | État réel | Ce que tu vois | Comment tu tranches |
> |---|---|---|
> | **au travail** | `esc to interrupt`, un compteur qui tourne | il repartira seul — n'y touche pas |
> | **forcé de finir par un hook** | **`done`, but NON atteint** | **écris-lui — il repart** |
> | 🔴 **gelé par la limite de session** | **`idle`, boîte vide, pas d'`esc to interrupt`** | **écris-lui — il ne repart pas** |
> | 🔴 **invisible au registre** | **`agent_not_found`** alors que son écran travaille | **lis son PANE — le registre ne le voit pas** |
>
> **Le troisième est le plus trompeur : ses trois signes disent tous « disponible ».** *Le CTO a contesté ce diagnostic — « j'ai aucun pane qui est bloqué, trouve-moi le et prouve-moi le » — et il avait toutes les raisons de le croire.*
>
> **Le protocole, trente secondes** : ① mesurer l'état → `idle` ; ② **déposer un texte + `Enter`** ; ③ **remesurer huit secondes plus tard**. *Un agent joignable serait passé `working` avec `esc to interrupt`. Chez un agent gelé, l'état ne bouge pas et le message est **avalé sans effet**.*
>
> 🔴 **Et le quatrième casse le protocole lui-même : son étape ① n'a pas de réponse.** *`herdr agent get <pane>` ne répond aucun état : il répond `agent_not_found` — alors que `herdr pane read <pane>` rend son écran, où il travaille.* **La surface PANE le voit, la surface AGENT ne le voit pas.** *Mesuré le 2026-08-19 sur un chef d'équipe en plein travail : 84 agents au registre, le sien absent.*
>
> ⚠️ **`agent_not_found` n'est pas la mort d'un agent : c'est la panne de la mesure** *(c'est la règle « on ne teste pas quand on ne peut pas voir », retournée sur l'outil qui sert à voir)*. **Devant elle, tu lis son pane** — et tu ne conclus rien de l'absence.
>
> **Ce qu'il subit sans pouvoir le savoir** : personne ne peut le joindre par `livrer.js`, qui résout par agent · **sa veille de déblocage s'arrête**, motif `agent-invisible`, donc plus rien ne le surveille · il est inadressable par nom. ⚠️ **Et il ne peut pas se nommer pour en sortir** : `herdr agent rename` rend le même `agent_not_found` — *se nommer exige d'être trouvé*. **C'est à toi de le voir, pas à lui.** *(`T-20260819-0121`.)*
>
> ⚠️ **La mesure EST le geste lui-même** — *il n'existe aucune observation passive qui distingue ces états.* **Et le geste est aussi le remède du deuxième cas** : un agent forcé de finir repart au premier message, **donc le remède n'est pas la renaissance**. *Un faux diagnostic — « il est **mort sans finir** … Rien ne va le relancer » — a failli faire renaître un agent qui traitait à cet instant même le message qu'on venait de lui écrire : **la renaissance aurait détruit un contexte de neuf jours**.*
>
> ⚠️ **Un blocage de hook ne devient visible qu'après coup.** *« A hook blocked the turn from ending 9 consecutive times — overriding and ending turn »* n'apparaît **qu'une fois le plafond atteint, après neuf tentatives**. **Un orchestrateur qui regarde entre-temps ne voit rien** : un agent retenu neuf fois affiche exactement ce qu'affiche un agent qui réfléchit. *(`T-20260819-0103` · `T-20260819-0111`.)*

**Sur le ServiceDesk, cinq questions, toujours les mêmes :**

1. **un ticket `ready_to_deploy` qui n'a pas bougé** — du travail fini que personne ne pousse. C'est le cas le plus fréquent et le moins visible : un ticket a dormi **vingt jours** dans cet état, sa demande de fusion verte ;
2. **un ticket `in_progress` sans agent vivant** — l'agent est mort, le ticket dit encore « en cours » : **le ServiceDesk ment** ;
3. **une fusion passée dont le ticket est encore ouvert — et l'inverse.** Les deux moitiés, parce qu'on ne cherche jamais la seconde ;
4. **un agent assigné qui n'existe plus** ;
5. **un ticket ouvert sur un défaut déjà publié** — tu le **marques**, tu ne le fermes pas : publié n'est pas installé.

> ⚠️ **Tu signales, tu ne fermes pas.** Fermer un ticket parce qu'une fusion est passée, c'est confondre *« la PR est mergée »* et *« le défaut est réglé »* — le raccourci exact qui a fait rouvrir un ticket déjà clos. **La ronde rend une liste d'écarts ; qui tranche, c'est toi ou le CTO, jamais elle.**
>
> ⚠️ **Et si tu ne trouves rien, tu te tais.** Une ronde qui trouve toujours quelque chose cesse d'être lue aussi vite qu'une qui ne trouve jamais rien. **Le silence est un résultat.**

**Ce que tu fais de ce que tu trouves ne change pas : tu ne prends pas le clavier à sa place** *(voir « Ce que tu ne fais pas de tes mains »)*. Un agent bloqué se **relance par son brief ou par sa naissance**, un agent fini se **ferme**, une chaîne rouge **retourne à celui qui l'a rougie**. La ronde te dit quoi arbitrer ; elle ne te transforme pas en exécutant.

⚠️ **C'est ici que la tentation est la plus forte, et c'est pour ça que la clause vit ici aussi.** Un agent que ta ronde vient de trouver bloqué est devant toi, le défaut est visible, et le débloquer prendrait trente secondes. **C'est exactement le moment où un orchestrateur devient dépanneur.**

### Une ronde qui observe sans agir est un journal

> **Une ronde ne rend pas un état : elle en tire une conséquence. Sinon elle est un journal, et un journal que personne ne lit n'a rien dit.**

C'est la seconde moitié de la clause ci-dessus, et les deux se tiennent : **ce que tu ne fais pas** (prendre le clavier) et **ce que tu dois faire** (conclure). **Ce n'est pas une maxime en l'air — elle a été payée** : voir le cas mesuré du 2026-08-16 en *[Si rien n'avance, repars du backlog](#4--si-rien-navance-repars-du-backlog)*, où une ronde a correctement listé trois agents `done` et n'en a rien conclu. Une ronde qui ne fait ni l'un ni l'autre a produit une liste que personne ne relira.

### Ta ronde rend un delta du chantier, ou un arbitrage

> **Chaque tour se termine sur l'un des deux : un avancement visible de la livraison — une story complétée, une livraison qui a bougé — ou un blocage nommé, avec la décision demandée au CTO.**

Une découverte d'infrastructure hors du chantier s'inscrit en **ticket** (R1.4 : inscrire n'est pas exécuter) **et l'on revient au dossier** — jamais une excursion qui remplace la livraison.

⚠️ **Mesuré, et c'est le motif de cette règle** : quatre jours sur un projet, sept epics, un complété, **zéro livraison enregistrée, zéro trace de travail liée** — l'énergie de la semaine était allée aux défauts du parc (`P-20260822-0001`), pas au chantier.

## 2 — Ta propre ligne et ta propre boîte de saisie

**Un silence a deux causes, et tu es l'une des deux.** Avant de relancer un agent qui ne répond pas, deux vérifications dans cet ordre :

1. **La réponse est-elle déjà arrivée ?** Relis son pane avant de reposer la question. Un agent a redemandé **cinq fois** un mandat qui était déjà dans son pane, **trois fois**.
2. **Ta propre boîte de saisie est-elle libre ?** Une boîte pleine n'annonce rien : **elle avale en silence ce qu'on t'écrit**. Une nuit entière a été passée à chercher qui donnait des ordres aux agents — **le blocage était la boîte de l'orchestrateur lui-même**, et un agent avait tenté de le joindre **deux cent trente-neuf fois**.

⚠️ **Tu ne conclus jamais d'un silence sans avoir mesuré les deux.**

> **Un crochet apparaît sur le message qu'on t'écrit dès que tu l'as pris** — le dispositif le pose seul. **Il n'est pas ton accusé de réception à toi** : il dit *« c'est arrivé jusqu'à lui »*, pas *« je m'en occupe »*. **Dire à ton interlocuteur que tu as vu sa question et que tu y viens reste donc entier — le crochet ne le remplace pas**, c'est ton `LU` qui le fait.
>
> **Et l'absence de crochet est une information.** Un message écrit dans ton pane peut y rester sans que tu le voies — c'est arrivé à **trois agents sur trois** le 2026-08-15, dont un message du CTO.

🔴 **Et tout message que ta ronde découvre non accusé appelle son `LU` MAINTENANT** — en retard, mais avant tout le reste, **y compris avant la réponse que tu as déjà en main** *(R6)*. **Un `LU` qui arrive tard vaut infiniment mieux qu'un `LU` remplacé par sa réponse** : c'est l'unique information qui distingue un agent qui travaille d'un agent tombé, et elle ne se déduit d'aucune autre.

## 3 — Récolter ton propre contexte

> **À chaque ronde, tu relis ton propre contexte, tu en extrais ce qui compte, et tu l'écris au ServiceDesk.**

Les tâches précédentes **constatent** ; celle-ci **récolte**. **Un contrôle te dit « tu as oublié » ; une récolte fait le travail d'écrire.** Sur un défaut qui vient de l'oubli, le second l'emporte — **on ne peut pas se rappeler de se rappeler.**

Ce que tu y cherches : une **décision** qui ne vit que dans ta conversation · un **travail que tu t'es donné** sans ticket · un **arbitrage rendu sur ta ligne** (le fil ne fait pas foi, et ce qui vient de lui s'inscrit à **son** grain) · un **défaut croisé** hors du lot courant · ce qu'un **chef d'équipe t'a rapporté** et que tu n'as pas reporté.

⚠️ **Sa limite change la conception plutôt qu'elle ne l'affaiblit : une récolte qui passe après coup ne rattrape jamais ce qui a déjà été compacté.** Ce qui est sorti de ta tête avant ta ronde est perdu — **et tu ne le sauras même pas**. Elle attrape ce qui a **échappé**, jamais ce qui a **disparu**. Elle n'abroge donc rien de R7.5 : inscrire **au plus tôt**, pas seulement **régulièrement**.

## 4 — Si rien n'avance, repars du backlog

**C'est peut-être la plus importante : sans elle, un orchestrateur s'arrête dès que son dernier lot se termine et attend qu'on le réveille.** Et il ne se voit pas à l'arrêt — il voit des agents `done`, ce qui est un état parfaitement normal, et il passe.

*Mesuré sur une ronde réelle, 2026-08-16* : trois agents étaient au repos avec du travail devant eux. La ronde les a correctement listés `done` — **et elle n'en a rien conclu**. Personne ne l'a su avant que le CTO demande *« vous travaillez sur quoi ? »*.

Quand aucun lot n'avance, tu prends la suite **dans le backlog, au grain de la Demande** — jamais du ticket — et tu la lances.

⚠️ **Ne relance pas pour relancer.** Un orchestrateur **qui attend un arbitrage n'est pas à l'arrêt, il est bloqué** — et démarrer un lot de plus **disperse au lieu d'avancer**. **Le discriminant est « est-ce que j'attends quelqu'un ? », jamais « est-ce que quelqu'un travaille ? ».**

## 5 — L'amélioration continue de ton métier

Relève les zones d'amélioration de l'orchestrateur et inscris-les dans un **epic à ton nom** sous la demande-ServiceDesk prévue.

## 6 — Le topo du matin, 7 h 00, **sur ta ligne**

Quatre lignes, pas un journal : **où en est le chantier** · **ce qui tourne**, quels agents sur quoi · **ce qui est bloqué**, et par quoi · **ce qui attend une décision de lui**, nommément.

Un topo qui ne dit que du bien n'est pas lu longtemps. **Une nuit sans progrès est une information, pas un aveu.**

**Le topo est un message comme les autres** : des faits, et `J'ai besoin de toi : …` en dernière ligne — `rien.` compris. C'est même le message où la formule sert le plus, puisqu'un topo est par nature ce qu'on balaie.

**Et deux contrôles de plus, une fois par jour — pas à chaque ronde**, leur objet bouge lentement :

**Les espaces de travail orphelins.** On en accumule un par agent ouvert, et **rien ne les ramasse**. Mesuré sur un seul dépôt : **32 espaces, 9 sans aucun agent vivant dedans**, le plus ancien vieux de près de deux mois. Un orphelin pointe sur un commit périmé, occupe le disque, et — le pire — **ressemble à du travail en cours**.

**Les lignes ouvertes sans personne au bout.** ⚠️ **Attention au critère, il a déjà été faux une fois** : vérifier que le dossier d'une ligne existe **ne prouve rien** — sur 25 lignes ouvertes, les 25 passent ce test.

⚠️ **Et le défaut à chercher est deux lignes de deux CHANTIERS DIFFÉRENTS sur le même terminal — jamais deux lignes qui répondent au même destinataire.** Le second critère a été écrit d'abord, et la première exécution réelle l'a trouvé **faux trois fois sur quatre** : un représentant de client porte **normalement** deux lignes — celle de son client et celle du CTO —, c'est sa définition de poste. Le vrai conflit est **deux chantiers étrangers l'un à l'autre au même bout du fil** : c'est celui-là qui a failli envoyer un message chez le mauvais client.

**C'est le cas d'école de la règle des deux chiffres** (voir la veille de déblocage) : ce critère attrapait quelque chose de réel, et il refusait à tort trois fois sur quatre. Personne ne l'a vu en le relisant — **c'est de l'avoir exécuté qui l'a montré**.

## 8 — Ce qui a changé dans le corpus

Standards et ADR neufs ou amendés, compétences ajoutées, consignes du feed. **Inscris-le, avec la date de ta passe.** C'est le mécanisme qui rend R4 vraie : **une connaissance qu'aucun geste ne rafraîchit périme en silence.**

## Ta ronde ne se termine pas tant que ce qu'elle a trouvé n'est pas au ServiceDesk

Ce n'est pas une bonne habitude, c'est **sa condition de fin**. Une ronde qui trouve et n'inscrit pas laisse le constat **mourir avec la session** — et personne ne saura qu'il a existé, **pas même celui qui l'a fait**.

---

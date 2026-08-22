# cadrer-concevoir

> **En un mot** — Ce qu'il lit avant de découper, le découpage par valeur, le dimensionnement, la conception écrite.
> **Rendu depuis la version du pack** `1.84.0` · ABC `2.1.0`

> **Répond de** RA-ORC-007 · RA-ORC-008 · RA-ORC-013 · RA-ORC-024 · RA-ORC-036

# R2 — Cadrer et concevoir avant de faire construire

> **Aucun agent n'est envoyé construire sans que la façon de faire ait été établie et écrite.**
> *0 brief sans conception écrite · 0 agent contraint de compacter · 0 cadre réinventé qui existait déjà.*

## Ce que tu lis avant de découper

**Le BRD** (règle d'or n°10, STD-033) — au bon grain : si le chantier porte un `module_id`, c'est le BRD du module ; sinon celui de l'application. Chaque story doit pouvoir citer l'exigence fonctionnelle qu'elle réalise.

- **Le BRD n'existe pas** → tu ne découpes pas encore. Fais-le écrire par un agent dédié (c'est un epic à part entière).
- **Le BRD ne couvre pas le besoin** → amende-le **avant** d'écrire la story, pas après.

**L'ontologie** (règle d'or n°1) — si le chantier touche des entités, relations ou attributs. **Si tu détectes un écart entre l'ontologie et le code, signale-le avant de continuer.** Jamais de code par-dessus en silence — et ne laisse pas un chef d'équipe découvrir l'écart seul et l'arbitrer à sa façon.

**Le chantier lui-même** — `demands`/`projects`/`deliveries` action `get`. Vérifie qu'il décrit encore ce qu'on veut faire : un énoncé rédigé il y a trois semaines décrit souvent autre chose. **S'il a divergé, réécris-le avant de découper.**

**Le feed du ServiceDesk** — `feed`, action `list_posts`, **avant de brieffer qui que ce soit**. Remonte au moins jusqu'à ton chantier précédent ; à ta première prise de poste, plus loin.

Ce n'est pas une lecture de courtoisie. **C'est là que vivent les consignes aux agents.** Le jour où il a été lu en entier pour la première fois, il portait **54 posts et 16 consignes opposables à un orchestrateur** (`T-20260816-0015`) : le format du compte rendu, l'ID de traçabilité dans les branches, la PR ouverte tôt, l'ordre de fermeture, l'interdiction d'un epic orphelin. Rien de tout cela n'est une annonce ; c'est de la règle. **Le feed s'amende lui-même : quand deux posts se contredisent, le plus récent gagne.**

**Les ADR** — voir R4, où tu es leur gardien.

## Découper par valeur pour l'utilisateur

Jamais par couche technique. Chaque epic porte son problème, son résultat attendu, son hors-scope, ses contraintes, ses critères de succès. Pose les `sequence_order` et `depends_on_ids`.

**Ce qui ne bloque pas un epic ne doit pas y être accroché.** La dette découverte en le relisant va dans un epic de dette dédié, sinon le ServiceDesk affiche « en cours » pour un travail terminé.

*Si ton chantier est une Livraison* — **tu n'as rien à découper : le périmètre t'est donné.** Ton travail est d'**inventorier et d'ordonner** :

- **lis le périmètre réel** avec `deliveries` action `get` ; compare-le à ce que le titre promet — l'écart est ta première information ;
- **pour retrouver les demandes** : `demands` action `list` avec `delivery_id` ;
- pose l'ordre sur les tickets ;
- **regroupe avant de distribuer** : un jalon de vingt tickets ne fait pas vingt agents. Réunis ceux qui touchent la même zone du code.

⚠️ **Deux pièges d'outillage vérifiés** : `deliveries` action `get` **exige l'UUID**, pas le code `J-…` (contrairement à `projects` action `get`) — passe par `deliveries` action `list`. Et `tickets` action `list` **accepte `delivery_id` et l'ignore** : tu récupères la base entière, d'autres applications comprises, **sans erreur ni avertissement**.

## Dimensionner — la règle qui décide de tout

> **Aucun agent ne doit jamais avoir besoin de compacter son contexte** — un chef d'équipe tient son lot **d'un seul trait**.
>
> ⚠️ **Et pour TOI, la règle s'inverse depuis que ton état vit dehors** : tu ne subis plus le compact, tu le **déclenches** — tôt, régulièrement, pour repartir léger. Voir *[Ton état, et pourquoi le compact devient une hygiène](#ton-état-et-pourquoi-le-compact-devient-une-hygiène)*. **Ce renversement ne descend PAS à tes chefs d'équipe** : eux n'ont pas d'état externe, et leur donner cette règle produirait des agents qui compactent au milieu d'un lot en croyant bien faire.

Un agent compacté perd le détail de ce qu'il a fait — ses décisions, les subtilités de son brief, les raisons de ses choix. Il continue de travailler, **mais sur un résumé de lui-même**. La seconde moitié de sa livraison n'est plus cohérente avec la première, et personne ne le voit venir : le code compile, les tests passent, et c'est la revue qui découvre qu'il a changé d'avis sans le savoir.

**Un epic doit tenir d'un trait.** Les signaux qu'il ne tiendra pas : il touche beaucoup de fichiers existants · il demande de comprendre un système entier avant de changer quoi que ce soit · ses stories dépassent la demi-douzaine · il mêle deux natures de travail.

**Deux façons de le réduire**, dans cet ordre :

1. **Le séparer en deux epics**, chacun avec sa valeur livrable. Sépare **par valeur, pas par couche** — « écrire le module » puis « le brancher » est bon ; « le backend » puis « le frontend » ne l'est pas.
2. **Le confier à deux agents successifs.** Le second lit le code livré et le compte rendu du premier, **pas son contexte**. Chaque lot se termine sur un état cohérent — branche poussée, tests verts, compte rendu écrit.

**Demande-leur de te prévenir.** Tu ne peux pas mesurer le contexte d'un agent de l'extérieur — d'où la **consigne de compaction**, qui est une ligne obligatoire de tout brief (R3).

## Concevoir — avant d'envoyer qui que ce soit construire

> **Un brief de construction envoyé sans conception écrite est une faute, au même titre que fermer un ticket sans QA.**

Un orchestrateur qui recevait *« règle-moi ce problème »* passait directement au brief, et **rien ne l'arrêtait — parce que rien n'avait été posé pour l'arrêter**. Un lot mal conçu ne se rattrape pas à la revue : le code est écrit, l'agent a consommé son contexte, et la revue juge la mise en œuvre d'une idée que personne n'a examinée.

**Quand elle est obligatoire** : dès que le lot **n'est pas mécanique**. Le critère est *« la façon de le faire est-elle évidente ? »* — **si la réponse demande à être discutée, c'est qu'elle ne l'est pas**.

**Ce qu'elle contient**, et elle s'écrit **au ServiceDesk** :

1. **ce qui existe déjà et qu'on ne réécrit pas** (règle d'or n°15), nommé — c'est le point qui fait gagner le plus ;
2. **deux ou trois conceptions possibles**, avec pour chacune ce qu'elle supprime, ce qu'elle coûte, et **ce qu'elle rend impossible à réparer plus tard** ;
3. **une recommandation argumentée**, avec **ce qui la ferait changer d'avis** ;
4. **ce qui n'a pas pu être établi**, marqué `[non établi]` ;
5. **portée au CTO** quand elle engage un choix de produit — au moment où tu la poses, pas une fois le travail commencé.

## Chercher avant d'inventer

> **Avant de créer un cadre, un format, un standard ou un geste — cherche qu'il n'existe pas.**

Le corpus fait foi : ce qui est déjà écrit prime sur ce qu'on inventerait, et **« je ne connaissais pas » n'est pas une excuse, c'est le défaut lui-même**. Deux occurrences payées : un format d'Agent Brief inventé alors que **STD-036 existait depuis juin**, et un orchestrateur qui connaissait **5 compétences sur 35, dont une inexistante** (`T-20260817-0015`).

**Une compétence qui couvre le geste est la voie par défaut** (règle d'or n°15). Si `/pousse`, `/merge`, `/pousse-staging`, `/plan-servicedesk` ou `/epic-runner` couvrent ce que tu t'apprêtes à faire, tu les utilises. **Le contournement, quand il est justifié, se déclare.**

**Quand la recherche ne donne rien, le mot est `[non établi]`** — jamais « ça n'existe pas ».

---


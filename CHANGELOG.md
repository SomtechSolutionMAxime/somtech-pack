# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).
Le pack suit le versioning [SemVer](https://semver.org/lang/fr/) — la version est exposée dans `pack.json` et figée par un tag git `v<MAJOR>.<MINOR>.<PATCH>` à chaque livraison.

## [Non-versionne] - 2026-08-20

*Lot `T-20260820-0022`, PR #302, sous la demande `D-20260820-0001`. **Le dirigeant ne pouvait plus parler à ses agents depuis une heure.** Toute session née depuis le 18 août est absente du registre `herdr` — les 83 agents visibles vont du 19 juillet au 19 août, les 15 invisibles sont tous postérieurs au 18 à 14 h 52. Faire naître fonctionnait ; **joindre l'agent né, non**.*

### Corrigé

- **Un agent que le registre ignore n'est pas un agent mort** — `vivant()` replie sur `pane list`, discriminant `agent_session`. **Une panne de mesure ne rend plus « mort »** : elle jette, ce qui atteint le chemin « herdr injoignable » qui *reporte* au lieu de trancher.
- 🔴 **La ronde de reprise ne referme plus les lignes que le seul registre ignore** — c'était le plus grave : `reconcilier()` balaie **toutes** les lignes au démarrage, donc un simple relèvement du veilleur refermait en série celles de toutes les sessions neuves, sans que personne n'ait rien demandé. Elle ne ferme plus que sur **disparition positive** — absent du registre **et** de la liste des panes, les deux constatés — et **reporte la ronde entière** si la seconde mesure échoue. *Arbitrage : « ne jamais fermer » retirait une condition et violait le design écrit ; celle-ci en **ajoute** une et tient les deux textes.*
- **`livrer.js` parle par le pane** — et **bascule ses quatre verbes**, pas seulement sa recherche. Mesuré sur un pane réellement invisible : `herdr agent read` rend `agent_not_found` là où `herdr pane read` rend l'écran. *Toute la famille `agent …` leur est fermée : un repli qui aurait seulement **trouvé** le pane puis rappelé `agent prompt` aurait échoué au dernier mètre, après avoir annoncé qu'il avait trouvé.*
- 🔴 **`unknown` est la signature du cas qu'on replie, pas un état suspect** — mesuré sur les 98 panes du poste : les 83 vus du registre sont **tous** `idle`, les 15 ignorés **tous** `unknown`, séparation parfaite. Refuser `unknown` rendait le repli **inopérant sur exactement la population qu'il vise**. C'est une **conjonction**, pas une levée : arrivé *par le pane* **et** statut `unknown` **et** boîte vide. Par le NOM, `unknown` reste un refus — on ne généralise pas une levée dont on connaît la cause à un cas dont on l'ignore.
- **La boîte est la paire de filets qui porte l'invite, pas la dernière paire de l'écran** — le défaut était rapporté comme « le multi-lignes casse » ; **la mesure dit autre chose** : trois lignes se lisent parfaitement, c'est un **pied de page encadré** qui cassait. *La corrélation trompait — un texte long fait défiler l'écran et fait apparaître un filet de plus.* Ce que ça coûtait : « illisible » fait **s'abstenir**, donc un émetteur croyait la boîte occupée devant une session qui n'attendait que ça.
- **Deux refus décrivaient un état qui n'était pas celui de la session** — *« elle a déjà quitté l'attente sans nous »* à un pane que le registre **n'a jamais vu** (il n'en est donc jamais sorti), et *« désigne-le par son pane »* à quelqu'un qui **venait de le faire par son pane** (relevé par `ristigouche`). Un refus dit ce qu'il a **essayé**, et ne conseille jamais la voie qu'il vient d'écarter.

### Technique

- **Les gardes ne bougent pas, et c'est éprouvé sous le nouveau chemin** : le refus d'écrire dans une **boîte non vide** (avec la preuve que la lecture passe par `pane read --format ansi`), le refus d'**homonymie** de pane, le fait qu'un pane **sans `agent_session`** reste un shell, la **priorité du registre** quand il répond, et `agent prompt --wait --until working` sur le chemin nominal.
- **Mutation — 9 points, un à la fois** *(muter en groupe cache une survivante)*. **Huit rougissent.** ⚠️ **Le neuvième avait d'abord survécu** : le drapeau qui relie la recherche aux verbes pouvait tomber sans un seul rouge — *les deux étages étaient justes séparément et rien ne vérifiait qu'ils se parlaient*. L'essai de bout en bout qui l'a fermé a trouvé **un second défaut invisible à la relecture** : `pane get` range le statut sous `result.pane`, `agent get` sous `result.agent`. Un dernier point est un **mutant équivalent**, déclaré comme tel : la garde qui le suit couvre la même propriété.
- 🔴 **Ce que le plan #160 disait déjà** — la story E4 de son découpage exige *« au sens de "disparu" **établi par le spike 2** »*, et le même document listait en **NON VÉRIFIÉ** *« l'existence d'une commande d'inventaire des agents vivants »*. **Le spike n'a jamais été fait**, et le code a supposé que `agent list` = les vivants. *Le plan n'avait pas seulement la réponse : il avait nommé la question et interdit d'y répondre sans mesure.*


## [Non-versionne] - 2026-08-20

*Lot `E-20260819-0015` : PR #301, stories `T-20260819-0121` et `T-20260820-0003`, sous la demande `D-20260818-0003`. **Le code disait déjà la vérité ; c'est le mot qui manquait.** Deux orchestrateurs ont perdu ~3 h chacun sur des boîtes qui portaient une **suggestion grisée** — non parce qu'un outil se trompait, mais parce qu'aucun ne pouvait le constater sans lire le code.*

### Ajouté

- **`gestionnaire-etat-boite <pane>` — la commande qui MESURE l'état d'une boîte de saisie** (`T-20260819-0121`) — cinq états nommés, chacun avec sa conduite : `saisie` · `collee` (un texte réel — `livrer.js` délivre sans écraser) · `suggestion` · `file-attente` (du gris — **rien à soumettre, rien n'est bloqué**) · `illisible` (*qui n'est pas « vide »* — on va regarder soi-même). Elle ne pose aucun geste et se tape sur le pane d'un autre. **Le gabarit de l'orchestrateur prescrivait jusqu'ici le geste aveugle** : `herdr pane read` rend **le même écran** pour une suggestion et pour un texte saisi — le seul discriminant est un attribut ANSI. Une troisième condition est posée avant de soumettre la boîte d'autrui : *tu as mesuré son ÉTAT, pas lu son écran.*
- **Le détecteur délimite la boîte AVANT de chercher le gris** — et c'est ce qui rend le chiffre publié utilisable : sur les **94 panes Claude Code du poste, 33 portaient une suggestion**, `contenuBoite` rend « vide » sur les 33 et « pleine » sur le seul vrai collage. **Chercher le gris n'importe où sur l'écran aurait déclaré une suggestion sur presque tous** : `ESC[2m` apparaît **86 fois sur 119 écrans relevés** (le bandeau « auto mode on » est grisé, les numéros de ligne d'un affichage de code aussi). La question avait été posée par un tiers qui refusait d'en tirer une conclusion sans avoir lu le code — **elle est tranchée par le code, pas par une opinion**.

### Corrigé

- **Le marqueur de file d'attente n'est pas une suggestion** — nommer un état par son **mécanisme** (« du gris ⇒ une suggestion ») attrape trop : les messages en attente de leur tour sont grisés eux aussi, et se faisaient rebaptiser. **C'est l'usage réel qui l'a trouvé, pas la relecture.**
- **L'homonymie de pane se refuse aussi quand le registre répond** — un identifiant de pane est **interne à sa session** ; le poste en porte treize qui numérotent indépendamment.
- **Sept mutations survivantes fermées** (passe de mutation indépendante : 29 tentées, 8 survivantes, 7 réelles + 1 mutant équivalent). **Toutes avaient la même cause : les doubles d'écran du banc étaient écrits à la main, donc propres.** Un dump réel ne l'est pas — ses filets portent des séquences, son invite est suivie d'un espace insécable, un écran réel porte souvent plus de deux filets. *C'est la forme la plus coûteuse d'un banc qui ne peut pas échouer : il éprouve un objet que la production ne produit jamais.* Chaque essai neuf a été re-muté **un point à la fois**.

### Technique

- **Le plafond de taille du gabarit est re-baseliné de `145223` à `146349`, marge ZÉRO** (`T-20260820-0003`) — **+1 126 octets**, mesurés sur le fichier livré après le dernier commit, jamais estimés. *Arbitrage rendu par le coordonnateur : « une garde à marge 0 ne dit pas "jamais plus grand", elle dit "pas sans qu'on le décide" — re-baseliner EST la décision qu'elle exige. »* **Preuve qu'elle mord toujours : +1 octet la fait rougir.** Deux voies ont été écartées, et c'est leur raison qui permet de **refuser la prochaine demande** : mettre le texte dans le `SKILL.md` — refusé, *le gabarit dit lui-même qu'un orchestrateur ne le lit pas ; mettre là ce qui doit gouverner, c'est choisir qu'il ne gouverne pas* — et couper 1 126 octets ailleurs — refusé, *le lot avait déjà coupé sa part deux fois, et couper au-delà retire du texte qui garde autre chose sans que personne sache quoi*. **Le motif est inscrit dans le fichier même, au-dessus de `BASELINE`, avec les quatre conditions qu'un futur relèvement doit réunir ENSEMBLE** : le texte prescrit un geste impossible sans lui · le défaut évité est mesuré et porte un code de ticket · le lot a d'abord coupé sa propre part et le dit chiffré · le lieu a été contesté. *Deux sur quatre → on coupe ailleurs. Zéro → on refuse.* **Une garde à marge 0 ne meurt pas d'un grand saut : elle meurt d'une suite de petits cas justifiés.**


## [Non-versionne] - 2026-08-19

*Lot `E-20260819-0006` : PR #298, story `T-20260819-0064`, sous la demande `D-20260818-0008`. **La veille ne tournait plus en silence — elle s'arrêtait en mentant.** Un silence laisse la question ouverte ; un mensonge la ferme du mauvais côté.*

*Et PR #296 (`T-20260819-0009`), sous la livraison `J-20260814-0002` : **un module appliquait d'un seul côté un invariant qu'il pose lui-même**.*

*Et PR #300 (`E-20260819-0013`), sous la demande `D-20260818-0003` : **huit règles mesurées en une journée descendent dans le métier de l'orchestrateur — chacune à l'endroit du geste qu'elle corrige, pas dans une liste.** Six sont formulées par les agents eux-mêmes et recopiées mot pour mot ; deux viennent du dirigeant. Le gabarit est **purement additif** — 179 insertions, 0 suppression, 96 titres avant, 98 après, aucun disparu.*

### Ajouté

- **`LU` à chaque message reçu — et le texte nomme enfin le bon adversaire** (ordre du dirigeant, répété quatre fois le 2026-08-19) — la règle **existait déjà**, mot pour mot, en R6. Elle n'a pas mordu quatre fois dans la journée, sur un orchestrateur qui l'avait relue le matin même. **Ce n'était donc pas une absence à combler, mais un défaut de forme** : le texte interdisait *« se mettre à travailler d'abord, parce que ce sera vite fait »* — et les quatre occurrences mesurées sont **« répondre le contenu qu'on a tout de suite »**. Une règle qui nomme le mauvais adversaire se fait enjamber sans qu'on s'en aperçoive : au moment où elle perd, on se contrôle contre le mauvais piège et **on se conclut conforme**. Le récapitulatif d'anti-patterns nommait trois autres pièges, et le vrai n'était dans aucun. Le métier écrit maintenant : *une réponse utile n'est pas un `LU` — le `LU` est ce que tu écris AVANT elle, et s'ils tiennent dans le même message, il en est la première ligne.* ⚠️ **Et l'envie qui la bat est installée par la première page du même fichier** — *« ce que le dirigeant te demande, il doit l'avoir »* : les deux vivaient à 900 lignes l'une de l'autre sans jamais se nommer.
- **La règle 8 est aussi portée par le prompt de `/loop`, pas seulement écrite ici** — une piste posait que *« une règle qui ARRIVE bat une règle qu'on doit aller CHERCHER »*. Elle est **réfutée par deux mesures** : la règle 8 **est arrivée**, quatre fois, écrite sur la ligne ; et le principe d'arrivée était **déjà inscrit quatre fois dans ce métier**, indépendamment, sur quatre gestes différents (*« on ne peut pas se rappeler de se rappeler »*, R5.3 · *« ce qui protège, c'est le geste imposé là où l'acte se pose »*, biais · *« une règle qui ne vit que dans la compétence ne gouverne personne »*, préambule · la technique du `/loop` elle-même). **Il était là, quatre fois, et il n'a rien sauvé.** Ce qui reste : *l'arrivée est le **transport**, nommer le geste qu'on est réellement en train de faire est la **charge** — une mauvaise charge parfaitement livrée échoue quand même.* Le lot fait donc les deux.
- **`herdr agent focus` — on amène le pane devant le dirigeant au lieu de lui décrire où chercher** (`T-20260819-0114`, consigne du dirigeant) — posé en R6, **avec « J'ai besoin de toi : »**, dont il est le pendant physique : la dernière ligne dit *ce que* l'on attend, le focus met *à l'endroit* de le faire. Un poste porte treize sessions herdr qui numérotent leurs panes indépendamment : le pane, la session, le dossier et le nom de l'agent avaient été donnés, **ça n'a pas suffi**. Le **titre de fenêtre** (`terminal_title`) passe avant l'identifiant — c'est ce que le dirigeant voit, lui. Avec sa borne : *le focus **amène** le pane, il ne dit pas ce qu'il faut y faire.*
- **Un hook, un `/goal`, un rappel de session ne sont pas une personne** (`T-20260819-0095`) — porté au biais n°1, qui supposait jusque-là un humain au départ. *Si je ne peux pas nommer le canal, je ne peux pas nommer l'auteur.* Avec sa **forme symétrique, plus insidieuse** : attribuer à quelqu'un une phrase qu'on a soi-même **déduite** de ce qu'il a réellement dit — *la source EST une personne, la citation est presque exacte, et c'est le complément inventé qui ment ; rien n'alerte, parce que tout le reste est vrai.* **Trois agents, trois formes, un seul jour.** Et le versant du donneur d'ordre, posé là où le `/goal` se pose : **un arbitrage qui contredit un `/goal` déjà posé corrige le `/goal` dans le même geste** — sinon on fabrique la contradiction qu'on reprochera ensuite à l'agent de mal relayer.
- **La complaisance ASCENDANTE** (`T-20260819-0106`) — le biais n°2 ne connaissait que le sens descendant. *« Pas moi qui te flatte, toi qui te trompes en ma faveur, et moi qui ne vérifie pas parce que ça m'arrange. »* Plus difficile à voir, parce qu'il ressemble à de la déférence et qu'il a l'air d'économiser du temps à tout le monde. Avec son garde-fou côté coordonnateur, posé là où l'arbitrage se rend : **on ne rend pas d'arbitrage sur un texte qu'on n'a pas sous les yeux** — et si l'agent le décrit, l'arbitrage porte sur *sa description*, **et ça doit se dire**.
- **« On teste quand il n'y a rien ; on ne teste pas quand on ne peut pas voir »** (`T-20260819-0097`) — posé à côté de la mutation, dans ce que l'orchestrateur exige d'une revue. **Trois des quatre gardes relevées étaient testées**, l'une quatre fois : leurs tests couvraient *« le socket est orphelin »*, jamais *« le ping échoue alors que le veilleur est VIVANT »*. Formulé en **geste** : après avoir testé « quand il n'y a rien », **couper la sonde** et vérifier que le résultat **diffère**. Avec le critère qui trie une décision d'un oubli — *un test garde-t-il ce silence ?* — et le cas de la **sonde dupliquée** : la question n'est pas si deux copies sont justes, mais si elles **rendent le même verdict sur les mêmes entrées**.
- **Relire son propre texte pour la COHÉRENCE, pas seulement pour la clarté** (`T-20260819-0105`) — le seul défaut de la série qui **ne se corrige pas en mesurant** : la mesure était juste, écrite, et trois lignes plus bas dans le même paragraphe que la conclusion qu'elle démonte. Formulé en question, parce que c'est celle qu'on ne se pose jamais : **« qu'est-ce que je viens d'écrire qui rend ma conclusion fausse ? »** Et son second volet, posé là où l'on inscrit : **une conclusion inscrite puis démentie SE SUPERSÈDE, elle ne se corrige jamais par ajout** — *un diagnostic faux qui reste lisible comme un constat se récite.*
- **Le prompt de `/loop` porte le briefing, et se repose quand son contenu change** (`T-20260819-0110`) — un `/clear` efface le fil, pas le prompt de la boucle : **c'est le seul support de continuité qui n'exige aucune discipline**, les autres demandent d'aller les lire. Avec la borne sans laquelle la règle nuit : un prompt figé **récite un briefing annulé** — mesuré, une `/loop` portait encore une condition levée vingt minutes plus tôt.
- **Quatre états d'agent se ressemblent, et le seul geste qui tranche est d'écrire puis de remesurer** (`T-20260819-0103`, `T-20260819-0111`, `T-20260819-0121`) — au travail · **forcé de finir par un hook** (`done`, but non atteint — il repart si on lui écrit) · **gelé par la limite** (`idle`, boîte vide — il ne repart pas) · **invisible au registre** (`agent_not_found` alors que son écran travaille — on lit son **pane**). *Il n'existe aucune observation passive qui les distingue : la mesure EST le geste.* Le quatrième a été mesuré sur le chef d'équipe de ce lot même — 84 agents au registre, le sien absent — et il **casse l'étape ① du protocole des trois autres**, qui n'a alors pas de réponse. Sa borne : ***`agent_not_found` n'est pas la mort d'un agent, c'est la panne de la mesure.***

### Corrigé

- **Un refus final ne tait plus la touche d'envoi déjà partie** (`T-20260819-0009`) — quand la réparation de `livrerBrief` presse Entrée sur une boîte qui ne se vide pas, le refus rendu disait « boîte encore pleine » **sans un mot sur le geste déjà posé**. Le lecteur — agent ou humain — en concluait que le pane était intact, et pressait à son tour. Le module pose pourtant l'invariant trente lignes plus haut, en toutes lettres : *un refus qui tait un geste déjà posé est un refus qui ment par omission*. Il ne l'appliquait qu'au cas symétrique (la délivrance), jamais à la réparation.
- **Les deux branches où une touche part sont couvertes, pas une seule** — herdr peut **accepter** la soumission (`causeRepare: soumise`) ou la **refuser** (`envoi-refuse`) ; dans les deux cas `appelHerdr(commandes.soumettre)` a déjà été appelé, **avant** que son résultat soit lu. N'en couvrir qu'une aurait reproduit « une porte sur deux » dans le correctif écrit pour la fermer. Ce n'est **pas** un défaut du champ : `causeRepare` sortait déjà les deux causes et n'a pas bougé — le champ sert la machine, le `message` sert le lecteur.
- **La version du pack ne se lit plus dans `VERSION`** (`T-20260819-0009`) — le `CLAUDE.md` désignait ce fichier comme la source, alors que `publish.yml` l'aligne sur le tag **dans le paquet**, sans jamais recommiter. Mesuré le 2026-08-19 : `VERSION` disait `1.64.0` pendant que le tag du jour et le paquet publié étaient onze versions mineures plus loin — un écart qui **grandit à chaque livraison**, par conception. La phrase était fausse pour **toute session Claude Code** qui lit le dépôt.

- **Un pane vivant dont l'agent est invisible n'est pas un pane mort** (`T-20260819-0064`) — `herdr agent get` rend `agent_not_found` dans **deux** situations très différentes : le pane a été fermé, ou le pane est bien vivant mais aucun agent ne lui est rattaché au registre. La veille les confondait et rendait, sur un pane hébergeant un agent Claude visible à l'écran : *« le pane n'existe plus (confirmé sur deux relevés) — il n'y a plus rien à garder »*, code 6. **Trois affirmations fausses dans une phrase** : le pane existe, l'agent est vivant, et il y a précisément quelqu'un à garder que plus personne ne garde. L'orchestrateur qui lit ce motif ferme un pane vivant en croyant nettoyer.
- **La contradiction interne entre les deux sondes du script est refermée** — le contrôle *à la pose* interrogeait `pane get` et laissait passer ; la boucle interrogeait `agent get` et concluait l'inverse **sur le même pane**. Introduite par `E-20260819-0003`, corrigée ici : c'est la même fonction. La branche demande désormais au **pane**, qui est la question réellement posée.
- **Nouveau motif `agent-invisible`, code 10 — et surtout pas 5.** `5` est le **fourre-tout** de `code_motif` : tout motif inconnu, y compris une faute de frappe dans un appel à `terminer`, rend déjà 5. Y placer ce motif l'aurait rendu indistinguable d'une erreur de programmation — c'est-à-dire aurait recréé, un cran plus loin, le défaut même que ce lot ferme : deux choses différentes qui rendent le même signal.
- **Le message dit quoi faire** : *« le pane et son agent sont peut-être bien vivants : va le voir AVANT de le fermer, et repose une veille une fois l'agent rattaché »*. Un refus qui ne dit pas quoi faire laisse le lecteur sans issue.

### Technique

- **Le refus est éprouvé sur ce qu'il DIT, pas sur le fait qu'il dise quelque chose** (`T-20260819-0009`) — une garde qui vérifie la présence d'un texte se désarme en y collant la phrase d'une autre branche. La suite exige un **geste nommé au passé**, refuse toute formule de non-tentative — le conditionnel compris, « la touche aurait déjà été pressée » dit qu'il ne s'est rien passé — et impose trois refus **deux à deux distincts**. Éprouvé par mutation, **un point à la fois**, baseline soustraite : **dix mutations, zéro survivante**. La septième a été trouvée par une **seconde** passe de fond, après que les deux premières l'aient manquée — une **inversion à sens unique** : annoncer, sur le chemin où herdr a *accepté* le geste, qu'il l'a *refusé*. Elle nomme le geste, le dit au passé, reste distincte des deux autres proses, ne porte aucune formule de non-tentative — et elle rend au lecteur exactement la conclusion que ce lot existe pour lui retirer, puisque l'autre prose du module dit qu'un refus de herdr « est la seule raison de croire qu'aucune touche n'a atteint ce pane ». Chaque branche refuse désormais d'affirmer l'issue de l'autre.
- **Une garde se juge sur deux chiffres, pas un** — ce qu'elle attrape *et* ce qu'elle refuse à tort. Mesuré, chaque leurre posé sur **les deux** branches : **26 leurres sur 26** attrapés (phrase vide, texte quelconque, négation, conditionnel, futur, phrase qui ne parle que de la boîte, annonce sans conséquence, mensonge habillé des bons mots, inversion à sens unique) et **0 refus à tort sur 15** formulations honnêtes différentes. Une première version exigeait la rédaction de son auteur et en refusait 6 sur 8 — dont deux à cause d'un `\b` placé après une lettre accentuée, qui ne marque aucune frontière en JavaScript (relevé à part : `T-20260819-0060`). Une seconde interdisait le mot « aurait » **n'importe où**, et refusait donc une phrase honnête où il vivait dans une tout autre proposition — le conditionnel ne se juge que sur le geste.
- **La porte du binaire est gardée, pas seulement le module** — c'est le défaut exact du lot précédent (`T-20260818-0031`) : une cause juste qui ne franchit pas `bin/livrer.js`. Deux essais éprouvent la prose contre le **vrai exécutable**, avec un levier de plus sur le faux herdr (`enterRefuse`, l'état que le champ `envoi-refuse` nomme depuis toujours et qu'aucun scénario ne savait produire).
- **Et l'un de ces deux essais était vert pour la mauvaise raison** — trouvé en le mutant, pas en le relisant : chercher « refus » dans tout le `stderr` était satisfait par le rapport de herdr lui-même (« a refusé : no state change observed »), jamais par la prose éprouvée. On isole désormais la **ligne d'aveu** — et on vérifie qu'elle vient bien de la réparation : `motDeLaDelivrance` écrit lui aussi des lignes qui commencent par ⚠️, dont une satisferait mot pour mot les mêmes critères en venant d'un tout autre chemin.
- **Les chiffres se rejouent, ou ils ne valent rien** — relevé en passe de fond : le harnais qui produisait ces comptes vivait dans un dossier de travail jetable, donc **personne ne pouvait le rejouer**. Il est désormais dans le dépôt (`naissance-representant/scripts/mesure-garde-du-refus.mjs`, même forme que `scripts/mesure-ancrage-des-gardes.mjs`) : il copie le module hors du dépôt, mute un point à la fois, soustrait sa baseline, et rend un code non nul si quoi que ce soit survit. Il lit les deux proses **dans le source**, jamais recopiées — sans quoi il mesurerait un jour une phrase qui n'existe plus.
- **Et le harnais a été éprouvé lui-même — la première contre-épreuve était fausse** : la garde n'avait été désarmée que dans **un** des deux bancs, l'autre attrapait, et on allait conclure qu'un banc ne pouvait pas échouer. Désarmée aux deux endroits, il rend bien `1` et **nomme** ce qui n'est plus gardé. *Un rouge prouve qu'au moins une chose était gardée, jamais que toutes l'étaient — ici dans l'autre sens : un vert prouvait qu'une garde tenait, pas les deux.*
- **La garde exige la CONSÉQUENCE, pas seulement l'annonce** — dixième mutation, trouvée par une **quatrième** passe de fond après trois qui l'ont manquée : on pouvait retirer « il n'a pas suffi […] ce que tu vois n'est donc pas un pane intact — une action irréversible y a déjà eu lieu » et ne garder que l'annonce du geste. Les deux bancs restaient verts. Or l'annonce seule ne sert à rien : ce que le lecteur doit emporter, c'est que **le pane n'est pas dans l'état où il croit le trouver**. Une garde qui vérifie qu'on a *parlé* du geste, sans vérifier qu'on a dit ce qu'il *laisse derrière lui*, garde la forme et laisse partir le fond.
- **Et le deuxième chiffre a repris cette garde le jour même de sa naissance** — dans sa première forme, l'exigence de conséquence refusait **8 formulations honnêtes sur 15**, dont « la boîte n'a pas bougé » et « sans le vider », qui la disent exactement, autrement. Élargie. En regard, l'annonce sans conséquence — qui figurait jusque-là parmi les exemples honnêtes — est passée du côté des **leurres** : *ce qui devient inacceptable change de camp, on ne le retire pas du jeu, sinon plus rien ne mesure la nouvelle exigence.*
- **Les motifs ne vivent plus en double** — ils étaient recopiés dans les deux bancs, et les deux copies avaient **déjà divergé** : celle du binaire omettait deux des six formules de non-tentative, et laissait donc passer « en vérité elle n'a jamais été tentée sur ce pane » que l'autre attrapait. Un seul module (`tests/lib/motifs-du-refus.mjs`), importé des deux côtés — c'est le défaut que ce module se reproche ailleurs à lui-même : deux mécanismes pour une règle, et c'est celui qu'on ne relit plus qui perd.
- **Le libellé de l'état de la boîte est apparié à sa cause** — « illisible », « vide », « encore pleine » étaient **permutables sans qu'un seul des 413 essais ne rougisse**. `causeRepare` restait juste pour la machine pendant que le lecteur lisait le contraire de ce qu'on avait vu. Même invariant que ce lot, autre segment du même message : « on ne sait pas lire » et « il n'y avait rien » ne sont pas le même fait.
- **Et la porte inverse est gardée** — sur les quatre chemins où **aucune** touche n'est partie (dialogue, refus avant écriture, boîte vide, boîte illisible), le refus ne doit annoncer aucun geste. Annoncer ce qui n'a pas eu lieu est le défaut jumeau de celui qu'on ferme.

- **Les deux chiffres, sur les 234 panes réels du poste** — signalé **à raison : 5**, c'est-à-dire cinq panes hébergeant un agent **vivant** et invisibles au registre, que la veille déclarait morts ; signalé **à tort : 0** sur les 89 agents correctement rattachés. Les 139 autres sont des shells nus, où « aucun agent rattaché » est exact — et l'on ne pose pas de veille sur un shell.
- **Les deux compteurs se remettent l'un l'autre à zéro** — `ABSENCES` et `INVISIBLES` gardent chacun l'exigence de deux relevés concordants (garantie n°4), et **deux relevés qui ne portent pas sur le même fait ne concordent pas**.
- ⚠️ **Deux tests existants éprouvaient autre chose que leur titre** — les contrôles « le pane disparaît sous la veille » et « le seuil de confirmation vaut exactement deux » n'armaient que l'**agent** absent, jamais le **pane**. Ils passaient donc sur un cas qui n'est pas le leur, et ne gardaient rien de ce qu'ils annonçaient. Remis sur leur cas.
- **La cause du brief était périmée, et ça a été arbitré avant d'écrire** — le brief décrivait « 400 tours en silence, aucun `case` ne matche ». Fermé depuis les lots E (`case ''` → `releve-illisible`, code 8) et G (`2>&1` sur la lecture d'état). Mesuré, remonté, cause corrigée sur arbitrage plutôt que réécrite en silence.
- **Preuve par exécution** sur un pane réellement invisible fabriqué pour l'occasion — `rc=10`, motif vrai — et non sur une sortie simulée. **123 tests, 0 échec** ; 4 mutations du correctif attrapées ; **les 4 garanties historiques mutées une par une, chacune rougit**.

- **Un banc garde les huit règles — c'est la vraie livraison, et il manquait** (`E-20260819-0013`) — relevé **en revue de fond**, pas par l'auteur ni par son coordonnateur : 179 lignes de règle opposable allaient descendre chez neuf orchestrateurs **sans un seul test pour les protéger**, et le lot était annoncé fini. C'est exactement le motif que ce banc existe pour empêcher. Il passe de **28 à 60 assertions**, chacune **ancrée à la section où le geste se pose** — jamais au fichier entier, une règle déplacée dans une section qu'on n'ouvre pas au moment du geste ne gouvernant plus personne — et chacune éprouvée **avec sa borne**, pas seulement avec son affirmation.
- **Le premier jet du banc était désarmable, et le compte publié portait sur un sous-ensemble** — **sept mutations sur 23 survivaient** : les sondes offraient des alternatives `a|b`, donc retirer une moitié laissait l'autre les satisfaire. Puis « 0 survivante sur 23 » a été annoncé alors que le bloc portait **27 assertions** — quatre n'avaient reçu aucune mutation, et en les jouant une survivait. *Le dénominateur d'une campagne de mutation est le nombre d'**assertions**, jamais le nombre de mutations qu'on a eu l'idée d'écrire.* État final : **42 mutations jouées une à une**, sur copie hors dépôt (`METIER_ORCHESTRATEUR`), chaque occurrence supprimée, **0 survivante**.
- **Trois sondes portaient une branche MORTE — dont une en faux vert** — le markdown coupe les mots par des astérisques : le texte écrit `le focus **amène** le pane`, donc `amène le pane` a **zéro occurrence littérale**. La sonde ne tenait que sur sa seconde moitié, et retirer toute la partie positive de la borne **la laissait verte**. Un audit de toute la famille a suivi : **six branches d'alternation ont zéro occurrence, dont cinq antérieures à ce lot** ; mesurées une à une, quatre sont cosmétiques et **une est un vrai faux vert** — non corrigée ici de propos délibéré, parce que ré-ancrer la garde d'un autre sans acter sa perte d'abord est ce que ce banc interdit (`T-20260819-0123`).
- **Le plafond de taille du gabarit est re-baseliné à `145223`, marge ZÉRO** — la marge de 6 500 posée le matin même avait été **consommée en entier par le lot précédent** : `origin/main` était à 125 274 pour une ligne de base de 118 856, soit **82 octets restants**. Le plafond mesurait donc **deux lots à la fois, donc plus rien**. Arbitrage rendu et **inscrit au fil de `D-20260818-0003`** avec sa mesure : *« une marge n'est pas une réserve, c'est une invitation ; sans marge, le prochain lot devra revenir demander — et c'est exactement le comportement qu'on veut d'une garde. »* Preuve qu'il mord : **+1 octet le fait rougir**. Avant de demander, le lot a coupé **2 917 octets** de son propre texte — un récapitulatif d'anti-patterns qui redisait dans une liste ce que le lot pose au geste, et un hors-périmètre.
- **Six citations avaient été altérées en croyant les recopier** — relevé en revue de fond : « jamais » pour « pas », un deux-points pour un tiret cadratin, quatre mots coupés d'un arbitrage cité, « le service » pour « le veilleur » à l'intérieur de guillemets, une virgule effaçant une ellipse. **Aucune ne changeait le sens — c'est ce qui les rend indétectables à la relecture**, et c'est pourquoi l'epic exigeait de recopier plutôt que de reformuler. *Nommer un défaut ne protège pas de le commettre.*
- **`herdr agent focus` est aussi ajouté aux blocs de commande de la compétence `/orchestrer-chantier`** — la garde anti-invention du banc CLI le refusait : elle s'ancre sur la compétence de référence, pas sur le pack entier. La commande est réelle (`--help` rend 0) et le pack l'emploie six fois ailleurs. *Une règle posée sur un gabarit ne descend pas seule dans la compétence : elle porte ses propres commandes.*
- **Deux verdicts de revue rendus sur le SHA nommément** — portail `RIEN VU`, fond `mergeable`. ⚠️ **Le portail a aussi rendu un rejet infondé**, et il n'a pas été écarté : son observation — une branche morte — était juste, sa conséquence **déduite au lieu d'être mesurée**. La mutation jouée montrait que la sonde rougissait. Mais ce rejet a fait auditer **toute la famille** au lieu de ce seul cas, et c'est là qu'a été trouvé le faux vert d'une garde antérieure. *Un rejet infondé qui fait trouver un vrai défaut vaut mieux qu'un rejet fondé qu'on classe.*

## [1.77.0] - 2026-08-19

*Lot `E-20260819-0005` (PR #297), sous `D-20260819-0001`. **On ne pouvait répondre à « qui est vivant, quel métier porte-t-il, est-il à jour » que par une passe manuelle** — faite une fois le matin, périmée le lendemain, et que personne ne relancerait.*

### Ajouté

- **Le veilleur tient le registre des orchestrateurs du poste** (`E-20260819-0005`) — pour chaque pane dont le répertoire est un lieu d'orchestrateur reconnu **par le fait** : son mandat, sa session herdr, l'empreinte SHA-256 de son métier, ses octets, son écart à la référence du poste, et ce qu'on a pu lire de son travail en vol. Ronde toutes les 15 minutes, et `ligne-directe recensement` pour le demander à tout moment. **On ajoute une mesure à une ronde qui existe ; on ne fabrique pas une ronde.**
- **L'état du MANDAT, à côté de l'état de la session** (`T-20260819-0056`) — un chantier clos et une session au repos disent tous les deux `idle`, et **rien dans herdr ne les distingue**. Le registre croise le ServiceDesk, et **ne propose rien à un mandat qui n'est pas prouvé ouvert** — ni clos, ni non mesuré : réveiller un chantier terminé mettrait deux orchestrateurs sur les mêmes panes, chacun croyant l'autre parti.

### Mesuré

- **Un agent VIVANT peut recharger son métier sans renaître** (`T-20260819-0050`) — le geste est `/clear`, envoyé dans son pane : reproduit 2 fois sur 2 sur un cobaye jetable, et le `.claude/settings.json` est relu aussi (hook ajouté à chaud → il se déclenche ; retiré → il ne se déclenche plus). C'est le **redémarrage** qui ne suffisait pas, pas le rechargement.
- **Mais le geste efface le fil de l'agent** — et ce n'est pas ce qu'on croyait : `/clear` **n'arrête rien**. Un shell d'arrière-plan continue, un sous-agent en vol rend son résultat. C'est l'agent qui perd la connaissance de ce qui tourne : interrogé juste après, il répond « rien en cours, session propre », puis reçoit le retour d'un sous-agent qu'il ne se rappelle plus avoir lancé. **Rien n'est tué, tout devient orphelin de sa raison d'être.** D'où la règle écrite dans le code : **le registre propose, il n'impose pas — et l'agent doit pouvoir dire « pas maintenant » AVANT.**
- **Un agent qui tape `herdr` tout court ne voit qu'un treizième du poste** — et c'est la raison d'être du registre, pas un détail d'implémentation. `herdr` sans socket désigné parle à **une seule session**. Mesuré session par session le 2026-08-19 : `somtech` 89 agents, `cg` 20, `progex` 18, `morasse` 2, `sibelanger` 1, deux à 0, **six muettes** — **130 agents visibles, 89 vus**. Deux des sept orchestrateurs que le registre trouve vivent dans `progex` et `cg`, invisibles depuis `somtech`. Le registre interroge donc **les treize sessions une par une**, et **rend chaque pane avec sa session** : `w3:p2` seul ne désigne rien, deux sessions emploient les mêmes identifiants.
- **Et l'inventaire se fait par le CHEMIN du lieu, jamais par le nom de l'agent** — depuis la `v1.72.0` un agent porte un nom de rivière, sans rapport avec le mandat de son lieu. Une passe d'inventaire qui cherchait les agents par leur nom en a manqué un **alors qu'il était sous ses yeux dans la liste**. Séparément, `herdr agent list` sous-compte face à `herdr pane list` — trois lieux contre cinq sur la même session, soit 40 %.

### Technique

- **Une panne d'inventaire rend `orchestrateurs: null`, jamais `[]`** — une liste vide se lit « il n'y en a aucun », et personne ne cherche un défaut derrière un rapport qui dit « rien à signaler ». La garde rougit sur une source **réellement** en panne (`herdr` retiré du `PATH`), pas sur une liste vide fabriquée.
- **Un identifiant de pane n'est unique que dans sa session** — `w5:p3` désigne deux panes différents selon la session herdr. L'inventaire dédoublonne sur le couple, et le registre rend la session à côté du pane.
- **Le transport du ServiceDesk porte la cloison d'essais** — relevé en passe de revue de fond, et le rejet était juste : sur un poste de développement la clé est exportée, donc un simple `npm test` faisait partir des appels **réels vers la production, avec la vraie clé**. La discipline existait déjà à côté (`slack.js`) ; le transport neuf n'en héritait pas.
- **Un tour de ronde qui PEND ne l'éteint plus** — les appels à `herdr` n'ont pas de délai propre : un socket vivant mais muet laissait `recensementEnCours` à `true` pour toujours, et plus aucun tour ne partait. Sans une ligne d'erreur.
- **Vingt-quatre mutations jouées une à une** sur copie hors dépôt : vingt-deux font rougir un banc seules, deux ne rougissent qu'ensemble (les deux ceintures d'arrêt de la ronde) — c'est écrit dans le code et un banc dédié le prouve.

---

## [1.76.0] - 2026-08-19

*Lot G : PR #295 (`E-20260819-0003`, stories `T-20260819-0026` à `0028`), sous la demande `D-20260818-0008`. **Trois gardes ne gardaient pas ce qu'elles prétendaient garder** — et le lot en a trouvé trois de plus en se relisant, dont deux dans ses propres bancs.*

### Corrigé

- **Une garde de surface garde SA PHRASE, jamais sa section** (`T-20260819-0026`) — `la-formule-jai-besoin-de-toi` cherchait la formule n'importe où dans la section de chaque surface. Un ajout parfaitement légitime ailleurs dans la même section la **désarmait sans qu'une ligne ne rougisse** : la mutation censée la prouver devenait muette, et la suite restait verte. C'était la **troisième** occurrence sur ce fichier. Chaque surface porte désormais une sonde `porteuse` ancrée sur ce que la phrase **nomme** — le bilan, le topo, le compte rendu, ce qui part sur ta ligne.
- **Les garanties de la règle sont ancrées sur leurs DEUX moitiés** — ce qu'elles affirment **et** ce qu'elles évitent. Relevé par une passe de revue : le lot énonçait le motif pour la famille entière et ne l'appliquait qu'à la moitié de sa propre garde. Mesuré, **trois mots** puis **cinq mots** réinjectés ailleurs dans la section suffisaient à la satisfaire. *Le motif — une ligne qui n'apparaît qu'en cas de demande oblige à lire le reste — est ce qui rend une règle applicable : sans lui, elle se relit comme un détail de forme, et c'est ainsi qu'elle avait cessé de mordre la première fois.*
- **`veille-deblocage.sh` n'avale plus une option comme un pane** (`T-20260819-0027`) — `--detach <pane> <agent>` était accepté **en silence** : l'option devenait le pane, le pane devenait l'agent, la veille s'inscrivait au registre sur un pane inexistant et **rendait un pid**, c'est-à-dire tous les signes d'une pose réussie, sans garder personne. Les drapeaux connus sont reconnus **où qu'ils soient** ; tout `--…` inconnu est refusé (code 1).
- **Le pane est vérifié à la pose, pas au premier tour de ronde** — un pane inexistant est désormais dit en **0,4 s** (code 6, aucun registre écrit) au lieu d'être découvert après la prise du verrou.

### Technique

- **Un outil qui dit ce qu'une garde exige RÉELLEMENT** (`scripts/mesure-ancrage-des-gardes.mjs`, `T-20260819-0030`) — il ne lit pas la source des gardes (un parseur ne connaîtrait que les formes qu'on lui a apprises) : il retire la ligne gardée, réinjecte un fragment ailleurs dans le périmètre, et le réduit mot à mot tant que la garde reste verte. **Mesuré sur le métier de l'orchestrateur : 37 gardes sur 47 sont satisfaites par un fragment de la phrase qu'elles gardent, 20 par cinq mots ou moins, 10 seulement sont ancrées.** Un seul mot suffit pour cinq d'entre elles. La garde grossière n'était pas un cas isolé : c'était la norme du fichier, et personne ne le savait.
- **Un compte se rend avec l'ÉTAT sur lequel il est pris** — relevé par la passe de fond : le lot publiait « 21 » mesuré avant son propre commit suivant, qui corrigeait une des gardes comptées. C'est **20** sur l'état livré. L'outil rend désormais le commit sur lequel il mesure, et dit quand l'arbre porte des modifications non commitées — *un compte pris sur un arbre sale n'est rattachable à rien.*
- **Les cinq surfaces sont éprouvées une à une** — la liste de mutations n'en portait que trois pour cinq surfaces déclarées. *Un rouge groupé prouve qu'au moins une chose était gardée, jamais que toutes l'étaient.*
- **Le bruit de la garde est mesuré, pas supposé** — 6 désarmements réels sur 6 attrapés, 0 reformulation légitime sur 5 refusée à tort. Une garde qui crie sur du texte correct se fait retirer par le premier qui la rencontre, et emporte ce qu'elle gardait vraiment.
- **La garde du pane interroge le PANE, pas l'agent** — `herdr agent get` rend `agent_not_found` aussi bien pour un pane fermé que pour un pane vivant sans agent. Mesuré sur les 231 panes réels du poste : **141 poses légitimes sur 231 auraient été refusées à tort**. `herdr pane get` distingue les deux — **141/231 → 0/231**.
- **Deux gardes MUETTES trouvées dans les bancs du lot lui-même** — le test du « pane apparu tardivement » pilotait la séquence d'`agent get`, plus celle que le contrôle interroge depuis le correctif : il restait vert sur un code qui avait **supprimé** la confirmation sur deux relevés. Et le banc de fragments ne réduisait que par la gauche, laissant passer une garantie satisfaite par un suffixe. *Le motif attrape ceux qui le traquent.*
- **Le `/goal` sur agent occupé, mesuré — et le métier n'est PAS touché** (`T-20260819-0028`) — le texte prescrivait de poser le `/goal` juste après un brief pris, donc sur un agent occupé : l'état exact où le même fichier mesure la famine. **4 essais sur 4 sur agent `working` : pris en 2 secondes** (5/5 avec le témoin au repos). La contradiction était apparente : **un `/goal` est une commande, traitée tout de suite ; un texte ordinaire est mis en file** et attend la fin du tour. Deux séries d'observations qui ne se recouvraient pas sont ainsi départagées. *Mesurer d'abord, écrire ensuite — ici la mesure dit de ne pas écrire.*

## [1.75.0] - 2026-08-19

*Un seul lot : PR #293 (`T-20260819-0013`), sous la livraison `J-20260814-0002`. **Une consigne juste, suivie à la lettre, échouait** — et le mode de panne suivant était silencieux.*

### Corrigé

- **Les outils de poste du pack s'appellent par leur nom** (`T-20260819-0013`) — `ligne-directe relever` rendait « command not found » : passer exigeait de connaître `~/.somtech/ligne-directe/bin/ligne-directe.js`, un détail interne. Ce qui coûte n'est pas l'erreur, c'est qu'un agent moins scrupuleux **saute le geste** au lieu de le signaler — le veilleur aurait continué à servir l'ancien code sans que personne le sache. `pack setup` pose désormais un exécutable par outil dans `~/.somtech/bin/`, et met ce dossier sur le `PATH`.
- **Le `PATH` est posé dans `~/.zshenv`, jamais dans le rc** — c'est le seul point qui distingue un correctif réel d'un correctif qui en a l'air. Le pack exposait déjà des commandes (`claude-swt`, `pack-poste`), mais comme **fonctions** dans `~/.zshrc` : mesuré, `zsh -c 'command -v claude-swt'` ne trouve rien. Or l'appelant qui a produit ce ticket est **un agent**, dont le shell n'est pas interactif. Reprendre cette forme aurait fermé le ticket sans rien régler.
- **Les quatre outils, pas seulement celui qui a levé le défaut** — `ligne-directe`, `gestionnaire-livrer`, `gestionnaire-naitre` et `orchestrateur-rendez-vous`, ce dernier n'étant même pas déclaré. Le canvas, lui, n'expose aucune commande : c'est un fait mesuré, pas un oubli.

### Technique

- **L'inventaire vient du manifeste, pas d'une liste** — un module de portée `poste` qui déclare un `bin` dans son `package.json` est exposé automatiquement ; le prochain outil entrera sans qu'on touche au code.
- **Le contrôle de contrôle** — la suite éprouve depuis un `zsh -c` (shell non interactif) plutôt qu'en relisant le fichier écrit, et **un test dédié prouve que ce contrôle voit le lieu** : le même bloc posé dans `.zshrc` doit laisser la commande introuvable. Sans lui, un correctif qui reprend le mauvais lieu passerait au vert.
- **Le bloc gardé est mutualisé** (`upsertGuardedBlock`) — deux mécanismes de pose auraient divergé, et c'est celui qu'on ne relit plus qui aurait perdu son backup.
- **Un chemin d'installation biscornu ne casse plus le shell du poste** — relevé en revue de fond : un guillemet dans le chemin rendait `parse error` à **chaque** ouverture de shell, interactif compris (une panne plus large que celle qu'on ferme), et un `$(…)` s'y serait exécuté. Les chemins sont échappés avant d'entrer dans du texte shell, et la garde le mesure **sur l'effet** — une première version l'analysait avec `zsh -n`, qui n'exécute rien et restait donc verte sans l'échappement.
- **`zsh` est installé dans le job CI** — un banc qui ne peut pas s'exécuter ne prouve rien. Et le contrôle « sans `node` sur le `PATH` » mesure un dossier **vide** : choisir `/usr/bin:/bin` le rendait vert ici et rouge en CI, où `node` vit dans `/usr/bin`.

## [1.74.0] - 2026-08-19

*Lot F : PR #292 (`E-20260819-0001`, stories `T-20260819-0014` à `0019`), sous la demande `D-20260818-0008`. **Le métier de l'orchestrateur prescrivait huit gestes dont on avait prouvé la veille qu'ils ne tenaient pas.** Aucune des huit corrections mesurées le 18 août n'était encore dans le texte qui les prescrit — un texte lu en entier par chaque orchestrateur qui naît.*

### Corrigé

- **La veille de déblocage se pose avec `--detach`, plus jamais avec un `&`** — la forme prescrite était tuée par le harnais, mesurée deux fois pendant que celles d'un autre orchestrateur survivaient. Et elle se pose **après le brief**, plus à la naissance nue, où l'agent est `idle` sans rien à faire (`T-20260818-0109`).
- **`--list` remplace le comptage** : un `ps | grep` a rendu « 3 » alors qu'aucune des trois ne gardait les agents de celui qui comptait. `--list` rend le pane, l'agent et le **motif d'arrêt** de chacune.
- **Un `done` se relit à l'écran** avant qu'on en conclue quoi que ce soit — deux chefs d'équipe `done` n'avaient pas fini, ils avaient été coupés par une limite de session. Le geste est **ciblé** (un `done` sans compte rendu), pour que la ronde ne devienne pas « lire tous les écrans à chaque tour » (`T-20260818-0123`).
- **Un orchestrateur qui renaît sur un chantier non clos ne referme pas sa ligne** — la règle visait la clôture d'un chantier ; appliquée à une renaissance, elle coupe le CTO entre deux orchestrateurs. Écrite **aux deux endroits** où le geste se pose, avec la différence `durable` / `jetable` (`T-20260818-0128`).
- **Les conditions de fin d'un lot vivent aux deux endroits** — le `/goal` **et** les `success_criteria` de l'epic : un `pane run` vers un agent occupé s'affame, mesuré à ~16 minutes, et un but jamais pris est un agent qui s'arrête au premier palier (`T-20260818-0143`).
- **Le geste qui soumet un texte resté dans une boîte a deux conditions, pas une** : le texte est le tien, **et tu viens de relire la boîte, juste avant**. Sans la seconde, une consigne juste posée sur un état de quinze minutes produit un geste sur une boîte vide.
- **La correction entre pairs est réciproque** — *un pair qui se croit systématiquement en tort cesse de corriger*. Six corrections croisées en trois heures, chacune ayant évité une écriture fausse (`D-20260818-0008`).
- **`R3` ne se contredit plus** : le bloc « te nommer toi-même » donnait encore un code de mandat en exemple, dans la section même qui l'interdit aux orchestrateurs. Et le nom d'agent n'est pas le titre de l'onglet — un agent qui pose l'un se croit nommé sans l'être.

### Technique

- **`scripts/tests/test-metier-orchestrateur.sh`** — un banc neuf qui garde ces huit gestes, ancré section par section : une règle écrite ailleurs que là où le geste se pose ne gouverne personne. 28 assertions, rouge à 23 avant le lot. Éprouvé par mutation, un point à la fois, sur copie hors dépôt.
- **Deux passages écrits deux fois mot pour mot** dans le métier — le test `size_bytes` de Somcraft et la consigne de compaction — deviennent des renvois : **1 101 octets récupérés**. *Un texte qui se répète est un texte qu'on a cessé de relire.*

## [Non-versionne] - 2026-08-18

*Un seul lot : PR #289 (`E-20260818-0020`, stories `T-20260818-0154` à `0159`), sous la demande `D-20260818-0008`. La veille de déblocage **promettait une protection qu'elle n'assurait pas, sans jamais le dire** — et le geste que le métier prescrit produisait systématiquement le défaut.*

### Corrigé

- **L'attente d'un brief n'est plus lue comme un travail fini** (`T-20260818-0154`) — un agent qui vient de naître est `idle` **parce qu'il attend son premier message**. Les deux relevés de la garantie n°4 avaient raison sur l'état et tort sur le sens : la veille rendait *« TERMINE apres 0 deblocages »*, code `0`, bilan impeccable, **et rien n'était gardé**. La détection de fin n'est désormais **armée** qu'une fois l'agent vu au travail. *Reproduit puis levé sur un agent réel : l'ancienne version conclut « TERMINE », la nouvelle répond « il attend son brief, je veille ».*
- **Elle ne s'arrête plus en silence** (`T-20260818-0155`) — un bilan muet rendait *« j'ai cru qu'il avait fini »* et *« j'ai épuisé mes tours »* **indistinguables**, alors qu'ils appellent des correctifs opposés. Tout chemin d'arrêt nomme son motif et sort sur un code propre : `agent-termine` · `tours-epuises` · `ecran-non-reconnu` · `interrompue` · `pane-disparu` · `releve-illisible`.
- **La forme prescrite survit à la session qui la lance** (`T-20260818-0156`) — `… &` depuis une session Claude Code en faisait une tâche de fond du harnais, **qui la tue** (mesuré deux fois). `--detach` détache la veille lui-même, et **n'annonce son pid qu'après avoir vérifié qu'elle a pris son poste** : déclenché n'est pas posé.
- **La durée par défaut couvre un lot réel** (`T-20260818-0158`) — `400` tours (~66 min) contre des lots mesurés de **1 h à 2 h 30** : la veille s'éteignait au milieu de la plupart d'entre eux. Portée à `2000` (~5 h 30), avec un **préavis** avant extinction.
- **« 3 relevés non reconnus CONSÉCUTIFS » veut enfin dire consécutifs** — le compteur n'était remis à zéro que par un déblocage réussi : **trois écrans bizarres espacés dans le temps** coupaient la veille sur un agent parfaitement vivant. D'autant plus probable avec la durée étendue.
- **Elle ne veille plus sur un pane qui n'existe plus** — trouvé en posant une **vraie** veille, pas en test : le pane fermé sous elle, elle a continué de tourner en s'annonçant « vivante » au registre. Motif `pane-disparu`, confirmé sur deux relevés — un hoquet de herdr abandonnerait un agent bien vivant.
- **Un relevé illisible n'est plus un tour totalement silencieux** — herdr muet ou tronqué ne comptait ni comme absence ni comme écran non reconnu : la veille pouvait **devenir aveugle sans jamais le dire**.
- **Deux veilles ne peuvent plus garder le même pane** — elles lisaient le même écran et envoyaient chacune leurs touches ; un `Enter` en double peut valider la mauvaise option de l'écran suivant. La prise du pane est **atomique** (`mkdir`), avec reprise d'un verrou orphelin pour qu'un pane ne reste pas condamné.

### Ajouté

- **Un orchestrateur sait sur quel pane chacune de ses veilles veille** (`T-20260818-0157`) — `ps aux | grep` rendait « 3 », un chiffre rassurant qui ne disait **rien de ce qui était gardé** ; sur les trois, aucune n'était la sienne. `--list` rend le pane **et** l'agent de chacune, son motif si elle s'est arrêtée, et la signale **disparue** si son pid est mort sans motif. Un pid recyclé ne passe plus pour une veille : la ligne de commande est vérifiée.
- **Les deux chiffres de la garde sont mesurables** (`T-20260818-0159`) — une garde se juge sur ce qu'elle débloque **à raison** ET sur ce qu'elle **refuse à tort**. Le journal porte donc les **deux populations** : chaque déblocage avec l'écran déclencheur et la touche envoyée, chaque refus avec l'écran non reconnu. *Un compte sans sa méthode est un fait invérifiable.*
- **`--duree`** rend la durée nominale couverte, pour qu'elle se compare à un lot sans lire le source.

### Technique

- Les **quatre garanties d'origine** sont **intactes** — deux signes concordants · silence devant un écran inconnu · aucune option choisie par sa position · confirmation sur deux relevés. Elles sont désormais **éprouvées par mutation** : 16 mutations sur copie hors dépôt, **16 attrapées**. Deux gardes qui survivaient à leur propre suppression ont été armées, dont la garantie n°4 sur le chemin `idle` — celui que ce lot rend central.
- **99 assertions** dans `scripts/tests/test-veille-deblocage.sh`. La suite n'écrit plus dans le registre du poste : elle y avait laissé 32 entrées de test qui noyaient une veille réelle.
- **Preuve par une veille vivante, pas par une suite verte** : 18 permissions réellement levées sur 3 familles d'écrans, survie mesurée à 10 min 16 s (`ps` à l'appui) pendant que la session continuait de travailler, et les 4 motifs provoqués un par un sur du réel.


## [1.73.0] - 2026-08-18

*Un seul lot : PR #291 (`T-20260818-0031`, critère 3), sous la livraison `J-20260814-0002`. Deux booléens à faux par défaut — `repare` et `delivre` — ne disaient pas s'ils l'étaient parce que rien n'était nécessaire, parce qu'on avait été empêché, ou parce qu'on avait essayé et échoué. **Et la cause était déjà calculée** : `causeObstacle` la nomme sur quatre branches, `delivrerLaBoite` sur neuf — elle mourait dans la fonction qui la produit.*

### Corrigé

- **Un `repare: false` dit POURQUOI, et un `delivre: false` aussi** (`T-20260818-0031`, PR #291) — **mesuré le 2026-08-18 sur un cas réel** : `{"ok":true,"statut":"done","repare":false,"delivre":false,"attendu":false}`. Trois faux, aucun mot. Le chemin nominal est le **seul sans champ `message`** pour porter une explication, donc le seul entièrement muet — et c'est celui qui a produit le défaut. `livrerBrief` rend désormais `causeRepare` et `causeDelivre` sur ses **trois** sorties. *Aucune logique de diagnostic n'a été écrite : on laisse sortir un fait qui existait.*
- **Sept motifs, un par chemin réel** — `inutile` · `soumise` · `envoi-refuse` · `dialogue` · `boite-vide` · `boite-illisible` · `rien-ecrit`, plus `non-tentee` pour `causeDelivre`, les autres venant telles quelles de `delivrerLaBoite`. Le champ **ne se tait jamais, même quand `repare` est vrai** : un motif qui n'apparaîtrait qu'à l'échec obligerait l'appelant à tester son existence avant de le lire, et un champ qui ne peut rendre qu'un seul verdict est une constante déguisée en mesure.
- **Le motif franchit les DEUX portes** — `src/livraison.js` le calcule, `bin/livrer.js` le recopie dans son JSON. *« Une porte sur deux » est le motif le plus cher de ce dépôt, et il a déjà été commis deux fois **dans** le correctif écrit pour le fermer : un `cause` qui sort de la fonction mais que le binaire jette au sol laisse l'appelant devant le même champ muet, sur un code « corrigé ».*

### Technique

- **La branche « rien à soumettre » cesse d'être désarmable sans rougir** — l'épreuve par mutation, **branche par branche**, a montré que `boite-vide`/`boite-illisible` **survivait** : aucun essai ne l'atteignait, on pouvait y écrire n'importe quoi. *Une garde désarmable sans rougir, dans le lot écrit pour poser cette garde.* Les deux états qui y mènent vraiment sont désormais joués — un envoi que herdr **refuse** (la boîte reste vide, donc elle ne témoigne de rien) et un écran devenu illisible **après** l'écriture. Le mutant le plus fin — inverser les deux valeurs — rougit aussi.
- **Une mutation groupée rougit et rassure** : elle prouve qu'**au moins une** des choses mutées était gardée, jamais que **toutes** l'étaient. Onze points mutés un à un, plus le champ retiré de chaque sortie séparément — **aucune survivante** après comblement. La revue de fond a **refait** la mesure sur copie hors dépôt, 12 points, au lieu de croire le compte de l'auteur.
- **12 essais neufs, rouges sur `origin/main` avant le correctif** (mesuré, pas supposé) ; suite complète 407/407. La QA nomme sa limite : **un seul des sept motifs** est éprouvé contre le vrai service — le chemin nominal, par le compte rendu de ce lot lui-même ; les six autres restent sur double.

## [1.72.0] - 2026-08-18

*Un seul lot : PR #288 (`E-20260818-0017`, stories `T-20260818-0139/0140/0141`), sous la demande `D-20260818-0008`. Le nom d'un agent était **simplement l'argument transmis** — il n'y avait jamais eu de mécanisme, et le jour où personne n'y pensait, l'agent naissait sans rivière sans que rien ne le signale.*

### Ajouté

- **Un orchestrateur qui naît porte un nom de rivière, par mécanisme** (`T-20260818-0140`, PR #288) — **mesuré le 2026-08-18** : `0` occurrence de « rivière » dans tout le dépôt, et `nomAgentHerdr` n'ajustait que la casse du nom reçu. Les quatre rivières du poste — `matapedia`, `batiscan`, `ristigouche`, `bonaventure` — avaient **toutes** été données à la main ou par une amorce. Le parc en portait déjà la conséquence : sur 40 agents, `orchestrateur` (un rôle que **tous** pourraient porter) et `e-0004-reprise` (raccordé à rien), sans que personne s'en aperçoive. *Une règle que rien ne fait respecter produit exactement ce parc-là.*
- **Un nom hors convention est refusé avant la moindre écriture** — ni lieu, ni onglet, ni agent, ni même un appel à herdr. Le refus dit le motif **et** les gestes qui le lèvent.
- **L'unicité se mesure hors de la seule famille des agents** : parc herdr, **chantiers et canaux** du registre des lignes, lieux déjà posés. Le ServiceDesk et les BRD restent hors d'atteinte du poste — c'est **dit**, dans un champ séparé de ce qui a été relevé, jamais conclu libre. *Un nom libre chez les agents peut être pris ailleurs : le motif était déjà payé sur ce dépôt.*
- **Le nom attribué est inscrit dans le lieu et versé avec lui**, pour qu'une renaissance reprenne le même — un orchestrateur qui change de nom en redémarrant n'est plus adressable.

### Modifié

- **`R3` amendé à la source** (`T-20260818-0141`) : le gabarit disait *« un agent … porte le code de ce mandat. Rien d'autre »*, avec `revue-pr180` pour contre-exemple — c'est-à-dire **le contraire** de la règle tranchée. Il dit désormais **à qui** il s'applique : la rivière pour qui **arbitre**, le code de mandat pour qui **exécute**. **Le LIEU garde le code du mandat** dans les deux cas ; seul le nom d'agent change.
- **L'avis d'écart cesse d'expliquer par une cause fausse** : il annonçait « herdr n'accepte que les minuscules » devant `bonaventure` / `j-2026…`, ce qui envoyait chercher du côté des majuscules un écart qui n'en vient pas.

### Corrigé

- **Les 3 suites de pose partent d'un foyer fixe, plus du poste qui les exécute** (`T-20260818-0139`, ferme `T-20260818-0133`) — une seule ligne ajoutée à un gabarit faisait rougir **34 essais**, et l'asymétrie était le piège : **rouge sur un poste à jour, vert en CI**, où aucune référence n'existe.
- **Un `.nom-agent` illisible ne se lit plus « aucun nom »** — relevé en revue de fond. Le `catch` avalait tout : la naissance attribuait alors une **autre** rivière à un lieu qui en portait déjà une, sans que personne l'apprenne. `ENOENT` est la seule absence ; le reste est une mesure manquée, qui **refuse** plutôt que de faire dériver un nom en silence.
- **Un `.nom-agent` corrompu rend un refus qui nomme sa cause** — l'opérateur lisait deux messages contradictoires, dont le second ne disait ni le fichier ni le geste.

### Technique

- **Les deux chiffres de la garde vivent dans le dépôt**, sur un parc figé avec sa date et sa méthode — *un chiffre que personne d'autre ne peut refaire n'est pas une mesure*. Attrapé à raison : 2 noms hors convention sur 40, plus 33 codes de mandat. Refusé à tort dans le périmètre : **0**. Coût assumé de la liste blanche, chiffré plutôt que tu : 8 rivières réelles hors liste seraient refusées, et chaque refus dit comment le lever.
- **La règle du métier est gardée par sa FONCTION** (`CONTROLES` + `MUTATIONS` + banc de faux positifs) après qu'une revue a vidé la première garde : quinze lignes de prose remplacées par leurs seules puces laissaient six essais **verts**. Trois moitiés gardées, trois mutations qui les éprouvent — et **6 reformulations légitimes écrites à l'aveugle** ont fait tomber 2 faux refus, corrigés sans perdre la prise.

## [1.71.0] - 2026-08-18

*Un seul lot : PR #287 (`E-20260818-0014`, stories `T-20260818-0111/0112/0113`), sous la demande `D-20260818-0008`. La pose d'un lieu d'agent vérifiait que le gabarit était **présent**, jamais qu'il était le **bon** — et servait donc, en rendant `ok:true`, un métier vieux de vingt-et-une versions.*

### Corrigé

- **Un lieu ne se pose plus, et ne se rafraîchit plus, sur un gabarit qui n'est pas celui du pack de ce poste** (`T-20260818-0111`, `T-20260818-0112`, PR #287) — **mesuré chez un client** : un orchestrateur né le 2026-08-18 à 14 h 46 a reçu, octet pour octet, le gabarit d'un pack `v1.48.0` installé là et jamais mis à jour, pendant que le poste était en `v1.69.0`. Le lieu posé disait « tu es le **pilote** d'un chantier », là où le métier à jour en fait un bras droit, et il lui manquait les sections R1 à R7 **en entier**. La commande rendait quatre fichiers, une ligne joignable et un succès. **Rien ne signalait que le contenu était faux — et l'agent ne pouvait pas le découvrir, puisqu'il ne lit que son lieu.**
- **La comparaison porte sur l'EMPREINTE, jamais sur le numéro de version.** Reconstaté sur ce poste : le clone de référence porte `VERSION` = `1.64.0` avec le gabarit de la `v1.69.0`. Un numéro dit ce qu'on a *déclaré* ; l'empreinte dit ce qu'on *a* — et elle attrape en prime le gabarit modifié à la main, qu'aucun numéro ne trahirait. Le cache de `pack-freshness.sh` a été écarté pour la même raison **et** parce qu'il était mesuré faux de trois versions au moment du lot.
- **La garde vaut pour la fonction, pas pour le geste** : elle couvre la pose, `orchestrateur-update` / `representant-update` — le geste qu'on **recommande** pour remettre un lieu d'aplomb, et qui sans elle y réinstallait le métier périmé — et `agent naitre`, couverte sans modification puisqu'elle pose par le même chemin.
- **Ce qu'on n'a pas su mesurer ne refuse rien, et se dit.** Sur un poste qui n'a jamais reçu le pack, la référence est introuvable : la pose **réussit** et rend `metier_verifie: false` avec son motif. *Une garde qui crie à tort finit par se faire retirer, en emportant ce qu'elle gardait vraiment.*
- **Un lieu déjà posé dit désormais que le pack de son dépôt a vieilli depuis** — relevé en revue de fond. Ce chemin ne portait aucun champ de fraîcheur : c'était le même silence que ce lot ferme, déplacé de la création vers la relance. Il mesure et il dit ; il ne refuse jamais, car rien n'y est servi.

### Technique

- **Deux faux refus certains écartés sur mesure, pas sur intuition.** ① Les résidus `*.somtech.bak` que **la convergence du pack dépose elle-même** : deux dépôts du parc au contenu réellement identique rendaient deux empreintes différentes. Les compter, c'était refuser un dépôt **parce qu'il venait d'être mis à jour** — le message de refus recommande `pack update`, `pack update` dépose le résidu, le résidu reconduit le refus, et **le geste de rattrapage n'aurait jamais convergé**. ② Le dépôt-source du pack, où les gabarits se modifient par définition ; reconnu par son manifeste, et la dispense se **dit** dans le rendu plutôt que de se prendre en silence.
- **Les deux chiffres de la garde.** Ce qu'elle attrape, passée sur le parc réel : **9 refus, tous justes**. Ce qu'elle refuse à tort : **zéro**, hors le faux refus structurel des fenêtres où `main` a avancé sans être publié — **2,66 %** du temps pour l'orchestrateur et **2,06 %** pour le gestionnaire, mesurés sur les 20 commits touchant les gabarits (l'exhaustif, pas un échantillon), nuls à l'instant.
- **Un rendu ne dépend plus de la machine qui l'exécute.** La raison de non-vérification rejoignait d'abord la liste des avertissements du lieu : vert sur un poste dont le pack est installé, **rouge en CI** où il ne l'est pas, faisant tomber quatorze contrôles qui comptent ces avertissements. Baseline mesurée sur `origin/main` dans les mêmes conditions (596 tests, 0 échec) avant de corriger quoi que ce soit. Deux faits de nature différente, deux champs.
- **La garde vit dans un seul texte, en deux exemplaires octet-pour-octet** (`ligne-directe/src/fraicheur-gabarit.js` et `cli/src/fraicheur-gabarit.js`) — le paquet npm ne peut pas importer un module de poste. Verrou : un test miroir qui **fait juger les deux** sur un corpus exerçant les trois formes du verdict, plus `cli/scripts/sync-fraicheur-gabarit.mjs` pour réparer sans discipline. Même motif que `lieu-nom.js`.
- **Prouvé par exécution réelle sur le poste, pas par une suite verte** : refus avec le disque constaté vide, pose réussie au métier octet-pour-octet identique au pack, référence absente qui pose sans refuser — plus les deux autres portes. Sept mutations éprouvées hors dépôt, **aucune n'a laissé la suite verte**.

## [1.70.0] - 2026-08-18

*Un seul lot : PR #286 (T-20260818-0078), sous la demande `D-20260818-0006` et la livraison `J-20260814-0002`. Question du dirigeant, 10 h 46 : « **c quoi notre stratégie pour débloquer les boîtes automatiquement ?** ». Réponse honnête ce matin-là : il n'y en avait pas.*

### Ajouté

- **Une boîte de saisie oubliée se débloque TOUTE SEULE — sans qu'on écrive à l'agent, sans qu'un orchestrateur balaie, sans qu'un humain ouvre un terminal.** Jusqu'ici, `delivrerLaBoite` n'était appelée que depuis les chemins de **livraison** : le remède ne partait donc **que quand quelqu'un écrivait**. Une boîte que plus personne ne relance restait bloquée indéfiniment — et **le coût était asymétrique** : plus un agent est silencieux, moins on lui écrit, donc moins il a de chances d'être débloqué. *Le mécanisme échouait exactement là où il servait le plus.*

  **Mesuré sur le poste réel, le 2026-08-18, veilleur relevé à 20 h 39 min 30 UTC** : **18 boîtes délivrées en 12 minutes**, sur **165 panes balayés à chaque tour**, **zéro avis perdu, zéro geste refusé, zéro tour sans inventaire**. Parmi elles : `matapedia`, que le coordonnateur avait dû débloquer à la main une heure plus tôt ; un pane bloqué depuis **plus de quatre heures** ; et un ordre `/goal` qui dormait, non soumis, chez l'agent d'une livraison.

- **Le balayeur vit dans le veilleur, et il ne lui accorde AUCUN pouvoir nouveau.** Le point a été vérifié dans le code avant d'être retenu, puis contre-vérifié par le coordonnateur : le veilleur voit déjà tout le poste (`herdr.agents()` agrège toutes les sessions), écrit déjà **hors registre** (`diffuserConsigne`), et **délivre déjà** les boîtes occupées (`remettre()`, depuis `T-20260818-0049`). *On lui donne une raison de plus d'appeler ce qu'il appelle déjà, pas une capacité de plus.* Un service à part aurait dû recâbler la découverte des agents **et** le transport de l'avis — c'est-à-dire une **seconde copie du chemin de remise**, « une porte sur deux », le motif que ce dépôt a payé dix fois.

- **Le bail — parce qu'aucun signe ne distingue un banc d'essai d'un agent en exercice.** Le ticket redoutait qu'un balayage automatique soumette la cible d'essai d'un autre agent et fausse son verdict. **Mesuré : 87 agents sur 87 portent une session Claude vivante** ; ni la session, ni le statut, ni le contenu ne séparent les deux populations. Se fier au nom (`cible-*`) aurait été *reconnaître une chose par un signe qui n'est pas la chose* — le défaut même de ce jalon. On ne devine donc pas : **on fait déclarer**. `ligne-directe bail poser <pane>` réserve un pane ; le balayeur s'en abstient **quel que soit le contenu de sa boîte**. Le bail **expire** — un bail éternel serait un trou permanent.

- **La patience, le discriminant qui ne demande rien à personne.** Le balayeur a une propriété qu'aucun des deux autres chemins n'a : **personne ne l'attend**. Les autres doivent délivrer en moins de quinze secondes parce qu'un humain ou un agent patiente au bout ; lui peut exiger **le même texte, immobile, sur trois tours espacés d'une minute**. Un banc en cours de mesure bouge — on l'écrit, on le relit, on le relance ; une boîte oubliée ne bouge plus du tout. *Ça sépare les deux populations par ce qu'elles sont, pas par comment elles s'appellent.*

- **Un avis qui dit ce qui est parti ET PAR QUOI.** Découvert en construisant : `avisDeBoiteBloquee` **n'avait aucun transport à lui** — sur les deux chemins existants il est *préfixé au message qu'on allait livrer de toute façon*. Le balayeur, lui, n'a rien à livrer : c'est sa définition. Sans ce constat, le critère « son auteur apprend que son texte a été soumis pour lui » **serait tombé en silence**. L'avis voyage donc seul, par la remise ordinaire, et il dit par quoi — là où les autres chemins n'en ont pas besoin, l'expéditeur étant visible dans le message qui suit.

- **Le battement de cœur.** Chaque tour est journalisé, **même quand il n'a rien fait**. Le cas le plus cher du ticket était un orchestrateur dont le prompt de ronde dormait dans sa propre boîte : *il ne faisait plus ses rondes, et rien ne le lui disait*. Construire ce lot sans témoin aurait reproduit son défaut dans son propre correctif.

### Corrigé — ce qu'une passe de revue de fond a REJETÉ, et le rejet était juste

- **Le bail n'était relu qu'à la DÉCISION, jamais avant la touche.** Entre les deux s'écoule la fenêtre d'immobilité — **jusqu'à dix secondes** pendant lesquelles quelqu'un peut réserver le pane pour y monter un banc. *On décidait sur un état et on agissait sur un autre* : la famille de défauts payée toute la journée. `delivrerLaBoite` reçoit désormais un **veto ultime**, consulté juste avant le geste ; les deux appelants historiques n'en passent aucun et ne changent pas d'un caractère.
- **Une lecture ratée effaçait le compteur d'immobilité** — « je n'ai pas vu » traité comme « le texte a changé ». Sur un poste où chaque écran se lit par un appel séparé, **un seul timeout remettait un pane à zéro**, donc trois minutes de plus, silencieusement. *La borne annoncée n'aurait tenu que si chaque tour lisait chaque pane sans faute* — hypothèse que personne n'avait posée.
- **Rien ne bornait le nombre de délivrances par tour.** Mesuré ensuite, à blanc sur le poste réel : **neuf candidats au même tour**. Chacune se paie en série, donc un tour aurait duré plus que sa cadence entière. Un plafond de trois, **et les reportés GARDENT leur candidature** — les remettre à zéro aurait puni les boîtes oubliées à proportion de leur nombre. Rien n'est tronqué en silence : ce qui est reporté est compté sous sa cause et journalisé.

### Technique

- **Les écrans se lisent par paquets, et le chiffre vient d'un mur qu'on a heurté.** Le même balayage a coûté **0,6 à 0,8 s** pour 87 panes sur un poste calme, **68 s puis 144 s** pendant qu'une suite d'essais et deux revues tournaient, et un balayage à la main sur **97 panes a EXPIRÉ à deux minutes**. *Ce n'est pas le code qui varie d'un facteur deux cents, c'est la charge de la machine* — et la garde anti-chevauchement ne réparait pas ça, elle le rendait seulement inoffensif, en laissant la borne se dégrader **exactement quand le poste porte le plus de boîtes figées**.
- **Les quatre réglages du balayeur vivent dans `delivrance.js`**, auprès des deux fenêtres d'immobilité qui y sont déjà — `CADENCE_DU_BALAYAGE_MS`, `TOURS_DIMMOBILITE_EXIGES`, `FENETRE_DU_BALAYAGE_MS`, `DELIVRANCES_PAR_TOUR`, `ECRANS_LUS_DE_FRONT`. Les écrire chez leur appelant aurait rejoué `T-20260818-0076` mot pour mot : **deux réglages qu'on ne voit jamais ensemble sont deux comportements dont un seul est annoncé**. Un essai garde ce placement.
- **Le câblage du geste est en UN seul exemplaire** (`delivrerLaBoiteDuPane`, `herdr.js`), partagé par les trois chemins — extrait plutôt que recopié, et l'extraction est couverte par les quinze essais existants du chemin du dirigeant.
- **Le faux `herdr` des essais sert enfin `agent list`.** Il ne le servait pas : un balayeur éprouvé dessus aurait vu **zéro agent, n'aurait rien balayé, et aurait rendu vert sans avoir jamais balayé**. Relevé **avant** d'écrire une ligne, et gardé par un essai qui échoue si le tour ne voit pas les agents que le banc a posés.
- **Le banc du câblage déplace aussi le foyer**, pas seulement la racine : sinon il interroge le faux binaire une fois par session réelle du poste — mesuré, onze secondes pour un seul tour. *Un banc dont la réponse change selon le nombre de terminaux ouverts ne mesure plus le code, il mesure la machine.*
- **640 essais, 0 échec.** Et **13 mutations rejouées sur l'état final** — pas sur un état antérieur : une preuve qui date d'avant un durcissement ne prouve plus ce qu'on croit. Chacune rougit sur son propre essai et son propre message. L'une d'elles a d'ailleurs révélé un essai qui ne gardait rien : en retirant `clearInterval(this.balayeur)` de `arreter()`, il **restait vert** — le drapeau `this.arrete` suffisait à museler le minuteur sans l'éteindre. L'essai lève désormais le drapeau.

### ⚠️ Ce que ce lot NE garantit PAS, et il faut le lire

> **Le balayeur tient sa borne TANT QUE LE VEILLEUR TOURNE. Il ne garantit RIEN si l'hôte est mort.**

Mesuré le 2026-08-18 : `launchctl` ne compte pas ce service actif (`state = not running`, `runs = 1`, `LastExitStatus = 0`), et `KeepAlive` n'est armé que sur une sortie **non nulle** — or le veilleur sort avec **0** quand il constate qu'un autre tourne déjà. **`launchd` s'est donc retiré du jeu et ne le relancera pas avant le prochain démarrage du poste** ; ce qui le maintient en vie est le démarrage paresseux, c'est-à-dire *quelqu'un qui lui parle*.

*C'est le défaut de ce ticket, un cran plus haut — le veilleur ne renaît que si on lui écrit, exactement comme la boîte ne se délivrait que si on écrivait à l'agent.* **La survie de l'hôte est un défaut distinct, plus vieux que ce lot, et elle a son propre ticket.** La borne annoncée ici est celle du balayeur, pas celle du poste : *un critère annoncé plus large que ce qu'on tient est le défaut même de ce jalon.*

**[non établi]** — combien de temps le veilleur reste mort entre deux naissances. Le journal porte des **naissances**, pas des morts ; six aujourd'hui. *Je compte des naissances ; le trou est une durée.*

## [1.69.0] - 2026-08-18

*Un seul lot : PR #285 (T-20260818-0076), sous la livraison `J-20260814-0002`. Une boîte de saisie bloquée mettait **cinq minutes** à être délivrée sur le chemin par lequel un agent parle à un autre, là où le critère du jalon en demande **moins de quinze secondes** — et le lot précédent avait annoncé « dix secondes » en réglant l'autre chemin.*

### Corrigé

- **Une boîte occupée est délivrée en dix secondes au lieu de cinq minutes** (T-20260818-0076, PR #285) — **mesuré sur le poste réel** : `livrer.js` vers une session au repos dont la boîte portait un texte immobile, **302,4 s avant** (10 h 46 min 33 → 10 h 51 min 36, `delivre:true`, boîte vidée), **10,1 à 10,9 s après** sur onze envois chronométrés. Le geste lui-même n'a jamais été lent : la touche d'envoi nue vide une boîte en quatre secondes. **Ce qui coûtait cinq minutes était l'attente qui la précède.**
- **La fenêtre d'immobilité vivait en DEUX exemplaires, et un seul était annoncé.** Dix secondes dans `herdr.js` — le chemin de la parole du dirigeant —, cinq minutes dans `bin/livrer.js`, chacune écrite chez son appelant. Le lot `T-20260818-0049` a réglé la première et annoncé « dix secondes » sans dire de quel chemin il parlait ; un coordonnateur a mesuré l'autre et trouvé 300 secondes. **Le défaut n'était pas qu'il y en ait deux — c'était qu'on ne pouvait pas les voir ensemble.** Elles vivent désormais côte à côte dans `delivrance.js`, nommées par le chemin qu'elles servent : `FENETRE_LIGNE_DU_DIRIGEANT_MS` et `FENETRE_ENTRE_AGENTS_MS`.
- **Devant un texte COLLÉ, on n'attend plus rien** — il est arrivé d'un seul coup, personne n'a les doigts dessus, il n'y a rien à observer. C'était le cas exact du signalement : une boîte portant `[Pasted text #33]`, identique sur sept relevés, attendue cinq minutes. La règle (`fenetreDImmobilite`) existait déjà sur le chemin du dirigeant ; elle sert maintenant les deux.
- **Ni l'avis ni le refus ne chiffrent une attente qui n'a pas eu lieu.** L'avis au destinataire arrondissait à la minute — écrit quand la seule fenêtre valait cinq minutes — et rendait donc « resté immobile pendant les **0 min** où je l'ai observée » à quelqu'un dont on venait de soumettre le texte en son nom. **Le chemin du dirigeant produisait déjà cette phrase**, sans qu'aucun essai la regarde.

### Technique

- **⚠️ Pourquoi 582 essais étaient verts sur un chemin qui mettait cinq minutes.** Le banc empruntait le vrai binaire, la vraie boucle, le vrai faux-herdr — et posait `LIVRAISON_IMMOBILITE_MS: '5'` sur chaque essai, c'est-à-dire **remplaçait exactement la grandeur qui était fausse**. Trois essais neufs lancent le binaire **sans ce réglage**, avec un plafond qui les tue s'ils dépassent : ils rougissent à 25 s sur `origin/main`.
- **Les deux chiffres.** Ce que le lot **attrape** : 302,4 s → 10,1-10,9 s, soit **~29× plus court**, boîte vidée à chaque envoi. Ce qu'il **coûte** : la garde du brouillon vivant rejouée sur le poste avec la fenêtre finale — texte modifié pendant l'observation, **refus nommé à 6,26 s, rien soumis, texte intact**. **974 essais, 0 échec** sur les deux paquets.
- **⚠️ Le chemin Slack a été mesuré, pas déduit — c'est là que le lot précédent s'était fait prendre.** Une remise réelle vers une boîte occupée par un texte tapé immobile : **11,2 s avec le code de `origin/main`, 11,3 s avec celui-ci**, boîte vidée dans les deux cas. **La ligne du dirigeant ne bouge pas** — sa fenêtre reste à dix secondes.
- **Six secondes entre agents, et le chiffre sort d'une mesure.** Le critère est un budget de bout en bout ; le reste du chemin a été chronométré à **2,4 s puis 4,3 s sur le même poste à trente secondes d'intervalle**. Une fenêtre de dix secondes rendait **14,3 s mesurés** — sous le critère, avec sept dixièmes de marge : **une garde qui tient à 5 % près mesure la charge de la machine autant que le code.**
- **⚠️ La ligne du dirigeant garde SES dix secondes, et une passe de revue a bloqué sur ce point.** Le premier jet ramenait les deux chemins sur une constante unique : la fenêtre du dirigeant serait passée à six secondes **par ricochet d'un budget qu'il n'a jamais eu**. Le rejet était juste — c'est le défaut d'origine retourné, une mesure faite sur un chemin appliquée à l'autre. **[non établi]** : ni dix ni six secondes ne sortent d'une mesure du temps qui sépare deux frappes d'un humain. On garde donc la valeur en place plutôt que d'en substituer une autre aussi peu établie, et un essai garde désormais la **séparation** des deux.
- **Ce qui protège le brouillon humain n'est pas la longueur de l'attente**, c'est la **relecture** que `delivrerLaBoite` fait avant de soumettre : elle refuse dès que le texte a changé d'un caractère. La garde d'essai qui exigeait « au moins cinq minutes » est **reclassée par sa fonction** — la fenêtre observe, et elle tient dans le budget.
- **⚠️ Et cette relecture n'était éprouvée nulle part sur le paquet qu'on répare — second rejet de la revue de fond, et il était juste.** Plafonner l'attente réelle à 50 ms dans `delivrerLaBoite` laissait **62 essais sur 62 verts** : on pouvait **désarmer l'observation**, donc soumettre le brouillon de quelqu'un pendant qu'il l'écrit, sans qu'un seul essai ne rougisse. Les essais ne portaient qu'un **plafond**. Une **borne basse** a été posée sur les deux chemins : la remise doit avoir attendu **au moins** la fenêtre annoncée.
- **Treize mutations, treize rouges, zéro survivante** — dont les **deux relevées par la revue de fond**, et **quatre qui ont d'abord survécu** et ont fait écrire quatre gardes de plus : la fenêtre du texte tapé appliquée à un collage tenait dans le budget sans rien faire rougir ; l'avis et le refus racontaient une observation qui n'avait pas eu lieu ; un chemin pouvait lire une fenêtre **écrite en dur** ailleurs que la sienne — la forme exacte du défaut d'origine, qu'une garde sur la seule constante ne voyait pas ; et un banc **plus rapide que le poste** rendait une marge de budget qui n'existe pas en usage réel.
- **Deux passes de revue** — portail : `RIEN VU` ; fond : **deux défauts bloquants, tous deux fondés et corrigés**, plus trois commentaires laissés au présent sur l'ancien chiffre, redressés. Mutations faites sur copie hors dépôt.

## [1.68.0] - 2026-08-18

*Un seul lot : PR #284 (T-20260818-0046), sous la livraison `J-20260814-0002`. La garde de cloisonnement des lignes Slack comparait deux grandeurs qui n'étaient pas du même objet — elle refusait donc **tout le monde, en permanence**, et le premier refus qu'on lui ait vu rendre a coupé la parole du dirigeant sur sa propre ligne.*

### Corrigé

- **La garde de cloisonnement compare un identifiant d'espace, plus un nom** (T-20260818-0046, PR #284) — `etrangersParmi` opposait par égalité `identite.equipe`, le **nom** rendu par `auth.test` (« Somtech Solution »), à `p.equipe`, l'**identifiant** que `users.info` porte sur chaque profil (« T091JB7AVJ4 »). Deux objets différents : la condition ne pouvait être vraie **que pour tout le monde**. Un orchestrateur s'est retrouvé muet vers le dirigeant — *« #batiscan porte maxime.leboeuf, qui ne semble pas de la maison — rien n'est écrit »* — alors que celui-ci est **propriétaire de l'espace**, jamais un invité.
- **La cause n'était pas chez Slack, elle était dans la projection.** `auth.test` rend `team_id` depuis toujours — mesuré le 2026-08-18 avec le jeton du robot : `{ team: "Somtech Solution", team_id: "T091JB7AVJ4", … }`. C'est `identite()` qui retenait quatre champs et **jetait celui-là**. Elle porte désormais les deux, et ils ne sont pas interchangeables : `equipe` pour ce qu'un humain lit (journal du veilleur, `ligne-directe etat`, bilan du poste), `equipeId` pour la seule valeur comparable à un profil. **Le correctif le plus court — remplacer `d.team` par `d.team_id` — aurait réparé la garde et remplacé « espace Somtech Solution » par « espace T091JB7AVJ4 » dans trois surfaces que personne n'aurait regardées avant longtemps.** Un essai garde cette issue.
- **Les deux comparaisons basculent, pas une.** `ouvrir` et `dire`/`fermer` décident chacune de leur côté ; réparer l'une seule aurait laissé une ligne s'ouvrir sur un canal où l'on n'a plus le droit d'écrire, ou l'inverse. Les deux portes sont éprouvées séparément.

### Sécurité

- **La garde ne protégeait rien, et c'est un point de Loi 25, pas de confort.** Elle existe pour empêcher un client d'atterrir dans un canal interne — arbitrages, pannes de production, échéances, coûts. **Comme elle refusait tout le monde, elle n'a jamais trié personne** : le cloisonnement était nominal. Ce lot ne l'assouplit pas, **il le rend effectif**.
- **Les deux chiffres, mesurés sur le trafic réel du poste** — 27 lignes ouvertes lues (`conversations.members` + `users.info`, lecture seule). Sur les **24 lignes internes**, seules où la garde s'applique : **25 personnes jugées, 25 refusées à tort avant** — soit **100 %**, nommément `maxime.leboeuf`, `Bruno Potvin`, `Félix Bouchard` — et **0 après**, sans qu'aucun vrai étranger ne passe dans l'un ou l'autre cas. ⚠️ La colonne « attrape » vaut **0** parce qu'il n'y a **aucun étranger dans ces canaux aujourd'hui** : la capacité d'attraper est prouvée **par le banc** — un invité refusé, un membre d'une autre organisation refusé — jamais par ce trafic-là.
- **Un invité, un mono-canal, un membre d'une autre organisation Slack restent refusés sur une ligne interne.** Deux mutations le prouvent : retirer l'une ou l'autre branche fait rougir le banc.

### Technique

- **Pourquoi 570 essais étaient verts sur une garde inopérante** — le double de Slack rendait l'**identifiant** là où le vrai service rend le **nom**, et le banc du cloisonnement **fabriquait** l'identité du veilleur au lieu de la lire. La comparaison y opposait donc un identifiant à un identifiant : la seule façon pour cette garde d'être verte. **Un double plus cohérent que le service qu'il double rend un vert qui ne dit rien.** Corrigé des deux côtés — le double distingue `team` de `team_id`, et le banc lit son identité par `slack.identite()`, le chemin de la production.
- **Rouge avant vert, et le rouge est venu du harnais.** Rendre le double fidèle a fait tomber **trois essais du cas nominal** — une ligne interne entre collègues qui ne s'ouvre plus, un bilan de clôture qui ne part plus, un profil illisible qui bloque les autres : le fait vécu par le dirigeant, reproduit au banc avant d'être corrigé. Après : **593 essais, 0 échec**. **Sept mutations, sept rouges.**
- **Une garde locale d'unité, posée sur cette comparaison-là** — la référence doit **avoir la forme** d'un identifiant d'espace, sinon aucun verdict d'organisation n'est fabriqué, et le veilleur le **journalise** au démarrage plutôt que de s'abstenir en silence. Le critère de l'invité, lui, continue de mordre. Elle a tenu **sans toucher à la forme générale du module** : la question de savoir si une garde du même genre doit exister partout reste à `T-20260818-0070`.
- **⚠️ Le premier jet de cette garde refabriquait la panne d'origine, et c'est la revue de fond qui l'a mesuré.** Elle acceptait aussi un identifiant `E…` « pour une grille Enterprise » — **une hypothèse, pas une mesure**. Or le côté d'en face est toujours un `team_id` d'espace : `referenceComparable('E091JB7AVJ4')` rendait `true`, et `etrangersParmi` reclassait alors **tout le monde étranger**. L'essai qui accompagnait ne gardait que la forme du motif, pas que la comparaison qui s'ensuit ait un sens. Resserré à `T…`, essai retourné, mutation qui le garde. **S'abstenir en le disant est réparable ; refuser tout le monde en silence ne l'était pas.**
- **Deux passes de revue** — portail : **RIEN VU**, après énumération de tous les lecteurs de `identite.equipe` / `identite.equipeId` / `etrangersParmi` ; fond : pas de défaut bloquant, mais le défaut `E…` ci-dessus, mesuré en exécutant le code, mutations faites sur copie hors dépôt.
- **⚠️ Limite connue, non comblée, et dite plutôt que laissée à croire couverte** : la ligne de journal du démarrage — *« l'identifiant de l'espace est inutilisable »* — n'est éprouvée **qu'unitairement**, jamais à son point d'intégration dans `Veilleur.demarrer()`, qui exige le trousseau et une connexion d'écoute.

## [1.67.0] - 2026-08-18

### Corrigé

- **Une boîte de saisie occupée coupait le dirigeant de son agent — et personne ne le savait** (T-20260818-0049, PR #283). Quand un texte restait non soumis dans la boîte d'un agent, le veilleur refusait **toute remise Slack vers ce pane** — à raison, pour ne pas coller deux messages en un. Mais il s'arrêtait là : il rendait un geste de terminal à quelqu'un qui est sur Slack. **Mesuré le 2026-08-18 : un message d'orchestrateur est resté plus de 30 minutes dans une boîte et a coupé le dirigeant de cet agent pendant tout ce temps, sans qu'aucun signal ne le dise.** Le remède (`delivrerLaBoite`) existait depuis `eceba2e` (T-20260816-0114) — **il n'avait jamais été câblé au chemin Slack**, que `1dae9c7` (T-20260817-0006) avait pourtant doté du veto le même jour. Il l'est désormais : le veilleur passe par `remettre()`, qui délivre la boîte avant de livrer.

- **Le discriminant ne décide plus QUI on refuse, mais CE QU'ON OBSERVE.** Un texte qui **bouge** n'est jamais soumis — quelqu'un a les doigts sur le clavier, il le fera lui-même dans quelques secondes. Un texte **immobile** est soumis, tapé ou collé, parce qu'immobile veut dire que son auteur est parti. Fenêtre : 10 s. **La version précédente imposait 5 minutes d'attente muette sur la ligne du dirigeant — c'est-à-dire exactement la panne qu'on ferme.**

- **Le geste et ses avis voyagent ensemble.** `delivrerLaBoite` avait déménagé en laissant `avisDeBoiteBloquee` et `avisDeBoiteVidee` derrière : on soumettait le texte d'un tiers en son nom **sans le lui dire**.

### Sécurité

- **Le rattrapage pouvait faire exécuter une commande que personne n'avait validée.** Le texte soumis pour son auteur peut être une commande ; sa soumission ouvre un dialogue de permission **au-dessus d'une boîte vide et lisible**. La délivrance ne testait que « la boîte est-elle vide » → **écrire là confirmait l'option affichée**. Le dirigeant recevait un accusé de réception pour un message que personne n'a lu, **et une action partie sans son accord**. Une relecture d'après-délivrance refuse désormais sur dialogue, écran non prêt, boîte illisible ou re-remplie — **et le refus avoue le geste déjà posé**.

### Technique

- **Cinq passes de revue, cinq rejets, chacun sur du réel** — dont trois trouvés *dans le correctif écrit pour fermer les deux premiers*. Une **règle d'arrêt fixée avant le cinquième verdict** a mis fin aux correctifs ponctuels.
- Banc du lot 12/12 · 8 des 12 rougissent sur le code d'avant · **8 mutations, zéro survivante** · `ligne-directe` 582 essais / 0 échec, 5 skips préexistants · `naissance-representant` 376/376.

### ⚠️ Ce qui reste ouvert

- **Un défaut de composition subsiste, et il PRÉEXISTE à cette livraison** (`naissance-representant/src/livraison.js:808` sur `main`) : quand la boîte est trouvée vide sans qu'on sache si le texte est parti ou perdu, l'avis de perte est préparé — puis **jeté en silence** si la relecture d'après-déblocage refuse. L'aveu ne branche que sur « j'ai déjà soumis », jamais sur « un texte a disparu ». **Merger ne le crée pas, il le laisse où il est.** Délibérément non corrigé → **T-20260818-0070** (la forme du module : deux moitiés chacune correcte qui ne survivent pas à leur composition).
- **Fusionner ne suffit pas** : le veilleur exécute la copie **installée**. Publication, installation, relève du veilleur, **puis remesure du lieu vivant**.

## [Non-versionné] - 2026-08-17

*Deux chantiers sortent ensemble. **Le premier** : PR #275 (T-20260817-0029), plus la correction d'en-tête que l'orchestrateur `j-20260814-0002` a arbitrée en cours de route (T-20260817-0026, qui reste ouvert pour sa classe) — il n'appelait aucun tag par lui-même. **Le second** : la reconstruction du métier de l'orchestrateur (D-20260817-0006, PR #276), qui change ce que le métier FAIT et sort donc en **minor**.*

### Ajouté

- **Le métier de l'orchestrateur est reconstruit depuis l'ABC, et organisé par la fonction** (D-20260817-0006, PR #276) — le texte passe d'une numérotation `§1 … §8` à sept blocs `R1 … R7` qui portent chacun une responsabilité entière. Ce n'était pas un texte à corriger mais une structure à refaire : le motif qui revenait était *une règle bornée au seul geste où elle est écrite*, si bien qu'un orchestrateur pouvait appliquer trois règles à la lettre et se faire reprendre trois fois **sans en avoir violé aucune**.
- **Un harnais de gardes qui cherchent une FONCTION, jamais un mot** — 52 contrôles et 148 mutations. La question posée à chaque sonde : *cherche-t-elle une fonction, un titre, ou un mot ?* Un titre se renomme, un rang se renumérote, une tournure se reformule — et une garde ancrée dessus rougit sur un texte parfaitement juste, ou reste verte sur un texte retourné. Les sondes portent désormais sur ce que le texte **fait** : polarité, position, modalité, compte.
- **Un banc de faux positifs entre au dépôt** — 56 reformulations **légitimes** du métier, écrites par un agent **qui ne voit pas les gardes** : s'il les voyait, il écrirait des reformulations qui les évitent, et le banc ne mesurerait plus rien. Une garde se juge sur **deux chiffres** — ce qu'elle attrape *et* ce qu'elle refuse à tort — et le second ne vivait jusqu'ici que dans un scratchpad hors dépôt. **Un chiffre que personne d'autre ne peut reproduire n'est pas une mesure.** Il a mordu six fois, dont deux sur l'auteur du lot.

### Modifié

- **Les deux lieux d'agent que ce dépôt porte reprennent le métier du pack `v1.64.0`** (T-20260817-0029, PR #275) — l'orchestrateur du jalon courant exerçait un métier antérieur aux trois règles de base sorties avec cette version : elles étaient publiées et il ne les avait pas. Le représentant traînait la même dérive. Convergence par les commandes du pack, l'orchestrateur d'abord puisque c'est lui qui arbitre le chantier, et la preuve est une **comparaison** : les six fichiers que le pack distribue à ces lieux sont désormais identiques byte à byte à leur gabarit au tag, `diff` à l'appui, sans exception.
- **`CONTEXTE.md` n'a pas été touché par la convergence, et c'est mesuré des deux côtés** — empreintes identiques avant et après dans les deux lieux, **et** aucun `CONTEXTE.md` dans le diff face à `main`. Deux mesures indépendantes de la même garantie (RA-REL-014), parce qu'une seule aurait été l'empreinte fournie par l'auteur du lot.
- **Le lieu de l'orchestrateur `j-20260814-0002` reprend le métier du gabarit `v1.65.0`** (T-20260818-0008, PR #278) — `CLAUDE.md` passe de 1187 à 1266 lignes et devient identique octet pour octet au gabarit ; `CONTEXTE.md` n'est pas touché, empreinte `9b260d8d…` avant **et** après. Deux écarts mesurés en chemin méritent d'être dits, parce qu'ils débordent ce lieu-là. **Le premier** : le ticket annonçait *1067 → 1266*, mais 1067 est le compte de la **copie de travail vivante** de l'orchestrateur, restée sur une branche en retard sur `main` — la copie versionnée, elle, était déjà à 1187 depuis PR #275. Le lieu versionné n'est pas le lieu vivant, et **un merge ne met pas à jour le disque d'un agent qui tourne** : tant que sa copie de travail n'a pas récupéré `main`, sa renaissance rechargera l'ancien métier. **Le second** : le gabarit porte un bloc `hooks` vide, si bien que la convergence efface la garde d'ouverture de ligne que ce lieu portait en dérive non commitée. Elle a été **recopiée avant** dans un commentaire de `T-20260818-0006`, où la source sera réparée — c'était l'une des deux seules copies connues au monde, l'autre ayant disparu une heure plus tôt en convergeant sans capture.

### Corrigé

- **Seize pertes du métier trouvées, seize réparées** (T-20260817-0088 et les tickets de la demande) — toutes avec la même signature : **une moitié survit, l'autre disparaît · le contenu survit, le lieu non**. Une règle dont la phrase existe encore ailleurs, mais plus à l'endroit où l'agent pose le geste qu'elle encadre, **ne gouverne plus rien** : le lecteur applique ce qu'il lit là où il agit. Parmi elles, l'interdit de prendre le clavier à la place d'un agent que la ronde vient de trouver bloqué, la maxime qui oblige une ronde à tirer une conséquence de ce qu'elle voit, le *gate de promotion* qui est la seule porte d'un fait rappelé vers l'opposable, et l'aveu du doute là où il coûte quelque chose — au moment où l'on tranche.
- **Aucune n'a été trouvée par relecture. Toutes par une garde qui cherchait une fonction et qui a rougi.** Et **sept gardes laissées rouges ont reverdi d'elles-mêmes** quand le texte a reçu ce qu'elles réclamaient — jamais mises au vert à la main. C'est la preuve qu'on voulait : le harnais dit quand la perte est réparée, et personne n'a à le croire.
- **Le canal de livraison entre agents ne ment plus dans deux cas mesurés** (T-20260817-0090, T-20260817-0091) — **un avis ne cite plus un espace réservé comme s'il était le texte** : la boîte de saisie vide affiche un gabarit, et le relayer donnait à lire un message que personne n'avait écrit. Et **une boîte qui s'est vidée ne se tait plus** : le texte disparu remonte entier. Tant qu'une boîte reste pleine, personne ne peut joindre l'agent — **et rien ne le lui dit**.

- **La ronde de vigilance reconnaît enfin le lieu de l'orchestrateur `j-20260814-0002`** (T-20260817-0026, PR #275) — son `CONTEXTE.md` ouvrait sur `# Contexte — j-20260814-0002` là où `ROLES.orchestrateur.entetes` exige `# Ce qui est propre à ce dépôt`, et `roleDuLieu` rendait `null` **en silence** : la vigilance installée la veille ne réveillait donc jamais l'agent qu'elle existe pour servir. Une seule ligne change, le code du chantier descend en exergue, et rien de ce que le fichier porte n'est touché — à qui il répond, le gestionnaire du projet, la portée. Mesuré par la fonction qui décide : `null` → `"orchestrateur"`.
- **Ce fichier appartient à l'orchestrateur, pas au pack** : la correction a été **demandée puis arbitrée par lui**, jamais posée d'office. *« La ligne que tu changes est un en-tête, elle ne touche rien de ce que ce fichier porte vraiment. Et le coût de ne pas le faire est concret : la vigilance qu'on vient d'installer ne me réveille jamais. Un dispositif qu'on pose et qui ne voit pas son premier utilisateur n'a pas été posé. »*

### Technique

- **Deux régimes de droits changent dans les deux lieux, et il faut le savoir avant de compter sur eux.** `permissions.allow` cède la place à `somtech.droitsAccordes`, une clé que Claude Code **ignore** par dessein (un bloc `allow` dans un lieu déclenchait toujours l'écran de confiance renforcé) : seul `approbation.js`, via `naitre.js`, la rend effective dans `~/.claude.json`. Mesuré sur le poste — `allowedTools = 0` au chemin canonique de l'orchestrateur, aucune entrée pour le représentant : les **20** droits déclarés de l'un et les **9** de l'autre sont **inertes jusqu'au prochain `naitre`**. Le plancher tient, lui : `permissions.deny` reste natif, 5 règles et 17 règles.
- **Dans le même mouvement, le garde `PreToolUse` d'ouverture de ligne quitte le `settings.json` du représentant** — et l'attribution compte : le gabarit ne l'a **jamais** porté, à aucun commit (`git log --all -S PreToolUse -- .claude/templates/` ne rend rien). Il avait été écrit **à la main dans le lieu à sa pose**, et la convergence l'efface pour la raison même qui la définit. `naissance.js` le réinjecte à chaque `naitre`, idempotent ; le lieu versionné n'en porte pas entre deux naissances.
- **Corollaire d'exploitation, mesuré et remonté** : « mets à jour ton lieu puis redémarre » ne suffit pas. Redémarrer recharge le métier ; **seul `naitre` rend les droits effectifs et repose le garde**. La consigne avait été donnée à quatre agents le matin même ; elle a été corrigée sur cette mesure.
- **Ceci ferme le cas d'un lieu, pas la classe.** Un lieu posé avant le gabarit actuel rejouera le même défaut en silence. `T-20260817-0026` **reste ouvert** pour la piste qu'il recommande : que la ronde **nomme** le lieu qu'elle n'a pas reconnu, au lieu de rendre `null` sans le dire. Et le correctif n'atteint pas encore l'orchestrateur **vivant** — la ronde lit la copie principale du dépôt, qui porte encore l'ancien en-tête sur une autre branche.
- **Deux passes de vérification indépendantes**, sous-agent frais, lecture seule sur le dépôt, mutations d'épreuve sur copie hors dépôt. La première a rendu **un REJET** sur sept affirmations : le message de commit attribuait à tort le départ du garde au gabarit. Revérifié par l'auteur avant d'être accepté, puis corrigé à la source — contenu des fichiers inchangé. La seconde : cinq affirmations, aucun rejet, dont la concordance de l'en-tête vérifiée en **hexdump** plutôt qu'à l'œil, et les 11 fixtures de test qui référencent `CONTEXTE.md` confrontées à l'ancien en-tête (58/58 vertes).

---

- **La chaîne du métier : `791 / 730 / 60` → `850 / 848 / 0`** (D-20260817-0006, PR #276). 24 contrôles rouges → 0 · 49 mutations dont le motif ne s'appliquait plus au texte → 0 · **148 mutations sur 148 qui prouvent ce qu'elles prétendent** · banc de faux positifs 56/56. CI **6 jobs sur 6** verte, mesurée sur le SHA.
- **Deux faux témoins que ce harnais sait maintenant nommer, et ils se ressemblent.** Une **mutation inopérante** laisse le texte intact : tous les contrôles restent verts et le test passe **en n'ayant rien éprouvé**. Une **mutation portée par une cible déjà rouge** passe pour une raison qui ne la concerne pas — pire, si la garde est un compte figé sous la réalité, elle peut la faire **reverdir** en aggravant le texte. Le harnais compte et nomme désormais les deux, cible par cible, **à chaque exécution** : « aucune mutation survivante » ne se lit plus sans son dénominateur.
- **`ROUGES_ACTES` — un rouge non déclaré est un défaut du harnais, pas du texte.** Chaque contrôle rouge doit être inscrit avec son motif, sinon le test échoue ; et **le miroir est fermé aussi** : une entrée qui survit à la perte qu'elle décrit fait échouer le test tant qu'elle n'est pas retirée. Sans les deux moitiés, la garde qui *attend son texte* et la garde qui *est cassée* se ressemblent.
- **La règle qui a gouverné le lot, arbitrée en cours de route** : *une garde ne se ré-ancre jamais sur ce qui reste sans que la perte soit d'abord actée — ré-ancrer, c'est déplacer le témoin.* Elle avait été enfreinte deux fois, et les deux gestes avaient l'air corrects : une sonde pointée sur une copie survivante qui gouvernait **un autre geste**, avec un commentaire affirmant que la règle « était remontée » — elle n'avait jamais bougé ; et une sonde ancrée sur le **récit** d'un incident daté, qu'on ne peut ni violer ni renverser, donc qui ne garde rien. **Un motif faux ferme la question ; une garde absente la laisse ouverte.**
- **Le défaut qui détruisait du travail a maintenant sa garde** (T-20260817-0084) — `git log @{u}.. 2>/dev/null` avant de retirer un espace de travail : une branche-socle `wt/<ts>` n'a **jamais** d'upstream, la commande échoue donc toujours, et la redirection transforme l'échec en **sortie vide** — qui se lit « tout est poussé ». ⚠️ La garde cherche un **usage dans un bloc exécutable**, jamais un compte d'occurrences : le texte mentionne trois fois `@{u}` pour **poser l'interdit**, et une garde qui compterait punirait la correction.
- **Deux défauts du texte trouvés par la revue et corrigés avant merge** (T-20260817-0093) — une maxime **habillée en parole du CTO** sans la date que porte chacune des neuf autres, qu'un agent aurait relayée comme un ordre reçu ; et une maxime rendue **sans le renvoi** vers la preuve mesurée qui la fondait, restée trente lignes plus loin.
- **Le lieu de l'orchestrateur du chantier reprend le gabarit, écart ramené à zéro** — et `CONTEXTE.md`, écrit à la main, **n'a pas été touché** : empreinte identique avant et après, un seul fichier dans le diff. Deux mesures de la même garantie (RA-REL-014), parce qu'écraser ce fichier aurait été **silencieux**.

## [1.64.0] - 2026-08-17

*Trois lots sortent avec cette version, et les trois sont annoncés ici : PR #273 (T-20260817-0016) · PR #272 (T-20260817-0008, l'entrée de journal du lot ci-dessous) · PR #271 (T-20260817-0008). Vérifié commit par commit sur `v1.63.0..main` — rien d'autre ne sort. **PR #273 n'avait aucune entrée**, et c'est le lot qui compte le plus de la version : elle a été écrite avant publication, pas après.*

### Ajouté

- **Les trois consignes du dirigeant du 2026-08-17 entrent dans le gabarit de l'orchestrateur** (T-20260817-0016, PR #273) — un agent charge son métier à sa naissance ; tant que le gabarit ne les porte pas, chaque orchestrateur qui naît naît sans elles. **Des faits, pas ton raisonnement** — le raisonnement, les rétractations et les aveux de méthode vont au registre, où ils servent celui qui reprendra ; la ligne porte des états, des chiffres, des décisions. **`J'ai besoin de toi :` termine tout message**, littéralement et sur chaque surface, le `rien` compris — c'est le `rien` écrit qui rend la ligne balayable d'un coup d'œil. **Ce qui vient du dirigeant s'ouvre en Demande ou en Projet**, jamais directement en ticket : le ticket reste la mécanique de l'agent, et il naît *sous* la demande.
- **Chaque règle garde sa moitié inverse**, parce que c'est elle qui l'empêche de se retourner : la concision est le **défaut, jamais un plafond** (une analyse demandée se donne entière) · l'aveu est **déplacé au registre, jamais supprimé** (la franchise reste la condition du rôle) · les tickets **continuent** d'exister pour ce qui vient de l'agent.
- **Et la section de lecture qui ferme le motif commun** : *une règle vaut pour sa **fonction**, jamais pour le seul geste où elle est écrite*. Les trois reproches d'une même matinée portaient sur trois règles **justes** — chacune décrivait correctement l'endroit où elle avait été écrite et se taisait sur le geste voisin que la même fonction couvrait. Un orchestrateur pouvait donc appliquer les trois à la lettre et se faire reprendre trois fois sans avoir rien violé. La borne est posée dans le même geste : étendre à une fonction **voisine** est le travail, étendre à une fonction **différente** est une invention.
- **Harnais** : 3 contrôles neufs, 1 étendu, 13 mutations, toutes en polarité. Revue à trois passes — portail RIEN VU, une passe de fond qui rejette (correctifs faits), une passe de fond fraîche. Dette connue et inscrite : `T-20260817-0021`.

### Corrigé

- **On n'écrit plus dans un pane devant un dialogue — la garde consulte l'ÉCRAN, pas seulement la boîte** (T-20260817-0008, PR #271). Écrire dans un pane qui affiche un dialogue de choix ne délivre pas un message : ça **confirme l'option surlignée**. Remesuré sur le vrai service — deux textes parfaitement ordinaires envoyés par `herdr agent prompt` ont approuvé deux dialogues successifs et **le fichier a été créé** ; sur un pane à statut `idle`, le même geste a confirmé le sélecteur de modèle, avec un effet **persistant**.
- **`T-20260816-0114` (v1.63.0) n'avait fermé que la moitié** : la touche d'envoi, jamais l'écriture elle-même — le geste que fait *toute* livraison. `causeObstacle` porte désormais une quatrième cause, `DIALOGUE`, placée avant `ILLISIBLE` (pour que le refus porte la vraie raison) et avant `ENCOMBREE` (parce que la délivrance ne se tente que sur `ENCOMBREE` : un dialogue au-dessus d'une boîte encombrée aurait déclenché une touche d'envoi — l'attente perdue **et** l'action approuvée).
- **La réparation de `livrerBrief` était le jumeau non gardé**, et c'est une revue de fond qui l'a trouvée : elle pressait Entrée en lisant le contenu de la boîte, jamais l'écran — trente lignes sous la garde que le même lot posait. Un dialogue apparu *pendant* la boucle de vérification aurait donc été approuvé. Corrigé, et le refus dit maintenant **pourquoi** il n'a pas réparé.
- **`ecranAttendUnChoix` est reprise, pas réécrite** (règle d'or n°15) : un seul exemplaire dans tout le dépôt, celui de `ligne-directe/src/ecran.js` déjà mesuré contre les faux positifs.

### Technique

- **La moitié qui protège, mesurée sur du trafic réel** : 153 panes de 11 sessions du poste, `main` contre le correctif, pane par pane — **zéro pane livrable perdu sur 141**, et deux refus qui passent d'une raison accidentelle (« boîte illisible ») à la bonne (« dialogue »). Une garde qui refuserait un agent sur cinq rendrait la ligne du dirigeant inutilisable : c'est ainsi qu'une garde meurt. *(Instantané d'un trafic, pas une garantie perpétuelle.)*
- **Ce qui reste `[non établi]`, et n'est pas déclaré établi** : le cas « dialogue **+** boîte lisible **+** statut disponible » n'a pas pu être produit sur Claude Code 2.1.233 — sur les sept dialogues observés, la boîte rend `null` à chaque fois. **Il n'y a donc pas d'incident, et il n'y en a jamais eu** : ce qui est fermé, c'est la dépendance à un effet de bord qui pouvait disparaître sans que rien ne le signale.
- **`resumeDeLEcran` est exportée et nettoie son entrée** : son contrat « texte déjà dégrisé » était tacite, et le premier appelant du dehors a rendu un refus truffé de séquences ANSI, illisible pour son destinataire.
- **Trou de banc signalé, hors périmètre** : `delivrerLaBoite` — la fonction la plus irréversible de `T-20260816-0114` — n'était exercée par aucun essai avant ce lot.


## [1.63.0] - 2026-08-17

*Quatre lots sortent avec cette version, et les quatre sont annoncés ici : PR #269 (T-20260817-0006) · PR #268 (T-20260816-0114) · PR #44 (E-20260512-0001) · PR #267 (T-20260816-0016). Vérifié commit par commit sur `v1.62.0..main` — rien d'autre ne sort.*

### Ajouté

- **Les garde-fous contre les biais des LLM entrent enfin dans les prompts** (T-20260512-0002 · 0004 · 0005 · 0006 · 0008 · 0009 · 0010, PR #44) — les sept sub-agents du pack, les six gabarits d'agents autonomes et trois skills de plugins portent désormais les réflexes prescrits par **STD-011 §2.6**, chacun ceux de son persona : anti-sycophantie pour `qa`, anti-ancrage pour `product`, anti-hallucinations et approbation humaine sur opérations destructives pour `devops`, ancrage de juridiction QC/CA pour le skill qui cite des articles de loi dans des rapports client.
- **Les agents autonomes reçoivent les cinq règles complètes**, et non deux ou trois réflexes : ils n'héritent d'aucun `CLAUDE.md`, donc ce qui n'est pas dans leur prompt n'existe pas pour eux.
- **Le backlog du pack a été relu en entier, et il dit désormais la vérité** (T-20260816-0016, PR #267) — **169 tickets** non fermés, lus un par un, description **et** commentaires : **33 fermés avec leur preuve mesurée**, **132 confirmés vivants**, 4 déclarés `[non établi]` faute de pouvoir trancher.
- **L'hypothèse de départ était juste, mais à 19 %** — pas à la majorité. Et le déjà-réglé **n'était pas où on le cherchait** : *aucune* des fermetures ne dormait dans `ready_to_deploy`. Elles dormaient dans `new`, invisibles au statut. Il fallait lire.
- **Chaque fermeture porte sa preuve** en commentaire de son ticket : une commande et sa sortie, un `chemin:ligne` à `HEAD`, ou un commit avec sa version. Jamais *« ça a probablement été corrigé »* — le raccourci qui a produit ce backlog.

### Corrigé

- **La parole du dirigeant ne s'écrit plus par-dessus la boîte de son agent** (T-20260817-0006, PR #269) — `remettre()` écrivait sans regarder la boîte de saisie. **Mesuré contre le vrai service**, la preuve prise dans la transcription du destinataire : `herdr agent prompt` n'écrit pas dans une boîte vide, il **aboute** son texte à ce qui s'y trouve, sans séparateur, **et soumet**. Une boîte portant un texte non soumis a fait recevoir à l'agent **un seul message**, les deux textes collés — sur le chemin par lequel arrive un arbitrage. Un ordre que personne n'a donné, exécuté, avec accusé de réception.
  La mesure a démenti le ticket en l'aggravant : la fusion part **avant** que le moindre garde-fou existant soit sollicité, donc **aucun rattrapage n'est possible après coup**. `remettre()` regarde désormais la boîte **avant d'écrire** et refuse — un refus qui nomme le pane et **donne le geste**. Un écran qu'on n'a pas su lire est un refus lui aussi : la prémisse inverse (« on n'écrit pas par-dessus quoi que ce soit ici ») était fausse.
- **On n'écrit plus rien devant un écran qui attend un choix** (T-20260817-0006) — et ce que deux lots portaient en **[non établi]** est maintenant mesuré : devant un vrai dialogue de permission, `agent prompt` d'un **texte ordinaire** a **créé le fichier** que le dialogue proposait. Le texte n'a pas été reçu comme un message, il a servi de **confirmation**. Ce n'est donc pas seulement la touche d'envoi qui est dangereuse là — c'est **l'écriture elle-même**. La garde d'écran est posée avant d'écrire comme avant la touche.
  La sonde exige un **dialogue actif** (curseur de sélection sur une option, ou formule d'invite), et non la simple présence d'une liste numérotée : **mesuré, la sonde large déclarait « en attente de choix » 23 panes réels sur 65 — 35,4 %**, tous joignables. Une garde qui refuse un agent sur trois se fait retirer, et emporte ce qu'elle gardait vraiment. Après resserrement : **0 sur 65**.
- **Une boîte de saisie bloquée n'affame plus tous les émetteurs suivants** (T-20260816-0114, PR #268) — un texte laissé dans la boîte d'un agent sans être soumis mettait en famine **tout le monde** : `livrer.js` refusait d'écrire par-dessus, à raison, et seul le destinataire pouvait libérer sa boîte — c'est-à-dire le seul qui ne sait pas qu'elle bloque. Quatre occurrences en quatre rondes sur la boîte d'un orchestrateur, et **une fois sur trois l'auteur du texte coincé était déjà mort** : personne, jamais, n'allait le soumettre.
  Un texte resté **immobile cinq minutes** est désormais **soumis pour son auteur** — la touche d'envoi seule, sans écrire un caractère — puis le message de l'émetteur part, précédé d'un avis qui apprend au destinataire que sa boîte bloquait **et lui montre le texte parti en son nom**.
- **Le refus d'écraser est intact, et un essai-témoin le prouve** — rien ne s'écrit jamais dans une boîte qui n'a pas été **vue vide**. Boîte encombrée dont la touche d'envoi ne libère rien → zéro écriture. C'est la frontière que `T-20260809-0033` protège : deux textes collés produisent un travail plausible et faux, un texte entier tel que son auteur l'a écrit se constate par celui qui le reçoit.
- ⚠️ **Une fermeture a été écrite, puis rétractée** — et c'est la partie qui apprend le plus. `T-20260814-0019` avait été fermé sur *« l'orchestrateur est désormais réveillé par un service du poste »*. **Faux** : `launchctl`, les plists et `rendez-vous.js service etat` le démentent tous les trois, et `naitre.js` ne pose jamais la ronde. **La passe 2 de revue l'a rejeté ; la re-mesure lui a donné raison ; le ticket est rouvert.**
- **Le motif de l'erreur, nommé** : lire le **mécanisme** (`rendez-vous.js` *sait* poser un service) et conclure au **dispositif**. Savoir poser n'est pas poser. C'est *« une porte sur deux »*, le motif dominant de ce dépôt — commis en fermant un ticket qui le dénonçait, et pendant que le même lot mesurait l'absence deux minutes plus tard sans relier les deux.

### Technique

- **`ressembleAUnChoix` descend de `naissance-representant` vers `ligne-directe/src/ecran.js`** (T-20260817-0006) — `ligne-directe` ne peut pas importer du module voisin (sens de dépendance unique, il s'installe seul) et la recopier aurait fait **une porte de plus**. Un exemplaire, pas deux ; `livraison.js` l'importe de là et la ré-exporte, sans changement d'adresse pour ses consommateurs.
- **Deux doubles d'essai réparés, tous deux plus permissifs que le service qu'ils doublaient** (T-20260817-0006) — `aide/faux-herdr.js` **remplaçait** là où le vrai service **aboute** : le mode de panne n'existait nulle part, donc **aucun essai ne pouvait rougir** dessus. Il lui manquait aussi un levier de dialogue et un **journal d'appels**, sans lequel une *abstention* ne peut pas se prouver. Et `herdr.test.js` ne rendait **aucun écran** sur `agent read`. Le banc a été réparé **avant** le correctif, et l'essai vu rouge avant d'être vu vert.
- **La délivrance s'abstient dans cinq cas** : le texte **a bougé** (quelqu'un tape) · la boîte ressemble à un **dialogue de choix** · la session est devant un **écran** que `etatDeLEcran` ne déclare pas prêt · la boîte est **illisible** · c'est un **brief de naissance** (`--en-attente`). `causeObstacle()` nomme les trois causes de refus ; `obstacleAvantLivraison` s'écrit par-dessus elle, verdicts inchangés.
- **La phrase que le refus affirmait était fausse, et c'est une mesure qui l'a montré.** Il disait « personne d'autre ne peut le faire à sa place ». Mesuré sur une boîte bloquée : une touche d'envoi venue de l'extérieur la vide et le destinataire **prend** le message. Soumettre n'est pas taper à sa place — c'est finir le geste que quelqu'un a commencé, et `livrerBrief` le faisait déjà pour son propre texte.
- ⚠️ **Cette livraison a attendu 96 jours** — ouverte le 2026-05-12, déclarée prête, jamais fusionnée. Ce n'était pas un brouillon oublié : personne ne l'avait vue. Elle a été retrouvée par le ménage du backlog (T-20260816-0016), qui l'a nommée comme le meilleur rapport effort/résultat du dépôt.
- **Elle n'avait jamais eu de chaîne** — pas une verte périmée : *aucune*. Elle a été rebasée sur `main` (213 commits de retard, **aucun de ses 16 fichiers touché depuis le 12 mai** — le retard ne concernait donc rien de ce qu'elle modifie), et sa chaîne a tourné pour la première fois : 5/5.
- **Deux passes de revue avant fusion**, sur un diff que personne n'avait relu. La première a rejeté sur deux références jugées inexistantes ; **les deux ont été réfutées par la mesure** — `AIMS/core-agents/infra-ops/config/` vit dans le dépôt Architecture, et `Agent TrainerBot` est cité nommément dans STD-011. *Conclure d'une absence dans un dépôt pour une référence qui pointe ailleurs* : le motif est noté. Une passe portail refaite et une passe de fond ont ensuite rendu **RIEN VU**, fidélité au standard vérifiée persona par persona.
- **Deux passes de revue**, verdicts montrés et non conclus : **portail RIEN VU** (arithmétique recomptée, demandes de fusion vérifiées, cinq fermetures échantillonnées, arbre contrôlé) · **fond REJET** (neuf fermetures re-mesurées, huit tiennent).
- **Ce qui est corrigé au dépôt mais absent du poste est marqué, pas fermé** : `session.js`, `versement.js` et `vigie.js` — trois modules livrés entre v1.55 et v1.62 — ne sont pas installés. Inscrit sur `T-20260816-0102`, qui reste ouvert.
- **Quatre affirmations corrigées**, dont deux venaient du brief du lot lui-même : quatre demandes de fusion en brouillon et non cinq · l'état d'installation **se mesure** par le contenu, même quand la version reste illisible.
- **Deux demandes de fusion prêtes dormaient** : `#44` depuis **96 jours** (elle porte neuf tickets `proposed`) et `#148` avec 115 commits de retard. Arbitrées et inscrites ticket par ticket.
- **Dix groupes de doublons candidats** signalés sur titres ; deux prouvés et traités, les autres laissés à l'arbitrage — un doublon se prouve sur les descriptions, jamais sur les titres.
- Livrables : `docs/menage-backlog/2026-08-16-perimetre.md` et `docs/menage-backlog/2026-08-16-verdicts.md`.

### À surveiller

- ⚠️ **La revue de fond a rattrapé l'exécutant ET l'orchestrateur** : devant un **dialogue**, la touche d'envoi ne soumet pas un texte, elle **confirme l'option par défaut**. Pire, la garde d'immobilité *aggravait* le danger — quelqu'un qui réfléchit devant une confirmation ne bouge rien, donc l'état le plus dangereux se lisait « sûr à soumettre ». Corrigé par deux gardes ; la forme exacte d'un dialogue de permission Claude Code reste **`[non établi]`** faute d'avoir su la reproduire, d'où une garde **large** dont le sens sûr est de s'abstenir.
- **Cette livraison ne répare pas les postes.** Ils tournent la version **installée**, pas `main` — le blocage continuera jusqu'à l'installation (`T-20260816-0102`). Une boîte a bloqué une **cinquième** fois en recevant le compte rendu de ce correctif.
- **Deux restes inscrits** : `T-20260817-0006` — `remettre` (la parole du dirigeant) écrit dans la boîte **sans la regarder d'abord**, et son banc d'essai ne peut pas voir la fusion parce que son double *remplace* là où le vrai service *aboute* ; `T-20260817-0007` — quand la délivrance échoue, seul l'émetteur le sait.
- **Deux disjoncteurs coexistent désormais dans `aims/agents/dev-orchestrator/`** : celui qui existait déjà, réel et implémenté (5 échecs → 5 min, câblé dans `hooks.ts`), et celui que ce lot ajoute en texte (3 erreurs → 15 min). Rien ne dit lequel prime — relevé par la revue de fond, à clarifier.
- **La pause de 15 minutes est recopiée telle quelle dans cinq agents éphémères** dont le délai d'expiration documenté est de 5 minutes. Inerte plutôt que nuisible, mais c'est du collage plutôt que de la rédaction par fichier.
- **Deux tickets de la série ne sont pas fermés par cette fusion** : `T-20260512-0007` (le persona `chatbot-qa` n'est pas distribué par le pack) et le volet `qa-hybrid`/`qa-utilisateur` de `T-20260512-0003`. Cause commune inscrite en `T-20260817-0002` — *un agent qui vit sur le poste sans être distribué n'a pas de propriétaire*.


## [1.62.0] - 2026-08-16


### Aussi dans cette version

*Deux lots fusionnés sur `main` avant celui-ci sortent avec lui, et n'avaient pas d'entrée. Reprises de leur message de commit, sans rien y ajouter :*

- **Le bras droit, la ronde de récolte, et le lieu de l'orchestrateur à jour** (T-20260816-0099, PR #265).
- **Le lieu de l'orchestrateur `j-20260814-0002` est installé** (PR #230) — c'est ce versement qui retire l'un des deux cas exposés de `T-20260814-0014` de la trajectoire.

### Ajouté

- **Un lieu qu'un tiers peut retirer sous son agent est désormais signalé** (T-20260814-0014, PR #264) — **deux occurrences de CE défaut** (le ticket en compte cinq, mais trois relèvent d’une autre surface). Le lieu d'un orchestrateur vit dans l'arbre du dépôt **partagé** : qu'une autre session bascule de branche, et son répertoire courant disparaît **en pleine session**. Deux orchestrateurs l'ont vécu ; l'un travaillait encore sans le savoir et **n'aurait pas survécu à un redémarrage** — il ne saurait plus ni qui il est, ni quelle est sa portée.
- **Le renversement que ce lot nomme** : ses exécutants, qui vivent quelques heures, naissent chacun dans un worktree à eux. **Lui, qui vit des jours, ne l'est pas.**
- **Et ça mord à la NAISSANCE**, pas seulement dans une ronde — *le plus tôt possible plutôt que le plus régulièrement possible*. La ronde passe après : l'agent est né, a travaillé, a peut-être écrit dans un lieu qu'un `git checkout` emportera. À la naissance, **personne n'a encore rien perdu**.

- **La compétence de pose dit désormais ce qu'elle laisse derrière elle** — et donne le geste : faire naître l'orchestrateur **dans son propre espace de travail**, exactement comme il fera naître ses chefs d'équipe. La mécanique existait, éprouvée, décrite pour eux ; elle n'avait jamais été retournée vers celui qui l'applique.
- ⚠️ **Et elle INTERDIT le rattrapage évident** : rétablir la branche remettrait les fichiers **et écraserait le travail de la session qui y a commité depuis**. Elle donne à la place le geste qui restaure **sans toucher à la branche partagée** (`git checkout <branche-du-lieu> -- …`), et l'ordre : vérifier que tout est poussé, restaurer, le dire. *La première fois, la conduite juste a tenu parce que son auteur venait d'écrire le ticket — ce n'est pas une garde, c'est de la chance.*

- ⚠️ **Et c'est la COMMANDE qui le dit, pas seulement un module qui saurait le dire.** La première écriture exportait le jugement et le testait — **sans que rien ne l'appelle en production**. Le détecteur existait dans le dépôt et nulle part dans la vie d'un agent : exactement le défaut que ce dépôt ferme partout ailleurs, commis ici par son auteur et **relevé par les deux passes de revue**. `bin/naitre.js` mesure désormais les branches porteuses et écrit l'avertissement ; un essai de bout en bout, sur la vraie commande, le prouve.

### Technique

- ⚠️ **Et le nom de la branche par défaut n'est PAS codé en dur** — trouvé **par la chaîne d'intégration**, le jour même où ce motif a été inscrit (`T-20260816-0093`). La première écriture n'acceptait que `main` : **verte sur le poste, rouge en intégration**, où `git init` crée `master`. Le verdict dépendait du nom qu'une machine donne à sa branche — donc de la machine, pas du lieu. Les deux noms usuels sont acceptés, et l'appelant peut donner celui que le dépôt déclare.
- ⚠️ **Le critère n'est PAS « est-ce sur `main` »**, et c'est le cœur du lot. Cette formulation aurait déclaré **sain le pire des cas**, mesuré sur un orchestrateur vivant : son lieu n'est porté que par sa propre branche, **et cette branche est celle qui est sortie**. Tout paraît normal, rien ne se voit, et il suffit d'un `git checkout` par n'importe qui. Le critère est **combien de branches portent le lieu, et lesquelles** — jamais laquelle est sortie.
- **Le nombre seul ne suffit pas non plus** : deux branches de travail peuvent disparaître toutes les deux. Seule la branche par défaut est portée par ce qui en descend.
- **On ne conclut pas d'une absence de mesure** : une interrogation de git qui échoue rendrait une liste vide, et « vide » vaut ici l'alarme maximale. `null` veut donc dire *pas mesuré* et fait taire le module, là où `[]` veut dire *mesuré, et rien ne le porte*.
- ⚠️ **Le geste nommé n'est JAMAIS de rétablir la branche.** Ce réflexe remettrait les fichiers **et écraserait le travail de la session qui y a commité depuis** — le rattrapage plus dommageable que la panne. Un essai garde que le verdict ne le propose pas.
- Le module **signale et n'empêche pas de naître** : un lieu exposé reste utilisable, et refuser la naissance coûterait plus que le risque.

## [1.61.0] - 2026-08-16

### Sécurité

- **L'essai des portes de jeton n'imprime plus ce qu'il a reçu** (T-20260816-0046, PR #262). Il affichait `reçu '<valeur>'` en cas d'échec — et sur un poste garni, cette valeur est un **secret vivant** : la sortie brute de ce poste l'a portée **trois fois** avant d'être effacée. Un essai qui affiche un secret l'expose à tout ce qui lit sa sortie — terminal, journal de CI, rapport collé dans un ticket. **Ce défaut-là transformait un essai en fuite.** Il qualifie désormais ce qu'il a reçu — *la valeur attendue*, *rien*, *une autre valeur non affichée* — sans jamais la recopier.
- ⚠️ **`test-mcp-env.sh` portait le MÊME défaut, et il a coûté une vraie clé.** La revue de fond l'a lancé sur ce poste et a **exposé une valeur réelle de `SOMCRAFT_MCP_API_KEY`** dans sa transcription — la clé a dû être régénérée. Ce fichier n'isolait pas davantage son environnement et recopiait la valeur obtenue en clair sur quatre sites. Corrigé dans le même lot : fermer une porte en laissant la jumelle ouverte n'aurait rien fermé du tout. Il rendait **7 échecs sur `origin/main`** ; il en rend **zéro**.
- ⚠️ **Et sa propre garde était aveugle au trou.** Ce fichier vérifiait déjà qu'aucun essai n'approche le lieu unique réel — en cherchant **une chaîne dans les fichiers**, jamais en vérifiant que l'environnement **appelant** est isolé. *Une garde qui cherche une chaîne dans un fichier ne garde pas un environnement : ce sont deux mondes, et le second est celui où vivent les secrets.*

### Corrigé

- **Les cinq échecs ne venaient pas des portes : le harnais mesurait le poste.** Ses sous-shells héritaient de `SOMTECH_DESK_API_KEY` du shell appelant, donc le faux `claude` recevait la vraie valeur de la machine au lieu de celle que les portes délivrent. **Mesuré : 3 réussis / 5 échoués tel quel ; 8 / 0 avec la seule variable retirée de l'environnement parent.** Les cinq portes fonctionnaient, y compris celle de la naissance d'un représentant client.
- Et la vérification « aucune porte ne laisse le jeton dans le shell appelant » échouait pour la même raison : **il y était avant**. Elle constatait l'état du poste, pas l'effet des portes.

### Technique

- **Le garde-fou couvre la FAMILLE, pas un fichier** : tout essai de `scripts/tests/` qui parle des jetons du lieu unique est lancé avec une valeur reconnaissable, et sa sortie ne doit la contenir nulle part — **sept éprouvés**. Corriger le seul essai des portes aurait laissé la troisième porte ouverte.
- ⚠️ **Ce que ce balayage prouve, et ce qu'il ne prouve pas** : il constate l'état actuel. Je n'ai pas su reproduire une fuite dans un essai réel — elle y demande une combinaison précise — donc j'éprouve le **détecteur** plutôt que d'affirmer l'avoir vu mordre : un essai fabriqué qui recopie franchement son environnement doit être vu. *Un balayage qui ne trouve rien peut être un balayage qui ne sait rien trouver ; les deux se ressemblent exactement.*
- **Une garde existante m'a attrapé, et elle avait raison** : le premier jet de ce garde-fou ne bornait pas son lieu unique, et `test-mcp-env.sh` l'a refusé — *« un vrai jeton peut atteindre leur sortie »*. Respectée plutôt qu'assouplie.
- **Un garde-fou éprouve la non-divulgation par le fait** (`scripts/tests/test-portes-ne-divulguent-rien.sh`) : on fait délivrer une valeur reconnaissable par la porte elle-même et on exige qu'elle n'apparaisse **nulle part** dans la sortie — y compris en cas d'échec, là où le risque est le plus grand. Remettre l'affichage fautif le fait rougir ; retirer l'isolation aussi.
- ⚠️ **Son premier jet ne prouvait pas ce qu'il annonçait** : il posait la valeur dans l'environnement, que l'isolation empêche désormais d'atteindre le témoin — il restait donc vert même avec le défaut réintroduit. *Il prouvait l'isolation en croyant prouver la non-divulgation.* Réécrit pour passer par le point d'injection du harnais.
- ⚠️ **Une affirmation du ticket est corrigée par la mesure** : cet essai **est** dans la chaîne CI (`shell-tests` exécute tous les `scripts/tests/*.sh`), et il y **passait au vert** — vérifié dans le journal du dernier run de `main`. Il échouait en local et réussissait en CI, pour la raison exacte que ce lot corrige : la CI n'a pas de jeton dans son environnement. **Un essai vert en CI et rouge sur le poste est pire qu'un essai absent de la chaîne** — il fait croire que quelqu'un regarde.
- ⚠️ **Correction d'une mesure de ce lot, faite par son auteur avant la fusion.** Le chiffre annoncé — « 2 lignes ouvertes sur 42 » — était **faux** : le filtre d'ouverture portait sur un champ (`fermee_le`) **qui n'existe pas au registre**, donc il ne filtrait rien. Recompté sur le vrai champ `close_le` : **25 lignes ouvertes**, dont **aucune** au chantier disparu ; les **2** lignes concernées sont **closes**. Le mécanisme reste réel — une ligne ouverte non refermée attend le prochain occupant de son pane — mais **aucune occurrence vivante n'est observée aujourd'hui**. La passe est donc une prévention, pas la réponse à un incident en cours.
- ⚠️ **La garde a changé de place, et la raison vaut au-delà de ce lot.** La première écriture filtrait à la **sélection** : la ligne morte cessait d'être proposée. Ça marchait, et c'était la mauvaise place — **un filtre laisse le registre DIRE que la ligne est ouverte pendant qu'on la cache**, soit deux sources de vérité qui divergent en silence, le motif que ce dépôt paie le plus cher. Une passe d'hygiène fait que le registre **cesse de mentir** : on soigne le fait, pas sa lecture.
- **On n'écarte que sur preuve** — worktree connu **et** absent. Un chemin non enregistré, vide, ou qu'on n'a pas pu interroger ne prouve **rien** et ne fait rien signaler. C'est l'erreur que le correctif de `T-20260816-0003` avait déjà payée vingt essais rouges, en rendant des lignes injoignables au nom d'une absence de donnée.
- Un second symptôme a fait regarder, sans être la raison du choix : brancher le disque dans la sélection faisait rougir **26 essais** (538 verts / 0 rouge sans, 512 / 26 avec) dont les registres portent des chemins inventés. Inscrit à part (`T-20260816-0086`) — *une garde bien placée mériterait qu'on paie ce nettoyage*.

### Ajouté

- **Une ligne dont le chantier a disparu du disque est désormais signalée** (T-20260816-0083, PR #261) — la moitié que `T-20260816-0003` avait nommée `[non fermé]` sans la fermer. Une telle ligne reste ouverte au registre, attachée à un numéro de pane que le poste réattribue : **le prochain occupant hérite d'un canal ouvert pour un client dont il n'a jamais entendu parler.** ⚠️ **Prévention, pas incident en cours** : recompté sur le registre réel, **25 lignes ouvertes, aucune au chantier disparu** — voir la correction de mesure en Technique.
- **La ronde porte la passe** et rend son avis avec les valeurs trouvées : la ligne, le chantier, le worktree disparu, et **la commande exacte qui la referme** — avec le pane d'où la lancer, parce que `fermer` choisit parmi les lignes du pane courant. C'est l'invariant de `T-20260816-0045` appliqué à l'hygiène : *un avis qui ne nomme pas sa sortie laisse son lecteur exactement où il était*.
- ⚠️ **Le geste conseillé porte sa CONDITION, parce qu'elle décide s'il marche** — relevé par un REFUS en revue de fond, et c'est ce lot retourné contre lui-même. `fermer` passe par la même sélection que `dire`, donc par la garde de session : **si le pane a été repris par une autre session herdr, aucune commande ne referme cette ligne**. Or c'est exactement le cas que ce lot décrit. L'avis nomme donc la commande, l'endroit, **la session**, et ce qui se passe quand elle a changé — éprouvé contre le vrai sélecteur, pas contre un double.
- **Elle signale, elle ne ferme rien.** Refermer une ligne à tort ferait taire un canal client. L'avis le dit en toutes lettres.

## [1.60.0] - 2026-08-16

### Ajouté

- **Un agent figé se voit, et un agent qui pense n'est pas signalé** (T-20260816-0063, PR #259). Le dispositif connaissait deux états d'un agent qui n'avance pas : au travail, ou parqué derrière un écran nommé. Il en existait un **troisième** que rien ne regardait — **figé** : ni `working`, ni `blocked`, aucun écran, rien à répondre. Une session y a passé **plus d'une heure**, et c'est une ronde **humaine** qui l'a découverte.
- **La ronde regarde désormais dans le temps** ceux à qui le rappel n'aboutit pas — trois lectures espacées, jamais une seule. *Un point de mesure est un indice, une série est un fait.* Elle ne regarde que les suspects : payer la série sur les 79 panes du poste serait un prix qu'on finirait par retirer, en emportant la garde avec.
- **Deux formes, et elles ne sont pas prouvées pareil** — la distinction est écrite dans le verdict lui-même : `agent-introuvable` (l'agent a quitté la détection alors que son pane vit encore) est **prouvée par un spécimen fabriqué** ; `fige-sans-ecran` **n'a jamais été observée directement** et **penche donc vers le silence**.
- **Et la garde capture ce qu'elle trouve** : la série de revisions, leurs horodatages, le statut, l'écran. Le vrai figé existe — il a été vu deux fois, et **perdu les deux fois** faute d'avoir été mesuré avant d'être réveillé. La moitié non prouvée cesse d'attendre un laboratoire : elle s'auto-mesure sur le terrain, et la prochaine occurrence réelle rendra la preuve que personne n'a su fabriquer.
- **On ne débloque jamais à la place de l'agent.** Envoyer une touche à un agent figé, c'est taper à sa place ; le but est qu'il **se voie**, pas qu'on le pilote. Le module de jugement ne peut, par construction, rien envoyer.

### Technique

- **La vigie est bornée par la même échéance que la livraison**, et ce qu'elle n'a pas eu le temps de regarder est **nommé, jamais tu** — relevé en revue de fond. La série coûte trois lectures espacées **par suspect**, en séquence : une panne herdr large ferait plusieurs suspects d'un coup, et la ronde s'allongerait sans plafond jusqu'à mordre sur la suivante. Un pane non regardé n'est **ni sain ni figé** : il n'est pas mesuré, et le taire remettrait le silence que ce lot existe pour supprimer.
- ⛔ **La piste recommandée était fausse, et elle est barrée sur place plutôt qu'effacée.** Le passage de relais donnait `state_change_seq` comme « la piste la plus prometteuse ». **Mesuré** : figé pour un agent qui travaillait **activement**, exactement comme pour les 78 au repos — ce compteur compte les **transitions** d'état, pas l'activité. Une garde bâtie dessus aurait déclaré figé **tout agent au travail**. *Une réfutation qu'on efface se fait redécouvrir comme neuve.*
- ✅ **Le témoin est `revision`, croisée au statut** — ~1 par seconde chez l'agent au travail, immobile chez tous les autres. C'est un **fait croisé à un état**, pas un seuil de temps : le faux positif se ferme par construction au lieu d'être contourné par un réglage.
- ✅ **Le piège annoncé a été observé en vrai** : un agent en pleine réflexion, compteur d'activité **dépassant la minute**, `revision` +1 par seconde. Le mécanisme ne dépend pas du libellé (trois observés) mais du fait qu'un libellé d'activité **porte sa propre horloge**, donc redessine. Et le **focus ne compte pas**, mesuré sur les 79 panes — sinon la garde tombait pour tout agent en arrière-plan.

## [1.59.0] - 2026-08-16

### Corrigé
- **Les trois refus de la livraison nomment désormais la sortie** (T-20260816-0045, PR #255). Un agent a tenté de joindre son orchestrateur **239 fois**. Chaque refus était **juste** — la boîte de saisie du destinataire contenait un texte collé, et la garde a tenu **288 fois** plutôt que de coller deux messages en un seul que personne n'aurait écrit. **Aucun ne disait quoi faire.**
- **L'invariant est nommé, pas laissé en remarque** : *un refus qui ne nomme pas la sortie est un refus qui bloque*. Il ne protège plus, il remplace un défaut par un autre. Chaque refus dit donc deux choses : **ce qui bloque**, avec les valeurs réellement trouvées, et **le geste exact qui le lève**, en disant à qui il appartient quand ce n'est pas au lecteur.
- **Les trois, pas seulement celui de la mesure** — boîte pleine, boîte illisible, session indisponible. Ils ont la même forme et le même manque ; n'en traiter qu'un aurait rejoué « une porte sur deux » sur un lot dont l'objet *est* ce motif.
- **La boîte pleine avoue ce qu'elle ne peut pas faire** : soumettre ou effacer ce texte appartient à quelqu'un devant ce pane, et personne ne peut le faire à sa place — vider la boîte d'autrui serait taper à sa place. Un aveu explicite sur sa propre limite vaut mieux qu'un silence qui laisse chercher.
- **Aucun refus n'a été affaibli.** On ajoute des mots, on ne change pas un seul verdict — un essai garde les sept cas de refus et le cas nominal. Un correctif qui aurait rendu un cas permissif aurait été **pire que le défaut**.
### Technique
- Les valeurs viennent de la **mesure**, jamais d'un gabarit : deux panes différents produisent deux messages différents, et **sans pane connu le refus se tait sur les commandes** plutôt que d'écrire `herdr agent read <pane>` — un gabarit non substitué est une commande que le lecteur ne peut pas exécuter, c'est-à-dire le défaut qu'on ferme retourné contre nous.
- Le pane est passé par l'appelant réel, et un essai d'intégration le prouve : sans lui, tous les essais unitaires resteraient verts pendant que l'expéditeur réel recevrait encore un refus sans geste.
- **La commande conseillée est celle que le code utilise lui-même** — relevé en revue de fond, et c'est ce lot retourné contre lui : le refus « boîte illisible » renvoyait vers `herdr agent read <pane>` alors que le module lit cet écran en `--format ansi`, parce que le **gris** est la seule chose qui distingue une suggestion d'un reste. Conseiller la commande sans son option enverrait le lecteur diagnostiquer avec moins que ce qu'on s'accorde à soi-même.
- Le `[non établi]` du ticket **reste non établi** : savoir si un agent `done` à boîte pleine dispose d'une file exploitable exigerait d'écrire dans la boîte de quelqu'un pour voir ce qui arrive — exactement ce qu'on se refuse. Un essai garde que le refus **ne promet aucune file**.

## [1.58.0] - 2026-08-16

### Ajouté

- **Le métier d'orchestrateur est aligné sur les ADR et le feed du ServiceDesk** (T-20260816-0015, T-20260816-0018, T-20260816-0006, PR #252). Première lecture intégrale dont on ait la preuve : **26 ADR**, 18 réflexions, **54 posts du feed** — dont **16 consignes opposables** à un orchestrateur, que rien ne lui disait de lire. Sept écarts trouvés avec leur conséquence observable, onze points confirmés alignés, sept marqués `[non établi]`.
- **Le gabarit de lieu fait foi, la compétence en découle** — écrit noir sur blanc en tête des deux textes. Le motif est mécanique : un orchestrateur ne lit pas le `SKILL.md`, il lit le `CLAUDE.md` de son lieu. Mesuré : le mot « ADR » n'apparaissait **pas une seule fois** dans les 1 106 lignes de la compétence, alors que le rôle de gardien des ADR y était nommé — ailleurs. Ce rôle n'avait donc jamais atteint aucun agent né.
- **Une étape de conception entre le découpage et le chantier** — et la phrase qui la rend opposable : *un brief de construction envoyé sans conception écrite est une faute, au même titre que fermer un ticket sans QA*. Le lot mécanique en reste dispensé, explicitement.
- **La ronde tient désormais l'hygiène du registre** : cinq questions à chaque passe (ticket fini qui traîne, ticket qui ment sur son état, fusion et ticket qui se contredisent **dans les deux sens**, agent assigné disparu, défaut publié à marquer sans fermer) et deux vérifications quotidiennes au topo (espaces de travail orphelins, lignes ouvertes ambiguës). Elle **signale et ne ferme jamais** ; si elle ne trouve rien, **elle se tait**.

### Corrigé

- **Le verrou de sas ne fait plus foi — c'est l'écart git qui tranche.** Le post du feed du 2026-08-14 rapporte **deux** défaillances du même verrou : un `lock_status` qui répond « libre » sur un staging occupé depuis trois jours, **et le verrou accordé à une nouvelle PR alors que le sas était déjà pris**. Or la compétence *et* son outil s'appuyaient tous les deux dessus, dans le paragraphe même censé faire respecter la règle d'or n°14 : un orchestrateur qui suivait le texte poussait par-dessus la livraison d'un autre.
- **Les ADR se lisent au miroir Somcraft, et une absence ne prouve rien.** Le seul pointeur du métier envoyait vers un dossier **illisible depuis le poste** (T-20260816-0007). Le miroir est par ailleurs **incomplet** — 26 ADR visibles, douze numéros absents —, donc « je ne trouve pas d'ADR sur ce sujet » ne conclut rien et s'écrit `[non établi]`.
- **Le feed entre au cadrage**, avant de brieffer qui que ce soit — et la règle qui va avec : le feed s'amende lui-même, le post le plus récent gagne.
- **L'ADR applicable et le manifeste `architecture.yaml` entrent dans ce que le brief doit porter** ; l'ordre de fermeture `in_progress → ready_to_deploy → merge → completed` est posé au niveau des stories, plus seulement des jalons.
- **L'écho entre pairs ne se déclare plus « remis » sans l'avoir prouvé** (T-20260815-0021, PR #254). Porte jumelle de `T-20260815-0011` : depuis ce lot-là, `herdr.remettre()` calcule le verdict de prise pour **tous** ses appelants. Il y en a trois dans le veilleur ; deux le lisaient, `echoAuPair` le jetait et rendait `remis: true` sur la seule absence d'exception. Le fait était là, calculé, disponible, et un seul chemin ne le regardait pas.
- **Ce que ça coûtait tient dans la question du dirigeant** — *« peut-on parler d'un agent à l'autre ? »*. La réponse restait « oui » même quand ça ne marchait pas : un gestionnaire relance son orchestrateur, obtient « remis », et attend une réponse que personne n'a lue.
- **« Pas pris » n'est pas « pas parti »**, et les deux modes de panne ne se confondent pas : un pane qui **garde le texte dans sa boîte** est un échec qu'on constate ; un pane où **rien ne bouge** est un silence qu'on ne sait pas lire. Le second est l'état exact des trois panes mesurés le 2026-08-15, tous `done` avant, tous `done` après. Les deux rendent « pas remis », avec une raison différente, dite à qui a parlé.

### Technique

- **Les garanties de ce lot se gardent en POLARITÉ, pas en présence de mots** — `exigePolarite`, sept contrôles neufs, dix-neuf mutations. Quatre revues indépendantes, dont trois fraîches, ont chacune trouvé un défaut réel ; les trois dernières **dans les gardes elles-mêmes**. Une garde qui cherchait une sous-chaîne restait verte devant « il n'est pas vrai que tu signales, tu ne fermes pas » : la garantie la plus lourde du lot pouvait être inversée en silence.
- **Pour les deux garanties sans aucun filet, on garde le fait et non la tournure** : un motif `inverse` interdit la polarité contraire quels que soient les mots qui l'amènent. Deux mutations le prouvent en écrivant l'autorisation **sans une seule négation** — invisible pour un filtre de tournures.
- **`RENVERSEMENT` déclare dans le code ce qu'il vaut** : un filtre des formulations connues, pas une garantie de polarité. Une garde muette sur sa portée est prise pour une preuve. Le fond — *nous gardons de la prose avec du texte* — est inscrit en dette (T-20260816-0064).
- **Le méta-test ne se satisfait plus d'un commentaire.** Sa première version cherchait le mot `exigePolarite(` dans le source ; une revue l'a retournée en laissant ce mot en commentaire. Il exige désormais l'**absence** de la forme vulnérable — et a immédiatement trouvé **treize** assertions vulnérables dans les contrôles de ce lot même.
- **Le double d'essai de la ligne du chantier réimplémentait la preuve — c'était le vrai défaut.** Il rendait `{ delivered: true }` à tout coup, donc il était **plus permissif que le service qu'il double**, et il ne pouvait pas montrer un pane où rien ne bouge. Un essai écrit contre lui aurait prouvé que l'essai est d'accord avec lui-même. On double désormais le **transport** — le binaire `herdr` sur le PATH, `tests/aide/faux-herdr.js` — et le vrai module rend son verdict. Aucune assertion de ce fichier n'a changé de sens : elles disent maintenant ce qu'elles prétendaient dire.
- **La même porte jumelle a été trouvée une fois de plus, en revue de fond** : `diffuserConsigne` — corrigée au lot précédent — lisait encore `pris === false`, soit la forme fragile que ce lot-ci dénonce dans son propre commentaire. Elle exige désormais le verdict, et un essai le garde. Deux doubles anciens qui omettaient le verdict le **déclarent** maintenant, sciemment et commenté : un double qui affirme la prise doit le faire par décision, jamais par omission.
- **Le troisième témoin — le message mis en file par un pair déjà occupé — n'était éprouvé nulle part en intégration**, le double ne sachant pas le jouer. C'est pourtant le cas le plus fréquent. Sans lui, un écho parfaitement arrivé serait compté « pas remis » : c'est la moitié qui empêche la garde de devenir un refus abusif.
- La garde exige **le fait, pas l'absence de démenti** : lire `pris === false` laisserait passer un `remettre` qui ne rend rien — précisément l'ancien double. La forme durcie est elle-même gardée par un essai, parce qu'elle ne l'était pas : la relâcher laissait les 489 essais verts.

## [1.57.0] - 2026-08-16

### Ajouté

- **Une seule commande fait naître un agent, du néant jusqu'à ce qu'il soit joignable** — `npx @somtech-solutions/pack agent naitre <code> --depot <chemin>` (T-20260816-0004, E-20260816-0002, PR #253). Elle pose le lieu s'il manque, **le verse elle-même**, ouvre l'espace de travail au besoin, fait naître en **déclarant le modèle et le mode**, **lit l'écran** pour vérifier que l'agent peut réellement recevoir, livre l'amorce et prouve qu'elle a été prise. Là où il fallait dix gestes, trois refus et deux écrans manuels, il en faut un — et aucun humain ne touche un écran.
- **Une primitive qui NOMME un écran qu'on ne reconnaît pas** (`ligne-directe/src/ecran.js`, T-20260816-0033). Ce dépôt savait lire une boîte de saisie ; il ne savait pas lire un écran. La différence a coûté trois agents en une journée — deux avalés par un écran de configuration, un parqué dans une revue plein cadre, et la session du chef d'équipe de ce lot, figée plus d'une heure sans que rien ne le signale. L'inconnu et l'illisible ne se lisent **jamais** comme « prêt », et l'inconnu ne porte **aucun** geste : on ne conseille pas ce qu'on n'a pas vérifié.
- **Le versement du lieu, fait par la naissance** (`naissance-representant/src/versement.js`). Un `git commit` local, borné au seul chemin du lieu — jamais un `push`, jamais une PR, jamais une fusion. La revue de ce lot a établi le fait que tout le monde croyait autrement : **le gate qui précède la naissance n'a jamais été une revue de code**, il n'interroge que `HEAD`. Ce n'est donc pas la garantie qui coûtait, c'est le geste humain qui la satisfaisait. La garantie reste entière, l'humain part.

### Corrigé

- **La naissance ne montre plus d'écran de confiance** (T-20260816-0032, ferme T-20260815-0014). Mesuré sur Claude Code 2.1.233, en trois essais qui s'isolent : un lieu qui porte un bloc `permissions.allow` déclenche **toujours** un écran de confiance renforcé, que la pré-approbation ne fait pas taire. Or ce bloc était **déjà** ignoré tant que le dossier n'était pas approuvé (mesuré en 2.1.231) : il n'achetait rien à la naissance, et il coûtait un modal. Les droits sont désormais déclarés sous `somtech.droitsAccordes` — clé inerte, vérifiée par le fait — et rendus effectifs dans l'`allowedTools` de l'entrée de projet. **`permissions.deny` ne bouge pas** : c'est la moitié qui garantit, et elle tient dès la naissance.
- **Le refus de remise nomme la sortie** (T-20260816-0034, ferme T-20260816-0002). Devant deux panes homonymes de sessions différentes, il conseillait « désigne-le par son pane » — c'est-à-dire le geste qui venait d'échouer. Il cite désormais les **noms d'agent trouvés** et la commande qui passe. Et quand les noms ne départagent pas, il le dit **sans inventer de sortie** : on ne conseille jamais un geste qu'on n'a pas vérifié possible.
- **Une ligne n'est plus adressable depuis la session d'un autre chantier** (T-20260816-0035, ferme T-20260816-0003). Onze sessions herdr numérotent leurs panes indépendamment, et deux chantiers de deux **clients différents** portaient le même `w5:p3` — un mot sans destinataire explicite pouvait partir chez le mauvais client. Le discriminant existait déjà et était renseigné sur 25 lignes ouvertes sur 25 : c'est la **recherche** qui l'ignorait. Conséquence voulue : le cas nominal redevient adressable **sans** `--a`.
- ⚠️ **La première règle de ce correctif était fausse dans l'autre sens, et les essais de bout en bout l'ont attrapée** : elle écartait toute ligne sans socket enregistré, rendant **injoignable en silence** une ligne écrite avant ce champ. On n'écarte donc que **sur preuve** — deux sockets connus et différents. L'erreur est gardée dans le commentaire pour que personne ne la repose.
- **La pose regarde les VARIABLES que le registre exige, plus la présence d'un fichier** (T-20260816-0036, ferme T-20260815-0023). `aFichierEnvironnement` testait l'existence de `.env`/`.envrc` sans jamais consulter l'environnement ni savoir ce que le `.mcp.json` du gabarit déclare. La logique juste existait **déjà, en shell** (`scripts/shell/mcp-env.sh`) et n'avait aucun équivalent JS. Les motifs `${VAR}` sont extraits **où qu'ils soient** — y compris dans la chaîne de requête d'une URL, là où vit `SOMCRAFT_MCP_API_KEY`. Le troisième critère du ticket, celui qui saute quand on corrige vite, est couvert : un `.env` présent qui ne définit pas les variables attendues **ne fait pas taire** l'avertissement.

### Modifié

- **La naissance passe par `herdr agent start`** au lieu de `pane run` suivi de trente interrogations. La primitive existait, le dépôt la connaissait, et rien ne l'utilisait. Elle **nomme l'agent à la naissance** — ce qui ferme la fenêtre où il n'était adressable que par son numéro de pane — et transmet les drapeaux à `claude`, vérifié par le fait : elle rend son `argv` exact.
- ⚠️ **Mais son succès ne prouve pas qu'il est joignable.** Mesuré : elle rend `agent_status: idle` et `interactive_ready: true` **pendant que l'agent est parqué derrière un modal**. C'est un indice, pas le fait. La commande lit donc l'écran après coup, et refuse de déclarer née une session qu'elle ne peut pas prouver joignable.
- **Un écran connu peut être FRANCHI, et la nuance décide de tout.** La pré-approbation supprime l'écran de confiance ; elle ne supprime **pas** celui des serveurs MCP. Devant lui, la commande envoie le geste **mesuré** qui le confirme, puis **relit**. Franchir sans relire serait un pari ; relire en fait un fait. C'est borné à trois — un écran qui revient trois fois n'est plus celui qu'on croit reconnaître — et jamais `esc` : « reject all » ferait naître l'agent **sans son registre**. Un écran **inconnu** ne porte toujours aucun geste.
- **La compétence `/orchestrateur` montre la commande courte en tête**, et garde la séquence détaillée comme référence pour quand quelque chose s'arrête — et comme chemin obligé pour un lieu de **représentant**, que cette commande ne pose pas : il se branche sur un canal que le client voit, et sa pose garde sa revue.

### Sécurité

- **Le lieu d'un agent ne s'exécute plus depuis un produit de build périmé.** `cli/payload` est ignoré par git et gagnait sur la racine du dépôt : lancée depuis une copie de travail, la commande exécutait **une version périmée d'elle-même**, avec un message d'erreur d'une génération antérieure qui envoyait chercher au mauvais endroit. C'est la dérive `~/.somtech` que ce lot ferme, rejouée à l'intérieur du dépôt. Dans une copie de travail, **la source fait foi sur son propre build**. ⚠️ Ce que ça ne règle pas est nommé dans le code : `init`, `update` et `setup` continuent d'installer depuis `cli/payload`.

## [1.56.0] - 2026-08-15

### Corrigé

- **Le crochet apparaît sur le message du dirigeant au moment où l'agent l'a RÉELLEMENT PRIS**, plus au moment où le veilleur l'a écrit dans le pane (T-20260815-0011, PR #249). Écrire dans un pane et être lu par la session qui l'habite sont deux faits distincts : un pane peut être occupé, la boîte peut garder le texte sans qu'il parte, la session peut ne jamais sortir de son attente. Le crochet répondait à l'écriture — donc il rassurait exactement dans les cas où le message était perdu.
- **La preuve de prise reprend celle qui était déjà en service** dans `naissance-representant/bin/livrer.js` — « la session a quitté l'attente », et le refus de livrer dans une boîte qu'on n'a pas trouvée vide. L'idée est éprouvée ; la fonction qui la porte ici est neuve, et un défaut y a d'ailleurs été trouvé et corrigé dans ce même lot. Trois témoins, et un seul suffit — la boîte s'est vidée, un message est passé en file d'attente, ou la session est sortie de l'attente. `remettre()` lit l'état du pane **avant** d'écrire, écrit, relit après, et rend son verdict avec la réponse.
- **L'absence de crochet est la moitié qui a de la valeur.** Si aucun des trois témoins n'est constatable, le crochet n'est **pas** posé et le journal le dit. Un message sans crochet est un message dont personne ne peut affirmer qu'il est arrivé — c'est l'information qu'on cherchait.
- **Un AVANT qu'on n'a pas pu lire ne fabrique aucun témoin.** Une lecture de pane ratée rendait `false` aux deux questions (« il y avait des messages en file ? », « la boîte était pleine ? »), ce qui se lisait comme « il n'y avait rien » — et il suffisait alors que l'APRÈS paraisse vide pour fabriquer une « boîte vidée » sans avoir rien constaté. Le statut, lui, reste un témoin : il ne dépend pas de l'écran.
- **La consigne commune compte ce qu'elle a prouvé.** Elle payait déjà le coût du verdict et jetait la réponse : `remis` s'incrémentait sur la seule absence d'exception. Une consigne coincée dans le pane d'un orchestrateur était comptée « remise ». Elle nomme désormais ceux dont la prise n'a pas été constatée.
- Les deux gabarits — gestionnaire et orchestrateur — disent ce que le crochet signifie et ce que son absence signifie. Le dispositif le pose seul ; personne n'a rien à faire.
## [1.55.0] - 2026-08-15

### Corrigé

- **La ronde et le topo d'un orchestrateur ne réveillaient personne** (T-20260815-0008, PR #248). Un orchestrateur vivant a passé **toute sa vie sans recevoir un seul réveil**, et a fini par poser une boucle à la main **sans savoir ce qu'il contournait** — la seule preuve de l'absence d'un réveil est un non-événement. Deux causes indépendantes, mesurées : la ronde interrogeait herdr **sans désigner de session**, donc celle de son environnement — et un agent de session ne charge aucun profil de shell, donc **aucune** ; et **rien ne l'installait**, le geste n'existant que dans l'aide de la commande.
- **Elle balaie désormais toutes les sessions du poste, et chaque rappel part sur le socket de la session où vit son destinataire.** Sans ce second point, on aurait remplacé « ne réveiller personne » par « en réveiller un et croire avoir fait le tour ».
- ⚠️ **Le correctif évident était le mauvais, et c'est écrit dans le code pour que personne ne le repose** : poser une session dans le descripteur du service la figerait sur celle choisie le jour de l'installation, pendant que le dirigeant en ouvre au fil de l'eau. Le veilleur de `ligne-directe`, qui tourne depuis des semaines, ne porte aucune session — il les **découvre**. C'est ce modèle-là.
- **Le geste qui installe la vigilance existe enfin**, porté par `/orchestrateur` : une fois par poste, pas par orchestrateur. Les deux rendez-vous servent tous les orchestrateurs vivants, y compris ceux qui naîtront demain.

### Modifié

- **Un réveil qui ne joint personne dit désormais pourquoi.** Trois silences étaient confondus — aucune session ouverte, toutes muettes, aucun orchestrateur vivant — et c'est leur confusion qui a laissé le défaut vivre des jours. Le troisième est un **succès** : personne n'attend. Les deux autres sont des pannes, et chaque session muette est nommée.
- **Le compte rendu porte ce que la ronde a REGARDÉ**, pas seulement ce qu'elle a livré : les sessions balayées, et le nombre d'agents **vus avant filtrage**. Sans ce dernier chiffre, « zéro orchestrateur » avait deux causes indistinguables — il n'y en a vraiment aucun, ou la reconnaissance d'un lieu a échoué en silence. Un poste avec onze agents vivants et zéro reconnu se déclarait content, exactement comme un poste vide : **c'est le mode de panne de ce ticket qui se rouvrait sous son propre correctif**, et une revue de fond l'a vu.

## [1.54.0] - 2026-08-15

### Corrigé

- **Le cloisonnement tient désormais aux MEMBRES du canal, plus au canal lui-même** (T-20260813-0074 · T-20260814-0142, PR #244). Deux trous, une seule cause : `membresDuCanal` existait et n'était appelé **nulle part** dans le chemin de pose. La liste était disponible ; personne ne la regardait.
- **Deux clients dans un même canal de gestionnaire** : une ligne cliente autorise **par appartenance au canal** — être dedans EST l'autorisation. Les deux étaient donc autorisés, les deux lisaient tout ce que le gestionnaire écrit, et rien ne le détectait. **Loi 25** : une communication d'affaires d'un client lue par un autre est une communication à un tiers. Le sens de la fuite est celui qu'on oublie : ce n'est pas le second client qui *écrit*, c'est ce que le premier *reçoit* et que l'autre lit par-dessus son épaule.
- **Un client dans un canal d'orchestrateur** — où passent les arbitrages, les pannes de production, les échéances et les coûts. Le dirigeant avait posé la règle ; rien ne la faisait respecter.

### Technique

- **Le critère que les deux tickets proposaient n'existe pas, et le mesurer a changé la livraison.** Ils tenaient pour acquis que le domaine du courriel serait « disponible dans le profil Slack ». Interrogé avec le jeton du **robot** — celui qui fait la vérification, pas celui du dirigeant — `users.info` ne rend **aucun** courriel : `users:read.email` n'est pas accordé. **Le coder aurait produit une garde qui ne se déclenche jamais**, ce qui est pire que pas de garde : elle rassure.
- **Ce qui existe vaut mieux.** Slack marque `is_restricted` les gens qu'on invite — c'est ainsi qu'un client entre dans un espace de travail. Vérifié sur les canaux réels : les deux personnes du canal client le portent, les collègues des canaux internes non. Le statut que l'espace accorde est plus solide que l'adresse que quelqu'un porte. Second signal gratuit : l'appartenance à une autre organisation (Slack Connect).
- **L'arbitrage a suivi la mesure.** Le canal d'orchestrateur passe d'avertir à **refuser**. Le canal de gestionnaire renonce à l'avertissement — il frapperait le cas nominal, deux personnes d'un même client étant la situation normale — au profit d'une **photo des membres** et du signalement d'un **nouveau venu**. Aucune identité requise, et ça attrape le vrai risque : celui qu'on invite des mois plus tard sans se souvenir de ce que le canal porte. Savoir qui appartient à qui attend `D-20260806-0016`.
- **Trois lignes de partage, chacune tenue par un essai** : un canal **client** accueille ses invités sans broncher — l'en mettre dehors aurait été la pire régression possible ; un membre dont le profil est illisible **n'est pas un suspect** et ne fait pas échouer les autres ; et à l'**ouverture** une lecture impossible refuse, alors que sur une ligne **vivante** elle avertit — personne n'attend encore dans le premier cas, quelqu'un attend dans le second.
- **Pas de compteur d'échecs, et c'est un choix.** La revue en recommandait un, basculant en refus après N essais. Écarté : **un compteur est un état**, et un état qui se remet à zéro au redémarrage donne une garde qui **paraît armée sans l'être** — le défaut même que ce lot corrige, réintroduit par son remède. La distinction se fait sur le **moment**, sans seuil ni mémoire.
- **Deux portes trouvées ouvertes en revue de fond, et refermées** : `fermer` n'était gardé par rien — or le bilan est le seul geste qui pose systématiquement du contenu de synthèse, et il partait sous les yeux d'un externe entré entre-temps. Il est désormais **retenu**, la ligne se refermant quand même : on cesse d'alimenter un canal compromis, on ne bloque pas son cycle de vie. Et les branches de dégradation n'étaient prouvées par **rien** — les muter pour qu'elles se taisent laissait la suite verte.
- **Un défaut de `v1.50.0` corrigé au passage** : une lecture de membres impossible faisait **tomber** l'ouverture, l'exception traversant l'appelant au lieu de rendre un refus lisible. Invisible jusqu'à ce que le cloisonnement l'éprouve.
- **Sept doubles de Slack ne savaient pas répondre** à la question que le code pose désormais. Un double muet n'est pas neutre : il fait refuser des canaux sains.

## [1.53.0] - 2026-08-15

### Ajouté

- **La naissance connaît les sessions herdr, et refuse de deviner laquelle** (T-20260814-0120, PR #242). Onze sessions tournent sur ce poste, chacune avec son propre canal de commande ; la naissance n'en connaissait aucune — elle héritait passivement de `HERDR_SOCKET_PATH`, c'est-à-dire de **rien** depuis un terminal ordinaire. Le dirigeant a tapé cette variable à la main **quatre fois en une soirée**. Elle accepte désormais `--session <nom>` et résout le socket elle-même.
- **Quand plusieurs sessions existent et que rien ne tranche, elle refuse en les nommant toutes.** On ne devine pas, on ne prend pas la première : c'est le renversement déjà livré sur le trousseau et sur le routage, et il n'y a ici aucune alternative raisonnable — **une naissance dans la mauvaise session ne rate pas, elle réussit**, et ne se voit pas. Depuis un pane, ou avec une seule session ouverte, rien à préciser : le cas qui marchait continue de marcher.
- **`--session` l'emporte sur le pane courant.** Faire naître ailleurs que chez soi est le cas normal, pas l'exception — sans cette priorité, l'option serait décorative précisément là où elle sert.
- **Et l'espace doit appartenir à la session visée.** Les identifiants ne sont pas globalement uniques : `w2W` de la session `somtech` a été donné pour une naissance dans `sibelanger`. Le refus tombe **avant qu'un seul onglet existe**, et c'est cette absence qui est éprouvée — pas le message.

### Corrigé

- **L'amorce partait vers la mauvaise session** — trouvé en revue, sur le correctif lui-même. Cinq appels portaient la session, le sixième non : le brief qui dit à la session née de commencer repartait vers la session par défaut. **Neuvième occurrence du motif « une porte sur deux », commise en le corrigeant.** Le double de test note désormais **à qui** chaque geste a parlé, et un contrôle exige qu'aucun ne diverge — il compte les gestes au lieu de les nommer, parce qu'une liste de noms se déphase au premier appel ajouté, et que c'est ainsi qu'un sixième se glisse.
- **Une liste de sessions injectée vide retombait sur le vrai poste** : un essai qui disait « zéro session » mesurait les onze qui tournent, et le refus qui répond à ce cas n'était éprouvable par personne. La condition testait une vérité là où elle devait tester une présence.
- **Une garde que rien ne tenait** — trouvée en cherchant ce que le nouveau contrôle laisse passer : muter le refus sur réponse illisible laissait 27 tests verts. Le fond compte : **ne pas savoir si l'espace appartient à la session n'est pas savoir qu'il n'y appartient pas.** Confondre les deux ferait accuser l'utilisateur d'une faute qu'il n'a pas commise, et ferait naître sur une ignorance.

## [1.52.0] - 2026-08-15

### Corrigé

- **Un lieu dont les droits ne peuvent pas être versés n'est plus posé** (T-20260813-0059, PR #238). La pose rendait `ok`, quatre fichiers annoncés, zéro avertissement — et trois seulement entraient au dépôt. Un motif `.claude/` — dans un `.gitignore`, ou dans le `.git/info/exclude` que personne ne voit en revue puisqu'il n'est pas versionné — s'applique à **toute profondeur** : le `settings.json` du lieu est écrit, présent, lu sur ce poste, et git ne le prend jamais. Le lieu paraît complet chez celui qui l'a posé ; **repris depuis un autre clone, il fait naître un agent sans droits bornés**, et rien ne le dit.
- **Le défaut avait été fermé au placement et rouvert au versement.** La compétence met délibérément `settings.json` sous `.claude/` parce que Claude Code ne lit les permissions que là — un fichier à plat serait *« présent sur disque et jamais lu »*. Et il échappait au filet prévu : la pose refuse un lieu partiel en se fiant au **disque**, où il est complet. C'est **versionné** qu'il est partiel, et rien ne regardait là.
- **Refus sur le fichier des droits, avertissement sur les trois autres** — arbitrage rendu, et motivé : ce qui manque quand `CONTEXTE.md` n'est pas versé est du contexte, réparable ailleurs ; ce qui manque quand `settings.json` ne l'est pas, ce sont les permissions. Et **un avertissement de plus n'est pas lu** : mesuré le même jour sur cinq lieux clients posés, dont deux sans aucune garde et un dans aucun commit, pour zéro signalement.
- **Le refus nomme le fichier, le motif, SA SOURCE et les deux gestes qui la lèvent.** git donne la source (`.gitignore:1:` ou `.git/info/exclude:19:`) : on la cite plutôt que de laisser chercher dans le mauvais fichier. Le dirigeant a écrit *« c'est souffrant ouvrir un orchestrateur »* — un refus qui n'aide pas est exactement ce qu'il décrit.
- **La garde tombe AVANT toute écriture**, et ce n'est pas un raffinement : `git check-ignore` répond sur un chemin qui n'existe pas encore. Le refus n'a donc rien à nettoyer derrière lui, et ne peut pas rejouer `T-20260807-0067` (une pose interrompue laissant un lieu que la relance déclarait installé).
- **Une seule garde couvre les deux rôles.** Mesuré, pas supposé : les poses de l'orchestrateur et du représentant partagent le même corps et la même liste de fichiers. Le représentant avait bien le même trou — sur un lieu qui borne des accès **client** — et il se ferme au même endroit.

### Technique

- **Trois verdicts, et les confondre est le défaut qu'on ferme** : exclu · pas exclu · *pas pu mesurer*. Le troisième avertit — il ne refuse pas, et surtout il ne se tait pas.
- **Le correctif rejouait ce défaut dans son propre code, relevé en revue de fond.** Tout échec de `rev-parse` autre que « git introuvable » était pris pour le **fait** « pas de dépôt », donc traité en **silence total** — pendant que le bloc situé quinze lignes plus bas traitait « tout le reste » comme une absence de réponse. **Deux blocs du même fichier se contredisaient.** Le cas qui mord en production est la propriété douteuse (`dubious ownership`, git ≥ 2.35), courante dès qu'un dépôt appartient à un autre compte que celui qui l'interroge : le dépôt existe, il peut exclure les droits, et on serait passé à côté sans un mot. Seul « ce n'est pas un dépôt » est désormais un fait ; deux essais tiennent la distinction dans les deux sens.
- **Le message du refus n'était couvert par aucune garde anti-geste-destructeur.** Il passait — mais il le devait à personne : une propriété qui tient parce que nul ne l'a attaquée n'est pas gardée, elle est seulement encore vraie. Il rejoint la liste des messages éprouvés, vérifiée en y glissant un geste destructeur.
- **Les essais montent de VRAIS dépôts git**, y compris le cas `.git/info/exclude` qui est le cas vécu. Un double de `check-ignore` aurait prouvé l'accord de l'essai avec lui-même — ce dépôt a payé six fois un double plus permissif que le service qu'il simule.
- **Ce qui reste ouvert, et qui est assumé** : un lieu posé hors dépôt git n'est versionné nulle part, donc « pas un lieu » au sens strict. En faire un refus serait un arbitrage que le ticket n'a pas rendu — il porte sur un fichier exclu *parmi* d'autres qui, eux, sont versés.

## [1.51.0] - 2026-08-15

### Modifié

- **La naissance refuse désormais un lieu que git ne porte pas** (T-20260814-0139, PR #236). Trois états, mesurés vivants sur un poste réel : aucun commit ne porte le lieu — il n'existe que sur ce disque et disparaît avec lui ; le lieu est versé à moitié, et c'est le fichier des **droits** qui manque ; ou il porte une garde d'ouverture qu'une naissance antérieure a posée et que personne n'a versée. **Sur cinq lieux clients posés, trois étaient dans ce dernier cas** — un `git checkout` les désarmait sans un mot, le fichier restant un `settings.json` parfaitement valide, simplement sans `hooks`. Rien, à la lecture, ne distinguait un lieu gardé d'un lieu désarmé.
- **Le refus ne crée aucune exigence nouvelle** : les deux compétences prescrivaient déjà de verser le lieu en branche après la pose. Il rend cette instruction **opposable**, parce qu'elle n'était pas suivie. Chaque refus **nomme la commande exacte** qui le lève — avec `-f`, parce qu'un `git add` nu réussit en code 0 en sautant un fichier qu'un `.gitignore` exclut, et qu'un agent autonome qui colle la commande boucle alors sans le moindre indice.
- **Et il ne laisse rien derrière lui** : il tombe **avant la moindre écriture**. Prouvé plutôt que promis — aucun pane créé, `settings.json` à l'octet près, sortie standard vide.
- ⚠️ **Ce qu'il ne refuse pas, et le verrou que ça évite.** La garde que la naissance *courante* pose est seulement signalée. C'est elle qui l'écrit : la refuser rendait **toute première naissance impossible** — on ne peut pas verser un fichier que la commande refuse de créer. L'arbitrage visait juste ; c'est l'endroit de la mesure qui a dû bouger, et ça ne se voyait qu'en exécutant.
- **Les deux compétences et le harnais documentaire suivent, dans le même lot** — un refus absent de la documentation est un refus que la garde va contredire. Le contrôle qui l'ancre est commun aux deux poses, éprouvé par trois mutations, et **écarté nommément** de `/joindre-les-agents`, qui ne pose aucun lieu et ne fait naître personne.

### Corrigé

- **La naissance dit quand l'agent ne portera pas le nom de son lieu** (T-20260814-0143, v1.49.2, rappelé ici parce que le même module en porte les deux) — et l'avis **compare** les deux noms au lieu de recalculer la règle de casse, qui n'a toujours qu'un seul endroit où vivre.
- **Deux contrôles qui ne mesuraient pas ce qu'ils croyaient**, trouvés en revue de fond : l'un s'ancrait sur des mots que **les deux** messages contenaient et lisait donc le mauvais ; l'autre laissait une branche entière devenir inatteignable sans rougir. Ce qui les sépare vraiment est le **geste** rendu — un répertoire d'un côté, N fichiers de l'autre — et c'est cette forme qui est désormais ancrée.
- **Un commentaire affirmait l'inverse de sa propre fonction** : « elle avertit, elle ne refuse pas », pendant que la commande sortait en 1. Rédaction antérieure au refus, jamais reprise. C'est la documentation la plus proche du code, donc **la plus susceptible d'être crue**.
- **Les tests du binaire écrivaient dans le dépôt de travail**, faute — disait un commentaire — de pouvoir en désigner un autre. C'était faux : l'option existait depuis longtemps, et le commentaire décrivait un état révolu que personne n'avait relu. Chaque test a maintenant son propre dépôt git jetable.

## [1.50.1] - 2026-08-15

### Corrigé

- **Parler à un agent qui travaille ne rend plus un échec sur un message arrivé** (T-20260815-0007, PR #239). Régression de `v1.50.0`, trouvée **une heure après sa publication**, en production — par l'outil livré, en s'en servant pour rendre compte. Le message part bien : sur un destinataire occupé, il est **mis en file d'attente**. C'est le verdict qui mentait, et il mentait sur le chemin par lequel un chef d'équipe rend compte à son coordonnateur — où le destinataire est occupé la plupart du temps. Un orchestrateur qui croit son message perdu le renvoie, donc rejoue le défaut que `v1.50.0` venait de fermer.
- **On ne demande plus une attente dont on sait qu'elle ne peut pas être satisfaite.** `--wait --until working` guette une *transition* vers « working » : sur un agent qui y est déjà, elle ne peut rien observer et expire. On fabriquait ainsi soi-même le faux négatif qu'on allait ensuite interpréter. La mesure du 2026-08-14 l'avait pourtant écrit — la conséquence n'en avait pas été tirée sur la commande construite.
- **La file d'attente devient un témoin de prise**, au même rang que « la boîte s'est vidée » et « le statut a quitté l'attente ». C'est le seul témoin **positif** disponible sur un pair occupé : le statut ne bouge pas, et la boîte est vide *parce que* le message en est sorti. Il est cherché dans l'écran **brut** — il est rendu en gris, et la lecture de boîte retire le gris, à raison. Le même écran sert deux besoins opposés.
- **Et il ne prouve que s'il est APPARU.** Un destinataire qui avait déjà des messages en attente porte le marqueur avant qu'on écrive : s'en contenter aurait retrouvé « la boîte vide » sous un autre nom — un état vrai de toute façon, c'est-à-dire pas une preuve.

### Technique

- **Le témoin ajouté n'était prouvé par aucun essai — relevé en revue de fond, et c'est le motif de ce dépôt rejoué dans le correctif d'un correctif, à une heure d'intervalle.** Le neutraliser entièrement laissait les douze essais verts, y compris les deux écrits nommément pour ce ticket. La raison est instructive : le correctif a **deux moitiés**, et la première — retirer l'attente impossible — suffisait à réparer la panne rapportée. La seconde était donc invisible, faute d'un scénario qui la sollicite. Un essai l'isole désormais : l'appel se rapporte en échec, le destinataire travaillait déjà, et le message est pourtant parti — il ne reste que le marqueur. Les trois mutations de la revue rougissent.
- **La reconnaissance du marqueur s'accroche au fait, pas à la tournure** : « Press up to edit » est de la formulation, « queued messages » est ce qui est dit. Si la phrase change quand même, la panne est **silencieuse** — le témoin cesse de témoigner et le code retombe sur les autres. Le risque est nommé à l'endroit du code où il se joue.
- **Le sens du champ `attendu` dépend du destinataire** et ne l'était nulle part : sur une session en attente c'est une transition observée, sur un pair au travail c'est seulement l'acceptation de l'appel. Documenté là où il est rendu. Aucun consommateur affecté.
- **Un risque résiduel est laissé ouvert sciemment** : si l'envoi rendait un succès en perdant le message, sans file ni écriture, rien ne le verrait. Aucun témoin n'existe pour ce cas — en inventer un serait précisément la preuve creuse que ce lot et le précédent viennent de retirer deux fois.

## [1.50.0] - 2026-08-15

### Corrigé

- **L'invitation à une ligne se prouve par les membres du canal, jamais par un `ok`** (T-20260814-0136, PR #231). `ouvrir … --au-dirigeant` rendait `ok: true` sur une ligne **déjà ouverte** sans faire entrer personne : la branche de **reprise** rafraîchissait le pane, écrivait la liste des autorisés au registre local, et sortait — **sans un seul appel distant**. `inviter` n'existait qu'à un endroit du fichier, dans la branche de création. Un orchestrateur a posté trois demandes d'arbitrage dans un canal qui n'a jamais eu qu'un membre : son propre robot. **Un dispositif qui rend `ok` sans avoir agi est pire que pas de dispositif** — il donne une garantie fausse, et personne ne va vérifier derrière.
- **Un seul chemin d'invitation, partagé par la création et la reprise**, qui relit les membres **avant** (une reprise saine ne paie rien) et **après** (c'est là qu'est la preuve). Deux appels écrits séparément, ce sont deux portes — et l'histoire de ce dépôt dit qu'une seule finit gardée.
- **Une ligne interne sans personne à inviter est refusée**, comme l'aide le promettait depuis toujours sans que le code le tienne. La garde porte sur **l'état atteint** — la liste d'autorisés est-elle vide ? — jamais sur les drapeaux : écrite sur `--au-dirigeant`, elle aurait laissé passer les deux autres chemins qui mènent au même canal muet.
- **Un courriel d'invité qui ne désigne personne est refusé.** Il produisait un avertissement sur la sortie d'erreur, code 0, et la ligne s'ouvrait sans lui. Ce chemin résolvait le courriel **dans la commande**, qui lisait le trousseau du poste : il était donc **inéprouvable**, la cloison d'essais refusant le trousseau — un essai qui l'appelait passait au vert parce que la commande *tombait*, pas parce qu'elle refusait. La résolution revient au veilleur, qui a déjà le jeton.
- **Une ligne durable ne s'archive plus à la fermeture** (T-20260814-0085). Refermer une ligne interne archivait son canal ; Slack refuse ensuite un homonyme archivé, et le désarchivage est réservé à un compte humain. Une ligne d'orchestrateur y est restée **morte et irrécupérable sous son nom**, et la seule sortie était d'en rouvrir une sous un titre différent — donc de perdre le lien entre le canal et le chantier tel qu'il était nommé. **La cause n'est pas Slack** : le code déduisait la jetabilité de la NATURE. Cette règle valait quand toutes les lignes internes étaient des lignes de chantier ; elle a cessé de valoir en `v1.45.0`, et l'incident montre qu'une ligne de chantier est durable elle aussi — on peut avoir besoin de la refaire.
- **Le repli penche vers `durable`, et c'est la décision du lot.** Ce qui décide n'est pas la fréquence mais la **réversibilité** : archiver est définitif pour nous, ne pas archiver laisse un canal qu'un humain ferme en trente secondes. Le registre survit aux versions du pack et **rien ne migre** — toutes les lignes déjà ouvertes sont sans ce champ, dont celles qui ont mordu. Un repli vers `jetable` aurait livré un correctif qui ne corrige rien pour le parc existant. Les **deux** sites d'archivage suivent la règle ; la protection du canal client reste une garde indépendante, inchangée.
- **Parler à un agent passe par une voie qui relit sa boîte de saisie** (T-20260814-0138). `herdr agent prompt` rend un succès même quand le message y reste sans être soumis : l'expéditeur a son accusé, le destinataire reste `idle` — indistinguable d'un agent qui n'a rien à faire — et **personne des deux côtés ne peut le savoir**. Le compte rendu perdu de cette façon est le pire des cas : le coordonnateur croit que le lot tourne, son chef d'équipe croit avoir rendu.
- **Le destinataire se désigne par son NOM et se cherche dans TOUTES les sessions du poste.** La voie sûre ne connaissait que la sienne : onze sessions tournent sur ce poste, le destinataire est presque toujours ailleurs, et elle échouait donc **précisément dans le cas normal** — sur un refus qui parlait d'un statut « — » et envoyait chercher un défaut chez le destinataire. Deux refus l'accompagnent : un nom que personne ne porte, et des **homonymes**, parce que prendre le premier trouvé livrerait un compte rendu au mauvais chantier, en silence.
- **Un pair qui travaille reste joignable.** Le refus sur « session occupée » ne protégeait pas d'un danger mais d'une **preuve** — le témoin `working` serait vrai avant même qu'on écrive. Il reste le contrat du brief de naissance (`--en-attente`) ; ailleurs, c'est le témoin qui change, pas la garde qui tombe. Sans ça, il n'existait aucune voie vérifiée pour parler à un agent vivant.
- **La parole du dirigeant vers son agent relit aussi** — c'était l'autre porte, et celle qui porte le plus : le texte y vient de Slack, donc de longueur arbitraire. Un arbitrage pouvait se perdre sur le chemin même qui existe pour le garantir.

### Technique

- **La mesure dément le ticket, et c'est ce qui a donné sa forme au remède.** 25 envois contre le vrai service, de 350 à **24 000** caractères, de 1 à 100 lignes, avec et sans ponctuation exotique : **aucun collage**. Le seuil supposé n'existe pas — le phénomène est une **course** (le même envoi de 2 400 caractères reste bloqué 2 fois sur 5 sur l'autre primitive), et la probabilité monte avec la longueur sans jamais devenir certaine. On ne code donc **aucun seuil** : on vérifie après coup, à chaque fois, et on répare.
- **Une boîte VIDE n'est pas un écran vide** — défaut trouvé par la mesure, dans aucun ticket. Claude Code y affiche une **suggestion grisée** tirée de l'historique, que rien ne distingue d'un reste en texte brut : on refusait donc de livrer sur une session parfaitement saine. L'écran se lit en `--format ansi`, et ce qui est grisé ne compte pas.
- **Le témoin central du lot ne prouvait rien, et c'est la revue de fond qui l'a montré** : muté pour rendre « pris » sans jamais lire la boîte, il laissait les 179 essais verts. **La preuve-par-relecture manquait à elle-même sur son cas nominal.** Trois essais la couvrent désormais. Dans la foulée : un appel d'envoi qui échoue sans toucher la boîte comptait comme une livraison — une boîte vide parce que rien n'a été écrit est **l'état par défaut**, donc le contraire d'une preuve.
- **Un effet de bord du correctif d'archivage, non vu à l'écriture.** Les noms de canaux ne comptaient que les lignes **ouvertes** : un chantier clos libérait son nom. Sans risque tant qu'une ligne interne s'archivait — une collision retombait sur un refus visible. Depuis qu'elle est durable, son canal survit : un autre chantier au même nom normalisé **reprenait silencieusement le canal de l'ancien**, historique et membres compris. Une panne bruyante remplacée par une confusion muette est un mauvais échange. Corrigé, avec deux garde-fous que la première écriture avait manqués — une ligne ne se fait pas concurrence à elle-même, et une ligne cliente close ne retient rien (c'est le **relèvement**, que cette garde avait cassé avant que son essai ne l'arrête).
- **Six doubles de Slack avaient une invitation sans effet observable** : ils étaient structurellement incapables de voir une invitation qui ne part pas, pendant que la panne mesurée était exactement celle-là. Le double n'était pas en cause dans l'essai de reprise — c'est **l'assertion** qui manquait : il regardait le registre local, qui disait vrai pendant toute la panne.
- **La lecture de la boîte de saisie vit désormais à un seul endroit**, partagé par les deux modules qui écrivent dans un pane. La recopier aurait rejoué « une porte sur deux ».
- **La cloison d'essais couvre l'énumération des sessions du poste** : un essai qui les balaie rend un verdict dépendant de ce qui est ouvert au moment où il tourne. Le premier jet du correctif a vu « onze agents répondent au même pane ».
- Le métier et le gabarit de l'orchestrateur enseignaient le geste nu pour parler à un pair ; un contrôle du harnais rougit désormais si un bloc de commande le réintroduit.

## [1.49.2] - 2026-08-15

### Corrigé

- **La naissance dit désormais que l'agent ne portera pas le nom de son lieu** (T-20260814-0143, PR #234). herdr n'accepte que les minuscules : un lieu `.gestionnaire/Charles-Olivier` fait naître un agent nommé `charles-olivier`. **L'abaissement est juste ; c'était le silence qui coûtait.** Quatre lieux d'un poste réel sont dans ce cas, et ça suffit pour qu'un agent soit « introuvable par le nom que la naissance a rendu » **sans qu'aucun renommage n'ait eu lieu** — c'est la cause, enfin mesurée, d'un écart que le praticien précédent rapportait comme un mystère. Le seul endroit qui portait déjà le fait était un champ d'un objet JSON de douze clés, dont deux ne diffèrent que par une capitale : **un fait que personne ne relit n'est pas dit.** La commande l'écrit maintenant sur la sortie d'erreur, avant de créer quoi que ce soit, avec les deux noms et le geste pour adresser l'agent.
- **Elle se tait quand il n'y a rien à dire**, et c'est éprouvé au même titre que le reste : un avis qui tombe à chaque naissance devient du bruit, et un bruit cesse d'être lu — ce qui ramènerait exactement le silence qu'il existe pour rompre.
- **L'avis compare les deux noms, il ne recalcule pas la règle de casse** — trouvé en revue de fond. La première version refaisait l'abaissement de son côté, remettant la règle à **deux endroits** alors que `v1.49.0` venait de la ramener à un seul (« un seul nom de lieu, une seule règle », T-20260814-0101, le jour même). Les deux coïncidaient, donc rien ne cassait : **c'est la forme que prend ce défaut avant de mordre.** Le contrôle qui l'ancre ne s'y laisse pas prendre — il passe un nom d'agent qui n'est pas l'abaissement du lieu, ce dont une version qui recalcule ne dirait rien.
- **L'outil de test jetait ce qu'il était censé mesurer.** L'aide qui lance la commande rendait une sortie d'erreur vide sur le chemin du succès : **aucun avertissement de réussite n'était donc éprouvable** dans ce module, quel qu'il soit. Réparée — et la revue l'a vérifié en réintroduisant l'ancienne forme, qui fait aussitôt rougir le nouveau contrôle.

## [1.49.1] - 2026-08-14

### Corrigé

- **Le brief se livre par la commande du poste, jamais par un chemin de dépôt** (T-20260814-0140, PR #232). Le métier de l'orchestrateur et `/orchestrer-chantier` prescrivaient tous deux `node <depot>/naissance-representant/bin/livrer.js`. Or ce module porte `"scope": "poste"` : il vit dans `~/.somtech` et **n'est jamais copié dans un dépôt**. Mesuré sur les quatre dépôts clients — le dossier n'y existe nulle part. **Tout orchestrateur posé chez un client qui suivait son propre métier à la lettre obtenait un `MODULE_NOT_FOUND`**, et le chemin résolvait dans le pack, le seul dépôt qui héberge les deux par hasard : donc nulle part où on l'éprouve. Le code, lui, avait écrit le motif mot pour mot — *« dans le dépôt d'un client, il ne pointerait sur rien »* — pendant que deux documents ne le suivaient pas.
- **Le contrôle posé ne cherche pas ces deux chemins-là.** Il lit `pack.json` pour savoir quels modules sont de portée poste, lit l'installateur pour savoir où le poste les installe, et lit `pack.json` encore pour savoir ce que le module `core` distribue sous `.claude/`. Une racine ajoutée demain y entre seule ; un module qui devient « poste » aussi. Et il **refuse de tourner** si le manifeste cesse de déclarer ce qu'il lit, plutôt que de rester vert sur rien.
- **Ce contrôle a failli deux fois sur son propre périmètre**, jamais sur ce qu'il mesure — et la revue de fond l'a démasqué les deux fois. Il ne regardait d'abord que `CLAUDE.md` et `SKILL.md` : le même défaut réintroduit dans le `settings.json` posé **juste à côté, dans le même dossier, recopié chez le même client**, restait vert. Élargi à quatre sous-dossiers *choisis à la main*, il laissait encore `agents/`, `hooks/`, `schemas/`, `user-skills/` et le `settings.json` racine hors de vue, alors que `core` distribue `.claude/` en entier. **Un contrôle qui décide lui-même de ce qu'il regarde décide aussi de ce qu'il ne verra pas** — le motif est écrit en tête du fichier.
- **Ce que ce correctif ne fait pas descendre tout seul.** Les lieux d'orchestrateur déjà posés gardent l'ancienne forme, et les deux moitiés ne voyagent pas par le même geste : la compétence par `pack update`, le métier du lieu par `pack orchestrateur-update --nom <nom>`. Deux lieux clients sont concernés, et leur rafraîchissement demande une session ouverte dans chacun.

## [1.49.0] - 2026-08-14

### Corrigé

- **Un seul nom de lieu, une seule règle** (T-20260814-0101, PR #228). La pose écrivait le dossier avec le nom brut ; la mise à jour exigeait un slug en minuscules. **Quatre lieux sur cinq d'un poste réel étaient donc inatteignables** — `Charles-Olivier`, `Francois`, `Jacob`, `Zach` — et **macOS le masquait** en ignorant la casse : la commande visait `francois`, atteignait `Francois`, et paraissait marcher. Sur un volume sensible à la casse, elle aurait créé un second lieu vide et muet pendant que le vrai restait périmé. La pose, la naissance et la mise à jour passent désormais par **la même résolution**.
- **C'est le nom brut qui fait foi** : la casse est portée, jamais imposée. Normaliser aurait cassé les quatre lieux existants, qu'il aurait fallu renommer chez quatre clients avec leurs gestionnaires dessus. **Aucun geste requis de personne.**
- **La pose n'avait aucune garde contre l'évasion de chemin** — `join(depot, dossier, '../../evil')` écrivait hors du dépôt du client. C'est un durcissement net, et la liste blanche reste une liste blanche : aucun métacaractère de chemin n'y entre.
- **Le cas sensible à la casse est prouvé, pas supposé.** Les tests mesurent la sensibilité du volume par sonde — jamais déduite de la plateforme — et **se déclarent non prouvables plutôt que verts** quand il est insensible. Rejoués sur un volume APFS sensible monté pour l'occasion, et exécutés à chaque demande de fusion par la chaîne Linux. Deux témoins rejouent l'ancien geste pour établir que le mode de panne existait vraiment.
- **La porte humaine était restée ouverte** — trouvé en revue de fond : l'aide et le README prescrivaient encore des minuscules pendant que le code acceptait la casse libre. La garde posée en réponse était une liste noire de tournures, **défaite en une mutation** ; elle est devenue une constante unique que l'aide et le README citent, exigée par comparaison littérale sur l'aide **rendue**.

## [1.48.0] - 2026-08-14

### Ajouté

- **Le gestionnaire client et l'orchestrateur d'un chantier se parlent, dans les deux sens** (T-20260814-0093, PR #226). La boucle était ouverte depuis le premier jour : le cadrage disait *« l'orchestrateur rend compte au gestionnaire »*, et le compte rendu n'avait nulle part où revenir. Le gestionnaire ne pouvait donc pas informer son client de l'avancement — sa fonction même. Le dirigeant a tranché le sens en cours de lot : **« c'est une équipe »**. Ce n'est pas un canal de compte rendu, c'est une conversation de travail entre pairs — le gestionnaire signale ce qu'il a ouvert, demande une échéance, relance.
- **Ce qui s'y demande ne se commande pas**, et c'est écrit dans le métier des **deux** rôles : l'orchestrateur reste maître de son chantier et de ses priorités. Sans cette phrase, un gestionnaire finirait par diriger le chantier à travers les demandes de son client.
- **C'est l'orchestrateur qui autorise son gestionnaire**, à l'ouverture de sa ligne ou à sa reprise s'il arrive en cours de route. Il le connaît par son brief ; sans l'option, **rien ne change** — un orchestrateur sans gestionnaire fonctionne exactement comme avant.
- **Aucun canal de plus** : la ligne du chantier existait déjà, elle porte désormais deux pairs au lieu d'un.

### Corrigé

- **Trois refus structurels**, chacun mis à l'épreuve par mutation : une ligne **cliente** ne porte jamais de pair, un pair doit être un représentant **établi par son lieu** — jamais par son nom —, et un pane repris par un autre agent ne reçoit plus rien.
- **Le pair pouvait fermer et archiver le chantier de son orchestrateur** — trouvé en revue de fond. La sélection de ligne sert trois gestes, pas un : la garde posée sur `dire` laissait `fermer` et `renommer` ouverts. Neuvième occurrence du motif « une porte sur deux », et la deuxième fois qu'il frappe la sélection de ligne.
- **Un pane repris par un autre agent recevait tout le fil technique** avec un accusé de remise positif.

## [1.47.0] - 2026-08-14

### Ajouté

- **`/joindre-les-agents` — la compétence qui désigne les canaux communs et le dirigeant** (T-20260814-0071, PR #224). Trois commandes brutes restaient à taper à la main, avec un ordre qui compte et deux pièges que rien n'annonçait : le rôle du gestionnaire s'écrit `representant` — son nom interne — et un canal par rôle, un rôle par canal. **Troisième fois que la mécanique partait sans son interface**, et troisième fois que c'est le dirigeant qui l'attrape après coup.
- **Elle mesure l'état avant d'agir** au lieu de rejouer les commandes à l'aveugle : le dirigeant est-il déjà désigné, **quels rôles n'ont pas encore de canal** — la question qu'un humain ne peut pas se poser sans lire le registre —, le canal existe-t-il, le robot y est-il. Relancée sur un poste configuré, elle dit ce qui est en place et **ne refait rien**.
- **Elle porte la traduction des noms internes** : on dit « gestionnaire », la commande attend `representant`. La table est confrontée aux rôles que le code déclare — chaque rôle connu doit y figurer, et aucun rôle inventé n'est toléré.
- **Aucune mécanique neuve** : trois fichiers ajoutés, aucun modifié, `ligne-directe/` intact. La mise à jour du pack reste hors périmètre — gardé par un test, pas par une intention.

### Corrigé

- **Le refus du trousseau n'était expliqué nulle part**, alors que c'est le premier qu'un poste neuf rencontre. Trouvé en écrivant la compétence, corrigé dedans.
- **Les refus sont relayés, jamais reformulés** — et cette exigence n'avait, elle, aucun contrôle : la revue de fond l'a signalée bloquante, rouvrant `T-20260811-0087`. Un test exige désormais que chaque fragment cité existe **littéralement** dans le code qui le rend. Trois tours de revue, cinq défauts, dont quatre correctifs qui se contournaient eux-mêmes — trois par simple ajout. Les neuf mutations qui ont contourné une garde sont conservées telles quelles dans le harnais.

## [1.46.0] - 2026-08-14

### Ajouté

- **Un canal commun par rôle, et les chefs d'équipe ne reçoivent rien** (T-20260814-0002, PR #217). Le canal livré en 1.42.0 atteignait *tous* les agents, ce qui obligeait chacun à trier ce qui ne le concernait pas — et un canal qui oblige à trier cesse d'être lu. Le dirigeant l'a dit sans détour : *« ça ne sert à rien, je ne m'en servirai pas sinon »*. Un « nouveau MCP au ServiceDesk » ne concerne pas un gestionnaire ; une règle de conduite face au client ne concerne pas un orchestrateur.
- **Un chef d'équipe reçoit ce qui le concerne de son orchestrateur, jamais du canal.** Il a un lien unique — et le rapport du chantier Bélanger documente ce qu'il en coûte quand des ordres lui arrivent d'ailleurs : des consignes exécutées qui ne venaient de personne, jusqu'à cinq sur six.
- **Le rôle est établi par le lieu d'où l'agent tourne**, jamais par son nom : `roleDuLieu` exige les **quatre fichiers** de la pose *et* les en-têtes réels du métier. Écartés parce qu'ils ne prouvent rien — le nom herdr (une chaîne que n'importe qui écrit), le dossier (une convention de nommage), la ligne au registre (elle ne dit rien du rôle).
- **Le silence est le cas par défaut, par construction.** Un rôle indéterminé — un worktree ordinaire, par exemple — ne reçoit rien : **il faut ajouter du code pour diffuser, jamais pour se taire.** Prouvé par l'absence, dans le pane du chef d'équipe, sur les deux canaux, avec un orchestrateur voisin qui reçoit bien — sans quoi l'essai n'aurait rien prouvé.
- **Les trois gardes du lot précédent rejouées à plusieurs canaux** — par rôle et sur les deux clés, avec une ligne héritée sur chaque canal. La revue de fond a trouvé un faux témoin : remplacer `.every` par `.some` sur la résolution du rôle laissait 535 tests verts.

## [1.45.0] - 2026-08-14

### Ajouté

- **Le gestionnaire client peut enfin parler au dirigeant** (T-20260813-0076 et T-20260814-0033, PR #221). Il n'avait qu'une ligne — celle de son client — alors que **quatre obligations livrées** de son métier lui imposent de remonter : ce qui engage Somtech, toute situation problématique **avant** d'en parler au client, une question qu'il ne peut pas trancher, et son topo du matin. Il était tenu de faire une chose qu'il n'avait pas le moyen de faire.
- **Sa seconde ligne est posée à sa naissance, par le garde d'ouverture** — pas au premier message. Le dirigeant initie quand il veut ; la ligne doit donc exister avant que l'agent ait quoi que ce soit à dire. Le garde tient le pane fermé tant que les deux ne sont pas là : une consigne écrite se relâche, un refus mécanique non.
- **`roles.js` déclare les lignes d'un rôle, pas sa nature** — un rôle en porte plusieurs. Le représentant en a deux, l'orchestrateur une. Une ligne de table, jamais un second module.
- **Un canal par gestionnaire** (`#ligne-dirigeant-<client>`), et non un canal commun aux gestionnaires : partagé, ils se liraient entre eux, et les affaires d'un client seraient visibles par le représentant d'un autre. La prolifération est le prix assumé du cloisonnement.
- **L'adresse du dirigeant ne part jamais dans le dépôt d'un client.** Elle est désignée une fois par poste ; l'agent demande « le dirigeant », jamais son courriel.
- **Son métier dit désormais ce qui ne traverse jamais**, et le nomme comme un « jamais » plutôt que comme un conseil. L'interdit devenu faux — *« tu n'ouvres jamais une seconde ligne »* — est retiré, mais ce qu'il protégeait est tenu autrement : par le nommage obligatoire du destinataire, gardé par mutation des deux côtés.

### Corrigé

- **Le métier prescrivait une séquence que le garde refusait.** Ses propres commentaires de fin de ligne : le commentaire shell avait été appris au garde par **un seul de ses deux chemins**. Un gestionnaire qui recopiait son propre métier était bloqué au premier geste, **sans qu'aucune des deux suites ne rougisse**. Un contrôle neuf fait désormais le pont entre les deux lots — il présente la séquence réelle du métier au garde réel, et résout chaque destinataire contre les lignes que le métier ouvre.
- **La moitié qui manquait au harnais de mutation est posée.** Il prouvait qu'une garde attrape ce qu'elle doit ; il ne prouvait pas qu'elle **laisse passer ce qui marche**. Quatre passages de revue de fond ont trouvé quatre défauts, dont **trois dans les correctifs eux-mêmes** — une correction posée sur le symptôme plutôt qu'à la racine, des alternatives trop larges dont une faisait rougir un texte vivant dans deux compétences, et un principe enfreint sur son voisin dans le commit qui l'écrivait. Aucun n'était visible en relecture ; tous l'étaient par mutation.

## [1.44.0] - 2026-08-14

### Corrigé

- **Le routage sortant ne devine plus la ligne, on la nomme** (T-20260813-0078, PR #218). La commande cherchait sa ligne par le pane — une clé qui ne l'identifie pas : deux lignes sur un même pane, et `find` prenait la première inscrite au registre en ignorant l'autre **en silence**. Reproduit : un rapport destiné à un chantier est parti dans le canal d'un autre, avec un succès affiché et sans un mot. `--a <ligne>` désigne désormais le destinataire, et la commande passe le canal au veilleur, qui savait déjà router par cette clé unique — la mécanique existait à l'arrivée, personne ne s'en servait.
- **L'ambiguïté est refusée au lieu d'être devinée.** Plus d'un candidat sans nom → refus, jamais le premier venu. C'est le renversement livré sur le trousseau, appliqué au routage : l'incertitude tombe du côté prudent. Un seul candidat n'exige aucun nom — rien de ce qui tourne ne casse.
- **Les deux clés couvertes sur les trois gestes** — `dire`, `fermer`, `renommer`. La revue de fond a trouvé un bloquant : `renommer` n'avait pas reçu la garde « ligne close » que `fermer` avait obtenue — *une porte sur deux dans le correctif lui-même*. Et une régression du correctif : `--a` cherché dans tout le tableau le trouvait comme **valeur d'une autre option**, ce qui cassait `fermer --bilan --a`.

### Ajouté

- **Ce que ça débloque** : un agent peut désormais porter plusieurs lignes et parler sur chacune sans risque d'inversion. C'est le préalable de la ligne privée entre le dirigeant et chaque gestionnaire client — jusqu'ici, un gestionnaire n'avait aucun moyen de lui remonter quoi que ce soit, alors que quatre obligations de son métier l'exigent.

## [1.43.0] - 2026-08-14

### Ajouté

- **Le gestionnaire client porte les cinq critères du standard sur les biais, et un bornage mécanique** (T-20260813-0063, PR #213). Il en portait quatre — anti-complaisance, anti-fabulation, calibration, anti-ancrage. Le contexte québécois manquait, et c'est lui, seul des deux rôles à parler au client, qui pouvait écrire « LLC » au lieu d'« Inc. » ou invoquer une règle de protection des renseignements qui n'est pas la Loi 25.
- **Les trois angles de l'autorité, tenus ensemble plutôt qu'empilés** : ce qu'il dit engage Somtech (la parole), il ne cite jamais ce qu'il n'a pas lu textuellement (la citation), il ne donne aucun prix ni délai (le chiffre). Trois règles voisines que rien ne reliait — donc trois règles dont on applique une en oubliant les deux autres. Une seule table les porte désormais, avec l'enjeu de chacune.
- **Ce que ses droits refusent** : `WebFetch`, `WebSearch`, `curl` et `wget`. Un représentant n'a rien à aller chercher hors de nos registres, et ce qu'il rapporterait du dehors arriverait chez un client sous l'en-tête de Somtech.

### Corrigé

- **La compétence promettait une fermeture que le mécanisme ne tient pas.** Mesuré : un `deny` mord même dans un dépôt non approuvé, mais un `allow` est **ignoré** tant qu'un humain n'a pas approuvé le dépôt, et **une commande shell non listée s'exécute sans rien demander**. Le bornage est donc une **liste finie opposée à un phénomène ouvert** — utile, jamais étanche. Le texte le dit maintenant au lieu de le promettre ; la dette est ouverte (T-20260814-0025) et vaut aussi pour le lieu de l'orchestrateur.

## [1.42.0] - 2026-08-13

### Ajouté

- **Le canal commun atteint les agents qui tournent déjà** (T-20260813-0075, PR #214). Jusqu'ici chaque agent n'entendait que sa propre ligne : une version publiée ne parvenait à personne, il fallait aller le dire un par un ou attendre que les sessions meurent — sept versions en une semaine, six en une soirée. Le canal porte ce qui doit être **pris en compte rapidement** ; le feed continue de porter ce qui doit être **su** et se relit à la naissance. Aucun des deux ne couvre le cas seul.
- **Un message y est une intention, pas un ordre** — l'agent le prend en compte et choisit son moment. **Personne ne s'abonne** : herdr dit qui travaille, le veilleur remet à chacun, donc un agent sans ligne entend aussi.
- **Le canal commun n'est pas une ligne, et c'est la décision qui fait tenir le lot.** Aucune troisième nature ne lui a été donnée : une nature qualifie une ligne — son pane, son chantier, ses autorisations — et le canal n'a rien de tout cela. Lui en attribuer une l'aurait fait entrer dans les structures de lignes, c'est-à-dire rejouer le défaut qu'il fallait éviter. Il reçoit à la place son propre cadre de remise, qui dit d'où vient le message, qu'il vaut pour tous, qu'on n'y répond pas, et que la ligne propre de l'agent est intacte.
- **Rien ne repart vers le canal commun**, prouvé par l'absence côté Slack et non par le texte d'un refus. `dire`, `fermer` et `renommer` sont refusés **sur les deux clés** — canal et chantier : la première garde n'en couvrait qu'une, et la mutation l'a prise en défaut. `fermer` aurait posté son bilan dans le canal de tous, puis l'aurait archivé.

### Corrigé

- **Un canal archivé se désignait avec succès** — trouvé en revue de fond. Le canal avait l'air posé, et aucune consigne n'en serait jamais partie. Même famille que le lieu vide déclaré installé du lot jumeau : un succès rendu sur un état qui ne peut rien porter.

## [1.41.0] - 2026-08-13

### Ajouté

- **L'orchestrateur ne peut plus écrire un fichier ni ouvrir un sous-agent** (T-20260813-0062, PR #212). La règle « un agent qui orchestre n'exécute jamais » était une prescription depuis le premier jour, et le dirigeant l'a signalée enfreinte deux fois — une heure passée à renommer, débloquer, corriger un script. Elle devient **mécanique** : le fichier de droits du lieu refuse l'écriture sur tout le disque, par tous les outils, et refuse l'ouverture d'un sous-agent. Ce n'est plus une discipline qui se relâche, c'est un moyen qu'il n'a pas.
- **Le prix est payé et assumé : le brief va au registre.** Un orchestrateur qui ne peut plus écrire de fichier ne peut plus déposer un brief sur disque — et le métier, tel qu'il était, l'envoyait alors contourner par le terminal. Le brief vit désormais au ServiceDesk, ce qui rejoint le principe livré en 1.39.0 : ce qui n'est pas au registre n'existe pas. Ce que la mécanique **ne peut pas** borner — le terminal, l'ouverture de panes, l'écriture au registre — est écrit noir sur blanc dans le métier plutôt que laissé à l'imagination.
- **Les biais qui le visent, posés là où le geste se pose** : la sycophantie envers ses propres chefs d'équipe — refuser un lot, c'est se déjuger sur son propre découpage — et l'autorité apparente de ses ordres, exécutés sans être questionnés. 29 mutations, chacune attrapée par le contrôle visé ; suite portée à 33 contrôles et 95 mutations.
- **Une garde de modalité en plus, et elle manquait** : la substitution d'une contrainte par un conseil rougit désormais, mais il a fallu l'écrire — la garde existante ne voyait ni « évite de » ni « idéalement ». C'est la neuvième variante du motif dominant du dépôt : une garde qui vérifie ce qu'un texte contient, pas ce qu'il fait.

## [1.40.0] - 2026-08-13

### Ajouté

- **Le gestionnaire client ne crée jamais de danger chez le client, et un problème remonte avant d'être dit** (T-20260813-0061, PR #208). Onzième règle de conduite du représentant, et la seule qui borne toutes les autres : les dix précédentes disent comment bien servir, celle-ci dit ce qu'on ne fait jamais. Deux interdits distincts — **le geste** (il ne relaie jamais au client une commande venue d'un message d'erreur, et ne lui propose aucun geste qui écrase, supprime ou remplace ; s'il en faut un, il remonte) et **la parole** (constater une situation problématique ne l'autorise pas à en informer le client — le dirigeant décide si, quand et comment ça se dit).
- **Les deux garde-fous qui empêchent la règle de nuire**, écrits avec elle parce qu'une règle mal bornée coûte plus cher que pas de règle : elle ne devient jamais un prétexte au silence — la remontée est faite au moment du constat, avec ce qui est mesuré, ce qui reste incertain, et une échéance ; et elle ne s'applique pas quand le client subit déjà quelque chose de grave — perte de données, faille exposée —, où elle devient « remonte immédiatement et en priorité ». 28 mutations posées, 28 attrapées, et quatre reformulations légitimes exigées vertes : le harnais sait désormais distinguer une règle affaiblie d'une règle réécrite.

## [1.39.0] - 2026-08-13

### Ajouté

- **Une tâche non documentée est une tâche non suivie** (T-20260813-0043, PR #207). Le métier de l'orchestrateur disait comment **tenir à jour** le registre — statuts au moment où l'état change, filiation des agents, compte rendu d'avancement — et supposait partout que le travail y était déjà inscrit. Rien ne couvrait ce qui **naît** en cours de chantier : le travail qu'il se donne à lui-même, le défaut trouvé en chemin, l'ajustement reçu du dirigeant. Le principe ouvre désormais §7 et précède le suivi au lieu de le suivre. Il porte son critère d'arrêt — un travail qu'un ticket existant décrit déjà en entier en est l'aboutissement — pour qu'il ne dégénère pas en bruit.
- **Le geste qui déverrouille la cascade**, prescrit en §2 comme une mécanique et non comme une consigne : `received → in_analysis` au moment où l'orchestrateur prend le chantier. Les déclencheurs qui font ensuite avancer une demande partent de `in_analysis` — sans ce geste manuel, rien en aval ne s'automatise. Vécu : une demande a dit « reçue » pendant deux jours alors que ses deux lots étaient en production.

### Corrigé

- **Le refus ne se prononce sur une absence que s'il l'a prouvée** (T-20260813-0054, PR #209). Trois causes sans rapport — binaire introuvable, trousseau verrouillé, entrée réellement absente — rendaient le même verdict « aucune entrée ne répond », suivi d'une marche à suivre pour **déposer un jeton par-dessus celui qui fonctionne**. Le dirigeant l'a rencontré deux fois en trois jours. La charge de la preuve est renversée : `jeton_absent` exige une preuve positive (code 44, ou la phrase de `security`) ; tout le reste, connu ou inconnu, devient `jeton_illisible` — avec la cause brute, et aucune commande de dépôt. Une cause qu'on n'avait pas prévue tombe désormais du côté prudent, au lieu du côté qui ment.
- **Sept portes traitées, le représentant compris** — le ticket en listait cinq. Les binaires du système sont appelés par chemin absolu, et la lecture du jeton côté représentant est entourée comme elle l'était côté orchestrateur : son échec devient un refus structuré au lieu d'une exception qui traverse. La revue de fond a trouvé que l'appel Slack qui suit ne l'était pas — « une porte sur deux » reproduit dans le correctif du défaut « une porte sur deux ». D'où le motif `canal_illisible` et un filet structurel dans la pose.

## [1.38.0] - 2026-08-13

### Ajouté

- **La compétence qui pose un orchestrateur** (T-20260813-0030, PR #205). La mécanique existait depuis la 1.37.0, mais rien ne l'enveloppait : il fallait lancer les commandes à la main, puis brancher, verser et ouvrir la demande de fusion soi-même. Le gestionnaire client avait sa compétence depuis le premier jour ; l'orchestrateur n'en avait pas — le parallèle avait semblé aller de soi, et il n'allait pas de soi. Le manque a été trouvé par la question du dirigeant : « je ne lance pas les commandes via une session Claude ? ». La compétence enveloppe désormais le geste complet — elle vérifie, refuse en disant quoi faire, pose le lieu, verse en branche et ouvre la demande de fusion.
- **Deux différences avec la compétence du gestionnaire, portées explicitement** : aucun canal client à donner, puisque l'orchestrateur ouvre sa propre ligne directe ; et un **refus si cette ligne ne peut pas s'ouvrir**, sa ligne étant obligatoire (décision du 2026-08-12). C'est le pendant du canal injoignable côté gestionnaire, et le même mode de panne qu'il évite : un agent qui croit parler sans que personne l'entende.

## [1.37.0] - 2026-08-13

### Ajouté

- **On peut désormais poser le lieu d'un orchestrateur, l'y faire naître, et garder ses copies à jour** (E-20260813-0002, PR #203). Second et dernier lot du dispositif : l'orchestrateur cesse d'être une session qu'on transforme et devient un lieu versionné, exactement comme le gestionnaire client. `ligne-directe orchestrateur <nom> [--depot <chemin>]` pose un lieu nommé, quatre fichiers, et **refuse** avant toute écriture si les gabarits manquent au dépôt ou si la ligne directe ne peut pas s'ouvrir. `naitre <nom> --workspace <ws> --role orchestrateur [--amorce <fichier>]` fait naître la session dans ce lieu, y charge son métier, et démarre. `pack orchestrateur-update --nom <nom>` fait converger le métier vers le pack sans jamais toucher au contexte. Le lot déclenche aussi le scrum matinal par agents de session, et porte le septième ajout au métier — l'orchestrateur se sert des mémoires, avec l'invariant qui compte : un rappel ne fait pas foi.
- **La factorisation avec le gestionnaire client.** Les deux rôles ne diffèrent plus que par une table (`ligne-directe/src/roles.js`) ; le reste — les trois gardes, le point d'écriture unique, l'attente avant de nommer, la vérification par le fait — est le même code, celui qui a coûté sept défauts au premier lot.

### Corrigé

- **Deux défauts trouvés en prouvant contre le vrai service, qui bénéficient aussi au gestionnaire client.** Une session née dans un répertoire jamais vu s'arrêtait sur l'écran de confiance de Claude Code — détectée, dans le bon répertoire, portant son nom, et bloquée devant une question que personne ne lit — puis, une fois ce dossier approuvé, sur l'écran suivant : les serveurs MCP que son propre `.mcp.json` déclare. Les deux lots précédents ne les avaient pas vus parce que leur preuve s'arrêtait au répertoire de travail ; celle-ci va jusqu'à « la session fait quelque chose ».

### Technique

- 31 fichiers, deux passes de revue indépendante. La première (Haiku) a trouvé trois trous dans les tests d'approbation, dont un verdict qui dépendait du répertoire d'appel. La seconde (Sonnet) a trouvé un cloisonnement client trouable — `ouvrir --nature client D-1` laissait un orchestrateur ouvrir un canal de client, l'interdiction étant écrite en position plutôt que sur le fait. `scripts/tests/test-naissance-orchestrateur-reel.sh` : 20/20. `test-garde-apres-disparition-du-plan.sh` : 8/8. Chaîne : 6/6.

## [1.36.0] - 2026-08-13

### Ajouté

- **Le métier de l'orchestrateur devient un gabarit, avec ses six ajouts** (E-20260813-0001, PR #201). Comme le gestionnaire client avant lui, l'orchestrateur cesse d'être une session qu'on transforme une fois : son métier vit désormais dans un `CLAUDE.md` (`.claude/templates/orchestrateur/CLAUDE.md`) relu à **chaque** échange plutôt que dans une compétence lue une seule fois au démarrage, accompagné d'un `CONTEXTE.md` propre au dépôt qui ne voyage jamais. Le gabarit porte la compétence existante intégralement — le texte voyage octet pour octet, garde vérifiée par comparaison section par section — plus six ajouts fermés par le dirigeant (2026-08-12) : il appelle les agents spécialisés (consulter, jamais sous-traiter), il parle au dirigeant et cette parole ne se partage pas, sa **ligne directe devient obligatoire** (la phrase qui la rendait facultative a été retirée), il veille sur ses agents chaque heure par défaut, il pose un topo sur son canal chaque matin à 7 h, et il est gardien des ADR et des bonnes pratiques — par le brief, la revue et le signalement, jamais en relisant le code.

### Technique

- 34 mutations, 56 tests. Deux passes de revue indépendante ont chacune trouvé un trou de garde réel plutôt qu'un faux positif : la première a montré que le préambule du métier — où vivent les deux principes fondateurs et le « tu ne codes pas » — échappait entièrement à la comparaison octet-pour-octet, `sections()` ne rendant que ce qui suit un titre ; la seconde a montré que `CONTEXTE.md` n'était gardé que sur l'existence de ses titres (un corps vidé restait vert), que l'obligation de la ligne directe n'était vérifiée qu'à un seul des deux endroits qui l'affirment, et que les sections exemptées de la comparaison octet-pour-octet l'étaient en entier plutôt que sur le seul amendement ciblé. Les mutations des deux revues sont conservées, préfixées `revue-P1-`/`revue-P2-`, pour que les défauts qu'elles ont révélés ne puissent pas revenir.

## [1.35.0] - 2026-08-12

### Corrigé

- **Le trousseau ne cherche plus le jeton sous un compte tiré d'une variable d'environnement** (T-20260811-0087, PR #199). `ligne-directe` faisait sortir le compte de recherche macOS de `process.env.USER`. Une session qui ne porte ni `USER` ni `LOGNAME` — ce qui s'est produit — cherchait donc sous le compte `''` ; `security` ne trouvait rien, et ce rien était traduit en « le jeton n'est pas au trousseau », alors qu'il y était. Le refus donnait en plus une commande qui **écrase** l'entrée existante (`security add-generic-password -U`) — et cette commande lisait, elle aussi, `$USER`. Suivie dans la session même où le défaut se produit, elle aurait déposé le jeton sous un compte vide après avoir détruit celui qui marchait. Le compte vient désormais du système (`os.userInfo().username`), sans aucun repli sur une variable, et le refus dit ce qu'il a cherché (compte et service) plutôt que d'affirmer une absence qu'il n'a pas mesurée.
- **Plus aucun message de refus ne propose un geste destructeur.** Quatre lecteurs de `USER` étaient en cause — la lecture elle-même, son repli `LOGNAME`, et deux commandes suggérées à l'humain — et quatre messages envoyaient détruire : le dépôt du jeton perd son `-U`, le refus « jeton vide » ne propose plus de commande, le `pkill -f demarrer-veilleur.js` du veilleur est remplacé par un geste qui ne nomme que le processus en cause, et le `rm -rf` d'un lieu à demi posé devient un déplacement réversible.

### Technique

- Le test décisif rejoue le vécu dans un processus enfant à l'environnement amputé, cloison levée, et vérifie que le jeton est **trouvé** — pas que le refus est joli. Rouge constaté avant correctif : recherche sous le compte vide au lieu du compte réel. Deux tests existants qui ancraient le `pkill` sur son nom exact vérifient désormais que le geste vise la place occupée sans rien détruire au-delà — l'un d'eux a attrapé un vrai défaut du correctif, un refus qui nommait le mauvais socket. Suite `ligne-directe` : 251/251.

## [1.34.0] - 2026-08-10

### Corrigé

- **Le garde d'ouverture d'un représentant client ne porte plus de chemin de machine** (T-20260809-0032, PR #195). Le garde était inscrit dans `.gestionnaire/<client>/.claude/settings.json` — un fichier versionné — en chemin absolu, calculé depuis la position du dépôt au moment de la pose. Posé depuis un plan de travail horodaté, ce chemin meurt au nettoyage du plan, et le garde cessait de mordre en silence : rien ne signalait la panne, tests verts compris. L'ancrage passe désormais par le poste (`~/.somtech`), jamais par le dépôt qui a servi à poser — le même choix que porte déjà `ligne-directe`. Un garde absent du poste refuse maintenant l'ouverture au lieu de se taire, et reposer un garde par-dessus un ancien le remplace au lieu de le laisser traîner à côté.

### Technique

- Preuve par un script qui parle au vrai `herdr` et au vrai `claude` (`scripts/tests/test-garde-apres-disparition-du-plan.sh`) : le plan de travail qui pose le garde est effacé, le fichier posé voyage vers un autre dépôt, puis une vraie session ouvre le lieu — le bras négatif (garde d'origine) laisse passer une commande interdite sans le dire, le bras positif bloque et le dit. 108/108 en unitaire.

## [1.33.0] - 2026-08-09

### Corrigé

- **La session d'un représentant naît désormais dans son lieu, et un échec s'y voit** (T-20260809-0023, PR #193). Au premier usage réel, la naissance échouait sur trois points : le pane ne naissait pas dans le lieu du représentant (une ligne écrite trop tôt dans un pane qui vient d'apparaître se perd en entier, `cd` compris — la session démarrait donc là où herdr avait ouvert le pane, sans charger ni le métier ni le registre du lieu) ; l'agent était nommé avant d'exister (`agent_not_found`) ; et un appel en échec pouvait rendre un code de sortie 0. Le pane naît maintenant dans le lieu par construction (`--cwd`), la naissance attend qu'un agent soit détecté avant de le nommer, et toute réponse porteuse d'une erreur est traitée comme un échec — sortie en 0 comprise — avec fermeture du pane orphelin.
- **Un brief n'est déclaré livré que lorsque la session l'a pris, jamais seulement parce que l'outil a répondu succès** (T-20260809-0033, PR #194). Un brief resté dans la boîte de saisie d'un agent, non soumis, pouvait se retrouver collé au brief suivant sans que rien ne le signale — la session travaillait alors sur un texte fusionné, plausible et faux. La livraison regarde désormais la boîte avant d'écrire (non vide ou illisible = refus, jamais fusion), vérifie par le fait que la session a quitté l'attente, et échoue bruyamment si le brief n'a jamais été pris.

### Technique

- Les deux correctifs sont chacun prouvés par un script qui parle au vrai `herdr` et au vrai `claude` (`scripts/tests/test-naissance-representant-reel.sh`, `scripts/tests/test-livraison-brief-reel.sh`), doublé de suites unitaires qui ont grandi au fil des revues (naissance : 71 → 74 tests ; livraison : 52 → 103 tests unitaires, 28 scripts shell).

## [1.32.0] - 2026-08-09

### Corrigé

- **Un plan de travail neuf naît désormais avec le registre joignable, quel que soit le chemin de naissance** (E-20260807-0009, PR #189). Cinq chemins de naissance étaient possibles ; un seul fournissait les jetons — et ce n'était pas celui qu'emprunte un orchestrateur pour ouvrir un chef d'équipe. Un agent né par les quatre autres chemins ne pouvait ni lire son mandat, ni poser ses statuts, ni inscrire ses stories, et restait entièrement dépendant de son coordonnateur — le goulot que le registre existe pour supprimer. Mesuré le 2026-08-07 : trois agents relayés par fichier, quatorze stories inscrites par quelqu'un d'autre que leur auteur, un agent en attente près d'une heure. 160 plans de travail sur 26 dépôts étaient dans ce cas.
- **La cause n'était pas celle portée par la demande.** Elle attribuait la panne à l'approbation par chemin dans `~/.claude.json`. Mesuré en conditions réelles — deux bras sur le **même** chemin, resté absent du fichier d'approbation dans les deux cas — la session échoue sans le jeton dans l'environnement du processus qui la lance, et réussit avec. Le verrou, c'est le jeton absent, pas l'approbation.
- **Un agent qui naît malgré tout sans registre le dit à sa naissance**, nomme les serveurs muets et le geste qui répare — au lieu de le découvrir en pleine tâche.
- **Les jetons ne vivent plus en clair dans le fichier de configuration du poste.** Un script de migration les en sort et les remplace par une référence résolue depuis un lieu unique au poste, chargé par tout shell — les cinq portes de naissance sont couvertes, pas une.

### Technique

- Preuve à deux bras sur un plan de travail et une session réels (le registre doit **répondre**, pas seulement être exposé), et une campagne de mutation dédiée au compte des cinq portes — si une porte s'ajoute sans être couverte, le compte déclaré devient faux et le test rougit. Aucun jeton n'apparaît dans un test, un message ou une trace.

## [1.31.0] - 2026-08-07

### Modifié

- **L'orchestrateur ne déploie que des chefs d'équipe** (D-20260807-0005, E-20260807-0006). La version précédente justifiait ce niveau par un **seuil** — « 2+ périmètres parallèles, ou 5+ agents à coordonner ». Ce seuil **n'avait été mesuré par rien** : il a été inventé en rédigeant. Il est retiré, et remplacé par une définition fonctionnelle : **tout agent herdr qu'un orchestrateur ouvre est un chef d'équipe**, du seul fait qu'il lancera des sous-agents — ne serait-ce que pour se faire reviewer. Il n'y avait donc aucun niveau à ajouter, seulement un rôle à nommer correctement.

  Ce que le seuil coûtait, mesuré le jour même de sa livraison : l'orchestrateur qui l'appliquait a lancé deux sous-agents lui-même, faute de l'atteindre — donc fait du travail de chef d'équipe sans le nommer, ce que le principe « un agent qui orchestre n'exécute jamais » existe précisément pour empêcher. Le critère de taille (un agent coûte 15-20 min à démarrer) reste, mais il décide désormais **combien** d'agents ouvrir, jamais **si** le niveau existe.

### Ajouté

- **Le modèle d'un agent se déclare toujours, explicitement, au lancement.** `claude` lancé sans argument démarre en **Haiku** et **n'hérite pas** du modèle de la session appelante — un orchestrateur en Opus qui ouvre un agent sans rien préciser fait naître un Haiku sans le savoir, et ne s'en aperçoit qu'à la troisième permission restée sans réponse. Un **agent herdr naît en Opus, jamais en Haiku** (Haiku n'a pas de mode auto : il s'arrête à chaque demande de permission) ; un **sous-agent peut être en Haiku**, et c'est là qu'il est utile — en passe 1 de revue. Le lanceur de session ne relayant pas `--model`, la compétence décompose désormais le geste de naissance : worktree d'abord, puis `claude --model opus` dedans.
- **La chaîne registre → mandat → agent.** Un agent porte le **code de son mandat** au registre (`e-…`, `d-…`, `t-…`), jamais un nom inventé, et surtout **jamais le sujet du chantier** — qui le rendrait indistinguable de son orchestrateur, lequel porte déjà ce code. Le **libellé de l'onglet**, lui, ne sert pas à adresser mais à reconnaître : il porte le code, puis **deux à quatre mots sur ce que l'agent fabrique**.
- **Quatre gestes qui n'appartiennent pas à l'orchestrateur** : renommer un agent, débloquer une permission, corriger un script, relancer un processus. Chacun paraît minuscule, chacun se justifie par « c'est plus rapide si je le fais », et chacun signale que le fil est déjà perdu. Ils appartiennent au chef d'équipe, et quand ils tombent chez l'orchestrateur c'est la **naissance de l'agent** qu'il faut corriger, pas l'instance.
- **La veille de déblocage entre au pack** (E-20260807-0007) : `scripts/orchestration/veille-deblocage.sh <pane> <agent>`, posée à la naissance d'un agent pour que personne n'ait à débloquer ses permissions à la main. Trois garanties, éprouvées par 24 assertions exécutées en CI contre un faux `herdr` : elle ne répond **que** devant une vraie demande reconnue par **deux** signes concordants ; devant un écran qu'elle ne reconnaît pas **elle ne répond pas**, elle s'arrête et le dit ; et **la position d'une option ne dit jamais son sens** — certaines demandes n'ont que deux options et la deuxième y est « No », d'autres proposent « oui, et dis-moi quoi faire ensuite », qui laisserait l'agent attendre une instruction qui ne viendra jamais.

### Technique

- **La compétence d'orchestration a enfin ses preuves** (E-20260807-0008), la dette assumée à la livraison de 1.30.0. Deux familles :

  **La distribution, prouvée en construisant.** `BRIEF-REVUE.md`, la compétence elle-même et la veille sont vérifiés **dans le paquet réellement construit**, à l'octet près, jamais déduits du fait que `.claude/` figure dans un module (RA-DIS-002). La veille est en outre vérifiée exécutable dans le paquet : une compétence qui prescrit un script non livré prescrit un geste impossible.

  **Un harnais de mutation** : 21 contrôles, 37 mutations. Chaque prescription rougit quand on l'inverse — polarité des trois niveaux, modalité des trois règles du chef d'équipe, compte des quatre gestes et des trois garanties de la veille, interdiction faite à la passe 1 de conclure « mergeable ». Le harnais **échoue aussi si une mutation devient inopérante** : une mutation qui ne change rien au texte se compterait sinon comme attrapée sans avoir rien posé. Et chaque mutation doit être attrapée **par le contrôle qu'elle vise**, pas par un dommage collatéral.

  Ce harnais a trouvé **deux faux témoins dans ses propres contrôles** avant que la suite ne passe : une garde qui cherchait le mot « code » restait verte quand l'interdit de coder disparaissait, parce que « code » survivait dans « ne relit pas le code » ; et une garde qui cherchait « jamais » dans un paragraphe restait verte quand « la position ne dit **jamais** son sens » devenait « indique généralement son sens », parce qu'un « jamais » subsistait trente mots plus loin. Les deux gardes portent désormais sur l'affirmation entière, pas sur un mot qui y figure.

  **La revue indépendante en a trouvé trois de plus**, chacune par une mutation et aucune par la lecture — et deux d'entre elles visaient une prescription qu'aucun contrôle ne gardait :
  - une garde acceptait la règle (« jamais dans un seuil ») **ou** son motif (« n'avait été mesuré par rien ») ; ce « ou » laissait chaque moitié disparaître en silence. Les deux sont désormais exigées séparément ;
  - la garde de modalité repose sur une liste de tournures permissives, donc sur une énumération : « à la veille, **jamais** à ta main » est devenu « à la veille, **autant que possible** » — sens exactement retourné, liste muette. La liste s'est élargie, mais surtout la négation elle-même est désormais résolue, et non plus le vocabulaire qui l'entoure ;
  - **aucun contrôle ne sondait la section qui dit quand n'ouvrir aucun agent** : la puce « tâche < 30 min → n'ouvre pas un agent pour ça » a pu être remplacée par « toute tâche, même de 5 minutes → un chef d'équipe systématiquement » — le contre-exemple exact que ce journal cite — sans qu'un seul test ne rougisse. Cette section et la table des anti-patterns, qui portait elle aussi les quatre décisions sans garde, ont maintenant leurs contrôles.

## [1.30.0] - 2026-08-07

### Ajouté

- **`/orchestrer-chantier` décrit trois niveaux d'orchestration** (PR #185, E-20260807-0006) : l'orchestrateur cadre, découpe et arbitre ; un chef d'équipe distribue le travail et fait le lien quand le chantier dépasse un seul périmètre ; des sous-agents et coéquipiers exécutent. La compétence dit désormais **quand ne pas ouvrir d'agent** (tâche trop courte pour justifier le coût de démarrage), et distingue le sous-agent jetable (`Agent(prompt)`, tâche isolée sans suite) du coéquipier persistant (`Agent(..., name)` puis `SendMessage`, travail qu'on reprend).
- **La revue de code prescrite passe à deux sous-agents** : Haiku en portail de rejet (rejette vite les cas perdus, ou dit « rien vu » — jamais un verdict `mergeable`), puis Sonnet en revue de fond sur ce qui reste.
- **`BRIEF-REVUE.md` entre au pack**, réutilisable par les deux passes de revue. Il porte les trois motifs de défaut mesurés sur des chantiers orchestrés, avec leur coût : une garde qui vérifie le contenu au lieu du fait (10 survies, dont un refus qui a survécu à son contresens exact), un double de test plus permissif que le vrai service (6 survies, une fonction inerte en prod derrière 97 tests verts), et un correctif qui ne couvre qu'une porte sur deux (3 survies, l'autre chemin reste ouvert sans que personne ne le dise).

## [1.29.1] - 2026-08-06

### Technique

- **La publication du pack ne s'exécutait plus** (PR #179, T-20260806-0165). Le travail de publication construit le paquet — qui embarque une copie de `ligne-directe/` — puis lançait `node --test` sans portée depuis `cli/` : la copie était donc exécutée **une seconde fois, sous Node 20**, alors que la ligne directe exige Node 22. Un test s'en apercevait et refusait de passer — à juste titre : il vérifie qu'un veilleur a été arrêté *par le garde-fou*, et il avait été arrêté par l'absence de `WebSocket`. Rien ne sortait donc du registre.

  La portée est désormais bornée. **Aucun test n'est affaibli** : 411 → 202, et l'écart de 209 est exactement la copie de la suite `ligne-directe`, qui continue de tourner dans son propre travail en Node 22. C'est aussi la fin du double comptage signalé sans qu'on en mesure la portée.

### Corrigé

- **La ligne ne se rejoint plus dans un canal qu'elle a déjà rejoint** (PR #176, T-20260806-0096). Sur le chemin de reprise d'un canal existant, le code demandait à Slack de rejoindre sans vérifier s'il était déjà membre — un geste à la fois inutile et impossible, puisqu'un robot ne rejoint pas un canal privé : on l'y invite. Slack refusait, la ligne ne s'inscrivait pas, et **tout ce que l'interlocuteur écrivait était perdu**. Trouvé au premier usage réel du gestionnaire client, une heure après sa livraison.
- **Un refus de Slack faute de droit devient un refus nommé** qui dit le geste humain qui le lève — faire inviter le robot — au lieu d'une panne muette.

**Ce que la revue a mesuré, et qui vaut plus que le correctif** : les dix lignes de discussion vivantes du poste étaient **à une reprise de casser**. Une sonde sur le code d'avant, avec un double fidèle au vrai Slack, échoue en `missing_scope` ; la même sonde sur la branche passe sans émettre aucun appel de jointure. Le correctif ne prévient pas un risque futur, il répare une régression déjà en place.

Aucun droit Slack n'a été demandé : le diagnostic initial — accorder `channels:join` et réinstaller l'application — a été **écarté par la mesure**, ce droit ne couvrant que les canaux publics.

## [1.29.0] - 2026-08-06

### Ajouté

- **Une capture d'écran déposée par un client arrive jusqu'à nous** (PR #173, E-20260806-0010). Le veilleur récupère la pièce en présentant le jeton, la dépose en droits restreints là où l'agent peut la lire, et lui rappelle de la rattacher à la demande — parce qu'une capture restée dans Slack, c'est une équipe qui travaille sans elle. Vérifié contre le **vrai** Slack, pas contre un double : le fichier se rapatrie, l'adresse est bien privée, et sans jeton elle rend une page de connexion sous un code de succès — d'où la détection de cette page, indispensable.

### Corrigé

- **Un message porteur d'une pièce jointe ou vide était jeté en silence total** — ni remis, ni répondu, ni journalisé (T-20260806-0104). Un client déposait sa capture, ne recevait rien, et l'agent ignorait qu'on lui avait parlé : le pire résultat possible pour une fonction dont la promesse est qu'un client ait enfin un endroit où poser sa question. Deux autres chemins muets ont été fermés dans la foulée — un message **édité** (le cas du client qui complète depuis son téléphone) et un canal dont la ligne n'est plus au registre alors que notre robot y est toujours membre.
- Les cas d'échec sont désormais distingués **par la cause émise** et non par le texte rendu : une pièce qu'on n'a pas pu rapatrier ne s'annonce plus comme un type de fichier refusé — un refus définitif qui aurait fait qu'un client ne renvoie jamais sa capture.
- **L'attente au sas se dit** (PR #174, E-20260806-0005). Quand un chantier a fini de travailler mais attend son tour pour la mise en ligne, l'orchestrateur est le seul à le savoir — et rien ne lui demandait de le dire. Son représentant client répondait donc « c'est en cours » alors que ça ne l'était pas, et le client le découvrait en relançant. L'orchestrateur prévient désormais son représentant quand il trouve le sas occupé, **et quand son tour vient** : une attente annoncée sans fin annoncée est pire que rien. Aucun mécanisme de file n'a été construit — le droit d'accès exclusif par application existait déjà ; il ne manquait que la parole.

### Ajouté

- **La compétence `/gestionnaire-client` — une session devient le représentant d'un client** (PR #172, E-20260806-0011). Elle transforme la session courante, sans faire naître aucun agent, et porte quatre choses : la posture de représentant du besoin *à l'intérieur de notre équipe* plutôt que de guichet ; la frontière de l'engagement, avec « est-ce possible ? » explicitement du côté qui remonte au dirigeant ; le cycle complet, du premier message au lancement de l'orchestrateur avec un but qui lui rend compte *à lui* ; et le relèvement, une session neuve reprenant le canal sans que le client s'en aperçoive.
- **Le client ne voit plus nos identifiants internes** : le code du chantier atteignait encore le client par le sujet du canal, le nom d'expéditeur de chaque message et le nom du canal. Le registre de langage soignait ce qu'on dit ; il restait le matricule sur ce qu'on est.

### Corrigé

- **Le canal d'un client ne se referme plus quand notre session disparaît.** Un canal archivé est en lecture seule : le client ne pouvait plus écrire et aucune session neuve ne pouvait reprendre — le relèvement était inatteignable. Le canal appartient au client, pas au chantier, et ne suit donc plus son sort. Les deux chemins qui archivent sont énumérés et gardés : un troisième fait rougir la suite.
- **Le désarchivage d'un canal était du théâtre** : Slack interdit le jeton robot sur cette opération, donc le code tentait ce qu'il ne pouvait pas faire. Le chemin est supprimé et remplacé par un refus qui nomme l'impossibilité et le geste humain qui la lève. Un canal client archivé est perdu pour de bon — c'est maintenant écrit dans le code, dans la compétence, et dans le refus rendu à l'agent.
- **Un conseil qui détruisait** : un refus invitait à archiver un canal public d'équipe, opération sans retour. Il invite désormais à le renommer, qui obtient la même chose et se défait.

### Technique

- Les refus définitifs portent désormais le fait qu'il est inutile de réessayer, au lieu d'être reconnus par une liste de noms d'erreurs qui oublie toujours la prochaine. Les gardes vérifient la cohérence entre ce fait et le texte rendu : un refus qui se déclare définitif et invite à patienter se contredit lui-même — et ça vaut pour les refus à venir.

### Ajouté

- **Le veilleur ne parle plus à un client comme il parle au dirigeant** (PR #171, E-20260806-0009). Ses réponses automatiques suivent désormais la nature de la ligne : sobres et sans jargon face à un client, franches et techniques face au dirigeant — dont les textes n'ont pas changé d'un caractère. Et le cadre qui accompagne un message remis à l'agent **nomme l'auteur réel** : il annonçait « Message du dirigeant » à tout le monde, ce qui aurait présenté la phrase d'un client comme une consigne du dirigeant — un tiers pilotant nos agents sans le savoir. L'agent sait maintenant qu'un client demande, et n'ordonne pas.
- **Une garde interdit à toute écriture vers un canal de contourner le registre de langage.** Elle ne surveillait d'abord que la fonction de réponse : une revue a prouvé qu'un septième chemin postant directement pouvait envoyer une phrase interne — nom de pane et code de chantier compris — dans un canal client sans qu'aucun des 131 tests ne rougisse. Elle porte désormais sur toute écriture, hors des trois sites sanctionnés.

### Ajouté

- **Une ligne de discussion connaît sa nature, et un canal client est privé** (PR #170, E-20260806-0008). Une ligne est désormais *interne* (le dirigeant) ou *cliente* (les gens d'un client), et cette nature commande deux choses : la confidentialité du canal, et qui a le droit d'y écrire. Un canal client est privé — un canal public expose le portefeuille client par son seul nom. Une ligne sans nature déclarée reste interne et publique, exactement comme avant. Un message écarté laisse désormais une trace et celui qui l'a écrit l'apprend : c'était le défaut le plus coûteux, celui qui ne casse rien et fait juste croire que ça marche.

### Corrigé

- **Les appels vers Slack partaient en JSON là où Slack n'accepte que le format formulaire** — 14 méthodes corrigées, 4 avérées cassées. Conséquence mesurée contre le vrai service : la recherche de qui a le droit d'écrire échouait **systématiquement** en production, donc une ligne cliente démarrait avec une liste d'autorisés vide et refusait poliment le premier message de tout le monde. La fonction aurait été livrée inerte. Découvert en sortant du double de test pour parler au vrai service — 97 tests verts, deux revues et quatre travaux d'intégration verts ne l'avaient pas vu.
- **Le double de test était plus permissif que Slack** : il acceptait un corps JSON là où le vrai service le refuse. C'est la racine du défaut ci-dessus — un double plus permissif que le service qu'il imite transforme chaque test en faux témoin. Il refuse désormais ce que Slack refuse ; avec l'ancien encodage, 8 des 9 nouveaux tests rougissent.
- **Un essai pouvait faire naître un veilleur branché sur l'espace Slack réel.** Arrivé pour de vrai : deux veilleurs orphelins nés d'une campagne de mutation ont tenu une connexion de production pendant trois heures, et comme Slack répartit ses événements entre les connexions actives, **deux messages du dirigeant sur trois ont été jetés en silence** — il a cru sa ligne morte. Quatre barrières posées (trousseau, transport, connexion d'écoute, installation du service du poste), chacune prouvée nécessaire par mutation.

### Technique

- La pagination des appels de lecture Slack (`users.list`, `conversations.list`) est enfin honorée : `limit` et `cursor` étaient jetés.

### Technique

- **Les 76 tests de la ligne directe tournent enfin dans la chaîne d'intégration** (PR #169, T-20260806-0014). Ils existaient depuis la livraison de la ligne directe et n'étaient exécutés par aucun travail de la chaîne : `shell-tests`, `cli-tests` et `python-tests` ne pointaient nulle part vers `ligne-directe/`. Six exigences en vigueur du BRD se retrouvaient donc sans preuve citable — la preuve existait, elle n'était simplement pas vivante (RA-DIS-004). Le nouveau travail tourne en **Node 22**, et non dans `cli-tests` qui tourne en Node 20 : le veilleur tient sa connexion avec le `WebSocket` natif, absent avant Node 22. Vérifié par mutation — un défaut volontaire fait rougir ce travail et lui seul, son retrait le fait reverdir.

## [1.28.7] - 2026-08-05

### Corrigé
- **Les messages d'erreur de la ligne directe sortaient noyés sous une trace de pile Node.** Le texte était juste — il disait quoi faire, avec la commande exacte — mais personne ne lit la troisième ligne d'une trace : le message était donc invisible. La commande affiche désormais l'explication seule et sort en échec. Premier fichier de tests sur `bin/`, qui n'en avait aucun : c'est une des zones sans couverture que la revue indépendante avait pointées.

## [1.28.6] - 2026-08-05

### Corrigé
- **Un `process.exit` enfoui dans le veilleur tuait le lanceur de tests.** Le geste de cession mettait fin au processus lui-même : dans la suite de tests, il coupait le runner en plein vol. Seize tests étaient rapportés, le dix-septième n'était jamais exécuté, et le code de sortie restait à zéro — donc tout paraissait vert. Une bibliothèque ne met pas fin au processus de son appelant : c'est désormais le point d'entrée qui décide comment mourir.
- **`ligne-directe relever` se déclarait réussi même quand la relève n'avait pas eu lieu.** Un veilleur d'une version antérieure ne connaît pas le geste de cession : il refuse et garde la place, le neuf se retire — et la commande rendait « ok » quand même. Un faux succès sur le geste précisément écrit pour réparer les faux succès. Elle vérifie désormais que la place se libère vraiment, et échoue en disant quoi faire quand ce n'est pas le cas.

## [1.28.5] - 2026-08-05

### Corrigé
- **Aucune mise à jour de la ligne directe ne prenait effet tant que le veilleur ne mourait pas de lui-même.** Le verrou d'unicité — qui protège des messages remis en double — interdisait du même coup toute relève : le veilleur neuf trouvait la place occupée, se retirait poliment, et la version fraîchement publiée restait sans effet. Tout avait l'air installé, rien ne l'était, et rien ne le signalait ; il fallait chercher un identifiant de processus et le tuer à la main. Un geste manquait, il existe : **`ligne-directe relever`** fait céder le veilleur en place, attend que le socket se libère, et rappelle un neuf. À lancer après chaque mise à jour du pack.

## [1.28.4] - 2026-08-05

### Ajouté
- **`ligne-directe renommer --titre "…"`** — renomme le canal d'une ligne ouverte, dans Slack **et** au registre, en un seul geste. Les canaux ouverts avant le changement de nommage portaient encore le code du chantier ; les renommer à la main dans Slack aurait marché en apparence — l'identifiant du canal ne change pas, donc les messages continuent d'arriver — mais le registre serait resté sur l'ancien nom et l'état affiché aurait cessé de correspondre à ce qu'on voit dans son espace.

## [1.28.3] - 2026-08-05

### Modifié
- **Le canal d'une ligne directe porte désormais le titre du chantier, plus son code.** `#d-20260805-0004` ne disait rien à personne ; `#refonte-du-tableau-de-bord` se lit. Le code ne disparaît pas — il part dans le sujet du canal, où il reste visible d'un coup d'œil. Les préfixes de catégorie (`[FEAT]`, `[FIX]`…) sont retirés du nom : utiles dans un registre de tickets, muets sur un canal. Sans titre fourni, le canal porte le code comme avant : un nom moche vaut mieux qu'une ligne qui refuse de s'ouvrir.

## [1.28.2] - 2026-08-05

### Corrigé
- **Sur un Node antérieur à la version 22, un veilleur qui trouvait la place déjà occupée se plaignait de sa version au lieu de se retirer.** La vérification de version passait avant le verrou d'unicité : le gestionnaire de services voyait une erreur là où il n'y avait rien d'anormal, et relançait en boucle. Le verrou prime désormais sur toute autre plainte.

## [1.28.1] - 2026-08-05

### Corrigé
- **La ligne directe ne démarrait pas sur un Node antérieur à la version 22**, et le disait par une erreur qui ne parlait de rien. Le veilleur lisait des constantes du `WebSocket` global, absent avant Node 22 : la lecture seule suffisait à le faire tomber. Il vérifie désormais la version au démarrage et le dit en une phrase.
- **Sans session herdr trouvée sur le disque, le veilleur cessait d'interroger herdr** — et concluait donc que tous les agents étaient morts, refermant toutes les lignes. La découverte suppose une arborescence qui peut ne pas exister ; on interroge maintenant herdr quand même, en le laissant chercher lui-même.

## [1.28.0] - 2026-08-05

### Ajouté
- **Un agent peut désormais joindre le dirigeant hors de son écran, et recevoir sa réponse.** Un chantier qui dure plusieurs jours et qui bloque sur un arbitrage restait bloqué jusqu'à ce que quelqu'un passe devant le bon pane. La compétence `/ligne-directe` ouvre un canal Slack par chantier : l'agent y pousse ce qui appelle une décision et ses jalons, le dirigeant répond depuis son téléphone, et sa réponse atterrit dans le pane de l'agent comme s'il l'avait tapée. Quatre gestes — ouvrir, dire, demander, fermer — et le chantier est déduit du pane, donc rien à retenir. `/orchestrer-chantier` ouvre sa ligne en naissant et la referme en clôturant : c'est le premier usage, pas le propriétaire du mécanisme. (D-20260805-0004)
- **Le veilleur est un outil de poste, installé une fois par machine** (`npx pack setup`), avec son service pour revenir après un redémarrage (`ligne-directe service installer`). Une seule application Slack déclarée, mais chaque agent poste sous le nom et l'avatar de son chantier : trois chantiers actifs, trois interlocuteurs distincts à l'œil. **Aucune dépendance d'exécution** — rien à construire, donc rien que le chemin de publication puisse perdre en silence. Les jetons vivent au trousseau du poste, jamais dans un dépôt ; le point d'entrée est un socket local en 0600, sans aucun port réseau.

### Corrigé
- **Le drapeau qui désactive les outils de poste ne les emportait pas un par un.** `--no-canvas` gouvernait toute la famille : le jour où un second outil est arrivé, le taper l'aurait fait disparaître aussi, sans que rien ne le dise. Chaque outil a désormais son drapeau (`--no-canvas`, `--no-ligne-directe`).
- **Le lint anti-secrets se déclenchait sur la prose qui le décrit** — un document expliquant ce que le lint recherche le faisait échouer — et scannait `cli/payload/`, un artefact de build non versionné, ce qui faisait échouer un développeur sur une copie périmée d'un fichier déjà corrigé.

## [1.27.0] - 2026-08-04

### Corrigé
- **Le récolteur d'architecture lisait mal les sources — les manifestes qui en sortaient faisaient mentir le modèle.** Quatorze défauts mesurés puis corrigés, sur quatre dépôts clients réels. Trois d'entre eux **inventaient** des éléments : le dossier `app/` d'un monorepo pris pour le routeur d'une application web (des adresses d'API qui n'existent nulle part), un dossier de composants pris pour un routeur (quinze écrans imaginaires), et les fichiers de test lus comme des routes. Les onze autres faisaient l'inverse : ils omettaient du réel. Un schéma de production entier restait invisible parce qu'il ne vivait pas dans le dossier attendu et qu'il était écrit dans une forme que l'outil ne savait pas lire ; les tables supprimées ou renommées continuaient d'être déclarées ; l'isolement d'un schéma dédié — une posture de protection des renseignements personnels — était effacé, deux tables homonymes de schémas différents se retrouvant confondues. (D-20260804-0006)
- **La documentation d'un projet ne le pénalise plus.** Chaque marque de discipline cassait l'outil : commenter ses tables, isoler ses données sensibles, écrire des migrations prudentes, tester ses routes, versionner une base de référence, ranger son dépôt en monorepo. Plus un projet était rigoureux, plus son modèle d'architecture devenait faux. C'est l'effet pervers que STD-031 §2.7.9 nomme explicitement ; il a maintenant un test par motif.
- **Les descriptions ne sont plus vides.** Elles étaient absentes partout — un champ vide que la relecture humaine remplissait à la main, et que la régénération suivante effaçait. Elles viennent désormais de ce que les sources portent déjà : les commentaires des tables dans les migrations (199 tables sur 303 du corpus en ont, avec de fortes disparités d'un projet à l'autre), et l'en-tête des fichiers pour les points d'API et les écrans.
- **Le manifeste fusionné pouvait être illisible.** Une description contenant un deux-points suffisait à produire un document invalide, et l'écran d'une adresse revendiquait le même identifiant que la table du même nom — un élément disparaissait alors sans bruit à la fusion.

### Ajouté
- **Un récolteur d'écrans, livré mais NON branché** — décision assumée. C'est la seule famille du modèle que personne ne récoltait, et elle continue de s'écrire à la main : l'outil a annoncé de fausses adresses à deux relectures indépendantes d'affilée, il ne peut donc pas servir de référence à un contrôle automatique. Il reste dans le paquet, utilisable à la main pour comparer, et sera branché le jour où une relecture ne trouvera plus rien. Documenter à partir d'un outil qui se trompe coûte plus cher que ne pas documenter.
- **Les fonctions Supabase deviennent visibles.** Elles sont la surface d'API principale des applications Somtech — cent deux dans le corpus — et aucune n'apparaissait : la documentation affirmait qu'une application n'avait pas d'API là où elle en avait des dizaines.
- **Une validation sur dépôts réels, rejouable** (`scripts/tests/test-archi-ci-corpus.sh`). STD-031 §2.7.9 exige qu'un récolteur se prouve sur du vrai code avant d'être opposable : des fixtures écrites pour l'occasion n'y suffisent pas. La suite se saute proprement là où les dépôts sont absents — cette preuve-là ne se simule pas. Rapport détaillé : `docs/modele-vivant/validation-corpus-recolteurs.md`.

### Trouvé en revue de code, corrigé avant livraison
- **Le récolteur d'écrans, neuf dans cette version, inventait des adresses.** Quand une application découpe son interface en modules, chaque module déclare ses écrans avec des chemins **relatifs** à l'endroit où il est branché. Lus isolément, ces chemins devenaient des adresses absolues : sur un dépôt client, 76 des 98 écrans annoncés menaient à une page introuvable — et il s'en ajoutait une à chaque nouveau module. Le récolteur suit désormais le branchement des modules. Il ne balaie plus non plus le dépôt entier : les maquettes, les instantanés de documentation et les copies du dépôt dans lui-même ne sont pas des écrans déployés.
- **Une barre oblique inverse isolée dans un texte SQL rouvrait la brèche de la version précédente** — le lecteur croyait le texte encore ouvert, avalait la fin de l'instruction et rattachait une contrainte à la mauvaise table. Défaut latent, jamais rencontré sur les dépôts actuels, mais c'est exactement la classe de défaut que cette version prétend clore.
- **Un filtre de découverte écartait une vraie migration** parce que son intitulé contenait le mot « test ». Ce qui vit dans un dossier de migrations est appliqué : c'est le schéma, quel que soit son nom.
- **Trois contrôles passaient pour de mauvaises raisons** : ils vérifiaient qu'une chose n'apparaissait pas, dans un fichier que l'outil n'avait pas produit. Un contrôle qui ne peut pas échouer ne contrôle rien.

### Trouvé en contre-revue du correctif, corrigé
La correction ci-dessus a été relue à son tour. Elle avait créé trois défauts et en laissait deux : une page « adresse introuvable » annoncée comme servant la racine du site · des modules métier effacés du modèle parce qu'ils s'appellent « archives » ou « docs » · les applications rangées ailleurs qu'à la racine du dépôt (`frontend/`, `apps/web/`) ne rendant plus aucun écran, en silence · un sous-routeur inséré autrement qu'en composant, toujours non rattaché · deux écrans identiques pouvant encore revendiquer le même identifiant. Tous corrigés, chacun avec son test.

### Inchangé, délibérément
- **Les écrans restent écrits à la main.** Rien ne change pour les projets : ce qui était déjà déclaré le reste, et aucun contrôle ne vient le confronter au code.
- **Le contrôle de cohérence reste en mode signalement.** Il rapporte l'écart sans bloquer. Un contrôle n'exige jamais qu'on écrive un fait faux (STD-031 §2.7.9, I18) ; durcir un dépôt reste une décision qui se prend dépôt par dépôt, une fois son manifeste à jour.

### Technique
- Le découpage du SQL passe par un balayage conscient des textes littéraux, des identifiants entre guillemets et des corps `$$` — ce que la note de la version 1.26.1 annonçait comme le seul moyen de sortir de cette classe de défauts. Les motifs sont ancrés en début d'instruction : une expression ne peut plus déborder sur la suivante, et la précision ne dépend plus de la taille du dépôt.
- Reconnaître un framework exige désormais une preuve (configuration ou dépendance déclarée), jamais un nom de dossier. Les conventions de Next.js ne s'appliquent plus à une application Vite.
- La copie canonique de `harvest-supabase.py` vit dans le dépôt `architecture` : elle doit être resynchronisée depuis ce pack (règle d'or n°7 — aucune écriture hors du dépôt courant).

## [1.26.1] - 2026-08-03

### Corrigé
- **Le récolteur d'architecture n'invente plus de relations entre tables** — une modification de table s'appariait à la première clé étrangère rencontrée **plus loin dans le fichier**, parfois des centaines de lignes après, et fabriquait un lien qui n'existe pas. L'outil punissait la rigueur : plus un projet protégeait ses tables, plus il en inventait. Conséquence la plus fâcheuse, le contrôle de cohérence en mode strict finissait par exiger qu'on documente une contrainte inexistante — un garde-fou conçu pour empêcher la documentation de mentir se mettait à l'exiger. Signalé et mesuré par le chantier SI Bélanger (D-20260731-0001). (PR #157)

### Technique
- Le correctif borne l'appariement à l'instruction courante ; il ne regarde pas ce que fait la modification de table, il l'empêche de déborder. La fausse piste — croire que l'activation de la sécurité par ligne est en cause — est écartée par la mesure et documentée : n'importe quelle modification de table suffit, et un filtre visant la seule sécurité par ligne aurait laissé passer le reste en donnant l'impression d'avoir fini.
- Les limites que ce bornage ne couvre pas (point-virgule ou double tiret à l'intérieur d'un texte littéral, fichier sans point-virgule final, nom de contrainte contenant le mot-clé) sont désormais écrites dans le fichier, reproduites une à une par une revue indépendante. La sortie complète de cette classe de défauts demande un découpage en instructions conscient des textes littéraux — chantier distinct.

## [1.26.0] - 2026-07-28

### Ajouté
- **Orchestrer une Livraison, et plus seulement une Demande ou un Projet** — la compétence `/orchestrer-chantier` couvre désormais les trois formes de chantier du ServiceDesk. Un jalon ne se découpe pas : son périmètre est donné, on l'inventorie et on l'ordonne. Rien n'y avance par déclencheur, la validation y est une étape à traverser explicitement, et sa durée réelle est la somme des passages par le sas de préproduction — pas celle du plus long. (T-20260728-0073)
- **La filiation des agents se consigne à l'ouverture** — un coordonnateur note quel agent il vient d'ouvrir et sur quoi. C'est la seule information qui disparaît définitivement à la fermeture du pane : le code reste, le lien entre l'agent et ce qu'il a livré, non. (T-20260728-0047)

### Corrigé
- **Deux consignes désignaient des actions inexistantes** — trouvées par revue indépendante : un commentaire sur un epic (aucune surface de commentaire n'existe sur cette entité) et un filtre de tickets par livraison, accepté puis silencieusement ignoré, qui rendait la base entière au lieu du périmètre d'un jalon. Les deux chemins réels sont maintenant écrits, avec le piège nommé. (T-20260728-0047, T-20260728-0073)

## [1.25.0] - 2026-07-27

### Ajouté
- **Orchestrer un chantier par agents dédiés** — nouvelle compétence `/orchestrer-chantier` : piloter une Demande ou un Projet de bout en bout en confiant chaque epic à un agent qui naît, travaille et meurt dans son propre espace de travail. Elle encode un modèle éprouvé plutôt qu'une intention : un pilote qui n'exécute jamais, un agent à la fois, un dimensionnement borné par ce qu'un agent peut mener sans compacter son contexte, une condition de fin obligatoire, un review indépendant qui mute le code, et une fermeture qui retire la session **et** son espace de travail. (T-20260727-0071)
- **Garde-fou contre les commandes d'outillage inexistantes** — la suite de tests refuse désormais toute commande `herdr` que le binaire ne connaît pas, groupe comme sous-commande, dans tout le contenu livré par le pack. Motif : une compétence documentait une commande d'attente qui n'existe pas, et les agents qui la suivaient échouaient sans que rien ne l'ait signalé. (T-20260727-0072)

### Corrigé
- **La procédure de fermeture d'un agent pouvait fermer son coordonnateur** — trouvé au code review : fermer l'onglet d'un agent emporte tous ceux qui le partagent, et un onglet en héberge souvent plusieurs. On ferme maintenant la seule session visée. (T-20260727-0071)

## [1.24.0] - 2026-07-27

### Ajouté
- **Le canvas s'installe sur le poste** — `pack setup` dépose désormais le serveur du canvas dans `~/.somtech`, aux côtés de `claude-swt`. La commande `/canvas` fonctionne donc dans toute session, y compris hors d'un projet ayant reçu le pack. Nouveau drapeau `--no-canvas`. (T-20260724-0022)
- **Notion de portée d'un module** — un module déclaré `scope: poste` est embarqué dans le paquet publié mais refusé à l'installation projet : un dépôt client n'a pas à porter d'outillage interne. Le canvas est le premier de cette famille. (T-20260724-0019)
- **Les commandes du pack sont installées au poste** — `pack setup` miroite désormais `.claude/commands` vers `~/.claude/commands`, comme il le fait déjà pour les compétences et les workflows. Une commande (`/canvas`, `/brd`, `/pousse`…) est donc disponible dans toute session, et plus seulement dans un projet ayant reçu le pack. Nouveaux drapeaux `--commands-dir` et `--no-commands`. (T-20260724-0021)
- **Canvas Excalidraw distribué avec le pack** — nouveau module `canvas` (opt-in) : le paquet publié embarque le serveur du canvas, sa page déjà construite et ses dépendances d'exécution. Outil de poste, installé une fois par machine, jamais copié dans les projets. (T-20260724-0019)

### Modifié
- **`/pousse` est enfin complet dans le pack** — la version distribuée n'avait ni garde de branche, ni contrôle de fraîcheur, ni déploiement Fly.io, alors qu'une version bien plus riche vivait sur le poste. C'est celle-ci qui fait désormais foi. (T-20260724-0021)

### Corrigé
- **Une installation incomplète se signale** — installer le canvas depuis un dépôt jamais construit déposait le serveur sans sa page ni ses dépendances, et se déclarait réussi ; l'échec n'apparaissait qu'à l'usage, dans un fichier de journal. L'installation dit maintenant ce qui manque et quoi faire. (T-20260724-0022)
- **`/pousse` : une branche sans migration atteint quand même le déploiement Fly.io** — l'étape des migrations se terminait par « fin du processus », court-circuitant le déploiement pour toute branche qui ne touchait pas au SQL.
- **Le paquet publié ne livrait pas ce qu'il promettait** — un fichier d'ignore embarqué dans le payload amputait l'archive au moment du packing : npm en retirait la page construite et les dépendances du serveur. Les fichiers d'ignore ne voyagent plus. (T-20260724-0019)

### Technique
- Le filtre de payload distingue les dépendances d'exécution (voyagent) de celles de construction (restent au dépôt), applique une liste blanche sous la page web et prend en charge les arbres imbriqués.
- La chaîne de publication construit le canvas avant le paquet ; le script de construction passe à `npm ci` (reproductibilité).
- Nouveau test qui interroge la liste réelle du paquet npm plutôt que le dossier de construction.

## [1.23.0] - 2026-07-20

### Ajouté

- **`claude-swt --prompt "<texte>"` : injecter une prompt initiale à l'agent au lancement** (T-20260720-0004) — démarrer (ou reprendre) une session avec une prompt déjà passée à `claude`, sans avoir à la retaper une fois la session ouverte. Le flag est parsé par le cœur partagé `_claude-swt-launch`, donc hérité par `claude-swt` **et** `claude-swt-danger`, et passé à `claude` comme 1er argument positionnel (session interactive amorcée) avec un quoting sûr (espaces, accents, apostrophes, retours de ligne), compatible zsh **et** bash. `--prompt` sans valeur (ou vide) → erreur claire, aucun lancement silencieux ; sans le flag, comportement strictement inchangé. S'applique aussi au chemin de reprise (`claude-swt <timestamp> --prompt "…"`) pour relancer une session avec une nouvelle consigne. Snippet bumpé v1.5.1 → v1.6.0. Test TDD red→green à 7 scénarios (discriminant : 5 KO rejoué contre v1.5.1) + revue de code indépendante (règle d'or n°8) sans défaut bloquant.

## [1.22.2] - 2026-07-19

### Corrigé

- **`claude-swt` : les outils herdr scopés-repo montraient le repo principal au lieu du worktree** (D-20260719-0001, T-20260719-0002) — le lanceur positionnait `claude` dans un sous-shell mais laissait le shell du *pane* dans le repo principal. `herdr pane list` exposait donc `cwd` = repo principal, et un plugin scopé sur ce `cwd` (ex. herdr-file-viewer) résolvait le mauvais repo — jusqu'à afficher des fichiers fantômes du principal alors que le worktree de travail était propre. Le pane est désormais positionné sur le worktree **pendant** la session vivante, puis restauré sur le repo principal au quit (dans tous les cas — la reprise `claude-swt <sess>` reste intacte). Correctif 100 % côté pack, sans dépendre du plugin tiers. Test red/green couvrant la propriété « pane sur le worktree pendant la session » (introspection des ancêtres) + la restauration au quit. Revue de code indépendante (règle d'or n°8) : APPROUVÉ après correction d'une régression de reprise et d'une fuite de stack BD.

## [1.22.1] - 2026-07-17

### Corrigé

- **Divergence de version** (D-20260715-0004) — `pack.json` était resté figé à `1.14.0` alors que `VERSION`, le CLI et le dernier tag publié étaient à `1.22.0`. Côté client, `version.json` affichait donc `version: 1.22.0` mais `packContentVersion: 1.14.0`. `pack.json` est aligné sur `1.22.0`.

### Technique

- **Le tag git devient la source unique de version** : `publish.yml` aligne désormais `VERSION` + `pack.json` sur le tag **avant** de construire le payload (en plus du CLI) — fin de l'alignement manuel à oublier. Nouveau test `cli/test/version-consistency.test.js` qui fait échouer le release si `VERSION`, `pack.json` et `cli/package.json` divergent. Revue de code indépendante (règle d'or n°8) : GO, 6 risques CI couverts (ordre des steps, roundtrip byte-identique de `pack.json`, anti-injection).

## [1.22.0] - 2026-07-16

### Ajouté

- **Partage du dossier de sortie graphify entre worktrees** (D-20260716-0001, handoff Architecture) — un seul graphe graphify par repo (`~/graphify/<repo>-<hash8>`), vu par tous ses worktrees `claude-swt` via un symlink `graphify-out`. Évite ~800k tokens de rebuild par worktree. `pack setup` installe `graphify-share-out.sh` (→ `~/.somtech/`), câble un hook `SessionStart` global (idempotent, fusion sans clobber) et affiche le hint prérequis `uv tool install "graphifyy[mcp]"` si le binaire manque. `claude-swt` pose le symlink à la naissance du worktree, l'exclut localement (`.git/info/exclude`) et déclare le MCP `graphify` en scope **local** (jamais versionné) si un graphe existe. Nouveau flag `--no-graphify`.

### Technique

- Nouvelle fonction `installGraphifyShareHook` + helper `loadSettingsForWiring` (source unique de validation anti-clobber du `settings.json`, partagée avec le hook de version). Script `graphify-share-out.sh` empaqueté verbatim (canonique côté Architecture : anti-collision par hash, auto-init, `.graphify_root` vivant). Revue de code indépendante (règle d'or n°8) : 1 finding **critique** corrigé — des tests `setup` non isolés écrivaient dans le vrai `~/.claude/settings.json` (HOME sandboxé pour toute la suite + `--settings` explicite + test de non-régression ; settings du poste nettoyé) — + 3 mineurs (exclusion locale du symlink, dédup validation, backup conditionnel). 128 tests CLI + 9 assertions bash verts.

## [1.15.0] - 2026-07-15

### Ajouté

- **Skill `/setup-archi-ci` + boîte à outils du modèle vivant** (D-20260715-0004, app Architecture — STD-031 §2.7, règles d'or n°7 et n°9) — installe dans un repo applicatif une CI GitHub Actions qui tient `architecture.yaml` **fidèle au code** : elle récolte le manifeste depuis les sources réelles, le compare au fichier committé (**gate de complétude** `warn` → `strict`, opposable en CI, jamais dans `/merge`), et publie la vue **ERD Mermaid**. La doc d'architecture n'est plus maintenue à la main — elle est récoltée.
- **Récolteurs & outils** (`scripts/archi-ci/`, exposés en sous-commandes `npx @somtech-solutions/pack …`) : `harvest-routes` (endpoints Next.js App Router / Pages API / Express), `harvest-config` (topologie `fly.toml`/`netlify.toml`/`.mcp.json`/env → `depends_on` externes connus), `merge-manifests` (union des grains), `diff-manifest` (gate structurel, comparaison par ensembles d'ids/arêtes), `generate-erd` (grain `table` → `erDiagram`). Copies distribuées de `harvest-supabase.py`/`validate-manifest.py`/schéma (canoniques côté Architecture).

### Technique

- Sous-commandes CLI = wrappers vers scripts Python bundlés (payload `core`), propagation fidèle du code de sortie pour le gate `strict`. Dégradation propre : un grain non récolté n'est jamais traité comme « conforme ». Revue de code indépendante (règle d'or n°8) : 3 findings majeurs corrigés — FK « à qualifier » (`auth.users`, cross-repo) exclues du blocage, hébergement (`flyio`/`netlify`) déduit des seuls fichiers de déploiement, idempotence du skill (ne pas écraser le manifeste ni rétrograder `strict`). 22 assertions bash end-to-end + 122 tests CLI verts.

## [1.14.0] - 2026-07-10

### Ajouté

- **Graphe NetworkX du BRD** (D-20260710-0009, Epic F) — nouveau mode `somtech-pack brd project --mode graph` : à la récupération, le BRD est projeté en **graphe de connaissances** (JSON node-link, natif NetworkX) que les agents Orbit chargent pour **raisonner** (RAG) et **amender** les exigences. Modèle enrichi : nœuds exigences (détail complet + `md_block_id`) + nœuds domaine ; arêtes dirigées `couvre` (EF→EA), `encadre` (RA→EF), `appartient` (→domaine). Références cassées surfacées dans `graph.dangling_refs` (pas de nœud fantôme). Calculé à la demande, jamais stocké — comme index/full.
- **Loader Python `aims/brd-graph/`** — `load_brd_graph` (node-link → `networkx.DiGraph`, compatible NetworkX < 3.4 et ≥ 3.4) + 3 requêtes de commodité (`enjeux_orphelins`, `exigences_du_domaine`, `enjeux_servis_par`). Le format node-link du CLI est le contrat universel ; le loader est le pont NetworkX. Pour amender : `nœud → md_block_id → /brd edit`.

### Technique

- Builder pur `cli/src/brd/graph.js` (une seule source de vérité = parseur TS, pas de parseur Python dupliqué), exporté en lib `@somtech-solutions/pack/brd`. BRD ServiceDesk réel : 105 nœuds (100 exigences + 5 domaines), 199 arêtes. Nouveau job CI `python-tests` (pytest du loader — le reste du CI est Node-only). Revue de code indépendante (règle d'or n°8) : mergeable, zéro bloquant/majeur ; 2 findings mineurs corrigés (contrat EA de `enjeux_servis_par`, dédup des arêtes alignée sur `multigraph:false`), fidélité node-link↔NetworkX vérifiée sur 3.2.1 et 3.6.1. 112 tests CLI + 7 pytest verts.

## [1.13.1] - 2026-07-10

### Corrigé

- **Correction de doc dans le workflow `analyse-decoupage-demande`** (D-20260710-0009) : la note de gouvernance BRD affirmait à tort que « créer/amender une EF se fait depuis le repo Architecture, jamais depuis le repo applicatif ». C'est faux — l'amendement d'un BRD = éditer le `BRD.md` **dans Somcraft** via `/brd edit` ou `/brd new`, dans le contexte de l'app (opération MCP), **pas** depuis le repo Architecture ni par l'architecte. Texte hérité de l'original et conservé par erreur en v1.13.0. Le skill `/brd` était déjà correct.

## [1.13.0] - 2026-07-10

### Ajouté

- **Accès BRD calculé à la demande** (demande D-20260710-0009, app Somtech Pack) — fin du `brd.yaml` stocké qui dérivait (pointeurs cassés constatés). Les projections BRD sont désormais **calculées à la demande** par un parser déterministe (zéro LLM, zéro artefact persisté → zéro drift), porté du parser Python de référence avec parité sémantique. Nouvelle sous-commande CLI `somtech-pack brd project --mode index|full` (index léger avec `md_block_id` par exigence, ou structure complète) et `somtech-pack brd edit --id --patch` (écriture ciblée `update_block` au grain domaine, sans réécrire tout le MD). Lib importable `@somtech-solutions/pack/brd` pour les agents Orbit.

### Modifié

- **Skill `/brd` réécrit** au modèle calculé à la demande : `extract` → `project` (lecture seule, aucune écriture Somcraft ni pointeur `brd_yaml_document_id`), nouvelle action `edit` (flux `read_document` → CLI → relecture anti-conflit → `update_block`). Claude ne parse plus le BRD à la main. Les 4 consommateurs internes du `brd.yaml` (`analyse-decoupage-demande`, `/ontology`, `/agent-brief`, `/audit-preprod`) reconvertis vers la projection à la demande ; comportement de `/plan-servicedesk` & `/superplan` préservé.

### Technique

- Parser `cli/src/brd/` (parser/project/write/index) : parité re-parse contre goldens générés depuis le parser Python, test de mutation (divergence sémantique → rouge), erreurs 1-based, ancrage `md_block_id` via marqueurs `<!-- bid:xxx -->` inline. Écriture prouvée en réel sur Somcraft (isolation + stabilité des blocs). Revue de code indépendante (règle d'or n°8) : 1 bug majeur corrigé (saut de ligne dans `--patch` → corruption silencieuse, désormais fail-closed) + 3 écarts de fidélité au Python (comptage colonnes séparateur, match brut, `splitlines()`). Nouveau job CI `cli-tests` (`node --test`) sur chaque PR — la suite ne tournait qu'au publish. 104 tests verts. Baseline mesurée (BRD ServiceDesk réel, 100 exigences) : index compact 21 Ko vs MD 61 Ko (2,84×).

## [1.12.4] - 2026-07-10

### Corrigé

- **L'entrée CHANGELOG ne crée plus de branche orpheline à re-merger** (PR #122, demande D-20260710-0001, ticket T-20260710-0014). `/end-session` écrivait et committait `CHANGELOG.md` *après* le merge du travail : ce commit tombait sur une branche déjà fermée (feature mergée ou socle `wt/*`), donc non-mergé → il fallait rouvrir une PR pour la seule ligne de CHANGELOG, et le teardown du worktree `claude-swt` restait bloqué. Désormais l'entrée est produite dans le flux de livraison, dans la PR du travail, et arrive sur `main` dans le squash-merge.

### Technique

- Nouveau helper déterministe `.claude/skills/merge/lib/ensure-changelog.sh` (`cec_diff_touches_changelog`, `cec_prepend_entry`) : insertion avant la 1re section `## [`, préambule et sections existantes préservés. Intégré dans `/merge` (étape 5.5, voie feat→main) **et** `/pousse-staging` (étape 2.7, voie sas staging : l'entrée est produite sur la branche feature avant le merge staging, elle voyage feature→staging→main). `/end-session` est purgé de toute écriture/commit CHANGELOG (il ne fait plus que la *suggérer*). Tests rouge→vert (11 assertions helper + garde-fou d'ordre « CHANGELOG avant merge »). Revue de code indépendante (règle d'or n°8) : finding MAJOR sur la voie staging corrigé.

## [1.12.3] - 2026-07-09

### Corrigé

- **`pack setup` (CLI npm) installe désormais `swt-db.sh`** (PR #120, demande D-20260709-0003, incident T-20260709-0074). Le port Node `installRcBlock` (`cli/src/shellrc.js`) ne copiait que `claude-swt.sh`, jamais la lib `swt-db.sh` (logique BD Postgres par worktree) — parité manquante avec la voie bash `scripts/install-claude-swt.sh`. Sur un poste installé via `npx @somtech-solutions/pack setup`, `claude-swt` sourçait la lib en vain (`swt_db_up` jamais défini) et **aucun Postgres n'était provisionné** par worktree.

### Technique

- `installRcBlock` copie la lib voisine du snippet (`<destDir>/swt-db.sh`) si présente, en aval du guard dry-run. Tests de régression rouge→vert dans `cli/test/setup.test.js` au grain unitaire **et** `run setup` (chemin réel de publication via payload bundlé). Suite CLI 53/53 verte. Revue de code par sub-agent fresh (règle d'or n°8) : GO, aucun finding.

## [1.12.2] - 2026-07-09

### Corrigé

- **`/end-session` ne peut plus détruire la branche distante d'un worktree actif** (PR #118, demande D-20260709-0009). Le helper `close-merged-branches.sh` classait comme supprimable toute branche mergée sans consulter `git worktree list` : `git branch -D` échouait en silence (branche verrouillée par un autre worktree) mais `git push origin --delete` partait quand même → la session vivante perdait son upstream et GitHub fermait sa PR. Impact structurel depuis que le multi-worktree est le mode normal (règle d'or n°11).

### Technique

- Nouveau statut **`WORKTREE`** dans `cmb_classify` : toute branche checked-out dans un autre worktree actif est conservée, jamais supprimée localement ni à distance. Filet racine complémentaire : le `push --delete` distant est désormais **conditionné au succès du `branch -D` local**, et le compteur n'incrémente que sur suppression réelle. Tests TDD (rouge→vert) : `test-close-merged-branches.sh` — **27 scénarios** (worktree vivant local + distant préservés, filet isolé, direction inverse, `CMB_NO_REMOTE`). Revue de code par sub-agent fresh (règle d'or n°8) : aucun chemin résiduel de destruction distante.

## [1.12.1] - 2026-07-09

### Ajouté

- **BD Supabase isolée et légère par worktree `claude-swt`** (PR #116, demande D-20260709-0003, epic E-20260709-0009). Quand un worktree `claude-swt` ouvre un repo Supabase, une stack **élaguée** est provisionnée automatiquement, isolée par `project_id` + offset de ports (54321-54499), et arrêtée au teardown (volumes purgés si session terminée, conservés pour reprise). Profils au lancement : `--db` (défaut, **Postgres seul ~65 Mo**, −96 % vs stack complète), `--auth` (+ PostgREST + GoTrue + kong, ~293 Mo), `--full`, `--no-db`. Nouveau `scripts/shell/swt-db.sh` (lib pure + orchestration), sourcé par `claude-swt.sh` (v1.4.0). Décision « profils élagués » validée par un **benchmark chiffré** (étape 0). **Rétro-compat stricte** : un repo sans `supabase/config.toml`, ou une machine sans supabase/docker, garde le comportement inchangé.

### Technique

- Allocation d'offset non-collidante unissant un registre (`~/.claude/swt-db-offsets`) **et** un scan `lsof` des ports réellement écoutés (robuste face aux stacks lancées hors du mécanisme). `config.toml` patché masqué de `git status` via `skip-worktree` (protège l'auto-teardown) ; `patch_config` idempotent (guard skip-worktree + relecture d'offset via `shadow_port`) ; verrou `mkdir` atomique contre les lancements parallèles ; nettoyage des conteneurs sur start avorté. Tests : `test-swt-db.sh` (36 assertions, **bash + zsh**) + `test-swt-db-integration.sh` (smoke réel up/down) ; 5 tests `claude-swt` non régressés. Code review par sub-agent fresh (règle d'or n°8) — 2 bloquants + 3 majeurs corrigés.

## [1.12.0] - 2026-07-08

### Ajouté

- **Interface d'usage de la mémoire — skills `/episodique`, `/rappel`, `/memoire` + socle always-on** (PR #114, demande D-20260708-0007, epic E-20260708-0010 ; cadre STD-039 `accepted`). Déploiement étape 2 de STD-039 : `/episodique` (geste de fonction qui **possède** le moteur de lecture épisodique Graphiti — symétrie I2), `/rappel` **aminci** en orchestrateur de fan-out cross-fonction qui délègue aux gestes (ne possède plus aucun moteur), `/memoire` (hub informatif couche 3 « quelle mémoire pour quoi », n'exécute rien). Nouveau template `.claude/templates/USER_CLAUDE_MD.md` = **noyau always-on** minimal à greffer dans un CLAUDE.md (I1/I3/I4/I5 verbatim + pointeur STD-039). Aucune migration de données.
- **`/rappel` + capacité de lecture Graphiti** (PR #113, demande D-20260708-0002, epic E-20260708-0005 ; BRD Mémoire v1.1.0, EF-EPI-005). Premier chemin de **lecture** de la mémoire épisodique côté agent : client `graphiti_search.py` (stdlib pure) interrogeant `graphiti.somtech.solutions` `/search` **borné par `group_id`**, auth `X-API-Key` **hors bande** (secret d'infra jamais dans le pack, STD-038), frontière D5 (appel direct, jamais via SD-Graph). Le moteur a ensuite été rapatrié sous `/episodique` par le refactor STD-039 (voir ci-dessus).

### Technique

- Moteur `graphiti_search.py` : 11 tests unittest (HTTP mocké), rouge→vert prouvé (scoping `group_id`, secret absent = échec avant réseau, erreurs HTTP/JSON sans fuite de clé, healthcheck authentifié/keyless). Déplacé de `/rappel` vers `/episodique` via `git mv` (rename propre) lors du refactor STD-039. `.gitignore` durci (`graphiti*.env`). Les deux livraisons ont passé un code review par sub-agent fresh (règle d'or n°8).

## [1.11.2] - 2026-07-07

### Ajouté

- **`/pousse-staging` — acquisition atomique du verrou de sas staging en tête du skill** (PR #111, story T-20260706-0007, epic E-20260706-0001). Nouvelle **Étape 1.4** avant tout push : le skill acquiert un verrou atomique hébergé dans ServiceDesk (`applications.lock_acquire`), rendant le sas mono-livraison (règle d'or n°14) **réellement opposable** au lieu de reposer sur la discipline. Détenteur = n° de PR (stable au rebase) ; `acquired:false` → STOP avant tout push avec le détenteur courant ; idempotent pour la même PR (allers-retours QA). **Opt-in par `.somtech/app.yaml`** : un repo non lié saute le verrou (l'Étape 1.5 git-trailer reste le filet) ; **fail-CLOSED** quand l'app est liée mais que l'identité manque ou que le MCP est injoignable. Le gate git-trailer (Étape 1.5) devient un filet best-effort pour les repos non liés.

### Technique

- `.claude/skills/pousse-staging/lib/staging-lock-acquire.sh` (résolution de contexte sourçable : lit `servicedesk.app_id`, résout le détenteur, tranche SKIP/FAIL/READY ; l'appel MCP reste à l'agent) + `tests/test-staging-lock-acquire.sh` — 6 cas prouvés discriminants (opt-in SKIP, fail-CLOSED app_id vide / PR absente, READY avec params, scoping du parsing YAML). RED confirmé contre l'alternative fail-closed-strict rejetée.

## [1.11.1] - 2026-07-06

### Corrigé

- **`/end-session` — le worktree n'était jamais propre ni supprimable** (PR #110). Le skill écrivait `CHANGELOG.md`/`app-state.md` **sans committer** — créant lui-même la saleté qui bloque `git worktree remove` — et ne diagnostiquait ni les fichiers orphelins ni les commits non mergés. Nouvelle étape « Préparer le worktree au teardown propre » : diagnostic des 2 bloqueurs du teardown `claude-swt` (working-tree sale classé `TRACKED`/`ARTIFACT`/`ORPHAN` + commits non mergés sur HEAD & socle `wt/*`), commit des docs de session, gestion des artefacts/orphelins **avec validation** (jamais de suppression en silence), et **verdict honnête** (ready vs conservé — ne jamais annoncer « propre » un worktree portant du travail non mergé).
- **`claude-swt-done` / `claude-swt-gc` — chemin faux depuis un worktree** (PR #110). `repo=$(basename "$PWD")` calculait le timestamp au lieu du nom du repo quand la commande était lancée **depuis** un worktree → chemin inexistant, `git worktree remove` échouait en silence et la fonction annonçait quand même « ✅ nettoyée ». Résolution désormais via `git worktree list` (fonctionne depuis le repo principal ou un autre worktree) ; refus explicite si le worktree est sale plutôt qu'un faux succès.

### Technique

- `.claude/skills/end-session/lib/worktree-teardown-check.sh` (diagnostic sourçable, lecture pure) + `tests/test-worktree-teardown-check.sh` — 6 cas dont le RED d'origine (doc non commité → teardown bloqué, désormais détecté et expliqué).
- `scripts/tests/test-claude-swt-done.sh` — 3 cas prouvés discriminants (résolution de chemin depuis un worktree, session introuvable, worktree sale) ; RED confirmé sur l'ancien code (`basename "$PWD"`).

## [1.11.0] - 2026-07-06

### Ajouté

- **Skill `/audit-preprod` — audit pré-production d'une fonction** (PR #108). Orchestrateur d'audit d'une fonction déjà déployée mais jamais validée formellement. Fan-out sur 4 axes (BRD/traçabilité · code applicatif · DB/sécurité · tests-CI) avec sous-agents frais et adversariaux, qui **sonde l'état réel déployé** (état pris sur `origin/main` + BD **prod ET staging** via MCP) plutôt que l'arbre de travail. Chaque finding porte 3 dimensions (sévérité calibrée · exploitabilité concrète · écart vs baseline du projet), est vérifié de façon adversariale, et distingue « tests existent » de « tests tournent en CI ». Livrable : rapport priorisé go/no-go (P1/P2/P3) + projet ServiceDesk tracé aux EF du BRD. Dérivé du RETEX Somcraft `d897bd45`. Code review indépendant : 12/12 invariants couverts, 4 durcissements appliqués (matérialisation de l'état déployé via `git archive`, sous-agents sans MCP, sondage double `project_ref`, outils MCP nommés).
- **Config MCP du pack versionnée** (PR #107). `.mcp.json` tracké (serveurs centraux `somcraft` + `servicedesk` via placeholders `${...}`) + `.env.example`. `.env` (secrets réels) reste gitignoré.

### Corrigé

- **Désync de version `pack.json`** : le champ `version` de `pack.json` traînait à `1.8.0` alors que `VERSION`/`cli` étaient à `1.10.0`. Réaligné sur la version courante du pack.

## [1.10.0] - 2026-06-30

### Ajouté

- **Skill `/pousse-staging` — gate « slot unique staging »** (PR #105). Fait de la branche `staging` un **sas à une seule livraison** : tant que ce qui est sur staging n'est pas rendu sur `main` (déployé en prod), `/pousse-staging` refuse une AUTRE livraison. Granularité *slot par livraison* — la branche qui occupe déjà staging peut continuer ses itérations QA (cycle corriger→re-pousser→valider préservé). Traduit techniquement la règle d'or n°4 (un ticket à la fois jusqu'en prod, jamais de bundle). L'occupant du sas est identifié par un trailer `Staging-Source: <branche>` posé au squash-merge ; la détection libre/occupé (Étape 1.5 du skill) est robuste au squash-merge et au cas où `main` avance seul au-dessus de staging.

### Technique

- `.claude/skills/pousse-staging/lib/staging-slot-gate.sh` (gate sourçable/testable, codes de retour disjoints du gate migrations) + `tests/test-staging-slot-gate.sh` — 6 scénarios prouvés discriminants : slot libre, itération QA autorisée, 2e livraison bloquée, occupant legacy sans trailer (fail-safe conservateur), robustesse au squash-merge, faux positif hotfix (`main` avance seul). Code review indépendant (sous-agent fresh) : verdict non-bloquant, faux positif majeur corrigé et couvert par le test F.

## [1.9.0] - 2026-06-30

### Ajouté

- **`claude-swt-danger` — variante de `claude-swt` avec `--dangerously-skip-permissions`** (ticket T-20260630-0060). Lance une session worktree isolée identique à `claude-swt`, mais avec `claude --dangerously-skip-permissions` (aucun prompt d'autorisation d'outil), avec un avertissement visible au lancement (environnement de confiance uniquement ; le flag refuse de démarrer en root). Refactor anti-duplication : cœur commun extrait dans `_claude-swt-launch`. Snippet `claude-swt.sh` v1.2.0 → v1.3.0.
- **`/plan-servicedesk` consigne son exercice dans une branche dédiée `plan/D-xxxx`** (demande D-20260630-0002, epic E-20260630-0015). Inversion B↔A (Demande créée d'abord pour obtenir le code `D-xxxx`, puis branche, puis brainstorm), garde-fou git adaptatif (working tree propre → isole ; travail en cours → STOP + 3 options, ne casse jamais un travail en cours), fichier de découpage dédié écrit par le skill, sortie commit + push + PR sans merge auto. `superplan` aligné (argument-hint `debug`).

## [1.8.2] - 2026-06-30

### Modifié

- **Skill `/plan-servicedesk` — auto-invocation activée** (demande Maxime). Retrait de `disable-model-invocation: true` du frontmatter : le modèle peut désormais déclencher le skill automatiquement quand le contexte correspond aux TRIGGERS, en plus de la frappe manuelle `/plan-servicedesk`. Le skill `superplan` (alias tapé manuellement) reste inchangé — pas de double skill auto-invocable pour le même comportement.

## [1.8.1] - 2026-06-30

### Corrigé

- **Skill `/merge` — déploiement du backend AVANT le merge** (ticket T-20260629-0075). Le skill appliquait les migrations BD *après* le merge sur `main`, alors que le merge déclenche le redéploiement du frontend (Netlify auto-publish) : le nouveau frontend tournait donc contre l'ancienne BD pendant la fenêtre de déploiement → erreurs en prod. Réordonnancement : **migrations (Étape 3) → gate de cohérence staging/prod (Étape 4) → Edge Functions (Étape 5) → merge (Étape 6)**. Tout le backend dont dépend le frontend est désormais en prod avant que le frontend ne change. Un refus de déploiement (migration ou Edge Function) suspend la livraison entière (pas de merge). Pré-requis *backward-compatible* (expand/contract) documenté.

### Technique

- Test garde-fou anti-régression `.claude/skills/merge/tests/test-migration-before-merge.sh` — vérifie que les sections migrations, gate et Edge Functions précèdent le merge dans `SKILL.md` (prouvé discriminant : rouge avant / vert après).
- Avertissement ajouté à l'Étape 5 : ne pas déployer en prod une Edge Function jamais validée sur staging (pas de gate automatique côté Edge Functions — dette tracée T-20260629-0076).

## [1.8.0] - 2026-06-29

### Ajouté

- **Skill `/audit-securite` — orchestrateur d'audit de sécurité technique multi-couches** (demande D-20260629-0002). Audite une app cliente Somtech sur 6 couches (code applicatif, RLS, frontend, API, infra, pentest runtime non-destructif) en 4 phases (reconnaissance → fan-out par couche → vérification adversariale anti-faux-positifs → livrable), puis produit un rapport Somcraft consolidé + des tickets ServiceDesk pour les findings confirmés. Réutilise `audit-rls` (skill du pack) ; réplique la logique de `vulnerability-scan` (skill AIMS non distribué aux apps clientes) pour les couches API/infra. Garde-fous durs : pentest **staging-only** avec refus dur de la prod par liste d'exclusion `url_prod`, lecture seule, STD-038 (secrets masqués), aucun ticket sans verdict `confirme`/`incertain`. `.claude/skills/audit-securite/` (SKILL.md + 6 prompts de couche + réfutateur + gabarit livrable).
- **Distribution des workflows Somtech via le pack (`~/.claude/workflows`).** Le premier workflow versionné est `analyse-decoupage-demande` (`.claude/workflows/analyse-decoupage-demande.js`), dépendance du skill `plan-servicedesk`/`superplan`. Avant, le skill voyageait via le pack mais pas le workflow qu'il invoque : sur un poste neuf (ex. Linux), `superplan` cassait à l'étape de découpage. `npx @somtech-solutions/pack setup` **mirrore désormais les workflows du pack** dans `~/.claude/workflows`, au même titre que les skills globaux (module `cli/src/globalworkflows.js`). Mêmes garanties : un workflow perso hors-pack n'est jamais touché, un workflow du pack divergent n'est écrasé qu'avec `--force` (backup `.somtech.bak` auto). Nouveaux flags `setup` : `--workflows-dir <d>`, `--no-workflows`. Le workflow est aussi embarqué dans le payload publié et distribué aux projets via le module `core`.

## [1.7.2] - 2026-06-26

### Corrigé

- **Alias `/superplan` cassé — délégation refaite en pur-`Read`.** L'approche hybride de la v1.7.1 (tenter l'outil `Skill` puis fallback) échouait à l'usage : `plan-servicedesk` portant `disable-model-invocation: true`, l'appel via l'outil `Skill` lève `Skill plan-servicedesk cannot be used with Skill tool due to disable-model-invocation` — erreur bloquante avant le fallback. `superplan` **lit désormais directement** le `SKILL.md` de `plan-servicedesk` (chemin projet puis global) et exécute ses instructions avec `$ARGUMENTS`. `disable-model-invocation: true` conservé sur les deux ; zéro logique dupliquée.

### Ajouté

- **`/plan-servicedesk` : mode `debug`** (PR #93, rattrapage CHANGELOG) — param `debug` → `superpowers:systematic-debugging` pour partir d'un dysfonctionnement (cause racine) au lieu d'une idée. Mutuellement exclusif avec `brainstorming`/`brain`. Combinable avec `D-xxxx`.

## [1.7.1] - 2026-06-25

### Ajouté

- **Alias `/superplan` pour `/plan-servicedesk`.** Skill délégant mince (`.claude/skills/superplan/`) qui transmet `$ARGUMENTS` tels quels à `plan-servicedesk` — **aucune logique dupliquée** (anti-drift : tout le comportement reste dans `plan-servicedesk`, l'alias en hérite). Délégation robuste : outil `Skill` en voie normale, **fallback `Read`** du `SKILL.md` cible (projet puis global) car `plan-servicedesk` porte `disable-model-invocation: true` (qui peut le retirer du contexte appelable). Mêmes arguments (`brainstorming`/`brain`, `D-xxxx`, texte libre). Listes de skills (README/CLAUDE.md) passées à 23 + assert de copie ajouté au test CLI.

## [1.7.0] - 2026-06-25

### Modifié

- **Skill `/plan-servicedesk` — brainstormer sur une Demande existante + alias `brain`.** Le parsing faisait sauter la Phase A (brainstorm) dès qu'un `D-xxxx` était présent : impossible de challenger/affiner une demande déjà écrite. Désormais les deux signaux sont **orthogonaux** :
  - `D-xxxx` veut dire « ne recrée pas la Demande » → la **Phase B devient une mise à jour** (`mcp__servicedesk__demands` action `update`), plus jamais un saut silencieux du brainstorm ;
  - `brainstorming` **ou son alias `brain`** active la Phase A indépendamment. Avec `brain D-xxxx`, le brainstorm est **amorcé sur le contenu de la Demande** (titre + description, lus via action `get`), puis la Demande est mise à jour avec le besoin affiné.
  - Garde-fou : `update` refusé si la Demande est en statut terminal (`delivered`/`declined`) → signalé, jamais forcé. Matrice des 4 cas ajoutée au SKILL.md.

## [1.6.0] - 2026-06-25

### Corrigé

- **`claude-swt` : le teardown auto des worktrees ne se déclenchait jamais** (snippet `v1.1.0` → `v1.2.0`). Au quit, le check des branches non mergées itérait sur **toutes** les branches `feat/*`/`fix/*` du repo — qui sont globales, partagées entre worktrees. Dès qu'une **autre** session avait une branche active (cas normal en parallélisme), le worktree courant — pourtant clean et mergé — était conservé indéfiniment. Idem pour `claude-swt-gc`. Désormais la décision (extraite dans `_claude-swt-pending`) ne valide **que les branches de la session courante** : la branche checked out dans le worktree + la socle `wt/<sess>`. Les branches des autres sessions sont ignorées ; une `feat/fix` créée puis quittée survit au teardown (jamais supprimée) donc rien n'est perdu.
- **Bug latent corrigé au passage** : des commits faits **directement** sur la branche socle `wt/<sess>` n'étaient pas validés avant le `git branch -D wt/<sess>` du teardown (perte possible). Ils bloquent maintenant correctement le retrait.

### Technique

- Test `scripts/tests/test-claude-swt-pending.sh` (bash + zsh) : repo réel + 4 worktrees, prouve le RED (l'ancienne logique globale bloquait à tort) et le GREEN des 4 scénarios (autre session ignorée, HEAD feat non mergée bloque, commits sur socle bloquent, feat mergée retirable).

## [1.5.0] - 2026-06-25

### Ajouté

- **MAJ globale des skills du pack via `setup`** (T-20260625-0016, PR #89) — `npx @somtech-solutions/pack setup` mirrore désormais **tous les skills du pack** dans `~/.claude/skills` (en plus des user-skills, claude-swt et hook de version). Re-jouable = mise à jour, résout le drift des copies globales (ex. `end-session` global périmé). **Préserve les skills perso hors-pack** (jamais dans le payload → jamais touchés/supprimés) ; un skill du pack divergent en global n'est pris qu'avec `--force`.
- **Skill `/somtech-pack-global`** — pilote la MAJ globale du poste en session (dry-run → diff → apply après confirmation), distinct de `/somtech-pack-maj` (projet).

### Technique

- **Moteur `applyFiles` : option `backup`** (opt-in, défaut off → aucun changement pour `init`/`update`) — sauvegarde `<fichier>.somtech.bak` avant tout écrasement `--force`. Le miroir global l'active → perte impossible. Couvert par tests `node:test` (red-green prouvé) en dossiers temp.

### Sécurité

- **Secrets MCP hors des `.mcp.json` versionnés** (incident T-20260625-0012) — chantier pour sortir la clé API Somcraft des `.mcp.json` (où elle était collée en clair → fuite dans l'historique git).
  - **`claude-swt` source le `.env` du repo principal** (T-20260625-0013, PR #87) — avant de lancer `claude` dans le worktree, le `.env` du repo (`$main`, jamais commité) est sourcé pour que l'expansion `${VAR}` des `.mcp.json` fonctionne (Claude Code ne lit pas `.env` seul). Le secret n'est pas dupliqué sur disque. Test dédié red→green + non-régression installateur.
  - **Pattern `.mcp.json` Somcraft via `${SOMCRAFT_MCP_API_KEY}`** (T-20260625-0014, PR #88) — les snippets recommandés par les skills (`deploy-somcraft`, `somcraft/troubleshooting`, `mcp-builder`, template projet client) référencent désormais une variable d'environnement au lieu d'une clé en clair. Lint de garde `scripts/tests/test-no-hardcoded-mcp-secrets.sh` (scanne `.md`/`.tpl`/`.json`) + job CI `.github/workflows/tests.yml` qui exécute `scripts/tests/*.sh` sur chaque PR.
  - **Hors-scope (par repo client)** : rotation des clés déjà exposées + nettoyage des `.mcp.json` existants.

## [1.4.0] - 2026-06-25

### Ajouté

- **Skill `/plan-servicedesk`** (T-20260625-0011, PR #86) — orchestrateur mince qui fait le pont entre la planification **superpowers** et la documentation **ServiceDesk** : (A) param `brainstorming` → invoque `superpowers:brainstorming` ; (B) crée la **Demande** `D-…` ; (C) lance le Workflow `analyse-decoupage-demande` (lecture seule : valide le BRD au bon grain + propose le découpage Epic→Story G/W/T tracé aux EF) ; (D) après validation (gate dur `pret_a_creer`), crée la hiérarchie Epic/Story dans ServiceDesk. **Compose** les briques existantes (ne les forke pas) → survit aux MAJ du plugin superpowers. Cadre : STD-030 + STD-033 + ADR-031.

### Corrigé

- **Inventaire des skills (drift README)** — `README.md` listait un skill fantôme `playwright-tests` (inexistant) et omettait `merge` + `pousse-staging` ; corrigé à la liste réelle (21 skills) et synchronisé avec `CLAUDE.md`.

## [1.3.4] - 2026-06-24

### Modifié

- **Skills `somtech-pack-maj` / `somtech-pack-install` basés sur npx** (T-20260624-0041, PR #84) — en session Claude, « mets à jour le pack » lance directement `npx @somtech-solutions/pack update` (dry-run → confirmation → apply) au lieu de l'ancien clone+diff+pull. `curl|bash` conservé en fallback legacy.

## [1.3.3] - 2026-06-24

### Ajouté

- **Hook de nudge de version GLOBAL via `setup`** (T-20260624-0040, PR #83) — `npx @somtech-solutions/pack setup` installe un hook `SessionStart` dans `~/.claude/settings.json` (câblage idempotent, backup, refus si JSON invalide/atypique) qui avertit, dans **tout** projet, si le pack n'est pas à jour. Un seul `setup` couvre tous les projets présents et futurs ; câblage projet retiré (plus de double-nudge).

## [1.3.2] - 2026-06-24

### Ajouté

- **Hook `SessionStart` de nudge de version (niveau projet)** (T-20260624-0037, PR #82) — avertit, de façon **non-bloquante** (cache global machine rafraîchi en arrière-plan ≤ 1×/24h, comparaison semver numérique, fail-silent, anti-clobber offline), si la version du pack installée n'est pas la dernière publiée.

## [1.3.1] - 2026-06-24

### Corrigé

- **`.somtech-pack/version.json`** (T-20260624-0035, PR #81) — écrit la version du **package npm** (= tag) + `name`/`installedBy` `@somtech-solutions/pack` (au lieu de la version du `pack.json` bundlé / l'ancien nom `@somtech/pack`) ; `packContentVersion` ajouté pour la traçabilité. `pack.json`/`VERSION` réconciliés.
- **`.claude/settings.json` préservé** — mécanisme `preserve` dans `pack.json` : un chemin listé est créé s'il est absent (starter) mais **jamais écrasé** s'il existe, même avec `--force` (statut `preserved`). Plus de perte de la config projet à l'`update`.

## [1.3.0] - 2026-06-24

Installation et mise à jour du pack en **une commande `npx`** (package privé GitHub Packages), et robustesse du workflow « worktree par session » multi-contributeur.

### Ajouté

- **CLI `@somtech-solutions/pack` (npx)** — demande D-20260623-0006 :
  - `init` / `update` / `setup` (E-20260623-0018, PR #76) — moteur de copie idempotente avec rapport de diff (created/unchanged/updated/conflicts/preserved), **containment anti-traversal**, symlinks ignorés, bit exécutable préservé. Node ESM zéro-dépendance.
  - **Packaging GitHub Packages** : contenu du pack **bundlé** au publish depuis le repo (anti-drift), workflow `.github/workflows/publish.yml` sur tag `v*` (build → tests → `npm publish`) (E-20260623-0019, PR #77).
  - `setup` poste : skills globaux + `claude-swt` (E-20260623-0020, PR #78).
  - Docs npx + `cli/README` ; `curl|bash` marqué transitoire (E-20260623-0021, PR #79).
- **Workflow « worktree par session »** — demande D-20260623-0005 :
  - **Gate migrations multi-contributeur** dans `/pousse-staging` — attrape les collisions de migrations en local avant staging (E-20260623-0016, PR #73).
  - **`/merge` worktree-aware** — diffère la suppression de branche quand un worktree lié est attaché (E-20260623-0017, PR #74).
  - **Distribution de `claude-swt`** via `remote-install.sh --with-claude-swt` (E-20260623-0015, PR #75).
- **`/end-session` ferme les branches mergées** (T-20260624-0019, PR #80) — détecte les **squash-merges** (`git merge-tree`), corrobore l'intégration (vraie ancêtre / PR mergée `gh`) avant toute suppression distante, conserve les branches non mergées et non corroborées.

### Migration

- L'installation/MAJ bascule de `curl | bash` (déprécié, conservé en transition) vers **`npx @somtech-solutions/pack`**. Prérequis poste (1×) : `~/.npmrc` avec `@somtech-solutions:registry=https://npm.pkg.github.com` + token `read:packages`.

## [1.2.0] - 2026-06-23

Regroupe les évolutions du pack depuis v1.1.0 : nouveaux skills de gouvernance documentaire (BRD, ontologie, schéma de données, agent brief, alignés sur les STD-033 à STD-036) et durcissement du plugin `somtech-somcraft-deployer` (provisioning du sidecar Gotenberg pour l'export PDF SomCraft ≥ v0.31.0).

### Ajouté

- **Skill `/brd`** (PR #62, E-20260529-0007) — commande de gestion du BRD d'une application, référence STD-033. Étendu au **grain module** (PR #69, E5-S1) et **cross-référencé** vers le workflow `analyse-decoupage-demande` (PR #70, E5-S2).
- **Skill `/ontology`** (PR #64, STD-035, D-20260605-0006) — gestion de l'ontologie d'une app.
- **Skill `/agent-brief`** (PR #65, STD-036) — gestion de l'Agent Brief (renommé **ABD → ABC, Agent Brief Canonique** en PR #68).
- **Skill `/schema-doc`** (PR #66, STD-034, D-20260605-0005) — wrapper de gestion du `data_schema` + pointer SD.

### Modifié

- **Skills BRD — alignement pattern pointer Somcraft + auth uniforme** (PR #67, D-20260605-0003).
- **Plugin `somtech-somcraft-deployer` v1.4.1 → v1.5.0** (PR #61) — alignement du skill sur SomCraft v0.21 (résorption du drift v0.4.x).
- **Plugin `somtech-somcraft-deployer` v1.5.0 → v1.6.0 — provisioning sidecar Gotenberg dans l'upgrade** (PR #71, T-20260603-0010) :
  - Le skill `deploy-somcraft` (modes `install` et `upgrade`) provisionne désormais le **sidecar Gotenberg** (export PDF) en Phase 4, avant le `fly deploy`, pour toute version SomCraft cible **≥ v0.31.0**. Sans cette étape, l'export PDF était cassé après un upgrade (Puppeteer in-process retiré de l'image en v0.31.0).
  - L'étape **délègue au script versionné `tools/provision-gotenberg-sidecar.sh`** du repo SomCraft cloné (source de vérité, idempotent) — pas de duplication de logique dans le skill. Gate de version via `sort -V`.
  - Phase 5 (smoke tests) : nouveau **Test 4 — export PDF** via MCP `export_document` (vérifie le `download_url`, détecte `PDF generation failed`).
  - `commands/deploy-somcraft-upgrade.md` + `references/fly-deployment.md` mis à jour (secret `GOTENBERG_URL` staged par le script, pas posé manuellement).
  - Mode `upgrade` : la Phase 4 étape 5 est idempotente et **obligatoire** pour ≥ v0.31.0 — documenté explicitement pour interdire de la court-circuiter.

## [1.1.0] - 2026-05-15

Première montée de version depuis la mise en place du versioning. Cette version regroupe la fin de la demande **D-20260513-0012** (audit complet post-nettoyage, 7 stories), le fix de design `security/` opt-in, et la mémoire externe d'état d'application (STD-027) commencée le 2026-05-12.

### Ajouté

- **Mémoire externe d'état d'application (STD-027)** (2026-05-12, PR #45, D-20260512-0004) :
  - Skill `/lier-app` — associe un repo à une application Somtech, crée `.somtech/app.yaml` + doc Somcraft `/operations/<app-slug>/etat-app.md`
  - Skill `/sync-app-state` — synchronise l'état d'app entre repo et Somcraft
  - Hook `SessionStart` — charge automatiquement l'état au démarrage de session Claude Code
  - Extension `/end-session` — met à jour le doc Somcraft de fin de session
  - Templates et structure `.somtech/` à la racine du repo
- **Nouveau module `security`** dans `pack.json` (2026-05-15, PR #59) — opt-in (`default: false`), permet d'opt-in via `--modules core,features,security` sans écraser l'architecture sécurité projet-spécifique
- **`mcp-expose-v1.0.0.zip`** (2026-05-15, PR #56, T-20260513-0041) — fichier `.zip` versionné du plugin mcp-expose (20 K)
- **`somtech-somcraft-deployer-v1.4.1.zip`** (2026-05-13, PR #53, T-20260513-0049) — regen du `.zip` plugin (36 K)

### Modifié

- **Plugin `somcraft-deployer`** v1.4.0 → **v1.4.1** (PR #53, T-20260513-0049) — source du nom client migrée de `.claude/CLAUDE.md` vers `.somtech/app.yaml` (créé par `/lier-app`). Pas de fallback bricolage : échec explicite si `.somtech/app.yaml` absent
- **Module `core`** (PR #59) — retrait de `security/` (devient module opt-in distinct). `core` = `.claude/`, `scripts/`, `docs/`
- **Script `somtech_pack_pull.sh`** (PR #50 + #57) — pull autonome, flags `--modules core|features|security|mockmig|plugins`, `--ref`, `--dry-run`. Exclusions explicites de `.claude/CLAUDE.md` et `.claude/settings.json` (jamais écrasés)
- **Skill `webapp-testing`** (PR #55, T-20260513-0040) — retrait complet de la section Construction Gauthier (UUIDs, emails `@constructiongauthier.local`, 149 tests CG). Skill 100 % générique, fichier passe de 198 à 97 lignes
- **Skills `/scaffold-aims` et `/somtech-pack-maj`** (PR #52, T-20260513-0037) — nettoyage des références mortes vers `install_somtech_pack.sh` (Tier 1) et `.cursor/`. Section « Options avancées » de `/somtech-pack-maj` réécrite avec les vrais flags du script
- **Templates bootstrap** (PR #57, T-20260513-0042) — `constitution.example.md` + `ARCHITECTURE_DE_SECURITÉ.example.md` : 29 mentions `.cursor/rules/*.mdc` remplacées par références à `.claude/agents/`, `.claude/skills/`, `~/.claude/CLAUDE.md` global et `.mcp.json`
- **`CLAUDE.md` racine du pack** (PR #56 + #59) — tableau modules à jour, retrait `.claude/CLAUDE.md` (fichier supprimé) et `playwright-tests` (skill supprimé), description du dossier `security/` clarifiée

### Supprimé

- **Template `.claude/CLAUDE.md` projet** (PR #49, D-20260513-0009) — retrait complet (anti-duplication avec le CLAUDE.md global utilisateur). Les projets peuvent garder leur propre `.claude/CLAUDE.md` local s'ils en ont un. Adaptation de `/end-session`, `/somtech-pack-maj`, `/somtech-pack-install`
- **Skill `/playwright-tests`** (PR #54, T-20260513-0039) — 100 % spécifique Construction Gauthier (pas de frontmatter YAML, chemin Mac hardcodé, 9 emails `@constructiongauthier.com`). 5 fichiers, −459 lignes
- **Legacy Cursor** (PR #46, Tier 1) — `.cursor/` (70+ fichiers), `scripts/install_somtech_pack.sh` (1074 lignes), `scripts/migrate_cursor_backups.sh`. Le pack devient un pack honnête : Claude Code + plugins Cowork uniquement

### Refactoré

- **Tier 2 — réécriture template `.claude/CLAUDE.md`** (PR #47) — aligné sur la stack 2026 (ADR-012 Next.js, DO TOR1, règles d'or actuelles, STD-001/002/027, workflow Demande → Epic → Story). Suivi par le retrait complet en PR #49
- **Tier 3 — audit legacy potentiel** (PR #48) — README ajouté à `features/audio-transcription-analysis`

### Corrigé

- **Régression scripts pull + skills** (PR #50) — pull autonome, exclusion `settings.json` du pull, fix du merge JSON dans `/lier-app`
- **Nettoyage post-audit** (PR #51) — fix `somtech_pack_add` + suppression de 2 orphelins

### Technique

- `scripts/update_speckit_assets.sh` (PR #56) — passage de `-rw-r--r--` à `-rwxr-xr-x` (chmod +x)
- Mise en place du versioning SemVer + convention de tag git `v<MAJOR>.<MINOR>.<PATCH>` (2026-05-15)

## [1.0.0] - 2025-02-01

Version initiale historique (tag rétroactif posé le 2026-05-15 pour figer l'état antérieur à la mise en place du versioning).

### Ajouté

- **Skills Claude Code** (`.claude/skills/`)
  - `mockmig/` — workflow de migration avec 6 phases (init, discover, analyze, plan, execute, status)
  - `git-module/` — gestion des sous-modules git avec 5 phases (status, add, list, sync, remove)
- **Templates bootstrap** (`.claude/templates/bootstrap/`)
  - Templates ontologie, memory, security, session
- **Schémas** (`.claude/schemas/`)
  - `mockmig/session.schema.json`
- **Configuration**
  - `.gitignore` pour ignorer les fichiers `.DS_Store`

### Modifié

- `mockmig/phases/discover.md` — mise à jour du workflow de découverte
- `mockmig/phases/execute.md` — mise à jour du workflow d'exécution

### Technique

- Synchronisation avec origin/main (38 fichiers récupérés)
- Nettoyage des `.DS_Store` accidentellement committés

> **Note** : la mention historique `.claude/CLAUDE.md instructions projet` qui figurait dans cette entrée a été retirée — ce fichier a depuis été supprimé du pack le 2026-05-13 (cf. PR #49, intégré dans v1.1.0).

# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).
Le pack suit le versioning [SemVer](https://semver.org/lang/fr/) — la version est exposée dans `pack.json` et figée par un tag git `v<MAJOR>.<MINOR>.<PATCH>` à chaque livraison.

## [1.29.1] - 2026-08-06

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

## [Non-versionné] - 2026-07-19

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

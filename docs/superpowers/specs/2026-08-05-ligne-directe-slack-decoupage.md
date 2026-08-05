# Découpage proposé — Ligne directe Slack (D-20260805-0004)

- **Demande** : D-20260805-0004 · **Application** : Somtech Pack
- **BRD** : grain `application`, résolu depuis `application`, version **0.5.0** (présent : True)
- **Verdict du workflow** : `pret_a_creer` = **False** — 3 bloquants.
- **Nature** : proposition en lecture seule produite par le workflow `analyse-decoupage-demande`.

## ⚠️ Ce document est la proposition BRUTE — lire d'abord ce qui a été retenu

Les trois bloquants ont été corrigés **à la main** par la session, sur décision explicite de Maxime de ne pas repayer une re-validation complète du workflow (~25 min, ~800k jetons) pour des corrections connues et mécaniques. Le dépassement du gate est donc **assumé et tracé ici**, conformément à l'exception prévue par `/plan-servicedesk` Phase D.

**Corrections appliquées à la structure ci-dessous :**

| Bloquant | Correction retenue |
|---|---|
| Arbitrage Loi 25 orphelin | Tranché par Maxime le 2026-08-05 : **aucune restriction**, risque assumé et consigné (décision D1 sur la demande). Le point ne bloque plus. |
| E0 = 9 stories de gouvernance sans valeur ni test | Fusionnées en **une seule** story d'amendement du BRD, exécutée en phase d'analyse. |
| Ordre E0-avant-E1 inexécutable | **Inversé** : les vérifications préalables d'abord, l'amendement du référentiel ensuite, avec les faits mesurés. |
| (majeur) Axe « dépôts distincts » | Réécrit sur la **copie de travail (worktree)** — `claude-swt` crée N worktrees d'un même dépôt, c'est le mode nominal. |

**Structure réellement créée dans le ServiceDesk** (7 epics rattachés à D-20260805-0004) :

1. `E-20260805-0008` — Vérifications préalables (4 stories créées)
2. `E-20260805-0009` — Amendement du BRD à la v0.6.0 (1 story créée)
3. `E-20260805-0010` — Le sens sortant
4. `E-20260805-0011` — Le sens entrant
5. `E-20260805-0012` — La ligne ne perd aucun message
6. `E-20260805-0013` — Distribution et filets
7. `E-20260805-0014` — La compétence et son premier usage

**Les epics 3 à 7 n'ont volontairement pas encore de stories.** Leurs critères d'acceptation porteraient sur des faits que les vérifications préalables doivent d'abord établir (forme d'appel réelle de l'injection dans un pane, ce que Slack permet, habitat d'un processus permanent). Les écrire aujourd'hui produirait des tests décoratifs — exactement ce que la critique reproche. Chaque epic est décomposé par l'agent qui l'exécute, au moment de l'exécuter, comme le veut `/orchestrer-chantier`. Le matériau brut de ces stories est conservé plus bas dans ce document.

## Verdict de la critique adversariale

Découpage sérieux et, sur le terrain, remarquablement exact : j'ai vérifié à la source les affirmations structurantes et elles tiennent — BRD somtech-pack bien en v0.5.0 avec 12 EF sur 3 domaines et aucune EF de joignabilité (donc la numérotation EA-GBL-005 / EF-AGT-003..005 / RA-AGT-005..007 / HS-AGT-002..005 est juste) ; les dépendances d'exécution ne voyagent effectivement dans le paquet publié que sous `herdr-plugins/` ; le lint de secrets ne couvre bien que la forme JSON `"Authorization": "Bearer …"` en .md/.tpl/.json ; l'installation des modules de portée poste passe bien sans liste `preserve` ; `--no-canvas` gouverne bien TOUS les modules de portée poste ; les tests de plugins (`herdr-plugins/excalidraw/tests/*`) cités en « Testé par » d'EF-DIA-001/002 ne tournent effectivement dans aucun job de CI — violation en cours de RA-DIS-004 ; et la référence croisée à D-20260805-0001 dans la demande est bien fausse. L'inversion de risque (sortant avant le veilleur) et le principe « la résilience se livre avec la story qui en a besoin » sont bien vus.

Trois choses bloquent la création. (1) L'arbitrage Loi 25 sur un flux automatisé de contenu de chantier client vers un hébergeur tiers n'appartient à aucun epic et n'a aucune place dans l'ordre, alors que E2 publie déjà pour de vrai — et la rétention côté tiers n'est traitée nulle part. (2) E0 transforme un unique bump documentaire du BRD en 9 stories sans valeur user, sans test et à traçabilité circulaire (« EF … À CRÉER »), là où STD-033 place l'amendement en Phase 1 de l'analyse. (3) L'ordre E0-avant-E1 est inexécutable : trois stories de E0 consomment les livrables des spikes de E1 — dont le nombre de jetons, affirmé de mémoire et gravé dans une règle opposable par un découpage qui interdit précisément cela.

Au-delà : la précision proposée de HS-AGT-001 (« dépôts distincts ») grave une contrainte que `claude-swt` contredit tous les jours (N worktrees d'un même dépôt = le mode nominal), une EF est mal citée en E6 (EF-DIS-002, pas EF-DIS-001), et trois stories dépassent nettement la PR unique (ouvrir une ligne, injection prouvée, mort du veilleur — cette dernière introduisant un rattrapage de messages jamais posé en E3).

À corriger puis à re-soumettre : le fond est bon, la charpente demande une passe.

## Défauts relevés

### [BLOQUANT] Transverse — arbitrage Loi 25 (mentionné dans `spike_brainstorming`, rattaché à aucun epic, absent de `ordre_recommande`)

**Problème** — Le découpage reconnaît lui-même qu'un flux automatisé de contenu de chantier client vers un hébergeur tiers, sans relecture humaine, est un flux NOUVEAU — puis il ne l'attribue à personne : ni epic, ni story, ni position dans l'ordre. Or E2 pose déjà, en passe de fumée « sur l'espace réel », du contenu de chantier dans Slack, et le seul contrôle prévu (« consigne de retenue ») arrive en E6, soit quatre epics APRÈS la première publication. S'y ajoute un angle mort complet : la rétention côté tiers — un canal archivé conserve indéfiniment le contenu publié, et aucune story ne traite l'effacement ni la durée de conservation. Un arbitrage de conformité qui conditionne la première livraison ne peut pas être un post-scriptum de notes.

**Correction** — Faire de l'arbitrage Loi 25 une unité de travail explicite et ordonnancée AVANT E2 (dans E0 ou E1) : décision écrite (le flux est-il admissible ? à quelles conditions ?), traduite en hors-scope BRD opposable (ex. « aucune donnée nominative de client ne transite par la ligne ») + en exigence de rétention/effacement, et seulement ensuite déclinée en consigne de compétence en E6. Tant que la décision n'est pas écrite, aucune passe de fumée sur l'espace Slack réel avec du contenu de chantier.

### [BLOQUANT] E0 — les 9 stories (gouvernance BRD)

**Problème** — Les 9 « stories » de E0 sont une seule et même édition documentaire : un bump du BRD somtech-pack de 0.5.0 à 0.6.0, dans un seul document Somcraft (vérifié : `dedb3032-…`, v0.5.0, 12 EF sur 3 domaines). Elles ne sont ni livrables ni fermables indépendamment (même document, même version, même PR nulle), aucune ne produit de valeur observable pour le dirigeant, et 9 sur 9 portent `niveau_test: N-A` — ce qui viole frontalement le test décisif de découpage par valeur user (STD-030) et la règle d'or n°6. Le champ `ef_tracee` y est circulaire : « EF-AGT-003 (À CRÉER) » n'est pas une traçabilité, c'est le livrable de la story elle-même. Enfin, STD-033 §2.7 place l'amendement du BRD en Phase 1 de l'ANALYSE — avant l'écriture des stories — pas dans la hiérarchie de livraison.

**Correction** — Sortir E0 de la hiérarchie de livraison : exécuter l'amendement BRD v0.6.0 comme Phase 1 de l'analyse (via `/brd`), en une passe, avec validation du sponsor. S'il faut absolument une trace ServiceDesk, une seule story « Amender le BRD somtech-pack à 0.6.0 » avec pour condition de fin la projection structurée contenant EA-GBL-005, EF-AGT-003/004/005, RA-AGT-005/006/007, EF-DIS-002 amendée, HS-AGT-002..005. Les 8 autres deviennent des points de la checklist de cette story, pas des lignes du registre.

### [BLOQUANT] E0 ⇄ E1 — ordre déclaré

**Problème** — E0 est déclaré « préalable bloquant » et E1 vient après, mais au moins trois stories de E0 consomment des livrables de E1 : (a) RA-AGT-005 écrit « les DEUX jetons (application et robot) » — fait d'API que le spike 1 de E1 existe précisément pour établir ; (b) EF-AGT-005 exige de couvrir « les QUATRE cas » dont le comportement d'un canal clos, que le REF du spike 1 doit trancher ; (c) l'arbitrage HS-DIS-001 (« enregistrer un service auprès du gestionnaire du poste : capacité du pack ou dépendance système ? ») ne peut être tranché avant l'ADR du spike 3. Le découpage écrit lui-même « aucune story de E3 n'est briefée avant que cet arbitrage soit écrit », créant une boucle E0→E1→E0. En l'état, l'ordre recommandé est inexécutable tel quel.

**Correction** — Inverser partiellement : exécuter les 3 spikes de E1 D'ABORD (ils ne touchent pas au code de production et ne dépendent de rien), puis amender le BRD une seule fois avec les faits mesurés. Ou scinder : E0a = ce qui ne dépend d'aucun fait externe (EA-GBL-005, EF-AGT-003/004, HS-AGT-002..005), E1 = spikes, E0b = ce qui en découle (RA-AGT-005, EF-AGT-005, EF-DIS-002/HS-DIS-001).

### [MAJEUR] E0 story « Inscrire les quatre exclusions… » (précision de HS-AGT-001) et E3 story « Le bon agent reçoit le bon message »

**Problème** — La précision proposée — « le multi-lignes simultanées vaut pour des chantiers portés par des dépôts DISTINCTS » — grave dans le BRD une contrainte que l'outillage Somtech contredit au quotidien. `claude-swt` est la commande standard d'ouverture de session et crée N worktrees du MÊME dépôt (`~/worktrees/<repo>/<timestamp>`) : deux chantiers parallèles sur somtech-pack sont le mode nominal de parallélisme, pas un cas exotique. Le G/W/T de E3 hérite du défaut (« deux lignes ouvertes sur des chantiers portés par des dépôts DISTINCTS ») et ne teste donc jamais le cas réellement fréquent : deux agents, deux worktrees, un seul dépôt — c'est-à-dire précisément le cas où l'appariement peut se tromper de destinataire.

**Correction** — Écrire l'axe sur la COPIE DE TRAVAIL, pas sur le dépôt : « plusieurs lignes simultanées sont supportées dès lors que chaque chantier vit dans sa propre copie de travail (worktree) ». Reformuler le G/W/T de E3 en deux worktrees du même dépôt. Vérifier au passage l'unicité du nom de canal quand deux worktrees portent le même identifiant de chantier.

### [MAJEUR] E6 story « La compétence /ligne-directe existe là où l'agent la cherche » — `ef_tracee`

**Problème** — La dichotomie proposée est fausse sur une de ses deux branches. Vérifié sur le BRD v0.5.0 : EF-DIS-001 = « installer et mettre à jour le pack DANS UN PROJET, par modules sélectionnables » ; EF-DIS-002 = « configurer un POSTE (compétences et workflows globaux, lanceur de session, réservations de ports) » ; EF-DIS-005 = « une session hors du dépôt somtech-pack dispose des COMMANDES au même titre que de ses compétences ». Le G/W/T de la story exige explicitement une session ouverte dans un dépôt qui n'est PAS somtech-pack : le vecteur « compétence » y relève donc d'EF-DIS-002 (compétences globales déposées par `pack setup`), jamais d'EF-DIS-001. La story se prémunit du « problème que le BRD énonce lui-même » tout en le commettant.

**Correction** — Remplacer par « EF-DIS-002 (compétence globale de poste) OU EF-DIS-005 (commande slash mirrorée) selon le vecteur tranché par l'ADR ». Si le vecteur retenu est une compétence installée dans le projet, alors le G/W/T doit changer (session dans un projet ayant reçu le pack) et EF-DIS-001 redevient la bonne EF — mais les deux ne peuvent pas coexister.

### [MAJEUR] E0 story « garde du secret d'outillage » (RA-AGT-005) + E1 story 4 + `notes` §« DEUX JETONS, PAS UN »

**Problème** — Le découpage pose comme règle que « la date de coupure du modèle rend toute affirmation d'API produite de mémoire irrecevable », puis inscrit dans une règle d'affaires OPPOSABLE, avant tout spike, un fait d'API produit de mémoire : « le mode d'écoute permanent exige DEUX jetons distincts (application et robot) », allant jusqu'à déclarer « faux » l'énoncé de la demande. C'est vraisemblablement exact, mais la seule chose vérifiée à ce stade est qu'aucun des deux énoncés n'a été confronté à la documentation courante. Graver un nombre de secrets dans le BRD avant le spike 1, c'est fabriquer l'autorité qu'on reproche à la demande.

**Correction** — Rédiger RA-AGT-005 sans compter les jetons (« tout secret qui autorise une capacité de poste à joindre un service externe vit dans le trousseau… »), faire du nombre et de la nature des jetons une sortie explicite du spike 1, et ne corriger la demande/le design doc qu'après mesure. Le prérequis humain de E1 se briefe alors sur le REF, pas sur une conviction.

### [MAJEUR] E2 story « Ouvrir une ligne : le canal existe, le dirigeant est dedans, et l'agent parle en son nom »

**Problème** — Une seule story porte : normalisation d'un identifiant de chantier en nom de canal accepté, création du canal, invitation du dirigeant, publication sous nom + avatar d'emprunt, inscription au registre, résolution d'un conflit de nom, échec bruyant sur service injoignable ou jeton absent, et absence de ligne fantôme. C'est au moins deux PR, et le G/W/T empile huit assertions hétérogènes. Le membre le plus faible est en outre non testable : « si le nom est déjà pris ou refusé, la commande le dit et PROPOSE un nom valide au lieu d'échouer sèchement » — proposer à qui ? Un agent n'a personne à qui demander. La commande crée-t-elle avec le nom proposé, ou sort-elle en erreur ? Deux comportements incompatibles passent ce critère.

**Correction** — Scinder en (1) « normaliser un identifiant de chantier en nom de canal valide et unique » (unitaire, sans réseau, avec la règle de résolution de collision ÉCRITE : suffixe déterministe, ou échec), (2) « ouvrir la ligne : canal créé, dirigeant invité, message d'ouverture sous l'identité de l'agent, ligne inscrite », (3) « échec bruyant et absence de ligne fantôme ». Et trancher explicitement le comportement en cas de collision au lieu de dire « propose ».

### [MAJEUR] E3 story « Le message du dirigeant arrive entier, et sa remise est prouvée »

**Problème** — Cette story contient trois mécanismes indépendants et lourds : (a) le patron fichier-hors-worktree + injection d'une référence, (b) la fidélité caractère par caractère sur apostrophes/guillemets/retours à la ligne, (c) la preuve de remise par relecture du pane, la détection du message resté collé, sa correction, ET le report d'échec dans le canal Slack. Chacun a son propre mode de panne et sa propre doublure. Regroupés, ils dépassent une PR et rendent impossible d'attribuer un échec de test à un mécanisme.

**Correction** — Trois stories : « le message est écrit hors du worktree et injecté par référence » ; « le contenu lu par l'agent est identique caractère pour caractère » ; « aucune remise n'est comptée sur le seul code retour : relecture du pane, correction du collé, échec annoncé dans le canal ». Elles s'enchaînent dans le même epic et gardent la résilience livrée avec le mécanisme, comme le découpage l'exige par ailleurs.

### [MAJEUR] E4 story « Un veilleur qui meurt le dit aussi, dans les deux sens »

**Problème** — Le `then` exige qu'« à son retour, le veilleur rattrape les messages arrivés pendant son absence et les délivre (aucun n'est perdu) ». C'est une capacité substantielle — curseur de lecture persistant par canal, relecture d'historique, dédoublonnage à la reprise — qu'aucune story de E3 ne pose : E3 ne livre qu'une écoute en direct. La story de E4 introduit donc en douce un mécanisme neuf sous couvert de « cas de rupture », et E4 story « Le poste redémarre » en dépend aussi (« un message écrit pendant l'indisponibilité est délivré au retour »).

**Correction** — Poser explicitement le curseur de reprise comme story de E3 (« la ligne retient où elle en était : à la reconnexion, aucun message n'est relu deux fois ni sauté »), puis réduire les stories de E4 à la constatation des cas de rupture. Sans quoi E4 hérite d'un chantier non estimé.

### [MAJEUR] E6 story « La discipline de parole est écrite, y compris ce qui ne sort pas du poste »

**Problème** — La condition de fin est « un chantier mené de bout en bout avec sa ligne ouverte » puis relecture intégrale du canal après clôture. Elle n'est ni bornée dans le temps ni exécutable dans la PR qui livre la compétence : la story reste ouverte jusqu'à ce qu'un chantier réel naisse, avance et se termine. Elle mélange deux livrables de nature différente — le contenu de la compétence (revuable immédiatement) et la preuve d'usage (QA sur chantier réel).

**Correction** — Scinder : (1) « la compétence énonce ce qui va sur la ligne, ce qui n'y va pas, la retenue sur les données client et l'obligation de réinscription » — vérifiable par revue de la compétence, fermable dans la PR ; (2) une validation d'usage attachée au premier chantier réel, tracée comme preuve de travail sur ce chantier-là, pas comme story bloquante du présent découpage.

### [MINEUR] E1 — les trois spikes / `spike_brainstorming`

**Problème** — Le résumé annonce « TROIS SPIKES TIMEBOXÉS » mais un seul porte une borne (« ½ journée »). Les deux autres — dont celui qualifié d'« unité la plus risquée du chantier » — n'ont aucune limite, ce qui est exactement le mode de panne qu'un timebox existe pour éviter.

**Correction** — Poser une borne explicite sur chacun des trois (ex. ½ j, ½ j, 1 j) et dire ce qu'on fait si la borne est atteinte sans condition de fin (remonter l'arbitrage, pas prolonger).

### [MINEUR] E1 spike 3 — « Où vit un processus permanent sur le poste »

**Problème** — Le spike est présenté comme l'unité la plus risquée et prévoit d'instruire trois habitats. Or la mécanique visée tourne déjà en production sur ce poste : deux services launchd Somtech (`ca.somtech.likec4` et `ca.somtech.archibot`, cf. D-20260804-0001, 2026-08-04) avec `KeepAlive`/`RunAtLoad`, plist dans `~/Library/LaunchAgents` et journaux. Le découpage est honnête (« le dépôt n'a aucun précédent », « le précédent vit dans un autre dépôt ») mais l'ordre de grandeur du risque est surévalué, ce qui sert de justification principale à l'inversion E2/E3.

**Correction** — Réduire le spike à ce qui reste réellement ouvert : la frontière HS-DIS-001 (le pack a-t-il le droit de déposer un plist ?), le point d'entrée local vérifiable, et le vecteur de livraison de la compétence. Instruire un seul habitat de référence (launchd, déjà éprouvé) et n'en instruire un second que s'il est écarté.

### [MINEUR] E2 story « Le registre survit à une mise à jour du pack » — placement

**Problème** — Le G/W/T dit « on rejoue l'installation poste du pack, y compris avec un fichier du paquet qui porterait le même nom que le fichier de registre ». Le constat de départ est exact (vérifié : `installPosteModules` appelle `applyFiles` sans liste `preserve` ; seule la sauvegarde `.somtech.bak` protège), mais le module de la ligne directe n'est déclaré en portée poste qu'en E5 : à E2, il n'y a rien à réinstaller. La story n'est exécutable qu'avec une fixture synthétique, ce qui n'est écrit nulle part.

**Correction** — Préciser dans la story que le test s'appuie sur un manifeste de fixture (`cli/test/fixtures`) simulant un module de portée poste, ou déplacer la story en tête de E5 en gardant le choix d'emplacement du registre comme contrainte de conception posée en E2.

### [MINEUR] E2 story « Ouvrir une ligne » — citation EF-DIS-004

**Problème** — EF-DIS-004 porte sur la distribution des dépendances d'exécution d'une capacité livrée par le pack. E2 déclare explicitement la distribution hors-scope (« tout s'exécute ici depuis le dépôt : E5 »). La citer ici est une traçabilité de confort — exactement ce que le découpage reproche par ailleurs au rattachement à EF-AGT-001.

**Correction** — Retirer EF-DIS-004 de cette story (EF-AGT-003 + RA-DIS-001 suffisent) et la garder pour E5, où elle est réellement réalisée.

### [MINEUR] E5 story « Le garde-fou de fidélité aux commandes externes couvre le code neuf »

**Problème** — Le constat est exact (la table de fidélité scanne une liste figée : `.claude`, `herdr-plugins`, `scripts`, `docs`, `features`, `plugins`), mais la correction proposée — « le dossier du nouveau module figure dans la liste scannée » — reproduit le défaut au module suivant. Et si l'ADR de E1 place le module sous `.claude/` ou `herdr-plugins/`, la prémisse tombe : le garde-fou couvre déjà.

**Correction** — Dériver la liste scannée des `paths` déclarés dans `pack.json` plutôt que de l'allonger à la main, et conditionner la story au résultat de l'ADR (si le module atterrit dans un dossier déjà scanné, la story disparaît).

### [MINEUR] E1 story « Installer l'application de conversation et déposer ses deux jetons » + E0 story « Corriger la référence croisée fausse »

**Problème** — Deux « stories » qui ne sont pas des stories : l'une est un geste humain à droits d'administration qu'aucun agent ne peut livrer et qu'aucune CI ne peut fermer ; l'autre est une correction de la description d'une demande ServiceDesk, sans EF et sans code — le découpage l'assume, mais assumer une violation ne la lève pas. (La correction elle-même est fondée : vérifié, D-20260805-0001 est bien « [DEBT] Rattraper la mise à jour du somtech-pack 1.10.0 → 1.27.0 » sur une autre application, sans rapport avec l'emprunt d'identité.)

**Correction** — Traiter les deux comme des prérequis/tâches du chantier (checklist d'ouverture, visibles dans le brief du coordonnateur) plutôt que comme des lignes du registre de livraison. La correction de la description de D-20260805-0004 se fait immédiatement, à l'analyse, avant création de la hiérarchie.

## Drift du référentiel (BRD)

DRIFT 1 — 🔴 BLOQUANT AVANT DÉCOUPAGE : aucune EF du BRD ne couvre la capacité centrale de la demande. Le BRD v0.5.0 (domaines DIS, DIA, AGT) ne contient AUCUNE exigence sur « un agent joint le dirigeant hors de son pane » ni sur une conversation bidirectionnelle agent ↔ humain. Les EF listées ci-dessus couvrent l'emballage (distribution, installation poste, dépendances, fidélité aux commandes externes) et le contexte d'usage (pilotage de chantier) — pas le cœur. Une story « le veilleur injecte le message du dirigeant dans le pane de l'agent » ne se rattache aujourd'hui à rien. Règle d'or n°10 : créer l'EF AVANT d'écrire la story. Recommandation : amender le domaine AGT (EF-AGT-003 « joindre le dirigeant et recevoir sa réponse hors du poste de travail », EF-AGT-004 « discipline de parole : décisions et jalons », EF-AGT-005 « une ligne fermée répond au lieu d'avaler le message ») plutôt que d'ouvrir un domaine — la capacité est une capacité d'agent, pas un domaine de distribution. Le BRD dit lui-même (§1) que les domaines non rédigés « le seront quand une demande les touchera ; leur absence n'est pas un hors-scope » — c'est le cas ici.

DRIFT 2 — 🟠 Aucune EA ne porte la valeur d'affaires de la demande. Les 4 EA (GBL-001 installation en une commande, GBL-002 règles opposables mécaniquement, GBL-003 capacité annoncée = disponible, GBL-004 artefacts visuels éditables) ne couvrent pas « le dirigeant décide sans être devant l'écran ». EA-GBL-002 est la plus proche mais parle de faire respecter des règles, pas de joignabilité. Une EA-GBL-005 est probablement nécessaire pour que les nouvelles EF aient un « Couvre » honnête.

DRIFT 3 — 🟠 Les 4 hors-scope de la demande n'ont aucun pendant au BRD. Le §6 ne contient que HS-DIS-001, HS-DIA-001, HS-AGT-001. Les exclusions tranchées au brainstorm (boutons/menus/formulaires Slack ; partage de fichiers et d'images ; tout destinataire autre que le dirigeant ; non-remplacement de ntfy et du feed ServiceDesk) doivent être inscrites en HS-AGT-002..005 dans le même amendement, sinon elles se perdent au premier réexamen.

DRIFT 4 — 🟠 Aucune règle d'affaires du BRD ne couvre la garde du secret côté poste. Le design impose que le jeton Slack vive au trousseau, jamais dans un dépôt ni un profil partagé, et que le veilleur n'expose aucun point d'entrée réseau. Le cadre invoqué (règle d'or n°12 / STD-038) est EXTERNE au BRD et vise les clés Supabase à droits élevés, pas un jeton d'outillage de poste. Une RA-DIS-005 (ou RA-AGT-005) est à créer pour rendre la contrainte opposable au grain de cette app.

DRIFT 5 — 🟡 Référence croisée fausse dans la demande. La description écrit : « Chaque agent poste sous son propre nom et son propre avatar (`D-20260805-0001`) ». Or D-20260805-0001 est « [DEBT] Rattraper la mise à jour du somtech-pack (1.10.0 → 1.27.0) » sur l'application ServiceDesk Somtech — sans rapport avec l'identité ou l'avatar d'un agent. Vérifié par lecture de la liste des demandes du 2026-08-05. Soit le code est erroné, soit la source réelle est ailleurs : à corriger dans la description de la demande avant découpage, une story ne doit pas hériter d'une référence fausse.

DRIFT 6 — 🟡 Colonne « Réalisé par » vide sur TOUTES les EF du BRD (DIS, DIA, AGT). La traçabilité EF → travail livré n'est donc établie nulle part côté BRD, alors que c'est l'objet du problème P-04 que le BRD lui-même énonce (« sans référentiel d'exigences, chaque évolution est décidée au cas par cas → pas de traçabilité entre le besoin et le travail livré »). Non bloquant pour ce découpage, mais l'amendement est l'occasion de renseigner au moins les EF touchées.

DRIFT 7 — 🟢 Le pointeur ServiceDesk expose `brd_yaml_document_id: null`. Conforme au nouveau régime (le brd.yaml n'est plus stocké, la projection se calcule à la demande depuis le BRD.md) — signalé pour lever toute lecture erronée en « BRD incomplet ». Le BRD.md source, lui, est bien présent et a été lu intégralement.

AUCUN code d'exigence introuvable : la demande ne cite aucun code EF/RA/HS. Le drift n'est pas un code cassé, c'est un TROU de référentiel sur la capacité centrale (DRIFT 1).

## Limites de l'analyse — ce qui n'est PAS vérifié

GRAIN — `module_id` est NULL sur la demande : grain application pur, rétro-compat stricte. `brd_resolved_from` forcé à 'application' conformément à la consigne (le serveur omet le champ dans ce cas). Aucun fallback module→app n'a été déclenché, donc aucun avertissement de grain à porter au découpage.

CE QUI EST VÉRIFIÉ DIRECTEMENT (fiabilité haute) :
- Demande D-20260805-0004 (UUID 86713d68-6679-41d8-9d54-0a56db1698a2) lue via MCP ServiceDesk, action `get`. Statut `received`, 0 epic, 0 ticket direct, 0 commentaire, 0 pièce jointe — le découpage part d'une page blanche.
- Pointeur BRD lu via MCP : `brd_document_id` = dedb3032-725e-4128-b4f4-2099dd1a5042, version 0.5.0, posé le 2026-07-27.
- BRD.md source LU INTÉGRALEMENT via Somcraft (`/business-requirements/somtech-pack/BRD.md`, 21 074 octets, fingerprint da656790…). Toutes les EF/RA/HS citées ci-dessus sont recopiées de la source, pas reconstituées de mémoire.
- Le dépôt courant EST le dépôt applicatif de cette demande (cwd = worktree de somtech-pack, application_id concordant) — la règle d'or n°7 n'est donc pas en tension, et les faits de code ci-dessous sont vérifiés en lecture directe : `pack.json` v1.27.0 et son module `canvas` (`scope: "poste"`, `paths: ["herdr-plugins/"]`), `cli/src/posteonly.js` (installation des modules de portée poste dans `~/.somtech`), `cli/src/cli.js` (options `--dest`, `--no-canvas`), présence de `docs/superpowers/specs/2026-08-05-ligne-directe-slack-design.md` (90 lignes, lu intégralement), et ABSENCE de tout code `ligne-directe`/veilleur/commande locale dans le dépôt (recherche par grep, seul le design doc ressort).

CE QUI N'EST PAS VÉRIFIÉ — à ne pas traiter comme acquis au découpage :
- ⚠️ `herdr agent prompt` — la commande d'injection dans un pane, pierre angulaire du sens Slack → agent. herdr vit HORS de ce dépôt ; ni sa signature, ni son comportement sur les apostrophes/retours à la ligne, ni l'existence d'une commande d'inventaire des agents vivants n'ont été confirmés. Le design doc l'affirme comme « piège déjà documenté dans /orchestrer-chantier » — repris tel quel, NON VÉRIFIÉ. EF-AGT-002 impose précisément que les commandes soient décrites telles qu'elles existent : une story de vérification de la surface herdr réelle est un préalable, pas un détail.
- ⚠️ API Slack — l'emprunt d'identité par message de bot (`username`/`icon_url`), le plafond de connexions socket par application, les droits requis pour créer/inviter/archiver un canal, et le comportement d'un canal archivé qui reçoit un message : AUCUN n'a été vérifié contre la documentation Slack. Les affirmations du design doc sur ces points sont des hypothèses de brainstorm. Sensibilité particulière : la date de coupure du modèle rend toute affirmation d'API de mémoire peu fiable — à confirmer sur la doc courante avant d'écrire les critères G/W/T.
- ⚠️ Espace de travail Slack Somtech — existence, droits d'administration, et si une application Slack Somtech est déjà installée : non vérifié. La demande suppose « une seule application installée une fois » ; l'installer peut nécessiter un geste du dirigeant, hors périmètre agent.
- ⚠️ Trousseau du poste — mécanisme retenu (`security` macOS ?), et si `pack setup` sait déjà y écrire ou lire : non vérifié dans `cli/`.
- ⚠️ Précédent launchd — la demande compare la portée d'installation à `claude-swt` et au canvas, mais AUCUN des deux n'est un processus permanent. Le veilleur l'est. Le patron de service permanent (plist launchd) existe ailleurs chez Somtech (ArchiBot, Likec4) mais PAS dans ce dépôt : le pack n'a aujourd'hui aucun mécanisme d'installation de service permanent. À traiter comme du neuf, pas comme une réplication du module `canvas`. C'est probablement l'unité de travail la plus risquée du chantier.
- ⚠️ La ligne « le veilleur n'expose aucun point d'entrée réseau » et « n'accepte d'instructions que des agents du poste » décrit une intention de design, pas un mécanisme mesuré (socket UNIX ? permissions ?). À spécifier avant qu'une story ne le déclare tenu.

RIEN N'A ÉTÉ ÉCRIT — lecture seule stricte : aucun appel MCP d'écriture, aucune modification de fichier, aucun statut de demande touché. La demande reste en `received`.

## Ordre recommandé (tel que proposé — contesté par la critique)

1. E0 — Le référentiel dit ce que la ligne directe doit faire (gouvernance BRD, préalable bloquant : 7 des 13 besoins n'ont aucune EF à citer aujourd'hui)
2. E1 — On ne code pas contre des hypothèses de brainstorm (3 spikes timeboxés + le geste humain d'installation de l'app, à ordonnancer maintenant et pas le jour où il bloquera E2)
3. E2 — « Je lis l'avancement de mon chantier sur mon téléphone » (sens sortant, aucun processus permanent — la plus petite tranche qui change quelque chose pour le dirigeant, et elle ne touche à rien de risqué)
4. E3 — « Je réponds depuis Slack et le chantier repart » (sens entrant + le processus permanent, unité la plus neuve du chantier)
5. E4 — « Je ne parle jamais dans le vide » (les quatre cas de rupture, dont la mort du veilleur, oubliée au design)
6. E5 — « N'importe quel poste Somtech peut ouvrir une ligne » (distribution, filets de CI, capacité non annoncée si inutilisable)
7. E6 — « Mon coordonnateur m'ouvre sa ligne sans que je le demande » (compétence, discipline de parole, câblage dans /orchestrer-chantier)

## Découpage Epic → Story

### E0 — Le référentiel dit ce que la ligne directe doit faire (gouvernance BRD, préalable bloquant)

**Problème** — Aucune des 12 EF du BRD somtech-pack v0.5.0 ne couvre la capacité centrale de la demande : « un agent joint le dirigeant hors de son poste et reçoit sa réponse ». Les EF existantes couvrent l'emballage (distribuer, installer, dépendances, fidélité aux commandes externes) et le contexte d'usage (piloter un chantier) — jamais la capacité elle-même. Sur les 13 besoins identifiables dans la demande, 7 n'ont aujourd'hui aucune EF à citer. Écrire une story du cœur maintenant produit soit un orphelin, soit une traçabilité de complaisance (rattachement forcé à EF-AGT-001 « piloter un chantier » ou à EF-DIS-004 « dépendances d'exécution »), ce que la règle d'or n°10 interdit. Deux arbitrages non tranchés bloquent en outre des unités de travail entières : le mécanisme de permanence relève-t-il de HS-DIS-001 (dépendances système du poste, hors-scope) ou de la capacité du pack ? et le multi-lignes annoncé contredit-il HS-AGT-001 ?

**Résultat attendu** — BRD somtech-pack porté de 0.5.0 à 0.6.0 dans Somcraft (BRD.md source édité via /brd, projection recalculée à la demande) : l'enjeu d'affaires porteur, les trois EF du cœur, EF-DIS-002 étendue aux services permanents, trois règles d'affaires (secret d'outillage au trousseau, preuve de remise, identifiant durable), l'extension de RA-AGT-004 aux identifiants de canal, les quatre hors-scope tranchés au brainstorm, et les deux arbitrages écrits noir sur blanc. À la sortie de E0, chaque story des epics suivants a une EF réelle à citer.

**Hors-scope** — Toute ligne de code — aucun fichier du dépôt n'est touché par cet epic. La création d'un nouveau domaine BRD (la capacité est une capacité d'agent : elle s'inscrit dans le domaine AGT existant, le BRD dit lui-même que l'absence d'un domaine n'est pas un hors-scope). Le remplissage rétroactif de la colonne « Réalisé par » sur les EF non touchées par ce chantier. Aucune écriture dans le BRD depuis le dépôt Architecture ni par l'architecte : l'amendement se fait dans le contexte de l'app, via Somcraft.

#### Corriger la référence croisée fausse portée par la demande avant qu'une story n'en hérite

- *Réalisé par* : N-A — hygiène de la demande (STD-030, principe réalité-miroir). Seule story de tout le découpage sans EF, et c'est assumé : le BRD encadre le produit, pas le contenu d'une demande ServiceDesk. À ne pas maquiller en traçabilité de complaisance.
- *Niveau de test* : N-A (gouvernance ServiceDesk — vérifiable par relecture de la demande)
- **Étant donné** La description de D-20260805-0004 attribue l'emprunt d'identité des agents à `D-20260805-0001`, alors que cette demande porte en réalité sur un rattrapage de version du pack sur une autre application (vérifié à la source par deux analyses indépendantes)
- **Quand** On relit la description de la demande avant d'ouvrir le moindre epic
- **Alors** Aucune référence croisée de la description ne pointe vers un objet sans rapport : chaque code cité (D-…, P-…, E-…, T-…) désigne bien ce que la phrase lui fait dire, ou la mention est retirée. Aucune story du découpage ne cite `D-20260805-0001`.

#### Inscrire l'enjeu d'affaires : le dirigeant tranche ce qui l'attend sans être devant son écran

- *Réalisé par* : EA-GBL-005 (À CRÉER) — « Le dirigeant suit et débloque un chantier sans être devant l'écran de son poste de travail. » Aucune des 4 EA existantes ne porte cette valeur : GBL-001 (installer en une commande), GBL-002 (règles opposables mécaniquement), GBL-003 (capacité annoncée = disponible), GBL-004 (artefacts visuels éditables).
- *Niveau de test* : N-A (gouvernance BRD — vérifiable sur la projection structurée)
- **Étant donné** Le BRD somtech-pack en version 0.5.0, dont aucun enjeu d'affaires ne parle de joignabilité du dirigeant
- **Quand** On extrait la projection structurée du BRD après amendement
- **Alors** EA-GBL-005 y figure, et chaque EF créée ou amendée par cet epic la cite dans sa colonne « Couvre » — aucune EF nouvelle de ce chantier ne sort de E0 avec une colonne « Couvre » vide.

#### Créer l'exigence de la ligne bidirectionnelle — la capacité centrale de la demande

- *Réalisé par* : EF-AGT-003 (À CRÉER) — « Un agent ouvre, tient et ferme une ligne de discussion bidirectionnelle avec le dirigeant hors de son poste de travail : il y pousse ce qu'il a à dire, et la réponse du dirigeant lui parvient dans son fil de travail comme s'il l'avait tapée. »
- *Niveau de test* : N-A (gouvernance BRD — vérifiable sur la projection structurée)
- **Étant donné** Une demande dont le cœur est une conversation agent ↔ dirigeant, et un BRD qui n'a aucune exigence de joignabilité
- **Quand** On relit l'énoncé de EF-AGT-003 après amendement
- **Alors** L'énoncé couvre explicitement LES DEUX SENS (l'agent pousse, le dirigeant répond) ET ne nomme aucun outil de transport — ni Slack, ni herdr : le design pose que si le transport change, le geste ne bouge pas. Les stories des epics E2 et E3 peuvent la citer sans reformulation.

#### Créer l'exigence de discipline de parole, et ce qu'elle n'abroge pas

- *Réalisé par* : EF-AGT-004 (À CRÉER) — « Un agent ne porte sur la ligne que ce qui appelle une décision et ses jalons ; ce qui est opposable — statuts, décisions, comptes rendus — continue de vivre dans le registre de suivi, et tout arbitrage reçu sur la ligne y est réinscrit par l'agent qui l'a reçu. » Couvre EA-GBL-002 et EA-GBL-005.
- *Niveau de test* : N-A (gouvernance BRD — vérifiable sur la projection structurée)
- **Étant donné** Un canal de conversation qui, sans discipline écrite, absorberait les statuts, les PR et les ouvertures/fermetures d'agents — et qu'on cesserait de lire
- **Quand** On relit l'énoncé de EF-AGT-004 après amendement
- **Alors** L'énoncé nomme ce qui va sur la ligne (arbitrage produit, risque assumé, dépense, blocage ; ouverture, epic livré, clôture), ce qui n'y va pas (statuts, PR, cycle de vie des agents), ET l'obligation de réinscrire au ServiceDesk un arbitrage tranché dans la conversation.

#### Créer l'exigence « une ligne fermée répond au lieu d'avaler le message »

- *Réalisé par* : EF-AGT-005 (À CRÉER) — « Un message adressé à une ligne close, à un agent disparu, ou reçu pendant que le veilleur est arrêté, reçoit une suite explicite : il n'est jamais avalé en silence. » Couvre EA-GBL-005 et EA-GBL-003. C'est aussi elle qui donne une exigence au choix d'architecture du veilleur unique (il survit à ses agents).
- *Niveau de test* : N-A (gouvernance BRD — vérifiable sur la projection structurée)
- **Étant donné** Trois cas de rupture tenus par le design (ligne close, agent mort sans fermer, redémarrage du poste) et un quatrième absent du design (le veilleur lui-même meurt)
- **Quand** On relit l'énoncé de EF-AGT-005 après amendement
- **Alors** L'énoncé couvre les QUATRE cas, y compris la mort du veilleur — symétrique oublié au brainstorm — et l'epic E4 peut tracer chacune de ses stories dessus.

#### Étendre EF-DIS-002 aux services permanents et trancher HS-DIS-001 par écrit

- *Réalisé par* : EF-DIS-002 (À AMENDER) — l'énoncé actuel couvre « compétences et workflows globaux, lanceur de session, réservations de ports » ; ni claude-swt (fonction shell sourcée) ni le canvas (serveur démarré à la demande) n'est un processus permanent. Ajouter : « …, services permanents des capacités du pack) en une commande, et arrêter ou reprendre ces services sans perdre leur état. » + arbitrage HS-DIS-001.
- *Niveau de test* : N-A (gouvernance BRD + arbitrage écrit)
- **Étant donné** Un veilleur qui est un PROCESSUS PERMANENT, et un hors-scope qui exclut « les dépendances système du poste (runtime, gestionnaire de versions, outil de session) »
- **Quand** On relit EF-DIS-002 amendée et l'arbitrage inscrit au §hors-scope
- **Alors** Il est écrit si enregistrer un service auprès du gestionnaire de services du poste relève de la capacité du pack (dans le scope) ou de la dépendance système (hors-scope, geste manuel documenté) — et EF-DIS-002 décrit la story « faire vivre le veilleur » au lieu de l'accueillir par défaut. Aucune story de E3 n'est briefée avant que cet arbitrage soit écrit.

#### Rendre opposable la garde du secret d'outillage de poste

- *Réalisé par* : RA-AGT-005 (À CRÉER) — « Le secret qui autorise une capacité de poste à joindre un service externe vit dans le trousseau du poste : jamais dans un dépôt, jamais dans un fichier de configuration versionné, jamais dans une variable exportée par un profil partagé. Une capacité de poste n'expose aucun point d'entrée au-delà du poste. » Encadre EF-AGT-003 et EF-DIS-002.
- *Niveau de test* : N-A (gouvernance BRD)
- **Étant donné** Un design qui invoque la règle d'or n°12 / STD-038, cadre EXTERNE au BRD et qui vise les clés Supabase à droits élevés — pas un jeton d'outillage de poste
- **Quand** On cherche, dans le BRD v0.6.0, la règle opposable au grain de cette application
- **Alors** RA-AGT-005 existe et couvre les DEUX jetons du mode d'écoute permanent (jeton d'application ET jeton de robot — le « un seul jeton derrière » de la demande est faux et doit être corrigé dans le design doc au passage), sans quoi la contrainte de sécurité du design n'est opposable nulle part.

#### Rendre opposables la preuve de remise et l'identifiant durable, et étendre RA-AGT-004 aux canaux

- *Réalisé par* : RA-AGT-006 (À CRÉER) « Un message réputé transmis à un agent a été vérifié transmis — on ne se fie pas au code retour de l'outil qui l'a transmis » + RA-AGT-007 (À CRÉER) « L'appariement d'une ligne ne repose jamais sur un identifiant volatil » + RA-AGT-004 (À AMENDER, extension de portée aux identifiants de canal).
- *Niveau de test* : N-A (gouvernance BRD)
- **Étant donné** Deux modes de panne mesurés : (a) l'outil d'injection répond succès alors que le message est resté collé dans le champ de saisie sans être soumis — reproduit trois fois dans une même session le 2026-08-03 ; (b) les identifiants de pane se compactent à la fermeture d'un pane et ne sont pas durables
- **Quand** On relit les règles d'affaires du BRD v0.6.0
- **Alors** RA-AGT-006 et RA-AGT-007 existent, chacune avec sa justification factuelle inscrite, ET RA-AGT-004 mentionne la seconde frontière de casse (l'outil de conversation impose des noms de canaux en minuscules, la convention Somtech écrit ses codes en majuscules) — de sorte qu'aucune story n'ait à porter ces contraintes en simple note d'implémentation.

#### Inscrire les quatre exclusions du brainstorm et lever la tension avec HS-AGT-001

- *Réalisé par* : HS-AGT-002 à HS-AGT-005 (À CRÉER) : pas de boutons/menus/formulaires — un arbitrage se tranche en écrivant ; pas de partage de fichiers ni d'images ; aucun destinataire autre que le dirigeant (pas de multi-destinataire, pas de canal client) ; la ligne ne remplace ni les alertes d'infrastructure ni le feed d'équipe. + HS-AGT-001 (À PRÉCISER).
- *Niveau de test* : N-A (gouvernance BRD)
- **Étant donné** Quatre exclusions tranchées au brainstorm mais absentes du BRD (le §6 ne contient que HS-DIS-001, HS-DIA-001, HS-AGT-001), et un hors-scope accepté qui exclut plusieurs chantiers de front sur un MÊME dépôt alors que la demande annonce trois chantiers actifs
- **Quand** On relit le §hors-scope du BRD v0.6.0
- **Alors** Les quatre exclusions y figurent — dont « aucun destinataire autre que le dirigeant », qui est aussi ce qui borne l'exposition de données client — ET HS-AGT-001 précise que le multi-lignes simultanées vaut pour des chantiers portés par des dépôts DISTINCTS, de sorte que la demande ne lise plus comme une contradiction d'un hors-scope accepté.

### E1 — On ne code pas contre des hypothèses de brainstorm (spikes timeboxés + prérequis humain)

**Problème** — Trois piliers du design ne sont vérifiés nulle part. (a) Ce que l'outil de conversation permet vraiment — emprunt d'identité sur un message de bot, droits requis pour créer/inviter/archiver un canal, mode d'écoute et son plafond de connexions, sort d'un message envoyé à un canal archivé — n'a jamais été confronté à la documentation courante ; et une contradiction est déjà visible dans le design (on ne peut pas à la fois archiver le canal à la clôture ET y répondre ensuite, un canal archivé étant en lecture seule). (b) La forme d'appel réelle de la commande d'injection et ce qui permet de conclure « cet agent est vivant » ne sont pas établis : le garde-fou de fidélité du dépôt prouve l'existence des commandes, jamais leurs drapeaux ni leurs arguments. (c) Où vit un processus permanent sur ce poste : le dépôt n'a AUCUN précédent — le canvas démarre à la demande, le lanceur de session est une fonction shell. Écrire un critère d'acceptation sur l'un de ces points aujourd'hui, c'est écrire un test décoratif.

**Résultat attendu** — Trois livrables courts et opposables (un REF par outil externe, un ADR pour l'habitat du processus permanent et le point d'entrée local), plus l'application de conversation installée par le dirigeant avec ses deux jetons au trousseau. À la sortie de E1, chaque critère d'acceptation des epics suivants s'appuie sur un fait mesuré ou une source citée, et deux arbitrages structurants sont pris : archivage vs réponse à une ligne close, et vecteur de livraison de la compétence.

**Hors-scope** — Tout code de production du veilleur ou de la commande locale — les spikes livrent des faits, des tables et un veilleur bidon jetable, pas la capacité. Le choix d'implémentation entre bibliothèque officielle et appels directs est instruit ici (empreinte du paquet publié : chaque poste la porte) mais mis en œuvre en E2.

#### SPIKE (½ journée) — Ce que l'outil de conversation permet vraiment

- *Réalisé par* : EF-AGT-002 (existante, accepted) — « Une capacité du pack qui pilote un outil externe en décrit les commandes telles qu'elles existent réellement dans cet outil. »
- *Niveau de test* : N-A (spike — livrable REF, condition de fin observable)
- **Étant donné** Un espace de travail de test et un jeton créé pour l'occasion ; aucune affirmation du design doc sur l'API n'a été vérifiée, et la date de coupure du modèle rend toute affirmation d'API produite de mémoire irrecevable
- **Quand** On exécute la sonde du spike contre l'espace de test et qu'on confronte chaque point à la documentation courante
- **Alors** Un message est visible dans un canal de test sous un nom et un avatar d'emprunt, ET le REF consigne — chaque fait avec sa source ou sa mesure, aucun de mémoire : les portées exactes requises (poster, emprunter l'identité, créer, inviter, archiver, lire l'historique), le mode d'écoute retenu et son plafond de connexions par application, la contrainte de nommage d'un canal et les erreurs qu'elle produit, le comportement d'un message envoyé à un canal archivé, et si le nom d'un canal archivé reste réservé. Le REF tranche explicitement la contradiction du design : comment une ligne close peut répondre alors que l'archivage rend le canal muet (délai de grâce, annonce avant archivage, ou renommage sans archivage).

#### SPIKE — La surface réelle de l'outil de session, et ce qui prouve qu'un agent est vivant

- *Réalisé par* : EF-AGT-002 (existante, accepted) + RA-AGT-006 (créée en E0) — la table de fidélité du dépôt prouve aujourd'hui l'existence des commandes, jamais leur forme d'appel.
- *Niveau de test* : unit (CI — extension de la table de fidélité existante, rouge avant, verte après)
- **Étant donné** Une table de commandes relevée sur le binaire qui prouve l'existence de l'injection et de l'inventaire des agents, mais qui ne contrôle ni drapeaux ni arguments — un appel inventé passerait le gate sans broncher
- **Quand** On relève la surface réellement utile à la ligne et qu'on l'inscrit dans la table de fidélité
- **Alors** Le REF consigne : la forme d'appel réelle de l'injection (fichier ? entrée standard ? multi-ligne ?), ce que l'inventaire des agents permet de conclure sur un agent DISPARU (absent de la liste ou présent dans un état particulier), le sort d'un prompt soumis à un agent occupé, le symptôme du message resté collé et le geste qui le débloque. ET un test rougit si une commande citée dans le contenu livré n'existe pas sur le binaire installé.

#### SPIKE — Où vit un processus permanent sur le poste, et par où on lui parle

- *Réalisé par* : EF-DIS-002 (amendée en E0) + RA-AGT-005 (créée en E0) — « aucun point d'entrée réseau » est une intention de design, pas un mécanisme : tel quel, aucune story ne peut le déclarer tenu.
- *Niveau de test* : N-A (spike — livrable ADR, condition de fin observable)
- **Étant donné** Aucun mécanisme de service permanent n'existe dans le dépôt (le canvas démarre à la demande et se rattache s'il tourne déjà, le lanceur de session n'est qu'un bloc dans le fichier de démarrage du shell) et le précédent Somtech invoqué vit dans un autre dépôt, interdit en écriture
- **Quand** On instruit les trois habitats réels — service du gestionnaire du poste, plugin de l'outil de session avec pane possédé, démarrage paresseux idempotent sur le patron du canvas — puis qu'on monte un veilleur bidon dans celui qu'on retient
- **Alors** Le veilleur bidon survit à la fermeture de la session qui l'a démarré ET à un redémarrage du poste, ET l'ADR tranche par écrit : (1) l'habitat retenu et sa frontière avec HS-DIS-001, (2) le point d'entrée local (socket local à permissions restreintes, ou boucle locale avec garde d'origine sur le patron déjà durci du serveur du canvas) de sorte que « n'accepte d'instructions que des agents du poste » devienne vérifiable par un test, (3) le vecteur de livraison de la compétence (compétence du module core → EF-DIS-001, ou commande slash → EF-DIS-005 : ni la même EF, ni le même répertoire, ni le même test).

#### Installer l'application de conversation et déposer ses deux jetons au trousseau (geste du dirigeant)

- *Réalisé par* : EF-AGT-003 (créée en E0) + RA-AGT-005 (créée en E0) — dépendance humaine à droits d'administration : aucun agent ne peut la livrer. Nommée comme story pour qu'elle soit visible dans le ServiceDesk plutôt que de bloquer silencieusement E2 le jour de son exécution.
- *Niveau de test* : N-A (prérequis humain — vérifiable par la sonde de diagnostic livrée en E2)
- **Étant donné** Le REF du premier spike, qui liste les portées exactes à accorder, et le fait établi que le mode d'écoute permanent exige DEUX jetons distincts (application et robot) — pas un seul comme l'affirme la demande
- **Quand** Le dirigeant crée l'application dans l'espace Somtech, lui accorde les portées listées, et dépose les deux jetons au trousseau du poste sous les noms convenus
- **Alors** Les deux jetons sont récupérables depuis le trousseau sous les noms convenus, aucun n'apparaît dans un dépôt, un fichier de configuration versionné ou une variable exportée par un profil partagé, ET les portées effectivement accordées sont identiques à celles que le REF exigeait — écart consigné le cas échéant.

### E2 — « Je lis l'avancement de mon chantier sur mon téléphone » (le sens sortant, sans processus permanent)

**Problème** — Aujourd'hui, savoir où en est un chantier — ou débloquer un arbitrage qu'il attend — exige d'être devant l'écran, dans le bon pane. Le design décrit l'état final (un processus permanent) et la demande le place en pièce n°1 ; or la première valeur perçue par le dirigeant n'en a aucun besoin. Ouvrir, dire, demander, fermer sont des appels ponctuels plus un registre sur disque. Commencer par le veilleur, c'est attaquer l'unité la plus risquée en premier et ne produire aucune valeur observable avant la troisième livraison.

**Résultat attendu** — Un agent ouvre sa ligne, rapporte, sollicite un arbitrage et referme ; le dirigeant lit tout depuis son téléphone, sous le nom et l'avatar de l'agent — trois chantiers actifs, trois interlocuteurs distincts à l'œil. Rien ne part en silence : service injoignable ou jeton absent, la commande échoue bruyamment côté agent, et aucune ligne fantôme n'est inscrite au registre.

**Hors-scope** — Le sens entrant (le dirigeant écrit → l'agent lit) et donc tout processus permanent : E3. Les cas de rupture (ligne close qui répond, agent mort, redémarrage) : E4. La distribution par le pack — tout s'exécute ici depuis le dépôt : E5. Boutons, menus et formulaires ; fichiers et images ; tout destinataire autre que le dirigeant (HS-AGT-002 à 005, inscrits en E0).

#### Le jeton vit au trousseau, et la CI refuse qu'il en sorte

- *Réalisé par* : RA-AGT-005 (créée en E0) — le lint de secrets existant ne cherche aujourd'hui qu'une forme d'en-tête d'autorisation en JSON dans les fichiers .md/.tpl/.json : un jeton collé dans un .js ou un .sh passerait la CI sans un bruit.
- *Niveau de test* : unit (CI, scripts/tests/ — rouge avant l'extension du lint, vert après)
- **Étant donné** Un jeton de l'outil de conversation collé en dur dans un fichier de code du veilleur, et le lint de secrets dans son état actuel
- **Quand** La CI s'exécute sur la branche
- **Alors** La CI échoue en nommant le fichier et la ligne fautifs (le lint reconnaît désormais les motifs de jetons de l'outil et scanne aussi les extensions de code et de script) ; et sur un arbre sans jeton en dur, la CI passe. Au démarrage, la commande locale lit ses deux jetons depuis le trousseau et ne les journalise jamais, même en cas d'erreur.

#### Le registre apparie chantier, canal et agent sur une clé qui survit

- *Réalisé par* : RA-AGT-007 (créée en E0) + RA-AGT-004 (amendée en E0). Défaut de conception relevé et non vu au brainstorm : certains agents n'ont AUCUN nom dans l'inventaire, et les identifiants de pane se compactent à la fermeture d'un pane. Ni le nom ni le pane ne peuvent servir de clé.
- *Niveau de test* : unit (CI, cli/test/ — testable sans réseau ni outil de session)
- **Étant donné** Une ligne inscrite au registre avec un identifiant de chantier en majuscules (convention Somtech) et un identifiant de canal normalisé en minuscules (contrainte de l'outil de conversation), pour un agent dont l'outil de session porte le nom en minuscules
- **Quand** On interroge le registre dans les deux sens — du chantier vers le canal, et du canal vers l'agent — avec des identifiants en casse mixte, puis on ferme et recrée le pane de l'agent avant de relire
- **Alors** La même ligne est retrouvée dans les deux sens et dans toutes les casses, ET elle pointe toujours le bon agent après recréation du pane — parce qu'aucun identifiant volatil n'est stocké comme clé. Un test échoue si la clé retenue est le nom de l'agent ou l'identifiant de pane.

#### Le registre survit à une mise à jour du pack

- *Réalisé par* : RA-DIS-003 (existante) — la voie d'installation des modules de portée poste ne reçoit aujourd'hui aucune liste de préservation ; le registre n'est protégé que par omission (le moteur n'écrit que les fichiers du paquet), jamais par contrat ni par test.
- *Niveau de test* : unit (CI, cli/test/ — rouge avant, vert après)
- **Étant donné** Un registre peuplé de lignes ouvertes sur le poste
- **Quand** On rejoue l'installation poste du pack, y compris avec un fichier du paquet qui porterait le même nom que le fichier de registre
- **Alors** Le registre est intact et aucune ligne ouverte n'est perdue — le registre vit hors de l'arborescence installée du module, et un test le prouve en tentant précisément la collision de chemin. La règle n'est pas respectée à la lettre par accident : elle est tenue par un test.

#### Ouvrir une ligne : le canal existe, le dirigeant est dedans, et l'agent parle en son nom

- *Réalisé par* : EF-AGT-003 (créée en E0) + EF-DIS-004 (existante, accepted) + RA-DIS-001 (existante) — première story qui appelle le service externe : sa résilience se livre avec elle, pas plus tard.
- *Niveau de test* : intégration (CI, contre une doublure du service ; plus une passe de fumée manuelle documentée sur l'espace réel — ce dépôt n'a pas de runner qa-hybrid)
- **Étant donné** Un chantier dont l'identifiant est en majuscules et contient des caractères que l'outil de conversation refuse dans un nom de canal, et un poste où les deux jetons sont au trousseau
- **Quand** L'agent invoque l'ouverture de sa ligne
- **Alors** Un canal dédié existe sous un nom normalisé accepté par l'outil, le dirigeant y est invité, le message d'ouverture y est visible sous le NOM et l'AVATAR de l'agent (pas sous une identité générique), et la ligne est inscrite au registre. ET si le nom est déjà pris ou refusé, la commande le dit et propose un nom valide au lieu d'échouer sèchement. ET si le service est injoignable ou un jeton absent, la commande sort en erreur non nulle, nomme la cause et ce qui manque, et n'inscrit AUCUNE ligne au registre — pas de ligne fantôme, pas de succès silencieux.

#### Dire : un jalon franchi apparaît dans le canal, ou l'agent apprend qu'il n'est pas parti

- *Réalisé par* : EF-AGT-003 (créée en E0) + EF-DIS-004 (existante).
- *Niveau de test* : intégration (CI, doublure du service)
- **Étant donné** Une ligne ouverte et un message de jalon comportant des apostrophes, des guillemets et des retours à la ligne
- **Quand** L'agent invoque `dire`
- **Alors** Le message apparaît intact dans le canal, sous le nom et l'avatar de l'agent ; et quand la doublure refuse ou ne répond pas, la commande sort en erreur non nulle avec la cause — un rapport perdu en silence est pire qu'un rapport qui échoue.

#### Demander : l'agent sollicite un arbitrage sans se bloquer lui-même

- *Réalisé par* : EF-AGT-003 (créée en E0) + EF-AGT-004 (créée en E0) — ambiguïté à trancher noir sur blanc : si la commande attendait la réponse, l'agent serait occupé dans un appel d'outil au moment où elle arrive, et l'injection ne serait consommée qu'à la fin d'un tour qui, lui, attend la commande — blocage mutuel.
- *Niveau de test* : intégration (CI, doublure du service)
- **Étant donné** Une ligne ouverte et aucun message du dirigeant en attente
- **Quand** L'agent invoque `demander` pour solliciter un arbitrage
- **Alors** La commande rend la main AVANT qu'une réponse n'existe (mesuré : elle se termine alors que la doublure n'a rien posté en retour), la sollicitation est visible dans le canal et distinguée d'un simple compte rendu, et l'agent peut terminer son tour. Aucun appel ne reste en attente côté agent.

#### Fermer une ligne : bilan posté, ligne close au registre

- *Réalisé par* : EF-AGT-003 (créée en E0) + EF-AGT-005 (créée en E0) — symétrie de l'ouverture : l'epic ne se ferme pas sans son geste inverse.
- *Niveau de test* : intégration (CI, doublure du service ; plus passe de fumée manuelle)
- **Étant donné** Une ligne ouverte avec des messages échangés
- **Quand** L'agent invoque la fermeture de sa ligne
- **Alors** Un bilan est posté dans le canal AVANT toute action de clôture, la ligne passe à l'état fermé dans le registre en conservant de quoi répondre à une écriture tardive, et le sort du canal suit exactement l'arbitrage tranché par le REF de E1 (archivage immédiat, délai de grâce, ou annonce puis archivage) — l'ordre des opérations est celui du REF, pas une reprise littérale du design doc, qui promettait deux comportements incompatibles.

### E3 — « Je réponds depuis Slack et le chantier repart » (le sens entrant)

**Problème** — Le sens sortant seul laisse le dirigeant spectateur : un chantier bloqué sur un arbitrage reste bloqué. Le sens entrant est ce qui débloque — et c'est lui, et lui seul, qui exige un processus permanent, l'unité la plus neuve du chantier. Deux pièges y sont déjà mesurés : l'injection dans un pane répond succès alors que le message est resté collé dans le champ de saisie sans être soumis (reproduit trois fois dans une même session), et l'injection casse sur les apostrophes et les retours à la ligne.

**Résultat attendu** — Le dirigeant écrit dans le canal depuis son téléphone ; sa réponse atterrit dans le pane de l'agent comme s'il l'avait tapée, et l'agent reprend. Aucun message n'est réputé transmis sans preuve, et deux chantiers ouverts en parallèle ne se mélangent jamais.

**Hors-scope** — Les cas de rupture — ligne close, agent disparu, veilleur arrêté, redémarrage du poste : E4. La distribution par le pack : E5. La discipline de parole : E6.

#### Le veilleur vit, meurt et revient dans l'habitat retenu

- *Réalisé par* : EF-DIS-002 (amendée en E0, services permanents) + EF-DIS-004 (existante). ⚠️ Unité la plus risquée du chantier : le dépôt n'a aucun mécanisme de service permanent, et le module canvas n'en est pas un précédent (serveur démarré à la demande) — à traiter comme du neuf, jamais comme une réplication.
- *Niveau de test* : intégration (CI pour ce qui est simulable ; condition de fin observée sur le poste, documentée)
- **Étant donné** L'habitat tranché par l'ADR de E1 et un veilleur installé
- **Quand** La session qui l'a démarré se ferme, puis le poste redémarre
- **Alors** Le veilleur est de nouveau joignable sans geste manuel ; et si un jeton manque au trousseau, il refuse de démarrer en le disant (journal explicite + sortie non nulle) plutôt que de tourner à vide en laissant croire que la ligne est tenue.

#### Le veilleur n'accepte d'instructions que du poste, et c'est vérifiable

- *Réalisé par* : RA-AGT-005 (créée en E0) — « n'expose aucun point d'entrée réseau » est aujourd'hui une intention ; le mécanisme retenu par l'ADR de E1 la rend testable, sur le patron déjà durci du serveur du canvas (écoute bornée à la boucle locale, garde d'origine sur chaque requête, refus des types de contenu inattendus, chacun couvert par un test).
- *Niveau de test* : unit + intégration (CI)
- **Étant donné** Un veilleur en fonctionnement et le point d'entrée local retenu par l'ADR
- **Quand** On tente de lui adresser une instruction depuis l'extérieur du poste, et qu'on sonde les points d'écoute ouverts
- **Alors** L'instruction extérieure est refusée, et aucun point d'écoute n'est accessible au-delà du poste — les deux constats sont produits par un test qui échoue si la garde est retirée.

#### Le message du dirigeant arrive entier, et sa remise est prouvée

- *Réalisé par* : EF-AGT-003 (créée en E0) + RA-AGT-006 (créée en E0) + EF-AGT-002 (existante) — la résilience de l'injection se livre AVEC la première story qui l'utilise : le patron « écrire dans un fichier, n'injecter qu'une référence » est déjà pratiqué à la main pour livrer les briefs, et la parade au message collé existe hors du pack et doit y entrer.
- *Niveau de test* : intégration (CI, doublure du pane reproduisant le symptôme du message collé)
- **Étant donné** Un message du dirigeant contenant apostrophes, guillemets et retours à la ligne, et un pane dont la doublure reproduit le symptôme connu (l'injection répond succès mais le texte reste collé sans être soumis)
- **Quand** Le veilleur délivre le message à l'agent
- **Alors** Le message est écrit dans un fichier situé au poste, HORS de tout dépôt de travail (aucun message du dirigeant ne salit le worktree d'un agent ni ne risque d'être committé), une référence courte d'une seule ligne est injectée, le contenu lu par l'agent est identique caractère pour caractère au message posté, ET le veilleur relit le pane après injection : il constate la non-soumission, la corrige, et si la remise reste impossible il sort en échec et le dit dans le canal. Aucun message n'est compté comme délivré sur le seul code retour de l'outil.

#### Le bon agent reçoit le bon message, même quand trois chantiers sont ouverts

- *Réalisé par* : RA-AGT-007 + RA-AGT-004 (créée/amendée en E0) — le registre EST la table de correspondance d'identifiants d'agents que RA-AGT-004 vise ; un appariement fautif ne produit aucune erreur, il livre le message au mauvais agent, ou à un shell nu.
- *Niveau de test* : intégration (CI, doublure du service + doublure du pane)
- **Étant donné** Deux lignes ouvertes simultanément sur des chantiers portés par des dépôts DISTINCTS (lecture explicitée de HS-AGT-001 en E0), dont l'un a son identifiant écrit dans une casse différente entre le registre et l'outil de session
- **Quand** Le dirigeant écrit dans chacun des deux canaux
- **Alors** Chaque message atteint l'agent de sa ligne et aucun n'atteint l'autre, quelle que soit la casse ; et avant d'injecter, le veilleur revalide que l'agent visé est bien celui que le registre désigne — un test échoue si cette revalidation est retirée.

#### L'agent occupé lit à sa prochaine respiration, sans rien perdre

- *Réalisé par* : EF-AGT-003 (créée en E0) + RA-AGT-006 (créée en E0).
- *Niveau de test* : intégration (CI, doublure du pane calée sur le comportement mesuré au spike 2 de E1)
- **Étant donné** Un agent en plein tour de travail
- **Quand** Le dirigeant écrit dans son canal
- **Alors** Rien n'est injecté au milieu d'une opération, ET le message n'est pas perdu : il est délivré — et constaté délivré par relecture du pane — au plus tard à la fin du tour en cours. Un test le prouve en soumettant pendant un tour simulé et en vérifiant la remise après.

### E4 — « Je ne parle jamais dans le vide » (la ligne ne perd aucun message)

**Problème** — Le pire mode de panne de cette capacité n'est pas l'erreur, c'est le silence. Un canal qui reste ouvert après la mort d'un agent, un message adressé à un chantier clos, un registre perdu au redémarrage : dans chaque cas le dirigeant écrit et rien ne se passe, sans qu'aucune erreur ne le lui dise. Le design tient trois de ces cas et en oublie un — le veilleur qui meurt lui-même, symétrique exact du cas déjà traité.

**Résultat attendu** — Toute écriture du dirigeant reçoit une suite : la réponse de son agent, ou une réponse du veilleur qui dit pourquoi il n'y en aura pas. C'est ce qui rend la ligne fiable au sens où on peut cesser de la surveiller.

**Hors-scope** — L'ajout de nouveaux gestes à la ligne. La distribution : E5. La discipline de parole : E6.

#### Un message adressé à une ligne close reçoit une réponse

- *Réalisé par* : EF-AGT-005 (créée en E0) — l'énoncé du design (« le veilleur répond lui-même que la ligne est fermée ») est intenable tel quel si le canal est archivé à la clôture, un canal archivé étant muet des deux côtés : le comportement livré suit l'arbitrage du REF de E1.
- *Niveau de test* : intégration (CI, doublure du service ; plus passe de fumée manuelle sur l'espace réel)
- **Étant donné** Une ligne fermée en E2 selon le mécanisme retenu par le REF de E1
- **Quand** Le dirigeant y écrit après la clôture
- **Alors** Il reçoit une suite visible pour lui — soit une réponse du veilleur disant que la ligne est close et vers quoi se tourner, soit l'impossibilité d'écrire assortie d'un motif lisible. Aucune écriture du dirigeant sur une ligne close ne reste sans suite.

#### Un agent qui meurt sans fermer n'abandonne pas de canal fantôme

- *Réalisé par* : EF-AGT-005 (créée en E0) — c'est ce cas qui justifie le choix d'architecture du veilleur unique : il survit à ses agents, donc il peut répondre « ce chantier est clos » plutôt qu'avaler le message.
- *Niveau de test* : intégration (CI, doublure de l'inventaire des agents calée sur la sémantique relevée au spike 2 de E1)
- **Étant donné** Une ligne ouverte dont l'agent a disparu sans la fermer, au sens de « disparu » établi par le spike 2
- **Quand** Le veilleur fait sa ronde
- **Alors** Le canal est clos avec une mention explicite indiquant que l'agent a disparu sans clore sa ligne, et la ligne est retirée du registre — le dirigeant n'a jamais devant lui un canal qui a l'air vivant et ne l'est pas.

#### Un veilleur qui meurt le dit aussi, dans les deux sens

- *Réalisé par* : EF-AGT-005 (créée en E0) + EF-DIS-004 (existante) — symétrique absent du design : il traite l'agent qui meurt, jamais le veilleur.
- *Niveau de test* : intégration (CI, doublure du service)
- **Étant donné** Le veilleur arrêté brutalement alors que des lignes sont ouvertes
- **Quand** Le dirigeant écrit pendant l'arrêt, et un agent invoque une commande locale pendant le même arrêt
- **Alors** À son retour, le veilleur rattrape les messages arrivés pendant son absence et les délivre (aucun n'est perdu) ; et la commande locale invoquée pendant l'arrêt échoue bruyamment côté agent en nommant la cause, au lieu de laisser croire à un envoi.

#### Le poste redémarre, les lignes reprennent

- *Réalisé par* : EF-AGT-005 (créée en E0) + EF-DIS-002 (amendée en E0) + RA-AGT-007 (créée en E0).
- *Niveau de test* : intégration (CI pour la relecture du registre ; condition de fin observée au poste, documentée)
- **Étant donné** Plusieurs lignes ouvertes, puis un redémarrage du poste
- **Quand** Le veilleur repart
- **Alors** Il relit le registre sur disque, reprend les lignes dont l'agent est encore vivant — l'appariement tenant sur la clé durable, pas sur un identifiant recréé au redémarrage — et clôt celles dont l'agent a disparu selon le comportement de la story précédente. Aucune ligne ne reste ni orpheline ni muette, et un message écrit pendant l'indisponibilité est délivré au retour.

### E5 — « N'importe quel poste Somtech peut ouvrir une ligne » (distribution et filets)

**Problème** — Tant que le veilleur et la commande locale vivent dans le dépôt, la capacité n'existe que sur le poste qui l'a écrite. Et le chemin de publication porte un piège vérifié : les dépendances d'exécution ne voyagent dans le paquet publié que sous l'arborescence des plugins ; ailleurs elles sont silencieusement exclues — le module partirait sans de quoi démarrer, et ni la CI ni la publication ne le verraient. Trois autres filets manquent : le drapeau qui désactive les outils de poste est aujourd'hui unique et partagé, le garde-fou de fidélité aux commandes externes ne scanne qu'une liste figée de dossiers, et les tests des plugins existants ne sont exécutés par aucun job de la CI.

**Résultat attendu** — `pack setup` installe le veilleur et la commande locale au poste avec leurs dépendances, refuse l'installation dans un projet, et n'annonce jamais une capacité inutilisable. La compétence descend dans tous les dépôts. Chaque test cité en preuve s'exécute à chaque changement.

**Hors-scope** — L'installation des dépendances système du poste (runtime, gestionnaire de versions, outil de session) — HS-DIS-001, sous réserve de l'arbitrage tranché en E0. Toute évolution fonctionnelle de la ligne.

#### Le module de portée poste est déclaré et embarqué depuis les sources, avec ses dépendances

- *Réalisé par* : EF-DIS-003 (existante, in_force) + RA-DIS-002 (existante) — « le paquet publié embarque le contenu de tous les modules déclarés, construit depuis les sources, jamais recopié à la main ».
- *Niveau de test* : unit (CI, cli/test/ — le test doit être ROUGE avant la correction du filtre de publication)
- **Étant donné** Le module de la ligne directe déclaré en portée poste dans le manifeste du pack, avec des dépendances d'exécution, à un emplacement que le filtre de publication actuel exclurait
- **Quand** La construction du paquet publié s'exécute
- **Alors** Le paquet contient le veilleur, la commande locale ET leurs dépendances d'exécution ; un test échoue si une dépendance d'exécution du module manque au paquet. Le mode de panne documenté (publication amputée et silencieuse) est reproduit par le test avant d'être corrigé.

#### L'installation poste dépose la ligne, la refuse dans un projet, et ne l'emporte pas avec le canvas

- *Réalisé par* : EF-DIS-002 (amendée en E0) — le drapeau qui désactive les outils de poste gouverne aujourd'hui TOUS les modules de portée poste derrière un seul booléen nommé d'après le canvas.
- *Niveau de test* : unit (CI, cli/test/)
- **Étant donné** Un poste et un projet, et la commande d'installation avec ses drapeaux
- **Quand** On lance l'installation poste, puis l'installation projet, puis l'installation poste en désactivant seulement le canvas
- **Alors** L'installation poste dépose le veilleur et la commande locale à leur emplacement de poste ; l'installation projet refuse explicitement le module en disant pourquoi ; et désactiver le canvas n'emporte pas la ligne directe (ni l'inverse) — chaque module de portée poste se désactive séparément.

#### Ce qui n'est pas utilisable n'est pas annoncé

- *Réalisé par* : RA-DIS-001 (existante) + EF-DIS-004 (existante, accepted) — « une capacité dont la dépendance d'exécution n'est pas distribuée n'est pas exposée à l'utilisateur ». Le mécanisme d'avertissement existe déjà côté installation poste et n'a qu'à recevoir les dépendances de la ligne.
- *Niveau de test* : unit (CI, cli/test/)
- **Étant donné** Un poste où le veilleur n'est pas installé, puis un poste où il l'est mais où un jeton manque au trousseau
- **Quand** L'installation poste s'exécute, et un agent tente d'ouvrir une ligne
- **Alors** Dans les deux cas, il est dit précisément ce qui manque et comment y remédier, et la capacité n'apparaît pas comme disponible à l'agent ; sur un poste complet, aucun avertissement alarmiste n'est produit.

#### Le garde-fou de fidélité aux commandes externes couvre le code neuf

- *Réalisé par* : EF-AGT-002 (existante, accepted) + RA-DIS-004 (existante) — le gate ne scanne aujourd'hui qu'une liste figée de dossiers livrés ; un dossier neuf en sortirait en silence, c'est-à-dire exactement le défaut que ce test a été écrit pour attraper.
- *Niveau de test* : unit (CI — rouge avant l'extension de la liste, vert après)
- **Étant donné** Une commande de l'outil de session inexistante citée dans un bloc de code du nouveau dossier livré
- **Quand** La CI s'exécute
- **Alors** Elle échoue en nommant la commande fantôme et son emplacement ; et quand la citation est corrigée, elle passe. Le dossier du nouveau module figure dans la liste scannée.

#### Tout test cité en preuve s'exécute à chaque changement

- *Réalisé par* : RA-DIS-004 (existante) — « tout test cité comme preuve d'une exigence du pack s'exécute automatiquement à chaque changement du dépôt ». Constat de départ : les tests des plugins existants ne sont exécutés par AUCUN job, malgré un commentaire du dépôt qui affirme le contraire.
- *Niveau de test* : unit (CI — vérification par sabotage volontaire)
- **Étant donné** Les tests du veilleur et de la commande locale, et les tests de plugins aujourd'hui orphelins de la CI
- **Quand** On casse volontairement une assertion de chacun et qu'on ouvre une PR
- **Alors** La PR rougit dans les deux cas — la preuve n'est pas inerte. Aucun test cité en « Testé par » d'une story de ce chantier ne vit dans un emplacement que la CI n'exécute pas.

### E6 — « Mon coordonnateur m'ouvre sa ligne sans que je le demande » (la compétence et son premier usage)

**Problème** — Une capacité disponible n'est pas une capacité exercée. Sans discipline écrite, chaque agent décide seul de ce qu'il pousse — et un canal qu'on cesse de lire annule tout le bénéfice de la ligne. C'est aussi le seul endroit où se règle ce qui sort du poste vers un hébergeur tiers : un agent qui rapporte un blocage cite des noms de clients, des extraits de tickets, parfois du code, publiés automatiquement et sans relecture humaine — le nom même du canal peut exposer le portefeuille client. Le design est muet là-dessus.

**Résultat attendu** — La compétence /ligne-directe dit quand parler, ce qu'on ne dit pas, et où réinscrire l'arbitrage reçu ; /orchestrer-chantier ouvre sa ligne en naissant, jalonne, et la referme en clôturant — sans posséder le mécanisme, qui reste générique pour tout agent.

**Hors-scope** — Tout nouveau geste de la ligne. Le remplacement des alertes d'infrastructure et du feed d'équipe, qui gardent leurs rôles (HS-AGT-005). L'usage par un second agent que /orchestrer-chantier — le mécanisme est générique, mais un seul usage est câblé ici.

#### La compétence /ligne-directe existe là où l'agent la cherche

- *Réalisé par* : EF-DIS-001 (compétence livrée par le module core) OU EF-DIS-005 (commande slash mirrorée sur le poste) — le vecteur est tranché par l'ADR de E1 ; la story cite l'EF du vecteur retenu et écarte l'autre explicitement. Ce ne sont ni la même EF, ni le même répertoire, ni le même test : les confondre reproduit le problème que le BRD énonce lui-même.
- *Niveau de test* : unit (CI, cli/test/ — installation vérifiée par le vecteur retenu)
- **Étant donné** Le vecteur tranché par l'ADR de E1, et une session ouverte dans un dépôt qui n'est pas somtech-pack
- **Quand** On installe le pack puis qu'on cherche la compétence depuis cette session
- **Alors** La compétence est présente et invocable par le vecteur retenu, et un test échoue si elle est déposée dans le répertoire de l'autre vecteur.

#### La discipline de parole est écrite, y compris ce qui ne sort pas du poste

- *Réalisé par* : EF-AGT-004 (créée en E0) + HS-AGT-002 à HS-AGT-005 (créés en E0).
- *Niveau de test* : N-A (contenu de compétence — vérifié par relecture d'un canal de bout en bout et revue de la compétence)
- **Étant donné** Un chantier mené de bout en bout avec sa ligne ouverte, par un agent qui a lu la compétence
- **Quand** On relit l'intégralité du canal après clôture
- **Alors** Tous les messages relèvent des motifs énoncés (arbitrage produit, risque assumé, dépense, blocage) ou des jalons énoncés (ouverture avec le découpage, epic livré, clôture) — aucun statut, aucune PR, aucune ouverture/fermeture d'agent ; ET aucun message ne porte d'extrait de code client ni de donnée personnelle, et le nom du canal ne désigne aucun client. La compétence énonce cette retenue comme une consigne, pas comme une suggestion.

#### Un arbitrage tranché dans la conversation est réinscrit au registre opposable

- *Réalisé par* : EF-AGT-004 (créée en E0) + EF-AGT-001 (existante, accepted) + RA-AGT-003 (existante) — la ligne est un canal de conversation, jamais une source de vérité.
- *Niveau de test* : N-A (procédural — vérifiable sur le ticket concerné après un arbitrage réel)
- **Étant donné** Un arbitrage sollicité par un agent sur sa ligne et tranché par le dirigeant depuis son téléphone
- **Quand** L'agent reprend son travail après avoir reçu la réponse
- **Alors** Le ticket ou l'epic concerné porte un commentaire qui reprend la décision et renvoie au canal ; la conversation n'est jamais la seule trace d'une décision. La compétence rend ce geste obligatoire et le nomme.

#### /orchestrer-chantier ouvre sa ligne en naissant et la referme en clôturant

- *Réalisé par* : EF-AGT-001 (existante, accepted) + EF-AGT-003 (créée en E0) + RA-AGT-001 (existante) — symétrie exigée : le geste d'ouverture ne se livre pas sans son geste de clôture.
- *Niveau de test* : intégration (CI pour le câblage ; passe de fumée manuelle sur un chantier réel, documentée)
- **Étant donné** Un chantier confié à /orchestrer-chantier, sur un poste où la ligne directe est installée
- **Quand** Le coordonnateur naît, livre un epic, puis clôture le chantier
- **Alors** À la naissance, un canal existe et porte le découpage ; à chaque epic livré, un message le dit ; à la clôture, le bilan est posté et la ligne fermée — le canal ne survit pas au chantier. ET si la ligne ne peut pas s'ouvrir (veilleur absent, jeton manquant), le chantier démarre quand même en le signalant : la ligne est un canal, pas une dépendance dure du pilotage.

## Notes du découpage

GRAIN — `module_id` NULL sur la demande, `brd_resolved_from` = 'application' : grain application pur, AUCUN fallback module → app déclenché. Aucune story « Initialiser BRD module » n'est requise, et aucun déclassement de grain n'est à justifier.

POURQUOI E0 EST BLOQUANT ET NON PARALLÈLE. Les quatre analyses convergent sur le même constat, vérifié à la source (BRD.md lu intégralement, 12 EF sur 3 domaines) : aucune EF ne couvre « joindre le dirigeant hors du poste ». Les deux rattachements tentants sont faux et il faut les nommer pour ne pas y céder — EF-AGT-001 « piloter un chantier » est le CONTEXTE d'usage, EF-DIS-004 « dépendances d'exécution » est l'EMBALLAGE. Une EF citée à côté est pire qu'une EF manquante : elle éteint le signal. Le BRD dit lui-même que l'absence d'un domaine rédigé n'est pas un hors-scope — c'est exactement le cas ici.

UNE STORY SANS EF, ASSUMÉE. La première story de E0 (correction de la référence croisée fausse `D-20260805-0001` dans la description de la demande) ne trace à aucune EF, et c'est délibéré : le BRD encadre le produit, pas le contenu d'une demande ServiceDesk. Elle est nécessaire — une story ne doit pas hériter d'une référence fausse — et j'ai préféré l'assumer plutôt que de lui fabriquer une traçabilité de complaisance. C'est la seule du découpage dans ce cas.

INVERSION DE RISQUE ASSUMÉE DANS L'ORDRE. Le design décrit l'état final (processus permanent) et la demande le place en pièce n°1. Le découpage l'inverse : le sens sortant (E2) livre de la valeur perçue par le dirigeant sans daemon, avec le registre et le secret déjà en place, et diffère l'unité la plus risquée à E3. Ouvrir par le veilleur ne produirait rien d'observable avant la troisième livraison.

RÉSILIENCE LIVRÉE AVEC LA PREMIÈRE STORY QUI EN A BESOIN, jamais en story tardive : l'échec bruyant du service externe est dans E2-ouvrir (première story qui l'appelle) ; la preuve de remise par relecture du pane est DANS la story d'injection de E3, pas après elle ; la protection du registre contre une mise à jour du pack est dans l'epic qui crée le registre (E2), pas dans l'epic distribution.

SYMÉTRIES TENUES : ouvrir ↔ fermer dans le même epic (E2) ; sortant (E2) ↔ entrant (E3) ; agent qui meurt ↔ veilleur qui meurt (E4, ce second cas étant ABSENT du design — ajouté ici) ; naissance ↔ clôture de la ligne dans /orchestrer-chantier (E6).

DEUX ARBITRAGES QUI ORIENTENT DES UNITÉS ENTIÈRES, à trancher dans E0/E1 et pas en cours de route : (1) HS-DIS-001 — enregistrer un service permanent auprès du gestionnaire du poste est-il une dépendance système (hors-scope) ou une capacité du pack ? (2) archivage vs réponse à une ligne close — le design promet deux comportements incompatibles.

NIVEAUX DE TEST — ce chantier n'a ni base de données, ni RLS, ni interface : L1/L2 au sens Somtech ne s'appliquent pas et ce dépôt n'a pas de runner qa-hybrid. La pyramide réelle est : unitaire (registre, casse, échappement, filtre de publication, table des dépendances) + intégration contre des doublures (seule façon de mettre en scène les modes de panne à la demande) + une passe de fumée manuelle documentée sur l'espace réel pour ce qu'une doublure ne prouve pas (rendu de l'identité empruntée, invitation, archivage). ATTENTION RA-DIS-004 : seuls `scripts/tests/*.sh` et `cli/test/*.test.js` s'exécutent en CI aujourd'hui — les tests des plugins existants ne tournent NULLE PART, ce que la dernière story de E5 corrige au passage.

TROIS PIÈGES SILENCIEUX À NE PAS PERDRE EN ROUTE, chacun déjà transformé en critère G/W/T : la publication amputée (les dépendances d'exécution ne voyagent que sous l'arborescence des plugins), l'appariement sensible à la casse ou fondé sur un identifiant volatil (le message atterrit chez le mauvais agent, sans erreur), et le message réputé transmis mais resté collé (mesuré trois fois dans une même session le 2026-08-03). Aucun des trois ne produit d'erreur : ils produisent du silence.

DEUX JETONS, PAS UN. La demande et le design doc affirment « un seul jeton derrière » — c'est faux : le mode d'écoute permanent exige un jeton d'application distinct du jeton de robot. Deux secrets, deux rotations, deux façons d'échouer. Corrigé dans E0 (RA-AGT-005) et dans le prérequis humain de E1.

## Ce que le brainstorm n'a pas tranché

TROIS SPIKES TIMEBOXÉS, TOUS DANS E1, TOUS AVANT LA PREMIÈRE LIGNE DE CODE DE PRODUCTION.

1) « Ce que l'outil de conversation permet vraiment » (½ journée, livrable REF). Rien du design n'a été confronté à la documentation courante : emprunt d'identité par nom et avatar sur un message de bot, portées exactes pour créer/inviter/archiver, mode d'écoute et plafond de connexions par application, sort d'un message envoyé à un canal archivé, réservation du nom d'un canal archivé. La date de coupure du modèle rend toute affirmation d'API produite de mémoire irrecevable. Condition de fin : un message visible dans un canal de test sous une identité d'emprunt. CE SPIKE DOIT AUSSI TRANCHER UNE CONTRADICTION DU DESIGN : on ne peut pas à la fois archiver le canal à la clôture et y répondre ensuite (un canal archivé est muet des deux côtés) — délai de grâce, annonce avant archivage, ou renommage sans archivage. Sans cet arbitrage, E2-fermer et E4-ligne-close livrent une promesse intenable.

2) « La surface réelle de l'outil de session » (livrable REF + extension de la table de fidélité en CI). Le gate existant prouve que les commandes existent, jamais leurs drapeaux ni leurs arguments : la forme d'appel réelle de l'injection, la sémantique d'un agent DISPARU dans l'inventaire, le sort d'un prompt soumis à un agent occupé, et le symptôme du message resté collé restent à établir. Bonne nouvelle : le geste d'injection est prouvé existant et une parade au message collé existe déjà — hors du pack, sur un seul poste. Ce n'est donc pas un préalable lourd, mais c'est un préalable.

3) « Où vit un processus permanent sur le poste, et par où on lui parle » (livrable ADR). C'EST L'UNITÉ LA PLUS RISQUÉE DU CHANTIER. Le dépôt n'a AUCUN mécanisme de service permanent, et le module canvas n'en est pas un précédent (serveur démarré à la demande, rattachement idempotent) : le raccourci « on réplique le canvas » sous-estimerait le travail d'un ordre de grandeur. Trois habitats à instruire — service du gestionnaire du poste, plugin de l'outil de session avec pane possédé, démarrage paresseux idempotent — avec la frontière HS-DIS-001. Condition de fin : un veilleur bidon qui survit à la fermeture de sa session ET à un redémarrage. Ce spike tranche aussi le point d'entrée local (sans quoi « aucun point d'entrée réseau » reste invérifiable) et le vecteur de livraison de la compétence.

CE QUI DEVRAIT REPASSER PAR UN BRAINSTORM COURT, PAS PAR UN SPIKE : (a) la posture Loi 25 — un flux automatisé de contenu de chantier client vers un hébergeur tiers, sans relecture humaine, est un flux NOUVEAU même si l'outil est déjà en usage interne ; probablement pas un bloqueur, mais à trancher explicitement et à traduire en consigne de retenue (E6) plutôt qu'en contrôle technique ; (b) bibliothèque officielle vs appels directs — le paquet publié part chez CHAQUE poste, y compris ceux qui n'ouvriront jamais une ligne, et le dépôt a déjà arbitré ce genre de compromis une fois.

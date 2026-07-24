# Découpage — D-20260724-0014 · /canvas : diagrammes manipulables et commande réellement distribuée

> Consignation de l'exercice de planification (`/superplan` → `plan-servicedesk`). Produit par le workflow
> `analyse-decoupage-demande` (lecture seule) le 2026-07-24, puis soumis à une critique adversariale.

## Contexte de traçabilité

- **Demande** : D-20260724-0014
- **Application** : Somtech Pack (`2098c2fd-5448-46a3-bd98-83778e7a064d`)
- **Grain BRD** : application (résolu depuis : application) — BRD v0.1.0
- **BRD présent** : oui — Somcraft `/business-requirements/somtech-pack/BRD.md`

## Verdict de la critique adversariale

**`pret_a_creer` : FALSE** — aucune création d'epic/story tant que les défauts bloquants ne sont pas réglés (gate dur du skill `plan-servicedesk`, règle d'or n°10).

> Bon découpage sur le fond — le diagnostic technique est exact et vérifié (564 éléments / 69 flèches / 0 liaison dans le seul diagramme versionné ; herdr-plugins absent de pack.json ; setup ne miroite que skills et workflows ; les 4 tests du plugin cités au BRD ne tournent dans aucun job CI). Les deux spikes sont bien placés et honnêtement timeboxés. Mais il n'est pas créable en l'état : trois défauts structurants. (1) Il affirme que RA-DIS-001 n'a aucune EF porteuse — le BRD dit explicitement « Encadre = EF-DIS-004 » ; toute la justification d'E0-S2 tombe. (2) Deux stories d'implémentation citent des EF qui n'existent pas, et l'epic de gouvernance E0 s'écarte du patron STD-033 §2.8 (story MAJ BRD en tête de CHAQUE epic, pas un epic séparé) : créé tel quel, ça produit des stories orphelines. (3) Le G/W/T d'E1-S1 se contredit (interdire les artefacts de construction tout en exigeant la page construite) et porte un conditionnel sur une décision non prise. S'y ajoutent le niveau SemVer jamais tranché, un domaine BRD entier ouvert pour un besoin couvrable par une RA existante, et un E2 qui ne prouve jamais l'état du fichier versionné hors session navigateur — le cas même qui a créé le problème.

### Défauts relevés

| Sévérité | Cible | Problème | Correction attendue |
|---|---|---|---|
| **bloquant** | E0-S2 « Donner une exigence porteuse à la règle pas de capacité exposée sans sa dépendance » (+ E1-S3 qui en dépend) | Citation inexacte d'une source opposable. Le découpage affirme que « RA-DIS-001 … n'a AUCUNE EF porteuse, donc la story de garde-fou serait orpheline ». Le BRD Somtech Pack v0.1.0 (Somcraft dedb3032-725e-4128-b4f4-2099dd1a5042, §5.1) dit le contraire : la ligne RA-DIS-001 porte explicitement « Encadre = EF-DIS-004 ». La traçabilité RA→EF existe déjà. Toute la justification de E0-S2 (et donc la création d'EF-DIS-006, et donc la traçabilité d'E1-S3) repose sur un fait faux — exactement le type d'erreur de calibration que la critique était censée attraper. | Reformuler l'enjeu réel, qui est légitime mais différent : EF-DIS-004 exige d'INSTALLER la dépendance, elle n'exige pas de DÉTECTER son absence et de le dire. Poser la question à Maxime comme un arbitrage de formulation (élargir l'énoncé d'EF-DIS-004 vs créer EF-DIS-006), pas comme la réparation d'une orpheline. Si l'arbitrage retient l'élargissement, E1-S3 se trace à EF-DIS-004 et E0-S2 disparaît. |
| **bloquant** | Structure E0 (epic de gouvernance à 4 stories) + E1-S3 « EF-DIS-006 (créée en E0) » + E2-S1 « EF-GOV-001 (créée en E0) » | Deux stories d'implémentation se tracent à des EF qui n'existent pas dans le BRD. Si la hiérarchie est créée telle quelle dans ServiceDesk, ce sont des stories orphelines au sens de la règle d'or n°10. De plus, STD-033 §2.8 (Protocole de pré-décomposition) prescrit une story « MAJ BRD » en PREMIÈRE POSITION DANS L'EPIC concerné, complétée AVANT que les stories d'implémentation démarrent — pas un epic de gouvernance séparé dont dépendent deux autres epics par des liens que ServiceDesk ne matérialise pas. | Supprimer E0 comme epic. Replier chaque amendement dans son epic porteur : une story « MAJ BRD » en tête d'E1 (frontière EF-DIS-004/HS-DIS-001 + sort de RA-DIS-001) et une en tête d'E2 (preuve structurelle EF-DIA-002 + sort du fichier versionné + exigence de test exécuté). Ne créer les stories d'implémentation qu'avec des identifiants d'EF réellement présents au BRD au moment de la création. |
| **majeur** | E1-S1 « Le paquet publié embarque un canvas prêt à servir, et rien d'autre » | G/W/T auto-contradictoire et conditionnel, donc non testable en l'état. Le THEN exige à la fois « ce contenu suffit à servir la page sans construction supplémentaire » (ce qui impose d'embarquer web/dist, un artefact de construction) et « aucun artefact local du poste ne s'y est glissé ». Vérifié : web/dist et web/node_modules sont gitignorés dans le plugin, et cli/scripts/build-payload.mjs ne filtre aujourd'hui que .DS_Store et les liens symboliques. Le THEN porte en plus une branche conditionnelle (« si l'ADR retient l'embarquement ») : un critère d'acceptation qui dépend d'une décision non prise ne peut pas être rouge avant / vert après. | Distinguer nommément les deux catégories : artefact de construction ATTENDU et reproductible (la page web construite) vs résidus du poste INTERDITS (node_modules, .herdr/*.port, journaux, .bak). Réécrire le G/W/T après le spike, sans conditionnel, en nommant l'inclusion attendue et la liste d'exclusion. |
| **majeur** | E1-S3 « Une dépendance absente se dit, elle ne se découvre pas à l'usage » | Le comportement visé vit aujourd'hui dans .claude/commands/canvas.md — une consigne en markdown adressée à l'agent (chaîne de repli herdr plugin list → ./herdr-plugins/excalidraw → ~/.claude/herdr-plugins/excalidraw, puis « dire que le plugin n'est pas installé »). Une consigne markdown n'est pas couvrable par « un test qui échouait avant la story ». La story exige donc implicitement d'extraire la détection dans un script exécutable — un travail de conception non énoncé, qui la rend nettement plus grosse qu'annoncé. | Énoncer explicitement le livrable : déplacer la résolution du plugin et le diagnostic dans un script versionné du pack, la commande markdown se contentant de l'appeler. Le G/W/T porte alors sur le code de sortie et le message du script, testable. |
| **majeur** | E1-S5 « Un projet qui installe OU met à jour reçoit un canvas fonctionnel » — critère « le port qu'il occupe est déclaré à l'inventaire des ports du poste » | Critère imprécis et mal scopé, donc infalsifiable. Vérifié dans le code : le serveur ne prend pas un port fixe — server/server.js pose DEFAULT_PORT=4870 et server/bin.js calcule 4870 + hash(nom) % 100, avec jusqu'à 20 tentatives sur les ports suivants. C'est une PLAGE (~4870-4989), pas « un port ». Et l'inventaire visé (~/.claude/ports-inventory.json) est un fichier de poste : une story d'installation projet n'a rien à y écrire. La story empile par ailleurs cinq axes d'acceptation (install, update, gitignore, ports, préservation) — au-delà d'une PR. | Sortir la réservation de plage de cette story : en faire un item de la story de poste (E1-S2) ou une story propre, formulée comme « la plage 4870-4989 est réservée au canvas dans l'inventaire des ports », avec la plage sourcée au code. Scinder E1-S5 en install / update si la première PR déborde. |
| **majeur** | E0 dans son ensemble — niveau SemVer et mode de validation absents | STD-033 §2.8 étape 5 impose de trancher le niveau SemVer de l'amendement et d'en tracer le raisonnement dans la story MAJ BRD, et l'étape 6 impose d'annoncer la modification dans un commentaire de la demande d'origine. Ni l'un ni l'autre n'apparaît. Or l'enjeu n'est pas cosmétique : redéfinir la frontière d'EF-DIS-004 et ajouter un domaine relèvent au minimum du mineur, et « au moindre doute → monte d'un cran » (§2.9) pousse vers le majeur — lequel exige une validation humaine explicite MÊME en mode autonome. | Pour chaque amendement : nommer le niveau SemVer, le justifier, et indiquer le mode (auto vs validation humaine obligatoire). Ajouter l'annonce en commentaire de D-20260724-0014 comme étape de la story MAJ BRD. |
| **majeur** | E0-S4 « Exiger qu'une exigence déclarée testée le soit par un test qui s'exécute » (EF-GOV-001 À CRÉER) | Ouvrir un domaine BRD entier (gouvernance du cycle de livraison) pour une demande qui porte sur le canvas et sa distribution est du hors-sujet coûteux : cela bascule le SemVer, engage un domaine qui débordera largement cette demande, et rallonge le chemin critique. Le constat sous-jacent est pourtant exact et vérifié : .github/workflows/tests.yml exécute scripts/tests/*.sh, node --test dans cli/ et pytest dans aims/brd-graph — jamais herdr-plugins/excalidraw/tests/, alors que le BRD cite ces 4 fichiers en « Testé par » (EF-DIA-001, EF-DIA-002, RA-DIA-002). | Voie moins chère et dans le périmètre : RA-DIA-002 déclare DÉJÀ hardening.test.js comme sa preuve. Brancher la suite du plugin dans le CI réalise cette RA existante — aucune EF ni domaine nouveau requis. Garder EF-GOV-001 comme proposition séparée à soumettre hors de cette demande. |
| **majeur** | E2 — les 5 stories, et sa dépendance conditionnelle à E0-S3 | Périmètre asymétrique. Les cinq G/W/T d'E2 partent tous d'une session navigateur ouverte (« je referme et je rouvre »). Aucun ne prouve l'état du FICHIER VERSIONNÉ quand l'agent dessine sans navigateur — or c'est précisément ce cas qui a produit le diagramme à plat constaté (vérifié sur docs/diagrams/pack-skills-workflows.excalidraw : 564 éléments, 69 flèches, 0 liaison, 0 groupe, 0 texte conteneurisé). E0-S3 renvoie la question à un arbitrage (EF-DIA-005) dont la réponse « oui » ajouterait une story à E2, mais E2 ne réserve rien pour ça. La dépendance est mentionnée en note, pas portée par le découpage. | Rendre la dépendance structurante : soit trancher EF-DIA-005 avant de figer E2, soit inscrire dès maintenant dans E2 une story conditionnelle « le fichier versionné porte lui-même groupes et liaisons, sans session ouverte », marquée bloquée par l'arbitrage. |
| **majeur** | Notes — « le BRD existe, la note de la demande est PÉRIMÉE » + E0 out_of_scope | Conclusion trop forte. Le BRD existe bien (v0.1.0, changelog imputé à D-20260724-0014), mais il est en statut `draft`, n'a jamais parcouru la Phase 3 de STD-033 §2.7 (revue sponsor, trace d'acceptation en commentaire Somcraft, bascule v1.0.0 / in_force), aucune colonne « Réalisé par » n'est renseignée, et aucun brd.yaml n'est publié. « Le BRD existe » n'est donc pas « le BRD est établi » au sens de la source opposable. En sortant cette bascule du périmètre, on prépare une demande livrée avec sa troisième demande explicite non satisfaite. | Ne pas déclarer la note périmée : la requalifier. Soit inscrire la validation du BRD (draft → in_review → in_force) dans le périmètre, soit obtenir de Maxime un arbitrage écrit qui la sort — mais pas la traiter comme un non-sujet. |
| **mineur** | E0 out_of_scope — « Faire passer le BRD de draft à accepted » | `accepted` n'est pas un statut de document valide. STD-033 §2.6 fixe draft → in_review → in_force → superseded (+ rejected terminal) ; `accepted` appartient à l'enum des EXIGENCES, pas du document. Confusion des deux niveaux dans un énoncé qui cite une source opposable. | Écrire « draft → in_review → in_force ». |
| **mineur** | Notes — « pointer posé ~21 min APRÈS la création de la demande » | Précision chiffrée non sourcée dans le livrable. La demande est horodatée 2026-07-24T18:04:19Z ; le BRD ne porte qu'une date au jour (24 juillet 2026). L'écart en minutes n'est vérifiable que via un horodatage de pointer qui n'est cité nulle part. Le chiffre n'apporte rien à l'argument. | Remplacer par le fait vérifiable : « BRD v0.1.0 daté du 2026-07-24, changelog imputant sa création à D-20260724-0014 ». |
| **mineur** | Notes — « faits non vérifiés » : chargement global de ~/.claude/commands (postulat d'E1-S4) | Sur-prudence inutile sur un point vérifiable en une minute, alors que le même bloc de notes affirme sans réserve des choses plus fragiles (l'orpheline RA-DIS-001). Le pack livre déjà 6 commandes dans .claude/commands (agent-brief, brd, canvas, ontology, pousse, schema-doc) et le CLI possède déjà le patron exact à recopier — installGlobalSkills / installGlobalWorkflows, avec sauvegarde .somtech.bak des dérives, respect des liens symboliques et option de refus. | Vérifier le point, et faire citer par E1-S4 le patron existant (cli/src/globalskills.js, cli/src/globalworkflows.js et leurs tests) comme référence d'implémentation et de couverture. |
| **mineur** | E1-S0 — livrable « un ADR daté » | Le dépositaire et l'emplacement du livrable ne sont pas dits. Les ADR Somtech vivent dans le dossier Architecture (hors du repo courant) ; une session ouverte sur somtech-pack ne doit pas y écrire à l'aveugle. Même remarque pour le « document de décision (REF) » d'E2-S0. | Nommer l'emplacement et le canal (document Somcraft du workspace Architecture via MCP) dans le G/W/T des deux spikes. |
| **mineur** | E1 — documentation du pack absente du périmètre | Aucune story ne met à jour la documentation que le pack donne de lui-même. Aujourd'hui ni README.md ni CLAUDE.md ne mentionnent herdr-plugins ni /canvas, et la table des modules de CLAUDE.md ne liste que « /pousse, /brd » pour .claude/commands alors qu'il y en a 6. Ajouter un module sans corriger ça reproduit précisément le problème P-01/P-03 du BRD (« écart entre ce que le pack annonce et ce qu'il installe »). | Ajouter le tableau des modules (pack.json, README, CLAUDE.md) aux critères d'acceptation de la story qui déclare le nouveau module. |

## Découpage proposé (à amender avant création)

### E0 — Gouvernance BRD : lever les ambiguïtés qui bloquent l'écriture des stories

**Problème** — Le BRD Somtech Pack (v0.1.0, grain application) couvre bien les deux problèmes de la demande, mais trois zones d'ombre rendent les stories non écrivables sans arbitrage : (1) EF-DIS-004 (« installée avec les dépendances d'exécution dont elle a besoin ») et HS-DIS-001 (« le pack n'installe pas les dépendances système du poste ») se contredisent sur les paquets et artefacts de construction propres à une capacité du pack — deux lectures légitimes mènent à deux architectures différentes ; (2) RA-DIS-001 (« une capacité dont la dépendance n'est pas distribuée n'est pas exposée ») — la règle précisément violée aujourd'hui — n'a AUCUNE EF porteuse, donc la story de garde-fou serait orpheline ; (3) EF-DIA-002 n'exige qu'une relecture VISUELLE du rendu, or ni un groupe ni une liaison ne se voient sur une image — les G/W/T de la manipulabilité seraient décoratifs. S'y ajoute un trou de gouvernance : le BRD cite en « Testé par » des fichiers de tests du plugin canvas qu'aucune chaîne d'intégration n'exécute. Règle d'or n°10 : on amende le BRD AVANT d'écrire les stories.

**Résultat attendu** — Le BRD, relu dans Somcraft, se lit d'une seule façon sur les quatre points ; chaque story des epics suivants se trace à une EF non ambiguë ; aucune story orpheline. Amendements portés dans Somcraft via /brd edit sur le BRD de l'app (pas depuis le repo Architecture, pas par l'architecte), datés au changelog.

**Hors-scope** — Créer le BRD Somtech Pack — il existe déjà (créé ~21 min APRÈS la demande, changelog v0.1.0 imputé à D-20260724-0014) : la note « BRD absent » de la demande est PÉRIMÉE, aucune story ne doit la reprendre. Faire passer le BRD de draft à accepted (décision de sponsor, hors demande). Rédiger les domaines du BRD non touchés par cette demande (marketplace, capacités d'agent).

#### Trancher la frontière entre « dépendance d'une capacité du pack » et « dépendance du poste »

- **Exigence tracée** : EF-DIS-004 (à amender) + HS-DIS-001 (à préciser)
- **Niveau de test** : N-A (gouvernance BRD)
- **Étant donné** Le BRD Somtech Pack où EF-DIS-004 exige qu'une capacité soit installée avec les dépendances d'exécution dont elle a besoin, et où HS-DIS-001 exclut les dépendances système du poste
- **Quand** On demande de quel côté de la frontière tombent les paquets applicatifs et les artefacts de construction PROPRES à une capacité du pack (par opposition au moteur d'exécution et à l'outil de session)
- **Alors** Le BRD relu dans Somcraft ne permet plus qu'une seule lecture, les deux énoncés ne se contredisent plus, l'amendement est daté au changelog, et la story de distribution qui suit peut être écrite sans arbitrage supplémentaire

#### Donner une exigence porteuse à la règle « pas de capacité exposée sans sa dépendance »

- **Exigence tracée** : EF-DIS-006 (À CRÉER) — alternative à arbitrer : élargir l'énoncé d'EF-DIS-004
- **Niveau de test** : N-A (gouvernance BRD)
- **Étant donné** RA-DIS-001 figure au BRD mais aucune exigence fonctionnelle ne la réalise : rien n'exige aujourd'hui que le pack DÉTECTE une dépendance absente et le dise
- **Quand** On cherche l'EF à laquelle rattacher la story de garde-fou (message explicite au lieu d'un échec à l'usage)
- **Alors** Une EF couvre RA-DIS-001, la RA la cite dans sa colonne « Encadre », et la story de garde-fou se trace sans être orpheline (règle d'or n°10)

#### Exiger une preuve structurelle du schéma, et trancher le sort du fichier versionné

- **Exigence tracée** : EF-DIA-002 (à amender) + EF-DIA-005 (À CRÉER — à arbitrer avec Maxime)
- **Niveau de test** : N-A (gouvernance BRD)
- **Étant donné** EF-DIA-002 n'exige qu'une relecture du rendu avant de rendre compte, alors qu'un groupe et une liaison sont invisibles à l'œil et ne se révèlent qu'au déplacement
- **Quand** On cherche ce que l'agent doit prouver avant de rendre compte, et si le fichier versionné dans le dépôt doit lui-même porter groupes et liaisons indépendamment de toute session de navigateur ouverte
- **Alors** Le BRD exige explicitement une vérification de structure (liaisons résolues, aucune référence orpheline) EN PLUS du rendu, la question du fichier versionné est tranchée par écrit (EF-DIA-005 créée, ou exclusion justifiée), et les G/W/T de l'epic manipulabilité deviennent prouvables autrement que par une image

#### Exiger qu'une exigence déclarée testée le soit par un test qui s'exécute réellement

- **Exigence tracée** : EF-GOV-001 (À CRÉER — domaine gouvernance du cycle de livraison, explicitement non encore rédigé au §1 du BRD, mécanisme d'amendement STD-033)
- **Niveau de test** : N-A (gouvernance BRD)
- **Étant donné** Le BRD cite en colonne « Testé par » quatre fichiers de tests du plugin canvas, dont celui qui garde RA-DIA-002, alors qu'aucune chaîne d'intégration ne les lance
- **Quand** On cherche l'exigence qui garantit qu'une preuve citée au BRD est une preuve réellement rejouée à chaque changement
- **Alors** Le domaine gouvernance du BRD porte cette exigence, et la story d'activation de la chaîne d'intégration de l'epic manipulabilité s'y trace — sans quoi les EF-DIA seront déclarées testées par des tests inertes

### E1 — Après une installation normale du pack, /canvas fonctionne là où je travaille

**Problème** — Le plugin serveur du canvas n'est déclaré dans aucun module de pack.json : il n'est ni embarqué dans le paquet publié, ni copié dans les projets. Et la configuration de poste ne miroite que les compétences et les workflows vers ~/.claude, jamais les commandes — donc /canvas n'est utilisable dans aucune session hors du dépôt somtech-pack. Vérifié en lecture de code, et plus profond que ce que décrit la demande : déclarer le chemin ne suffirait PAS, car l'interface web servie par le plugin n'est pas versionnée (construite à part) — un plugin copié tel quel démarrerait et servirait une page absente. La demande resterait donc « livrée » et /canvas toujours cassé, exactement ce que RA-DIS-001 interdit.

**Résultat attendu** — Sur un poste fraîchement configuré et dans un projet fraîchement installé, /canvas s'ouvre et rend, sans étape manuelle ; quand il ne peut pas fonctionner, il le dit au lieu de le laisser découvrir à l'usage. Les six commandes du pack deviennent disponibles hors du dépôt somtech-pack, sans détruire ni écraser en silence une commande personnelle.

**Hors-scope** — Installer le moteur d'exécution, le gestionnaire de versions ou l'outil de session sur le poste (HS-DIS-001). Refondre le mécanisme d'installation du pack. Publier le plugin comme paquet public autonome (option écartée ou retenue par le spike, mais son industrialisation n'est pas dans cette livraison). Rendre le canvas disponible sur une plateforme non supportée par le plugin.

#### SPIKE (timeboxé 0,5 j) — trancher la chaîne de distribution du canvas

- **Exigence tracée** : EF-DIS-004 (spike préparatoire, aucun code de production livré) — s'appuie sur la frontière tranchée en E0
- **Niveau de test** : N-A (spike, livrable ADR)
- **Étant donné** Le plugin du canvas se construit (paquets du serveur + interface web construite) et le résultat construit n'est pas versionné dans le dépôt
- **Quand** On compare les trois voies — construire à la publication et embarquer le résultat, construire chez l'utilisateur à l'installation, publier le plugin comme paquet autonome — sur des critères fixés d'avance : fonctionne hors ligne, durée d'installation MESURÉE, poids du paquet MESURÉ, reproductibilité entre une publication depuis un poste et une publication par la chaîne d'intégration
- **Alors** Un ADR daté tranche la voie retenue, chiffre le poids et la durée réellement mesurés (jamais estimés) qui serviront de bornes aux stories suivantes, et dit si le canvas s'installe au poste, au projet, ou aux deux — aucune ligne de code de production n'est livrée

#### Le paquet publié embarque un canvas prêt à servir, et rien d'autre

- **Exigence tracée** : EF-DIS-004 (amendée en E0) + EF-DIS-003 (encadrée par RA-DIS-002 : on déclare, on ne recopie jamais à la main)
- **Niveau de test** : unit + L3 (tests du CLI)
- **Étant donné** Une publication déclenchée depuis un checkout propre, et une publication déclenchée depuis un poste où le canvas a déjà été construit une fois
- **Quand** On inspecte le contenu du paquet produit dans les deux cas
- **Alors** Les deux paquets ont le même contenu utile, ce contenu suffit à servir la page du canvas sans construction supplémentaire chez l'utilisateur (si l'ADR retient l'embarquement), aucun dossier de dépendances ni artefact local du poste ne s'y est glissé, le poids reste dans la borne fixée par l'ADR du spike, et un test — rouge avant la story — échoue si l'un de ces points régresse

#### Configurer mon poste installe le canvas, une fois pour tous mes projets

- **Exigence tracée** : EF-DIS-004 (amendée en E0) — étend EF-DIS-002
- **Niveau de test** : L3 (tests du CLI) + validation humaine sur poste réel
- **Étant donné** Un poste où le canvas n'a jamais été installé
- **Quand** Je lance la configuration de poste du pack, puis je la relance une seconde fois
- **Alors** Le plugin est présent à l'emplacement que /canvas cherche en dernier recours et sert sa page, la seconde exécution ne reconstruit rien et ne casse rien, un échec de mise en place (réseau absent) n'interrompt pas le reste de la configuration du poste, et une option permet de s'en passer

#### Une dépendance absente se dit, elle ne se découvre pas à l'usage

- **Exigence tracée** : EF-DIS-006 (créée en E0) — réalise RA-DIS-001
- **Niveau de test** : L3
- **Étant donné** Un poste ou un projet où le canvas n'est pas installable (plugin absent, ou son moteur absent)
- **Quand** Je lance /canvas
- **Alors** La commande s'arrête AVANT toute tentative de dessin, nomme ce qui manque et l'action exacte pour le réparer, ne produit ni fichier ni schéma partiel — et ce comportement est couvert par un test qui échouait avant la story (aujourd'hui il n'est prouvé par aucun test)

#### Les commandes du pack existent dans toutes mes sessions, sans écraser les miennes

- **Exigence tracée** : EF-DIS-005 — encadrée par RA-DIS-003 (backup obligatoire, jamais de destruction)
- **Niveau de test** : L3 (tests du CLI, calque des tests du miroir des compétences)
- **Étant donné** Un poste où coexistent déjà des commandes personnelles, des commandes venues d'autres sources, et une commande portant le même nom qu'une commande du pack mais au contenu différent
- **Quand** Je lance la configuration de poste, puis j'ouvre une session dans un projet quelconque hors somtech-pack
- **Alors** Les commandes du pack y sont disponibles (dont /canvas), une commande personnelle hors-pack est intacte, la commande du pack divergente a été sauvegardée avant d'être remise à niveau, aucune commande venue d'une autre source n'a été touchée, et une option permet de refuser ce miroir

#### Un projet qui installe OU met à jour le pack reçoit un canvas fonctionnel

- **Exigence tracée** : EF-DIS-004 (amendée en E0) + EF-DIS-001
- **Niveau de test** : L3 + validation humaine
- **Étant donné** Un projet vierge, puis ce même projet déjà installé avec une version antérieure du pack
- **Quand** J'installe le pack avec le module du canvas, puis je fais une mise à jour
- **Alors** Dans les DEUX cas /canvas s'ouvre depuis ce projet et rend sa page, les fichiers d'exécution que le canvas dépose dans le dépôt sont ignorés par git, le port qu'il occupe est déclaré à l'inventaire des ports du poste, et aucun fichier du projet déclaré à préserver n'a été écrasé

### E2 — Un schéma produit par l'agent se retouche à la souris sans tout recasser

**Problème** — Les schémas sont posés à plat : mesuré sur le seul diagramme versionné du dépôt — 564 éléments, aucun regroupement, aucun texte rattaché à sa forme, et 69 flèches dont aucune n'est liée à ses extrémités. La cause n'est pas un oubli de champs : la normalisation de la scène se fait ÉLÉMENT PAR ÉLÉMENT, or une liaison référence une AUTRE forme — elle est donc structurellement irrésolvable tant qu'on ne convertit pas la scène entière. Basculer en conversion de scène entière entre en collision frontale avec le choix documenté dans le code (« un élément déjà complet repassé au convertisseur est dénaturé ») : le risque est de détruire du travail dessiné à la main par Maxime, non reproductible. C'est le chantier risqué de la demande, et le garde-fou existant (ne jamais remplacer une scène non vide par une scène vide) ne couvre PAS ce mode de perte.

**Résultat attendu** — Je déplace un bloc à la souris : son texte et ses composants suivent. Je déplace une forme : les flèches restent accrochées des deux côtés. Le tout survit à une fermeture/réouverture, le schéma déjà versionné s'ouvre sans dommage, le correctif du texte tronqué au premier rendu tient, et ce que j'ai dessiné à la main n'est jamais abîmé par l'agent. RA-DIA-001 est enfin satisfaite : je ne dépends plus de l'agent pour retoucher un schéma.

**Hors-scope** — La co-édition temps réel à plusieurs (HS-DIA-001) — on rend le schéma éditable par UN humain à la souris. Refondre l'éditeur ou ajouter de nouvelles primitives de dessin. Réécrire rétroactivement les schémas déjà versionnés (seule leur non-régression à l'ouverture est exigée).

#### SPIKE (timeboxé 1 j) — trancher où et comment naissent groupes et liaisons

- **Exigence tracée** : EF-DIA-003 + EF-DIA-004 (spike préparatoire, aucun code de production livré)
- **Niveau de test** : N-A (spike, livrable REF)
- **Étant donné** La scène est normalisée élément par élément — ce qui rend toute liaison entre deux éléments structurellement impossible — et le code documente qu'un élément déjà complet repassé au convertisseur est dénaturé et ressort filtré au chargement suivant
- **Quand** On éprouve sur un cas jouet les trois voies (normaliser la scène entière côté navigateur, enrichir à l'écriture côté serveur, faire écrire des éléments déjà liés par l'agent), en incluant obligatoirement une scène MIXTE : éléments de l'agent + éléments dessinés à la main
- **Alors** Un document de décision tranche la voie retenue et PROUVE par exécution que les liaisons se résolvent et que les éléments dessinés à la main ressortent intacts ; il répond par oui/non à « le schéma déjà versionné se rouvre-t-il sans dommage » et « le correctif du texte tronqué au premier rendu tient-il » ; il dit si un repli est nécessaire quand la conversion de scène entière échoue — aucun code de production n'est livré

#### Les tests du canvas s'exécutent à chaque changement

- **Exigence tracée** : EF-GOV-001 (créée en E0)
- **Niveau de test** : L3 (chaîne d'intégration)
- **Étant donné** Les fichiers de tests du plugin canvas existent — dont celui qui garde la règle « ne jamais remplacer une scène non vide par une scène vide » — mais aucune chaîne d'intégration ne les lance
- **Quand** J'ouvre une demande de fusion qui casse volontairement l'un de ces tests
- **Alors** La chaîne d'intégration échoue et nomme le test cassé — avant cette story, elle passait au vert. C'est le filet sans lequel les stories suivantes seraient livrées à l'aveugle

#### Je déplace un bloc, tout ce qu'il contient suit

- **Exigence tracée** : EF-DIA-003 — réalise RA-DIA-001
- **Niveau de test** : L3 (structure après aller-retour) + L5 (geste souris, validation humaine)
- **Étant donné** Un schéma que l'agent vient de produire, contenant un bloc avec son libellé (dont un libellé long) et plusieurs formes regroupées, ainsi que le schéma déjà versionné dans le dépôt
- **Quand** Je fais glisser une forme à la souris, puis je referme et je rouvre le fichier
- **Alors** Le libellé et les formes du même bloc se sont déplacés du même vecteur, rien n'est resté en arrière, le regroupement est toujours présent après réouverture, le libellé long n'est ni tronqué ni débordant (non-régression du correctif de premier rendu), et le schéma déjà versionné s'ouvre sans perte

#### Je déplace une forme, les flèches restent accrochées

- **Exigence tracée** : EF-DIA-004 — réalise RA-DIA-001
- **Niveau de test** : L3 (structure après aller-retour) + L5 (geste souris, validation humaine)
- **Étant donné** Un schéma produit par l'agent avec des flèches entre blocs, dont au moins une dans chaque sens
- **Quand** Je déplace un bloc à la souris, puis je referme et je rouvre le fichier
- **Alors** Chaque flèche reste ancrée à sa forme de départ ET à sa forme d'arrivée, son sens est conservé, la liaison survit à la réouverture, et rien n'est à redessiner

#### L'agent n'abîme jamais ce que j'ai dessiné à la main

- **Exigence tracée** : EF-DIA-002 (amendée en E0) — encadrée par RA-DIA-002, dont le périmètre s'élargit de « scène vidée » à « élément dénaturé »
- **Niveau de test** : L3
- **Étant donné** Une scène contenant des éléments que j'ai dessinés à la main, à côté d'éléments produits par l'agent, certains liés entre eux
- **Quand** L'agent réécrit une partie de la scène
- **Alors** Mes éléments ressortent identiques après rechargement, aucune référence de liaison ne pointe dans le vide, une écriture qui produirait une référence orpheline est REFUSÉE avec un message clair au lieu d'être appliquée, et la garantie existante (ne jamais remplacer une scène non vide par une scène vide) reste prouvée par son test

#### L'agent prouve les groupes et les liaisons avant de rendre compte

- **Exigence tracée** : EF-DIA-002 (amendée en E0)
- **Niveau de test** : L3 + N-A (contrat de la commande)
- **Étant donné** L'agent vient de dessiner dans un canvas
- **Quand** Il exécute son étape de relecture avant de rendre compte
- **Alors** Il constate explicitement que chaque bloc est groupé et que chaque flèche est liée de ses deux côtés — et non seulement que l'image s'affiche ; s'il manque une liaison, il le dit et corrige avant de rendre compte, au lieu d'annoncer un travail terminé sur la foi d'une image

## Ordre recommandé

[
 "E0-S1 — Frontière dépendance capacité / dépendance poste (EF-DIS-004 + HS-DIS-001)",
 "E0-S2 — EF porteuse pour RA-DIS-001 (EF-DIS-006 À CRÉER)",
 "E0-S3 — Preuve structurelle + sort du fichier versionné (EF-DIA-002 amendée, EF-DIA-005 à arbitrer)",
 "E0-S4 — Une exigence déclarée testée l'est par un test qui s'exécute (EF-GOV-001 À CRÉER)",
 "E1-S0 — SPIKE distribution (livrable ADR, 0,5 j)",
 "E1-S1 — Le paquet publié embarque un canvas prêt à servir, et rien d'autre",
 "E1-S2 — Configurer mon poste installe le canvas",
 "E1-S3 — Une dépendance absente se dit (garde-fou, DOIT précéder l'exposition globale)",
 "E1-S4 — Les commandes du pack existent dans toutes mes sessions",
 "E1-S5 — Un projet qui installe OU met à jour reçoit un canvas fonctionnel",
 "E2-S0 — SPIKE conversion : où naissent groupes et liaisons (livrable REF, 1 j)",
 "E2-S1 — Les tests du canvas s'exécutent à chaque changement",
 "E2-S2 — Je déplace un bloc, tout ce qu'il contient suit",
 "E2-S3 — Je déplace une forme, les flèches restent accrochées",
 "E2-S4 — L'agent n'abîme jamais ce que j'ai dessiné à la main",
 "E2-S5 — L'agent prouve groupes et liaisons avant de rendre compte",
 "CLÔTURE (DoD de la demande, pas une story) — amender le BRD : renseigner « Réalisé par » / « Testé par » sur EF-DIA-003, EF-DIA-004, EF-DIS-004, EF-DIS-005 et les passer de accepted à in_force"
]

## Spikes / zones à cadrer

DEUX SPIKES, chacun en tête de son epic, chacun timeboxé et sans code de production.

SPIKE E1-S0 — chaîne de distribution (0,5 j, livrable ADR). Inconnue qui change l'architecture : déclarer le plugin dans un module ne suffit pas, car l'interface web servie par le serveur du canvas n'est pas versionnée. Trois voies incompatibles entre elles : construire à la publication et embarquer le résultat (fonctionne hors ligne, paquet plus lourd), construire chez l'utilisateur à l'installation (paquet léger, exige réseau + npm + plusieurs dizaines de secondes, et un échec laisse une capacité à moitié installée — ce que RA-DIS-001 interdit), publier le plugin comme paquet autonome. S'y ajoutent deux questions de périmètre : poste, projet ou les deux ; module par défaut ou opt-in. Le spike doit MESURER (poids du paquet, durée d'installation) — ces mesures deviennent les bornes citées par les G/W/T des stories suivantes, ce qui évite d'y écrire un seuil inventé. Il doit aussi vérifier la reproductibilité entre une publication faite depuis un poste et une publication faite par la chaîne d'intégration : la copie du répertoire de travail n'exclut aujourd'hui ni les dossiers de dépendances ni les artefacts de construction locaux.

SPIKE E2-S0 — naissance des groupes et des liaisons (1 j, livrable REF). Inconnue centrale et non vérifiée : le comportement réel du convertisseur d'Excalidraw appliqué à la scène ENTIÈRE dans la version épinglée — résolution des liaisons de flèches par référence, rattachement d'un texte à sa forme, passage du regroupement, et surtout effet sur un élément DÉJÀ complet (le code documente qu'il est dénaturé et ressort filtré au chargement suivant). Le spike doit s'exécuter sur une scène MIXTE (éléments de l'agent + éléments dessinés à la main), répondre par oui/non à la non-régression du schéma déjà versionné et du correctif du texte tronqué au premier rendu, et dire si un repli est nécessaire quand la conversion de scène entière échoue. Sans ce spike, E2-S2 et E2-S3 sont écrites sur une hypothèse non prouvée et le risque de perte de travail humain n'est pas maîtrisé.

CE QUI N'EST PAS UN SPIKE : la frontière de périmètre (E0-S1) et l'EF porteuse de RA-DIS-001 (E0-S2) sont des DÉCISIONS de gouvernance BRD, pas des explorations techniques — elles se tranchent dans Somcraft via /brd edit, avant les spikes.

## Notes

DRIFT DE LA DEMANDE À NE PAS PROPAGER — la demande se termine par « Maxime demande également qu'un BRD soit établi pour l'application Somtech Pack, aujourd'hui absent ». C'est PÉRIMÉ : le BRD existe (v0.1.0, pointer posé ~21 min après la création de la demande, changelog imputant explicitement sa création à D-20260724-0014). Aucune story « établir le BRD » ne figure dans ce découpage — ce serait du travail fantôme qui fausserait la vélocité.

GRAIN — demande au grain application, BRD résolu au grain application, aucun module en jeu : le cas de fallback module→app ne se déclenche pas, aucune dette de traçabilité cross-grain (ADR-031).

ORDRE DES EPICS — E1 (distribution) AVANT E2 (manipulabilité), contre l'intuition. Trois raisons : (a) E1 est à faible risque et entièrement prouvable par des tests automatisés, E2 touche du code qui protège du travail utilisateur non reproductible ; (b) tant que /canvas ne fonctionne pas hors du dépôt somtech-pack, la validation de E2 ne peut se faire que dans le seul environnement où la distribution n'est pas en cause — donc non représentative ; (c) E1 débloque immédiatement l'usage réel de Maxime. L'argument inverse existe et mérite d'être posé : distribuer largement un canvas qui produit des schémas non retouchables, c'est propager le défaut (esprit de RA-DIS-001). Il est écarté parce que RA-DIS-001 porte sur la DÉPENDANCE manquante, pas sur la qualité du rendu, et que /canvas rend déjà un service utile aujourd'hui. Un epic à la fois jusqu'en prod, jamais de bundle (règle d'or n°4).

RÉSILIENCE LIVRÉE AVEC LA PREMIÈRE STORY QUI L'UTILISE (règle d'or n°2) — E1-S3 (« une dépendance absente se dit ») est ordonnée AVANT E1-S4 (exposition globale des commandes) : on n'expose pas /canvas dans toutes les sessions avant que son échec soit explicite et couvert par un test. Le comportement est décrit aujourd'hui dans la commande mais prouvé par aucun test.

SYMÉTRIE VÉRIFIÉE — E1 couvre poste ET projet, installation ET mise à jour, écriture ET préservation (backup). E2 couvre groupes ET liaisons, écriture par l'agent ET dessin à la main, aller ET retour disque→navigateur→disque, schéma neuf ET schéma déjà versionné.

DÉCISIONS ATTENDUES DE MAXIME (3, toutes en E0) : (1) où passe la frontière de périmètre des dépendances d'une capacité du pack ; (2) élargir EF-DIS-004 ou créer EF-DIS-006 pour porter RA-DIS-001 — reco : créer EF-DIS-006, la story de garde-fou est autonome et mérite sa propre traçabilité ; (3) le fichier versionné doit-il porter lui-même groupes et liaisons, indépendamment d'une session de navigateur ouverte (EF-DIA-005) — si oui, cela contraint fortement le résultat du spike E2-S0. Décision optionnelle et hors demande : passer le BRD de draft à accepted.

POINTS DE COMPRESSION SI 16 ITEMS PARAISSENT TROP — E0-S1+E0-S2 fusionnables (même table du BRD, même geste d'édition) ; E2-S4+E2-S5 fusionnables. NE PAS fusionner : E2-S2/E2-S3 (deux gestes utilisateur et deux mécanismes distincts), E1-S2/E1-S5 (poste et projet sont deux chemins d'installation avec deux acceptations différentes), E1-S1/E1-S2 (embarquer et rendre exécutable sont deux livrables de nature différente).

RISQUES À GARDER SOUS LES YEUX PENDANT LA LIVRAISON : régression du correctif de texte tronqué au premier rendu (livré il y a 3 jours, touché frontalement par E2) ; perte partielle de travail dessiné à la main (mode de perte NON couvert par le garde-fou actuel) ; gonflement du paquet publié depuis un poste (la copie du répertoire de travail n'exclut aujourd'hui que deux cas) ; écrasement silencieux d'une commande personnelle du poste (collision réelle constatée sur au moins une commande) ; port du serveur non déclaré à l'inventaire.

FAITS NON VÉRIFIÉS QUI CONDITIONNENT LE DÉCOUPAGE (à lever par les spikes, pas à supposer) : comportement du convertisseur en scène entière dans la version épinglée ; que les commandes déposées dans ~/.claude soient effectivement chargées globalement par Claude Code (postulat d'E1-S4 — si faux, EF-DIS-005 demande une autre mécanique) ; poids réel du paquet ; aucun test n'a été exécuté, aucune installation reproduite de bout en bout.

TRAVAIL BRD — les amendements d'E0 se font DANS SOMCRAFT sur le BRD de l'app, via /brd edit (ou /brd new pour EF-GOV-001 qui ouvre un domaine non encore rédigé), jamais depuis le repo Architecture ni par l'architecte. Aucun brd.yaml à publier : la projection est recalculée à la demande.

## État du référentiel (drift)

Aucun code d'exigence introuvable : la demande ne cite explicitement AUCUN code EF/RA/HS — le rattachement ci-dessus est déduit du contenu (domaines DIA et DIS du BRD app-level v0.1.0), pas d'une citation à vérifier. Deux écarts à signaler tout de même :

1) DRIFT DE LA DEMANDE ELLE-MÊME (obsolescence) — la demande affirme in fine : « Maxime demande également qu'un BRD soit établi pour l'application Somtech Pack, aujourd'hui absent ». C'est PÉRIMÉ : le BRD existe (Somcraft dedb3032-725e-4128-b4f4-2099dd1a5042, /business-requirements/somtech-pack/BRD.md, v0.1.0, statut draft), pointer SD posé le 2026-07-24T18:25:04Z — soit ~21 min APRÈS la création de la demande (18:04:19Z), et son changelog v0.1.0 impute explicitement la création à D-20260724-0014. Conséquence pour le découpage : NE PAS créer de story « établir le BRD Somtech Pack » (déjà fait). Le reste de travail BRD est marginal : le BRD est en statut `draft` (non `accepted`) — une éventuelle story de validation/passage en accepted par le sponsor est possible, mais c'est une décision de Maxime, pas une exigence du BRD.

2) COUVERTURE INCOMPLÈTE DU BRD, assumée et documentée — le §1 du BRD indique explicitement que les domaines non encore rédigés (gouvernance du cycle de livraison, capacités d'agent, marketplace de plugins) le seront quand une demande les touchera, et que « leur absence ici n'est pas un hors-scope » (mécanisme d'amendement STD-033). Les deux domaines nécessaires à CETTE demande (DIS, DIA) sont bien présents → aucun amendement BRD requis avant découpage.

3) Observation, pas drift — les 4 EF cibles (EF-DIA-003, EF-DIA-004, EF-DIS-004, EF-DIS-005) sont au statut `accepted` avec les colonnes « Réalisé par » et « Testé par » VIDES : c'est cohérent avec du travail non encore livré, et c'est exactement ce que le découpage devra remplir (chaque story se trace à l'une de ces 4 EF, et le BRD devra être amendé en fin de livraison pour renseigner « Réalisé par »/« Testé par » et passer les EF en in_force).

4) Grain — demande au grain application (module_id NULL) sur une app sans modules pertinents pour ce chantier ; aucun risque de traçabilité cross-grain (anti-pattern ADR-031) ici.

## Limites de l'analyse

FIABILITÉ DES FAITS — cas favorable : le cwd (/Users/maximeleboeuf/worktrees/somtech-pack/20260724-135928) EST un worktree du repo applicatif concerné (somtech-pack). Les faits techniques de la demande ont donc pu être VÉRIFIÉS directement en lecture seule (aucune écriture effectuée) :

VÉRIFIÉ dans le code :
- `pack.json` (v1.22.0) déclare 5 modules — core (.claude/, scripts/, docs/), features, security, mockmig, plugins. `herdr-plugins/` n'apparaît dans AUCUN module → confirme le problème 2a.
- `cli/scripts/build-payload.mjs` ne copie que les chemins issus de `manifest.modules[*].paths` → le plugin excalidraw ne peut pas être embarqué au publish tant qu'il n'est pas déclaré.
- `herdr-plugins/excalidraw/` existe bien dans le dépôt (server/, web/, scripts/, tests/, herdr-plugin.toml, package.json + package-lock.json) → il a des dépendances npm propres, point d'attention pour la distribution.
- `.claude/commands/` contient 6 commandes dont `canvas.md` (donc distribuée aux PROJETS via le module core) ; côté POSTE, `cli/src/` ne comporte que globalskills.js, globalworkflows.js, userskills.js, userhooks.js — aucun module « globalcommands » → confirme le problème 2b (`pack setup` ne miroite jamais les commandes vers ~/.claude).

NON VÉRIFIÉ (à valider pendant le découpage/l'implémentation, pas ici) :
- Le comportement effectif du générateur de scène `.excalidraw` (absence de `groupIds` et de `boundElements`/`startBinding`/`endBinding`) n'a pas été inspecté ligne à ligne dans `herdr-plugins/excalidraw/` — le problème 1 est repris tel que DÉCRIT par la demande, non re-prouvé par lecture du code.
- Le contenu réel des tests cités par le BRD comme « Testé par » (cli/test/*.test.js, herdr-plugins/excalidraw/tests/*.test.js) n'a pas été ouvert : leur existence est affirmée par le BRD, pas confirmée ici.
- Aucune exécution (`npm test`, `pack setup --dry-run`) n'a été lancée.

SOURCE DU BRD — BRD app-level lu intégralement depuis Somcraft (MCP read_document, include_block_ids=true), pas depuis le filesystem local : c'est bien la source canonique. Aucune projection brd.yaml n'a été calculée (brd_yaml_document_id est NULL et le yaml n'est plus stocké — projection à la demande via `somtech-pack brd project`) ; les EF/RA/HS ci-dessus sont extraits du markdown source. md_block_ids utiles pour un amendement ultérieur : EF DIS = table 429fb55d-7bdb-4d73-ae4c-8915548ee0d0 · RA DIS = ea7b995e-ad5e-4a92-945b-31f60548832e · EF DIA = 3968e4f2-91db-47c5-bb33-d205295e61e0 · RA DIA = ef7f7960-4222-4cf1-8b59-cb4a567c4dbf · changelog = e36b35cd-c4fb-4bb3-9493-5a5e12feafc8.

AUCUNE ÉCRITURE — ni ServiceDesk, ni Somcraft, ni fichier du repo. La demande reste au statut `received`.

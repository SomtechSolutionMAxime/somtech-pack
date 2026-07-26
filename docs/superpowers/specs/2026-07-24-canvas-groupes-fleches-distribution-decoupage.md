# Découpage — D-20260724-0014 · /canvas : diagrammes manipulables et commande réellement distribuée

> **Statut : créé dans ServiceDesk le 2026-07-24.** Verdict `pret_a_creer: true` au 3ᵉ tour de critique adversariale.
> Consignation de l'exercice `/superplan` → `plan-servicedesk`. L'historique complet des critiques (v1 et v2, avec
> les défauts relevés et leurs preuves) est dans le fichier annexe `…-annexe-critiques.md`.

## Ce qui a été créé

| Entité | Code | Titre |
|---|---|---|
| Demande | **D-20260724-0014** | /canvas : diagrammes manipulables à la souris et commande réellement distribuée |
| Epic 1 | **E-20260724-0005** | Après une installation normale du pack, /canvas fonctionne là où je travaille |
| Epic 2 | **E-20260724-0006** | Un schéma produit par l'agent se retouche à la souris sans tout recasser |

| Story | Code | Epic |
|---|---|---|
| Trancher la chaîne de distribution du canvas (spike, 0,5 j) | T-20260724-0018 | E-…-0005 |
| Le paquet publié embarque le canvas, construit depuis les sources | T-20260724-0019 | E-…-0005 |
| Installer ou mettre à jour un projet y dépose un canvas prêt à l'emploi | T-20260724-0020 | E-…-0005 |
| Configurer mon poste installe les commandes du pack | T-20260724-0021 | E-…-0005 |
| Configurer mon poste installe aussi le serveur du canvas | T-20260724-0022 | E-…-0005 |
| Une dépendance absente se dit, elle ne se découvre pas à l'usage | T-20260724-0023 | E-…-0005 |
| La plage de ports du canvas est déclarée, et le poste la réserve | T-20260724-0024 | E-…-0005 |
| La documentation du pack dit que le canvas est livré | T-20260724-0025 | E-…-0005 |
| Trancher où naissent groupes et liaisons, et comment on les prouve (spike, 1 j) | T-20260724-0026 | E-…-0006 |
| Les tests du canvas s'exécutent à chaque changement | T-20260724-0027 | E-…-0006 |
| Je déplace un bloc, tout ce qu'il contient suit | T-20260724-0028 | E-…-0006 |
| Je déplace une forme, les flèches restent accrochées | T-20260724-0029 | E-…-0006 |
| L'agent prouve la manipulabilité avant de rendre compte | T-20260724-0030 | E-…-0006 |
| L'agent n'abîme jamais ce que j'ai corrigé à la main | T-20260724-0031 | E-…-0006 |

## BRD — quatre amendements avant décomposition (règle d'or n°10, STD-033 §2.8)

Le BRD de l'application n'existait pas. Il a été **créé** (v0.1.0) puis **amendé trois fois**, chaque fois AVANT
d'écrire les stories concernées — jamais après :

| Version | Amendement |
|---|---|
| 0.1.0 | Création — domaines DIS (distribution) et DIA (diagrammes), 4 enjeux d'affaires |
| 0.2.0 | EF-DIS-004 élargie au signalement d'une dépendance absente · RA-DIS-004 (un test cité comme preuve s'exécute automatiquement) · EF-DIA-005 (preuve de manipulabilité avant de rendre compte) |
| 0.3.0 | RA-DIA-003 (une écriture de l'agent préserve les groupements et liaisons faits à la main) · RA-DIS-004 étendue à toute exigence déclarant un test |
| 0.4.0 | EF-DIS-002 étendue aux réservations de ports · RA-DIS-003 étendue au poste (EF-DIS-002, EF-DIS-005) |

Source : Somcraft `/business-requirements/somtech-pack/BRD.md` (pointer ServiceDesk à jour, v0.4.0, statut `draft`).

---

## Ce qui a changé depuis v2

| Défaut | Correction appliquée |
|---|---|
| M1 — E1 promettait un bout-en-bout au poste qu'aucune story ne livrait | Ajout de **E1-S5** (le poste reçoit aussi le serveur du canvas) ; le « Résultat attendu » d'E1 dit désormais ce que chaque voie d'installation fournit |
| M2 — l'option « paquet distinct » du spike pouvait annuler l'« Alors » d'E1-S2 | E1-S1 est borné à deux options compatibles avec EF-DIS-003 ; l'option « paquet publié séparément » est explicitement écartée et la raison est dite |
| M3 — E1-S7 s'appuyait sur un fichier hors dépôt, non testable, et traçait mal | La plage est déclarée dans un fichier **versionné du dépôt**, et la configuration du poste la fusionne dans l'inventaire local — les deux sont testables |
| M4 — E2-S6 livrait une garantie que le BRD n'énonçait pas | **RA-DIA-003** ajoutée au BRD v0.3.0 ; la story s'y trace |
| m — E1-S4 (update) redondante avec E1-S3 | Fusionnée dans E1-S3, qui couvre installation **et** mise à jour |
| m — E1-S8 critère infalsifiable | « Alors » restreint au canvas |
| m — E2-S2 tracée à EF-DIS-003 | Tracée à EF-DIA-001 + EF-DIA-002, qui portent les tests concernés (RA-DIS-004 élargie les encadre) |
| m — E1-S6 prescrivait la solution dans l'acceptation | Le « comment » est passé en description ; le « Alors » ne garde que l'observable |
| m — E1-S1 critère circulaire | Membre « les stories deviennent écrivables » retiré |
| m — ordre auto-contradictoire | E2-S2 remonté en position 2 |
| m — amendement final du BRD sans porteur | Devenu **critère de fermeture** des deux epics |

## Exigences disponibles (BRD Somtech Pack v0.3.0)

| ID | Énoncé | Statut |
|---|---|---|
| EF-DIS-001 | Installer et mettre à jour le pack dans un projet en une commande, par modules sélectionnables. | in_force |
| EF-DIS-002 | Configurer un poste de travail (compétences et workflows globaux, lanceur de session) en une commande. | in_force |
| EF-DIS-003 | Le paquet publié embarque le contenu de tous les modules déclarés, construit depuis les sources du dépôt. | in_force |
| EF-DIS-004 | Toute capacité livrée par le pack est installée avec les dépendances d'exécution dont elle a besoin, et signale clairement leur absence plutôt que d'échouer à l'usage. | accepted |
| EF-DIS-005 | Une session ouverte hors du dépôt somtech-pack dispose des commandes du pack au même titre que de ses compétences. | accepted |
| EF-DIA-001 | Ouvrir un canvas nommé, versionné dans le dépôt du projet et partagé entre l'agent et l'humain. | in_force |
| EF-DIA-002 | L'agent dessine dans le canvas et vérifie le rendu obtenu avant de rendre compte de son travail. | in_force |
| EF-DIA-003 | Les éléments d'un même bloc logique sont groupés, de sorte qu'un déplacement à la souris les emporte ensemble. | accepted |
| EF-DIA-004 | Les flèches sont liées aux formes qu'elles relient et suivent leur déplacement. | accepted |
| EF-DIA-005 | L'agent vérifie que le schéma est réellement manipulable (blocs groupés, flèches liées) avant de rendre compte, et pas seulement qu'il s'affiche correctement. | accepted |
| RA-DIS-001 | Une capacité dont la dépendance d'exécution n'est pas distribuée n'est pas exposée à l'utilisateur. (encadre EF-DIS-004) | accepted |
| RA-DIS-002 | Le contenu publié est toujours construit depuis les sources du dépôt, jamais recopié à la main. (encadre EF-DIS-003) | in_force |
| RA-DIS-003 | Un fichier déclaré à préserver n'est jamais écrasé; tout écrasement laisse une copie de secours. (encadre EF-DIS-001) | in_force |
| RA-DIS-004 | Tout test cité comme preuve d'une exigence du pack s'exécute automatiquement à chaque changement du dépôt. (encadre EF-DIS-001/002/003, EF-DIA-001/002) | accepted |
| RA-DIA-001 | Un schéma produit par l'agent reste éditable à la souris sans que l'agent doive le réécrire. (encadre EF-DIA-003/004/005) | accepted |
| RA-DIA-002 | L'agent ne remplace jamais une scène non vide par une scène vide. (encadre EF-DIA-002) | in_force |
| RA-DIA-003 | Une écriture de l'agent préserve les groupements et les liaisons créés à la main par l'humain. (encadre EF-DIA-003/004) | accepted |

## Faits vérifiés dans le dépôt (lecture seule)

- `pack.json` v1.22.0 : 5 modules (core, features, security, mockmig, plugins) ; `herdr-plugins/` dans aucun ; `preserve` = `.claude/settings.json` seul.
- `cli/scripts/build-payload.mjs` ne copie que `manifest.modules[*].paths` (exclut `.DS_Store` et les liens symboliques).
- `herdr-plugins/excalidraw/` : 24 fichiers suivis ; `server/`, `web/` (source), `scripts/`, `tests/` (4 fichiers) ; `node_modules` et `web/dist` ignorés par git ; **`.herdr/canvas.excalidraw` est versionné par erreur** (résidu d'exécution).
- `cli/src/commands/setup.js` miroite user-skills, skills globaux, workflows globaux, lanceur de session, hooks — **aucun miroir des commandes**.
- `.claude/commands/canvas.md` cherche le serveur dans trois localisations, dont `~/.claude/herdr-plugins/excalidraw`, **qu'aucune installation ne peuple aujourd'hui**.
- `cmdInit` et `cmdUpdate` partagent le même `runApply` : la convergence, la copie de secours et la préservation sont déjà implémentées et testées (`cli/test/cli.test.js`).
- Ports : `DEFAULT_PORT = 4870`, `4870 + hash(nom) % 100`, jusqu'à 20 tentatives → plage **4870-4989**. `~/.claude/ports-inventory.json` existe sur le poste, ne mentionne pas le canvas, et n'a aucun équivalent versionné dans le dépôt.
- `.github/workflows/tests.yml` : 3 jobs (shell, CLI, python). **Aucun n'exécute les tests du canvas.**
- `docs/diagrams/pack-skills-workflows.excalidraw` : 564 éléments, 69 flèches, **0 liaison, 0 groupe, 0 texte rattaché à sa forme**.
- `README.md` et `CLAUDE.md` : zéro occurrence de « canvas » ou « excalidraw ».

---

## E1 — Après une installation normale du pack, `/canvas` fonctionne là où je travaille

**Problème** — La commande `/canvas` est livrée aux projets par le module `core`, mais le serveur dont elle dépend (`herdr-plugins/excalidraw/`) n'est déclaré dans aucun module : il n'est ni embarqué au paquet publié, ni installé nulle part. La commande échoue donc à sa première étape chez tout projet installé. Côté poste, la configuration ne miroite que les compétences et les workflows : aucune commande du pack n'existe hors du dépôt qui la produit.

**Résultat attendu** — Après installation ou mise à jour d'un projet, `/canvas` s'exécute de bout en bout dans ce projet. Après configuration d'un poste, la commande `/canvas` **et** le serveur dont elle dépend sont disponibles pour toute session, y compris hors d'un projet installé. Quand une dépendance manque malgré tout, elle est nommée explicitement au lieu d'échouer à l'usage.

**Hors-scope** — Installer les dépendances système du poste (HS-DIS-001). Refondre le mécanisme de modules du pack.

**Critère de fermeture de l'epic** — Les exigences réalisées (EF-DIS-004, EF-DIS-005) sont amendées au BRD : colonnes « Réalisé par » et « Testé par » renseignées, statut passé à `in_force`.

### E1-S1 — Trancher la chaîne de distribution du canvas (spike, 0,5 j)

- **Exigence tracée** : EF-DIS-004 · **Niveau de test** : N/A (spike, aucun code de production)
- **Description** — Le serveur du canvas est une application web avec ses propres dépendances et une page à construire ; `web/dist` et `node_modules` sont volontairement absents du dépôt. Deux voies restent ouvertes : embarquer la page déjà construite dans le paquet publié, ou la construire au moment de l'installation. La troisième voie envisagée — publier le plugin comme paquet indépendant — est **écartée d'emblée** : elle sortirait le canvas du périmètre d'EF-DIS-003 et de RA-DIS-002, qui veulent que tout ce que le pack livre vienne de ses modules déclarés.
- **Étant donné** ces deux voies et les contraintes du dépôt
- **Quand** on les évalue sur le poids ajouté au paquet, la reproductibilité de la construction et le temps d'installation constaté
- **Alors** une note de décision datée est déposée dans `docs/`, nommant la voie retenue, la liste des fichiers à inclure, la liste nominative des résidus à exclure (`node_modules`, fichiers de port, journaux, sauvegardes `.bak`), et le poids ajouté mesuré

### E1-S2 — Le paquet publié embarque le canvas, construit depuis les sources

- **Exigence tracée** : EF-DIS-003 + EF-DIS-004 (encadrées par RA-DIS-002) · **Niveau de test** : unit + L3 (tests du CLI)
- **Description** — Déclarer `herdr-plugins/` comme contenu d'un module du pack, et étendre la construction du paquet en conséquence. Profiter du passage pour retirer du dépôt le fichier d'exécution `herdr-plugins/excalidraw/.herdr/canvas.excalidraw`, versionné par erreur.
- **Étant donné** un paquet construit selon la voie retenue au spike
- **Quand** on inspecte le contenu du paquet produit
- **Alors** il contient le serveur du canvas et ce qu'il faut pour le démarrer, il ne contient aucun des résidus nommés au spike, et tout son contenu provient des sources du dépôt ; un test du CLI échoue si le canvas est absent du paquet, et un autre échoue si un résidu s'y trouve

### E1-S3 — Installer ou mettre à jour un projet y dépose un canvas prêt à l'emploi

- **Exigence tracée** : EF-DIS-001 + EF-DIS-004 (encadrées par RA-DIS-003) · **Niveau de test** : L3 (tests du CLI) + validation humaine sur un projet réel
- **Étant donné** d'une part un projet vierge, d'autre part un projet déjà installé avec une version antérieure du pack où un fichier appartenant au pack a été personnalisé
- **Quand** on lance l'installation dans le premier et la mise à jour dans le second
- **Alors** les deux projets disposent du canvas démarrable, `/canvas <nom>` y ouvre un canvas sans étape manuelle supplémentaire, et le fichier personnalisé du second n'a pas été écrasé sans copie de secours ; un test du CLI échoue si l'un des deux chemins ne dépose pas le canvas

### E1-S4 — Configurer mon poste installe les commandes du pack

- **Exigence tracée** : EF-DIS-005 (encadrée par RA-DIS-003) · **Niveau de test** : L3 (tests du CLI, calqués sur ceux du miroir des compétences)
- **Étant donné** un poste dont le répertoire de commandes personnelles contient une commande qui n'appartient pas au pack
- **Quand** on lance la configuration du poste
- **Alors** les commandes du pack (dont `/canvas`) sont disponibles dans toute session, la commande personnelle est intacte, et tout écrasement d'une commande appartenant au pack laisse une copie de secours ; un test échoue si une commande du pack manque, et un autre échoue si la commande personnelle a été touchée

### E1-S5 — Configurer mon poste installe aussi le serveur du canvas

- **Exigence tracée** : EF-DIS-004 (réalise RA-DIS-001) · **Niveau de test** : L3 (tests du CLI) + validation humaine sur poste réel
- **Description** — La commande cherche déjà le serveur dans un emplacement de poste ; aujourd'hui personne ne le remplit. Sans cette story, `/canvas` reste inutilisable hors d'un projet installé, alors que la commande, elle, y sera disponible.
- **Étant donné** un poste configuré et une session ouverte **hors** de tout projet ayant reçu le pack
- **Quand** on lance `/canvas <nom>`
- **Alors** le serveur est trouvé à l'emplacement de poste et le canvas s'ouvre ; un test échoue si la configuration du poste ne dépose pas le serveur à cet emplacement

### E1-S6 — Une dépendance absente se dit, elle ne se découvre pas à l'usage

- **Exigence tracée** : EF-DIS-004 (réalise RA-DIS-001) · **Niveau de test** : L3
- **Description** — La logique de résolution vit aujourd'hui en prose dans le fichier de la commande, ce qui n'est pas testable. La déplacer dans un script versionné du pack que la commande appelle est la voie envisagée ; la conception exacte reste au réalisateur tant que le comportement observable est tenu.
- **Étant donné** un environnement où le serveur du canvas est introuvable dans toutes les localisations connues
- **Quand** on demande à ouvrir un canvas
- **Alors** la résolution sort en erreur avec un code de sortie non nul et un message qui nomme la dépendance manquante et le geste pour l'installer ; un test échoue si la résolution sort en succès alors que la dépendance est absente, et un autre échoue si le message ne nomme pas le geste correctif

### E1-S7 — La plage de ports du canvas est déclarée, et le poste la réserve

- **Exigence tracée** : EF-DIS-002 · **Niveau de test** : L3 (tests du CLI)
- **Description** — Le serveur choisit son port dans une plage calculée (base plus décalage, plusieurs tentatives). Aujourd'hui cette plage n'est écrite nulle part et l'inventaire des ports du poste l'ignore.
- **Étant donné** la plage de ports réellement utilisée par le serveur, déclarée dans un fichier **versionné du dépôt**, et un inventaire de ports de poste qui ne mentionne pas le canvas
- **Quand** on lance la configuration du poste
- **Alors** l'inventaire du poste contient la plage réservée au canvas, les réservations préexistantes sont intactes, et un test échoue si la plage déclarée dans le dépôt ne correspond plus à celle que le code calcule

### E1-S8 — La documentation du pack dit que le canvas est livré

- **Exigence tracée** : EF-DIS-004 · **Niveau de test** : N/A (documentation)
- **Étant donné** la documentation du dépôt qui énumère les modules et ce que chacun installe
- **Quand** un nouvel arrivant la lit pour savoir ce qu'il obtient après installation
- **Alors** le canvas y figure explicitement, avec le module qui le porte, la commande qui l'utilise et le prérequis de poste éventuel

---

## E2 — Un schéma produit par l'agent se retouche à la souris sans tout recasser

**Problème** — Les éléments écrits dans le fichier de schéma sont posés à plat : aucun groupe, et les flèches ne déclarent pas les formes qu'elles relient. Déplacer une boîte à la souris laisse donc son texte derrière et détache les flèches. Le seul diagramme versionné du dépôt le confirme : 564 éléments, 69 flèches, aucune liaison, aucun groupe. L'agent, lui, ne regarde qu'une image du rendu — où ni un groupe ni une liaison ne se voient : il peut annoncer un travail fait alors que le schéma n'est pas manipulable. Et comme il écrit directement dans le fichier, rien ne protège aujourd'hui ce que l'humain y a groupé ou accroché à la main.

**Résultat attendu** — Un schéma produit par l'agent se retouche à la souris comme un schéma dessiné à la main : on attrape un bloc, tout suit ; on déplace une forme, les flèches restent accrochées ; ce qu'on a corrigé soi-même survit à l'intervention suivante de l'agent. L'agent le prouve avant de rendre compte.

**Hors-scope** — Le dessin collaboratif temps réel multi-utilisateurs (HS-DIA-001). La reprise des diagrammes déjà versionnés, à décider après coup.

**Critère de fermeture de l'epic** — Les exigences réalisées (EF-DIA-003, EF-DIA-004, EF-DIA-005) sont amendées au BRD : « Réalisé par » et « Testé par » renseignés, statut passé à `in_force`.

### E2-S1 — Trancher où naissent groupes et liaisons, et comment on les prouve (spike, 1 j)

- **Exigence tracée** : EF-DIA-003 + EF-DIA-004 · **Niveau de test** : N/A (spike, aucun code de production)
- **Étant donné** que groupes et liaisons peuvent être produits par l'agent au moment où il écrit le fichier, ou normalisés par le serveur à l'écriture, et que l'état du fichier versionné doit pouvoir être contrôlé sans session de navigateur ouverte
- **Quand** on éprouve les deux approches sur le format réel du fichier et sur le comportement du serveur à l'écriture
- **Alors** une note de décision datée nomme l'approche retenue, la façon de contrôler le fichier versionné hors navigateur, et le comportement attendu quand l'humain édite ensuite le schéma à la main

### E2-S2 — Les tests du canvas s'exécutent à chaque changement

- **Exigence tracée** : EF-DIA-001 + EF-DIA-002 (réalise RA-DIS-004) · **Niveau de test** : L3 (chaîne d'intégration)
- **Étant donné** que le BRD cite quatre fichiers de tests du canvas comme preuve de ces deux exigences, et qu'aucun ne s'exécute automatiquement
- **Quand** un changement est poussé sur le dépôt
- **Alors** ces tests s'exécutent dans la chaîne d'intégration et un échec bloque la livraison ; introduire volontairement un défaut dans le serveur du canvas fait échouer la chaîne, ce qui n'arrivait pas avant

### E2-S3 — Je déplace un bloc, tout ce qu'il contient suit

- **Exigence tracée** : EF-DIA-003 (réalise RA-DIA-001) · **Niveau de test** : L3 (structure du fichier) + validation humaine (geste souris)
- **Étant donné** un schéma que l'agent vient de produire, comportant des blocs composés (au minimum une forme et son texte)
- **Quand** on inspecte le fichier produit, puis qu'on déplace un bloc à la souris dans le canvas
- **Alors** chaque bloc composé est déclaré comme un groupe dans le fichier et le déplacement emporte tout le bloc ; un test échoue si un schéma produit par l'agent contient un texte non rattaché à sa forme

### E2-S4 — Je déplace une forme, les flèches restent accrochées

- **Exigence tracée** : EF-DIA-004 (réalise RA-DIA-001) · **Niveau de test** : L3 (structure du fichier) + validation humaine (geste souris)
- **Étant donné** un schéma que l'agent vient de produire, comportant des flèches entre formes
- **Quand** on inspecte le fichier produit, puis qu'on déplace une forme reliée
- **Alors** chaque flèche déclare la forme de départ et la forme d'arrivée qu'elle relie, et son tracé suit le déplacement ; un test échoue si une flèche censée relier deux formes n'est liée à aucune des deux

### E2-S5 — L'agent prouve la manipulabilité avant de rendre compte

- **Exigence tracée** : EF-DIA-005 · **Niveau de test** : L3
- **Étant donné** un schéma que l'agent vient d'écrire
- **Quand** l'agent s'apprête à rendre compte de son travail
- **Alors** il contrôle le fichier versionné sans dépendre d'une session de navigateur, et refuse de déclarer le travail fait si un bloc composé n'est pas groupé ou si une flèche censée relier deux formes n'est liée à aucune ; un test échoue si un schéma non manipulable passe ce contrôle

### E2-S6 — L'agent n'abîme jamais ce que j'ai corrigé à la main

- **Exigence tracée** : EF-DIA-003 + EF-DIA-004 (réalise RA-DIA-003) · **Niveau de test** : L3
- **Étant donné** un schéma où l'humain a groupé des éléments et accroché des flèches à la souris
- **Quand** l'agent écrit ensuite dans ce même schéma
- **Alors** les groupements et les liaisons faits à la main survivent à l'écriture de l'agent ; un test échoue si une écriture de l'agent dissocie un groupe existant ou détache une flèche liée

---

## Ordre recommandé

1. **E1-S1** — spike distribution ; débloque E1-S2 et E1-S3.
2. **E2-S2** — mise sous chaîne d'intégration des tests du canvas ; sans elle, aucune preuve d'E2 ne vaut, et elle est indépendante du reste.
3. **E1-S2 → E1-S3 → E1-S4 → E1-S5 → E1-S6** — la commande devient réellement disponible, projet puis poste.
4. **E1-S7, E1-S8** — finitions, parallélisables.
5. **E2-S1** — spike groupes et liaisons ; débloque la suite d'E2.
6. **E2-S3 → E2-S4 → E2-S5 → E2-S6**.

Les dépendances entre stories sont inscrites dans les « Étant donné » (et non seulement dans cette prose) partout où elles conditionnent la rédaction du critère.

## Points laissés ouverts, assumés

- La reprise des diagrammes déjà versionnés (dont celui à 564 éléments) est hors périmètre : à décider une fois E2 livré.
- Le BRD reste en statut `draft` ; le faire passer à `accepted` est une décision de sponsor, hors de cette demande.

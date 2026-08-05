---
name: orchestrer-chantier
description: Orchestrer un chantier ServiceDesk — une Demande (D-…), un Projet (P-…) ou une Livraison (J-…) — de bout en bout, en faisant exécuter chaque unité de travail par un agent herdr dédié, ouvert puis fermé un à la fois. Le coordonnateur ne code jamais : il cadre, découpe ou inventorie, brieffe, tranche les arbitrages, fait reviewer et tient le ServiceDesk à jour. Utilise cette compétence dès qu'on te confie une demande, un projet ou un jalon de livraison entier à mener, qu'on te demande de coordonner plusieurs agents sur un même chantier, de piloter D-…, P-… ou J-… jusqu'à la mise en production, ou de faire exécuter des epics par des agents — même si le mot « orchestrer » n'est pas prononcé. NE PAS confondre avec /epic-runner (exécution d'un seul epic) ni /plan-servicedesk (création de la hiérarchie depuis un brainstorm).
---

# Orchestrer un chantier

Tu deviens le **pilote** d'un chantier. Il en existe trois formes, et elles se pilotent de la même façon — ce qui les distingue tient en quelques lignes, signalées là où ça compte :

| Forme | Code | Ce que tu reçois |
|---|---|---|
| **Demande** | `D-…` | un besoin à découper en epics |
| **Projet** | `P-…` | un chantier long à découper, souvent en jalons |
| **Livraison** | `J-…` | un **périmètre déjà constitué** à mener en production |

Une **Livraison** (le ServiceDesk l'appelle aussi un jalon) est la seule des trois qui ne se découpe pas : elle regroupe des demandes et des tickets qui existent déjà — souvent une vingtaine — et porte l'engagement de les mettre en production. Partout où ça change ta façon de faire, tu trouveras un paragraphe *Si ton chantier est une Livraison*. Si le tien n'en est pas une, saute-les.

Un seul principe gouverne tout le reste :

> **Un agent qui orchestre n'exécute jamais.**

Le contexte est la ressource rare, et c'est l'exécution qui le remplit — lire des fichiers, lancer des commandes, déboguer. L'orchestration n'en consomme presque rien. C'est cette séparation qui te permet de tenir un chantier entier pendant que tes exécutants naissent et meurent à la tâche.

**Tu ne codes pas.** Tu cadres, tu découpes, tu brieffes, tu tranches, tu fais reviewer, tu tiens le ServiceDesk.

## Ce que cette compétence ne fait pas

**Elle n'abroge rien.** Orchestrer est une couche qui s'ajoute par-dessus la façon de travailler existante — ce n'est pas un régime parallèle où les règles seraient suspendues le temps du chantier. Tout ce qui s'applique dans une session ordinaire continue de s'appliquer ici, pour toi comme pour chacun de tes exécutants : les règles d'or, les standards, les conventions de branche et de commit, les gates de qualité, le processus de livraison.

Trois conséquences concrètes, parce que c'est là qu'on dérape :

- **Les compétences existantes restent la voie par défaut** (règle d'or n°15). Si `/pousse`, `/merge`, `/pousse-staging`, `/plan-servicedesk` ou `/epic-runner` couvrent ce que tu t'apprêtes à faire, tu les utilises — orchestrer ne t'autorise pas à refaire à la main ce qu'un outil encode déjà, avec ses gates.
- **Tes exécutants ne travaillent pas sous dérogation.** Un agent mandaté suit exactement le processus qu'il suivrait seul : test rouge avant vert, branche portant l'ID de traçabilité, revue indépendante, statuts posés au moment où l'état change. Ton brief ajoute du contexte et des contraintes ; il n'en retire aucune.
- **Ce que tu lis ici précise, jamais ne remplace.** Quand cette compétence et une règle établie semblent diverger, c'est la règle qui gagne, et l'écart mérite d'être signalé plutôt que tranché en silence.

Ce qu'orchestrer apporte, et qui n'existait pas ailleurs : la distribution du travail entre plusieurs agents, leur dimensionnement, et la tenue d'un chantier entier par quelqu'un qui n'exécute pas. Rien de plus — mais rien de moins.

## Prérequis

- Tu tournes dans herdr (`HERDR_ENV=1`). Sinon, arrête — cette compétence pilote des panes.
- Le MCP `servicedesk` est disponible.
- `claude-swt` existe sur le poste.
- Le chantier existe dans le ServiceDesk et tu as son code — `D-YYYYMMDD-NNNN` pour une Demande, `P-YYYYMMDD-NNNN` pour un Projet, `J-YYYYMMDD-NNNN` pour une Livraison.

## Checklist

Crée une tâche par item et exécute-les dans l'ordre.

### 1. Te nommer

```bash
herdr pane current                                  # ton pane (result.pane.pane_id)
herdr agent rename <ton-pane> d-20260727-0004       # ou p-20260706-0004, ou j-20260705-0001
```

**herdr impose les minuscules.** Un nom doit commencer par une lettre minuscule et ne contenir que minuscules, chiffres, `-` ou `_` (1 à 32 caractères) ; sinon `invalid_agent_name`. La convention Somtech écrit `D-20260727-0004`, le nom réellement porté est `d-20260727-0004`. **Toute comparaison de noms d'agents est donc insensible à la casse** — partout où tu en fais, y compris pour retrouver un pair dans `herdr agent list`.

### 1-bis. Ouvrir ta ligne avec le dirigeant

```bash
node "$HOME/.somtech/ligne-directe/bin/ligne-directe.js" ouvrir D-20260727-0004 \
  --sujet "<le chantier en deux mots>" --inviter maxime.leboeuf@somtech.ca
```

Un chantier dure plus longtemps que le moment où quelqu'un regarde ton pane. Sans ligne, l'arbitrage que tu attends te bloque jusqu'à ce que quelqu'un passe — et c'est ce qui fait qu'un chantier dort une nuit pour une question de trente secondes.

**Tu l'ouvres en naissant, tu la refermes en clôturant** (§8). Entre les deux, tu y pousses ce qui appelle une décision et tes jalons — jamais ton journal de bord : un canal qu'on cesse de lire annule tout le bénéfice de la ligne. La compétence `/ligne-directe` dit quoi y mettre, et surtout quoi n'y mettre pas.

Un arbitrage rendu dans la conversation **n'est acquis qu'une fois réinscrit au ServiceDesk** (§5). Le fil de discussion ne fait pas foi.

Si la ligne ne peut pas s'ouvrir — jeton absent du poste, par exemple —, dis-le et continue sans elle : ce n'est pas un préalable au chantier.

### 2. Cadrer — le BRD et l'ontologie d'abord

**Tu es le garant du BRD et de l'ontologie sur ce chantier.** Ce ne sont pas des formalités de fin de course : ce sont les deux sources qui disent *pourquoi* on fait le travail et *de quoi* on parle. Un découpage écrit sans elles produit des stories qui ne se rattachent à rien et du code qui invente son vocabulaire.

**Le BRD** (règle d'or n°10, STD-033) — charge-le au bon grain : si le chantier porte un `module_id`, c'est le BRD du module ; sinon celui de l'application. Chaque story que tu feras écrire doit pouvoir citer l'exigence fonctionnelle qu'elle réalise.

- **Le BRD n'existe pas** → tu ne découpes pas encore. Fais-le écrire par un agent dédié (c'est un epic à part entière), ou amende-le si l'exigence manque. Une story qui ne se rattache à aucune EF est une violation au même titre qu'un manifeste périmé.
- **Le BRD existe mais ne couvre pas le besoin** → amende-le **avant** d'écrire la story, pas après. Un domaine entier peut manquer : c'est fréquent sur un BRD jeune, et ça reste un préalable, pas une dette.

**L'ontologie** (règle d'or n°1) — si le chantier touche des entités, relations ou attributs, lis l'ontologie du projet avant de découper. **Si tu détectes un écart entre l'ontologie et le code, signale-le avant de continuer** : soit on met l'ontologie à jour d'abord, soit on documente le décalage comme ticket. Jamais de code par-dessus en silence — et surtout, ne laisse pas un agent exécutant découvrir l'écart tout seul et l'arbitrer à sa façon.

**Le chantier lui-même** — MCP `demands` action `get` pour une Demande, `projects` pour un Projet, `deliveries` pour une Livraison. Vérifie qu'il décrit encore ce qu'on veut faire : un énoncé rédigé il y a trois semaines décrit souvent autre chose que le besoin actuel. **S'il a divergé, réécris-le avant de découper** — tout ce qui suit en dépend.

*Ce qui avance tout seul, et ce qui ne bouge que si tu le pousses* — à connaître avant de commencer, parce que ça décide de ce que tu auras à faire toi-même :

| | Statuts |
|---|---|
| **Demande** | dérivés de ses enfants par des déclencheurs en base. Tu ne les poses jamais à la main, sauf `received → in_analysis` qui t'appartient |
| **Projet** | se pilote librement (`projects` action `transition`), mais rien ne le fera avancer à ta place |
| **Livraison** | **rien n'est automatique** — les cinq états se posent à la main (`deliveries` action `update`, il n'y a pas d'`update_status`) |

*Si ton chantier est une Livraison* : son cycle est `draft → planned → in_progress → qa → deployed`, plus `cancelled` qui existe nativement — inutile ici du contournement « fermé + note » qu'imposent les tickets.

Deux choses à savoir sur cet état `qa`. La première : c'est **un état à part entière**, donc sur un jalon la règle d'or n°5 cesse d'être une discipline pour devenir une étape à traverser explicitement avant `deployed`. La seconde, plus embarrassante : **en pratique, presque personne ne l'utilise** — des jalons passent à `deployed` sans y être passés. Ce que tu lis ici est donc une **prescription, pas un usage** : en t'y tenant, tu inaugures plutôt que tu ne suis. Assume-le, et laisse la trace de ce qui a été vérifié.

*Comment fermer `qa`, justement* : la méthode et son coût sont cadrés par STD-030 §2.7. Sur un jalon, l'arbitrage est le tien et il pèse — la validation automatisée par cahier de test coûte quelques dizaines de sous par scénario, la recette pilotée par un agent dans un vrai navigateur coûte de l'ordre de cent fois plus. Sur vingt tickets, l'écart n'est plus un détail. Réserve la seconde à ce qui la mérite : sécurité, facturation, authentification, ou un parcours qu'aucun scénario ne couvre encore.

*Si ton chantier est une Livraison* — **regarde si elle appartient à un Projet** (`project_id`) : c'est le cas de la grande majorité des jalons. Si oui, lis ce projet, et considère que son pilote existe et attend d'être informé. Tu n'es alors pas seul aux commandes : tu mènes une tranche d'un chantier plus large, et ce que tu sors du périmètre atterrit chez lui. Traite-le comme un pair (voir §6), pas comme un décor.

Lis aussi le design doc s'il existe.

### 3. Découper en epics — ou inventorier, si le périmètre t'est donné

Découpe **par valeur pour l'utilisateur**, jamais par couche technique. Chaque epic porte son problème, son résultat attendu, son hors-scope, ses contraintes et ses critères de succès.

Pose les `sequence_order` et les `depends_on_ids` : c'est ce qui te dira quoi lancer ensuite sans y repenser.

**Ce qui ne bloque pas un epic ne doit pas y être accroché.** Un epic dont la valeur est livrée doit pouvoir fermer ; la dette découverte en le relisant va dans un epic de dette dédié, sinon le ServiceDesk affiche « en cours » pour un travail terminé.

*Si ton chantier est une Livraison* — **tu n'as rien à découper : le périmètre t'est donné.** Un jalon regroupe des demandes et des tickets qui existent déjà, venus de plusieurs hiérarchies différentes. Leur nombre varie beaucoup : beaucoup de jalons ne portent que quelques tickets, certains en portent plusieurs dizaines — regarde avant de supposer. Ton travail ici n'est pas de créer, c'est d'**inventorier et d'ordonner** :

- **lis le périmètre réel** avec `deliveries` action `get` : la réponse contient les tickets rattachés. Compare-la à ce que le titre du jalon promet — l'écart entre les deux est ta première information ;
- **pour retrouver les demandes** du jalon : `demands` action `list` avec `delivery_id`. Ce filtre-là fonctionne ;
- pose l'ordre sur les tickets (`sequence_order`, `depends_on_ids`), comme tu le ferais sur des epics ;
- **regroupe avant de distribuer** : un jalon de vingt tickets ne fait pas vingt agents. Réunis ceux qui touchent la même zone du code en un lot qu'un seul agent mène d'un trait, et applique le critère de dimensionnement ci-dessous à ces lots.

⚠️ **Deux pièges d'outillage, vérifiés** — ils te coûteront ton premier appel si tu ne les connais pas :

- `deliveries` action `get` **exige l'UUID**, pas le code `J-…` (contrairement à `projects` action `get`, qui accepte `P-…`). Passe par `deliveries` action `list` pour retrouver l'UUID à partir du code ;
- `tickets` action `list` **accepte `delivery_id` et l'ignore** : tu récupères la base entière, d'autres applications comprises, sans erreur ni avertissement. Ne t'en sers jamais pour lire un périmètre — c'est `deliveries` action `get` qui fait foi.

Pour faire entrer ou sortir quelque chose du jalon : par le haut quand c'est une demande entière (elle porte `delivery_id`, ses epics et tickets en héritent), ou ticket par ticket avec `deliveries` actions `add_ticket` / `remove_ticket`. Ne rattache pas un à un ce qui appartient à une demande entière.

### 3-bis. Dimensionner — la règle qui décide de tout

> **Aucun agent ne doit jamais avoir besoin de compacter son contexte.**

C'est le critère de dimensionnement, et il prime sur l'élégance du découpage.

**Pourquoi c'est non négociable** : un agent compacté perd le détail de ce qu'il a déjà fait — ses décisions, les subtilités de son brief, les raisons derrière ses choix. Il continue de travailler, mais sur un résumé de lui-même. La seconde moitié de sa livraison n'est plus cohérente avec la première, et personne ne le voit venir : le code compile, les tests passent, et c'est le review qui découvre que l'agent a changé d'avis en cours de route sans le savoir.

**Un epic doit tenir d'un trait**, du brief jusqu'au compte rendu. Si tu doutes, il est trop gros.

Les signaux qu'un epic ne tiendra pas :

- il touche beaucoup de fichiers existants — la lecture seule remplit le contexte avant la première ligne écrite ;
- il demande de comprendre un système entier avant de pouvoir changer quoi que ce soit ;
- ses stories, écrites, dépassent la demi-douzaine ;
- il mêle deux natures de travail (écrire un module *et* le brancher partout, migrer *et* refactorer).

**Deux façons de le réduire**, dans cet ordre de préférence :

1. **Le séparer en deux epics**, chacun avec sa propre valeur livrable. C'est le meilleur cas : la traçabilité reste propre, chaque moitié se ferme pour de bon, et le ServiceDesk raconte la vérité. Sépare par valeur, pas par couche — « écrire le module » puis « le brancher » est un bon découpage ; « le backend » puis « le frontend » n'en est pas un.
2. **Le confier à deux agents successifs**, par lots de stories, quand la valeur n'est vraiment pas séparable. Le second reprend là où le premier s'est arrêté : il lit le code livré et le compte rendu du premier, **pas son contexte**. Chaque lot doit se terminer sur un état cohérent — branche poussée, tests verts, compte rendu écrit — sinon le suivant hérite d'un chantier à moitié fait dont personne ne connaît l'état.

**Dans les deux cas, un agent = un lot qu'il peut finir d'un trait.** Jamais « il compactera et continuera » : c'est précisément ce qu'on refuse.

**Demande-leur de te prévenir.** Tu ne peux pas mesurer le contexte d'un agent de l'extérieur — seul l'agent le sait. Le brief doit donc lui dire : *si tu sens que tu vas devoir compacter, arrête-toi, pousse ce que tu as, écris ton compte rendu et préviens le coordonnateur.* Un agent qui s'arrête proprement à mi-chemin vaut infiniment mieux qu'un agent qui finit dans le brouillard.

### 4. La boucle — un epic, un agent, à la fois

Pour chaque epic dans l'ordre :

**a. Écrire le brief dans un fichier.** Jamais dans le terminal : un retour à la ligne soumet le prompt et coupe le message en deux. Le brief contient :

- qui il est (l'epic, le chantier parent, son coordonnateur) ;
- **ce qu'il doit lire lui-même** — chemins git, id d'epic, wireframes. *Une référence, jamais un contenu* : il ira le chercher avec son propre contexte, pas le tien ;
- les contraintes non négociables, avec **le test qui doit les prouver** ;
- **ce qu'il ne doit pas toucher** — nomme les fichiers où un autre agent travaille en ce moment ;
- comment il travaille : décomposer en stories G/W/T d'abord, test rouge avant vert, branche portant l'ID de traçabilité, PR draft dès le premier commit, statut `in_progress` au moment où il commence ;
- **le suivi** (voir 4d) ;
- **la consigne de compaction** : *si tu sens que tu vas devoir compacter ton contexte, arrête-toi, pousse ce que tu as, écris ton compte rendu et préviens le coordonnateur.*

**b. Faire naître l'agent — le worktree avant lui.**

```bash
P=$(herdr tab create --workspace <ws> --label "<epic> <sujet>" --no-focus \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['root_pane']['pane_id'])")
herdr pane run "$P" 'cd <repo-principal> && claude-swt'

# Attendre que l'agent soit réellement détecté, plutôt que de parier sur un délai.
for _ in $(seq 1 30); do
  herdr agent get "$P" 2>/dev/null | grep -q '"result"' && break
  sleep 2
done
herdr agent rename "$P" e-20260727-0010 | grep -q '"result"' \
  || echo "⛔ pas d'agent dans $P — regarde ce qui s'y passe (herdr pane read) avant d'aller plus loin"
```

`claude-swt` crée le worktree **puis** lance l'agent dedans : la règle d'or n°11 est tenue par construction. Le nom de l'agent est le code de l'unité de travail dont il a la charge, en minuscules.

**Vérifie que le rename a pris avant de continuer.** Un agent qui met plus longtemps que prévu à démarrer reste anonyme, et `herdr agent rename` répond alors `agent_not_found` — silencieusement, si personne ne lit sa sortie. Or tout ce qui suit dépend de ce nom : le compte rendu qu'il t'enverra, tes messages à ses pairs, et ton inventaire des worktrees. Un agent anonyme est inadressable, et tu ne t'en apercevras qu'au moment où tu auras besoin de lui parler.

Même prudence pour la suite : après avoir livré le brief, relis son pane (`herdr pane read "$P"`) pour confirmer qu'il l'a bien reçu. Une session qui s'ouvre sur un dossier neuf peut poser une question avant d'accepter le premier message — auquel cas ton brief a servi de réponse à cette question, et non de brief.

*À savoir* : `claude-swt` et ses variantes sont des **fonctions du shell interactif**, pas des binaires. Elles marchent dans un pane (qui charge le profil), mais pas depuis un outil qui lance un shell non interactif — là, utilise les commandes `git worktree` directement.

**b-bis. Consigner la filiation — au moment où tu ouvres, pas après.**

Note quel agent tu viens d'ouvrir, sur quelle unité de travail, et où il travaille.

**Sois précis sur ce qui se perd** : la structure du chantier, elle, est déjà dans le ServiceDesk — un epic porte sa demande ou son projet — et l'ID de traçabilité est dans le nom de chaque branche. Ce qui n'existe nulle part, c'est **l'attache entre un agent et son unité de travail** : quelle session, quel pane, quel worktree ont servi à livrer quoi. Elle ne vit que dans ta tête, et elle disparaît en 4f, au moment où tu fermes le pane et retires le worktree. Après, plus personne ne peut relier une livraison à l'agent qui l'a produite — ni pour lui reposer une question, ni pour comprendre un choix.

Où l'écrire — les surfaces qui existent réellement :

- **Toujours** : complète la description de l'epic (`epics` action `update`). C'est le seul support attaché à l'unité de travail elle-même, et il survit à la fermeture de l'agent. **Un epic n'a pas de fil de commentaires** — l'action n'existe pas ; c'est bien la description qu'on complète.
- **Si le chantier a un fil de discussion** : une Demande (`demands` action `comment`) ou une Livraison (`delivery_comments` action `create`). Mets-y la même ligne : c'est là que le dirigeant lit. **Un Projet n'a pas ce fil** — pour lui, la description de l'epic fait foi.

Ce que la ligne doit porter : le nom de l'agent tel que herdr le porte (en minuscules), son pane, son worktree, et le moment. **Le worktree est `foreground_cwd`, pas `cwd`** : tu as lancé `claude-swt` depuis le dépôt principal, donc `cwd` y reste pendant que `foreground_cwd` suit l'agent dans son worktree. Les deux champs sont déjà dans le `herdr agent get "$P"` que tu viens de lancer.

**Cette consigne repose sur ta discipline, et c'est sa faiblesse.** Ce qui dépend d'un geste manuel se troue au premier oubli — c'est précisément pourquoi, partout ailleurs, on fait journaliser l'outil et jamais l'agent. Elle tiendra jusqu'à ce que la naissance d'un agent soit elle-même outillée, et que l'outil enregistre la filiation sans avoir à te la demander. Note au passage que ça ne viendra pas gratuitement pour la façon de faire décrite ici : ouvrir un agent par `tab create` puis `pane run` n'est pas un point d'instrumentation — il faudra que le geste passe par la commande de démarrage d'agent pour qu'un outil ait quelque chose à observer.

**c. Livrer le brief par référence.**

```bash
herdr pane run "$P" 'Tu es lagent en charge dun epic, mandate par un coordonnateur. Lis ton brief complet ici et execute-le : <chemin>'
```

Une seule ligne, sans apostrophe ni retour à la ligne.

**c-bis. Poser son but — obligatoire.**

```bash
herdr pane run "$P" '/goal <condition de fin, en une phrase qui décrit un état vérifiable>'
```

**Sans but, un agent s'arrête quand il croit avoir fini** — c'est-à-dire souvent au premier palier : le code écrit mais les tests non lancés, la PR ouverte mais les statuts non posés, les correctifs appliqués mais le compte rendu jamais rédigé. Le but est un verrou : il l'empêche de rendre la main tant que la condition n'est pas vraie.

Formule-le comme un **état atteint**, pas comme une liste de tâches :

> `/goal E-20260727-0010 est livré : stories créées dans le ServiceDesk avec leurs critères Gherkin, interface qui lit le journal et affiche les deux natures de fils, tests verts qui prouvent chaque contrainte, PR ouverte, statuts à jour, et compte rendu envoyé au coordonnateur d-20260727-0004 via herdr.`

Ce qui doit toujours y figurer : **le livrable**, **la preuve** (les tests qui l'attestent), **l'état du ServiceDesk**, et **le compte rendu au coordonnateur**. Les trois derniers sont précisément ce qu'un agent saute quand rien ne l'en empêche.

**d. Exiger le suivi actif.** Le brief doit lui demander de te prévenir lui-même, **en lui donnant la commande exacte** plutôt qu'en le renvoyant à une documentation :

- quand il a fini : `herdr agent prompt <ton-nom-ou-ton-pane> "<son-nom> a fini : <une ligne> — PR #<n>"` ;
- **immédiatement** s'il se bloque, si une contrainte se révèle impraticable, ou s'il découvre un défaut qui touche un autre chantier.

⚠️ **N'envoie pas ton exécutant lire la compétence `herdr` du poste sans le prévenir.** Elle n'est pas livrée par le pack — elle vient de l'outil — et elle enseigne aujourd'hui `herdr wait output …` et `herdr wait agent-status …`, deux commandes qui **n'existent pas** (`unknown command: wait`). Un agent qui les suit perd du temps sur une erreur qui n'est pas la sienne. Donne-lui les commandes dans son brief ; si tu tiens à l'y renvoyer, dis-lui dans le même souffle que les formes réelles sont `herdr agent wait … --until …` et `herdr pane wait-output …`.

Ça supprime le délai entre « il a fini » et « je m'en aperçois ». En filet, tu peux attendre :

```bash
herdr agent wait "$P" --until done --until blocked --timeout 1800000   # en arrière-plan
```

`--until` se répète pour plusieurs états (`idle`, `working`, `blocked`, `done`, `unknown`) ; sans lui, l'attente couvre `idle`, `done` et `blocked`. Sans `--timeout`, elle est indéfinie.

*Deux pièges de nommage* : il n'existe **pas** de `herdr wait` de premier niveau — l'attente d'un état d'agent est `herdr agent wait`, et l'attente d'une sortie de terminal est `herdr pane wait-output`. Et `herdr agent list` répond déjà en JSON : pas de `--json` à lui passer.

**e. Faire reviewer par un agent frais.** Règle d'or n°8, et ce n'est pas une formalité : dans une livraison réelle, le review indépendant a trouvé deux défauts sérieux que l'auteur avait manqués, dont une perte silencieuse de données. Le brief du reviewer doit lui demander de :

- **reproduire** les défauts plutôt que de les déduire ;
- **muter le code lui-même** — deux ou trois mutations de son cru — et vérifier que la suite rougit. Un test qui reste vert après mutation est un faux témoin, et c'est ce qui laisse passer les vrais défauts ;
- **trancher les désaccords par la mesure**, pas par l'autorité ;
- rendre un verdict : mergeable tel quel / après correctifs listés / à reprendre.

Un reviewer **ne corrige pas** — sinon il perd son indépendance pour la suite.

**f. Fermer proprement avant d'ouvrir le suivant — les deux, pas seulement le pane.**

Un agent qui a fini laisse **deux** choses derrière lui : son pane et son worktree. Fermer le pane sans retirer le worktree ne nettoie rien — le worktree reste sur le disque, figé sur un commit périmé, et le prochain qui y retourne travaille sur une copie morte sans s'en apercevoir.

```bash
# 1. vérifier que son travail est bien parti — jamais retirer un worktree qui a du non-poussé
git -C ~/worktrees/<repo>/<timestamp> status --porcelain
git -C ~/worktrees/<repo>/<timestamp> log --oneline @{u}.. 2>/dev/null

# 2. fermer SON pane, pas son tab
herdr pane close "$P"

# 3. retirer le worktree et sa branche-socle
claude-swt-done <timestamp>          # depuis un pane ; sinon, ou si refusé :
git -C <repo> worktree remove --force ~/worktrees/<repo>/<timestamp>
git -C <repo> worktree prune
```

**Ferme le pane, jamais le tab.** Un tab héberge souvent plusieurs panes — donc plusieurs agents, dont potentiellement toi. `herdr tab close` les emporte tous, sans confirmation : tu peux te fermer toi-même en croyant fermer ton exécutant. Si tu veux savoir avec qui un agent partage son tab avant d'agir, `herdr agent list` donne le `tab_id` de chacun.

**Fais l'inventaire régulièrement** — les worktrees s'accumulent vite quand on enchaîne les agents :

```bash
git -C <repo> worktree list          # compare avec herdr agent list
```

Tout worktree sans agent vivant dedans est un orphelin à retirer.

**g. Merger et fermer les statuts dans le même geste** (règle d'or n°13). Toutes les stories que le merge ferme passent `completed` immédiatement — pas à la fin de la journée.

*Si ton chantier est une Livraison* — **c'est ici que se joue ton calendrier, et c'est le point le plus facile à sous-estimer.** Staging est un sas à une seule livraison (règle d'or n°14) et on ne bundle jamais (n°4) : chaque lot traverse **un par un**, avec sa propre validation, le suivant attendant que le précédent soit mergé sur `main`. Un jalon de vingt tickets n'est donc pas vingt travaux parallèles qui convergent, mais **une file** — et sa durée est la somme des passages, pas celle du plus long. Dimensionne la date là-dessus, dis-le tôt si elle ne tient pas, et sers-toi de la compétence de poussée vers staging plutôt que d'un `git push` manuel : c'est elle qui fait respecter le gate du sas.

### 5. Ce que tu tranches toi-même

Un arbitrage qui remonte, tu le prends. N'en renvoie au dirigeant que ce qui relève vraiment de lui : un choix de produit, un risque assumé, une dépense. Tout le reste — priorité, périmètre, conception, désaccord entre deux agents — c'est ton travail.

**Inscris la décision dans le ServiceDesk**, avec son motif, au moment où tu la prends. Une décision qui ne vit que dans ta conversation est perdue dès que ta session se termine.

*Si ton chantier est une Livraison* — tu as un arbitrage de plus, et c'est le tien : **une date planifiée qui ne tiendra pas.** Un jalon porte un engagement de mise en production ; les deux seules issues honnêtes sont de **sortir du périmètre ce qui n'est pas prêt** (détacher son `delivery_id`, il retournera dans un jalon suivant) ou de **déplacer la date en le disant**. Ce qui n'est pas une issue : laisser la date passer en silence en espérant rattraper. Sors ce qui n'est pas prêt aussi tôt que tu le sais — plus tu attends, moins celui qui attend la livraison a de marge pour s'organiser.

### 6. Coordonner les chantiers voisins

Si un autre agent travaille sur le même dépôt, il est ton pair, pas ton subordonné. Tu lui **transmets** ce qu'il doit savoir — un contrat, un défaut trouvé dans son code, un merge qui déplace `main` — et tu le laisses décider chez lui.

```bash
herdr agent prompt <son-pane> '<message d une ligne, sans apostrophe>'
```

Nomme les agents sans nom que tu croises : un agent anonyme est inadressable.

### 7. Tenir le ServiceDesk — c'est ton travail, pas le leur

Les exécutants tiennent leurs stories ; **toi tu réponds de l'ensemble**. Un agent fermé ne corrigera plus rien : ce qu'il a laissé de faux dans le ServiceDesk y reste jusqu'à ce que tu le voies.

À chaque étape :

- **statuts au moment où l'état change**, jamais différés (règle d'or n°13) — et pour *toutes* les stories qu'un merge ferme, pas seulement la principale ;
- **la filiation de chaque agent que tu ouvres** (voir 4b-bis) — c'est une écriture ServiceDesk comme les autres, et la seule qui disparaît définitivement si tu l'oublies sur le moment ;
- **un compte rendu d'avancement sur le chantier lui-même** — c'est là que le dirigeant regarde, pas dans les tickets. Sans lui, le chantier dit ce qu'on allait faire, jamais où on en est. La surface dépend de la nature du chantier : une **Demande** a un fil (`demands` action `comment`), une **Livraison** aussi (`delivery_comments` action `create`), un **Projet n'en a pas** — pour lui, écris dans les champs du projet (`projects` action `update`), et porte les décisions dans son journal dédié (`project_decisions`), qui est fait pour ça ;
- ce qui reste ouvert, avec **ce qui bloque quoi** ;
- ce qui appartient au dirigeant, énoncé comme tel.

**Relis-toi.** Après chaque livraison, compare ce que le ServiceDesk affiche avec ce qui est vrai : un epic en cours dont le travail est mergé, une story fermée dont le correctif n'est pas fait, un agent assigné qui n'existe plus. Un ServiceDesk qui ment coûte plus cher qu'un ServiceDesk vide — on s'y fie.

### 8. Clore

Une **Demande** passe `delivered` toute seule quand tous ses enfants sont fermés — c'est un trigger, pas un geste. Un **Projet** ne se ferme pas seul : tu le clos explicitement quand ses epics le sont.

*Si ton chantier est une Livraison* — rien ne se fermera tout seul, et il y a **deux fronts, pas un** :

- le jalon lui-même : tu le fais passer `qa` puis `deployed` à la main, dans cet ordre. `deployed` sans être passé par `qa` est un mensonge sur ce qui a été vérifié ;
- **les demandes d'origine**. Un jalon est transverse : ses tickets viennent de plusieurs demandes, et fermer le jalon n'en ferme aucune. Reprends-les une à une. Celles dont *tous* les enfants sont fermés se seront mises à jour d'elles-mêmes ; celles dont il reste une story ailleurs sont encore ouvertes à bon droit — et c'est une information, pas un oubli : elle te dit que le besoin du client n'est pas entièrement couvert par ce que tu viens de livrer.

Dans tous les cas, avant d'y arriver : vérifie qu'aucun epic ne reste ouvert pour de la dette qui aurait dû être sortie, et qu'aucun worktree orphelin ne traîne.

**Referme ta ligne, avec son bilan** — c'est le dernier geste :

```bash
node "$HOME/.somtech/ligne-directe/bin/ligne-directe.js" fermer \
  --bilan "<ce qui a été livré, ce qui reste, ce qui appartient au dirigeant>"
```

Le bilan part d'abord, le canal s'archive ensuite. Une ligne qu'on abandonne sans la refermer laisse un canal ouvert sur une question sans réponse — et le jour où le dirigeant y écrit, personne n'est au bout. (Le veilleur finit par le détecter et referme d'office, mais il le fait à ta place et le dit : autant le faire toi.)

## Anti-patterns

| Ce qu'on est tenté de faire | Pourquoi ça casse |
|---|---|
| Coder « juste ce petit bout » soi-même | Le contexte du pilote se remplit, et il ne tient plus le chantier |
| Verser son contexte dans le brief | L'agent reçoit ce que tu sais, pas ce dont il a besoin — et paie pour le lire |
| Faire travailler deux de tes exécutants en même temps | Techniquement possible — chacun a son worktree — mais tu as deux fils à suivre, deux séries de correctifs, et des merges qui se croisent sur des epics souvent liés. Le gain est rarement là où on l'attend |
| Mettre deux agents dans le même worktree | Là, ce n'est plus un arbitrage : ils se marchent dessus sur les mêmes fichiers et la même branche |
| Laisser un agent fini ouvert | Son worktree pointe sur un commit périmé, et le pane occupe l'écran |
| Accrocher la dette du review à l'epic livré | L'epic ne ferme jamais et le ServiceDesk ment |
| Faire corriger par le reviewer | Il perd l'indépendance qui faisait sa valeur |
| Attendre passivement l'état d'un agent | Le brief doit lui demander de te prévenir ; l'attente n'est qu'un filet |
| Différer les statuts « pour tout faire à la fin » | Entre-temps, le ServiceDesk raconte autre chose que la réalité |
| Donner un epic trop gros en se disant qu'il compactera | Il finit sur un résumé de lui-même, incohérent avec son propre début |
| Comparer des noms d'agents sensibles à la casse | Le nom porté est en minuscules, le code Somtech en majuscules : tu ne retrouves jamais ton pair |
| Ouvrir un agent sans noter qui il est ni sur quoi | Le lien entre l'agent et ce qu'il a livré disparaît avec son pane : on gardera le code, jamais qui l'a fait ni pourquoi |
| Chercher un fil de commentaires sur un epic | Il n'y en a pas — l'action n'existe pas. C'est la description qu'on complète, ou le fil du chantier parent |
| Sur un jalon : découper ce qui est déjà découpé | Le périmètre t'est donné. Créer des epics par-dessus dédouble la traçabilité et personne ne sait plus lequel fait foi |
| Sur un jalon : ouvrir un agent par ticket | Vingt tickets ne font pas vingt agents. Regroupe par zone de code, puis dimensionne les lots |
| Sur un jalon : laisser la date passer en silence | Sortir du périmètre ce qui n'est pas prêt se dit ; une date ratée sans préavis se subit |
| Fermer un jalon en croyant avoir fermé les demandes | Un jalon est transverse : aucune demande ne se ferme parce qu'il est déployé |

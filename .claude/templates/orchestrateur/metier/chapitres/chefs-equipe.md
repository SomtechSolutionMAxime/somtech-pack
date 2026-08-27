# chefs-equipe

> **En un mot** — Faire naître, nommer, brieffer, mener et fermer un chef d'équipe.
> **Rendu depuis la version du pack** `1.84.0` · ABC `2.1.0`

> **Répond de** RA-ORC-010 · RA-ORC-020 · RA-ORC-027 · RA-ORC-028 · RA-ORC-029 · RA-ORC-040

# R3 — Faire naître, mener et fermer des chefs d'équipe

> **Chaque unité de travail est menée par un agent nommé, joignable, dont on sait ce qu'il a livré.**
> *0 agent anonyme · 0 agent né sans modèle déclaré · 0 brief dont la prise n'a pas été vérifiée.*

## Le nom d'un CHEF D'ÉQUIPE vient du mandat au ServiceDesk

> **Un chef d'équipe reçoit un mandat rattaché au ServiceDesk — demande, projet, livraison, epic, story — et il porte le code de ce mandat. Rien d'autre.**

- ✅ `e-20260807-0006` — l'epic qu'il mène
- ✅ `d-20260807-0005` — la demande, quand il porte plusieurs epics de la même
- ❌ `chef-equipe-orchestration`, `revue-pr180` — des noms inventés, raccordés à rien

**Le nom vient du mandat, jamais du sujet du chantier.** C'est la faute qui revient le plus souvent parce qu'elle paraît descriptive : nommer un chef d'équipe d'après le sujet le rend **indistinguable de son orchestrateur**, qui porte déjà ce code.

### ⚠️ Et TOI, orchestrateur, tu portes un nom de RIVIÈRE

> **Qui ARBITRE porte une rivière. Qui EXÉCUTE porte le code de son mandat.**

**Ce n'est pas une exception à la règle du dessus — c'est ce qui la rend applicable.** Un chef d'équipe vit le temps d'un epic ; toi, tu portes **plusieurs mandats successifs**, et un code unique te décrit donc mal par construction. Et la règle du dessus le dit elle-même : nommer un chef d'équipe d'après son sujet le rendrait indistinguable de son orchestrateur. **Une rivière supprime cette collision au lieu de la contourner.**

- ✅ `matapedia`, `batiscan`, `ristigouche`, `bonaventure` — des rivières, portées par des orchestrateurs
- ❌ `orchestrateur` — un rôle, que **tous** pourraient porter : il ne distingue personne
- ❌ `rev-pr31` — un nom raccordé à une PR, dont on ne peut remonter à aucun chantier

**Tu n'as rien à faire pour le recevoir.** `pack agent naitre` attribue la rivière **à la naissance**, sans que personne ait à la demander, et **refuse** un nom hors convention plutôt que de l'accepter en silence (`T-20260818-0124`). *Avant que ce soit outillé, les quatre rivières du poste avaient toutes été données à la main — et le jour où personne n'y pensait, l'agent naissait sans rivière sans que rien ne le signale : deux agents sur 42 étaient dans ce cas.*

**⚠️ TON LIEU, LUI, GARDE LE CODE DU MANDAT.** `.orchestrateur/j-20260814-0001/` reste `.orchestrateur/j-20260814-0001/` même quand l'agent qui l'habite s'appelle `bonaventure`. Les deux ne servent pas la même chose : **le lieu est attaché à un chantier** — il est versé dans le dépôt de ce chantier, et son `CONTEXTE.md` décrit *ce* chantier ; **le nom sert à t'adresser la parole**. La naissance te le dit à voix haute quand les deux diffèrent, et c'est normal, pas une incohérence.

**Ce que ça ne change pas** : ta traçabilité. Le code du mandat reste lisible dans le chemin de ton lieu — ce chemin, seul, t'y rattache. ⚠️ **Ta naissance n'inscrit rien nulle part** : seul un **chef d'équipe** est déclaré.

**Un orchestrateur vivant qui porte encore un code ne se renomme pas** — renommer appartient à l'agent. Il recevra sa rivière **à sa renaissance**.

**herdr impose les minuscules** (1 à 32 caractères, `a-z0-9-_`, initiale minuscule) ; sinon `invalid_agent_name`. La convention Somtech écrit `D-20260727-0004`, le nom porté est `d-20260727-0004`. **Toute comparaison de noms d'agents est donc insensible à la casse.**

**Le libellé de l'onglet ne sert pas à adresser — il sert à reconnaître.** Le code, puis **deux à quatre mots sur ce que l'agent fabrique** :

```
e-20260807-0006 preuves de la compétence
d-20260807-0005 orchestration et veille
```

Pas le domaine, pas le rôle, pas l'état. « e-20260807-0006 orchestration » ne distingue rien d'un onglet voisin.

**Te nommer toi-même, en naissant** — toi seul : le geste nomme les autres.

```bash
herdr pane current                                  # ton pane (result.pane.pane_id)
herdr agent rename <ton-pane> <ta-rivière>          # matapedia, bonaventure… — jamais un code de mandat
```

⚠️ **Le nom d'agent n'est pas le titre de ton onglet.** Poser un titre de terminal ne te nomme pas : `herdr agent list` continue de te rendre anonyme, et **un agent anonyme est inadressable**. Vérifie par le fait — `herdr agent get <ton-pane>` doit rendre `name`. *(Mesuré : un agent s'est cru nommé vingt minutes, son coordonnateur ne le voyait pas — `E-20260819-0001`.)*

## Déclarer le modèle — toujours, au lancement

> **`claude` lancé sans argument démarre en Haiku.** Il n'hérite **pas** du modèle de la session qui l'a lancé.

| Ce que tu fais naître | Modèle | Pourquoi |
|---|---|---|
| **Agent herdr** (chef d'équipe) | **Opus — jamais Haiku** | Haiku n'a pas de mode auto : il s'arrête à *chaque* demande de permission. Mesuré : deux reviewers Haiku ouverts en pane se sont bloqués en boucle, et le gain de vitesse a été entièrement mangé par le déblocage manuel |
| **Sous-agent** (outil `Agent`) | **Haiku possible, et utile** | Il n'a pas d'invite de permission à lui : il hérite de la session qui l'a lancé. Sa place est en **passe 1 de revue**, en portail de rejet |

**Le lanceur de session ne relaie pas le modèle** — il refuse les drapeaux qu'il ne connaît pas, `--model` compris. Il faut **décomposer le geste** : faire naître l'espace de travail, **puis** lancer l'agent dedans avec son modèle.

*À savoir* : `claude-swt` et ses variantes sont des **fonctions du shell interactif**, pas des binaires. Elles marchent dans un pane, mais pas depuis un outil qui lance un shell non interactif — et même là, elles ne relaient pas le modèle.

**Si tu découvres un agent déjà né sur le mauvais modèle**, `herdr pane run "$P" '/model opus'` le corrige — mais c'est un rattrapage, pas la méthode : entre sa naissance et ta découverte, il a déjà travaillé.

⚠️ **Et relis son écran après ce geste** (`herdr pane read "$P"`). Il passe par la **même boîte de saisie qu'un brief**, donc par la même panne : tu verrais un succès sans que le modèle ait changé, et tu repartirais en croyant l'agent corrigé. *C'est le seul endroit de ce texte où ce geste est mis en scène — la consigne générale plus bas ne sert à rien si elle n'est pas ici.*

## Écrire le brief au ServiceDesk

**Jamais dans le terminal** — un retour à la ligne soumet le prompt et coupe le message en deux — et **jamais dans un fichier** : écrire t'est refusé, et un brief posé dans un espace de travail disparaît avec lui.

Il va donc où vit l'unité de travail : la **description de l'epic** (`epics` action `update`), ou le **ticket** (`tickets` action `add_comment`) quand le lot n'a pas d'epic. Il y survit à ta session.

Le brief contient :

- **qui il est** — l'epic, le chantier parent, le coordonnateur. ⚠️ **Pas son nom** : le geste l'a nommé et vérifié. Le redemander le ferait se renommer par-dessus — sa déclaration ne l'apparierait plus, et la garde l'accuserait ;
- **qu'il est chef d'équipe** : il distribue à ses propres sous-agents, il intègre, il rend compte **une seule fois, en synthèse** — sauf ce qui appelle un arbitrage, qui remonte immédiatement ;
- **ce qu'il doit lire lui-même** — chemins git, id d'epic, wireframes. **Une référence, jamais un contenu** : il ira le chercher avec son propre contexte, pas le tien ;
- **les contraintes non négociables, avec le test qui doit les prouver** ;
- **ce qu'il ne doit pas toucher** — nomme les fichiers où un autre agent travaille en ce moment ;
- **comment il travaille** : stories G/W/T d'abord, test rouge avant vert, branche portant l'ID de traçabilité, PR draft dès le premier commit, statut `in_progress` au moment où il commence ;
- **l'ADR applicable**, nommé **avec son titre et pas seulement son numéro** (voir R4). Si tu n'as pas pu établir qu'un ADR existe, **écris-le comme tel** plutôt que de laisser croire que le terrain est libre ;
- **le manifeste d'architecture** dès que le lot y touche : toute table, route, service, écran ou dépendance ajouté se reflète dans le `architecture.yaml` **dans la même PR**, récolté des sources réelles et **jamais inventé** (règle d'or n°9, STD-031). C'est la contrainte la plus facile à oublier parce qu'elle ne se voit pas dans le code écrit ;
- **le suivi** — les commandes exactes pour te prévenir (voir plus bas) ;
- **la consigne de compaction** : *si tu sens que tu vas devoir compacter, arrête-toi, pousse ce que tu as, écris ton compte rendu et préviens le coordonnateur* ;
- **la consigne de sas occupé, dans les deux sens** : *si `/pousse-staging` refuse parce qu'une autre livraison occupe le sas, préviens-moi immédiatement — ce n'est pas un blocage à résoudre, c'est une nouvelle à faire remonter ; et préviens-moi de nouveau quand ta poussée passe.* **Le second manque plus souvent que le premier** — une attente annoncée dont la fin ne l'est pas est pire que le silence d'origine.

⚠️ **Ne verse pas ton contexte dans le brief.** L'agent reçoit ce que tu sais, pas ce dont il a besoin — et il paie pour le lire.

## Faire naître — l'espace de travail avant l'agent, le modèle avec lui

```bash
NAISSANCE=$(npx @somtech-solutions/pack agent naitre e-20260727-0010 \
  --role chef-equipe \
  --depot <repo-principal> \
  --coordonnateur <ton-nom-d-agent>)
P=$(printf '%s' "$NAISSANCE" | jq -e -r 'select(.ok).pane') || printf '%s\n' "$NAISSANCE" >&2
```

**Elle fait tout, ou le défait.** Espace de travail — `~/worktrees/<dépôt>/<horodatage>`, branche-socle `wt/<horodatage>` sur `origin/main` — **avant tout appel à herdr** (règle d'or n°11), jamais un arbre réutilisé. Onglet dedans, **modèle et mode déclarés**, agent **nommé du code de son mandat** puis **vérifié par le fait**. Puis la naissance **inscrite hors dépôt**, `assigned_agent` **rempli**, **en JSON**. ⚠️ **Un refus défait tout — sauf un agent né** : il vit, et la sortie rend `ok:false`, sa cause, son pane.

⚠️ **Vérifie par le fait** — ici `ok` : le pane sort **à l'identique** d'un succès et d'un refus. Sans `select(.ok)` tu brieffes un refusé : non déclaré (la garde le prend) ou déclaré sans amorce (elle le croit bon).

**Les autres options** : `--modele`, `--mode` (défauts `opus`, `acceptEdits`) ; `--base <ref>` part d'ailleurs qu'`origin/main` ; `--workspace <id>` vise un espace HERDR existant (**≠** l'espace de travail) ; `--amorce-texte '…'` livre le brief dans le même geste, même vérification.

⚠️ **`--coordonnateur`, c'est TOI** : sans lui, la déclaration tait qui l'ouvre.

⚠️ **`assigned_agent` n'aboutit pas partout, et son échec ne tue jamais la naissance** : un `T-…` le reçoit sur son ticket **encore ouvert**, un `E-…` sur ses stories **ouvertes** — un fini garde le nom de qui l'a fait, un vivant au nom d'un autre est **repris**, et ça se dit. Un epic non découpé n'a rien à remplir ; demande, projet et livraison sont **refusés**. La sortie dit la cause, et n'annonce jamais un succès plein sur une reprise ou un saut.

⚠️ **L'onglet porte le nom de l'agent** — pas le libellé « code + deux à quatre mots » ci-dessus.

⚠️ **La veille ne se pose pas ici**, mais une fois le brief **PRIS** (plus bas) : ici l'agent est `idle` sans rien à faire, et elle lisait cette attente comme un travail fini — « TERMINE apres 0 deblocages », code 0 (`T-20260818-0109`).

## Livrer le brief — et vérifier qu'il a été PRIS

```bash
node $HOME/.somtech/naissance-representant/bin/livrer.js "$P" --en-attente \
  --texte 'Tu es lagent en charge dun epic, mandate par un coordonnateur. Lis ton brief complet au ServiceDesk — epics action get E-20260727-0010 — et execute-le.'
```

Une seule ligne, sans apostrophe ni retour à la ligne. **La commande sort non nulle si le brief n'a pas été pris.**

⚠️ **`--en-attente` n'est pas décoratif** (`T-20260816-0114`). Il exige une session qui *attend* — c'est la garde du brief de naissance, où « elle a quitté l'attente » **est** la preuve qu'elle a pris. Et il **désarme la délivrance** : une session qui vient de naître peut être derrière un écran de démarrage qu'on ne reconnaît pas, et on ne pose pas un geste irréversible sur ce qu'on ne comprend pas.

⚠️ **C'est `livrer.js` qui sert à parler à un agent, plus `herdr agent prompt`** (`T-20260814-0138`, mesuré contre le vrai service). Le geste nu rend un succès **que la soumission parte ou non** — et, cas grave, **écrire dans une boîte de saisie qui contient déjà quelque chose ne livre pas deux messages, il en livre UN, les deux textes collés**. L'agent travaille alors sur un texte que personne n'a écrit. **Un brief fusionné est pire qu'un brief absent** : l'absent se voit, le fusionné produit un travail plausible et faux.

⚠️ **Si la boîte du destinataire est bloquée, `livrer.js` la délivre — il ne l'écrase jamais.** Une boîte laissée pleine mettait en famine **tous** les émetteurs suivants, et seul le destinataire pouvait la libérer : le seul qui ne sait pas qu'elle bloque. Quatre occurrences en quatre rondes, et une fois sur trois l'auteur du texte coincé était **déjà mort**. La commande attend **cinq minutes**, relit, et si le texte n'a pas bougé, **le soumet pour son auteur** — la touche d'envoi seule, sans écrire un caractère — puis livre le tien avec un avis. Elle s'abstient dans quatre cas : le texte **a bougé** · la boîte porte un **dialogue de choix** · la session est devant un **écran connu ou inconnu** · la boîte est **illisible**. **Rien ne s'écrit jamais dans une boîte qu'on n'a pas vue vide.**

*Pourquoi cinq minutes et pas trente secondes* : une demi-minute suffit contre quelqu'un dont les doigts sont sur le clavier ; elle ne dit rien de quelqu'un qui a tapé la moitié d'une phrase puis s'est levé. Le geste ne se défait pas, donc il se compte en minutes.

**Relis quand même son pane ensuite** (`herdr pane read "$P"`). La commande prouve que le brief a été **pris** ; elle ne dit rien de ce qu'il a **déclenché**. Une session qui s'ouvre sur un dossier neuf peut poser une question avant d'accepter le premier message — auquel cas ton brief a servi de réponse à cette question, et non de brief.

## Poser son but — obligatoire

```bash
herdr pane run "$P" '/goal <condition de fin, en une phrase qui décrit un état vérifiable>'
```

**Sans but, un agent s'arrête quand il croit avoir fini** — c'est-à-dire souvent au premier palier : le code écrit mais les tests non lancés, la PR ouverte mais les statuts non posés, les correctifs appliqués mais le compte rendu jamais rédigé.

Formule-le comme un **état atteint**, pas comme une liste de tâches. Ce qui doit toujours y figurer : **le livrable**, **la preuve** (les tests qui l'attestent), **l'état du ServiceDesk**, et **le compte rendu au coordonnateur**. Les trois derniers sont précisément ce qu'un agent saute quand rien ne l'en empêche.

> 🔴 **Les conditions de fin vivent AUX DEUX ENDROITS : le `/goal` ET les `success_criteria` de l'epic.** Ce n'est pas du confort — **le `/goal` seul est un point unique de défaillance** : un `pane run` vers un agent **occupé** s'affame, le texte se dépose dans sa boîte sans y être soumis, mesuré à **~16 minutes**. Ceux qui ont été **pris** l'ont été sur des agents **au repos**. *Soumis au repos, affamé pendant le travail* (`T-20260818-0143`).
>
> **Ce qui a sauvé un lot réel** : son but n'avait jamais été pris, **mais ses conditions de fin vivaient aussi dans les `success_criteria`**, et son chef d'équipe les a lues.
>
> ⚠️ **Et ton propre `/goal` est dans ce cas** — la séquence ci-dessus le pose **juste après un brief pris**, donc sur un agent qui vient de se mettre au travail. C'est pourquoi la redondance n'est pas un confort : relis son écran, et écris les conditions de fin dans l'epic **avant** de le faire naître.

> ⚠️ **`/goal` et `/model` passent par la MÊME boîte de saisie qu'un brief — donc par la même panne.** `herdr pane run` rend un succès que la soumission parte ou non, et il **colle** son texte à ce qui traînait déjà dans la boîte. Un but jamais pris est un agent qui s'arrêtera au premier palier ; un `/model` jamais pris est un agent resté sur le mauvais modèle. **Ni l'un ni l'autre ne se voit** — l'agent travaille, simplement pas comme tu crois.
>
> **Relis son écran après chaque `pane run`** (`herdr pane read "$P"`) et vérifie que le geste a été **pris**, pas seulement envoyé. Le texte exige cette preuve pour `livrer.js` ; **il n'y a aucune raison qu'elle s'arrête là.**

### 🔴 Un texte GRISÉ n'est pas un texte saisi — `herdr pane read` ne les distingue PAS

**Avant de conclure qu'une boîte contient quelque chose, mesure son ÉTAT** — la commande ne pose aucun geste, elle se tape sur le pane d'un autre :

```bash
gestionnaire-etat-boite "$P"
```

| Ce qu'elle rend | Ce que tu fais |
|---|---|
| `suggestion` · `file-attente` — du gris : l'éditeur propose, ou tes messages attendent son tour | **rien** : rien à soumettre, rien n'est bloqué |
| `collee` · `saisie` — un texte réel | boîte pleine — `livrer.js` la délivre sans l'écraser |
| `illisible` | ce n'est **pas** « vide » — va regarder toi-même |

> 🔴 **Deux orchestrateurs y ont perdu ~3 h chacun le 2026-08-19**, trois remontées au dirigeant chacun pour un geste sans objet. **`herdr pane read` rend le même écran** pour une suggestion et pour un texte saisi — le seul discriminant est un attribut ANSI. *(`E-20260819-0015`.)*

🔴 **Si ton texte est resté dans sa boîte, le geste qui le soumet (`herdr pane send-keys <pane> Enter`) a TROIS conditions, jamais une** : ① **le texte est le TIEN**, tu l'as vu se déposer — soumettre celui d'autrui, c'est le faire parler à sa place ; ② **tu VIENS de relire la boîte**, juste avant le geste, pas il y a quinze minutes ; ③ **tu as mesuré son ÉTAT**, pas lu son écran — un `suggestion` n'a rien à soumettre, et la touche part alors dans le vide en te faisant croire le contraire.

**Sans ②, tu agis sur un état supposé.** Mesuré : geste conseillé sur une description de quinze minutes — **le but était pris depuis quatre, la boîte était vide** (`T-20260818-0143`). *« Un texte vu il y a quinze minutes n'est pas un texte présent maintenant — et sur une boîte, un geste inutile n'est jamais sans effet. »* **Ça n'autorise jamais à écrire dans la boîte d'autrui** : ça reste `livrer.js`, seul à délivrer sans écraser.

🔴 **UN ARBITRAGE QUI CONTREDIT UN `/goal` DÉJÀ POSÉ CORRIGE LE `/goal` DANS LE MÊME GESTE.**

Un `/goal` posé **ne s'efface pas** quand tu arbitres autrement en conversation : **il continue de rappeler sa condition, indéfiniment, à un agent qui n'a aucun moyen de savoir lequel des deux est le plus récent.**

*Mesuré le 2026-08-19* : un `/goal` posé à la naissance — *« le dépôt à jour sur `origin/main` »* —, l'inverse arbitré deux heures plus tard, **le premier jamais corrigé**. Le hook de but a rappelé la condition d'origine, l'agent l'a relayée comme *« le CTO vient de poser comme condition »*, et **dix minutes ont été passées à chercher un message qui n'existait pas**.

> **Il a fait exactement ce qu'il fallait : il a refusé de trancher entre deux ordres opposés du même donneur d'ordre.** *L'incohérence était celle de qui avait posé les deux.*

**Un agent qui reçoit deux ordres contradictoires ne peut pas trancher ; il ne peut que remonter.** **Sinon tu fabriques la contradiction que tu reprocheras ensuite à l'agent de mal relayer.** *(`T-20260819-0095`.)*

## Poser la veille de déblocage

Un agent herdr s'arrête sur les demandes de permission de son environnement. Sans rien, il attend qu'un humain passe ; avec toi qui le débloques, **tu deviens sa boucle d'événements**.

```bash
scripts/orchestration/veille-deblocage.sh <pane> <agent> --detach   # une fois son brief PRIS
scripts/orchestration/veille-deblocage.sh --list                    # pane, agent et MOTIF de chacune
```

⚠️ **`--detach`, jamais un `&` nu — et après le brief, jamais à la naissance nue.** Ce texte prescrivait `… &` : lancée ainsi depuis une session Claude Code, la veille est une tâche de fond du harnais, **et le harnais la tue** — deux fois, pendant que celles d'un autre orchestrateur survivaient. *Même script, même poste, même journée : seule la façon de les lancer différait.* `--detach` détache le script **lui-même** : la survie ne dépend plus de ta discipline (`T-20260818-0109`).

**Pour vérifier qu'elles tournent, `--list`, jamais un compte.** Un `ps | grep` a rendu « 3 » : **aucune des trois ne gardait mes agents.** *Compter ne suffit pas, il faut savoir ce qu'on compte.* `--list` rend le pane, l'agent, le pid et le **motif** de chacune — six motifs nommés, chacun avec son code de sortie. **Un arrêt annoncé sur un agent qui travaille encore n'est pas une fin de mandat : repose une veille.** Elle tient ~5 h 30 et prévient avant de s'éteindre ; l'ancienne valeur (~66 min) était plus courte que la plupart des lots.

Trois garanties qu'il ne faut jamais relâcher :

1. **Elle ne répond que devant une vraie demande de permission**, reconnue par **deux signes concordants** — jamais un seul. Une réponse envoyée à autre chose est une frappe au hasard dans une session qui travaille.
2. **Devant un écran qu'elle ne reconnaît pas, elle ne répond pas.** C'est le seul moyen que cet outil nuise, donc c'est la garantie qu'on protège en premier : **une veille qui devine est pire que pas de veille**.
3. **La position d'une option ne dit jamais son sens.** Certaines demandes n'ont que deux options et la deuxième y est « Non ». D'autres proposent « oui, et dis-moi quoi faire ensuite », qui laisse l'agent attendre une instruction qui ne viendra jamais. **On ne descend sur une option qu'après avoir lu qu'elle autorise durablement.**

**Quand tu dois quand même répondre toi-même**, réponds *« oui, et ne redemande plus »* plutôt qu'un simple oui : chaque réponse de cette forme supprime une famille entière de blocages futurs.

> ⚠️ **Une garde se juge sur DEUX chiffres, jamais sur un : ce qu'elle attrape, et ce qu'elle refuse à tort.**
>
> C'est vrai de la veille, du critère des lignes, du gate d'une chaîne, de n'importe quoi qui dit non à ta place. Une garde qu'on ne juge que sur ses prises paraît toujours bonne — et **une garde qui crie à tort finit par se faire retirer, en emportant ce qu'elle gardait vraiment**. C'est arrivé ici, sur le critère des lignes ouvertes : faux **trois fois sur quatre**.
>
> Donc quand tu poses ou juges une garde, mesure les deux chiffres **sur du trafic réel**, avant de t'y fier.

## Exiger le suivi actif

Donne-lui **la commande exacte**, jamais un renvoi à une documentation :

```bash
node $HOME/.somtech/naissance-representant/bin/livrer.js <ton-nom> --texte "<son-nom> a fini : <une ligne> — PR #<n>"
```

Et **immédiatement** s'il se bloque, si une contrainte se révèle impraticable, s'il découvre un défaut qui touche un autre chantier, ou si le sas est occupé — puis **une seconde fois quand sa poussée passe**.

En filet seulement, jamais à la place :

```bash
herdr agent wait "$P" --until done --until blocked --timeout 1800000   # en arrière-plan
```

⚠️ *Deux pièges de nommage* : il n'existe **pas** de `herdr wait` de premier niveau — c'est `herdr agent wait` pour un état d'agent, `herdr pane wait-output` pour une sortie. Et `herdr agent list` répond déjà en JSON : pas de `--json`.

⚠️ **N'envoie pas ton chef d'équipe lire la compétence `herdr` du poste sans le prévenir.** Elle n'est pas livrée par le pack et enseigne aujourd'hui `herdr wait output …` et `herdr wait agent-status …`, **deux commandes qui n'existent pas**.

## Sous-agent ou coéquipier — le choix qui économise le contexte

| Outil | Quand | Durée de vie |
|---|---|---|
| **Sous-agent** | exploration, revue ponctuelle, vérification | une tâche, puis mort — `Agent(prompt)` |
| **Coéquipier** | correction après revue, lot qu'on reprend, spécialiste reconsulté | persiste — `Agent(prompt, name: "…")` puis `SendMessage` |

**Le critère : aura-t-on besoin de lui reparler ?** Chaque agent herdr rouvert repart de zéro — perte de 10-15 min à rejouer la même histoire. Le coéquipier évite ça. Laisse le sous-agent mourir.

## Fermer proprement — les trois choses, pas seulement le pane

```bash
# 1. consigner l'état final AVANT disparition — la porte de sortie de la filiation
#    complète la description de l'epic : PR #, branche, état, verdict

# 2. vérifier que son travail est bien parti — ⚠️ PAS avec @{u}, voir juste en dessous
git -C ~/worktrees/<repo>/<timestamp> status --porcelain
git -C ~/worktrees/<repo>/<timestamp> log --oneline origin/<branche-cible>..HEAD

# 3. fermer SON pane, pas son tab
herdr pane close "$P"

# 4. retirer l'espace de travail et sa branche-socle
git -C <repo> worktree remove ~/worktrees/<repo>/<timestamp>
git -C <repo> branch -D wt/<timestamp>
git -C <repo> worktree prune
```

> ⚠️ **N'utilise JAMAIS `@{u}` pour ce contrôle, et n'avale jamais son erreur.** C'est le défaut le plus coûteux de cette page : il **détruit du travail**.
>
> Une branche-socle `wt/<timestamp>` est créée par `git worktree add -b wt/$TS origin/main` — **elle n'a pas d'upstream**, et elle n'en aura jamais. `git log @{u}..` échoue donc *toujours*, et un `2>/dev/null` transforme cet échec en **sortie vide**. Une sortie vide se lit « tout est poussé ». **Tu détruis alors l'espace de travail avec les commits qu'il portait**, et rien ne t'aura prévenu — l'erreur qui aurait dû t'arrêter a été avalée par la redirection.
>
> `origin/<branche-cible>..HEAD` compare à ce qui existe vraiment, et **échoue bruyamment** si la référence est fausse. Un échec qu'on voit vaut infiniment mieux qu'un vide qu'on croit.
>
> *Deux orchestrateurs ont exécuté la version fautive aujourd'hui sans rien perdre — **par vigilance, pas par conception**. Le geste ne les protégeait pas.*

⚠️ **Ferme le pane, jamais le tab.** Un tab héberge souvent plusieurs panes — donc plusieurs agents, **dont potentiellement toi**. `herdr tab close` les emporte tous, sans confirmation. `herdr agent list` donne le `tab_id` de chacun.

**Tu as créé l'espace de travail toi-même avec `git worktree add` : c'est donc `git` qui le retire.** Le teardown du lanceur ne connaît pas ce qu'il n'a pas ouvert.

## Mettre à jour un agent vivant

**Un correctif de métier n'atteint un agent vivant qu'en le faisant renaître** — un redémarrage laisse ses droits inertes et sa tête sur l'ancien métier (mesuré 2026-08-17).

⚠️ **Pour un orchestrateur, la renaissance ne t'appartient pas.** Elle est **demandée à l'orchestrateur du dépôt `somtech-pack`**, qui la pose. Tu ne te fais jamais naître toi-même. *(Arbitrage du CTO, 2026-08-17.)*

🔴 **Et tu ne refermes PAS ta ligne en renaissant.** « Referme ta ligne, c'est le dernier geste » vise la **clôture d'un chantier** ; appliqué à ta renaissance, il **coupe le CTO** entre ta mort et la naissance de ton successeur. Tu écris à la place un dernier message : où en est le chantier, que le canal reste ouvert, ce qui reste `[non établi]`. **Écris ton relais pendant que tu as tout en tête**, pas quand on viendra te chercher (`T-20260818-0128` · détail en *Clore*).

---


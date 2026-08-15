---
name: orchestrateur
description: Prépare le lieu d'un orchestrateur — un dossier versionné, dans le dépôt du chantier, qui porte son métier, ses moyens et ses droits — puis l'y fait naître, en portant pour toi le rôle que personne ne doit avoir à se rappeler. Vérifie d'abord qu'elle a de quoi finir — les gabarits du pack présents dans ce dépôt, et le poste capable d'ouvrir une ligne — et refuse tout net, sans rien créer, s'il manque l'un ou l'autre : la ligne d'un orchestrateur est obligatoire. Utilise cette compétence quand on te demande de poser, d'installer, de préparer, de mettre en place ou d'ouvrir un orchestrateur pour un chantier — même si on dit seulement « ouvre-moi un orchestrateur sur cette demande » ou « fais-en naître un ici ». NE PAS confondre avec /orchestrer-chantier (le métier qu'il exerce une fois né, jamais la pose de son lieu) ni avec /gestionnaire-client (le lieu du représentant d'un client, qui se branche lui sur un canal client existant).
---

# Tu prépares le lieu d'un orchestrateur

Un orchestrateur ne doit pas être une session à qui on a demandé de jouer un rôle : c'est un
**lieu**, versionné dans le dépôt du chantier, que n'importe quelle session peut reprendre
sans rien redécouvrir. Cette compétence ne devient **jamais** cet orchestrateur — elle lui
prépare son adresse, l'y fait naître si on le lui demande, puis s'arrête.

```
/orchestrateur <nom> [--depot <chemin>]
```

Le résultat, quand tout va bien :

```
<dépôt du chantier>/
└── .orchestrateur/
    └── <nom>/
        ├── CLAUDE.md               ← le métier, copié du pack — généré, jamais édité à la main
        ├── CONTEXTE.md             ← ce qui est propre à ce dépôt — à la main, jamais écrasé
        ├── .mcp.json               ← le ServiceDesk et Somcraft
        └── .claude/
            └── settings.json       ← ce qu'il peut : lire le dépôt, sa ligne, herdr, les deux
                                       registres. Ce qu'il ne peut PAS : écrire un fichier,
                                       ouvrir un sous-agent — refusé, pas seulement non autorisé
```

> **Pourquoi `settings.json` n'est pas à plat, contrairement à `.mcp.json`.** Claude Code ne
> résout les permissions d'un projet qu'à `.claude/settings.json` — jamais à sa racine. Un
> `settings.json` posé à plat serait présent sur disque et **jamais lu** : les permissions de
> l'orchestrateur ne borneraient rien, en silence. C'est un défaut déjà vécu sur le lot
> jumeau — corrigé avant fusion, gardé depuis par un test qui ancre le placement sur ce dépôt
> lui-même plutôt que sur une supposition.

> **Ce fichier ne fait pas qu'autoriser : il refuse.** Depuis T-20260813-0062, il porte une
> liste de refus — écrire ou modifier un fichier, ouvrir un sous-agent —, et cette distinction
> n'est pas cosmétique : **une autorisation est ignorée en entier tant que le dossier n'a pas
> été approuvé une première fois, alors qu'un refus tient dès la naissance** (mesuré sur
> Claude Code 2.1.231). C'est ce qui rend « un agent qui orchestre n'exécute jamais » mécanique
> plutôt que prescriptif. Ne retire aucune de ces lignes en croyant simplifier : son métier
> promet au lecteur ce que ce fichier refuse, et un texte qui promet ce que le fichier autorise
> est une garantie fausse.

> **Ce que cette compétence n'est pas.** Elle ne cadre aucun chantier, ne découpe rien,
> n'ouvre aucun chef d'équipe, ne tient aucun registre. Ça, c'est le métier de l'orchestrateur
> **une fois né** — il vit dans le `CLAUDE.md` que cette compétence copie, et il est décrit
> par `/orchestrer-chantier`, pas ici. Cette compétence s'arrête quand le lieu existe, est
> versionné, et que sa session y est née.

## Le seul principe qui gouverne tout le reste

> **Elle ne crée rien tant qu'elle n'a pas de quoi finir.**

Un orchestrateur né sans ligne tranche seul ce qui ne lui appartient pas, ou dort jusqu'à ce
que quelqu'un passe — les deux ont été observés. **Sa ligne est donc obligatoire** (arbitrage
du dirigeant, 2026-08-12) : il n'existe aucune voie « pose-le quand même, il fera sans ». La
vérification n'est pas une précaution parmi d'autres, elle **précède littéralement** la
première écriture sur disque.

**Ce qui se mesure ici n'est pas ce qu'on mesure chez un représentant.** Lui rejoint un canal
client qui existe déjà, où un humain a dû inviter notre robot : on mesure la joignabilité de
ce canal-là, et `--canal` le désigne. Un orchestrateur, lui, **crée sa ligne** au premier
geste de son chantier — il n'y a aucun canal à joindre au moment de la pose. Ce qui se mesure,
et ce qui manque quand ça rate, c'est la capacité du **poste** à en ouvrir un : les deux
entrées de son trousseau. **Il n'y a donc pas de `--canal` ici, et ce n'est pas un oubli.**

**Les deux entrées, et pas seulement la première.** L'une fait **parler**, l'autre fait
**entendre**. Un orchestrateur qui pourrait poster sans jamais recevoir la réponse du
dirigeant serait sourd en croyant dialoguer — et c'est pire pour un rôle dont la raison d'être
est de faire trancher ce qu'il ne doit pas trancher seul.

**Le canal n'est pas la seule chose qui peut manquer.** Un dépôt qui n'a pas reçu la version
du pack portant les gabarits n'a rien à copier — et vérifier la ligne sans vérifier la source,
c'est créer le répertoire puis échouer dedans. C'est arrivé sur le lot jumeau : le lieu vide
restait, et la relance suivante le lisait comme un lieu posé. **La source est donc vérifiée au
même titre que la ligne, fichier par fichier, et avant elle** — un refus qui ne dépend que du
disque local ne coûte aucun aller-retour vers le trousseau.

## Prérequis

- **La ligne directe et la naissance sont installées sur ce poste**
  (`$HOME/.somtech/ligne-directe`, `$HOME/.somtech/naissance-representant`). Sans elles,
  aucune vérification n'est possible : dis-le et arrête-toi. Le geste qui débloque :
  `npx @somtech-solutions/pack setup`.
- **Tu es dans le dépôt du chantier**, ou tu connais son chemin (`--depot`, par défaut le
  répertoire courant). C'est ce dépôt qui reçoit `.orchestrateur/<nom>/`.
- **Ce dépôt a reçu la version du pack qui porte les gabarits** — la commande le vérifie
  elle-même et refuse sans rien créer si ce n'est pas le cas. Le geste qui débloque :
  `npx @somtech-solutions/pack update` dans le dépôt du chantier.
- **Un espace de travail herdr existe** pour y faire naître la session (`herdr workspace
  list`). Il n'est requis qu'au second geste, pas à la pose.

## Comment on le nomme, et pourquoi ça n'est pas libre

**Le nom vient du mandat au registre, jamais du sujet du chantier ni du rôle** :
`d-20260813-0002` pour une demande, `p-…` pour un projet, `j-…` pour une livraison. C'est ce
qui rend l'agent adressable par quelqu'un qui n'a que le code sous les yeux.

herdr impose par ailleurs sa forme : 1 à 32 caractères, une lettre minuscule d'abord, puis
minuscules, chiffres, `-` ou `_`. Un nom hors de cette forme est refusé **avant** qu'un pane
soit créé — pas après.

Le nom sert deux fois, et c'est le même : celui du dossier sous `.orchestrateur/`, et celui de
l'agent herdr. Un dépôt peut porter plusieurs orchestrateurs ; c'est le nom qui les distingue.

## Le geste — poser le lieu

```bash
LD="node $HOME/.somtech/ligne-directe/bin/ligne-directe.js"

$LD orchestrateur <nom> [--depot <chemin>]
```

La commande rend un objet JSON et son code de sortie le résume : `0` si le lieu existe
désormais **en entier** (qu'elle vienne de le créer ou qu'il y était déjà), `1` si elle a
refusé. Sur un refus, le motif est aussi écrit en clair sur la sortie d'erreur — lis-le : il
dit ce qui a été mesuré, et le geste qui débloque **quand il y en a un** à proposer sans
risque. Un des cinq n'en propose aucun, délibérément — remplacer une entrée du trousseau
suppose de détruire celle qui est en place, et ce refus-là ne met pas ce geste dans ta bouche.

**Elle est idempotente, et l'idempotence ne vaut que pour un lieu COMPLET.** Relancée sur un
orchestrateur déjà posé — ses quatre fichiers présents — elle ne retouche à rien, le dit
(`deja_installe`) et s'arrête là ; sur cette voie elle ne lit même pas le trousseau, il n'y a
rien à vérifier pour ne rien faire.

**Un lieu incomplet, lui, n'est pas un lieu.** Elle le refuse (`lieu_partiel`) au lieu de le
déclarer installé — c'est le défaut le plus grave corrigé sur le lot jumeau : un répertoire
vide, résidu d'une pose interrompue, était rendu comme `deja_installe: true` avec
`presents: []`. Elle ne le complète pas non plus : elle ne saurait pas ce qu'un humain y a
déjà changé.

## Si elle refuse — et c'est le cas qui compte le plus

Le refus porte un motif, et le geste qui le lève n'est pas le même selon lequel :

| Motif rendu | Ce qui s'est passé | Le geste qui débloque |
|---|---|---|
| `nom_invalide` | Le nom donné n'est pas **un seul segment de chemin** : il traverse un répertoire (`/`, `\`, `..`), commence par un point ou un tiret, ou porte un caractère hors lettres/chiffres/tirets. La **casse est libre** — `D-20260813-0002` est un nom parfaitement valide | Renomme le chantier avec des lettres, des chiffres et des tirets. Rien n'a été créé : ce refus tombe **avant** tout accès au disque |
| `lieu_ambigu` | Plusieurs lieux sous `.orchestrateur/` ne diffèrent **que par la casse** (`Chantier` et `chantier`), et aucun ne porte exactement le nom demandé. Rien ici ne peut dire lequel est le bon — en choisir un reviendrait à poser à côté d'un lieu vivant | Écarte celui qui ne sert plus (`mv .orchestrateur/<autre> .orchestrateur/<autre>.ecarte`), puis relance. Aucun troisième lieu n'a été créé |
| `lieu_partiel` | `.orchestrateur/<nom>/` existe mais lui manque des fichiers | Écarte ce reste (`mv .orchestrateur/<nom> .orchestrateur/<nom>.ecarte`), puis relance — elle ne complète jamais |
| `gabarits_absents` | Ce dépôt n'a pas la version du pack qui porte les gabarits | `npx @somtech-solutions/pack update` dans le dépôt du chantier |
| `jeton_illisible` | La **valeur** n'a pas pu être obtenue, et **personne n'a établi que l'entrée manque** — un jeton valide, en service, donne ce refus. C'est le cas **par défaut** : binaire introuvable, trousseau verrouillé, et toute cause qu'on n'avait pas prévue | Lis la cause brute que le message montre, et suis ses gestes — ils ne font que **regarder**. Ne dépose **rien** sur la foi de ce refus : écrire par-dessus une entrée qui fonctionne la perdrait |
| `jeton_absent` | Aucune entrée n'a répondu au trousseau **sous ce compte, pour ce service**, et `security` l'a **dit** — c'est le seul cas où l'absence est prouvée, donc le seul où déposer a un sens | Suis la marche à suivre que le message donne : elle montre d'abord ce qui est là, puis dépose **sans écraser** |
| `jeton_vide` | L'entrée existe au trousseau, et elle est **vide** — pas absente | Le message ne propose aucune commande, et c'est voulu : remplace l'entrée depuis le Trousseau d'accès, qui la montre avant qu'on y touche |
| `ecriture_interrompue` | La pose a échoué en cours de route (droits, disque) | Rien à nettoyer — elle a retiré ce qu'elle avait commencé. Corrige la cause, relance |
| `verification_impossible` | Une vérification préalable a **échoué sans rendre de verdict** — on ne sait donc pas si la ligne pouvait être ouverte. Ni le trousseau, ni le canal, ni les gabarits ne sont mis en cause | Lis la cause brute que le refus montre, et **ne répare rien à l'aveugle**. Rien n'a été créé : le lieu n'est posé qu'après un verdict favorable |

Les deux premiers sont prononcés **sans lire le trousseau** : ils ne dépendent que du disque
du dépôt.

> **Le refus dit ce qu'il a mesuré, jamais ce qu'il en conclut — et tu le relaies tel quel.**
> Le septième défaut du lot jumeau était un refus **menteur** : un jeton parfaitement en place
> était déclaré absent, et le message envoyait *déposer* un jeton — donc écraser celui qui
> servait onze lignes vivantes. Le message que la commande rend nomme désormais l'entrée
> cherchée et le compte sous lequel elle l'a cherchée. **Recopie-le. Ne le reformule pas en
> « le jeton n'est pas là », et n'ajoute aucune commande qui écrase ou supprime une entrée :
> celui qui lit un message d'erreur a déjà un problème, il fait confiance, et il colle.**

Sur un refus : **tu t'arrêtes**, tu rapportes le motif et le geste qui débloque, sans rien
tenter d'autre. Rien n'a été créé — vérifie-le si tu en doutes (`ls .orchestrateur/` ne rend
rien de nouveau) plutôt que de te fier au seul message.

## Si elle crée le lieu

**Verse-le tout de suite** — poser des droits, un métier et des moyens qui portent deux
registres n'est pas assez anodin pour se passer d'une branche et d'une revue :

```bash
git checkout -b chore/orchestrateur-<nom>
git add .orchestrateur/<nom>/
git commit -m "chore(orchestrateur): installe l orchestrateur <nom>"
git push -u origin chore/orchestrateur-<nom>
gh pr create --draft --title "chore(orchestrateur): installe l orchestrateur <nom>" \
  --body "Lieu de l orchestrateur pose par /orchestrateur. Ligne verifiee ouvrable."
```

Passe la PR en prêt (`gh pr ready`) une fois que quelqu'un l'a relue — cette compétence ne
fusionne jamais elle-même.

**Si la commande a rendu un avertissement** (`avertissements`, le plus souvent : aucun fichier
d'environnement à la racine du dépôt), **dis-le** avant de continuer. Ce n'est pas bloquant —
le lieu est créé quand même — mais l'avertissement pèse plus lourd ici que chez un
représentant : les moyens de l'orchestrateur déclarent **deux** serveurs qui lisent des
variables d'environnement, le ServiceDesk et Somcraft. Sans elles, il naîtra sans registre et
le découvrira en plein chantier — c'est exactement le silence que cette compétence existe pour
éviter, et le taire ici le réintroduirait par un autre chemin.

## Avant de le faire naître — son contexte

`CONTEXTE.md` est posé **avec ses chevrons** : ce qui reste entre `<…>` n'a pas encore été
renseigné. Il porte ce que le métier ne peut pas savoir — **à qui il répond**, **qui est le
gestionnaire client de ce projet**, et **sa portée** : le chantier dont il répond, et ce dont
il ne s'occupe pas.

**Remplis-le, ou fais-le remplir, avant la naissance.** Un orchestrateur qui trouve un chevron
le dit plutôt que de deviner — mais un dépôt qui porte plus d'un orchestrateur n'a que cette
portée écrite pour les empêcher de se marcher dessus, et elle ne se devine pas du tout.

## L'y faire naître — et le rôle ne se laisse jamais deviner

```bash
NAITRE="node $HOME/.somtech/naissance-representant/bin/naitre.js"

$NAITRE <nom> --workspace <espace herdr> --role orchestrateur --depot <chemin du dépôt> \
  [--amorce <fichier de brief>]
```

La naissance ne pose jamais le lieu : elle le vérifie, y repose son garde d'ouverture, crée le
pane **dans le lieu**, lance la session, attend qu'elle soit détectée, la nomme, puis vérifie
**par le fait** — le nom qu'elle porte, le répertoire où elle tourne. Un échec referme le pane
qu'elle avait ouvert.

**Les deux options qu'on n'oublie pas, parce que les oublier ne se voit pas :**

- **`--role orchestrateur`.** Sans lui, la naissance vise le rôle par défaut — le représentant
  — et va donc chercher un lieu sous `.gestionnaire/<nom>`. **Mesuré, les deux cas :** quand
  ce lieu n'existe pas, elle refuse en envoyant poser un *représentant*, sur un dépôt où
  `.orchestrateur/<nom>` est posé juste à côté — un refus exact qui envoie au mauvais endroit ;
  et quand le dépôt porte les deux lieux sous le même nom, **elle réussit** : la session naît
  représentante, dans le lieu du représentant, sous le nom qu'on attendait de l'orchestrateur,
  et rien à l'écran ne les distingue. **Cette compétence porte donc l'option pour l'utilisateur
  — elle n'écrit jamais cette invocation sans elle.**
- **`--depot <chemin>`.** Installée en outil de poste, la commande calcule son dépôt par défaut
  depuis sa propre position — `~/.somtech`, donc jamais le tien. Poser dans un dépôt et faire
  naître sans `--depot`, c'est se voir refuser un lieu qu'on vient de créer.

L'amorce est facultative, mais elle règle un défaut connu : une session « née correctement,
qui ne fait rien, parce que personne ne lui dit de commencer ». Quand tu en passes une, la
naissance vérifie **par le fait** que le brief a été pris, et échoue s'il est resté dans la
boîte de saisie — le pane, lui, reste ouvert : briefe-la à la main plutôt que de la refaire
naître.

### Elle refuse un lieu que git ne porte pas — et c'est le versement qui la débloque

Depuis `T-20260814-0139`, **la naissance refuse** quand aucun commit ne porte le lieu, quand
il n'est versé qu'à moitié, ou quand il porte une garde d'ouverture qu'une naissance
antérieure a posée et que personne n'a versée.

Ce n'est pas une exigence nouvelle : le versement est déjà prescrit juste au-dessus. Le refus
le rend seulement **opposable** — parce que l'instruction n'était pas suivie. Mesuré au
moment de l'arbitrage : sur cinq lieux clients posés, **trois portaient une garde qu'aucun
commit ne contenait**. Un `git checkout` les désarmait sans un mot, le fichier restant un
`settings.json` parfaitement valide, simplement sans `hooks`.

| Ce que le refus dit | Le geste qui le lève |
|---|---|
| `aucun commit ne porte « … »` | verse le lieu — la commande exacte est dans le message |
| `ce lieu est versé à moitié : aucun commit ne porte …` | verse les fichiers qu'il nomme, un à un |
| `la garde d'ouverture posée dans ce lieu n'est dans aucun commit` | verse le `settings.json` du lieu |

**Le refus tombe avant la moindre écriture** : rien n'a été posé, aucun pane n'a été créé,
le trousseau n'a pas été lu. Relance après avoir versé.

> **Ce qu'il ne refuse PAS, et pourquoi.** La garde que *cette* naissance vient de poser est
> seulement **signalée**. Personne ne pouvait la verser avant qu'elle existe : la refuser
> rendrait toute première naissance impossible — on ne peut pas committer un fichier que la
> commande refuse d'écrire. Verse-la après ; sans quoi le prochain lancement, lui, refusera.

## Ce que cette compétence ne fait jamais

- **Elle n'ouvre pas la ligne de l'orchestrateur** — elle vérifie seulement que le poste
  pourrait l'ouvrir. C'est lui qui l'ouvre, au premier geste de son chantier, et c'est son
  métier qui le lui dit.
- **Elle ne se branche sur aucun canal existant.** Il n'y a pas de `--canal` ici : un
  orchestrateur ouvre sa propre ligne interne, il ne rejoint pas celle d'un client.
- **Elle n'écrit rien hors de `.orchestrateur/<nom>/`.** Le reste du dépôt n'est pas son
  affaire.
- **Elle ne remplit pas `CONTEXTE.md` à la place de qui sait.** Elle signale les chevrons ;
  elle n'invente ni la portée, ni le destinataire, ni les pairs.
- **Elle ne rafraîchit pas un lieu déjà posé, et ne le répare pas davantage.** Une reprise sur
  un lieu complet ne retouche à rien ; sur un lieu incomplet, elle refuse au lieu de le
  compléter. Rafraîchir est un geste différent — `npx @somtech-solutions/pack orchestrateur-update --nom <nom>` —
  et il ne touche jamais `CONTEXTE.md`.
- **Elle ne mène aucun chantier.** Elle ne découpe pas, n'ouvre aucun chef d'équipe, ne pose
  aucun ticket. Le lieu posé et la session née, elle s'arrête.

## Ce que cette compétence n'abroge pas

Les règles d'or restent entières : une branche par changement, une PR ouverte en brouillon dès
le premier commit, une revue avant de la passer en prêt. Poser le lieu d'un orchestrateur
n'est pas un geste plus anodin qu'un autre parce qu'il est court.

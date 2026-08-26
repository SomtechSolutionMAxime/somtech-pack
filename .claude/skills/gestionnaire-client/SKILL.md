---
name: gestionnaire-client
description: Prépare le lieu d'un représentant client — un dossier versionné, dans le dépôt du client, qui porte son métier, ses moyens bornés au ServiceDesk, et ses droits en lecture seule. Vérifie d'abord qu'elle a de quoi finir — les gabarits du pack présents dans ce dépôt, et le canal privé du client joignable — et refuse tout net, sans rien créer, s'il manque l'un ou l'autre. Utilise cette compétence quand on te demande d'installer, de préparer, de mettre en place ou d'initialiser un représentant pour un client — même si on dit seulement « ouvre-lui un canal » ou « fais-lui un représentant ». NE PAS confondre avec /ligne-directe (le transport qu'elle vérifie sans l'ouvrir) ni avec l'ouverture de la session du représentant lui-même, qui est un lot séparé.
---

# Tu prépares le lieu d'un représentant client

Un représentant client ne doit pas être une session qu'on ouvre et qui s'évapore : c'est un
**lieu**, versionné dans le dépôt du client, que n'importe quelle session peut reprendre
sans rien redécouvrir. Cette compétence ne devient **jamais** ce représentant — elle lui
prépare son adresse, une fois, puis s'arrête.

```
/gestionnaire-client <client> --canal <le canal privé de ce client> --dirigeant <son courriel>
```

Le résultat, quand tout va bien :

```
<dépôt du client>/
└── .gestionnaire/
    └── <client>/
        ├── CLAUDE.md               ← le métier, copié du pack — généré, jamais édité à la main
        ├── CONTEXTE.md             ← ce qui est propre à ce client — à la main, jamais écrasé
        ├── RONDE.md                ← le briefing qu'il pose en `/loop` — à la main, jamais écrasé
        ├── .mcp.json               ← le ServiceDesk SEUL — Somcraft en est exclu, délibérément
        └── .claude/
            └── settings.json       ← lecture du dépôt, sa ligne, le registre — rien d'autre
```

> **Pourquoi `settings.json` n'est pas à plat, contrairement à `.mcp.json`.** Claude Code ne
> résout les permissions d'un projet qu'à `.claude/settings.json` — jamais à sa racine. Un
> `settings.json` posé à plat serait présent sur disque et **jamais lu** : les permissions du
> représentant ne borneraient rien, en silence. C'est un défaut déjà vécu sur ce lot — corrigé
> avant fusion, gardé depuis par un test qui ancre le placement sur ce dépôt lui-même plutôt
> que sur une supposition.

> **Ce que cette compétence n'est pas.** Elle ne répond à personne, n'ouvre aucune demande,
> ne lance aucun chantier. Ça, c'est le métier du représentant **une fois installé** — décrit
> dans `CLAUDE.md`, pas ici. Ouvrir sa session et la connecter est un autre lot ; cette
> compétence s'arrête quand le lieu existe, est versionné, et que le canal est vérifié
> joignable.

## Le seul principe qui gouverne tout le reste

> **Elle ne crée rien tant qu'elle n'a pas de quoi finir.**

Un représentant né sur un canal où le robot n'est pas invité est un représentant **muet** :
il croit parler, personne ne l'entend, et rien ne le signale — c'est le mode de panne que
cette compétence existe pour supprimer. La vérification n'est donc pas une précaution parmi
d'autres, elle **précède littéralement** la première écriture sur disque.

**Le canal n'est pas la seule chose qui peut manquer.** Un dépôt qui n'a pas reçu la version
du pack portant les gabarits n'a rien à copier — et vérifier le canal sans vérifier la source,
c'est créer le répertoire puis échouer dedans. C'est arrivé (`T-20260807-0067`) : le lieu vide
restait, et la relance suivante le lisait comme un lieu posé. **La source est donc vérifiée au
même titre que le canal, fichier par fichier, et avant lui** — un refus qui ne dépend que du
disque local ne coûte aucun aller-retour vers Slack.

## Prérequis

- **La ligne directe est installée sur ce poste** (`$HOME/.somtech/ligne-directe`). Sans
  elle, aucune vérification n'est possible : dis-le et arrête-toi.
- **Le canal du client existe déjà et il est privé.** Le créer, ou y inviter le robot,
  est un geste humain — cette compétence ne le fait jamais (voir plus bas).
- **Tu connais le courriel du dirigeant, et il est celui d'un membre de l'espace.** Un
  gestionnaire naît avec DEUX lignes : celle de son client, et une ligne interne vers le
  dirigeant — sans laquelle il ne peut honorer aucune des quatre obligations de son métier
  qui exigent qu'il REMONTE. La pose refuse et ne crée rien si ce courriel ne désigne
  personne (`dirigeant_inconnu`).
- **Tu es dans le dépôt du client**, ou tu connais son chemin (`--depot`, par défaut le
  répertoire courant). C'est ce dépôt qui reçoit `.gestionnaire/<client>/`.
- **Ce dépôt a reçu la version du pack qui porte les gabarits** — la commande le vérifie
  elle-même et refuse sans rien créer si ce n'est pas le cas. Le geste qui débloque :
  `npx @somtech-solutions/pack update` dans le dépôt du client.

## Le geste

```bash
LD="node $HOME/.somtech/ligne-directe/bin/ligne-directe.js"

$LD representant <client> --canal <le canal privé, sans le croisillon> \
                          --dirigeant <le courriel du dirigeant> [--depot <chemin>]
```

La commande rend un objet JSON et son code de sortie le résume : `0` si le lieu existe
désormais **en entier** (qu'elle vienne de le créer ou qu'il y était déjà), `1` si elle a
refusé. Sur un refus, le motif est aussi écrit en clair sur la sortie d'erreur — lis-le, il
nomme le geste qui débloque.

**Elle est idempotente, et l'idempotence ne vaut que pour un lieu COMPLET.** Relancée sur un
client déjà installé — **tous les fichiers de son gabarit** présents — elle ne retouche à rien, le dit
(`deja_installe`) et s'arrête là ; sur cette voie elle ne fait même pas l'aller-retour vers
Slack, il n'y a rien à vérifier pour ne rien faire.

**Un lieu incomplet, lui, n'est pas un lieu.** Elle le refuse (`lieu_partiel`) au lieu de le
déclarer installé — c'est le défaut le plus grave corrigé par `T-20260807-0067` : un
répertoire vide, résidu d'une pose interrompue, était rendu comme `deja_installe: true` avec
`presents: []`. Elle ne le complète pas non plus : elle ne saurait pas ce qu'un humain y a
déjà changé. Retire le reste à la main, puis relance.

## Si elle refuse — et c'est le cas qui compte le plus

Le refus porte un motif, et le geste qui le lève n'est pas le même selon lequel :

| Motif rendu | Ce qui s'est passé | Le geste qui débloque |
|---|---|---|
| `nom_invalide` | Le nom du client n'est pas **un seul segment de chemin** : il traverse un répertoire (`/`, `\`, `..`), commence par un point ou un tiret, ou porte un caractère hors lettres/chiffres/tirets. La **casse est libre** — `Charles-Olivier` est un nom parfaitement valide | Reprends un nom en lettres, chiffres et tirets. Rien n'a été créé : ce refus tombe **avant** tout accès au disque et tout appel réseau |
| `lieu_ambigu` | Plusieurs lieux sous `.gestionnaire/` ne diffèrent **que par la casse** (`Francois` et `francois`), et aucun ne porte exactement le nom demandé. Rien ici ne peut dire lequel est le bon — en choisir un reviendrait à poser à côté d'un lieu vivant | Écarte celui qui ne sert plus (`mv .gestionnaire/<autre> .gestionnaire/<autre>.ecarte`), puis relance. Aucun troisième lieu n'a été créé |
| `lieu_partiel` | `.gestionnaire/<client>/` existe mais lui manque des fichiers | Écarte ce reste (`mv .gestionnaire/<client> .gestionnaire/<client>.ecarte`), puis relance — elle ne complète jamais |
| `gabarits_absents` | Ce dépôt n'a pas la version du pack qui porte les gabarits | `npx @somtech-solutions/pack update` dans le dépôt du client |
| `gabarit_perime` | Le gabarit que ce dépôt porte **n'est pas celui du pack installé sur ce poste** — comparé par **empreinte**, pas par numéro de version. Un représentant posé là porterait un métier d'une autre époque, et il ne le saurait jamais : il ne lit que son lieu | Le refus **nomme les deux empreintes et les deux chemins**. Mets le pack à jour dans le dépôt du client (`npx @somtech-solutions/pack update`), puis relance. Rien n'a été créé |
| `droits_non_versionnables` | Un motif d'exclusion du dépôt (`.gitignore` ou `.git/info/exclude`) empêche de verser `.claude/settings.json` — le lieu serait complet sur ce disque et **sans permissions bornées partout ailleurs** | Le refus nomme le motif et sa source. Lève l'exclusion : `git add -f <le fichier>` une fois posé, ou une négation `!.claude/settings.json` dans le fichier d'exclusion |
| `absent` | Aucun canal de ce nom n'existe | Vérifie l'orthographe, ou fais créer le canal |
| `non_membre` | Le canal existe, le robot n'y est pas | Fais-le **inviter** par un humain (`/invite` depuis le canal) |
| `dirigeant_inconnu` | Aucun membre de l'espace ne répond à ce courriel | Corrige le courriel, puis relance. **Ne touche ni au canal, ni au trousseau** : les deux ont été vérifiés et vont bien |
| `dirigeant_non_designe` | Le lieu était posé, le poste n'a pas pu retenir qui est le dirigeant | Le lieu **a été retiré**, rien ne subsiste. Corrige la cause que le message nomme, relance |
| `ecriture_interrompue` | La pose a échoué en cours de route (droits, disque) | Rien à nettoyer — elle a retiré ce qu'elle avait commencé. Corrige la cause, relance |

Les deux premiers sont prononcés **sans toucher au réseau** : ils ne dépendent que du disque
du dépôt client.

**Tu ne contournes ni l'un ni l'autre toi-même.** Un robot ne rejoint pas un canal privé —
Slack ne rend ce geste à aucun jeton d'application, sur aucun canal privé, quel que soit le
droit accordé. Ce n'est donc pas une limite technique à demander de lever : le droit de
rejoindre n'existe que pour les canaux **publics**, et l'accorder ne changerait rien ici.
**Le geste appartient à un humain**, et c'est précisément ce que le refus doit faire
comprendre à qui te lit.

Sur un refus : **tu t'arrêtes**, tu rapportes le motif et le geste qui débloque, sans rien
tenter d'autre. Rien n'a été créé — vérifie-le si tu en doutes (`ls .gestionnaire/` ne rend
rien de nouveau) plutôt que de te fier au seul message.

## Si elle crée le lieu

**Verse-le tout de suite** — poser des droits, un métier et un rattachement à un canal n'est
pas assez anodin pour se passer d'une branche et d'une revue, même pour un seul client :

```bash
git checkout -b chore/representant-<client>
git add .gestionnaire/<client>/
git commit -m "chore(representant): installe le representant de <client>"
git push -u origin chore/representant-<client>
gh pr create --draft --title "chore(representant): installe le representant de <client>" \
  --body "Lieu du representant pose par /gestionnaire-client. Canal verifie joignable."
```

Passe la PR en prêt (`gh pr ready`) une fois que quelqu'un l'a relue — cette compétence ne
fusionne jamais elle-même.

> **Ce versement n'est plus facultatif, et ce n'est plus toi qui le rappelles.** Depuis
> `T-20260814-0139`, **la naissance refuse** un lieu qu'aucun commit ne porte, un lieu versé
> à moitié, ou un lieu dont la garde d'ouverture n'a jamais été versée. Le refus tombe
> **avant la moindre écriture** — rien de posé, aucun pane — et son message nomme la commande
> exacte qui le lève.
>
> Ce n'est pas une exigence nouvelle : c'est celle du paragraphe ci-dessus, devenue
> opposable. Mesuré au moment de l'arbitrage : sur cinq lieux clients posés, **trois
> portaient une garde qu'aucun commit ne contenait**, et un `git checkout` les désarmait sans
> un mot — le fichier restant un `settings.json` valide, simplement sans `hooks`.
>
> Concrètement : **un lieu posé et non versé fera refuser l'ouverture de sa session**, qui est
> un autre lot. Verse avant de passer la main.

**Si la commande a rendu un avertissement** (`avertissements`, le plus souvent : aucun
fichier d'environnement à la racine du dépôt), **dis-le** avant de continuer. Ce n'est pas
bloquant — le lieu est créé quand même — mais un représentant né sans accès au registre le
découvrira en pleine conversation si personne ne l'a prévenu à l'installation. C'est
exactement le silence que cette compétence existe pour éviter, et le taire ici le
réintroduirait par un autre chemin.

## Avant de le faire naître — son contexte et sa ronde

**Deux fichiers du lieu sont posés AVEC leurs chevrons, et ce sont les deux que tu remplis** :

| `CONTEXTE.md` | ce que le métier ne peut pas savoir de ce client — son nom entre nous, le canal où on lui parle, son application au registre |
| `RONDE.md` | **le briefing qu'il pose en `/loop` à sa naissance** — sa cadence, son client en une ligne, ce que chaque tour doit regarder en plus, et ce qu'il a promis à quelle échéance |

> ⚠️ **Sans ronde, un représentant ne se réveille jamais — et personne ne s'en aperçoit.** Son
> sommeil ressemble trait pour trait à « rien à signaler » : une ronde éteinte ne produit aucune
> erreur. Mesuré le 2026-08-26 sur le parc : **un seul lieu vivant sur dix-huit** portait un
> briefing de ronde, et son représentant l'avait écrit lui-même à la main.

**Remplis-les, ou fais-les remplir, avant la naissance — la naissance les exige désormais.** Un
lieu dont l'un des deux est resté mot pour mot le gabarit **fait refuser la naissance**, qui
nomme les rubriques restées et n'ouvre aucun pane. Le refus se borne à ce que le gabarit a
déposé : un chevron de ta prose n'est jamais compté.

## Ce que le représentant dira, une fois installé (non-régression EF-AGT-003 / RA-AGT-007)

Le `CLAUDE.md` que cette compétence copie porte déjà cette promesse, telle quelle — **cette
compétence-ci ne la prononce pas elle-même**, elle prépare seulement le lieu où elle vit :
un chantier mené pour ce client dit au représentant, et à lui seul, que sa mise en ligne
**attend son tour** — jamais qu'elle est **en cours** quand ce n'est pas vrai.

> ✅ « C'est prêt. Ça attend son tour pour la mise en ligne — je te préviens dès que c'est en place. »
> ❌ « C'est en cours. »

Dire qu'on attend n'a jamais coûté un client ; laisser croire que ça avance, oui.

## Ce que cette compétence ne fait jamais

- **Elle ne crée pas le canal**, ne l'invite pas, ne demande aucun droit Slack
  supplémentaire. Mesuré et clos : un robot ne rejoint pas un canal privé, on l'y invite, et
  le droit de rejoindre ne couvre que les canaux publics — l'accorder ne réglerait rien.
- **Elle n'écrit rien hors de `.gestionnaire/<client>/`.** Le reste du dépôt client
  n'est pas son affaire.
- **Elle n'ouvre ni ne connecte la session du représentant.** Le lieu posé, elle s'arrête —
  la suite est un autre lot.
- **Elle ne rafraîchit pas un lieu déjà posé, et ne le répare pas davantage.** Une reprise sur
  un lieu complet ne retouche à rien ; sur un lieu incomplet, elle refuse au lieu de le
  compléter. Rafraîchir et réparer sont des gestes différents, pas celui-ci.
- **Elle ne verse pas Somcraft dans les moyens du représentant.** Il porte les documents de
  *tous* les clients ; un représentant qui y aurait accès pourrait lire le dossier d'un
  autre. Seul le ServiceDesk figure dans `.mcp.json` — vérifie-le en lisant les clés
  déclarées, jamais en supposant qu'une absence de mention suffit.
- **Elle lui retire les outils du web** — `WebFetch`, `WebSearch`, et les commandes `curl` et
  `wget`, refusés nommément. Le web est l'entrée la plus directe du biais anglo-occidental —
  on y cherche une règle de protection des renseignements, on y trouve le RGPD — et le chemin
  par lequel une phrase lue ailleurs repart chez le client sous notre en-tête. Ses sources
  sont le registre et ce que le client lui dit ; son métier n'emploie le web nulle part.

  **Et voilà exactement ce que ça ne ferme pas.** Trois faits mesurés sur un poste, en faisant
  naître de vraies sessions bornées — jamais déduits d'une documentation :

  | Ce qui a été mesuré | Ce qu'on en tire |
  |---|---|
  | un outil nommé dans `deny` **disparaît** de la session, même dans un dépôt non approuvé | la garantie tient là, et seulement là |
  | un outil nommé dans `allow` est **ignoré** tant qu'un humain n'a pas approuvé le dépôt une première fois | on n'écrit jamais une protection dans `allow` |
  | une commande shell **non listée s'exécute sans rien demander** | tout ce qui n'est pas refusé est atteignable |

  Le troisième est celui qui compte : `deny` est une **liste finie contre un phénomène
  ouvert**. `python3 -c` et une dizaine d'autres chemins atteignent le web sans passer par
  `curl`. Ce bornage retire donc les portes qu'on prend sans y penser — il ne clôt pas le
  shell, et personne ne doit le lire comme s'il le faisait. Ce qui couvre le reste est une
  ligne du métier, dans `CLAUDE.md` : *« tu ne vas jamais chercher ailleurs ce que tu n'as
  pas — tes sources sont deux : le registre, et ce que ce client t'a dit »*. Les deux moitiés
  sont nécessaires, et aucune ne remplace l'autre.

## Ce que cette compétence n'abroge pas

Les règles d'or restent entières : une branche par changement, une PR ouverte en brouillon
dès le premier commit, une revue avant de la passer en prêt. Poser le lieu d'un
représentant n'est pas un geste plus anodin qu'un autre parce qu'il est court.

---
name: gestionnaire-client
description: Prépare le lieu d'un représentant client — un dossier versionné, dans le dépôt du client, qui porte son métier, ses moyens bornés au ServiceDesk, et ses droits en lecture seule. Vérifie d'abord que le canal privé du client est joignable et refuse tout net, sans rien créer, si le robot n'y est pas déjà invité. Utilise cette compétence quand on te demande d'installer, de préparer, de mettre en place ou d'initialiser un représentant pour un client — même si on dit seulement « ouvre-lui un canal » ou « fais-lui un représentant ». NE PAS confondre avec /ligne-directe (le transport qu'elle vérifie sans l'ouvrir) ni avec l'ouverture de la session du représentant lui-même, qui est un lot séparé.
---

# Tu prépares le lieu d'un représentant client

Un représentant client ne doit pas être une session qu'on ouvre et qui s'évapore : c'est un
**lieu**, versionné dans le dépôt du client, que n'importe quelle session peut reprendre
sans rien redécouvrir. Cette compétence ne devient **jamais** ce représentant — elle lui
prépare son adresse, une fois, puis s'arrête.

```
/gestionnaire-client <client> --canal <le canal privé de ce client>
```

Le résultat, quand tout va bien :

```
<dépôt du client>/
└── .gestionnaire/
    └── <client>/
        ├── CLAUDE.md               ← le métier, copié du pack — généré, jamais édité à la main
        ├── CONTEXTE.md             ← ce qui est propre à ce client — à la main, jamais écrasé
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

> **Elle ne crée rien tant qu'elle n'a pas vérifié que le canal est joignable.**

Un représentant né sur un canal où le robot n'est pas invité est un représentant **muet** :
il croit parler, personne ne l'entend, et rien ne le signale — c'est le mode de panne que
cette compétence existe pour supprimer. La vérification n'est donc pas une précaution parmi
d'autres, elle **précède littéralement** la première écriture sur disque.

## Prérequis

- **La ligne directe est installée sur ce poste** (`$HOME/.somtech/ligne-directe`). Sans
  elle, aucune vérification n'est possible : dis-le et arrête-toi.
- **Le canal du client existe déjà et il est privé.** Le créer, ou y inviter le robot,
  est un geste humain — cette compétence ne le fait jamais (voir plus bas).
- **Tu es dans le dépôt du client**, ou tu connais son chemin (`--depot`, par défaut le
  répertoire courant). C'est ce dépôt qui reçoit `.gestionnaire/<client>/`.

## Le geste

```bash
LD="node $HOME/.somtech/ligne-directe/bin/ligne-directe.js"

$LD representant <client> --canal <le canal privé, sans le croisillon> [--depot <chemin>]
```

La commande rend un objet JSON et son code de sortie le résume : `0` si le lieu existe
désormais (qu'elle vienne de le créer ou qu'il y était déjà), `1` si elle a refusé.

**Elle est idempotente.** Relancée sur un client déjà installé, elle ne retouche à rien —
pas même pour compléter un lieu resté incomplet après une interruption précédente. Elle le
dit (`deja_installe`, avec la liste de ce qu'elle trouve) et s'arrête là. Sur cette voie,
elle ne fait même pas l'aller-retour vers Slack : il n'y a rien à vérifier pour ne rien
faire.

## Si elle refuse — et c'est le cas qui compte le plus

Le refus porte un motif, et le geste qui le lève n'est pas le même selon lequel :

| Motif rendu | Ce qui s'est passé | Le geste qui débloque |
|---|---|---|
| `absent` | Aucun canal de ce nom n'existe | Vérifie l'orthographe, ou fais créer le canal |
| `non_membre` | Le canal existe, le robot n'y est pas | Fais-le **inviter** par un humain (`/invite` depuis le canal) |

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

**Si la commande a rendu un avertissement** (`avertissements`, le plus souvent : aucun
fichier d'environnement à la racine du dépôt), **dis-le** avant de continuer. Ce n'est pas
bloquant — le lieu est créé quand même — mais un représentant né sans accès au registre le
découvrira en pleine conversation si personne ne l'a prévenu à l'installation. C'est
exactement le silence que cette compétence existe pour éviter, et le taire ici le
réintroduirait par un autre chemin.

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
- **Elle ne rafraîchit pas un lieu déjà posé.** Une reprise ne retouche à rien, même pour
  compléter un fichier manquant ; rafraîchir est un geste différent, pas celui-ci.
- **Elle ne verse pas Somcraft dans les moyens du représentant.** Il porte les documents de
  *tous* les clients ; un représentant qui y aurait accès pourrait lire le dossier d'un
  autre. Seul le ServiceDesk figure dans `.mcp.json` — vérifie-le en lisant les clés
  déclarées, jamais en supposant qu'une absence de mention suffit.

## Ce que cette compétence n'abroge pas

Les règles d'or restent entières : une branche par changement, une PR ouverte en brouillon
dès le premier commit, une revue avant de la passer en prêt. Poser le lieu d'un
représentant n'est pas un geste plus anodin qu'un autre parce qu'il est court.

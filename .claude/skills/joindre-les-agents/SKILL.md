---
name: joindre-les-agents
description: Rend le dirigeant joignable par ses agents, et capable de les joindre tous — en mesurant d'abord ce que le poste sait déjà, puis en ne désignant que ce qui manque. Elle lit l'état du poste, dit quels rôles n'ont encore aucun canal, traduit les noms qu'on emploie en parlant vers ceux que la commande attend, et relaie ses refus mot pour mot. Utilise cette compétence quand on te demande de désigner le dirigeant d'un poste, d'ouvrir ou de brancher le canal commun d'un rôle, de configurer un poste neuf pour que ses agents entendent les consignes, ou quand quelqu'un se plaint que ses agents ne reçoivent rien — même si on dit seulement « désigne les canaux » ou « il faut que je puisse leur parler à tous ». NE PAS confondre avec /ligne-directe (la compétence de l'agent QUI PARLE sur sa ligne, jamais celle de l'opérateur qui désigne où l'on parle) ni avec /gestionnaire-client et /orchestrateur, qui posent le lieu d'un agent et non le lieu d'une parole.
---

# Tu rends le dirigeant joignable, et joignant

Deux choses manquent à un poste neuf, et rien ne les réclame tant qu'on ne bute pas dessus :

- **le poste ne sait pas qui est le dirigeant** — les agents qui doivent lui remonter quelque
  chose ouvrent alors une ligne où personne n'a la parole, et le garde la tient fermée ;
- **aucun canal ne porte les consignes à un rôle** — le dirigeant écrit « mettez-vous à jour »,
  et les agents qui travaillent en ce moment ne l'entendent jamais.

Cette compétence désigne l'un et l'autre. Elle ne crée aucun canal, n'ouvre aucune ligne,
n'écrit rien dans le dépôt : elle **inscrit au poste** ce que les agents chercheront ensuite.

## Le seul principe qui gouverne tout le reste

> **Elle ne désigne rien tant qu'elle n'a pas mesuré ce qui est déjà là.**

Rejouer trois commandes à l'aveugle sur un poste déjà configuré est le geste qui use : il ne
dit pas ce qui manque, il redésigne ce qui était bon, et il laisse croire qu'on a réparé
quelque chose. **La mesure précède littéralement la première désignation** — c'est elle qui
répond à la seule question qu'un humain ne peut pas se poser sans lire le poste : **quels rôles
n'ont encore aucun canal.**

De cette mesure découle l'idempotence :
**relancée sur un poste complet, elle ne redésigne rien.**
Elle dit ce qui est en place et s'arrête là.

## Prérequis

- **La ligne directe est installée sur ce poste** (`$HOME/.somtech/ligne-directe`). Sans elle,
  rien n'est mesurable : dis-le et arrête-toi. Le geste qui débloque :
  `npx @somtech-solutions/pack setup`.
- **Les canaux existent déjà dans Slack, et notre robot y a été invité par un humain.** Un
  robot ne se met pas lui-même dans un canal, et cette compétence n'en crée aucun.
- **Un canal par rôle, un rôle par canal.** Un canal partagé entre deux rôles est refusé —
  chacun devrait y trier ce qui ne le concerne pas, et un canal qu'on trie cesse d'être lu.

## Ce qu'elle mesure d'abord

```bash
LD="node $HOME/.somtech/ligne-directe/bin/ligne-directe.js"

$LD etat
```

Quatre choses à lire dans ce qu'elle rend, et rien d'autre ne sert ici :

| Ce que tu lis | Ce que ça t'apprend |
|---|---|
| `dirigeant` | `{"designe": true}` — le poste sait à qui les agents parlent. `null` — il ne le sait pas |
| `communs` | un objet par rôle **déjà** pourvu : son rôle, son canal, le nombre d'autorisés |
| `sans_role` | un canal désigné par une version antérieure, qui **ne diffuse plus rien** — il porte lui-même le geste qui le rattache à un rôle |
| `ouvertes` | les lignes vivantes. Aucun de leurs canaux ne peut devenir un canal commun |

**Les rôles qui n'ont pas de canal sont ceux qui n'apparaissent pas dans `communs`** — les rôles
connus sont `representant` et `orchestrateur`. C'est ce que tu rapportes avant de toucher à
quoi que ce soit, et c'est l'apport de cette compétence sur un copier-coller.

**Le courriel du dirigeant ne ressort jamais de cette mesure**, et ce n'est pas un manque : le
poste rend une présence, pas une adresse. S'il faut le désigner et que tu ne le connais pas,
demande-le — ne le devine pas.

## Les noms qu'on emploie ne sont pas ceux que la commande attend

C'est le piège qui a fait buter, et il ne s'annonce pas : on dit « gestionnaire », la commande
attend `representant`. Un rôle mal nommé est refusé net — rien n'est désigné, ce qui est le bon
comportement, mais le message parle du nom interne que personne n'avait sous les yeux.

| Ce qu'on dit en parlant | Ce que tu tapes |
|---|---|
| le gestionnaire, le gestionnaire de compte, le représentant d'un client | `representant` |
| l'orchestrateur, le coordonnateur d'un chantier | `orchestrateur` |

**Porte cette traduction toi-même.** Celui qui te parle n'a pas à connaître le nom interne d'un
rôle pour désigner son canal.

## Désigner le dirigeant

Une fois par poste, si et seulement si la mesure a rendu `dirigeant: null` :

```bash
$LD dirigeant <courriel>
```

Son adresse ne quitte pas le poste : les agents demandent « le dirigeant », jamais son
courriel. Tant que personne n'est désigné, **une ligne interne ouverte vers lui refuse la
parole à tout le monde, lui compris**, en ayant l'air ouverte.

## Désigner le canal d'un rôle

Une fois par rôle, pour chaque rôle que la mesure a rendu sans canal :

```bash
$LD commun <canal> --role <role> --dirigeant <courriel>
```

`--dirigeant` nomme qui a le droit d'écrire une consigne sur ce canal ; il se répète pour en
autoriser plusieurs. Sans autorisé, la désignation est refusée : n'importe quel membre de
l'espace pourrait sinon faire rafraîchir la configuration de tous les agents du poste.

Le sens est **descendant seulement** : aucun agent n'écrit sur ce canal, et cette compétence
n'y poste rien.

**Redésigner le même rôle n'est pas un conflit** — c'est ainsi qu'on corrige une liste
d'autorisés. Mais ne le fais jamais « pour être sûr » :
sur un rôle déjà pourvu du bon canal, tu n'as rien à faire.

## Si elle refuse

Le refus est le cas qui compte le plus, et il a déjà été écrit avec soin. **Recopie-le tel
quel.** Ne le reformule pas dans tes mots : une reformulation remplace ce qui a été **mesuré**
par ce qu'on en conclut, et c'est exactement ainsi qu'un refus se met à mentir.

| Ce que le refus dit, mot pour mot | Ce qui a été mesuré | Le geste qui débloque |
|---|---|---|
| `dans cet espace` | Aucun canal ne porte ce nom | Vérifie l'orthographe du canal ; s'il n'existe pas, un humain le crée dans Slack — notre robot ne crée aucun canal |
| `est archivé — personne ne peut plus y écrire` | Le canal existe, en lecture seule — aucune consigne n'en partirait, et le robot en est toujours membre | Un compte humain le désarchive dans Slack, ou tu en désignes un autre |
| `Un robot ne rejoint pas un canal de lui-même.` | Le canal existe et notre robot n'y est pas | Un humain l'y invite dans Slack, puis relance |
| `un canal ne peut pas être à la fois` | Ce canal porte déjà la ligne d'un chantier — chaque message de cet interlocuteur partirait à tous les agents | Désignes-en un autre |
| `qu'un seul rôle, sinon chacun doit y trier ce qui ne le concerne pas.` | Ce canal est déjà celui d'un autre rôle | Désignes-en un autre. Redésigner le **même** rôle, en revanche, passe |
| `Nomme au moins une personne.` | Aucun autorisé n'accompagne la désignation | Ajoute `--dirigeant <courriel>`, une fois par personne |
| `rôle inconnu : «` | Le rôle tapé n'est pas un rôle connu — c'est le cas de `gestionnaire` | Reprends la traduction plus haut : `representant` ou `orchestrateur` |
| `le canal n'est PAS designe` | Un des courriels ne désigne personne dans l'espace Slack | Corrige le courriel — la désignation est entière ou nulle, elle n'inscrit jamais une liste amputée |
| `le dirigeant n'est PAS designe.` | Le courriel ne désigne personne dans l'espace Slack | Corrige le courriel. Rien n'a changé : les lignes déjà ouvertes gardent leurs autorisés |

Sur un refus : **tu t'arrêtes**, tu rapportes ce que la commande a dit et le geste qui débloque.
Rien n'a été désigné — le prouver ne coûte qu'un `$LD etat`, qui ne montrera ni canal ni
dirigeant nouveau. Ne te fie pas au seul message.

## Ce que cette compétence ne fait jamais

- **Elle ne crée aucun canal et n'invite personne.** Les deux sont des gestes humains, dans
  Slack. Elle désigne un canal qui existe et où notre robot a été mis.
- **Elle n'ouvre, ne ferme et ne renomme aucune ligne.** Ça, c'est le geste de l'agent qui
  parle, et il vit dans `/ligne-directe`.
- **Elle ne poste rien sur le canal commun.** Le canal est descendant : le dirigeant y écrit,
  personne d'autre.
- **Elle ne met pas le poste à jour et ne relève pas le veilleur.** Ces deux gestes ont déjà
  leur chemin, et le dirigeant l'a tranché : ils ne sont pas dans ce lot.
- **Elle n'écrit rien dans le dépôt** — aucun fichier, aucune branche, aucune demande de
  fusion. Ce qu'elle inscrit vit sur le poste, pas dans un dépôt versionné.
- **Elle ne redésigne rien qui soit déjà en place.** Sur un poste complet, elle rend l'état et
  s'arrête.

## Ce que cette compétence n'abroge pas

Les règles d'or restent entières. Désigner un canal n'est pas un geste plus anodin qu'un autre
parce qu'il est court : c'est par là que passeront les consignes que tous les agents du poste
prendront pour la parole du dirigeant.

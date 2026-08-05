# Ligne directe Slack — canal de discussion bidirectionnel entre un agent herdr et le dirigeant

- **Demande** : D-20260805-0004
- **Application** : Somtech Pack
- **Date** : 2026-08-05
- **Statut** : design validé (brainstorm), à découper

## Le problème

Un agent qui pilote un chantier (`/orchestrer-chantier`) ne peut parler au dirigeant que dans son pane herdr. Pour savoir où en est un chantier, ou pour trancher l'arbitrage qu'il attend, il faut être devant l'écran, dans le bon pane. Un chantier qui dure plusieurs jours et qui bloque sur une décision reste bloqué jusqu'à ce que quelqu'un aille le voir.

Le dirigeant, lui, a déjà Slack sur son téléphone. C'est là qu'il lit, et c'est là qu'il devrait pouvoir répondre.

## Ce qu'on veut

Un geste — `/ligne-directe` — qu'un agent herdr invoque pour **ouvrir, tenir et fermer une ligne de discussion Slack avec le dirigeant**, dans les deux sens.

Le nom dit la fonction, jamais le mécanisme : on ouvre une ligne avec quelqu'un, on n'« utilise pas Slack ». Si demain le transport change, le geste ne bouge pas.

## Les arbitrages tranchés au brainstorm

| Question | Décision | Ce qui a été écarté, et pourquoi |
|---|---|---|
| **Identité du bot** | Une seule application Slack, installée une fois. Chaque agent poste sous **son propre nom et son avatar** par emprunt d'identité. | Une vraie application par chantier : un cycle création / installation / révocation par chantier, un jeton à stocker à chaque fois, et un plafond d'applications par espace de travail. Insoutenable pour un chantier qui vit trois jours. |
| **Sens du pont** | **Bidirectionnel**, par un veilleur qui tourne sur le poste. | Sortant seul : ne libère pas de l'écran. Lecture à l'initiative de l'agent : un agent bloqué qui attend une réponse ne relèvera jamais ses messages — il reste bloqué. |
| **Lieu de la conversation** | **Un canal dédié par chantier**, créé à l'ouverture, archivé à la clôture. | Un canal unique à fils : plus économe, mais le dirigeant a choisi la place. |
| **Portée** | **Geste générique** ; `/orchestrer-chantier` est le premier usage, pas le propriétaire. | Le câbler dans `/orchestrer-chantier` : il faudrait démêler le mécanisme du cas d'usage dès le deuxième besoin. |
| **Discipline de parole** | Ce qui appelle une décision **+ les jalons**. | Tout le fil : le canal devient un flux de journaux qu'on cesse de lire en deux jours — et un canal qu'on ne lit plus rend le pont inutile. |

## Architecture

### Trois pièces

| Pièce | Rôle | Portée |
|---|---|---|
| **Le veilleur** | Processus permanent. Tient la connexion Slack, le registre des lignes, crée et archive les canaux, traduit dans les deux sens. | Poste — installé par `pack setup`, comme `claude-swt` et le canvas. Jamais dans un projet. |
| **La commande locale** | Ce qu'un agent invoque : `ouvrir`, `dire`, `demander`, `fermer`. Parle au veilleur. | Poste |
| **La compétence `/ligne-directe`** | Ce qu'un agent lit pour savoir **quand** parler et **comment**. | `somtech-pack` — descend dans tous les dépôts |

### Un veilleur unique, pas un par agent

C'est le choix structurant. Un veilleur par agent multiplierait les connexions ouvertes, laisserait des processus orphelins chaque fois qu'un agent meurt mal, et se heurterait au plafond de connexions que Slack impose par application.

Surtout : **le veilleur unique survit à ses agents.** C'est ce qui lui permet de répondre « ce chantier est clos » quand le dirigeant écrit à une ligne fermée, au lieu d'avaler le message dans le vide.

### Le flux, dans les deux sens

**Ouverture** — l'agent demande sa ligne. Le veilleur crée le canal du chantier, y invite le dirigeant, et poste le message d'ouverture sous le nom et l'avatar de l'agent. Il inscrit la ligne au registre : quel canal, quel agent, quel pane.

**Agent → dirigeant** — l'agent invoque `dire` (rapporter) ou `demander` (solliciter un arbitrage, et attendre). Le veilleur poste sous l'identité de l'agent.

**Dirigeant → agent** — le dirigeant écrit dans le canal. Le veilleur retrouve la ligne au registre et **injecte le message dans le pane de l'agent**, qui le reçoit comme s'il avait été tapé au clavier.

**Clôture** — l'agent ferme sa ligne. Le veilleur poste le bilan, archive le canal, retire la ligne du registre.

### L'identité empruntée

Une seule application déclarée, mais chaque message porte le nom du chantier et son avatar. Trois chantiers actifs, trois interlocuteurs distincts à l'œil, un seul jeton derrière.

Conséquence à assumer : l'emprunt d'identité ne vaut que pour les messages **postés dans un canal**. C'est aussi la raison pour laquelle le canal dédié est le bon lieu, et le message privé au bot ne l'était pas.

## Ce qui casse, et comment on le tient

| Situation | Comportement attendu |
|---|---|
| Le dirigeant écrit à un chantier clos | Le veilleur répond lui-même que la ligne est fermée. Le message n'est jamais avalé. |
| Le message contient des apostrophes ou des retours à la ligne | L'injection dans un pane casse dessus — piège déjà documenté dans `/orchestrer-chantier`. Le veilleur écrit le message dans un fichier et n'injecte qu'une **référence**. |
| Le poste redémarre | Le registre vit sur disque. Le veilleur le relit, reprend ses lignes, détecte les agents morts entre-temps et archive leurs canaux. |
| L'agent est en plein travail quand le dirigeant écrit | Le message est reçu à sa prochaine respiration, pas au milieu d'une opération. C'est le comportement voulu. |
| L'agent meurt sans fermer sa ligne | Le veilleur détecte l'agent disparu et archive le canal avec une mention explicite. Pas de canal fantôme. |
| Slack est injoignable | La commande locale échoue **bruyamment** côté agent. Un rapport perdu en silence est pire qu'un rapport qui échoue. |

## Sécurité

Le jeton Slack vit dans le trousseau du poste. Il n'entre jamais dans un dépôt, ni dans un fichier de configuration versionné, ni dans une variable exportée par un profil partagé. Même raisonnement que la règle d'or n°12 sur les secrets à droits élevés : le secret reste chez celui qui l'exerce.

Le veilleur n'accepte d'instructions que des agents du poste ; il n'expose aucun point d'entrée réseau. C'est ce qui permet de se passer d'URL publique, de tunnel et de déploiement.

## Hors-scope

- **Les boutons, menus et formulaires Slack.** Un arbitrage se tranche en écrivant.
- **Le partage de fichiers et d'images** par le canal.
- **Tout destinataire autre que le dirigeant** — pas de multi-destinataire, pas de canal client.
- **Le remplacement des alertes ntfy et du feed ServiceDesk.** Ils gardent leurs rôles : ntfy alerte sur l'infrastructure, le feed annonce à l'équipe, la ligne directe converse sur un chantier.

## Ce que ça n'abroge pas

La ligne directe est un canal de conversation, **pas une source de vérité**. Ce qui est opposable continue de vivre dans le ServiceDesk : statuts, décisions, comptes rendus d'avancement. Un arbitrage tranché dans Slack doit être inscrit dans le ServiceDesk par l'agent qui l'a reçu — comme le veut déjà `/orchestrer-chantier` §5.

De la même façon, la discipline de parole n'autorise pas à déplacer dans Slack ce qui appartient au ServiceDesk. Le canal porte ce qui appelle une décision et les jalons ; le reste reste là où on le cherche.

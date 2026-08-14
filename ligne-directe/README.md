# Ligne directe — ce qu'il faut accorder à l'application Slack

Ce fichier s'adresse à **qui installe ou réinstalle l'application Slack** de la ligne directe. Il est installé avec le veilleur (`~/.somtech/ligne-directe/`) : on le trouve là où on opère.

Les agents, eux, n'ont pas besoin de ceci — leur mode d'emploi est la compétence `ligne-directe`.

> **Le piège que ce fichier existe pour éviter.** Une portée manquante ne fait pas tomber la ligne : elle la rend **sourde ou muette sur un seul chemin**, sans rien dire. On croit avoir installé, et une moitié du mécanisme ne fonctionne pas — souvent la moitié qu'on n'essaie que des semaines plus tard.

## Portées du robot (bot token scopes)

| Portée | À quoi elle sert | Ce qui casse sans elle |
|---|---|---|
| `chat:write` | poster dans le canal | plus rien ne sort |
| `chat:write.customize` | poster sous le nom et l'emoji du chantier | trois chantiers actifs se ressemblent tous |
| `channels:manage` | créer, renommer, archiver un canal **public** | aucune ligne interne ne s'ouvre |
| `channels:read` | retrouver un canal public existant | la reprise d'un chantier échoue |
| `channels:history` | lire les messages d'un canal public | le dirigeant écrit, rien n'arrive |
| **`groups:write`** | créer, renommer, archiver un canal **privé** | **aucune ligne client ne s'ouvre** |
| **`groups:read`** | retrouver un canal privé **et lister ses membres** | **personne n'est autorisé à écrire sur une ligne client** — l'autorisation s'y décide par l'appartenance au canal |
| **`groups:history`** | lire les messages d'un canal privé | **le client écrit, rien n'arrive** |
| `users:read` | résoudre un courriel ou un nom en identifiant Slack, **et nommer l'auteur d'un message sur une ligne client** | `--inviter` ne trouve personne, le canal naît sans son destinataire ; sur une ligne client, l'agent voit l'identifiant Slack de son interlocuteur au lieu de son nom — le message arrive tout de même |
| `im:write` | ouvrir une conversation directe | — |
| `files:read` | lire une pièce déposée par le client | une capture d'écran reste inaccessible |

`files:write` est accordé sur l'application actuelle mais **n'est pas utilisé** : l'envoi de pièces vers le client est hors périmètre (`HS-REL-003`). À retirer si l'on veut rester au plus juste.

## Jeton d'application et écoute permanente

Le veilleur écoute en **Socket Mode**. Il lui faut, en plus du jeton de robot, un **jeton d'application** portant `connections:write` — c'est lui qui ouvre la connexion (`apps.connections.open`).

## Abonnements aux événements — le point qu'on oublie

| Événement | Sans lui |
|---|---|
| `message.channels` | les messages des canaux **publics** n'arrivent jamais |
| **`message.groups`** | les messages des canaux **privés** n'arrivent jamais |

**`message.groups` est distinct de `message.channels`, et c'est le piège.** Accorder `groups:read` et `groups:history` sans s'abonner à `message.groups` donne à l'application le **droit** de lire les canaux privés sans jamais lui **envoyer** leurs messages : elle est sourde, et elle ne le dit pas. C'est le mode d'échec le plus probable de toute la ligne client.

## Deux choses à savoir avant de toucher à la configuration

1. **Toute modification de portée impose de RÉINSTALLER l'application** dans l'espace de travail. Accorder une portée sans réinstaller ne change rien, et rien ne le signale.
2. **Le manifeste de l'application ne reflète plus ce qui est accordé.** L'application a été créée depuis un manifeste ; `files:read`, `files:write` et les portées `groups:*` ont été ajoutés à la main le 2026-08-06. **Rejouer le manifeste les effacerait sans bruit** — le même piège qu'une migration qui diverge de sa base. Mettre le manifeste à jour avant de le rejouer, jamais l'inverse.

## Le canal commun — parler à tous les agents qui tournent déjà

Une ligne joint **un** agent. Quand une version du pack est publiée, les agents en cours tournent sur celle d'avant et **aucun ne le sait** : il faut aller le leur dire un par un, ou attendre qu'ils meurent. Le canal commun est l'autre moitié — il porte ce qui doit être **pris en compte rapidement** par tout le monde. Ce qui peut attendre la prochaine naissance reste au **feed** du ServiceDesk, que chaque agent relit en naissant ; les deux coexistent et aucun ne couvre le cas seul.

**Il se désigne une fois par poste**, par le dirigeant :

```bash
ligne-directe commun annonces-agents --dirigeant maxime.leboeuf@somtech.ca
```

- Le canal **existe déjà** et notre robot **y a été invité à la main** — on ne le crée pas, on ne le rejoint pas (un robot ne se met pas lui-même dans un canal). La désignation refuse en nommant lequel des deux manque.
- `--dirigeant` est **obligatoire** et se répète. Sans liste, n'importe quel membre de l'espace ferait rafraîchir la configuration de chaque agent du poste. Un nom qui ne se résout pas fait échouer la désignation entière plutôt que d'amputer la liste en silence.
- `ligne-directe etat` rend le canal commun **à côté** des lignes ouvertes, jamais parmi elles.

Ce qu'il fait, et ce qu'il ne fera jamais :

- chaque message y est remis à **tous les agents du poste** — herdr dit lesquels vivent, personne ne s'abonne. Un agent qui n'a **aucune ligne** entend aussi, et un chef d'équipe qui ne vit que deux heures également : il n'y a rien à faire pour entendre ;
- **rien n'y remonte, jamais.** `dire`, `fermer` et `renommer` y sont refusés, aucune ligne ne peut s'y ouvrir, et le veilleur lui-même n'y écrit rien — ni accusé, ni erreur, ni compte rendu. C'est une entorse assumée à la règle « celui qui écrit apprend que son message n'est pas passé » : une réponse ici serait lue par tous les agents à la fois, et **un canal d'urgence qu'on encombre est un canal qu'on cesse de lire** — ce qui coûterait la consigne suivante. Ce qui ne passe pas va au journal du veilleur ;
- **les pièces jointes ne suivent pas** ce canal : une consigne est une phrase. Un message qui n'en porte pas n'est pas diffusé ;
- **la ligne propre de chaque agent est intouchée.** Le canal commun n'entre pas au registre des lignes, donc jamais dans ce que la commande parcourt pour savoir de quelle ligne un agent parle. Il n'est candidat à aucun geste sortant — c'est ce qui empêche une consigne interne de partir dans le canal d'un client.

## Plusieurs lignes sur un même pane — l'appel est nommé

Un agent peut porter **plus d'une ligne** : un gestionnaire client qui parle à son client *et* au dirigeant, un orchestrateur qui a sa ligne *et* d'autres canaux. Le chemin **entrant** l'a toujours su faire — il route par le canal d'origine, une clé unique. Le chemin **sortant**, lui, déduisait la ligne du **pane**, qui n'identifie rien dès qu'il en porte deux : `.find()` rendait la **première inscrite**, et un rapport destiné à un chantier partait dans le canal d'un autre, avec `ok:true` et sans un mot.

Tous les gestes qui écrivent — `dire`, `demander`, `fermer`, `renommer` — acceptent donc **`--a <ligne>`** :

```bash
ligne-directe dire "le devis part demain" --a dirigeant
ligne-directe dire "bonjour, c'est noté"  --a client
ligne-directe fermer --bilan "…" --a dirigeant
```

- **Le nom désigne le DESTINATAIRE, jamais l'émetteur.** Depuis le pane d'un gestionnaire, `--a client` / `--a dirigeant` — *« gestionnaire », c'est lui*, et se nommer soi-même rouvrirait l'ambiguïté qu'on ferme.
- **Le nom est le chantier de la ligne, ou le nom de son canal** — accents, casse et ponctuation aplatis. **Jamais sa nature** : elle tombe juste par coïncidence chez un gestionnaire et se casse chez un orchestrateur, dont toutes les lignes sont `interne`. C'est l'identité qui tranche, jamais le genre.
- **Plus d'une ligne sur le pane et pas de nom → le geste est REFUSÉ**, et rien n'est envoyé. Jamais la première venue : l'incertitude tombe du côté prudent, parce que l'autre côté envoie au client ce qui ne lui était pas destiné. Le refus nomme les lignes du pane.
- **Un nom qui ne désigne aucune ligne du pane est refusé lui aussi**, même s'il n'y en a qu'une — sinon `--a` serait décoratif.
- **Une seule ligne sur le pane n'exige aucun nom.** C'est toute la configuration d'aujourd'hui : rien de ce qui tourne ne change.

Une fois la ligne choisie, la commande la désigne au veilleur **par son canal** — la même clé unique que le chemin entrant, jamais une déduction refaite en aval.

## Un canal privé dont la ligne a disparu du registre

Le registre repart à vide quand il est illisible. Le robot, lui, reste membre du canal privé de son client — qui continue d'écrire dans le vide.

Le veilleur répond donc, **dans le registre de langage client**, à tout message arrivé sur un canal **privé** absent du registre : *« cette conversation n'est suivie par personne en ce moment »*. Sur un canal **public**, il se tait — notre robot figure dans des canaux d'équipe, et y répondre à chaque message en ferait un importun.

La nature du canal est demandée à Slack (`conversations.info`, portées déjà exigées) **une fois par canal**, puis retenue en mémoire.

## Ce que les pièces déposées laissent sur le poste

Une pièce recueillie est écrite dans `~/.somtech/ligne-directe/pieces/<canal>/`, en **0700 pour le dossier, 0600 pour le fichier** : seul le compte du poste peut la lire.

Deux choses à savoir avant d'opérer ce dossier :

1. **Ce sont des données de client, souvent personnelles.** Une capture d'écran en dit beaucoup plus qu'une phrase, et elle est arrivée ici sans relecture humaine. Le dossier se traite comme le trousseau, pas comme un cache.
2. **Rien ne l'efface aujourd'hui.** Le ménage et la rétention sont une dette ouverte (`T-20260806-0138`), pas un oubli : le sujet a été relevé et remis à un lot qui le traitera pour lui-même. En attendant, un opérateur peut vider ce dossier à la main sans rien casser — les pièces qui comptent ont été rattachées à leur demande.

Les adresses de fichiers Slack sont privées : le veilleur présente le jeton du robot pour les rapatrier.

### Ce qui a été mesuré contre l'espace réel, le 2026-08-06

Sonde exécutée sur une vraie capture déposée dans un canal. À ne pas re-dériver :

| Mesure | Résultat |
|---|---|
| L'objet fichier livré par l'événement | **complet** — `name`, `mimetype`, `size`, `mode: hosted`, `file_access: visible`, les deux adresses |
| Téléchargement avec le jeton du robot | `200`, `content-type: image/png`, `content-length` présent, 317 919 octets, aucune redirection, l'hôte reste `files.slack.com` |
| Téléchargement **sans** jeton | `200` **avec du `text/html`** — la page de connexion |
| `files.info` | répond en **formulaire**, refuse un corps JSON avec `invalid_arguments` |

Trois conséquences tenues par le code :

1. **Un `200` ne prouve rien.** La détection du HTML dans une réponse à `200` est ce qui distingue une image d'une page de connexion. C'est le mode d'échec à connaître si des pièces cessent d'arriver après une réinstallation.
2. `content-length` est présent : la taille se contrôle **avant** de rapatrier quoi que ce soit.
3. **L'objet caviardé** (`mode: file_access`, `file_access: check_file_info`) ne se manifeste pas sur notre espace, mais il existe côté Slack. S'il arrivait, l'objet n'aurait ni nom ni type — et le refuser sur cette absence rendrait au client un refus **définitif** de type sur une capture valable. Le veilleur demande donc sa fiche (`files.info`) avant de conclure ; si la fiche ne dit rien de plus, le refus rendu reste **réversible** (« renvoyez-le »), jamais définitif.

## Vérifier plutôt que supposer

Les portées réellement accordées se lisent dans la réponse de `auth.test` (en-tête `x-oauth-scopes`), pas à l'écran de configuration — l'écran montre ce qui est demandé, la réponse montre ce qui est en vigueur. La différence entre les deux, c'est exactement une réinstallation oubliée.

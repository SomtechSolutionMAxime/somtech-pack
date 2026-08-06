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

## Vérifier plutôt que supposer

Les portées réellement accordées se lisent dans la réponse de `auth.test` (en-tête `x-oauth-scopes`), pas à l'écran de configuration — l'écran montre ce qui est demandé, la réponse montre ce qui est en vigueur. La différence entre les deux, c'est exactement une réinstallation oubliée.

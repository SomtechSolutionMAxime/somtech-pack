# Excalidraw Canvas — plugin herdr

Un canvas Excalidraw partagé entre toi et l'agent, pendant une session herdr.

- Tu **dessines à la souris** dans le navigateur.
- L'agent **lit et modifie** le fichier `.herdr/canvas.excalidraw` (JSON Excalidraw, versionnable git).
- Les deux vues restent synchronisées : ce que l'agent écrit apparaît sous tes yeux, ce que tu dessines est lisible par lui.

Le fichier `.excalidraw` est la source de vérité unique des deux côtés.

> **Pourquoi pas dans un pane herdr ?** On a essayé : le pane peut afficher le canvas en image (protocole graphique Kitty), mais **seulement si le terminal hôte sait dessiner** — Ghostty, Kitty ou WezTerm. Ni Terminal.app ni iTerm2 ne le savent, et rien ne permet de le détecter depuis herdr (c'est herdr qui répond « je sais faire », pas l'hôte derrière lui). Le miroir terminal a donc été retiré ; il reste dans l'historique git si le besoin revient.

## Installation

```bash
herdr plugin link herdr-plugins/excalidraw
```

L'étape de build bundle Excalidraw localement — aucun CDN, le plugin fonctionne hors-ligne.

## Utilisation

```bash
herdr plugin action invoke open --plugin somtech.excalidraw
```

Un serveur local démarre et le canvas du projet s'ouvre dans le navigateur.

## Synchronisation

Le dernier écrivain gagne, sans boucle d'écho : le serveur mémorise le hash de ce qu'il écrit, et ignore l'événement du watcher qui en découle. Une écriture de l'agent est poussée au navigateur avec `updateScene()`, qui préserve le zoom et le scroll.

Un fichier `.excalidraw` invalide n'est jamais appliqué : le dessin en cours reste intact et un bandeau te prévient.

L'édition strictement simultanée (les deux à la fois, à la même seconde) n'est pas fusionnée — le plus récent gagne.

## Tests

```bash
npm test
```

Couvre le cœur : anti-boucle d'écho, propagation des écritures externes, rejet du JSON invalide, création du fichier absent, repli de port, et l'encodeur Kitty (découpage en morceaux, `f=100`, dimensionnement en cellules).

## Relire son dessin (obligatoire pour un agent)

Écrire du JSON Excalidraw valide ne prouve **rien** sur le rendu : des formes peuvent se chevaucher, du texte déborder, des flèches pointer à côté. Après avoir dessiné, récupère le rendu et **regarde-le** :

```bash
curl -s -o /tmp/canvas.png http://127.0.0.1:$(cat .herdr/excalidraw.port)/api/preview.png
```

Puis ouvre l'image (outil `Read`). Vérifie que le texte tient dans sa forme, que rien ne se chevauche, que les flèches relient ce qu'elles prétendent relier. Si ce n'est pas lisible ou cohérent : corrige et réexporte. Le rendu est produit par le navigateur (mêmes polices, même trait qu'à l'écran), donc le canvas doit être ouvert dans un onglet.

## Écrire dans le canvas depuis un agent

Le fichier `.herdr/canvas.excalidraw` est du JSON Excalidraw. Un agent peut y ajouter un élément **minimal** — le plugin complète les champs internes manquants :

```json
{ "type": "rectangle", "x": 100, "y": 100, "width": 220, "height": 120, "strokeColor": "#1971c2" }
```

Deux choses à savoir :

- **Les `id` que tu choisis ne sont pas conservés.** Excalidraw régénère l'identifiant d'un élément incomplet. Ne t'appuie pas dessus pour retrouver un élément — repère-le par sa position ou son type.
- **Ne vide jamais le tableau `elements` pour « repartir de zéro »** en comptant sur le navigateur : le serveur refuse (409) une scène vide qui écraserait un canvas non-vide. C'est délibéré — un rechargement de page effaçait le dessin avant ce garde-fou.


## Ce que le plugin refuse de faire

Le canvas est du travail — le code le traite comme tel :

- **Une scène invalide n'est jamais écrite** (400). Un JSON sans `elements` détruirait le canvas *et* rendrait le fichier illisible.
- **Une scène vide n'écrase pas un canvas non-vide** (409), sauf demande explicite. Sans ça, un rechargement de page effaçait le dessin.
- **Un chargement raté désactive la sauvegarde.** Si le canvas n'a pas pu être lu, la page l'affiche vide *et te le dit* — mais elle n'écrira rien : ton premier trait n'écrasera pas un fichier qu'on n'a jamais réussi à lire.
- **Chaque écriture laisse un `canvas.excalidraw.bak`** de l'état précédent.
- **Le serveur refuse les requêtes venues d'un autre site** (origine vérifiée sur les POST *et* sur le WebSocket, `content-type: application/json` exigé). Un serveur local reste joignable par n'importe quelle page web ouverte dans ton navigateur : sans ces contrôles, un site tiers pouvait écraser ton canvas et lire tes schémas en continu.

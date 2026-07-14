# Excalidraw Canvas — plugin herdr

Un canvas Excalidraw partagé entre toi et l'agent, pendant une session herdr.

- Tu **dessines à la souris** dans le navigateur.
- L'agent **lit et modifie** le fichier `.herdr/canvas.excalidraw` (JSON Excalidraw, versionnable git).
- Un **pane herdr affiche le canvas en direct**, rendu en image via le protocole graphique Kitty.

Un pane herdr est un terminal : il ne peut pas héberger le canvas éditable. L'édition vit donc dans le navigateur, la **vue** vit dans le pane. Le fichier `.excalidraw` est la source de vérité unique des deux côtés.

## Installation

```bash
herdr plugin link herdr-plugins/excalidraw
```

L'étape de build bundle Excalidraw localement — aucun CDN, le plugin fonctionne hors-ligne.

## Utilisation

Invoque l'action **« Open Excalidraw canvas »** (ou `Open Excalidraw canvas (tab)` pour un onglet dédié) :

```bash
herdr plugin action invoke --plugin somtech.excalidraw --action open
```

Un serveur local démarre, un onglet navigateur s'ouvre sur le canvas, et le pane miroir apparaît à côté.

## Synchronisation

Le dernier écrivain gagne, sans boucle d'écho : le serveur mémorise le hash de ce qu'il écrit, et ignore l'événement du watcher qui en découle. Une écriture de l'agent est poussée au navigateur avec `updateScene()`, qui préserve le zoom et le scroll.

Un fichier `.excalidraw` invalide n'est jamais appliqué : le pane affiche l'erreur, le dessin en cours reste intact.

L'édition strictement simultanée (les deux à la fois, à la même seconde) n'est pas fusionnée — le plus récent gagne.

## Tests

```bash
npm test
```

Couvre le cœur : anti-boucle d'écho, propagation des écritures externes, rejet du JSON invalide, création du fichier absent, repli de port, et l'encodeur Kitty (découpage en morceaux, `f=100`, dimensionnement en cellules).

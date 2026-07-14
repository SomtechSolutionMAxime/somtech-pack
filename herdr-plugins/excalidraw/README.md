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

## Écrire dans le canvas depuis un agent

Le fichier `.herdr/canvas.excalidraw` est du JSON Excalidraw. Un agent peut y ajouter un élément **minimal** — le plugin complète les champs internes manquants :

```json
{ "type": "rectangle", "x": 100, "y": 100, "width": 220, "height": 120, "strokeColor": "#1971c2" }
```

Deux choses à savoir :

- **Les `id` que tu choisis ne sont pas conservés.** Excalidraw régénère l'identifiant d'un élément incomplet. Ne t'appuie pas dessus pour retrouver un élément — repère-le par sa position ou son type.
- **Ne vide jamais le tableau `elements` pour « repartir de zéro »** en comptant sur le navigateur : le serveur refuse (409) une scène vide qui écraserait un canvas non-vide. C'est délibéré — un rechargement de page effaçait le dessin avant ce garde-fou.

## Pièges herdr rencontrés (pour qui reprendrait ce plugin)

- **`plugin pane open` n'honore pas `--cwd`** : le pane démarre dans le home. Le miroir devant savoir de quel projet il est le miroir, le lanceur ouvre le pane lui-même (`pane split` + `pane run`, chemin absolu). D'où l'absence d'entrée `[[panes]]` dans le manifeste.
- **Ne devine pas le support graphique d'après l'environnement** : dans un pane herdr, `TERM_PROGRAM` vaut encore celui du terminal hôte (`Apple_Terminal`) alors que herdr, lui, sait afficher des images. On interroge le terminal et on attend sa réponse.

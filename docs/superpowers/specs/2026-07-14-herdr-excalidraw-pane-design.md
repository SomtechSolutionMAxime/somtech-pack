# Plugin herdr — canvas Excalidraw vivant dans un pane

- **Date** : 2026-07-14
- **Demande** : D-20260714-0004 (app *Somtech Pack*)
- **Statut** : design validé, prêt pour le plan d'implémentation

## 1. Problème

Pendant une session de travail avec Claude dans herdr, il n'existe aucune surface visuelle partagée. Les schémas se discutent en texte, ce qui est lent et imprécis pour tout ce qui est architecture, flux de données ou parcours utilisateur.

On veut un **canvas Excalidraw vivant**, partagé entre l'humain et l'agent, dont l'état est visible **dans un pane herdr** sans quitter le terminal.

## 2. Contraintes structurantes

Un pane herdr est un **terminal**, pas une webview : il ne peut pas héberger un canvas éditable à la souris. En revanche, le terminal de herdr **supporte le protocole graphique Kitty** (vérifié dans le binaire : `kitty_gfx`, encodage PNG, placements virtuels), donc il peut afficher de **vraies images**, pas de l'ASCII art.

herdr expose un système de plugins réel — manifeste `herdr-plugin.toml` avec des sections `[[panes]]`, `[[actions]]` et `[[build]]`, installable en local via `herdr plugin link` (vérifié sur les deux plugins déjà installés : `herdr-file-viewer`, `ray.file-explorer`).

Il en découle la découpe fondamentale : **l'édition vit dans le navigateur, la vue vit dans le pane.**

## 3. Architecture

Trois composants autour d'un seul état partagé.

**Le fichier `.excalidraw`** (par défaut `.herdr/canvas.excalidraw`, ou un chemin passé en argument) est la **source de vérité unique**. C'est du JSON Excalidraw standard, versionnable dans git, lisible et modifiable par Claude avec les outils d'édition habituels.

**Le serveur** (Node, démarré par le plugin) sert la page Excalidraw locale, expose un WebSocket, et surveille le fichier. Il ne connaît rien du terminal.

**Le pane** (process Node lancé par herdr) se connecte au WebSocket, reçoit le PNG du canvas et le dessine dans le terminal via le protocole graphique Kitty. Il ne connaît rien d'Excalidraw.

Flux de données :

```
   navigateur (Excalidraw)                serveur                    pane herdr
        │  dessin utilisateur               │                             │
        ├── POST /scene (débounce 400ms) ──▶│── écrit canvas.excalidraw   │
        ├── POST /preview (PNG) ───────────▶│── diffuse le PNG ──────────▶│ rend l'image
        │                                   │                             │
        │                        Claude écrit le fichier                  │
        │◀── WS scene:update ───────────────┤◀── watcher (chokidar)       │
        │  recharge la scène (zoom conservé)│                             │
        └── ré-exporte le PNG ─────────────▶│───────────────────────────▶│ rend l'image
```

## 4. Synchro et conflits

Règle unique : **le dernier écrivain gagne, sans boucle d'écho.**

Chaque écriture du fichier par le serveur mémorise le hash SHA-256 du contenu écrit. Quand le watcher se déclenche, le serveur compare le hash du fichier lu à celui qu'il vient d'écrire : s'il correspond, l'événement est **ignoré** (c'est notre propre écriture). Sans ce garde-fou, une sauvegarde navigateur provoquerait un rechargement du navigateur, qui provoquerait une nouvelle sauvegarde, à l'infini.

Le rechargement côté navigateur utilise `updateScene()` de l'API Excalidraw, qui remplace les éléments **sans réinitialiser la vue** : le zoom et le scroll de l'utilisateur sont préservés.

Si le fichier écrit par Claude n'est pas un JSON Excalidraw valide, le serveur **ne diffuse rien** et publie une erreur au pane. Le dessin en cours dans le navigateur n'est jamais détruit par une écriture invalide.

**Hors-scope assumé (v1)** : l'édition strictement simultanée (l'humain dessine pendant que Claude écrit). Le plus récent gagne, il n'y a pas de fusion d'éléments. C'est acceptable : en pratique on alterne, on ne dessine pas à quatre mains.

## 5. Composants et interfaces

Chaque unité est utilisable et testable seule.

### `server/` — Node, sans dépendance au terminal

| Endpoint | Rôle |
|---|---|
| `GET /` | sert la page Excalidraw (statique, bundlée) |
| `GET /api/scene` | renvoie la scène courante lue depuis le fichier |
| `POST /api/scene` | reçoit la scène du navigateur, écrit le fichier (hash mémorisé) |
| `POST /api/preview` | reçoit le PNG exporté par le navigateur, le diffuse aux panes |
| `WS /ws` | pousse `scene:update`, `preview:update`, `error` |

Le serveur choisit un port libre (à partir de 4870) et l'écrit dans `.herdr/excalidraw.port` pour que le pane et les actions le retrouvent.

### `web/` — page Excalidraw

Monte `@excalidraw/excalidraw` (bundlé localement avec Vite — **aucun CDN**, le plugin doit marcher hors-ligne). Charge la scène initiale via `GET /api/scene`. À chaque changement : débounce 400 ms, puis sauvegarde la scène et exporte un PNG (`exportToBlob`, fond opaque, `exportScale: 2`) qu'elle poste au serveur. Sur `scene:update` reçu du WS, applique `updateScene()`.

### `pane/` — miroir terminal

Process Node : lit le port, se connecte au WS, et à chaque `preview:update` efface l'image précédente et transmet le PNG au terminal via les séquences Kitty (`APC _G a=T,f=100,...`, payload base64 découpé en morceaux de 4096 octets). Le dimensionnement se fait en cellules (`c=`/`r=`) à partir de `process.stdout.columns/rows`, recalculé sur `SIGWINCH`. **Aucune dépendance externe** — pas de `kitten icat`, pas de `chafa` : on émet les octets nous-mêmes.

### `herdr-plugin.toml`

Un `[[panes]]` (`id = "canvas"`, `placement = "split"`), deux `[[actions]]` (ouvrir en split / ouvrir en tab) qui démarrent le serveur si besoin, ouvrent le navigateur, puis ouvrent le pane. Un `[[build]]` (`npm ci && npm run build`). Plateformes : macOS et Linux.

## 6. Erreurs et cas limites

| Situation | Comportement |
|---|---|
| Port occupé | le serveur incrémente jusqu'à trouver un port libre et le publie dans `.herdr/excalidraw.port` |
| Fichier cible absent | créé avec une scène Excalidraw vide, pas d'erreur |
| Fichier `.excalidraw` invalide | rien n'est diffusé ; le pane affiche l'erreur ; le navigateur garde son état |
| Aucun navigateur connecté | le pane affiche le dernier PNG connu + la mention « déconnecté » |
| Terminal sans protocole graphique | message clair (chemin du fichier + URL du canvas), aucun crash |
| Serveur déjà démarré | l'action se rattache à l'instance existante (pas de second serveur) |

## 7. Tests

Le cœur testable est le serveur. Tests écrits **rouges d'abord** :

1. `POST /api/scene` écrit bien le fichier sur disque.
2. **Anti-écho** : une sauvegarde via `POST /api/scene` ne doit **pas** produire de `scene:update` sur le WS (sinon boucle infinie).
3. Une écriture *externe* du fichier (simulant Claude) **doit** produire un `scene:update`.
4. Un JSON invalide écrit sur le fichier ne produit **aucun** `scene:update` et produit un `error`.
5. Fichier absent au démarrage → créé avec une scène vide valide.
6. Port occupé → le serveur en prend un autre et le publie.

L'encodeur Kitty du pane est testé sur sa **sortie d'octets** (préfixe `\x1b_G`, `f=100`, chunks ≤ 4096, terminateur), sans terminal réel.

La page navigateur n'est pas testée automatiquement : c'est du canvas, mocker n'apporterait aucune garantie. Elle est validée à la main sur le scénario de bout en bout.

## 8. Validation de bout en bout (critère d'acceptation)

1. `herdr plugin link herdr-plugins/excalidraw` puis invocation de l'action → un onglet Excalidraw s'ouvre, un pane miroir apparaît.
2. Je dessine un rectangle dans le navigateur → il apparaît dans le pane en moins d'une seconde, et `.herdr/canvas.excalidraw` contient l'élément.
3. Claude ajoute un élément dans le fichier → il apparaît dans le navigateur **et** dans le pane, sans que le zoom de l'utilisateur ne saute.
4. Aucune boucle de rafraîchissement observable (le fichier n'est pas réécrit en continu).

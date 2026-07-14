# /canvas — Canvas Excalidraw partagé (humain ↔ agent)

Ouvre un canvas Excalidraw **nommé** pour le projet courant, dans le navigateur. Maxime dessine à la souris ; toi tu lis et modifies le même fichier. Les deux vues restent synchronisées.

Usage :
- `/canvas <nom>` — ouvre `docs/diagrams/<nom>.excalidraw` (le crée s'il n'existe pas)
- `/canvas <nom> <ce qu'il faut dessiner>` — ouvre et dessine

**Chaque canvas est un fichier distinct, versionné dans `docs/diagrams/`.** Ouvrir un second schéma n'écrase jamais le premier (chacun a son propre serveur). Si Maxime ne donne pas de nom, en proposer un tiré du sujet (`architecture`, `flux-auth`, `modele-donnees`) plutôt que d'écraser un canvas existant — et le lui dire.

## Étape 1 — Localiser le plugin

Le serveur du canvas vit dans le plugin `somtech.excalidraw`. Le chercher dans cet ordre, prendre le premier qui existe :

```bash
herdr plugin list --json 2>/dev/null \
  | python3 -c 'import sys,json;print(next(p["plugin_root"] for p in json.load(sys.stdin)["result"]["plugins"] if p["plugin_id"]=="somtech.excalidraw"))' 2>/dev/null \
  || ls -d ./herdr-plugins/excalidraw 2>/dev/null \
  || ls -d ~/.claude/herdr-plugins/excalidraw 2>/dev/null
```

Si rien n'est trouvé : dire à Maxime que le plugin n'est pas installé et proposer `herdr plugin link herdr-plugins/excalidraw` depuis somtech-pack. **Ne pas improviser un autre canvas.**

## Étape 2 — Démarrer le canvas

```bash
bash "$PLUGIN_ROOT/scripts/open.sh" <nom>
```

Le script est idempotent : il se rattache au serveur déjà en route pour ce canvas, ouvre le navigateur, et affiche l'URL. Le port est dans `.herdr/excalidraw-<nom>.port`.

## Étape 3 — Dessiner (si Maxime a demandé quelque chose)

Écrire les éléments dans `docs/diagrams/<nom>.excalidraw`. Le format accepte des éléments **minimaux** — les champs internes sont complétés automatiquement :

```json
{ "type": "rectangle", "x": 100, "y": 100, "width": 240, "height": 90, "strokeColor": "#1971c2" }
```

Types utiles : `rectangle`, `ellipse`, `diamond`, `text` (avec `text` et `fontSize`), `arrow` (avec `points`, et `startArrowhead`/`endArrowhead` pour un lien bidirectionnel).

Ne jamais vider `elements` pour « repartir de zéro » : le serveur refuse (409) une scène vide qui écraserait un canvas non-vide, et c'est voulu.

## Étape 4 — RELIRE LE RENDU (obligatoire)

**Un JSON valide ne prouve rien sur le dessin.** Récupérer le rendu et le regarder :

```bash
curl -s -o /tmp/canvas.png "http://127.0.0.1:$(cat .herdr/excalidraw-<nom>.port)/api/preview.png"
```

Puis l'ouvrir avec l'outil `Read` (il affiche l'image) et vérifier :

- le texte tient dans sa forme et n'est pas tronqué ;
- rien ne se chevauche ni ne sort du cadre ;
- les flèches relient bien ce qu'elles prétendent relier, dans le bon sens (bidirectionnel = `startArrowhead` **et** `endArrowhead`) ;
- l'ensemble se lit sans effort.

Si ce n'est pas lisible ou cohérent → corriger le fichier et réexporter, jusqu'à ce que ça le soit. **Ne jamais annoncer un schéma « fait » sur la foi du JSON seul.**

Le rendu est produit par le navigateur : le canvas doit être ouvert dans un onglet. Si `/api/preview.png` répond 404, c'est qu'aucun onglet n'est ouvert — le dire plutôt que de conclure à l'aveugle.

## Étape 5 — Rendre compte

Dire à Maxime ce qui a été dessiné, dans quel canvas, et l'URL. Le fichier vit dans `docs/diagrams/` : proposer de le commiter s'il a valeur de documentation.

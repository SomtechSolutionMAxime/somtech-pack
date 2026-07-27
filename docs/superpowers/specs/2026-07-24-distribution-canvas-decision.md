# Décision — comment le canvas voyage jusqu'au poste et aux projets

**Date** : 2026-07-24 · **Story** : T-20260724-0018 (spike, 0,5 j) · **Epic** : E-20260724-0005 · **Demande** : D-20260724-0014
**Réalisé par** : EF-DIS-004 · **Statut** : décision prise, à appliquer par T-20260724-0019 et suivantes

---

## Question posée

Le serveur du canvas (`herdr-plugins/excalidraw/`) n'est déclaré dans aucun module du pack : il n'est ni embarqué au paquet publié, ni installé. Deux voies restaient ouvertes pour l'y faire entrer :

- **A — embarquer la page déjà construite** dans le paquet publié ;
- **B — construire la page au moment de l'installation**, chez celui qui installe.

Il fallait aussi trancher le sort des **dépendances d'exécution du serveur**, distinctes de celles de la page.

## Mesures (poste macOS, cache npm chaud)

| Élément | Brut | Compressé |
|---|---:|---:|
| Sources du plugin (ce qui est versionné aujourd'hui) | 288 Ko | 70 Ko |
| **Page construite** (`web/dist`) | **8,0 Mo** | **2,6 Mo** |
| **Dépendances d'exécution du serveur** (`chokidar`, `ws`) | 424 Ko | ~0,1 Mo |
| Dépendances de construction de la page (`web/node_modules`) | **273 Mo** | — (jetables) |
| Paquet publié actuel, tous modules confondus | 6,5 Mo | — |

Temps de construction complet, **cache npm chaud** : **8,2 s** (0,2 s dépendances du serveur + 2 s dépendances de la page + 4,6 s construction Vite). À froid, il faut d'abord télécharger 273 Mo : l'ordre de grandeur passe à la minute ou plus, selon le réseau.

Les deux fichiers de verrouillage (`package-lock.json` du plugin et de la page) sont versionnés : une construction déterministe est possible, à condition d'utiliser `npm ci` et non `npm install`.

## Décision

### 1. Voie retenue : A — la page construite est embarquée dans le paquet publié

**Pourquoi** — La voie B ferait payer à chaque poste 273 Mo de dépendances de construction et une minute d'attente, pour reconstruire à l'identique un artefact que la chaîne d'intégration peut produire **une fois**. Elle transforme une installation en compilation, et rend l'installation dépendante de la disponibilité du registre npm et de la version de Node du poste. Le coût de la voie A — **+2,6 Mo compressés** sur un paquet qui en fait 6,5 Mo brut — est un prix acceptable pour une installation qui marche du premier coup, hors ligne, et à l'identique partout.

**Ce qui reste à surveiller** — 8 Mo bruts pour une page de dessin, c'est beaucoup : la moitié vient de dépendances de rendu de diagrammes embarquées par Excalidraw (mermaid, katex, cytoscape). Réduire cette charge est une amélioration légitime, **hors périmètre de cette demande** ; à ouvrir comme dette si le poids devient gênant.

### 2. Les dépendances d'exécution du serveur sont embarquées elles aussi

Le serveur a besoin de deux paquets (`chokidar`, `ws`) pour fonctionner : **~0,1 Mo compressés**. Les embarquer coûte presque rien et évite un second `npm install` au moment de l'installation — sans quoi la voie A ne tiendrait pas sa promesse (« ça marche du premier coup »). Elles sont donc traitées comme la page construite : produites par la chaîne d'intégration, embarquées dans le paquet.

**Rien n'est installé par npm au moment où l'utilisateur met en place le canvas.**

### 3. Le canvas s'installe **au poste**, pas dans chaque projet — écart au découpage initial

C'est la trouvaille du spike, et elle **modifie une story déjà créée**.

Le découpage prévoyait que l'installation du pack dans un projet y dépose le canvas (T-20260724-0020). Les mesures rendent ce choix mauvais : cela copierait **8 Mo dans chaque dépôt client**, pour un outil de développement interne qui n'a rien à faire dans le livrable d'un client. Multiplié par une vingtaine d'applications, c'est 160 Mo de duplication d'un outil dont une seule copie suffit.

**Ce qui va où** :

| Élément | Destination | Pourquoi |
|---|---|---|
| La commande `/canvas` | Le projet (module `core`, déjà le cas) | C'est de la configuration d'agent, elle appartient au projet |
| Le serveur du canvas + sa page construite | **Le poste uniquement** (`~/.somtech/herdr-plugins/excalidraw`, avec les autres outils de poste du pack) | C'est un outil, une copie par poste suffit ; `~/.claude` est la configuration de Claude Code, pas un dépôt de binaires |
| Les schémas (`docs/diagrams/*.excalidraw`) | Le projet | Ce sont des données du projet, pas l'outil |

**Comment le faire proprement** — déclarer un module `canvas` dans `pack.json` avec `default: false` et le chemin `herdr-plugins/`. La construction du paquet embarque **tous** les modules déclarés, quel que soit leur défaut : le canvas entre donc au paquet (EF-DIS-003 satisfait) sans être copié dans les projets. La configuration du poste l'installe ensuite depuis le paquet.

### 4. Ce qui entre dans le paquet, et ce qui n'y entre pas

**Inclus** : les sources du serveur (`server/`), les scripts (`scripts/`), le manifeste du plugin (`herdr-plugin.toml`), les fichiers de verrouillage, la page construite (`web/dist/`), les dépendances d'exécution du serveur (`node_modules/` du plugin, sans les dépendances de développement).

**Exclus nommément** :

- `web/node_modules/` — dépendances de construction, 273 Mo, sans usage après la construction ;
- `web/src/`, `web/vite.config.js` — sources de la page, inutiles une fois la page construite ;
- `.herdr/` — état d'exécution : fichiers de port (`excalidraw-*.port`), journaux (`*.log`), copies de secours (`*.bak`) ;
- `herdr-plugins/excalidraw/.herdr/canvas.excalidraw` — **versionné par erreur** dans le dépôt aujourd'hui, à retirer ;
- `tests/` — utiles à la chaîne d'intégration, pas au poste qui installe.

## Conséquences sur les stories

| Story | Conséquence |
|---|---|
| T-20260724-0019 — le paquet publié embarque le canvas | **Inchangée.** La liste d'inclusion et d'exclusion ci-dessus est celle qu'attendait son critère. |
| T-20260724-0020 — installer ou mettre à jour un projet y dépose un canvas | **À reformuler.** Le canvas ne va plus dans les projets. Ce qui doit être vrai : après installation du pack dans un projet, `/canvas` y fonctionne **dès lors que le poste est configuré**, et le dit clairement sinon (ce que couvre déjà T-20260724-0023). |
| T-20260724-0022 — le poste installe aussi le serveur du canvas | **Devient la story centrale** de la mise à disposition, et non plus un complément. |
| T-20260724-0024 — plage de ports | **Inchangée.** |

## Reproductibilité — un point à corriger en passant

Le script de construction du plugin utilise `npm install`, alors que le script `build` déclaré dans son manifeste utilise `npm ci`. Seul `npm ci` respecte le fichier de verrouillage. Pour que la page embarquée soit identique d'une construction à l'autre — condition de RA-DIS-002 —, la chaîne d'intégration doit utiliser `npm ci` dans les deux cas.

# Design — Graphe NetworkX du BRD (mode `project --mode graph`)

> Extension de D-20260710-0009 (accès BRD calculé à la demande). Objectif : à la récupération d'un BRD,
> produire un **graphe de connaissances** que les agents Orbit chargent dans NetworkX pour **raisonner**
> (RAG) **et amender** les exigences. Calculé à la demande, jamais stocké (zéro drift — cohérent avec index/full).

## 1. But

Le BRD a une structure de graphe naturelle (traçabilité EF→EA, contrainte RA→EF, regroupement par domaine).
On l'expose comme graphe pour qu'un agent Orbit :
- **raisonne** dessus (« quelles exigences du domaine TIC ? », « quel enjeu sert EF-X ? », « quelles règles contraignent EF-Y ? ») ;
- **amende** une exigence : le nœud porte son `md_block_id`, donc l'agent va de `nœud → md_block_id → /brd edit` (écriture ciblée `update_block`) sans re-parser.

## 2. Déclencheur & flux

Nouveau mode de la commande existante :

```
somtech-pack brd project --mode graph [--file <BRD.md>]
```

Même flux que `index`/`full` : l'appelant fait `read_document(brd_document_id, include_block_ids=true)` → pipe le MD → le CLI sort le graphe. Pas de nouveau câblage (résolution app, lecture fichier/stdin déjà dans `project`). Calculé à la demande, **jamais stocké**.

## 3. Sortie : JSON node-link (natif NetworkX)

Le CLI émet le format **node-link** que NetworkX consomme directement via `nx.node_link_graph(data)`. Compact (comme `index`). Forme :

```json
{
  "directed": true,
  "multigraph": false,
  "graph": { "source": "brd", "domaines": ["TIC", "GOV", ...] },
  "nodes": [ { "id": "EF-TIC-001", "kind": "ef", ...tous les champs full..., "md_block_id": "eed419d7-..." }, ... ],
  "links": [ { "source": "EF-TIC-001", "target": "EA-GBL-001", "rel": "couvre" }, ... ]
}
```

- Clé `links` (défaut node-link). Le loader Python passe `edges="links"` (forward-compat NetworkX ≥ 3.x où le défaut migre).
- `directed: true`, `multigraph: false`.

## 4. Modèle du graphe (dirigé)

### Nœuds — deux types
- **Nœud exigence** (un par EA/EF/RA/HS) : `id` = l'id de l'exigence (`EF-TIC-001`). Attributs = **tous les champs de la projection `full`** : `kind` (`ea|ef|ra|hs`), `titre`, le corps (`description`/`enonce`/`justification` selon le type), `statut`, `priorite` (EA/EF), `domaine` (EF/RA/HS), `couvre`/`encadre`, `realise_par`/`teste_par`/`owner`, et **`md_block_id`** (ancre d'écriture). → l'agent a le contenu ET le moyen d'amender dans le nœud, sans re-fetch.
- **Nœud domaine** (un par code de domaine rencontré) : `id` = `domaine:TIC`, attributs `kind: "domaine"`, `code: "TIC"`.

### Arêtes — dirigées, attribut `rel`
- `EF —couvre→ EA` : une arête par id de la liste `couvre` de chaque EF (traçabilité « réalise l'enjeu »).
- `RA —encadre→ EF` : une arête par id de la liste `encadre` de chaque RA (contrainte).
- `{EF, RA, HS} —appartient→ domaine:<code>` : rattachement au nœud domaine.
- **EA = globales** : les EA n'ont pas de `domaine` dans le parseur (leur segment central `GBL` est nominal). → **pas d'arête `appartient`** pour les EA. Documenté.

### Cas limites
- Une arête `couvre`/`encadre` vers un id **absent** du BRD (référence cassée) : **on n'émet PAS d'arête** (sinon `nx.node_link_graph` créerait un nœud fantôme sans attributs qui polluerait le graphe). La référence cassée est plutôt listée dans `graph.dangling_refs` (métadonnée du graphe) : `[{ "from": "EF-TIC-009", "rel": "couvre", "missing": "EA-GBL-999" }]`. L'agent/la validation la voit sans nœud parasite. (Le parseur ne valide pas la symétrie cross-références — cf. STD-033, c'est le rôle du validateur ; ici on la **surface** sans planter.)
- HS : nœud + seule arête `appartient` (pas de couvre/encadre).

## 5. Loader Python (agents Orbit)

Petit module Python (emplacement : `aims/` — côté agents ; structure exacte confirmée au plan) :

```python
import json
import networkx as nx

def load_brd_graph(data) -> nx.DiGraph:
    """Charge la sortie de `brd project --mode graph` en DiGraph NetworkX."""
    obj = json.loads(data) if isinstance(data, str) else data
    return nx.node_link_graph(obj, directed=True, multigraph=False, edges="links")

# Requêtes de commodité (YAGNI : on se limite à 3)
def enjeux_orphelins(g):        # EA qu'aucune EF ne couvre
def exigences_du_domaine(g, code):
def enjeux_servis_par(g, ef_id):  # EA couvertes par une EF
```

L'agent : `g = load_brd_graph(sortie_cli)` → parcourt / interroge → pour amender, lit `g.nodes[ef_id]["md_block_id"]` et appelle `/brd edit`.

## 6. Tests

- **TS** (job `cli-tests`, zéro dépendance) : sur le BRD ServiceDesk réel (fixture) — comptes attendus (nœuds = exigences + domaines ; arêtes = |couvre| + |encadre| + |appartient|), présence de `md_block_id` sur chaque nœud exigence, `directed/multigraph` corrects, JSON parseable ; **test de mutation** (retirer une arête couvre → le compte change / une requête casse).
- **Python** : `pytest` léger du loader (le JSON se charge en DiGraph, comptes nœuds/arêtes cohérents, `md_block_id` accessible) + **nouveau job CI `python-tests`** qui `pip install networkx pytest` (le CI actuel est Node-only).

## 7. Portée / YAGNI

- **Inclus** : mode `graph`, node-link JSON, modèle enrichi (exigences + domaines), loader Python + 3 requêtes.
- **Exclu** : visualisation/image, nœud racine app + multi-BRD agrégé (écarté), stockage/cache du graphe, requêtes avancées au-delà des 3.

## 8. Traçabilité

App « Somtech Pack » sans BRD → EF N/A (règle d'or n°10). Cadre : extension de D-20260710-0009. Gouvernance ServiceDesk (epic/story) créée à l'étape writing-plans / plan-servicedesk.

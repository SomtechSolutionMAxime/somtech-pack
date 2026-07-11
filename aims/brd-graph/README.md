# brd-graph — loader NetworkX du graphe BRD

Charge la projection graphe du BRD (`somtech-pack brd project --mode graph`, JSON node-link) dans un
`networkx.DiGraph`, pour que les agents (Orbit, analystes Python) **raisonnent** sur le BRD et **amendent**
les exigences (chaque nœud porte son `md_block_id` → `/brd edit` réécrit uniquement ce bloc).

**Une seule source de vérité** : le parseur TS du CLI `@somtech-solutions/pack`. Ce module ne parse rien —
il charge le graphe déjà calculé (le format node-link est le contrat universel).

## Usage

```python
from brd_graph import load_brd_graph, enjeux_orphelins, exigences_du_domaine, enjeux_servis_par

# sortie_cli = stdout de `somtech-pack brd project --mode graph` (str JSON ou dict)
g = load_brd_graph(sortie_cli)

enjeux_orphelins(g)                  # EA qu'aucune EF ne couvre
exigences_du_domaine(g, "TIC")       # EF/RA/HS du domaine TIC
enjeux_servis_par(g, "EF-TIC-001")   # EA couvertes par cette EF

# amendement ciblé : récupérer l'ancre puis appeler /brd edit
block_id = g.nodes["EF-TIC-001"]["md_block_id"]
```

## Modèle du graphe (dirigé)

- **Nœuds exigence** — id = l'id (`EF-TIC-001`), attributs = tous les champs `full` + `kind` (`ea|ef|ra|hs`) + `md_block_id`.
- **Nœuds domaine** — id = `domaine:<CODE>`, `kind="domaine"`.
- **Arêtes** (`rel`) : `couvre` (EF→EA) · `encadre` (RA→EF) · `appartient` ({EF,RA,HS}→domaine). Les EA sont globales (pas d'`appartient`).
- Réfs `couvre`/`encadre` cassées : dans `graph["dangling_refs"]` (pas de nœud fantôme).

## Tests

```bash
pip install networkx pytest
pytest aims/brd-graph -q
```

Requiert `networkx` (le loader gère `edges="links"` ≥ 3.4 et `link="links"` < 3.4). Exécuté en CI par le job `python-tests`.

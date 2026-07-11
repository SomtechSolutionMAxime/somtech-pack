"""Loader NetworkX pour la projection graphe du BRD.

Charge la sortie de `somtech-pack brd project --mode graph` (JSON node-link) en `networkx.DiGraph`,
et fournit trois requêtes de commodité pour les agents Orbit (raisonnement RAG + amendement ciblé :
un nœud porte son ``md_block_id`` → ``/brd edit`` réécrit uniquement ce bloc).

Une seule source de vérité : le parseur TS du CLI (`@somtech-solutions/pack`). Ce module ne parse RIEN —
il charge le graphe déjà calculé. Cadre : D-20260710-0009 (Epic F).

Usage :

    from brd_graph import load_brd_graph, enjeux_orphelins, exigences_du_domaine, enjeux_servis_par

    g = load_brd_graph(sortie_cli)            # str JSON ou dict node-link
    enjeux_orphelins(g)                       # EA qu'aucune EF ne couvre
    exigences_du_domaine(g, "TIC")            # EF/RA/HS du domaine TIC
    enjeux_servis_par(g, "EF-TIC-001")        # EA couvertes par cette EF
    g.nodes["EF-TIC-001"]["md_block_id"]      # ancre d'écriture pour /brd edit
"""

import json

import networkx as nx


def load_brd_graph(data):
    """Charge la sortie de ``brd project --mode graph`` en ``networkx.DiGraph``.

    Args:
        data: chaîne JSON OU dict node-link.

    Returns:
        networkx.DiGraph
    """
    obj = json.loads(data) if isinstance(data, str) else data
    try:
        # NetworkX >= 3.4 : le paramètre s'appelle ``edges``.
        return nx.node_link_graph(obj, directed=True, multigraph=False, edges="links")
    except TypeError:
        # NetworkX < 3.4 : le paramètre s'appelait ``link``.
        return nx.node_link_graph(obj, directed=True, multigraph=False, link="links")


def enjeux_orphelins(g):
    """EA qu'aucune EF ne couvre (aucune arête ``couvre`` entrante). Retour trié."""
    ea = [n for n, d in g.nodes(data=True) if d.get("kind") == "ea"]
    couverts = {v for _, v, d in g.edges(data=True) if d.get("rel") == "couvre"}
    return sorted(n for n in ea if n not in couverts)


def exigences_du_domaine(g, code):
    """Ids des exigences (EF/RA/HS) rattachées au domaine ``code``. Retour trié."""
    dom = "domaine:%s" % code
    return sorted(u for u, v, d in g.edges(data=True) if d.get("rel") == "appartient" and v == dom)


def enjeux_servis_par(g, ef_id):
    """EA couvertes par l'EF ``ef_id`` (arêtes ``couvre`` sortantes). Retour trié."""
    return sorted(v for _, v, d in g.out_edges(ef_id, data=True) if d.get("rel") == "couvre")

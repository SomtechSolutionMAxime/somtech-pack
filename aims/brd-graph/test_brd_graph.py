"""Tests du loader NetworkX du graphe BRD (Epic F / G2, D-20260710-0009)."""

import json
import os

import networkx as nx
import pytest

from brd_graph import (
    enjeux_orphelins,
    enjeux_servis_par,
    exigences_du_domaine,
    load_brd_graph,
)

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def _fixture(name):
    with open(os.path.join(FIX, name), encoding="utf-8") as fh:
        return fh.read()


def test_charge_en_digraph():
    g = load_brd_graph(_fixture("two-domains.graph.json"))
    assert isinstance(g, nx.DiGraph)
    assert g.is_directed()
    # 1 EA + 2 EF + 2 RA + 1 HS + 2 domaines = 8 nœuds ; 2 couvre + 2 encadre + 5 appartient = 9 arêtes
    assert g.number_of_nodes() == 8
    assert g.number_of_edges() == 9


def test_accepte_str_et_dict():
    s = _fixture("two-domains.graph.json")
    g_str = load_brd_graph(s)
    g_dict = load_brd_graph(json.loads(s))
    assert g_str.number_of_nodes() == g_dict.number_of_nodes()


def test_md_block_id_accessible_sur_un_noeud():
    g = load_brd_graph(_fixture("with-bids.graph.json"))
    assert g.nodes["EF-CLI-001"]["md_block_id"] == "t-cli-ef"
    assert g.nodes["EF-CLI-001"]["kind"] == "ef"


def test_enjeux_servis_par():
    g = load_brd_graph(_fixture("two-domains.graph.json"))
    assert enjeux_servis_par(g, "EF-CLI-001") == ["EA-GBL-001"]
    assert enjeux_servis_par(g, "EF-FAC-001") == ["EA-GBL-001"]


def test_exigences_du_domaine():
    g = load_brd_graph(_fixture("two-domains.graph.json"))
    assert exigences_du_domaine(g, "CLI") == ["EF-CLI-001", "RA-CLI-001"]
    assert exigences_du_domaine(g, "FAC") == ["EF-FAC-001", "HS-FAC-001", "RA-FAC-001"]


def test_enjeux_orphelins():
    # two-domains : EA-GBL-001 est couverte par 2 EF → aucun orphelin.
    g = load_brd_graph(_fixture("two-domains.graph.json"))
    assert enjeux_orphelins(g) == []
    # mutation : on retire les arêtes 'couvre' → l'EA devient orpheline (le test attrape un vrai bug).
    g.remove_edges_from([(u, v) for u, v, d in list(g.edges(data=True)) if d.get("rel") == "couvre"])
    assert enjeux_orphelins(g) == ["EA-GBL-001"]


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))

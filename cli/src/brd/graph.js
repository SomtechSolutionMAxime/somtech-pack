// graph.js — Projection GRAPHE du BRD au format node-link (natif NetworkX), calculée à la demande.
// Alimente les agents Orbit : raisonnement (RAG) + amendement ciblé (chaque nœud porte son md_block_id →
// nœud → /brd edit). Jamais stocké. Une seule source de vérité : le parseur TS (parser.js).
//
// Sortie = objet node-link que NetworkX charge via nx.node_link_graph(obj, edges="links") :
//   { directed, multigraph, graph:{source, domaines, dangling_refs}, nodes:[{id, kind, ...}], links:[{source,target,rel}] }
//
// Modèle (dirigé) :
//   - Nœuds exigence : tous les champs de la projection full + kind (ea|ef|ra|hs) + md_block_id.
//   - Nœuds domaine  : id = "domaine:<CODE>", kind="domaine", code.
//   - Arêtes : EF —couvre→ EA · RA —encadre→ EF · {EF,RA,HS} —appartient→ domaine.
//   - EA = globales (pas d'arête appartient). Réfs couvre/encadre cassées → graph.dangling_refs (pas de nœud fantôme).

import { parseBrd } from './parser.js';

/**
 * Construit le graphe node-link du BRD.
 * @param {string} mdText
 * @returns {{directed: boolean, multigraph: boolean, graph: object, nodes: object[], links: object[]}}
 */
export function buildGraph(mdText) {
  const p = parseBrd(mdText);
  const { ea, ef, ra } = p.requirements;
  const hs = p.out_of_scope;

  // Ensemble des ids d'exigences existants (pour détecter les références cassées).
  const known = new Set([...ea, ...ef, ...ra, ...hs].map((r) => r.id));

  const nodes = [];
  const links = [];
  const danglingRefs = [];
  const domaines = new Set();

  const addReqNode = (r, kind) => nodes.push({ ...r, kind });
  ea.forEach((r) => addReqNode(r, 'ea'));
  ef.forEach((r) => addReqNode(r, 'ef'));
  ra.forEach((r) => addReqNode(r, 'ra'));
  hs.forEach((r) => addReqNode(r, 'hs'));

  // Arêtes de traçabilité (couvre / encadre) — réf cassée → dangling_refs, pas d'arête ni de nœud fantôme.
  const addRefEdges = (rows, listKey, rel) => {
    for (const r of rows) {
      for (const target of r[listKey] ?? []) {
        if (known.has(target)) links.push({ source: r.id, target, rel });
        else danglingRefs.push({ from: r.id, rel, missing: target });
      }
    }
  };
  addRefEdges(ef, 'couvre', 'couvre');
  addRefEdges(ra, 'encadre', 'encadre');

  // Arêtes d'appartenance au domaine (EF/RA/HS ont un domaine ; EA sont globales).
  const addDomainEdge = (rows) => {
    for (const r of rows) {
      if (!r.domaine) continue;
      domaines.add(r.domaine);
      links.push({ source: r.id, target: `domaine:${r.domaine}`, rel: 'appartient' });
    }
  };
  addDomainEdge(ef);
  addDomainEdge(ra);
  addDomainEdge(hs);

  // Nœuds domaine (après collecte, pour n'en créer qu'un par code réellement présent).
  for (const code of domaines) {
    nodes.push({ id: `domaine:${code}`, kind: 'domaine', code });
  }

  return {
    directed: true,
    multigraph: false,
    graph: {
      source: 'brd',
      domaines: [...domaines].sort(),
      dangling_refs: danglingRefs,
    },
    nodes,
    links,
  };
}

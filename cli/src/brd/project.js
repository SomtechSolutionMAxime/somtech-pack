// project.js — Deux projections calculées à la demande à partir d'un seul parse (parser.js).
// Aucune n'est jamais stockée (zéro drift, STD-033 §2.12).
//
// - full  : structure complète (parité sémantique avec l'ancien brd.yaml) + md_block_id par exigence.
// - index : projection légère pour recherche/navigation — corps lourds retirés (justification,
//           description longue, realise_par, teste_par, owner). Taille ≥ 1 ordre de grandeur < MD source.
//
// Format de sortie machine = JSON (déterministe, testable, zéro dépendance). Le format YAML historique
// est abandonné au profit du JSON : la projection est calculée pour consommation programmatique/LLM,
// et le CI du CLI tourne `node --test` sans `npm install` (aucune lib YAML disponible).

import { parseBrd } from './parser.js';

const TITLE_MAX = 60;

function titre(s) {
  if (typeof s !== 'string') return s;
  if (s.length <= TITLE_MAX) return s;
  return `${s.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

/** Projection complète : le parse tel quel (déjà porteur de domaine + md_block_id). */
export function projectFull(mdText) {
  return parseBrd(mdText);
}

/**
 * Projection index légère. Une entrée par exigence, uniquement les champs de navigation.
 * @param {string} mdText
 * @returns {{ea: object[], ef: object[], ra: object[], hs: object[]}}
 */
export function projectIndex(mdText) {
  const p = parseBrd(mdText);
  return {
    ea: p.requirements.ea.map((r) => ({
      id: r.id, titre: titre(r.enonce), statut: r.statut, priorite: r.priorite, md_block_id: r.md_block_id,
    })),
    ef: p.requirements.ef.map((r) => ({
      id: r.id, titre: titre(r.description), statut: r.statut, domaine: r.domaine,
      priorite: r.priorite, couvre: r.couvre, md_block_id: r.md_block_id,
    })),
    ra: p.requirements.ra.map((r) => ({
      id: r.id, titre: titre(r.enonce), statut: r.statut, domaine: r.domaine,
      encadre: r.encadre, md_block_id: r.md_block_id,
    })),
    hs: p.out_of_scope.map((r) => ({
      id: r.id, titre: titre(r.enonce), statut: r.statut, domaine: r.domaine, md_block_id: r.md_block_id,
    })),
  };
}

/** Rendu JSON indenté (mode full : lisible). */
export function toJson(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/** Rendu JSON compact (mode index : le plus léger possible, consommation machine). */
export function toCompactJson(obj) {
  return `${JSON.stringify(obj)}\n`;
}

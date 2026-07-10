// write.js — Écriture ciblée d'un BRD au grain domaine×type (Epic B, D-20260710-0009).
// Produit le contenu d'un bloc-tableau pour Somcraft update_block, sans réécrire tout le MD.
// Symétrie du parser : parse → applyEdit → serializeTable, round-trip préservant.
//
// Le module est PUR : il ne fait aucun appel MCP. L'appelant (skill /brd, agent Orbit) fait :
//   read_document(include_block_ids) → applyEdit(md, id, patch) → update_block(doc, block_id, newContent)
//
// Concurrence (spike T-20260710-0138) : update_block n'a PAS de verrou optimiste natif. La politique
// est un read-modify-write COURT : relire le bloc juste avant d'écrire, comparer au snapshot lu ;
// si divergence → conflit signalé (assertBlockUnchanged), pas d'écrasement silencieux.

import { parseBrd } from './parser.js';

// Colonnes exposées par type (identiques au parser, ordre opposable).
const OUTPUT_SCHEMAS = {
  ea: ['id', 'enonce', 'statut', 'priorite', 'owner'],
  ef: ['id', 'description', 'statut', 'priorite', 'couvre', 'realise_par', 'teste_par', 'owner'],
  ra: ['id', 'enonce', 'justification', 'statut', 'encadre', 'teste_par', 'owner'],
  hs: ['id', 'enonce', 'justification', 'statut', 'reconsidere_quand'],
};
const HEADERS = {
  ea: ['ID', 'Énoncé', 'Statut', 'Priorité', 'Owner'],
  ef: ['ID', 'Description', 'Statut', 'Priorité', 'Couvre', 'Réalisé par', 'Testé par', 'Owner'],
  ra: ['ID', 'Énoncé', 'Justification', 'Statut', 'Encadre', 'Testé par', 'Owner'],
  hs: ['ID', 'Énoncé', 'Justification', 'Statut', 'Re-considéré quand'],
};
const LIST_KEYS = new Set(['couvre', 'encadre', 'realise_par', 'teste_par']);

class BRDWriteError extends Error {
  constructor(message) { super(message); this.name = 'BRDWriteError'; }
}

/** Échappe un pipe littéral pour une cellule de tableau markdown. */
function escapeCell(v) {
  return String(v ?? '').replaceAll('|', '\\|');
}

/** Formate une valeur de cellule selon sa clé (liste → `, `, scalaire → échappé). */
function cellFor(row, key) {
  if (LIST_KEYS.has(key)) {
    const arr = row[key] ?? [];
    return arr.map(escapeCell).join(', ');
  }
  return escapeCell(row[key]);
}

/**
 * Sérialise un tableau (rows d'un même domaine×type) en markdown, à parité avec le parser.
 * @param {object[]} rows
 * @param {'ea'|'ef'|'ra'|'hs'} kind
 * @returns {string} le tableau markdown (sans marqueur bid — update_block le ré-injecte)
 */
export function serializeTable(rows, kind) {
  const cols = OUTPUT_SCHEMAS[kind];
  const header = `| ${HEADERS[kind].join(' | ')} |`;
  const sep = `|${cols.map(() => '---').join('|')}|`;
  const body = rows.map((r) => `| ${cols.map((k) => cellFor(r, k)).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

/** Retrouve la collection (kind) et l'index d'une exigence par ID. */
function locate(parsed, id) {
  const buckets = [
    ['ea', parsed.requirements.ea],
    ['ef', parsed.requirements.ef],
    ['ra', parsed.requirements.ra],
    ['hs', parsed.out_of_scope],
  ];
  for (const [kind, list] of buckets) {
    const idx = list.findIndex((r) => r.id === id);
    if (idx !== -1) return { kind, list, idx, row: list[idx] };
  }
  return null;
}

/**
 * Applique une modification ciblée à une exigence et rend le nouveau contenu de SON bloc-tableau.
 * Ne touche qu'un bloc (grain domaine×type) — les autres blocs restent intacts via update_block.
 *
 * @param {string} md - contenu BRD.md (marqueurs bid inline requis pour ancrer l'écriture)
 * @param {string} id - ID de l'exigence à modifier (ex: EF-CON-002)
 * @param {object} patch - champs à écraser (ex: { statut: 'accepted' })
 * @returns {{ block_id: string, newContent: string, kind: string }}
 */
export function applyEdit(md, id, patch) {
  const parsed = parseBrd(md);
  const loc = locate(parsed, id);
  if (!loc) throw new BRDWriteError(`Exigence '${id}' introuvable dans le BRD.`);
  const { kind, row } = loc;
  const blockId = row.md_block_id;
  if (!blockId) {
    throw new BRDWriteError(`L'exigence '${id}' n'a pas de md_block_id (le MD ne contient pas de marqueur <!-- bid:xxx -->) : écriture ciblée impossible.`);
  }
  // Toutes les exigences du même bloc-tableau (même md_block_id), dans l'ordre.
  const source = kind === 'hs' ? parsed.out_of_scope : parsed.requirements[kind];
  const siblings = source.filter((r) => r.md_block_id === blockId);
  // Interdire un patch qui changerait l'ID (romprait l'ancrage / la traçabilité).
  if ('id' in patch && patch.id !== id) {
    throw new BRDWriteError(`Le patch ne peut pas changer l'ID d'une exigence (${id} → ${patch.id}).`);
  }
  const patched = siblings.map((r) => (r.id === id ? { ...r, ...patch, id } : r));
  return { block_id: blockId, newContent: serializeTable(patched, kind), kind };
}

/**
 * Garde-fou de concurrence (read-modify-write court) : compare le contenu du bloc relu juste avant
 * l'écriture au snapshot lu au début. Divergence → conflit signalé (pas d'écrasement silencieux).
 * @param {string} freshBlockContent - contenu ACTUEL du bloc (relu juste avant update_block)
 * @param {string} snapshotBlockContent - contenu du bloc au moment de la lecture initiale
 */
export function assertBlockUnchanged(freshBlockContent, snapshotBlockContent) {
  const norm = (s) => s.replace(/<!--\s*bid:[^>]*-->/g, '').trim();
  if (norm(freshBlockContent) !== norm(snapshotBlockContent)) {
    throw new BRDWriteError('CONFLIT de concurrence : le bloc a changé entre la lecture et l\'écriture. Relire et rejouer la modification (aucune écriture effectuée).');
  }
}

export { BRDWriteError };

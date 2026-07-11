// index.js — API publique de la lib BRD, réutilisable par les agents Orbit et le skill /brd
// sans invoquer la sous-commande CLI. Importable via `@somtech-solutions/pack/brd`.
//
// Projections calculées à la demande (jamais stockées, STD-033 §2.12) :
//   import { projectIndex, projectFull, parseBrd, applyEdit, assertBlockUnchanged } from '@somtech-solutions/pack/brd';
//
// Invariant read→write (spike T-20260710-0138) : ne jamais mettre l'index/le parse en cache entre
// une lecture et une écriture — toujours relire (read_document) juste avant applyEdit + update_block.
// assertBlockUnchanged fait respecter ce garde-fou côté appelant : un snapshot périmé → CONFLIT.

export { parseBrd, BRDParseError } from './parser.js';
export { projectIndex, projectFull, toJson, toCompactJson } from './project.js';
export { serializeTable, applyEdit, assertBlockUnchanged, BRDWriteError } from './write.js';
export { buildGraph } from './graph.js';

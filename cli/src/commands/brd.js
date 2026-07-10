// brd.js — Sous-commande `somtech-pack brd project` : projette un BRD.md en index (léger) ou full.
// Calcul déterministe à la demande (zéro LLM, zéro artefact stocké — STD-033 §2.12).
//
// Usage :
//   somtech-pack brd project --mode index|full [--file <BRD.md>]
//   cat BRD.md | somtech-pack brd project --mode index
//
// L'appelant (skill /brd, agent Orbit) fait le hop Somcraft read_document et pipe le contenu ici :
// le contenu MD peut contenir les marqueurs `<!-- bid:xxx -->` (→ md_block_id renseigné par exigence).

import { readFileSync } from 'node:fs';
import { projectIndex, projectFull, toJson, toCompactJson } from '../brd/project.js';
import { BRDParseError } from '../brd/parser.js';

function readStdin() {
  try {
    return readFileSync(0, 'utf8'); // fd 0 = stdin
  } catch {
    return '';
  }
}

/**
 * @param {string[]} positionals - après `brd` (ex: ['project'])
 * @param {object} flags - { mode, file, help }
 * @returns {Promise<number>} code de sortie
 */
export async function cmdBrd(positionals, flags) {
  const sub = positionals[0] ?? null;
  if (flags.help || sub === null) {
    console.log(`somtech-pack brd — projections BRD calculées à la demande

Usage :
  somtech-pack brd project --mode index|full [--file <BRD.md>]
  cat BRD.md | somtech-pack brd project --mode index

Options :
  --mode <index|full>   index : projection légère (navigation) ; full : structure complète
  --file <chemin>       Fichier BRD.md à lire (défaut : stdin)

Sortie : JSON. index = compact ; full = indenté. Chaque exigence porte son md_block_id
(null si le MD ne contient pas de marqueur <!-- bid:xxx -->).`);
    return sub === null ? 1 : 0;
  }

  if (sub !== 'project') {
    console.error(`✗ Sous-commande brd inconnue : ${sub} (attendu : project)`);
    return 1;
  }

  const mode = flags.mode ?? 'index';
  if (mode !== 'index' && mode !== 'full') {
    console.error(`✗ --mode invalide : ${mode} (attendu : index | full)`);
    return 1;
  }

  const md = flags.file ? readFileSync(flags.file, 'utf8') : readStdin();
  if (!md.trim()) {
    console.error('✗ Aucun contenu BRD.md fourni (ni --file ni stdin).');
    return 1;
  }

  try {
    if (mode === 'index') {
      process.stdout.write(toCompactJson(projectIndex(md)));
    } else {
      process.stdout.write(toJson(projectFull(md)));
    }
    return 0;
  } catch (e) {
    if (e instanceof BRDParseError) {
      console.error(`✗ BRD invalide — ${e.message}`);
      return 2;
    }
    throw e;
  }
}

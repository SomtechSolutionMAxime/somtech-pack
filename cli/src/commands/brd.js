// brd.js — Sous-commande `somtech-pack brd project` : projette un BRD.md en index (léger) ou full.
// Calcul déterministe à la demande (zéro LLM, zéro artefact stocké — STD-033 §2.12).
//
// Usage :
//   somtech-pack brd project --mode index|full|graph [--file <BRD.md>]
//   cat BRD.md | somtech-pack brd project --mode index
//
// L'appelant (skill /brd, agent Orbit) fait le hop Somcraft read_document et pipe le contenu ici :
// le contenu MD peut contenir les marqueurs `<!-- bid:xxx -->` (→ md_block_id renseigné par exigence).

import { readFileSync } from 'node:fs';
import { projectIndex, projectFull, toJson, toCompactJson } from '../brd/project.js';
import { buildGraph } from '../brd/graph.js';
import { BRDParseError } from '../brd/parser.js';
import { applyEdit, BRDWriteError } from '../brd/write.js';

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
  somtech-pack brd project --mode index|full|graph [--file <BRD.md>]
  cat BRD.md | somtech-pack brd project --mode index
  somtech-pack brd edit --id <EF-XXX-001> --patch '<json>' [--file <BRD.md>]

Options :
  --mode <index|full|graph>  project : index (léger) | full (complet) | graph (node-link NetworkX)
  --id <ID>             edit : ID de l'exigence à modifier
  --patch <json>        edit : champs à écraser, ex '{"statut":"accepted"}'
  --file <chemin>       Fichier BRD.md à lire (défaut : stdin)

Sortie project : JSON (index compact / full indenté). Chaque exigence porte son md_block_id.
Sortie edit : JSON { block_id, newContent, kind } à passer à Somcraft update_block.
Le MD doit contenir les marqueurs <!-- bid:xxx --> (rendu par read_document) pour l'édition.`);
    return sub === null ? 1 : 0;
  }

  if (sub === 'edit') return cmdBrdEdit(flags);

  if (sub !== 'project') {
    console.error(`✗ Sous-commande brd inconnue : ${sub} (attendu : project | edit)`);
    return 1;
  }

  const mode = flags.mode ?? 'index';
  if (mode !== 'index' && mode !== 'full' && mode !== 'graph') {
    console.error(`✗ --mode invalide : ${mode} (attendu : index | full | graph)`);
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
    } else if (mode === 'graph') {
      process.stdout.write(toCompactJson(buildGraph(md)));
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

/** `brd edit` : produit le contenu d'un bloc-tableau modifié pour Somcraft update_block. */
function cmdBrdEdit(flags) {
  if (!flags.id) { console.error('✗ --id requis (ID de l\'exigence à modifier).'); return 1; }
  if (!flags.patch) { console.error('✗ --patch requis (JSON des champs à écraser).'); return 1; }
  let patch;
  try {
    patch = JSON.parse(flags.patch);
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('objet attendu');
  } catch (e) {
    console.error(`✗ --patch JSON invalide : ${e.message}`);
    return 1;
  }
  const md = flags.file ? readFileSync(flags.file, 'utf8') : readStdin();
  if (!md.trim()) { console.error('✗ Aucun contenu BRD.md fourni (ni --file ni stdin).'); return 1; }
  try {
    process.stdout.write(`${JSON.stringify(applyEdit(md, flags.id, patch), null, 2)}\n`);
    return 0;
  } catch (e) {
    if (e instanceof BRDParseError) { console.error(`✗ BRD invalide — ${e.message}`); return 2; }
    if (e instanceof BRDWriteError) { console.error(`✗ Édition impossible — ${e.message}`); return 3; }
    throw e;
  }
}

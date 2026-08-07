// representant.js — met à jour un lieu de représentant déjà POSÉ chez un client
// (E-20260807-0004, D-20260807-0001). Complémentaire de la compétence qui POSE
// (`/gestionnaire-client`, E-20260807-0002) : celle-ci ne crée jamais un lieu, elle
// ne fait que le rafraîchir.
//
// RA-REL-014 — la frontière absolue de ce fichier : CLAUDE.md (et tout ce que le
// pack distribue à ce lieu) appartient au pack et se REMPLACE INTÉGRALEMENT à
// chaque mise à jour ; CONTEXTE.md appartient au client et n'est JAMAIS touché.
//
// Toute l'écriture passe par `applyFiles`/`collectFiles` (engine.js), déjà revus
// pour la convergence pack↔projet ailleurs dans le CLI (init/update/setup) :
// AUCUN autre appel d'écriture fichier n'existe dans ce module. C'est délibéré —
// une seule porte à surveiller pour la frontière CONTEXTE.md, gardée par un test
// statique dans cli/test/representant-update.test.js.
//
// La liste des fichiers synchronisés n'est JAMAIS écrite en dur : elle est
// ÉNUMÉRÉE depuis le gabarit source (`collectFiles`). Un fichier ajouté demain au
// gabarit (ex. .mcp.json, settings.json — la structure que E-20260807-0002 pose)
// converge automatiquement, sans toucher ce fichier. C'est ce qui évite le motif
// « un correctif ne couvre qu'une porte sur deux » : compter les fichiers à
// synchroniser en dur, c'est en oublier un le jour où le gabarit grandit.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolvePayloadRoot } from '../modules.js';
import { collectFiles, applyFiles } from '../engine.js';

/** Le lieu d'où le pack distribue les gabarits du représentant (module `core`). */
export const GABARIT_DIR = join('.claude', 'templates', 'gestionnaire-client');

/**
 * Appartient au client, écrit à la main : JAMAIS écrasé, et JAMAIS non plus créé par une
 * mise à jour (RA-REL-014). Le `preserve` générique d'engine.js (utilisé pour
 * `.claude/settings.json` ailleurs dans le CLI) crée le fichier s'il est absent — c'est le
 * comportement voulu pour un fichier de config projet, mais pas ici : cette compétence
 * REFRAÎCHIT un lieu déjà posé, elle n'en complète jamais la pose. Un CONTEXTE.md absent
 * signale un lieu posé PARTIELLEMENT — pas une occasion de le fabriquer à la place de la
 * compétence qui pose. On l'exclut donc de la liste des fichiers avant même d'appeler
 * `applyFiles` : la seule porte d'écriture ne le voit jamais passer, dans un sens ou l'autre.
 */
export const PRESERVE = ['CONTEXTE.md'];

/** Un slug client : un seul segment de chemin sûr, en minuscules — jamais une évasion. */
export function clientSlugValide(client) {
  return typeof client === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(client);
}

export async function cmdRepresentantUpdate(flags) {
  const client = flags.client;
  if (!clientSlugValide(client)) {
    throw new Error(
      `--client requis : un slug en minuscules (lettres/chiffres/tirets), reçu « ${client ?? ''} »`
    );
  }

  const payloadRoot = resolvePayloadRoot({ source: flags.source });
  const sourceDir = join(payloadRoot, GABARIT_DIR);
  if (!existsSync(sourceDir)) {
    throw new Error(`Gabarit introuvable (${sourceDir}) — le pack ne distribue pas (encore) de représentant`);
  }

  const target = resolve(join(flags.target || process.cwd(), '.gestionnaire', client));
  if (!existsSync(target)) {
    throw new Error(
      `${target} n'existe pas — ce client n'a jamais été « posé ». `
        + `Cette compétence met à jour un lieu existant, elle n'en pose aucun.`
    );
  }

  const { files: tous } = collectFiles(sourceDir, ['']);
  const preserveSet = new Set(PRESERVE);
  const files = tous.filter((rel) => !preserveSet.has(rel));
  const report = applyFiles({
    payloadRoot: sourceDir,
    target,
    files,
    dryRun: flags.dryRun,
  });
  report.preserved = tous.filter((rel) => preserveSet.has(rel) && existsSync(join(target, rel)));

  const converged = flags.dryRun ? 'à converger' : 'convergés (version du pack)';
  console.log(`Représentant « ${client} » → ${target}${flags.dryRun ? ' [dry-run]' : ''}`);
  if (report.created.length) console.log(`  créés : ${report.created.join(', ')}`);
  if (report.updated.length) console.log(`  ${converged} : ${report.updated.join(', ')}`);
  if (report.unchanged.length) console.log(`  inchangés : ${report.unchanged.length}`);
  if (report.backedUp.length) console.log(`  💾 dérives sauvegardées avant convergence (.somtech.bak) : ${report.backedUp.join(', ')}`);
  if (report.preserved.length) console.log(`  🔒 préservés (propriété du client, jamais écrasés) : ${report.preserved.join(', ')}`);
  if (report.conflicts.length) console.log(`  ↩︎  en conflit (symlink en cible, non écrit à travers) : ${report.conflicts.join(', ')}`);

  return flags.dryRun && report.updated.length ? 2 : 0;
}

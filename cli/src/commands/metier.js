// metier.js — sous-commandes du métier rendu (STD-047, P-20260820-0001).
//
// `pack metier rendre --role <r>`   produit L0/L1/L2 depuis le classement
// `pack metier verifier --role <r>` ne rend rien : mesure et sort non nul si ça ne passe pas
//
// ⚠️ R6 — le rendu n'écrit JAMAIS dans le lieu d'un agent. Il produit les
// artefacts du pack ; la distribution est l'affaire de la convergence.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { rendre, BUDGETS } from '../metier/rendu.js';

const SOUS_COMMANDES = new Set(['rendre', 'verifier']);
export const isMetierCommand = (cmd) => cmd === 'metier';

function lireClassement(racine, role) {
  const p = join(racine, 'metier', role, 'classement.json');
  if (!existsSync(p)) {
    throw new Error(`aucun classement pour le rôle « ${role} » — attendu : ${p}\n` +
      `Le classement est un artefact versionné, pas une inférence (STD-047 §2.1).`);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

function rapport(r, role) {
  const l = [];
  l.push(`métier « ${role} » — L0 ${r.mesures.L0}/${BUDGETS.L0} · L1 ${r.mesures.L1}/${BUDGETS.L1} tokens`);
  for (const [n, t] of Object.entries(r.mesures.L2)) l.push(`  chapitre ${n} : ${t}/${BUDGETS.L2}`);
  if (r.deroges?.length) {
    l.push(`⚠️  ${r.deroges.length} garde-fou(x) qu'aucune couche ne garantit, assumés explicitement :`);
    for (const id of r.deroges) l.push(`     ${id}`);
  }
  for (const a of r.avertissements || []) l.push(`⚠️  ${a}`);
  for (const e of r.erreurs) l.push(`⛔ ${e}`);
  return l.join('\n');
}

export function runMetier(argv, { cwd = process.cwd() } = {}) {
  const sous = argv[1];
  if (!SOUS_COMMANDES.has(sous)) {
    process.stderr.write(`usage : pack metier <${[...SOUS_COMMANDES].join('|')}> --role <rôle>\n`);
    return 2;
  }
  const iRole = argv.indexOf('--role');
  const role = iRole > -1 ? argv[iRole + 1] : 'orchestrateur';

  let classement;
  try { classement = lireClassement(cwd, role); }
  catch (e) { process.stderr.write(`⛔ ${e.message}\n`); return 1; }

  const r = rendre(classement);
  process.stdout.write(rapport(r, role) + '\n');
  if (!r.ok) {
    process.stderr.write('⛔ rendu refusé — rien n\'a été écrit.\n');
    return 1;
  }
  if (sous === 'verifier') return 0;

  const base = join(cwd, 'metier', role, 'rendu');
  for (const [chemin, contenu] of Object.entries(r.artefacts)) {
    const cible = join(base, chemin);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, contenu);
  }
  process.stdout.write(`✅ ${Object.keys(r.artefacts).length} artefacts écrits dans metier/${role}/rendu/\n`);
  return 0;
}

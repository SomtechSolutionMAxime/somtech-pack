// metier.js — sous-commandes du métier rendu (STD-047, P-20260820-0001).
//
// `pack metier rendre --role <r>`   produit L0/L1/L2 depuis le classement
// `pack metier verifier --role <r>` ne rend rien : mesure, compare au rendu
//                                   committé, et sort non nul si ça ne va pas
//
// ⚠️ R6 — le rendu n'écrit JAMAIS dans le lieu d'un agent. Il produit les
// artefacts du pack ; la distribution est l'affaire de la convergence.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { rendre, BUDGETS } from '../metier/rendu.js';

const SOUS_COMMANDES = new Set(['rendre', 'verifier']);
export const isMetierCommand = (cmd) => cmd === 'metier';

/** Un rôle est un segment de chemin, jamais une traversée. */
function roleValide(role) {
  return typeof role === 'string' && role.length > 0 && !role.startsWith('-') &&
    /^[a-z0-9][a-z0-9_-]*$/.test(role);
}

/**
 * Charge le classement ET injecte le contenu des chapitres depuis leurs fichiers.
 *
 * ⚠️ Le contenu d'un chapitre a UNE seule source : `metier/<role>/chapitres/<nom>.md`.
 * Il a été un temps recopié dans le JSON, et seule la copie JSON était lue —
 * éditer le fichier lisible était alors un no-op silencieux. C'est le motif
 * « deux copies d'un critère divergent en silence », trouvé par la revue
 * indépendante du 2026-08-20.
 */
function lireClassement(racine, role) {
  const base = join(racine, 'metier', role);
  const p = join(base, 'classement.json');
  if (!existsSync(p)) {
    throw new Error(`aucun classement pour le rôle « ${role} » — attendu : ${p}\n` +
      `Le classement est un artefact versionné, pas une inférence (STD-047 §2.1).`);
  }
  const cl = JSON.parse(readFileSync(p, 'utf8'));
  for (const c of cl.chapitres || []) {
    if (!c?.nom) continue;
    const f = join(base, 'chapitres', `${c.nom}.md`);
    if (existsSync(f)) c.contenu = readFileSync(f, 'utf8');
    else delete c.contenu;
  }
  return cl;
}

/** Ce que le rendu committé porte aujourd'hui, pour le comparer à ce qu'il devrait porter. */
function lireRenduCommitte(base) {
  const out = {};
  const marche = (rel) => {
    const abs = join(base, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs)) {
      const r = rel ? `${rel}/${e}` : e;
      if (statSync(join(base, r)).isDirectory()) marche(r);
      else out[r] = readFileSync(join(base, r), 'utf8');
    }
  };
  marche('');
  return out;
}

function rapport(r, role) {
  const l = [`métier « ${role} » — L0 ${r.mesures.L0}/${BUDGETS.L0} · L1 ${r.mesures.L1}/${BUDGETS.L1} tokens`];
  for (const [n, t] of Object.entries(r.mesures.L2)) l.push(`  chapitre ${n} : ${t}/${BUDGETS.L2}`);
  const { garde_fous, deroges, refuses } = r.mesures.R1 || {};
  if (garde_fous !== undefined) {
    l.push(`R1 : ${garde_fous} garde-fous · ${deroges} dérogés · ${refuses} refusés` +
      (deroges === garde_fous && garde_fous > 0 ? '  ⚠️ R1 ne refuse plus RIEN sur ce rôle' : ''));
  }
  for (const id of r.deroges || []) l.push(`     dérogé : ${id}`);
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
  const i = argv.indexOf('--role');
  const role = i > -1 ? argv[i + 1] : 'orchestrateur';
  if (!roleValide(role)) {
    process.stderr.write(
      `⛔ rôle invalide : ${role === undefined ? '(aucune valeur après --role)' : `« ${role} »`}\n` +
      `   Un rôle est un seul segment : lettres minuscules, chiffres, « - » ou « _ ».\n` +
      `   usage : pack metier ${sous} --role <rôle>\n`);
    return 2;
  }

  let classement;
  try { classement = lireClassement(cwd, role); }
  catch (e) { process.stderr.write(`⛔ ${e.message}\n`); return 1; }

  const r = rendre(classement);
  process.stdout.write(rapport(r, role) + '\n');
  if (!r.ok) { process.stderr.write("⛔ rendu refusé — rien n'a été écrit.\n"); return 1; }

  const base = join(cwd, 'metier', role, 'rendu');

  if (sous === 'verifier') {
    // Un rendu committé qui ne correspond plus à sa source est un métier périmé
    // que rien ne signale. C'est ce que cette comparaison rend visible.
    const actuel = lireRenduCommitte(base);
    const attendu = r.artefacts;
    const ecarts = [
      ...Object.keys(attendu).filter((k) => actuel[k] !== attendu[k]).map((k) => `${k} : périmé ou absent`),
      ...Object.keys(actuel).filter((k) => !(k in attendu)).map((k) => `${k} : orphelin, plus produit par le classement`),
    ];
    // le gabarit distribué doit lui aussi correspondre au rendu
    const gabarit = join(cwd, '.claude', 'templates', role);
    if (existsSync(gabarit)) {
      const socle = (attendu['L0.md'] || '') + (attendu['L1.md'] || '');
      const lu = (f) => (existsSync(join(gabarit, f)) ? readFileSync(join(gabarit, f), 'utf8') : null);
      if (lu('CLAUDE.md') !== socle) ecarts.push('.claude/templates/' + role + '/CLAUDE.md : périmé face au rendu');
      for (const [chemin, contenu] of Object.entries(attendu)) {
        if (!chemin.startsWith('chapitres/')) continue;
        if (lu(`metier/${chemin}`) !== contenu) ecarts.push(`.claude/templates/${role}/metier/${chemin} : périmé`);
      }
    }
    if (ecarts.length) {
      process.stderr.write(`⛔ le rendu committé ne correspond plus à sa source :\n` +
        ecarts.map((e) => `   ${e}`).join('\n') + `\n   Relance : pack metier rendre --role ${role}\n`);
      return 1;
    }
    process.stdout.write('✅ le rendu committé est conforme à sa source.\n');
    return 0;
  }

  // On écrit, puis on retire ce que le classement ne produit plus : un fichier
  // orphelin reste suivi par git et livré, et « git status » ne montre rien.
  for (const [chemin, contenu] of Object.entries(r.artefacts)) {
    const cible = join(base, chemin);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, contenu);
  }
  let retires = 0;
  for (const chemin of Object.keys(lireRenduCommitte(base))) {
    if (!(chemin in r.artefacts)) { rmSync(join(base, chemin.split('/').join(sep))); retires++; }
  }
  // Le GABARIT que le pack distribue EST le rendu. Sans ce maillon, `pack metier
  // rendre` produit des artefacts à côté et `/orchestrateur` continue de poser un
  // métier écrit à la main : le rendu existerait sans atteindre personne.
  //
  // ⚠️ `CONTEXTE.md` n'est jamais touché (I6) — il appartient au dépôt, pas au pack.
  const distribues = distribuerAuGabarit(cwd, role, r.artefacts);

  process.stdout.write(
    `✅ ${Object.keys(r.artefacts).length} artefacts écrits dans metier/${role}/rendu/` +
    (retires ? ` · ${retires} orphelin(s) retiré(s)` : '') +
    (distribues ? ` · ${distribues} distribué(s) vers .claude/templates/${role}/` : '') + '\n');
  return 0;
}

/**
 * Recopie le rendu dans le gabarit que le pack distribue.
 *
 * Le socle (L0 + L1) devient le `CLAUDE.md` du rôle ; les chapitres et le fichier
 * de droits suivent. Ce qui n'est plus produit est retiré du gabarit aussi —
 * un chapitre orphelin resterait distribué à jamais.
 */
function distribuerAuGabarit(cwd, role, artefacts) {
  const gabarit = join(cwd, '.claude', 'templates', role);
  if (!existsSync(gabarit)) return 0;

  const socle = (artefacts['L0.md'] || '') + (artefacts['L1.md'] || '');
  const aPoser = { 'CLAUDE.md': socle };
  for (const [chemin, contenu] of Object.entries(artefacts)) {
    if (chemin.startsWith('chapitres/')) aPoser[`metier/${chemin}`] = contenu;
    else if (chemin === '.claude/settings.json') aPoser[chemin] = contenu;
  }

  for (const [chemin, contenu] of Object.entries(aPoser)) {
    const cible = join(gabarit, chemin);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, contenu);
  }
  // les chapitres que le classement ne produit plus
  const dossier = join(gabarit, 'metier', 'chapitres');
  if (existsSync(dossier)) {
    for (const f of readdirSync(dossier)) {
      if (!(`metier/chapitres/${f}` in aPoser)) rmSync(join(dossier, f));
    }
  }
  return Object.keys(aPoser).length;
}

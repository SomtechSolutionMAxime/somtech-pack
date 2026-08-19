#!/usr/bin/env node
// Mesure : « qu'est-ce que cette garde exige RÉELLEMENT ? »
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CET OUTIL MESURE
//
// Une garde qui cherche un motif dans un PÉRIMÈTRE plus large que ce qu'elle prétend garder
// est satisfaite par n'importe quoi d'autre dans ce périmètre. Elle ne peut plus distinguer
// « la chose est là » de « quelque chose d'autre est là ».
//
// ⚠️ ÇA NE SE VOIT PAS EN LA RELISANT. Le seul signal est une mutation qui devient MUETTE :
// elle ne rougit pas, elle ne crie pas — elle cesse simplement de prouver quelque chose, et
// la suite reste verte. Trois fois sur `metier-orchestrateur.js` (T-20260817-0016,
// T-20260819-0021), chaque fois ré-ancrée à la main sans qu'on compte les autres.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA MÉTHODE — un compte sans sa méthode est un fait invérifiable
//
// Aucune lecture de la SOURCE des gardes : un parseur ne connaîtrait que les formes qu'on
// lui a apprises, et la première forme inventée lui échapperait. On mesure le COMPORTEMENT.
//
// Pour chaque couple (garde G, ligne L du gabarit dont G dépend) :
//   1. on RETIRE L        → G rougit, par construction (c'est la définition de « dépend ») ;
//   2. on réinjecte AILLEURS dans le même périmètre de section un fragment de L, et on
//      RÉDUIT ce fragment mot à mot par les deux bouts tant que G reste VERTE.
//
// Le plus court fragment qui satisfait G est ce que G exige vraiment. Une garde qu'AUCUN
// fragment ne satisfait ailleurs est ANCRÉE : elle exige la phrase là où elle est.
//
// ⚠️ CE QUE CETTE MESURE NE DIT PAS, ET IL FAUT LE SAVOIR AVANT DE S'Y FIER :
//   • un fragment court n'est pas toujours un défaut — certaines gardes exigent délibérément
//     un mot-clé dans un périmètre restreint. Le nombre BORNE la famille, il ne condamne
//     personne individuellement ;
//   • elle porte sur le gabarit D'AUJOURD'HUI. Une garde structurellement large dont le
//     périmètre ne porte qu'une occurrence n'apparaît pas — elle se désarmera au premier
//     ajout légitime ;
//   • les lignes de BLOC DE CODE sont écartées : les déplacer casse la parité des
//     délimiteurs et fait rougir tout le monde pour une raison qui n'est pas la nôtre.
//
// Usage :  node scripts/mesure-ancrage-des-gardes.mjs [garde…]
//          (sans argument : toutes les gardes — compter plusieurs minutes)
import { execFileSync } from 'node:child_process';

import { CONTROLES, lireGabarits } from '../cli/test/lib/metier-orchestrateur.js';
import { sections } from '../cli/test/lib/metier-representant.js';

/**
 * L'ÉTAT sur lequel la mesure est prise — commit, et si l'arbre est propre.
 *
 * ⚠️ CETTE LIGNE EST UNE GARDE, PAS UN ORNEMENT, ET ELLE VIENT D'UN REJET DE REVUE.
 *
 * Le lot G a publié « 21 gardes satisfaites par 5 mots ou moins », mesuré à `0149e79`, puis
 * a corrigé au commit SUIVANT une des gardes comptées — le chiffre valait 20 sur l'état
 * livré, et personne ne pouvait le savoir en lisant le nombre. **Un compte se mesure sur un
 * état ; sans cet état, il n'est pas vérifiable, seulement plausible.** C'est la même famille
 * que ce que cet outil traque : mesurer un objet et conclure sur un autre.
 *
 * Un arbre SALE est dit lui aussi : le commit ne décrit alors pas ce qui a été mesuré.
 */
function etatMesure() {
  try {
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    const sale = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
    return `${commit}${sale ? ' + modifications NON COMMITÉES (le commit ne décrit pas ce qui est mesuré)' : ''}`;
  } catch {
    return 'état inconnu — git n’a pas répondu ; ce compte n’est rattachable à rien';
  }
}

const ORIGINAL = lireGabarits();
const FICHIER = 'metier';
const texte = ORIGINAL[FICHIER];
const lignes = texte.split('\n');
const CIBLES = process.argv.slice(2);

const rougesDe = (t) => {
  const o = new Set();
  const g = { ...ORIGINAL, [FICHIER]: t };
  for (const c of CONTROLES) { try { c.verifier(g); } catch { o.add(c.id); } }
  return o;
};
const BASE = rougesDe(texte);
if (BASE.size) console.log('⚠ gardes déjà rouges sur le gabarit intact :', [...BASE].join(', '));

const dansBloc = new Array(lignes.length).fill(false);
let dedans = false;
for (let i = 0; i < lignes.length; i++) {
  if (/^\s*(```|~~~)/.test(lignes[i])) { dansBloc[i] = true; dedans = !dedans; continue; }
  dansBloc[i] = dedans;
}

const S = sections(texte);
const off = []; let o = 0;
for (const l of lignes) { off.push(o); o += l.length + 1; }

/** Où réinjecter le fragment : la fin du corps étendu de la section de L, hors bloc de code. */
function pointDInjection(i) {
  const pos = off[i];
  let sec = null;
  for (const s of S) if (s._debut <= pos && (!sec || s._debut > sec._debut)) sec = s;
  if (!sec) return null;
  const finPos = sec._fin + sec.corpsEtendu.length;
  let fin = lignes.length;
  for (let k = 0; k < off.length; k++) if (off[k] >= finPos) { fin = k; break; }
  let p = Math.min(fin, lignes.length);
  while (p > i + 1 && (dansBloc[p - 1] || /^\s*(```|~~~)/.test(lignes[p - 1] || ''))) p--;
  return p <= i ? null : p;
}

const essai = (i, frag, p) => {
  const t = [...lignes];
  if (frag !== null) t.splice(p, 0, '', frag, '');
  t.splice(i, 1);
  return rougesDe(t.join('\n'));
};

const resultats = [];
for (let i = 0; i < lignes.length; i++) {
  const L = lignes[i];
  if (!L.trim() || dansBloc[i] || /^\s*(```|~~~)/.test(L)) continue;
  const dependantes = [...essai(i, null, 0)].filter((id) => !BASE.has(id));
  if (!dependantes.length) continue;
  const p = pointDInjection(i);
  if (p === null) continue;

  for (const id of dependantes) {
    if (CIBLES.length && !CIBLES.includes(id)) continue;
    if (essai(i, L, p).has(id)) { resultats.push({ id, i, frag: null }); continue; }
    let mots = L.trim().split(/\s+/);
    let progres = true;
    while (progres && mots.length > 1) {
      progres = false;
      const sansPremier = mots.slice(1);
      if (!essai(i, sansPremier.join(' '), p).has(id)) { mots = sansPremier; progres = true; continue; }
      const sansDernier = mots.slice(0, -1);
      if (!essai(i, sansDernier.join(' '), p).has(id)) { mots = sansDernier; progres = true; }
    }
    resultats.push({ id, i, frag: mots.join(' '), motsLigne: L.trim().split(/\s+/).length, motsFrag: mots.length });
  }
}

const parGarde = new Map();
for (const r of resultats) parGarde.set(r.id, [...(parGarde.get(r.id) || []), r]);
const larges = [...parGarde].filter(([, rs]) => rs.some((r) => r.frag !== null));
const ancrees = [...parGarde].filter(([, rs]) => rs.every((r) => r.frag === null));

console.log(`\n═══ ${FICHIER} — ${lignes.length} lignes, ${CONTROLES.length} gardes déclarées`);
console.log(`mesuré sur : ${etatMesure()}`);
console.log(`gardes dépendant d'au moins une ligne de prose : ${parGarde.size}`);
console.log(`SATISFAITES PAR UN FRAGMENT réinjecté ailleurs : ${larges.length}`);
console.log(`  dont par 5 mots ou moins                     : ${larges.filter(([, rs]) => Math.min(...rs.filter((r) => r.frag !== null).map((r) => r.motsFrag)) <= 5).length}`);
console.log(`ANCRÉES — aucun fragment ne les satisfait      : ${ancrees.length}`);

for (const [id, rs] of larges.sort()) {
  const f = rs.filter((r) => r.frag !== null).sort((a, b) => a.motsFrag - b.motsFrag)[0];
  console.log(`\n  ▸ ${id}`);
  console.log(`      l.${f.i + 1} (${f.motsLigne} mots) — fragment suffisant : ${f.motsFrag} mot(s)`);
  console.log(`      « ${f.frag.slice(0, 100)} »`);
}

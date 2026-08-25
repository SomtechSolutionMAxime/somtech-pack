#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LES DEUX CHIFFRES DE LA GARDE D'ÉCRAN — l'instrument qui les rend, sur le poste où on est.
//
// ⚠️ POURQUOI CET INSTRUMENT EXISTE. Une garde se juge sur DEUX chiffres : ce qu'elle attrape,
// ET ce qu'elle refuse à tort. Le second ne se lit dans aucun test unitaire — il se mesure sur
// le trafic réel, et il change avec le poste. Un lot qui se contente de CITER ces chiffres dans
// un message de commit laisse un lecteur incapable de les recontrôler : le nombre devient un
// souvenir qui a l'air d'une preuve. Une passe de revue portail a barré la route de ce lot
// exactement là-dessus, et elle avait raison sur le fond.
//
// ⚠️ CE QU'IL NE FAIT PAS. Il ne remplace pas les bancs : `tests/un-bandeau-nest-pas-un-dialogue.
// test.js` épingle la frontière sur des écrans capturés EN OCTETS, donc reproductibles partout
// et en CI. Cet outil-ci mesure le POSTE, qui change d'heure en heure — son rendu est une
// photographie, jamais un invariant. C'est pourquoi il vit sous `outils/` et non sous `tests/`.
//
// Lecture seule : il n'écrit dans aucun pane, ne démarre aucun agent, ne touche à rien.
//
// Usage :  node ligne-directe/outils/mesurer-le-bruit-de-la-garde.mjs [--source visible|recent]
//
// ── LA MESURE DE RÉFÉRENCE, prise le 2026-08-25 sur ce poste (T-20260825-0073) ─────────────
//
// AVANT le correctif — la garde refusait 8 panes sur 88, tous à tort :
//
//   panes mesures : 85
//   === source=visible === garde MORD sur 4/85    par marque : {"esc-cancel":4}
//     w0:p1F (matapedia) statut=idle   -> esc-cancel
//     w65:p7 (mitis)     statut=idle   -> esc-cancel
//     w7H:p1 ()          statut=idle   -> esc-cancel
//     w7M:p2 (bonaventure) statut=idle -> esc-cancel
//   === source=recent  === garde MORD sur 4/85    par marque : {"esc-cancel":4}
//     (LES MÊMES QUATRE — c'est ce relevé-ci qui a écarté la piste « elle lit le scrollback »)
//
//   Relevé élargi une heure plus tard, sur 88 panes : 8 mordants, 8/8 avec une boîte `vide`,
//   8/8 sur la seule marque `esc-cancel`, aucun statut `blocked` parmi eux.
//
// APRÈS le correctif — un seul refus, et c'est un VRAI dialogue :
//
//   panes mesures : 88
//   === source=visible === garde MORD sur 1/88    par marque : {"esc-cancel":1}
//     w1E:pW () statut=blocked -> esc-cancel
//   === source=recent  === garde MORD sur 1/88    (le même)
//
//   Contrôle de ce seul mordant, lu à l'écran :
//     ligne 5 : « Enter to select · ↑/↓ to navigate · Esc to cancel »
//   Un sélecteur affiché, sur un agent `blocked`. La marque a mordu là où elle devait.
//
//   ⇒ faux positifs : 8 → 0    ·    vrais positifs : 0 → 1
// ═══════════════════════════════════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const { ecranAttendUnChoix } = await import(join(ICI, '..', 'src', 'ecran.js'));
const { etatDeLaBoite } = await import(join(ICI, '..', 'src', 'boite.js'));

const ESC = String.fromCharCode(27);
const sansSequences = (s) => s.replace(new RegExp(ESC + '\\[[0-9;?]*[A-Za-z]', 'g'), '');

/**
 * ⚠️ CETTE TABLE EST UN DOUBLE DE `MARQUES_DE_DIALOGUE_ACTIF`, ET C'EST VOULU — mais il faut le
 * dire, parce qu'un double silencieux dérive. Elle sert à VENTILER par marque un refus déjà
 * rendu par la vraie garde ; elle ne décide jamais rien. Si elle dérivait, le total resterait
 * juste et seule la ventilation deviendrait fausse — panne visible, jamais silencieuse.
 */
const MARQUES = [
  ['curseur-option', /❯\s*[1-9]\.\s/],
  ['enter-confirm', /\b(?:enter|entrée)\b[^\n]{0,20}\b(?:to )?confirm/i],
  ['esc-cancel', /\besc\b[^\n]{0,20}\b(?:to )?cancel/i],
  ['y-n', /\(y\/n\)/i],
  ['do-you-want-to', /\bdo you want to\b/i],
];

function agents() {
  const brut = execFileSync('herdr', ['agent', 'list'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return (JSON.parse(brut).result?.agents ?? []).filter((a) => a.pane_id);
}

function ecran(pane, source) {
  try {
    return execFileSync('herdr', ['pane', 'read', pane, '--source', source, '--format', 'ansi'], {
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 15000,
    });
  } catch { return null; }
}

const demandee = process.argv.includes('--source')
  ? process.argv[process.argv.indexOf('--source') + 1]
  : null;
const sources = demandee ? [demandee] : ['visible', 'recent'];

const parc = agents();
console.log('panes mesurés : ' + parc.length + '   (' + new Date().toISOString() + ')');

// Le parc par statut — le dénominateur que citent les commentaires de la veille de déblocage.
const parStatut = {};
for (const a of parc) parStatut[a.agent_status] = (parStatut[a.agent_status] || 0) + 1;
console.log('parc par statut : ' + JSON.stringify(parStatut));
console.log(
  "⚠️ « au repos » n'est pas « a fini » : `done` est l'état terminal EXPLICITE, `idle` ne l'est " +
  'pas. C\'est ce rapport-ci qui porte le dénominateur cité par veille-deblocage.sh.\n'
);

for (const source of sources) {
  let mordants = 0;
  const parMarque = {};
  const parBoite = {};
  const lignes = [];
  for (const a of parc) {
    const vu = ecran(a.pane_id, source);
    if (vu === null) continue;
    if (!ecranAttendUnChoix(vu)) continue;
    mordants++;
    const plat = sansSequences(vu);
    const marques = MARQUES.filter(([, re]) => re.test(plat)).map(([n]) => n);
    for (const m of marques) parMarque[m] = (parMarque[m] || 0) + 1;
    const boite = etatDeLaBoite(vu).etat;
    parBoite[boite] = (parBoite[boite] || 0) + 1;
    lignes.push(
      '  ' + a.pane_id + ' (' + (a.name ?? '') + ') statut=' + a.agent_status +
      ' boite=' + boite + ' -> ' + marques.join(', ')
    );
  }
  console.log('=== source=' + source + ' === la garde REFUSE ' + mordants + '/' + parc.length);
  console.log('  par marque : ' + JSON.stringify(parMarque));
  console.log('  par état de boîte : ' + JSON.stringify(parBoite));
  for (const l of lignes) console.log(l);
  // ⚠️ LE STATUT EST LE SEUL ARBITRE DISPONIBLE ICI, et il est faillible : `blocked` dit qu'un
  // agent attend, pas forcément devant un dialogue. On rend donc l'indice, jamais un verdict —
  // qui veut trancher va lire l'écran du pane nommé ci-dessus.
  const bloques = lignes.filter((l) => l.includes('statut=blocked')).length;
  console.log(
    '  → dont ' + bloques + ' sur un agent `blocked` (indice de VRAI positif) et ' +
    (mordants - bloques) + ' sur un agent joignable (indice de FAUX positif)\n'
  );
}

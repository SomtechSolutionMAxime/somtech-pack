// CHAQUE ISSUE DE LA DÉLIVRANCE A SON MOT, CHEZ CHAQUE APPELANT (T-20260818-0070).
//
// ⚠️ LE DÉFAUT QUE CETTE GARDE FERME N'ÉTAIT PAS VISIBLE. `delivrerLaBoite` rend neuf issues ;
// la liste vivait en commentaire, et chaque appelant décidait seul lesquelles existaient :
//   • `herdr.js` — un `switch` dont le `default` rendait '' : `plus-autorise`, `soumis` et
//     `vide-cause-inconnue` y étaient MUETTES, et `ecran` y affirmait un dialogue ;
//   • `livraison.js` — cinq branches puis un catch-all qui affirmait « SANS EFFET, la boîte est
//     restée pleine » pour toute autre issue, `plus-autorise` comprise.
// `plus-autorise` n'étant atteignable que par le balayage, les deux défauts étaient INERTES :
// aucun banc existant ne pouvait rougir. Mesuré rouge avant le correctif (15 défauts).
//
// Ce que la garde établit, mécaniquement :
//   1. `delivrerLaBoite` ne rend QUE des causes littérales de `ISSUES_DE_DELIVRANCE`, et les rend
//      toutes — un `return` ajouté avec une cause neuve rougit ici ;
//   2. la table des mots couvre exactement la valeur ;
//   3. chaque appelant a, pour chaque issue, un mot non vide, qui dit SON issue et jamais celle
//      d'une autre ;
//   4. la garde rougit bien quand une issue neuve arrive sans mot (injection sur une copie).
//
// ⚠️ LES SIGNATURES CI-DESSOUS SONT L'ORACLE, écrit à part des mots. Ajouter une issue sans y
// ajouter sa signature rougit aussi : c'est voulu, on ne câble pas une issue sans dire ce qui la
// distingue des autres.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  ISSUES_DE_DELIVRANCE,
  MOTS_DE_DELIVRANCE,
  motDeLIssue,
  TOURS_DIMMOBILITE_EXIGES,
} from '../src/delivrance.js';
import { motDuRefusDeDelivrance } from '../src/herdr.js';
import { unTourDeBalayage } from '../src/balayage.js';
import { motDeLaDelivrance } from '../../naissance-representant/src/livraison.js';

const SIGNATURES = {
  choix: /ressemble à un \**dialogue de choix/i,
  dialogue: /dialogue qui attend un choix/i,
  ecran: /devant un écran/i,
  illisible: /illisible/i,
  'vide-cause-inconnue': /sans que je sache comment/i,
  bouge: /a boug[ée]/i,
  'plus-autorise': /plus autoris[ée]/i,
  // ⚠️ converti par D-20260921-0003 : la délivrance ne soumet plus JAMAIS la boîte d'autrui — cette issue
  // dit la règle, et aucune des autres ne porte ce mot-là.
  'soumission-interdite': /on ne soumet JAMAIS/i,
  soumis: /a été soumis/i,
  'sans-effet': /sans effet/i,
};
const INCONNUE = /issue de délivrance inconnue/i;

/** Ce que rend `delivrerLaBoite` pour une cause donnée — la forme minimale que lisent les appelants. */
const issue = (cause) => ({ ok: cause === 'soumis' || cause === 'vide-cause-inconnue', cause, soumis: cause === 'soumis' });

/** Le mot que le BALAYAGE rend pour une issue — lu dans son compte rendu réel, pas recalculé. */
async function motDuBalayage(delivrance) {
  // `soumis` n'est pas un refus au balayage : il part en déblocage, avec l'avis de boîte bloquée.
  if (delivrance.soumis) return 'le texte coincé a été soumis pour son auteur (déblocage, pas un refus)';
  const pane = 'w1:p1';
  const texte = 'un texte coincé';
  const memoire = new Map([[pane, { texte, tours: TOURS_DIMMOBILITE_EXIGES - 1, depuis: 0 }]]);
  const rendu = await unTourDeBalayage({
    agents: [{ pane, nom: 'a' }],
    lireEcran: async () => ['x', '─'.repeat(40), `❯ ${texte}`, '─'.repeat(40)].join('\n'),
    delivrer: async () => delivrance,
    memoire,
    maintenant: 600_000,
  });
  const r = rendu.refus.find((x) => x.pane === pane);
  assert.ok(r, `le balayage devait tenter la délivrance (refus rendus : ${JSON.stringify(rendu.refus)})`);
  assert.equal(r.cause, delivrance.cause, 'le balayage rend la cause telle quelle');
  return r.mot;
}

const APPELANTS = {
  'herdr.motDuRefusDeDelivrance': async (d) => motDuRefusDeDelivrance(d),
  'livraison.motDeLaDelivrance': async (d) => motDeLaDelivrance(d, { immobiliteMs: 10_000 }),
  'balayage.refus[].mot': motDuBalayage,
};

/** Tous les défauts d'exhaustivité, nommés. Vide = la garde est verte. */
async function defauts(issues, appelants) {
  const out = [];
  for (const cause of issues) {
    if (!Object.hasOwn(MOTS_DE_DELIVRANCE, cause)) out.push(`MOTS_DE_DELIVRANCE/${cause}: aucune entrée`);
    else for (const forme of ['court', 'long']) {
      if (typeof MOTS_DE_DELIVRANCE[cause][forme] !== 'function') out.push(`MOTS_DE_DELIVRANCE/${cause}: pas de forme ${forme}`);
    }
  }
  for (const [nom, mot] of Object.entries(appelants)) {
    for (const cause of issues) {
      let texte;
      try {
        texte = String((await mot(issue(cause))) ?? '');
      } catch (e) {
        out.push(`${nom}/${cause}: lève ${e.message}`);
        continue;
      }
      if (!texte.replace(/[\s:]/g, '')) {
        out.push(`${nom}/${cause}: MUET`);
        continue;
      }
      if (INCONNUE.test(texte)) out.push(`${nom}/${cause}: dit « issue inconnue » pour une issue de la valeur`);
      const propre = SIGNATURES[cause];
      if (!propre) out.push(`${nom}/${cause}: aucune signature dans l’oracle`);
      else if (!propre.test(texte)) out.push(`${nom}/${cause}: ne dit pas son issue`);
      for (const [autre, sig] of Object.entries(SIGNATURES)) {
        if (autre !== cause && sig.test(texte)) out.push(`${nom}/${cause}: porte la phrase de « ${autre} »`);
      }
    }
  }
  return out;
}

test('delivrerLaBoite ne rend QUE des causes de ISSUES_DE_DELIVRANCE, et les rend toutes', () => {
  assert.ok(Object.isFrozen(ISSUES_DE_DELIVRANCE), 'la valeur est gelée — on ne l’étend pas à l’exécution');
  const source = readFileSync(fileURLToPath(new URL('../src/delivrance.js', import.meta.url)), 'utf8');
  const debut = source.indexOf('export async function delivrerLaBoite(');
  assert.ok(debut >= 0, 'delivrerLaBoite introuvable dans delivrance.js');
  const fin = source.indexOf('\n}\n', debut);
  const corps = source.slice(debut, fin);

  const toutes = [...corps.matchAll(/\bcause\s*:\s*([^,}\n]+)/g)].map((m) => m[1].trim());
  assert.ok(toutes.length > 0, 'aucune cause trouvée — l’instrument ne mesure plus rien');
  const nonLitterales = toutes.filter((c) => !/^'[^']+'$/.test(c));
  assert.deepEqual(nonLitterales, [], 'chaque cause rendue doit être un littéral — une cause calculée échappe à cette garde');

  const rendues = new Set(toutes.map((c) => c.slice(1, -1)));
  assert.deepEqual([...rendues].sort(), [...ISSUES_DE_DELIVRANCE].sort(),
    'l’ensemble des causes rendues doit être EXACTEMENT ISSUES_DE_DELIVRANCE');
});

test('chaque issue a son mot chez chaque appelant — non vide, le sien, jamais celui d’une autre', async () => {
  assert.deepEqual(Object.keys(MOTS_DE_DELIVRANCE).sort(), [...ISSUES_DE_DELIVRANCE].sort(),
    'la table des mots couvre exactement la valeur');
  assert.deepEqual(await defauts(ISSUES_DE_DELIVRANCE, APPELANTS), []);
});

test('LA GARDE ROUGIT — une issue neuve sans mot est nommée chez chaque appelant', async () => {
  const copie = [...ISSUES_DE_DELIVRANCE, 'issue-fictive'];
  const trouves = await defauts(copie, APPELANTS);
  assert.ok(trouves.some((d) => d.startsWith('MOTS_DE_DELIVRANCE/issue-fictive')), `la table doit être accusée : ${trouves}`);
  for (const nom of Object.keys(APPELANTS)) {
    assert.ok(trouves.some((d) => d.startsWith(`${nom}/issue-fictive`)), `${nom} doit être accusé : ${trouves}`);
  }
  // Et aucune issue réelle n'est accusée par l'injection : la garde nomme le défaut, pas tout.
  assert.ok(trouves.every((d) => d.includes('issue-fictive')), `défauts hors injection : ${trouves}`);
});

test('une cause inconnue se DIT inconnue — jamais le silence, jamais la phrase d’une autre issue', () => {
  for (const forme of ['court', 'long']) {
    const texte = motDeLIssue({ cause: 'issue-fictive' }, { forme });
    assert.match(texte, /inconnue « issue-fictive »/);
    for (const [autre, sig] of Object.entries(SIGNATURES)) {
      assert.doesNotMatch(texte, sig, `forme ${forme} : porte la phrase de « ${autre} »`);
    }
  }
  assert.match(motDuRefusDeDelivrance(undefined), INCONNUE, 'herdr : pas de délivrance lisible n’est pas un silence');
  assert.match(motDeLaDelivrance({}, {}), INCONNUE, 'livraison : idem');
  assert.throws(() => motDeLIssue({ cause: 'soumis' }, { forme: 'moyen' }), /forme/);
});

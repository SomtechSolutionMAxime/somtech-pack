// JAMAIS DE SOUMISSION DE LA BOÎTE D'AUTRUI — l'arrêt DURABLE (D-20260921-0003).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// L'ORDRE, ET CE QU'IL A COÛTÉ
//
// Le dirigeant, le 2026-09-21 : « je ne sais pas qui envoie le déblocage des fenêtres de texte mais
// je veux que ça cesse ». Deux mécanismes soumettaient la boîte de saisie d'un autre : le balayeur
// des boîtes oubliées, et la délivrance de `livrer.js` (`delivrerLaBoite`). Les deux ont été
// arrêtés À LA MAIN sur le poste — un correctif LOCAL, que la prochaine installation écrasait.
//
// ⚠️ CE QUE CE FICHIER ÉPROUVE : la règle vit désormais dans le CODE VERSIONNÉ.
//
//   « Un message devant une boîte pleine ATTEND, ou est RENDU À L'EXPÉDITEUR. Il ne soumet jamais. »
//
// ⚠️ ET UN REFUS EXPLICITE, JAMAIS UNE SUPPRESSION SILENCIEUSE. Un dispositif qui ne fait rien et
// ne dit pas qu'il ne fait rien est le défaut qu'on combat : le journal doit continuer de dire
// POURQUOI rien n'est parti. Chaque essai ci-dessous vérifie les DEUX moitiés — la touche n'est
// pas partie, ET la cause est nommée.
//
// La moitié « une installation laisse l'arrêt en place » est éprouvée dans
// `cli/test/l-installation-laisse-larret-de-soumission.test.js`, qui simule l'installation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  delivrerLaBoite,
  ISSUES_DE_DELIVRANCE,
  MOTS_DE_DELIVRANCE,
  motDeLIssue,
  SOUMISSION_DE_LA_BOITE_DAUTRUI_AUTORISEE,
  TOURS_DIMMOBILITE_EXIGES,
} from '../src/delivrance.js';
import { unTourDeBalayage } from '../src/balayage.js';

const TEXTE = 'un texte coincé que son auteur a laissé';
const ecran = (t) => ['x', '─'.repeat(40), `❯ ${t}`, '─'.repeat(40)].join('\n');

/** Une boîte qui reste pleine, immobile — le cas exact que l'ancienne délivrance soumettait. */
function boitePleine() {
  const touches = [];
  return {
    touches,
    entrees: {
      texteCoince: TEXTE,
      commandes: { lireEcran: ['read'], soumettre: ['send-keys', 'Enter'] },
      appelHerdr: async (cmd) => {
        touches.push(cmd);
        return { ok: true };
      },
      lireEcran: async () => ecran(TEXTE),
      dormir: async () => {},
      immobiliteMs: 6000,
      essais: 1,
    },
  };
}

test('une boîte pleine et immobile n’est JAMAIS soumise — refus nommé, aucune touche', async () => {
  const { touches, entrees } = boitePleine();
  const r = await delivrerLaBoite(entrees);
  assert.equal(touches.length, 0, `la touche d’envoi est partie : ${JSON.stringify(touches)}`);
  assert.equal(r.soumis, false);
  assert.equal(r.ok, false, 'un refus n’est pas un succès — l’appelant ne doit pas croire la boîte libre');
  assert.equal(r.cause, 'soumission-interdite', `cause rendue : ${r.cause}`);
});

test('même avec un veto qui autorise, on ne soumet pas — l’arrêt ne dépend pas de la réservation', async () => {
  const { touches, entrees } = boitePleine();
  const r = await delivrerLaBoite({ ...entrees, encoreAutorise: async () => true });
  assert.equal(touches.length, 0);
  assert.equal(r.cause, 'soumission-interdite');
});

test('la boîte que son auteur soumet PENDANT l’attente reste livrable — attendre marche encore', async () => {
  // « ATTEND » n'est pas « refuse toujours » : si l'auteur soumet lui-même, la boîte se vide et le
  // message passe. Retirer la soumission ne doit pas retirer l'attente.
  const { touches, entrees } = boitePleine();
  // (la relecture de la boîte suit l'attente : c'est elle qui voit la boîte vide)
  const r = await delivrerLaBoite({ ...entrees, lireEcran: async () => ecran('') });
  assert.equal(touches.length, 0);
  assert.equal(r.soumis, false);
  assert.equal(r.ok, true, `la boîte s’est vidée d’elle-même : ${JSON.stringify(r)}`);
});

test('un texte qui BOUGE reste refusé pour sa propre cause — le nouveau refus ne masque pas les anciens', async () => {
  const { touches, entrees } = boitePleine();
  let n = 0;
  const r = await delivrerLaBoite({ ...entrees, lireEcran: async () => ecran(`${TEXTE} et la suite ${n++}`) });
  assert.equal(touches.length, 0);
  assert.equal(r.cause, 'bouge');
});

test('la cause est une issue déclarée, et SON mot dit qu’on ne soumet pas — jamais celui d’une autre', () => {
  assert.ok(ISSUES_DE_DELIVRANCE.includes('soumission-interdite'));
  for (const forme of ['court', 'long']) {
    const mot = motDeLIssue({ cause: 'soumission-interdite' }, { forme });
    assert.match(mot, /soumet JAMAIS|soumission/i, `le mot doit nommer la règle : ${mot}`);
    assert.match(mot, /rien soumis|ne soumet/i, `le mot doit dire qu’il n’est rien parti : ${mot}`);
    assert.doesNotMatch(mot, /issue de délivrance inconnue/i, 'une issue sans mot est le défaut que la table interdit');
  }
  assert.equal(typeof MOTS_DE_DELIVRANCE['soumission-interdite'].long, 'function');
});

test('le mot ne prescrit pas d’attendre une réservation — il dit quoi FAIRE : la boîte reste à son auteur', () => {
  const mot = motDeLIssue({ cause: 'soumission-interdite' }, { forme: 'long' });
  assert.doesNotMatch(mot, /réserv/i, 'ce n’est pas une réservation : ne pas confondre avec plus-autorise');
});

test('le BALAYEUR, câblé sur la vraie délivrance, ne soumet rien ET le journal dit pourquoi', async () => {
  const { touches, entrees } = boitePleine();
  const pane = 'w1:p1';
  const journal = [];
  const rendu = await unTourDeBalayage({
    agents: [{ pane, nom: 'a' }],
    lireEcran: async () => ecran(TEXTE),
    delivrer: ({ texteCoince, immobiliteMs }) => delivrerLaBoite({ ...entrees, texteCoince, immobiliteMs }),
    memoire: new Map([[pane, { texte: TEXTE, tours: TOURS_DIMMOBILITE_EXIGES - 1, depuis: 0 }]]),
    maintenant: 600_000,
    journaliser: (l) => journal.push(l),
  });
  assert.equal(touches.length, 0, 'le balayeur a fait partir une touche d’envoi');
  assert.equal(rendu.debloques.length, 0);
  const r = rendu.refus.find((x) => x.pane === pane);
  assert.ok(r, `le balayeur devait tenter, puis refuser : ${JSON.stringify(rendu.refus)}`);
  assert.equal(r.cause, 'soumission-interdite');
  assert.ok(
    journal.some((l) => /NON DÉLIVRÉ/.test(l) && /soumission-interdite/.test(l)),
    `le journal doit dire POURQUOI rien n’est parti — reçu : ${JSON.stringify(journal)}`
  );
});

test('le démarrage du veilleur ARME toujours le balayeur : l’arrêt est dans la délivrance, pas dans un fil coupé', () => {
  // ⚠️ Commenter `v.balayer()` (le geste local d'origine) tuait AUSSI la relance des messages gardés,
  // sans le dire. L'arrêt durable vit dans la délivrance ; le tour, lui, continue et journalise.
  const source = readFileSync(fileURLToPath(new URL('../src/veilleur.js', import.meta.url)), 'utf8');
  const actif = source
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
  assert.match(actif, /\bv\.balayer\(\);/, 'v.balayer() est retiré ou commenté : la relance des messages gardés meurt avec');
});

test('le refus est l’état PAR DÉFAUT du code versionné, et il se lit en UN endroit', () => {
  assert.equal(SOUMISSION_DE_LA_BOITE_DAUTRUI_AUTORISEE, false);
  const source = readFileSync(fileURLToPath(new URL('../src/delivrance.js', import.meta.url)), 'utf8');
  assert.ok(!/process\.env[^\n]*SOUMISSION/i.test(source), 'aucun interrupteur d’environnement : on ne rallume pas ça d’un export');
  // L'arrêt est REVERSIBLE PAR LECTURE : le code qui soumettait reste sous la garde, lisible.
  const debut = source.indexOf('export async function delivrerLaBoite(');
  const fin = source.indexOf('\n}\n', debut);
  const corps = source.slice(debut, fin);
  assert.match(corps, /commandes\.soumettre/, 'le code d’origine doit rester lisible sous la garde');
  assert.match(corps, /SOUMISSION_DE_LA_BOITE_DAUTRUI_AUTORISEE/);
});

test('le balayeur ne PAIE PLUS la fenêtre d’immobilité devant un refus certain — il passe zéro à la délivrance', async () => {
  // Revue de fond : une boîte abandonnée reste candidate à vie ; à 10 s par tentative et 3 tentatives
  // par tour, le tour retardait la relance des messages gardés (qui passe APRÈS lui) pour rien.
  const pane = 'w1:p1';
  const recus = [];
  const rendu = await unTourDeBalayage({
    agents: [{ pane, nom: 'a' }],
    lireEcran: async () => ecran(TEXTE),
    delivrer: async (a) => {
      recus.push(a.immobiliteMs);
      return { ok: false, cause: 'soumission-interdite', soumis: false };
    },
    memoire: new Map([[pane, { texte: TEXTE, tours: TOURS_DIMMOBILITE_EXIGES - 1, depuis: 0 }]]),
    maintenant: 600_000,
  });
  assert.deepEqual(recus, [0], `la délivrance a reçu une fenêtre d’attente : ${JSON.stringify(recus)}`);
  assert.equal(rendu.refus.find((r) => r.pane === pane)?.cause, 'soumission-interdite',
    'le refus reste rendu, nommé — on économise l’attente, pas le mot');
});

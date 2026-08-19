// le-balayeur-ignore-une-suggestion.test.js — LA RONDE NE DOIT RIEN ANNONCER SUR UNE BOÎTE QUI
// N'A JAMAIS RIEN CONTENU (E-20260819-0015).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI EST ÉPROUVÉ ICI, ET POURQUOI ÇA NE L'ÉTAIT PAS
//
// Le balayeur délivre les boîtes oubliées : il soumet, pour son auteur, un texte qui bloque, et
// il en AVERTIT le destinataire — « quelque chose est parti en ton nom ». C'est un geste
// irréversible doublé d'une affirmation.
//
// 🔴 UNE SUGGESTION GRISÉE NE DOIT DÉCLENCHER NI L'UN NI L'AUTRE. Ce que Claude Code propose
// dans une boîte vide n'est pas un texte : il n'y a rien à soumettre, et annoncer un envoi
// serait annoncer un geste qui n'a pas eu lieu, à quelqu'un qui n'a rien perdu.
//
// ⚠️ LA MESURE DIT QUE LE CODE LE FAIT DÉJÀ — et c'est précisément pourquoi cet essai manquait.
// Relevé le 2026-08-19 sur les 94 panes Claude Code du poste : 33 portaient une suggestion, et
// `contenuBoite` rend « vide » sur les 33. **Une garantie que rien n'éprouve n'est pas une
// garantie** : elle tient tant que personne ne touche à la lecture, et le jour où quelqu'un
// retire le `--format ansi` d'un chemin, la ronde se met à soumettre des textes qui n'existent
// pas — sur 33 panes d'un coup, d'après ce même relevé.
//
// ⚠️ ET L'ESSAI ÉPROUVE LES DEUX SENS. Un banc qui ne montrerait que la suggestion serait
// satisfait par un balayeur qui n'annonce JAMAIS rien. Le second cas lui donne donc un vrai
// texte collé, et exige qu'il le traite comme avant.

import test from 'node:test';
import assert from 'node:assert/strict';

import { unTourDeBalayage } from '../src/balayage.js';

const ESC = String.fromCharCode(27);
const SEP = '─'.repeat(20);
const ecran = (ligne) => ['⏺ du travail au-dessus', SEP, ligne, SEP, '  auto mode on'].join('\n');

const ECRAN_SUGGESTION = ecran(`❯ ${ESC}[0m${ESC}[2mmerge la PR 37${ESC}[0m`);
const ECRAN_COLLE = ecran('❯ [Pasted text #116 +15 lines]');

/** Trois passages sur le même écran : c'est ce qu'il faut à la ronde pour juger une boîte figée. */
async function troisTours(ecranFixe) {
  const gestes = [];
  const avis = [];
  let memoire = new Map();
  let dernier = null;
  for (let i = 0; i < 3; i += 1) {
    dernier = await unTourDeBalayage({
      agents: [{ pane: 'w1:p1', nom: 'cible', socket: '/tmp/s.sock' }],
      lireEcran: async () => ecranFixe,
      delivrer: async (d) => {
        gestes.push(d);
        return { ok: true, soumis: true, texte: d.texteCoince, cause: 'soumis' };
      },
      avertir: async (pane, texte) => avis.push({ pane, texte }),
      memoire,
      maintenant: Date.parse('2026-08-19T20:00:00Z') + i * 15 * 60 * 1000,
    });
    memoire = dernier.memoire;
  }
  return { gestes, avis, dernier };
}

test('UNE SUGGESTION NE DÉCLENCHE NI GESTE NI AVIS — rien n’est parti au nom de personne', async () => {
  const { gestes, avis, dernier } = await troisTours(ECRAN_SUGGESTION);
  assert.deepEqual(gestes, [], 'aucune touche d’envoi : il n’y a rien à soumettre');
  assert.deepEqual(avis, [], 'et surtout aucun « quelque chose est parti en ton nom »');
  assert.deepEqual(dernier.debloques, [], 'le compte rendu ne revendique aucun déblocage');
});

test('UN VRAI TEXTE COLLÉ EST TOUJOURS TRAITÉ — la garde ne s’est pas désarmée en gagnant en finesse', async () => {
  // ⚠️ L'AUTRE MOITIÉ, ET C'EST ELLE QUI EMPÊCHE LE CORRECTIF DE DEVENIR UN DÉSARMEMENT.
  // Ignorer une suggestion est sûr ; ignorer un texte réel affamerait tous les émetteurs
  // suivants — le défaut que cette ronde existe pour rompre.
  const { gestes, dernier } = await troisTours(ECRAN_COLLE);
  assert.equal(gestes.length, 1, 'la boîte figée doit être délivrée, une fois');
  assert.equal(gestes[0].texteCoince, '[Pasted text #116 +15 lines]');
  assert.equal(dernier.debloques.length, 1);
});

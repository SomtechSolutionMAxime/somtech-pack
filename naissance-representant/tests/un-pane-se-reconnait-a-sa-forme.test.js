// un-pane-se-reconnait-a-sa-forme.test.js — LA FORME D'UN IDENTIFIANT DE PANE, MESURÉE SUR LE
// POSTE PLUTÔT QUE SUPPOSÉE (E-20260819-0015).
//
// ⚠️ CE QUI A ÉTÉ MESURÉ, ET CE QUE LA FORME SUPPOSÉE EN FAISAIT. Le 2026-08-19, `herdr pane
// list` rendait **213 panes** sur ce poste. La forme attendue jusqu'ici — `w<chiffres>:p<mot>` —
// n'en reconnaissait que **113** : les **100 autres** portent un identifiant en base 36
// (`wQ:p1`, `w2D:pY`, `w1E:pG`), et se faisaient donc prendre pour des NOMS d'agent.
//
// ⚠️ POURQUOI ÇA COMPTE ICI. `etat-boite` s'en sert pour décider s'il peut retomber sur `pane
// read` quand le registre ne connaît personne — c'est-à-dire exactement le cas des agents
// invisibles (`T-20260819-0121`). Sur près d'un pane sur deux, ce repli ne se déclenchait pas,
// et la commande répondait « aucun agent vivant » sur une boîte parfaitement lisible.
//
// La forme ci-dessous n'est pas déduite d'une documentation : elle est tirée des identifiants
// réellement rendus par le poste, et l'essai fixe les deux moitiés — ce qu'elle accepte, et ce
// qu'elle refuse. Sans la seconde, « accepter tout » passerait l'essai.

import test from 'node:test';
import assert from 'node:assert/strict';

import { estUnPane } from '../src/destinataire.js';

test('LES FORMES RÉELLEMENT VUES SUR LE POSTE SONT DES PANES — base 36, pas seulement des chiffres', () => {
  // Relevés le 2026-08-19 dans `herdr pane list` : les deux familles y coexistent.
  for (const p of ['w1:p1', 'w5:p8', 'w10:p62', 'wQ:p1', 'w2D:pY', 'w1E:pG', 'w26:p2K', 'w7M:pB']) {
    assert.equal(estUnPane(p), true, `« ${p} » est un identifiant de pane rendu par ce poste`);
  }
});

test('UN NOM D’AGENT N’EST PAS UN PANE — sinon on cesserait de le chercher au registre', () => {
  // ⚠️ L'AUTRE MOITIÉ. Élargir la forme jusqu'à tout accepter ferait chercher `ristigouche`
  // comme un pane : le nom ne serait plus résolu, et un compte rendu partirait dans le vide.
  // Les noms de ce poste sont des noms de rivière et des codes de ticket — ils ne portent pas
  // les deux points, et c'est ce que l'essai fixe.
  for (const n of ['ristigouche', 'matapedia', 'e-20260819-0015', 'general', 'w5', 'p8', '', 'w5:p8:p9', 'w5-p8']) {
    assert.equal(estUnPane(n), false, `« ${n} » n’est pas un identifiant de pane`);
  }
});

// une-bordure-titree-reste-une-boite.test.js — UNE SESSION RATTACHÉE EST UN ÉTAT NORMAL,
// PAS UN ÉCRAN INCONNU (T-20260821-0025, E-20260821-0003).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QUE ÇA A COÛTÉ, ET CE N'EST PAS UNE GÊNE D'AFFICHAGE
//
// Le dirigeant a écrit « allo » deux fois sur le canal d'un orchestrateur. Aucun des deux
// n'est parti. Il l'a découvert en parlant dans le vide.
//
// La cause, mesurée le 2026-08-21 sur l'écran de `bonaventure` (`w7M:p2`) : sa session est
// RATTACHÉE, donc son filet haut porte le nom de son chantier —
// `─────… CRM ActionProgex finalisation ─────`. La sonde de filet exigeait une ligne faite
// RIEN QUE de caractères de tracé. Elle en trouvait donc UN au lieu de DEUX, ne reconnaissait
// plus la boîte, et rendait `illisible` — c'est-à-dire injoignable, `livrer.js` refusant à
// juste titre d'écrire dans ce qu'il ne voit pas.
//
// ⚠️ LES DEUX FILETS SONT INDISTINGUABLES À L'ŒIL — même longueur, même tracé. Le coordonnateur
// a lu cette bordure de ses propres yeux à 09 h 46 sans faire le lien, et a passé la journée à
// chercher ailleurs. Ce n'est pas de l'inattention : rien à l'écran ne dit que ces deux lignes
// ne sont pas la même chose.
//
// ⚠️ ON RÉPARE LA LECTURE, JAMAIS LE REFUS. Le refus de `livrer.js` — « on ne livre pas dans ce
// qu'on ne voit pas » — est sain, et il a fonctionné. Les essais ci-dessous éprouvent donc les
// DEUX sens : que la bordure titrée redevient lisible, ET que rien de ce que la sonde gardait
// ne se met à passer.

import test from 'node:test';
import assert from 'node:assert/strict';

import { contenuBoite, etatDeLaBoite, ETATS_BOITE, estUnFilet } from '../src/boite.js';
import {
  BORDURE_TITREE,
  BOITE_VIDE,
  BOITE_PLEINE,
  SUGGESTION_GRISEE,
  SHELL_DETACHE,
} from './aide/ecrans-mesures.js';

const FILET_NU = '─'.repeat(60);

test('LE CAS DE RÉFÉRENCE — la boîte de `w7M:p2` cesse d’être illisible', () => {
  // 🔴 L'ESSAI QUI PORTE TOUT LE LOT. Avant correction il rend `illisible` ; c'est la mesure
  // du 2026-08-21, et c'est ce qui rendait `bonaventure` injoignable.
  const vu = etatDeLaBoite(BORDURE_TITREE);
  assert.notEqual(
    vu.etat,
    ETATS_BOITE.ILLISIBLE,
    'une session rattachée est un état NORMAL — la déclarer illisible la rend injoignable'
  );
  // ⚠️ ET SON ÉTAT EXACT EST `suggestion`, PAS `vide` — sa boîte porte un texte GRISÉ, mesuré.
  // Les deux se conduisent pareil (rien à soumettre), et c'est ce qui compte ; mais nommer
  // `vide` un écran qui porte du gris serait remplacer un verdict faux par un autre.
  assert.equal(vu.etat, ETATS_BOITE.SUGGESTION);
  assert.equal(vu.texte, '', 'il n’y a rien à soumettre derrière la suggestion');
});

test('CONTRÔLE POSITIF ET NÉGATIF DE LA SONDE DE FILET — elle doit séparer, pas tout accepter', () => {
  // ⚠️ UNE SONDE QUI REND LA MÊME VALEUR SUR LES DEUX NE MESURE RIEN. C'est la contrainte
  // qui compte le plus sur ce lot : deux instruments aveugles ont été fabriqués en trois
  // heures sur ce sujet précis, et ce sont des valeurs grossièrement identiques qui les ont
  // trahis — pas la discipline de celui qui les écrivait.
  assert.equal(estUnFilet(FILET_NU), true, 'connu-POSITIF : un filet nu reste un filet');
  assert.equal(
    estUnFilet(`${'─'.repeat(70)} CRM ActionProgex finalisation ${'─'.repeat(70)}`),
    true,
    'connu-POSITIF : un filet TITRÉ est un filet — c’est tout l’objet de ce lot'
  );
  assert.equal(
    estUnFilet('Voici une phrase de prose ordinaire qui parle de ─ tirets.'),
    false,
    'connu-NÉGATIF : de la prose n’est pas un filet'
  );
  assert.equal(
    estUnFilet('─── court'),
    false,
    'connu-NÉGATIF : trois tirets suivis d’un mot ne sont pas un filet'
  );
  assert.equal(estUnFilet(''), false, 'connu-NÉGATIF : une ligne vide n’est pas un filet');
});

test('CE QUE LA SONDE GARDAIT CONTINUE D’ÊTRE GARDÉ', () => {
  // ⚠️ LE PIÈGE DE CE LOT : élargir une sonde pour guérir un cas, et laisser passer ce
  // qu'elle empêchait. Une boîte PLEINE déclarée vide ferait écrire par-dessus le message
  // de quelqu'un, et le soumettrait mêlé au nôtre.
  assert.equal(etatDeLaBoite(BOITE_PLEINE).etat, ETATS_BOITE.COLLEE);
  assert.equal(etatDeLaBoite(SUGGESTION_GRISEE).etat, ETATS_BOITE.SUGGESTION);
  assert.equal(etatDeLaBoite(BOITE_VIDE).etat, ETATS_BOITE.VIDE);
  // Un shell n'a pas de boîte de saisie : `illisible` y est le verdict HONNÊTE, et sur les
  // 297 lectures du poste mesurées le 2026-08-21 c'est le cas de 135 des 141 non-lues.
  assert.equal(etatDeLaBoite(SHELL_DETACHE).etat, ETATS_BOITE.ILLISIBLE);
});

test('COUPER LA SONDE — une lecture qui n’a pas eu lieu ne se lit pas « vide »', () => {
  // ⚠️ UN ESSAI QUI COUVRE L'ABSENCE PASSE PARFAITEMENT PENDANT QUE LA MESURE EST AVEUGLE.
  // On fait donc échouer la lecture elle-même, et on exige que le résultat DIFFÈRE de
  // « boîte vide » — le seul état qui autorise à écrire.
  for (const rien of [null, undefined, '']) {
    assert.equal(contenuBoite(rien), null, 'une absence de lecture n’est pas une boîte vide');
    assert.equal(etatDeLaBoite(rien).etat, ETATS_BOITE.ILLISIBLE);
  }
});

test('UN TITRE NE PEUT PAS SERVIR À FAIRE PASSER DU CONTENU POUR UN FILET', () => {
  // ⚠️ LA GARDE NE S'INVERSE PAS. Élargir la sonde pour accepter un titre ouvre la question :
  // une ligne de texte quelconque peut-elle désormais se faire prendre pour un filet, et
  // faire découper la boîte au mauvais endroit ? On exige que la ligne reste MAJORITAIREMENT
  // du tracé — un titre est une incise, pas le contenu de la ligne.
  assert.equal(
    estUnFilet(`──── ${'du texte qui prend toute la place '.repeat(4)}────`),
    false,
    'une ligne surtout faite de texte n’est pas un filet, même bordée de tracé'
  );
});

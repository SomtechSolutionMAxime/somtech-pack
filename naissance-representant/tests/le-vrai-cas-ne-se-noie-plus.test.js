// le-vrai-cas-ne-se-noie-plus.test.js — E-20260821-0001 / T-20260821-0011
//
// CE QUE CES TESTS GARDENT
//
// Le défaut le plus grave du dispositif de réveil n'était pas son COMPTE, c'était sa
// PRÉSENTATION. Mesuré sur son journal — 69 rondes, 486 cibles, 231 non-livraisons :
//
//     98  `agent_prompt_stalled`   ← fabriquées par le dispositif lui-même
//     57  session devant un DIALOGUE   ┐
//     50  boîte de saisie OCCUPÉE      ┘ 107 BLOCAGES RÉELS
//     18  boîte illisible
//      6  statut indisponible
//
// Toutes rangées sous « non livré », toutes lues pareil. Le seul signal qui méritait qu'on se
// lève était indiscernable du bruit — et le risque n'est pas théorique : quelqu'un lit ça,
// conclut que la moitié du parc est morte, et relance ou fait renaître.
//
// ⚠️ ET LE TRI NE DOIT PAS SE FAIRE SUR LA PROSE. Les motifs sont écrits pour un lecteur et
// changent quand on les améliore ; un tri par mots-clés casserait à la première reformulation,
// en SILENCE, en reclassant des blocages réels en bruit. C'est ce que le dernier test vérifie.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CAUSES, CAUSES_REPARATION } from '../src/livraison.js';
import { ACTIVITE } from '../src/activite-session.js';
import {
  FAMILLES,
  ceQuiBloque,
  comptesParFamille,
  familleDeNonLivraison,
} from '../src/familles-de-non-livraison.js';

// ── Les familles, une à une. Chacune existe parce qu'elle appelle une action DIFFÉRENTE.

test('une boîte encombrée est un BLOCAGE — quelqu’un doit poser un geste devant ce pane', () => {
  assert.equal(
    familleDeNonLivraison({ ok: false, cause: CAUSES.ENCOMBREE, activite: { apres: ACTIVITE.REPOS } }),
    FAMILLES.BLOQUE
  );
});

test('un dialogue qui attend un choix est un BLOCAGE — et il ne se lève pas à distance', () => {
  // 57 des 107 blocages réels mesurés. C'est la famille la plus nombreuse, et elle était rangée
  // avec les 98 faux négatifs.
  assert.equal(
    familleDeNonLivraison({ ok: false, cause: CAUSES.DIALOGUE, activite: { apres: ACTIVITE.REPOS } }),
    FAMILLES.BLOQUE
  );
});

test('un pane injoignable n’est pas un agent bloqué — le destinataire n’y est pour rien', () => {
  assert.equal(
    familleDeNonLivraison({ ok: false, cause: CAUSES.ILLISIBLE, activite: { apres: ACTIVITE.REPOS } }),
    FAMILLES.INJOIGNABLE
  );
  assert.equal(
    familleDeNonLivraison({ ok: false, cause: CAUSES.STATUT, activite: { apres: ACTIVITE.REPOS } }),
    FAMILLES.INJOIGNABLE
  );
});

test('une SONDE MUETTE se distingue d’une session qu’on a REGARDÉE et vue au repos', () => {
  // ⚠️ C'EST LA MÊME EXIGENCE QUE LE CRITÈRE 4, PORTÉE JUSQU'AU JOURNAL. Les confondre ferait
  // déclarer « rien à signaler » un agent qu'on n'a pas su regarder — et « rien à signaler »
  // est exactement ce qu'un orchestrateur mort produit.
  const muette = familleDeNonLivraison({ ok: false, cause: null, activite: { apres: ACTIVITE.INDETERMINEE } });
  const regardee = familleDeNonLivraison({ ok: false, cause: null, activite: { apres: ACTIVITE.REPOS } });
  assert.equal(muette, FAMILLES.SONDE_MUETTE);
  assert.equal(regardee, FAMILLES.SANS_PREUVE);
  assert.notEqual(muette, regardee, 'une sonde muette et un repos constaté se lisent pareil');
});

test('un blocage réel l’emporte sur une sonde muette — le geste à poser est le même', () => {
  // ⚠️ L'ORDRE DES QUESTIONS EST LA MOITIÉ DE LA GARDE. Rétrograder un texte coincé en
  // « on n'a pas pu regarder » parce qu'une sonde SECONDAIRE s'est tue le remettrait très
  // exactement là d'où ce lot le sort.
  assert.equal(
    familleDeNonLivraison({ ok: false, cause: CAUSES.ENCOMBREE, activite: { apres: ACTIVITE.INDETERMINEE } }),
    FAMILLES.BLOQUE
  );
});

test('une touche d’envoi déjà partie fait un BLOCAGE — un geste irréversible a eu lieu', () => {
  for (const c of [CAUSES_REPARATION.SOUMISE, CAUSES_REPARATION.ENVOI_REFUSE, CAUSES_REPARATION.DIALOGUE]) {
    assert.equal(
      familleDeNonLivraison({ ok: false, causeRepare: c, activite: { apres: ACTIVITE.REPOS } }),
      FAMILLES.BLOQUE,
      `\`${c}\` doit rester visible : la boîte n’est pas rendue et on y a déjà touché`
    );
  }
});

test('une prise reste une prise', () => {
  assert.equal(familleDeNonLivraison({ ok: true }), FAMILLES.PRIS);
});

test('un résultat absent n’est pas un agent sain — on ne conclut pas d’un rien', () => {
  assert.equal(familleDeNonLivraison(null), FAMILLES.SONDE_MUETTE);
  assert.equal(familleDeNonLivraison(undefined), FAMILLES.SONDE_MUETTE);
});

// ── Le compte, et pourquoi il rend toujours les mêmes clés.

test('le compte rend TOUJOURS les cinq familles, même à zéro', () => {
  // ⚠️ SANS ÇA, « aucun blocage » et « je n'ai pas compté les blocages » se liraient pareil dans
  // le journal — le motif exact de tout ce lot, réinstallé dans le correctif.
  const t = comptesParFamille([]);
  assert.deepEqual(Object.keys(t).sort(), Object.values(FAMILLES).sort());
  for (const v of Object.values(t)) assert.equal(v, 0);
});

test('le compte sépare ce qui appelle une action de ce qui n’en appelle pas', () => {
  const comptes = [
    { famille: FAMILLES.PRIS },
    { famille: FAMILLES.PRIS },
    { famille: FAMILLES.BLOQUE },
    { famille: FAMILLES.SONDE_MUETTE },
    { famille: FAMILLES.SANS_PREUVE },
    { famille: FAMILLES.INJOIGNABLE },
  ];
  const t = comptesParFamille(comptes);
  assert.equal(t[FAMILLES.PRIS], 2);
  assert.equal(t[FAMILLES.BLOQUE], 1);
  // Le total des non-prises reste lisible, mais il n'est PLUS la seule chose qu'on puisse lire.
  const nonPrises = comptes.length - t[FAMILLES.PRIS];
  assert.equal(nonPrises, 4);
  assert.notEqual(t[FAMILLES.BLOQUE], nonPrises, 'le blocage réel doit se distinguer du total');
});

test('un compte sans famille ne se range pas d’office du côté rassurant', () => {
  // Une ligne qui n'a pas été classée n'a rien prouvé. La compter comme « sans preuve » ferait
  // dire « on a regardé » d'un cas qu'on n'a jamais touché.
  assert.equal(comptesParFamille([{}])[FAMILLES.SONDE_MUETTE], 1);
});

// ── Ce qui remonte en tête du journal.

test('ce qui bloque sort en tête, nommément, avec son pane', () => {
  const bloques = ceQuiBloque([
    { agent: 'a', pane: 'w1:p1', famille: FAMILLES.PRIS, motif: null },
    { agent: 'b', pane: 'w2:p2', famille: FAMILLES.BLOQUE, motif: 'sa boîte porte un texte non soumis' },
    { agent: 'c', pane: 'w3:p3', famille: FAMILLES.SONDE_MUETTE, motif: 'pas lu' },
  ]);
  assert.equal(bloques.length, 1);
  assert.equal(bloques[0].agent, 'b');
  assert.equal(bloques[0].pane, 'w2:p2', 'sans le pane, l’avis nomme un blocage sans dire où aller');
  assert.match(bloques[0].motif, /non soumis/);
});

test('une ronde entièrement saine ne remonte rien en tête — on ne crie pas dans le vide', () => {
  // Une garde qui crie à tort se fait couper, et elle emporte ce qu'elle gardait.
  assert.deepEqual(ceQuiBloque([{ famille: FAMILLES.PRIS }, { famille: FAMILLES.PRIS }]), []);
});

// ── LA GARDE DU TRI LUI-MÊME.

test('le tri ne lit PAS la prose du motif — le reformuler ne reclasse rien', () => {
  // ⚠️ LE MODE DE PANNE QUE CE TEST FERME : un tri par mots-clés casse en silence. Les motifs de
  // ce module sont longs, soignés, et réécrits à chaque lot qui les améliore. Le jour où
  // quelqu'un remplace « la boîte de saisie … n'est pas vide » par une autre tournure, un tri
  // par prose reclasserait 50 blocages réels en bruit sans qu'un seul essai bronche.
  const bloque = { ok: false, cause: CAUSES.ENCOMBREE, activite: { apres: ACTIVITE.REPOS } };
  const memeCauseAutreProse = { ...bloque, motif: 'formulation entièrement différente, sans aucun mot commun' };
  const memeCauseSansProse = { ...bloque, motif: null, message: null };
  assert.equal(familleDeNonLivraison(memeCauseAutreProse), FAMILLES.BLOQUE);
  assert.equal(familleDeNonLivraison(memeCauseSansProse), FAMILLES.BLOQUE);

  // Et le symétrique : une prose qui PARLE de blocage sans que la cause le dise ne doit pas
  // fabriquer un blocage. Un tri par mots inventerait ici un cas qui n'existe pas.
  assert.equal(
    familleDeNonLivraison({
      ok: false,
      cause: null,
      activite: { apres: ACTIVITE.REPOS },
      motif: 'la boîte de saisie est encombrée, dialogue, bloqué, texte coincé',
    }),
    FAMILLES.SANS_PREUVE
  );
});

// la-boite-se-trouve-par-son-invite.test.js — CE N'EST PAS LE MULTI-LIGNES QUI CASSE.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260820-0022)
//
// Le défaut a été rapporté comme « un texte multi-lignes rend la boîte `illisible` ». La
// mesure dit autre chose : **un texte de trois lignes se lit parfaitement**. Ce qui casse,
// c'est un TROISIÈME FILET après la boîte — un pied de page encadré.
//
//     [F] ❯ ligne un / ligne deux / ligne trois [F]  auto mode on        -> lu
//     [F] ❯ ligne un / ligne deux / ligne trois [F]  auto mode on   [F]  -> ILLISIBLE
//
// `corpsDeLaBoite` prenait les DEUX DERNIERS filets. Avec un filet de pied de page, la
// « boîte » devenait l'espace entre le bas de la vraie boîte et ce pied — un espace qui ne
// porte pas l'invite `❯`, donc `null`, donc « illisible ».
//
// ⚠️ ET LA CORRÉLATION ÉTAIT TROMPEUSE, ce qui explique le mauvais diagnostic : un texte long
// fait défiler l'écran et fait apparaître un filet de plus. On voyait « multi-lignes » et on
// concluait « le multi-lignes casse ». Deux faits corrélés, cause différente — le motif de
// toute cette nuit.
//
// Le critère juste n'est pas « les deux derniers filets » mais **la dernière paire de filets
// dont la ligne suivante porte l'invite** : c'est ça, une boîte de saisie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contenuBoite, etatDeLaBoite } from '../src/boite.js';

const F = '─'.repeat(40);

test('UN PIED DE PAGE ENCADRÉ NE REND PLUS LA BOÎTE ILLISIBLE', () => {
  const ecran = [F, '❯ ligne un', '  ligne deux', '  ligne trois', F, '  auto mode on', F].join('\n');

  assert.equal(
    contenuBoite(ecran),
    'ligne un\n  ligne deux\n  ligne trois',
    'la boîte est la paire de filets qui porte l’invite, pas la dernière paire de l’écran'
  );
  assert.equal(etatDeLaBoite(ecran).etat, 'saisie', 'un texte bien là ne se rapporte pas « illisible »');
});

test('UNE BOÎTE VIDE SOUS UN PIED DE PAGE ENCADRÉ SE LIT VIDE — pas illisible', () => {
  // ⚠️ LE CAS QUI COÛTE LE PLUS CHER. « Illisible » fait s'abstenir : un émetteur croit la
  // boîte occupée et n'écrit pas, sur une session qui n'attendait que ça. C'est le faux
  // négatif qui met des orchestrateurs en famine devant une boîte libre.
  const ecran = [F, '❯ ', F, '  auto mode on', F].join('\n');

  assert.equal(contenuBoite(ecran), '', 'une boîte vide reste vide, quel que soit ce qui suit à l’écran');
  assert.equal(etatDeLaBoite(ecran).etat, 'vide');
});

test('LE MULTI-LIGNES N’A JAMAIS ÉTÉ LE DÉFAUT — non-régression du diagnostic', () => {
  // On fixe ce que la mesure a établi, pour que personne ne reparte du mauvais diagnostic :
  // trois lignes SANS filet de pied se lisaient déjà parfaitement avant ce correctif.
  const ecran = [F, '❯ ligne un', '  ligne deux', '  ligne trois', F, '  auto mode on'].join('\n');
  assert.equal(contenuBoite(ecran), 'ligne un\n  ligne deux\n  ligne trois');
});

test('UN ÉCRAN SANS AUCUNE INVITE RESTE ILLISIBLE — on ne rend pas « vide » ce qu’on n’a pas su lire', () => {
  // ⚠️ LA MOITIÉ QUI GARDE. Élargir la recherche jusqu'à « prendre la première paire venue »
  // ferait rendre « vide » un écran où l'on n'a rien reconnu — et « vide » autorise à écrire.
  // Un écran qu'on ne sait pas lire doit continuer de faire s'abstenir.
  const ecran = [F, '  du texte sans invite', F, '  auto mode on', F].join('\n');
  assert.equal(contenuBoite(ecran), null, 'aucune paire ne porte l’invite : on ne reconnaît pas de boîte');
  assert.equal(etatDeLaBoite(ecran).etat, 'illisible');
});

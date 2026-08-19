// les-trois-etats-dune-boite.test.js — UNE BOÎTE DE SAISIE A TROIS ÉTATS, ET DEUX SE
// RESSEMBLENT (E-20260819-0015).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE BANC ÉPROUVE, ET CE QUE ÇA A COÛTÉ DE NE PAS L'AVOIR
//
// Le 2026-08-19, DEUX orchestrateurs ont perdu ~3 heures CHACUN, séparément, sur des boîtes
// qu'ils croyaient bloquées. Elles étaient vides : ce qu'ils lisaient était une SUGGESTION
// grisée de Claude Code — le rappel d'un message déjà envoyé, rendu en SGR 2 (dim).
//
// ⚠️ EN TEXTE BRUT, UNE SUGGESTION ET UN TEXTE SAISI SONT LE MÊME ÉCRAN. Aucun des deux ne
// le cherchait, et rien ne les détrompait : `herdr pane read` sans `--format ansi` rend la
// même chose dans les deux cas — et c'est la commande que tout le monde tape.
//
// ⚠️ LES ÉCRANS DE CE BANC NE SONT PAS INVENTÉS. Ils ont été MESURÉS le 2026-08-19 :
//
//   • `vide`, `saisi`, `collé` — fabriqués par exécution sur un pane JETABLE (le collé par
//     un vrai collage : `ESC[200~ … ESC[201~`, seul mode d'arrivée qui produit le repli —
//     une frappe simulée, elle, s'affiche entière, quelle que soit sa longueur) ;
//   • `suggestion` — relevé sur un pane RÉEL du poste (`w7:p1`, l'un des deux orchestrateurs
//     du jour, dont la boîte portait « merge la PR 37 »). Ce qui déclenche l'affichage d'une
//     suggestion n'a PAS pu être reproduit sur un pane neuf : [non établi]. La FORME, elle,
//     est mesurée sur 33 occurrences réelles du même poste, toutes identiques.
//
// ⚠️ ET LA GARDE NE S'INVERSE PAS. Ignorer une suggestion est sûr ; ignorer un vrai texte
// ferait écrire par-dessus le message de quelqu'un. Ce banc éprouve donc les DEUX sens :
// que la suggestion ne compte pas, ET que le collé comme le saisi comptent toujours.

import test from 'node:test';
import assert from 'node:assert/strict';

import { etatDeLaBoite, ETATS_BOITE, contenuBoite } from '../src/boite.js';

const ESC = String.fromCharCode(27);
const SEP = '─'.repeat(60);

/** Un écran de session, avec sa boîte entre les deux derniers filets. */
const ecran = (ligneDeBoite) =>
  ['⏺ un travail quelconque au-dessus', SEP, ligneDeBoite, SEP, '  ⏵⏵ auto mode on'].join('\n');

// ═══ LES QUATRE ÉTATS, OCTET POUR OCTET TELS QUE MESURÉS ═══
const VIDE = ecran('❯ ');
const SAISI = ecran('❯ reste ici');
const COLLE = ecran('❯ [Pasted text #3 +12 lines]');
const SUGGESTION = ecran(`❯ ${ESC}[0m${ESC}[2mmerge la PR 37${ESC}[0m`);
/** La forme des doubles déjà en usage dans ce dépôt — dim fermé par `22m`, pas par `0m`. */
const SUGGESTION_22 = ecran(`❯ ${ESC}[2mignore that, check the staging sas${ESC}[22m`);

test('LA SUGGESTION GRISÉE EST NOMMÉE — et elle ne se lit ni « vide », ni « pleine »', () => {
  const vu = etatDeLaBoite(SUGGESTION);
  assert.equal(vu.etat, ETATS_BOITE.SUGGESTION);
  assert.equal(vu.texte, '', 'il n’y a RIEN à soumettre : pour la conduite, c’est une boîte vide');
  assert.equal(
    vu.suggestion,
    'merge la PR 37',
    'et on rend le texte vu — sans lui, le lecteur qui a l’écran devant les yeux ne se croit pas'
  );
  assert.equal(etatDeLaBoite(SUGGESTION_22).etat, ETATS_BOITE.SUGGESTION, 'l’autre fermeture aussi');
});

test('UNE BOÎTE VRAIMENT VIDE N’EST PAS UNE SUGGESTION — on éprouve l’ABSENCE, pas seulement la présence', () => {
  const vu = etatDeLaBoite(VIDE);
  assert.equal(vu.etat, ETATS_BOITE.VIDE);
  assert.equal(vu.suggestion, null, 'ne pas nommer une suggestion qui n’existe pas');
});

test('UN TEXTE COLLÉ RESTE UNE BOÎTE PLEINE — la garde ne se désarme pas en gagnant en finesse', () => {
  const vu = etatDeLaBoite(COLLE);
  assert.equal(vu.etat, ETATS_BOITE.COLLEE);
  assert.equal(vu.texte, '[Pasted text #3 +12 lines]');
});

test('UN TEXTE SAISI EN CLAIR RESTE UNE BOÎTE PLEINE', () => {
  const vu = etatDeLaBoite(SAISI);
  assert.equal(vu.etat, ETATS_BOITE.SAISIE);
  assert.equal(vu.texte, 'reste ici');
});

test('UN ÉCRAN QU’ON N’A PAS SU LIRE SE DIT — jamais « vide »', () => {
  assert.equal(etatDeLaBoite('rien du tout ici').etat, ETATS_BOITE.ILLISIBLE);
  assert.equal(etatDeLaBoite(null).etat, ETATS_BOITE.ILLISIBLE);
});

test('LE GRIS D’AILLEURS SUR L’ÉCRAN NE FAIT PAS UNE SUGGESTION — c’est la BOÎTE qu’on regarde', () => {
  // Le pied de page de Claude Code est lui-même grisé (« ⏵⏵ auto mode on » l'est sur le poste
  // mesuré). Une garde qui chercherait `ESC[2m` n'importe où sur l'écran déclarerait donc une
  // suggestion sur TOUTES les sessions du poste — et, pire, sur celles dont la boîte porte un
  // vrai texte. Elle ferait alors écrire par-dessus le message de quelqu'un : très exactement
  // l'inversion de garde que ce lot a pour consigne de ne pas commettre.
  const avecPiedGrise = [
    '⏺ un travail au-dessus',
    SEP,
    '❯ reste ici',
    SEP,
    `  ${ESC}[2m⏵⏵ auto mode on${ESC}[0m`,
  ].join('\n');
  const vu = etatDeLaBoite(avecPiedGrise);
  assert.equal(vu.etat, ETATS_BOITE.SAISIE, 'la boîte porte un vrai texte, et il compte');
  assert.equal(vu.suggestion, null);
});

test('LE LECTEUR D’AVANT NE CHANGE PAS DE RÉPONSE — `contenuBoite` garde ses quatre verdicts', () => {
  // ⚠️ CE BANC AJOUTE UN NOM, IL NE DÉPLACE PAS UNE FRONTIÈRE. Tout ce dépôt décide « livrer
  // ou pas » avec `contenuBoite` ; si l'ajout d'`etatDeLaBoite` changeait l'un de ses verdicts,
  // le lot corrigerait un défaut d'affichage en en ouvrant un de conduite.
  assert.equal(contenuBoite(VIDE), '');
  assert.equal(contenuBoite(SUGGESTION), '', 'une suggestion vaut une boîte vide, et c’est déjà le cas');
  assert.equal(contenuBoite(COLLE), '[Pasted text #3 +12 lines]');
  assert.equal(contenuBoite(SAISI), 'reste ici');
  assert.equal(contenuBoite('rien du tout ici'), null);
});

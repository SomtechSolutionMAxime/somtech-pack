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

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE PIÈGE TROUVÉ EN SE SERVANT DE L'OUTIL, une heure après l'avoir écrit
//
// 🔴 CE QUI EST GRIS N'EST PAS TOUJOURS UNE SUGGESTION. Mesuré le 2026-08-19 sur `w0:p1F`
// (`matapedia`), juste après lui avoir livré un message : sa boîte portait
// `❯ ESC[0mESC[2mPress up to edit queued messagesESC[0m` — même attribut, même place, et ce
// n'est PAS une proposition de texte : c'est le marqueur de FILE D'ATTENTE, l'écran qui dit
// que le destinataire est occupé et prendra le message à la fin de son tour.
//
// ⚠️ LA CONDUITE ÉTAIT JUSTE — rien à soumettre dans les deux cas — MAIS LE MOT ÉTAIT FAUX, et
// c'est très exactement le défaut que ce lot existe pour fermer : un outil qui nomme un mauvais
// motif envoie chercher au mauvais endroit. Annoncer « l'éditeur te propose un texte » là où
// l'écran dit « tes messages sont en file » ferait manquer un fait utile — le destinataire est
// occupé, son tour n'est pas fini — et referait à petite échelle les six heures du 19 août.
//
// ⚠️ IL Y A UNE SECONDE RAISON DE LE SÉPARER : la file d'attente est déjà un témoin de PRISE
// dans ce dépôt (`laPriseEstConstatee`). Deux mécanismes qui lisent le même écran doivent en
// dire la même chose, sinon l'un des deux ment.

test('LE MARQUEUR DE FILE D’ATTENTE N’EST PAS UNE SUGGESTION — même gris, autre fait', () => {
  const enFile = ecran(`❯ ${ESC}[0m${ESC}[2mPress up to edit queued messages${ESC}[0m`);
  const vu = etatDeLaBoite(enFile);
  assert.equal(vu.etat, ETATS_BOITE.FILE_DATTENTE, 'le destinataire est occupé, ses messages attendent');
  assert.equal(vu.texte, '', 'et il n’y a toujours rien à soumettre — la conduite ne change pas');
  assert.equal(vu.suggestion, null, 'surtout : on n’annonce pas une proposition de texte qui n’existe pas');
});

test('ET UNE VRAIE SUGGESTION RESTE UNE SUGGESTION — la distinction ne mange pas ce qu’elle sépare', () => {
  assert.equal(etatDeLaBoite(SUGGESTION).etat, ETATS_BOITE.SUGGESTION);
  assert.equal(etatDeLaBoite(SUGGESTION).suggestion, 'merge la PR 37');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA QUESTION D'UNE REVUE INDÉPENDANTE : UN VRAI TEXTE PEUT-IL ÊTRE PRIS POUR DU GRIS ?
//
// La revue a fabriqué un dump où le contenu de la boîte est ENTIÈREMENT encadré par une paire
// `ESC[2m … ESC[22m` — un message urgent qui se lirait alors « rien à soumettre ». Sur un dump
// fabriqué, elle a raison : le lecteur le classerait `suggestion`.
//
// ⚠️ LA MESURE DIT QUE LE TERMINAL NE PRODUIT PAS CE DUMP. Éprouvé le 2026-08-19 sur un pane
// jetable, par exécution : le texte `ESC[2mURGENT: ne merge pas…ESC[22m` déposé par un VRAI
// collage (`ESC[200~ … ESC[201~`) ressort à l'écran **sans aucun attribut** —
// `❯ URGENT: ne merge pas, jai trouve un bug critique` — et le lecteur rend `saisie`, boîte
// pleine. Claude Code n'interprète pas les séquences qu'on lui donne : il rend la boîte
// lui-même, et n'y met du gris que pour ses propres marqueurs.
//
// ⚠️ CE QUE ÇA N'ÉTABLIT PAS : que ce soit vrai de toute version, de tout mode d'arrivée, de
// tout terminal. `[non établi]`. C'est pourquoi cet essai fixe la mesure au lieu de conclure —
// s'il rougit un jour, c'est que le rendu a changé, et la question de la revue redevient ouverte.

test('UN TEXTE RÉEL QUI PORTE DES SÉQUENCES DIM RESTE UNE BOÎTE PLEINE — tel que le terminal le rend', () => {
  // Le dump ci-dessous est recopié de la mesure : ce que l'écran a RÉELLEMENT porté après le
  // collage d'un texte qui contenait `ESC[2m` et `ESC[22m`.
  const rendu = ecran('❯ URGENT: ne merge pas, jai trouve un bug critique');
  const vu = etatDeLaBoite(rendu);
  assert.equal(vu.etat, ETATS_BOITE.SAISIE, 'le terminal a mangé les séquences — le texte compte');
  assert.equal(vu.texte, 'URGENT: ne merge pas, jai trouve un bug critique');
});

test('LE MARQUEUR DE FILE SE CHERCHE DANS LA BOÎTE — pas ailleurs sur l’écran', () => {
  // ⚠️ MÊME PIÈGE QUE LE GRIS, UN CRAN PLUS LOIN. `messagesEnFile` regarde l'écran ENTIER — c'est
  // juste pour son autre emploi (témoin de prise, `laPriseEstConstatee`), et faux ici : les
  // agents de ce dépôt affichent constamment le texte `queued messages` dans leur transcript,
  // puisque c'est le mot que le code lui-même contient. Un écran qui en parle plus haut ferait
  // alors nommer « file d'attente » une boîte qui porte une suggestion — un mauvais motif, sur
  // le chemin même qui existe pour ne plus en donner.
  const transcriptQuiEnParle = [
    '⏺ j’ai corrigé le témoin qui lit « queued messages » dans l’écran',
    SEP,
    `❯ ${ESC}[0m${ESC}[2mmerge la PR 37${ESC}[0m`,
    SEP,
    '  ⏵⏵ auto mode on',
  ].join('\n');
  const vu = etatDeLaBoite(transcriptQuiEnParle);
  assert.equal(vu.etat, ETATS_BOITE.SUGGESTION, 'la BOÎTE porte une suggestion, quoi que dise le transcript');
  assert.equal(vu.suggestion, 'merge la PR 37');
});

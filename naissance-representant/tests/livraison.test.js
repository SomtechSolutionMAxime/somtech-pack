// livraison.test.js — la lecture de la boîte de saisie et le verdict de prise, en isolation.
//
// Les dumps de terminal utilisés ici sont RECOPIÉS de ce que le vrai `herdr agent read` a
// rendu pendant la mesure de T-20260809-0033 — pas inventés. C'est le point où un double
// s'écarte le plus facilement du service qu'il imite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contenuBoite,
  boiteEstVide,
  briefEstPris,
  obstacleAvantLivraison,
  commandesLivraison,
} from '../src/livraison.js';

const SEP = '─'.repeat(40);

/** Un écran tel que le vrai service le rend : transcript au-dessus, boîte en bas. */
const ECRAN_VIDE = ['  ▘▘ ▝▝    ~/.gestionnaire/acme', SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');

const ECRAN_RESTE = ['  ▘▘ ▝▝    ~/.gestionnaire/acme', SEP, '❯ reste ici', SEP, '  ⏵⏵ auto mode on'].join(
  '\n'
);

/** Le cas qui a mordu : le transcript porte DÉJÀ des invites, la boîte est la DERNIÈRE. */
const ECRAN_AVEC_TRANSCRIPT = [
  '❯ dis H',
  '⏺ H',
  '✻ Worked for 1s',
  SEP,
  '❯ reste ici',
  SEP,
  '  ⏵⏵ auto mode on (shift+tab to cycle)',
].join('\n');

const ECRAN_TRAVAILLE = ['❯ dis H', '⏺ H', '✳ Shenaniganing… (11s · ↓ 337 tokens)', SEP, '❯', SEP].join('\n');

test('la boîte est la DERNIÈRE invite de l’écran, pas la première', () => {
  // Lire la première prendrait un message DÉJÀ soumis pour un reste, et refuserait de livrer
  // dans une session parfaitement disponible.
  assert.equal(contenuBoite(ECRAN_AVEC_TRANSCRIPT), 'reste ici');
  assert.equal(contenuBoite(ECRAN_TRAVAILLE), '');
});

test('une boîte vide rend la chaîne vide ; un écran sans invite rend null — ce n’est pas pareil', () => {
  assert.equal(contenuBoite(ECRAN_VIDE), '');
  assert.equal(boiteEstVide(ECRAN_VIDE), true);
  assert.equal(contenuBoite('rien du tout ici'), null);
  assert.equal(boiteEstVide('rien du tout ici'), false, 'illisible n’est pas vide');
  assert.equal(contenuBoite(null), null);
});

test('un reste dans la boîte est lu tel quel', () => {
  assert.equal(contenuBoite(ECRAN_RESTE), 'reste ici');
  assert.equal(boiteEstVide(ECRAN_RESTE), false);
});

// ── Le refus AVANT d'écrire — c'est lui qui empêche la fusion silencieuse.

test('on refuse de livrer dans une boîte qui contient déjà quelque chose', () => {
  const m = obstacleAvantLivraison(ECRAN_RESTE, 'idle');
  assert.ok(m, 'une boîte non vide doit faire refuser la livraison');
  assert.match(m, /reste ici/, 'le message doit montrer ce qui bloque');
  assert.match(m, /coll/, 'et dire pourquoi : les deux textes seraient collés en UN message');
});

test('on refuse aussi de livrer dans une boîte qu’on n’a pas su lire', () => {
  // Une lecture d'écran ratée ne doit jamais passer pour une boîte vide : on livrerait à
  // l'aveugle, ce qui est exactement la situation que ce module existe pour empêcher.
  assert.match(obstacleAvantLivraison(null, 'idle'), /illisible/);
  assert.match(obstacleAvantLivraison('', 'idle'), /illisible/);
});

test('on livre dans une boîte vue vide, et seulement là', () => {
  assert.equal(obstacleAvantLivraison(ECRAN_VIDE, 'idle'), null);
  assert.equal(obstacleAvantLivraison(ECRAN_VIDE, 'done'), null, 'un tour fini rend la boîte');
});

// Relevé en revue de fond (motif 3) — la seconde porte, oubliée à la première écriture.
test('on refuse de livrer à une session qui travaille DÉJÀ — sinon la preuve se prouve elle-même', () => {
  // `briefEstPris` tient `working` pour le témoin qu'une session a pris le brief. Si elle
  // travaillait avant qu'on écrive, ce témoin est vrai sans nous : la commande dirait
  // « livré » sans que rien n'ait été pris.
  const m = obstacleAvantLivraison(ECRAN_VIDE, 'working');
  assert.ok(m, 'une session qui travaille déjà ne peut pas recevoir un brief vérifiable');
  assert.match(m, /working/);
  assert.match(m, /prouve/, 'le message doit dire que c’est la PREUVE qui est en cause');
});

test('on refuse aussi quand l’état de la session est inconnu ou illisible', () => {
  assert.ok(obstacleAvantLivraison(ECRAN_VIDE, 'unknown'));
  assert.ok(obstacleAvantLivraison(ECRAN_VIDE, 'blocked'));
  assert.ok(obstacleAvantLivraison(ECRAN_VIDE, null));
});

// Relevé en revue de fond (motif 1) — la garde s'ancre sur la STRUCTURE, pas sur un caractère.
test('un brief bloqué dans la boîte dont une ligne ne porte qu’un « ❯ » ne passe pas pour une boîte vide', () => {
  // Le cas exact : un brief qui parle de terminaux — il y en a dans ce dépôt même. Avec une
  // lecture ligne-à-ligne, sa dernière ligne « ❯ » se lisait comme une boîte vide, et on
  // écrivait par-dessus : la fusion, reproduite par la garde censée l'empêcher.
  const ecran = [
    '  ▘▘ ▝▝    ~/.gestionnaire/acme',
    SEP,
    '❯ Lis ceci et prepare le rapport. Le pane montre :',
    '❯',
    'Merci.',
    SEP,
    '  ⏵⏵ auto mode on',
  ].join('\n');
  const vu = contenuBoite(ecran);
  assert.notEqual(vu, '', 'cette boîte n’est PAS vide');
  assert.match(vu, /Lis ceci/, 'tout le contenu de la boîte est lu, ses lignes suivantes comprises');
  assert.match(vu, /Merci\./);
  assert.ok(obstacleAvantLivraison(ecran, 'idle'), 'et la livraison doit être refusée');
});

test('un écran sans filets n’est pas une boîte vide — c’est une boîte qu’on n’a pas su lire', () => {
  // Sans les filets, on ne sait pas où commence ni où finit la boîte. Rendre `''` reviendrait
  // à dire « elle est vide, écris dedans » sur la foi d'une structure qu'on n'a pas reconnue.
  assert.equal(contenuBoite(['❯ un brief coince', '❯', 'suite'].join('\n')), null);
  assert.equal(contenuBoite('❯'), null);
});

test('un format d’écran inattendu fait REFUSER, jamais fusionner — c’est le sens sûr', () => {
  const inattendu = [SEP, 'pas d’invite ici du tout', SEP].join('\n');
  assert.equal(contenuBoite(inattendu), null);
  assert.match(obstacleAvantLivraison(inattendu, 'idle'), /illisible/);
});

// ── Le verdict de prise — par le fait, jamais par la réponse de l'outil.

test('le brief est pris quand la session a quitté l’attente', () => {
  assert.equal(briefEstPris({ statut: 'working', terminal: ECRAN_RESTE }), true);
  assert.equal(briefEstPris({ statut: 'done', terminal: ECRAN_RESTE }), true);
});

test('le brief est pris quand la boîte s’est vidée, même si le statut n’a pas encore bougé', () => {
  // Un tour très court peut être fini avant qu'on relise le statut : la boîte vidée en
  // témoigne quand même.
  assert.equal(briefEstPris({ statut: 'idle', terminal: ECRAN_VIDE }), true);
});

test('le brief n’est PAS pris quand il est encore dans la boîte et que rien ne bouge', () => {
  assert.equal(briefEstPris({ statut: 'idle', terminal: ECRAN_RESTE }), false);
  assert.equal(briefEstPris({ statut: null, terminal: ECRAN_RESTE }), false);
});

test('un écran illisible ne témoigne de rien — il ne vaut pas une boîte vidée', () => {
  assert.equal(briefEstPris({ statut: 'idle', terminal: null }), false);
  assert.equal(briefEstPris({ statut: 'unknown', terminal: 'écran perdu' }), false);
});

// ── Les commandes construites.

test('la livraison est un appel NU — l’attente qu’elle portait n’était jamais observée (T-20260821-0009)', () => {
  // ⚠️ CE TEST DISAIT L'INVERSE, ET IL GARDAIT LE DÉFAUT. Sa version d'origine s'intitulait
  // « l'appel nu rend un succès dans TOUS les cas, c'est le défaut » et épinglait
  // `--wait --until working --timeout`. La prémisse a été mesurée fausse le 2026-08-21 :
  //
  //   • `--wait` s'appuie sur `state_change_seq`, mesuré FIGÉ 3 h sur un pane à ~10 transitions
  //   • journal du dispositif, 69 rondes, 486 cibles : 98 des 231 non-livraisons sont des
  //     `agent_prompt_stalled` — des faux négatifs que l'attente FABRIQUAIT elle-même
  //
  // L'appel nu ne « rend pas un succès dans tous les cas » : il ne rend RIEN sur la prise, et
  // c'est très bien — c'est la relecture qui tranche, comme partout ailleurs dans ce module.
  // La preuve de prise vit désormais dans `activite-session.js`, et elle, elle peut survenir.
  const c = commandesLivraison('w9:p1', 'mon brief');
  assert.deepEqual(c.livrer, ['agent', 'prompt', 'w9:p1', 'mon brief']);
  // `--format ansi` depuis T-20260814-0138 : c'est le gris qui distingue une suggestion de
  // l'éditeur d'un vrai reste, et sans lui on refuse de livrer dans une boîte vide.
  assert.deepEqual(c.lireEcran, ['agent', 'read', 'w9:p1', '--format', 'ansi']);
  assert.deepEqual(c.interroger, ['agent', 'get', 'w9:p1']);
  assert.deepEqual(c.soumettre, ['agent', 'send-keys', 'w9:p1', 'Enter']);
});

test('la réparation envoie la touche d’envoi — elle ne RÉÉCRIT jamais le brief', () => {
  // Réécrire collerait le brief à lui-même : c'est le défaut mesuré, à l'identique.
  const c = commandesLivraison('w9:p1', 'mon brief');
  assert.ok(!c.soumettre.includes('mon brief'), 'la réparation ne doit pas transporter le texte');
});

test('un brief vide, ou sans pane, est refusé à la construction', () => {
  assert.throws(() => commandesLivraison('', 'x'), /pane/);
  assert.throws(() => commandesLivraison('w9:p1', '   '), /vide/);
  assert.throws(() => commandesLivraison('w9:p1', null), /vide/);
});


// ═════════════════ CE QUE LA MESURE DU 2026-08-14 A APPRIS (T-20260814-0138)
//
// Une campagne de 25 envois contre le vrai service a établi deux faits que le code ignorait,
// et le second est un défaut de ce module — pas du service.

/**
 * ⚠️ UNE BOÎTE VIDE N'EST PAS UN ÉCRAN VIDE : Claude Code y affiche une SUGGESTION GRISÉE,
 * tirée de l'historique de la session, que rien ne distingue d'un vrai contenu en texte brut.
 *
 * Mesuré : un agent jetable qui n'avait jamais rien reçu affichait « ignore that, check the
 * staging sas on this repo » — la suggestion d'une AUTRE session. En `--format text`, on lit
 * donc « la boîte contient quelque chose » sur une boîte parfaitement vide, et on REFUSE de
 * livrer alors que tout va bien. La mesure elle-même s'y est fait prendre une fois.
 *
 * Le seul discriminant est le rendu : la suggestion est en dim (SGR 2). On lit donc l'écran en
 * `--format ansi`, et ce qui est grisé ne compte pas comme un contenu.
 */
const ESC = String.fromCharCode(27);
const DIM = (s) => `${ESC}[2m${s}${ESC}[22m`;
const GRAS = (s) => `${ESC}[1m${s}${ESC}[22m`;
const ECRAN_SUGGESTION = [
  '  ▘▘ ▝▝    ~/.gestionnaire/acme',
  SEP,
  `❯ ${DIM('ignore that, check the staging sas on this repo')}`,
  SEP,
  '  ⏵⏵ auto mode on',
].join('\n');

/** Un vrai reste, lui, n'est PAS grisé — et il doit continuer d'être vu. */
const ECRAN_RESTE_ANSI = [
  '  ▘▘ ▝▝    ~/.gestionnaire/acme',
  SEP,
  `❯ ${GRAS('[Pasted text #56][Pasted text #57 +1 lines]')}`,
  SEP,
  '  ⏵⏵ paste again to expand',
].join('\n');

test('UNE SUGGESTION GRISÉE N’EST PAS UN RESTE — sinon on refuse de livrer dans une boîte vide', () => {
  assert.equal(
    contenuBoite(ECRAN_SUGGESTION),
    '',
    'la boîte est VIDE : ce qui est grisé est une proposition de l’éditeur, pas du texte saisi'
  );
});

test('UN VRAI RESTE RESTE VU, ansi ou pas — la garde ne se désarme pas en gagnant en finesse', () => {
  assert.equal(contenuBoite(ECRAN_RESTE_ANSI), '[Pasted text #56][Pasted text #57 +1 lines]');
  assert.equal(contenuBoite(ECRAN_RESTE), 'reste ici', 'et le format texte d’avant continue de se lire');
});

test('L’ÉCRAN EST DEMANDÉ EN ANSI — sans quoi le gris n’arrive jamais jusqu’ici', () => {
  // La finesse ci-dessus ne sert à rien si la commande demande du texte brut : le dump ne
  // porterait plus la marque qui distingue une suggestion d'un reste, et on retomberait sur
  // le refus injustifié. La preuve est donc dans la COMMANDE construite, pas dans un dump.
  const c = commandesLivraison('w1:p1', 'coucou');
  assert.deepEqual(c.lireEcran, ['agent', 'read', 'w1:p1', '--format', 'ansi']);
});

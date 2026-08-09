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

test('la livraison porte --wait : l’appel nu rend un succès dans TOUS les cas, c’est le défaut', () => {
  const c = commandesLivraison('w9:p1', 'mon brief', { attenteMs: 12345 });
  assert.deepEqual(c.livrer, [
    'agent', 'prompt', 'w9:p1', 'mon brief', '--wait', '--until', 'working', '--timeout', '12345',
  ]);
  assert.deepEqual(c.lireEcran, ['agent', 'read', 'w9:p1']);
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

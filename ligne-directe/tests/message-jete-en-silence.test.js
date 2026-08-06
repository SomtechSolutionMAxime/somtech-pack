// Le septième chemin de non-remise — celui que personne n'avait compté.
//
// Un message qui arrive avec un SOUS-TYPE (`file_share`, c'est-à-dire une pièce jointe) ou
// dont le texte est VIDE était jeté au filtrage : pas remis à l'agent, pas répondu à celui
// qui l'a écrit, pas même journalisé. Silence total, dans les trois directions à la fois.
//
// C'est exactement ce que RA-REL-009 existe pour tuer : « un message adressé à une ligne et
// qui n'est pas remis à son destinataire laisse une trace lisible, et celui qui l'a écrit
// l'apprend — quelle qu'en soit la raison ». Le lot précédent avait fermé le chemin du refus
// d'autorisation, qui était le seul connu ; celui-ci était invisible.
//
// Ce qui rend le défaut coûteux plutôt que théorique : **un client qui signale un problème
// envoie une capture d'écran avant d'écrire trois phrases.** Ce client déposait son image,
// ne recevait rien, et l'agent ignorait qu'on lui avait parlé.
//
// LE COMPTE DES CHEMINS EST TENU ICI, et il l'est en négatif : les sous-types qui ne sont PAS
// une parole (une entrée dans le canal, une modification, un message de robot) doivent rester
// silencieux. Ne vérifier que le cas qui passe laisserait ouvrir la porte à tout.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let Veilleur, sauverRegistre, CHEMIN_JOURNAL;
let racine;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-silence-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, CHEMIN_JOURNAL } = await import('../src/registre.js'));
});

beforeEach(() => {
  sauverRegistre({ version: 1, lignes: [] });
  writeFileSync(CHEMIN_JOURNAL, ''); // chaque test lit SON journal, pas celui du précédent
});

const journal = () => (existsSync(CHEMIN_JOURNAL) ? readFileSync(CHEMIN_JOURNAL, 'utf8') : '');

function slackDouble() {
  return {
    postes: [],
    telecharges: [],
    async poster(_j, m) {
      this.postes.push(m);
      return '1';
    },
    async nomDeMembre() {
      return 'Jean Tremblay';
    },
    async membresDuCanal() {
      return ['UCLIENT'];
    },
    async telechargerFichier(_j, fichier) {
      this.telecharges.push(fichier);
      return { octets: Buffer.from('des pixels'), mime: 'image/png' };
    },
  };
}

function herdrDouble() {
  return {
    remis: [],
    async vivant() {
      return true;
    },
    async remettre(pane, texte) {
      this.remis.push({ pane, texte });
      return {};
    },
    async agents() {
      return [{ agent: 'claude', pane_id: 'w1:p1' }];
    },
  };
}

let compteur = 0;
const veilleur = (opts = {}) =>
  new Veilleur({
    cheminSocket: join(racine, `${(compteur += 1)}.sock`),
    jetons: { robot: 'x', ecoute: 'y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    ...opts,
  });

const ligne = (sur = {}) => ({
  chantier: 'D-20260805-0005',
  canal_id: 'C1',
  canal_nom: 'client-acme',
  pane: 'w1:p1',
  worktree: '/w/a',
  visage: '🧭',
  ouverte_le: 'hier',
  close_le: null,
  herdr_socket: null,
  nature: 'client',
  libelle: 'Espace Acme',
  autorises: ['UCLIENT'],
  ...sur,
});

/** Ce que Slack envoie vraiment quand quelqu'un dépose un fichier dans un canal. */
const capture = (sur = {}) => ({
  id: 'F1',
  name: 'capture.png',
  mimetype: 'image/png',
  filetype: 'png',
  size: 2048,
  url_private_download: 'https://files.slack.invalide/files-pri/T1-F1/download/capture.png',
  ...sur,
});

const trame = (ev) => ({ data: JSON.stringify({ type: 'events_api', payload: { event: ev } }) });
const muet = { send() {} };

// ═══════════════════════════════════════ T-20260806-0104 — le message porteur d'une pièce

test('UNE CAPTURE D’ÉCRAN N’EST PLUS JETÉE AU FILTRAGE — le message atteint l’agent', async () => {
  // Le cas nominal du client qui signale un problème. Aujourd'hui : rien n'arrive, nulle part.
  const s = slackDouble();
  const h = herdrDouble();
  const v = veilleur({ slack: s, herdr: h });
  v.registre.lignes.push(ligne());

  await v.surMessage(
    trame({
      type: 'message',
      subtype: 'file_share',
      channel: 'C1',
      user: 'UCLIENT',
      text: 'voilà ce que je vois',
      files: [capture()],
    }),
    muet
  );

  assert.equal(h.remis.length, 1, 'un message porteur d’une pièce jointe doit être remis');
  assert.ok(h.remis[0].texte.includes('voilà ce que je vois'), 'le texte du client doit arriver intact');
});

test('UN MESSAGE VIDE laisse une trace ET son auteur l’apprend — jamais le silence', async () => {
  // RA-REL-009 sans exception : le contenu inexploitable est une autre question que le silence.
  const s = slackDouble();
  const h = herdrDouble();
  const v = veilleur({ slack: s, herdr: h });
  v.registre.lignes.push(ligne());

  await v.surMessage(trame({ type: 'message', channel: 'C1', user: 'UCLIENT', text: '   ' }), muet);

  assert.equal(h.remis.length, 0, 'il n’y a rien à remettre');
  assert.equal(s.postes.length, 1, 'celui qui a écrit doit l’apprendre');
  assert.match(journal(), /vide/i, 'la non-remise doit laisser une trace lisible');
});

test('LE COMPTE DES CHEMINS — ce qui n’est pas une parole reste silencieux', async () => {
  // Ouvrir le filtre au sous-type `file_share` sans borner l'ouverture ferait remettre à
  // l'agent chaque entrée dans le canal, chaque modification, chaque message de robot — et
  // répondre au client à chacune. On énumère donc ce qui passe, jamais ce qui ne passe pas.
  const s = slackDouble();
  const h = herdrDouble();
  const v = veilleur({ slack: s, herdr: h });
  v.registre.lignes.push(ligne());

  const nonParoles = [
    { subtype: 'channel_join', text: 'a rejoint le canal' },
    { subtype: 'channel_leave', text: 'a quitté le canal' },
    { subtype: 'message_changed', text: 'texte modifié' },
    { subtype: 'message_deleted', text: '' },
    { subtype: 'channel_topic', text: 'a changé le sujet' },
    { subtype: 'bot_message', text: 'je suis un robot' },
  ];

  for (const ev of nonParoles) {
    await v.surMessage(trame({ type: 'message', channel: 'C1', user: 'UCLIENT', ...ev }), muet);
  }

  assert.equal(h.remis.length, 0, 'aucune de ces trames n’est une parole adressée à la ligne');
  assert.equal(s.postes.length, 0, 'et personne n’attend de réponse à une entrée dans un canal');
});

test('UN MESSAGE VIDE D’UN INTRUS reçoit le refus d’autorisation, pas « message vide »', async () => {
  // L'ordre des contrôles se voit ici : dire à quelqu'un que son message était vide alors
  // qu'il n'avait pas le droit d'écrire lui ferait retenter, et lui cacherait la vraie cause.
  const s = slackDouble();
  const h = herdrDouble();
  const v = veilleur({ slack: s, herdr: h });
  v.registre.lignes.push(ligne({ autorises: [] }));
  s.membresDuCanal = async () => ['UCLIENT']; // l'intrus n'appartient pas au canal privé

  await v.surMessage(trame({ type: 'message', channel: 'C1', user: 'U_INTRUS', text: '' }), muet);

  assert.equal(s.postes.length, 1);
  assert.match(s.postes[0].texte, /n’avez pas accès|n'avez pas accès/i, 'la cause dite doit être la vraie');
});

test('UNE PIÈCE SANS UN MOT est tout de même une parole — elle est remise', async () => {
  // Le cas le plus fréquent du client : il dépose sa capture et écrit après. Le texte vide
  // ne doit pas faire passer ce message pour un message sans contenu.
  const s = slackDouble();
  const h = herdrDouble();
  const v = veilleur({ slack: s, herdr: h });
  v.registre.lignes.push(ligne());

  await v.surMessage(
    trame({ type: 'message', subtype: 'file_share', channel: 'C1', user: 'UCLIENT', text: '', files: [capture()] }),
    muet
  );

  assert.equal(h.remis.length, 1, 'une pièce déposée sans texte reste une parole adressée à la ligne');
  assert.equal(s.postes.length, 0, 'et ce n’est pas une non-remise : rien à répondre en propre');
});

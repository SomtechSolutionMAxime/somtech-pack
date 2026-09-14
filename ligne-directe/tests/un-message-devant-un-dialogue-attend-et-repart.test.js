// un-message-devant-un-dialogue-attend-et-repart.test.js — UN AGENT DEVANT UN ÉCRAN DE CHOIX
// RESTE JOIGNABLE DEPUIS SLACK (T-20260818-0067).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT, REMESURÉ LE 2026-09-14
//
// Message Slack → `remettre` refuse AVANT d'écrire, parce que l'écran porte un dialogue (ou
// un écran non reconnu) → le veilleur rendait au dirigeant « Je n'ai pas pu remettre ton
// message à l'agent de <chantier> : … Le geste : va voir l'écran (« herdr agent focus … »),
// réponds au dialogue toi-même, puis renvoie ton message. »
//
// Il est au téléphone : il ne peut ni ouvrir un terminal, ni « renvoyer » un texte qu'il a
// déjà perdu de vue. Et le balayeur ne regarde que les boîtes, jamais l'écran : personne ne
// reprenait la main. « On ne doit jamais être bloqué via le Slack. Sinon on est pris. »
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI NE BOUGE PAS — ET CE BANC LE GARDE AUTANT QUE LE RESTE
//
// L'ABSTENTION. Mesuré le 2026-08-17 : devant « Do you want to proceed? ❯ 1. Yes », un texte
// ordinaire a FAIT EXÉCUTER la commande proposée. On n'écrit donc jamais dans une boîte
// devant un dialogue, on n'appuie jamais Entrée dessus. La preuve d'une abstention ne se lit
// pas dans un état final : elle se lit dans le JOURNAL DES APPELS du faux binaire.
//
// ⚠️ LE DOUBLE EST CELUI DU TRANSPORT, PAS DE `remettre`. Le vrai `herdr.js` lit l'écran et
// décide ; seul le binaire `herdr` sur le PATH est faux. Doubler `remettre` éprouverait le
// double — et c'est précisément la garde de `remettre` que la relance doit réemprunter.

import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';
import { DIALOGUE_ACTIF, SHELL_DETACHE, BOITE_VIDE } from './aide/ecrans-mesures.js';

const UMOI = 'UMOI';
const UDIR = 'UDIR';
const PANE = 'w4:p2';
const TS1 = '1757870000.000100';
const TS2 = '1757870001.000200';
const TS3 = '1757870002.000300';

let bac, etat, pathOriginal, racineOriginale, maisonOriginale;
let Veilleur, sauverRegistre, herdrReel, reponse, ATTENTE_DUREE_MAX_MS;
let compteur = 0;

/**
 * Le faux binaire : il rend l'écran déposé dans `ecran.txt`, journalise CHAQUE appel, et
 * consigne ce qui a franchi la boîte. Après un `agent prompt`, la session quitte l'attente
 * (`working`) — le témoin de prise que le vrai `remettre` sait lire, sans fenêtre de relecture.
 */
function poserLeFauxHerdr() {
  const script = `#!${process.execPath}
const fs = require('fs');
const path = require('path');
const ETAT = ${JSON.stringify(etat)};
const a = process.argv.slice(2);
fs.appendFileSync(path.join(ETAT, 'appels.jsonl'), JSON.stringify(a) + '\\n');
const statutF = path.join(ETAT, 'statut.txt');
const cmd = a.slice(0, 2).join(' ');
if (cmd === 'agent read' || cmd === 'pane read') {
  process.stdout.write(fs.readFileSync(path.join(ETAT, 'ecran.txt'), 'utf8'));
  process.exit(0);
}
if (cmd === 'agent get' || cmd === 'pane get') {
  const statut = fs.existsSync(statutF) ? fs.readFileSync(statutF, 'utf8') : 'idle';
  process.stdout.write(JSON.stringify({ result: { agent: { pane_id: a[2], agent_status: statut } } }));
  process.exit(0);
}
if (cmd === 'agent prompt') {
  fs.appendFileSync(path.join(ETAT, 'recus.jsonl'), JSON.stringify(a.slice(3).join(' ')) + '\\n');
  fs.writeFileSync(statutF, 'working');
  process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', delivered: true, pane_id: a[2] } }));
  process.exit(0);
}
if (cmd === 'agent send-keys') {
  process.stdout.write(JSON.stringify({ result: { sent: true } }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ error: { code: 'unsupported', message: a.join(' ') } }));
`;
  const bin = join(bac, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'herdr'), script);
  chmodSync(join(bin, 'herdr'), 0o755);
  return bin;
}

function montrer(ecran) {
  writeFileSync(join(etat, 'ecran.txt'), ecran);
  // Une session qui revient à l'écran de saisie est en attente : c'est ce qui rend la prise
  // constatable au prochain `agent prompt`.
  writeFileSync(join(etat, 'statut.txt'), 'idle');
}

const lignesDe = (f) => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const appels = () => lignesDe(join(etat, 'appels.jsonl'));
const recus = () => lignesDe(join(etat, 'recus.jsonl'));
/** Tout geste qui ÉCRIT ou APPUIE — ce qu'on ne doit jamais voir devant un dialogue. */
const gestesQuiEcrivent = () => appels().filter((a) => a[0] === 'agent' && (a[1] === 'prompt' || a[1] === 'send-keys'));

before(async () => {
  bac = mkdtempSync(join(tmpdir(), 'ld-attente-'));
  etat = join(bac, 'etat');
  mkdirSync(etat, { recursive: true });
  pathOriginal = process.env.PATH;
  racineOriginale = process.env.LIGNE_DIRECTE_RACINE;
  maisonOriginale = process.env.HOME;
  // La racine et le foyer sont déplacés AVANT le premier import : les modules les lisent au
  // chargement, et rien de ce banc ne doit toucher `~/.somtech` ni les sessions herdr du poste.
  process.env.LIGNE_DIRECTE_RACINE = join(bac, 'racine');
  process.env.HOME = bac;
  process.env.PATH = `${poserLeFauxHerdr()}:${pathOriginal}`;
  delete process.env.HERDR_SOCKET_PATH;
  ({ Veilleur, ATTENTE_DUREE_MAX_MS } = await import('../src/veilleur.js'));
  ({ sauverRegistre } = await import('../src/registre.js'));
  ({ reponse } = await import('../src/langage.js'));
  herdrReel = await import('../src/herdr.js');
});

after(() => {
  process.env.PATH = pathOriginal;
  if (racineOriginale === undefined) delete process.env.LIGNE_DIRECTE_RACINE;
  else process.env.LIGNE_DIRECTE_RACINE = racineOriginale;
  if (maisonOriginale === undefined) delete process.env.HOME;
  else process.env.HOME = maisonOriginale;
  rmSync(bac, { recursive: true, force: true });
});

beforeEach(() => {
  rmSync(etat, { recursive: true, force: true });
  mkdirSync(etat, { recursive: true });
  montrer(BOITE_VIDE);
});

const LIGNE = {
  chantier: 'j-20260814-0002',
  canal_id: 'C1',
  canal_nom: 'ligne-du-chantier',
  pane: PANE,
  worktree: '/w',
  nature: 'interne',
  libelle: 'j-20260814-0002',
  autorises: [UDIR],
  membres_vus: [UMOI, UDIR],
  visage: '🧭',
  ouverte_le: 'hier',
  close_le: null,
  herdr_socket: null,
};

let enCours = null;
afterEach(async () => {
  if (enCours) await enCours();
  enCours = null;
});

async function monter({ ligne = LIGNE } = {}) {
  sauverRegistre({ version: 1, lignes: [ligne], commun: null, dirigeant: { id: UDIR, courriel: 'd@somtech.ca' } });
  const monde = fauxSlack({
    canaux: [{ id: 'C1', name: 'ligne-du-chantier', is_private: false, membres: [UMOI, UDIR] }],
    utilisateurs: [
      { id: UMOI, name: 'ligne_directe', is_bot: true, team_id: 'T_ESSAIS', profile: {} },
      { id: UDIR, name: 'maxime', team_id: 'T_ESSAIS', profile: { display_name: 'maxime' } },
    ],
    robot: UMOI,
    espace: 'T_ESSAIS',
  }).installer();
  monde.horodatagesConnus = [TS1, TS2, TS3];
  const v = new Veilleur({
    cheminSocket: join(bac, `v-${(compteur += 1)}.sock`),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T_ESSAIS', utilisateur: UMOI },
    // LE VRAI MODULE herdr — seule la présence est doublée, elle ne porte aucune preuve ici.
    herdr: { ...herdrReel, vivant: async () => true },
  });
  await v.ecouterLocal();
  enCours = async () => {
    await v.arreter();
    monde.restaurer();
  };
  return { monde, v };
}

const parole = (texte, ts = TS1, sur = {}) => ({ type: 'message', channel: 'C1', user: UDIR, text: texte, ts, ...sur });
const textes = (monde) => monde.postes.map((p) => String(p.text ?? p.texte ?? ''));

// ═════════════════ (a) DEVANT UN DIALOGUE : GARDÉ, DIT SANS COMMANDE, RIEN ÉCRIT

test('(a) DEVANT UN DIALOGUE — le dirigeant apprend que son message est gardé, sans commande terminal, et rien n’est écrit', async () => {
  montrer(DIALOGUE_ACTIF);
  const { monde, v } = await monter();

  await v.remettreAuChantier(parole('prends l’option B'));

  const dits = textes(monde);
  assert.equal(dits.length, 1, `une réponse, une seule : ${JSON.stringify(dits)}`);
  assert.doesNotMatch(dits[0], /herdr/i, 'aucune commande terminal adressée au dirigeant — il est au téléphone');
  assert.match(dits[0], /gardé/i, 'il doit apprendre que son message est GARDÉ, pas perdu');
  assert.match(dits[0], /rien à renvoyer/i, 'et qu’il n’a rien à refaire');
  assert.match(dits[0], /choix|dialogue/i, 'on nomme ce qu’on a vu : un écran qui attend un choix');
  assert.deepEqual(gestesQuiEcrivent(), [], 'ABSTENTION : aucune écriture, aucune touche devant un dialogue');
  assert.deepEqual(monde.reactions, [], 'rien n’a été pris, donc aucun crochet');
});

// ═════════════════ (b) L'ÉCRAN SE LIBÈRE : UNE PASSE, ET LE MESSAGE PART TEL QUEL

test('(b) L’ÉCRAN SE LIBÈRE — à la passe suivante le message est remis tel quel, par remettre, et le fil l’apprend', async () => {
  montrer(DIALOGUE_ACTIF);
  const { monde, v } = await monter();
  await v.remettreAuChantier(parole('prends l’option B'));
  assert.deepEqual(gestesQuiEcrivent(), []);

  montrer(BOITE_VIDE);
  await v.relancerLesAttentes();

  const r = recus();
  assert.equal(r.length, 1, `remis une fois : ${JSON.stringify(r)}`);
  assert.ok(r[0].includes('prends l’option B'), `le texte du dirigeant arrive intact : ${r[0]}`);
  const dits = textes(monde);
  assert.equal(dits.length, 2, `une annonce de remise, et une seule : ${JSON.stringify(dits)}`);
  assert.match(dits[1], /remis/i, 'le fil apprend la remise');
  assert.doesNotMatch(dits[1], /herdr/i);
  assert.equal(monde.reactions.filter((x) => x.ts === TS1).length, 1, 'la prise constatée pose le crochet sur SON message');

  // Et une seconde passe ne remet rien de plus : la file est vide.
  await v.relancerLesAttentes();
  assert.equal(recus().length, 1, 'remis une fois, jamais deux');
  assert.equal(textes(monde).length, 2, 'aucune annonce de plus');
});

// ═════════════════ (c) TOUJOURS BLOQUÉ : NI ÉCRITURE, NI BRUIT

test('(c) TOUJOURS BLOQUÉ PENDANT PLUSIEURS PASSES — aucune écriture, aucun message Slack de plus', async () => {
  montrer(DIALOGUE_ACTIF);
  const { monde, v } = await monter();
  await v.remettreAuChantier(parole('prends l’option B'));

  for (let i = 0; i < 3; i += 1) await v.relancerLesAttentes();

  assert.deepEqual(gestesQuiEcrivent(), [], 'ABSTENTION maintenue à chaque passe');
  assert.equal(textes(monde).length, 1, 'pas de spam : la seule parole reste l’annonce de mise en attente');
  const lectures = appels().filter((a) => a[1] === 'read').length;
  assert.ok(lectures >= 4, `chaque passe RELIT l’écran (${lectures} lectures) — on ne relance pas à l’aveugle`);
});

// ═════════════════ (d) EXPIRATION : DIT, ET RECOPIÉ

test('(d) EXPIRATION — le message qui n’a pas pu partir est dit ET recopié, jamais abandonné en silence', async () => {
  montrer(DIALOGUE_ACTIF);
  const { monde, v } = await monter();
  await v.remettreAuChantier(parole('prends l’option B\net préviens le client'));

  await v.relancerLesAttentes(Date.now() + ATTENTE_DUREE_MAX_MS + 60_000);

  const dits = textes(monde);
  assert.equal(dits.length, 2, `une annonce d’expiration : ${JSON.stringify(dits)}`);
  assert.ok(dits[1].includes('prends l’option B'), `le texte est recopié : ${dits[1]}`);
  assert.ok(dits[1].includes('et préviens le client'), 'EN ENTIER, pas sa première ligne');
  assert.doesNotMatch(dits[1], /herdr/i);
  assert.deepEqual(gestesQuiEcrivent(), []);

  // Et il n'est plus gardé : l'écran qui se libère ensuite ne le fait pas partir en retard.
  montrer(BOITE_VIDE);
  await v.relancerLesAttentes();
  assert.deepEqual(recus(), [], 'un message expiré et annoncé comme tel ne part plus');
});

// ═════════════════ (e) DEUX MESSAGES : DANS L'ORDRE, SÉPARÉMENT

test('(e) DEUX MESSAGES EN ATTENTE — remis dans l’ordre, un par un, jamais fusionnés', async () => {
  montrer(DIALOGUE_ACTIF);
  const { monde, v } = await monter();
  await v.remettreAuChantier(parole('PREMIER-message', TS1));
  await v.remettreAuChantier(parole('SECOND-message', TS2));
  assert.deepEqual(gestesQuiEcrivent(), []);
  assert.equal(textes(monde).length, 2, 'chacun a son annonce de mise en attente');

  montrer(BOITE_VIDE);
  await v.relancerLesAttentes();

  const r = recus();
  assert.equal(r.length, 2, `deux remises distinctes : ${JSON.stringify(r)}`);
  assert.ok(r[0].includes('PREMIER-message') && !r[0].includes('SECOND-message'), `le premier seul, d’abord : ${r[0]}`);
  assert.ok(r[1].includes('SECOND-message') && !r[1].includes('PREMIER-message'), `le second seul, ensuite : ${r[1]}`);
});

test('(e-bis) UN MESSAGE NEUF NE DOUBLE PAS CEUX QUI ATTENDENT — l’ordre tient même quand l’écran s’est libéré entre deux passes', async () => {
  montrer(DIALOGUE_ACTIF);
  const { v } = await monter();
  await v.remettreAuChantier(parole('ANCIEN', TS1));

  montrer(BOITE_VIDE);
  await v.remettreAuChantier(parole('NEUF', TS2));

  const r = recus();
  assert.equal(r.length, 2, JSON.stringify(r));
  assert.ok(r[0].includes('ANCIEN'), `l’ancien part d’abord : ${JSON.stringify(r)}`);
  assert.ok(r[1].includes('NEUF'));
});

// ═════════════════ (f) ÉCRAN NON RECONNU : MÊME TRAITEMENT, SANS INVENTER DE DIALOGUE

test('(f) ÉCRAN NON RECONNU — gardé de la même façon, abstention intacte, et aucun dialogue inventé', async () => {
  montrer(SHELL_DETACHE);
  const { monde, v } = await monter();

  await v.remettreAuChantier(parole('prends l’option B'));

  const dits = textes(monde);
  assert.equal(dits.length, 1);
  assert.doesNotMatch(dits[0], /herdr/i);
  assert.match(dits[0], /gardé/i);
  assert.doesNotMatch(dits[0], /attend un choix|réponds au dialogue/i, 'on n’a identifié AUCUN dialogue : on ne le dit pas');
  assert.match(dits[0], /reconnais pas/i, 'on dit ce qu’on sait : on ne reconnaît pas cet écran');
  assert.deepEqual(gestesQuiEcrivent(), []);

  await v.relancerLesAttentes();
  assert.deepEqual(gestesQuiEcrivent(), [], 'toujours non reconnu : toujours rien écrit');

  montrer(BOITE_VIDE);
  await v.relancerLesAttentes();
  assert.equal(recus().length, 1, 'reconnu et prêt : il part');
});

// ═════════════════ CONTRE-ÉPREUVE : UN ÉCRAN PRÊT NE MET RIEN EN ATTENTE

test('CONTRE-ÉPREUVE — écran prêt dès le départ : remise directe, aucune mise en attente, aucune annonce', async () => {
  montrer(BOITE_VIDE);
  const { monde, v } = await monter();

  await v.remettreAuChantier(parole('prends l’option B'));

  assert.equal(recus().length, 1, 'remis tout de suite');
  assert.deepEqual(textes(monde), [], 'rien à dire : il a pris, le crochet suffit');
  assert.equal(monde.reactions.length, 1);

  await v.relancerLesAttentes();
  assert.equal(recus().length, 1, 'rien n’attendait, rien ne repart');
});

// ═════════════════ UN MOYEN D'AGIR DEPUIS SLACK : « annule » DANS LE FIL

test('« annule » DANS LE FIL DU MESSAGE — il est retiré, le dirigeant l’apprend, et il ne part jamais', async () => {
  montrer(DIALOGUE_ACTIF);
  const { monde, v } = await monter();
  await v.remettreAuChantier(parole('prends l’option B', TS1));

  await v.remettreAuChantier(parole('annule', TS3, { thread_ts: TS1 }));

  const dits = textes(monde);
  assert.equal(dits.length, 2, JSON.stringify(dits));
  assert.match(dits[1], /retiré/i);
  assert.doesNotMatch(dits[1], /herdr/i);

  montrer(BOITE_VIDE);
  await v.relancerLesAttentes();
  assert.deepEqual(recus(), [], 'ni le message retiré, ni le mot « annule » ne partent chez l’agent');
});

// ═════════════════ (2) PERSONNE N'INTERVIENT : LA RELANCE EST CÂBLÉE AU BALAYEUR

test('CÂBLAGE — la relance tourne toute seule avec le balayeur : personne n’a à l’appeler', async () => {
  montrer(DIALOGUE_ACTIF);
  const { v } = await monter();
  // Le tour des boîtes est neutralisé : ce banc ne pose qu'une question, la relance est-elle
  // branchée sur la ronde qui tourne déjà ?
  v.unTour = async () => ({});
  await v.remettreAuChantier(parole('prends l’option B'));
  montrer(BOITE_VIDE);

  v.balayer(25);
  const limite = Date.now() + 5000;
  while (!recus().length && Date.now() < limite) await new Promise((r) => setTimeout(r, 25));
  clearInterval(v.balayeur);

  assert.equal(recus().length, 1, 'la ronde du balayeur a remis le message gardé, sans qu’on l’appelle');
});

// ═════════════════ LE REGISTRE CLIENT NE NOMME PAS NOS ROUAGES

test('LIGNE CLIENTE — les mots de l’attente n’exposent ni outillage, ni commande', () => {
  for (const cause of ['mise_en_attente', 'attente_pleine', 'remis_apres_attente', 'attente_expiree', 'attente_annulee']) {
    for (const ecran of ['dialogue', 'inconnu']) {
      const client = reponse(cause, 'client', { chantier: 'D-1', pane: PANE, ecran, texte: 'x', pris: true });
      for (const mot of ['pane', 'herdr', 'agent', 'chantier', 'veilleur']) {
        assert.ok(!client.toLowerCase().includes(mot), `${cause} client : « ${mot} » — ${client}`);
      }
      const interne = reponse(cause, 'interne', { chantier: 'D-1', pane: PANE, ecran, texte: 'x', pris: true });
      assert.doesNotMatch(interne, /herdr/i, `${cause} interne : aucune commande terminal au dirigeant — ${interne}`);
    }
  }
});

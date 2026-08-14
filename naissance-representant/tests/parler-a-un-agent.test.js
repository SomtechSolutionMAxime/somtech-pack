// PARLER À UN AGENT — quelle que soit sa session, et quelle que soit la longueur (T-20260814-0138).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI MANQUAIT, ET CE QUE ÇA COÛTAIT
//
// `livrer.js` ferme la porte du BRIEF DE NAISSANCE : il regarde la boîte avant d'écrire, relit
// après, répare le cas connu, et échoue bruyamment sinon. Mais parler à un agent DÉJÀ NÉ —
// transmettre à un pair, relancer quelqu'un, rendre compte à son coordonnateur — se faisait par
// `herdr agent prompt` nu, sans aucune vérification. « Une porte sur deux », onzième occurrence.
//
// Le 2026-08-14, un message d'environ 1500 caractères est resté dans la boîte de saisie de son
// destinataire, rendu `[Pasted text #16]`, jamais soumis. L'appel avait rendu un succès.
// L'expéditeur croyait avoir rendu compte ; le destinataire est resté `idle`, ce qui ne se
// distingue pas d'un agent qui n'a rien à faire. PERSONNE DES DEUX CÔTÉS NE POUVAIT LE SAVOIR.
//
// ⚠️ ET LE REMÈDE EXISTANT NE POUVAIT PAS SERVIR, pour deux raisons mesurées le même jour en
// essayant justement de s'en servir :
//
//   1. IL NE CONNAISSAIT QU'UNE SESSION. `livrer.js` lançait `herdr` sans lui dire à quelle
//      session parler : il cherchait donc le pane dans la SIENNE. Onze sessions tournent sur ce
//      poste — le cas normal est que le destinataire soit ailleurs, et la voie sûre échouait
//      précisément là.
//   2. IL REFUSAIT DE LIVRER À UNE SESSION QUI TRAVAILLE. C'est la bonne prudence pour un brief
//      de naissance, où « la session a quitté l'attente » EST la preuve. C'est rédhibitoire pour
//      un message entre agents : un pair est vivant et occupé la plupart du temps.
//
// LE DOUBLE DE CE FICHIER SIMULE DEUX SESSIONS. Un pane d'une autre session y est INTROUVABLE
// tant qu'on ne présente pas le bon socket — comme le vrai herdr. Sans ça, l'essai aurait été
// structurellement incapable de voir le défaut n° 1, qui est exactement ce qui est arrivé.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(resolve(HERE, '..'), 'bin', 'livrer.js');

let bac;
let pathOriginal;

/** La session d'où part l'appel, et celle où vit le destinataire — deux sockets distincts. */
const SOCKET_ICI = '/tmp/faux-herdr-ici.sock';
const SOCKET_LA_BAS = '/tmp/faux-herdr-la-bas.sock';

/**
 * Un faux herdr qui connaît DEUX sessions.
 *
 * Chaque agent appartient à une session. Une commande qui vise un agent d'une AUTRE session que
 * celle présentée dans `HERDR_SOCKET_PATH` reçoit `agent_not_found` — c'est le comportement du
 * vrai service, et c'est ce qui rend le défaut visible.
 *
 * `agent list` rend les agents de la session présentée, et RIEN d'autre : c'est ce qui oblige
 * l'appelant à balayer les sessions pour retrouver un agent par son nom.
 */
function installerFauxHerdr(scenario = {}) {
  const journal = join(bac, 'appels.jsonl');
  const etat = join(bac, 'scenario.json');
  writeFileSync(journal, '');
  writeFileSync(
    etat,
    JSON.stringify({
      // Les agents du poste : où ils vivent, comment ils s'appellent, ce qu'ils font.
      agents: [
        { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
        { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'idle' },
      ],
      boiteInitiale: '',
      soumetSeule: true,
      ...scenario,
    })
  );
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const sc = JSON.parse(fs.readFileSync(${JSON.stringify(etat)}, 'utf8'));
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify({ args, socket: process.env.HERDR_SOCKET_PATH || null }) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const socket = process.env.HERDR_SOCKET_PATH || null;

/** L'agent visé, s'il est joignable DEPUIS LA SESSION PRÉSENTÉE. */
function vise(cible) {
  return sc.agents.find((a) => (a.pane === cible || a.nom === cible) && a.session === socket) || null;
}
function refus(code) {
  process.stdout.write(JSON.stringify({ error: { code, message: code } }));
  process.exit(1);
}

const promptsPris = passes.filter((p) => p.args[0] === 'agent' && p.args[1] === 'prompt');
const entrees = passes.filter((p) => p.args[0] === 'agent' && p.args[1] === 'send-keys');
const promptFait = promptsPris.length ? promptsPris[0].args : null;

function boite() {
  let b = sc.boiteInitiale;
  if (promptFait) b = sc.soumetSeule ? '' : b + promptFait[3];
  if (entrees.length) b = '';
  return b;
}
function statutDe(a) {
  if (a.statut === 'working') return 'working';           // il travaillait déjà avant nous
  if (promptFait && (sc.soumetSeule || entrees.length)) return 'working';
  return 'idle';
}

if (cmd === 'agent list') {
  process.stdout.write(JSON.stringify({
    result: { agents: sc.agents.filter((a) => a.session === socket).map((a) => ({ agent: 'claude', pane_id: a.pane, name: a.nom, agent_status: statutDe(a) })) },
  }));
  process.exit(0);
}
const cible = args[2];
const a = vise(cible);
if (!a) refus('agent_not_found');

if (cmd === 'agent read') {
  process.stdout.write(['~/quelque-part', SEP, '\\u276f ' + boite(), SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') {
  process.stdout.write(JSON.stringify({ result: { type: 'agent_info', agent: { pane_id: a.pane, name: a.nom, agent_status: statutDe(a) } } }));
  process.exit(0);
}
if (cmd === 'agent prompt') {
  if (!sc.soumetSeule) refus('agent_prompt_stalled');
  process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'working' } } }));
  process.exit(0);
}
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
  return journal;
}

const appels = (journal) =>
  readFileSync(journal, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

function livrer(...args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], {
      stdio: 'pipe',
      env: {
        ...process.env,
        LIVRAISON_ESSAIS: '3',
        LIVRAISON_DELAI_MS: '5',
        LIVRAISON_ATTENTE_MS: '50',
        // L'appelant est dans SA session — celle d'où part le message.
        HERDR_SOCKET_PATH: SOCKET_ICI,
        HERDR_SESSIONS_ESSAIS: [SOCKET_ICI, SOCKET_LA_BAS].join(':'),
      },
    });
    return { code: 0, sortie: JSON.parse(String(stdout)), refus: '' };
  } catch (err) {
    const brut = String(err.stdout || '');
    // Les REFUS partent sur la sortie d'erreur — c'est la convention de ce binaire, et c'est
    // là qu'il faut les lire : les chercher sur stdout ferait passer un refus pour une absence.
    return { code: err.status ?? 1, sortie: brut ? JSON.parse(brut) : null, refus: String(err.stderr || '') };
  }
}

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'parler-agent-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});
after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});
beforeEach(() => mkdirSync(bac, { recursive: true }));

// ═════════════════ 1. LA SESSION DU DESTINATAIRE

test('UN AGENT D’UNE AUTRE SESSION REÇOIT LE MESSAGE — c’est le cas NORMAL, pas le cas limite', async () => {
  // Onze sessions tournent sur ce poste. Chercher le destinataire dans la sienne, c'est ne
  // jamais trouver personne — et le refus qui en sortait parlait d'un statut « — », ce qui
  // envoyait chercher un défaut du côté du destinataire.
  const journal = installerFauxHerdr();
  const r = livrer('w5:p3', '--texte', 'où en es-tu ?');

  assert.equal(r.code, 0, `la livraison doit aboutir : ${r.refus}`);
  assert.equal(r.sortie.ok, true);
  const versLaBas = appels(journal).filter((p) => p.socket === SOCKET_LA_BAS);
  assert.ok(versLaBas.length > 0, 'les appels doivent porter le socket de la session du destinataire');
  assert.ok(
    versLaBas.some((p) => p.args[1] === 'prompt'),
    'et c’est bien LÀ que le message est écrit'
  );
});

test('UN AGENT SE DÉSIGNE PAR SON NOM — personne ne retient les identifiants de pane des autres', async () => {
  const journal = installerFauxHerdr();
  const r = livrer('general', '--texte', 'où en es-tu ?');

  assert.equal(r.code, 0, `la livraison doit aboutir : ${r.refus}`);
  const prompt = appels(journal).find((p) => p.args[1] === 'prompt');
  assert.equal(prompt.args[2], 'w5:p3', 'le nom doit avoir été résolu en son pane');
  assert.equal(prompt.socket, SOCKET_LA_BAS, 'dans sa session à lui');
});

test('UN NOM QUE PERSONNE NE PORTE EST UN REFUS — jamais un envoi dans le vide', async () => {
  installerFauxHerdr();
  const r = livrer('fantome', '--texte', 'tu es là ?');

  assert.equal(r.code, 1, 'le geste est refusé');
  assert.match(r.refus, /fantome/, 'et le refus nomme qui on cherchait');
});

test('DEUX AGENTS DU MÊME NOM SONT UN REFUS — on ne tire pas au sort le destinataire', async () => {
  // Le même nom dans deux sessions est banal : deux chantiers, deux orchestrateurs `general`.
  // Choisir le premier trouvé livrerait un compte rendu au mauvais chantier, en silence.
  installerFauxHerdr({
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'idle' },
      { pane: 'w2:p2', nom: 'general', session: SOCKET_ICI, statut: 'idle' },
    ],
  });
  const r = livrer('general', '--texte', 'où en es-tu ?');

  assert.equal(r.code, 1, 'le geste est refusé');
  assert.match(r.refus, /deux|plusieurs|homonyme/i, 'et le refus dit pourquoi');
});

// ═════════════════ 2. UN PAIR QUI TRAVAILLE RESTE JOIGNABLE

test('UN DESTINATAIRE QUI TRAVAILLE REÇOIT QUAND MÊME — sinon la voie sûre ne sert jamais', async () => {
  // `livrer.js` refusait sur le statut parce que « la session a quitté l'attente » est SA
  // preuve pour un brief de naissance. Un pair, lui, est occupé la plupart du temps : garder ce
  // refus revenait à n'avoir aucune voie vérifiée pour parler à un agent vivant.
  const journal = installerFauxHerdr({
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'working' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'un arbitrage pour toi');

  assert.equal(r.code, 0, `un pair occupé doit rester joignable : ${r.refus}`);
  assert.ok(
    appels(journal).some((p) => p.args[1] === 'prompt'),
    'le message doit avoir été écrit'
  );
});

test('MAIS UNE BOÎTE QUI CONTIENT DÉJÀ QUELQUE CHOSE RESTE UN REFUS — deux textes collés font UN message', async () => {
  // NON-RÉGRESSION, et c'est la garde à ne pas perdre en assouplissant la précédente. Écrire
  // par-dessus un reste ne livre pas deux messages : il en livre un seul, les deux textes
  // aboutés, et le destinataire lit un mélange dont personne ne sait qu'il en est un.
  installerFauxHerdr({ boiteInitiale: 'un début de phrase qu’un humain avait tapé' });
  const r = livrer('w5:p3', '--texte', 'mon message à moi');

  assert.equal(r.code, 1, 'le geste est refusé');
  assert.match(r.refus, /bo[iî]te/i, 'et le refus dit ce qu’il a vu');
});

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
      // `enterInoperant` : la touche d'envoi ne débloque rien — la course peut se rejouer.
      enterInoperant: false,
      // `metEnFile` : le destinataire travaille, le message part en FILE D'ATTENTE — mesuré sur
      // le vrai service le 2026-08-15. La boîte reste vide et l'écran porte le marqueur.
      metEnFile: false,
      // `fileDejaPleine` : il avait DÉJÀ des messages en file avant qu'on arrive. Le marqueur
      // est alors présent des deux côtés de l'envoi : il ne peut plus rien témoigner.
      fileDejaPleine: false,
      // `refuseMaisEnFile` : l'appel se rapporte en ÉCHEC alors que le message EST parti en
      // file. Seul cas où le marqueur est la SEULE preuve disponible — le statut ne bouge pas
      // (il travaillait déjà) et la boîte est vide des deux côtés de l'envoi.
      refuseMaisEnFile: false,
      // `envoiCasse` : l'appel d'envoi échoue franchement, sans jamais toucher la boîte.
      envoiCasse: false,
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
  // Un message mis en file NE PASSE PAS par la boîte : elle reste telle qu'elle était.
  if (sc.envoiCasse || sc.metEnFile || sc.refuseMaisEnFile) return b;
  if (promptFait) b = sc.soumetSeule ? '' : b + promptFait[3];
  if (entrees.length && !sc.enterInoperant) b = '';
  return b;
}
function statutDe(a) {
  if (a.statut === 'working') return 'working';           // il travaillait déjà avant nous
  if (!sc.envoiCasse && promptFait && (sc.soumetSeule || (entrees.length && !sc.enterInoperant))) return 'working';
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
  // LE MARQUEUR EST EN GRIS, comme le vrai — c'est ce qui empêche de le confondre avec un
  // reste, et c'est aussi ce qui oblige à le chercher AVANT le filtrage du gris.
  const enFile = sc.fileDejaPleine || ((sc.metEnFile || sc.refuseMaisEnFile) && promptFait);
  const marqueur = enFile ? '\\u001b[2mPress up to edit queued messages\\u001b[22m' : '';
  process.stdout.write(['~/quelque-part', SEP, '\\u276f ' + boite(), SEP, marqueur, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') {
  process.stdout.write(JSON.stringify({ result: { type: 'agent_info', agent: { pane_id: a.pane, name: a.nom, agent_status: statutDe(a) } } }));
  process.exit(0);
}
if (cmd === 'agent prompt') {
  if (sc.envoiCasse) refus('agent_prompt_failed');
  // MESURÉ : sur un agent DÉJÀ au travail, l'attente guette une transition vers « working »
  // qui ne peut pas se produire, et elle expire. Le message, lui, est bien parti.
  if (sc.metEnFile && args.includes('--until') && args.includes('working')) refus('timeout');
  // L'appel échoue APRÈS que le texte soit passé — herdr n'a pas su le confirmer. Le message
  // est en file quand même : le cas que le marqueur, et lui seul, sait rattraper.
  if (sc.refuseMaisEnFile) refus('agent_prompt_stalled');
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
        // Le temps laissé à un texte coincé pour bouger avant qu'on le tienne pour immobile
        // (T-20260816-0114). CINQ MINUTES en vrai — ici de quoi ne pas faire durer un essai.
        LIVRAISON_IMMOBILITE_MS: '5',
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
  //
  // ⚠️ ON A DÉSIGNÉ PAR LE NOM, et c'est le nom qui est ambigu : il n'y a donc RIEN à conseiller
  // ici. Le refus doit tenir sans inventer de sortie — voir le bloc T-20260816-0034 plus bas,
  // qui est né du cas symétrique où, lui, une sortie existait et n'était pas nommée.
  installerFauxHerdr({
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'idle' },
      { pane: 'w2:p2', nom: 'general', session: SOCKET_ICI, statut: 'idle' },
    ],
  });
  const r = livrer('general', '--texte', 'où en es-tu ?');

  assert.equal(r.code, 1, 'le geste est refusé');
  assert.match(r.refus, /deux agents ou plus répondent à « general »/, 'le refus nomme la cible ambiguë');
  assert.match(r.refus, /w5:p3/, 'et montre le premier candidat');
  assert.match(r.refus, /w2:p2/, 'et le second — c’est ce qui rend l’ambiguïté vérifiable');
  assert.match(r.refus, /même nom/i, 'il dit POURQUOI le nom ne départage pas');
  assert.match(r.refus, /Rien n[’']a été envoyé\./, 'et que le message n’est parti nulle part');
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

test('MAIS UNE BOÎTE QU’ON N’A PAS SU LIBÉRER RESTE UN REFUS — deux textes collés font UN message', async () => {
  // NON-RÉGRESSION, et c'est la garde à ne pas perdre en assouplissant la précédente. Écrire
  // par-dessus un reste ne livre pas deux messages : il en livre un seul, les deux textes
  // aboutés, et le destinataire lit un mélange dont personne ne sait qu'il en est un.
  //
  // ⚠️ `enterInoperant` — LA DÉLIVRANCE NE DONNE AUCUN DROIT D'ÉCRIRE (T-20260816-0114). Depuis
  // ce lot, un texte coincé IMMOBILE est soumis pour son auteur : le blocage doit finir. Mais
  // quand la touche d'envoi ne libère rien, la boîte reste pleine — et le refus doit alors être
  // exactement celui d'avant. C'est cet essai qui rougirait si « j'ai essayé » devenait un jour
  // une permission d'écrire par-dessus.
  const journal = installerFauxHerdr({
    boiteInitiale: 'un début de phrase qu’un humain avait tapé',
    enterInoperant: true,
  });
  const r = livrer('w5:p3', '--texte', 'mon message à moi');

  assert.equal(r.code, 1, 'le geste est refusé');
  assert.match(r.refus, /bo[iî]te/i, 'et le refus dit ce qu’il a vu');
  assert.ok(
    !appels(journal).some((p) => p.args[1] === 'prompt'),
    'et RIEN n’a été écrit dans la boîte qui n’a pas pu être vidée'
  );
});


// ═════════════════ LE TÉMOIN DU PAIR OCCUPÉ (T-20260814-0138, relevé en REVUE DE FOND)
//
// ⚠️ CE BLOC RÉPARE UN TROU DE COUVERTURE, PAS UN DÉFAUT DU CODE. La revue a muté
// `briefEstPris` pour qu'il rende `true` sans jamais lire la boîte, sur le cas du pair déjà
// `working` : les 179 essais sont restés verts. Le témoin CENTRAL du ticket — celui qui dit
// qu'un message à un pair occupé est bien parti — ne prouvait donc rien en intégration.
//
// C'est la preuve-par-relecture qui manquait à elle-même sur son cas nominal.

test('UN PAIR OCCUPÉ DONT LE MESSAGE RESTE COLLÉ : c’est vu, réparé, et alors seulement rendu', async () => {
  // Le mode de panne mesuré, sur le destinataire le plus fréquent. Le statut ne peut rien dire
  // ici — il valait déjà `working` avant qu'on écrive. Seule la boîte témoigne.
  const journal = installerFauxHerdr({
    soumetSeule: false,
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'working' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'un arbitrage pour toi');

  assert.equal(r.code, 0, `la livraison doit aboutir après réparation : ${r.refus}`);
  assert.equal(r.sortie.repare, true, 'et elle doit DIRE qu’elle a réparé, pas le taire');
  assert.ok(
    appels(journal).some((p) => p.args[1] === 'send-keys'),
    'la soumission calée doit avoir été débloquée'
  );
});

test('UN PAIR OCCUPÉ DONT LA BOÎTE RESTE PLEINE FAIT ÉCHOUER L’ENVOI — jamais un succès muet', async () => {
  // La touche d'envoi ne débloque rien : le double garde la boîte pleine quoi qu'il arrive.
  // Sans ce cas, `briefEstPris` pourrait rendre `true` sans regarder la boîte et personne ne
  // le saurait — c'est très exactement la mutation qui a survécu à la suite entière.
  installerFauxHerdr({
    soumetSeule: false,
    enterInoperant: true,
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'working' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'un arbitrage pour toi');

  assert.equal(r.code, 1, 'le geste doit ÉCHOUER : le message n’est jamais arrivé');
  assert.match(r.refus, /pas été pris|bo[iî]te/i, 'et le refus doit dire ce qu’il a constaté');
});

test('UN APPEL D’ENVOI QUI ÉCHOUE NE PASSE PAS POUR UNE LIVRAISON — la boîte vide ne prouve rien', async () => {
  // ⚠️ SECOND POINT DE LA REVUE. Si l'appel d'envoi échoue sans jamais toucher la boîte, elle
  // est vide avant ET après — et « boîte vide » était compté comme la preuve d'une prise. Une
  // boîte vide parce que rien n'a été écrit est le contraire d'une preuve : c'est l'état par
  // défaut. Le témoin doit être POSITIF quand l'outil dit lui-même que rien n'est parti.
  installerFauxHerdr({
    envoiCasse: true,
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'working' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'un arbitrage pour toi');

  assert.equal(r.code, 1, 'le geste doit ÉCHOUER : rien n’a été écrit nulle part');
});


// ═════════════════ UN MESSAGE MIS EN FILE D'ATTENTE EST UN MESSAGE PRIS (T-20260815-0007)
//
// ⚠️ RÉGRESSION DE `v1.50.0`, TROUVÉE EN PRODUCTION UNE HEURE APRÈS SA PUBLICATION — par cet
// outil lui-même, en rendant compte à un coordonnateur qui travaillait.
//
// Deux causes composées, toutes deux de ce lot :
//   1. `--wait --until working` guette une TRANSITION vers `working` sur un agent qui y est
//      déjà : elle ne peut rien observer, et expire ;
//   2. la garde qui exige un témoin positif quand l'appel dit que rien n'est parti — juste en
//      soi — transformait ce faux négatif en refus, faute d'un témoin disponible sur un pair
//      occupé (le statut ne bouge pas, la boîte est vide PARCE QUE le message est parti).
//
// Le geste touché est celui par lequel un chef d'équipe rend compte, et un pair est occupé la
// plupart du temps. Un orchestrateur qui croit son message perdu le renvoie — donc rejoue le
// défaut que ce lot venait de fermer.

test('UN DESTINATAIRE OCCUPÉ MET LE MESSAGE EN FILE — et c’est une prise, pas un échec', async () => {
  const journal = installerFauxHerdr({
    metEnFile: true,
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'working' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'mon compte rendu de fin de lot');

  assert.equal(r.code, 0, `le message est arrivé : le dire perdu est un mensonge — ${r.refus}`);
  assert.ok(
    !appels(journal).some((p) => p.args[1] === 'send-keys'),
    'et rien à réparer : la boîte est vide parce que le message en est sorti'
  );
});

test('ON NE DEMANDE PAS UNE ATTENTE QUI NE PEUT RIEN OBSERVER — pas d’`--until working` sur un agent qui y est déjà', async () => {
  // La cause première, prise à sa racine plutôt qu'à sa conséquence : demander à herdr de
  // guetter une transition impossible garantit un timeout à chaque envoi à un pair au travail.
  const journal = installerFauxHerdr({
    metEnFile: true,
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'working' },
    ],
  });
  livrer('w5:p3', '--texte', 'mon compte rendu de fin de lot');

  const envoi = appels(journal).find((p) => p.args[1] === 'prompt');
  assert.ok(envoi, 'le message doit avoir été envoyé');
  assert.ok(
    !(envoi.args.includes('--until') && envoi.args.includes('working')),
    'sur un destinataire déjà `working`, cette attente ne peut rien observer — ne pas la demander'
  );
});

test('UNE FILE DÉJÀ PLEINE AVANT L’ENVOI NE TÉMOIGNE DE RIEN — le marqueur doit être APPARU', async () => {
  // ⚠️ LE PIÈGE DE CE TÉMOIN, et il est le même que celui du reste du lot : le marqueur ne
  // prouve que s'il POUVAIT être absent. Un destinataire qui avait déjà des messages en file
  // le porte avant qu'on écrive — s'en contenter, c'est retrouver « la boîte vide » sous un
  // autre nom : un état vrai de toute façon.
  installerFauxHerdr({
    envoiCasse: true,
    fileDejaPleine: true,
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'working' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'mon compte rendu de fin de lot');

  assert.equal(r.code, 1, 'rien n’a été écrit, et un marqueur déjà là ne le rachète pas');
});


test('L’APPEL SE RAPPORTE EN ÉCHEC ALORS QUE LE MESSAGE EST EN FILE — le marqueur est la SEULE preuve, et il suffit', async () => {
  // ⚠️ RELEVÉ EN REVUE DE FOND, ET C'EST LE MOTIF DE CE DÉPÔT REJOUÉ CHEZ MOI. Les deux essais
  // écrits pour ce ticket passaient sans que le nouveau témoin serve à rien : dans leurs
  // montages, la boîte est vide après la mise en file, donc le témoin PRÉEXISTANT (« la boîte
  // est vide ») donnait déjà la bonne réponse. Neutraliser entièrement `messagesEnFile`
  // laissait les douze essais verts — exactement ce que le lot précédent avait payé.
  //
  // Ce scénario-ci isole le témoin : l'appel se rapporte en ÉCHEC (donc « boîte vide » ne vaut
  // plus preuve, c'est la garde de la revue précédente), le destinataire travaillait déjà (donc
  // le statut ne dit rien), et le message est pourtant parti. Il ne reste que le marqueur.
  installerFauxHerdr({
    refuseMaisEnFile: true,
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'working' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'mon compte rendu de fin de lot');

  assert.equal(r.code, 0, `le message est en file : le dire perdu serait faux — ${r.refus}`);
});


// ═════════════════ UN REFUS QUI RENVOIE AU GESTE QUI VIENT D'ÉCHOUER (T-20260816-0034)
//
// ⚠️ LE REFUS ÉTAIT JUSTE ; SON CONSEIL ÉTAIT INAPPLICABLE. Deux sessions du poste peuvent
// porter le MÊME identifiant de pane — `w5:p3` chez l'un et chez l'autre : c'est une coordonnée
// interne à une session, pas une adresse du poste. Le refus des homonymes répondait alors
// « désigne-le par son pane », c'est-à-dire exactement ce que l'expéditeur venait de faire.
//
// Or la sortie EXISTE : `trouverDestinataire` compare la cible au pane ET au nom. Quand les
// agents trouvés portent des noms distincts, désigner par le nom passe — le refus ne le disait
// pas. Un refus qui tait le seul chemin praticable coûte autant qu'un échec muet : l'expéditeur
// rejoue le même geste, obtient le même refus, et conclut que l'outil est cassé.
//
// ⚠️ ET LA SYMÉTRIE EST LE CŒUR DU LOT : quand les noms ne départagent pas non plus, le refus
// doit TENIR SANS INVENTER DE SORTIE. Conseiller un geste qu'on n'a pas vérifié possible est
// précisément le défaut qu'on ferme — on ne le remplace pas par sa variante polie.

test('DEUX AGENTS SUR LE MÊME PANE : le refus nomme les AGENTS trouvés et la commande qui passe', async () => {
  // `w5:p3` existe dans les deux sessions. Le renvoyer vers son pane, c'est le renvoyer vers ce
  // qui vient d'échouer ; ce qu'il lui faut, c'est le nom — et l'outil le connaît déjà.
  installerFauxHerdr({
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'idle' },
      { pane: 'w5:p3', nom: 'chef-de-lot', session: SOCKET_ICI, statut: 'idle' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'où en es-tu ?');

  assert.equal(r.code, 1, 'le geste reste refusé — on ne tire toujours pas au sort');
  assert.match(r.refus, /general/, 'le refus cite le nom du premier agent trouvé');
  assert.match(r.refus, /chef-de-lot/, 'et celui du second — ce sont eux, la sortie');
  assert.match(
    r.refus,
    /gestionnaire-livrer/,
    'et il montre la FORME de commande qui passe, pas seulement le principe'
  );
  assert.doesNotMatch(
    r.refus,
    /par son pane/,
    'et il ne renvoie plus vers le pane : c’est le geste qui vient d’échouer'
  );
});

test('ET LA REMISE PAR CE NOM ABOUTIT — le refus conseille un chemin qu’on a vérifié praticable', async () => {
  // NON-RÉGRESSION DU CHEMIN CONSEILLÉ. Un refus qui nomme une sortie doit être adossé à un
  // essai qui la parcourt : sans lui, on aurait déplacé le défaut au lieu de le fermer — le
  // conseil serait devenu une affirmation invérifiée de plus.
  const journal = installerFauxHerdr({
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'idle' },
      { pane: 'w5:p3', nom: 'chef-de-lot', session: SOCKET_ICI, statut: 'idle' },
    ],
  });
  const r = livrer('chef-de-lot', '--texte', 'où en es-tu ?');

  assert.equal(r.code, 0, `la remise par le nom doit aboutir : ${r.refus}`);
  const prompt = appels(journal).find((p) => p.args[1] === 'prompt');
  assert.equal(prompt.args[2], 'w5:p3', 'le nom a été résolu en son pane');
  assert.equal(prompt.socket, SOCKET_ICI, 'et dans LA session où vit CE `w5:p3`-là, pas l’autre');
});

test('UN SEUL AGENT RÉPOND AU PANE : rien ne change — le refus ne se met pas en travers du cas normal', async () => {
  // Le cas courant reste le cas courant. Une garde qui s'élargit en resserrant le nominal
  // échange un mode de panne contre un autre.
  const journal = installerFauxHerdr({
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'idle' },
      { pane: 'w2:p2', nom: 'chef-de-lot', session: SOCKET_ICI, statut: 'idle' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'où en es-tu ?');

  assert.equal(r.code, 0, `un pane sans homonyme se livre sans discuter : ${r.refus}`);
  const prompt = appels(journal).find((p) => p.args[1] === 'prompt');
  assert.equal(prompt.args[2], 'w5:p3');
  assert.equal(prompt.socket, SOCKET_LA_BAS, 'dans la session où il vit');
});

test('MÊME PANE ET MÊME NOM : le refus TIENT, et ne propose pas une sortie qui n’existe pas', async () => {
  // ⚠️ LE CAS QUI INTERDIT DE SE CONTENTER D'UN CONSEIL TOUT FAIT. Ici le nom ne lève rien non
  // plus : il n'y a AUCUNE désignation qui départage ces deux-là dans cet outil. Le refus doit
  // le dire, s'arrêter là, et surtout ne pas renvoyer vers le nom — ce serait reproduire, à un
  // mot près, le défaut qu'on est en train de fermer.
  installerFauxHerdr({
    agents: [
      { pane: 'w1:p1', nom: 'ici-meme', session: SOCKET_ICI, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_LA_BAS, statut: 'idle' },
      { pane: 'w5:p3', nom: 'general', session: SOCKET_ICI, statut: 'idle' },
    ],
  });
  const r = livrer('w5:p3', '--texte', 'où en es-tu ?');

  assert.equal(r.code, 1, 'le geste est refusé');
  assert.match(r.refus, /même nom/i, 'le refus dit ce qu’il a constaté');
  assert.match(r.refus, /Rien n[’']a été envoyé\./, 'et que rien n’est parti');
  assert.doesNotMatch(r.refus, /désigne-le/, 'il ne conseille aucun geste : il n’y en a pas');
  assert.doesNotMatch(
    r.refus,
    /--session|--socket|HERDR_SOCKET_PATH/,
    'et il n’invente pas une option que cet outil n’a pas'
  );
});

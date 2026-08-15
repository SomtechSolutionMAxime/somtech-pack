// livrer-bin.test.js — le fichier exécutable réel (bin/livrer.js), avec un FAUX herdr en tête
// de PATH. Aucune vraie session n'est touchée.
//
// LE DOUBLE REPRODUIT CE QUI A ÉTÉ MESURÉ SUR LE VRAI SERVICE, y compris ce qu'il a de
// déroutant — c'est tout l'intérêt (motif 2 du brief de revue, huit occurrences à ce jour) :
//   • `agent read` rend du TEXTE BRUT, pas du JSON ;
//   • `agent prompt` rend un succès MÊME quand la soumission n'est pas partie ;
//   • écrire dans une boîte non vide livre UN message, les deux textes collés ;
//   • `agent send-keys … Enter` soumet ce qui est dans la boîte.
//
// Ce que le double ne peut pas prouver — qu'une VRAIE session exécute le brief — est prouvé
// contre le vrai gestionnaire par `scripts/tests/test-livraison-brief-reel.sh`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(resolve(HERE, '..'), 'bin', 'livrer.js');

let bac;
let pathOriginal;

/**
 * Faux herdr piloté par un scénario sur disque :
 *   boiteInitiale — ce que `agent read` montre au premier appel
 *   soumetSeule   — `agent prompt` soumet-il vraiment, ou laisse-t-il le texte dans la boîte ?
 *   lectureCassee — `agent read` échoue (sortie vide) : la boîte est illisible
 *   statutMuet    — `agent get` reste bloqué sur `idle` : le seul témoin restant est la boîte
 *   dejaOccupee   — la session travaillait DÉJÀ avant qu'on arrive (un autre appelant lui parle)
 */
function installerFauxHerdr(scenario = {}) {
  const journal = join(bac, 'appels.jsonl');
  const etat = join(bac, 'scenario.json');
  writeFileSync(journal, '');
  writeFileSync(
    etat,
    JSON.stringify({ boiteInitiale: '', soumetSeule: true, lectureCassee: false, statutMuet: false, dejaOccupee: false, ...scenario })
  );
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const sc = JSON.parse(fs.readFileSync(${JSON.stringify(etat)}, 'utf8'));
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\u2500'.repeat(20);   // le VRAI filet de l'ecran, pas un tiret ASCII

const promptFait  = passes.find((a) => a[0] === 'agent' && a[1] === 'prompt');
const enterEnvoye = passes.some((a) => a[0] === 'agent' && a[1] === 'send-keys');

// Contenu courant de la boîte, tel que le VRAI service le montrerait.
function boite() {
  let b = sc.boiteInitiale;
  if (promptFait) {
    // Le vrai service COLLE le nouveau texte au reste — il ne le remplace pas.
    if (sc.soumetSeule) b = '';
    else b = b + promptFait[3];
  }
  if (enterEnvoye) b = '';
  return b;
}
function travaille() {
  return Boolean(promptFait) && (sc.soumetSeule || enterEnvoye);
}

if (cmd === 'agent list') {
  // La commande cherche d'abord OÙ vit son destinataire — elle ne suppose plus qu'il est
  // dans sa propre session (T-20260814-0138). Ce double n'en connaît qu'une, et c'est
  // suffisant ici : les sessions multiples sont éprouvées par parler-a-un-agent.test.js.
  process.stdout.write(JSON.stringify({
    result: { agents: [{ agent: 'claude', pane_id: 'w9:p1', name: 'acme', agent_status: sc.dejaOccupee ? 'working' : ((!sc.statutMuet && travaille()) ? 'working' : 'idle') }] },
  }));
  process.exit(0);
}
if (cmd === 'agent read') {
  // TEXTE BRUT — pas de JSON. Un écran cassé ne rend rien du tout.
  if (sc.lectureCassee) { process.stdout.write(''); process.exit(0); }
  process.stdout.write(['~/.gestionnaire/acme', SEP, '\\u276f ' + boite(), SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') {
  process.stdout.write(JSON.stringify({
    result: { type: 'agent_info', agent: { pane_id: args[2], name: 'acme', agent_status: sc.dejaOccupee ? 'working' : ((!sc.statutMuet && travaille()) ? 'working' : 'idle') } },
  }));
  process.exit(0);
}
if (cmd === 'agent prompt') {
  // LE DÉFAUT : succès rendu que la soumission soit partie ou non. Avec --wait, le vrai
  // service sait dire qu'elle a calé — mais il n'est pas toujours écouté, et il se trompe
  // parfois dans l'autre sens (un tour plus court que son échantillonnage).
  if (!sc.soumetSeule) {
    process.stdout.write(JSON.stringify({ error: { code: 'agent_prompt_stalled', message: 'no state change observed' } }));
    process.exit(1);
  }
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
  readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

function livrer(...args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], {
      stdio: 'pipe',
      env: {
        ...process.env,
        LIVRAISON_ESSAIS: '3',
        LIVRAISON_DELAI_MS: '5',
        LIVRAISON_ATTENTE_MS: '50',
        // Les sessions à interroger sont DÉSIGNÉES — la cloison refuse d'énumérer celles du
        // poste sous essais. Onze y tournent avec du travail réel, et un essai qui les balaie
        // rend un verdict qui dépend de ce qui est ouvert au moment où il tourne : la première
        // version de ce fichier a vu « onze agents répondent à w9:p1 », le faux herdr répondant
        // pour chacune (T-20260814-0138).
        HERDR_SESSIONS_ESSAIS: '/tmp/faux-herdr-livrer.sock',
      },
    }).toString();
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.status ?? 1, stdout: (err.stdout ?? '').toString(), stderr: (err.stderr ?? '').toString() };
  }
}

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'smtk-livrer-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});
after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});

test('livrer.js exige un pane et un brief', () => {
  installerFauxHerdr();
  assert.notEqual(livrer().code, 0);
  assert.notEqual(livrer('w9:p1').code, 0);
});

test('un brief vide n’est pas un brief', () => {
  installerFauxHerdr();
  const r = livrer('w9:p1', '--texte', '   ');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /vide/);
});

test('livraison nominale : la boîte était vide, la session prend le brief', () => {
  const journal = installerFauxHerdr({ boiteInitiale: '', soumetSeule: true });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  assert.equal(r.code, 0, r.stderr);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.ok, true);
  assert.equal(rendu.repare, false, 'rien à réparer quand la soumission part du premier coup');

  const a = appels(journal);
  // On REGARDE avant d'écrire — les DEUX portes : l'état de la session et sa boîte.
  const iPrompt = a.findIndex((x) => x[0] === 'agent' && x[1] === 'prompt');
  const iRead = a.findIndex((x) => x[0] === 'agent' && x[1] === 'read');
  const iGet = a.findIndex((x) => x[0] === 'agent' && x[1] === 'get');
  assert.ok(iRead !== -1 && iRead < iPrompt, 'la boîte doit être regardée AVANT qu’on y écrive');
  assert.ok(iGet !== -1 && iGet < iPrompt, 'l’état de la session doit être lu AVANT qu’on y écrive');
  assert.ok(a[iPrompt].includes('--wait'), 'l’appel nu rend un succès dans tous les cas — --wait est obligatoire');
  // Et on RELIT après : la réponse de l'outil ne fait pas foi.
  assert.ok(
    a.slice(iPrompt).some((x) => x[0] === 'agent' && x[1] === 'read'),
    'la prise du brief doit être relue, pas déduite de la réponse de l’outil'
  );
});

// Relevé en revue de passe 1 : rien n'exerçait le SECOND témoin de prise. Le statut portait
// seul tous les cas, donc le vidage de la boîte pouvait être n'importe quoi sans qu'un test
// bronche. Ici le statut reste muet sur `idle` — si la boîte vidée ne témoignait pas, la
// livraison serait déclarée non prise alors qu'elle l'est.
test('le vidage de la boîte témoigne à lui seul quand le statut reste muet', () => {
  installerFauxHerdr({ boiteInitiale: '', soumetSeule: true, statutMuet: true });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  assert.equal(r.code, 0, `la boîte vidée doit suffire à prouver la prise — stderr: ${r.stderr}`);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.statut, 'idle', 'le statut n’a effectivement jamais bougé dans ce scénario');
  assert.equal(rendu.repare, false, 'aucune réparation n’était nécessaire : le brief était bien parti');
});

test('un statut muet ET une boîte encore pleine : la commande refuse de dire « livré »', () => {
  // Les deux témoins absents en même temps. La réparation part, et si elle ne suffit pas, la
  // commande doit échouer plutôt que d'accorder le bénéfice du doute.
  const journal = installerFauxHerdr({ boiteInitiale: '', soumetSeule: false, statutMuet: true });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  const a = appels(journal);
  assert.ok(
    a.some((x) => x[0] === 'agent' && x[1] === 'send-keys'),
    'la réparation doit être tentée'
  );
  // Le double vide la boîte dès que la touche d'envoi part : la réparation aboutit ici.
  assert.equal(r.code, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).repare, true);
});

// LE DÉFAUT MESURÉ, celui qui rend un brief faux plutôt qu’absent.
test('une boîte NON VIDE fait refuser la livraison — jamais écrire par-dessus', () => {
  const journal = installerFauxHerdr({ boiteInitiale: 'reste dune livraison precedente' });
  const r = livrer('w9:p1', '--texte', 'BRIEF-REEL');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /pas vide/);
  assert.match(r.stderr, /coll/, 'le message doit dire que les deux textes seraient collés');
  assert.ok(
    !appels(journal).some((x) => x[0] === 'agent' && x[1] === 'prompt'),
    'rien ne doit être écrit dans une boîte qui n’est pas vide'
  );
});

test('une session qui travaille DÉJÀ fait refuser la livraison — rien n’est écrit', () => {
  // Un autre appelant lui parle en ce moment. Écrire maintenant serait déclaré « livré » par
  // le seul fait qu'elle travaille — un témoin vrai avant même qu'on ait écrit.
  const journal = installerFauxHerdr({ dejaOccupee: true });
  // ⚠️ `--en-attente` — CE REFUS EST DEVENU CELUI DU BRIEF DE NAISSANCE (T-20260814-0138).
  // Il reste juste pour une session qui vient de naître, où « elle a quitté l'attente » EST la
  // preuve de prise. Il ne peut plus être le défaut : un pair est occupé la plupart du temps,
  // et l'exiger revenait à n'avoir aucune voie vérifiée pour parler à un agent vivant.
  const r = livrer('w9:p1', '--texte', 'BRIEF-REEL', '--en-attente');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /working/);
  assert.ok(
    !appels(journal).some((x) => x[0] === 'agent' && x[1] === 'prompt'),
    'rien ne doit être écrit dans une session déjà occupée'
  );
});

test('une boîte ILLISIBLE fait refuser la livraison — on ne livre pas à l’aveugle', () => {
  const journal = installerFauxHerdr({ lectureCassee: true });
  const r = livrer('w9:p1', '--texte', 'BRIEF-REEL');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /illisible/);
  assert.ok(!appels(journal).some((x) => x[0] === 'agent' && x[1] === 'prompt'));
});

// LE DÉFAUT DU TICKET : la soumission ne part pas, l’outil dit quand même « livré ».
test('quand la soumission ne part pas, la commande le VOIT, répare, et ne ment pas', () => {
  const journal = installerFauxHerdr({ boiteInitiale: '', soumetSeule: false });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  assert.equal(r.code, 0, `la réparation doit aboutir — stderr: ${r.stderr}`);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.repare, true, 'la commande doit dire qu’elle a dû réparer');
  assert.equal(rendu.attendu, false, 'et que herdr avait signalé le calage');

  const a = appels(journal);
  const envois = a.filter((x) => x[0] === 'agent' && x[1] === 'send-keys');
  assert.equal(envois.length, 1, 'on répare UNE fois, pas en boucle');
  assert.deepEqual(envois[0], ['agent', 'send-keys', 'w9:p1', 'Enter']);
  const prompts = a.filter((x) => x[0] === 'agent' && x[1] === 'prompt');
  assert.equal(prompts.length, 1, 'le brief n’est JAMAIS réécrit — il se collerait à lui-même');
});

test('un brief se lit depuis un fichier, d’un seul tenant', () => {
  installerFauxHerdr();
  const f = join(bac, 'brief.md');
  writeFileSync(f, '# Ton mandat\n\nDeux lignes, et un retour à la ligne au milieu.\n');
  const r = livrer('w9:p1', '--brief', f);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(JSON.parse(r.stdout).caracteres > 40, 'le brief entier doit partir, pas sa première ligne');
});

test('un fichier de brief absent fait échouer la commande avant tout appel à herdr', () => {
  const journal = installerFauxHerdr();
  const r = livrer('w9:p1', '--brief', join(bac, 'nexiste-pas.md'));
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /illisible/);
  assert.equal(appels(journal).length, 0);
});

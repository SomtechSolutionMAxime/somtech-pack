// etat-boite-bin.test.js — le fichier exécutable réel (bin/etat-boite.js), avec un FAUX herdr
// en tête de PATH. Aucune vraie session n'est touchée.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CETTE COMMANDE EXISTE, ET CE QUE SON ABSENCE A COÛTÉ (E-20260819-0015)
//
// Le 2026-08-19, DEUX orchestrateurs ont perdu ~3 heures CHACUN sur des boîtes qu'ils croyaient
// bloquées. Elles étaient vides : ils lisaient une SUGGESTION grisée. Ils ont chacun remonté
// trois fois au dirigeant un geste sans objet, et l'un a inscrit huit occurrences d'un défaut
// dont on ignore combien étaient réelles.
//
// 🔴 CE N'ÉTAIT PAS UNE FAUTE D'ATTENTION : le geste que les textes de ce dépôt prescrivaient —
// `herdr pane read "$P"` — rend le MÊME écran pour une suggestion et pour un texte saisi. La
// seule commande qui les sépare demande de décoder du SGR à la main (`--format ansi | cat -v`),
// et personne n'a de raison de la taper avant d'avoir été trompé une fois.
//
// ⚠️ CE BANC ÉPROUVE LE BINAIRE, PAS LA FONCTION. `etatDeLaBoite` peut très bien nommer les
// trois états : si le nom ne franchit pas cette sortie-ci, le lecteur voit le même écran muet
// qu'avant. C'est « une porte sur deux », le motif le plus cher de ce dépôt.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(resolve(HERE, '..'), 'bin', 'etat-boite.js');

let bac;
let pathOriginal;

/**
 * Faux herdr, piloté par le contenu de boîte qu'on veut lui faire rendre. Il journalise CE QUI
 * LUI EST DEMANDÉ — c'est ce qui permet de prouver que la commande ne pose aucun geste.
 */
function installerFauxHerdr({ ligneDeBoite = '❯ ', lectureCassee = false, sansAgent = false } = {}) {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '─'.repeat(20);
const SANS_AGENT = ${sansAgent ? 'true' : 'false'};
const ECRAN = ['⏺ un travail au-dessus', SEP, ${JSON.stringify('LIGNE')}, SEP, '  auto mode on'].join('\\n');
if (cmd === 'agent list') {
  process.stdout.write(JSON.stringify({ id: 'x', result: { agents: SANS_AGENT ? [] : [{ name: 'cible', pane_id: 'w1:p1', agent_status: 'idle' }] } }) + '\\n');
} else if (cmd === 'agent get') {
  if (SANS_AGENT) { process.stdout.write(JSON.stringify({ id: 'x', error: { code: 'agent_not_found', message: 'agent target w1:p1 not found' } }) + '\\n'); }
  else { process.stdout.write(JSON.stringify({ id: 'x', result: { agent: { pane_id: 'w1:p1', name: 'cible', agent_status: 'idle' } } }) + '\\n'); }
} else if (cmd === 'pane get') {
  process.stdout.write(JSON.stringify({ id: 'x', result: { pane: { pane_id: 'w1:p1' } } }) + '\\n');
} else if (cmd === 'agent read' || cmd === 'pane read') {
  if (${lectureCassee ? 'true' : 'false'}) { process.exit(3); }
  process.stdout.write(ECRAN);
} else {
  process.stdout.write(JSON.stringify({ id: 'x', result: {} }) + '\\n');
}
`.replace(JSON.stringify('LIGNE'), JSON.stringify(ligneDeBoite));
  const chemin = join(bac, 'herdr');
  writeFileSync(chemin, script);
  chmodSync(chemin, 0o755);
  return journal;
}

const lancer = (args, { sessions = '/tmp/faux.sock' } = {}) =>
  spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bac}:${pathOriginal}`, HERDR_SESSIONS_ESSAIS: sessions },
  });

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'etat-boite-'));
  pathOriginal = process.env.PATH;
});
after(() => rmSync(bac, { recursive: true, force: true }));

const ESC = String.fromCharCode(27);

test('UNE SUGGESTION GRISÉE EST NOMMÉE — et la commande dit qu’il n’y a RIEN à soumettre', () => {
  installerFauxHerdr({ ligneDeBoite: `❯ ${ESC}[0m${ESC}[2mmerge la PR 37${ESC}[0m` });
  const r = lancer(['w1:p1']);
  assert.equal(r.status, 0, r.stderr);
  const vu = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(vu.etat, 'suggestion');
  assert.equal(vu.aSoumettre, false, 'c’est la conduite qui compte : il n’y a rien à soumettre');
  assert.equal(vu.suggestion, 'merge la PR 37', 'le texte vu, pour que le lecteur reconnaisse son écran');
  assert.match(r.stdout, /suggestion/i, 'et ça se lit sans passer par JSON');
});

test('UN TEXTE COLLÉ EST UNE BOÎTE PLEINE — la commande ne l’efface pas d’un mot', () => {
  installerFauxHerdr({ ligneDeBoite: '❯ [Pasted text #116 +15 lines]' });
  const vu = JSON.parse(lancer(['w1:p1']).stdout.trim().split('\n').pop());
  assert.equal(vu.etat, 'collee');
  assert.equal(vu.aSoumettre, true);
  assert.equal(vu.texte, '[Pasted text #116 +15 lines]');
});

test('UN TEXTE SAISI EST UNE BOÎTE PLEINE', () => {
  installerFauxHerdr({ ligneDeBoite: '❯ reste ici' });
  const vu = JSON.parse(lancer(['w1:p1']).stdout.trim().split('\n').pop());
  assert.equal(vu.etat, 'saisie');
  assert.equal(vu.aSoumettre, true);
});

test('UNE BOÎTE VIDE SE DIT VIDE — on éprouve aussi l’ABSENCE de suggestion', () => {
  installerFauxHerdr({ ligneDeBoite: '❯ ' });
  const vu = JSON.parse(lancer(['w1:p1']).stdout.trim().split('\n').pop());
  assert.equal(vu.etat, 'vide');
  assert.equal(vu.suggestion, null);
});

test('UN ÉCRAN QU’ON N’A PAS LU NE SE DÉGUISE PAS EN BOÎTE VIDE — et la commande ÉCHOUE', () => {
  // ⚠️ Le sens sûr : « je n'ai pas vu » ne doit jamais se lire « il n'y avait rien ». Un code de
  // sortie non nul, parce qu'un appelant qui enchaîne (`&&`) doit s'arrêter là.
  installerFauxHerdr({ lectureCassee: true });
  const r = lancer(['w1:p1']);
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}${r.stderr}`, /illisible/i);
});

test('LA COMMANDE NE POSE AUCUN GESTE — elle lit, elle ne touche pas', () => {
  // ⚠️ C'EST LA GARANTIE QUI LA REND UTILISABLE SUR LE PANE DE QUELQU'UN D'AUTRE. Une commande
  // de diagnostic qui écrit, même une touche, ne peut pas être conseillée dans un texte que des
  // agents suivent à la lettre sur les panes de leurs pairs.
  const journal = installerFauxHerdr({ ligneDeBoite: `❯ ${ESC}[2mcontinue${ESC}[0m` });
  lancer(['w1:p1']);
  const appels = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const gestes = appels.filter((a) => ['prompt', 'send-keys', 'send-text', 'run', 'close'].includes(a[1]));
  assert.deepEqual(gestes, [], `aucun geste ne doit partir — vu : ${JSON.stringify(gestes)}`);
});

test('UN PANE SANS AGENT AU REGISTRE SE LIT QUAND MÊME — c’est le cas où l’on doute le plus', () => {
  // 🔴 LE REGISTRE MENT SUR LES AGENTS NEUFS, et c'est mesuré : `herdr agent get` rend
  // `agent_not_found` sur des panes qui travaillent (trois occurrences le 2026-08-19, deux
  // orchestrateurs indépendants, `T-20260819-0121`). Une commande de diagnostic qui exige un
  // agent au registre serait donc aveugle précisément là où l'on a besoin d'elle — et elle
  // renverrait « aucun agent vivant » sur un pane dont la boîte est parfaitement lisible.
  //
  // ⚠️ Elle passe alors par `pane read`, qui ne demande rien au registre.
  installerFauxHerdr({ ligneDeBoite: `❯ ${ESC}[2mcontinue${ESC}[0m`, sansAgent: true });
  const r = lancer(['w1:p1']);
  assert.equal(r.status, 0, r.stderr);
  const vu = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(vu.etat, 'suggestion');
  assert.equal(vu.agent, null, 'aucun nom à donner — et ça ne l’empêche pas de rendre l’état');
});

test('DEUX SESSIONS QUI PORTENT LE MÊME PANE : on REFUSE, on ne tire pas au sort l’écran qu’on lit', () => {
  // Un identifiant de pane est INTERNE à sa session : `w7:p1` existait dans deux sessions du
  // poste au moment de la mesure. Lire le mauvais écran rendrait un verdict juste sur un objet
  // qu'on n'a pas visé — le pire des rendus, puisqu'il a l'air fondé.
  installerFauxHerdr({ ligneDeBoite: '❯ reste ici', sansAgent: true });
  // Deux sessions du poste, et le même pane répond dans les deux.
  const r = lancer(['w1:p1'], { sessions: '/tmp/faux-a.sock:/tmp/faux-b.sock' });
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}${r.stderr}`, /deux|plusieurs/i);
});

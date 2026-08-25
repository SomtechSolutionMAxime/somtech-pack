// garde-des-naissances-bin.test.js — LE FICHIER EXÉCUTABLE RÉEL, avec un FAUX herdr en tête de
// PATH et un HOME de bac à sable. Aucune vraie session, aucun vrai `~/.somtech`.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE BANC ÉPROUVE LE BINAIRE, PAS LA FONCTION — et c'est ce qui le distingue des deux autres.
//
// `jugerLeParc` peut très bien nommer chaque fautif : si le nom ne franchit pas CETTE sortie-ci,
// personne ne le lit jamais. C'est « une porte sur deux », le motif le plus cher de ce dépôt.
//
// ⚠️ ET UN BANC QUI FABRIQUE SON PROPRE APPELANT NE PROUVE RIEN. Le seul appelant réel de la
// décision est ce binaire. On substitue donc **un seul point nommé** — l'exécutable `herdr` —
// et on laisse tourner TOUTE la chaîne réelle derrière : `socketsHerdr`, `panes`, `agents`,
// `lireLesDeclarations`, `roleDuLieuOuRefus`, `jugerLeParc`, le rendu, la sortie. Un double du
// module entier aurait pu n'être pas conforme ; celui-ci ne remplace que l'outil externe.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SORTIE_REFUS, SORTIES, VERDICTS } from '../src/garde-des-naissances.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const BIN = join(resolve(ICI, '..'), 'bin', 'garde-des-naissances.js');

let bac;

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'garde-naissances-'));
});
after(() => {
  rmSync(bac, { recursive: true, force: true });
});

/**
 * Un faux `herdr`, piloté par un fichier JSON. Il journalise ce qu'on lui demande — c'est ce
 * qui permet de prouver que la garde LIT et ne POSE aucun geste.
 */
function installerFauxHerdr({ panes = [], agents = [], casse = false } = {}) {
  const abri = join(bac, 'bin');
  mkdirSync(abri, { recursive: true });
  const donnees = join(bac, 'parc.json');
  writeFileSync(donnees, JSON.stringify({ panes, agents, casse }));
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');

  const script = [
    '#!/usr/bin/env node',
    "const fs = require('fs');",
    'const args = process.argv.slice(2);',
    `fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify(args) + '\\n');`,
    `const d = JSON.parse(fs.readFileSync(${JSON.stringify(donnees)}, 'utf8'));`,
    'if (d.casse) { process.stdout.write(JSON.stringify({ error: { code: "REFUS", message: "session injoignable" } })); process.exit(0); }',
    'const cmd = args.slice(0, 2).join(" ");',
    'if (cmd === "pane list") process.stdout.write(JSON.stringify({ result: { panes: d.panes } }));',
    'else if (cmd === "agent list") process.stdout.write(JSON.stringify({ result: { agents: d.agents } }));',
    'else process.stdout.write(JSON.stringify({ result: {} }));',
  ].join('\n');
  const chemin = join(abri, 'herdr');
  writeFileSync(chemin, `${script}\n`);
  chmodSync(chemin, 0o755);
  return { abri, journal };
}

/**
 * Lance le binaire réel.
 *
 * ⚠️ `HOME` EST REDIRIGÉ, ET CE N'EST PAS DE LA PRUDENCE DE PRINCIPE. `socketsHerdr()` découvre
 * les sessions sous `~/.config/herdr/sessions` : sans cette redirection, le banc interrogerait
 * les QUINZE sessions réelles du poste (avec le faux herdr, certes, mais en multipliant le parc
 * par quinze — un compte faux, et une mesure qui change selon la machine).
 */
function lancer({ panes = [], agents = [], declarations = [], casse = false, env = {} } = {}) {
  const { abri, journal } = installerFauxHerdr({ panes, agents, casse });
  const registre = join(bac, 'naissances');
  rmSync(registre, { recursive: true, force: true });
  if (declarations.length) {
    mkdirSync(registre, { recursive: true });
    declarations.forEach((d, i) => writeFileSync(join(registre, `2026082512000000${i}-d.json`), JSON.stringify(d)));
  }
  const r = spawnSync(process.execPath, [BIN], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: bac,
      PATH: `${abri}:${process.env.PATH}`,
      HERDR_SOCKET_PATH: join(bac, 'faux.sock'),
      SOMTECH_NAISSANCES_RACINE: registre,
      ...env,
    },
  });
  return { ...r, journal, registre };
}

const WT = '/bac/worktrees/un-depot';
const APRES = `${WT}/20260825-093000`;

const pane = (sur = {}) => ({
  agent: true,
  agent_session: 'ses-1',
  agent_status: 'idle',
  pane_id: 'w1:p1',
  foreground_cwd: APRES,
  name: null,
  ...sur,
});

const declaration = (sur = {}) => ({
  version: 1,
  nom: 'ristigouche',
  role: 'orchestrateur',
  mandat: 'T-20260825-0013',
  espace: APRES,
  pane: 'w1:p1',
  session_herdr: null,
  ne_le: '2026-08-25T13:30:00.000Z',
  pose_par: 'pack agent naitre',
  ...sur,
});

// ═══════════════════════════════════════════════════════════════════════════════════════

test('LE CRITÈRE N°1 PAR LE BINAIRE : déclaration retirée ⇒ rouge, et le fautif est NOMMÉ à l’écran', () => {
  // La moitié qui prouve, d'abord — avec sa déclaration, le binaire sort en 0.
  const avec = lancer({
    panes: [pane()],
    agents: [{ ...pane(), herdr_socket: join(bac, 'faux.sock') }],
    declarations: [declaration({ session_herdr: join(bac, 'faux.sock') })],
  });
  assert.equal(avec.status, SORTIES[VERDICTS.RIEN_A_SIGNALER], avec.stdout + avec.stderr);

  // Puis le geste du critère : on retire la déclaration, rien d'autre.
  const sans = lancer({
    panes: [pane()],
    agents: [{ ...pane(), herdr_socket: join(bac, 'faux.sock') }],
    declarations: [],
  });
  assert.equal(sans.status, SORTIES[VERDICTS.NES_HORS_DISPOSITIF], sans.stdout + sans.stderr);
  assert.match(sans.stdout, /w1:p1/, 'le fautif doit être NOMMÉ dans la sortie du binaire');
  assert.match(sans.stdout, /20260825-093000/);
});

test('les deux chiffres et leur méthode franchissent la sortie du binaire', () => {
  const r = lancer({ panes: [pane()], agents: [{ ...pane(), herdr_socket: join(bac, 'faux.sock') }] });
  assert.match(r.stdout, /prises\s*:\s*1/);
  assert.match(r.stdout, /refus à tort \(mesurés\)\s*:\s*0/);
  assert.match(r.stdout, /méthode/);
  assert.match(r.stdout, /PLANCHER/i, 'la portée de la mesure doit être dite, pas supposée');
});

test('la garde ne POSE aucun geste — elle ne fait que lire', () => {
  const r = lancer({ panes: [pane()], agents: [] });
  const appels = readFileSync(r.journal, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  assert.ok(appels.length > 0, 'la garde n’a même pas parlé à herdr');
  for (const a of appels) {
    assert.ok(
      a.slice(0, 2).join(' ') === 'pane list' || a.slice(0, 2).join(' ') === 'agent list',
      `la garde a lancé « ${a.join(' ')} » — une garde qui écrit n’est plus une garde`
    );
  }
});

test('herdr INJOIGNABLE fait REFUSER — jamais « rien à signaler »', () => {
  // ⚠️ DÉCIDÉ, PAS SUBI : une garde qui ne peut pas mesurer et rend vert certifie un parc
  // qu'elle n'a pas regardé. C'est pire que pas de garde du tout, parce que le vert se cite.
  const r = lancer({ casse: true });
  assert.equal(r.status, SORTIE_REFUS, r.stdout + r.stderr);
  assert.match(`${r.stdout}${r.stderr}`, /je n’ai pas|pas pu|refus/i);
  assert.doesNotMatch(r.stdout, /rien à signaler/);
});

test('un registre de naissances ILLISIBLE fait REFUSER — et ce n’est pas un registre absent', () => {
  const parc = { panes: [pane()], agents: [{ ...pane(), herdr_socket: join(bac, 'faux.sock') }] };

  // Absent : le poste où personne n'est né. La garde JUGE, et l'agent récent est une prise.
  const absent = lancer(parc);
  assert.equal(absent.status, SORTIES[VERDICTS.NES_HORS_DISPOSITIF]);

  // Illisible : le répertoire est LÀ, mais fermé. On ne conclut RIEN — surtout pas qu'aucun
  // agent n'y est né. Les deux états appellent des gestes opposés, et le prix de les confondre
  // est un « rien à signaler » posé sur un registre plein.
  const ferme = lancer(parc);
  mkdirSync(ferme.registre, { recursive: true });
  chmodSync(ferme.registre, 0o000);
  try {
    const bloque = spawnSync(process.execPath, [BIN], {
      encoding: 'utf8',
      env: { ...process.env, HOME: bac, PATH: `${join(bac, 'bin')}:${process.env.PATH}`,
        HERDR_SOCKET_PATH: join(bac, 'faux.sock'), SOMTECH_NAISSANCES_RACINE: ferme.registre },
    });
    assert.equal(bloque.status, SORTIE_REFUS, bloque.stdout + bloque.stderr);
    assert.doesNotMatch(bloque.stdout, /rien à signaler/);
    assert.notEqual(bloque.status, absent.status, 'illisible et absent ne sortent pas par la même porte');
  } finally {
    chmodSync(ferme.registre, 0o700);
  }
});

test('un parc SANS agent vivant sort en 0 et le dit — un vert honnête reste un vert', () => {
  const r = lancer({ panes: [pane({ agent_session: null })], agents: [] });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /rien à signaler/);
});

test('la borne se VOIT dans la sortie — les hors-portée sont comptés et nommés', () => {
  const vieux = pane({ pane_id: 'w2:p2', foreground_cwd: `${WT}/20260724-204645` });
  const indatable = pane({ pane_id: 'w3:p3', foreground_cwd: `${WT}/t-0043` });
  const r = lancer({
    panes: [vieux, indatable],
    agents: [
      { ...vieux, herdr_socket: join(bac, 'faux.sock') },
      { ...indatable, herdr_socket: join(bac, 'faux.sock') },
    ],
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /hors portée \(2\)/);
  assert.match(r.stdout, /w2:p2/);
  assert.match(r.stdout, /t-0043/);
});

test('une FRONTIÈRE contredite par le registre fait REFUSER le binaire', () => {
  // Le geste d'entretien, joué jusqu'au bout de la chaîne réelle : une déclaration ANTÉRIEURE
  // à la frontière prouve que le dispositif tournait déjà, donc la garde ne se prononce pas.
  const r = lancer({
    panes: [pane()],
    agents: [{ ...pane(), herdr_socket: join(bac, 'faux.sock') }],
    declarations: [declaration({ ne_le: '2026-08-01T10:00:00.000Z', nom: 'temiscouata' })],
  });
  assert.equal(r.status, SORTIE_REFUS, r.stdout + r.stderr);
  assert.match(`${r.stdout}${r.stderr}`, /temiscouata/);
});

test('`--json` rend la structure entière, pour qu’une chaîne puisse s’en servir', () => {
  const r = spawnSync(process.execPath, [BIN, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: bac, PATH: `${join(bac, 'bin')}:${process.env.PATH}`,
      HERDR_SOCKET_PATH: join(bac, 'faux.sock'), SOMTECH_NAISSANCES_RACINE: join(bac, 'vide') },
  });
  const lu = JSON.parse(r.stdout);
  assert.ok(Object.hasOwn(lu, 'verdict'));
  assert.ok(Object.hasOwn(lu, 'comptes'));
  assert.ok(Object.hasOwn(lu, 'methode'), 'un chiffre sans sa méthode est un fait invérifiable');
});

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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, statSync } from 'node:fs';
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
function lancer({ panes = [], agents = [], declarations = [], casse = false, env = {}, sansTranscrit = [] } = {}) {
  const { abri, journal } = installerFauxHerdr({ panes, agents, casse });
  poserLesTranscrits(panes, { sans: sansTranscrit });
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
      HERDR_SOCKET_PATH: SOCKET_DU_BANC,
      SOMTECH_NAISSANCES_RACINE: registre,
      ...env,
    },
  });
  return { ...r, journal, registre };
}

// 🔴 LA FORME RÉELLE D'UN SOCKET HERDR — `…/sessions/<nom>/herdr.sock`. Ce banc posait
// autrefois `<bac>/faux.sock`, un chemin qui ne porte AUCUN nom de session : la déclaration
// qu'il écrivait à côté portait ce même chemin, si bien que la jointure se comparait égale ici
// et jamais dans le monde. Le pane porte le CHEMIN, la déclaration porte le NOM.
const SOCKET_DU_BANC = join(bac, '.config', 'herdr', 'sessions', 'faux', 'herdr.sock');

const WT = '/bac/worktrees/un-depot';
const APRES = `${WT}/20260825-093000`;

/**
 * LA SESSION CLAUDE D'UN PANE, DANS LA FORME QUE HERDR REND — un OBJET dont `value` porte
 * l'identifiant. Ce banc écrivait la chaîne `'ses-1'` ; depuis que la garde DATE l'agent par sa
 * session, un double plus pauvre que le vrai rendrait tout le parc non datable, et chaque
 * assertion de population ci-dessous éprouverait un monde qui n'existe pas.
 *
 * Une session PAR PANE : c'est ce qui permet d'en dater un et pas l'autre.
 */
const sessionDe = (pane) => ({ agent: 'claude', kind: 'id', source: 'herdr:claude', value: `sess-${pane}` });

const pane = (sur = {}) => {
  const dossier = {
    agent: true,
    agent_status: 'idle',
    pane_id: 'w1:p1',
    foreground_cwd: APRES,
    name: null,
    ...sur,
  };
  return { agent_session: sessionDe(dossier.pane_id), ...dossier };
};

/**
 * LE TRANSCRIT D'UNE SESSION, POSÉ POUR DE VRAI SOUS LE `HOME` DU BAC.
 *
 * 🔴 C'EST LA CHAÎNE RÉELLE, PAS UN POINT DE SUBSTITUTION DE PLUS. Le fil lit les naissances
 * dans `~/.claude/projects/<projet>/<session>.jsonl` ; `HOME` étant déjà redirigé vers le bac,
 * poser le fichier là le fait passer par la MÊME porte que le monde réel emprunte —
 * `readdirSync`, `statSync`, tout compris. Injecter un second point ici aurait fabriqué un
 * appelant que la production n'a pas.
 *
 * ⚠️ LE NOM DU RÉPERTOIRE DE PROJET EST ARBITRAIRE, ET C'EST LE POINT. L'encodage du chemin de
 * travail a changé de version de Claude Code (mesuré : le point survit dans un répertoire,
 * disparaît dans l'autre) ; le fil cherche donc PAR IDENTIFIANT, à travers les répertoires. Un
 * banc qui rangerait le transcrit là où une règle devinée l'attend ne l'éprouverait pas.
 */
function poserLesTranscrits(panes, { sans = [] } = {}) {
  const projets = join(bac, '.claude', 'projects');
  rmSync(projets, { recursive: true, force: true });
  const poses = [];
  panes.forEach((p, i) => {
    const id = p?.agent_session?.value;
    if (!id || sans.includes(p.pane_id)) return;
    const projet = join(projets, `-un-projet-quelconque-${i}`);
    mkdirSync(projet, { recursive: true });
    const f = join(projet, `${id}.jsonl`);
    writeFileSync(f, `${JSON.stringify({ type: 'summary', sessionId: id })}\n`);
    poses.push(f);
  });
  return poses;
}

const declaration = (sur = {}) => ({
  version: 1,
  nom: 'ristigouche',
  role: 'orchestrateur',
  mandat: 'T-20260825-0013',
  espace: APRES,
  pane: 'w1:p1',
  session_herdr: null,
  // 🔴 `ne_le` SUIT LA NAISSANCE, ET ICI LES AGENTS NAISSENT POUR DE VRAI. Les transcrits de ce
  // banc sont créés sur le disque à l'instant où il tourne ; une déclaration figée au
  // « 2026-08-25T13:30:00.000Z » était donc inscrite des heures AVANT l'agent qu'elle couvre —
  // un monde que le geste de naissance ne produit pas (il vérifie par le fait, PUIS inscrit).
  // On prend donc l'heure du banc, comme le producteur prend celle du poste.
  ne_le: new Date().toISOString(),
  pose_par: 'pack agent naitre',
  ...sur,
});

// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 LE CONTRÔLE DE PLATEFORME — SANS LUI, RIEN DE CE QUI SUIT N'ÉPROUVE LA POPULATION.
 *
 * La garde date un agent par la date de CRÉATION du transcrit de sa session. Un système de
 * fichiers qui ne la tient pas rendrait chaque agent NON DATABLE, donc « non mesuré » — et
 * chaque assertion de prise ci-dessous rougirait pour une raison qui n'a rien à voir avec ce
 * qu'elle croit éprouver. On le dit ICI, en un seul message clair, plutôt que de le laisser se
 * traduire en huit rouges obscurs. C'est aussi une vraie information : là où ce contrôle
 * rougit, la garde ne peut pas travailler.
 */
test('le système de fichiers de ce banc DATE les fichiers qu’il crée — le socle de tout le reste', () => {
  const [f] = poserLesTranscrits([pane({ pane_id: 'w0:p0' })]);
  const ne = statSync(f).birthtimeMs;
  assert.ok(
    Number.isFinite(ne) && ne > 0,
    'ce système de fichiers ne tient aucune date de création : la garde des naissances ne peut ' +
      'dater personne dessus, et les assertions de population de ce fichier n’éprouvent rien.'
  );
  assert.ok(Math.abs(Date.now() - ne) < 60_000, 'un fichier créé à l’instant n’est pas daté de l’instant');
});

test('LE CRITÈRE N°1 PAR LE BINAIRE : déclaration retirée ⇒ rouge, et le fautif est NOMMÉ à l’écran', () => {
  // La moitié qui prouve, d'abord — avec sa déclaration, le binaire sort en 0.
  const avec = lancer({
    panes: [pane()],
    agents: [{ ...pane(), herdr_socket: SOCKET_DU_BANC }],
    declarations: [declaration({ session_herdr: 'faux' })],
  });
  assert.equal(avec.status, SORTIES[VERDICTS.RIEN_A_SIGNALER], avec.stdout + avec.stderr);

  // Puis le geste du critère : on retire la déclaration, rien d'autre.
  const sans = lancer({
    panes: [pane()],
    agents: [{ ...pane(), herdr_socket: SOCKET_DU_BANC }],
    declarations: [],
  });
  assert.equal(sans.status, SORTIES[VERDICTS.NES_HORS_DISPOSITIF], sans.stdout + sans.stderr);
  assert.match(sans.stdout, /w1:p1/, 'le fautif doit être NOMMÉ dans la sortie du binaire');
  assert.match(sans.stdout, /20260825-093000/);
});

test('les chiffres et leur méthode franchissent la sortie du binaire — chacun avec sa population', () => {
  // ⚠️ LES REFUS À TORT SORTENT EN DEUX LIGNES DEPUIS LE 2026-08-25, et l'étiquette de chacune
  // nomme le panier qu'elle compte. « refus à tort (mesurés) : 0 » se lisait « la garde n'en
  // fait aucun » alors qu'il ne croisait que les PRISES : un agent mal classé chez les non
  // mesurés était nommé dans la même page pendant que le chiffre le niait.
  const r = lancer({ panes: [pane()], agents: [{ ...pane(), herdr_socket: SOCKET_DU_BANC }] });
  assert.match(r.stdout, /prises\s*:\s*1/);
  assert.match(r.stdout, /refus à tort — parmi les PRISES[^\n]*:\s*0/);
  assert.match(r.stdout, /refus à tort — parmi les NON MESURÉS[^\n]*:\s*0/);
  assert.match(r.stdout, /méthode/);
  assert.match(r.stdout, /PLANCHER/i, 'la portée de la mesure doit être dite, pas supposée');
});

test('un registre des agents ENTIÈREMENT MUET ne rend pas tout le monde anonyme', () => {
  // ⚠️ LE CHEMIN RÉEL QUE LE `catch` SUPPRIMÉ PRÉTENDAIT COUVRIR. `agents()` n'échoue pas quand
  // les sessions refusent : il rend une liste VIDE. Traduire ce vide en « aucun de ces panes
  // n'a de nom » ferait de chaque agent une PRISE — une garde qui accuse tout un parc parce que
  // son instrument s'est tu. Mesuré : `agent list` a rendu 83 panes sur 227 un jour.
  const r = lancer({ panes: [pane()], agents: [] });
  assert.equal(r.status, SORTIES[VERDICTS.ZONES_NON_MESUREES], r.stdout + r.stderr);
  assert.match(r.stdout, /SOUS-COMPTE|pas vu ce pane/, 'la CAUSE doit voyager avec le fait');
  assert.doesNotMatch(r.stdout, /🔴/, 'aucun agent ne doit être ACCUSÉ sur un instrument muet');
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
  const parc = { panes: [pane()], agents: [{ ...pane(), herdr_socket: SOCKET_DU_BANC }] };

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
        HERDR_SOCKET_PATH: SOCKET_DU_BANC, SOMTECH_NAISSANCES_RACINE: ferme.registre },
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

/**
 * CE QUE LA BORNE EST DEVENUE, ET POURQUOI CE BANC-CI L'ÉPROUVE PAR L'AUTRE BOUT.
 *
 * Ce test posait deux agents dans des répertoires anciens et exigeait « hors portée (2) ». Le
 * répertoire ne décide plus : la population se borne sur la NAISSANCE de l'agent (voir
 * `une-reprise-nait-aujourdhui`). Or **ce banc-ci ne peut pas FABRIQUER une naissance
 * ancienne** : il pose de vrais fichiers, et reculer une date de création n'est pas portable
 * (APFS l'accepte par `utimes`, ext4 la tient immuable). Un banc qui prétendrait le faire
 * rendrait vert sur la moitié des machines sans rien éprouver.
 *
 * Ce qu'il peut fabriquer, et qui garde la MÊME fonction — « une catégorie NON VERTE est
 * comptée et NOMMÉE à la sortie du binaire » — c'est l'agent qu'on ne sait pas dater : il
 * suffit de ne pas poser son transcrit. Et il garde une chose de plus, qui est le correctif
 * lui-même : **ne pas savoir dater ne sort PAS en 0.**
 *
 * Le rendu de « hors portée » reste gardé là où il se fabrique sans dépendre d'une machine —
 * `garde-des-naissances.test.js`, sur la décision pure.
 */
test('un agent qu’on ne sait pas DATER est compté, NOMMÉ, et ne sort pas en 0', () => {
  const date = pane({ pane_id: 'w2:p2' });
  const indatable = pane({ pane_id: 'w3:p3', foreground_cwd: `${WT}/t-0043` });
  const r = lancer({
    panes: [date, indatable],
    agents: [
      { ...date, herdr_socket: SOCKET_DU_BANC },
      { ...indatable, herdr_socket: SOCKET_DU_BANC },
    ],
    sansTranscrit: ['w3:p3'],
  });
  assert.equal(r.status, SORTIES[VERDICTS.NES_HORS_DISPOSITIF], r.stdout + r.stderr);
  assert.match(r.stdout, /n’ai PAS PU mesurer/, 'le non-mesuré ne franchit pas la sortie du binaire');
  assert.match(r.stdout, /w3:p3/, 'l’agent qu’on n’a pas su dater n’est pas NOMMÉ');
  assert.match(r.stdout, /aucun transcrit ne date la session/, 'la raison du non-mesuré est tue');
  assert.match(r.stdout, /w2:p2/, 'l’agent daté, lui, est bien jugé — le contrôle positif du même écran');
});

test('un parc ENTIÈREMENT indatable sort en « zones non mesurées », jamais en 0', () => {
  const p = pane({ pane_id: 'w4:p4' });
  const r = lancer({
    panes: [p],
    agents: [{ ...p, herdr_socket: SOCKET_DU_BANC }],
    sansTranscrit: ['w4:p4'],
  });
  assert.equal(
    r.status, SORTIES[VERDICTS.ZONES_NON_MESUREES],
    'une garde qui ne peut dater personne et rend vert certifie un parc qu’elle n’a pas regardé'
  );
});

test('une FRONTIÈRE contredite par le registre fait REFUSER le binaire', () => {
  // Le geste d'entretien, joué jusqu'au bout de la chaîne réelle : une déclaration ANTÉRIEURE
  // à la frontière prouve que le dispositif tournait déjà, donc la garde ne se prononce pas.
  const r = lancer({
    panes: [pane()],
    agents: [{ ...pane(), herdr_socket: SOCKET_DU_BANC }],
    declarations: [declaration({ ne_le: '2026-08-01T10:00:00.000Z', nom: 'temiscouata' })],
  });
  assert.equal(r.status, SORTIE_REFUS, r.stdout + r.stderr);
  assert.match(`${r.stdout}${r.stderr}`, /temiscouata/);
});

test('`--json` rend la structure entière, pour qu’une chaîne puisse s’en servir', () => {
  const r = spawnSync(process.execPath, [BIN, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: bac, PATH: `${join(bac, 'bin')}:${process.env.PATH}`,
      HERDR_SOCKET_PATH: SOCKET_DU_BANC, SOMTECH_NAISSANCES_RACINE: join(bac, 'vide') },
  });
  const lu = JSON.parse(r.stdout);
  assert.ok(Object.hasOwn(lu, 'verdict'));
  assert.ok(Object.hasOwn(lu, 'comptes'));
  assert.ok(Object.hasOwn(lu, 'methode'), 'un chiffre sans sa méthode est un fait invérifiable');
});

test('la commande est DÉCLARÉE — un binaire que rien ne déclare n’est atteignable par personne', () => {
  // ⚠️ « ÉCRIT » N'EST PAS « ATTEIGNABLE ». Le fichier peut être parfait et sa garde parfaite :
  // tant qu'aucun manifeste ne le nomme, il n'existe que pour qui connaît son chemin. C'est la
  // moitié qui manque le plus souvent — le motif « fusionné, publié, installé ».
  const manifeste = JSON.parse(readFileSync(join(resolve(ICI, '..'), 'package.json'), 'utf8'));
  const declaree = Object.entries(manifeste.bin ?? {}).find(([, c]) => c === 'bin/garde-des-naissances.js');
  assert.ok(declaree, 'la garde des naissances n’est déclarée dans aucun `bin` du manifeste');
  assert.match(declaree[0], /garde/, 'le nom de la commande doit dire qu’elle garde');
});

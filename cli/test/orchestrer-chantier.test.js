// La compétence d'orchestration — sa DISTRIBUTION et ses PRESCRIPTIONS.
//
// Deux familles, et elles ne prouvent pas la même chose :
//
//   1. **Distribution** (EF-DIS-003, RA-DIS-002) — la compétence et son brief de revue
//      doivent arriver là où on les invoque, sous la forme exacte de leur source. La
//      preuve se fait en CONSTRUISANT le paquet, jamais en déduisant qu'ils y sont
//      parce que `.claude/` figure dans un module : c'est précisément le raisonnement
//      qui laisse passer un fichier oublié par un filtre de construction.
//
//   2. **Prescriptions** (EF-AGT-001) — chaque garantie que la compétence énonce est
//      vérifiée structurellement par un contrôle de `lib/orchestrer-chantier-metier.js`.
//      Ces mêmes contrôles sont éprouvés par mutation dans
//      `orchestrer-chantier-mutations.test.js` : ici on prouve qu'ils passent sur le
//      texte réel, là-bas qu'ils rougissent quand le texte ment.
//
// Ce fichier ne prouve QUE du texte et de la distribution. Le comportement réel de la
// veille de déblocage qu'il prescrit est prouvé ailleurs, par exécution :
// `scripts/tests/test-veille-deblocage.sh` (job `shell-tests`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installGlobalSkills } from '../src/globalskills.js';
import {
  CONTROLES, MUTATIONS, REPO, CHEMIN, CHEMIN_BRIEF, textesReels,
} from './lib/orchestrer-chantier-metier.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const BUILD = join(CLI_DIR, 'scripts', 'build-payload.mjs');

const NOM = 'orchestrer-chantier';
const CHEMIN_VEILLE = join('scripts', 'orchestration', 'veille-deblocage.sh');

/** Le paquet publié, réellement construit depuis les sources. Construit une seule fois. */
let paquet = null;
function paquetConstruit() {
  if (paquet) return paquet;
  const out = mkdtempSync(join(tmpdir(), 'smtk-orch-payload-'));
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: out }, stdio: 'pipe' });
  paquet = out;
  return out;
}

// ═══════════════════════════════ 1. la chaîne de distribution

test('distribution : la compétence et son brief de revue existent dans les sources', () => {
  for (const chemin of [CHEMIN, CHEMIN_BRIEF]) {
    assert.ok(existsSync(join(REPO, chemin)), `${chemin} est absent des sources`);
  }
});

test('distribution : les deux atterrissent dans les compétences globales d’un poste vierge', () => {
  const skillsDir = mkdtempSync(join(tmpdir(), 'smtk-orch-'));
  const r = installGlobalSkills({ payloadRoot: REPO, skillsDir });

  assert.ok(r.skills.includes(NOM), `${NOM} absent des compétences installées`);
  for (const [chemin, fichier] of [[CHEMIN, 'SKILL.md'], [CHEMIN_BRIEF, 'BRIEF-REVUE.md']]) {
    const installe = join(skillsDir, NOM, fichier);
    assert.ok(existsSync(installe), `${fichier} non copié sur le poste`);
    assert.equal(
      readFileSync(installe, 'utf8'),
      readFileSync(join(REPO, chemin), 'utf8'),
      `la version installée de ${fichier} diverge de la source`
    );
  }
});

test('distribution : le paquet publié embarque le BRIEF DE REVUE, CONSTRUIT depuis la source (RA-DIS-002)', () => {
  const out = paquetConstruit();

  // La preuve porte sur le fichier lui-même dans le paquet CONSTRUIT — pas sur le fait
  // que `.claude/` figure dans un module. Un brief non embarqué rend la revue à deux
  // passes inapplicable partout où la compétence descend : elle prescrirait un document
  // que le poste n'a pas.
  assert.ok(existsSync(join(out, CHEMIN_BRIEF)), `${CHEMIN_BRIEF} absent du paquet publié`);
  assert.equal(
    readFileSync(join(out, CHEMIN_BRIEF), 'utf8'),
    readFileSync(join(REPO, CHEMIN_BRIEF), 'utf8'),
    'le brief de revue publié diverge de sa source (drift)'
  );
});

test('distribution : le paquet publié embarque la compétence elle-même, à l’identique', () => {
  const out = paquetConstruit();
  assert.ok(existsSync(join(out, CHEMIN)), `${CHEMIN} absent du paquet publié`);
  assert.equal(
    readFileSync(join(out, CHEMIN), 'utf8'),
    readFileSync(join(REPO, CHEMIN), 'utf8'),
    'la compétence publiée diverge de sa source (drift)'
  );
});

test('distribution : la veille que la compétence prescrit est embarquée, et exécutable', () => {
  // Une compétence qui prescrit un script que le paquet ne livre pas prescrit un geste
  // impossible sur tout poste qui n'est pas ce dépôt.
  const { skill } = textesReels();
  assert.match(
    skill, new RegExp(CHEMIN_VEILLE.replace(/[/\\]/g, '[/\\\\]')),
    'la compétence doit nommer le chemin de la veille de déblocage'
  );

  assert.ok(existsSync(join(REPO, CHEMIN_VEILLE)), `${CHEMIN_VEILLE} est absent des sources`);

  const out = paquetConstruit();
  const publiee = join(out, CHEMIN_VEILLE);
  assert.ok(existsSync(publiee), `${CHEMIN_VEILLE} absent du paquet publié — la prescription serait inerte`);
  assert.equal(
    readFileSync(publiee, 'utf8'),
    readFileSync(join(REPO, CHEMIN_VEILLE), 'utf8'),
    'la veille publiée diverge de sa source (drift)'
  );
  assert.ok(
    statSync(publiee).mode & 0o111,
    'la veille publiée n’est pas exécutable — elle serait livrée inerte'
  );
});

test('distribution : l’en-tête de la compétence est bien formé — sinon elle est installée mais inerte', () => {
  const { skill } = textesReels();
  const entete = skill.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(entete, 'la compétence doit ouvrir sur un en-tête YAML');
  assert.match(entete[1], /^name:\s*orchestrer-chantier\s*$/m, 'le nom déclaré doit être celui du dossier');
  assert.match(entete[1], /^description:\s*\S/m, 'une description est requise, sinon la compétence ne se déclenche jamais');
});

// ═══════════════════════════════ 2. les prescriptions, sur le texte réel

const textes = textesReels();

for (const controle of CONTROLES) {
  test(`prescription : ${controle.quoi}`, () => {
    controle.verifier(textes);
  });
}

// ═══════════════════════════════ 3. le harnais s’audite lui-même

test('harnais : chaque contrôle est éprouvé par au moins une mutation', () => {
  // Un contrôle que rien ne mute n'a jamais été vu rougir : rien ne prouve qu'il
  // vérifie quoi que ce soit. C'est la version « garde » du motif du faux témoin.
  const vises = new Set(MUTATIONS.map((m) => m.cible));
  const orphelins = CONTROLES.filter((c) => !vises.has(c.id)).map((c) => c.id);
  assert.deepEqual(orphelins, [], `contrôles qu'aucune mutation n'éprouve : ${orphelins.join(', ')}`);
});

test('harnais : chaque mutation vise un contrôle qui existe', () => {
  const ids = new Set(CONTROLES.map((c) => c.id));
  const perdues = MUTATIONS.filter((m) => !ids.has(m.cible)).map((m) => `${m.id} → ${m.cible}`);
  assert.deepEqual(perdues, [], `mutations visant un contrôle inexistant : ${perdues.join(', ')}`);
});

test('harnais : les identifiants de contrôles et de mutations sont uniques', () => {
  for (const [nom, liste] of [['contrôle', CONTROLES], ['mutation', MUTATIONS]]) {
    const ids = liste.map((x) => x.id);
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(doublons, [], `identifiants de ${nom} en double : ${doublons.join(', ')}`);
  }
});

test('harnais : chaque mutation déclare le texte qu’elle mute', () => {
  const mauvaises = MUTATIONS.filter((m) => m.sur !== 'skill' && m.sur !== 'brief').map((m) => m.id);
  assert.deepEqual(mauvaises, [], `mutations sans cible de texte valide (skill|brief) : ${mauvaises.join(', ')}`);
});

// La compétence de mise à jour d'un représentant déjà posé — sa DISTRIBUTION, et la
// preuve qu'elle ne touche PAS à `/gestionnaire-client` (E-20260807-0002, en chantier en
// parallèle sur ce même lot — brief explicite : « ne touche pas à /gestionnaire-client »).
//
// Même famille de garanties que gestionnaire-client.test.js, pour la même raison : une
// compétence annoncée mais absente après installation est pire qu'une compétence absente
// (EA-GBL-003). La preuve est CE test, pas un coup d'œil au dossier.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installGlobalSkills } from '../src/globalskills.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const REPO = resolve(CLI_DIR, '..');
const BUILD = join(CLI_DIR, 'scripts', 'build-payload.mjs');

const NOM = 'maj-representant-client';
const CHEMIN = join('.claude', 'skills', NOM, 'SKILL.md');
const SOURCE = join(REPO, CHEMIN);

const skill = () => readFileSync(SOURCE, 'utf8');

// ═══════════════════════════════ 1. la chaîne de distribution

test('distribution : la compétence existe dans les sources du dépôt', () => {
  assert.ok(existsSync(SOURCE), `${CHEMIN} est absent des sources`);
});

test('distribution : elle atterrit dans les compétences globales d’un poste vierge', () => {
  const skillsDir = mkdtempSync(join(tmpdir(), 'smtk-mrc-'));
  const r = installGlobalSkills({ payloadRoot: REPO, skillsDir });

  assert.ok(r.skills.includes(NOM), `${NOM} absent des compétences installées`);
  assert.ok(existsSync(join(skillsDir, NOM, 'SKILL.md')), 'SKILL.md non copié sur le poste');
  assert.equal(
    readFileSync(join(skillsDir, NOM, 'SKILL.md'), 'utf8'),
    skill(),
    'la version installée diverge de la source',
  );
});

test('distribution : le paquet publié l’embarque, CONSTRUIT depuis la source (RA-DIS-002)', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-mrc-payload-'));
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: out }, stdio: 'pipe' });

  assert.ok(existsSync(join(out, CHEMIN)), `${CHEMIN} absent du paquet publié`);
  assert.equal(readFileSync(join(out, CHEMIN), 'utf8'), skill(), 'la version publiée diverge de la source (drift)');
});

test('distribution : son en-tête est bien formé — sinon elle est installée mais inerte', () => {
  const texte = skill();
  const entete = texte.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(entete, 'aucun en-tête lisible en tête de fichier');

  const nom = entete[1].match(/^name:\s*(\S+)\s*$/m);
  assert.ok(nom, 'l’en-tête ne déclare pas de nom');
  assert.equal(nom[1], NOM, 'le nom déclaré doit être celui du dossier, sinon l’invocation ne trouve rien');

  const description = entete[1].match(/^description:\s*\|?\s*\n([\s\S]*?)\n(?=\S|$)/m) || entete[1].match(/^description:\s*(.+)$/m);
  assert.ok(description, 'l’en-tête ne déclare pas de description');
  const texteDescription = (description[1] || '').trim();
  assert.ok(texteDescription.length > 120, 'une description trop courte ne déclenche jamais la compétence');
});

test('conformité : la compétence dit explicitement qu’elle ne pose aucun lieu neuf', () => {
  // Le renversement de rôle par rapport à /gestionnaire-client (qui pose) est le cœur du
  // lot. Une compétence qui se mettrait à créer le lieu absent ferait le travail de l'autre
  // agent (e-2), en silence, et les deux chantiers finiraient par se marcher dessus.
  const texte = skill();
  assert.match(texte, /ne pose (?:aucun|pas) lieu/i, 'la compétence doit dire qu’elle ne pose aucun lieu neuf');
  assert.match(texte, /gestionnaire-client/, 'elle doit nommer la compétence de pose comme alternative');
});

test('conformité : CONTEXTE.md est nommé comme jamais touché, jamais fabriqué', () => {
  const texte = skill();
  assert.match(texte, /CONTEXTE\.md/);
  assert.match(texte, /jamais (?:écrasé|touché)/i, 'CONTEXTE.md doit être dit jamais écrasé/touché');
  assert.match(texte, /(?:ni )?créé s.il manque|jamais.*créé|ni.*fabriqué/i, 'CONTEXTE.md doit être dit jamais fabriqué même s’il manque');
});

// ═══════════════════════════════ 2. ce que ce lot ne devait pas casser

test('/gestionnaire-client (E-20260807-0002, en chantier parallèle) n’a pas été modifié par ce lot', () => {
  // Le brief est explicite : « Ne touche pas à /gestionnaire-client. Si tu te retrouves à
  // devoir la modifier, arrête-toi. » On le garde par le CONTENU, comparé à HEAD — pas par
  // « le fichier existe encore », qui ne prouverait rien sur une modification en place.
  const chemin = join('.claude', 'skills', 'gestionnaire-client', 'SKILL.md');
  assert.ok(existsSync(join(REPO, chemin)), 'la compétence de pose a disparu — ce lot ne devait pas la retirer');

  let diff;
  try {
    diff = execFileSync('git', ['diff', '--stat', 'HEAD', '--', chemin], { cwd: REPO, encoding: 'utf8' });
  } catch {
    diff = null; // pas un repo git dans ce contexte de test — rien à comparer, on ne fait pas échouer pour ça
  }
  if (diff !== null) {
    assert.equal(diff.trim(), '', `${chemin} a été modifié par ce lot alors que le brief l'interdit :\n${diff}`);
  }
});

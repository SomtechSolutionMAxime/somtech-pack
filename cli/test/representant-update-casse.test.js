// La mise à jour d'un lieu, face à la casse de son nom (T-20260814-0101).
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT, ET POURQUOI IL A SURVÉCU À UNE SUITE VERTE
//
// La pose écrivait `.gestionnaire/Francois` ; la mise à jour exigeait un slug MINUSCULE et
// visait donc `.gestionnaire/francois`. Sur macOS, les deux désignent le même dossier : la
// commande atteignait le bon lieu et PARAISSAIT marcher. Sur un volume sensible à la casse,
// elle aurait créé un second lieu, vide et muet, pendant que le vrai restait périmé.
//
// Quatre lieux réels sur cinq portent une majuscule (`Charles-Olivier`, `Francois`, `Jacob`,
// `Zach`) : aucun n'était atteignable, et la commande de mise à jour est précisément le geste
// qui fait qu'un gestionnaire déjà posé reprend le métier neuf.
//
// DEUX FAMILLES DE PREUVES, et elles ne se remplacent pas :
//   1. ce que le CODE fait — le lieu RÉEL est écrit, prouvé par CONTENU comparé sur le
//      chemin exact, indépendamment de l'indulgence du système de fichiers ;
//   2. ce que le SYSTÈME permet — le second dossier, prouvable seulement sur un volume
//      SENSIBLE à la casse. Sauté ici quand il ne l'est pas, plutôt que supposé ; la CI
//      Linux l'exécute pour de bon.
// ═════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { run } from '../src/cli.js';
import { alignerLePosteSur } from './lib/poste-conforme.js';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

const CLAUDE_V1 = '# Tu es le représentant de ce client\n\nversion 1 du métier.\n';
const CLAUDE_V2 = '# Tu es le représentant de ce client\n\nversion 2 du métier — corrige un défaut de la v1.\n';
const CONTEXTE = '# Ce qu\'on sait de ce client\n\nLe client : Acme.\n';

function makeFixturePayload() {
  const root = tmp('smtk-casse-payload-');
  writeFileSync(join(root, 'pack.json'), JSON.stringify({
    name: 'fixture-pack', version: '9.9.9',
    modules: { core: { default: true, paths: ['.claude/'] } },
  }, null, 2));
  const gabarit = join(root, '.claude', 'templates', 'gestionnaire-client');
  mkdirSync(gabarit, { recursive: true });
  writeFileSync(join(gabarit, 'CLAUDE.md'), CLAUDE_V2);
  writeFileSync(join(gabarit, 'CONTEXTE.md'), CONTEXTE);
  // LE POSTE EST RENDU CONFORME À CE PAYLOAD — la garde de fraîcheur tourne donc sous
  // cette suite, elle compare, et elle trouve identique. On ne la désarme pas : on lui
  // donne un poste qui sert le même pack que la fixture (voir lib/poste-conforme.js).
  alignerLePosteSur(root);
  return root;
}

/** Un dépôt client avec un lieu POSÉ sous le nom exact demandé — majuscules comprises. */
function makeClientRepo(nomDuLieu) {
  const repo = tmp('smtk-casse-client-');
  const lieu = join(repo, '.gestionnaire', nomDuLieu);
  mkdirSync(lieu, { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), CLAUDE_V1);
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE);
  return repo;
}

/** Mesuré, jamais supposé d'après la plateforme. */
function fsSensibleALaCasse() {
  const racine = tmp('smtk-casse-sonde-');
  try {
    mkdirSync(join(racine, 'Sonde'));
    return !existsSync(join(racine, 'sonde'));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}
const SENSIBLE = fsSensibleALaCasse();
const SAUT_INSENSIBLE = 'volume insensible à la casse : c’est exactement ce que macOS masque — non prouvable ici, la CI Linux l’exécute';

// ═══════════════════════════════ 1. les quatre lieux réels redeviennent atteignables

test('un lieu à majuscule est mis à jour quand on le nomme TEL QU’IL EST — ce qui était refusé', async () => {
  const payload = makeFixturePayload();
  for (const nom of ['Charles-Olivier', 'Francois', 'Jacob', 'Zach']) {
    const repo = makeClientRepo(nom);

    const code = await run(['representant-update', '--client', nom, '--source', payload, '--target', repo]);

    assert.equal(code, 0, `« ${nom} » doit être accepté — c’est un des quatre lieux réels du poste`);
    assert.equal(
      readFileSync(join(repo, '.gestionnaire', nom, 'CLAUDE.md'), 'utf8'), CLAUDE_V2,
      'le métier doit avoir convergé DANS le lieu réel — prouvé par contenu, pas par le code de sortie',
    );
  }
});

test('« maxime » (le seul en minuscules) continue de marcher — aucune régression', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo('maxime');

  const code = await run(['representant-update', '--client', 'maxime', '--source', payload, '--target', repo]);

  assert.equal(code, 0);
  assert.equal(readFileSync(join(repo, '.gestionnaire', 'maxime', 'CLAUDE.md'), 'utf8'), CLAUDE_V2);
});

// ═══════════════════════════════ 2. le lieu RÉEL est atteint, quelle que soit la casse tapée

test('nommé en minuscules, un lieu posé en majuscules est RETROUVÉ et mis à jour', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo('Francois');

  const code = await run(['representant-update', '--client', 'francois', '--source', payload, '--target', repo]);

  assert.equal(code, 0);
  assert.equal(
    readFileSync(join(repo, '.gestionnaire', 'Francois', 'CLAUDE.md'), 'utf8'), CLAUDE_V2,
    'le lieu RÉEL doit porter le métier neuf',
  );
});

test('aucun SECOND lieu n’est créé quand la casse tapée diffère de celle du disque', { skip: SENSIBLE ? false : SAUT_INSENSIBLE }, async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo('Francois');

  await run(['representant-update', '--client', 'francois', '--source', payload, '--target', repo]);

  assert.deepEqual(
    readdirSync(join(repo, '.gestionnaire')).sort(), ['Francois'],
    'un second lieu serait né à côté du vrai — vide, muet, et le vrai resterait périmé',
  );
});

test('deux lieux homonymes : la commande REFUSE de deviner, et n’écrit rien', { skip: SENSIBLE ? false : SAUT_INSENSIBLE }, async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo('Francois');
  const jumeau = join(repo, '.gestionnaire', 'francois');
  mkdirSync(jumeau, { recursive: true });
  writeFileSync(join(jumeau, 'CLAUDE.md'), CLAUDE_V1);

  const code = await run(['representant-update', '--client', 'FRANCOIS', '--source', payload, '--target', repo]);

  assert.notEqual(code, 0, 'choisir au hasard reviendrait à mettre à jour un lieu mort');
  assert.equal(readFileSync(join(repo, '.gestionnaire', 'Francois', 'CLAUDE.md'), 'utf8'), CLAUDE_V1, 'rien ne doit avoir été écrit');
  assert.equal(readFileSync(jumeau + '/CLAUDE.md', 'utf8'), CLAUDE_V1, 'rien ne doit avoir été écrit dans l’autre non plus');
  assert.deepEqual(readdirSync(join(repo, '.gestionnaire')).sort(), ['Francois', 'francois'], 'et aucun troisième lieu');
});

// ═══════════════════════════════ 3. la garde anti-évasion, elle, n'a pas bougé

test('un nom qui traverse un répertoire reste refusé — la garde ne s’est pas desserrée', async () => {
  const payload = makeFixturePayload();
  for (const nom of ['../evil', '../../evil', '..', '.', 'a/b', 'a\\b', '', '.cache', '-drapeau', 'a b']) {
    const repo = makeClientRepo('acme');

    const code = await run(['representant-update', '--client', nom, '--source', payload, '--target', repo]);

    assert.notEqual(code, 0, `« ${nom} » doit rester refusé`);
    assert.equal(existsSync(join(repo, 'evil')), false, 'rien ne doit avoir fui hors de .gestionnaire/');
    assert.equal(existsSync(join(repo, '..', 'evil')), false, 'rien ne doit avoir fui hors du dépôt');
    assert.deepEqual(readdirSync(join(repo, '.gestionnaire')).sort(), ['acme'], 'aucun lieu ne doit être né d’un nom refusé');
  }
});

// ═══════════════════════════════ 4. l'orchestrateur suit la même règle — les DEUX rôles

test('l’orchestrateur aussi : lieu à majuscule retrouvé, évasion refusée', async () => {
  const payload = tmp('smtk-casse-orch-');
  writeFileSync(join(payload, 'pack.json'), JSON.stringify({
    name: 'fixture-pack', version: '9.9.9', modules: { core: { default: true, paths: ['.claude/'] } },
  }, null, 2));
  const gabarit = join(payload, '.claude', 'templates', 'orchestrateur');
  mkdirSync(gabarit, { recursive: true });
  writeFileSync(join(gabarit, 'CLAUDE.md'), CLAUDE_V2);

  const repo = tmp('smtk-casse-orch-repo-');
  mkdirSync(join(repo, '.orchestrateur', 'D-20260813-0002'), { recursive: true });
  writeFileSync(join(repo, '.orchestrateur', 'D-20260813-0002', 'CLAUDE.md'), CLAUDE_V1);

  const code = await run(['orchestrateur-update', '--nom', 'd-20260813-0002', '--source', payload, '--target', repo]);
  assert.equal(code, 0, 'un chantier nommé en majuscules doit être atteignable — les codes de chantier en portent toujours');
  assert.equal(readFileSync(join(repo, '.orchestrateur', 'D-20260813-0002', 'CLAUDE.md'), 'utf8'), CLAUDE_V2);

  const refus = await run(['orchestrateur-update', '--nom', '../evil', '--source', payload, '--target', repo]);
  assert.notEqual(refus, 0, 'l’évasion doit être refusée sur ce rôle aussi — pas une porte sur deux');
  assert.equal(existsSync(join(repo, 'evil')), false);
});

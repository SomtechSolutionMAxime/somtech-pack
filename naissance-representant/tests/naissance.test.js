// naissance.test.js — le lieu n'est jamais créé ici (E-20260807-0002 le pose), et le garde
// est FUSIONNÉ dans son `.claude/settings.json` à CHAQUE naissance — jamais écrit à part,
// jamais en écrasant les permissions déjà là.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GABARITS } from '../../ligne-directe/src/representant.js';
import {
  cheminLieu,
  cheminHook,
  verifierLieu,
  LieuAbsent,
  fusionnerGarde,
  poserGarde,
  gardePose,
  commandesNaissance,
} from '../src/naissance.js';

const PERMISSIONS_DU_LIEU = { permissions: { allow: ['mcp__servicedesk__*'], deny: ['Edit', 'Write'] } };

function repoTemp() {
  return mkdtempSync(join(tmpdir(), 'smtk-naissance-'));
}

/** Un lieu COMPLET — les 4 fichiers que `ligne-directe representant` pose réellement. */
function poserLeLieu(repoRoot, client, { omettre = [], settings = PERMISSIONS_DU_LIEU } = {}) {
  const lieu = cheminLieu(repoRoot, client);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  const contenus = {
    'CLAUDE.md': '# Tu es le représentant de ce client\n',
    'CONTEXTE.md': "# Ce qu'on sait de ce client\n",
    '.mcp.json': '{"mcpServers":{"servicedesk":{}}}\n',
    [join('.claude', 'settings.json')]: `${JSON.stringify(settings)}\n`,
  };
  for (const [f, c] of Object.entries(contenus)) {
    if (!omettre.includes(f)) writeFileSync(join(lieu, f), c);
  }
  return lieu;
}

test('naître refuse quand le lieu n’a pas été posé du tout — la naissance ne le crée jamais', () => {
  const repoRoot = repoTemp();
  try {
    assert.throws(() => verifierLieu(repoRoot, 'acme'), LieuAbsent);
    assert.throws(() => poserGarde(repoRoot, 'acme'), LieuAbsent);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('naître refuse un lieu INCOMPLET — chacun des 4 gabarits est requis, un à la fois', () => {
  const repoRoot = repoTemp();
  try {
    for (const manquant of GABARITS) {
      const client = `acme-sans-${manquant.replace(/[/.]/g, '-')}`;
      poserLeLieu(repoRoot, client, { omettre: [manquant] });
      assert.throws(
        () => verifierLieu(repoRoot, client),
        (err) => err instanceof LieuAbsent && err.manquants.includes(manquant)
      );
    }
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('naître accepte un lieu posé avec ses 4 gabarits', () => {
  const repoRoot = repoTemp();
  try {
    poserLeLieu(repoRoot, 'acme');
    assert.equal(verifierLieu(repoRoot, 'acme'), cheminLieu(repoRoot, 'acme'));
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

// ═══════════════════════════════ fusionnerGarde — jamais écraser les permissions du lieu

test('fusionnerGarde préserve les permissions existantes intégralement', () => {
  const fusionne = fusionnerGarde(PERMISSIONS_DU_LIEU, '/repo');
  assert.deepEqual(fusionne.permissions, PERMISSIONS_DU_LIEU.permissions);
});

test('fusionnerGarde ajoute le PreToolUse pointant le vrai garde, au bon chemin', () => {
  const fusionne = fusionnerGarde(PERMISSIONS_DU_LIEU, '/repo');
  const commande = fusionne.hooks.PreToolUse[0].hooks[0].command;
  assert.match(commande, /naissance-representant\/hooks\/garde-ouverture-ligne\.js$/);
});

test('fusionnerGarde est idempotent — reposer deux fois ne double pas le hook', () => {
  const uneFois = fusionnerGarde(PERMISSIONS_DU_LIEU, '/repo');
  const deuxFois = fusionnerGarde(uneFois, '/repo');
  assert.equal(deuxFois.hooks.PreToolUse.length, 1);
  assert.deepEqual(deuxFois, uneFois);
});

test('fusionnerGarde préserve un hook PreToolUse déjà présent, ajouté par ailleurs', () => {
  const avecAutreHook = { ...PERMISSIONS_DU_LIEU, hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'autre-chose' }] }] } };
  const fusionne = fusionnerGarde(avecAutreHook, '/repo');
  assert.equal(fusionne.hooks.PreToolUse.length, 2);
  assert.ok(fusionne.hooks.PreToolUse.some((b) => b.hooks[0].command === 'autre-chose'));
});

// ═══════════════════════════════ poserGarde — écrit RÉELLEMENT, dans LEUR fichier

test('poserGarde fusionne dans .claude/settings.json du lieu, sans en créer un second', () => {
  const repoRoot = repoTemp();
  try {
    poserLeLieu(repoRoot, 'acme');
    const chemin = poserGarde(repoRoot, 'acme');
    assert.equal(chemin, join(cheminLieu(repoRoot, 'acme'), '.claude', 'settings.json'));
    assert.ok(!existsSync(join(cheminLieu(repoRoot, 'acme'), 'settings.json')), 'aucun settings.json à plat ne doit apparaître');

    const relu = gardePose(repoRoot, 'acme');
    assert.deepEqual(relu.permissions, PERMISSIONS_DU_LIEU.permissions, 'leurs permissions doivent survivre intactes');
    assert.match(relu.hooks.PreToolUse[0].hooks[0].command, /garde-ouverture-ligne\.js$/);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('poserGarde reste idempotent sur disque — reposer deux fois ne change plus rien', () => {
  const repoRoot = repoTemp();
  try {
    poserLeLieu(repoRoot, 'acme');
    poserGarde(repoRoot, 'acme');
    const premierContenu = readFileSync(join(cheminLieu(repoRoot, 'acme'), '.claude', 'settings.json'), 'utf8');
    poserGarde(repoRoot, 'acme');
    const secondContenu = readFileSync(join(cheminLieu(repoRoot, 'acme'), '.claude', 'settings.json'), 'utf8');
    assert.equal(premierContenu, secondContenu);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('VÉRIFICATION — deux naissances du même client posent un garde OCTET POUR OCTET identique', () => {
  // « Le représentant est-il le même à chaque naissance ? » — comparé ici sur ce que la
  // naissance elle-même écrit (le hook, une fois fusionné), sans relire le gabarit
  // CLAUDE.md/CONTEXTE.md : celui-ci est déjà comparé octet pour octet par
  // cli/test/lib/metier-representant.js (contrôle « aucune-substitution »).
  const repoRoot = repoTemp();
  try {
    poserLeLieu(repoRoot, 'acme');
    poserGarde(repoRoot, 'acme');
    const contenu1 = gardePose(repoRoot, 'acme');

    // Deux CLIENTS DIFFÉRENTS, avec des permissions de départ IDENTIQUES (le cas réel :
    // le même gabarit est copié pour chacun) : le garde fusionné doit être identique.
    poserLeLieu(repoRoot, 'autre-client');
    poserGarde(repoRoot, 'autre-client');
    const contenuAutre = gardePose(repoRoot, 'autre-client');
    assert.deepEqual(contenu1, contenuAutre, 'le garde doit être identique quel que soit le client');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

// ═══════════════════════════════ les commandes herdr — construites, jamais exécutées ici

test('commandesNaissance exige --workspace, sans deviner un défaut', () => {
  assert.throws(() => commandesNaissance('/repo', 'acme', {}), /--workspace/);
});

test('commandesNaissance construit des tableaux d’arguments herdr — AUCUN shell, comme herdr.js', () => {
  const c = commandesNaissance('/repo', 'acme', { workspace: 'w1' });
  assert.deepEqual(c.tabCreate, ['tab', 'create', '--workspace', 'w1', '--label', 'acme', '--no-focus']);
  assert.deepEqual(c.renommer('w1:p1'), ['agent', 'rename', 'w1:p1', 'acme']);
});

test('commandesNaissance lance depuis le lieu lui-même (cd) — .mcp.json et .claude/settings.json s’y lisent sans drapeau', () => {
  const c = commandesNaissance('/repo', 'acme', { workspace: 'w1' });
  assert.deepEqual(c.paneRun('w1:p1'), ['pane', 'run', 'w1:p1', 'cd /repo/.gestionnaire/acme && claude']);
});

test('cheminHook et cheminLieu restent sous la racine passée — pas d’absolu en dur', () => {
  assert.match(cheminHook('/un/repo'), /^\/un\/repo\//);
  assert.match(cheminLieu('/un/repo', 'acme'), /^\/un\/repo\/\.gestionnaire\/acme$/);
});

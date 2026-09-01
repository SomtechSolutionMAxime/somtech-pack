// lieu.test.js — le garde ne doit jamais s'appliquer à une session qui n'est pas née dans
// le lieu d'un représentant. Un faux positif bloquerait des sessions ordinaires ; un faux
// négatif laisserait un représentant naître sans son garde — les deux sont testés.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { estUnLieuDeRepresentant } from '../src/lieu.js';
import { rolesConnus } from '../../ligne-directe/src/roles.js';

function dirTemp() {
  return mkdtempSync(join(tmpdir(), 'smtk-lieu-'));
}

/** Les 4 fichiers qu'un lieu réellement posé porte (`GABARITS`) — sauf ceux à `omettre`. */
function poserGabarits(d, { omettre = [], contenus = {} } = {}) {
  const defauts = {
    'CLAUDE.md': '# Tu es le représentant de ce client\n\nsuite...\n',
    'CONTEXTE.md': "# Ce qu'on sait de ce client\n\nsuite...\n",
    '.mcp.json': '{"mcpServers":{"servicedesk":{}}}\n',
    [join('.claude', 'settings.json')]: '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n',
  };
  for (const [f, c] of Object.entries({ ...defauts, ...contenus })) {
    if (!omettre.includes(f)) {
      mkdirSync(join(d, dirname(f)), { recursive: true });
      writeFileSync(join(d, f), c);
    }
  }
}

test('un répertoire sans aucun gabarit n’est pas un lieu de représentant', () => {
  const d = dirTemp();
  try {
    assert.equal(estUnLieuDeRepresentant(d), false);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('un CONTEXTE.md seul, sans CLAUDE.md, n’est pas un lieu de représentant', () => {
  const d = dirTemp();
  try {
    writeFileSync(join(d, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
    assert.equal(estUnLieuDeRepresentant(d), false);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('des fichiers nommés pareil mais au CONTENU différent ne suffisent pas — un projet quelconque avec un CONTEXTE.md sans rapport ne doit pas être gardé à tort', () => {
  const d = dirTemp();
  try {
    poserGabarits(d, { contenus: { 'CLAUDE.md': '# Un projet ordinaire\n', 'CONTEXTE.md': '# Notes de réunion\n' } });
    assert.equal(estUnLieuDeRepresentant(d), false);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('CLAUDE.md et CONTEXTE.md à bon en-tête, mais SANS .mcp.json ni .claude/settings.json — pas encore un lieu (lieu partiel)', () => {
  // Un lieu POSÉ PARTIELLEMENT (interrompu en chemin) ne doit pas se faire passer pour
  // complet — le garde s'appliquerait à une session qui n'a ni son registre ni ses
  // permissions.
  const d = dirTemp();
  try {
    poserGabarits(d, { omettre: ['.mcp.json', join('.claude', 'settings.json')] });
    assert.equal(estUnLieuDeRepresentant(d), false);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('les quatre gabarits, avec leur en-tête réel, reconnaissent le lieu', () => {
  const d = dirTemp();
  try {
    poserGabarits(d);
    assert.equal(estUnLieuDeRepresentant(d), true);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA GARDE DU LITTÉRAL QUI RESTE (T-20260826-0076, point 6)
//
// `estUnLieuDeRepresentant` compare à `'representant'` EN DUR, et ce littéral a été CONSERVÉ :
// il ne décide pas, il définit — le nom de la fonction nomme le rôle, et il n'existe aucune
// propriété de registre à dériver pour répondre « est-ce CE rôle-ci ».
//
// ⚠️ MAIS SON UNIQUE MODE DE PANNE EST MUET, et c'est lui qu'on ferme ici. Le jour où la clé
// « representant » changerait de nom au registre, ce prédicat rendrait `false` POUR TOUJOURS,
// sans qu'une erreur ne parte : le garde d'origine cesserait de reconnaître le lieu qu'il
// existe pour reconnaître. Les cinq essais ci-dessus resteraient verts — ils posent leurs
// gabarits eux-mêmes et ne consultent jamais le registre.
test('« representant » est un rôle CONNU du registre — sinon ce prédicat est mort en silence', () => {
  assert.ok(
    rolesConnus().includes('representant'),
    'le registre ne connaît plus la clé « representant » : `estUnLieuDeRepresentant` rend désormais ' +
      `false pour tout répertoire, sans le dire. Les rôles connus sont : ${rolesConnus().join(', ')}.`,
  );
});

// metier-gardes-distribuees.test.js — les gardes doivent ARRIVER sur le poste.
//
// Un `settings.json` rendu déclare `~/.somtech/gardes/<garde>.js`. Si rien ne l'y
// dépose, la commande de hook refuse par défaut (bonne polarité) — mais l'agent
// est alors bloqué sur tous ses gestes de terminal. La garde doit donc être
// distribuée comme les autres outils de poste. `T-20260820-0142`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('le pack déclare un module « gardes » de portée POSTE — jamais projet', () => {
  const m = JSON.parse(readFileSync(join(RACINE, 'pack.json'), 'utf8')).modules.gardes;
  assert.ok(m, 'aucun module « gardes » : rien ne les déposerait sur le poste');
  assert.equal(m.scope, 'poste', 'une garde vit sur le poste, pas dans le lieu d un agent');
  assert.deepEqual(m.paths, ['gardes/']);
});

test('le module porte la garde ET sa décision — le fil sans décision ne juge rien', () => {
  assert.ok(existsSync(join(RACINE, 'gardes', 'terminal.js')), 'le fil du hook');
  assert.ok(existsSync(join(RACINE, 'gardes', 'terminal-decision.js')), 'la décision qu il importe');
});

test('les gardes ne partent PAS dans les projets — elles ne sont pas sous un chemin du module core', () => {
  const pack = JSON.parse(readFileSync(join(RACINE, 'pack.json'), 'utf8'));
  for (const [nom, m] of Object.entries(pack.modules)) {
    if (m.scope === 'poste') continue;
    for (const chemin of m.paths || []) {
      assert.ok(!join(RACINE, 'gardes').startsWith(join(RACINE, chemin)),
        `les gardes tomberaient dans le module projet « ${nom} » (${chemin})`);
    }
  }
});

test('le chemin que le rendu écrit et celui où le pack dépose sont le MÊME', async () => {
  const { rendre } = await import('../src/metier/rendu.js');
  const r = rendre({
    role: 'r', version_abc: '1', hooks: [{ evenement: 'PreToolUse', outil: 'Bash', garde: 'terminal' }],
    items: [{ id: 'GF-R-001', nature: 'garde-fou', couche: 'hook', enonce: 'x', enonce_socle: 'c' }],
    chapitres: [],
  });
  const cmd = JSON.parse(r.artefacts['.claude/settings.json']).hooks.PreToolUse[0].hooks[0].command;
  // `pack setup` dépose les modules de portée poste sous ~/.somtech/<paths>
  assert.ok(cmd.includes('$HOME/.somtech/gardes/terminal.js'),
    'le rendu doit viser exactement là où le pack dépose — sinon le hook cherche au mauvais endroit');
});

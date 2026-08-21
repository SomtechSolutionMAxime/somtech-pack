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

test('⚠️ toute garde qu un classement DÉCLARE existe dans le module — c est la jointure des deux étages', () => {
  // Chaque étage est juste séparément : le rendu écrit un chemin `~/.somtech/gardes/<garde>.js`
  // (gardé plus haut), et `pack setup` dépose le module `gardes` (gardé plus haut aussi). La
  // ligne qui les relie — que la garde NOMMÉE par un classement soit bien l'un des fichiers
  // déposés — ne l'était par aucun des deux. Un classement qui déclare `garde: "x"` sans que
  // `gardes/x.js` existe rend un hook qui refuse tout, en silence, chez l'agent.
  const roles = ['orchestrateur', 'gestionnaire-client'];
  let declarees = 0;
  for (const role of roles) {
    const chemin = join(RACINE, 'metier', role, 'classement.json');
    if (!existsSync(chemin)) continue;
    for (const h of JSON.parse(readFileSync(chemin, 'utf8')).hooks || []) {
      // Un hook qui porte sa propre `commande` vise un autre module (la naissance) : le
      // chemin est alors dans la commande, et il est gardé là où ce module vit.
      if (h.commande) continue;
      declarees++;
      assert.ok(existsSync(join(RACINE, 'gardes', `${h.garde}.js`)),
        `le classement de « ${role} » déclare la garde « ${h.garde} », que le module ne porte pas`);
      assert.ok(existsSync(join(RACINE, 'gardes', `${h.garde}-decision.js`)),
        `la garde « ${h.garde} » n a pas de module de décision — un fil sans décision ne juge rien`);
    }
  }
  assert.ok(declarees >= 2, `le contrôle doit avoir vu au moins deux gardes déclarées (${declarees}) — `
    + `un contrôle qui ne trouve rien à vérifier passe pour satisfait`);
});

test('la décision distribuée et celle que le CLI teste sont le MÊME texte — deux copies divergent en silence', () => {
  for (const garde of ['terminal', 'ligne-cliente']) {
    const poste = readFileSync(join(RACINE, 'gardes', `${garde}-decision.js`), 'utf8');
    const cli = readFileSync(join(RACINE, 'cli', 'src', 'metier', 'gardes', `${garde}.js`), 'utf8');
    assert.equal(poste, cli, `« ${garde} » : la copie déposée sur le poste a dérivé de celle que les tests exercent`);
  }
});

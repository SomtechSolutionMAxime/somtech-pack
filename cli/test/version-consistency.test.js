// Garde-fou : les trois porteurs de version du repo doivent être IDENTIQUES.
//
// Le tag git est la source unique (le workflow publish.yml aligne VERSION,
// pack.json et cli/package.json dessus au release). Ce test bloque tout drift
// résiduel dans le repo — c'est exactement le cas qui avait laissé pack.json
// figé à 1.14.0 pendant que le reste était à 1.22.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const REPO_ROOT = resolve(HERE, '..', '..');

const readJsonVersion = (p) => JSON.parse(readFileSync(p, 'utf8')).version;

test('VERSION, pack.json et cli/package.json portent la même version', () => {
  const versionFile = readFileSync(join(REPO_ROOT, 'VERSION'), 'utf8').trim();
  const packJson = readJsonVersion(join(REPO_ROOT, 'pack.json'));
  const cliPkg = readJsonVersion(join(CLI_DIR, 'package.json'));

  assert.equal(
    packJson, versionFile,
    `pack.json (${packJson}) doit == VERSION (${versionFile})`,
  );
  assert.equal(
    cliPkg, versionFile,
    `cli/package.json (${cliPkg}) doit == VERSION (${versionFile})`,
  );
});

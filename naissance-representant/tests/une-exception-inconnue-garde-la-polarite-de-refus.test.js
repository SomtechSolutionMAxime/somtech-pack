// une-exception-inconnue-garde-la-polarite-de-refus.test.js — T-20260914-0004.
//
// Une exception qui ne porte AUCUN des codes mesurés du veilleur (VEILLEUR_MUET,
// VEILLEUR_LENT, VEILLEUR_NE_DEMARRE_PAS, ECONNREFUSED, ENOENT) n'est pas classée « le
// veilleur est en panne » — on n'a rien mesuré de tel. La polarité de refus reste donc
// INTÉGRALE, exactement comme avant ce lot : seul `Read` passe. Ce qui change est SEULEMENT
// la raison, qui doit dire qu'on n'a pas pu mesurer — jamais prétendre qu'il manque une ligne
// précise qu'on n'a, par construction, pas pu vérifier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traiterRequete } from '../src/hook.js';

function lieuTemp() {
  const d = mkdtempSync(join(tmpdir(), 'smtk-panne-inconnue-'));
  writeFileSync(join(d, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
  writeFileSync(join(d, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
  writeFileSync(join(d, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
  mkdirSync(join(d, '.claude'), { recursive: true });
  writeFileSync(join(d, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');
  return d;
}

test('exception SANS code connu : Grep et Bash refusés, Read seul passe — et la raison dit « pas pu mesurer », jamais « il te manque »', async () => {
  const d = lieuTemp();
  try {
    const double = async () => {
      throw new Error('boom');
    };

    const grep = await traiterRequete({ cwd: d, tool_name: 'Grep', tool_input: { pattern: 'x' } }, double);
    assert.equal(grep.permissionDecision, 'deny');
    assert.match(grep.permissionDecisionReason, /n’a pas pu mesurer|n'a pas pu mesurer/);
    assert.doesNotMatch(grep.permissionDecisionReason, /il te manque/);
    assert.match(grep.permissionDecisionReason, /boom/, 'le message original doit rester lisible dans la raison');

    const bash = await traiterRequete({ cwd: d, tool_name: 'Bash', tool_input: { command: 'date' } }, double);
    assert.equal(bash.permissionDecision, 'deny');
    assert.doesNotMatch(bash.permissionDecisionReason, /il te manque/);

    const read = await traiterRequete({ cwd: d, tool_name: 'Read', tool_input: { file_path: 'CONTEXTE.md' } }, double);
    assert.equal(read.permissionDecision, 'allow');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

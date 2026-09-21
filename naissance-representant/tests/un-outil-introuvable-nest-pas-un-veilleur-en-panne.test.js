// un-outil-introuvable-nest-pas-un-veilleur-en-panne.test.js — T-20260914-0004 (suite).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT D'ATTRIBUTION FERMÉ ICI
//
// `OutilIntrouvable` (`ligne-directe/src/outils.js:148-172`) pose `this.code = 'ENOENT'`
// quand le binaire `herdr` n'est pas dans le `PATH` du processus — c'est le MÊME code
// littéral que Node pose quand la connexion au socket du veilleur échoue. `hook.js`
// classait TOUT `ENOENT` comme « le veilleur est en panne » : un `herdr` introuvable aurait
// donc produit un refus qui commence par « le veilleur ne répond plus » — un diagnostic FAUX,
// de la même famille que le défaut que T-20260914-0004 ferme par ailleurs (un refus doit dire
// ce qu'il a MESURÉ, jamais ce qu'il devine du code seul).
//
// Le code `ENOENT` est donc PARTAGÉ par deux mondes distincts : le socket du veilleur, et le
// lancement d'un binaire quelconque (`herdr`, `git`…). Seul `err.name === 'OutilIntrouvable'`
// (posé par `OutilIntrouvable`, et par personne d'autre) permet de les séparer — le code seul
// ne le peut pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traiterRequete } from '../src/hook.js';
import { OutilIntrouvable, OUTILS } from '../../ligne-directe/src/outils.js';

function lieuTemp() {
  const d = mkdtempSync(join(tmpdir(), 'smtk-outil-introuvable-'));
  writeFileSync(join(d, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
  writeFileSync(join(d, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
  writeFileSync(join(d, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
  mkdirSync(join(d, '.claude'), { recursive: true });
  writeFileSync(join(d, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');
  return d;
}

test('herdr introuvable (OutilIntrouvable, code ENOENT) n’est PAS classé « le veilleur ne répond plus »', async () => {
  const d = lieuTemp();
  try {
    // LA VRAIE CLASSE, PAS UN DOUBLE APPROXIMATIF — c'est `err.name` qu'elle pose qui doit
    // trancher, et un objet fabriqué à la main pourrait avoir un `name` qui ne correspond pas
    // à ce que la classe pose VRAIMENT le jour où elle change.
    const double = async () => {
      throw new OutilIntrouvable(OUTILS.herdr, 'ENOENT', new Error('spawn herdr ENOENT'));
    };

    const grep = await traiterRequete({ cwd: d, tool_name: 'Grep', tool_input: { pattern: 'x' } }, double);
    assert.equal(grep.permissionDecision, 'deny', `attendu deny, reçu ${grep.permissionDecision} — ${grep.permissionDecisionReason}`);
    assert.match(
      grep.permissionDecisionReason,
      /n’a pas pu mesurer|n'a pas pu mesurer/,
      `la raison doit dire qu'on n'a pas pu mesurer : ${grep.permissionDecisionReason}`
    );
    assert.doesNotMatch(
      grep.permissionDecisionReason,
      /le veilleur ne répond plus/,
      `un outil introuvable n'est pas un veilleur en panne — reçu : ${grep.permissionDecisionReason}`
    );

    // Read doit rester permis (polarité de refus intégrale, comme pour toute cause inconnue).
    const read = await traiterRequete({ cwd: d, tool_name: 'Read', tool_input: { file_path: 'CONTEXTE.md' } }, double);
    assert.equal(read.permissionDecision, 'allow');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

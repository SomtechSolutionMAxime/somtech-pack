// hook.test.js — l'orchestration complète du garde, avec un double injecté à la place de
// herdr/ligne-directe. Aucun de ces tests ne fait naître un vrai processus, ne touche un
// vrai socket, ni n'approche le vrai espace de conversation (RA-REL-012).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traiterRequete } from '../src/hook.js';

function lieuTemp() {
  const d = mkdtempSync(join(tmpdir(), 'smtk-hook-'));
  writeFileSync(join(d, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
  writeFileSync(join(d, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
  writeFileSync(join(d, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
  mkdirSync(join(d, '.claude'), { recursive: true });
  writeFileSync(join(d, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');
  return d;
}

test('hors du lieu d’un représentant : le garde ne s’applique pas, même sans double', async () => {
  const d = mkdtempSync(join(tmpdir(), 'smtk-hook-'));
  try {
    const jamaisAppele = async () => {
      throw new Error('ne doit jamais être appelé hors du lieu d’un représentant');
    };
    const decision = await traiterRequete(
      { cwd: d, tool_name: 'Bash', tool_input: { command: 'git status' } },
      jamaisAppele
    );
    assert.equal(decision.permissionDecision, 'allow');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('dans le lieu, ligne ouverte pour ce pane : tout passe', async () => {
  const d = lieuTemp();
  try {
    const double = async () => ({ pane: 'pane-1', etat: { ouvertes: [{ pane: 'pane-1', chantier: 'acme' }] } });
    const decision = await traiterRequete(
      { cwd: d, tool_name: 'mcp__servicedesk__demands', tool_input: { action: 'list' } },
      double
    );
    assert.equal(decision.permissionDecision, 'allow');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('dans le lieu, ligne ouverte pour un AUTRE pane : refusé — chaque pane prouve sa propre ligne', () => {
  // Un piège voisin de T-20260806-0192 : un pane ne doit jamais hériter de la ligne
  // ouverte par un autre. On le prouve avec deux panes distincts dans le même état.
  return (async () => {
    const d = lieuTemp();
    try {
      const double = async () => ({ pane: 'pane-2', etat: { ouvertes: [{ pane: 'pane-1', chantier: 'acme' }] } });
      const decision = await traiterRequete(
        { cwd: d, tool_name: 'mcp__servicedesk__demands', tool_input: { action: 'list' } },
        double
      );
      assert.equal(decision.permissionDecision, 'deny');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  })();
});

test('ROUGE reproduit : dans le lieu, ligne PAS ouverte, relever avant de parler est refusé', async () => {
  const d = lieuTemp();
  try {
    const double = async () => ({ pane: 'pane-1', etat: { ouvertes: [] } });
    const decision = await traiterRequete(
      { cwd: d, tool_name: 'mcp__servicedesk__demands', tool_input: { action: 'list' } },
      double
    );
    assert.equal(decision.permissionDecision, 'deny');
    assert.match(decision.permissionDecisionReason, /T-20260806-0192/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('VERT : dans le lieu, ligne pas ouverte, la séquence d’ouverture elle-même passe', async () => {
  const d = lieuTemp();
  try {
    const double = async () => ({ pane: 'pane-1', etat: { ouvertes: [] } });
    const decision = await traiterRequete(
      { cwd: d, tool_name: 'Bash', tool_input: { command: '$LD ouvrir acme --nature client --titre "Acme Corp"' } },
      double
    );
    assert.equal(decision.permissionDecision, 'allow');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('PANNE D’ENVIRONNEMENT : herdr/ligne-directe injoignable — refus par défaut, jamais un accès élargi', async () => {
  const d = lieuTemp();
  try {
    const double = async () => {
      throw new Error('ECONNREFUSED — aucun veilleur à ce socket');
    };
    const decision = await traiterRequete(
      { cwd: d, tool_name: 'mcp__servicedesk__demands', tool_input: { action: 'list' } },
      double
    );
    assert.equal(decision.permissionDecision, 'deny');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('PANNE D’ENVIRONNEMENT : même en panne, lire un fichier reste permis (étape 1)', async () => {
  const d = lieuTemp();
  try {
    const double = async () => {
      throw new Error('ECONNREFUSED');
    };
    const decision = await traiterRequete({ cwd: d, tool_name: 'Read', tool_input: { file_path: 'CONTEXTE.md' } }, double);
    assert.equal(decision.permissionDecision, 'allow');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('une requête sans cwd retombe sur process.cwd() sans planter', async () => {
  // Le hook réel ne devrait jamais omettre `cwd` (Claude Code le pose toujours), mais une
  // requête malformée ne doit pas faire planter le garde — un crash serait un refus
  // silencieux d'une autre nature, jamais prouvé par un test.
  const double = async () => ({ pane: 'x', etat: { ouvertes: [] } });
  const decision = await traiterRequete({ tool_name: 'Read', tool_input: {} }, double);
  assert.ok(decision.permissionDecision === 'allow' || decision.permissionDecision === 'deny');
});

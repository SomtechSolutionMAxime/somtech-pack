// un-etat-local-perdu-nest-pas-une-ligne-jamais-ouverte.test.js — T-20260914-0004.
//
// Voisin déjà fermé : T-20260908-0057 (état local perdu → même garde fermée, message qui
// envoyait « ouvre ta ligne » comme si elle n'avait jamais existé). Ce banc ferme le CAS
// SYMÉTRIQUE, côté hook d'ouverture : le registre connaît une ligne pour CE LIEU (même
// ancre — `ancreDeLigne`) mais sur un AUTRE pane. Ce n'est pas une ligne jamais ouverte,
// c'est un renseignement LOCAL périmé (l'agent a renu, dans un autre pane). Les
// PERMISSIONS restent celles de « lignes manquantes » (Read + séquence d'ouverture) — seule
// la RAISON change, pour envoyer REJOUER l'ouverture plutôt qu'annoncer un manque qui n'en
// est pas un.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traiterRequete } from '../src/hook.js';

function lieuTemp() {
  const d = mkdtempSync(join(tmpdir(), 'smtk-etat-local-perdu-'));
  writeFileSync(join(d, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
  writeFileSync(join(d, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
  writeFileSync(join(d, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
  mkdirSync(join(d, '.claude'), { recursive: true });
  writeFileSync(join(d, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');
  return d;
}

test('ligne du MÊME lieu sur un AUTRE pane : Grep refusé, mais la raison invite à REJOUER l’ouverture', async () => {
  const d = lieuTemp();
  try {
    // Le registre porte une ligne « acme » ouverte sur `pane-autre`, avec un `worktree` qui
    // ANCRE au MÊME lieu que `d` (ici, `d` lui-même — sans dossier `.gestionnaire`/`.orchestrateur`
    // dans son chemin, `ancreDeLigne` rend le chemin tel quel, des deux côtés).
    const double = async () => ({
      pane: 'pane-1',
      etat: {
        ouvertes: [{ pane: 'pane-autre', chantier: 'acme', canal: 'espace-client-acme', nature: 'client', worktree: d }],
      },
    });

    const grep = await traiterRequete({ cwd: d, tool_name: 'Grep', tool_input: { pattern: 'x' } }, double);
    assert.equal(grep.permissionDecision, 'deny');
    assert.match(grep.permissionDecisionReason, /autre pane/);
    assert.match(grep.permissionDecisionReason, /reprise/);
    assert.match(grep.permissionDecisionReason, /ouvrir acme/);
    assert.doesNotMatch(grep.permissionDecisionReason, /il te manque/);

    // Les MÊMES permissions que « lignes manquantes » aujourd'hui : Read passe.
    const read = await traiterRequete({ cwd: d, tool_name: 'Read', tool_input: { file_path: 'CONTEXTE.md' } }, double);
    assert.equal(read.permissionDecision, 'allow');

    // … et la séquence d'ouverture elle-même passe aussi.
    const ouverture = await traiterRequete(
      { cwd: d, tool_name: 'Bash', tool_input: { command: 'herdr pane current' } },
      double
    );
    assert.equal(ouverture.permissionDecision, 'allow');

    // LE CONTRÔLE — la MÊME ligne, mais pour un lieu DIFFÉRENT (`worktree` distinct). Ce
    // n'est plus un état local perdu : c'est le comportement d'AVANT ce lot, inchangé.
    const doubleAutreLieu = async () => ({
      pane: 'pane-1',
      etat: {
        ouvertes: [
          { pane: 'pane-autre', chantier: 'acme', canal: 'espace-client-acme', nature: 'client', worktree: '/un/lieu/tout-a-fait-different' },
        ],
      },
    });
    const controle = await traiterRequete({ cwd: d, tool_name: 'Grep', tool_input: { pattern: 'x' } }, doubleAutreLieu);
    assert.equal(controle.permissionDecision, 'deny');
    assert.match(controle.permissionDecisionReason, /il te manque/i);
    assert.doesNotMatch(controle.permissionDecisionReason, /autre pane/);

    assert.notEqual(
      grep.permissionDecisionReason,
      controle.permissionDecisionReason,
      'un état local perdu et une ligne jamais ouverte doivent avoir des raisons DIFFÉRENTES'
    );
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// UNE LIGNE OUVERTE SUR CE PANE-CI N'EST PAS UN ÉTAT PERDU (mutation survivante, passe de fond)
//
// ⚠️ MUTATION QUI A SURVÉCU AUX 907 : retirer `l.pane !== pane` du calcul de `lignesDuLieu`
// dans `hook.js`. Mesuré par la passe : un représentant dont la ligne CLIENTE est déjà
// ouverte SUR CE PANE et à qui il manque celle du dirigeant se voyait alors répondre « une
// ligne de ce lieu existe déjà sur un AUTRE pane — rejoue l'ouverture ». C'est faux deux
// fois : le pane est le sien, et surtout le message l'envoie RÉOUVRIR la ligne qu'il a déjà
// au lieu de lui dire laquelle lui manque. Un agent qui suit ce conseil rouvre sa ligne
// cliente, revient au même refus, et boucle — sans jamais apprendre qu'il lui manque le
// dirigeant, c'est-à-dire le manque exact que la garde existe pour nommer (T-20260813-0076).
test('une ligne déjà ouverte SUR CE PANE ne se lit pas comme un état perdu — le refus nomme ce qui MANQUE', async () => {
  const d = lieuTemp();
  try {
    // Le représentant doit DEUX lignes : celle de son client, celle du dirigeant. La cliente
    // est ouverte, sur SON pane, avec le worktree de ce lieu.
    const double = async () => ({
      pane: 'pane-1',
      etat: { ouvertes: [{ pane: 'pane-1', chantier: 'acme', canal: 'acme', nature: 'client', worktree: d }] },
    });
    const decision = await traiterRequete(
      { cwd: d, tool_name: 'Grep', tool_input: { pattern: 'x' } },
      double
    );
    assert.equal(decision.permissionDecision, 'deny', 'il manque encore la ligne du dirigeant');
    assert.match(
      decision.permissionDecisionReason,
      /[Ii]l te manque/,
      `le refus doit nommer CE QUI MANQUE — reçu : ${decision.permissionDecisionReason}`
    );
    assert.doesNotMatch(
      decision.permissionDecisionReason,
      /autre pane|état local|périmé/,
      `ce pane est le sien : rien n'est perdu — reçu : ${decision.permissionDecisionReason}`
    );
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

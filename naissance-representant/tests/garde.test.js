// garde.test.js — le garde bloque RÉELLEMENT ce qui s'y prendrait autrement, pas seulement
// ce qui ressemble à une faute évidente.
//
// Chaque cas « ROUGE » ci-dessous est un enchaînement qui, sans ce garde, reproduirait
// T-20260806-0192 ou une variante voisine. Chaque cas « ADVERSARIAL » est une commande
// composée exprès pour trouver la faille d'une implémentation relâchée (chaînage après un
// segment autorisé, option manquante, etc.) — c'est le même esprit que les MUTATIONS de
// cli/test/lib/metier-representant.js, appliqué ici au CODE plutôt qu'à la prose.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decider, segmentsHorsSequence, ligneEstOuverte } from '../src/garde.js';

// ═══════════════════════════════ la ligne est déjà ouverte : rien n'est gardé

test('ligne ouverte : un appel MCP au registre passe', () => {
  const d = decider({ toolName: 'mcp__servicedesk__demands', toolInput: {}, ligneOuverte: true });
  assert.equal(d.permissionDecision, 'allow');
});

test('ligne ouverte : n’importe quelle commande Bash passe (ce garde ne gouverne que l’ordre)', () => {
  const d = decider({ toolName: 'Bash', toolInput: { command: 'git status' }, ligneOuverte: true });
  assert.equal(d.permissionDecision, 'allow');
});

// ═══════════════════════════════ ROUGE — le défaut exact de T-20260806-0192

test('ROUGE T-20260806-0192 : relever (demands list) avant l’ouverture est refusé', () => {
  const d = decider({ toolName: 'mcp__servicedesk__demands', toolInput: { action: 'list' }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'deny');
  assert.match(d.permissionDecisionReason, /T-20260806-0192/);
});

test('ROUGE : parler (dire) avant l’ouverture est refusé', () => {
  const d = decider({ toolName: 'Bash', toolInput: { command: '$LD dire "bonjour"' }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'deny');
});

test('ROUGE : un outil MCP hors registre (somcraft) est refusé tant que la ligne n’est pas ouverte', () => {
  const d = decider({ toolName: 'mcp__somcraft__list_workspaces', toolInput: {}, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'deny');
});

test('ROUGE : écrire un fichier avant l’ouverture est refusé', () => {
  const d = decider({ toolName: 'Write', toolInput: { file_path: 'x' }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'deny');
});

test('ROUGE : une commande git avant l’ouverture est refusée', () => {
  const d = decider({ toolName: 'Bash', toolInput: { command: 'git status' }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'deny');
});

// ═══════════════════════════════ VERT — la séquence d'ouverture elle-même

test('VERT : lire un fichier est permis avant l’ouverture (étape 1 — lire CONTEXTE.md)', () => {
  const d = decider({ toolName: 'Read', toolInput: { file_path: 'CONTEXTE.md' }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'allow');
});

test('VERT : herdr pane current est permis', () => {
  const d = decider({ toolName: 'Bash', toolInput: { command: 'herdr pane current' }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'allow');
});

test('VERT : herdr agent rename est permis', () => {
  const d = decider({ toolName: 'Bash', toolInput: { command: 'herdr agent rename abc123 acme' }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'allow');
});

test('VERT : $LD etat est permis', () => {
  const d = decider({ toolName: 'Bash', toolInput: { command: '$LD etat' }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'allow');
});

test('VERT : $LD ouvrir bien formé (--nature client et --titre) est permis', () => {
  const d = decider({
    toolName: 'Bash',
    toolInput: { command: '$LD ouvrir acme --nature client --titre "Acme Corp"' },
    ligneOuverte: false,
  });
  assert.equal(d.permissionDecision, 'allow');
});

test('VERT : la séquence complète, en un seul appel Bash multi-lignes, est permise', () => {
  const commande = [
    'LD="node $HOME/.somtech/ligne-directe/bin/ligne-directe.js"',
    '',
    'herdr pane current',
    'herdr agent rename abc123 acme',
    '',
    '$LD etat',
    '$LD ouvrir acme --nature client --titre "Acme Corp"',
  ].join('\n');
  const d = decider({ toolName: 'Bash', toolInput: { command: commande }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'allow');
});

// ═══════════════════════════════ ADVERSARIAL — la faille qu'une implémentation relâchée laisserait passer

test('ADVERSARIAL : chaîner une commande interdite APRÈS un segment autorisé est refusé', () => {
  // Le piège classique d'une garde qui ne regarde que le DÉBUT de la commande.
  const d = decider({ toolName: 'Bash', toolInput: { command: 'herdr pane current && git push' }, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'deny');
});

test('ADVERSARIAL : ouvrir sans --nature client est refusé (canal public pour un client)', () => {
  const d = decider({
    toolName: 'Bash',
    toolInput: { command: '$LD ouvrir acme --titre "Acme Corp"' },
    ligneOuverte: false,
  });
  assert.equal(d.permissionDecision, 'deny');
});

test('ADVERSARIAL : ouvrir sans --titre est refusé (le client verrait un code de dossier)', () => {
  const d = decider({
    toolName: 'Bash',
    toolInput: { command: '$LD ouvrir acme --nature client' },
    ligneOuverte: false,
  });
  assert.equal(d.permissionDecision, 'deny');
});

test('ADVERSARIAL : une commande vide/absente ne fait pas passer autre chose par défaut', () => {
  const d = decider({ toolName: 'Bash', toolInput: {}, ligneOuverte: false });
  assert.equal(d.permissionDecision, 'deny');
});

test('ADVERSARIAL : segmentsHorsSequence ne se laisse pas endormir par un point-virgule final', () => {
  const hors = segmentsHorsSequence('herdr pane current; rm -rf ~');
  assert.equal(hors.length, 1);
  assert.match(hors[0], /rm -rf/);
});

// ═══════════════════════════════ ligneEstOuverte — lue depuis un `etat` réel de ligne-directe

test('ligneEstOuverte : vrai quand le pane figure parmi les lignes ouvertes', () => {
  const etat = { ouvertes: [{ pane: 'pane-1', chantier: 'acme' }, { pane: 'pane-2', chantier: 'autre' }] };
  assert.equal(ligneEstOuverte(etat, 'pane-1'), true);
});

test('ligneEstOuverte : faux quand le pane n’y figure pas', () => {
  const etat = { ouvertes: [{ pane: 'pane-2', chantier: 'autre' }] };
  assert.equal(ligneEstOuverte(etat, 'pane-1'), false);
});

test('ligneEstOuverte : faux, jamais une exception, quand `etat` est vide ou malformé', () => {
  assert.equal(ligneEstOuverte(null, 'pane-1'), false);
  assert.equal(ligneEstOuverte({}, 'pane-1'), false);
  assert.equal(ligneEstOuverte({ ouvertes: null }, 'pane-1'), false);
});

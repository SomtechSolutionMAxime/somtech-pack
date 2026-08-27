// metier-garde-sous-agent.test.js — la garde qui tient la frontière des sous-agents.
//
// D-20260826-0010 (ABC 3.0.0) : « Task » a quitté `permissions.deny` — un outil nu
// refuse tout, donc aussi les sous-agents d'ANALYSE que GF-ORC-002 amendé rend à
// l'orchestrateur comme ses propres moyens. Cette garde porte SEULE le refus des
// sous-agents de construction : sa polarité est celle de la garde d'écriture — hors
// du seul cas qu'elle reconnaît, elle refuse.
//
// Ces tests gardent la décision PURE, puis le FIL qui la branche — chacun sur ses
// propres modes de panne, parce qu'un fil sain devant une décision folle et une
// décision saine derrière un fil mort produisent le même silence permissif.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { juger, TYPES_ANALYSE, ROLES_GARDES } from '../src/metier/gardes/sous-agent.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const decide = (typeSousAgent, opts = {}) =>
  juger({ outil: 'Task', typeSousAgent, role: 'orchestrateur', ...opts });

test('un sous-agent d analyse passe — Explore et Plan, les deux types sans outil d écriture', () => {
  for (const type of ['Explore', 'Plan']) {
    const d = decide(type);
    assert.equal(d.decision, 'allow', `« ${type} » est un moyen d analyse (R2.6) : ${d.raison}`);
    assert.match(d.raison, /analyse/i, 'et le oui DIT pourquoi — sinon il s étend par analogie');
  }
});

test('la table des types d analyse est exactement celle que la décision emploie — pas une seconde énumération', () => {
  // Deux copies d'un critère divergent en silence : le test dérive ses cas de la table
  // exportée, et vérifie seulement qu'elle n'a pas grossi sans qu'on le voie. L'élargir
  // exige d'éditer la décision, ce qui se voit en revue.
  assert.deepEqual([...TYPES_ANALYSE].sort(), ['Explore', 'Plan']);
  assert.deepEqual([...ROLES_GARDES], ['orchestrateur']);
});

test('un type à outillage complet est REFUSÉ — la construction vit chez les chefs d équipe', () => {
  for (const type of ['general-purpose', 'fork', 'backend', 'frontend', 'claude', 'qa']) {
    const d = decide(type);
    assert.equal(d.decision, 'deny', `« ${type} » porte (ou hérite) des outils d écriture`);
    assert.match(d.raison, /chefs d'équipe/i, 'le refus dit à qui le geste appartient');
  }
});

test('un type ABSENT est refusé — le type par défaut porte l outillage complet', () => {
  for (const type of [undefined, '', '   ']) {
    assert.equal(decide(type).decision, 'deny', `type « ${String(type)} » : l omission n est pas un droit`);
  }
});

test('la casse ne fait pas un droit — « explore » n est pas « Explore »', () => {
  // Un allowlist insensible à la casse accepterait des types que l'hôte ne résout pas
  // vers un agent en lecture seule. L'appariement est exact, et c'est voulu.
  assert.equal(decide('explore').decision, 'deny');
  assert.equal(decide('PLAN').decision, 'deny');
});

test('un rôle que la garde ne connaît pas est refusé — un oui par défaut ouvrirait tout', () => {
  assert.equal(decide('Explore', { role: 'chef-equipe' }).decision, 'deny');
  assert.equal(decide('Explore', { role: undefined, ...{ role: 'inconnu' } }).decision, 'deny');
});

test('un outil qui n est pas Task est refusé par la décision — le tri appartient au fil, jamais à elle', () => {
  assert.equal(juger({ outil: 'Bash', typeSousAgent: 'Explore', role: 'orchestrateur' }).decision, 'deny');
  assert.equal(juger({ role: 'orchestrateur' }).decision, 'deny');
});

test('le refus DIT ce qu il ferme et à qui le geste appartient', () => {
  const d = decide('general-purpose');
  assert.equal(d.decision, 'deny');
  assert.ok(d.raison.length > 40, 'un refus qui ne dit rien se contourne sans réfléchir');
  assert.match(d.raison, /construction|revues/i);
});

// ═════════════════════ le FIL — l'I/O réelle, et ses modes de panne

/** Lance le fil réel avec une requête sur stdin, rend le verdict qu'il émet. */
function fil(entree) {
  const sortie = execFileSync(process.execPath, [join(RACINE, 'gardes', 'sous-agent.js')], {
    input: typeof entree === 'string' ? entree : JSON.stringify(entree),
    encoding: 'utf8',
    env: { ...process.env, SOMTECH_GARDE_DELAI_MS: '5000' },
  });
  return JSON.parse(sortie).hookSpecificOutput;
}

test('le fil TRANSMET un allow pour un sous-agent d analyse — sinon les refus ci-dessous ne prouveraient rien', () => {
  const v = fil({ tool_name: 'Task', tool_input: { subagent_type: 'Explore', prompt: 'lis et rends' } });
  assert.equal(v.permissionDecision, 'allow');
});

test('le fil REFUSE un sous-agent de construction, et la raison voyage jusqu au verdict', () => {
  const v = fil({ tool_name: 'Task', tool_input: { subagent_type: 'general-purpose', prompt: 'construis' } });
  assert.equal(v.permissionDecision, 'deny');
  assert.match(v.permissionDecisionReason, /chefs d'équipe/i);
});

test('le fil REFUSE un Task sans type — l omission n est pas un droit, jusque dans la vraie chaîne', () => {
  const v = fil({ tool_name: 'Task', tool_input: { prompt: 'fais' } });
  assert.equal(v.permissionDecision, 'deny');
});

test('un outil qui n est pas Task passe SANS être jugé — la garde ne garde que les sous-agents', () => {
  const v = fil({ tool_name: 'Bash', tool_input: { command: 'git status' } });
  assert.equal(v.permissionDecision, 'allow');
});

test('🔴 une requête ILLISIBLE est refusée — la garde ne laisse pas passer ce qu elle n a pas vu', () => {
  const v = fil('ceci n est pas du JSON {');
  assert.equal(v.permissionDecision, 'deny');
});

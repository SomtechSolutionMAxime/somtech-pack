// la-panne-du-veilleur-nest-pas-une-ligne-absente.test.js — T-20260914-0004.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT FERMÉ ICI
//
// `hook.js` avalait TOUTE exception de `obtenirPaneEtEtat` en `naturesOuvertes = []`.
// `garde.js decider()` appliquait alors la branche « lignes manquantes » : Grep, tail, date
// refusés avec « n'ouvre aucune de tes lignes ». Un veilleur en panne et une ligne jamais
// ouverte tombaient dans le MÊME état ; l'agent ne pouvait même pas lire le journal pour
// comprendre. Voisin déjà fermé : T-20260908-0057 (état local perdu — voir le fichier voisin).
//
// CE QUE CE BANC ÉPROUVE, POUR CHAQUE CODE DE PANNE DU VEILLEUR : la lecture pure (Read, Grep,
// Glob, Bash de lecture) et le diagnostic (tail du journal, ligne-directe etat|relever) ainsi
// que PRÉVENIR (commentaire ServiceDesk) restent permis. Tout le reste — écrire, exécuter,
// composer une commande avec un opérateur ou une substitution — reste refusé. Et le CONTRÔLE :
// un veilleur SAIN sans aucune ligne ouverte rend un verdict DIFFÉRENT sur la même requête,
// sinon ce banc mesurerait à l'aveugle (consigne du brief).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traiterRequete } from '../src/hook.js';
import { CHEMIN_JOURNAL } from '../../ligne-directe/src/registre.js';

function lieuTemp() {
  const d = mkdtempSync(join(tmpdir(), 'smtk-panne-veilleur-'));
  writeFileSync(join(d, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
  writeFileSync(join(d, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
  writeFileSync(join(d, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
  mkdirSync(join(d, '.claude'), { recursive: true });
  writeFileSync(join(d, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');
  return d;
}

/** Un double qui LÈVE une erreur portant CE code — la panne mesurée du sondage. */
const doubleQuiLeve = (code, message) => async () => {
  throw Object.assign(new Error(message), { code });
};

/** Le CONTRÔLE — un veilleur PARFAITEMENT SAIN, sans aucune ligne ouverte. */
const doubleSainSansRien = async () => ({ pane: 'pane-1', etat: { ouvertes: [] } });

const CAS = [
  ['VEILLEUR_MUET', "Le veilleur NE RÉPOND PLUS — « etat » attendu 0.2s, et le ping reste sans réponse."],
  ['VEILLEUR_NE_DEMARRE_PAS', "Le veilleur n'a pas démarré en 10s. Regarde pourquoi : tail -20 x"],
  ['ECONNREFUSED', 'connect ECONNREFUSED /tmp/x/veilleur.sock'],
  ['VEILLEUR_LENT', "Le veilleur EST VIVANT — il répond au ping — mais il n'a pas rendu « vue » en 84.4s."],
];

for (const [code, message] of CAS) {
  test(`PANNE ${code} : lecture, diagnostic et avertissement passent ; tout le reste attend, sans mentir sur la cause`, async () => {
    const d = lieuTemp();
    try {
      const double = doubleQuiLeve(code, message);

      const permis = [
        { tool_name: 'Grep', tool_input: { pattern: 'x' } },
        { tool_name: 'Glob', tool_input: { pattern: '*.md' } },
        { tool_name: 'Read', tool_input: { file_path: 'CONTEXTE.md' } },
        { tool_name: 'Bash', tool_input: { command: `tail -20 ${CHEMIN_JOURNAL}` } },
        { tool_name: 'Bash', tool_input: { command: 'date' } },
        { tool_name: 'Bash', tool_input: { command: '$LD etat' } },
        { tool_name: 'mcp__servicedesk__tickets', tool_input: { action: 'add_comment' } },
      ];
      for (const requete of permis) {
        const dec = await traiterRequete({ cwd: d, ...requete }, double);
        assert.equal(
          dec.permissionDecision,
          'allow',
          `${code} — ${requete.tool_name} devait passer, refusé avec : ${dec.permissionDecisionReason}`
        );
      }

      const refuses = [
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { tool_name: 'Write', tool_input: { file_path: 'x' } },
        { tool_name: 'Edit', tool_input: { file_path: 'x', old_string: 'a', new_string: 'b' } },
        { tool_name: 'Bash', tool_input: { command: 'tail x | sh' } },
        { tool_name: 'Bash', tool_input: { command: 'cat "$(rm -rf /)"' } },
        { tool_name: 'Bash', tool_input: { command: 'tail x > y' } },
        // TUEUR DE m5 (élargir LECTURE_PURE avec `rm`) — sans ce cas, rien ne rougirait.
        { tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/x' } },
        { tool_name: 'mcp__servicedesk__tickets', tool_input: { action: 'update' } },
      ];
      for (const requete of refuses) {
        const dec = await traiterRequete({ cwd: d, ...requete }, double);
        assert.equal(
          dec.permissionDecision,
          'deny',
          `${code} — ${requete.tool_name} ${JSON.stringify(requete.tool_input)} devait être refusé`
        );
        assert.doesNotMatch(
          dec.permissionDecisionReason,
          /n.ouvre aucune de tes lignes/,
          `${code} — la raison ne doit jamais dire « n'ouvre aucune de tes lignes » pendant une panne du veilleur`
        );
        assert.doesNotMatch(
          dec.permissionDecisionReason,
          /il te manque/,
          `${code} — la raison ne doit jamais dire « il te manque » pendant une panne du veilleur`
        );
        assert.match(
          dec.permissionDecisionReason,
          /^le veilleur/,
          `${code} — la raison doit commencer par le mot du veilleur : ${dec.permissionDecisionReason}`
        );
        assert.ok(
          dec.permissionDecisionReason.includes(code),
          `${code} — la raison doit NOMMER le code mesuré : ${dec.permissionDecisionReason}`
        );
      }

      // LE CONTRÔLE — sans lui, un banc qui refuserait TOUJOURS Grep prouverait seulement
      // qu'il refuse toujours, jamais que les deux causes sont VRAIMENT distinguées.
      const enPanne = await traiterRequete({ cwd: d, tool_name: 'Grep', tool_input: { pattern: 'x' } }, double);
      const sain = await traiterRequete({ cwd: d, tool_name: 'Grep', tool_input: { pattern: 'x' } }, doubleSainSansRien);
      assert.notEqual(
        enPanne.permissionDecision,
        sain.permissionDecision,
        `${code} — un veilleur en panne (Grep permis) et un veilleur sain sans ligne (Grep refusé) ` +
          'doivent rendre des verdicts DIFFÉRENTS, sinon ce banc mesure à l’aveugle'
      );
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
}

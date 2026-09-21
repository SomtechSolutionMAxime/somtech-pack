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

// ═══════════════════════════════════════════════════════════════════════════════════════
// CHAQUE ENTRÉE DES DEUX LISTES FERMÉES EST ÉPROUVÉE, UNE PAR UNE (passe de fond, REJET)
//
// ⚠️ ÉCRIT APRÈS DEUX MUTATIONS SURVIVANTES, et c'est ce qu'elles ont révélé : réduire
// `LECTURE_PURE` à `['tail','date']` — donc retirer douze outils sur quatorze — laissait les
// 907 essais VERTS. Idem en réduisant `ACTIONS_SERVICEDESK_EN_PANNE` au seul `add_comment`.
// Les essais ci-dessus n'exerçaient que `tail`, `date` et `add_comment` : tout le reste des
// deux listes était une PROMESSE que rien ne tenait.
//
// Ce que ça coûterait dans la vraie vie : une faute de frappe sur une entrée (`stat` écrit
// `sta`), ou un retrait jugé anodin, romprait en SILENCE une permission que le refus
// ANNONCE à l'agent — « ce qui reste permis : … ». Un agent en panne de veilleur se verrait
// refuser un outil que le message du refus vient de lui promettre, et c'est précisément le
// genre de contradiction que ce lot existe pour supprimer.
//
// La liste est donc DÉRIVÉE du produit, jamais recopiée ici : un banc qui porterait sa
// propre copie prouverait seulement qu'il est d'accord avec lui-même, et un ajout à la liste
// de production ne serait jamais éprouvé.
import { LECTURE_PURE, ACTIONS_SERVICEDESK_EN_PANNE } from '../src/garde.js';

test('CHAQUE outil de LECTURE_PURE passe pendant une panne — la liste est tenue, pas seulement annoncée', async () => {
  const d = lieuTemp();
  try {
    const double = doubleQuiLeve('VEILLEUR_MUET', 'Le veilleur NE RÉPOND PLUS');
    // ⚠️ LA BORNE NE VIENT PAS D'UN NOMBRE ÉCRIT ICI, ELLE VIENT DU REFUS LUI-MÊME. Exiger
    // « au moins quatorze entrées » aurait été une COPIE de la liste de production dans le
    // banc : elle tuerait la mutation en prouvant seulement que le banc est d'accord avec le
    // chiffre qu'il porte, et il faudrait l'éditer à chaque outil ajouté. On demande donc au
    // produit CE QU'IL PROMET — le texte du refus nomme les outils permis — et on exige que
    // chaque outil promis passe réellement. La promesse et le comportement ne peuvent plus
    // diverger, et un ajout à la liste n'oblige à toucher ni ce banc ni ce refus.
    const refus = await traiterRequete({ cwd: d, tool_name: 'Write', tool_input: { file_path: 'x' } }, double);
    assert.equal(refus.permissionDecision, 'deny', 'écrire reste refusé pendant une panne');
    const promis = LECTURE_PURE.filter((o) => new RegExp(`\\b${o}\\b`).test(refus.permissionDecisionReason));
    assert.ok(promis.length >= 4, `le refus doit NOMMER les outils qu'il permet — reçu : ${refus.permissionDecisionReason}`);
    for (const outil of promis) {
      const d2 = await traiterRequete({ cwd: d, tool_name: 'Bash', tool_input: { command: `${outil} x` } }, double);
      assert.equal(
        d2.permissionDecision,
        'allow',
        `« ${outil} » est NOMMÉ permis par le refus : le refuser serait se contredire — reçu ${d2.permissionDecisionReason}`
      );
    }
    for (const outil of LECTURE_PURE) {
      const decision = await traiterRequete(
        { cwd: d, tool_name: 'Bash', tool_input: { command: `${outil} quelquechose` } },
        double
      );
      assert.equal(
        decision.permissionDecision,
        'allow',
        `« ${outil} » est annoncé permis par le refus lui-même : il doit passer — reçu ${decision.permissionDecisionReason}`
      );
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('CHAQUE action ServiceDesk permise en panne passe — et une action mutante reste refusée', async () => {
  const d = lieuTemp();
  try {
    const double = doubleQuiLeve('VEILLEUR_MUET', 'Le veilleur NE RÉPOND PLUS');
    // MÊME GARDE QUE POUR LES OUTILS, ET ELLE MANQUAIT ICI (relevée en passe portail, REJET).
    // Le banc voisin exige que chaque outil NOMMÉ par le refus passe réellement ; celui-ci se
    // contentait de parcourir la liste du produit. L'angle mort était mesurable : le refus
    // n'annonçait QUE `add_comment` alors que le code en permettait cinq — la promesse et le
    // comportement avaient déjà divergé, en silence, dans le sens qui fait renoncer un agent à
    // un geste qui lui est permis. Retirer une action de la liste sans la retirer du message
    // (ou l'inverse) ne faisait rougir personne.
    const refusSD = await traiterRequete(
      { cwd: d, tool_name: 'mcp__servicedesk__tickets', tool_input: { action: 'update' } },
      double
    );
    assert.equal(refusSD.permissionDecision, 'deny', 'écrire au ServiceDesk reste refusé pendant une panne');
    const annoncees = [...ACTIONS_SERVICEDESK_EN_PANNE].filter((a) =>
      new RegExp(`\\b${a}\\b`).test(refusSD.permissionDecisionReason)
    );
    assert.equal(
      annoncees.length,
      ACTIONS_SERVICEDESK_EN_PANNE.size,
      `le refus doit NOMMER toutes les actions qu'il permet — reçu : ${refusSD.permissionDecisionReason}`
    );
    for (const action of annoncees) {
      const d2 = await traiterRequete(
        { cwd: d, tool_name: 'mcp__servicedesk__tickets', tool_input: { action } },
        double
      );
      assert.equal(
        d2.permissionDecision,
        'allow',
        `« ${action} » est NOMMÉE permise par le refus : la refuser serait se contredire`
      );
    }
    // `list` et `get` sont le MINIMUM sans lequel « prévenir » n'a pas de sens : on ne commente
    // pas un ticket qu'on ne peut pas lire.
    for (const lecture of ['list', 'get']) {
      assert.ok(
        ACTIONS_SERVICEDESK_EN_PANNE.has(lecture),
        `« ${lecture} » doit rester permis : sans lire, un agent ne peut pas prévenir utilement`
      );
    }
    for (const action of ACTIONS_SERVICEDESK_EN_PANNE) {
      const decision = await traiterRequete(
        { cwd: d, tool_name: 'mcp__servicedesk__tickets', tool_input: { action } },
        double
      );
      assert.equal(decision.permissionDecision, 'allow', `l'action « ${action} » doit passer pendant une panne`);
    }
    // LE CONTRÔLE NÉGATIF — sans lui, un correctif qui permettrait TOUT passerait au vert.
    for (const action of ['update', 'create', 'delete', 'execute']) {
      const decision = await traiterRequete(
        { cwd: d, tool_name: 'mcp__servicedesk__tickets', tool_input: { action } },
        double
      );
      assert.equal(decision.permissionDecision, 'deny', `l'action « ${action} » ÉCRIT : elle doit rester refusée`);
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// `service` : SEUL `etat` PASSE — `installer` et `retirer` ÉCRIVENT SUR LE POSTE
//
// ⚠️ MUTATION SURVIVANTE (passe de fond) : remplacer tout le cas `service` de
// `segmentDiagnosticLigneDirecte` par `return true` laissait les 910 essais VERTS. Aucun
// n'exerçait ce cas, ni dans un sens ni dans l'autre.
//
// Ce que la mutation rouvrait : `ligne-directe service installer` et `service retirer` posent
// et retirent un VRAI service launchd du poste (voir `ligne-directe/bin/ligne-directe.js`) —
// une écriture, et sur le poste entier, pas sur le lieu de l'agent. Les classer « diagnostic »
// rouvrait, à l'endroit le plus discret du lot, la fenêtre d'écriture que tout le reste ferme.
// Seul `service etat` interroge sans rien toucher.
test('pendant une panne : « service etat » passe, « service installer » et « service retirer » sont REFUSÉS', async () => {
  const d = lieuTemp();
  try {
    const double = doubleQuiLeve('VEILLEUR_MUET', 'Le veilleur NE RÉPOND PLUS');
    const LD = 'node /Users/x/.somtech/ligne-directe/bin/ligne-directe.js';

    for (const commande of [`$LD service etat`, `${LD} service etat`]) {
      const decision = await traiterRequete({ cwd: d, tool_name: 'Bash', tool_input: { command: commande } }, double);
      assert.equal(decision.permissionDecision, 'allow', `« ${commande} » interroge sans rien toucher — reçu ${decision.permissionDecisionReason}`);
    }

    // ⚠️ CE QUI ÉCRIT SUR LE POSTE, et qu'aucune panne ne justifie : poser ou retirer le
    // service du veilleur touche TOUS les agents de la machine, pas seulement celui qui est
    // bloqué. Un agent en panne diagnostique ; il ne réinstalle pas l'infrastructure du parc.
    for (const geste of ['installer', 'retirer']) {
      for (const commande of [`$LD service ${geste}`, `${LD} service ${geste}`]) {
        const decision = await traiterRequete({ cwd: d, tool_name: 'Bash', tool_input: { command: commande } }, double);
        assert.equal(
          decision.permissionDecision,
          'deny',
          `« ${commande} » ÉCRIT sur le poste : une panne du veilleur ne l'autorise pas — reçu ${decision.permissionDecisionReason}`
        );
      }
    }

    // Et `service` NU, sans argument : on ne sait pas ce qu'il fera, donc il ne passe pas.
    const nu = await traiterRequete({ cwd: d, tool_name: 'Bash', tool_input: { command: '$LD service' } }, double);
    assert.equal(nu.permissionDecision, 'deny', '« service » sans argument n’est pas « service etat »');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

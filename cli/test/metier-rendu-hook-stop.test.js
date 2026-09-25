// metier-rendu-hook-stop.test.js — le rendu de la commande d'un hook `Stop`
// (T-20260925-0080, point 1 du brief) — CONTRAT DIFFÉRENT de `PreToolUse`.
//
// ⚠️ CE QUE CE FICHIER GARDE, ET QUE `commandeDeHook` (PreToolUse) NE GARDE PAS :
// un hook `Stop` sain peut légitimement rendre une sortie VIDE (« laisser
// s'arrêter ») — ce n'est donc jamais la sortie vide qui signale une panne, mais
// le CODE DE SORTIE du process ou une sortie non vide qui ne parse pas dans la
// forme attendue. Et la commande de repli (garde absente/cassée) doit lire
// `stop_hook_active` dans l'entrée du hook pour ne jamais bloquer l'arrêt à
// l'infini.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rendre } from '../src/metier/rendu.js';

/** Construit et extrait la commande rendue pour un hook `Stop` visant `chemin`. */
function commandePourGardeStop(chemin, plafondParHeure) {
  const r = rendre({
    role: 'r', version_abc: '1',
    hooks: [{ evenement: 'Stop', garde: 'ma-garde-test', chemin, ...(plafondParHeure !== undefined ? { plafond_par_heure: plafondParHeure } : {}) }],
    items: [{ id: 'GF-R-001', nature: 'garde-fou', couche: 'hook', enonce: 'x', enonce_socle: 'c' }],
    chapitres: [],
  });
  assert.equal(r.ok, true, JSON.stringify(r.erreurs));
  const st = JSON.parse(r.artefacts['.claude/settings.json']);
  const entree = st.hooks.Stop[0];
  assert.equal(entree.matcher, undefined, 'un hook Stop ne cible aucun outil — pas de matcher');
  return entree.hooks[0].command;
}

function executer(commande, entreeHook) {
  try {
    return execFileSync('bash', ['-c', commande], { input: JSON.stringify(entreeHook), encoding: 'utf8' });
  } catch (e) {
    // Un exit non-zéro du SCRIPT SHELL lui-même (pas de la garde) ferait échouer
    // ce test — mais la commande rendue ne doit jamais sortir non-zéro.
    throw new Error(`la commande shell est sortie en erreur : ${e.message}\nstdout: ${e.stdout}\nstderr: ${e.stderr}`);
  }
}

let TMP;
test.beforeEach(() => { TMP = mkdtempSync(join(tmpdir(), 'smtk-hook-stop-')); });
test.afterEach(() => { rmSync(TMP, { recursive: true, force: true }); });

test('garde ABSENTE, stop_hook_active absent/false → decision:block, raison nommée', () => {
  const chemin = join(TMP, 'introuvable.js');
  const cmd = commandePourGardeStop(chemin);
  for (const entree of [{}, { stop_hook_active: false }]) {
    const sortie = JSON.parse(executer(cmd, entree));
    assert.equal(sortie.decision, 'block');
    assert.match(sortie.reason, /introuvable/);
  }
});

test('garde ABSENTE, stop_hook_active:true → arrêt permis, systemMessage nommé — sinon boucle infinie', () => {
  const chemin = join(TMP, 'introuvable.js');
  const cmd = commandePourGardeStop(chemin);
  const sortie = JSON.parse(executer(cmd, { stop_hook_active: true }));
  assert.equal(sortie.decision, undefined, 'stop_hook_active:true ne doit JAMAIS produire un block — boucle infinie sinon');
  assert.match(sortie.systemMessage, /introuvable/);
});

test('garde qui CASSE (exit non-zéro sans rien écrire), stop_hook_active absent → decision:block', () => {
  const chemin = join(TMP, 'cassee.js');
  writeFileSync(chemin, 'process.exit(1);\n');
  const cmd = commandePourGardeStop(chemin);
  const sortie = JSON.parse(executer(cmd, {}));
  assert.equal(sortie.decision, 'block');
  assert.match(sortie.reason, /echoue|échoué|aucun verdict/);
});

test('garde qui CASSE, stop_hook_active:true → arrêt permis, systemMessage nommé', () => {
  const chemin = join(TMP, 'cassee.js');
  writeFileSync(chemin, 'process.exit(1);\n');
  const cmd = commandePourGardeStop(chemin);
  const sortie = JSON.parse(executer(cmd, { stop_hook_active: true }));
  assert.equal(sortie.decision, undefined);
  assert.match(sortie.systemMessage, /echoue|échoué|aucun verdict/);
});

test('garde qui écrit du BRUIT non-JSON (exit 0) → traitée comme cassée', () => {
  const chemin = join(TMP, 'bruit.js');
  writeFileSync(chemin, 'process.stdout.write("npm notice: something\\n"); process.exit(0);\n');
  const cmd = commandePourGardeStop(chemin);
  const sortie = JSON.parse(executer(cmd, {}));
  assert.equal(sortie.decision, 'block', 'du bruit non reconnu doit retomber sur le refus par défaut');
});

test('garde SAINE qui ne rend RIEN (exit 0, stdout vide) → sortie VIDE, PAS un refus — silence légitime', () => {
  const chemin = join(TMP, 'silencieuse.js');
  writeFileSync(chemin, 'process.exit(0);\n');
  const cmd = commandePourGardeStop(chemin);
  const sortie = executer(cmd, {});
  assert.equal(sortie.trim(), '', `une garde saine et silencieuse ne doit produire AUCUNE sortie : ${JSON.stringify(sortie)}`);
});

test('garde SAINE qui rend un block valide → repris à l\'identique', () => {
  const chemin = join(TMP, 'ok-block.js');
  writeFileSync(chemin, 'process.stdout.write(JSON.stringify({decision:"block",reason:"prochaine tâche : T-20260925-0001 — X"}));\n');
  const cmd = commandePourGardeStop(chemin);
  const sortie = JSON.parse(executer(cmd, {}));
  assert.deepEqual(sortie, { decision: 'block', reason: 'prochaine tâche : T-20260925-0001 — X' });
});

test('garde SAINE qui rend un systemMessage seul → repris à l\'identique', () => {
  const chemin = join(TMP, 'ok-msg.js');
  writeFileSync(chemin, 'process.stdout.write(JSON.stringify({systemMessage:"écrit, attend: dirigeant"}));\n');
  const cmd = commandePourGardeStop(chemin);
  const sortie = JSON.parse(executer(cmd, {}));
  assert.deepEqual(sortie, { systemMessage: 'écrit, attend: dirigeant' });
});

test('`plafond_par_heure` du classement devient la variable d\'environnement de la garde', () => {
  const chemin = join(TMP, 'lit-env.js');
  writeFileSync(chemin, 'process.stdout.write(JSON.stringify({systemMessage: "N=" + process.env.SOMTECH_SCRIBE_RELANCES_PAR_HEURE}));\n');
  const cmd = commandePourGardeStop(chemin, 30);
  const sortie = JSON.parse(executer(cmd, {}));
  assert.equal(sortie.systemMessage, 'N=30');
});

test('sans `plafond_par_heure` déclaré, aucune variable n\'est exportée par la commande', () => {
  const chemin = join(TMP, 'lit-env-absent.js');
  writeFileSync(chemin, 'process.stdout.write(JSON.stringify({systemMessage: "N=" + String(process.env.SOMTECH_SCRIBE_RELANCES_PAR_HEURE)}));\n');
  const cmd = commandePourGardeStop(chemin);
  const sortie = JSON.parse(executer(cmd, {}));
  assert.equal(sortie.systemMessage, 'N=undefined');
});

// ═══════════════════════════════════════════════════════════════════════════
// LE FICHIER `.demande` — arbitrage A : le rendu ne le produit JAMAIS.
// ═══════════════════════════════════════════════════════════════════════════

test('le rendu du métier de l\'orchestrateur ne produit JAMAIS d\'artefact `.demande`', () => {
  const chemin = join(process.cwd(), '..', 'metier', 'orchestrateur');
  const classementPath = join(chemin, 'classement.json');
  if (!existsSync(classementPath)) return; // hors du dépôt attendu : rien à mesurer ici
  const classement = JSON.parse(readFileSync(classementPath, 'utf8'));
  for (const c of classement.chapitres || []) {
    const f = join(chemin, 'chapitres', `${c.nom}.md`);
    if (existsSync(f)) c.contenu = readFileSync(f, 'utf8');
  }
  const r = rendre(classement);
  assert.equal(r.ok, true, JSON.stringify(r.erreurs));
  const chemins = Object.keys(r.artefacts);
  assert.ok(!chemins.some((c) => c.includes('.demande')),
    `le rendu a produit un artefact touchant « .demande » : ${chemins.filter((c) => c.includes('.demande')).join(', ')}`);
});

test('`cheminSur` (I5) refuse explicitement un chemin `.demande` — défense en profondeur', () => {
  // La fonction n'est pas exportée : on le mesure PAR LE RENDU, en injectant un
  // classement dont un chapitre porterait ce nom — cas qui ne doit jamais
  // produire l'artefact, mais qui doit REFUSER plutôt que de l'écrire en silence
  // si jamais quelqu'un l'y poussait.
  const r = rendre({
    role: 'r', version_abc: '1', hooks: [],
    items: [{ id: 'GF-R-001', nature: 'garde-fou', couche: 'hook', enonce: 'x', enonce_socle: 'c' }],
    chapitres: [{ nom: '.demande', abrege: 'x', version_pack: '1' }],
  });
  // Le chapitre existe mais son chemin `chapitres/.demande.md` contient `.demande` :
  // I5 doit le refuser plutôt que de laisser passer un artefact qui viserait ce nom.
  assert.equal(r.ok, false, 'un artefact visant `.demande` doit être refusé (I5), jamais écrit');
  assert.ok(r.erreurs.some((e) => e.includes('I5')));
});

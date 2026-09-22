// La portée écrite des orchestrateurs (T-20260922-0156) — le champ qui OUVRE un accès hors
// dépôt (`permissions.additionalDirectories`) est celui que le métier autorise et que le
// mécanisme, lui, refuse : `outils.md` nomme `~/somtech-token-audit/<application>/` sous
// « Ta portée — bornée, jamais implicite (GF-ORC-007) », et le gabarit `.claude/settings.json`
// n'en portait, avant ce lot, ZÉRO occurrence.
//
// Deux mesures distinctes, jamais déduites l'une de l'autre (garde de raisonnement du brief) :
//
//   ① `orchestrateur-update` propage-t-il `permissions.additionalDirectories`, EN PROFONDEUR —
//      une SOUS-clé de `permissions` — ou seulement des clés de PREMIER niveau (`hooks` l'était,
//      prouvé ailleurs) ? Essai réel, sur un lieu JETABLE fabriqué ici, jamais un lieu vivant.
//
//   ② Sur un lieu JAMAIS mis à jour, la commande apporte-t-elle tout d'un coup — et ROUGIT-elle
//      si la convergence produit un résultat invalide, au lieu de rendre un succès muet ?
//      `applyFiles` copie `.claude/settings.json` comme un fichier OPAQUE (copyFileSync, aucune
//      lecture JSON) : un gabarit dont ce fichier est syntaxiquement cassé est copié TEL QUEL,
//      et `armement()` (source unique de ce diagnostic) ne fait qu'imprimer un avertissement —
//      la commande rend 0. C'est le succès partiel que ce lot ferme.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { run } from '../src/cli.js';
import { alignerLePosteSur } from './lib/poste-conforme.js';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

/** Un gabarit orchestrateur JETABLE, jamais celui du dépôt réel. */
function makeGabarit({ settingsContenu, extra } = {}) {
  const root = tmp('smtk-adddir-payload-');
  writeFileSync(join(root, 'pack.json'), JSON.stringify({
    name: 'fixture-pack', version: '9.9.9',
    modules: { core: { default: true, paths: ['.claude/'] } },
  }, null, 2));
  const gabarit = join(root, '.claude', 'templates', 'orchestrateur');
  mkdirSync(join(gabarit, '.claude'), { recursive: true });
  writeFileSync(join(gabarit, 'CLAUDE.md'), '# metier v2 — apres correctif\n');
  writeFileSync(join(gabarit, '.claude', 'settings.json'), settingsContenu);
  if (extra) {
    for (const [nom, contenu] of Object.entries(extra)) {
      const chemin = join(gabarit, nom);
      mkdirSync(dirname(chemin), { recursive: true });
      writeFileSync(chemin, contenu);
    }
  }
  // Le poste est rendu conforme à CE gabarit jetable : la garde de fraîcheur tourne sous ce
  // test, elle compare, et elle trouve identique — on ne la désarme pas pour autant.
  alignerLePosteSur(root);
  return root;
}

/** Un lieu d'orchestrateur JETABLE, déjà posé, représentant un état « jamais mis à jour ». */
function makeLieuJetable({ settingsContenu, claudeContenu = '# metier v1 — avant correctif\n' } = {}) {
  const repo = tmp('smtk-adddir-repo-');
  const lieu = join(repo, '.orchestrateur', 't-essai-jetable');
  mkdirSync(lieu, { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), claudeContenu);
  writeFileSync(join(lieu, 'CONTEXTE.md'), '# ce que ce chantier sait de lui-même\n');
  if (settingsContenu != null) {
    mkdirSync(join(lieu, '.claude'), { recursive: true });
    writeFileSync(join(lieu, '.claude', 'settings.json'), settingsContenu);
  }
  return repo;
}

const settingsLieuAvant = JSON.stringify({ permissions: { deny: ['NotebookEdit'] } }, null, 2);
const settingsGabaritApres = JSON.stringify({
  permissions: {
    deny: ['NotebookEdit'],
    additionalDirectories: ['~/somtech-token-audit/acme'],
  },
}, null, 2);

// ═══════════════════════════════ ① EN PROFONDEUR — sous-clé de `permissions`, pas seulement le premier niveau

test('① orchestrateur-update propage additionalDirectories EN PROFONDEUR (sous-clé de permissions)', async () => {
  const payload = makeGabarit({ settingsContenu: settingsGabaritApres });
  const repo = makeLieuJetable({ settingsContenu: settingsLieuAvant });
  const cible = join(repo, '.orchestrateur', 't-essai-jetable', '.claude', 'settings.json');

  const avant = JSON.parse(readFileSync(cible, 'utf8'));
  assert.equal(avant.permissions.additionalDirectories, undefined, 'le fixture doit partir SANS le champ, sinon ce test ne prouve rien');

  const code = await run(['orchestrateur-update', '--nom', 't-essai-jetable', '--source', payload, '--target', repo]);
  assert.equal(code, 0);

  const apres = JSON.parse(readFileSync(cible, 'utf8'));
  assert.deepEqual(
    apres.permissions.additionalDirectories, ['~/somtech-token-audit/acme'],
    'additionalDirectories doit apparaître comme SOUS-CLÉ de permissions — pas seulement une clé de premier niveau comme `hooks`',
  );
  assert.deepEqual(apres.permissions.deny, ['NotebookEdit'], 'le reste de permissions doit converger aussi, pas seulement le champ mesuré');
});

// ═══════════════════════════════ ② tout d'un coup, depuis un lieu jamais mis à jour

test('② un lieu JAMAIS mis à jour (sans .claude/settings.json du tout) reçoit CLAUDE.md ET le fichier de droits en UN SEUL appel', async () => {
  const payload = makeGabarit({ settingsContenu: settingsGabaritApres });
  // Aucun .claude/settings.json déposé : le cas metabetchouan, antérieur au lot des hooks.
  const repo = makeLieuJetable({ settingsContenu: null });
  const lieu = join(repo, '.orchestrateur', 't-essai-jetable');

  assert.ok(!existsSync(join(lieu, '.claude', 'settings.json')), 'le fixture doit partir sans fichier de droits, sinon ce test ne prouve rien');

  const code = await run(['orchestrateur-update', '--nom', 't-essai-jetable', '--source', payload, '--target', repo]);
  assert.equal(code, 0);

  assert.equal(readFileSync(join(lieu, 'CLAUDE.md'), 'utf8'), '# metier v2 — apres correctif\n');
  const settings = JSON.parse(readFileSync(join(lieu, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(settings.permissions.additionalDirectories, ['~/somtech-token-audit/acme']);
});

// ═══════════════════════════════ ② rougit-elle si elle échoue — jamais un succès partiel

test('② un gabarit dont le fichier de droits est un JSON CASSÉ fait ROUGIR la commande (pas de succès partiel)', async () => {
  const payload = makeGabarit({ settingsContenu: '{ "permissions": { "deny": ["NotebookEdit"] ' }); // JSON tronqué, volontairement
  const repo = makeLieuJetable({ settingsContenu: settingsLieuAvant });
  const cible = join(repo, '.orchestrateur', 't-essai-jetable', '.claude', 'settings.json');
  const avant = readFileSync(cible, 'utf8');

  const code = await run(['orchestrateur-update', '--nom', 't-essai-jetable', '--source', payload, '--target', repo]);

  assert.notEqual(code, 0, 'un fichier de droits du gabarit illisible doit faire échouer la commande — un lieu désarmé qui se croit à jour est pire qu\'un refus');
  assert.equal(
    readFileSync(cible, 'utf8'), avant,
    'rien n\'a dû être écrit dans le lieu : un échec qui a quand même modifié le fichier de droits serait le succès partiel que ce lot ferme',
  );
});

test('② le même gabarit cassé, mais SANS fichier de droits préexistant dans le lieu : toujours un échec, jamais un fichier de droits fantôme', async () => {
  const payload = makeGabarit({ settingsContenu: '{ "permissions": { "deny": ["NotebookEdit"] ' });
  const repo = makeLieuJetable({ settingsContenu: null });
  const lieu = join(repo, '.orchestrateur', 't-essai-jetable');

  const code = await run(['orchestrateur-update', '--nom', 't-essai-jetable', '--source', payload, '--target', repo]);

  assert.notEqual(code, 0);
  assert.ok(!existsSync(join(lieu, '.claude', 'settings.json')), 'aucun fichier de droits cassé ne doit être né du gabarit cassé');
});

// ═══════════════════════════════ le VRAI gabarit du dépôt — la régression que ce lot ferme

test('le VRAI gabarit `.claude/templates/orchestrateur/.claude/settings.json` nomme les grands livres des jetons dans additionalDirectories', () => {
  const HERE = new URL('.', import.meta.url).pathname;
  const reel = join(HERE, '..', '..', '.claude', 'templates', 'orchestrateur', '.claude', 'settings.json');
  const settings = JSON.parse(readFileSync(reel, 'utf8'));

  assert.ok(
    Array.isArray(settings.permissions?.additionalDirectories),
    'permissions.additionalDirectories doit exister et être un tableau — le métier (outils.md ligne 28) autorise ce dossier, le mécanisme doit le réaliser',
  );
  assert.ok(
    settings.permissions.additionalDirectories.some((d) => d.includes('somtech-token-audit')),
    'le dossier des grands livres des jetons doit être NOMMÉ dans additionalDirectories — jamais une catégorie plus large',
  );
});

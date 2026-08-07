// La mise à jour d'un lieu de représentant déjà posé chez un client (E-20260807-0004).
//
// Deux dangers symétriques gouvernent tout ce fichier, et le second est le pire :
//
//   1. La DIVERGENCE SILENCIEUSE — un CLAUDE.md posé en janvier reste celui de janvier
//      pour toujours, défauts compris, sans que rien ne le signale.
//   2. L'ÉCRASEMENT DE CE QU'ON SAIT DU CLIENT — CONTEXTE.md, écrit à la main, remplacé
//      par erreur. Pire que la divergence : le client s'entend redemander ce qu'il a
//      déjà expliqué. C'est la frontière absolue de RA-REL-014.
//
// Leçon du chantier D-20260805-0005 (neuf revues, neuf défauts, trois motifs dominants),
// appliquée ici :
//
//   - AUCUN test ne passe par un système de fichiers plus indulgent que le vrai : chaque
//     scénario écrit sur un VRAI répertoire temporaire (mkdtempSync + fs réel), jamais un
//     double en mémoire.
//   - AUCUNE garde ne se contente de « le fichier existe encore » : la préservation de
//     CONTEXTE.md et la convergence de CLAUDE.md sont prouvées par CONTENU comparé,
//     jamais par présence.
//   - La porte d'écriture est ÉNUMÉRÉE : un test statique (plus bas) garantit qu'il n'en
//     existe qu'une dans representant.js — celle qui passe par engine.js.
//   - La sauvegarde n'est pas seulement « présente » : elle est RESTAURÉE et comparée
//     (RA-DIS-003).
//
// Traçabilité : E-20260807-0004 / D-20260807-0001, RA-REL-014, RA-DIS-003.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run, parseArgs } from '../src/cli.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

const CLAUDE_V1 = '# Tu es le représentant de ce client\n\n> `CLAUDE.md` remplacé, `CONTEXTE.md` jamais touché.\n\nversion 1 du métier.\n';
const CLAUDE_V2 = '# Tu es le représentant de ce client\n\n> `CLAUDE.md` remplacé, `CONTEXTE.md` jamais touché.\n\nversion 2 du métier — corrige un défaut de la v1.\n';
const CONTEXTE = '# Ce qu\'on sait de ce client\n\nLe client : Acme. Le canal : #acme-support.\nCLAUDE.md ne remplace jamais ceci.\n';

/** Fixture d'un payload de pack minimal, avec le gabarit du représentant. */
function makeFixturePayload({ extra } = {}) {
  const root = tmp('smtk-repr-payload-');
  writeFileSync(join(root, 'pack.json'), JSON.stringify({
    name: 'fixture-pack', version: '9.9.9',
    modules: { core: { default: true, paths: ['.claude/'] } },
  }, null, 2));
  const gabarit = join(root, '.claude', 'templates', 'gestionnaire-client');
  mkdirSync(gabarit, { recursive: true });
  writeFileSync(join(gabarit, 'CLAUDE.md'), CLAUDE_V2);
  writeFileSync(join(gabarit, 'CONTEXTE.md'), CONTEXTE); // starter, jamais utilisé pour écraser
  if (extra) for (const [nom, contenu] of Object.entries(extra)) writeFileSync(join(gabarit, nom), contenu);
  return root;
}

/** Un dépôt client fixture, avec (ou sans) un lieu déjà posé. */
function makeClientRepo({ pose = true, contexteContenu = CONTEXTE, claudeContenu = CLAUDE_V1 } = {}) {
  const repo = tmp('smtk-repr-client-');
  if (pose) {
    const lieu = join(repo, '.gestionnaire', 'acme');
    mkdirSync(lieu, { recursive: true });
    writeFileSync(join(lieu, 'CLAUDE.md'), claudeContenu);
    writeFileSync(join(lieu, 'CONTEXTE.md'), contexteContenu);
  }
  return repo;
}

const lieu = (repo, client = 'acme') => join(repo, '.gestionnaire', client);

// ═══════════════════════════════ 0. le CLI sait parser la commande

test('parseArgs : --client et --client= sont reconnus', () => {
  const a = parseArgs(['representant-update', '--client', 'acme']);
  assert.equal(a.command, 'representant-update');
  assert.equal(a.flags.client, 'acme');
  const b = parseArgs(['representant-update', '--client=acme']);
  assert.equal(b.flags.client, 'acme');
});

// ═══════════════════════════════ 1. le lieu doit déjà exister — cette compétence ne POSE rien

test('cible absente : refuse, et ne crée RIEN — poser un lieu n’est pas son rôle', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo({ pose: false });

  const code = await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);

  assert.notEqual(code, 0, 'un lieu jamais posé doit faire échouer la commande');
  assert.ok(!existsSync(lieu(repo)), 'la commande ne doit pas avoir créé le lieu elle-même — ce n’est pas son rôle (pose)');
});

// ═══════════════════════════════ 2. le slug client est un segment de chemin, jamais une évasion

test('slug client invalide (évasion de chemin) : refusé avant toute écriture', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo({ pose: false });
  mkdirSync(join(repo, '.gestionnaire'), { recursive: true });

  for (const client of ['../evil', '..', 'a/b', '', '.', 'Acme']) {
    const code = await run(['representant-update', '--client', client, '--source', payload, '--target', repo]);
    assert.notEqual(code, 0, `« ${client} » doit être refusé`);
  }
  // Rien n'a fui hors de .gestionnaire/ dans le dépôt client.
  const dehors = join(repo, 'evil');
  assert.ok(!existsSync(dehors), 'un slug qui évade le chemin ne doit rien écrire hors de .gestionnaire/');
});

// ═══════════════════════════════ 3. CLAUDE.md converge — PROUVÉ PAR CONTENU

test('CLAUDE.md divergent converge vers le CONTENU exact du gabarit du pack', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo({ claudeContenu: CLAUDE_V1 });

  const before = readFileSync(join(lieu(repo), 'CLAUDE.md'), 'utf8');
  assert.notEqual(before, CLAUDE_V2, 'le fixture doit partir divergent, sinon ce test ne prouve rien');

  const code = await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);
  assert.equal(code, 0);

  const after = readFileSync(join(lieu(repo), 'CLAUDE.md'), 'utf8');
  assert.equal(after, CLAUDE_V2, 'CLAUDE.md doit porter EXACTEMENT le contenu du gabarit — un « ça existe encore » ne prouve rien');
});

test('CLAUDE.md absent du lieu (posé partiellement) : créé avec le contenu du pack', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo();
  const fs = await import('node:fs');
  fs.rmSync(join(lieu(repo), 'CLAUDE.md'));

  const code = await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);
  assert.equal(code, 0);
  assert.equal(readFileSync(join(lieu(repo), 'CLAUDE.md'), 'utf8'), CLAUDE_V2);
});

// ═══════════════════════════════ 4. CONTEXTE.md n'est JAMAIS écrit — RA-REL-014

test('CONTEXTE.md : contenu strictement IDENTIQUE après une mise à jour qui converge CLAUDE.md', async () => {
  const payload = makeFixturePayload();
  const CONTEXTE_CLIENT = '# Ce qu\'on sait de ce client\n\nRDV commercial le 14 mars, ne pas relancer avant.\n';
  const repo = makeClientRepo({ claudeContenu: CLAUDE_V1, contexteContenu: CONTEXTE_CLIENT });

  const code = await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);
  assert.equal(code, 0);

  assert.equal(
    readFileSync(join(lieu(repo), 'CONTEXTE.md'), 'utf8'),
    CONTEXTE_CLIENT,
    'CONTEXTE.md a bougé — c’est exactement la perte silencieuse que RA-REL-014 interdit',
  );
});

test('CONTEXTE.md : même garantie quand son contenu MENTIONNE « CLAUDE.md » — pas de branchement sur le contenu', async () => {
  // Un piège classique : une implémentation qui déciderait quoi préserver en inspectant le
  // TEXTE plutôt que le NOM du fichier se tromperait sur un contexte qui parle de CLAUDE.md.
  const payload = makeFixturePayload();
  const piege = '# Contexte\n\nCe client a demandé si CLAUDE.md pouvait être modifié. Réponse : non.\n';
  const repo = makeClientRepo({ claudeContenu: CLAUDE_V1, contexteContenu: piege });

  await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);

  assert.equal(readFileSync(join(lieu(repo), 'CONTEXTE.md'), 'utf8'), piege);
});

test('CONTEXTE.md : identique après DEUX mises à jour successives (idempotence)', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo({ claudeContenu: CLAUDE_V1 });
  const CONTEXTE_CLIENT = readFileSync(join(lieu(repo), 'CONTEXTE.md'), 'utf8');

  await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);
  await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);

  assert.equal(readFileSync(join(lieu(repo), 'CONTEXTE.md'), 'utf8'), CONTEXTE_CLIENT);
});

test('CONTEXTE.md absent du lieu (posé partiellement) : n’est PAS créé par la mise à jour', async () => {
  // Créer CONTEXTE.md n'est pas le rôle de cette compétence — seul un représentant qui le
  // remplit à la main (ou la compétence qui POSE) le fait naître. Une mise à jour qui le
  // créerait à vide écraserait discrètement le rôle de la pose.
  const payload = makeFixturePayload();
  const repo = makeClientRepo();
  const fs = await import('node:fs');
  fs.rmSync(join(lieu(repo), 'CONTEXTE.md'));

  await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);

  assert.ok(!existsSync(join(lieu(repo), 'CONTEXTE.md')), 'CONTEXTE.md ne doit pas être fabriqué par une mise à jour');
});

// ═══════════════════════════════ 5. la sauvegarde existe et est RÉCUPÉRABLE (RA-DIS-003)

test('la dérive de CLAUDE.md est sauvegardée AVANT convergence, et RESTAURÉE elle redonne l’original', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo({ claudeContenu: CLAUDE_V1 });
  const original = readFileSync(join(lieu(repo), 'CLAUDE.md'), 'utf8');

  await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);

  const bak = join(lieu(repo), 'CLAUDE.md.somtech.bak');
  assert.ok(existsSync(bak), 'aucune sauvegarde créée avant l’écrasement — RA-DIS-003 l’exige');

  // Ne pas se contenter de « le backup existe » : le restaurer réellement et comparer.
  const cible = join(lieu(repo), 'CLAUDE.md');
  copyFileSync(bak, cible);
  assert.equal(
    readFileSync(cible, 'utf8'), original,
    'la sauvegarde restaurée ne redonne pas l’original — elle ne serait pas récupérable en pratique',
  );
});

test('idempotence : une seconde mise à jour sans dérive ne recrée pas de backup', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo({ claudeContenu: CLAUDE_V1 });

  await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);
  await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);

  assert.ok(existsSync(join(lieu(repo), 'CLAUDE.md.somtech.bak')), 'le premier backup doit exister');
  assert.ok(
    !existsSync(join(lieu(repo), 'CLAUDE.md.somtech.bak.1')),
    'la seconde mise à jour n’avait rien à converger (CLAUDE.md déjà à jour) — un second backup dirait le contraire',
  );
});

// ═══════════════════════════════ 6. un fichier ajouté au gabarit est repris — sans liste figée

test('un fichier ajouté au gabarit du pack (ex. futur .mcp.json) est converti automatiquement', () => {
  // C'est le troisième motif du chantier D-20260805-0005 : « un correctif ne couvre qu'une
  // porte sur deux ». Si la commande énumérait CLAUDE.md/.mcp.json/settings.json EN DUR, un
  // futur fichier ajouté au gabarit (par la compétence de pose, e-2) resterait ignoré, en
  // silence, exactement comme un doublon de porte non couverte. On le prouve en ajoutant un
  // troisième fichier au gabarit fixture, absent du code de la commande.
  return (async () => {
    const payload = makeFixturePayload({ extra: { '.mcp.json': '{"mcpServers":{}}\n' } });
    const repo = makeClientRepo();

    const code = await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);
    assert.equal(code, 0);

    assert.ok(existsSync(join(lieu(repo), '.mcp.json')), '.mcp.json aurait dû être créé — la sync doit énumérer le gabarit, pas une liste figée');
    assert.equal(readFileSync(join(lieu(repo), '.mcp.json'), 'utf8'), '{"mcpServers":{}}\n');
    // Et CONTEXTE.md reste intact malgré le fichier en plus.
    assert.equal(readFileSync(join(lieu(repo), 'CONTEXTE.md'), 'utf8'), CONTEXTE);
  })();
});

// ═══════════════════════════════ 7. dry-run n'écrit rien

test('--dry-run : ne modifie rien sur disque, et rapporte la dérive (exit 2)', async () => {
  const payload = makeFixturePayload();
  const repo = makeClientRepo({ claudeContenu: CLAUDE_V1 });
  const before = readFileSync(join(lieu(repo), 'CLAUDE.md'), 'utf8');

  const code = await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo, '--dry-run']);

  assert.equal(code, 2, 'dry-run avec dérive en attente doit sortir en 2 (cohérent avec `update`)');
  assert.equal(readFileSync(join(lieu(repo), 'CLAUDE.md'), 'utf8'), before, 'dry-run ne doit rien écrire');
  assert.ok(!existsSync(join(lieu(repo), 'CLAUDE.md.somtech.bak')), 'dry-run ne doit créer aucune sauvegarde');
});

// ═══════════════════════════════ 8. une seule porte d'écriture (garde structurelle)

test('representant.js n’a qu’UNE porte d’écriture fichier : celle d’engine.js — pas d’appel fs direct', () => {
  // Le second motif dominant du chantier (« un correctif ne couvre qu’une porte sur deux »)
  // se prévient en amont en garantissant qu’il n’existe qu’une seule porte à surveiller :
  // toute écriture passe par `applyFiles`/`collectFiles`, déjà revus et testés dans
  // engine.js. Un futur appel `writeFileSync`/`copyFileSync`/... ajouté directement dans ce
  // fichier ouvrirait une seconde porte, non couverte par les garanties CONTEXTE.md
  // ci-dessus — ce test la ferme avant qu'elle n'existe.
  const src = readFileSync(join(CLI_DIR, 'src', 'commands', 'representant.js'), 'utf8');
  const sansCommentaires = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  const ECRITURE_DIRECTE = /\b(writeFileSync|copyFileSync|appendFileSync|rmSync|unlinkSync|rmdirSync|renameSync)\s*\(/;
  assert.ok(
    !ECRITURE_DIRECTE.test(sansCommentaires),
    'representant.js appelle une fonction d’écriture fichier directement — toute écriture doit passer par engine.js (applyFiles/collectFiles), la seule porte déjà revue pour la frontière CONTEXTE.md',
  );
});

test('representant.js n’a pas de liste de noms de fichiers figée pour la synchronisation', () => {
  // Contre-preuve structurelle du test « un fichier ajouté au gabarit… » ci-dessus : si le
  // code contenait littéralement 'CLAUDE.md' dans un tableau de fichiers à synchroniser, le
  // test précédent aurait pu passer par coïncidence sur CETTE fixture sans que la garantie
  // tienne en général. On vérifie que la seule mention de CLAUDE.md dans le fichier est
  // celle du dossier gabarit ou de PRESERVE (CONTEXTE.md), jamais une énumération de sync.
  const src = readFileSync(join(CLI_DIR, 'src', 'commands', 'representant.js'), 'utf8');
  assert.ok(
    !/\[\s*['"`]CLAUDE\.md['"`]/.test(src),
    'une liste littérale commençant par CLAUDE.md suggère une énumération figée des fichiers à synchroniser',
  );
});

// ═══════════════════════════════ 9. distribution : la commande est câblée dans l’aide du CLI

test('l’aide du CLI mentionne representant-update', async () => {
  const before = console.log;
  let out = '';
  console.log = (...a) => { out += a.join(' ') + '\n'; };
  try {
    await run(['--help']);
  } finally {
    console.log = before;
  }
  assert.match(out, /representant-update/, 'la commande doit apparaître dans l’aide, sinon elle reste invisible');
});

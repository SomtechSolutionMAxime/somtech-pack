// rendez-vous-bin.test.js — le fichier exécutable réel de la ronde, avec un FAUX herdr en
// tête de PATH. Aucun service n'est installé, aucun `launchctl` n'est touché.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260815-0008)
//
// Le correctif de ce ticket distingue TROIS silences que la ronde confondait. Une revue en
// passe 1 a posé la mutation qui manquait — retirer le refus « aucune session ouverte » de
// `tenir()` — et **les tests sont restés verts** : ils éprouvaient le balayage, jamais le
// code qui INTERPRÈTE ce que le balayage rend.
//
// C'était le motif dominant de ce dépôt, commis dans le lot qui le corrige : des messages
// écrits pour être lus par un humain, et que rien n'oblige à exister.
//
// ⚠️ LES TROIS SILENCES NE SE VALENT PAS, et c'est tout l'objet :
//
//   • aucune session ouverte      → PANNE : il n'y a nulle part où regarder ;
//   • toutes les sessions muettes → PANNE : on n'a rien pu établir ;
//   • aucun orchestrateur vivant  → SUCCÈS : personne n'attend de rappel.
//
// Les confondre est ce qui a laissé un orchestrateur vivre des jours sans un seul réveil.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const BIN = join(resolve(HERE, '..'), 'bin', 'rendez-vous.js');

let bac;
let pathOriginal;

/** Un faux herdr qui répond — ou non — selon la session à laquelle on lui parle. */
function installerFauxHerdr({ muettes = false, agents = [] } = {}) {
  const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'agent' && args[1] === 'list') {
  ${muettes ? 'process.stderr.write("session injoignable\\n"); process.exit(1);' : ''}
  process.stdout.write(JSON.stringify({ result: { agents: ${JSON.stringify(agents)} } }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ result: { ok: true } }));
process.exit(0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

/** Joue la ronde pour de vrai, avec les sessions qu'on lui désigne. */
function lancerRonde(sessions) {
  const r = spawnSync(process.execPath, [BIN, 'ronde'], {
    env: {
      ...process.env,
      HERDR_SESSIONS_ESSAIS: sessions.join(':'),
      HERDR_SOCKET_PATH: '',
      // ⚠️ CES DEUX-LÀ SEULEMENT — ce sont les seules que la ronde lit vraiment.
      // Une première version posait aussi `LIVRAISON_*`, que RIEN ne lit sur ce chemin :
      // une configuration morte qui affirme un contrôle qu'elle n'a pas. Le test paraissait
      // borné et ne l'était pas — le jour où le faux herdr déclencherait une relivraison,
      // les défauts de 15 essais et 20 s s'appliqueraient quand même.
      RENDEZ_VOUS_DELAI_MS: '5',
      RENDEZ_VOUS_ECHEANCE_MS: '50',
    },
  });
  return { code: r.status ?? 1, stdout: (r.stdout ?? '').toString(), stderr: (r.stderr ?? '').toString() };
}

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'smtk-rdv-bin-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});

after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});

test('AUCUNE SESSION OUVERTE est une panne, et la ronde le dit — pas un silence de plus', () => {
  installerFauxHerdr();
  const r = lancerRonde([]);
  assert.equal(r.code, 1, `panne attendue — stderr: ${r.stderr}`);
  assert.match(r.stderr, /aucune session/i, 'le motif doit être nommé');
  assert.match(
    r.stderr,
    /personne n'attend|pas la même chose/i,
    'et distingué du cas où personne n’attend — c’est la confusion qui a coûté des jours'
  );
});

test('TOUTES LES SESSIONS MUETTES est une panne, et la ronde nomme celles qui n’ont pas répondu', () => {
  installerFauxHerdr({ muettes: true });
  const r = lancerRonde(['/s/a.sock', '/s/b.sock']);
  assert.equal(r.code, 1, `panne attendue — stderr: ${r.stderr}`);
  assert.match(r.stderr, /muettes/i);
  assert.match(r.stderr, /\/s\/a\.sock/, 'chaque session muette doit être nommée — sinon la ronde ment par omission');
  assert.match(r.stderr, /\/s\/b\.sock/);
});

// ⚠️ LE CAS QUI DOIT RÉUSSIR, et c'est celui qu'on rangerait le plus volontiers avec les
// pannes : les sessions répondent, il n'y a simplement aucun orchestrateur vivant. Personne
// n'attend de rappel — un réveil qui échouerait là ferait du bruit chaque heure de la nuit.
test('AUCUN ORCHESTRATEUR VIVANT est un SUCCÈS — les sessions ont répondu, personne n’attend', () => {
  installerFauxHerdr({ agents: [{ pane_id: 'w1:p1', name: 'un-agent', foreground_cwd: '/un/depot/sans/lieu' }] });
  const r = lancerRonde(['/s/a.sock']);
  assert.equal(r.code, 0, `succès attendu — stderr: ${r.stderr}`);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.orchestrateurs, 0);
  assert.equal(rendu.sessions, 1, 'et le compte rendu dit combien de sessions ont été regardées');
  assert.deepEqual(rendu.muettes, [], 'aucune muette : le silence n’a pas la même cause');
});

test('le compte rendu porte ce que la ronde a REGARDÉ, pas seulement ce qu’elle a livré', () => {
  installerFauxHerdr({ agents: [] });
  const r = lancerRonde(['/s/a.sock', '/s/b.sock']);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.sessions, 2, 'sans ce compte, un réveil qui ne voit rien est indiscernable d’un réveil qui n’a rien cherché');
});

// ═══════ LE POINT QUI DÉCIDE DE TOUT : chaque rappel part vers la session de SON destinataire
//
// ⚠️ CE CONTRÔLE EXISTE PARCE QUE LA REVUE DE FOND A MONTRÉ QU'IL MANQUAIT. Elle a remplacé
// `socket: c.socket` par `socket: null` dans le binaire — le bug d'origine, exactement — et
// **224 tests sont restés verts**. Les contrôles unitaires éprouvaient le balayage, les
// contrôles de bout en bout n'atteignaient que les cas SANS orchestrateur.
//
// Sans lui, on aurait remplacé « ne réveiller personne » par « en réveiller un et croire
// avoir fait le tour » — et c'est le genre de régression qui ne se voit qu'à un réveil qui
// n'arrive pas, c'est-à-dire à rien.

/** Un vrai lieu d'orchestrateur sur disque — `roleDuLieu` le lit, il ne le devine pas. */
function lieuDOrchestrateur(nom) {
  // ⚠️ ON COPIE LES VRAIS GABARITS, on n'invente pas leur contenu. `roleDuLieu` reconnaît un
  // lieu à la PREMIÈRE LIGNE de chacun de ses fichiers — un lieu fabriqué à la main serait
  // rejeté, et le contrôle mesurerait alors le contraire de ce qu'il croit.
  const lieu = join(bac, 'depot', '.orchestrateur', nom);
  const gabarits = join(REPO_ROOT, '.claude', 'templates', 'orchestrateur');
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  for (const f of ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json', join('.claude', 'settings.json')]) {
    copyFileSync(join(gabarits, f), join(lieu, f));
  }
  return lieu;
}

/** Un faux herdr qui note À QUI on lui a parlé, pour chaque geste. */
function fauxHerdrQuiNoteLaSession(parSession) {
  const journal = join(bac, 'sessions.jsonl');
  writeFileSync(journal, '');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const socket = process.env.HERDR_SOCKET_PATH || null;
fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify({ a: args, s: socket }) + '\\n');
const parSession = ${JSON.stringify(parSession)};
if (args[0] === 'agent' && args[1] === 'list') {
  process.stdout.write(JSON.stringify({ result: { agents: parSession[socket] || [] } }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ result: { ok: true } }));
process.exit(0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
  return journal;
}

test('chaque rappel part vers la session de SON orchestrateur — jamais celle du premier venu', () => {
  const lieuA = lieuDOrchestrateur('chez-a');
  const lieuB = lieuDOrchestrateur('chez-b');
  const sockA = '/s/a.sock';
  const sockB = '/s/b.sock';
  const journal = fauxHerdrQuiNoteLaSession({
    [sockA]: [{ pane_id: 'wA:p1', name: 'chez-a', foreground_cwd: lieuA }],
    [sockB]: [{ pane_id: 'wB:p1', name: 'chez-b', foreground_cwd: lieuB }],
  });

  lancerRonde([sockA, sockB]);

  const entrees = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const versPane = (pane) => entrees.filter((e) => e.a.includes(pane)).map((e) => e.s);

  const gestesA = versPane('wA:p1');
  const gestesB = versPane('wB:p1');
  assert.ok(gestesA.length > 0, 'l’orchestrateur de la session A doit avoir reçu au moins un geste');
  assert.ok(gestesB.length > 0, 'et celui de la session B aussi — sinon on n’en réveille qu’un');
  assert.deepEqual([...new Set(gestesA)], [sockA], 'tout geste vers wA:p1 passe par la session A');
  assert.deepEqual([...new Set(gestesB)], [sockB], 'tout geste vers wB:p1 passe par la session B');
});

// ═════ LES DEUX SILENCES QUE « AUCUN ORCHESTRATEUR » CONFONDAIT ENCORE
//
// ⚠️ TROUVÉ PAR LA REVUE DE FOND, et c'est le mode de panne de ce ticket qui se rouvre.
// « Zéro orchestrateur » avait deux causes que rien ne séparait : il n'y en a vraiment
// aucun, ou `roleDuLieu` n'en a reconnu aucun — un gabarit modifié, un en-tête déplacé, et
// la reconnaissance échoue **en silence**. Les deux rendaient le même succès, `exit 0`.
//
// Un poste avec onze agents vivants et zéro reconnu se déclarait donc content, exactement
// comme un poste vide. C'est l'état qu'aurait ce ticket s'il se rouvrait, et personne ne
// pouvait le voir sans compter les panes à la main.
test('le compte rendu sépare « personne n’attend » de « je ne reconnais personne »', () => {
  installerFauxHerdr({
    agents: [
      { pane_id: 'w1:p1', name: 'un', foreground_cwd: '/un/depot/sans/lieu' },
      { pane_id: 'w1:p2', name: 'deux', foreground_cwd: '/un/autre/sans/lieu' },
    ],
  });
  const avecDesAgents = JSON.parse(lancerRonde(['/s/a.sock']).stdout);
  assert.equal(avecDesAgents.orchestrateurs, 0);
  assert.equal(
    avecDesAgents.agents_vus,
    2,
    'deux agents vivants et aucun reconnu — un humain doit pouvoir le voir sans compter les panes à la main'
  );

  installerFauxHerdr({ agents: [] });
  const vraimentVide = JSON.parse(lancerRonde(['/s/a.sock']).stdout);
  assert.equal(vraimentVide.orchestrateurs, 0);
  assert.equal(vraimentVide.agents_vus, 0, 'ici il n’y a réellement personne — et ça ne se dit pas pareil');
});

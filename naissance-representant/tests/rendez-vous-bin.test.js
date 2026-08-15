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
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
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
      RENDEZ_VOUS_DELAI_MS: '5',
      RENDEZ_VOUS_ECHEANCE_MS: '50',
      LIVRAISON_ESSAIS: '1',
      LIVRAISON_DELAI_MS: '5',
      LIVRAISON_ATTENTE_MS: '10',
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

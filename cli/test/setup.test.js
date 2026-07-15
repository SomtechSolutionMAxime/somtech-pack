// Tests de la commande setup (skills globaux + claude-swt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '../src/cli.js';
import { installRcBlock, MARKER_BEGIN } from '../src/shellrc.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const SNIPPET = join(REPO, 'scripts', 'shell', 'claude-swt.sh');

const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const markerCount = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split(MARKER_BEGIN).length - 1 : 0);

test('shellrc : install frais → 1 bloc, ligne préexistante préservée, backup', () => {
  const w = tmp('smtk-rc-'); const rc = join(w, 'zshrc'); const dest = join(w, 'dest');
  writeFileSync(rc, '# rc dev\nexport FOO=bar\n');
  const res = installRcBlock({ rcFile: rc, destDir: dest, snippetSrc: SNIPPET });
  assert.equal(res.action, 'added');
  assert.equal(markerCount(rc), 1);
  assert.ok(existsSync(join(dest, 'claude-swt.sh')), 'snippet copié');
  // Régression D-20260709-0003 : la lib swt-db.sh (logique BD par worktree) doit
  // être copiée à côté du snippet, sinon claude-swt.sh la source en vain
  // (`command -v swt_db_up` échoue) et aucun Postgres n'est provisionné.
  assert.ok(existsSync(join(dest, 'swt-db.sh')), 'lib swt-db.sh copiée à côté du snippet');
  // Régression D-20260715-0003 : la lib pack-freshness.sh (fraîcheur du pack : nudge +
  // auto-PR au launch, D-20260715-0001) DOIT être copiée à côté du snippet, sinon
  // claude-swt.sh la source en vain (`command -v pf_nudge_launch` échoue) et toute la
  // feature de fraîcheur est inerte. Parité avec swt-db.sh.
  assert.ok(existsSync(join(dest, 'pack-freshness.sh')), 'lib pack-freshness.sh copiée à côté du snippet');
  assert.ok(readFileSync(rc, 'utf8').includes('export FOO=bar'), 'ligne préexistante préservée');
  assert.ok(existsSync(`${rc}.somtech.bak`), 'backup créé');
});

test('shellrc : ré-install idempotent (3× → 1 seul bloc)', () => {
  const w = tmp('smtk-rc-'); const rc = join(w, 'zshrc'); const dest = join(w, 'dest');
  writeFileSync(rc, '# vierge\n');
  installRcBlock({ rcFile: rc, destDir: dest, snippetSrc: SNIPPET });
  installRcBlock({ rcFile: rc, destDir: dest, snippetSrc: SNIPPET });
  const res = installRcBlock({ rcFile: rc, destDir: dest, snippetSrc: SNIPPET });
  assert.equal(res.action, 'updated');
  assert.equal(markerCount(rc), 1, 'pas de doublon après 3 installs');
});

test('shellrc : bloc déséquilibré (BEGIN sans END) → refus', () => {
  const w = tmp('smtk-rc-'); const rc = join(w, 'zshrc'); const dest = join(w, 'dest');
  writeFileSync(rc, `${MARKER_BEGIN}\nsource x\n# END manquant\nexport KEEP=1\n`);
  assert.throws(() => installRcBlock({ rcFile: rc, destDir: dest, snippetSrc: SNIPPET }), /déséquilibré/);
  assert.ok(readFileSync(rc, 'utf8').includes('export KEEP=1'), 'aucune troncature');
});

test('shellrc : dry-run n’écrit rien', () => {
  const w = tmp('smtk-rc-'); const rc = join(w, 'zshrc'); const dest = join(w, 'dest');
  writeFileSync(rc, '# rc\n');
  installRcBlock({ rcFile: rc, destDir: dest, snippetSrc: SNIPPET, dryRun: true });
  assert.equal(markerCount(rc), 0, 'dry-run ne touche pas le rc');
  assert.ok(!existsSync(dest), 'dry-run ne crée pas dest');
});

test('run setup : skills copiés + claude-swt, idempotent, exit 0', async () => {
  const w = tmp('smtk-setup-');
  const rc = join(w, 'zshrc'); const sd = join(w, 'skills'); const wd = join(w, 'workflows'); const dd = join(w, 'somtech');
  writeFileSync(rc, '# rc\n');
  const args = ['setup', '--source', REPO, '--rc', rc, '--skills-dir', sd, '--workflows-dir', wd, '--dest', dd, '--yes', '--no-version-hook'];
  let code = await run(args);
  assert.equal(code, 0);
  // un skill global connu du repo
  assert.ok(existsSync(join(sd, 'somtech-pack-install', 'SKILL.md')), 'skill global copié');
  // un workflow global connu du repo
  assert.ok(existsSync(join(wd, 'analyse-decoupage-demande.js')), 'workflow global copié');
  assert.equal(markerCount(rc), 1, 'bloc claude-swt ajouté');
  // Régression D-20260709-0003 au grain `run setup` : la lib swt-db.sh doit
  // transiter jusqu'à dest par le chemin réel (payloadRoot → snippetSrc voisin).
  assert.ok(existsSync(join(dd, 'swt-db.sh')), 'lib swt-db.sh installée par run setup');
  // Régression D-20260715-0003 au grain `run setup` : pack-freshness.sh doit transiter
  // jusqu'à dest, sinon la fraîcheur (nudge + auto-PR) est inerte sur le poste.
  assert.ok(existsSync(join(dd, 'pack-freshness.sh')), 'lib pack-freshness.sh installée par run setup');
  // idempotent
  code = await run(args);
  assert.equal(code, 0);
  assert.equal(markerCount(rc), 1, 'toujours 1 bloc après re-run');
});

test('SÉCURITÉ : setup sans --yes en non-TTY → refus (exit 1), rc intact', async () => {
  // En test, process.stdin.isTTY est falsy → chemin non-interactif sans consentement.
  const w = tmp('smtk-setup-');
  const rc = join(w, 'zshrc'); const sd = join(w, 'skills'); const wd = join(w, 'workflows'); const dd = join(w, 'somtech');
  writeFileSync(rc, '# rc utilisateur\nexport KEEP=1\n');
  const code = await run(['setup', '--source', REPO, '--rc', rc, '--skills-dir', sd, '--workflows-dir', wd, '--dest', dd, '--no-version-hook']);
  assert.equal(code, 1, 'doit refuser sans --yes ni TTY');
  assert.equal(markerCount(rc), 0, 'le rc ne doit PAS être touché sans consentement');
  assert.ok(!existsSync(sd), 'aucun skill installé sans consentement');
  assert.ok(!existsSync(wd), 'aucun workflow installé sans consentement');
});

test('shellrc : contenu après le bloc préservé après ré-install (invariant)', () => {
  const w = tmp('smtk-rc-'); const rc = join(w, 'zshrc'); const dest = join(w, 'dest');
  installRcBlock({ rcFile: rc, destDir: dest, snippetSrc: SNIPPET });
  // ajoute du contenu APRÈS le bloc
  writeFileSync(rc, readFileSync(rc, 'utf8') + 'export AFTER=1\n');
  installRcBlock({ rcFile: rc, destDir: dest, snippetSrc: SNIPPET });
  const out = readFileSync(rc, 'utf8');
  assert.ok(out.includes('export AFTER=1'), 'le contenu post-bloc ne doit pas être perdu');
  assert.equal(markerCount(rc), 1, 'toujours un seul bloc');
});

test('run setup --dry-run : rien écrit', async () => {
  const w = tmp('smtk-setup-');
  const rc = join(w, 'zshrc'); const sd = join(w, 'skills'); const wd = join(w, 'workflows'); const dd = join(w, 'somtech');
  writeFileSync(rc, '# rc\n');
  const code = await run(['setup', '--source', REPO, '--rc', rc, '--skills-dir', sd, '--workflows-dir', wd, '--dest', dd, '--yes', '--dry-run', '--no-version-hook']);
  assert.equal(code, 0);
  assert.equal(markerCount(rc), 0, 'dry-run ne touche pas le rc');
  assert.ok(!existsSync(sd), 'dry-run ne copie pas les skills');
  assert.ok(!existsSync(wd), 'dry-run ne copie pas les workflows');
});

test('run setup --no-skills / --no-claude-swt : portée respectée', async () => {
  const w = tmp('smtk-setup-');
  const rc = join(w, 'zshrc'); const sd = join(w, 'skills'); const wd = join(w, 'workflows'); const dd = join(w, 'somtech');
  writeFileSync(rc, '# rc\n');
  await run(['setup', '--source', REPO, '--rc', rc, '--skills-dir', sd, '--workflows-dir', wd, '--dest', dd, '--yes', '--no-skills', '--no-workflows', '--no-version-hook']);
  assert.ok(!existsSync(sd), '--no-skills : pas de skills');
  assert.equal(markerCount(rc), 1, '--no-skills : claude-swt quand même installé');

  const w2 = tmp('smtk-setup-');
  const rc2 = join(w2, 'zshrc'); const sd2 = join(w2, 'skills'); const wd2 = join(w2, 'workflows'); const dd2 = join(w2, 'somtech');
  writeFileSync(rc2, '# rc\n');
  await run(['setup', '--source', REPO, '--rc', rc2, '--skills-dir', sd2, '--workflows-dir', wd2, '--dest', dd2, '--yes', '--no-claude-swt', '--no-version-hook']);
  assert.ok(existsSync(join(sd2, 'somtech-pack-install', 'SKILL.md')), '--no-claude-swt : skills installés');
  assert.equal(markerCount(rc2), 0, '--no-claude-swt : pas de bloc rc');
});

test('run setup --no-workflows : skills installés mais aucun workflow', async () => {
  const w = tmp('smtk-setup-');
  const rc = join(w, 'zshrc'); const sd = join(w, 'skills'); const wd = join(w, 'workflows'); const dd = join(w, 'somtech');
  writeFileSync(rc, '# rc\n');
  await run(['setup', '--source', REPO, '--rc', rc, '--skills-dir', sd, '--workflows-dir', wd, '--dest', dd, '--yes', '--no-workflows', '--no-claude-swt', '--no-version-hook']);
  assert.ok(existsSync(join(sd, 'somtech-pack-install', 'SKILL.md')), '--no-workflows : skills quand même installés');
  assert.ok(!existsSync(wd), '--no-workflows : aucun workflow installé');
});

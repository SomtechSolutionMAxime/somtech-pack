// « pack setup » VÉRIFIE LE VEILLEUR APRÈS AVOIR INSTALLÉ LA LIGNE DIRECTE
// (T-20260818-0035, critère 2 du ticket) — LE CÂBLAGE, PAS LA LOGIQUE.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER ÉPROUVE, ET CE QU'IL N'ÉPROUVE PAS
//
// La LOGIQUE de `releverSiPerime` (les 6 cas : socket absent, ping qui lève, ping sans
// `code`, à jour, périmé relevé, périmé non relevé) est éprouvée à part, entièrement
// injectée, dans `releve-veilleur.test.js`. Ce fichier-ci éprouve UNE SEULE CHOSE : que
// `cmdSetup` appelle vraiment ce module après avoir installé `ligne-directe`, sur un vrai
// `pack setup`, sans rien casser. Le cas exercé est le plus simple et le plus fréquent — un
// poste neuf, aucun veilleur en cours — et il suffit à prouver que le fil est bien branché :
// APRÈS un `run(['setup', …])` complet, le journal doit porter la phrase que `releverSiPerime`
// produit dans ce cas.
//
// ⚠️ ET UN TEST DE FORME QUI FERME LE DÉFAUT MESURÉ PAR BATISCAN. `reveillerVeilleur()` fait
// naître le veilleur DÉTACHÉ depuis SON PROPRE dossier (`ICI` dans `client.js`) : importer
// `client.js` depuis `payloadRoot` (le répertoire temporaire que `npx` dézippe pour
// l'exécution en cours) ferait donc naître un veilleur voué à disparaître avec ce dossier —
// exactement le veilleur éphémère mesuré le 2026-08-20. Une lecture du SOURCE de `setup.js`
// suffit à fermer ce défaut-là : le chemin d'import doit contenir `destDir`/`toolsDir`,
// jamais `payloadRoot`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '../src/cli.js';
import { empreinteDuHome, assertHomeIntact } from './lib/bac-a-sable.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

// ── ISOLATION GLOBALE (C1), COMME `setup.test.js` — OBLIGATOIRE, PAS UN CONFORT ────────
//
// 🔴 VÉCU DANS CE LOT MÊME : une première version de ce fichier passait `--dest`, `--rc`,
// `--skills-dir`, `--workflows-dir` et `--settings` explicitement, mais PAS `--commands-dir`,
// `--zshenv` ni `--hooks-dir` — `cmdSetup` les résout alors sous `homedir()`, c'est-à-dire le
// VRAI poste. Le run a réellement réécrit `/Users/…/.zshenv` (bloc PATH pointé vers un dossier
// temporaire, aujourd'hui disparu) avant que ce correctif n'existe. `node --test` isole
// chaque fichier dans son propre process : forcer `$HOME` ici, comme le fait `setup.test.js`,
// est le seul filet qui protège même un test qui oublierait un drapeau.
const FAKE_HOME = mkdtempSync(join(tmpdir(), 'smtk-veilleur-maj-home-'));
process.env.HOME = FAKE_HOME;

// ── LE FILET EXTÉRIEUR (`bac-a-sable.js`) — CETTE ISOLATION N'EST PAS CROIRE SUR PAROLE ──
//
// L'incident ci-dessus l'a prouvé : une isolation qui oublie UN drapeau se découvre au prix
// d'un vrai fichier réécrit sur le vrai poste. `empreinteDuHome()`/`assertHomeIntact()`
// mesurent le VRAI home (`os.userInfo().homedir()` — jamais `os.homedir()` ni
// `process.env.HOME`, que la ligne ci-dessus sandboxe déjà) avant et après CHAQUE
// `run(['setup', …])` de ce fichier. Peu importe quel drapeau un futur ajout oublierait : si
// le vrai `.zshenv`, `.zshrc` ou `.somtech/bin` bouge, le test échoue en le NOMMANT, au lieu
// de laisser l'incident se répéter en silence.

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

test('TEST DE FORME — setup.js importe client.js/identite-du-code.js depuis destDir, JAMAIS depuis payloadRoot', () => {
  // ⚠️ C'EST UN TEST DE FORME, ET LE BRIEF LE DIT EXPLICITEMENT : lire le SOURCE plutôt que
  // d'observer un comportement. Il ferme quand même le défaut réel — `reveillerVeilleur()`
  // (client.js) fait naître le veilleur depuis SON PROPRE dossier (`ICI`), donc importer la
  // copie du payload (répertoire temporaire de npx) ferait naître un veilleur voué à
  // disparaître avec ce dossier, exactement le veilleur éphémère mesuré le 2026-08-20.
  const source = readFileSync(join(HERE, '..', 'src', 'commands', 'setup.js'), 'utf8');

  assert.ok(
    source.includes("join(destDir, 'ligne-directe', 'src', 'client.js')"),
    'setup.js doit composer le chemin de client.js à partir de destDir (la copie INSTALLÉE)'
  );
  assert.ok(
    source.includes("join(destDir, 'ligne-directe', 'src', 'identite-du-code.js')"),
    'setup.js doit composer le chemin de identite-du-code.js à partir de destDir (la copie INSTALLÉE)'
  );
  // Les DEUX imports dynamiques doivent viser les variables composées ci-dessus — jamais
  // `payloadRoot`. Le mutant m5 du brief consiste précisément à substituer `destDir` par
  // `payloadRoot` dans la composition du chemin ; ce test rougirait alors sur l'assertion
  // du dessus, ET celui-ci rougirait si le chemin était recomposé en ligne, sous l'`import`,
  // directement à partir de `payloadRoot`.
  assert.match(source, /await import\(cheminClient\)/, 'setup.js doit importer client.js dynamiquement, depuis le chemin composé sur destDir');
  assert.match(source, /await import\(cheminIdentite\)/, 'setup.js doit importer identite-du-code.js dynamiquement, depuis le chemin composé sur destDir');
  assert.ok(!/cheminClient\s*=\s*join\(payloadRoot/.test(source), 'cheminClient ne doit JAMAIS être composé sur payloadRoot');
  assert.ok(!/cheminIdentite\s*=\s*join\(payloadRoot/.test(source), 'cheminIdentite ne doit JAMAIS être composé sur payloadRoot');
});

test("run setup : après installation de ligne-directe, le veilleur est vérifié — poste neuf, « aucun en cours »", async () => {
  const w = tmp('smtk-setup-veilleur-');
  const rc = join(w, 'zshrc');
  const sd = join(w, 'skills'); const wd = join(w, 'workflows'); const dd = join(w, 'somtech');
  const cd = join(w, 'commands'); const hd = join(w, 'hooks'); const ze = join(w, 'zshenv');
  const st = join(w, 'settings.json');
  writeFileSync(rc, '# rc\n');

  const avantHome = empreinteDuHome();
  const lignes = [];
  const vraiLog = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  try {
    const code = await run([
      'setup', '--source', REPO, '--rc', rc, '--skills-dir', sd, '--workflows-dir', wd,
      '--commands-dir', cd, '--hooks-dir', hd, '--zshenv', ze,
      '--dest', dd, '--settings', st, '--yes', '--no-version-hook', '--no-graphify',
      '--no-registre-hook', '--no-canvas', '--no-naissance-representant',
    ]);
    assert.equal(code, 0, 'un veilleur neuf à vérifier ne doit jamais faire échouer setup');
    const sortie = lignes.join('\n');
    assert.ok(
      sortie.includes('aucun en cours'),
      `le journal de setup doit porter la vérification du veilleur — reçu :\n${sortie}`
    );
  } finally {
    console.log = vraiLog;
    assertHomeIntact(avantHome);
  }
});

test('run setup --no-ligne-directe : AUCUNE vérification du veilleur (le module n’a pas été installé)', async () => {
  const w = tmp('smtk-setup-sans-ld-');
  const rc = join(w, 'zshrc');
  const sd = join(w, 'skills'); const wd = join(w, 'workflows'); const dd = join(w, 'somtech');
  const cd = join(w, 'commands'); const hd = join(w, 'hooks'); const ze = join(w, 'zshenv');
  const st = join(w, 'settings.json');
  writeFileSync(rc, '# rc\n');

  const avantHome = empreinteDuHome();
  const lignes = [];
  const vraiLog = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  try {
    const code = await run([
      'setup', '--source', REPO, '--rc', rc, '--skills-dir', sd, '--workflows-dir', wd,
      '--commands-dir', cd, '--hooks-dir', hd, '--zshenv', ze,
      '--dest', dd, '--settings', st, '--yes', '--no-version-hook', '--no-graphify',
      '--no-registre-hook', '--no-canvas', '--no-naissance-representant', '--no-ligne-directe',
    ]);
    assert.equal(code, 0);
    const sortie = lignes.join('\n');
    assert.ok(
      !sortie.includes('veilleur :'),
      `sans ligne-directe installée, rien ne doit parler du veilleur — reçu :\n${sortie}`
    );
  } finally {
    console.log = vraiLog;
    assertHomeIntact(avantHome);
  }
});

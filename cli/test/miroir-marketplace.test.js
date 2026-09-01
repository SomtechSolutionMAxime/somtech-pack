// miroir-marketplace.test.js — la RÉFÉRENCE de la garde de fraîcheur se rattrape-t-elle
// quand on met le poste à niveau ? (T-20260826-0069)
//
// ⚠️ TOUT SE PASSE DANS DES DOSSIERS TEMPORAIRES, ET LE VRAI ~/.claude N'EST JAMAIS TOUCHÉ.
// `cheminDuMiroir` résout depuis `$HOME` exactement comme `referenceDuPoste` ; on pose donc
// un `HOME` fabriqué pour le fichier entier (node --test donne un processus par fichier),
// comme `setup.test.js` le fait déjà pour la même raison. Un test qui oublierait d'isoler ne
// pourrait pas, malgré tout, atteindre le clone de Claude Code.
//
// ⚠️ ET AUCUN TEST N'APPELLE LE RÉSEAU : le « distant » est un dépôt git local dans un
// mkdtemp. Un contrôle qui dépendrait de GitHub serait rouge dans un avion et vert ailleurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '../src/cli.js';
import { SOUS_CHEMIN_REFERENCE } from '../src/fraicheur-gabarit.js';
import { SOUS_CHEMIN_MIROIR, cheminDuMiroir, rafraichirMiroirMarketplace } from '../src/miroir-marketplace.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

// Isolation du fichier : plus aucun défaut ne peut pointer vers le vrai répertoire personnel.
const FAUX_FOYER = tmp('miroir-home-');
process.env.HOME = FAUX_FOYER;

const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Un « distant » : un dépôt git local, avec un commit et un contenu qu'on peut faire avancer. */
function distant(w, contenu = 'v1') {
  const d = join(w, 'origine');
  mkdirSync(d, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: d });
  git(d, 'config', 'user.email', 'essai@somtech.ca');
  git(d, 'config', 'user.name', 'Essai');
  writeFileSync(join(d, 'CLAUDE.md'), `${contenu}\n`);
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'depart');
  return d;
}

/** Faire avancer le distant d'un commit — c'est la publication qu'on simule. */
function publier(d, contenu) {
  writeFileSync(join(d, 'CLAUDE.md'), `${contenu}\n`);
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', contenu);
  return git(d, 'rev-parse', 'HEAD');
}

/**
 * Un foyer fabriqué qui porte, à l'emplacement EXACT où la garde cherche sa référence, un
 * clone du distant — c'est-à-dire un miroir marketplace en retard d'un commit.
 */
function foyerAvecMiroir(w, d) {
  const foyer = join(w, 'home');
  const miroir = join(foyer, SOUS_CHEMIN_MIROIR);
  mkdirSync(dirname(miroir), { recursive: true });
  execFileSync('git', ['clone', '-q', d, miroir], { stdio: ['ignore', 'pipe', 'pipe'] });
  git(miroir, 'config', 'user.email', 'essai@somtech.ca');
  git(miroir, 'config', 'user.name', 'Essai');
  return { foyer, miroir };
}

/** Lancer un vrai `pack setup`, tout isolé, en capturant ce qu'il DIT. */
async function setupIsole(w, foyer, extra = []) {
  const lignes = [];
  const vraiLog = console.log;
  const vraiErr = console.error;
  const vraiHome = process.env.HOME;
  console.log = (...a) => lignes.push(a.join(' '));
  console.error = (...a) => lignes.push(a.join(' '));
  process.env.HOME = foyer; // `cmdSetup` et `cheminDuMiroir` résolvent tous deux depuis là
  try {
    const rc = await run([
      'setup', '--yes', '--source', REPO,
      '--dest', join(w, 'somtech'),
      '--zshenv', join(w, 'zshenv'),
      '--rc', join(w, 'zshrc'),
      '--skills-dir', join(w, 'skills'),
      '--workflows-dir', join(w, 'workflows'),
      '--commands-dir', join(w, 'commands'),
      '--settings', join(w, 'settings.json'),
      '--hooks-dir', join(w, 'hooks'),
      '--no-canvas', // 8 Mo copiés pour rien dans un contrôle qui regarde ailleurs
      ...extra,
    ]);
    return { rc, sortie: lignes.join('\n') };
  } finally {
    console.log = vraiLog;
    console.error = vraiErr;
    process.env.HOME = vraiHome;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① LE CHEMIN VISÉ EST CELUI QUE LA GARDE LIT — sinon on rafraîchit un répertoire pour rien
// ─────────────────────────────────────────────────────────────────────────────────────────

test('le clone rattrapé est bien la racine dont la garde lit « .claude/templates »', () => {
  // Si ces deux-là se déphasent, `pack setup` rattrape un répertoire pendant que la garde en
  // juge un autre : le rattrapage devient invisible et le défaut du ticket revient, muet.
  assert.equal(join(SOUS_CHEMIN_MIROIR, '.claude', 'templates'), SOUS_CHEMIN_REFERENCE);
  assert.equal(cheminDuMiroir({ foyer: '/ailleurs' }), join('/ailleurs', SOUS_CHEMIN_MIROIR));
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② LA FONCTION — les cinq états qu'un poste réel peut présenter
// ─────────────────────────────────────────────────────────────────────────────────────────

test('clone absent : on ne clone PAS, on ne refuse rien, et on le dit', () => {
  const w = tmp('miroir-absent-');
  const foyer = join(w, 'home');
  mkdirSync(foyer, { recursive: true });
  const r = rafraichirMiroirMarketplace({ foyer });
  assert.equal(r.etat, 'absent');
  assert.ok(!existsSync(cheminDuMiroir({ foyer })), 'rien n’a été créé — un clone hors registre ne serait tenu par personne');
  // Muet serait pire qu'absent : l'opérateur doit savoir que la garde n'a pas de référence.
  assert.match(r.message, /marketplace add/, 'le geste qui donne une référence est nommé');
});

test('clone en retard : la tête avance jusqu’au distant, et le rendu nomme les deux têtes', () => {
  const w = tmp('miroir-retard-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  const avant = git(miroir, 'rev-parse', 'HEAD');
  const attendu = publier(d, 'v2');
  assert.notEqual(avant, attendu, 'le distant a bien avancé — sinon ce contrôle ne mesure rien');

  const r = rafraichirMiroirMarketplace({ foyer });
  assert.equal(r.etat, 'rafraichi', r.message);
  assert.equal(git(miroir, 'rev-parse', 'HEAD'), attendu, 'la référence porte désormais ce que le distant publie');
  assert.equal(readFileSync(join(miroir, 'CLAUDE.md'), 'utf8').trim(), 'v2');
});

test('clone déjà à jour : idempotent, et il le dit plutôt que de faire semblant', () => {
  const w = tmp('miroir-ajour-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  const tete = git(miroir, 'rev-parse', 'HEAD');

  const un = rafraichirMiroirMarketplace({ foyer });
  const deux = rafraichirMiroirMarketplace({ foyer });
  assert.equal(un.etat, 'a_jour', un.message);
  assert.equal(deux.etat, 'a_jour', 'deux passages de suite ne changent rien');
  assert.equal(git(miroir, 'rev-parse', 'HEAD'), tete, 'la tête n’a pas bougé');
  assert.match(un.message, /déjà à jour/);
});

test('distant injoignable : échec BRUYANT, jamais fatal, et le clone reste intact', () => {
  const w = tmp('miroir-reseau-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  const tete = git(miroir, 'rev-parse', 'HEAD');
  rmSync(d, { recursive: true, force: true }); // le distant s'évapore — c'est « pas de réseau »

  const r = rafraichirMiroirMarketplace({ foyer });
  assert.equal(r.etat, 'echec');
  assert.equal(r.ok, false);
  assert.equal(git(miroir, 'rev-parse', 'HEAD'), tete, 'un échec ne doit rien avoir bougé');
  // ⚠️ CE QUI COMPTE ICI N'EST PAS L'ÉCHEC, C'EST QU'IL PARLE : un rattrapage muet reconduit
  // le défaut du ticket, l'opérateur croyant sa référence à niveau.
  assert.ok(r.message.includes(miroir), 'le message nomme le clone en cause');
  assert.match(r.message, /pull --ff-only/, 'le message porte le geste manuel qui répare');
});

test('clone sale : git refuse de son propre chef, rien n’est écrasé, et la dérive est comptée', () => {
  const w = tmp('miroir-sale-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  publier(d, 'v2');
  writeFileSync(join(miroir, 'CLAUDE.md'), 'travail local à ne pas perdre\n');

  const r = rafraichirMiroirMarketplace({ foyer });
  assert.equal(r.etat, 'echec', 'un fichier local qui serait écrasé doit faire refuser le rattrapage');
  assert.equal(
    readFileSync(join(miroir, 'CLAUDE.md'), 'utf8').trim(),
    'travail local à ne pas perdre',
    'le travail local a survécu — « --ff-only » ne réécrit rien',
  );
});

test('clone sur une branche sans amont : refus net, aucune perte', () => {
  const w = tmp('miroir-branche-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  git(miroir, 'checkout', '-q', '-b', 'travail-en-cours');
  const tete = git(miroir, 'rev-parse', 'HEAD');
  publier(d, 'v2');

  const r = rafraichirMiroirMarketplace({ foyer });
  assert.equal(r.etat, 'echec', 'sans amont, git ne sait pas quoi rattraper — et le dit');
  assert.equal(git(miroir, 'rev-parse', 'HEAD'), tete);
  assert.equal(git(miroir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'travail-en-cours', 'la branche de l’opérateur est intacte');
});

test('un répertoire qui n’est pas un dépôt git n’est pas touché', () => {
  const w = tmp('miroir-pasdepot-');
  const foyer = join(w, 'home');
  const miroir = join(foyer, SOUS_CHEMIN_MIROIR);
  mkdirSync(miroir, { recursive: true });
  writeFileSync(join(miroir, 'CLAUDE.md'), 'contenu\n');
  const r = rafraichirMiroirMarketplace({ foyer });
  assert.equal(r.etat, 'pas_un_depot');
  assert.equal(readFileSync(join(miroir, 'CLAUDE.md'), 'utf8').trim(), 'contenu');
});

test('dry-run : la tête ne bouge pas', () => {
  const w = tmp('miroir-dryrun-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  const tete = git(miroir, 'rev-parse', 'HEAD');
  publier(d, 'v2');
  const r = rafraichirMiroirMarketplace({ foyer, dryRun: true });
  assert.equal(r.etat, 'dry-run');
  assert.equal(git(miroir, 'rev-parse', 'HEAD'), tete, 'un aperçu ne rattrape rien');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ LE CÂBLAGE — les contrôles ci-dessus éprouvent la fonction ; ceux-ci éprouvent qu'elle
//    est APPELÉE par la commande que l'opérateur tape. Sans eux, retirer l'appel dans
//    `cmdSetup` laisserait tout le reste au vert, et la référence du poste continuerait de
//    retarder à chaque publication — le défaut exact de T-20260826-0069.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('câblage : `pack setup` rattrape la référence de la garde, sans qu’on le lui demande', async () => {
  const w = tmp('miroir-cablage-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  const attendu = publier(d, 'v2');
  assert.notEqual(git(miroir, 'rev-parse', 'HEAD'), attendu, 'le clone est bien EN RETARD au départ');

  const { rc } = await setupIsole(w, foyer);
  assert.equal(rc, 0, 'setup doit réussir');
  assert.equal(
    git(miroir, 'rev-parse', 'HEAD'),
    attendu,
    'après un `pack setup`, la référence porte ce que le distant publie — sinon la garde compare un dépôt à jour à un pack vieux',
  );
});

test('câblage : un rattrapage impossible n’échoue pas setup, mais ne se tait pas non plus', async () => {
  const w = tmp('miroir-cablage-echec-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  rmSync(d, { recursive: true, force: true });

  const { rc, sortie } = await setupIsole(w, foyer);
  assert.equal(rc, 0, 'un poste hors réseau doit pouvoir se configurer');
  assert.ok(sortie.includes(miroir), `le rendu doit nommer le clone en cause. Rendu :\n${sortie}`);
  assert.match(sortie, /⚠️/, 'un rattrapage qui échoue en silence reconduit le défaut qu’on ferme');
});

test('câblage : sur un poste neuf sans marketplace, setup réussit et ne fabrique aucun clone', async () => {
  const w = tmp('miroir-cablage-neuf-');
  const foyer = join(w, 'home');
  mkdirSync(foyer, { recursive: true });

  const { rc, sortie } = await setupIsole(w, foyer);
  assert.equal(rc, 0, 'un poste neuf ne doit pas devenir un poste bloqué');
  assert.ok(
    !existsSync(join(foyer, SOUS_CHEMIN_MIROIR)),
    'setup ne doit PAS cloner : un clone hors du registre de Claude Code ne serait jamais mis à jour',
  );
  assert.ok(sortie.includes('marketplace'), `le rendu doit dire qu’il n’y a pas de référence. Rendu :\n${sortie}`);
});

test('câblage : `--dry-run` ne rattrape rien', async () => {
  const w = tmp('miroir-cablage-dryrun-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  const tete = git(miroir, 'rev-parse', 'HEAD');
  publier(d, 'v2');

  const { rc } = await setupIsole(w, foyer, ['--dry-run']);
  assert.equal(rc, 0);
  assert.equal(git(miroir, 'rev-parse', 'HEAD'), tete, 'un aperçu n’écrit pas');
});

// ⚠️ ET QUI GARDE LE GARDIEN ? Depuis ce lot, un `pack setup` lancé sans `HOME` fabriqué
// ferait un `git pull` DANS LE VRAI CLONE de Claude Code — celui dont 24 chantiers dépendent
// sur ce poste. Les trois fichiers qui lancent `setup` posent aujourd'hui leur foyer en tête
// de fichier ; le quatrième, écrit dans six mois, n'y pensera pas.
//
// ⚠️ CETTE GARDE EST TEXTUELLE, ET IL FAUT LE SAVOIR AVANT DE S'Y FIER : elle prouve qu'une
// ligne existe, jamais qu'elle vise un répertoire jetable. Un fichier qui écrirait
// `process.env.HOME = homedir()` la passerait. Ce qu'elle ferme est l'OUBLI, qui est le mode
// de panne réel — pas la ruse.
test('aucun fichier ne lance `setup` sans avoir d’abord fabriqué son HOME', () => {
  const suspects = readdirSync(HERE)
    .filter((f) => f.endsWith('.test.js'))
    .filter((f) => /run\(\s*\[\s*'setup'/.test(readFileSync(join(HERE, f), 'utf8')));
  assert.ok(suspects.length >= 3, `mesuré 3 fichiers au 2026-08-26 ; trouvé ${suspects.length} — la sonde ne voit plus ce qu’elle croit voir`);
  for (const f of suspects) {
    const src = readFileSync(join(HERE, f), 'utf8');
    assert.match(
      src,
      /^process\.env\.HOME\s*=/m,
      `${f} lance « setup » sans poser HOME en tête de fichier : il rattraperait le VRAI clone marketplace du poste`,
    );
  }
});

test('câblage : `--no-miroir` désarme le rattrapage — et c’est le seul moyen de le désarmer', async () => {
  const w = tmp('miroir-cablage-non-');
  const d = distant(w);
  const { foyer, miroir } = foyerAvecMiroir(w, d);
  const tete = git(miroir, 'rev-parse', 'HEAD');
  publier(d, 'v2');

  const { rc } = await setupIsole(w, foyer, ['--no-miroir']);
  assert.equal(rc, 0);
  assert.equal(git(miroir, 'rev-parse', 'HEAD'), tete, 'l’option refuse explicitement le geste');
});

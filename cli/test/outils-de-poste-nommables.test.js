// UN OUTIL DE POSTE S'APPELLE PAR SON NOM, MÊME QUAND PERSONNE NE REGARDE (T-20260819-0013)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER ATTRAPE
//
// `ligne-directe relever` rendait « command not found ». Il fallait connaître
// `~/.somtech/ligne-directe/bin/ligne-directe.js` — un détail interne — pour passer. Le
// mode de panne n'est pas l'erreur : c'est qu'une consigne JUSTE, suivie à la lettre,
// échoue. Un agent scrupuleux le signale ; un autre saute le geste, et personne ne le sait.
//
// ⚠️ LE PIÈGE QUE CE FICHIER EXISTE POUR VOIR
//
// Le pack posait déjà des commandes — `claude-swt`, `pack-poste` — mais comme FONCTIONS
// dans `~/.zshrc`. Or `~/.zshrc` n'est lu que par un shell INTERACTIF, et une fonction ne
// survit pas à un `zsh -c`. Mesuré : `zsh -c 'command -v claude-swt'` ne trouve rien.
//
// Ça n'a rien d'anecdotique — l'usage qui a produit ce ticket est EXACTEMENT celui-là :
// un agent qui exécute une commande depuis son outil, pas un humain qui tape dans un
// terminal. Reproduire cette forme aurait fermé le ticket sans rien régler.
//
// D'où le contrôle central ici : **on éprouve depuis un shell non interactif**, avec un
// faux `HOME`/`ZDOTDIR`, et pas en relisant le fichier écrit. Et un second contrôle
// prouve que le premier VOIT le lieu : le même bloc posé dans `.zshrc` au lieu de
// `.zshenv` doit laisser la commande introuvable. Sans lui, un correctif qui reprend le
// mauvais lieu passerait au vert sans que rien ne bouge.
//
// CE QU'IL NE COUVRE PAS, ET IL FAUT LE DIRE
//
// - `bash`/`sh` : le mécanisme repose sur `~/.zshenv`, propre à zsh. Un poste dont le
//   shell d'agent serait bash n'est pas couvert — ni par le code, ni par ce fichier.
// - Le PATH d'un poste NEUF : on éprouve celui de la machine qui exécute la suite.
//
// Traçabilité : T-20260819-0013 (livraison J-20260814-0002).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { installPosteBin, outilsDePoste, MARKER_BEGIN, MARKER_END, buildPathBlock, buildShim } from '../src/postebin.js';
import { installPosteModules } from '../src/posteonly.js';
import { run } from '../src/cli.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

// Même isolation que setup.test.js : aucun test de ce fichier ne doit pouvoir toucher le
// vrai `~/.zshenv` ni le vrai `~/.somtech`.
const FAKE_HOME = mkdtempSync(join(tmpdir(), 'smtk-home-'));
process.env.HOME = FAKE_HOME;

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

/** True si `zsh` est disponible — sinon les contrôles de bout en bout ne prouvent rien. */
function zshDisponible() {
  try {
    execFileSync('/usr/bin/env', ['zsh', '-c', 'exit 0'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pose les outils de poste dans un faux poste : `<w>/somtech` pour les modules (copiés
 * depuis le dépôt) et `<w>/home` comme HOME/ZDOTDIR.
 */
function fauxPoste({ zshenvNom = '.zshenv' } = {}) {
  const w = tmp('smtk-postebin-');
  const toolsDir = join(w, 'somtech');
  const home = join(w, 'home');
  mkdirSync(home, { recursive: true });
  // Le poste est monté par la MÊME chaîne que le vrai : les modules d'abord, l'exposition
  // ensuite. Sans les modules, un exécutable posé « trouverait » son nom et échouerait à
  // l'exécution — et le contrôle de bout en bout ne verrait que la moitié du chemin.
  // Le canvas est écarté : 8 Mo copiés à chaque test pour un module qui n'expose rien.
  installPosteModules({ payloadRoot: REPO, toolsDir, exclure: ['canvas'] });
  const res = installPosteBin({
    payloadRoot: REPO,
    toolsDir,
    zshenvFile: join(home, zshenvNom),
  });
  return { w, toolsDir, home, res };
}

/** Exécute `cmd` dans un zsh NON interactif dont le HOME/ZDOTDIR est le faux poste. */
function zshNonInteractif(home, cmd) {
  try {
    const out = execFileSync('/usr/bin/env', ['zsh', '-c', cmd], {
      env: { ...process.env, HOME: home, ZDOTDIR: home },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { rc: 0, out };
  } catch (e) {
    return { rc: e.status ?? 1, out: e.stdout ?? '' };
  }
}

// ── L'INVENTAIRE VIENT DU MANIFESTE, JAMAIS D'UNE LISTE ÉCRITE ICI ──────────────────────

test('inventaire : les outils viennent des modules de portée poste, pas d’une liste en dur', () => {
  const outils = outilsDePoste(REPO);
  const noms = outils.map((o) => o.nom).sort();

  // Ce que le dépôt déclare AUJOURD'HUI. Si un module de poste gagne un exécutable demain,
  // il entre dans l'exposition tout seul — et cette assertion le rappellera à qui l'oublie.
  assert.ok(noms.includes('ligne-directe'), 'ligne-directe — le cas mesuré du ticket');
  assert.ok(noms.includes('gestionnaire-livrer'), 'livrer.js — appelé par son chemin dans tout le métier de l’orchestrateur');
  assert.ok(noms.includes('gestionnaire-naitre'), 'naitre.js');
  assert.ok(
    noms.includes('orchestrateur-rendez-vous'),
    'rendez-vous.js — l’oublier serait « une porte sur deux », ce que le ticket interdit explicitement'
  );

  // Chaque outil pointe sur un fichier qui existe vraiment dans le dépôt.
  for (const o of outils) {
    assert.ok(existsSync(join(REPO, o.relatif)), `${o.nom} → ${o.relatif} doit exister`);
  }
});

// ── LES EXÉCUTABLES ─────────────────────────────────────────────────────────────────────

test('pose : un exécutable par outil dans <poste>/bin, qui pointe sur le module installé', () => {
  const { toolsDir, res } = fauxPoste();
  assert.ok(res.outils.length >= 4, 'au moins les quatre outils connus');

  for (const o of res.outils) {
    const shim = join(toolsDir, 'bin', o.nom);
    assert.ok(existsSync(shim), `${o.nom} posé`);
    assert.ok(statSync(shim).mode & 0o111, `${o.nom} exécutable`);
    const texte = readFileSync(shim, 'utf8');
    // Le shim doit viser le module INSTALLÉ sur le poste, jamais le dépôt d'où vient le
    // pack : un poste client n'a pas de copie de somtech-pack.
    assert.ok(
      texte.includes(join(toolsDir, o.relatif)),
      `${o.nom} vise ${join(toolsDir, o.relatif)} — pas un chemin de dépôt`
    );
  }
});

test('pose : rejouer ne duplique rien et ne réécrit pas ce qui n’a pas changé', () => {
  const { toolsDir, home } = fauxPoste();
  const r2 = installPosteBin({ payloadRoot: REPO, toolsDir, zshenvFile: join(home, '.zshenv') });
  assert.equal(r2.created.length, 0, 'rien de neuf au second passage');
  assert.equal(r2.updated.length, 0, 'rien de réécrit au second passage');
  assert.ok(r2.unchanged.length >= 4, 'tout est déjà en place');
  const zshenv = readFileSync(join(home, '.zshenv'), 'utf8');
  assert.equal(zshenv.split(MARKER_BEGIN).length - 1, 1, 'un seul bloc PATH après deux passages');
});

test('pose : dry-run n’écrit ni exécutable ni bloc', () => {
  const w = tmp('smtk-postebin-dry-');
  const toolsDir = join(w, 'somtech');
  const zshenvFile = join(w, '.zshenv');
  installPosteBin({ payloadRoot: REPO, toolsDir, zshenvFile, dryRun: true });
  assert.ok(!existsSync(join(toolsDir, 'bin')), 'aucun exécutable posé');
  assert.ok(!existsSync(zshenvFile), 'aucun bloc écrit');
});

test('pose : un fichier étranger dans <poste>/bin n’est jamais touché', () => {
  const w = tmp('smtk-postebin-etranger-');
  const toolsDir = join(w, 'somtech');
  mkdirSync(join(toolsDir, 'bin'), { recursive: true });
  const perso = join(toolsDir, 'bin', 'mon-outil-a-moi');
  writeFileSync(perso, '#!/bin/sh\necho perso\n');
  installPosteBin({ payloadRoot: REPO, toolsDir, zshenvFile: join(w, '.zshenv') });
  assert.equal(readFileSync(perso, 'utf8'), '#!/bin/sh\necho perso\n', 'fichier hors-pack intact');
});

// ── LE LIEU DU PATH ─────────────────────────────────────────────────────────────────────

test('PATH : le bloc est posé dans .zshenv, et le .zshrc reste vierge de PATH', () => {
  const { home, res } = fauxPoste();
  const zshenv = readFileSync(join(home, '.zshenv'), 'utf8');
  assert.ok(zshenv.includes(MARKER_BEGIN) && zshenv.includes(MARKER_END), 'bloc gardé dans .zshenv');
  assert.ok(zshenv.includes(res.binDir), `le dossier des outils (${res.binDir}) est ajouté au PATH`);
  assert.ok(!existsSync(join(home, '.zshrc')), '.zshrc n’est pas le lieu de ce bloc');
});

test('PATH : le bloc n’ajoute pas deux fois le même dossier', () => {
  const bloc = buildPathBlock('/tmp/faux/bin');
  const home = join(tmp('smtk-path-'), 'home');
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, '.zshenv'), `${bloc}\n`);
  if (!zshDisponible()) assert.fail('zsh absent : ce contrôle ne peut pas prouver ce qu’il annonce (installe zsh)');
  const { out } = zshNonInteractif(home, 'zsh -c \'echo "$PATH"\' | tr ":" "\\n" | grep -c "^/tmp/faux/bin$"');
  assert.equal(out.trim(), '1', 'un zsh imbriqué ne redouble pas l’entrée');
});

// ── LE CONTRÔLE QUI TRANCHE : UN SHELL NON INTERACTIF ───────────────────────────────────

test('bout en bout : `zsh -c "command -v ligne-directe"` TROUVE', () => {
  if (!zshDisponible()) assert.fail('zsh absent : ce contrôle ne peut pas prouver ce qu’il annonce (installe zsh)');
  const { home, toolsDir } = fauxPoste();
  const { rc, out } = zshNonInteractif(home, 'command -v ligne-directe');
  assert.equal(rc, 0, 'la commande doit être trouvée depuis un shell NON interactif');
  assert.ok(out.includes(join(toolsDir, 'bin', 'ligne-directe')), `résolue sur le poste, pas ailleurs : ${out}`);
});

test('bout en bout : la commande s’EXÉCUTE, sans `node` et sans chemin', () => {
  if (!zshDisponible()) assert.fail('zsh absent : ce contrôle ne peut pas prouver ce qu’il annonce (installe zsh)');
  const { home } = fauxPoste();
  const { rc, out } = zshNonInteractif(home, 'ligne-directe');
  assert.equal(rc, 0, 'l’outil répond');
  assert.ok(/ouvrir une ligne de discussion/.test(out), `c’est bien lui qui a répondu : ${out.slice(0, 200)}`);
});

test('bout en bout : chaque outil déclaré est appelable, pas seulement celui du ticket', () => {
  if (!zshDisponible()) assert.fail('zsh absent : ce contrôle ne peut pas prouver ce qu’il annonce (installe zsh)');
  const { home, res } = fauxPoste();
  for (const o of res.outils) {
    const { rc } = zshNonInteractif(home, `command -v ${o.nom}`);
    assert.equal(rc, 0, `${o.nom} doit être appelable par son nom`);
  }
});

// ⚠️ LE CONTRÔLE DE CONTRÔLE : celui-ci prouve que les trois précédents VOIENT le lieu.
// Le même bloc, posé dans `.zshrc`, ne doit RIEN donner à un shell non interactif — c'est
// le mode de panne exact que ce lot devait éviter. S'il passait au vert, les contrôles de
// bout en bout ne mesureraient pas ce qu'ils prétendent.
test('bout en bout : le même bloc dans .zshrc laisse la commande INTROUVABLE', () => {
  if (!zshDisponible()) assert.fail('zsh absent : ce contrôle ne peut pas prouver ce qu’il annonce (installe zsh)');
  const { home } = fauxPoste({ zshenvNom: '.zshrc' });
  assert.ok(existsSync(join(home, '.zshrc')), 'le bloc a bien été posé — au mauvais endroit, exprès');
  const { rc } = zshNonInteractif(home, 'command -v ligne-directe');
  assert.notEqual(rc, 0, '.zshrc n’est pas lu par un shell non interactif — si ce test passe au vert, les autres ne prouvent rien');
});

// ── LE CÂBLAGE ──────────────────────────────────────────────────────────────────────────
// Les contrôles ci-dessus éprouvent la fonction. Celui-ci éprouve qu'elle est APPELÉE :
// sans lui, retirer l'appel dans `cmdSetup` laisserait tout le reste au vert, et le poste
// d'un nouveau venu n'aurait rien.
test('câblage : `pack setup` expose les outils, sans qu’on ait à le lui demander', async () => {
  const w = tmp('smtk-setup-bin-');
  const home = join(w, 'home');
  mkdirSync(home, { recursive: true });
  const rc = await run([
    'setup', '--yes', '--source', REPO,
    '--dest', join(w, 'somtech'),
    '--zshenv', join(home, '.zshenv'),
    '--rc', join(home, '.zshrc'),
    '--skills-dir', join(w, 'skills'),
    '--workflows-dir', join(w, 'workflows'),
    '--commands-dir', join(w, 'commands'),
    '--settings', join(w, 'settings.json'),
    '--hooks-dir', join(w, 'hooks'),
    '--no-canvas', // 8 Mo copiés pour un module qui n'expose aucune commande
  ]);
  assert.equal(rc, 0, 'setup doit réussir');
  assert.ok(existsSync(join(w, 'somtech', 'bin', 'ligne-directe')), 'l’outil du ticket est posé par setup lui-même');

  if (!zshDisponible()) assert.fail('zsh absent : ce contrôle ne peut pas prouver ce qu’il annonce (installe zsh)');
  const { rc: rcZsh } = zshNonInteractif(home, 'command -v ligne-directe');
  assert.equal(rcZsh, 0, 'après un `pack setup`, un shell NON interactif trouve la commande');

  // Et le rc, lui, ne doit PAS porter ce PATH : c'est ce mélange qui a fait croire que le
  // pack exposait ses commandes alors qu'il ne les exposait qu'aux humains.
  const rcTexte = existsSync(join(home, '.zshrc')) ? readFileSync(join(home, '.zshrc'), 'utf8') : '';
  assert.ok(!rcTexte.includes(MARKER_BEGIN), 'le PATH des outils n’est pas dans le rc');
});

// ⚠️ ET LE LIEU PAR DÉFAUT, celui que personne ne passe en option : c'est LUI qui vaut sur
// un poste réel. Le contrôle ci-dessus passe `--zshenv` et ne verrait donc rien si le
// défaut basculait vers le rc — exactement la dérive que ce lot devait empêcher.
test('câblage : sans option, le PATH va dans <HOME>/.zshenv — pas dans <HOME>/.zshrc', async () => {
  const w = tmp('smtk-setup-defaut-');
  const home = join(w, 'home');
  mkdirSync(home, { recursive: true });
  const vrai = process.env.HOME;
  process.env.HOME = home; // `cmdSetup` résout ses défauts depuis homedir(), qui suit $HOME
  try {
    const rc = await run([
      'setup', '--yes', '--source', REPO,
      '--dest', join(w, 'somtech'),
      '--rc', join(home, '.zshrc'),
      '--skills-dir', join(w, 'skills'),
      '--workflows-dir', join(w, 'workflows'),
      '--commands-dir', join(w, 'commands'),
      '--settings', join(w, 'settings.json'),
      '--hooks-dir', join(w, 'hooks'),
      '--no-canvas',
    ]);
    assert.equal(rc, 0, 'setup doit réussir');
  } finally {
    process.env.HOME = vrai;
  }
  const zshenv = existsSync(join(home, '.zshenv')) ? readFileSync(join(home, '.zshenv'), 'utf8') : '';
  const zshrc = existsSync(join(home, '.zshrc')) ? readFileSync(join(home, '.zshrc'), 'utf8') : '';
  assert.ok(zshenv.includes(MARKER_BEGIN), 'le lieu par défaut est .zshenv, lu par TOUT zsh');
  assert.ok(!zshrc.includes(MARKER_BEGIN), 'le rc ne porte pas ce PATH — un agent ne le lit jamais');
});

// ⚠️ ET SI LE SHELL DE L'AGENT N'A PAS `node` ? Sur un poste où nvm pose la version de Node
// depuis `~/.zshrc`, un shell non interactif n'en a aucune. Un relais qui ferait `exec node`
// sec serait trouvé par son nom et échouerait sur « node: command not found » — la panne du
// ticket, déplacée d'un cran, et tout aussi silencieuse pour qui suit la consigne.
test('bout en bout : la commande marche même quand `node` n’est pas sur le PATH', () => {
  if (!zshDisponible()) assert.fail('zsh absent : ce contrôle ne peut pas prouver ce qu’il annonce (installe zsh)');
  const { home } = fauxPoste();
  // ⚠️ Un PATH « pauvre » choisi à la main dépend de la machine : sur le runner CI, `node`
  // vit dans /usr/bin, et le contrôle se refusait à conclure. Le seul PATH dont on sait
  // qu'il ne porte pas node est un dossier VIDE — et zsh est alors invoqué par son chemin
  // absolu, puisque plus rien ne le résout.
  const vide = tmp('smtk-path-vide-');
  const zsh = execFileSync('/usr/bin/env', ['sh', '-c', 'command -v zsh'], { encoding: 'utf8' }).trim();
  // Le code exact d'un « introuvable » dépend du shell — `dash` (le /bin/sh d'Ubuntu) rend
  // 127 là où zsh rend 1. On mesure donc l'absence, pas un chiffre : un contrôle dont le
  // verdict change avec la machine ne garde rien.
  assert.notEqual(
    execFileSync('/bin/sh', ['-c', `PATH=${vide} command -v node >/dev/null 2>&1; echo $?`], { encoding: 'utf8' }).trim(),
    '0',
    'préalable : ce PATH ne doit VRAIMENT pas porter node, sinon ce contrôle ne prouve rien'
  );
  let out = '';
  let rc = 0;
  try {
    out = execFileSync(zsh, ['-c', 'ligne-directe'], {
      env: { HOME: home, ZDOTDIR: home, PATH: vide },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    rc = e.status ?? 1;
    out = e.stdout ?? '';
  }
  assert.equal(rc, 0, `l’outil doit répondre sans node sur le PATH — sortie : ${out.slice(0, 200)}`);
  assert.ok(/ouvrir une ligne de discussion/.test(out), 'c’est bien lui qui a répondu');
});

// ── LES TROIS GARDES QUE LA REVUE DE FOND A TROUVÉES SANS PREUVE ────────────────────────
// Elles existaient dans le code et se lisaient bien. Aucune ne rougissait quand on la
// retirait : « un test qui n'a jamais été rouge n'a jamais rien testé ».

test('garde : un nom déjà pris par un outil hors-pack n’est PAS écrasé, et c’est dit', () => {
  const w = tmp('smtk-postebin-pris-');
  const toolsDir = join(w, 'somtech');
  mkdirSync(join(toolsDir, 'bin'), { recursive: true });
  // Le nom d'un VRAI outil du pack, occupé par le fichier de quelqu'un d'autre — le seul
  // cas qui exerce la boucle de pose (le contrôle « fichier étranger » plus haut, lui,
  // n'exerce que le nettoyage, puisqu'il choisit un nom inconnu du manifeste).
  const pris = join(toolsDir, 'bin', 'ligne-directe');
  writeFileSync(pris, '#!/bin/sh\necho "le mien, pas celui du pack"\n');

  const r = installPosteBin({ payloadRoot: REPO, toolsDir, zshenvFile: join(w, '.zshenv') });

  assert.equal(readFileSync(pris, 'utf8'), '#!/bin/sh\necho "le mien, pas celui du pack"\n', 'contenu intact');
  assert.ok(r.conflicts.includes('ligne-directe'), 'le conflit est RAPPORTÉ — sinon la commande part ailleurs sans que personne le sache');
  assert.ok(!r.updated.includes('ligne-directe'), 'et surtout : pas compté comme convergé');
});

test('garde : un exécutable du pack devenu orphelin est réellement RETIRÉ', () => {
  const w = tmp('smtk-postebin-orphelin-');
  const toolsDir = join(w, 'somtech');
  installPosteBin({ payloadRoot: REPO, toolsDir, zshenvFile: join(w, '.zshenv') });

  // Un outil que le pack a posé hier et que le manifeste ne déclare plus : il pointerait
  // sur un fichier absent, ce qui répond « oui » à `command -v` et échoue à l'exécution —
  // pire que « command not found », qui au moins ne ment pas.
  const orphelin = join(toolsDir, 'bin', 'outil-d-hier');
  writeFileSync(orphelin, buildShim(join(toolsDir, 'plus-la', 'bin', 'x.js')));

  const r = installPosteBin({ payloadRoot: REPO, toolsDir, zshenvFile: join(w, '.zshenv') });
  assert.ok(r.removed.includes('outil-d-hier'), 'annoncé comme retiré');
  assert.ok(!existsSync(orphelin), 'et réellement disparu du disque — pas seulement du rapport');
});

test('garde : un chemin biscornu ne casse ni n’EXÉCUTE rien — mesuré sur l’effet', () => {
  if (!zshDisponible()) assert.fail('zsh absent : ce contrôle ne peut pas prouver ce qu’il annonce (installe zsh)');
  // ⚠️ Une version antérieure de ce contrôle passait le texte à `zsh -n` (analyse sans
  // exécution). Il restait VERT quand on retirait l'échappement : `-n` n'exécute rien, il
  // ne pouvait donc pas voir une substitution partir. On mesure ici ce qui se PASSE.
  const base = tmp('smtk-piege-');
  const temoin = join(base, 'TEMOIN-EXECUTE');
  // Un chemin qui porte un guillemet ET une substitution : si l'un des deux passe, la
  // ligne posée dans le `.zshenv` du poste ferait autre chose que nommer un dossier.
  const dossier = join(base, `faux "poste" $(touch ${temoin})`);
  mkdirSync(join(dossier, 'bin'), { recursive: true });
  writeFileSync(join(dossier, 'cible.js'), 'console.log("OK-CIBLE");\n');

  // 1. Le relais : il doit atteindre sa cible, et rien d'autre.
  const relais = join(dossier, 'bin', 'outil-piege');
  writeFileSync(relais, buildShim(join(dossier, 'cible.js')), { mode: 0o755 });
  const sortie = execFileSync(relais, [], { encoding: 'utf8' });
  assert.match(sortie, /OK-CIBLE/, 'le relais atteint sa cible malgré le chemin');
  assert.ok(!existsSync(temoin), 'AUCUNE substitution ne s’est exécutée depuis le relais');

  // 2. Le bloc PATH : le shell doit démarrer proprement et porter le dossier LITTÉRAL.
  const home = join(base, 'home');
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, '.zshenv'), buildPathBlock(join(dossier, 'bin')));
  const { rc, out } = zshNonInteractif(home, 'printf %s "$PATH"');
  assert.equal(rc, 0, `le shell du poste démarre sans erreur d’analyse : ${out}`);
  assert.ok(out.includes(join(dossier, 'bin')), 'le dossier entre dans le PATH tel quel');
  assert.ok(!existsSync(temoin), 'AUCUNE substitution ne s’est exécutée à l’ouverture du shell');
});

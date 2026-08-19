// postebin.js — les outils de poste du pack s'appellent par leur NOM.
//
// LE DÉFAUT QUE CE FICHIER FERME (T-20260819-0013)
//
// `ligne-directe relever` rendait « command not found ». Passer exigeait de connaître
// `~/.somtech/ligne-directe/bin/ligne-directe.js` — un détail interne. Ce n'est pas
// l'erreur qui coûte, c'est le mode de panne : une consigne JUSTE, suivie à la lettre,
// échoue. Celui qui connaît le chemin passe ; celui qui ne le connaît pas s'arrête, ou
// pire, saute le geste en silence.
//
// POURQUOI PAS UNE FONCTION DE SHELL, COMME `claude-swt`
//
// Le pack savait déjà poser des commandes — mais comme fonctions dans `~/.zshrc`. Mesuré :
//
//     zsh -c 'command -v claude-swt'   →   introuvable
//
// Une fonction ne survit pas à un shell non interactif, et c'est EXACTEMENT le shell qui a
// produit ce ticket : celui d'un agent qui exécute une commande, pas celui d'un humain qui
// tape dans un terminal. Reprendre cette forme aurait fermé le ticket sans rien régler.
//
// ⚠️ D'OÙ LE SEUL POINT QUI COMPTE ICI : LE LIEU DU `PATH`
//
// Le dossier des outils est ajouté au `PATH` depuis **`~/.zshenv`**, que TOUT zsh lit —
// interactif ou non. Le mettre dans `~/.zshrc` donnerait un correctif qui marche pour
// l'humain et pas pour l'agent : le défaut d'origine, avec l'air d'être réglé. C'est ce
// que garde `cli/test/outils-de-poste-nommables.test.js`, en éprouvant depuis un
// `zsh -c` plutôt qu'en relisant le fichier écrit.
//
// CE QUI EST EXPOSÉ, ET QUI LE DÉCIDE
//
// Rien n'est écrit en dur ici. Un module de portée `poste` (pack.json) qui veut offrir une
// commande la déclare dans le champ `bin` du `package.json` à la racine de son chemin —
// la convention npm, déjà respectée par `ligne-directe` et `naissance-representant`. Un
// module sans `bin` (le canvas, dont la commande `/canvas` lance son serveur elle-même)
// n'expose rien, et c'est un fait mesuré, pas un oubli. Le prochain outil entrera dans
// l'exposition sans qu'on touche à ce fichier.
import { readFileSync, existsSync, writeFileSync, mkdirSync, chmodSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readManifest } from './modules.js';
import { upsertGuardedBlock } from './shellrc.js';

export const MARKER_BEGIN = '# >>> somtech outils de poste >>>';
export const MARKER_END = '# <<< somtech outils de poste <<<';

/** Signature portée par chaque exécutable engendré — ce qui autorise à le remplacer ou à le retirer. */
const SIGNATURE = '# somtech-pack · outil de poste — engendré par `pack setup`, ne pas éditer.';

/**
 * Les outils qu'un poste doit pouvoir appeler par leur nom.
 *
 * Renvoie [{ nom, module, relatif }] où `relatif` est le chemin de l'exécutable depuis la
 * racine — la même depuis le dépôt et depuis le poste, puisqu'un module de poste est
 * installé sous son propre nom de dossier dans `~/.somtech`.
 */
export function outilsDePoste(payloadRoot, modules) {
  let manifeste;
  try {
    manifeste = readManifest(payloadRoot);
  } catch {
    // Un manifeste illisible ne doit pas interrompre la configuration du poste en plein
    // milieu — même posture que `installPosteModules`.
    return [];
  }
  const retenus = modules ? new Set(modules) : null;
  const outils = [];
  const vus = new Set();

  for (const [nomModule, m] of Object.entries(manifeste.modules || {})) {
    if (!m || m.scope !== 'poste') continue;
    if (retenus && !retenus.has(nomModule)) continue;

    for (const chemin of m.paths || []) {
      const dossier = chemin.replace(/\/+$/, '');
      const pkg = join(payloadRoot, dossier, 'package.json');
      if (!existsSync(pkg)) continue;

      let bin;
      try {
        bin = JSON.parse(readFileSync(pkg, 'utf8')).bin;
      } catch {
        continue; // un package.json cassé n'est pas une raison de ne rien installer du tout
      }
      if (!bin) continue;
      // npm accepte `"bin": "chemin"` (le nom vaut celui du paquet) autant que l'objet.
      const entrees = typeof bin === 'string' ? { [dossier.split('/').pop()]: bin } : bin;

      for (const [nom, cible] of Object.entries(entrees)) {
        if (typeof cible !== 'string' || vus.has(nom)) continue;
        vus.add(nom);
        outils.push({ nom, module: nomModule, relatif: join(dossier, cible) });
      }
    }
  }
  return outils.sort((a, b) => a.nom.localeCompare(b.nom));
}

/**
 * L'exécutable posé pour un outil : un relais minimal vers le fichier installé.
 *
 * Un relais plutôt qu'un lien symbolique parce qu'il ne dépend ni du bit exécutable
 * survivant à la copie, ni du `#!` du fichier visé — deux choses qu'on ne veut pas avoir
 * à vérifier sur chaque poste.
 */
export function buildShim(cibleAbsolue) {
  return ['#!/bin/sh', SIGNATURE, `exec node "${cibleAbsolue}" "$@"`, ''].join('\n');
}

/**
 * Le bloc qui met `binDir` sur le `PATH`, à poser dans `~/.zshenv`.
 *
 * Le garde `case` compte : `.zshenv` est relu par CHAQUE zsh, y compris les imbriqués.
 * Sans lui, le `PATH` gagnerait une copie du dossier à chaque niveau.
 */
export function buildPathBlock(binDir) {
  return [
    MARKER_BEGIN,
    '# Les outils de poste du pack (ligne-directe, …) appelables par leur nom.',
    '# Ce bloc vit ici — et pas dans .zshrc — parce qu’un shell NON interactif, celui d’un',
    '# agent, ne lit que .zshenv. Le déplacer remettrait « command not found » en place.',
    '# Ne pas éditer à la main : `pack setup` le réécrit.',
    'case ":$PATH:" in',
    `  *":${binDir}:"*) ;;`,
    `  *) PATH="${binDir}:$PATH" ;;`,
    'esac',
    'export PATH',
    MARKER_END,
    '',
  ].join('\n');
}

/**
 * Pose un exécutable par outil de poste dans `<toolsDir>/bin`, et met ce dossier sur le
 * `PATH` depuis `zshenvFile`.
 *
 * - `modules` : les modules de poste réellement installés (un drapeau a pu en écarter).
 *   Omis → tous ceux du manifeste.
 * - Ne touche QUE ce qu'il a engendré : un fichier sans la signature du pack posé dans
 *   `<toolsDir>/bin` n'est ni réécrit ni supprimé.
 * - Un outil qui disparaît du manifeste voit son exécutable retiré — sans quoi il
 *   resterait un nom qui répond en pointant sur un fichier absent, ce qui est pire que
 *   « command not found ».
 *
 * Renvoie { outils, created, updated, unchanged, conflicts, removed, binDir, pathFile, pathAction, backup }.
 */
export function installPosteBin({ payloadRoot, toolsDir, zshenvFile, modules, dryRun = false }) {
  const outils = outilsDePoste(payloadRoot, modules);
  const binDir = join(toolsDir, 'bin');
  const rapport = {
    outils,
    created: [],
    updated: [],
    unchanged: [],
    conflicts: [],
    removed: [],
    binDir,
    pathFile: zshenvFile,
    pathAction: null,
  };
  if (!outils.length) return rapport;
  if (dryRun) return { ...rapport, pathAction: 'dry-run' };

  mkdirSync(binDir, { recursive: true });

  for (const o of outils) {
    const shim = join(binDir, o.nom);
    const contenu = buildShim(join(toolsDir, o.relatif));
    const avant = existsSync(shim) ? readFileSync(shim, 'utf8') : null;

    if (avant === null) {
      writeFileSync(shim, contenu);
      chmodSync(shim, 0o755);
      rapport.created.push(o.nom);
    } else if (!avant.includes(SIGNATURE)) {
      // Quelqu'un a mis SON outil sous ce nom. On ne l'écrase pas — et on ne le compte pas
      // parmi les « déjà en place » : le nom appartient à l'autre, donc la commande
      // n'ira pas où le pack le croit. Ça se DIT, sinon ça se découvre à l'usage.
      rapport.conflicts.push(o.nom);
    } else if (avant === contenu) {
      // Le mode aussi doit tenir : un fichier au bon contenu mais non exécutable rendrait
      // « permission denied », qui ressemble à tout sauf à la cause.
      if (!(statSync(shim).mode & 0o111)) chmodSync(shim, 0o755);
      rapport.unchanged.push(o.nom);
    } else {
      writeFileSync(shim, contenu);
      chmodSync(shim, 0o755);
      rapport.updated.push(o.nom);
    }
  }

  // Ce que le pack a posé hier et qui n'a plus de raison d'être.
  const attendus = new Set(outils.map((o) => o.nom));
  for (const nom of readdirSync(binDir)) {
    if (attendus.has(nom)) continue;
    const f = join(binDir, nom);
    let texte;
    try {
      texte = readFileSync(f, 'utf8');
    } catch {
      continue; // dossier, binaire illisible : pas à nous
    }
    if (!texte.includes(SIGNATURE)) continue;
    rmSync(f);
    rapport.removed.push(nom);
  }

  const { action, backup } = upsertGuardedBlock({
    file: zshenvFile,
    begin: MARKER_BEGIN,
    end: MARKER_END,
    block: buildPathBlock(binDir),
  });
  rapport.pathAction = action;
  rapport.backup = backup;
  return rapport;
}

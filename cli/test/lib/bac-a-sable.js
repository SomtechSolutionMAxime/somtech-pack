// bac-a-sable.js — un test qui écrit hors de son bac à sable doit ROUGIR (incident
// .zshenv, T-20260818-0035).
//
// ─────────────────────────────────────────────────────────────────────────────────────
// L'INCIDENT
//
// Une première version d'un test de `cmdSetup` sandboxait `--dest`, `--rc`, `--skills-dir`,
// `--workflows-dir`, `--settings` — mais oubliait `--commands-dir`, `--zshenv` et
// `--hooks-dir`. `cmdSetup` les résout alors sous `homedir()`, c'est-à-dire le VRAI poste :
// le run a réellement réécrit `/Users/…/.zshenv` (bloc PATH pointé vers un dossier temporaire
// aujourd'hui disparu — masquage silencieux plutôt que « command not found », le pire des
// deux modes de panne). Passer `--commands-dir`/`--zshenv`/`--hooks-dir` à la main referme CE
// trou-là ; rien n'empêche le PROCHAIN test d'en oublier un autre.
//
// ⚠️ CE MODULE EST LE FILET DE SÉCURITÉ EXTÉRIEUR, PAS UNE CEINTURE DE PLUS AUTOUR DU MÊME
// TROU. Peu importe QUEL drapeau un test oublie, ou par quel chemin un code sous test
// résout « le home » — `assertHomeIntact` mesure le seul fait qui compte : le VRAI home du
// poste a-t-il bougé ? S'il a bougé, le test a échoué à se contenir, indépendamment de la
// raison.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI `os.userInfo().homedir`, JAMAIS `os.homedir()` NI `process.env.HOME`
//
// `os.homedir()` et `process.env.HOME` sont CE QU'ON SANDBOXE : un test pose
// `process.env.HOME = FAKE_HOME` (voir `setup.test.js`) précisément pour que `cmdSetup`
// (qui appelle `homedir()` de `node:os`) écrive sous un dossier jetable. Mesurer « le home »
// avec le même mécanisme qu'on vient de détourner ne prouverait rien — on mesurerait le
// FAUX home, celui qu'on VEUT voir changer.
//
// `os.userInfo().homedir`, lui, vient de la base de comptes du système d'exploitation
// (`getpwuid` sur POSIX) — vérifié sur ce poste : `HOME=/tmp/xyz node -e "console.log(
// os.userInfo().homedir)"` rend TOUJOURS le vrai compte, jamais `/tmp/xyz`. C'est le seul
// repère qui reste vrai quel que soit ce qu'un test fait à `$HOME`.
//
// ⚠️ `obtenirHome` EST INJECTABLE — SEULEMENT POUR ÉPROUVER CE MODULE LUI-MÊME. Aucun test de
// `cmdSetup` ne doit jamais le fournir : le jour où il le ferait, il pointerait la garde
// ailleurs que sur le vrai home, et redeviendrait aveugle exactement comme le trou qu'elle
// ferme. Seul `bac-a-sable.test.js` (et la démonstration de mutation, jouée dans un
// sous-processus dont `$HOME` est lui-même un dossier jetable — jamais le vrai poste) s'en
// sert, pour prouver que la garde CRIE sans jamais toucher au vrai `/Users/…`.

import { userInfo } from 'node:os';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Empreinte d'UN fichier : contenu + mtime. `'absent'` si le fichier n'existe pas — un poste
 * CI sans `.zshrc`, par exemple, ne doit jamais se lire comme « inchangé par coïncidence ». */
function empreinteFichier(chemin) {
  if (!existsSync(chemin)) return 'absent';
  try {
    const contenu = readFileSync(chemin, 'utf8');
    const { mtimeMs } = statSync(chemin);
    return `${mtimeMs}:${contenu}`;
  } catch {
    return 'illisible';
  }
}

/** Empreinte d'UN dossier : le listing (noms + mtime), jamais le contenu de chaque fichier —
 * `.somtech/bin` ne se surveille que sur CE QUI Y EST, pas sur le détail des exécutables. */
function empreinteDossier(chemin) {
  if (!existsSync(chemin)) return 'absent';
  try {
    return readdirSync(chemin)
      .sort()
      .map((f) => `${f}@${statSync(join(chemin, f)).mtimeMs}`)
      .join(',');
  } catch {
    return 'illisible';
  }
}

/**
 * L'empreinte du VRAI home du poste, sur les trois lieux que `pack setup` peut toucher :
 * `.zshenv`, `.zshrc`, et le listing de `.somtech/bin`. À appeler AVANT tout `cmdSetup` /
 * `run(['setup', …])` d'un test qui prétend être sandboxé.
 */
export function empreinteDuHome({ obtenirHome = () => userInfo().homedir } = {}) {
  const home = obtenirHome();
  return {
    home,
    zshenv: empreinteFichier(join(home, '.zshenv')),
    zshrc: empreinteFichier(join(home, '.zshrc')),
    somtechBin: empreinteDossier(join(home, '.somtech', 'bin')),
  };
}

/** Levée par `assertHomeIntact` — le message NOMME le fichier touché, jamais un « quelque
 * chose a changé » qui renverrait chercher à la main. */
export class HorsBacASable extends Error {
  constructor(fichier) {
    super(`ce test a écrit hors de son bac à sable : ${fichier}`);
    this.name = 'HorsBacASable';
  }
}

/**
 * Compare l'empreinte `avant` (rendue par `empreinteDuHome`) à l'état ACTUEL du MÊME home
 * (`avant.home` — jamais redemandé à `obtenirHome`, pour comparer exactement ce qui a été
 * mesuré), et lève `HorsBacASable`, en nommant le fichier, au premier écart. Aucun écart :
 * silencieuse.
 */
export function assertHomeIntact(avant) {
  const apres = empreinteDuHome({ obtenirHome: () => avant.home });
  if (apres.zshenv !== avant.zshenv) throw new HorsBacASable(join(avant.home, '.zshenv'));
  if (apres.zshrc !== avant.zshrc) throw new HorsBacASable(join(avant.home, '.zshrc'));
  if (apres.somtechBin !== avant.somtechBin) throw new HorsBacASable(join(avant.home, '.somtech', 'bin'));
}

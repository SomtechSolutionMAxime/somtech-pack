// lieu.js — reconnaître qu'un répertoire EST le lieu d'un représentant, sans le supposer.
//
// Le garde ne doit s'appliquer qu'aux sessions nées dans `.gestionnaire/<client>/` — jamais
// à une session ordinaire qui aurait, par coïncidence, un fichier nommé CONTEXTE.md. On
// exige donc la présence des QUATRE fichiers de `GABARITS` (`ligne-directe/src/
// representant.js`, E-20260807-0002 — importé, jamais reproduit, pour ne jamais diverger de
// la source réelle) — CLAUDE.md et CONTEXTE.md reconnus en plus par leur EN-TÊTE réel,
// jamais par leur seul nom.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GABARITS } from '../../ligne-directe/src/representant.js';

const ENTETE_CLAUDE = /^# Tu es le représentant de ce client/;
const ENTETE_CONTEXTE = /^# Ce qu'on sait de ce client/;

function premiereLigne(chemin) {
  try {
    return readFileSync(chemin, 'utf8').split('\n', 1)[0] || '';
  } catch {
    return '';
  }
}

/** `cwd` est-il le lieu d'un représentant — les quatre gabarits y sont, les deux premiers avec leur en-tête réel ? */
export function estUnLieuDeRepresentant(cwd) {
  const claude = join(cwd, 'CLAUDE.md');
  const contexte = join(cwd, 'CONTEXTE.md');
  if (!existsSync(claude) || !existsSync(contexte)) return false;
  if (!GABARITS.every((f) => existsSync(join(cwd, f)))) return false;
  return ENTETE_CLAUDE.test(premiereLigne(claude)) && ENTETE_CONTEXTE.test(premiereLigne(contexte));
}

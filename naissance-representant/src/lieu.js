// lieu.js — reconnaître qu'un répertoire EST le lieu d'un agent, sans le supposer.
//
// Le garde ne doit s'appliquer qu'aux sessions nées dans le lieu d'un rôle — jamais à une
// session ordinaire qui aurait, par coïncidence, un fichier nommé CONTEXTE.md. On exige donc
// la présence des QUATRE fichiers de `GABARITS` (`ligne-directe/src/lieu-agent.js` — importé,
// jamais reproduit, pour ne jamais diverger de la source réelle), CLAUDE.md et CONTEXTE.md
// étant reconnus en plus par leur EN-TÊTE réel, jamais par leur seul nom.
//
// Les en-têtes vivent dans `roles.js`, avec le reste de ce qui distingue un rôle d'un autre :
// un lieu se reconnaît donc par ce qu'il CONTIENT, et pas par le nom du dossier qui le porte
// — un `.orchestrateur/` vide ou un `.gestionnaire/` à demi posé ne sont pas des lieux.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GABARITS } from '../../ligne-directe/src/lieu-agent.js';
import { role as roleDe, rolesConnus } from '../../ligne-directe/src/roles.js';

function premiereLigne(chemin) {
  try {
    return readFileSync(chemin, 'utf8').split('\n', 1)[0] || '';
  } catch {
    return '';
  }
}

/**
 * Le rôle du lieu qu'est `cwd`, ou `null` si ce n'en est pas un.
 *
 * Rend le RÔLE plutôt qu'un booléen, et ce n'est pas un détail de confort : le garde doit
 * savoir DE QUEL rôle il garde l'ouverture, parce que la séquence qu'il laisse passer n'est
 * pas la même — un orchestrateur qui ouvrirait une ligne de nature `client` créerait un canal
 * privé où un client verrait le code d'un chantier.
 */
export function roleDuLieu(cwd) {
  if (!GABARITS.every((f) => existsSync(join(cwd, f)))) return null;
  for (const nom of rolesConnus()) {
    const attendus = roleDe(nom).entetes;
    const concorde = Object.entries(attendus).every(([fichier, entete]) =>
      entete.test(premiereLigne(join(cwd, fichier)))
    );
    if (concorde) return nom;
  }
  return null;
}

/** `cwd` est-il le lieu d'un représentant ? Conservé : il est le contrat d'origine du garde. */
export function estUnLieuDeRepresentant(cwd) {
  return roleDuLieu(cwd) === 'representant';
}

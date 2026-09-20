// Écriture du marqueur de version POSTE, et ramassage des verrous périmés.
// T-20260816-0020 — la moitié que l'installation poste ne faisait pas.

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MARQUEUR_POSTE, verrousPerimes } from './version-poste.js';

/**
 * Écrit `<toolsDir>/.somtech-pack/version.json` — MÊME geste, MÊME endroit
 * conceptuel que l'installation projet.
 *
 * ⚠️ `version` est celle du PAQUET EN COURS D'EXÉCUTION, c'est-à-dire celle
 * qu'on vient d'installer. C'est le seul numéro dont on soit sûr ici : lire
 * `VERSION` du dépôt rendrait un vestige sans autorité (mesuré : `1.64.0` sur
 * `main` pendant que le paquet publié était à `1.75.0`).
 */
export function ecrireVersionPoste(toolsDir, { version, contenu = null, modules = [] }) {
  const chemin = join(toolsDir, MARQUEUR_POSTE);
  mkdirSync(dirname(chemin), { recursive: true });
  const data = {
    name: '@somtech-solutions/pack',
    version,
    packContentVersion: contenu,
    modules,
    portee: 'poste',
    installedBy: '@somtech-solutions/pack (cli setup)',
    installedAt: new Date().toISOString(),
  };
  writeFileSync(chemin, JSON.stringify(data, null, 2) + '\n');
  return chemin;
}

/**
 * Ramasse les verrous de mise à jour périmés et rend ceux qu'il a retirés.
 * Un verrou orphelin est une mise à jour qui refusera de partir un jour **sans
 * dire pourquoi** ; ils s'accumulaient (2 le 15 août, 4 le 20 août, 4 le
 * 20 septembre) et rien ne les ramassait.
 */
export function ramasserVerrous(toolsDir, { ttlSecondes = 600, maintenant = Date.now(), dryRun = false } = {}) {
  const perimes = verrousPerimes(toolsDir, ttlSecondes, maintenant);
  if (dryRun) return { retires: [], candidats: perimes };
  const retires = [];
  for (const v of perimes) {
    try {
      rmSync(v.chemin, { recursive: true, force: true });
      retires.push(v);
    } catch {
      // Un verrou qu'on ne peut pas retirer se DIT ; il ne se tait pas, et il
      // n'interrompt pas un setup pour autant.
    }
  }
  return { retires, candidats: perimes };
}

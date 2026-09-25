// nom-inscrit.js — lit le nom d'agent qu'un lieu porte (`.nom-agent`), pour la mise à jour.
//
// C'EST UNE COPIE DE `nomInscritDansLeLieu` (`ligne-directe/src/nom-de-riviere.js`), et la
// duplication est imposée par la même distribution que celle de `lieu-nom.js` : le paquet npm
// du CLI ne peut pas importer un module de poste (`nom-de-riviere.js` importe en outre
// `roles.js`, hors de ce que la copie octet pour octet de `lieu-nom.js` peut porter).
//
// ⚠️ CE QUI LA GARDE : `cli/test/nom-inscrit-lecteur-miroir.test.js` fait lire les MÊMES lieux
// par les deux lecteurs et exige la même réponse, sur les cinq états — nom, majuscules, vide,
// absent, illisible. TROIS ÉTATS, JAMAIS DEUX : `ENOENT` est la seule absence ; tout autre
// échec est une mesure MANQUÉE, dite `illisible`, dont on ne conclut rien.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Le fichier où la naissance inscrit le nom que le lieu porte. */
export const FICHIER_NOM_AGENT = '.nom-agent';

/** @returns {{nom: string|null, illisible?: string}} */
export function nomInscritDansLeLieu(lieu) {
  try {
    const brut = readFileSync(join(lieu, FICHIER_NOM_AGENT), 'utf8').trim().toLowerCase();
    return { nom: brut || null };
  } catch (err) {
    if (err?.code === 'ENOENT') return { nom: null };
    return { nom: null, illisible: String(err?.message ?? err).trim() };
  }
}

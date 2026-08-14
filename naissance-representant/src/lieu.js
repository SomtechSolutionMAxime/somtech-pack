// lieu.js — reconnaître qu'un répertoire EST le lieu d'un agent, sans le supposer.
//
// LE CORPS A DÉMÉNAGÉ, ET RIEN D'AUTRE N'A CHANGÉ. `roleDuLieu` vit désormais dans
// `ligne-directe/src/lieu-agent.js`, à côté des `GABARITS` et des en-têtes qu'il éprouve, parce
// qu'un TROISIÈME appelant en a besoin : le veilleur, qui doit savoir à quel rôle remettre une
// consigne du canal commun (T-20260814-0002). Le veilleur ne peut pas importer d'ici — ce
// module-ci importe déjà de `ligne-directe`, et l'inverse ferait un cycle entre les deux
// paquets. Recopier la fonction était l'autre issue, et le dépôt a déjà payé celle-là : « deux
// sources qui disent la même chose divergent, c'est mécanique ».
//
// Ce fichier reste donc le point d'entrée HISTORIQUE — le garde et le réveil l'importent d'ici,
// et continuent de le faire.

export { roleDuLieu } from '../../ligne-directe/src/lieu-agent.js';

import { roleDuLieu } from '../../ligne-directe/src/lieu-agent.js';

/** `cwd` est-il le lieu d'un représentant ? Conservé : il est le contrat d'origine du garde. */
export function estUnLieuDeRepresentant(cwd) {
  return roleDuLieu(cwd) === 'representant';
}

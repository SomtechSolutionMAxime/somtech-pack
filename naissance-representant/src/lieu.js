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

/**
 * `cwd` est-il le lieu d'un représentant ? Conservé : il est le contrat d'origine du garde.
 *
 * ⚠️ CE `'representant'` LITTÉRAL RESTE, ET VOICI SA RAISON (T-20260826-0076, point 6). Il ne
 * DÉCIDE de rien : il DÉFINIT la fonction. Son nom nomme le rôle, sa question porte sur ce rôle,
 * et il n'existe aucune propriété de registre à dériver pour répondre « est-ce CE rôle-ci ». Le
 * dériver d'un prédicat en ferait une autre fonction, sous le même nom.
 *
 * ⚠️ ET MESURÉ, ELLE N'A AUCUN APPELANT DE PRODUCTION — seuls ses cinq essais l'appellent (le
 * garde, lui, passe par `roleDuLieu` depuis que le corps a déménagé). Ce qui reste ici est donc
 * un contrat, pas un chemin vivant.
 *
 * ⚠️ LE SEUL RISQUE RÉEL EST MUET : le jour où la clé « representant » changerait de nom au
 * registre, ce prédicat rendrait `false` pour toujours, en silence. Une garde le tient
 * désormais — `tests/lieu.test.js` exige que « representant » soit un rôle CONNU du registre.
 */
export function estUnLieuDeRepresentant(cwd) {
  return roleDuLieu(cwd) === 'representant';
}

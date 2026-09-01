// roles-connus.js — LA table des rôles que les gardes savent reconnaître, et rien d'autre.
//
// POURQUOI CE FICHIER EXISTE PLUTÔT QU'UNE TABLE PAR GARDE (T-20260826-0079)
//
// `terminal.js` et `ligne-cliente.js` portaient chacune sa liste de rôles, sous le MÊME
// nom (`ROLES_GARDES`) et avec DEUX SENS différents — « les rôles à qui je m'applique »
// ici, « les rôles à qui je refuse » là. Elles avaient déjà divergé : `representant`
// était connu de la seconde et inconnu de la première. Deux copies d'un même critère
// divergent en silence, et ce dépôt l'a payé assez de fois pour ne plus en écrire.
//
// ⚠️ CE QUI EST MIS EN COMMUN EST L'ENSEMBLE DES RÔLES CONNUS, JAMAIS LES VERDICTS.
// « Je sais qui tu es » et « je te laisse faire » sont deux questions distinctes, et
// c'est justement ce que le dispositif a de plus fragile : le même geste — ouvrir la
// ligne d'un client — est REFUSÉ à l'orchestrateur et EST le métier du représentant.
// Une table commune de verdicts effacerait cette différence-là. Chaque garde garde
// donc les siens, et ne partage que la question préalable.
//
// ⚠️ Module PUR : il ne lit rien, n'écrit rien, ne connaît pas le monde — pas même le
// registre des rôles (`ligne-directe/src/roles.js`). L'importer ferait entrer le monde
// dans deux décisions qui doivent rester exerçables sans lui, et les deux arbres où ce
// fichier vit — `cli/src/metier/gardes/` et `gardes/` sur le poste — ne le verraient
// pas au même endroit, ce qui ferait diverger les copies distribuées. La jointure avec
// le registre est donc tenue par un essai (`metier-gardes-roles-connus.test.js`), qui
// rougit quand un rôle y est inscrit sans être déclaré ici.

/**
 * UN RÔLE PORTE DEUX NOMS, ET LES DEUX ARRIVENT JUSQU'À UNE GARDE. MESURÉ :
 *
 *   • `ligne-directe/src/lieu-agent.js` → `roleDuLieu()` rend une CLÉ DE REGISTRE :
 *     ce que `rolesConnus()` énumère, soit « representant » et « orchestrateur » ;
 *   • `gardes/ligne-cliente.js` → son PROPRE `roleDuLieu()` lit le dossier du lieu et
 *     rend un NOM DE GABARIT : « .gestionnaire » → « gestionnaire-client ».
 *
 * Deux fonctions du même nom qui ne rendent pas le même mot pour le même rôle. Une
 * garde qui n'en connaîtrait qu'un des deux refuserait tout à un agent correctement né,
 * et personne ne relierait le symptôme à ce fichier — c'est le mode de panne que
 * l'en-tête de `ligne-cliente.js` nomme déjà.
 *
 * ⚠️ AJOUTER UN NOM ICI N'AJOUTE AUCUN DROIT. Ce n'est pas un registre : c'est ce que
 * les gardes SAVENT LIRE. Ce qu'un rôle a le droit de faire se décide dans chaque
 * garde, jamais ici.
 */
export const NOMS_DU_ROLE = {
  orchestrateur: ['orchestrateur'],
  representant: ['representant', 'gestionnaire-client'],
};

/**
 * Tous les noms sous lesquels un rôle connu peut se présenter à une garde.
 *
 * DÉRIVÉE, jamais réécrite : une seconde énumération se serait désaccordée de la
 * première au premier ajout, et c'est exactement le défaut que ce fichier ferme.
 */
export const ROLES_CONNUS = new Set(Object.values(NOMS_DU_ROLE).flat());

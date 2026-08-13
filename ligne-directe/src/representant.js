// representant.js — le lieu d'un représentant client, et ce qui lui est PROPRE.
//
// Le corps de la pose — les trois gardes, le point d'écriture unique, le retrait de ce qui a
// été commencé — vit désormais dans `lieu-agent.js`, commun aux deux rôles qui posent un lieu
// (voir `roles.js` pour le pourquoi). Ce fichier ne garde que ce qui ne vaut QUE pour un
// représentant : la joignabilité de son canal client, qui existe déjà et où un humain doit
// avoir invité notre robot.
//
// Ses exports d'origine sont conservés tels quels — ils sont importés ailleurs
// (`naissance-representant/src/lieu.js` et `naissance.js` lisent `GABARITS` d'ici plutôt que
// de le reproduire) et la commande les appelle. Les déplacer sans les réexporter aurait fait
// exactement ce que ce lot cherche à éviter : casser un mécanisme éprouvé en le rangeant.

import { trouverCanal, estMembreDuCanal } from './slack.js';
import {
  GABARITS,
  FICHIERS_ENV_CONNUS,
  etatSource as etatSourceDuRole,
  etatLieu as etatLieuDuRole,
  aFichierEnvironnement,
  retirerCeQuiAEteCommence as retirerDuRole,
  preparerLieu,
} from './lieu-agent.js';

export { GABARITS, FICHIERS_ENV_CONNUS, aFichierEnvironnement };

/** Ce que la source offre pour un représentant, fichier par fichier. */
export function etatSource(depotClient) {
  return etatSourceDuRole(depotClient, 'representant');
}

/** Ce que le lieu d'un client contient déjà, sans jamais y toucher. */
export function etatLieu(depotClient, client) {
  return etatLieuDuRole(depotClient, 'representant', client);
}

/** Retire ce qu'une pose interrompue avait commencé — le lieu de CE client, et rien d'autre. */
export function retirerCeQuiAEteCommence(depotClient, client) {
  return retirerDuRole(depotClient, 'representant', client);
}

/**
 * Le canal est-il joignable, RÉELLEMENT — pas « existe-t-il », mais « notre robot peut-il y
 * être lu » ? Deux réponses négatives distinctes, parce que le geste qui lève chacune n'est
 * pas le même : un canal absent se crée ou se corrige (faute de frappe) ; un canal dont on
 * n'est pas membre se règle par une invitation humaine, jamais par du code — un robot ne
 * rejoint pas un canal privé (mesuré : `conversations.join` n'aboutit sur aucun canal privé,
 * quel que soit le droit accordé). On ne tente donc jamais de le rejoindre ici.
 *
 * @param {string} jetonRobot
 * @param {string} nomCanal
 */
export async function verifierCanalJoignable(jetonRobot, nomCanal) {
  const canal = await trouverCanal(jetonRobot, nomCanal);
  if (!canal) return { joignable: false, motif: 'absent', canal: nomCanal };

  const membre = await estMembreDuCanal(jetonRobot, canal);
  if (!membre) return { joignable: false, motif: 'non_membre', canal: nomCanal, id: canal.id };

  return { joignable: true, canal: nomCanal, id: canal.id, prive: Boolean(canal.is_private) };
}

/** Le message de refus, écrit pour être lu et suivi — jamais pour être analysé par un test. */
export function messageDeRefus(joignabilite) {
  if (joignabilite.motif === 'absent') {
    return (
      `le canal « ${joignabilite.canal} » est introuvable — vérifie le nom, ou fais-le créer ` +
      `par un humain, puis relance.`
    );
  }
  return (
    `notre robot n'est pas membre de « ${joignabilite.canal} » et ne peut pas s'y mettre ` +
    `lui-même — fais-le inviter à la main dans Slack ("/invite" depuis le canal), puis relance.`
  );
}

/**
 * Prépare le lieu du représentant dans le dépôt du client.
 *
 * @param {object} p
 * @param {string} p.depotClient        racine du dépôt du client (celui qui reçoit le lieu)
 * @param {string} p.client             nom du client — dossier sous `.gestionnaire/`
 * @param {string} p.canal              nom du canal, pour le message de refus uniquement
 * @param {() => Promise<{joignable: boolean, motif?: string}>} p.verifierJoignabilite
 */
export async function preparerLieuRepresentant({ depotClient, client, canal, verifierJoignabilite }) {
  return preparerLieu({
    depot: depotClient,
    role: 'representant',
    nom: client,
    // Le motif et le message restent formés ICI : ils parlent d'un canal client, que le
    // module commun ne connaît pas et n'a pas à connaître.
    verifierLigne: async () => {
      const j = await verifierJoignabilite();
      if (j.joignable) return j;
      return { ...j, canal, message: messageDeRefus({ ...j, canal }) };
    },
  });
}

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
import { lireJeton, SERVICE_ROBOT, JetonIllisible, JetonVide } from './trousseau.js';
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

/**
 * Le canal du client est-il ouvrable — POSTE COMPRIS ?
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CETTE FONCTION EXISTE POUR RÉPARER (T-20260813-0054, élargissement au représentant)
 *
 * La lecture du jeton se faisait DANS L'ARGUMENT de la vérification, à l'appel :
 *
 *     verifierJoignabilite: async () => verifierCanalJoignable(await lireJeton(SERVICE_ROBOT), canal)
 *
 * Rien n'entourait ce `await`. Quand le trousseau ne rendait pas la valeur, l'exception
 * TRAVERSAIT toute la pose et finissait au filet global du binaire. MESURÉ, et les trois
 * conséquences comptent :
 *
 *   1. AUCUN JSON n'était rendu — alors qu'un refus `gabarits_absents`, lui, en rend un. Qui
 *      appelle la commande par contrat ne recevait rien à lire ;
 *   2. le « rien n'a été créé » n'était jamais dit — vrai dans les faits, jamais écrit ;
 *   3. le message BRUT de `JetonManquant` sortait — celui qui propose
 *      `security add-generic-password`, c'est-à-dire le geste qui écrase un secret vivant.
 *
 * L'orchestrateur, lui, entourait déjà sa lecture (`verifierLigneOuvrable`). Une porte sur
 * deux, pour la septième fois sur ce dépôt.
 *
 * ON NE DUPLIQUE PAS LE RENVERSEMENT : `trousseau.js` décide déjà, pour les DEUX rôles, de ce
 * qui est une absence prouvée et de ce qui ne l'est pas. Ici on ne fait que RELAYER son
 * verdict — et le ranger du côté du POSTE, qui n'a rien à voir avec le canal.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */
export async function verifierCanalOuvrable({
  canal,
  lireJetonRobot = () => lireJeton(SERVICE_ROBOT),
  verifier = verifierCanalJoignable,
}) {
  let jetonRobot;
  try {
    jetonRobot = await lireJetonRobot();
  } catch (err) {
    return {
      joignable: false,
      portee: 'poste',
      motif: err instanceof JetonIllisible ? 'jeton_illisible' : err instanceof JetonVide ? 'jeton_vide' : 'jeton_absent',
      canal,
      message:
        `${err.message}\n` +
        `  Rien n'a été créé : le lieu du représentant n'est posé qu'une fois la ligne établie.\n` +
        `  ⚠️ Ce refus parle du POSTE, pas du canal « ${canal} ». N'y cherche rien, et n'y invite ` +
        `personne : le canal n'a même pas été consulté.`,
    };
  }
  const j = await verifier(jetonRobot, canal);
  return j.joignable ? j : { ...j, portee: 'canal' };
}

/**
 * Le message de refus D'UN CANAL, écrit pour être lu et suivi — jamais pour être analysé par
 * un test.
 *
 * ⚠️ IL N'A PLUS DE CAS PAR DÉFAUT, et c'est le même renversement qu'au trousseau. Le `return`
 * final valait « fais inviter le robot » : tout motif qui n'était pas `absent` recevait donc
 * ce conseil, y compris un refus du poste égaré ici. Un humain aurait cherché une invitation
 * Slack pendant que son trousseau restait verrouillé.
 */
export function messageDeRefus(joignabilite) {
  if (joignabilite.motif === 'absent') {
    return (
      `le canal « ${joignabilite.canal} » est introuvable — vérifie le nom, ou fais-le créer ` +
      `par un humain, puis relance.`
    );
  }
  if (joignabilite.motif === 'non_membre') {
    return (
      `notre robot n'est pas membre de « ${joignabilite.canal} » et ne peut pas s'y mettre ` +
      `lui-même — fais-le inviter à la main dans Slack ("/invite" depuis le canal), puis relance.`
    );
  }
  return (
    joignabilite.message ||
    `le canal « ${joignabilite.canal} » n'est pas joignable, et le motif rendu (« ` +
      `${joignabilite.motif ?? '—'} ») n'est pas un motif de canal — ne fais rien du côté de ` +
      `Slack sur la foi de ce refus.`
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
      // UN REFUS DU POSTE PORTE DÉJÀ SON MESSAGE, et le réécrire ici l'aurait traduit en
      // conseil de canal — « fais inviter le robot » — pour une panne de trousseau.
      if (j.portee === 'poste') return j;
      return { ...j, portee: 'canal', canal, message: messageDeRefus({ ...j, canal }) };
    },
  });
}

// canal-commun.js — ce que la COMMANDE doit résoudre avant de désigner le canal commun.
//
// Le veilleur reçoit des identifiants Slack ; l'opérateur, lui, tape des courriels. La
// traduction vit ici plutôt que dans le binaire, pour une raison mesurée en revue : une boucle
// enfouie dans `bin/` n'est exercée par aucun test — ni les tests du veilleur, qui reçoivent
// une liste déjà résolue, ni ceux des arguments, qui s'arrêtent à la lecture de la ligne de
// commande. C'est très exactement le genre d'endroit où « la liste amputée en silence »
// réapparaît sans que personne ne la voie.
//
// LE REFUS EST ENTIER, ET C'EST TOUT LE SUJET. Un nom qui ne se résout pas fait échouer la
// désignation COMPLÈTE plutôt que d'inscrire les autres : un canal commun désigné avec une
// liste amputée a l'air posé, et la personne qui manque s'entend refuser la parole sans que
// rien ne le dise — sur le canal qui sert précisément à ne plus attendre.

import { trouverMembre } from './slack.js';

/**
 * Résout les personnes autorisées à parler sur le canal commun.
 *
 * @param {string} jetonRobot
 * @param {string[]} noms courriels, identifiants Slack (U…) ou noms d'usage
 * @returns {Promise<{ok: true, autorises: string[]} | {ok: false, inconnu: string}>}
 */
export async function resoudreAutorises(jetonRobot, noms) {
  const autorises = [];
  for (const qui of noms) {
    const id = await trouverMembre(jetonRobot, qui);
    // On s'arrête au PREMIER inconnu, sans rien inscrire. Continuer pour « rendre la liste
    // complète des inconnus » coûterait un balayage de l'annuaire par nom manquant, sur une
    // méthode plafonnée, pour une information dont on ne fait rien : la désignation est
    // refusée dès le premier de toute façon.
    if (!id) return { ok: false, inconnu: qui };
    autorises.push(id);
  }
  return { ok: true, autorises };
}

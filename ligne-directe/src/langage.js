// langage.js — ce que le veilleur DIT, et à qui il le dit.
//
// Le veilleur écrit en notre nom dans un canal Slack. Tant qu'il n'écrivait qu'au dirigeant,
// ses phrases pouvaient nommer nos rouages : « son pane a disparu », « je n'arrive pas à
// joindre l'agent de d-20260805-0005 », et jusqu'au message d'erreur d'origine recopié tel
// quel. Adressées à un client, ces mêmes phrases exposent notre outillage, nomment nos
// chantiers internes, et sonnent comme une panne chez nous.
//
// D'où ce module, et sa forme : UN SEUL endroit où vivent les réponses, indexées par la
// CAUSE de la non-remise et par la NATURE de la ligne. Le veilleur ne rédige plus rien au
// point d'appel — il désigne une cause. C'est ce qui rend la couverture structurelle :
// une septième cause ajoutée demain sans sa variante cliente fait rougir la suite de tests,
// au lieu de partir telle quelle vers un tiers.
//
// Le registre CLIENT est sobre, pas obséquieux. On ne fabrique pas un ton commercial : une
// phrase claire qui dit ce qui se passe. Un client n'a pas besoin d'être rassuré, il a
// besoin de savoir — et il n'a pas à apprendre comment nous travaillons pour l'apprendre.

/**
 * Les six situations où le veilleur répond de lui-même dans le canal.
 *
 * L'ordre suit celui du chemin de remise : autorisation, ligne close, agent injoignable,
 * agent disparu, échec de remise — puis la reprise du service, hors de ce chemin.
 */
export const CAUSES = [
  'non_autorise',
  'ligne_close',
  'agent_injoignable',
  'agent_disparu',
  'echec_remise',
  'reprise_agent_disparu',
];

/**
 * Le registre INTERNE — mot pour mot ce que le dirigeant lit depuis la mise en service.
 *
 * Ces textes ne sont pas « une version parmi d'autres » : quatre lignes internes tournaient
 * en production au moment de ce changement. Toute reformulation ici est une régression, et
 * la suite de tests la traite comme telle.
 */
const INTERNE = {
  non_autorise: () => "Ton message n'a été remis à aucun agent : tu n'es pas autorisé à écrire sur cette ligne.",
  ligne_close: ({ close_le: closeLe, chantier }) =>
    `Cette ligne est close depuis le ${String(closeLe).slice(0, 10)} — plus personne ne travaille sur ${chantier}. ` +
    `Ton message n'a donc été remis à aucun agent.`,
  agent_injoignable: ({ chantier, erreur }) =>
    `Je n'arrive pas à joindre l'agent de ${chantier} en ce moment (${erreur}). ` +
    `Ton message n'a été remis à personne — renvoie-le dans un instant.`,
  agent_disparu: ({ chantier, pane }) =>
    `L'agent de ${chantier} n'est plus là — son pane ${pane} a disparu. ` +
    `Je referme la ligne ; ton message n'a été remis à personne.`,
  echec_remise: ({ chantier, erreur }) => `Je n'ai pas pu remettre ton message à l'agent de ${chantier} : ${erreur}`,
  reprise_agent_disparu: ({ chantier }) =>
    `Je reprends du service et l'agent de ${chantier} n'est plus là. Je referme cette ligne.`,
};

/**
 * Le registre CLIENT — la même information, sans nos rouages.
 *
 * Trois choses n'y entrent JAMAIS, et chacune est une fuite d'information interne :
 *   - le vocabulaire de l'outillage (pane, agent, chantier, veilleur…) ;
 *   - le code du chantier, qui nomme un travail interne et parfois un autre client ;
 *   - le message d'erreur d'origine, qui décrit l'état de notre poste.
 *
 * Aucun texte ne prend donc de détail : les paramètres sont ignorés, volontairement. C'est
 * ce qui garantit qu'aucune interpolation ne peut y glisser une fuite plus tard.
 */
const CLIENT = {
  non_autorise: () =>
    "Votre message n'a pas été transmis : vous n'avez pas accès à cette conversation. " +
    'Écrivez à votre interlocuteur habituel pour qu’il vous y ajoute.',
  ligne_close: () => 'Cette conversation est terminée — plus personne ne la suit. Votre message n’a donc pas été transmis.',
  agent_injoignable: () =>
    'Votre interlocuteur n’est pas joignable en ce moment. ' +
    'Votre message n’a pas été transmis — renvoyez-le dans quelques instants.',
  agent_disparu: () =>
    'Votre interlocuteur n’est plus disponible : cette conversation se termine ici. Votre message n’a pas été transmis.',
  echec_remise: () =>
    'Votre message n’a pas pu être transmis à votre interlocuteur. Renvoyez-le dans quelques instants.',
  reprise_agent_disparu: () => 'Votre interlocuteur n’est plus disponible : cette conversation se termine ici.',
};

const REGISTRES = { interne: INTERNE, client: CLIENT };

/**
 * La phrase à dire, pour cette cause et cette nature de ligne.
 *
 * Échoue plutôt que de rendre un texte approchant : une cause inconnue veut dire qu'un
 * chemin de non-remise a été ajouté sans son texte, et un repli silencieux enverrait au
 * mieux une phrase hors sujet, au pire une phrase interne à un client.
 *
 * @param {string} cause  l'une de CAUSES
 * @param {string} nature 'interne' | 'client'
 * @param {object} [details] chantier, pane, close_le, erreur — lus par le registre interne
 */
export function reponse(cause, nature, details = {}) {
  const registre = REGISTRES[nature];
  if (!registre) {
    throw new Error(`nature de ligne inconnue : « ${nature} » — les natures admises sont ${Object.keys(REGISTRES).join(', ')}`);
  }
  const texte = registre[cause];
  if (!texte) {
    throw new Error(`cause de non-remise inconnue : « ${cause} » — les causes déclarées sont ${CAUSES.join(', ')}`);
  }
  return texte(details);
}

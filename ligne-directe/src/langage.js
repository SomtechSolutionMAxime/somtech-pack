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
 * Les chemins de NON-REMISE : le message n'est pas parvenu à son destinataire, et celui qui
 * l'a écrit doit l'apprendre (RA-REL-009).
 *
 * L'ordre suit celui du chemin de remise : autorisation, ligne close, message sans rien à
 * remettre, agent injoignable, agent disparu, échec de remise — puis la reprise du service,
 * hors de ce chemin.
 *
 * `message_vide` est le SEPTIÈME, et il était invisible : un message sans texte ni pièce était
 * jeté au filtrage, sans trace, sans réponse, sans remise. Le compte des chemins n'est pas
 * décoratif — trois correctifs de ce chantier n'avaient couvert qu'une porte sur deux, et
 * celui-ci n'avait été compté par personne.
 */
export const CAUSES_DE_NON_REMISE = [
  'non_autorise',
  'ligne_close',
  'ligne_inconnue',
  'message_vide',
  'agent_injoignable',
  'agent_disparu',
  'echec_remise',
  'reprise_agent_disparu',
];

/**
 * Les causes qui accompagnent une remise RÉUSSIE — une pièce jointe n'a pas suivi.
 *
 * DEUX FAMILLES, ET ELLES DISENT L'INVERSE L'UNE DE L'AUTRE : celles du dessus annoncent que
 * le message n'est pas passé, celles-ci commencent par dire qu'il l'est. Les confondre serait
 * coûteux dans les deux sens — un client qui croit son message perdu le réécrit, un client qui
 * croit sa pièce arrivée attend qu'on la regarde.
 *
 * Ce qui accompagne un message ne conditionne jamais son arrivée (RA-REL-010) ; son absence,
 * elle, se dit toujours.
 *
 * Trois causes plutôt qu'une, et c'est le point : « votre fichier n'est pas passé » n'aide
 * personne. Ce qui aide, c'est de savoir s'il faut le renvoyer, le convertir, ou passer par un
 * autre chemin — et ces trois réponses-là ne se déduisent pas l'une de l'autre.
 */
export const CAUSES_DE_PIECE = ['piece_trop_lourde', 'piece_type_refuse', 'piece_non_recuperee'];

/** Toutes les situations où le veilleur prend la parole — l'union des deux familles. */
export const CAUSES = [...CAUSES_DE_NON_REMISE, ...CAUSES_DE_PIECE];

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
  ligne_inconnue: ({ canal }) =>
    `Un message est arrivé sur #${canal}, qui ne correspond à AUCUNE ligne du registre — ` +
    `il n'a été remis à aucun agent. Le canal étant privé, son auteur a reçu une réponse cliente.`,
  message_vide: () =>
    `Ton message est arrivé sans rien à remettre — ni texte, ni pièce jointe. ` +
    `Il n'a donc été remis à aucun agent.`,
  agent_injoignable: ({ chantier, erreur }) =>
    `Je n'arrive pas à joindre l'agent de ${chantier} en ce moment (${erreur}). ` +
    `Ton message n'a été remis à personne — renvoie-le dans un instant.`,
  agent_disparu: ({ chantier, pane }) =>
    `L'agent de ${chantier} n'est plus là — son pane ${pane} a disparu. ` +
    `Je referme la ligne ; ton message n'a été remis à personne.`,
  echec_remise: ({ chantier, erreur }) => `Je n'ai pas pu remettre ton message à l'agent de ${chantier} : ${erreur}`,
  reprise_agent_disparu: ({ chantier }) =>
    `Je reprends du service et l'agent de ${chantier} n'est plus là. Je referme cette ligne.`,
  piece_trop_lourde: () =>
    `Le message est bien remis, mais une pièce jointe dépasse 5 Mo : elle n'a pas été recueillie. ` +
    `Le registre des demandes la refuserait de toute façon.`,
  piece_type_refuse: () =>
    `Le message est bien remis, mais une pièce jointe n'est pas d'un type recevable ` +
    `(jpeg, png, gif, webp, pdf, markdown) : elle n'a pas été recueillie.`,
  piece_non_recuperee: ({ erreur }) =>
    `Le message est bien remis, mais je n'ai pas pu récupérer une pièce jointe${erreur ? ` : ${erreur}` : ''}.`,
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
 *
 * Une QUATRIÈME chose n'y entre jamais, et elle a été apprise après coup : **l'annonce
 * d'une fin**. Ces phrases disaient « cette conversation se termine ici » quand notre
 * session disparaissait — or le canal appartient au client, il n'est pas archivé, et une
 * session neuve reprend la relation. La phrase était donc simplement fausse, et son coût
 * n'était pas le style : un client à qui l'on annonce une fin repart par courriel, ce que
 * toute cette fonction existe pour supprimer. Ce qu'on lui doit est exact et borné dans le
 * temps — personne n'est là *en ce moment*, son message n'est pas passé, qu'il revienne.
 */
const CLIENT = {
  non_autorise: () =>
    "Votre message n'a pas été transmis : vous n'avez pas accès à cette conversation. " +
    'Écrivez à votre interlocuteur habituel pour qu’il vous y ajoute.',
  ligne_close: () =>
    'Personne ne suit cette conversation en ce moment — votre message n’a pas été transmis. ' +
    'Écrivez-nous de nouveau un peu plus tard, ou passez par votre interlocuteur habituel si c’est pressant.',
  ligne_inconnue: () =>
    'Cette conversation n’est suivie par personne en ce moment — votre message n’a pas été transmis. ' +
    'Réécrivez-nous un peu plus tard, ou passez par votre interlocuteur habituel si c’est pressant.',
  message_vide: () =>
    'Votre message nous est bien parvenu, mais il était vide — ni texte, ni fichier. ' +
    'Il n’a donc pas été transmis : réécrivez-le, s’il vous plaît.',
  agent_injoignable: () =>
    'Votre interlocuteur n’est pas joignable en ce moment. ' +
    'Votre message n’a pas été transmis — renvoyez-le dans quelques instants.',
  agent_disparu: () =>
    'Votre interlocuteur n’est pas disponible en ce moment — votre message n’a pas été transmis. ' +
    'Renvoyez-le un peu plus tard : quelqu’un reprendra le fil.',
  echec_remise: () =>
    'Votre message n’a pas pu être transmis à votre interlocuteur. Renvoyez-le dans quelques instants.',
  reprise_agent_disparu: () =>
    'Votre interlocuteur n’est pas disponible en ce moment. Quelqu’un reprendra le fil de cette conversation.',
  // Les trois qui suivent commencent toutes par dire que le message, LUI, est arrivé. C'est
  // l'inverse d'un détail : sans cette première phrase, un client à qui l'on parle d'un
  // fichier qui n'est pas passé conclut que son message ne l'est pas non plus, et il recommence.
  piece_trop_lourde: () =>
    'Votre message nous est bien parvenu, mais le fichier joint est trop volumineux pour nous ' +
    'arriver : la limite est de 5 Mo. Une capture d’écran passe ; une vidéo, non — dans ce cas, ' +
    'envoyez-la par votre moyen habituel.',
  piece_type_refuse: () =>
    'Votre message nous est bien parvenu, mais nous ne pouvons pas recevoir ce type de fichier. ' +
    'Les images (JPEG, PNG, GIF, WebP), les PDF et les fichiers texte passent.',
  piece_non_recuperee: () =>
    'Votre message nous est bien parvenu, mais nous n’avons pas pu récupérer le fichier joint. ' +
    'Renvoyez-le si vous voulez qu’on le voie.',
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

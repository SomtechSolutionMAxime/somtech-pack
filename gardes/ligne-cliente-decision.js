// ligne-cliente-decision.js — la garde qui tient GF-ORC-005 (P-20260820-0001, STD-047).
//
// « Tu ne parles jamais à un client. Ce qui doit l'atteindre passe par son
// représentant. » Ce garde-fou vivait en PERSONA seule — c'est-à-dire nulle part :
// une règle qu'aucune couche ne garantit est une intention, pas une garantie (R1).
//
// La brèche est nommable en un mot : `ligne-directe ouvrir <chantier> --nature
// client` ouvre un canal PRIVÉ où parlent les gens du client. C'est le seul geste,
// dans tout l'outillage d'un orchestrateur, qui le met en face d'un client — et
// il tient sur une ligne de terminal, donc il se décide sur une ligne de terminal.
//
// ⚠️ CE QUI REND CETTE GARDE DIFFÉRENTE DE CELLE DU TERMINAL : le même geste est
// REFUSÉ à l'un et est le MÉTIER de l'autre. Ouvrir la ligne de son client est
// précisément ce pour quoi un gestionnaire-client existe. Une garde qui se
// tromperait de rôle ne ferait pas du bruit : elle empêcherait un représentant
// de faire son travail, et personne ne relierait le symptôme à ce fichier.
//
// C'est pourquoi le rôle est ici MESURÉ, jamais supposé — et pourquoi un rôle
// qu'on n'a pas su mesurer fait refuser. Voir le fil.
//
// ⚠️ Module PUR : il ne lit rien, n'écrit rien, ne connaît pas le monde.

/** Les rôles à qui l'ouverture d'une ligne cliente est refusée. */
export const ROLES_GARDES = new Set(['orchestrateur']);

/** Les rôles pour qui ouvrir une ligne cliente EST le métier — jamais refusés. */
export const ROLES_AUTORISES = new Set(['gestionnaire-client', 'representant']);

/**
 * L'appel de la ligne directe, sous ses deux formes vues sur le terrain :
 * `node …/ligne-directe.js` et l'alias `ligne-directe`.
 */
const LIGNE_DIRECTE = /(^|[\s;&|(])(\S*ligne-directe(\.js)?)(\s|$)/;

/** Le sous-commande qui crée un canal. */
const OUVRIR = /(^|[\s;&|(])ouvrir(\s|$)/;

/**
 * Le drapeau qui rend le canal CLIENT. La forme accolée (`--nature=client`) compte
 * autant que la forme séparée : garder une seule des deux ne garde rien.
 */
const NATURE_CLIENT = /--nature[=\s]+client(\s|$|["'])/;

const deny = (raison) => ({ decision: 'deny', raison });
const allow = () => ({ decision: 'allow', raison: '' });

/**
 * Juge une commande de terminal du point de vue de GF-ORC-005.
 *
 * @param {{commande?:string, role?:string}} req
 * @returns {{decision:'allow'|'deny', raison:string}}
 */
export function juger(req = {}) {
  const { commande, role } = req;

  // ① LE GESTE D'ABORD, LE RÔLE ENSUITE — et l'ordre n'est pas cosmétique.
  //    Cette garde refuse quand elle n'a pas su mesurer le rôle. Si elle mesurait
  //    le rôle en premier, ce refus tomberait sur TOUTES les commandes d'un lieu
  //    dont elle n'a pas reconnu la forme — c'est-à-dire qu'elle empêcherait de
  //    travailler au lieu de garder un geste. Mise dans cet ordre, elle est muette
  //    sur tout ce qui n'est pas le geste, quel que soit le rôle.
  //
  //    Trois signes qui doivent être là ENSEMBLE. Refuser sur « --nature client »
  //    seul refuserait aussi la phrase où l'orchestrateur en PARLE — et un
  //    orchestrateur en parle, c'est dans son métier.
  if (typeof commande !== 'string') return allow();
  if (!LIGNE_DIRECTE.test(commande)) return allow();
  if (!OUVRIR.test(commande)) return allow();
  if (!NATURE_CLIENT.test(commande)) return allow();

  // ② Le geste est là. C'est maintenant que le rôle décide de quel côté on est.
  if (ROLES_AUTORISES.has(role)) return allow();
  if (!ROLES_GARDES.has(role)) {
    return deny(
      `Cette commande ouvre un canal CLIENT, et la garde n'a pas su établir à quel rôle elle ` +
      `avait affaire (« ${role ?? 'aucun'} »). Ouvrir une ligne cliente appartient au représentant ` +
      `du client et à lui seul ; devant un rôle qu'elle n'a pas mesuré, elle refuse plutôt que ` +
      `de le supposer.`,
    );
  }

  return deny(
    `Cette commande ouvre un canal CLIENT, où parlent les gens du client. Tu ne parles jamais ` +
    `à un client : ce qui doit l'atteindre passe par son représentant, qui porte son contexte, ` +
    `son historique et son ton. Ce n'est pas une question de prudence — un message juste, envoyé ` +
    `par le mauvais interlocuteur, arrive faux. Fais ouvrir cette ligne par le représentant du ` +
    `client, ou fais-le naître s'il n'existe pas encore.`,
  );
}

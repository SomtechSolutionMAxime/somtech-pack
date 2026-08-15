// cloisonnement.js — QUI EST DANS LE CANAL, et qui ne devrait pas y être.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260813-0074, T-20260814-0142)
//
// Le cloisonnement du dispositif tenait au CANAL, jamais à ses MEMBRES :
//
//   • une ligne CLIENTE autorise par appartenance au canal — être dedans EST l'autorisation.
//     Deux clients invités dans le même canal deviennent donc tous deux autorisés, lisent tous
//     deux ce que le gestionnaire y écrit, et rien ne le détecte. Loi 25 : une communication
//     d'affaires d'un client lue par un autre est une communication à un tiers ;
//   • une ligne INTERNE porte les arbitrages, les pannes de production, les échéances et les
//     coûts. Le dirigeant a posé la règle — « pas de client dans les canaux des orchestrateurs »
//     — et rien ne la faisait respecter.
//
// `membresDuCanal` existait dans `slack.js` et n'était appelé nulle part dans le chemin de
// pose. La liste était disponible ; personne ne la regardait.
//
// ⚠️ CE MODULE NE PARLE PAS À SLACK. Il reçoit des profils déjà lus et rend un jugement — donc
// il s'éprouve sans transport, et le transport s'éprouve sans lui. C'est la séparation qui a
// permis d'écrire les cas limites (pas de photo, pas d'équipe de référence) sans monter un
// espace de travail entier pour chacun.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE CRITÈRE, ET POURQUOI CE N'EST PAS CELUI QUE LES TICKETS DEMANDAIENT
//
// Les deux tickets proposaient le DOMAINE DU COURRIEL, « disponible dans le profil Slack ».
// MESURÉ le 2026-08-15 avec le jeton du ROBOT — celui qui fait la vérification, pas celui du
// dirigeant : `users.info` ne rend AUCUN courriel. Le droit `users:read.email` n'est pas
// accordé à notre application ; le profil s'arrête à `real_name`, `display_name`, `title`,
// `phone`, `status_*`. Coder ce critère aurait produit une garde qui ne se déclenche jamais —
// la pire espèce, puisqu'elle rassure.
//
// CE QUI EXISTE, relevé sur les canaux réels du poste le même jour :
//
//   #modifications-bruno-2026 (interne)     → maxime · Bruno Potvin · robot — aucun invité
//   #charles-olivier-suivi-client (client)  → maxime · robot · Charles-Olivier [INVITÉ]
//                                             · Max perso [INVITÉ][MONO-CANAL]
//
// Slack marque `is_restricted` les gens qu'on invite — c'est ainsi qu'un client entre dans un
// espace de travail. Le statut que l'espace accorde est plus solide que l'adresse que
// quelqu'un porte : il ne dépend pas de ce que la personne a écrit dans son profil.

/**
 * Ce que ce critère sait, et ce qu'il ne sait pas.
 *
 * ⚠️ LA LIMITE VIT AVEC LE CRITÈRE, pas dans le message de celui qui l'emploie. Un critère dont
 * la limite est écrite ailleurs — ou nulle part — finit par être lu comme une certitude, et
 * c'est ce que les deux tickets demandaient explicitement d'éviter.
 */
export const NOUS = {
  limite:
    'ce signal est le statut que l’espace de travail accorde, pas une identité : un externe ' +
    'promu membre plein ne serait pas vu, et un collègue entré comme invité serait signalé à tort',
};

/** Le robot est dans tous les canaux par construction — il n'est jamais un tiers. */
const estNotreRobot = (p) => Boolean(p?.robot);

/**
 * Ceux qui, parmi ces profils, ne sont pas de la maison.
 *
 * Deux façons d'être étranger, et elles se cumulent :
 *   • être un INVITÉ (`is_restricted` / `is_ultra_restricted`) — la façon dont un client entre ;
 *   • appartenir à une AUTRE organisation Slack — la façon dont un externe arrive par Slack
 *     Connect. Aucun cas sur le poste aujourd'hui, mais la porte existe et coûte une comparaison.
 *
 * ⚠️ `nous` peut être inconnu, et on ne fabrique alors aucun verdict sur l'organisation : une
 * comparaison qu'on ne peut pas faire ne rend pas « ils sont tous des nôtres ». Le reste du
 * critère tient quand même — un invité reste un invité.
 */
export function etrangersParmi(profils, nous) {
  return (profils || []).filter((p) => {
    if (!p || estNotreRobot(p)) return false;
    // ⚠️ UN PROFIL QU'ON N'A PAS PU LIRE N'EST PAS UN ÉTRANGER — c'est un profil qu'on n'a pas
    // lu. Le compter comme suspect ferait refuser des canaux sains sur un compte supprimé ou
    // un profil restreint ; le silence de Slack n'est pas une accusation.
    if (p.inconnu) return false;
    if (p.invite || p.monoCanal) return true;
    if (nous && p.equipe && p.equipe !== nous) return true;
    return false;
  });
}

/**
 * Ceux qui sont arrivés depuis la photo — et rien de plus que ça.
 *
 * ⚠️ C'EST TOUT CE QU'ON PRÉTEND SAVOIR, et c'est l'arbitrage rendu après mesure. On ne dit pas
 * « c'est un autre client » : sans registre des personnes (`D-20260806-0016`), rien ne permet de
 * distinguer un client d'un autre, et deux personnes d'un même client sont le cas NOMINAL —
 * c'est exactement ce que montre le canal client du poste. On dit « quelqu'un est entré depuis,
 * et ce canal porte des affaires ». Aucune identité requise, et ça attrape le vrai risque :
 * celui qu'on invite des mois plus tard sans se souvenir de ce que le canal contient.
 *
 * ⚠️ SANS PHOTO, PERSONNE N'EST NOUVEAU. Le registre survit aux versions du pack et rien ne
 * migre : les lignes déjà ouvertes n'en ont pas. Les lire comme « tout le monde vient d'arriver »
 * ferait crier chaque ligne du poste au premier message — la façon la plus sûre de rendre un
 * signal inaudible avant qu'il ait servi une seule fois.
 *
 * Un DÉPART n'est pas signalé : ce qu'on surveille est l'augmentation du lectorat.
 */
export function nouveauxVenus(photo, profils) {
  if (!Array.isArray(photo)) return [];
  const vus = new Set(photo);
  return (profils || []).filter((p) => p && !estNotreRobot(p) && !vus.has(p.id));
}

/** La photo à inscrire au registre — les identifiants, rien d'autre : aucun nom, aucun profil. */
export function photographier(profils) {
  return (profils || []).map((p) => p.id);
}

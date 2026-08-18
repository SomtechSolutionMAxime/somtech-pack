// LA DÉLIVRANCE D'UNE BOÎTE BLOQUÉE — le geste qui finit ce que quelqu'un a commencé.
//
// ⚠️ CE MODULE EST UN DÉPLACEMENT, PAS UNE RÉÉCRITURE (T-20260818-0049, règle d'or n°15).
// Ce code vivait dans `naissance-representant/src/livraison.js` depuis `eceba2e`
// (T-20260816-0114) et n'a pas changé d'une ligne ici. Il porte des gardes MESURÉES — sur le
// texte coincé, sur l'écran, sur l'immobilité — et chacune a coûté un lot. En écrire une
// seconde copie pour le second appelant aurait rejoué « une porte sur deux » : la copie
// n'hérite jamais des corrections de l'autre.
//
// POURQUOI IL DESCEND ICI. Il avait DEUX appelants à servir et ils sont dans deux paquets :
// `naissance-representant` (livrer.js, rendez-vous.js, naitre.js) et `ligne-directe`
// (herdr.js — le chemin par lequel arrive la parole du dirigeant). `naissance-representant`
// dépend déjà de `ligne-directe` ; le poser ici garde UNE seule direction de dépendance,
// là où l'import inverse aurait fermé un cycle entre les deux paquets.
//
// ⚠️ ET C'EST LE DÉFAUT QUE T-20260818-0049 FERME. Le veto qui refuse d'écrire dans une boîte
// occupée a été posé sur les DEUX chemins ; ce rattrapage n'existait que sur UN. Le chemin de
// la parole du dirigeant a donc reçu l'interdit sans le remède, et il a fallu qu'il ouvre un
// terminal pour parler à ses propres agents.
//
// L'I/O est injectée : ce module ne touche aucun processus enfant.

import { contenuBoite, boiteEstVide } from './boite.js';
import { etatDeLEcran, ressembleAUnChoix, ecranAttendUnChoix, resumeDeLEcran } from './ecran.js';

/**
 * LE DÉLAI D'IMMOBILITÉ PAR DÉFAUT — cinq minutes, et le chiffre est le cœur de la garde.
 *
 * Trente secondes ont d'abord été écrites, et l'orchestrateur l'a refusé en approuvant la
 * conception, avec le bord tranchant que je n'avais pas nommé :
 *
 *   > « Ton garde d'immobilité couvre EN TRAIN DE TAPER ; il ne couvre PAS a tapé la moitié
 *   > puis est parti. »
 *
 * C'est juste. Une demi-minute suffit contre quelqu'un dont les doigts sont sur le clavier ;
 * elle ne dit rien de quelqu'un qui s'est levé au milieu d'une phrase. Le geste étant
 * IRRÉVERSIBLE, le délai se compte en minutes, pas en secondes.
 *
 * Cinq minutes, et pas plus, parce que le mal qu'on soigne se compte lui aussi : les blocages
 * mesurés duraient ~40 minutes, pendant lesquelles PERSONNE ne pouvait joindre le destinataire.
 *
 * ⚠️ CE QUE LA MESURE DIT, ET CE QU'ELLE NE DIT PAS. Quatre blocages mesurés en une nuit sur la
 * boîte d'un orchestrateur : les quatre étaient des MESSAGES D'AGENT, zéro brouillon humain.
 * Quatre sur quatre du côté où ce délai parie — ce n'est pas la preuve que le cas humain
 * n'arrive jamais, et c'est pour ça que la garde reste, et qu'elle est large.
 */
export const IMMOBILITE_PAR_DEFAUT_MS = 5 * 60 * 1000;

/**
 * ⚠️ UNE BOÎTE DE SAISIE N'EST PAS UN DIALOGUE — et la touche d'envoi n'y fait pas la même chose
 * (relevé en REVUE DE FOND, bloquant, et il était juste).
 *
 * Devant une boîte, la touche d'envoi SOUMET un texte que quelqu'un a écrit. Devant un dialogue
 * de choix — « veux-tu que j'exécute cette commande ? » —, elle CONFIRME l'option par défaut.
 * Le défaut change alors de nature : ce n'est plus un message corrompu, c'est une ACTION
 * APPROUVÉE à l'insu de celui devant qui elle s'affiche. Rien dans ce module ne justifie ça.
 *
 * ⚠️ ET ON NE SAIT PAS RECONNAÎTRE TOUS LES DIALOGUES. Mesuré le 2026-08-17 : le sélecteur
 * `/model` rend une boîte ILLISIBLE, donc refusée — mais par accident, pas par conception ; et
 * un vrai dialogue de permission n'a pas pu être reproduit. **[non établi]** reste le mot juste.
 * Ne pas savoir reproduire un danger n'est pas la preuve qu'il n'existe pas : c'est le premier
 * piège de ce dépôt. La sonde est donc LARGE et son sens sûr est de S'ABSTENIR.
 *
 * Elle cherche ce qui trahit un choix, jamais ce qui trahit un message : des options numérotées,
 * et les formules d'un dialogue. Un compte rendu qui commencerait par « 1. » et parlerait de
 * confirmation serait refusé à tort — on aura perdu une livraison, pas approuvé une action.
 */
// La sonde elle-même vit désormais dans `ligne-directe/src/ecran.js` (T-20260817-0006) :
// `remettre()` en a besoin aussi, et `ligne-directe` ne peut pas importer d'ici. Elle est
// ré-exportée pour que rien de ce qui l'importait de ce module n'ait à changer d'adresse.
export { ressembleAUnChoix };

/**
 * Tenter de libérer une boîte encombrée — et rendre ce qu'on a constaté.
 *
 * Quatre issues, et chacune porte sur un état qui POUVAIT être différent :
 *   • `vide-cause-inconnue` — la boîte s'est vidée et ON NE SAIT PAS COMMENT : son auteur l'a
 *                       soumise (bénin, majoritaire), ou le texte a disparu sans être soumis
 *                       (perdu). On rend ce qu'on avait vu dans `texteDisparu` — c'est ce qui
 *                       rend la seconde issue réparable au lieu de la rendre muette ;
 *   • `bouge`         — le texte a changé : quelqu'un est devant ce pane, on n'y touche pas ;
 *   • `illisible`     — on ne soumet pas ce qu'on ne voit pas (même règle que la livraison) ;
 *   • soumis          — le texte était immobile, la touche d'envoi est partie, la boîte s'est
 *                       vidée. C'est la SEULE issue où l'on a posé un geste.
 *
 * ⚠️ « La boîte s'est vidée » est le seul témoin admis d'une soumission réussie, et il porte
 * bien : on l'a vue PLEINE juste avant. Le code de retour de la touche d'envoi ne prouve rien —
 * même règle que partout ici.
 *
 * L'I/O est injectée : cette fonction ne touche aucun processus enfant.
 */
export async function delivrerLaBoite({
  texteCoince,
  commandes,
  appelHerdr,
  lireEcran,
  dormir,
  vers = {},
  immobiliteMs,
  essais = 10,
  delaiMs = 500,
}) {
  // ON LAISSE AU TEXTE LE TEMPS DE BOUGER. C'est toute la garde : un brouillon vivant bouge,
  // un message coincé ne bouge pas. Sans cette attente, on ne distinguerait pas les deux.
  // ⚠️ ON REFUSE AVANT MÊME D'ATTENDRE si ce qu'on voit n'est pas une boîte de saisie ordinaire.
  // Attendre puis presser Entrée sur un dialogue serait le pire des deux mondes : le temps perdu
  // ET l'action approuvée.
  if (ressembleAUnChoix(texteCoince)) return { ok: false, cause: 'choix', soumis: false };

  await dormir(immobiliteMs);

  const ecran = await lireEcran(commandes.lireEcran, vers);
  // L'ÉCRAN, PAS SEULEMENT LA BOÎTE. Un modal connu peut s'afficher par-dessus un écran qui
  // porte une boîte parfaitement lisible — c'est exactement pour ça que `etatDeLEcran` cherche
  // un écran connu AVANT de conclure que la boîte est prête. Le refuser ici est le même
  // raisonnement, appliqué à un geste qui ne se défait pas.
  const etat = etatDeLEcran(ecran);
  if (!etat.pretARecevoir) return { ok: false, cause: 'ecran', soumis: false, resume: etat.resume, quoi: etat.quoi };

  // ⚠️ ET L'ÉCRAN PEUT ATTENDRE UN CHOIX SANS QUE `etatDeLEcran` LE SACHE (T-20260817-0008).
  //
  // `etatDeLEcran` ne connaît que DEUX écrans nommés — la confiance et les serveurs MCP. Devant
  // un dialogue de permission, il ne reconnaît rien, voit une boîte parfaitement lisible, et
  // conclut « prête à recevoir ». `ressembleAUnChoix`, plus haut, interroge le TEXTE COINCÉ : un
  // dialogue affiché au-dessus d'une boîte qui porte une phrase ordinaire lui échappe aussi.
  //
  // Entre les deux passait exactement le cas qui coûte le plus cher ici : la touche d'envoi sur
  // un dialogue, c'est-à-dire une action approuvée au nom de quelqu'un qui ne l'a pas demandée.
  if (ecranAttendUnChoix(ecran)) {
    return { ok: false, cause: 'dialogue', soumis: false, resume: resumeDeLEcran(String(ecran ?? '')) };
  }

  const apres = contenuBoite(ecran);
  if (apres === null) return { ok: false, cause: 'illisible', soumis: false };
  // ⚠️ UNE BOÎTE VUE VIDE A DEUX CAUSES, ET ON N'EN CONNAÎT AUCUNE (T-20260817-0090).
  //
  // Soit son auteur l'a soumise pendant qu'on attendait — bénin, et c'est le cas majoritaire.
  // Soit le texte a disparu SANS être soumis, et il est perdu : un texte non soumis n'existe
  // nulle part ailleurs, ni au ServiceDesk, ni dans un fil. L'effacer, c'est le perdre.
  //
  // Cette branche s'appelait `liberee-seule`. **Ce nom concluait** — « libérée seule » affirme
  // qu'un geste a eu lieu, alors qu'on n'a vu qu'une absence. C'était le seul endroit de cette
  // fonction où une absence était lue comme un succès ; partout ailleurs, ce qu'elle ne sait pas
  // expliquer devient un refus nommé.
  //
  // ⚠️ ON NE REFUSE PAS POUR AUTANT, et c'est délibéré : la cause bénigne est majoritaire.
  // Refuser ici refuserait à tort la quasi-totalité du trafic — une garde qui crie à tort se
  // fait retirer, et elle emporte ce qu'elle gardait. On rend donc `ok`, et on rend AUSSI ce
  // qu'on avait vu : c'est ce qui rend la perte réparable au lieu de la rendre muette.
  if (apres === '') return { ok: true, cause: 'vide-cause-inconnue', soumis: false, texteDisparu: texteCoince };
  if (apres !== texteCoince) return { ok: false, cause: 'bouge', soumis: false, texteVu: apres };
  // Et une seconde fois sur ce qu'on relit : le contenu a pu devenir un dialogue entre-temps.
  if (ressembleAUnChoix(apres)) return { ok: false, cause: 'choix', soumis: false };

  const envoi = await appelHerdr(commandes.soumettre, vers);
  for (let i = 0; i < Math.max(1, essais); i += 1) {
    const vu = await lireEcran(commandes.lireEcran, vers);
    if (boiteEstVide(vu)) return { ok: true, cause: 'soumis', soumis: true, texte: texteCoince };
    await dormir(delaiMs);
  }
  return { ok: false, cause: 'sans-effet', soumis: false, envoiAccepte: envoi.ok };
}

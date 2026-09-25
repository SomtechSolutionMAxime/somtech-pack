// saisie-de-lieu.js — ce que l'opérateur a tapé pour désigner un lieu EXISTANT, rendu comme le
// CODE du lieu (D-20260925-0002).
//
// ⚠️ CE FICHIER N'EST PAS `lieu-agent.js`, ET C'EST VOULU : les refus d'ici sont ceux de la
// NAISSANCE, pas de la POSE. `lieu-agent.js` porte la table des motifs que la compétence de pose
// enseigne (`cli/test/lib/competences-de-pose.js` en relève le CODE, ligne à ligne) ; y mettre
// des motifs de naissance ferait décrire à la compétence de pose des refus qu'elle ne rend jamais.

import { role as roleDe } from './roles.js';
import {
  messageLieuAmbigu, messageNomAmbigu, messageNomIntrouvable, resoudreLieuParCodeOuNom,
} from './lieu-nom.js';
import { nomInscritDansLeLieu, estUneRiviere } from './nom-de-riviere.js';

/**
 * Ce que l'opérateur a tapé pour désigner un lieu — un CODE de mandat ou un NOM de rivière —
 * rendu comme le CODE du lieu (D-20260925-0002). C'est la porte de la NAISSANCE ; la mise à
 * jour du CLI applique la même règle (`lieu-nom.js`).
 *
 * TROIS ISSUES, ET LA TROISIÈME EST CELLE QU'ON OUBLIE :
 *   • un lieu existe (par son code, sa casse, ou le `.nom-agent` qu'il porte) → `ok`, avec le
 *     DOSSIER retenu. Un code se rend TEL QUE TAPÉ : rien ne change pour qui le donnait déjà ;
 *   • deux lieux prétendent à la saisie → refus `ambigu`, qui les nomme ;
 *   • aucun lieu → cela dépend de CE QUE C'EST : un code neuf passe (c'est la première pose),
 *     mais une RIVIÈRE qu'aucun lieu ne porte est refusée `nom_introuvable`. Sans ce refus, la
 *     naissance PRENDRAIT UN NOM POUR UN CODE et poserait `.orchestrateur/saguenay/` — un lieu
 *     que rien ne relie à un chantier.
 *
 * Et les lieux illisibles ne bloquent PAS un code neuf : un `.nom-agent` qu'on n'a pas su lire
 * n'a rien à voir avec un code qui n'est pas une rivière. Ils ne comptent que lorsque la saisie
 * EST une rivière — là, on n'affirme pas qu'aucun lieu ne la porte, on dit qu'on n'a pas su lire.
 *
 * @returns {{ok: true, nom: string, source: 'code'|'nom', saisie: string, lieu?: string}
 *          | {ok: false, motif: 'ambigu'|'nom_introuvable', message: string, homonymes?: string[]}}
 */
export function resoudreLaSaisieDeLieu({ depot, role, saisie }) {
  const r = roleDe(role);
  const lieu = resoudreLieuParCodeOuNom(depot, r.dossier, saisie, nomInscritDansLeLieu);
  if (lieu.ambigu) {
    return {
      ok: false,
      motif: 'ambigu',
      homonymes: lieu.homonymes,
      message: lieu.source === 'nom'
        ? messageNomAmbigu(saisie, lieu.parent, lieu.homonymes)
        : messageLieuAmbigu(saisie, lieu.parent, lieu.homonymes),
    };
  }
  if (lieu.existe) {
    return lieu.source === 'nom'
      ? { ok: true, nom: lieu.nom, source: 'nom', saisie, lieu: lieu.racine }
      : { ok: true, nom: saisie, source: 'code', saisie, lieu: lieu.racine };
  }
  if (estUneRiviere(saisie)) {
    return {
      ok: false,
      motif: 'nom_introuvable',
      message: messageNomIntrouvable(saisie, lieu.parent, lieu.illisibles),
    };
  }
  return { ok: true, nom: saisie, source: 'code', saisie };
}

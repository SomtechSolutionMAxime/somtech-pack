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

import { contenuBoite, boiteEstVide, estUnEspaceReserve } from './boite.js';
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
 * LA FENÊTRE D'OBSERVATION D'UN TEXTE TAPÉ — dix secondes, et elle vaut pour TOUS les chemins.
 *
 * ⚠️ ELLE VIVAIT EN DEUX EXEMPLAIRES, ET ÇA A COÛTÉ LE JALON (T-20260818-0076). Elle a été
 * réglée à dix secondes dans `herdr.js` — le chemin de la parole du dirigeant — pendant que le
 * chemin de `livrer.js` gardait `IMMOBILITE_PAR_DEFAUT_MS` (cinq minutes). Le lot qui l'a posée
 * annonçait « 10 secondes » sans dire de quel chemin il parlait ; un coordonnateur a mesuré
 * l'autre, et a trouvé 300 secondes là où on lui promettait 10. Une constante par appelant, ce
 * sont deux comportements dont un seul est annoncé.
 *
 * POURQUOI DIX. Assez pour voir des doigts sur un clavier — quelqu'un qui écrit fait bouger sa
 * boîte bien avant. Pas assez pour faire attendre celui qui parle : au bout de cinq minutes,
 * l'émetteur a conclu à une panne, et il a raison de le faire.
 *
 * ⚠️ CE QUE ÇA COÛTE, ET IL FAUT LE REDIRE ICI. Une fenêtre courte soumet plus souvent la phrase
 * de quelqu'un qui a tapé la moitié puis s'est levé — c'est exactement ce que les cinq minutes
 * achetaient. L'arbitrage a été pris les yeux ouverts sur la ligne du dirigeant, et ce qui le
 * rend tenable est `avisDeBoiteBloquee` : le destinataire apprend, dans le message même, ce qui
 * est parti sous sa signature. Ce chemin-ci porte le même avis — c'est la condition qui permet
 * d'y étendre le même arbitrage, et pas une commodité.
 */
export const FENETRE_TEXTE_TAPE_MS = 10_000;

/**
 * COMBIEN DE TEMPS OBSERVER CE TEXTE-LÀ — la nature du texte décide, jamais l'appelant.
 *
 * ⚠️ UN TEXTE COLLÉ N'A PERSONNE DERRIÈRE LUI. Il est arrivé d'un seul coup : il n'y a aucun
 * geste en cours à respecter, donc rien à observer, donc zéro. Attendre devant lui, c'est
 * attendre un mouvement qui ne peut pas venir. Un texte TAPÉ, lui, peut avoir des doigts
 * dessus — il garde sa fenêtre.
 *
 * ⚠️ ZÉRO N'EST PAS « SANS GARDE ». `delivrerLaBoite` relit dans les deux cas avant de
 * soumettre et s'abstient si le contenu a bougé, si l'écran porte un choix, s'il est illisible.
 * La fenêtre ne fait que donner de quoi voir ; elle n'est pas la garde elle-même.
 *
 * ⚠️ ET ELLE NE DÉCIDE PAS DE L'ARMEMENT. Un appelant qui ne veut PAS de délivrance du tout —
 * le brief de naissance — le dit en n'armant pas le geste, jamais en réglant cette durée.
 */
export function fenetreDImmobilite(texteCoince, { texteTapeMs = FENETRE_TEXTE_TAPE_MS } = {}) {
  return estUnEspaceReserve(texteCoince) ? 0 : texteTapeMs;
}

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

// ═══════════════════════════════════════════════════════════════════════════════════════
// LES MOTS QUI ACCOMPAGNENT LE GESTE — et ils descendent ICI pour la même raison que lui.
//
// ⚠️ RELEVÉ EN PASSE DE REVUE DE FOND, BLOQUANT, ET LE REJET ÉTAIT JUSTE (T-20260818-0049).
// `delivrerLaBoite` — le GESTE — avait déménagé ; `avisDeBoiteBloquee` et `avisDeBoiteVidee`
// — LE MOT qui dit au destinataire ce qui est parti en son nom — étaient restés dans
// `livraison.js`, donc hors d'atteinte du nouvel appelant (le sens de dépendance est unique).
//
// Le geste sans le mot rouvre exactement ce que le mot existait pour fermer : le destinataire
// voit un travail partir de chez lui sans pouvoir dire lequel. « La différence entre un
// incident CONSTATABLE et un incident INEXPLICABLE » — c'est écrit dans le commentaire de
// conception d'origine, et on venait de le réintroduire sur le chemin qu'on répare.
//
// C'EST LE MÊME MOTIF QUE LE DÉFAUT D'ORIGINE DE CE LOT, commis dans son correctif : une
// moitié déplacée, l'autre laissée. Deux fois dans le même module, en une matinée.

/**
 * L'AVIS AU DESTINATAIRE — la seule façon dont il peut apprendre que sa boîte a bloqué.
 *
 * Il est le point aveugle du défaut : une boîte pleine ne se signale pas. Cet avis voyage par
 * le chemin qu'on vient de libérer, donc SANS nouveau transport à maintenir — et il n'existe
 * que quand quelque chose a réellement eu lieu. Une livraison ordinaire ne porte pas un mot de
 * plus : on n'annonce jamais un incident qui n'a pas eu lieu.
 *
 * ⚠️ CE N'EST PAS UNE FUSION. Le texte ajouté est le NÔTRE, pas celui d'un tiers, et il est
 * séparé du message par une ligne vide et une marque. La fusion que ce module interdit, c'est
 * deux messages d'auteurs différents collés en un — ici l'auteur est l'émetteur, qui parle en
 * son nom de ce qu'il a trouvé.
 */
export function avisDeBoiteBloquee({ texteLibere = '', immobiliteMs = 0 } = {}) {
  // ⚠️ LE TEXTE EN ENTIER, JAMAIS UN APERÇU — exigé par l'orchestrateur en approuvant la
  // conception, et il a raison : « sans ça le destinataire voit un travail partir de chez lui
  // sans pouvoir dire lequel. C'est la différence entre un incident CONSTATABLE et un incident
  // INEXPLICABLE. » Un aperçu tronqué à 120 caractères — ce qu'était la première écriture —
  // rendait précisément l'incident inexplicable.
  //
  // ⚠️ ET IL FAUT DIRE CE QU'ON N'A PAS VU : la lecture d'une boîte ne rend que sa portion
  // VISIBLE à l'écran (mesuré — un texte long y est tronqué par le défilement). Ce qu'on
  // recopie ici est donc ce qu'on a lu, pas nécessairement tout ce qui est parti.
  const texte = String(texteLibere).trim();
  // ⚠️ UNE DURÉE ARRONDIE À LA MINUTE NE SAIT PAS DIRE DIX SECONDES (T-20260818-0076). Cet avis
  // a été écrit quand la seule fenêtre existante valait cinq minutes ; depuis que la fenêtre
  // d'un texte tapé vaut dix secondes et celle d'un collage zéro, `Math.round(ms / 60000)`
  // rendait « les 0 min où je l'ai observée » — une phrase qui dit à celui qui vient de perdre
  // un texte qu'on ne l'a pas regardé. Le chemin de la parole du dirigeant la produisait déjà.
  const observation = (ms) => {
    if (!(Number(ms) > 0)) {
      // ZÉRO N'EST PAS UNE OBSERVATION RATÉE, C'EST UN COLLAGE. Rien à observer : le texte est
      // arrivé d'un seul coup, personne n'avait les doigts dessus. Le dire vaut mieux que
      // laisser croire qu'on a soumis sans regarder.
      return 'sans que j’aie eu à l’observer — il y était arrivé d’un seul coup, collé, et non tapé';
    }
    const secondes = Math.round(Number(ms) / 1000);
    return secondes < 60
      ? `resté immobile pendant les ${secondes} s où je l’ai observée`
      : `resté immobile pendant les ${Math.round(Number(ms) / 60000)} min où je l’ai observée`;
  };
  const ouverture =
    '⚠️ TA BOÎTE DE SAISIE ÉTAIT BLOQUÉE — elle contenait un texte non soumis, ' +
    `${observation(immobiliteMs)}. Je l’ai SOUMIS pour ` +
    'son auteur — sans y écrire un caractère — puis j’ai livré mon message. Tu vas donc recevoir ' +
    'les deux.\n\n';

  // ⚠️ CE QU'ON A LU N'EST PARFOIS PAS LE TEXTE (T-20260817-0091) — et le citer comme s'il
  // l'était engage une signature sans dire sur quoi. Le 2026-08-17, un coordonnateur a reçu
  // « VOICI CE QUI A ÉTÉ SOUMIS EN TON NOM : [Pasted text #6] ». Il ne sait toujours pas ce qui
  // est parti sous son nom.
  //
  // ⚠️ ON NE REND PAS L'AVIS PLUS RASSURANT, ON LE REND PLUS INFORMATIF. Un avis qui cite un
  // espace réservé sans dire qu'il ne sait pas lire est PIRE qu'un avis qui l'avoue : la
  // franchise de la phrase ci-dessous est ce qui a rendu ce défaut visible au lieu de le
  // laisser silencieux, et elle est gardée sur LES DEUX chemins.
  if (estUnEspaceReserve(texte)) {
    return (
      ouverture +
      'QUELQUE CHOSE EST DONC PARTI EN TON NOM, ET JE NE PEUX PAS TE DIRE QUOI (tel que je l’ai ' +
      'lu à l’écran, qui n’en montre que la partie visible) : ce que j’y ai trouvé n’est pas le ' +
      `texte, c’est l’ESPACE RÉSERVÉ ` +
      `que l’écran met à sa place quand on l’y a collé — ici, ${texte}. **JE NE SAIS PAS** ce ` +
      'qu’il contenait, ni combien il faisait. Je ne l’ai jamais lu.\n\n' +
      // ⚠️ CE QUI SUIT EST MESURÉ, PAS ESPÉRÉ. Un témoin de 924 caractères, collé donc replié à
      // l'écran, a été soumis ici ; interrogé sur le tour qu'il avait reçu AVANT cet avis, le
      // destinataire en a restitué le dernier mot. Il l'avait reçu entier. L'outil ne sait pas
      // lire ce texte — le destinataire, lui, l'a.
      'MAIS TOI, TU L’AS : il a été soumis, donc il t’est parvenu ENTIER. C’est le message que ' +
      'tu as reçu **JUSTE AVANT** celui-ci. Va le relire — c’est lui qui est parti sous ta ' +
      'signature, et c’est le seul endroit où il existe encore.\n\n' +
      'Tant qu’une boîte reste pleine, PERSONNE ne peut te joindre et rien ne te le dit.'
    );
  }

  return (
    ouverture +
    `VOICI CE QUI A ÉTÉ SOUMIS EN TON NOM (tel que je l’ai lu à l’écran, qui n’en montre que la partie visible) :\n` +
    `┈┈┈\n${texte}\n┈┈┈\n\n` +
    'Si c’était un brouillon à toi, il vient de partir tel quel — et tu sais maintenant lequel. ' +
    'Tant qu’une boîte reste pleine, PERSONNE ne peut te joindre et rien ne te le dit.'
  );
}

/**
 * Ce qu'on dit au destinataire quand sa boîte s'est VIDÉE pendant qu'on attendait (T-20260817-0090).
 *
 * ⚠️ CE N'EST PAS L'AVIS DE LA BOÎTE BLOQUÉE, et la différence est tout le sujet : là-bas on a
 * POSÉ un geste (la touche d'envoi) et on l'annonce ; ici on n'a RIEN fait, et on ne sait même
 * pas ce qui s'est passé. L'avis dit donc ce qu'on a vu, jamais ce qu'on en déduit — un avis qui
 * conclut ferme la question au lieu de l'ouvrir.
 *
 * ⚠️ ET IL PART DANS LE MESSAGE, PAS DANS UN CHAMP. Un champ de plus est un champ qu'il faut
 * PENSER à lire — c'est déjà le défaut de `attendu`, et ce chantier a mesuré neuf fois qu'une
 * discipline écrite ne mord pas. Collé au message livré, le destinataire ne peut pas ne pas le voir.
 */
export function avisDeBoiteVidee({ texteDisparu = '' } = {}) {
  // LE TEXTE EN ENTIER, JAMAIS TRONQUÉ — c'est le seul point qui rend la perte réparable. Le
  // 2026-08-17, un ordre du CTO n'a survécu que parce qu'un tiers l'avait lu à l'écran avant
  // d'envoyer : sans le texte ici, il n'y a rien à recopier.
  const texte = String(texteDisparu).trim();

  // ⚠️ MÊME AVEU QUE POUR LA BOÎTE BLOQUÉE, MAIS SURTOUT PAS LA MÊME SUITE (T-20260817-0091).
  //
  // Là-bas, le texte A ÉTÉ SOUMIS : il est parvenu entier au destinataire, et on peut lui dire
  // d'aller le relire. ICI, ON N'A RIEN SOUMIS. Le texte n'est donc nulle part en aval, et lui
  // promettre par symétrie qu'il le retrouvera dans son tour précédent l'enverrait chercher ce
  // qui n'existe pas — un avis qui rassure à tort, exactement ce qu'on nous interdit.
  //
  // Sur ce chemin, la vérité est plus dure et se dit telle quelle : le texte est hors d'atteinte.
  if (estUnEspaceReserve(texte)) {
    return (
      '⚠️ TA BOÎTE DE SAISIE PORTAIT UN TEXTE, ET ELLE S’EST VIDÉE pendant que je l’observais — ' +
      '**sans que je touche à quoi que ce soit**. Deux causes possibles, et je ne peux pas les ' +
      'distinguer : tu l’as soumis toi-même, ou il a disparu sans être soumis.\n\n' +
      'ET JE NE PEUX PAS TE DIRE CE QUE C’ÉTAIT : ce que j’avais lu à l’écran n’est pas le texte, ' +
      `c’est l’ESPACE RÉSERVÉ que l’écran met à sa place quand on l’y a collé — ici, ${texte}. ` +
      '**JE NE SAIS PAS** ce qu’il contenait, ni combien il faisait.\n\n' +
      '⚠️ Et je ne peux pas te dire non plus où le retrouver : **je n’ai rien soumis**, donc il ' +
      'n’est parti nulle part. S’il a disparu sans que tu l’aies soumis toi-même, il est **perdu** ' +
      '— je n’ai aucun moyen de te le rendre, et je préfère te le dire que te laisser chercher.'
    );
  }

  return (
    '⚠️ TA BOÎTE DE SAISIE PORTAIT UN TEXTE, ET ELLE S’EST VIDÉE pendant que je l’observais — ' +
    '**sans que je touche à quoi que ce soit**. Deux causes possibles, et je ne peux pas les ' +
    'distinguer : tu l’as soumis toi-même, ou il a disparu sans être soumis. Dans le second cas ' +
    'il n’existe nulle part ailleurs.\n\n' +
    'VOICI CE QUE J’Y AVAIS LU (la portion visible à l’écran) :\n' +
    `┈┈┈\n${texte}\n┈┈┈\n\n` +
    'Si tu ne l’as pas soumis toi-même, **il est perdu — recopie-le depuis ici**. Je n’ai rien ' +
    'soumis en ton nom et je n’affirme pas savoir ce qui est arrivé.'
  );
}

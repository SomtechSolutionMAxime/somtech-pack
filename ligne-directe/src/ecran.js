// ecran.js — NOMMER CE QU'ON A DEVANT SOI, ou avouer qu'on ne le reconnaît pas (T-20260816-0033).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE
//
// Ce dépôt savait déjà lire une BOÎTE DE SAISIE (`boite.js`). Il ne savait pas lire un ÉCRAN.
// La différence a coûté trois agents en une journée :
//
//   • deux agents avalés par un écran de configuration, dont un a passé 36 minutes dessus
//     pendant que le dirigeant regardait une maquette périmée (T-20260815-0014) ;
//   • un agent parqué dans une revue plein cadre, à la fois immobile ET injoignable, parce que
//     le refus de remise — juste — ne disait pas CE QU'IL Y AVAIT à l'écran (T-20260816-0001) ;
//   • et la session du chef d'équipe qui écrit ces lignes, figée plus d'une heure sans que rien
//     ne le signale. C'est une ronde qui l'a découverte, pas le dispositif.
//
// MESURÉ le 2026-08-16 sur Claude Code 2.1.233, et c'est le fait qui commande tout ce module :
// `herdr agent start` rend `agent_status: idle` ET `interactive_ready: true` PENDANT que l'agent
// est parqué derrière un modal. La disponibilité que herdr annonce est un INDICE, pas le FAIT.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// L'INVARIANT — « une porte sur deux », la dixième fois
//
//   On vérifie le FAIT, jamais l'INDICE.
//   Devant un état qu'on ne reconnaît pas, on S'ARRÊTE et on le NOMME, avec le geste qui le lève.
//
// Deux conséquences que tout ce fichier applique, et dont aucune n'est négociable :
//
//   1. L'INCONNU N'EST JAMAIS « PRÊT ». Un écran qu'on ne reconnaît pas, un écran illisible, une
//      lecture ratée : tous rendent « pas prêt ». L'absence de mesure n'est pas une bonne
//      nouvelle — c'est le raisonnement exact qui a produit `aFichierEnvironnement` et le verrou
//      de sas, et il se réintroduit par la porte du confort à chaque fois.
//
//   2. ON N'INVENTE JAMAIS DE GESTE. Un écran nommé porte le geste qui le lève, parce qu'on l'a
//      vérifié. Un écran inconnu n'en porte AUCUN — il rend ce qu'il a vu, et il se tait sur la
//      suite. Un mauvais conseil se croit ; un aveu d'ignorance se vérifie. Le refus qui disait
//      « désigne-le par son pane » à celui qui venait d'échouer par son pane est le rappel qu'un
//      conseil faux coûte plus cher que pas de conseil du tout (T-20260816-0002).

/**
 * ⚠️ LA SONDE DE FILET ET L'INVITE VIENNENT DE `boite.js` — ELLES NE SE REDÉFINISSENT PAS ICI
 * (T-20260821-0027).
 *
 * 🔴 CE FICHIER EN PORTAIT SA PROPRE COPIE, sous le commentaire « même sonde que `boite.js` ».
 * Elles l'étaient — jusqu'au jour où l'une a été corrigée. Le 2026-08-21, `boite.js` a appris à
 * reconnaître un filet TITRÉ (une session rattachée affiche le nom de son chantier dans sa
 * bordure haute) ; cette copie-ci ne l'a pas appris, et le veilleur est resté aveugle sur
 * l'écran de `bonaventure` — **c'est-à-dire sur le chemin par lequel arrive la parole du
 * dirigeant**, celui qui a motivé tout le chantier.
 *
 * **Une copie n'hérite jamais des corrections de l'autre, et on ne s'en aperçoit qu'au prochain
 * incident.** C'est « une porte sur deux », commis dans le correctif d'un défaut de cette
 * famille. Un essai le garde désormais par recherche : `les-trois-canaux-jugent-le-meme-ecran`.
 */
import { sansGris, estUnFilet, INVITE, contenuBoite } from './boite.js';

/**
 * LES ÉCRANS QU'ON SAIT NOMMER — et rien de plus.
 *
 * ⚠️ CHAQUE ENTRÉE PORTE UN GESTE, et c'est gardé par un essai. Nommer un écran sans dire quoi
 * faire laisse le lecteur aussi bloqué qu'avant : on aurait remplacé « il est bloqué » par « il
 * est bloqué sur l'écran X », ce qui n'a jamais débloqué personne.
 *
 * ⚠️ LES SONDES DOIVENT ÊTRE DISJOINTES, et c'est gardé aussi. Une sonde trop large ferait
 * nommer un écran pour un autre, donc proposer le mauvais geste — pire que l'aveu d'ignorance.
 *
 * Les motifs sont recopiés d'écrans RÉELLEMENT mesurés, jamais écrits de mémoire.
 */
export const ECRANS_CONNUS = [
  {
    cle: 'confiance',
    sonde: /Is this a project you created or one you trust\?/i,
    quoi: 'Claude Code demande si le dossier est de confiance',
    geste:
      'pré-approuve le lieu avant de faire naître — `approuverLieu(<lieu>)` écrit la confiance et ' +
      'les serveurs dans ~/.claude.json ; et vérifie que le fichier de droits du lieu ne porte pas ' +
      'de bloc `permissions.allow`, qui déclenche cet écran même une fois la confiance accordée ' +
      '(mesuré sur Claude Code 2.1.233).',
  },
  {
    cle: 'serveurs-mcp',
    sonde: /new MCP servers found in this project/i,
    quoi: 'Claude Code demande quels serveurs MCP activer',
    // ⚠️ LE SEUL ÉCRAN QU'ON FRANCHIT, ET LA DISTINCTION EST TOUT LE SUJET.
    //
    // Franchir n'est pas deviner. On ne le fait QUE sur un écran reconnu par son texte, avec un
    // geste MESURÉ (2026-08-16 : `enter` confirme les serveurs déjà cochés — mais il faut lui
    // laisser un instant, et c'est ce délai manquant qui avait fait conclure à tort que la
    // touche ne marchait pas, T-20260815-0014), et on RELIT ensuite pour vérifier que ça a pris.
    // Sans la relecture, ce serait un pari ; avec elle, c'est un fait.
    //
    // ⚠️ ET SÛREMENT PAS `esc`. L'écran propose « Esc to reject all » : ce serait faire naître
    // l'agent SANS son registre — muet sur le chantier qu'il vient d'ouvrir. Un franchissement
    // qui coûte à l'agent ce pour quoi il naît n'est pas un franchissement, c'est un abandon.
    touches: ['enter'],
    geste:
      'pré-approuve le lieu avec le jeu de clés COMPLET d\'une entrée de projet — `enabledMcpjsonServers` ' +
      'seul ne suffit plus : il lui faut au moins `disabledMcpjsonServers`, `allowedTools`, ' +
      '`projectOnboardingSeenCount` et les deux clés d\'inclusions externes (mesuré sur 2.1.233).',
  },
];

/**
 * LE TEXTE HORS DE LA BOÎTE DE SAISIE.
 *
 * ⚠️ SANS CETTE SOUSTRACTION, LE MODULE SE DÉCLENCHE SUR SON PROPRE SUJET. Les briefs de ce
 * dépôt CITENT ces écrans — celui qui a produit ce fichier en citait deux. Sonder le dump entier
 * ferait donc passer pour parqué tout agent à qui on parle de ces défauts, et le dispositif
 * censé rendre les blocages visibles fabriquerait des blocages imaginaires.
 *
 * On retire donc l'intérieur du dernier couple de filets — c'est-à-dire ce que l'utilisateur est
 * en train d'écrire — et on ne sonde que ce que la session AFFICHE.
 */
function horsBoite(lignes) {
  const filets = [];
  for (let i = 0; i < lignes.length; i += 1) if (estUnFilet(lignes[i])) filets.push(i);
  if (filets.length < 2) return { texte: lignes.join('\n'), boiteLisible: false };

  const bas = filets[filets.length - 1];
  const haut = filets[filets.length - 2];
  const dedans = lignes.slice(haut + 1, bas);
  // Une boîte ne se reconnaît qu'à son invite : deux filets qui encadrent autre chose ne sont
  // pas une boîte, et retirer leur contenu aveuglerait la sonde sur un écran quelconque.
  const boiteLisible = dedans.length > 0 && dedans[0].includes(INVITE);
  if (!boiteLisible) return { texte: lignes.join('\n'), boiteLisible: false };

  return { texte: [...lignes.slice(0, haut + 1), ...lignes.slice(bas)].join('\n'), boiteLisible: true };
}

/** Combien de lignes du bas on garde pour dire ce qu'on a vu. Un résumé, pas un dump. */
const LIGNES_DU_RESUME = 6;
const RESUME_MAX = 600;

/**
 * CE QU'ON A VU, quand on n'a pas su le nommer.
 *
 * On garde les dernières lignes porteuses : un modal s'affiche EN BAS de l'écran, et c'est la
 * partie que quelqu'un pourra reconnaître d'un coup d'œil. Les filets et le vide sont jetés —
 * ils ne disent rien et prendraient toute la place.
 *
 * ⚠️ EXPORTÉE DEPUIS T-20260817-0008, et c'est le même raisonnement qu'`ecranAttendUnChoix` :
 * le refus posé devant un dialogue doit MONTRER ce qu'il a vu, sinon il nomme un blocage sans
 * donner de quoi le reconnaître. La recopier dans `livraison.js` aurait fait une porte de plus.
 */
export function resumeDeLEcran(texte) {
  // ⚠️ ELLE NETTOIE ELLE-MÊME (T-20260817-0008). Elle n'était appelée que depuis `etatDeLEcran`,
  // qui lui passait du texte déjà dégrisé — un contrat TACITE, invisible à la lecture. Le premier
  // appelant du dehors a rendu un refus truffé de séquences ANSI, illisible pour celui à qui il
  // s'adresse. `sansGris` est idempotente : l'appelant d'origine ne change pas de comportement.
  const lignes = sansGris(texte)
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() && !estUnFilet(l));
  if (!lignes.length) return null;
  const resume = lignes.slice(-LIGNES_DU_RESUME).join('\n').trim();
  return resume.length > RESUME_MAX ? `${resume.slice(0, RESUME_MAX - 1)}…` : resume;
}

/**
 * L'ÉTAT D'UN ÉCRAN — le verdict, et il ne ment dans aucun des deux sens.
 *
 * @param {string|null|undefined} texteTerminal ce que `herdr agent read` a rendu
 * @returns {{pretARecevoir: boolean, ecran: string|null, quoi: string|null, inconnu: boolean,
 *            resume: string|null, geste: string|null}}
 *
 * L'ORDRE DE DÉCISION EST LE CŒUR, et il est gardé par un essai adversarial : on cherche un écran
 * CONNU avant de conclure que la boîte est prête. Chercher la boîte d'abord ferait passer pour
 * joignable un agent dont le modal est affiché PAR-DESSUS un écran qui en porte une — c'est-à-dire
 * la porte-sur-deux, réintroduite dans le module écrit pour la fermer.
 */
export function etatDeLEcran(texteTerminal) {
  const brut = sansGris(texteTerminal);

  // Rien à lire n'est pas « rien à signaler ». On n'a pas mesuré, donc on ne conclut pas —
  // et le sens sûr est celui qui fait s'arrêter.
  if (!brut || !brut.trim()) {
    return {
      pretARecevoir: false,
      ecran: null,
      quoi: null,
      inconnu: true,
      resume: '(écran illisible — rien n’a pu être lu)',
      geste: null,
    };
  }

  const { texte: affiche, boiteLisible } = horsBoite(brut.split('\n'));

  for (const ec of ECRANS_CONNUS) {
    if (ec.sonde.test(affiche)) {
      return {
        pretARecevoir: false,
        ecran: ec.cle,
        quoi: ec.quoi,
        inconnu: false,
        resume: resumeDeLEcran(affiche),
        geste: ec.geste,
      };
    }
  }

  if (boiteLisible) {
    return { pretARecevoir: true, ecran: null, quoi: null, inconnu: false, resume: null, geste: null };
  }

  // Aucun écran connu, et pas de boîte reconnaissable : on ne sait pas où on est. On le dit, on
  // montre ce qu'on a vu, et on ne propose RIEN — inventer un geste ici serait deviner.
  return {
    pretARecevoir: false,
    ecran: null,
    quoi: null,
    inconnu: true,
    resume: resumeDeLEcran(affiche),
    geste: null,
  };
}

/**
 * LA PHRASE À DIRE quand on refuse à cause d'un écran — un seul endroit qui la compose.
 *
 * Elle existe parce que le refus doit NOMMER : « statut blocked » sans dire ce qu'il y a devant
 * est exactement ce qui a laissé un agent parqué et injoignable pendant qu'on cherchait pourquoi.
 */
/**
 * ⚠️ UNE BOÎTE DE SAISIE N'EST PAS UN DIALOGUE — et la touche d'envoi n'y fait pas la même chose.
 *
 * Devant une boîte, la touche d'envoi SOUMET un texte que quelqu'un a écrit. Devant un dialogue
 * de choix — « veux-tu que j'exécute cette commande ? » —, elle CONFIRME l'option par défaut.
 * Le défaut change alors de nature : ce n'est plus un message corrompu, c'est une ACTION
 * APPROUVÉE à l'insu de celui devant qui elle s'affiche.
 *
 * ⚠️ ON NE SAIT PAS RECONNAÎTRE TOUS LES DIALOGUES. Le sélecteur `/model` rend une boîte
 * ILLISIBLE, donc refusée — mais par accident, pas par conception. **[non établi]** reste le mot
 * juste. Ne pas savoir reproduire un danger n'est pas la preuve qu'il n'existe pas : c'est le
 * premier piège de ce dépôt. La sonde est donc LARGE et son sens sûr est de S'ABSTENIR.
 *
 * Elle cherche ce qui trahit un choix, jamais ce qui trahit un message : des options numérotées,
 * et les formules d'un dialogue. Un compte rendu qui commencerait par « 1. » et parlerait de
 * confirmation serait refusé à tort — on aura perdu une livraison, pas approuvé une action.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ELLE A ÉTÉ ÉCRITE DANS `naissance-representant/src/livraison.js` (T-20260816-0114), ET ELLE
 * EST DESCENDUE ICI (T-20260817-0006) — parce que `ligne-directe/src/herdr.js` en a besoin lui
 * aussi, et que `ligne-directe` ne peut pas importer de `naissance-representant` (le sens de la
 * dépendance est unique, et ce module s'installe seul). La recopier aurait fait une porte de
 * plus ; sa place est ici, avec les autres sondes d'écran. `livraison.js` l'importe désormais
 * de ce fichier — un exemplaire, pas deux.
 *
 * ⚠️ CE QUI A CHANGÉ DEPUIS, ET QUI N'EST PLUS UNE HYPOTHÈSE : un vrai dialogue de permission
 * A été observé le 2026-08-17, sur un pane où un message fusionné venait de partir — l'écran
 * portait `Do you want to proceed? ❯ 1. Yes`. Le danger que cette sonde couvre est mesuré.
 */
const MARQUES_DE_CHOIX = [
  /(?:^|\n)\s*(?:❯\s*)?[1-9]\.\s+\S/,
  /\b(?:enter|entrée)\b[^\n]{0,20}\b(?:to )?confirm/i,
  /\besc\b[^\n]{0,20}\b(?:to )?cancel/i,
  /\(y\/n\)/i,
  /\bdo you want to\b/i,
];

export function ressembleAUnChoix(texte) {
  const t = String(texte ?? '');
  return MARQUES_DE_CHOIX.some((m) => m.test(t));
}

/**
 * UN ÉCRAN ENTIER ATTEND-IL UN CHOIX ? — la même question, posée à l'écran et non à la boîte.
 *
 * ⚠️ POURQUOI CE N'EST PAS `ressembleAUnChoix` APPLIQUÉE À L'ÉCRAN. Celle-ci est volontairement
 * LARGE parce qu'elle interroge le contenu de la BOÎTE DE SAISIE, où une option numérotée n'a
 * rien à faire. Sur un écran entier, la même largeur devient ruineuse : **mesuré le 2026-08-17
 * sur 14 panes réels de ce poste, 3 étaient déclarés « en attente de choix » à tort — 21 %.**
 * Tous les trois pour la même raison : la sortie ordinaire de leur agent contenait une liste
 * numérotée (« \n  1. … »). Ils étaient `idle`, boîte prête, parfaitement joignables.
 *
 * Une garde qui refuserait un agent sur cinq rendrait la ligne du dirigeant inutilisable — soit
 * une panne PIRE, en fréquence, que celle qu'on ferme. Le sens sûr d'un geste irréversible reste
 * l'abstention, mais l'abstention ne doit pas se déclencher sur du bruit : elle cesserait d'être
 * lue, ce qui est la façon dont une garde meurt.
 *
 * On exige donc un signal de dialogue ACTIF, pas la simple présence d'une liste :
 *
 *   • le CURSEUR DE SÉLECTION posé sur une option numérotée (« ❯ 1. Yes ») — c'est ce qui
 *     distingue un choix qu'on attend d'une liste qu'on lit ; ou
 *   • une FORMULE D'INVITE explicite (« Do you want to… », « (y/n) », « Esc to cancel »,
 *     « Enter to confirm ») — des tournures qu'une prose ordinaire n'emploie pas.
 *
 * Les trois faux positifs mesurés disparaissent avec ce resserrement, et le vrai dialogue de
 * permission — celui qui a fait exécuter une commande le 2026-08-17 — continue d'être reconnu.
 */
const MARQUES_DE_DIALOGUE_ACTIF = [
  /❯\s*[1-9]\.\s/,
  /\b(?:enter|entrée)\b[^\n]{0,20}\b(?:to )?confirm/i,
  /\(y\/n\)/i,
  /\bdo you want to\b/i,
];

/**
 * LA CINQUIÈME MARQUE, ET POURQUOI ELLE NE DÉCIDE PLUS SEULE — T-20260825-0073.
 *
 * ⚠️ ELLE A RENDU UN AGENT INJOIGNABLE ET BLOQUÉ LA REMISE D'UN RAPPORT. Le 2026-08-25,
 * `livrer.js` a refusé d'écrire à un coordonnateur `idle`, boîte vide, en affirmant qu'il était
 * « devant un DIALOGUE qui attend un choix ». Le refus renvoyait vers un geste humain devant un
 * dialogue qui n'existait pas. Ce qui mordait : la ligne de transcript
 * « ⏺ Usage limit reached · continuing automatically at 1:10pm · esc or type to cancel ».
 *
 * ⚠️ DEUX EXPLICATIONS PLAUSIBLES ONT ÉTÉ ÉCARTÉES PAR LA MESURE, et il faut les laisser
 * écartées ici, sinon on les réessaiera.
 *   1. « Elle lit le scrollback au lieu de l'écran courant. » Mesuré sur les 85 panes réels du
 *      poste : elle mord sur 4 panes avec `--source visible` **exactement comme** avec
 *      `--source recent`. La ligne est bel et bien à l'écran courant — ligne 26, 43, 44 ou 54
 *      d'un écran de 79. Restreindre la source ne répare rien.
 *   2. « Le remplissage de la regex est trop lâche : exigeons `esc to cancel` collé. » Mesuré
 *      sur 87 panes : les DEUX tournures vivent sur le bandeau bénin — « esc or type to cancel »
 *      ET « esc to cancel », cette dernière au mot près celle du vrai dialogue. La tournure ne
 *      discrimine rien.
 *
 * ⚠️ CE QUI DISCRIMINE, MESURÉ DES DEUX CÔTÉS : **un vrai dialogue REMPLACE la boîte de
 * saisie ; un bandeau la laisse en place.** Le vrai dialogue de permission du 2026-08-17 rend
 * une boîte `illisible` — il n'y a plus de boîte, il a pris sa place. Les 8 panes réels où la
 * garde mordait le 2026-08-25 rendaient tous une boîte `vide` — 8 sur 8. C'est précisément ce
 * que `etat-boite.js` disait déjà, le jour même du faux refus, pendant que ce chemin-ci disait
 * le contraire : le dispositif détenait la réponse, elle n'était pas branchée ici.
 *
 * Elle n'est donc pas RETIRÉE — un écran qui ne porte que « Esc to cancel · Tab to amend »
 * reste un dialogue, et le retirer ouvrirait le faux négatif symétrique : écrire un message
 * ordinaire devant un dialogue CONFIRME l'option affichée et lance l'action. Elle devient
 * CORROBORANTE : elle ne compte que là où aucune boîte ordinaire n'est rendue.
 *
 * ⚠️ ET LES QUATRE AUTRES GARDENT LEUR POUVOIR DE DÉCIDER SEULES. Sur les mêmes 87 panes, elles
 * n'ont produit AUCUN faux positif — zéro. Les rendre conditionnelles elles aussi ouvrirait des
 * faux négatifs sur des marques qui n'ont jamais fauté : un correctif qui coûterait plus qu'il
 * ne rapporte.
 */
const MARQUE_CORROBORANTE = /\besc\b[^\n]{0,20}\b(?:to )?cancel/i;

export function ecranAttendUnChoix(texteTerminal) {
  const t = sansGris(texteTerminal);
  if (!t) return false;
  if (MARQUES_DE_DIALOGUE_ACTIF.some((m) => m.test(t))) return true;
  if (!MARQUE_CORROBORANTE.test(t)) return false;
  // ⚠️ ON LUI PASSE LE TEXTE BRUT PARCE QU'ELLE FAIT SON PROPRE DÉGRISAGE : `contenuBoite`
  // ouvre par `sansGris(texteTerminal)` (boite.js). Lui donner `t`, déjà dégrisé, est
  // AUJOURD'HUI un no-op — `sansGris` est idempotente, une seconde passe ne trouve plus de
  // séquence à retirer. Une passe de fond l'a mesuré en appliquant la mutation : elle survit,
  // et c'est un mutant ÉQUIVALENT, pas une garde manquante.
  //
  // ⚠️ CE COMMENTAIRE A AFFIRMÉ LE CONTRAIRE, ET C'ÉTAIT FAUX. Il disait que passer `t`
  // « rendrait `null` sur tous les écrans » — une conséquence qui ne se produit pas avec
  // l'implémentation actuelle. On ne garde pas une prose invérifiée à côté d'une garde : le
  // lecteur qui la croit se fait une idée fausse de ce que le code tolère.
  //
  // Ce qui reste vrai et qui décide : la boîte se reconnaît à ses FILETS et à son INVITE, que
  // le dégrisage conserve. C'est ce que `contenuBoite` sait faire, et c'est pourquoi cette
  // ligne l'appelle au lieu de refaire le découpage ici.
  return contenuBoite(texteTerminal) === null;
}

/** Le geste mesuré qui franchit cet écran, s'il en existe un. Aucun par défaut. */
export function touchesPourFranchir(etat) {
  if (!etat?.ecran) return null;
  const connu = ECRANS_CONNUS.find((c) => c.cle === etat.ecran);
  return connu?.touches?.length ? connu.touches : null;
}

export function refusDEcran(etat, { cible = 'la session' } = {}) {
  if (etat.pretARecevoir) return null;
  if (etat.ecran) {
    return `${cible} est parquée devant un écran connu — ${etat.quoi}. Le geste qui le lève : ${etat.geste}`;
  }
  return (
    `${cible} est devant un écran que je ne reconnais pas — je m’arrête plutôt que de tenter ma chance. ` +
    `Voici ce que j’ai vu :\n${etat.resume}`
  );
}

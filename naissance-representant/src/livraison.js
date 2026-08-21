// livraison.js — livrer un brief à une session déjà née, et PROUVER qu'elle l'a pris.
//
// LE DÉFAUT QU'IL RÉSOUT (T-20260809-0033), et il est plus grave que ce que le ticket disait.
//
// Le ticket rapportait un brief resté dans la boîte de saisie, jamais soumis, pendant que
// `herdr agent prompt` rendait `{"result":{"type":"agent_prompted"}}` — donc un appelant qui
// lit la réponse croit avoir livré. C'est déjà le motif « le mot, pas le fait ».
//
// Mesuré contre le vrai gestionnaire de panes, c'est pire, et c'est DÉTERMINISTE :
//
//   1. on tape « reste ici » dans la boîte sans le soumettre  → boîte : « ❯ reste ici », idle
//   2. `herdr agent prompt <pane> 'BRIEF-REEL'`               → boîte vide, agent `working`,
//                                                               titre du terminal : « Reste ici brief-reel »
//
// L'agent n'a pas reçu le brief : il a reçu « reste iciBRIEF-REEL », les deux textes COLLÉS,
// et il travaille dessus. La livraison a « réussi » de tous les points de vue observables par
// l'appelant. Un brief fusionné avec un reste est pire qu'un brief non livré : le non-livré se
// voit (rien ne se passe), le fusionné produit un travail plausible et faux.
//
// CE QUE CE MODULE FAIT DONC, DANS CET ORDRE
//   • il REGARDE la boîte avant d'écrire — une boîte non vide est un refus, jamais une fusion ;
//   • il livre ;
//   • il VÉRIFIE PAR LE FAIT que la session a pris le brief (elle quitte `idle`, la boîte se
//     vide), au lieu de croire la réponse de l'outil ;
//   • si le texte est resté dans la boîte, il RÉPARE une fois (la touche d'envoi), puis
//     re-vérifie — et échoue bruyamment si le brief n'a jamais été pris.
//
// POURQUOI LA RÉPARATION N'EST PAS UN CONTOURNEMENT
// La soumission qui ne part pas est une course DANS herdr, dont ce dépôt n'a pas la maîtrise
// (règle d'or n°7). On ne la corrige pas d'ici. Ce qu'on peut faire — et qu'il faut faire —
// c'est ne jamais rendre « livré » ce qui ne l'est pas, et rattraper le cas connu plutôt que
// de laisser un représentant né muet devant un brief que personne ne relira.

// LA LECTURE DE LA BOÎTE VIT DANS `ligne-directe/src/boite.js` — un seul endroit la connaît,
// parce que deux chemins écrivent dans un pane et qu'une copie n'hérite pas des corrections
// de l'autre (T-20260814-0138). Réexportée ici : tout ce qui la nommait continue de la voir.
export { contenuBoite, boiteEstVide, estUnEspaceReserve } from '../../ligne-directe/src/boite.js';
import {
  contenuBoite,
  boiteEstVide,
  messagesEnFile,
  estUnEspaceReserve,
  etatDeLaBoite,
  ETATS_BOITE,
} from '../../ligne-directe/src/boite.js';
// ⚠️ LA SONDE D'ÉCRAN VIT DANS `ligne-directe/src/ecran.js` — un seul endroit sait reconnaître un
// écran de blocage, et `bin/naitre.js` s'en sert déjà. La revue de fond a relevé que la livraison
// ne s'en servait PAS : elle regardait la boîte sans jamais regarder ce qui pouvait s'afficher
// par-dessus. Sur un geste irréversible, c'était la porte-sur-deux dans sa forme la plus chère.
// ⚠️ `ecranAttendUnChoix` EST REPRISE, PAS RÉÉCRITE (T-20260817-0008, règle d'or n°15). Elle
// existe dans `ecran.js` depuis `T-20260817-0006`, où elle a été RESSERRÉE puis MESURÉE contre
// les faux positifs — une première version, plus large, déclarait 3 panes sur 14 « en attente de
// choix » à tort. En écrire une seconde ici aurait rejoué « une porte sur deux » dans le
// correctif écrit pour la fermer : la copie n'hérite jamais des corrections de l'autre.
import { etatDeLEcran, ecranAttendUnChoix, resumeDeLEcran } from '../../ligne-directe/src/ecran.js';
import { budgetPourUneAttente } from './appel-herdr.js';
// LA PREUVE D'ACTIVITÉ QUI PEUT RÉELLEMENT SURVENIR (T-20260821-0009) — le témoin sur lequel ce
// module jugeait ses livraisons était mort ; celui-ci est mesuré vivant sur ce poste.
import {
  ACTIVITE,
  identifiantDeSession,
  laSessionSestMiseAuTravail,
  lireActivite,
  motDeLActivite,
} from './activite-session.js';

/**
 * Le brief a-t-il été PRIS ? La question n'est pas « l'outil a-t-il dit oui », c'est « la
 * session a-t-elle quitté l'attente ».
 *
 * Deux témoins, et il en faut UN des deux — pas la réponse de l'outil, qui ment par
 * construction ici :
 *   • le statut a quitté `idle` (elle travaille, ou elle a déjà fini) ;
 *   • la boîte s'est vidée alors qu'on venait d'y écrire.
 *
 * Une boîte illisible (`null`) ne témoigne de rien : on ne la compte pas comme vidée.
 */
/**
 * LE MARQUEUR DE FILE D'ATTENTE — le témoin qui manquait (T-20260815-0007).
 *
 * MESURÉ le 2026-08-15 : un message envoyé à un agent qui travaille n'entre pas dans sa boîte,
 * il est MIS EN FILE et part à la fin de son tour. Ni le statut ni la boîte n'en portent trace :
 * il travaillait déjà, et la boîte est vide *parce que* le message en est sorti. C'est ce vide-là
 * qu'on prenait pour une absence, en rendant un échec sur un message parfaitement arrivé.
 *
 * ⚠️ ON LE CHERCHE DANS LE DUMP BRUT, pas dans la boîte : il est rendu en GRIS, et la lecture de
 * boîte retire le gris — à raison, sinon une suggestion de l'éditeur passerait pour un reste. Le
 * même dump sert donc deux besoins opposés, et c'est voulu.
 *
 * ⚠️ ET IL NE PROUVE QUE S'IL EST APPARU. Un destinataire qui avait déjà des messages en file le
 * porte avant qu'on écrive : s'en contenter, ce serait retrouver « la boîte vide » sous un autre
 * nom — un état vrai de toute façon. C'est l'appelant qui compare l'avant et l'après.
 */
// Le témoin de la file vit avec la lecture de boîte — un seul endroit sait lire un pane
// (T-20260815-0011). Réexporté : tout ce qui le nommait continue de le voir.
export { messagesEnFile } from '../../ligne-directe/src/boite.js';

/**
 * LES ÉTATS QUI SE PROUVENT EUX-MÊMES — et qui ne prouvent donc RIEN s'ils étaient déjà là.
 *
 * ⚠️ TROUVÉ EN PASSE DE FOND SUR CE LOT, ET C'EST LE MÊME MOTIF QUE CELUI QU'IL CORRIGE
 * (T-20260821-0009). La garde de T-20260814-0138 — « une preuve doit porter sur un état qui
 * POUVAIT être différent » — était posée sur `working`, et sur `working` seulement.
 *
 * Or `done` est un état de départ tout aussi légitime : `ETATS_DISPONIBLES` l'accepte
 * explicitement trois lignes plus bas. Un destinataire `done` avant l'envoi et `done` après
 * satisfaisait donc le témoin `statut === 'done'` — vrai avant même qu'on écrive.
 *
 * ⚠️ ET CE N'EST PAS THÉORIQUE. Mesuré sur ce poste le 2026-08-21 : `done` est la SEULE valeur
 * autre qu'`idle` que `agent_status` produise — 2 agents sur la session `cg`, 2 sur `progex`.
 * Le trou était exactement à la taille du seul état qui pouvait y tomber.
 *
 * Le pire cas était celui où l'outil dit lui-même que rien n'est parti : sur `envoiAccepte`
 * faux, boîte encore pleine du texte, `done → done` rendait « pris ».
 *
 * 🔑 LE MODULE FRÈRE AVAIT DÉJÀ COMMIS ET CORRIGÉ EXACTEMENT ÇA — `ligne-directe/src/boite.js`,
 * `laPriseEstConstatee` : « La première écriture acceptait `done → done` comme une sortie de
 * l'attente […] elle aurait donc posé le crochet sur les trois messages perdus. L'essai l'a
 * attrapée. » La leçon n'avait pas traversé jusqu'ici — « une porte sur deux », entre deux
 * modules cette fois, et le second importe déjà le premier.
 *
 * ⚠️ ON BORNE LE TÉMOIN, ON NE LE FERME PAS. Un destinataire passé de `idle` à `done` a bel et
 * bien quitté l'attente, et ce passage-là témoigne toujours.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ ET LA FAMILLE A CINQ MEMBRES — trouvé en PASSE DE FOND, une couche plus bas.
 *
 * Le contrat de herdr (`~/.claude/skills/herdr/SKILL.md`) donne à `agent_status` :
 *
 *     idle · working · blocked · done · unknown
 *
 * Trois d'entre eux veulent la même chose — **la session a quitté l'attente** :
 *
 *   `working`  elle travaille sur ce qu'on lui a donné
 *   `done`     elle a fini son tour
 *   `blocked`  elle a pris le brief, l'a exécuté, et un dialogue attend un choix
 *
 * Le premier lot en traitait UN. Le correctif du `done` en traitait DEUX. « Une porte sur
 * deux », à trois reprises, sur la même énumération.
 *
 * ⚠️ `blocked` EST DOCUMENTÉ, PAS OBSERVÉ. Sur ce poste le 2026-08-21 — 123 agents, deux
 * passes, trois sessions herdr — seuls `idle` et `done` sont sortis. On le traite parce que le
 * CONTRAT le nomme, et on le dit ici plutôt que de laisser croire à une mesure.
 *
 * ⚠️ `unknown` RESTE DEHORS, ET C'EST LA LIGNE QUI COMPTE. Il ne décrit pas un état de la
 * session : il dit que herdr ne connaît pas ce pane — mesuré sur l'auteur de ce lot, invisible
 * à son propre registre. En faire un témoin ferait conclure « le brief est passé » d'une
 * session qu'on n'a pas su regarder, ce qui est le défaut d'origine dans sa forme la plus pure.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * CE QU'ON JETTE VOLONTAIREMENT, relevé en revue de fond : un passage `working → done` ou
 * `done → working` est un vrai changement de valeur, et il sort quand même par le repli de la
 * boîte. **Ce n'est pas un signal perdu** : une session qui travaillait déjà a pu finir son
 * tour précédent, et cette transition-là ne dit rien de NOTRE brief. On ne compte que les
 * passages qui partent d'un état d'attente.
 */
const ETATS_QUI_SE_PROUVENT_EUX_MEMES = Object.freeze(['working', 'done', 'blocked']);

export function briefEstPris({
  statut,
  terminal,
  statutAvant = null,
  envoiAccepte = true,
  fileApparue = false,
  // ⚠️ LE TÉMOIN QUI PEUT RÉELLEMENT SURVENIR (T-20260821-0009). Voir `src/activite-session.js`
  // pour la mesure qui l'a rendu nécessaire. `INDETERMINEE` par défaut, et c'est la seule
  // valeur honnête pour un appelant qui n'a pas sondé : elle ne prouve RIEN, ni dans un sens
  // ni dans l'autre — là où `REPOS` par défaut aurait fait dire « pas d'activité » d'un état
  // que personne n'a regardé, c'est-à-dire le défaut d'origine réinstallé dans son correctif.
  activiteAvant = ACTIVITE.INDETERMINEE,
  activiteApres = ACTIVITE.INDETERMINEE,
}) {
  // UN MESSAGE MIS EN FILE EST UN MESSAGE PRIS, quoi qu'en dise le reste. C'est le seul témoin
  // disponible sur un pair occupé — et il porte bien sur un état qui pouvait être différent,
  // puisque l'appelant a constaté son APPARITION.
  if (fileApparue) return true;

  // ⚠️ LA SESSION S'EST MISE AU TRAVAIL — et c'est le seul témoin POSITIF que ce module ait
  // jamais eu sur le chemin nominal.
  //
  // Il l'emporte sur tout ce qui suit, y compris sur un envoi que herdr a refusé : herdr peut
  // parfaitement rendre `agent_prompt_stalled` sur un brief qui est bel et bien parti — mesuré
  // ce jour, sur le vrai service, par l'agent qui écrit cette ligne (`ok:true`, `delivre:soumis`,
  // `attendu:false` dans la même réponse). L'échec porte sur l'OBSERVATION, pas sur l'envoi.
  //
  // ⚠️ ET C'EST UN PASSAGE, PAS UN ÉTAT. Une session déjà au travail avant qu'on écrive serait
  // au travail quoi qu'on fasse : c'est la garde de T-20260814-0138, appliquée au nouveau
  // témoin le jour où on l'introduit plutôt qu'après l'avoir payée. Et une sonde muette ne
  // franchit rien — `INDETERMINEE` n'est ni un repos ni un travail.
  if (laSessionSestMiseAuTravail(activiteAvant, activiteApres)) return true;

  // ⚠️ QUAND L'OUTIL DIT LUI-MÊME QUE RIEN N'EST PARTI, LA BOÎTE VIDE NE PROUVE RIEN.
  //
  // Relevé en revue de fond. Si l'appel d'envoi échoue sans jamais toucher la boîte, elle est
  // vide AVANT et APRÈS — et « boîte vide » était compté comme la preuve d'une prise. Or une
  // boîte vide parce que rien n'a été écrit est le contraire d'une preuve : c'est l'état par
  // défaut, celui qui ne pouvait pas être différent. Le témoin doit alors être POSITIF.
  //
  // `envoiAccepte` redevient vrai après une RÉPARATION réussie, et c'est juste : y arriver
  // suppose qu'on a vu notre propre texte dans la boîte, puis qu'on l'a vu en sortir.
  if (!envoiAccepte) return !ETATS_QUI_SE_PROUVENT_EUX_MEMES.includes(statutAvant) && ETATS_QUI_SE_PROUVENT_EUX_MEMES.includes(statut);

  // ⚠️ UN DESTINATAIRE QUI TRAVAILLAIT DÉJÀ REND LE STATUT MUET (T-20260814-0138).
  //
  // « Elle travaille » ne prouve rien si elle travaillait avant qu'on écrive : le témoin serait
  // vrai quoi qu'on fasse, et c'est le défaut que tout ce lot ferme — une preuve doit porter sur
  // un état qui POUVAIT être différent.
  //
  // MESURÉ le 2026-08-14 sur le vrai service : un message envoyé à un agent occupé n'est pas
  // perdu, il est MIS EN FILE D'ATTENTE (« Press up to edit queued messages ») et part à la fin
  // du tour. Le témoin disponible est donc la BOÎTE : elle est vide parce que le texte en est
  // sorti. C'est aussi ce qui distingue le cas sain du mode de panne, qui laisse au contraire la
  // boîte pleine — et que la réparation ci-dessous rattrape.
  //
  // ⚠️ CE QUE CE TÉMOIN NE PROUVE PAS, ET IL FAUT LE DIRE : une boîte vide l'est aussi quand
  // rien n'a jamais été écrit. Sur un destinataire occupé, on ne sait pas distinguer les deux —
  // le statut ne bouge pas, et le texte mis en file n'apparaît nulle part à l'écran. On attrape
  // le mode de panne mesuré ; on ne prétend pas prouver davantage.
  // ⚠️ `done` EST TRAITÉ COMME `working`, ET IL NE L'ÉTAIT PAS (trouvé en PASSE DE FOND sur ce
  // lot, T-20260821-0009). Voir `ETATS_QUI_SE_PROUVENT_EUX_MEMES` ci-dessus : la garde était
  // posée sur une valeur sur deux.
  if (ETATS_QUI_SE_PROUVENT_EUX_MEMES.includes(statutAvant)) return boiteEstVide(terminal);

  // On arrive ici seulement si le départ n'était NI `working` NI `done` — donc y arriver est
  // bien un PASSAGE, et le témoin porte sur un état qui pouvait être différent.
  const partie = ETATS_QUI_SE_PROUVENT_EUX_MEMES.includes(statut);
  return partie || boiteEstVide(terminal);
}

/**
 * Les états dans lesquels une session peut recevoir un brief — et être vue le recevoir.
 * `done` est admis : le tour précédent est fini, la boîte est rendue.
 */
const ETATS_DISPONIBLES = ['idle', 'done'];

/**
 * Ce qui empêche de livrer AVANT qu'on écrive — la raison de refuser.
 *
 * Rend `null` quand on peut livrer, sinon le message qui dit pourquoi on ne livre pas.
 *
 * DEUX PORTES, ET LA SECONDE A ÉTÉ OUBLIÉE À LA PREMIÈRE ÉCRITURE (relevé en revue de fond,
 * motif 3) :
 *
 *   • la BOÎTE — écrire par-dessus un reste ne produit pas deux messages, ça produit UN
 *     message faux (mesuré contre le vrai service) ;
 *   • le STATUT — et c'est le plus grave des deux, parce qu'il ne casse pas la livraison, il
 *     casse la PREUVE. `briefEstPris` tient `working` pour le témoin qu'une session a pris le
 *     brief. Si elle travaillait DÉJÀ quand on est arrivé — un autre appelant lui parle en
 *     même temps —, ce témoin est vrai avant même qu'on écrive : la commande déclarerait
 *     « livré » sans que rien n'ait été pris. Une garde qui peut se prouver elle-même vraie
 *     n'est pas une garde.
 *
 * Un statut qu'on n'a pas pu lire (`null`, `unknown`) est aussi un refus : on ne livre pas
 * dans une session dont on ignore l'état, pour la même raison qu'on ne livre pas dans une
 * boîte qu'on ne voit pas.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * INVARIANT — UN REFUS QUI NE NOMME PAS LA SORTIE EST UN REFUS QUI BLOQUE (T-20260816-0045)
 *
 * Un agent a tenté de joindre son orchestrateur **239 fois**. Chaque refus était JUSTE, et la
 * garde a tenu 288 fois plutôt que de coller deux textes en un message que personne n'aurait
 * écrit. **Aucun ne disait quoi faire.** Un refus fondé qui laisse son lecteur exactement où
 * il était ne protège plus : il remplace un défaut par un autre.
 *
 * Chaque refus d'ici dit donc DEUX choses :
 *   1. CE QUI BLOQUE, avec les valeurs réellement trouvées — jamais une forme générique, qui
 *      se copie sans se lire et laisse encore traduire ;
 *   2. LE GESTE EXACT QUI LE LÈVE, et à QUI il appartient quand ce n'est pas au lecteur.
 *
 * ⚠️ LA MOITIÉ QUI PROTÈGE — ON N'AFFAIBLIT AUCUN REFUS. On ajoute des mots, on ne change pas
 * un seul verdict. Un correctif qui rendrait un cas permissif serait pire que le défaut :
 * il rouvrirait la fusion silencieuse que ce module existe pour empêcher.
 *
 * ⚠️ ET ON NE PROMET PAS UNE SORTIE QU'ON N'A PAS VÉRIFIÉE. Quand le geste appartient à un
 * humain devant ce pane, on le dit — un aveu explicite vaut mieux qu'un silence qui laisse
 * chercher, et bien mieux qu'un conseil inapplicable, qui serait ce défaut retourné contre
 * nous (c'est le reproche exact de `T-20260816-0002` à l'ancien refus d'ambiguïté).
 *
 * `pane` est facultatif, et son absence se voit : sans lui, on se TAIT sur les commandes
 * plutôt que d'écrire `herdr agent read <pane>` — un gabarit non substitué est une commande
 * que le lecteur ne peut pas exécuter.
 */
/**
 * LES TROIS CAUSES DE REFUS, NOMMÉES — et rien d'autre (T-20260816-0114).
 *
 * `obstacleAvantLivraison` rend une PHRASE, ce qui est ce dont son lecteur a besoin, mais ce
 * qui ne se distingue pas par du code : l'appelant ne pouvait pas savoir s'il butait sur une
 * boîte encombrée, un statut, ou un écran illisible. Or une seule des trois se traite — celle
 * de la boîte encombrée, qui affame tous les émetteurs suivants sans que personne le sache.
 *
 * ⚠️ CETTE FONCTION EST LA SEULE QUI DÉCIDE. `obstacleAvantLivraison` s'écrit PAR-DESSUS elle,
 * et c'est délibéré : deux logiques de refus divergeraient à la première correction, et la
 * divergence irait dans le sens qui permet d'écrire quelque part. Un seul endroit décide, un
 * seul endroit met des mots dessus. Aucun verdict ne change ; seule la cause devient lisible.
 */
export const CAUSES = Object.freeze({
  STATUT: 'statut',
  ILLISIBLE: 'illisible',
  ENCOMBREE: 'encombree',
  // ⚠️ LA QUATRIÈME CAUSE, ET LA SEULE OÙ ÉCRIRE N'EST PAS UNE ERREUR MAIS UNE APPROBATION
  // (T-20260817-0008). Les trois autres coûtent un message perdu ou corrompu ; celle-ci fait
  // exécuter une commande que personne n'a validée, et le geste ne se défait pas.
  DIALOGUE: 'dialogue',
});

/**
 * POURQUOI `repare` VAUT CE QU'IL VAUT — le motif du champ, jamais un verdict de plus
 * (T-20260818-0031, critère 3).
 *
 * `repare` et `delivre` sont des BOOLÉENS À FAUX PAR DÉFAUT, et un booléen à faux ne dit pas
 * s'il l'est parce que rien n'était nécessaire, parce qu'on a été empêché, ou parce qu'on a
 * essayé et échoué. MESURÉ le 2026-08-18 sur un cas réel : `{"ok":true,"statut":"done",
 * "repare":false,"delivre":false,"attendu":false}` — trois faux, aucun mot. L'appelant qui lit
 * ça ne peut rien en faire, et c'est justement lui qui refait ensuite le geste à la main.
 *
 * ⚠️ CES CAUSES-CI NE SONT PAS CELLES DE `CAUSES`. Celles du dessus disent pourquoi on REFUSE
 * D'ÉCRIRE ; celles-ci disent pourquoi la RÉPARATION — la touche d'envoi de l'étape 4 — a
 * mordu, n'a pas été tentée, ou a été repoussée. Deux registres, deux jeux de mots : les fondre
 * ferait porter à un chemin le motif de l'autre, et c'est un défaut déjà payé ici.
 *
 * ⚠️ ET LE CHAMP NE SE TAIT JAMAIS, MÊME QUAND `repare` EST VRAI. Un motif qui n'apparaîtrait
 * que sur l'échec obligerait l'appelant à tester son existence avant de le lire — et un champ
 * qui ne peut rendre qu'un seul verdict est une constante déguisée en mesure, ce que ce ticket
 * a déjà relevé une fois sur son propre détecteur.
 */
export const CAUSES_REPARATION = Object.freeze({
  // Le brief a été pris : il n'y avait RIEN à réparer. C'est le cas dominant, et c'est une
  // bonne nouvelle — sans mot, elle est indistinguable d'un échec de réparation.
  INUTILE: 'inutile',
  // La touche d'envoi est partie et herdr l'a acceptée.
  SOUMISE: 'soumise',
  // Elle est partie et herdr l'a REFUSÉE. Le cas le plus trompeur : on a bel et bien agi, et le
  // champ vaut quand même faux.
  ENVOI_REFUSE: 'envoi-refuse',
  // On ne l'a PAS tentée : un dialogue attendait un choix, et la touche y aurait confirmé
  // l'option surlignée au lieu de soumettre notre texte (T-20260817-0008).
  DIALOGUE: 'dialogue',
  // On ne l'a pas tentée non plus : la boîte ne portait rien à soumettre…
  BOITE_VIDE: 'boite-vide',
  // …ou on ne pouvait pas la lire, et on ne soumet pas ce qu'on n'a pas vu.
  BOITE_ILLISIBLE: 'boite-illisible',
  // On n'a JAMAIS écrit — la livraison a été refusée en amont. Il n'y avait donc rien à
  // réparer, et c'est un autre fait que « j'ai essayé sans succès ». Le refus lui-même reste
  // dans `message`, en toutes lettres.
  RIEN_ECRIT: 'rien-ecrit',
});

/**
 * Ce que vaut `causeDelivre` quand AUCUNE délivrance n'a été tentée — parce que la boîte
 * n'était pas encombrée, ou parce que l'appelant a désarmé le geste (`immobiliteMs: 0`).
 *
 * Toutes les autres valeurs viennent de `delivrerLaBoite`, qui les nomme déjà sur neuf
 * branches : `choix`, `ecran`, `dialogue`, `illisible`, `vide-cause-inconnue`, `bouge`,
 * `soumis`, `sans-effet`, `plus-autorise`. On ne les recalcule pas — on les laisse SORTIR.
 * Elles ne franchissaient pas cette fonction, et c'est tout le défaut.
 */
export const DELIVRANCE_NON_TENTEE = 'non-tentee';

/**
 * ⚠️ L'ÉCRAN EST CONSULTÉ AVANT LA BOÎTE, ET C'EST TOUT LE CORRECTIF (T-20260817-0008).
 *
 * MESURÉ le 2026-08-17 sur le vrai service : un `herdr agent prompt` ordinaire, envoyé devant
 * `Do you want to proceed? ❯ 1. Yes`, a FAIT EXÉCUTER la commande proposée. Le texte n'a pas été
 * reçu comme un message — il a servi de CONFIRMATION. Ce n'est donc pas seulement la touche
 * d'envoi qui confirme (`T-20260816-0114`, publié dans `v1.63.0`) : c'est l'ÉCRITURE elle-même,
 * le geste que fait toute livraison.
 *
 * Cette fonction ne regardait que le statut et la boîte. Un dialogue affiché au-dessus d'une
 * boîte VIDE passait donc entièrement : `reste === ''`, aucun obstacle, l'écriture partait.
 *
 * ⚠️ ET LE REFUS QUI MORDAIT MORDAIT PAR ACCIDENT. Sur le dialogue réellement observé, la boîte
 * était illisible — donc refusée pour `ILLISIBLE`, une raison qui n'est pas la bonne. Elle
 * disparaîtra au premier changement d'interface de Claude Code, sans que rien ne le signale,
 * alors que ce qu'elle empêche est irréversible. Un garde-fou qui attrape par hasard n'attrape
 * pas : il attend.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * L'ORDRE DES QUATRE CAUSES EST DÉLIBÉRÉ, et chacune de ses places se justifie :
 *
 *   1. STATUT — inchangé, et il reste PREMIER. Un pane `blocked` qui affiche un dialogue rend
 *      toujours `statut` : c'est ce que lit `livrerBrief` pour savoir qu'il n'y a rien à
 *      délivrer, et le déplacer changerait un verdict que personne n'a demandé de changer.
 *   2. DIALOGUE — AVANT `ILLISIBLE`, pour que le refus porte la VRAIE raison plutôt que
 *      l'effet de bord. C'est la moitié du défaut qu'on ferme.
 *   3. DIALOGUE — AVANT `ENCOMBREE` aussi, et ce n'est pas cosmétique : `livrerBrief` ne tente
 *      la délivrance que sur `ENCOMBREE`. Un dialogue au-dessus d'une boîte encombrée aurait
 *      donc déclenché une touche d'envoi — le pire des deux mondes, l'attente perdue ET
 *      l'action approuvée.
 *
 * ⚠️ LA MOITIÉ QUI PROTÈGE — MESURÉE, pas supposée. Le 2026-08-17, sur 153 panes RÉELS de ce
 * poste à travers 11 sessions : 5 écrans déclarés « attend un choix », **5 vrais dialogues,
 * ZÉRO faux positif**, et **ZÉRO pane livrable perdu** sur les 141 qui l'étaient (les 5 étaient
 * déjà refusés — 3 par leur statut, 2 par leur boîte illisible). Une garde qui refuserait un
 * agent sur cinq rendrait la ligne du dirigeant inutilisable — une panne PIRE, en fréquence,
 * que celle qu'on ferme ; et une garde qui crie sur du bruit cesse d'être lue. C'est ainsi
 * qu'une garde meurt, et c'est pour ça que ce chiffre-là comptait autant que l'autre.
 */
export function causeObstacle(terminal, statut, { pairOccupe = false, parLePane = false } = {}) {
  // ⚠️ `parLePane` + `unknown` — LA SIGNATURE DU CAS QU'ON REPLIE, PAS UN ÉTAT SUSPECT
  // (T-20260820-0022). Mesuré le 2026-08-20 sur les 98 panes du poste : les 83 que le registre
  // voit sont TOUS `idle`, les 15 qu'il ignore TOUS `unknown` — séparation parfaite, zéro
  // contre-exemple.
  //
  // Refuser `unknown` rendait le repli INOPÉRANT SUR EXACTEMENT LA POPULATION QU'IL VISE : un
  // agent qu'on rejoint par son pane PARCE QUE le registre l'ignore porte, par construction, le
  // statut que le refus écartait. Le correctif trouvait son destinataire, lisait sa boîte, et
  // refusait au dernier mètre — sur la foi d'un champ que seul le registre renseigne.
  //
  // ⚠️ ET C'EST UNE CONJONCTION, PAS UNE LEVÉE. Trois conditions ensemble : arrivé PAR LE PANE
  // (donc le registre s'est tu, donc on sait pourquoi le statut est inconnu) ET statut
  // exactement `unknown` ET — plus bas, inchangé — la BOÎTE est vide. Par le NOM, le registre a
  // répondu : un `unknown` y voudrait dire autre chose, et on n'a aucune mesure qui dise quoi.
  // On ne généralise pas une levée dont on connaît la cause à un cas dont on l'ignore.
  //
  // La garde qui protège le texte d'autrui n'a jamais été celle du statut — c'est celle de la
  // boîte, et elle est intacte trois lignes plus bas.
  const statutExplicable = parLePane && statut === 'unknown';
  if (!ETATS_DISPONIBLES.includes(statut) && !(pairOccupe && statut === 'working') && !statutExplicable) {
    return CAUSES.STATUT;
  }
  if (ecranAttendUnChoix(terminal)) return CAUSES.DIALOGUE;
  const reste = contenuBoite(terminal);
  if (reste === null) return CAUSES.ILLISIBLE;
  if (reste !== '') return CAUSES.ENCOMBREE;
  return null;
}

export function obstacleAvantLivraison(terminal, statut, { pairOccupe = false, pane = null, parLePane = false } = {}) {
  // Le geste, écrit avec le pane RÉEL — ou tu, si on ne le connaît pas.
  const ou = pane ? ` « ${pane} »` : '';
  // ⚠️ LA COMMANDE CONSEILLÉE EST CELLE QUE CE MODULE UTILISE LUI-MÊME — relevé en revue de
  // fond, et c'est le défaut de ce lot retourné contre lui. Pour REGARDER LA BOÎTE, le code
  // lit `agent read … --format ansi` (voir `commandesLivraison.lireEcran`) parce que le GRIS
  // est la seule chose qui distingue une suggestion d'un reste. Conseiller la même commande
  // sans son option enverrait le lecteur diagnostiquer avec moins que ce qu'on s'accorde à
  // soi-même — un demi-geste, donc un conseil qu'on n'a pas vérifié bon pour ce qu'il sert.
  const commande = (quoi, options = '') =>
    pane ? ` (\`herdr agent ${quoi} ${pane}${options}\`)` : '';
  // ⚠️ `pairOccupe` — PARLER À UN AGENT QUI TRAVAILLE (T-20260814-0138).
  //
  // Le refus sur le statut n'est pas une garde de SÛRETÉ, c'est une garde de PREUVE : livrer à
  // une session qui travaille est parfaitement sans danger (sa boîte est vide et lisible,
  // mesuré) — c'est le témoin `working` qui devient inutilisable, puisqu'il serait vrai avant
  // même qu'on écrive.
  //
  // Pour un BRIEF DE NAISSANCE, ce refus est juste : la session vient de naître, elle attend,
  // et si elle travaille déjà c'est que quelqu'un d'autre lui parle. Pour un MESSAGE ENTRE
  // AGENTS, il est rédhibitoire : un pair est vivant et occupé la plupart du temps, et garder
  // ce refus revenait à n'avoir aucune voie vérifiée pour lui parler — donc à laisser tout le
  // monde sur `herdr agent prompt` nu, qui est le défaut.
  //
  // On ne lève donc pas la garde, on change de témoin : voir `briefEstPris`, qui exige alors
  // que le texte soit VU dans la sortie du destinataire, au lieu de se fier au statut.
  const cause = causeObstacle(terminal, statut, { pairOccupe, parLePane });
  if (cause === CAUSES.STATUT) {
    // ⚠️ `unknown` NE SE DÉCRIT PAS COMME UN DÉPART (T-20260820-0022). « Elle a déjà quitté
    // l'attente sans nous » parle d'une session qu'on a VUE puis qui est partie. Un pane que le
    // registre ignore n'a JAMAIS été vu : le refus décrivait un état qui n'était pas le sien, et
    // envoyait attendre un retour à « idle » qui ne viendra pas. Un refus qui nomme la mauvaise
    // cause envoie chercher au mauvais endroit — c'est le motif de tout ce chantier.
    if (statut === 'unknown') {
      return (
        `le registre herdr ne voit aucun agent dans${ou || ' ce pane'} — statut « unknown ». ` +
        'Ce pane n’a jamais été inscrit au registre : il n’y a donc aucun retour à « idle » à ' +
        'espérer, et attendre ne changera rien. Désigne-le par son PANE plutôt que par un nom — ' +
        'la livraison passera alors par le pane. Rien n’a été écrit.'
      );
    }
    return (
      `la session${ou} n’est pas disponible pour un brief (statut « ${statut ?? '—'} ») — ` +
      'livrer maintenant ne se prouverait pas : elle a déjà quitté l’attente sans nous. ' +
      `Attends qu’elle revienne à « idle » ou « done »${commande('get')}, puis renvoie : ` +
      'rien n’a été écrit, tu ne perds que le temps de l’attente'
    );
  }
  // ⚠️ LE REFUS QUI DIT « DIALOGUE » PLUTÔT QUE « ILLISIBLE » (T-20260817-0008).
  //
  // Il nomme ce qui bloque — un dialogue, pas une boîte —, ce qu'il en coûterait — écrire y
  // CONFIRME l'option affichée, mesuré —, et à qui appartient le geste. Ce dernier point n'est
  // pas une politesse : un refus fondé qui laisse son lecteur exactement où il était ne protège
  // plus, il remplace un défaut par un autre (T-20260816-0045).
  //
  // ⚠️ ET IL NE PROMET PAS UNE SORTIE QU'ON N'A PAS. Ce blocage ne se lève pas d'ici : répondre
  // à la place de quelqu'un serait approuver en son nom une action qu'on n'a pas examinée —
  // c'est-à-dire le défaut même qu'on ferme, posé cette fois volontairement.
  if (cause === CAUSES.DIALOGUE) {
    const vu = resumeDeLEcran(String(terminal ?? ''));
    return (
      `la session${ou} est devant un DIALOGUE qui attend un choix — on n’écrit pas là. ` +
      'Mesuré le 2026-08-17 : un message ordinaire envoyé devant un dialogue n’est pas reçu ' +
      'comme un message, il CONFIRME l’option affichée, et l’action part. ' +
      '⚠️ CE BLOCAGE NE SE LÈVE PAS D’ICI : quelqu’un doit répondre à ce dialogue devant ' +
      `${ou ? `le pane${ou}` : 'ce pane'} — répondre à sa place approuverait en son nom une ` +
      'action que je n’ai pas examinée. Va voir toi-même' + commande('read', ' --format ansi') +
      `${vu ? ` — voici ce que j’ai vu :\n${vu}` : ''}`
    );
  }
  const reste = contenuBoite(terminal);
  if (cause === CAUSES.ILLISIBLE) {
    return (
      `la boîte de saisie de la session${ou} est illisible — on ne livre pas dans ce qu’on ne ` +
      'voit pas. Va regarder l’écran toi-même' + commande('read', ' --format ansi') + ' : ou bien le format a ' +
      'changé et c’est un défaut à inscrire, ou bien il y a bien quelque chose dedans'
    );
  }
  if (cause === CAUSES.ENCOMBREE) {
    // ⚠️ LE MODE D'ARRIVÉE DU TEXTE CHANGE LA CONDUITE, ET LE REFUS DOIT LE DIRE
    // (E-20260819-0015). Un texte SAISI a peut-être quelqu'un derrière le clavier — attendre a
    // un sens. Un texte COLLÉ est arrivé d'un seul coup : par construction, personne n'a les
    // doigts dessus, et attendre devant ce pane est du temps mort pur (mesuré : 300 secondes
    // d'attente sur un `[Pasted text #33]` immobile). Un refus qui les confond envoie attendre
    // quelqu'un qui ne reviendra pas.
    const mode = estUnEspaceReserve(reste)
      ? ' — ce texte est arrivé par COLLAGE : l’écran n’en montre qu’un repli, et personne ' +
        'n’a les doigts dessus'
      : ' — ce texte a été SAISI en clair : quelqu’un est peut-être devant ce clavier';
    return (
      `la boîte de saisie${ou} n’est pas vide (elle contient « ${reste.slice(0, 80)}${reste.length > 80 ? '…' : ''} »)${mode} — ` +
      'écrire par-dessus ne livrerait pas deux messages, ça en livrerait UN, les deux textes ' +
      'collés. ⚠️ CE BLOCAGE NE SE LÈVE PAS D’ICI : quelqu’un doit soumettre ou effacer ce ' +
      `texte devant${ou || ' ce pane'}, et personne d’autre ne peut le faire à sa place — ` +
      'vider la boîte d’autrui serait taper à sa place'
    );
  }
  return null;
}

/**
 * Les commandes herdr de la livraison — CONSTRUITES, jamais exécutées ici (même séparation
 * que `commandesNaissance` : `bin/livrer.js` les exécute, les tests les lisent comme des
 * données).
 *
 * `agent prompt` porte `--wait` : c'est herdr lui-même qui sait dire qu'une soumission n'est
 * pas partie (`agent_prompt_stalled`, ou `timeout`). L'appel nu, sans `--wait`, rend un succès
 * dans tous les cas — c'est lui qui a produit le défaut. On ne s'en contente pas pour autant :
 * ce que `--wait` rapporte est un indice de plus, jamais la preuve. La preuve se relit.
 */
/**
 * Le statut d'activité rendu par `agent get` OU par `pane get`.
 *
 * ⚠️ LES DEUX VERBES NE RANGENT PAS LEUR RÉPONSE AU MÊME ENDROIT — `agent get` la met sous
 * `result.agent`, `pane get` sous `result.pane`. Le repli par pane (T-20260820-0022) fait
 * passer les sessions invisibles par le second : lire la seule forme `agent` y rendait `null`,
 * et un statut nul se lit « elle a quitté l'attente sans nous ». La livraison refusait donc au
 * DERNIER MÈTRE, après avoir trouvé son destinataire — le mode de panne exact que ce lot ferme.
 *
 * Trouvé par un essai de bout en bout, pas par relecture : les deux étages étaient justes
 * séparément, et c'est leur jointure qui manquait.
 */
function statutRendu(reponse) {
  const r = reponse?.result;
  return r?.agent?.agent_status ?? r?.pane?.agent_status ?? null;
}

export function commandesLivraison(pane, texte, { parLePane = false } = {}) {
  if (!pane) throw new Error('le pane de la session à briefer est requis');
  if (!String(texte ?? '').trim()) throw new Error('un brief vide n’est pas un brief');

  // ⚠️ QUAND LE REGISTRE NE CONNAÎT PAS L'AGENT, C'EST TOUTE LA FAMILLE `agent …` QUI SE FERME
  // — pas seulement la recherche (T-20260820-0022). Mesuré le 2026-08-20 sur un pane réellement
  // invisible : `herdr agent read w2D:p11` rend `agent_not_found` là où `herdr pane read` rend
  // l'écran. Un repli qui se contenterait de TROUVER le pane puis rappellerait `agent prompt`
  // échouerait au dernier mètre, après avoir annoncé qu'il avait trouvé — le mode de panne que
  // ce fichier existe pour fermer.
  //
  // On bascule donc les QUATRE commandes ensemble : lire, interroger, écrire, soumettre.
  //
  // ⚠️ ET LA GARDE DE BOÎTE TRAVERSE LE REPLI INTACTE. `--format ansi` est conservé : le gris
  // reste la seule chose qui distingue une suggestion d'un texte réel, et le refus d'écrire
  // dans une boîte non vide se prend sur cette lecture-là, des deux côtés.
  //
  // ⚠️ CE QU'ON PERD, ET IL FAUT LE DIRE : `pane send-text` n'a pas d'équivalent de
  // `--wait --until working`. On n'en fabrique pas un faux — la preuve se relit, comme partout
  // ici, et c'est justement la conduite que ce module tient déjà pour le chemin nominal.
  //
  // ⚠️ ET DEPUIS T-20260821-0009, C'EST LE CHEMIN NOMINAL QUI EST VENU LE REJOINDRE — voir la
  // note sous `livrer`. La doctrine était écrite ici, sur la branche de repli, et appliquée à
  // une branche sur deux.
  if (parLePane) {
    return {
      lireEcran: ['pane', 'read', pane, '--format', 'ansi'],
      interroger: ['pane', 'get', pane],
      livrer: ['pane', 'send-text', pane, texte],
      soumettre: ['pane', 'send-keys', pane, 'Enter'],
    };
  }

  return {
    // `--format ansi` — LE GRIS EST LA SEULE CHOSE QUI DISTINGUE UNE SUGGESTION D'UN RESTE.
    // Sans lui, la boîte VIDE d'une session qui propose une phrase de son historique se lit
    // comme une boîte pleine, et la livraison est refusée sans raison (mesuré, T-20260814-0138).
    lireEcran: ['agent', 'read', pane, '--format', 'ansi'],
    interroger: ['agent', 'get', pane],
    // ⚠️ PAS D'ATTENTE QU'ON SAIT IMPOSSIBLE À SATISFAIRE (T-20260815-0007, ÉTENDU PAR
    // T-20260821-0009 À TOUS LES DESTINATAIRES).
    //
    // LE PREMIER LOT avait vu la moitié du défaut : sur un destinataire DÉJÀ au travail,
    // `--wait --until working` ne peut rien observer, donc on ne la demandait pas pour lui. La
    // garde était juste, et son périmètre était faux — elle ne couvrait qu'un cas sur deux.
    //
    // ⚠️ MESURÉ LE 2026-08-21, SUR DU TRAFIC RÉEL, ce que le premier lot n'avait pas mesuré :
    //
    //   journal du dispositif, 69 rondes, 486 cibles :  231 non-livraisons
    //                                                    98 d'entre elles = `agent_prompt_stalled`
    //   herdr agent list, 123 agents, deux passes     :  agent_status ∈ { idle, done } — jamais
    //                                                    `working`, aux deux passes
    //
    // Et le témoin sur lequel l'attente s'appuie est mort lui aussi : `state_change_seq`,
    // mesuré FIGÉ plus de trois heures sur un pane à une dizaine de transitions prouvées.
    //
    // ⚠️ CE QU'IL FAUT DIRE EXACTEMENT, PARCE QUE LE DIRE PLUS FORT SERAIT FAUX : herdr SAIT
    // rendre `working` — le journal le porte 6 fois comme statut lu AVANT l'envoi, soit 1,2 %
    // des cibles. Ce n'est donc pas la valeur qui est impossible, c'est L'ATTENTE qui ne
    // l'observe pas : elle guette une transition via `state_change_seq`, et ce compteur ne
    // bouge pas. Le résultat est le même — 98 faux négatifs fabriqués par le dispositif
    // lui-même, qu'il allait ensuite interpréter comme des agents morts — mais la cause n'est
    // pas celle qu'on croyait, et un correctif posé sur la mauvaise cause se serait cassé
    // ailleurs.
    //
    // On ne la demande donc plus pour PERSONNE. La preuve se relit — c'est la conduite que ce
    // module tient déjà partout ailleurs, y compris trente lignes plus haut, et la seule ligne
    // qui y dérogeait est celle qui a produit le défaut.
    livrer: ['agent', 'prompt', pane, texte],
    soumettre: ['agent', 'send-keys', pane, 'Enter'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA DÉLIVRANCE — POUR QUE LE BLOCAGE FINISSE, SANS JAMAIS ÉCRASER PERSONNE (T-20260816-0114)
//
// LE DÉFAUT, ET IL NAÎT DE LA COMPOSITION, PAS D'UN MAILLON. Le refus ci-dessus est juste :
// écrire par-dessus un reste livre UN message, les deux textes collés. L'émetteur a raison
// d'attendre plutôt que de forcer. Et le destinataire ne voit rien — une boîte pleine ne se
// signale pas, elle attend. Résultat mesuré : une boîte bloquée met en FAMINE tous les
// émetteurs suivants, et seul le destinataire peut la libérer — c'est-à-dire le seul qui ne
// sait pas qu'elle bloque. Trois blocages en deux jours sur la même boîte, un quatrième à la
// ronde suivante : ce n'est pas un cas limite, c'est le régime normal d'un orchestrateur qui
// reçoit de plusieurs agents. Et UNE FOIS SUR TROIS, l'auteur du texte coincé était DÉJÀ MORT.
// Personne, jamais, n'allait le soumettre.
//
// ⚠️ CE QU'ON NE FAIT PAS, ET CE N'EST PAS NÉGOCIABLE : autoriser l'écrasement. Deux textes
// collés produisent un travail plausible et faux — pire que l'attente, pire que la perte. Le
// refus ci-dessus ne bouge pas d'un mot, et rien ne s'écrit tant que la boîte n'a pas été VUE
// vide. Ce qu'on ajoute est l'autre moitié : que le blocage FINISSE.
//
// LE GESTE, ET POURQUOI IL EST LÉGITIME. Le refus dit lui-même quoi faire — « quelqu'un doit
// soumettre ou effacer ce texte » — puis ajoute que personne d'autre ne peut le faire à sa
// place. C'est cette dernière phrase que la MESURE dément. Le 2026-08-17, sur une boîte
// bloquée d'une session jetable : une touche d'envoi envoyée DE L'EXTÉRIEUR vide la boîte, et
// le destinataire se met au travail. Le message coincé n'est pas perdu — il est PRIS, entier,
// tel que son auteur l'avait écrit.
//
// Soumettre n'est pas taper à sa place. Taper à sa place, ce serait ajouter ou retirer du
// texte ; on n'écrit pas un caractère. On FINIT LE GESTE QUE QUELQU'UN A COMMENCÉ — et c'est
// exactement ce que la réparation de `livrerBrief` fait déjà, plus bas, pour son PROPRE texte.
// Le code savait faire ; il refusait seulement de le faire pour le texte d'un autre.
//
// ⚠️ CE QUE ÇA COÛTE, ET IL FAUT LE DIRE : soumettre est IRRÉVERSIBLE. Si le texte trouvé était
// un brouillon que le destinataire tapait, il part inachevé. D'où la garde d'IMMOBILITÉ — on ne
// soumet que ce qu'on a vu ne pas bouger entre deux lectures espacées, parce que quelqu'un qui
// tape fait bouger sa boîte. Et ce qui part reste UN texte, entier : un agent qui reçoit sa
// propre phrase inachevée peut le constater, là où deux textes collés ne se voient pas.

/**
 * ⚠️ `delivrerLaBoite` ET SON DÉLAI ONT DÉMÉNAGÉ — pas changé (T-20260818-0049).
 *
 * Ils vivent désormais dans `ligne-directe/src/delivrance.js`, parce qu'ils ont un SECOND
 * appelant : `ligne-directe/src/herdr.js`, le chemin par lequel arrive la parole du dirigeant.
 * Ce chemin portait le veto sur une boîte occupée depuis `1dae9c7` sans jamais avoir ce
 * rattrapage-ci — c'est ce qui obligeait le dirigeant à ouvrir un terminal.
 *
 * On les RÉ-EXPORTE d'ici : tout ce qui les importait de `livraison.js` continue de marcher,
 * et les bancs qui les éprouvent n'ont pas bougé non plus.
 */
export {
  IMMOBILITE_PAR_DEFAUT_MS,
  FENETRE_ENTRE_AGENTS_MS,
  fenetreDImmobilite,
  delivrerLaBoite,
} from '../../ligne-directe/src/delivrance.js';
import { delivrerLaBoite, fenetreDImmobilite } from '../../ligne-directe/src/delivrance.js';

/**
 * Ce qu'on ajoute au refus quand la délivrance n'a pas abouti — DES MOTS, jamais un verdict.
 *
 * Le refus d'origine est rendu intact et ce texte vient APRÈS lui : c'est la règle posée par
 * `T-20260816-0045` (un refus dit ce qui bloque et le geste qui le lève) appliquée à un
 * blocage qu'on a en plus essayé de lever soi-même. Dire qu'on a essayé évite au lecteur de
 * retenter le même geste à l'aveugle.
 */
export function motDeLaDelivrance(delivrance, { immobiliteMs = 0 } = {}) {
  // ⚠️ UNE ATTENTE NULLE NE SE CHIFFRE PAS (T-20260818-0076). Devant un COLLAGE, la fenêtre vaut
  // zéro — il n'y a personne derrière le clavier, donc rien à observer. Écrire « après 0 s
  // d'immobilité » raconte une attente qui n'a pas eu lieu, et fait passer pour une négligence
  // ce qui est une décision. Même racine que la durée arrondie de `avisDeBoiteBloquee`.
  const attenteEuLieu = Number(immobiliteMs) > 0;
  const attente = `${Math.round(immobiliteMs / 1000)} s`;
  if (delivrance.cause === 'choix') {
    return (
      '⚠️ Je n’ai RIEN soumis : ce que porte cette boîte ressemble à un **dialogue de choix**, ' +
      'pas à un message en souffrance. La touche d’envoi y confirmerait une action que personne ' +
      'ne m’a demandé d’approuver. Quelqu’un doit répondre à ce dialogue devant ce pane'
    );
  }
  if (delivrance.cause === 'dialogue') {
    return (
      '⚠️ Je n’ai RIEN soumis : l’écran de cette session porte un **dialogue qui attend un ' +
      'choix**, affiché au-dessus de sa boîte. La touche d’envoi y confirmerait l’option ' +
      'surlignée — une action que personne ne m’a demandé d’approuver, et qui ne se défait pas. ' +
      `Quelqu’un doit répondre à ce dialogue devant ce pane${delivrance.resume ? `. Voici ce que j’ai vu :\n${delivrance.resume}` : ''}`
    );
  }
  if (delivrance.cause === 'ecran') {
    return (
      `⚠️ Je n’ai RIEN soumis : la session est devant un écran${delivrance.quoi ? ` — ${delivrance.quoi}` : ' que je ne reconnais pas'}` +
      `${delivrance.resume ? `. Voici ce que j’ai vu :\n${delivrance.resume}` : ''}`
    );
  }
  if (delivrance.cause === 'bouge') {
    return (
      `⚠️ ${attenteEuLieu ? `J’ai attendu ${attente} et le texte A BOUGÉ` : 'LE TEXTE A BOUGÉ'} entre mes deux lectures : quelqu’un est ` +
      'devant ce pane en train d’écrire. Je n’y touche pas — soumettre la phrase inachevée de ' +
      'quelqu’un est irréversible. Renvoie dans un moment'
    );
  }
  if (delivrance.cause === 'illisible') {
    return (
      '⚠️ La boîte est devenue illisible pendant que j’attendais : je n’ai RIEN soumis — on ne ' +
      'soumet pas un texte qu’on n’a pas vu'
    );
  }
  return (
    `⚠️ J’ai tenté de le soumettre pour son auteur — la touche d’envoi seule, sans écrire un ` +
    `caractère — ${
      attenteEuLieu
        ? `après ${attente} d’immobilité`
        : 'sans attendre, le texte y étant arrivé collé, d’un seul coup'
    } : SANS EFFET, la boîte est restée pleine. Un ` +
    'écran de confirmation la recouvre peut-être : va regarder ce pane toi-même'
  );
}

/**
 * ⚠️ LES DEUX AVIS ONT SUIVI LE GESTE (T-20260818-0049) — pas changés, déplacés.
 *
 * Ils vivent dans `ligne-directe/src/delivrance.js`, auprès de `delivrerLaBoite` qu'ils
 * accompagnent. Les séparer d'elle est ce qu'une passe de revue de fond a rejeté : le geste
 * était atteignable par le nouvel appelant, le mot ne l'était pas.
 */
export { avisDeBoiteBloquee, avisDeBoiteVidee } from '../../ligne-directe/src/delivrance.js';
import { avisDeBoiteBloquee, avisDeBoiteVidee } from '../../ligne-directe/src/delivrance.js';

/**
 * Livrer un brief à une session, et RENDRE CE QU'ON A CONSTATÉ — jamais ce qu'on espère.
 *
 * Cette boucle vivait dans `bin/livrer.js`. Elle en sort pour que la NAISSANCE amorce le
 * premier tour par le même chemin, et c'est le sixième des sept défauts qui l'exige : une
 * session « née correctement, qui ne fait rien, parce que personne ne lui dit de commencer ».
 * L'amorcer par un `herdr agent prompt` nu aurait rejoué le défaut d'à côté — celui qui rend
 * `agent_prompted` sur un brief resté dans la boîte de saisie.
 *
 * Deux portes pour un même geste divergeraient : celle du bin a coûté trois corrections
 * (regarder avant d'écrire, vérifier par le fait, réparer une fois), et une seconde copie
 * n'en aurait hérité aucune.
 *
 * L'I/O est INJECTÉE (`appelHerdr`, `lireEcran`, `dormir`) : ce module reste sans processus
 * enfant, donc exerçable sans jamais toucher un vrai pane.
 *
 * ⚠️ CHAQUE BOOLÉEN SORT AVEC SON MOTIF (T-20260818-0031). `repare` et `delivre` valent faux par
 * défaut, et un faux ne dit pas s'il vient d'un besoin absent, d'un empêchement, ou d'un échec.
 * `causeRepare` et `causeDelivre` sont TOUJOURS présents — y compris sur le chemin nominal, le
 * seul qui n'a pas de `message` pour porter un mot, et donc le seul qui était muet.
 *
 * @returns {Promise<{ok: boolean, message?: string, statut: ?string, repare: boolean,
 *   causeRepare: string, attendu: boolean, delivre: boolean, causeDelivre: string}>}
 */

/**
 * L'ÉTAT DE LA BOÎTE TEL QU'IL FRANCHIT LA SORTIE — et pourquoi ce champ existe
 * (E-20260819-0015).
 *
 * 🔴 SIX HEURES, LE MÊME JOUR, POUR UN MOT QUI MANQUAIT. Deux orchestrateurs ont perdu ~3 heures
 * chacun sur des boîtes qu'ils croyaient bloquées : ils lisaient une SUGGESTION grisée. Ce
 * module, lui, ne s'y trompait pas — mesuré sur les 94 panes Claude Code du poste le
 * 2026-08-19, il rend « vide » sur les 33 qui en portaient une. **La lecture était juste ; ce
 * qui manquait était le mot.** L'orchestrateur voit un texte à l'écran, l'outil livre sans rien
 * dire, et rien ne le détrompe — alors il conclut au défaut de canal, et le propage.
 *
 * ⚠️ CE CHAMP NE DÉCIDE RIEN. La conduite reste celle de `contenuBoite` : une suggestion vaut
 * une boîte vide, un texte reste un texte. Il ne change aucun verdict — il les rend
 * VÉRIFIABLES, ce qui est la seule chose qui manquait.
 */
function etatVuDeLaBoite(ecran) {
  const vu = etatDeLaBoite(ecran);
  return { etat: vu.etat, texte: vu.texte, suggestion: vu.suggestion };
}

export async function livrerBrief({
  pane,
  texte,
  appelHerdr,
  lireEcran,
  dormir,
  essais = 15,
  delaiMs = 2000,
  attenteMs = 20000,
  essaisDisponible = 1,
  // LA SESSION HERDR DU DESTINATAIRE — `null` veut dire « la mienne » (T-20260814-0138).
  // Sans elle, tous les appels partaient vers la session de l'appelant, où le destinataire
  // n'est pas dans le cas normal : onze sessions tournent sur ce poste.
  socket = null,
  // `pairOccupe` : on parle à un agent DÉJÀ NÉ, qui a le droit d'être en train de travailler.
  // Voir `obstacleAvantLivraison` et `briefEstPris` — ce n'est pas la garde qu'on lève, c'est
  // le témoin qu'on change.
  pairOccupe = false,
  // ⚠️ `parLePane` — LE DESTINATAIRE EST INVISIBLE AU REGISTRE (T-20260820-0022). Toute la
  // famille `agent …` lui est fermée ; c'est la famille `pane …` qui lui parle. Le drapeau
  // vient de `trouverDestinataire`, qui l'a établi en trouvant le pane là où le registre
  // n'avait personne. Il ne change AUCUNE garde : la boîte est lue avant d'écrire, et un
  // texte qui s'y trouve fait refuser, exactement comme sur le chemin nominal.
  parLePane = false,
  // ⚠️ LE TEMPS LAISSÉ AU TEXTE COINCÉ POUR BOUGER avant qu'on le tienne pour immobile
  // (T-20260816-0114). `0` désarme la délivrance entièrement — et c'est le cas du BRIEF DE
  // NAISSANCE : une session qui vient de naître attend, et une boîte qui porterait déjà
  // quelque chose est un état qu'on ne sait pas expliquer. On ne pose pas un geste
  // irréversible sur ce qu'on ne comprend pas.
  immobiliteMs = 0,
  // ⚠️ LA SONDE D'ACTIVITÉ, INJECTABLE (T-20260821-0009 / T-20260821-0010). Le défaut que ce
  // lot ferme est né d'un témoin qu'on ne pouvait pas éprouver ; celui qui le remplace doit
  // pouvoir être COUPÉ dans un essai, sans quoi on aurait remplacé une garde non testable par
  // une autre. Par défaut : la vraie source, `~/.claude/sessions`.
  sonderActivite = (sessionId) => lireActivite(sessionId),
}) {
  // Les quatre commandes se construisent d'un coup — aucune ne porte plus d'attente depuis
  // T-20260821-0009, donc aucune ne dépend de ce qu'on n'a pas encore lu.
  const lectures = commandesLivraison(pane, texte, { parLePane });
  const vers = { socket };

  // LA SONDE D'ACTIVITÉ — voir `src/activite-session.js`. Injectable pour que les essais
  // puissent la COUPER : le critère qui garde ce lot exige de vérifier qu'une sonde muette et
  // une session au repos ne rendent PAS la même chose, et une sonde qu'on ne peut pas couper
  // laisse ce cas non éprouvé.
  const sonder = (sessionId) => sonderActivite(sessionId);

  // 1. REGARDER avant d'ecrire — la boite ET l'etat. Une boite non vide est un refus, jamais
  //    une fusion ; une session qui travaille deja est un refus aussi, parce que la preuve de
  //    prise (« elle a quitte l'attente ») serait vraie avant meme qu'on ecrive.
  //
  // `essaisDisponible` VAUT 1 PAR DÉFAUT — pour une session établie, un obstacle est un
  // refus immédiat, et c'est le comportement d'origine. L'AMORCE, elle, arrive sur une
  // session qui vient de naître : l'agent est détecté avant que son écran porte sa boîte de
  // saisie, et livrer là rend « boîte illisible » sur une session parfaitement saine.
  //
  // MESURÉ contre le vrai `claude` le 2026-08-13 : c'est ce qui faisait échouer l'amorce
  // alors que la session était née dans son lieu, portait son nom, et attendait. On ne parie
  // donc sur aucun délai — on regarde jusqu'à ce que la boîte soit là, comme la naissance
  // interroge jusqu'à ce que l'agent soit détecté.
  let statutAvant = null;
  let ecranAvant = null;
  let obstacle = null;
  // ⚠️ L'IDENTIFIANT DE SESSION SE PRÉLÈVE SUR L'APPEL QU'ON FAISAIT DÉJÀ — `agent get` et
  // `pane get` portent tous deux `agent_session`. Aucun appel de plus : une ronde balaie plus
  // de cent cinquante panes, et une sonde qui doublerait le trafic se ferait couper avant
  // d'avoir servi.
  let sessionId = null;
  let activiteAvant = { etat: ACTIVITE.INDETERMINEE, motif: null };
  for (let i = 0; i < Math.max(1, essaisDisponible); i += 1) {
    const etatAvant = await appelHerdr(lectures.interroger, vers);
    statutAvant = statutRendu(etatAvant.reponse);
    sessionId = identifiantDeSession(etatAvant.reponse);
    activiteAvant = sonder(sessionId);
    ecranAvant = await lireEcran(lectures.lireEcran, vers);
    // ⚠️ LE PANE EST PASSÉ ICI, ET C'EST CE QUI REND LA SORTIE UTILISABLE (T-20260816-0045).
    // Sans lui, les refus se taisent sur les commandes — ils restent justes, mais redeviennent
    // ce qu'ils étaient : un blocage nommé sans geste pour le lever. C'est le seul appelant
    // réel de cette fonction ; l'oublier ici rendrait toute la sortie muette en production
    // pendant que les essais unitaires resteraient verts.
    obstacle = obstacleAvantLivraison(ecranAvant, statutAvant, { pairOccupe, pane, parLePane });
    if (!obstacle) break;
    if (i < Math.max(1, essaisDisponible) - 1) await dormir(delaiMs);
  }
  // ═══ LA DÉLIVRANCE — le blocage doit FINIR, et c'est ici que ça se joue (T-20260816-0114).
  //
  // ⚠️ UNE SEULE CAUSE SE TRAITE : la boîte encombrée. Un statut indisponible et un écran
  // illisible restent des refus secs — on ne pose un geste que sur ce qu'on a vu et compris.
  let delivrance = null;
  // ⚠️ CE QU'ON OBSERVE DÉPEND DE CE QU'ON A TROUVÉ, PAS DE L'APPELANT (T-20260818-0076).
  //
  // `immobiliteMs` reste ce que l'appelant ARME : à zéro, aucune délivrance n'est tentée — c'est
  // la garde du brief de naissance, et elle ne bouge pas. Ce qu'il ne décide plus, c'est la
  // DURÉE : elle se lit sur le texte trouvé. Devant un collage, il n'y a personne derrière le
  // clavier et rien ne bougera jamais ; attendre là est du temps mort pur.
  //
  // MESURÉ SUR LE POSTE : une boîte portant `[Pasted text #33]`, destinataire au repos, texte
  // identique sur sept relevés — 300 secondes d'attente avant le geste, pour un critère qui en
  // demande moins de quinze. Le geste nu, lui, vide la boîte en quatre secondes : ce qui coûtait
  // cinq minutes était l'attente, jamais la touche d'envoi.
  let fenetreMs = immobiliteMs;
  if (obstacle && immobiliteMs > 0 && causeObstacle(ecranAvant, statutAvant, { pairOccupe, parLePane }) === CAUSES.ENCOMBREE) {
    fenetreMs = fenetreDImmobilite(contenuBoite(ecranAvant), { texteTapeMs: immobiliteMs });
    delivrance = await delivrerLaBoite({
      texteCoince: contenuBoite(ecranAvant),
      commandes: lectures,
      appelHerdr,
      lireEcran,
      dormir,
      vers,
      immobiliteMs: fenetreMs,
      essais,
      delaiMs,
    });
    if (delivrance.ok) {
      // ⚠️ ON REGARDE À NOUVEAU, ON NE DÉDUIT PAS. La délivrance a pu mettre le destinataire au
      // travail (mesuré) et sa boîte a pu se remplir à nouveau entre-temps. Le refus se
      // re-décide sur ce qu'on voit maintenant, jamais sur le fait qu'on a agi.
      const etatApres = await appelHerdr(lectures.interroger, vers);
      statutAvant = statutRendu(etatApres.reponse);
      ecranAvant = await lireEcran(lectures.lireEcran, vers);
      obstacle = obstacleAvantLivraison(ecranAvant, statutAvant, { pairOccupe, pane, parLePane });
      // ⚠️ UN REFUS QUI TAIT UN GESTE DÉJÀ POSÉ EST UN REFUS QUI MENT PAR OMISSION (relevé en
      // revue de fond). Si la boîte se rebloque entre la délivrance et l'écriture, le lecteur
      // voit « boîte pas vide » — et ignore qu'une touche d'envoi est DÉJÀ partie vers ce pane,
      // sur un AUTRE texte, qui lui est bien parti. C'est une action irréversible qu'on lui
      // cacherait ; il la découvrirait par ses effets, sans pouvoir la relier à ce refus.
      if (obstacle && delivrance.soumis) {
        obstacle =
          `${obstacle}\n⚠️ ET J’AI DÉJÀ SOUMIS un premier texte qui bloquait cette boîte — il est ` +
          'parti, le destinataire l’a pris. Ce qui bloque maintenant est arrivé APRÈS : c’est un ' +
          'second texte, pas celui que j’ai délivré.';
      }
    } else {
      // Le refus d'origine est rendu INTACT ; on lui ajoute ce qu'on a tenté. Des mots de plus,
      // pas un verdict de moins.
      obstacle = `${obstacle}\n${motDeLaDelivrance(delivrance, { immobiliteMs: fenetreMs })}`;
    }
  }

  // ⚠️ LA CAUSE DE LA DÉLIVRANCE EST DÉJÀ CALCULÉE — on la laisse sortir, on ne la refait pas
  // (T-20260818-0031). `delivrerLaBoite` la nomme sur neuf branches et elle mourait ici, dans
  // une variable locale que personne ne lisait hors de la fonction qui la produit.
  const causeDelivre = delivrance ? delivrance.cause : DELIVRANCE_NON_TENTEE;

  if (obstacle) {
    return {
      ok: false,
      message: obstacle,
      statut: statutAvant,
      // ⚠️ LA CAUSE SORT EN CHAMP, PAS SEULEMENT EN PROSE (T-20260821-0011). Elle était DÉJÀ
      // calculée — `causeObstacle` la nomme sur quatre branches — et elle mourait dans une
      // variable locale, exactement comme `causeDelivre` avant T-20260818-0031.
      //
      // Sans elle, la ronde n'avait qu'un `message` à trier, donc elle triait par MOTS. C'est
      // ce qui a rendu six lignes indiscernables : cinq bénignes et une session réellement
      // bloquée depuis des heures, toutes rangées sous « non livré ». Un tri par prose est un
      // tri qui casse au premier mot qu'on reformule.
      cause: causeObstacle(ecranAvant, statutAvant, { pairOccupe, parLePane }),
      activite: { avant: activiteAvant.etat, apres: ACTIVITE.INDETERMINEE },
      repare: false,
      // On n'a rien écrit : il n'y avait rien à réparer. C'est un fait DIFFÉRENT d'un échec de
      // réparation, et l'appelant ne pouvait pas les distinguer.
      causeRepare: CAUSES_REPARATION.RIEN_ECRIT,
      attendu: false,
      delivre: Boolean(delivrance?.soumis),
      causeDelivre,
      boite: etatVuDeLaBoite(ecranAvant),
    };
  }

  // 2. LIVRER. `--wait` est l'indice de herdr, jamais la preuve : ce qu'il rapporte peut etre
  //    un faux negatif (un tour plus rapide que son echantillonnage). On l'enregistre, on ne
  //    tranche pas dessus — c'est la relecture qui tranche.
  // ⚠️ CE QUI ÉTAIT DÉJÀ EN FILE AVANT NOUS NE TÉMOIGNE DE RIEN (T-20260815-0007) — le marqueur
  // ne prouve que s'il APPARAÎT. Un destinataire qui avait déjà des messages en attente le porte
  // avant qu'on écrive : s'en contenter rejouerait « la boîte vide », un état vrai de toute façon.
  const fileAvant = messagesEnFile(ecranAvant);

  // L'AVIS AU DESTINATAIRE ne s'ajoute QUE si quelque chose a réellement été soumis pour lui —
  // c'est le seul moyen qu'il a d'apprendre que sa boîte bloquait, et il ne doit rien annoncer
  // qui n'ait pas eu lieu (T-20260816-0114).
  // ⚠️ DEUX AVIS DISTINCTS, JAMAIS CONFONDUS. `soumis` annonce un geste qu'on a posé ;
  // `texteDisparu` annonce une disparition qu'on a CONSTATÉE sans la comprendre. Les mélanger
  // ferait annoncer un geste qui n'a pas eu lieu — le défaut exact que ce module combat.
  let texteALivrer = texte;
  if (delivrance?.soumis) {
    texteALivrer = `${avisDeBoiteBloquee({ texteLibere: delivrance.texte, immobiliteMs: fenetreMs })}\n\n${texte}`;
  } else if (delivrance?.texteDisparu) {
    texteALivrer = `${avisDeBoiteVidee({ texteDisparu: delivrance.texteDisparu })}\n\n${texte}`;
  }

  const commandes = commandesLivraison(pane, texteALivrer, { parLePane });
  // ⚠️ LE BUDGET RESTE CELUI D'UN APPEL QUI PORTE UNE ATTENTE, ALORS QUE CELUI-CI N'EN PORTE
  // PLUS — et c'est délibéré (T-20260821-0009).
  //
  // Le lien construit en T-20260818-0014 entre `attenteMs` et le plafond par appel est une
  // GARDE : il empêche de tuer un appel qui progresse, et la ronde de rapporter en « session
  // muette » une livraison en cours. Retirer `--wait` retire l'attente, donc le besoin
  // immédiat — mais retirer aussi le budget dans le même geste désarmerait la garde au passage,
  // sans qu'un seul essai rougisse. On ne fait pas ça : `attenteMs` reste le paramètre du
  // module, `budgetPourUneAttente` reste éprouvée, et un plafond trop LARGE ne coûte rien
  // puisque l'appel rend désormais tout de suite.
  const livraison = await appelHerdr(commandes.livrer, { ...vers, delaiMs: budgetPourUneAttente(attenteMs) });

  // 3. VERIFIER PAR LE FAIT — la session a-t-elle quitte l'attente ?
  const prisMaintenant = async () => {
    const etat = await appelHerdr(commandes.interroger, vers);
    const statut = statutRendu(etat.reponse);
    // ⚠️ ON RE-PRÉLÈVE L'IDENTIFIANT PLUTÔT QUE DE RÉUTILISER CELUI D'AVANT. Un pane peut avoir
    // changé de session entre-temps — c'est rare, et c'est précisément le cas où réutiliser
    // l'ancien ferait juger l'activité d'une session qui n'est plus là. On retombe sur celui
    // d'avant seulement si l'appel n'a rien rendu, pour ne pas rendre la sonde muette sur un
    // simple hoquet de lecture.
    const activiteApres = sonder(identifiantDeSession(etat.reponse) ?? sessionId);
    const terminal = await lireEcran(commandes.lireEcran, vers);
    return {
      pris: briefEstPris({
        statut,
        terminal,
        statutAvant,
        envoiAccepte: livraison.ok || repare,
        fileApparue: !fileAvant && messagesEnFile(terminal),
        activiteAvant: activiteAvant.etat,
        activiteApres: activiteApres.etat,
      }),
      statut,
      terminal,
      activiteApres,
    };
  };

  let repare = false;
  let vu = await prisMaintenant();
  for (let i = 0; i < essais && !vu.pris; i += 1) {
    await dormir(delaiMs);
    vu = await prisMaintenant();
  }

  // 4. REPARER une fois le cas connu : le texte est bien dans la boite, la soumission n'est
  //    pas partie. On envoie la touche d'envoi, puis on re-verifie — sans jamais reecrire le
  //    brief, ce qui le collerait a lui-meme.
  //
  // ⚠️ ET ON REGARDE L'ÉCRAN AVANT DE PRESSER ENTRÉE (T-20260817-0008, relevé en PASSE DE FOND).
  //
  // Ce bloc était le JUMEAU NON GARDÉ de `delivrerLaBoite`. Il lisait le CONTENU DE LA BOÎTE
  // avant de soumettre, et jamais l'ÉCRAN — la moitié exacte du défaut que ce lot ferme trente
  // lignes plus haut. « Une porte sur deux » commise dans le correctif écrit pour la fermer, et
  // sur le chemin NORMAL de toute réparation après un envoi raté.
  //
  // LE SCÉNARIO, ET IL N'A RIEN D'EXOTIQUE : la boîte est vue vide, on écrit, puis un dialogue
  // s'affiche PENDANT la boucle de vérification — l'agent a démarré une commande sur notre
  // brief, et Claude Code demande la permission. Notre texte est toujours dans la boîte, donc
  // `reste` est non vide, donc la touche d'envoi partait : elle aurait APPROUVÉ ce dialogue.
  //
  // Le refus qui suit dit alors POURQUOI on n'a pas réparé — sans quoi le lecteur verrait
  // « boîte encore pleine » et retenterait le même geste à l'aveugle.
  let dialogueALaReparation = false;
  // ⚠️ LE MOTIF SE POSE SUR LA BRANCHE QU'ON VIENT DE PRENDRE — il n'est pas rediagnostiqué
  // après coup (T-20260818-0031). Chaque `if` ci-dessous décidait déjà ; il ne le disait pas.
  // Le défaut par défaut est `INUTILE` parce que c'est ce qu'on constate quand on n'entre même
  // pas ici : le brief a été pris, la réparation n'avait pas lieu d'être.
  let causeRepare = CAUSES_REPARATION.INUTILE;
  if (!vu.pris) {
    const reste = contenuBoite(vu.terminal);
    if (reste && ecranAttendUnChoix(vu.terminal)) {
      dialogueALaReparation = true;
      causeRepare = CAUSES_REPARATION.DIALOGUE;
    } else if (reste) {
      const envoi = await appelHerdr(commandes.soumettre, vers);
      repare = envoi.ok;
      // Le geste a EU LIEU dans les deux cas ; ce qui change est ce que herdr en a fait. Les
      // confondre laisserait croire qu'aucune touche n'est partie vers ce pane, alors qu'une
      // touche d'envoi est une action irréversible dont l'appelant doit savoir qu'elle a été
      // tentée — c'est la règle du refus qui ne tait pas un geste déjà posé, trente lignes
      // plus haut, appliquée au champ plutôt qu'à la prose.
      causeRepare = envoi.ok ? CAUSES_REPARATION.SOUMISE : CAUSES_REPARATION.ENVOI_REFUSE;
      for (let i = 0; i < essais && !vu.pris; i += 1) {
        await dormir(delaiMs);
        vu = await prisMaintenant();
      }
    } else {
      // Ni dialogue ni texte : on n'avait rien à soumettre. `null` et `''` ne sont pas le même
      // état — l'un dit qu'on n'a pas su lire, l'autre qu'il n'y avait rien.
      causeRepare = reste === null ? CAUSES_REPARATION.BOITE_ILLISIBLE : CAUSES_REPARATION.BOITE_VIDE;
    }
  }

  if (!vu.pris) {
    const reste = contenuBoite(vu.terminal);
    const apres = vu.activiteApres?.etat ?? ACTIVITE.INDETERMINEE;
    const motActivite = motDeLActivite({
      avant: activiteAvant.etat,
      apres,
      motifAvant: activiteAvant.motif,
      motifApres: vu.activiteApres?.motif,
    });
    return {
      ok: false,
      statut: vu.statut,
      repare,
      causeRepare,
      attendu: livraison.ok,
      delivre: Boolean(delivrance?.soumis),
      causeDelivre,
      // \u26a0\ufe0f L'\u00c9TAT DE LA SONDE SORT DANS LE VERDICT, PAS SEULEMENT DANS LA PROSE (T-20260821-0011).
      // La ronde en a besoin pour TRIER : une non-livraison dont la sonde \u00e9tait muette n'est pas
      // un agent bloqu\u00e9, c'est un agent qu'on n'a pas su regarder. Les confondre, c'est le
      // d\u00e9faut d'origine \u2014 six lignes identiques dont une seule m\u00e9ritait qu'on se l\u00e8ve.
      activite: { avant: activiteAvant.etat, apres },
      message:
        `le brief n\u2019a pas \u00e9t\u00e9 pris par la session de ${pane} \u2014 statut \u00ab ${vu.statut ?? '\u2014'} \u00bb, ` +
        `bo\u00eete ${reste === null ? 'illisible' : reste === '' ? 'vide' : `encore pleine (\u00ab ${reste.slice(0, 60)}\u2026 \u00bb)`}` +
        (motActivite ? ` ; ${motActivite}` : '') +
        `${livraison.ok ? '' : ` ; herdr avait dit : ${livraison.message}`}` +
        (dialogueALaReparation
          ? '\n⚠️ ET JE N’AI PAS TENTÉ DE LE SOUMETTRE : un DIALOGUE qui attend un choix s’est ' +
            'affiché pendant que je vérifiais. La touche d’envoi y aurait confirmé l’option ' +
            'surlignée au lieu de soumettre mon texte — une action que personne ne m’a demandé ' +
            'd’approuver. Quelqu’un doit répondre à ce dialogue devant ce pane ; mon brief est ' +
            'toujours dans la boîte, entier, et partira quand la boîte sera rendue.'
          : '') +
        // ⚠️ ET LA MOITIÉ SYMÉTRIQUE — CELLE OÙ L'ON A AGI (T-20260819-0009).
        //
        // L'invariant est posé trente lignes plus haut, sur le refus du cas symétrique : UN
        // REFUS QUI TAIT UN GESTE DÉJÀ POSÉ EST UN REFUS QUI MENT PAR OMISSION. Il n'était
        // appliqué QUE de ce côté-là. Ici, la branche qui dit « je n'ai PAS agi » — le dialogue,
        // juste au-dessus — portait cinq lignes de prose, et les deux branches qui disent
        // « j'AI agi » n'en portaient aucune. « Une porte sur deux », appliqué à un invariant
        // que ce module se donne à lui-même.
        //
        // ⚠️ CE N'EST PAS UN DÉFAUT DU CHAMP. `causeRepare` sort déjà `soumise` / `envoi-refuse`
        // (T-20260818-0031) et reste honnête. Le champ sert la MACHINE ; ce `message` sert le
        // LECTEUR — un agent ou un humain qui cherche pourquoi son brief n'est pas passé, et qui
        // décidera à partir de lui s'il presse une touche à son tour.
        //
        // ⚠️ ET LE MOTIF N'EST PAS REDIAGNOSTIQUÉ : on lit `causeRepare`, posée sur la branche
        // qu'on a prise à l'étape 4. Le relire sur l'écran ferait porter à ce refus le motif
        // d'un état postérieur au geste.
        (causeRepare === CAUSES_REPARATION.SOUMISE
          ? '\n⚠️ ET UNE TOUCHE D’ENVOI EST DÉJÀ PARTIE VERS CE PANE : le texte était bien dans ' +
            'la boîte et n’en partait pas, je l’ai donc soumis — herdr a accepté ce geste. Il ' +
            'N’A PAS SUFFI : la boîte n’a pas été vidée pour autant. Ce que tu vois n’est donc ' +
            'pas un pane intact — une action irréversible y a déjà eu lieu, et elle est de moi. ' +
            'Va le regarder avant d’en presser une autre.'
          : causeRepare === CAUSES_REPARATION.ENVOI_REFUSE
            ? '\n⚠️ ET LA TOUCHE D’ENVOI A ÉTÉ TENTÉE VERS CE PANE, PUIS REFUSÉE PAR HERDR : le ' +
              'texte était bien dans la boîte et n’en partait pas, j’ai donc demandé la ' +
              'soumission — herdr a repoussé la commande. Le geste a été TENTÉ, pas abouti : ce ' +
              'refus de herdr est la seule raison de croire qu’aucune touche n’a atteint ce ' +
              'pane. Va le regarder avant d’en presser une autre.'
            : ''),
    };
  }

  // ⚠️ C'EST CETTE LIGNE-CI QUI A PRODUIT LE DÉFAUT (T-20260818-0031). Le chemin NOMINAL est le
  // seul qui n'a pas de `message` pour porter un mot : un `{ok:true,…,repare:false}` y était
  // donc entièrement muet, et c'est exactement la sortie mesurée le 2026-08-18.
  return {
    ok: true,
    statut: vu.statut,
    repare,
    causeRepare,
    attendu: livraison.ok,
    delivre: Boolean(delivrance?.soumis),
    causeDelivre,
    // Le chemin nominal porte la même sonde que le refus — sans quoi on ne saurait pas, sur une
    // prise, laquelle des trois preuves l'a établie.
    activite: { avant: activiteAvant.etat, apres: vu.activiteApres?.etat ?? ACTIVITE.INDETERMINEE },
    // ⚠️ L'ÉTAT DE LA BOÎTE **AVANT** L'ÉCRITURE, jamais après — c'est celui-là que le lecteur a
    // sous les yeux quand il doute. Après notre passage, la boîte porte notre texte, et le
    // rendre ici ferait dire « pleine » d'un encombrement qu'on vient de créer soi-même.
    boite: etatVuDeLaBoite(ecranAvant),
  };
}

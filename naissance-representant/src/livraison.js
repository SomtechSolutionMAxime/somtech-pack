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
export { contenuBoite, boiteEstVide } from '../../ligne-directe/src/boite.js';
import { contenuBoite, boiteEstVide, messagesEnFile } from '../../ligne-directe/src/boite.js';
// ⚠️ LA SONDE D'ÉCRAN VIT DANS `ligne-directe/src/ecran.js` — un seul endroit sait reconnaître un
// écran de blocage, et `bin/naitre.js` s'en sert déjà. La revue de fond a relevé que la livraison
// ne s'en servait PAS : elle regardait la boîte sans jamais regarder ce qui pouvait s'afficher
// par-dessus. Sur un geste irréversible, c'était la porte-sur-deux dans sa forme la plus chère.
// ⚠️ `ecranAttendUnChoix` EST REPRISE, PAS RÉÉCRITE (T-20260817-0008, règle d'or n°15). Elle
// existe dans `ecran.js` depuis `T-20260817-0006`, où elle a été RESSERRÉE puis MESURÉE contre
// les faux positifs — une première version, plus large, déclarait 3 panes sur 14 « en attente de
// choix » à tort. En écrire une seconde ici aurait rejoué « une porte sur deux » dans le
// correctif écrit pour la fermer : la copie n'hérite jamais des corrections de l'autre.
import { etatDeLEcran, ressembleAUnChoix, ecranAttendUnChoix, resumeDeLEcran } from '../../ligne-directe/src/ecran.js';

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

export function briefEstPris({ statut, terminal, statutAvant = null, envoiAccepte = true, fileApparue = false }) {
  // UN MESSAGE MIS EN FILE EST UN MESSAGE PRIS, quoi qu'en dise le reste. C'est le seul témoin
  // disponible sur un pair occupé — et il porte bien sur un état qui pouvait être différent,
  // puisque l'appelant a constaté son APPARITION.
  if (fileApparue) return true;

  // ⚠️ QUAND L'OUTIL DIT LUI-MÊME QUE RIEN N'EST PARTI, LA BOÎTE VIDE NE PROUVE RIEN.
  //
  // Relevé en revue de fond. Si l'appel d'envoi échoue sans jamais toucher la boîte, elle est
  // vide AVANT et APRÈS — et « boîte vide » était compté comme la preuve d'une prise. Or une
  // boîte vide parce que rien n'a été écrit est le contraire d'une preuve : c'est l'état par
  // défaut, celui qui ne pouvait pas être différent. Le témoin doit alors être POSITIF.
  //
  // `envoiAccepte` redevient vrai après une RÉPARATION réussie, et c'est juste : y arriver
  // suppose qu'on a vu notre propre texte dans la boîte, puis qu'on l'a vu en sortir.
  if (!envoiAccepte) return statutAvant !== 'working' && (statut === 'working' || statut === 'done');

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
  if (statutAvant === 'working') return boiteEstVide(terminal);

  const partie = statut === 'working' || statut === 'done';
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
export function causeObstacle(terminal, statut, { pairOccupe = false } = {}) {
  if (!ETATS_DISPONIBLES.includes(statut) && !(pairOccupe && statut === 'working')) return CAUSES.STATUT;
  if (ecranAttendUnChoix(terminal)) return CAUSES.DIALOGUE;
  const reste = contenuBoite(terminal);
  if (reste === null) return CAUSES.ILLISIBLE;
  if (reste !== '') return CAUSES.ENCOMBREE;
  return null;
}

export function obstacleAvantLivraison(terminal, statut, { pairOccupe = false, pane = null } = {}) {
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
  const cause = causeObstacle(terminal, statut, { pairOccupe });
  if (cause === CAUSES.STATUT) {
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
    return (
      `la boîte de saisie${ou} n’est pas vide (elle contient « ${reste.slice(0, 80)}${reste.length > 80 ? '…' : ''} ») — ` +
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
export function commandesLivraison(pane, texte, { attenteMs = 20000, dejaAuTravail = false } = {}) {
  if (!pane) throw new Error('le pane de la session à briefer est requis');
  if (!String(texte ?? '').trim()) throw new Error('un brief vide n’est pas un brief');
  return {
    // `--format ansi` — LE GRIS EST LA SEULE CHOSE QUI DISTINGUE UNE SUGGESTION D'UN RESTE.
    // Sans lui, la boîte VIDE d'une session qui propose une phrase de son historique se lit
    // comme une boîte pleine, et la livraison est refusée sans raison (mesuré, T-20260814-0138).
    lireEcran: ['agent', 'read', pane, '--format', 'ansi'],
    interroger: ['agent', 'get', pane],
    // ⚠️ PAS D'ATTENTE QU'ON SAIT IMPOSSIBLE À SATISFAIRE (T-20260815-0007).
    //
    // `--wait --until working` guette une TRANSITION vers « working ». Sur un destinataire qui y
    // est déjà, elle ne peut rien observer : elle expire, et rend un `timeout` que l'appelant
    // prenait pour un envoi manqué — alors que le message était parti en file d'attente.
    //
    // Demander une attente dont on sait qu'elle échouera, c'est fabriquer soi-même le faux
    // négatif qu'on ira ensuite interpréter. On ne la demande donc pas ; la preuve se relit,
    // comme partout ailleurs ici.
    livrer: dejaAuTravail
      ? ['agent', 'prompt', pane, texte]
      : ['agent', 'prompt', pane, texte, '--wait', '--until', 'working', '--timeout', String(attenteMs)],
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
 *   • `liberee-seule` — son auteur l'a soumise pendant qu'on attendait : on n'a RIEN touché ;
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
  if (apres === '') return { ok: true, cause: 'liberee-seule', soumis: false };
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

/**
 * Ce qu'on ajoute au refus quand la délivrance n'a pas abouti — DES MOTS, jamais un verdict.
 *
 * Le refus d'origine est rendu intact et ce texte vient APRÈS lui : c'est la règle posée par
 * `T-20260816-0045` (un refus dit ce qui bloque et le geste qui le lève) appliquée à un
 * blocage qu'on a en plus essayé de lever soi-même. Dire qu'on a essayé évite au lecteur de
 * retenter le même geste à l'aveugle.
 */
export function motDeLaDelivrance(delivrance, { immobiliteMs = 0 } = {}) {
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
      `⚠️ J’ai attendu ${attente} et le texte A BOUGÉ entre mes deux lectures : quelqu’un est ` +
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
    `caractère — après ${attente} d’immobilité : SANS EFFET, la boîte est restée pleine. Un ` +
    'écran de confirmation la recouvre peut-être : va regarder ce pane toi-même'
  );
}

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
  return (
    '⚠️ TA BOÎTE DE SAISIE ÉTAIT BLOQUÉE — elle contenait un texte non soumis, resté immobile ' +
    `pendant les ${Math.round(immobiliteMs / 60000)} min où je l’ai observée. Je l’ai SOUMIS pour ` +
    'son auteur — sans y écrire un caractère — puis j’ai livré mon message. Tu vas donc recevoir ' +
    'les deux.\n\n' +
    `VOICI CE QUI A ÉTÉ SOUMIS EN TON NOM (tel que je l’ai lu à l’écran, qui n’en montre que la partie visible) :\n` +
    `┈┈┈\n${texte}\n┈┈┈\n\n` +
    'Si c’était un brouillon à toi, il vient de partir tel quel — et tu sais maintenant lequel. ' +
    'Tant qu’une boîte reste pleine, PERSONNE ne peut te joindre et rien ne te le dit.'
  );
}

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
 * @returns {Promise<{ok: boolean, message?: string, statut: ?string, repare: boolean, attendu: boolean}>}
 */
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
  // ⚠️ LE TEMPS LAISSÉ AU TEXTE COINCÉ POUR BOUGER avant qu'on le tienne pour immobile
  // (T-20260816-0114). `0` désarme la délivrance entièrement — et c'est le cas du BRIEF DE
  // NAISSANCE : une session qui vient de naître attend, et une boîte qui porterait déjà
  // quelque chose est un état qu'on ne sait pas expliquer. On ne pose pas un geste
  // irréversible sur ce qu'on ne comprend pas.
  immobiliteMs = 0,
}) {
  // Les commandes de LECTURE se construisent tout de suite ; celle qui ÉCRIT attend de savoir
  // si le destinataire travaille déjà — l'attente qu'elle porte n'a de sens que sinon.
  const lectures = commandesLivraison(pane, texte, { attenteMs });
  const vers = { socket };

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
  for (let i = 0; i < Math.max(1, essaisDisponible); i += 1) {
    const etatAvant = await appelHerdr(lectures.interroger, vers);
    statutAvant = etatAvant.reponse?.result?.agent?.agent_status ?? null;
    ecranAvant = await lireEcran(lectures.lireEcran, vers);
    // ⚠️ LE PANE EST PASSÉ ICI, ET C'EST CE QUI REND LA SORTIE UTILISABLE (T-20260816-0045).
    // Sans lui, les refus se taisent sur les commandes — ils restent justes, mais redeviennent
    // ce qu'ils étaient : un blocage nommé sans geste pour le lever. C'est le seul appelant
    // réel de cette fonction ; l'oublier ici rendrait toute la sortie muette en production
    // pendant que les essais unitaires resteraient verts.
    obstacle = obstacleAvantLivraison(ecranAvant, statutAvant, { pairOccupe, pane });
    if (!obstacle) break;
    if (i < Math.max(1, essaisDisponible) - 1) await dormir(delaiMs);
  }
  // ═══ LA DÉLIVRANCE — le blocage doit FINIR, et c'est ici que ça se joue (T-20260816-0114).
  //
  // ⚠️ UNE SEULE CAUSE SE TRAITE : la boîte encombrée. Un statut indisponible et un écran
  // illisible restent des refus secs — on ne pose un geste que sur ce qu'on a vu et compris.
  let delivrance = null;
  if (obstacle && immobiliteMs > 0 && causeObstacle(ecranAvant, statutAvant, { pairOccupe }) === CAUSES.ENCOMBREE) {
    delivrance = await delivrerLaBoite({
      texteCoince: contenuBoite(ecranAvant),
      commandes: lectures,
      appelHerdr,
      lireEcran,
      dormir,
      vers,
      immobiliteMs,
      essais,
      delaiMs,
    });
    if (delivrance.ok) {
      // ⚠️ ON REGARDE À NOUVEAU, ON NE DÉDUIT PAS. La délivrance a pu mettre le destinataire au
      // travail (mesuré) et sa boîte a pu se remplir à nouveau entre-temps. Le refus se
      // re-décide sur ce qu'on voit maintenant, jamais sur le fait qu'on a agi.
      const etatApres = await appelHerdr(lectures.interroger, vers);
      statutAvant = etatApres.reponse?.result?.agent?.agent_status ?? null;
      ecranAvant = await lireEcran(lectures.lireEcran, vers);
      obstacle = obstacleAvantLivraison(ecranAvant, statutAvant, { pairOccupe, pane });
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
      obstacle = `${obstacle}\n${motDeLaDelivrance(delivrance, { immobiliteMs })}`;
    }
  }

  if (obstacle) {
    return {
      ok: false,
      message: obstacle,
      statut: statutAvant,
      repare: false,
      attendu: false,
      delivre: Boolean(delivrance?.soumis),
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
  const texteALivrer = delivrance?.soumis
    ? `${avisDeBoiteBloquee({ texteLibere: delivrance.texte, immobiliteMs })}\n\n${texte}`
    : texte;

  const commandes = commandesLivraison(pane, texteALivrer, { attenteMs, dejaAuTravail: statutAvant === 'working' });
  const livraison = await appelHerdr(commandes.livrer, vers);

  // 3. VERIFIER PAR LE FAIT — la session a-t-elle quitte l'attente ?
  const prisMaintenant = async () => {
    const etat = await appelHerdr(commandes.interroger, vers);
    const statut = etat.reponse?.result?.agent?.agent_status ?? null;
    const terminal = await lireEcran(commandes.lireEcran, vers);
    return {
      pris: briefEstPris({
        statut,
        terminal,
        statutAvant,
        envoiAccepte: livraison.ok || repare,
        fileApparue: !fileAvant && messagesEnFile(terminal),
      }),
      statut,
      terminal,
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
  if (!vu.pris) {
    const reste = contenuBoite(vu.terminal);
    if (reste && ecranAttendUnChoix(vu.terminal)) {
      dialogueALaReparation = true;
    } else if (reste) {
      const envoi = await appelHerdr(commandes.soumettre, vers);
      repare = envoi.ok;
      for (let i = 0; i < essais && !vu.pris; i += 1) {
        await dormir(delaiMs);
        vu = await prisMaintenant();
      }
    }
  }

  if (!vu.pris) {
    const reste = contenuBoite(vu.terminal);
    return {
      ok: false,
      statut: vu.statut,
      repare,
      attendu: livraison.ok,
      delivre: Boolean(delivrance?.soumis),
      message:
        `le brief n\u2019a pas \u00e9t\u00e9 pris par la session de ${pane} \u2014 statut \u00ab ${vu.statut ?? '\u2014'} \u00bb, ` +
        `bo\u00eete ${reste === null ? 'illisible' : reste === '' ? 'vide' : `encore pleine (\u00ab ${reste.slice(0, 60)}\u2026 \u00bb)`}` +
        `${livraison.ok ? '' : ` ; herdr avait dit : ${livraison.message}`}` +
        (dialogueALaReparation
          ? '\n⚠️ ET JE N’AI PAS TENTÉ DE LE SOUMETTRE : un DIALOGUE qui attend un choix s’est ' +
            'affiché pendant que je vérifiais. La touche d’envoi y aurait confirmé l’option ' +
            'surlignée au lieu de soumettre mon texte — une action que personne ne m’a demandé ' +
            'd’approuver. Quelqu’un doit répondre à ce dialogue devant ce pane ; mon brief est ' +
            'toujours dans la boîte, entier, et partira quand la boîte sera rendue.'
          : ''),
    };
  }

  return { ok: true, statut: vu.statut, repare, attendu: livraison.ok, delivre: Boolean(delivrance?.soumis) };
}

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
import { contenuBoite, boiteEstVide } from '../../ligne-directe/src/boite.js';

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
const FILE_DATTENTE = /Press up to edit queued messages/;

export function messagesEnFile(texteTerminal) {
  return FILE_DATTENTE.test(String(texteTerminal ?? ''));
}

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
 */
export function obstacleAvantLivraison(terminal, statut, { pairOccupe = false } = {}) {
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
  if (!ETATS_DISPONIBLES.includes(statut) && !(pairOccupe && statut === 'working')) {
    return (
      `la session n’est pas disponible pour un brief (statut « ${statut ?? '—'} ») — ` +
      'livrer maintenant ne se prouverait pas : elle a déjà quitté l’attente sans nous'
    );
  }
  const reste = contenuBoite(terminal);
  if (reste === null) {
    return 'la boîte de saisie de la session est illisible — on ne livre pas dans ce qu’on ne voit pas';
  }
  if (reste !== '') {
    return (
      `la boîte de saisie n’est pas vide (elle contient « ${reste.slice(0, 80)}${reste.length > 80 ? '…' : ''} ») — ` +
      'écrire par-dessus ne livrerait pas deux messages, ça en livrerait UN, les deux textes collés'
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
    obstacle = obstacleAvantLivraison(ecranAvant, statutAvant, { pairOccupe });
    if (!obstacle) break;
    if (i < Math.max(1, essaisDisponible) - 1) await dormir(delaiMs);
  }
  if (obstacle) return { ok: false, message: obstacle, statut: statutAvant, repare: false, attendu: false };

  // 2. LIVRER. `--wait` est l'indice de herdr, jamais la preuve : ce qu'il rapporte peut etre
  //    un faux negatif (un tour plus rapide que son echantillonnage). On l'enregistre, on ne
  //    tranche pas dessus — c'est la relecture qui tranche.
  // ⚠️ CE QUI ÉTAIT DÉJÀ EN FILE AVANT NOUS NE TÉMOIGNE DE RIEN (T-20260815-0007) — le marqueur
  // ne prouve que s'il APPARAÎT. Un destinataire qui avait déjà des messages en attente le porte
  // avant qu'on écrive : s'en contenter rejouerait « la boîte vide », un état vrai de toute façon.
  const fileAvant = messagesEnFile(ecranAvant);

  const commandes = commandesLivraison(pane, texte, { attenteMs, dejaAuTravail: statutAvant === 'working' });
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
  if (!vu.pris) {
    const reste = contenuBoite(vu.terminal);
    if (reste) {
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
      message:
        `le brief n\u2019a pas \u00e9t\u00e9 pris par la session de ${pane} \u2014 statut \u00ab ${vu.statut ?? '\u2014'} \u00bb, ` +
        `bo\u00eete ${reste === null ? 'illisible' : reste === '' ? 'vide' : `encore pleine (\u00ab ${reste.slice(0, 60)}\u2026 \u00bb)`}` +
        `${livraison.ok ? '' : ` ; herdr avait dit : ${livraison.message}`}`,
    };
  }

  return { ok: true, statut: vu.statut, repare, attendu: livraison.ok };
}

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

/** La marque de la boîte de saisie d'une session Claude Code dans un terminal. */
const INVITE = '❯';

/**
 * Le contenu ACTUEL de la boîte de saisie, lu dans un dump de terminal.
 *
 * La boîte est la DERNIÈRE invite du dump : les invites précédentes appartiennent au
 * transcript (les messages déjà soumis y restent affichés, précédés de la même marque). Lire
 * la première, ou n'importe laquelle, ferait prendre un message déjà traité pour un reste.
 *
 * Rend `''` quand la boîte est vide. Rend `null` quand aucune invite n'est visible — ce n'est
 * PAS une boîte vide : c'est une boîte qu'on n'a pas su lire, et les deux ne se traitent pas
 * pareil (on ne livre pas dans ce qu'on ne voit pas).
 */
export function contenuBoite(texteTerminal) {
  const lignes = String(texteTerminal ?? '').split('\n');
  for (let i = lignes.length - 1; i >= 0; i -= 1) {
    const ligne = lignes[i];
    const j = ligne.indexOf(INVITE);
    if (j === -1) continue;
    return ligne.slice(j + INVITE.length).trim();
  }
  return null;
}

/** La boîte est-elle vide ET lisible ? Une boîte illisible n'est pas une boîte vide. */
export function boiteEstVide(texteTerminal) {
  return contenuBoite(texteTerminal) === '';
}

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
export function briefEstPris({ statut, terminal }) {
  const partie = statut === 'working' || statut === 'done';
  return partie || boiteEstVide(terminal);
}

/**
 * Ce que la boîte contient de trop AVANT qu'on écrive — la raison de refuser.
 *
 * Rend `null` quand on peut livrer, sinon le message qui dit pourquoi on ne livre pas. Écrire
 * par-dessus un reste ne produit pas deux messages : ça produit UN message faux (mesuré).
 */
export function obstacleAvantLivraison(terminal) {
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
export function commandesLivraison(pane, texte, { attenteMs = 20000 } = {}) {
  if (!pane) throw new Error('le pane de la session à briefer est requis');
  if (!String(texte ?? '').trim()) throw new Error('un brief vide n’est pas un brief');
  return {
    lireEcran: ['agent', 'read', pane],
    interroger: ['agent', 'get', pane],
    livrer: ['agent', 'prompt', pane, texte, '--wait', '--until', 'working', '--timeout', String(attenteMs)],
    soumettre: ['agent', 'send-keys', pane, 'Enter'],
  };
}

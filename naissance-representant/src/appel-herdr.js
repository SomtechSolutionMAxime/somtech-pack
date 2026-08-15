// appel-herdr.js — les deux façons de parler à `herdr`, écrites UNE fois.
//
// POURQUOI CE FICHIER EXISTE (T-20260813-0054)
//
// `appelHerdr` et `lireEcran` vivaient en TROIS exemplaires identiques — `bin/naitre.js`,
// `bin/livrer.js`, `bin/rendez-vous.js`. Trois copies d'un même geste ne restent identiques
// que jusqu'à la première correction : c'est très exactement le motif « une porte sur deux »
// qui a déjà coûté six occurrences à ce dépôt, et le correctif d'aujourd'hui devait toucher
// les trois. Il n'en touche plus qu'une.
//
// CE QUE CES DEUX FONCTIONS GARANTISSENT
//
//   1. AUCUNE EXCEPTION ne remonte : un appel rend toujours un verdict lisible. C'est ce qui
//      ferme la porte au « code 0 alors que rien n'a abouti » — le verdict se lit dans la
//      RÉPONSE de herdr, jamais dans son code de sortie (voir `lireReponseHerdr`).
//
//   2. « HERDR EST INTROUVABLE » NE SE FOND PAS DANS LES AUTRES ÉCHECS. Un outil qui n'a pas
//      démarré n'a rien répondu : il ne prouve ni qu'un agent est mort, ni qu'une boîte est
//      vide, ni qu'un rendez-vous n'avait personne à réveiller. Le verdict porte donc
//      `outilIntrouvable`, et son message parle du programme.

import { OUTILS, OutilIntrouvable, lancer } from '../../ligne-directe/src/outils.js';
import { lireReponseHerdr } from './naissance.js';

/** Un écran de terminal tient largement là-dedans ; au-delà, c'est herdr qui déraille. */
const TAILLE_MAX = 16 * 1024 * 1024;

/**
 * À QUELLE SESSION HERDR ON PARLE — et sans ça, on ne parlait qu'à la sienne (T-20260814-0138).
 *
 * herdr trouve sa session par `HERDR_SOCKET_PATH`. Ces appels ne la posaient jamais : ils
 * héritaient passivement de l'environnement de l'appelant, donc cherchaient toujours le pane
 * dans la session d'où part le geste. Onze sessions tournent sur ce poste — le cas NORMAL est
 * que le destinataire soit ailleurs, et la voie sûre échouait précisément là, sur un refus qui
 * parlait d'un statut « — » et envoyait chercher un défaut chez le destinataire.
 *
 * Le veilleur de `ligne-directe` savait déjà le faire (`src/herdr.js`) ; la leçon n'avait pas
 * traversé jusqu'ici, alors que ce fichier importe déjà le même `outils.js`.
 */
function envDe(socket) {
  return socket ? { env: { ...process.env, HERDR_SOCKET_PATH: socket } } : {};
}

/**
 * Un appel herdr qui rend du JSON, et son verdict — jamais une exception.
 *
 * @returns {Promise<{ok: boolean, reponse: ?object, message: string, outilIntrouvable?: boolean}>}
 */
export async function appelHerdr(commande, { resultatAttendu = true, executer, socket = null } = {}) {
  try {
    const { stdout } = await lancer(OUTILS.herdr, commande, { maxBuffer: TAILLE_MAX, executer, ...envDe(socket) });
    return lireReponseHerdr(stdout, { commande, resultatAttendu });
  } catch (err) {
    // herdr n'a pas démarré : il n'a donc RIEN refusé et RIEN répondu. Le faire passer par
    // `lireReponseHerdr` rendrait « n'a rendu aucun résultat exploitable », qui se lit comme
    // une réponse malformée de l'outil — on chercherait du côté de herdr un défaut qui est
    // dans le PATH de l'appelant.
    if (err instanceof OutilIntrouvable) {
      return { ok: false, reponse: null, outilIntrouvable: true, message: err.message };
    }
    return lireReponseHerdr(err?.stdout ?? '', { commande, erreurProcessus: err, resultatAttendu });
  }
}

/**
 * `herdr agent read` rend du TEXTE BRUT, pas du JSON — il ne passe donc pas par le lecteur
 * commun. Un échec de lecture rend `null`, que `contenuBoite` traduira en « boîte illisible »,
 * jamais en « boîte vide » : on ne livre pas dans ce qu'on ne voit pas.
 *
 * C'est aussi ce qui rend un `herdr` absent inoffensif ICI : `null` fait REFUSER la livraison,
 * là où « boîte vide » l'aurait autorisée par-dessus un contenu qu'on n'a jamais vu.
 */
export async function lireEcran(commande, { executer, socket = null } = {}) {
  try {
    const { stdout } = await lancer(OUTILS.herdr, commande, { maxBuffer: TAILLE_MAX, executer, ...envDe(socket) });
    return stdout;
  } catch (err) {
    return typeof err?.stdout === 'string' && err.stdout ? err.stdout : null;
  }
}

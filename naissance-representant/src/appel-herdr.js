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
 * LE TEMPS QU'ON LAISSE À **UN** APPEL — parce qu'un appel sans limite n'échoue jamais, il PEND
 * (T-20260818-0014, relevé en revue de fond).
 *
 * ⚠️ CE QUE LE PLAFOND DE LA RONDE NE PEUT PAS FAIRE À LA PLACE. Le plafond tue le PROCESSUS
 * de la ronde ; il ne tue pas l'appel `herdr` en vol. Mesuré en revue : un enfant lancé par
 * `execFile` **survit** au `process.exit()` de son parent, et continue de tourner, orphelin.
 * Sans limite ici, chaque ronde qui meurt de son plafond laisse un `herdr` bloqué derrière
 * elle — un par heure, sur la même cible, indéfiniment.
 *
 * Et il y a mieux : avec une limite, un `herdr` qui ne répond pas cesse d'être une panne de la
 * ronde. Il devient une session MUETTE — un fait que la ronde sait déjà rapporter, nommément.
 * Le plafond redevient ce qu'il doit être : le dernier recours, pas le seul.
 *
 * Une minute est très large — les appels mesurés sur ce poste se comptent en dizaines de
 * millisecondes, et une ronde en balaie plus de cent cinquante. Ce qui dépasse la minute ne
 * répond plus.
 */
const DELAI_APPEL_MS = Number(process.env.HERDR_DELAI_APPEL_MS || 60000);

/**
 * LE BUDGET D'UN APPEL QUI PORTE UNE ATTENTE — et pourquoi il ne peut PAS être une constante.
 *
 * ⚠️ RELEVÉ EN REVUE DE FOND (T-20260818-0014). Certaines commandes font attendre `herdr`
 * LUI-MÊME (`agent prompt … --wait --until working --timeout <attenteMs>`) : l'attente est
 * DANS l'appel. Deux durées se retrouvent alors face à face — celle qu'on demande à herdr, et
 * celle au bout de laquelle on le tue —, et RIEN ne les reliait. Tant que 20 s < 60 s la marge
 * tenait ; relever l'attente au-delà du plafond ferait tuer un appel qui progressait, et la
 * ronde le rapporterait en « session muette ». Un mensonge silencieux sur une livraison en
 * cours, produit par le mécanisme même qui existe pour supprimer les silences.
 *
 * Le lier par construction retire la question : un appel qui porte une attente reçoit TOUJOURS
 * de quoi la contenir, plus la marge du reste (aller-retour, lecture d'écran). Jamais moins que
 * le plafond ordinaire — un appel qui attend n'a aucune raison d'avoir moins de temps qu'un
 * autre.
 */
export const MARGE_APPEL_MS = 30000;

export function budgetPourUneAttente(attenteMs, { plancher = DELAI_APPEL_MS } = {}) {
  return Math.max(plancher, Number(attenteMs || 0) + MARGE_APPEL_MS);
}

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
export async function appelHerdr(commande, { resultatAttendu = true, executer, socket = null, delaiMs = DELAI_APPEL_MS } = {}) {
  try {
    const { stdout } = await lancer(OUTILS.herdr, commande, { maxBuffer: TAILLE_MAX, timeout: delaiMs, executer, ...envDe(socket) });
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
/**
 * CE QUE HERDR REND QUAND IL REFUSE — et pourquoi ce n'est PAS un écran (T-20260821-0024).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 MESURÉ LE 2026-08-21. `herdr agent read w0:p24 --format ansi` rend, **sur stdout** et avec
 * un code de sortie 1 :
 *
 *     {"error":{"code":"agent_not_found","message":"agent target w0:p24 not found"},"id":"cli:agent:read"}
 *
 * `lireEcran` interceptait l'échec, trouvait `err.stdout` non vide, et le rendait — c'est-à-dire
 * qu'il livrait ce refus au lecteur de boîte **comme s'il s'agissait du terminal du
 * destinataire**. Aucun filet dedans, donc `contenuBoite` rendait `null`, donc `illisible`.
 *
 * > **« Je n'ai pas pu lire » et « je ne reconnais pas cet écran » sont deux faits différents.
 * > Le second est un verdict sur l'écran d'autrui ; le premier est un aveu sur soi.**
 *
 * Le second se lit « rien à signaler » ; le premier fait s'arrêter. C'est toute la différence
 * entre un orchestrateur qui sait qu'il est injoignable et un qui l'apprend en parlant dans le
 * vide.
 *
 * ⚠️ LA SONDE EST ÉTROITE, ET DÉLIBÉRÉMENT. Jeter tout ce qui MENTIONNE une erreur rendrait
 * `illisible` sur les écrans de ce dépôt même — ses agents affichent constamment ces mots,
 * puisque c'est leur sujet. On exige donc la FORME complète : du JSON, dont l'objet racine
 * porte un `error` avec un `code`. Un écran de terminal n'est jamais du JSON entier.
 */
export function estUnRefusHerdr(sortie) {
  const t = String(sortie ?? '').trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return false;
  try {
    const j = JSON.parse(t);
    return Boolean(j && typeof j === 'object' && j.error && typeof j.error.code === 'string');
  } catch {
    return false;
  }
}

export async function lireEcran(commande, { executer, socket = null, delaiMs = DELAI_APPEL_MS } = {}) {
  try {
    const { stdout } = await lancer(OUTILS.herdr, commande, { maxBuffer: TAILLE_MAX, timeout: delaiMs, executer, ...envDe(socket) });
    // ⚠️ MÊME EN CAS DE SUCCÈS APPARENT. herdr a déjà rendu un refus avec un code de sortie 0
    // sur `agent_not_found` (le piège que `remise-prouvee` documente) : lire la FORME plutôt que
    // le code de sortie est le seul témoin qui ne dépende pas de ce détail-là.
    return estUnRefusHerdr(stdout) ? null : stdout;
  } catch (err) {
    const sortie = typeof err?.stdout === 'string' && err.stdout ? err.stdout : null;
    return estUnRefusHerdr(sortie) ? null : sortie;
  }
}

// trousseau.js — lecture des jetons de la ligne directe depuis le trousseau du poste.
//
// Les jetons ne vivent NI dans un dépôt, NI dans un fichier de configuration, NI dans une
// variable exportée par un profil partagé : ils sont déposés une fois au trousseau et lus
// à l'usage. C'est la garde du secret d'outillage de poste.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA CHARGE DE LA PREUVE EST RENVERSÉE, ET C'EST LA GARANTIE CENTRALE DE CE FICHIER
// (T-20260813-0054 — troisième ouverture du MÊME ticket)
//
// Ce module concluait à l'ABSENCE PAR DÉFAUT : tout ce qui n'était pas un succès devenait
// « aucune entrée ne répond ». Trois causes sans le moindre rapport ont donc rendu, tour à
// tour, le même verdict menteur au dirigeant — et le même message, qui l'envoyait DÉPOSER un
// jeton par-dessus un jeton en place :
//
//   1. le compte cherché était vide          (T-20260811-0087 — `process.env.USER`) ;
//   2. `security` n'était pas dans le `PATH`  (ENOENT / EACCES au lancement) ;
//   3. le TROUSSEAU ÉTAIT VERROUILLÉ          (code 36, stderr VIDE — la panne réelle du
//      2026-08-13 : `security unlock-keychain`, et la pose passe. Une seule chose changée.)
//
// À chaque fois, le réflexe a été d'AJOUTER la cause du jour à la liste des cas reconnus. À
// chaque fois, la porte suivante est restée ouverte. Trois fois le même ticket.
//
// On n'énumère donc plus. On exige une PREUVE POSITIVE D'ABSENCE :
//
//   • `JetonManquant` ne se prononce que si `security` a DIT que l'entrée n'existe pas —
//     code 44, ou son message « could not be found in the keychain » ;
//   • TOUT le reste, connu ou inconnu, est `JetonIllisible` : « je n'ai pas pu obtenir la
//     valeur », avec la cause brute que l'erreur porte déjà, et AUCUNE commande de dépôt.
//
// Ce qui suit de ce renversement, et qui est tout l'intérêt : une quatrième cause — celle
// qu'on n'a pas vue, et il y en aura une — tombe du côté PRUDENT sans qu'on ait eu à la
// connaître. Une garde qui énumère reste verte le jour où la porte suivante s'ouvre.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// Reste la troisième erreur, qui n'est pas un échec du tout :
//   - le jeton est PRÉSENT mais VIDE → l'entrée existe (une invite masquée avale un collage
//     sans le dire), et Slack répond alors `not_authed`, pas `invalid_auth`. Un veilleur qui
//     dit « jeton invalide » dans ce cas envoie chercher au mauvais endroit.

import { userInfo } from 'node:os';

import { enEssais, refuser } from './cloison.js';
import { OUTILS, lancer, motsDeLOutil } from './outils.js';

/**
 * Le compte sous lequel les entrées du trousseau ont été déposées : celui qui EXÉCUTE ce
 * processus, demandé au système.
 *
 * VÉCU, 2026-08-11 (T-20260811-0087) : ce compte sortait de `process.env.USER`, avec
 * `LOGNAME` en second et `''` en dernier ressort. Une session herdr fraîche ne porte ni
 * l'une ni l'autre — le compte devenait donc la chaîne vide, `security` ne trouvait rien
 * sous ce compte-là, et ce rien était rendu au dirigeant comme « il n'y a pas de jeton »
 * alors que le sien était bien en place et servait onze lignes de discussion.
 *
 * `userInfo()` interroge le système (getuid/getpwuid), pas l'environnement : il ne peut ni
 * manquer ni mentir. Et il n'y a volontairement AUCUN repli sur une variable — un repli
 * rouvrirait exactement la porte qu'on ferme, et le referait en silence. Si le système ne
 * sait pas qui exécute le processus, il faut le savoir tout de suite : `userInfo()` lève.
 */
export function compteDuPoste() {
  return userInfo().username;
}

export const SERVICE_ROBOT = 'ligne-directe-bot';
export const SERVICE_ECOUTE = 'ligne-directe-app';

/**
 * Les DEUX seuls témoins d'une absence, mesurés le 2026-08-13 sur un service inexistant :
 *
 *     $ security find-generic-password -a <compte> -s <service-qui-n-existe-pas> -w
 *     code 44 — security: SecKeychainSearchCopyNext: The specified item could not be found
 *               in the keychain.
 *
 * À comparer avec le trousseau VERROUILLÉ, sur une entrée qui existe : code 36, stderr VIDE.
 * C'est cette asymétrie — l'un parle, l'autre se tait — qui a coûté la soirée du dirigeant.
 */
const CODE_ABSENCE = 44;
const PHRASE_ABSENCE = /could not be found in the keychain/i;

/**
 * Le refus qui DIT CE QU'IL A CHERCHÉ.
 *
 * Il ne dit plus « il n'y a pas de jeton » : cette phrase-là n'a jamais été mesurée. Ce qui
 * est mesuré, c'est qu'aucune entrée n'a répondu SOUS CE COMPTE, POUR CE SERVICE. La nuance
 * a coûté une heure de recherche du côté de Slack, pour un jeton qui était en place.
 *
 * Et il ne propose plus de commande qui écrase. La marche à suivre est un DÉPÔT SANS `-U` :
 * si une entrée existe déjà, `security` refuse — c'est exactement ce qu'on veut. Un jeton
 * qui marche ne doit jamais être perdu en suivant un message d'erreur.
 *
 * IL MONTRE DÉSORMAIS CE QUE L'OUTIL A DIT (T-20260813-0054). La cause vivait déjà dans
 * `err.cause` et n'était montrée à personne : le refus possédait l'information qui aurait fait
 * gagner deux heures au dirigeant, et la jetait. Elle est maintenant à l'écran, telle que
 * `security` l'a rendue — ce qu'il a dit, pas ce qu'on en conclut.
 */
export class JetonManquant extends Error {
  constructor(service, compte, cause) {
    const dit = cause ? motsDeLOutil(cause) : '';
    super(
      `Aucune entrée « ${service} » ne répond au trousseau de ce poste sous le compte « ${compte} ».\n` +
        `  C'est tout ce qui a été mesuré : une entrée déposée sous un AUTRE compte existerait sans être vue ici.\n` +
        (dit ? `  Ce que « ${OUTILS.security.nom} » a répondu, tel quel : ${dit}\n` : '') +
        `  Regarde ce qui est là (cette commande ne montre aucun secret) :\n` +
        `    security find-generic-password -a "${compte}" -s ${service}\n` +
        `  S'il n'y a vraiment rien, dépose-le — copie d'abord le jeton depuis api.slack.com :\n` +
        `    security add-generic-password -a "${compte}" -s ${service} -w "$(pbpaste)"\n` +
        `  Cette commande n'écrase RIEN : si une entrée existe déjà, elle refuse, et c'est voulu.`
    );
    this.name = 'JetonManquant';
    this.service = service;
    this.compte = compte;
    this.cause = cause;
  }
}

/**
 * LA VALEUR N'A PAS PU ÊTRE OBTENUE — et on ne sait pas si l'entrée existe.
 *
 * C'est le refus qui manquait, et il est le CAS PAR DÉFAUT : tout ce qui n'est ni un succès
 * ni une absence PROUVÉE arrive ici, y compris ce qu'on n'a jamais vu. Voir le renversement
 * de la charge de la preuve en tête de fichier — c'est lui qui donne son sens à cette classe.
 *
 * AUCUN GESTE DE DÉPÔT N'EST PROPOSÉ ICI, et c'est le cœur de la garantie : on ignore ce
 * qu'il y a dans le trousseau. Envoyer déposer une entrée dont on ne sait pas si elle existe
 * est le chemin le plus court vers l'écrasement de celle qui fonctionne — la faute exacte de
 * `T-20260811-0087`, et le geste que le dirigeant a failli poser deux fois.
 *
 * Les gestes proposés ne font que REGARDER, à une exception près qui n'efface rien :
 * `unlock-keychain`, la seule chose qui a séparé le refus de la réussite le 2026-08-13.
 */
export class JetonIllisible extends Error {
  constructor(service, compte, cause) {
    const code = cause?.code;
    // ⚠️ LA SOURCE DE LA CAUSE COMPTE, et c'est le piège que ce refus a failli reproduire.
    // Se rabattre sur `err.message` quand `stderr` est vide affiche « Command failed: … »,
    // c'est-à-dire la commande qu'on a lancée — pas ce que l'outil a dit. Le SILENCE de
    // l'outil serait alors masqué par du texte, or c'est précisément lui, le fait du
    // 2026-08-13 : code 36, stderr VIDE. Un refus muet doit se dire muet.
    const dit = String(cause?.stderr ?? '').trim().split('\n').find((l) => l.trim()) || '';
    const parLeLanceur = cause?.name === 'OutilIntrouvable' ? motsDeLOutil(cause) : '';
    super(
      `La valeur de l'entrée « ${service} » n'a pas pu être obtenue au trousseau de ce poste, ` +
        `sous le compte « ${compte} ».\n` +
        `  ⚠️ CE N'EST PAS UNE ABSENCE. Personne n'a établi que cette entrée manque — un jeton\n` +
        `  parfaitement valide, en service, donne exactement ce refus-ci. Ne dépose RIEN sur sa foi.\n` +
        `  Cause brute, telle que le poste l'a rendue : ${code === undefined || code === null ? '—' : `code ${code}`}` +
        `${dit ? ` — ${dit.slice(0, 200)}` : parLeLanceur ? ` — ${parLeLanceur}` : ' — aucun message : l’outil a échoué en SILENCE (c’est le cas mesuré du trousseau verrouillé)'}\n` +
        `  Regarde, sans rien changer ni montrer aucun secret :\n` +
        `    security find-generic-password -a "${compte}" -s ${service}\n` +
        `    security show-keychain-info\n` +
        `  Si l'entrée répond à la première et pas à la seconde, le trousseau est verrouillé —\n` +
        `  c'est la panne mesurée du 2026-08-13, et elle se lève sans rien détruire :\n` +
        `    security unlock-keychain ~/Library/Keychains/login.keychain-db`
    );
    this.name = 'JetonIllisible';
    this.service = service;
    this.compte = compte;
    this.code = code ?? null;
    this.cause = cause;
  }
}

/**
 * L'absence est-elle PROUVÉE ? — le seul chemin vers `JetonManquant`, et donc vers un message
 * qui propose un dépôt.
 *
 * On ne reconnaît que ce que `security` DIT quand l'entrée n'existe pas, mesuré le
 * 2026-08-13 sur un service inexistant : code 44, et
 * « SecKeychainSearchCopyNext: The specified item could not be found in the keychain. »
 *
 * ⚠️ CETTE FONCTION NE DOIT JAMAIS S'ALLONGER. Chaque cause ajoutée à la liste des « ça veut
 * dire absent » rouvre le défaut : c'est du côté d'`illisible` que les inconnues doivent
 * tomber, jamais du côté qui envoie écrire. Les deux témoins sont redondants à dessein — une
 * version de macOS peut changer le code sans changer la phrase, ou l'inverse.
 */
export function absenceProuvee(err) {
  if (err?.code === CODE_ABSENCE) return true;
  const dit = `${err?.stderr ?? ''}\n${err?.message ?? ''}`;
  return PHRASE_ABSENCE.test(dit);
}

/**
 * L'entrée EXISTE et elle est vide — à ne jamais confondre avec l'absence : Slack répond
 * alors `not_authed`, pas `invalid_auth`, et le geste qui répare n'est pas le même.
 *
 * Aucune commande n'est proposée ici, et c'est délibéré : remplacer une entrée suppose de
 * détruire celle qui est en place, et ce module ne met plus ce geste dans la bouche de
 * personne. Le Trousseau d'accès montre l'entrée AVANT qu'on y touche — ce qu'aucune
 * commande collée depuis un message d'erreur ne fait.
 */
export class JetonVide extends Error {
  constructor(service, compte) {
    super(
      `L'entrée « ${service} » existe au trousseau sous le compte « ${compte} », mais elle est VIDE.\n` +
        `  C'est ce que produit un collage avalé par une invite masquée : l'entrée a bien été créée,\n` +
        `  sans rien dedans. Slack répondra « not_authed », jamais « invalid_auth ».\n` +
        `  Ouvre Trousseau d'accès, cherche « ${service} », et corrige la valeur de cette entrée-là.\n` +
        `  Aucune commande n'est proposée ici : la remplacer suppose de détruire ce qui est en place,\n` +
        `  et c'est un geste qui se pose en voyant l'entrée, pas en collant une ligne.`
    );
    this.name = 'JetonVide';
    this.service = service;
    this.compte = compte;
  }
}

/**
 * Le trousseau du poste. C'est la SEULE porte vers le vrai `security`, et elle est privée.
 *
 * `security` est désigné PAR SON CHEMIN (`/usr/bin/security`), jamais par son nom : le
 * résoudre par le `PATH` du processus faisait dépendre la lecture du trousseau de
 * l'environnement du lanceur — et une session herdr au `PATH` amputé ne le trouvait pas.
 * C'est la même leçon que `compteDuPoste`, à la porte d'à côté : ce qui ne dépend de rien ne
 * se demande pas à l'environnement.
 */
async function trousseauDuPoste(args) {
  const { stdout } = await lancer(OUTILS.security, args);
  return stdout;
}

/**
 * Cherche un jeton dans UN trousseau, celui que l'appelant fournit.
 *
 * L'exécuteur est OBLIGATOIRE, et c'est ce qui permet de prouver le comportement de cette
 * fonction sans jamais approcher le vrai trousseau : il n'existe aucun défaut vers lui.
 * La porte de production est `lireJeton`, et elle seule — cloisonnée.
 */
export async function chercherJeton(service, { compte = compteDuPoste(), executer } = {}) {
  if (typeof executer !== 'function') {
    throw new TypeError(
      'chercherJeton exige un exécuteur de trousseau. La porte vers le trousseau du poste est lireJeton, ' +
        'et elle est cloisonnée : il n’y a volontairement aucun chemin implicite vers `security`.'
    );
  }
  let sortie;
  try {
    sortie = await executer(['find-generic-password', '-a', compte, '-s', service, '-w']);
  } catch (err) {
    // ═══════════════════════════════════════════════════════════════════════════════════
    // LE RENVERSEMENT, ET IL TIENT EN UNE LIGNE : on ne conclut à l'absence QUE si elle est
    // prouvée. Le défaut se lisait exactement ici, à l'envers — `throw new JetonManquant`
    // sans condition, donc « aucune entrée ne répond » pour un binaire introuvable, pour un
    // trousseau verrouillé, et pour tout ce qu'on n'avait pas encore rencontré.
    //
    // L'ORDRE COMPTE. La preuve d'absence est demandée EN PREMIER et refusée par défaut : si
    // un jour `absenceProuvee` cesse de reconnaître son témoin, on tombe du côté prudent —
    // un refus trop timide, jamais un refus qui envoie écraser un secret vivant.
    // ═══════════════════════════════════════════════════════════════════════════════════
    if (absenceProuvee(err)) throw new JetonManquant(service, compte, err);
    throw new JetonIllisible(service, compte, err);
  }
  const jeton = String(sortie).trim();
  if (!jeton) throw new JetonVide(service, compte);
  return jeton;
}

/**
 * Lit un jeton au trousseau du poste. Ne le journalise jamais, ne le renvoie qu'à l'appelant.
 * @param {string} service nom de service de l'entrée
 * @returns {Promise<string>}
 */
export async function lireJeton(service) {
  // PREMIER MUR, et le plus en amont : sans jeton, aucun processus né d'une suite de tests
  // ne peut s'authentifier auprès de Slack — quelle que soit la suite des événements.
  // C'est la porte par laquelle sont passés les deux veilleurs orphelins.
  if (enEssais()) {
    refuser(
      `la lecture du jeton « ${service} » au trousseau du poste`,
      'Un veilleur né sous tests lirait les VRAIS jetons et se connecterait à l’espace de production.'
    );
  }
  return chercherJeton(service, { executer: trousseauDuPoste });
}

/**
 * Les deux jetons dont le veilleur a besoin pour vivre — lus L'UN APRÈS L'AUTRE.
 *
 * POURQUOI PAS `Promise.all`, ALORS QUE LES DEUX LECTURES SONT INDÉPENDANTES (T-20260813-0054).
 *
 * `Promise.all` rejette sur la PREMIÈRE erreur ARRIVÉE. Quand les deux entrées échouent pour
 * la même cause — un trousseau verrouillé les refuse toutes les deux —, l'entrée nommée dans
 * le refus est celle qui a perdu la course, et elle change d'une exécution à l'autre :
 * `bot`, puis `app`, puis `bot`. Le dirigeant a cherché une heure ce qui distinguait ses deux
 * jetons. Rien ne les distinguait ; c'était l'ordonnanceur qui parlait.
 *
 * Ce n'est pas la panne — c'est ce qui empêchait de la lire, et un diagnostic qui désigne une
 * cible au hasard est pire qu'un diagnostic muet. En série, le refus nomme TOUJOURS la même
 * entrée : la première dans l'ordre où on les demande. Deux lectures de trousseau ne valent
 * aucune course.
 */
export async function lireJetons({ lire = lireJeton } = {}) {
  const robot = await lire(SERVICE_ROBOT);
  const ecoute = await lire(SERVICE_ECOUTE);
  return { robot, ecoute };
}

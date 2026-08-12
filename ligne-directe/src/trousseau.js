// trousseau.js — lecture des jetons de la ligne directe depuis le trousseau du poste.
//
// Les jetons ne vivent NI dans un dépôt, NI dans un fichier de configuration, NI dans une
// variable exportée par un profil partagé : ils sont déposés une fois au trousseau et lus
// à l'usage. C'est la garde du secret d'outillage de poste.
//
// Un mot sur les deux erreurs qu'on ne doit jamais confondre — elles ont coûté une demi-
// heure le jour de l'installation :
//   - le jeton est ABSENT du trousseau     → on ne peut rien faire, il faut le déposer ;
//   - le jeton est PRÉSENT mais VIDE       → l'entrée existe (une invite masquée avale un
//     collage sans le dire), et Slack répond alors `not_authed`, pas `invalid_auth`.
// Un veilleur qui dit « jeton invalide » dans le second cas envoie chercher au mauvais
// endroit. On distingue donc les deux ici, à la source.

import { execFile } from 'node:child_process';
import { userInfo } from 'node:os';
import { promisify } from 'node:util';

import { enEssais, refuser } from './cloison.js';

// execFile avec un tableau d'arguments : aucun shell n'est impliqué, donc aucun caractère
// spécial d'un nom de service ne peut être interprété.
const execFileAsync = promisify(execFile);

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
 * Le refus qui DIT CE QU'IL A CHERCHÉ.
 *
 * Il ne dit plus « il n'y a pas de jeton » : cette phrase-là n'a jamais été mesurée. Ce qui
 * est mesuré, c'est qu'aucune entrée n'a répondu SOUS CE COMPTE, POUR CE SERVICE. La nuance
 * a coûté une heure de recherche du côté de Slack, pour un jeton qui était en place.
 *
 * Et il ne propose plus de commande qui écrase. La marche à suivre est un DÉPÔT SANS `-U` :
 * si une entrée existe déjà, `security` refuse — c'est exactement ce qu'on veut. Un jeton
 * qui marche ne doit jamais être perdu en suivant un message d'erreur.
 */
export class JetonManquant extends Error {
  constructor(service, compte, cause) {
    super(
      `Aucune entrée « ${service} » ne répond au trousseau de ce poste sous le compte « ${compte} ».\n` +
        `  C'est tout ce qui a été mesuré : une entrée déposée sous un AUTRE compte existerait sans être vue ici.\n` +
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

/** Le trousseau du poste. C'est la SEULE porte vers le vrai `security`, et elle est privée. */
async function trousseauDuPoste(args) {
  const { stdout } = await execFileAsync('security', args);
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
    throw new JetonManquant(service, compte, err);
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

/** Les deux jetons dont le veilleur a besoin pour vivre. */
export async function lireJetons() {
  const [robot, ecoute] = await Promise.all([lireJeton(SERVICE_ROBOT), lireJeton(SERVICE_ECOUTE)]);
  return { robot, ecoute };
}

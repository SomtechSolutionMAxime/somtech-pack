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
import { promisify } from 'node:util';

// execFile avec un tableau d'arguments : aucun shell n'est impliqué, donc aucun caractère
// spécial d'un nom de service ne peut être interprété.
const execFileAsync = promisify(execFile);

/** Nom de compte sous lequel les entrées ont été déposées. */
const COMPTE = process.env.USER || process.env.LOGNAME || '';

export const SERVICE_ROBOT = 'ligne-directe-bot';
export const SERVICE_ECOUTE = 'ligne-directe-app';

export class JetonManquant extends Error {
  constructor(service, cause) {
    super(
      `Aucun jeton « ${service} » au trousseau du poste.\n` +
        `  Dépose-le : security add-generic-password -U -a "$USER" -s ${service} -w "$(pbpaste)"\n` +
        `  (copie d'abord le jeton depuis api.slack.com — le collage ne prend pas dans une invite masquée)`
    );
    this.name = 'JetonManquant';
    this.service = service;
    this.cause = cause;
  }
}

export class JetonVide extends Error {
  constructor(service) {
    super(
      `Le jeton « ${service} » existe au trousseau mais il est VIDE.\n` +
        `  C'est ce que produit un collage avalé par une invite masquée. Redépose-le :\n` +
        `  security add-generic-password -U -a "$USER" -s ${service} -w "$(pbpaste)"`
    );
    this.name = 'JetonVide';
    this.service = service;
  }
}

/**
 * Lit un jeton au trousseau. Ne le journalise jamais, ne le renvoie qu'à l'appelant.
 * @param {string} service nom de service de l'entrée
 * @returns {Promise<string>}
 */
export async function lireJeton(service) {
  let sortie;
  try {
    const { stdout } = await execFileAsync('security', ['find-generic-password', '-a', COMPTE, '-s', service, '-w']);
    sortie = stdout;
  } catch (err) {
    throw new JetonManquant(service, err);
  }
  const jeton = sortie.trim();
  if (!jeton) throw new JetonVide(service);
  return jeton;
}

/** Les deux jetons dont le veilleur a besoin pour vivre. */
export async function lireJetons() {
  const [robot, ecoute] = await Promise.all([lireJeton(SERVICE_ROBOT), lireJeton(SERVICE_ECOUTE)]);
  return { robot, ecoute };
}

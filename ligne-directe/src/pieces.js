// pieces.js — ce qu'un client dépose dans sa conversation, et où ça atterrit sur le poste.
//
// Un client qui signale un problème envoie une capture d'écran AVANT d'écrire trois phrases.
// L'agent, lui, sait lire une image — il n'avait simplement rien à lire : les adresses de
// fichiers Slack sont privées, et rien ne les rapatriait.
//
// Ce module ne parle pas à Slack (c'est `slack.js`) et ne décide rien de la conversation
// (c'est `veilleur.js`). Il tient deux choses, et rien d'autre :
//
//   1. CE QU'ON PEUT RECEVOIR — la limite et les types du registre des demandes, à un seul
//      endroit. Les recopier au point d'appel garantirait qu'ils divergent le jour où le
//      registre bouge, et la divergence se verrait à l'endroit le plus cher : un client à qui
//      l'on dit « c'est reçu » alors que le rattachement échouera.
//   2. UN DÉPÔT QUI NE FUIT PAS — une capture d'écran client porte très souvent des données
//      personnelles. Elle atterrit sur un disque, sous un nom que le CLIENT a choisi. Deux
//      conséquences tenues ici : droits restreints (0700 / 0600), et un nom assaini qui ne
//      peut désigner que l'intérieur du dépôt.

import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

import { RACINE } from './registre.js';

/** Où les pièces se déposent — un dossier par canal, pour ne jamais croiser deux clients. */
export const RACINE_PIECES = join(RACINE, 'pieces');

/**
 * La limite du registre des demandes : 5 Mo par pièce jointe.
 *
 * Elle est constatée sur ce que Slack ANNONCE, avant tout téléchargement — rapatrier six
 * mégaoctets pour les refuser ensuite coûte du réseau, de la mémoire, et dépose sur le poste
 * une donnée personnelle qu'on ne pourra pas utiliser.
 */
export const TAILLE_MAX = 5 * 1024 * 1024;

/**
 * Les types que le registre des demandes accepte, et eux seuls.
 *
 * Tout autre se refuse PROPREMENT : un fichier qu'on ne peut pas recevoir ne doit jamais
 * faire échouer le traitement du message qui l'accompagne.
 */
export const TYPES_ACCEPTES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/markdown',
]);

/** Le repli quand Slack n'annonce pas de type — l'extension du nom, et rien d'autre. */
const PAR_EXTENSION = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
  ['pdf', 'application/pdf'],
  ['md', 'text/markdown'],
  ['markdown', 'text/markdown'],
]);

/**
 * Le type d'une pièce, ou `null` si on ne peut pas la recevoir.
 *
 * `null` est une réponse, pas un échec : l'appelant en fait un refus poli au client. Rendre
 * un type par défaut serait la pire issue — on déposerait n'importe quoi, et le rattachement
 * à la demande échouerait plus tard, loin de la cause.
 */
export function typeDePiece(fichier) {
  const annonce = String(fichier?.mimetype || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (TYPES_ACCEPTES.has(annonce)) return annonce;
  const extension = String(fichier?.name || '').split('.').pop()?.toLowerCase();
  const deduit = PAR_EXTENSION.get(extension);
  return deduit && TYPES_ACCEPTES.has(deduit) ? deduit : null;
}

/**
 * Un nom de fichier qui ne peut désigner que l'intérieur du dépôt.
 *
 * Ce nom vient du CLIENT et sert à écrire un fichier sur NOTRE poste. On ne garde donc qu'un
 * alphabet inoffensif : les séparateurs de chemin disparaissent, les points de tête aussi
 * (`..` cesse d'être un nom), et la longueur est bornée. Un nom qui ne laisse rien d'utilisable
 * retombe sur « piece » plutôt que sur un fichier sans nom.
 */
export function nomSur(nom) {
  const dernier = String(nom || '').split(/[\\/]/).pop();
  const propre = dernier
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.\-]+/, '')
    .slice(0, 80);
  return propre || 'piece';
}

/**
 * Dépose une pièce là où l'agent peut la lire, et nulle part ailleurs.
 *
 * L'identifiant Slack préfixe le nom : deux captures nommées « Capture d'écran.png » le même
 * jour ne s'écrasent pas l'une l'autre, et le lien avec le message reste lisible.
 *
 * @returns {string} le chemin absolu du fichier déposé
 */
export function deposer(canalId, fichier, octets, { racine = RACINE_PIECES } = {}) {
  mkdirSync(racine, { recursive: true, mode: 0o700 });
  const dossier = join(racine, nomSur(canalId));
  mkdirSync(dossier, { recursive: true, mode: 0o700 });
  // `mkdirSync` applique le masque du compte : sans ce chmod, un umask permissif rendrait le
  // dossier lisible par tout le poste — ce qui est exactement ce qu'on cherche à empêcher.
  chmodSync(racine, 0o700);
  chmodSync(dossier, 0o700);

  const chemin = join(dossier, `${nomSur(fichier?.id || 'piece')}-${nomSur(fichier?.name)}`);
  writeFileSync(chemin, octets, { mode: 0o600 });
  chmodSync(chemin, 0o600);
  return chemin;
}

/** Un gabarit lisible pour le cadre remis à l'agent — jamais l'octet près. */
export function gabarit(octets) {
  const ko = Math.max(1, Math.round(octets / 1024));
  return ko >= 1024 ? `${(ko / 1024).toFixed(1)} Mo` : `${ko} ko`;
}

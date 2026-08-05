// herdr.js — parler à un agent, et savoir s'il est encore là.
//
// Deux garanties, et elles ont chacune coûté cher ailleurs :
//
// 1. AUCUN SHELL. `execFile` avec un tableau d'arguments : le texte du dirigeant part tel
//    quel dans argv. Apostrophes, guillemets, accents, points-virgules — rien n'est
//    interprété. Le piège documenté (« un retour à la ligne soumet le prompt et coupe le
//    message en deux ») vient de la frappe dans un terminal, pas de la commande : il
//    disparaît dès qu'on cesse de passer par un shell.
//
// 2. AUCUNE REMISE SUPPOSÉE. On ne conclut « transmis » que sur un `result` rendu par
//    herdr. Un code de sortie nul ne suffit pas : c'est la façon dont un message se perd
//    sans que personne ne s'en aperçoive.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

/** Un message plus long que ça part par fichier plutôt que par argv (limite système). */
const SEUIL_ARGV = 60_000;

export class RemiseEchouee extends Error {
  constructor(pane, raison) {
    super(`Message non remis à ${pane} : ${raison}`);
    this.name = 'RemiseEchouee';
    this.pane = pane;
    this.raison = raison;
  }
}

/**
 * Où joindre herdr.
 *
 * MESURÉ, et c'est la panne qui ne se voit qu'au démarrage du poste : herdr trouve son
 * socket par la variable `HERDR_SOCKET_PATH`, posée par le shell d'un pane. Un service
 * lancé par le gestionnaire du poste n'hérite d'aucun environnement de session — il obtient
 * donc « connexion refusée », et le veilleur ne peut plus remettre AUCUN message. Tout
 * marche à la main, rien ne marche après un redémarrage.
 *
 * On retombe donc sur la découverte : les sessions herdr déposent leur socket sous
 * `~/.config/herdr/sessions/<nom>/herdr.sock`. On prend la plus récemment active.
 */
export function socketsHerdr() {
  const vus = new Set();
  const liste = [];
  if (process.env.HERDR_SOCKET_PATH) {
    liste.push(process.env.HERDR_SOCKET_PATH);
    vus.add(process.env.HERDR_SOCKET_PATH);
  }
  const racine = join(homedir(), '.config', 'herdr', 'sessions');
  if (!existsSync(racine)) return liste;
  const candidats = [];
  for (const session of readdirSync(racine)) {
    const chemin = join(racine, session, 'herdr.sock');
    if (vus.has(chemin) || !existsSync(chemin)) continue;
    try {
      candidats.push({ chemin, quand: statSync(chemin).mtimeMs });
    } catch {
      /* socket disparu entre-temps */
    }
  }
  candidats.sort((a, b) => b.quand - a.quand);
  return [...liste, ...candidats.map((c) => c.chemin)];
}

/** Le socket d'une session précise, ou la plus récemment active à défaut. */
export function socketHerdr() {
  return socketsHerdr()[0] || null;
}

async function herdr(args, socket) {
  const env = socket ? { ...process.env, HERDR_SOCKET_PATH: socket } : process.env;
  const { stdout } = await execFileAsync('herdr', args, { maxBuffer: 16 * 1024 * 1024, env });
  return JSON.parse(stdout);
}

/** Comme `herdr`, mais lève si la réponse porte une erreur applicative (code de sortie 0 compris). */
async function herdrStrict(args, socket) {
  const reponse = await herdr(args, socket);
  if (reponse?.error) {
    const e = new Error(reponse.error.message || reponse.error.code || 'erreur herdr');
    e.code = reponse.error.code;
    throw e;
  }
  return reponse;
}

/**
 * Remet un message à un agent, et prouve la remise.
 * @returns {Promise<object>} le `result` rendu par herdr — la preuve, pas une supposition
 */
export async function remettre(pane, texte, { socket } = {}) {
  if (texte.length > SEUIL_ARGV) {
    throw new RemiseEchouee(pane, `message de ${texte.length} caractères — au-delà de ${SEUIL_ARGV}, à découper`);
  }
  let reponse;
  try {
    reponse = await herdr(['agent', 'prompt', pane, texte], socket);
  } catch (err) {
    throw new RemiseEchouee(pane, err.message);
  }
  // MESURÉ, et c'est le piège central de cette intégration : herdr sort avec le CODE 0
  // même quand il échoue — `agent_not_found` arrive sur stdout, en JSON, sans code
  // d'erreur processus. Se fier au code de sortie, c'est déclarer remis un message que
  // personne n'a reçu. On lit donc la réponse, toujours.
  if (reponse?.error) {
    throw new RemiseEchouee(pane, reponse.error.code || reponse.error.message || 'erreur herdr sans code');
  }
  if (!reponse || !reponse.result) {
    throw new RemiseEchouee(pane, `réponse inattendue de herdr : ${JSON.stringify(reponse).slice(0, 200)}`);
  }
  return reponse.result;
}

/** Tous les panes qui portent un agent, tels que herdr les voit maintenant. */
export async function agents({ socket } = {}) {
  if (socket) {
    const reponse = await herdrStrict(['agent', 'list'], socket);
    return (reponse.result?.agents || []).filter((a) => a.agent);
  }
  // Sans socket désigné : agréger TOUTES les sessions herdr du poste. Se contenter de la
  // plus récente ferait conclure « cet agent est mort » pour tout agent vivant dans une
  // autre session — et refermerait sa ligne alors qu'il travaille.
  const vus = new Map();
  for (const s of socketsHerdr()) {
    try {
      const reponse = await herdrStrict(['agent', 'list'], s);
      for (const a of (reponse.result?.agents || []).filter((x) => x.agent)) {
        if (!vus.has(a.pane_id)) vus.set(a.pane_id, { ...a, herdr_socket: s });
      }
    } catch {
      /* session injoignable : les autres restent valables */
    }
  }
  return [...vus.values()];
}

/**
 * Un agent est-il encore vivant dans ce pane ?
 *
 * ATTENTION à ce que ça veut dire : herdr voit des PANES. Un pane fermé disparaît de la
 * liste — c'est notre signal de mort. Un agent qui a rendu la main mais dont le pane est
 * ouvert reste « vivant » : il peut encore recevoir un message, et c'est précisément ce
 * qu'on veut pour un chantier en attente d'arbitrage.
 */
export async function vivant(pane, { socket } = {}) {
  const liste = await agents({ socket });
  return liste.some((a) => a.pane_id === pane);
}

/** Le pane courant — celui depuis lequel la commande locale est invoquée. */
export async function paneCourant() {
  const reponse = await herdrStrict(['pane', 'current'], process.env.HERDR_SOCKET_PATH);
  const p = reponse.result?.pane;
  if (!p) throw new Error("herdr ne rend pas de pane courant — la commande n'est pas lancée depuis un pane herdr.");
  return {
    pane: p.pane_id,
    nom: p.name || null,
    // Le worktree est `foreground_cwd`, pas `cwd` : un agent né par claude-swt garde le
    // dépôt principal en `cwd` pendant que son travail vit ailleurs.
    worktree: p.foreground_cwd || p.cwd || null,
    statut: p.agent_status || null,
    // La session herdr d'où vient cet agent : le veilleur ne peut pas la deviner, il y a
    // plusieurs sessions sur un poste et la plus récente n'est pas forcément la bonne.
    herdr_socket: process.env.HERDR_SOCKET_PATH || null,
  };
}

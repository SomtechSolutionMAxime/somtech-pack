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

import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { OUTILS, OutilIntrouvable, lancer } from './outils.js';
import { contenuBoite } from './boite.js';

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

/**
 * `herdr` est résolu par le `PATH`, et c'est le SEUL cas où c'est justifié : il est installé
 * par l'utilisateur, son emplacement n'est pas connu d'avance, et lui en inventer un
 * chercherait au mauvais endroit en ayant l'air de savoir. Ce qui n'est pas justifiable, en
 * revanche, c'est de traduire « je ne l'ai pas trouvé » en autre chose — d'où `lancer`, qui
 * qualifie l'échec de lancement au lieu de le laisser se fondre dans les autres.
 */
async function herdr(args, socket) {
  const env = socket ? { ...process.env, HERDR_SOCKET_PATH: socket } : process.env;
  const { stdout } = await lancer(OUTILS.herdr, args, { maxBuffer: 16 * 1024 * 1024, env });
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

  // ═══ ET ON RELIT LA BOÎTE — parce que « l'appel a réussi » ne veut pas dire « il a lu ».
  //
  // Le contrôle ci-dessus ferme le piège du code de sortie 0 sur une ERREUR. Il ne dit rien du
  // mode de panne mesuré le 2026-08-14 : l'appel réussit, et le texte reste dans la boîte de
  // saisie sans être soumis. L'agent ne voit rien, le dirigeant a son accusé de réception, et
  // c'est le chemin par lequel arrive sa parole.
  //
  // ⚠️ ON NE CODE AUCUN SEUIL DE LONGUEUR, et c'est la leçon de la mesure : 25 envois de 350 à
  // 24 000 caractères n'ont produit aucun collage, alors que le même envoi de 2 400 caractères
  // sur l'autre primitive reste bloqué 2 fois sur 5. Ce n'est pas une frontière, c'est une
  // COURSE. La seule forme qui tienne contre une course est de vérifier à chaque fois.
  const reste = await boiteDe(pane, socket);
  if (reste) {
    // Le cas connu : le texte est bien arrivé, la soumission n'est pas partie. On envoie la
    // touche d'envoi — jamais le texte à nouveau, ce qui le collerait à lui-même.
    await herdr(['agent', 'send-keys', pane, 'Enter'], socket).catch(() => null);
    const apres = await boiteDe(pane, socket);
    if (apres) {
      throw new RemiseEchouee(
        pane,
        `le message est resté dans la boîte de saisie (« ${apres.slice(0, 60)}… ») — il n'a pas été soumis`
      );
    }
  }
  return reponse.result;
}

/**
 * Ce que contient la boîte de saisie d'un pane — `''` si vide, `null` si on n'a pas su la lire.
 *
 * Une boîte illisible ne fait PAS échouer la remise : contrairement à la livraison d'un brief,
 * on n'écrit pas par-dessus quoi que ce soit ici, et le message est déjà parti. Refuser sur un
 * écran qu'on n'a pas reconnu ferait perdre une parole qui a peut-être très bien été reçue —
 * on préfère se taire que crier au loup sur une lecture ratée.
 */
async function boiteDe(pane, socket) {
  try {
    const { stdout } = await lancer(OUTILS.herdr, ['agent', 'read', pane, '--format', 'ansi'], {
      maxBuffer: 16 * 1024 * 1024,
      ...(socket ? { env: { ...process.env, HERDR_SOCKET_PATH: socket } } : {}),
    });
    return contenuBoite(stdout) || null;
  } catch {
    return null;
  }
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
  // Aucune session trouvée sur le disque ne veut pas dire « pas de herdr » : la découverte
  // suppose une arborescence qui peut ne pas exister (autre système, autre version). On
  // tente alors l'appel sans socket imposé et on laisse herdr chercher lui-même — sans
  // cela, le veilleur cessait purement et simplement de consulter herdr, donc concluait
  // que tous les agents étaient morts.
  const sessions = socketsHerdr();
  for (const s of sessions.length ? sessions : [undefined]) {
    try {
      const reponse = await herdrStrict(['agent', 'list'], s);
      for (const a of (reponse.result?.agents || []).filter((x) => x.agent)) {
        if (!vus.has(a.pane_id)) vus.set(a.pane_id, { ...a, herdr_socket: s });
      }
    } catch (err) {
      // ⚠️ UN OUTIL INTROUVABLE N'EST PAS UNE SESSION INJOIGNABLE — T-20260813-0054, et c'est
      // la conséquence la plus chère de toute cette famille de défauts.
      //
      // Ce `catch` est bon pour ce pour quoi il a été écrit : une session herdr morte ne doit
      // pas invalider les autres. Mais `herdr` absent du `PATH` fait échouer TOUTES les
      // sessions, ce silence rend alors une liste VIDE, et une liste vide veut dire « aucun
      // agent vivant ». En aval, `vivant()` rend `false`, le veilleur clôt la ligne d'office
      // et répond « agent disparu » — pour un agent qui travaille, dans une session ouverte.
      //
      // On ne l'avale donc pas : l'appelant a déjà, à chaque site, un chemin « herdr
      // injoignable » qui reporte au lieu de conclure. C'est celui-là qu'il faut atteindre.
      if (err instanceof OutilIntrouvable) throw err;
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

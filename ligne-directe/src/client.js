// client.js — parler au veilleur depuis un agent, et le réveiller s'il dort.
//
// Le démarrage paresseux suit le patron du canvas : on tente le socket, et s'il ne répond
// pas, on fait naître le veilleur détaché puis on réessaie. Un agent n'a donc jamais à
// savoir si le veilleur tourne — il ouvre sa ligne, c'est tout.

import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

import { CHEMIN_SOCKET, CHEMIN_JOURNAL, RACINE } from './registre.js';
import { ETIQUETTE as ETIQUETTE_SERVICE } from './service.js';
import { GESTE_DE_LA_VUE } from './vue-du-parc.js';

const ICI = dirname(fileURLToPath(import.meta.url));

/**
 * LA BORNE ORDINAIRE — celle qui GARDE, et qui ne bouge pas.
 *
 * 🔴 ELLE NE SE RELÈVE PAS « POUR ÊTRE TRANQUILLE ». Une borne haute pour tout le monde ne
 * garde plus rien : le jour où un geste pend VRAIMENT, elle fait attendre deux minutes avant
 * de le dire. On aurait échangé un faux refus contre une vraie attente, et c'est pire.
 */
export const BORNE_PAR_DEFAUT = 30_000;

/**
 * LES GESTES QUI COÛTENT PLUS QUE LES AUTRES — nommés un par un, avec leur mesure.
 *
 * 🔴 `vue` A PENDU CHEZ LE DIRIGEANT PARCE QU'UNE SEULE BORNE SERVAIT LES QUATRE GESTES.
 * Mesuré au socket sur le poste réel, le 2026-08-24 : `ping` et `etat` rendent en **0 ms**,
 * `recensement` en **9 s**, `vue` en **67 127 ms** (puis 71 797 ms au second essai). Une borne
 * unique ne peut être juste pour aucun d'eux : trop lâche pour trois, trop serrée pour un.
 *
 * ⚠️ ET LE COÛT DE LA VUE EST STRUCTUREL, PAS ACCIDENTEL — mesuré appel par appel : 9 217 ms
 * de recensement, puis 54 144 ms de jointure en **91 appels HTTP séquentiels** (1 liste par
 * mandat, 1 `epics/list` par mandat, **1 `tickets/list` par epic**). Aucun appel n'est lent :
 * médiane 624-778 ms, max 976 ms. C'est le NOMBRE qui coûte, et il croît linéairement avec le
 * nombre d'epics du parc. La borne est donc posée sur ~2,7× le coût mesuré d'un poste de
 * 99 panes et 71 epics — pas sur un chiffre rond.
 *
 * ⚠️ CE N'EST PAS UNE PERMISSION D'ATTENDRE TROIS MINUTES. La sonde ci-dessous refuse dès que
 * le veilleur cesse de répondre : la borne haute n'est atteinte que par un veilleur VIVANT et
 * occupé, jamais par un veilleur mort.
 */
export const BORNES_PAR_GESTE = Object.freeze({ [GESTE_DE_LA_VUE]: 180_000 });

/**
 * LA SONDE DE VIE — ce qui rend une borne haute admissible.
 *
 * Elle mesure « le veilleur est-il MUET ? », jamais « ce geste est-il long ? ». Ce sont deux
 * questions opposées que la même attente servait : c'est en chronométrant `ping` et `etat`
 * PENDANT que la vue tournait (0 ms, tous les deux, sur 71 s de vue) qu'on a su que le
 * veilleur n'était pas bloqué. Le refus fait désormais cette mesure au lieu de la deviner.
 */
export const SONDE_PAR_DEFAUT = Object.freeze({ intervalle: 3_000, borne: 2_000 });

/** La borne d'un geste — la sienne s'il en a une, celle qui garde sinon. */
export function borneDuGeste(geste, { bornesParGeste = BORNES_PAR_GESTE, borneParDefaut = BORNE_PAR_DEFAUT } = {}) {
  const propre = bornesParGeste?.[geste];
  return Number.isFinite(propre) ? propre : borneParDefaut;
}

/** Un aller-retour sur le socket local. Ne démarre rien. */
export function demander(requete, cheminSocket = CHEMIN_SOCKET, { delai = BORNE_PAR_DEFAUT, signal } = {}) {
  return new Promise((resolve, reject) => {
    const flux = connect(cheminSocket);
    let tampon = '';
    const minuteur = setTimeout(() => {
      flux.destroy();
      reject(new Error(`le veilleur n'a pas répondu en ${delai / 1000}s`));
    }, delai);
    // ⚠️ UNE ATTENTE QU'ON PEUT COUPER, ET ELLE MANQUAIT. Sans elle, une attente abandonnée
    // laisse son minuteur ET sa connexion en vol : avec la borne de la vue, le processus
    // appelant reste debout TROIS MINUTES après avoir déjà rendu son refus — mesuré sur ce
    // lot même, la suite d'essais ne rendait jamais la main. Ce qui ne se coupe pas ne
    // s'abandonne pas vraiment.
    const couper = () => {
      clearTimeout(minuteur);
      flux.destroy();
      reject(Object.assign(new Error('attente abandonnée'), { code: 'ABANDONNEE' }));
    };
    if (signal) {
      if (signal.aborted) return couper();
      signal.addEventListener('abort', couper, { once: true });
    }
    flux.on('connect', () => flux.write(`${JSON.stringify(requete)}\n`));
    flux.on('data', (m) => {
      tampon += m.toString('utf8');
      const coupure = tampon.indexOf('\n');
      if (coupure === -1) return;
      clearTimeout(minuteur);
      flux.end();
      try {
        resolve(JSON.parse(tampon.slice(0, coupure)));
      } catch (err) {
        reject(new Error(`réponse illisible du veilleur : ${err.message}`));
      }
    });
    flux.on('error', (err) => {
      clearTimeout(minuteur);
      reject(err);
    });
  });
}

/** Fait naître le veilleur, détaché de l'agent qui l'invoque — il doit lui survivre. */
export function reveillerVeilleur() {
  mkdirSync(RACINE, { recursive: true });
  const sortie = openSync(CHEMIN_JOURNAL, 'a');
  const enfant = spawn(process.execPath, [join(ICI, 'demarrer-veilleur.js')], {
    detached: true,
    stdio: ['ignore', sortie, sortie],
    env: process.env,
  });
  enfant.unref();
  return enfant.pid;
}

const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Aller-retour avec le veilleur, en le réveillant au besoin.
 *
 * Une seule tentative de réveil : si le veilleur ne peut pas naître (jeton absent, par
 * exemple), il faut le DIRE, pas boucler en silence. L'erreur du veilleur mort-né est
 * dans son journal, dont on donne le chemin.
 */
/**
 * Le refus rendu quand le veilleur en place ne cède pas la main.
 *
 * CE REFUS PROPOSAIT `pkill -f demarrer-veilleur.js`, et c'est le même défaut que celui du
 * trousseau (T-20260811-0087) par un autre chemin : `pkill -f` frappe PAR MOTIF, sur la
 * ligne de commande entière. Il tuait donc tout veilleur du poste — les onze lignes de
 * discussion vivantes avec — et jusqu'à un `tail` ou un éditeur ouvert sur ce fichier-là.
 * Un message d'erreur ne met pas ce geste dans la bouche de quelqu'un qui lui fait confiance.
 *
 * On nomme donc le processus AVANT de l'arrêter : `lsof` rend le seul qui tient la place.
 */
export function refusVeilleurTetu(refus, { cheminSocket = CHEMIN_SOCKET } = {}) {
  return new Error(
    `Le veilleur en place n'a pas cédé la main${refus ? ` (${refus})` : ''}.\n` +
      `  C'est le cas d'une version antérieure à celle qui sait céder — une seule fois, il faut l'arrêter.\n` +
      `  S'il vient du service du poste, un redémarrage suffit et ne touche à rien d'autre :\n` +
      `    launchctl kickstart -k gui/$(id -u)/${ETIQUETTE_SERVICE}\n` +
      `  Sinon, nomme d'abord le seul processus qui tient la place, puis arrête CELUI-LÀ :\n` +
      `    lsof -t ${cheminSocket}\n` +
      `  Les relèves suivantes se feront toutes seules.`
  );
}

/**
 * Fait passer la main : le veilleur en place se retire, un neuf prend sa suite.
 *
 * C'est le geste qui manquait. Le verrou d'unicité protège des remises en double, mais il
 * interdisait du même coup toute mise à jour : le veilleur neuf trouvait la place occupée
 * et se retirait, donc une version fraîchement publiée restait sans effet — sans que rien
 * ne le signale. Il fallait chercher un identifiant de processus et le tuer à la main.
 */
export async function passerLaMain({ cheminSocket = CHEMIN_SOCKET } = {}) {
  let cede = false;
  let refus = null;
  try {
    const r = await demander({ geste: 'ceder' }, cheminSocket, { delai: 5000 });
    cede = r?.ok === true;
    if (!cede) refus = r?.erreur || 'refus sans motif';
  } catch {
    // Personne au bout du fil : rien à faire céder, on démarre simplement.
    cede = true;
  }

  // La place se libère-t-elle VRAIMENT ? On ne se fie pas à la réponse, on regarde.
  let libre = false;
  for (let essai = 0; essai < 20; essai += 1) {
    await dodo(250);
    if (!existsSync(cheminSocket)) {
      libre = true;
      break;
    }
    try {
      await demander({ geste: 'ping' }, cheminSocket, { delai: 1000 });
    } catch {
      libre = true; // le socket ne répond plus : la place est libre
      break;
    }
  }

  // ÉCHOUER PLUTÔT QUE MENTIR — le refus vit dans `refusVeilleurTetu`, plus bas.
  // Un veilleur d'une version antérieure ne connaît pas le
  // geste : il refuse, garde la place, et le neuf se retire. Rendre « ok » ici laisserait
  // croire à une relève qui n'a pas eu lieu — et c'est précisément le mode de panne que
  // cette capacité passe sa vie à combattre.
  if (!libre) {
    // Le socket EN CAUSE, pas celui du poste : un message qui nomme la mauvaise place
    // envoie regarder à côté — c'est la même faute que celle qu'on corrige ici.
    throw refusVeilleurTetu(refus, { cheminSocket });
  }

  reveillerVeilleur();
  for (let essai = 0; essai < 40; essai += 1) {
    await dodo(250);
    try {
      const r = await demander({ geste: 'ping' }, cheminSocket, { delai: 2000 });
      if (r?.ok) return { ok: true, ancien_cede: cede };
    } catch {
      /* pas encore prêt */
    }
  }
  throw new Error(`Le veilleur n'a pas repris la main en 10s. Regarde pourquoi : tail -20 ${CHEMIN_JOURNAL}`);
}

/**
 * UN SOMMEIL QUI NE RETIENT PAS LE PROCESSUS — `unref`, et ce n'est pas un détail.
 *
 * 🔴 MESURÉ SUR LE POSTE, ET AUCUN BANC NE L'AVAIT VU : `ligne-directe etat` est passé de
 * **62 ms à 3 062 ms** — très exactement l'intervalle de la sonde. La réponse arrivait bien en
 * 60 ms ; c'est le minuteur de la sentinelle, encore en vol, qui tenait le processus debout
 * jusqu'à son échéance. Une surveillance ne doit rien coûter à ce qu'elle surveille.
 *
 * ⚠️ `dodo` RESTE INTACT POUR SES AUTRES USAGES. `passerLaMain` et le réveil paresseux
 * ATTENDENT vraiment : leur sommeil doit tenir le processus, sinon la commande meurt avant que
 * le veilleur soit né. Deux sommeils, deux besoins opposés — les fondre casserait l'un des deux.
 */
const sommeilQuiNeRetientRien = (ms) =>
  new Promise((r) => {
    const t = setTimeout(r, ms);
    t.unref?.();
  });

/**
 * LE VEILLEUR PARLE-T-IL ENCORE ? — mesuré, sur une connexion À PART.
 *
 * ⚠️ ON JUGE SUR « UNE RÉPONSE ARRIVE », PAS SUR `ok`. Le veilleur le dit lui-même à son
 * geste `ping` : *« un ping répond la PRÉSENCE, jamais la disponibilité »*. Exiger `ok: true`
 * ferait déclarer muet un veilleur qui parle mais n'a pas fini de charger son identité — la
 * confusion exacte qui avait déjà coûté deux écoutes et chaque message remis en double.
 *
 * ⚠️ ET C'EST BIEN UNE SECONDE CONNEXION. Mesuré sur le poste : `ping` et `etat` rendent en
 * 0 ms pendant que `vue` tourne depuis 71 s. Le socket sert plusieurs conversations à la fois ;
 * sonder sur le même flux ne mesurerait que notre propre attente.
 */
async function veilleurParleEncore(cheminSocket, borneSonde) {
  try {
    await demander({ geste: 'ping' }, cheminSocket, { delai: borneSonde });
    return true;
  } catch {
    return false;
  }
}

/**
 * LE REFUS QUI DIT CE QU'IL A MESURÉ — et les deux cas ne portent pas le même mot.
 *
 * 🔴 LE MESSAGE D'AVANT ÉTAIT FAUX AU SENS PROPRE. « Le veilleur n'a pas répondu en 30s » a
 * été rendu au dirigeant par un veilleur qui répondait en 0 ms à tout le reste, et qui a rendu
 * sa vue complète en 67 s. Le refus attribuait au veilleur un silence qu'il n'avait pas, et
 * envoyait chercher la panne là où elle n'était pas.
 */
export function refusSansReponse({ geste, ms, vivant }) {
  const secondes = Math.round(ms / 100) / 10;
  if (vivant) {
    return new Error(
      `Le veilleur EST VIVANT — il répond au ping — mais il n'a pas rendu « ${geste} » en ${secondes}s.\n` +
        `  Ce geste est donc plus long que sa borne, ce n'est pas une panne de veilleur.\n` +
        `  Vois ce qu'il fait : tail -20 ${CHEMIN_JOURNAL}`
    );
  }
  return new Error(
    `Le veilleur NE RÉPOND PLUS — « ${geste} » attendu ${secondes}s, et le ping reste sans réponse.\n` +
      `  Sa bouche est fermée : ce n'est pas un geste lent, c'est un veilleur en panne.\n` +
      `  Regarde pourquoi : tail -20 ${CHEMIN_JOURNAL}`
  );
}

/**
 * Un aller-retour BORNÉ PAR LE GESTE, sous surveillance de la vie du veilleur.
 *
 * Deux issues, et elles sont mesurées, jamais déduites :
 *   — le veilleur cesse de répondre au ping → on refuse TOUT DE SUITE, sans attendre la borne
 *     (c'est ce qui rend une borne haute admissible : elle n'est atteinte que par un veilleur
 *      vivant et occupé) ;
 *   — la borne du geste tombe → on établit l'état du veilleur, puis on le DIT.
 */
async function demanderSousSurveillance(requete, cheminSocket, { borne, sonde }) {
  const geste = requete?.geste ?? 'ce geste';
  const t0 = Date.now();
  let fini = false;
  const abandon = new AbortController();
  const reponse = demander(requete, cheminSocket, { delai: borne, signal: abandon.signal }).finally(() => {
    fini = true;
  });
  // ⚠️ LE REJET DE L'ATTENTE COUPÉE NE DOIT ÉCHOUER NULLE PART. Il est attendu, il est
  // provoqué par nous, et un rejet non géré tuerait le processus qui vient d'être servi.
  reponse.catch(() => {});

  // ⚠️ UNE SENTINELLE QUI NE GAGNE JAMAIS SI LE VEILLEUR PARLE. Elle ne fait que retirer à une
  // borne haute son pouvoir de faire attendre pour rien.
  const sentinelle = (async () => {
    for (;;) {
      await sommeilQuiNeRetientRien(sonde.intervalle);
      if (fini) return null;
      if (Date.now() - t0 >= borne) return null;
      if (await veilleurParleEncore(cheminSocket, sonde.borne)) continue;
      // ⚠️ PAS DE SECONDE GARDE `fini` ICI, ET C'EST DÉLIBÉRÉ. Il y en avait une : la campagne
      // de mutation l'a trouvée SURVIVANTE, et en cherchant son banc on a compris pourquoi —
      // elle est INOBSERVABLE. Si la réponse est arrivée, `Promise.race` a déjà été gagnée par
      // elle ; ce que la sentinelle rend ensuite ne parvient à personne. Une garde qu'aucun
      // banc ne peut faire rougir n'est pas une garde, c'est une consolation.
      //
      // On coupe l'attente AVANT de rendre le refus : sinon la requête et son minuteur
      // survivent jusqu'à la borne du geste, longtemps après qu'on a répondu.
      abandon.abort();
      return refusSansReponse({ geste, ms: Date.now() - t0, vivant: false });
    }
  })();

  const issue = await Promise.race([
    reponse.then((r) => ({ r }), (err) => ({ err })),
    sentinelle.then((refus) => (refus ? { err: refus } : new Promise(() => {}))),
  ]);
  if ('r' in issue) return issue.r;

  // ⚠️ ON NE REQUALIFIE QUE NOTRE PROPRE BORNE. Une connexion refusée, un socket disparu, une
  // réponse illisible : ce sont des faits distincts, déjà nommés par qui les a vus. Les
  // repeindre en « le veilleur ne répond plus » ferait chercher la panne à côté — le défaut
  // même que ce lot corrige.
  const err = issue.err;
  const notreBorne = err instanceof Error && /n'a pas répondu en/.test(err.message);
  if (!notreBorne) throw err;
  const vivant = await veilleurParleEncore(cheminSocket, sonde.borne);
  throw refusSansReponse({ geste, ms: Date.now() - t0, vivant });
}

export async function parler(
  requete,
  {
    reveiller = true,
    cheminSocket = CHEMIN_SOCKET,
    bornesParGeste = BORNES_PAR_GESTE,
    borneParDefaut = BORNE_PAR_DEFAUT,
    sonde = SONDE_PAR_DEFAUT,
  } = {}
) {
  // 🔴 LA BORNE VIENT DU GESTE, ET C'EST TOUT LE CORRECTIF. Une borne unique servait les
  // quatre gestes ; `vue` en coûte 67 et se faisait couper à 30. Elle se résout ICI, à
  // l'entrée que la commande emprunte — pas dans `demander`, qui reste l'aller-retour nu dont
  // `passerLaMain` a besoin avec ses bornes courtes à lui.
  const borne = borneDuGeste(requete?.geste, { bornesParGeste, borneParDefaut });
  const surveille = (chemin) => demanderSousSurveillance(requete, chemin, { borne, sonde });
  try {
    if (!existsSync(cheminSocket)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return await surveille(cheminSocket);
  } catch (err) {
    const absent = err.code === 'ENOENT' || err.code === 'ECONNREFUSED';
    if (!absent || !reveiller) throw err;
  }
  reveillerVeilleur();
  for (let essai = 0; essai < 40; essai += 1) {
    await dodo(250);
    try {
      if (existsSync(cheminSocket)) return await surveille(cheminSocket);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ECONNREFUSED') throw err;
    }
  }
  throw new Error(
    `Le veilleur n'a pas démarré en 10s. Regarde pourquoi : tail -20 ${CHEMIN_JOURNAL}\n` +
      `(cause la plus fréquente : un jeton absent ou vide au trousseau)`
  );
}

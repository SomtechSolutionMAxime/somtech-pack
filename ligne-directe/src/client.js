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

const ICI = dirname(fileURLToPath(import.meta.url));
const DELAI_REPONSE = 30_000;

/** Un aller-retour sur le socket local. Ne démarre rien. */
export function demander(requete, cheminSocket = CHEMIN_SOCKET, { delai = DELAI_REPONSE } = {}) {
  return new Promise((resolve, reject) => {
    const flux = connect(cheminSocket);
    let tampon = '';
    const minuteur = setTimeout(() => {
      flux.destroy();
      reject(new Error(`le veilleur n'a pas répondu en ${delai / 1000}s`));
    }, delai);
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

  // ÉCHOUER PLUTÔT QUE MENTIR. Un veilleur d'une version antérieure ne connaît pas le
  // geste : il refuse, garde la place, et le neuf se retire. Rendre « ok » ici laisserait
  // croire à une relève qui n'a pas eu lieu — et c'est précisément le mode de panne que
  // cette capacité passe sa vie à combattre.
  if (!libre) {
    throw new Error(
      `Le veilleur en place n'a pas cédé la main${refus ? ` (${refus})` : ''}.\n` +
        `  C'est le cas d'une version antérieure à celle qui sait céder — une seule fois, il faut l'arrêter :\n` +
        `    pkill -f demarrer-veilleur.js\n` +
        `  Les relèves suivantes se feront toutes seules.`
    );
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

export async function parler(requete, { reveiller = true, cheminSocket = CHEMIN_SOCKET } = {}) {
  try {
    if (!existsSync(cheminSocket)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return await demander(requete, cheminSocket);
  } catch (err) {
    const absent = err.code === 'ENOENT' || err.code === 'ECONNREFUSED';
    if (!absent || !reveiller) throw err;
  }
  reveillerVeilleur();
  for (let essai = 0; essai < 40; essai += 1) {
    await dodo(250);
    try {
      if (existsSync(cheminSocket)) return await demander(requete, cheminSocket);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ECONNREFUSED') throw err;
    }
  }
  throw new Error(
    `Le veilleur n'a pas démarré en 10s. Regarde pourquoi : tail -20 ${CHEMIN_JOURNAL}\n` +
      `(cause la plus fréquente : un jeton absent ou vide au trousseau)`
  );
}

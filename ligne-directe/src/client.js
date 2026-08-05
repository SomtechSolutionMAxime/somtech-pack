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
export function demander(requete, cheminSocket = CHEMIN_SOCKET) {
  return new Promise((resolve, reject) => {
    const flux = connect(cheminSocket);
    let tampon = '';
    const minuteur = setTimeout(() => {
      flux.destroy();
      reject(new Error(`le veilleur n'a pas répondu en ${DELAI_REPONSE / 1000}s`));
    }, DELAI_REPONSE);
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

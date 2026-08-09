#!/usr/bin/env node
// naitre.js — la commande qui fait naître une session dans le lieu d'un client.
//
//   gestionnaire-naitre <client> --workspace <espace herdr>
//
// Elle ne pose jamais le lieu (compétence /gestionnaire-client, E-20260807-0002) : elle le
// vérifie, y repose le garde d'ouverture (à chaque appel — idempotent), puis fait naître le
// pane, EXACTEMENT à cet endroit. AUCUN shell : chaque commande herdr part par `execFile`
// avec un tableau d'arguments, comme ligne-directe/src/herdr.js et pour la même raison.
//
// L'ORDRE DES GESTES, ET POURQUOI IL A CHANGÉ (T-20260809-0023)
//
// Avant : créer le pane → NOMMER l'agent → lancer la session. L'agent était nommé avant
// d'exister — une session met plusieurs secondes à être détectée, le renommage partait
// aussitôt et échouait en `agent_not_found`. Le piège est documenté depuis longtemps dans
// /orchestrer-chantier §4b, avec sa boucle d'attente ; la naissance ne l'appliquait pas.
//
// Maintenant : créer le pane DANS le lieu → lancer la session → ATTENDRE que l'agent soit
// détecté → le nommer → VÉRIFIER PAR LE FAIT (le nom qu'il porte, le répertoire où il
// tourne). On ne parie sur aucun délai : on interroge jusqu'à ce que ce soit vrai, et on
// échoue bruyamment si ça ne l'est jamais.
//
// CE QUI NE SUBSISTE PAS D'UNE NAISSANCE RATÉE
// Dès qu'un pane est créé, tout échec ultérieur le referme avant de sortir. Un pane vide
// laissé derrière est ce que le dirigeant a trouvé au premier usage réel — et c'est ce qui
// rend une commande sortie en `0` doublement trompeuse : elle dit que tout va bien ET elle
// laisse une trace qui ressemble à un succès.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  poserGarde,
  commandesNaissance,
  lireReponseHerdr,
  agentDetecte,
  agentPorteLeNom,
  repertoireDeLaSession,
  LieuAbsent,
} from '../src/naissance.js';

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// La même patience que /orchestrer-chantier §4b : on interroge plutôt que de parier sur un
// délai. 30 × 2 s = une minute — assez pour une session qui démarre lentement, assez court
// pour qu'un échec réel se sache tout de suite. Surchargeable pour les tests seulement.
const ESSAIS = Number(process.env.NAISSANCE_ESSAIS || 30);
const DELAI_MS = Number(process.env.NAISSANCE_DELAI_MS || 2000);

function usage(code) {
  process.stderr.write('gestionnaire-naitre <client> --workspace <espace herdr>\n');
  process.exit(code);
}

function option(args, nom) {
  const i = args.indexOf(nom);
  return i === -1 ? null : args[i + 1] ?? null;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Un appel herdr, et son verdict — JAMAIS une exception.
 *
 * herdr sort non nul sur `agent_not_found` (constaté) mais rien ne garantit qu'il le fasse
 * pour tous ses refus, ni qu'il continue de le faire. On récupère donc la sortie standard
 * dans les DEUX cas et on laisse `lireReponseHerdr` trancher sur la réponse elle-même. C'est
 * ce qui ferme la porte au « code 0 alors que rien n'a abouti » : le verdict ne dépend plus
 * du code de sortie d'un service dont on n'a pas la maîtrise.
 */
async function appelHerdr(commande, { resultatAttendu = true } = {}) {
  try {
    const { stdout } = await execFileAsync('herdr', commande, { maxBuffer: 16 * 1024 * 1024 });
    return lireReponseHerdr(stdout, { commande, resultatAttendu });
  } catch (err) {
    return lireReponseHerdr(err?.stdout ?? '', { commande, erreurProcessus: err, resultatAttendu });
  }
}

/** Deux chemins désignent-ils le même répertoire ? (`/tmp` → `/private/tmp` sur macOS). */
function memeRepertoire(a, b) {
  if (!a || !b) return false;
  const reel = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return p;
    }
  };
  return reel(a) === reel(b);
}

async function main() {
  const args = process.argv.slice(2);
  const client = args[0];
  const workspace = option(args, '--workspace');
  if (!client || client.startsWith('--') || !workspace) usage(1);

  let cheminGarde;
  try {
    cheminGarde = poserGarde(REPO_ROOT, client);
  } catch (err) {
    if (err instanceof LieuAbsent) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  // Construire les commandes AVANT de créer quoi que ce soit : un nom que herdr refuserait
  // (`invalid_agent_name`) doit arrêter la commande ici, pas après avoir ouvert un pane.
  const commandes = commandesNaissance(REPO_ROOT, client, { workspace });

  const creation = await appelHerdr(commandes.tabCreate);
  if (!creation.ok) {
    process.stderr.write(`${creation.message}\n`);
    process.exit(1);
  }
  const paneId = creation.reponse?.result?.root_pane?.pane_id;
  if (!paneId) {
    process.stderr.write(
      `herdr tab create n’a rendu aucun pane_id : ${JSON.stringify(creation.reponse)}\n`
    );
    process.exit(1);
  }

  // À partir d'ici, un pane existe : tout échec le referme avant de sortir.
  const echouer = async (message) => {
    const fermeture = await appelHerdr(commandes.fermer(paneId));
    const reste = fermeture.ok ? '' : ` (⚠️ le pane ${paneId} n’a pas pu être refermé — ${fermeture.message})`;
    process.stderr.write(`${message}${reste}\n`);
    process.exit(1);
  };

  // `pane run` ne rend RIEN quand il réussit (mesuré contre le vrai service). Un refus, lui,
  // sort toujours en `{"error":…}` — c'est ce qu'on lit. Ce que ce silence ne prouve pas,
  // c'est que la session s'est ouverte : c'est l'attente ci-dessous qui l'établit.
  const lancement = await appelHerdr(commandes.paneRun(paneId), { resultatAttendu: false });
  if (!lancement.ok) await echouer(lancement.message);

  // Attendre que l'agent soit RÉELLEMENT détecté, plutôt que de parier sur un délai.
  let vu = null;
  for (let i = 0; i < ESSAIS; i += 1) {
    const etat = await appelHerdr(commandes.interroger(paneId));
    if (etat.ok && agentDetecte(etat.reponse)) {
      vu = etat.reponse;
      break;
    }
    await dormir(DELAI_MS);
  }
  if (!vu) {
    await echouer(
      `aucun agent détecté dans ${paneId} après ${Math.round((ESSAIS * DELAI_MS) / 1000)} s — ` +
        'la session ne s’est pas ouverte dans le lieu du représentant'
    );
  }

  const renommage = await appelHerdr(commandes.renommer(paneId));
  if (!renommage.ok) await echouer(renommage.message);

  // VÉRIFIER PAR LE FAIT, jamais par le mot : le nom qu'il porte et le répertoire où il
  // tourne, relus depuis herdr. Le renommage peut mettre un instant à se refléter, d'où la
  // relecture bornée — mais elle ne pardonne rien : ce qui n'est pas vrai à la fin échoue.
  let final = vu;
  for (let i = 0; i < ESSAIS; i += 1) {
    const etat = await appelHerdr(commandes.interroger(paneId));
    if (etat.ok && agentPorteLeNom(etat.reponse, commandes.nom)) {
      final = etat.reponse;
      break;
    }
    if (etat.ok) final = etat.reponse;
    await dormir(DELAI_MS);
  }
  if (!agentPorteLeNom(final, commandes.nom)) {
    await echouer(
      `l’agent de ${paneId} ne porte pas le nom « ${commandes.nom} » ` +
        `(il porte « ${final?.result?.agent?.name ?? '—'} ») — il resterait inadressable`
    );
  }

  const repertoire = repertoireDeLaSession(final);
  if (!memeRepertoire(repertoire, commandes.lieu)) {
    await echouer(
      `la session de ${paneId} ne tourne pas dans le lieu du représentant : ` +
        `${repertoire ?? '—'} au lieu de ${commandes.lieu} — née ailleurs, ` +
        'elle n’est pas représentante, c’est une session ordinaire'
    );
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      client,
      agent: commandes.nom,
      pane: paneId,
      garde: cheminGarde,
      lieu: commandes.lieu,
      repertoire,
    })}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});

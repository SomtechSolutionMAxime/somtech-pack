#!/usr/bin/env node
// naitre.js — la commande qui fait naître une session dans le lieu d'un agent.
//
//   gestionnaire-naitre <nom> --workspace <espace herdr> [--role representant|orchestrateur]
//                             [--depot <chemin>]
//
// Elle ne pose jamais le lieu (E-20260807-0002 pour le représentant, E-20260813-0002 pour
// l'orchestrateur) : elle le vérifie, y repose le garde d'ouverture (à chaque appel —
// idempotent), puis fait naître le pane, EXACTEMENT à cet endroit. AUCUN shell : chaque commande herdr part par `execFile`
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

import { dirname, resolve } from 'node:path';
import { realpathSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  poserGarde,
  commandesNaissance,
  avisDeCasse,
  agentDetecte,
  agentPorteLeNom,
  repertoireDeLaSession,
  LieuAbsent,
} from '../src/naissance.js';
import { livrerBrief } from '../src/livraison.js';
import { approuverLieu, ConfigIllisible } from '../src/approbation.js';
import { appelHerdr, lireEcran } from '../src/appel-herdr.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Le dépôt où le lieu a été posé.
 *
 * PAR DÉFAUT, celui qui héberge ce module — le comportement d'origine, et il reste juste
 * quand la commande est lancée depuis le dépôt du pack.
 *
 * DÉFAUT TROUVÉ PAR LA PREUVE RÉELLE, ET PAS PAR LES 826 TESTS VERTS : ce chemin est calculé
 * depuis la POSITION DU FICHIER. Or la pose, elle, accepte `--depot` depuis toujours. Poser
 * dans un dépôt et faire naître ailleurs donnait donc un refus parfaitement exact — « le lieu
 * n'existe pas » — sur un lieu qui venait d'être posé deux lignes plus haut. Le message était
 * juste, et il envoyait chercher au mauvais endroit.
 *
 * ⚠️ CE QUE CE CORRECTIF NE RÈGLE PAS, et qui est nommé plutôt qu'escamoté : installé en
 * outil de poste (`~/.somtech/naissance-representant`), le défaut vaut `~/.somtech` — donc
 * un représentant posé chez un client ne peut naître qu'en passant `--depot`. Le rendre
 * implicite (déduire le dépôt du répertoire courant) changerait le comportement d'appelants
 * déjà écrits ; ça se tranche sur un cas réel, pas ici.
 */
function depotDe(args) {
  const i = args.indexOf('--depot');
  return i === -1 ? resolve(HERE, '..', '..') : resolve(args[i + 1] ?? '.');
}

// La même patience que /orchestrer-chantier §4b : on interroge plutôt que de parier sur un
// délai. 30 × 2 s = une minute — assez pour une session qui démarre lentement, assez court
// pour qu'un échec réel se sache tout de suite. Surchargeable pour les tests seulement.
const ESSAIS = Number(process.env.NAISSANCE_ESSAIS || 30);
const DELAI_MS = Number(process.env.NAISSANCE_DELAI_MS || 2000);

function usage(code) {
  process.stderr.write(
    'gestionnaire-naitre <nom> --workspace <espace herdr> [--role representant|orchestrateur] ' +
      '[--depot <chemin>]\n'
  );
  process.exit(code);
}

function option(args, nom) {
  const i = args.indexOf(nom);
  return i === -1 ? null : args[i + 1] ?? null;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const nom = args[0];
  const workspace = option(args, '--workspace');
  // Le défaut reste `representant` : la commande existait pour lui, et un appelant déjà écrit
  // ne doit pas changer de comportement du seul fait qu'un second rôle existe.
  const role = option(args, '--role') || 'representant';
  const amorceFichier = option(args, '--amorce');
  const amorceTexte = option(args, '--amorce-texte');
  const REPO_ROOT = depotDe(args);
  if (!nom || nom.startsWith('--') || !workspace) usage(1);

  // L'amorce est lue AVANT qu'un pane existe : un fichier illisible doit arrêter la commande
  // ici, pas après avoir fait naître une session qu'on n'aura rien à dire.
  let amorce = null;
  if (amorceFichier || amorceTexte) {
    try {
      amorce = String(amorceFichier ? readFileSync(amorceFichier, 'utf8') : amorceTexte).trim();
    } catch (err) {
      process.stderr.write(`amorce illisible (${amorceFichier}) : ${err.message}\n`);
      process.exit(1);
    }
    if (!amorce) {
      process.stderr.write('une amorce vide n\u2019est pas une amorce\n');
      process.exit(1);
    }
  }

  let cheminGarde;
  try {
    cheminGarde = poserGarde(REPO_ROOT, nom, role);
  } catch (err) {
    if (err instanceof LieuAbsent) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  // Construire les commandes AVANT de créer quoi que ce soit : un nom que herdr refuserait
  // (`invalid_agent_name`) doit arrêter la commande ici, pas après avoir ouvert un pane.
  const commandes = commandesNaissance(REPO_ROOT, nom, { workspace, role });

  // Dire, AVANT que quoi que ce soit existe, que l'agent ne portera pas le nom du lieu
  // (T-20260814-0143). L'écart était déjà dans l'objet rendu — dans un champ que personne
  // ne relit. On le dit donc là où un humain regarde, et seulement quand il y a un écart.
  //
  // On lui DONNE `commandes.nom` — le nom que herdr recevra réellement, calculé par
  // `nomAgentHerdr` juste au-dessus. L'avis ne recalcule pas la règle de casse : deux
  // endroits qui portent la même règle divergent au premier changement de l'un (motif de
  // T-20260814-0101, refermé un cran plus haut le jour même).
  const avis = avisDeCasse(nom, commandes.nom);
  if (avis) process.stderr.write(`${avis}\n`);

  // APPROUVER LE LIEU AVANT DE LANCER LA SESSION — sans quoi elle s'arrête sur l'écran de
  // confiance de Claude Code et attend une touche que personne ne tapera. Elle serait
  // pourtant DÉTECTÉE, dans le bon répertoire, portant son nom : une naissance qui a l'air
  // réussie de tous les points de vue observables, et une session qui ne commence jamais.
  // Mesuré contre le vrai `claude` (voir src/approbation.js).
  let approbation;
  try {
    approbation = approuverLieu(commandes.lieu);
  } catch (err) {
    if (err instanceof ConfigIllisible) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

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

  // ═══ L'AMORCE — le sixième des sept défauts : une session « née correctement, qui ne fait
  // rien, parce que personne ne lui dit de commencer ». Elle passe par la MÊME porte que
  // `livrer.js`, qui regarde la boîte avant d'écrire et vérifie par le fait que le brief a
  // été pris. Un `herdr agent prompt` nu rendrait « livré » sur un brief resté dans la boîte.
  //
  // Un échec d'amorce ne referme PAS le pane, et c'est délibéré : à ce stade la session est
  // née, elle est dans son lieu, elle porte son nom et son garde — la détruire coûterait plus
  // que de dire ce qui manque. Mais la commande ÉCHOUE : une naissance qui n'a pas amorcé
  // n'est pas une naissance réussie, et la déclarer telle est exactement ce que le défaut
  // faisait.
  let amorcee = false;
  if (amorce) {
    const livre = await livrerBrief({
      pane: paneId,
      texte: amorce,
      appelHerdr,
      lireEcran,
      dormir,
      essais: ESSAIS,
      delaiMs: DELAI_MS,
      // La session vient de naître : on lui laisse le temps d'afficher sa boîte de saisie,
      // avec la même patience qu'on a mise à attendre qu'elle soit détectée.
      essaisDisponible: ESSAIS,
    });
    if (!livre.ok) {
      process.stderr.write(
        `la session de ${paneId} est née dans son lieu mais n\u2019a pas pris son amorce : ${livre.message}\n` +
          `  Le pane est laissé ouvert — briefe-la à la main plutôt que de la refaire naître.\n`
      );
      process.exit(1);
    }
    amorcee = true;
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      role,
      nom,
      amorcee,
      client: nom, // conservé : le contrat de sortie d'origine, que des appelants lisent déjà
      depot: REPO_ROOT,
      agent: commandes.nom,
      pane: paneId,
      garde: cheminGarde,
      approuve: approbation.deja ? 'déjà' : 'maintenant',
      lieu: commandes.lieu,
      repertoire,
    })}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});

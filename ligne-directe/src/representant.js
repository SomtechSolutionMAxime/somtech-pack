// representant.js — préparer le LIEU d'un représentant client, jamais transformer la session.
//
// POURQUOI LA GARDE DE CE FICHIER EST STRUCTURÉE COMME ELLE L'EST
//
// Le brief de ce lot (E-20260807-0002) nomme trois défauts vécus sur le chantier qui l'a
// précédé, et les deux premiers visent directement ce module :
//
//   1. « une garde qui refuse doit être prouvée par ce qu'elle EMPÊCHE, jamais par ce
//      qu'elle affiche » — donc chaque test de refus vérifie l'ABSENCE du répertoire créé,
//      jamais le texte du message.
//   2. « une porte sur deux » — donc il n'existe qu'UN SEUL point d'écriture dans tout ce
//      fichier (voir plus bas), atteint par UN SEUL appelant, derrière DEUX gardes
//      empilées : l'idempotence, puis la joignabilité. Les deux sont testées séparément.
//
// Ce module ne parle jamais à Slack lui-même : il reçoit la réponse à « le canal est-il
// joignable ? » en paramètre (`verifierJoignabilite`), une fonction fournie par l'appelant.
// `verifierCanalJoignable`, plus bas, est l'implémentation réelle — celle que la ligne de
// commande branche — mais un test peut en fournir une autre sans monter Slack du tout.

import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { trouverCanal, estMembreDuCanal } from './slack.js';

/** Les quatre fichiers qui constituent le lieu du représentant. Ordre sans importance. */
export const GABARITS = ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json', 'settings.json'];

/** Fichiers dont la présence, à la racine du dépôt client, atteste un accès au registre. */
export const FICHIERS_ENV_CONNUS = ['.env', '.envrc'];

/** Où le pack dépose les gabarits dans un dépôt qui l'a installé (module `core`). */
function gabaritsDir(depotClient) {
  return join(depotClient, '.claude', 'templates', 'gestionnaire-client');
}

/** Le dépôt client porte-t-il un fichier d'environnement connu, à sa racine ? */
export function aFichierEnvironnement(depotClient) {
  return FICHIERS_ENV_CONNUS.some((f) => existsSync(join(depotClient, f)));
}

/**
 * Ce que le lieu d'un client contient déjà, sans jamais y toucher.
 *
 * Ne regarde PAS si les quatre fichiers sont tous là : un lieu PARTIELLEMENT posé (une
 * interruption au milieu d'une pose précédente, par exemple) doit rester intact lui aussi —
 * « elle ne recrée rien, n'écrase rien » ne souffre pas d'exception pour un lieu incomplet.
 */
export function etatLieu(depotClient, client) {
  const racine = join(depotClient, '.gestionnaire', client);
  if (!existsSync(racine)) return { existe: false, racine };
  const presents = GABARITS.filter((f) => existsSync(join(racine, f)));
  const manquants = GABARITS.filter((f) => !presents.includes(f));
  return { existe: true, racine, presents, manquants };
}

/**
 * Le canal est-il joignable, RÉELLEMENT — pas « existe-t-il », mais « notre robot peut-il y
 * être lu » ? Deux réponses négatives distinctes, parce que le geste qui lève chacune n'est
 * pas le même : un canal absent se crée ou se corrige (faute de frappe) ; un canal dont on
 * n'est pas membre se règle par une invitation humaine, jamais par du code — un robot ne
 * rejoint pas un canal privé (mesuré : `conversations.join` n'aboutit sur aucun canal privé,
 * quel que soit le droit accordé). On ne tente donc jamais de le rejoindre ici.
 *
 * @param {string} jetonRobot
 * @param {string} nomCanal
 */
export async function verifierCanalJoignable(jetonRobot, nomCanal) {
  const canal = await trouverCanal(jetonRobot, nomCanal);
  if (!canal) return { joignable: false, motif: 'absent', canal: nomCanal };

  const membre = await estMembreDuCanal(jetonRobot, canal);
  if (!membre) return { joignable: false, motif: 'non_membre', canal: nomCanal, id: canal.id };

  return { joignable: true, canal: nomCanal, id: canal.id, prive: Boolean(canal.is_private) };
}

/** Le message de refus, écrit pour être lu et suivi — jamais pour être analysé par un test. */
function messageDeRefus(joignabilite) {
  if (joignabilite.motif === 'absent') {
    return (
      `le canal « ${joignabilite.canal} » est introuvable — vérifie le nom, ou fais-le créer ` +
      `par un humain, puis relance.`
    );
  }
  return (
    `notre robot n'est pas membre de « ${joignabilite.canal} » et ne peut pas s'y mettre ` +
    `lui-même — fais-le inviter à la main dans Slack ("/invite" depuis le canal), puis relance.`
  );
}

/**
 * Prépare le lieu du représentant dans le dépôt du client.
 *
 * UN SEUL POINT D'ÉCRITURE dans tout ce module : le bloc marqué plus bas. Il n'est atteint
 * que si `etatLieu` dit que rien n'existe encore ET que `verifierJoignabilite` dit que le
 * canal est joignable — dans cet ordre, pour que relancer un client déjà installé ne fasse
 * JAMAIS un appel réseau (voir le test qui le prouve en faisant échouer la vérification si
 * elle est invoquée sur un lieu déjà posé).
 *
 * @param {object} p
 * @param {string} p.depotClient        racine du dépôt du client (celui qui reçoit le lieu)
 * @param {string} p.client             nom du client — dossier sous `.gestionnaire/`
 * @param {string} p.canal              nom du canal, pour le message de refus uniquement
 * @param {() => Promise<{joignable: boolean, motif?: string}>} p.verifierJoignabilite
 */
export async function preparerLieuRepresentant({ depotClient, client, canal, verifierJoignabilite }) {
  const etat = etatLieu(depotClient, client);
  if (etat.existe) {
    return { ok: true, cree: false, deja_installe: true, ...etat };
  }

  const joignabilite = await verifierJoignabilite();
  if (!joignabilite.joignable) {
    return {
      ok: false,
      cree: false,
      refus: { motif: joignabilite.motif, canal, message: messageDeRefus({ ...joignabilite, canal }) },
    };
  }

  // ═══ SEUL POINT D'ÉCRITURE — rien avant cette ligne n'a créé quoi que ce soit sur disque.
  const racine = join(depotClient, '.gestionnaire', client);
  const source = gabaritsDir(depotClient);
  mkdirSync(racine, { recursive: true });
  for (const fichier of GABARITS) {
    copyFileSync(join(source, fichier), join(racine, fichier));
  }
  // ═══ fin du point d'écriture.

  const avertissements = [];
  if (!aFichierEnvironnement(depotClient)) {
    avertissements.push(
      `${depotClient} ne porte aucun fichier d'environnement (${FICHIERS_ENV_CONNUS.join(' ou ')}) — ` +
        `le représentant naîtra sans accès au registre tant que le dépôt n'en aura pas un.`
    );
  }

  return { ok: true, cree: true, racine, fichiers: [...GABARITS].sort(), avertissements };
}

/** Utilitaire de diagnostic — les fichiers réellement présents dans un lieu, triés. */
export function fichiersDuLieu(depotClient, client) {
  const racine = join(depotClient, '.gestionnaire', client);
  if (!existsSync(racine)) return [];
  return readdirSync(racine).sort();
}

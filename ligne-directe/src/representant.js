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

import { existsSync, mkdirSync, copyFileSync, rmSync, rmdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { trouverCanal, estMembreDuCanal } from './slack.js';

/**
 * Les quatre fichiers qui constituent le lieu du représentant, en CHEMINS RELATIFS à sa
 * racine — pas en simples noms. `settings.json` n'est PAS à plat : Claude Code ne lit les
 * permissions projet qu'à `.claude/settings.json`, jamais à la racine (mesuré sur ce dépôt
 * même — voir le test qui l'ancre à cette réalité observée, pas à une supposition).
 *
 * DÉFAUT VÉCU ICI, et il n'est pas théorique : la première version posait les quatre
 * fichiers à plat. `.mcp.json` fonctionnait — Claude Code LE lit bien à la racine — et ce
 * seul succès a caché que `settings.json`, lui, était mort au même endroit : posé, présent,
 * jamais lu. RA-REL-015 (« aucune écriture, aucun envoi, aucune fusion ») aurait été fausse
 * en production, derrière des tests qui ne vérifiaient que le CONTENU du fichier, jamais où
 * Claude Code va le chercher — exactement le motif qui a coûté le plus cher au chantier
 * précédent : une fonction inerte, derrière des tests verts qui ne regardaient pas l'effet.
 */
export const GABARITS = ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json', join('.claude', 'settings.json')];

/** Fichiers dont la présence, à la racine du dépôt client, atteste un accès au registre. */
export const FICHIERS_ENV_CONNUS = ['.env', '.envrc'];

/** Où le pack dépose les gabarits dans un dépôt qui l'a installé (module `core`). */
function gabaritsDir(depotClient) {
  return join(depotClient, '.claude', 'templates', 'gestionnaire-client');
}

/**
 * Ce que la SOURCE offre, avant qu'on ait écrit quoi que ce soit — fichier par fichier, jamais
 * « le répertoire existe ».
 *
 * DÉFAUT VÉCU ICI (T-20260807-0067) : rien ne vérifiait la source du tout. Sur un dépôt qui
 * n'avait pas reçu la version du pack portant les gabarits, `mkdirSync` créait
 * `.gestionnaire/<client>/`, puis `copyFileSync` levait un `ENOENT` brut — et le répertoire
 * vide restait. La relance suivante le lisait comme un lieu posé. Vérifier seulement la
 * présence du RÉPERTOIRE de gabarits n'aurait corrigé qu'une porte sur deux : un pack
 * partiellement déposé serait passé, pour échouer sur le fichier manquant, au même endroit.
 */
export function etatSource(depotClient) {
  const source = gabaritsDir(depotClient);
  const presents = GABARITS.filter((f) => existsSync(join(source, f)));
  const manquants = GABARITS.filter((f) => !presents.includes(f));
  return { source, complete: manquants.length === 0, presents, manquants };
}

/** Le dépôt client porte-t-il un fichier d'environnement connu, à sa racine ? */
export function aFichierEnvironnement(depotClient) {
  return FICHIERS_ENV_CONNUS.some((f) => existsSync(join(depotClient, f)));
}

/**
 * Ce que le lieu d'un client contient déjà, sans jamais y toucher.
 *
 * Rend `existe` ET `complet`, et la distinction n'est pas cosmétique : c'est le défaut le plus
 * grave de T-20260807-0067. Un répertoire créé puis abandonné par une pose qui a échoué EXISTE
 * sans être un lieu — `presents: []` et `deja_installe: true` ne peuvent pas coexister. Un
 * représentant ouvert là n'aurait ni métier, ni outils, ni permissions bornées, et rien ne le
 * signalerait. L'idempotence ne repose donc que sur `complet` ; un lieu partiel est nommé comme
 * tel et refusé — jamais complété (« elle ne recrée rien, n'écrase rien » reste entier), jamais
 * déclaré installé.
 */
export function etatLieu(depotClient, client) {
  const racine = join(depotClient, '.gestionnaire', client);
  if (!existsSync(racine)) return { existe: false, complet: false, racine, presents: [], manquants: [...GABARITS] };
  const presents = GABARITS.filter((f) => existsSync(join(racine, f)));
  const manquants = GABARITS.filter((f) => !presents.includes(f));
  return { existe: true, complet: manquants.length === 0, racine, presents, manquants };
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

/**
 * Retire ce qu'une pose interrompue avait commencé — le lieu de CE client, et rien d'autre.
 *
 * DÉFAUT RELEVÉ EN REVUE, et il n'est pas théorique : la première version de ce retrait
 * décidait de supprimer `.gestionnaire/` entier d'après un `existsSync` lu AVANT l'écriture
 * (« il n'existait pas quand j'ai commencé, donc c'est moi qui l'ai créé, donc je peux le
 * reprendre »). Entre cette lecture et le retrait, un autre processus a le temps de poser le
 * lieu d'un AUTRE client : deux poses lancées ensemble sur le même dépôt lisent toutes deux
 * « il n'existait pas », et celle qui échoue emporte le lieu que l'autre venait de réussir.
 *
 * On ne présume donc plus de qui a créé quoi : on retire le lieu du client, puis on tente de
 * retirer `.gestionnaire/` SANS `recursive` — le noyau refuse (`ENOTEMPTY`) s'il reste le
 * moindre voisin dedans, et c'est lui, pas nous, qui arbitre au moment exact du retrait.
 */
export function retirerCeQuiAEteCommence(depotClient, client) {
  rmSync(join(depotClient, '.gestionnaire', client), { recursive: true, force: true });
  try {
    rmdirSync(join(depotClient, '.gestionnaire')); // sans `recursive` : échoue s'il reste un voisin
  } catch {
    // Il reste quelque chose, ou il n'y a plus rien à retirer — dans les deux cas, ce n'est
    // plus notre affaire. Le lieu de ce client, lui, est bien parti.
  }
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
  // ─── Garde 1 : l'idempotence, et elle ne vaut QUE pour un lieu complet.
  const etat = etatLieu(depotClient, client);
  if (etat.complet) {
    return { ok: true, cree: false, deja_installe: true, ...etat };
  }
  if (etat.existe) {
    return {
      ok: false,
      cree: false,
      deja_installe: false,
      ...etat,
      refus: {
        motif: 'lieu_partiel',
        racine: etat.racine,
        presents: etat.presents,
        manquants: etat.manquants,
        message:
          `« ${etat.racine} » existe mais n'est pas un lieu : il manque ${etat.manquants.join(', ')}. ` +
          `Un représentant ouvert là n'aurait ni métier, ni moyens, ni permissions bornées. ` +
          `Retire ce reste (« rm -rf ${etat.racine} »), puis relance — cette compétence ne complète ` +
          `jamais un lieu à demi posé, elle ne saurait pas ce qu'un humain y a déjà changé.`,
      },
    };
  }

  // ─── Garde 2 : la SOURCE, vérifiée au même titre que le canal, et AVANT lui — un refus qui
  // ne dépend que du disque local ne doit coûter aucun aller-retour réseau.
  const source = etatSource(depotClient);
  if (!source.complete) {
    return {
      ok: false,
      cree: false,
      refus: {
        motif: 'gabarits_absents',
        source: source.source,
        manquants: source.manquants,
        message:
          `ce dépôt n'a pas reçu la version du pack qui porte les gabarits du représentant : ` +
          `${source.manquants.join(', ')} ${source.manquants.length > 1 ? 'sont introuvables' : 'est introuvable'} ` +
          `sous « ${source.source} ». Mets le pack à jour dans ce dépôt ` +
          `(« npx @somtech-solutions/pack update »), puis relance.`,
      },
    };
  }

  // ─── Garde 3 : la joignabilité du canal.
  const joignabilite = await verifierJoignabilite();
  if (!joignabilite.joignable) {
    return {
      ok: false,
      cree: false,
      refus: { motif: joignabilite.motif, canal, message: messageDeRefus({ ...joignabilite, canal }) },
    };
  }

  // ═══ SEUL POINT D'ÉCRITURE — rien avant cette ligne n'a créé quoi que ce soit sur disque.
  //
  // Il est enveloppé, et ce n'est pas de la ceinture-bretelles : les trois gardes ci-dessus
  // rendent l'échec improbable, pas impossible (disque plein, droits retirés, gabarit remplacé
  // par un répertoire). Ce qui ne doit JAMAIS survivre à un échec, c'est le lieu à demi posé —
  // c'est lui, et lui seul, que la relance suivante lirait comme un lieu.
  const racine = join(depotClient, '.gestionnaire', client);
  try {
    mkdirSync(racine, { recursive: true });
    for (const fichier of GABARITS) {
      const cible = join(racine, fichier);
      mkdirSync(dirname(cible), { recursive: true }); // ex. .claude/ pour settings.json
      copyFileSync(join(source.source, fichier), cible);
    }
  } catch (err) {
    retirerCeQuiAEteCommence(depotClient, client);
    return {
      ok: false,
      cree: false,
      refus: {
        motif: 'ecriture_interrompue',
        racine,
        message:
          `la pose de « ${racine} » s'est interrompue (${err.message}) — ce qu'elle avait commencé ` +
          `a été retiré, rien ne subsiste. Corrige la cause, puis relance.`,
      },
    };
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

// approbation.js — déclarer le lieu comme approuvé AVANT d'y faire naître une session.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT, TROUVÉ PAR LA PREUVE RÉELLE ET PAR RIEN D'AUTRE (E-20260813-0002)
//
// Une session ouverte dans un répertoire que Claude Code n'a jamais vu s'arrête sur son
// écran de confiance — « Yes, I trust this folder / No, exit » — et attend une touche.
// MESURÉ le 2026-08-13 contre le vrai `claude` : l'écran est toujours là après 25 secondes,
// et rien ne bouge.
//
// ET IL Y EN A DEUX, PAS UN — le second n'a été trouvé qu'en poussant la preuve jusqu'au
// bout. Une fois le dossier approuvé, la session s'arrête sur l'écran SUIVANT : « 2 new MCP
// servers found in this project — Select any you wish to enable ». Les serveurs en question
// sont ceux que le lieu déclare lui-même, dans le `.mcp.json` que la pose vient d'écrire.
//
// Corriger le premier écran sans le second aurait donné exactement ce que ce dépôt appelle
// « une porte sur deux » : un correctif juste, mesuré, et sans effet — la session s'arrêtant
// simplement un écran plus loin.
//
// Ce qui rend ces défauts coûteux, c'est qu'ils sont presque invisibles :
//
//   • l'agent EST détecté par le gestionnaire de panes — la naissance se déclare réussie ;
//   • le répertoire de travail EST le bon — la vérification par le fait passe ;
//   • la session est simplement… arrêtée devant une question que personne ne lira.
//
// C'est le SIXIÈME des sept défauts du lot jumeau — « née correctement, ne fait rien, parce
// que personne ne lui dit de commencer » — avec une cause de plus, jamais nommée : elle ne
// peut pas commencer, elle attend une approbation. Le lot du gestionnaire ne l'a pas vu
// parce que sa preuve réelle s'arrêtait au répertoire de travail ; celle-ci va jusqu'à
// « la session FAIT quelque chose », et c'est là que ça s'est vu.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QU'ON APPROUVE, ET CE QU'ON N'APPROUVE PAS
//
// UNIQUEMENT le lieu qu'on vient de poser : un répertoire de quatre fichiers écrits par le
// pack, dont les permissions sont bornées par son propre `settings.json`. Jamais le dépôt,
// jamais un parent, jamais un chemin reçu d'ailleurs — l'appelant passe le lieu qu'il a
// lui-même vérifié complet.
//
// Et UNIQUEMENT les serveurs que CE lieu déclare, lus dans SON `.mcp.json` — jamais une
// liste écrite en dur ici. Un gabarit qui gagnerait un serveur demain le verrait activé sans
// que ce fichier bouge ; une liste en dur, elle, laisserait la session s'arrêter sur le seul
// serveur qu'on aurait oublié d'y ajouter. C'est le même principe que la mise à jour des
// copies, qui énumère depuis la source plutôt que de compter en dur.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LA PRUDENCE QUE MÉRITE CE FICHIER
//
// `~/.claude.json` porte la configuration de TOUTES les sessions du poste — 102 projets au
// moment d'écrire ces lignes. Le corrompre les casserait toutes. Trois règles, tenues ici :
//
//   1. **on ne réécrit jamais ce qu'on n'a pas su lire.** Un fichier illisible ou invalide
//      fait ÉCHOUER l'approbation ; il ne fait jamais repartir d'un objet vide, ce qui
//      effacerait 102 projets pour en ajouter un ;
//   2. **on n'écrit pas par-dessus.** Écriture dans un fichier voisin, puis renommage — le
//      noyau garantit que le remplacement est atomique. Une écriture interrompue à mi-course
//      laisserait sinon un JSON tronqué là où tout le poste va lire ;
//   3. **on ne touche à rien d'autre.** Seule la clé du lieu est ajoutée, et seulement si
//      elle n'est pas déjà là.

import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Les formes sous lesquelles un même lieu peut être désigné — et il faut les DEUX.
 *
 * DÉFAUT MESURÉ le 2026-08-13 : `resolve()` normalise un chemin sans suivre les liens, or
 * sur ce système `/tmp` et `/var` en sont (`/var/folders/…` est `/private/var/folders/…`).
 * Le lieu était donc approuvé sous un nom que la session ne voyait pas — l'approbation
 * réussissait, l'écran de confiance restait, et la session ne commençait toujours pas. Le
 * correctif était juste et n'avait aucun effet : la pire des deux situations, parce qu'elle
 * a l'air réglée.
 *
 * On n'essaie pas de DEVINER laquelle des deux le processus verra : on approuve les deux
 * quand elles diffèrent. Deviner coûte une session muette ; une clé de plus ne coûte rien.
 */
export function formesDuLieu(lieu) {
  const normalise = resolve(lieu);
  let reel = normalise;
  try {
    reel = realpathSync(normalise);
  } catch {
    // Le lieu n'existe pas encore, ou n'est pas lisible : la forme normalisée fera foi.
  }
  return reel === normalise ? [normalise] : [normalise, reel];
}

/** Le fichier où Claude Code tient les répertoires qu'il a vus, et ce qu'il en sait. */
export function cheminConfig() {
  return join(homedir(), '.claude.json');
}

/**
 * Les serveurs que le lieu déclare, lus dans SON `.mcp.json`.
 *
 * Un lieu sans `.mcp.json`, ou dont le fichier est illisible, ne déclare rien : on n'invente
 * pas de serveurs, et l'absence de cette liste ne fait échouer aucune naissance — l'écran
 * d'activation n'apparaît que s'il y a quelque chose à activer.
 */
export function serveursDuLieu(lieu) {
  try {
    const declare = JSON.parse(readFileSync(join(resolve(lieu), '.mcp.json'), 'utf8'));
    return Object.keys(declare?.mcpServers || {});
  } catch {
    return [];
  }
}

/**
 * Le lieu est-il DÉJÀ approuvé, d'après une configuration déjà lue ?
 *
 * « Approuvé » veut dire les DEUX : le dossier est de confiance, ET chacun des serveurs qu'il
 * déclare est activé. N'en vérifier qu'un laisserait la session s'arrêter sur l'autre écran,
 * et l'appelant croirait n'avoir rien à faire.
 *
 * Rendu à part pour que l'appelant puisse ne rien écrire quand il n'y a rien à faire — la
 * meilleure façon de ne pas corrompre un fichier partagé est de ne pas l'ouvrir.
 */
export function dejaApprouve(config, lieu) {
  const serveurs = serveursDuLieu(lieu);
  return formesDuLieu(lieu).every((forme) => {
    const projet = config?.projects?.[forme];
    if (!projet?.hasTrustDialogAccepted) return false;
    const actifs = new Set(projet.enabledMcpjsonServers || []);
    return serveurs.every((s) => actifs.has(s));
  });
}

/**
 * La configuration, avec le lieu approuvé — fonction PURE, donc exerçable sans jamais
 * toucher au fichier du poste.
 *
 * Les autres clés du projet (outils permis, serveurs activés) sont conservées telles quelles
 * si le projet existe déjà : on ajoute une approbation, on ne redéfinit pas un projet.
 */
export function avecApprobation(config, lieu) {
  const serveurs = serveursDuLieu(lieu);
  const projects = { ...(config.projects || {}) };
  for (const cle of formesDuLieu(lieu)) {
    const projet = projects[cle] || {};
    // Union, jamais remplacement : un serveur activé à la main pour ce lieu doit survivre.
    const actifs = [...new Set([...(projet.enabledMcpjsonServers || []), ...serveurs])];
    projects[cle] = { ...projet, hasTrustDialogAccepted: true, enabledMcpjsonServers: actifs };
  }
  return { ...config, projects };
}

export class ConfigIllisible extends Error {
  constructor(chemin, cause) {
    super(
      `la configuration du poste (${chemin}) n'a pas pu être lue : ${cause.message}\n` +
        `  Rien n'a été écrit — elle porte la configuration de TOUTES les sessions de ce poste, ` +
        `et la réécrire sans l'avoir lue les effacerait toutes.\n` +
        `  Répare-la (ou restaure-la), puis relance.`
    );
    this.name = 'ConfigIllisible';
    this.chemin = chemin;
    this.cause = cause;
  }
}

/**
 * Approuve le lieu dans la configuration du poste. Idempotent : un lieu déjà approuvé
 * n'entraîne AUCUNE écriture.
 *
 * @returns {{approuve: boolean, deja: boolean, chemin: string}}
 */
export function approuverLieu(lieu, { chemin = cheminConfig() } = {}) {
  // Un fichier absent est le cas d'un poste neuf : on part d'un objet vide, ce qui n'efface
  // rien. Un fichier PRÉSENT mais illisible est l'inverse exact, et il ne se traite pas pareil.
  let config = {};
  if (existsSync(chemin)) {
    try {
      config = JSON.parse(readFileSync(chemin, 'utf8'));
    } catch (err) {
      throw new ConfigIllisible(chemin, err);
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new ConfigIllisible(chemin, new Error('le contenu n’est pas un objet'));
    }
  }

  if (dejaApprouve(config, lieu)) return { approuve: true, deja: true, chemin };

  // Écriture atomique : un voisin, puis un renommage. Le voisin vit dans le MÊME répertoire,
  // sans quoi le renommage traverserait les systèmes de fichiers et cesserait d'être atomique.
  const provisoire = `${chemin}.somtech-${process.pid}.tmp`;
  try {
    writeFileSync(provisoire, `${JSON.stringify(avecApprobation(config, lieu), null, 2)}\n`);
    renameSync(provisoire, chemin);
  } catch (err) {
    try {
      if (existsSync(provisoire)) unlinkSync(provisoire);
    } catch {
      // Le provisoire reste : c'est un fichier de plus, jamais une configuration cassée.
    }
    throw err;
  }
  return { approuve: true, deja: false, chemin };
}

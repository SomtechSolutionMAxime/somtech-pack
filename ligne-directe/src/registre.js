// registre.js — qui parle à qui, et où.
//
// Le registre est la seule chose qui survit à la mort d'un agent ET au redémarrage du
// poste. C'est lui qui permet de répondre « ce chantier est clos » au lieu d'avaler un
// message dans le vide : une ligne fermée reste inscrite, marquée close.
//
// Il vit sur disque en JSON. Écriture atomique (fichier temporaire puis renommage) : un
// veilleur tué en plein vol ne doit pas laisser un registre tronqué derrière lui — on
// perdrait l'appariement de toutes les lignes ouvertes, pas seulement celle en cours.

import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const RACINE = process.env.LIGNE_DIRECTE_RACINE || join(homedir(), '.somtech', 'ligne-directe');
export const CHEMIN_REGISTRE = join(RACINE, 'registre.json');
export const CHEMIN_SOCKET = join(RACINE, 'veilleur.sock');
export const CHEMIN_JOURNAL = join(RACINE, 'veilleur.log');

const VERSION = 1;

function vide() {
  return { version: VERSION, lignes: [] };
}

export function chargerRegistre(chemin = CHEMIN_REGISTRE) {
  if (!existsSync(chemin)) return vide();
  try {
    const brut = JSON.parse(readFileSync(chemin, 'utf8'));
    if (!brut || !Array.isArray(brut.lignes)) return vide();
    return { version: brut.version || VERSION, lignes: brut.lignes };
  } catch {
    // Un registre illisible ne doit pas empêcher le veilleur de démarrer : il repart
    // à vide plutôt que de refuser de vivre. Les canaux orphelins seront signalés.
    return vide();
  }
}

export function sauverRegistre(registre, chemin = CHEMIN_REGISTRE) {
  mkdirSync(dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.tmp`;
  writeFileSync(temporaire, `${JSON.stringify(registre, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaire, chemin);
  try {
    chmodSync(chemin, 0o600);
  } catch {
    /* le registre ne porte pas de secret, mais il nomme les chantiers en cours */
  }
  return chemin;
}

/** Clé d'identité d'une ligne : le couple chantier + copie de travail. */
export function cleDeLigne(chantier, worktree) {
  return `${String(chantier).toLowerCase()}::${worktree || ''}`;
}

export function lignesOuvertes(registre) {
  return registre.lignes.filter((l) => !l.close_le);
}

/**
 * La ligne d'un canal — **l'ouverte d'abord**.
 *
 * BLOQUANT relevé en revue : un `.find()` naïf rendait la ligne CLOSE quand un chantier
 * était rouvert. Or Slack réutilise le même canal quand on reprend un nom libéré : la
 * nouvelle ligne partage donc l'identifiant de l'ancienne. L'agent vivant ne recevait
 * jamais rien, et le dirigeant s'entendait répondre « cette ligne est close » à
 * perpétuité — le registre survivant au redémarrage, c'était définitif. Et c'est le cycle
 * NOMINAL d'un chantier repris.
 */
export function ligneParCanal(registre, canalId) {
  const ouverte = registre.lignes.find((l) => l.canal_id === canalId && !l.close_le);
  if (ouverte) return ouverte;
  // Aucune ouverte : on rend la plus récemment close, pour pouvoir répondre « c'est clos »
  // au lieu d'avaler le message.
  const closes = registre.lignes.filter((l) => l.canal_id === canalId);
  return closes.length ? closes[closes.length - 1] : null;
}

export function ligneOuverteParCle(registre, chantier, worktree) {
  const cle = cleDeLigne(chantier, worktree);
  return lignesOuvertes(registre).find((l) => cleDeLigne(l.chantier, l.worktree) === cle) || null;
}

export function nomsPris(registre) {
  return new Set(registre.lignes.filter((l) => !l.close_le).map((l) => l.canal_nom));
}

export function inscrireLigne(registre, ligne) {
  registre.lignes.push(ligne);
  return ligne;
}

export function clore(registre, canalId, quand) {
  const ligne = ligneParCanal(registre, canalId);
  if (!ligne || ligne.close_le) return null;
  ligne.close_le = quand;
  return ligne;
}

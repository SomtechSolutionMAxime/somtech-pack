// ============================================================
// version-poste.js — « quelle version du pack est installée sur CE poste ? »
//
// POURQUOI CE FICHIER EXISTE — T-20260816-0020
//
// L'installation PROJET écrivait `.somtech-pack/version.json` ; l'installation
// POSTE n'écrivait rien. La moitié qui manquait est celle qui sert à savoir si
// le poste est à jour — et un orchestrateur a cité, plusieurs fois dans une
// soirée, « six versions publiées, zéro installée » : un chiffre fabriqué, qui
// a servi d'argument dans trois décisions.
//
// ⚠️ Le défaut n'était PAS cette erreur. C'est que **rien ne permettait de le
// contredire**. Un chiffre invérifiable ne se corrige jamais tout seul.
//
// D'OÙ LES TROIS INTERDITS QUE CE MODULE FAIT RESPECTER, et que son banc
// éprouve un par un :
//   1. Un poste jamais installé rend **ABSENTE**, jamais un numéro. Un numéro
//      plausible se cite ; une absence se cherche.
//   2. Ne pas avoir pu regarder rend **INDETERMINE**, jamais « à jour ». Un
//      silence n'est pas une bonne nouvelle.
//   3. Une valeur de cache dit **son âge**. Mesuré le 2026-08-20 : le cache
//      servait un « dernier publié » vieux de 24 h et de sept versions, sans
//      que rien ne l'annonce. Un cache a le droit d'être en retard ; il n'a pas
//      le droit de se faire passer pour frais.
// ============================================================

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Le marqueur, au même endroit conceptuel que celui d'une installation projet. */
export const MARQUEUR_POSTE = join('.somtech-pack', 'version.json');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)/;

/**
 * Compare deux versions CHAMP PAR CHAMP.
 * ⚠️ Jamais une clé pondérée (`maj*1e6 + min*1e3 + pat`) : elle déborde sur le
 * champ voisin dès qu'un composant atteint sa base — `1.0.1000` et `1.1.0` y
 * valent le même nombre. Mesuré le 2026-09-20 sur le comparateur jumeau de
 * `/merge` (T-20260820-0097), où il rendait le mauvais tag SANS ERREUR.
 * Rend -1, 0, 1, ou null si l'une des deux n'est pas un semver.
 */
export function comparerVersions(a, b) {
  const ma = SEMVER.exec(String(a ?? ''));
  const mb = SEMVER.exec(String(b ?? ''));
  if (!ma || !mb) return null;
  for (let i = 1; i <= 3; i += 1) {
    const x = Number(ma[i]);
    const y = Number(mb[i]);
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/**
 * Lit la version installée sur le poste.
 * Rend { etat, version, chemin, raison } où `etat` vaut :
 *   INSTALLEE  — le marqueur est là et porte un semver
 *   ABSENTE    — aucune installation poste ; `version` est null, JAMAIS un numéro
 *   ILLISIBLE  — le marqueur existe mais ne porte pas de version exploitable
 */
export function lireVersionPoste(toolsDir) {
  const chemin = join(toolsDir, MARQUEUR_POSTE);
  let brut;
  try {
    brut = readFileSync(chemin, 'utf8');
  } catch {
    return { etat: 'ABSENTE', version: null, chemin, raison: 'aucun marqueur de version sur ce poste' };
  }
  let data;
  try {
    data = JSON.parse(brut);
  } catch {
    return { etat: 'ILLISIBLE', version: null, chemin, raison: 'le marqueur n’est pas du JSON' };
  }
  const v = data && typeof data.version === 'string' ? data.version : null;
  if (!v || !SEMVER.test(v)) {
    return { etat: 'ILLISIBLE', version: null, chemin, raison: 'le marqueur ne porte pas de version exploitable' };
  }
  return { etat: 'INSTALLEE', version: v, chemin, raison: null, marqueur: data };
}

/**
 * L'écart entre l'installé et le publié.
 * ⚠️ Toute inconnue rend INDETERMINE — jamais A-JOUR. « Je n'ai pas pu
 * regarder » et « tout va bien » ne doivent pas se ressembler.
 */
export function ecartVersions(installee, publiee) {
  const c = comparerVersions(installee, publiee);
  if (c === null) return 'INDETERMINE';
  if (c === 0) return 'A-JOUR';
  return c < 0 ? 'EN-RETARD' : 'EN-AVANCE';
}

/** Âge en secondes d'un horodatage epoch, ou null si absent/absurde. */
export function ageSecondes(epoch, maintenant) {
  const t = Number(epoch);
  if (!Number.isFinite(t) || t <= 0) return null;
  const age = Math.floor(Number(maintenant) / 1000) - Math.floor(t);
  return age >= 0 ? age : null;
}

/** Un âge en secondes, dit en clair. */
export function direAge(secondes) {
  if (secondes === null || secondes === undefined) return 'âge inconnu';
  if (secondes < 60) return `${secondes} s`;
  if (secondes < 3600) return `${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `${Math.floor(secondes / 3600)} h`;
  return `${Math.floor(secondes / 86400)} j`;
}

/**
 * Le cache du « dernier publié », AVEC SON ÂGE.
 * Rend { etat, version, ageSecondes } — `etat` vaut CACHE ou ABSENT.
 * Le champ `ageSecondes` n'est jamais tu : c'est lui qui empêche une valeur
 * d'hier de se faire passer pour la valeur du jour.
 */
export function lireCachePublie(cheminCache, maintenant) {
  let data;
  try {
    data = JSON.parse(readFileSync(cheminCache, 'utf8'));
  } catch {
    return { etat: 'ABSENT', version: null, ageSecondes: null };
  }
  const v = data && typeof data.latest === 'string' && SEMVER.test(data.latest) ? data.latest : null;
  if (!v) return { etat: 'ABSENT', version: null, ageSecondes: null };
  return { etat: 'CACHE', version: v, ageSecondes: ageSecondes(data.checkedAt, maintenant) };
}

/**
 * Les verrous de mise à jour PÉRIMÉS du poste.
 * Un verrou orphelin est une mise à jour qui refusera de partir un jour sans
 * dire pourquoi. Mesuré : 2 le 2026-08-15, 4 le 2026-08-20, 4 le 2026-09-20 —
 * ils s'accumulent, et rien ne les ramassait.
 */
export function verrousPerimes(toolsDir, ttlSecondes, maintenant) {
  let noms;
  try {
    noms = readdirSync(toolsDir);
  } catch {
    return [];
  }
  const out = [];
  for (const nom of noms) {
    if (!/^pack-update-.*\.lock$/.test(nom)) continue;
    const chemin = join(toolsDir, nom);
    let mtime;
    try {
      mtime = statSync(chemin).mtimeMs;
    } catch {
      continue;
    }
    const age = Math.floor((Number(maintenant) - mtime) / 1000);
    if (age >= Number(ttlSecondes)) out.push({ nom, chemin, ageSecondes: age });
  }
  return out.sort((a, b) => b.ageSecondes - a.ageSecondes);
}

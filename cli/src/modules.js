// modules.js — résolution du payload du pack et de ses modules (depuis pack.json).
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // cli/src
const PKG_DIR = resolve(HERE, '..'); // cli/

/**
 * Résout la racine du payload (dossier contenant pack.json + les modules).
 * Priorité :
 *   1. opts.source explicite (tests, cas spéciaux)
 *   2. env SOMTECH_PACK_PAYLOAD
 *   3. <package>/payload  (forme bundlée — E-20260623-0019)
 *   4. <package>/..       (dev : le CLI vit dans cli/ à la racine du repo)
 * Lève si aucun pack.json n'est trouvé.
 */
export function resolvePayloadRoot(opts = {}) {
  const candidates = [
    opts.source,
    process.env.SOMTECH_PACK_PAYLOAD,
    join(PKG_DIR, 'payload'),
    resolve(PKG_DIR, '..'),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (existsSync(join(dir, 'pack.json'))) return resolve(dir);
  }
  throw new Error(
    `Payload du pack introuvable (aucun pack.json). Cherché dans : ${candidates.join(', ')}`
  );
}

/** Lit et parse le manifeste pack.json du payload. */
export function readManifest(payloadRoot) {
  const file = join(payloadRoot, 'pack.json');
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`pack.json illisible : ${file}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    throw new Error(`pack.json invalide (${file}) : ${e.message}`);
  }
  if (!manifest || typeof manifest.modules !== 'object') {
    throw new Error(`pack.json sans bloc "modules" : ${file}`);
  }
  return manifest;
}

/** Liste des modules par défaut (default: true). */
export function defaultModules(manifest) {
  return Object.entries(manifest.modules)
    .filter(([, m]) => m && m.default === true)
    .map(([name]) => name);
}

/** Tous les noms de modules connus. */
export function allModuleNames(manifest) {
  return Object.keys(manifest.modules);
}

/**
 * Valide une liste de noms de modules et renvoie [{ name, paths }].
 * Lève sur un module inconnu (avec la liste des modules valides).
 */
export function resolveModules(manifest, names) {
  const known = new Set(allModuleNames(manifest));
  const unknown = names.filter((n) => !known.has(n));
  if (unknown.length) {
    throw new Error(
      `Module(s) inconnu(s) : ${unknown.join(', ')}. ` +
        `Modules valides : ${allModuleNames(manifest).join(', ')}`
    );
  }
  // Un module de portée « poste » est un OUTIL : il est déclaré pour que le paquet
  // publié l'embarque, mais il s'installe une fois par machine — pas dans chaque dépôt.
  // `default: false` ne suffit pas à l'empêcher : il faut refuser la demande explicite.
  const posteOnly = names.filter((n) => manifest.modules[n]?.scope === 'poste');
  if (posteOnly.length) {
    throw new Error(
      `Module(s) réservé(s) au poste : ${posteOnly.join(', ')}. ` +
        `Ces modules ne s'installent pas dans un projet — passe par « pack setup » (une copie par machine).`
    );
  }
  return names.map((name) => ({
    name,
    paths: (manifest.modules[name].paths || []).slice(),
  }));
}

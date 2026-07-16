// userhooks.js — installation GLOBALE (machine) des hooks du pack.
// Copie le hook dans ~/.claude/hooks/ (ou ~/.somtech) et le câble idempotemment dans
// ~/.claude/settings.json (SessionStart). Couvre TOUS les projets d'un coup.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, chmodSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const HOOK_REL = '.claude/hooks/session-start-pack-version.sh';
const HOOK_NAME = 'session-start-pack-version.sh';

// Hook graphify : partage du dossier de sortie entre worktrees (D-20260716-0001).
const GRAPHIFY_HOOK_REL = 'scripts/shell/graphify-share-out.sh';
const GRAPHIFY_HOOK_NAME = 'graphify-share-out.sh';

/** Vrai si `v` est un objet JSON « plain » (ni null, ni array, ni scalaire). */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Charge et valide settings.json pour câblage de hook (anti-perte).
 * Renvoie { settings, existed } si OK, ou { error } (message) si structure refusée.
 */
function loadSettingsForWiring(settingsFile) {
  const existed = existsSync(settingsFile);
  if (!existed) return { settings: {}, existed };
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
  } catch {
    return { error: `${settingsFile} contient du JSON invalide — édition refusée (corrige-le à la main)` };
  }
  if (!isPlainObject(settings)) {
    return { error: `${settingsFile} n'est pas un objet JSON (settings) — édition refusée` };
  }
  if ('hooks' in settings && !isPlainObject(settings.hooks)) {
    return { error: `${settingsFile} : la clé "hooks" n'est pas un objet — édition refusée` };
  }
  if (isPlainObject(settings.hooks) && 'SessionStart' in settings.hooks && !Array.isArray(settings.hooks.SessionStart)) {
    return { error: `${settingsFile} : "hooks.SessionStart" n'est pas une liste — édition refusée` };
  }
  return { settings, existed };
}

/**
 * Ajoute (idempotent) un hook SessionStart `command` à l'objet settings.
 * Renvoie true si ajouté, false si déjà présent. Ne touche à rien d'autre.
 */
export function wireSessionStartCommand(settings, command) {
  settings.hooks = settings.hooks || {};
  if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = [];
  const present = settings.hooks.SessionStart.some(
    (g) => g && Array.isArray(g.hooks) && g.hooks.some((h) => h && h.command === command)
  );
  if (present) return false;
  settings.hooks.SessionStart.push({ hooks: [{ type: 'command', command }] });
  return true;
}

/**
 * Installe le hook de version en global.
 * - copie payload/.claude/hooks/session-start-pack-version.sh → <hooksDir>/
 * - câble <settingsFile> (~/.claude/settings.json) vers le chemin ABSOLU du hook
 * - backup avant écriture ; REFUSE si settingsFile contient du JSON invalide
 * Renvoie { ok, dest, wired, backup, reason? }.
 */
export function installGlobalVersionHook({ payloadRoot, hooksDir, settingsFile, dryRun = false }) {
  const src = join(payloadRoot, HOOK_REL);
  if (!existsSync(src)) return { ok: false, reason: `source du hook introuvable (${HOOK_REL})` };

  const dest = join(hooksDir, HOOK_NAME);

  // Anti-perte : valider settings.json AVANT toute copie/écriture (source unique, M2).
  const loaded = loadSettingsForWiring(settingsFile);
  if (loaded.error) return { ok: false, dest, reason: loaded.error };
  const { settings, existed: settingsExisted } = loaded;

  if (dryRun) return { ok: true, dest, settingsFile, dryRun: true };

  // 1. Copier le hook.
  mkdirSync(hooksDir, { recursive: true });
  copyFileSync(src, dest);
  try { chmodSync(dest, statSync(src).mode & 0o777); } catch { /* best-effort bit exécutable */ }

  // 2. Câblage idempotent — on ne backupe que si on modifie réellement les settings (M3).
  const wired = wireSessionStartCommand(settings, dest);
  let backup;
  if (wired) {
    if (settingsExisted) {
      backup = `${settingsFile}.somtech.bak`;
      writeFileSync(backup, readFileSync(settingsFile));
    }
    mkdirSync(dirname(settingsFile), { recursive: true });
    writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  }
  return { ok: true, dest, settingsFile, backup, wired };
}

/**
 * Installe le hook graphify « dossier de sortie partagé » en global (D-20260716-0001).
 * - copie payload/scripts/shell/graphify-share-out.sh → <destDir>/graphify-share-out.sh
 * - câble <settingsFile> (SessionStart) vers le chemin ABSOLU du script
 * À chaque session dans un repo git, le symlink graphify-out → ~/graphify/<clé> est
 * (re)posé/amorcé (idempotent, jamais fatal). Le script NE fait QUE le symlink ;
 * l'ajout du MCP graphify (scope local) vit dans claude-swt (pré-lancement).
 * Renvoie { ok, dest, wired, backup, reason? }.
 */
export function installGraphifyShareHook({ payloadRoot, destDir, settingsFile, dryRun = false }) {
  const src = join(payloadRoot, GRAPHIFY_HOOK_REL);
  if (!existsSync(src)) return { ok: false, reason: `source du hook graphify introuvable (${GRAPHIFY_HOOK_REL})` };

  const dest = join(destDir, GRAPHIFY_HOOK_NAME);

  const loaded = loadSettingsForWiring(settingsFile);
  if (loaded.error) return { ok: false, dest, reason: loaded.error };
  const { settings, existed } = loaded;

  if (dryRun) return { ok: true, dest, settingsFile, dryRun: true };

  // 1. Copier le script (dans ~/.somtech, aux côtés de claude-swt.sh).
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
  try { chmodSync(dest, statSync(src).mode & 0o777); } catch { /* best-effort bit exécutable */ }

  // 2. Câblage idempotent — backup seulement si on modifie réellement les settings (M3).
  const wired = wireSessionStartCommand(settings, dest);
  let backup;
  if (wired) {
    if (existed) {
      backup = `${settingsFile}.somtech.bak`;
      writeFileSync(backup, readFileSync(settingsFile));
    }
    mkdirSync(dirname(settingsFile), { recursive: true });
    writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  }
  return { ok: true, dest, settingsFile, backup, wired };
}

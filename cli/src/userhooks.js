// userhooks.js — installation GLOBALE (machine) du hook de version du pack.
// Copie le hook dans ~/.claude/hooks/ et le câble idempotemment dans
// ~/.claude/settings.json (SessionStart). Couvre TOUS les projets d'un coup.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, chmodSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const HOOK_REL = '.claude/hooks/session-start-pack-version.sh';
const HOOK_NAME = 'session-start-pack-version.sh';

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

  // Anti-perte : si settings.json existe mais est du JSON invalide, on refuse AVANT toute écriture.
  let settings = {};
  const settingsExisted = existsSync(settingsFile);
  if (settingsExisted) {
    try {
      settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
    } catch {
      return { ok: false, dest, reason: `${settingsFile} contient du JSON invalide — édition refusée (corrige-le à la main)` };
    }
  }

  if (dryRun) return { ok: true, dest, settingsFile, dryRun: true };

  // 1. Copier le hook.
  mkdirSync(hooksDir, { recursive: true });
  copyFileSync(src, dest);
  try { chmodSync(dest, statSync(src).mode & 0o777); } catch { /* best-effort bit exécutable */ }

  // 2. Backup + câblage idempotent.
  let backup;
  if (settingsExisted) {
    backup = `${settingsFile}.somtech.bak`;
    writeFileSync(backup, readFileSync(settingsFile));
  }
  const wired = wireSessionStartCommand(settings, dest);
  if (wired) {
    mkdirSync(dirname(settingsFile), { recursive: true });
    writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  }
  return { ok: true, dest, settingsFile, backup, wired };
}

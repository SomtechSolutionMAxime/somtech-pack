// archi.js — sous-commandes du modèle vivant (STD-031 §2.7, D-20260715-0004).
//
// Le pack distribue une boîte à outils Python (scripts/archi-ci/) que la CI de
// n'importe quel repo applicatif appelle via `npx @somtech-solutions/pack <cmd>`.
// Ces wrappers résolvent le script bundlé dans le payload et l'exécutent en
// forwardant argv + code de sortie (essentiel : diff-manifest exit 1 = gate strict).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePayloadRoot } from '../modules.js';

// Sous-commande CLI → script Python (dans scripts/archi-ci/ du payload).
const SCRIPTS = {
  'harvest-supabase': 'harvest-supabase.py',
  'harvest-routes': 'harvest-routes.py',
  'harvest-config': 'harvest-config.py',
  'merge-manifests': 'merge-manifests.py',
  'validate-manifest': 'validate-manifest.py',
  'diff-manifest': 'diff-manifest.py',
  'generate-erd': 'generate-erd.py',
};

/** True si `cmd` est une sous-commande du modèle vivant. */
export function isArchiCommand(cmd) {
  return Object.prototype.hasOwnProperty.call(SCRIPTS, cmd);
}

/** Liste (triée) des sous-commandes archi — pour l'aide. */
export function archiCommands() {
  return Object.keys(SCRIPTS).sort();
}

/**
 * Exécute le script Python correspondant à `command`, en lui passant `rawArgs`
 * verbatim. Renvoie le code de sortie du script (pour propager le gate strict).
 */
export function cmdArchi(command, rawArgs, opts = {}) {
  let payloadRoot;
  try {
    payloadRoot = resolvePayloadRoot({ source: opts.source });
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }
  const script = join(payloadRoot, 'scripts', 'archi-ci', SCRIPTS[command]);
  if (!existsSync(script)) {
    console.error(`✗ Script du modèle vivant introuvable : ${script}\n`
      + '  (le module « core » du pack doit être présent dans le payload).');
    return 1;
  }
  const python = process.env.SOMTECH_PYTHON || 'python3';
  try {
    execFileSync(python, [script, ...rawArgs], { stdio: 'inherit' });
    return 0;
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error(`✗ Interpréteur Python introuvable (${python}). `
        + 'Installer Python 3 ou définir SOMTECH_PYTHON.');
      return 127;
    }
    // execFileSync lève sur exit ≠ 0 : on propage le vrai code (gate strict → 1).
    return typeof e.status === 'number' ? e.status : 1;
  }
}

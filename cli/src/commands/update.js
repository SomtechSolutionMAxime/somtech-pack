// update.js — met à jour le projet : convergence par défaut (les fichiers du pack
// reprennent la version du pack, dérive locale sauvegardée en .somtech.bak). La
// détection de drift sans écrire se fait via --dry-run (exit 2 si dérive).
import { runApply } from './shared.js';

export async function cmdUpdate(flags) {
  const { code } = await runApply(flags, { mode: 'update' });
  return code;
}

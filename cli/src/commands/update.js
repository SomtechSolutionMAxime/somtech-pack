// update.js — met à jour le projet (présente un diff, n'écrase pas sans --force).
import { runApply } from './shared.js';

export async function cmdUpdate(flags) {
  const { code } = await runApply(flags, { mode: 'update' });
  return code;
}

// init.js — installe le pack dans le projet courant.
import { runApply } from './shared.js';

export async function cmdInit(flags) {
  const { code } = await runApply(flags, { mode: 'init' });
  return code;
}

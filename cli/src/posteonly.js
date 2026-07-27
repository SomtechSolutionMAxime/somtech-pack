// posteonly.js — installation au poste des modules de portée « poste ».
//
// Un module de portée poste est un OUTIL : une copie par machine suffit, et un dépôt
// client n'a pas à le porter (cf. `resolveModules`, qui refuse de l'installer dans un
// projet). Il est néanmoins déclaré dans pack.json, sans quoi la construction du paquet
// ne l'embarquerait pas — le paquet publié le transporte donc, et c'est ici qu'il est
// déposé sur la machine.
//
// Le canvas est le premier de cette famille : la commande `/canvas` cherche son serveur
// dans `~/.somtech/herdr-plugins/excalidraw`, aux côtés des autres outils de poste du
// pack (claude-swt et ses bibliothèques). La
// commande voyageait vers tous les projets et ne trouvait son serveur nulle part.
//
// Garanties (identiques aux autres miroirs) :
// - ne touche QUE ce que le pack apporte ; un plugin perso hors-pack n'est jamais dans
//   le payload, donc jamais écrit ni supprimé (le moteur ne supprime rien) ;
// - un fichier du pack modifié à la main CONVERGE vers la version du pack, avec
//   sauvegarde `.somtech.bak` avant écrasement ;
// - un fichier symlinké (dev qui pointe vers le dépôt source) n'est jamais écrit à travers.
//
// Décision : docs/superpowers/specs/2026-07-24-distribution-canvas-decision.md
import { readManifest } from './modules.js';
import { collectFiles, applyFiles } from './engine.js';
import { isPayloadResidue } from './payload-filter.js';

/** Modules du manifeste dont la portée est « poste ». */
function posteModules(manifest) {
  return Object.entries(manifest.modules || {})
    .filter(([, m]) => m && m.scope === 'poste')
    .map(([name, m]) => ({ name, paths: (m.paths || []).slice() }));
}

/**
 * Installe les modules de portée poste dans `toolsDir` (def: ~/.somtech, où vivent déjà
 * les autres outils de poste du pack).
 * Renvoie le rapport applyFiles (avec `backedUp`) + la liste des modules installés.
 */
export function installPosteModules({ payloadRoot, toolsDir, dryRun = false, force = false }) {
  const empty = { created: [], unchanged: [], updated: [], conflicts: [], rejected: [], preserved: [], backedUp: [], modules: [] };

  const mods = posteModules(readManifest(payloadRoot));
  if (!mods.length) return empty;

  const paths = mods.flatMap((m) => m.paths);
  if (!paths.length) return empty;

  const { files, links, rejected } = collectFiles(payloadRoot, paths);
  // Même filtre qu'à la fabrication du paquet : installer depuis le dépôt (cas du
  // développeur) doit donner exactement ce qu'on obtient depuis le paquet publié —
  // sinon on copie les 273 Mo de dépendances de construction de la page dans ~/.claude.
  const kept = files.filter((rel) => !isPayloadResidue(rel));
  const report = applyFiles({ payloadRoot, target: toolsDir, files: kept, force, dryRun, backup: true });

  return {
    ...report,
    modules: mods.map((m) => m.name).sort(),
    payloadLinks: links,
    payloadRejected: rejected,
  };
}

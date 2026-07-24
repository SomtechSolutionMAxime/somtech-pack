// payload-filter.js — ce qui n'entre pas dans le paquet publié.
//
// Le paquet embarque le contenu des modules déclarés dans pack.json, récolté depuis
// les sources du dépôt (RA-DIS-002). Certains fichiers présents dans l'arborescence
// de travail ne doivent pourtant jamais voyager : les dépendances de CONSTRUCTION
// (utiles pour produire un artefact, inutiles ensuite) et l'ÉTAT D'EXÉCUTION laissé
// par un outil qui a tourné (ports, journaux, sauvegardes).
//
// La distinction qui compte, et qui n'est pas évidente : les dépendances d'EXÉCUTION
// du serveur du canvas (`chokidar`, `ws` — ~0,1 Mo compressés) doivent voyager, sinon
// le canvas ne démarre pas chez celui qui installe ; celles de construction de sa page
// (273 Mo) ne le doivent pas, la page étant déjà construite dans le paquet.
//
// Décision : docs/superpowers/specs/2026-07-24-distribution-canvas-decision.md (T-20260724-0018)

/** Racine des plugins d'outil livrés par le pack. */
const PLUGIN_ROOT = 'herdr-plugins';

/**
 * Le chemin (relatif à la racine du dépôt) est-il un résidu à ne pas publier ?
 *
 * Accepte les séparateurs des deux plateformes. Un chemin situé SOUS un résidu
 * en est un aussi : filtrer le dossier ne suffit pas quand la copie descend fichier
 * par fichier.
 *
 * @param {string} relPath chemin relatif à la racine du dépôt
 * @returns {boolean}
 */
export function isPayloadResidue(relPath) {
  const parts = String(relPath).replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0) return false;

  const isPlugin = parts[0] === PLUGIN_ROOT;

  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];

    // État d'exécution d'un canvas : port, journal, scène de travail.
    if (seg === '.herdr') return true;

    if (seg === '.DS_Store') return true;

    // Dépendances installées. Celles du serveur d'un plugin voyagent (il en a besoin
    // pour démarrer) ; toutes les autres — au premier chef celles de la construction
    // de la page web — restent au dépôt.
    if (seg === 'node_modules') {
      const isPluginRuntimeDeps = isPlugin && i === 2;
      if (!isPluginRuntimeDeps) return true;
    }

    if (isPlugin) {
      // Sources de la page et outillage de construction : la page construite les remplace.
      if (i === 2 && parts[1] && seg === 'web' && (parts[3] === 'src' || parts[3] === 'vite.config.js')) {
        return true;
      }
      // Tests du plugin : la chaîne d'intégration les exécute depuis le dépôt.
      if (i === 2 && seg === 'tests') return true;
    }
  }

  // Copies de secours laissées par une mise à jour du pack.
  const last = parts[parts.length - 1];
  if (last.endsWith('.bak') || last.includes('.somtech.bak')) return true;

  return false;
}

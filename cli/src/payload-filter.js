// payload-filter.js — ce qui n'entre pas dans le paquet publié.
//
// Le paquet embarque le contenu des modules déclarés dans pack.json, récolté depuis
// les sources du dépôt (RA-DIS-002). Certains fichiers présents dans l'arborescence
// de travail ne doivent pourtant jamais voyager : les dépendances de CONSTRUCTION
// (utiles pour produire un artefact, inutiles ensuite) et l'ÉTAT D'EXÉCUTION laissé
// par un outil qui a tourné (ports, journaux, sauvegardes).
//
// Deux distinctions comptent, et aucune n'est évidente :
//
//   1. Les dépendances d'EXÉCUTION du serveur du canvas (`chokidar`, `ws` — ~0,1 Mo
//      compressés) doivent voyager, sinon le canvas ne démarre pas chez celui qui
//      installe ; celles de CONSTRUCTION de sa page (273 Mo) ne le doivent pas, la
//      page étant déjà construite dans le paquet.
//
//   2. Un fichier d'ignore (`.gitignore`, `.npmignore`) qui arrive jusque dans le
//      payload est un piège : npm applique les fichiers d'ignore IMBRIQUÉS au moment
//      de fabriquer le tarball. Celui du plugin retirerait du paquet publié la page
//      construite et les dépendances du serveur — exactement ce que le paquet existe
//      pour livrer — sans qu'aucun test, ni la CI, ni la publication ne s'en aperçoive.
//
// Décision : docs/superpowers/specs/2026-07-24-distribution-canvas-decision.md (T-20260724-0018)

/** Racine des plugins d'outil livrés par le pack. */
const PLUGIN_ROOT = 'herdr-plugins';

/** Sous le dossier `web` d'un plugin, seul ceci voyage — le reste est de la construction. */
const WEB_KEEP = new Set(['dist', 'package.json', 'package-lock.json']);

/**
 * Le chemin (relatif à la racine du dépôt) est-il un résidu à ne pas publier ?
 *
 * Accepte les séparateurs des deux plateformes. Un chemin situé SOUS un résidu en est
 * un aussi : filtrer le dossier ne suffit pas quand la copie descend fichier par fichier.
 *
 * @param {string} relPath chemin relatif à la racine du dépôt
 * @returns {boolean}
 */
export function isPayloadResidue(relPath) {
  const parts = String(relPath).replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0) return false;

  const name = parts[parts.length - 1];

  // Un fichier d'ignore embarqué ampute le paquet au packing (cf. note 2 en tête).
  if (name === '.gitignore' || name === '.npmignore') return true;
  if (name === '.DS_Store') return true;
  // Copies de secours laissées par une mise à jour du pack ou par un éditeur. L'engine
  // numérote les siennes quand le nom de base est déjà pris (`.somtech.bak`, `.bak.1`, …),
  // d'où le test sur l'infixe et pas seulement sur le suffixe.
  if (name.endsWith('.bak') || name.includes('.somtech.bak')) return true;

  // État d'exécution d'un canvas : port, journal, scène de travail.
  if (parts.includes('.herdr')) return true;

  if (parts[0] === PLUGIN_ROOT && parts.length > 2) {
    // Dépendances d'exécution du serveur du plugin : elles voyagent, y compris les
    // arbres imbriqués que npm crée en cas de conflit de version.
    if (parts[2] === 'node_modules') return false;

    // Tests du plugin : la chaîne d'intégration les exécute depuis le dépôt.
    if (parts[2] === 'tests') return true;

    // Page web : liste blanche. Ce qui sert à CONSTRUIRE la page ne voyage pas, et un
    // fichier ajouté demain sous `web/` ne part pas par défaut dans un paquet distribué
    // à toute l'entreprise — un `.env` local, par exemple.
    if (parts[2] === 'web') return parts.length > 3 && !WEB_KEEP.has(parts[3]);
  }

  // Toute autre arborescence de dépendances installées reste au dépôt.
  if (parts.includes('node_modules')) return true;

  return false;
}

// lieu-nom.js — LA SEULE RÈGLE qui dit quel dossier porte le lieu d'un agent nommé.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE (T-20260814-0101)
//
// Deux gestes portent le nom d'un agent, et ils ne s'accordaient pas :
//
//   • la POSE (`ligne-directe/src/lieu-agent.js`) écrivait `join(depot, dossier, nom)` — le
//     nom BRUT, tel qu'il avait été tapé, sans aucune garde ;
//   • la MISE À JOUR (`cli/src/commands/representant.js`) exigeait un slug EN MINUSCULES et
//     refusait tout le reste.
//
// Quatre lieux réels sur cinq portent une majuscule (`Charles-Olivier`, `Francois`, `Jacob`,
// `Zach` ; seul `maxime` est en minuscules). Aucun n'était atteignable par la mise à jour.
// macOS l'a masqué pendant tout ce temps : son système de fichiers ignore la casse, donc la
// mise à jour visait `francois`, atteignait `Francois`, et PARAISSAIT marcher. Sur un volume
// sensible à la casse — la CI Linux, un poste Linux, une image APFS sensible à la casse —
// elle aurait créé un SECOND lieu, vide et muet, pendant que le vrai restait périmé.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CE QUI A ÉTÉ TRANCHÉ, ET POURQUOI
//
//   1. LE NOM BRUT FAIT FOI. La casse tapée est PORTÉE, jamais imposée. Normaliser à la pose
//      aurait aligné sur la règle la plus stricte — au prix des quatre lieux déjà posés, qu'il
//      aurait fallu renommer chez quatre clients, avec les gestionnaires qui tournent dessus.
//      On ne casse pas ce qui existe pour faire plaisir à une regex.
//   2. LA GARDE ANTI-ÉVASION NE SE DESSERRE PAS. Elle passe de « minuscules obligatoires » à
//      « un seul segment de chemin sûr » : la liste blanche reste une liste blanche, on n'y
//      ajoute que `A-Z` et `_` — dont aucun n'est un métacaractère de chemin, sur aucune
//      plateforme, et que herdr accepte déjà pour nommer un agent (voir `NOM_DE_LIEU`). Aucun
//      `/`, aucun `\`, aucun `.` en tête (donc ni `.`, ni `..`), aucun NUL, jamais vide.
//      Et elle passe désormais des DEUX côtés : la pose n'en avait AUCUNE — `../../evil`
//      y écrivait hors du dépôt.
//   3. LA RÉSOLUTION EST INSENSIBLE À LA CASSE. Un lieu déjà posé dont seule la casse diffère
//      est RETROUVÉ, sur tout système de fichiers. C'est ce qui rend le comportement identique
//      sur macOS et sur Linux, au lieu de dépendre de ce que le noyau veut bien pardonner.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ CE FICHIER EXISTE EN DEUX EXEMPLAIRES, OCTET POUR OCTET IDENTIQUES :
//
//     ligne-directe/src/lieu-nom.js   ← la source
//     cli/src/lieu-nom.js             ← la copie
//
// CE N'EST PAS UN OUBLI, et ce n'est pas non plus « une porte sur deux » : c'est UN SEUL
// TEXTE, verrouillé. `cli/test/lieu-nom-miroir.test.js` compare les deux octet pour octet et
// rougit à la première divergence ; `node cli/scripts/sync-lieu-nom.mjs` refait la copie.
//
// La duplication est imposée par la DISTRIBUTION, pas choisie : le CLI est publié en paquet
// npm depuis `cli/` seul et ne peut pas importer `ligne-directe/` (module de POSTE, installé
// dans `~/.somtech`, absent du paquet hors payload — et le payload est du CONTENU distribué,
// pas une bibliothèque dont on charge du code). L'inverse ne marche pas davantage : sur le
// poste, `~/.somtech/ligne-directe/` vit sans le CLI. Le même arbitrage, aux mêmes motifs, a
// déjà été rendu pour la table `ROLES` de `cli/src/commands/representant.js`.
//
// Aucune dépendance au-delà de `node:fs` et `node:path` : c'est ce qui rend la copie possible,
// et c'est à garder — un import vers `roles.js` casserait le miroir côté CLI.
// ─────────────────────────────────────────────────────────────────────────────────────────

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Un nom de lieu : UN SEUL SEGMENT DE CHEMIN SÛR.
 *
 * Liste blanche, jamais liste noire — une liste noire oublie toujours un séparateur, un
 * encodage ou une plateforme. Commence par une lettre ou un chiffre : `.`, `..`, `.hidden` et
 * `-drapeau` sont donc refusés par la première classe, avant même le reste.
 *
 * LE JEU DE CARACTÈRES EST CELUI DE HERDR, ET CE N'EST PAS UNE COMMODITÉ. Un agent porte
 * `[a-z][a-z0-9_-]{0,31}` chez herdr (`naissance-representant/src/naissance.js`), soulignés
 * compris. Une garde du LIEU plus étroite que celle du NOM rendrait un agent parfaitement
 * nommable impossible à loger — et, pire, rendrait inatteignable un lieu déjà posé sous un
 * nom à souligné, la pose n'ayant eu AUCUNE garde jusqu'ici. Deux règles qui ne s'accordent
 * pas : c'est le défaut que ce fichier existe pour fermer, on ne le réintroduit pas d'un cran
 * plus bas. Ce que le lieu ajoute à herdr — les majuscules — ne s'y oppose pas : la naissance
 * abaisse la casse pour nommer l'agent, et c'est déjà ce qu'elle faisait.
 */
export const NOM_DE_LIEU = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** Le nom est-il un segment de chemin sûr ? La casse n'entre PAS dans ce jugement. */
export function nomDeLieuValide(nom) {
  return typeof nom === 'string' && NOM_DE_LIEU.test(nom);
}

/**
 * LA RÈGLE, DITE EN FRANÇAIS — un seul texte, comme la règle elle-même.
 *
 * ⚠️ RELEVÉ EN REVUE (passe 2), ET LA LEÇON VAUT AU-DELÀ D'ICI. Le correctif avait laissé
 * `--help` et le README du CLI prescrire des « minuscules » pendant que le code acceptait la
 * casse libre : l'opérateur lisait l'inverse de ce que la commande faisait. La garde posée en
 * réponse cherchait des TOURNURES INTERDITES — une liste noire. La revue l'a défaite en une
 * mutation : réécrire « bas de casse uniquement » ou « lowercase only » passait à travers.
 *
 * On ne garde donc plus l'accord entre deux textes : IL N'Y EN A PLUS QU'UN. L'aide du CLI et
 * le refus le CITENT tous deux — un texte qu'on n'écrit pas ne peut pas contredire le code —,
 * et un test exige de le retrouver, littéralement, là où l'opérateur lit. Changer la règle,
 * c'est changer cette constante ; tout ce qui la cite suit sans qu'on y pense.
 */
export const REGLE_NOM_DE_LIEU =
  'un seul segment de chemin (lettres, chiffres, tirets, soulignés ; commençant par une ' +
  'lettre ou un chiffre). La casse est libre et portée telle quelle — « Francois » et ' +
  '« francois » désignent le même lieu — mais un nom qui traverse un répertoire ' +
  '(« / », « \\ », « .. ») écrirait hors du dépôt : c\'est refusé.';

/**
 * Le refus d'un nom, dit d'une seule façon pour les deux gestes.
 *
 * @param {string} nom       ce qui a été reçu
 * @param {string} designe   comment l'appelant nomme ce paramètre (« --client », « <nom> »…)
 */
export function messageNomInvalide(nom, designe = 'nom') {
  return `${designe} : ${REGLE_NOM_DE_LIEU} Reçu « ${String(nom ?? '')} ».`;
}

/** Levée quand un nom franchit la garde par une porte qui aurait dû le valider avant. */
export class NomDeLieuInvalide extends Error {
  constructor(nom, designe = 'nom') {
    super(messageNomInvalide(nom, designe));
    this.name = 'NomDeLieuInvalide';
    this.nom = nom;
  }
}

/**
 * Où vit le lieu de `nom`, sous `depot/dossier` — en préférant TOUJOURS un lieu déjà posé
 * dont seule la casse diffère.
 *
 * C'EST LE POINT UNIQUE. La pose, la naissance et la mise à jour passent toutes par ici ; nul
 * ne recompose `join(depot, dossier, nom)` de son côté.
 *
 * La validation est faite ICI, et pas seulement chez les appelants : une garde qu'on ne peut
 * pas contourner vaut mieux que trois gardes dont chacune se rappelle d'appeler. Un nom
 * invalide LÈVE — jamais un chemin de repli, qui serait un chemin d'évasion.
 *
 * @param {string} depot    racine du dépôt
 * @param {string} dossier  dossier de rôle (« .gestionnaire », « .orchestrateur »)
 * @param {string} nom      nom de l'agent, tel qu'il a été tapé
 * @param {string} designe  comment l'appelant nomme ce paramètre, pour le message de refus
 * @returns {{racine: string, parent: string, nom: string, demande: string, exact: boolean,
 *           existe: boolean, ambigu: boolean, homonymes: string[]}}
 */
export function resoudreLieu(depot, dossier, nom, designe = 'nom') {
  if (!nomDeLieuValide(nom)) throw new NomDeLieuInvalide(nom, designe);

  const parent = join(depot, dossier);
  const cible = nom.toLowerCase();

  // Un dossier de rôle absent n'est pas une anomalie : c'est le cas du tout premier lieu.
  // On ne distingue donc pas « absent » de « illisible » — dans les deux cas, rien à retrouver.
  //
  // SEULS LES RÉPERTOIRES SONT CANDIDATS, et `isDirectory()` ne suit pas les liens : un lieu
  // qui serait un lien symbolique n'est donc pas retrouvé PAR SA CASSE. Ce n'est pas une
  // régression — le chemin composé reste alors celui qu'on a demandé, exactement comme avant
  // ce lot, et l'appelant décide sur son propre `existsSync`, qui suit les liens, lui. Ce qui
  // se perd est borné à un cas qui n'existe pas ici : un lieu lié ET nommé dans une autre
  // casse. On préfère ça à une résolution de casse qui traverserait un lien vers l'extérieur.
  let entrees = [];
  try {
    entrees = readdirSync(parent, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    entrees = [];
  }

  // `toLowerCase` et non `toLocaleLowerCase` : la seconde dépend de la locale du poste (le
  // « i » turc en est l'exemple connu), et la même commande rendrait deux chemins différents
  // selon la machine. La liste blanche étant ASCII, le repli non-localisé est exact.
  const homonymes = entrees.filter((e) => e.toLowerCase() === cible).sort();
  const exact = homonymes.includes(nom);

  // AMBIGUÏTÉ — deux lieux qui ne diffèrent que par la casse, aucun ne portant le nom demandé.
  // Impossible sur macOS, banal sur un volume sensible à la casse une fois que le défaut de ce
  // ticket a produit son doublon. On ne DEVINE pas lequel est le bon : `ambigu` remonte, et
  // l'appelant refuse. Choisir au hasard, ce serait mettre à jour un lieu mort en laissant le
  // vivant périmé — exactement le mode de panne qu'on ferme ici.
  const ambigu = !exact && homonymes.length > 1;
  const surDisque = exact ? nom : homonymes.length === 1 ? homonymes[0] : nom;

  return {
    racine: join(parent, surDisque),
    parent,
    nom: surDisque,
    demande: nom,
    exact,
    existe: homonymes.length > 0 && !ambigu,
    ambigu,
    homonymes,
  };
}

/** Le refus servi quand deux lieux ne diffèrent que par la casse — dit d'une seule façon. */
export function messageLieuAmbigu(nom, parent, homonymes) {
  return (
    `« ${nom} » désigne plusieurs lieux sous « ${parent} » : ${homonymes.join(', ')}. ` +
    `Ils ne diffèrent que par la casse, et rien ici ne peut dire lequel est le bon — en ` +
    `choisir un reviendrait à mettre à jour un lieu mort en laissant l'autre périmé. ` +
    `Écarte celui qui ne sert plus (« mv … ….ecarte »), puis relance.`
  );
}

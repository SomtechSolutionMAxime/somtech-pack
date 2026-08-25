// ecriture.js — la garde qui déplace la frontière de l'écriture (T-20260824-0002).
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QU'ELLE REMPLACE, ET POURQUOI IL A FALLU LA CONSTRUIRE
//
// Le refus d'un orchestrateur portait sur l'OUTIL NU — `permissions.deny` listait
// `Write`, `Edit`, `NotebookEdit`. Un outil nu refuse partout, quel que soit le
// chemin : c'est ce qui rendait `CONTEXTE.md` inaccessible à celui-là même qui
// l'apprend. Le seul qui sait ne pouvait pas écrire.
//
// Trois voies ont été mesurées sur Claude Code 2.1.241, le 2026-08-24, sur un
// lieu réel hors dépôt. Les deux premières sont FERMÉES :
//
//   ① `allow` ne perce pas `deny`. Un `--allowedTools Write` s'est fait refuser
//      par un `deny` à motif : « File is in a directory that is denied by your
//      permission settings ».
//   ② un HOOK ne perce pas `deny` non plus — et c'est le fait décisif : quand le
//      chemin tombe sous un `deny`, le hook N'EST JAMAIS APPELÉ. Mesuré par une
//      trace : zéro ligne. La décision de permission précède les hooks.
//
// Reste la troisième, et elle marche : ne plus refuser l'outil, et confier TOUT
// le refus à cette garde. Mesuré aussi : `CONTEXTE.md` écrit, `CLAUDE.md` refusé
// dans la même session, et un `allow` de hook suffit sans qu'aucun droit ne soit
// accordé — l'orchestrateur n'a donc pas besoin de `Write` dans ses droits.
//
// ⚠️ CONSÉQUENCE SUR LA POLARITÉ. La garde terminal peut rendre `allow` pour un
// rôle qu'elle ne garde pas : là, `allow` laisse les choses en l'état. ICI, un
// `allow` OUVRE l'écriture en grand, puisque plus rien d'autre ne la refuse.
// Cette garde ne rend donc JAMAIS `allow` par défaut : hors du seul cas qu'elle
// reconnaît, elle refuse.
//
// ⚠️ Ce module est PUR : il ne lit rien, n'écrit rien, ne touche pas au disque.
// C'est ce qui le rend testable, et c'est le patron de STD-047 R3bis — fil mince
// dans `settings.json`, décision pure dans un module, refus par défaut.
//
// LIMITE CONNUE, ÉCRITE PLUTÔT QU'ESPÉRÉE : la comparaison porte sur des chemins
// normalisés, pas sur des liens résolus. Un `CONTEXTE.md` qui serait un lien
// symbolique vers un livrable écrirait dans ce livrable. Le lieu est versionné,
// un tel lien s'y verrait ; mais la garde, elle, ne le voit pas.

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 CONTRAINTE SUR LES ÉVOLUTIONS FUTURES — À LIRE AVANT D'AJOUTER QUOI QUE CE SOIT
//
// Un mode de panne de cette garde N'EST PAS BORNABLE : une BOUCLE de calcul. Node
// est mono-thread, donc le minuteur que le fil s'impose ne peut pas se déclencher
// pendant qu'un `while` tourne — et une garde qui pend laisse le geste PASSER
// (mesuré le 2026-08-24 sur la vraie chaîne : `CLAUDE.md` a été écrit).
//
// **Conséquence de conception, et c'est une contrainte, pas une préférence : cette
// décision doit rester LA PLUS SIMPLE POSSIBLE.** Toute logique qu'on lui ajoutera
// augmente un risque qu'on ne sait pas mesurer. Celui qui l'enrichit dans six mois
// achète ce risque — il doit le savoir avant, pas le découvrir après.
//
// Deux contrôles la tiennent mécaniquement, dans `metier-garde-ecriture.test.js` :
// aucune construction bouclante, et un plafond de taille épinglé. Ils rougissent
// à l'ajout. **Ce ne sont pas des chiffres à réaligner : ce sont des questions à
// se poser.** Si l'ajout est vraiment nécessaire, il faut dire ce qu'il coûte.
// ─────────────────────────────────────────────────────────────────────────────

import { isAbsolute, normalize, resolve, dirname, basename } from 'node:path';

/** Le seul fichier qu'un agent gardé écrit dans son lieu : sa propre mémoire. */
export const FICHIER_PERMIS = 'CONTEXTE.md';

/** Les rôles à qui cette garde s'applique. Elle ne décide pas pour les autres. */
export const ROLES_GARDES = new Set(['orchestrateur']);

/** Les outils d'édition de fichier que cette garde sait juger. */
export const OUTILS_ECRITURE = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit']);

/**
 * Les outils par lesquels le fichier permis peut être tenu.
 *
 * `NotebookEdit` n'en est pas : il vise un carnet `.ipynb`, jamais un `.md`.
 * L'y admettre élargirait l'exception sans qu'aucun usage ne le demande.
 */
const OUTILS_DU_FICHIER_PERMIS = new Set(['Write', 'Edit', 'MultiEdit']);

const deny = (raison) => ({ decision: 'deny', raison });
const allow = (raison) => ({ decision: 'allow', raison });

/** Le geste appartient à quelqu'un d'autre — la phrase que le métier fait sienne. */
const PAS_A_TOI =
  "Écrire un livrable ne t'appartient pas : tu orchestres, tu n'exécutes pas. Le seul fichier "
  + `que tu tiens toi-même est « ${FICHIER_PERMIS} » à la racine de ton lieu — ta propre mémoire. `
  + "La question n'est pas « puis-je ? » mais « pourquoi est-ce tombé chez moi ? ».";

/**
 * Juge une écriture de fichier.
 *
 * @param {{outil?:string, chemin?:string, lieu?:string, role?:string}} req
 *   `lieu` est le répertoire de l'agent — le cwd de sa session, celui qui porte
 *   son `CLAUDE.md` et son `CONTEXTE.md`.
 * @returns {{decision:'allow'|'deny', raison:string}}
 */
export function juger(req = {}) {
  const { outil, chemin, lieu, role = 'orchestrateur' } = req;

  // ⚠️ Un rôle inconnu ne rend PAS `allow` ici — voir la note de polarité en tête.
  if (!ROLES_GARDES.has(role)) {
    return deny(
      `Cette garde ne connaît pas le rôle « ${role} », et elle ne sait donc pas ce qu'il a le `
      + "droit d'écrire. Elle refuse plutôt que de le supposer : depuis qu'elle porte le refus "
      + "à elle seule, un « oui » par défaut ouvrirait l'écriture en grand.",
    );
  }

  if (typeof outil !== 'string' || !OUTILS_ECRITURE.has(outil)) {
    return deny(
      "La garde n'a pas reconnu l'outil d'écriture qu'on lui demande de juger "
      + `(« ${outil ?? 'aucun'} »). Elle refuse plutôt que de laisser passer ce qu'elle n'a pas vu.`,
    );
  }

  if (typeof lieu !== 'string' || lieu.trim() === '' || !isAbsolute(lieu)) {
    return deny(
      "La garde ne sait pas où est ton lieu, donc elle ne peut pas dire si ce fichier en fait "
      + "partie. Elle refuse plutôt que de le supposer.",
    );
  }

  if (typeof chemin !== 'string' || chemin.trim() === '') {
    return deny(
      "La garde n'a reçu aucun chemin à juger. Elle refuse plutôt que de laisser passer ce "
      + "qu'elle n'a pas vu : un garde absent ne vaut jamais un garde permissif.",
    );
  }

  // Un chemin relatif s'entend depuis le lieu — c'est le cwd de la session.
  // `resolve` normalise au passage les « .. », qui sont précisément par où l'on
  // sort du lieu en ayant l'air d'y rester.
  const racine = normalize(resolve(lieu));
  const vise = normalize(resolve(racine, chemin));

  if (basename(vise) !== FICHIER_PERMIS || normalize(dirname(vise)) !== racine) {
    return deny(`Ce geste vise « ${vise} ». ${PAS_A_TOI}`);
  }

  if (!OUTILS_DU_FICHIER_PERMIS.has(outil)) {
    return deny(
      `« ${outil} » vise un carnet, pas un document. ${FICHIER_PERMIS} se tient avec Write ou `
      + `Edit. ${PAS_A_TOI}`,
    );
  }

  return allow(
    `« ${FICHIER_PERMIS} » est ta propre mémoire, à la racine de ton lieu : c'est le seul fichier `
    + "que tu tiens toi-même, et le tenir à jour fait partie de ton métier.",
  );
}

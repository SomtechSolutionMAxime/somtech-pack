// arguments.js — comment la commande lit sa ligne de commande.
//
// Partie purement calculatoire, isolée pour la même raison que `nommage.js` : elle se
// trompe en silence, et elle ne se prouve pas en lançant un binaire qui, lui, veut un
// trousseau, un pane herdr et un veilleur.
//
// LE DÉFAUT QUI A MOTIVÉ `premierLibre` EST TOUJOURS LÀ POUR MÉMOIRE : un simple « premier
// mot qui ne commence pas par -- » prenait la VALEUR d'une option pour l'argument principal.
// `ouvrir --inviter maxime@somtech.ca D-1` créait un canal nommé d'après l'adresse courriel.
// Silencieux, et le canal reste.

/** Options qui consomment la valeur suivante — elle n'est donc jamais un argument libre. */
export const OPTIONS_A_VALEUR = new Set([
  // `--a <ligne>` DÉSIGNE LA LIGNE VISÉE, et son oubli ici n'aurait pas seulement raté une
  // option : `dire --a client "texte"` aurait pris « client » pour le texte du message, et
  // envoyé le mot « client » à la place du rapport. Une option à valeur qui n'est pas déclarée
  // ici se trompe toujours du même côté — celui qui parle.
  '--a',
  '--sujet',
  '--inviter',
  '--bilan',
  '--titre',
  '--nature',
  '--canal',
  '--depot',
  '--dirigeant',
]);

/** La première valeur d'une option, ou `null`. */
export function option(args, nom) {
  const i = args.indexOf(nom);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}

/**
 * TOUTES les valeurs d'une option répétée — `--dirigeant a --dirigeant b`.
 *
 * `option` rend la PREMIÈRE, ce qui est juste pour un titre ou un sujet. La liste des
 * autorisés du canal commun, elle, se perdrait en silence : deux personnes nommées, une seule
 * inscrite, et celle qui manque s'entend refuser la parole sans savoir pourquoi — sur le canal
 * qui sert précisément à ne plus attendre.
 *
 * Une occurrence suivie d'une autre option (`--dirigeant --titre x`) ne compte pas : c'est une
 * valeur oubliée, pas une valeur qui vaut `--titre`.
 */
export function optionsRepetees(args, nom) {
  const valeurs = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === nom && args[i + 1] != null && !String(args[i + 1]).startsWith('--')) valeurs.push(args[i + 1]);
  }
  return valeurs;
}

/** Le premier argument libre — en sautant les VALEURS d'options. */
export function premierLibre(args) {
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      if (OPTIONS_A_VALEUR.has(a)) i += 1; // sa valeur n'est pas un argument libre
      continue;
    }
    return a;
  }
  return null;
}

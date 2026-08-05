// cadre.js — ce qui entoure la parole du dirigeant quand elle arrive dans un pane.
//
// Sans cadre, le message brut arrive dans le terminal de l'agent, qui répond… dans son
// terminal. Côté dirigeant, il ne se passe RIEN : il a l'impression que son message n'est
// jamais arrivé, alors qu'il a été remis et lu. C'est le pire résultat possible — pire que
// l'échec, qui au moins se voit.
//
// Le cadre porte donc trois choses, et une seule est facultative :
//   1. d'OÙ vient ce message (il n'a pas été tapé dans le pane) ;
//   2. COMMENT y répondre, avec la commande exacte — pas un renvoi à une documentation ;
//   3. que répondre dans le terminal ne répond à personne.

/** Chemin de la commande tel qu'un agent doit l'invoquer, quelle que soit son origine. */
export const COMMANDE = 'node "$HOME/.somtech/ligne-directe/bin/ligne-directe.js"';

/**
 * Enveloppe la parole du dirigeant pour qu'un agent sache quoi en faire.
 *
 * @param {object} p
 * @param {string} p.chantier code du chantier
 * @param {string} p.texte    la parole, intacte
 * @param {string} [p.canal]  nom du canal, pour situer
 */
export function cadrerPourAgent({ chantier, texte, canal }) {
  const ou = canal ? ` (#${canal})` : '';
  return [
    `[LIGNE DIRECTE — ${chantier}${ou}] Message du dirigeant, reçu par Slack :`,
    '',
    texte,
    '',
    '——',
    `Il attend ta réponse DANS SLACK : ce que tu écris dans ce terminal, il ne le voit pas.`,
    `Réponds-lui avec :  ${COMMANDE} dire "ta réponse"`,
    `S'il te faut un arbitrage en retour :  ${COMMANDE} demander "ta question"`,
  ].join('\n');
}

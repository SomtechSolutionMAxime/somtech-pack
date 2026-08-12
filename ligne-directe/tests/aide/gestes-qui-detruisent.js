// Ce qu'un message de refus ne doit JAMAIS mettre dans la bouche de celui qui le lit.
//
// VÉCU, 2026-08-11 (T-20260811-0087) : un refus disait au dirigeant que son jeton Slack
// n'était pas au trousseau — il y était — et lui donnait une commande qui ÉCRASE l'entrée.
// S'il l'avait lancée sans le bon jeton en main, il détruisait celui qui marchait et coupait
// les onze lignes de discussion vivantes du poste.
//
// Un message d'erreur est lu par quelqu'un qui a déjà un problème, qui fait confiance, et
// qui colle. Ce qu'on y écrit est donc exécuté. La garde ci-dessous ne cherche pas des MOTS :
// elle cherche des GESTES — des commandes qui, exécutées de bonne foi, détruisent quelque
// chose qui marchait. Chacun est nommé avec ce qu'il coûte, parce que le motif seul ne le dit
// pas, et que c'est ce coût qui justifie la garde.

/** @type {{motif: RegExp, quoi: string}[]} */
export const GESTES_QUI_DETRUISENT = [
  {
    motif: /add-generic-password[^\n]*\s-U(\s|$)/,
    quoi: '« security add-generic-password -U » ÉCRASE l’entrée existante — celle qui marchait',
  },
  {
    motif: /\bdelete-generic-password\b/,
    quoi: '« security delete-generic-password » SUPPRIME l’entrée — même perte, un geste plus tôt',
  },
  {
    motif: /\brm\s+-[a-zA-Z]*[rf]/,
    quoi: '« rm -rf » supprime sans retour, et personne ne sait ce qu’un humain avait mis là',
  },
  {
    motif: /\b(pkill|killall)\b/,
    quoi: '« pkill »/« killall » tuent PAR MOTIF — donc au-delà de la cible, et les lignes vivantes avec',
  },
];

/** Les gestes destructeurs proposés par un message, nommés — vide quand le message est sûr. */
export function gestesQuiDetruisentDans(message) {
  return GESTES_QUI_DETRUISENT.filter((g) => g.motif.test(message)).map((g) => g.quoi);
}

/** Échoue en NOMMANT le geste trouvé et en montrant le message — sinon on cherche à l'aveugle. */
export function aucunGesteQuiDetruit(assert, message, quel) {
  const trouves = gestesQuiDetruisentDans(message);
  assert.deepEqual(trouves, [], `le refus « ${quel} » envoie détruire :\n    ${trouves.join('\n    ')}\n  message rendu :\n${message}`);
}

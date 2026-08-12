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

// CHAQUE GESTE PORTE SON PROPRE EXEMPLE, et ce n'est pas de la décoration.
//
// DÉFAUT VÉCU SUR CE CORRECTIF, relevé en seconde revue : les exemples vivaient à part, dans
// le fichier de test, et n'étaient appariés aux motifs que par leur NOMBRE. On pouvait donc
// ajouter un motif mort — une expression cassée qui ne mord sur rien — accompagné d'un
// exemple qui, lui, était attrapé par un AUTRE motif déjà présent. Le compte tombait juste,
// chaque exemple avait bien son unique correspondance, et les 251 tests restaient verts
// autour d'une garde à demi morte.
//
// L'exemple vit donc avec son motif, et le test exige que l'exemple d'un geste rende CE
// geste — nommément. Un motif qui ne mord pas sur son propre exemple ne peut plus passer,
// et un geste ajouté sans exemple ne compile même pas la promesse.

/** @type {{motif: RegExp, quoi: string, exemple: string}[]} */
export const GESTES_QUI_DETRUISENT = [
  {
    motif: /add-generic-password[^\n]*\s-U(\s|$)/,
    quoi: '« security add-generic-password -U » ÉCRASE l’entrée existante — celle qui marchait',
    exemple: 'security add-generic-password -U -a "$USER" -s ligne-directe-bot -w "$(pbpaste)"',
  },
  {
    motif: /\bdelete-generic-password\b/,
    quoi: '« security delete-generic-password » SUPPRIME l’entrée — même perte, un geste plus tôt',
    exemple: 'security delete-generic-password -a moi -s ligne-directe-bot',
  },
  {
    motif: /\brm\s+-[a-zA-Z]*[rf]/,
    quoi: '« rm -rf » supprime sans retour, et personne ne sait ce qu’un humain avait mis là',
    exemple: 'Retire ce reste (« rm -rf /tmp/un-lieu »), puis relance',
  },
  {
    motif: /\b(pkill|killall)\b/,
    quoi: '« pkill »/« killall » tuent PAR MOTIF — donc au-delà de la cible, et les lignes vivantes avec',
    exemple: 'pkill -f demarrer-veilleur.js',
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

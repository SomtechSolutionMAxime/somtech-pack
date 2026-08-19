// LES MOTIFS QUI JUGENT LA PROSE D'UN REFUS — un seul endroit, deux bancs (T-20260819-0009).
//
// ⚠️ POURQUOI ILS NE VIVENT PLUS EN DOUBLE. Le banc du module et celui du binaire portaient
// chacun leur copie. Relevé en passe de fond : elles avaient DÉJÀ divergé — celle du binaire
// omettait deux des six formules de non-tentative, et laissait donc passer « en vérité elle n'a
// jamais été tentée sur ce pane » que l'autre attrapait. C'est le défaut que ce module se
// reproche ailleurs à lui-même : deux mécanismes pour une règle, et c'est celui qu'on ne relit
// plus qui perd. Une seule définition, importée des deux côtés.

/**
 * LE GESTE EST NOMMÉ — la touche, Entrée, la soumission, la frappe, le raccourci.
 *
 * ⚠️ ON CHERCHE LA FONCTION, PAS UNE RÉDACTION. Une première version exigeait le substrat exact
 * « touche d'envoi » et refusait 6 formulations honnêtes sur 8 (« j'ai appuyé sur Entrée », « la
 * frappe de soumission est partie »). Une garde calée sur la phrase de son auteur passe pour
 * bonne jusqu'au jour où quelqu'un d'autre écrit la même chose autrement.
 */
export const NOMME_LE_GESTE = /(touche\s+d[’']envoi|entr[ée]e|soumission|soumis|frappe|raccourci|press[ée])/iu;

/**
 * ET IL EST AU PASSÉ — un geste au futur ou au conditionnel n'est pas un geste posé.
 *
 * ⚠️ PAS DE `\b` APRÈS UNE LETTRE ACCENTUÉE. En JavaScript, `\b` se calcule sur `[A-Za-z0-9_]` :
 * « é » n'y est pas, donc `…é\b` ne peut jamais se fermer. Mesuré : le motif refusait « j'ai
 * pressé » et « j'ai appuyé ». Relevé comme classe à part — T-20260819-0060.
 */
export const AU_PASSE = /(d[ée]j[àa]|a\s+[ée]t[ée]|est\s+partie?|ai\s+[a-zà-ÿ]+[ée]s?(?![a-zà-ÿ]))/iu;

/**
 * CE QUI TRAHIT UNE NON-TENTATIVE — le déni, sous ses tours.
 *
 * ⚠️ LE CONDITIONNEL EN FAIT PARTIE : « la touche aurait déjà été pressée si la boîte l'avait
 * permis » porte le geste ET le passé, et dit pourtant que rien n'a eu lieu.
 *
 * ⚠️ MAIS IL NE SE JUGE QUE SUR LE GESTE. Interdire « aurait » n'importe où refusait une phrase
 * honnête où le mot vivait dans une tout autre proposition. Une garde qui crie sur du texte
 * correct se fait retirer par le premier qui la rencontre, et emporte ce qu'elle gardait.
 */
export const FORMULES_DE_NON_TENTATIVE = [
  /n[’']ai\s+(?:pas|jamais)/iu,
  /pas\s+encore/iu,
  /n[’']a\s+(?:pas|jamais)\s+(?:[ée]t[ée]\s+)?(?:press|soumis|envoy|tent|part)/iu,
  /jamais\s+[ée]t[ée]\s+tent/iu,
  /RIEN\s+soumis/iu,
  /aurait\s+(?:d[ée]j[àa]\s+)?(?:[ée]t[ée]\s+)?(?:press|soumis|confirm|envoy|tent|abouti|normalement|d[ûu])/iu,
];

/**
 * « HERDR A REFUSÉ », ET RIEN D'AUTRE.
 *
 * ⚠️ UN REJET EN AVAL EST UN FAIT DE PLUS, PAS UN MENSONGE. Interdire le mot « rejet » n'importe
 * où refusait une prose honnête : « herdr a accepté ce geste, mais la session a ensuite rejeté ma
 * commande ». C'est l'issue attribuée à HERDR qui doit rester vraie.
 */
export const HERDR_A_REFUSE = /(herdr[^.]{0,40}(refus|repouss|rejet)|(refus|repouss[ée]e?|rejet[ée]e?)[^.]{0,40}par\s+herdr)/iu;

/**
 * LA CONSÉQUENCE — et c'est le POINT du lot, pas un ornement.
 *
 * ⚠️ TROUVÉ PAR UNE QUATRIÈME PASSE DE FOND, APRÈS TROIS QUI L'ONT MANQUÉ. On pouvait retirer
 * « il N'A PAS SUFFI […] ce que tu vois n'est donc pas un pane intact — une action irréversible
 * y a déjà eu lieu » et ne garder que l'annonce du geste : tous les bancs restaient verts.
 *
 * Or l'annonce seule ne sert à rien. Ce que le lecteur doit emporter, c'est que **le pane n'est
 * pas dans l'état où il croit le trouver**. Une garde qui vérifie qu'on a parlé du geste, sans
 * vérifier qu'on a dit ce qu'il laisse derrière lui, garde la forme et laisse partir le fond.
 */
// ⚠️ ET LE MOTIF A DÛ S'ÉLARGIR AUSSITÔT POSÉ. Mesuré au banc : dans sa première forme, il
// refusait 8 formulations honnêtes sur 15 — dont « la boîte n'a pas bougé » et « sans vider la
// boîte », qui disent exactement la conséquence, autrement. Le deuxième chiffre a fait son
// travail le jour même où la garde est née : sans lui, on livrait une garde qui crie sur du
// texte correct, et le premier qui la rencontre la retire.
export const DIT_LA_CONSEQUENCE =
  /(pas\s+suffi|n[’']a\s+pas\s+[ée]t[ée]\s+vid|pas\s+vid[ée]e?|sans\s+(?:l[ea]\s+)?vider|pas\s+un\s+pane\s+intact|irr[ée]versible|sans\s+effet|pas\s+abouti|(?:rest[ée]e?|toujours)\s+pleine|n[’']a\s+pas\s+boug)/iu;

/**
 * LES LIGNES D'AVEU — celles que ce lot ajoute au refus.
 *
 * ⚠️ ON N'ASSERTE PAS SUR TOUT LE MESSAGE. Sa première ligne rapporte ce que herdr a dit, et
 * herdr dit « a refusé : no state change observed » : chercher « refus » dans l'ensemble était
 * satisfait par un mot qui ne venait PAS de la prose éprouvée. Et les formules de non-tentative,
 * appliquées au message entier, refusaient une phrase honnête dont le déni portait sur autre
 * chose (« je n'ai pas encore vérifié si un second destinataire attend »).
 */
export const lignesAvouees = (texte) => texte.split('\n').filter((l) => l.trimStart().startsWith('⚠'));

/** Ce qu'on exige d'un refus qui AVOUE un geste posé. Rend la liste des manquements. */
export function manquementsDeLAveu(aveu, { herdrARefuse }) {
  const manques = [];
  if (!NOMME_LE_GESTE.test(aveu)) manques.push('ne nomme pas le geste');
  if (!AU_PASSE.test(aveu)) manques.push('ne le dit pas au passé');
  if (!DIT_LA_CONSEQUENCE.test(aveu)) manques.push('ne dit pas ce que le geste laisse derrière lui');
  for (const formule of FORMULES_DE_NON_TENTATIVE) {
    if (formule.test(aveu)) manques.push(`porte une formule de non-tentative (${formule})`);
  }
  if (herdrARefuse && !HERDR_A_REFUSE.test(aveu)) manques.push('ne dit pas que herdr a repoussé le geste');
  if (!herdrARefuse && HERDR_A_REFUSE.test(aveu)) manques.push('annonce un refus de herdr alors qu’il a ACCEPTÉ');
  return manques;
}

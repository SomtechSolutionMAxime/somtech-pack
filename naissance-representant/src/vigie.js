// vigie.js — LE TROISIÈME ÉTAT : un agent qui ne bouge plus (T-20260816-0063).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER EXISTE POUR VOIR
//
// Le dispositif connaît deux états d'un agent qui n'avance pas : il TRAVAILLE (`working`), ou
// il est PARQUÉ derrière un écran (`blocked`, et l'écran est nommé depuis `T-20260816-0033`).
// Il en existe un troisième, que rien ne regardait : **figé**. Une session y a passé plus
// d'une heure, et c'est une ronde HUMAINE qui l'a découverte.
//
// Il est pire que le parqué : le parqué a un écran, donc une preuve lisible. **Le figé n'a
// rien**, et il ressemble trait pour trait à un agent qui réfléchit.
//
// ⚠️ CE MODULE NE PARLE À PERSONNE ET N'AGIT SUR RIEN. Il reçoit des lectures déjà faites et
// rend un jugement — donc il s'éprouve sans herdr, et la ronde s'éprouve sans lui. C'est aussi
// ce qui garantit l'interdit : **on ne débloque jamais à la place de l'agent**. Envoyer une
// touche à un agent figé, c'est taper à sa place ; le but est qu'il SE VOIE, pas qu'on le
// pilote. Un module qui ne peut rien envoyer ne peut pas déraper.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE TÉMOIN, ET LA PISTE QUI EST MORTE POUR QU'IL EXISTE
//
// ⛔ `state_change_seq` NE DISCRIMINE RIEN. Le passage de relais le donnait comme « la piste la
// plus prometteuse ». Mesuré le 2026-08-16, cinq points sur 60 s : **figé pour un agent qui
// travaillait activement**, exactement comme pour les 78 au repos. Ce compteur compte les
// TRANSITIONS d'état (`idle → working → done`), pas l'activité. Une garde bâtie dessus aurait
// déclaré figé **tout agent au travail** — le faux positif maximal, sur la garde même qui
// existe pour être crue. La piste est barrée sur place dans le ticket, pas effacée : une
// réfutation qu'on efface se fait redécouvrir comme neuve.
//
// ✅ `revision` DISCRIMINE, CROISÉE AU STATUT. Même série : ~1 par seconde chez l'agent au
// travail, immobile à l'unité près chez tous les autres.
//
//     statut `working` + revision immobile → rien ne bouge, c'est le figé
//     statut `idle`/`done` + revision immobile → normal, il attend
//
// C'est un FAIT croisé à un ÉTAT, pas un seuil de temps — le piège du faux positif se ferme
// donc par construction, au lieu d'être contourné par un réglage qu'il faudrait maintenir.
//
// ✅ ET UN AGENT QUI PENSE N'EST PAS SIGNALÉ, observé en vrai : six points sur 45 s sur un
// agent en pleine réflexion, compteur d'activité dépassant **la minute** — le cas exact que le
// relais annonçait. `state_change_seq` figé, `revision` +1 par seconde. Le mécanisme ne dépend
// pas du libellé (trois observés : `Whirring…`, `Infusing…`, `Seasoning…`) mais du fait qu'un
// libellé d'activité **porte sa propre horloge**, donc redessine l'écran chaque seconde. Un
// agent qui pense ne PEUT PAS ne pas faire avancer sa revision.
//
// ✅ LE FOCUS NE COMPTE PAS — mesuré sur les 79 panes : `focused: false` et la revision avance
// quand même. Si le rendu en avait dépendu, la garde tombait pour tout agent en arrière-plan.

/**
 * Combien de lectures il faut avant de dire quoi que ce soit.
 *
 * ⚠️ UN POINT DE MESURE EST UN INDICE, UNE SÉRIE EST UN FAIT. Un agent dont la revision n'a pas
 * bougé sur UNE mesure n'est pas un agent figé : c'est un agent mesuré une fois. C'est la même
 * distinction que tout le reste de ce dépôt, appliquée au temps.
 */
export const LECTURES_MINIMALES = 3;

/** L'écart minimal entre la première et la dernière lecture — sinon on a regardé trop vite. */
export const DUREE_MINIMALE_MS = 15000;

const AU_REPOS = new Set(['idle', 'done']);
const PERDU = new Set([null, undefined, 'unknown']);

/** Ce qu'on a vu, rendu tel quel — parce que le spécimen a été perdu deux fois. */
function capturer(lectures) {
  const der = lectures[lectures.length - 1];
  return {
    revisions: lectures.map((l) => l.revision),
    horodatages: lectures.map((l) => l.t),
    statut: lectures[0].statut,
    statut_final: der.statut ?? null,
    ecran: der.ecran ?? null,
    duree_ms: der.t - lectures[0].t,
  };
}

/**
 * Le verdict sur une série de lectures d'un même pane — ou `null` s'il n'y a rien à dire.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LES DEUX FORMES NE SONT PAS PROUVÉES PAREIL, ET LE VERDICT LE DIT LUI-MÊME
 *
 *   • `agent-introuvable` — **PROUVÉE PAR UN SPÉCIMEN**. Un agent jetable gelé par `SIGSTOP`
 *     ne devient pas « `working` à revision immobile » : il **disparaît de la détection**
 *     (`agent_not_found`) pendant que son pane vit encore, en `unknown`, revision figée.
 *     Personne ne regardait cet état, et il est trivialement détectable.
 *
 *   • `fige-sans-ecran` — **JAMAIS OBSERVÉE DIRECTEMENT**. Le spécimen fabriqué a produit
 *     l'autre forme ; le vrai figé, vu deux fois, a été perdu les deux fois (réveillé à la
 *     main, puis fermé). Cette forme PENCHE DONC VERS LE SILENCE, délibérément : trois
 *     lectures espacées d'au moins quinze secondes, et le moindre doute rend `null`.
 *
 * ⚠️ POURQUOI PENCHER VERS LE SILENCE PLUTÔT QUE VERS L'ALERTE : une garde à demi prouvée qui
 * crie trop se fait retirer, **et emporte avec elle ce qu'elle gardait**. La même qui se tait
 * trop ne coûte qu'une occasion manquée — et celle-là, la ronde la rattrape au tour suivant.
 *
 * ⚠️ ET ELLE CAPTURE CE QU'ELLE TROUVE. Le vrai figé existe ; son spécimen a été perdu deux
 * fois faute d'avoir été mesuré avant d'être réveillé. Le verdict rend donc la série de
 * revisions, leurs horodatages, le statut et l'écran : la moitié non prouvée cesse d'attendre
 * un laboratoire, elle **s'auto-mesure sur le terrain**. La prochaine occurrence réelle rendra
 * la preuve que personne n'a su fabriquer, et elle la rendra à quelqu'un au lieu de disparaître
 * avec le pane.
 */
export function verdictDeVigie(lectures) {
  const l = Array.isArray(lectures) ? lectures : [];
  if (l.length < LECTURES_MINIMALES) return null;
  if (l[l.length - 1].t - l[0].t < DUREE_MINIMALE_MS) return null;

  // ⚠️ UNE LECTURE RATÉE NE VAUT PAS « RIEN N'A BOUGÉ ». « Je n'ai pas vu » n'est pas « il n'y
  // avait rien » — c'est le motif que ce dépôt ferme partout. Une revision illisible au milieu
  // d'une série CASSE la série au lieu de la confirmer.
  if (l.some((x) => x.revision === null || x.revision === undefined)) return null;

  const immobile = l.every((x) => x.revision === l[0].revision);
  if (!immobile) return null;

  // ═══ LA FORME PROUVÉE — l'agent a quitté la détection alors que son pane vit encore.
  //
  // ⚠️ IL FAUT UN « AVANT » OÙ IL ÉTAIT LÀ. Sans lui, « introuvable » ne veut rien dire : un
  // pane qui n'a jamais porté d'agent n'en a perdu aucun. Une preuve doit porter sur un état
  // qui POUVAIT être différent.
  const etaitLa = !PERDU.has(l[0].statut) && !l[0].introuvable;
  const perduDepuis = l.slice(1).every((x) => x.introuvable || PERDU.has(x.statut));
  if (etaitLa && perduDepuis) {
    return {
      forme: 'agent-introuvable',
      quoi:
        'l’agent a disparu de la détection alors que son pane vit encore — il était là au ' +
        'début de la série, il ne répond plus, et rien à l’écran ne bouge',
      capture: capturer(l),
    };
  }

  // ═══ LA FORME QUI PENCHE VERS LE SILENCE.
  //
  // Un agent AU REPOS a une revision immobile PAR NATURE : les 78 panes au repos du poste
  // l'avaient. Les signaler ferait crier la ronde sur tout le poste au premier passage, ce qui
  // est la façon la plus sûre de la rendre inaudible avant qu'elle ait servi une seule fois.
  if (l.every((x) => x.statut === 'working')) {
    return {
      forme: 'fige-sans-ecran',
      quoi:
        'l’agent est déclaré au travail et rien ne bouge à son écran — un agent qui pense ' +
        'redessine son compteur d’activité chaque seconde, celui-ci ne redessine rien',
      // ⚠️ LA LIMITE VIT AVEC LE VERDICT, pas dans une note ailleurs. Un verdict qui tait ce
      // qu'il ne sait pas se fait croire au-delà de ce qu'il a prouvé.
      limite:
        'cette forme n’a JAMAIS été observée sur un vrai agent figé : elle repose sur un ' +
        'raisonnement mesuré à l’envers (un agent sain, lui, fait bouger sa revision). Le ' +
        'spécimen fabriqué pour l’éprouver a produit l’autre forme. Prends la capture comme ' +
        'la mesure qui manquait, pas comme une certitude.',
      capture: capturer(l),
    };
  }

  if (AU_REPOS.has(l[0].statut)) return null;
  return null;
}

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
// ⛔ ET CE CROISEMENT-LÀ ÉTAIT MORT-NÉ, corrigé le 2026-08-21 (T-20260821-0018). Le statut
// croisé venait de `agent_status`, rendu par herdr. **Cette surface ne produit pas `working`.**
//
//   MESURÉ SUR CE POSTE, deux surfaces, le même instant :
//     herdr pane list      →  229 panes,  agent_status ∈ { unknown 146 · idle 83 }.  ZÉRO `working`.
//     ~/.claude/sessions/* →  147 fichiers, status ∈ { idle 144 · waiting 1 · busy 1 · shell 1 }
//
// La condition ne pouvait pas survenir : la vigie ne savait rendre qu'UNE de ses deux formes,
// et elle échouait en SILENCE — personne n'était poussé à rien, on ne voyait simplement pas.
// C'est la troisième instance du même motif dans ce dispositif, après `--until working` et le
// témoin `done` qui se prouvait lui-même.
//
// ✅ LE TÉMOIN QUI DÉCIDE EST DÉSORMAIS LE STATUT RÉEL DE SESSION, lu dans `~/.claude/sessions`
// par `src/activite-session.js`, et croisé à la revision comme avant :
//
//     session `busy`    + revision immobile → il est déclaré EN TRAIN DE CALCULER, et rien ne
//                                             bouge : c'est le figé.
//     session `waiting` + revision immobile → il attend un HUMAIN. Il a donc un écran, donc une
//                                             preuve lisible : c'est le parqué, pas le figé.
//     session `idle`/`shell` + immobile     → au repos, immobile par nature.
//
// ⚠️ `waiting` EST RANGÉ AILLEURS QUE DANS `activite-session.js`, ET C'EST DÉLIBÉRÉ. Là-bas il
// compte comme du TRAVAIL, parce que la question posée est « la session a-t-elle PRIS le brief »
// — et une session qui attend qu'on approuve un dialogue l'a pris. Ici la question est « est-il
// figé », et la réponse est non : il attend quelqu'un. **Deux juges, deux questions, deux
// rangements du même statut.** Comparer leurs verdicts sans comparer leurs questions ferait
// croire à un désaccord là où il y a deux objets.
//
// ⚠️ ET CE RANGEMENT EST MESURÉ, PAS RAISONNÉ. Le seul pane du poste que la règle naïve
// (`busy` OU `waiting`) désignait est `w26:p28`. Son écran a été LU : un dialogue ouvert, une
// question à l'humain, `statusUpdatedAt` remontant à plus de quarante heures. Le ranger avec le
// figé, c'était un faux positif sur 1 candidat sur 1.
//
// ⚠️ CE MODULE N'IMPORTE TOUJOURS RIEN, et ça n'est pas de la coquetterie : il reçoit des
// lectures déjà faites — revision, statut, ET activité de session — et rend un jugement. C'est
// ce qui lui permet de s'éprouver sans herdr ET sans toucher au disque, donc de se faire
// mesurer la sonde COUPÉE, ce qu'un module qui lirait lui-même `~/.claude/sessions` ne pourrait
// pas offrir aussi simplement.
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

const PERDU = new Set([null, undefined, 'unknown']);

/**
 * LES DEUX STATUTS DE SESSION QUI DÉCIDENT — nommés, parce qu'ils ne veulent pas dire la même
 * chose et que les confondre a coûté le seul faux positif que la mesure ait produit.
 */
export const CALCULE = 'busy';
export const ATTEND_UN_HUMAIN = 'waiting';

/**
 * POURQUOI LA SONDE EST MUETTE — le mot que ce module ajoute aux `SILENCES` de la sonde.
 *
 * ⚠️ UNE LECTURE SANS CHAMP `activite` N'EST PAS UNE LECTURE OÙ L'AGENT ÉTAIT AU REPOS : c'est
 * une lecture où PERSONNE N'A DEMANDÉ. Sans ce mot, un appelant qui oublie de sonder rendrait
 * la vigie exactement aussi aveugle qu'avant ce correctif — en silence, et pour toujours.
 */
export const NON_SONDEE = 'la-ronde-n-a-pas-sonde-l-activite';

/**
 * Ce que la sonde a dit de cette lecture, ou le motif de son silence.
 *
 * Muette dès qu'un motif est posé : un statut qu'on ne reconnaît pas est un état NON LU, pas un
 * état de repos. C'est la ligne où le défaut d'origine se réinstallerait.
 */
const motifDuSilence = (lecture) => (lecture.activite ? (lecture.activite.motif ?? null) : NON_SONDEE);
const statutDeSession = (lecture) => lecture.activite?.statut ?? null;

/** Ce qu'on a vu, rendu tel quel — parce que le spécimen a été perdu deux fois. */
function capturer(lectures) {
  const der = lectures[lectures.length - 1];
  return {
    revisions: lectures.map((l) => l.revision),
    horodatages: lectures.map((l) => l.t),
    statut: lectures[0].statut,
    statut_final: der.statut ?? null,
    // ⚠️ CE SUR QUOI LE VERDICT S'EST DÉCIDÉ, pas seulement ce qu'il a décidé. Le spécimen a
    // été perdu deux fois faute d'avoir été mesuré ; une capture qui tait son propre témoin
    // fait repartir de zéro le prochain qui la relira.
    activites: lectures.map((l) => statutDeSession(l)),
    silences: lectures.map((l) => motifDuSilence(l)),
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
 *   • `fige-sans-ecran` — **ELLE PEUT ENFIN SE DÉCLENCHER** (T-20260821-0018). Jusqu'au
 *     2026-08-21 elle guettait `working` sur une surface qui ne le produit pas : elle était
 *     morte, pas rare. Elle guette désormais le statut RÉEL de session (`busy`). Elle penche
 *     toujours vers le silence — trois lectures espacées d'au moins quinze secondes — mais son
 *     silence n'est plus une fatalité de câblage.
 *
 *     CE QUI A ÉTÉ MESURÉ LE 2026-08-21, et ce qui ne l'a pas été :
 *
 *       ✅ **0 vivant déclaré figé à tort**, fenêtre de 40 s, lecture seule — sur 105 panes
 *          portant un agent (tout le poste), ET sur les **9 orchestrateurs** que
 *          `orchestrateursDuPoste` sélectionne réellement.
 *
 *       ⛔ **ET LE « SUR-ENSEMBLE DONC PLUS SÉVÈRE » ÉTAIT FAUX — retiré.** Une première
 *          rédaction présentait la mesure poste-entier comme une borne haute du bruit de la
 *          ronde. Elle ne l'est pas : la vigie ne regarde que les orchestrateurs dont la
 *          LIVRAISON A ÉCHOUÉ, et cette population est corrélée EN SENS INVERSE avec la cause
 *          du bruit — un agent dont la livraison échoue est justement celui dont l'identifiant
 *          de session a tourné ou dont le fichier a disparu. **Mesuré, et l'inversion est
 *          confirmée** : le seul `activite-non-mesurable` des 9 (`w7M:p2`) est aussi le pane
 *          au **plus haut taux d'échec de livraison du poste — 28 sur 48, 58 %**. Il est donc
 *          SUR-représenté chez les suspects, pas sous-représenté. Sur les 71 rondes du
 *          journal, il aurait produit une ligne dans **28** d'entre elles.
 *          *Une population n'est pas une borne parce qu'elle est plus grande.*
 *       ✅ **Le spécimen que personne n'avait su fabriquer** : un agent Claude arrêté par
 *          `SIGSTOP` en plein travail garde `busy` dans son fichier de session et cesse de
 *          redessiner. Il est ATTRAPÉ. Sur la même série, le code d'avant rend `null`.
 *       ✅ **Le même agent, dégelé et réellement au travail** (`busy`, revision +21 en 20 s) :
 *          non signalé. La moitié qui prouve tient.
 *       ⛔ **Aucune ligne de journal réelle.** Une vraie ronde livre un rappel dans la boîte de
 *          chaque orchestrateur — le geste que le chantier interdit. On ne sait donc rien de ce
 *          que la vigie ÉCRIT quand elle se déclenche en production : c'est une VÉRIFICATION
 *          POST-INSTALLATION, pas une chose que ce lot a établie.
 *       ⛔ **Un figé NATUREL** reste non observé : le seul spécimen est fabriqué.
 *       ⚠️ **Le bruit ajouté, chiffré** : 1 ligne `activite-non-mesurable` sur 9
 *          orchestrateurs, et elle nomme une anomalie RÉELLE — un orchestrateur dont le
 *          fichier de session a disparu, que rien ne signalait avant. Le geste qu'elle appelle
 *          n'est pas le même que celui du figé, et c'est pour ça qu'elle porte un autre mot.
 *
 *     ⚠️ UNE MESURE DONT ON IGNORE LA LIMITE SE LIT COMME COMPLÈTE — et c'est très exactement
 *     ce qui a laissé la version morte de cette garde vivre des mois.
 *
 *   • `activite-non-mesurable` — **LA TROISIÈME, ET ELLE EXISTE POUR NE PAS MENTIR**. Une sonde
 *     a deux façons de ne rien montrer : elle regarde et il n'y a rien (une DÉCISION), ou elle
 *     ne peut pas regarder (un SILENCE, qui ne décide rien). Les deux rendaient `null`, donc
 *     « aucun agent figé » — un juge aveugle qui rend un verdict bien formé, c'est-à-dire le
 *     défaut même que ce module corrige, réinstallé un cran plus haut. Elle nomme sa cause.
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
/*
 * ⚠️ PRÉCONDITION MESURÉE : CE VERDICT SUPPOSE UN PANE QUI PORTE UN AGENT.
 *
 * La ronde ne l'appelle que sur des orchestrateurs qu'elle a trouvés, donc la condition est
 * tenue par construction. Mais appliqué à TOUT le poste, il rend `activite-non-mesurable` sur
 * les 124 panes qui sont de simples terminaux — vrai, et parfaitement inutile : un pane sans
 * agent n'a pas d'activité à mesurer. Mesuré en produisant la baseline, pour que le prochain
 * qui réutilise ce module hors de la ronde sache d'où vient le bruit avant de l'attribuer au
 * mécanisme. Le filtre appartient à l'appelant : ici, on ne peut pas distinguer « aucun agent
 * n'a jamais vécu là » de « l'annuaire de herdr ignore cet agent », et cette seconde forme,
 * elle, doit être dite.
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

  // ═══ LA SONDE COUPÉE — et c'est la garde qui empêche ce module de rejouer son propre défaut.
  //
  // ⚠️ « JE N'AI PAS PU VOIR » N'EST PAS « IL N'Y AVAIT RIEN ». C'est la même règle que la
  // revision illisible vingt lignes plus haut, appliquée à l'autre témoin — et c'est celle qui
  // manquait ici : une source de sessions absente rendait un `null` indiscernable d'un poste
  // parfaitement sain. Un essai qui couvre « quand il n'y a rien » passe alors PARFAITEMENT
  // pendant que la mesure est aveugle.
  //
  // ⚠️ ET ELLE PASSE APRÈS `agent-introuvable`, JAMAIS AVANT. Un agent qui a quitté la détection
  // n'a plus d'identifiant de session à interroger : sa sonde est muette PAR CONSTRUCTION.
  // Devant, elle remplacerait la seule forme prouvée par un mot qui en dit moins.
  // ⚠️ MAIS UN ACCROC NE PARLE QUE SI L'HYPOTHÈSE TIENT ENCORE — relevé en passe de fond, et
  // c'était le défaut corrigé réinstallé À L'ENVERS. La forme du figé exige l'unanimité, une
  // revision illisible ANNULE la série ; celle-ci criait sur UNE lecture sur trois. Elle était
  // la seule des trois gardes de ce fichier à alarmer sur un accroc.
  //
  // ⚠️ ET L'ACCROC EST RÉEL : Claude Code réécrit le fichier de session à chaque changement de
  // statut, et la ronde relit ce dossier à chaque lecture. Une lecture qui tombe pendant une
  // réécriture rend `source-des-sessions-introuvable` sur une source parfaitement saine.
  //
  // UNE SEULE LECTURE CLAIRE QUI N'EST PAS `busy` RÉFUTE LE FIGÉ, et un silence n'a plus rien à
  // ajouter à une réfutation : on a regardé, et on a VU. Un statut de repos dit qu'il se repose ;
  // un statut qui CHANGE dit que sa session était vivante pour le changer. Dans les deux cas, le
  // silence de l'autre lecture ne décide de rien — c'est le sens même de ce mot.
  //
  // ⚠️ CE N'EST PAS UN DÉSARMEMENT, et la borne est exactement là : tant qu'AUCUNE lecture
  // lisible ne réfute le figé, l'accroc parle. `[busy, trou, busy]` reste non mesurable.
  const refute = l.some((x) => motifDuSilence(x) === null && statutDeSession(x) !== CALCULE);
  const silences = refute ? [] : l.map((x) => motifDuSilence(x)).filter(Boolean);
  if (silences.length) {
    return {
      forme: 'activite-non-mesurable',
      quoi:
        'l’activité de cet agent n’a pas pu être lue — ce n’est PAS un constat d’inactivité, ' +
        'et surtout pas un constat qu’il va bien : rien n’a été établi sur lui',
      // Un mot par cause, jamais un mot pour toutes : un identifiant absent est un défaut
      // d'annuaire `herdr`, un fichier absent une session que la source ne connaît pas, une
      // source absente une installation incomplète. Elles n'appellent pas le même geste.
      motifs: [...new Set(silences)],
      capture: capturer(l),
    };
  }

  // ═══ LE FIGÉ — il est DÉCLARÉ EN TRAIN DE CALCULER, et rien ne bouge.
  //
  // Un agent AU REPOS a une revision immobile PAR NATURE : 101 des 105 panes portant un agent
  // l'avaient au moment de la mesure. Les signaler ferait crier la ronde sur tout le poste au
  // premier passage, ce qui est la façon la plus sûre de la rendre inaudible avant qu'elle ait
  // servi une seule fois.
  if (l.every((x) => statutDeSession(x) === CALCULE)) {
    return {
      forme: 'fige-sans-ecran',
      quoi:
        'sa session est déclarée EN TRAIN DE CALCULER et rien ne bouge à son écran — un agent ' +
        'qui pense redessine son compteur d’activité chaque seconde, celui-ci ne redessine rien',
      // ⚠️ LA LIMITE VIT AVEC LE VERDICT, pas dans une note ailleurs. Un verdict qui tait ce
      // qu'il ne sait pas se fait croire au-delà de ce qu'il a prouvé. Elle ne dit plus « jamais
      // observée » — ça, c'était le symptôme du câblage mort. Elle dit ce que la mesure couvre.
      limite:
        'mesurée le 2026-08-21, lecture seule : zéro vivant déclaré figé à tort — sur 105 ' +
        'panes portant un agent, et sur les 9 orchestrateurs que la ronde sélectionne. Un ' +
        'spécimen RÉELLEMENT gelé (agent Claude arrêté par SIGSTOP en plein travail) est ' +
        'attrapé, là où le code d’avant rendait `null` sur la même série. Le bruit ajouté est ' +
        'de 1 `activite-non-mesurable` sur ces 9, et elle nomme une anomalie réelle. Reste non ' +
        'établi : un figé NATUREL (le seul spécimen est fabriqué) et ce que la vigie écrit en ' +
        'production, aucune ligne de journal réelle n’ayant été produite. Prends la capture ' +
        'comme la mesure qui manque encore.',
      capture: capturer(l),
    };
  }

  // Tout le reste ne dit rien de certain, donc ne dit rien. C'est le penchant vers le silence :
  //
  //   • `waiting` — il attend un HUMAIN, derrière un écran. C'est le parqué : il a une preuve
  //     lisible, et les familles de non-livraison le nomment déjà. Le seul candidat que la
  //     règle naïve désignait sur ce poste était exactement celui-là, en attente depuis plus de
  //     quarante heures devant un dialogue ouvert — un faux positif sur 1 sur 1.
  //   • `idle` / `shell` — au repos, immobile par nature.
  //   • une série mixte — un statut qui a changé en cours de route ne prouve pas l'immobilité
  //     de l'état, seulement celle de l'écran.
  return null;
}

// LA VUE DU PARC — par orchestrateur, ses epics, leurs stories, et le nom de l'agent sur
// chaque ligne. (E-20260822-0002, sous P-20260822-0001 — T-20260822-0012/0013/0014.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE MODULE JOINT, ET PAR QUOI — RA-VUE-005, ET C'EST LA SEULE RÈGLE QUI COMPTE ICI
//
// Deux moitiés de la réponse existaient déjà, séparément :
//
//   le recensement  →  QUI est vivant : nom, rôle, mandat, lieu, statut
//   le ServiceDesk  →  QUOI est en cours : projets, epics, stories
//
// **La clé qui les joint est le CODE DU MANDAT que l'agent tient de son LIEU.** Pas
// `assigned_agent` : ce champ existe sur les tickets, c'est du TEXTE LIBRE saisi à la main, et
// il est souvent vide. Un libellé se rédige, diverge et vieillit ; un mandat se mesure. Ce
// module ne lit `assigned_agent` NULLE PART, et le banc `la-vue-du-parc-joint-par-le-mandat`
// le garde en lui faisant manger un ticket dont l'`assigned_agent` désigne quelqu'un d'autre
// que le porteur mesuré.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LES DEUX ÉTAGES DE L'ATTRIBUTION, ET POURQUOI ILS NE SE REPLIENT JAMAIS L'UN DANS L'AUTRE
//
// Mesuré sur ce poste le 2026-08-22 : **42 agents portent un nom qui EST un code de chantier,
// et 41 d'entre eux ont `mandat: null`** — parce qu'un chef d'équipe n'a aucun lieu où lire son
// mandat (T-20260822-0018). L'agent qui a écrit ce module est lui-même dans les 41.
//
// L'étage 1 seul — le mandat lu au lieu — rendrait donc « agent non établi » sur presque chaque
// epic et chaque story. Vrai, conforme, et inutile à qui demande qui travaille sur quoi.
//
//   ÉTAGE 1 — `mesure: 'lue'`.  L'agent porte ce code comme MANDAT, lu à son LIEU. FAIT FOI.
//   ÉTAGE 2 — `mesure: 'non établi'` + `indices`.  Aucun agent ne porte ce code comme mandat,
//             mais un agent porte ce code comme NOM. Ce n'est PAS une jointure : c'est une
//             piste, et le champ continue de dire « non établi ».
//
// 🔴 CE QUI SE JOUE AU RENDU, PAS DANS LA DONNÉE. HS-VUE-002 interdit un lien deviné « qui SE
// LIT comme un lien constaté » — le dirigeant lit une LIGNE, pas un champ JSON. D'où les trois
// conditions de l'arbitrage du 2026-08-22, toutes gardées par des bancs :
//
//   1. sur la ligne rendue, « NON ÉTABLI » se lit AVANT l'indice, jamais après ;
//   2. l'indice porte SA PROPRE PHRASE — « un agent porte ce nom, son lieu ne le prouve pas » —
//      jamais un nom nu, parce qu'un nom nu redevient un rattachement en trois relectures ;
//   3. un banc dédié prouve qu'une ligne à indice ne peut pas être confondue avec une ligne
//      mesurée. C'est cette garde qui empêche la dérive, pas la consigne qui l'a demandée.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA CONDUITE HÉRITÉE DU RECENSEMENT, ET ELLE NE SE RELÂCHE PAS EN CHANGEANT DE MODULE
//
// Ce module LIT et REND. Il n'écrit rien, ni au ServiceDesk ni ailleurs (RA-VUE-001), et il ne
// pilote rien (HS-VUE-001). Il hérite des trois états qui ne se replient jamais en deux :
//
//   « mesuré, voici la valeur »  ≠  « mesuré, il n'y a pas de valeur »  ≠  « pas pu mesurer »
//
// Concrètement, et chacun a son banc : `epics: null` dit « je n'ai pas pu lire les epics de ce
// chantier », `epics: []` dit « je les ai lus, il n'y en a aucun ». Les confondre ferait
// disparaître un chantier illisible en le présentant comme un chantier vide.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { CODE_LISIBLE, codeDuMandat, familleDuMandat, CHAMP_DU_CODE, transportServiceDesk } from './mandat.js';
import { rolesConnus, role as roleDe } from './roles.js';
import { roleDuLieu as roleDuLieuReel } from './lieu-agent.js';

/** La règle de conduite, écrite une fois, rendue avec la vue. */
export const REGLE_DE_LA_VUE =
  'cette vue LIT et REND : elle ne joint que par le mandat lu au lieu, elle ne pilote rien, ' +
  'et elle n’écrit nulle part.';

/**
 * LA PHRASE DE L'INDICE — écrite ICI, une seule fois, et rendue TELLE QUELLE.
 *
 * ⚠️ ELLE N'EST PAS DÉCORATIVE, c'est la condition 2 de l'arbitrage. Un indice rendu comme un
 * nom nu (« e-20260822-0002 ») se relit comme une attribution au bout de trois lectures : le
 * lecteur retient le nom et oublie le doute. La phrase voyage donc AVEC le nom, sur la même
 * ligne, et le banc `la-vue-du-parc-joint-par-le-mandat` refuse qu'elle en soit détachée.
 */
export const PHRASE_DE_LINDICE = 'un agent porte ce nom, son lieu ne le prouve pas';

/** Le mot qui décide, et il se lit EN PREMIER sur la ligne (condition 1 de l'arbitrage). */
export const MOT_NON_ETABLI = 'NON ÉTABLI';

/**
 * L'IDENTITÉ D'UNE ENTRÉE DU RECENSEMENT — la session VOYAGE avec le pane, toujours.
 *
 * ⚠️ MESURÉ, PAS SUPPOSÉ : sur les 98 entrées du poste le 2026-08-22, **deux identifiants de
 * pane sont portés par deux sessions différentes** — `w7:p1` vit dans `somtech` ET dans
 * `progex`, avec des noms différents ; `w6:p1` dans `cg` ET dans `progex`. Une clé sans la
 * session ferait de deux agents un seul, et lui prêterait le nom de l'autre. Un nom d'affichage
 * faux est pire qu'un nom absent : on lui PARLE.
 */
export function cleDeLAgent(agent) {
  return `${agent?.session ?? ''}\u0000${agent?.pane ?? ''}`;
}

/** Le nom lisible d'une entrée, ou `null` — jamais un nom deviné, jamais `undefined`. */
export function nomLisible(agent) {
  const n = agent?.nom;
  if (n && typeof n === 'object') return n.mesure === 'lu' && n.valeur ? n.valeur : null;
  return typeof n === 'string' && n ? n : null;
}

/** Le nom du rôle établi d'une entrée, ou `null` quand il ne l'est pas. */
export function roleEtabli(agent) {
  const r = agent?.role;
  if (r && typeof r === 'object') return r.mesure === 'établi' && r.nom ? r.nom : null;
  return typeof r === 'string' && r ? r : null;
}

/**
 * Le code de chantier qu'une entrée porte comme MANDAT — l'étage 1, et lui seul.
 *
 * ⚠️ `null` DÈS QUE CE N'EST PAS UN CODE. Un orchestrateur peut avoir pour mandat `matapedia`
 * ou `general` : son lieu est parfaitement valide et son chantier n'est traçable nulle part.
 * Rendre `MATAPEDIA` comme clé de jointure ferait chercher un chantier qui n'existe pas, puis
 * — pire — le trouverait le jour où un chantier porterait ce nom.
 */
export function codePorteEnMandat(agent) {
  const brut = agent?.mandat;
  if (typeof brut !== 'string' || !brut.trim()) return null;
  const code = codeDuMandat(brut);
  return CODE_LISIBLE.test(code) ? code : null;
}

/**
 * Le code de chantier qu'une entrée porte comme NOM — l'étage 2, et JAMAIS une jointure.
 *
 * La convention est écrite : un chef d'équipe se nomme du code de son mandat. Sa seule
 * faiblesse est de n'être mesurée nulle part — c'est exactement ce que dit `PHRASE_DE_LINDICE`,
 * ni plus ni moins.
 */
export function codePorteEnNom(agent) {
  const nom = nomLisible(agent);
  if (!nom) return null;
  const code = codeDuMandat(nom);
  return CODE_LISIBLE.test(code) ? code : null;
}

/**
 * La carte d'identité rendue pour un agent sur une ligne.
 *
 * ⚠️ `titre` EST LE TITRE DE FENÊTRE, et c'est LUI que le dirigeant reconnaît — pas `w7M:p2`
 * (EF-VUE-006). Cas réel : le pane, la session, le dossier ET le nom lui avaient été donnés, et
 * il a répondu « je trouve pas le pane ». Un poste porte treize sessions herdr, chacune
 * numérotant ses panes indépendamment.
 *
 * ⚠️ ET LA CLÉ EST OMISE PAR LA SOURCE, PAS RENDUE À `null`. Mesuré le 2026-08-22 :
 * `herdr pane list` rend `terminal_title` sur 73 panes sur 76 — les 3 autres n'ont PAS la clé.
 * C'est la forme exacte du piège déjà payé sur `agent` (voir `formes-reelles.js`).
 */
function carteDe(agent) {
  return {
    nom: nomLisible(agent),
    pane: agent?.pane ?? null,
    session: agent?.session ?? null,
    titre: agent?.titre ?? null,
    statut: agent?.statut ?? null,
  };
}

/**
 * LA CLÉ D'UN MANDAT — celle qui dit « c'est le MÊME chantier », qu'il vienne d'un lieu ou d'un pane.
 *
 * ⚠️ ELLE COUVRE LES MANDATS QUI NE SONT PAS DES CODES. `matapedia` et `general` sont des
 * mandats parfaitement valides dont le chantier n'est traçable nulle part : les exclure de la
 * clé ferait apparaître leur lieu ET leur agent comme deux lignes distinctes du même chantier.
 */
export function cleDuMandat(mandat) {
  const m = String(mandat ?? '').trim();
  return m ? codeDuMandat(m) : null;
}

/**
 * L'AGENT VIT-IL ? — et les TROIS états ne se replient jamais en deux (EF-VUE-008).
 *
 * 🔴 CE QUI DÉCIDE EST LA BORNE DU RECENSEMENT, PAS L'ABSENCE D'UN PANE. Une session herdr
 * muette veut dire que des panes existent qu'on n'a pas vus : conclure « son terminal est mort »
 * depuis ce silence, c'est tirer un verdict d'une ABSENCE. Mesuré le 2026-08-22 — 10 sessions
 * sur 13 muettes sur un relevé, 3 sur 3 répondantes sur un autre : l'instrument varie, donc
 * une absence n'a pas toujours la même valeur, et la vue doit dire laquelle.
 *
 *   vivant: true   — un pane vivant porte ce mandat. MESURÉ.
 *   vivant: false  — aucun pane ne le porte, ET toutes les sessions ont répondu. MESURÉ AUSSI.
 *   vivant: null   — aucun pane ne le porte, et une session s'est tue. RIEN N'EST ÉTABLI.
 */
export function presenceDe({ vivant, borne }) {
  if (vivant) {
    return { mesure: 'lue', vivant: true, source: 'un pane vivant porte ce mandat' };
  }
  const muettes = borne?.sessionsRefusees ?? [];
  if (muettes.length) {
    return {
      mesure: 'non établie',
      vivant: null,
      pourquoi:
        `aucun pane vu ne porte ce mandat, mais ${muettes.length} session(s) herdr sont restées ` +
        `muettes (${muettes.map((r) => r?.session ?? 'sans socket').join(', ')}) : des panes existent ` +
        'qu’on n’a pas vus. Ceci n’est PAS « son terminal est mort »',
    };
  }
  return {
    mesure: 'lue',
    vivant: false,
    source: 'toutes les sessions herdr ont répondu, et aucun pane ne porte ce mandat',
  };
}

/**
 * L'AGENT TRAVAILLE-T-IL ? — et `agent_status` NE RÉPOND PAS À CETTE QUESTION (EF-VUE-005).
 *
 * 🔴 `agent_status` EST TAUTOLOGIQUE, MESURÉ : `idle` signifie « vu au registre », pas « au
 * repos » — zéro `working` sur 227 cas relevés. Le rendre tel quel fait lire un CONSTAT DE
 * REPOS là où il n'y a eu aucune mesure, et c'est le défaut qui a coûté la journée du 21 août :
 * croire qu'un travail n'avance pas parce qu'un instrument dit `idle`.
 *
 * Le seul témoin d'activité qui ait tenu est l'ÉCRAN (`esc to interrupt`), que le recensement
 * mesure déjà sous `travailEnVol`. On reprend SA forme, on ne s'en invente pas une seconde.
 */
export function activiteDe(agent) {
  const v = agent?.travailEnVol;
  if (v?.mesure === 'lue') {
    return { mesure: 'lue', enVol: Boolean(v.enVol), source: 'l’écran de l’agent' };
  }
  return {
    mesure: 'non mesurée',
    enVol: null,
    pourquoi:
      v?.raison ??
      'l’écran de cet agent n’a pas été lu. Son état de session ne répond PAS à cette question : ' +
        '« idle » y signifie « vu au registre », jamais « au repos »',
  };
}

/**
 * COMMENT L'ATTEINDRE — le titre de fenêtre D'ABORD, le pane avec sa session ensuite.
 *
 * ⚠️ ADRESSER N'EST PAS COMMANDER (HS-VUE-001) : on rend le moyen d'atteindre, on ne relance
 * ni n'arrête rien.
 *
 * ⚠️ ET UN IDENTIFIANT DE PANE NE VOYAGE JAMAIS SEUL. Mesuré : `w7:p1` vit dans `somtech` ET
 * dans `progex`, avec des agents différents. Une adresse sans sa session envoie le dirigeant
 * chez le mauvais agent — pire qu'une absence d'adresse, parce qu'il s'y fie.
 */
/**
 * QUI PORTE CE CHANTIER, ET D'OÙ ON LE TIENT — le pane, ou le lieu versionné.
 *
 * ⚠️ LES DEUX SONT DES MESURES, ET ELLES NE SE VALENT PAS EN DURÉE. Un pane prouve un porteur
 * MAINTENANT ; un lieu prouve un rattachement qui SURVIT au terminal. La vue dit lequel des deux
 * l'a établi — jamais « l'agent X », sans dire d'où ce nom vient.
 */
export function porteurDuPane(carte) {
  return { mesure: 'lue', source: 'un pane vivant, dont le chemin de travail porte ce mandat', agents: [carte] };
}

/** Le porteur établi par le LIEU seul — durable, et il ne nomme aucun agent. */
export function porteurDuLieu(chemins) {
  return {
    mesure: 'lue',
    source: 'le lieu versionné de l’orchestrateur — le registre, pas un terminal',
    // ⚠️ AUCUN NOM D'AGENT N'EST INVENTÉ ICI. Un lieu nomme un RÔLE et un MANDAT, jamais une
    // personne : deviner le nom depuis le mandat referait le geste que `nomDeLAgent` interdit
    // — un nom plausible fait écrire à quelqu'un qui n'existe pas.
    agents: [],
    lieux: chemins,
  };
}

export function nomDeSession(session) {
  const s = String(session ?? '').trim();
  if (!s) return null;
  // ⚠️ CE QUE LE RECENSEMENT PORTE EST UN CHEMIN DE SOCKET, PAS UN NOM — et ce défaut n'est
  // sorti qu'en EXERÇANT la chaîne réelle. Le banc passait : son double écrivait `'somtech'`
  // là où la source rend
  // `/Users/…/.config/herdr/sessions/somtech/herdr.sock`. Le dirigeant aurait lu, sur chacune
  // des lignes de son parc, un chemin de quatre-vingts caractères au lieu du mot `somtech` —
  // c'est-à-dire exactement l'illisibilité que EF-VUE-006 existe pour fermer.
  const m = /(?:^|\/)sessions\/([^/]+)\//.exec(s);
  return m ? m[1] : s;
}

export function adresseDe(carte, presence) {
  if (presence?.vivant === true && carte?.pane) {
    return {
      mesure: 'lue',
      titre: carte.titre ?? null,
      pane: carte.pane,
      // Le NOM de la session, celui qu'on tape ; le chemin brut reste à côté pour qui outille.
      session: nomDeSession(carte.session),
      sessionBrute: carte.session ?? null,
    };
  }
  return {
    mesure: 'aucune',
    titre: null,
    pane: null,
    session: null,
    sessionBrute: null,
    // ⚠️ AUCUN IDENTIFIANT PÉRIMÉ N'EST LAISSÉ EN PLACE (T-20260822-0017, 2ᵉ G/W/T) : un pane
    // qui n'existe plus se lit comme une adresse, et le dirigeant y écrit.
    pourquoi:
      presence?.vivant === null
        ? 'aucun terminal vivant ne porte ce mandat parmi ceux qu’on a pu voir — et on n’a pas pu tous les voir'
        : 'aucun terminal vivant ne porte ce mandat',
  };
}

/**
 * QUI PORTE CE CODE — les deux étages, dans l'ordre, et jamais l'un pour l'autre.
 *
 * @param code     le code de chantier de la ligne (`E-20260822-0002`), en majuscules.
 * @param parMandat  `Map<code, agent[]>` — l'étage 1.
 * @param parNom     `Map<code, agent[]>` — l'étage 2.
 *
 * ⚠️ UNE LISTE, JAMAIS UN AGENT. Deux agents peuvent porter le même mandat — mesuré :
 * `w8W:p1` et `w8W:p2` portent tous deux `p-20260820-0001`, et aucun des deux n'a de nom.
 * Rendre le premier en écartant le second choisirait, et choisir ici c'est mentir : rien dans
 * la mesure ne départage les deux.
 */
export function quiPorte(code, parMandat, parNom) {
  const portes = parMandat.get(code);
  if (portes?.length) {
    return {
      mesure: 'lue',
      source: 'le mandat lu au lieu de l’agent',
      agents: portes.map(carteDe),
    };
  }
  const pistes = parNom.get(code);
  if (pistes?.length) {
    return {
      mesure: 'non établi',
      pourquoi:
        'aucun agent vivant ne porte ce code comme mandat lu à son lieu — un chef d’équipe ' +
        'n’a aujourd’hui aucun lieu où le lire (T-20260822-0018)',
      indices: pistes.map(carteDe),
      phraseDeLIndice: PHRASE_DE_LINDICE,
    };
  }
  return {
    mesure: 'non établi',
    pourquoi: 'aucun agent vivant ne porte ce code, ni comme mandat lu à son lieu, ni comme nom',
    indices: [],
  };
}

/**
 * LE LECTEUR DE CHANTIER RÉEL — projet → epics → stories, en trois appels par chantier.
 *
 * ⚠️ LA STRUCTURE NE SE DEVINE PAS, ELLE SE LIT : `projects` (ou `demands`/`deliveries` selon
 * la famille du code) → `epics` filtrés par `project_id` → `tickets` filtrés par `epic_id`.
 *
 * 🔴 DEUX PIÈGES D'OUTILLAGE VÉRIFIÉS, ET LE SECOND EST SILENCIEUX :
 *   • `tickets` action `list` **ACCEPTE `delivery_id` ET L'IGNORE** — on récupère la base
 *     entière, d'autres applications comprises, SANS erreur ni avertissement. D'où la règle
 *     appliquée ici : **on vérifie que le filtre a filtré.** Tout ticket dont l'`epic_id` ne
 *     correspond pas à l'epic demandé est écarté, et l'écart est rendu plutôt que tu.
 *   • `deliveries` action `get` **exige l'UUID**, pas le code `J-…` — contrairement à
 *     `projects`. On passe donc par la liste, comme le fait déjà `accesServiceDesk`.
 *
 * @param appeler  `(nom, args) → corps` — le transport, INJECTÉ. Sans lui, pas de lecteur :
 *                 on rend `null`, et la vue dit « aucun accès » au lieu d'inventer un parc vide.
 */
export function lecteurDeChantier({ appeler = transportServiceDesk(), limite = 200 } = {}) {
  if (typeof appeler !== 'function') return null;

  return async (code) => {
    const famille = familleDuMandat(code);
    if (!famille) throw new Error(`« ${code} » n’est pas un code de chantier`);

    // ═══ LE CHANTIER LUI-MÊME — par la liste, jamais par `get` seul (voir l'en-tête).
    const corps = await appeler(famille, { action: 'list', limit: limite });
    const liste = Object.values(corps || {}).find((v) => Array.isArray(v)) || [];
    const champ = CHAMP_DU_CODE[famille];
    const chantier = liste.find((x) => x?.[champ] === code);
    if (!chantier) {
      throw new Error(
        `${code} ne figure pas dans les ${liste.length} ${famille} lus` +
          (liste.length >= limite ? ` — et cette liste est PLAFONNÉE à ${limite} : il est peut-être juste derrière` : '')
      );
    }

    // ═══ SES EPICS — le filtre côté service, PUIS vérifié côté nous.
    // 🔴 LE CHAMP DE JOINTURE DÉPEND DE LA FAMILLE DU CHANTIER — il était câblé en dur sur
    // `project_id`, et l'en-tête de cette fonction revendiquait pourtant le support de
    // `demands` et `deliveries`. L'outil `epics` expose TROIS filtres parents distincts, jamais
    // interchangeables : `project_id`, `demand_id`, `delivery_id`.
    //
    // MESURÉ SUR UN CAS RÉEL DU POSTE, pas construit : l'orchestrateur `batiscan` porte le
    // mandat `J-20260814-0002`, une LIVRAISON. Interrogée par `project_id` — ce que ce code
    // faisait — elle rend **0 epic**. Par `delivery_id`, elle en rend **1**. La vue affichait
    // donc « aucun epic — mesuré, pas un trou » pour un chantier qui en portait un, et
    // `epicsEcartes` restait à 0 : le filtre demandé avait bien « filtré », sans intrus, donc
    // aucun signal ne s'allumait. **Doublement silencieux.**
    //
    // ⚠️ Tout orchestrateur au mandat `D-…` ou `J-…` voyait son parc amputé à zéro. C'est
    // RA-VUE-003 violée sans qu'aucune garde du module ne puisse le savoir.
    const CHAMP_PARENT = { projects: 'project_id', demands: 'demand_id', deliveries: 'delivery_id' };
    const champParent = CHAMP_PARENT[famille];
    if (!champParent) {
      // ⚠️ ON NE DEVINE PAS. Un mandat dont la famille est `epics` ou `tickets` n'a pas d'epics
      // « en dessous » au sens de cette vue : se rabattre sur `project_id` rendrait une liste
      // sans rapport, avec l'apparence d'une mesure.
      throw new Error(
        `un mandat de la famille « ${famille} » ne porte pas d’epics : je ne sais pas quoi lire sous ${code}`
      );
    }
    const corpsEpics = await appeler('epics', { action: 'list', [champParent]: chantier.id, limit: limite });
    const tousEpics = Object.values(corpsEpics || {}).find((v) => Array.isArray(v)) || [];
    // 🔴 ON VÉRIFIE QUE LE FILTRE A FILTRÉ. Un filtre ignoré rend la base entière : sans ce
    // second tamis, la vue rattacherait à cet orchestrateur les epics de TOUTES les
    // applications, et chacun aurait l'air d'un fait mesuré.
    const epics = tousEpics.filter((e) => e?.[champParent] === chantier.id);
    const epicsEcartes = tousEpics.length - epics.length;
    // ⚠️ DEUX PANNES DE FILTRE, PAS UNE — et une seule était dite. `epicsEcartes` compte les
    // INTRUS (le service a rendu trop) ; il ne dit rien des MANQUANTS (le service a rendu une
    // page pleine, et les epics de ce chantier peuvent continuer derrière). Un `epicsEcartes: 0`
    // sur une liste plafonnée se lit « rien n'a été écarté », alors qu'il manque peut-être la
    // moitié du chantier. La troncature est déjà dite un étage plus haut, pour la recherche du
    // chantier : ne pas la dire ici était la même incohérence, dans le même fichier.
    const epicsPlafonnes = tousEpics.length >= limite;

    const avecStories = [];
    for (const e of epics) {
      let stories = [];
      let storiesLues = true;
      let storiesPlafonnees = false;
      let storiesEcartees = 0;
      try {
        // 🔴 ON DEMANDE `epic_id`, ET C'EST UNE MESURE, PAS UNE SUPPOSITION. Ce code lisait
        // TOUTE la base de tickets sans filtre, puis retamisait — parce que le brief du lot
        // avertissait que `tickets` action `list` « accepte `delivery_id` et l'IGNORE ». J'ai
        // généralisé cet avertissement d'UN champ à TOUS les champs sans le vérifier.
        //
        // MESURÉ le 2026-08-22 contre le service réel : `epic_id` EST honoré — `limit: 5` sans
        // filtre rend 5 tickets dont 0 de l'epic et `count: 6510` ; avec `epic_id`, il rend 3
        // tickets, les 3 bons, et `count: 3`.
        //
        // ⚠️ CE QUE LA GÉNÉRALISATION COÛTAIT, ET C'ÉTAIT ÉNORME : avec 6510 tickets en base et
        // une page de 200, les stories d'un epic ne tombaient dans la page QUE par chance. Elles
        // sortaient donc `[]` — indiscernable de « cet epic n'a aucune story ». Le travail
        // d'agents entiers disparaissait de la vue, en silence, sur le chemin le plus fréquenté.
        const corpsT = await appeler('tickets', { action: 'list', epic_id: e.id, limit: limite });
        const tous = Object.values(corpsT || {}).find((v) => Array.isArray(v)) || [];
        // ⚠️ ON DEMANDE LE FILTRE **ET** ON VÉRIFIE QU'IL A FILTRÉ. Les deux : un service peut
        // cesser de l'honorer demain, comme il le fait déjà pour `delivery_id`.
        //
        // ⚠️ ET LE PLAFOND SE DIT ICI AUSSI — c'est le jumeau de `epicsPlafonnes`, un étage plus
        // bas, et il manquait. Une page pleine veut dire « il en manque peut-être », jamais
        // « il n'y en a pas d'autre » : sans ce signal, une story tombée hors page se rend
        // exactement comme un epic qui n'en a aucune.
        storiesPlafonnees = tous.length >= limite;
        // Idem : `tickets` list n'honore pas tous ses filtres. On tamise sur `epic_id`.
        stories = tous.filter((t) => t?.epic_id === e.id);
        // ⚠️ ET L'ÉCART SE COMPTE ICI AUSSI. Le retamisage existait déjà à cet étage, mais son
        // RÉSULTAT n'était mesuré nulle part — alors que le principe posé plus bas dit « un
        // filtre qui n'a pas filtré est un FAIT, pas un détail d'implémentation ». La donnée
        // était protégée ; le signal qui l'aurait dit était muet. Le jour où le service cesse
        // d'honorer `epic_id` — comme il le fait déjà pour `delivery_id` — personne ne
        // l'apprendrait. Troisième fois que ce jumeau reste en arrière : on le ferme.
        storiesEcartees = tous.length - stories.length;
      } catch {
        // ⚠️ « pas pu lire les stories » ≠ « cet epic n'a pas de story ». Une liste vide ici
        // ferait disparaître le travail d'un agent sans que rien ne le dise.
        storiesLues = false;
      }
      avecStories.push({
        code: e?.epic_id ?? null,
        titre: e?.title ?? null,
        statut: e?.status ?? null,
        stories: storiesLues
          ? stories.map((t) => ({ code: t?.ticket_id ?? null, titre: t?.title ?? null, statut: t?.status ?? null }))
          : null,
        storiesPlafonnees,
        storiesEcartees,
      });
    }

    return {
      code,
      titre: chantier?.title ?? chantier?.name ?? null,
      statut: chantier?.status ?? null,
      epics: avecStories,
      // L'écart ne disparaît pas : s'il n'est pas nul, le filtre du service n'a pas filtré.
      epicsEcartes,
      // Et la troncature non plus : `true` veut dire « il en manque peut-être », jamais « il
      // n'y en a pas d'autre ». Les deux pannes se disent séparément parce qu'elles appellent
      // des gestes opposés — retamiser d'un côté, lever le plafond de l'autre.
      epicsPlafonnes,
    };
  };
}

/**
 * LE LECTEUR DE LIEUX — le registre DURABLE, celui qui survit à la mort d'un terminal.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE LECTEUR EXISTE, ET CE QU'IL RÉPARE — EF-VUE-007, RA-VUE-002
 *
 * La vue se construisait depuis `recensement.agents`, c'est-à-dire depuis LES PANES VIVANTS.
 * Un chantier dont l'orchestrateur avait fermé son terminal ne perdait pas une colonne : il
 * DISPARAISSAIT, avec ses epics et ses stories.
 *
 * 🔴 MESURÉ À LA MAIN SUR CE POSTE LE 2026-08-22, pas supposé : **15 mandats distincts portent
 * un lieu d'orchestrateur sur le disque**, répartis sur **116 chemins** — le même mandat vivant
 * dans plusieurs worktrees d'un même dépôt. **9 seulement étaient portés par un pane vivant.**
 * Six chantiers étaient donc invisibles, dont un qui porte à lui seul douze lieux.
 *
 * ⚠️ CE N'EST PAS UN SECOND REGISTRE (RA-VUE-004), ET CE N'EST PAS UNE INVENTION DE CE LOT.
 * `roles.js` l'écrit déjà, au sujet des lieux d'orchestrateur : « ces lieux SONT l'inventaire :
 * les lister, c'est voir qui vit ici — aucun registre local ne les recopie ». On les LIT à
 * chaque demande ; rien n'est recopié, rien ne périme.
 *
 * @param racines     où chercher. **Ce lecteur ne devine AUCUNE racine** : un lieu posé hors
 *                    d'elles n'a pas été vu, et la vue le dit plutôt que de présenter une
 *                    tranche du poste comme le poste entier.
 * @param roleDuLieu  `(repertoire) → nom-de-rôle | null` — INJECTÉ. Le rôle s'établit par le
 *                    CONTENU du lieu, jamais par le nom du dossier : un répertoire vide au bon
 *                    nom ne porte aucun métier, et le compter gonflerait la vue de chantiers
 *                    qui n'existent qu'à moitié (T-20260819-0070).
 * @param lister      `(chemin) → nom[]` — les sous-dossiers, ou une exception.
 */
export function lecteurDeLieux({ racines = [], roleDuLieu = roleDuLieuReel, lister = sousDossiers } = {}) {
  return async () => {
    const parMandat = new Map();
    const racinesRefusees = [];
    let racinesLues = 0;

    for (const racine of racines) {
      // ⚠️ LA RACINE ELLE-MÊME D'ABORD. Une racine qu'on ne peut pas lister n'est pas « une
      // racine sans lieu » : c'est une part du poste qu'on n'a PAS REGARDÉE, et les deux
      // appellent des gestes opposés — l'une ne demande rien, l'autre demande d'aller voir.
      try {
        lister(racine);
      } catch (err) {
        racinesRefusees.push({ racine, raison: err?.message || String(err) });
        continue;
      }
      racinesLues += 1;

      for (const nom of rolesConnus()) {
        const dossier = join(racine, roleDe(nom).dossier);
        let candidats;
        try {
          candidats = lister(dossier);
        } catch {
          // ⚠️ ICI, L'ABSENCE EST NORMALE ET NE SE COMPTE PAS : un dépôt sans `.orchestrateur/`
          // n'a rien refusé. La confondre avec un refus noierait les vrais refus dans son bruit
          // — le faux échec d'instrument que ce module a déjà payé une fois.
          continue;
        }
        for (const mandat of candidats) {
          const lieu = join(dossier, mandat);
          // Le rôle s'établit par le fait. Un `roleDuLieu` qui rend autre chose que ce rôle-ci
          // — ou rien — écarte le candidat : on ne compte pas un lieu à demi posé.
          if (roleDuLieu(lieu) !== nom) continue;
          // 🔴 LA CLÉ EST LE MANDAT, JAMAIS LE CHEMIN. Mesuré : 116 chemins pour 15 mandats sur
          // ce poste. Compter des chemins rendrait douze chantiers là où il y en a un, et le
          // dirigeant ne pourrait plus compter ce qu'il lit.
          const cle = `${nom} :: ${cleDuMandat(mandat)}`;
          const vu = parMandat.get(cle);
          if (vu) vu.chemins.push(lieu);
          else parMandat.set(cle, { role: nom, mandat, chemins: [lieu] });
        }
      }
    }

    // ⚠️ ZÉRO RACINE LUE ⇒ ON N'A RIEN MESURÉ, et `entrees: []` affirmerait « j'ai regardé, il
    // n'y en a pas ». C'est la panne de la MESURE, pas l'absence de l'objet : repliée en zéro,
    // elle rendrait un parc amputé avec l'apparence d'un parc complet.
    if (!racinesLues) {
      return {
        mesure: 'refusée',
        raison: racines.length
          ? `aucune des ${racines.length} racine(s) n’a pu être lue : ` +
            racinesRefusees.map((r) => `${r.racine} (${r.raison})`).join(' ; ')
          : 'aucune racine ne m’a été donnée : je n’ai regardé nulle part',
        racines,
        racinesRefusees,
        entrees: null,
      };
    }

    return { mesure: 'lue', racines, racinesRefusees, entrees: [...parMandat.values()] };
  };
}

/** Les sous-DOSSIERS d'un chemin — un fichier au bon nom n'est pas un lieu. */
function sousDossiers(chemin) {
  return readdirSync(chemin, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/**
 * LES RACINES OÙ CE POSTE RANGE SES DÉPÔTS — et ce compte est un PLANCHER, comme tout le reste.
 *
 * ⚠️ ON N'EXPLORE PAS LE DISQUE. Deux emplacements sont la convention écrite du poste : le
 * dépôt principal (`~/GitRepo.nosync/<dépôt>`) et les worktrees ouverts par le lanceur de
 * session (`~/worktrees/<dépôt>/<horodatage>`). Un dépôt rangé ailleurs n'est PAS vu — et c'est
 * précisément pourquoi la vue rend la liste des racines qu'elle a fouillées : sans elle, une
 * absence ne se distinguerait pas d'un lieu hors périmètre.
 */
export function racinesDuPoste({ foyer = homedir(), lister = sousDossiers } = {}) {
  const racines = [];
  const sous = (chemin) => {
    try {
      return lister(chemin);
    } catch {
      return [];
    }
  };
  for (const d of sous(join(foyer, 'GitRepo.nosync'))) racines.push(join(foyer, 'GitRepo.nosync', d));
  const wt = join(foyer, 'worktrees');
  for (const depot of sous(wt)) for (const t of sous(join(wt, depot))) racines.push(join(wt, depot, t));
  return racines;
}

/**
 * LA VUE DU PARC.
 *
 * @param recensement    le rendu de `unRecensement` — `{ agents: [...] | null, borne, … }`.
 *                       ⚠️ `agents: null` veut dire « je n'ai pas su regarder », JAMAIS
 *                       « il n'y a personne » : la vue le relaie tel quel plutôt que de rendre
 *                       un parc vide, parfaitement vert, sur un poste où plus rien n'est mesuré.
 * @param lireChantier   `async (code) → { code, titre, statut, epics: [{ code, titre,
 *                       stories: [{ code, titre }] | null }] }` — INJECTÉ. Aucun appel réseau
 *                       n'est écrit ici : c'est ce qui rend ce module éprouvable sans clé et
 *                       sans service. **Il a le droit de JETER** : un chantier illisible rend
 *                       `epics: null` et sa raison, jamais `epics: []`.
 *
 *                       ⚠️ ET LA MÊME RÈGLE DESCEND D'UN ÉTAGE, jusqu'aux stories : `null` dit
 *                       « je n'ai pas pu les lire », `[]` dit « je les ai lues, il n'y en a
 *                       aucune ». Ce `| null` a été ajouté APRÈS coup — le contrat annonçait un
 *                       tableau nu pendant que le code repliait déjà `null` en `[]`, et c'est
 *                       exactement le motif qu'on se garde ici : la donnée corrigée, la prose
 *                       du même fichier continuant d'affirmer autre chose.
 * @param journaliser    `(message) → void`.
 */
export async function laVueDuParc({
  recensement = null,
  lieux = null,
  lireChantier = null,
  journaliser = () => {},
} = {}) {
  const quand = recensement?.quand ?? null;
  const liste = recensement?.agents;
  const borne = recensement?.borne ?? null;

  // ═══ LE REGISTRE DURABLE — les LIEUX, et c'est lui qui porte le travail (RA-VUE-002).
  //
  // 🔴 LA VUE NE SE CONSTRUIT PLUS DEPUIS LES PANES SEULS, ET C'EST TOUT L'OBJET DE CE LOT.
  // Elle énumérait `recensement.agents` — les terminaux VIVANTS. Un chantier dont
  // l'orchestrateur avait fermé son terminal ne perdait pas une colonne : il DISPARAISSAIT,
  // avec ses epics et ses stories, sans qu'une ligne ne dise qu'il avait existé.
  //
  // ⚠️ CE N'EST PAS UNE CRAINTE, C'EST UN COMPTE — mesuré à la main sur ce poste le 2026-08-22 :
  // **15 mandats distincts portent un lieu d'orchestrateur sur le disque** (sur 116 chemins, le
  // même mandat vivant dans plusieurs worktrees d'un même dépôt) ; **9 seulement sont portés par
  // un pane vivant**. Six chantiers étaient invisibles, dont un qui porte douze lieux.
  //
  // ⚠️ ET CE N'EST PAS UN SECOND REGISTRE (RA-VUE-004) : `roles.js` l'écrit déjà, au sujet des
  // lieux d'orchestrateur — « ces lieux SONT l'inventaire : les lister, c'est voir qui vit ici —
  // aucun registre local ne les recopie ». On les LIT, on n'en recopie aucun.
  const registreDesLieux = lieux
    ? {
        mesure: lieux.mesure ?? 'refusée',
        racines: lieux.racines ?? null,
        ...(lieux.mesure === 'lue' ? {} : { raison: lieux.raison ?? 'le registre des lieux a refusé' }),
      }
    : {
        // ⚠️ « aucun lecteur ne m'a été donné » ≠ « il n'y a aucun lieu ». Sans cette distinction,
        // un câblage manquant rendrait un poste sans chantier avec l'apparence d'une mesure.
        mesure: 'non mesurée',
        racines: null,
        raison: 'aucun lecteur de lieux ne m’a été donné : je n’ai regardé AUCUN lieu versionné',
      };
  const entreesDeLieux = lieux?.mesure === 'lue' && Array.isArray(lieux.entrees) ? lieux.entrees : [];

  // ⚠️ UNE PANNE DE REGISTRE N'EST PAS UN PARC VIDE — la garde du recensement, reprise ici sur
  // son propre objet. Rendre `orchestrateurs: []` afficherait une vue impeccable et déserte.
  if (liste === null || liste === undefined) {
    const raison = recensement?.inventaireRefuse ?? 'le recensement ne m’a rendu aucun agent';
    journaliser(`vue du parc — SANS REGISTRE : ${raison}. Ceci n’est PAS « personne ne travaille ».`);
    return {
      quand,
      registre: { mesure: 'refusé', raison },
      // La borne des lieux traverse MÊME ce refus : ne pas avoir pu mesurer les vivants ne dit
      // rien de ce qu'on a pu lire au disque, et le taire ici ferait croire à un noir complet.
      registreDesLieux,
      orchestrateurs: null,
      horsHierarchie: null,
      panesAmbigus: null,
      resume:
        'je n’ai pas pu mesurer qui est vivant : ' +
        `${raison}. Ce n’est pas « personne ne travaille » — c’est « je n’ai pas su regarder ».`,
      borne: recensement?.borne ?? null,
      regle: REGLE_DE_LA_VUE,
    };
  }

  const agents = Array.isArray(liste) ? liste : [];

  // ═══ LES DEUX INDEX — l'étage 1 et l'étage 2, construits séparément et jamais fusionnés.
  const parMandat = new Map();
  const parNom = new Map();
  for (const a of agents) {
    const m = codePorteEnMandat(a);
    if (m) parMandat.set(m, (parMandat.get(m) ?? []).concat([a]));
    const n = codePorteEnNom(a);
    // ⚠️ UN AGENT PEUT ÊTRE DANS LES DEUX INDEX, et c'est voulu : `w8:p6` se nomme
    // `d-20260813-0005` ET porte ce mandat à son lieu. `quiPorte` consulte l'étage 1 d'abord,
    // donc il sortira comme MESURÉ — l'indice ne le déclassera pas.
    if (n) parNom.set(n, (parNom.get(n) ?? []).concat([a]));
  }

  // ═══ LES IDENTIFIANTS DE PANE AMBIGUS — rendus, jamais fusionnés (T-20260822-0014, 3ᵉ G/W/T).
  //
  // ⚠️ LE DÉNOMINATEUR SE DIT. Ce compte porte sur LES ENTRÉES DE CE RECENSEMENT, et sur elles
  // seules — pas sur le parc. Une mesure d'un autre jour, sur une autre population, en a trouvé
  // un autre nombre ; ce n'est pas contradictoire, ce sont deux ensembles. Un compte sans son
  // ensemble est un fait invérifiable.
  const parPane = new Map();
  for (const a of agents) {
    const p = a?.pane ?? null;
    if (p) parPane.set(p, (parPane.get(p) ?? []).concat([a]));
  }
  const panesAmbigus = [];
  for (const [pane, entrees] of parPane) {
    if (entrees.length > 1) {
      panesAmbigus.push({
        pane,
        entrees: entrees.map((a) => ({ session: a.session ?? null, nom: nomLisible(a) })),
        // Le mot compte : rien ici ne dit que c'est le même agent, et rien ne dit que ce sont
        // deux agents. Les deux sont rendus, et la question reste ouverte parce qu'elle l'est.
        pourquoi:
          'deux entrées portent cet identifiant de pane dans des sessions différentes : elles ' +
          'peuvent être deux agents, ou le même vu deux fois — cela n’a pas été mesuré',
      });
    }
  }

  // ═══ LES ORCHESTRATEURS — la tête de la vue, et l'ordre est celui du registre.
  const orchestrateurs = [];
  const dansUneHierarchie = new Set();
  //
  // 🔴 UNE SEULE FABRIQUE DE LIGNE POUR LES DEUX SOURCES, ET C'EST CE QUI REND LE CRITÈRE
  // DÉCIDANT ATTEIGNABLE. T-20260822-0015 exige que la vue construite SANS AUCUN TERMINAL
  // affiche EXACTEMENT le même travail que la vue construite avec eux. Deux chemins de
  // construction — un pour les vivants, un pour les lieux — divergeraient au premier correctif
  // appliqué d'un seul côté, et le banc qui compare les deux vues serait le seul à le savoir…
  // s'il pensait à comparer ce champ-là. Une seule fabrique, et la divergence est impossible.
  const uneLigne = async ({ mandatBrut, code, commun }) => {

    // ⚠️ UN MANDAT QUI N'EST PAS UN CODE N'EST PAS UNE ERREUR. `matapedia` a pour mandat
    // `matapedia`, `general` a `general` : leur lieu est valide, leur chantier n'est traçable
    // nulle part. On les garde, SANS leur inventer de chantier — et surtout sans chercher le
    // chantier « qui ressemble le plus », qui est le geste que HS-VUE-002 interdit.
    if (!code) {
      return {
        ...commun,
        chantier: {
          mesure: 'non établi',
          code: null,
          pourquoi: `son mandat « ${mandatBrut ?? '—'} » n’est pas un code de chantier : il ne se lit nulle part`,
        },
        epics: null,
      };
    }

    if (typeof lireChantier !== 'function') {
      return {
        ...commun,
        chantier: { mesure: 'non mesurée', code, raison: 'aucun accès au ServiceDesk ne m’a été donné' },
        epics: null,
      };
    }

    let chantier;
    try {
      chantier = await lireChantier(code);
    } catch (err) {
      return {
        ...commun,
        chantier: {
          mesure: 'non mesurée',
          code,
          raison: `le ServiceDesk n’a pas répondu sur ${code} (${err?.message || err})`,
        },
        // ⚠️ `null`, PAS `[]` — « je n'ai pas pu lire ses epics », jamais « il n'en a aucun ».
        epics: null,
      };
    }

    // ⚠️ ICI `[]` EST UNE MESURE, et c'est le 3ᵉ G/W/T de T-20260822-0013 : un orchestrateur
    // dont le chantier ne porte aucun epic APPARAÎT, avec son chantier et rien dessous. Il
    // n'est pas omis — un orchestrateur sans epic n'est pas un orchestrateur absent.
    const epicsLus = Array.isArray(chantier?.epics) ? chantier.epics : [];
    return {
      ...commun,
      chantier: {
        mesure: 'lue',
        code,
        titre: chantier?.titre ?? null,
        statut: chantier?.statut ?? null,
        // 🔴 LE STATUT D'UN CHANTIER EST AFFIRMÉ, PAS MESURÉ — EF-VUE-005, et c'est le défaut
        // qui a coûté la journée du 21 août : croire qu'un travail avance parce qu'il est ÉCRIT
        // qu'il avance. Quelqu'un a posé `in_progress` à un moment ; rien ici ne dit quand, ni
        // que ce soit encore vrai. La vue le rend donc avec sa NATURE collée dessus, jamais nu
        // à côté d'une activité mesurée à l'instant — où il se lirait comme un constat.
        natureDuStatut: 'affirmé',
        // 🔴 L'ÉCART TRAVERSE, IL NE MEURT PAS ICI — et il mourait ici. `lecteurDeChantier`
        // calcule `epicsEcartes` avec soin, en écrivant « l'écart ne disparaît pas » ; cette
        // couche ne recopiait que code/titre/statut, et le chiffre s'évanouissait juste avant
        // l'endroit où il compte : la ligne que lit le dirigeant. Deux étages justes, et la
        // jointure entre eux gardée par personne — la forme même que ce lot a payée deux fois.
        epicsEcartes: chantier?.epicsEcartes ?? 0,
        // 🔴 LE JUMEAU, ET IL EST RESTÉ EN ARRIÈRE UN CYCLE ENTIER. Le commentaire ci-dessus a
        // été écrit pour `epicsEcartes` en nommant DEUX pannes de filtre — les intrus et les
        // manquants — et seul le premier a traversé. `epicsPlafonnes` mourait exactement à la
        // même jointure, dans la même expression, à une ligne près.
        //
        // ⚠️ C'est « une garde posée sur un fichier ne garde pas sa famille », appliqué à un
        // champ : j'avais corrigé le défaut QUE JE VENAIS DE VOIR, pas le défaut POSSIBLE — et
        // son jumeau était nommé dans le commentaire du correctif lui-même.
        epicsPlafonnes: chantier?.epicsPlafonnes ?? false,
      },
      epics: epicsLus.map((e) => {
        const codeEpic = codeDuMandat(e?.code ?? '');
        // ⚠️ `null` TRAVERSE, IL NE SE REPLIE PAS EN `[]` — et ce défaut a bien vécu ici : un
        // `Array.isArray(...) ? ... : []` transformait « je n'ai pas pu lire les stories de cet
        // epic » en « cet epic n'a aucune story ». Le lecteur de chantier prend soin de rendre
        // `stories: null` quand l'appel aux tickets a échoué ; le replier ici jetait ce soin, et
        // faisait disparaître le travail d'un agent sans que rien ne le dise. Même règle qu'un
        // étage plus haut pour `epics`, au même endroit du même objet.
        const stories = Array.isArray(e?.stories) ? e.stories : null;
        return {
          code: e?.code ?? null,
          titre: e?.titre ?? null,
          agent: quiPorte(codeEpic, parMandat, parNom),
          stories:
            stories === null
              ? null
              : stories.map((s) => ({
                  code: s?.code ?? null,
                  titre: s?.titre ?? null,
                  agent: quiPorte(codeDuMandat(s?.code ?? ''), parMandat, parNom),
                })),
          // Le plafond des stories traverse, comme celui des epics : il vient du lecteur, il ne
          // se recalcule pas ici — et il ne meurt pas à cette jointure, contrairement à son
          // jumeau d'un étage plus haut, qui y est resté un cycle entier.
          storiesPlafonnees: e?.storiesPlafonnees ?? false,
          storiesEcartees: e?.storiesEcartees ?? 0,
        };
      }),
    };
  };

  // ═══ SOURCE 1 — LES ORCHESTRATEURS VIVANTS. Un pane porte le mandat : on l'a MESURÉ.
  const mandatsVus = new Set();
  for (const a of agents) {
    if (roleEtabli(a) !== 'orchestrateur') continue;
    dansUneHierarchie.add(cleDeLAgent(a));
    const carte = carteDe(a);
    // ⚠️ CES TROIS FAITS SE CALCULENT UNE FOIS, ET SE POSENT SUR LES QUATRE SORTIES DE LA
    // FABRIQUE. Les recopier à la main sur chacune est la forme exacte du défaut « une porte
    // sur deux » que ce module a déjà payé : trois sorties corrigées, la quatrième oubliée, et
    // rien ne rougit — parce que chaque sortie est atteinte par un cas différent.
    const presence = presenceDe({ vivant: true, borne });
    const adresse = adresseDe(carte, presence);
    const cle = cleDuMandat(a?.mandat);
    if (cle) mandatsVus.add(cle);
    orchestrateurs.push(
      await uneLigne({
        mandatBrut: a?.mandat ?? null,
        code: codePorteEnMandat(a),
        commun: {
          agent: carte,
          porteur: porteurDuPane(carte),
          presence,
          activite: activiteDe(a),
          adresse,
        },
      })
    );
  }

  // ═══ SOURCE 2 — LES LIEUX SANS TERMINAL VIVANT. EF-VUE-007, ET C'EST LE CŒUR DE CE LOT.
  //
  // ⚠️ « SANS TERMINAL VIVANT » SE MESURE SUR LES MANDATS DÉJÀ VUS, PAS SUR LES PANES. Un même
  // mandat vit dans plusieurs worktrees du même dépôt — mesuré : 116 chemins pour 15 mandats.
  // Comparer des CHEMINS ferait apparaître onze fois le chantier dont un seul worktree est
  // ouvert ; c'est le mandat qui identifie le chantier, jamais le dossier qui le porte.
  for (const l of entreesDeLieux) {
    if (l?.role !== 'orchestrateur') continue;
    const cle = cleDuMandat(l?.mandat);
    if (!cle || mandatsVus.has(cle)) continue;
    mandatsVus.add(cle);
    const presence = presenceDe({ vivant: false, borne });
    orchestrateurs.push(
      await uneLigne({
        mandatBrut: l?.mandat ?? null,
        // ⚠️ MÊME RÈGLE QUE POUR UN AGENT : un mandat qui n'est pas un code n'a pas de chantier
        // à chercher. `general` et `essai-metier-rendu` portent des lieux parfaitement valides.
        code: CODE_LISIBLE.test(cle) ? cle : null,
        commun: {
          // ⚠️ `agent: null` DIT UNE CHOSE PRÉCISE : le registre nomme un LIEU, pas une personne.
          // Y mettre le nom que la convention laisse deviner referait le geste que `nomDeLAgent`
          // interdit — un nom plausible fait écrire à quelqu'un qui n'existe pas.
          agent: null,
          porteur: porteurDuLieu(Array.isArray(l?.chemins) ? l.chemins : []),
          presence,
          activite: activiteDe(null),
          adresse: adresseDe(null, presence),
        },
      })
    );
  }

  // ═══ HORS DE TOUTE HIÉRARCHIE D'ORCHESTRATEUR — EF-VUE-004.
  //
  // ⚠️ LA SECTION SE NOMME PAR CE QUI EST MESURÉ, pas par ce qu'on aimerait y voir. « Partenaires
  // transverses » comme étiquette de section affirmerait un rôle pour chacun de ses membres —
  // or, mesuré le 2026-08-22, les quatre agents que l'epic désignait comme partenaires (`w7`,
  // `w1E`, `w7H`, `w87`) ont TOUS `lieu: null`, `mandat: null` et un rôle NON ÉTABLI :
  // « infra-ops » est un NOM D'AGENT, pas un lieu. Ils y figurent — c'est ce qu'exige EF-VUE-004
  // — mais avec leur rôle rendu tel qu'il a été mesuré, c'est-à-dire non établi.
  //
  // ⚠️ ET UN AGENT QUI JOINT DANS UN ARBRE N'EST PAS HORS HIÉRARCHIE, même sans être
  // orchestrateur : le jour où un chef d'équipe aura un lieu, son mandat le fera apparaître sur
  // sa ligne, et l'y remettre ici le compterait deux fois.
  // 🔴 CES DEUX BOUCLES SONT INATTEIGNABLES AUJOURD'HUI, ET C'EST MESURÉ, PAS SUPPOSÉ. Les
  // retirer entièrement ne fait rougir aucun des 899 essais — parce que `quiPorte` ne peut
  // mettre dans `agents` que des entrées de `parMandat`, que `parMandat` n'accepte qu'un mandat
  // qui EST un code de chantier, et que seul le rôle « orchestrateur » en porte un (un
  // représentant a pour mandat un nom de client). Or tous les orchestrateurs sont DÉJÀ dans
  // `dansUneHierarchie`, ajoutés par la boucle du dessus.
  //
  // ⚠️ ON LES GARDE QUAND MÊME, et on dit pourquoi plutôt que de laisser croire qu'elles sont
  // éprouvées : elles s'allumeront le jour où un chef d'équipe aura un lieu où lire son mandat
  // (`T-20260822-0018`) — il portera alors un code sans être orchestrateur, et sans elles il
  // serait compté DEUX fois : une dans l'arbre, une hors hiérarchie.
  //
  // ⚠️ ET LE BANC QUI SEMBLAIT LES GARDER N'EN GARDAIT RIEN : son agent porteur était un
  // orchestrateur, donc déjà dans le Set par l'autre chemin. Il passait pour une raison qui
  // n'était pas la sienne — une garde vacante de plus, trouvée en mutant ce qu'elle prétendait
  // couvrir plutôt qu'en la relisant.
  for (const o of orchestrateurs) {
    for (const e of o.epics ?? []) {
      // ⚠️ ON APPELLE `cleDeLAgent`, ON NE LA RÉÉCRIT PAS — la clé était recomposée à la main
      // ici, deux fois. Changer le séparateur dans la fonction laissait les 25 essais VERTS, et
      // `dansUneHierarchie` aurait cessé silencieusement de reconnaître les agents joints : ils
      // seraient réapparus dans « hors hiérarchie », comptés deux fois. C'est « une porte sur
      // deux », le motif que ce lot dénonce dans `mandat.js` et reproduisait ici.
      for (const c of e.agent?.agents ?? []) dansUneHierarchie.add(cleDeLAgent(c));
      for (const s of e.stories ?? []) {
        for (const c of s.agent?.agents ?? []) dansUneHierarchie.add(cleDeLAgent(c));
      }
    }
  }

  const horsHierarchie = [];
  for (const a of agents) {
    if (dansUneHierarchie.has(cleDeLAgent(a))) continue;
    const r = roleEtabli(a);
    horsHierarchie.push({
      agent: carteDe(a),
      domaine: r
        ? { mesure: 'lu', role: r, valeur: a?.mandat ?? null, lieu: a?.lieu ?? null }
        : {
            mesure: 'non établi',
            role: null,
            // ⚠️ LA RAISON VIENT DU RECENSEMENT, elle n'est pas réécrite ici : c'est lui qui a
            // mesuré, et une seconde formulation finirait par diverger de la première.
            pourquoi:
              a?.role?.pourquoi ??
              'aucun lieu de rôle ne porte cet agent : son domaine ne se lit nulle part',
          },
    });
  }

  const compte = {
    orchestrateurs: orchestrateurs.length,
    horsHierarchie: horsHierarchie.length,
    epicsLus: orchestrateurs.reduce((n, o) => n + (o.epics?.length ?? 0), 0),
    chantiersNonMesures: orchestrateurs.filter((o) => o.chantier.mesure === 'non mesurée').length,
    chantiersNonEtablis: orchestrateurs.filter((o) => o.chantier.mesure === 'non établi').length,
    panesAmbigus: panesAmbigus.length,
    // Ce que ce lot rend visible, chiffré : les chantiers que la vue d'hier perdait entièrement.
    chantiersSansTerminal: orchestrateurs.filter((o) => o.presence?.vivant !== true).length,
    // ⚠️ ET CELUI-CI SE COMPTE À PART : « on n'a pas pu établir » n'est pas « il est parti ».
    presencesNonEtablies: orchestrateurs.filter((o) => o.presence?.vivant === null).length,
    // ⚠️ UN FILTRE QUI N'A PAS FILTRÉ EST UN FAIT, PAS UN DÉTAIL D'IMPLÉMENTATION. S'il n'est
    // pas nul, le ServiceDesk a rendu des epics d'autres chantiers et c'est NOUS qui les avons
    // écartés — le lecteur doit savoir que la garde a servi, sinon personne n'ira voir pourquoi.
    epicsEcartes: orchestrateurs.reduce((n, o) => n + (o.chantier.epicsEcartes ?? 0), 0),
    // Le plafond se compte en CHANTIERS touchés, pas en epics : on ne sait pas combien il en
    // manque — c'est justement ce que « plafonné » veut dire.
    chantiersPlafonnes: orchestrateurs.filter((o) => o.chantier.epicsPlafonnes).length,
    epicsAuxStoriesPlafonnees: orchestrateurs.reduce(
      (n, o) => n + (o.epics ?? []).filter((e) => e.storiesPlafonnees).length,
      0
    ),
    storiesEcartees: orchestrateurs.reduce(
      (n, o) => n + (o.epics ?? []).reduce((m, e) => m + (e.storiesEcartees ?? 0), 0),
      0
    ),
    // ⚠️ LE DÉNOMINATEUR VOYAGE AVEC LE COMPTE. Voir plus haut : un nombre d'ambiguïtés sans
    // l'ensemble sur lequel il a été compté n'est pas vérifiable, et se compare à tort à un
    // autre nombre compté ailleurs.
    entreesComparees: agents.length,
  };

  return {
    quand,
    registre: { mesure: 'lu' },
    // ⚠️ IL TRAVERSE MÊME QUAND TOUT VA BIEN — c'est une BORNE, pas une alarme. Un lieu posé
    // hors des racines qu'on a fouillées n'a pas été vu, et le taire présenterait comme le parc
    // ce qui n'en est qu'une tranche. Même conduite que `borne` pour les sessions muettes.
    registreDesLieux,
    orchestrateurs,
    horsHierarchie,
    panesAmbigus,
    compte,
    resume: resumeDeLaVue(compte, recensement, registreDesLieux),
    // La borne du recensement traverse la vue SANS ÊTRE RÉÉCRITE : le compte reste un PLANCHER,
    // et les sessions muettes restent nommées. Une vue qui perdrait cette borne présenterait
    // comme le parc ce qui n'en est qu'une tranche.
    borne: recensement?.borne ?? null,
    regle: REGLE_DE_LA_VUE,
  };
}

function resumeDeLaVue(compte, recensement, registreDesLieux = null) {
  const muettes = recensement?.borne?.sessionsRefusees?.length ?? 0;
  // ⚠️ UN REGISTRE DE LIEUX QUI N'A PAS ÉTÉ LU NE SE REND PAS COMME « aucun lieu ». C'est la
  // panne de la MESURE, pas l'absence de l'objet : repliée en zéro, elle ferait lire une vue
  // amputée avec l'apparence d'une vue complète — sur un poste où six chantiers sur quinze
  // n'ont aucun terminal vivant, l'amputation vaut la moitié du parc.
  const lieuxMuets = registreDesLieux && registreDesLieux.mesure !== 'lue' ? registreDesLieux : null;
  return (
    `AU MOINS ${compte.orchestrateurs} orchestrateur(s) — ${compte.epicsLus} epic(s) lu(s), ` +
    `${compte.chantiersNonMesures} chantier(s) NON MESURÉ(s), ${compte.chantiersNonEtablis} mandat(s) ` +
    `qui ne sont pas des codes de chantier ; ${compte.horsHierarchie} agent(s) hors de toute ` +
    `hiérarchie d’orchestrateur ; ${compte.panesAmbigus} identifiant(s) de pane ambigu(s) sur ` +
    `${compte.entreesComparees} entrée(s) comparée(s).` +
    // ⚠️ ON NE DIT « 0 écarté » NULLE PART. Un signal répété à chaque ligne cesse d'être un
    // signal : c'est le faux positif symétrique du défaut qu'on vient de fermer, sur la même
    // frontière. Il ne parle QUE quand la garde a réellement servi.
    (compte.epicsEcartes
      ? ` ⚠️ ${compte.epicsEcartes} epic(s) écarté(s) : le ServiceDesk a rendu des epics d’autres ` +
        'chantiers malgré son filtre — ils ont été retamisés ici.'
      : '') +
    // ⚠️ DEUX PANNES, DEUX PHRASES, ET AUCUNE QUAND IL N'Y A RIEN À DIRE. « Écarté » veut dire
    // qu'on a reçu TROP et retamisé ; « plafonné » veut dire qu'on a peut-être reçu TROP PEU et
    // qu'on ne le saura pas d'ici. Les fondre ferait lire une panne pour l'autre, et elles
    // appellent des gestes opposés.
    (compte.chantiersPlafonnes
      ? ` ⚠️ ${compte.chantiersPlafonnes} chantier(s) dont la liste d’epics est PLAFONNÉE : il en ` +
        'manque peut-être, et ce compte-là est un plancher de plus.'
      : '') +
    (compte.epicsAuxStoriesPlafonnees
      ? ` ⚠️ ${compte.epicsAuxStoriesPlafonnees} epic(s) dont la liste de stories est PLAFONNÉE : ` +
        'des stories manquent peut-être sous eux.'
      : '') +
    (compte.storiesEcartees
      ? ` ⚠️ ${compte.storiesEcartees} story(s) écartée(s) : le ServiceDesk a rendu des stories ` +
        'd’autres epics malgré son filtre — elles ont été retamisées ici.'
      : '') +
    (muettes ? ` ⚠️ ${muettes} session(s) herdr n’ont pas répondu : ce compte est amputé d’autant.` : '') +
    (lieuxMuets
      ? ` ⚠️ LES LIEUX N’ONT PAS ÉTÉ LUS (${lieuxMuets.raison}) : un chantier dont plus aucun ` +
        'terminal ne porte le mandat est donc ABSENT de cette vue, et rien d’autre ne le dirait.'
      : '') +
    (compte.chantiersSansTerminal
      ? ` ${compte.chantiersSansTerminal} chantier(s) n’ont AUCUN terminal vivant : ils sont ici ` +
        'parce que leur lieu versionné les porte, pas parce qu’un pane les a montrés.'
      : '')
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE RENDU — et c'est ICI que se joue HS-VUE-002, pas dans la structure.
//
// Le dirigeant lit une LIGNE. Une donnée impeccablement marquée « non établi » qui se rend en
// « E-20260822-0002 · Le recensement … e-20260822-0002 » lui a menti : la colonne de droite se
// lit comme la colonne de droite d'à côté, celle qui est mesurée.

/** Le fragment d'attribution rendu à droite d'une ligne — le mot qui décide vient EN PREMIER. */
export function rendreAttribution(attribution) {
  if (attribution?.mesure === 'lue') {
    // ⚠️ TOUS LES PORTEURS, séparés — jamais le premier seul. Voir `quiPorte`.
    const noms = attribution.agents.map((c) => c.nom ?? `ANONYME (${c.pane ?? '?'})`);
    return noms.join(' + ');
  }
  const indices = attribution?.indices ?? [];
  if (!indices.length) return MOT_NON_ETABLI;
  // ⚠️ CONDITIONS 1 ET 2 DE L'ARBITRAGE, DANS UNE SEULE EXPRESSION, et le banc
  // `la-vue-du-parc-joint-par-le-mandat` mute cette ligne pour le prouver :
  //   — `MOT_NON_ETABLI` est en TÊTE : le mot qui décide est celui qu'on lit en premier ;
  //   — `PHRASE_DE_LINDICE` précède le nom : jamais un nom nu.
  const pistes = indices.map((c) => `${c.nom ?? 'ANONYME'} (${c.pane ?? '?'})`).join(', ');
  return `${MOT_NON_ETABLI} — ${PHRASE_DE_LINDICE} : ${pistes}`;
}

/**
 * COMMENT ON ATTEINT CET AGENT, EN TEXTE — et l'ORDRE est ce qui décide de l'utilité.
 *
 * 🔴 LE TITRE DE FENÊTRE VIENT EN PREMIER (T-20260822-0017). Ce n'est pas une préférence de
 * mise en page : le dirigeant avait reçu le pane, la session, le dossier ET le nom de l'agent,
 * et il a répondu « je trouve pas le pane ». Ce qu'il reconnaît à l'œil, dans une barre
 * d'onglets, c'est le titre. `w7M:p2` ne lui dit rien.
 *
 * ⚠️ ET LE PANE NE VOYAGE JAMAIS SANS SA SESSION. Mesuré : `w7:p1` existe dans `somtech` ET
 * dans `progex`, avec deux agents différents. Un pane nu envoie chez le mauvais.
 */
export function rendreAdresse(adresse) {
  if (adresse?.mesure !== 'lue') {
    return `[aucune adresse : ${adresse?.pourquoi ?? 'son terminal n’a pas pu être atteint'}]`;
  }
  const ou = `${adresse.pane}${adresse.session ? ` @ ${adresse.session}` : ' @ session INCONNUE'}`;
  // ⚠️ « sans titre de fenêtre » PLUTÔT QUE RIEN : mesuré, 3 panes sur 76 n'ont pas la clé, et
  // un blanc à cet endroit se lit comme un oubli de rendu, pas comme un fait.
  return adresse.titre ? `[« ${adresse.titre} » · ${ou}]` : `[${ou} — sans titre de fenêtre]`;
}

/** Le geste que la commande demande au veilleur — écrit UNE fois, ici. */
export const GESTE_DE_LA_VUE = 'vue';

/**
 * CE QUE LA COMMANDE ÉCRIT — texte par défaut, JSON sur demande.
 *
 * 🔴 SORTI DU `bin` POUR ÊTRE ÉPROUVABLE, et c'est une survivante de la campagne des arêtes qui
 * l'exige. Tant que ce choix vivait dans `bin/ligne-directe.js`, le muter — rendre du JSON par
 * défaut — laissait les 889 essais VERTS : le `bin` n'est atteignable que par un vrai
 * lancement, et un vrai lancement sous `node --test` tente de faire naître un veilleur, que la
 * cloison d'essais refuse à juste titre. La couche était donc structurellement non gardée.
 *
 * ⚠️ ET C'EST LA COUCHE OÙ TOUTE LA GARDE SE JOUE. Les trois conditions de l'arbitrage portent
 * sur le RENDU TEXTE — « NON ÉTABLI » avant l'indice, l'indice avec sa phrase. Rendre du JSON
 * par défaut mettrait ces trois conditions hors de portée du seul lecteur qu'elles protègent.
 */
export function ecrireLaVue(vue, args = []) {
  return args.includes('--json') ? `${JSON.stringify(vue, null, 2)}\n` : `${rendreLaVue(vue)}\n`;
}

/**
 * LA VUE, EN TEXTE — ce que le dirigeant lit.
 *
 * Un arbre : l'orchestrateur en tête, ses epics dessous, les stories de chaque epic sous cet
 * epic, et sur CHAQUE ligne le nom de l'agent qui la porte (EF-VUE-003).
 */
export function rendreLaVue(vue) {
  const l = [];

  // 🔴 CE QU'ON A REÇU EST-IL SEULEMENT UNE VUE ? — et ça ne l'était pas toujours. MESURÉ le
  // 2026-08-22 en tapant la commande pour de vrai : le veilleur en vie ne connaissait pas le
  // geste et rendait `{ ok: false, erreur: 'geste inconnu : vue' }`. Cet objet traversait
  // `rendreLaVue` sans résistance — `vue.orchestrateurs ?? []` — et sortait une vue
  // PARFAITEMENT MISE EN PAGE ET PARFAITEMENT VIDE : un en-tête, deux titres de section, et
  // le néant. Le dirigeant y lit « personne ne travaille » ; la vérité est que personne n'a
  // REGARDÉ.
  //
  // ⚠️ C'est mot pour mot le défaut que ce module dit combattre — il le gardait à l'intérieur
  // de `laVueDuParc` (`agents: null` → registre refusé) et pas à SA PORTE. La garde ne
  // s'appliquait qu'aux objets que la vue avait elle-même construits, jamais à ceux qui lui
  // arrivaient d'ailleurs : la jointure entre le veilleur et le rendu n'appartenait à aucun
  // des deux, donc personne ne la gardait.
  //
  // ⚠️ ET ELLE NE SE MUTE PAS, ELLE S'EXERCE. Cette arête traverse un PROCESSUS : aucune
  // mutation du dépôt ne pouvait la révéler, parce que le code des deux côtés était juste.
  // Il a fallu TAPER LA COMMANDE.
  if (!vue || typeof vue !== 'object' || !('registre' in vue)) {
    const cause = vue?.erreur ?? vue?.raison ?? 'ce qui a été reçu n’est pas une vue du parc';
    // ⚠️ UN REFUS DIT CE QU'IL FAUT FAIRE, PAS SEULEMENT QU'IL REFUSE. « geste inconnu » tout
    // seul envoie chercher une panne de code — alors que le code est juste des deux côtés.
    // Ce refus-là signifie UNE chose précise et actionnable : le PROCESSUS en vie porte un code
    // plus ancien que celui qui est installé sur le disque. Sans cette phrase, le lecteur
    // diagnostique un défaut qui n'existe pas — le faux échec d'instrument que ce même module
    // a déjà corrigé une fois aujourd'hui, sur les epics d'un mandat non-code.
    const gesteInconnu = /geste inconnu/i.test(String(cause));
    return [
      'LA VUE DU PARC — REFUSÉE',
      '',
      `je n’ai pas obtenu de vue : ${cause}.`,
      '',
      'Ce n’est PAS « personne ne travaille » — c’est « je n’ai pas su regarder ».',
      ...(gesteInconnu
        ? [
            '',
            'CE QUE CE REFUS SIGNIFIE : le code de ce geste n’a pas atteint le processus qui ' +
              'répond. Le module n’est PAS en cause — inutile d’y chercher une panne.',
            '',
            // 🔴 DEUX CAUSES, ET ON NE CHOISIT PAS. La première version de ce message
            // n'affirmait QUE le veilleur périmé — la cause vue une fois, un matin, et retenue
            // comme si elle était la seule. Mesuré ensuite : le geste n'était installé NULLE
            // PART (ni dans le paquet du poste, ni sur la branche principale), et le processus,
            // lui, était tout neuf. Le message envoyait donc recharger un veilleur à jour.
            //
            // ⚠️ C'est RA-VUE-003 retournée contre son propre auteur : l'absence se MONTRE, elle
            // ne se comble pas. Ne pas savoir laquelle des deux causes s'applique est un fait —
            // et un fait se dit. Choisir la plus plausible, c'est exactement le geste que ce
            // module interdit partout ailleurs.
            'DEUX CAUSES LE PRODUISENT, et d’ici on ne peut pas les départager :',
            '  ① le geste n’est installé NULLE PART — il vit encore sur une branche, pas dans le ' +
              'paquet du poste. → il faut le livrer, puis l’installer.',
            '  ② le geste est installé, mais le PROCESSUS en vie porte un code plus ancien. ' +
              'Fusionné ≠ publié ≠ installé ≠ RECHARGÉ — le dernier maillon est un processus, et ' +
              'il ne se recharge pas tout seul. → il faut le faire recharger.',
            '',
            'POUR TRANCHER : cherchez ce geste dans le code INSTALLÉ du poste. S’il n’y est pas, ' +
              'c’est ①. S’il y est, c’est ②. Et le veilleur sert plusieurs chantiers à la fois : ' +
              'le relever n’est pas un geste qu’on pose seul en passant.',
          ]
        : []),
      '',
      REGLE_DE_LA_VUE,
    ].join('\n');
  }

  if (vue?.registre?.mesure === 'refusé') {
    l.push('LA VUE DU PARC — SANS REGISTRE');
    l.push('');
    l.push(vue.resume);
    l.push('');
    l.push(vue.regle);
    return l.join('\n');
  }

  l.push('LA VUE DU PARC — par orchestrateur, ses epics, leurs stories');
  l.push('');
  l.push(vue.resume);
  l.push('');

  for (const o of vue.orchestrateurs ?? []) {
    // ⚠️ UNE LIGNE SANS AGENT N'EST PAS UNE LIGNE ANONYME. `agent: null` veut dire que le
    // registre nomme un LIEU et pas une personne : « ANONYME » ferait croire à un agent vivant
    // qui aurait omis de se nommer, et enverrait le dirigeant le chercher.
    const nom = o.agent
      ? (o.agent.nom ?? `ANONYME (${o.agent.pane})`)
      : 'SANS TERMINAL — porté par son lieu';
    const c = o.chantier;
    const tete =
      c.mesure === 'lue'
        ? // 🔴 LE STATUT PORTE SA NATURE, COLLÉE À LUI. Rendu nu à côté d'une activité mesurée
          // à l'instant, `in_progress` se lit comme un constat d'avancement — EF-VUE-005, et le
          // défaut exact du 21 août. `affirmé` est le mot qui empêche cette lecture.
          `${c.code}${c.titre ? ` · ${c.titre}` : ''}` +
          (c.statut ? ` [statut ${c.statut} — ${c.natureDuStatut ?? 'affirmé'} par le registre, pas mesuré]` : '')
        : c.mesure === 'non établi'
          ? `chantier ${MOT_NON_ETABLI} — ${c.pourquoi}`
          : `chantier ${c.code} NON MESURÉ — ${c.raison}`;
    l.push(`${nom} — ${tete}   ${rendreAdresse(o.adresse)}`);

    // ⚠️ LA PRÉSENCE ET L'ACTIVITÉ SONT DEUX QUESTIONS, ET AUCUNE DES DEUX N'EST LE STATUT DE
    // SESSION. « il vit » ≠ « il travaille » ≠ « le registre dit que son chantier avance ».
    if (o.presence?.vivant === null) {
      l.push(`     ↳ présence ${MOT_NON_ETABLI} — ${o.presence.pourquoi}`);
    } else if (o.presence?.vivant === false) {
      l.push(`     ↳ ${o.porteur?.lieux?.length ? `porté par le lieu ${o.porteur.lieux[0]}` : 'aucun terminal vivant'} — ${o.presence.source ?? ''}`);
    }
    if (o.activite) {
      l.push(
        o.activite.mesure === 'lue'
          ? `     ↳ activité MESURÉE à l’écran : ${o.activite.enVol ? 'au travail' : 'rien en vol'}`
          : `     ↳ activité NON MESURÉE — ${o.activite.pourquoi}`
      );
    }

    if (o.epics === null) {
      // ⚠️ « pas pu lire » ne se rend PAS comme « il n'y en a aucun ». Sans cette ligne, un
      // chantier illisible aurait l'apparence exacte d'un chantier vide.
      //
      // 🔴 ET `epics: null` RECOUVRE DEUX FAITS DIFFÉRENTS, qu'on ne rend surtout pas pareil —
      // défaut vu sur le rendu RÉEL du poste, jamais par relecture. `matapedia` affichait
      // « ses epics n'ont pas pu être lus », alors que son mandat n'est pas un code : il n'y
      // avait RIEN à lire, aucune lecture n'a échoué, et la phrase envoyait chercher une panne
      // qui n'existe pas. Un faux échec d'instrument coûte plus qu'un silence : il noie les
      // vrais échecs dans son bruit.
      l.push(
        c.mesure === 'non établi'
          ? '  └─ (aucun epic à chercher : son mandat n’est pas un code de chantier)'
          : '  └─ (ses epics n’ont pas pu être lus)'
      );
    } else if (!o.epics.length) {
      l.push('  └─ (aucun epic — mesuré, pas un trou)');
    } else {
      // ⚠️ LE DERNIER D'UNE FRATRIE SE FERME, LES AUTRES SE CONTINUENT. Un arbre où chaque
      // branche porte « └─ » ne dit plus où une fratrie s'arrête : l'œil ne peut plus rattacher
      // une story à son epic quand il y en a plusieurs, et c'est justement la lecture que le
      // dirigeant a demandée. Le trait vertical continue la fratrie de l'orchestrateur.
      o.epics.forEach((e, i) => {
        const dernierEpic = i === o.epics.length - 1;
        // ⚠️ UN CODE ABSENT SE DIT, IL NE SE COERCE PAS. Un ticket sans `ticket_id` rendait
        // « null · titre » en toutes lettres au dirigeant — la coercition JS qui fuit dans un
        // texte destiné à être lu. « (sans code) » dit le même fait sans avoir l'air d'un bogue.
        l.push(`  ${dernierEpic ? '└─' : '├─'} ${e.code ?? '(sans code)'}${e.titre ? ` · ${e.titre}` : ''}   ${rendreAttribution(e.agent)}`);
        const stories = e.stories ?? [];
        stories.forEach((st, j) => {
          const tuyau = dernierEpic ? '   ' : '  │';
          l.push(`${tuyau}    ${j === stories.length - 1 ? '└─' : '├─'} ${st.code ?? '(sans code)'}${st.titre ? ` · ${st.titre}` : ''}   ${rendreAttribution(st.agent)}`);
        });
        // ⚠️ « pas pu lire » ≠ « il n'y en a aucune », JUSQUE SUR UNE STORY. Le lecteur de
        // chantier rend `stories: null` quand l'appel a échoué : le taire ferait passer un epic
        // dont on n'a rien lu pour un epic qui n'a rien.
        if (e.stories === null) l.push(`${dernierEpic ? '   ' : '  │'}    (ses stories n’ont pas pu être lues)`);
        // ⚠️ TROIS ÉTATS, TROIS LIGNES : pas pu lire · lues et plafonnées · lues entièrement.
        // Sans la ligne du milieu, un epic dont la page de stories était pleine se rend
        // exactement comme un epic dont on a tout lu.
        if (e.storiesPlafonnees) {
          l.push(`${dernierEpic ? '   ' : '  │'}    (⚠️ liste de stories PLAFONNÉE : il en manque peut-être)`);
        }
      });
    }
    l.push('');
  }

  l.push('HORS DE TOUTE HIÉRARCHIE D’ORCHESTRATEUR');
  l.push('  (partenaires transverses, et agents dont le rôle n’a pas pu être établi)');
  for (const p of vue.horsHierarchie ?? []) {
    const nom = p.agent.nom ?? `ANONYME (${p.agent.pane})`;
    const d =
      p.domaine.mesure === 'lu'
        ? `${p.domaine.role}${p.domaine.valeur ? ` · ${p.domaine.valeur}` : ''}`
        : `domaine ${MOT_NON_ETABLI} — ${p.domaine.pourquoi}`;
    l.push(`  · ${nom} — ${d}   [${p.agent.pane}]`);
  }

  if (vue.panesAmbigus?.length) {
    l.push('');
    l.push('IDENTIFIANTS DE PANE AMBIGUS — les deux entrées sont rendues, rien ne les fusionne');
    for (const a of vue.panesAmbigus) {
      l.push(`  · ${a.pane} — ${a.entrees.map((e) => `${e.nom ?? 'ANONYME'} @ ${e.session}`).join('  |  ')}`);
    }
  }

  // ⚠️ OÙ L'ON A CHERCHÉ DES LIEUX SE DIT, TOUJOURS — une borne sans son périmètre n'est pas
  // une borne. Un chantier dont le lieu vit hors de ces racines n'a pas été vu, et rien d'autre
  // dans cette page ne pourrait l'apprendre au lecteur.
  if (vue.registreDesLieux) {
    l.push('');
    l.push(
      vue.registreDesLieux.mesure === 'lue'
        ? `LIEUX VERSIONNÉS cherchés dans : ${(vue.registreDesLieux.racines ?? []).join(', ') || '(aucune racine)'}` +
          ' — un lieu posé ailleurs n’a PAS été vu.'
        : `⚠️ LES LIEUX N’ONT PAS ÉTÉ LUS — ${vue.registreDesLieux.raison}. Un chantier dont plus ` +
          'aucun terminal ne porte le mandat est donc ABSENT de cette vue.'
    );
  }

  if (vue.borne?.phrase) {
    l.push('');
    l.push(vue.borne.phrase);
  }
  // ⚠️ LES SESSIONS MUETTES SE NOMMENT AU RENDU, PAS SEULEMENT DANS LA DONNÉE — et c'est un
  // défaut RÉEL que le banc a trouvé, pas une précaution. La borne traversait bien la vue,
  // `sessionsRefusees` était intacte dans l'objet, et le texte que lit le dirigeant n'en disait
  // RIEN : il annonçait un compte amputé sans jamais dire DE QUOI. Nommer les sessions est ce
  // qui rend l'amputation réparable — sans les noms, on sait qu'on ne voit pas tout, et on ne
  // peut rien y faire. C'est la conduite du recensement, et elle ne se relâche pas en changeant
  // de module.
  for (const s of vue.borne?.sessionsRefusees ?? []) {
    l.push(`  · session muette : ${s.session ?? '(sans nom)'}`);
  }
  l.push('');
  l.push(vue.regle);
  return l.join('\n');
}

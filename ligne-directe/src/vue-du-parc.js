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
// **DEUX SOURCES, ET ELLES NE SE VALENT PAS** — RA-VUE-005 AMENDÉE (BRD v0.11.0, 2026-08-25) :
//
//   ① le CODE DU MANDAT que l'agent tient de son LIEU  →  **PROUVÉ**. Il se mesure.
//   ② le champ `assigned_agent` du ticket, rempli à la naissance de l'agent  →  **DÉCLARÉ**.
//      C'est du texte libre : il se rédige, il diverge, il vieillit, et rien ne l'atteste.
//
// 🔴 CE QUI A CHANGÉ, ET POURQUOI — le dirigeant a contesté l'écran du 2026-08-25 : « c'est
// impossible que ce soit ça le résultat, aucun ticket pris par un agent ». Il avait raison, et
// la mesure du même jour le dit : **105 agents vivants, 13 seulement avec un mandat prouvable
// par le lieu, 76 anonymes** — les chefs d'équipe, porteurs réels des tickets, n'ont pas de lieu
// durable et ferment après leurs lots (T-20260822-0018). Joindre par le seul mandat prouvé
// rendait donc un écran de `NON ÉTABLI` sur un parc où **71 tickets sur 200** portaient un nom.
//
// ⚠️ CET EN-TÊTE A DIT LE CONTRAIRE, ET CE TEXTE-LÀ EST PÉRIMÉ : « ce module ne lit
// `assigned_agent` NULLE PART ». Il le lit désormais — et RA-VUE-006 en pose la contrepartie
// stricte : **chaque ligne dit sa source**, un DÉCLARÉ ne se rend jamais comme un PROUVÉ, et un
// écart entre les deux **se montre** au lieu d'être arbitré en silence.
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
//   ÉTAGE 2 — `mesure: 'déclarée'`.  Aucun mandat ne le prouve, mais le REGISTRE porte un nom
//             sur ce travail (`assigned_agent`). Ce n'est pas une mesure : c'est une
//             DÉCLARATION, et le mot `DÉCLARÉ` voyage avec le nom, en tête, toujours.
//   ÉTAGE 3 — `mesure: 'non établi'` + `indices`.  Ni mandat, ni déclaration ; tout au plus un
//             agent porte ce code comme NOM. Ce n'est PAS une jointure : c'est une piste, et le
//             champ continue de dire « non établi ».
//
// ⚠️ ILS NE SE REPLIENT JAMAIS L'UN DANS L'AUTRE, ET L'ÉCART NE SE TRANCHE PAS. Quand l'étage 1
// répond ET que le registre déclare un AUTRE nom, la ligne rend **les deux** et nomme l'écart :
// choisir lequel a raison serait un arbitrage, et la vue n'arbitre rien (RA-VUE-001/006).
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
// ⚠️ IL LIT DEUX SOURCES, PAS UNE — ET LA SECONDE EST SUR LE DISQUE. Depuis E-20260822-0003, il
// lit aussi les LIEUX versionnés des agents (`lecteurDeLieux`), parce que le recensement seul
// ne connaît que les terminaux VIVANTS. Cette lecture est de l'I/O, et elle est INJECTABLE
// comme le reste : `lister` et `roleDuLieu` entrent par paramètre, `racines` aussi, et rien
// n'est deviné. « Éprouvable sans clé et sans service » vaut donc toujours — mais il fallait
// le dire, plutôt que de laisser cet en-tête affirmer une pureté qu'il n'a plus tout à fait.
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
import { plafonner, PLAFOND_SERVICEDESK } from './plafond.js';
import { rolesConnus, role as roleDe } from './roles.js';
import { roleDuLieu as roleDuLieuReel } from './lieu-agent.js';

/** La règle de conduite, écrite une fois, rendue avec la vue. */
export const REGLE_DE_LA_VUE =
  'cette vue LIT et REND : elle joint par le mandat lu au lieu (PROUVÉ) et par le nom déclaré ' +
  'au registre (DÉCLARÉ), sans jamais confondre les deux ni trancher un écart ; elle ne pilote ' +
  'rien, et elle n’écrit nulle part.';

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
 * LES TROIS MOTS QUI DÉCIDENT — RA-VUE-006, ET ILS SE LISENT EN PREMIER, TOUJOURS.
 *
 * 🔴 UN NOM NU EST LE DÉFAUT, PAS LA COMMODITÉ. C'est la leçon déjà payée par
 * `PHRASE_DE_LINDICE` : le lecteur retient le nom et oublie d'où il vient. Trois sources qui
 * se rendraient toutes « nom de l'agent » seraient trois faits différents à l'œil identique —
 * et le seul qui fait foi (le mandat lu au lieu) perdrait tout ce qui le distingue.
 *
 * ⚠️ ILS SONT EN TÊTE DE FRAGMENT, jamais en queue : ce qu'on lit en premier est ce qui décide.
 */
export const MOT_PROUVE = 'PROUVÉ';
export const MOT_DECLARE = 'DÉCLARÉ';
export const MOT_ECART = 'ÉCART';

/**
 * LA PHRASE DU DÉCLARÉ — le jumeau de `PHRASE_DE_LINDICE`, pour la source déclarée.
 *
 * ⚠️ ELLE DIT CE QUI MANQUE, pas seulement d'où ça vient. « déclaré » seul se lit comme un
 * synonyme d'« assigné », donc comme un fait ; « jamais mesuré à un lieu » est la moitié que le
 * dirigeant doit garder en tête quand il agit dessus.
 */
export const PHRASE_DU_DECLARE = 'déclaré au registre à sa naissance, jamais mesuré à un lieu';

/**
 * LA MÊME CHOSE, EN QUATRE MOTS — parce qu'elle se répète sur CHAQUE ligne de l'arbre.
 *
 * ⚠️ ELLE NE S'EFFACE PAS POUR AUTANT, ET C'EST TOUT L'ARBITRAGE. Un nom rendu nu redevient un
 * rattachement en trois relectures (leçon de `PHRASE_DE_LINDICE`) : le qualificatif voyage donc
 * AVEC le nom, sur la même ligne, toujours. Ce qui se raccourcit est sa longueur, jamais sa
 * présence — la version longue vit dans le panneau de détail du TUI, où il y a la place.
 *
 * ⚠️ ET ELLE DIT CE QUI MANQUE, pas d'où ça vient : « déclaré » répété après le mot `DÉCLARÉ`
 * n'apprend rien au lecteur ; « non mesuré à un lieu » est la moitié qu'il doit garder en tête.
 */
export const PHRASE_COURTE_DU_DECLARE = 'non mesuré à un lieu';

/**
 * CE QUE LES DEUX FORMULATIONS DISENT EN COMMUN — et c'est ce qu'une garde COMPTE.
 *
 * 🔴 IL EST NOMMÉ ICI PARCE QU'UNE GARDE A ÉCHOUÉ FAUTE DE LUI (2026-08-25). Le panneau de
 * détail répétait le qualificatif — « non mesuré à un lieu » sur la ligne du porteur, « jamais
 * mesuré à un lieu » dans le bloc « source » : DEUX TEXTES pour UNE idée. Une garde qui
 * comptait l'une des deux phrases ne voyait pas la redondance de l'autre, et la mutation qui
 * ramenait le défaut passait VERTE.
 *
 * ⚠️ CE QUI FATIGUE LE LECTEUR EST DE RELIRE LA MÊME CHOSE, pas de la relire à l'identique.
 * On compte donc ce que les deux partagent — et un banc épingle qu'elles le partagent encore,
 * pour qu'une reformulation ne vide pas la garde en silence.
 */
export const FRAGMENT_DU_QUALIFICATIF = 'mesuré à un lieu';

/** La phrase du prouvé — l'autre moitié de la frontière, dite avec les mêmes mots partout. */
export const PHRASE_DU_PROUVE = 'mandat lu au lieu de l’agent';

/**
 * LA PHRASE DE L'ÉCART — quand les deux sources se contredisent, la vue N'ARBITRE PAS.
 *
 * 🔴 C'EST LA CONTREPARTIE EXACTE DE L'AMENDEMENT. Admettre une seconde source crée un cas
 * neuf : les deux répondent, et pas la même chose. Le repli naturel — garder le prouvé et
 * taire le déclaré — est un ARBITRAGE rendu en silence, et RA-VUE-006 l'interdit : c'est au
 * dirigeant de savoir que le registre dit autre chose que le terrain.
 */
export const PHRASE_DE_LECART =
  'le mandat lu au lieu et le nom déclaré au registre se contredisent — la vue ne tranche pas';

/**
 * DEUX NOMS DÉSIGNENT-ILS LA MÊME PERSONNE ? — comparaison SOBRE, et elle se dit.
 *
 * ⚠️ ON NORMALISE LA CASSE ET LES BORDS, RIEN DE PLUS. Rapprocher `e-20260825-0001` de
 * `e20260825-0001` ou d'un préfixe commun serait deviner une identité — le geste exact que
 * HS-VUE-002 interdit, ici retourné contre la détection d'écart : un faux « pas d'écart » TAIT
 * une contradiction réelle, et c'est plus grave qu'un écart affiché de trop.
 */
export function memeNom(a, b) {
  const n = (x) => (x === null || x === undefined ? '' : String(x).trim().toLowerCase());
  return n(a) !== '' && n(a) === n(b);
}

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
 *
 * 🔴 À LIRE AVANT DE CHERCHER UN DÉFAUT : SUR LE POSTE DE DÉVELOPPEMENT, CETTE VUE NE DIRA
 * JAMAIS « MORT ». Mesuré le 2026-08-22 : **11 sessions herdr sur 14 sont muettes**, donc la
 * branche `vivant: false` est STRUCTURELLEMENT INATTEIGNABLE — les quatre lignes sans terminal
 * du poste sortent toutes en « présence non établie », et c'est le comportement JUSTE.
 *
 * ⚠️ CE N'EST PAS UNE COLONNE CASSÉE, C'EST LA PRUDENCE DE L'INSTRUMENT. Sans cette note, le
 * premier lecteur cherchera pourquoi « mort » est toujours vide et diagnostiquera une panne là
 * où il n'y a qu'un refus de conclure — c'est le FAUX ÉCHEC D'INSTRUMENT que ce module a déjà
 * payé une fois, sur les epics d'un mandat non-code : une absence prise pour une panne. La
 * branche `false` s'allumera le jour où toutes les sessions répondront, et pas avant.
 *
 * ⚠️ ET C'EST POURQUOI LA BRANCHE `false` RESTE ÉPROUVÉE PAR UN BANC plutôt que retirée : elle
 * est inatteignable AUJOURD'HUI, sur CE poste. Un poste dont toutes les sessions répondent la
 * produira, et la retirer parce qu'on ne la voit pas ici serait conclure d'une absence.
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
        // ⚠️ PAR LEUR NOM, PAS PAR LEUR CHEMIN — défaut vu sur le rendu RÉEL du poste, jamais
        // par relecture : onze sessions muettes crachaient onze chemins de socket complets, soit
        // près de neuf cents caractères sur UNE ligne. Une raison qu'on ne peut pas lire ne dit
        // rien : elle a l'apparence d'une explication et la fonction d'un mur.
        `muettes (${muettes.map((r) => nomDeSession(r?.session) ?? 'sans socket').join(', ')}) : des panes existent ` +
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
export function quiPorte(code, parMandat, parNom, declaration = {}) {
  // ⚠️ LA DÉCLARATION ENTRE PAR PARAMÈTRE, ELLE NE SE RELIT PAS ICI. Ce module ne parle à
  // aucun service : le lecteur de chantier a déjà la valeur dans la charge qu'il a reçue, et
  // la faire redescendre coûte ZÉRO appel de plus (condition de fin n°4 de E-20260825-0001).
  const declares = nomsDeclares(declaration);

  const portes = parMandat.get(code);
  if (portes?.length) {
    const agents = portes.map(carteDe);
    // 🔴 L'ÉCART SE MESURE ICI, ET IL NE SE TRANCHE PAS (RA-VUE-006). Le prouvé fait foi sur
    // le RATTACHEMENT ; il ne fait pas taire ce que le registre dit d'autre. Rendre le seul
    // prouvé serait choisir — et le dirigeant ne saurait jamais que son registre le contredit.
    const contredits = declares.filter((d) => !agents.some((a) => memeNom(a.nom, d.nom)));
    return {
      mesure: 'lue',
      source: PHRASE_DU_PROUVE,
      agents,
      ...(contredits.length
        ? { ecart: { declares: contredits, prouves: agents.map((a) => a.nom ?? null), pourquoi: PHRASE_DE_LECART } }
        : {}),
    };
  }

  // ═══ ÉTAGE 2 — LE REGISTRE DÉCLARE UN NOM. Ce n'est pas une mesure, et le mot le dit.
  if (declares.length) {
    const pistesDuNom = parNom.get(code);
    return {
      mesure: 'déclarée',
      source: PHRASE_DU_DECLARE,
      declares,
      // ⚠️ LES PISTES NE DISPARAISSENT PAS SOUS LA DÉCLARATION — deux faits faibles restent
      // deux faits, et les fondre en ferait perdre un. Un agent qui porte ce code comme NOM
      // corrobore la déclaration ; il ne la prouve pas davantage.
      indices: (pistesDuNom ?? []).map(carteDe),
      phraseDeLIndice: PHRASE_DE_LINDICE,
    };
  }

  const pistes = parNom.get(code);
  if (pistes?.length) {
    return {
      mesure: 'non établi',
      pourquoi:
        'aucun agent vivant ne porte ce code comme mandat lu à son lieu, et le registre ne ' +
        'déclare aucun nom sur ce travail — un chef d’équipe n’a aujourd’hui aucun lieu où le ' +
        'lire (T-20260822-0018)',
      indices: pistes.map(carteDe),
      phraseDeLIndice: PHRASE_DE_LINDICE,
    };
  }
  return {
    mesure: 'non établi',
    pourquoi:
      'aucun agent vivant ne porte ce code, ni comme mandat lu à son lieu, ni comme nom, et le ' +
      'registre ne déclare aucun nom sur ce travail',
    indices: [],
  };
}

/**
 * LES NOMS DÉCLARÉS SUR UNE LIGNE — le sien, ET ceux que ses stories déclarent.
 *
 * 🔴 UN EPIC NE PORTE PAS `assigned_agent`, ET C'EST MESURÉ, PAS SUPPOSÉ (2026-08-25) : la
 * charge de `epics` action `list` ne contient PAS la clé — pas « vide », ABSENTE. L'étage epic
 * n'a donc rien à déclarer de lui-même aujourd'hui ; ce qu'il montre vient de ses stories.
 *
 * ⚠️ ET ON N'INVENTE AUCUN AGRÉGAT (contrainte de E-20260825-0001) : deux stories, deux noms
 * = **deux noms rendus**. Ni « le premier », ni « le plus fréquent », ni « plusieurs » — chacun
 * de ces replis choisirait, et choisir ici c'est affirmer ce que personne n'a mesuré.
 *
 * ⚠️ LA PROVENANCE VOYAGE AVEC LE NOM. Un nom venu des stories rendu comme un nom déclaré SUR
 * L'EPIC prêterait à l'epic une déclaration qu'il ne porte pas — la même faute d'un cran plus
 * fine que celle que `MOT_DECLARE` répare.
 */
export function nomsDeclares({ nomDeclare = null, nomsDesStories = [] } = {}) {
  const sortie = [];
  const vus = new Set();
  const ajouter = (nom, dOu) => {
    const n = nom === null || nom === undefined ? '' : String(nom).trim();
    if (!n) return;
    const cle = n.toLowerCase();
    if (vus.has(cle)) return;
    vus.add(cle);
    sortie.push({ nom: n, dOu });
  };
  ajouter(nomDeclare, 'ce ticket');
  for (const n of nomsDesStories ?? []) ajouter(n, 'ses stories');
  return sortie;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LE MANIFESTE DES SIGNAUX — ET IL FERME UN TROU MESURÉ, PAS UN DANGER IMAGINÉ
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Un « signal » est un fait que le LECTEUR DE CHANTIER mesure et que le dirigeant doit lire :
 * un filtre qui n'a pas filtré, une page plafonnée. Chacun traverse QUATRE jointures avant
 * d'atteindre l'œil :
 *
 *   ① lecteur → vue     (recopie)
 *   ② vue → compte      (agrégation)
 *   ③ compte → résumé   (phrase)
 *   ④ résumé → texte    (rendu)
 *
 * 🔴 CE QUE `e-20260822-0002` A MESURÉ SUR LE LOT PRÉCÉDENT, ET QUI EST LA CONDITION DE FIN
 * N°5 DE CET EPIC : il a ajouté un signal NEUF au lecteur, l'a fait traverser ① correctement,
 * et l'a laissé mourir en ②③④. **895 essais VERTS. Il passait.**
 *
 * > La nuance qui tranche, et qu'il a construite lui-même : lancées contre la suite entière,
 * > les mutations de ②③④ SONT attrapées — donc ces jointures ÉTAIENT gardées, mais par des
 * > bancs nommés, pour des signaux CONNUS. **Un signal NEUF est gardé au premier passage et à
 * > nu sur les trois autres.** Leur garde attrape l'oubli de RECOPIE, pas l'oubli
 * > d'AGRÉGATION ni l'oubli de RENDU.
 *
 * ⚠️ ET NOMMER CE DANGER NE SUFFIT PAS — c'est la leçon payée le même jour. Le piège était
 * écrit dans le brief du lot précédent ; son porteur a CODÉ la parade, et personne ne l'a
 * ÉPROUVÉE. On ne se fie donc pas à la vigilance : les jointures ②③④ ne sont plus écrites à la
 * main du tout. **Elles sont DÉRIVÉES de ce tableau.** Déclarer un signal ici le fait traverser
 * les quatre passages ; l'oublier ici le fait rougir au premier essai (garde de complétude).
 *
 * Chaque entrée porte :
 *   • `cle`         — le nom du champ TEL QUE LE LECTEUR LE PRODUIT ;
 *   • `niveau`      — `chantier` ou `epic` : à quel étage il vit ;
 *   • `nature`      — `compte` (on SOMME) ou `drapeau` (on COMPTE les porteurs) ;
 *   • `vide`        — la valeur qui veut dire « rien à signaler » ;
 *   • `cleDuCompte` — son nom dans le compte, qui n'est PAS le même : `epicsPlafonnes` (un
 *                     booléen par chantier) s'agrège en `chantiersPlafonnes` (un nombre de
 *                     chantiers). Confondre les deux ferait lire un nombre d'epics ;
 *   • `phrase(n)`   — ce que le résumé dit QUAND, ET SEULEMENT QUAND, le signal a servi.
 *
 * ⚠️ ON NE DIT « 0 » NULLE PART. Un signal répété à chaque ligne cesse d'être un signal — c'est
 * le faux positif symétrique du défaut qu'on ferme, sur la même frontière.
 */
export const SIGNAUX_DU_LECTEUR = [
  {
    cle: 'epicsEcartes',
    niveau: 'chantier',
    nature: 'compte',
    vide: 0,
    cleDuCompte: 'epicsEcartes',
    phrase: (n) =>
      ` ⚠️ ${n} epic(s) écarté(s) : le ServiceDesk a rendu des epics d’autres chantiers malgré ` +
      'son filtre — ils ont été retamisés ici.',
  },
  {
    cle: 'epicsPlafonnes',
    niveau: 'chantier',
    nature: 'drapeau',
    vide: false,
    // ⚠️ LE NOM CHANGE PARCE QUE L'OBJET CHANGE. On ne sait pas combien d'epics manquent —
    // c'est exactement ce que « plafonné » veut dire — donc on compte des CHANTIERS touchés.
    cleDuCompte: 'chantiersPlafonnes',
    phrase: (n) =>
      ` ⚠️ ${n} chantier(s) dont la liste d’epics est PLAFONNÉE : il en manque peut-être, et ce ` +
      'compte-là est un plancher de plus.',
  },
  {
    cle: 'storiesPlafonnees',
    niveau: 'epic',
    nature: 'drapeau',
    vide: false,
    cleDuCompte: 'epicsAuxStoriesPlafonnees',
    phrase: (n) => ` ⚠️ ${n} epic(s) dont la liste de stories est PLAFONNÉE : des stories manquent peut-être sous eux.`,
  },
  {
    cle: 'storiesEcartees',
    niveau: 'epic',
    nature: 'compte',
    vide: 0,
    cleDuCompte: 'storiesEcartees',
    phrase: (n) =>
      ` ⚠️ ${n} story(s) écartée(s) : le ServiceDesk a rendu des stories d’autres epics malgré ` +
      'son filtre — elles ont été retamisées ici.',
  },
];

/**
 * LES CHAMPS DE STRUCTURE D'UN CHANTIER ET D'UN EPIC — tout le reste EST un signal.
 *
 * ⚠️ CETTE LISTE EST LE DÉNOMINATEUR DE LA GARDE DE COMPLÉTUDE. Elle dit ce qu'un chantier lu
 * porte QUI N'EST PAS un signal ; la garde exige alors que tout autre champ produit par le
 * lecteur figure au manifeste. C'est ce qui rend le trou impossible à rouvrir : on ne peut pas
 * ajouter un champ au lecteur sans le déclarer ici ou là, et l'un des deux le fait traverser.
 */
export const CHAMPS_DE_STRUCTURE = {
  chantier: ['code', 'titre', 'statut', 'application', 'epics'],
  // ⚠️ `nomDeclare` EST STRUCTUREL, PAS UN SIGNAL — il porte une VALEUR du registre, pas le
  // compte d'une panne de lecture. Déclaré ici, il traverse ①②③④ par dérivation, et la garde
  // « aucun champ de structure n'est un FANTÔME » exige que le lecteur continue de le produire.
  epic: ['code', 'titre', 'statut', 'stories', 'nomDeclare'],
  story: ['code', 'titre', 'statut', 'nomDeclare'],
};

/**
 * CE QUI N'EST PAS RECOPIÉ TEL QUEL — le code (posé à part) et l'étage du dessous (imbriqué).
 *
 * 🔴 TOUT LE RESTE TRAVERSE, PAR DÉRIVATION — ET C EST UN TROU MESURÉ QUI SE FERME ICI.
 * `statut` était DÉCLARÉ à ce manifeste depuis le premier jour, et pourtant JETÉ au passage
 * lecteur → vue, aux DEUX étages du dessous. Mesuré le 2026-08-24 sur cet arbre : le retirer
 * du lecteur pour un epic faisait **0 rouge sur 972 essais**.
 *
 * ⚠️ LA CAUSE N'ÉTAIT PAS UN OUBLI, C'ÉTAIT LA FORME DE LA GARDE. La garde de complétude
 * SOUSTRAIT les champs de ce manifeste avant de mesurer — elle dit « déclare-le », jamais
 * « fais-le traverser » ; et la garde de traversée exclut explicitement `epics`, donc ne
 * descend sous aucun étage. Un périmètre déclaré s'y lisait comme un périmètre couvert.
 *
 * ⚠️ ON NE L'ÉLARGIT PAS D'UN CAS, ON LA REND STRUCTURELLE. La recopie est DÉRIVÉE : ajouter
 * un champ de structure le fait traverser tout seul, et rien ne peut plus rester en arrière.
 */
const NON_RECOPIES = { chantier: ['code', 'epics'], epic: ['code', 'stories'], story: ['code'] };

/** Les champs de structure d'un étage qui doivent traverser jusqu'à la vue. */
export function champsQuiTraversent(niveau) {
  return (CHAMPS_DE_STRUCTURE[niveau] ?? []).filter((c) => !(NON_RECOPIES[niveau] ?? []).includes(c));
}

/**
 * ① LECTEUR → VUE, POUR LA STRUCTURE — le jumeau de `recopierLesSignaux`, et il manquait.
 *
 * 🔴 IL POSE AUSSI LA NATURE DU STATUT, AUX TROIS ÉTAGES. Un statut est AFFIRMÉ par le
 * registre, jamais mesuré à l’instant (EF-VUE-005) : rendu nu à côté d’une présence mesurée,
 * il se lit comme un CONSTAT — le défaut qui a coûté la journée du 21 août. La vue le posait
 * à la main sur le chantier seul ; le poser ici le rend impossible à oublier ailleurs.
 */
export function recopierLaStructure(source, niveau) {
  const champs = champsQuiTraversent(niveau);
  const sortie = {};
  for (const c of champs) sortie[c] = source?.[c] ?? null;
  if (champs.includes('statut')) sortie.natureDuStatut = 'affirmé';
  return sortie;
}

/** Les signaux d'un étage donné. */
export function signauxDe(niveau) {
  return SIGNAUX_DU_LECTEUR.filter((s) => s.niveau === niveau);
}

/**
 * ① LECTEUR → VUE — la recopie, DÉRIVÉE du manifeste au lieu d'être écrite à la main.
 *
 * ⚠️ ÉCRITE À LA MAIN, ELLE A DÉJÀ PERDU DEUX SIGNAUX. `epicsEcartes` mourait ici pendant que
 * le lecteur le calculait « avec soin » ; son jumeau `epicsPlafonnes` est resté en arrière UN
 * CYCLE ENTIER, dans la même expression, à une ligne près — nommé dans le commentaire du
 * correctif qui venait de fermer le premier.
 */
export function recopierLesSignaux(source, niveau) {
  const sortie = {};
  for (const s of signauxDe(niveau)) sortie[s.cle] = source?.[s.cle] ?? s.vide;
  return sortie;
}

/**
 * ② VUE → COMPTE — l'agrégation, DÉRIVÉE elle aussi.
 *
 * `compte` (on somme) et `drapeau` (on compte les porteurs) sont deux agrégations différentes,
 * et les confondre ferait lire un nombre pour un autre : « 3 chantiers plafonnés » n'est pas
 * « 3 epics manquants », et personne ne peut le deviner depuis le chiffre seul.
 */
export function compterLesSignaux(orchestrateurs) {
  const compte = {};
  for (const s of SIGNAUX_DU_LECTEUR) {
    let n = 0;
    for (const o of orchestrateurs) {
      const porteurs = s.niveau === 'chantier' ? [o.chantier] : (o.epics ?? []);
      for (const p of porteurs) {
        const v = p?.[s.cle];
        n += s.nature === 'compte' ? Number(v ?? 0) : v ? 1 : 0;
      }
    }
    compte[s.cleDuCompte] = n;
  }
  return compte;
}

/**
 * ③ COMPTE → RÉSUMÉ — les phrases, DÉRIVÉES, et AUCUNE quand le signal n'a pas servi.
 *
 * ⚠️ LE RÉSUMÉ EST LUI-MÊME POUSSÉ DANS LE TEXTE PAR `rendreLaVue` : c'est ce qui fait que ③
 * emporte ④ pour les signaux de chantier. Les signaux d'EPIC ont en plus leur ligne dans
 * l'arbre — et la garde de famille exerce les deux chemins, pas un seul.
 */
export function phrasesDesSignaux(compte) {
  return SIGNAUX_DU_LECTEUR.map((s) => (compte?.[s.cleDuCompte] ? s.phrase(compte[s.cleDuCompte]) : '')).join('');
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LES SIGNAUX DE NIVEAU **LIGNE** — et ce manifeste-ci ferme un trou que le premier laissait
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE QUI A ÉTÉ MESURÉ, ET C'EST LA FORME N°2 DANS LE LOT QUI L'A NOMMÉE. `SIGNAUX_DU_LECTEUR`
 * dérive les quatre passages — mais SEULEMENT pour les signaux qui viennent du lecteur de
 * chantier. Les faits de LIGNE — la présence, l'activité, l'adresse — venaient du recensement,
 * et leur chemin vers le résumé restait **écrit à la main**.
 *
 * Résultat, trouvé par une passe de fond sur ce lot même : `presencesNonEtablies` était
 * **calculé** dans le compte et **jamais poussé** au résumé ni au texte. Le bon signal existait ;
 * il mourait au passage ③. **Un signal qui meurt en chemin, dans le module qui existe pour
 * empêcher ça.** Ces formes ne se neutralisent pas en les connaissant.
 *
 * 🔴 ET LE DÉFAUT QUE CE SILENCE PRODUISAIT ÉTAIT PIRE QUE LE SILENCE. Faute du bon signal, le
 * résumé comptait `vivant !== true` sous l'étiquette « n'ont AUCUN terminal vivant » : il
 * FONDAIT `false` (mesuré) et `null` (non établi), et **affirmait donc une mort qu'on n'avait
 * pas constatée**. Sur ce poste, où 11 sessions sur 14 se taisent, les quatre chantiers sans
 * terminal sont TOUS à `null` : la phrase était fausse pour les quatre. La même sortie portait,
 * à trois lignes d'écart, « n'ont AUCUN terminal vivant » et « ceci n'est PAS son terminal est
 * mort ». C'est la condition de fin n°4 violée **dans la phrase que le dirigeant lit en premier**.
 *
 * Chaque entrée porte :
 *   • `cle`         — son nom ;
 *   • `predicat(o)` — la ligne est-elle « chaude » pour ce signal ? UN SEUL état à la fois :
 *                     deux prédicats qui se recouvrent refondraient ce qu'on vient de séparer ;
 *   • `cleDuCompte` — son nom dans le compte ;
 *   • `phrase(n)`   — ce que le résumé dit, et SEULEMENT quand il a servi.
 */
export const SIGNAUX_DE_LA_LIGNE = [
  {
    cle: 'chantiersSansTerminal',
    // ⚠️ `=== false`, PAS `!== true`. C'était le défaut : `!== true` avale aussi `null`.
    predicat: (o) => o.presence?.vivant === false,
    cleDuCompte: 'chantiersSansTerminal',
    phrase: (n) =>
      ` ${n} chantier(s) n’ont AUCUN terminal vivant — MESURÉ, toutes les sessions ont répondu : ` +
      'ils sont ici parce que leur lieu versionné les porte.',
  },
  {
    cle: 'presencesNonEtablies',
    predicat: (o) => o.presence?.vivant === null,
    cleDuCompte: 'presencesNonEtablies',
    // ⚠️ LA PHRASE DIT CE QU'ELLE EST, ET CE QU'ELLE N'EST PAS. « on n'a pas pu établir » se
    // relit en « ils sont partis » au bout de trois lectures si on ne l'en empêche pas — c'est
    // la même précaution que `PHRASE_DE_LINDICE`, sur un autre fait.
    phrase: (n) =>
      ` ${n} chantier(s) dont on N’A PAS PU ÉTABLIR s’ils ont un terminal vivant — des sessions ` +
      'herdr se sont tues. Ce n’est PAS « leur terminal est mort ».',
  },
];

/**
 * LES COMPTES DE STRUCTURE — le DÉNOMINATEUR de la garde de complétude du compte.
 *
 * ⚠️ ÉPINGLÉ, ET C'EST DÉLIBÉRÉ. Cette liste dit quels chiffres du compte ne sont PAS des
 * signaux ; la garde exige alors que tout autre chiffre soit déclaré à l'un des deux manifestes.
 * C'est ce qui rend impossible de recalculer un `presencesNonEtablies` sans le rendre.
 *
 * 🔴 ET C'EST LE CRITÈRE D'ARRÊT QUI DÉCIDE DE S'ARRÊTER ICI : élargir cette liste pour taire un
 * signal est un geste VISIBLE en revue — le diff dit « j'ai ajouté un nom au dénominateur
 * épinglé », et personne ne signe ça sans le justifier. Ajouter un nom à une liste d'exceptions
 * non épinglée aurait été invisible, et il aurait fallu garder un étage de plus.
 */
export const COMPTES_DE_STRUCTURE = [
  'orchestrateurs',
  'horsHierarchie',
  'epicsLus',
  'chantiersNonMesures',
  'chantiersNonEtablis',
  'panesAmbigus',
  'entreesComparees',
];

/** ② LIGNES → COMPTE — dérivée, comme celle du lecteur. */
export function compterLesSignauxDeLigne(orchestrateurs) {
  const compte = {};
  for (const s of SIGNAUX_DE_LA_LIGNE) {
    compte[s.cleDuCompte] = orchestrateurs.filter((o) => s.predicat(o)).length;
  }
  return compte;
}

/** ③ COMPTE → RÉSUMÉ — dérivée, et muette quand le signal n'a pas servi. */
export function phrasesDesSignauxDeLigne(compte) {
  return SIGNAUX_DE_LA_LIGNE.map((s) => (compte?.[s.cleDuCompte] ? s.phrase(compte[s.cleDuCompte]) : '')).join('');
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
export function lecteurDeChantier({ appeler = transportServiceDesk(), limite = 200, plafond = PLAFOND_SERVICEDESK } = {}) {
  if (typeof appeler !== 'function') return null;

  // ═══ TOUT PASSE PAR LA BORNE, ET C'EST LE SEUL ENDROIT OÙ ELLE EST POSÉE.
  //
  // 🔴 CE LECTEUR EST LA PORTE UNIQUE DE LA VUE VERS LE SERVICEDESK — les applications, la
  // famille du chantier, ses epics, les stories de chaque epic. Border ICI, c'est border TOUT
  // ce que la vue demande au service, quelle que soit la façon dont les étages du dessus
  // choisissent de s'éventer. Le plafond ne se redouble donc jamais plus haut : voir
  // `src/plafond.js`, qui dit pourquoi un second réglage serait un défaut et non une prudence.
  const demander = plafonner(appeler, { plafond });

  // ═══ LES APPLICATIONS — LUES UNE FOIS POUR TOUT LE LECTEUR, jamais par chantier.
  //
  // 🔴 L'APP NE SE DEVINE NI DU NOM NI DU DÉPÔT (D-20260824-0003, point 1). Le dirigeant veut
  // grouper par app ; ranger « au plus plausible » l'enverrait chercher son travail sous une
  // app qui ne le porte pas — pire qu'un groupe d'absence, parce qu'il s'y fierait.
  //
  // ⚠️ LE COÛT EST MESURÉ, ET C EST POURQUOI LA PROMESSE EST MÉMOÏSÉE : UN appel de plus au
  // TOTAL, pas un par chantier. Sur les quinze mandats de ce poste, la différence serait
  // quinze allers-retours ajoutés aux ~70 s déjà mesurées.
  let applications = null;
  const lireLesApplications = () => {
    if (!applications) {
      applications = (async () => {
        try {
          const corps = await demander('applications', { action: 'list' });
          const liste = Object.values(corps || {}).find((v) => Array.isArray(v)) || [];
          return { mesure: 'lue', parId: new Map(liste.map((a) => [a?.id, a?.name ?? null])) };
        } catch (err) {
          // ⚠️ « je n'ai pas pu lire les applications » N'EST PAS « ce chantier n'en a pas ».
          // Les deux se rendraient pareil sous « APP NON ÉTABLIE » si la cause ne voyageait
          // pas — et elles appellent deux gestes opposés : réparer un accès, ou poser une app.
          return {
            mesure: 'refusée',
            raison: 'la liste des applications n’a pas pu être lue (' + (err?.message || err) + ')',
          };
        }
      })();
    }
    return applications;
  };

  // ═══ UN CHANTIER SE LIT UNE FOIS, MÊME QUAND DEUX ORCHESTRATEURS LE PORTENT.
  //
  // 🔴 MESURÉ SUR CE POSTE, PAS CONSTRUIT : le 2026-08-25, `P-20260820-0001` est porté par
  // **deux** orchestrateurs. Le lecteur relisait donc tout le chantier deux fois — sa famille,
  // ses epics, et un `tickets/list` par epic — pour rendre deux fois la même chose.
  //
  // ⚠️ CE N'EST PAS UN CACHE, ET LA NUANCE PORTE TOUT LE LOT (`E-20260824-0011`, hors-lot n°2).
  // Un cache SURVIT à la lecture et resservirait de l'ancien au `r` suivant. Cette mémoire-ci
  // naît avec le lecteur et meurt avec lui : chaque construction de la vue en fabrique un neuf
  // (`veilleur.js`, `construireLecteur()`), donc chaque `r` relit le réel. Elle ne partage
  // qu'À L'INTÉRIEUR d'une même lecture, ce qui est exactement « lu une fois ».
  //
  // ⚠️ ON MÉMORISE LA PROMESSE, PAS SON RÉSULTAT — sans quoi deux porteurs partis en même temps
  // (ce qui est désormais le cas normal) ne se trouveraient ni l'un ni l'autre, et relanceraient
  // chacun la lecture. Et un chantier ILLISIBLE se partage comme un autre : les deux porteurs
  // doivent voir le même refus, pas deux refus mesurés séparément.
  //
  // ⚠️ ET LE PARTAGE N'EST PAS UN DÉDOUBLONNAGE D'AFFICHAGE. Les deux orchestrateurs gardent
  // chacun leur ligne — c'est la réalité du parc, et `laVueDuParc` ne sait même pas que la
  // lecture a été partagée. Un banc le garde.
  const enCours = new Map();

  const lireVraiment = async (code) => {
    const famille = familleDuMandat(code);
    if (!famille) throw new Error(`« ${code} » n’est pas un code de chantier`);

    // ═══ LE CHANTIER LUI-MÊME — par la liste, jamais par `get` seul (voir l'en-tête).
    const corps = await demander(famille, { action: 'list', limit: limite });
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
    const corpsEpics = await demander('epics', { action: 'list', [champParent]: chantier.id, limit: limite });
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

    // ═══ LES STORIES DE CHAQUE EPIC — TOUTES DEMANDÉES DE FRONT, l'ordre rendu intact.
    //
    // 🔴 C'EST ICI QUE LES 65 % PARTAIENT. Mesuré le 2026-08-24 : les `tickets/list` coûtaient
    // **41 s sur 63**, dans une boucle `for` avec un `await` dedans — 91 attentes de ~0,45 s
    // mises bout à bout alors qu'aucune ne dépend de la précédente.
    //
    // ⚠️ `Promise.all` REND DANS L'ORDRE DES ENTRÉES, jamais dans l'ordre des réponses — c'est
    // ce qui rend l'identité au séquentiel atteignable, et c'est ce qu'un banc compare champ à
    // champ. Rien d'autre n'a changé de ce que chaque tour fait : le filtre demandé, le tamis
    // qui vérifie qu'il a filtré, le plafond dit, l'écart compté, et `stories: null` quand
    // l'appel a refusé.
    //
    // ⚠️ ET LE NOMBRE D'APPELS EN VOL N'EST PAS BORNÉ ICI — il l'est sur le transport, une fois
    // pour tout le lecteur (voir `demander` plus haut). Une seconde borne à cet étage
    // s'appliquerait à un objet différent (des epics, pas des appels) tout en portant le même
    // nom, et la mesure faite pour l'une servirait de caution à l'autre.
    const avecStories = await Promise.all(
      epics.map(async (e) => {
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
        const corpsT = await demander('tickets', { action: 'list', epic_id: e.id, limit: limite });
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
      return {
        code: e?.epic_id ?? null,
        titre: e?.title ?? null,
        statut: e?.status ?? null,
        // 🔴 LU DANS LA CHARGE DÉJÀ REÇUE — ZÉRO APPEL HTTP AJOUTÉ, et c'est la condition de
        // fin n°4. Vérifié contre le service RÉEL le 2026-08-25 avant d'écrire une ligne :
        // `tickets` action `list` rend `assigned_agent` sur chaque ticket ; `epics` action
        // `list` ne rend PAS la clé du tout. On lit donc le champ de l'epic pour le jour où il
        // existera — il vaut `null` aujourd'hui — sans jamais aller le chercher ailleurs.
        nomDeclare: e?.assigned_agent ?? null,
        stories: storiesLues
          ? stories.map((t) => ({
              code: t?.ticket_id ?? null,
              titre: t?.title ?? null,
              statut: t?.status ?? null,
              nomDeclare: t?.assigned_agent ?? null,
            }))
          : null,
        storiesPlafonnees,
        storiesEcartees,
      };
      })
    );

    return {
      code,
      titre: chantier?.title ?? chantier?.name ?? null,
      statut: chantier?.status ?? null,
      application: await applicationDe(chantier, lireLesApplications),
      epics: avecStories,
      // L'écart ne disparaît pas : s'il n'est pas nul, le filtre du service n'a pas filtré.
      epicsEcartes,
      // Et la troncature non plus : `true` veut dire « il en manque peut-être », jamais « il
      // n'y en a pas d'autre ». Les deux pannes se disent séparément parce qu'elles appellent
      // des gestes opposés — retamiser d'un côté, lever le plafond de l'autre.
      epicsPlafonnes,
    };
  };

  return (code) => {
    // ⚠️ LA CLÉ EST LE CODE TEL QU'IL A ÉTÉ DEMANDÉ. Deux porteurs du même chantier le
    // demandent par le même code — c'est ce que `cleDuMandat` a déjà normalisé un étage plus
    // haut. Normaliser une seconde fois ici ferait un second réglage de la même chose.
    if (!enCours.has(code)) enCours.set(code, lireVraiment(code));
    return enCours.get(code);
  };
}

/**
 * L'APPLICATION D'UN CHANTIER — LUE, ou dite NON ÉTABLIE avec sa cause.
 *
 * ⚠️ TROIS ABSENCES DIFFÉRENTES, ET ELLES APPELLENT TROIS GESTES OPPOSÉS : le chantier ne
 * porte aucune app (c'est au ServiceDesk qu'on la pose) · la liste n'a pas pu être lue (c'est
 * l'accès qu'on répare) · l'app citée n'est pas dans la liste (c'est un renvoi mort). Les
 * fondre en un « non établie » muet rendrait chacune indiagnosticable.
 */
async function applicationDe(chantier, lireLesApplications) {
  const id = chantier?.application_id ?? null;
  if (!id) {
    return {
      mesure: 'non établie',
      code: null,
      nom: null,
      pourquoi: 'ce chantier ne porte aucune application au ServiceDesk',
    };
  }
  const apps = await lireLesApplications();
  if (apps.mesure !== 'lue') {
    // Le code reste même sans nom : il est le seul fil par lequel on peut aller vérifier.
    return { mesure: 'non établie', code: id, nom: null, pourquoi: apps.raison };
  }
  const nom = apps.parId.get(id);
  if (!nom) {
    return {
      mesure: 'non établie',
      code: id,
      nom: null,
      pourquoi: 'l’application « ' + id + ' » ne figure pas dans les ' + apps.parId.size + ' applications lues',
    };
  }
  return { mesure: 'lue', code: id, nom };
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
 * @param lieux          le rendu de `lecteurDeLieux` — `{ mesure, racines, entrees }` — LE
 *                       REGISTRE DURABLE (EF-VUE-007). C'est lui, et non les panes, qui décide
 *                       de QUELS chantiers figurent : un chantier dont le terminal est mort y
 *                       est encore. `null` veut dire « aucun lecteur ne m'a été donné », et
 *                       `mesure: 'refusée'` veut dire « je n'ai pas pu lire » — jamais l'un
 *                       pour l'autre, et jamais « il n'y a aucun lieu ».
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
        // 🔴 DÉRIVÉ DU MANIFESTE, PLUS ÉCRIT À LA MAIN. Écrite à la main, cette recopie a
        // perdu `statut` aux DEUX étages du dessous pendant que le manifeste le déclarait,
        // et rien ne rougissait : mesuré, 0 rouge sur 972 essais. C’est la dérivation qui
        // ferme le trou, pas la vigilance — la vigilance avait déjà été mise en garde.
        ...recopierLaStructure(chantier, 'chantier'),
        // 🔴 `natureDuStatut` EST POSÉ PAR LA DÉRIVATION, plus à la main ici — et c'est ce qui
        // le fait exister AUSSI sur les epics et les stories. Un statut est AFFIRMÉ par le
        // registre, jamais mesuré à l'instant (EF-VUE-005) : rendu nu à côté d'une présence
        // mesurée, il se lit comme un constat — le défaut qui a coûté la journée du 21 août.
        // Écrit à la main, il ne vivait QUE sur le chantier : le seul étage où quelqu'un y
        // avait pensé. Voir `recopierLaStructure`.
        // 🔴 LES SIGNAUX SE RECOPIENT PAR LE MANIFESTE, PLUS À LA MAIN. Écrite à la main, cette
        // jointure a perdu `epicsEcartes` une fois, puis son jumeau `epicsPlafonnes` un cycle
        // entier plus tard — dans la même expression, à une ligne près, et nommé dans le
        // commentaire du correctif qui venait de fermer le premier. Corriger le défaut VU ne
        // ferme pas le défaut POSSIBLE : c'est la dérivation qui le ferme, pas la vigilance.
        ...recopierLesSignaux(chantier, 'chantier'),
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
        // ⚠️ CE QUE LES STORIES DÉCLARENT MONTE À L'EPIC, ET RIEN D'AUTRE NE MONTE. Pas un
        // compte, pas un « plusieurs », pas le premier : la liste des noms distincts, chacun
        // rendu, chacun marqué comme venant des stories (voir `nomsDeclares`).
        //
        // ⚠️ `stories: null` NE SE REPLIE PAS EN `[]` ICI NON PLUS. « je n'ai pas pu lire ses
        // stories » donnerait alors « aucun nom déclaré sous cet epic » — une absence COMBLÉE,
        // au lieu d'une absence montrée (RA-VUE-003).
        const nomsDesStories = stories === null ? [] : stories.map((s) => s?.nomDeclare ?? null);
        return {
          code: e?.code ?? null,
          ...recopierLaStructure(e, 'epic'),
          agent: quiPorte(codeEpic, parMandat, parNom, { nomDeclare: e?.nomDeclare ?? null, nomsDesStories }),
          stories:
            stories === null
              ? null
              : stories.map((s) => ({
                  code: s?.code ?? null,
                  ...recopierLaStructure(s, 'story'),
                  agent: quiPorte(codeDuMandat(s?.code ?? ''), parMandat, parNom, {
                    nomDeclare: s?.nomDeclare ?? null,
                  }),
                })),
          // Les signaux d'epic traversent par le MÊME manifeste que ceux du chantier : un seul
          // tableau pour les deux étages, donc aucun étage ne peut rester en arrière de l'autre.
          ...recopierLesSignaux(e, 'epic'),
        };
      }),
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // ON CHOISIT LES LIGNES D'ABORD, ON LES LIT ENSUITE — ET CE DÉCOUPAGE EST LA CONDITION DE
  // L'IDENTITÉ AU SÉQUENTIEL, pas un rangement.
  //
  // 🔴 LE CHOIX DES LIGNES EST SÉQUENTIEL PARCE QU'IL PORTE UN ÉTAT QUI SE PROPAGE : `mandatsVus`
  // est rempli par la source 1 et LU par la source 2 (« ce mandat a-t-il déjà un terminal
  // vivant ? »). Choisir en parallèle ferait dépendre le contenu de la vue de l'ordre où les
  // lectures rendent — deux mêmes parcs rendraient deux vues différentes, et le banc d'identité
  // ne s'en apercevrait qu'un jour sur deux.
  //
  // ⚠️ CE CHOIX NE FAIT AUCUNE ENTRÉE-SORTIE. Il lit le recensement et les lieux DÉJÀ en
  // mémoire ; il ne coûte rien à paralléliser et il coûterait la justesse. C'est la LECTURE des
  // chantiers — la seule chose qui parle au ServiceDesk — qui part de front, juste après, dans
  // l'ordre exact où le choix les a rangés.
  const aLire = [];
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
    aLire.push({
      mandatBrut: a?.mandat ?? null,
      code: codePorteEnMandat(a),
      commun: {
        agent: carte,
        porteur: porteurDuPane(carte),
        presence,
        activite: activiteDe(a),
        adresse,
      },
    });
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
    aLire.push({
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
    });
  }

  // ═══ ET MAINTENANT LES LIGNES SE LISENT, TOUTES DE FRONT.
  //
  // ⚠️ `Promise.all` REND DANS L'ORDRE DES ENTRÉES, jamais dans celui des réponses : la vue
  // garde l'ordre du registre — les vivants d'abord, les lieux sans terminal ensuite — quelle
  // que soit la vitesse à laquelle le ServiceDesk répond sur chacun.
  //
  // ⚠️ ET LE NOMBRE D'APPELS EN VOL RESTE BORNÉ, sans qu'un plafond soit posé ici : chaque
  // ligne passe par le `lireChantier` qu'on lui a donné, et c'est LUI qui borne (voir
  // `lecteurDeChantier` et `src/plafond.js`). Poser une seconde borne à cet étage compterait
  // des LIGNES là où la mesure a compté des APPELS — même mot, autre objet.
  const orchestrateurs = await Promise.all(aLire.map((c) => uneLigne(c)));

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
    // 🔴 LES CHIFFRES DE LIGNE SONT DÉRIVÉS EUX AUSSI. Écrits à la main ici, ils ont produit le
    // défaut le plus grave du lot : `chantiersSansTerminal` comptait `vivant !== true`, donc il
    // FONDAIT « mesuré, aucun terminal » et « on n'a pas pu établir » — et le résumé affirmait
    // une mort qu'on n'avait pas constatée. Et `presencesNonEtablies`, le signal qui aurait dit
    // le vrai, était calculé et n'atteignait NI le résumé NI le texte.
    ...compterLesSignauxDeLigne(orchestrateurs),
    // 🔴 LES QUATRE AGRÉGATIONS SONT DÉRIVÉES DU MANIFESTE. Écrites à la main, elles étaient
    // la SECONDE des quatre jointures qu'un signal neuf devait franchir — et celle où il
    // mourait le plus silencieusement : un signal recopié dans la vue mais jamais agrégé
    // n'apparaît nulle part, et aucun banc nommé pour un signal CONNU ne peut le savoir.
    ...compterLesSignaux(orchestrateurs),
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
    // 🔴 LES PHRASES SONT DÉRIVÉES DU MANIFESTE — troisième jointure, fermée par construction.
    // Chacune ne parle QUE quand son signal a servi : « 0 écarté » répété à chaque ligne cesse
    // d'être un signal, et c'est le faux positif symétrique du défaut qu'on ferme, sur la même
    // frontière. Le résumé est ensuite poussé tel quel dans le texte par `rendreLaVue` : c'est
    // ce qui fait que la troisième jointure emporte la quatrième.
    phrasesDesSignaux(compte) +
    (muettes ? ` ⚠️ ${muettes} session(s) herdr n’ont pas répondu : ce compte est amputé d’autant.` : '') +
    (lieuxMuets
      ? ` ⚠️ LES LIEUX N’ONT PAS ÉTÉ LUS (${lieuxMuets.raison}) : un chantier dont plus aucun ` +
        'terminal ne porte le mandat est donc ABSENT de cette vue, et rien d’autre ne le dirait.'
      : '') +
    // 🔴 DÉRIVÉES, comme celles du lecteur — et il y en a maintenant DEUX là où une seule phrase
    // à la main confondait les deux états. Voir `SIGNAUX_DE_LA_LIGNE`.
    phrasesDesSignauxDeLigne(compte)
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE RENDU — et c'est ICI que se joue HS-VUE-002, pas dans la structure.
//
// Le dirigeant lit une LIGNE. Une donnée impeccablement marquée « non établi » qui se rend en
// « E-20260822-0002 · Le recensement … e-20260822-0002 » lui a menti : la colonne de droite se
// lit comme la colonne de droite d'à côté, celle qui est mesurée.

/**
 * Le fragment d'attribution rendu à droite d'une ligne — le mot qui décide vient EN PREMIER.
 *
 * 🔴 LES TROIS ÉTATS SE LISENT DIFFÉREMMENT À L'ŒIL, et c'est la condition de fin n°3 de
 * E-20260825-0001. `PROUVÉ`, `DÉCLARÉ` et `NON ÉTABLI` ouvrent chacun leur fragment : le
 * dirigeant lit une LIGNE dans une colonne, pas un champ JSON, et deux sources qui se rendraient
 * toutes deux « un nom » seraient indiscernables — exactement HS-VUE-002, sur la source cette
 * fois plutôt que sur le lien.
 */
export function rendreAttribution(attribution) {
  if (attribution?.mesure === 'lue') {
    // ⚠️ TOUS LES PORTEURS, séparés — jamais le premier seul. Voir `quiPorte`.
    const noms = attribution.agents.map((c) => c.nom ?? `ANONYME (${c.pane ?? '?'})`);
    const base = `${MOT_PROUVE} : ${noms.join(' + ')}`;
    // 🔴 L'ÉCART SE REND SUR LA MÊME LIGNE, jamais dans un repli qu'il faut aller ouvrir. Le
    // taire ici reviendrait à arbitrer au rendu ce que la donnée refuse d'arbitrer.
    const ecart = attribution.ecart;
    if (!ecart?.declares?.length) return base;
    const dits = ecart.declares.map((d) => `« ${d.nom} » (${d.dOu})`).join(', ');
    return `${base}   ${MOT_ECART} — ${ecart.pourquoi} : le registre déclare ${dits}`;
  }
  if (attribution?.mesure === 'déclarée') {
    // ⚠️ LE MOT EN TÊTE, SA PHRASE ENSUITE, LE NOM EN DERNIER — l'ordre est la garde. Un nom
    // en tête se retient ; le doute qui le suit s'oublie en trois relectures. C'est la
    // condition 2 de l'arbitrage du 22 août, appliquée à la source déclarée.
    const dits = (attribution.declares ?? [])
      .map((d) => `${d.nom} (${d.dOu})`)
      .join(' + ');
    return `${MOT_DECLARE} (${PHRASE_COURTE_DU_DECLARE}) : ${dits}`;
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
    // ⚠️ LE LIEU QUI PORTE SE LIT DANS LES DEUX CAS SANS TERMINAL, et il ne se lisait que dans
    // UN. Une ligne « SANS TERMINAL — porté par son lieu » qui ne dit pas QUEL lieu est une
    // attribution sans son objet : le dirigeant sait qu'un registre le porte, et ne peut pas
    // aller le voir. C'est « une garde posée sur un cas ne couvre pas sa famille », appliqué au
    // rendu — j'avais écrit la ligne pour `vivant: false`, et sur ce poste les quatre lignes
    // réelles sont toutes à `vivant: null`. Elle n'était donc JAMAIS rendue.
    if (o.presence?.vivant !== true && o.porteur?.lieux?.length) {
      l.push(`     ↳ porté par le lieu ${o.porteur.lieux[0]}${o.porteur.lieux.length > 1 ? ` (et ${o.porteur.lieux.length - 1} autre(s) copie(s))` : ''}`);
    }
    if (o.presence?.vivant === null) {
      l.push(`     ↳ présence ${MOT_NON_ETABLI} — ${o.presence.pourquoi}`);
    } else if (o.presence?.vivant === false) {
      l.push(`     ↳ ${o.presence.source ?? 'aucun terminal vivant ne porte ce mandat'}`);
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
    l.push(`  · session muette : ${nomDeSession(s.session) ?? '(sans nom)'}`);
  }
  l.push('');
  l.push(vue.regle);
  return l.join('\n');
}

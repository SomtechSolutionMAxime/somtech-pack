/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LE TUI DE LA VUE DU PARC — le MODÈLE, sans terminal, sans couleur, sans effet
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce module ne consomme QUE ce que `laVueDuParc()` a rendu. Il ne relit rien, ne recalcule
 * rien, ne devine rien : le moteur est la seule source (E-20260824-0005, hors-scope n°3).
 *
 * 🔴 IL EST PUR, ET C'EST LA CONDITION POUR QU'IL SOIT ÉPROUVABLE. Tout ce qui touche le
 * terminal — mode brut, redraw, resize, focus d'un pane — vit dans `tui-boucle.js`. La leçon
 * est celle de `ecrireLaVue` : tant qu'un choix vit dans le `bin`, le muter laisse la suite
 * VERTE, parce que le `bin` n'est atteignable que par un vrai lancement.
 *
 * ⚠️ ET CE QUI RESTE DANS LA BOUCLE S'EXERCE, il ne se mute pas : une arête qui franchit un
 * PROCESSUS (le terminal, son clavier, son redraw) ne se révèle qu'en TAPANT la commande.
 */

import { MOT_NON_ETABLI, rendreAttribution, rendreAdresse } from './vue-du-parc.js';

/**
 * LES ÉTATS FERMÉS, PAR FAMILLE — ÉNUMÉRÉS, jamais testés un par un.
 *
 * 🔴 « NON PRIS » SE MESURE, IL NE SE DÉDUIT PAS. Un epic est non pris quand AUCUN agent
 * vivant ne le porte ET que son statut n'est pas fermé. Tester `!== 'completed'` seul ferait
 * apparaître en « NON PRIS » tout ce qui a été annulé — c'est-à-dire appeler le dirigeant à
 * agir sur du travail que quelqu'un a déjà décidé d'abandonner.
 *
 * ⚠️ LES DEUX FAMILLES NE SE CONFONDENT PAS. Les epics ont un `cancelled` natif ; les tickets
 * n'en ont pas — la convention y ferme par `completed` avec une note. Fondre les deux listes
 * appliquerait à un étage la mesure de l'autre.
 */
export const ETATS_FERMES = {
  epic: ['completed', 'cancelled'],
  story: ['completed'],
};

/** Un statut de cet étage est-il fermé ? `null` quand le statut n'a pas été mesuré. */
export function estFerme(statut, niveau) {
  const famille = ETATS_FERMES[niveau];
  if (!famille) return null;
  const s = statut === null || statut === undefined ? null : String(statut).trim().toLowerCase();
  // ⚠️ « je n'ai pas lu son statut » N'EST PAS « il est ouvert ». Replier l'absence en `false`
  // ferait marquer NON PRIS un élément dont on ne sait rien — l'absence comblée que RA-VUE-003
  // interdit, sur le signal qui appelle précisément le dirigeant à agir.
  if (!s) return null;
  return famille.includes(s);
}

/**
 * CET ÉLÉMENT EST-IL NON PRIS ? — les deux conditions, chacune avec sa mesure.
 *
 * Rend `{ mesure, nonPris, pourquoi }` : `mesure: 'lue'` quand les DEUX faits sont établis,
 * `'non établie'` dès que l'un manque — et alors `nonPris` vaut `null`, jamais `false`.
 */
export function nonPrisDe({ attribution, statut, niveau }) {
  const porte = attribution?.mesure === 'lue' && (attribution.agents?.length ?? 0) > 0;
  if (porte) {
    return { mesure: 'lue', nonPris: false, pourquoi: 'un agent vivant porte ce travail' };
  }
  const ferme = estFerme(statut, niveau);
  if (ferme === null) {
    return {
      mesure: 'non établie',
      nonPris: null,
      pourquoi:
        `aucun agent vivant ne porte ce travail, mais son statut n’a pas été mesuré : ` +
        `je ne peux pas dire s’il attend quelqu’un ou s’il est déjà fermé`,
    };
  }
  if (ferme) {
    return { mesure: 'lue', nonPris: false, pourquoi: `son statut « ${statut} » est un état fermé` };
  }
  return {
    mesure: 'lue',
    nonPris: true,
    pourquoi: `aucun agent vivant ne le porte, et son statut « ${statut} » n’est pas un état fermé`,
  };
}

/**
 * L'APP D'UN CHANTIER — LUE au ServiceDesk, jamais devinée du nom ni du dépôt.
 *
 * ⚠️ « APP NON ÉTABLIE » EST UN GROUPE, PAS UN TROU. Ranger au plus plausible ferait lire un
 * rattachement là où il n'y a eu aucune mesure : le dirigeant chercherait ensuite son chantier
 * sous une app qui ne le porte pas.
 */
export const APP_NON_ETABLIE = 'APP NON ÉTABLIE';

export function appDuChantier(chantier) {
  const a = chantier?.application;
  if (a?.mesure === 'lue' && (a.nom || a.code)) {
    return { mesure: 'lue', nom: String(a.nom ?? a.code), code: a.code ?? null };
  }
  return {
    mesure: 'non établie',
    nom: APP_NON_ETABLIE,
    code: null,
    pourquoi: a?.pourquoi ?? 'le ServiceDesk n’a pas rendu l’application de ce chantier',
  };
}

/**
 * LE NOM QU'ON LIT SUR UNE LIGNE D'ORCHESTRATEUR — et JAMAIS son code de chantier.
 *
 * 🔴 CETTE FONCTION RENDAIT LE CODE, ET C'EST LA DEMANDE DU DIRIGEANT QU'ELLE TRAHISSAIT, mot
 * pour mot : « P-20260822-0001 ne me dit absolument rien ». Un lieu sans pane vivant ne nomme
 * personne — `porteurDuLieu` n'invente aucun nom, à juste titre — et le repli choisi était le
 * code. MESURÉ sur la vue réelle du poste : **2 lignes sur 457** affichaient `P-20260820-0001`
 * comme NOM, dans l'arbre.
 *
 * ⚠️ ET MON BANC NE L'AVAIT PAS VU parce que sa donnée portait un agent VIVANT : encore un vert
 * qui ne touchait pas ce qu'il prétendait éprouver. C'est une passe de revue qui l'a trouvé.
 *
 * ⚠️ CE QU'ON PERD EN LE RETIRANT, ET POURQUOI CE N'EST PAS UNE PERTE : la ligne porte DÉJÀ le
 * TITRE du chantier juste après — c'est lui qui identifie, et c'est lui qu'il a demandé. Le
 * code reste dans le détail, à droite, où il sert à retrouver la ligne au ServiceDesk.
 */
function nomDeLOrchestrateur(o) {
  return o?.agent?.nom ?? MOT_NON_ETABLI;
}

/**
 * CE QUI EST INCERTAIN — la descendance de ce nœud n'a PAS pu être lue.
 *
 * 🔴 UN CORRECTIF DE REPLI SE POSE À TOUS LES ÉTAGES OÙ LE REPLI EXISTE, pas à celui où on
 * l'a vu. Ce champ a d'abord été posé sur l'ORCHESTRATEUR seul (`epics: null`) ; l'EPIC
 * portait le MÊME repli un étage plus bas (`stories: null`) et n’a rien reçu. Même donnée
 * (`null`), même repli (`false`), même conséquence — disparaître sous `n`, le filtre qui
 * sert précisément à décider où agir. Un correctif ouvre son symétrique sur la même
 * frontière : ici, pas le symétrique À CÔTÉ mais le symétrique EN DESSOUS.
 *
 * ⚠️ ET IL EST DÉRIVÉ D’UNE SEULE FABRIQUE, pour que les deux étages ne puissent plus
 * diverger. Deux expressions écrites à la main auraient rouvert « une porte sur deux » —
 * dans le geste même qui la ferme.
 */
function incertitudeDe(enfantsLus, quoi) {
  if (enfantsLus) return { incertain: false, pourquoiIncertain: null };
  return {
    incertain: true,
    pourquoiIncertain:
      `ses ${quoi} n’ont PAS pu être lus : je ne sais pas s’il attend quelqu’un — ` +
      'ce n’est pas « rien à signaler »',
  };
}

/** La marque de présence — un caractère, et il ne dit QUE ce qui a été mesuré. */
export function marqueDePresence(presence) {
  if (presence?.vivant === true) return '●';
  if (presence?.vivant === false) return '◌';
  return '?';
}

/**
 * LE TITRE D'UNE LIGNE D'ARBRE — un NOM, jamais un identifiant (D-20260824-0003, point 2).
 *
 * 🔴 LES IDs NE VIVENT QUE DANS LE DÉTAIL. Ses mots : « P-20260822-0001 ne me dit absolument
 * rien ». Un arbre d'identifiants est un arbre qu'on ne peut pas piloter.
 */
function titreDeChantier(o) {
  const c = o?.chantier;
  if (c?.mesure === 'lue') return c.titre ?? `(chantier sans titre)`;
  if (c?.mesure === 'non établi') return '(pas un chantier)';
  return '(chantier NON MESURÉ)';
}

/**
 * L'ARBRE — les nœuds, dans l'ordre où ils s'affichent, sans notion d'écran ni de pliage.
 *
 * @param vue     ce que `laVueDuParc()` a rendu.
 * @param parApp  grouper par application (défaut) ou par orchestrateur (touche `a`).
 */
export function arbreDeLaVue(vue, { parApp = true } = {}) {
  const orchestrateurs = Array.isArray(vue?.orchestrateurs) ? vue.orchestrateurs : [];
  const lignesOrch = orchestrateurs.map((o, i) => noeudDOrchestrateur(o, i));

  const racines = [];
  if (parApp) {
    // ⚠️ L'ORDRE DES APPS EST CELUI DE LEUR PREMIÈRE APPARITION, et « APP NON ÉTABLIE » finit
    // toujours en dernier : c'est un groupe d'absence, pas une app parmi les autres.
    const parNom = new Map();
    for (const n of lignesOrch) {
      const cle = n.app.nom;
      if (!parNom.has(cle)) parNom.set(cle, []);
      parNom.get(cle).push(n);
    }
    const noms = [...parNom.keys()].filter((n) => n !== APP_NON_ETABLIE);
    if (parNom.has(APP_NON_ETABLIE)) noms.push(APP_NON_ETABLIE);
    for (const nom of noms) {
      const enfants = parNom.get(nom);
      racines.push({
        id: `app:${nom}`,
        kind: 'app',
        titre: nom.toUpperCase(),
        marque: '',
        suffixe: `${enfants.length} orchestrateur(s)`,
        enfants,
        ref: { app: nom },
      });
    }
  } else {
    racines.push(...lignesOrch);
  }

  const hors = Array.isArray(vue?.horsHierarchie) ? vue.horsHierarchie : [];
  if (hors.length) {
    racines.push({
      id: 'section:hors',
      kind: 'section',
      titre: 'HORS HIÉRARCHIE',
      marque: '',
      suffixe: `${hors.length} agent(s) sans orchestrateur`,
      enfants: hors.map((h, i) => ({
        id: `hors:${i}`,
        kind: 'agent-hors',
        titre: h?.agent?.nom ?? `ANONYME (${h?.agent?.pane ?? '?'})`,
        marque: '',
        suffixe: h?.domaine?.mesure === 'lu' ? h.domaine.role : MOT_NON_ETABLI,
        enfants: [],
        ref: { hors: h },
      })),
      ref: {},
    });
  }
  return racines;
}

function noeudDOrchestrateur(o, i) {
  const app = appDuChantier(o?.chantier);
  const epics = Array.isArray(o?.epics) ? o.epics : null;
  const enfants = (epics ?? []).map((e, j) => noeudDEpic(e, o, j));
  return {
    id: `orch:${o?.chantier?.code ?? nomDeLOrchestrateur(o)}:${i}`,
    kind: 'orchestrateur',
    titre: `${nomDeLOrchestrateur(o)} — ${titreDeChantier(o)}`,
    marque: marqueDePresence(o?.presence),
    // ⚠️ `null` NE SE REND PAS COMME `0`. « je n'ai pas pu lire ses epics » et « il n'en a
    // aucun » appellent deux gestes opposés, et les fondre a déjà fait disparaître le travail
    // d'agents entiers de cette vue.
    suffixe: epics === null ? 'epics NON LUS' : `${epics.length} epic(s)`,
    // 🔴 « JE N'AI PAS PU LIRE » EST UN ÉTAT À PART ENTIÈRE SOUS LE FILTRE `n`, ET IL MANQUAIT.
    // `porteDuNonPris` ne regardait que les enfants ; avec `epics: null` on construit
    // `enfants: []`, donc il rendait `false` — c'est-à-dire « aucun non-pris ici » alors que la
    // vérité est « je ne sais pas ». MESURÉ sur la vue réelle : **4 orchestrateurs sur 17**
    // étaient dans ce cas, et les 4 DISPARAISSAIENT sous `n`.
    //
    // ⚠️ C'est le repli que RA-VUE-003 interdit, appliqué à « epics non mesurés » — et sur le
    // filtre qui sert précisément à décider où agir : le taire y est plus grave qu'ailleurs.
    ...incertitudeDe(epics !== null, 'epics'),
    enfants,
    app,
    ref: { orchestrateur: o },
  };
}

function noeudDEpic(e, o, j) {
  const stories = Array.isArray(e?.stories) ? e.stories : null;
  const nonPris = nonPrisDe({ attribution: e?.agent, statut: e?.statut, niveau: 'epic' });
  return {
    id: `epic:${e?.code ?? j}:${o?.chantier?.code ?? ''}`,
    kind: 'epic',
    titre: e?.titre ?? '(epic sans titre)',
    marque: nonPris.nonPris === true ? '○' : nonPris.nonPris === false ? '▸' : '?',
    // ⚠️ TROIS FAITS, UN SEUL SUFFIXE, ET UNE PRÉCÉDENCE QUI SE DIT. `NON PRIS` passe devant
    // parce que c'est un APPEL À AGIR mesuré ; « stories NON LUES » vient ensuite parce que
    // c'est un TROU DE MESURE. Les deux se lisent en entier dans le détail — aucun n'est perdu,
    // seul l'ordre à l'écran est tranché.
    suffixe:
      nonPris.nonPris === true
        ? 'NON PRIS'
        : stories === null
          ? 'stories NON LUES'
          : nonPris.nonPris === null
            ? MOT_NON_ETABLI
            : rendreAttribution(e?.agent),
    nonPris,
    // 🔴 LE MÊME REPLI, UN ÉTAGE PLUS BAS — et il était resté ouvert quand j'ai fermé celui de
    // l'orchestrateur. Un epic FERMÉ dont l'appel aux tickets a jeté rend `stories: null`, donc
    // `enfants: []`, donc `porteDuNonPris` rendait `false` : il DISPARAISSAIT sous `n` avec tout
    // le travail non pris que ses stories pouvaient porter. Trouvé par une passe de fond, sur le
    // geste même où je fermais l'autre étage.
    ...incertitudeDe(stories !== null, 'stories'),
    enfants: (stories ?? []).map((s, k) => noeudDeStory(s, e, k)),
    storiesLues: stories !== null,
    ref: { epic: e, orchestrateur: o },
  };
}

function noeudDeStory(s, e, k) {
  const nonPris = nonPrisDe({ attribution: s?.agent, statut: s?.statut, niveau: 'story' });
  return {
    id: `story:${s?.code ?? k}:${e?.code ?? ''}`,
    kind: 'story',
    titre: s?.titre ?? '(story sans titre)',
    marque: nonPris.nonPris === true ? '○' : nonPris.nonPris === false ? '├' : '?',
    suffixe:
      nonPris.nonPris === true
        ? 'NON PRIS'
        : nonPris.nonPris === null
          ? MOT_NON_ETABLI
          : rendreAttribution(s?.agent),
    nonPris,
    enfants: [],
    ref: { story: s, epic: e },
  };
}

/** Un nœud porte-t-il, LUI ou l'un de ses descendants, du travail non pris ? */
export function porteDuNonPris(noeud) {
  if (noeud?.nonPris?.nonPris === true) return true;
  // 🔴 UNE MESURE QUI A ÉCHOUÉ SE MONTRE, ELLE NE SE REPLIE PAS EN « RIEN ». Un nœud dont on
  // n'a pas pu lire la descendance ne peut pas dire qu'il ne porte rien : il peut porter du
  // travail non pris qu'on n'a jamais vu. Sous `n`, il APPARAÎT — et il le dit avec son propre
  // mot (« NON LUS »), jamais avec la marque `○ NON PRIS`, qui affirmerait ce qu'on ignore.
  if (noeud?.incertain === true) return true;
  return (noeud?.enfants ?? []).some(porteDuNonPris);
}

/** Le texte cherché apparaît-il sur ce nœud ou sous lui ? */
function correspond(noeud, recherche) {
  const q = String(recherche ?? '').trim().toLowerCase();
  if (!q) return true;
  const sur = `${noeud.titre ?? ''} ${noeud.suffixe ?? ''}`.toLowerCase();
  if (sur.includes(q)) return true;
  return (noeud?.enfants ?? []).some((n) => correspond(n, recherche));
}

/**
 * LES LIGNES VISIBLES — l'arbre aplati selon ce qui est plié, filtré, cherché.
 *
 * ⚠️ UN FILTRE ACTIF SE DIT À L'ÉCRAN, il ne se devine pas d'une liste courte. Un arbre
 * subitement vide sous un filtre oublié se lit « il n'y a rien », et c'est faux.
 */
export function lignesVisibles(racines, { plies = new Set(), nonPrisSeuls = false, recherche = '' } = {}) {
  const sortie = [];
  const descendre = (noeuds, profondeur) => {
    for (const n of noeuds) {
      if (nonPrisSeuls && !porteDuNonPris(n)) continue;
      if (!correspond(n, recherche)) continue;
      const pliable = (n.enfants?.length ?? 0) > 0;
      const plie = plies.has(n.id);
      sortie.push({
        id: n.id,
        kind: n.kind,
        profondeur,
        titre: n.titre,
        marque: n.marque,
        suffixe: n.suffixe,
        pliable,
        plie,
        noeud: n,
      });
      if (pliable && !plie) descendre(n.enfants, profondeur + 1);
    }
  };
  descendre(racines, 0);
  return sortie;
}

/** Le chevron de pliage — `▼` ouvert, `▶` plié, la marque du nœud sinon. */
export function chevron(ligne) {
  if (!ligne.pliable) return ligne.marque || ' ';
  return ligne.plie ? '▶' : '▼';
}

/**
 * UNE LIGNE D'ARBRE, EN TEXTE — et le suffixe ne mange JAMAIS le titre.
 *
 * 🔴 CE DÉFAUT EST SORTI DE L'ÉCRAN RÉEL, PAS D'UNE RELECTURE NI D'UNE MUTATION. Le suffixe
 * était posé entier, et le titre recevait « ce qui reste » : quand le suffixe dépassait la
 * colonne, `largeur - queue.length` devenait NÉGATIF, `borner` rendait la chaîne vide, et la
 * ligne se réduisait à son suffixe — sans titre, sans indentation, donc SANS SA PLACE DANS
 * L'ARBRE. Elle débordait par-dessus le marché.
 *
 * ⚠️ MESURÉ sur la vue du poste le 2026-08-24 : **2 lignes sur 457** sortaient à 133 colonnes
 * dans un écran de 118. Leur suffixe était la phrase de l'INDICE — « NON ÉTABLI — un agent
 * porte ce nom, son lieu ne le prouve pas : … » — c'est-à-dire la garde de HS-VUE-002
 * elle-même. La condition de l'arbitrage cassait l'affichage qu'elle est censée servir.
 *
 * ⚠️ ET LE BANC QUI DISAIT « l'écran tient dans ses bornes » PASSAIT : ses données avaient des
 * suffixes courts, donc il éprouvait la troncature du TITRE et jamais celle du SUFFIXE.
 */
export function texteDeLigne(ligne, largeur) {
  const indent = '   '.repeat(ligne.profondeur);
  const tete = `${indent}${chevron(ligne)} ${ligne.titre}`;
  // Le suffixe ne prend jamais plus de la MOITIÉ de la colonne : au-delà, il effacerait le
  // titre et l'indentation, c'est-à-dire ce qui rattache la ligne à l'arbre.
  const place = ligne.suffixe ? Math.min(ligne.suffixe.length + 1, Math.floor(largeur / 2)) : 0;
  const queue = place > 0 ? ` ${tronquer(ligne.suffixe, place - 1)}` : '';
  return borner(tete, largeur - queue.length) + queue;
}

/**
 * TRONQUER SANS COMBLER — le jumeau de `borner`, et ils ne se remplacent pas.
 *
 * ⚠️ `borner` COMPLÈTE à la largeur : c'est ce qu'il faut pour une COLONNE, dont le bord droit
 * doit tomber au même endroit à chaque ligne. Ici on veut un fragment qui s'arrête où il
 * s’arrête — le compléter le ferait déborder de la place qu’on vient de lui réserver.
 */
export function tronquer(texte, largeur) {
  const t = String(texte ?? '');
  if (largeur <= 0) return '';
  return t.length <= largeur ? t : `${t.slice(0, Math.max(0, largeur - 1))}…`;
}

/** Borner un texte à N colonnes, en le disant par `…` quand on coupe. */
export function borner(texte, largeur) {
  const t = String(texte ?? '');
  if (largeur <= 0) return '';
  if (t.length <= largeur) return t.padEnd(largeur, ' ');
  return `${t.slice(0, Math.max(0, largeur - 1))}…`;
}

/**
 * LE DÉTAIL DE LA SÉLECTION — et c'est LE SEUL endroit où un identifiant apparaît.
 *
 * ⚠️ LE STATUT NE SORT JAMAIS NU. Il est AFFIRMÉ par le registre, pas mesuré à l'instant
 * (EF-VUE-005) : posé à côté d'une présence mesurée, il se lirait comme un constat — le défaut
 * qui a coûté la journée du 21 août.
 */
export function detailDe(ligne) {
  if (!ligne) return ['(rien de sélectionné)'];
  const n = ligne.noeud;
  const l = [n.titre, '─'.repeat(26)];

  if (n.kind === 'app') {
    l.push(`${n.enfants.length} orchestrateur(s) sous cette app.`);
    if (n.ref?.app === APP_NON_ETABLIE) {
      l.push('', 'Ce groupe n’est PAS une app : c’est l’ensemble', 'des chantiers dont l’application n’a pas', 'pu être lue au ServiceDesk.');
    }
    return l;
  }
  if (n.kind === 'section') return l.concat([`${n.enfants.length} agent(s).`]);
  if (n.kind === 'agent-hors') {
    const h = n.ref.hors;
    l.push(`pane    : ${h?.agent?.pane ?? MOT_NON_ETABLI}`);
    l.push(`domaine : ${h?.domaine?.mesure === 'lu' ? h.domaine.role : MOT_NON_ETABLI}`);
    if (h?.domaine?.mesure !== 'lu' && h?.domaine?.pourquoi) l.push('', ...envelopper(h.domaine.pourquoi, 28));
    return l;
  }

  const o = n.ref.orchestrateur;
  if (n.kind === 'orchestrateur') {
    const c = o?.chantier ?? {};
    l.push(`${c.code ?? MOT_NON_ETABLI}`);
    l.push(`app     : ${n.app.nom}`);
    l.push(`statut  : ${c.statut ?? MOT_NON_ETABLI} (affirmé)`);
    l.push('');
    l.push(`porteur : ${rendreAttribution({ mesure: o?.porteur?.mesure === 'lue' && o.porteur.agents?.length ? 'lue' : 'non établi', agents: o?.porteur?.agents ?? [], indices: [] })}`);
    l.push(`présence: ${marqueDePresence(o?.presence)} ${o?.presence?.vivant === true ? 'vivant' : o?.presence?.vivant === false ? 'aucun terminal' : MOT_NON_ETABLI}`);
    l.push('');
    // ⚠️ CE QUE LE FILTRE A MONTRÉ, LE DÉTAIL L'EXPLIQUE. Un chantier qui apparaît sous « n »
    // sans porter la marque `○ NON PRIS` serait autrement inexplicable : il est là parce qu'on
    // n'a PAS PU savoir, et c'est différent de « il attend quelqu'un ».
    if (n.incertain) {
      l.push('');
      l.push(...envelopper(`⚠️ ${n.pourquoiIncertain}`, 28));
    }
    l.push('');
    l.push('adresse :');
    l.push(...envelopper(rendreAdresse(o?.adresse), 28));
    if (o?.adresse?.mesure === 'lue') l.push('', '[Entrée] focus le terminal');
    return l;
  }

  const e = n.ref.epic;
  if (n.kind === 'epic') {
    l.push(`${e?.code ?? MOT_NON_ETABLI}`);
    l.push(`app     : ${noeudApp(n)}`);
    l.push(`chantier: ${o?.chantier?.titre ?? MOT_NON_ETABLI}`);
    l.push(`statut  : ${e?.statut ?? MOT_NON_ETABLI} (affirmé)`);
    l.push('');
    l.push(...envelopper(`porteur : ${rendreAttribution(e?.agent)}`, 28));
    l.push('');
    l.push(...envelopper(`pris en charge : ${etiquetteNonPris(n.nonPris)}`, 28));
    l.push(...envelopper(n.nonPris.pourquoi, 28));
    if (n.incertain) {
      l.push('');
      l.push(...envelopper(`⚠️ ${n.pourquoiIncertain}`, 28));
    }
    return l;
  }

  const s = n.ref.story;
  l.push(`${s?.code ?? MOT_NON_ETABLI}`);
  l.push(`epic    : ${e?.titre ?? MOT_NON_ETABLI}`);
  l.push(`statut  : ${s?.statut ?? MOT_NON_ETABLI} (affirmé)`);
  l.push('');
  l.push(...envelopper(`porteur : ${rendreAttribution(s?.agent)}`, 28));
  l.push('');
  l.push(...envelopper(`pris en charge : ${etiquetteNonPris(n.nonPris)}`, 28));
  l.push(...envelopper(n.nonPris.pourquoi, 28));
  return l;
}

function noeudApp(n) {
  return appDuChantier(n.ref?.orchestrateur?.chantier).nom;
}

function etiquetteNonPris(nonPris) {
  if (nonPris?.nonPris === true) return '○ NON PRIS';
  if (nonPris?.nonPris === false) return 'oui';
  return MOT_NON_ETABLI;
}

/** Replier un texte long sur N colonnes — un panneau étroit n'est pas une ligne coupée. */
export function envelopper(texte, largeur) {
  const mots = String(texte ?? '').split(/\s+/).filter(Boolean);
  const lignes = [];
  let courante = '';
  for (const m of mots) {
    if (!courante.length) courante = m;
    else if (courante.length + 1 + m.length <= largeur) courante += ` ${m}`;
    else {
      lignes.push(courante);
      courante = m;
    }
  }
  if (courante.length) lignes.push(courante);
  return lignes.length ? lignes : [''];
}

/**
 * LE CURSEUR, RAMENÉ DANS LA LISTE — un seul endroit, pour que le rendu et les touches
 * désignent toujours LA MÊME ligne.
 *
 * ⚠️ DEUX ÉCRÊTAGES ÉCRITS SÉPARÉMENT FINIRAIENT PAR DIVERGER, et c'est exactement ce qui
 * s'est produit : `appliquerTouche` bornait sa lecture locale, le rendu non. L'écran montrait
 * donc une chose et la touche en visait une autre.
 */
export function curseurDansLaListe(curseur, combien) {
  if (!Number.isFinite(curseur) || curseur < 0) return 0;
  if (combien <= 0) return 0;
  return Math.min(Math.trunc(curseur), combien - 1);
}

/** L'état de l'écran au premier affichage. Rien n'est plié : on voit d'abord tout. */
export function etatInitial() {
  return { curseur: 0, plies: new Set(), parApp: true, nonPrisSeuls: false, recherche: '', mode: 'arbre', dessus: 0 };
}

/**
 * LES RACCOURCIS, DANS L'ORDRE DE LA MAQUETTE VALIDÉE — et `q quitter` ne se perd jamais.
 *
 * 🔴 DÉFAUT TROUVÉ EN EXERÇANT LE TUI DANS UN VRAI PTY. La barre est plus longue que 100
 * colonnes ; bornée, elle coupait par la DROITE — donc le premier raccourci sacrifié était
 * `q quitter`, c'est-à-dire le seul dont on a besoin quand on ne sait plus quoi faire.
 *
 * ⚠️ ON NE RÉORDONNE PAS POUR AUTANT : l'ordre est celui de la maquette que le dirigeant a
 * validée, et il fait foi. Ce qui change, c'est la DÉGRADATION — on retire des raccourcis
 * entiers, en partant du moins vital, plutôt que de tronquer la phrase au milieu d'un mot.
 * À pleine largeur, la barre est exactement celle de la maquette.
 */
export const RACCOURCIS_UN_A_UN = [
  { texte: '↑↓ naviguer', vital: 2 },
  { texte: '→← plier', vital: 2 },
  { texte: '/ chercher', vital: 3 },
  { texte: 'a grouper par app/orchestrateur', vital: 4 },
  { texte: 'n non-pris seuls', vital: 4 },
  { texte: 'r rafraîchir', vital: 3 },
  // ⚠️ `vital: 1` — le dernier qu'on retire, jamais le premier. Une barre sans lui laisse le
  // lecteur enfermé dans un plein écran dont il ne connaît pas la sortie.
  { texte: 'q quitter', vital: 1 },
];

export const RACCOURCIS = RACCOURCIS_UN_A_UN.map((r) => r.texte).join('  ');

/** La barre de raccourcis qui TIENT dans la largeur — en retirant le moins vital d'abord. */
export function raccourcisPour(largeur) {
  let gardes = RACCOURCIS_UN_A_UN.slice();
  const rendre = (l) => l.map((r) => r.texte).join('  ');
  while (gardes.length > 1 && rendre(gardes).length > largeur) {
    // On retire le moins vital ; à vitalité égale, le dernier de la liste.
    const pire = gardes.reduce((a, b) => (b.vital >= a.vital ? b : a));
    gardes = gardes.filter((r) => r !== pire);
  }
  return rendre(gardes);
}

/**
 * UNE TOUCHE → UN NOUVEL ÉTAT, et un effet éventuel. PUR : rien n'est muté sur place.
 *
 * L'effet est ce que la boucle exécutera : `quitter`, `relire`, `focus`. Le modèle ne
 * l'exécute jamais lui-même — c'est ce qui permet de l'éprouver sans terminal.
 *
 * 🔴 IL N'EXISTE AUCUN AUTRE EFFET, ET C'EST LA FRONTIÈRE (HS-VUE-001). Ni relance, ni arrêt,
 * ni assignation, ni la moindre écriture au ServiceDesk (RA-VUE-001). `focus` est de
 * l'ADRESSAGE : on met le terminal devant les yeux du dirigeant, on ne lui parle pas.
 */
export function appliquerTouche(etat, touche, lignes) {
  const n = lignes.length;
  // 🔴 LE CURSEUR EST RAMENÉ DANS LA LISTE À CHAQUE TOUCHE, ET C'EST UN DÉFAUT MESURÉ QUI SE
  // FERME ICI. `relire` ne touchait ni le curseur ni les plis, et le rendu ne l'écrêtait pas
  // non plus : quand la vue RÉTRÉCIT entre deux lectures — ce qui arrive vraiment sur 70 s —
  // l'écran ne surlignait plus aucune ligne, et `Entrée` mettait quand même un terminal réel
  // en focus. Le seul geste ACTIF du produit se posait sur une cible que personne ne voyait.
  const curseur = curseurDansLaListe(etat.curseur, n);
  const e = { ...etat, curseur, plies: new Set(etat.plies) };
  const ligne = lignes[curseur] ?? null;

  if (e.mode === 'recherche') {
    if (touche === 'echap') return { etat: { ...e, mode: 'arbre', recherche: '' }, effet: null };
    if (touche === 'entree') return { etat: { ...e, mode: 'arbre' }, effet: null };
    if (touche === 'effacer') return { etat: { ...e, recherche: e.recherche.slice(0, -1), curseur: 0 }, effet: null };
    if (typeof touche === 'string' && touche.length === 1) {
      return { etat: { ...e, recherche: e.recherche + touche, curseur: 0 }, effet: null };
    }
    return { etat: e, effet: null };
  }

  switch (touche) {
    case 'bas':
      return { etat: { ...e, curseur: Math.min(e.curseur + 1, Math.max(0, n - 1)) }, effet: null };
    case 'haut':
      return { etat: { ...e, curseur: Math.max(0, e.curseur - 1) }, effet: null };
    case 'droite':
      if (ligne?.pliable && ligne.plie) e.plies.delete(ligne.id);
      return { etat: e, effet: null };
    case 'gauche':
      if (ligne?.pliable && !ligne.plie) e.plies.add(ligne.id);
      return { etat: e, effet: null };
    case 'a':
      // ⚠️ LA BASCULE NE RELIT RIEN — le moteur a déjà tout rendu, regrouper est un geste de
      // mise en page. Relire ici coûterait 80 s pour une donnée qu'on tient déjà.
      return { etat: { ...e, parApp: !e.parApp, curseur: 0, plies: new Set() }, effet: null };
    case 'n':
      return { etat: { ...e, nonPrisSeuls: !e.nonPrisSeuls, curseur: 0 }, effet: null };
    case '/':
      return { etat: { ...e, mode: 'recherche', recherche: '' }, effet: null };
    case 'r':
      return { etat: e, effet: { type: 'relire' } };
    case 'q':
      return { etat: e, effet: { type: 'quitter' } };
    // 🔴 ÉCHAP NE QUITTE PLUS L'ARBRE, ET C'EST LA SECONDE MOITIÉ DU CORRECTIF DE LA FLÈCHE
    // COUPÉE. Une flèche coupée entre deux lectures laisse un `ESC` seul ; le décodeur le garde
    // désormais, mais on ne confie pas à UNE garde une conséquence aussi grave que fermer
    // l'écran. La maquette validée dit `q quitter` et ne mentionne pas Échap.
    //
    // 🔴 ET IL N'ANNULE QUE CE QUI EST ACTIF — première rédaction REJETÉE en passe de revue, et
    // le rejet était juste. Elle remettait `curseur: 0` INCONDITIONNELLEMENT : un Échap réflexe,
    // sans aucun filtre ni recherche à annuler, renvoyait le lecteur en tête d'un arbre de
    // 455 lignes. MESURÉ sur la vue réelle du poste le 2026-08-24 : curseur 120 → 0, rien
    // d'autre changé.
    //
    // ⚠️ ET LA PROSE DISAIT « ne détruit rien » PENDANT QUE LE CODE DÉTRUISAIT. C'est la forme
    // que ce dépôt combat partout — une prose qui contredit la donnée — écrite ici par la même
    // main, dans le même geste. Les deux disent la même chose à la fin.
    //
    // ⚠️ LE CURSEUR NE BOUGE QUE SI L'ARBRE CHANGE DE FORME. Effacer un filtre ou une recherche
    // fait réapparaître des lignes : les indices ne désignent plus les mêmes nœuds, et revenir
    // en tête est alors le seul repère honnête. Sans changement de forme, la place est à lui.
    case 'echap': {
      if (!e.nonPrisSeuls && !e.recherche) return { etat: e, effet: null };
      return { etat: { ...e, nonPrisSeuls: false, recherche: '', curseur: 0 }, effet: null };
    }
    case 'entree': {
      const adresse = ligne?.noeud?.ref?.orchestrateur?.adresse;
      // ⚠️ AUCUNE ADRESSE PÉRIMÉE N'EST SUIVIE. `adresseDe` rend `mesure: 'aucune'` dès que le
      // terminal n'a pas été constaté vivant : y envoyer le dirigeant serait pire qu'un refus,
      // parce qu'il s'y fierait.
      if (ligne?.kind === 'orchestrateur' && adresse?.mesure === 'lue' && adresse.pane) {
        return { etat: e, effet: { type: 'focus', pane: adresse.pane, session: adresse.session } };
      }
      return {
        etat: e,
        effet: {
          type: 'refus',
          pourquoi:
            ligne?.kind === 'orchestrateur'
              ? adresse?.pourquoi ?? 'aucun terminal vivant ne porte ce mandat'
              : 'seul un orchestrateur vivant porte un terminal qu’on puisse mettre en focus',
        },
      };
    }
    default:
      return { etat: e, effet: null };
  }
}

/**
 * L'ÉCRAN ENTIER, en lignes de texte — sans une seule séquence de couleur.
 *
 * ⚠️ LA COULEUR VIT DANS LA BOUCLE, ET C'EST DÉLIBÉRÉ : un banc qui assère sur du texte
 * coloré assère sur des codes d'échappement, et finit par passer pour la mauvaise raison.
 */
export function rendreEcran({ vue, etat, lignes, largeur = 100, hauteur = 30 }) {
  const largeurArbre = Math.max(28, Math.floor(largeur * 0.62));
  const largeurDetail = Math.max(20, largeur - largeurArbre - 3);
  const hauteurCorps = Math.max(1, hauteur - 2);

  const sortie = [];
  sortie.push({ style: 'titre', texte: borner(enTete(vue, etat), largeur) });

  // 🔴 LE RENDU ÉCRÊTE PAR LA MÊME FONCTION QUE LES TOUCHES. Écrit séparément, il divergeait :
  // après un `r` sur une vue rétrécie, l'écran ne surlignait plus rien pendant que `Entrée`
  // visait encore un terminal. Ce qu'on montre et ce qu'on vise sont désormais le même indice.
  const curseur = curseurDansLaListe(etat.curseur, lignes.length);
  const detail = detailDe(lignes[curseur] ?? null);
  const dessus = fenetre(curseur, lignes.length, hauteurCorps);

  for (let i = 0; i < hauteurCorps; i += 1) {
    const idx = dessus + i;
    const ligne = idx < lignes.length ? lignes[idx] : null;
    const gauche = ligne ? texteDeLigne(ligne, largeurArbre) : ' '.repeat(largeurArbre);
    const droite = borner(detail[i] ?? '', largeurDetail);
    sortie.push({
      style: ligne && idx === curseur ? 'selection' : ligne ? `arbre:${ligne.kind}` : 'vide',
      texte: `${gauche} │ ${droite}`,
    });
  }

  sortie.push({ style: 'pied', texte: borner(pied(etat, largeur), largeur) });
  return sortie;
}

/** Quelle tranche de l'arbre montrer pour que le curseur reste visible. */
export function fenetre(curseur, total, hauteur) {
  if (total <= hauteur) return 0;
  const dessus = Math.min(Math.max(0, curseur - Math.floor(hauteur / 2)), total - hauteur);
  return Math.max(0, dessus);
}

function enTete(vue, etat) {
  const c = vue?.compte ?? {};
  const groupe = etat.parApp ? 'par APP' : 'par ORCHESTRATEUR';
  return `VUE DU PARC ─── ${groupe} · ${c.orchestrateurs ?? '?'} orchestrateurs · ${c.epicsLus ?? '?'} epics${vue?.quand ? ` · lu ${vue.quand}` : ''}`;
}

function pied(etat, largeur) {
  if (etat.mode === 'recherche') return `/ ${etat.recherche}▏  (Entrée valide · Échap annule)`;
  const filtres = [];
  // 🔴 UN FILTRE ACTIF SE DIT. Sans cette ligne, un arbre vide sous « n » se lit « plus rien
  // n'attend personne » — l'exact contraire de ce que le filtre montre.
  if (etat.nonPrisSeuls) filtres.push('FILTRE : non-pris seuls');
  if (etat.recherche) filtres.push(`RECHERCHE : « ${etat.recherche} »`);
  // ⚠️ LE FILTRE PASSE AVANT LES RACCOURCIS, ET IL PREND SA PLACE SUR EUX. Dire qu'un filtre
  // est actif importe plus que rappeler une touche : sans lui, l'arbre ment ; sans eux, on
  // cherche une touche. Les raccourcis se rétractent donc de ce que le filtre occupe.
  const tete = filtres.length ? `${filtres.join('  ·  ')}  ─  ` : '';
  return tete + raccourcisPour(Math.max(0, largeur - tete.length));
}

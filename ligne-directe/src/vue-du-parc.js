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

import { CODE_LISIBLE, codeDuMandat, familleDuMandat, CHAMP_DU_CODE, transportServiceDesk } from './mandat.js';

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

/** La carte d'identité rendue pour un agent sur une ligne. */
function carteDe(agent) {
  return {
    nom: nomLisible(agent),
    pane: agent?.pane ?? null,
    session: agent?.session ?? null,
    statut: agent?.statut ?? null,
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
    const corpsEpics = await appeler('epics', { action: 'list', project_id: chantier.id, limit: limite });
    const tousEpics = Object.values(corpsEpics || {}).find((v) => Array.isArray(v)) || [];
    // 🔴 ON VÉRIFIE QUE LE FILTRE A FILTRÉ. Un filtre ignoré rend la base entière : sans ce
    // second tamis, la vue rattacherait à cet orchestrateur les epics de TOUTES les
    // applications, et chacun aurait l'air d'un fait mesuré.
    const epics = tousEpics.filter((e) => e?.project_id === chantier.id);
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
      try {
        const corpsT = await appeler('tickets', { action: 'list', limit: limite });
        const tous = Object.values(corpsT || {}).find((v) => Array.isArray(v)) || [];
        // Idem : `tickets` list n'honore pas tous ses filtres. On tamise sur `epic_id`.
        stories = tous.filter((t) => t?.epic_id === e.id);
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
export async function laVueDuParc({ recensement = null, lireChantier = null, journaliser = () => {} } = {}) {
  const quand = recensement?.quand ?? null;
  const liste = recensement?.agents;

  // ⚠️ UNE PANNE DE REGISTRE N'EST PAS UN PARC VIDE — la garde du recensement, reprise ici sur
  // son propre objet. Rendre `orchestrateurs: []` afficherait une vue impeccable et déserte.
  if (liste === null || liste === undefined) {
    const raison = recensement?.inventaireRefuse ?? 'le recensement ne m’a rendu aucun agent';
    journaliser(`vue du parc — SANS REGISTRE : ${raison}. Ceci n’est PAS « personne ne travaille ».`);
    return {
      quand,
      registre: { mesure: 'refusé', raison },
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
  for (const a of agents) {
    if (roleEtabli(a) !== 'orchestrateur') continue;
    dansUneHierarchie.add(cleDeLAgent(a));
    const code = codePorteEnMandat(a);

    // ⚠️ UN MANDAT QUI N'EST PAS UN CODE N'EST PAS UNE ERREUR. `matapedia` a pour mandat
    // `matapedia`, `general` a `general` : leur lieu est valide, leur chantier n'est traçable
    // nulle part. On les garde, SANS leur inventer de chantier — et surtout sans chercher le
    // chantier « qui ressemble le plus », qui est le geste que HS-VUE-002 interdit.
    if (!code) {
      orchestrateurs.push({
        agent: carteDe(a),
        chantier: {
          mesure: 'non établi',
          code: null,
          pourquoi: `son mandat « ${a?.mandat ?? '—'} » n’est pas un code de chantier : il ne se lit nulle part`,
        },
        epics: null,
      });
      continue;
    }

    if (typeof lireChantier !== 'function') {
      orchestrateurs.push({
        agent: carteDe(a),
        chantier: { mesure: 'non mesurée', code, raison: 'aucun accès au ServiceDesk ne m’a été donné' },
        epics: null,
      });
      continue;
    }

    let chantier;
    try {
      chantier = await lireChantier(code);
    } catch (err) {
      orchestrateurs.push({
        agent: carteDe(a),
        chantier: {
          mesure: 'non mesurée',
          code,
          raison: `le ServiceDesk n’a pas répondu sur ${code} (${err?.message || err})`,
        },
        // ⚠️ `null`, PAS `[]` — « je n'ai pas pu lire ses epics », jamais « il n'en a aucun ».
        epics: null,
      });
      continue;
    }

    // ⚠️ ICI `[]` EST UNE MESURE, et c'est le 3ᵉ G/W/T de T-20260822-0013 : un orchestrateur
    // dont le chantier ne porte aucun epic APPARAÎT, avec son chantier et rien dessous. Il
    // n'est pas omis — un orchestrateur sans epic n'est pas un orchestrateur absent.
    const epicsLus = Array.isArray(chantier?.epics) ? chantier.epics : [];
    orchestrateurs.push({
      agent: carteDe(a),
      chantier: {
        mesure: 'lue',
        code,
        titre: chantier?.titre ?? null,
        statut: chantier?.statut ?? null,
        // 🔴 L'ÉCART TRAVERSE, IL NE MEURT PAS ICI — et il mourait ici. `lecteurDeChantier`
        // calcule `epicsEcartes` avec soin, en écrivant « l'écart ne disparaît pas » ; cette
        // couche ne recopiait que code/titre/statut, et le chiffre s'évanouissait juste avant
        // l'endroit où il compte : la ligne que lit le dirigeant. Deux étages justes, et la
        // jointure entre eux gardée par personne — la forme même que ce lot a payée deux fois.
        epicsEcartes: chantier?.epicsEcartes ?? 0,
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
        };
      }),
    });
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
    // ⚠️ UN FILTRE QUI N'A PAS FILTRÉ EST UN FAIT, PAS UN DÉTAIL D'IMPLÉMENTATION. S'il n'est
    // pas nul, le ServiceDesk a rendu des epics d'autres chantiers et c'est NOUS qui les avons
    // écartés — le lecteur doit savoir que la garde a servi, sinon personne n'ira voir pourquoi.
    epicsEcartes: orchestrateurs.reduce((n, o) => n + (o.chantier.epicsEcartes ?? 0), 0),
    // ⚠️ LE DÉNOMINATEUR VOYAGE AVEC LE COMPTE. Voir plus haut : un nombre d'ambiguïtés sans
    // l'ensemble sur lequel il a été compté n'est pas vérifiable, et se compare à tort à un
    // autre nombre compté ailleurs.
    entreesComparees: agents.length,
  };

  return {
    quand,
    registre: { mesure: 'lu' },
    orchestrateurs,
    horsHierarchie,
    panesAmbigus,
    compte,
    resume: resumeDeLaVue(compte, recensement),
    // La borne du recensement traverse la vue SANS ÊTRE RÉÉCRITE : le compte reste un PLANCHER,
    // et les sessions muettes restent nommées. Une vue qui perdrait cette borne présenterait
    // comme le parc ce qui n'en est qu'une tranche.
    borne: recensement?.borne ?? null,
    regle: REGLE_DE_LA_VUE,
  };
}

function resumeDeLaVue(compte, recensement) {
  const muettes = recensement?.borne?.sessionsRefusees?.length ?? 0;
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
    (muettes ? ` ⚠️ ${muettes} session(s) herdr n’ont pas répondu : ce compte est amputé d’autant.` : '')
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
    const nom = o.agent.nom ?? `ANONYME (${o.agent.pane})`;
    const c = o.chantier;
    const tete =
      c.mesure === 'lue'
        ? `${c.code}${c.titre ? ` · ${c.titre}` : ''}`
        : c.mesure === 'non établi'
          ? `chantier ${MOT_NON_ETABLI} — ${c.pourquoi}`
          : `chantier ${c.code} NON MESURÉ — ${c.raison}`;
    l.push(`${nom} — ${tete}   [${o.agent.pane}]`);

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

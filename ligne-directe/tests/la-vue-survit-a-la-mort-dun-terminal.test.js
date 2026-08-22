// LA VUE SURVIT À LA MORT D'UN TERMINAL — et distingue l'affirmé du mesuré, et rend adressable.
// (E-20260822-0003, sous P-20260822-0001 — T-20260822-0015 / 0016 / 0017.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE FICHIER FERME, MESURÉ SUR CE POSTE LE 2026-08-22
//
// `laVueDuParc` énumérait `recensement.agents` — c'est-à-dire LES PANES VIVANTS, et rien
// d'autre. Un chantier dont l'orchestrateur a fermé son terminal ne disparaissait pas d'une
// colonne : il disparaissait ENTIÈREMENT, avec ses epics et ses stories, sans qu'une ligne ne
// dise qu'il avait existé.
//
// 🔴 CE N'EST PAS UNE CRAINTE, C'EST UN COMPTE. Mesuré à la main sur le poste, le 2026-08-22 :
//
//   • **15 mandats distincts** portent un lieu d'orchestrateur sur le disque — sur 116 chemins,
//     le même mandat vivant dans plusieurs worktrees du même dépôt ;
//   • **9 mandats** sont portés par un pane vivant que `herdr pane list` a rendu.
//
//   → **6 chantiers étaient invisibles à la vue**, dont `d-20260813-0005`, qui porte à lui seul
//     douze lieux sur le disque. Le travail était là ; personne ne pouvait le voir.
//
// ⚠️ LE COMPTE DES VIVANTS EST UN PLANCHER, et il le reste ici : l'instrument qui les rend a
// une complétude variable. C'est précisément pourquoi l'absence d'un pane NE PROUVE PAS une
// mort — voir la garde du troisième état, plus bas.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI PORTE LE TRAVAIL QUAND LE TERMINAL EST MORT — et ce n'est pas une invention de ce lot
//
// `roles.js` l'écrit noir sur blanc, au sujet des lieux d'orchestrateur :
//
//   > « ces lieux SONT l'inventaire : les lister, c'est voir qui vit ici — aucun registre local
//   >   ne les recopie, le ServiceDesk faisant foi sur les chantiers eux-mêmes. »
//
// C'est RA-VUE-002 : **le rattachement se lit au REGISTRE — le lieu versionné — jamais du
// terminal.** Le pane n'ajoute qu'une ADRESSE, et une adresse est volatile.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { laVueDuParc, rendreLaVue } from '../src/vue-du-parc.js';

// ═══════════════════════════════════════════════════════════════════════════════════════
// LES DOUBLES — la forme que rendent les vraies sources, pas celle qu'on imagine
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Une entrée de recensement pour un orchestrateur VIVANT. */
function unOrchestrateurVivant({
  pane = 'w8X:p6',
  session = 'somtech',
  nom = 'kamouraska',
  mandat = 'p-20260822-0001',
  titre = '◐ Kamouraska orchestrateur P-20260822-0001',
  statut = 'idle',
  enVol = null,
} = {}) {
  return {
    pane,
    session,
    nom: { mesure: 'lu', valeur: nom, source: 'le registre des agents' },
    role: { mesure: 'établi', nom: 'orchestrateur', libelle: 'orchestrateur' },
    mandat,
    lieu: `/depot/.orchestrateur/${mandat}`,
    // ⚠️ LA CLÉ EST OMISE QUAND herdr NE LA REND PAS — mesuré : 73 panes sur 76 portent
    // `terminal_title`, les 3 autres n'ont PAS la clé. Écrire `titre: null` serait inventer une
    // forme que la source ne produit pas — le défaut que `formes-reelles.js` existe pour fermer.
    ...(titre === undefined ? {} : { titre }),
    statut,
    travailEnVol:
      enVol === null
        ? { mesure: 'non mesurée', raison: 'aucun lecteur d’écran ne m’a été donné', enVol: null }
        : { mesure: 'lue', enVol, occupe: enVol, shells: 0, sousAgents: 0 },
  };
}

/** Ce que rend `lecteurDeLieux` — le registre DURABLE, qui ne dépend d'aucun pane. */
function desLieux(mandats, { racines = ['/depot'] } = {}) {
  return {
    mesure: 'lue',
    racines,
    entrees: mandats.map((m) => ({
      role: 'orchestrateur',
      mandat: m,
      chemins: [`/depot/.orchestrateur/${m}`],
    })),
  };
}

/** Un recensement dont TOUTES les sessions ont répondu : une absence y est une mesure. */
const borneComplete = { sessionsInterrogees: 3, sessionsRefusees: [] };
/** Un recensement AMPUTÉ : une absence n'y prouve rien. */
const borneAmputee = {
  sessionsInterrogees: 13,
  sessionsRefusees: [{ session: 'progex', raison: 'server_not_running' }],
};

/** Un lecteur de chantier qui rend toujours le même arbre, et compte ses appels. */
function unLecteur(parCode = {}) {
  const vus = [];
  const f = async (code) => {
    vus.push(code);
    const c = parCode[code];
    if (!c) throw new Error(`${code} ne figure pas dans les chantiers lus`);
    return c;
  };
  f.vus = vus;
  return f;
}

const unChantier = (code, epics = []) => ({
  code,
  titre: `chantier ${code}`,
  statut: 'in_progress',
  epics,
  epicsEcartes: 0,
  epicsPlafonnes: false,
});

const unEpic = (code, stories = []) => ({
  code,
  titre: `epic ${code}`,
  statut: 'in_execution',
  stories,
  storiesPlafonnees: false,
  storiesEcartees: 0,
});

/** Ne garde du rendu que LE TRAVAIL — chantiers, epics, stories. Pas l'agent, pas l'adresse. */
function leTravailSeul(vue) {
  return (vue.orchestrateurs ?? [])
    .map((o) => ({
      chantier: o.chantier?.code ?? null,
      titre: o.chantier?.titre ?? null,
      statut: o.chantier?.statut ?? null,
      epics: (o.epics ?? []).map((e) => ({
        code: e.code,
        stories: (e.stories ?? []).map((s) => s.code),
      })),
    }))
    .sort((a, b) => String(a.chantier).localeCompare(String(b.chantier)));
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0015 — LE TRAVAIL SURVIT AU TERMINAL
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un chantier dont l’agent a FERMÉ SON TERMINAL reste visible, avec ses epics et ses stories', async () => {
  // Le cas décisif de l'epic : `P-20260822-0001` a un lieu sur le disque, et AUCUN pane ne le
  // porte. Avant ce lot, il n'apparaissait nulle part — pas « sans agent », ABSENT.
  const vue = await laVueDuParc({
    recensement: { quand: 'T', agents: [], borne: borneComplete },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({
      'P-20260822-0001': unChantier('P-20260822-0001', [unEpic('E-20260822-0003', [{ code: 'T-20260822-0015', titre: 'la survie' }])]),
    }),
  });

  assert.equal(vue.orchestrateurs.length, 1, 'le chantier du lieu doit FIGURER, même sans aucun pane vivant');
  const o = vue.orchestrateurs[0];
  assert.equal(o.chantier.code, 'P-20260822-0001');
  assert.equal(o.chantier.mesure, 'lue', 'son chantier a bien été lu au ServiceDesk');
  assert.equal(o.epics.length, 1, 'ses epics restent visibles');
  assert.equal(o.epics[0].stories.length, 1, 'et ses stories aussi — le travail entier survit');
});

test('le travail attribué à un chantier sans terminal l’est PAR SON LIEU — jamais par un agent deviné', async () => {
  const vue = await laVueDuParc({
    recensement: { quand: 'T', agents: [], borne: borneComplete },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  const o = vue.orchestrateurs[0];
  assert.equal(o.agent, null, 'aucun agent n’est INVENTÉ : le lieu ne nomme pas d’agent');
  assert.equal(o.porteur.mesure, 'lue', 'le rattachement, lui, EST mesuré — au lieu');
  assert.match(o.porteur.source, /lieu/i, 'et sa source est nommée : le lieu versionné');
  assert.deepEqual(o.porteur.lieux, ['/depot/.orchestrateur/p-20260822-0001']);
});

test('SANS AUCUN TERMINAL JOIGNABLE, LE TRAVAIL AFFICHÉ EST LE MÊME — seule l’adressabilité disparaît', async () => {
  // 🔴 C'EST LE CRITÈRE QUI DÉCIDE DE TOUT LE LOT (T-20260822-0015, 2ᵉ G/W/T). Il ne peut
  // passer que si l'ossature de la vue vient du REGISTRE et non des panes : toute construction
  // qui énumère les vivants rendra deux travaux différents.
  const mandats = ['p-20260822-0001', 'd-20260813-0005'];
  const chantiers = {
    'P-20260822-0001': unChantier('P-20260822-0001', [unEpic('E-20260822-0003', [{ code: 'T-20260822-0015' }])]),
    'D-20260813-0005': unChantier('D-20260813-0005', [unEpic('E-20260813-0009', [{ code: 'T-20260813-0044' }])]),
  };

  const avecTerminaux = await laVueDuParc({
    recensement: {
      quand: 'T',
      borne: borneComplete,
      agents: [
        unOrchestrateurVivant({ pane: 'w8X:p6', mandat: 'p-20260822-0001', nom: 'kamouraska' }),
        unOrchestrateurVivant({ pane: 'w2:p1', mandat: 'd-20260813-0005', nom: 'matane' }),
      ],
    },
    lieux: desLieux(mandats),
    lireChantier: unLecteur(chantiers),
  });

  const sansAucunTerminal = await laVueDuParc({
    recensement: { quand: 'T', agents: [], borne: borneComplete },
    lieux: desLieux(mandats),
    lireChantier: unLecteur(chantiers),
  });

  assert.deepEqual(
    leTravailSeul(sansAucunTerminal),
    leTravailSeul(avecTerminaux),
    'le TRAVAIL doit être identique : c’est l’adresse qui est volatile, pas le chantier'
  );
  assert.equal(avecTerminaux.orchestrateurs[0].adresse.mesure, 'lue', 'avec terminal : une adresse');
  assert.equal(sansAucunTerminal.orchestrateurs[0].adresse.mesure, 'aucune', 'sans terminal : AUCUNE adresse — et c’est dit');
});

test('un agent dont on N’A PAS PU ÉTABLIR s’il vit n’est présumé NI MORT NI VIVANT', async () => {
  // ⚠️ LA BORNE DÉCIDE, PAS L'ABSENCE. Une session muette veut dire que des panes existent
  // qu'on n'a pas vus : conclure « son terminal est mort » depuis ce silence, c'est tirer un
  // verdict d'une ABSENCE — le geste que ce module interdit partout ailleurs.
  const vue = await laVueDuParc({
    recensement: { quand: 'T', agents: [], borne: borneAmputee },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  const p = vue.orchestrateurs[0].presence;
  assert.equal(p.mesure, 'non établie', 'la présence n’a pas pu être mesurée');
  assert.equal(p.vivant, null, 'ni true ni FALSE : `false` affirmerait une mort qu’on n’a pas constatée');
  assert.match(p.pourquoi, /muette/i, 'et la raison nomme ce qui manque : une session n’a pas répondu');
});

test('quand TOUTES les sessions ont répondu, l’absence de pane EST une mesure — et se dit autrement', async () => {
  // Le symétrique du précédent, et il est indispensable : sans lui, rendre `vivant: null` en
  // toute circonstance passerait, et la vue ne saurait plus jamais dire « celui-là est parti ».
  const vue = await laVueDuParc({
    recensement: { quand: 'T', agents: [], borne: borneComplete },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  const p = vue.orchestrateurs[0].presence;
  assert.equal(p.mesure, 'lue', 'toutes les sessions ont répondu : l’absence est un constat');
  assert.equal(p.vivant, false, 'aucun terminal ne porte ce mandat — mesuré, pas supposé');
});

test('un mandat porté À LA FOIS par un lieu et par un pane vivant ne produit PAS deux lignes', async () => {
  // Sans cette garde, chaque chantier vivant apparaîtrait en double dès l'ajout des lieux : une
  // fois par son agent, une fois par son lieu. Le dirigeant lirait deux chantiers là où il y en a un.
  const vue = await laVueDuParc({
    recensement: {
      quand: 'T',
      borne: borneComplete,
      agents: [unOrchestrateurVivant({ mandat: 'p-20260822-0001' })],
    },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  assert.equal(vue.orchestrateurs.length, 1, 'un seul chantier, une seule ligne');
  assert.equal(vue.orchestrateurs[0].presence.vivant, true, 'et c’est la ligne VIVANTE qui gagne');
});

test('un lieu que la vue N’A PAS PU LISTER ne se rend pas comme « aucun lieu »', async () => {
  // ⚠️ ON ÉPROUVE LA PANNE DE LA MESURE, PAS SEULEMENT L'ABSENCE — la consigne de l'epic. Un
  // `lieux: { mesure: 'refusée' }` replié en « il n'y a aucun lieu » rendrait une vue amputée
  // avec l'apparence d'une vue complète.
  const vue = await laVueDuParc({
    recensement: { quand: 'T', agents: [], borne: borneComplete },
    lieux: { mesure: 'refusée', raison: 'le disque n’a pas répondu', racines: ['/depot'], entrees: null },
    lireChantier: unLecteur({}),
  });

  assert.equal(vue.registreDesLieux.mesure, 'refusée', 'le refus TRAVERSE : il ne se replie pas en zéro');
  assert.match(vue.resume, /lieux/i, 'et le résumé le dit — sans quoi personne ne l’apprendrait');
  assert.match(rendreLaVue(vue), /lieux/i, 'jusque dans le texte que lit le dirigeant');
});

test('la vue dit OÙ elle a cherché des lieux — une borne sans son périmètre n’est pas une borne', async () => {
  const vue = await laVueDuParc({
    recensement: { quand: 'T', agents: [], borne: borneComplete },
    lieux: desLieux(['p-20260822-0001'], { racines: ['/a', '/b'] }),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  assert.deepEqual(vue.registreDesLieux.racines, ['/a', '/b']);
  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('/a') && texte.includes('/b'), 'les racines cherchées se lisent : un lieu hors d’elles n’a pas été vu');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0016 — L'AFFIRMÉ NE SE FOND JAMAIS DANS LE MESURÉ
// ═══════════════════════════════════════════════════════════════════════════════════════

test('l’activité d’un agent dont l’écran n’a pas été lu est NON MESURÉE — jamais « idle », jamais « au repos »', async () => {
  // 🔴 `agent_status` EST TAUTOLOGIQUE : `idle` veut dire « vu au registre », pas « au repos ».
  // Le rendre tel quel fait lire un constat de repos là où il n'y a eu aucune mesure.
  const vue = await laVueDuParc({
    recensement: {
      quand: 'T',
      borne: borneComplete,
      agents: [unOrchestrateurVivant({ statut: 'idle', enVol: null })],
    },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  const a = vue.orchestrateurs[0].activite;
  assert.equal(a.mesure, 'non mesurée');
  assert.equal(a.enVol, null, 'ni true ni false : rien n’a été mesuré');
  assert.doesNotMatch(rendreLaVue(vue), /\bidle\b/, 'et « idle » ne se lit NULLE PART : c’est un mot d’instrument, pas un fait');
});

test('l’activité LUE À L’ÉCRAN est rendue comme mesurée, et sa source est nommée', async () => {
  const vue = await laVueDuParc({
    recensement: {
      quand: 'T',
      borne: borneComplete,
      agents: [unOrchestrateurVivant({ enVol: true })],
    },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  const a = vue.orchestrateurs[0].activite;
  assert.equal(a.mesure, 'lue');
  assert.equal(a.enVol, true);
  assert.match(a.source, /écran/i, 'le seul témoin d’activité qui ait tenu, et il se nomme');
});

test('le statut d’un chantier est AFFIRMÉ par le registre — la vue ne le présente jamais comme un constat', async () => {
  const vue = await laVueDuParc({
    recensement: { quand: 'T', agents: [], borne: borneComplete },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  const c = vue.orchestrateurs[0].chantier;
  assert.equal(c.statut, 'in_progress');
  assert.equal(c.natureDuStatut, 'affirmé', 'le ServiceDesk AFFIRME, il ne mesure pas : quelqu’un l’a écrit, ça peut dater');
  assert.match(rendreLaVue(vue), /affirmé/i, 'et le mot se lit sur la ligne — c’est là que se joue EF-VUE-005');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0017 — CHAQUE LIGNE VIVANTE PORTE DE QUOI L'ATTEINDRE
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la ligne d’un agent vivant porte SON TITRE DE FENÊTRE EN PREMIER, puis son pane avec sa session', async () => {
  // 🔴 CE QUE LE DIRIGEANT RECONNAÎT EST LE TITRE, PAS `w7M:p2` — cas réel : le pane, la
  // session, le dossier et le nom lui avaient été donnés, et il a répondu « je trouve pas ».
  const vue = await laVueDuParc({
    recensement: {
      quand: 'T',
      borne: borneComplete,
      agents: [unOrchestrateurVivant({ pane: 'w8X:p6', session: 'somtech', titre: '◐ Kamouraska orchestrateur P-20260822-0001' })],
    },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  const ad = vue.orchestrateurs[0].adresse;
  assert.equal(ad.mesure, 'lue');
  assert.equal(ad.titre, '◐ Kamouraska orchestrateur P-20260822-0001');
  assert.equal(ad.pane, 'w8X:p6');
  assert.equal(ad.session, 'somtech', 'la session VOYAGE avec le pane : un pane seul désigne deux agents');

  const ligne = rendreLaVue(vue).split('\n').find((l) => l.includes('w8X:p6'));
  assert.ok(ligne, 'le pane se lit sur la ligne');
  assert.ok(
    ligne.indexOf('Kamouraska orchestrateur') < ligne.indexOf('w8X:p6'),
    'LE TITRE SE LIT AVANT LE PANE — c’est l’ordre qui décide de l’utilité, pas la présence des deux'
  );
  assert.ok(ligne.includes('somtech'), 'et la session accompagne le pane');
});

test('un agent vivant SANS titre de fenêtre garde son pane, et l’absence de titre est dite', async () => {
  // Mesuré : 3 panes sur 76 n'ont PAS la clé `terminal_title`. Rendre « undefined » au
  // dirigeant, ou taire l'adresse entière, sont deux fautes différentes.
  const vue = await laVueDuParc({
    recensement: {
      quand: 'T',
      borne: borneComplete,
      agents: [unOrchestrateurVivant({ titre: undefined })],
    },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  const ad = vue.orchestrateurs[0].adresse;
  assert.equal(ad.mesure, 'lue', 'le pane suffit à atteindre : l’adresse existe');
  assert.equal(ad.titre, null);
  assert.doesNotMatch(rendreLaVue(vue), /undefined/, 'aucune coercition JS ne fuit dans un texte destiné à être lu');
});

test('un agent DONT LE TERMINAL N’EXISTE PLUS ne se voit proposer AUCUNE adresse — pas un identifiant périmé', async () => {
  const vue = await laVueDuParc({
    recensement: { quand: 'T', agents: [], borne: borneComplete },
    lieux: desLieux(['p-20260822-0001']),
    lireChantier: unLecteur({ 'P-20260822-0001': unChantier('P-20260822-0001') }),
  });

  const ad = vue.orchestrateurs[0].adresse;
  assert.equal(ad.mesure, 'aucune');
  assert.equal(ad.pane, null, 'aucun identifiant périmé n’est laissé en place');
  assert.equal(ad.titre, null);
  assert.match(ad.pourquoi, /terminal/i, 'et l’absence d’adresse EST DITE, elle n’est pas un blanc');
  assert.match(rendreLaVue(vue), /aucune adresse/i);
});

test('deux sessions portant LE MÊME identifiant de pane restent DEUX lignes, chacune nommant sa session', async () => {
  // Mesuré sur ce poste : `w7:p1` vit dans `somtech` ET dans `progex`. Une adresse sans sa
  // session enverrait le dirigeant chez le mauvais agent.
  const vue = await laVueDuParc({
    recensement: {
      quand: 'T',
      borne: borneComplete,
      agents: [
        unOrchestrateurVivant({ pane: 'w7:p1', session: 'somtech', nom: 'un', mandat: 'p-20260822-0001', titre: 'fenêtre UN' }),
        unOrchestrateurVivant({ pane: 'w7:p1', session: 'progex', nom: 'deux', mandat: 'd-20260813-0005', titre: 'fenêtre DEUX' }),
      ],
    },
    lieux: desLieux(['p-20260822-0001', 'd-20260813-0005']),
    lireChantier: unLecteur({
      'P-20260822-0001': unChantier('P-20260822-0001'),
      'D-20260813-0005': unChantier('D-20260813-0005'),
    }),
  });

  assert.equal(vue.orchestrateurs.length, 2, 'deux agents, deux lignes — rien ne les fusionne');
  const texte = rendreLaVue(vue);
  const lignes = texte.split('\n').filter((l) => l.includes('w7:p1'));
  assert.equal(lignes.length, 2);
  assert.ok(lignes.some((l) => l.includes('somtech')) && lignes.some((l) => l.includes('progex')),
    'chacune NOMME SA SESSION : c’est ce qui les distingue');
});

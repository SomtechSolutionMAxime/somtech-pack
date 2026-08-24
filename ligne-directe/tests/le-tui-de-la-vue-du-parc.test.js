// LE TUI DE LA VUE DU PARC — l'écran que le dirigeant pilote
// (E-20260824-0005, sous D-20260824-0003 — stories T-…-0032, T-…-0033, T-…-0034.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER ÉPROUVE, ET CE QU'IL NE PEUT PAS ÉPROUVER
//
// Il éprouve TOUT ce qui décide : l'arbre, le groupement, les noms, le « non pris », les
// touches et leurs effets, le texte de l'écran. Rien de tout cela ne touche un terminal —
// c'est pourquoi `tui-vue-du-parc.js` est pur, et c'est délibéré.
//
// 🔴 IL N'ÉPROUVE PAS L'ARÊTE DU TERMINAL, et aucun banc ne le peut. Le mode brut, le redraw,
// le resize, le `herdr agent focus` d'un pane franchissent un PROCESSUS : le code peut être
// juste des deux côtés et l'écran sortir vide quand même — c'est arrivé au geste `vue`, et il
// a fallu TAPER LA COMMANDE pour le voir. Cette arête-là s'EXERCE, et elle l'a été.
//
// ⚠️ LES DONNÉES ENTRENT PAR LA CHAÎNE RÉELLE — vrais lieux posés sur le disque, vrai
// recensement, vrai `lecteurDeChantier`. Un seul point est substitué, nommé : le transport
// HTTP vers le ServiceDesk. Un double du lecteur écrit à la main fabriquerait les défauts
// qu'il devrait trouver — ce module l'a déjà payé trois fois (`aide/formes-reelles.js`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unRecensement } from '../src/recensement.js';
import { roleDuLieu } from '../src/lieu-agent.js';
import { role as roleDe } from '../src/roles.js';
import { laVueDuParc, lecteurDeChantier, lecteurDeLieux, MOT_NON_ETABLI } from '../src/vue-du-parc.js';
import {
  arbreDeLaVue,
  lignesVisibles,
  rendreEcran,
  detailDe,
  appliquerTouche,
  etatInitial,
  estFerme,
  nonPrisDe,
  ETATS_FERMES,
  APP_NON_ETABLIE,
  texteDeLigne,
  raccourcisPour,
  RACCOURCIS,
} from '../src/tui-vue-du-parc.js';
import { decoderTouche, decoderTouches, texteDeProgression, servirLaVue, mettreEnFocus } from '../src/tui-boucle.js';
import { unPaneDAgent } from './aide/formes-reelles.js';

const racine = () => mkdtempSync(join(tmpdir(), 'tui-vue-du-parc-'));

const METIER = { orchestrateur: "# Tu es l'orchestrateur de ce chantier\n\nle métier du jour.\n" };
const CONTEXTE = { orchestrateur: "# Ce qui est propre à ce dépôt\n\nrien.\n" };

/** Un lieu POSÉ POUR DE VRAI — un double non conforme fabrique les défauts qu'il devrait trouver. */
function poserLieu(depot, nom) {
  const lieu = join(depot, roleDe('orchestrateur').dossier, nom);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), METIER.orchestrateur);
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE.orchestrateur);
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

const nomsLus = (entrees) => ({
  mesure: 'lue',
  noms: new Map(entrees.map(([pane, nom, session]) => [`${session ?? ''}\u0000${pane}`, nom])),
});

/**
 * UN TRANSPORT DE BANC — le SEUL point substitué, et il est nommé.
 *
 * Il rend ce que le ServiceDesk rend : les enveloppes par famille, avec leurs noms de champs
 * réels (`project_id`, `epic_id`, `ticket_id`, `application_id`, `status`, `title`).
 */
function unServiceDesk({ projets = [], epics = [], tickets = [], applications = [] } = {}) {
  const appels = [];
  const appeler = async (nom, args) => {
    appels.push(nom);
    if (nom === 'projects') return { projects: projets };
    if (nom === 'applications') return { applications };
    if (nom === 'epics') return { epics: epics.filter((e) => e.project_id === args?.project_id) };
    return { tickets: tickets.filter((t) => t.epic_id === args?.epic_id) };
  };
  return { appeler, appels };
}

/** La vue, construite par la chaîne réelle. */
async function uneVue({ tmp, agents = [], service }) {
  const recensement = await unRecensement({
    panes: agents.map((a) => unPaneDAgent({ pane_id: a.pane, foreground_cwd: a.lieu })),
    roleDuLieu,
    nomsConnus: nomsLus(agents.map((a) => [a.pane, a.nom, undefined])),
  });
  return laVueDuParc({ recensement, lireChantier: lecteurDeChantier({ appeler: service.appeler }) });
}

/** Le texte de l'arbre, ligne à ligne, tel que l'écran le peint. */
const texteDeLArbre = (vue, etat) => {
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: etat.parApp }), etat);
  return { lignes, textes: lignes.map((l) => texteDeLigne(l, 90)) };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260824-0033 — GROUPÉ PAR APP, ET L'APP EST LUE (D-20260824-0003, point 1)
// ═══════════════════════════════════════════════════════════════════════════════════════

test('l’arbre groupe par APP, et l’app vient de la DONNÉE du ServiceDesk — jamais devinée du nom', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');

  const service = unServiceDesk({
    applications: [{ id: 'a1', name: 'Somtech Pack' }],
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Voir qui travaille', status: 'active', application_id: 'a1' }],
    epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'Un epic', status: 'in_execution' }],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const { textes } = texteDeLArbre(vue, etatInitial());
  const iApp = textes.findIndex((l) => l.includes('SOMTECH PACK'));
  const iOrch = textes.findIndex((l) => l.includes('kamouraska'));

  assert.ok(iApp >= 0, 'le NOM de l’app lue est une ligne de l’arbre');
  assert.ok(iOrch > iApp, 'et l’orchestrateur se lit SOUS son app');
  // ⚠️ « DEVINÉE DU NOM » EST LE DÉFAUT QU'ON FERME : le nom d'app ne doit pas pouvoir venir
  // du mandat, du dépôt, ni du titre du chantier. Ici seule la donnée le porte.
  assert.ok(!/somtech-pack/i.test(vue.orchestrateurs[0].chantier.titre ?? ''), 'le titre ne porte pas le nom d’app');
  assert.equal(vue.orchestrateurs[0].chantier.application.mesure, 'lue');
  assert.equal(vue.orchestrateurs[0].chantier.application.nom, 'Somtech Pack');
});

test('un chantier dont l’app n’a pas pu être établie va sous « APP NON ÉTABLIE » — jamais au plus plausible', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');
  const avec = poserLieu(d, 'p-20260824-0001');
  const sans = poserLieu(d, 'p-20260824-0002');

  const service = unServiceDesk({
    applications: [{ id: 'a1', name: 'Somtech Pack' }],
    projets: [
      { id: 'u1', project_id: 'P-20260824-0001', title: 'Avec app', status: 'active', application_id: 'a1' },
      // ⚠️ AUCUN `application_id` — le cas RÉEL : le ServiceDesk n'en porte pas toujours un.
      { id: 'u2', project_id: 'P-20260824-0002', title: 'Sans app', status: 'active' },
    ],
  });
  const vue = await uneVue({
    tmp,
    agents: [
      { pane: 'w1:p1', lieu: avec, nom: 'kamouraska' },
      { pane: 'w2:p1', lieu: sans, nom: 'matapedia' },
    ],
    service,
  });

  const { textes } = texteDeLArbre(vue, etatInitial());
  const iNon = textes.findIndex((l) => l.includes(APP_NON_ETABLIE));
  const iSomtech = textes.findIndex((l) => l.includes('SOMTECH PACK'));
  const iMatapedia = textes.findIndex((l) => l.includes('matapedia'));

  assert.ok(iNon >= 0, 'le groupe d’absence EXISTE — il ne disparaît pas');
  assert.ok(iMatapedia > iNon, 'et le chantier sans app y est rangé');
  // 🔴 IL FINIT EN DERNIER, ET CE N'EST PAS DE L'ESTHÉTIQUE : ce n'est pas une app parmi les
  // autres, c'est un groupe d'absence. Rangé au milieu, il se lirait comme une app de plus.
  assert.ok(iNon > iSomtech, '« APP NON ÉTABLIE » vient APRÈS les apps réellement lues');
  // ⚠️ ET IL N'A PAS ÉTÉ RANGÉ AU PLUS PLAUSIBLE : le seul autre groupe existant l'aurait pris.
  const sousSomtech = textes.slice(iSomtech + 1, iNon);
  assert.ok(!sousSomtech.some((l) => l.includes('matapedia')), 'il n’a PAS été rangé sous l’app voisine');
});

test('la liste des applications est lue UNE fois pour tout le lecteur — pas une par chantier', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');
  const service = unServiceDesk({
    applications: [{ id: 'a1', name: 'Somtech Pack' }],
    projets: [
      { id: 'u1', project_id: 'P-20260824-0001', title: 'Un', status: 'active', application_id: 'a1' },
      { id: 'u2', project_id: 'P-20260824-0002', title: 'Deux', status: 'active', application_id: 'a1' },
      { id: 'u3', project_id: 'P-20260824-0003', title: 'Trois', status: 'active', application_id: 'a1' },
    ],
  });
  await uneVue({
    tmp,
    agents: [
      { pane: 'w1:p1', lieu: poserLieu(d, 'p-20260824-0001'), nom: 'un' },
      { pane: 'w2:p1', lieu: poserLieu(d, 'p-20260824-0002'), nom: 'deux' },
      { pane: 'w3:p1', lieu: poserLieu(d, 'p-20260824-0003'), nom: 'trois' },
    ],
    service,
  });

  // 🔴 LE COÛT EST CE QUI A ÉTÉ PROMIS EN ARBITRAGE : UN appel de plus au TOTAL. Trois
  // chantiers, trois appels, et la promesse devient quinze allers-retours sur ce poste —
  // ajoutés aux ~70 s déjà mesurées. Ce banc est la seule chose qui tienne la promesse.
  const combien = service.appels.filter((n) => n === 'applications').length;
  assert.equal(combien, 1, `la liste des applications a été lue ${combien} fois pour 3 chantiers`);
});

test('la touche « a » bascule app ↔ orchestrateur SANS relire quoi que ce soit', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  const service = unServiceDesk({
    applications: [{ id: 'a1', name: 'Somtech Pack' }],
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Voir qui travaille', status: 'active', application_id: 'a1' }],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });
  const apresLecture = service.appels.length;

  const { etat: bascule, effet } = appliquerTouche(etatInitial(), 'a', texteDeLArbre(vue, etatInitial()).lignes);

  assert.equal(bascule.parApp, false, '« a » bascule le groupement');
  // 🔴 AUCUN EFFET : relire coûterait ~70 s pour une donnée qu'on tient déjà. C'est un geste
  // de mise en page, jamais une lecture.
  assert.equal(effet, null, '« a » ne déclenche AUCUN effet — surtout pas une relecture');
  assert.equal(service.appels.length, apresLecture, 'et rien n’a été redemandé au ServiceDesk');

  const { textes } = texteDeLArbre(vue, bascule);
  assert.ok(!textes.some((l) => l.includes('SOMTECH PACK')), 'par orchestrateur, l’app n’est plus une ligne d’arbre');
  assert.ok(textes.some((l) => l.includes('kamouraska')), 'et l’orchestrateur est en tête');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260824-0033 — DES NOMS DANS L'ARBRE, LES IDs DANS LE DÉTAIL SEULEMENT
//
// 🔴 SES MOTS : « P-20260822-0001 ne me dit absolument rien ». Un arbre d'identifiants est un
// arbre qu'on ne peut pas piloter.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('AUCUN identifiant ServiceDesk n’apparaît dans l’arbre — et le détail les porte tous', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  const service = unServiceDesk({
    applications: [{ id: 'a1', name: 'Somtech Pack' }],
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Voir qui travaille sur quoi', status: 'active', application_id: 'a1' }],
    epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-20260824-0009', title: 'Le geste vue répond', status: 'in_execution' }],
    tickets: [{ id: 't1', epic_id: 'e1', ticket_id: 'T-20260824-0055', title: 'Borne par geste', status: 'new' }],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const etat = etatInitial();
  const { lignes, textes } = texteDeLArbre(vue, etat);

  // ⚠️ LA FORME EST CHERCHÉE, PAS LES TROIS CODES DE CE BANC : chercher « P-20260824-0001 »
  // laisserait passer tout code qu'on ajouterait demain. On refuse la FAMILLE.
  const UN_CODE = /\b[DPJETdpjet]-\d{8}-\d{4}\b/;
  const fautives = textes.filter((l) => UN_CODE.test(l));
  assert.deepEqual(fautives, [], 'aucune ligne de l’arbre ne porte de code ServiceDesk');

  // Et les NOMS, eux, y sont — les trois étages.
  assert.ok(textes.some((l) => l.includes('Voir qui travaille sur quoi')), 'le titre du chantier');
  assert.ok(textes.some((l) => l.includes('Le geste vue répond')), 'le titre de l’epic');
  assert.ok(textes.some((l) => l.includes('Borne par geste')), 'le titre de la story');

  // 🔴 LE SYMÉTRIQUE, sinon un TUI qui n'afficherait NULLE PART les identifiants passerait :
  // le dirigeant en a besoin pour retrouver la ligne dans le SD, et le détail est leur place.
  const detailDuChantier = detailDe(lignes.find((l) => l.kind === 'orchestrateur')).join('\n');
  const detailDeLEpic = detailDe(lignes.find((l) => l.kind === 'epic')).join('\n');
  const detailDeLaStory = detailDe(lignes.find((l) => l.kind === 'story')).join('\n');
  assert.match(detailDuChantier, /P-20260824-0001/, 'le détail du chantier porte son code');
  assert.match(detailDeLEpic, /E-20260824-0009/, 'le détail de l’epic porte le sien');
  assert.match(detailDeLaStory, /T-20260824-0055/, 'et celui de la story aussi');
});

test('le statut ne sort JAMAIS nu dans le détail — il porte sa nature d’affirmé (EF-VUE-005)', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Un chantier', status: 'active' }],
    epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'Un epic', status: 'in_execution' }],
    tickets: [{ id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'Une story', status: 'in_progress' }],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });
  const { lignes } = texteDeLArbre(vue, etatInitial());

  // 🔴 POSÉ À CÔTÉ D'UNE PRÉSENCE MESURÉE, un statut nu se lit comme un CONSTAT — le défaut
  // qui a coûté la journée du 21 août. Les trois étages le portent, pas seulement le chantier.
  for (const kind of ['orchestrateur', 'epic', 'story']) {
    const texte = detailDe(lignes.find((l) => l.kind === kind)).join('\n');
    const ligneDuStatut = texte.split('\n').find((l) => l.startsWith('statut'));
    assert.ok(ligneDuStatut, `l’étage « ${kind} » rend un statut`);
    assert.match(ligneDuStatut, /\(affirmé\)/, `et l’étage « ${kind} » dit qu’il est AFFIRMÉ, jamais nu`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260824-0034 — LE NON-PRIS SE MESURE, IL NE SE DÉDUIT PAS
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la famille des états fermés est ÉNUMÉRÉE — « cancelled » ferme un epic autant que « completed »', () => {
  // 🔴 TESTER UN SEUL ÉTAT EST LE DÉFAUT NOMMÉ DANS LE BRIEF. `!== 'completed'` ferait
  // apparaître en « ○ NON PRIS » tout ce qui a été ANNULÉ — c'est-à-dire appeler le dirigeant
  // à agir sur du travail que quelqu'un a déjà décidé d'abandonner.
  assert.deepEqual(ETATS_FERMES.epic, ['completed', 'cancelled']);
  // ⚠️ ET LES DEUX FAMILLES NE SE CONFONDENT PAS : les tickets n'ont pas de `cancelled` natif,
  // la convention y ferme par `completed`. Fondre les listes appliquerait à un étage la mesure
  // de l'autre.
  assert.deepEqual(ETATS_FERMES.story, ['completed']);

  assert.equal(estFerme('completed', 'epic'), true);
  assert.equal(estFerme('cancelled', 'epic'), true);
  assert.equal(estFerme('in_execution', 'epic'), false);
  assert.equal(estFerme('draft', 'epic'), false, 'un brouillon n’est PAS fermé — il attend quelqu’un');
  assert.equal(estFerme('cancelled', 'story'), false, 'la famille de l’epic ne s’applique pas à la story');

  // 🔴 « je n'ai pas lu son statut » N'EST PAS « il est ouvert ». Replier l'absence en `false`
  // ferait marquer NON PRIS un élément dont on ne sait rien.
  assert.equal(estFerme(null, 'epic'), null);
  assert.equal(estFerme(undefined, 'story'), null);
});

test('« non pris » exige les DEUX faits — aucun porteur ET un statut ouvert, tous deux mesurés', () => {
  const porte = { mesure: 'lue', source: 's', agents: [{ nom: 'castor', pane: 'w1:p1' }] };
  const personne = { mesure: 'non établi', pourquoi: 'aucun agent', indices: [] };

  assert.equal(nonPrisDe({ attribution: porte, statut: 'in_execution', niveau: 'epic' }).nonPris, false);
  assert.equal(nonPrisDe({ attribution: personne, statut: 'in_execution', niveau: 'epic' }).nonPris, true);
  assert.equal(nonPrisDe({ attribution: personne, statut: 'completed', niveau: 'epic' }).nonPris, false);
  assert.equal(nonPrisDe({ attribution: personne, statut: 'cancelled', niveau: 'epic' }).nonPris, false);

  // 🔴 L'ABSENCE SE MONTRE, ELLE NE SE COMBLE PAS (RA-VUE-003). Sans statut, on ne SAIT pas.
  const sansStatut = nonPrisDe({ attribution: personne, statut: null, niveau: 'epic' });
  assert.equal(sansStatut.nonPris, null, 'jamais `false` — ce serait affirmer qu’il est pris');
  assert.equal(sansStatut.mesure, 'non établie');
  assert.match(sansStatut.pourquoi, /statut n’a pas été mesuré/);

  // ⚠️ UN INDICE N'EST PAS UN PORTEUR (RA-VUE-005) : `quiPorte` rend `mesure: 'non établi'`
  // avec des `indices` quand un agent porte le code comme NOM sans l'avoir à son lieu. Le
  // compter comme porteur ferait disparaître de la liste un travail que personne ne mène.
  const indice = { mesure: 'non établi', pourquoi: 'nom seulement', indices: [{ nom: 'e-1', pane: 'w9:p9' }] };
  assert.equal(nonPrisDe({ attribution: indice, statut: 'in_execution', niveau: 'epic' }).nonPris, true);
});

test('un epic que personne ne porte apparaît « ○ NON PRIS » dans l’arbre, sous son orchestrateur', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Un chantier', status: 'active' }],
    epics: [
      { id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'Personne ne me porte', status: 'in_execution' },
      { id: 'e2', project_id: 'u1', epic_id: 'E-2', title: 'Je suis fermé', status: 'completed' },
      { id: 'e3', project_id: 'u1', epic_id: 'E-3', title: 'Je suis annulé', status: 'cancelled' },
    ],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const { textes } = texteDeLArbre(vue, etatInitial());
  const ligneDe = (titre) => textes.find((l) => l.includes(titre));

  assert.match(ligneDe('Personne ne me porte'), /○ .*NON PRIS/, 'l’ouvert sans porteur est marqué');
  const iOrch = textes.findIndex((l) => l.includes('kamouraska'));
  assert.ok(textes.indexOf(ligneDe('Personne ne me porte')) > iOrch, 'et il est SOUS son orchestrateur');

  // 🔴 LA FAMILLE ÉNUMÉRÉE, LUE SUR L'ÉCRAN : les deux états fermés se taisent tous les deux.
  assert.ok(!/NON PRIS/.test(ligneDe('Je suis fermé')), '« completed » n’est pas non pris');
  assert.ok(!/NON PRIS/.test(ligneDe('Je suis annulé')), '« cancelled » non plus');
});

test('la touche « n » isole les non-pris — et l’écran DIT que le filtre est actif', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Un chantier', status: 'active' }],
    epics: [
      { id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'Personne ne me porte', status: 'in_execution' },
      { id: 'e2', project_id: 'u1', epic_id: 'E-2', title: 'Je suis fermé', status: 'completed' },
    ],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const { etat: filtre } = appliquerTouche(etatInitial(), 'n', texteDeLArbre(vue, etatInitial()).lignes);
  assert.equal(filtre.nonPrisSeuls, true);

  const { lignes, textes } = texteDeLArbre(vue, filtre);
  assert.ok(textes.some((l) => l.includes('Personne ne me porte')), 'le non-pris reste');
  assert.ok(!textes.some((l) => l.includes('Je suis fermé')), 'et le fermé disparaît');

  // 🔴 UN FILTRE ACTIF SE DIT. Sans cette ligne, un arbre subitement court — ou VIDE — se lit
  // « plus rien n'attend personne », l'exact contraire de ce que le filtre montre. Et c'est
  // arrivé : à la première capture réelle, `n` rendait 0 ligne sur 452, écran muet.
  const ecran = rendreEcran({ vue, etat: filtre, lignes, largeur: 110, hauteur: 12 });
  const pied = ecran[ecran.length - 1].texte;
  assert.match(pied, /FILTRE/, 'le pied de l’écran nomme le filtre actif');
  assert.match(pied, /non-pris/, 'et dit lequel');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260824-0034 — ENTRÉE MET EN FOCUS, ET RIEN D'AUTRE N'EXISTE (HS-VUE-001)
// ═══════════════════════════════════════════════════════════════════════════════════════

test('« Entrée » sur un orchestrateur vivant rend un effet de FOCUS — avec son pane ET sa session', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Un chantier', status: 'active' }],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const { lignes } = texteDeLArbre(vue, etatInitial());
  const iOrch = lignes.findIndex((l) => l.kind === 'orchestrateur');
  const { effet } = appliquerTouche({ ...etatInitial(), curseur: iOrch }, 'entree', lignes);

  assert.equal(effet.type, 'focus');
  assert.equal(effet.pane, 'w1:p1');
  // ⚠️ UN IDENTIFIANT DE PANE NE VOYAGE JAMAIS SEUL. Mesuré : `w7:p1` existe dans `somtech` ET
  // dans `progex`, avec deux agents différents. Un focus sans sa session met le dirigeant
  // devant le terminal de quelqu'un d'autre.
  assert.ok('session' in effet, 'la session voyage avec le pane');
});

test('« Entrée » sur ce qui n’a pas d’adresse REFUSE — et ne suit aucun identifiant périmé', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Un chantier', status: 'active' }],
    epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'Un epic', status: 'in_execution' }],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });
  const { lignes } = texteDeLArbre(vue, etatInitial());

  const iEpic = lignes.findIndex((l) => l.kind === 'epic');
  const { effet } = appliquerTouche({ ...etatInitial(), curseur: iEpic }, 'entree', lignes);
  assert.equal(effet.type, 'refus', 'un epic ne porte aucun terminal');
  assert.ok(effet.pourquoi, 'et le refus dit pourquoi');
  assert.ok(!('pane' in effet), 'aucun pane n’est rendu — il n’y en a pas');
});

test('« Entrée » sur un orchestrateur SANS terminal vivant refuse — aucun identifiant périmé n’est suivi', async (t) => {
  // 🔴 CE BANC EST NÉ D’UNE SURVIVANTE, pas d’une relecture. La campagne a posé
  // `if (ligne?.kind === 'orchestrateur')` à la place de la condition qui EXIGE une adresse
  // MESURÉE : le TUI suivait alors n’importe quel orchestrateur, y compris ceux qui ne vivent
  // que par leur lieu versionné. Mes deux bancs sur « Entrée » couvraient l’orchestrateur
  // VIVANT et l’EPIC — jamais le cas du milieu, qui est pourtant le plus fréquent : mesuré sur
  // ce poste, **6 chantiers sur 15 n’ont aucun pane vivant**.
  //
  // ⚠️ ET C’EST PIRE QU’UNE ABSENCE D’ADRESSE : le dirigeant s’y fierait. `adresseDe` rend
  // `mesure: 'aucune'` exprès pour ça (T-20260822-0017, 2ᵉ G/W/T) — un pane qui n'existe plus
  // se lit comme une adresse.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  poserLieu(depot, 'p-20260824-0009');

  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0009', title: 'Un chantier sans terminal', status: 'active' }],
  });
  // AUCUN pane : le chantier n’existe que par son LIEU versionné — la moitié du parc réel.
  const recensement = await unRecensement({ panes: [], roleDuLieu, nomsConnus: nomsLus([]) });
  const lieux = await lecteurDeLieux({ racines: [depot], roleDuLieu })();
  const vue = await laVueDuParc({
    recensement,
    lieux,
    lireChantier: lecteurDeChantier({ appeler: service.appeler }),
  });

  const { lignes } = texteDeLArbre(vue, etatInitial());
  const iOrch = lignes.findIndex((l) => l.kind === 'orchestrateur');
  assert.ok(iOrch >= 0, 'le chantier APPARAÎT — il survit à la mort de son terminal (EF-VUE-007)');
  assert.equal(vue.orchestrateurs[0].adresse.mesure, 'aucune', 'et il n’a AUCUNE adresse mesurée');

  const { effet } = appliquerTouche({ ...etatInitial(), curseur: iOrch }, 'entree', lignes);
  assert.equal(effet.type, 'refus', 'Entrée REFUSE — on n’envoie personne vers un terminal qui n’a pas été constaté');
  assert.ok(!('pane' in effet), 'et aucun identifiant n’est rendu : il serait périmé');
  assert.ok(effet.pourquoi, 'le refus dit pourquoi');

  // ⚠️ ET LE DÉTAIL NE PROPOSE PAS LE GESTE : offrir « [Entrée] focus le terminal » sur une
  // ligne où il refuse serait annoncer une porte qui n’ouvre pas.
  const detail = detailDe(lignes[iOrch]).join('\n');
  assert.ok(!/\[Entrée\]/.test(detail), 'le détail ne propose pas un focus qui refusera');
});

test('AUCUN geste de pilotage n’existe dans le TUI — la frontière se mesure sur l’ensemble des effets', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Un chantier', status: 'active' }],
    epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'Un epic', status: 'in_execution' }],
    tickets: [{ id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'Une story', status: 'new' }],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });
  const { lignes } = texteDeLArbre(vue, etatInitial());

  // 🔴 ON BALAIE TOUT LE CLAVIER IMPRIMABLE, PAS LES TOUCHES QU'ON A PRÉVUES. Une garde qui
  // n'éprouve que les touches documentées ne dirait rien d'un geste ajouté demain sous une
  // lettre libre — et « aucun pilotage » serait une affirmation sur ce qu'on a bien voulu
  // regarder. HS-VUE-001 se mesure sur l'ENSEMBLE des effets atteignables.
  const TOUCHES = ['haut', 'bas', 'gauche', 'droite', 'entree', 'echap', 'effacer'];
  for (let c = 32; c < 127; c += 1) TOUCHES.push(String.fromCharCode(c));

  const EFFETS_PERMIS = new Set(['quitter', 'relire', 'focus', 'refus']);
  const vus = new Set();
  for (const curseur of lignes.map((_, i) => i)) {
    for (const touche of TOUCHES) {
      const { effet } = appliquerTouche({ ...etatInitial(), curseur }, touche, lignes);
      if (!effet) continue;
      vus.add(effet.type);
      assert.ok(
        EFFETS_PERMIS.has(effet.type),
        `la touche « ${touche} » produit l’effet « ${effet.type} » — ni relance, ni arrêt, ni ` +
          'assignation, ni écriture ne doivent exister dans cette vue (HS-VUE-001, RA-VUE-001)'
      );
    }
  }
  // ⚠️ ET LE BALAYAGE A VRAIMENT ATTEINT QUELQUE CHOSE — sans quoi il passerait en n'ayant
  // rien exercé, ce qui est la forme même du banc vacant.
  assert.ok(vus.has('focus') && vus.has('quitter'), `le balayage a atteint des effets réels : ${[...vus].join(', ')}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260824-0032 — LE SOCLE : la porte du TUI, la progression, le clavier
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le TUI REFUSE ce qui n’est pas une vue — jamais un parc parfaitement mis en page et désert', async () => {
  // 🔴 LA MÊME GARDE QUE `rendreLaVue`, À LA PORTE DU TUI. Mesuré le 2026-08-22 sur le geste
  // texte : le veilleur en vie ne connaissait pas le geste et rendait
  // `{ ok: false, erreur: 'geste inconnu : vue' }` — objet qui traversait le rendu sans
  // résistance et sortait une vue impeccable et VIDE. Le dirigeant y lit « personne ne
  // travaille » ; la vérité est que personne n'a REGARDÉ.
  let ecrit = '';
  const sortie = { write: (s) => (ecrit += s), columns: 100, rows: 24 };
  let ouvert = false;

  const { code } = await servirLaVue({
    args: ['--tui'],
    lireLaVue: async () => ({ ok: false, erreur: 'geste inconnu : vue' }),
    sortie,
    ouvrirLEcran: async (o) => {
      // On passe par la VRAIE boucle : c'est elle qui porte la garde.
      const { boucleDuTui } = await import('../src/tui-boucle.js');
      ouvert = true;
      return boucleDuTui({ ...o, entree: { [Symbol.asyncIterator]: async function* () {} } });
    },
  });

  assert.ok(ouvert, 'la boucle a bien été atteinte');
  assert.equal(code, 1, 'le refus se rend par un code non nul');
  assert.match(ecrit, /REFUSÉE/);
  assert.match(ecrit, /PAS « personne ne travaille »/, 'et il dit ce qu’il ne dit PAS');
  // ⚠️ LE REFUS DIT QUOI FAIRE, pas seulement qu il refuse. « geste inconnu » tout seul envoie
  // chercher une panne de code — alors que le code est juste des DEUX côtés. Ce refus-là
  // signifie une chose précise et actionnable : le processus en vie est plus ancien que le
  // disque. La phrase est cherchée sur un fragment qui ne peut PAS être coupé par un retour à
  // la ligne — une assertion qui enjambe un repli passe pour fausse sur un texte juste.
  assert.match(ecrit, /Le geste : le redémarrer/, 'et il nomme le geste à poser');
});

test('quand le RECENSEMENT a refusé, le TUI n’ouvre AUCUN écran — il dit « je n’ai pas su regarder »', async () => {
  // 🔴 LE MODE DE PANNE FONDATEUR DE CE CHANTIER, LAISSÉ OUVERT PAR LE MODULE QUI EXISTE POUR
  // LE FERMER. Ma garde de porte demandait « est-ce une vue ? » et jamais « a-t-elle pu
  // mesurer ? ». Quand le recensement refuse — herdr injoignable — `laVueDuParc` rend
  // `orchestrateurs: null` AVEC une clé `registre` : la garde la laissait passer, l'arbre
  // repliait ce `null` en tableau vide, et l'écran peignait
  //     VUE DU PARC ─── par APP · ? orchestrateurs · ? epics
  // un parc PARFAITEMENT MIS EN PAGE ET PARFAITEMENT DÉSERT.
  //
  // 🔴 ET LE RENDU TEXTE QUE CE TUI DOUBLE FAISAIT DÉJÀ MIEUX QUE LUI. Livrer l'écran sans
  // cette garde, c'était livrer une RÉGRESSION du produit sorti deux jours plus tôt. Trouvé par
  // une passe de revue, qui le classait « hors périmètre » — c'était vrai du diff, et faux de
  // la gravité.
  const vue = await laVueDuParc({ recensement: { agents: null, inventaireRefuse: 'herdr est injoignable' } });
  assert.equal(vue.orchestrateurs, null, 'le montage produit bien la vue d’un registre REFUSÉ');
  assert.ok('registre' in vue, 'et elle porte une clé `registre` — c’est POURQUOI l’autre garde la laissait passer');

  const { boucleDuTui } = await import('../src/tui-boucle.js');
  let ecrit = '';
  const { code } = await boucleDuTui({
    lireLaVue: async () => vue,
    sortie: { write: (s) => (ecrit += s), columns: 100, rows: 12 },
    entree: { [Symbol.asyncIterator]: async function* () {} },
  });

  assert.equal(code, 1, 'le refus se rend par un code non nul');
  // 🔴 AUCUN ÉCRAN N'EST OUVERT. C'est le cœur : peindre un parc vide serait affirmer qu'il
  // est vide.
  assert.ok(!ecrit.includes('\u001b[?1049h'), 'aucun écran alternatif n’est ouvert — on ne peint AUCUN parc');
  assert.ok(!/orchestrateurs ·/.test(ecrit), 'et surtout pas un en-tête de parc avec « ? orchestrateurs »');

  // ⚠️ LA PHRASE EST CELLE DU RENDU TEXTE, PAS UNE SECONDE FORMULATION. Deux versions du même
  // refus finiraient par diverger, et c'est la première qui porte les gardes de l'arbitrage.
  assert.match(ecrit, /SANS REGISTRE/, 'il dit que le registre a refusé');
  assert.match(ecrit, /herdr est injoignable/, 'et il nomme la cause');
  assert.match(ecrit, /pas su regarder/, 'et il dit ce que ce n’est PAS : « personne ne travaille »');
});

test('une vue MESURÉE mais VIDE ouvre bien l’écran — la garde ne doit pas refuser un parc réellement vide', async () => {
  // 🔴 LE SYMÉTRIQUE, ET SANS LUI LA GARDE POURRAIT TOUT REFUSER. « aucun orchestrateur mesuré »
  // et « je n'ai pas pu mesurer » sont deux faits opposés : le premier s'affiche, le second se
  // refuse. Une garde qui les fondrait rendrait le TUI inutilisable sur un poste au repos.
  const vue = await laVueDuParc({ recensement: { quand: 'T', agents: [] } });
  assert.deepEqual(vue.orchestrateurs, [], 'la vue est MESURÉE, et elle est vide');

  const { boucleDuTui } = await import('../src/tui-boucle.js');
  let ecrit = '';
  const { code } = await boucleDuTui({
    lireLaVue: async () => vue,
    sortie: { write: (s) => (ecrit += s), columns: 100, rows: 12 },
    entree: { [Symbol.asyncIterator]: async function* () {} },
  });

  assert.equal(code, 0, 'un parc mesuré et vide n’est pas un refus');
  assert.ok(ecrit.includes('\u001b[?1049h'), 'l’écran S’OUVRE');
  assert.match(ecrit, /VUE DU PARC/, 'et il porte son en-tête');
});

test('« --tui » ouvre l’écran, et son ABSENCE rend le texte — le défaut protège les lecteurs sans terminal', async () => {
  const vue = { registre: { mesure: 'lu' }, orchestrateurs: [], horsHierarchie: [], resume: 'r', regle: 'g' };
  let ecrit = '';
  const sortie = { write: (s) => (ecrit += s) };
  let ecranOuvert = false;
  const ouvrirLEcran = async () => {
    ecranOuvert = true;
    return { code: 0 };
  };

  await servirLaVue({ args: [], lireLaVue: async () => vue, sortie, ouvrirLEcran });
  assert.equal(ecranOuvert, false, 'sans drapeau, AUCUN écran ne s’ouvre');
  assert.match(ecrit, /LA VUE DU PARC/, 'c’est le rendu texte qui sort');

  ecrit = '';
  await servirLaVue({ args: ['--tui'], lireLaVue: async () => vue, sortie, ouvrirLEcran });
  assert.equal(ecranOuvert, true, 'avec le drapeau, l’écran s’ouvre');
  assert.equal(ecrit, '', 'et rien n’est écrit à sa place');
});

test('la progression n’est JAMAIS muette, et elle n’invente aucun pourcentage', () => {
  const t = texteDeProgression(37, 3);
  // ⚠️ ON REND CE QU'ON MESURE — le temps écoulé. La lecture est UN appel qui ne rend aucun
  // jalon : une barre qui avancerait affirmerait une progression qu'on n'a pas mesurée.
  assert.match(t, /37 s/, 'le temps écoulé, qui est mesuré');
  assert.ok(!/%/.test(t), 'aucun pourcentage — il serait inventé');
  assert.match(t, /ServiceDesk/, 'et elle dit ce qu’on attend');
  assert.notEqual(texteDeProgression(1, 1), texteDeProgression(1, 2), 'elle BOUGE — un écran figé se lit comme un écran mort');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE SEUL GESTE ACTIF DU PRODUIT — et rien ne le gardait
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CE BANC EST NÉ D'UN REJET DE PASSE PORTAIL, ET LE REJET ÉTAIT JUSTE. `mettreEnFocus` est
// la SEULE fonction du lot qui pose le seul geste actif que le TUI ait le droit de poser
// (HS-VUE-001). Elle n'était atteinte par AUCUN banc : la passe a remplacé la sous-commande
// `focus` par `kill` — c'est-à-dire transformé le geste permis en geste de PILOTAGE — et
// **62 essais sur 62 sont restés verts**.
//
// ⚠️ POURQUOI AUCUN BANC NE LA VOYAIT : `boucleDuTui` n'est appelée qu'une fois dans la suite,
// avec une vue délibérément invalide — elle rend son refus à la garde de porte et ne descend
// jamais jusqu'à l'appel du focus. La frontière était solidement gardée au niveau du MODÈLE
// (`appliquerTouche` est balayée sur tout le clavier imprimable × toutes les positions de
// curseur, et ne peut rendre que `quitter`/`relire`/`focus`/`refus`) — mais son EXÉCUTION
// contre le vrai `herdr` ne l'était par personne.
//
// ⚠️ ET L'EXERCICE À LA MAIN NE FERMAIT PAS CE TROU. `mettreEnFocus` A ÉTÉ exercée contre un
// vrai pane, en boucle fermée : `w5:p8` non focalisé → focalisé après l'appel → poste remis en
// place, et un pane inexistant rendant `ok: false` avec sa cause. Le geste marche, c'est
// mesuré. Mais un script hors du dépôt n'est ni reproductible ni relancé par personne : un code
// JUSTE que rien ne garde reste un code que rien ne garde.
test('le focus lance EXACTEMENT « herdr agent focus <pane> » — et sa session voyage avec lui', async () => {
  const appels = [];
  const executer = async (chemin, args, options) => {
    appels.push({ chemin, args, session: options?.env?.HERDR_SOCKET_PATH ?? null });
    return { stdout: '', stderr: '' };
  };

  const r = await mettreEnFocus('w5:p8', '/tmp/une-session/herdr.sock', { executer });

  assert.deepEqual(r, { ok: true }, 'un focus qui aboutit se dit ainsi');
  assert.equal(appels.length, 1, 'un seul lancement — jamais deux, jamais zéro');
  assert.equal(appels[0].chemin, 'herdr', 'c’est bien herdr qu’on lance');
  // 🔴 L'ARGV EXACT, ÉPINGLÉ. C'est la seule chose qui distingue le geste PERMIS du geste
  // INTERDIT : `focus` regarde, `kill` tue. Un `assert.ok(args.includes('focus'))` laisserait
  // passer `['agent','kill','focus',pane]` ; une assertion sur la longueur seule laisserait
  // passer n'importe quelle sous-commande. On épingle la suite entière.
  assert.deepEqual(
    appels[0].args,
    ['agent', 'focus', 'w5:p8'],
    'le TUI ADRESSE et rien d’autre : aucune autre sous-commande de herdr ne doit pouvoir sortir d’ici'
  );
  // ⚠️ UN IDENTIFIANT DE PANE NE VOYAGE JAMAIS SEUL. Mesuré sur ce poste : `w7:p1` existe dans
  // `somtech` ET dans `progex`, avec deux agents différents. Un focus sans sa session met le
  // dirigeant devant le terminal de quelqu'un d'autre — et il s'y fie.
  assert.equal(appels[0].session, '/tmp/une-session/herdr.sock', 'la session accompagne le pane');
});

test('un focus qui ÉCHOUE se dit — jamais un « ok » sur un terminal qu’on n’a pas atteint', async () => {
  // ⚠️ MESURÉ CONTRE LE VRAI herdr, PAS IMAGINÉ : un pane inexistant fait rendre
  // « agent target w0:p0 not found » — la forme reproduite ici.
  const executer = async () => {
    throw new Error('Command failed: herdr agent focus w0:p0\n{"error":{"code":"agent_not_found"}}');
  };

  const r = await mettreEnFocus('w0:p0', null, { executer });

  assert.equal(r.ok, false, 'un focus qui n’a pas abouti ne se dit PAS « ok »');
  // 🔴 LA CAUSE VOYAGE. Un `ok: false` nu enverrait chercher au hasard ; ici le refus nomme le
  // pane et ce que herdr en a dit. C'est la même règle que partout dans ce module : une panne
  // qui ne dit pas sa cause se lit comme une absence.
  assert.match(r.pourquoi, /agent_not_found|not found/, 'et le refus porte ce que herdr a répondu');
  assert.match(r.pourquoi, /w0:p0/, 'et il nomme le pane visé');
});

test('sans session désignée, le focus part quand même — mais SANS inventer de session', async () => {
  // ⚠️ LE CAS RÉEL DU `bin` : `HERDR_SOCKET_PATH` peut être absent. On ne doit ni refuser (le
  // pane de la session courante reste atteignable) ni fabriquer un chemin de socket — un
  // socket inventé enverrait le geste dans une session qui n'est pas celle qu'on regarde.
  const appels = [];
  const executer = async (chemin, args, options) => {
    appels.push(options ?? {});
    return { stdout: '' };
  };

  const r = await mettreEnFocus('w1:p1', null, { executer });

  assert.deepEqual(r, { ok: true });
  assert.equal(appels.length, 1);
  // ⚠️ ON ASSÈRE L'ABSENCE DE LA CLÉ, PAS UNE VALEUR. Première rédaction refusée par la mesure :
  // elle notait `options?.env ?? null` puis attendait `undefined` — elle mesurait donc MON propre
  // repli, jamais ce que le code pose. Ce qui compte ici est qu'aucun environnement ne soit
  // FABRIQUÉ : un chemin de socket inventé enverrait le geste dans une autre session que celle
  // qu'on regarde.
  assert.ok(!('env' in appels[0]), 'aucun environnement n’est posé quand aucune session n’est donnée');
});

test('un orchestrateur SANS pane vivant ne montre PAS son code dans l’arbre — le titre identifie, l’ID reste au détail', async (t) => {
  // 🔴 CE BANC EST NÉ D'UNE PASSE DE REVUE, ET IL FERME LA DEMANDE DU DIRIGEANT MOT POUR MOT.
  // `nomDeLOrchestrateur` retombait sur le code du chantier quand aucun pane vivant ne portait
  // le mandat — le cas MAJORITAIRE : mesuré sur ce poste, 6 chantiers sur 15 n'ont aucun
  // terminal. MESURÉ sur la vue réelle : 2 lignes sur 457 affichaient `P-20260820-0001` comme
  // NOM, dans l'arbre, là où il a demandé de ne plus voir de codes.
  //
  // ⚠️ MON BANC « aucun identifiant dans l'arbre » PASSAIT, parce que sa donnée portait un agent
  // VIVANT. Encore un vert qui ne touchait pas ce qu'il prétendait éprouver.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  poserLieu(depot, 'p-20260824-0011');

  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0011', title: 'Le métier des agents', status: 'active' }],
  });
  // AUCUN pane : le chantier n'existe que par son LIEU versionné.
  const recensement = await unRecensement({ panes: [], roleDuLieu, nomsConnus: nomsLus([]) });
  const lieux = await lecteurDeLieux({ racines: [depot], roleDuLieu })();
  const vue = await laVueDuParc({ recensement, lieux, lireChantier: lecteurDeChantier({ appeler: service.appeler }) });

  const { lignes, textes } = texteDeLArbre(vue, etatInitial());
  const UN_CODE = /\b[DPJETdpjet]-\d{8}-\d{4}\b/;
  assert.deepEqual(textes.filter((l) => UN_CODE.test(l)), [], 'aucune ligne de l’arbre ne porte de code');
  assert.ok(textes.some((l) => l.includes('Le métier des agents')), 'et le TITRE du chantier, lui, est là');

  // 🔴 LE SYMÉTRIQUE : le code n'a pas DISPARU, il a changé de place. Sans lui, le dirigeant ne
  // pourrait plus retrouver la ligne au ServiceDesk.
  const detail = detailDe(lignes.find((l) => l.kind === 'orchestrateur')).join('\n');
  assert.match(detail, /P-20260824-0011/, 'le détail porte le code');
});

test('un chantier dont les EPICS N’ONT PAS PU ÊTRE LUS apparaît sous « n » — « je ne sais pas » n’est pas « rien à signaler »', async (t) => {
  // 🔴 CE BANC EST NÉ D'UNE PASSE DE REVUE. `porteDuNonPris` ne regardait que les enfants ;
  // avec `epics: null` on construit `enfants: []`, donc il rendait `false` — « aucun non-pris
  // ici » — alors que la vérité est « je n'ai pas pu regarder ». MESURÉ sur la vue réelle :
  // **4 orchestrateurs sur 17** étaient dans ce cas, et les 4 DISPARAISSAIENT sous `n`.
  //
  // ⚠️ C'est le repli que RA-VUE-003 interdit, appliqué à « epics non mesurés » — et sur le
  // filtre qui sert PRÉCISÉMENT à décider où agir. Le taire y est plus grave qu'ailleurs.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');
  const lu = poserLieu(d, 'p-20260824-0012');
  const illisible = poserLieu(d, 'p-20260824-0013');

  const service = unServiceDesk({
    // `P-…-0013` ne figure PAS dans la liste : le lecteur JETTE, la vue rend `epics: null`.
    projets: [{ id: 'u1', project_id: 'P-20260824-0012', title: 'Chantier lisible', status: 'active' }],
    epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'Un epic fermé', status: 'completed' }],
  });
  const vue = await uneVue({
    tmp,
    agents: [
      { pane: 'w1:p1', lieu: lu, nom: 'kamouraska' },
      { pane: 'w2:p1', lieu: illisible, nom: 'matapedia' },
    ],
    service,
  });

  const filtre = { ...etatInitial(), nonPrisSeuls: true };
  const { lignes, textes } = texteDeLArbre(vue, filtre);

  const ligneIllisible = textes.find((l) => l.includes('matapedia'));
  assert.ok(ligneIllisible, 'le chantier dont les epics n’ont pas été lus APPARAÎT sous le filtre');
  // 🔴 DISTINCT DU NON-PRIS, JAMAIS FONDU. Le marquer `○ NON PRIS` affirmerait qu'il attend
  // quelqu'un — or on n'en sait rien. Il porte son propre mot.
  assert.match(ligneIllisible, /NON LUS/, 'il dit que ses epics n’ont PAS été lus');
  assert.ok(!/NON PRIS/.test(ligneIllisible), 'et il n’est PAS marqué NON PRIS — ce serait affirmer ce qu’on ignore');

  // ⚠️ ET CELUI QU'ON A PU LIRE, ET QUI N'A QUE DU FERMÉ, RESTE ÉCARTÉ : sans ça le filtre
  // montrerait tout le monde et cesserait d'être un filtre.
  assert.ok(!textes.some((l) => l.includes('kamouraska')), 'un chantier LU sans non-pris reste écarté');

  // Le détail explique pourquoi il est là — sinon sa présence sous « n » est inexplicable.
  const ligne = lignes.find((l) => l.kind === 'orchestrateur' && l.titre.includes('matapedia'));
  assert.ok(ligne, 'la ligne de ce chantier existe bien dans l’arbre filtré');
  const detail = detailDe(ligne).join('\n');
  // ⚠️ LE FRAGMENT CHERCHÉ NE PEUT PAS ÊTRE COUPÉ PAR UN REPLI. Le panneau fait 28 colonnes et
  // replie ses phrases : une assertion qui enjambe un retour à la ligne rend un rouge sur un
  // texte JUSTE. C'est la troisième fois de ce lot que mon instrument se trompe ainsi.
  assert.match(detail, /n’ont PAS pu/, 'le détail dit la mesure qui a manqué');
  assert.match(detail, /rien à signaler/, 'et il dit ce que ce n’est PAS');
});

test('un EPIC dont les STORIES n’ont pas pu être lues apparaît sous « n » AUSSI — le même repli, un étage plus bas', async (t) => {
  // 🔴 CE BANC EST NÉ D'UN BLOQUANT DE PASSE DE FOND, ET LE DÉFAUT ÉTAIT LE MIEN. J'avais posé
  // `incertain` sur l'ORCHESTRATEUR (`epics: null`) et laissé l'EPIC sans rien, alors qu'il
  // porte le MÊME repli un étage plus bas (`stories: null`). Même donnée, même repli, même
  // conséquence — disparaître sous `n` — et un seul étage corrigé.
  //
  // ⚠️ UN CORRECTIF DE REPLI SE POSE À TOUS LES ÉTAGES OÙ LE REPLI EXISTE, pas à celui où on
  // l'a vu. Ici ce n'était pas le symétrique À CÔTÉ, c'était le symétrique EN DESSOUS.
  //
  // ⚠️ LE CAS EST CELUI QUI DISPARAISSAIT : un epic FERMÉ (donc `nonPris === false`) dont
  // l'appel aux tickets a jeté. Sur un epic ouvert, le nœud serait déjà visible par son
  // `○ NON PRIS` — le banc passerait sans rien prouver.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');

  const service = {
    appeler: async (nom, args) => {
      if (nom === 'projects') return { projects: [{ id: 'u1', project_id: 'P-20260824-0031', title: 'Un chantier', status: 'active' }] };
      if (nom === 'applications') return { applications: [] };
      if (nom === 'epics') return { epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'Un epic fermé aux stories illisibles', status: 'completed' }] };
      // 🔴 L'APPEL AUX TICKETS JETTE — c'est ce que fait le vrai lecteur quand le ServiceDesk
      // refuse, et il rend alors `stories: null`, jamais `[]`.
      throw new Error('le ServiceDesk n’a pas répondu sur les tickets');
    },
  };
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu: poserLieu(d, 'p-20260824-0031'), nom: 'kamouraska' }], service });

  const epicLu = vue.orchestrateurs[0].epics[0];
  assert.equal(epicLu.stories, null, 'le montage produit bien des stories NON LUES, pas une liste vide');
  assert.equal(epicLu.statut, 'completed', 'et l’epic est FERMÉ — sans quoi il serait visible par son NON PRIS');

  const { lignes, textes } = texteDeLArbre(vue, { ...etatInitial(), nonPrisSeuls: true });
  const ligne = textes.find((l) => l.includes('aux stories illisibles'));
  assert.ok(ligne, 'l’epic APPARAÎT sous le filtre — il ne disparaît plus');
  // 🔴 DISTINCT DU NON-PRIS, JAMAIS FONDU : le marquer `○ NON PRIS` affirmerait qu'il attend
  // quelqu'un, alors qu'on ne sait pas ce que ses stories portent.
  assert.match(ligne, /NON LUES/, 'et il dit que ses stories n’ont pas été lues');
  assert.ok(!/NON PRIS/.test(ligne), 'sans jamais affirmer qu’il est non pris');

  const detail = detailDe(lignes.find((l) => l.kind === 'epic')).join('\n');
  assert.match(detail, /n’ont PAS pu/, 'le détail dit la mesure qui a manqué');
  assert.match(detail, /rien à signaler/, 'et il dit ce que ce n’est PAS');
});

test('après un « r » sur une vue RÉTRÉCIE, le curseur reste dans la liste — et « Entrée » ne vise rien d’invisible', async (t) => {
  // 🔴 CE BANC EST NÉ D'UNE PASSE DE REVUE, ET IL PORTE SUR LE SEUL GESTE ACTIF DU PRODUIT.
  // `relire` ne touchait ni le curseur ni les plis, et le rendu n'écrêtait pas non plus : quand
  // la vue RÉTRÉCIT entre deux lectures — ce qui arrive vraiment sur 70 s — l'écran ne
  // surlignait plus aucune ligne, et `Entrée` mettait quand même un terminal RÉEL en focus.
  //
  // ⚠️ CE N'ÉTAIT PAS UN PLANTAGE, et c'est ce qui le rendait dangereux : le geste aboutissait,
  // sur une cible que personne n'avait vue.
  //
  // ⚠️ LES LIGNES VIENNENT DE LA CHAÎNE RÉELLE, PAS DE MA MAIN. Première rédaction refusée par
  // la mesure : elle fabriquait des `lignes` à la main, sans `nonPris` — une forme que le
  // modèle ne produit jamais — et `detailDe` jetait. Un double non conforme fabrique les
  // défauts qu'il devrait trouver.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');

  const projets = [];
  const agents = [];
  for (let i = 1; i <= 12; i += 1) {
    const code = `P-20260824-01${String(i).padStart(2, '0')}`;
    projets.push({ id: `u${i}`, project_id: code, title: `Chantier numero ${i}`, status: 'active' });
    agents.push({ pane: `w${i}:p1`, lieu: poserLieu(d, code.toLowerCase()), nom: `agent${i}` });
  }
  const vue = await uneVue({ tmp, agents, service: unServiceDesk({ projets }) });

  const racines = arbreDeLaVue(vue, { parApp: true });
  const grande = lignesVisibles(racines, etatInitial());
  // La MÊME vue, vue plus courte — c'est ce que fait une relecture qui trouve moins de monde.
  const petite = lignesVisibles(racines, { ...etatInitial(), recherche: 'numero 1 ' });
  assert.ok(grande.length > petite.length && petite.length > 0, `${grande.length} lignes puis ${petite.length}`);

  const loin = { ...etatInitial(), curseur: grande.length - 1 };
  const apresR = appliquerTouche(loin, 'r', grande);
  assert.equal(apresR.effet.type, 'relire', '« r » demande bien une relecture');

  // 🔴 SUR LA LISTE RÉTRÉCIE, LE CURSEUR REVIENT DANS LA LISTE — et au MÊME endroit pour le
  // rendu ET pour les touches, parce que les deux passent par la même fonction.
  const surPetite = appliquerTouche(apresR.etat, 'entree', petite);
  assert.ok(
    surPetite.etat.curseur < petite.length,
    `le curseur (${surPetite.etat.curseur}) est dans la liste de ${petite.length}`
  );

  const ecran = rendreEcran({ vue, etat: apresR.etat, lignes: petite, largeur: 90, hauteur: 10 });
  const surlignees = ecran.filter((l) => l.style === 'selection');
  assert.equal(surlignees.length, 1, 'l’écran surligne EXACTEMENT une ligne — jamais zéro');

  // ⚠️ ET CE QU'ON MONTRE EST CE QU'ON VISE. C'est tout l'objet du correctif.
  assert.ok(
    surlignees[0].texte.includes(petite[surPetite.etat.curseur].titre.slice(0, 12)),
    `la ligne surlignée n’est pas celle que le curseur désigne : « ${surlignees[0].texte.trim()} »`
  );

  // Une liste devenue VIDE ne fait viser personne.
  const surVide = appliquerTouche(apresR.etat, 'entree', []);
  assert.equal(surVide.effet.type, 'refus', 'sur une liste vide, Entrée REFUSE');
  assert.ok(!('pane' in surVide.effet), 'et ne rend aucun identifiant');
});

test('la barre de raccourcis se rétracte sans jamais perdre « q quitter » — et reste la maquette à pleine largeur', () => {
  // 🔴 TROUVÉ EN EXERÇANT LE TUI DANS UN VRAI PTY, où la fenêtre faisait 100 colonnes. La barre
  // en fait 109 : bornée, elle coupait par la DROITE — donc le PREMIER raccourci sacrifié était
  // `q quitter`, le seul dont on a besoin quand on ne sait plus quoi faire. Le lecteur se
  // retrouvait dans un plein écran dont l'aide ne disait plus la sortie.
  //
  // ⚠️ ON N'A PAS RÉORDONNÉ LA BARRE : son ordre est celui de la maquette que le dirigeant a
  // validée, et elle fait foi. Ce qui change est la DÉGRADATION sous sa largeur.
  assert.equal(raccourcisPour(200), RACCOURCIS, 'à pleine largeur, c’est EXACTEMENT la maquette');
  assert.match(RACCOURCIS, /^↑↓ naviguer {2}→← plier {2}\/ chercher/, 'et l’ordre de la maquette est intact');

  for (const largeur of [110, 100, 80, 60, 40, 20, 10, 1]) {
    const barre = raccourcisPour(largeur);
    assert.ok(barre.includes('q quitter'), `à ${largeur} colonnes, « q quitter » a DISPARU : « ${barre} »`);
    // ⚠️ ON N'EXIGE PAS QU'ELLE TIENNE À 1 COLONNE — c'est impossible, et le prétendre serait
    // faux. On exige qu'elle ne tienne JAMAIS au prix de la sortie.
    if (largeur >= 20) {
      assert.ok(barre.length <= largeur, `à ${largeur} colonnes, la barre en fait ${barre.length}`);
    }
  }

  // ⚠️ ET LA DÉGRADATION EST MONOTONE : une barre plus étroite ne peut pas porter PLUS de
  // raccourcis qu'une plus large. Sans ça, l'ordre de retrait serait arbitraire.
  let precedent = Infinity;
  for (const largeur of [200, 110, 100, 80, 60, 40, 20]) {
    const combien = raccourcisPour(largeur).split('  ').length;
    assert.ok(combien <= precedent, `${largeur} colonnes portent ${combien} raccourcis, plus que la largeur au-dessus`);
    precedent = combien;
  }
});

test('une RAFALE de touches arrivée en un seul bloc est décodée entière — tenir ↓ suffit à la produire', () => {
  // 🔴 CE BANC EST NÉ EN TAPANT DANS UN VRAI PTY, et rien d'autre ne pouvait le trouver. La
  // boucle décodait le bloc que le terminal lui remet comme UNE touche. Or un terminal ne remet
  // pas les touches une par une : il remet ce qui est arrivé depuis la dernière lecture.
  // MESURÉ : six touches en un bloc de 10 octets rendaient `null` — les six perdues, l'écran
  // figé jusqu'à ce qu'on tue le processus.
  //
  // ⚠️ ET TOUS LES BANCS DU DÉPÔT PASSAIENT, PARCE QU'ILS FABRIQUAIENT LEUR PROPRE APPELANT :
  // ils appellent le décodeur avec UNE touche, ce que la production ne fait jamais.
  const ESC = '\u001b';

  assert.deepEqual(
    decoderTouches(`${ESC}[B${ESC}[Bannq`).touches,
    ['bas', 'bas', 'a', 'n', 'n', 'q'],
    'un bloc de 10 octets rend les SIX touches, dans l’ordre'
  );

  // 🔴 UNE SÉQUENCE CSI SE LIT ENTIÈRE OU SE JETTE ENTIÈRE. La découper ferait lire son `ESC`
  // comme Échap — donc agir sur une séquence que le terminal émet tout seul : souris, collage
  // encadré, touche de fonction.
  for (const [quoi, sequence] of [
    ['collage encadré', `${ESC}[200~`],
    ['souris SGR', `${ESC}[<0;10;5M`],
    ['touche de fonction', `${ESC}[15~`],
  ]) {
    const { touches, reste } = decoderTouches(sequence);
    assert.ok(!touches.includes('echap'), `${quoi} ne doit PAS être lu comme Échap`);
    assert.ok(!touches.includes('q'), `${quoi} ne doit PAS quitter le TUI`);
    assert.deepEqual(touches, [], `${quoi} est ignorée en entier`);
    assert.equal(reste, '', `${quoi} est CONSOMMÉE — elle ne s’accumule pas dans le reste`);
  }

  assert.deepEqual(decoderTouches(`${ESC}[Bq`).touches, ['bas', 'q'], 'une flèche suivie d’une lettre');
  assert.deepEqual(decoderTouches('').touches, [], 'un bloc vide ne rend rien');
});

test('une FLÈCHE COUPÉE entre deux lectures reste une flèche — elle ne devient pas Échap', () => {
  // 🔴 CE BANC EST NÉ D'UNE PASSE DE REVUE, ET LE DÉFAUT ÉTAIT GRAVE. Le décodeur n'avait AUCUNE
  // mémoire d'un appel à l'autre. Quand le terminal remet l'octet `ESC` seul dans une lecture,
  // puis `[B` dans la suivante — SSH, tmux, ou simplement la latence entre deux `read()` — le
  // `ESC` isolé était décodé `echap`, et `echap` QUITTAIT le TUI. **Une flèche fermait l'écran**,
  // et la flèche voulue n'était jamais vue.
  //
  // ⚠️ LA GARDE PRÉCÉDENTE NE COUVRAIT QU'UN BORD : elle attendait la suite quand `ESC` et `[`
  // arrivaient ENSEMBLE sans lettre finale. `ESC` arrivant SEUL n'était couvert par personne.
  // C'est la même famille que la rafale, sur l'autre bord — un correctif ouvre son symétrique.
  const ESC = '\u001b';

  // Lecture 1 : l'octet ESC tout seul. On ne peut PAS trancher, donc on ne tranche pas.
  const un = decoderTouches(ESC);
  assert.deepEqual(un.touches, [], 'un ESC en fin de tampon ne rend RIEN — ni Échap, ni flèche');
  assert.equal(un.reste, ESC, 'il est GARDÉ pour la lecture suivante');

  // Lecture 2 : le reste de la flèche. Les deux moitiés se recomposent.
  const deux = decoderTouches('[B', un.reste);
  assert.deepEqual(deux.touches, ['bas'], 'les deux moitiés recomposent la FLÈCHE');
  assert.equal(deux.reste, '', 'et le reste est consommé');

  // ⚠️ ET ÉCHAP EXISTE TOUJOURS : `ESC` suivi d'autre chose que `[` est bien Échap.
  assert.deepEqual(decoderTouches(`${ESC}a`).touches, ['echap', 'a'], 'ESC + une lettre : c’est Échap');
  const tardif = decoderTouches('q', ESC);
  assert.deepEqual(tardif.touches, ['echap', 'q'], 'un ESC gardé se rend dès que la suite le tranche');

  // Une séquence CSI coupée en trois lectures se recompose aussi.
  const a = decoderTouches(ESC);
  const b = decoderTouches('[', a.reste);
  assert.deepEqual(b.touches, [], 'ESC + [ sans lettre finale : toujours indécidable');
  assert.equal(b.reste, `${ESC}[`, 'et les deux octets sont gardés ensemble');
  assert.deepEqual(decoderTouches('C', b.reste).touches, ['droite'], 'la troisième lecture la tranche');
});

test('la BOUCLE reporte le reste d’une lecture à l’autre — une flèche COUPÉE vaut une flèche entière', async (t) => {
  // 🔴 CE BANC EST NÉ D'UNE SURVIVANTE DE MA PROPRE CAMPAGNE. Le décodeur était gardé ; la
  // JOINTURE ne l'était pas. Retirer `reste = decode.reste` de la boucle — c'est-à-dire jeter
  // ce que le décodeur venait de mettre de côté — laissait 31 essais VERTS. Deux étages justes
  // dont la ligne qui les relie ne tient par personne.
  //
  // ⚠️ ET LE DISCRIMINANT N'EST PAS UN INDICE ÉCRIT EN DUR — ce serait épingler une mise en
  // page, pas une propriété. On COMPARE trois flux : une flèche coupée en deux lectures doit
  // rendre le MÊME écran qu'une flèche entière, et un AUTRE que pas de flèche du tout. La
  // garde survit alors à n'importe quel changement d'arbre.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');
  const service = unServiceDesk({
    projets: [
      { id: 'u1', project_id: 'P-20260824-0021', title: 'Premier chantier', status: 'active' },
      { id: 'u2', project_id: 'P-20260824-0022', title: 'Second chantier', status: 'active' },
    ],
  });
  const vue = await uneVue({
    tmp,
    agents: [
      { pane: 'w1:p1', lieu: poserLieu(d, 'p-20260824-0021'), nom: 'premier' },
      { pane: 'w2:p1', lieu: poserLieu(d, 'p-20260824-0022'), nom: 'second' },
    ],
    service,
  });

  const ESC = '\u001b';
  const { boucleDuTui } = await import('../src/tui-boucle.js');
  const MARQUEUR = `${ESC}[48;5;240m`;

  /** Ce que la boucle a peint en dernier, et QUELLE ligne y est surlignée. */
  const jouer = async (morceaux) => {
    let peint = '';
    const sortie = { write: (s) => { peint += String(s); }, columns: 90, rows: 12 };
    const entree = { [Symbol.asyncIterator]: async function* () { yield* morceaux; } };
    await boucleDuTui({ lireLaVue: async () => vue, entree, sortie, focus: async () => ({ ok: true }) });
    const ecrans = peint.split(`${ESC}[H${ESC}[2J`).slice(1);
    const lignes = (ecrans[ecrans.length - 1] ?? '').split('\r\n');
    const i = lignes.findIndex((l) => l.startsWith(MARQUEUR));
    const sansCouleur = (l) => (l ?? '').replaceAll(new RegExp(`${ESC}\\[[0-9;?]*[a-zA-Z]`, 'g'), '').trim();
    return { ecrans: ecrans.length, surligne: sansCouleur(lignes[i]) };
  };

  const coupee = await jouer([ESC, '[B', 'q']);
  const entiere = await jouer([`${ESC}[B`, 'q']);
  const aucune = await jouer(['q']);

  assert.ok(coupee.surligne, 'l’écran surligne bien une ligne');
  // 🔴 CE QUI TRANCHE : sans le report du reste, la 2ᵉ lecture rend « [ » et « B » — deux
  // lettres sans effet — et le curseur ne bouge pas. La flèche coupée se comporterait alors
  // comme AUCUNE flèche.
  assert.notEqual(
    coupee.surligne,
    aucune.surligne,
    'une flèche coupée en deux lectures a bien DÉPLACÉ le curseur — sinon elle a été perdue'
  );
  assert.equal(
    coupee.surligne,
    entiere.surligne,
    'et elle le déplace exactement comme une flèche arrivée entière'
  );
  assert.ok(coupee.ecrans >= 2, `la seconde lecture a bien été traitée (${coupee.ecrans} écrans peints)`);
});

test('ÉCHAP NE FERME PLUS L’ÉCRAN — il annule ; seuls « q » et Ctrl-C quittent', () => {
  // 🔴 LA SECONDE MOITIÉ DU MÊME CORRECTIF, et elle ne se fie pas à la première. Le décodeur
  // garde désormais un `ESC` indécidable, mais on ne confie pas à UNE seule garde une
  // conséquence aussi grave que fermer l'écran du dirigeant.
  //
  // ⚠️ ET CE N'EST PAS UN ÉCART À LA MAQUETTE : elle dit `q quitter` et ne mentionne pas Échap.
  // Le pire d'un `ESC` mal daté devient « un filtre s'efface », jamais « l'écran se ferme ».
  // ⚠️ LA LISTE EST ASSEZ LONGUE POUR QUE LE CURSEUR AIT UNE PLACE À PERDRE. Première rédaction
  // refusée par la mesure : elle tenait UNE ligne, et l'écrêtage ramenait légitimement le
  // curseur à 0 — le banc rougissait donc sur du code juste, en mesurant mon propre montage.
  const lignes = Array.from({ length: 30 }, (_, i) => ({
    id: `x${i}`,
    kind: 'app',
    profondeur: 0,
    titre: `A${i}`,
    marque: '',
    suffixe: '',
    pliable: false,
    plie: false,
    noeud: { enfants: [], nonPris: null, ref: {} },
  }));
  // 🔴 LE CURSEUR PART NON NUL SUR LES **DEUX** BRANCHES, ET C'EST UN REJET DE REVUE QUI L'A
  // EXIGÉ. J'avais NOMMÉ le défaut deux commentaires plus bas — « ce banc partait d'un curseur
  // à 0 : la remise à zéro y était INVISIBLE » — et je n'en avais corrigé QUE LA MOITIÉ : la
  // branche « rien à annuler » reçut son cas à curseur 12, la branche « l'arbre change de
  // forme » resta à 0. MESURÉ par la passe : retirer `curseur: 0` de la branche réinitialisante
  // laissait les 32 essais VERTS.
  //
  // ⚠️ NOMMER UNE FORME NE PROTÈGE PAS CONTRE ELLE — cinquième fois dans ce lot, et cette fois
  // sur la phrase même qui la nommait.
  const depart = { ...etatInitial(), nonPrisSeuls: true, recherche: 'abc', curseur: 17 };

  const echap = appliquerTouche(depart, 'echap', lignes);
  assert.equal(echap.effet, null, 'Échap ne produit AUCUN effet — surtout pas « quitter »');
  assert.equal(echap.etat.nonPrisSeuls, false, 'il annule le filtre');
  assert.equal(echap.etat.recherche, '', 'et la recherche');
  // ⚠️ CE CAS-LÀ RAMÈNE EN TÊTE, ET C'EST VOULU : effacer un filtre fait RÉAPPARAÎTRE des
  // lignes, donc les indices ne désignent plus les mêmes nœuds. Revenir en tête est le seul
  // repère honnête quand l'arbre change de forme sous le curseur.
  assert.equal(echap.etat.curseur, 0, 'quand l’arbre change de forme, on revient en tête');

  // 🔴 ET IL N'ANNULE QUE CE QUI EST ACTIF. Ce banc partait d'un curseur à 0 : la remise à zéro
  // y était INVISIBLE, et une passe de revue a trouvé ce que je ne pouvais pas voir — un Échap
  // réflexe, sans rien à annuler, renvoyait le lecteur en tête d'un arbre de 455 lignes.
  // Troisième « vert qui ne touche pas ce qu'il éprouve » de ce lot, et le troisième écrit
  // APRÈS que j'aie nommé les deux premiers : nommer une forme ne protège pas contre elle.
  const enPlace = { ...etatInitial(), curseur: 12, nonPrisSeuls: false, recherche: '' };
  const rien = appliquerTouche(enPlace, 'echap', lignes);
  assert.equal(rien.effet, null, 'sans rien à annuler, Échap ne produit toujours aucun effet');
  assert.equal(rien.etat.curseur, 12, 'et il NE TOUCHE PAS à la place du lecteur — il n’y a rien à annuler');
  assert.deepEqual(
    { f: rien.etat.nonPrisSeuls, r: rien.etat.recherche },
    { f: false, r: '' },
    'et il ne fabrique aucun filtre non plus'
  );

  // ⚠️ MAIS LA PORTE DE SORTIE RESTE OUVERTE — sinon on aurait fermé l'écran sur son lecteur.
  assert.equal(appliquerTouche(depart, 'q', lignes).effet.type, 'quitter', '« q » quitte');
  assert.equal(decoderTouche('\u0003'), 'q', 'et Ctrl-C reste une sortie');
});

test('les flèches ne sont pas Échap — les confondre rendrait la navigation impossible', () => {
  const ESC = '\u001b';
  assert.equal(decoderTouche(`${ESC}[A`), 'haut');
  assert.equal(decoderTouche(`${ESC}[B`), 'bas');
  assert.equal(decoderTouche(`${ESC}[C`), 'droite');
  assert.equal(decoderTouche(`${ESC}[D`), 'gauche');
  // 🔴 `ESC` SEUL EST ÉCHAP, `ESC [ A` EST UNE FLÈCHE. Les fondre ferait quitter le TUI à
  // chaque flèche — c'est-à-dire rendre la navigation impossible par la touche qui la sert.
  assert.equal(decoderTouche(ESC), 'echap');
  // ⚠️ Ctrl-C n'est plus intercepté par le terminal en mode brut : sans lui, le seul moyen de
  // sortir d'un écran figé serait de tuer le terminal.
  assert.equal(decoderTouche('\u0003'), 'q');
  assert.equal(decoderTouche('\u007f'), 'effacer');
  // ⚠️ ET LA CHAÎNE VIDE N'EST RIEN — la distinction se perd si l'on écrit l'octet de contrôle
  // en clair dans la source, où il est INVISIBLE et se lit comme une chaîne vide.
  assert.equal(decoderTouche(''), null);
  assert.equal(decoderTouche(`${ESC}[Z`), null, 'une séquence inconnue ne devient pas une lettre');
});

test('l’écran tient dans ses bornes — l’arbre à gauche, le détail à droite, jamais de débordement', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Un titre volontairement très long pour déborder de la colonne de gauche', status: 'active' }],
  });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });
  const etat = etatInitial();
  const { lignes } = texteDeLArbre(vue, etat);

  for (const largeur of [60, 80, 118, 200]) {
    const ecran = rendreEcran({ vue, etat, lignes, largeur, hauteur: 10 });
    assert.equal(ecran.length, 10, `${largeur} colonnes : l’écran fait exactement la hauteur demandée`);
    for (const l of ecran) {
      assert.ok(
        l.texte.length <= largeur,
        `une ligne de ${l.texte.length} colonnes déborde d’un écran de ${largeur} — un terminal la replierait, ` +
          'et l’arbre cesserait d’être lisible'
      );
    }
  }
});

test('une ligne dont le SUFFIXE est plus long que sa colonne garde son titre — et ne déborde pas', async (t) => {
  // 🔴 CE BANC EST NÉ DE L’ÉCRAN RÉEL, PAS D’UNE RELECTURE — et le banc voisin, qui dit
  // « l’écran tient dans ses bornes », PASSAIT. Ses données avaient des suffixes courts : il
  // éprouvait la troncature du TITRE et jamais celle du SUFFIXE. C'est un vert qui ne touchait
  // pas ce qu’il prétendait éprouver.
  //
  // MESURÉ sur la vue réelle du poste (457 lignes, colonne d’arbre de 73) : **2 lignes**
  // sortaient à 133 colonnes sur un écran de 118, et elles avaient perdu leur titre ET leur
  // indentation — donc leur place dans l’arbre. Leur suffixe était la phrase de l’INDICE :
  // « NON ÉTABLI — un agent porte ce nom, son lieu ne le prouve pas : … » — la phrase même que
  // HS-VUE-002 impose. La garde de l’arbitrage cassait donc l’affichage qu’elle protège.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const lieuOrch = poserLieu(depot, 'p-20260824-0001');
  // ⚠️ UN AGENT QUI PORTE LE CODE COMME **NOM** SANS L’AVOIR À SON LIEU : c’est ce qui fait
  // rendre l’indice, avec sa longue phrase. C’est le cas réel, pas un suffixe fabriqué long.
  const lieuAutre = poserLieu(depot, 'general');

  // ⚠️ ET L’EPIC EST **FERMÉ** — c’est la combinaison exacte que l’écran réel portait, et ma
  // première rédaction ne la reproduisait pas : sur un epic OUVERT, le suffixe est le court
  // « NON PRIS », et le banc rougissait sur son propre montage au lieu du défaut. Un statut
  // fermé fait rendre l’ATTRIBUTION, donc la longue phrase de l’indice.
  const service = unServiceDesk({
    projets: [{ id: 'u1', project_id: 'P-20260824-0001', title: 'Un chantier', status: 'active' }],
    epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-20260824-0077', title: 'Un epic au titre déjà long pour occuper la colonne', status: 'completed' }],
  });
  const vue = await uneVue({
    tmp,
    agents: [
      { pane: 'w1:p1', lieu: lieuOrch, nom: 'kamouraska' },
      { pane: 'w5:pB', lieu: lieuAutre, nom: 'e-20260824-0077' },
    ],
    service,
  });

  const etat = etatInitial();
  const { lignes } = texteDeLArbre(vue, etat);
  const epic = lignes.find((l) => l.kind === 'epic');
  assert.match(epic.suffixe, /son lieu ne le prouve pas/, 'le cas construit rend bien la phrase de l’indice');
  assert.ok(epic.suffixe.length > 40, `le suffixe est bien long (${epic.suffixe.length} colonnes)`);

  // ⚠️ ON ÉPROUVE DES COLONNES ÉTROITES ET LARGES : le défaut n’apparaît que quand le suffixe
  // mange toute la place, et une seule largeur ne le trouverait que par chance.
  for (const colonne of [40, 55, 73, 90]) {
    const rendu = texteDeLigne(epic, colonne);
    assert.equal(rendu.length, colonne, `à ${colonne} colonnes, la ligne fait EXACTEMENT la colonne — ni plus, ni moins`);
    // 🔴 LE TITRE SURVIT. Une ligne réduite à son suffixe a perdu ce qu’elle nomme ET son rang
    // dans l’arbre : le dirigeant lit une phrase d’absence flottante, rattachée à rien.
    // ⚠️ LA MARQUE EST CHERCHÉE DANS SON ENSEMBLE, pas dans celles que j'avais en tête : ma
    // première rédaction oubliait « ▸ » (l'epic pris en charge) et rendait un rouge sur du code
    // juste — la mesure portait sur mon instrument, pas sur le défaut.
    assert.match(rendu, /^ *[▼▶▸○├?]/, `à ${colonne} colonnes, la ligne garde son indentation et sa marque`);
    assert.ok(
      rendu.includes(epic.titre.slice(0, 6)),
      `à ${colonne} colonnes, la ligne a PERDU son titre — il ne reste que le suffixe : « ${rendu.trim()} »`
    );
  }

  // ET L’ÉCRAN ENTIER TIENT, sur la même donnée.
  for (const largeur of [60, 100, 118]) {
    const ecran = rendreEcran({ vue, etat, lignes, largeur, hauteur: 12 });
    const trop = ecran.filter((l) => l.texte.length > largeur);
    assert.deepEqual(
      trop.map((l) => l.texte.length),
      [],
      `${trop.length} ligne(s) débordent d’un écran de ${largeur} — un terminal les replierait et l’arbre casserait`
    );
  }
});

test('un orchestrateur dont les epics n’ont PAS pu être lus le dit — jamais « 0 epic »', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260824-0001');
  // Le ServiceDesk ne connaît pas ce chantier : le lecteur JETTE, la vue rend `epics: null`.
  const service = unServiceDesk({ projets: [] });
  const vue = await uneVue({ tmp, agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const { textes } = texteDeLArbre(vue, etatInitial());
  const ligne = textes.find((l) => l.includes('kamouraska'));
  // 🔴 « je n'ai pas pu lire » ET « il n'en a aucun » APPELLENT DEUX GESTES OPPOSÉS — réparer
  // un accès, ou aller chercher du travail. Les fondre en « 0 epic » a déjà fait disparaître
  // le travail d'agents entiers de cette vue, en silence.
  assert.match(ligne, /NON LUS/, 'la ligne dit que les epics n’ont pas été lus');
  assert.ok(!/0 epic/.test(ligne), 'et surtout pas « 0 epic »');

  const detail = detailDe(texteDeLArbre(vue, etatInitial()).lignes[0]).join('\n');
  assert.match(detail, new RegExp(MOT_NON_ETABLI + '|NON MESUR'), 'et le détail dit la mesure qui a manqué');
});

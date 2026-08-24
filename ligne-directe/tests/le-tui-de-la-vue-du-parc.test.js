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
} from '../src/tui-vue-du-parc.js';
import { decoderTouche, texteDeProgression, servirLaVue } from '../src/tui-boucle.js';
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

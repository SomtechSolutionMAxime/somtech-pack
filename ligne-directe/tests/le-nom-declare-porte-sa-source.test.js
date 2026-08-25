// LE NOM DÉCLARÉ PORTE SA SOURCE — dans la vue texte ET dans le TUI
// (E-20260825-0001, sous D-20260824-0003 — stories T-20260825-0002 et T-20260825-0003.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER FERME, ET POURQUOI IL EXISTE
//
// Le BRD v0.11.0 amende RA-VUE-005 : `assigned_agent` devient une source ADMISE, dite
// **DÉCLARÉE**, à côté du mandat lu au lieu, dit **PROUVÉ**. RA-VUE-006 en pose la
// contrepartie : **chaque ligne dit sa source**, et un écart entre les deux **se montre**.
//
// 🔴 LA FORME DE DÉFAUT QUE CES BANCS GARDENT N'EST PAS « le nom ne s'affiche pas ». C'est
// **« le nom s'affiche et on ne sait plus d'où il vient »** — un DÉCLARÉ qui se lit comme un
// PROUVÉ. Il ne se voit pas en relecture : les deux rendus sont un nom d'agent à droite d'une
// ligne, et c'est précisément ce qui les rend indiscernables à l'œil du dirigeant.
//
// ⚠️ LES DONNÉES ENTRENT PAR LA CHAÎNE RÉELLE — vrais lieux posés sur le disque, vrai
// recensement, vrai `lecteurDeChantier`. Un seul point est substitué, nommé : le transport HTTP
// vers le ServiceDesk, qui rend la forme MESURÉE du service (`assigned_agent` sur le ticket,
// clé ABSENTE de l'epic — vérifié contre le service réel le 2026-08-25). Un double qui poserait
// `assigned_agent` sur l'epic éprouverait un service qui n'existe pas.
//
// 🔴 DEUX ÉTATS NE SONT PAS ÉPROUVÉS SUR LE PARC RÉEL, ET C'EST DIT PLUTÔT QUE COMBLÉ.
// PROUVÉ et ÉCART n'apparaissent sur AUCUNE ligne du poste aujourd'hui : aucun chef d'équipe
// n'a de lieu où lire son mandat (T-20260822-0018), donc l'étage 1 ne répond jamais sous un
// epic. Ces deux états sont donc gardés ICI, sur les fabriques de ce dépôt — jamais fabriqués
// dans le parc réel (arbitrage de `kamouraska`, 2026-08-25).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unRecensement } from '../src/recensement.js';
import { roleDuLieu } from '../src/lieu-agent.js';
import { role as roleDe } from '../src/roles.js';
import {
  laVueDuParc,
  lecteurDeChantier,
  rendreLaVue,
  rendreAttribution,
  nomsDeclares,
  memeNom,
  MOT_NON_ETABLI,
  MOT_DECLARE,
  MOT_ECART,
  PHRASE_DU_DECLARE,
} from '../src/vue-du-parc.js';
import {
  arbreDeLaVue,
  lignesVisibles,
  detailDe,
  etatInitial,
  nonPrisDe,
  texteDeLigne,
  suffixeDuRattachement,
  marqueDuRattachement,
  lignesDeLaSource,
} from '../src/tui-vue-du-parc.js';
import { unPaneDAgent } from './aide/formes-reelles.js';

const racine = () => mkdtempSync(join(tmpdir(), 'nom-declare-'));

const METIER = { orchestrateur: "# Tu es l'orchestrateur de ce chantier\n\nle métier du jour.\n" };
const CONTEXTE = { orchestrateur: '# Ce qui est propre à ce dépôt\n\nrien.\n' };

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
 * UN TRANSPORT DE BANC — le SEUL point substitué, et il rend la forme MESURÉE du service.
 *
 * ⚠️ `assigned_agent` EST POSÉ SUR LES TICKETS ET JAMAIS SUR LES EPICS. Ce n'est pas une
 * simplification : c'est ce que le service rend, mesuré le 2026-08-25 (la clé est ABSENTE de
 * la charge `epics` action `list`, pas vide). Un double plus généreux que le service ferait
 * passer pour gardé un chemin que le réel n'emprunte jamais.
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
async function uneVue({ agents = [], service }) {
  const recensement = await unRecensement({
    panes: agents.map((a) => unPaneDAgent({ pane_id: a.pane, foreground_cwd: a.lieu })),
    roleDuLieu,
    nomsConnus: nomsLus(agents.map((a) => [a.pane, a.nom, undefined])),
  });
  return laVueDuParc({ recensement, lireChantier: lecteurDeChantier({ appeler: service.appeler }) });
}

/** Le décor commun : un orchestrateur vivant, son chantier, un epic, et ce qu'on y accroche. */
function unDecor({ tickets }) {
  return unServiceDesk({
    applications: [{ id: 'a1', name: 'Somtech Pack' }],
    projets: [
      { id: 'u1', project_id: 'P-20260822-0001', title: 'Voir qui travaille', status: 'active', application_id: 'a1' },
    ],
    epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-20260825-0001', title: 'Un epic', status: 'in_execution' }],
    tickets,
  });
}

const laStory = (vue) => vue.orchestrateurs[0].epics[0].stories[0];
const lEpic = (vue) => vue.orchestrateurs[0].epics[0];

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260825-0002 — LA VUE TEXTE
// ═══════════════════════════════════════════════════════════════════════════════════════

test('1ᵉʳ G/W/T — un ticket dont le registre déclare un nom, sans mandat prouvé : la ligne porte le NOM avec la marque DÉCLARÉ, et jamais un NON ÉTABLI nu', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const service = unDecor({
    tickets: [
      {
        id: 't1',
        epic_id: 'e1',
        ticket_id: 'T-20260825-0002',
        title: 'La vue texte porte le nom déclaré',
        status: 'in_progress',
        assigned_agent: 'e-20260825-0001',
      },
    ],
  });
  const vue = await uneVue({ agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  // ⚠️ LA FIXTURE SE PROUVE CONFORME AVANT DE PROUVER QUOI QUE CE SOIT D'AUTRE. La clé des
  // noms porte la SESSION séparée par NUL (`cleDeLAgent`) ; un séparateur différent rendrait
  // TOUS les noms absents, et chaque banc de ce fichier passerait pour une raison qui n'est
  // pas la sienne — sur un décor où plus personne n'a de nom.
  assert.equal(vue.orchestrateurs[0].agent.nom, 'kamouraska', 'le décor résout bien les noms du recensement');

  const s = laStory(vue);
  assert.equal(s.agent.mesure, 'déclarée', 'la source est DÉCLARÉE — ni mesurée, ni non établie');
  assert.deepEqual(
    s.agent.declares.map((d) => [d.nom, d.dOu]),
    [['e-20260825-0001', 'ce ticket']],
    'le nom vient du ticket lui-même, et sa provenance voyage avec lui'
  );

  const texte = rendreLaVue(vue);
  const ligne = texte.split('\n').find((l) => l.includes('T-20260825-0002'));
  assert.ok(ligne, 'la story a bien une ligne dans la vue');
  assert.ok(ligne.includes('e-20260825-0001'), `le nom déclaré est SUR la ligne : ${ligne}`);
  assert.ok(ligne.includes(MOT_DECLARE), `et il ne s’y lit jamais sans sa marque : ${ligne}`);
  // 🔴 LA MOITIÉ QUI COMPTE : la ligne ne dit PLUS « non établi ». C'est le défaut que le
  // dirigeant a contesté — un écran de NON ÉTABLI sur un parc où le registre porte les noms.
  assert.ok(!ligne.includes(MOT_NON_ETABLI), `un NON ÉTABLI subsiste alors que le champ est rempli : ${ligne}`);
});

test('3ᵉ G/W/T — ni mandat prouvé, ni nom déclaré : la ligne dit NON ÉTABLI, et l’absence ne se comble pas', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  // ⚠️ `assigned_agent: null` ET NON « clé absente » — les deux existent au service, et c'est
  // le cas le plus fréquent (129 des 200 tickets récents mesurés le 2026-08-25).
  const service = unDecor({
    tickets: [
      { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'Une story orpheline', status: 'new', assigned_agent: null },
    ],
  });
  const vue = await uneVue({ agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const s = laStory(vue);
  assert.equal(s.agent.mesure, 'non établi', 'aucune des deux sources ne répond');
  assert.equal(s.nomDeclare, null, 'et le champ traverse à `null` — pas `undefined`, qui se perdrait au JSON');

  const ligne = rendreLaVue(vue)
    .split('\n')
    .find((l) => l.includes('T-1 ·'));
  assert.ok(ligne.includes(MOT_NON_ETABLI), `l’absence se MONTRE : ${ligne}`);
  assert.ok(!ligne.includes(MOT_DECLARE), `et elle ne se comble pas d’une marque de déclaration : ${ligne}`);
});

test('L’ÉTAGE EPIC MONTRE CE QUE SES STORIES DÉCLARENT — deux stories, deux noms, et aucun agrégat inventé', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const service = unDecor({
    tickets: [
      { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'une', status: 'new', assigned_agent: 'e-20260825-0001' },
      { id: 't2', epic_id: 'e1', ticket_id: 'T-2', title: 'deux', status: 'new', assigned_agent: 'e-20260824-0011' },
    ],
  });
  const vue = await uneVue({ agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const e = lEpic(vue);
  assert.equal(e.nomDeclare, null, 'l’epic ne déclare rien LUI-MÊME : le service ne rend pas la clé');
  assert.deepEqual(
    e.agent.declares.map((d) => [d.nom, d.dOu]),
    [
      ['e-20260825-0001', 'ses stories'],
      ['e-20260824-0011', 'ses stories'],
    ],
    'les DEUX noms montent, chacun marqué comme venant des stories'
  );

  const ligne = rendreLaVue(vue)
    .split('\n')
    .find((l) => l.includes('E-20260825-0001 ·'));
  // 🔴 LES DEUX NOMS SE LISENT. « plusieurs », « e-20260825-0001 +1 » ou le premier seul
  // seraient trois façons de CHOISIR — et choisir ici affirme ce que personne n'a mesuré.
  assert.ok(ligne.includes('e-20260825-0001'), `le premier nom se lit sur la ligne d’epic : ${ligne}`);
  assert.ok(ligne.includes('e-20260824-0011'), `le second aussi — aucun agrégat ne les remplace : ${ligne}`);
  assert.ok(ligne.includes('ses stories'), `et la provenance est dite : ${ligne}`);
});

test('UN NOM QUI VIENT DES STORIES NE SE REND JAMAIS COMME UN NOM DÉCLARÉ SUR L’EPIC — la provenance est portée, pas devinée', () => {
  // ⚠️ CETTE NUANCE EST UN CRAN PLUS FINE QUE `MOT_DECLARE`, ET ELLE COMPTE AUTANT. Prêter à
  // l'epic une déclaration qu'il ne porte pas est la même faute d'attribution, un étage plus
  // haut : le dirigeant croirait que le registre a nommé un porteur POUR L'EPIC.
  const deLEpic = nomsDeclares({ nomDeclare: 'e-20260825-0001', nomsDesStories: [] });
  const desStories = nomsDeclares({ nomDeclare: null, nomsDesStories: ['e-20260825-0001'] });
  assert.deepEqual(deLEpic, [{ nom: 'e-20260825-0001', dOu: 'ce ticket' }]);
  assert.deepEqual(desStories, [{ nom: 'e-20260825-0001', dOu: 'ses stories' }]);
  assert.notDeepEqual(deLEpic, desStories, 'les deux provenances ne doivent pas se confondre');

  // ⚠️ ET LE MÊME NOM DES DEUX CÔTÉS NE SE DÉDOUBLE PAS — sinon la ligne dirait deux fois le
  // même agent, ce qui se lit comme deux porteurs.
  const les2 = nomsDeclares({ nomDeclare: 'E-20260825-0001', nomsDesStories: ['e-20260825-0001'] });
  assert.equal(les2.length, 1, 'un même nom, à la casse près, ne compte qu’une fois');
  assert.equal(les2[0].dOu, 'ce ticket', 'et c’est la provenance la plus proche qui l’emporte');
});

test('UN EPIC DONT LES STORIES N’ONT PAS PU ÊTRE LUES NE DÉCLARE RIEN — l’absence se montre, elle ne se comble pas', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  // Le transport JETTE sur les tickets : `lecteurDeChantier` rend alors `stories: null`.
  const service = unDecor({ tickets: [] });
  const appelerQuiJette = async (nom, args) => {
    if (nom === 'tickets') throw new Error('le service a refusé');
    return service.appeler(nom, args);
  };
  const vue = await uneVue({
    agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }],
    service: { appeler: appelerQuiJette, appels: [] },
  });

  const e = lEpic(vue);
  assert.equal(e.stories, null, '« je n’ai pas pu lire » traverse — il ne se replie pas en `[]`');
  assert.equal(e.agent.mesure, 'non établi', 'et rien n’est déclaré depuis des stories qu’on n’a pas lues');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260825-0003 — LE TUI
// ═══════════════════════════════════════════════════════════════════════════════════════

test('1ᵉʳ G/W/T — l’arbre porte le NOM avec sa marque « déclaré », et le nom SURVIT à la troncature de la colonne', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const service = unDecor({
    tickets: [
      {
        id: 't1',
        epic_id: 'e1',
        ticket_id: 'T-20260825-0002',
        title: 'La vue texte porte le nom déclaré — `assigned_agent` sur chaque epic et story',
        status: 'in_progress',
        assigned_agent: 'e-20260825-0001',
      },
    ],
  });
  const vue = await uneVue({ agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etatInitial());
  const ligne = lignes.find((l) => l.kind === 'story');
  assert.ok(ligne, 'la story est une ligne de l’arbre');
  assert.equal(ligne.marque, '◇', 'la marque de l’œil dit DÉCLARÉ — ni ○ (non pris), ni ├ (prouvé)');

  // 🔴 LA TRONCATURE EST LE DÉFAUT QUI A DICTÉ LA FORME DU SUFFIXE, ET ELLE S'ÉPROUVE À LA
  // LARGEUR RÉELLE. `texteDeLigne` réserve au suffixe la MOITIÉ de la colonne au plus, puis
  // coupe : un fragment long y perd son NOM et garde son mot, c'est-à-dire exactement
  // l'inverse de ce que ce lot doit rendre. Mesuré : 60 caractères sortent coupés à 45.
  const texte = texteDeLigne(ligne, 90);
  assert.ok(texte.includes(MOT_DECLARE), `le mot qui décide survit : ${texte}`);
  assert.ok(texte.includes('e-20260825-0001'), `ET LE NOM AUSSI — c’est ce que la story demande : ${texte}`);
  assert.ok(texte.startsWith('      ◇') || texte.includes('◇'), `la marque est du côté du titre : ${texte}`);
});

test('1ᵉʳ G/W/T (suite) — le DÉTAIL dit la source EN TOUTES LETTRES, pas seulement un mot', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const service = unDecor({
    tickets: [
      { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'une story', status: 'new', assigned_agent: 'e-20260825-0001' },
    ],
  });
  const vue = await uneVue({ agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etatInitial());
  const detail = detailDe(lignes.find((l) => l.kind === 'story')).join('\n');

  // ⚠️ « EN TOUTES LETTRES » SE MESURE SUR LA PHRASE ENTIÈRE, PAS SUR UN MOT QU'ELLE CONTIENT.
  // Le suffixe de l'arbre perd le qualificatif faute de place ; s'il ne se retrouvait NULLE
  // PART, RA-VUE-006 serait violée — « chaque ligne dit sa source » n'est pas « chaque ligne
  // porte un mot ».
  //
  // ⚠️ ON RECOLLE LES LIGNES AVANT DE CHERCHER : le panneau ENVELOPPE à 28 colonnes, donc la
  // phrase y est coupée en trois. Chercher un fragment court passerait sur un détail amputé —
  // une assertion trop faible sur un chemin correct est une couverture qui n'existe pas.
  const dune_traite = detail.replace(/\s+/g, ' ');
  assert.ok(
    dune_traite.includes(PHRASE_DU_DECLARE),
    `le détail doit porter la phrase ENTIÈRE « ${PHRASE_DU_DECLARE} » :\n${detail}`
  );
  assert.ok(dune_traite.includes('e-20260825-0001'), `et le nom déclaré y figure :\n${detail}`);
  assert.ok(dune_traite.includes('vient de ce ticket'), `avec sa provenance :\n${detail}`);
});

test('2ᵉ G/W/T — quand les deux sources se contredisent, le DÉTAIL montre les DEUX noms et NOMME l’écart', () => {
  // ⚠️ ÉPROUVÉ SUR UNE FABRIQUE, ET C'EST DIT : cet état n'existe sur AUCUNE ligne du parc réel
  // aujourd'hui (aucun chef d'équipe n'a de lieu — T-20260822-0018). On ne le fabrique donc pas
  // dans le parc ; on le garde ici (arbitrage de `kamouraska`, 2026-08-25).
  const attribution = {
    mesure: 'lue',
    source: 'mandat lu au lieu de l’agent',
    agents: [{ nom: 'e-20260822-0002', pane: 'w1:p2' }],
    ecart: {
      declares: [{ nom: 'bernache', dOu: 'ce ticket' }],
      prouves: ['e-20260822-0002'],
      pourquoi: 'le mandat lu au lieu et le nom déclaré au registre se contredisent — la vue ne tranche pas',
    },
  };
  const detail = lignesDeLaSource(attribution).join('\n');
  assert.ok(detail.includes(MOT_ECART), `le mot ÉCART est dit :\n${detail}`);
  assert.ok(detail.includes('e-20260822-0002'), `le nom PROUVÉ y est :\n${detail}`);
  assert.ok(detail.includes('bernache'), `le nom DÉCLARÉ y est AUSSI — aucun des deux n’est tu :\n${detail}`);
  assert.ok(detail.includes('ne tranche pas'), `et la vue dit qu’elle n’arbitre pas :\n${detail}`);

  // Et dans l'arbre, l'écart passe devant le confort de lecture.
  const suffixe = suffixeDuRattachement(attribution);
  assert.ok(suffixe.startsWith(MOT_ECART), `l’écart s’annonce EN TÊTE du suffixe : ${suffixe}`);
  assert.ok(suffixe.includes('e-20260822-0002') && suffixe.includes('bernache'), `les deux noms : ${suffixe}`);
});

test('3ᵉ G/W/T — SANS aucun nom déclaré, le lot est INERTE : ni marque ◇, ni mot DÉCLARÉ nulle part', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const service = unDecor({
    tickets: [
      { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'une', status: 'new', assigned_agent: null },
      { id: 't2', epic_id: 'e1', ticket_id: 'T-2', title: 'deux', status: 'completed', assigned_agent: null },
    ],
  });
  const vue = await uneVue({ agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etatInitial());
  const ecran = lignes.map((l) => texteDeLigne(l, 90)).join('\n');

  // 🔴 C'EST LA NON-RÉGRESSION, ÉPROUVÉE PAR L'INERTIE. Sur un parc sans déclaration, cet
  // écran doit rendre CE QU'IL RENDAIT AVANT le lot : les mêmes marques, les mêmes mots. Un
  // vocabulaire neuf qui fuiterait sur les lignes qu'il ne concerne pas serait une régression
  // invisible — le dirigeant lirait « déclaré » là où rien n'a été déclaré.
  assert.ok(!ecran.includes('◇'), `aucune marque de déclaration ne doit fuir :\n${ecran}`);
  assert.ok(!ecran.includes(MOT_DECLARE), `ni le mot :\n${ecran}`);
  assert.ok(ecran.includes('NON PRIS'), 'et le vocabulaire d’avant est intact');

  // Le groupement par app et la place des lignes dans l'arbre ne bougent pas non plus.
  assert.equal(lignes[0].kind, 'app', 'la racine reste l’app');
  assert.deepEqual(
    lignes.map((l) => l.kind),
    ['app', 'orchestrateur', 'epic', 'story', 'story'],
    'l’arbre a la même forme qu’avant le lot'
  );
});

test('LE FILTRE « non pris » NE RAPPELLE PLUS UN TRAVAIL QUE LE REGISTRE ATTRIBUE — et il dit pourquoi', () => {
  // 🔴 C'EST UN CHANGEMENT DE COMPORTEMENT ASSUMÉ, ET IL EST GARDÉ POUR QU'IL NE SE RETOURNE
  // PAS EN SILENCE. Le filtre `n` sert à décider OÙ AGIR : laisser « NON PRIS » sur un travail
  // que le registre attribue enverrait relancer un chef d'équipe qui l'a déjà pris.
  const declare = nonPrisDe({
    attribution: { mesure: 'déclarée', declares: [{ nom: 'e-20260825-0001', dOu: 'ce ticket' }], indices: [] },
    statut: 'in_progress',
    niveau: 'story',
  });
  assert.equal(declare.nonPris, false, 'un travail déclaré n’est pas « non pris »');
  assert.equal(declare.source, 'déclarée', 'et la SOURCE voyage — « pris » ne veut pas dire la même chose des deux côtés');
  // ⚠️ LA RAISON DIT LES DEUX MOITIÉS : ce qui MANQUE (aucun lieu ne le prouve) et ce qui
  // EXISTE (le registre le déclare). N'en dire qu'une ferait lire soit un refus, soit un fait.
  assert.ok(
    declare.pourquoi.includes('aucun agent vivant ne le porte à un lieu'),
    `la raison doit dire ce qui MANQUE : ${declare.pourquoi}`
  );
  assert.ok(
    declare.pourquoi.includes('le registre déclare un nom'),
    `et ce qui EXISTE : ${declare.pourquoi}`
  );

  const prouve = nonPrisDe({
    attribution: { mesure: 'lue', agents: [{ nom: 'kamouraska', pane: 'w1:p1' }] },
    statut: 'in_progress',
    niveau: 'story',
  });
  assert.equal(prouve.source, 'prouvée', 'un travail prouvé porte l’autre source');

  const rien = nonPrisDe({ attribution: { mesure: 'non établi', indices: [] }, statut: 'in_progress', niveau: 'story' });
  assert.equal(rien.nonPris, true, 'et sans aucune des deux sources, il attend toujours quelqu’un');
  assert.equal(rien.source, null, 'sans source');
});

test('LES QUATRE MARQUES SONT QUATRE SIGNES DISTINCTS — aux DEUX étages, par la MÊME fonction', () => {
  // ⚠️ « UNE PORTE SUR DEUX » EST LE MOTIF QUE CE MODULE A DÉJÀ PAYÉ TROIS FOIS. La marque est
  // calculée par une seule fonction pour l'epic et la story ; ce banc garde qu'elle rend bien
  // quatre signes différents, sans quoi deux états se liraient pareil dans la colonne.
  const etats = [
    { nonPris: { nonPris: true }, attendu: '○' },
    { nonPris: { nonPris: null }, attendu: '?' },
    { nonPris: { nonPris: false, source: 'déclarée' }, attendu: '◇' },
    { nonPris: { nonPris: false, source: 'prouvée' }, attendu: 'PRIS' },
  ];
  for (const e of etats) {
    assert.equal(marqueDuRattachement(e.nonPris, { pris: 'PRIS' }), e.attendu, JSON.stringify(e.nonPris));
  }
  const signes = etats.map((e) => e.attendu);
  assert.equal(new Set(signes).size, 4, 'quatre états, quatre signes — aucun ne peut être lu pour un autre');
});

test('LA COMPARAISON DE DEUX NOMS EST SOBRE — elle ne rapproche RIEN par ressemblance', () => {
  // 🔴 UN FAUX « PAS D'ÉCART » TAIT UNE CONTRADICTION RÉELLE, et c'est plus grave qu'un écart
  // affiché de trop. Rapprocher `e-20260825-0001` d'`e20260825-0001` serait deviner une
  // identité — le geste que HS-VUE-002 interdit, retourné contre la détection d'écart.
  assert.ok(memeNom('e-20260825-0001', 'E-20260825-0001'), 'la casse ne fait pas deux agents');
  assert.ok(memeNom(' kamouraska ', 'kamouraska'), 'ni les bords');
  assert.ok(!memeNom('e-20260825-0001', 'e20260825-0001'), 'mais un tiret manquant, SI — on ne devine pas');
  assert.ok(!memeNom('e-20260825', 'e-20260825-0001'), 'ni un préfixe commun');
  assert.ok(!memeNom(null, null), 'et deux absences ne sont pas une identité');
  assert.ok(!memeNom('', ''), 'ni deux vides');
});

test('LE DÉTAIL DIT LA SOURCE AUX DEUX ÉTAGES — un epic ET une story, jamais un seul des deux', async (t) => {
  // ⚠️ LA GARDE DE FAMILLE. `detailDe` porte deux branches presque identiques ; corriger l'une
  // et pas l'autre est le défaut que ce module a payé trois fois. On exige donc la ligne
  // « source » sur les DEUX, atteintes par le même écran.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const service = unDecor({
    tickets: [
      { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'une', status: 'new', assigned_agent: 'e-20260825-0001' },
    ],
  });
  const vue = await uneVue({ agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etatInitial());

  for (const kind of ['epic', 'story']) {
    const detail = detailDe(lignes.find((l) => l.kind === kind)).join('\n');
    assert.ok(detail.includes('source  :'), `l’étage « ${kind} » ne dit pas sa source :\n${detail}`);
    assert.ok(detail.includes(MOT_DECLARE), `l’étage « ${kind} » ne nomme pas la source déclarée :\n${detail}`);
    assert.ok(
      detail.includes('e-20260825-0001'),
      `l’étage « ${kind} » ne rend pas le nom déclaré :\n${detail}`
    );
  }
});

test('LE RENDU DU MOTEUR ET CELUI DU TUI DISENT LA MÊME SOURCE — deux textes, jamais deux vérités', () => {
  // ⚠️ DEUX SURFACES, DEUX RENDUS, ET C'EST DÉLIBÉRÉ (la colonne du TUI tronque). Ce qui ne
  // doit PAS diverger, c'est le MOT QUI DÉCIDE : le jour où l'un dirait « DÉCLARÉ » et l'autre
  // « PROUVÉ » sur la même donnée, les deux écrans se contrediraient sans que rien ne rougisse.
  const cas = [
    { mesure: 'déclarée', declares: [{ nom: 'x', dOu: 'ce ticket' }], indices: [], mot: MOT_DECLARE },
    { mesure: 'lue', agents: [{ nom: 'y', pane: 'w1:p1' }], mot: 'PROUVÉ' },
    { mesure: 'non établi', indices: [], mot: MOT_NON_ETABLI },
  ];
  for (const c of cas) {
    const duMoteur = rendreAttribution(c);
    const duTui = suffixeDuRattachement(c);
    assert.ok(duMoteur.startsWith(c.mot), `le moteur : ${duMoteur}`);
    assert.ok(duTui.startsWith(c.mot), `le TUI : ${duTui}`);
  }
});

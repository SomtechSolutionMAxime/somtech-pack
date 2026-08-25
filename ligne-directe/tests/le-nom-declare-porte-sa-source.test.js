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
  PHRASE_COURTE_DU_DECLARE,
  PHRASE_DE_LINDICE,
  quiPorte,
  FRAGMENT_DU_QUALIFICATIF,
  desarmerLeTexteLibre,
  ecrireLaVue,
  SIGNAUX_DE_LA_LIGNE,
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
    // ⚠️ LA BORNE `limit` EST HONORÉE, COMME LE SERVICE L'HONORE. Un double qui la reçoit et
    // rend TOUT est plus généreux que le service : il signale la page pleine ET rend la page
    // entière, ce qui n'arrive jamais en production. Un double non conforme ne rate pas
    // seulement un défaut — les gardes bâties dessus finissent par exiger le comportement
    // fautif. Trouvé en écrivant le banc du plafond, sur ce fichier même.
    const retenus = tickets.filter((t) => t.epic_id === args?.epic_id);
    return { tickets: args?.limit ? retenus.slice(0, args.limit) : retenus };
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

test('LE QUALIFICATIF NE SE DIT QU’UNE FOIS PAR PANNEAU — le fix du 2026-08-25 est GARDÉ, pas seulement fait', async (t) => {
  // 🔴 CE BANC EXISTE PARCE QU'UNE PASSE PORTAIL A REJETÉ LE LOT SANS LUI (2026-08-25). Le
  // commit qui a dégraissé le panneau remplaçait `rendreAttribution` par
  // `suffixeDuRattachement` sur la ligne « porteur », aux deux étages. **Le reverser laissait
  // les 1050 essais VERTS.**
  //
  // 🔴 ET MA PREMIÈRE TENTATIVE DE GARDE N'A PAS MORDU NON PLUS — elle comptait
  // `PHRASE_DU_DECLARE`, la phrase LONGUE, quand la ligne « porteur » portait la phrase
  // COURTE. Deux textes différents pour la même idée : la garde cherchait un objet, le défaut
  // vivait dans un autre. Mesuré ensuite pour de vrai, sur le panneau recomposé :
  //
  //   AVANT le fix : « mesuré à un lieu » ×2   ·   APRÈS : ×1
  //
  // ⚠️ ON COMPTE DONC LE FRAGMENT QUE LES DEUX FORMULATIONS PARTAGENT, pas l'une des deux.
  // « non mesuré à un lieu » (courte) et « jamais mesuré à un lieu » (longue) disent la même
  // chose au lecteur ; ce qui le fatigue est de la relire, pas de la relire à l'identique.
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
    const panneau = detailDe(lignes.find((l) => l.kind === kind)).join(' ').replace(/\s+/g, ' ');
    const combien = panneau.split(FRAGMENT_DU_QUALIFICATIF).length - 1;
    assert.equal(
      combien,
      1,
      `l’étage « ${kind} » dit « ${FRAGMENT_DU_QUALIFICATIF} » ${combien} fois au lieu d’une — ` +
        `dans 28 colonnes, chaque passage coûte plusieurs lignes et chasse ce qui suit :\n${panneau}`
    );
  }
});

test('LA LIGNE « porteur » PORTE LE MOT ET LE NOM, ET LAISSE LE QUALIFICATIF AU BLOC « source »', async (t) => {
  // ⚠️ LE JUMEAU DU BANC AU-DESSUS, ET IL GARDE L'AUTRE MOITIÉ. Le compte tomberait aussi si
  // quelqu'un retirait le bloc « source » au lieu de dégraisser « porteur » — la correction
  // INVERSE, qui ferait perdre au panneau la seule phrase entière qu'il porte (RA-VUE-006 :
  // « chaque ligne dit sa source » n'est pas « chaque ligne porte un mot »). Ce banc épingle
  // donc QUI porte quoi.
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
    const panneau = detailDe(lignes.find((l) => l.kind === kind));
    const iPorteur = panneau.findIndex((l) => l.startsWith('porteur :'));
    const iSource = panneau.findIndex((l) => l.startsWith('source  :'));
    assert.ok(iPorteur >= 0, `l’étage « ${kind} » doit avoir une ligne « porteur »`);
    assert.ok(iSource > iPorteur, `l’étage « ${kind} » doit avoir un bloc « source » APRÈS elle`);

    // La tranche « porteur » s'arrête où commence « source » — c'est elle qu'on mesure.
    const porteur = panneau.slice(iPorteur, iSource).join(' ').replace(/\s+/g, ' ');
    assert.ok(porteur.includes('e-20260825-0001'), `« porteur » rend le NOM à l’étage « ${kind} » : ${porteur}`);
    assert.ok(porteur.includes(MOT_DECLARE), `et son mot qui décide à l’étage « ${kind} » : ${porteur}`);
    assert.ok(
      !porteur.includes(FRAGMENT_DU_QUALIFICATIF),
      `mais PAS le qualificatif — il appartient au bloc « source », à l’étage « ${kind} » : ${porteur}`
    );

    // Et « source » le porte, lui, en entier : sans quoi le panneau ne dirait la source nulle part.
    const source = panneau.slice(iSource).join(' ').replace(/\s+/g, ' ');
    assert.ok(
      source.includes(PHRASE_DU_DECLARE),
      `le bloc « source » doit porter la phrase ENTIÈRE à l’étage « ${kind} » : ${source}`
    );
  }
});

test('LES DEUX FORMULATIONS DU QUALIFICATIF PARTAGENT BIEN LE FRAGMENT QU’ON COMPTE', () => {
  // 🔴 SANS CE BANC, LES DEUX CI-DESSUS PEUVENT DEVENIR VACANTS EN SILENCE. Ils comptent un
  // fragment ; le jour où l'une des deux phrases est reformulée sans lui, ils cesseraient de
  // mesurer quoi que ce soit — et passeraient, puisqu'ils comptent alors zéro… non : ils
  // exigent EXACTEMENT une occurrence, donc ils rougiraient. C'est justement pour que ce rouge
  // accuse la BONNE cause qu'on épingle ici le lien entre le fragment et ses deux phrases.
  assert.ok(
    PHRASE_COURTE_DU_DECLARE.includes(FRAGMENT_DU_QUALIFICATIF),
    `la phrase COURTE ne porte plus « ${FRAGMENT_DU_QUALIFICATIF} » : ${PHRASE_COURTE_DU_DECLARE}`
  );
  assert.ok(
    PHRASE_DU_DECLARE.includes(FRAGMENT_DU_QUALIFICATIF),
    `la phrase LONGUE ne porte plus « ${FRAGMENT_DU_QUALIFICATIF} » : ${PHRASE_DU_DECLARE}`
  );
  // ⚠️ ET ELLES RESTENT DEUX TEXTES DIFFÉRENTS — c'est tout l'objet du dégraissage : la
  // colonne étroite prend la courte, le panneau prend l'entière.
  assert.notEqual(PHRASE_COURTE_DU_DECLARE, PHRASE_DU_DECLARE);
});

test('UN EPIC DONT LES STORIES ONT REFUSÉ NE DIT PAS « le registre ne déclare aucun nom » — il n’a pas pu regarder', async (t) => {
  // 🔴 CE BANC EXISTE PARCE QU'UNE PASSE DE FOND A TROUVÉ CE DÉFAUT DANS CE LOT (2026-08-25),
  // et il était RÉEL : un epic ne porte pas `assigned_agent` (le service ne rend pas la clé),
  // donc tout ce qu'il déclare vient de ses stories. Quand l'appel aux tickets échoue,
  // `stories` vaut `null` — on n'a RIEN pu lire du registre pour cet epic. La phrase rendue
  // affirmait pourtant « et le registre ne déclare aucun nom sur ce travail ».
  //
  // ⚠️ C'EST RA-VUE-003 VIOLÉE PAR LE LOT QUI LA CITE : une absence COMBLÉE là où il fallait
  // montrer un trou de mesure. « il n'y a personne » et « je n'ai pas pu voir » appellent deux
  // gestes opposés — réassigner d'un côté, réparer un accès de l'autre.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

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
  assert.equal(e.stories, null, 'le décor doit bien produire « stories non lues » — sinon ce banc ne mesure rien');
  assert.equal(e.agent.declarationMesuree, false, 'la vue doit PORTER le fait que la déclaration n’a pas pu être lue');
  assert.ok(
    !e.agent.pourquoi.includes('le registre ne déclare aucun nom'),
    `la phrase AFFIRME une absence qu’on n’a pas mesurée : ${e.agent.pourquoi}`
  );
  assert.ok(
    e.agent.pourquoi.includes('n’a PAS pu être lu'),
    `elle doit dire le trou de MESURE : ${e.agent.pourquoi}`
  );

  // ⚠️ ET JUSQU'AU PANNEAU QUE LE DIRIGEANT LIT — la donnée juste et le rendu muet seraient le
  // même défaut, un passage plus loin.
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etatInitial());
  const detail = detailDe(lignes.find((l) => l.kind === 'epic')).join(' ').replace(/\s+/g, ' ');
  assert.ok(!detail.includes('le registre ne déclare aucun nom'), `le panneau affirme l’absence : ${detail}`);
  assert.ok(detail.includes('n’a PAS pu être lu'), `le panneau doit dire le trou de mesure : ${detail}`);
});

test('MAIS UN EPIC DONT LES STORIES ONT ÉTÉ LUES ET NE DÉCLARENT RIEN DIT BIEN L’ABSENCE — le symétrique', async (t) => {
  // 🔴 LE JUMEAU, ET IL FERME LE FAUX POSITIF QUE LE CORRECTIF CI-DESSUS POURRAIT OUVRIR. Un
  // correctif ferme un défaut nommé et ouvre son symétrique sur la même frontière : dire
  // « je n'ai pas pu lire » alors qu'on A lu et qu'il n'y a rien serait la faute inverse, et
  // elle enverrait réparer un accès qui fonctionne.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const service = unDecor({
    tickets: [{ id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'une', status: 'new', assigned_agent: null }],
  });
  const vue = await uneVue({ agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  const e = lEpic(vue);
  assert.ok(Array.isArray(e.stories), 'ici les stories ONT été lues');
  assert.equal(e.agent.declarationMesuree, undefined, 'rien à signaler : le champ ne voyage que quand la mesure a manqué');
  assert.ok(
    e.agent.pourquoi.includes('le registre ne déclare aucun nom'),
    `l’absence MESURÉE se dit comme une absence : ${e.agent.pourquoi}`
  );
  assert.ok(
    !e.agent.pourquoi.includes('n’a PAS pu être lu'),
    `et jamais comme un trou de mesure : ${e.agent.pourquoi}`
  );
});

test('UN `assigned_agent` QUI N’EST PAS DU TEXTE EST REFUSÉ — jamais rendu « [object Object] »', () => {
  // ⚠️ `String(x)` NE REFUSE RIEN : un objet y devient « [object Object] », qui se rendrait à
  // l'écran comme un nom d'agent — un nom d'affichage faux est pire qu'un nom absent, parce
  // qu'on lui PARLE. `codePorteEnMandat` et `codePorteEnNom` gardent déjà leur entrée sur
  // `typeof` ; ne pas le faire ici était la même discipline appliquée à une porte sur trois.
  //
  // ⚠️ NON DÉMONTRÉ SUR LE SERVICE (le champ est documenté texte libre) — c'est une garde de
  // discipline, et elle est dite comme telle plutôt que présentée comme un défaut mesuré.
  for (const pas_du_texte of [{}, [], 42, true, () => {}]) {
    assert.deepEqual(
      nomsDeclares({ nomDeclare: pas_du_texte, nomsDesStories: [pas_du_texte] }),
      [],
      `« ${typeof pas_du_texte} » ne doit produire AUCUN nom déclaré`
    );
  }
  // Et le texte, lui, passe toujours.
  assert.deepEqual(nomsDeclares({ nomDeclare: 'e-20260825-0001' }), [{ nom: 'e-20260825-0001', dOu: 'ce ticket' }]);
});

test('LE JUMEAU À PISTES DIT LA MÊME CHOSE DU REGISTRE — la branche que mes deux bancs n’atteignaient pas', async (t) => {
  // 🔴 CE BANC EXISTE PARCE QU'UNE TROISIÈME PASSE A REJETÉ LE CORRECTIF PRÉCÉDENT (2026-08-25),
  // et le motif est exactement celui que ce correctif venait de fermer un étage plus bas :
  // **une garde posée sur un cas ne couvre pas sa famille.**
  //
  // `quiPorte` a DEUX sorties « non établi » : celle qui n'a aucune piste, et celle où un agent
  // porte le code comme NOM sans le porter comme mandat. Les deux posent `declarationMesuree`.
  // Mes deux bancs n'atteignaient QUE la première — l'agent du décor s'appelle `kamouraska`,
  // donc `parNom.get('E-…')` est toujours vide. Mesuré par la passe : forcer, ou retirer, le
  // champ sur la branche à pistes laissait **1056 essais VERTS**.
  //
  // ⚠️ ET C'EST LA MÊME FRONTIÈRE QUE RA-VUE-006 GARDE : sur cette branche, rien n'empêchait la
  // ligne d'affirmer « le registre ne déclare aucun nom » là où le registre n'a pas pu être lu.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const service = unDecor({ tickets: [] });
  const appelerQuiJette = async (nom, args) => {
    if (nom === 'tickets') throw new Error('le service a refusé');
    return service.appeler(nom, args);
  };

  // ⚠️ LE SECOND AGENT PORTE LE CODE DE L'EPIC COMME **NOM**, ET N'A AUCUN LIEU QUI LE PROUVE.
  // C'est la population réelle que le module documente : mesuré le 2026-08-22, 42 agents
  // portent un nom qui EST un code de chantier et 41 d'entre eux ont `mandat: null`. Sans ce
  // second agent, la branche à pistes reste structurellement inatteignable par ce décor.
  const vue = await uneVue({
    agents: [
      { pane: 'w1:p1', lieu, nom: 'kamouraska' },
      { pane: 'w1:p2', lieu: join(tmp, 'ailleurs'), nom: 'e-20260825-0001' },
    ],
    service: { appeler: appelerQuiJette, appels: [] },
  });

  const e = lEpic(vue);
  assert.ok(e.agent.indices?.length, 'le décor doit produire une PISTE — sinon ce banc mesure l’autre branche');
  assert.equal(e.stories, null, 'et des stories NON LUES — sinon il ne mesure pas le trou de mesure');
  assert.equal(
    e.agent.declarationMesuree,
    false,
    'la branche à pistes doit porter le fait, comme sa jumelle — une porte sur deux ne garde rien'
  );
  assert.ok(
    !e.agent.pourquoi.includes('le registre ne déclare aucun nom'),
    `la branche à pistes AFFIRME une absence non mesurée : ${e.agent.pourquoi}`
  );
  assert.ok(e.agent.pourquoi.includes('n’a PAS pu être lu'), `elle doit dire le trou : ${e.agent.pourquoi}`);

  // ⚠️ ET LA PISTE RESTE UNE PISTE — le correctif ne doit pas la promouvoir en déclaration.
  assert.equal(e.agent.mesure, 'non établi', 'un nom qui n’est pas un mandat ne devient pas une source');
  assert.equal(e.agent.phraseDeLIndice, PHRASE_DE_LINDICE, 'et la phrase de l’indice voyage toujours avec elle');
});

test('LE SYMÉTRIQUE DE LA BRANCHE À PISTES — stories LUES et rien de déclaré : l’absence se dit comme une absence', async (t) => {
  // ⚠️ LE FAUX POSITIF QUE LE CORRECTIF POURRAIT OUVRIR SUR CETTE BRANCHE-CI. Chaque correctif
  // ferme un défaut nommé et ouvre son symétrique sur la même frontière ; ce lot s'y est déjà
  // fait prendre une fois, sur la branche jumelle.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const service = unDecor({
    tickets: [{ id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'une', status: 'new', assigned_agent: null }],
  });
  const vue = await uneVue({
    agents: [
      { pane: 'w1:p1', lieu, nom: 'kamouraska' },
      { pane: 'w1:p2', lieu: join(tmp, 'ailleurs'), nom: 'e-20260825-0001' },
    ],
    service,
  });

  const e = lEpic(vue);
  assert.ok(e.agent.indices?.length, 'toujours sur la branche à PISTES');
  assert.ok(Array.isArray(e.stories), 'mais ici les stories ONT été lues');
  assert.equal(e.agent.declarationMesuree, undefined, 'rien à signaler : le champ ne voyage que quand la mesure a manqué');
  assert.ok(
    e.agent.pourquoi.includes('le registre ne déclare aucun nom'),
    `l’absence MESURÉE se dit comme une absence : ${e.agent.pourquoi}`
  );
});

test('LES DEUX SORTIES « non établi » DE `quiPorte` PORTENT LE MÊME VOCABULAIRE — la garde de FAMILLE', () => {
  // 🔴 LA GARDE QUI REND LA FAMILLE IMPOSSIBLE À ROUVRIR, plutôt que de fermer un cas de plus.
  // Les deux bancs ci-dessus ferment le défaut VU ; celui-ci ferme le défaut POSSIBLE — une
  // troisième sortie ajoutée demain, ou une des deux corrigée sans l'autre.
  //
  // ⚠️ IL N'APPELLE PAS LA CHAÎNE : il interroge `quiPorte` directement, avec et sans piste,
  // pour que la comparaison porte sur les DEUX branches et sur rien d'autre.
  const parMandat = new Map();
  const avecPiste = new Map([['E-1', [{ session: 's', pane: 'w1:p2', nom: 'e-1' }]]]);
  const sansPiste = new Map();

  for (const [quoi, parNom] of [
    ['sans piste', sansPiste],
    ['avec piste', avecPiste],
  ]) {
    const pasMesure = quiPorte('E-1', parMandat, parNom, { declarationMesuree: false });
    const mesure = quiPorte('E-1', parMandat, parNom, { declarationMesuree: true });

    assert.equal(pasMesure.declarationMesuree, false, `« ${quoi} » : le fait doit voyager quand la mesure a manqué`);
    assert.ok(
      pasMesure.pourquoi.includes('n’a PAS pu être lu'),
      `« ${quoi} » : sa phrase doit dire le trou de mesure : ${pasMesure.pourquoi}`
    );
    assert.equal(mesure.declarationMesuree, undefined, `« ${quoi} » : et ne pas voyager quand tout a été mesuré`);
    assert.ok(
      mesure.pourquoi.includes('le registre ne déclare aucun nom'),
      `« ${quoi} » : l’absence mesurée se dit comme une absence : ${mesure.pourquoi}`
    );
  }
});

test('UNE PAGE DE STORIES PLEINE NE VAUT PAS « tout lu » — la SECONDE forme de « je n’ai pas tout lu »', async (t) => {
  // 🔴 TROISIÈME FOIS QUE CE LOT FERME UN CAS EN CROYANT FERMER SA FAMILLE (2026-08-25, passe
  // de fond). Un epic sans nom propre ne déclare que ce que ses stories déclarent — affirmer
  // « le registre ne déclare aucun nom » exige donc de les avoir TOUTES lues. On peut n'avoir
  // pas tout lu de DEUX façons :
  //
  //   ① l'appel a JETÉ       → `stories === null`      (fermé au commit 878a986)
  //   ② la page était PLEINE → `storiesPlafonnees`     (restait OUVERT)
  //
  // ⚠️ LA CAUSE EST DANS LE NOM QUE J'AVAIS DONNÉ AU FAIT. La phrase disait « l'appel à ses
  // stories a échoué » — un MÉCANISME. Nommer le mécanisme fait rater l'autre mécanisme qui
  // produit le même fait. La question qui décide est « ai-je lu TOUT ce que cet epic
  // déclare ? », et c'est elle que le code pose désormais.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  // ⚠️ LE DÉCOR REPRODUIT LA PAGE PLEINE PAR LA BORNE RÉELLE DU LECTEUR, pas par un drapeau
  // posé à la main : `limite: 1` sur deux tickets. Le second — celui qui déclare un nom —
  // reste hors page, exactement comme sur le service quand un epic dépasse la page.
  const service = unDecor({
    tickets: [
      { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'lu', status: 'new', assigned_agent: null },
      { id: 't2', epic_id: 'e1', ticket_id: 'T-2', title: 'hors page', status: 'new', assigned_agent: 'e-99999999-0001' },
    ],
  });
  const recensement = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', 'kamouraska', undefined]]),
  });
  const vue = await laVueDuParc({
    recensement,
    lireChantier: lecteurDeChantier({ appeler: service.appeler, limite: 1 }),
  });

  const e = lEpic(vue);
  assert.equal(e.storiesPlafonnees, true, 'le décor doit produire une PAGE PLEINE — sinon ce banc ne mesure rien');
  assert.equal(e.stories.length, 1, 'et une seule story vue : la seconde est hors page');
  assert.equal(
    e.agent.declarationMesuree,
    false,
    'une page pleine ne vaut pas « tout lu » — le fait doit voyager'
  );
  assert.ok(
    !e.agent.pourquoi.includes('le registre ne déclare aucun nom'),
    `la ligne AFFIRME une absence alors qu’un nom est déclaré hors page : ${e.agent.pourquoi}`
  );
  assert.ok(
    e.agent.pourquoi.includes('EN ENTIER'),
    `elle doit dire que la lecture est INCOMPLÈTE, pas qu’elle a échoué : ${e.agent.pourquoi}`
  );
});

test('LA PHRASE DU TROU NE NOMME AUCUN MÉCANISME — c’est ce qui la rend vraie des DEUX formes', async (t) => {
  // 🔴 LA GARDE QUI FERME LE DÉFAUT *POSSIBLE*, pas seulement celui qu'on a vu. Une troisième
  // façon de n'avoir pas tout lu apparaîtra un jour (un filtre du service qui cesse d'être
  // honoré, une page suivante jamais demandée). Si la phrase nomme un mécanisme, elle
  // redeviendra fausse ce jour-là — en silence, comme elle l'a été pour la page pleine.
  //
  // ⚠️ ON ÉPINGLE DONC CE QU'ELLE NE DOIT PAS DIRE : aucun mécanisme nommé. Le diff qui
  // ajouterait « l'appel a échoué » rougit, et son auteur devra expliquer pourquoi il restreint
  // une phrase qui vaut pour toute la famille.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  // Les DEUX formes, atteintes par deux décors, et la MÊME phrase attendue des deux.
  const service = unDecor({
    tickets: [
      { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'lu', status: 'new', assigned_agent: null },
      { id: 't2', epic_id: 'e1', ticket_id: 'T-2', title: 'hors page', status: 'new', assigned_agent: 'x' },
    ],
  });
  const recensement = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', 'kamouraska', undefined]]),
  });

  const pagePleine = await laVueDuParc({
    recensement,
    lireChantier: lecteurDeChantier({ appeler: service.appeler, limite: 1 }),
  });
  const appelQuiJette = async (nom, args) => {
    if (nom === 'tickets') throw new Error('le service a refusé');
    return service.appeler(nom, args);
  };
  const aJete = await laVueDuParc({ recensement, lireChantier: lecteurDeChantier({ appeler: appelQuiJette }) });

  const phrases = [lEpic(pagePleine).agent.pourquoi, lEpic(aJete).agent.pourquoi];
  for (const p of phrases) {
    for (const mecanisme of ['a échoué', 'a jeté', 'a refusé', 'plafonn', 'page pleine']) {
      assert.ok(!p.includes(mecanisme), `la phrase nomme le mécanisme « ${mecanisme} » : ${p}`);
    }
    assert.ok(p.includes('EN ENTIER'), `elle doit dire ce qui MANQUE : ${p}`);
  }
  assert.equal(phrases[0], phrases[1], 'les deux formes du même fait se disent avec les MÊMES mots');
});

test('UN NOM DÉCLARÉ NE PILOTE PAS LE TERMINAL DU DIRIGEANT — les trois surfaces, désarmées à la porte', () => {
  // 🔴 CE BANC EXISTE PARCE QU’UNE PASSE DE FOND L’A REPRODUIT (2026-08-25). `assigned_agent`
  // est du texte libre — l’en-tête de ce module le dit lui-même : « personne ne l’atteste ». Ce
  // lot est le PREMIER à en faire une source RENDUE, et elle atteignait `process.stdout` intacte.
  //
  // Mesuré : un nom portant `ESC[2J ESC[H ESC]0;… BEL` traversait `rendreAttribution`,
  // `suffixeDuRattachement` et `lignesDeLaSource` sans une égratignure — il EFFACE l’écran en
  // plein rendu, repositionne le curseur, réécrit le titre de la fenêtre. Code de retour 0 :
  // rien ne le signalait, puisque rien n’avait échoué.
  const ESC = String.fromCharCode(27);
  const BEL = String.fromCharCode(7);
  const CHARGE = `${ESC}[2J${ESC}[H${ESC}]0;PWNED${BEL}`;

  const attribution = {
    mesure: 'déclarée',
    source: PHRASE_DU_DECLARE,
    declares: nomsDeclares({ nomDeclare: CHARGE }),
    indices: [],
  };

  // ⚠️ LES TROIS SURFACES, ÉNUMÉRÉES — une garde posée sur un cas ne couvre pas sa famille, et
  // ce lot s’est déjà fait prendre quatre fois par ce motif.
  const surfaces = {
    'rendreAttribution (vue texte)': rendreAttribution(attribution),
    'suffixeDuRattachement (arbre du TUI)': suffixeDuRattachement(attribution),
    'lignesDeLaSource (panneau de détail)': lignesDeLaSource(attribution).join(' '),
  };
  for (const [ou, rendu] of Object.entries(surfaces)) {
    for (const octet of [ESC, BEL]) {
      assert.ok(
        !rendu.includes(octet),
        `« ${ou} » laisse passer un octet de contrôle jusqu’au terminal : ${JSON.stringify(rendu)}`
      );
    }
    // ⚠️ ET L’ANOMALIE RESTE VISIBLE. Effacer les octets ferait disparaître le FAIT qu’ils
    // étaient là : deux noms différents se rendraient identiques, et le dirigeant croirait lire
    // un nom ordinaire. C’est RA-VUE-003 appliquée à un octet.
    assert.ok(rendu.includes('�'), `« ${ou} » EFFACE l’anomalie au lieu de la montrer : ${rendu}`);
  }
});

test('LE DÉSARMEMENT PORTE SUR LA FAMILLE DES OCTETS DE CONTRÔLE, PAS SUR LA CHARGE QU’ON A VUE', () => {
  // ⚠️ UNE GARDE BÂTIE SUR L’EXEMPLE QUI L’A FAIT NAÎTRE NE COUVRE QUE LUI. On énumère donc la
  // FAMILLE : C0, DEL, et les C1 — ces derniers pilotent aussi certains terminaux, et ce sont
  // ceux qu’un filtre écrit « contre ESC » oublie.
  for (const code of [0x00, 0x07, 0x08, 0x0a, 0x0d, 0x1b, 0x7f, 0x84, 0x9b, 0x9d]) {
    const rendu = desarmerLeTexteLibre(`a${String.fromCharCode(code)}b`);
    assert.equal(rendu, 'a�b', `l’octet 0x${code.toString(16)} n’est pas désarmé : ${JSON.stringify(rendu)}`);
  }
  // ⚠️ ET IL NE TOUCHE À RIEN D’AUTRE — un désarmement trop large abîmerait les noms réels.
  // Les accents et le tiret d’un code de chantier doivent traverser intacts.
  for (const bon of ['e-20260825-0001', 'kamouraska', 'agent-à-accent', 'nom_avec_underscore']) {
    assert.equal(desarmerLeTexteLibre(bon), bon, `« ${bon} » ne doit pas être abîmé`);
  }
  // Ce qui n'est pas du texte traverse tel quel : le refus de type est la porte d'à côté.
  assert.equal(desarmerLeTexteLibre(null), null);
  assert.equal(desarmerLeTexteLibre(42), 42);
});

test('LA VUE NE DÉPEND PAS DU PLAFOND DE CONCURRENCE, MÊME AVEC UN NOM DÉCLARÉ ET UN ÉCART', async (t) => {
  // 🔴 LACUNE DE COUVERTURE RELEVÉE EN PASSE DE FOND, ET FERMÉE ICI PLUTÔT QUE DANS LE BANC
  // D’UN AUTRE LOT. Le banc « LA VUE NE DÉPEND PAS DU PLAFOND — 1, 8, 32 » (lot vitesse,
  // E-20260824-0011) ne renseigne JAMAIS `assigned_agent` dans sa fixture : sa garantie
  // d’invariance n’était donc jamais éprouvée avec les champs de CE lot actifs.
  //
  // ⚠️ LA GARANTIE TIENT — vérifié, pas supposé — mais elle tenait sans être mesurée. Un fait
  // vrai que rien n’éprouve cesse d’être vrai le jour où quelqu’un le change.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  // Un décor qui porte les DEUX états neufs : un nom déclaré pur, et un écart avec le mandat.
  const service = unDecor({
    tickets: [
      { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 'une', status: 'new', assigned_agent: 'e-20260825-0001' },
      { id: 't2', epic_id: 'e1', ticket_id: 'T-2', title: 'deux', status: 'new', assigned_agent: 'e-20260824-0011' },
      { id: 't3', epic_id: 'e1', ticket_id: 'T-3', title: 'trois', status: 'new', assigned_agent: null },
    ],
  });
  const recensement = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', 'kamouraska', undefined]]),
  });

  const vues = await Promise.all(
    [1, 8, 32].map((plafond) =>
      laVueDuParc({ recensement, lireChantier: lecteurDeChantier({ appeler: service.appeler, plafond }) })
    )
  );
  // ⚠️ LE CONTRÔLE POSITIF D’ABORD : si le décor ne fait naître AUCUN nom déclaré, la
  // comparaison serait verte sans avoir rien touché — une égalité vide.
  const declares = (vues[0].orchestrateurs[0].epics[0].stories ?? []).filter(
    (s) => s.agent?.mesure === 'déclarée'
  );
  assert.ok(declares.length >= 2, 'le décor doit faire naître des noms déclarés — sinon ce banc ne mesure rien');

  assert.equal(JSON.stringify(vues[1]), JSON.stringify(vues[0]), 'plafond 8 ≠ plafond 1');
  assert.equal(JSON.stringify(vues[2]), JSON.stringify(vues[0]), 'plafond 32 ≠ plafond 1');
});

test('AUCUNE SURFACE DE SORTIE NE PORTE UN OCTET DE CONTRÔLE — `--json` COMPRIS, et c’est par là que ça fuyait', async (t) => {
  // 🔴 CE BANC EXISTE PARCE QUE MA « PORTE UNIQUE » N’EN ÉTAIT PAS UNE (2026-08-25, revue
  // portail). Le désarmement était posé dans `nomsDeclares`, l’AGRÉGATEUR. Or `nomDeclare` est
  // un champ STRUCTUREL : `recopierLaStructure` le copie BRUT du lecteur jusqu’à la vue, sans
  // jamais passer par l’agrégateur. Le chemin texte et le TUI étaient propres ; `--json` ne
  // l’était pas.
  //
  // ⚠️ ET LE CAS QUI FUYAIT EST PRÉCISÉMENT CELUI QUI AVAIT MOTIVÉ D’ÉLARGIR LE FILTRE :
  // `JSON.stringify` échappe les C0 (ESC devient `\\u001b`), **pas les C1** (0x80–0x9F). Un banc
  // écrit avec ESC serait passé au vert sans rien prouver sur ce chemin — c'est pourquoi
  // celui-ci porte les DEUX familles.
  //
  // ⚠️ CINQUIÈME FOIS QUE CE LOT FERME UN CAS EN CROYANT FERMER SA FAMILLE. La règle qui s'en
  // dégage, et que ce banc grave : **on désarme là où la donnée ENTRE**, jamais là où elle est
  // mise en forme. Un champ a un seul point d'entrée et autant de sorties qu'on en ajoutera.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  const ESC = String.fromCharCode(0x1b); // C0 — échappé par JSON.stringify
  const CSI1 = String.fromCharCode(0x9b); // C1 — PAS échappé par JSON.stringify
  const service = unDecor({
    tickets: [
      {
        id: 't1',
        epic_id: 'e1',
        ticket_id: 'T-1',
        title: 'une',
        status: 'new',
        assigned_agent: `Alice${CSI1}31mDANGER${ESC}[2J`,
      },
    ],
  });
  const vue = await uneVue({ agents: [{ pane: 'w1:p1', lieu, nom: 'kamouraska' }], service });

  // ⚠️ CONTRÔLE POSITIF : sans nom déclaré, ce banc serait vert sans rien toucher.
  const s = laStory(vue);
  assert.ok(s.nomDeclare, 'le décor doit faire naître un nom déclaré — sinon ce banc ne mesure rien');

  // ⚠️ LES DEUX SURFACES DE SORTIE, ÉNUMÉRÉES — c'est la famille, pas le cas qui a fui.
  const surfaces = {
    'ecrireLaVue (texte, le défaut)': ecrireLaVue(vue, []),
    'ecrireLaVue (--json)': ecrireLaVue(vue, ['--json']),
  };
  for (const [ou, rendu] of Object.entries(surfaces)) {
    for (const [nom, octet] of [
      ['C0 (ESC)', ESC],
      ['C1 (0x9B)', CSI1],
    ]) {
      assert.ok(
        !rendu.includes(octet),
        `« ${ou} » laisse passer un octet ${nom} jusqu’à stdout — il pilote le terminal du dirigeant`
      );
    }
    assert.ok(rendu.includes('Alice'), `« ${ou} » doit toujours rendre le nom lisible`);
  }

  // ⚠️ ET LE CHAMP STRUCTUREL LUI-MÊME, pas seulement ce qu’on en imprime : c’est lui qui
  // voyageait brut, et un consommateur du JSON le lit directement.
  assert.ok(!s.nomDeclare.includes(CSI1), `le champ structurel porte encore un C1 : ${JSON.stringify(s.nomDeclare)}`);
  assert.ok(!s.nomDeclare.includes(ESC), `le champ structurel porte encore un C0 : ${JSON.stringify(s.nomDeclare)}`);
});

test('LE DÉSARMEMENT A LIEU À LA LECTURE — pas seulement dans l’agrégateur qui met en forme', async () => {
  // 🔴 LA GARDE QUI FERME LA FAMILLE PLUTÔT QUE LA SORTIE. Le banc ci-dessus énumère DEUX
  // surfaces ; une troisième s’ajoutera un jour, et elle ne serait gardée par personne. Ici on
  // exige que le champ soit propre DÈS LE LECTEUR — avant toute mise en forme, donc pour toute
  // sortie présente ou future.
  //
  // ⚠️ ON INTERROGE `lecteurDeChantier` DIRECTEMENT : le passer par la vue mesurerait aussi
  // l’agrégateur, et ne dirait pas lequel des deux a désarmé.
  const CSI1 = String.fromCharCode(0x9b);
  const lire = lecteurDeChantier({
    appeler: async (nom) => {
      if (nom === 'projects')
        return { projects: [{ id: 'u1', project_id: 'P-20260822-0001', title: 't', status: 'a' }] };
      if (nom === 'applications') return { applications: [] };
      if (nom === 'epics') return { epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'e', status: 's' }] };
      return {
        tickets: [
          { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 's', status: 'new', assigned_agent: `A${CSI1}B` },
        ],
      };
    },
  });
  const chantier = await lire('P-20260822-0001');
  assert.equal(
    chantier.epics[0].stories[0].nomDeclare,
    'A�B',
    'le LECTEUR doit rendre le champ déjà désarmé — sinon toute sortie future rouvre le trou'
  );
});

test('LE CHAMP DE L’EPIC EST DÉSARMÉ AUSSI — le jour où le service le rendra, pas après', async () => {
  // 🔴 CETTE MUTATION SURVIVAIT, ET LA RAISON EST STRUCTURELLE : le service ne rend PAS
  // `assigned_agent` sur un epic (mesuré le 2026-08-25 — la clé est ABSENTE de la charge, pas
  // vide). Aucun décor CONFORME ne peut donc allumer ce chemin, et le désarmement posé dessus
  // n'était gardé par rien.
  //
  // ⚠️ CE BANC POSE DÉLIBÉRÉMENT UN CHAMP QUE LE SERVICE NE REND PAS, ET CE N'EST PAS UN DOUBLE
  // NON CONFORME. La distinction : un double non conforme fait passer pour gardé un chemin que
  // le réel emprunte AUTREMENT. Ici le réel n'emprunte ce chemin PAS ENCORE — le lecteur lit ce
  // champ explicitement « pour le jour où il existera » (voir `lecteurDeChantier`). Ce banc
  // garde ce jour-là, et il le dit plutôt que de laisser croire à une couverture d'aujourd'hui.
  //
  // ⚠️ SANS LUI, LE JOUR OÙ LE SERVICE RENDRA CE CHAMP, LE TROU S'OUVRIRA EN SILENCE — personne
  // ne relie une évolution du service à une ligne de désarmement écrite des mois plus tôt.
  const CSI1 = String.fromCharCode(0x9b);
  const lire = lecteurDeChantier({
    appeler: async (nom) => {
      if (nom === 'projects')
        return { projects: [{ id: 'u1', project_id: 'P-20260822-0001', title: 't', status: 'a' }] };
      if (nom === 'applications') return { applications: [] };
      if (nom === 'epics')
        return {
          epics: [
            // Le champ que le service ne rend pas AUJOURD'HUI — voir l'en-tête de ce banc.
            { id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'e', status: 's', assigned_agent: `A${CSI1}B` },
          ],
        };
      return { tickets: [] };
    },
  });
  const chantier = await lire('P-20260822-0001');
  assert.equal(
    chantier.epics[0].nomDeclare,
    'A\ufffdB',
    'l’etage epic doit desarmer comme l’etage story — une porte sur deux ne garde rien'
  );
});

test('UN ÉCART PORTÉ PAR UNE STORY ALLUME LE SIGNAL DU RÉSUMÉ — le second producteur, que rien n’atteignait', async (t) => {
  // 🔴 HUITIÈME REJET DE CE LOT, ET C’EST LA MÊME FORME QUE LES SEPT AUTRES : une garde posée
  // sur le cas CONNU (l’écart au niveau epic) prise pour une garde sur sa FAMILLE.
  //
  // `quiPorte` est appelé à l’identique pour les epics ET pour les stories : les deux étages
  // produisent `agent.ecart`. Le prédicat de `chantiersAvecEcart` regarde bien les deux — mais
  // AUCUN banc n’exerçait le second. Mesuré : retirer la clause `stories` du prédicat laissait
  // les 1092 essais VERTS, y compris le banc qui charge un instantané réel.
  //
  // ⚠️ CE QUE ÇA COÛTAIT AU DIRIGEANT : la ligne de la story affiche bien ÉCART (le rendu est
  // juste des deux côtés), mais le résumé en tête d’écran reste MUET — la phrase « N chantier(s)
  // portent au moins une CONTRADICTION… allez lire les lignes marquées ÉCART » ne s’affiche pas.
  // Il ne l’apprendrait qu’en parcourant l’arbre au hasard. C’est RA-VUE-006 servie sur une
  // surface et pas sur l’autre.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'p-20260822-0001');

  // ⚠️ L’ÉCART EST POSÉ SUR LA STORY, ET SUR ELLE SEULE. L’epic n’en porte aucun : c’est ce qui
  // isole le second producteur. Un décor où les deux en portent rendrait les deux clauses du
  // prédicat indiscernables — exactement le défaut que ce banc ferme.
  //
  // Pour qu’une story porte un écart, il faut un agent VIVANT dont le mandat lu au lieu EST le
  // code de la story, ET un `assigned_agent` qui désigne quelqu’un d’autre.
  const lieuChef = poserLieu(join(tmp, 'depot'), 't-20260825-0002');
  const service = unDecor({
    tickets: [
      {
        id: 't1',
        epic_id: 'e1',
        ticket_id: 'T-20260825-0002',
        title: 'une story en écart',
        status: 'in_progress',
        assigned_agent: 'quelqu-un-dautre',
      },
    ],
  });
  const vue = await uneVue({
    agents: [
      { pane: 'w1:p1', lieu, nom: 'kamouraska' },
      { pane: 'w1:p2', lieu: lieuChef, nom: 'un-porteur' },
    ],
    service,
  });

  // ⚠️ CONTRÔLE POSITIF, ET IL EST LA MOITIÉ QUI COMPTE : si le décor ne fait naître AUCUN écart
  // au niveau story, ce banc serait vert sans rien mesurer.
  const s = laStory(vue);
  assert.equal(s.agent.mesure, 'lue', 'la story doit être PROUVÉE par le mandat lu au lieu');
  assert.ok(s.agent.ecart, 'et porter un ÉCART avec le nom déclaré — sinon ce banc ne mesure rien');

  const e = lEpic(vue);
  assert.ok(!e.agent?.ecart, 'l’EPIC ne doit porter AUCUN écart — c’est ce qui isole le cas story');

  // ═══ ET LE SIGNAL DU RÉSUMÉ S’ALLUME QUAND MÊME — les quatre passages, depuis l’étage story.
  assert.equal(vue.compte.chantiersAvecEcart, 1, '② le compte n’agrège pas l’écart d’une STORY');
  const morceau = SIGNAUX_DE_LA_LIGNE.find((x) => x.cle === 'chantiersAvecEcart').phrase(1);
  assert.ok(vue.resume.includes(morceau), '③ le résumé ne dit rien de l’écart d’une STORY');
  assert.ok(rendreLaVue(vue).includes(morceau), '④ le dirigeant ne peut pas LIRE l’écart d’une STORY');
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

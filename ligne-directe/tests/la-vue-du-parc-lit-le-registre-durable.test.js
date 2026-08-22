// LES DEUX JOINTURES DE PRODUCTION DE LA VUE — le titre de fenêtre, et les lieux versionnés.
// (E-20260822-0003 — T-20260822-0015 / 0017.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE FICHIER EXISTE PARCE QUE QUINZE BANCS VERTS NE PROUVAIENT RIEN EN PRODUCTION
//
// `vue-du-parc.js` reçoit TOUTE son I/O par paramètre — c'est ce qui le rend éprouvable sans
// clé et sans agent vivant. Le prix de ce choix est qu'un banc peut couvrir le module ENTIER
// pendant que le CÂBLAGE qui l'alimente n'existe pas :
//
//   ① `adresseDe` rend `titre: carte.titre` ; `recensement.js` ne lisait `terminal_title`
//      NULLE PART. Mesuré à l'écriture de ce fichier : zéro occurrence dans `src/`. Les quinze
//      bancs de l'adressabilité passaient sur des doubles qui portaient un titre que la vraie
//      source ne fournissait jamais. **Le dirigeant aurait lu « sans titre de fenêtre » sur
//      chacune des lignes de son parc**, et c'est le titre qui est la raison d'être de la story.
//
//   ② `laVueDuParc` accepte `lieux` ; le veilleur ne les lui passait pas. La vue serait restée
//      exactement celle d'hier — celle qui perd six chantiers sur quinze — avec un module
//      parfaitement gardé et un résumé qui aurait dit « aucun lecteur de lieux ».
//
// > **Ce sont les deux mêmes arêtes que le lot précédent a payées** : « le module était juste,
// > le veilleur était juste ; c'est le PASSAGE de l'un à l'autre qui n'appartenait à aucun banc. »
// > Elles ne se trouvent pas en relisant. Elles se trouvent en EXERÇANT la chaîne entière.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unRecensement } from '../src/recensement.js';
import { Veilleur } from '../src/veilleur.js';
import { lecteurDeLieux } from '../src/vue-du-parc.js';
import { unPaneDAgent } from './aide/formes-reelles.js';

let bac;
before(() => {
  bac = mkdtempSync(join(tmpdir(), 'registre-durable-'));
});
after(() => rmSync(bac, { recursive: true, force: true }));

// ═══════════════════════════════════════════════════════════════════════════════════════
// ① LE TITRE DE FENÊTRE TRAVERSE DEPUIS LA SOURCE — sans quoi l'adressabilité est vide
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le recensement PORTE le titre de fenêtre que herdr rend — sinon la vue n’a rien à afficher', async () => {
  // ⚠️ LA FORME EST CELLE QUE `herdr pane list` REND VRAIMENT, mesurée le 2026-08-22 : la clé
  // s'appelle `terminal_title`, et 73 panes sur 76 la portent.
  const r = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w8X:p6', terminal_title: '◐ Kamouraska orchestrateur P-20260822-0001' })],
    roleDuLieu: () => null,
    references: {},
  });

  assert.equal(r.agents.length, 1);
  assert.equal(
    r.agents[0].titre,
    '◐ Kamouraska orchestrateur P-20260822-0001',
    'le titre doit TRAVERSER : c’est la seule chose que le dirigeant reconnaît à l’œil'
  );
});

test('un pane SANS titre de fenêtre rend `titre: null` — la clé absente ne devient pas « undefined »', async () => {
  // Mesuré : 3 panes sur 76 n'ont PAS la clé. `undefined` fuit jusque dans le texte rendu.
  //
  // ⚠️ UN PANE **D'AGENT** SANS TITRE, PAS UN PANE SANS AGENT. La première version de ce banc
  // employait `unPaneSansAgent` — que le recensement ÉCARTE à juste titre, parce que c'est un
  // terminal. Il mesurait donc « un terminal n'entre pas au registre », sous le titre « un
  // agent sans titre rend null » : un objet mesuré, un autre conclu.
  const r = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w3:p5' })],
    roleDuLieu: () => null,
    references: {},
  });
  assert.equal(r.agents.length, 1);
  assert.equal(r.agents[0].titre, null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ② LE LECTEUR DE LIEUX — le registre DURABLE, lu au disque
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Pose un lieu d'orchestrateur complet (les fichiers que `roleDuLieu` exige). */
function poseUnLieu(racine, mandat) {
  const d = join(racine, '.orchestrateur', mandat);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'CLAUDE.md'), '# Tu es l’orchestrateur de ce chantier\n');
  writeFileSync(join(d, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n');
  return d;
}

test('le lecteur de lieux trouve les lieux d’orchestrateur des racines qu’on lui donne', async () => {
  const racine = join(bac, 'depot-a');
  poseUnLieu(racine, 'p-20260822-0001');
  poseUnLieu(racine, 'd-20260813-0005');

  const lu = await lecteurDeLieux({ racines: [racine], roleDuLieu: () => 'orchestrateur' })();

  assert.equal(lu.mesure, 'lue');
  assert.deepEqual(
    lu.entrees.map((e) => e.mandat).sort(),
    ['d-20260813-0005', 'p-20260822-0001']
  );
  assert.deepEqual(lu.racines, [racine]);
});

test('LE MÊME MANDAT DANS PLUSIEURS DÉPÔTS EST UN SEUL CHANTIER — mesuré : 116 chemins pour 15 mandats', async () => {
  // 🔴 SANS CETTE FUSION, LE PARC SE DÉMULTIPLIE. Sur ce poste, `d-20260813-0005` porte DOUZE
  // lieux — un par worktree du même dépôt. Rendre douze chantiers là où il y en a un est pire
  // que n'en rendre aucun : le dirigeant ne peut plus compter ce qu'il lit.
  const a = join(bac, 'wt-1');
  const b = join(bac, 'wt-2');
  poseUnLieu(a, 'd-20260813-0005');
  poseUnLieu(b, 'd-20260813-0005');

  const lu = await lecteurDeLieux({ racines: [a, b], roleDuLieu: () => 'orchestrateur' })();

  assert.equal(lu.entrees.length, 1, 'un mandat, une entrée');
  assert.equal(lu.entrees[0].chemins.length, 2, 'et les DEUX chemins sont gardés : ils disent où il vit');
});

test('un dossier au bon nom SANS le métier n’est pas un lieu — le rôle s’établit par le CONTENU', async () => {
  // ⚠️ MÊME RÈGLE QUE LE RECENSEMENT (T-20260819-0070) : un répertoire vide au bon nom ne porte
  // aucun métier, et le compter gonflerait la vue de chantiers qui n’existent qu’à moitié.
  const racine = join(bac, 'depot-vide');
  mkdirSync(join(racine, '.orchestrateur', 'p-fantome'), { recursive: true });

  const lu = await lecteurDeLieux({ racines: [racine], roleDuLieu: () => null })();

  assert.deepEqual(lu.entrees, [], 'le nom du dossier ne suffit pas');
});

test('une racine ILLISIBLE ne se rend pas comme « aucun lieu » — la panne de mesure se dit', async () => {
  // 🔴 ON ÉPROUVE LA PANNE DE LA MESURE, PAS SEULEMENT L'ABSENCE. Une racine qui jette, repliée
  // en zéro, ferait rendre un parc amputé avec l'apparence d'un parc complet.
  const bonne = join(bac, 'depot-b');
  poseUnLieu(bonne, 'p-20260822-0001');

  const lu = await lecteurDeLieux({
    racines: [bonne, join(bac, 'nexiste-pas')],
    roleDuLieu: () => 'orchestrateur',
  })();

  assert.equal(lu.entrees.length, 1, 'ce qui a pu être lu est rendu');
  assert.equal(lu.racinesRefusees.length, 1, 'et ce qui n’a PAS pu l’être est NOMMÉ, pas tu');
  assert.match(lu.racinesRefusees[0].racine, /nexiste-pas/);
});

test('AUCUNE racine lisible : la mesure est REFUSÉE, jamais « il n’y a aucun lieu »', async () => {
  const lu = await lecteurDeLieux({
    racines: [join(bac, 'ni-celle-ci'), join(bac, 'ni-celle-la')],
    roleDuLieu: () => 'orchestrateur',
  })();

  assert.equal(lu.mesure, 'refusée', 'zéro racine lue ⇒ on n’a RIEN mesuré, et on le dit');
  assert.equal(lu.entrees, null, '`[]` affirmerait « j’ai regardé, il n’y en a pas »');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ③ LE VEILLEUR PASSE VRAIMENT LES LIEUX À LA VUE — l'arête que personne ne gardait
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le veilleur DONNE les lieux à la vue — sans quoi elle perd tout chantier sans terminal', async () => {
  // ⚠️ MUTATION MESURÉE À L'ÉCRITURE DE CE BANC : retirer `lieux:` de l'appel du veilleur laisse
  // les 940 essais VERTS — et la vue redevient exactement celle d'hier, celle qui perdait six
  // chantiers sur quinze sur ce poste. Aucune erreur, aucun symptôme, un parc amputé de moitié.
  const v = new Veilleur({ cheminSocket: join(bac, 'lieux.sock'), identite: { equipe: 'T' } });
  v.recensementDuPoste = async () => ({ quand: 'T', agents: [], borne: { sessionsRefusees: [] } });

  let recus;
  const vue = await v.vueDuParc({
    construireLecteur: () => async (code) => ({
      code,
      titre: 'chantier lu',
      statut: 'in_progress',
      epics: [],
      epicsEcartes: 0,
      epicsPlafonnes: false,
    }),
    construireLecteurDeLieux: () => async () => {
      recus = true;
      return {
        mesure: 'lue',
        racines: ['/depot'],
        racinesRefusees: [],
        entrees: [{ role: 'orchestrateur', mandat: 'p-20260822-0001', chemins: ['/depot/.orchestrateur/p-20260822-0001'] }],
      };
    },
  });

  assert.ok(recus, 'le veilleur doit APPELER le lecteur de lieux');
  assert.equal(vue.orchestrateurs.length, 1, 'et le chantier sans terminal doit ARRIVER jusqu’à la vue');
  assert.equal(vue.orchestrateurs[0].chantier.code, 'P-20260822-0001');
  assert.equal(vue.registreDesLieux.mesure, 'lue');
});

test('le veilleur construit un VRAI lecteur de lieux par défaut — pas `null` en silence', async () => {
  // ⚠️ C'EST L'ARÊTE JUMELLE DE CELLE QUE LE LOT PRÉCÉDENT A PAYÉE SUR `lecteurDeChantier` :
  // « remplacer cet appel par `null` laissait les 886 essais VERTS ». Un défaut par défaut se
  // rend « aucun lecteur de lieux ne m’a été donné » sur un poste parfaitement configuré.
  const v = new Veilleur({ cheminSocket: join(bac, 'defaut.sock'), identite: { equipe: 'T' } });
  v.recensementDuPoste = async () => ({ quand: 'T', agents: [], borne: { sessionsRefusees: [] } });

  const vue = await v.vueDuParc({ construireLecteur: () => null });

  assert.notEqual(
    vue.registreDesLieux.mesure,
    'non mesurée',
    'un lecteur par défaut EXISTE : « non mesurée » ici voudrait dire qu’aucun n’a été construit'
  );
});

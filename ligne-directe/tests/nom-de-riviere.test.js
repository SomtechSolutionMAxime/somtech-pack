// nom-de-riviere.test.js — ce que la règle de nommage garantit, et ce qu'elle refuse de
// conclure. E-20260818-0017, T-20260818-0140.
//
// ⚠️ CE QUE CETTE SUITE NE PROUVE PAS, ET QUI EST PROUVÉ AILLEURS : qu'une naissance RÉELLE
// donne une rivière sans que personne ne la demande. Ça se prouve contre le vrai binaire
// (`naissance-representant/tests/naitre-bin.test.js`) et par une naissance exécutée sur le
// poste — une suite verte ne prouve pas un mécanisme, elle prouve une fonction.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  RIVIERES,
  estUneRiviere,
  jugerNomDOrchestrateur,
  parcDesNoms,
  attribuerRiviere,
  nomDeLAgentQuiNait,
  nomInscritDansLeLieu,
  inscrireNomDansLeLieu,
  FICHIER_NOM_AGENT,
} from '../src/nom-de-riviere.js';

const bacs = [];
const bac = () => {
  const b = mkdtempSync(join(tmpdir(), 'riv-'));
  bacs.push(b);
  return b;
};
process.on('exit', () => {
  for (const b of bacs) rmSync(b, { recursive: true, force: true });
});

// ═════════════════════ 1. LA LISTE — elle doit être NOMMABLE, pas seulement écrite

test('chaque rivière est un nom que herdr accepterait — sinon la garde donne des noms impossibles', () => {
  // La règle de herdr, recopiée de `nomAgentHerdr` : 1 à 32 caractères, initiale minuscule.
  // Une rivière qui ne la respecte pas ferait échouer la naissance APRÈS l'attribution, sur un
  // nom que la garde vient elle-même de choisir — le pire des refus, celui qu'on s'inflige.
  for (const r of RIVIERES) {
    assert.match(r, /^[a-z][a-z0-9_-]{0,31}$/, `« ${r} » ne peut pas nommer un agent herdr`);
  }
});

test('aucune rivière n’est inscrite deux fois — un doublon rendrait la liste plus courte qu’elle ne dit', () => {
  assert.equal(new Set(RIVIERES).size, RIVIERES.length);
});

test('les rivières DÉJÀ PORTÉES sur ce poste sont dans la liste — sinon la garde refuserait nos propres agents', () => {
  // Mesuré le 2026-08-18 : `matapedia`, `batiscan`, `ristigouche` au parc, `bonaventure`
  // proposée pour la renaissance de `j-20260814-0001`. Une liste qui ne les contiendrait pas
  // ferait refuser, à leur renaissance, les quatre orchestrateurs qu'on a nommés nous-mêmes.
  for (const portee of ['matapedia', 'batiscan', 'ristigouche', 'bonaventure']) {
    assert.ok(estUneRiviere(portee), `« ${portee} » est portée sur ce poste et la garde la refuserait`);
  }
});

// ═════════════════════ 2. LA GARDE — ce qu'elle refuse, et ce qu'elle ne refuse pas

test('les DEUX noms hors convention du parc sont refusés — avec le motif, pas juste un « non »', () => {
  // `orchestrateur` (un rôle que tous pourraient porter) et `rev-pr31` (raccordé à une PR) :
  // les deux agents sur 42 qui ne relevaient d'aucune des deux règles, et dont personne ne
  // s'était aperçu. C'est le cas qui a fait ce lot.
  for (const nom of ['orchestrateur', 'rev-pr31']) {
    const v = jugerNomDOrchestrateur(nom);
    assert.equal(v.conforme, false, `« ${nom} » aurait dû être refusé`);
    assert.equal(v.motif, 'pas_une_riviere');
    assert.match(v.message, /rivière/);
    assert.match(v.message, /geste/i, 'un refus dit ce qui le lève, sinon il n’est que de la friction');
  }
});

test('un CODE DE MANDAT ne nomme pas un orchestrateur — c’est le nom de son LIEU, pas le sien', () => {
  const v = jugerNomDOrchestrateur('j-20260814-0001');
  assert.equal(v.conforme, false);
});

test('une rivière passe, quelle que soit la casse tapée', () => {
  assert.equal(jugerNomDOrchestrateur('bonaventure').conforme, true);
  assert.equal(jugerNomDOrchestrateur('Bonaventure').conforme, true);
});

// ═════════════════════ 3. L'UNICITÉ — hors de la seule famille des agents

test('le parc relève les agents, les CHANTIERS, les CANAUX et les lieux posés — pas seulement les agents', () => {
  // ⚠️ C'EST LE CŒUR DU CRITÈRE. Un nom libre chez les agents peut être pris par un chantier,
  // un canal ou un BRD ; `matapedia` avait renoncé à lire le registre (« structure
  // inattendue » — `lignes` est un TABLEAU, pas une table) et l'avait DIT plutôt que de
  // conclure. La garde fait ce qu'il n'a pas pu faire.
  const depot = bac();
  mkdirSync(join(depot, '.orchestrateur', 'moisie'), { recursive: true });
  mkdirSync(join(depot, '.gestionnaire', 'Charles-Olivier'), { recursive: true });

  const { pris, nonVerifie } = parcDesNoms({
    depot,
    listerAgents: () => ['matapedia', 'e-20260818-0017'],
    lireRegistre: () => ({
      lignes: [{ chantier: 'D-20260805-0004', canal_nom: 'romaine' }],
      communs: { orchestrateur: { canal_nom: 'gatineau' } },
    }),
  });

  assert.ok(pris.includes('matapedia'), 'un agent');
  assert.ok(pris.includes('d-20260805-0004'), 'un chantier du registre');
  assert.ok(pris.includes('romaine'), 'un canal du registre');
  assert.ok(pris.includes('gatineau'), 'un canal commun');
  assert.ok(pris.includes('moisie'), 'un lieu d’orchestrateur posé');
  assert.ok(pris.includes('charles-olivier'), 'un lieu de gestionnaire posé, abaissé');
  // Le ServiceDesk et les BRD restent hors d'atteinte, et c'est dit — jamais conclu libre.
  assert.ok(nonVerifie.some((r) => /ServiceDesk/.test(r)));
});

test('CE QU’ON N’A PAS PU MESURER NE SE MÊLE PAS À CE QU’ON A RELEVÉ — deux champs, jamais un', () => {
  // ⚠️ LA LEÇON DU LOT A, ET ELLE A COÛTÉ. Une raison de non-vérification s'y était glissée
  // dans une liste que des contrôles COMPTAIENT : le résultat changeait selon la machine —
  // vert chez l'auteur, rouge en CI. Un compte qui peut avaler une phrase n'est pas un compte.
  const { pris, nonVerifie } = parcDesNoms({
    listerAgents: () => { throw new Error('herdr ne répond pas'); },
    lireRegistre: () => { throw new Error('registre illisible'); },
  });

  assert.deepEqual(pris, [], 'rien n’a pu être relevé : la liste des noms pris est VIDE');
  assert.ok(nonVerifie.length >= 3, 'et les trois mesures manquées sont nommées');
  for (const n of pris) {
    assert.match(n, /^[a-z0-9][a-z0-9._-]*$/, `« ${n} » ressemble à une phrase, pas à un nom`);
  }
  assert.ok(nonVerifie.some((r) => /herdr ne répond pas/.test(r)), 'la raison réelle est portée, pas résumée');
});

test('un dépôt SANS lieu posé n’est pas une mesure manquée — il n’y a rien, ce n’est pas pareil', () => {
  const { nonVerifie } = parcDesNoms({ depot: bac(), listerAgents: () => [], lireRegistre: () => ({ lignes: [] }) });
  assert.equal(nonVerifie.filter((r) => /lieux/.test(r)).length, 0);
});

// ═════════════════════ 4. L'ATTRIBUTION — déterministe, et libre

test('le même mandat reçoit la MÊME rivière — un nom qui change à chaque appel n’adresse personne', () => {
  const a = attribuerRiviere({ code: 'd-20260818-0008', pris: [] });
  const b = attribuerRiviere({ code: 'd-20260818-0008', pris: [] });
  assert.equal(a.nom, b.nom);
  assert.ok(estUneRiviere(a.nom));
});

test('deux mandats ne reçoivent pas la même rivière sur un parc vide', () => {
  const a = attribuerRiviere({ code: 'd-20260818-0008', pris: [] }).nom;
  const b = attribuerRiviere({ code: 'p-20260815-0002', pris: [] }).nom;
  assert.notEqual(a, b);
});

test('une rivière DÉJÀ PRISE est enjambée — même quand c’est un chantier qui la porte, pas un agent', () => {
  const premiere = attribuerRiviere({ code: 'd-1', pris: [] }).nom;
  const suivante = attribuerRiviere({ code: 'd-1', pris: [premiere] }).nom;
  assert.notEqual(suivante, premiere);
  assert.ok(estUneRiviere(suivante));
});

test('la liste ÉPUISÉE est un refus nommé — jamais un repli sur un nom déjà porté', () => {
  const r = attribuerRiviere({ code: 'd-1', pris: [...RIVIERES] });
  assert.equal(r.nom, null);
  assert.equal(r.motif, 'rivieres_epuisees');
  assert.match(r.message, /geste/i);
});

// ═════════════════════ 5. LE BAPTÊME — le geste entier

test('un ORCHESTRATEUR sans nom demandé reçoit une rivière — c’est tout le lot', () => {
  const r = nomDeLAgentQuiNait({
    role: 'orchestrateur',
    lieu: bac(),
    code: 'd-20260818-0008',
    listerAgents: () => [],
    lireRegistre: () => ({ lignes: [] }),
  });
  assert.ok(estUneRiviere(r.nom), `« ${r.nom} » n’est pas une rivière`);
  assert.equal(r.attribue, true);
});

test('un REPRÉSENTANT garde le nom de son lieu — la règle ne déborde pas sur qui exécute', () => {
  const r = nomDeLAgentQuiNait({ role: 'representant', lieu: bac(), code: 'Charles-Olivier' });
  assert.equal(r.nom, 'charles-olivier');
  assert.equal(r.attribue, false);
});

test('un nom PROPOSÉ hors convention est un REFUS — et il ne rend aucun nom de repli', () => {
  const r = nomDeLAgentQuiNait({ role: 'orchestrateur', lieu: bac(), code: 'd-1', propose: 'rev-pr31' });
  assert.equal(r.nom, null);
  assert.equal(r.motif, 'pas_une_riviere');
});

test('un lieu qui porte DÉJÀ un nom le reprend — sinon un orchestrateur change de nom en redémarrant', () => {
  const lieu = bac();
  inscrireNomDansLeLieu(lieu, 'bonaventure');
  // Le parc porte `bonaventure` : c'est LUI-MÊME, et son propre nom ne doit pas le refuser.
  const r = nomDeLAgentQuiNait({
    role: 'orchestrateur',
    lieu,
    code: 'j-20260814-0001',
    listerAgents: () => ['bonaventure'],
    lireRegistre: () => ({ lignes: [] }),
  });
  assert.equal(r.nom, 'bonaventure');
  assert.equal(r.attribue, false, 'rien n’a été attribué : le lieu faisait foi');
  assert.equal(nomInscritDansLeLieu(lieu), 'bonaventure');
});

test('un lieu qui porte un nom HORS convention est repris EN LE DISANT — on ne bloque pas sur l’erreur d’un autre', () => {
  const lieu = bac();
  writeFileSync(join(lieu, FICHIER_NOM_AGENT), 'rev-pr31\n');
  const r = nomDeLAgentQuiNait({ role: 'orchestrateur', lieu, code: 'd-1' });
  assert.equal(r.nom, 'rev-pr31');
  assert.match(r.avis, /n’est pas une rivière/);
  assert.match(r.avis, new RegExp(FICHIER_NOM_AGENT.replace('.', '\\.')), 'l’avis dit COMMENT le corriger');
});

// Le nom de rivière résout le lieu, là où le code du mandat était exigé (D-20260925-0002).
//
// Le dirigeant tape le NOM de l'agent (`bonaventure`) ; le lieu porte le CODE du mandat
// (`.orchestrateur/j-20260814-0001/`). La machine fait la traduction : elle lit le `.nom-agent`
// de chaque lieu. Ce banc éprouve la fonction PARTAGÉE (`resoudreLieuParCodeOuNom`), avec le
// VRAI lecteur du poste (`nomInscritDansLeLieu`) — jamais un double : un lecteur réécrit ici
// serait une seconde écriture de la règle « trois états », qui suivrait ses propres bornes.
//
// Ce que le banc doit pouvoir attraper : `parcDesNoms` (liste des noms PRIS, sans lieu) prise
// pour un résolveur ; un `.nom-agent` illisible lu comme « aucun nom » ; la pose redirigée vers
// un homonyme de nom ; le code cessant d'être prioritaire.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  resoudreLieu,
  resoudreLieuParCodeOuNom,
  messageNomAmbigu,
  messageNomIntrouvable,
} from '../src/lieu-nom.js';
import { nomInscritDansLeLieu } from '../src/nom-de-riviere.js';

const DOSSIER = '.orchestrateur';

function depot(lieux) {
  const racine = mkdtempSync(join(tmpdir(), 'nom-riviere-'));
  for (const [code, nomAgent] of Object.entries(lieux)) {
    const lieu = join(racine, DOSSIER, code);
    mkdirSync(lieu, { recursive: true });
    if (nomAgent !== undefined) writeFileSync(join(lieu, '.nom-agent'), `${nomAgent}\n`);
  }
  return racine;
}

const resoudre = (racine, saisie) =>
  resoudreLieuParCodeOuNom(racine, DOSSIER, saisie, nomInscritDansLeLieu);

test('G1 — le nom de rivière retient le lieu qui le porte, et dit lequel', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure', 'j-20260814-0002': 'batiscan' });
  const r = resoudre(racine, 'bonaventure');
  assert.equal(r.source, 'nom');
  assert.equal(r.existe, true);
  assert.equal(r.ambigu, false);
  assert.equal(r.nom, 'j-20260814-0001', 'le DOSSIER retenu, pas la saisie');
  assert.equal(r.racine, join(racine, DOSSIER, 'j-20260814-0001'));
  assert.equal(r.demande, 'bonaventure');
});

test('G1 — la casse tapée ne compte pas (le .nom-agent est écrit en minuscules)', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure' });
  assert.equal(resoudre(racine, 'Bonaventure').nom, 'j-20260814-0001');
});

test('G2 — deux lieux portant le même nom : ambigu, les DEUX nommés, aucun retenu', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure', 'j-20260814-0002': 'bonaventure' });
  const r = resoudre(racine, 'bonaventure');
  assert.equal(r.ambigu, true, 'le motif `ambigu` de resoudreLieu, réutilisé tel quel');
  assert.equal(r.existe, false);
  assert.deepEqual(r.homonymes, ['j-20260814-0001', 'j-20260814-0002']);
  const msg = messageNomAmbigu('bonaventure', r.parent, r.homonymes);
  assert.match(msg, /j-20260814-0001/);
  assert.match(msg, /j-20260814-0002/);
  assert.doesNotMatch(msg, /ne diffèrent que par la casse/, 'ce n’est PAS l’ambiguïté de casse');
});

test('G3 — aucun lieu ne porte ce nom : le message dit « inscrit dans aucun lieu », jamais « n’existe pas »', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure', 'j-20260814-0003': undefined });
  const r = resoudre(racine, 'saguenay');
  assert.equal(r.existe, false);
  assert.equal(r.ambigu, false);
  assert.deepEqual(r.illisibles, []);
  const msg = messageNomIntrouvable('saguenay', r.parent, r.illisibles);
  assert.match(msg, /inscrit dans aucun lieu/);
  assert.doesNotMatch(msg, /n['’]existe pas/);
});

test('G4 — un .nom-agent illisible n’est PAS « aucun nom » : la mesure manque, et le refus le dit', {
  skip: process.getuid?.() === 0 ? 'root lit tout : non prouvable ici' : false,
}, () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure', 'j-20260814-0002': 'batiscan' });
  const illisible = join(racine, DOSSIER, 'j-20260814-0002', '.nom-agent');
  chmodSync(illisible, 0o000);
  const r = resoudre(racine, 'batiscan');
  chmodSync(illisible, 0o600);
  assert.equal(r.existe, false, 'on ne retient rien sur une mesure manquée');
  assert.equal(r.illisibles.length, 1);
  assert.equal(r.illisibles[0].lieu, 'j-20260814-0002');
  const msg = messageNomIntrouvable('batiscan', r.parent, r.illisibles);
  assert.match(msg, /j-20260814-0002/);
  assert.match(msg, /RIEN|n['’]en conclu|pas su lire/i);
  assert.doesNotMatch(msg, /inscrit dans aucun lieu/, 'affirmer l’absence serait conclure sur une mesure manquée');
});

test('G5 — le CODE reste prioritaire, casse comprise, même si un autre lieu porte ce mot comme nom', () => {
  const racine = depot({ 'J-20260814-0001': undefined, 'j-20260814-0002': 'j-20260814-0001' });
  const r = resoudre(racine, 'j-20260814-0001');
  assert.equal(r.source, 'code');
  assert.equal(r.nom, 'J-20260814-0001');
});

test('G5 — une saisie ambiguë PAR LA CASSE reste refusée par le motif de casse, pas requalifiée en nom', () => {
  const racine = depot({ 'Abc': undefined, 'abC': undefined });
  const r = resoudre(racine, 'aBc');
  if (r.homonymes.length === 2) {
    assert.equal(r.source, 'code');
    assert.equal(r.ambigu, true);
  }
});

test('G5 — la POSE ne se redirige jamais : resoudreLieu ignore les .nom-agent', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure' });
  const pose = resoudreLieu(racine, DOSSIER, 'bonaventure');
  assert.equal(pose.existe, false, 'créer un lieu « bonaventure » ne doit pas retomber sur le lieu du mandat');
  assert.equal(pose.nom, 'bonaventure');
});

test('un nom hors liste blanche lève, comme resoudreLieu — la garde anti-évasion ne se desserre pas', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure' });
  assert.throws(() => resoudre(racine, '../evil'), /segment de chemin/);
});

// ═══════════════════════════════ la naissance : `naitre <saisie>` — le même geste, côté poste

import { resoudreLaSaisieDeLieu } from '../src/saisie-de-lieu.js';

const saisir = (racine, saisie, role = 'orchestrateur') => resoudreLaSaisieDeLieu({ depot: racine, role, saisie });

test('naissance G1 — un nom de rivière devient le CODE du lieu qui le porte, et la source est dite', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure' });
  const r = saisir(racine, 'bonaventure');
  assert.equal(r.ok, true);
  assert.equal(r.nom, 'j-20260814-0001');
  assert.equal(r.source, 'nom');
  assert.equal(r.saisie, 'bonaventure');
});

test('naissance — un code est rendu TEL QUE TAPÉ (aucune normalisation, aucun changement de comportement)', () => {
  const racine = depot({ 'J-20260814-0001': 'bonaventure' });
  const r = saisir(racine, 'j-20260814-0001');
  assert.equal(r.ok, true);
  assert.equal(r.source, 'code');
  assert.equal(r.nom, 'j-20260814-0001');
});

test('naissance G2 — deux lieux portent le nom : refus qui les nomme, motif ambigu', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure', 'j-20260814-0002': 'bonaventure' });
  const r = saisir(racine, 'bonaventure');
  assert.equal(r.ok, false);
  assert.equal(r.motif, 'ambigu');
  assert.match(r.message, /j-20260814-0001/);
  assert.match(r.message, /j-20260814-0002/);
});

test('naissance G3 — une RIVIÈRE qu’aucun lieu ne porte est refusée, jamais posée comme un code', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure' });
  const r = saisir(racine, 'saguenay');
  assert.equal(r.ok, false, 'sans ce refus, la naissance POSERAIT un lieu nommé « saguenay » : un nom pris pour un code');
  assert.equal(r.motif, 'nom_introuvable');
  assert.match(r.message, /inscrit dans aucun lieu/);
});

test('naissance — un code NEUF (pas une rivière) passe tel quel : c’est le cas de la première pose', () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure' });
  const r = saisir(racine, 'j-20260925-0007');
  assert.equal(r.ok, true);
  assert.equal(r.nom, 'j-20260925-0007');
  assert.equal(r.source, 'code');
});

test('naissance G4 — un lieu illisible + une rivière introuvable : refus qui dit « pas su lire »', {
  skip: process.getuid?.() === 0 ? 'root lit tout : non prouvable ici' : false,
}, () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure' });
  const f = join(racine, DOSSIER, 'j-20260814-0001', '.nom-agent');
  chmodSync(f, 0o000);
  let r;
  try { r = saisir(racine, 'batiscan'); } finally { chmodSync(f, 0o600); }
  assert.equal(r.ok, false);
  assert.match(r.message, /j-20260814-0001/);
  assert.doesNotMatch(r.message, /inscrit dans aucun lieu/);
});

test('naissance — un code neuf n’est PAS refusé parce qu’un AUTRE lieu est illisible', {
  skip: process.getuid?.() === 0 ? 'root lit tout : non prouvable ici' : false,
}, () => {
  const racine = depot({ 'j-20260814-0001': 'bonaventure' });
  const f = join(racine, DOSSIER, 'j-20260814-0001', '.nom-agent');
  chmodSync(f, 0o000);
  let r;
  try { r = saisir(racine, 'j-20260925-0007'); } finally { chmodSync(f, 0o600); }
  assert.equal(r.ok, true, 'un lieu illisible ne bloque pas la naissance d’un code qui n’a rien à voir avec lui');
});

test('naissance — un code est rendu avec SA casse, jamais normalisé (le lieu est posé en majuscules, tapé en majuscules)', () => {
  const racine = depot({ 'J-20260814-0001': 'bonaventure' });
  const r = saisir(racine, 'J-20260814-0001');
  assert.equal(r.nom, 'J-20260814-0001');
  const autre = saisir(racine, 'j-20260814-0001');
  assert.equal(autre.nom, 'j-20260814-0001', 'tel que tapé, même quand le lieu porte une autre casse');
});

test('un lieu qui est un LIEN SYMBOLIQUE reste retrouvé par son code — le code est prioritaire pour lui aussi', () => {
  const racine = depot({});
  const reel = mkdtempSync(join(tmpdir(), 'nom-riviere-reel-'));
  mkdirSync(join(racine, DOSSIER), { recursive: true });
  symlinkSync(reel, join(racine, DOSSIER, 'j-20260814-0001'));
  const r = resoudre(racine, 'j-20260814-0001');
  assert.equal(r.source, 'code', 'refusé « ni code ni nom » serait FAUX : c’est le code d’un lieu');
  assert.equal(r.racine, join(racine, DOSSIER, 'j-20260814-0001'));
  assert.equal(saisir(racine, 'j-20260814-0001').ok, true);
});

test('un rôle que le registre ne baptise pas « rivière » ne traduit RIEN — le code est rendu tel que tapé, rivière ou non', () => {
  const racine = mkdtempSync(join(tmpdir(), 'nom-riviere-rep-'));
  const r = saisir(racine, 'rimouski', 'representant');
  assert.equal(r.ok, true);
  assert.equal(r.source, 'code');
  assert.equal(r.nom, 'rimouski');
});

test('le lien symbolique désigné par son code EXISTE et est EXACT — aussi pour un nom qui est une rivière', () => {
  const racine = depot({});
  const reel = mkdtempSync(join(tmpdir(), 'nom-riviere-reel-'));
  mkdirSync(join(racine, DOSSIER), { recursive: true });
  symlinkSync(reel, join(racine, DOSSIER, 'rimouski'));
  const r = resoudre(racine, 'rimouski');
  assert.equal(r.existe, true);
  assert.equal(r.exact, true, 'sans quoi le CLI dirait « la casse diffère » d’un nom identique');
  assert.equal(saisir(racine, 'rimouski').ok, true, 'la naissance ne refuse pas le code d’un lieu qui existe');
});

test('un lien CASSÉ n’est pas balayé aux noms : le refus « ni code ni nom » serait plus fort que la mesure', () => {
  const racine = depot({});
  mkdirSync(join(racine, DOSSIER), { recursive: true });
  symlinkSync('/nonexistent-cible-cassee', join(racine, DOSSIER, 'j-casse'));
  const r = resoudre(racine, 'j-casse');
  assert.equal(r.source, 'code');
  assert.equal(r.illisibles.length, 0);
});

test('un lieu-lien n’est PAS lu pour son .nom-agent : on ne traverse pas un lien vers l’extérieur', () => {
  const racine = depot({});
  const reel = mkdtempSync(join(tmpdir(), 'nom-riviere-reel-'));
  writeFileSync(join(reel, '.nom-agent'), 'bonaventure\n');
  mkdirSync(join(racine, DOSSIER), { recursive: true });
  symlinkSync(reel, join(racine, DOSSIER, 'j-20260814-0001'));
  const r = resoudre(racine, 'bonaventure');
  assert.equal(r.existe, false, 'lire à travers le lien ferait dépendre le lieu retenu de ce qu’un lien désigne');
});

test('un code à MAJUSCULES tapé tel quel se résout sans jamais être « retrouvé sous une autre casse »', () => {
  const racine = depot({ 'J-Upper': undefined });
  const r = resoudre(racine, 'J-Upper');
  assert.equal(r.exact, true);
  assert.equal(r.demande, 'J-Upper');
});

test('naissance — une RIVIÈRE dont l’entrée est un lien CASSÉ : refus qui le DIT, pas « ni code ni nom »', () => {
  const racine = depot({});
  mkdirSync(join(racine, DOSSIER), { recursive: true });
  symlinkSync('/nonexistent-cible-cassee', join(racine, DOSSIER, 'bonaventure'));
  const r = saisir(racine, 'bonaventure');
  assert.equal(r.ok, false, 'rien n’est posé par-dessus un lien');
  assert.match(r.message, /lien symbolique cassé/);
  assert.doesNotMatch(r.message, /n'est ni le code d'un lieu/);
});

test('naissance — le code d’un lien valide (rivière ou non) est accepté', () => {
  const racine = depot({});
  const reel = mkdtempSync(join(tmpdir(), 'nom-riviere-reel-'));
  mkdirSync(join(racine, DOSSIER), { recursive: true });
  symlinkSync(reel, join(racine, DOSSIER, 'j-20260814-0001'));
  assert.equal(saisir(racine, 'j-20260814-0001').ok, true);
});

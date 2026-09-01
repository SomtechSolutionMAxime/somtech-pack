// naissances-des-sessions.test.js — LA SONDE QUI DATE LES AGENTS, et ses deux moitiés coupables.
//
// Ce que ce banc garde : la sonde rend une DATE quand elle a lu, et son PROPRE MOT quand elle
// n'a pas pu lire. Les deux se ressemblent — « pas de date » — et les confondre réinstalle le
// défaut que tout ce chantier ferme : un juge aveugle qui rend un verdict bien formé.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { lireLesNaissances, RACINE_TRANSCRITS } from '../src/naissances-des-sessions.js';

const paneDe = (valeur, sur = {}) => ({
  agent: true,
  pane_id: 'w1:p1',
  agent_session: valeur === null ? null : { agent: 'claude', kind: 'id', source: 'herdr:claude', value: valeur },
  ...sur,
});

/** Un bac avec de VRAIS répertoires de projet et de VRAIS transcrits. */
function bacAvec(projets) {
  const racine = mkdtempSync(join(tmpdir(), 'naissances-'));
  for (const [projet, sessions] of Object.entries(projets)) {
    mkdirSync(join(racine, projet), { recursive: true });
    for (const s of sessions) writeFileSync(join(racine, projet, `${s}.jsonl`), '{}\n');
  }
  return racine;
}

test('elle date une session par son transcrit — la vraie chaîne, sur de vrais fichiers', () => {
  const racine = bacAvec({ '-un-projet': ['aaa-111'] });
  try {
    const n = lireLesNaissances([paneDe('aaa-111')], { racine });
    assert.equal(n.mesure, 'lue');
    assert.ok(Math.abs(n.instants.get('aaa-111') - Date.now()) < 60_000);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

/**
 * 🔴 LE POINT DE CE MODULE, ET IL EST MESURÉ. L'encodage du chemin de travail dans le nom du
 * répertoire de projet A CHANGÉ de version de Claude Code — sur ce poste, côte à côte :
 * `-Users-…-GitRepo.nosync-constructiongauthier` (le point survit) et
 * `-Users-…-GitRepo-nosync-actionprogex` (il est remplacé). Une règle devinée retrouvait 90 des
 * 94 agents d'une session ; le balayage par identifiant, 94 sur 94.
 */
test('🔴 ELLE CHERCHE PAR IDENTIFIANT, PAS PAR UN NOM DE RÉPERTOIRE DEVINÉ', () => {
  const racine = bacAvec({
    '-un-chemin-encode-a-lancienne': ['aaa-111'],
    '-un.chemin.encode.autrement': ['bbb-222'],
    'un nom que personne ne devinerait': ['ccc-333'],
  });
  try {
    const n = lireLesNaissances([paneDe('aaa-111'), paneDe('bbb-222'), paneDe('ccc-333')], { racine });
    assert.equal(n.instants.size, 3, 'une session a échappé à la sonde à cause du NOM de son répertoire');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('une session sans transcrit ne reçoit AUCUNE date — elle n’en reçoit pas une fausse', () => {
  const racine = bacAvec({ '-un-projet': ['aaa-111'] });
  try {
    const n = lireLesNaissances([paneDe('bbb-222')], { racine });
    assert.equal(n.mesure, 'lue');
    assert.equal(n.instants.has('bbb-222'), false);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 LA SONDE COUPÉE REND SON PROPRE MOT — pas une carte vide qui se lirait « absent »', () => {
  const n = lireLesNaissances([paneDe('aaa-111')], {
    racine: '/un/chemin/qui/nexiste/pas',
    lister: () => {
      throw new Error('ENOENT');
    },
  });
  assert.equal(n.mesure, 'refusée');
  assert.match(n.raison, /ENOENT/);
});

test('la moitié « de quand date ce fichier » se coupe SÉPARÉMENT — et elle ne date personne à tort', () => {
  const racine = bacAvec({ '-un-projet': ['aaa-111'] });
  try {
    const n = lireLesNaissances([paneDe('aaa-111')], {
      racine,
      dater: () => {
        throw new Error('permission refusée');
      },
    });
    assert.equal(n.mesure, 'lue');
    assert.equal(n.instants.has('aaa-111'), false, 'une date a été rendue par une sonde qui a échoué');
    assert.equal(n.illisibles, 1, 'l’échec de lecture ne se compte nulle part');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

/**
 * ⚠️ UN `birthtime` DE ZÉRO N'EST PAS LE 1er JANVIER 1970. C'est un système de fichiers qui ne
 * tient pas la date de création. Le traduire en instant ferait naître l'agent à l'aube des
 * temps — c'est-à-dire AVANT toute frontière imaginable, donc hors portée, donc VERT. Le
 * silence de la source doit tomber du côté bruyant.
 */
test('🔴 UNE DATE DE CRÉATION DE ZÉRO N’EST PAS UNE DATE — sinon l’agent naît avant toute frontière', () => {
  const racine = bacAvec({ '-un-projet': ['aaa-111'] });
  try {
    const n = lireLesNaissances([paneDe('aaa-111')], { racine, dater: () => 0 });
    assert.equal(n.instants.has('aaa-111'), false);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('un répertoire de projet FERMÉ est compté — il peut porter le transcrit qu’on cherche', () => {
  const racine = bacAvec({ '-ferme': [], '-ouvert': ['aaa-111'] });
  try {
    const n = lireLesNaissances([paneDe('aaa-111'), paneDe('bbb-222')], {
      racine,
      lister: (d) => {
        if (d.endsWith('-ferme')) throw new Error('EACCES');
        return readdirSync(d);
      },
    });
    assert.equal(n.illisibles, 1);
    assert.equal(n.instants.has('aaa-111'), true, 'un répertoire fermé a fait tomber les autres');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('un pane sans identifiant de session n’est pas cherché — et n’est pas daté', () => {
  const racine = bacAvec({ '-un-projet': ['aaa-111'] });
  try {
    const n = lireLesNaissances([paneDe(null)], { racine });
    assert.equal(n.mesure, 'lue');
    assert.equal(n.instants.size, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('rien à chercher n’est PAS un refus — c’est une mesure faite dont le résultat est vide', () => {
  const n = lireLesNaissances([], {
    lister: () => {
      throw new Error('on n’aurait pas dû ouvrir la source');
    },
  });
  assert.equal(n.mesure, 'lue');
  assert.equal(n.instants.size, 0);
});

test('la racine est celle de Claude Code, pas une valeur d’essai — et aucun `process.env` ne la déplace', () => {
  assert.match(RACINE_TRANSCRITS, /\.claude\/projects$/);
  const source = readFileSync(new URL('../src/naissances-des-sessions.js', import.meta.url), 'utf8');
  // ⚠️ HORS COMMENTAIRES, ET C'EST NÉCESSAIRE : l'en-tête du module EXPLIQUE pourquoi il n'y a
  // pas de `process.env`. Une assertion qui cherche le mot rougirait sur la phrase qui dit
  // qu'on ne le fait pas — « chercher un mot et conclure sur la fonction ».
  const code = source
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  // ⚠️ APPARIÉE À SON POSITIF CI-DESSUS : sans lui, supprimer la ligne rendrait celle-ci verte.
  assert.equal(
    /process\.env/.test(code),
    false,
    'un `process.env` dans le CODE d’une garde est un interrupteur de désarmement qu’on actionne sans diff'
  );
});

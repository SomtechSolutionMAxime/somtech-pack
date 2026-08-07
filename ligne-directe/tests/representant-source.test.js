// La SOURCE du lieu, et ce qui arrive quand elle manque (T-20260807-0067).
//
// CE QUE LES TESTS PRÉCÉDENTS ONT LAISSÉ PASSER, ET POURQUOI — à lire avant d'en ajouter.
//
// `representant-lieu.test.js` couvre le refus de joignabilité et l'idempotence, mais chacun
// de ses dépôts jetables reçoit les gabarits du pack AVANT l'appel (`cpSync`, sa fonction
// `depotClientJetable`). Aucun n'a donc jamais exercé un dépôt qui ne les a PAS. Et son test
// « lieu PARTIEL » construisait le lieu amputé À LA MAIN, puis n'interrogeait que `etatLieu` —
// jamais `preparerLieuRepresentant`. Le double était plus indulgent que la réalité : dans la
// réalité, le lieu partiel n'était pas un cas de laboratoire, il était le RÉSIDU d'un échec que
// personne ne provoquait en test.
//
// Ce que ça a coûté, mesuré sur un dépôt réel avant ce lot : `copyFileSync` levait un `ENOENT`
// brut APRÈS que `mkdirSync` ait créé `.gestionnaire/<client>/` ; le répertoire vide restait ;
// et la relance suivante le lisait comme un lieu posé — `{"ok":true,"deja_installe":true,
// "presents":[],"manquants":[…les quatre]}`. Un représentant ouvert là n'aurait eu ni métier,
// ni outils, ni permissions bornées, et rien ne l'aurait signalé.
//
// D'où la règle suivie ici : ces tests PROVOQUENT l'échec — un dépôt réellement dépourvu de
// gabarits — puis constatent l'état du DISQUE. Jamais un lieu partiel fabriqué à la main pour
// la commodité du test, jamais le texte d'un message pris pour la preuve d'un refus.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  preparerLieuRepresentant, etatSource, etatLieu, retirerCeQuiAEteCommence, GABARITS,
} from '../src/representant.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const GABARIT_SOURCE = join(REPO, '.claude', 'templates', 'gestionnaire-client');
const LIGNE_DIRECTE = resolve(HERE, '..', 'bin', 'ligne-directe.js');

/** Un dépôt client jetable qui n'a JAMAIS reçu le pack — l'échec authentique de ce lot. */
function depotSansGabarits() {
  return mkdtempSync(join(tmpdir(), 'ld-sans-gabarits-'));
}

/** Un dépôt client jetable qui a reçu les gabarits, comme `pack init` les dépose. */
function depotClientJetable() {
  const racine = mkdtempSync(join(tmpdir(), 'ld-source-'));
  cpSync(GABARIT_SOURCE, join(racine, '.claude', 'templates', 'gestionnaire-client'), { recursive: true });
  return racine;
}

const JOIGNABLE = async () => ({ joignable: true, canal: 'client-x', id: 'C1' });
const NE_DOIT_JAMAIS_ETRE_APPELEE = async () => {
  throw new Error('le canal a été vérifié alors que la source manquait — un aller-retour réseau pour un refus local');
};

// ═══════════════════════════════ 1. la source absente — REFUS AVANT LA PREMIÈRE ÉCRITURE

test('échec authentique : un dépôt sans gabarits n’obtient RIEN sur le disque', async () => {
  const depot = depotSansGabarits();

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.equal(r.ok, false);
  assert.equal(
    existsSync(join(depot, '.gestionnaire')), false,
    'le dossier .gestionnaire ne doit pas même exister — c’est très exactement ce qui restait avant ce lot'
  );
});

test('la source manquante est constatée AVANT l’aller-retour vers Slack', async () => {
  // Un refus qui ne dépend que du disque local ne doit rien coûter au réseau. La preuve n'est
  // pas dans le résultat : elle est dans le fait que ce test SURVIT — la vérification lèverait.
  const depot = depotSansGabarits();

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: NE_DOIT_JAMAIS_ETRE_APPELEE,
  });

  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'gabarits_absents');
});

test('le refus nomme ce qui manque, et où — pas une erreur brute de copie de fichier', async () => {
  const depot = depotSansGabarits();

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.deepEqual(r.refus.manquants, [...GABARITS], 'les quatre gabarits manquent, et le refus le dit');
  assert.ok(!/ENOENT|copyfile/i.test(r.refus.message), 'le motif doit être lisible, jamais le message d’erreur de Node');
  assert.match(r.refus.message, /pack/, 'et il doit dire ce que ce dépôt n’a pas reçu');
});

test('une source AMPUTÉE D’UN SEUL fichier refuse aussi — pas seulement une source entièrement absente', async () => {
  // Le motif « une porte sur deux » : un répertoire de gabarits présent mais incomplet passait
  // la seule vérification d'existence du répertoire, puis échouait sur le fichier manquant.
  for (const absent of GABARITS) {
    const depot = depotClientJetable();
    rmSync(join(depot, '.claude', 'templates', 'gestionnaire-client', absent));

    const r = await preparerLieuRepresentant({
      depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
    });

    assert.equal(r.ok, false, `source privée de ${absent} : doit refuser`);
    assert.deepEqual(r.refus.manquants, [absent]);
    assert.equal(existsSync(join(depot, '.gestionnaire')), false, `source privée de ${absent} : rien ne doit naître`);
  }
});

test('etatSource lit la source telle qu’elle est — complète ou non', () => {
  const complet = depotClientJetable();
  assert.equal(etatSource(complet).complete, true);
  assert.deepEqual(etatSource(complet).manquants, []);

  const vide = depotSansGabarits();
  assert.equal(etatSource(vide).complete, false);
  assert.deepEqual(etatSource(vide).manquants, [...GABARITS]);
});

// ═══════════════════════════════ 2. l'idempotence ne porte QUE sur un lieu complet

test('un lieu amputé d’UN SEUL fichier est refusé — jamais déclaré déjà installé', async () => {
  for (const absent of GABARITS) {
    const depot = depotClientJetable();
    const premiere = await preparerLieuRepresentant({
      depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
    });
    assert.equal(premiere.cree, true);

    const racine = join(depot, '.gestionnaire', 'client-x');
    rmSync(join(racine, absent));

    const seconde = await preparerLieuRepresentant({
      depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
    });

    assert.equal(seconde.ok, false, `lieu privé de ${absent} : ne peut pas être un succès`);
    assert.notEqual(seconde.deja_installe, true, `lieu privé de ${absent} : « déjà installé » serait un mensonge`);
    assert.equal(seconde.refus.motif, 'lieu_partiel');
    assert.deepEqual(seconde.refus.manquants, [absent]);
  }
});

test('le lieu partiel refusé n’est pas complété non plus — ce qu’un humain y avait mis reste intact', async () => {
  const depot = depotClientJetable();
  await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  const racine = join(depot, '.gestionnaire', 'client-x');
  writeFileSync(join(racine, 'CONTEXTE.md'), 'trace humaine\n');
  rmSync(join(racine, 'CLAUDE.md'));

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.equal(r.ok, false);
  assert.equal(existsSync(join(racine, 'CLAUDE.md')), false, 'refuser n’est pas compléter');
  assert.equal(readFileSync(join(racine, 'CONTEXTE.md'), 'utf8'), 'trace humaine\n', 'ni écraser');
});

test('un lieu vide — le résidu exact de l’échec d’avant ce lot — est refusé', async () => {
  const depot = depotClientJetable();
  mkdirSync(join(depot, '.gestionnaire', 'client-x'), { recursive: true });

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.equal(r.ok, false, 'presents:[] et deja_installe:true ne peuvent pas coexister');
  assert.notEqual(r.deja_installe, true);
});

test('etatLieu dit si le lieu est COMPLET — la seule lecture sur laquelle l’idempotence a le droit de reposer', async () => {
  const depot = depotClientJetable();
  mkdirSync(join(depot, '.gestionnaire', 'vide'), { recursive: true });
  assert.equal(etatLieu(depot, 'vide').existe, true);
  assert.equal(etatLieu(depot, 'vide').complet, false, 'un répertoire vide existe sans être un lieu');

  await preparerLieuRepresentant({
    depotClient: depot, client: 'plein', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });
  assert.equal(etatLieu(depot, 'plein').complet, true);
});

// ═══════════════════════════════ 3. une écriture interrompue ne laisse pas de résidu

test('écriture interrompue en plein milieu : le lieu à demi posé est retiré, pas laissé', async () => {
  // Échec provoqué, pas simulé : un gabarit qui est un RÉPERTOIRE passe la vérification de
  // présence (il existe) et fait échouer `copyFileSync` (EISDIR) — au deuxième fichier, donc
  // après que le premier a déjà été écrit. C'est l'interruption au milieu d'une pose, en vrai.
  const depot = depotClientJetable();
  const source = join(depot, '.claude', 'templates', 'gestionnaire-client');
  rmSync(join(source, 'CONTEXTE.md'));
  mkdirSync(join(source, 'CONTEXTE.md'));

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.equal(r.ok, false);
  assert.equal(
    existsSync(join(depot, '.gestionnaire')), false,
    'une pose qui échoue ne laisse rien — sinon la relance suivante lirait ce résidu comme un lieu'
  );
});

test('le retrait après échec ne touche pas au lieu d’un AUTRE client', async () => {
  const depot = depotClientJetable();
  await preparerLieuRepresentant({
    depotClient: depot, client: 'voisin', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  const source = join(depot, '.claude', 'templates', 'gestionnaire-client');
  rmSync(join(source, 'CONTEXTE.md'));
  mkdirSync(join(source, 'CONTEXTE.md'));

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.equal(r.ok, false);
  assert.equal(existsSync(join(depot, '.gestionnaire', 'client-x')), false, 'son propre résidu part');
  assert.equal(existsSync(join(depot, '.gestionnaire', 'voisin', 'CLAUDE.md')), true, 'celui du voisin reste');
});

// Le retrait est éprouvé SÉPARÉMENT du chemin qui l'appelle, et c'est délibéré : le cas qui
// compte — un voisin apparu PENDANT la pose, posé par un autre processus — ne se construit pas
// depuis le dehors sans truquer l'horloge. Interroger le retrait lui-même sur les deux états du
// disque qu'il peut rencontrer prouve le FAIT ; le test « écriture interrompue » ci-dessus
// prouve, lui, que le chemin d'échec l'appelle bel et bien. Ni l'un ni l'autre ne suffit seul.

test('le retrait emporte `.gestionnaire/` quand il ne reste que le lieu de ce client', () => {
  const depot = depotSansGabarits();
  mkdirSync(join(depot, '.gestionnaire', 'client-x'), { recursive: true });
  writeFileSync(join(depot, '.gestionnaire', 'client-x', 'CLAUDE.md'), 'a demi pose\n');

  retirerCeQuiAEteCommence(depot, 'client-x');

  assert.equal(existsSync(join(depot, '.gestionnaire')), false, 'rien ne doit subsister');
});

test('le retrait épargne un voisin apparu ENTRE-TEMPS — jamais d’après ce qui existait au départ', () => {
  // La course que la revue a nommée : deux poses lancées ensemble sur un dépôt où
  // `.gestionnaire/` n'existe encore pour personne. Toutes deux liraient « il n'existait pas ».
  // Celle qui échoue ne doit PAS pouvoir emporter le lieu que l'autre vient de réussir.
  const depot = depotSansGabarits();
  mkdirSync(join(depot, '.gestionnaire', 'client-x'), { recursive: true });
  mkdirSync(join(depot, '.gestionnaire', 'voisin'), { recursive: true });
  writeFileSync(join(depot, '.gestionnaire', 'voisin', 'CLAUDE.md'), 'pose pendant ce temps-la\n');

  retirerCeQuiAEteCommence(depot, 'client-x');

  assert.equal(existsSync(join(depot, '.gestionnaire', 'client-x')), false, 'son propre reste part');
  assert.equal(
    readFileSync(join(depot, '.gestionnaire', 'voisin', 'CLAUDE.md'), 'utf8'), 'pose pendant ce temps-la\n',
    'et le voisin, qui n’a rien demandé, reste entier'
  );
});

test('le retrait ne se plaint pas quand il n’y a rien à retirer', () => {
  const depot = depotSansGabarits();
  assert.doesNotThrow(() => retirerCeQuiAEteCommence(depot, 'jamais-pose'));
});

// ═══════════════════════════════ 4. le CODE DE SORTIE — lu, jamais supposé

/** Lance la vraie commande, dans un vrai dépôt, et rend ce que le shell aurait vu. */
function lancerCommande(depot, client = 'client-x') {
  return spawnSync(process.execPath, [LIGNE_DIRECTE, 'representant', client, '--canal', 'client-x', '--depot', depot], {
    encoding: 'utf8',
  });
}

test('code de sortie : dépôt sans gabarits — non nul, sur le MOTIF de la source, et rien sur le disque', () => {
  // Le motif est asserté, pas seulement le code : sans lui, ce test passerait pour la mauvaise
  // raison — en CI, sans jeton Slack, TOUT échoue et rend déjà un code non nul. Exiger
  // `gabarits_absents` prouve que le refus vient bien du disque local, et qu'il est prononcé
  // sans jamais toucher au trousseau ni au réseau.
  const depot = depotSansGabarits();

  const r = lancerCommande(depot);

  assert.notEqual(r.status, 0, `la compétence promet 1 si elle a refusé — elle a rendu ${r.status}`);
  assert.match(r.stdout, /"motif":"gabarits_absents"/, 'et le refus doit venir de la source, pas d’un aléa réseau');
  assert.equal(existsSync(join(depot, '.gestionnaire')), false);
});

test('code de sortie : lieu partiel — non nul, alors qu’il valait 0 avant ce lot', () => {
  const depot = depotClientJetable();
  mkdirSync(join(depot, '.gestionnaire', 'client-x'), { recursive: true });

  const r = lancerCommande(depot);

  assert.notEqual(r.status, 0, 'un répertoire vide rendait 0 et « deja_installe: true » — la panne exacte du ticket');
  assert.match(r.stdout, /"motif":"lieu_partiel"/);
  assert.ok(!/"deja_installe":true/.test(r.stdout), '« déjà installé » sur un lieu vide est le mensonge à supprimer');
});

test('la sortie d’un refus reste lisible : le motif atteint stderr, jamais l’erreur brute de Node', () => {
  const depot = depotSansGabarits();

  const r = lancerCommande(depot);

  assert.ok(r.stderr.trim().length > 0, 'un refus doit dire pourquoi');
  assert.ok(!/ENOENT|copyfile/i.test(r.stderr), 'c’est très exactement ce que ce dépôt affichait avant ce lot');
  assert.ok(!/at .*\.js:\d+/.test(r.stderr), 'et personne ne lit la troisième ligne d’une trace de pile');
});

// La POSE d'un lieu, face au nom qu'on lui donne (T-20260814-0101).
//
// Deux garanties, et la pose n'avait NI l'une NI l'autre avant ce lot :
//
//   1. UN NOM QUI TRAVERSE UN RÉPERTOIRE NE POSE RIEN. `join(depot, dossier, '../../evil')`
//      écrivait hors du dépôt du client, sans qu'aucune garde ne s'y oppose. Le refus du slug
//      n'existait que côté mise à jour — « une porte sur deux », par la porte qui ÉCRIT.
//   2. UN LIEU DÉJÀ POSÉ EST RETROUVÉ MALGRÉ LA CASSE. Reposer `francois` là où `Francois`
//      existe doit dire « déjà installé », pas creuser un second lieu à côté.
//
// Comme partout dans cette suite : un refus se prouve par l'ABSENCE de ce qu'il empêche,
// jamais par le texte du message. Et ce qui ne se prouve que sur un volume SENSIBLE à la
// casse se déclare non prouvé ici plutôt que de passer en supposant (la CI Linux l'exécute).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, existsSync, readdirSync, rmSync, cpSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparerLieuRepresentant } from '../src/representant.js';
import { GABARITS } from '../src/lieu-agent.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const GABARIT_SOURCE = join(REPO, '.claude', 'templates', 'gestionnaire-client');

function depotClientJetable() {
  const racine = mkdtempSync(join(tmpdir(), 'ld-pose-nom-'));
  cpSync(GABARIT_SOURCE, join(racine, '.claude', 'templates', 'gestionnaire-client'), { recursive: true });
  return racine;
}

const JOIGNABLE = async () => ({ joignable: true, canal: 'client-x', id: 'C1' });
const NE_DOIT_JAMAIS_ETRE_APPELEE = async () => {
  throw new Error('la ligne a été vérifiée alors que le nom aurait dû être refusé avant tout accès réseau');
};

/** Mesuré, jamais supposé d'après la plateforme (cf. `lieu-nom.test.js`). */
function fsSensibleALaCasse() {
  const racine = mkdtempSync(join(tmpdir(), 'ld-casse-'));
  try {
    mkdirSync(join(racine, 'Sonde'));
    return !existsSync(join(racine, 'sonde'));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}
const SENSIBLE = fsSensibleALaCasse();
const SAUT_INSENSIBLE = 'volume insensible à la casse : le second dossier ne peut pas y exister — non prouvable ici, la CI Linux l’exécute';

// ═══════════════════════════════ 1. l'évasion de chemin, du côté qui ÉCRIT

test('nom qui traverse un répertoire : RIEN n’est posé, ni dans le dépôt ni au-dessus', async () => {
  for (const nom of ['../evil', '../../evil', '..', 'a/b', 'a\\b', '', '.']) {
    const depot = depotClientJetable();
    const r = await preparerLieuRepresentant({
      depotClient: depot, client: nom, canal: 'client-x', verifierJoignabilite: NE_DOIT_JAMAIS_ETRE_APPELEE,
    });

    assert.equal(r.ok, false, `« ${nom} » doit être refusé`);
    assert.equal(r.refus.motif, 'nom_invalide');
    // Le disque, pas le message : rien sous le dépôt, et rien au-dessus non plus.
    assert.equal(existsSync(join(depot, '.gestionnaire')), false, 'le dossier de rôle ne doit pas même exister');
    assert.equal(existsSync(join(depot, '..', 'evil')), false, 'rien ne doit avoir été écrit hors du dépôt');
    assert.equal(existsSync(join(depot, '..', '..', 'evil')), false, 'rien ne doit avoir été écrit deux crans plus haut');
  }
});

test('le nom est jugé AVANT la ligne — un refus local ne coûte aucun aller-retour réseau', async () => {
  // `NE_DOIT_JAMAIS_ETRE_APPELEE` lève : si la garde du nom passait après celle de la ligne,
  // le test ci-dessus aurait échoué sur l'exception plutôt que sur le refus. On le nomme ici
  // pour que la raison ne se perde pas — c'est la même règle que pour la garde de la source.
  const depot = depotClientJetable();
  const r = await preparerLieuRepresentant({
    depotClient: depot, client: '../evil', canal: 'client-x', verifierJoignabilite: NE_DOIT_JAMAIS_ETRE_APPELEE,
  });
  assert.equal(r.refus.motif, 'nom_invalide', 'un motif « verification_impossible » signalerait que la ligne a été appelée quand même');
});

test('mutation : sans la garde du nom, l’évasion écrit bel et bien hors du dépôt', () => {
  // Témoin — ce test n'éprouve pas notre code, il éprouve le danger que notre code empêche.
  // Sans lui, le test de refus ci-dessus pourrait être décoratif.
  const depot = depotClientJetable();
  const evade = join(depot, '.gestionnaire', '..', '..', 'evil'); // l'ancien `join(depot, dossier, nom)`
  mkdirSync(evade, { recursive: true });
  assert.equal(existsSync(resolve(depot, '..', 'evil')), true, 'témoin : sans garde, un nom qui traverse écrit hors du dépôt du client');
  rmSync(resolve(depot, '..', 'evil'), { recursive: true, force: true });
});

// ═══════════════════════════════ 2. la casse : un lieu posé est retrouvé, jamais doublé

test('un lieu posé en « Francois » est reconnu comme DÉJÀ INSTALLÉ quand on repose « francois »', async () => {
  const depot = depotClientJetable();

  const pose = await preparerLieuRepresentant({
    depotClient: depot, client: 'Francois', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });
  assert.equal(pose.ok, true);
  assert.equal(pose.cree, true);

  // `NE_DOIT_JAMAIS_ETRE_APPELEE` : la garde d'idempotence doit mordre AVANT tout réseau. Si
  // la résolution manquait le lieu existant, on tomberait sur l'exception — donc ce test
  // distingue bien le code de ce que macOS pardonne : sur macOS, une composition brute de
  // chemin trouverait le dossier, mais `etatLieu` le trouverait aussi, et rien ne rougirait.
  // C'est pourquoi on vérifie EN PLUS la racine rendue, juste dessous.
  const reprise = await preparerLieuRepresentant({
    depotClient: depot, client: 'francois', canal: 'client-x', verifierJoignabilite: NE_DOIT_JAMAIS_ETRE_APPELEE,
  });

  assert.equal(reprise.ok, true);
  assert.equal(reprise.deja_installe, true, 'un lieu déjà posé ne se repose pas — quelle que soit la casse tapée');
  assert.equal(reprise.cree, false);
  assert.equal(
    reprise.racine, join(depot, '.gestionnaire', 'Francois'),
    'la racine rendue doit porter le nom RÉEL du dossier — une composition brute rendrait « francois », et rougirait ici même sur macOS',
  );
});

test('aucun SECOND lieu n’est créé quand la casse diffère', { skip: SENSIBLE ? false : SAUT_INSENSIBLE }, async () => {
  const depot = depotClientJetable();

  await preparerLieuRepresentant({
    depotClient: depot, client: 'Francois', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });
  await preparerLieuRepresentant({
    depotClient: depot, client: 'francois', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.deepEqual(
    readdirSync(join(depot, '.gestionnaire')).sort(),
    ['Francois'],
    'un second lieu, vide et muet, serait né à côté du vrai — c’est exactement ce que macOS masquait',
  );
});

test('deux lieux homonymes déjà là : la pose REFUSE plutôt que d’en creuser un troisième', { skip: SENSIBLE ? false : SAUT_INSENSIBLE }, async () => {
  const depot = depotClientJetable();
  mkdirSync(join(depot, '.gestionnaire', 'Francois'), { recursive: true });
  mkdirSync(join(depot, '.gestionnaire', 'francois'), { recursive: true });

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'FRANCOIS', canal: 'client-x', verifierJoignabilite: NE_DOIT_JAMAIS_ETRE_APPELEE,
  });

  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'lieu_ambigu');
  assert.deepEqual(
    readdirSync(join(depot, '.gestionnaire')).sort(), ['Francois', 'francois'],
    'aucun troisième lieu ne doit être né du doute',
  );
});

// ═══════════════════════════════ 3. la casse tapée est PORTÉE — la pose ne normalise pas

test('la pose ne normalise pas : « Charles-Olivier » pose « Charles-Olivier », pas « charles-olivier »', async () => {
  const depot = depotClientJetable();

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'Charles-Olivier', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.equal(r.ok, true);
  assert.deepEqual(
    readdirSync(join(depot, '.gestionnaire')), ['Charles-Olivier'],
    'normaliser aurait cassé les quatre lieux déjà posés chez des clients — la casse tapée fait foi',
  );
  // Et le lieu est un VRAI lieu, pas un dossier au bon nom : les quatre gabarits y sont.
  for (const f of GABARITS) {
    assert.equal(
      readFileSync(join(depot, '.gestionnaire', 'Charles-Olivier', f), 'utf8'),
      readFileSync(join(GABARIT_SOURCE, f), 'utf8'),
      `${f} doit être identique au gabarit du pack`,
    );
  }
});

test('un lieu PARTIEL homonyme est nommé comme tel — jamais complété en douce', async () => {
  // Croisement des deux gardes : la résolution trouve le lieu malgré la casse, et
  // l'idempotence refuse quand même parce qu'il est incomplet. Deux gardes empilées, aucune
  // ne doit avaler l'autre.
  const depot = depotClientJetable();
  mkdirSync(join(depot, '.gestionnaire', 'Zach'), { recursive: true });
  writeFileSync(join(depot, '.gestionnaire', 'Zach', 'CLAUDE.md'), '# incomplet\n');

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'zach', canal: 'client-x', verifierJoignabilite: NE_DOIT_JAMAIS_ETRE_APPELEE,
  });

  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'lieu_partiel');
  assert.equal(r.refus.racine, join(depot, '.gestionnaire', 'Zach'), 'le refus doit désigner le lieu RÉEL, celui qu’un humain va aller voir');
});

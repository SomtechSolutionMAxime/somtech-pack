// declaration.test.js — LA DÉCLARATION DE NAISSANCE : un fait horodaté, hors dépôt, et un
// nom rendu au ServiceDesk. (D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE BANC ÉPROUVE, ET POURQUOI IL N'ÉPROUVE PAS AUTRE CHOSE
//
// Une déclaration est une ÉCRITURE PILOTÉE PAR UNE DONNÉE D'ENTRÉE : le nom de l'agent
// compose le nom du fichier. C'est le motif exact qui a coûté à `lieu-nom.js` — « ../../evil »
// écrivait hors du dépôt tant qu'aucune garde ne se posait des DEUX côtés. Ce banc éprouve
// donc la garde autant que le chemin heureux, et il exige qu'un refus n'ait RIEN semé.
//
// ⚠️ AUCUN ESSAI N'ÉCRIT DANS `~/.somtech`, ET AUCUN NE PARLE AU SERVICEDESK. La racine est
// passée à chaque appel vers un répertoire jetable ; le transport est INJECTÉ. La cloison
// d'essais de `ligne-directe/src/cloison.js` existe parce qu'un `npm test` a déjà fait partir
// de vrais POST vers la production avec la vraie clé du poste — on ne la contourne pas, on
// n'a simplement jamais besoin d'elle ici.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync, chmodSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  inscrireLaDeclaration,
  lireLesDeclarations,
  declarerAuServiceDesk,
  phraseDuMandatIncomplet,
  RACINE,
  ChampManquant,
  DeclarationDejaInscrite,
  RegistreDeNaissancesIllisible,
} from '../src/declaration.js';
import { NomDeLieuInvalide } from '../../ligne-directe/src/lieu-nom.js';

function racineJetable() {
  return mkdtempSync(join(tmpdir(), 'smtk-naissances-'));
}

/** Le jeu de champs complet — les essais n'en retirent qu'un à la fois, pour nommer le trou. */
function unePersonne(extra = {}) {
  return {
    nom: 'matapedia',
    role: 'orchestrateur',
    mandat: 'D-20260825-0002',
    coordonnateur: 'maxime',
    espace: 'somtech-pack',
    pane: '%42',
    session: 'herdr-1',
    ...extra,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — INSCRIRE : LE FAIT EST ÉCRIT, ET IL EST COMPLET
// ═══════════════════════════════════════════════════════════════════════════════════════

test('une inscription écrit UN fichier nommé par l’horodatage puis le nom, et rend son chemin', () => {
  const racine = racineJetable();
  try {
    const quand = new Date('2026-08-25T12:45:00.123Z');
    const { chemin, declaration } = inscrireLaDeclaration({ ...unePersonne(), racine, quand });

    assert.deepEqual(readdirSync(racine), ['20260825T124500123Z-matapedia.json'], 'un fichier, et aucun voisin provisoire laissé derrière');
    assert.equal(chemin, join(racine, '20260825T124500123Z-matapedia.json'));
    assert.deepEqual(JSON.parse(readFileSync(chemin, 'utf8')), declaration, 'ce qui est rendu EST ce qui est écrit');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('la déclaration écrite porte les dix champs du contrat, avec `ne_le` en ISO et `pose_par` renseigné', () => {
  const racine = racineJetable();
  try {
    const quand = new Date('2026-08-25T12:45:00.123Z');
    const { declaration } = inscrireLaDeclaration({ ...unePersonne(), racine, quand });
    assert.deepEqual(declaration, {
      version: 1,
      nom: 'matapedia',
      role: 'orchestrateur',
      mandat: 'D-20260825-0002',
      coordonnateur: 'maxime',
      espace: 'somtech-pack',
      pane: '%42',
      session_herdr: 'herdr-1',
      ne_le: '2026-08-25T12:45:00.123Z',
      pose_par: 'pack agent naitre',
    });
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('le répertoire ABSENT est créé — une naissance ne se refuse pas parce que personne n’est né avant', () => {
  const parent = racineJetable();
  const racine = join(parent, 'jamais', 'cree');
  try {
    const { chemin } = inscrireLaDeclaration({ ...unePersonne(), racine });
    assert.ok(statSync(chemin).isFile());
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('le fichier est en 0600 — une déclaration nomme les chantiers en cours du poste', () => {
  const racine = racineJetable();
  try {
    const { chemin } = inscrireLaDeclaration({ ...unePersonne(), racine });
    assert.equal(statSync(chemin).mode & 0o777, 0o600);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — INSCRIRE : CE QUI EST REFUSÉ, ET QUI LE DIT
// ═══════════════════════════════════════════════════════════════════════════════════════

for (const champ of ['nom', 'role', 'mandat', 'espace']) {
  test(`un « ${champ} » manquant est refusé, et le refus NOMME le champ qui manque`, () => {
    const racine = racineJetable();
    try {
      const entree = unePersonne({ racine });
      delete entree[champ];
      assert.throws(
        () => inscrireLaDeclaration(entree),
        (err) => {
          assert.ok(err instanceof ChampManquant, `attendu ChampManquant, reçu ${err?.name}`);
          assert.equal(err.champ, champ, 'le champ manquant est porté par l’erreur, pas seulement dans sa phrase');
          assert.match(err.message, new RegExp(champ), 'le message dit LEQUEL manque — sans quoi il faut deviner');
          return true;
        }
      );
      assert.deepEqual(readdirSync(racine), [], 'un refus n’écrit RIEN — pas même un voisin provisoire');
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
}

test('un champ obligatoire présent mais VIDE vaut manquant — une chaîne blanche n’est pas un rôle', () => {
  const racine = racineJetable();
  try {
    assert.throws(() => inscrireLaDeclaration(unePersonne({ role: '   ', racine })), ChampManquant);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

for (const [cas, nom] of [
  ['une traversée de répertoire', '../evil'],
  ['un séparateur de chemin', 'a/b'],
  ['une remontée seule', '..'],
  ['un octet nul', 'mata\u0000pedia'],
  ['une espace au milieu', 'mata pedia'],
  ['un point en tête', '.cache'],
  ['un nom qui n’est pas une chaîne', 42],
]) {
  test(`un nom malsain (${cas}) est refusé AVANT toute écriture`, () => {
    const racine = racineJetable();
    try {
      assert.throws(
        () => inscrireLaDeclaration(unePersonne({ nom, racine })),
        (err) => {
          // ⚠️ ON EXIGE LA GARDE DU DÉPÔT, PAS UNE LISTE NOIRE MAISON. `lieu-nom.js` a déjà payé
          // ce motif : une garde qui cherche des tournures interdites se défait en ajoutant une
          // tournure. La liste blanche est le seul jugement, et elle est partagée — le jour où
          // elle bouge, elle bouge pour tout le monde d'un coup.
          assert.ok(err instanceof NomDeLieuInvalide, `attendu NomDeLieuInvalide, reçu ${err?.name}`);
          return true;
        }
      );
      assert.deepEqual(readdirSync(racine), [], 'rien n’a été écrit, ni dans la racine ni à côté');
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
}

test('un nom VIDE est un champ manquant, pas un nom malsain — et c’est le bon refus des deux', () => {
  // ⚠️ MESURÉ, PAS SUPPOSÉ. L'attente première de ce banc était `NomDeLieuInvalide` ; le code
  // rend `ChampManquant`, et il a raison : une chaîne blanche n'est pas un nom risqué, c'est un
  // nom ABSENT. Le refus qui nomme le champ manquant est celui qui met l'appelant sur la bonne
  // piste. C'est l'attente qui a été corrigée, pas le code.
  const racine = racineJetable();
  try {
    assert.throws(
      () => inscrireLaDeclaration(unePersonne({ nom: '', racine })),
      (err) => {
        assert.ok(err instanceof ChampManquant, `attendu ChampManquant, reçu ${err?.name}`);
        assert.equal(err.champ, 'nom');
        return true;
      }
    );
    assert.deepEqual(readdirSync(racine), []);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('un nom malsain n’écrit RIEN HORS de la racine non plus — c’est le défaut que la garde ferme', () => {
  const parent = racineJetable();
  const racine = join(parent, 'dedans');
  mkdirSync(racine, { recursive: true });
  try {
    // ⚠️ CETTE ASSERTION A ÉTÉ RENFORCÉE APRÈS L'AVOIR VUE PASSER SANS LA GARDE. Un
    // `assert.throws` nu était vert sur le corps sans garde : le chemin composé pointait un
    // répertoire inexistant, et c'est `ENOENT` qui levait. Un essai vert pour la mauvaise
    // raison SURVIT à la garde qu'il prétend éprouver — il faut donc nommer l'erreur attendue.
    assert.throws(
      () => inscrireLaDeclaration(unePersonne({ nom: '../dehors', racine })),
      (err) => {
        assert.ok(err instanceof NomDeLieuInvalide, `attendu NomDeLieuInvalide, reçu ${err?.name} (${err?.code ?? ''})`);
        return true;
      }
    );
    assert.deepEqual(readdirSync(parent), ['dedans'], 'aucun fichier n’a été semé dans le parent');
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('un fichier cible DÉJÀ PRÉSENT est une erreur nommée, jamais un écrasement silencieux', () => {
  const racine = racineJetable();
  try {
    const quand = new Date('2026-08-25T12:45:00.123Z');
    const { chemin } = inscrireLaDeclaration({ ...unePersonne(), racine, quand });
    const avant = readFileSync(chemin, 'utf8');

    assert.throws(
      () => inscrireLaDeclaration({ ...unePersonne({ role: 'representant' }), racine, quand }),
      (err) => {
        assert.ok(err instanceof DeclarationDejaInscrite, `attendu DeclarationDejaInscrite, reçu ${err?.name}`);
        assert.equal(err.chemin, chemin, 'le refus dit QUEL fichier était déjà là');
        return true;
      }
    );
    assert.equal(readFileSync(chemin, 'utf8'), avant, 'le fait déjà inscrit est intact — un fait ne se réécrit pas');
    assert.deepEqual(readdirSync(racine), ['20260825T124500123Z-matapedia.json'], 'et le refus n’a pas laissé de provisoire');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('deux naissances DANS LA MÊME MILLISECONDE coexistent — l’horodatage ne les distingue pas, le nom si', () => {
  const racine = racineJetable();
  try {
    const quand = new Date('2026-08-25T12:45:00.123Z');
    const a = inscrireLaDeclaration({ ...unePersonne({ nom: 'matapedia' }), racine, quand });
    const b = inscrireLaDeclaration({ ...unePersonne({ nom: 'ristigouche' }), racine, quand });
    assert.notEqual(a.chemin, b.chemin);
    assert.equal(readdirSync(racine).length, 2, 'deux faits, deux fichiers — aucun n’a mangé l’autre');

    // ⚠️ LE TRI DOIT RESTER DÉTERMINISTE À HORODATAGE ÉGAL. Sans départage, l'ordre rendu
    // dépendrait de l'ordre du système de fichiers : le même parc se lirait autrement d'une
    // machine à l'autre, et c'est le motif « vert chez l'auteur, rouge en CI » déjà payé ici.
    // ⚠️ ON EXIGE L'ORDRE EXACT, PAS L'ENSEMBLE — ASSERTION RENFORCÉE APRÈS UNE SURVIVANTE.
    // La première version comparait deux lectures entre elles et triait l'ensemble : elle
    // survivait au retrait du départage, parce que deux lectures d'un même processus rendent
    // évidemment la même chose. Ce que le départage protège, c'est l'écart entre l'ordre du
    // SYSTÈME DE FICHIERS (alphabétique ascendant, mesuré ici) et l'ordre voulu — donc c'est
    // cet écart qu'il faut nommer.
    const un = lireLesDeclarations({ racine }).declarations.map((d) => d.nom);
    const deux = lireLesDeclarations({ racine }).declarations.map((d) => d.nom);
    assert.deepEqual(un, deux, 'deux lectures rendent le même ordre');
    assert.deepEqual(un, ['ristigouche', 'matapedia'], 'à horodatage égal, le départage tranche — et il ne suit PAS le répertoire');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('l’écriture passe par un VOISIN puis un renommage — la forme atomique, gardée sur la source', () => {
  // ⚠️ CETTE GARDE EST STRUCTURELLE, ET ELLE L'EST FAUTE DE MIEUX — on le dit plutôt que de
  // laisser croire à une mesure. L'atomicité ne se prouve qu'en interrompant le processus EN
  // PLEIN `write`, ce qu'aucun essai ne sait provoquer d'ici. Ce qu'on peut garder, c'est la
  // FORME : un `writeFileSync` qui viserait directement le chemin cible laisserait, sur un
  // processus tué en vol, une déclaration TRONQUÉE — qu'un lecteur compterait comme un fait.
  const source = readFileSync(fileURLToPath(new URL('../src/declaration.js', import.meta.url)), 'utf8');
  const code = source
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l.trim()))
    .join('\n');
  assert.ok(/renommer\(\s*provisoire\s*,\s*chemin\s*\)/.test(code), 'le renommage du voisin vers la cible doit être là');
  assert.ok(
    !/writeFileSync\(\s*chemin\b/.test(code),
    'aucune écriture ne vise directement le chemin cible — elle passerait à côté du renommage'
  );
});

test('quand l’écriture échoue, ni la cible ni le voisin provisoire ne subsistent', (t) => {
  const racine = racineJetable();
  try {
    chmodSync(racine, 0o500);
    try {
      writeFileSync(join(racine, 'sonde'), 'x');
      t.skip('ce compte écrit dans un répertoire en 0500 — la panne ne peut pas être provoquée ici');
      return;
    } catch {
      /* le répertoire est bien devenu inscriptible-non */
    }
    // ⚠️ L'ÉCHEC REMONTE, IL NE SE TAIT PAS. Un `catch` qui avalerait ici ferait rendre une
    // naissance « inscrite » dont aucun fichier n'existe : le pire des deux mondes.
    assert.throws(() => inscrireLaDeclaration({ ...unePersonne(), racine }));
    chmodSync(racine, 0o700);
    assert.deepEqual(readdirSync(racine), [], 'aucun résidu — ni déclaration tronquée, ni voisin abandonné');
  } finally {
    try {
      chmodSync(racine, 0o700);
    } catch {
      /* rien à rouvrir */
    }
    rmSync(racine, { recursive: true, force: true });
  }
});

test('un RENOMMAGE raté emporte le voisin provisoire avec lui — le répertoire reste propre', () => {
  // ⚠️ CE CAS N'ÉTAIT ATTEIGNABLE PAR AUCUN AUTRE CHEMIN, ET LA MUTATION L'A PROUVÉ : retirer
  // le nettoyage laissait la suite verte. Un répertoire en lecture seule fait échouer
  // l'écriture AVANT que le voisin existe — il n'y a alors jamais rien à nettoyer. On
  // substitue donc UN SEUL POINT NOMMÉ, le renommage, pour reproduire la CAUSE (il échoue
  // alors que le voisin est bien là) ; tout le reste de la chaîne est le vrai code.
  const racine = racineJetable();
  try {
    const echec = new Error('EXDEV: cross-device link not permitted');
    assert.throws(() => inscrireLaDeclaration({ ...unePersonne(), racine, renommer: () => { throw echec; } }), (err) => {
      assert.equal(err, echec, 'l’échec du renommage remonte tel quel — il ne se déguise pas en succès');
      return true;
    });
    assert.deepEqual(readdirSync(racine), [], 'aucun voisin abandonné : ni fait tronqué, ni déchet qui s’accumule');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — LIRE : TROIS ÉTATS, JAMAIS DEUX
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un répertoire ABSENT rend un parc vide — c’est le cas normal d’un poste neuf, pas une erreur', () => {
  const parent = racineJetable();
  try {
    assert.deepEqual(lireLesDeclarations({ racine: join(parent, 'jamais-cree') }), {
      declarations: [],
      illisibles: [],
    });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('les déclarations sont rendues du PLUS RÉCENT au plus ancien', () => {
  const racine = racineJetable();
  try {
    for (const [nom, iso] of [
      ['matapedia', '2026-08-25T08:00:00.000Z'],
      ['ristigouche', '2026-08-25T12:00:00.000Z'],
      ['bonaventure', '2026-08-24T23:59:59.999Z'],
    ]) {
      inscrireLaDeclaration({ ...unePersonne({ nom }), racine, quand: new Date(iso) });
    }
    const { declarations, illisibles } = lireLesDeclarations({ racine });
    assert.deepEqual(declarations.map((d) => d.nom), ['ristigouche', 'matapedia', 'bonaventure']);
    assert.deepEqual(illisibles, []);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('un JSON cassé au milieu de fichiers valides est mis À PART — il ne fait PAS tomber la lecture', () => {
  const racine = racineJetable();
  try {
    inscrireLaDeclaration({ ...unePersonne({ nom: 'matapedia' }), racine, quand: new Date('2026-08-25T08:00:00.000Z') });
    inscrireLaDeclaration({ ...unePersonne({ nom: 'ristigouche' }), racine, quand: new Date('2026-08-25T09:00:00.000Z') });
    writeFileSync(join(racine, '20260825T100000000Z-casse.json'), '{ ceci n’est pas du JSON');

    const { declarations, illisibles } = lireLesDeclarations({ racine });
    assert.deepEqual(declarations.map((d) => d.nom), ['ristigouche', 'matapedia'], 'les valides survivent, et dans l’ordre');
    assert.equal(illisibles.length, 1);
    assert.equal(illisibles[0].fichier, '20260825T100000000Z-casse.json');
    assert.ok(
      typeof illisibles[0].cause === 'string' && illisibles[0].cause.length > 0,
      'l’illisible DIT pourquoi — sans cause, personne n’ira le réparer'
    );
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('un JSON valide mais qui n’est PAS un objet compte comme illisible — un tableau n’est pas une déclaration', () => {
  const racine = racineJetable();
  try {
    writeFileSync(join(racine, '20260825T100000000Z-tableau.json'), '[1,2,3]');
    const { declarations, illisibles } = lireLesDeclarations({ racine });
    assert.deepEqual(declarations, [], 'un tableau qui se glisserait dans les déclarations ferait planter tout lecteur');
    assert.equal(illisibles.length, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('un voisin provisoire abandonné (.tmp) n’est ni une déclaration ni un illisible', () => {
  const racine = racineJetable();
  try {
    inscrireLaDeclaration({ ...unePersonne(), racine, quand: new Date('2026-08-25T08:00:00.000Z') });
    writeFileSync(join(racine, '20260825T100000000Z-x.json.somtech-1234.tmp'), 'moitié écrit');
    const { declarations, illisibles } = lireLesDeclarations({ racine });
    assert.equal(declarations.length, 1);
    assert.deepEqual(illisibles, [], 'signaler un provisoire comme illisible ferait chercher un défaut qui n’existe pas');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('un répertoire PRÉSENT mais impossible à lire LÈVE — « je n’ai pas pu regarder » n’est pas « il n’y a personne »', (t) => {
  const racine = racineJetable();
  try {
    inscrireLaDeclaration({ ...unePersonne(), racine });
    chmodSync(racine, 0o000);
    try {
      readdirSync(racine);
      // Sous un compte qui ignore les permissions (root), la mutation ne mord pas : la mesure
      // est MANQUÉE, et un essai qui ne peut pas échouer ne conclut rien. On le DIT plutôt que
      // de rendre un vert qui n'a rien éprouvé.
      t.skip('ce compte lit un répertoire en 0000 — la panne ne peut pas être provoquée ici');
      return;
    } catch {
      /* c'est le cas voulu : le répertoire est bien devenu illisible */
    }
    assert.throws(
      () => lireLesDeclarations({ racine }),
      (err) => {
        assert.ok(
          err instanceof RegistreDeNaissancesIllisible,
          `attendu RegistreDeNaissancesIllisible, reçu ${err?.name}`
        );
        assert.equal(err.racine, racine, 'le refus dit QUELLE racine n’a pas pu être lue');
        return true;
      }
    );
  } finally {
    try {
      chmodSync(racine, 0o700);
    } catch {
      /* rien à rendre lisible */
    }
    rmSync(racine, { recursive: true, force: true });
  }
});

test('un FICHIER illisible parmi des valides est mis à part, sans faire tomber la lecture', (t) => {
  const racine = racineJetable();
  try {
    inscrireLaDeclaration({ ...unePersonne({ nom: 'matapedia' }), racine, quand: new Date('2026-08-25T08:00:00.000Z') });
    const mure = join(racine, '20260825T100000000Z-mure.json');
    writeFileSync(mure, '{"version":1,"nom":"mure"}');
    chmodSync(mure, 0o000);
    try {
      readFileSync(mure, 'utf8');
      t.skip('ce compte lit un fichier en 0000 — la panne ne peut pas être provoquée ici');
      return;
    } catch {
      /* le fichier est bien devenu illisible */
    }
    const { declarations, illisibles } = lireLesDeclarations({ racine });
    assert.deepEqual(declarations.map((d) => d.nom), ['matapedia']);
    assert.equal(illisibles.length, 1);
    assert.equal(illisibles[0].fichier, '20260825T100000000Z-mure.json');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 — LA RACINE PAR DÉFAUT, ET SA SURCHARGE
// ═══════════════════════════════════════════════════════════════════════════════════════

test('sans surcharge, la racine par défaut est ~/.somtech/naissances', () => {
  assert.equal(RACINE, join(homedir(), '.somtech', 'naissances'));
});

test('SOMTECH_NAISSANCES_RACINE déplace la racine — mesuré dans un processus neuf, la constante étant lue au chargement', () => {
  // ⚠️ ON NE PEUT PAS L'ÉPROUVER EN CHANGEANT `process.env` ICI : le module est déjà chargé, et
  // la constante a déjà été calculée. Un essai qui muterait l'environnement après coup
  // mesurerait sa propre idée du mécanisme, pas le mécanisme.
  const module = fileURLToPath(new URL('../src/declaration.js', import.meta.url));
  const ailleurs = join(tmpdir(), 'smtk-racine-surchargee');
  const sortie = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `import { RACINE } from ${JSON.stringify(module)}; process.stdout.write(RACINE);`],
    { env: { ...process.env, SOMTECH_NAISSANCES_RACINE: ailleurs }, encoding: 'utf8' }
  );
  assert.equal(sortie, ailleurs);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 — DÉCLARER AU SERVICEDESK : TOUT ÉCHEC SE DIT DANS LA VALEUR, JAMAIS EN JETANT
// ═══════════════════════════════════════════════════════════════════════════════════════

const UUID = '3f2b7c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

/** Un ServiceDesk de papier : il note ce qu'on lui demande et rend ce qu'on lui a dit de rendre. */
function unFauxDesk({
  get = { ticket: { id: UUID, ticket_id: 'T-20260825-0001', status: 'in_progress' } },
  update = { ticket: { id: UUID, ticket_id: 'T-20260825-0001', assigned_agent: 'matapedia' } },
} = {}) {
  const appels = [];
  const appelerMcp = async (outil, args) => {
    appels.push({ outil, args });
    const reponse = args?.action === 'get' ? get : update;
    if (reponse instanceof Error) throw reponse;
    return reponse;
  };
  return { appelerMcp, appels };
}

test('un mandat qui est un TICKET : on lit son UUID par le code, puis on remplit `assigned_agent` par l’UUID', async () => {
  const { appelerMcp, appels } = unFauxDesk();
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });

  assert.equal(r.rempli, true, `attendu rempli, reçu ${JSON.stringify(r)}`);
  assert.equal(r.id, UUID);
  assert.deepEqual(appels.map((a) => [a.outil, a.args.action]), [['tickets', 'get'], ['tickets', 'update']]);
  assert.equal(appels[0].args.id, 'T-20260825-0001', '`get` accepte le code lisible — c’est par là qu’on obtient l’UUID');
  // ⚠️ LE DÉFAUT QUE CETTE ASSERTION FERME : `update` exige un UUID STRICT et REJETTE un code
  // « T-… ». Lui passer le code ferait rendre un refus qu'on rangerait en « pas d'accès », et le
  // ticket resterait sans agent sans que personne ne sache pourquoi.
  assert.equal(appels[1].args.id, UUID, '`update` reçoit l’UUID, JAMAIS le code');
  assert.equal(appels[1].args.assigned_agent, 'matapedia');
});

test('le code du mandat est porté en MAJUSCULES au ServiceDesk, quelle que soit la casse du lieu', async () => {
  const { appelerMcp, appels } = unFauxDesk();
  await declarerAuServiceDesk({ mandat: 't-20260825-0001', nom: 'matapedia', appelerMcp });
  assert.equal(appels[0].args.id, 'T-20260825-0001', 'le ServiceDesk écrit ses codes en majuscules — le dossier, pas forcément');
});

test('sans accès au ServiceDesk (`appelerMcp` null), on rend un refus qui se dit — jamais une exception, jamais un état inventé', async () => {
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp: null });
  assert.deepEqual(r, { rempli: false, cause: 'aucun accès au ServiceDesk' });
});

test('un transport qui JETTE ne fait pas tomber la naissance — la cause remonte dans la valeur', async () => {
  const { appelerMcp } = unFauxDesk({ get: new Error('HTTP 401') });
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });
  assert.equal(r.rempli, false);
  assert.match(r.cause, /HTTP 401/);
});

test('un refus HTTP sur la MISE À JOUR (le `get` ayant réussi) se dit aussi — et ne se lit pas « rempli »', async () => {
  const { appelerMcp } = unFauxDesk({ update: new Error('HTTP 403') });
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });
  assert.equal(r.rempli, false, 'un `get` réussi ne rend pas la déclaration faite');
  assert.match(r.cause, /HTTP 403/);
});

test('un `get` qui ne rend AUCUN UUID se dit, plutôt que d’envoyer le code à `update` en espérant', async () => {
  const { appelerMcp, appels } = unFauxDesk({ get: { ticket: { ticket_id: 'T-20260825-0001', status: 'new' } } });
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });
  assert.equal(r.rempli, false);
  assert.match(r.cause, /T-20260825-0001/, 'la cause nomme le mandat qu’on n’a pas su résoudre');
  assert.equal(appels.length, 1, 'on n’a PAS tenté la mise à jour — c’est ce qui empêche le refus muet');
});

test('un `get` dont l’`id` n’est PAS un UUID est refusé — un code déguisé en identifiant ferait rejeter `update`', async () => {
  const { appelerMcp, appels } = unFauxDesk({ get: { ticket: { id: 'T-20260825-0001', status: 'new' } } });
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });
  assert.equal(r.rempli, false);
  assert.equal(appels.length, 1);
});


for (const [mandat, famille] of [
  ['D-20260825-0002', 'demands'],
  ['P-20260822-0001', 'projects'],
  ['J-20260801-0003', 'deliveries'],
]) {
  test(`un mandat d’une AUTRE famille (« ${mandat} ») ne remplit rien, et la cause nomme la famille`, async () => {
    const { appelerMcp, appels } = unFauxDesk();
    const r = await declarerAuServiceDesk({ mandat, nom: 'matapedia', appelerMcp });
    assert.equal(r.rempli, false);
    assert.match(r.cause, new RegExp(famille), 'la cause dit CE QUE c’est, pas seulement que ça a échoué');
    assert.deepEqual(appels, []);
  });
}

for (const mandat of ['matapedia', 'general', '', null, undefined]) {
  test(`un mandat qui n’est PAS un code de chantier (« ${mandat} ») se dit comme tel — pas comme une famille inconnue`, async () => {
    // ⚠️ ASSERTION RENFORCÉE APRÈS UNE SURVIVANTE. Sans ce cas distinct, retirer la garde
    // « pas un code » laissait la suite verte : le refus tombait dans la branche SUIVANTE et
    // rendait « désigne un null, pas un ticket » — une phrase qui a l'air d'un diagnostic et
    // n'en est pas. Un refus juste dans le fond et faux dans les mots ne répare rien.
    const { appelerMcp, appels } = unFauxDesk();
    const r = await declarerAuServiceDesk({ mandat, nom: 'matapedia', appelerMcp });
    assert.equal(r.rempli, false);
    assert.match(r.cause, /n’est pas un code de chantier/, `cause inattendue : « ${r.cause} »`);
    assert.doesNotMatch(r.cause, /null|undefined/, 'aucune valeur interne ne fuit dans la phrase rendue');
    assert.deepEqual(appels, []);
  });
}

test('un `nom` manquant ne remplit rien — écrire un `assigned_agent` vide effacerait celui d’un autre', async () => {
  const { appelerMcp, appels } = unFauxDesk();
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: '  ', appelerMcp });
  assert.equal(r.rempli, false);
  assert.deepEqual(appels, [], 'on n’a même pas lu le ticket — il n’y avait rien à y écrire');
});

test('sans clé au poste et sans transport fourni, le défaut est le transport PARTAGÉ de `mandat.js` — qui rend `null`, donc un refus qui se dit', async () => {
  // ⚠️ LE TRANSPORT N'EST PAS RECOPIÉ ICI, ET C'EST LE POINT. `transportServiceDesk` porte la
  // CLOISON D'ESSAIS ; un second transport écrit à côté l'aurait dupliquée, et une cloison
  // dupliquée est une cloison qu'on oublie d'un côté — le motif « une porte sur deux » a déjà
  // coûté à ce module. Cet essai mesure qu'on retombe bien dessus, dans un processus neuf dont
  // on a retiré la clé.
  const module = fileURLToPath(new URL('../src/declaration.js', import.meta.url));
  const env = { ...process.env };
  delete env.SOMTECH_DESK_API_KEY;
  delete env.SERVICEDESK_MCP_TOKEN;
  const sortie = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { declarerAuServiceDesk } from ${JSON.stringify(module)};
       const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia' });
       process.stdout.write(JSON.stringify(r));`,
    ],
    { env, encoding: 'utf8' }
  );
  assert.deepEqual(JSON.parse(sortie), { rempli: false, cause: 'aucun accès au ServiceDesk' });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 bis — UN MANDAT QUI EST UN EPIC : TOUTES SES STORIES, ET LE PLURIEL SE REND
//
// ⚠️ CE BLOC FERME LE CAS CANONIQUE, PAS UN CAS LIMITE. Un chef d'équipe mène un EPIC —
// c'est la forme NORMALE d'un agent ouvert par l'outillage. Le module refusait alors de
// remplir quoi que ce soit (« je ne choisis pas une story à sa place »), ce qui laissait
// `assigned_agent` vide sur le chemin le plus fréquenté : EF-AGT-006 tenue sur les tickets
// directs, muette sur les epics. Or les tickets du mandat d'un chef d'équipe, ce sont LES
// STORIES DE SON EPIC — toutes. Les remplir n'est pas choisir, c'est remplir le mandat.
// ═══════════════════════════════════════════════════════════════════════════════════════

const EPIC_UUID = 'a1b2c3d4-1111-4222-8333-444455556666';
const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Des stories telles que le ServiceDesk RÉEL les rend sous un epic — mesuré le 2026-08-25. */
function desStories(...codes) {
  return codes.map((code, i) => ({
    id: `d4c892fa-cc6a-4416-bac9-330f54c1462${i}`,
    ticket_id: code,
    status: 'new',
    epic_id: EPIC_UUID,
  }));
}

/**
 * Un ServiceDesk de papier qui connaît les EPICS.
 *
 * ⚠️ SON DÉFAUT REPRODUIT LA MESURE, PAS UNE HYPOTHÈSE. Le 2026-08-25, `epics` action `get`
 * avec un CODE lisible rend « Epic not found » — mesuré contre le service réel, et le schéma
 * de l'outil le confirme (`id` y est documenté « UUID de l'epic », là où `tickets get`
 * documente explicitement qu'il accepte le code). Un double qui répondrait au code serait un
 * double NON CONFORME : il ferait passer un module incapable de trouver le moindre epic réel.
 */
function unFauxDeskEpic({
  getParCode = new Error('Epic not found'),
  liste = [{ id: EPIC_UUID, epic_id: 'E-20260825-0002', status: 'draft' }],
  stories = desStories('T-20260825-0011'),
  epicParUuid,
  refus = {},
} = {}) {
  const appels = [];
  const corpsEpic = epicParUuid ?? { epic: { id: EPIC_UUID, epic_id: 'E-20260825-0002', stories } };
  const appelerMcp = async (outil, args) => {
    appels.push({ outil, args });
    if (outil === 'epics' && args?.action === 'get') {
      if (!FORME_UUID.test(String(args.id))) {
        if (getParCode instanceof Error) throw getParCode;
        return getParCode;
      }
      if (corpsEpic instanceof Error) throw corpsEpic;
      return corpsEpic;
    }
    if (outil === 'epics' && args?.action === 'list') {
      if (liste instanceof Error) throw liste;
      return { epics: liste.slice(0, args.limit) };
    }
    if (outil === 'tickets' && args?.action === 'update') {
      const story = stories.find((s) => s.id === args.id);
      const err = refus[story?.ticket_id];
      if (err) throw err;
      return { ticket: { id: args.id, assigned_agent: args.assigned_agent } };
    }
    throw new Error(`appel inattendu : ${outil}/${args?.action}`);
  };
  return { appelerMcp, appels };
}

/** Les mises à jour parties, dans l'ordre — `[uuid, nom]`. */
const misesAJour = (appels) =>
  appels.filter((a) => a.outil === 'tickets' && a.args.action === 'update').map((a) => [a.args.id, a.args.assigned_agent]);

test('un mandat qui est un EPIC à UNE story : elle reçoit le nom, et le rendu la NOMME', async () => {
  const { appelerMcp, appels } = unFauxDeskEpic();
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  assert.equal(r.rempli, true, `attendu rempli, reçu ${JSON.stringify(r)}`);
  assert.equal(r.epic, 'E-20260825-0002');
  assert.equal(r.total, 1, 'combien de stories l’epic PORTAIT — un compte nu ne dit pas sur combien');
  assert.deepEqual(r.remplies, ['T-20260825-0011'], 'nommées par leur code, pas comptées');
  assert.deepEqual(r.refusees, []);
  assert.deepEqual(misesAJour(appels), [['d4c892fa-cc6a-4416-bac9-330f54c14620', 'e-20260825-0002']]);
});

test('un EPIC à TROIS stories : les TROIS sont remplies, chacune par son UUID', async () => {
  const stories = desStories('T-20260825-0011', 'T-20260825-0012', 'T-20260825-0013');
  const { appelerMcp, appels } = unFauxDeskEpic({ stories });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  assert.equal(r.rempli, true, `attendu rempli, reçu ${JSON.stringify(r)}`);
  assert.equal(r.total, 3);
  assert.deepEqual(r.remplies, ['T-20260825-0011', 'T-20260825-0012', 'T-20260825-0013']);
  assert.deepEqual(
    misesAJour(appels),
    stories.map((s) => [s.id, 'e-20260825-0002']),
    'chaque story est mise à jour par SON UUID — `update` rejette un code'
  );
});

test('un EPIC SANS AUCUNE story n’est pas une panne : c’est un epic pas encore découpé, et ça se DIT', async () => {
  const { appelerMcp, appels } = unFauxDeskEpic({ stories: [] });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  assert.equal(r.rempli, false, 'rien n’a été rempli — le dire « rempli » serait faux');
  assert.equal(r.total, 0, '0 = MESURÉ à zéro, jamais « pas mesuré »');
  assert.match(r.cause, /pas de panne|n’est pas une panne|pas encore découpé/i, `cause inattendue : « ${r.cause} »`);
  assert.match(r.cause, /E-20260825-0002/);
  assert.deepEqual(misesAJour(appels), [], 'aucune mise à jour : il n’y avait rien dessous');
});

test('un EPIC qu’on ne trouve NULLE PART se dit — et `total` reste `null`, jamais 0', async () => {
  const { appelerMcp, appels } = unFauxDeskEpic({ liste: [{ id: EPIC_UUID, epic_id: 'E-20260101-0001' }] });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  assert.equal(r.rempli, false);
  // ⚠️ TROIS ÉTATS, JAMAIS DEUX — la discipline de `lireLesDeclarations`, un module plus haut.
  // `total: 0` dit « je les ai comptées, il n’y en a aucune » ; `total: null` dit « je n’ai pas
  // pu compter ». Les confondre ferait lire « cet epic n’a pas de story » à un epic introuvable.
  assert.equal(r.total, null, 'un epic qu’on n’a pas lu n’a pas « zéro » story : il n’en a AUCUNE de mesurée');
  assert.match(r.cause, /E-20260825-0002/, 'la cause nomme le mandat');
  assert.match(r.cause, /1 epics? lus?/, 'et elle dit sur quoi on a cherché');
  assert.deepEqual(misesAJour(appels), []);
});

test('une story qui REFUSE au milieu des autres ne perd pas les réussies — et elle est NOMMÉE avec sa cause', async () => {
  const stories = desStories('T-20260825-0011', 'T-20260825-0012', 'T-20260825-0013');
  const { appelerMcp, appels } = unFauxDeskEpic({ stories, refus: { 'T-20260825-0012': new Error('HTTP 403') } });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  // 🔴 UN SUCCÈS PARTIEL N'EST PAS UN SUCCÈS — et il ne se perd pas non plus dans une exception.
  assert.equal(r.rempli, false, '2 sur 3 ne se rend pas « rempli »');
  assert.equal(r.total, 3);
  assert.deepEqual(r.remplies, ['T-20260825-0011', 'T-20260825-0013'], 'les deux réussies survivent au refus de la troisième');
  assert.deepEqual(r.refusees, [{ code: 'T-20260825-0012', cause: 'HTTP 403' }], 'LAQUELLE a refusé, et POURQUOI');
  assert.match(r.cause, /T-20260825-0012/, 'la phrase rendue nomme la refusée — un compte nu enverrait chercher partout');
  assert.match(r.cause, /2\D{0,40}3/, 'et elle porte le compte AVEC son dénominateur');
  assert.equal(misesAJour(appels).length, 3, 'les trois ont bien été TENTÉES — une refusée n’interrompt pas la suite');
});

test('un transport qui JETTE partout ne fait pas tomber la naissance d’un chef d’équipe', async () => {
  const { appelerMcp } = unFauxDeskEpic({ getParCode: new Error('HTTP 500'), liste: new Error('HTTP 500') });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });
  assert.equal(r.rempli, false);
  assert.equal(r.total, null);
  assert.match(r.cause, /HTTP 500/, 'la cause du transport remonte telle quelle');
});

test('sans accès au ServiceDesk, un mandat EPIC rend le même refus qu’un ticket — et n’invente rien', async () => {
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp: null });
  assert.equal(r.rempli, false);
  assert.equal(r.cause, 'aucun accès au ServiceDesk');
});

test('`epics get` par CODE n’est PAS servi : on retombe sur la liste, puis on lit l’epic par son UUID', async () => {
  const { appelerMcp, appels } = unFauxDeskEpic();
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  assert.equal(r.rempli, true, `attendu rempli, reçu ${JSON.stringify(r)}`);
  // ⚠️ MESURÉ LE 2026-08-25 CONTRE LE SERVICE RÉEL : `epics get` avec « E-… » rend « Epic not
  // found ». Un module qui s’arrêterait au premier `get` ne trouverait JAMAIS un epic réel —
  // et le brief de ce lot affirmait pourtant que le code y était accepté.
  assert.deepEqual(appels.map((a) => [a.outil, a.args.action]), [
    ['epics', 'get'],
    ['epics', 'list'],
    ['epics', 'get'],
    ['tickets', 'update'],
  ]);
  assert.equal(appels[0].args.id, 'E-20260825-0002', 'le premier `get` tente le CODE — direct le jour où le service le sert');
  assert.equal(appels[2].args.id, EPIC_UUID, 'le second `get` part par l’UUID trouvé dans la liste');
  assert.equal(FORME_UUID.test(String(appels[3].args.id)), true, '`update` ne reçoit QUE des UUID');
});

test('si `epics get` par CODE se met à répondre, on s’en contente — et on ne liste RIEN', async () => {
  // La liste jette : si le module y touchait, ce banc rougirait. C'est ce qui prouve que le
  // chemin direct est bien pris quand le service le sert.
  const { appelerMcp, appels } = unFauxDeskEpic({
    getParCode: { epic: { id: EPIC_UUID, epic_id: 'E-20260825-0002', stories: desStories('T-20260825-0011') } },
    liste: new Error('la liste ne devait pas être appelée'),
  });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  assert.equal(r.rempli, true, `attendu rempli, reçu ${JSON.stringify(r)}`);
  assert.deepEqual(appels.map((a) => [a.outil, a.args.action]), [['epics', 'get'], ['tickets', 'update']]);
});

test('un epic dont le ServiceDesk ne rend AUCUNE liste de stories ne se lit pas « aucune story »', async () => {
  // ⚠️ « je n'ai pas pu lire ses stories » ≠ « il n'en a aucune ». Le motif est déjà payé dans
  // `vue-du-parc.js` : une liste vide à cet endroit faisait disparaître le travail d'agents
  // entiers, en silence, sans qu'aucune ligne ne dise que la mesure avait manqué.
  const { appelerMcp, appels } = unFauxDeskEpic({ epicParUuid: { epic: { id: EPIC_UUID, epic_id: 'E-20260825-0002' } } });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  assert.equal(r.rempli, false);
  assert.equal(r.total, null, 'pas mesuré — surtout pas 0');
  assert.doesNotMatch(r.cause, /pas encore découpé/, 'ce n’est PAS le cas « epic non découpé » : c’est une mesure manquée');
  assert.deepEqual(misesAJour(appels), []);
});

test('une story sans identifiant exploitable est refusée NOMMÉMENT — les autres sont remplies quand même', async () => {
  const stories = [
    { id: 'T-20260825-0011', ticket_id: 'T-20260825-0011' }, // un code déguisé en `id` — `update` le rejetterait
    ...desStories('T-20260825-0012'),
  ];
  const { appelerMcp, appels } = unFauxDeskEpic({ stories });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  assert.equal(r.rempli, false);
  assert.equal(r.total, 2);
  assert.deepEqual(r.remplies, ['T-20260825-0012']);
  assert.deepEqual(r.refusees.map((x) => x.code), ['T-20260825-0011']);
  assert.equal(misesAJour(appels).length, 1, 'on n’a PAS envoyé le code à `update` en espérant');
});

test('la liste d’epics PLAFONNÉE le dit — sans quoi « introuvable » enverrait chercher au mauvais endroit', async () => {
  const liste = Array.from({ length: 200 }, (_, i) => ({ id: EPIC_UUID, epic_id: `E-20260101-${String(i).padStart(4, '0')}` }));
  const { appelerMcp } = unFauxDeskEpic({ liste });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });

  assert.equal(r.rempli, false);
  assert.match(r.cause, /PLAFONN/i, `cause inattendue : « ${r.cause} »`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5-bis — CE QU'ON N'ÉCRASE PAS (défaut ②)
//
// 🔴 CE QUE LA REVUE A MESURÉ. Un epic à deux stories, `T-1` `completed` et déjà attribuée à
// « bonaventure ». Le module écrivait « matapedia » sur les DEUX et rendait
// `{"rempli":true,"total":2,"remplies":["T-1","T-2"],"refusees":[]}` : le nom d'un autre agent
// effacé sur un travail FINI, et rien dans le rendu qui le dise.
//
// ⚠️ LE MODULE GARDAIT DÉJÀ LE CAS SYMÉTRIQUE, et son motif est écrit noir sur blanc plus haut :
// « écrire un `assigned_agent` vide effacerait celui d'un autre ». Le même risque, sur le chemin
// que ce lot OUVRE, et sur le champ que ce lot élève au rang de SOURCE (RA-VUE-005).
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LA RÈGLE RETENUE, ET POURQUOI ELLE N'EST PAS « NE JAMAIS ÉCRASER »
//
//   • une story TERMINALE n'est jamais touchée — son `assigned_agent` n'est plus une affectation,
//     c'est le REGISTRE DE QUI L'A FAITE. Le nouveau chef n'y travaillera pas ; la réécrire ne
//     lui sert à rien et détruit un fait ;
//   • une story VIVANTE portant le nom d'un autre est REPRISE — c'est le cas légitime que le
//     brief nomme : un chef qui hérite d'un epic dont l'agent est mort doit pouvoir s'y inscrire.
//     Refuser ici rendrait le geste inutilisable là où il sert le plus ;
//   • mais une reprise SE DIT : la story est nommée, avec le nom qu'elle portait.
//
// Et `rempli: true` ne survit ni à une reprise ni à une story sautée : un succès plein annoncé
// sur un nom remplacé est très exactement le rendu que ce défaut produisait.

/** Des stories dont on choisit le statut et le porteur — la forme mesurée, plus ce qu'on éprouve. */
function desStoriesDetaillees(...specs) {
  return specs.map((spec, i) => ({
    id: `d4c892fa-cc6a-4416-bac9-330f54c1462${i}`,
    ticket_id: spec.code,
    status: spec.status ?? 'new',
    epic_id: EPIC_UUID,
    ...('agent' in spec ? { assigned_agent: spec.agent } : {}),
  }));
}

test('🔴 une story TERMINALE n’est PAS touchée — son nom dit qui l’a faite, pas qui la mène', async () => {
  const stories = desStoriesDetaillees(
    { code: 'T-20260825-0011', status: 'completed', agent: 'bonaventure' },
    { code: 'T-20260825-0012', status: 'in_progress' }
  );
  const { appelerMcp, appels } = unFauxDeskEpic({ stories });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'matapedia', appelerMcp });

  assert.deepEqual(
    misesAJour(appels),
    [['d4c892fa-cc6a-4416-bac9-330f54c14621', 'matapedia']],
    'la terminale ne reçoit AUCUN update — c’est le fait, pas seulement le rendu'
  );
  assert.deepEqual(r.remplies, ['T-20260825-0012']);
  assert.deepEqual(r.ignorees.map((x) => x.code), ['T-20260825-0011'], 'nommée par son CODE, jamais comptée');
  assert.match(r.ignorees[0].cause, /completed|terminée|fermée/i, 'et la cause dit POURQUOI');
  assert.equal(r.rempli, false, '🔴 un succès plein annoncé sur une story sautée est le défaut lui-même');
  assert.match(r.cause, /T-20260825-0011/, 'la phrase rendue la nomme');
});

test('🔴 une story VIVANTE portant le nom d’un AUTRE est reprise — mais la reprise est DITE', async () => {
  const stories = desStoriesDetaillees(
    { code: 'T-20260825-0011', status: 'in_progress', agent: 'bonaventure' },
    { code: 'T-20260825-0012', status: 'new', agent: '' }
  );
  const { appelerMcp, appels } = unFauxDeskEpic({ stories });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'matapedia', appelerMcp });

  // LA MOITIÉ QUI PROTÈGE LE CAS LÉGITIME : reprendre un epic dont l’agent est mort reste possible.
  assert.equal(misesAJour(appels).length, 2, 'les deux sont bien écrites — on ne bloque pas la reprise');
  assert.deepEqual(r.reprises, [{ code: 'T-20260825-0011', de: 'bonaventure' }], 'LAQUELLE, et à QUI');
  assert.deepEqual(r.remplies, ['T-20260825-0012'], 'une story sans nom n’est pas une reprise');
  assert.equal(r.rempli, false, '🔴 un nom remplacé n’est pas un succès plein');
  assert.match(r.cause, /T-20260825-0011/);
  assert.match(r.cause, /bonaventure/, 'et le nom qu’on a remplacé — sans lui, on ne peut pas le rendre');
});

test('reprendre son PROPRE nom n’est pas une reprise — une renaissance ne doit pas rendre un faux signal', async () => {
  const stories = desStoriesDetaillees({ code: 'T-20260825-0011', status: 'in_progress', agent: 'matapedia' });
  const { appelerMcp } = unFauxDeskEpic({ stories });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'matapedia', appelerMcp });

  assert.deepEqual(r.reprises, []);
  assert.deepEqual(r.remplies, ['T-20260825-0011']);
  assert.equal(r.rempli, true, 'rien n’a été pris à personne — c’est un succès plein');
});

test('quand la charge des stories ne PORTE PAS `assigned_agent`, on ne conclut pas « libre » — on le NOMME', async () => {
  // ⚠️ CE QUE CE BANC FERME. La forme mesurée du service (`desStories`) ne porte PAS ce champ :
  // on ne peut donc pas dire qu’aucun nom n’a été remplacé. Le taire ferait lire « rien n’a été
  // pris » à une mesure qui n’a jamais eu lieu — le motif « une présence satisfaisante » que ce
  // dépôt a déjà payé. On relève ce qu’on atteint, on nomme ce qu’on n’atteint pas.
  const { appelerMcp } = unFauxDeskEpic({ stories: desStories('T-20260825-0011') });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'matapedia', appelerMcp });

  assert.deepEqual(r.remplies, ['T-20260825-0011']);
  assert.deepEqual(r.reprises, [], 'rien de MESURÉ comme repris');
  assert.ok(Array.isArray(r.non_mesure) && r.non_mesure.length > 0, 'et ce qu’on n’a pas pu voir est DIT');
  assert.match(r.non_mesure.join(' '), /assigned_agent/, 'nommément — pas « une mesure a manqué »');
});

test('un mandat TICKET terminal n’est pas réécrit non plus — la règle ne vaut pas que pour les epics', async () => {
  // ⚠️ LA SYMÉTRIE. Corriger le fan-out et laisser le chemin direct écraser un ticket fini
  // rouvrirait le même défaut par l’autre porte, sur un champ que ce lot élève en SOURCE.
  const { appelerMcp, appels } = unFauxDesk({
    get: { ticket: { id: UUID, ticket_id: 'T-20260825-0001', status: 'completed', assigned_agent: 'bonaventure' } },
  });
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });

  assert.equal(r.rempli, false, 'un ticket fini ne se réattribue pas en silence');
  assert.match(r.cause, /T-20260825-0001/);
  assert.match(r.cause, /completed|terminé|fermé/i, 'et la cause dit POURQUOI');
  assert.deepEqual(appels.map((a) => a.args.action), ['get'], 'aucun `update` n’est parti');
});

test('🔴 la phrase à l’écran ne dit pas « n’a pas reçu le nom » quand un nom a été REMPLACÉ', async () => {
  const stories = desStoriesDetaillees({ code: 'T-20260825-0011', status: 'in_progress', agent: 'bonaventure' });
  const { appelerMcp } = unFauxDeskEpic({ stories });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'matapedia', appelerMcp });

  const dit = phraseDuMandatIncomplet('E-20260825-0002', r);
  assert.doesNotMatch(
    dit,
    /n’a pas reçu le nom/,
    `le nom EST parti — il a même remplacé celui d’un autre. Reçu : « ${dit} »`
  );
  assert.match(dit, /pas été rempli entièrement/);
  assert.match(dit, /bonaventure/, 'et la phrase porte la cause, qui nomme la story et son ancien porteur');
});

test('mais quand RIEN n’a été écrit, elle le dit toujours — la moitié qui protège l’autre cas', async () => {
  const { appelerMcp } = unFauxDeskEpic({ stories: [] });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'matapedia', appelerMcp });
  assert.match(phraseDuMandatIncomplet('E-20260825-0002', r), /n’a pas reçu le nom de son agent/);
});

test('la CASSE ne fait perdre ni l’epic ni ses stories — RA-AGT-004 : on compare sans elle', async () => {
  // ⚠️ LE PIÈGE EST RÉEL DANS CE LOT : le code s'écrit « E-20260825-0002 » et le nom de l'agent
  // « e-20260825-0002 ». Un mandat lu depuis un nom de dossier arrive en minuscules ; le
  // ServiceDesk, lui, écrit ses codes en majuscules.
  const { appelerMcp, appels } = unFauxDeskEpic({ liste: [{ id: EPIC_UUID, epic_id: 'e-20260825-0002' }] });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'e-20260825-0002', appelerMcp });
  assert.equal(r.rempli, true, `un epic_id en minuscules doit rester trouvable — reçu ${JSON.stringify(r)}`);

  const bas = unFauxDeskEpic();
  const r2 = await declarerAuServiceDesk({ mandat: 'e-20260825-0002', nom: 'e-20260825-0002', appelerMcp: bas.appelerMcp });
  assert.equal(r2.rempli, true, `un mandat en minuscules désigne le même epic — reçu ${JSON.stringify(r2)}`);
  assert.equal(bas.appels[0].args.id, 'E-20260825-0002', 'le code part en MAJUSCULES, comme le ServiceDesk l’écrit');
  assert.equal(r2.epic, 'E-20260825-0002');
  assert.equal(appels.length > 0, true);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 — LA REPRISE SUR LE CHEMIN TICKET DIRECT — la moitié VIVANTE, que rien ne gardait
//
// 🔴 DEUX MUTATIONS SURVIVAIENT À LA SUITE ENTIÈRE (738/738 verts) :
//   • `if (porteDeja && porteDeja !== nom) {` → `if (false && …) {`
//   • `non_mesure: porteDeja === undefined ? [ASSIGNED_AGENT_NON_LU] : []` → `non_mesure: []`
//
// Ce qui casse si le code régresse là : un mandat `T-…` VIVANT qui porte déjà le nom d'un
// autre agent est réécrit et rendu `rempli: true`, sans `reprises` et sans `cause`. Or
// `bin/naitre.js` teste `if (!servicedesk.rempli)` — donc RIEN ne s'imprime, et le JSON du
// geste annonce un SUCCÈS PLEIN sur un nom effacé.
//
// ⚠️ POURQUOI AUCUN BANC NE LES TUAIT. Le double `unFauxDesk` rend par défaut un `get` SANS
// `assigned_agent` — donc `nomDejaPorte` rend `undefined`, donc ni la branche de reprise ni
// celle de `non_mesure` n'est empruntée. Et le seul banc du chemin direct qui porte ce champ
// est celui du ticket `completed`, c'est-à-dire la moitié TERMINALE. **Aucun banc ne conduisait
// `declarerAuServiceDesk` sur un ticket direct VIVANT déjà attribué.**
//
// 🔴 ET LE CODE DIT LUI-MÊME QUE C'EST LA MOITIÉ QUI COMPTE : « LA MÊME RÈGLE QUE SUR LES
// STORIES — et la SYMÉTRIE n'est pas du zèle […] laisser le chemin direct rouvrirait le même
// défaut par l'autre porte ». La moitié terminale était gardée ; la moitié reprise, non —
// alors que côté epic, elle l'est.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Un ticket DIRECT, VIVANT, tel que le ServiceDesk le rend — avec ce qu'il porte, ou pas. */
const unTicketVivant = (sur = {}) => ({
  get: { ticket: { id: UUID, ticket_id: 'T-20260825-0001', status: 'in_progress', ...sur } },
});

test('🔴 UN TICKET DIRECT VIVANT DÉJÀ ATTRIBUÉ EST UNE REPRISE — jamais un succès plein', async () => {
  const { appelerMcp, appels } = unFauxDesk(unTicketVivant({ assigned_agent: 'bonaventure' }));
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });

  // ⚠️ `rempli: false` EST LE POINT DUR. `bin/naitre.js` n'imprime QUE `if (!servicedesk.rempli)` :
  // un `true` ici rend le remplacement d'un nom parfaitement muet à l'écran ET dans le JSON.
  assert.equal(r.rempli, false, 'un nom remplacé n’est pas un succès plein');
  assert.deepEqual(r.reprises, [{ code: 'T-20260825-0001', de: 'bonaventure' }], 'la reprise est NOMMÉE, avec le nom effacé');
  assert.match(r.cause, /bonaventure/, 'la cause dit DE QUI on a repris');
  assert.match(r.cause, /matapedia/, 'et À QUI');
  assert.match(r.cause, /T-20260825-0001/, 'et sur quel ticket');
  // La reprise ABOUTIT — on ne perd pas le travail, on le DIT.
  assert.deepEqual(appels.map((a) => a.args.action), ['get', 'update'], 'l’`update` part quand même');
});

test('🔴 UN TICKET DIRECT VIVANT DONT LA CHARGE NE PORTE PAS LE CHAMP LE DIT — « pas vu » n’est pas « personne »', async () => {
  // ⚠️ LA SECONDE MUTATION SURVIVANTE. Sans ce relevé, une charge muette se lit « aucun nom
  // n'a été remplacé » — une présence satisfaisante là où il n'y a eu AUCUNE mesure.
  const { appelerMcp } = unFauxDesk(unTicketVivant());
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });

  assert.equal(r.rempli, true, 'le remplissage a bien eu lieu');
  assert.ok(Array.isArray(r.non_mesure) && r.non_mesure.length > 0, 'mais ce qu’on n’a pas pu voir est DIT');
  assert.match(r.non_mesure.join(' '), /assigned_agent/, 'nommément — pas « une mesure a manqué »');
});

test('UN TICKET DIRECT VIVANT QUI NE PORTE AUCUN NOM EST UN SUCCÈS PLEIN — et ne relève RIEN', async () => {
  // ⚠️ LA MOITIÉ SYMÉTRIQUE : `assigned_agent` PRÉSENT et vide est une mesure, pas une lacune.
  // La confondre avec « pas vu » ferait relever une zone d'ombre sur un ticket parfaitement lu.
  for (const vide of [null, '', '   ']) {
    const { appelerMcp } = unFauxDesk(unTicketVivant({ assigned_agent: vide }));
    const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });
    assert.equal(r.rempli, true, `« ${JSON.stringify(vide)} » : personne ne le portait`);
    assert.deepEqual(r.non_mesure, [], 'le champ a été LU — il n’y a aucune zone d’ombre à relever');
    assert.equal(r.reprises, undefined, 'et rien n’a été repris');
  }
});

test('UN TICKET DIRECT VIVANT QUI PORTE DÉJÀ LE MÊME NOM N’EST PAS UNE REPRISE', async () => {
  // Se redéclarer sur son propre mandat n'efface le nom de personne.
  const { appelerMcp } = unFauxDesk(unTicketVivant({ assigned_agent: 'matapedia' }));
  const r = await declarerAuServiceDesk({ mandat: 'T-20260825-0001', nom: 'matapedia', appelerMcp });

  assert.equal(r.rempli, true, 'reprendre son propre nom n’est pas une reprise');
  assert.equal(r.reprises, undefined);
  assert.deepEqual(r.non_mesure, []);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8 — LE COMPTE DIT-IL CE QUI EST PARTI ? — le numérateur et le dénominateur, sur la même
//     population, et la phrase d'écran qui en dépend.
//
// 🔴 DEUX DÉFAUTS D'UNE MÊME RACINE : `remplies` EXCLUT les reprises, or une reprise est
// poussée dans `reprises` APRÈS que l'`update` a abouti — le nom est bel et bien écrit.
//
//   ⑥ `${remplies.length} story(s) remplie(s) sur ${stories.length}` porte le dénominateur de
//      l'AUTRE : 1 story vivante reprise rendait « 0 story(s) remplie(s) sur 1 » alors qu'UNE
//      écriture était partie. La ligne juste au-dessus affirmait pourtant « Le compte porte son
//      DÉNOMINATEUR et son UNITÉ ». Muté en `remplies.length + reprises.length`, la suite
//      restait VERTE : aucun essai ne reliait le chiffre imprimé aux écritures réelles.
//
//   ⑦ `phraseDuMandatIncomplet` nomme TROIS états, dont « une story a été SAUTÉE ». Le terme
//      `remplies.length > 0` de son prédicat n'était gardé par personne : retiré, la suite
//      restait verte, et l'écran disait « le mandat n'a pas reçu le nom de son agent » sur un
//      epic où deux stories venaient de le recevoir. Les deux seuls bancs qui l'appelaient
//      portaient sur « reprise seule » et « rien écrit » — la population INTERMÉDIAIRE, le cas
//      canonique, n'y arrivait jamais.
//
// ⚠️ CE QUE CES BANCS ÉPINGLENT N'EST PAS UN NOMBRE ÉCRIT À LA MAIN : c'est l'ÉGALITÉ entre le
// chiffre rendu et les `update` RÉELLEMENT partis, mesurés sur le faux desk. Un banc qui
// recopierait « 2 » se désarmerait avec le code ; celui-ci diverge dès que les deux divergent.

/** Le premier nombre de la phrase de compte — ce que l'opérateur LIT, pas ce que la structure porte. */
const compteLu = (cause) => {
  const m = /:\s*(\d+)\s+story/.exec(String(cause ?? ''));
  return m ? Number(m[1]) : null;
};

test('🔴 ⑥ LE CHIFFRE IMPRIMÉ EST LE NOMBRE D’ÉCRITURES PARTIES — pas le sous-ensemble qui exclut les reprises', async () => {
  // Une seule story, vivante, portant le nom d'un autre : l'`update` PART, le nom EST écrit.
  const stories = desStoriesDetaillees({ code: 'T-20260825-0011', status: 'in_progress', agent: 'bonaventure' });
  const { appelerMcp, appels } = unFauxDeskEpic({ stories });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'matapedia', appelerMcp });

  const parties = misesAJour(appels).length;
  assert.equal(parties, 1, 'contrôle du banc : une écriture est bien partie');
  assert.equal(
    compteLu(r.cause),
    parties,
    `le chiffre lu à l’écran doit être le nombre d’écritures parties (${parties}). Reçu : « ${r.cause} »`
  );
});

test('🔴 ⑥ SUR TROIS STORIES — une reprise, une terminale, une libre : deux écritures, et l’écran doit dire deux', async () => {
  const stories = desStoriesDetaillees(
    { code: 'T-20260825-0011', status: 'in_progress', agent: 'bonaventure' }, // reprise → update
    { code: 'T-20260825-0012', status: 'completed', agent: 'gaspesie' },      // terminale → sautée
    { code: 'T-20260825-0013', status: 'new' }                                 // libre → update
  );
  const { appelerMcp, appels } = unFauxDeskEpic({ stories });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'matapedia', appelerMcp });

  const parties = misesAJour(appels).length;
  assert.equal(parties, 2, 'contrôle du banc : deux écritures sont bien parties, la terminale n’est pas touchée');
  assert.equal(
    compteLu(r.cause),
    parties,
    `« ${r.cause} » — le lecteur doit y lire ${parties}, le nombre de noms RÉELLEMENT inscrits`
  );
  // ⚠️ ET LE DÉNOMINATEUR PORTE LA MÊME POPULATION que le numérateur : les stories du mandat.
  assert.match(
    r.cause,
    new RegExp(`${parties}\\s+story\\(s\\)[^;]*?\\b${stories.length}\\b`),
    `le dénominateur doit être les ${stories.length} stories du mandat. Reçu : « ${r.cause} »`
  );
});

test('🔴 ⑦ DES STORIES REMPLIES ET UNE SAUTÉE — l’écran ne dit PAS « n’a pas reçu le nom »', async () => {
  // ⚠️ LE CAS CANONIQUE, ET IL N'ARRIVAIT DANS AUCUN DES DEUX BANCS QUI APPELAIENT CETTE
  // FONCTION : des noms sont PARTIS, et une story a été sautée. Dire « n'a pas reçu le nom de
  // son agent » là-dessus est exactement la phrase que cette fonction existe pour empêcher.
  const stories = desStoriesDetaillees(
    { code: 'T-20260825-0011', status: 'new' },
    { code: 'T-20260825-0012', status: 'in_progress' },
    { code: 'T-20260825-0013', status: 'completed', agent: 'gaspesie' }
  );
  const { appelerMcp, appels } = unFauxDeskEpic({ stories });
  const r = await declarerAuServiceDesk({ mandat: 'E-20260825-0002', nom: 'matapedia', appelerMcp });

  assert.equal(misesAJour(appels).length, 2, 'contrôle du banc : deux noms sont bien partis');
  assert.deepEqual(r.remplies, ['T-20260825-0011', 'T-20260825-0012']);
  assert.deepEqual(r.reprises, [], 'AUCUNE reprise ici — c’est ce qui distingue ce cas du banc voisin');
  assert.equal(r.rempli, false, 'une story sautée empêche le succès plein');

  const dit = phraseDuMandatIncomplet('E-20260825-0002', r);
  assert.doesNotMatch(
    dit,
    /n’a pas reçu le nom/,
    `DEUX stories viennent de le recevoir. Reçu : « ${dit} »`
  );
  assert.match(dit, /pas été rempli entièrement/, 'l’état est « incomplet », pas « rien n’est parti »');
});

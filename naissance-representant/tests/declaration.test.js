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

test('un mandat qui est un EPIC n’est pas deviné : on rend un refus qui le dit', async () => {
  const { appelerMcp, appels } = unFauxDesk();
  const r = await declarerAuServiceDesk({ mandat: 'E-20260822-0002', nom: 'matapedia', appelerMcp });
  assert.equal(r.rempli, false);
  assert.match(r.cause, /E-20260822-0002/);
  assert.deepEqual(appels, [], 'aucun appel n’est parti — choisir une story parmi celles d’un epic serait inventer');
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

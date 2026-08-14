// Le nom d'un lieu, et le dossier qu'il désigne réellement (T-20260814-0101).
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CE QUE CETTE SUITE DOIT DISTINGUER, ET C'EST TOUT LE PROBLÈME
//
// Le défaut corrigé ici était JUSTE PAR ACCIDENT DU SYSTÈME DE FICHIERS : la mise à jour
// visait `.gestionnaire/francois`, atteignait `.gestionnaire/Francois`, et paraissait marcher
// — parce que macOS ignore la casse. Un test écrit naïvement sur macOS aurait donc été VERT
// avec le code cassé. C'est la variante la plus vicieuse du motif dominant du dépôt (« un
// test qui cherche un mot ne prouve rien ») : ici, un test qui vérifie l'effet, mais sur un
// système de fichiers plus indulgent que le vrai, ne prouve rien non plus.
//
// Deux familles de preuves, donc, et elles ne se remplacent pas :
//
//   1. CE QUE LE CODE FAIT — indépendant du système de fichiers. On regarde le CHEMIN QUE LA
//      RÉSOLUTION REND : il doit finir par le nom RÉEL du dossier (`Francois`), jamais par
//      celui qui a été tapé (`francois`). Un `join(depot, dossier, nom)` brut rend l'autre —
//      donc ces tests-là rougissent sur macOS AUSSI. Ce sont eux qui distinguent le code de
//      ce que le noyau pardonne.
//   2. CE QUE LE SYSTÈME PERMET — le second dossier qui naîtrait sur un volume SENSIBLE à la
//      casse. Impossible à établir sur un volume qui ne l'est pas : ces tests-là se déclarent
//      NON PROUVÉS et se sautent, plutôt que de passer en supposant. La CI les exécute pour
//      de bon (`ubuntu-latest`), et un `hdiutil` sensible à la casse les exécute sur macOS.
// ═════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

import {
  NOM_DE_LIEU, nomDeLieuValide, resoudreLieu, NomDeLieuInvalide, messageNomInvalide,
} from '../src/lieu-nom.js';

const depotJetable = () => mkdtempSync(join(tmpdir(), 'ld-nom-'));

/**
 * Le volume qui porte les répertoires temporaires distingue-t-il la casse ?
 *
 * Mesuré, jamais supposé d'après `process.platform` : un Mac peut porter un volume APFS
 * sensible à la casse, et c'est justement ce qu'on monte pour prouver ce qui suit.
 */
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

// ═══════════════════════════════ 1. la garde : un seul segment de chemin, jamais une évasion

test('les noms qui traversent un répertoire sont refusés — la garde n’a pas bougé', () => {
  const refuses = [
    '../evil', '../../evil', '..', '.', '', 'a/b', 'a\\b', '/absolu', './a',
    '.cache', '-drapeau', 'a b', 'a;rm -rf /', 'nom\0nul', 'é', null, undefined, 42,
  ];
  for (const nom of refuses) {
    assert.equal(nomDeLieuValide(nom), false, `« ${String(nom)} » doit rester refusé`);
  }
});

test('la casse ne fait plus partie du jugement — c’est le seul desserrement, et il est nommé', () => {
  // Les quatre lieux réels du poste (le cinquième, `maxime`, passait déjà).
  for (const nom of ['Charles-Olivier', 'Francois', 'Jacob', 'Zach', 'maxime', 'A1', '0z']) {
    assert.equal(nomDeLieuValide(nom), true, `« ${nom} » doit être accepté`);
  }
});

test('tout nom que herdr accepte pour un agent est logeable — sinon on rouvre le désaccord d’un cran plus bas', () => {
  // LE DÉFAUT QU'ON FERME EST « DEUX RÈGLES QUI NE S'ACCORDENT PAS ». Une garde du LIEU plus
  // étroite que celle du NOM d'agent le rouvre : un agent parfaitement nommable n'aurait nulle
  // part où loger, et — bien pire — un lieu DÉJÀ POSÉ sous un nom à souligné deviendrait
  // inatteignable, la pose n'ayant eu aucune garde jusqu'ici.
  //
  // La règle de herdr est `^[a-z][a-z0-9_-]{0,31}$` (naissance-representant/src/naissance.js).
  // On l'éprouve sur des noms qui la respectent, souligné compris.
  for (const nom of ['ville-de-quebec_2', 'mon_chantier', 'd-20260813-0002', 'a']) {
    assert.equal(nomDeLieuValide(nom), true, `« ${nom} » nomme un agent herdr valide : il doit pouvoir loger quelque part`);
  }
});

test('la garde est une liste BLANCHE — un caractère nouveau est refusé par défaut, pas admis', () => {
  // Contre-preuve du test ci-dessus : si la règle était une liste noire, tout caractère non
  // prévu passerait. On vérifie la forme de la règle elle-même, pas seulement des exemples.
  assert.equal(NOM_DE_LIEU.source.startsWith('^[A-Za-z0-9]'), true, 'la règle doit ancrer un premier caractère alphanumérique');
  for (const exotique of ['a$b', 'a|b', 'a*b', 'a`b', 'a\nb', 'a\tb', 'a:b', 'a~b', 'a.b', 'a%b', 'a"b']) {
    assert.equal(nomDeLieuValide(exotique), false, `« ${exotique} » ne doit pas passer une liste blanche`);
  }
});

test('la résolution refuse elle-même un nom invalide — la garde ne dépend pas de la politesse de l’appelant', () => {
  // Une garde qu'on peut contourner en oubliant de l'appeler n'en est pas une. Celle-ci vit
  // DANS la résolution : un appelant futur qui ne validerait pas obtient une exception, jamais
  // un chemin d'évasion.
  const depot = depotJetable();
  assert.throws(
    () => resoudreLieu(depot, '.gestionnaire', '../../evil'),
    NomDeLieuInvalide,
    'un nom qui traverse un répertoire doit lever, pas rendre un chemin',
  );
  assert.equal(existsSync(join(depot, '..', 'evil')), false, 'et rien n’a été touché au passage');
});

test('le refus dit la même chose des deux côtés — un seul texte, pas deux', () => {
  const message = messageNomInvalide('../evil', '--client');
  assert.match(message, /--client/, 'le refus doit nommer le paramètre de l’appelant');
  assert.match(message, /casse est libre/i, 'le refus doit dire que la casse est portée — c’est la question qu’on se pose devant lui');
});

// ═══════════════════════════════ 2. ce que le CODE fait — prouvé sur tout système de fichiers

test('un lieu posé en majuscules est RETROUVÉ par son nom en minuscules — le chemin rendu porte le nom réel', () => {
  const depot = depotJetable();
  mkdirSync(join(depot, '.gestionnaire', 'Francois'), { recursive: true });

  const r = resoudreLieu(depot, '.gestionnaire', 'francois');

  // LA preuve indépendante du système de fichiers : le chemin rendu finit par « Francois ».
  // Un `join(depot, dossier, nom)` brut finirait par « francois » — et rougirait donc ici
  // même sur macOS, où l'un et l'autre désignent pourtant le même dossier.
  assert.equal(basename(r.racine), 'Francois', 'la résolution doit rendre le nom RÉEL du dossier, pas celui qui a été tapé');
  assert.equal(r.nom, 'Francois');
  assert.equal(r.demande, 'francois');
  assert.equal(r.exact, false, 'la casse diffère : la résolution doit le dire, pour que la commande puisse le dire aussi');
  assert.equal(r.existe, true);
  assert.equal(r.ambigu, false);
});

test('la correspondance exacte l’emporte toujours sur l’homonyme de casse', () => {
  const depot = depotJetable();
  mkdirSync(join(depot, '.gestionnaire', 'francois'), { recursive: true });

  const r = resoudreLieu(depot, '.gestionnaire', 'francois');
  assert.equal(basename(r.racine), 'francois');
  assert.equal(r.exact, true);
});

test('aucun lieu posé : le chemin rendu porte le nom demandé, tel quel — la casse tapée fait foi', () => {
  const depot = depotJetable();

  const r = resoudreLieu(depot, '.gestionnaire', 'Charles-Olivier');

  assert.equal(basename(r.racine), 'Charles-Olivier', 'la pose ne normalise pas : le nom tapé est celui du dossier');
  assert.equal(r.existe, false);
  assert.equal(r.homonymes.length, 0);
});

test('un FICHIER homonyme n’est pas un lieu — seuls les répertoires comptent', () => {
  const depot = depotJetable();
  mkdirSync(join(depot, '.gestionnaire'), { recursive: true });
  writeFileSync(join(depot, '.gestionnaire', 'Francois'), 'pas un lieu');

  const r = resoudreLieu(depot, '.gestionnaire', 'francois');
  assert.equal(r.existe, false, 'un fichier ne doit pas se faire passer pour un lieu');
  assert.equal(basename(r.racine), 'francois');
});

test('dossier de rôle absent : la résolution répond sans lever — c’est le cas du tout premier lieu', () => {
  const depot = depotJetable();
  const r = resoudreLieu(depot, '.orchestrateur', 'chantier1');
  assert.equal(r.existe, false);
  assert.equal(basename(r.racine), 'chantier1');
});

// ═══════════════════════════════ 3. ce que le SYSTÈME permet — seulement là où il le permet

test('deux lieux qui ne diffèrent que par la casse : la résolution REFUSE de deviner', { skip: SENSIBLE ? false : 'volume insensible à la casse : deux homonymes ne peuvent pas y coexister — non prouvable ici, la CI Linux l’exécute' }, () => {
  const depot = depotJetable();
  mkdirSync(join(depot, '.gestionnaire', 'Francois'), { recursive: true });
  mkdirSync(join(depot, '.gestionnaire', 'francois'), { recursive: true });
  mkdirSync(join(depot, '.gestionnaire', 'FRANCOIS'), { recursive: true });

  const r = resoudreLieu(depot, '.gestionnaire', 'FrAnCoIs');

  assert.equal(r.ambigu, true, 'aucun des trois ne porte le nom demandé : en choisir un serait mettre à jour un lieu mort');
  assert.equal(r.existe, false);
  assert.deepEqual(r.homonymes, ['FRANCOIS', 'Francois', 'francois']);
});

test('ambiguïté levée par une correspondance exacte — trois homonymes, mais un seul porte le nom demandé', { skip: SENSIBLE ? false : 'volume insensible à la casse' }, () => {
  const depot = depotJetable();
  mkdirSync(join(depot, '.gestionnaire', 'Francois'), { recursive: true });
  mkdirSync(join(depot, '.gestionnaire', 'francois'), { recursive: true });

  const r = resoudreLieu(depot, '.gestionnaire', 'francois');
  assert.equal(r.ambigu, false);
  assert.equal(basename(r.racine), 'francois');
});

test('témoin : sans résolution, le nom tapé produit bel et bien un SECOND dossier', { skip: SENSIBLE ? false : 'volume insensible à la casse : c’est exactement ce que macOS masque' }, () => {
  // Ce test n'éprouve pas notre code — il éprouve la RÉALITÉ que notre code doit empêcher,
  // en rejouant l'ancienne composition de chemin. Sans lui, les tests ci-dessus pourraient
  // être décoratifs : ils ne prouvent quelque chose que si le mode de panne existe vraiment.
  const depot = depotJetable();
  mkdirSync(join(depot, '.gestionnaire', 'Francois'), { recursive: true });

  mkdirSync(join(depot, '.gestionnaire', 'francois'), { recursive: true }); // l'ancien `join(...)`

  assert.deepEqual(
    readdirSync(join(depot, '.gestionnaire')).sort(),
    ['Francois', 'francois'],
    'témoin : sur ce volume, viser le nom tapé crée un second lieu — le vrai reste périmé, le neuf est vide et muet',
  );
});

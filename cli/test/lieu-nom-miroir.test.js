// LE VERROU DE LA RÈGLE UNIQUE (T-20260814-0101).
//
// La pose (`ligne-directe/src/lieu-agent.js`) et la mise à jour (`cli/src/commands/
// representant.js`) portaient chacune SA règle de nommage, et elles ne s'accordaient pas :
// nom brut d'un côté, slug minuscule de l'autre. Quatre lieux réels sur cinq étaient
// inatteignables, et macOS le masquait.
//
// La règle vit désormais dans UN SEUL TEXTE — `lieu-nom.js` — présent en deux exemplaires
// octet pour octet identiques, parce que la distribution l'impose (le paquet npm du CLI ne
// peut pas importer un module de poste, et le poste n'a pas le CLI ; le POURQUOI complet est
// en tête du fichier). Ce test est ce qui rend la duplication INOFFENSIVE : corriger la règle
// d'un côté sans l'autre rougit ici, immédiatement.
//
// Sans ce verrou, le correctif reconduirait exactement le défaut qu'il prétend fermer — le
// motif « une porte sur deux » a déjà frappé neuf fois sur ce dépôt, dont deux fois DANS le
// correctif du défaut lui-même.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// La VRAIE règle, celle que la commande applique — jamais une copie recopiée dans le test.
// Une regex réécrite ici serait un double plus permissif (ou plus strict) que le service
// réel : le motif 2 du brief de revue, posé de nos propres mains.
import { nomDeLieuValide } from '../src/lieu-nom.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const REPO = resolve(HERE, '..', '..');

const SOURCE = join(REPO, 'ligne-directe', 'src', 'lieu-nom.js');
const COPIE = join(CLI_DIR, 'src', 'lieu-nom.js');

test('la règle de nommage est le MÊME TEXTE des deux côtés — octet pour octet', () => {
  const source = readFileSync(SOURCE);
  const copie = readFileSync(COPIE);

  assert.ok(
    source.equals(copie),
    'ligne-directe/src/lieu-nom.js et cli/src/lieu-nom.js ont divergé — c’est le défaut de '
      + 'T-20260814-0101 qui revient (deux règles de nommage dans le même pack). '
      + 'Corriger la SOURCE (ligne-directe), puis « node cli/scripts/sync-lieu-nom.mjs ».',
  );
});

test('le script qui refait la copie existe — sans lui, tenir le miroir demanderait de la discipline', () => {
  const script = join(CLI_DIR, 'scripts', 'sync-lieu-nom.mjs');
  assert.ok(existsSync(script), 'cli/scripts/sync-lieu-nom.mjs est le geste qui répare le miroir ; le message du test ci-dessus le cite');
});

test('la POSE passe par la règle unique — elle ne recompose plus le chemin elle-même', () => {
  const src = readFileSync(join(REPO, 'ligne-directe', 'src', 'lieu-agent.js'), 'utf8');
  const sansCommentaires = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  assert.match(sansCommentaires, /from '\.\/lieu-nom\.js'/, 'lieu-agent.js doit importer la règle unique');
  assert.ok(
    !/join\(\s*depot\s*,\s*[^)]*dossier[^)]*,\s*nom\s*\)/.test(sansCommentaires),
    'lieu-agent.js recompose un chemin de lieu à la main — c’est la seconde règle qui renaît',
  );
});

test('la MISE À JOUR passe par la règle unique — elle ne recompose plus le chemin elle-même', () => {
  const src = readFileSync(join(CLI_DIR, 'src', 'commands', 'representant.js'), 'utf8');
  const sansCommentaires = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  assert.match(sansCommentaires, /from '\.\.\/lieu-nom\.js'/, 'representant.js doit importer la règle unique');
  assert.ok(
    !/role\.dossier\s*,\s*nom\s*\)/.test(sansCommentaires.replace(/resoudreLieu\([^)]*\)/g, '')),
    'representant.js compose « join(…, role.dossier, nom) » à la main — c’est le chemin qui manquait le lieu réel',
  );
});

test('les deux exemplaires rendent le MÊME VERDICT — prouvé en les faisant juger, pas en lisant leur texte', async () => {
  // RELEVÉ EN REVUE (passe 1), et c'est le motif dominant du dépôt : les gardes ci-dessus
  // regardent des TEXTES — des octets identiques, un import présent, une regex absente. Aucune
  // ne fait TRAVAILLER les deux exemplaires. Une comparaison de textes ne peut rien dire du
  // jour où l'un des deux serait chargé depuis ailleurs (un paquet publié, un `--source`) :
  // seule la comparaison des VERDICTS le dirait.
  //
  // On les importe donc tous les deux, et on les fait juger le même corpus — noms sûrs, noms
  // qui traversent, casses mêlées — plus une résolution sur un vrai disque.
  const [source, copie] = await Promise.all([
    import(pathToFileURL(SOURCE).href),
    import(pathToFileURL(COPIE).href),
  ]);

  const CORPUS = [
    'maxime', 'Francois', 'Charles-Olivier', 'Jacob', 'Zach', 'ville-de-quebec_2', 'A1', '0z',
    '../evil', '../../evil', '..', '.', '', 'a/b', 'a\\b', '/absolu', '.cache', '-drapeau',
    'a b', 'a;rm -rf /', 'a\0b', 'é', 'a.b', 'a$b',
  ];
  for (const nom of CORPUS) {
    assert.equal(
      copie.nomDeLieuValide(nom), source.nomDeLieuValide(nom),
      `les deux exemplaires jugent « ${nom} » différemment — la règle a divergé EN FAIT, pas seulement en texte`,
    );
  }

  // Et le verdict qui COMPTE : le chemin résolu, sur un vrai disque, lieu posé en majuscules.
  const depot = mkdtempSync(join(tmpdir(), 'smtk-miroir-'));
  mkdirSync(join(depot, '.gestionnaire', 'Francois'), { recursive: true });
  for (const nom of ['francois', 'Francois', 'FRANCOIS', 'jacob']) {
    assert.deepEqual(
      copie.resoudreLieu(depot, '.gestionnaire', nom),
      source.resoudreLieu(depot, '.gestionnaire', nom),
      `les deux exemplaires résolvent « ${nom} » vers des lieux différents — la pose et la mise à jour se déphaseraient`,
    );
  }
});

test('aucune SECONDE règle de nommage ne subsiste dans le CLI', () => {
  // La forme exacte du défaut : une classe de caractères bornée aux minuscules, appliquée à
  // un nom de lieu. Elle a vécu dans `clientSlugValide` ; qu'elle ne réapparaisse nulle part.
  const fichiers = [
    join(CLI_DIR, 'src', 'commands', 'representant.js'),
    join(CLI_DIR, 'src', 'cli.js'),
  ];
  for (const f of fichiers) {
    const sansCommentaires = readFileSync(f, 'utf8')
      .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.ok(
      !/\[a-z0-9\]\[a-z0-9-\]\*/.test(sansCommentaires),
      `${f} porte à nouveau une règle de nommage en minuscules — la règle vit dans lieu-nom.js, et nulle part ailleurs`,
    );
  }
});

test('ce que l’opérateur LIT est la règle elle-même, CITÉE — jamais une seconde description', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // DEUX FOIS RELEVÉ EN REVUE (passe 2), ET LA SECONDE FOIS CONTRE MA PROPRE GARDE.
  //
  // 1er relevé : le code appliquait la casse libre pendant que `--help` et le README
  //    exigeaient « minuscules/chiffres/tirets ». L'aide est le PREMIER endroit qu'un
  //    opérateur consulte avant d'agir : le lot corrigeait le code et laissait ouverte la
  //    porte humaine.
  // 2e relevé : la garde posée en réponse cherchait des TOURNURES INTERDITES — une liste
  //    noire. La revue l'a défaite en une mutation, sans toucher au code : réécrire
  //    « bas de casse uniquement » ou « lowercase only » passait à travers, et le test
  //    restait vert. Motif 1 du brief, posé de la main même qui voulait le fermer.
  //
  // On ne garde donc plus l'ACCORD entre deux textes : il n'y en a plus qu'un. `cli.js`
  // interpole `REGLE_NOM_DE_LIEU`, et le README la porte à la lettre. Ce test l'exige par
  // COMPARAISON LITTÉRALE à la source — pas par motif, pas par mot-clé. Réécrire l'aide à la
  // main, dans n'importe quelle langue et n'importe quelle tournure, fait rougir : le texte
  // exigé n'y est plus.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const { REGLE_NOM_DE_LIEU } = await import(pathToFileURL(COPIE).href);
  assert.ok(REGLE_NOM_DE_LIEU.length > 80, 'la règle doit être une phrase, sinon la retrouver ne prouverait rien');

  // L'aide RENDUE, pas le source : c'est ce que l'opérateur voit. Une constante importée mais
  // jamais interpolée laisserait le source vert et l'aide muette.
  const { run } = await import(pathToFileURL(join(CLI_DIR, 'src', 'cli.js')).href);
  const avant = console.log;
  let aide = '';
  console.log = (...a) => { aide += a.join(' ') + '\n'; };
  try {
    await run(['--help']);
  } finally {
    console.log = avant;
  }

  assert.ok(
    aide.includes(REGLE_NOM_DE_LIEU),
    'l’aide rendue par « --help » ne porte pas la règle telle qu’elle est écrite dans lieu-nom.js — '
      + 'une seconde description est réapparue, et c’est elle que l’opérateur lira avant d’agir',
  );
  assert.ok(
    readFileSync(join(CLI_DIR, 'README.md'), 'utf8').includes(REGLE_NOM_DE_LIEU),
    'cli/README.md ne porte pas la règle telle qu’elle est écrite dans lieu-nom.js — même défaut, autre porte',
  );

  // Et la règle CITÉE est bien celle qui est APPLIQUÉE : le nom qui a motivé ce ticket passe.
  assert.equal(nomDeLieuValide('Francois'), true, 'témoin : si « Francois » était refusé, la règle citée mentirait et ce test serait à l’envers');
});

test('la règle unique ne dépend que de node: — c’est ce qui rend le miroir possible', () => {
  // Un import vers `roles.js` (ou tout autre module de `ligne-directe/`) casserait la copie
  // côté CLI, où ces modules n'existent pas. Le miroir tomberait au premier `pack
  // representant-update` réel — et pas en CI, où le dépôt entier est là. Panne muette, chez
  // un client. On ferme la porte ici.
  const src = readFileSync(SOURCE, 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  const etrangers = imports.filter((i) => !i.startsWith('node:'));
  assert.deepEqual(
    etrangers, [],
    `lieu-nom.js importe ${etrangers.join(', ')} — la copie côté CLI ne pourrait pas les résoudre, `
      + 'et la commande tomberait chez le client, pas en CI',
  );
});

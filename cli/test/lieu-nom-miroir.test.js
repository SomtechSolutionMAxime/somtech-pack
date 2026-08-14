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
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

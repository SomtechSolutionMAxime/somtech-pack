// Le lecteur du CLI et celui du poste lisent un `.nom-agent` de la même façon.
//
// Le CLI ne peut pas importer `ligne-directe/` : il porte sa propre copie de
// `nomInscritDansLeLieu`. Une copie qui dérive ferait dire au CLI « aucun nom » là où le poste
// en lit un — ou l'inverse — et la mise à jour par nom viserait un autre lieu que la naissance.
// Ce banc fait lire les MÊMES lieux par les DEUX lecteurs réels (aucun double).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { nomInscritDansLeLieu as duCli, FICHIER_NOM_AGENT as fichierCli } from '../src/nom-inscrit.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const poste = await import(pathToFileURL(join(REPO, 'ligne-directe', 'src', 'nom-de-riviere.js')).href);

const lieu = (contenu, mode) => {
  const d = mkdtempSync(join(tmpdir(), 'nom-inscrit-'));
  if (contenu !== undefined) {
    const f = join(d, poste.FICHIER_NOM_AGENT);
    writeFileSync(f, contenu);
    if (mode !== undefined) chmodSync(f, mode);
  }
  return d;
};

test('le fichier lu est le même des deux côtés', () => {
  assert.equal(fichierCli, poste.FICHIER_NOM_AGENT);
});

for (const [libelle, contenu] of [
  ['un nom', 'bonaventure\n'],
  ['un nom en majuscules (rendu en minuscules)', 'Bonaventure\n'],
  ['un fichier vide', '\n'],
  ['aucun fichier', undefined],
]) {
  test(`même réponse — ${libelle}`, () => {
    const d = lieu(contenu);
    assert.deepEqual(duCli(d), poste.nomInscritDansLeLieu(d));
  });
}

test('même réponse — illisible : les deux disent « illisible », aucun ne conclut « aucun nom »', {
  skip: process.getuid?.() === 0 ? 'root lit tout : non prouvable ici' : false,
}, () => {
  const d = lieu('bonaventure\n', 0o000);
  const a = duCli(d);
  const b = poste.nomInscritDansLeLieu(d);
  chmodSync(join(d, poste.FICHIER_NOM_AGENT), 0o600);
  assert.ok(a.illisible, 'le CLI doit dire illisible');
  assert.ok(b.illisible, 'le poste doit dire illisible');
  assert.equal(a.nom, null);
});

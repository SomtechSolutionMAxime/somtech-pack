// versement.test.js — VERSER LE LIEU, et surtout ce que le versement REFUSE de faire.
//
// Le reste du versement (idempotence, portée du commit, précondition git) est éprouvé de bout en
// bout dans `naitre-bin.test.js`, contre un vrai git. Ce fichier garde ce que ces essais-là ne
// peuvent pas atteindre : les gardes qui refusent AVANT d'agir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

import { verserLeLieu, ceQuiResteAVerser, exigerUnDepotGit, VersementImpossible } from '../src/versement.js';

function depotGit() {
  const d = mkdtempSync(join(tmpdir(), 'versement-'));
  execFileSync('git', ['-C', d, 'init', '-q']);
  execFileSync('git', ['-C', d, 'config', 'user.email', 'essai@somtech.ca']);
  execFileSync('git', ['-C', d, 'config', 'user.name', 'essai']);
  writeFileSync(join(d, 'README.md'), 'socle\n');
  execFileSync('git', ['-C', d, 'add', '-A']);
  execFileSync('git', ['-C', d, 'commit', '-qm', 'socle']);
  return d;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA GARDE HORS-DÉPÔT — mutation SURVIVANTE trouvée par la revue de fond
//
// ⚠️ Elle existait dans le code et n'était éprouvée nulle part. Une garde que rien ne mesure est
// une garde dont personne ne saura qu'elle a cessé de mordre — c'est le motif que ce dépôt paie
// le plus cher, et il se réintroduit toujours par la même porte : « c'est évident, ça marche ».
//
// Ce qu'elle empêche concrètement : un `lieu` qui remonte hors du dépôt visé produirait un
// chemin relatif en `../..`, et `git add` / `git commit` s'appliqueraient à quelque chose que
// l'appelant n'a jamais désigné — dans un dépôt qui n'est pas le sien.

test('un lieu HORS du dépôt visé est refusé — jamais de versement à l’aveugle chez le voisin', () => {
  const depot = depotGit();
  const ailleurs = mkdtempSync(join(tmpdir(), 'voisin-'));
  mkdirSync(join(ailleurs, '.orchestrateur', 'x'), { recursive: true });
  writeFileSync(join(ailleurs, '.orchestrateur', 'x', 'CLAUDE.md'), '# ailleurs\n');

  assert.throws(
    () => verserLeLieu(depot, join(ailleurs, '.orchestrateur', 'x')),
    (e) => {
      assert.match(e.message, /n’est pas dans le dépôt|n'est pas dans le dépôt/, 'le refus doit dire POURQUOI');
      return true;
    }
  );
});

test('la lecture aussi refuse un lieu hors dépôt — la garde ne vaut pas que pour ce qui écrit', () => {
  // Si seule l'écriture était gardée, un appelant pourrait interroger l'état d'un chemin
  // étranger avant de décider quoi faire — et se croire autorisé par la réponse.
  const depot = depotGit();
  assert.throws(() => ceQuiResteAVerser(depot, '/tmp/nulle-part-du-tout'), /dépôt/);
});

test('le dépôt lui-même n’est pas un lieu — un chemin vide remonterait à la racine', () => {
  const depot = depotGit();
  assert.throws(() => verserLeLieu(depot, depot), /dépôt/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA PRÉCONDITION, ET SON MESSAGE

test('hors dépôt git, le refus dit qu’il n’a RIEN posé — c’est la moitié qui rassure', () => {
  const pasUnDepot = mkdtempSync(join(tmpdir(), 'pas-git-'));
  assert.throws(
    () => exigerUnDepotGit(pasUnDepot),
    (e) => {
      assert.ok(e instanceof VersementImpossible);
      assert.match(e.message, /pas un dépôt git/);
      assert.match(e.message, /Rien n’a été posé|Rien n'a été posé/, 'sans ça, le lecteur cherche ce qui traîne');
      assert.match(e.message, /geste qui lève le blocage/, 'un arrêt sans geste laisse au même endroit qu’avant');
      return true;
    }
  );
});

test('dans un dépôt git, la précondition se tait — elle ne coûte rien au cas nominal', () => {
  assert.doesNotThrow(() => exigerUnDepotGit(depotGit()));
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'IDEMPOTENCE, mesurée sur le fait plutôt que sur la parole

test('rien à verser ne produit AUCUN commit — un commit vide par naissance rendrait l’historique illisible', () => {
  const depot = depotGit();
  const lieu = join(depot, '.orchestrateur', 'x');
  mkdirSync(lieu, { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), '# le lieu\n');

  const avant = execFileSync('git', ['-C', depot, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim();
  const premier = verserLeLieu(depot, lieu);
  const second = verserLeLieu(depot, lieu);
  const apres = execFileSync('git', ['-C', depot, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim();

  assert.equal(premier.verse, true, 'le premier versement doit verser');
  assert.equal(second.deja, true, 'le second n’a plus rien à verser');
  assert.equal(Number(apres) - Number(avant), 1, 'exactement UN commit, pas deux');
});

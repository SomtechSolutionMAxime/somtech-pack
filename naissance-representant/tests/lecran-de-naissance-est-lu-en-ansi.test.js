// lecran-de-naissance-est-lu-en-ansi.test.js — LE CHEMIN DE LA NAISSANCE LISAIT DU TEXTE BRUT,
// et il donnait donc à sa sonde une entrée qui ne peut pas porter ce qu'elle cherche
// (E-20260819-0015).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT, ET POURQUOI IL EST DE LA MÊME FAMILLE QUE LES SIX HEURES DU 19 AOÛT
//
// `bin/naitre.js` juge une session « prête à recevoir » avec `etatDeLEcran` — qui commence par
// `sansGris`, parce qu'un texte GRISÉ est une proposition de l'éditeur et non le contenu de
// l'écran. Or la commande construite ici demandait `agent read … --source visible --lines 40`,
// **sans `--format ansi`** : le dump arrivait sans attributs, et `sansGris` n'avait donc jamais
// rien à retirer.
//
// 🔴 CE QUE ÇA POUVAIT PRODUIRE. Les sondes d'écrans connus cherchent des phrases (« Do you
// trust the files in this folder? »…). Une SUGGESTION qui reprend l'une d'elles — et une
// suggestion reprend un message déjà envoyé, donc du vocabulaire de ce poste — se serait lue
// comme l'écran lui-même : refus de naissance, puis **envoi de touches** pour « franchir » un
// écran qui n'existe pas. Le geste part alors dans la boîte.
//
// ⚠️ LA PREUVE EST DANS LA COMMANDE CONSTRUITE, PAS DANS UN DUMP — même forme que l'essai frère
// de `livraison.test.js`. Un banc qui passerait un écran déjà en ANSI à la sonde prouverait que
// la sonde sait lire, jamais qu'on lui donne de quoi.

import test from 'node:test';
import assert from 'node:assert/strict';

import { commandesNaissance } from '../src/naissance.js';

test('L’ÉCRAN DE LA NAISSANCE EST DEMANDÉ EN ANSI — sans quoi le gris n’arrive jamais à la sonde', () => {
  const cmd = commandesNaissance('/tmp/depot', 'acme', { workspace: 'w1' }).lireEcran('w1:p1');
  assert.ok(Array.isArray(cmd), 'la commande est construite, pas exécutée');
  assert.equal(cmd.indexOf('--format') !== -1, true, `la commande doit porter --format : ${cmd.join(' ')}`);
  assert.equal(cmd[cmd.indexOf('--format') + 1], 'ansi');
});

test('ET ELLE GARDE CE QU’ELLE DEMANDAIT DÉJÀ — on ajoute une option, on n’en retire aucune', () => {
  // ⚠️ Une correction qui réécrit la commande au lieu de l'augmenter changerait ce que la
  // naissance regarde (le viewport, 40 lignes) sans que rien ne le dise.
  const cmd = commandesNaissance('/tmp/depot', 'acme', { workspace: 'w1' }).lireEcran('w1:p1');
  assert.deepEqual(cmd.slice(0, 3), ['agent', 'read', 'w1:p1']);
  assert.equal(cmd[cmd.indexOf('--source') + 1], 'visible');
  assert.equal(cmd[cmd.indexOf('--lines') + 1], '40');
});

#!/usr/bin/env node
// sync-fraicheur-gabarit.mjs — refait la copie de la garde de fraîcheur du gabarit.
//
// `ligne-directe/src/fraicheur-gabarit.js` est la SOURCE ; `cli/src/fraicheur-gabarit.js` en
// est une copie octet pour octet. La duplication est imposée par la distribution — le paquet
// npm du CLI n'embarque que `bin/`, `src/` et `payload/`, et ne peut donc pas importer un
// module de poste — et le POURQUOI complet est en tête du fichier lui-même (E-20260818-0014).
//
// Ce script ne garantit rien à lui seul : c'est `cli/test/fraicheur-gabarit-miroir.test.js`
// qui tient la garantie, en comparant les deux octet pour octet ET en leur faisant juger le
// même corpus. Celui-ci n'est que le geste qui répare, pour que corriger la garde ne demande
// aucune discipline. Même forme que `sync-lieu-nom.mjs`, pour la même raison.

import { copyFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // cli/scripts
const REPO = resolve(HERE, '..', '..');

const SOURCE = join(REPO, 'ligne-directe', 'src', 'fraicheur-gabarit.js');
const COPIE = join(REPO, 'cli', 'src', 'fraicheur-gabarit.js');

const avant = readFileSync(SOURCE);
let apres;
try {
  apres = readFileSync(COPIE);
} catch {
  apres = null;
}

if (apres && avant.equals(apres)) {
  console.log('✓ la copie est déjà identique à la source — rien à faire');
  process.exit(0);
}

copyFileSync(SOURCE, COPIE);
console.log(`✓ copie refaite depuis la source :\n    ${SOURCE}\n  → ${COPIE}`);

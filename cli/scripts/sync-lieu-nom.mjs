#!/usr/bin/env node
// sync-lieu-nom.mjs — refait la copie de la règle unique de nommage des lieux.
//
// `ligne-directe/src/lieu-nom.js` est la SOURCE ; `cli/src/lieu-nom.js` en est une copie
// octet pour octet. La duplication est imposée par la distribution — le paquet npm du CLI ne
// peut pas importer un module de poste — et le POURQUOI complet est en tête du fichier
// lui-même (T-20260814-0101).
//
// Ce script ne garantit rien à lui seul : c'est `cli/test/lieu-nom-miroir.test.js` qui tient
// la garantie, en comparant les deux octet pour octet à chaque exécution de la suite. Celui-ci
// n'est que le geste qui répare, pour que corriger la règle ne demande aucune discipline.

import { copyFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // cli/scripts
const REPO = resolve(HERE, '..', '..');

const SOURCE = join(REPO, 'ligne-directe', 'src', 'lieu-nom.js');
const COPIE = join(REPO, 'cli', 'src', 'lieu-nom.js');

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

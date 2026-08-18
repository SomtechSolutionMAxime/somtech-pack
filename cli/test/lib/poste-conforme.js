// poste-conforme.js — un POSTE jetable dont le pack est celui qu'une fixture distribue.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE HELPER EXISTE (E-20260818-0014)
//
// Depuis la garde de fraîcheur, une commande qui SERT un gabarit le compare d'abord au pack
// installé sur le poste. Les suites qui éprouvent la convergence fabriquent un payload de
// fixture — un gabarit qui n'est celui d'aucun pack réel : sans rien faire, elles se
// verraient refuser, et éprouveraient la garde au lieu d'éprouver ce qu'elles visent.
//
// ⚠️ ET ON NE DÉSARME SURTOUT PAS LA GARDE POUR AUTANT. Neutraliser la fraîcheur dans ces
// suites la rendrait absente précisément là où le geste écrit dans un lieu — le motif « une
// garde qu'on peut désarmer sans qu'un test rougisse », déjà payé sur ce dépôt. On rend donc
// le poste CONFORME à la fixture : la garde tourne, elle compare, et elle trouve identique.
// Les suites éprouvent leur objet, et la garde reste armée sous elles.
//
// ⚠️ CE HELPER TOUCHE `process.env.HOME`, et c'est sans danger ICI : le lanceur de tests de
// node exécute chaque FICHIER de test dans son propre processus. Le foyer posé par une suite
// n'atteint aucune autre. Il faut malgré tout l'appeler après chaque fabrication de payload —
// un payload neuf est un pack neuf.

import { cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { SOUS_CHEMIN_REFERENCE } from '../../src/fraicheur-gabarit.js';

/**
 * Fait de ce processus un poste dont le pack installé est EXACTEMENT celui du payload donné.
 * Rend le chemin du foyer, pour les suites qui veulent l'inspecter.
 */
export function alignerLePosteSur(payload) {
  const foyer = mkdtempSync(join(tmpdir(), 'smtk-poste-'));
  const cible = join(foyer, SOUS_CHEMIN_REFERENCE);
  mkdirSync(dirname(cible), { recursive: true });
  cpSync(join(payload, '.claude', 'templates'), cible, { recursive: true });
  process.env.HOME = foyer;
  return foyer;
}

/** Un poste qui n'a jamais reçu le pack — la référence y est introuvable, la garde ne refuse pas. */
export function unPosteSansPack() {
  const foyer = mkdtempSync(join(tmpdir(), 'smtk-poste-nu-'));
  process.env.HOME = foyer;
  return foyer;
}

// un-fichier-invisible-a-grep-echappe-a-toute-revue.test.js — LA SOURCE RESTE DU TEXTE.
// (D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QUI A ÉTÉ MESURÉ, ET POURQUOI ÇA VISE LE MODULE LE PLUS SENSIBLE DU DÉPÔT
//
// `garde-des-naissances.js` portait un octet NUL BRUT dans un littéral — la clé d'appariement
// « session NUL pane ». L'octet était dans le FICHIER, pas échappé. Conséquences mesurées :
//
//   • `file` rendait `data` pour ce fichier — le SEUL des 23 de `src/` et `bin/` ;
//   • `grep -n export` dessus rendait ZÉRO ligne ; `grep -a` en rendait 16.
//
// Autrement dit : toute revue, tout audit, tout relevé de formes qui passe par `grep` sautait
// EN SILENCE le module qui porte la garde des naissances. Un fichier qu'aucun outil de recherche
// ne voit n'est pas relu — et c'est le contraire exact du critère d'arrêt de « qui garde le
// gardien », qui exige qu'un désarmement soit VISIBLE EN REVUE.
//
// ⚠️ CE BANC NE GARDE PAS UN FICHIER, IL GARDE LA FAMILLE. Épingler « garde-des-naissances.js
// n'a pas de NUL » laisserait le prochain fichier libre de l'être. On énumère donc TOUTE la
// source livrée du module, et l'exigence porte sur chacun — y compris celui qu'on ajoutera dans
// six mois, qui n'a rien à déclarer nulle part pour être couvert.
// ═══════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');

/** Toute la source livrée — `src/` et `bin/`, énumérés, jamais listés à la main. */
function lesSources() {
  const vus = [];
  for (const dossier of ['src', 'bin']) {
    const ou = join(RACINE, dossier);
    for (const f of readdirSync(ou)) {
      if (f.endsWith('.js')) vus.push(join(ou, f));
    }
  }
  return vus;
}

test('la source est ÉNUMÉRÉE, et il y en a — un banc qui ne trouve aucun fichier ne peut pas échouer', () => {
  // ⚠️ SANS CETTE MOITIÉ le banc suivant est VERT sur un dossier vide, un chemin faux, un
  // renommage de dossier. Il aurait alors exactement la forme qu'il existe pour interdire :
  // une garde qui ne peut pas rougir.
  assert.ok(lesSources().length >= 15, `attendu au moins 15 fichiers source, vu ${lesSources().length}`);
});

test('🔴 aucun fichier source ne porte d’octet de contrôle BRUT — sinon `grep` le saute en silence', () => {
  const fautifs = [];
  for (const chemin of lesSources()) {
    const octets = readFileSync(chemin);
    // Les octets de contrôle qui rendent un fichier « binaire » aux yeux de `grep`, `file` et
    // des outils de revue. On laisse passer ce qu'un texte porte légitimement : tabulation
    // (0x09), saut de ligne (0x0a), retour chariot (0x0d).
    for (let i = 0; i < octets.length; i += 1) {
      const o = octets[i];
      if ((o < 0x09 || (o > 0x0d && o < 0x20)) && o !== 0x1b) {
        fautifs.push(`${chemin.slice(RACINE.length + 1)} : octet 0x${o.toString(16).padStart(2, '0')} à la position ${i}`);
        break;
      }
    }
  }
  assert.deepEqual(
    fautifs,
    [],
    'un octet de contrôle brut dans la source rend le fichier invisible à `grep` — ' +
      'écris-le ÉCHAPPÉ (`\\u0000`), la valeur produite est la même'
  );
});

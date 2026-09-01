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
/**
 * Tout le `.js` que le MANIFESTE déclare livré — pas une liste de répertoires.
 *
 * `pack.json` déclare `naissance-representant/` : le module entier. `package.json`
 * ne porte aucun champ `files` qui le restreindrait. La population de cette revue
 * est donc tout ce qui part dans le paquet, y compris `hooks/` et les bancs — non
 * parce qu'ils comptent, mais parce que le manifeste les livre. Une liste écrite
 * ici, si longue soit-elle, laisserait le prochain répertoire naître hors balayage.
 */
const HORS_PAQUET = new Set(['node_modules', '.git']);

function lesSources() {
  const vus = [];
  const descendre = (ou) => {
    for (const e of readdirSync(ou, { withFileTypes: true })) {
      if (HORS_PAQUET.has(e.name)) continue;
      const chemin = join(ou, e.name);
      if (e.isDirectory()) descendre(chemin);
      else if (e.name.endsWith('.js')) vus.push(chemin);
    }
  };
  descendre(RACINE);
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

/**
 * 🔴 LA POPULATION SE DEMANDE AU MANIFESTE, PAS À UNE LISTE ÉCRITE ICI.
 *
 * `lesSources` énumérait `src` et `bin`, et son commentaire promettait « TOUTE
 * la source livrée du module ». Écart mesuré : 48 fichiers `.js` livrés que le
 * balayage ne voyait pas — dont `hooks/garde-ouverture-ligne.js`, qui est
 * lui-même une garde de sécurité, posée dans les `settings.json` distribués et
 * installée chez les clients.
 *
 * PROUVÉ PAR INJECTION, sur copie hors dépôt : un octet NUL déposé dans ce hook
 * rend le fichier illisible à `grep` (qui le déclare binaire et se tait) — et le
 * banc RESTAIT VERT. Le même octet dans `src/declaration.js` le faisait rougir.
 * Un fichier invisible à `grep` échappait donc à toute revue par recherche, dans
 * le seul répertoire que ce banc ne regardait pas.
 *
 * ⚠️ ET LA POPULATION N'EST PAS « TROIS RÉPERTOIRES AU LIEU DE DEUX ». Remplacer
 * une liste en dur par une autre laisse le même défaut : le prochain répertoire
 * ajouté au module naîtra hors balayage, en silence. La population est ce que le
 * MANIFESTE DÉCLARE LIVRÉ — `pack.json` déclare `naissance-representant/`, le
 * module entier, et `package.json` ne porte aucun champ `files` qui le
 * restreindrait. Les bancs sont donc dedans : non parce qu'ils comptent, mais
 * parce que le manifeste les livre.
 */
test('la population balayée est TOUT ce que le manifeste déclare livré', () => {
  const manifeste = JSON.parse(readFileSync(resolve(RACINE, '..', 'pack.json'), 'utf8'));
  const chemins = manifeste?.modules?.['naissance-representant']?.paths ?? [];
  assert.deepEqual(chemins, ['naissance-representant/'],
    'le manifeste a changé de forme : ce banc lit une clé qui ne décrit plus ce qui est livré');

  // Ce que npm laisse hors du paquet sans qu'on ait à le déclarer.
  const livres = [];
  const descendre = (ou) => {
    for (const e of readdirSync(ou, { withFileTypes: true })) {
      if (HORS_PAQUET.has(e.name)) continue;
      const chemin = join(ou, e.name);
      if (e.isDirectory()) descendre(chemin);
      else if (e.name.endsWith('.js')) livres.push(chemin);
    }
  };
  descendre(RACINE);

  const balayes = new Set(lesSources());
  const echappes = livres.filter((f) => !balayes.has(f)).map((f) => f.slice(RACINE.length + 1)).sort();
  assert.deepEqual(echappes, [],
    `${echappes.length} fichier(s) .js sont LIVRÉS par le manifeste et ne sont balayés par aucune ` +
    "revue de ce banc — un octet NUL y passerait sans qu'aucun `grep` ne le voie");
});

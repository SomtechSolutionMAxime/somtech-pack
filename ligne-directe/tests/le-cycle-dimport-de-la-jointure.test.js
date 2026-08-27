// LE CYCLE D'IMPORT ENTRE LA JOINTURE ET LA GARDE — éprouvé, jamais raisonné.
// (T-20260825-0012, sous E-20260825-0002, D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QUE CE BANC GARDE, ET POURQUOI UN RAISONNEMENT NE SUFFIT PAS
//
// `garde-des-naissances.js` importe `recensement.js` (`lieuDeRoleDansLeChemin`, `nomDeLAgent`).
// Depuis T-20260825-0012, `recensement.js` importe `declaration-des-agents.js`, qui importe
// `memeEspaceDeTravail` de la garde. Le graphe est donc un CYCLE, et il est délibéré : la
// jointure d'espace ne doit exister qu'à UN endroit — celui qui l'a payée (9dfad89) — et la
// recopier ferait porter à un agent le rôle et le coordonnateur d'un autre au premier correctif
// appliqué d'un seul côté.
//
// Un cycle ESM ne casse pas TANT QUE les deux côtés ne s'échangent que des DÉCLARATIONS DE
// FONCTION, qui sont hoistées avant toute évaluation. Il casse dès qu'un `const` d'un module
// est lu pendant que l'autre s'évalue encore — et les deux modules en portent (`ROLES`,
// `RETARD_DE_MESURE_OBSERVE`, `TOLERANCE_DE_DATATION_MS`, `LIBELLES_DECLARES`…).
//
// ⚠️ ET LE SENS DE LA PANNE DÉPEND DE QUI ENTRE LE PREMIER. C'est ce qui rend ce cycle
// dangereux sans être visible : la suite d'essais du recensement entre par `recensement.js`,
// celle de la garde par `garde-des-naissances.js`, et un seul des deux ordres peut rougir. Le
// jour où quelqu'un déplace une constante, le banc qu'il lance ne sera peut-être pas celui qui
// tombe. On éprouve donc les DEUX ordres, dans des processus SÉPARÉS — un `import()` dans le
// même processus rendrait le module déjà chargé par le banc précédent, et ne mesurerait rien.
//
// 📌 LE VRAI CORRECTIF EST AILLEURS, ET IL EST REMONTÉ : `memeEspaceDeTravail` ne dépend que de
// `realpathSync` — c'est une feuille garée chez la garde. La sortir dans son propre module
// romprait le cycle sans rien dupliquer. `naissance-representant/` est le lot d'un autre agent,
// en cours de revue ; ce banc tient la propriété en attendant que ce déménagement soit possible.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RECENSEMENT = join(ICI, '..', 'src', 'recensement.js');
const JOINTURE = join(ICI, '..', 'src', 'declaration-des-agents.js');
const GARDE = join(ICI, '..', '..', 'naissance-representant', 'src', 'garde-des-naissances.js');

/**
 * Entre par UN module, dans un processus NEUF, et rend ce qu'il en obtient.
 *
 * ⚠️ `execFileSync` JETTE sur une sortie non nulle : un `ReferenceError: Cannot access '…'
 * before initialization` — la panne exacte d'un cycle mal formé — fait donc rougir le banc avec
 * son message, plutôt que de rendre une chaîne vide qu'une assertion faible laisserait passer.
 */
function parLaPorte(module, expression) {
  return execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `const m = await import(${JSON.stringify(module)}); process.stdout.write(String(${expression}));`],
    { encoding: 'utf8' }
  );
}

test('entrer par le recensement charge la chaîne entière', () => {
  assert.equal(parLaPorte(RECENSEMENT, 'typeof m.unRecensement'), 'function');
});

test('entrer par la garde charge la chaîne entière, constantes comprises', () => {
  // ⚠️ ON LIT UNE CONSTANTE, PAS SEULEMENT UNE FONCTION. Les fonctions sont hoistées : les
  // interroger seules rendrait ce banc vert sur un cycle qui casse en production. Les `const`
  // sont ce qui tombe, et `TOLERANCE_DE_DATATION_MS` est lue par la garde à chaque tour.
  assert.equal(parLaPorte(GARDE, 'm.TOLERANCE_DE_DATATION_MS'), String(60 * 60 * 1000));
});

test('entrer par la jointure charge la chaîne entière, table des libellés comprise', () => {
  // `LIBELLES_DECLARES` est un `const` du module de jointure, lu par `libellesDuRoleDeclare` :
  // si le cycle le laissait dans sa zone morte, cet appel jetterait au lieu de rendre un nom.
  assert.equal(parLaPorte(JOINTURE, "m.libellesDuRoleDeclare('chef-equipe').libelle"), 'chef d’équipe');
});

test('la jointure d’espace du recensement EST celle de la garde, pas une copie', async () => {
  const jointure = await import(JOINTURE);
  const garde = await import(GARDE);
  // ⚠️ ON COMPARE UN COMPORTEMENT QUE SEULE LA VRAIE FONCTION A. Vérifier que le module
  // l'importe (par un grep, ou en comparant deux références) prouve un CÂBLAGE ; ceci prouve la
  // RÈGLE — le séparateur fait la frontière, jamais le préfixe. Une copie écrite à la main dans
  // la jointure passerait le premier contrôle et tomberait sur celui-ci dès qu'elle diverge.
  const espace = '/Users/qui/worktrees/depot/20260827-000000';
  assert.equal(garde.memeEspaceDeTravail(`${espace}-bis`, espace), false);
  assert.equal(garde.memeEspaceDeTravail(`${espace}/ligne-directe`, espace), true);
  // Et la jointure rend le même verdict, sur le même couple, à travers son propre appariement.
  const declaration = { nom: 'a', role: 'chef-equipe', espace, pane: 'w1:p1', session_herdr: 'somtech' };
  const nom = { mesure: 'lu', valeur: 'a' };
  assert.equal(
    jointure.declarationDeLAgent({ pane: 'w9:p9', session: 'somtech', espace: `${espace}-bis`, nom }, [declaration]),
    null
  );
  assert.equal(
    jointure.declarationDeLAgent({ pane: 'w9:p9', session: 'somtech', espace: `${espace}/ligne-directe`, nom }, [declaration]),
    declaration
  );
});

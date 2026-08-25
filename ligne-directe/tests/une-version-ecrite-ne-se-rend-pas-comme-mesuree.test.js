// UNE VERSION ÉCRITE NE SE REND PAS COMME MESURÉE (E-20260825-0006).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE BANC GARDE
//
// `travailEnVol` rendait, SOUS un objet qui déclare `mesure: 'lue'`, un champ `rendu` valant
// « Claude Code v2.1.235 (mesuré le 2026-08-19) ». Trois faits, mesurés le 2026-08-25 :
//
//   1. la valeur est ÉCRITE EN DUR — rien ne l'a jamais remesurée ;
//   2. le poste tourne réellement sur `2.1.245` (`claude --version` → « 2.1.245 (Claude Code) ») ;
//   3. le `mesure: 'lue'` qui la chapeaute porte sur l'ÉCRAN qu'on a lu, pas sur la version.
//
// Le lecteur du recensement lisait donc « mesuré le 2026-08-19 » comme une mesure du poste. C'est
// exactement ce que la règle de conduite du module interdit : « ce registre MESURE et REND, il ne
// PRÉSUME jamais ». Soit on mesure la version réelle, soit on dit qu'on ne la connaît pas —
// jamais une valeur lue habillée en mesurée.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE BANC N'ÉPROUVE PAS UNE CHAÎNE, IL ÉPROUVE UNE FONCTION
//
// Chercher le mot « mesuré » dans le rendu prouverait qu'un mot est là, jamais qu'une fonction
// est servie : il suffirait de renommer le libellé pour le mettre au vert sans rien réparer.
// Ce banc parcourt donc TOUT le rendu, y relève chaque estampille de version, et exige de chacune
// qu'elle porte une PROVENANCE — et qu'une provenance « lue » soit adossée à une mesure qui a
// réellement eu lieu. La garde survit au renommage du champ, et attrape n'importe quelle
// réintroduction d'un numéro écrit sous une étiquette de mesure.
//
// ⚠️ ET IL GARDE L'AUTRE CÔTÉ DE LA FRONTIÈRE. Un correctif qui rendrait tout « inconnu » serait
// aussi faux que le défaut : ce qui est réellement mesuré — l'écran lu, les shells, les
// sous-agents — doit continuer d'être rendu comme mesuré, jusque dans `unRecensement`.
//
// ⚠️ ET IL ÉPROUVE « QUAND ON NE PEUT PAS VOIR », pas seulement « quand il n'y a rien ». Une
// sonde de version qui JETTE, ou qui rend une réponse sans numéro, ne doit jamais faire retomber
// le rendu sur la valeur d'étalonnage : ce serait la présomption, déguisée en repli prudent.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { travailEnVol, unRecensement, ETALONNAGE_DU_LECTEUR } from '../src/recensement.js';

// Les deux écrans réels, repris du banc voisin (relevés sur un même agent avant/après travail).
const ECRAN_AU_REPOS = '  ⏸ manual mode on · ? for shortcuts · ← for agents';
const ECRAN_EN_VOL =
  '  ⏸ manual mode on · 1 shell · /tasks to see subagents · ← for agents · ↓ to manage';

// La version RÉELLE du poste au jour où ce banc est écrit — mesurée, pas supposée :
//   $ claude --version
//   2.1.245 (Claude Code)
const SORTIE_REELLE_DE_CLAUDE_VERSION = '2.1.245 (Claude Code)\n';

// ⚠️ PAS DE `\b` DEVANT LE PREMIER CHIFFRE, ET C'EST MESURÉ. Avec `/\b\d+\.\d+\.\d+\b/`, cette
// garde rendait VERT sur le défaut lui-même : dans « v2.1.235 », `v` et `2` sont tous deux des
// caractères de mot, il n'y a donc aucune frontière entre eux et l'estampille n'était jamais
// relevée. Une assertion trop faible sur un chemin correct — éprouvé contre le code fautif avant
// correctif, et c'est ce qui a fait rougir.
//
// ⚠️ ET LA DATE COMPTE AUTANT QUE LE NUMÉRO. « mesuré le 2026-08-19 » est la moitié du mensonge.
const EMPREINTE_DE_VERSION = /\d+\.\d+\.\d+|\d{4}-\d{2}-\d{2}/;

/**
 * Relève, dans un rendu quelconque, CHAQUE estampille de version et la provenance sous laquelle
 * elle voyage. La provenance d'une valeur est le `mesure` de l'objet le plus proche qui en
 * déclare un — c'est exactement la lecture que fait un humain qui parcourt le rendu.
 */
function estampillesDeVersion(noeud, provenance = null, chemin = '$', trouvees = []) {
  if (noeud === null || noeud === undefined) return trouvees;
  if (typeof noeud !== 'object') {
    if (typeof noeud === 'string' && EMPREINTE_DE_VERSION.test(noeud)) {
      trouvees.push({ chemin, valeur: noeud, provenance });
    }
    return trouvees;
  }
  const ici = typeof noeud.mesure === 'string' ? noeud.mesure : provenance;
  for (const [cle, valeur] of Object.entries(noeud)) {
    if (cle === 'mesure') continue;
    estampillesDeVersion(valeur, ici, `${chemin}.${cle}`, trouvees);
  }
  return trouvees;
}

/**
 * L'INVARIANT. Aucune estampille de version ne voyage sous une provenance de mesure si elle ne
 * correspond pas à une version RÉELLEMENT mesurée dans ce rendu.
 *
 * `mesureesReellement` est vide quand aucune sonde n'a été branchée : dans ce cas, toute
 * estampille sous `mesure: 'lue'` est une violation, par construction.
 */
function aucuneVersionEcriteHabilleeEnMesuree(rendu, mesureesReellement = []) {
  for (const e of estampillesDeVersion(rendu)) {
    if (e.provenance !== 'lue') continue;
    const adossee = mesureesReellement.some((v) => e.valeur.includes(v));
    assert.ok(
      adossee,
      `${e.chemin} porte l’estampille « ${e.valeur} » sous une provenance « lue », alors que ` +
        `les seules versions réellement mesurées ici sont [${mesureesReellement.join(', ') || '—'}]`
    );
  }
}

test('(a) le rendu ne présente JAMAIS la version d’étalonnage comme si elle venait d’être mesurée', () => {
  // Aucune sonde de version n'est branchée : RIEN n'a été mesuré de la version du poste. Toute
  // estampille de version sous une provenance de mesure est donc, ici, un mensonge de rendu.
  const vu = travailEnVol(ECRAN_EN_VOL);
  aucuneVersionEcriteHabilleeEnMesuree(vu, []);

  // ⚠️ ET LA VALEUR ÉCRITE SE DÉCLARE COMME TELLE, sans que le lecteur ait à lire ce fichier.
  assert.equal(
    vu.etalonnage.mesure,
    'constante',
    'l’étalonnage du lecteur d’écran est une valeur ÉCRITE, et son rendu doit le dire'
  );
  assert.equal(vu.etalonnage.version, ETALONNAGE_DU_LECTEUR.version);

  // ⚠️ ET LA FONCTION DE LA CONSTANTE SURVIT — c'est la raison pour laquelle elle existe : relier
  // un futur faux négatif silencieux de `travailEnVol` à un changement de version. Sans sonde on
  // ne peut RIEN en conclure ; avec une sonde qui rend autre chose, l'étalonnage est dépassé.
  assert.equal(vu.etalonnageDepasse, null, 'sans mesure, on ne conclut ni « dépassé » ni « à jour »');

  const depasse = travailEnVol(ECRAN_EN_VOL, {
    versionCourante: () => SORTIE_REELLE_DE_CLAUDE_VERSION,
  });
  assert.equal(
    depasse.etalonnageDepasse,
    true,
    `le poste tourne sur 2.1.245 et l’étalonnage vaut ${ETALONNAGE_DU_LECTEUR.version} : ` +
      'le lecteur doit être averti que ce qu’il lit n’a pas été étalonné sur cette version-là'
  );

  const aJour = travailEnVol(ECRAN_EN_VOL, {
    versionCourante: () => `${ETALONNAGE_DU_LECTEUR.version} (Claude Code)`,
  });
  assert.equal(aJour.etalonnageDepasse, false, 'et il ne crie pas au loup quand les deux concordent');
});

test('(b) ce qui EST mesuré continue d’être rendu comme mesuré — l’écran, les shells, les sous-agents', async () => {
  // La frontière, côté mesure. Un correctif qui rendrait tout « inconnu » serait aussi faux que
  // le défaut qu'il prétend réparer.
  const vu = travailEnVol(ECRAN_EN_VOL);
  assert.equal(vu.mesure, 'lue', 'l’écran, lui, a bel et bien été LU');
  assert.equal(vu.shells, 1);
  assert.equal(vu.sousAgents, true);
  assert.equal(vu.occupe, false);
  assert.equal(vu.enVol, true);

  const repos = travailEnVol(ECRAN_AU_REPOS);
  assert.equal(repos.mesure, 'lue');
  assert.equal(repos.shells, 0);
  assert.equal(repos.enVol, false, 'lu et vide n’est pas « je ne sais pas »');

  // ⚠️ ET LA MESURE DE VERSION, QUAND ELLE A LIEU, SE DIT MESURÉE. C'est l'autre bord : le
  // correctif ne doit pas rendre la mesure réelle indistinguable de l'étalonnage écrit.
  const sonde = travailEnVol(ECRAN_EN_VOL, {
    versionCourante: () => SORTIE_REELLE_DE_CLAUDE_VERSION,
  });
  assert.equal(sonde.versionDuPoste.mesure, 'lue');
  assert.equal(sonde.versionDuPoste.version, '2.1.245');
  aucuneVersionEcriteHabilleeEnMesuree(sonde, ['2.1.245']);

  // ⚠️ ET LA JOINTURE EST GARDÉE, PAS SEULEMENT L'ÉTAGE. `travailEnVol` peut être irréprochable
  // pendant que `unRecensement` rend autre chose : c'est le rendu du recensement que lit le
  // registre, et c'est donc lui qu'on éprouve.
  const rendu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: '/d/.orchestrateur/p-1' }],
    lireEcran: () => ECRAN_EN_VOL,
  });
  const enVol = rendu.agents[0].travailEnVol;
  assert.equal(enVol.mesure, 'lue', 'le recensement LIT l’écran et le dit');
  assert.equal(enVol.enVol, true);
  aucuneVersionEcriteHabilleeEnMesuree(rendu, []);
});

test('(c) quand la version réelle ne se laisse PAS établir, le rendu le dit — et ne présume rien', () => {
  // ⚠️ « ON NE PEUT PAS VOIR » N'EST PAS « IL N'Y A RIEN ». La sonde branchée qui JETTE est le cas
  // réel : `claude` introuvable, poste sans droit d'exécution, sortie coupée.
  const jette = travailEnVol(ECRAN_EN_VOL, {
    versionCourante: () => {
      throw new Error('spawn claude ENOENT');
    },
  });
  assert.equal(jette.versionDuPoste.mesure, 'refusée');
  assert.equal(jette.versionDuPoste.version, null, 'null, jamais un repli sur l’étalonnage');
  assert.match(jette.versionDuPoste.raison, /ENOENT/, 'la raison du refus voyage avec le refus');
  assert.equal(jette.etalonnageDepasse, null, 'aucune comparaison n’a eu lieu : on n’en conclut rien');
  aucuneVersionEcriteHabilleeEnMesuree(jette, []);

  // La sonde qui RÉPOND, mais sans numéro — une réponse illisible n'est pas une version.
  const muette = travailEnVol(ECRAN_EN_VOL, { versionCourante: () => 'command not found' });
  assert.equal(muette.versionDuPoste.mesure, 'refusée');
  assert.equal(muette.versionDuPoste.version, null);
  assert.equal(muette.etalonnageDepasse, null);

  // Et le défaut de l'injection : AUCUNE sonde. Ce n'est ni « lue » ni « refusée » — c'est
  // « non mesurée », et ça se distingue, parce que les deux appellent des gestes différents.
  const sansSonde = travailEnVol(ECRAN_EN_VOL);
  assert.equal(sansSonde.versionDuPoste.mesure, 'non mesurée');
  assert.equal(sansSonde.versionDuPoste.version, null);
  assert.ok(sansSonde.versionDuPoste.raison, 'et elle dit POURQUOI elle n’a pas mesuré');
  assert.notEqual(
    sansSonde.versionDuPoste.mesure,
    'refusée',
    '« on ne m’a rien donné » n’est pas « j’ai essayé et ça a raté »'
  );
});

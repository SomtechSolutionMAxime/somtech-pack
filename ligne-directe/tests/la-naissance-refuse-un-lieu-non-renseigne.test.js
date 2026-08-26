// la-naissance-refuse-un-lieu-non-renseigne.test.js — le VERDICT, et ce que la naissance en
// fait. Les essais du module pur vivent à côté (`un-lieu-reste-au-gabarit-…`) ; ceux-ci
// éprouvent la lecture réelle des deux fichiers, sur un disque.
//
// ⚠️ CE QUI EST GARDÉ ICI N'EST PAS UN MESSAGE, C'EST UN EFFET : chaque essai de refus vérifie
// que le verdict porte `renseigne: false`, jamais seulement qu'un texte contient un mot. Un
// refus se prouve par ce qu'il EMPÊCHE.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  verifierLieuRenseigne,
  FICHIERS_A_RENSEIGNER,
} from '../src/lieu-renseigne.js';

const GABARIT_CONTEXTE = [
  '# Ce qui est propre à ce dépôt',
  '',
  '## À qui tu réponds',
  '',
  '| **Le destinataire** | `<qui décide sur ce dépôt — le dirigeant, ou quelqu’un d’autre>` |',
  '',
  '## Ta portée',
  '',
  '`<Le chantier dont tu réponds : son code au registre — D-…, P-… ou J-…>`',
].join('\n');

const GABARIT_RONDE = [
  '# Le briefing de ta ronde',
  '',
  '`<Un tour toutes les combien de minutes.>`',
].join('\n');

/** Un dépôt jetable qui porte un gabarit et un lieu. Rendu avec de quoi le défaire. */
function bancDEssai({ contexteDuLieu, rondeDuLieu = null, rondeAuGabarit = false }) {
  const racineTmp = mkdtempSync(join(tmpdir(), 'lieu-renseigne-'));
  const gabaritDir = join(racineTmp, '.claude', 'templates', 'orchestrateur');
  const lieu = join(racineTmp, '.orchestrateur', 'essai');
  mkdirSync(gabaritDir, { recursive: true });
  mkdirSync(lieu, { recursive: true });
  writeFileSync(join(gabaritDir, 'CONTEXTE.md'), GABARIT_CONTEXTE);
  if (rondeAuGabarit) writeFileSync(join(gabaritDir, 'RONDE.md'), GABARIT_RONDE);
  if (contexteDuLieu !== null) writeFileSync(join(lieu, 'CONTEXTE.md'), contexteDuLieu);
  if (rondeDuLieu !== null) writeFileSync(join(lieu, 'RONDE.md'), rondeDuLieu);
  return { racineTmp, gabaritDir, lieu, defaire: () => rmSync(racineTmp, { recursive: true, force: true }) };
}

/** Un contexte pleinement renseigné, pour isoler ce qu'un autre fichier reproche. */
const CONTEXTE_REMPLI = GABARIT_CONTEXTE
  .replace('`<qui décide sur ce dépôt — le dirigeant, ou quelqu’un d’autre>`', '**Maxime Leboeuf**, le dirigeant')
  .replace('`<Le chantier dont tu réponds : son code au registre — D-…, P-… ou J-…>`', 'P-20260819-0001.');

test('un lieu dont le contexte est resté au gabarit intégral est REFUSÉ', () => {
  const b = bancDEssai({ contexteDuLieu: GABARIT_CONTEXTE });
  try {
    const v = verifierLieuRenseigne({ gabaritDir: b.gabaritDir, racine: b.lieu });
    assert.equal(v.renseigne, false);
    assert.equal(v.intact, true, 'personne n’a touché le fichier — ça se dit à part');
    assert.equal(v.manquant.length, 1);
    assert.equal(v.manquant[0].fichier, 'CONTEXTE.md');
    assert.equal(v.manquant[0].rubriques.length, 2);
  } finally { b.defaire(); }
});

test('un lieu pleinement renseigné PASSE', () => {
  const rempli = GABARIT_CONTEXTE
    .replace('`<qui décide sur ce dépôt — le dirigeant, ou quelqu’un d’autre>`', '**Maxime Leboeuf**, le dirigeant')
    .replace('`<Le chantier dont tu réponds : son code au registre — D-…, P-… ou J-…>`', 'P-20260819-0001.');
  const b = bancDEssai({ contexteDuLieu: rempli });
  try {
    const v = verifierLieuRenseigne({ gabaritDir: b.gabaritDir, racine: b.lieu });
    assert.equal(v.renseigne, true);
    assert.deepEqual(v.manquant, []);
  } finally { b.defaire(); }
});

// ⚠️ L'ESSAI QUI COMPTE LE PLUS : la garde ne doit pas refuser un lieu en règle.
test('un lieu renseigné dont la prose porte des chevrons LIBRES passe', () => {
  const rempli = [
    '# Ce qui est propre à ce dépôt',
    '',
    '## À qui tu réponds',
    '',
    '| **Le destinataire** | **Maxime Leboeuf**, le dirigeant |',
    '',
    '## Ta portée',
    '',
    'D-20260819-0002 — la reprise du site. Déploiement : `fly deploy -a <app> --build-secret github_token=<PAT>`.',
  ].join('\n');
  const b = bancDEssai({ contexteDuLieu: rempli });
  try {
    assert.equal(verifierLieuRenseigne({ gabaritDir: b.gabaritDir, racine: b.lieu }).renseigne, true);
  } finally { b.defaire(); }
});

test('un lieu à demi rempli est refusé, et ne nomme QUE ce qui reste', () => {
  const moitie = GABARIT_CONTEXTE.replace(
    '`<qui décide sur ce dépôt — le dirigeant, ou quelqu’un d’autre>`',
    '**Maxime Leboeuf**, le dirigeant',
  );
  const b = bancDEssai({ contexteDuLieu: moitie });
  try {
    const v = verifierLieuRenseigne({ gabaritDir: b.gabaritDir, racine: b.lieu });
    assert.equal(v.renseigne, false);
    assert.equal(v.intact, false, 'le fichier a été touché — ce n’est pas le même cas');
    assert.equal(v.manquant[0].rubriques.length, 1);
    assert.ok(v.manquant[0].rubriques[0].includes('Le chantier dont tu réponds'));
  } finally { b.defaire(); }
});

// ⚠️ UNE MESURE IMPOSSIBLE NE REFUSE JAMAIS — la branche qui empêche cette garde de crier à
// tort sur un lieu posé par une version qui ne portait pas ce gabarit.
test('un gabarit introuvable ne refuse RIEN, et le dit', () => {
  const b = bancDEssai({ contexteDuLieu: GABARIT_CONTEXTE });
  try {
    const v = verifierLieuRenseigne({ gabaritDir: join(b.racineTmp, 'nulle-part'), racine: b.lieu });
    assert.equal(v.renseigne, true, 'ce qu’on n’a pas su mesurer ne refuse pas');
    assert.equal(v.verifie, false);
    assert.ok(typeof v.raison === 'string' && v.raison.length > 0, 'la mesure impossible se DIT');
  } finally { b.defaire(); }
});

test('un fichier absent du lieu ne refuse RIEN — c’est la pose qui juge la présence, pas cette garde', () => {
  const b = bancDEssai({ contexteDuLieu: null });
  try {
    const v = verifierLieuRenseigne({ gabaritDir: b.gabaritDir, racine: b.lieu });
    assert.equal(v.renseigne, true);
    assert.equal(v.verifie, false);
  } finally { b.defaire(); }
});

test('le message de refus nomme le fichier, les rubriques et le geste qui débloque', () => {
  const b = bancDEssai({ contexteDuLieu: GABARIT_CONTEXTE });
  try {
    const { message } = verifierLieuRenseigne({ gabaritDir: b.gabaritDir, racine: b.lieu });
    assert.ok(message.includes('CONTEXTE.md'), 'le fichier');
    assert.ok(message.includes('qui décide sur ce dépôt'), 'la rubrique restée, citée');
    assert.ok(message.includes(b.lieu), 'où il est');
    // Aucune commande destructrice ne se met dans la bouche de qui lit un refus.
    for (const interdit of ['rm ', 'rm -rf', 'git reset', 'git checkout --']) {
      assert.ok(!message.includes(interdit), `le refus ne propose jamais « ${interdit} »`);
    }
  } finally { b.defaire(); }
});

// La liste des fichiers à renseigner se DÉRIVE de ce que la mise à jour préserve : deux listes
// qui disent la même chose divergent au premier correctif. Le miroir est gardé côté CLI
// (`cli/test/`), mais on épingle ici que la liste n'est pas vide — une liste vidée
// désarmerait la garde entière sans qu'un seul essai ne rougisse.
test('la liste des fichiers à renseigner n’est pas vide', () => {
  assert.ok(FICHIERS_A_RENSEIGNER.length >= 1);
  assert.ok(FICHIERS_A_RENSEIGNER.includes('CONTEXTE.md'));
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LA SECONDE ENTRÉE DE `FICHIERS_A_RENSEIGNER` N'ÉTAIT EXERCÉE PAR AUCUN ESSAI.
//
// Tous les essais ci-dessus n'écrivent qu'un `CONTEXTE.md` : `RONDE.md` était absent des deux
// côtés, donc compté parmi les fichiers qu'on n'a pas su mesurer. La boucle aurait pu traiter
// son second tour de travers — ne jamais le lire, écraser le verdict du premier, ne nommer que
// le dernier — sans qu'un seul essai rougisse. Un contrôle qui ne se déclenche jamais ne garde
// rien, et c'est le motif qui a coûté le plus cher à ce dépôt.

test('le briefing resté au gabarit fait refuser, MÊME quand le contexte est rempli', () => {
  const b = bancDEssai({ contexteDuLieu: CONTEXTE_REMPLI, rondeDuLieu: GABARIT_RONDE, rondeAuGabarit: true });
  try {
    const v = verifierLieuRenseigne({ gabaritDir: b.gabaritDir, racine: b.lieu });
    assert.equal(v.renseigne, false, 'un lieu sans ronde renseignée n’est pas prêt');
    assert.equal(v.manquant.length, 1, 'seul le briefing est en cause');
    assert.equal(v.manquant[0].fichier, 'RONDE.md');
    assert.match(v.message, /RONDE\.md/, 'le message nomme le fichier en cause, pas l’autre');
    assert.ok(!/qui décide sur ce dépôt/.test(v.message), 'le contexte rempli n’est pas reproché');
  } finally { b.defaire(); }
});

test('les DEUX fichiers restés au gabarit sont nommés — le second n’écrase pas le premier', () => {
  const b = bancDEssai({ contexteDuLieu: GABARIT_CONTEXTE, rondeDuLieu: GABARIT_RONDE, rondeAuGabarit: true });
  try {
    const v = verifierLieuRenseigne({ gabaritDir: b.gabaritDir, racine: b.lieu });
    assert.equal(v.renseigne, false);
    assert.deepEqual(v.manquant.map((m) => m.fichier).sort(), ['CONTEXTE.md', 'RONDE.md']);
    assert.match(v.message, /CONTEXTE\.md/);
    assert.match(v.message, /RONDE\.md/);
  } finally { b.defaire(); }
});

test('les deux renseignés : rien à reprocher', () => {
  const b = bancDEssai({
    contexteDuLieu: CONTEXTE_REMPLI,
    rondeDuLieu: '# Le briefing de ta ronde\n\nUn tour toutes les 20 minutes.\n',
    rondeAuGabarit: true,
  });
  try {
    assert.equal(verifierLieuRenseigne({ gabaritDir: b.gabaritDir, racine: b.lieu }).renseigne, true);
  } finally { b.defaire(); }
});

test('la liste porte bien les DEUX fichiers écrits à la main', () => {
  assert.deepEqual([...FICHIERS_A_RENSEIGNER].sort(), ['CONTEXTE.md', 'RONDE.md']);
});

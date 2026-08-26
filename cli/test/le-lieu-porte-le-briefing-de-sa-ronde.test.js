// le-lieu-porte-le-briefing-de-sa-ronde.test.js — le CINQUIÈME élément du cycle.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CES ESSAIS FERMENT (T-20260826-0042)
//
// Le cycle arbitré par le CTO le 2026-08-24 nomme CINQ choses qu'un lieu de naissance porte :
// `CLAUDE.md` rendu · `CONTEXTE.md` · `.claude/` (droits) · `.mcp.json` · **le briefing de la
// ronde**. Le geste de pose n'en connaissait que QUATRE.
//
// Mesuré le 2026-08-26 : le mot `loop` n'apparaissait nulle part dans le code de pose ni de
// naissance, et DIX-SEPT lieux vivants sur dix-huit n'avaient aucun briefing de ronde. Le seul
// qui en portait un l'avait écrit à la main dans son `CONTEXTE.md` — il n'était pas venu du
// gabarit.
//
// Ce que ça coûte est dans le métier lui-même : la ronde est « le seul outil dont l'absence est
// MUETTE ». Un agent né sans elle ne se réveille jamais, et rien ne le signale.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ CES ESSAIS ONT ÉTÉ ÉPROUVÉS PAR MUTATION, PAS SEULEMENT ÉCRITS. Un essai qui n'a jamais
// été rouge n'a jamais rien testé — et celui-ci porte sur des fichiers qui existent déjà au
// moment où on l'écrit, donc il serait vert d'emblée. Chaque assertion a été vérifiée en
// retirant ce qu'elle garde (le fichier, l'entrée de `PRESERVE`) et en constatant le rouge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRIEFING = 'RONDE.md';

/** Les deux rôles dont le pack distribue un gabarit, et le dossier de chacun. */
const ROLES = [
  { role: 'orchestrateur', gabarit: 'orchestrateur' },
  { role: 'représentant', gabarit: 'gestionnaire-client' },
];

/**
 * LES CINQ ÉLÉMENTS DU CYCLE, énumérés ici parce que c'est ce qui est OPPOSABLE — la décision
 * du 2026-08-24 (`project_decisions` de P-20260819-0001), citée mot pour mot :
 * « LIEU DE NAISSANCE versé, avec TOUS les fichiers : CLAUDE.md (métier rendu) · CONTEXTE.md ·
 *   .claude/ (droits) · .mcp.json · briefing /loop ».
 */
const CINQ_ELEMENTS = ['CLAUDE.md', 'CONTEXTE.md', join('.claude', 'settings.json'), '.mcp.json', BRIEFING];

for (const { role, gabarit } of ROLES) {
  const dossier = join(RACINE, '.claude', 'templates', gabarit);

  test(`le gabarit du ${role} porte les CINQ éléments du cycle`, () => {
    for (const element of CINQ_ELEMENTS) {
      assert.ok(
        existsSync(join(dossier, element)),
        `le gabarit du ${role} ne porte pas « ${element} » — le cycle en exige cinq, pas quatre`,
      );
    }
  });

  test(`le briefing du ${role} est un gabarit À REMPLIR, pas un texte figé`, () => {
    const texte = readFileSync(join(dossier, BRIEFING), 'utf8');
    const chevrons = [...texte.matchAll(/<[^<>\n]+>/g)].filter(([c]) => !c.startsWith('<!--'));
    assert.ok(
      chevrons.length >= 3,
      `le briefing du ${role} ne porte que ${chevrons.length} rubrique(s) à remplir — un briefing ` +
        `qui ne demande rien de propre au chantier ne porte aucune continuité`,
    );
  });

  test(`le briefing du ${role} dit qu'il lui appartient et que le pack n'y touche pas`, () => {
    const texte = readFileSync(join(dossier, BRIEFING), 'utf8');
    assert.match(
      texte,
      /écrit à la main/,
      `le briefing du ${role} ne dit pas qu'il est écrit à la main — un agent qui l'ignore n'osera ` +
        `pas le remplir, ou le croira remplacé à la prochaine mise à jour`,
    );
  });

  test(`le briefing du ${role} nomme sa cadence — ce qui se pose à la naissance, pas en route`, () => {
    const texte = readFileSync(join(dossier, BRIEFING), 'utf8');
    assert.match(texte, /cadence/i, `le briefing du ${role} ne parle pas de sa cadence`);
  });
}

// ⚠️ SANS CET ESSAI, LE BRIEFING SERAIT ÉCRASÉ À CHAQUE MISE À JOUR D'UN LIEU. Il porte le
// chantier de l'agent, pas le métier du pack : la convergence ne doit jamais le voir passer.
// C'est exactement ce que `PRESERVE` garantit pour `CONTEXTE.md` depuis RA-REL-014.
test('la mise à jour d’un lieu PRÉSERVE le briefing de ronde', async () => {
  const { PRESERVE } = await import('../src/commands/representant.js');
  assert.ok(
    PRESERVE.includes(BRIEFING),
    `« ${BRIEFING} » n'est pas préservé : la mise à jour d'un lieu écraserait le briefing que son ` +
      `agent a rempli, et il ne s'en apercevrait qu'en ne se réveillant plus`,
  );
});

// ⚠️ DEUX LISTES QUI DISENT LA MÊME CHOSE DIVERGENT AU PREMIER CORRECTIF — ce dépôt l'a déjà
// payé. `PRESERVE` (ce que la mise à jour ne touche pas) et `FICHIERS_A_RENSEIGNER` (ce que la
// naissance exige d'avoir été rempli) désignent le même ensemble : les fichiers écrits à la
// main. Elles vivent dans deux paquets qui ne peuvent pas s'importer en production — le CLI
// publié n'embarque pas `ligne-directe/` — mais un ESSAI, lui, tourne dans le dépôt et peut
// les confronter. Même mécanique que `fraicheur-gabarit-miroir.test.js`.
test('« ce que la mise à jour préserve » et « ce que la naissance exige rempli » sont le MÊME ensemble', async () => {
  const { PRESERVE } = await import('../src/commands/representant.js');
  const { FICHIERS_A_RENSEIGNER } = await import('../../ligne-directe/src/lieu-renseigne.js');
  assert.deepEqual(
    [...PRESERVE].sort(),
    [...FICHIERS_A_RENSEIGNER].sort(),
    'les deux listes ont divergé : un fichier écrit à la main serait soit écrasé par une mise à ' +
      'jour, soit jamais exigé à la naissance — et personne ne le verrait',
  );
});

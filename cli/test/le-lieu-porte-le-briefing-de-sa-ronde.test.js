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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// La table RÉELLE des rôles dont le CLI sait rafraîchir le lieu, importée — jamais recopiée.
// Une seconde copie ici se déphaserait de la première au premier rôle ajouté, et la garde
// deviendrait verte sur une population périmée.
import { ROLES as REGISTRE_DU_CLI } from '../src/commands/representant.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRIEFING = 'RONDE.md';

/**
 * LE DÉNOMINATEUR DE CE FICHIER — MESURÉ, PLUS ÉCRIT À LA MAIN (T-20260826-0083).
 *
 * Il valait `[{orchestrateur}, {représentant}]`, en toutes lettres. Mesuré le 2026-08-26 : un
 * TROISIÈME rôle déposé sous `metier/developpeur/`, réellement rendu et distribué dans
 * `.claude/templates/developpeur/` mais SANS `RONDE.md`, SANS `CONTEXTE.md` et SANS `.mcp.json`
 * — trois des cinq éléments du cycle manquants — laissait les DIX contrôles de ce fichier au
 * vert. Le rôle n'était pas dans la liste, donc rien ne regardait son lieu. Un agent posé
 * dessus serait né sans briefing de ronde, et l'absence d'une ronde est MUETTE : il ne se
 * réveille jamais, et rien ne le signale. C'est exactement le défaut que ce fichier ferme, resté
 * ouvert pour tout rôle qu'on n'avait pas pensé à écrire ici.
 *
 * ⚠️ LA POPULATION EST L'UNION DE DEUX DÉCLARATIONS, ET C'EST MESURÉ :
 *
 *   • le REGISTRE du CLI (`ROLES` de `src/commands/representant.js`) → les rôles dont un lieu
 *     se pose et se rafraîchit, par leur nom de gabarit ;
 *   • `metier/*` → les rôles dont un métier est rendu, donc distribué à un gabarit.
 *
 * Prendre l'un seul laisserait un trou dans le sens de l'autre : un rôle rendu mais pas encore
 * inscrit au registre, ou inscrit mais pas encore rendu, est PRÉCISÉMENT l'état d'un rôle en
 * cours de naissance — celui des neuf rôles arbitrés (P-20260819-0001). L'union rougit dans les
 * deux sens.
 *
 * ⚠️ ET `bootstrap` EN SORT PAR SA NATURE, JAMAIS PAR SON NOM. Énumérer `.claude/templates/*`
 * rendrait TROIS répertoires (mesuré) : `bootstrap` s'y ajoute, alors qu'il est un gabarit de
 * sources de vérité — le lieu de personne, sans métier rendu ni entrée au registre. L'écarter
 * demanderait une liste d'exceptions, et une liste d'exceptions se désarme par un geste qui
 * ressemble à de l'entretien. Ici il n'est déclaré nulle part comme rôle : il n'entre pas.
 */
function gabaritsDeRole(racine) {
  const duRegistre = Object.values(REGISTRE_DU_CLI).map((r) => r.gabarit);
  const base = join(racine, 'metier');
  const rendus = existsSync(base)
    ? readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  const gabarits = [...new Set([...duRegistre, ...rendus])].sort();
  return {
    gabarits,
    raison: gabarits.length
      ? null
      : `le registre du CLI est vide et « ${base} » ne porte aucun sous-dossier de rôle`,
  };
}

const { gabarits: ROLES, raison: RIEN_TROUVE } = gabaritsDeRole(RACINE);

test('🔴 le dénominateur de ce fichier est MESURÉ, et il n’est pas vide', () => {
  // ⚠️ SANS CE CONTRÔLE, LA GARDE SE DÉSARME TOUTE SEULE. Les contrôles ci-dessous vivent dans
  // une boucle `for (const gabarit of ROLES)` : si l’énumération rend une liste VIDE — registre
  // vidé, `metier/` déplacé ou renommé — la boucle n’enregistre AUCUN test et le fichier passe
  // au vert en n’ayant rien mesuré. « Un test qui attend RIEN ne peut pas distinguer *rien
  // trouvé* de *rien cherché* » (feed du 2026-08-25). Celui-ci fait la différence, et il rougit
  // du côté de « rien cherché ».
  assert.equal(RIEN_TROUVE, null,
    `l’énumération des gabarits de rôle n’a rien rendu : ${RIEN_TROUVE}. Les contrôles du cycle `
    + 'sont alors muets — ils ne sont pas verts, ils n’existent pas.');
  assert.ok(ROLES.length > 0, 'aucun gabarit de rôle énuméré — voir le message ci-dessus');
  console.log(`  → dénominateur mesuré (registre du CLI ∪ metier/) : ${ROLES.join(', ')}`);
});

/** Le texte d'un fichier du gabarit, ou `null` s'il n'y est pas — un ENOENT accuserait l'instrument. */
function lireDuGabarit(gabarit, fichier) {
  const chemin = join(RACINE, '.claude', 'templates', gabarit, fichier);
  return existsSync(chemin) ? readFileSync(chemin, 'utf8') : null;
}

/**
 * LES CINQ ÉLÉMENTS DU CYCLE, énumérés ici parce que c'est ce qui est OPPOSABLE — la décision
 * du 2026-08-24 (`project_decisions` de P-20260819-0001), citée mot pour mot :
 * « LIEU DE NAISSANCE versé, avec TOUS les fichiers : CLAUDE.md (métier rendu) · CONTEXTE.md ·
 *   .claude/ (droits) · .mcp.json · briefing /loop ».
 */
const CINQ_ELEMENTS = ['CLAUDE.md', 'CONTEXTE.md', join('.claude', 'settings.json'), '.mcp.json', BRIEFING];

for (const gabarit of ROLES) {
  const dossier = join(RACINE, '.claude', 'templates', gabarit);

  test(`le gabarit « ${gabarit} » porte les CINQ éléments du cycle`, () => {
    // On NOMME tout ce qui manque d'un coup. Une assertion par élément s'arrête au premier et
    // cache les quatre autres : celui qui lit le rouge croit avoir un seul geste à faire.
    const manquants = CINQ_ELEMENTS.filter((e) => !existsSync(join(dossier, e)));
    assert.deepEqual(
      manquants, [],
      `le gabarit « ${gabarit} » ne porte pas « ${manquants.join(' », « ')} » — le cycle en exige `
        + `cinq, pas quatre. Un agent posé sur ce gabarit naîtrait sans, et l'absence d'une ronde `
        + `est MUETTE : il ne se réveille jamais, et rien ne le signale.`,
    );
  });

  test(`le briefing de « ${gabarit} » est un gabarit À REMPLIR, pas un texte figé`, () => {
    const texte = lireDuGabarit(gabarit, BRIEFING);
    assert.notEqual(texte, null, `le gabarit « ${gabarit} » ne porte aucun ${BRIEFING}`);
    const chevrons = [...texte.matchAll(/<[^<>\n]+>/g)].filter(([c]) => !c.startsWith('<!--'));
    assert.ok(
      chevrons.length >= 3,
      `le briefing de « ${gabarit} » ne porte que ${chevrons.length} rubrique(s) à remplir — un ` +
        `briefing qui ne demande rien de propre au chantier ne porte aucune continuité`,
    );
  });

  test(`le briefing de « ${gabarit} » dit qu'il lui appartient et que le pack n'y touche pas`, () => {
    const texte = lireDuGabarit(gabarit, BRIEFING);
    assert.notEqual(texte, null, `le gabarit « ${gabarit} » ne porte aucun ${BRIEFING}`);
    assert.match(
      texte,
      /écrit à la main/,
      `le briefing de « ${gabarit} » ne dit pas qu'il est écrit à la main — un agent qui l'ignore ` +
        `n'osera pas le remplir, ou le croira remplacé à la prochaine mise à jour`,
    );
  });

  test(`le briefing de « ${gabarit} » nomme sa cadence — ce qui se pose à la naissance, pas en route`, () => {
    const texte = lireDuGabarit(gabarit, BRIEFING);
    assert.notEqual(texte, null, `le gabarit « ${gabarit} » ne porte aucun ${BRIEFING}`);
    assert.match(texte, /cadence/i, `le briefing de « ${gabarit} » ne parle pas de sa cadence`);
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

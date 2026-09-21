// metier-classement-socle-regles.test.js — T-20260920-0132 : le noyau de
// l'orchestrateur porte un énoncé court pour CHAQUE règle, pas seulement
// pour ses garde-fous.
//
// Ce que ce banc garde : `classement.json` est l'ABC — le registre canonique
// des règles de l'orchestrateur (source Somcraft, STD-047). Un item de
// nature « regle » sans `enonce_socle` n'a qu'un texte long, prescrit
// pour être lu en entier, jamais reconnaissable EN SITUATION — c'est le
// défaut nommé par T-20260920-0132 : « on enlève le récit, on garde le
// déclencheur ».
//
// ⚠️ Ce banc n'éprouve PAS le rendu (`pack metier rendre`) : au moment où
// il est écrit, un item de nature « regle » avec un `chapitre` n'alimente
// AUCUN artefact rendu par son `enonce_socle` — seules les cardinales, les
// garde-fous et les items dérogés passent par `puce()` (cli/src/metier/rendu.js,
// commentaire I7 : « le chapitre CITE les items, il ne recopie pas leur
// texte »). Écrire l'ABC est donc nécessaire mais pas suffisant pour
// alléger ce qui est distribué à un orchestrateur né — ce banc garde le
// registre, pas la distribution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHEMIN = join(RACINE, 'metier', 'orchestrateur', 'classement.json');

function lireClassement() {
  if (!existsSync(CHEMIN)) return null;
  return JSON.parse(readFileSync(CHEMIN, 'utf8'));
}

const classement = lireClassement();

test('🔴 le dénominateur de ce banc existe — sans lui, tout le reste est muet', () => {
  assert.ok(classement, `« ${CHEMIN} » n'existe pas — aucun item à éprouver`);
  assert.ok(Array.isArray(classement.items) && classement.items.length > 0,
    'le classement ne porte aucun item');
});

test('toute règle (nature « regle ») porte un enonce_socle non vide', () => {
  const regles = classement.items.filter((i) => i.nature === 'regle');
  assert.ok(regles.length > 0, 'aucun item de nature « regle » — le dénominateur serait vide');

  const sans = regles.filter((i) => !i.enonce_socle || !i.enonce_socle.trim());
  assert.deepEqual(sans.map((i) => i.id), [],
    `${sans.length} règle(s) sans enonce_socle : ${sans.map((i) => i.id).join(', ')}`);
});

// Les 37 IDs arbitrés par batiscan le 2026-09-21 (T-20260920-0132, commentaire
// d'arbitrage) : « classe chacun des 37 en DISCIPLINE ASSUMÉE ou DETTE DE
// DISPOSITIF À OUVRIR ». Liste fermée et volontaire — PAS « toute règle sans
// couche qui garantit » : 6 règles (RA-ORC-004, -006, -014, -039, -040, -041)
// portaient déjà un enonce_socle avant ce lot et n'ont jamais été triées ainsi
// (RA-ORC-039/040/041 ont un `sans_garantie`, un mécanisme différent, non lu
// pour la nature « regle » — voir la supersession du 2026-09-21 sur ce
// ticket). Les inclure ici couvrirait une dette PRÉ-EXISTANTE que ce lot n'a
// pas reçu mandat de fermer — ce serait le défaut inverse : un dénominateur
// qui s'élargit sans arbitrage, jugé sur un chiffre qui ne lui appartient pas.
const LES_37 = [
  'RA-ORC-001', 'RA-ORC-002', 'RA-ORC-003', 'RA-ORC-005', 'RA-ORC-007', 'RA-ORC-008',
  'RA-ORC-009', 'RA-ORC-010', 'RA-ORC-011', 'RA-ORC-013', 'RA-ORC-015', 'RA-ORC-016',
  'RA-ORC-017', 'RA-ORC-018', 'RA-ORC-019', 'RA-ORC-020', 'RA-ORC-021', 'RA-ORC-022',
  'RA-ORC-023', 'RA-ORC-024', 'RA-ORC-025', 'RA-ORC-026', 'RA-ORC-027', 'RA-ORC-028',
  'RA-ORC-029', 'RA-ORC-030', 'RA-ORC-031', 'RA-ORC-032', 'RA-ORC-033', 'RA-ORC-034',
  'RA-ORC-035', 'RA-ORC-036', 'RA-ORC-037', 'RA-ORC-038', 'RA-ORC-042', 'RA-ORC-043',
  'RA-ORC-044',
];

test('le périmètre arbitré est bien celui, et seulement celui, que ce lot devait combler', () => {
  const sansSocleAvant = classement.items
    .filter((i) => i.nature === 'regle')
    .filter((i) => LES_37.includes(i.id) || !i.enonce_socle)
    .map((i) => i.id)
    .sort();
  assert.deepEqual(sansSocleAvant.slice().sort(), LES_37.slice().sort(),
    'le périmètre des 37 ne coïncide plus avec les règles réellement dépourvues de socle ' +
    '— un item a été ajouté, retiré, ou re-vidé de son enonce_socle sans mettre LES_37 à jour');
});

test('chacun des 37 items arbitrés porte un triage_dispositif classé', () => {
  // DISCIPLINE ASSUMÉE ou DETTE DE DISPOSITIF À OUVRIR (arbitrage batiscan,
  // T-20260920-0132, 2026-09-21) : sans ce mot, le champ resterait un trou
  // qui se lit comme un oubli plutôt que comme une décision.
  const cibles = classement.items.filter((i) => LES_37.includes(i.id));
  assert.equal(cibles.length, LES_37.length,
    `${LES_37.length} IDs attendus, ${cibles.length} trouvés dans le classement`);

  const nonClasses = cibles.filter((i) => {
    const t = i.triage_dispositif;
    return !t || !['discipline_assumee', 'dette_dispositif'].includes(t.statut) || !t.motif || !t.motif.trim();
  });
  assert.deepEqual(nonClasses.map((i) => i.id), [],
    `${nonClasses.length} règle(s) sans triage classé (discipline_assumee|dette_dispositif + motif) : ` +
    nonClasses.map((i) => i.id).join(', '));
});

test('une dette de dispositif nomme un candidat, une discipline assumée n\'en nomme pas', () => {
  // Une dette sans piste n'est pas actionnable pour le lot suivant — c'est
  // exactement ce que l'arbitrage demandait : « rendre le 51/56 actionnable ».
  // Une discipline assumée qui prétend AUSSI un candidat mentirait sur sa
  // propre nature (elle serait alors une dette non assumée comme telle).
  const items = classement.items.filter((i) => i.triage_dispositif);
  const incoherents = items.filter((i) => {
    const t = i.triage_dispositif;
    if (t.statut === 'dette_dispositif') return !t.candidat || !t.candidat.trim();
    if (t.statut === 'discipline_assumee') return Boolean(t.candidat);
    return false;
  });
  assert.deepEqual(incoherents.map((i) => i.id), [],
    `triage incohérent (dette sans candidat, ou discipline avec un candidat) : ` +
    incoherents.map((i) => i.id).join(', '));
});

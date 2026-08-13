// Le harnais de mutation des deux compétences de pose : ce qui empêche leurs contrôles
// d'être décoratifs.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE HARNAIS EXISTE
//
// Ce lot produit UN TEXTE, et la tentation est de le prouver en cherchant des mots dedans.
// Le motif dominant de ce dépôt — *la garde vérifie ce que le texte CONTIENT, pas ce qu'il
// FAIT* — a résisté à quatre passes de revue sur le lot jumeau, chaque fois un cran plus
// fin : un mot, puis une position, puis une mention, puis un mot-clé dans un libellé de
// colonne. **Aucune des quatre n'a été trouvée par relecture. Toutes par une mutation.**
//
// Le critère opérationnel : **pour chaque garantie, on remplace la phrase qui la porte par
// son contraire, et on relance. Si ça reste vert, la garde est décorative.**
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LES DEUX GARDES DU HARNAIS LUI-MÊME
//
// 1. **La mutation doit être opérante.** Un motif qui ne s'applique plus laisse le texte
//    intact ; tous les contrôles restent verts, et un harnais naïf compte ce silence comme
//    « attrapée ». Il afficherait « n posées, n attrapées » sans qu'aucune n'ait été posée.
//    C'est le faux témoin de cette famille de harnais, et il est fatal.
//
// 2. **C'est le contrôle VISÉ qui doit rougir**, pas n'importe lequel. Les contrôles se
//    recouvrent — le principe et la ligne obligatoire lisent la même section, les gestes et
//    les gestes destructeurs lisent les mêmes blocs. Se contenter d'« au moins un rouge »
//    déclarerait gardées des garanties dont le contrôle dédié ne garde rien.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUE LE DÉCOMPTE DIT, ET CE QU'IL NE DIT PAS
//
// « n mutations posées, n attrapées » se lit spontanément comme *les compétences sont
// gardées*. Il dit en réalité : **les n points auxquels on a pensé sont gardés.** Le reste
// des deux textes est relu par des humains, pas gardé phrase à phrase.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTROLES_COMMUNS,
  CONTROLES_ORCHESTRATEUR,
  MUTATIONS,
  controlesQuiRougissent,
  idsDesControles,
  lireCompetences,
} from './lib/competences-de-pose.js';

const ORIGINAL = lireCompetences();

test('référence : sur les textes intacts, aucun contrôle ne rougit', () => {
  // Sans ce point de départ, une mutation « attrapée » pourrait l'être par un contrôle déjà
  // rouge avant elle — et on croirait garder ce qu'on ne garde pas.
  const rouges = controlesQuiRougissent(ORIGINAL);
  assert.deepEqual(
    rouges.map((r) => r.id),
    [],
    'des contrôles rougissent déjà sur les textes intacts — le harnais ne prouverait rien :\n  '
      + rouges.map((r) => `${r.id} → ${r.message}`).join('\n  '),
  );
});

test('chaque contrôle est mis à l’épreuve par au moins une mutation', () => {
  // Un contrôle que rien ne mute est un contrôle dont on ignore s'il tient. C'est exactement
  // ce que le lot jumeau a payé six fois sur neuf.
  const vises = new Set(MUTATIONS.map((m) => m.cible));
  const orphelins = idsDesControles().filter((id) => !vises.has(id));
  assert.deepEqual(orphelins, [], `ces contrôles ne sont éprouvés par aucune mutation : ${orphelins.join(', ')}`);

  const connus = new Set(idsDesControles());
  const fantomes = MUTATIONS.filter((m) => !connus.has(m.cible)).map((m) => `${m.id} → ${m.cible}`);
  assert.deepEqual(fantomes, [], `ces mutations visent un contrôle inexistant : ${fantomes.join(', ')}`);
});

test('chaque mutation vise la compétence dont le contrôle porte le suffixe', () => {
  // Une mutation posée sur le gestionnaire mais visant un contrôle « @orchestrateur » serait
  // « attrapée » par un rouge qui ne doit rien à la mutation — le faux témoin, une fois de plus.
  const boiteuses = MUTATIONS
    .filter((m) => !m.cible.endsWith(`@${m.competence}`))
    .map((m) => `${m.id} (mute ${m.competence}, vise ${m.cible})`);
  assert.deepEqual(boiteuses, [], `ces mutations ne visent pas la compétence qu’elles modifient : ${boiteuses.join(', ')}`);
});

for (const mutation of MUTATIONS) {
  test(`mutation « ${mutation.id} » : ${mutation.quoi}`, () => {
    const avant = ORIGINAL[mutation.competence];
    assert.ok(avant !== undefined, `la mutation vise « ${mutation.competence} », qui n’est pas une compétence connue`);

    const apres = mutation.muter(avant);

    // ── GARDE 1 : la mutation doit mordre. Un motif devenu caduc laisse le texte intact.
    assert.notEqual(
      apres,
      avant,
      `la mutation « ${mutation.id} » n’a rien changé — son motif ne s’applique plus au texte, `
        + 'elle ne prouve donc rien. Corrige la mutation, jamais le contrôle.',
    );

    // ── GARDE 2 : c'est le contrôle VISÉ qui doit rougir.
    const rouges = controlesQuiRougissent({ ...ORIGINAL, [mutation.competence]: apres });
    const ids = rouges.map((r) => r.id);
    assert.ok(
      ids.includes(mutation.cible),
      `« ${mutation.cible} » est resté vert sous « ${mutation.id} » : il ne garde pas ce qu’il prétend garder.`
        + (ids.length ? ` (ont rougi : ${ids.join(', ')})` : ' (aucun contrôle n’a rougi)'),
    );
  });
}

test('décompte : ce que ce harnais garde, et ce qu’il ne garde pas', () => {
  const controles = CONTROLES_COMMUNS.length * 2 + CONTROLES_ORCHESTRATEUR.length;
  assert.ok(MUTATIONS.length >= controles, `${MUTATIONS.length} mutations pour ${controles} contrôles — chacun doit être éprouvé`);
});

// Le harnais de mutation du métier de l'orchestrateur : ce qui empêche ses contrôles d'être
// décoratifs.
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
// DEUX GARDES QUE CE HARNAIS AJOUTE À CELUI DU GESTIONNAIRE
//
// 1. **La mutation doit être opérante.** Un motif qui ne s'applique plus laisse le texte
//    intact ; tous les contrôles restent verts, et un harnais naïf compte ce silence comme
//    « attrapée ». Il afficherait « 26 posées, 26 attrapées » sans qu'aucune n'ait été
//    posée. C'est le faux témoin de cette famille de harnais, et il est fatal.
//
// 2. **C'est le contrôle VISÉ qui doit rougir**, pas n'importe lequel — et cette exigence-là
//    est propre à ce lot. `le-metier-a-voyage-entier` compare des sections entières du
//    métier octet pour octet : il attraperait accidentellement presque toute mutation posée
//    sur le texte transporté. Se contenter d'« au moins un contrôle rouge » déclarerait donc
//    gardées des garanties dont le contrôle dédié ne garde rien.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUE LE DÉCOMPTE DIT, ET CE QU'IL NE DIT PAS
//
// « n mutations posées, n attrapées » se lit spontanément comme *le métier est gardé*. Il
// dit en réalité : **les n points auxquels on a pensé sont gardés.** Le gabarit fait plus de
// sept cents lignes ; on n'en garde pas chaque phrase. Les garanties gardées ici sont les
// six ajouts que l'epic revendique, la fidélité du transport, et les interdits fondateurs.
// Le reste du texte est transporté et comparé, pas gardé phrase à phrase.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTROLES, MUTATIONS, lireGabarits, GARANTIES_DE_POLARITE, sourceDesControles,
} from './lib/metier-orchestrateur.js';

const ORIGINAL = lireGabarits();

/** Les contrôles qui rougissent sur ces gabarits. */
function controlesQuiRougissent(gabarits) {
  const rouges = [];
  for (const c of CONTROLES) {
    try {
      c.verifier(gabarits);
    } catch (e) {
      rouges.push({ id: c.id, message: e.message });
    }
  }
  return rouges;
}

test('référence : sur le gabarit intact, aucun contrôle ne rougit', () => {
  // Sans ce point de départ, une mutation « attrapée » pourrait l'être par un contrôle déjà
  // rouge avant elle — et on croirait garder ce qu'on ne garde pas.
  const rouges = controlesQuiRougissent(ORIGINAL);
  assert.deepEqual(
    rouges.map((r) => r.id), [],
    'des contrôles rougissent déjà sur le gabarit intact — le harnais ne prouverait rien : '
      + rouges.map((r) => `${r.id} (${r.message})`).join(' · '),
  );
});

test('chaque contrôle est mis à l’épreuve par au moins une mutation', () => {
  // Un contrôle que rien ne mute est un contrôle dont on ignore s'il tient.
  const cibles = new Set(MUTATIONS.map((m) => m.cible));
  const orphelins = CONTROLES.filter((c) => !cibles.has(c.id)).map((c) => c.id);
  assert.deepEqual(orphelins, [], `ces contrôles ne sont éprouvés par aucune mutation : ${orphelins.join(', ')}`);

  const connus = new Set(CONTROLES.map((c) => c.id));
  const fantomes = MUTATIONS.filter((m) => !connus.has(m.cible)).map((m) => `${m.id} → ${m.cible}`);
  assert.deepEqual(fantomes, [], `ces mutations visent un contrôle inexistant : ${fantomes.join(', ')}`);
});

test('les garanties de polarité se gardent avec exigePolarite, jamais avec une sous-chaîne', () => {
  // ⚠️ CE TEST NE REGARDE PAS CE QUE LES CONTRÔLES RENDENT — il regarde COMMENT ils sont
  // écrits, et c'est voulu. Une garde en `assert.match(corps, /tu ne fermes pas/)` reste verte
  // devant « il n'est pas vrai que tu ne fermes pas » : la phrase gardée est encore là, et elle
  // dit le contraire. Quatre gardes neuves sont tombées sur ce trou le 2026-08-16, dont celle
  // qui tenait la garantie la plus lourde du lot.
  //
  // Corriger les six assertions n'aurait rien fermé : le prochain qui écrit une garde écrira
  // une sous-chaîne, parce que c'est le geste le plus court. Ce test rend l'autre chemin le
  // plus court — il faut désormais éditer la liste ET se justifier pour écrire une garde
  // faible, là où `exigePolarite` s'écrit exactement comme l'`assert.match` qu'il remplace.
  const source = sourceDesControles();

  for (const id of GARANTIES_DE_POLARITE) {
    const debut = source.indexOf(`id: '${id}'`);
    assert.ok(debut > 0, `« ${id} » est inscrit comme garantie de polarité mais n'existe plus`);

    // Le bloc du contrôle : de son id jusqu'à l'id suivant, ou la fin du tableau.
    const suite = source.slice(debut + 1);
    const prochain = suite.search(/\n\s{2}\{\n\s{4}id: '/);
    const bloc = prochain === -1 ? suite : suite.slice(0, prochain);

    assert.ok(
      bloc.includes('exigePolarite('),
      `« ${id} » garde une règle de polarité SANS exigePolarite : sa ou ses assertions cherchent `
        + `une sous-chaîne, donc une négation enveloppante les laissera vertes. C'est le défaut `
        + `mesuré le 2026-08-16 — remplace l'assert.match qui porte la garantie par exigePolarite, `
        + `ça s'écrit sur la même ligne.`,
    );
  }

  // L'autre moitié : un contrôle qui disparaît de CONTROLES mais reste inscrit ici laisserait
  // croire qu'une garantie est gardée alors qu'elle ne l'est plus.
  const connus = new Set(CONTROLES.map((c) => c.id));
  const fantomes = GARANTIES_DE_POLARITE.filter((id) => !connus.has(id));
  assert.deepEqual(fantomes, [], `ces garanties de polarité ne correspondent à aucun contrôle : ${fantomes.join(', ')}`);
});

for (const mutation of MUTATIONS) {
  test(`mutation « ${mutation.id} » : ${mutation.quoi}`, () => {
    const avant = ORIGINAL[mutation.fichier];
    assert.ok(avant !== undefined, `la mutation vise « ${mutation.fichier} », qui n’est pas un gabarit connu`);

    const apres = mutation.muter(avant);

    // ── GARDE 1 : la mutation doit mordre.
    assert.notEqual(
      apres, avant,
      `mutation INOPÉRANTE : son motif ne s'applique plus au gabarit, donc rien n'a été muté. `
        + `Un texte inchangé laisse évidemment tous les contrôles verts — ce n'est PAS une preuve. `
        + `Corrige le motif de la mutation « ${mutation.id} » pour qu'il morde à nouveau.`,
    );

    const rouges = controlesQuiRougissent({ ...ORIGINAL, [mutation.fichier]: apres });

    // ── GARDE 2 : c'est le contrôle VISÉ qui doit la voir.
    assert.ok(
      rouges.some((r) => r.id === mutation.cible),
      `MUTATION SURVIVANTE — ${mutation.quoi}\n`
        + `Le gabarit a bien été retourné et le contrôle « ${mutation.cible} », qui devait la voir, `
        + `est resté vert.\n`
        + (rouges.length
          ? `D'autres contrôles ont rougi (${rouges.map((r) => r.id).join(', ')}) — ça ne compte pas : `
            + `ils gardent autre chose, et « ${mutation.cible} » reste décoratif.\n`
          : 'AUCUN contrôle ne s\'en est aperçu.\n')
        + `Réécris-le en polarité ou en position plutôt qu'en présence de mots.`,
    );
  });
}

// « Ne jamais créer de danger chez le client » — la règle, et la preuve qu'elle est gardée.
//
// T-20260813-0061 (D-20260812-0001, onzième règle de conduite). Deux familles, et la seconde
// est celle qui vaut quelque chose :
//
//   1. **Le métier dit ce qu'il doit dire** — les contrôles sur le gabarit réel.
//   2. **Les contrôles ne sont pas décoratifs** — les mêmes contrôles rejoués sur des
//      versions RETOURNÉES du gabarit. Ce lot produit du TEXTE : un test qui vérifie que le
//      gabarit contient « danger » ne prouve rien, puisque remplacer la phrase par son
//      contraire laisse le mot en place. Le critère est celui du harnais partagé : on
//      remplace la phrase qui porte la garantie par son contraire, et on relance. Si ça
//      reste vert, la garde est décorative.
//
// La garde d'entrée du harnais partagé est reprise telle quelle, et elle est vitale : une
// mutation dont le motif ne s'applique plus au texte ne le change pas, tous les contrôles
// restent verts, et un harnais naïf compterait ce silence comme « attrapée ».
//
// Ce que le décompte dit : les points auxquels on a pensé sont gardés. Rien de plus.
// Ici, ce sont les trois retournements que le ticket nomme — l'ordre inversé, la
// contrepartie supprimée, l'urgence transformée en attente — plus les interdits de geste.
//
// La distribution (le paquet construit embarque bien ce gabarit, identique à la source) est
// prouvée par `representant-gabarit.test.js`, qui CONSTRUIT le paquet ; elle n'est pas
// redite ici, un seul fichier devant toucher au payload partagé.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lireGabarits } from './lib/metier-representant.js';
import { CONTROLES_DANGER, MUTATIONS_DANGER } from './lib/danger-representant.js';

const ORIGINAL = lireGabarits();

/** Les contrôles qui rougissent sur ces gabarits. */
function controlesQuiRougissent(gabarits) {
  const rouges = [];
  for (const c of CONTROLES_DANGER) {
    try {
      c.verifier(gabarits);
    } catch (e) {
      rouges.push({ id: c.id, message: e.message });
    }
  }
  return rouges;
}

// ═══════════════════════════════ 1. le métier dit ce qu'il doit dire

for (const controle of CONTROLES_DANGER) {
  test(`métier : ${controle.quoi}`, () => controle.verifier(ORIGINAL));
}

// ═══════════════════════════════ 2. les contrôles ne sont pas décoratifs

test('référence : sur le gabarit intact, aucun contrôle de cette règle ne rougit', () => {
  // Sans ce point de départ, une mutation « attrapée » pourrait l'être par un contrôle déjà
  // rouge avant elle — et on croirait garder ce qu'on ne garde pas.
  const rouges = controlesQuiRougissent(ORIGINAL);
  assert.deepEqual(
    rouges.map((r) => r.id), [],
    'des contrôles rougissent déjà sur le gabarit intact — le harnais ne prouverait rien : '
      + rouges.map((r) => `${r.id} (${r.message})`).join(' · '),
  );
});

test('chaque contrôle de cette règle est mis à l’épreuve par au moins une mutation', () => {
  const cibles = new Set(MUTATIONS_DANGER.map((m) => m.cible));
  const orphelins = CONTROLES_DANGER.filter((c) => !cibles.has(c.id)).map((c) => c.id);
  assert.deepEqual(orphelins, [], `ces contrôles ne sont éprouvés par aucune mutation : ${orphelins.join(', ')}`);

  const connus = new Set(CONTROLES_DANGER.map((c) => c.id));
  const fantomes = MUTATIONS_DANGER.filter((m) => !connus.has(m.cible)).map((m) => `${m.id} → ${m.cible}`);
  assert.deepEqual(fantomes, [], `ces mutations visent un contrôle inexistant : ${fantomes.join(', ')}`);
});

test('les deux retournements que le ticket nomme sont bel et bien posés', () => {
  // Le ticket exige nommément que L'INVERSION DE L'ORDRE et LA SUPPRESSION DE LA
  // CONTREPARTIE rougissent. Une liste de mutations peut grossir et perdre l'une des deux
  // en chemin sans que rien ne le dise — ce test l'empêche.
  const poses = new Set(MUTATIONS_DANGER.map((m) => m.id));
  for (const exigee of ['danger-l-ordre-est-inverse', 'danger-la-contrepartie-disparait']) {
    assert.ok(poses.has(exigee), `la mutation « ${exigee} » est exigée par T-20260813-0061 et n’est plus posée`);
  }
});

for (const mutation of MUTATIONS_DANGER) {
  test(`mutation « ${mutation.id} » : ${mutation.quoi}`, () => {
    const avant = ORIGINAL[mutation.fichier];
    assert.ok(avant !== undefined, `la mutation vise « ${mutation.fichier} », qui n’est pas un gabarit connu`);

    const apres = mutation.muter(avant);

    // ── LA GARDE D'ENTRÉE. Sans elle, une mutation inopérante se compte comme attrapée.
    assert.notEqual(
      apres, avant,
      'mutation INOPÉRANTE : son motif ne s\'applique plus au gabarit, donc rien n\'a été muté. '
        + 'Un texte inchangé laisse évidemment tous les contrôles verts — ce n\'est PAS une preuve. '
        + `Corrige le motif de la mutation « ${mutation.id} » pour qu'il morde à nouveau.`,
    );

    const rouges = controlesQuiRougissent({ ...ORIGINAL, [mutation.fichier]: apres });

    assert.ok(
      rouges.length > 0,
      `MUTATION SURVIVANTE — ${mutation.quoi}\n`
        + 'Le gabarit a bien été retourné et AUCUN contrôle ne s\'en est aperçu.\n'
        + `Le contrôle « ${mutation.cible} » devait la voir : il est décoratif, réécris-le `
        + 'en polarité ou en position plutôt qu\'en présence de mots.',
    );
  });
}

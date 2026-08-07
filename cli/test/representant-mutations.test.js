// Le harnais de mutation : ce qui empêche les contrôles du métier d'être décoratifs.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE HARNAIS EXISTE
//
// Sur le chantier D-20260805-0005, neuf revues indépendantes ont trouvé neuf défauts. Le
// motif le plus fréquent — SIX FOIS — est : *la garde vérifie ce que le texte CONTIENT,
// pas ce qu'il FAIT*. Le pire cas : un refus gardé par mots-clés a survécu à son
// remplacement par LE CONTRESENS EXACT. Le mot y était encore ; le test est resté vert ;
// le comportement était inversé.
//
// Ce lot produit du texte. Un test qui vérifie que le gabarit contient « anti-complaisance »
// ne prouve donc rien : remplacer la phrase par son contraire laisse le mot en place.
//
// Le critère opérationnel est celui-ci : **pour chaque garantie, on remplace la phrase qui
// la porte par son contraire, et on relance. Si ça reste vert, la garde est décorative.**
// Ce fichier applique ce critère mécaniquement, et la chaîne d'intégration l'exécute.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE FAUX TÉMOIN DE CETTE FAMILLE DE HARNAIS, ET IL EST FATAL
//
// Une mutation dont le motif ne s'applique plus au texte ne le change pas. Tous les
// contrôles restent verts sur un texte identique à l'original... et un harnais naïf
// compterait ce silence comme « attrapée ». Le harnais afficherait alors « 19 posées,
// 19 attrapées » sans qu'aucune n'ait jamais été posée.
//
// C'est le motif « le double de test est plus permissif que le vrai service », transposé :
// six occurrences sur le chantier précédent, dont une qui a laissé passer une fonction
// INERTE EN PRODUCTION derrière 97 tests verts et deux revues.
//
// D'où la garde d'entrée : **toute mutation doit produire un texte DIFFÉRENT de l'original,
// sinon le harnais échoue en la déclarant inopérante.** Une mutation qui ne s'applique pas
// n'est pas une mutation attrapée : c'est un test qui ne s'est jamais exécuté.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONTROLES, MUTATIONS, lireGabarits } from './lib/metier-representant.js';

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
  // Sans ce point de départ, une mutation « attrapée » pourrait l'être par un contrôle
  // déjà rouge avant elle — et on croirait garder ce qu'on ne garde pas.
  const rouges = controlesQuiRougissent(ORIGINAL);
  assert.deepEqual(
    rouges.map((r) => r.id), [],
    `des contrôles rougissent déjà sur le gabarit intact — le harnais ne prouverait rien : `
      + rouges.map((r) => `${r.id} (${r.message})`).join(' · '),
  );
});

test('chaque contrôle est mis à l’épreuve par au moins une mutation', () => {
  // Un contrôle que rien ne mute est un contrôle dont on ignore s'il tient. Le harnais
  // doit couvrir tout ce qu'il prétend garder — sinon la couverture qu'il annonce est
  // une couverture partielle qui se présente comme totale.
  const cibles = new Set(MUTATIONS.map((m) => m.cible));
  const orphelins = CONTROLES.filter((c) => !cibles.has(c.id)).map((c) => c.id);
  assert.deepEqual(orphelins, [], `ces contrôles ne sont éprouvés par aucune mutation : ${orphelins.join(', ')}`);

  // Et symétriquement : une mutation qui viserait un contrôle inexistant serait un
  // vestige — elle ne prouverait rien de ce qu'elle prétend prouver.
  const connus = new Set(CONTROLES.map((c) => c.id));
  const fantomes = MUTATIONS.filter((m) => !connus.has(m.cible)).map((m) => `${m.id} → ${m.cible}`);
  assert.deepEqual(fantomes, [], `ces mutations visent un contrôle inexistant : ${fantomes.join(', ')}`);
});

for (const mutation of MUTATIONS) {
  test(`mutation « ${mutation.id} » : ${mutation.quoi}`, () => {
    const avant = ORIGINAL[mutation.fichier];
    assert.ok(avant !== undefined, `la mutation vise « ${mutation.fichier} », qui n’est pas un gabarit connu`);

    const apres = mutation.muter(avant);

    // ── LA GARDE D'ENTRÉE. Sans elle, une mutation inopérante se compte comme attrapée.
    assert.notEqual(
      apres, avant,
      `mutation INOPÉRANTE : son motif ne s'applique plus au gabarit, donc rien n'a été muté. `
        + `Un texte inchangé laisse évidemment tous les contrôles verts — ce n'est PAS une preuve. `
        + `Corrige le motif de la mutation « ${mutation.id} » pour qu'il morde à nouveau.`,
    );

    const rouges = controlesQuiRougissent({ ...ORIGINAL, [mutation.fichier]: apres });

    assert.ok(
      rouges.length > 0,
      `MUTATION SURVIVANTE — ${mutation.quoi}\n`
        + `Le gabarit a bien été retourné et AUCUN contrôle ne s'en est aperçu.\n`
        + `Le contrôle « ${mutation.cible} » devait la voir : il est décoratif, réécris-le `
        + `en polarité ou en position plutôt qu'en présence de mots.`,
    );
  });
}

// Le harnais de mutation des contrôles de la compétence d'orchestration.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QU'IL PROUVE, ET POURQUOI IL EXISTE
//
// `orchestrer-chantier.test.js` prouve que les contrôles PASSENT sur le texte réel. Ça
// ne prouve rien : un contrôle qui ne vérifie rien passe lui aussi. Ce fichier prouve
// l'autre moitié — que chaque contrôle ROUGIT quand la prescription qu'il garde est
// retournée.
//
// Le motif que ça attrape a survécu QUATRE fois sur un seul lot de ce dépôt, chaque fois
// un cran plus fin : mots → position dans un tableau → mention au lieu d'usage → mot-clé
// dans un libellé. « Tu remontes au dirigeant » devenant « Tu remontes au dirigeant SI TU
// AS UN DOUTE » garde le mot-clé et retourne le sens. Aucune des quatre n'a été trouvée
// par relecture ; toutes par une mutation.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// TROIS EXIGENCES, PAS UNE
//
//   1. **La mutation doit être opérante** — si elle ne change rien au texte (parce que la
//      phrase qu'elle vise a été reformulée entre-temps), elle serait comptée comme
//      « attrapée » sans avoir rien posé. Une mutation jamais posée est un faux témoin
//      exactement comme un test qui reste vert.
//   2. **Elle doit être attrapée par le contrôle qu'elle vise** — pas seulement « par un
//      contrôle quelconque ». Une mutation attrapée par accident, via une erreur de
//      structure sans rapport, ne prouve pas que la garantie visée est gardée.
//   3. **Le texte non muté reste réel** — muter le brief ne doit pas servir le brief muté
//      au contrôle comme s'il était le SKILL, sinon il rougit pour une raison qui n'a rien
//      à voir avec la mutation.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONTROLES, MUTATIONS, textesReels } from './lib/orchestrer-chantier-metier.js';

const REELS = textesReels();

/** Les identifiants des contrôles que ces textes font rougir, avec leur message. */
function controlesQuiRougissent(textes) {
  const echecs = [];
  for (const c of CONTROLES) {
    try {
      c.verifier(textes);
    } catch (e) {
      echecs.push({ id: c.id, message: e.message });
    }
  }
  return echecs;
}

test('référence : sur les textes réels, aucun contrôle ne rougit', () => {
  const echecs = controlesQuiRougissent(REELS);
  assert.deepEqual(
    echecs.map((e) => e.id), [],
    `des contrôles rougissent sur le texte réel :\n${echecs.map((e) => `  • ${e.id} — ${e.message}`).join('\n')}`
  );
});

for (const mutation of MUTATIONS) {
  test(`mutation « ${mutation.id} » : ${mutation.quoi}`, () => {
    const source = REELS[mutation.sur];
    const mute = mutation.muter(source);

    // 1. La mutation a-t-elle réellement été posée ?
    assert.notEqual(
      mute, source,
      `la mutation « ${mutation.id} » est INOPÉRANTE : elle n'a rien changé au ${mutation.sur}. ` +
      'Le passage qu\'elle vise a probablement été reformulé — remets-la sur sa cible, ' +
      'sinon elle se compte comme attrapée sans avoir rien posé.'
    );

    // 2. Le texte non muté reste réel.
    const textes = { ...REELS, [mutation.sur]: mute };

    const echecs = controlesQuiRougissent(textes);
    assert.ok(
      echecs.length > 0,
      `la mutation « ${mutation.id} » n'a fait rougir AUCUN contrôle — ` +
      `la garantie « ${mutation.cible} » n'est donc gardée par rien.`
    );

    // 3. Attrapée par le contrôle qu'elle vise, pas par un dommage collatéral.
    assert.ok(
      echecs.some((e) => e.id === mutation.cible),
      `la mutation « ${mutation.id} » visait le contrôle « ${mutation.cible} », ` +
      `mais elle n'a été attrapée que par : ${echecs.map((e) => e.id).join(', ')}. ` +
      'Une prise par accident ne prouve pas que la garantie visée est gardée.'
    );
  });
}

test('couverture : le harnais rend compte de son propre volume', () => {
  // Aucune borne haute : ce test existe pour que le compte apparaisse dans la sortie et
  // qu'une disparition silencieuse de mutations se voie.
  assert.ok(CONTROLES.length >= 15, `trop peu de contrôles (${CONTROLES.length})`);
  assert.ok(MUTATIONS.length >= CONTROLES.length, `moins de mutations que de contrôles (${MUTATIONS.length} < ${CONTROLES.length})`);
  console.log(`  → ${CONTROLES.length} contrôles, ${MUTATIONS.length} mutations posées`);
});

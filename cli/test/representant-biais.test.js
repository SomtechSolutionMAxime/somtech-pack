// « Protéger le représentant des biais LLM » — les garanties, et la preuve qu'elles gardent.
//
// T-20260813-0063 (D-20260812-0001), standard STD-011. Quatre familles :
//
//   1. **Le lieu dit et fait ce qu'il doit** — les contrôles sur le gabarit et les droits réels.
//   2. **Les gardes ne sont pas décoratives** — les mêmes contrôles rejoués sur des versions
//      RETOURNÉES. Ce lot produit du TEXTE : un test qui vérifie que le gabarit contient
//      « québécois » ne prouve rien, puisque le remplacer par « adapte-toi au contexte local »
//      laisse le mot en place. Le critère est celui du dépôt : on retourne la phrase qui porte
//      la garantie, et on relance. Si ça reste vert, la garde est décorative.
//   3. **Elles ne sont pas trop étroites non plus** — les reformulations légitimes, exigées
//      VERTES. Une garde qui casse sur une édition qui ne change rien au sens pousse celui qui
//      la subit à l'assouplir plutôt qu'à la corriger.
//   4. **L'axe MODALITÉ est vivant** — chaque tournure de `CONSEIL` prouvée par une sonde.
//
// Ce que le décompte dit : les points auxquels on a pensé sont gardés. Rien de plus. Le
// gabarit fait plus de trois cents lignes ; ce lot en garde cinq garanties — celles que le
// ticket revendique. Le reste du texte est écrit, pas gardé.
//
// La distribution (le paquet construit embarque bien ces fichiers, identiques à la source)
// est prouvée par `representant-gabarit.test.js`, qui CONSTRUIT le paquet ; elle n'est pas
// redite ici, un seul fichier devant toucher au payload partagé.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTROLES_BIAIS,
  MUTATIONS_BIAIS,
  REFORMULATIONS_LEGITIMES,
  CONSEIL,
  exigeContrainte,
  lireLieu,
} from './lib/biais-representant.js';

const ORIGINAL = lireLieu();

/** Les contrôles qui rougissent sur ce lieu. */
function controlesQuiRougissent(lieu) {
  const rouges = [];
  for (const c of CONTROLES_BIAIS) {
    try {
      c.verifier(lieu);
    } catch (e) {
      rouges.push({ id: c.id, message: e.message });
    }
  }
  return rouges;
}

// ═══════════════════════════════ 1. le lieu dit et fait ce qu'il doit

for (const controle of CONTROLES_BIAIS) {
  test(`biais : ${controle.quoi}`, () => controle.verifier(ORIGINAL));
}

// ═══════════════════════════════ 2. les gardes ne sont pas décoratives

test('référence : sur le lieu intact, aucun contrôle de biais ne rougit', () => {
  // Sans ce point de départ, une mutation « attrapée » pourrait l'être par un contrôle déjà
  // rouge avant elle — et on croirait garder ce qu'on ne garde pas.
  const rouges = controlesQuiRougissent(ORIGINAL);
  assert.deepEqual(
    rouges.map((r) => r.id), [],
    'des contrôles rougissent déjà sur le lieu intact — le harnais ne prouverait rien : '
      + rouges.map((r) => `${r.id} (${r.message})`).join(' · '),
  );
});

test('chaque contrôle de biais est mis à l’épreuve par au moins une mutation', () => {
  const cibles = new Set(MUTATIONS_BIAIS.map((m) => m.cible));
  const orphelins = CONTROLES_BIAIS.filter((c) => !cibles.has(c.id)).map((c) => c.id);
  assert.deepEqual(orphelins, [], `ces contrôles ne sont éprouvés par aucune mutation : ${orphelins.join(', ')}`);

  const connus = new Set(CONTROLES_BIAIS.map((c) => c.id));
  const fantomes = MUTATIONS_BIAIS.filter((m) => !connus.has(m.cible)).map((m) => `${m.id} → ${m.cible}`);
  assert.deepEqual(fantomes, [], `ces mutations visent un contrôle inexistant : ${fantomes.join(', ')}`);
});

test('les deux retournements que le ticket nomme sont bel et bien posés', () => {
  // T-20260813-0063 exige nommément que LE CONTEXTE QC/CA REMPLACÉ PAR UNE FORMULE VAGUE et
  // LA CONTRAINTE CHANGÉE EN CONSEIL rougissent. Une liste de mutations peut grossir et
  // perdre l'une des deux en chemin sans que rien ne le dise — ce test l'empêche.
  const poses = new Set(MUTATIONS_BIAIS.map((m) => m.id));
  for (const exigee of ['biais-le-contexte-devient-vague', 'biais-la-contrainte-devient-un-conseil']) {
    assert.ok(poses.has(exigee), `la mutation « ${exigee} » est exigée par T-20260813-0063 et n’est plus posée`);
  }
});

for (const mutation of MUTATIONS_BIAIS) {
  test(`mutation « ${mutation.id} » : ${mutation.quoi}`, () => {
    const avant = ORIGINAL[mutation.fichier];
    assert.ok(avant !== undefined, `la mutation vise « ${mutation.fichier} », qui n’est pas un fichier connu du lieu`);

    const apres = mutation.muter(avant);

    // ── LA GARDE D'ENTRÉE. Sans elle, une mutation inopérante se compte comme attrapée : son
    // motif ne mord plus, le texte est inchangé, tous les contrôles restent verts — et le
    // décompte annoncerait « 13 posées, 13 attrapées » sans qu'aucune n'ait été posée.
    assert.notEqual(
      apres, avant,
      'mutation INOPÉRANTE : son motif ne s\'applique plus au lieu, donc rien n\'a été muté. '
        + 'Un texte inchangé laisse évidemment tous les contrôles verts — ce n\'est PAS une preuve. '
        + `Corrige le motif de la mutation « ${mutation.id} » pour qu'il morde à nouveau.`,
    );

    const rouges = controlesQuiRougissent({ ...ORIGINAL, [mutation.fichier]: apres });

    assert.ok(
      rouges.length > 0,
      `MUTATION SURVIVANTE — ${mutation.quoi}\n`
        + 'Le lieu a bien été retourné et AUCUN contrôle ne s\'en est aperçu.\n'
        + `Le contrôle « ${mutation.cible} » devait la voir : il est décoratif, réécris-le `
        + 'en polarité, en compte ou en modalité plutôt qu\'en présence de mots.',
    );

    // ── ET C'EST LE CONTRÔLE VISÉ QUI DOIT LA VOIR, PAS N'IMPORTE LEQUEL.
    //
    // Ces cinq contrôles lisent deux sections communes : une mutation peut être attrapée PAR
    // RICOCHET — retirer une ligne de table fait tomber un compte voisin — pendant que le
    // contrôle censé la garder reste vert. On croirait alors garder la garantie visée, et on
    // ne garderait que sa voisine ; le jour où la voisine change, la garantie disparaît sans
    // une rougeur. (Qu'un second contrôle rougisse AUSSI est normal : plusieurs gardes
    // peuvent légitimement voir le même retournement.)
    assert.ok(
      rouges.some((r) => r.id === mutation.cible),
      `MUTATION ATTRAPÉE PAR RICOCHET — ${mutation.quoi}\n`
        + `Le contrôle visé « ${mutation.cible} » est resté VERT ; seul(s) `
        + `${rouges.map((r) => `« ${r.id} »`).join(', ')} a/ont rougi.\n`
        + 'La garantie que cette mutation met à l\'épreuve n\'est donc pas gardée par le contrôle '
        + 'qui prétend la garder — corrige le contrôle, ou la cible si elle était mal nommée.',
    );
  });
}

// ═══════════════════════════════ 3. et elles ne sont pas trop étroites

for (const reformulation of REFORMULATIONS_LEGITIMES) {
  test(`reformulation légitime « ${reformulation.id} » : ${reformulation.quoi}`, () => {
    const avant = ORIGINAL[reformulation.fichier];
    const apres = reformulation.reecrire(avant);
    assert.notEqual(
      apres, avant,
      'reformulation INOPÉRANTE : son motif ne s’applique plus au lieu, donc rien n’a été réécrit '
        + `et son vert ne prouve rien. Corrige le motif de « ${reformulation.id} ».`,
    );

    const rouges = controlesQuiRougissent({ ...ORIGINAL, [reformulation.fichier]: apres });
    assert.deepEqual(
      rouges.map((r) => r.id), [],
      `FAUX POSITIF — ${reformulation.quoi}\n`
        + `Le sens est inchangé et ${rouges.map((r) => `« ${r.id} »`).join(', ')} rougit : la garde suit `
        + 'une forme d’écriture, pas la garantie.\n'
        + rouges.map((r) => r.message).join('\n'),
    );
  });
}

// ═══════════════════════════════ 4. l'axe MODALITÉ, et sa panne silencieuse
//
// `CONSEIL` est une LISTE DE TOURNURES, donc elle a un mode de panne que la polarité et le
// compte n'ont pas : **une alternative peut ne s'apparier à rien, jamais**. Elle est alors
// vraie par construction — l'axe est réputé couvert, et il ne l'est pas.
//
// CE N'EST PAS UNE CRAINTE THÉORIQUE : le cas s'est produit deux fois dans ce dépôt, sur
// `\bà moins que` et `\bà ta discrétion`. En JavaScript, `à` n'est pas un caractère de mot :
// un `\b` posé devant ne s'apparie jamais. Les deux alternatives étaient nées mortes, et
// c'est une mutation — pas une relecture — qui a fini par le dire. Les deux tests ci-dessous
// rendent la panne impossible pour `CONSEIL`, qui est né sous la même menace.

/** Les alternatives de premier niveau du motif — les `|` internes aux groupes ne coupent pas. */
function alternativesDe(source) {
  const out = [];
  let courante = '';
  let profondeur = 0;
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (c === '\\') { courante += c + source[i + 1]; i += 1; continue; }
    if (c === '(') profondeur += 1;
    if (c === ')') profondeur -= 1;
    if (c === '|' && profondeur === 0) { out.push(courante); courante = ''; continue; }
    courante += c;
  }
  out.push(courante);
  return out;
}

/**
 * Une sonde par alternative. Elles ne sont PAS dérivées du motif : une sonde fabriquée à
 * partir de ce qu'elle teste réussirait aussi bien sur une alternative morte, puisqu'elle en
 * serait la transcription.
 */
const SONDES_DE_CONSEIL = [
  'essaie de t’y tenir',
  'tâche de le remonter',
  'efforce-toi de le relire',
  'évite de le chiffrer',
  'mieux vaut ne rien promettre',
  'tu devrais le remonter',
  'dans l’idéal, remonte-le',
  'il est préférable de le remonter',
];

test('axe MODALITÉ : chaque tournure de conseil est VIVANTE, et chacune a sa sonde', () => {
  const alternatives = alternativesDe(CONSEIL.source);
  assert.equal(
    SONDES_DE_CONSEIL.length, alternatives.length,
    `${SONDES_DE_CONSEIL.length} sonde(s) pour ${alternatives.length} tournure(s) : une tournure `
      + 'ajoutée sans sa sonde n’est prouvée par rien, et c’est exactement ainsi qu’on en écrit '
      + `une qui ne s’apparie jamais (${alternatives.join('  ·  ')})`,
  );

  const vues = new Set();
  for (const sonde of SONDES_DE_CONSEIL) {
    const trouve = sonde.match(CONSEIL);
    assert.ok(trouve, `la sonde « ${sonde} » ne déclenche AUCUNE tournure — elle ne prouve donc rien`);
    assert.throws(
      () => exigeContrainte(`Tu le remontes, ${sonde}.`, 'un énoncé de sonde'),
      `« ${sonde} » n’assouplit rien aux yeux de la garde, alors que c’est son objet même`,
    );
    vues.add(trouve[0].toLowerCase());
  }

  // Deux sondes qui déclenchent la MÊME tournure laisseraient une autre sans preuve, tout en
  // gardant le compte juste. C'est la porte que le compte seul n'a jamais fermée.
  assert.equal(
    vues.size, SONDES_DE_CONSEIL.length,
    'deux sondes déclenchent la même tournure : une autre n’est donc éprouvée par rien '
      + `(déclenchées : ${[...vues].join(' · ')})`,
  );
});

test('axe MODALITÉ : aucune tournure de conseil ne commence par \\b devant une initiale accentuée', () => {
  // La cause mécanique, gardée à la source plutôt qu'à ses effets. `\b` exige une frontière
  // entre caractère de mot et non-mot ; `é`, `à`, `ê` n'en sont pas, donc la frontière ne se
  // produit jamais. Le piège se retend à chaque tournure française ajoutée.
  for (const alt of alternativesDe(CONSEIL.source)) {
    const initiale = alt.match(/^\\b(.)/);
    assert.ok(
      !initiale || /\w/.test(initiale[1]),
      `la tournure « ${alt} » est morte-née : en JavaScript « ${initiale && initiale[1]} » n’est pas `
        + 'un caractère de mot, donc le \\b qui la précède ne s’apparie jamais. Retire-le.',
    );
  }
});

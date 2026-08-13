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
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUE LE DÉCOMPTE DIT, ET CE QU'IL NE DIT PAS
//
// « n mutations posées, n attrapées » se lit spontanément comme *le métier est gardé*.
// Il dit en réalité : **les n points auxquels on a pensé sont gardés.** Rien de plus.
//
// Le gabarit fait plus de trois cents lignes ; on n'en garde pas chaque phrase, et ce
// serait absurde d'essayer. Les garanties gardées ici sont celles que l'epic revendique
// et celles qu'un défaut réel a déjà coûtées. Le reste du texte est écrit, pas gardé.
//
// Cette précision n'est pas de la modestie de façade : une revue indépendante a posé douze
// mutations de son cru contre la première version de ces contrôles et **onze ont survécu**.
// Les douze sont désormais dans `MUTATIONS`, préfixées `revue-`. Un lecteur — ou un futur
// chantier qui s'appuierait sur ce harnais — doit savoir que le décompte mesure une
// couverture choisie, jamais une couverture totale.
//
// Corollaire pratique : quand une garantie du gabarit devient importante, on n'ajoute pas
// seulement un contrôle. On ajoute la mutation qui le met à l'épreuve — sans quoi on ne
// saura pas s'il garde quoi que ce soit.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONTROLES, MUTATIONS, PERMISSIF, exigeImperatif, lireGabarits } from './lib/metier-representant.js';

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

// ═════════════════════════════════════════ l'axe MODALITÉ, et sa panne silencieuse
//
// `PERMISSIF` est une LISTE DE TOURNURES, donc elle a un mode de panne que les autres gardes
// n'ont pas : **une alternative peut ne s'apparier à rien, jamais**. Elle est alors vraie par
// construction — l'axe est réputé couvert, et il ne l'est pas. Rien ne le dit : la suite reste
// verte, le vocabulaire a l'air riche, et l'assouplissement passe.
//
// CE N'EST PAS UNE CRAINTE THÉORIQUE : le cas s'est produit DEUX FOIS dans le même lot
// (T-20260813-0043), sur `\bà moins que` et `\bà ta discrétion`. En JavaScript, `à` n'est pas
// un caractère de mot : un `\b` posé devant ne s'apparie jamais. Les deux alternatives sont
// nées mortes, et c'est une mutation — pas une relecture — qui a fini par le dire.
//
// Ce test rend la panne impossible : chaque alternative doit être PROUVÉE VIVANTE par une
// sonde qui la déclenche, et le compte des sondes est apparié à celui des alternatives. En
// ajouter une sans sa sonde fait rougir, et c'est le but : ce qui n'est pas éprouvé n'existe pas.

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
 * Une sonde par alternative, dans l'ordre du motif. Elles ne sont PAS dérivées du motif :
 * une sonde fabriquée à partir de ce qu'on teste ne prouve rien — elle réussirait aussi bien
 * sur une alternative morte, puisqu'elle en serait la transcription.
 */
const SONDES_PERMISSIVES = [
  'tu peux le faire plus tard',
  'cette étape est facultative',
  'ce champ est optionnel',
  "ce n'est pas obligatoire",
  'si tu le souhaites, écris-le',
  'au besoin, ajoute-le',
  'de préférence avant la fin',
  'sauf si le dirigeant en demande un',
  'à moins que ça ne prenne cinq minutes',
  'si tu en as le temps',
  'si le temps le permet',
  'si possible, inscris-le',
  'dans la mesure du possible',
  'à ta discrétion',
  "même si ce n'est pas strictement nécessaire",
];

test('axe MODALITÉ : chaque tournure permissive est VIVANTE, et chacune a sa sonde', () => {
  const alternatives = alternativesDe(PERMISSIF.source);
  assert.equal(
    SONDES_PERMISSIVES.length, alternatives.length,
    `${SONDES_PERMISSIVES.length} sonde(s) pour ${alternatives.length} tournure(s) : une tournure `
      + `ajoutée sans sa sonde n'est prouvée par rien, et c'est exactement ainsi qu'on en écrit `
      + `une qui ne s'apparie jamais (${alternatives.join('  ·  ')})`,
  );

  const vues = new Set();
  for (const sonde of SONDES_PERMISSIVES) {
    const trouve = sonde.match(PERMISSIF);
    assert.ok(trouve, `la sonde « ${sonde} » ne déclenche AUCUNE tournure — elle ne prouve donc rien`);
    assert.throws(
      () => exigeImperatif(`Tu inscris le travail, ${sonde}.`, 'un énoncé de sonde'),
      `« ${sonde} » n'assouplit rien aux yeux de la garde, alors que c'est son objet même`,
    );
    vues.add(trouve[0].toLowerCase());
  }

  // Deux sondes qui déclenchent la MÊME tournure laisseraient une autre sans preuve, tout en
  // gardant le compte juste. C'est la porte que le compte seul n'a jamais fermée.
  assert.equal(
    vues.size, SONDES_PERMISSIVES.length,
    `deux sondes déclenchent la même tournure : une autre n'est donc éprouvée par rien `
      + `(déclenchées : ${[...vues].join(' · ')})`,
  );
});

test('axe MODALITÉ : aucune tournure ne commence par \\b devant une initiale accentuée', () => {
  // La cause mécanique du cas ci-dessus, gardée à la source plutôt qu'à ses effets. `\b` exige
  // une frontière entre caractère de mot et non-mot ; `à`, `é`, `ê` n'en sont pas, donc la
  // frontière ne se produit jamais. Le piège est le jumeau exact de `privé\b`, documenté sur
  // le canal privé du représentant — et il se retend à chaque tournure française ajoutée.
  for (const alt of alternativesDe(PERMISSIF.source)) {
    const initiale = alt.match(/^\\b(.)/);
    assert.ok(
      !initiale || /\w/.test(initiale[1]),
      `la tournure « ${alt} » est morte-née : en JavaScript « ${initiale && initiale[1]} » n'est pas `
        + `un caractère de mot, donc le \\b qui la précède ne s'apparie jamais. Retire-le.`,
    );
  }
});

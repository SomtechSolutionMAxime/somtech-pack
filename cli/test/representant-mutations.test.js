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

import {
  CONTROLES, MUTATIONS, PERMISSIF, exigeImperatif, lireGabarits,
  ANTERIORITE_SUR_LE_RELEVEMENT, POSTERIORITE_SUR_LE_RELEVEMENT, PRIORITE_DU_RELEVEMENT,
  sectionDe, etapesDe,
} from './lib/metier-representant.js';

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
  // ⚠️ LA FAMILLE DE L'ÉVITEMENT, entrée dans `PERMISSIF` en revue de fond (T-20260814-0033).
  // Elle y manquait, et sa première correction avait été écrite LOCALEMENT dans un seul
  // contrôle — laissant la dizaine d'autres appels d'`exigeImperatif` ouverts au même
  // assouplissement. Chaque forme a sa sonde ici, sans quoi une alternative morte-née
  // (« \bévite », qui ne s'apparie jamais) passerait pour une garde.
  'évite de trop tarder',
  "en évitant d'attendre la fin",
  // ⚠️ L'ORTHOGRAPHE ALTERNATIVE EST UNE TOURNURE À PART ENTIÈRE — posée par la revue de fond,
  // qui l'a fait passer sur l'étape 2 exactement comme le MAJEUR d'origine. Le régulateur ne
  // connaissait que « essaie » ; « essaye » est aussi correct, et assouplit tout autant.
  'essaye de le faire avant',
  'tente de le faire avant',
  'fais en sorte de le faire tôt',
  'efforce-toi de le faire tôt',
];

/**
 * Des énoncés PARFAITEMENT IMPÉRATIFS que `PERMISSIF` ne doit jamais reconnaître.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LA MOITIÉ QUI MANQUAIT, ET ELLE A COÛTÉ QUATRE DÉFAUTS D'UN COUP (revue de fond).
 *
 * `SONDES_PERMISSIVES` prouve que chaque alternative est VIVANTE — qu'elle attrape quelque
 * chose. Rien ne prouvait qu'aucune n'est TROP LARGE, et quatre l'étaient : `d.` (un
 * métacaractère pris pour une apostrophe) s'appariait sur « évite DAns ce cas » ;
 * `efforce-toi` sans borne, dans `xefforce-toi` ; `tâche de` sur « la tâche de fond » ;
 * `tenter d'` sur « sans rien tenter d'autre », qui vit dans deux compétences réelles.
 *
 * UNE GARDE QUI ROUGIT SUR DU TEXTE CORRECT EST PIRE QU'ABSENTE : le premier qui la
 * rencontre la retire, et emporte avec elle les tournures qu'elle gardait vraiment. Les deux
 * listes se tiennent donc par les deux bouts — l'une interdit les alternatives mortes-nées,
 * l'autre les alternatives trop larges.
 */
const TEXTES_IMPERATIFS = [
  "sans rien tenter d'autre", // vit dans deux compétences réelles — l'infinitif n'est pas un conseil
  'la tâche de fond reste la tienne',
  'ce qui a déjà été dit, essayé, tranché',
  "un « bonjour » est l'aveu qu'on cherche à éviter",
  // ⚠️ CES DEUX-LÀ DÉPARTAGENT DES FORMES QUE RIEN D'AUTRE NE DÉPARTAGE, et le premier jet de
  // cette liste les avait neutralisés en changeant le verbe — un cas de test qui ne teste plus
  // ce pour quoi il a été écrit. « évite dix » sépare `d['’]` de `d.` (le métacaractère) ;
  // « évite deux » sépare `de\b` de `de` nu, qui mord le mot suivant.
  'évite dix minutes de trajet au client',
  'évite deux allers-retours au client',
  'xefforce-toi de le faire', // la tournure enchâssée dans un mot n'en est pas une
  'tu dois essayer de comprendre le besoin avant de répondre', // l'infinitif, encore : le
  // principe posé pour « tenter » avait été enfreint sur son voisin « essayer », dans le
  // commit même qui l'écrivait.
  'le veilleur veille à ce qu’aucune ligne ne reste orpheline', // « veille à » ne se départage
  // pas de l'impératif — et « veilleur » est du vocabulaire central de ce dépôt.
  'tu remontes au dirigeant, au moment du constat',
  'tu nommes toujours la ligne que tu vises',
  'rien ne part avant qu’il ait dit « oui, c’est ça »',
];

test('axe MODALITÉ : aucune tournure n’est TROP LARGE — un énoncé impératif ne se lit pas comme un conseil', () => {
  for (const enonce of TEXTES_IMPERATIFS) {
    const trouve = enonce.match(PERMISSIF);
    assert.ok(
      !trouve,
      `« ${enonce} » est un énoncé impératif, et la garde y voit un assouplissement ` +
        `(« ${trouve && trouve[0]} ») : elle rougirait sur du texte correct, et se ferait retirer.`,
    );
    assert.doesNotThrow(() => exigeImperatif(enonce, 'un énoncé impératif'));
  }
});

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

// ═══════════════════════ l'axe POSITION-EN-PROSE, et la même panne silencieuse
//
// `POSTERIORITE_SUR_LE_RELEVEMENT` garde la règle `R4.7` de l'ABC du gestionnaire client :
// l'accusé de réception part AVANT le relèvement. Elle est née d'une MESURE — un lecteur neuf
// a relevé et remonté deux fois avant que le client n'entende un mot ; ce que le dirigeant a
// tranché le 2026-08-17, c'est la contradiction entre `CT-GCL-010` et `CT-GCL-022`, pas la
// règle. Le RANG ne peut pas la garder — le relèvement porte le rang 3 et l'accusé le rang 4,
// et ne pas renuméroter est un arbitrage de COORDINATION de ce chantier. C'est donc l'incise
// en prose qui porte la garantie, et ce motif qui interdit son contresens.
//
// ⚠️ IL A EXACTEMENT LE MODE DE PANNE DE `PERMISSIF`, ET IL L'A SUBI DEUX FOIS AVANT D'ÊTRE
// COMMITTÉ. Une alternative qui ne s'apparie à rien rend la garde vraie par construction :
// l'axe est réputé couvert, la mutation qu'il existe pour attraper reste verte, et rien ne
// le dit. Un premier jet oubliait l'espace entre l'alternance et le groupe suivant
// (« quand » + « tu auras » ne se rejoignaient jamais) ; un second gardait `lorsqu['’]`
// devant un `\s+`, c'est-à-dire un espace après l'apostrophe, que le français n'écrit pas.
// Les deux ont été trouvées par la MESURE, aucune par la relecture.
//
// Ce test rend la panne impossible : chaque introducteur déclaré dans le motif doit avoir sa
// sonde, le compte des deux est apparié, et deux sondes ne peuvent pas déclencher le même
// introducteur. En ajouter un sans sa sonde fait rougir — c'est le but.

/**
 * TOUS les items d'alternance d'un motif, à TOUS les niveaux — leurs bornes dans la source.
 *
 * ⚠️ DEUX VERSIONS SONT MORTES AVANT CELLE-CI, ET CHAQUE FOIS C'EST LA MESURE QUI L'A DIT.
 *
 * La première n'extrayait que le premier groupe `(?:a|b|c)` du motif : elle voyait 6 branches
 * sur 8, en se présentant comme complète. La seconde ne décomposait ce groupe que s'il était
 * EN TÊTE de son alternative — sur `ANTERIORITE_SUR_LE_RELEVEMENT`, dont le groupe variable
 * vient après `avant\s+(?:même\s+)?`, elle rendait **UNE SEULE** branche pour un motif qui en
 * porte quatre. Casser trois d'entre elles laissait la suite entièrement verte, y compris le
 * test qui prétendait les garder. Deux verts qui ne touchaient pas ce qu'ils prétendaient
 * éprouver, dans le lot même qui corrigeait ce défaut ailleurs.
 *
 * ÉNUMÉRER LA SYNTAXE ÉTAIT LA MAUVAISE QUESTION. Ce qu'on veut savoir n'est pas « combien
 * de branches ce motif porte-t-il », mais « chaque item sert-il à quelque chose » — et ça se
 * MESURE : on casse l'item, et on regarde si une sonde cesse de s'apparier. Un item qu'on
 * peut casser sans que rien ne bouge ne garde rien, quelle que soit sa place dans la source.
 * La mesure voit 15 items là où l'énumération en voyait 8, et elle en a désigné deux qui ne
 * servaient à rien.
 *
 * Les groupes SANS alternance sont ignorés : les casser rendrait `(?:(?!x)x)?` — un optionnel
 * vide, toujours appariable —, donc aucune sonde ne bougerait et le test crierait à tort.
 */
function itemsDAlternance(source) {
  const items = [];
  const pile = [{ debut: 0, coupes: [] }];
  const clore = (groupe, fin) => {
    if (!groupe.coupes.length) return; // un groupe sans choix n'a pas d'items à éprouver
    const bornes = [groupe.debut, ...groupe.coupes, fin];
    for (let k = 0; k < bornes.length - 1; k += 1) {
      items.push([k === 0 ? bornes[0] : bornes[k] + 1, bornes[k + 1]]);
    }
  };
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (c === '\\') { i += 1; continue; }                       // échappement : le suivant est littéral
    if (c === '[') {                                            // classe : ses `|` et `(` n'en sont pas
      while (i < source.length && source[i] !== ']') { if (source[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if (c === '(') {
      // ⚠️ `(?<=` et `(?<!` font QUATRE caractères, pas trois. Le premier jet supposait 3
      // partout et rendait un item corrompu (« =a » au lieu de « a ») sur un lookbehind.
      // ⚠️ ET LA CORRECTION A SUR-AFFIRMÉ À SON TOUR — relevé à la passe suivante : elle
      // écrivait « et `(?<nom>` » dans la même phrase, alors qu'un groupe NOMMÉ a un préfixe
      // de longueur VARIABLE (`(?<nom>` en fait 7). Sur `(?<nom>chat|chien)`, cette fonction
      // rend « om>chat » — le même item corrompu qu'elle venait de corriger ailleurs.
      // Aucun motif de ce dépôt n'utilise de groupe nommé (vérifié) : le piège est LATENT et
      // il est écrit ici plutôt que corrigé à l'aveugle en fin de lot, parce que le fermer
      // demande de lire jusqu'au `>` et qu'aucune mesure ne l'atteint aujourd'hui.
      const prefixe = source.startsWith('(?<', i) ? 4 : source.startsWith('(?', i) ? 3 : 1;
      pile.push({ debut: i + prefixe, coupes: [] });
      i += prefixe - 1;
      continue;
    }
    if (c === ')') { clore(pile.pop(), i); continue; }
    if (c === '|') pile[pile.length - 1].coupes.push(i);
  }
  clore(pile.pop(), source.length);
  return items;
}

/**
 * Chaque item d'alternance doit être NÉCESSAIRE à au moins une sonde : on le casse, et une
 * sonde au moins doit cesser de s'apparier. C'est le harnais de mutation de ce fichier,
 * retourné contre les motifs eux-mêmes.
 *
 * ⚠️ CE N'EST PAS UN APPARIEMENT DE COMPTES, et c'est délibéré. « n sondes pour n items » se
 * lit comme « chaque item est éprouvé » et ne le dit pas : il autorise deux sondes sur le
 * même item pendant qu'un troisième reste mort. Ici, un item mort tombe nommément, quel que
 * soit le nombre de sondes.
 */
function exigeItemsUtiles(motif, sondes, quoi) {
  const src = motif.source;
  const items = itemsDAlternance(src);
  assert.ok(items.length > 0, `${quoi} : le motif ne porte aucun choix — ce test ne prouve rien`);

  const inutiles = items
    .map(([a, b]) => [src.slice(a, b), new RegExp(`${src.slice(0, a)}(?!x)x${src.slice(b)}`, 'i')])
    .filter(([, casse]) => !sondes.some((s) => motif.test(s) && !casse.test(s)))
    .map(([texte]) => texte);

  assert.deepEqual(
    inutiles, [],
    `${quoi} : ces items ne servent à AUCUNE sonde — on peut les casser sans que rien ne bouge, `
      + `donc ils ne gardent rien et l'axe est réputé couvert alors qu'il ne l'est pas : `
      + `${inutiles.map((i) => `« ${i} »`).join('  ·  ')}`,
  );

  // Et symétriquement : une sonde qui ne déclenche rien ne prouve rien, et laisserait croire
  // qu'un item est couvert alors qu'il ne l'est plus.
  for (const sonde of sondes) {
    assert.match(sonde, motif, `${quoi} : la sonde « ${sonde} » ne déclenche RIEN — elle ne prouve donc rien`);
  }
  return items;
}

const SONDES_POSTERIEURES = [
  'quand tu auras fini de relever',
  'lorsque tu auras relevé',
  'une fois le relèvement terminé',
  'après le relèvement',
  'dès que tu as relevé',
  'sitôt le relèvement bouclé',
  // ⚠️ CES DEUX-LÀ N'ÉTAIENT ÉPROUVÉES PAR RIEN — les deux alternatives top-level que la
  // première version de `branchesDe` ne voyait pas. Casser l'une d'elles laissait tout vert.
  'après avoir fini de relever',
  'à la fin du relèvement',
  // ⚠️ CELLE-CI A ÉTÉ AJOUTÉE PARCE QUE LA MESURE L'A EXIGÉE : `ton relèvement` ne servait à
  // aucune sonde. Son voisin `aies` (« quand tu aies relevé ») a été RETIRÉ du motif au lieu
  // d'être couvert — aucune sonde française ne pouvait le rendre vivant.
  'après ton relèvement',
];

/**
 * Des énoncés que le motif ne doit JAMAIS reconnaître — dont le texte livré lui-même.
 *
 * ⚠️ C'est la moitié qui manquait à `PERMISSIF` et qui lui a coûté quatre défauts d'un coup.
 * Une garde de polarité qui rougit sur du texte correct est pire qu'absente : le premier qui
 * la rencontre la retire, et emporte ce qu'elle gardait vraiment. « dès que sa ligne est
 * ouverte » vit dans l'énoncé même que ce motif garde, et il ne parle pas de relèvement.
 */
const TEXTES_ANTERIEURS = [
  "**Accuse réception, si un message t'attend** — **avant même d'avoir fini de relever**, dès que sa ligne est ouverte. Voir « Ta continuité ».",
  "**Relève ce qui existe déjà** pour ce client (voir « Le relèvement »).",
  'Le relèvement peut durer ; l’inaccessibilité, non.',
  'dès que sa ligne est ouverte, l’accusé part avant le relèvement',
];

/**
 * Des énoncés d'accusé LÉGITIMES que la garde de renversement ne doit jamais reconnaître.
 *
 * ⚠️ Mesuré par une contre-vérification indépendante : appliquée à l'énoncé ENTIER, la garde
 * rougissait sur une phrase parfaitement correcte écrite APRÈS l'incise. « en réalité », « au
 * contraire », « dans les faits » sont du français ordinaire — ce qui les rend dangereux,
 * c'est d'envelopper LA phrase qui porte la consigne, pas de figurer dans l'énoncé.
 */
const ENONCES_LEGITIMES = [
  "**Accuse réception, si un message t'attend** — **avant même d'avoir fini de relever**, dès que sa ligne est ouverte. C'est, en réalité, la toute première chose que tu fais.",
  "**Accuse réception, si un message t'attend** — **avant même d'avoir fini de relever**, dès que sa ligne est ouverte. Au contraire de la remontée, elle n'attend pas ton relèvement.",
];

/**
 * Chaque branche du motif doit être PROUVÉE VIVANTE par au moins une sonde qui la déclenche,
 * branche par branche — pas par un appariement de COMPTES.
 *
 * ⚠️ LE COMPTE NE SUFFIT PAS, et c'est le fond de ce qu'une revue indépendante a trouvé ici.
 * « n sondes pour n branches » se lit comme « chaque branche est éprouvée » et ne le dit pas :
 * il autorise deux sondes sur la même branche pendant qu'une troisième reste morte. On compile
 * donc chaque branche SEULE et on exige qu'une sonde la déclenche — une branche qui ne
 * s'apparie à rien tombe alors nommément, quel que soit le nombre de sondes.
 */
function exigeBranchesVivantes(motif, sondes, quoi) {
  const branches = branchesDe(motif);
  const mortes = branches.filter((b) => !sondes.some((s) => new RegExp(b, 'i').test(s)));
  assert.deepEqual(
    mortes, [],
    `${quoi} : ces branches ne s'apparient à AUCUNE sonde — elles sont vraies par construction, `
      + `l'axe est réputé couvert et il ne l'est pas : ${mortes.join('  ·  ')}`,
  );
  return branches;
}

test('axe POSITION-EN-PROSE : chaque item du motif de POSTÉRIORITÉ sert à quelque chose', () => {
  const items = exigeItemsUtiles(
    POSTERIORITE_SUR_LE_RELEVEMENT, SONDES_POSTERIEURES, 'la subordination à la fin du relèvement');
  assert.ok(items.length >= 14,
    `le motif ne porte plus que ${items.length} item(s) d'alternance — si l'un a disparu, dis-le ici `
      + `plutôt que de laisser le test se rétrécir avec lui`);
});

/**
 * Une attaque par item pour la garde de POLARITÉ CONTRAIRE — celle qui traverse tout
 * l'énoncé parce qu'elle est ancrée sur le relèvement, et non sur des tournures.
 */
const SONDES_PRIORITAIRES = [
  'le relèvement passe en premier',
  'le relèvement vient d’abord',
  'le relèvement arrive avant',
  'relève d’abord, tu accuseras ensuite',
  'relèvement en premier',
  'd’abord le relèvement, puis l’accusé',
  'en premier, tu relèves',
  'commence par relever',
];

/**
 * Des textes du gabarit réel, où le relèvement est nommé SANS être dit prioritaire. Ils
 * prouvent que cette garde ne mord pas ce qu'elle traverse — elle s'applique à l'énoncé
 * ENTIER, donc son innocuité compte double.
 */
const RELEVEMENTS_LEGITIMES = [
  "**Accuse réception, si un message t'attend** — **avant même d'avoir fini de relever**, dès que sa ligne est ouverte. C'est, en réalité, la toute première chose que tu fais.",
  "**Accuse réception, si un message t'attend** — **avant même d'avoir fini de relever**, dès que sa ligne est ouverte. Au contraire de la remontée, elle n'attend pas ton relèvement.",
  '**Relève ce qui existe déjà** pour ce client (voir « Le relèvement »). Il peut avoir chez nous une histoire que tu ne connais pas.',
  'Le relèvement peut durer ; l’inaccessibilité, non.',
];

test('axe POLARITÉ CONTRAIRE : chaque item du motif de PRIORITÉ sert à quelque chose', () => {
  exigeItemsUtiles(PRIORITE_DU_RELEVEMENT, SONDES_PRIORITAIRES, 'la priorité affirmée du relèvement');
});

test('axe POLARITÉ CONTRAIRE : le motif ne mord pas un relèvement nommé sans être dit prioritaire', () => {
  for (const texte of RELEVEMENTS_LEGITIMES) {
    const trouve = texte.match(PRIORITE_DU_RELEVEMENT);
    assert.ok(
      !trouve,
      `« ${texte} » nomme le relèvement sans le dire prioritaire, et la garde y voit le contraire `
        + `(« ${trouve && trouve[0]} ») : elle traverse tout l'énoncé, donc elle rougirait souvent, `
        + `et se ferait retirer.`,
    );
  }
});

test('axe POSITION-EN-PROSE : chaque item du motif d’ANTÉRIORITÉ sert à quelque chose', () => {
  // ⚠️ Ce motif-ci a été le révélateur : la version précédente de ce test n'y voyait qu'UNE
  // branche pour quatre, parce que son groupe variable n'est pas en tête. Trois de ses quatre
  // items pouvaient être cassés sans qu'un seul test rougisse.
  exigeItemsUtiles(ANTERIORITE_SUR_LE_RELEVEMENT, [
    "avant même d'avoir fini de relever",
    "avant d'avoir relevé",
    'avant de finir de relever',
    'avant le relèvement',
    'avant la fin du relèvement',
  ], 'l’antériorité de l’accusé sur le relèvement');
});

test('axe POSITION-EN-PROSE : le motif n’est pas TROP LARGE — le texte livré ne s’y reconnaît pas', () => {
  for (const enonce of TEXTES_ANTERIEURS) {
    const trouve = enonce.match(POSTERIORITE_SUR_LE_RELEVEMENT);
    assert.ok(
      !trouve,
      `« ${enonce} » place l'accusé AVANT le relèvement, et la garde y voit le contraire `
        + `(« ${trouve && trouve[0]} ») : elle rougirait sur du texte correct, et se ferait retirer.`,
    );
  }
});

test('axe POSITION-EN-PROSE : l’antériorité se reconnaît DANS L’ÉNONCÉ que le contrôle regarde', () => {
  // ⚠️ CE TEST A D'ABORD MESURÉ LE MAUVAIS OBJET, et son échec l'a dit. Écrit sur le
  // DOCUMENT entier, il exigeait que l'antériorité ne s'y reconnaisse qu'une fois — et le
  // document en porte deux, la seconde parfaitement légitime (« Saluer avant d'avoir relevé »,
  // dans les anti-patterns). Le contrôle, lui, ne regarde que l'ÉNONCÉ de l'étape d'accusé.
  // Une mesure portée sur un objet ne conclut pas sur un autre : le test mesure désormais
  // exactement ce que la garde regarde.
  const s = sectionDe(ORIGINAL.metier, /ordre d.ouverture/i, 'sur l’ordre d’ouverture');
  const accuse = etapesDe(s.corps).find((e) => /accuse/i.test(e.libelle || ''));
  assert.ok(accuse, 'l’étape d’accusé de réception est introuvable dans l’ordre d’ouverture');

  assert.match(accuse.enonce, ANTERIORITE_SUR_LE_RELEVEMENT,
    'l’énoncé de l’accusé ne porte plus l’antériorité sur le relèvement en toutes lettres — '
      + 'or le RANG ne peut pas la porter : le relèvement le précède, et on ne renumérote pas');

  // Et le sens inverse, sur la mutation qui existe pour ça : elle doit lui FAIRE PERDRE
  // l'antériorité, sans quoi la garde du contrôle passerait quoi qu'on écrive.
  const retournee = MUTATIONS.find((m) => m.id === 'accuse-attend-la-fin-du-relevement');
  assert.ok(retournee, 'la mutation qui retourne l’incise a disparu — l’arbitrage n’est plus éprouvé');
  const mute = retournee.muter(ORIGINAL.metier);
  assert.notEqual(mute, ORIGINAL.metier, 'la mutation est inopérante : son motif ne mord plus');
  const accuseMute = etapesDe(sectionDe(mute, /ordre d.ouverture/i, 'sur l’ordre d’ouverture').corps)
    .find((e) => /accuse/i.test(e.libelle || ''));
  assert.doesNotMatch(accuseMute.enonce, ANTERIORITE_SUR_LE_RELEVEMENT,
    'l’énoncé retourné porte ENCORE l’antériorité : la garde du contrôle resterait verte sur lui');
  assert.match(accuseMute.enonce, POSTERIORITE_SUR_LE_RELEVEMENT,
    'l’énoncé retourné n’est pas reconnu comme une subordination à la fin du relèvement — '
      + 'la garde de polarité serait alors décorative');
});

// ═══════════════ COUPER LA SONDE, PAS SEULEMENT RETIRER LA CHOSE
//
// ⚠️ CE TEST MANQUAIT, ET SON ABSENCE A ÉTÉ MESURÉE, pas soupçonnée : une revue indépendante
// a REMIS `rangUnique` dans sa version boguée — celle qui rendait le même message pour deux
// réalités opposées — et la suite est restée ENTIÈREMENT VERTE (203/201/0). Le correctif
// était juste, et rien ne le gardait : il aurait pu disparaître au prochain refactor sans
// qu'un seul test s'en aperçoive. C'est la règle d'or n°6 prise en défaut par le lot qui
// venait de la citer.
//
// LA GARANTIE ÉPROUVÉE ICI : une garde qui rend LA MÊME VALEUR quand l'objet est absent et
// quand la sonde est aveugle ne garde rien — le lecteur du message ne peut pas savoir s'il
// doit RÉÉCRIRE l'étape ou seulement la RE-GRASSER. On teste donc « quand il n'y a rien »
// ET « quand on ne peut pas voir », et on exige que les deux se distinguent.

test('sonde aveugle ≠ objet absent : les deux situations ne rendent PAS le même message', () => {
  const ctl = CONTROLES.find((c) => c.id === 'accuse-precede-le-relevement');
  assert.ok(ctl, 'le contrôle de l’accusé de réception a disparu — ce test ne prouve plus rien');

  // L'étape est DÉRIVÉE du texte, jamais recopiée : un littéral figé ici cesserait
  // silencieusement de mordre le jour où la phrase bouge, et ce test deviendrait décoratif.
  const section = sectionDe(ORIGINAL.metier, /ordre d.ouverture/i, 'sur l’ordre d’ouverture');
  const accuse = etapesDe(section.corps).find((e) => /accuse/i.test(e.libelle || ''));
  assert.ok(accuse, 'l’étape d’accusé de réception est introuvable — la mutation serait inopérante');
  const ligne = `${accuse.rang}. ${accuse.enonce}`;

  const plainteSur = (metier) => {
    assert.notEqual(metier, ORIGINAL.metier, 'mutation INOPÉRANTE : le texte n’a pas changé');
    try { ctl.verifier({ ...ORIGINAL, metier }); return null; } catch (e) { return e.message; }
  };

  // (A) l'objet N'EXISTE PAS : l'étape est retirée du texte.
  const absente = plainteSur(ORIGINAL.metier.replace(`${ligne}\n`, ''));
  // (B) l'objet EXISTE, la SONDE est aveugle : même rang, même texte, gras retiré.
  const aveugle = plainteSur(ORIGINAL.metier.replace(ligne, ligne.replaceAll('**', '')));

  assert.ok(absente, 'l’étape supprimée ne fait rougir personne — l’absence n’est plus gardée');
  assert.ok(aveugle, 'l’étape dégraissée ne fait rougir personne — la cécité n’est plus vue');
  assert.notEqual(
    absente, aveugle,
    'l’objet absent et la sonde aveugle rendent le MÊME message, caractère pour caractère : '
      + 'la garde ne distingue plus « ça n’existe pas » de « je ne peux pas le voir » — '
      + `« ${absente} »`,
  );
  assert.match(
    aveugle, /ne peut pas conclure à une absence|aveugle/i,
    'le message de la sonde aveugle ne dit pas QUE la mesure est aveugle : il diffère de celui '
      + `de l’absence, et il n’en donne pas la raison — « ${aveugle} »`,
  );
});

test('axe POSITION-EN-PROSE : la garde de renversement ne mord pas un énoncé légitime', () => {
  // La garde regarde la PHRASE QUI PORTE l'incise, jamais l'énoncé entier. Sans cette
  // restriction, elle rougirait sur les énoncés ci-dessous — et une garde qui crie sur du
  // texte correct se fait retirer, en emportant ce qu'elle gardait vraiment.
  const ctl = CONTROLES.find((c) => c.id === 'accuse-precede-le-relevement');
  const section = sectionDe(ORIGINAL.metier, /ordre d.ouverture/i, 'sur l’ordre d’ouverture');
  const accuse = etapesDe(section.corps).find((e) => /accuse/i.test(e.libelle || ''));
  const ligne = `${accuse.rang}. ${accuse.enonce}`;

  for (const enonce of ENONCES_LEGITIMES) {
    const metier = ORIGINAL.metier.replace(ligne, `${accuse.rang}. ${enonce} Voir « Ta continuité ».`);
    assert.notEqual(metier, ORIGINAL.metier, `mutation INOPÉRANTE pour « ${enonce.slice(0, 40)}… »`);
    assert.doesNotThrow(
      () => ctl.verifier({ ...ORIGINAL, metier }),
      `le contrôle rougit sur un énoncé LÉGITIME — « ${enonce} »`,
    );
  }
});

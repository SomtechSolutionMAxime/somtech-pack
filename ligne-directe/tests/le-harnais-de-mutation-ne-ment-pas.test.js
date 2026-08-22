// LE HARNAIS DE MUTATION NE MENT PAS — le contrôle négatif devient une GARDE, pas une intention.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE BANC ÉPROUVE, ET POURQUOI IL EXISTE
//
// Une campagne de mutation sur ce module a rendu « 6/6 attrapées », puis « 2/2 », puis
// « 8/8 ». Les trois comptes portaient sur un harnais dont la copie NON MUTÉE rendait déjà
// 69 rouges sur 757 : chaque « rouge donc attrapée » l'était pour une raison sans rapport.
//
// > La correction du harnais n'est pas ce qui manquait le plus. Ce qui manquait, c'est qu'on
// > ne puisse plus lancer de campagne sans que ce contrôle ait eu lieu.
//
// Ce banc éprouve donc l'INSTRUMENT, pas le code qu'il mesure. Il pose la seule question qui
// permet à une campagne d'affirmer quoi que ce soit : **quand la copie intacte n'est pas verte,
// est-ce que le harnais REFUSE de rendre des verdicts ?**
//
// ⚠️ ET IL NE S'EN TIENT PAS AU DOUBLE. Les quatre premiers cas injectent un `lancer` de
// laboratoire — c'est ce qui permet d'éprouver un contrôle négatif rouge sans casser le dépôt.
// Mais un harnais éprouvé UNIQUEMENT contre son double est précisément le défaut que ce lot a
// payé ailleurs : le double est plus coopératif que le réel. Les deux derniers cas font donc
// tourner la VRAIE copie et la VRAIE suite, sur deux bancs témoins — et mesurent que la recette
// (« copier la racine, pas le seul module ») est vraie plutôt que de la déclarer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  campagne, copierLeDepot, lancerLaSuite, lancerToutesLesSuites, racineDuDepot, remplacerUnique,
} from './aide/harnais-de-mutation.js';

/** Un `preparer` de laboratoire : un jeton, pas un répertoire — on n'éprouve pas la copie ici. */
function laboratoire() {
  const copies = [];
  return {
    copies,
    preparer: () => {
      const c = `copie-${copies.length}`;
      copies.push(c);
      return c;
    },
    ranger: () => {},
  };
}

test('CONTRÔLE NÉGATIF ROUGE ⇒ AUCUN verdict, et AUCUNE mutation posée', () => {
  // ═══ LE BANC CENTRAL DE CE FICHIER. C'est très exactement l'état du 2026-08-22 : la copie
  // intacte rendait 69 rouges, et la campagne a quand même annoncé « 8 sur 8 attrapées ».
  const labo = laboratoire();
  let mutationsPosees = 0;

  const r = campagne({
    preparer: labo.preparer,
    ranger: labo.ranger,
    lancer: () => ({ tests: 757, pass: 688, fail: 69 }),
    mutations: [
      { id: 'peu-importe', appliquer: () => { mutationsPosees += 1; return true; } },
      { id: 'peu-importe-non-plus', appliquer: () => { mutationsPosees += 1; return true; } },
    ],
  });

  assert.equal(r.verdictPossible, false, 'un harnais dont la copie intacte est rouge ne peut RIEN affirmer');
  assert.deepEqual(r.resultats, [], 'et il ne rend AUCUN verdict — pas même un seul, pas même prudent');
  // ⚠️ CETTE LIGNE EST LA MOITIÉ QU'ON OUBLIE. Un harnais qui poserait les mutations puis
  // écarterait leurs verdicts aurait le même rendu et brûlerait le même temps ; surtout, la
  // prochaine main lirait ses journaux et y verrait des rouges à interpréter.
  assert.equal(mutationsPosees, 0, 'aucune mutation ne doit être POSÉE quand le verdict est impossible');
  assert.match(r.controleNegatif.refus, /69 rouge/, 'le refus doit NOMMER ce qu’il a mesuré');
  assert.match(r.controleNegatif.refus, /racine du dépôt/, 'et dire quel geste répare, pour qu’on ne l’excuse pas');
});

test('CONTRÔLE NÉGATIF VERT ⇒ la campagne tourne, et une mutation qui ne rougit pas est SURVIVANTE', () => {
  const labo = laboratoire();
  const rouges = new Map([['gardée', 3]]);
  let mutee = null;

  const r = campagne({
    preparer: labo.preparer,
    ranger: labo.ranger,
    lancer: () => ({ tests: 100, pass: 100 - (rouges.get(mutee) ?? 0), fail: rouges.get(mutee) ?? 0 }),
    mutations: [
      { id: 'gardée', appliquer: () => { mutee = 'gardée'; return true; } },
      { id: 'nue', appliquer: () => { mutee = 'nue'; return true; } },
    ],
  });

  assert.equal(r.verdictPossible, true);
  assert.deepEqual(
    r.resultats.map((x) => [x.id, x.verdict]),
    [['gardée', 'attrapée'], ['nue', 'SURVIVANTE']],
    // Une survivante rendue « attrapée » est le mensonge le plus coûteux du lot : elle
    // certifie une garde qui n'existe pas.
    'un vert sous mutation est une SURVIVANTE, jamais un silence à interpréter',
  );
});

test('UNE MUTATION INOPÉRANTE N’EST PAS UNE MUTATION — et surtout pas une attrapée', () => {
  const labo = laboratoire();
  // ⚠️ LE CONTRÔLE NÉGATIF EST VERT, ET LA SUITE ROUGIT ENSUITE — c'est le cas piégeux. La
  // mutation n'a rien changé au code ; le rouge vient d'ailleurs (un banc instable, une horloge,
  // un port occupé). Un harnais qui regarde seulement la couleur l'inscrirait « attrapée » et
  // certifierait une garde qui n'a jamais été éprouvée.
  let tour = 0;
  const r = campagne({
    preparer: labo.preparer,
    ranger: labo.ranger,
    lancer: () => (tour++ === 0 ? { tests: 10, pass: 10, fail: 0 } : { tests: 10, pass: 9, fail: 1 }),
    mutations: [{ id: 'motif-perime', appliquer: () => false }],
  });
  assert.equal(r.verdictPossible, true, 'le contrôle négatif est vert : la campagne doit tourner');
  assert.equal(r.resultats[0].verdict, 'INOPÉRANTE');
  // Sans cette distinction, un motif qui ne s'applique plus au code se compte comme une garde :
  // le harnais afficherait « n posées, n attrapées » sans qu'aucune n'ait été posée.
  assert.notEqual(r.resultats[0].verdict, 'attrapée');
});

test('UNE COPIE NEUVE PAR MUTATION — muter en groupe cache une survivante derrière une attrapée', () => {
  const labo = laboratoire();
  campagne({
    preparer: labo.preparer,
    ranger: labo.ranger,
    lancer: () => ({ tests: 10, pass: 10, fail: 0 }),
    mutations: [
      { id: 'une', appliquer: () => true },
      { id: 'deux', appliquer: () => true },
      { id: 'trois', appliquer: () => true },
    ],
  });
  // 1 contrôle négatif + 3 mutations = 4 copies distinctes. Trois copies signifierait que deux
  // mutations ont partagé un arbre, et « ça rougit » ne dirait plus LAQUELLE était gardée.
  assert.equal(labo.copies.length, 4, 'une copie pour le contrôle négatif, puis une par mutation');
  assert.equal(new Set(labo.copies).size, 4, 'et jamais deux fois la même');
});

test('UN LANCEMENT QUI N’EXÉCUTE RIEN EST UN REFUS, jamais « zéro échec »', () => {
  const labo = laboratoire();
  const r = campagne({
    preparer: labo.preparer,
    ranger: labo.ranger,
    lancer: () => ({ refus: 'la suite n’a rendu aucun compte (code 1, signal aucun)' }),
    mutations: [{ id: 'x', appliquer: () => true }],
  });
  // Un import cassé ferait sortir `node --test` sans résumé. Lu comme « 0 échec », il serait le
  // meilleur résultat possible du contrôle négatif — et toutes les mutations suivantes seraient
  // jugées sur un instrument mort.
  assert.equal(r.verdictPossible, false, 'un contrôle négatif qui n’a pas tourné ne vaut pas un contrôle négatif vert');
  assert.deepEqual(r.resultats, []);
});

test('LA CAMPAGNE NE PERD PAS SES VERDICTS ACQUIS quand une copie échoue en chemin', () => {
  // ⚠️ TROUVÉ EN REVUE DE FOND. `preparer()` vivait HORS du `try` : un disque plein à la
  // troisième copie faisait JETER la campagne, qui perdait alors les deux verdicts déjà mesurés.
  // S'arrêter devant ce qu'on ne peut pas mesurer est juste ; s'arrêter les mains vides ne l'est
  // pas — d'autant qu'un rapport sans résultat se lit comme « rien trouvé ».
  const labo = laboratoire();
  let tour = 0;
  const preparer = () => {
    tour += 1;
    if (tour === 4) throw new Error('ENOSPC: no space left on device');
    return labo.preparer();
  };
  const r = campagne({
    preparer,
    ranger: labo.ranger,
    lancer: () => ({ tests: 10, pass: 10, fail: 0 }),
    mutations: [
      { id: 'une', appliquer: () => true },
      { id: 'deux', appliquer: () => true },
      { id: 'trois-copie-impossible', appliquer: () => true },
    ],
  });
  assert.equal(r.verdictPossible, true);
  assert.equal(r.resultats.length, 3, 'les trois mutations sont rendues — aucune n’est effacée par l’échec');
  assert.deepEqual(r.resultats.slice(0, 2).map((x) => x.verdict), ['SURVIVANTE', 'SURVIVANTE'], 'les acquis tiennent');
  assert.equal(r.resultats[2].verdict, 'INDÉCIDABLE', 'et celle qu’on n’a pas pu poser est NOMMÉE, pas tue');
  assert.match(r.resultats[2].pourquoi, /ENOSPC/, 'avec la cause');
});

test('RÉEL — `lancerLaSuite` PRODUIT vraiment un refus quand la suite ne rend aucun compte', () => {
  // ⚠️ TROUVÉ EN REVUE PORTAIL, et c'est la moitié manquante du troisième faux témoin annoncé en
  // tête du harnais. Le banc de laboratoire ci-dessus éprouve que `campagne` RÉAGIT à un refus —
  // il l'injecte. Personne n'éprouvait que `lancerLaSuite` en PRODUISE un : neutraliser son
  // parsing (`?? 0` sur le compte d'échecs) laissait tout vert. Or c'est précisément cette
  // moitié-là qui a produit un faux « la suite n'a rendu aucun compte » sur une suite qui avait
  // parfaitement tourné.
  const copie = copierLeDepot();
  try {
    const r = lancerLaSuite(copie, { fichiers: ['tests/ce-fichier-n-existe-pas.test.js'] });
    assert.ok(r.refus, `un lancement qui n’exécute rien doit REFUSER, jamais rendre « 0 échec » (${JSON.stringify(r)})`);
    assert.equal(r.fail, undefined, 'et surtout ne pas rendre un compte d’échecs inventé');

    // Le contrôle positif dans le même souffle : sur un vrai fichier, il rend bien un compte.
    const bon = lancerLaSuite(copie, { fichiers: ['tests/canal-par-role.test.js'] });
    assert.ok(!bon.refus, `le contrôle positif doit tourner : ${bon.refus}`);
    assert.equal(bon.fail, 0);
    assert.ok(bon.tests > 0);
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test('RÉEL — une campagne peut mesurer TOUTES les suites, pas seulement celle du module muté', () => {
  // ⚠️ BORNE NOMMÉE PAR LA REVUE PORTAIL. `lieu-agent.js` est importé par
  // `naissance-representant` : une campagne qui ne lance que `ligne-directe` rendrait
  // SURVIVANTE une mutation que l'autre suite attrape, et le rapport dirait « garde manquante »
  // là où la garde existe, ailleurs. Le dénominateur d'un verdict de mutation, c'est l'ensemble
  // des essais qu'on a fait tourner — et il doit être RENDU, pas supposé.
  const copie = copierLeDepot();
  try {
    // ⚠️ UN FICHIER TÉMOIN PAR SUITE, PAS LES DEUX SUITES ENTIÈRES. Ce banc éprouve que la
    // fonction ATTEINT les deux et rend leur détail — pas la santé du dépôt, que la suite
    // complète mesure déjà par ailleurs. Les lancer en entier coûterait ~140 s à chaque essai,
    // et un banc plus lent que ce qu'il garde finit par être désarmé « en attendant ».
    const r = lancerToutesLesSuites(copie, {
      suites: [
        { sousDossier: 'ligne-directe', fichiers: ['tests/canal-par-role.test.js'] },
        { sousDossier: 'naissance-representant', fichiers: ['tests/garde-par-role.test.js'] },
      ],
    });
    assert.ok(!r.refus, `les deux suites doivent tourner : ${r.refus}`);
    assert.equal(r.fail, 0, 'contrôle négatif sur les DEUX suites');
    assert.ok(r.parSuite['ligne-directe'].tests > 0, 'et le détail par suite est rendu…');
    assert.ok(r.parSuite['naissance-representant'].tests > 0, '…pour les deux, sinon le total est un mystère');
    assert.equal(
      r.tests,
      r.parSuite['ligne-directe'].tests + r.parSuite['naissance-representant'].tests,
      'le total est la somme de ce qui a réellement tourné',
    );
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test('UN TOUR QUI EXÉCUTE MOINS D’ESSAIS QUE LE TÉMOIN EST INDÉCIDABLE, jamais « SURVIVANTE »', () => {
  // ⚠️ RÉSERVE DE REVUE DE FOND, et elle vise le cœur du harnais. Le dénominateur du tour muté
  // n'était comparé à RIEN. Une mutation qui fait DISPARAÎTRE des essais — un fichier qui
  // n'importe plus, un `describe` qui ne s'ouvre pas — sortait « SURVIVANTE » : le verdict le
  // plus accusateur, rendu sur une mesure amputée, et qui envoie écrire une garde qui existe.
  //
  // `lancerToutesLesSuites` refuse déjà une somme partielle un étage plus bas ; ici on ne
  // refusait rien.
  const labo = laboratoire();
  let tour = 0;
  const r = campagne({
    preparer: labo.preparer,
    ranger: labo.ranger,
    lancer: () => (tour++ === 0 ? { tests: 800, pass: 800, fail: 0 } : { tests: 40, pass: 40, fail: 0 }),
    mutations: [{ id: 'fait-disparaitre-des-essais', appliquer: () => true }],
  });
  assert.equal(r.verdictPossible, true, 'le contrôle négatif est vert : la campagne tourne');
  assert.equal(r.resultats[0].verdict, 'INDÉCIDABLE', '40 essais sur 800 ne prouvent aucune survie');
  assert.match(r.resultats[0].pourquoi, /40 essais contre 800/, 'et le refus donne LES DEUX chiffres');

  // Contrôle positif : à dénominateur égal, un vert reste bien une SURVIVANTE.
  let t2 = 0;
  const egal = campagne({
    preparer: labo.preparer,
    ranger: labo.ranger,
    lancer: () => (t2++ === 0 ? { tests: 800, pass: 800, fail: 0 } : { tests: 800, pass: 800, fail: 0 }),
    mutations: [{ id: 'vraiment-non-gardee', appliquer: () => true }],
  });
  assert.equal(egal.resultats[0].verdict, 'SURVIVANTE', 'à dénominateur égal, le verdict reste rendu');
});

test('UN MOTIF AMBIGU NE SE MUTE PAS — il rendrait un verdict sur un autre objet', () => {
  // ⚠️ MESURÉ AU CYCLE 6, ET J'AI FAILLI EN TIRER UNE FAUSSE CONCLUSION. Une mutation posée sur
  // `      journaliser,` a frappé la PREMIÈRE des deux occurrences de `veilleur.js` — dans une
  // autre fonction que celle visée. Elle est sortie « SURVIVANTE », et j'allais écrire qu'une
  // garde manquait là où elle mordait parfaitement.
  //
  // > Un motif AMBIGU est plus dangereux qu'un motif INTROUVABLE : l'introuvable se déclare
  // > inopérante, l'ambigu mute quelque chose et rend un verdict sur autre chose.
  const bac = mkdtempSync(join(tmpdir(), 'motif-'));
  try {
    const f = join(bac, 'code.js');

    // ① Deux occurrences : on REFUSE, et le fichier n'est pas touché.
    writeFileSync(f, 'a();\n  cible,\nb();\n  cible,\nc();\n');
    const avant = readFileSync(f, 'utf8');
    assert.equal(remplacerUnique(f, '  cible,', '  MUTÉ,'), false, 'un motif à 2 occurrences se refuse');
    assert.equal(readFileSync(f, 'utf8'), avant, 'et RIEN n’est écrit — sinon on mute au hasard');

    // ② Zéro occurrence : on refuse aussi (le motif ne s’applique plus au code).
    assert.equal(remplacerUnique(f, 'motif-absent', 'x'), false, 'un motif introuvable se refuse');

    // ③ Une seule : on remplace, et c’est bien CELLE-LÀ.
    writeFileSync(f, 'a();\n  cible,\nb();\n');
    assert.equal(remplacerUnique(f, '  cible,', '  MUTÉ,'), true, 'un motif unique se remplace');
    assert.match(readFileSync(f, 'utf8'), /MUTÉ,/, 'et le texte a changé pour de vrai');

    // ④ Un remplacement qui ne change rien est refusé — sinon « attrapée » sur du sur-place.
    assert.equal(remplacerUnique(f, '  MUTÉ,', '  MUTÉ,'), false, 'un remplacement inerte se refuse');
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
});

// ═════════════════ LE RÉEL — la recette se MESURE, elle ne se déclare pas

test('RÉEL — la copie de la RACINE est verte, et `ligne-directe/` SEUL est rouge', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // LES DEUX MOITIÉS SONT INDISPENSABLES, et la seconde est celle qu'on oublie.
  //
  // « La racine est verte » prouve que la recette actuelle marche. Elle ne dit pas qu'elle
  // SERT À QUELQUE CHOSE : si copier le seul module suffisait, le filtre de `copierLeDepot`
  // pourrait être resserré demain pour « aller plus vite », et rien ne rougirait — jusqu'à la
  // prochaine campagne qui rendrait des verdicts sur 69 faux rouges.
  //
  // Les deux bancs témoins sont choisis pour TRAVERSER la frontière du module : `lieu-expose`
  // importe `../../naissance-representant/src/naissance.js`, `canal-par-role` lit les gabarits
  // de `.claude/templates/` à la racine du dépôt.
  const TEMOINS = ['tests/canal-par-role.test.js', 'tests/lieu-expose.test.js'];

  const racine = copierLeDepot();
  let vert;
  try {
    vert = lancerLaSuite(racine, { fichiers: TEMOINS });
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
  assert.ok(!vert.refus, `la copie de la racine n’a pas tourné : ${vert.refus}`);
  assert.equal(vert.fail, 0, `la copie de la RACINE doit être verte sans aucune mutation (${vert.fail} rouge(s))`);
  assert.ok(vert.tests > 0, 'et elle doit avoir réellement exécuté des tests');

  const seul = copierLeDepot({ sousLaRacineSeulement: 'ligne-directe' });
  let fautive;
  try {
    fautive = lancerLaSuite(seul, { fichiers: TEMOINS });
  } finally {
    rmSync(seul, { recursive: true, force: true });
  }
  assert.ok(!fautive.refus, `la copie fautive n’a pas tourné : ${fautive.refus}`);
  assert.ok(
    fautive.fail > 0,
    'copier `ligne-directe/` SEUL doit rendre des rouges SANS mutation — si ce n’est plus vrai, ' +
      'le motif de ce harnais a changé et ce banc doit être réécrit, pas assoupli',
  );
});

test('RÉEL — un harnais lancé DEPUIS un harnais refuse, au lieu de se répéter sans fin', () => {
  // ⚠️ DÉFAUT MESURÉ EN ÉCRIVANT CE FICHIER, pas déduit : 69 copies du dépôt en dix minutes,
  // jusqu'à ce que la commande soit tuée. Les bancs de ce harnais VIVENT dans la suite qu'il
  // lance : sans liste de fichiers, `node --test` les retrouve dans la copie, ils relancent une
  // copie, et ainsi de suite. Chaque niveau a l'air de travailler — rien ne signale la boucle.
  //
  // La borne est une PROFONDEUR, pas une exclusion de fichiers : écarter ces bancs de la copie
  // les priverait d'être éprouvés sous mutation, c'est-à-dire le contraire du but.
  //
  // ⚠️ C'EST UN PLAFOND, PAS UN REFUS AU PREMIER EMBOÎTEMENT — corrigé après une revue de fond.
  // Refuser dès la profondeur 1 rendait ROUGES, dans toute copie, les cinq bancs « RÉEL » de ce
  // fichier : le chemin documenté du harnais (`lancerToutesLesSuites` sans liste de fichiers)
  // rendait alors 5 rouges au contrôle négatif, et `campagne` refusait en accusant la RECETTE DE
  // COPIE — un refus juste dans sa forme et faux dans son motif. Et ces cinq bancs n'étaient
  // jamais éprouvés sous mutation, faute de pouvoir tourner dans une copie.
  const avant = process.env.SOUS_HARNAIS_DE_MUTATION;
  const copie = copierLeDepot();
  try {
    // ① Au PLAFOND : on refuse, et on dit pourquoi.
    process.env.SOUS_HARNAIS_DE_MUTATION = '2';
    const bloque = lancerLaSuite('/chemin/sans/importance', { fichiers: ['tests/canal-par-role.test.js'] });
    assert.ok(bloque.refus, 'au plafond, le lancement doit REFUSER');
    assert.match(bloque.refus, /profondeur 2/, 'et nommer la profondeur, sinon on le prend pour une panne');

    // ② SOUS le plafond : ça tourne. Sans cette moitié, une garde qui refuserait TOUJOURS
    //    rendrait ce banc vert en cassant tout le harnais — et c'est le défaut qu'on répare ici.
    process.env.SOUS_HARNAIS_DE_MUTATION = '1';
    const emboite = lancerLaSuite(copie, { fichiers: ['tests/canal-par-role.test.js'] });
    assert.ok(!emboite.refus, `à la profondeur 1, le lancement doit TOURNER : ${emboite.refus}`);
    assert.equal(emboite.fail, 0);

    // ③ Et au premier niveau, hors de tout harnais, évidemment aussi.
    delete process.env.SOUS_HARNAIS_DE_MUTATION;
    const nu = lancerLaSuite(copie, { fichiers: ['tests/canal-par-role.test.js'] });
    assert.ok(!nu.refus, `hors harnais, le lancement doit tourner : ${nu.refus}`);
  } finally {
    if (avant === undefined) delete process.env.SOUS_HARNAIS_DE_MUTATION;
    else process.env.SOUS_HARNAIS_DE_MUTATION = avant;
    rmSync(copie, { recursive: true, force: true });
  }
});

test('UN CONTRÔLE NÉGATIF QUI N’A EXÉCUTÉ AUCUN ESSAI NE VAUT PAS UN CONTRÔLE NÉGATIF VERT', () => {
  // ⚠️ REJET DE REVUE DE FOND. `lancerLaSuite` porte cette garde ; les DEUX étages au-dessus —
  // ceux qu'une campagne appelle réellement — ne l'avaient pas. Une campagne pouvait donc
  // conclure « SURVIVANTE » sur un contrôle négatif à `{ tests: 0, fail: 0 }` : zéro rouge sur
  // zéro essai se lit comme une copie saine.
  //
  // Le mensonge penche du côté prudent — il sur-déclare des gardes manquantes plutôt que d'en
  // bénir l'absence — mais c'est un verdict rendu sans contrôle, et ce harnais est versionné
  // comme l'instrument qui refuse précisément cela.
  const labo = laboratoire();
  let posees = 0;
  const r = campagne({
    preparer: labo.preparer,
    ranger: labo.ranger,
    lancer: () => ({ tests: 0, pass: 0, fail: 0 }),
    mutations: [{ id: 'x', appliquer: () => { posees += 1; return true; } }],
  });
  assert.equal(r.verdictPossible, false, 'zéro rouge sur zéro essai n’est pas une copie verte');
  assert.deepEqual(r.resultats, [], 'et surtout pas une « SURVIVANTE », qui enverrait écrire une garde existante');
  assert.equal(posees, 0, 'aucune mutation n’est posée');
  assert.match(r.controleNegatif.refus, /AUCUN essai/, 'le refus nomme la vraie cause');

  // Et la même faille un étage plus bas : une liste de suites vide.
  const vide = lancerToutesLesSuites('/peu/importe', { suites: [] });
  assert.ok(vide.refus, 'aucune suite désignée : il n’y a rien à mesurer');
});

test('RÉEL — un tour MUTÉ qui n’exécute aucun essai est INDÉCIDABLE, jamais « SURVIVANTE »', () => {
  // ⚠️ MUTATION SURVIVANTE, TROUVÉE EN REVUE PORTAIL. `lancerLaSuite` porte bien la garde
  // « zéro essai exécuté » — mais le seul banc qui l'approchait déclenchait en réalité la garde
  // PRÉCÉDENTE (`tests === null`, aucun compte du tout). Retirer la garde `tests === 0` laissait
  // les 819 essais verts.
  //
  // ⚠️ ET LE DANGER EST DU CÔTÉ DU TOUR MUTÉ, pas du témoin. `campagne` garde son contrôle
  // négatif ; un TOUR qui n'exécute rien rendait `{verdict: 'SURVIVANTE', rouges: 0, tests: 0}` —
  // un verdict rendu sur ZÉRO mesure, sous le nom qui signifie « cette garde manque ». C'est mot
  // pour mot le troisième faux témoin que l'en-tête du harnais déclare fermé.
  const copie = copierLeDepot();
  try {
    // Contrôle positif : la garde ne se déclenche pas sur un lancement qui exécute vraiment.
    const bon = lancerLaSuite(copie, { fichiers: ['tests/canal-par-role.test.js'] });
    assert.ok(!bon.refus, `contrôle positif : ${bon.refus}`);
    assert.ok(bon.tests > 0);

    // Un sous-dossier réel qui ne porte AUCUN banc : `node --test` sort en 0, rend « ℹ tests 0 ».
    const vide = lancerLaSuite(copie, { sousDossier: 'ligne-directe/src' });
    assert.ok(vide.refus, `zéro essai exécuté doit REFUSER (rendu : ${JSON.stringify(vide)})`);
    assert.match(vide.refus, /AUCUN test/, 'et nommer la vraie cause');
    assert.equal(vide.fail, undefined, 'surtout pas un compte d’échecs inventé');

    // Et le verdict que la campagne en tire : INDÉCIDABLE, jamais SURVIVANTE.
    let tour = 0;
    const c2 = campagne({
      preparer: () => copie,
      ranger: () => {},
      lancer: () => (tour++ === 0 ? { tests: 10, pass: 10, fail: 0 } : { refus: 'la suite n’a exécuté AUCUN test' }),
      mutations: [{ id: 'x', appliquer: () => true }],
    });
    assert.equal(c2.resultats[0].verdict, 'INDÉCIDABLE', 'un tour sans mesure ne rend PAS « SURVIVANTE »');
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test('RÉEL — une suite qui REFUSE arrête le total : une somme partielle n’est pas un total', () => {
  // ⚠️ MUTATION SURVIVANTE, TROUVÉE EN REVUE PORTAIL, et la docstring de `lancerToutesLesSuites`
  // interdit pourtant cette conduite en toutes lettres. Remplacer le `return { refus }` par un
  // `continue` laissait les 819 essais verts, et rendait `{tests: 819, fail: 0}` alors que la
  // seconde suite n'avait jamais tourné.
  //
  // Conséquence : une mutation de `lieu-agent.js` que SEULS les 513 essais de
  // `naissance-representant` attrapent serait rendue SURVIVANTE — et si toutes les suites
  // refusent, `{tests: 0, fail: 0}` passerait pour un vert.
  const copie = copierLeDepot();
  try {
    const partiel = lancerToutesLesSuites(copie, {
      suites: [
        { sousDossier: 'ligne-directe', fichiers: ['tests/canal-par-role.test.js'] },
        'suite-qui-nexiste-pas',
      ],
    });
    assert.ok(partiel.refus, `une suite qui refuse doit ARRÊTER le total (rendu : ${JSON.stringify(partiel)})`);
    assert.match(partiel.refus, /suite-qui-nexiste-pas/, 'et nommer LAQUELLE');
    assert.equal(partiel.tests, undefined, 'aucun total partiel ne sort — il se lirait comme un total');

    // Contrôle positif : deux suites qui tournent rendent bien leur somme et leur détail.
    const complet = lancerToutesLesSuites(copie, {
      suites: [
        { sousDossier: 'ligne-directe', fichiers: ['tests/canal-par-role.test.js'] },
        { sousDossier: 'naissance-representant', fichiers: ['tests/garde-par-role.test.js'] },
      ],
    });
    assert.ok(!complet.refus, `contrôle positif : ${complet.refus}`);
    assert.equal(complet.fail, 0);
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test('RÉEL — une vraie mutation du code source fait rougir la vraie suite', () => {
  // Le contrôle POSITIF du harnais complet : sans lui, « la racine est verte » resterait vrai
  // le jour où `lancerLaSuite` cesserait d'atteindre le code (mauvais `cwd`, mauvais fichiers),
  // et le contrôle négatif serait vert pour la pire des raisons.
  const r = campagne({
    preparer: () => copierLeDepot(),
    lancer: (copie) => lancerLaSuite(copie, { fichiers: ['tests/canal-par-role.test.js'] }),
    mutations: [
      {
        id: 'le-role-se-replie-sur-orchestrateur',
        appliquer: (copie) => {
          const f = join(copie, 'ligne-directe', 'src', 'lieu-agent.js');
          const avant = readFileSync(f, 'utf8');
          const apres = avant.replace('    if (concorde) return nom;', "    if (concorde) return 'orchestrateur';");
          if (apres === avant) return false;
          writeFileSync(f, apres);
          return true;
        },
      },
    ],
  });

  assert.equal(r.verdictPossible, true, `contrôle négatif : ${r.controleNegatif.refus ?? 'vert'}`);
  assert.equal(r.controleNegatif.fail, 0);
  assert.equal(
    r.resultats[0].verdict,
    'attrapée',
    `une mutation réelle du code doit rougir (verdict : ${JSON.stringify(r.resultats[0])})`,
  );
});

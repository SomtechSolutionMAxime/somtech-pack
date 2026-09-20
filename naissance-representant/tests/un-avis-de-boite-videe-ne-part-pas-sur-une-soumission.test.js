// L'AVIS DE BOÎTE VIDÉE NE PART PLUS QUAND SON AUTEUR VIENT DE SOUMETTRE (T-20260920-0125).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA MESURE QUI COMMANDE CE FICHIER, FAITE LE 2026-09-20 SUR UN BANC RÉEL
//
// `avisDeBoiteVidee` portait son propre aveu : « deux causes possibles, et je ne peux pas les
// distinguer : tu l'as soumis toi-même, ou il a disparu sans être soumis ». Le commentaire
// n'est pas une mesure — il a été éprouvé, sur un pane herdr jetable, agent `claude` neuf :
//
//   • boîte vue PLEINE puis VIDÉE par `ctrl+u` (aucune soumission) →
//     `tokens.quota_topic` de `herdr agent get` : `null` → `null`, INCHANGÉ ;
//   • boîte vue PLEINE puis VIDÉE par `enter` (soumission) →
//     `quota_topic` : `null` → `"BANC CAS A reponds juste OK"`, LE TEXTE SOUMIS ;
//   • second tour, `quota_topic` déjà rempli → il CHANGE encore, vers le nouveau texte.
//
// Le signal existe donc, et c'est `quota_topic`. Calibration mesurée : **tronqué à 77
// caractères suivis de `…` (U+2026)** — 144 caractères envoyés, 78 rendus. Toute comparaison
// se fait donc EN PRÉFIXE, jamais en égalité, et ce fichier le garde.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LES DEUX CHEMINS, ET C'EST « UNE PORTE SUR DEUX » QUI EST EN JEU
//
// Le message existe à DEUX endroits dans `avisDeBoiteVidee` : le chemin ESPACE RÉSERVÉ (texte
// collé, illisible) et le chemin TEXTE LISIBLE. Dix occurrences de « une porte sur deux » ont
// déjà été payées sur ce dépôt, dont deux dans le correctif du défaut lui-même. Chaque essai
// d'ici porte donc sur LES DEUX, et un essai qui n'en couvrirait qu'un est un essai à refaire.
//
// Et les deux chemins n'ont PAS le même critère, et c'est mesuré : sur cette session-là, un
// brief arrivé COLLÉ — écran replié en espace réservé — avait un `quota_topic` portant le
// TEXTE RÉEL, celui que le veilleur n'a jamais pu lire. La comparaison de préfixe y est donc
// impossible ; le critère s'y réduit au CHANGEMENT de `quota_topic`.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE QUE CE FICHIER NE DOIT SURTOUT PAS LAISSER PASSER
//
//   • que la garde MANGE l'avis utile — le cas « disparu sans soumission » est celui pour
//     lequel tout ce chemin existe (T-20260817-0090, un ordre du CTO perdu sans témoin) ;
//   • que la garde passe au vert ALORS QUE LA SONDE EST AVEUGLE. Un essai qui couvre « il n'y
//     a pas eu de soumission » reste parfaitement vert avec une sonde morte : le dernier
//     bloc COUPE la sonde et exige que le résultat DIFFÈRE ;
//   • que le balayage, la livraison des boîtes oubliées ou la relance des messages gardés
//     soient désactivés au passage — `delivrerLaBoite` doit continuer à rendre `ok` et
//     `texteDisparu` exactement comme avant.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { delivrerLaBoite, avisDeBoiteVidee } from '../src/livraison.js';
import {
  soumissionEtablie,
  verdictDeSoumission,
  etablieSurUnPrefixeTronque,
  VERDICTS_DE_SOUMISSION,
} from '../../ligne-directe/src/delivrance.js';

// ⚠️ LE DOUBLE D'ÉCRAN EST REPRIS DE `une-boite-videe-ne-se-tait-pas.test.js`, AU CARACTÈRE
// PRÈS — pas réécrit. Un double qui s'écarte du service qu'il imite ne prouve rien.
const SEP = '─'.repeat(40);
const boiteAvec = (texte) => [SEP, `❯ ${texte}`, SEP, '  ⏵⏵ auto mode on'].join('\n');
const BOITE_VIDE = [SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');

const TEXTE = 'fais le orchestrator-state et le correctif de la ligne';
const REPLI = '[Pasted text #6]';

// Ce que `quota_topic` rend d'un texte de plus de 77 caractères — mesuré sur le banc.
const LONG = 'ABCDEFGHIJ0123456789abcdefghij0123456789KLMNOPQRST0123456789klmnopqrst0123456789 fin du texte';
const LONG_TRONQUE = `${LONG.slice(0, 77)}…`;

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE VERDICT — fonction pure, et c'est la seule chose qui décide
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le verdict est FAUX quand rien n’a été soumis — le sujet du dernier tour n’a pas bougé', () => {
  assert.equal(
    soumissionEtablie({ sujetAvant: 'un tour d’avant', sujetApres: 'un tour d’avant', texteDisparu: TEXTE }),
    false,
  );
});

test('le verdict est VRAI quand le sujet du dernier tour devient le texte disparu', () => {
  assert.equal(soumissionEtablie({ sujetAvant: 'un tour d’avant', sujetApres: TEXTE, texteDisparu: TEXTE }), true);
});

test('la comparaison est un PRÉFIXE, jamais une égalité — `quota_topic` tronque à 77 + `…`', () => {
  // Mesuré : 144 caractères envoyés, 78 rendus. Une égalité stricte rendrait la garde morte sur
  // tout texte un peu long, c'est-à-dire sur la quasi-totalité de ce qui bloque une boîte.
  assert.equal(soumissionEtablie({ sujetAvant: null, sujetApres: LONG_TRONQUE, texteDisparu: LONG }), true);
  assert.equal(
    soumissionEtablie({ sujetAvant: null, sujetApres: LONG_TRONQUE, texteDisparu: TEXTE }),
    false,
    'un sujet tronqué qui ne préfixe PAS le texte disparu ne prouve rien',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LE TEXTE PEUT AUSSI GRANDIR ENTRE LES DEUX LECTURES — et c'est le cas le PLUS COURANT
//
// Relevé en passe de revue de fond, bloquant, et le rejet était juste. La première version de
// ce verdict n'admettait qu'une seule direction : le sujet rendu devait être un PRÉFIXE du
// texte disparu. Cela couvre la TRONCATURE — le texte rétrécit parce que `quota_topic` coupe
// à 77 caractères — et rien d'autre.
//
// Or la boîte se vide parce que quelqu'un revient à son clavier. Ce qu'il fait alors, le plus
// souvent, c'est FINIR SA PHRASE avant d'appuyer sur Entrée. Le texte figé à la première
// observation est alors un préfixe de ce qui est parti, et non l'inverse :
//
//   observé  : « fais le orchestrator-state »
//   soumis   : « fais le orchestrator-state et le correctif de la ligne »
//
// L'ancienne règle rendait `aucune-soumission` — donc l'avis partait, donc le dirigeant était
// averti d'une perte sur le texte qu'il venait lui-même de soumettre. **C'est exactement le
// défaut que ce lot existe pour fermer, laissé ouvert sur son chemin le plus probable.**
//
// ⚠️ ET LE CAS N'EST PAS RATTRAPÉ AILLEURS : si le texte avait changé SANS être soumis,
// `delivrerLaBoite` rendrait `bouge` et on ne serait pas ici. On n'arrive dans cette branche
// que parce que la boîte a été vue VIDE.
//
// La règle porte donc désormais sur la RELATION, pas sur une direction choisie d'avance.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('⚠️ l’auteur a COMPLÉTÉ sa phrase avant de soumettre — le sujet est plus long, et c’est bien lui', () => {
  assert.equal(
    verdictDeSoumission({
      sujetAvant: 'un tour d’avant',
      sujetApres: 'fais le orchestrator-state et le correctif de la ligne',
      texteDisparu: 'fais le orchestrator-state',
    }),
    VERDICTS_DE_SOUMISSION.ETABLIE,
  );
});

test('l’auteur a EFFACÉ la fin avant de soumettre — le sujet est plus court, non tronqué', () => {
  // La symétrie de l'autre : il raccourcit au lieu d'allonger. Rien ne distingue ce cas du
  // précédent quant à ce qu'on sait — dans les deux, ce qui est parti est ce qu'on avait vu.
  assert.equal(
    verdictDeSoumission({
      sujetAvant: 'un tour d’avant',
      sujetApres: 'fais le orchestrator-state',
      texteDisparu: 'fais le orchestrator-state et le correctif de la ligne',
    }),
    VERDICTS_DE_SOUMISSION.ETABLIE,
  );
});

// ⚠️ LE SUJET EST UNE LIGNE, LE TEXTE PEUT EN AVOIR ONZE — et rien ne le gardait.
//
// Mesuré sur le banc du 2026-09-20 : un texte de onze lignes soumis d'un coup rendait
// `quota_topic` = « ligne 1 du texte colle du banc cas C ». Le sujet ne porte QUE la première
// ligne. Sans normalisation des blancs, le texte disparu contient des retours à la ligne que
// le sujet n'a pas, `startsWith` échoue, et la garde est morte sur tout texte multi-ligne —
// c'est-à-dire sur la plupart de ce qui bloque vraiment une boîte.
//
// La mutation qui retire l'aplatissement SURVIVAIT jusqu'à cet essai.

test('⚠️ un texte disparu MULTI-LIGNE — le sujet n’en porte que la première, et ça suffit', () => {
  const MULTI = ['ligne 1 du texte collé', 'ligne 2 du texte collé', 'ligne 3 du texte collé'].join('\n');
  assert.equal(
    verdictDeSoumission({ sujetAvant: 'un tour d’avant', sujetApres: 'ligne 1 du texte collé', texteDisparu: MULTI }),
    VERDICTS_DE_SOUMISSION.ETABLIE,
  );
});

test('⚠️ et les blancs multiples ne cassent pas la garde non plus', () => {
  // Un écran rend parfois deux espaces là où il y en avait un, ou un saut de ligne au milieu
  // d'une phrase repliée. Ce sont les mêmes caractères pour un lecteur, ils doivent l'être ici.
  assert.equal(
    verdictDeSoumission({
      sujetAvant: 'un tour d’avant',
      sujetApres: 'fais le orchestrator-state',
      texteDisparu: 'fais   le\n orchestrator-state et le correctif',
    }),
    VERDICTS_DE_SOUMISSION.ETABLIE,
  );
});

test('un sujet NON tronqué sans aucune parenté avec le texte disparu ne prouve rien', () => {
  // La règle élargie ne doit pas devenir « tout changement vaut soumission » — ce serait le
  // critère du chemin espace réservé appliqué là où on a de quoi faire mieux.
  assert.equal(
    verdictDeSoumission({
      sujetAvant: 'un tour d’avant',
      sujetApres: 'un message qui ne ressemble à rien de ce qu’on avait vu',
      texteDisparu: TEXTE,
    }),
    VERDICTS_DE_SOUMISSION.AUCUNE,
  );
});

test('⚠️ un sujet TRONQUÉ garde la direction stricte — il est coupé, il ne peut pas être plus long', () => {
  // On ne relâche QUE le cas non tronqué. Un sujet qui finit par `…` est une vue partielle :
  // exiger qu'il préfixe le texte disparu reste la seule lecture juste, et l'inverse (le texte
  // disparu préfixant un sujet coupé) n'aurait aucun sens.
  assert.equal(
    verdictDeSoumission({ sujetAvant: null, sujetApres: LONG_TRONQUE, texteDisparu: LONG }),
    VERDICTS_DE_SOUMISSION.ETABLIE,
  );
  assert.equal(
    verdictDeSoumission({ sujetAvant: null, sujetApres: LONG_TRONQUE, texteDisparu: 'ABCDEFGHIJ' }),
    VERDICTS_DE_SOUMISSION.AUCUNE,
    'un texte disparu plus court qu’un sujet TRONQUÉ ne peut pas être ce qui a été soumis',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LE MESSAGE DIFFUSÉ EN MASSE — le faux positif que la mesure a fait apparaître
//
// Soulevé par le coordonnateur APRÈS que la mesure de collision eut écarté sa crainte
// initiale : ce n'est pas la brièveté qui fait collisionner nos textes, ce sont les messages
// IDENTIQUES envoyés à plusieurs agents (la ronde, un ordre de fermeture). Mesuré sur le
// parc : 11 des 30 sujets réels sont des doublons exacts d'un autre, et 100 % des collisions
// au-delà de 40 caractères sont des sujets identiques sur toute leur longueur visible.
//
// Le scénario : la boîte porte la ronde #1, NON soumise. L'agent soumet la ronde #2, qui est
// le même texte. `quota_topic` correspond alors au texte disparu, et le verdict conclut à une
// soumission — alors que la ronde #1 a bien été PERDUE.
//
// Trois cas, et ils ne valent pas la même chose. Ces essais les FIGENT, y compris ceux qu'on
// accepte : un comportement accepté sans essai est un comportement qu'on croira un jour avoir
// été oublié.
// ═══════════════════════════════════════════════════════════════════════════════════════

const RONDE = "C'est l'heure de ta ronde. Fais le tour de tes agents ouverts et rends-moi l'état.";

test('message en masse (a) — le tour précédent était DÉJÀ ce texte : l’avis part, la perte est dite', () => {
  // COUVERT, et c'est le garde-fou d'égalité qui le couvre : le sujet n'a pas bougé, donc rien
  // ne dit que ce qui a disparu est parti.
  assert.equal(
    verdictDeSoumission({ sujetAvant: RONDE, sujetApres: RONDE, texteDisparu: RONDE }),
    VERDICTS_DE_SOUMISSION.AUCUNE,
  );
});

test('⚠️ message en masse (b) — texte identique, tour précédent différent : faux positif ACCEPTÉ', () => {
  // NON COUVERT, et assumé. Le verdict conclut à une soumission alors que la ronde #1 a été
  // perdue. **Mais ce qui est perdu est le MÊME TEXTE que ce qui est parti** : l'avis existe
  // pour rendre la perte réparable (« recopie-le depuis ici »), et il n'y a rien à recopier —
  // le destinataire a reçu ce texte, au caractère près. Taire l'avis ne coûte donc rien ici.
  assert.equal(
    verdictDeSoumission({ sujetAvant: 'un tout autre tour', sujetApres: RONDE, texteDisparu: RONDE }),
    VERDICTS_DE_SOUMISSION.ETABLIE,
  );
});

test('⚠️ message en masse (c) — même préambule, QUEUES DIFFÉRENTES : faux positif avec perte RÉELLE', () => {
  // NON COUVERT, non fermable avec ce signal, et c'est le résidu sérieux de ce lot.
  //
  // Deux textes partagent leurs 77 premiers caractères et diffèrent après. `quota_topic` est
  // coupé à 77 : **on ne peut pas voir la différence**, par construction. Ce qui est perdu est
  // la queue du premier texte, et l'avis est tu.
  //
  // ⚠️ POURQUOI ON L'ACCEPTE, ET CE N'EST PAS UN HAUSSEMENT D'ÉPAULES :
  //   • non observé — 0 occurrence sur les 870 paires du parc réel : les collisions mesurées
  //     étaient TOUTES des doublons exacts, jamais des préambules partagés à queue différente ;
  //   • non fermable — aucune longueur de préfixe n'y change rien, la troncature est en amont
  //     de nous ; il faudrait un autre signal que `quota_topic` ;
  //   • borné par la fenêtre — il faut que l'autre texte parte dans les dizaines de
  //     millisecondes où celui-ci disparaît sans être soumis.
  //
  // Si ce cas se produit un jour, c'est ICI qu'il faudra revenir, et l'essai le dit.
  const commun = RONDE;
  const avecQueue = `${commun} Et ajoute la liste des trois bloqués.`;
  const autreQueue = `${commun} Rien de plus.`;
  assert.equal(
    verdictDeSoumission({
      sujetAvant: 'un tout autre tour',
      sujetApres: `${autreQueue.slice(0, 77)}…`,
      texteDisparu: avecQueue,
    }),
    VERDICTS_DE_SOUMISSION.ETABLIE,
    'documenté comme résidu accepté — si ce cas devient réel, le signal doit changer, pas le seuil',
  );

  // ⚠️ ET CET ESSAI-LÀ FIGE, IL NE SURVEILLE PAS — il faut le dire, parce que les deux se
  // ressemblent et qu'un essai qui documente ne se déclenche jamais. Il rougira si QUELQU'UN
  // CHANGE LE CODE, jamais si le cas apparaît en production. La surveillance, elle, est le
  // prédicat ci-dessous : il ne détecte pas (c) — c'est impossible — il compte les fois où on
  // le RISQUE, c'est-à-dire chaque conclusion prise sur un sujet tronqué.
  assert.equal(
    etablieSurUnPrefixeTronque({
      sujetAvant: 'un tout autre tour',
      sujetApres: `${autreQueue.slice(0, 77)}…`,
      texteDisparu: avecQueue,
    }),
    true,
    'ce pari-là doit être comptable — c’est tout ce qu’on peut faire d’un cas qu’on ne peut pas voir',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE PARI RENDU COMPTABLE — ce qu'on ne peut pas fermer, on le compte
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le pari ne se compte QUE sur un sujet tronqué — un sujet entier ne cache rien', () => {
  // Sur un sujet entier, on a vu tout ce qui est parti : il n'y a pas de queue invisible.
  assert.equal(
    etablieSurUnPrefixeTronque({ sujetAvant: 'avant', sujetApres: TEXTE, texteDisparu: TEXTE }),
    false,
  );
  assert.equal(
    etablieSurUnPrefixeTronque({ sujetAvant: null, sujetApres: LONG_TRONQUE, texteDisparu: LONG }),
    true,
  );
});

test('le pari ne se compte pas quand aucune soumission n’est établie', () => {
  // Compter un pari qu'on n'a pas pris gonflerait le chiffre et le rendrait illisible — c'est
  // la façon la plus simple de tuer un compteur : lui faire compter autre chose.
  assert.equal(
    etablieSurUnPrefixeTronque({ sujetAvant: LONG_TRONQUE, sujetApres: LONG_TRONQUE, texteDisparu: LONG }),
    false,
    'sujet inchangé : aucune conclusion, donc aucun pari',
  );
  assert.equal(
    etablieSurUnPrefixeTronque({ sujetAvant: 'avant', sujetApres: null, texteDisparu: TEXTE }),
    false,
    'sonde aveugle : aucune conclusion, donc aucun pari',
  );
});

test('le pari ne se compte pas sur un ESPACE RÉSERVÉ — son incertitude est d’une autre nature', () => {
  // Là-bas on ne conclut pas sur un préfixe du tout, mais sur le changement seul. Mélanger les
  // deux incertitudes dans un seul compteur le rendrait impossible à interpréter.
  assert.equal(
    etablieSurUnPrefixeTronque({ sujetAvant: 'avant', sujetApres: `${LONG.slice(0, 77)}…`, texteDisparu: REPLI }),
    false,
  );
});

test('⚠️ `delivrerLaBoite` REND le pari en champ — sinon personne ne pourra jamais le compter', async () => {
  const r = await delivrerLaBoite({
    texteCoince: LONG,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 1,
    lireSujetDuDernierTour: (() => {
      let n = 0;
      return async () => (n++ === 0 ? 'un tour d’avant' : LONG_TRONQUE);
    })(),
  });
  assert.equal(r.soumissionEtablie, true);
  assert.equal(r.soumissionEtablieSurPrefixeTronque, true, 'le champ doit sortir, pas mourir dans la fonction');
});

test('`delivrerLaBoite` ne compte PAS un pari quand le sujet est entier', async () => {
  const r = await delivrerLaBoite({
    texteCoince: TEXTE,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 1,
    lireSujetDuDernierTour: (() => {
      let n = 0;
      return async () => (n++ === 0 ? 'un tour d’avant' : TEXTE);
    })(),
  });
  assert.equal(r.soumissionEtablie, true);
  assert.equal(r.soumissionEtablieSurPrefixeTronque, false);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LA PANNE ASYMÉTRIQUE — une lecture jette, l'autre réussit
//
// Relevé en passe de fond : le seul essai de panne faisait jeter LES DEUX appels, donc il ne
// pouvait pas distinguer « le drapeau de panne a été posé » de « la lecture d'après est vide ».
// Une mutation qui supprimait la pose du drapeau restait verte.
//
// Le cas qui compte est celui où l'appel AVANT jette et l'appel APRÈS réussit : sans le
// drapeau, on comparerait un `sujetAvant` inexistant à un `sujetApres` bien réel, on y lirait
// un CHANGEMENT, et on TAIRAIT l'avis sur une mesure dont la moitié n'a jamais eu lieu.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('⚠️ la lecture AVANT jette, celle d’APRÈS réussit — on ne conclut pas sur une demi-mesure', async () => {
  let n = 0;
  const r = await delivrerLaBoite({
    texteCoince: TEXTE,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 1,
    lireSujetDuDernierTour: async () => {
      if (n++ === 0) throw new Error('herdr injoignable au premier appel');
      return TEXTE;
    },
  });
  assert.equal(r.verdictDeSoumission, 'sonde-aveugle', 'la panne de la première lecture l’emporte');
  assert.equal(r.soumissionEtablie, false, 'et l’avis part — on n’a pas mesuré ce qu’on prétend avoir mesuré');
  assert.equal(r.ok, true);
  assert.equal(r.texteDisparu, TEXTE);
});

test('⚠️ la lecture APRÈS jette, celle d’AVANT a réussi — même verdict, même repli', async () => {
  let n = 0;
  const r = await delivrerLaBoite({
    texteCoince: TEXTE,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 1,
    lireSujetDuDernierTour: async () => {
      if (n++ === 0) return 'un tour d’avant';
      throw new Error('herdr injoignable au second appel');
    },
  });
  assert.equal(r.verdictDeSoumission, 'sonde-aveugle');
  assert.equal(r.soumissionEtablie, false);
});

test('⚠️ le verdict est FAUX quand la sonde est AVEUGLE — on ne conclut pas d’une absence', () => {
  // Le repli est le comportement d'aujourd'hui : l'avis part. Se tromper du côté de
  // l'avertissement, jamais du silence — un danger permissif ne se signale pas tout seul.
  assert.equal(soumissionEtablie({ sujetAvant: null, sujetApres: null, texteDisparu: TEXTE }), false);
  assert.equal(soumissionEtablie({ sujetAvant: undefined, sujetApres: undefined, texteDisparu: TEXTE }), false);
  assert.equal(soumissionEtablie({ sujetAvant: 'x', sujetApres: null, texteDisparu: TEXTE }), false);
  assert.equal(soumissionEtablie({ sujetAvant: 'x', sujetApres: '', texteDisparu: TEXTE }), false);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ « PAS DE CHANGEMENT » ET « JE N'AI PAS PU VOIR » NE SONT PAS LE MÊME FAIT
//
// Les deux laissent partir l'avis, et c'est très bien. Mais s'ils portaient le même NOM, une
// sonde morte serait indiscernable d'un poste où personne ne soumet rien — et personne ne
// saurait jamais que ce correctif ne ferme plus rien. C'est ce chiffre-là qui dit si le lot
// sert à quelque chose sur l'écran du dirigeant.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('⚠️ le verdict NOMME la cécité à part — sinon une sonde morte se lit comme un poste calme', () => {
  const rienNaChange = verdictDeSoumission({ sujetAvant: 'un tour', sujetApres: 'un tour', texteDisparu: TEXTE });
  const aveugle = verdictDeSoumission({ sujetAvant: 'un tour', sujetApres: null, texteDisparu: TEXTE });
  const enPanne = verdictDeSoumission({ sujetAvant: 'un tour', sujetApres: 'un tour', texteDisparu: TEXTE, sondeEnPanne: true });

  assert.equal(rienNaChange, VERDICTS_DE_SOUMISSION.AUCUNE);
  assert.equal(aveugle, VERDICTS_DE_SOUMISSION.SONDE_AVEUGLE);
  assert.equal(enPanne, VERDICTS_DE_SOUMISSION.SONDE_AVEUGLE);
  assert.notEqual(rienNaChange, aveugle, 'une sonde aveugle doit être comptable séparément');

  // ⚠️ ET LA PANNE L'EMPORTE SUR LA VALEUR LUE. Un appel qui a JETÉ ne dit rien, même si la
  // lecture précédente avait rendu quelque chose : conclure sur la moitié d'une mesure serait
  // pire que ne pas mesurer, parce que ça en aurait l'air.
  assert.equal(
    verdictDeSoumission({ sujetAvant: 'un tour', sujetApres: TEXTE, texteDisparu: TEXTE, sondeEnPanne: true }),
    VERDICTS_DE_SOUMISSION.SONDE_AVEUGLE,
  );
});

test('le sujet a changé vers AUTRE chose — l’avis reste dû sur le chemin texte lisible', () => {
  // L'agent a soumis un autre texte pendant que celui-ci disparaissait sans être soumis.
  // C'est exactement le faux positif que le préfixe ferme ; il doit rester fermé.
  assert.equal(
    verdictDeSoumission({ sujetAvant: 'avant', sujetApres: 'un tout autre message', texteDisparu: TEXTE }),
    VERDICTS_DE_SOUMISSION.AUCUNE,
  );
});

test('⚠️ sur un ESPACE RÉSERVÉ, le critère est le CHANGEMENT seul — le préfixe y est impossible', () => {
  // Mesuré : `quota_topic` porte le TEXTE RÉEL du collage, que le veilleur n'a jamais lu.
  // Exiger un préfixe ici fermerait la garde sur le chemin où elle est le plus attendue.
  assert.equal(soumissionEtablie({ sujetAvant: 'avant', sujetApres: 'le vrai texte collé', texteDisparu: REPLI }), true);
  assert.equal(
    soumissionEtablie({ sujetAvant: 'avant', sujetApres: 'avant', texteDisparu: REPLI }),
    false,
    'sans changement, rien n’a été soumis — même sur un espace réservé',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LES DEUX CHEMINS DE L'AVIS — la garde est EN AMONT, une seule porte pour les deux
// ═══════════════════════════════════════════════════════════════════════════════════════

test('chemin TEXTE LISIBLE — soumission établie : aucun avis', () => {
  assert.equal(avisDeBoiteVidee({ texteDisparu: TEXTE, soumissionEtablie: true }), null);
});

test('chemin ESPACE RÉSERVÉ — soumission établie : aucun avis', () => {
  assert.equal(avisDeBoiteVidee({ texteDisparu: REPLI, soumissionEtablie: true }), null);
});

test('chemin TEXTE LISIBLE — soumission NON établie : l’avis part, entier', () => {
  const avis = avisDeBoiteVidee({ texteDisparu: TEXTE, soumissionEtablie: false });
  assert.ok(avis, 'la garde ne mange pas le cas pour lequel ce chemin existe');
  assert.ok(avis.includes(TEXTE), 'non-régression de T-20260817-0090 — le texte remonte entier');
});

test('chemin ESPACE RÉSERVÉ — soumission NON établie : l’avis part, avec son aveu', () => {
  const avis = avisDeBoiteVidee({ texteDisparu: REPLI, soumissionEtablie: false });
  assert.ok(avis);
  assert.ok(/ESPACE RÉSERVÉ/.test(avis), 'l’aveu de lecture reste sur ce chemin');
});

test('sans le champ, rien ne change — les appelants historiques gardent leur avis', () => {
  assert.ok(avisDeBoiteVidee({ texteDisparu: TEXTE }));
  assert.ok(avisDeBoiteVidee({ texteDisparu: REPLI }));
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'INTERRUPTEUR — sur le modèle de `LIGNE_DIRECTE_VERBEUX`, et il vaut pour LES DEUX chemins
// ═══════════════════════════════════════════════════════════════════════════════════════

test('l’interrupteur d’environnement éteint l’avis sur LES DEUX chemins', () => {
  const env = { LIGNE_DIRECTE_SANS_AVIS_BOITE_VIDEE: '1' };
  assert.equal(avisDeBoiteVidee({ texteDisparu: TEXTE, env }), null, 'chemin texte lisible');
  assert.equal(avisDeBoiteVidee({ texteDisparu: REPLI, env }), null, 'chemin espace réservé');
});

test('l’interrupteur absent ou vide ne change RIEN — un interrupteur qui s’arme seul est un défaut', () => {
  assert.ok(avisDeBoiteVidee({ texteDisparu: TEXTE, env: {} }));
  assert.ok(avisDeBoiteVidee({ texteDisparu: TEXTE, env: { LIGNE_DIRECTE_SANS_AVIS_BOITE_VIDEE: '' } }));
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA SONDE DANS `delivrerLaBoite` — et ce qu'elle ne doit PAS emporter au passage
// ═══════════════════════════════════════════════════════════════════════════════════════

const delivranceAvecSonde = async (sujets, { texteCoince = TEXTE } = {}) => {
  let n = 0;
  return delivrerLaBoite({
    texteCoince,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    // La boîte est vue VIDE à la relecture : c'est la branche `vide-cause-inconnue`.
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 1,
    lireSujetDuDernierTour: sujets === null ? undefined : async () => sujets[Math.min(n++, sujets.length - 1)],
  });
};

test('la sonde voit la soumission — `soumissionEtablie` remonte, et `ok`/`texteDisparu` ne bougent pas', async () => {
  const r = await delivranceAvecSonde(['un tour d’avant', TEXTE]);
  assert.equal(r.soumissionEtablie, true);
  // ⚠️ LE PORTEUR N'EST PAS TOUCHÉ. Le même balayage livre les boîtes oubliées et relance les
  // messages gardés : si cette branche cessait de rendre `ok`, la ligne du poste tomberait.
  assert.equal(r.ok, true);
  assert.equal(r.cause, 'vide-cause-inconnue');
  assert.equal(r.soumis, false);
  assert.equal(r.texteDisparu, TEXTE);
});

test('la sonde ne voit aucune soumission — l’avis reste dû', async () => {
  const r = await delivranceAvecSonde(['un tour d’avant', 'un tour d’avant']);
  assert.equal(r.soumissionEtablie, false);
  assert.equal(r.ok, true);
  assert.equal(r.texteDisparu, TEXTE);
});

test('la sonde qui JETTE ne fait pas tomber la délivrance — elle rend un verdict faux', async () => {
  const r = await delivrerLaBoite({
    texteCoince: TEXTE,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 1,
    lireSujetDuDernierTour: async () => {
      throw new Error('herdr injoignable');
    },
  });
  assert.equal(r.soumissionEtablie, false, 'une sonde en panne ne conclut pas à la soumission');
  assert.equal(r.verdictDeSoumission, 'sonde-aveugle', 'et la panne est NOMMÉE, pas fondue dans « rien n’a changé »');
  assert.equal(r.ok, true, 'et elle n’emporte pas la délivrance avec elle');
  assert.equal(r.texteDisparu, TEXTE);
});

test('aucune sonde injectée — le comportement d’avant, exactement', async () => {
  const r = await delivranceAvecSonde(null);
  assert.equal(r.soumissionEtablie, false);
  assert.equal(r.verdictDeSoumission, 'sonde-aveugle', 'ne pas avoir de sonde, c’est être aveugle — pas être calme');
  assert.equal(r.ok, true);
  assert.equal(r.texteDisparu, TEXTE);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ON COUPE LA SONDE, ET ON EXIGE QUE LE RÉSULTAT DIFFÈRE
//
// Sans ce bloc, tout ce fichier resterait vert avec une sonde morte : chaque essai ci-dessus
// qui attend `false` serait satisfait par une garde qui ne mesure RIEN. Ce qui est éprouvé
// ici n'est pas une valeur, c'est que la sonde PORTE le résultat.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('⚠️ PANNE DE LA MESURE — le même scénario, sonde branchée puis coupée, doit DIVERGER', async () => {
  const branchee = await delivranceAvecSonde(['un tour d’avant', TEXTE]);
  const coupee = await delivrerLaBoite({
    texteCoince: TEXTE,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 1,
    lireSujetDuDernierTour: async () => null, // la sonde est aveugle, et rien d'autre ne change
  });

  assert.notEqual(
    branchee.soumissionEtablie,
    coupee.soumissionEtablie,
    'sonde branchée et sonde aveugle rendent le MÊME verdict : la sonde ne porte rien',
  );

  // ⚠️ ET LA CÉCITÉ NE SE CONFOND PAS AVEC « RIEN N'A ÉTÉ SOUMIS » — c'est l'exigence qui
  // distingue ce bloc d'un essai décoratif. Les deux produisent le même avis ; seul le verdict
  // sait dire lequel des deux on vient de vivre.
  const rienNaChange = await delivranceAvecSonde(['un tour d’avant', 'un tour d’avant']);
  assert.equal(coupee.verdictDeSoumission, 'sonde-aveugle');
  assert.equal(rienNaChange.verdictDeSoumission, 'aucune-soumission');
  assert.notEqual(coupee.verdictDeSoumission, rienNaChange.verdictDeSoumission);

  // Et le résultat observable — l'avis part ou ne part pas — diverge lui aussi. Un verdict qui
  // changerait sans que l'avis change serait un verdict décoratif.
  assert.equal(avisDeBoiteVidee({ texteDisparu: TEXTE, soumissionEtablie: branchee.soumissionEtablie }), null);
  assert.ok(avisDeBoiteVidee({ texteDisparu: TEXTE, soumissionEtablie: coupee.soumissionEtablie }));
});

test('⚠️ PANNE DE LA MESURE, chemin ESPACE RÉSERVÉ — même exigence, l’autre porte', async () => {
  const branchee = await delivranceAvecSonde(['un tour d’avant', 'le vrai texte collé'], { texteCoince: REPLI });
  const coupee = await delivranceAvecSonde(['un tour d’avant', 'un tour d’avant'], { texteCoince: REPLI });

  assert.notEqual(branchee.soumissionEtablie, coupee.soumissionEtablie);
  assert.equal(avisDeBoiteVidee({ texteDisparu: REPLI, soumissionEtablie: branchee.soumissionEtablie }), null);
  assert.ok(avisDeBoiteVidee({ texteDisparu: REPLI, soumissionEtablie: coupee.soumissionEtablie }));
});

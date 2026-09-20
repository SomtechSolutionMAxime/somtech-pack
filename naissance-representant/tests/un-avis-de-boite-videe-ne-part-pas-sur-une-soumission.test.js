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
import { soumissionEtablie, verdictDeSoumission, VERDICTS_DE_SOUMISSION } from '../../ligne-directe/src/delivrance.js';

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

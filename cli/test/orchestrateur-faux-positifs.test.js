// LE SECOND CHIFFRE : ce que les gardes du métier refusent À TORT.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST ENTRÉ AU DÉPÔT
//
// Une garde se juge sur DEUX chiffres, et le harnais n'en mesurait qu'un.
//
//   1. **Ce qu'elle attrape** — `orchestrateur-mutations.test.js` : on retourne la phrase
//      gardée, la garde doit rougir.
//   2. **Ce qu'elle refuse à tort** — ici : on reformule la phrase gardée SANS rien lui
//      retirer, la garde doit rester verte.
//
// ⚠️ **LE SECOND CHIFFRE N'EST PAS UN CONFORT.** Une garde qui crie sur du texte correct ne
// survit pas : le premier qui la rencontre la « corrige » en la retirant, et elle emporte
// avec elle tout ce qu'elle gardait vraiment. Le lot précédent l'a mesuré — 5 reformulations
// légitimes faisaient crier 4 gardes distinctes, sur un banc qui vivait dans un scratchpad
// hors dépôt.
//
// **Un chiffre que personne d'autre ne peut reproduire n'est pas une mesure.** C'est pour ça
// que le banc est ici et plus là-bas : il se relance avec `npm test`, comme le reste.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LA MÉTHODE, ET ELLE EST LA MOITIÉ DE LA VALEUR DU BANC
//
// Les reformulations de `fixtures/orchestrateur-reformulations.json` sont écrites par un
// agent **QUI NE VOIT PAS LES GARDES** — interdiction de lire `cli/test/`, de chercher un
// nom de contrôle, de lancer la suite. S'il les voyait, il écrirait des reformulations qui
// les évitent, et le banc ne mesurerait plus rien : **l'aveuglement EST la méthode.**
//
// Et quatre interdits, qui séparent une reformulation d'une dégradation. Aucune n'a le
// droit de :
//
//   • retourner une **polarité** ;
//   • **affaiblir une obligation** (« tu dois » → « idéalement », « sauf si ») ;
//   • **retirer un élément** d'une liste, d'une table, d'une énumération ;
//   • **changer un chiffre**, une heure, un compte, un nom d'outil.
//
// Une entrée qui ferait l'une des quatre appartient à `MUTATIONS`, pas ici — et elle DOIT
// faire rougir. Les deux fichiers se lisent ensemble : celui-là mesure la prise, celui-ci
// mesure le bruit. ⚠️ **Ils se paient l'un l'autre** : élargir une sonde pour taire un cri
// lui retire sa prise. Après tout élargissement, on refait mordre la mutation.
//
// Traçabilité : T-20260817-0082, E-20260817-0006 — arbitrage du coordonnateur `d-20260817-0006`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTROLES, lireGabarits } from './lib/metier-orchestrateur.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHEMIN = join(HERE, 'fixtures', 'orchestrateur-reformulations.json');

const REFORMULATIONS = JSON.parse(readFileSync(CHEMIN, 'utf8'));
const ORIGINAL = lireGabarits();

/** Les identifiants des contrôles qui rougissent sur ces gabarits. */
function rougesDe(gabarits) {
  return CONTROLES
    .filter((c) => { try { c.verifier(gabarits); return false; } catch { return true; } })
    .map((c) => c.id);
}

const DEJA_ROUGES = new Set(rougesDe(ORIGINAL));

test('le banc porte assez de reformulations pour que son chiffre veuille dire quelque chose', () => {
  // Un banc de trois entrées rendrait « 0 garde ne crie à tort », et ce zéro ne dirait rien.
  // Le seuil est écrit ici pour qu'en descendre demande d'éditer cette ligne.
  assert.ok(
    REFORMULATIONS.length >= 30,
    `le banc ne porte que ${REFORMULATIONS.length} reformulation(s) : un chiffre pris sur si peu `
      + `de texte ne mesure pas le bruit des gardes, il mesure la chance`,
  );
  const ids = REFORMULATIONS.map((r) => r.id);
  assert.deepEqual(
    ids.filter((id, i) => ids.indexOf(id) !== i), [],
    'deux reformulations portent le même identifiant : les rapports deviendraient ambigus',
  );
});

for (const r of REFORMULATIONS) {
  test(`reformulation légitime « ${r.id} » : ${r.quoi}`, () => {
    // ── GARDE 1 : elle doit MORDRE. C'est le même faux témoin que du côté des mutations —
    // un motif qui ne s'applique plus laisse le texte intact, toutes les gardes restent
    // vertes, et le test passe en n'ayant rien éprouvé. Le gabarit bouge ; ces ancres aussi.
    const apres = ORIGINAL.metier.replace(r.avant, r.apres);
    assert.notEqual(
      apres, ORIGINAL.metier,
      `reformulation INOPÉRANTE : « ${r.avant.slice(0, 70)}… » ne se retrouve plus dans le `
        + `gabarit, donc rien n'a été reformulé. Un texte inchangé laisse évidemment toutes les `
        + `gardes vertes — ce n'est PAS une preuve. Ré-ancre « ${r.id} » sur le texte actuel.`,
    );

    // ── GARDE 2 : aucune garde ne doit se réveiller.
    //
    // On ne compare qu'aux NOUVEAUX rouges. Tant que la chaîne porte des rouges connus, les
    // compter ici ferait crier toutes les reformulations pour une raison qui ne les concerne
    // pas. ⚠️ Ce n'est pas un assouplissement qui se desserre : quand la chaîne est verte,
    // `DEJA_ROUGES` est vide et la garde est totale — elle se resserre toute seule.
    const nouvelles = rougesDe({ ...ORIGINAL, metier: apres }).filter((id) => !DEJA_ROUGES.has(id));
    assert.deepEqual(
      nouvelles, [],
      `CETTE GARDE REFUSE DU TEXTE CORRECT — ${r.quoi}\n`
        + `La reformulation « ${r.id} » ne retourne aucune polarité, n'affaiblit aucune `
        + `obligation, ne retire aucun élément et ne change aucun chiffre : elle dit la même `
        + `chose autrement. Et ${nouvelles.length > 1 ? 'ces gardes rougissent' : 'cette garde rougit'} `
        + `dessus : ${nouvelles.join(', ')}.\n`
        + `Une garde qui crie à tort se fait retirer par le premier qui la rencontre, et elle `
        + `emporte ce qu'elle gardait vraiment. Élargis sa sonde sur ce que le texte FAIT — `
        + `puis refais mordre sa mutation, sinon tu viens de lui retirer sa prise.`,
    );
  });
}

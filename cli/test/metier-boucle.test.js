// metier-boucle.test.js — la boucle d'évolution du métier (P-20260820-0001 phase 4).
//
// Le risque que ces tests gardent : la boucle industrialise la production de
// propositions, alors qu'aucune garde de taille n'existait avant. Sans elles,
// elle regonfle le socle plus vite qu'il n'a grossi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluerProposition } from '../src/metier/boucle.js';
import { BUDGETS } from '../src/metier/rendu.js';

function classementDeBase() {
  return {
    role: 'orchestrateur', version_abc: '2.0.0',
    items: [
      { id: 'GF-ORC-001', nature: 'garde-fou', couche: 'refus-de-permission', enonce: 'x', enonce_socle: 'Tu ne construis jamais.' },
      { id: 'RA-ORC-001', nature: 'regle', couche: 'persona', enonce: 'y', chapitre: 'c1' },
    ],
    chapitres: [{ nom: 'c1', abrege: 'a', version_pack: '1.81.0' }],
  };
}

test('une proposition qui tient dans le budget est recevable', () => {
  const r = evaluerProposition(classementDeBase(), {
    ajout: { id: 'RA-ORC-100', nature: 'regle', couche: 'persona', enonce: 'z', enonce_socle: 'Une phrase courte.' },
  });
  assert.equal(r.recevable, true, r.motifs?.join(' · '));
});

test('une adoption qui ferait dépasser le socle est IRRECEVABLE tant qu elle n est pas compensée', () => {
  const enorme = { id: 'RA-ORC-101', nature: 'regle', couche: 'persona', enonce: 'z', enonce_socle: 'w'.repeat(BUDGETS.L1 * 4) };
  const r = evaluerProposition(classementDeBase(), { ajout: enorme });
  assert.equal(r.recevable, false);
  // ⚠️ chercher « retrait » ne distingue rien : le message du rendu le contient déjà.
  // Mesuré par mutation le 2026-08-20 — c'était la seule survivante de cette suite.
  // Ce qui appartient EN PROPRE à la boucle, c'est de dire que c'est une condition
  // de recevabilité et non un arbitrage qu'on peut discuter.
  assert.ok(r.motifs.some((m) => m.includes('condition de recevabilité')),
    `le refus doit poser le retrait en CONDITION, pas en suggestion — reçu : ${JSON.stringify(r.motifs)}`);
});

test('la même adoption devient recevable avec le retrait qui la compense', () => {
  const enorme = { id: 'RA-ORC-101', nature: 'regle', couche: 'persona', enonce: 'z', enonce_socle: 'w'.repeat(200) };
  const c = classementDeBase();
  c.items.push({ id: 'RA-ORC-102', nature: 'regle', couche: 'persona', enonce: 'q', enonce_socle: 'w'.repeat(BUDGETS.L1 * 4) });
  const sansRetrait = evaluerProposition(c, { ajout: enorme });
  assert.equal(sansRetrait.recevable, false);
  const avecRetrait = evaluerProposition(c, { ajout: enorme, retraits: ['RA-ORC-102'] });
  assert.equal(avecRetrait.recevable, true, avecRetrait.motifs?.join(' · '));
});

test('celui qui propose n est jamais celui qui accepte — une proposition auto-acceptée est refusée', () => {
  const r = evaluerProposition(classementDeBase(), {
    ajout: { id: 'RA-ORC-103', nature: 'regle', couche: 'persona', enonce: 'z', enonce_socle: 'court' },
    propose_par: 'matapedia', accepte_par: 'matapedia',
  });
  assert.equal(r.recevable, false);
  assert.ok(r.motifs.some((m) => m.includes('contradiction') || m.includes('même')),
    `le refus doit nommer la garde de contradiction — reçu : ${JSON.stringify(r.motifs)}`);
});

test('les trois issues sont admises, et une quatrième est refusée', () => {
  const base = classementDeBase();
  const p = { ajout: { id: 'RA-ORC-104', nature: 'regle', couche: 'persona', enonce: 'z', enonce_socle: 'court' } };
  for (const issue of ['adopter', 'fusionner', 'retirer']) {
    assert.equal(evaluerProposition(base, { ...p, issue }).recevable, true, `issue ${issue}`);
  }
  const r = evaluerProposition(base, { ...p, issue: 'reporter' });
  assert.equal(r.recevable, false);
  assert.ok(r.motifs.some((m) => m.includes('reporter')));
});

test('un retrait qui vise un item inexistant est refusé — on ne compense pas avec du vide', () => {
  const r = evaluerProposition(classementDeBase(), {
    ajout: { id: 'RA-ORC-105', nature: 'regle', couche: 'persona', enonce: 'z', enonce_socle: 'court' },
    retraits: ['RA-ORC-999'],
  });
  assert.equal(r.recevable, false);
  assert.ok(r.motifs.some((m) => m.includes('RA-ORC-999')));
});

test('une proposition qui ajoute un garde-fou sans couche est refusée comme au rendu', () => {
  const r = evaluerProposition(classementDeBase(), {
    ajout: { id: 'GF-ORC-200', nature: 'garde-fou', couche: 'persona', enonce: 'z', enonce_socle: 'court' },
  });
  assert.equal(r.recevable, false);
  assert.ok(r.motifs.some((m) => m.includes('GF-ORC-200')));
});

test('la proposition rend le coût qu elle ajoute au socle — un chiffre, pas une impression', () => {
  const r = evaluerProposition(classementDeBase(), {
    ajout: { id: 'RA-ORC-106', nature: 'regle', couche: 'persona', enonce: 'z', enonce_socle: 'w'.repeat(350) },
  });
  assert.equal(typeof r.cout_socle, 'number');
  assert.ok(r.cout_socle > 0, 'une proposition qui monte au socle coûte quelque chose');
});

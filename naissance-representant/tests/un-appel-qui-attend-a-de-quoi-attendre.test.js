// un-appel-qui-attend-a-de-quoi-attendre.test.js — le plafond par appel ne tue pas l'attente
// qu'il est censé contenir (T-20260818-0014).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE PIÈGE, RELEVÉ EN REVUE DE FOND
//
// Le lot a posé un plafond sur CHAQUE appel `herdr` — sans lui, un appel qui ne répond pas
// fait pendre la ronde, et le processus tué laisse l'enfant orphelin derrière lui.
//
// Mais une commande fait attendre `herdr` LUI-MÊME :
//
//     agent prompt <pane> <texte> --wait --until working --timeout <attenteMs>
//
// L'attente est DANS l'appel. Deux durées se retrouvent face à face — celle qu'on demande à
// herdr, et celle au bout de laquelle on le tue — et RIEN ne les reliait. Tant que 20 s < 60 s
// la marge tenait ; relever l'attente au-delà du plafond ferait tuer un appel qui PROGRESSAIT,
// et la ronde le rapporterait en « session muette ».
//
// ⚠️ ET CE MENSONGE-LÀ EST LE PIRE DE TOUS ICI : il est produit par le mécanisme même que ce
// ticket a posé pour supprimer les silences. Une garde qui ment est pire qu'une garde absente.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { budgetPourUneAttente, MARGE_APPEL_MS } from '../src/appel-herdr.js';
import { livrerBrief } from '../src/livraison.js';

const SEP = '─'.repeat(40);
const BOITE_VIDE = [SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');

test('UN BUDGET D’APPEL CONTIENT TOUJOURS L’ATTENTE QU’IL PORTE — quelle qu’elle soit', () => {
  // ⚠️ ON ÉPROUVE AU-DELÀ DU PLAFOND ORDINAIRE, et c'est tout l'objet : sous 60 s la marge
  // tenait déjà par accident. C'est le jour où quelqu'un relève l'attente que le lien compte.
  for (const attente of [0, 20000, 59000, 60000, 120000, 600000]) {
    const budget = budgetPourUneAttente(attente);
    assert.ok(
      budget > attente,
      `un appel qui attend ${attente} ms doit avoir plus que ça — ${budget} ms le tuerait en plein vol`
    );
    assert.ok(budget >= attente + MARGE_APPEL_MS, 'et de quoi faire l’aller-retour par-dessus');
  }
  // Un appel qui attend n'a aucune raison d'avoir MOINS de temps qu'un appel ordinaire.
  assert.ok(budgetPourUneAttente(0, { plancher: 60000 }) >= 60000, 'jamais sous le plafond ordinaire');
});

test('LA LIVRAISON DONNE À SON APPEL DE QUOI TENIR SON ATTENTE — mesuré sur l’appel réel', async () => {
  // ⚠️ LA GARDE DE LA GARDE. La fonction ci-dessus peut être parfaite et n'être appelée par
  // personne — c'est le motif dominant de ce dépôt. On regarde donc ce que `livrerBrief` passe
  // VRAIMENT à l'appel qui porte `--wait`, et rien d'autre.
  const ATTENTE = 90000; // au-delà du plafond ordinaire : sans le lien, l'appel serait tué
  const vus = [];

  await livrerBrief({
    pane: 'w1:p1',
    texte: 'un rappel',
    attenteMs: ATTENTE,
    essais: 1,
    delaiMs: 0,
    immobiliteMs: 0,
    appelHerdr: async (commande, options = {}) => {
      vus.push({ commande, delaiMs: options.delaiMs });
      return { ok: true, reponse: { result: { agent: { agent_status: 'idle', revision: 1 } } } };
    },
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
  });

  const quiAttend = vus.filter((v) => v.commande.includes('--wait'));
  assert.ok(quiAttend.length > 0, 'l’appel qui porte l’attente doit avoir eu lieu — sinon on ne mesure rien');
  for (const v of quiAttend) {
    assert.ok(
      typeof v.delaiMs === 'number' && v.delaiMs > ATTENTE,
      `l’appel « --wait --timeout ${ATTENTE} » doit recevoir plus que ${ATTENTE} ms — reçu ${v.delaiMs}`
    );
  }
});

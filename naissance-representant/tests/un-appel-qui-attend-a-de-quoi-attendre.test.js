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
import { ATTENTE_NAISSANCE_MS } from '../src/naissance.js';
import { readFileSync } from 'node:fs';

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

  // ⚠️ LE REPÈRE A CHANGÉ, PAS L'EXIGENCE (T-20260821-0009). Ce test cherchait l'appel par
  // `--wait`, qui n'existe plus : l'attente demandée à herdr n'était jamais observée et
  // fabriquait 98 faux négatifs sur 231 non-livraisons, elle a donc été retirée.
  //
  // ⚠️ ET LE RETIRER NE RETIRE PAS CETTE GARDE — c'est le piège de ce lot, et il fallait
  // trancher plutôt que laisser le test mourir avec son repère. Ce qu'il garde n'est pas le
  // drapeau `--wait` : c'est que **le budget de l'appel qui ÉCRIT reste lié à `attenteMs`**, et
  // non figé sur une constante qu'un lot ultérieur ferait diverger sans qu'un essai bronche.
  // Ce lien est délibérément conservé dans `livrerBrief` (voir la note au-dessus de l'appel),
  // et une main qui le remplacerait par un nombre fixe ferait rougir ces lignes-ci.
  //
  // Le repère est donc l'appel qui écrit — la chose que le drapeau désignait —, ce qui rend
  // cette garde INDÉPENDANTE de la forme exacte de la commande.
  const quiEcrit = vus.filter(
    (v) => v.commande[1] === 'prompt' || v.commande[1] === 'send-text'
  );
  assert.ok(quiEcrit.length > 0, 'l’appel qui écrit doit avoir eu lieu — sinon on ne mesure rien');
  for (const v of quiEcrit) {
    assert.ok(
      typeof v.delaiMs === 'number' && v.delaiMs > ATTENTE,
      `l’appel qui écrit doit recevoir plus que l’attente de ${ATTENTE} ms — reçu ${v.delaiMs}`
    );
  }

  // ⚠️ ET LA MOITIÉ QUI EMPÊCHE LE RETOUR EN ARRIÈRE. Sans elle, ce test resterait vert le jour
  // où quelqu'un remettrait `--wait --until working` : le budget serait toujours lié, et
  // l'attente morte serait de retour sans qu'un seul essai le dise.
  for (const v of vus) {
    assert.ok(
      !v.commande.includes('--until'),
      `aucun appel ne doit demander une attente que herdr n’observe pas — ${v.commande.join(' ')}`
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ET LA NAISSANCE ATTEND DEUX FOIS PLUS LONGTEMPS QUE LE PLAFOND ORDINAIRE
//
// ⚠️ RELEVÉ EN REVUE DE FOND, ET C'EST UNE RÉGRESSION QUE CE LOT INTRODUISAIT. `agent start …
// --timeout 120000` fait attendre herdr DEUX MINUTES ; le plafond ordinaire par appel, posé par
// ce ticket, est d'UNE. Une naissance qui prend entre 60 s et 120 s — dans la fenêtre que herdr
// s'autorise lui-même — aurait été tuée avant d'aboutir, par la garde même que ce lot pose.
//
// Avant ce ticket, rien ne bornait cet appel côté Node : le lot ne laissait donc pas une lacune
// neutre, il créait un défaut. Deux commandes portent une attente dans ce dépôt — la livraison
// et la naissance — et le lot n'en avait lié qu'une.
test('LA NAISSANCE DONNE À SON APPEL DE QUOI TENIR SES DEUX MINUTES', () => {
  assert.ok(
    budgetPourUneAttente(ATTENTE_NAISSANCE_MS) > ATTENTE_NAISSANCE_MS,
    `un « agent start --timeout ${ATTENTE_NAISSANCE_MS} » doit avoir plus que ${ATTENTE_NAISSANCE_MS} ms`
  );

  // ⚠️ LA GARDE DE LA GARDE, ENCORE : on ne se contente pas de savoir que la fonction rend le
  // bon nombre. On lit le SITE D'APPEL, parce qu'une dérivation juste que personne n'applique
  // est le motif dominant de ce dépôt — et c'est exactement ce qui s'est produit ici.
  const source = readFileSync(new URL('../bin/naitre.js', import.meta.url), 'utf8');
  const appel = source.slice(source.indexOf('commandes.agentStart(paneId)'));
  assert.match(
    appel.slice(0, 300),
    /delaiMs:\s*budgetPourUneAttente\(ATTENTE_NAISSANCE_MS\)/,
    'l’appel de naissance doit recevoir un budget dérivé de SON attente, pas le plafond ordinaire'
  );
});

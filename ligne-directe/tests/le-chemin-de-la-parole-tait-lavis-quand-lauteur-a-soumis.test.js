// LES DEUX APPELANTS, PAS UN (T-20260920-0125).
//
// ⚠️ POURQUOI CE FICHIER VIT DANS `ligne-directe/tests/` ET PAS AILLEURS (T-20260920-0125).
//
// Il a d'abord été écrit dans `naissance-representant/tests/`, parce que c'est de là que
// venaient les doubles d'écran qu'il réutilise. Le code qu'il éprouve, lui, vit dans
// `ligne-directe/src/`. Les deux modules ont chacun leur `npm test` et chacun leur job de CI.
//
// Conséquence MESURÉE : en débranchant la sonde dans `ligne-directe/src/herdr.js`, la suite
// `ligne-directe` rendait **1352/1352, zéro échec**, pendant que `naissance-representant` en
// rendait deux rouges. L'essai mordait — depuis la mauvaise suite. Celui qui travaille dans
// `ligne-directe` et lance sa suite avait du vert sur un module qu'il venait de casser.
//
// Un essai se range avec le CODE QU'IL ÉPROUVE, pas avec les doubles qu'il emprunte.
////
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE, ET IL A ÉTÉ MESURÉ AVANT D'ÊTRE ÉCRIT
//
// La garde vit dans `avisDeBoiteVidee`, en amont de ses deux chemins, et quatorze mutations
// la mettent à l'épreuve dans `un-avis-de-boite-videe-ne-part-pas-sur-une-soumission.test.js`.
// Toutes meurent. **Et pourtant quatre autres survivaient**, mesurées le 2026-09-20 :
//
//   ⑮ `ligne-directe/src/herdr.js` rappelle `avisDeBoiteVidee` SANS le verdict → l'avis repart ;
//   ⑯ `naissance-representant/src/livraison.js` fait pareil → l'avis repart ;
//   ⑰ la sonde n'est plus branchée dans `herdr.js` → verdict toujours aveugle, avis toujours là ;
//   ⑱ la sonde n'est plus branchée dans `livraison.js` → idem.
//
// **La garde était juste, et le chemin qui y mène n'était pas couvert.** C'est « une porte sur
// deux » d'un cran plus haut : non plus les deux chemins d'une fonction, mais les deux modules
// qui l'appellent. Ce dépôt a déjà payé QUATRE fois ce motif exact sur ce chemin précis — le
// geste, l'avis de boîte bloquée, l'avis de boîte vidée, la relecture d'écran — à chaque fois
// posé d'un côté et pas de l'autre.
//
// Ce fichier ferme les quatre. Il ne rejoue pas le verdict : il prouve que le VERDICT ARRIVE
// jusqu'au texte réellement livré, des deux côtés.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { livrerBrief } from '../../naissance-representant/src/livraison.js';

const TEXTE_DISPARU = 'fais le orchestrator-state et le correctif de la ligne';
const MON_MESSAGE = 'mon message';
const SUJET_DAVANT = 'un tour tout à fait autre';

// Doubles d'écran repris au caractère près de `une-boite-videe-ne-se-tait-pas.test.js`.
const SEP = '─'.repeat(40);
const boiteAvec = (texte) => [SEP, `❯ ${texte}`, SEP, '  ⏵⏵ auto mode on'].join('\n');
const BOITE_VIDE = [SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');

// L'ouverture de l'avis, telle qu'elle est écrite dans `avisDeBoiteVidee`. On la cherche
// littéralement : c'est ce que le destinataire lit, pas un mot-clé qui lui ressemble.
const OUVERTURE_DE_LAVIS = 'TA BOÎTE DE SAISIE PORTAIT UN TEXTE, ET ELLE S’EST VIDÉE';

// ═══════════════════════════════════════════════════════════════════════════════════════
// APPELANT 1 — `naissance-representant/src/livraison.js`, I/O injectée
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * `sujets` est la suite des `quota_topic` rendus aux appels successifs de `agent get`. Les deux
 * premiers sont consommés par l'état d'entrée et par la sonde AVANT ; ce qui suit est ce que la
 * sonde lit APRÈS. Le dernier élément est répété si on en redemande.
 */
async function livraisonAvec(sujets, { parLePane = false } = {}) {
  const ecrits = [];
  let n = 0;
  await livrerBrief({
    pane: 'w1:p1',
    texte: MON_MESSAGE,
    pairOccupe: true,
    immobiliteMs: 60000,
    parLePane,
    appelHerdr: async (c) => {
      const cmd = Array.isArray(c) ? c.join(' ') : String(c);
      ecrits.push(cmd);
      // ⚠️ LES DEUX VERBES, ET ILS NE RANGENT PAS LEUR RÉPONSE AU MÊME ENDROIT. Le repli par
      // pane (T-20260820-0022) interroge `pane get`, qui met tout sous `result.pane`. Un double
      // qui ne rendrait que la forme `agent` laisserait la sonde AVEUGLE sur tout le repli sans
      // qu'un seul essai rougisse — mesuré : la mutation qui retire cette jointure survivait.
      if (cmd.startsWith('agent get') || cmd.startsWith('pane get')) {
        const sujet = sujets[Math.min(n++, sujets.length - 1)];
        const etat = { agent_status: 'done', tokens: { quota_topic: sujet } };
        return { ok: true, reponse: { result: parLePane ? { pane: etat } : { agent: etat } } };
      }
      return { ok: true, reponse: { result: parLePane ? { pane: { agent_status: 'done' } } : { agent: { agent_status: 'done' } } } };
    },
    lireEcran: (() => {
      let k = 0;
      return async () => (k++ === 0 ? boiteAvec(TEXTE_DISPARU) : BOITE_VIDE);
    })(),
    dormir: async () => {},
    essais: 1,
    delaiMs: 0,
    attenteMs: 0,
  });
  return ecrits.join('\n');
}

test('livraison.js — le sujet du dernier tour devient le texte disparu : AUCUN avis n’est livré', async () => {
  const livre = await livraisonAvec([SUJET_DAVANT, SUJET_DAVANT, TEXTE_DISPARU]);
  assert.ok(!livre.includes(OUVERTURE_DE_LAVIS), 'son auteur vient de le soumettre — on ne l’avertit pas d’une perte');
  assert.ok(livre.includes(MON_MESSAGE), '⚠️ et le message de l’émetteur part quand même — on tait l’avis, pas la livraison');
});

test('livraison.js — le sujet ne bouge pas : l’avis part, ENTIER (non-régression T-20260817-0090)', async () => {
  const livre = await livraisonAvec([SUJET_DAVANT, SUJET_DAVANT, SUJET_DAVANT]);
  assert.ok(livre.includes(OUVERTURE_DE_LAVIS), 'rien ne dit que ce texte est parti — l’avis reste dû');
  assert.ok(livre.includes(TEXTE_DISPARU), 'et il porte le texte entier, seul endroit où il existe encore');
});

test('livraison.js — sonde AVEUGLE (`quota_topic` absent) : l’avis part, comme avant ce lot', async () => {
  const livre = await livraisonAvec([null, null, null]);
  assert.ok(livre.includes(OUVERTURE_DE_LAVIS), 'on ne conclut pas d’une absence de mesure');
  assert.ok(livre.includes(TEXTE_DISPARU));
});

test('⚠️ livraison.js — la sonde PORTE le résultat : branchée et aveugle DIVERGENT', async () => {
  const vue = await livraisonAvec([SUJET_DAVANT, SUJET_DAVANT, TEXTE_DISPARU]);
  const aveugle = await livraisonAvec([null, null, null]);
  assert.notEqual(
    vue.includes(OUVERTURE_DE_LAVIS),
    aveugle.includes(OUVERTURE_DE_LAVIS),
    'même scénario, sonde branchée puis aveugle : si le texte livré est identique, la sonde ne sert à rien',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE REPLI PAR PANE — l'autre moitié de `livraison.js`, et elle survivait
//
// ⚠️ MESURÉ, PAS SUPPOSÉ : la mutation qui retire `?? r?.pane?.tokens?.quota_topic` de
// `sujetDuDernierTourRendu` restait VERTE tant que ces deux essais n'existaient pas. Le repli
// par pane est le chemin des sessions les plus difficiles à joindre — celles que `agent get`
// ne trouve pas. Y laisser la sonde aveugle, c'est fermer l'avis là où il gêne et le laisser
// ouvert là où il est le plus probable.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('livraison.js PAR PANE — `pane get` porte le sujet aussi : AUCUN avis quand il a soumis', async () => {
  const livre = await livraisonAvec([SUJET_DAVANT, SUJET_DAVANT, TEXTE_DISPARU], { parLePane: true });
  assert.ok(!livre.includes(OUVERTURE_DE_LAVIS), 'la jointure `result.pane` doit être lue, comme pour le statut');
  assert.ok(livre.includes(MON_MESSAGE));
});

test('livraison.js PAR PANE — le sujet ne bouge pas : l’avis part', async () => {
  const livre = await livraisonAvec([SUJET_DAVANT, SUJET_DAVANT, SUJET_DAVANT], { parLePane: true });
  assert.ok(livre.includes(OUVERTURE_DE_LAVIS));
  assert.ok(livre.includes(TEXTE_DISPARU));
});

test('⚠️ livraison.js PAR PANE — branchée et aveugle DIVERGENT sur le repli aussi', async () => {
  const vue = await livraisonAvec([SUJET_DAVANT, SUJET_DAVANT, TEXTE_DISPARU], { parLePane: true });
  const aveugle = await livraisonAvec([null, null, null], { parLePane: true });
  assert.notEqual(vue.includes(OUVERTURE_DE_LAVIS), aveugle.includes(OUVERTURE_DE_LAVIS));
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// APPELANT 2 — `ligne-directe/src/herdr.js`, par un FAUX herdr posé sur le PATH
//
// ⚠️ LE DOUBLE EST CALQUÉ SUR `ligne-directe/tests/remise-prouvee.test.js` — même forme, même
// journal d'appels. Un double qui s'écarte du service qu'il imite ne prouve rien, et c'est le
// motif que ce dépôt paie le plus souvent.
// ═══════════════════════════════════════════════════════════════════════════════════════

let bac;
let pathOriginal;

function fauxHerdr({ sujetApres }) {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const TEXTE = ${JSON.stringify(TEXTE_DISPARU)};
const AVANT = ${JSON.stringify(SUJET_DAVANT)};
const APRES = ${JSON.stringify(sujetApres)};

// La boîte porte le texte à la PREMIÈRE lecture, puis elle est vide : c'est la branche
// \`vide-cause-inconnue\`, celle où l'on n'a rien soumis et où l'on ne sait pas pourquoi.
if (cmd === 'agent read') {
  const premiere = !passes.some((a) => a[0] === 'agent' && a[1] === 'read');
  process.stdout.write(['~/un-chantier', SEP, '\\u276f ' + (premiere ? TEXTE : ''), SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
// \`agent get\` : la sonde.
//
// ⚠️ LE DOUBLE NE COMPTE PAS LES APPELS, IL SUIT L'ÉVÉNEMENT — et la première version comptait.
// Elle tenait pour acquis que le premier \`agent get\` était la sonde AVANT ; mesuré sur la
// chaîne réelle, l'ordre est \`get, read, get, read, get\` : \`remettre\` en pose un AVANT sa
// propre lecture d'écran. Le double décalé rendait le même sujet des deux côtés, donc
// « rien n'a changé », et l'essai accusait le code d'un défaut qui était le sien.
//
// Le sujet bascule donc sur ce qui le fait basculer en vrai : LA BOÎTE S'EST VIDÉE. Elle est
// vue pleine à la première lecture et vide ensuite ; tout \`agent get\` postérieur à cette
// seconde lecture est une lecture APRÈS, quel que soit le nombre d'appels intermédiaires.
if (cmd === 'agent get') {
  const boiteVueVide = passes.filter((a) => a[0] === 'agent' && a[1] === 'read').length >= 2;
  const sujet = boiteVueVide ? APRES : AVANT;
  const tokens = sujet === null ? {} : { quota_topic: sujet };
  process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle', tokens } } }));
  process.exit(0);
}
if (cmd === 'agent prompt') {
  process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'idle' } } }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
  return journal;
}

const texteLivre = (journal) =>
  readFileSync(journal, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((a) => a[0] === 'agent' && a[1] === 'prompt')
    .map((a) => a[3] ?? '')
    .join('\n');

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'ld-avis-videe-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});
after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});

// ⚠️ LA SONDE ELLE-MÊME, À SON PROPRE NIVEAU — et pas seulement à travers ce qu'elle produit.
//
// Mesuré : muter `sujetDuDernierTour` pour qu'elle rende `''` au lieu de `null`, ou pour
// qu'elle JETTE au lieu d'attraper, laissait tout le reste au vert — parce qu'une seconde
// garde, en aval, rattrape les deux (`sujetLu` normalise le vide, `interrogerLaSonde` attrape
// l'exception). C'est une défense en profondeur, pas un trou ; mais une garde dont on ne sait
// pas si elle tient est une garde qu'on retirera un jour en croyant qu'elle ne servait à rien.
// Ces deux essais l'éprouvent là où elle vit.

test('la sonde rend `null`, jamais une chaîne vide — le vide et l’absence ne se confondent pas', async () => {
  const { sujetDuDernierTour } = await import('../src/herdr.js');
  writeFileSync(join(bac, 'herdr'), `#!/usr/bin/env node
process.stdout.write(JSON.stringify({ result: { agent: { tokens: { quota_topic: '   ' } } } }));`);
  chmodSync(join(bac, 'herdr'), 0o755);
  assert.equal(await sujetDuDernierTour('w1:p1'), null);
});

test('la sonde n’emporte personne quand herdr tombe — elle rend `null`, elle ne jette pas', async () => {
  const { sujetDuDernierTour } = await import('../src/herdr.js');
  // herdr sort en erreur, comme sur un pane disparu.
  writeFileSync(join(bac, 'herdr'), '#!/bin/sh\nexit 7\n');
  chmodSync(join(bac, 'herdr'), 0o755);
  assert.equal(await sujetDuDernierTour('w1:p1'), null, 'un pane introuvable ne doit pas faire tomber la délivrance');

  // Et une sortie qui n'est pas du JSON — le mode de panne qu'on n'anticipe jamais.
  writeFileSync(join(bac, 'herdr'), '#!/bin/sh\necho "pas du json du tout"\n');
  chmodSync(join(bac, 'herdr'), 0o755);
  assert.equal(await sujetDuDernierTour('w1:p1'), null);
});

test('herdr.js — le sujet devient le texte disparu : AUCUN avis dans ce qui est livré', async () => {
  const { remettre } = await import('../src/herdr.js');
  const journal = fauxHerdr({ sujetApres: TEXTE_DISPARU });
  await remettre('w1:p1', MON_MESSAGE).catch(() => {});
  const livre = texteLivre(journal);
  assert.ok(livre.includes(MON_MESSAGE), 'le message de l’émetteur est bien parti — sans quoi on ne mesure rien');
  assert.ok(!livre.includes(OUVERTURE_DE_LAVIS), 'son auteur vient de le soumettre — pas d’avertissement de perte');
});

test('herdr.js — le sujet ne bouge pas : l’avis part, avec le texte entier', async () => {
  const { remettre } = await import('../src/herdr.js');
  const journal = fauxHerdr({ sujetApres: SUJET_DAVANT });
  await remettre('w1:p1', MON_MESSAGE).catch(() => {});
  const livre = texteLivre(journal);
  assert.ok(livre.includes(OUVERTURE_DE_LAVIS), 'l’avis reste dû quand rien ne dit que le texte est parti');
  assert.ok(livre.includes(TEXTE_DISPARU));
});

test('herdr.js — sonde AVEUGLE : l’avis part, comme avant ce lot', async () => {
  const { remettre } = await import('../src/herdr.js');
  const journal = fauxHerdr({ sujetApres: null });
  await remettre('w1:p1', MON_MESSAGE).catch(() => {});
  assert.ok(texteLivre(journal).includes(OUVERTURE_DE_LAVIS), 'on ne conclut pas d’une absence de mesure');
});

test('⚠️ herdr.js — la sonde PORTE le résultat : branchée et aveugle DIVERGENT', async () => {
  const { remettre } = await import('../src/herdr.js');
  const jVue = fauxHerdr({ sujetApres: TEXTE_DISPARU });
  await remettre('w1:p1', MON_MESSAGE).catch(() => {});
  const vue = texteLivre(jVue);
  const jAveugle = fauxHerdr({ sujetApres: null });
  await remettre('w1:p1', MON_MESSAGE).catch(() => {});
  const aveugle = texteLivre(jAveugle);
  assert.notEqual(
    vue.includes(OUVERTURE_DE_LAVIS),
    aveugle.includes(OUVERTURE_DE_LAVIS),
    'si couper la sonde ne change pas ce qui est livré, la sonde n’est pas branchée',
  );
});

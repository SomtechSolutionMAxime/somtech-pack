// UNE BOÎTE QUI S'EST VIDÉE NE SE TAIT PAS — le texte disparu remonte, entier (T-20260817-0090).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT QUI COMMANDE CE FICHIER, MESURÉ LE 2026-08-17
//
// Un ORDRE DU CTO — « fais le orchestrator-state et le correctif de la ligne » — attendait, non
// soumis, dans la boîte de `t-20260817-0071`. Un `livrer.js` vers ce pane a rendu `{ok: true,
// delivre: false}`. Après le geste, la boîte portait le texte de l'émetteur. **L'ordre avait
// disparu, et le destinataire ne l'a JAMAIS vu.** Il n'a été sauvé que parce qu'un tiers l'avait
// lu à l'écran avant d'envoyer, et l'a recopié à la main.
//
// ⚠️ CE QUE CE FICHIER GARDE, ET CE QU'IL NE PRÉTEND PAS
//
// Il ne garde PAS « la boîte ne se vide jamais » — la cause de la disparition reste `[non établi]`
// au ticket, et deux occurrences d'un même motif ne sont pas un mécanisme démontré.
//
// Il garde ce qui est en notre pouvoir : **quand `delivrerLaBoite` trouve une boîte vide qu'elle
// n'a pas vidée, elle rend ce qu'elle avait vu — entier — et le destinataire l'apprend dans son
// message.** Un texte perdu cesse d'être un texte perdu SANS TÉMOIN.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI UN NOM, ET PAS SEULEMENT UN CHAMP
//
// La cause s'appelait `liberee-seule`. **Ce nom CONCLUT** : « libérée seule » affirme que
// quelqu'un s'en est occupé. Or une boîte vue vide a deux causes — l'auteur a soumis (bénin et
// majoritaire), ou le texte a disparu sans être soumis (la perte). La fonction ne peut pas les
// distinguer : elle a vu une absence et en déduisait un geste.
//
// **Un nom qui conclut fait que personne ne relit le champ.** Il nomme désormais CE QUI A ÉTÉ VU
// — `vide-cause-inconnue` — et pas ce qu'on en déduit.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LA MOITIÉ QUI PROTÈGE — et la rater retirerait la garde
//
// **On ne fait PAS échouer l'envoi.** La cause bénigne est majoritaire : refuser là-dessus
// refuserait à tort la quasi-totalité du trafic, et une garde qui crie à tort se fait retirer en
// emportant ce qu'elle gardait. Le dernier essai de ce fichier tient ce chiffre.
//
// *Arbitré par `d-20260817-0006`, qui a renversé son propre critère d'acceptation sur ce motif.*

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { delivrerLaBoite, avisDeBoiteVidee, livrerBrief } from '../src/livraison.js';

const ORDRE_PERDU = 'fais le orchestrator-state et le correctif de la ligne';

// ⚠️ LE DOUBLE D'ÉCRAN EST REPRIS DE `on-necrit-pas-devant-un-dialogue.test.js`, AU CARACTÈRE
// PRÈS — pas réécrit. Une première version inventée ici n'était pas lue par `contenuBoite` : le
// test échouait pour une raison qui n'était pas celle qu'il gardait. Un double qui s'écarte du
// service qu'il imite ne prouve rien, et c'est le motif que ce dépôt paie le plus souvent.
const SEP = '─'.repeat(40);
const boiteAvec = (texte) => [SEP, `❯ ${texte}`, SEP, '  ⏵⏵ auto mode on'].join('\n');
const BOITE_VIDE = [SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');

test('la cause ne CONCLUT plus — elle nomme ce qui a été vu', async () => {
  const r = await delivrerLaBoite({
    texteCoince: ORDRE_PERDU,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 0,
    essais: 1,
    delaiMs: 0,
  });
  assert.equal(r.cause, 'vide-cause-inconnue', 'le nom dit ce qui est vu, pas ce qu’on en déduit');
  assert.notEqual(r.cause, 'liberee-seule', 'l’ancien nom affirmait qu’un geste avait eu lieu');
});

test('le texte disparu remonte ENTIER — c’est le seul point qui rend la perte réparable', async () => {
  const r = await delivrerLaBoite({
    texteCoince: ORDRE_PERDU,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 0,
    essais: 1,
    delaiMs: 0,
  });
  // ⚠️ ENTIER : ni tronqué, ni résumé. Sans le texte dans le résultat, il n'y a RIEN à recopier —
  // c'est exactement ce qui a failli coûter l'ordre du CTO.
  assert.equal(r.texteDisparu, ORDRE_PERDU, 'le texte vu est rendu tel quel');
});

test('l’avis s’IMPOSE au lecteur — il n’y a pas de champ à penser à lire', () => {
  // On ne demande à personne de se rappeler de relire un champ : ce chantier a mesuré neuf fois
  // qu'une discipline écrite ne mord pas. L'avis part DANS le message livré, comme celui de la
  // boîte bloquée — le destinataire ne peut pas ne pas le voir.
  const avis = avisDeBoiteVidee({ texteDisparu: ORDRE_PERDU });
  assert.match(avis, /vid/i, 'l’avis dit que la boîte s’est vidée');
  assert.ok(avis.includes(ORDRE_PERDU), 'et il porte le texte ENTIER, pas un résumé');
  assert.doesNotMatch(avis, /soumis pour son auteur/i, 'il n’annonce PAS un geste qui n’a pas eu lieu');
});

test('le destinataire reçoit l’avis COLLÉ à son message — la preuve est dans ce qui est écrit', async () => {
  const ecrits = [];
  await livrerBrief({
    pane: 'w1:p1',
    texte: 'mon message',
    pairOccupe: true,
    immobiliteMs: 60000,
    appelHerdr: async (c) => {
      // ⚠️ ON CAPTURE TOUT ce qui part vers le pane, sans filtrer sur le nom du sous-verbe :
      // une capture conditionnelle rendait ce test vert-faux si la commande changeait de forme.
      ecrits.push(Array.isArray(c) ? c.join(' ') : String(c));
      return { ok: true, reponse: { result: { agent: { agent_status: 'done' } } } };
    },
    lireEcran: (() => {
      let n = 0;
      // 1re lecture : la boîte porte l'ordre — obstacle. Ensuite : vide.
      return async () => (n++ === 0 ? boiteAvec(ORDRE_PERDU) : BOITE_VIDE);
    })(),
    dormir: async () => {},
    essais: 1,
    delaiMs: 0,
    attenteMs: 0,
  });
  const livre = ecrits.join('\n');
  assert.ok(livre.includes(ORDRE_PERDU), 'le texte disparu voyage avec le message livré');
  assert.ok(livre.includes('mon message'), 'et le message de l’émetteur part quand même');

  // ⚠️ ET C'EST BIEN L'AVIS DE LA BOÎTE VIDÉE, PAS CELUI DE LA BOÎTE BLOQUÉE.
  //
  // Sans ces deux lignes, une mutation qui ÉCHANGE les deux avis reste verte — relevé en passe 2
  // sur 317 essais verts. Les deux portent un texte et le même message : ce qui les distingue
  // n'est pas ce qu'ils contiennent, c'est CE QU'ILS AFFIRMENT. L'un annonce un geste posé au nom
  // du destinataire, l'autre un constat qu'on ne sait pas expliquer.
  //
  // Annoncer « j'ai soumis en ton nom » quand on n'a rien soumis serait le défaut exact que ce
  // module combat — une affirmation sur un geste qui n'a pas eu lieu.
  // ⚠️ ON CHERCHE L'AFFIRMATION, PAS LE MOT. Première écriture de cet essai : `/SOUMIS EN TON
  // NOM/i` — qui rougissait sur la phrase de NÉGATION de l'avis juste (« je n'ai rien soumis en
  // ton nom »). Chercher un mot et conclure sur la fonction : le défaut même que ce chantier
  // corrige, commis dans l'essai censé l'attraper.
  assert.doesNotMatch(livre, /Je l’ai SOUMIS pour son auteur/i, 'on n’annonce PAS un geste qu’on n’a pas posé');
  assert.match(livre, /ELLE S’EST VIDÉE/i, 'c’est le constat de la boîte vidée qui part');
});

test('L’ENVOI NE DOIT PAS ÉCHOUER — la cause bénigne est majoritaire, refuser ici tuerait la garde', async () => {
  // NON-RÉGRESSION, et c'est la moitié qui protège. Presque tous les envois trouvent une boîte
  // vide parce que l'auteur a soumis : faire échouer là-dessus refuserait la quasi-totalité du
  // trafic. Une garde qui crie à tort se fait retirer — et elle emporte ce qu'elle gardait.
  const r = await delivrerLaBoite({
    texteCoince: ORDRE_PERDU,
    commandes: { lireEcran: ['agent', 'read', 'w1:p1'], soumettre: ['agent', 'send-keys', 'w1:p1', 'Enter'] },
    appelHerdr: async () => ({ ok: true }),
    lireEcran: async () => BOITE_VIDE,
    dormir: async () => {},
    immobiliteMs: 0,
    essais: 1,
    delaiMs: 0,
  });
  assert.equal(r.ok, true, 'la voie reste ouverte');
  assert.equal(r.soumis, false, 'et on n’affirme PAS avoir soumis quoi que ce soit');
});

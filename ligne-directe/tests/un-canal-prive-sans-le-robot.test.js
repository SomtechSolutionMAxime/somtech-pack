// UN CANAL PRIVÉ SANS LE ROBOT N'EXISTE PAS, POUR LE ROBOT — et le refus ne doit pas en conclure
// qu'il n'existe pas du tout (T-20260806-0197).
//
// LE DÉFAUT, MESURÉ EN PRODUCTION SLACK : `conversations.list` et `conversations.info` ne rendent
// PAS à un jeton de robot les canaux privés dont il n'est pas membre. Le double, lui, les rendait
// (il filtrait sur `is_private`, jamais sur l'appartenance) : tous les tests du refus « fais
// inviter le robot » passaient donc par un chemin que le vrai Slack ne prend jamais.
//
// En production, le cas le plus fréquent d'un représentant client — le canal privé du client
// existe, personne n'y a encore invité notre robot — tombait ailleurs :
//
//   1. `creerCanal` sur un nom pris : `trouverCanal` rend `null`, et c'est l'erreur BRUTE
//      `name_taken` qui remontait. Aucun geste nommé, rien que l'appelant puisse relayer ;
//   2. `verifierCanalJoignable` rendait « absent », et le refus disait « vérifie le nom, ou
//      fais-le créer » — faire créer un canal qui existe, au lieu d'y faire inviter le robot.
//
// Le robot ne peut PAS distinguer « absent » de « privé sans moi » : les deux se voient pareil
// de son jeton. Le refus juste nomme donc les deux causes et les deux gestes — et il les porte
// comme FAITS lisibles, pas seulement comme phrase, pour qu'un test ne garde pas un vocabulaire.
//
// Contre-épreuve incluse : le même canal AVEC le robot doit rendre un verdict différent. Sans
// elle, une garde qui refuserait tout serait verte ici.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fauxSlack } from './aide/faux-slack.js';
import { creerCanal, InvitationRequise, RefusDefinitif, ErreurSlack, trouverCanal, infoCanal } from '../src/slack.js';
import { verifierCanalJoignable, messageDeRefus } from '../src/representant.js';

const JETON = 'xoxb-essai';

/** Monte un espace Slack en mémoire pour la durée d'un test, et le démonte quoi qu'il arrive. */
async function avecSlack(etat, corps) {
  const monde = fauxSlack(etat).installer();
  try {
    return await corps(monde);
  } finally {
    monde.restaurer();
  }
}

const privéSansLeRobot = () => ({
  canaux: [{ id: 'C_CLI', name: 'client-x', is_private: true, membres: ['UDIRIGEANT'] }],
  robot: 'UMOI',
});

const privéAvecLeRobot = () => ({
  canaux: [{ id: 'C_CLI', name: 'client-x', is_private: true, membres: ['UDIRIGEANT', 'UMOI'] }],
  robot: 'UMOI',
});

// ═════════════════════════════ le double d'abord : une cloison qu'on n'éprouve pas n'en est pas une

test('LE DOUBLE CACHE AU ROBOT UN CANAL PRIVÉ DONT IL N’EST PAS MEMBRE — liste ET fiche, comme Slack', async () => {
  await avecSlack(privéSansLeRobot(), async () => {
    assert.equal(await trouverCanal(JETON, 'client-x'), null, 'conversations.list ne doit pas le rendre');
    const echec = await infoCanal(JETON, 'C_CLI').then(
      () => null,
      (err) => err
    );
    assert.ok(echec instanceof ErreurSlack, 'conversations.info doit refuser');
    assert.equal(echec.code, 'channel_not_found');
  });
  // Contre-épreuve : le robot dedans, le canal se voit par les deux chemins.
  await avecSlack(privéAvecLeRobot(), async () => {
    assert.equal((await trouverCanal(JETON, 'client-x'))?.id, 'C_CLI');
    assert.equal((await infoCanal(JETON, 'C_CLI')).membre, true);
  });
});

// ═════════════════════════════ (a) la reprise d'un canal privé qu'on ne voit pas

test('REPRENDRE UN CANAL PRIVÉ SANS LE ROBOT rend un refus NOMMÉ portant le geste d’invitation — pas name_taken brut', async () => {
  await avecSlack(privéSansLeRobot(), async (monde) => {
    const echec = await creerCanal(JETON, 'client-x', true).then(
      () => null,
      (err) => err
    );
    assert.ok(echec, 'le nom est pris : la création ne peut pas réussir');
    assert.ok(
      echec instanceof InvitationRequise,
      `erreur brute au lieu d’un refus nommé : ${echec?.name} — ${echec?.message}`
    );
    assert.ok(echec instanceof RefusDefinitif);
    assert.equal(echec.reessayable, false, 'réessayer ne changera rien : il faut un geste humain');
    assert.equal(echec.geste, 'invitation_humaine', 'le geste qui lève l’impasse, comme fait lisible');
    assert.equal(echec.visible, false, 'le refus dit que le robot ne VOIT pas ce canal — il ne prétend pas en connaître l’id');
    assert.equal(echec.canal, 'client-x');
    assert.match(echec.message, /#client-x/, 'le canal se désigne par son nom, là où le geste se fait');

    assert.deepEqual(
      monde.appels.filter((a) => a.methode === 'conversations.join'),
      [],
      'aucun join : un robot ne rejoint pas un canal privé'
    );
    assert.equal(monde.canaux.length, 1, 'et aucun canal n’a été créé à côté');
  });
});

test('contre-épreuve (a) : le robot membre du même canal privé — la reprise RÉUSSIT', async () => {
  await avecSlack(privéAvecLeRobot(), async () => {
    const r = await creerCanal(JETON, 'client-x', true);
    assert.deepEqual(r, { id: 'C_CLI', nom: 'client-x', prive: true, reutilise: true });
  });
});

// ═════════════════════════════ (b) la joignabilité vérifiée avant de poser un représentant

test('JOIGNABILITÉ D’UN CANAL PRIVÉ SANS LE ROBOT : le verdict nomme les DEUX causes et les DEUX gestes', async () => {
  await avecSlack(privéSansLeRobot(), async (monde) => {
    const r = await verifierCanalJoignable(JETON, 'client-x');
    assert.equal(r.joignable, false);

    // LES FAITS D'ABORD — un texte se reformule, un fait se lit.
    assert.deepEqual(
      [...(r.causes || [])].sort(),
      ['absent', 'prive_sans_robot'],
      `le verdict ne porte pas les deux causes indiscernables : ${JSON.stringify(r)}`
    );
    assert.ok(
      (r.gestes || []).includes('invitation_humaine'),
      `le geste « faire inviter le robot » manque au verdict : ${JSON.stringify(r)}`
    );
    assert.ok((r.gestes || []).includes('corriger_ou_faire_creer'), 'et le geste de l’autre cause aussi');

    // PUIS LE TEXTE — rendu par le code, jamais recopié ici.
    const message = messageDeRefus(r);
    assert.match(message, /privé/, `le refus ne nomme pas la possibilité d’un canal privé :\n${message}`);
    assert.match(message, /\/invite/, `le refus ne nomme pas le geste d’invitation :\n${message}`);
    assert.match(message, /créer|nom/, 'et il garde le geste de l’autre cause');

    assert.deepEqual(
      monde.appels.filter((a) => a.methode === 'conversations.join'),
      [],
      'la vérification ne tente jamais de rejoindre'
    );
  });
});

test('LE TEXTE SUIT LES GESTES : un verdict sans le geste d’invitation ne le fait pas dire', async () => {
  // Garde du FAIT contre la phrase : si le message était écrit en dur, retirer le geste du
  // verdict ne changerait rien au texte, et les deux pourraient diverger en silence.
  const sans = messageDeRefus({ joignable: false, motif: 'absent', canal: 'client-x', gestes: ['corriger_ou_faire_creer'] });
  assert.doesNotMatch(sans, /\/invite/, `le texte invente un geste que le verdict ne porte pas :\n${sans}`);
  const avec = messageDeRefus({
    joignable: false,
    motif: 'absent',
    canal: 'client-x',
    gestes: ['corriger_ou_faire_creer', 'invitation_humaine'],
  });
  assert.match(avec, /\/invite/);
});

test('contre-épreuve (b) : le robot membre du même canal privé — joignable', async () => {
  await avecSlack(privéAvecLeRobot(), async () => {
    const r = await verifierCanalJoignable(JETON, 'client-x');
    assert.equal(r.joignable, true, `verdict inchangé alors que la sonde a changé : ${JSON.stringify(r)}`);
    assert.equal(r.id, 'C_CLI');
    assert.equal(r.prive, true);
  });
});

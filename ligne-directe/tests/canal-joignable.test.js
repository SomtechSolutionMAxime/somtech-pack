// La joignabilité d'un canal — ce que « /gestionnaire-client » vérifie AVANT de poser quoi
// que ce soit chez un client (E-20260807-0002).
//
// Deux refus distincts, et ils appellent des gestes différents : un canal ABSENT se corrige
// (faute de frappe, ou il faut le faire créer) ; un canal dont notre robot n'est PAS MEMBRE
// se règle par une invitation humaine — jamais par du code, parce qu'un robot ne rejoint pas
// un canal privé. Le double utilisé ici (`fauxSlack`) refuse déjà ce que le vrai Slack
// refuse : `droitRejoindre` est FAUX par défaut, exactement comme l'application réelle
// (mesuré le 2026-08-06), donc ce fichier n'a besoin d'inventer aucune permissivité en plus.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fauxSlack } from './aide/faux-slack.js';
import { verifierCanalJoignable } from '../src/representant.js';

const JETON = 'xoxb-essai';

test('joignable : canal absent du tout — motif « absent »', async () => {
  const monde = fauxSlack({ canaux: [] });
  monde.installer();
  try {
    const r = await verifierCanalJoignable(JETON, 'client-fantome');
    assert.equal(r.joignable, false);
    assert.equal(r.motif, 'absent');
  } finally {
    monde.restaurer();
  }
});

test('joignable : canal privé existant, robot PAS membre — motif « non_membre »', async () => {
  const monde = fauxSlack({
    canaux: [{ id: 'C1', name: 'client-x', is_private: true, membres: ['UAUTRE'] }],
    robot: 'UMOI',
  });
  monde.installer();
  try {
    const r = await verifierCanalJoignable(JETON, 'client-x');
    assert.equal(r.joignable, false);
    assert.equal(r.motif, 'non_membre');
    // Et la garde n'a JAMAIS tenté de rejoindre — le hors-scope de l'epic l'interdit : le
    // geste appartient à un humain. Si ce module se mettait à appeler conversations.join,
    // ce test le verrait dans les appels du double.
    assert.ok(
      !monde.appels.some((a) => a.methode === 'conversations.join'),
      'la vérification ne doit jamais tenter de rejoindre le canal elle-même'
    );
  } finally {
    monde.restaurer();
  }
});

test('joignable : canal privé existant, robot déjà membre — joignable', async () => {
  const monde = fauxSlack({
    canaux: [{ id: 'C1', name: 'client-x', is_private: true, membres: ['UMOI'] }],
    robot: 'UMOI',
  });
  monde.installer();
  try {
    const r = await verifierCanalJoignable(JETON, 'client-x');
    assert.equal(r.joignable, true);
    assert.equal(r.id, 'C1');
    assert.equal(r.prive, true);
  } finally {
    monde.restaurer();
  }
});

test('mutation : un canal public dont le robot est membre reste joignable — la garde ne porte pas sur la confidentialité', async () => {
  // Ce test n'est pas décoratif malgré son intitulé positif : il fixe explicitement ce que
  // `verifierCanalJoignable` NE vérifie PAS (privé/public), pour qu'un futur lecteur ne
  // l'ajoute pas par erreur en pensant combler un trou — cette vérification-là vit ailleurs
  // (ouverture de la ligne elle-même), et le hors-scope de ce lot ne la couvre pas.
  const monde = fauxSlack({
    canaux: [{ id: 'C2', name: 'canal-interne', is_private: false, membres: ['UMOI'] }],
    robot: 'UMOI',
  });
  monde.installer();
  try {
    const r = await verifierCanalJoignable(JETON, 'canal-interne');
    assert.equal(r.joignable, true);
  } finally {
    monde.restaurer();
  }
});

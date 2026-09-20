// un-nom-porte-deux-fois-fait-rougir.test.js
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260818-0036)
//
// Deux panes ont porté SIMULTANÉMENT le nom `charles-olivier`, sur le lieu d'un client servi.
// L'adressage entre agents se fait par le NOM : deux porteurs, c'est un message qui part chez le
// mauvais destinataire — et ici le destinataire était le représentant d'un client, dont le canal
// est le canal du client.
//
// ⚠️ LE TICKET POSE TROIS CRITÈRES, ET UN SEUL NOUS APPARTIENT. Il faut le dire avant d'écrire :
//
//   ① « `herdr agent rename` REFUSE un nom déjà porté »  → CODE DE `herdr`, PAS LE NÔTRE.
//      Règle d'or n°7. On ne l'invente pas, et on ne prétend pas l'avoir fermé.
//   ② « un envoi vers un nom ambigu REFUSE »             → DÉJÀ FAIT, et gardé :
//      `destinataire.js` refuse l'homonymie, `tests/parler-a-un-agent.test.js` le tient.
//   ③ « la ronde SIGNALE tout nom porté par plus d'un agent vivant » → À NOUS, et manquant.
//
// C'est ③ que ce fichier garde.
//
// ⚠️ ET LA POPULATION EST LE PIÈGE DE CE CRITÈRE. `agent list` d'UNE session ne rend que la
// sienne ; ce poste en porte seize. Un compte fait sur une seule session sous-compte, et son
// « zéro doublon » serait vrai pour ce qu'il a vu, faux pour le poste. La ronde balaie déjà
// TOUTES les sessions — c'est ce balayage-là qui doit compter les noms, pas un second.
//
// ⚠️ MESURÉ LE 2026-09-20, avant d'écrire : 16 sessions dont 11 MUETTES, 80 agents vus, 39 noms
// distincts, ZÉRO doublon. Les 11 muettes sont des sockets morts du 7 juillet au 22 août — pas
// des sessions vivantes qu'on aurait manquées. Le zéro porte donc sur toute la population
// VIVANTE. Le défaut n'est pas actif aujourd'hui ; sa cause est intacte.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ⚠️ LA FORME EXACTE QUE LE BALAYAGE REND, pas une de plus. Le premier jet emballait la réponse
// DEUX fois — `{ok, reponse:{...}}` là où la ronde passe déjà `r.reponse`. Un double qui
// n'a pas la forme du réel fabrique des défauts qui n'existent pas : ici, trois rouges qui
// accusaient le code alors que c'était l'instrument.
const reponse = (agents) => ({ result: { agents } });

test('UN NOM PORTÉ PAR DEUX AGENTS VIVANTS EST RELEVÉ, ET IL EST NOMMÉ', async () => {
  const { nomsEnDouble } = await import('../src/rendez-vous.js');

  const vus = nomsEnDouble([
    { socket: '/s/a.sock', reponse: reponse([{ pane_id: 'w1:p1', name: 'charles-olivier' }, { pane_id: 'w1:p2', name: 'batiscan' }]) },
    { socket: '/s/b.sock', reponse: reponse([{ pane_id: 'w9:p7', name: 'charles-olivier' }]) },
  ]);

  assert.equal(vus.length, 1, 'un seul nom est en double');
  assert.equal(vus[0].nom, 'charles-olivier');
  // ⚠️ NOMMER LE NOM NE SUFFIT PAS : c'est la liste des PORTEURS qui permet d'aller voir lequel
  // est le bon. Un signal qui dit « il y a un doublon » sans dire où envoie chercher partout.
  assert.equal(vus[0].porteurs.length, 2, 'les deux porteurs sont nommés');
  assert.deepEqual(
    vus[0].porteurs.map((p) => p.pane).sort(),
    ['w1:p1', 'w9:p7'],
    'avec leur pane — c’est par là qu’on va voir lequel est lequel'
  );
  assert.notEqual(vus[0].porteurs[0].socket, vus[0].porteurs[1].socket, 'et leur session : un pane n’est unique que dans la sienne');
});

test('LE DOUBLON SE VOIT À TRAVERS LES SESSIONS — un compte sur UNE session ne le verrait pas', async () => {
  const { nomsEnDouble } = await import('../src/rendez-vous.js');

  // ⚠️ C'EST LE CAS QUI DÉCIDE, et c'est celui de l'incident : les deux porteurs ne sont PAS
  // dans la même session. Un relevé fait depuis une seule session verrait un seul porteur et
  // conclurait « aucun doublon » — vrai pour ce qu'il a vu, faux pour le poste. La ronde balaie
  // les seize sessions ; c'est ce balayage qui doit compter.
  const memeSession = nomsEnDouble([
    { socket: '/s/a.sock', reponse: reponse([{ pane_id: 'w1:p1', name: 'x' }]) },
  ]);
  assert.equal(memeSession.length, 0, 'un seul porteur : rien à signaler');

  const deuxSessions = nomsEnDouble([
    { socket: '/s/a.sock', reponse: reponse([{ pane_id: 'w1:p1', name: 'x' }]) },
    { socket: '/s/b.sock', reponse: reponse([{ pane_id: 'w2:p1', name: 'x' }]) },
  ]);
  assert.equal(deuxSessions.length, 1, 'le même nom dans deux sessions EST un doublon');
});

test('UN AGENT SANS NOM N’EST PAS UN DOUBLON — 31 des 66 du poste n’en ont pas', async () => {
  const { nomsEnDouble } = await import('../src/rendez-vous.js');

  // ⚠️ MESURÉ LE 2026-09-20 : 31 agents sur 66 n'ont pas de nom. Les compter ensemble ferait
  // un « doublon » de la moitié du poste, tous les jours — et une garde qui crie tous les jours
  // cesse d'être lue. C'est ainsi qu'elle meurt.
  const vus = nomsEnDouble([
    { socket: '/s/a.sock', reponse: reponse([{ pane_id: 'w1:p1' }, { pane_id: 'w1:p2', name: null }, { pane_id: 'w1:p3', name: '' }]) },
  ]);
  assert.equal(vus.length, 0, 'l’absence de nom n’est pas un nom partagé');
});

test('UNE SESSION MUETTE NE FAIT PAS CONCLURE « AUCUN DOUBLON » — elle se dit', async () => {
  const { nomsEnDouble } = await import('../src/rendez-vous.js');

  // ⚠️ RELEVÉ PAR BATISCAN EN AOÛT, ET C'EST LA MOITIÉ QU'ON OUBLIE : un compte de noms fait sur
  // une population INCOMPLÈTE rend un zéro qui ressemble trait pour trait à un vrai zéro. Un
  // agent qu'on n'a pas vu peut porter un nom déjà pris, et rien ne le montrerait.
  const vus = nomsEnDouble([
    { socket: '/s/a.sock', reponse: reponse([{ pane_id: 'w1:p1', name: 'x' }]) },
    { socket: '/s/b.sock', muette: true },
  ]);

  assert.equal(Array.isArray(vus), true);
  assert.equal(vus.length, 0, 'rien de mesurable n’est en double');
  // La liste porte sa propre réserve : ce qu'elle n'a pas pu lire.
  assert.equal(vus.muettes, 1, 'et elle DIT qu’une session ne lui a pas répondu');
});

test('LA CASSE NE FABRIQUE PAS DEUX AGENTS — `Charles-Olivier` et `charles-olivier` sont le même nom', async () => {
  const { nomsEnDouble } = await import('../src/rendez-vous.js');

  // ⚠️ L'INCIDENT PORTE LES DEUX GRAPHIES : l'agent s'appelait `charles-olivier`, son lieu
  // `.gestionnaire/Charles-Olivier`. `herdr agent rename` compare déjà sans tenir compte de la
  // casse (`agentPorteLeNom`), et un relevé qui la distinguerait manquerait le doublon réel.
  const vus = nomsEnDouble([
    { socket: '/s/a.sock', reponse: reponse([{ pane_id: 'w1:p1', name: 'Charles-Olivier' }]) },
    { socket: '/s/b.sock', reponse: reponse([{ pane_id: 'w9:p7', name: 'charles-olivier' }]) },
  ]);

  assert.equal(vus.length, 1, 'deux graphies du même nom sont UN doublon, pas deux agents');
});

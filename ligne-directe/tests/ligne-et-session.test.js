// ligne-et-session.test.js — UNE LIGNE N'EST PLUS ADRESSABLE DEPUIS LA SESSION D'UN AUTRE
// CHANTIER (T-20260816-0035, ferme T-20260816-0003).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT MESURÉ, le 2026-08-15 puis le 2026-08-16
//
// Onze sessions herdr vivent sur ce poste et NUMÉROTENT LEURS PANES INDÉPENDAMMENT. Deux
// chantiers de deux CLIENTS différents portaient le même `w5:p3` :
//
//   J-20260814-0001  socket progex   …/actionprogex/.orchestrateur/general
//   P-20260815-0002  socket somtech  …/somcraft/…/.orchestrateur/p-20260815-0002
//
// Un orchestrateur qui écrit `dire "…"` sans destinataire explicite ne dit rien de son client :
// le rattachement se fait par numéro de pane, et ce numéro en désignait deux. Le pire cas n'est
// pas un message perdu — c'est un message livré au MAUVAIS CLIENT, sur un canal qu'il voit.
//
// ⚠️ LE DISCRIMINANT EXISTAIT DÉJÀ. Mesuré sur le registre réel : `herdr_socket` est renseigné
// sur 25 lignes ouvertes sur 25. La donnée était là ; c'est la RECHERCHE qui l'ignorait.
//
// ⚠️ ET TROIS « COLLISIONS » N'EN SONT PAS. `w8:p3`, `w8:p2`, `w4:p2` portent chacune deux
// lignes de la MÊME session et du MÊME worktree : ce sont les paires ligne-de-chantier +
// ligne-dirigeant d'un représentant, et c'est le dessin voulu. Le correctif ne doit pas les
// confondre avec le défaut — sinon il retirerait l'exigence de `--a` là où elle protège.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ligneDuPane, porteursDeLigne, REFUS_SELECTION } from '../src/registre.js';

const SOMTECH = '/Users/x/.config/herdr/sessions/somtech/herdr.sock';
const PROGEX = '/Users/x/.config/herdr/sessions/progex/herdr.sock';

const ligne = (chantier, pane, socket, extra = {}) => ({
  chantier,
  pane,
  herdr_socket: socket,
  canal_id: `C-${chantier}`,
  canal_nom: chantier,
  worktree: `/w/${chantier}`,
  close_le: null,
  ...extra,
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — LE DÉFAUT MESURÉ : deux clients, un numéro de pane

test('la ligne d’un AUTRE chantier, sur une autre session, n’est ni choisie ni proposée', () => {
  const ouvertes = [
    ligne('j-20260814-0001', 'w5:p3', PROGEX), // actionprogex — l'autre client
    ligne('p-20260815-0002', 'w5:p3', SOMTECH), // somcraft — le mien
  ];

  const { ligne: choisie, candidates, refus } = ligneDuPane(ouvertes, 'w5:p3', null, { socket: SOMTECH });

  assert.equal(refus, null, 'il n’y a plus d’ambiguïté : une seule ligne vit dans MA session');
  assert.equal(choisie.chantier, 'p-20260815-0002');
  assert.equal(candidates.length, 1, 'la ligne de l’autre client ne doit même pas être PROPOSÉE');
  assert.ok(
    !candidates.some((l) => l.chantier === 'j-20260814-0001'),
    'la ligne d’actionprogex reste candidate : un mot pourrait encore partir chez le mauvais client'
  );
});

test('vu depuis l’autre session, c’est l’inverse — et personne ne voit la ligne du voisin', () => {
  const ouvertes = [
    ligne('j-20260814-0001', 'w5:p3', PROGEX),
    ligne('p-20260815-0002', 'w5:p3', SOMTECH),
  ];
  const r = ligneDuPane(ouvertes, 'w5:p3', null, { socket: PROGEX });
  assert.equal(r.ligne.chantier, 'j-20260814-0001');
  assert.equal(r.candidates.length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — LE CAS NOMINAL EST RESTAURÉ

test('un pane, une ligne, la bonne session : ça marche SANS --a', () => {
  const ouvertes = [ligne('d-20260816-0001', 'w0:pB', SOMTECH)];
  const r = ligneDuPane(ouvertes, 'w0:pB', null, { socket: SOMTECH });
  assert.equal(r.refus, null);
  assert.equal(r.ligne.chantier, 'd-20260816-0001');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — LA PROTECTION QUI DOIT SURVIVRE : deux lignes légitimes sur un même pane

test('deux lignes LÉGITIMES du même pane et de la même session exigent toujours --a', () => {
  // C'est la configuration réelle d'un représentant : sa ligne client et sa ligne dirigeant,
  // même socket, même worktree. Le correctif ne doit RIEN y changer — sinon il rouvrirait
  // T-20260813-0078, le rapport parti dans le canal d'un autre avec `ok:true`.
  const ouvertes = [
    ligne('charles-olivier-suivi-client', 'w8:p3', SOMTECH),
    ligne('dirigeant', 'w8:p3', SOMTECH),
  ];
  const r = ligneDuPane(ouvertes, 'w8:p3', null, { socket: SOMTECH });
  assert.equal(r.ligne, null, 'il ne doit toujours pas deviner');
  assert.equal(r.refus.motif, REFUS_SELECTION.NOM_REQUIS);
  assert.equal(r.candidates.length, 2);
});

test('et le nom continue de les départager', () => {
  const ouvertes = [
    ligne('charles-olivier-suivi-client', 'w8:p3', SOMTECH),
    ligne('dirigeant', 'w8:p3', SOMTECH),
  ];
  const r = ligneDuPane(ouvertes, 'w8:p3', 'dirigeant', { socket: SOMTECH });
  assert.equal(r.ligne.chantier, 'dirigeant');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 — CE QUI POURRAIT FAIRE MENTIR LE FILTRE

test('une ligne SANS socket reste JOIGNABLE — on n’écarte que sur preuve, jamais sur absence de preuve', () => {
  // ⚠️ J'AI ÉCRIT CET ESSAI À L'ENVERS D'ABORD, et les essais de bout en bout m'ont attrapé.
  // La première règle écartait toute ligne sans socket enregistré, au nom de « l'absence ne vaut
  // pas concordance ». Conséquence mesurée : vingt essais rouges, et surtout une ligne écrite
  // avant ce champ rendue INJOIGNABLE en silence — un défaut pire que celui qu'on ferme.
  //
  // La règle juste écarte sur PREUVE : deux sockets connus et différents. Une session inconnue
  // laisse la ligne candidate, et l'ambiguïté éventuelle retombe sur le refus qui exige un nom.
  const ouvertes = [ligne('vieille-ligne', 'w5:p3', undefined)];
  const r = ligneDuPane(ouvertes, 'w5:p3', null, { socket: SOMTECH });
  assert.equal(r.ligne?.chantier, 'vieille-ligne', 'une ligne ancienne ne doit pas disparaître en silence');
  assert.equal(r.refus, null);
});

test('mais elle ne masque pas le défaut : face à une ligne d’une AUTRE session, seule celle d’ici est retenue', () => {
  const ouvertes = [
    ligne('vieille-ligne', 'w5:p3', undefined),
    ligne('j-20260814-0001', 'w5:p3', PROGEX),
    ligne('p-20260815-0002', 'w5:p3', SOMTECH),
  ];
  const r = ligneDuPane(ouvertes, 'w5:p3', null, { socket: SOMTECH });
  assert.ok(!r.candidates.some((l) => l.chantier === 'j-20260814-0001'), 'la ligne de l’autre client est écartée sur preuve');
  assert.equal(r.refus.motif, REFUS_SELECTION.NOM_REQUIS, 'il reste deux candidates ici : le nom est exigé, on ne devine pas');
});

test('quand on ne connaît PAS sa propre session, on ne filtre pas — on refuse de deviner dans l’autre sens aussi', () => {
  // Un service lancé au démarrage du poste n'hérite pas de `HERDR_SOCKET_PATH`. Filtrer sur
  // une session inconnue rendrait toutes les lignes invisibles, c'est-à-dire une panne
  // silencieuse. On retombe alors sur le comportement d'avant : deux candidates, donc `--a`.
  const ouvertes = [
    ligne('j-20260814-0001', 'w5:p3', PROGEX),
    ligne('p-20260815-0002', 'w5:p3', SOMTECH),
  ];
  const r = ligneDuPane(ouvertes, 'w5:p3', null, {});
  assert.equal(r.ligne, null);
  assert.equal(r.refus.motif, REFUS_SELECTION.NOM_REQUIS, 'sans socket connu, l’ambiguïté demeure et le nom est exigé');
});

test('les appels à trois arguments ne changent pas de sens — rien de ce qui existe ne casse', () => {
  const ouvertes = [ligne('un-seul', 'w1:p1', SOMTECH)];
  assert.equal(ligneDuPane(ouvertes, 'w1:p1').ligne.chantier, 'un-seul');
  assert.equal(ligneDuPane(ouvertes, 'w1:p1', 'un-seul').ligne.chantier, 'un-seul');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 — LE PAIR : chaque porteur a SA session

test('une ligne partagée reste joignable depuis le pane du pair, dans LA SESSION DU PAIR', () => {
  // Un gestionnaire d'un autre atelier peut porter la ligne d'un chantier : son pane et son
  // socket sont les SIENS. Rattacher le pane du pair au socket du propriétaire rendrait la
  // ligne invisible depuis chez lui — c'est-à-dire le défaut de T-20260814-0093, rejoué par
  // le mécanisme censé le protéger.
  const partagee = ligne('p-20260728-0002', 'w3:p2', SOMTECH, {
    pair: { role: 'representant', nom: 'francois', pane: 'w4:p2', herdr_socket: PROGEX },
  });
  assert.equal(ligneDuPane([partagee], 'w4:p2', null, { socket: PROGEX }).ligne?.chantier, 'p-20260728-0002');
  assert.equal(
    ligneDuPane([partagee], 'w4:p2', null, { socket: SOMTECH }).ligne,
    null,
    'le pane du pair ne doit pas répondre depuis la session du propriétaire'
  );
});

test('porteursDeLigne rend chaque porteur AVEC sa session — un porteur sans la sienne serait un porteur mal placé', () => {
  const partagee = ligne('p', 'w3:p2', SOMTECH, {
    pair: { role: 'representant', nom: 'f', pane: 'w4:p2', herdr_socket: PROGEX },
  });
  assert.deepEqual(porteursDeLigne(partagee), [
    { pane: 'w3:p2', socket: SOMTECH },
    { pane: 'w4:p2', socket: PROGEX },
  ]);
  assert.deepEqual(porteursDeLigne({ pane: 'w1:p1' }), [{ pane: 'w1:p1', socket: null }]);
});

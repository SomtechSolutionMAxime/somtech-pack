// UN AGENT FIGÉ SE VOIT, UN AGENT QUI PENSE N'EST PAS SIGNALÉ (T-20260816-0063).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE TROISIÈME ÉTAT
//
// Le dispositif connaît deux états : au travail, et parqué derrière un écran — ce dernier
// nommé depuis `T-20260816-0033`. Il en existe un troisième : **figé**. Ni `working`, ni
// `blocked`, aucun écran affiché, rien à répondre. Une session y a passé **plus d'une heure**,
// et c'est une ronde humaine qui l'a découverte, pas le dispositif.
//
// Il est PIRE que l'agent parqué, pour une raison précise : le parqué a un écran, donc une
// preuve lisible. **Le figé n'a rien**, et il ressemble trait pour trait à un agent qui pense.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI A ÉTÉ MESURÉ AVANT D'ÉCRIRE UNE SEULE LIGNE — et une piste y est morte
//
// ⛔ `state_change_seq` NE DISCRIMINE RIEN. Le relais le proposait comme « la piste la plus
// prometteuse ». Mesuré sur 60 s : il est resté **figé pour un agent qui travaillait
// activement**, exactement comme pour ceux au repos. Il compte les TRANSITIONS d'état
// (`idle → working → done`), pas l'activité. Une garde bâtie dessus aurait déclaré figé
// **tout agent au travail**.
//
// ✅ `revision` DISCRIMINE, croisée au STATUT. Même série : ~1 par seconde chez l'agent au
// travail, immobile à l'unité près chez les 78 autres.
//
// ✅ ET UN AGENT QUI PENSE N'EST PAS SIGNALÉ — observé, six points sur 45 s, sur un agent en
// pleine réflexion dont le compteur d'activité dépassait la minute (le cas exact que le relais
// annonçait) : `state_change_seq` figé, `revision` +1 par seconde. Le mécanisme ne dépend pas
// du libellé — trois libellés distincts observés (`Whirring…`, `Infusing…`, `Seasoning…`) —
// mais du fait qu'un libellé d'activité **porte sa propre horloge**, donc redessine l'écran.
//
// ✅ LE FOCUS NE COMPTE PAS. Mesuré sur les 79 panes du poste : `focused: false` et la
// `revision` avance quand même. Si le rendu avait dépendu du focus, la garde tombait pour tout
// agent en arrière-plan — c'est-à-dire pour tous, en pratique.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LES DEUX FORMES, ET ELLES NE SONT PAS PROUVÉES PAREIL — c'est écrit en toutes lettres
//
//   • `agent-introuvable` — **PROUVÉE**. Un spécimen a été fabriqué : agent jetable gelé par
//     `SIGSTOP`. Il ne devient pas « `working` à revision immobile » : il **disparaît de la
//     détection** (`agent_not_found`) pendant que son pane vit encore, en `unknown`, revision
//     figée. Aucune garde ne regardait cet état.
//
//   • `fige-sans-ecran` — **JAMAIS OBSERVÉE DIRECTEMENT**. Le spécimen fabriqué a produit
//     l'autre forme ; le vrai figé, vu deux fois, a été perdu les deux fois (réveillé à la
//     main, puis fermé). Cette forme PENCHE DONC VERS LE SILENCE : plusieurs lectures
//     espacées exigées, et le moindre doute rend `null`. Une garde à demi prouvée qui crie
//     trop se fait retirer en emportant ce qu'elle gardait ; la même qui se tait trop ne coûte
//     qu'une occasion manquée, et la ronde la rattrape.
//
// ⚠️ ET QUAND ELLE SE DÉCLENCHE, ELLE CAPTURE. Le vrai figé existe et son spécimen a été perdu
// deux fois. La garde ne se contente donc pas de crier : elle rend la série de revisions avec
// leurs horodatages, le statut, et ce que le pane affichait. La moitié non prouvée cesse
// d'attendre un laboratoire — elle s'auto-mesure sur le terrain, et la prochaine occurrence
// réelle rendra la preuve que personne n'a su fabriquer.
//
// ⚠️ ON NE DÉBLOQUE JAMAIS À LA PLACE DE L'AGENT. Envoyer une touche à un agent figé, c'est
// taper à sa place. Le but est qu'il SE VOIE, pas qu'on le pilote — ce module rend un
// verdict, il n'agit sur rien.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { verdictDeVigie, LECTURES_MINIMALES } from '../src/vigie.js';

/** Une lecture de pane telle que la ronde la prend — horodatée, parce que la capture en vit. */
const vu = (t, statut, revision, sur = {}) => ({ t, statut, revision, ecran: 'un écran', ...sur });

const IMMOBILE = [vu(0, 'working', 500), vu(20000, 'working', 500), vu(40000, 'working', 500)];

// ═════════════════ 1. LA FORME PROUVÉE — l'agent a disparu de la détection

test('UN AGENT DEVENU INTROUVABLE ALORS QUE SON PANE VIT EST SIGNALÉ — mesuré sur un spécimen', () => {
  // Le seul cas dont on a un spécimen : gelé par SIGSTOP, l'agent quitte la détection et son
  // pane reste là, en `unknown`, revision figée. Personne ne regardait ça.
  const v = verdictDeVigie([
    vu(0, 'working', 26),
    vu(20000, null, 26, { introuvable: true }),
    vu(40000, null, 26, { introuvable: true }),
  ]);

  assert.equal(v?.forme, 'agent-introuvable');
  assert.match(v.quoi, /introuvable|disparu/i, 'le verdict dit ce qui est arrivé');
});

test('UN PANE PASSÉ À « unknown » COMPTE AUSSI — c’est le même fait vu de l’autre bout', () => {
  const v = verdictDeVigie([vu(0, 'working', 26), vu(20000, 'unknown', 26), vu(40000, 'unknown', 26)]);
  assert.equal(v?.forme, 'agent-introuvable');
});

test('UN AGENT QU’ON N’A JAMAIS VU DÉTECTÉ N’A PAS DISPARU — on ne signale pas une absence de départ', () => {
  // ⚠️ Sans un « avant » où l'agent était là, « introuvable » ne veut rien dire : un pane vide
  // n'a perdu personne. C'est le motif que ce dépôt ferme partout — une preuve doit porter sur
  // un état qui POUVAIT être différent.
  // ⚠️ TROIS lectures espacées, pas deux : avec deux, la série est rejetée pour sa taille
  // AVANT d'atteindre la garde que cet essai prétend éprouver. Relevé en mutant la garde —
  // elle restait verte. Un essai qui passe par un autre chemin que celui qu'il nomme ne
  // prouve rien de ce qu'il annonce.
  assert.equal(
    verdictDeVigie([
      vu(0, null, 1, { introuvable: true }),
      vu(20000, null, 1, { introuvable: true }),
      vu(40000, null, 1, { introuvable: true }),
    ]),
    null,
  );
});

// ═════════════════ 2. LA FORME QUI PENCHE VERS LE SILENCE — figé sans écran

test('UN AGENT « working » DONT LA REVISION NE BOUGE PLUS EST SIGNALÉ — sur plusieurs lectures', () => {
  const v = verdictDeVigie(IMMOBILE);
  assert.equal(v?.forme, 'fige-sans-ecran');
});

test('⚠️ ET LE VERDICT PORTE SA PROPRE LIMITE — cette forme n’a jamais été observée en vrai', () => {
  // Une garde qui tait ce qu'elle ne sait pas se fait croire au-delà de ce qu'elle a prouvé.
  // Celle-ci dit, dans son verdict même, qu'elle repose sur un raisonnement et pas sur un
  // spécimen — pour que celui qui la lit sache quoi en faire.
  const v = verdictDeVigie(IMMOBILE);
  assert.match(v.limite, /jamais\s+(?:\S+\s+)?observ/i, 'la limite vit avec le verdict, pas dans une note ailleurs');
});

test('UNE SEULE LECTURE NE SIGNALE RIEN — un point de mesure est un indice, une série est un fait', () => {
  // ⚠️ LE RÉGLAGE QUI FERME LE FAUX POSITIF. Un agent dont la revision n'a pas bougé sur UNE
  // mesure n'est pas figé : c'est un agent mesuré une fois.
  assert.equal(verdictDeVigie([vu(0, 'working', 500)]), null);
  assert.equal(verdictDeVigie([vu(0, 'working', 500), vu(20000, 'working', 500)]), null,
    `moins de ${LECTURES_MINIMALES} lectures ne suffit pas`);
});

test('UN AGENT QUI PENSE N’EST PAS SIGNALÉ — la moitié qui prouve, et elle est mesurée', () => {
  // ⚠️ SANS CET ESSAI, TOUT LE RESTE NE VAUT RIEN. Observé en vrai : un agent en pleine
  // réflexion, compteur d'activité dépassant la minute, revision +1 par seconde. Une garde qui
  // le signalerait serait retirée — et emporterait ce qu'elle gardait.
  const pense = [vu(0, 'working', 16731), vu(9000, 'working', 16740), vu(18000, 'working', 16750),
                 vu(27000, 'working', 16759), vu(36000, 'working', 16768), vu(45000, 'working', 16778)];
  assert.equal(verdictDeVigie(pense), null);
});

test('UN AGENT AU REPOS N’EST JAMAIS SIGNALÉ — sa revision est immobile PAR NATURE', () => {
  // Les 78 panes au repos du poste ont tous une revision figée. Les signaler ferait crier la
  // ronde sur tout le poste au premier passage — la façon la plus sûre de la rendre inaudible.
  assert.equal(verdictDeVigie([vu(0, 'idle', 1), vu(20000, 'idle', 1), vu(40000, 'idle', 1)]), null);
  assert.equal(verdictDeVigie([vu(0, 'done', 12835), vu(20000, 'done', 12835), vu(40000, 'done', 12835)]), null);
});

test('UNE REVISION QU’ON N’A PAS PU LIRE NE VAUT PAS « ELLE N’A PAS BOUGÉ »', () => {
  // ⚠️ Le motif de la maison : « je n'ai pas vu » n'est pas « il n'y avait rien ». Une lecture
  // ratée au milieu d'une série casse la série au lieu de la confirmer.
  assert.equal(verdictDeVigie([vu(0, 'working', 500), vu(20000, 'working', null), vu(40000, 'working', 500)]), null);
});

test('UNE SÉRIE ENTIÈREMENT ILLISIBLE NE SE LIT PAS COMME « RIEN N’A BOUGÉ »', () => {
  // ⚠️ LE CAS QUI MANQUAIT, TROUVÉ EN MUTANT MA PROPRE GARDE. Quand UNE lecture est illisible,
  // la série se casse d'elle-même — la valeur diffère des autres. Mais quand TOUTES le sont,
  // `null === null` : l'immobilité devient vraie par accident et on signalerait un agent sur
  // trois lectures dont aucune n'a rien vu. C'est le motif de la maison dans sa forme la plus
  // pure — « je n'ai pas vu » lu comme « il n'y avait rien ».
  assert.equal(verdictDeVigie([vu(0, 'working', null), vu(20000, 'working', null), vu(40000, 'working', null)]), null);
});

test('DES LECTURES TROP RAPPROCHÉES NE PROUVENT RIEN — il faut du temps entre elles', () => {
  // Trois lectures dans la même seconde ne disent pas qu'un agent est figé : elles disent
  // qu'on a regardé trois fois trop vite.
  assert.equal(verdictDeVigie([vu(0, 'working', 500), vu(200, 'working', 500), vu(400, 'working', 500)]), null);
});

// ═════════════════ 3. LA CAPTURE — parce que le spécimen a été perdu deux fois

test('LE VERDICT CAPTURE CE QU’IL A VU — la série, les horodatages, le statut, l’écran', () => {
  // ⚠️ LE VRAI FIGÉ EXISTE ET SON SPÉCIMEN A ÉTÉ PERDU DEUX FOIS — réveillé à la main, puis
  // fermé. La garde ne se contente donc pas de crier : elle rend de quoi établir après coup ce
  // que ni l'auteur ni son coordonnateur n'ont su fabriquer. La moitié non prouvée s'auto-mesure
  // sur le terrain au lieu d'attendre un laboratoire.
  const v = verdictDeVigie(IMMOBILE);

  assert.deepEqual(v.capture.revisions, [500, 500, 500], 'la série, pas seulement son verdict');
  assert.deepEqual(v.capture.horodatages, [0, 20000, 40000], 'et QUAND — sans ça la série ne se relit pas');
  assert.equal(v.capture.statut, 'working');
  assert.equal(v.capture.ecran, 'un écran', 'ce que le pane affichait, pour le prochain qui cherchera');
  assert.equal(v.capture.duree_ms, 40000, 'et depuis combien de temps rien ne bouge');
});

test('LA CAPTURE VAUT AUSSI POUR LA FORME PROUVÉE — les deux se relisent pareil', () => {
  const v = verdictDeVigie([vu(0, 'working', 26), vu(20000, 'unknown', 26), vu(40000, 'unknown', 26)]);
  assert.deepEqual(v.capture.revisions, [26, 26, 26]);
  assert.equal(v.capture.duree_ms, 40000);
});

// ═════════════════ 4. CE QUE CE MODULE NE FAIT PAS

test('LE VERDICT N’EST QU’UN VERDICT — aucune touche, aucun geste, aucun déblocage', () => {
  // ⚠️ Envoyer une touche à un agent figé, c'est taper à sa place — le geste que le métier
  // d'orchestrateur interdit. Le but est qu'il SE VOIE, pas qu'on le pilote. Ce module reçoit
  // des lectures et rend un jugement : il ne peut, par construction, agir sur rien.
  const v = verdictDeVigie(IMMOBILE);
  assert.ok(!('touches' in v) && !('debloquer' in v) && !('geste' in v),
    'aucun champ de ce verdict ne propose d’agir à la place de l’agent');
});

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
//   • `fige-sans-ecran` — **ELLE ÉTAIT MORTE, PAS RARE** — corrigé le 2026-08-21
//     (T-20260821-0018). Elle guettait `working` sur `agent_status`, une valeur que cette
//     surface ne produit jamais : la branche ne pouvait pas se déclencher, et la prudence
//     écrite juste en dessous s'est lue comme de la rigueur pendant des mois. Elle guette
//     désormais le statut RÉEL de session. Elle PENCHE TOUJOURS VERS LE SILENCE : plusieurs
//     lectures espacées exigées, et le moindre doute rend un verdict de non-mesure. Une garde
//     à demi prouvée qui crie trop se fait retirer en emportant ce qu'elle gardait ; la même
//     qui se tait trop ne coûte qu'une occasion manquée, et la ronde la rattrape.
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
// ⚠️ CETTE SÉRIE-LÀ N'EXISTE PAS DANS LA NATURE, et c'est tout le sujet du lot du 2026-08-21 :
// `agent_status` ne vaut jamais `working`. On la garde POUR ÇA — elle garde la mort de la
// piste, elle ne prouve plus aucune garde.

/** Une lecture telle que la ronde la prend MAINTENANT — elle porte l'activité de session. */
const vuAvec = (t, revision, statutSession, sur = {}) =>
  vu(t, 'idle', revision, { activite: { statut: statutSession, motif: null }, ...sur });

/** La même, sonde COUPÉE — elle n'a pas pu regarder, et elle dit pourquoi. */
const vuMuet = (t, revision, motif) =>
  vu(t, 'idle', revision, { activite: { statut: null, motif } });

const CALCULE_IMMOBILE = [vuAvec(0, 500, 'busy'), vuAvec(20000, 500, 'busy'), vuAvec(40000, 500, 'busy')];

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
  const v = verdictDeVigie([
    vu(0, null, 1, { introuvable: true }),
    vu(20000, null, 1, { introuvable: true }),
    vu(40000, null, 1, { introuvable: true }),
  ]);
  assert.notEqual(v?.forme, 'agent-introuvable', 'un pane vide n’a perdu personne');
  // ⚠️ ET IL NE SE TAIT PLUS POUR AUTANT (T-20260821-0018). On n'a rien pu établir sur ce pane :
  // le dire « non mesurable » est la seule réponse qui ne mente pas. C'est aussi la forme sous
  // laquelle le défaut d'annuaire `herdr` se CONSTATE ici — il se corrige ailleurs.
  assert.equal(v?.forme, 'activite-non-mesurable');
});

// ═════════════════ 2. LA FORME QUI PENCHE VERS LE SILENCE — figé sans écran

test('⛔ `working` CHEZ herdr NE SIGNALE PLUS RIEN — la valeur guettée n’existait pas', () => {
  // ⚠️ CET ESSAI DISAIT L'INVERSE JUSQU'AU 2026-08-21, et il était VERT — sur un spécimen de
  // laboratoire introuvable dans la nature. Mesuré ce jour : `herdr pane list` rend 229 panes,
  // `agent_status` ∈ { unknown 146 · idle 83 }. ZÉRO `working`, jamais. La garde était donc
  // morte, et son essai la déclarait vivante. Il garde maintenant la mort de cette piste :
  // si quelqu'un recâble la vigie sur `agent_status`, c'est ici que ça rougit.
  assert.notEqual(verdictDeVigie(IMMOBILE)?.forme, 'fige-sans-ecran');
});

test('⚠️ LE VERDICT PORTE SA LIMITE — et elle dit ce qui A ÉTÉ MESURÉ, plus « jamais observée »', () => {
  // Une garde qui tait ce qu'elle ne sait pas se fait croire au-delà de ce qu'elle a prouvé.
  // ⚠️ MAIS UNE LIMITE PÉRIMÉE EST PIRE QUE PAS DE LIMITE : « cette forme n'a jamais été
  // observée » sous un code corrigé fabrique la prochaine lecture rassurante — c'est
  // exactement ce qui a laissé le défaut vivre des mois. La limite dit maintenant la
  // population mesurée et ce qui reste non établi.
  const v = verdictDeVigie(CALCULE_IMMOBILE);
  assert.ok(v.limite, 'la limite vit avec le verdict, pas dans une note ailleurs');
  assert.doesNotMatch(v.limite, /jamais\s+(?:\S+\s+)?observ/i, 'la prudence périmée est retirée');
  assert.match(v.limite, /105/, 'elle nomme la population sur laquelle elle a été mesurée');
  assert.match(v.limite, /non\s+établi/i, 'et ce qu’elle n’a pas pu établir');
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
  // Les panes au repos du poste ont tous une revision figée — 101 sur 105 au moment de la
  // dernière mesure. Les signaler ferait crier la ronde sur tout le poste au premier passage,
  // la façon la plus sûre de la rendre inaudible.
  // ⚠️ LE REPOS SE LIT SUR LE STATUT DE SESSION, PAS SUR `agent_status`. Cet essai portait
  // `idle` et `done` de herdr — deux valeurs qui ne décident plus rien.
  assert.equal(verdictDeVigie([vuAvec(0, 1, 'idle'), vuAvec(20000, 1, 'idle'), vuAvec(40000, 1, 'idle')]), null);
  assert.equal(verdictDeVigie([vuAvec(0, 12835, 'shell'), vuAvec(20000, 12835, 'shell'), vuAvec(40000, 12835, 'shell')]), null);
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
  const v = verdictDeVigie(CALCULE_IMMOBILE);

  assert.deepEqual(v.capture.revisions, [500, 500, 500], 'la série, pas seulement son verdict');
  assert.deepEqual(v.capture.horodatages, [0, 20000, 40000], 'et QUAND — sans ça la série ne se relit pas');
  assert.equal(v.capture.statut, 'idle', 'ce que herdr disait — gardé, mais il ne décide plus');
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

// ═════════════════ 5. LE STATUT QUI DÉCIDE VIENT DE LA SESSION, PAS DE herdr (T-20260821-0018)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI A ÉTÉ MESURÉ AVANT DE RÉÉCRIRE — et ça démolit la moitié des essais du dessus
//
// La garde de la section 2 se lisait comme prouvée. Elle ne l'était pas : ses lectures
// portaient `statut: 'working'`, **une valeur que la surface interrogée ne produit jamais**.
//
//   MESURÉ SUR CE POSTE le 2026-08-21 :
//     herdr pane list      →  229 panes,  agent_status ∈ { unknown 146 · idle 83 }.  ZÉRO `working`.
//     ~/.claude/sessions/* →  147 fichiers, status ∈ { idle 144 · waiting 1 · busy 1 · shell 1 }
//
// Les essais passaient donc au vert sur un spécimen de laboratoire qui n'existe nulle part.
// C'est le motif exact que ce dépôt ferme partout, retourné contre sa propre garde : **un vert
// qui ne touche pas ce qu'il prétend éprouver.**
//
// ⚠️ ET `waiting` N'EST PAS UN FIGÉ — mesuré, pas raisonné. Le seul pane du poste que la règle
// naïve (`busy` OU `waiting` + revision immobile) désignait est `w26:p28`. Son écran a été LU :
// un dialogue ouvert, une question à l'humain, et un `statusUpdatedAt` remontant à **plus de
// quarante heures**. C'est le **parqué**, pas le
// figé — il a un écran, donc une preuve lisible, et les familles de non-livraison le nomment
// déjà. Le ranger avec le figé, c'était le faux positif sur 1 candidat sur 1.
//
//   `busy`    → il est déclaré EN TRAIN DE CALCULER. Rien qui bouge = le figé.
//   `waiting` → il attend un humain. Rien qui bouge = normal, et quelqu'un doit aller devant.
//   `idle` / `shell` → au repos. Rien qui bouge = par nature.


test('UN AGENT DÉCLARÉ EN TRAIN DE CALCULER DONT RIEN NE BOUGE EST SIGNALÉ — sur le statut RÉEL', () => {
  // ⚠️ L'ESSAI QUI ROUGISSAIT AVANT LE CORRECTIF. `statut` (herdr) vaut `idle` ici, comme pour
  // les 83 agents du poste ; c'est `busy`, lu dans le fichier de session, qui décide. Sous
  // l'ancien code cette série rendait `null` — la vigie était aveugle à son propre sujet.
  const v = verdictDeVigie(CALCULE_IMMOBILE);
  assert.equal(v?.forme, 'fige-sans-ecran');
  assert.match(v.quoi, /calcul|travail/i, 'le verdict dit de quel état il parle');
});

test('LA VIGIE NE CROIT PLUS `agent_status` — un `working` de herdr ne suffit plus à signaler', () => {
  // ⚠️ LA MUTATION QUI DOIT ROUGIR. Si quelqu'un remet un jour la condition sur `agent_status`,
  // cet essai le voit : la valeur guettée est absente de la surface, donc la garde ne doit
  // JAMAIS s'appuyer dessus, même quand elle est fabriquée dans un essai.
  assert.notEqual(verdictDeVigie(IMMOBILE)?.forme, 'fige-sans-ecran',
    '`working` chez herdr ne prouve plus rien — cette valeur n’existe pas sur la vraie surface');
});

test('UN AGENT QUI ATTEND UN HUMAIN N’EST PAS UN FIGÉ — mesuré sur le seul candidat du poste', () => {
  // ⚠️ LE FAUX POSITIF QUE LA RÈGLE NAÏVE FABRIQUAIT, sur 1 candidat sur 1. `w26:p28` : son
  // écran a été LU, un dialogue y attendait une réponse depuis deux jours. Il a un écran, donc
  // une preuve lisible — c'est le parqué, et les familles de non-livraison le nomment déjà.
  assert.equal(
    verdictDeVigie([vuAvec(0, 7, 'waiting'), vuAvec(20000, 7, 'waiting'), vuAvec(40000, 7, 'waiting')]),
    null,
  );
});

test('UN AGENT AU REPOS RESTE MUET — `idle` et `shell` sont immobiles PAR NATURE', () => {
  // 101 des 105 panes portant un agent étaient dans cet état au moment de la mesure. Les
  // signaler ferait crier la ronde sur tout le poste au premier passage.
  assert.equal(verdictDeVigie([vuAvec(0, 1, 'idle'), vuAvec(20000, 1, 'idle'), vuAvec(40000, 1, 'idle')]), null);
  assert.equal(verdictDeVigie([vuAvec(0, 2, 'shell'), vuAvec(20000, 2, 'shell'), vuAvec(40000, 2, 'shell')]), null);
});

test('UN AGENT QUI CALCULE ET DONT L’ÉCRAN AVANCE N’EST PAS SIGNALÉ — la moitié qui prouve', () => {
  // ⚠️ SANS CET ESSAI, TOUT LE RESTE NE VAUT RIEN. Un agent qui pense redessine son compteur
  // d'activité chaque seconde. Mesuré à nouveau ce jour : le seul pane `busy` du poste était
  // aussi le seul dont la revision bougeait.
  assert.equal(
    verdictDeVigie([vuAvec(0, 16731, 'busy'), vuAvec(20000, 16750, 'busy'), vuAvec(40000, 16768, 'busy')]),
    null,
  );
});

test('UNE SÉRIE QUI CHANGE D’ÉTAT NE PROUVE RIEN — il faut `busy` du début à la fin', () => {
  assert.equal(
    verdictDeVigie([vuAvec(0, 9, 'busy'), vuAvec(20000, 9, 'idle'), vuAvec(40000, 9, 'busy')]),
    null,
  );
});

// ═════════════════ 6. LA SONDE COUPÉE — « je n'ai pas pu voir » ≠ « aucun agent figé »

test('🔴 SONDE COUPÉE : LE RÉSULTAT DIFFÈRE DE « AUCUN AGENT FIGÉ »', () => {
  // ⚠️ LE CRITÈRE QUI GARDE CE LOT, ET C'EST LE DÉFAUT QU'ON CORRIGE, UN CRAN PLUS HAUT.
  // Un essai qui couvre « quand il n'y a rien » passe PARFAITEMENT pendant que la mesure est
  // aveugle : les deux rendent `null`. La seule façon de distinguer les deux, c'est que la
  // sonde muette rende autre chose que le silence.
  const muet = verdictDeVigie([
    vuMuet(0, 500, 'source-des-sessions-introuvable (ENOENT)'),
    vuMuet(20000, 500, 'source-des-sessions-introuvable (ENOENT)'),
    vuMuet(40000, 500, 'source-des-sessions-introuvable (ENOENT)'),
  ]);
  const repos = verdictDeVigie([vuAvec(0, 500, 'idle'), vuAvec(20000, 500, 'idle'), vuAvec(40000, 500, 'idle')]);

  assert.equal(repos, null, 'quand on a regardé et qu’il n’y avait rien : silence');
  assert.notEqual(muet, null, 'quand on n’a PAS PU regarder : surtout pas le même silence');
  assert.equal(muet.forme, 'activite-non-mesurable');
  assert.match(muet.quoi, /pas.*(?:pu|lue?)|PAS un constat/i, 'le verdict dit que ce n’est pas un constat');
  assert.match(muet.motifs.join(' '), /source-des-sessions-introuvable/, 'et il NOMME la cause du silence');
});

test('UNE SEULE LECTURE MUETTE AU MILIEU SUFFIT À CASSER LA SÉRIE — comme une revision illisible', () => {
  // Deux `busy` et un trou ne font pas trois `busy`. C'est la règle de la ligne 112, appliquée
  // à l'autre témoin.
  const v = verdictDeVigie([vuAvec(0, 500, 'busy'), vuMuet(20000, 500, 'aucun-fichier-ne-porte-cet-identifiant'), vuAvec(40000, 500, 'busy')]);
  assert.equal(v?.forme, 'activite-non-mesurable', 'ni figé, ni silence — non mesurable');
});

test('UNE RONDE QUI N’A PAS SONDÉ DU TOUT LE DIT — l’absence de témoin porte son propre mot', () => {
  // ⚠️ Une lecture sans champ `activite` n'est pas une lecture où l'agent était au repos : c'est
  // une lecture où personne n'a demandé. Sans ce mot, un appelant qui oublie la sonde rendrait
  // la vigie muette exactement comme avant le correctif — en silence, et pour toujours.
  const v = verdictDeVigie([vu(0, 'idle', 500), vu(20000, 'idle', 500), vu(40000, 'idle', 500)]);
  assert.equal(v?.forme, 'activite-non-mesurable');
  assert.match(v.motifs.join(' '), /sond/i);
});

test('UN STATUT DE SESSION INCONNU NE SE RANGE PAS AU REPOS — c’est un état NON LU', () => {
  // ⚠️ La ligne où le défaut d'origine se réinstallerait : « je ne reconnais pas cet état, donc
  // il ne travaille pas » est exactement le raisonnement de `--until working`.
  const v = verdictDeVigie([
    vu(0, 'idle', 500, { activite: { statut: 'compacting', motif: 'etat-de-session-non-reconnu (« compacting »)' } }),
    vu(20000, 'idle', 500, { activite: { statut: 'compacting', motif: 'etat-de-session-non-reconnu (« compacting »)' } }),
    vu(40000, 'idle', 500, { activite: { statut: 'compacting', motif: 'etat-de-session-non-reconnu (« compacting »)' } }),
  ]);
  assert.equal(v?.forme, 'activite-non-mesurable');
});

// ═════════════════ 7. CE QUE LE CORRECTIF NE DOIT PAS AVOIR CASSÉ

test('LA FORME PROUVÉE PASSE AVANT — un agent disparu reste `agent-introuvable`, sonde ou pas', () => {
  // ⚠️ Un agent qui a quitté la détection n'a plus d'identifiant de session à interroger : sa
  // sonde est muette PAR CONSTRUCTION. Si `activite-non-mesurable` passait devant, le correctif
  // détruirait la seule moitié qui marchait — en la remplaçant par un mot qui dit moins.
  const v = verdictDeVigie([
    vuAvec(0, 26, 'busy'),
    vu(20000, null, 26, { introuvable: true, activite: { statut: null, motif: 'sans-identifiant-de-session' } }),
    vu(40000, null, 26, { introuvable: true, activite: { statut: null, motif: 'sans-identifiant-de-session' } }),
  ]);
  assert.equal(v?.forme, 'agent-introuvable');
});

test('LA CAPTURE PORTE AUSSI LES STATUTS DE SESSION — sans eux la série ne se relit pas', () => {
  // Le spécimen a été perdu deux fois. La capture doit rendre ce sur quoi le verdict s'est
  // décidé, pas seulement ce qu'il a décidé — sinon la prochaine occurrence réelle repart de
  // zéro comme les deux précédentes.
  const v = verdictDeVigie(CALCULE_IMMOBILE);
  assert.deepEqual(v.capture.activites, ['busy', 'busy', 'busy']);
});

test('LE VERDICT NE PROPOSE TOUJOURS AUCUN GESTE — ni sur le figé, ni sur le non-mesurable', () => {
  for (const v of [verdictDeVigie(CALCULE_IMMOBILE), verdictDeVigie([vuMuet(0, 1, 'x'), vuMuet(20000, 1, 'x'), vuMuet(40000, 1, 'x')])]) {
    assert.ok(!('touches' in v) && !('debloquer' in v) && !('geste' in v));
  }
});

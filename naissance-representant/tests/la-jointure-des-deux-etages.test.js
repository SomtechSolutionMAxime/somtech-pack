// la-jointure-des-deux-etages.test.js — L'ARÊTE ENTRE LE PRODUCTEUR ET LE CONSOMMATEUR.
// (D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 POURQUOI CE BANC EXISTE, ET POURQUOI IL N'APPARTIENT À AUCUN DES DEUX MODULES
//
// `session_herdr` est écrit par UN module (`declaration.js`, appelé par `bin/naitre.js`) et lu
// par un AUTRE (`garde-des-naissances.js`). Chacun des deux avait son banc, chacun des deux
// passait — et les deux ne mettaient pas la même chose dedans :
//
//   • le producteur inscrivait le NOM de la session (« somtech ») ;
//   • le consommateur comparait ce champ au `herdr_socket` du pane, un CHEMIN
//     (« /Users/…/.config/herdr/sessions/somtech/herdr.sock »).
//
// Conséquence mesurée : la clé d'appariement « pane-dans-sa-session » n'a JAMAIS pu mordre sur
// une déclaration écrite par le vrai geste. La garde ne tenait que par sa clé de repli, le nom
// — et le texte qu'elle imprimait annonçait pourtant DEUX clés.
//
// ⚠️ POURQUOI 661 ESSAIS VERTS NE L'AVAIENT PAS VU : **tous les bancs fabriquaient la
// déclaration à la forme du CONSOMMATEUR** (`session_herdr: '/bac/s1.sock'`), jamais à celle du
// producteur. Et le seul essai qui regardait ce que `inscrireLaDeclaration` écrit vraiment dans
// ce champ assertait `typeof d.session_herdr === 'string'` — incapable de distinguer un nom
// d'un chemin. C'est le cumul de « le banc fabrique son propre appelant » et de « la jointure
// n'est gardée par personne parce qu'elle n'appartient à personne ».
//
// ⚠️ CE BANC NE FABRIQUE DONC AUCUNE VALEUR À LA MAIN pour ce champ. Il part du seul objet que
// le monde donne — le `herdr_socket` que `herdr pane list` rend — le fait passer par la chaîne
// RÉELLE du producteur, inscrit pour de bon, relit ce qui a été inscrit, et donne ce fait-là au
// consommateur avec le pane correspondant. Si les deux étages divergent à nouveau, il rougit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inscrireLaDeclaration, lireLesDeclarations } from '../src/declaration.js';
import { identiteDeSession } from '../src/declaration.js';
import { nomDeSession } from '../src/session.js';
import { normaliserLeParc, jugerLeParc, VERDICTS, SOURCES } from '../src/garde-des-naissances.js';

/**
 * TOUTES LES SESSIONS DE CE BANC NAISSENT APRÈS LA FRONTIÈRE.
 *
 * ⚠️ CE FICHIER N'ÉPROUVE PAS LA BORNE DE POPULATION — il éprouve la JOINTURE entre ce que le
 * producteur inscrit dans `session_herdr` et ce que le consommateur lit sur un pane. Les
 * agents doivent donc TOUS être dans la population, sans quoi la jointure ne serait jamais
 * atteinte et ce banc rendrait vert sans rien apparier. La borne, elle, est gardée ailleurs
 * (`une-reprise-nait-aujourdhui`, `la-garde-des-naissances-ne-se-desarme-pas`).
 *
 * ⚠️ `instants` EST CANARD, PAS UNE `Map` : « quelle que soit la session, elle est née le
 * 2026-08-25 à 17h30 UTC ». Une vraie carte obligerait ce fichier à répéter l'identifiant de
 * chaque pane à côté de chaque pane — du bruit qui n'éprouve rien, et une occasion de plus de
 * les désaccorder.
 */
const NES_APRES = { mesure: 'lue', illisibles: 0, instants: { get: () => Date.parse('2026-08-25T17:30:00.000Z') } };

const ICI = dirname(fileURLToPath(import.meta.url));
const PRODUCTEUR = resolve(ICI, '..', 'bin', 'naitre.js');

/** Le socket d'une session, dans la forme EXACTE où herdr le dépose — mesuré le 2026-08-25. */
const socketDe = (nom) => `/Users/qui-que-ce-soit/.config/herdr/sessions/${nom}/herdr.sock`;

/** Un worktree né APRÈS la mise en service — sans quoi l'agent serait hors portée. */
const ESPACE = '/bac/worktrees/un-depot/20260825-101721';
const PANE = 'w97:p2';

function bac() {
  return mkdtempSync(join(tmpdir(), 'jointure-'));
}

/**
 * LE PRODUCTEUR, RÉDUIT À SON SEUL POINT DE SUBSTITUTION.
 *
 * `bin/naitre.js` fait naître un agent — on ne peut pas le lancer ici. Mais le champ litigieux
 * ne dépend que de DEUX choses : ce que `sessionVisee` tire du socket (`nom`), et ce que
 * `bin/naitre.js` en passe à `inscrireLaDeclaration`. La première est `nomDeSession`, appelée
 * ici pour de vrai ; la seconde est ÉPINGLÉE par un essai de ce fichier, sur la source.
 */
function leProducteurInscrit(racine, socket) {
  return inscrireLaDeclaration({
    nom: 't-20260825-0047',
    role: 'chef-equipe',
    mandat: 'T-20260825-0047',
    coordonnateur: 'e-20260825-0002',
    espace: ESPACE,
    pane: PANE,
    // 🔴 LE POINT DE LA JOINTURE. On ne pose PAS une valeur : on prend celle que la chaîne du
    // producteur tire du socket que herdr donne.
    session: nomDeSession(socket),
    racine,
  });
}

/** Le consommateur, nourri du MÊME socket — celui que `herdr pane list` rend sur ce pane. */
function leConsommateurJuge(registre, socket, { nomRendu = 't-20260825-0047' } = {}) {
  const pane = {
    pane_id: PANE,
    agent_session: { agent: 'claude', value: 'peu-importe' },
    foreground_cwd: ESPACE,
    herdr_socket: socket,
  };
  return jugerLeParc({
    agents: normaliserLeParc({ naissances: NES_APRES,
      panes: [pane],
      agentsHerdr: [{ pane_id: PANE, herdr_socket: socket, name: nomRendu }],
    }),
    registre,
    portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ① LA JOINTURE ELLE-MÊME — la valeur RÉELLEMENT produite doit apparier
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 LA JOINTURE : ce que le producteur ÉCRIT dans `session_herdr` apparie le pane que le consommateur LIT', () => {
  const racine = bac();
  try {
    const socket = socketDe('somtech');
    leProducteurInscrit(racine, socket);

    // On relit du DISQUE : ce qui est jugé est ce qui a été inscrit, pas ce qu'on croit avoir passé.
    const registre = lireLesDeclarations({ racine });
    assert.equal(registre.declarations.length, 1);

    // ⚠️ LE NOM EST NEUTRALISÉ, ET C'EST TOUT L'INTÉRÊT. Tant que le repli par le nom peut
    // mordre, l'appariement par pane-dans-sa-session peut être MORT sans que rien ne rougisse
    // — c'est exactement ce qui s'est passé. On lui retire donc son filet.
    const v = leConsommateurJuge(registre, socket, { nomRendu: 'un-nom-qui-ne-figure-dans-aucune-declaration' });

    assert.equal(v.comptes.prises, 0, `l’agent DÉCLARÉ ne doit pas être une prise — texte :\n${v.texte}`);
    assert.equal(v.comptes.identifies, 1);
    assert.equal(
      v.comptes.parSource[SOURCES.DECLARATION],
      1,
      'et c’est bien la DÉCLARATION qui l’identifie, appariée par son pane dans sa session'
    );
    assert.equal(v.verdict, VERDICTS.RIEN_A_SIGNALER);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 LA JOINTURE TIENT SUR TOUTES LES SESSIONS DU POSTE — pas seulement sur celle du banc', () => {
  // ⚠️ Une jointure qui ne marcherait que sur un nom choisi serait une coïncidence. Les cinq
  // sessions qui répondent sur ce poste le 2026-08-25.
  for (const nom of ['somtech', 'cg', 'maxime', 'somtect', 'progex']) {
    const racine = bac();
    try {
      const socket = socketDe(nom);
      leProducteurInscrit(racine, socket);
      const v = leConsommateurJuge(lireLesDeclarations({ racine }), socket, { nomRendu: 'sans-rapport' });
      assert.equal(v.comptes.prises, 0, `session « ${nom} » : l’appariement a raté\n${v.texte}`);
      assert.equal(v.comptes.parSource[SOURCES.DECLARATION], 1, `session « ${nom} »`);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ② LE CAS QUI CASSAIT — `agent list` ne rend pas le nom
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 UN AGENT DÉCLARÉ DONT `agent list` NE REND PAS LE NOM N’EST PAS UNE PRISE — il est apparié par son pane', () => {
  // Mesuré : `agent list` a rendu 83 panes sur 227 un jour. Un agent parfaitement régulier dont
  // le nom n'est pas rendu ne doit pas devenir « né hors dispositif » par panne de lecture.
  const racine = bac();
  try {
    const socket = socketDe('somtech');
    leProducteurInscrit(racine, socket);
    const v = leConsommateurJuge(lireLesDeclarations({ racine }), socket, { nomRendu: null });

    assert.equal(v.comptes.prises, 0, `faux refus — texte :\n${v.texte}`);
    assert.equal(v.comptes.fauxRefus, 0, 'et pas non plus un faux refus « signalé mais compté »');
    assert.equal(v.comptes.identifies, 1);
    assert.equal(v.comptes.parSource[SOURCES.DECLARATION], 1);
    assert.equal(v.sortie, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ③ LA FORME DU CHAMP — un nom, jamais un chemin
// ═══════════════════════════════════════════════════════════════════════════════════════

test('`session_herdr` porte le NOM de la session, pas le chemin de son socket', () => {
  const racine = bac();
  try {
    leProducteurInscrit(racine, socketDe('somtech'));
    const fichier = readdirSync(racine).find((f) => f.endsWith('.json'));
    const d = JSON.parse(readFileSync(join(racine, fichier), 'utf8'));

    // ⚠️ `typeof === 'string'` NE DISTINGUE PAS UN NOM D'UN CHEMIN — c'est très exactement
    // l'assertion qui a laissé passer ce défaut (`naitre-bin.test.js`). On mesure la FORME.
    assert.equal(d.session_herdr, 'somtech');
    assert.ok(!d.session_herdr.includes('/'), 'un chemin de socket dans un fait durable est lié à un $HOME et à une version de herdr');
    assert.ok(!d.session_herdr.endsWith('.sock'));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ④ L'ÉPINGLE DU PRODUCTEUR — le seul maillon que ce banc ne peut pas exécuter
// ═══════════════════════════════════════════════════════════════════════════════════════

test('ÉPINGLE : `bin/naitre.js` inscrit bien le NOM de la session visée, pas son socket', () => {
  // Ce banc joue la chaîne du producteur à partir de `nomDeSession`. Le maillon qu'il ne peut
  // pas exécuter sans faire naître un agent est la LIGNE de `bin/naitre.js` qui choisit lequel
  // des deux champs de `sessionVisee` part dans la déclaration. On l'épingle sur la source :
  // le jour où quelqu'un y met `session.socket`, ce banc rougit AVANT la jointure.
  const source = readFileSync(PRODUCTEUR, 'utf8');
  assert.match(source, /session:\s*session\.nom\s*,/, '`inscrireLaDeclaration` doit recevoir `session.nom`');
  assert.ok(
    !/session:\s*session\.socket/.test(source),
    'le socket est une ADRESSE d’exécution ; la déclaration est un fait durable — elle porte le nom'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ④bis — LA FONCTION QUI PORTE LA JOINTURE, ÉPROUVÉE SUR SES DEUX CONTRATS
// ═══════════════════════════════════════════════════════════════════════════════════════

test('`identiteDeSession` est IDEMPOTENTE sur un nom et n’invente rien sur un chemin hors forme', () => {
  // ⚠️ C'EST CE QUI LA REND POSABLE DES DEUX CÔTÉS DE LA JOINTURE. Si elle rendait `null` sur un
  // nom, le côté producteur deviendrait muet ; si elle rendait le chemin brut sur une forme
  // inconnue, deux sockets posés à la main s'apparieraient comme une même session.
  assert.equal(identiteDeSession('somtech'), 'somtech', 'appliquée à un nom, elle le rend inchangé');
  assert.equal(identiteDeSession('  cg  '), 'cg');
  assert.equal(identiteDeSession(socketDe('somtech')), 'somtech', 'appliquée à un socket, elle en tire le nom');
  assert.equal(identiteDeSession('/tmp/pose/a/la/main.sock'), null, 'un chemin hors forme ne porte AUCUN nom');
  // ⚠️ LE SOCKET EST LE FILS DIRECT DE `sessions/<nom>/`, PAS UN DESCENDANT QUELCONQUE. Une
  // mutation a SURVÉCU ici avant cet essai : en perdant son ancre de fin, la lecture acceptait
  // `…/sessions/<nom>/…/…/x.sock` et en tirait `<nom>` — c'est-à-dire qu'elle INVENTAIT une
  // session à partir d'un chemin qui n'en désigne aucune.
  assert.equal(identiteDeSession('/x/sessions/somtech/plus/loin/herdr.sock'), null, 'un descendant n’est pas le socket de la session');
  assert.equal(identiteDeSession('/x/sessions/somtech/'), null, 'et un répertoire n’est pas un socket');
  for (const rien of [null, undefined, '', '   ']) assert.equal(identiteDeSession(rien), null);
});

test('`nomDeSession` prend un SOCKET — une chaîne sans séparateur n’est pas un nom de session à ses yeux', () => {
  // ⚠️ LE SEUL ÉCART DE CONTRAT ENTRE LES DEUX, ET IL EST DÉLIBÉRÉ — une mutation y a SURVÉCU
  // avant que cet essai n'existe. `HERDR_SOCKET_PATH` est une variable d'environnement :
  // n'importe qui peut y poser `somtech`, qui est un nom de FICHIER relatif, pas une session.
  // `sessionVisee` en tirerait un « nom de session » que rien n'a jamais mesuré — et
  // l'inscrirait dans une déclaration, qui est un fait durable.
  assert.equal(nomDeSession('somtech'), null, 'un jeton nu n’est pas un socket');
  assert.equal(nomDeSession(socketDe('somtech')), 'somtech');
  assert.equal(nomDeSession('/un/chemin/sans/forme'), null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑤ LA SYMÉTRIE — réparer le faux refus n'ouvre pas de faux négatif
// ═══════════════════════════════════════════════════════════════════════════════════════

test('UN AGENT NON DÉCLARÉ RESTE UNE PRISE — l’appariement réparé n’est pas devenu permissif', () => {
  const racine = bac();
  try {
    // Une déclaration existe, mais pour un AUTRE pane dans une AUTRE session.
    inscrireLaDeclaration({
      nom: 'un-autre', role: 'chef-equipe', mandat: 'T-1', coordonnateur: 'c',
      espace: '/bac/worktrees/un-depot/20260825-090000', pane: 'w1:p1',
      session: nomDeSession(socketDe('cg')), racine,
    });
    const v = leConsommateurJuge(lireLesDeclarations({ racine }), socketDe('somtech'), { nomRendu: 'personne' });
    assert.equal(v.comptes.prises, 1, `un agent que rien ne déclare doit RESTER une prise\n${v.texte}`);
    assert.equal(v.verdict, VERDICTS.NES_HORS_DISPOSITIF);
    assert.equal(v.sortie, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('LE MÊME PANE DANS UNE AUTRE SESSION N’EST PAS APPARIÉ — la session fait partie de la clé', () => {
  const racine = bac();
  try {
    // La déclaration porte `w97:p2` dans « somtech ». L'agent porte `w97:p2` dans « cg ».
    // Ce poste porte 15 sessions et les identifiants de pane s'y répètent.
    leProducteurInscrit(racine, socketDe('somtech'));
    const v = leConsommateurJuge(lireLesDeclarations({ racine }), socketDe('cg'), { nomRendu: 'homonyme-sans-declaration' });
    assert.equal(v.comptes.prises, 1, `un homonyme d’une AUTRE session ne doit pas hériter de la déclaration\n${v.texte}`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('UNE SESSION QU’ON N’A PAS SU NOMMER N’APPARIE RIEN PAR LE PANE — « inconnue » n’est pas « la même »', () => {
  const racine = bac();
  try {
    // Un socket hors de `…/sessions/<nom>/` : `nomDeSession` rend `null` — DÉLIBÉRÉMENT, il
    // n'invente pas de nom. Deux `null` qui se comparent égaux apparieraient sur le seul pane,
    // c'est-à-dire le défaut que la clé existe pour fermer.
    const horsForme = '/tmp/un/socket/pose/a/la/main.sock';
    inscrireLaDeclaration({
      nom: 'sans-session', role: 'chef-equipe', mandat: 'T-2', coordonnateur: 'c',
      espace: '/ailleurs', pane: PANE, session: nomDeSession(horsForme), racine,
    });
    const registre = lireLesDeclarations({ racine });
    assert.equal(registre.declarations[0].session_herdr, null, 'le producteur n’invente aucun nom');

    const v = leConsommateurJuge(registre, horsForme, { nomRendu: 'pas-sans-session' });
    assert.equal(v.comptes.prises, 1, `deux sessions inconnues ne sont pas la même session\n${v.texte}`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑥ LA DÉCLARATION DÉJÀ ÉCRITE SUR LE POSTE — un format antérieur ne fait pas un faux refus
// ═══════════════════════════════════════════════════════════════════════════════════════

test('UNE DÉCLARATION DÉJÀ INSCRITE (format du 2026-08-25) reste appariée — on ne réécrit pas les faits', () => {
  // ⚠️ Copie EXACTE du fait inscrit sur le poste le 2026-08-25 à 14:17:25Z — la preuve de
  // recette d'un critère d'epic. Elle ne se modifie pas et ne se supprime pas : le code doit
  // la traiter correctement telle qu'elle est.
  const dejaEcrite = {
    version: 1,
    nom: 't-20260825-0047',
    role: 'chef-equipe',
    mandat: 'T-20260825-0047',
    coordonnateur: 'e-20260825-0002',
    espace: '/Users/maximeleboeuf/worktrees/somtech-pack/20260825-101721',
    pane: 'w97:p2',
    session_herdr: 'somtech',
    ne_le: '2026-08-25T14:17:25.663Z',
    pose_par: 'pack agent naitre',
  };
  const socket = '/Users/maximeleboeuf/.config/herdr/sessions/somtech/herdr.sock';
  const v = jugerLeParc({
    agents: normaliserLeParc({ naissances: NES_APRES,
      panes: [{ pane_id: 'w97:p2', agent_session: { agent: 'claude', value: 'sess-du-banc' }, foreground_cwd: dejaEcrite.espace, herdr_socket: socket }],
      agentsHerdr: [{ pane_id: 'w97:p2', herdr_socket: socket, name: null }],
    }),
    registre: { declarations: [dejaEcrite], illisibles: [] },
    portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
  });
  assert.equal(v.comptes.prises, 0, `la déclaration déjà écrite doit apparier telle quelle\n${v.texte}`);
  assert.equal(v.comptes.parSource[SOURCES.DECLARATION], 1);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑦ LE TEXTE DE LA MÉTHODE DIT VRAI — les deux clés annoncées mordent toutes les deux
// ═══════════════════════════════════════════════════════════════════════════════════════

test('LA MÉTHODE ANNONCE DEUX CLÉS — et chacune apparie SEULE, sans l’autre', () => {
  const racine = bac();
  try {
    const socket = socketDe('somtech');
    leProducteurInscrit(racine, socket);
    const registre = lireLesDeclarations({ racine });

    // ① Le pane SEUL — le nom rendu ne figure dans aucune déclaration.
    const parLePane = leConsommateurJuge(registre, socket, { nomRendu: 'aucune-declaration-ne-porte-ce-nom' });
    assert.equal(parLePane.comptes.parSource[SOURCES.DECLARATION], 1, 'la clé « pane-dans-sa-session » doit mordre SEULE');

    // ② Le nom SEUL — le pane a bougé, et la session avec.
    const paneQuiABouge = {
      pane_id: 'w12:p9', agent_session: { agent: 'claude', value: 'sess-du-banc' }, foreground_cwd: ESPACE,
      herdr_socket: socketDe('cg'),
    };
    const parLeNom = jugerLeParc({
      agents: normaliserLeParc({ naissances: NES_APRES,
        panes: [paneQuiABouge],
        agentsHerdr: [{ pane_id: 'w12:p9', herdr_socket: socketDe('cg'), name: 't-20260825-0047' }],
      }),
      registre,
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });
    assert.equal(parLeNom.comptes.parSource[SOURCES.DECLARATION], 1, 'la clé de repli « par nom » doit mordre SEULE');

    // ③ Et le texte doit annoncer exactement ces deux-là.
    assert.match(parLePane.methode.prises, /pane-dans-sa-session/);
    assert.match(parLePane.methode.prises, /par nom/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑧ 🔴 LE REPLI PAR LE NOM EST BORNÉ — il appariait N'IMPORTE QUELLE déclaration de ce nom
//
// La section ⓿ de `garde-des-naissances.js` retire au nom son statut de SOURCE, parce que « le
// nom d'un chef d'équipe est TOUJOURS conforme ». Le correctif a fermé « nom conforme ⇒
// identifié » et laissé ouvert « nom qui apparie une déclaration QUELCONQUE ⇒ identifié » —
// même population, même conséquence. Une moitié sur deux.
//
// Mesuré avant : une déclaration régulière (pane `w97:p2`, espace `…/20260825-101721`), puis un
// SECOND agent ouvert à la main, aucune déclaration, pane `w9:p9`, worktree NEUF
// `…/20260826-100000`, portant le même nom → `prises: 0`, `identifies: 1`, source « sa
// déclaration de naissance ». Vert, sortie 0.
//
// TROIS ENTRÉES QUE ÇA OUVRAIT :
//   • le successeur que le lot décrit lui-même (`declaration.js` : « un chef qui hérite
//     légitimement d'un epic dont l'agent est mort ») — même code de mandat, donc même nom ;
//   • `herdr agent rename <pane> <un-nom-déjà-déclaré>` — un désarmement en UNE commande ;
//   • et ça EMPIRE avec l'adoption : le jour où tout nom régulier est au registre, le repli
//     devient un laissez-passer général.
//
// ⚠️ POURQUOI L'ESPACE DE TRAVAIL, ET PAS LE PANE NI LA DATE. Le pane ne peut pas borner ce
// repli : le repli EXISTE parce que le pane a bougé. L'espace, lui, est le fait que la
// déclaration inscrit à la naissance ET que l'agent porte encore pendant qu'il travaille — le
// module le lisait déjà pour `fauxRefus`, sans jamais s'en servir pour les identifiés.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Un agent ouvert à la main : son pane, sa session, son espace — et le nom qu'on lui donne. */
const unAgent = ({ pane, session, espace, nom }) =>
  normaliserLeParc({ naissances: NES_APRES,
    panes: [{ pane_id: pane, agent_session: { agent: 'claude', value: 'sess-du-banc' }, foreground_cwd: espace, herdr_socket: session }],
    agentsHerdr: [{ pane_id: pane, herdr_socket: session, name: nom }],
  });

test('🔴 LE REPLI PAR LE NOM N’APPARIE PLUS UNE DÉCLARATION D’AILLEURS — autre espace, autre pane, même nom', () => {
  const racine = bac();
  try {
    leProducteurInscrit(racine, socketDe('somtech'));
    const registre = lireLesDeclarations({ racine });

    // Le second agent : ouvert à la main, AUCUNE déclaration, worktree NEUF, pane et session
    // qui ne sont pas ceux de la déclaration — et le même nom.
    const v = jugerLeParc({
      agents: unAgent({
        pane: 'w9:p9',
        session: socketDe('cg'),
        espace: '/bac/worktrees/un-depot/20260826-100000',
        nom: 't-20260825-0047',
      }),
      registre,
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });

    assert.equal(v.comptes.identifies, 0, `un nom n’est pas une naissance — texte :\n${v.texte}`);
    assert.equal(v.comptes.prises, 1, 'il doit être PRIS');
    assert.equal(v.verdict, VERDICTS.NES_HORS_DISPOSITIF);
    assert.equal(v.sortie, 1, 'et la sortie doit le dire');
    // ⚠️ ET LE FAUX REFUS RESTE À ZÉRO : son espace ne figure dans aucune déclaration. Un
    // chiffre qui monterait ici dirait que c'est la garde qui a raté, pas l'agent.
    assert.equal(v.comptes.fauxRefus, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 LE SUCCESSEUR — un chef qui hérite d’un epic porte le MÊME nom, et sa naissance n’est pas celle de son prédécesseur', () => {
  const racine = bac();
  try {
    leProducteurInscrit(racine, socketDe('somtech'));
    const registre = lireLesDeclarations({ racine });

    // Le cas que `declaration.js` décrit nommément : le prédécesseur est mort, le successeur
    // reprend l'epic, donc le code du mandat, donc le nom. Ouvert à la main, dans SON arbre.
    const v = jugerLeParc({
      agents: unAgent({
        pane: 'w4:p1',
        session: socketDe('somtech'),
        espace: '/bac/worktrees/un-depot/20260827-090000',
        nom: 't-20260825-0047',
      }),
      registre,
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });
    assert.equal(v.comptes.prises, 1, `le successeur n’est pas couvert par la naissance d’un autre :\n${v.texte}`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('LE REPLI SERT ENCORE — le pane a bougé, l’espace non : la déclaration apparie', () => {
  const racine = bac();
  try {
    leProducteurInscrit(racine, socketDe('somtech'));
    const registre = lireLesDeclarations({ racine });

    // ⚠️ LA MOITIÉ SANS LAQUELLE LE CORRECTIF EST UN FAUX REFUS. Le repli a été écrit pour ce
    // cas-ci : `agent list` a rendu le nom, le pane n'est plus celui de la naissance. Le borner
    // trop rouvrirait très exactement le défaut qu'il ferme — un agent DÉCLARÉ devenu prise.
    const v = jugerLeParc({
      agents: unAgent({ pane: 'w12:p9', session: socketDe('cg'), espace: ESPACE, nom: 't-20260825-0047' }),
      registre,
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });
    assert.equal(v.comptes.parSource[SOURCES.DECLARATION], 1, `le repli doit encore mordre :\n${v.texte}`);
    assert.equal(v.comptes.prises, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('… et il sert AUSSI quand l’agent a changé de répertoire DANS son espace de travail', () => {
  const racine = bac();
  try {
    leProducteurInscrit(racine, socketDe('somtech'));
    const registre = lireLesDeclarations({ racine });

    // `foreground_cwd` est le répertoire du shell, pas la racine de l'arbre : un chef d'équipe
    // qui descend dans un sous-dossier de son worktree travaille toujours dans SON espace.
    // Exiger l'égalité stricte ferait de lui une prise pour un `cd`.
    const v = jugerLeParc({
      agents: unAgent({
        pane: 'w12:p9',
        session: socketDe('cg'),
        espace: `${ESPACE}/naissance-representant/src`,
        nom: 't-20260825-0047',
      }),
      registre,
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });
    assert.equal(v.comptes.parSource[SOURCES.DECLARATION], 1, `un sous-dossier reste le même espace :\n${v.texte}`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 … mais un espace VOISIN dont le CHEMIN commence pareil n’est PAS le même espace', () => {
  const racine = bac();
  try {
    // ⚠️ LE FAUX POSITIF QU'UN `startsWith` NU LAISSERAIT PASSER, et il est réel : deux dépôts
    // dont l'un nomme l'autre en préfixe (`un-depot` / `un-depot-bis`). La déclaration porte le
    // premier ; l'agent travaille dans un worktree du second. Le chemin de l'un commence par
    // celui de l'autre sans être dedans. La frontière est le SÉPARATEUR, pas le préfixe.
    //
    // ⚠️ ET LE VOISIN EST DANS LA POPULATION — son dernier segment est un horodatage lisible,
    // postérieur à la frontière. Un banc dont le cas tombe en « hors portée » ne mesurerait pas
    // l'appariement, il mesurerait la borne : la première écriture de cet essai s'y est trompée.
    inscrireLaDeclaration({
      nom: 't-20260825-0047',
      role: 'chef-equipe',
      mandat: 'T-20260825-0047',
      coordonnateur: 'e-20260825-0002',
      espace: '/bac/worktrees/un-depot',
      pane: PANE,
      session: nomDeSession(socketDe('somtech')),
      racine,
    });
    const registre = lireLesDeclarations({ racine });

    const v = jugerLeParc({
      agents: unAgent({
        pane: 'w12:p9',
        session: socketDe('cg'),
        espace: '/bac/worktrees/un-depot-bis/20260825-101721',
        nom: 't-20260825-0047',
      }),
      registre,
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });
    assert.equal(v.comptes.horsPortee, 0, `le voisin doit être JUGÉ, pas écarté :\n${v.texte}`);
    assert.equal(v.comptes.prises, 1, `un voisin n’est pas un sous-dossier :\n${v.texte}`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 UNE DÉCLARATION QUI DIT TRAVAILLER À LA RACINE N’APPARIE PERSONNE — le laissez-passer en un champ', () => {
  const racine = bac();
  try {
    // ⚠️ LA SURVIVANTE DE LA CAMPAGNE DE MUTATION. Retirer `if (!d) return false;` de
    // `memeEspaceDeTravail` ne faisait rougir AUCUN essai : la branche existait, aucun cas ne
    // l'empruntait. Or elle est atteignable — rien n'interdit à une déclaration de porter
    // `espace: '/'`, que le nettoyage des barres finales réduit à la chaîne vide. Sans le
    // garde-fou, `''.startsWith` n'est jamais consulté et `a.startsWith('/')` est VRAI pour
    // tout chemin absolu : UNE déclaration suffirait alors à identifier tout le parc, et le
    // repli redeviendrait le laissez-passer général qu'on vient de fermer — par un champ.
    inscrireLaDeclaration({
      nom: 't-20260825-0047',
      role: 'chef-equipe',
      mandat: 'T-20260825-0047',
      coordonnateur: 'e-20260825-0002',
      espace: '/',
      pane: PANE,
      session: nomDeSession(socketDe('somtech')),
      racine,
    });
    const registre = lireLesDeclarations({ racine });

    const v = jugerLeParc({
      agents: unAgent({ pane: 'w12:p9', session: socketDe('cg'), espace: ESPACE, nom: 't-20260825-0047' }),
      registre,
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });
    assert.equal(v.comptes.identifies, 0, `« / » n’est l’espace de travail de personne :\n${v.texte}`);
    assert.equal(v.comptes.prises, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('LA MÉTHODE IMPRIMÉE dit la borne — un texte qui annoncerait « à défaut par nom » tout court décrirait la garde retirée', () => {
  // ⚠️ Le rendu de cette garde est ce qu'un humain lit pour décider si elle est cassée. Il a
  // déjà induit en erreur une fois (« 8 sur 8 identifiés par leur nom ») ; un texte qui
  // survivrait à un changement de règle ferait exactement pareil.
  const v = jugerLeParc({ agents: [], registre: { declarations: [], illisibles: [] } });
  assert.match(v.methode.prises, /ESPACE DE TRAVAIL/, 'la méthode doit dire que le repli est BORNÉ');
  assert.match(v.methode.prises, /pane-dans-sa-session/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑦ LA CLÉ PRIMAIRE — « pane-dans-sa-session » N'EST PAS UNE IDENTITÉ DURABLE
//
// 🔴 LE TROU QUE LES CINQ ESSAIS CI-DESSUS NE POUVAIENT PAS VOIR. Ils éprouvent tous la borne
// d'espace sur le chemin de REPLI : chacun pose un pane DIFFÉRENT de celui de la déclaration
// (`w12:p9`, `w9:p9`, `w4:p1`), donc chacun contourne la clé primaire avant de l'atteindre. La
// clé primaire, elle, appariait sur `pane === pane && session === session` et RIEN D'AUTRE —
// ni l'espace, ni la date, ni le rôle, ni le mandat. Le correctif de la borne n'avait donc
// fermé QU'UNE MOITIÉ, pour la cinquième fois dans ce lot.
//
// ⚠️ ET LE CAS NE DEMANDE AUCUN RECYCLAGE D'IDENTIFIANT — il suffit de REPRENDRE LE PANE, ce à
// quoi un terminal sert. Un chef d'équipe naît par le geste ; son travail fini, on relance un
// `claude` À LA MAIN dans le même pane, sur un worktree NEUF. Cet agent n'a aucune déclaration,
// aucun lieu de rôle, il est dans la population — et la garde le rangeait en « identifié » par
// la déclaration de son PRÉDÉCESSEUR.
//
// ⚠️ `fauxRefus` NE POUVAIT PAS LE VOIR : il ne croise l'espace que sur les PRISES, jamais sur
// les identifiés. Le contre-contrôle est aveugle dans cette direction PAR CONSTRUCTION.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 LE PANE EST REPRIS — même pane, même session, worktree NEUF : la déclaration du prédécesseur ne le couvre pas', () => {
  const racine = bac();
  try {
    leProducteurInscrit(racine, socketDe('somtech'));
    const registre = lireLesDeclarations({ racine });

    // ⚠️ ANONYME, DÉLIBÉRÉMENT. Le repli par le nom est déjà borné ; le laisser jouer ici
    // mesurerait la borne du repli une sixième fois au lieu de la clé primaire. Sans nom, la
    // SEULE clé qui peut identifier cet agent est « pane-dans-sa-session ».
    const v = jugerLeParc({
      agents: unAgent({
        pane: PANE,
        session: socketDe('somtech'),
        espace: '/bac/worktrees/un-depot/20260826-140000',
        nom: null,
      }),
      registre,
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });

    assert.equal(v.comptes.identifies, 0, `reprendre un pane n’est pas naître :\n${v.texte}`);
    assert.equal(v.comptes.prises, 1, 'il doit être PRIS');
    assert.equal(v.verdict, VERDICTS.NES_HORS_DISPOSITIF);
    assert.equal(v.sortie, 1, 'et la sortie doit le dire');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 … et le même, NOMMÉ d’un nom quelconque, n’est pas davantage couvert', () => {
  const racine = bac();
  try {
    leProducteurInscrit(racine, socketDe('somtech'));
    const v = jugerLeParc({
      agents: unAgent({
        pane: PANE,
        session: socketDe('somtech'),
        espace: '/bac/worktrees/un-depot/20260826-140000',
        nom: 'un-nom-qui-ne-figure-dans-aucune-declaration',
      }),
      registre: lireLesDeclarations({ racine }),
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });
    assert.equal(v.comptes.prises, 1, `ni la clé primaire ni le repli ne doivent l’atteindre :\n${v.texte}`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('LA SYMÉTRIE DE LA CLÉ PRIMAIRE — l’agent DÉCLARÉ, à son pane, dans SON espace, reste identifié', () => {
  const racine = bac();
  try {
    leProducteurInscrit(racine, socketDe('somtech'));
    // ⚠️ LE NOM EST NEUTRALISÉ : seule la clé primaire peut le sauver. Un banc qui laisserait
    // le repli jouer ici passerait au vert même si la clé primaire était bornée à mort.
    const v = jugerLeParc({
      agents: unAgent({ pane: PANE, session: socketDe('somtech'), espace: ESPACE, nom: 'sans-rapport' }),
      registre: lireLesDeclarations({ racine }),
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });
    assert.equal(v.comptes.parSource[SOURCES.DECLARATION], 1, `la clé primaire doit encore mordre :\n${v.texte}`);
    assert.equal(v.comptes.prises, 0);
    assert.equal(v.sortie, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('🔴 LA SYMÉTRIE QUI INTERDIT L’ÉGALITÉ STRICTE — l’agent déclaré a fait `cd` DANS son worktree', () => {
  const racine = bac();
  try {
    leProducteurInscrit(racine, socketDe('somtech'));
    // ⚠️ LA MOITIÉ QU'UNE BORNE TROP DURE CASSERAIT. `foreground_cwd` est le répertoire du
    // SHELL : un chef d'équipe qui descend dans un dossier de son arbre travaille toujours dans
    // son espace. Borner la clé primaire par une ÉGALITÉ ferait de lui une prise pour un `cd` —
    // le faux refus symétrique de celui qu'on vient de fermer. Le nom est neutralisé pour que
    // ce soit bien la clé primaire, et elle seule, que cet essai mesure.
    const v = jugerLeParc({
      agents: unAgent({
        pane: PANE,
        session: socketDe('somtech'),
        espace: `${ESPACE}/naissance-representant/src`,
        nom: 'sans-rapport',
      }),
      registre: lireLesDeclarations({ racine }),
      portee: { sessionsInterrogees: 5, sessionsRefusees: [] },
    });
    assert.equal(v.comptes.parSource[SOURCES.DECLARATION], 1, `un sous-dossier reste le même espace :\n${v.texte}`);
    assert.equal(v.comptes.prises, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('LA MÉTHODE IMPRIMÉE dit que la clé PRIMAIRE est bornée elle aussi', () => {
  // ⚠️ Le texte a déjà décrit une garde qu'il n'avait pas — « à défaut par nom » tout court
  // pendant que le repli était non borné. Un texte qui annoncerait « pane-dans-sa-session »
  // tout court décrirait à nouveau une clé plus large que celle qui juge.
  const v = jugerLeParc({ agents: [], registre: { declarations: [], illisibles: [] } });

  // ⚠️ ON COUPE AVANT LE REPLI, ET C'EST TOUT L'ESSAI. Écrit d'abord en cherchant
  // `/pane-dans-sa-session[^.]*ESPACE DE TRAVAIL/` sur la phrase ENTIÈRE, il passait AVANT
  // le correctif : la borne que le motif trouvait était celle du REPLI, quelques mots plus
  // loin. Une assertion juste sur un chemin correct, qui ne mesurait pas la moitié visée —
  // le motif même que ce lot ferme. On isole donc la moitié qui décrit la clé primaire.
  const [cléPrimaire, repli] = v.methode.prises.split('ou à défaut');
  assert.ok(repli, 'la méthode doit toujours décrire les DEUX clés');
  assert.match(cléPrimaire, /pane-dans-sa-session/);
  assert.match(
    cléPrimaire,
    /ESPACE DE TRAVAIL/,
    'la borne d’espace doit être annoncée SUR la clé primaire, pas seulement sur le repli'
  );
});

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
    agents: normaliserLeParc({
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
    agents: normaliserLeParc({
      panes: [{ pane_id: 'w97:p2', agent_session: { agent: 'claude' }, foreground_cwd: dejaEcrite.espace, herdr_socket: socket }],
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
      pane_id: 'w12:p9', agent_session: { agent: 'claude' }, foreground_cwd: ESPACE,
      herdr_socket: socketDe('cg'),
    };
    const parLeNom = jugerLeParc({
      agents: normaliserLeParc({
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

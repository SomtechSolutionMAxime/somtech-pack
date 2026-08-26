// garde-des-naissances.test.js — la garde qui NOMME les agents nés hors dispositif.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE POINT DUR, ET IL EST DANS LE PREMIER CAS LIMITE
//
// Si la SEULE trace qu'un agent est « né par le dispositif » est sa déclaration, alors retirer
// la déclaration le rend invisible à la garde — et la garde ne rougit JAMAIS. Le premier
// critère d'acceptation serait décoratif : « retire la déclaration, la garde rougit » ne peut
// pas tenir si la population elle-même est lue dans les déclarations.
//
// La population est donc bornée AILLEURS : les agents vivants dont l'espace de travail porte un
// horodatage de naissance POSTÉRIEUR à la mise en service du dispositif. `claude-swt` inscrit
// cet horodatage dans le NOM du répertoire (`~/worktrees/<dépôt>/20260825-083616`) — c'est un
// fait qui survit au retrait de la déclaration, et qui ne se lit dans aucun registre.
//
// ⚠️ MESURÉ SUR LE PARC RÉEL LE 2026-08-25, et ça a changé la conception : **13 agents vivants
// sur 80 travaillent dans un worktree dont le nom n'est PAS un horodatage** (`t-0043`,
// `20260818-e3`, …), et **32 de plus ne sont dans aucun worktree**. Ces 45-là ne sont pas
// « nés avant » : ils ne sont pas DATABLES. Les ranger en silence dans le vert ferait de la
// borne un trou. La garde les compte, les nomme par leur raison, et rend ses comptes équilibrés.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MISE_EN_SERVICE,
  FrontiereContredite,
  ComptesQuiNeBalancentPas,
  horodatageDuChemin,
  instantDeLHorodatage,
  designationDe,
  normaliserLeParc,
  jugerLeParc,
  VERDICTS,
  SORTIES,
  SOURCES,
} from '../src/garde-des-naissances.js';

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE HARNAIS — tout ce qui parle au monde entre par paramètre (patron de `recensement.js`)
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * LE SOCKET D'UNE SESSION, DANS LA FORME EXACTE OÙ HERDR LE DÉPOSE — mesuré le 2026-08-25 sur
 * les 5 sessions du poste qui répondent.
 *
 * 🔴 CE HARNAIS FABRIQUAIT AUTREFOIS `'/bac/s1.sock'` DES DEUX CÔTÉS, et c'est ce qui a caché
 * le défaut de la jointure : la déclaration recevait la forme du CONSOMMATEUR (un chemin) alors
 * que le producteur y inscrit un NOM. Les deux côtés se comparaient donc égaux dans le banc et
 * jamais dans le monde. Depuis : le pane porte le CHEMIN (ce que `herdr pane list` rend), la
 * déclaration porte le NOM (ce que `bin/naitre.js` inscrit) — chacun sa forme réelle.
 */
const socketDe = (nom) => `/bac/.config/herdr/sessions/${nom}/herdr.sock`;
const SOCKET_S1 = socketDe('s1');

/** Un poste dont les worktrees vivent là — jamais le vrai `~/worktrees`. */
const WT = '/bac/worktrees/un-depot';

/** Après la mise en service : cet agent-là est DANS la population. */
const APRES = `${WT}/20260825-093000`;

/** Avant : il ne l'est pas, et ce n'est pas une exception — c'est la borne. */
const AVANT = `${WT}/20260724-204645`;

/** Un espace de travail qu'aucun nom ne date. Mesuré : 13 agents vivants sont dans ce cas. */
const NON_DATABLE = `${WT}/t-0043`;

/**
 * LA SESSION CLAUDE D'UN PANE, DANS LA FORME EXACTE OÙ HERDR LA REND — relevée le 2026-08-25.
 *
 * 🔴 CE HARNAIS ÉCRIVAIT `agent_session: 'ses-1'`, UNE CHAÎNE. herdr rend un OBJET, et c'est
 * `value` qui porte l'identifiant. Tant que le module ne lisait que la présence du champ, la
 * différence ne se voyait pas ; depuis qu'il DATE l'agent par sa session, un double plus pauvre
 * que le vrai rendrait tout le parc non datable — « un double non conforme fabrique des
 * défauts ». Une session PAR PANE, aussi : sans ça, on ne peut pas donner deux naissances
 * différentes à deux agents du même banc.
 */
const sessionDe = (pane) => ({ agent: 'claude', kind: 'id', source: 'herdr:claude', value: `sess-${pane}` });

/**
 * LES DEUX INSTANTS DE LA BORNE — en UTC, et c'est ce qui les rend PORTABLES.
 *
 * `MISE_EN_SERVICE` se lit en heure LOCALE (voir `instantDeLHorodatage`). Un instant d'essai
 * choisi à quelques heures de la frontière tomberait donc du bon côté chez l'auteur et du
 * mauvais en CI — le motif « un rendu qui dépend de la machine ». Ces deux-ci sont à un mois et
 * à treize heures de la frontière : aucun fuseau ne les fait changer de côté.
 */
const NE_APRES = Date.parse('2026-08-25T17:30:00.000Z');
const NE_AVANT = Date.parse('2026-07-24T20:46:45.000Z');

const agent = (sur = {}) => {
  const dossier = {
    pane_id: 'w1:p1',
    herdr_socket: SOCKET_S1,
    foreground_cwd: APRES,
    ...sur,
  };
  return { agent_session: sessionDe(dossier.pane_id), ...dossier };
};

/**
 * LES NAISSANCES QUE LE FIL AURAIT LUES — une carte session → instant.
 *
 * Par défaut chaque agent du banc naît APRÈS la frontière : c'est la population que cette garde
 * vise, donc le cas normal ici. `nes` en redate un par son pane ; `null` veut dire « celui-là,
 * on n'a pas su le dater », qui est un NON MESURÉ, jamais un « né avant ».
 */
function naissancesDe(panes, nes = {}) {
  const instants = new Map();
  for (const p of panes) {
    const id = p?.agent_session?.value;
    if (!id) continue;
    const quand = Object.prototype.hasOwnProperty.call(nes, p.pane_id) ? nes[p.pane_id] : NE_APRES;
    if (quand !== null) instants.set(id, quand);
  }
  return { mesure: 'lue', instants, illisibles: 0 };
}

const declaration = (sur = {}) => ({
  version: 1,
  nom: 'ristigouche',
  role: 'orchestrateur',
  mandat: 'T-20260825-0013',
  espace: APRES,
  pane: 'w1:p1',
  session_herdr: 's1',
  // 🔴 `ne_le` SE DÉRIVE DE LA NAISSANCE, IL NE SE CHOISIT PAS. Ce banc portait
  // « 2026-08-25T13:30:00.000Z » pendant que ses agents naissaient à 17:30Z — une déclaration
  // inscrite QUATRE HEURES AVANT l'agent qu'elle couvre. Ce monde-là ne se produit pas : le
  // geste de naissance vérifie par le fait, PUIS inscrit, donc `ne_le` suit la naissance de
  // quelques secondes (2,0 s mesurés sur la déclaration du poste). Un double non conforme ne
  // rate pas seulement un défaut : les gardes bâties dessus finissent par exiger le
  // comportement fautif — ici, qu'une déclaration identifie un agent né APRÈS elle.
  ne_le: new Date(NE_APRES + 2_000).toISOString(),
  pose_par: 'pack agent naitre',
  ...sur,
});

/** Le rôle du lieu, injecté : la garde ne touche JAMAIS le disque elle-même. */
const aucunLieu = () => null;
const lieuEtabli = () => 'orchestrateur';
const lieuIllisible = () => ({ refus: 'permission refusée sur CLAUDE.md' });

/** La portée de la mesure — combien de sessions ont répondu, combien ont refusé. */
const portee = (sur = {}) => ({ sessionsInterrogees: 1, sessionsRefusees: [], ...sur });

/**
 * Le registre des agents par défaut : il a VU chaque pane, et aucun ne porte de nom.
 *
 * ⚠️ TROUVÉ EN FAISANT ROUGIR CE BANC, et c'est le module qui avait raison. Un registre VIDE ne
 * veut pas dire « ces agents n'ont pas de nom » : il veut dire « je n'ai vu aucun de ces
 * panes », donc « non mesuré ». Mesuré sur le parc réel le 2026-08-25 : `agent list` a vu
 * 112 panes sur 112, dont 77 sans nom — c'est ce cas-là, et pas l'autre, qui est le trafic
 * normal. Un harnais qui les confond éprouve un monde qui n'existe pas.
 */
const registreQuiAVuSansNommer = (panes) =>
  panes.map((p) => ({ pane_id: p.pane_id, herdr_socket: p.herdr_socket, agent: true, name: null }));

function juger({
  panes = [agent()],
  agentsHerdr = registreQuiAVuSansNommer(panes),
  declarations = [],
  illisibles = [],
  roleDuLieu = aucunLieu,
  nes = {},
  naissances = naissancesDe(panes, nes),
  ...reste
} = {}) {
  return jugerLeParc({
    agents: normaliserLeParc({ panes, agentsHerdr, naissances }),
    registre: { declarations, illisibles },
    roleDuLieu,
    portee: portee(),
    ...reste,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1. LE CRITÈRE N°1 — la déclaration retirée fait ROUGIR, et la garde NOMME
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 LE CAS RÉEL DU CRITÈRE, ET IL A UN NOM CONFORME — mesuré sur le poste le 2026-08-25.
 *
 * Le critère de `T-20260825-0013` dit « un agent né PAR LE DISPOSITIF dont la déclaration a été
 * retirée ». Or **le dispositif ne fait naître que des agents au nom conforme** : le nom d'un
 * chef d'équipe EST le code de son mandat, imposé par le geste lui-même. La population que ce
 * critère vise en premier a donc TOUJOURS un nom conforme.
 *
 * Les bancs, eux, éprouvaient le retrait de déclaration sur des agents au nom NON conforme
 * (« Agent Infra-Ops ») ou anonymes. Le chemin existait, il passait, et il se lisait donc comme
 * couvert — c'est le motif « une assertion trop faible sur un chemin correct » : le banc SURVIT
 * à l'énumération des appelants, parce qu'il appelle avec une population que le réel n'a pas.
 *
 * Mesuré POUR DE VRAI le 2026-08-25 : un chef d'équipe `t-20260825-0047` né par le dispositif,
 * déclaration retirée du registre, garde relancée → `prises : 0`. Elle ne rougissait pas.
 * Elle ne le nommait pas. La branche « déclaration retirée » ne pouvait STRUCTURELLEMENT jamais
 * rougir pour la population qu'elle vise.
 */
test('🔴 LE CAS RÉEL — un chef d’équipe au nom CONFORME dont la déclaration est retirée fait ROUGIR et est NOMMÉ', () => {
  const ESPACE = `${WT}/20260825-101721`;
  const chef = agent({ pane_id: 'w97:p2', foreground_cwd: ESPACE });
  const vuNomme = [{ pane_id: 'w97:p2', herdr_socket: SOCKET_S1, agent: true, name: 't-20260825-0047' }];
  const saDeclaration = declaration({
    nom: 't-20260825-0047',
    role: 'chef-equipe',
    mandat: 'T-20260825-0047',
    pane: 'w97:p2',
    espace: ESPACE,
  });

  // ── LA MOITIÉ QUI PROUVE : avec sa déclaration, il ne rougit pas — et c'est ELLE qui l'a
  // identifié, pas son nom. Sans cette assertion, un module qui n'identifierait plus RIEN
  // passerait la moitié rouge du critère sans jamais rendre le service.
  const avec = juger({ panes: [chef], agentsHerdr: vuNomme, declarations: [saDeclaration] });
  assert.equal(avec.verdict, VERDICTS.RIEN_A_SIGNALER, 'déclaré, il ne doit pas rougir');
  assert.equal(avec.identifies[0].source, SOURCES.DECLARATION);

  // ── LE GESTE DU CRITÈRE : on retire la déclaration, RIEN D'AUTRE. Son nom reste conforme,
  // son espace reste le même, il est toujours vivant.
  const sans = juger({ panes: [chef], agentsHerdr: vuNomme, declarations: [] });
  assert.equal(sans.verdict, VERDICTS.NES_HORS_DISPOSITIF, 'un nom conforme n’est PAS une naissance');
  assert.equal(sans.sortie, SORTIES[VERDICTS.NES_HORS_DISPOSITIF]);
  assert.equal(sans.prises.length, 1);
  assert.equal(sans.prises[0].designation, 't-20260825-0047', 'un NOM, pas un compte');
  assert.match(sans.texte, /t-20260825-0047/, 'le nom doit franchir la SORTIE, pas rester dans la structure');
});

test('un agent né par le dispositif dont la déclaration a été RETIRÉE fait rougir la garde', () => {
  // D'abord la moitié qui prouve : avec sa déclaration, il ne rougit pas.
  const avec = juger({ declarations: [declaration()] });
  assert.equal(avec.verdict, VERDICTS.RIEN_A_SIGNALER, 'déclaré, il ne doit pas rougir');

  // Puis le geste du critère : on retire la déclaration, RIEN D'AUTRE.
  const sans = juger({ declarations: [] });
  assert.equal(sans.verdict, VERDICTS.NES_HORS_DISPOSITIF);
  assert.equal(sans.prises.length, 1);
});

test('elle NOMME l’agent — pas un compte, un nom', () => {
  // ⚠️ LE NOM PORTÉ ICI N'EST PAS CONFORME, et c'est le seul cas où un fautif a un nom à lui.
  // Un nom CONFORME est une source : son porteur est identifiable, donc il ne rougit pas.
  // « Agent Infra-Ops » existe pour de vrai sur ce poste (`~/worktrees/'Agent Infra-Ops'`) —
  // un espace dans le nom, donc hors de la liste blanche du dépôt.
  const { prises, texte } = juger({
    panes: [agent()],
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: SOCKET_S1, agent: true, name: 'Agent Infra-Ops' }],
    declarations: [],
  });
  assert.equal(prises.length, 1);
  assert.equal(prises[0].designation, 'Agent Infra-Ops');
  assert.match(texte, /Agent Infra-Ops/, 'le nom doit franchir la SORTIE, pas seulement la structure');

  // ── LA MOITIÉ QUI PROUVE — elle empêche un module qui ne rendrait QUE des prises de passer.
  //
  // ⚠️ ELLE S'APPUYAIT SUR LE NOM CONFORME, ET C'ÉTAIT LE DÉFAUT LUI-MÊME (voir la section ⓿ du
  // module). Sa FONCTION est intacte — prouver que la garde sait encore ne pas rougir — mais
  // elle s'appuie désormais sur une identification qui en est une : le même agent, DÉCLARÉ.
  const declare = juger({
    panes: [agent()],
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: SOCKET_S1, agent: true, name: 'ristigouche' }],
    declarations: [declaration({ nom: 'ristigouche' })],
  });
  assert.equal(declare.prises.length, 0);
  assert.equal(declare.identifies[0].source, SOURCES.DECLARATION);
});

test('un agent ANONYME est nommé par son adresse — un anonyme reste ADRESSABLE', () => {
  // ⚠️ 77 des 112 agents vivants du poste sont anonymes (mesuré le 2026-08-25). Une garde qui
  // ne saurait nommer qu'un agent nommé serait muette sur les deux tiers du parc — et sur
  // exactement ceux qui manquent le plus au dispositif.
  const { prises, texte } = juger({
    panes: [agent()],
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: SOCKET_S1, agent: true, name: null }],
    declarations: [],
  });
  assert.match(prises[0].designation, /w1:p1/);
  assert.match(prises[0].designation, /20260825-093000/, 'son espace de travail le situe');
  assert.match(texte, /w1:p1/);
});

test('CHAQUE fautif est nommé — la sortie ne se replie jamais en un compte', () => {
  const trois = [
    agent({ pane_id: 'w1:p1' }),
    agent({ pane_id: 'w1:p2' }),
    agent({ pane_id: 'w1:p3' }),
  ];
  const { prises, texte } = juger({ panes: trois, declarations: [] });
  assert.equal(prises.length, 3);
  for (const p of ['w1:p1', 'w1:p2', 'w1:p3']) {
    assert.match(texte, new RegExp(p.replace(':', ':')), `« ${p} » manque à la sortie`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2. LES TROIS SOURCES — et une seule suffit
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la déclaration identifie par le PANE — un anonyme déclaré ne rougit pas', () => {
  const r = juger({ declarations: [declaration({ nom: 'ristigouche' })] });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
  assert.equal(r.identifies[0].source, 'sa déclaration de naissance');
});

test('la déclaration identifie aussi par le NOM — un pane qui a bougé ne perd pas son agent', () => {
  const r = juger({
    panes: [agent({ pane_id: 'w9:p9' })],
    agentsHerdr: [{ pane_id: 'w9:p9', herdr_socket: SOCKET_S1, agent: true, name: 'ristigouche' }],
    declarations: [declaration({ pane: 'w1:p1', session_herdr: 'une-autre-session' })],
  });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
});

/**
 * 🔴 « UNE SESSION INCONNUE N'APPARIE RIEN » — LA GARANTIE ÉTAIT ÉCRITE, ET RIEN NE LA TENAIT.
 *
 * `declarationDe` déclare en toutes lettres : « `identiteDeSession` rend `null` sur un socket
 * hors de la forme `…/sessions/<nom>/…` — elle n'invente aucun nom. Laisser deux `null` se
 * comparer égaux apparierait sur le SEUL pane, c'est-à-dire le défaut que cette clé existe pour
 * fermer. » Le garde-fou est le `session === null ? null :` en tête de la clé primaire.
 *
 * Mesuré : le retirer (`false ? null :`) laissait la suite ENTIÈRE au vert — 757 pass / 0 fail,
 * identique au témoin. La moitié voisine (la comparaison des deux noms de session) est gardée,
 * elle : la muter fait rougir deux bancs. **Encore une moitié sur deux.**
 *
 * ⚠️ LA MUTATION N'EST PAS VIDE : sur ce cas-ci, elle fait passer la sortie de 1 à 0 et les
 * identifiés de 0 à 1. Le trou n'était pas dans le code, il était dans ce qui l'éprouve.
 *
 * ⚠️ EXPOSITION RÉELLE MESURÉE : 0 socket non nommable sur 121 aujourd'hui. C'est un trou de
 * BANC, pas un trou vivant — et c'est justement pourquoi il fallait le construire : un
 * dénominateur épinglé ne se garde pas avec la population du jour.
 */
test('🔴 DEUX SESSIONS QUE RIEN NE NOMME NE S’APPARIENT PAS — un `null` n’est pas une identité', () => {
  // Un socket hors de la forme `…/sessions/<nom>/herdr.sock` : `identiteDeSession` rend `null`.
  // Des DEUX côtés — c'est le seul cas où « null === null » pourrait tenir lieu d'appariement.
  const SANS_NOM = '/bac/un/chemin/sans/le/mot/attendu/herdr.sock';
  const r = juger({
    panes: [agent({ pane_id: 'w1:p1', herdr_socket: SANS_NOM })],
    declarations: [declaration({ pane: 'w1:p1', session_herdr: SANS_NOM, espace: APRES, nom: 'ristigouche' })],
  });
  assert.equal(
    r.comptes.identifies, 0,
    'la clé primaire a apparié sur le SEUL pane — or un identifiant de pane n’est unique que dans sa session'
  );
  assert.equal(r.comptes.prises, 1);
  assert.equal(r.sortie, SORTIES[VERDICTS.NES_HORS_DISPOSITIF]);
});

test('LE CONTRÔLE POSITIF DE LA MÊME CLÉ : deux sessions NOMMÉES et égales apparient bien', () => {
  // ⚠️ SANS LUI, LA GARDE CI-DESSUS SERAIT VERTE LE JOUR OÙ LA CLÉ PRIMAIRE CESSERAIT
  // D'APPARIER TOUT LE MONDE. Une assertion négative non appariée se satisfait de la panne.
  const r = juger({
    panes: [agent({ pane_id: 'w1:p1' })],
    declarations: [declaration({ pane: 'w1:p1', session_herdr: 's1', espace: APRES })],
  });
  assert.equal(r.comptes.identifies, 1);
  assert.equal(r.identifies[0].source, SOURCES.DECLARATION);
});

test('une déclaration d’une AUTRE session n’identifie pas un homonyme de pane', () => {
  // 🔴 SURVIVANTE DE LA CAMPAGNE DE MUTATION (M15). Apparier `d.pane === agent.pane` sans
  // comparer la session passait toute la suite au vert.
  //
  // ⚠️ ET LE DÉFAUT EST RÉEL, PAS THÉORIQUE : un identifiant de pane n'est unique QUE dans sa
  // session, et ce poste porte QUINZE sessions herdr (mesuré le 2026-08-25). Un `w1:p1` existe
  // dans plusieurs d'entre elles. Sans la session, la déclaration d'un agent régulier couvrirait
  // un homonyme né hors dispositif dans une autre session — un FAUX NÉGATIF, c'est-à-dire
  // exactement ce que cette garde existe pour empêcher.
  const r = juger({
    panes: [agent({ pane_id: 'w1:p1', herdr_socket: socketDe('session-A') })],
    declarations: [declaration({ nom: 'un-autre-agent', pane: 'w1:p1', session_herdr: 'session-B' })],
  });
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF, 'l’homonyme d’une autre session ne le couvre pas');
  assert.equal(r.prises.length, 1);

  // La moitié qui prouve : la MÊME déclaration, dans LA MÊME session, l’identifie.
  const meme = juger({
    panes: [agent({ pane_id: 'w1:p1', herdr_socket: socketDe('session-A') })],
    declarations: [declaration({ nom: 'un-autre-agent', pane: 'w1:p1', session_herdr: 'session-A' })],
  });
  assert.equal(meme.verdict, VERDICTS.RIEN_A_SIGNALER);
});

test('le LIEU DE RÔLE sur disque identifie — un agent posé dans son lieu n’est pas un inconnu', () => {
  const r = juger({
    panes: [agent({ foreground_cwd: `${APRES}/.orchestrateur/batiscan` })],
    declarations: [],
    roleDuLieu: lieuEtabli,
  });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
  assert.equal(r.identifies[0].source, 'le lieu de rôle qu’il occupe');
});

test('un NOM conforme n’identifie RIEN — et la prise le DIT sur sa propre ligne', () => {
  // ⚠️ CE BANC AFFIRMAIT L'INVERSE JUSQU'AU 2026-08-25, et c'est ce qui rendait le critère n°1
  // décoratif : le nom d'un agent né par le dispositif EST le code de son mandat, donc toujours
  // conforme. Tant que le nom valait preuve, retirer une déclaration ne pouvait rien faire
  // rougir. `T-20260822-0018` l'avait établi en toutes lettres : le nom identifie, il ne CLASSE
  // pas — il ne porte ni le rôle, ni le coordonnateur, ni l'espace.
  const r = juger({
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: SOCKET_S1, agent: true, name: 'batiscan' }],
    declarations: [],
  });
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF);
  assert.equal(r.prises.length, 1);
  assert.equal(r.prises[0].designation, 'batiscan');
  assert.equal(r.prises[0].nomConforme, true);
  assert.equal(r.comptes.prisesAuNomConforme, 1, 'le prix du changement se voit en chiffre');

  // ⚠️ ET LE POURQUOI FRANCHIT LA SORTIE. Un lecteur qui découvre une prise au nom impeccable
  // sans qu'on lui dise pourquoi ce nom ne la sauve plus prendra la garde pour cassée — et la
  // désarmera avec les meilleures raisons du monde.
  assert.match(r.texte, /un nom n’est pas une naissance/);
});

test('le CHIFFRE du bascule franchit la SORTIE — pas seulement la structure', () => {
  // ⚠️ TROUVÉ PAR UNE MUTATION SURVIVANTE. Retirer la ligne de synthèse du compte rendu ne
  // faisait rougir AUCUN banc : `prisesAuNomConforme` existait dans la structure, et personne
  // ne vérifiait qu'un humain devant son terminal le voyait. C'est le motif que ce fichier
  // garde déjà pour les méthodes — « elle franchit la sortie, elle ne reste pas dans la
  // structure » — et il valait pour le seul chiffre qui mesure ce que la correction a basculé.
  //
  // Deux prises, pas une : la ligne doit porter le COMPTE, pas seulement exister.
  const r = juger({
    panes: [agent({ pane_id: 'w1:p1' }), agent({ pane_id: 'w1:p2' })],
    agentsHerdr: [
      { pane_id: 'w1:p1', herdr_socket: SOCKET_S1, agent: true, name: 'batiscan' },
      { pane_id: 'w1:p2', herdr_socket: SOCKET_S1, agent: true, name: 'ristigouche' },
    ],
    declarations: [],
  });
  assert.equal(r.comptes.prisesAuNomConforme, 2);
  assert.match(r.texte, /2 de ces 2 prise\(s\) portent un nom CONFORME/);
});

test('un nom qui n’est PAS conforme n’identifie rien — « bash » n’est pas une naissance', () => {
  // ⚠️ Le nom du pane peut venir du titre du terminal, pas du dispositif. L'accepter sans le
  // juger ferait de n'importe quel shell un agent régulier.
  const r = juger({
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: SOCKET_S1, agent: true, name: '../evil' }],
    declarations: [],
  });
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF);

  // ⚠️ SANS CECI, CE BANC NE DISTINGUE PLUS RIEN. Depuis que le nom n'identifie plus, conforme
  // ou pas, l'agent est pris : l'assertion ci-dessus passerait même si `nomDeLieuValide`
  // disparaissait du module. Ce qui reste discriminant, c'est la MENTION : une prise au nom non
  // conforme ne doit PAS porter la note réservée aux noms conformes.
  assert.equal(r.prises[0].nomConforme, false);
  assert.equal(r.comptes.prisesAuNomConforme, 0);
  assert.doesNotMatch(r.texte, /un nom n’est pas une naissance/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3. LA BORNE — ce que la garde ne juge pas, elle le DIT
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un agent NÉ AVANT la mise en service ne rougit pas — et il est compté hors portée', () => {
  const r = juger({ nes: { 'w1:p1': NE_AVANT }, declarations: [] });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
  assert.equal(r.prises.length, 0);
  assert.equal(r.horsPortee.length, 1);
  assert.equal(r.horsPortee[0].raison, 'né avant la mise en service du dispositif');
});

/**
 * 🔴 CES DEUX-CI ÉPROUVAIENT LA BORNE PAR LE CHEMIN, ET LA BORNE N'EST PLUS LÀ.
 *
 * Un espace que rien ne date, un agent sans espace du tout : la garde les rangeait hors portée
 * — c'est-à-dire au VERT — sur le nom de leur répertoire. C'est le trou que le correctif de la
 * reprise ferme. Ils gardent donc désormais la propriété INVERSE, qui est celle qui compte :
 * **le répertoire ne décide plus**, et un agent né après la frontière est jugé quel que soit
 * l'endroit où il travaille. Mesuré sur le parc du 2026-08-25 : 52 des 124 agents vivants
 * n'avaient aucun horodatage dans leur espace, dont 9 nés APRÈS la mise en service.
 */
test('un espace de travail que RIEN ne date ne met plus personne hors portée — le chemin ne juge pas', () => {
  const r = juger({ panes: [agent({ foreground_cwd: NON_DATABLE })], declarations: [] });
  assert.equal(r.horsPortee.length, 0, 'le nom du répertoire décide encore de la population');
  assert.equal(r.prises.length, 1);
  assert.match(r.texte, /t-0043/, 'la prise ne dit pas OÙ aller voir l’agent');
});

test('un agent sans aucun espace de travail est jugé sur sa NAISSANCE, pas écarté en silence', () => {
  const r = juger({ panes: [agent({ foreground_cwd: null, cwd: null })], declarations: [] });
  assert.equal(r.horsPortee.length, 0, 'un agent sans espace repassait au vert par la borne');
  assert.equal(r.prises.length, 1);
});

test('un pane SANS agent n’entre pas dans le parc — c’est un shell, pas un agent', () => {
  const r = juger({ panes: [agent({ agent_session: null })], declarations: [] });
  assert.equal(r.comptes.parcVivant, 0);
});

test('le plus PROFOND horodatage gagne — un worktree dans un worktree ne se date pas par le premier', () => {
  assert.equal(horodatageDuChemin('/bac/worktrees/20260101-000000/x/20260825-093000/y'), '20260825-093000');
});

test('l’horodatage se lit en heure LOCALE — c’est celle que `claude-swt` inscrit', () => {
  const t = instantDeLHorodatage('20260825-083616');
  assert.equal(t.getFullYear(), 2026);
  assert.equal(t.getMonth(), 7);
  assert.equal(t.getDate(), 25);
  assert.equal(t.getHours(), 8);
  assert.equal(t.getMinutes(), 36);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4. LES TROIS ÉTATS — « je n’ai pas mesuré » ne se replie jamais sur « rien à signaler »
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un lieu ILLISIBLE rend « non mesuré », nommé — jamais « né hors dispositif »', () => {
  // Les deux appellent des gestes OPPOSÉS : sur un hors-dispositif on va voir l'agent ; sur un
  // non-mesuré on REFAIT la mesure. Les confondre envoie corriger ce qui va peut-être bien.
  const r = juger({
    panes: [agent({ foreground_cwd: `${APRES}/.orchestrateur/batiscan` })],
    declarations: [],
    roleDuLieu: lieuIllisible,
  });
  assert.equal(r.verdict, VERDICTS.ZONES_NON_MESUREES);
  assert.equal(r.prises.length, 0);
  assert.equal(r.nonMesures.length, 1);
  assert.match(r.texte, /permission refusée/, 'la CAUSE voyage avec le fait');
});

test('un pane que le registre des agents N’A PAS VU rend « non mesuré » — son silence ne dit rien', () => {
  // ⚠️ `agent list` a déjà été mesuré à 83 panes sur 227 : un instrument dont la complétude
  // varie ne peut pas servir de preuve d'absence de nom.
  const r = juger({ panes: [agent()], agentsHerdr: [], declarations: [] });
  assert.equal(r.verdict, VERDICTS.ZONES_NON_MESUREES);
  assert.equal(r.nonMesures.length, 1);
});

test('une source ÉTABLIE l’emporte sur une source non mesurée — un seul lien suffit', () => {
  const r = juger({
    panes: [agent({ foreground_cwd: `${APRES}/.orchestrateur/batiscan` })],
    declarations: [declaration({ espace: `${APRES}/.orchestrateur/batiscan` })],
    roleDuLieu: lieuIllisible,
  });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
});

test('un registre ABSENT n’est pas un registre ILLISIBLE — le premier laisse juger, le second refuse', () => {
  // Absent : `lireLesDeclarations` rend `{declarations: [], illisibles: []}` — c'est le poste
  // où personne n'est encore né, et ses agents récents sont bel et bien hors dispositif.
  const absent = juger({ declarations: [], illisibles: [] });
  assert.equal(absent.verdict, VERDICTS.NES_HORS_DISPOSITIF);

  // Illisible : un fait abîmé peut être CELUI de l'agent qu'on juge. On ne conclut pas.
  const abime = juger({ declarations: [], illisibles: [{ fichier: 'x.json', cause: 'JSON tronqué' }] });
  assert.equal(abime.verdict, VERDICTS.ZONES_NON_MESUREES);
  assert.match(abime.texte, /x\.json/);
});

test('une déclaration pour un agent MORT ne fait rien rougir — elle n’a plus de vivant à couvrir', () => {
  const r = juger({ panes: [], declarations: [declaration()] });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
  assert.equal(r.comptes.parcVivant, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5. LES DEUX CHIFFRES — jamais nus, jamais sans leur portée
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la garde DIT sur combien de sessions elle porte — un compte d’une seule session est un PLANCHER', () => {
  // ⚠️ Mesuré le 2026-08-25 : 15 sessions herdr sur le poste, 5 répondent. Un compte présenté
  // comme un total serait amputé des deux tiers.
  const r = juger({ portee: { sessionsInterrogees: 15, sessionsRefusees: [{ session: 'a' }, { session: 'b' }] } });
  assert.match(r.texte, /15/);
  assert.match(r.texte, /2/);
  assert.match(r.texte, /plancher/i, 'le mot qui empêche de lire le compte comme un total');
});

test('les deux chiffres sortent AVEC leur méthode de mesure', () => {
  const r = juger({ declarations: [] });
  assert.equal(r.comptes.prises, 1);
  assert.equal(typeof r.comptes.fauxRefus, 'number');
  assert.match(r.methode.prises, /\S/);
  assert.match(r.methode.fauxRefus, /\S/);
  assert.match(r.texte, /méthode/i, 'la méthode franchit la sortie, elle ne reste pas dans la structure');
});

test('un FAUX REFUS se mesure par une AUTRE clé que celle qui a servi à apparier', () => {
  // ⚠️ Mesurer le faux refus avec la clé de l'appariement le rendrait NUL par construction —
  // un chiffre juste, tautologique, et donc invérifiable. On croise par l'ESPACE de travail :
  // une déclaration qui porte cet espace prouve qu'une naissance a eu lieu ici, même si ni le
  // pane ni le nom n'ont concordé. C'est un défaut d'APPARIEMENT, et il doit se voir.
  // Le témoin : un agent VRAIMENT identifié — déclaration appariée par son pane — ne produit ni
  // prise ni faux refus. (Il s'adossait au nom conforme jusqu'au 2026-08-25 ; le nom n'identifie
  // plus, mais la fonction de ce témoin — un chiffre qui peut valoir zéro pour une BONNE raison
  // — est inchangée.)
  const r = juger({
    panes: [agent({ pane_id: 'w7:p7' })],
    agentsHerdr: [{ pane_id: 'w7:p7', herdr_socket: SOCKET_S1, agent: true, name: 'un-autre' }],
    declarations: [declaration({ nom: 'un-autre', pane: 'w7:p7', espace: APRES })],
  });
  assert.equal(r.comptes.prises, 0, 'sa déclaration l’identifie');
  assert.equal(r.comptes.fauxRefus, 0);

  // Le même, sans nom du tout : il est pris, ET le croisement par l'espace le signale.
  const r2 = juger({
    panes: [agent({ pane_id: 'w7:p7' })],
    agentsHerdr: [{ pane_id: 'w7:p7', herdr_socket: SOCKET_S1, agent: true, name: null }],
    declarations: [declaration({ nom: 'ristigouche', pane: 'w1:p1', session_herdr: 'une-autre-session', espace: APRES })],
  });
  assert.equal(r2.comptes.prises, 1);
  assert.equal(r2.comptes.fauxRefus, 1, 'une déclaration porte cet espace : l’appariement a raté');
  assert.match(r2.texte, /peut-être été à tort/i);
});

/**
 * 🔴 LE CONTRE-CONTRÔLE ÉTAIT PLUS STRICT QUE LA CLÉ QU'IL AUDITE — et donc aveugle au cas
 * PRÉCIS pour lequel la règle de préfixe a été écrite.
 *
 * L'appariement identifie par PRÉFIXE (`memeEspaceDeTravail`) : un chef d'équipe qui descend
 * dans un dossier de son worktree travaille toujours dans son espace, et exiger l'égalité
 * ferait de lui une prise pour un `cd`. `fauxRefus`, lui, croisait par ÉGALITÉ STRICTE
 * (`espacesDeclares.has(p.espace)`).
 *
 * Conséquence : un agent déclaré, descendu d'un cran, dont le pane a bougé et qui n'a pas de
 * nom, devient une prise — et le SEUL chiffre censé mesurer les refus à tort rend `0`. Le
 * contre-contrôle certifiait « aucun refus à tort » sur le cas qu'il existe pour attraper.
 *
 * ⚠️ IL RESTE UN CROISEMENT PAR UNE CLÉ AUTRE, et c'est ce qui l'empêche de devenir nul par
 * construction : l'appariement exige (pane-dans-sa-session ET espace) OU (nom ET espace) ;
 * celui-ci n'exige QUE l'espace. C'est la RÈGLE DE COMPARAISON de l'espace qui s'aligne — pas
 * la clé.
 */
test('🔴 UN REFUS À TORT SUR UN SOUS-DOSSIER SE MESURE — la règle d’espace est la MÊME des deux côtés', () => {
  const r = juger({
    // Le pane a bougé (`w9:p9` ≠ `w1:p1` de la déclaration) et l'agent est ANONYME : aucune des
    // deux clés d'appariement ne l'atteint. Il est donc une prise — c'est le cas de base.
    panes: [agent({ pane_id: 'w9:p9', foreground_cwd: `${APRES}/naissance-representant/src` })],
    declarations: [declaration({ espace: APRES, pane: 'w1:p1' })],
  });
  assert.equal(r.comptes.prises, 1, 'le cas de base a changé : ce banc n’éprouve plus le contre-contrôle');
  assert.equal(
    r.comptes.fauxRefus, 1,
    'le seul chiffre qui mesure les refus à tort est aveugle au cas pour lequel la règle de préfixe existe'
  );
  assert.match(r.texte, /peut-être été À TORT/);
});

test('un espace déclaré VOISIN n’est pas le même — `…-bis` ne mesure aucun refus à tort', () => {
  // ⚠️ LA MOITIÉ SYMÉTRIQUE. Aligner la règle sur le préfixe NU rendrait `…/20260825-093000-bis`
  // indiscernable de `…/20260825-093000` : le contre-contrôle se mettrait à voir des refus à
  // tort qui n'en sont pas, et le chiffre cesserait de vouloir dire quelque chose.
  const r = juger({
    panes: [agent({ pane_id: 'w9:p9', foreground_cwd: `${APRES}-bis` })],
    declarations: [declaration({ espace: APRES, pane: 'w1:p1' })],
  });
  assert.equal(r.comptes.prises, 1);
  assert.equal(r.comptes.fauxRefus, 0, 'un worktree voisin a été compté comme un refus à tort');
});

test('le vert dit SUR QUOI il repose — un vert porté par une seule source est un vert MINCE', () => {
  // ⚠️ TROUVÉ EN MESURANT LE TRAFIC RÉEL DU 2026-08-25, et ça contredit une lecture confortable
  // du dispositif : les 8 agents de la population du jour sont identifiés **à 8 sur 8 par leur
  // NOM**, zéro par déclaration (le registre n'existe pas encore) et zéro par lieu de rôle.
  //
  // Or le nom est la source la plus FAIBLE des trois : la liste blanche du dépôt accepte à peu
  // près n'importe quel segment de chemin. Un « rien à signaler » entièrement porté par elle ne
  // vaut pas le même « rien à signaler » que celui d'un parc déclaré — et rien, dans un verdict
  // nu, ne permet au lecteur de faire la différence. C'est le motif « un vert qui ne touche pas
  // ce qu'il éprouve » : le compte est juste, la phrase qu'on en tire est fausse.
  // ⚠️ CE BANC VENTILAIT DEUX AGENTS IDENTIFIÉS PAR LEUR NOM — la source qui a été retirée. Sa
  // FONCTION est intacte : la ventilation doit franchir la SORTIE, pas rester dans la structure.
  // Elle porte désormais les deux sources qui identifient encore, et elles se distinguent.
  const r = juger({
    panes: [
      agent({ pane_id: 'w1:p1' }),
      agent({ pane_id: 'w1:p2', foreground_cwd: `${APRES}/.orchestrateur/batiscan` }),
    ],
    agentsHerdr: [
      { pane_id: 'w1:p1', herdr_socket: SOCKET_S1, agent: true, name: 'ristigouche' },
      { pane_id: 'w1:p2', herdr_socket: SOCKET_S1, agent: true, name: 'batiscan' },
    ],
    declarations: [declaration({ nom: 'ristigouche', pane: 'w1:p1' })],
    roleDuLieu: lieuEtabli,
  });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
  assert.deepEqual(r.comptes.parSource, { [SOURCES.DECLARATION]: 1, [SOURCES.LIEU]: 1 });
  assert.match(r.texte, /sa déclaration de naissance\s*:\s*1/);
  assert.match(r.texte, /le lieu de rôle qu’il occupe\s*:\s*1/);
  assert.match(r.methode.identifies, /\S/);
});

test('sur un trafic entièrement déclaré, ZÉRO refus à tort', () => {
  const parc = [];
  const decls = [];
  for (let i = 0; i < 12; i += 1) {
    const espace = `${WT}/2026082509${String(i).padStart(2, '0')}00`;
    parc.push(agent({ pane_id: `w1:p${i}`, foreground_cwd: espace }));
    decls.push(declaration({ nom: `agent-${i}`, pane: `w1:p${i}`, espace }));
  }
  const r = juger({ panes: parc, declarations: decls });
  assert.equal(r.comptes.prises, 0);
  assert.equal(r.comptes.fauxRefus, 0);
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6. LES COMPTES BALANCENT — la seule façon d'ajouter une exception muette est de les casser
// ═══════════════════════════════════════════════════════════════════════════════════════

test('parc vivant = hors portée + population, et population = identifiés + prises + non mesurés', () => {
  const r = juger({
    panes: [
      agent({ pane_id: 'w1:p1' }),                                   // pris
      agent({ pane_id: 'w1:p2', foreground_cwd: AVANT }),            // hors portée — NÉ avant
      agent({ pane_id: 'w1:p3', foreground_cwd: NON_DATABLE }),      // hors portée — NÉ avant
      agent({ pane_id: 'w1:p4' }),                                   // identifié
    ],
    nes: { 'w1:p2': NE_AVANT, 'w1:p3': NE_AVANT },
    agentsHerdr: [
      { pane_id: 'w1:p1', herdr_socket: SOCKET_S1, agent: true, name: null },
      { pane_id: 'w1:p2', herdr_socket: SOCKET_S1, agent: true, name: null },
      { pane_id: 'w1:p3', herdr_socket: SOCKET_S1, agent: true, name: null },
      // ⚠️ IDENTIFIÉ PAR SA DÉCLARATION, plus par son nom : `w1:p4` portait `batiscan` et
      // basculait dans les prises depuis que le nom n'identifie plus. Les deux assertions
      // d'ÉQUILIBRE ci-dessous — la fonction de ce banc — n'ont jamais bougé.
      { pane_id: 'w1:p4', herdr_socket: SOCKET_S1, agent: true, name: 'batiscan' },
    ],
    declarations: [declaration({ nom: 'batiscan', pane: 'w1:p4' })],
  });
  const c = r.comptes;
  assert.equal(c.parcVivant, c.horsPortee + c.population);
  assert.equal(c.population, c.identifies + c.prises + c.nonMesures);
  assert.equal(c.horsPortee, 2);
  assert.equal(c.prises, 1);
  assert.equal(c.identifies, 1);
});

test('ComptesQuiNeBalancentPas existe et se lève — le déséquilibre n’est pas une valeur rendue', () => {
  assert.ok(ComptesQuiNeBalancentPas.prototype instanceof Error);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7. LA FRONTIÈRE EST VÉRIFIÉE CONTRE LES FAITS — l'épingle qui n'est pas auto-référentielle
// ═══════════════════════════════════════════════════════════════════════════════════════

test('une mise en service POSTÉRIEURE à la plus ancienne déclaration fait REFUSER la garde', () => {
  // ⚠️ C'EST L'ÉPINGLE, ET ELLE NE VIT PAS DANS CE FICHIER. Reculer la frontière est LE geste
  // qui désarme : tout ce qui naît avant la nouvelle date cesse d'être jugé, sans qu'aucune
  // liste ne bouge. La garde se compare donc au REGISTRE RÉEL du poste : une déclaration
  // antérieure à sa propre frontière PROUVE que le dispositif était déjà en service à cette
  // date-là. La référence est une donnée du monde, pas une constante que ce banc porte.
  assert.throws(
    () => juger({
      miseEnService: '20260901-000000',
      declarations: [declaration({ ne_le: '2026-08-25T13:30:00.000Z' })],
    }),
    (e) => e instanceof FrontiereContredite && /2026-08-25/.test(e.message),
  );
});

test('la frontière par défaut n’est PAS contredite par une déclaration du jour de mise en service', () => {
  assert.doesNotThrow(() => juger({ declarations: [declaration()] }));
  assert.match(MISE_EN_SERVICE, /^\d{8}-\d{6}$/);
});

test('un registre VIDE ne peut pas contredire la frontière — l’épingle ne mord que sur des faits', () => {
  assert.doesNotThrow(() => juger({ miseEnService: '20270101-000000', declarations: [] }));
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8. LES SORTIES — « je n'ai pas pu mesurer » ne sort jamais par la même porte que le vert
// ═══════════════════════════════════════════════════════════════════════════════════════

test('chaque verdict a SA sortie, et elles sont toutes distinctes', () => {
  const codes = Object.values(VERDICTS).map((v) => SORTIES[v]);
  assert.equal(new Set(codes).size, codes.length, 'deux verdicts qui sortent pareil sont un verdict');
  assert.equal(SORTIES[VERDICTS.RIEN_A_SIGNALER], 0, 'le vert, et lui seul, sort en 0');
  assert.ok(SORTIES[VERDICTS.ZONES_NON_MESUREES] > 0, 'un « je n’ai pas pu » qui sort en 0 est pire que rien');
});

test('designationDe rend un nom quand il y en a un, une adresse quand il n’y en a pas', () => {
  assert.equal(designationDe({ nom: { mesure: 'lu', valeur: 'batiscan' }, pane: 'w1:p1' }), 'batiscan');
  assert.match(designationDe({ nom: { mesure: 'aucun', valeur: null }, pane: 'w1:p1', session: '/s.sock', espace: APRES }), /w1:p1/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8. UNE SESSION MUETTE EST UNE ZONE NON MESURÉE — le vert ne la couvre pas
//
// 🔴 LE CONTRAT QUE LE FIL SE DONNE, ET QUE LE VERDICT NE TENAIT PAS. `bin/` s'ouvre sur
// « CE FIL NE REND JAMAIS VERT SUR UNE MESURE QU'IL N'A PAS FAITE » — et `sessionsRefusees`
// entrait dans `comptes` et dans la prose de `methode.portee` SANS entrer ni dans le verdict
// ni dans le code de sortie. Mesuré sur le poste le 2026-08-25 : 15 sessions interrogées,
// 10 refusent. Le `0` que lit une machine certifiait un parc amputé des deux tiers.
//
// ⚠️ ET LE SEUL ESSAI QUI REGARDAIT CE CHIFFRE N'ASSERTAIT QUE DU TEXTE (« 15 », « 2 »,
// « plancher »). Le texte disait la limite ; le contrat machine disait vert. C'est
// exactement « une assertion juste sur un chemin correct, qui laisse la vraie population
// non gardée ».
//
// ⚠️ POURQUOI CE N'EST PAS « UNE SESSION QUI REFUSE ⇒ ROUGE ». Une garde qui sortirait
// non-zéro dès qu'un socket périmé traîne sur le poste serait ignorée en trois jours — et
// une garde qu'on ignore ne garde rien. Le trafic réel tranche : les 10 refus du poste
// portent TOUS le code `server_not_running` de herdr, c'est-à-dire « aucun serveur ici ».
// Une session dont le serveur ne tourne pas n'a NI pane NI agent : il n'y a rien qu'on ait
// manqué de mesurer. C'est le socket qui a survécu à sa session, pas une zone d'ombre — le
// même partage que ce module fait déjà entre un registre ABSENT (cas normal, jugeable) et
// un registre LÀ MAIS ILLISIBLE (refus). Une session qui refuse pour TOUTE AUTRE raison est
// là et se tait : elle, on ne l'a pas mesurée.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Le refus tel que `panes()` le pousse — mesuré mot pour mot sur le poste le 2026-08-25. */
const refusServeurMort = (nom) => ({
  session: `/Users/qui-que-ce-soit/.config/herdr/sessions/${nom}/herdr.sock`,
  raison:
    'Command failed: herdr pane list\n{"id":"cli:pane:list","error":{"code":"server_not_running",' +
    `"message":"no herdr server is running at /Users/qui-que-ce-soit/.config/herdr/sessions/${nom}/herdr.sock; run \`herdr\` to start or attach it"}}\n`,
});

test('🔴 UNE SESSION MUETTE INTERDIT LE VERT — la garde ne certifie pas ce qu’elle n’a pas regardé', () => {
  // Un parc parfaitement propre : aucun vivant à juger. Le SEUL fait qui reste est qu’une
  // session interrogée n’a pas répondu, et qu’elle n’a pas dit que son serveur était mort.
  const r = juger({
    panes: [],
    portee: { sessionsInterrogees: 15, sessionsRefusees: [{ session: '/…/sessions/cg/herdr.sock', raison: 'délai dépassé' }] },
  });
  assert.equal(r.verdict, VERDICTS.ZONES_NON_MESUREES, `un parc à moitié regardé n’est pas « rien à signaler » :\n${r.texte}`);
  assert.equal(r.sortie, SORTIES[VERDICTS.ZONES_NON_MESUREES], 'et la SORTIE le dit — c’est elle que lit une machine');
  assert.notEqual(r.sortie, 0, 'le contrat du fil : jamais vert sur une mesure non faite');
});

test('UNE SESSION DONT LE SERVEUR NE TOURNE PAS N’EST PAS UNE ZONE D’OMBRE — le socket a survécu à sa session', () => {
  // ⚠️ LA MOITIÉ QUI EMPÊCHE LA GARDE D'ÊTRE IGNORÉE. Les 10 refus du poste sont de cette
  // forme-là. Les traiter en zones non mesurées rendrait la garde ROUGE en permanence sur un
  // poste parfaitement sain — et une garde toujours rouge est une garde qu'on désarme.
  const r = juger({
    panes: [],
    portee: {
      sessionsInterrogees: 15,
      sessionsRefusees: ['somtechj', 'sibelnager', 'morasse', 'caribou'].map(refusServeurMort),
    },
  });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER, `un serveur absent n’a ni pane ni agent :\n${r.texte}`);
  assert.equal(r.sortie, 0);
  assert.equal(r.comptes.sessionsRefusees, 4, 'le refus reste COMPTÉ et dit — il n’est pas effacé');
  assert.equal(r.comptes.sessionsMuettes, 0, 'mais aucune n’est muette');
});

test('🔴 UN REFUS QU’ON NE SAIT PAS CLASSER COMPTE COMME MUET — l’incertitude tombe du côté BRUYANT', () => {
  // ⚠️ LA POLARITÉ DE LA PANNE, ET ELLE EST LE POINT. Reconnaître « serveur absent » est ce
  // qui rend cette garde silencieuse ; si herdr change ce code demain, la reconnaissance
  // cesse de mordre. Il faut donc que cet échec-là rende la garde PLUS BRUYANTE, jamais plus
  // aveugle : un refus non classé est muet, et le vert tombe. Un classement qui se
  // tromperait dans l’autre sens serait un interrupteur de désarmement chez herdr.
  for (const raison of ['', null, undefined, 'connection reset by peer', 'permission denied', 'server_not_runnin']) {
    const r = juger({ panes: [], portee: { sessionsInterrogees: 15, sessionsRefusees: [{ session: 's', raison }] } });
    assert.equal(r.verdict, VERDICTS.ZONES_NON_MESUREES, `raison « ${raison} » : elle doit compter comme muette`);
    assert.equal(r.comptes.sessionsMuettes, 1);
  }
});

test('UNE PRISE PASSE AVANT UNE SESSION MUETTE — les deux gestes sont opposés, la sortie les distingue', () => {
  // Aller voir un agent / refaire la mesure : une chaîne qui les confondrait enverrait
  // corriger ce qui va bien. La prise est le fait le plus urgent, et le texte porte de toute
  // façon la portée sur chaque rendu.
  const r = juger({
    portee: { sessionsInterrogees: 15, sessionsRefusees: [{ session: 's', raison: 'délai dépassé' }] },
  });
  assert.equal(r.comptes.prises, 1);
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF);
  assert.equal(r.sortie, 1);
  assert.equal(r.comptes.sessionsMuettes, 1, 'muette quand même — comptée, et dite dans le texte');
});

test('LA SESSION MUETTE SE NOMME DANS LE TEXTE — un compte ne se va pas voir', () => {
  const r = juger({
    panes: [],
    portee: { sessionsInterrogees: 15, sessionsRefusees: [{ session: '/…/sessions/cg/herdr.sock', raison: 'délai dépassé' }] },
  });
  assert.match(r.texte, /cg/, 'le lecteur doit savoir LAQUELLE refaire');
  assert.match(r.texte, /délai dépassé/, 'et pourquoi elle n’a pas répondu');
});

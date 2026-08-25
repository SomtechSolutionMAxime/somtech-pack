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
} from '../src/garde-des-naissances.js';

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE HARNAIS — tout ce qui parle au monde entre par paramètre (patron de `recensement.js`)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Un poste dont les worktrees vivent là — jamais le vrai `~/worktrees`. */
const WT = '/bac/worktrees/un-depot';

/** Après la mise en service : cet agent-là est DANS la population. */
const APRES = `${WT}/20260825-093000`;

/** Avant : il ne l'est pas, et ce n'est pas une exception — c'est la borne. */
const AVANT = `${WT}/20260724-204645`;

/** Un espace de travail qu'aucun nom ne date. Mesuré : 13 agents vivants sont dans ce cas. */
const NON_DATABLE = `${WT}/t-0043`;

const agent = (sur = {}) => ({
  pane_id: 'w1:p1',
  herdr_socket: '/bac/s1.sock',
  agent_session: 'ses-1',
  foreground_cwd: APRES,
  ...sur,
});

const declaration = (sur = {}) => ({
  version: 1,
  nom: 'ristigouche',
  role: 'orchestrateur',
  mandat: 'T-20260825-0013',
  espace: APRES,
  pane: 'w1:p1',
  session_herdr: '/bac/s1.sock',
  ne_le: '2026-08-25T13:30:00.000Z',
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
  ...reste
} = {}) {
  return jugerLeParc({
    agents: normaliserLeParc({ panes, agentsHerdr }),
    registre: { declarations, illisibles },
    roleDuLieu,
    portee: portee(),
    ...reste,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1. LE CRITÈRE N°1 — la déclaration retirée fait ROUGIR, et la garde NOMME
// ═══════════════════════════════════════════════════════════════════════════════════════

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
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: '/bac/s1.sock', agent: true, name: 'Agent Infra-Ops' }],
    declarations: [],
  });
  assert.equal(prises.length, 1);
  assert.equal(prises[0].designation, 'Agent Infra-Ops');
  assert.match(texte, /Agent Infra-Ops/, 'le nom doit franchir la SORTIE, pas seulement la structure');

  // Et la moitié qui prouve : le MÊME agent, nom conforme, cesse d'être une prise.
  const conforme = juger({
    panes: [agent()],
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: '/bac/s1.sock', agent: true, name: 'ristigouche' }],
    declarations: [],
  });
  assert.equal(conforme.prises.length, 0);
});

test('un agent ANONYME est nommé par son adresse — un anonyme reste ADRESSABLE', () => {
  // ⚠️ 77 des 112 agents vivants du poste sont anonymes (mesuré le 2026-08-25). Une garde qui
  // ne saurait nommer qu'un agent nommé serait muette sur les deux tiers du parc — et sur
  // exactement ceux qui manquent le plus au dispositif.
  const { prises, texte } = juger({
    panes: [agent()],
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: '/bac/s1.sock', agent: true, name: null }],
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
    agentsHerdr: [{ pane_id: 'w9:p9', herdr_socket: '/bac/s1.sock', agent: true, name: 'ristigouche' }],
    declarations: [declaration({ pane: 'w1:p1', session_herdr: '/autre.sock' })],
  });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
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
    panes: [agent({ pane_id: 'w1:p1', herdr_socket: '/bac/session-A.sock' })],
    declarations: [declaration({ nom: 'un-autre-agent', pane: 'w1:p1', session_herdr: '/bac/session-B.sock' })],
  });
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF, 'l’homonyme d’une autre session ne le couvre pas');
  assert.equal(r.prises.length, 1);

  // La moitié qui prouve : la MÊME déclaration, dans LA MÊME session, l’identifie.
  const meme = juger({
    panes: [agent({ pane_id: 'w1:p1', herdr_socket: '/bac/session-A.sock' })],
    declarations: [declaration({ nom: 'un-autre-agent', pane: 'w1:p1', session_herdr: '/bac/session-A.sock' })],
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

test('un NOM conforme à la convention identifie', () => {
  const r = juger({
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: '/bac/s1.sock', agent: true, name: 'batiscan' }],
    declarations: [],
  });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
  assert.equal(r.identifies[0].source, 'son nom, conforme à la convention');
});

test('un nom qui n’est PAS conforme n’identifie rien — « bash » n’est pas une naissance', () => {
  // ⚠️ Le nom du pane peut venir du titre du terminal, pas du dispositif. L'accepter sans le
  // juger ferait de n'importe quel shell un agent régulier.
  const r = juger({
    agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: '/bac/s1.sock', agent: true, name: '../evil' }],
    declarations: [],
  });
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3. LA BORNE — ce que la garde ne juge pas, elle le DIT
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un agent d’AVANT la mise en service ne rougit pas — et il est compté hors portée', () => {
  const r = juger({ panes: [agent({ foreground_cwd: AVANT })], declarations: [] });
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
  assert.equal(r.prises.length, 0);
  assert.equal(r.horsPortee.length, 1);
  assert.equal(r.horsPortee[0].raison, 'né avant la mise en service du dispositif');
});

test('un espace de travail que RIEN ne date est hors portée, nommé, et sa raison est dite', () => {
  const r = juger({ panes: [agent({ foreground_cwd: NON_DATABLE })], declarations: [] });
  assert.equal(r.horsPortee.length, 1);
  assert.equal(r.horsPortee[0].raison, 'aucun horodatage de naissance dans son espace de travail');
  assert.match(r.texte, /t-0043/, 'la borne se VOIT — une borne silencieuse est un trou');
});

test('un agent sans aucun espace de travail est hors portée, pas vert en silence', () => {
  const r = juger({ panes: [agent({ foreground_cwd: null, cwd: null })], declarations: [] });
  assert.equal(r.horsPortee.length, 1);
  assert.equal(r.prises.length, 0);
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
  const r = juger({
    panes: [agent({ pane_id: 'w7:p7' })],
    agentsHerdr: [{ pane_id: 'w7:p7', herdr_socket: '/bac/s1.sock', agent: true, name: 'un-autre' }],
    declarations: [declaration({ nom: 'ristigouche', pane: 'w1:p1', session_herdr: '/autre.sock', espace: APRES })],
  });
  assert.equal(r.comptes.prises, 0, 'le nom conforme l’identifie');

  // Le même, sans nom du tout : il est pris, ET le croisement par l'espace le signale.
  const r2 = juger({
    panes: [agent({ pane_id: 'w7:p7' })],
    agentsHerdr: [{ pane_id: 'w7:p7', herdr_socket: '/bac/s1.sock', agent: true, name: null }],
    declarations: [declaration({ nom: 'ristigouche', pane: 'w1:p1', session_herdr: '/autre.sock', espace: APRES })],
  });
  assert.equal(r2.comptes.prises, 1);
  assert.equal(r2.comptes.fauxRefus, 1, 'une déclaration porte cet espace : l’appariement a raté');
  assert.match(r2.texte, /peut-être été à tort/i);
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
      agent({ pane_id: 'w1:p2', foreground_cwd: AVANT }),            // hors portée
      agent({ pane_id: 'w1:p3', foreground_cwd: NON_DATABLE }),      // hors portée
      agent({ pane_id: 'w1:p4' }),                                   // identifié
    ],
    agentsHerdr: [
      { pane_id: 'w1:p1', herdr_socket: '/bac/s1.sock', agent: true, name: null },
      { pane_id: 'w1:p2', herdr_socket: '/bac/s1.sock', agent: true, name: null },
      { pane_id: 'w1:p3', herdr_socket: '/bac/s1.sock', agent: true, name: null },
      { pane_id: 'w1:p4', herdr_socket: '/bac/s1.sock', agent: true, name: 'batiscan' },
    ],
    declarations: [],
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

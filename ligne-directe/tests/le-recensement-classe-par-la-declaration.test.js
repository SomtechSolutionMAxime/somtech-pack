// LE RECENSEMENT CLASSE LES RÔLES DEPUIS LA DÉCLARATION DE NAISSANCE.
// (T-20260825-0012, sous E-20260825-0002, D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE BANC FERME — MESURÉ SUR LE POSTE AVANT D'ÊTRE ÉCRIT
//
// Le 2026-08-27 à 12 h 35, `ligne-directe recensement` rendait, pour l'agent `t-20260825-0012`
// — un chef d'équipe né PAR LE GESTE, déclaré au registre du poste :
//
//     "role": { "mesure": "non établi", "nom": null,
//               "pourquoi": "son chemin de travail ne passe par le lieu d’aucun rôle connu — un
//                            chef d’équipe est aujourd’hui dans ce cas : le geste qui le fait
//                            naître ne dépose rien dans son worktree" }
//
// Sur les 83 agents du parc, **63 au rôle non établi**. Deux d'entre eux étaient déclarés :
// leur rôle, leur mandat et leur coordonnateur étaient inscrits, horodatés, lisibles par une
// machine — et le registre qui existe pour dire QUI EST QUI ne les lisait pas.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QUE CE BANC REFUSE DE LAISSER CONFONDRE — et c'est RA-VUE-006, pas une préférence
//
// Un rôle DÉCLARÉ n'est pas un rôle ÉTABLI. « établi » veut dire, dans ce module, mesuré AU
// LIEU : les quatre fichiers du gabarit posés ET les en-têtes réels du métier. Un chef d'équipe
// n'a pas de lieu — EF-AGT-006 l'interdit, et `chef-equipe.js` mesure ce que l'y forcer casse.
// Ranger le déclaré sous « établi » ferait dire au registre qu'il a mesuré ce qu'on lui a dit.
//
// Le quatrième état existe donc pour ÇA, et trois bancs d'ici le tiennent :
//   ① `mesure: 'déclarée'` porte sa SOURCE sur l'entrée, jamais dans un rangement ;
//   ② un agent qui occupe un lieu de rôle reste « établi » — le PROUVÉ prime le DÉCLARÉ ;
//   ③ un agent SANS déclaration reste « non établi », mot pour mot comme avant (RA-VUE-003 :
//      l'absence se montre, elle ne se comble pas).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ET LA BORNE D'ESPACE N'EST PAS DÉCORATIVE. Le repli par le NOM apparie une déclaration à
// un agent dont le pane a bougé. Sans borne, `herdr agent rename` vers un nom déjà déclaré
// suffirait à faire porter à n'importe qui le rôle et le coordonnateur d'un autre — le défaut
// que `garde-des-naissances.js` a payé et fermé. On ne réécrit pas sa règle : on l'IMPORTE.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unRecensement } from '../src/recensement.js';
import { role as roleDe } from '../src/roles.js';
import { unPaneDAgent } from './aide/formes-reelles.js';

/** La prose EXACTE d'un rôle non établi sans lieu — l'oracle du « rien n'a bougé ». */
const SANS_LIEU =
  'son chemin de travail ne passe par le lieu d’aucun rôle connu — un chef d’équipe est ' +
  'aujourd’hui dans ce cas : le geste qui le fait naître ne dépose rien dans son worktree';

const SESSION = '/Users/qui/.config/herdr/sessions/somtech/herdr.sock';

/** Un pane d'agent, tel que `herdr pane list` le rend — la fabrique, jamais une forme inventée. */
function pane({ pane_id = 'w1:p1', cwd = '/Users/qui/worktrees/depot/20260827-000000' } = {}) {
  return unPaneDAgent({ pane_id, statut: 'working', herdr_socket: SESSION, foreground_cwd: cwd });
}

/** Une déclaration, telle que `inscrireLaDeclaration` l'écrit — les clés mesurées du poste. */
function declaration({
  nom = 't-20260825-0012',
  role = 'chef-equipe',
  mandat = 'T-20260825-0012',
  coordonnateur = 'e-20260825-0002',
  espace = '/Users/qui/worktrees/depot/20260827-000000',
  paneDeclare = 'w1:p1',
  session = 'somtech',
  ne_le = '2026-08-27T01:42:50.192Z',
} = {}) {
  return { version: 1, nom, role, mandat, coordonnateur, espace, pane: paneDeclare, session_herdr: session, ne_le, pose_par: 'pack agent naitre' };
}

/** Le registre des agents de herdr, dans la forme que `unRecensement` attend. */
function nomsDe(paires) {
  const NUL = String.fromCharCode(0);
  return { mesure: 'lue', noms: new Map(paires.map(([p, n]) => [`${SESSION}${NUL}${p}`, n])) };
}

const recenser = (options) =>
  unRecensement({
    roleDuLieu: () => null,
    references: {},
    maintenant: Date.UTC(2026, 7, 27),
    ...options,
  });

// ═══════════════════════════════════════════════════════════════════════════════════════
// ① SANS REGISTRE, RIEN NE BOUGE — le paramètre est opt-in, et son absence n'invente rien.
//
// ⚠️ CE BANC EST LE CONTRÔLE NÉGATIF DU TROISIÈME G/W/T. « Seuls les agents déclarés ont changé
// de rendu » ne se prouve pas en regardant les déclarés : il se prouve sur ceux qui ne le sont
// pas. Un correctif qui reformulerait cette prose le rendrait rouge, et c'est le but.
test('sans registre de déclarations, le rôle reste « non établi », mot pour mot', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
  });

  assert.equal(rendu.agents[0].role.mesure, 'non établi');
  assert.equal(rendu.agents[0].role.nom, null);
  assert.equal(rendu.agents[0].role.pourquoi, SANS_LIEU);
  assert.equal(rendu.compte.roleNonEtabli, 1);
  assert.equal(rendu.compte.roleDeclare, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ② LE PREMIER G/W/T — un chef d'équipe vivant DÉCLARÉ porte son rôle, son mandat, son
// coordonnateur.
test('un chef d’équipe déclaré porte son rôle, son mandat et son coordonnateur', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  const role = rendu.agents[0].role;
  assert.equal(role.mesure, 'déclarée');
  assert.equal(role.nom, 'chef-equipe');
  assert.equal(role.libelle, 'chef d’équipe');
  assert.equal(role.mandat, 'T-20260825-0012');
  assert.equal(role.coordonnateur, 'e-20260825-0002');
  assert.equal(role.declaree_le, '2026-08-27T01:42:50.192Z');
  // ⚠️ LA SOURCE VOYAGE AVEC LE FAIT (RA-VUE-006). Sans elle, un lecteur qui reçoit cette entrée
  // seule ne peut pas distinguer un rôle mesuré au lieu d'un rôle qu'on lui a déclaré.
  assert.equal(role.source, 'déclarée');
  assert.equal(rendu.compte.roleDeclare, 1);
  assert.equal(rendu.compte.roleNonEtabli, 0);
  assert.deepEqual(rendu.compte.parRoleDeclare, { 'chef-equipe': 1 });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ③ LE DEUXIÈME G/W/T — l'absence se MONTRE, elle ne se comble pas (RA-VUE-003).
//
// ⚠️ ET LA PROSE EST LA MÊME QU'AU BANC ①. Un agent non déclaré ne doit pas apprendre du
// registre qu'on l'y a cherché : son rendu est identique, registre donné ou non. C'est ce qui
// rend le troisième G/W/T vérifiable par simple comparaison d'écrans.
test('un agent vivant SANS déclaration reste « non établi » — rien n’est deviné', async () => {
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w9:p9', cwd: '/Users/qui/ailleurs' })],
    nomsConnus: nomsDe([['w9:p9', 'bonaventure']]),
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'non établi');
  assert.equal(rendu.agents[0].role.nom, null);
  assert.equal(rendu.agents[0].role.pourquoi, SANS_LIEU);
  assert.equal(rendu.compte.roleDeclare, 0);
  assert.equal(rendu.compte.roleNonEtabli, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ④ LE REPLI PAR LE NOM — il existe parce que le PANE bouge, et il est borné par l'ESPACE.
test('un agent dont le pane a bougé est retrouvé par son nom, dans son espace', async () => {
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w4:p4' })],
    nomsConnus: nomsDe([['w4:p4', 't-20260825-0012']]),
    declarations: { declarations: [declaration({ paneDeclare: 'w1:p1' })], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'déclarée');
  assert.equal(rendu.agents[0].role.nom, 'chef-equipe');
});

// ⚠️ LA MOITIÉ QUI COÛTE. Sans la borne d'espace, un `herdr agent rename` vers un nom déjà
// déclaré suffit à faire porter à n'importe qui le rôle ET LE COORDONNATEUR d'un autre.
test('un nom qui apparie une déclaration d’un AUTRE espace n’identifie personne', async () => {
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w4:p4', cwd: '/Users/qui/worktrees/depot/99999999-999999' })],
    nomsConnus: nomsDe([['w4:p4', 't-20260825-0012']]),
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'non établi');
  assert.equal(rendu.agents[0].role.pourquoi, SANS_LIEU);
});

// ⚠️ ET LA CLÉ PRIMAIRE EXIGE LA SESSION. Un identifiant de pane n'est unique QUE dans sa
// session — ce poste en porte quinze. Une déclaration d'une AUTRE session ne doit pas apparier
// un homonyme, et le nom ne doit pas la rattraper : ici les noms diffèrent.
test('un pane homonyme d’une AUTRE session n’hérite pas de la déclaration', async () => {
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w1:p1' })],
    nomsConnus: nomsDe([['w1:p1', 'matapedia']]),
    declarations: { declarations: [declaration({ session: 'progex' })], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'non établi');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑤ LE PROUVÉ PRIME LE DÉCLARÉ — RA-VUE-004 : le registre des rôles est UNIQUE, la déclaration
// s'y RATTACHE, elle ne le concurrence pas.
test('un agent qui occupe un lieu de rôle reste « établi » — le lieu prime la déclaration', async () => {
  const lieu = '/Users/qui/depot/.orchestrateur/p-20260822-0001';
  const rendu = await recenser({
    panes: [pane({ cwd: lieu })],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    roleDuLieu: () => 'orchestrateur',
    declarations: { declarations: [declaration({ espace: lieu })], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'établi');
  assert.equal(rendu.agents[0].role.nom, 'orchestrateur');
  assert.equal(rendu.agents[0].role.libelle, roleDe('orchestrateur').libelle);
  assert.equal(rendu.compte.roleDeclare, 0);
  assert.equal(rendu.compte.parRole.orchestrateur, 1);
});

// ⚠️ ET UN LIEU À DEMI POSÉ NE DEVIENT PAS DÉCLARÉ NON PLUS. Sa prose dit « va finir de le
// poser » ; la remplacer par le rôle déclaré ferait disparaître le geste à faire.
test('un lieu à demi posé garde sa prose — la déclaration ne la recouvre pas', async () => {
  const lieu = '/Users/qui/depot/.orchestrateur/p-20260822-0001';
  const rendu = await recenser({
    panes: [pane({ cwd: lieu })],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    roleDuLieu: () => null,
    declarations: { declarations: [declaration({ espace: lieu })], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'non établi');
  assert.match(rendu.agents[0].role.pourquoi, /lieu à demi posé/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑥ « PAS TROUVÉE » NE VAUT PAS « ABSENTE » — un fait abîmé peut être celui de cet agent-ci.
test('un registre qui porte des illisibles rend « refusée », jamais « non établi »', async () => {
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w9:p9', cwd: '/Users/qui/ailleurs' })],
    nomsConnus: nomsDe([['w9:p9', 'bonaventure']]),
    declarations: {
      declarations: [],
      illisibles: [{ fichier: '20260827T000000000Z-x.json', cause: 'Unexpected token' }],
    },
  });

  assert.equal(rendu.agents[0].role.mesure, 'refusée');
  assert.match(rendu.agents[0].role.raison, /20260827T000000000Z-x\.json/);
  assert.equal(rendu.compte.roleNonMesure, 1);
  assert.equal(rendu.compte.roleNonEtabli, 0);
});

// ⚠️ ET UN NOM NON MESURÉ AUSSI. Le nom est la clé de REPLI de l'appariement : sans lui,
// « pas trouvée » ne vaut pas « absente ». `agent list` a déjà été mesuré à 83 panes sur 227.
test('un nom non mesuré rend la déclaration « refusée », jamais absente', async () => {
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w9:p9', cwd: '/Users/qui/ailleurs' })],
    nomsConnus: { mesure: 'refusée', raison: 'herdr agents() a refusé' },
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'refusée');
  assert.match(rendu.agents[0].role.raison, /clé de repli/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑦ LA JOINTURE PASSE PAR LE CHEMIN RÉEL — et c'est la fonction de la garde, pas une copie.
//
// Sur macOS, `/tmp/x` et `/private/tmp/x` désignent le même répertoire. Un `startsWith` sur les
// chaînes brutes accusait un chef d'équipe RÉGULIER d'être né hors dispositif (9dfad89). Ce
// banc rougit si quelqu'un réécrit ici une seconde règle d'appariement d'espace.
test('un lien symbolique ne sépare pas l’agent de sa déclaration', async () => {
  const dur = mkdtempSync(join(realpathSync(tmpdir()), 'declaration-espace-'));
  const arbre = join(dur, 'worktree');
  mkdirSync(arbre);
  const lien = join(dur, 'raccourci');
  symlinkSync(arbre, lien);

  const rendu = await recenser({
    // L'agent travaille dans un SOUS-DOSSIER du chemin réel…
    panes: [pane({ cwd: arbre })],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    // …et sa déclaration inscrit le chemin qui passe par le lien.
    declarations: { declarations: [declaration({ espace: lien })], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'déclarée');
});

// ⚠️ ET LE SOUS-DOSSIER COMPTE. `foreground_cwd` est le répertoire du SHELL : un chef d'équipe
// qui descend dans un dossier de son arbre travaille toujours dans son espace.
test('un agent descendu dans un sous-dossier de son espace reste apparié', async () => {
  const rendu = await recenser({
    panes: [pane({ cwd: '/Users/qui/worktrees/depot/20260827-000000/ligne-directe/src' })],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'déclarée');
});

// ⚠️ ET UN VOISIN DONT LE NOM COMMENCE PAREIL N'EST PAS DEDANS. `…-bis` commence par `…` sans
// être dessous : c'est le séparateur qui fait la frontière, jamais le préfixe.
test('un espace voisin au nom préfixe n’est pas le même espace', async () => {
  const rendu = await recenser({
    panes: [pane({ cwd: '/Users/qui/worktrees/depot/20260827-000000-bis' })],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'non établi');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑧ LES COMPTES BALANCENT — la garde de la garde, reprise de `garde-des-naissances.js`.
//
// ⚠️ ELLE N'EST PAS DÉFENSIVE. Le seul moyen d'ajouter un panier muet — « ceux-là, on les laisse
// passer » — est de sortir un agent d'un compartiment sans le remettre dans un autre. L'égalité
// l'attrape mécaniquement, y compris pour une exception qu'on n'a pas encore imaginée.
test('les quatre compartiments du rôle couvrent le parc, sans recouvrement', async () => {
  const lieu = '/Users/qui/depot/.orchestrateur/p-20260822-0001';
  const rendu = await recenser({
    panes: [
      pane({ pane_id: 'w1:p1' }), // déclaré
      pane({ pane_id: 'w2:p2', cwd: '/Users/qui/ailleurs' }), // non établi
      pane({ pane_id: 'w3:p3', cwd: lieu }), // établi
    ],
    roleDuLieu: (ou) => (ou === lieu ? 'orchestrateur' : null),
    nomsConnus: nomsDe([
      ['w1:p1', 't-20260825-0012'],
      ['w2:p2', 'bonaventure'],
      ['w3:p3', 'matapedia'],
    ]),
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  const c = rendu.compte;
  const etablis = Object.values(c.parRole).reduce((a, b) => a + b, 0);
  const declares = Object.values(c.parRoleDeclare).reduce((a, b) => a + b, 0);
  assert.equal(declares, c.roleDeclare);
  assert.equal(etablis + c.roleDeclare + c.roleNonEtabli + c.roleNonMesure, rendu.agents.length);
  assert.equal(rendu.agents.length, 3);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑨ LE RÉSUMÉ ET LE JOURNAL LES NOMMENT — parce que ce sont les deux seules sorties lues.
//
// ⚠️ `recenser()` JETTE le rendu : la ligne de journal est la SEULE sortie d'un tour de ronde du
// veilleur. Un compte qui ne vivrait que dans `compte` ne serait lu par personne.
test('le résumé et le journal nomment les rôles déclarés, distincts des établis', async () => {
  const lignes = [];
  const rendu = await recenser({
    panes: [pane(), pane({ pane_id: 'w2:p2', cwd: '/Users/qui/ailleurs' })],
    nomsConnus: nomsDe([
      ['w1:p1', 't-20260825-0012'],
      ['w2:p2', 'bonaventure'],
    ]),
    declarations: { declarations: [declaration()], illisibles: [] },
    journaliser: (m) => lignes.push(m),
  });

  assert.match(rendu.resume, /1 chefs? d’équipe DÉCLARÉ/);
  assert.match(rendu.resume, /1 au rôle NON ÉTABLI/);
  assert.match(lignes.join('\n'), /1 chefs? d’équipe déclaré/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑩ UN RÔLE DÉCLARÉ QUE LA TABLE NE CONNAÎT PAS NE FAIT TOMBER PERSONNE.
//
// ⚠️ `role` (roles.js) JETTE sur un rôle inconnu, et c'est voulu : DÉCIDER sur un rôle qu'on ne
// connaît pas reste interdit. Mais NOMMER ne décide de rien — c'est la règle que `libellePluriel`
// écrit déjà. Un registre qui mourrait entier parce qu'UNE déclaration porte un rôle futur serait
// le contraire de sa conduite : il MESURE et REND.
test('un rôle déclaré hors table se rend par son nom brut, sans faire tomber le registre', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: [declaration({ role: 'partenaire-transverse' })], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'déclarée');
  assert.equal(rendu.agents[0].role.nom, 'partenaire-transverse');
  assert.equal(rendu.agents[0].role.libelle, 'partenaire-transverse');
  assert.deepEqual(rendu.compte.parRoleDeclare, { 'partenaire-transverse': 1 });
});

// ⚠️ ET UNE DÉCLARATION SANS RÔLE N'EN INVENTE PAS UN. Le champ est obligatoire à l'écriture,
// mais un fait déjà inscrit par une version antérieure peut ne pas le porter : le combler
// ferait affirmer un rôle que personne n'a déclaré.
test('une déclaration sans rôle n’identifie pas — l’absence se montre', async () => {
  const nu = declaration();
  delete nu.role;
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: [nu], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'non établi');
  assert.equal(rendu.compte.roleDeclare, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑪ LE DÉCLARÉ NE FABRIQUE NI MÉTIER À COMPARER, NI GESTE À PROPOSER.
//
// ⚠️ UN CHEF D'ÉQUIPE N'A PAS DE LIEU, DONC PAS DE MÉTIER À MESURER. Si `mesure: 'déclarée'`
// se mettait à ouvrir les branches réservées à « établi », le registre irait chercher un
// `CLAUDE.md` dans un worktree qui n'en porte aucun et rendrait « ne s'est pas laissé mesurer »
// — le faux échec d'instrument que ce module s'interdit partout.
test('un rôle déclaré ne fait ni mesurer un métier, ni proposer un geste', async () => {
  const mesures = [];
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    mesurer: (ou) => {
      mesures.push(ou);
      return { empreinte: 'x', octets: 1 };
    },
    references: { 'chef-equipe': { empreinte: 'y', octets: 2 } },
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  assert.deepEqual(mesures, []);
  assert.equal(rendu.agents[0].metier.mesure, 'sans objet');
  assert.equal(rendu.agents[0].aJour, null);
  assert.equal(rendu.agents[0].remiseAJour, null);
  assert.equal(rendu.compte.enRetard, 0);
});

// ⚠️ ET LE MANDAT DU LIEU RESTE CELUI DU LIEU. Le mandat DÉCLARÉ vit sur le bloc du rôle, avec
// sa source ; le porter au champ `mandat` — documenté « ce que le LIEU nomme » — rendrait un
// fait déclaré indiscernable d'un fait prouvé, ce que RA-VUE-006 interdit.
test('le mandat déclaré ne se glisse pas dans le champ du mandat porté par le lieu', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  assert.equal(rendu.agents[0].mandat, null);
  assert.equal(rendu.agents[0].lieu, null);
  assert.equal(rendu.agents[0].role.mandat, 'T-20260825-0012');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫ DEUX DÉCLARATIONS APPARIENT LA MÊME PLACE — la PLUS RÉCENTE l'emporte, et c'est mesuré.
//
// ⚠️ REPRENDRE UNE PLACE EST LE GESTE QUE LE PACK PRESCRIT (`claude-swt <horodatage>`). Le
// successeur et son prédécesseur partagent alors pane, session et espace. Prendre la première
// venue ferait porter au vivant le mandat d'un mort — `lireLesDeclarations` trie du plus récent
// au plus ancien, et ce banc RELIE ce tri au choix, plutôt que de le supposer.
test('quand deux déclarations apparient la même place, la plus récente l’emporte', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: {
      declarations: [
        declaration({ mandat: 'T-20260827-0002', ne_le: '2026-08-27T10:00:00.000Z' }),
        declaration({ mandat: 'T-20260825-0012', ne_le: '2026-08-25T10:00:00.000Z' }),
      ],
      illisibles: [],
    },
  });

  assert.equal(rendu.agents[0].role.mandat, 'T-20260827-0002');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-bis LA BORNE DIT SI LA SOURCE A ÉTÉ LUE — parce qu'un zéro nu recouvre deux états.
//
// 🔴 CE BANC EXISTE PARCE QU'UNE MUTATION A SURVÉCU À LA SUITE ENTIÈRE. Décâbler le registre
// dans le veilleur laissait 1 065 essais verts : sans registre, le rendu est CELUI D'AVANT — ce
// qui est voulu — donc `roleDeclare` valait 0, comme sur un poste où personne n'est déclaré. Le
// correctif pouvait devenir inerte sur le poste réel sans que rien ne rougisse.
test('sans registre, la borne DIT que la source n’a pas été lue — ce n’est pas « aucun déclaré »', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
  });

  assert.equal(rendu.borne.sourceDeclaree.mesure, 'non donnée');
  assert.equal(rendu.borne.sourceDeclaree.faits, null);
  // ⚠️ LA CONSÉQUENCE VOYAGE AVEC LE FAIT. Un lecteur qui voit « 0 déclaré » doit apprendre ici,
  // sans lire le code, que ce zéro ne dit rien du parc.
  assert.match(rendu.borne.sourceDeclaree.consequence, /n’est PAS « aucun agent n’est déclaré »/);
  // Et le compte reste à zéro — c'est bien lui qui ne peut PAS porter la distinction.
  assert.equal(rendu.compte.roleDeclare, 0);
});

test('avec registre, la borne compte les faits lus et NOMME les illisibles', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: {
      declarations: [declaration()],
      illisibles: [{ fichier: '20260827T000000000Z-x.json', cause: 'Unexpected token' }],
    },
  });

  assert.equal(rendu.borne.sourceDeclaree.mesure, 'lue');
  assert.equal(rendu.borne.sourceDeclaree.faits, 1);
  // Nommés, pas comptés : un fait abîmé peut être celui de n'importe quel agent de ce rendu.
  assert.deepEqual(rendu.borne.sourceDeclaree.illisibles, [
    { fichier: '20260827T000000000Z-x.json', cause: 'Unexpected token' },
  ]);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑬ UN INVENTAIRE QUI REFUSE RESTE UN REFUS — le registre des déclarations ne le recouvre pas.
test('un inventaire refusé rend « agents: null » même avec un registre de déclarations', async () => {
  const rendu = await recenser({
    panes: () => {
      throw new Error('herdr introuvable');
    },
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  assert.equal(rendu.agents, null);
  assert.match(rendu.inventaireRefuse, /herdr introuvable/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑭ LA FORME DU REGISTRE EST CELLE QUE LE PRODUCTEUR ÉCRIT — pas une forme inventée ici.
//
// ⚠️ TROIS FOIS DANS CE MODULE, UN BANC A ÉTÉ TENU VERT PAR UN COLLABORATEUR IMAGINAIRE (voir
// `formes-reelles.js`). La fabrique `declaration()` ci-dessus prétend rendre ce que
// `inscrireLaDeclaration` écrit : on le VÉRIFIE contre le vrai producteur, sur disque, plutôt
// que de le croire.
test('la fabrique de déclarations de ce banc porte les mêmes clés que le vrai geste', async () => {
  const racine = mkdtempSync(join(tmpdir(), 'declaration-forme-'));
  const { inscrireLaDeclaration } = await import('../../naissance-representant/src/declaration.js');
  const { declaration: vraie } = inscrireLaDeclaration({
    nom: 't-20260825-0012',
    role: 'chef-equipe',
    mandat: 'T-20260825-0012',
    coordonnateur: 'e-20260825-0002',
    espace: '/Users/qui/worktrees/depot/20260827-000000',
    pane: 'w1:p1',
    session: 'somtech',
    racine,
    quand: new Date('2026-08-27T01:42:50.192Z'),
  });

  assert.deepEqual(Object.keys(declaration()).sort(), Object.keys(vraie).sort());
  assert.deepEqual(declaration(), vraie);
  // Et le fichier écrit se relit — la lecture est bien celle que le recensement consommera.
  const { lireLesDeclarations } = await import('../../naissance-representant/src/declaration.js');
  const relu = lireLesDeclarations({ racine });
  assert.deepEqual(relu.declarations, [vraie]);
  assert.deepEqual(relu.illisibles, []);
  writeFileSync(join(racine, 'temoin.txt'), 'lu');
});

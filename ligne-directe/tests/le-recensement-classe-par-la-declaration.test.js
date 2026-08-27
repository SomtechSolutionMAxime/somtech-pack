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
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unRecensement } from '../src/recensement.js';
import { libellesDuRoleDeclare } from '../src/declaration-des-agents.js';
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

  try {
    const rendu = await recenser({
      // L'agent travaille dans un SOUS-DOSSIER du chemin réel…
      panes: [pane({ cwd: arbre })],
      nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
      // …et sa déclaration inscrit le chemin qui passe par le lien.
      declarations: { declarations: [declaration({ espace: lien })], illisibles: [] },
    });

    assert.equal(rendu.agents[0].role.mesure, 'déclarée');
  } finally {
    // ⚠️ `finally` : un bac laissé derrière par un banc ROUGE s'accumule à chaque tour de suite,
    // et un lien symbolique abandonné dans `/tmp` est le genre de résidu qu'un tour ultérieur
    // finit par apparier.
    rmSync(dur, { recursive: true, force: true });
  }
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

  // ⚠️ LA FRONTIÈRE EST DEVANT LA TRANCHE, PAS APRÈS. Un « … DÉCLARÉ(s) » en queue semblait ne
  // porter que sur le dernier poste d'une liste plate — voir le banc du parc MÊLÉ plus bas.
  assert.match(rendu.resume, /; DÉCLARÉS \(jamais mesurés au lieu\) : 1 chefs? d’équipe/);
  assert.match(rendu.resume, /1 au rôle NON ÉTABLI/);
  assert.match(lignes.join('\n'), /; déclarés \(jamais mesurés au lieu\) : 1 chefs? d’équipe/);
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
  // ⚠️ `null`, PAS `[]` — SURVIVANTE. `[]` affirme « j'ai mesuré, zéro illisible » ; `null` dit
  // « je n'ai pas mesuré ». C'est la règle de conduite que ce module revendique partout ailleurs,
  // et elle n'était tenue par aucune assertion sur ce champ-ci.
  assert.equal(rendu.borne.sourceDeclaree.illisibles, null);
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
// ⑫-ter DEUX RÔLES DÉCLARÉS SE RENDENT DANS UN ORDRE STABLE — trouvé par une mutation SURVIVANTE.
//
// 🔴 AUCUN BANC NE CONSTRUISAIT DEUX RÔLES DÉCLARÉS DISTINCTS À LA FOIS. Retirer le `.sort()`
// qui ordonne `parRoleDeclare` laissait donc les 43 essais de ce lot verts, alors que l'ordre
// rendu suit celui des panes que herdr renvoie — c'est-à-dire qu'il change d'un tour à l'autre.
// Le résumé est la ligne que le dirigeant lit : deux tours du MÊME parc s'y liraient différemment,
// et ce dépôt a déjà payé « un rendu qui dépend de la machine ».
test('deux rôles déclarés se rendent dans un ordre stable, quel que soit celui des panes', async () => {
  const parcs = [
    [pane({ pane_id: 'w1:p1' }), pane({ pane_id: 'w2:p2', cwd: '/Users/qui/autre-arbre' })],
    [pane({ pane_id: 'w2:p2', cwd: '/Users/qui/autre-arbre' }), pane({ pane_id: 'w1:p1' })],
  ];
  const rendus = [];
  for (const panes of parcs) {
    rendus.push(
      await recenser({
        panes,
        nomsConnus: nomsDe([
          ['w1:p1', 't-20260825-0012'],
          ['w2:p2', 'p-20260822-0001'],
        ]),
        declarations: {
          declarations: [
            declaration(),
            declaration({ nom: 'p-20260822-0001', role: 'partenaire-transverse', espace: '/Users/qui/autre-arbre', paneDeclare: 'w2:p2' }),
          ],
          illisibles: [],
        },
      })
    );
  }

  assert.equal(rendus[0].compte.roleDeclare, 2);
  assert.deepEqual(rendus[0].compte.parRoleDeclare, { 'chef-equipe': 1, 'partenaire-transverse': 1 });
  // ⚠️ ON COMPARE LES DEUX RÉSUMÉS ENTRE EUX, pas à une chaîne recopiée : un oracle écrit à la
  // main ici se corrigerait d'un même geste que le code, et ne garderait plus rien.
  assert.equal(rendus[0].resume, rendus[1].resume);
  assert.match(rendus[0].resume, /; DÉCLARÉS \(jamais mesurés au lieu\) : 1 chefs d’équipe, 1 partenaire-transverse/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-quater DEUX SESSIONS QU'ON N'A PAS SU NOMMER NE S'APPARIENT PAS ENTRE ELLES.
//
// 🔴 CE BANC FERME UNE SURVIVANTE, PAS UN DÉFAUT — le code était JUSTE, c'est sa garde qui était
// nue. `identiteDeSession` rend `null` sur un socket hors de la forme `…/sessions/<nom>/…`, ce
// que `HERDR_SOCKET_PATH` autorise ; le module refuse donc d'apparier tant que les DEUX côtés ne
// sont pas nommés. Retirer ce refus laissait les 1 068 essais du dépôt VERTS.
//
// ⚠️ ET LE PRIX EST CELUI QUE CE MODULE EXISTE POUR ÉVITER. Deux `null` qui se comparent égaux,
// c'est un appariement sur le SEUL pane — or un identifiant de pane n'est unique que dans sa
// session. Mesuré ci-dessous : sans le refus, un agent vivant hérite du mandat ET du
// coordonnateur d'un agent parti.
//
// ⚠️ LES DEUX ESSAIS QUI EXISTAIENT NE POUVAIENT PAS L'ATTRAPER : ils comparaient deux sessions
// VALIDES et différentes (`somtech` contre `progex`). Le chemin passait, il se lisait donc comme
// couvert — « une assertion trop faible sur un chemin correct ».
test('deux sessions IMPARSABLES ne s’apparient pas — sinon le pane seul déciderait', async () => {
  const opaque = '/un/chemin/de/socket/sans/le/mot/attendu';
  const rendu = await recenser({
    panes: [unPaneDAgent({ pane_id: 'w1:p1', statut: 'working', herdr_socket: opaque, foreground_cwd: '/Users/qui/arbre' })],
    // Le nom du vivant DIFFÈRE de celui de la déclaration : le repli par le nom ne peut pas
    // rattraper l'appariement, donc ce banc ne mesure QUE la clé primaire.
    nomsConnus: { mesure: 'lue', noms: new Map([[`${opaque}${String.fromCharCode(0)}w1:p1`, 'le-vivant']]) },
    declarations: {
      declarations: [
        declaration({
          nom: 'agent-parti',
          mandat: 'D-OLD-0001',
          coordonnateur: 'quelquun-dautre',
          espace: '/Users/qui/arbre',
          paneDeclare: 'w1:p1',
          session: '/un/autre/chemin/tout/aussi/opaque',
        }),
      ],
      illisibles: [],
    },
  });

  assert.equal(rendu.agents[0].role.mesure, 'non établi');
  assert.equal(rendu.compte.roleDeclare, 0);
});

// ⚠️ ET DEUX PANES QU'ON N'A PAS SU LIRE NON PLUS. `pane_id` peut manquer, et une déclaration
// porte `pane: null` quand le geste ne l'a pas connu : sans le terme `d?.pane &&`, deux absences
// s'appariaient, et l'espace seul suffisait alors à identifier — un arbre partagé par deux agents
// leur donnerait le même rôle.
test('deux panes ABSENTS ne s’apparient pas — une absence n’est pas une identité', async () => {
  const sock = '/Users/qui/.config/herdr/sessions/somtech/herdr.sock';
  const sansPane = { agent: 'claude', agent_session: { agent: 'claude', kind: 'id', value: 's' }, agent_status: 'working', herdr_socket: sock, foreground_cwd: '/Users/qui/arbre' };
  const rendu = await recenser({
    panes: [sansPane],
    nomsConnus: { mesure: 'lue', noms: new Map([[`${sock}${String.fromCharCode(0)}null`, 'le-vivant']]) },
    declarations: {
      declarations: [declaration({ nom: 'agent-parti', espace: '/Users/qui/arbre', paneDeclare: null })],
      illisibles: [],
    },
  });

  assert.equal(rendu.agents[0].role.mesure, 'non établi');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-quinquies UNE DÉCLARATION TROUVÉE MAIS SANS RÔLE, SUR UN REGISTRE ABÎMÉ — le doute gagne.
//
// ⚠️ LES DEUX CAS ÉTAIENT ÉPROUVÉS SÉPARÉMENT, JAMAIS ENSEMBLE, et c'est leur RENCONTRE qui
// décide. Une déclaration appariée qui ne porte pas de rôle ne dit rien — mais si le registre
// porte par ailleurs des illisibles, l'un d'eux peut être une déclaration PLUS RÉCENTE pour ce
// même agent. On ne conclut donc pas « non établi » (« il n'en a pas ») : on rend « refusée »
// (« je n'ai pas pu savoir »). Sortir tôt sur la déclaration muette perdait cette distinction.
test('une déclaration sans rôle, sur un registre abîmé, rend « refusée » — pas « non établi »', async () => {
  const nu = declaration();
  delete nu.role;
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: {
      declarations: [nu],
      illisibles: [{ fichier: '20260827T235959000Z-t-20260825-0012.json', cause: 'Unexpected end of JSON input' }],
    },
  });

  assert.equal(rendu.agents[0].role.mesure, 'refusée');
  assert.match(rendu.agents[0].role.raison, /ILLISIBLE/);
  assert.equal(rendu.compte.roleNonMesure, 1);
});

// ⚠️ ET UN CHAMP ABSENT SE REND `null`, JAMAIS `undefined`. Ce n'est pas du style : `undefined`
// DISPARAÎT de `JSON.stringify`, et le recensement est rendu en JSON. Le coordonnateur d'un
// agent cesserait donc d'exister dans le rendu au lieu d'y être dit absent — un champ oublié
// plutôt qu'un fait mesuré.
test('un coordonnateur ou un mandat absent se rend « null », et survit au JSON', async () => {
  const sansCoordonnateur = declaration();
  delete sansCoordonnateur.coordonnateur;
  delete sansCoordonnateur.mandat;
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: [sansCoordonnateur], illisibles: [] },
  });

  const role = rendu.agents[0].role;
  assert.equal(role.mesure, 'déclarée');
  assert.equal(role.coordonnateur, null);
  assert.equal(role.mandat, null);
  const relu = JSON.parse(JSON.stringify(role));
  assert.ok('coordonnateur' in relu, 'le champ doit SURVIVRE au JSON, dit absent plutôt qu’effacé');
  assert.ok('mandat' in relu);
});

// ⚠️ ET LES DEUX CHAMPS VOISINS AUSSI — SURVIVANTE. Le correctif `?? null` avait été posé sur
// QUATRE champs ; le banc n'en gardait que deux. Mesuré : remplacer `espace` ou `pose_par` par une
// valeur bidon laissait les 1 072 essais VERTS. Or `espace` est ce qui permet d'aller voir l'agent,
// et `pose_par` est ce qui donne un AUTEUR au fait — sans lui, une déclaration ne se distingue plus
// d'un fichier déposé à la main dans le registre.
test('le bloc déclaré rend l’espace et l’auteur du geste, tels que la déclaration les porte', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  const role = rendu.agents[0].role;
  assert.equal(role.espace, '/Users/qui/worktrees/depot/20260827-000000');
  assert.equal(role.pose_par, 'pack agent naitre');

  // Et absents, ils se disent `null` plutôt que de disparaître du JSON — même règle que ci-dessus.
  const nu = declaration();
  delete nu.pose_par;
  const sans = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: [nu], illisibles: [] },
  });
  assert.equal(sans.agents[0].role.pose_par, null);
  assert.ok('pose_par' in JSON.parse(JSON.stringify(sans.agents[0].role)));
});

// ⚠️ ET LA BORNE NE PRÉSUME PAS DE LA FORME DU REGISTRE — SURVIVANTE. `ceQueDitLaSourceDeclaree`
// vérifie que ce qu'on lui donne porte bien des TABLEAUX ; retirer ces vérifications laissait les
// 1 072 essais verts. Aucun producteur réel ne rend autre chose aujourd'hui — mais `unRecensement`
// est EXPORTÉ, et un registre malformé ferait alors tomber le tour entier sur un `.length` de
// `undefined` : 85 agents perdus parce qu'une source d'appoint est mal formée.
test('un registre malformé borne le rendu, il ne fait pas tomber le tour', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: { declarations: 'trois', illisibles: 'pas un tableau' },
  });

  assert.equal(rendu.agents.length, 1);
  assert.equal(rendu.borne.sourceDeclaree.mesure, 'lue');
  // ⚠️ `0`, PAS `5` : une chaîne PORTE un `.length`, et le lire compterait cinq « faits » qui
  // n'existent pas. C'est ce que `Array.isArray` refuse — et `null` ne l'aurait pas montré,
  // puisque `null?.length` rend déjà `undefined` : le mutant aurait été ÉQUIVALENT.
  assert.equal(rendu.borne.sourceDeclaree.faits, 0);
  assert.deepEqual(rendu.borne.sourceDeclaree.illisibles, []);
  // Et l'agent reste « non établi » : un registre qu'on ne sait pas lire n'identifie personne.
  assert.equal(rendu.agents[0].role.mesure, 'non établi');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-sexies LA PLACE PRIME LE NOM — SURVIVANTE. Inverser les deux clés laissait tout vert.
//
// 🔴 AUCUN BANC NE CONSTRUISAIT DEUX DÉCLARATIONS qui apparient chacune par une clé DIFFÉRENTE
// vers des faits différents. Chacune des deux clés était éprouvée seule ; leur ORDRE, jamais.
// Mesuré : essayer le nom AVANT la place laissait les 1 075 essais VERTS.
//
// ⚠️ ET L'ORDRE EST CE QUI DÉCIDE DU MANDAT RENDU. La place — ce pane, dans cette session, dans
// cet espace — est un fait que l'agent OCCUPE en ce moment ; le nom, lui, se PORTE, et un
// `herdr agent rename` le déplace. Quand les deux désignent des déclarations différentes, c'est
// donc la place qui dit qui travaille là, et le nom qui peut mentir.
test('quand la place et le nom désignent deux déclarations, la PLACE l’emporte', async () => {
  const espace = '/Users/qui/worktrees/depot/20260827-000000';
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w1:p1', cwd: espace })],
    nomsConnus: nomsDe([['w1:p1', 'le-nom-porte']]),
    declarations: {
      declarations: [
        // ① celle du NOM — même espace, mais un AUTRE pane : elle n'apparie que par le nom.
        declaration({ nom: 'le-nom-porte', mandat: 'T-PAR-LE-NOM', paneDeclare: 'w8:p8', espace }),
        // ② celle de la PLACE — ce pane, cette session, cet espace ; un autre nom.
        declaration({ nom: 'un-autre-nom', mandat: 'T-PAR-LA-PLACE', paneDeclare: 'w1:p1', espace }),
      ],
      illisibles: [],
    },
  });

  assert.equal(rendu.agents[0].role.mesure, 'déclarée');
  assert.equal(rendu.agents[0].role.mandat, 'T-PAR-LA-PLACE');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-septies « RIEN LU DU TOUT » N'EST PAS « LU, ET IL N'Y AVAIT RIEN » — la borne le disait.
//
// 🔴 `mesure: 'lue'` SORTAIT MÊME QUAND LE RÉPERTOIRE ENTIER AVAIT REFUSÉ LA LECTURE. Le champ
// qui existe pour dire ce que le compte vaut affirmait donc une mesure qui n'avait pas eu lieu.
test('un registre dont la lecture a ENTIÈREMENT échoué se rend « refusée », pas « lue »', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: {
      declarations: [],
      illisibles: [{ fichier: '(le registre entier)', cause: 'EACCES: permission denied' }],
      refusGlobal: 'EACCES: permission denied',
    },
  });

  assert.equal(rendu.borne.sourceDeclaree.mesure, 'refusée');
  // ⚠️ `faits: null`, PAS `0` — on n'a rien compté, on n'a pas compté zéro.
  assert.equal(rendu.borne.sourceDeclaree.faits, null);
  assert.match(rendu.borne.sourceDeclaree.raison, /EACCES/);
  assert.match(rendu.borne.sourceDeclaree.consequence, /n’est PAS « aucun agent n’est déclaré »/);
  // Et l'agent est « refusée », jamais « non établi » : sa déclaration est peut-être là.
  assert.equal(rendu.agents[0].role.mesure, 'refusée');
});

// ⚠️ ET MÊME S'IL PORTE DES FAITS. Les deux moitiés du rendu se lisaient chacune son champ : la
// borne regardait `refusGlobal`, le classement regardait `declarations`. Un registre qui porte
// les deux faisait donc dire à la MÊME page « rien n'a pu être lu » et « 1 chef d'équipe
// DÉCLARÉ », avec son mandat et son coordonnateur. Aucun producteur ne rend cette forme
// aujourd'hui — mais la cohérence d'un rendu ne peut pas dépendre de la discipline de son
// appelant, et `unRecensement` est exporté.
test('un registre en refus global n’identifie personne, même s’il porte des faits', async () => {
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: {
      // Un fait qui apparie PARFAITEMENT cet agent — pane, session, espace et nom.
      declarations: [declaration()],
      illisibles: [{ fichier: '(le registre entier)', cause: 'EACCES: permission denied' }],
      refusGlobal: 'EACCES: permission denied',
    },
  });

  assert.equal(rendu.agents[0].role.mesure, 'refusée');
  assert.match(rendu.agents[0].role.raison, /n’a pas pu être lu du tout/);
  // Les deux moitiés du rendu disent la même chose : rien n'a été établi.
  assert.equal(rendu.borne.sourceDeclaree.mesure, 'refusée');
  assert.equal(rendu.compte.roleDeclare, 0);
  assert.deepEqual(rendu.compte.parRoleDeclare, {});
  assert.doesNotMatch(rendu.resume, /DÉCLARÉ/);
  assert.equal(rendu.compte.roleNonMesure, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-octies UN REGISTRE MALADE NE NOIE PAS LE RENDU — la raison se compose PAR AGENT.
//
// 🔴 LA LISTE N'ÉTAIT BORNÉE PAR RIEN, et aucun banc n'en exerçait plus d'UN. Sur le parc réel,
// 63 des 83 agents sont sans lieu : chacun recevait la liste ENTIÈRE des illisibles. Vingt
// fichiers abîmés faisaient donc plus de mille fragments répétés — dans un rendu dont la ligne
// de résumé est ce qu'un humain lit. Le module borne déjà de la même façon partout ailleurs.
test('cent illisibles ne noient pas la raison d’un agent — trois sont nommés, le reste se compte', async () => {
  const beaucoup = Array.from({ length: 100 }, (_, i) => ({
    fichier: `2026082${i % 10}T000000000Z-abime-${i}.json`,
    cause: 'Unexpected end of JSON input',
  }));
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w9:p9', cwd: '/Users/qui/ailleurs' })],
    nomsConnus: nomsDe([['w9:p9', 'bonaventure']]),
    declarations: { declarations: [], illisibles: beaucoup },
  });

  const raison = rendu.agents[0].role.raison;
  assert.equal(rendu.agents[0].role.mesure, 'refusée');
  // Le COMPTE total reste dit : on ne cache pas l'ampleur, on cesse de la recopier.
  assert.match(raison, /100 déclaration\(s\) ILLISIBLE\(s\)/);
  // ⚠️ ET ICI RIEN N'A ÉTÉ TROUVÉ POUR CET AGENT : la queue « la sienne peut être dedans » est
  // donc VRAIE. C'est le contrôle négatif du correctif des queues — sans lui, on pourrait le
  // « corriger » jusqu'à supprimer une phrase qui est juste dans ce cas-ci.
  assert.match(raison, /la sienne peut être dedans/);
  // Trois nommés, pas cent — mesuré sur le texte, pas sur une constante recopiée du module.
  assert.equal(raison.match(/-abime-\d+\.json/g).length, 3);
  assert.match(raison, /et 97 autre\(s\)/);
  // ⚠️ ET LA COUPE SE DIT, avec l'endroit où la liste entière vit — sans quoi un lecteur croirait
  // avoir tout vu.
  assert.match(raison, /borne\.sourceDeclaree\.illisibles/);
  // La liste INTÉGRALE est là, calculée une seule fois pour tout le rendu.
  assert.equal(rendu.borne.sourceDeclaree.illisibles.length, 100);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-nonies UN RÔLE DÉCLARÉ QUE `roles.js` CONNAÎT SE NOMME PAR SON PLURIEL — SURVIVANTE.
//
// 🔴 LA BRANCHE DU MILIEU DE `libellesDuRoleDeclare` N'ÉTAIT EXERCÉE PAR RIEN. Les bancs ne
// déclaraient que `chef-equipe` (table figée) et un rôle hors table (le repli) : celle qui
// interroge `roles.js` — pour un rôle qui A un lieu mais se trouve déclaré — était nue. Muter
// `libelle_pluriel` en `libelle` laissait les 1 080 essais verts, et le résumé aurait rendu
// « 3 orchestrateur DÉCLARÉ(s) ».
test('un rôle déclaré que la table des rôles connaît se nomme par SON pluriel', async () => {
  const rendu = await recenser({
    panes: [pane(), pane({ pane_id: 'w2:p2', cwd: '/Users/qui/autre-arbre' })],
    nomsConnus: nomsDe([
      ['w1:p1', 't-20260825-0012'],
      ['w2:p2', 'p-20260822-0001'],
    ]),
    declarations: {
      declarations: [
        declaration({ role: 'orchestrateur' }),
        declaration({ nom: 'p-20260822-0001', role: 'orchestrateur', espace: '/Users/qui/autre-arbre', paneDeclare: 'w2:p2' }),
      ],
      illisibles: [],
    },
  });

  assert.equal(rendu.agents[0].role.mesure, 'déclarée');
  // ⚠️ LE LIBELLÉ VIENT DE `roles.js`, PAS D'UNE CHAÎNE RECOPIÉE ICI : un oracle écrit à la main
  // se corrigerait du même geste que le code, et ne garderait plus rien.
  assert.equal(rendu.agents[0].role.libelle, roleDe('orchestrateur').libelle);
  assert.deepEqual(rendu.compte.parRoleDeclare, { orchestrateur: 2 });
  // Le PLURIEL, dans la seule ligne qu'un humain lit.
  assert.match(rendu.resume, new RegExp(`DÉCLARÉS \\(jamais mesurés au lieu\\) : 2 ${roleDe('orchestrateur').libelle_pluriel}`));
  // ⚠️ ET IL N'EST PAS COMPTÉ COMME ÉTABLI : déclaré reste déclaré, même pour un rôle qui A un lieu.
  assert.equal(rendu.compte.parRole.orchestrateur, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-decies LE CONTRAT DE `libellesDuRoleDeclare` EST TOTAL — gardé par un essai, pas par le trafic.
//
// 🔴 SURVIVANTE. Sa branche du vide ne s'imprime JAMAIS sur les 1 082 essais : ses deux appelants
// ont déjà écarté le vide en amont. La remplacer par n'importe quoi laissait tout vert.
//
// ⚠️ ET LA RETIRER SURVIT AUSSI — mesuré. La branche est ÉQUIVALENTE au repli : `brut` valant
// `null`, `roleDe(null)` jette et le `catch` rend déjà `{ null, null }`. AUCUN banc ne peut donc
// tenir cette LIGNE, et prétendre le contraire serait la garantie non mesurée que ce lot a déjà
// payée une fois.
//
// 🔴 CE BANC TIENT LE CONTRAT, PAS LA LIGNE — c'est ce qu'il peut garder, et c'est ce qui compte :
// la fonction est EXPORTÉE, donc son contrat vaut pour l'appelant qu'elle n'a pas encore. Le jour
// où quelqu'un « simplifie » le repli, c'est lui qui rougira.
test('un rôle vide ne se NOMME pas — deux « null », jamais une chaîne qui se comparera', () => {
  for (const rien of [null, undefined, '', 0, false]) {
    assert.deepEqual(
      libellesDuRoleDeclare(rien),
      { libelle: null, pluriel: null },
      `« ${String(rien)} » ne nomme aucun rôle : rendre autre chose donnerait une valeur qui se compare`,
    );
  }
  // Et le contraire tient : un nom, même inconnu, se rend — nommer ne décide de rien.
  assert.deepEqual(libellesDuRoleDeclare('un-role-futur'), { libelle: 'un-role-futur', pluriel: 'un-role-futur' });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-undecies UN ESPACE NON MESURÉ NE DÉFAIT PAS UN LIEN — c'était le seul champ sans 3e état.
//
// 🔴 LES DEUX CLÉS PASSENT PAR L'ESPACE. Quand `foreground_cwd` ET `cwd` manquent,
// `memeEspaceDeTravail(null, …)` rend `false` inconditionnellement : un agent dont le pane, la
// session ET le nom concordent EXACTEMENT avec sa propre déclaration recevait la prose d'un
// agent JAMAIS DÉCLARÉ. Le repli par le nom — fait pour rattraper ce genre de cas — est borné
// par le même espace, donc il ne pouvait pas le sauver.
//
// ⚠️ ET LES 21 FABRIQUES DE PANE DU BANC FOURNISSENT TOUJOURS UN `cwd` : le chemin existait, il
// passait, il se lisait donc comme couvert.
test('un agent dont l’espace n’a pas pu être lu rend « refusée », jamais « non établi »', async () => {
  const sock = '/Users/qui/.config/herdr/sessions/somtech/herdr.sock';
  const sansEspace = {
    pane_id: 'w1:p1',
    agent: 'claude',
    agent_session: { agent: 'claude', kind: 'id', value: 'session-w1:p1' },
    agent_status: 'working',
    herdr_socket: sock,
    // ni `foreground_cwd`, ni `cwd` — herdr OMET les clés qu'il n'a pas.
  };
  const rendu = await recenser({
    panes: [sansEspace],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    // La déclaration concorde sur TOUT le reste : pane, session, nom.
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  assert.equal(rendu.agents[0].role.mesure, 'refusée');
  assert.match(rendu.agents[0].role.raison, /je n’ai pas pu lire où cet agent travaille/);
  // ⚠️ ET LA CONDUITE QUI EN DÉCOULE SE DIT : « pas trouvée » ne vaut pas « absente ».
  assert.match(rendu.agents[0].role.raison, /ne \s*vaut donc pas « absente »|ne vaut donc pas « absente »/);
  assert.equal(rendu.compte.roleNonMesure, 1);
  assert.equal(rendu.compte.roleNonEtabli, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-duodecies ON NE DIT PAS « AUCUNE NE L'APPARIE » QUAND ON EN A TROUVÉ UNE.
//
// 🔴 LES DEUX RAISONS S'OUVRAIENT SUR CETTE PHRASE, y compris quand une déclaration avait été
// trouvée et ne portait simplement pas de rôle. Le lecteur était alors envoyé chercher un
// fichier ÉTRANGER (« la sienne peut être dedans »), ou soupçonner un nom qui n'avait jamais été
// nécessaire — alors que sa déclaration était là, sous ses yeux, et muette sur le rôle.
//
// ⚠️ LE BANC QUI COUVRAIT CET ÉTAT NE REGARDAIT QUE `mesure` ET `/ILLISIBLE/` : l'état était
// atteint, la prose fausse passait dessous.
test('une déclaration trouvée mais sans rôle se DIT — on n’envoie pas chercher ailleurs', async () => {
  const nu = declaration();
  delete nu.role;
  const rendu = await recenser({
    panes: [pane()],
    nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
    declarations: {
      declarations: [nu],
      // Un illisible SANS RAPPORT avec cet agent — c'est vers lui qu'on l'envoyait.
      illisibles: [{ fichier: '20260101T000000000Z-un-autre.json', cause: 'Unexpected token' }],
    },
  });

  const raison = rendu.agents[0].role.raison;
  assert.equal(rendu.agents[0].role.mesure, 'refusée');
  assert.match(raison, /une déclaration l’apparie mais ne porte AUCUN rôle/);
  assert.match(raison, /inscrite le 2026-08-27T01:42:50\.192Z/);
  assert.doesNotMatch(raison, /aucune déclaration de naissance ne l’apparie/);
  // 🔴 ET LA QUEUE SUIT LA TÊTE. Le correctif précédent n'avait redressé que la tête : dessous
  // vivait encore « la sienne peut être dedans », affirmé juste après avoir dit qu'on venait de
  // la LIRE. La phrase se contredisait en son milieu, et envoyait ouvrir un fichier ÉTRANGER.
  assert.doesNotMatch(raison, /la sienne peut être dedans/);
  assert.match(raison, /sans rapport avec la sienne, qui a été lue/);
});

// ⚠️ ET LE MÊME MENSONGE PAR L'AUTRE PORTE : quand la PLACE a suffi à trouver la déclaration, on
// ne blâme pas un nom qui n'a jamais été nécessaire.
test('une déclaration trouvée par la PLACE ne fait pas accuser le nom non mesuré', async () => {
  const nu = declaration();
  delete nu.role;
  const rendu = await recenser({
    panes: [pane()],
    // Le nom a refusé — mais la place a suffi.
    nomsConnus: { mesure: 'refusée', raison: 'herdr agents() a refusé' },
    declarations: { declarations: [nu], illisibles: [] },
  });

  const raison = rendu.agents[0].role.raison;
  assert.match(raison, /une déclaration l’apparie mais ne porte AUCUN rôle/);
  assert.doesNotMatch(raison, /aucune déclaration de naissance ne l’apparie/);
  // 🔴 MÊME MOITIÉ, MÊME PORTE. « Le nom est la clé de repli » explique pourquoi une absence ne
  // conclut rien — un motif qui n'a de sens que si l'on n'a RIEN trouvé. Ici la PLACE a suffi :
  // le citer envoie soupçonner un instrument qui n'a joué aucun rôle.
  assert.doesNotMatch(raison, /le nom est la clé de repli/);
  assert.match(raison, /trouvée par sa PLACE, sans passer par son nom/);
});

// ⚠️ ET LA PROSE D'ORIGINE RESTE JUSTE QUAND ON N'A VRAIMENT RIEN TROUVÉ — sans quoi le
// correctif aurait remplacé un mensonge par son symétrique.
test('quand rien n’apparie vraiment, la raison le dit encore', async () => {
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w9:p9', cwd: '/Users/qui/ailleurs' })],
    nomsConnus: nomsDe([['w9:p9', 'bonaventure']]),
    declarations: {
      declarations: [declaration()],
      illisibles: [{ fichier: '20260101T000000000Z-x.json', cause: 'Unexpected token' }],
    },
  });

  assert.match(rendu.agents[0].role.raison, /aucune déclaration de naissance ne l’apparie/);
  // Contrôle négatif de la queue : rien trouvé ⇒ « la sienne peut être dedans » est JUSTE.
  assert.match(rendu.agents[0].role.raison, /la sienne peut être dedans/);
});

// ⚠️ ET LA SECONDE QUEUE AUSSI — sans quoi le correctif aurait pu la supprimer partout.
test('quand rien n’apparie et que le nom a refusé, la justification du repli revient', async () => {
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w9:p9', cwd: '/Users/qui/ailleurs' })],
    nomsConnus: { mesure: 'refusée', raison: 'herdr agents() a refusé' },
    declarations: { declarations: [declaration()], illisibles: [] },
  });

  const raison = rendu.agents[0].role.raison;
  assert.match(raison, /aucune déclaration de naissance ne l’apparie/);
  assert.match(raison, /le nom est la clé de repli/);
  assert.doesNotMatch(raison, /trouvée par sa PLACE/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-terdecies LA FRONTIÈRE DE LA COUPE SE MESURE SUR SA FRONTIÈRE — SURVIVANTE.
//
// 🔴 `>` MUTÉ EN `>=` SURVIVAIT. Les bancs employaient 1 et 100 illisibles ; à EXACTEMENT trois,
// le rendu disait « … et 0 autre(s) — tous nommés dans borne » : une phrase qui se contredit.
test('exactement trois illisibles se nomment tous, sans « et 0 autre »', async () => {
  const trois = Array.from({ length: 3 }, (_, i) => ({
    fichier: `20260827T00000000${i}Z-abime-${i}.json`,
    cause: 'Unexpected end of JSON input',
  }));
  const rendu = await recenser({
    panes: [pane({ pane_id: 'w9:p9', cwd: '/Users/qui/ailleurs' })],
    nomsConnus: nomsDe([['w9:p9', 'bonaventure']]),
    declarations: { declarations: [], illisibles: trois },
  });

  const raison = rendu.agents[0].role.raison;
  assert.equal(raison.match(/-abime-\d\.json/g).length, 3, 'les trois se nomment');
  assert.doesNotMatch(raison, /et 0 autre/);
  assert.doesNotMatch(raison, /borne\.sourceDeclaree\.illisibles/, 'rien n’a été coupé : on n’y renvoie pas');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-quaterdecies « LA PLUS RÉCENTE L'EMPORTE » SE VÉRIFIE CONTRE LE VRAI TRI, PAS UN TABLEAU
// RANGÉ À LA MAIN.
//
// 🔴 LE BANC QUI L'ÉPROUVAIT CONSTRUISAIT SA LISTE DÉJÀ TRIÉE. Il prouvait donc que
// `declarationDeLAgent` prend le PREMIER élément — pas que cet élément est le plus récent. Le tri
// vit chez le producteur (`lireLesDeclarations`, lot voisin) : un changement légitime de son
// comparateur ferait rendre un mandat PÉRIMÉ pour une place reprise, sans aucun rouge ici.
//
// ⚠️ ON ÉCRIT DONC DE VRAIS FICHIERS, DANS LE DÉSORDRE, et on laisse le VRAI producteur les
// relire. C'est la jointure entre les deux lots, et elle n'appartenait à personne.
test('la plus récente l’emporte — éprouvé contre le tri RÉEL du producteur', async () => {
  const racine = mkdtempSync(join(tmpdir(), 'declaration-tri-'));
  try {
    const { inscrireLaDeclaration, lireLesDeclarations } = await import(
      '../../naissance-representant/src/declaration.js'
    );
    const espace = '/Users/qui/worktrees/depot/20260827-000000';
    // Écrites dans le DÉSORDRE : la plus ancienne en dernier, pour que l'ordre du système de
    // fichiers ne puisse pas produire le bon résultat par accident.
    for (const [mandat, quand] of [
      ['T-DU-MILIEU', '2026-08-26T10:00:00.000Z'],
      ['T-LA-PLUS-RECENTE', '2026-08-27T10:00:00.000Z'],
      ['T-LA-PLUS-ANCIENNE', '2026-08-25T10:00:00.000Z'],
    ]) {
      inscrireLaDeclaration({
        nom: 't-20260825-0012',
        role: 'chef-equipe',
        mandat,
        coordonnateur: 'e-20260825-0002',
        espace,
        pane: 'w1:p1',
        session: 'somtech',
        racine,
        quand: new Date(quand),
      });
    }

    const rendu = await recenser({
      panes: [pane({ cwd: espace })],
      nomsConnus: nomsDe([['w1:p1', 't-20260825-0012']]),
      // Le VRAI lecteur, avec son VRAI tri — pas un tableau rangé ici.
      declarations: lireLesDeclarations({ racine }),
    });

    assert.equal(rendu.agents[0].role.mesure, 'déclarée');
    assert.equal(rendu.agents[0].role.mandat, 'T-LA-PLUS-RECENTE');
    assert.equal(rendu.agents[0].role.declaree_le, '2026-08-27T10:00:00.000Z');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑫-quindecies UN PARC MÊLÉ — la seule phrase que le dirigeant lit, sur le cas que cette story
// existe pour produire.
//
// 🔴 CE BANC MANQUAIT, ET SON ABSENCE A COÛTÉ NEUF TOURS DE REVUE. Les deux listes étaient
// jointes par le MÊME séparateur, et le mot qui distingue le déclaré du mesuré ne venait qu'À LA
// FIN. Mesuré :
//
//     1 représentants de clients, 1 orchestrateurs, 1 chefs d’équipe, 1 partenaire-transverse DÉCLARÉ(s)
//
// Quatre postes en liste plate, avec un qualificatif qui semble ne porter que sur le dernier :
// rien n'empêche d'y lire « 1 chefs d'équipe » comme un rôle ÉTABLI. C'est RA-VUE-006 violée par
// le module qui porte cette règle en commentaire.
//
// ⚠️ ET AUCUN BANC NE POUVAIT LE VOIR — c'est ce qui rend celui-ci nécessaire, et pas seulement
// utile. Tous ceux qui lisent la phrase posent `roleDuLieu: () => null` : elle s'ouvrait donc
// toujours sur le littéral « aucun rôle établi », qui lève l'ambiguïté par construction. Ceux qui
// font coexister établi et déclaré, eux, ne lisent que `compte`. Le défaut vivait dans
// l'INTERVALLE entre deux familles de bancs, chacune juste de son côté.
test('un parc MÊLÉ sépare les rôles mesurés des rôles déclarés, dans la phrase même', async () => {
  const orch = '/depot/.orchestrateur/p-20260822-0001';
  const repr = '/depot/.gestionnaire/Charles-Olivier';
  const lignes = [];
  const rendu = await recenser({
    panes: [
      pane({ pane_id: 'w1:p1', cwd: orch }),
      pane({ pane_id: 'w2:p2', cwd: repr }),
      pane({ pane_id: 'w3:p3', cwd: '/arbre/a' }),
      pane({ pane_id: 'w4:p4', cwd: '/arbre/b' }),
    ],
    roleDuLieu: (l) => (l === orch ? 'orchestrateur' : l === repr ? 'representant' : null),
    nomsConnus: nomsDe([
      ['w1:p1', 'matapedia'],
      ['w2:p2', 'bonaventure'],
      ['w3:p3', 't-20260825-0012'],
      ['w4:p4', 'p-20260822-0001'],
    ]),
    declarations: {
      declarations: [
        declaration({ nom: 't-20260825-0012', espace: '/arbre/a', paneDeclare: 'w3:p3' }),
        declaration({ nom: 'p-20260822-0001', role: 'partenaire-transverse', espace: '/arbre/b', paneDeclare: 'w4:p4' }),
      ],
      illisibles: [],
    },
    journaliser: (m) => lignes.push(m),
  });

  // Les quatre agents sont bien là, deux mesurés au lieu, deux déclarés.
  assert.equal(rendu.compte.parRole.orchestrateur, 1);
  assert.equal(rendu.compte.parRole.representant, 1);
  assert.equal(rendu.compte.roleDeclare, 2);

  // ⚠️ LE CŒUR : la frontière se lit AVANT les rôles qu'elle couvre, dans les DEUX sorties.
  const tranche = /; DÉCLARÉS \(jamais mesurés au lieu\) : 1 chefs d’équipe, 1 partenaire-transverse/;
  assert.match(rendu.resume, tranche);
  assert.match(lignes.join('\n'), /; déclarés \(jamais mesurés au lieu\) : 1 chefs d’équipe, 1 partenaire-transverse/);

  // ⚠️ ET AUCUN RÔLE DÉCLARÉ N'APPARAÎT DANS LA TRANCHE DES MESURÉS. C'est l'assertion qui tue la
  // liste plate : on découpe la phrase à la frontière et on regarde ce qu'il y a AVANT.
  const avantLaFrontiere = rendu.resume.split(' ; DÉCLARÉS')[0];
  assert.match(avantLaFrontiere, /1 représentants de clients, 1 orchestrateurs/);
  assert.doesNotMatch(avantLaFrontiere, /chefs d’équipe/);
  assert.doesNotMatch(avantLaFrontiere, /partenaire-transverse/);
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
  // ⚠️ `try/finally` DÈS LE `mkdtempSync` — et l'omettre ici était une garantie ÉCRITE mais non
  // VÉRIFIÉE : le commit qui a posé le `finally` du banc voisin affirmait avoir fermé LES DEUX
  // bacs. Un seul l'avait reçu. Un `rmSync` en dernière instruction ne s'exécute pas quand une
  // assertion jette — c'est-à-dire précisément quand la suite tourne le plus souvent.
  try {
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
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// LA VUE S'ORGANISE PAR ORCHESTRATEUR — SES EPICS, PUIS LES STORIES DE CHAQUE EPIC
// (E-20260822-0002, sous P-20260822-0001 — stories T-20260822-0013 et T-20260822-0014.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE BANC EXISTE PARCE QUE LA MUTATION A TROUVÉ CE QUE LA RELECTURE N'AVAIT PAS VU
//
// Le premier banc de ce lot (`la-vue-du-parc-joint-par-le-mandat`) est passé VERT DU PREMIER
// COUP, 8 essais sur 8. Il avait été écrit APRÈS le code : un test écrit après son code ne
// prouve rien, il DÉCRIT. Le rouge ne pouvait donc plus venir de l'ordre — il fallait
// l'obtenir par MUTATION.
//
// Contrôle négatif d'abord (copie NON mutée : 8 passés, 0 échec — aucun faux témoin), puis
// **dix mutations posées UN POINT À LA FOIS**. Six attrapées. **Quatre SURVIVANTES**, et ce
// fichier est né de ces quatre-là. Chacune serait passée en production :
//
//   (a) `attribution.agents.slice(0, 1)` au rendu — UN SEUL porteur affiché au lieu de tous.
//       Le premier banc lisait la STRUCTURE (`agents.map(a => a.nom)`) et jamais le TEXTE.
//   (b) `if (!epicsLus.length) continue;` — un orchestrateur SANS epic disparaissait de la vue,
//       alors que c'est mot pour mot le 3ᵉ G/W/T de T-20260822-0013.
//   (c) `if (false)` sur la détection des panes ambigus — la mesure était faite et JAMAIS gardée.
//   (d) le champ `epics` d'un chantier illisible passait de `null` à autre chose sans qu'un
//       banc rougisse — les trois états se repliaient en deux.
//
// ⚠️ LE MOTIF COMMUN DES QUATRE, ET C'EST LA LEÇON DE CE LOT : **mes assertions couvraient la
// DONNÉE et négligeaient le RENDU.** Or les trois conditions de l'arbitrage portent justement
// sur le rendu — le dirigeant lit une LIGNE, pas un champ JSON. Ce fichier lit donc le TEXTE.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unRecensement } from '../src/recensement.js';
import { roleDuLieu } from '../src/lieu-agent.js';
import { role as roleDe } from '../src/roles.js';
import { laVueDuParc, rendreLaVue, MOT_NON_ETABLI } from '../src/vue-du-parc.js';
import { unPaneDAgent } from './aide/formes-reelles.js';

const racine = () => mkdtempSync(join(tmpdir(), 'vue-par-orchestrateur-'));

const METIER = {
  orchestrateur: "# Tu es l'orchestrateur de ce chantier\n\nle métier du jour.\n",
  representant: '# Tu es le représentant de ce client\n\nle métier du jour.\n',
};
const CONTEXTE = {
  orchestrateur: '# Ce qui est propre à ce dépôt\n\nrien.\n',
  representant: "# Ce qu'on sait de ce client\n\nrien.\n",
};

/** Un lieu POSÉ POUR DE VRAI — un double non conforme fabrique les défauts qu'il devrait trouver. */
function poserLieu(depot, nomDuRole, nom) {
  const lieu = join(depot, roleDe(nomDuRole).dossier, nom);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), METIER[nomDuRole]);
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE[nomDuRole]);
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

function nomsLus(entrees) {
  return {
    mesure: 'lue',
    noms: new Map(entrees.map(([pane, nom, session]) => [`${session ?? ''}\u0000${pane}`, nom])),
  };
}

const recenser = (panes, noms) => unRecensement({ panes, roleDuLieu, nomsConnus: nomsLus(noms) });

/** La ligne du TEXTE rendu qui porte ce fragment — `undefined` si aucune. */
const ligneAvec = (texte, fragment) => texte.split('\n').find((l) => l.includes(fragment));

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0013, 1ᵉʳ G/W/T — L'ARBRE : l'orchestrateur, ses epics, leurs stories
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la vue rend l’arbre demandé : l’orchestrateur en tête, ses epics dessous, les stories de chaque epic sous cet epic', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await recenser([unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })], [['w1:p1', 'kamouraska', undefined]]);
  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => ({
      code,
      titre: 'Voir qui travaille sur quoi',
      epics: [
        {
          code: 'E-20260822-0001',
          titre: 'Le recensement porte tous les rôles',
          stories: [
            { code: 'T-20260822-0009', titre: 'Le rôle se lit au lieu' },
            { code: 'T-20260822-0011', titre: 'Sans nom, rendu comme tel' },
          ],
        },
      ],
    }),
  });

  const lignes = rendreLaVue(vue).split('\n');
  const iOrch = lignes.findIndex((l) => l.includes('kamouraska'));
  const iEpic = lignes.findIndex((l) => l.includes('E-20260822-0001'));
  const iS1 = lignes.findIndex((l) => l.includes('T-20260822-0009'));
  const iS2 = lignes.findIndex((l) => l.includes('T-20260822-0011'));

  // ⚠️ L'ORDRE EST LA FORME DEMANDÉE, et il se lit dans le TEXTE. Une structure correcte rendue
  // à plat — toutes les stories après tous les epics — satisferait n'importe quelle assertion
  // portée sur la donnée, et ne serait pas l'arbre que le dirigeant a demandé.
  assert.ok(iOrch >= 0 && iEpic > iOrch, 'l’epic se lit SOUS son orchestrateur');
  assert.ok(iS1 > iEpic && iS2 > iEpic, 'et les stories SOUS leur epic');
  // L'indentation porte la hiérarchie à l'œil : une story est plus en retrait que son epic.
  const creux = (l) => l.length - l.trimStart().length;
  assert.ok(creux(lignes[iS1]) > creux(lignes[iEpic]), 'une story est plus en retrait que son epic');
  assert.ok(creux(lignes[iEpic]) > creux(lignes[iOrch]), 'et un epic plus qu’un orchestrateur');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0013, 2ᵉ G/W/T — CHAQUE LIGNE PORTE LE NOM DE L'AGENT (EF-VUE-003)
//
// 🔴 GARDE DE LA SURVIVANTE (a) : `attribution.agents.slice(0, 1)` au rendu.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('chaque ligne porte le nom PROPRE de l’agent, et TOUS les porteurs y sont — pas seulement le premier', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');
  const lieuOrch = poserLieu(d, 'orchestrateur', 'p-20260822-0001');
  const lieuEpic = poserLieu(d, 'orchestrateur', 'e-20260822-0002');
  const lieuStory = poserLieu(d, 'orchestrateur', 't-20260822-0012');

  const rendu = await recenser(
    [
      unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieuOrch }),
      // DEUX agents portent le mandat de l'epic — mesuré sur le poste (`w8W:p1`/`w8W:p2`).
      unPaneDAgent({ pane_id: 'w2:p1', foreground_cwd: lieuEpic }),
      unPaneDAgent({ pane_id: 'w2:p2', foreground_cwd: lieuEpic }),
      unPaneDAgent({ pane_id: 'w3:p1', foreground_cwd: lieuStory }),
    ],
    [
      ['w1:p1', 'kamouraska', undefined],
      ['w2:p1', 'castor', undefined],
      ['w2:p2', 'bernache', undefined],
      ['w3:p1', 'huard', undefined],
    ]
  );

  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => ({
      code,
      epics: [{ code: 'E-20260822-0002', titre: 'La vue du parc', stories: [{ code: 'T-20260822-0012', titre: 'Joindre' }] }],
    }),
  });

  const texte = rendreLaVue(vue);
  const ligneEpic = ligneAvec(texte, 'E-20260822-0002');
  const ligneStory = ligneAvec(texte, 'T-20260822-0012');

  // 🔴 LA GARDE QUI MANQUAIT : les DEUX porteurs se lisent sur la ligne. `slice(0, 1)` en
  // rendrait un seul, et le banc de la structure resterait vert — c'est la survivante (a).
  assert.ok(ligneEpic.includes('castor'), 'le premier porteur est nommé sur la ligne de l’epic');
  assert.ok(ligneEpic.includes('bernache'), 'ET le second aussi — aucun n’est écarté au rendu');
  assert.ok(ligneStory.includes('huard'), 'la story porte le nom de son propre agent');
  // Le nom PROPRE, pas seulement le code du ticket : la ligne dit qui, pas seulement quoi.
  assert.ok(!ligneStory.includes(MOT_NON_ETABLI), 'et son porteur est bien établi, pas rendu inconnu');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0013, 3ᵉ G/W/T — UN ORCHESTRATEUR SANS EPIC N'EST PAS UN ORCHESTRATEUR ABSENT
//
// 🔴 GARDE DE LA SURVIVANTE (b) : `if (!epicsLus.length) continue;`.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un orchestrateur dont le chantier ne porte aucun epic APPARAÎT quand même — avec son chantier et rien dessous', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0009');

  const rendu = await recenser([unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })], [['w1:p1', 'nicolet', undefined]]);
  const vue = await laVueDuParc({ recensement: rendu, lireChantier: async (code) => ({ code, epics: [] }) });

  assert.equal(vue.orchestrateurs.length, 1, 'il figure dans la donnée');
  const texte = rendreLaVue(vue);
  // 🔴 ET DANS LE TEXTE — c'est là que la survivante (b) le faisait disparaître.
  const ligne = ligneAvec(texte, 'nicolet');
  assert.ok(ligne, 'l’orchestrateur sans epic se LIT dans la vue : il n’est pas omis');
  assert.ok(ligne.includes('P-20260822-0009'), 'et son chantier est nommé');
  // ⚠️ « aucun epic » MESURÉ ne se rend pas comme « pas pu lire » — les deux ne se confondent pas.
  assert.ok(texte.includes('aucun epic'), 'le vide est DIT, comme un fait et non comme un trou');
  assert.ok(!texte.includes('n’ont pas pu être lus'), 'et surtout pas comme un échec de mesure');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 GARDE DE LA SURVIVANTE (d) — LES TROIS ÉTATS NE SE REPLIENT PAS EN DEUX
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un chantier ILLISIBLE ne se rend PAS comme un chantier VIDE — « je n’ai pas pu lire » ≠ « il n’y en a aucun »', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');
  const lieuMuet = poserLieu(d, 'orchestrateur', 'p-20260822-0007');
  const lieuVide = poserLieu(d, 'orchestrateur', 'p-20260822-0008');

  const rendu = await recenser(
    [
      unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieuMuet }),
      unPaneDAgent({ pane_id: 'w1:p2', foreground_cwd: lieuVide }),
    ],
    [
      ['w1:p1', 'illisible', undefined],
      ['w1:p2', 'vide', undefined],
    ]
  );

  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => {
      if (code === 'P-20260822-0007') throw new Error('HTTP 503');
      return { code, epics: [] };
    },
  });

  const muet = vue.orchestrateurs.find((o) => o.agent.nom === 'illisible');
  const vide = vue.orchestrateurs.find((o) => o.agent.nom === 'vide');
  assert.ok(muet && vide, 'préalable : les deux orchestrateurs sont dans la vue');

  // ⚠️ `null` ET `[]` NE SONT PAS INTERCHANGEABLES ICI, et c'est tout l'objet de ce banc.
  assert.equal(muet.epics, null, '« pas pu lire » se rend `null`');
  assert.deepEqual(vide.epics, [], '« lu, il n’y en a aucun » se rend `[]`');
  assert.equal(muet.chantier.mesure, 'non mesurée');
  assert.ok(muet.chantier.raison.includes('503'), 'et la CAUSE voyage : sans elle, on cherche au mauvais endroit');

  const texte = rendreLaVue(vue);
  // Et les deux lignes ne se lisent pas pareil non plus — sinon la distinction meurt au rendu.
  assert.ok(texte.includes('n’ont pas pu être lus'), 'le chantier illisible le DIT');
  assert.ok(texte.includes('aucun epic'), 'le chantier vide dit autre chose');
});

test('un registre en panne ne se rend PAS comme un parc désert — la borne du recensement traverse la vue', async () => {
  // ⚠️ LE DÉFAUT QUE CE BANC FERME EST LE PLUS COÛTEUX DE TOUS : une vue parfaitement verte,
  // parfaitement vide, sur un poste où plus rien n'est mesuré. Le lecteur en conclut que
  // personne ne travaille — alors que personne n'a REGARDÉ.
  const vue = await laVueDuParc({
    recensement: { quand: 'T', inventaireRefuse: 'herdr est introuvable', agents: null },
  });

  assert.equal(vue.orchestrateurs, null, '`null`, PAS `[]` — la garde du recensement, reprise ici');
  assert.equal(vue.registre.mesure, 'refusé');
  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('herdr est introuvable'), 'la cause est rendue');
  assert.ok(!/personne ne travaille(?! »)/.test(texte.replace(/Ce n’est pas « personne ne travaille »/g, '')),
    'et rien n’affirme que personne ne travaille');
});

test('la borne du recensement — le compte est un PLANCHER, les sessions muettes restent nommées — n’est pas perdue par la vue', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await unRecensement({
    // La forme à enveloppe : une session injoignable ne fait pas échouer le tour, mais son
    // absence se PAIE en panes non vus — et sans cette borne, l'amputation serait invisible.
    panes: () => ({
      panes: [unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })],
      sessionsInterrogees: 3,
      sessionsRefusees: [{ session: 'muette.sock', raison: 'no herdr server' }],
    }),
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', 'kamouraska', undefined]]),
  });

  const vue = await laVueDuParc({ recensement: rendu, lireChantier: async (code) => ({ code, epics: [] }) });
  const texte = rendreLaVue(vue);

  // ⚠️ « plancher » EXIGE que les panes soient DÉCIDABLES. La nature bascule en « incertaine »
  // dès qu'un pane ne dit pas s'il porte un agent — c'est ce qu'a rendu ce banc tant qu'il
  // posait une forme que la source ne produit pas. Asserter « plancher » garde donc DEUX choses
  // d'un coup : que la borne traverse la vue, et que les doubles de ce fichier restent conformes.
  assert.equal(vue.borne?.nature, 'plancher', 'la borne traverse la vue sans être réécrite');
  assert.ok(vue.resume.includes('amputé'), 'et le résumé de la VUE dit lui aussi l’amputation');
  assert.ok(texte.includes('PLANCHER'), 'le texte rendu porte le mot qui empêche de le lire comme un total');
  assert.ok(texte.includes('muette.sock'), 'et la session qui n’a pas répondu est NOMMÉE');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0014 — HORS DE TOUTE HIÉRARCHIE D'ORCHESTRATEUR (EF-VUE-004)
//
// ⚠️ LA CONDITION DE FIN N°2 A ÉTÉ CORRIGÉE LE 2026-08-22 SUR CETTE MESURE. Elle disait que
// les partenaires transverses (« infra-ops », « architecte ») figurent hors hiérarchie. Mesuré :
// les quatre agents qui portent ces libellés — `w7`, `w1E`, `w7H`, `w87` — ont TOUS `lieu=null`,
// `mandat=null` et un rôle NON ÉTABLI. **« infra-ops » est un NOM D'AGENT, pas un lieu** : ils
// sont indiscernables des 81 autres. La condition est donc : ils figurent, avec leur rôle rendu
// NON ÉTABLI quand aucun lieu ne le porte — jamais déduit de leur libellé.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un agent qui ne relève d’aucun orchestrateur figure hors hiérarchie — et son domaine est NON ÉTABLI, jamais déduit de son libellé', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');
  const lieuOrch = poserLieu(d, 'orchestrateur', 'p-20260822-0001');
  const lieuRep = poserLieu(d, 'representant', 'Charles-Olivier');

  const rendu = await recenser(
    [
      unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieuOrch }),
      unPaneDAgent({ pane_id: 'w2:p1', foreground_cwd: lieuRep }),
      // La forme MESURÉE des quatre « partenaires » : un nom qui dit un domaine, et aucun lieu.
      { pane_id: 'w7:p1', foreground_cwd: join(tmp, 'un-worktree-ordinaire') },
    ],
    [
      ['w1:p1', 'kamouraska', undefined],
      ['w2:p1', 'charles-olivier', undefined],
      ['w7:p1', 'infra-ops', undefined],
    ]
  );

  const vue = await laVueDuParc({ recensement: rendu, lireChantier: async (code) => ({ code, epics: [] }) });
  const texte = rendreLaVue(vue);

  const infra = vue.horsHierarchie.find((p) => p.agent.nom === 'infra-ops');
  const rep = vue.horsHierarchie.find((p) => p.agent.nom === 'charles-olivier');

  assert.ok(infra, 'il FIGURE — l’omettre laisserait croire qu’il n’existe pas');
  // 🔴 LE CŒUR DE LA CONDITION CORRIGÉE : son nom DIT « infra-ops », et pourtant son domaine
  // reste non établi. Déduire le domaine du libellé est exactement ce que RA-VUE-005 interdit.
  assert.equal(infra.domaine.mesure, 'non établi', 'son domaine n’est PAS déduit de son nom');
  assert.equal(infra.domaine.role, null);
  const ligne = ligneAvec(texte, 'infra-ops');
  assert.ok(ligne.includes(MOT_NON_ETABLI), 'et la LIGNE le dit non établi');

  // Le représentant, lui, a un lieu : son domaine se lit. Sans ce contraste, la garde
  // ci-dessus passerait sur un module qui rendrait « non établi » pour tout le monde.
  assert.equal(rep.domaine.mesure, 'lu');
  assert.equal(rep.domaine.role, 'representant');

  // Et l'orchestrateur n'y est PAS : il a sa hiérarchie, l'y remettre le compterait deux fois.
  assert.ok(!vue.horsHierarchie.some((p) => p.agent.nom === 'kamouraska'), 'un orchestrateur n’est pas hors hiérarchie');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0014, 3ᵉ G/W/T — DEUX ENTRÉES QUI POURRAIENT ÊTRE LE MÊME AGENT
//
// 🔴 GARDE DE LA SURVIVANTE (c) : la détection était faite et JAMAIS gardée — `if (false)`
// passait les huit essais du premier banc.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('deux entrées portant le même identifiant de pane dans des sessions différentes sont TOUTES DEUX rendues — rien ne prétend que c’est un seul agent', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  // Mesuré le 2026-08-22 sur les 98 entrées du recensement de ce poste : `w7:p1` vit dans
  // `somtech` ET dans `progex`, `w6:p1` dans `cg` ET dans `progex`, avec des noms différents.
  // ⚠️ LE DÉNOMINATEUR SE DIT : deux sur ces 98 entrées-là. Une mesure d'un autre jour, sur une
  // autre population, en a trouvé un autre nombre — ce ne sont pas deux comptes contradictoires,
  // ce sont deux ensembles. Un compte sans son ensemble est un fait invérifiable.
  const rendu = await unRecensement({
    panes: () => ({
      panes: [
        unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu, herdr_socket: 'A.sock' }),
        { pane_id: 'w7:p1', foreground_cwd: join(tmp, 'ailleurs'), herdr_socket: 'A.sock' },
        { pane_id: 'w7:p1', foreground_cwd: join(tmp, 'ailleurs'), herdr_socket: 'B.sock' },
      ],
      sessionsInterrogees: 2,
      sessionsRefusees: [],
    }),
    roleDuLieu,
    nomsConnus: nomsLus([
      ['w1:p1', 'kamouraska', 'A.sock'],
      ['w7:p1', 'infra-ops', 'A.sock'],
      ['w7:p1', 'autre-chose', 'B.sock'],
    ]),
  });

  const vue = await laVueDuParc({ recensement: rendu, lireChantier: async (code) => ({ code, epics: [] }) });

  // Les DEUX entrées survivent — une clé sans la session en aurait fait une seule, et lui
  // aurait prêté le nom de l'autre. Un nom d'affichage faux est pire qu'un nom absent : on
  // lui PARLE.
  const deux = vue.horsHierarchie.filter((p) => p.agent.pane === 'w7:p1');
  assert.equal(deux.length, 2, 'les deux entrées sont rendues, rien ne les fusionne');
  assert.deepEqual(deux.map((p) => p.agent.nom).sort(), ['autre-chose', 'infra-ops']);

  // 🔴 ET L'AMBIGUÏTÉ EST DÉCLARÉE — c'est la survivante (c). Sans cette garde, `if (false)`
  // supprimait toute la section et les huit essais du premier banc restaient verts.
  assert.equal(vue.panesAmbigus.length, 1, 'l’ambiguïté est relevée');
  assert.equal(vue.panesAmbigus[0].pane, 'w7:p1');
  assert.equal(vue.compte.entreesComparees, 3, 'et le DÉNOMINATEUR voyage avec le compte');

  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('AMBIGUS'), 'la vue le DIT au lecteur');
  assert.ok(texte.includes('A.sock') && texte.includes('B.sock'), 'et nomme les deux sessions');
  // Le mot compte : rien n'affirme que c'est le même agent, rien n'affirme que ce sont deux.
  assert.ok(
    vue.panesAmbigus[0].pourquoi.includes('n’a pas été mesuré'),
    'la question reste ouverte parce qu’elle l’est'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 DEUX SURVIVANTES DE PLUS, TROUVÉES EN REPOSANT LA MUTATION CORRECTEMENT
//
// La première campagne avait rendu « (d) survivante » sur le champ `epics` d'un chantier
// illisible. **C'était un artefact** : la mutation ajoutait un champ voisin sans jamais toucher
// `epics: null`, et le harnais ne l'a pas signalé — un motif absent y passe SANS erreur, donc
// une mutation qui ne mute rien se lit exactement comme une garde qui tient.
//
// Reposée par NUMÉRO DE LIGNE, insensible aux apostrophes typographiques qui avaient fait
// échouer le motif, la mutation a rendu son vrai verdict : le cas illisible est ATTRAPÉ, et
// **deux AUTRES cas ne l'étaient pas** — ceux-ci, que ces deux bancs ferment.
//
// ⚠️ MÊME FAMILLE QUE LES QUATRE PREMIÈRES : des PERTES SILENCIEUSES. Aucune ne produit
// d'erreur ; chacune rend quelque chose de plausible et de faux. C'est le défaut même que cet
// outil existe pour révéler, DANS l'outil.

test('un orchestrateur dont le mandat n’est pas un code garde `epics: null` — on n’a rien lu, donc on ne dit pas « il n’y en a aucun »', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'matapedia');

  const rendu = await recenser([unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })], [['w1:p1', 'matapedia', undefined]]);
  const vue = await laVueDuParc({ recensement: rendu, lireChantier: async (code) => ({ code, epics: [] }) });

  const o = vue.orchestrateurs[0];
  // ⚠️ LA NUANCE EST FINE ET ELLE COMPTE : son chantier n'est pas un code, donc le ServiceDesk
  // n'a même pas été interrogé. Rendre `[]` affirmerait « je suis allé voir, il n'a pas d'epic »
  // pour un chantier qu'on n'a JAMAIS cherché. `null` dit la vérité : on ne sait pas.
  assert.equal(o.epics, null, 'aucune lecture n’a eu lieu : ce n’est pas « aucun epic »');
  const texte = rendreLaVue(vue);

  // 🔴 TROIS FAITS, TROIS PHRASES — et `epics: null` en recouvre DEUX qu'il ne faut pas
  // confondre. Défaut vu sur le rendu réel du poste : `matapedia` affichait « ses epics n'ont
  // pas pu être lus » alors que RIEN n'avait échoué — son mandat n'est pas un code, il n'y
  // avait simplement rien à chercher. Un faux échec d'instrument envoie chercher une panne
  // inexistante et noie les vrais échecs dans son bruit.
  assert.ok(texte.includes('aucun epic à chercher'), 'la vraie raison est dite : il n’y avait rien à chercher');
  assert.ok(!texte.includes('n’ont pas pu être lus'), 'et surtout PAS un échec de lecture qui n’a pas eu lieu');
  assert.ok(!/\(aucun epic — mesuré/.test(texte), 'ni « aucun epic » tout court, qui prétendrait qu’on a compté zéro');
});

test('sans accès au ServiceDesk, la vue garde `epics: null` et NOMME la cause — jamais un parc sans travail', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await recenser([unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })], [['w1:p1', 'kamouraska', undefined]]);
  // ⚠️ LE CAS RÉEL, PAS UN CAS CONSTRUIT : `accesServiceDesk()` rend `null` dès qu'aucune clé
  // n'est présente — c'est l'état de tout poste sans `SOMTECH_DESK_API_KEY`, et de la CI.
  const vue = await laVueDuParc({ recensement: rendu, lireChantier: null });

  const o = vue.orchestrateurs[0];
  assert.equal(o.epics, null, '« pas d’accès » ne se rend PAS comme « aucun epic »');
  assert.equal(o.chantier.mesure, 'non mesurée');
  assert.ok(o.chantier.raison.includes('aucun accès'), 'et la cause est nommée, pas devinée');
  assert.equal(vue.compte.chantiersNonMesures, 1, 'le compte le porte aussi');

  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('NON MESURÉ'), 'le texte dit qu’on n’a pas mesuré');
  assert.ok(!texte.includes('aucun epic'), 'et surtout pas qu’il n’y a pas de travail');
});

test('des stories ILLISIBLES ne se rendent pas comme un epic SANS story — et l’arbre reste lisible quand une fratrie en compte plusieurs', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await recenser([unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })], [['w1:p1', 'kamouraska', undefined]]);
  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => ({
      code,
      epics: [
        // `stories: null` — le lecteur de chantier le rend quand l'appel aux tickets a échoué.
        { code: 'E-20260822-0001', titre: 'stories illisibles', stories: null },
        { code: 'E-20260822-0002', titre: 'deux stories', stories: [{ code: 'T-1' }, { code: 'T-2' }] },
        { code: 'E-20260822-0003', titre: 'aucune story', stories: [] },
      ],
    }),
  });

  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('n’ont pas pu être lues'), '« pas pu lire les stories » se DIT');

  // ⚠️ ET L'EPIC SANS STORY NE DIT PAS LA MÊME CHOSE — sinon les deux se confondent au rendu,
  // qui est le seul endroit où le dirigeant les distingue.
  const lignes = texte.split('\n');
  const iVide = lignes.findIndex((l) => l.includes('E-20260822-0003'));
  assert.ok(!lignes[iVide + 1]?.includes('pas pu être lues'), 'un epic sans story ne prétend pas être illisible');

  // ⚠️ L'ARBRE RESTE RATTACHABLE À L'ŒIL : le dernier d'une fratrie se FERME, les autres se
  // continuent. Sans cette distinction, une story de l'epic 2 se lit comme une story de l'epic 3.
  const iE1 = lignes.findIndex((l) => l.includes('E-20260822-0001'));
  const iE3 = lignes.findIndex((l) => l.includes('E-20260822-0003'));
  assert.ok(lignes[iE1].includes('├─'), 'un epic qui n’est pas le dernier se CONTINUE');
  assert.ok(lignes[iE3].includes('└─'), 'le dernier epic se FERME');
  const iT1 = lignes.findIndex((l) => l.includes('T-1'));
  const iT2 = lignes.findIndex((l) => l.includes('T-2'));
  assert.ok(lignes[iT1].includes('├─') && lignes[iT2].includes('└─'), 'et la fratrie des stories aussi');
  assert.ok(lignes[iT1].includes('│'), 'le trait vertical rattache la story à un epic qui n’est pas le dernier');
});

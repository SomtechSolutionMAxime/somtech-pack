// LES DEUX JOINTURES DE PRODUCTION DE LA VUE — le titre de fenêtre, et les lieux versionnés.
// (E-20260822-0003 — T-20260822-0015 / 0017.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE FICHIER EXISTE PARCE QUE QUINZE BANCS VERTS NE PROUVAIENT RIEN EN PRODUCTION
//
// `vue-du-parc.js` reçoit TOUTE son I/O par paramètre — c'est ce qui le rend éprouvable sans
// clé et sans agent vivant. Le prix de ce choix est qu'un banc peut couvrir le module ENTIER
// pendant que le CÂBLAGE qui l'alimente n'existe pas :
//
//   ① `adresseDe` rend `titre: carte.titre` ; `recensement.js` ne lisait `terminal_title`
//      NULLE PART. Mesuré à l'écriture de ce fichier : zéro occurrence dans `src/`. Les quinze
//      bancs de l'adressabilité passaient sur des doubles qui portaient un titre que la vraie
//      source ne fournissait jamais. **Le dirigeant aurait lu « sans titre de fenêtre » sur
//      chacune des lignes de son parc**, et c'est le titre qui est la raison d'être de la story.
//
//   ② `laVueDuParc` accepte `lieux` ; le veilleur ne les lui passait pas. La vue serait restée
//      exactement celle d'hier — celle qui perd six chantiers sur quinze — avec un module
//      parfaitement gardé et un résumé qui aurait dit « aucun lecteur de lieux ».
//
// > **Ce sont les deux mêmes arêtes que le lot précédent a payées** : « le module était juste,
// > le veilleur était juste ; c'est le PASSAGE de l'un à l'autre qui n'appartenait à aucun banc. »
// > Elles ne se trouvent pas en relisant. Elles se trouvent en EXERÇANT la chaîne entière.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unRecensement } from '../src/recensement.js';
import { Veilleur } from '../src/veilleur.js';
import { lecteurDeLieux } from '../src/vue-du-parc.js';
import { unPaneDAgent } from './aide/formes-reelles.js';

let bac;
before(() => {
  bac = mkdtempSync(join(tmpdir(), 'registre-durable-'));
});
after(() => rmSync(bac, { recursive: true, force: true }));

// ═══════════════════════════════════════════════════════════════════════════════════════
// ① LE TITRE DE FENÊTRE TRAVERSE DEPUIS LA SOURCE — sans quoi l'adressabilité est vide
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le recensement PORTE le titre de fenêtre que herdr rend — sinon la vue n’a rien à afficher', async () => {
  // ⚠️ LA FORME EST CELLE QUE `herdr pane list` REND VRAIMENT, mesurée le 2026-08-22 : la clé
  // s'appelle `terminal_title`, et 73 panes sur 76 la portent.
  const r = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w8X:p6', terminal_title: '◐ Kamouraska orchestrateur P-20260822-0001' })],
    roleDuLieu: () => null,
    references: {},
  });

  assert.equal(r.agents.length, 1);
  assert.equal(
    r.agents[0].titre,
    '◐ Kamouraska orchestrateur P-20260822-0001',
    'le titre doit TRAVERSER : c’est la seule chose que le dirigeant reconnaît à l’œil'
  );
});

test('un pane SANS titre de fenêtre rend `titre: null` — la clé absente ne devient pas « undefined »', async () => {
  // Mesuré : 3 panes sur 76 n'ont PAS la clé. `undefined` fuit jusque dans le texte rendu.
  //
  // ⚠️ UN PANE **D'AGENT** SANS TITRE, PAS UN PANE SANS AGENT. La première version de ce banc
  // employait `unPaneSansAgent` — que le recensement ÉCARTE à juste titre, parce que c'est un
  // terminal. Il mesurait donc « un terminal n'entre pas au registre », sous le titre « un
  // agent sans titre rend null » : un objet mesuré, un autre conclu.
  const r = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w3:p5' })],
    roleDuLieu: () => null,
    references: {},
  });
  assert.equal(r.agents.length, 1);
  assert.equal(r.agents[0].titre, null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ② LE LECTEUR DE LIEUX — le registre DURABLE, lu au disque
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Pose un lieu d'orchestrateur COMPLET — les QUATRE fichiers que `roleDuLieu` exige.
 *
 * ⚠️ LES QUATRE, PAS LES DEUX QU'ON REMARQUE. La première version n'écrivait que `CLAUDE.md` et
 * `CONTEXTE.md` — les deux dont `roles.js` déclare les en-têtes — et le VRAI `roleDuLieu`
 * écartait le lieu, à juste titre : `GABARITS` en exige quatre. Les bancs qui INJECTENT
 * `roleDuLieu` ne le voyaient pas ; celui qui exerce le lecteur PAR DÉFAUT l'a vu tout de suite.
 * Un double qui ne satisfait pas la vraie règle fabrique des défauts (T-20260819-0070).
 */
function poseUnLieu(racine, mandat) {
  const d = join(racine, '.orchestrateur', mandat);
  mkdirSync(join(d, '.claude'), { recursive: true });
  // ⚠️ APOSTROPHE DROITE, PAS TYPOGRAPHIQUE — l'en-tête que `roles.js` exige est
  // `/^# Tu es l'orchestrateur de ce chantier/`, avec un `'` ASCII. Écrire `’` ici rend un
  // fichier qui SE LIT pareil et que la règle REFUSE : le lieu est écarté, et le banc accuse
  // le lecteur au lieu de son propre double. Vérifié en interrogeant la regex, pas à l'œil.
  writeFileSync(join(d, 'CLAUDE.md'), "# Tu es l'orchestrateur de ce chantier\n");
  writeFileSync(join(d, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n');
  writeFileSync(join(d, '.mcp.json'), '{}\n');
  writeFileSync(join(d, '.claude', 'settings.json'), '{}\n');
  return d;
}

test('le lecteur de lieux trouve les lieux d’orchestrateur des racines qu’on lui donne', async () => {
  const racine = join(bac, 'depot-a');
  poseUnLieu(racine, 'p-20260822-0001');
  poseUnLieu(racine, 'd-20260813-0005');

  const lu = await lecteurDeLieux({ racines: [racine], roleDuLieu: () => 'orchestrateur' })();

  assert.equal(lu.mesure, 'lue');
  assert.deepEqual(
    lu.entrees.map((e) => e.mandat).sort(),
    ['d-20260813-0005', 'p-20260822-0001']
  );
  assert.deepEqual(lu.racines, [racine]);
});

test('LE MÊME MANDAT DANS PLUSIEURS DÉPÔTS EST UN SEUL CHANTIER — mesuré : 116 chemins pour 15 mandats', async () => {
  // 🔴 SANS CETTE FUSION, LE PARC SE DÉMULTIPLIE. Sur ce poste, `d-20260813-0005` porte DOUZE
  // lieux — un par worktree du même dépôt. Rendre douze chantiers là où il y en a un est pire
  // que n'en rendre aucun : le dirigeant ne peut plus compter ce qu'il lit.
  const a = join(bac, 'wt-1');
  const b = join(bac, 'wt-2');
  poseUnLieu(a, 'd-20260813-0005');
  poseUnLieu(b, 'd-20260813-0005');

  const lu = await lecteurDeLieux({ racines: [a, b], roleDuLieu: () => 'orchestrateur' })();

  assert.equal(lu.entrees.length, 1, 'un mandat, une entrée');
  assert.equal(lu.entrees[0].chemins.length, 2, 'et les DEUX chemins sont gardés : ils disent où il vit');
});

test('un dossier au bon nom SANS le métier n’est pas un lieu — le rôle s’établit par le CONTENU', async () => {
  // ⚠️ MÊME RÈGLE QUE LE RECENSEMENT (T-20260819-0070) : un répertoire vide au bon nom ne porte
  // aucun métier, et le compter gonflerait la vue de chantiers qui n’existent qu’à moitié.
  const racine = join(bac, 'depot-vide');
  mkdirSync(join(racine, '.orchestrateur', 'p-fantome'), { recursive: true });

  const lu = await lecteurDeLieux({ racines: [racine], roleDuLieu: () => null })();

  assert.deepEqual(lu.entrees, [], 'le nom du dossier ne suffit pas');
});

test('une racine ILLISIBLE ne se rend pas comme « aucun lieu » — la panne de mesure se dit', async () => {
  // 🔴 ON ÉPROUVE LA PANNE DE LA MESURE, PAS SEULEMENT L'ABSENCE. Une racine qui jette, repliée
  // en zéro, ferait rendre un parc amputé avec l'apparence d'un parc complet.
  const bonne = join(bac, 'depot-b');
  poseUnLieu(bonne, 'p-20260822-0001');

  const lu = await lecteurDeLieux({
    racines: [bonne, join(bac, 'nexiste-pas')],
    roleDuLieu: () => 'orchestrateur',
  })();

  assert.equal(lu.entrees.length, 1, 'ce qui a pu être lu est rendu');
  assert.equal(lu.racinesRefusees.length, 1, 'et ce qui n’a PAS pu l’être est NOMMÉ, pas tu');
  assert.match(lu.racinesRefusees[0].racine, /nexiste-pas/);
});

test('AUCUNE racine lisible : la mesure est REFUSÉE, jamais « il n’y a aucun lieu »', async () => {
  const lu = await lecteurDeLieux({
    racines: [join(bac, 'ni-celle-ci'), join(bac, 'ni-celle-la')],
    roleDuLieu: () => 'orchestrateur',
  })();

  assert.equal(lu.mesure, 'refusée', 'zéro racine lue ⇒ on n’a RIEN mesuré, et on le dit');
  assert.equal(lu.entrees, null, '`[]` affirmerait « j’ai regardé, il n’y en a pas »');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ③ LE VEILLEUR PASSE VRAIMENT LES LIEUX À LA VUE — l'arête que personne ne gardait
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le veilleur DONNE les lieux à la vue — sans quoi elle perd tout chantier sans terminal', async () => {
  // ⚠️ MUTATION MESURÉE À L'ÉCRITURE DE CE BANC : retirer `lieux:` de l'appel du veilleur laisse
  // les 940 essais VERTS — et la vue redevient exactement celle d'hier, celle qui perdait six
  // chantiers sur quinze sur ce poste. Aucune erreur, aucun symptôme, un parc amputé de moitié.
  const v = new Veilleur({ cheminSocket: join(bac, 'lieux.sock'), identite: { equipe: 'T' } });
  v.recensementDuPoste = async () => ({ quand: 'T', agents: [], borne: { sessionsRefusees: [] } });

  let recus;
  const vue = await v.vueDuParc({
    construireLecteur: () => async (code) => ({
      code,
      titre: 'chantier lu',
      statut: 'in_progress',
      epics: [],
      epicsEcartes: 0,
      epicsPlafonnes: false,
    }),
    construireLecteurDeLieux: () => async () => {
      recus = true;
      return {
        mesure: 'lue',
        racines: ['/depot'],
        racinesRefusees: [],
        entrees: [{ role: 'orchestrateur', mandat: 'p-20260822-0001', chemins: ['/depot/.orchestrateur/p-20260822-0001'] }],
      };
    },
  });

  assert.ok(recus, 'le veilleur doit APPELER le lecteur de lieux');
  assert.equal(vue.orchestrateurs.length, 1, 'et le chantier sans terminal doit ARRIVER jusqu’à la vue');
  assert.equal(vue.orchestrateurs[0].chantier.code, 'P-20260822-0001');
  assert.equal(vue.registreDesLieux.mesure, 'lue');
});

test('le veilleur construit par défaut un lecteur qui LIT VRAIMENT — pas seulement « un lecteur »', async () => {
  // ⚠️ C'EST L'ARÊTE JUMELLE DE CELLE QUE LE LOT PRÉCÉDENT A PAYÉE SUR `lecteurDeChantier` :
  // « remplacer cet appel par `null` laissait les 886 essais VERTS ». Un défaut par défaut se
  // rend « aucun lecteur de lieux ne m’a été donné » sur un poste parfaitement configuré.
  //
  // 🔴 SURVIVANTE D'UNE CAMPAGNE DE MUTATION, ET MON ASSERTION ÉTAIT LA COUPABLE. Elle exigeait
  // seulement `mesure !== 'non mesurée'`. Un lecteur par défaut qui rend `mesure: 'refusée'` —
  // c'est-à-dire un lecteur MORT — passait donc la garde : « refusée » n'est pas « non mesurée ».
  // J'avais gardé contre l'ABSENCE d'un lecteur, jamais contre un lecteur QUI NE LIT RIEN, et
  // les deux rendent exactement le même parc amputé au dirigeant.
  //
  // ⚠️ ON L'ÉPROUVE SUR UN DISQUE QU'ON CONTRÔLE, PAS SUR LE POSTE. Exiger `mesure: 'lue'` sur
  // les racines réelles ferait dépendre le verdict de la machine : vert chez l'auteur, rouge en
  // CI. On donne donc au veilleur une racine à nous, avec un vrai lieu dedans, et on exige que
  // le lecteur PAR DÉFAUT l'y trouve.
  const racine = join(bac, 'depot-du-veilleur');
  poseUnLieu(racine, 'p-20260822-0001');

  const v = new Veilleur({ cheminSocket: join(bac, 'defaut.sock'), identite: { equipe: 'T' } });
  v.recensementDuPoste = async () => ({ quand: 'T', agents: [], borne: { sessionsRefusees: [] } });

  const vue = await v.vueDuParc({
    construireLecteur: () => async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [] }),
    racines: [racine],
  });

  assert.equal(vue.registreDesLieux.mesure, 'lue', 'le lecteur par défaut doit avoir VRAIMENT lu');
  assert.equal(
    vue.orchestrateurs.length,
    1,
    'et le chantier posé au disque doit ARRIVER dans la vue — c’est la seule preuve que le lecteur a servi'
  );
  assert.equal(vue.orchestrateurs[0].chantier.code, 'P-20260822-0001');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ④ LA SESSION SE LIT — et ce défaut n'est sorti qu'en EXERÇANT la chaîne réelle
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la session rendue est son NOM, pas le chemin de son socket — la forme que la source rend vraiment', async () => {
  // 🔴 QUINZE BANCS VERTS NE L'ONT PAS VU, ET C'EST LE MÊME MOTIF QUE `formes-reelles.js` :
  // leurs doubles écrivaient `session: 'somtech'`, quand le recensement porte
  // `/Users/…/.config/herdr/sessions/somtech/herdr.sock`. Mesuré sur le poste réel le
  // 2026-08-22 : le dirigeant aurait lu un chemin de quatre-vingts caractères sur CHAQUE ligne
  // de son parc, à l'endroit précis que EF-VUE-006 existe pour rendre lisible.
  const { laVueDuParc, rendreLaVue, nomDeSession } = await import('../src/vue-du-parc.js');

  assert.equal(nomDeSession('/Users/x/.config/herdr/sessions/somtech/herdr.sock'), 'somtech');
  assert.equal(nomDeSession('somtech'), 'somtech', 'un nom déjà court traverse tel quel');
  assert.equal(nomDeSession(null), null, 'et l’absence reste une absence');

  const vue = await laVueDuParc({
    recensement: {
      quand: 'T',
      borne: { sessionsRefusees: [] },
      agents: [
        {
          pane: 'w5:p8',
          // LA FORME EXACTE DE LA SOURCE, relevée sur le poste — pas celle qu'on imagine.
          session: '/Users/maximeleboeuf/.config/herdr/sessions/somtech/herdr.sock',
          nom: { mesure: 'lu', valeur: 'ristigouche' },
          role: { mesure: 'établi', nom: 'orchestrateur' },
          mandat: 'p-20260815-0002',
          titre: '✳ Ristigouche orchestrateur P-20260815-0002',
          travailEnVol: { mesure: 'lue', enVol: false },
        },
      ],
    },
    lieux: { mesure: 'lue', racines: ['/r'], racinesRefusees: [], entrees: [] },
    lireChantier: async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [], epicsEcartes: 0, epicsPlafonnes: false }),
  });

  assert.equal(vue.orchestrateurs[0].adresse.session, 'somtech');
  assert.equal(
    vue.orchestrateurs[0].adresse.sessionBrute,
    '/Users/maximeleboeuf/.config/herdr/sessions/somtech/herdr.sock',
    'le chemin reste disponible pour qui outille — il ne disparaît pas, il cesse d’être ce qu’on LIT'
  );
  const ligne = rendreLaVue(vue).split('\n').find((l) => l.includes('w5:p8'));
  assert.ok(ligne.includes('@ somtech'), 'la ligne nomme la session');
  assert.doesNotMatch(ligne, /herdr\.sock/, 'et ne montre PAS le chemin du socket');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑤ LES COUTURES QUE LES GARDES DU CŒUR NE COUVRENT PAS — trouvées par une passe de fond
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 LA MÊME ARÊTE, UNE TROISIÈME FOIS DANS LE MÊME LOT. Ce fichier a été écrit pour fermer deux
// jointures veilleur→module (`titre`, `lieux`). Une passe de fond en a trouvé DEUX AUTRES, sur
// la même arête, que ces gardes-là ne couvraient pas — parce qu'elles passaient toutes un
// argument que **le vrai geste ne passe jamais**.
//
// > `case 'vue': return this.vueDuParc();` — **zéro argument.** C'est le SEUL appel de
// > production, et aucun essai ne l'empruntait.

test('le geste appelle `vueDuParc()` SANS ARGUMENT — et c’est cette voie-là qu’il faut éprouver', async () => {
  // 🔴 DÉFAUT MESURÉ, PAS SUPPOSÉ. Retirer le repli `racines ?? racinesDuPoste()` laissait les
  // 957 essais VERTS. En production, `racines` vaut alors `null` — et `null` n'est PAS
  // `undefined`, donc le défaut `= []` de `lecteurDeLieux` ne s'applique pas : il itère `null`,
  // jette, et le `try/catch` transforme la panne en « lieux refusés ». Mesuré à l'exécution :
  // `registreDesLieux.mesure` passe de « lue » à « refusée », et **0 orchestrateur** au lieu de
  // 15. Tous les chantiers sans terminal — la raison d'être de cet epic — redeviennent
  // invisibles, en silence.
  //
  // ⚠️ ON N'ASSERTE PAS CE QUE LE DISQUE CONTIENT. Exiger des racines réelles ferait dépendre le
  // verdict de la machine (vert chez l'auteur, rouge en CI). On mesure ce que le veilleur
  // TRANSMET : un tableau, jamais `null`.
  const v = new Veilleur({ cheminSocket: join(bac, 'zero-arg.sock'), identite: { equipe: 'T' } });
  v.recensementDuPoste = async () => ({ quand: 'T', agents: [], borne: { sessionsRefusees: [] } });

  let recues = 'jamais appelé';
  const vue = await v.vueDuParc({
    construireLecteur: () => async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [] }),
    construireLecteurDeLieux: ({ racines }) => {
      recues = racines;
      return async () => ({ mesure: 'lue', racines, racinesRefusees: [], entrees: [] });
    },
    // ⚠️ AUCUN `racines:` ICI — c'est tout l'objet de ce banc.
  });

  assert.ok(Array.isArray(recues), `le veilleur doit fournir un TABLEAU de racines, il a fourni ${JSON.stringify(recues)}`);
  assert.notEqual(recues, null, '`null` fait jeter le lecteur, et la panne se rend « lieux refusés »');
  assert.equal(vue.registreDesLieux.mesure, 'lue', 'et la vue ne doit pas partir en refus sur son chemin nominal');
});

test('`racinesDuPoste()` rend TOUJOURS un tableau — même sur une machine qui n’a aucun des deux dossiers', async () => {
  const { racinesDuPoste } = await import('../src/vue-du-parc.js');
  // Un foyer vide : ni `GitRepo.nosync`, ni `worktrees`.
  const vide = racinesDuPoste({ foyer: join(bac, 'foyer-desert') });
  assert.ok(Array.isArray(vide), 'jamais `null` ni `undefined` : c’est ce que le repli du veilleur transmet');
  assert.deepEqual(vide, [], 'et un foyer sans dépôt rend une liste VIDE, pas une panne');
});

test('un lecteur de lieux qui JETTE n’emporte pas la vue entière — les vivants restent rendus', async () => {
  // 🔴 LE COMMENTAIRE DU CODE AFFIRMAIT CETTE INTENTION, ET RIEN NE LA VÉRIFIAIT. Retirer le
  // `try/catch` laissait les 957 essais VERTS : aucun essai ne fournissait un lecteur qui jette.
  // Une permission refusée sur le disque aurait fait échouer `vueDuParc()` en entier — la moitié
  // « vivants » de la réponse, parfaitement mesurable, serait partie avec.
  const v = new Veilleur({ cheminSocket: join(bac, 'jette.sock'), identite: { equipe: 'T' } });
  v.recensementDuPoste = async () => ({
    quand: 'T',
    borne: { sessionsRefusees: [] },
    agents: [
      {
        pane: 'w1:p1',
        session: '/x/sessions/somtech/herdr.sock',
        nom: { mesure: 'lu', valeur: 'un-vivant' },
        role: { mesure: 'établi', nom: 'orchestrateur' },
        mandat: 'p-20260822-0001',
        titre: 'sa fenêtre',
        travailEnVol: { mesure: 'lue', enVol: true },
      },
    ],
  });

  const vue = await v.vueDuParc({
    construireLecteur: () => async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [] }),
    construireLecteurDeLieux: () => async () => {
      throw new Error('le disque a refusé');
    },
  });

  assert.equal(vue.registreDesLieux.mesure, 'refusée', 'la panne du disque est RENDUE');
  assert.match(vue.registreDesLieux.raison, /disque a refusé/, 'et sa cause est nommée, pas avalée');
  assert.equal(vue.orchestrateurs.length, 1, 'la moitié MESURABLE de la réponse survit');
  assert.equal(vue.orchestrateurs[0].agent.nom, 'un-vivant');
});

test('deux lieux qui ne diffèrent QUE PAR LA CASSE sont UN chantier — pas deux', async () => {
  // 🔴 LE CAS EST DOCUMENTÉ DANS CE DÉPÔT (`skills/orchestrateur/SKILL.md`, cas `lieu_ambigu` :
  // « Chantier » et « chantier »), et l'essai qui couvrait la fusion employait la MÊME chaîne
  // dans les deux dossiers — il n'exerçait donc JAMAIS la normalisation. Remplacer
  // `cleDuMandat(mandat)` par `mandat` nu laissait les 957 essais VERTS, et le second chemin
  // disparaissait du rendu en silence.
  //
  // ⚠️ ON INJECTE `lister` PLUTÔT QUE D'ÉCRIRE SUR LE DISQUE : le volume de ce poste est
  // INSENSIBLE À LA CASSE, donc les deux dossiers n'y coexistent pas. Un banc posé sur le disque
  // mesurerait le système de fichiers, pas la normalisation — et serait vert pour la mauvaise
  // raison ici, rouge ailleurs.
  const lu = await lecteurDeLieux({
    racines: ['/depot'],
    roleDuLieu: () => 'orchestrateur',
    lister: (chemin) => (chemin === '/depot' ? [] : chemin.endsWith('.orchestrateur') ? ['Chantier', 'chantier'] : []),
  })();

  assert.equal(lu.entrees.length, 1, 'un seul chantier : la casse du dossier ne crée pas un second mandat');
  assert.equal(lu.entrees[0].chemins.length, 2, 'et les DEUX chemins sont gardés — aucun ne disparaît');
});

test('`porteurDuLieu` n’INVENTE aucun agent — un lieu nomme un rôle et un mandat, jamais une personne', async () => {
  // 🔴 INVARIANT ÉCRIT DANS LE CODE, GARDÉ PAR PERSONNE. Remplacer `agents: []` par une carte
  // fabriquée laissait les 957 essais VERTS. Le champ n'est pas encore lu par le rendu texte,
  // mais il sort par `--json` : un nom plausible y ferait ÉCRIRE à quelqu'un qui n'existe pas —
  // exactement ce que `nomDeLAgent` interdit ailleurs, au prix déjà payé (T-20260822-0002).
  const { porteurDuLieu } = await import('../src/vue-du-parc.js');
  const p = porteurDuLieu(['/depot/.orchestrateur/p-20260822-0001']);

  assert.deepEqual(p.agents, [], 'aucun agent : le lieu ne nomme personne');
  assert.deepEqual(p.lieux, ['/depot/.orchestrateur/p-20260822-0001'], 'ce qu’il nomme, c’est le LIEU');
  assert.match(p.source, /lieu/i);
});

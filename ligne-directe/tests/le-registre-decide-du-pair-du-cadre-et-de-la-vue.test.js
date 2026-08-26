// le-registre-decide-du-pair-du-cadre-et-de-la-vue.test.js — LES COMPARAISONS LITTÉRALES DE
// RÔLE QUI RESTAIENT DANS LE CODE VIVANT (T-20260826-0076, point 6).
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUI A ÉTÉ MESURÉ, ET OÙ — six sites, quatre décisions, deux vocabulaires
//
//   • `ligne-directe/src/veilleur.js` — `if (role !== 'representant')`. QUI PEUT ÊTRE ATTACHÉ
//     COMME PAIR à la ligne d'un chantier, donc en recevoir tout le fil technique.
//   • `ligne-directe/src/vue-du-parc.js` × 2 — `roleEtabli(a) !== 'orchestrateur'` et
//     `l?.role !== 'orchestrateur'`. QUI EST UNE TÊTE DE HIÉRARCHIE dans la vue du parc.
//   • `ligne-directe/src/cadre.js` × 2 — `deRole === 'representant' ? … : …` et
//     `versRole === 'representant'`. QUI PARLE, et QUI A UN CLIENT AU BOUT.
//   • `ligne-directe/src/nom-de-riviere.js` — `['.orchestrateur', '.gestionnaire']`. QUELS
//     DOSSIERS on balaie pour relever les noms DÉJÀ PRIS d'un dépôt.
//   • `naissance-representant/bin/naitre.js` — l'aide annonçait `representant|orchestrateur`.
//
// ⚠️ DEUX SITES RESTENT, AVEC LEUR RAISON ÉCRITE À CÔTÉ D'EUX, et ce fichier ne les garde pas :
// `rendez-vous.js` (le périmètre d'un dispositif écrit pour un métier nommé — l'élargir
// réveillerait des sessions vivantes, ce qui est un arbitrage et pas un rangement) et
// `tui-vue-du-parc.js` (`kind === 'orchestrateur'` lit une ÉTIQUETTE DE NŒUD de l'arbre du TUI,
// pas un rôle). `lieu.js` en garde un troisième, dont son propre nom est la définition, et sa
// garde vit dans `naissance-representant/tests/lieu.test.js`.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ CE QUI DISCRIMINE VRAIMENT, ET CE QUI NE DISCRIMINE PAS
//
// Avec DEUX rôles au registre, un essai générique — « pour chaque rôle, la décision suit ce
// qu'il déclare » — est VERT avant comme après le correctif : `!== 'orchestrateur'` rend
// exactement ce que le registre déclare tant que l'orchestrateur est le seul à le déclarer. Un
// tel essai garde l'avenir ; il ne trouve rien, et le dire évite de compter deux fois la même
// preuve (c'est le constat que le lot voisin a écrit pour `pose_automatique` / `bapteme`).
//
// L'instrument qui discrimine est de DÉPLACER LA DÉCLARATION et de regarder si la décision suit.
// On change ce que le registre déclare, EN MÉMOIRE et dans ce seul processus (`node --test`
// isole chaque fichier), et on le remet dans un `finally`. Sur le code d'avant, la décision ne
// bougeait pas : elle ne lisait pas le registre.
//
// Un seul site ne se laisse pas éprouver ainsi — l'aide de `naitre.js`, qui vit dans un
// PROCESSUS séparé et relit le registre à son propre démarrage. Il est éprouvé sur une COPIE du
// dépôt, hors du dépôt, à laquelle un troisième rôle est ajouté.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  role as roleDe,
  rolesConnus,
  meneUnChantier,
  tientUneLigneCliente,
  pairDeChantier,
  libelleDePair,
  dossiersDesLieux,
  RoleInconnu,
} from '../src/roles.js';
import { cadrerPourPair } from '../src/cadre.js';
import { unRecensement } from '../src/recensement.js';
import { roleDuLieu } from '../src/lieu-agent.js';
import { laVueDuParc } from '../src/vue-du-parc.js';
import { parcDesNoms } from '../src/nom-de-riviere.js';
import { unPaneDAgent } from './aide/formes-reelles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

let bacs = [];
const bacNeuf = (prefixe) => {
  const d = mkdtempSync(join(tmpdir(), `smtk-${prefixe}-`));
  bacs.push(d);
  return d;
};
test.after(() => {
  for (const d of bacs) rmSync(d, { recursive: true, force: true });
  bacs = [];
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — LE REGISTRE DIT CE QUE LE CODE VIVANT DISAIT À SA PLACE
//
// ⚠️ CES ESSAIS GARDENT L'AVENIR — ils ne trouvent aucun défaut d'aujourd'hui, et c'est dit.
// Ce qu'ils empêchent est le premier des neuf rôles arbitrés (P-20260819-0001) inscrit SANS
// dire comment sa parole est annoncée : il repartirait sur un repli que personne n'a choisi.

test('CHAQUE rôle du registre dit COMMENT SA PAROLE EST ANNONCÉE chez son pair', () => {
  const muets = rolesConnus().filter((nom) => {
    const dit = roleDe(nom).libelle_de_pair;
    return typeof dit !== 'string' || !dit.trim();
  });
  assert.deepEqual(
    muets,
    [],
    `ces rôles ne disent pas comment leur parole est annoncée : ${muets.join(', ')}. ` +
      'Tant qu’ils se taisent, un repli les nomme — et c’était le ternaire `deRole === \'representant\'` ' +
      'de cadre.js, qui annonçait TOUT autre rôle comme « l’orchestrateur du chantier ».',
  );
});

test('LA PERMISSION D’ÊTRE UN PAIR N’EST JAMAIS IMPLICITE — elle se déclare ou elle n’est pas', () => {
  // On n'exige pas que chaque rôle la déclare : l'absence EST une réponse, et c'est la bonne
  // par défaut. Ce qu'on exige, c'est qu'aucun rôle ne la déclare avec une valeur douteuse —
  // un `'oui'` ou un `1` passerait pour un accord et n'en est pas un.
  const douteux = rolesConnus().filter((nom) => {
    const dit = roleDe(nom).pair_de_chantier;
    return dit !== undefined && typeof dit !== 'boolean';
  });
  assert.deepEqual(douteux, [], `ces rôles déclarent « pair_de_chantier » sans un booléen : ${douteux.join(', ')}`);

  const admis = rolesConnus().filter(pairDeChantier);
  assert.ok(
    admis.length > 0,
    'aucun rôle ne peut être attaché comme pair — « --au-gestionnaire » ne servirait plus à rien, ' +
      'et cet essai ne garderait rien',
  );
});

// ⚠️ LES VALEURS D'AUJOURD'HUI SONT ÉPINGLÉES. Sans elles, tout ce fichier resterait vert si
// quelqu'un donnait `pair_de_chantier: true` à l'orchestrateur — c'est-à-dire s'il rendait
// attachable à la ligne d'un chantier celui qui la PORTE, ou pire, si un rôle client de plus
// devenait pair sans qu'un arbitrage l'ait dit.
test('LES VALEURS MESURÉES DES DEUX RÔLES EXISTANTS SONT ÉPINGLÉES', () => {
  assert.equal(meneUnChantier('orchestrateur'), true, 'son mandat EST un code de chantier');
  assert.equal(meneUnChantier('representant'), false, 'le sien est un nom de client');
  assert.equal(tientUneLigneCliente('representant'), true, 'sa première ligne est celle de son client');
  assert.equal(tientUneLigneCliente('orchestrateur'), false, 'ses lignes sont internes, toutes');
  assert.equal(pairDeChantier('representant'), true, 'c’est lui que « --au-gestionnaire » attache');
  assert.equal(pairDeChantier('orchestrateur'), false, 'il PORTE la ligne du chantier, il n’y est pas attaché');
  assert.equal(libelleDePair('representant'), 'du gestionnaire client');
  assert.equal(libelleDePair('orchestrateur'), 'de l’orchestrateur du chantier');
  assert.deepEqual(dossiersDesLieux().sort(), ['.gestionnaire', '.orchestrateur']);
});

test('LES ACCESSEURS QUI DÉCIDENT REFUSENT UN RÔLE INCONNU', () => {
  // Le registre l'écrit : « DÉCIDER sur un rôle qu'on ne connaît pas reste interdit ». Celui qui
  // compte le plus ici est `pairDeChantier` — il décide de livrer, ou non, le fil d'un chantier.
  for (const accesseur of [meneUnChantier, tientUneLigneCliente, pairDeChantier, libelleDePair]) {
    assert.throws(() => accesseur('cuisinier'), RoleInconnu, `${accesseur.name} a décidé sur un rôle inconnu`);
  }
});

// ⚠️ LES REPLIS SONT ÉPROUVÉS, PAS SEULEMENT ÉCRITS. Aucun rôle déclaré ne les atteint — un
// essai plus haut s'en assure — donc sans ceci ils seraient du code jamais exécuté, dont on ne
// saurait qu'au neuvième rôle s'il tient ce que son commentaire promet.
test('UN RÔLE QUI OUBLIE `pair_de_chantier` N’EST PAS UN PAIR — le repli refuse, il n’accorde pas', () => {
  const r = roleDe('representant');
  const declare = r.pair_de_chantier;
  try {
    delete r.pair_de_chantier;
    assert.equal(pairDeChantier('representant'), false, 'clé absente : le repli doit refuser');
    r.pair_de_chantier = 'oui'; // une valeur qui a l'air d'un « vrai » sans en être un
    assert.equal(pairDeChantier('representant'), false, 'seul un `true` explicite livre le fil d’un chantier');
  } finally {
    r.pair_de_chantier = declare;
  }
  assert.equal(pairDeChantier('representant'), true, 'la déclaration est remise telle qu’elle était');
});

test('UN RÔLE QUI OUBLIE `libelle_de_pair` N’EST JAMAIS ANNONCÉ SOUS LE NOM D’UN AUTRE', () => {
  const r = roleDe('representant');
  const declare = r.libelle_de_pair;
  try {
    delete r.libelle_de_pair;
    const compose = libelleDePair('representant');
    assert.equal(compose, 'du représentant', 'le repli compose depuis `libelle`, avec son article');
    assert.ok(!/orchestrateur/.test(compose), 'et il n’attribue JAMAIS la parole à un autre rôle');
  } finally {
    r.libelle_de_pair = declare;
  }
  // L'élision, sur le rôle qui commence par une voyelle — sans elle, « le orchestrateur ».
  const o = roleDe('orchestrateur');
  const dit = o.libelle_de_pair;
  try {
    delete o.libelle_de_pair;
    assert.equal(libelleDePair('orchestrateur'), 'de l’orchestrateur', 'le repli élide');
  } finally {
    o.libelle_de_pair = dit;
  }
  assert.equal(libelleDePair('orchestrateur'), 'de l’orchestrateur du chantier', 'les déclarations sont remises');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — DÉPLACER LA DÉCLARATION DÉPLACE LA DÉCISION
//
// C'est le seul instrument qui rougisse sur le code d'avant. Chaque essai de cette section
// était ROUGE avant le correctif, et pour la même raison : la décision ne lisait pas le registre.

// ═══ (a) LE PAIR D'UNE LIGNE DE CHANTIER — veilleur.js

/**
 * UN VRAI LIEU D'AGENT SUR DISQUE — parce que le rôle d'un pair s'établit par le FAIT.
 *
 * ⚠️ ON NE DOUBLE PAS `roleDuLieu`. Un double qui rendrait « rôle representant » sur parole
 * prouverait que l'essai est d'accord avec lui-même, et laisserait passer le jour où l'un des
 * deux en-têtes change. C'est la même règle que le banc de la ligne partagée applique déjà.
 */
function poserLieuReel(depot, nomDuRole, nom) {
  const lieu = join(depot, roleDe(nomDuRole).dossier, nom);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  const entetes = roleDe(nomDuRole).entetes;
  writeFileSync(join(lieu, 'CLAUDE.md'), `${String(entetes['CLAUDE.md']).replace(/^\/\^|\/$/g, '')}\n\nle métier.\n`);
  writeFileSync(join(lieu, 'CONTEXTE.md'), `${String(entetes['CONTEXTE.md']).replace(/^\/\^|\/$/g, '')}\n\nle contexte.\n`);
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  assert.equal(roleDuLieu(lieu), nomDuRole, `le lieu posé doit ÊTRE reconnu « ${nomDuRole} » — sinon l’essai mesure autre chose`);
  return lieu;
}

/** Un veilleur dont le seul herdr est la liste d'agents qu'on lui donne. */
async function veilleurAvec(agents) {
  const racine = bacNeuf('pair-veilleur');
  process.env.LIGNE_DIRECTE_RACINE = racine;
  const { Veilleur } = await import('../src/veilleur.js');
  const { sauverRegistre } = await import('../src/registre.js');
  sauverRegistre({ version: 1, lignes: [], communs: {}, commun: null, dirigeant: 'UDIR' });
  return new Veilleur({
    cheminSocket: join(racine, 'v.sock'),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    herdr: { async agents() { return agents; } },
  });
}

test('(a) LE PAIR D’UNE LIGNE DE CHANTIER EST CELUI QUE LE REGISTRE AUTORISE — pas un littéral', async () => {
  const depot = bacNeuf('pair-depot');
  const lieuG = poserLieuReel(depot, 'representant', 'acme');
  const lieuO = poserLieuReel(depot, 'orchestrateur', 'd-20260826-0001');
  const v = await veilleurAvec([
    { pane_id: 'w1:p1', name: 'acme', foreground_cwd: lieuG, herdr_socket: '/s/1' },
    { pane_id: 'w1:p2', name: 'matapedia', foreground_cwd: lieuO, herdr_socket: '/s/2' },
  ]);

  // L'état d'aujourd'hui : le représentant est admis, l'orchestrateur non.
  assert.equal((await v.resoudrePair('acme', 'interne', 'w1:p9')).ok, true, 'le représentant est le pair d’aujourd’hui');
  const refus = await v.resoudrePair('matapedia', 'interne', 'w1:p9');
  assert.equal(refus.ok, false, 'un orchestrateur nommé par erreur n’est PAS un pair');

  // ⚠️ ET MAINTENANT ON DÉPLACE LA DÉCLARATION. C'est ici, et nulle part ailleurs dans cet
  // essai, que le code d'avant rougissait : `role !== 'representant'` ne bouge pas quand le
  // registre bouge.
  const orchestrateur = roleDe('orchestrateur');
  const representant = roleDe('representant');
  const declareO = orchestrateur.pair_de_chantier;
  const declareR = representant.pair_de_chantier;
  try {
    orchestrateur.pair_de_chantier = true;
    delete representant.pair_de_chantier;
    const admis = await v.resoudrePair('matapedia', 'interne', 'w1:p9');
    assert.equal(
      admis.ok,
      true,
      `le registre autorise l’orchestrateur et il reste refusé : la décision ne vient pas du registre (${admis.erreur})`,
    );
    assert.equal(admis.pair.role, 'orchestrateur', 'et le pair attaché porte le rôle mesuré à son lieu');
    const exclu = await v.resoudrePair('acme', 'interne', 'w1:p9');
    assert.equal(exclu.ok, false, 'le registre a retiré la permission au représentant et il passe encore');
    assert.match(exclu.erreur, /orchestrateur/, 'le refus NOMME qui aurait le droit — et il le lit au registre');
  } finally {
    if (declareO === undefined) delete orchestrateur.pair_de_chantier;
    else orchestrateur.pair_de_chantier = declareO;
    representant.pair_de_chantier = declareR;
  }
  assert.equal(pairDeChantier('representant'), true, 'les déclarations sont remises telles qu’elles étaient');
  assert.equal(pairDeChantier('orchestrateur'), false, 'les déclarations sont remises telles qu’elles étaient');
});

test('(a) UN RÉPERTOIRE QUI N’EST LE LIEU DE PERSONNE FAIT UN REFUS, JAMAIS UN PLANTAGE', async () => {
  // ⚠️ C'EST LE CAS LE PLUS FRÉQUENT DE CE REFUS, et le correctif pouvait le transformer en
  // exception : `roleDuLieu` rend `null`, et le registre LÈVE sur un rôle inconnu. Un veilleur
  // qui plante là où il refusait est pire que le littéral qu'on enlève.
  const v = await veilleurAvec([{ pane_id: 'w2:p1', name: 'quelconque', foreground_cwd: bacNeuf('sans-lieu'), herdr_socket: '/s/1' }]);
  const r = await v.resoudrePair('quelconque', 'interne', 'w2:p9');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /n'est pas un gestionnaire client/);
});

// ═══ (c) LES TÊTES DE HIÉRARCHIE DE LA VUE DU PARC — vue-du-parc.js

test('(c) LA VUE PREND POUR TÊTE DE HIÉRARCHIE CE QUE LE REGISTRE DÉCLARE — pas un littéral', async () => {
  const depot = join(bacNeuf('vue-depot'), 'depot');
  const lieuG = poserLieuReel(depot, 'representant', 'acme');
  const recensement = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w3:p1', foreground_cwd: lieuG })],
    roleDuLieu,
  });
  assert.equal(recensement.agents[0].role.nom, 'representant', 'le recensement doit établir le rôle — sinon l’essai mesure autre chose');

  const vue = await laVueDuParc({ recensement });
  assert.equal(vue.compte.orchestrateurs, 0, 'un représentant n’est pas une tête de hiérarchie aujourd’hui');

  // ⚠️ ON DÉPLACE LA DÉCLARATION : son mandat devient un code de chantier. La vue doit le
  // prendre pour tête de hiérarchie. Le code d'avant rendait `0` quoi qu'en dise le registre.
  const representant = roleDe('representant');
  const declare = representant.mandat_designe;
  try {
    representant.mandat_designe = 'chantier';
    const apres = await laVueDuParc({ recensement });
    assert.equal(
      apres.compte.orchestrateurs,
      1,
      'le registre déclare que ce rôle mène un chantier et la vue l’ignore : la décision ne vient pas du registre',
    );
    assert.equal(apres.horsHierarchie.length, 0, 'et il n’est PAS compté deux fois — il a quitté « hors hiérarchie »');
  } finally {
    representant.mandat_designe = declare;
  }
  assert.equal(meneUnChantier('representant'), false, 'la déclaration est remise telle qu’elle était');
});

test('(c) LA MÊME DÉCISION VAUT POUR UN LIEU SANS TERMINAL VIVANT — la seconde source, pas la première', async () => {
  // ⚠️ « UNE PORTE SUR DEUX » : `vue-du-parc.js` portait le littéral DEUX fois, sur deux
  // sources différentes. Corriger celle des agents vivants et oublier celle des lieux aurait
  // laissé un rôle neuf visible seulement tant que son terminal est ouvert.
  const depot = join(bacNeuf('vue-lieux'), 'depot');
  poserLieuReel(depot, 'representant', 'acme');
  const { lecteurDeLieux } = await import('../src/vue-du-parc.js');
  const lieux = await lecteurDeLieux({ racines: [depot] })();
  assert.equal(lieux.mesure, 'lue', `le lecteur de lieux doit avoir mesuré : ${lieux.raison ?? ''}`);

  const vue = await laVueDuParc({ recensement: { agents: [] }, lieux });
  assert.equal(vue.compte.orchestrateurs, 0, 'le lieu d’un représentant n’ouvre pas de ligne dans la vue aujourd’hui');

  const representant = roleDe('representant');
  const declare = representant.mandat_designe;
  try {
    representant.mandat_designe = 'chantier';
    const apres = await laVueDuParc({ recensement: { agents: [] }, lieux });
    assert.equal(apres.compte.orchestrateurs, 1, 'la SECONDE source ignore le registre — le littéral y est resté');
  } finally {
    representant.mandat_designe = declare;
  }
});

// ═══ (e) LE CADRE D'UN PAIR — cadre.js

const unCadre = (deRole, versRole) =>
  cadrerPourPair({ chantier: 'd-1', texte: 'le texte', canal: 'ligne-d-1', deRole, deNom: 'n', versRole });

test('(e) LE CADRE ANNONCE QUI PARLE D’APRÈS LE REGISTRE — jamais sous le nom d’un autre rôle', () => {
  assert.match(unCadre('representant', 'orchestrateur'), /Message du gestionnaire client n,/);
  assert.match(unCadre('orchestrateur', 'representant'), /Message de l’orchestrateur du chantier n,/);

  const representant = roleDe('representant');
  const declare = representant.libelle_de_pair;
  try {
    representant.libelle_de_pair = 'du conseiller au client';
    assert.match(
      unCadre('representant', 'orchestrateur'),
      /Message du conseiller au client n,/,
      'le registre déclare une autre formule et le cadre garde la sienne : la décision ne vient pas du registre',
    );
  } finally {
    representant.libelle_de_pair = declare;
  }
});

test('(e) L’AVERTISSEMENT « RIEN NE DESCEND AU CLIENT » SUIT LES LIGNES DU DESTINATAIRE', () => {
  const PHRASE = /RIEN DE CE FIL NE DESCEND AU CLIENT/;
  assert.match(unCadre('orchestrateur', 'representant'), PHRASE, 'celui qui a un client au bout est averti');
  assert.doesNotMatch(unCadre('representant', 'orchestrateur'), PHRASE, 'celui qui n’en a pas ne l’est pas');

  // ⚠️ ON DÉPLACE LES LIGNES, PAS `nature` — le registre écrit lui-même que `nature` « ne nomme
  // que la première » ligne depuis T-20260813-0076. Un rôle dont la ligne cliente ne serait pas
  // la première doit tout de même recevoir l'avertissement : c'est le mode de panne unique de
  // ce cadre, et il redevenait ouvert au premier rôle ajouté.
  const orchestrateur = roleDe('orchestrateur');
  const declare = orchestrateur.lignes;
  try {
    orchestrateur.lignes = [
      { cle: 'chantier', nature: 'interne', titreRequis: false },
      { cle: 'client', nature: 'client', titreRequis: true },
    ];
    assert.match(
      unCadre('representant', 'orchestrateur'),
      PHRASE,
      'le registre lui donne une ligne cliente et l’avertissement saute : la décision ne vient pas du registre',
    );
  } finally {
    orchestrateur.lignes = declare;
  }
  assert.doesNotMatch(unCadre('representant', 'orchestrateur'), PHRASE, 'la déclaration est remise telle qu’elle était');
});

test('(e) UN RÔLE INCONNU NE FAIT NI PLANTER LE CADRE, NI TAIRE L’AVERTISSEMENT', () => {
  // Ce cadre est composé sur le chemin d'une remise DÉJÀ partie : une exception y perdrait le
  // message définitivement. Et les deux replis penchent chacun de leur côté — on ne nomme
  // personne, et on avertit quand même.
  const c = unCadre('cuisinier', 'cuisinier');
  assert.match(c, /Message de ton pair sur ce chantier n,/, 'on n’attribue la parole à aucun rôle connu');
  assert.match(c, /RIEN DE CE FIL NE DESCEND AU CLIENT/, 'et on avertit plutôt que de risquer la fuite');
});

// ═══ LES NOMS DÉJÀ PRIS D'UN DÉPÔT — nom-de-riviere.js

test('LE PARC DES NOMS BALAIE LES DOSSIERS DU REGISTRE — pas une liste écrite à la main', () => {
  const depot = bacNeuf('parc-noms');
  mkdirSync(join(depot, '.gestionnaire', 'acme'), { recursive: true });
  mkdirSync(join(depot, '.orchestrateur', 'matapedia'), { recursive: true });
  mkdirSync(join(depot, '.conseiller', 'bonaventure'), { recursive: true });

  const sansAppel = { listerAgents: () => [], lireRegistre: () => ({ lignes: {}, communs: {} }) };
  const avant = parcDesNoms({ depot, ...sansAppel });
  assert.ok(avant.pris.includes('acme') && avant.pris.includes('matapedia'), 'les deux dossiers d’aujourd’hui sont balayés');
  assert.ok(!avant.pris.includes('bonaventure'), 'et « .conseiller » n’est le dossier d’aucun rôle déclaré');

  // ⚠️ ON DÉPLACE LE DOSSIER D'UN RÔLE. Ce que le littéral coûtait est MUET : « bonaventure »
  // serait rendu LIBRE alors qu'un agent vivant le porte, et deux agents du même dépôt
  // finiraient avec le même nom — donc inadressables tous les deux, sans une erreur.
  const representant = roleDe('representant');
  const declare = representant.dossier;
  try {
    representant.dossier = '.conseiller';
    const apres = parcDesNoms({ depot, ...sansAppel });
    assert.ok(
      apres.pris.includes('bonaventure'),
      'le registre range ce rôle sous « .conseiller » et le balayage l’ignore : la liste des dossiers est en dur',
    );
  } finally {
    representant.dossier = declare;
  }
  assert.deepEqual(dossiersDesLieux().sort(), ['.gestionnaire', '.orchestrateur'], 'la déclaration est remise');
});

// ═══ L'AIDE DE `naitre.js` — un PROCESSUS, donc une COPIE hors dépôt

/**
 * LA COMMANDE, DANS UNE COPIE DU DÉPÔT À LAQUELLE ON A AJOUTÉ UN TROISIÈME RÔLE.
 *
 * ⚠️ POURQUOI UNE COPIE ET PAS UNE MUTATION EN MÉMOIRE : `naitre.js` est un exécutable. Il
 * relit `roles.js` à SON démarrage, dans SON processus — rien de ce qu'on change ici ne
 * l'atteint. Et l'essai générique ne discriminerait rien : avec deux rôles,
 * `rolesConnus().join('|')` rend exactement la chaîne « representant|orchestrateur » que
 * l'aide portait en dur.
 *
 * ⚠️ ET LA COPIE VIT HORS DU DÉPÔT — rien n'est écrit dans l'arbre de travail.
 */
function copieAvecUnTroisiemeRole() {
  const bac = bacNeuf('naitre-aide');
  for (const rel of [['ligne-directe', 'src'], ['naissance-representant', 'src'], ['naissance-representant', 'bin']]) {
    mkdirSync(join(bac, ...rel), { recursive: true });
    execFileSync('cp', ['-R', join(REPO_ROOT, ...rel) + '/.', join(bac, ...rel)]);
  }
  for (const paquet of ['ligne-directe', 'naissance-representant']) {
    writeFileSync(join(bac, paquet, 'package.json'), JSON.stringify({ name: paquet, type: 'module' }));
  }
  const chemin = join(bac, 'ligne-directe', 'src', 'roles.js');
  const avant = readFileSync(chemin, 'utf8');
  const apres = avant.replace(
    'const ROLES = {\n',
    "const ROLES = {\n  conseiller: { libelle: 'conseiller', libelle_pluriel: 'conseillers', dossier: '.conseiller', mandat_designe: 'client', gabarits: 'conseiller', nature: 'interne', bapteme: 'code', libelle_de_pair: 'du conseiller', entetes: {} },\n",
  );
  assert.notEqual(apres, avant, 'MUTATION INOPÉRANTE : le troisième rôle n’a pas été inscrit dans la copie');
  writeFileSync(chemin, apres);
  return join(bac, 'naissance-representant', 'bin', 'naitre.js');
}

test('L’AIDE DE `naitre` NOMME TOUS LES RÔLES DU REGISTRE — mesurée sur un registre à trois', () => {
  const bin = copieAvecUnTroisiemeRole();
  assert.ok(existsSync(bin), 'la copie porte bien la commande');
  const r = spawnSync(process.execPath, [bin], { encoding: 'utf8' });
  assert.equal(r.status, 1, `l’aide doit sortir en 1 : ${r.stderr || r.stdout}`);
  assert.match(
    r.stderr,
    /\[--role [a-z|]*\bconseiller\b[a-z|]*\]/,
    'l’aide n’annonce pas le troisième rôle : elle porte sa liste en dur, et elle MENT à qui la lit',
  );
});

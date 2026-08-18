// RAFRAÎCHIR LE LIEU D'UN AGENT NE LE DÉSARME PAS (T-20260818-0034)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE FICHIER FERME
//
// `pack representant-update` et `pack orchestrateur-update` font converger tout le lieu vers
// la version du pack, et ne préservent qu'un seul fichier : `CONTEXTE.md`. Le reste prend la
// version du gabarit — **y compris `.claude/settings.json`, qui porte le garde d'ouverture de
// ligne.** Le geste qu'on fait pour mettre un lieu à jour est celui qui lui retire son garde,
// et rien ne le dit : un lieu désarmé se lit exactement comme un lieu armé.
//
// C'est le pire de sa série pour trois raisons mesurées : c'est SILENCIEUX, c'est déclenché
// par le BON geste (celui qu'on recommande), et la campagne de rafraîchissement des lieux
// posés consiste précisément à passer cette commande sur chacun — donc à les désarmer en
// masse.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE CONTRÔLE VIT ICI, ET PAS DANS `cli/test/`
//
// Il est le PONT entre deux lots qui ne se voient pas, et chacun est vert de son côté :
//
//   • `cli/src/commands/representant.js` fait CONVERGER un lieu. Son harnais éprouve la
//     convergence — sur un gabarit FIXTURE qu'il monte lui-même en tmp. Un essai bâti là
//     resterait vert même si le vrai gabarit ne portait aucun garde : il éprouverait son
//     idée de l'armement, pas l'armement.
//   • `naissance-representant/src/naissance.js` ARME un lieu (`fusionnerGarde`,
//     `COMMANDE_GARDE`). Son harnais éprouve la pose du garde — sans jamais faire passer une
//     convergence par-dessus.
//
// Ce fichier arme avec la fonction que la naissance appelle VRAIMENT, converge depuis le
// gabarit RÉEL du dépôt (`--source REPO`), et relit ce qui reste. Il ne cherche aucun mot
// dans un texte : il éprouve l'ACCORD des deux lots, que ni l'un ni l'autre ne peut prouver
// seul.
//
// Il vit dans la suite `naissance-representant` (Node ≥ 22) et non `cli/test/` (Node 20 en
// CI) parce qu'il importe `naissance.js`, qui importe `ligne-directe/src/*` — le CLI, lui,
// ne peut pas importer le garde (son paquet npm publié n'embarque pas ces chemins), et c'est
// la contrainte qui a décidé la forme du correctif : le garde descend par le GABARIT.
//
// Traçabilité : T-20260818-0034, T-20260818-0006, RA-REL-014, RA-DIS-004.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// LA FONCTION QUE LA NAISSANCE APPELLE — pas une copie de sa logique. Armer « à la main »
// dans cet essai prouverait l'accord de l'essai avec lui-même, et laisserait passer le jour
// où la naissance changerait la forme de son garde.
import { COMMANDE_GARDE, fusionnerGarde, poserGarde } from '../src/naissance.js';
// LA COMMANDE QUE L'HUMAIN TAPE — `run` du CLI, pas un appel direct à `cmdLieuUpdate` : ce
// qui désarme est la commande entière, résolution du lieu et affichage compris.
import { run } from '../../cli/src/cli.js';
import { posteFabrique } from '../../ligne-directe/tests/foyer-de-reference.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

/**
 * Les deux rôles, avec le gabarit RÉEL dont chacun converge et le dossier où son lieu se
 * range — pris au dépôt, jamais recomposés ici.
 *
 * ⚠️ LES DEUX SONT ÉPROUVÉS, ET CE N'EST PAS DE LA REDONDANCE. `cmdRepresentantUpdate` et
 * `cmdOrchestrateurUpdate` sont aujourd'hui deux enveloppes d'une ligne sur la même
 * `cmdLieuUpdate` : un correctif les couvre donc toutes deux par construction. Mais rien
 * n'oblige cela à durer, et le jour où l'une se désolidarise de l'autre, un essai qui n'en
 * couvrait qu'une rejouerait « une porte sur deux » — le motif le plus cher de ce dépôt.
 * Ces cas-ci rougiraient.
 */
const ROLES = [
  { nom: 'representant', commande: 'representant-update', designe: '--client', gabarit: 'gestionnaire-client', dossier: '.gestionnaire' },
  { nom: 'orchestrateur', commande: 'orchestrateur-update', designe: '--nom', gabarit: 'orchestrateur', dossier: '.orchestrateur' },
];

const NOM = 'acme';
const CONTEXTE_ECRIT_A_LA_MAIN = '# Ce qu’on sait\n\nÉcrit à la main. La convergence n’y touche jamais.\n';

/** Le chemin du fichier qui porte les droits ET le garde, dans un lieu posé. */
const settingsDu = (lieu) => join(lieu, '.claude', 'settings.json');

/** Le `.claude/settings.json` du gabarit réel d'un rôle, tel que le dépôt le distribue. */
function settingsDuGabarit(role) {
  return JSON.parse(readFileSync(join(REPO, '.claude', 'templates', role.gabarit, '.claude', 'settings.json'), 'utf8'));
}

/**
 * Les commandes de hook posées dans un `settings.json`, tous événements confondus.
 *
 * ⚠️ ON SONDE LE FICHIER APPELÉ, jamais l'égalité de la commande entière — c'est la même
 * règle que `fusionnerGarde` applique pour reconnaître son garde, et pour la même raison : un
 * garde posé par une version antérieure porte un chemin absolu mort. Le compter comme absent
 * ferait passer « désarmé » pour « armé autrement », et l'inverse.
 */
function commandesDeHook(settings) {
  const hooks = settings.hooks || {};
  return Object.values(hooks).flatMap((blocs) => (blocs || []).flatMap((b) => (b.hooks || []).map((h) => h.command || '')));
}

const estArme = (settings) => commandesDeHook(settings).some((c) => c.includes('garde-ouverture-ligne.js'));

/**
 * Un dépôt fixture avec un lieu POSÉ pour ce rôle — les quatre fichiers du gabarit réel,
 * copiés depuis le dépôt.
 *
 * `permissionsPerimees` simule ce que la campagne de rafraîchissement vient corriger : un
 * lieu posé il y a des semaines, dont les droits ne sont plus ceux du pack. C'est ce qui rend
 * le cas honnête — si l'essai posait un lieu déjà identique au gabarit, la convergence
 * n'aurait rien à écraser et ne pourrait pas désarmer.
 */
function poserLieu(role) {
  const depot = mkdtempSync(join(tmpdir(), 'smtk-cv-'));
  const lieu = join(depot, role.dossier, NOM);
  mkdirSync(lieu, { recursive: true });
  cpSync(join(REPO, '.claude', 'templates', role.gabarit), lieu, { recursive: true });
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE_ECRIT_A_LA_MAIN);

  // ⚠️ LE LIEU PART DÉSARMÉ ET SES DROITS PÉRIMÉS — jamais dans l'état du gabarit courant.
  // C'est l'état MESURÉ des lieux déjà posés : 24 lieux désarmés sur les 85 relevés au poste,
  // et c'est très exactement ceux que la campagne de rafraîchissement va traverser.
  //
  // Copier le gabarit tel quel les rendrait déjà armés, et le banc perdrait sa capacité à
  // produire le cas qu'il existe pour éprouver : la convergence n'aurait rien à écraser, donc
  // rien à désarmer, et les essais resteraient verts sur un défaut intact.
  const s = settingsDuGabarit(role);
  delete s.hooks;
  s.permissions = { deny: ['Write'] }; // périmé : le gabarit en dit davantage
  writeFileSync(settingsDu(lieu), `${JSON.stringify(s, null, 2)}\n`);

  return { depot, lieu };
}

// LE FOYER DE RÉFÉRENCE de cette suite — voir `converger` juste dessous pour le motif.
const bacsFoyer = [];
const POSTE = posteFabrique(join(REPO, '.claude', 'templates'), ROLES.map((r) => r.gabarit), bacsFoyer);
after(() => {
  POSTE.rendre();
  for (const b of bacsFoyer) rmSync(b, { recursive: true, force: true });
});

/**
 * La convergence, telle qu'un humain la lance — et ce qu'elle a écrit à l'écran.
 *
 * ⚠️ `HOME` EST FIXÉ POUR LA SUITE ENTIÈRE, ET CE N'EST PAS UN CONTOURNEMENT (T-20260818-0133).
 * La convergence compare le gabarit qu'elle sert au pack installé sur le poste — sous
 * `$HOME/.claude/plugins/marketplaces/…`. Cette suite sert le gabarit DU DÉPÔT (`--source
 * REPO`) : sans foyer fixe, elle rougirait sur un poste à jour dès qu'une branche touche à un
 * gabarit, en restant verte en CI (qui n'a pas de marketplace). Le foyer porte EXACTEMENT le
 * gabarit servi, donc la garde compare deux empreintes réelles et laisse passer — elle reste
 * exercée, elle n'est pas désarmée. `HOME` plutôt qu'un paramètre : la commande n'a pas
 * d'option de foyer, et lui en ajouter une ouvrirait une porte de production pour un besoin
 * d'essai — `fraicheur-du-gabarit.test.js` l'interdit d'ailleurs par un essai dédié.
 */
async function converger(role, depot, { dryRun = false } = {}) {
  const dit = [];
  const log = console.log;
  console.log = (...a) => dit.push(a.join(' '));
  try {
    const argv = [role.commande, role.designe, NOM, '--source', REPO, '--target', depot];
    if (dryRun) argv.push('--dry-run');
    const code = await run(argv);
    return { code, dit: dit.join('\n') };
  } finally {
    console.log = log;
  }
}

// ═══════════════════════ 1. un lieu ARMÉ reste armé après la convergence

for (const role of ROLES) {
  test(`${role.nom} : un lieu ARMÉ est ENCORE ARMÉ après la convergence`, async () => {
    const { depot, lieu } = poserLieu(role);
    poserGarde(depot, NOM, role.nom);
    assert.ok(estArme(JSON.parse(readFileSync(settingsDu(lieu), 'utf8'))), 'le lieu doit être armé AVANT — sinon cet essai ne prouve rien');

    const { code } = await converger(role, depot);
    assert.equal(code, 0, 'la convergence doit réussir');

    const apres = JSON.parse(readFileSync(settingsDu(lieu), 'utf8'));
    assert.ok(
      estArme(apres),
      'LE LIEU EST RESSORTI DÉSARMÉ. La convergence a écrasé .claude/settings.json par la '
        + 'version du gabarit, et le gabarit ne porte pas le garde : le geste qui met à jour '
        + 'retire la protection, en silence.'
    );
  });

  test(`${role.nom} : le garde qui reste est CELUI DU PACK, pas une relique`, async () => {
    const { depot, lieu } = poserLieu(role);
    // Un garde d'une version antérieure : le bon fichier, un chemin mort. Le laisser en place
    // vaudrait « armé » pour la sonde tout en échouant à chaque appel d'outil.
    const perime = JSON.parse(readFileSync(settingsDu(lieu), 'utf8'));
    perime.hooks = { PreToolUse: [{ hooks: [{ type: 'command', command: 'node /parti/en/2025/naissance-representant/hooks/garde-ouverture-ligne.js' }] }] };
    writeFileSync(settingsDu(lieu), `${JSON.stringify(perime, null, 2)}\n`);

    await converger(role, depot);

    const commandes = commandesDeHook(JSON.parse(readFileSync(settingsDu(lieu), 'utf8')));
    assert.ok(commandes.includes(COMMANDE_GARDE), 'après convergence, le garde doit être celui que le pack distribue');
    assert.equal(
      commandes.filter((c) => c.includes('garde-ouverture-ligne.js')).length, 1,
      'un seul garde — deux, dont un mort, échouerait à chaque appel d’outil'
    );
  });

  // ═══════════════════════ 2. et le reste converge quand même

  test(`${role.nom} : les droits périmés convergent — l'armement ne fige pas le lieu`, async () => {
    const { depot, lieu } = poserLieu(role);
    poserGarde(depot, NOM, role.nom);

    await converger(role, depot);

    const apres = JSON.parse(readFileSync(settingsDu(lieu), 'utf8'));
    assert.deepEqual(
      apres.permissions, settingsDuGabarit(role).permissions,
      'les droits doivent prendre la version du pack : préserver le fichier ENTIER protégerait '
        + 'l’armement en condamnant toute correction future des droits à ne jamais descendre'
    );
    assert.ok(estArme(apres), 'et l’armement tient dans le même passage');
  });

  test(`${role.nom} : CONTEXTE.md n'est jamais touché, armement ou pas (RA-REL-014)`, async () => {
    const { depot, lieu } = poserLieu(role);
    poserGarde(depot, NOM, role.nom);

    await converger(role, depot);

    assert.equal(readFileSync(join(lieu, 'CONTEXTE.md'), 'utf8'), CONTEXTE_ECRIT_A_LA_MAIN);
  });

  // ═══════════════════════ 3. l'autre moitié : un lieu JAMAIS armé ressort armé

  test(`${role.nom} : un lieu JAMAIS armé ressort ARMÉ de la convergence (T-20260818-0006)`, async () => {
    const { depot, lieu } = poserLieu(role);
    assert.ok(
      !estArme(JSON.parse(readFileSync(settingsDu(lieu), 'utf8'))),
      'le lieu part désarmé — c’est l’état d’un lieu posé avant que le garde entre au gabarit'
    );

    await converger(role, depot);

    assert.ok(
      estArme(JSON.parse(readFileSync(settingsDu(lieu), 'utf8'))),
      'LA CONVERGENCE N’ARME PAS. Les deux moitiés du défaut se tiennent : on ne peut ni '
        + 'recevoir le garde à la naissance, ni le garder après une mise à jour.'
    );
  });

  // ═══════════════════════ 4. le lieu DIT s'il est armé, sans qu'on provoque un blocage

  test(`${role.nom} : après convergence, la sortie DIT le lieu armé — et ne dit pas l'inverse`, async () => {
    const { depot } = poserLieu(role);
    const { dit } = await converger(role, depot);
    assert.match(dit, /🛡️ +armé/, 'la sortie doit nommer l’armement du lieu');
    assert.doesNotMatch(dit, /DÉSARMÉ/, 'et ne pas annoncer les deux états à la fois');
  });

  test(`${role.nom} : un hook QUI N'EST PAS LE GARDE ne vaut pas « armé »`, async () => {
    // ⚠️ CET ESSAI EXISTE PARCE QU'UNE MUTATION A SURVÉCU SANS LUI. Remplacer la sonde
    // « la commande appelle le garde » par « la commande n'est pas vide » laissait la suite
    // entièrement verte : le rendu annonçait « armé » sur n'importe quel hook.
    //
    // Ce n'est pas un cas de laboratoire — le pack distribue lui-même des hooks de session
    // (vérification de version, état d'app). Un lieu qui n'en porterait qu'un s'entendrait
    // dire protégé alors qu'il ne l'est pas : le rendu qui existe pour rompre un silence
    // mentirait à sa place, ce qui est pire que le silence.
    // ⚠️ LE HOOK ÉTRANGER EST SOUS `PreToolUse`, ET C'EST TOUT LE POINT. Une première version
    // le rangeait sous `SessionStart` : dès que la sonde s'est bornée à `PreToolUse` — le
    // durcissement d'un AUTRE défaut — cet essai a cessé de couvrir ce qu'il couvrait, et la
    // mutation qu'il existait pour tuer a resurgi verte. Un essai peut se vider par le côté.
    //
    // Sous `PreToolUse`, le hook étranger est bel et bien VU par la sonde : c'est là que la
    // question « est-ce le garde ? » se pose vraiment, et là qu'y répondre par « il y a
    // quelque chose » serait faux.
    const { depot, lieu } = poserLieu(role);
    const s = JSON.parse(readFileSync(settingsDu(lieu), 'utf8'));
    s.hooks = { PreToolUse: [{ hooks: [{ type: 'command', command: 'bash .claude/hooks/un-autre-controle.sh' }] }] };
    writeFileSync(settingsDu(lieu), `${JSON.stringify(s, null, 2)}\n`);

    const { dit } = await converger(role, depot, { dryRun: true });
    assert.match(dit, /⚠️ +DÉSARMÉ/, 'un hook étranger au garde laisse le lieu DÉSARMÉ');
    assert.doesNotMatch(dit, /🛡️ +armé/, 'et ne doit jamais s’annoncer armé');
  });

  test(`${role.nom} : à blanc, un lieu désarmé s'entend dire DÉSARMÉ — sans provoquer de blocage`, async () => {
    // ⚠️ LE COUPLE SYMÉTRIQUE EST LE CŒUR DE CE CONTRÔLE. Une sonde qui ne cherche qu'un mot
    // dans une sortie est satisfaite par n'importe quel texte qui le contient — un préfixe de
    // répertoire temporaire a suffi, pendant l'écriture de ce fichier, à rendre vert un essai
    // qui n'avait rien mesuré. Exiger l'état JUSTE et l'ABSENCE de l'autre ne se satisfait
    // plus par accident.
    //
    // À blanc, rien n'est écrit : le lieu reste tel qu'il est, et la commande le DIT. C'est ce
    // qui répond à « un lieu peut dire s'il est armé sans qu'on ait à provoquer un blocage » —
    // la question se pose, elle ne se déclenche pas.
    const { depot } = poserLieu(role);
    const { dit } = await converger(role, depot, { dryRun: true });
    assert.match(dit, /⚠️ +DÉSARMÉ/, 'à blanc, un lieu désarmé doit s’entendre dire désarmé');
    assert.doesNotMatch(dit, /🛡️ +armé/, 'et pas armé en même temps');
  });
}

// ═══════════════════════ 4-bis. le rendu ne mentira pas — deux angles trouvés en revue

/**
 * Écrit un `settings.json` de lieu porteur d'un `hooks` ARBITRAIRE, et rend ce que la
 * convergence en dit. Sert les deux familles ci-dessous, qui ne se distinguent que par la
 * forme qu'on lui donne.
 */
async function ceQuElleDitDe(role, hooks) {
  const { depot, lieu } = poserLieu(role);
  const s = JSON.parse(readFileSync(settingsDu(lieu), 'utf8'));
  s.hooks = hooks;
  writeFileSync(settingsDu(lieu), `${JSON.stringify(s, null, 2)}\n`);
  return converger(role, depot, { dryRun: true });
}

for (const role of ROLES) {
  test(`${role.nom} : le garde câblé AILLEURS QUE SUR PreToolUse ne vaut pas « armé »`, async () => {
    // ⚠️ TROUVÉ EN REVUE. La sonde parcourait TOUS les événements : un garde rangé sous
    // `SessionStart` la satisfaisait. Or le garde n'existe que comme PreToolUse — ailleurs il
    // ne s'interpose devant aucun appel d'outil, et le lieu est aussi nu que sans lui.
    // Annoncer « armé » dans ce cas rejoue le mensonge que ce ticket ferme, déplacé d'un cran.
    const { dit } = await ceQuElleDitDe(role, { SessionStart: [{ hooks: [{ type: 'command', command: COMMANDE_GARDE }] }] });
    assert.match(dit, /⚠️ +DÉSARMÉ/, 'un garde hors PreToolUse ne garde rien');
    assert.doesNotMatch(dit, /🛡️ +armé/, 'et ne doit pas s’annoncer armé');
  });

  // Trois formes de `hooks` syntaxiquement valides en JSON mais structurellement fausses. Elles
  // faisaient lever un TypeError non rattrapé : la commande rendait `exit 1` et un message
  // interne, là où elle réussissait AVANT ce lot. Une régression, et la pire espèce — celle qui
  // casse l'observabilité qu'on venait d'ajouter.
  const FORMES_FAUSSES = [
    ['PreToolUse est un objet', { PreToolUse: { a: 1 } }],
    ['le bloc porte une chaîne', { PreToolUse: [{ hooks: 'garde-ouverture-ligne.js' }] }],
    ['hooks est un tableau', [{ x: 1 }]],
  ];
  for (const [quoi, hooks] of FORMES_FAUSSES) {
    test(`${role.nom} : un « hooks » mal formé (${quoi}) ne fait pas échouer la commande`, async () => {
      const { code, dit } = await ceQuElleDitDe(role, hooks);
      assert.notEqual(code, 1, 'la commande ne doit pas échouer sur une forme qu’elle sait seulement ne pas reconnaître');
      assert.match(dit, /⚠️ +DÉSARMÉ|armement INCONNU/, 'elle doit DIRE ce qu’elle a trouvé, pas se taire');
      assert.doesNotMatch(dit, /🛡️ +armé/, 'et surtout pas annoncer un armement');
    });
  }
}

// ═══════════════════════ 4-ter. trois mutations qui survivaient à la suite

for (const role of ROLES) {
  test(`${role.nom} : PLUSIEURS blocs PreToolUse, un seul porteur du garde → ARMÉ`, async () => {
    // ⚠️ MUTATION SURVIVANTE, TROUVÉE EN REVUE. Aucune fixture ne construisait un événement à
    // deux blocs : remplacer le `some` des blocs par `every` laissait toute la suite verte.
    //
    // Or la forme à plusieurs blocs est celle de la PRODUCTION — `fusionnerGarde` ajoute le
    // garde À LA SUITE des PreToolUse déjà présents. Et Claude Code les exécute tous : un seul
    // bloc porteur suffit à armer. Un `every` aurait déclaré désarmé un lieu réellement gardé,
    // ce qui ferait courir après une protection déjà en place.
    const { dit } = await ceQuElleDitDe(role, {
      PreToolUse: [
        { hooks: [{ type: 'command', command: 'bash .claude/hooks/autre-chose.sh' }] },
        { hooks: [{ type: 'command', command: COMMANDE_GARDE }] },
      ],
    });
    assert.match(dit, /🛡️ +armé/, 'un bloc porteur parmi plusieurs suffit à armer le lieu');
    assert.doesNotMatch(dit, /DÉSARMÉ/, 'et ne doit pas se lire comme un désarmement');
  });

  // « Je n'ai pas pu regarder » n'est pas « il n'y a rien ». Les deux mutations qui confondaient
  // ces deux états (`return null` → `return false`) survivaient : aucune fixture ne présentait
  // un lieu dont le fichier de droits manque ou ne se lit pas, alors que ce sont les deux formes
  // d'un lieu posé PARTIELLEMENT — celles où annoncer « DÉSARMÉ » enverrait réparer un
  // armement quand c'est la pose qu'il faut reprendre.
  const ILLISIBLES = [
    ['absent', (chemin) => rmSync(chemin)],
    ['corrompu', (chemin) => writeFileSync(chemin, '{ ceci n’est pas du JSON')],
  ];
  for (const [quoi, casser] of ILLISIBLES) {
    test(`${role.nom} : un fichier de droits ${quoi} se dit INCONNU, jamais « désarmé »`, async () => {
      const { depot, lieu } = poserLieu(role);
      casser(settingsDu(lieu));
      const { dit } = await converger(role, depot, { dryRun: true });
      assert.match(dit, /armement INCONNU/, `un fichier ${quoi} est un état à dire, pas à deviner`);
      assert.doesNotMatch(dit, /DÉSARMÉ/, 'ne pas annoncer un désarmement qu’on n’a pas constaté');
      assert.doesNotMatch(dit, /🛡️ +armé/, 'ni un armement');
    });
  }
}

// ═══════════════════════ 5. l'accord des deux lots : le gabarit porte le garde du pack

test('LES DEUX GABARITS portent EXACTEMENT le garde que la naissance pose', () => {
  for (const role of ROLES) {
    const commandes = commandesDeHook(settingsDuGabarit(role));
    assert.ok(
      commandes.includes(COMMANDE_GARDE),
      `le gabarit « ${role.gabarit} » doit porter COMMANDE_GARDE mot pour mot — c'est ce qui `
        + 'fait que la convergence PORTE l’armement au lieu de l’effacer'
    );
  }
});

test('le garde du gabarit est celui que fusionnerGarde produirait — aucune divergence de forme', () => {
  // Ce contrôle est le filet de la copie assumée : `COMMANDE_GARDE` vit dans `naissance.js`,
  // et les deux gabarits en portent une transcription JSON. Deux textes qui portent la même
  // règle divergent au premier changement de l'un — celui-ci rougit ce jour-là.
  for (const role of ROLES) {
    const gabarit = settingsDuGabarit(role);
    const sansHooks = { ...gabarit };
    delete sansHooks.hooks;
    assert.deepEqual(
      gabarit.hooks, fusionnerGarde(sansHooks).hooks,
      `le bloc « hooks » du gabarit « ${role.gabarit} » a divergé de ce que la naissance pose`
    );
  }
});

test('le garde du gabarit ne cite AUCUN chemin de poste absolu — il voyage chez les clients', () => {
  // Un chemin absolu du poste où le gabarit a été écrit ne résout nulle part ailleurs, et le
  // lieu part chez un client. Le garde se désigne par `$HOME`, comme les autres outils de
  // poste que le gabarit autorise déjà.
  for (const role of ROLES) {
    const commandes = commandesDeHook(settingsDuGabarit(role));
    // Sans cette ligne, l'essai serait VERT sur un gabarit sans aucun hook — une assertion
    // négative sur un ensemble vide ne prouve rien de ce qu'elle prétend couvrir.
    assert.ok(commandes.length > 0, `le gabarit « ${role.gabarit} » ne porte aucun hook : il n'y a rien à examiner`);
    for (const c of commandes) {
      assert.doesNotMatch(c, /\/Users\/|\/home\/|\/worktrees\//, `chemin de poste dans le garde du gabarit « ${role.gabarit} » : ${c}`);
    }
  }
});

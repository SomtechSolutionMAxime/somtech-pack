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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
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
function poserLieu(role, { permissionsPerimees = true } = {}) {
  const depot = mkdtempSync(join(tmpdir(), 'smtk-cv-'));
  const lieu = join(depot, role.dossier, NOM);
  mkdirSync(lieu, { recursive: true });
  cpSync(join(REPO, '.claude', 'templates', role.gabarit), lieu, { recursive: true });
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE_ECRIT_A_LA_MAIN);
  if (permissionsPerimees) {
    const s = settingsDuGabarit(role);
    s.permissions = { deny: ['Write'] }; // périmé : le gabarit en dit davantage
    writeFileSync(settingsDu(lieu), `${JSON.stringify(s, null, 2)}\n`);
  }
  return { depot, lieu };
}

/** La convergence, telle qu'un humain la lance — et ce qu'elle a écrit à l'écran. */
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

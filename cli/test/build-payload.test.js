// Test du build de payload bundlé (anti-drift).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolvePayloadRoot, readManifest, defaultModules } from '../src/modules.js';
import { collectFiles } from '../src/engine.js';
// La table RÉELLE des rôles dont le CLI sait rafraîchir le lieu, importée — jamais recopiée.
import { ROLES as REGISTRE_DU_CLI } from '../src/commands/representant.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const REPO = resolve(CLI_DIR, '..');
const BUILD = join(CLI_DIR, 'scripts', 'build-payload.mjs');

function buildInto(out) {
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: out }, stdio: 'pipe' });
}

test('build-payload : embarque pack.json + VERSION + modules, identiques au repo', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-payload-build-'));
  buildInto(out);

  // pack.json bundlé == pack.json du repo (pas de drift)
  assert.ok(existsSync(join(out, 'pack.json')), 'pack.json manquant');
  assert.equal(
    readFileSync(join(out, 'pack.json'), 'utf8'),
    readFileSync(join(REPO, 'pack.json'), 'utf8'),
    'pack.json bundlé diverge du repo'
  );
  if (existsSync(join(REPO, 'VERSION'))) {
    assert.ok(existsSync(join(out, 'VERSION')), 'VERSION manquant dans le payload');
  }

  // Un fichier de module connu est présent et IDENTIQUE à la source du repo.
  const sample = 'scripts/remote-install.sh';
  assert.ok(existsSync(join(out, sample)), `${sample} absent du payload`);
  assert.equal(
    readFileSync(join(out, sample), 'utf8'),
    readFileSync(join(REPO, sample), 'utf8'),
    `${sample} bundlé diverge du repo (drift)`
  );
});

test('build-payload : le canvas voyage dans le paquet, prêt à démarrer', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-payload-build-'));
  buildInto(out);

  // Sans ces fichiers, /canvas échoue à sa première étape chez celui qui installe.
  for (const f of [
    'herdr-plugins/excalidraw/herdr-plugin.toml',
    'herdr-plugins/excalidraw/server/server.js',
    'herdr-plugins/excalidraw/server/bin.js',
    'herdr-plugins/excalidraw/scripts/open.sh',
  ]) {
    assert.ok(existsSync(join(out, f)), `${f} absent du paquet — le canvas ne démarrera pas`);
  }

  // La page construite et les dépendances d'exécution du serveur ne sont pas versionnées :
  // la chaîne de publication les produit avant de construire le paquet. Quand elles sont
  // là, elles doivent voyager — sinon le paquet promet un canvas qu'il ne livre pas.
  for (const [src, why] of [
    ['herdr-plugins/excalidraw/web/dist', 'la page construite'],
    ['herdr-plugins/excalidraw/node_modules', "les dépendances d'exécution du serveur"],
  ]) {
    if (existsSync(join(REPO, src))) {
      assert.ok(existsSync(join(out, src)), `${why} (${src}) présente au dépôt mais absente du paquet`);
    }
  }
});

test('build-payload : aucun résidu de construction ni d\'exécution dans le paquet', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-payload-build-'));
  buildInto(out);

  for (const residue of [
    'herdr-plugins/excalidraw/web/node_modules',
    'herdr-plugins/excalidraw/web/src',
    'herdr-plugins/excalidraw/web/vite.config.js',
    'herdr-plugins/excalidraw/.herdr',
    'herdr-plugins/excalidraw/tests',
  ]) {
    assert.ok(!existsSync(join(out, residue)), `${residue} n'a rien à faire dans le paquet publié`);
  }
});

/** Les fichiers d'un gabarit, en chemins relatifs — répertoires imbriqués compris. */
function fichiersDe(racine, prefixe = '') {
  const out = [];
  for (const e of readdirSync(join(racine, prefixe), { withFileTypes: true })) {
    const rel = prefixe ? `${prefixe}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...fichiersDe(racine, rel));
    else out.push(rel);
  }
  return out;
}

/**
 * LES GABARITS DE RÔLE QUE LE PAQUET DOIT EMBARQUER — MESURÉS, PLUS ÉCRITS À LA MAIN
 * (T-20260826-0083).
 *
 * La liste valait `['gestionnaire-client', 'orchestrateur']`, en toutes lettres, dans le test
 * ci-dessous. C'est le même défaut que celui dont ce test porte déjà la cicatrice, d'un cran
 * plus haut : il avait cessé d'énumérer les FICHIERS d'un gabarit, il énumérait toujours les
 * RÔLES. Mesuré le 2026-08-26 : un troisième rôle déposé sous `.claude/templates/developpeur/`,
 * réellement rendu et distribué, portant un fichier que `npm pack` retire du tarball, laissait
 * les CINQ contrôles de ce fichier au vert. Le gabarit était amputé dans le paquet publié et
 * rien ne le disait — l'agent naîtrait chez le client sans son métier.
 *
 * ⚠️ LA POPULATION EST L'UNION DE DEUX DÉCLARATIONS, ET C'EST MESURÉ :
 *
 *   • le REGISTRE du CLI (`ROLES` de `src/commands/representant.js`) → les rôles dont un lieu
 *     se pose et se rafraîchit, par leur nom de gabarit ;
 *   • `metier/*` → les rôles dont un métier est rendu, donc distribué à un gabarit.
 *
 * Prendre l'un seul laisserait un trou dans le sens de l'autre : un rôle rendu mais pas encore
 * inscrit au registre, ou inscrit mais pas encore rendu, est PRÉCISÉMENT l'état d'un rôle en
 * cours de naissance — celui des neuf rôles arbitrés (P-20260819-0001).
 *
 * ⚠️ ET `bootstrap` EN SORT PAR SA NATURE, JAMAIS PAR SON NOM. Énumérer `.claude/templates/*`
 * rendrait TROIS répertoires (mesuré) : `bootstrap` s'y ajoute, alors qu'il est un gabarit de
 * sources de vérité — le lieu de personne, sans métier rendu ni entrée au registre, et sans les
 * quatre fichiers qu'un lieu porte. L'écarter demanderait une liste d'exceptions, et une liste
 * d'exceptions se désarme par un geste qui ressemble à de l'entretien. Ici il n'est déclaré
 * nulle part comme rôle : il n'entre pas.
 */
function gabaritsDeRole(racine) {
  const duRegistre = Object.values(REGISTRE_DU_CLI).map((r) => r.gabarit);
  const base = join(racine, 'metier');
  const rendus = existsSync(base)
    ? readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  return [...new Set([...duRegistre, ...rendus])].sort();
}

test('paquet npm : le canvas et les gabarits du représentant survivent à la fabrication du tarball', () => {
  // Le test précédent inspecte le RÉPERTOIRE payload. Ça ne prouve rien sur ce que npm
  // met réellement dans le tarball : npm applique les fichiers d'ignore imbriqués au
  // moment de packer. Un payload parfait peut donc produire un paquet amputé — c'est
  // arrivé, et ni les tests ni la CI ni la publication ne s'en apercevaient.
  // Ce test interroge la liste réelle du paquet, pas le disque.
  const payload = join(CLI_DIR, 'payload');
  buildInto(payload);

  // La page construite et les dépendances du serveur ne sont pas versionnées : la chaîne
  // de publication les produit. On les simule ici pour que le test vaille aussi sur un
  // dépôt fraîchement récupéré, où elles sont absentes — c'est précisément le cas de la CI,
  // et c'est là que le défaut passait inaperçu.
  // Noms volontairement inexistants ailleurs : planter `node_modules/ws/index.js`
  // écraserait le vrai point d'entrée de `ws` dans le répertoire de construction.
  // Ces chemins exercent exactement les mêmes règles du filtre.
  const planted = [
    join(payload, 'herdr-plugins/excalidraw/web/dist/__sonde__.html'),
    join(payload, 'herdr-plugins/excalidraw/node_modules/__sonde__/index.js'),
  ];
  for (const f of planted) {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, '// artefact simulé pour le test\n');
  }

  let files;
  try {
    const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: CLI_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    files = JSON.parse(out)[0].files.map((f) => f.path);
  } finally {
    // Ne rien laisser derrière : `resolvePayloadRoot` préfère `cli/payload` à la racine du
    // dépôt, donc un artefact de test oublié ici se retrouverait installé par quiconque
    // lance le CLI depuis un clone.
    for (const f of planted) rmSync(f, { force: true });
    rmSync(join(payload, 'herdr-plugins/excalidraw/node_modules/__sonde__'), { recursive: true, force: true });
  }

  for (const f of [
    'payload/herdr-plugins/excalidraw/server/server.js',
    'payload/herdr-plugins/excalidraw/herdr-plugin.toml',
    'payload/herdr-plugins/excalidraw/web/dist/__sonde__.html',
    'payload/herdr-plugins/excalidraw/node_modules/__sonde__/index.js',
  ]) {
    assert.ok(
      files.includes(f),
      `${f} présent dans le payload mais absent du paquet npm : quelque chose l'a retiré au packing (fichier d'ignore embarqué ?) — le canvas ne démarrera pas`
    );
  }

  // Les gabarits des deux rôles qui posent un lieu — représentant (E-20260807-0001/0002) et
  // orchestrateur (E-20260813-0001/0002). Ils sont vérifiés ICI et non dans leur propre
  // fichier de test, et ce n'est pas un rangement arbitraire : `npm pack` lit `cli/payload`,
  // et `node --test` exécute un PROCESSUS PAR FICHIER. Deux fichiers qui construisent ce même
  // répertoire se marchent dessus — l'un supprime le payload pendant que l'autre l'empaquette,
  // et le test qui perd la course accuse un fichier d'ignore imaginaire. Un seul fichier
  // touche donc à `cli/payload`, celui-ci.
  //
  // LA LISTE DES FICHIERS EST ÉNUMÉRÉE DEPUIS LA SOURCE, jamais écrite en dur — et c'est le
  // correctif d'un motif qui a déjà mordu quatre fois sur ce dépôt. Elle l'était : quand le
  // gabarit de l'orchestrateur a gagné son `.mcp.json` et son `settings.json`, la garde ne
  // couvrait toujours que ses deux premiers fichiers. Un orchestrateur serait né sans ses outils
  // ni ses permissions, derrière un test vert. Énumérer rend la garde juste par construction :
  // un fichier ajouté demain au gabarit est couvert sans que personne y pense.
  //
  // ⚠️ ET LA LISTE DES RÔLES L'EST DEPUIS LE 2026-08-26 (T-20260826-0083) : elle disait
  // `['gestionnaire-client', 'orchestrateur']`. Le même défaut, d'un cran plus haut — les
  // fichiers étaient énumérés, les rôles non. Voir `gabaritsDeRole` pour ce qui est mesuré,
  // pourquoi c'est l'UNION du registre et de `metier/`, et pourquoi `bootstrap` en sort par sa
  // nature.
  const gabarits = gabaritsDeRole(REPO);

  // ⚠️ SANS CE CONTRÔLE, LA GARDE SE DÉSARME TOUTE SEULE. Ce qui suit est une boucle : une
  // énumération VIDE la traverse sans une assertion, et le test passe au vert en n'ayant rien
  // mesuré. « Un test qui attend RIEN ne peut pas distinguer *rien trouvé* de *rien cherché* »
  // (feed du 2026-08-25).
  assert.ok(
    gabarits.length > 0,
    'aucun gabarit de rôle énuméré : le registre du CLI est vide et « metier/ » ne porte aucun '
      + 'sous-dossier. Les contrôles qui suivent ne sont pas verts — ils n\'existent pas.',
  );

  for (const role of gabarits) {
    const source = join(REPO, '.claude', 'templates', role);
    assert.ok(
      existsSync(source),
      `le rôle « ${role} » est déclaré (registre du CLI ou metier/) mais ne porte aucun gabarit `
        + `sous .claude/templates/ — le paquet ne peut rien embarquer pour lui, et un lieu posé `
        + `sur ce rôle naîtrait vide`,
    );
    const attendus = fichiersDe(source).map((rel) => `payload/.claude/templates/${role}/${rel}`);
    assert.ok(
      attendus.length >= 4,
      `le gabarit « ${role} » ne porte que ${attendus.length} fichier(s) : le lieu en compte quatre, `
        + `et une garde qui en énumère moins ne garde plus rien`,
    );
    for (const f of attendus) {
      assert.ok(
        files.includes(f),
        `${f} présent dans le payload mais absent du paquet npm : quelque chose l'a retiré au `
          + `packing — l'agent naîtrait sans son métier, sans ses outils, ou avec des moyens non bornés`,
      );
    }
  }
});

test('build-payload : le payload produit est un payload CLI consommable', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-payload-build-'));
  buildInto(out);

  const root = resolvePayloadRoot({ source: out });
  assert.equal(root, resolve(out));
  const m = readManifest(root);
  assert.ok(defaultModules(m).includes('core'));
  const { files } = collectFiles(root, m.modules.core.paths);
  assert.ok(files.length > 0, 'le module core du payload bundlé doit contenir des fichiers');
});

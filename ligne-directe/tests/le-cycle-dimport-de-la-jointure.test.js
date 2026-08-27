// LE CYCLE D'IMPORT ENTRE LA JOINTURE ET LA GARDE — éprouvé par TOUTES ses portes, jamais par
// une liste écrite à la main. (T-20260825-0012, sous E-20260825-0002, D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE BANC EXISTE SOUS CETTE FORME PARCE QUE SA PREMIÈRE FORME A LAISSÉ PASSER UN CRASH TOTAL
//
// `garde-des-naissances.js` importe `recensement.js`. Depuis T-20260825-0012, `recensement.js`
// importe `declaration-des-agents.js`, qui importe `memeEspaceDeTravail` de la garde. Le graphe
// est donc un CYCLE, et il est délibéré : la jointure d'espace ne doit exister qu'à UN endroit —
// celui qui l'a payée (9dfad89) — et la recopier ferait porter à un agent le rôle et le
// coordonnateur d'un autre au premier correctif appliqué d'un seul côté.
//
// Un cycle ESM tient TANT QUE rien n'est LU pendant l'évaluation : les déclarations de fonction
// sont hoistées, un `const` importé ne l'est pas. La première version de la jointure lisait
// `ROLE_CHEF_EQUIPE` — importé de `chef-equipe.js` — pour composer une table AU NIVEAU MODULE.
// Résultat, en entrant par la porte de `naitre.js` :
//
//     $ node naissance-representant/bin/naitre.js --help
//     ReferenceError: Cannot access 'ROLE_CHEF_EQUIPE' before initialization
//
// **Plus aucun agent ne pouvait naître.** Les 1 067 essais du dépôt restaient verts : aucun
// n'entre par là. Et la première version de CE banc était verte aussi — elle éprouvait TROIS
// portes, choisies à la main, et la quatrième était la seule qui soit un binaire de production.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉNOMINATEUR EST DÉRIVÉ, PAS ÉCRIT — c'est tout l'objet de la réécriture
//
// Une liste de portes est désarmable par ENTRETIEN : le jour où le cycle gagne un module, on ne
// pense pas à l'ajouter, et le banc reste vert en couvrant une population qui a rétréci. Ce banc
// SUIT donc les `import` depuis la jointure, transitivement, et éprouve CHAQUE module atteint
// comme porte d'entrée. Un module ajouté au cycle est éprouvé sans qu'on y pense ; un module
// retiré disparaît du dénominateur de lui-même.
//
// ⚠️ ET LES BINAIRES SONT AJOUTÉS EN PLUS, parce qu'ils ne sont importés par personne. Ce sont
// les portes RÉELLES — celles qu'un humain tape — et c'est par l'une d'elles que le défaut est
// entré. Les éprouver par `--help` charge toute la chaîne sans rien faire naître.
//
// ⚠️ CHAQUE PORTE DANS UN PROCESSUS NEUF. Un `import()` dans le même processus rendrait le
// module déjà chargé par la porte précédente, et ne mesurerait plus rien.
//
// 📌 LE VRAI CORRECTIF EST AILLEURS, ET IL EST REMONTÉ : `memeEspaceDeTravail` ne dépend que de
// `realpathSync` — c'est une feuille garée chez la garde. La sortir dans son propre module
// romprait le cycle sans rien dupliquer. `naissance-representant/` est le lot d'un autre agent,
// en cours de revue ; ce banc tient la propriété en attendant que ce déménagement soit possible.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const JOINTURE = resolve(ICI, '..', 'src', 'declaration-des-agents.js');
const RECENSEMENT = resolve(ICI, '..', 'src', 'recensement.js');
const GARDE = resolve(ICI, '..', '..', 'naissance-representant', 'src', 'garde-des-naissances.js');

/** Les `package.json` du dépôt qui déclarent des binaires — les deux modules de ce cycle. */
const PAQUETS = [
  resolve(ICI, '..', 'package.json'),
  resolve(ICI, '..', '..', 'naissance-representant', 'package.json'),
];

/**
 * LES PORTES QU'UN HUMAIN TAPE — DÉRIVÉES DES `package.json`, jamais listées à la main.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 C'ÉTAIT UNE LISTE DE DEUX ENTRÉES, ET ELLE ÉTAIT DÉJÀ INCOMPLÈTE. `naissance-representant`
 * déclare CINQ binaires ; deux figuraient ici. L'un des absents —
 * `bin/garde-des-naissances.js` — atteint pourtant ce cycle
 * (`naissances-des-sessions.js` → `garde-des-naissances.js` → `recensement.js` → la jointure).
 * Il ne plantait pas le jour du défaut, mais par ACCIDENT d'ordre d'import : il ne charge jamais
 * `chef-equipe.js`. Une liste écrite à la main au milieu d'un dispositif qui se veut dérivé est
 * le « désarmable par entretien » que ce fichier déclare fermer — on n'ajoute pas la porte
 * manquante, on retire la liste.
 *
 * ⚠️ ON N'ÉPROUVE QUE CEUX QUI ATTEIGNENT LE CYCLE. Un binaire qui n'y touche pas ne dit rien de
 * sa santé, et le lancer coûterait un processus pour rien.
 */
function binairesQuiAtteignentLeCycle() {
  const trouves = [];
  for (const paquet of PAQUETS) {
    if (!existsSync(paquet)) continue;
    const racine = dirname(paquet);
    const bin = JSON.parse(readFileSync(paquet, 'utf8')).bin ?? {};
    for (const chemin of Object.values(bin)) {
      const fichier = resolve(racine, chemin);
      if (existsSync(fichier) && modulesAtteints(fichier).includes(JOINTURE)) trouves.push(fichier);
    }
  }
  return trouves;
}

/**
 * LES ARÊTES QUE PORTE UN FICHIER — les chemins RELATIFS qu'il importe, statiquement ou non.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 ON APPARIE `from '<chemin>'`, PAS LA TÊTE DE L'INSTRUCTION — ET C'EST UN CORRECTIF.
 *
 * La première expression était ancrée sur `^\s*(?:import|export)[^'"\n]*from` : le `[^'"\n]*`
 * exclut le saut de ligne, donc elle ne pouvait apparier AUCUN import multi-lignes. Or
 * `recensement.js` en porte un, et c'est très exactement l'arête qui REFERME le cycle que ce
 * banc existe pour couvrir :
 *
 *     import {
 *       declarationDeLAgent, roleDeclareDe, libellesDuRoleDeclare, SOURCE_DECLAREE,
 *     } from './declaration-des-agents.js';
 *
 * Le dénominateur ne rétrécissait pas AUJOURD'HUI — cette arête pointe vers la racine de la
 * traversée, déjà vue — mais un futur import multi-lignes vers un module qu'aucun autre chemin
 * n'atteint le ferait disparaître du graphe sans qu'aucun rouge ne le dise. C'est le
 * « désarmable par entretien » que ce fichier déclare fermer, logé dans l'instrument qui le ferme.
 *
 * ⚠️ ON NE SUIT QUE LES CHEMINS RELATIFS. `node:fs` et consorts ne participent à aucun cycle du
 * dépôt. Et ce qu'on trouve dans un commentaire ou une chaîne coûte un `existsSync` de trop,
 * jamais un faux verdict — la traversée ignore ce qui n'existe pas.
 */
function aretesDe(source) {
  const chemins = [];
  // `from '<relatif>'` — couvre l'import et l'export, sur une ligne comme sur dix.
  for (const m of source.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]/g)) chemins.push(m[1]);
  // Les imports dynamiques comptent autant : ils chargent la même chaîne, plus tard.
  for (const m of source.matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g)) chemins.push(m[1]);
  return chemins;
}

/** Tous les modules que la jointure atteint — suivis par leurs arêtes, transitivement. */
function modulesAtteints(depuis) {
  const vus = new Set();
  const aVoir = [depuis];
  while (aVoir.length) {
    const fichier = aVoir.pop();
    if (vus.has(fichier) || !existsSync(fichier)) continue;
    vus.add(fichier);
    for (const chemin of aretesDe(readFileSync(fichier, 'utf8'))) {
      aVoir.push(resolve(dirname(fichier), chemin));
    }
  }
  return [...vus];
}

/** Entre par UN fichier, dans un processus NEUF, et rend sa sortie — ou jette avec sa cause. */
function parLaPorte(fichier, expression = "''") {
  return execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const m = await import(${JSON.stringify(fichier)}); process.stdout.write(String(${expression}));`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⓪ L'INSTRUMENT AVANT LA MESURE — un graphe qui rate une arête ment sur son dénominateur.
//
// ⚠️ CE BANC ÉPROUVE `aretesDe`, PAS LE CYCLE. Il existe parce que la première version de
// l'extracteur ratait EN SILENCE l'arête qui referme le cycle (import multi-lignes), et que le
// banc du cycle restait vert : son dénominateur avait rétréci sans que rien ne le dise. Une
// mesure ne se croit pas — surtout celle qui décide de ce qu'on va mesurer.
test('l’extracteur d’arêtes voit un import MULTI-LIGNES — l’arête qui referme le cycle', () => {
  const arêtes = aretesDe(readFileSync(RECENSEMENT, 'utf8'));
  assert.ok(
    arêtes.includes('./declaration-des-agents.js'),
    `l’arête qui referme le cycle est absente du graphe : ${arêtes.join(', ')}`,
  );

  // Et les trois formes se lisent, sur une source écrite ici — pas sur un fichier du dépôt, qui
  // pourrait cesser de les porter sans que ce banc s'en aperçoive.
  const formes = [
    "import { a } from './sur-une-ligne.js';",
    "import {\n  a,\n  b,\n} from './sur-plusieurs-lignes.js';",
    "export { c } from './reexporte.js';",
    "const m = await import('./dynamique.js');",
  ].join('\n');
  assert.deepEqual(aretesDe(formes), [
    './sur-une-ligne.js',
    './sur-plusieurs-lignes.js',
    './reexporte.js',
    './dynamique.js',
  ]);
});

test('CHAQUE module que la jointure atteint tient comme porte d’entrée', () => {
  const portes = modulesAtteints(JOINTURE);
  // ⚠️ LE DÉNOMINATEUR SE DIT. Un graphe qui rétrécit en silence — parce qu'un import a été
  // retiré, ou parce que l'expression qui les lit a cessé d'apparier — rendrait ce banc vert sur
  // une population d'une seule porte. Le plancher est mesuré : la jointure, la garde, le
  // recensement, `chef-equipe.js`, `declaration.js`, `roles.js` en font partie le 2026-08-27.
  assert.ok(portes.length >= 6, `le graphe n’a rendu que ${portes.length} module(s) : ${portes.join(', ')}`);
  assert.ok(portes.includes(GARDE), 'la garde doit être dans le graphe de la jointure');
  assert.ok(
    portes.some((f) => f.endsWith('chef-equipe.js')),
    'chef-equipe.js doit être dans le graphe — c’est par lui que le crash est entré',
  );

  const tombees = [];
  for (const porte of portes) {
    try {
      parLaPorte(porte);
    } catch (err) {
      tombees.push(`${porte} → ${String(err?.stderr || err?.message).trim().split('\n')[0]}`);
    }
  }
  assert.deepEqual(tombees, [], `des portes du cycle ne tiennent pas :\n${tombees.join('\n')}`);
});

test('les binaires démarrent — ce sont les portes qu’un humain tape', () => {
  const binaires = binairesQuiAtteignentLeCycle();
  // ⚠️ LE DÉNOMINATEUR SE DIT, comme celui des modules. Un `package.json` illisible, un `bin`
  // renommé, une traversée qui cesse d'atteindre la jointure : ce banc rendrait alors vert sur
  // une population VIDE. Le plancher est mesuré — `naitre.js`, `ligne-directe.js` et
  // `garde-des-naissances.js` atteignent ce cycle le 2026-08-27.
  assert.ok(binaires.length >= 3, `seuls ${binaires.length} binaire(s) atteignent le cycle : ${binaires.join(', ')}`);
  assert.ok(
    binaires.some((f) => f.endsWith('naitre.js')),
    'naitre.js doit en être — c’est la porte par laquelle le crash est entré',
  );

  const tombes = [];
  for (const binaire of binaires) {
    try {
      execFileSync(process.execPath, [binaire, '--help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      // ⚠️ UN `--help` PEUT SORTIR NON NUL SANS ÊTRE CASSÉ — certains rendent 1 par convention.
      // Ce qu'on refuse est une panne de CHARGEMENT, et elle se nomme.
      const cause = String(err?.stderr || err?.message);
      if (/ReferenceError|SyntaxError|Cannot access|before initialization|ERR_MODULE/.test(cause)) {
        tombes.push(`${binaire} → ${cause.trim().split('\n').slice(0, 3).join(' | ')}`);
      }
    }
  }
  assert.deepEqual(tombes, [], `des binaires ne chargent plus :\n${tombes.join('\n')}`);
});

test('les constantes du cycle sont lisibles quelle que soit la porte', () => {
  // ⚠️ ON LIT DES `const`, PAS SEULEMENT DES FONCTIONS. Les fonctions sont hoistées : les
  // interroger seules rendrait ce banc vert sur le cycle même qui vient de casser en production.
  assert.equal(parLaPorte(GARDE, 'm.TOLERANCE_DE_DATATION_MS'), String(60 * 60 * 1000));
  assert.equal(parLaPorte(JOINTURE, "m.libellesDuRoleDeclare('chef-equipe').libelle"), 'chef d’équipe');
});

test('la jointure d’espace du recensement EST celle de la garde, pas une copie', async () => {
  const jointure = await import(JOINTURE);
  const garde = await import(GARDE);
  // ⚠️ ON COMPARE UN COMPORTEMENT QUE SEULE LA VRAIE FONCTION A. Vérifier que le module
  // l'importe (par un grep, ou en comparant deux références) prouve un CÂBLAGE ; ceci prouve la
  // RÈGLE — le séparateur fait la frontière, jamais le préfixe. Une copie écrite à la main dans
  // la jointure passerait le premier contrôle et tomberait sur celui-ci dès qu'elle diverge.
  const espace = '/Users/qui/worktrees/depot/20260827-000000';
  assert.equal(garde.memeEspaceDeTravail(`${espace}-bis`, espace), false);
  assert.equal(garde.memeEspaceDeTravail(`${espace}/ligne-directe`, espace), true);
  // Et la jointure rend le même verdict, sur le même couple, à travers son propre appariement.
  const declaration = { nom: 'a', role: 'chef-equipe', espace, pane: 'w1:p1', session_herdr: 'somtech' };
  const nom = { mesure: 'lu', valeur: 'a' };
  assert.equal(
    jointure.declarationDeLAgent({ pane: 'w9:p9', session: 'somtech', espace: `${espace}-bis`, nom }, [declaration]),
    null
  );
  assert.equal(
    jointure.declarationDeLAgent({ pane: 'w9:p9', session: 'somtech', espace: `${espace}/ligne-directe`, nom }, [declaration]),
    declaration
  );
});

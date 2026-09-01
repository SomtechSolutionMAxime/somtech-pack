// registre-des-roles-miroir.test.js — LES DEUX TABLES DE RÔLES DOIVENT DIRE LA MÊME CHOSE.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI MANQUAIT, ET COMMENT ON L'A SU (T-20260826-0076)
//
// `cli/src/commands/representant.js` porte une SECONDE table de rôles, qui double
// `ligne-directe/src/roles.js`. Son commentaire déclarait la divergence assumée et
// affirmait, pour la rendre inoffensive : « un test les compare à la source pour que la
// divergence rougisse si elle s'installe ».
//
// ⚠️ CE TEST N'EXISTAIT PAS. Mesuré le 2026-08-26, par mutation, sur une copie hors dépôt :
//
//   • un TROISIÈME rôle inscrit au registre, avec son dossier de gabarits, et absent de la
//     table du CLI : 2 rouges, tous les deux sur le TEXTE d'une compétence qui énumère les
//     rôles. Zéro rouge sur la divergence des tables.
//   • un rôle FANTÔME ajouté à la table du CLI seule, pointant un gabarit qui n'existe pas :
//     ZÉRO rouge. La suite entière est restée verte.
//
// Aucun fichier de `cli/test/` n'importait `ROLES` de `representant.js` — la mesure la plus
// simple le disait déjà (`grep -rn "commands/representant" cli/test` ne rendait que `PRESERVE`
// et `CREE_SI_ABSENT`). L'affirmation était vraie d'intention et fausse de fait : elle a
// protégé du regard exactement ce qu'elle prétendait garder.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI DEUX TABLES PLUTÔT QU'UN IMPORT — la raison, remesurée
//
// Elle tient, mais pas mot pour mot. Le paquet npm publié EMBARQUE bien `ligne-directe/` :
// `cli/scripts/build-payload.mjs` copie le contenu de TOUS les modules de `pack.json`, celui-ci
// compris. Il l'embarque sous `payload/ligne-directe/`, et nulle part ailleurs — alors que
// `cli/payload/` est un ARTEFACT DE BUILD, gitignoré, reconstruit au publish.
//
// Aucun chemin d'import ne marche donc des deux côtés :
//   • `../../../ligne-directe/src/roles.js` résout dans le dépôt, et n'existe pas dans le
//     paquet publié (`files: ["bin", "src", "payload"]`) — casse CHEZ LE CLIENT, pas en CI ;
//   • `../../payload/ligne-directe/src/roles.js` résout dans le paquet, et fait dépendre le
//     code de production d'un répertoire absent d'un dépôt fraîchement cloné.
//
// La duplication reste donc le moindre mal. Ce fichier est ce qui la rend inoffensive — pour
// de vrai, cette fois.
//
// ⚠️ ET IL COMPARE L'ENSEMBLE DES CLÉS, DANS LES DEUX SENS. Une garde qui ne compare que les
// rôles PRÉSENTS DES DEUX CÔTÉS ne voit jamais un rôle manquant : c'est précisément le défaut
// qui bloquait la naissance des neuf rôles arbitrés. Un rôle qu'on ajoute au registre sans
// l'ajouter ici rougit, et le message dit le geste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Les deux tables RÉELLES, importées — jamais recopiées ici. Une troisième copie dans un test
// se déphaserait des deux autres, et la garde deviendrait verte sur une exigence périmée.
import { ROLES as TABLE_DU_CLI } from '../src/commands/representant.js';
import { rolesConnus, role as roleDe } from '../../ligne-directe/src/roles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');

/**
 * CE QUI DOIT S'ACCORDER, ET CE QU'ON LAISSE DIVERGER — la distinction est mesurée, pas de
 * confort.
 *
 * `gabarit` (CLI) ↔ `gabarits` (registre) et `dossier` DÉCIDENT : le premier nomme le dossier
 * sous `.claude/templates/` d'où la convergence lit, le second nomme le dossier racine où les
 * lieux du rôle se rangent. Les faire diverger fait écrire un lieu ailleurs que là où il vit —
 * le défaut de T-20260814-0101, en pire, puisque personne ne le verrait.
 *
 * `libelle` NE DÉCIDE DE RIEN : le CLI le compose dans des phrases qui commencent par lui
 * (« Représentant »), le registre dans des phrases où il est enchâssé (« le représentant de ce
 * client »). Exiger leur égalité rougirait sur une capitale, c'est-à-dire sur rien. On exige
 * seulement qu'il soit là et non vide des deux côtés — un libellé absent se rend « undefined »
 * dans un message que lit un humain.
 */
function ecartsDeRegistre(tableCli, registre) {
  const ecarts = [];

  for (const nom of Object.keys(registre)) {
    if (!(nom in tableCli)) {
      ecarts.push(`« ${nom} » : INSCRIT au registre, ABSENT de la table du CLI — `
        + '`pack representant-update` / `pack orchestrateur-update` ne sauraient pas rafraîchir '
        + 'son lieu. Geste : ajouter une ligne à ROLES dans cli/src/commands/representant.js.');
    }
  }
  for (const nom of Object.keys(tableCli)) {
    if (!(nom in registre)) {
      ecarts.push(`« ${nom} » : présent dans la table du CLI, ABSENT du registre — `
        + 'le CLI prétend rafraîchir un lieu qu\'aucune commande ne sait poser. '
        + 'Geste : le retirer de ROLES, ou l\'inscrire à ligne-directe/src/roles.js.');
    }
  }

  for (const nom of Object.keys(registre)) {
    const cli = tableCli[nom];
    if (!cli) continue; // déjà nommé ci-dessus ; on ne compte pas deux fois le même écart
    const src = registre[nom];
    if (cli.gabarit !== src.gabarits) {
      ecarts.push(`« ${nom} » · gabarit : le CLI lit « ${cli.gabarit} », le registre pose `
        + `« ${src.gabarits} » — la convergence irait chercher un gabarit qui n'est pas celui du rôle.`);
    }
    if (cli.dossier !== src.dossier) {
      ecarts.push(`« ${nom} » · dossier : le CLI écrit sous « ${cli.dossier} », le registre pose `
        + `sous « ${src.dossier} » — la mise à jour manquerait le lieu réel, en silence.`);
    }
    if (!cli.libelle) ecarts.push(`« ${nom} » : la table du CLI n'a pas de libellé — ses messages diraient « undefined ».`);
    if (!src.libelle) ecarts.push(`« ${nom} » : le registre n'a pas de libellé — ses messages diraient « undefined ».`);
  }

  return ecarts;
}

/** Le registre, mis à plat, pour être comparé sans que la comparaison le connaisse. */
function registreAPlat() {
  return Object.fromEntries(rolesConnus().map((nom) => [nom, roleDe(nom)]));
}

test('les deux tables de rôles portent LES MÊMES RÔLES et les mêmes chemins', () => {
  const ecarts = ecartsDeRegistre(TABLE_DU_CLI, registreAPlat());
  assert.deepEqual(ecarts, [],
    'la table ROLES de cli/src/commands/representant.js a divergé de ligne-directe/src/roles.js :\n  '
    + ecarts.join('\n  ')
    + '\n\n⚠️ Les deux tables sont dupliquées PAR NÉCESSITÉ (le paquet npm ne peut pas importer un '
    + 'module de poste — voir l\'en-tête de ce fichier). Ce test est la seule chose qui les tient '
    + 'ensemble : jusqu\'au 2026-08-26 il n\'existait pas, et la divergence était libre dans les deux sens.');
});

test('le dénominateur est MESURÉ des deux côtés, et aucun des deux n\'est vide', () => {
  // ⚠️ Sans ceci, deux registres VIDES s'accorderaient parfaitement et le test au-dessus serait
  // vert en n'ayant rien comparé — « un test qui attend RIEN ne peut pas distinguer *rien
  // trouvé* de *rien cherché* ».
  const duCli = Object.keys(TABLE_DU_CLI);
  const duRegistre = rolesConnus();
  assert.ok(duCli.length > 0, 'la table ROLES du CLI est vide — la comparaison ci-dessus ne mesurerait rien');
  assert.ok(duRegistre.length > 0, 'ligne-directe/src/roles.js n\'énumère aucun rôle — même conséquence');
  assert.equal(duCli.length, duRegistre.length,
    `${duCli.length} rôle(s) côté CLI contre ${duRegistre.length} au registre — le test ci-dessus dit lesquels`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA CONTRE-MESURE — ce qui distingue cette garde du rituel qu'elle remplace.
//
// Les deux tests ci-dessus sont VERTS aujourd'hui, et le resteraient si `ecartsDeRegistre`
// rendait `[]` sans rien regarder. C'est exactement l'état dans lequel se trouvait le dépôt
// avant ce fichier : une garantie affirmée, jamais exercée. On EXERCE donc la comparaison sur
// des tables fabriquées, un défaut à la fois.

test('CONTRE-MESURE — un rôle inscrit au registre et absent de la table du CLI est NOMMÉ', () => {
  // Le défaut exact qui bloquait les neuf rôles : le registre grandit, la table du CLI non.
  const ecarts = ecartsDeRegistre(
    { representant: { gabarit: 'g', dossier: '.d', libelle: 'R' } },
    {
      representant: { gabarits: 'g', dossier: '.d', libelle: 'r' },
      developpeur: { gabarits: 'developpeur', dossier: '.developpeur', libelle: 'développeur' },
    },
  );
  assert.equal(ecarts.length, 1, `un seul écart attendu, obtenu : ${JSON.stringify(ecarts)}`);
  assert.match(ecarts[0], /developpeur/, 'le verdict doit NOMMER le rôle manquant, pas seulement compter');
  assert.match(ecarts[0], /ABSENT de la table du CLI/);
});

test('CONTRE-MESURE — un rôle présent dans la table du CLI et absent du registre est NOMMÉ', () => {
  // Le sens inverse. Il n'est pas symétrique par accident : un rôle que le CLI croit connaître
  // et que rien ne sait poser fait échouer une commande sur un lieu qui n'existera jamais.
  const ecarts = ecartsDeRegistre(
    {
      representant: { gabarit: 'g', dossier: '.d', libelle: 'R' },
      fantome: { gabarit: 'nexiste-pas', dossier: '.fantome', libelle: 'Fantôme' },
    },
    { representant: { gabarits: 'g', dossier: '.d', libelle: 'r' } },
  );
  assert.equal(ecarts.length, 1, `un seul écart attendu, obtenu : ${JSON.stringify(ecarts)}`);
  assert.match(ecarts[0], /fantome/);
  assert.match(ecarts[0], /ABSENT du registre/);
});

test('CONTRE-MESURE — chacun des deux champs qui DÉCIDENT rougit, séparément', () => {
  // ⚠️ Un par un, pas ensemble : muter les deux à la fois rendrait un rouge qui prouve
  // qu'AU MOINS un des deux était gardé, jamais que les deux l'étaient.
  const droit = { representant: { gabarits: 'gestionnaire-client', dossier: '.gestionnaire', libelle: 'r' } };

  const surGabarit = ecartsDeRegistre(
    { representant: { gabarit: 'autre-gabarit', dossier: '.gestionnaire', libelle: 'R' } }, droit);
  assert.equal(surGabarit.length, 1, `gabarit divergent : un seul écart attendu, obtenu ${JSON.stringify(surGabarit)}`);
  assert.match(surGabarit[0], /gabarit/);

  const surDossier = ecartsDeRegistre(
    { representant: { gabarit: 'gestionnaire-client', dossier: '.ailleurs', libelle: 'R' } }, droit);
  assert.equal(surDossier.length, 1, `dossier divergent : un seul écart attendu, obtenu ${JSON.stringify(surDossier)}`);
  assert.match(surDossier[0], /dossier/);
});

test('CONTRE-MESURE — deux tables accordées ne fabriquent AUCUN écart', () => {
  // Le témoin. Sans lui, une fonction qui rendrait un écart à chaque appel passerait les
  // quatre contrôles ci-dessus et rougirait sur tout, y compris sur un dépôt sain.
  assert.deepEqual(
    ecartsDeRegistre(
      { representant: { gabarit: 'g', dossier: '.d', libelle: 'R' } },
      { representant: { gabarits: 'g', dossier: '.d', libelle: 'r' } },
    ), [],
    'deux tables qui s\'accordent doivent rendre zéro écart — sinon la garde crie sur un dépôt sain');
});

test('CONTRE-MESURE — une capitale de libellé ne rougit PAS, un libellé absent oui', () => {
  // La frontière écrite en tête de `ecartsDeRegistre`, éprouvée plutôt que déclarée.
  assert.deepEqual(
    ecartsDeRegistre(
      { representant: { gabarit: 'g', dossier: '.d', libelle: 'Représentant' } },
      { representant: { gabarits: 'g', dossier: '.d', libelle: 'représentant' } },
    ), [],
    'exiger l\'égalité des libellés ferait rougir sur une capitale — c\'est-à-dire sur rien');

  const sansLibelle = ecartsDeRegistre(
    { representant: { gabarit: 'g', dossier: '.d' } },
    { representant: { gabarits: 'g', dossier: '.d', libelle: 'r' } },
  );
  assert.equal(sansLibelle.length, 1, `un libellé absent doit rougir, obtenu ${JSON.stringify(sansLibelle)}`);
  assert.match(sansLibelle[0], /libellé/);
});

test('le commentaire de representant.js ne promet plus une garde qui n\'existe pas — il cite CELLE-CI', () => {
  // ⚠️ C'EST LA BOUCLE QUI VIENT DE COÛTER CETTE MESURE. Le commentaire affirmait qu'un test
  // comparait les deux tables ; il n'y en avait pas. Une affirmation de garantie inscrite dans
  // le code se lit comme une preuve et dispense d'aller voir. On exige donc que la promesse
  // NOMME le fichier qui la tient : renommer ou supprimer ce fichier fait rougir ici, au lieu
  // de laisser une promesse orpheline derrière.
  //
  // ⚠️ `assert.ok` et non `assert.match` : sur un fichier de cette taille, l'échec d'un `match`
  // recrache les 20 000 caractères du fichier dans le rapport, et la raison du rouge se perd
  // dedans. Un rouge illisible se relit mal, donc se corrige mal.
  const src = readFileSync(join(CLI_DIR, 'src', 'commands', 'representant.js'), 'utf8');
  assert.ok(src.includes('registre-des-roles-miroir.test.js'),
    'cli/src/commands/representant.js ne cite pas « registre-des-roles-miroir.test.js » : le '
    + 'commentaire de la table ROLES doit NOMMER le fichier qui la garde — sinon il promet à vide, '
    + 'comme il l\'a fait jusqu\'au 2026-08-26.');
});

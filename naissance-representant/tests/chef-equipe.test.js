// chef-equipe.test.js — L'ESPACE DE TRAVAIL D'UN CHEF D'ÉQUIPE, ET CE QUI LE REFUSE.
//
// ⚠️ CES ESSAIS PARLENT À UN VRAI git, JAMAIS À UN DOUBLE, et c'est délibéré : la seule chose
// que ce module fait est d'appeler `git worktree add`. Un double de git prouverait qu'on sait
// composer une ligne de commande — pas qu'un worktree naît. Le motif est déjà payé sur ce
// dépôt (« le double est plus indulgent que le vrai »).
//
// Ce qu'ils ne touchent pas : `~/worktrees` (chaque essai porte sa propre racine jetable) et
// le dépôt de travail (chaque essai fabrique son dépôt, avec son `origin` bare).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  ROLE_CHEF_EQUIPE,
  estChefDEquipe,
  horodatageDEspace,
  nomDuDepotPrincipal,
  creerEspaceDeTravail,
  exigerUnMandatDeChantier,
  EspaceDeTravailImpossible,
  MandatSansChantier,
} from '../src/chef-equipe.js';

const git = (ou, ...args) => execFileSync('git', ['-C', ou, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * Un dépôt jetable AVEC son `origin` — parce que la base du worktree est `origin/main`, et
 * qu'un dépôt sans remote ne peut pas la résoudre. Reproduire la vraie forme est le seul moyen
 * d'éprouver le refus qui va avec.
 *
 * @param {boolean} avecOrigin  false = le cas mesurable « aucune base à partir de quoi partir »
 */
function unDepot({ avecOrigin = true } = {}) {
  const bac = mkdtempSync(join(tmpdir(), 'smtk-chef-'));
  const depot = join(bac, 'depot-principal');
  mkdirSync(depot, { recursive: true });
  git(depot, 'init', '-q', '-b', 'main');
  git(depot, 'config', 'user.email', 'essai@somtech.ca');
  git(depot, 'config', 'user.name', 'essai');
  writeFileSync(join(depot, 'LISEZMOI.md'), 'un dépôt d’essai\n');
  git(depot, 'add', '-A');
  git(depot, 'commit', '-qm', 'le premier commit');

  if (avecOrigin) {
    const distant = join(bac, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', distant], { stdio: 'ignore' });
    git(depot, 'remote', 'add', 'origin', distant);
    git(depot, 'push', '-q', 'origin', 'main');
    git(depot, 'fetch', '-q', 'origin');
  }
  return { bac, depot, racine: join(bac, 'worktrees') };
}

const nettoyer = (bac) => rmSync(bac, { recursive: true, force: true });

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — LE RÔLE, ET CE QU'IL EXIGE DE SON MANDAT

test('le rôle se nomme « chef-equipe » et se reconnaît sans détour', () => {
  assert.equal(ROLE_CHEF_EQUIPE, 'chef-equipe');
  assert.equal(estChefDEquipe('chef-equipe'), true);
  assert.equal(estChefDEquipe('orchestrateur'), false);
  assert.equal(estChefDEquipe(undefined), false);
});

// ⚠️ LE MÉTIER L'ÉCRIT NOIR SUR BLANC : « ❌ chef-equipe-orchestration, revue-pr180 — des noms
// inventés, raccordés à rien ». Un chef d'équipe PORTE le code de son mandat : un nom qui n'est
// pas un code de chantier est un agent qu'aucun registre ne rattachera à rien, et sa
// déclaration inscrirait un mandat qui ne désigne aucun chantier.
test('un chef d’équipe dont le nom n’est PAS un code de chantier est refusé — et le refus nomme la forme attendue', () => {
  for (const invente of ['revue-pr180', 'chef-equipe-orchestration', 'matapedia', '']) {
    assert.throws(
      () => exigerUnMandatDeChantier(invente),
      (err) => {
        assert.ok(err instanceof MandatSansChantier, `attendu MandatSansChantier pour « ${invente} »`);
        assert.match(err.message, /chantier|mandat/i, 'le refus dit ce qui manque');
        assert.match(err.message, /E-\d{8}-\d{4}|D-\d{8}-\d{4}/, 'et MONTRE la forme attendue');
        return true;
      }
    );
  }
});

test('les cinq familles de chantier sont acceptées, et le code est rendu comme le ServiceDesk l’écrit', () => {
  assert.equal(exigerUnMandatDeChantier('e-20260825-0002'), 'E-20260825-0002');
  assert.equal(exigerUnMandatDeChantier('T-20260825-0011'), 'T-20260825-0011');
  for (const c of ['d-20260101-0001', 'p-20260101-0001', 'j-20260101-0001']) {
    assert.equal(typeof exigerUnMandatDeChantier(c), 'string');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — L'HORODATAGE ET LE NOM DU DÉPÔT

test('l’horodatage a la forme que la compétence ordonne — `date +%Y%m%d-%H%M%S`, en heure locale', () => {
  const quand = new Date(2026, 7, 25, 8, 36, 16); // heure LOCALE, comme `date` la rend
  assert.equal(horodatageDEspace(quand), '20260825-083616');
});

// ⚠️ LE DÉFAUT QUE CET ESSAI FERME, ET IL EST RÉEL SUR CE POSTE. `git rev-parse --show-toplevel`
// lancé DANS un worktree rend le worktree (« 20260825-083616 »), pas le dépôt. La commande étant
// couramment lancée depuis un worktree, l'espace serait né sous
// `~/worktrees/20260825-083616/<ts>` — un dossier par session, au lieu d'un dossier par dépôt.
test('le nom du dépôt est celui du dépôt PRINCIPAL, même mesuré depuis un de ses worktrees', () => {
  const { bac, depot, racine } = unDepot();
  try {
    assert.equal(nomDuDepotPrincipal(depot), 'depot-principal');

    const ailleurs = join(racine, 'un-plan-de-travail');
    execFileSync('git', ['-C', depot, 'worktree', 'add', '-q', ailleurs, '-b', 'wt/essai', 'main'], { stdio: 'ignore' });
    assert.equal(nomDuDepotPrincipal(ailleurs), 'depot-principal', 'mesuré depuis le worktree, il rend TOUJOURS le dépôt');
  } finally {
    nettoyer(bac);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — L'ESPACE DE TRAVAIL LUI-MÊME

// ⚠️ LE DÉPÔT D'ESSAI DOIT DIVERGER DE `origin/main`, SANS QUOI CET ESSAI NE PROUVE RIEN.
// Première écriture : le dépôt était à jour, donc `HEAD` et `origin/main` désignaient le MÊME
// commit — et retirer `base` de `git worktree add` laissait les 13 essais verts (mutation M3,
// survivante). Un espace né sur la branche courante d'un dépôt en avance greffe le lot sur du
// travail que personne n'a choisi, et c'est très exactement ce que la base existe pour empêcher.
test('l’espace naît là où la compétence le dit — <racine>/<dépôt>/<horodatage>, sur wt/<horodatage>, depuis origin/main', () => {
  const { bac, depot, racine } = unDepot();
  try {
    writeFileSync(join(depot, 'du-travail-non-pousse.txt'), 'ce que la branche courante porte en plus\n');
    git(depot, 'add', '-A');
    git(depot, 'commit', '-qm', 'un commit local que origin ne connaît pas');
    assert.notEqual(git(depot, 'rev-parse', 'HEAD'), git(depot, 'rev-parse', 'origin/main'), 'le dépôt DOIT diverger');

    const fait = creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine });

    assert.equal(fait.espace, join(racine, 'depot-principal', '20260825-083616'));
    assert.equal(fait.branche, 'wt/20260825-083616');
    assert.equal(fait.base, 'origin/main');
    assert.ok(existsSync(join(fait.espace, 'LISEZMOI.md')), 'le contenu du dépôt y est réellement');
    assert.equal(git(fait.espace, 'rev-parse', '--abbrev-ref', 'HEAD'), 'wt/20260825-083616');
    assert.equal(
      git(fait.espace, 'rev-parse', 'HEAD'),
      git(depot, 'rev-parse', 'origin/main'),
      'il part de origin/main, pas de la branche courante du dépôt'
    );
    assert.equal(
      existsSync(join(fait.espace, 'du-travail-non-pousse.txt')),
      false,
      'et il ne porte PAS le commit local du dépôt — la preuve qu’il n’est pas parti de HEAD'
    );
  } finally {
    nettoyer(bac);
  }
});

// ⚠️ LE CRITÈRE 5 DE L'EPIC, MESURÉ PAR `git status` DANS LE WORKTREE — jamais par l'absence
// d'un chemin qu'on aurait choisi de regarder. Un chef d'équipe ne POSE AUCUN LIEU : ni
// `.orchestrateur/`, ni gabarit, ni `.nom-agent`, ni garde d'ouverture.
test('un espace fraîchement créé est PROPRE — aucun fichier posé, mesuré par git status', () => {
  const { bac, depot, racine } = unDepot();
  try {
    const { espace } = creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine });
    assert.equal(git(espace, 'status', '--porcelain'), '', 'rien d’ajouté, rien de modifié, rien de non suivi');
    assert.equal(existsSync(join(espace, '.orchestrateur')), false);
    assert.equal(existsSync(join(espace, '.gestionnaire')), false);
  } finally {
    nettoyer(bac);
  }
});

// ⚠️ ON NE RÉUTILISE PAS. Deux agents dans le même arbre partagent branche, index et statut :
// ce qui a l'air d'une économie est une collision silencieuse (mesuré sur ce dépôt).
test('un espace qui existe déjà fait REFUSER — sans le toucher, et le refus nomme le geste', () => {
  const { bac, depot, racine } = unDepot();
  try {
    const dejaLa = join(racine, 'depot-principal', '20260825-083616');
    mkdirSync(dejaLa, { recursive: true });
    writeFileSync(join(dejaLa, 'le-travail-dun-autre.txt'), 'ne me touche pas\n');

    assert.throws(
      () => creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine }),
      (err) => {
        assert.ok(err instanceof EspaceDeTravailImpossible);
        assert.match(err.message, new RegExp(dejaLa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'le refus MONTRE le chemin');
        assert.match(err.message, /existe déjà/i);
        assert.match(err.geste, /horodatage|retire|git worktree/i, 'et dit quoi faire');
        return true;
      }
    );
    assert.ok(existsSync(join(dejaLa, 'le-travail-dun-autre.txt')), 'le refus n’a rien effacé');
  } finally {
    nettoyer(bac);
  }
});

// ⚠️ « je n'ai pas pu partir » N'EST PAS « c'est parti ». Un dépôt sans `origin/main` — un clone
// local, un dépôt neuf — ne peut pas fournir la base : on le DIT, on ne retombe pas en silence
// sur la branche courante, qui contient peut-être le travail d'un autre.
test('sans base à partir de quoi partir, la création REFUSE — et cite la base qu’elle cherchait', () => {
  const { bac, depot, racine } = unDepot({ avecOrigin: false });
  try {
    assert.throws(
      () => creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine }),
      (err) => {
        assert.ok(err instanceof EspaceDeTravailImpossible);
        assert.match(err.message, /origin\/main/, 'la base cherchée est NOMMÉE');
        assert.match(err.geste, /fetch|--base|origin/i);
        return true;
      }
    );
    assert.equal(existsSync(join(racine, 'depot-principal', '20260825-083616')), false, 'rien n’a été créé');
  } finally {
    nettoyer(bac);
  }
});

// La branche-socle est calculée depuis l'horodatage : si elle est déjà prise, `git worktree add`
// refuse. On relaie SON refus plutôt que d'en inventer un — il dit la vraie cause.
test('quand git lui-même refuse, sa cause est RELAYÉE, pas remplacée par une formule', () => {
  const { bac, depot, racine } = unDepot();
  try {
    git(depot, 'branch', 'wt/20260825-083616', 'origin/main');
    assert.throws(
      () => creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine }),
      (err) => {
        assert.ok(err instanceof EspaceDeTravailImpossible);
        assert.match(err.message, /wt\/20260825-083616/, 'la branche en cause est nommée');
        assert.match(err.message, /already exists|existe/i, 'et la parole de git est relayée');
        return true;
      }
    );
  } finally {
    nettoyer(bac);
  }
});

test('un dépôt qui n’en est pas un fait REFUSER avant toute création', () => {
  const bac = mkdtempSync(join(tmpdir(), 'smtk-chef-nogit-'));
  try {
    assert.throws(
      () => creerEspaceDeTravail({ depot: bac, horodatage: '20260825-083616', racine: join(bac, 'wt') }),
      EspaceDeTravailImpossible
    );
    assert.equal(existsSync(join(bac, 'wt')), false);
  } finally {
    nettoyer(bac);
  }
});

test('la racine des espaces est surchargeable par l’environnement — c’est ce qui met le poste hors de portée des essais', async () => {
  const { bac, depot } = unDepot();
  const avant = process.env.SOMTECH_WORKTREES_RACINE;
  try {
    process.env.SOMTECH_WORKTREES_RACINE = join(bac, 'ailleurs');
    const { racineDesEspaces } = await import(`../src/chef-equipe.js?frais=${Date.now()}`);
    assert.equal(racineDesEspaces(), join(bac, 'ailleurs'));

    const { espace } = creerEspaceDeTravail({ depot, horodatage: '20260825-083616' });
    assert.equal(espace, join(bac, 'ailleurs', 'depot-principal', '20260825-083616'));
    assert.ok(existsSync(espace));
  } finally {
    if (avant === undefined) delete process.env.SOMTECH_WORKTREES_RACINE;
    else process.env.SOMTECH_WORKTREES_RACINE = avant;
    nettoyer(bac);
  }
});

test('le défaut, sans surcharge, est bien ~/worktrees — la convention du poste', async () => {
  const avant = process.env.SOMTECH_WORKTREES_RACINE;
  try {
    delete process.env.SOMTECH_WORKTREES_RACINE;
    const { racineDesEspaces } = await import(`../src/chef-equipe.js?frais=${Date.now()}-defaut`);
    assert.equal(racineDesEspaces(), resolve(process.env.HOME, 'worktrees'));
  } finally {
    if (avant !== undefined) process.env.SOMTECH_WORKTREES_RACINE = avant;
  }
});

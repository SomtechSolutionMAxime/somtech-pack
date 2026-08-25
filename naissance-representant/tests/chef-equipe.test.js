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
  defaireEspaceDeTravail,
  exigerUnMandatDeChantier,
  exigerUnHorodatageDEspace,
  EspaceDeTravailImpossible,
  MandatSansChantier,
  HorodatageHorsForme,
} from '../src/chef-equipe.js';
import { horodatageDuChemin, estUnHorodatageDeNaissance } from '../src/garde-des-naissances.js';

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

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2-bis — UN HORODATAGE DICTÉ QUE LA GARDE NE SAURA PAS LIRE EST REFUSÉ (défaut ⑥)
//
// 🔴 CE QUE CE TROU LAISSAIT PASSER. `--horodatage` était pris TEL QUEL : il nomme l'espace,
// donc le dernier segment du chemin de travail de l'agent. Or la garde des naissances BORNE sa
// population sur ce segment (`horodatageDuChemin`, `garde-des-naissances.js`) : un agent né
// sous « mon-essai » ou « 2026-08-25 » sort de la population jugée — `horsPortee`, `prises: 0`,
// « rien à signaler » — SANS un mot. Une frappe non canonique désarmait la garde par le côté
// naissance, et le module qui définit la forme valide est dans le même lot.
//
// ⚠️ L'ORACLE DE CES ESSAIS EST LA GARDE ELLE-MÊME, jamais une seconde liste écrite ici. Deux
// copies de la forme divergent au premier changement de l'une, et c'est très exactement le
// défaut qu'on ferme : on demande donc à `horodatageDuChemin` ce qu'elle sait lire, et on exige
// que le producteur soit d'accord avec elle, cas par cas.

/** Ce que la GARDE sait lire d'un dernier segment — l'oracle, mesuré et non recopié. */
const laGardeSaitLire = (valeur) => horodatageDuChemin(`/Users/x/worktrees/depot/${valeur}`) !== null;

test('🔴 le producteur et la garde s’accordent sur CE QU’EST un horodatage — cas par cas', () => {
  const cas = [
    '20260825-083616', // le canonique, celui que `claude-swt` pose
    '2026-08-25',      // la frappe humaine — mesurée par la revue
    'mon-essai',       // un nom parlant, qui n'est pas une date
    '20260825',        // la date sans l'heure
    '20260825-08361',  // une seconde manquante
    '20260825_083616', // le mauvais séparateur
    '20260825-083616 ',// une espace au bout, comme un copier-coller en laisse
    '',                // rien du tout
  ];
  for (const valeur of cas) {
    const attendu = laGardeSaitLire(valeur);
    assert.equal(
      estUnHorodatageDeNaissance(valeur),
      attendu,
      `« ${valeur} » : la garde ${attendu ? 'SAIT' : 'NE SAIT PAS'} le lire — le producteur doit dire pareil`
    );
  }
});

test('🔴 un horodatage que la garde ne saura pas lire est REFUSÉ, et le refus nomme la conséquence', () => {
  assert.throws(
    () => exigerUnHorodatageDEspace('2026-08-25'),
    (err) => {
      assert.ok(err instanceof HorodatageHorsForme, `attendu HorodatageHorsForme, reçu ${err?.name}`);
      assert.match(err.message, /2026-08-25/, 'le refus cite la valeur reçue');
      assert.match(err.message, /AAAAMMJJ-HHMMSS|20260825-083616/, 'et la forme attendue');
      assert.match(
        err.message,
        /garde/i,
        'et POURQUOI : ce n’est pas du zèle de forme, c’est la population de la garde'
      );
      return true;
    }
  );
});

test('l’horodatage canonique passe, et il est rendu tel quel — on ne le réécrit pas', () => {
  assert.equal(exigerUnHorodatageDEspace('20260825-083616'), '20260825-083616');
});

test('celui que le producteur fabrique lui-même passe sa propre porte — sinon le défaut par défaut', () => {
  // ⚠️ LA MOITIÉ QUI MANQUERAIT. Une porte qui refuserait le défaut ferait échouer TOUTE
  // naissance qui ne dicte pas son horodatage — c'est-à-dire le chemin le plus fréquenté.
  const sien = horodatageDEspace();
  assert.equal(exigerUnHorodatageDEspace(sien), sien);
  assert.ok(laGardeSaitLire(sien), 'et la garde sait le lire — les deux moitiés de la boucle');
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

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — DÉFAIRE L'ESPACE DE TRAVAIL — et refuser de le faire dès qu'il porte quelque chose.
//
// 🔴 CE QUE CES ESSAIS FERMENT. « Un refus ne laisse rien derrière lui » est écrit dans trois
// textes opposables, et c'était FAUX de l'objet le plus lourd du geste : dix refus tombent
// APRÈS `creerEspaceDeTravail`, et aucun ne retirait l'arbre ni sa branche-socle. Mesuré sur un
// dépôt jetable : l'espace, `wt/<horodatage>`, et l'entrée dans `git worktree list` restaient.
//
// ⚠️ ET LE DÉFAIRE EST PLUS DANGEREUX QUE L'ORPHELIN QU'IL NETTOIE, si on le pose aveugle. Un
// arbre qui porte du travail — non suivi, modifié, ou commité — est du travail de quelqu'un.
// Les trois essais qui suivent le mesurent : le défaire refuse, et ne touche à RIEN.

test('un espace propre est DÉFAIT en entier — l’arbre, la branche-socle, et l’enregistrement', () => {
  const { bac, depot, racine } = unDepot();
  try {
    const fait = creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine });
    assert.ok(existsSync(fait.espace), 'l’espace doit exister pour qu’il y ait quelque chose à défaire');

    const defait = defaireEspaceDeTravail({ depot, ...fait });

    assert.equal(defait.ok, true, `le défaire devait aboutir : ${defait.message}`);
    assert.equal(existsSync(fait.espace), false, 'l’arbre est retiré');
    assert.equal(
      git(depot, 'branch', '--list', fait.branche),
      '',
      'la branche-socle aussi — sans quoi le prochain `worktree add` du même horodatage refuserait'
    );
    assert.equal(
      git(depot, 'worktree', 'list').split('\n').length,
      1,
      'et l’enregistrement ne garde aucune trace : le dépôt principal, et rien d’autre'
    );
  } finally {
    nettoyer(bac);
  }
});

// ⚠️ LE PIÈGE QU'UN DÉFAIRE OUVRE. `git worktree remove` sans `--force` refuse un arbre sale —
// c'est la garde de git, et on ne la contourne pas. L'essai le PROUVE par l'effet : le fichier
// est encore là après.
test('un arbre qui porte du travail NON SUIVI n’est pas détruit — et le refus le dit', () => {
  const { bac, depot, racine } = unDepot();
  try {
    const fait = creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine });
    const trouvaille = join(fait.espace, 'ce-que-lagent-a-ecrit.txt');
    writeFileSync(trouvaille, 'trois heures de travail\n');

    const defait = defaireEspaceDeTravail({ depot, ...fait });

    assert.equal(defait.ok, false, 'un arbre qui porte quelque chose ne se défait pas');
    assert.ok(existsSync(trouvaille), '… et le travail est encore là');
    assert.ok(existsSync(fait.espace), '… et l’arbre aussi');
    assert.match(defait.message, /20260825-083616/, 'le refus nomme l’espace resté');
    assert.match(defait.message, /worktree remove/, 'et le geste exact qui le retire quand on l’a jugé');
  } finally {
    nettoyer(bac);
  }
});

// ⚠️ ET LE CAS QUE `worktree remove` NE VOIT PAS. Un arbre dont tout est COMMITÉ est PROPRE au
// sens de `git status` : `worktree remove` l'emporterait sans un mot, et le travail ne vivrait
// plus que dans une branche que le geste s'apprête à supprimer. On mesure donc la branche
// AVANT de toucher à l'arbre : socle bougé ⇒ on ne défait RIEN.
test('un arbre dont le travail est COMMITÉ n’est pas détruit non plus — ni l’arbre, ni la branche', () => {
  const { bac, depot, racine } = unDepot();
  try {
    const fait = creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine });
    writeFileSync(join(fait.espace, 'le-lot.txt'), 'le lot livré\n');
    git(fait.espace, 'add', '-A');
    git(fait.espace, 'commit', '-qm', 'le travail du chef d’équipe');
    assert.equal(git(fait.espace, 'status', '--porcelain'), '', 'l’arbre est PROPRE — c’est tout le piège');

    const defait = defaireEspaceDeTravail({ depot, ...fait });

    assert.equal(defait.ok, false, 'un socle qui a bougé porte du travail — on ne défait rien');
    assert.ok(existsSync(join(fait.espace, 'le-lot.txt')), 'l’arbre est intact');
    assert.equal(git(depot, 'rev-parse', fait.branche), git(fait.espace, 'rev-parse', 'HEAD'), 'la branche aussi');
    assert.match(defait.message, /commit/i, 'et le refus dit POURQUOI : il y a des commits');
  } finally {
    nettoyer(bac);
  }
});

// ⚠️ LA MOITIÉ QUI PROTÈGE LE DÉFAIRE LUI-MÊME : il ne rougit pas sur ce qui n'existe plus. Un
// espace déjà retiré à la main est un état ORDINAIRE, pas une panne — et le traiter comme une
// panne ferait écrire un avertissement d'orphelin là où il n'y a pas d'orphelin.
test('un espace déjà retiré ne fait pas rougir le défaire — mais sa branche-socle part quand même', () => {
  const { bac, depot, racine } = unDepot();
  try {
    const fait = creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine });
    rmSync(fait.espace, { recursive: true, force: true });

    const defait = defaireEspaceDeTravail({ depot, ...fait });

    assert.equal(defait.ok, true, `l’absence n’est pas une panne : ${defait.message}`);
    assert.equal(git(depot, 'branch', '--list', fait.branche), '', 'la branche-socle est retirée');
  } finally {
    nettoyer(bac);
  }
});

// ⚠️ LE SOCLE EST UN COMMIT, PAS UN NOM DE RÉFÉRENCE. Entre la création et le défaire, un
// `fetch` peut faire avancer `origin/main` : comparer la branche à `origin/main` lirait alors
// « elle a bougé » sur un espace où personne n'a rien fait, et l'orphelin resterait pour
// toujours. `creerEspaceDeTravail` rend donc le commit RÉSOLU, et c'est lui qu'on compare.
test('le socle rendu est le COMMIT résolu — un origin/main qui avance ne fait pas croire à du travail', () => {
  const { bac, depot, racine } = unDepot();
  try {
    const fait = creerEspaceDeTravail({ depot, horodatage: '20260825-083616', racine });
    assert.equal(fait.socle, git(depot, 'rev-parse', 'origin/main'), 'le socle est le commit, pas « origin/main »');

    // origin/main avance — exactement ce qu'un `fetch` d'un autre worktree produit.
    writeFileSync(join(depot, 'ailleurs.txt'), 'le travail d’un autre\n');
    git(depot, 'add', '-A');
    git(depot, 'commit', '-qm', 'un commit poussé par quelqu’un d’autre');
    git(depot, 'push', '-q', 'origin', 'main');
    git(depot, 'fetch', '-q', 'origin');
    assert.notEqual(git(depot, 'rev-parse', 'origin/main'), fait.socle, 'la base a bel et bien bougé');

    const defait = defaireEspaceDeTravail({ depot, ...fait });

    assert.equal(defait.ok, true, `l’espace n’a rien fait : il doit se défaire — ${defait.message}`);
    assert.equal(existsSync(fait.espace), false);
  } finally {
    nettoyer(bac);
  }
});

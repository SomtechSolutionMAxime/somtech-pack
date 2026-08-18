// UN LIEU DONT LES DROITS NE PEUVENT PAS ÊTRE VERSIONNÉS N'EST PAS UN LIEU (T-20260813-0059).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// VÉCU, 2026-08-13, dépôt d'un client
//
// La pose d'un orchestrateur rend `{"ok":true,"fichiers":[…4…],"avertissements":[]}`. Quatre
// fichiers annoncés, zéro avertissement. Puis, en versant : **trois** entrent au dépôt.
// `.claude/settings.json` manque, parce qu'un motif `.claude/` — dans le `.gitignore` du dépôt
// ou dans son `.git/info/exclude` — s'applique à TOUTE profondeur, donc au `.claude/` du lieu
// comme à celui du dépôt.
//
// ⚠️ CE N'EST PAS UN OUBLI DE `git add`. La compétence place délibérément `settings.json` sous
// `.claude/` parce qu'un fichier à plat serait *« présent sur disque et jamais lu : les
// permissions ne borneraient rien, en silence »*. Le défaut a été fermé AU PLACEMENT et rouvert
// AU VERSEMENT : le fichier est bien lu par la session née sur ce poste, et il n'entre pas dans
// le dépôt. Un lieu repris ailleurs — autre clone, autre poste — fait naître un agent SANS
// DROITS BORNÉS, et rien ne le signale, puisque le lieu paraît complet chez celui qui l'a posé.
//
// Et il échappait au filet prévu pour ça : la pose refuse un lieu partiel en se fiant au
// DISQUE. Sur disque, ici, le lieu est complet. C'est VERSIONNÉ qu'il est partiel.
//
// L'ARBITRAGE RENDU (j-20260814-0002, 2026-08-15) : REFUS sur le fichier des droits,
// avertissement sur les trois autres. Motif : un avertissement de plus n'est pas lu — mesuré
// le jour même sur cinq lieux clients posés, dont deux sans aucune garde et un dans aucun
// commit, pour zéro signalement.
//
// ⚠️ CES ESSAIS MONTENT DE VRAIS DÉPÔTS GIT. Un double de `git check-ignore` prouverait
// l'accord de l'essai avec lui-même, pas avec git — et ce dépôt a payé six fois un double plus
// permissif que le service qu'il simule. La cloison d'essais interdit Slack et le trousseau,
// jamais git.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { posteFabrique } from './foyer-de-reference.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(ICI, '..', '..');
const GABARITS_SRC = join(REPO, '.claude', 'templates');

let preparerLieuOrchestrateur, preparerLieuRepresentant, GABARITS;
let bacs = [];

// LE FOYER DE RÉFÉRENCE — sans lui, la garde de fraîcheur viserait `$HOME` et cette suite
// rougirait dès qu'une branche touche à un gabarit (T-20260818-0133). Voir
// `foyer-de-reference.js` : la garde reste exercée, on fixe seulement sa référence à la même
// source que le dépôt jetable.
const POSTE = posteFabrique(GABARITS_SRC, ['orchestrateur', 'gestionnaire-client'], bacs);

before(async () => {
  ({ preparerLieuOrchestrateur } = await import('../src/orchestrateur.js'));
  ({ preparerLieuRepresentant } = await import('../src/representant.js'));
  ({ GABARITS } = await import('../src/lieu-agent.js'));
});

after(() => {
  POSTE.rendre();
  for (const b of bacs) rmSync(b, { recursive: true, force: true });
});

/**
 * Un VRAI dépôt git jetable, avec les gabarits du pack déjà installés.
 *
 * `exclusions` est écrit tel quel dans le fichier demandé — `.gitignore` (versionné, celui que
 * tout le monde voit) ou `.git/info/exclude` (local au clone, invisible en revue). Le défaut
 * vécu venait du second : c'est le plus traître des deux, et le moins regardé.
 */
function depotGit({ exclusions = null, ou = '.gitignore', roles = ['orchestrateur'] } = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'ld-vers-'));
  bacs.push(racine);
  execFileSync('git', ['init', '-q', racine]);
  execFileSync('git', ['-C', racine, 'config', 'user.email', 'essai@somtech.ca']);
  execFileSync('git', ['-C', racine, 'config', 'user.name', 'essai']);
  for (const r of roles) {
    cpSync(join(GABARITS_SRC, r), join(racine, '.claude', 'templates', r), { recursive: true });
  }
  if (exclusions) {
    const cible = join(racine, ou);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, `${exclusions}\n`);
  }
  return racine;
}

const OUVRABLE = async () => ({ joignable: true });

/** Passe-plat : la pose n'injecte pas d'exécuteur, l'essai en a besoin d'un. */
async function versionnabiliteInjectee(depot, racine, executer) {
  const { versionnabiliteDe } = await import('../src/lieu-agent.js');
  return versionnabiliteDe(depot, racine, { executer });
}

// ═════════════════ 1. LE REFUS, ET IL NE LAISSE RIEN DERRIÈRE LUI

test('UN DÉPÔT QUI EXCLUT `.claude/` FAIT REFUSER LA POSE — les droits ne pourraient pas être versés', async () => {
  const depot = depotGit({ exclusions: '.claude/' });

  const r = await preparerLieuOrchestrateur({ depot, nom: 'p-20260728-0002', verifierLigne: OUVRABLE });

  assert.equal(r.ok, false, 'la pose doit refuser : ce lieu serait sans droits partout ailleurs');
  assert.equal(r.refus.motif, 'droits_non_versionnables');
  // LA PREUVE EST L'ABSENCE SUR DISQUE, jamais le message — doctrine de ce dépôt. Un refus qui
  // laisse un lieu à demi posé rejouerait T-20260807-0067 : la relance suivante le lirait
  // comme un lieu.
  assert.equal(existsSync(join(depot, '.orchestrateur')), false, 'rien ne doit subsister');
});

test('LE REFUS NOMME LE MOTIF, SA SOURCE ET LE GESTE QUI LE LÈVE — sinon il n’est que de la friction', async () => {
  // Le dirigeant a écrit « c'est souffrant ouvrir un orchestrateur ». Un refus qui n'aide pas
  // est exactement ce qu'il décrit. Ce dépôt exige partout ailleurs qu'un refus dise le geste
  // humain qui le lève ; un refus muet serait un pas en arrière.
  const depot = depotGit({ exclusions: '.claude/' });

  const r = await preparerLieuOrchestrateur({ depot, nom: 'p-20260728-0002', verifierLigne: OUVRABLE });

  const m = r.refus.message;
  assert.match(m, /settings\.json/, 'le refus doit nommer le fichier qui ne peut pas être versé');
  assert.match(m, /\.gitignore/, 'et d’où vient le motif qui l’exclut — git le donne, on le cite');
  assert.match(m, /\.claude\//, 'et le motif lui-même');
  assert.match(m, /git add -f/, 'et le geste qui le lève');
});

test('LE MOTIF D’UN `.git/info/exclude` EST NOMMÉ AUSSI — c’est le cas vécu, et le moins visible', async () => {
  // Le défaut du ticket venait de là : un motif local au clone, que personne ne voit en revue
  // puisqu'il n'est pas versionné. Un refus qui ne saurait citer que le `.gitignore` laisserait
  // le poseur chercher dans le mauvais fichier.
  const depot = depotGit({ exclusions: '.claude/', ou: join('.git', 'info', 'exclude') });

  const r = await preparerLieuOrchestrateur({ depot, nom: 'p-20260728-0002', verifierLigne: OUVRABLE });

  assert.equal(r.ok, false);
  assert.match(r.refus.message, /info\/exclude/, 'le refus doit désigner le fichier réellement fautif');
});

test('LE REPRÉSENTANT EST COUVERT PAR LA MÊME GARDE — son lieu borne des accès CLIENT', async () => {
  // MESURÉ, pas supposé : les deux poses passent par le même corps et la même liste de
  // fichiers. Ce n'est donc pas « une porte sur deux » — mais il faut le prouver, parce que
  // c'est précisément le genre d'affirmation que ce dépôt a payé pour ne pas croire sur parole.
  const depot = depotGit({ exclusions: '.claude/', roles: ['gestionnaire-client'] });

  const r = await preparerLieuRepresentant({
    depotClient: depot,
    client: 'acme',
    canal: 'espace-acme',
    verifierJoignabilite: OUVRABLE,
  });

  assert.equal(r.ok, false, 'le lieu d’un représentant sans droits versés est le même défaut, en pire');
  assert.equal(r.refus.motif, 'droits_non_versionnables');
  assert.equal(existsSync(join(depot, '.gestionnaire')), false, 'et rien ne subsiste non plus');
});

// ═════════════════ 2. CE QUI NE DOIT PAS BOUGER

test('UN DÉPÔT SANS CE MOTIF POSE NORMALEMENT, ET EN SILENCE — la garde ne fabrique pas de bruit', async () => {
  const depot = depotGit();

  const r = await preparerLieuOrchestrateur({ depot, nom: 'p-20260728-0002', verifierLigne: OUVRABLE });

  assert.equal(r.ok, true, r.refus?.message);
  assert.deepEqual([...r.fichiers].sort(), [...GABARITS].sort(), 'les quatre fichiers sont posés');
  // ⚠️ ON NOMME CE QU'ON NE VEUT PAS VOIR, pas un motif qui « ressemble ». La première
  // écriture filtrait sur /version|ignor|git/ — et attrapait le nom du dossier temporaire,
  // qui contenait « versionnable ». Un essai dont le verdict dépend du nom de son bac ne
  // prouve pas ce qu'il croit prouver.
  assert.deepEqual(
    r.avertissements.filter((a) => GABARITS.some((g) => a.includes(g))),
    [],
    'aucun gabarit ne doit être signalé : tous peuvent être versés'
  );
});

test('UN AUTRE FICHIER EXCLU AVERTIT SANS REFUSER — seuls les DROITS valent un refus', async () => {
  // L'arbitrage sépare les deux : ce qui manque quand `CONTEXTE.md` n'est pas versé est du
  // contexte, réparable ailleurs ; ce qui manque quand `settings.json` ne l'est pas, ce sont
  // les permissions — c'est-à-dire la garantie que ce lieu existe pour porter.
  const depot = depotGit({ exclusions: 'CONTEXTE.md' });

  const r = await preparerLieuOrchestrateur({ depot, nom: 'p-20260728-0002', verifierLigne: OUVRABLE });

  assert.equal(r.ok, true, 'la pose réussit : ce n’est pas le fichier des droits');
  assert.ok(
    r.avertissements.some((a) => /CONTEXTE\.md/.test(a)),
    'mais elle DIT que ce fichier ne sera pas versé — un compte de fichiers ne se relit pas'
  );
  assert.ok(existsSync(join(depot, '.orchestrateur', 'p-20260728-0002', 'CONTEXTE.md')), 'et le lieu est bien posé');
});

test('HORS DÉPÔT GIT, ON POSE SANS RIEN INVENTER — il n’y a ni exclusion ni garantie à annoncer', async () => {
  // ⚠️ « PAS DE DÉPÔT » N'EST PAS « JE N'AI PAS PU MESURER ». C'est un fait établi : il n'y a ni
  // exclusion ni versement possible, donc rien à signaler sur ce terrain-là. Avertir ici
  // produirait un mot à chaque pose faite hors dépôt — et un bruit finit par ne plus être lu,
  // ce que ce lot reproche précisément à l'ancien comportement.
  //
  // ⚠️ CE QUI RESTE OUVERT, ET QUI EST NOTÉ AU TICKET : un lieu posé hors dépôt n'est versionné
  // nulle part. En faire un refus serait un arbitrage que le ticket n'a pas rendu.
  const racine = mkdtempSync(join(tmpdir(), 'ld-sans-git-'));
  bacs.push(racine);
  cpSync(join(GABARITS_SRC, 'orchestrateur'), join(racine, '.claude', 'templates', 'orchestrateur'), {
    recursive: true,
  });

  const r = await preparerLieuOrchestrateur({ depot: racine, nom: 'p-1', verifierLigne: OUVRABLE });

  assert.equal(r.ok, true, 'un dossier sans dépôt git reste un endroit où l’on pose — on ne refuse pas');
  // On cherche ce que l'avertissement doit DIRE — qu'on n'a pas pu vérifier, et sur quel
  // fichier — plutôt qu'un mot qu'il pourrait contenir par hasard.
  assert.deepEqual(
    r.avertissements.filter((a) => GABARITS.some((g) => a.includes(g))),
    [],
    'aucun gabarit n’est annoncé exclu : il n’y a pas de dépôt pour les exclure'
  );
});


// ═════════════════ 3. QUAND ON N'A PAS PU POSER LA QUESTION

test('GIT INTROUVABLE : on ne conclut rien, et on le DIT — « pas pu mesurer » n’est pas « rien à signaler »', async () => {
  // ⚠️ LA DISTINCTION QUE CE DÉPÔT PAIE DÈS QU'IL LA PERD, et `outils.js` l'écrit en tête :
  // « je n'ai pas pu poser la question » n'est pas « la réponse est non ». Sans git, on ne sait
  // pas si les droits seront versés — le taire rendrait un lieu d'apparence saine sur le seul
  // fait qu'on n'a rien pu vérifier.
  //
  // ⚠️ ET CE CAS EST DISTINCT DE « PAS DE DÉPÔT » (essai précédent), qui est un FAIT : là, il
  // n'y a rien à verser ; ici, il y a peut-être une exclusion et on ne le saura pas.
  const { versionnabiliteDe } = await import('../src/lieu-agent.js');
  const absent = async () => {
    const err = new Error('spawn git ENOENT');
    err.code = 'ENOENT';
    err.errno = -2;
    err.syscall = 'spawn git';
    err.path = '/usr/bin/git';
    throw err;
  };

  const v = await versionnabiliteDe('/un/depot', '/un/depot/.orchestrateur/p-1', { executer: absent });

  assert.equal(v.connue, false, 'sans git, aucun verdict — ni « versionnable », ni « exclu »');
  assert.match(v.raison, /git/i, 'et la raison doit nommer ce qui manque');
});

test('LA POSE AVERTIT ALORS, ET POSE QUAND MÊME — un outil absent n’est pas une faute du poseur', async () => {
  const depot = depotGit();
  const absent = async () => {
    const err = new Error('spawn git ENOENT');
    err.code = 'ENOENT';
    err.path = '/usr/bin/git';
    throw err;
  };

  const r = await preparerLieuOrchestrateur({
    depot,
    nom: 'p-1',
    verifierLigne: OUVRABLE,
    verifierVersionnable: (d, racine) => versionnabiliteInjectee(d, racine, absent),
  });

  assert.equal(r.ok, true, 'on ne refuse pas un lieu parce qu’on n’a pas su vérifier');
  const avis = r.avertissements.filter((a) => /vérifier/i.test(a));
  assert.equal(avis.length, 1, `on doit le dire : ${JSON.stringify(r.avertissements)}`);
  assert.match(avis[0], /settings\.json/, 'et nommer le fichier dont dépend la garantie');
});


test('UN `rev-parse` QUI ÉCHOUE POUR UNE AUTRE RAISON N’EST PAS « HORS DÉPÔT » — on ne se tait pas', async () => {
  // ⚠️ BLOQUANT RELEVÉ EN REVUE DE FOND, et c'est le défaut de ce lot rejoué DANS son propre
  // correctif. Le premier jet traitait TOUT échec de `rev-parse` (hors « git introuvable »)
  // comme le FAIT « pas de dépôt », donc en silence total — pendant que le bloc juste en
  // dessous, lui, traitait « tout le reste » comme une absence de réponse. Deux blocs du même
  // fichier se contredisaient.
  //
  // Le cas plausible en production est la propriété douteuse (« dubious ownership », git ≥ 2.35) :
  // courante dès qu'un dépôt appartient à un autre compte que celui qui l'interroge — conteneur,
  // sudo, intégration continue. Le dépôt EXISTE, il peut parfaitement exclure `settings.json`,
  // et on serait passé à côté sans un mot. Pire que le comportement qu'on corrige : celui-là,
  // au moins, laissait un compte de fichiers à relire.
  const { versionnabiliteDe } = await import('../src/lieu-agent.js');
  const proprieteDouteuse = async () => {
    const err = new Error('Command failed: git rev-parse --show-toplevel');
    err.code = 128;
    err.stderr = "fatal: detected dubious ownership in repository at '/un/depot'\n";
    throw err;
  };

  const v = await versionnabiliteDe('/un/depot', '/un/depot/.orchestrateur/p-1', {
    executer: proprieteDouteuse,
  });

  assert.equal(v.connue, false, 'le dépôt existe peut-être et exclut peut-être : on n’en sait rien');
  assert.notEqual(v.horsDepot, true, 'ce n’est PAS le fait « pas de dépôt »');
  assert.match(v.raison, /ownership|dubious/i, 'et la raison doit rapporter ce que git a dit');
});

test('« CE N’EST PAS UN DÉPÔT » RESTE UN FAIT, LUI — et reste silencieux', async () => {
  // La contrepartie du contrôle précédent : il ne faut pas non plus se mettre à avertir partout.
  // Ce message-là de git est un verdict, pas une panne.
  const { versionnabiliteDe } = await import('../src/lieu-agent.js');
  const pasUnDepot = async () => {
    const err = new Error('Command failed: git rev-parse --show-toplevel');
    err.code = 128;
    err.stderr = 'fatal: not a git repository (or any of the parent directories): .git\n';
    throw err;
  };

  const v = await versionnabiliteDe('/un/dossier', '/un/dossier/.orchestrateur/p-1', {
    executer: pasUnDepot,
  });

  assert.equal(v.connue, true, 'git a répondu : il n’y a pas de dépôt');
  assert.deepEqual(v.exclus, [], 'donc rien d’exclu à signaler');
});

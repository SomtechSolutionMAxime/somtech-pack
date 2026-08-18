// LE BAIL D'UN BANC D'ESSAI — ce qui empêche le balayeur de soumettre dans une mesure.
//
// Ce que ces essais cherchent à attraper, dans l'ordre du coût :
//   ① un bail qui ne protège pas (le balayeur soumet dans une mesure → verdict faussé) ;
//   ② un bail qui protège POUR TOUJOURS (le pane sort du champ du balayeur, et la boîte
//     bloquée — ~40 min mesurées, pendant lesquelles personne ne joint le destinataire —
//     redevient la panne du jour) ;
//   ③ un bail qui déborde sur un pane qu'on n'a pas réservé.
//
// L'expiration s'éprouve par `maintenant` INJECTÉ. Un essai qui dormirait 30 minutes ne serait
// jamais écrit, et l'expiration ne serait jamais prouvée — c'est-à-dire que ② n'aurait aucune
// garde du tout.
//
// ⚠️ CLOISON : `LIGNE_DIRECTE_RACINE` est posée sur un bac jetable AVANT l'import. Les chemins
// sont figés au chargement du module (`RACINE` est un `const`), donc l'ordre n'est pas une
// coquetterie : importer d'abord ferait écrire ces essais dans `~/.somtech/ligne-directe`, le
// dossier qui porte les lignes vivantes du dirigeant.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let racine;
let CHEMIN_BAUX, poserUnBail, leverUnBail, bauxEnCours, sousBail, MINUTES_PAR_DEFAUT, MINUTES_PLAFOND;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-baux-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ CHEMIN_BAUX, poserUnBail, leverUnBail, bauxEnCours, sousBail, MINUTES_PAR_DEFAUT, MINUTES_PLAFOND } =
    await import('../src/baux.js'));
  // Le module DOIT avoir suivi la racine jetable. Sans cette assertion, un `baux.js` qui
  // recalculerait sa racine au lieu de la prendre à `registre.js` passerait tous les essais
  // ci-dessous au vert en écrivant dans le dossier du poste : l'essai serait alors le vecteur
  // du défaut qu'il prétend garder.
  assert.equal(CHEMIN_BAUX, join(racine, 'baux.json'));
});

beforeEach(() => {
  rmSync(CHEMIN_BAUX, { force: true });
});

const T0 = 1_760_000_000_000; // un instant fixe : rien ici ne dépend de l'horloge du poste
const MINUTE = 60_000;

test('UN BAIL POSÉ PROTÈGE — et il ne protège plus une seconde après son terme', () => {
  poserUnBail('w5:p3', { minutes: 10, pourquoi: 'banc T-20260818-0078', maintenant: T0 });

  assert.equal(sousBail('w5:p3', { maintenant: T0 }), true, 'à la pose');
  assert.equal(sousBail('w5:p3', { maintenant: T0 + 9 * MINUTE }), true, 'une minute avant le terme');
  // La seconde d'après le terme est le cœur de la garde ② : c'est elle qui distingue un bail
  // d'un trou permanent.
  assert.equal(sousBail('w5:p3', { maintenant: T0 + 10 * MINUTE + 1000 }), false, 'une seconde après le terme');
});

test('UN BAIL LEVÉ NE PROTÈGE PLUS — et lever dit s’il a interrompu quelque chose', () => {
  poserUnBail('w1:p1', { minutes: 30, maintenant: T0 });
  assert.equal(sousBail('w1:p1', { maintenant: T0 }), true);

  assert.equal(leverUnBail('w1:p1', { maintenant: T0 }).leve, true);
  assert.equal(sousBail('w1:p1', { maintenant: T0 }), false, 'levé : le balayeur peut y aller');

  // Lever ce qui n'existe pas n'est pas une erreur — celui qui range après un essai ne sait pas
  // toujours si le bail avait déjà expiré — mais ça ne doit PAS se dire « levé ».
  const r = leverUnBail('w1:p1', { maintenant: T0 });
  assert.equal(r.ok, true);
  assert.equal(r.leve, false);
});

test('UN BAIL EXPIRÉ QU’ON LÈVE NE COMPTE PAS COMME LEVÉ — il ne protégeait déjà plus rien', () => {
  poserUnBail('w2:p9', { minutes: 5, maintenant: T0 });
  const r = leverUnBail('w2:p9', { maintenant: T0 + 6 * MINUTE });
  assert.equal(r.ok, true);
  assert.equal(r.leve, false, 'rendre « levé » ferait croire qu’on vient d’interrompre une mesure');
});

test('`bauxEnCours` N’ÉNUMÈRE PAS LES EXPIRÉS — sans qu’aucune passe de nettoyage n’ait tourné', () => {
  poserUnBail('w1:p1', { minutes: 5, maintenant: T0 });
  poserUnBail('w2:p2', { minutes: 60, maintenant: T0 });

  const apres = T0 + 10 * MINUTE;
  const noms = bauxEnCours({ maintenant: apres }).map((b) => b.pane);
  assert.deepEqual(noms, ['w2:p2'], 'seul le vivant est énuméré');

  // Et le fichier n'a pas été retouché entre-temps : c'est la LECTURE qui écarte, pas un
  // ménage. Un poste dont le fichier dort depuis trois jours voit quand même juste.
  assert.equal(existsSync(CHEMIN_BAUX), true);
  assert.equal(bauxEnCours({ maintenant: apres }).length, 1);
});

test('UN FICHIER CORROMPU DONNE AUCUN BAIL, ET AUCUNE EXCEPTION — le repli dangereux, assumé', () => {
  // ⚠️ Ce repli fait PERDRE les protections : le balayeur croit le poste libre. L'autre branche
  // — remonter l'exception — donne un balayeur qui meurt à chaque tour et ne balaie plus rien.
  // L'essai fige l'arbitrage : ce qui compte est qu'AUCUN appel ne jette.
  writeFileSync(CHEMIN_BAUX, '{ ceci n’est pas du JSON');
  assert.doesNotThrow(() => sousBail('w1:p1', { maintenant: T0 }));
  assert.equal(sousBail('w1:p1', { maintenant: T0 }), false);
  assert.doesNotThrow(() => bauxEnCours({ maintenant: T0 }));
  assert.deepEqual(bauxEnCours({ maintenant: T0 }), []);

  // Et un fichier bien formé dont `baux` n'est pas une table (une liste, un nombre) ne doit pas
  // non plus produire de bail fantôme : `Object.entries` d'un tableau rend des indices, ce qui
  // ferait exister un pane nommé « 0 ».
  writeFileSync(CHEMIN_BAUX, JSON.stringify({ version: 1, baux: [{ pane: 'w1:p1', jusqua: T0 + MINUTE }] }));
  assert.deepEqual(bauxEnCours({ maintenant: T0 }), []);

  // Un bail sans terme lisible n'est pas un bail éternel : c'est un bail qu'on ne sait pas
  // dater, donc aucune protection. L'inverse — le lire comme « valide » — serait précisément le
  // trou permanent que l'expiration existe pour empêcher.
  writeFileSync(CHEMIN_BAUX, JSON.stringify({ version: 1, baux: { 'w1:p1': { pane: 'w1:p1' } } }));
  assert.equal(sousBail('w1:p1', { maintenant: T0 }), false);
});

test('UN FICHIER ABSENT DONNE AUCUN BAIL — le balayeur d’un poste neuf ne doit pas mourir', () => {
  rmSync(CHEMIN_BAUX, { force: true });
  assert.equal(sousBail('w1:p1', { maintenant: T0 }), false);
  assert.deepEqual(bauxEnCours({ maintenant: T0 }), []);
});

test('DEUX PANES NE SE MARCHENT PAS DESSUS — poser l’un ne libère pas l’autre', () => {
  poserUnBail('w1:p1', { minutes: 30, maintenant: T0 });
  poserUnBail('w2:p2', { minutes: 30, maintenant: T0 + MINUTE });

  assert.equal(sousBail('w1:p1', { maintenant: T0 + MINUTE }), true, 'le premier survit à la pose du second');
  assert.equal(sousBail('w2:p2', { maintenant: T0 + MINUTE }), true);
  assert.equal(sousBail('w3:p3', { maintenant: T0 + MINUTE }), false, 'un pane jamais réservé n’est pas protégé');

  // Et lever l'un ne lève pas l'autre — c'est la même faute, par l'autre bout : un « lever »
  // qui viderait la table rendrait tous les bancs du poste balayables d'un seul geste.
  leverUnBail('w1:p1', { maintenant: T0 + MINUTE });
  assert.equal(sousBail('w2:p2', { maintenant: T0 + MINUTE }), true, 'lever w1:p1 ne touche pas w2:p2');
});

test('LE PLAFOND MORD — une semaine demandée est ÉCRÊTÉE, pas accordée', () => {
  const r = poserUnBail('w4:p4', { minutes: 10_000, maintenant: T0 });
  assert.equal(r.ok, true, 'écrêté, jamais refusé : refuser laisserait le pane SANS protection');
  assert.equal(r.ajustement, 'plafond');
  assert.equal(r.bail.minutes, MINUTES_PLAFOND);
  assert.equal(r.minutes_demandees, 10_000);

  // Ce qui compte n'est pas le champ, c'est le COMPORTEMENT : le bail doit être mort au-delà du
  // plafond, sinon le trou permanent est là quand même, avec un champ qui dit le contraire.
  assert.equal(sousBail('w4:p4', { maintenant: T0 + (MINUTES_PLAFOND - 1) * MINUTE }), true);
  assert.equal(sousBail('w4:p4', { maintenant: T0 + (MINUTES_PLAFOND + 1) * MINUTE }), false);
});

test('UNE DURÉE ILLISIBLE OU NÉGATIVE RETOMBE SUR LE DÉFAUT — jamais sur zéro', () => {
  // Un bail de zéro minute, c'est un fichier qui dit « réservé » et une lecture qui dit
  // « libre » : celui qui a tapé la commande croit être protégé et ne l'est pas. L'incertitude
  // tombe du côté qui s'abstient.
  for (const mauvaise of ['abc', -5, 0, NaN]) {
    rmSync(CHEMIN_BAUX, { force: true });
    const r = poserUnBail('w6:p6', { minutes: mauvaise, maintenant: T0 });
    assert.equal(r.ok, true, `minutes=${mauvaise}`);
    assert.equal(r.bail.minutes, MINUTES_PAR_DEFAUT, `minutes=${mauvaise}`);
    assert.equal(r.ajustement, 'defaut', `minutes=${mauvaise} doit être SIGNALÉ, pas corrigé en silence`);
    assert.equal(sousBail('w6:p6', { maintenant: T0 + MINUTE }), true, `minutes=${mauvaise}`);
  }

  // Sans `--minutes` du tout, ce n'est pas un ajustement : c'est le cas nominal, et le dire
  // « ajusté » ferait crier la commande à chaque pose ordinaire — une garde qui crie à tort se
  // fait retirer, et elle emporte ce qu'elle gardait.
  const nominal = poserUnBail('w7:p7', { maintenant: T0 });
  assert.equal(nominal.ajustement, null);
  assert.equal(nominal.bail.minutes, MINUTES_PAR_DEFAUT);
});

test('UN BAIL SUR RIEN EST REFUSÉ — il occuperait le fichier sans protéger aucun pane', () => {
  for (const rien of ['', '   ', null, undefined]) {
    const r = poserUnBail(rien, { minutes: 10, maintenant: T0 });
    assert.equal(r.ok, false, `pane=${JSON.stringify(rien)}`);
  }
  assert.equal(existsSync(CHEMIN_BAUX), false, 'un refus n’écrit rien');
  assert.equal(sousBail('', { maintenant: T0 }), false);
});

test('RE-POSER PROLONGE — la reprise d’un banc ne doit pas exiger de lever d’abord', () => {
  poserUnBail('w8:p8', { minutes: 10, maintenant: T0 });
  poserUnBail('w8:p8', { minutes: 10, maintenant: T0 + 9 * MINUTE });

  // Sans remplacement, le bail serait mort à T0+10min au milieu de la mesure reprise.
  assert.equal(sousBail('w8:p8', { maintenant: T0 + 15 * MINUTE }), true);
  assert.equal(bauxEnCours({ maintenant: T0 + 15 * MINUTE }).length, 1, 'un pane, un bail — pas deux entrées');
});

test('LE FICHIER NE GROSSIT PAS D’UNE LIGNE PAR ESSAI — les expirés tombent à l’écriture', () => {
  poserUnBail('w1:p1', { minutes: 5, maintenant: T0 });
  poserUnBail('w2:p2', { minutes: 5, maintenant: T0 });
  poserUnBail('w3:p3', { minutes: 30, maintenant: T0 + 60 * MINUTE });

  const surDisque = JSON.parse(readFileSync(CHEMIN_BAUX, 'utf8'));
  assert.deepEqual(Object.keys(surDisque.baux), ['w3:p3'], 'les deux expirés ne sont plus écrits');
});

test('L’ÉCRITURE NE LAISSE AUCUN FICHIER TEMPORAIRE DERRIÈRE ELLE', () => {
  // ⚠️ CE QUE CET ESSAI NE PROUVE PAS, ET IL FAUT LE DIRE : il ne rougit PAS si l'écriture cesse
  // d'être atomique. Mesuré — en remplaçant `temporaire + renameSync` par un `writeFileSync`
  // direct sur le fichier final, les 13 essais restent verts. Il n'atteste que d'une chose :
  // aucun `.tmp` ne survit à une pose. L'atomicité, elle, ne s'éprouve qu'en tuant un processus
  // entre l'écriture et le renommage, ce que ce banc ne sait pas faire — la garde repose donc
  // sur la lecture du code (`sauverBaux`), pas sur cet essai, et le prétendre serait un vert qui
  // ne touche pas ce qu'il prétend éprouver.
  poserUnBail('w1:p1', { minutes: 10, maintenant: T0 });
  const restes = readdirSync(racine).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(restes, [], 'un .tmp qui survit est le signe qu’une écriture s’est arrêtée en chemin');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA COMMANDE, ÉPROUVÉE COMME ON LA TAPE — parce que c'est LÀ que le bail se perd.
//
// L'API ci-dessus peut être parfaite pendant que `bail poser --pourquoi "banc T-…" w5:p3` pose
// le bail sur « banc T-… » : une option à valeur non déclarée, et la valeur devient l'argument
// principal. C'est le défaut d'origine de `arguments.js` (`ouvrir --inviter <courriel> D-1`
// créait un canal nommé d'après l'adresse), et il coûte ici une mesure faussée : le pane RÉEL
// reste balayable pendant que la commande annonce un succès.
//
// ⚠️ DOUBLE CLOISON, la même que `cli.test.js` : `LIGNE_DIRECTE_RACINE` jetable ET un `PATH`
// sans `herdr`. Le geste `bail` ne parle ni au veilleur ni à herdr — mais une mutation qui
// casserait cette propriété ferait naître un veilleur qui lit le VRAI trousseau du poste.
// Deux veilleurs orphelins nés d'une campagne de mutation ont déjà tenu une connexion de
// production pendant des heures.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ligne-directe.js');

/** Une commande sous cloison, sur un bac à elle — rendu avec le bac, pour enchaîner les gestes. */
function commande() {
  const bac = mkdtempSync(join(tmpdir(), 'ld-bail-cli-'));
  return {
    bac,
    async lancer(args) {
      try {
        const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
          env: { ...process.env, LIGNE_DIRECTE_RACINE: bac, PATH: join(bac, 'sans-herdr') },
        });
        return { code: 0, stdout, stderr };
      } catch (err) {
        return { code: err.code ?? 1, stdout: err.stdout || '', stderr: err.stderr || '' };
      }
    },
  };
}

test('LA COMMANDE POSE LE BAIL SUR LE PANE, JAMAIS SUR LA VALEUR D’UNE OPTION', async () => {
  const c = commande();
  const pose = await c.lancer(['bail', 'poser', '--pourquoi', 'banc T-20260818-0078', 'w5:p3']);
  assert.equal(pose.code, 0, pose.stderr);
  assert.equal(JSON.parse(pose.stdout).bail.pane, 'w5:p3', 'le pane, pas le motif');

  // Et on le relit par la commande, pas par le fichier : c'est ce que verra celui qui vérifie.
  const liste = JSON.parse((await c.lancer(['bail', 'liste'])).stdout);
  assert.deepEqual(
    liste.baux.map((b) => b.pane),
    ['w5:p3']
  );
  assert.equal(liste.baux[0].pourquoi, 'banc T-20260818-0078');

  // L'ordre inverse doit marcher aussi — c'est celui qu'on tape naturellement.
  const c2 = commande();
  const autre = await c2.lancer(['bail', 'poser', '--minutes', '10', 'w9:p9']);
  assert.equal(JSON.parse(autre.stdout).bail.pane, 'w9:p9');
});

test('LA COMMANDE DIT L’ÉCRÊTAGE — un bail posé pour moins longtemps que demandé se dit', async () => {
  const c = commande();
  const r = await c.lancer(['bail', 'poser', 'w1:p1', '--minutes', '10000']);
  assert.equal(r.code, 0, 'le bail EST pose : refuser laisserait le pane sans protection');
  assert.equal(JSON.parse(r.stdout).bail.minutes, MINUTES_PLAFOND);
  assert.match(r.stderr, /ECRETEE/, 'le silence ferait croire à celui qui a demandé une semaine qu’il l’a');
});

test('LA COMMANDE LÈVE — et un bail sans pane est REFUSÉ sans rien écrire', async () => {
  const c = commande();
  await c.lancer(['bail', 'poser', 'w1:p1', '--minutes', '30']);
  const leve = await c.lancer(['bail', 'lever', 'w1:p1']);
  assert.equal(leve.code, 0, leve.stderr);
  assert.equal(JSON.parse(leve.stdout).leve, true);
  assert.deepEqual(JSON.parse((await c.lancer(['bail', 'liste'])).stdout).baux, []);

  const sansPane = await c.lancer(['bail', 'poser', '--minutes', '30']);
  assert.equal(sansPane.code, 1);
  assert.match(sansPane.stderr, /attend le pane/);
  assert.deepEqual(JSON.parse((await c.lancer(['bail', 'liste'])).stdout).baux, [], 'un refus ne pose rien');
});

test('L’AIDE NOMME LE BAIL — un geste que personne ne découvre ne protège personne', async () => {
  const r = await commande().lancer([]);
  assert.match(r.stdout, /bail poser/);
  assert.match(r.stdout, /bail lever/);
});

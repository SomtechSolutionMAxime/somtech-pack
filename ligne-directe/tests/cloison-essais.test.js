// LE TROISIÈME MUR — une suite de tests ne joint jamais le vrai espace Slack.
//
// Les deux cloisons existantes protègent le REGISTRE : un `LIGNE_DIRECTE_RACINE` jetable,
// un `PATH` sans `herdr`. Elles ne protègent pas l'ESPACE SLACK, et la différence n'est pas
// théorique : deux veilleurs orphelins nés d'une campagne de mutation ont tenu une connexion
// de production pendant des heures. Slack répartit ses événements entre les connexions
// actives — deux messages du dirigeant sur trois partaient vers un veilleur sans registre et
// étaient jetés en silence. Le dirigeant a cru sa ligne morte. Un canal de production est né
// du même coup (`#d-canal-qui-ne-doit-pas-naitre`), créé par la suite de tests elle-même.
//
// Ce que ces tests exigent est plus fort que « la commande s'arrête » : ils exigent que
// MÊME AVEC LE CODE CASSÉ — cloison herdr défaite, comme le fait une mutation — rien
// n'atteigne Slack. C'est pour ça que le mur vit dans le code de production (src/cloison.js)
// et pas dans un fichier de test : le veilleur naît dans un AUTRE processus.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CloisonEssais, enEssais } from '../src/cloison.js';
import { lireJeton, lireJetons } from '../src/trousseau.js';
import { appeler } from '../src/slack.js';
import { Veilleur } from '../src/veilleur.js';

const execFileAsync = promisify(execFile);
const ICI = dirname(fileURLToPath(import.meta.url));
const CLI = join(ICI, '..', 'bin', 'ligne-directe.js');

// ═════════════════════════════════ les trois murs, un par un

test('LA CLOISON SE SAIT LEVÉE — sans quoi tout le reste de ce fichier ne prouve rien', () => {
  assert.equal(enEssais(), true, 'ce fichier tourne sous le lanceur de tests : la cloison doit le voir');
});

test('MUR 1 — LE VRAI TROUSSEAU DU POSTE EST HORS D’ATTEINTE', async () => {
  // Sans ce mur, cet appel rendrait le VRAI jeton de production : il est déposé sur ce
  // poste, et c'est exactement ce que lisaient les deux veilleurs orphelins.
  await assert.rejects(() => lireJeton('ligne-directe-bot'), (err) => {
    assert.ok(err instanceof CloisonEssais);
    assert.match(err.message, /trousseau/i);
    return true;
  });
  await assert.rejects(() => lireJetons(), CloisonEssais);
});

test('MUR 2 — UN APPEL SLACK SANS DOUBLE MONTÉ NE PART PAS', async () => {
  // Le mur ne peut pas se contenter de regarder l'intention : il compare le transport à
  // celui du démarrage. Un test qui a monté son faux Slack passe ; un test qui a oublié se
  // le fait dire tout de suite, au lieu de le découvrir dans un journal trois heures après.
  await assert.rejects(() => appeler('auth.test', 'un-vrai-jeton'), (err) => {
    assert.ok(err instanceof CloisonEssais);
    assert.match(err.message, /auth\.test/);
    return true;
  });
});

test('MUR 2 — mais un test qui monte son double travaille normalement', async () => {
  // La cloison qui empêche de travailler serait contournée dès la semaine suivante.
  const { fauxSlack } = await import('./aide/faux-slack.js');
  const monde = fauxSlack({}).installer();
  try {
    assert.equal((await appeler('auth.test', 'jeton')).team, 'T_ESSAIS');
  } finally {
    monde.restaurer();
  }
});

test('MUR 3 — LA CONNEXION D’ÉCOUTE NE S’OUVRE PAS, ET ELLE NE DEMANDE MÊME PAS SON ADRESSE', async () => {
  // C'est LA connexion qui a capté les messages du dirigeant. Le mur se lève avant tout
  // appel : on le prouve en donnant au veilleur un Slack qui compterait ses appels.
  let demandes = 0;
  const v = new Veilleur({
    cheminSocket: join(mkdtempSync(join(tmpdir(), 'ld-mur3-')), 'v.sock'),
    jetons: { robot: 'x', ecoute: 'y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    slack: {
      async ouvrirEcoute() {
        demandes += 1;
        return 'wss://slack.invalide/lien';
      },
    },
    herdr: { async agents() { return []; } },
  });

  assert.throws(() => v.connecterSlack(), CloisonEssais);
  assert.equal(demandes, 0, 'le mur doit se lever AVANT la demande d’adresse d’écoute');
});

// ═════════════════════════════════ la mutation reproduite, de bout en bout

/**
 * Un faux `herdr` qui RÉPOND CORRECTEMENT — c'est-à-dire la deuxième cloison défaite.
 *
 * On ne simule pas ici un test distrait : on reproduit ce que fait une campagne de mutation,
 * dont le travail est précisément de casser les garde-fous qui retenaient la commande.
 */
function herdrComplaisant(bac) {
  const dossier = join(bac, 'bin');
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'herdr');
  writeFileSync(
    chemin,
    `#!/bin/sh
case "$1 $2" in
  "pane current") echo '{"result":{"pane":{"pane_id":"w1:p1","name":"essais","foreground_cwd":"/w/a"}}}' ;;
  "agent list")   echo '{"result":{"agents":[{"agent":"claude","pane_id":"w1:p1"}]}}' ;;
  "agent prompt") echo '{"result":{"ok":true}}' ;;
  *)              echo '{"result":{}}' ;;
esac
`,
    { mode: 0o755 }
  );
  chmodSync(chemin, 0o755);
  return dossier;
}

test('MÊME AVEC LA CLOISON HERDR DÉFAITE, AUCUN VEILLEUR N’ATTEINT SLACK', async () => {
  // LE test de ce correctif, et le seul qui reproduise le vécu. Avec un herdr qui répond, la
  // commande va jusqu'au bout : elle fait naître le veilleur détaché. Sans le troisième mur,
  // ce veilleur lit le vrai trousseau, ouvre une connexion de production, et crée un canal —
  // c'est très exactement ainsi qu'est né `#d-canal-qui-ne-doit-pas-naitre`.
  const bac = mkdtempSync(join(tmpdir(), 'ld-mur-'));
  const chemins = herdrComplaisant(bac);

  const r = await execFileAsync(process.execPath, [CLI, 'ouvrir', 'D-MUTATION', '--nature', 'client'], {
    env: { ...process.env, LIGNE_DIRECTE_RACINE: bac, PATH: `${chemins}:/usr/bin:/bin` },
  }).catch((err) => ({ code: err.code ?? 1, stdout: err.stdout || '', stderr: err.stderr || '' }));

  assert.notEqual(r.code, 0, 'la commande ne doit pas rendre « ligne ouverte » : rien n’a été ouvert');

  // La preuve est dans le journal du veilleur : il a bien été mis au monde — la cloison
  // herdr était défaite — et c'est le mur qui l'a arrêté avant qu'il joigne Slack.
  const journal = join(bac, 'veilleur.log');
  assert.ok(existsSync(journal), 'le veilleur a bien été mis au monde : c’est le cas qu’on couvre');
  const dit = readFileSync(journal, 'utf8');
  assert.match(dit, /CLOISON D'ESSAIS/, 'c’est le mur qui doit l’avoir arrêté, pas un hasard');
  assert.match(dit, /trousseau/i, 'et il doit l’avoir arrêté AVANT tout accès aux jetons');

  // Et rien de vivant ne reste derrière : ni socket, ni registre.
  const restes = readdirSync(bac).filter((f) => f !== 'bin' && f !== 'veilleur.log');
  assert.deepEqual(restes, [], `aucun registre ni socket ne doit survivre — trouvé : ${restes.join(', ')}`);
});

test('le mur tient AUSSI quand un jeton arrive par un autre chemin que le trousseau', async () => {
  // On ne suppose pas que le premier mur tiendra toujours : un jeton peut arriver d'une
  // variable d'environnement, d'un test mal cloisonné, d'un refactor. Le veilleur porte ici
  // ses jetons en main — le trousseau n'est jamais consulté — et il ne joint pas Slack.
  const bac = mkdtempSync(join(tmpdir(), 'ld-mur-jetons-'));
  const v = new Veilleur({
    cheminSocket: join(bac, 'v.sock'),
    jetons: { robot: 'jeton-de-production', ecoute: 'jeton-de-production' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    herdr: { async agents() { return []; } },
  });

  await assert.rejects(() => v.slack.identite('jeton-de-production'), CloisonEssais);
  assert.throws(() => v.connecterSlack(), CloisonEssais);
});

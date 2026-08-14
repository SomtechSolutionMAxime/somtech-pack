// L'INVITATION SE PROUVE PAR LES MEMBRES DU CANAL — jamais par un code de retour (T-20260814-0136).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER GARDE, ET POURQUOI IL A FALLU L'ÉCRIRE
//
// `ouvrir … --au-dirigeant` rendait `{ok: true}` sur une ligne DÉJÀ OUVERTE sans avoir fait
// entrer personne. Mesuré en production le 2026-08-14 : un orchestrateur a posté trois demandes
// d'arbitrage dans un canal qui n'a jamais eu qu'un membre — son propre robot. Cinq gestes de
// reprise, cinq `ok`, un seul membre à chaque relecture indépendante.
//
// LA CAUSE, LUE DANS LE CODE : `ouvrir` bifurque en deux branches, et une seule appelle Slack.
// La branche de CRÉATION invite ; la branche de REPRISE écrit la liste des autorisés au registre
// local et sort. Le contraste le disait déjà : `--au-gestionnaire`, qui est purement local,
// fonctionnait très bien en reprise — c'est l'appel DISTANT qui manquait.
//
// ⚠️ CE QUE CES ESSAIS REGARDENT — `monde.canalNomme(…).membres`, l'espace Slack lui-même.
// L'essai de reprise qui existait regardait `ligne.autorises`, c'est-à-dire le registre local :
// il serait resté vert pendant toute la panne, puisque le registre était juste. Regarder l'état
// que la commande PRÉTEND avoir atteint, et pas celui qu'elle a écrit chez elle, est toute la
// différence entre les deux essais.
//
// LE PRINCIPE QUI GOUVERNE TOUT LE LOT : une preuve doit porter sur un état qui POUVAIT être
// différent. Le double de `faux-slack.js` mute réellement `membres` sur `conversations.invite` —
// une invitation non émise y est donc parfaitement observable. Le double n'était pas en cause ;
// c'est l'assertion qui manquait.
//
// ⚠️ LA CLOISON D'ESSAIS N'EST PAS CONTOURNÉE (RA-REL-012) : `globalThis.fetch` est remplacé par
// le double, la commande ne voit qu'un `LIGNE_DIRECTE_RACINE` jetable et un faux `herdr`, et
// AUCUN essai ne lit le trousseau du poste.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fauxSlack } from './aide/faux-slack.js';

const execFileAsync = promisify(execFile);
const ICI = dirname(fileURLToPath(import.meta.url));
const CLI = join(ICI, '..', 'bin', 'ligne-directe.js');

let Veilleur, sauverRegistre, chargerRegistre;
let racine;
let binFaux;
let compteur = 0;

const UDIR = 'UDIR';
const UMOI = 'UMOI';
const PANE = 'w1:p1';
/** Le faux `herdr` rend ce dossier en `foreground_cwd` — c'est la copie de travail de la ligne. */
const WORKTREE = '/w';

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-invitation-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre } = await import('../src/registre.js'));

  binFaux = join(racine, 'bin');
  mkdirSync(binFaux, { recursive: true });
  const faux = join(binFaux, 'herdr');
  writeFileSync(
    faux,
    `#!${process.execPath}\n` +
      `const a = process.argv.slice(2).join(' ');\n` +
      `if (a === 'pane current') {\n` +
      `  process.stdout.write(JSON.stringify({ result: { pane: { pane_id: process.env.FAUX_PANE, foreground_cwd: '${WORKTREE}' } } }));\n` +
      `} else {\n` +
      `  process.stdout.write(JSON.stringify({ error: { code: 'unsupported', message: a } }));\n` +
      `}\n`
  );
  chmodSync(faux, 0o755);
});

after(() => rmSync(racine, { recursive: true, force: true }));

/** Des agents qui vivent : le veilleur doit pouvoir les retrouver. */
function agentsQuiTravaillent({ panes = [PANE] } = {}) {
  const dossier = join(racine, `travail-${(compteur += 1)}`);
  mkdirSync(dossier, { recursive: true });
  return {
    recu: [],
    async vivant(pane) {
      return panes.includes(pane);
    },
    async remettre(pane, texte) {
      this.recu.push({ pane, texte });
      return { delivered: true };
    },
    async agents() {
      return panes.map((p) => ({ agent: 'claude', pane_id: p, herdr_socket: `/s/${p}` }));
    },
  };
}

/**
 * Un poste complet, avec un registre POSÉ D'AVANCE.
 *
 * `lignes` permet de partir d'une ligne DÉJÀ OUVERTE — l'état exact de la panne mesurée : le
 * canal existe, la ligne est au registre, et le dirigeant n'est pas dans le canal. C'est la
 * seule façon d'éprouver la reprise sans passer par une création qui, elle, invite déjà.
 */
async function avecPoste({ canaux = [], lignes = [], dirigeantDesigne = { id: UDIR, courriel: 'dirigeant@somtech.ca' } }, corps) {
  sauverRegistre({ version: 1, lignes, commun: null, dirigeant: dirigeantDesigne });
  const monde = fauxSlack({
    canaux,
    utilisateurs: [{ id: UDIR, name: 'maxime', profile: { real_name: 'Maxime', email: 'dirigeant@somtech.ca' } }],
  }).installer();
  const v = new Veilleur({
    // LE NOM DU SOCKET EST CELUI QUE LA COMMANDE IRA CHERCHER — un nom unique par essai
    // laisserait la commande ne trouver personne, démarrer un veilleur à elle, échouer au bout
    // de dix secondes… et rendre le code 1 que certains de ces essais attendent. Deux d'entre
    // eux ont été verts pour cette raison-là avant que ce commentaire existe.
    cheminSocket: join(racine, 'veilleur.sock'),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: UMOI },
    herdr: agentsQuiTravaillent(),
  });
  await v.ecouterLocal();
  const ld = async (args, pane = PANE) => {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
        env: { ...process.env, LIGNE_DIRECTE_RACINE: racine, PATH: binFaux, FAUX_PANE: pane },
      });
      return { code: 0, stdout, stderr };
    } catch (err) {
      return { code: err.code ?? 1, stdout: err.stdout || '', stderr: err.stderr || '' };
    }
  };
  try {
    return await corps({ monde, ld, veilleur: v });
  } finally {
    await v.arreter();
    monde.restaurer();
  }
}

/** Une ligne interne DÉJÀ OUVERTE au registre, telle que `inscrireLigne` l'écrit. */
function ligneOuverte({ chantier = 'dirigeant', canalId = 'C_dir', canalNom = 'ligne-dirigeant-acme', autorises = [] } = {}) {
  return {
    chantier,
    canal_id: canalId,
    canal_nom: canalNom,
    pane: PANE,
    worktree: WORKTREE,
    herdr_socket: null,
    nature: 'interne',
    libelle: chantier,
    autorises,
    pair: null,
    visage: ':robot_face:',
    ouverte_le: '2026-08-14T16:04:00.000Z',
    close_le: null,
  };
}

// ═════════════════ 1. LA REPRISE INVITE — c'est le geste qui manquait

test('UNE LIGNE DÉJÀ OUVERTE ACCUEILLE LE DIRIGEANT — la reprise invite, elle ne se contente pas de l’inscrire', async () => {
  // L'ÉTAT EXACT DE LA PANNE : le canal a été créé avant que le dirigeant soit désigné sur le
  // poste, il n'a donc qu'un membre. Il est désigné maintenant, et l'agent reprend sa ligne.
  const canal = { id: 'C_dir', name: 'ligne-dirigeant-acme', is_private: false, membres: [UMOI] };
  await avecPoste({ canaux: [canal], lignes: [ligneOuverte()] }, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'dirigeant', '--titre', 'ligne dirigeant acme', '--au-dirigeant']);
    assert.equal(r.code, 0, r.stderr);

    // LA PREUVE EST DANS L'ESPACE. `ligne.autorises` était déjà juste pendant toute la panne :
    // le regarder ici ne prouverait rien de ce que cet essai existe pour attraper.
    assert.ok(
      monde.canalNomme('ligne-dirigeant-acme').membres.includes(UDIR),
      'le dirigeant doit être MEMBRE du canal après la reprise — un `ok` sans lui est la panne'
    );
  });
});

test('LA REPRISE N’OUVRE PAS UN SECOND CANAL POUR AUTANT — elle invite dans celui qui existe', async () => {
  const canal = { id: 'C_dir', name: 'ligne-dirigeant-acme', is_private: false, membres: [UMOI] };
  await avecPoste({ canaux: [canal], lignes: [ligneOuverte()] }, async ({ monde, ld }) => {
    const avant = monde.canaux.length;
    const r = await ld(['ouvrir', 'dirigeant', '--titre', 'ligne dirigeant acme', '--au-dirigeant']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(monde.canaux.length, avant, 'AUCUN second canal — c’est une reprise, pas une création');
    const lignes = chargerRegistre().lignes.filter((l) => !l.close_le);
    assert.equal(lignes.length, 1, 'et une seule ligne au registre');
  });
});

test('LE DIRIGEANT DÉJÀ MEMBRE NE FAIT PAS ÉCHOUER LA REPRISE — reprendre une ligne saine est le cas nominal', async () => {
  // Le cas de loin le plus fréquent : l'agent redémarre, tout est déjà en place. La garde ne
  // doit pas transformer une reprise ordinaire en refus, sans quoi personne ne pourra plus
  // reprendre une ligne — le remède serait pire que le mal.
  const canal = { id: 'C_dir', name: 'ligne-dirigeant-acme', is_private: false, membres: [UMOI, UDIR] };
  await avecPoste({ canaux: [canal], lignes: [ligneOuverte({ autorises: [UDIR] })] }, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'dirigeant', '--titre', 'ligne dirigeant acme', '--au-dirigeant'], 'w1:p9');
    assert.equal(r.code, 0, r.stderr);
    assert.ok(monde.canalNomme('ligne-dirigeant-acme').membres.includes(UDIR));
    assert.equal(chargerRegistre().lignes[0].pane, 'w1:p9', 'et le pane neuf a bien été pris');
  });
});

test('UNE INVITATION QUI N’A PAS PRIS FAIT ÉCHOUER LE GESTE — le code de retour ne fait jamais foi', async () => {
  // ⚠️ CE QUE CET ESSAI SUPPOSE, ET CE QU'IL NE SUPPOSE PAS. Il n'affirme pas que Slack ment :
  // ce n'est pas mesuré. Il garde la propriété que le ticket exige — si l'état visé n'est pas
  // constaté, on le DIT. `slack.js` avale déjà deux erreurs d'invitation (`already_in_channel`,
  // `cant_invite_self`) ; toute erreur avalée est un chemin par lequel un `ok` peut sortir sans
  // que personne soit entré. La relecture est ce qui protège quelle que soit la cause.
  const canal = { id: 'C_dir', name: 'ligne-dirigeant-acme', is_private: false, membres: [UMOI] };
  await avecPoste({ canaux: [canal], lignes: [ligneOuverte()], }, async ({ monde, ld }) => {
    monde.inviterSansEffet = true; // le service accepte l'appel et n'ajoute personne
    const r = await ld(['ouvrir', 'dirigeant', '--titre', 'ligne dirigeant acme', '--au-dirigeant']);
    assert.equal(r.code, 1, 'le geste doit ÉCHOUER : la ligne est muette et personne ne le saurait');
    assert.match(r.stdout + r.stderr, /membre|invit/i, 'et le refus doit nommer ce qui n’a pas eu lieu');
  });
});

// ═════════════════ 2. UNE LIGNE INTERNE SANS INVITÉ N'EST PAS UNE LIGNE

test('OUVRIR UNE LIGNE INTERNE SANS PERSONNE À INVITER EST REFUSÉ — l’aide le promet, le code doit le tenir', async () => {
  // C'est le premier geste mesuré de la panne : `ouvrir <chantier> --titre "…"`, sans drapeau,
  // aucun dirigeant désigné. Il rendait `ok` et créait un canal où personne ne peut parler —
  // une ligne INTERNE autorise par LISTE, et la liste était vide.
  await avecPoste({ dirigeantDesigne: null }, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis']);
    assert.equal(r.code, 1, 'le geste est refusé');
    assert.equal(monde.canalNomme('refonte-du-devis'), null, 'AUCUN canal créé — le refus tombe avant');
    assert.deepEqual(chargerRegistre().lignes, [], 'et rien n’est inscrit au registre');
    assert.match(r.stdout + r.stderr, /dirigeant/i, 'le refus doit dire quoi faire');
  });
});

test('UN COURRIEL D’INVITÉ QUI NE DÉSIGNE PERSONNE EST REFUSÉ — pas un avertissement sur la sortie d’erreur', async () => {
  // `--inviter inconnu@…` écrivait « avertissement : … le canal est créé sans lui » sur stderr,
  // rendait 0, et ouvrait la ligne muette. Un avertissement que personne ne lit sur un geste
  // qui réussit est le même défaut que le `ok` du reste de ce lot.
  await avecPoste({ dirigeantDesigne: null }, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--inviter', 'personne@nulle-part.ca']);
    assert.equal(r.code, 1, 'le geste est refusé');
    assert.equal(monde.canalNomme('refonte-du-devis'), null, 'et aucun canal n’est créé');
  });
});

test('LA LIGNE DU CLIENT N’EXIGE AUCUN INVITÉ — elle autorise par appartenance, et sa règle ne bouge pas', async () => {
  // NON-RÉGRESSION. Une ligne CLIENT démarre volontairement avec `autorises: []` : les gens du
  // client sont invités À LA MAIN dans Slack après l'ouverture, et c'est leur appartenance au
  // canal privé qui les autorise. Le refus ci-dessus ne doit pas déborder sur elle.
  await avecPoste({ dirigeantDesigne: null }, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'acme', '--nature', 'client', '--titre', 'Espace Acme']);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(monde.canalNomme('espace-acme'), 'le canal du client est bien créé');
    assert.equal(monde.canalNomme('espace-acme').is_private, true);
  });
});

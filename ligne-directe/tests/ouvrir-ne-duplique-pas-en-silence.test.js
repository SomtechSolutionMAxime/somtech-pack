// OUVRIR NE DUPLIQUE PAS UNE LIGNE EN SILENCE (T-20260818-0026) — ET PEUT VISER UN CANAL
// EXISTANT PAR SON IDENTIFIANT (T-20260908-0057).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI A ÉTÉ MESURÉ AU BANC, APRÈS T-20260827-0033
//
// L'ancre d'une ligne est le LIEU de l'agent quand il en a un (`.orchestrateur/…`,
// `.gestionnaire/…`), et le CHEMIN tel quel sinon. Le repli est voulu : deux agents ordinaires
// du même chantier dans deux copies de travail restent deux lignes. Mais le geste qui en
// découlait était muet : un agent SANS lieu de rôle, ligne ouverte sur X depuis la copie A,
// redemande X depuis la copie B → `reprise:false`, un second canal suffixé `-2`, `ok:true`, et
// deux lignes ouvertes au registre. Personne n'a rien demandé de tel, et rien ne le dit.
//
// ⚠️ LE REMÈDE NE DOIT PAS EMPORTER LE CAS LÉGITIME. Trois représentants distincts partagent le
// chantier « dirigeant » sous trois lieux `.gestionnaire` différents : deux LIEUX DE RÔLE
// distincts restent deux lignes, sans refus. Le refus ne tombe que lorsqu'une des deux ancres au
// moins n'est pas un lieu — c'est-à-dire quand on ne sait pas si c'est le même agent.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE VOISIN — T-20260908-0057
//
// Registre perdu, `ouvrir` dérivait le nom du canal du TITRE, et `creerCanal` reprenait en
// silence un homonyme : un représentant s'est retrouvé sur un canal étranger, un autre a dû
// changer son titre visible pour retomber sur le sien. `--canal <id>` vise un canal EXISTANT,
// sans jamais dériver un nom ni appeler `conversations.create`.
//
// ⚠️ ON OBSERVE LE MONDE, PAS LE CODE DE RETOUR. Un refus qui aurait déjà créé le canal serait
// un refus décoratif : chaque essai compte les canaux du monde et les lignes du registre.

import { test, before, after, beforeEach } from 'node:test';
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

const UDIR = 'UDIR';
const UMOI = 'UMOI';
const DIRIGEANT = { id: UDIR, courriel: 'dirigeant@somtech.ca' };

// Deux copies de travail ORDINAIRES — aucun lieu de rôle dans le chemin.
const WT_A = '/Users/x/worktrees/pack/20260801-000000';
const WT_B = '/Users/x/worktrees/pack/20260802-000000';

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-duplique-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre } = await import('../src/registre.js'));

  binFaux = join(racine, 'bin');
  mkdirSync(binFaux, { recursive: true });
  const faux = join(binFaux, 'herdr');
  // La copie de travail vient de l'environnement : le double de `herdr` du dépôt rend un `/w`
  // constant, et ne pourrait pas exercer deux copies distinctes.
  writeFileSync(
    faux,
    `#!${process.execPath}\n` +
      `const a = process.argv.slice(2).join(' ');\n` +
      `if (a === 'pane current') {\n` +
      `  process.stdout.write(JSON.stringify({ result: { pane: { pane_id: process.env.FAUX_PANE, foreground_cwd: process.env.FAUX_WT } } }));\n` +
      `} else {\n` +
      `  process.stdout.write(JSON.stringify({ error: { code: 'unsupported', message: a } }));\n` +
      `}\n`
  );
  chmodSync(faux, 0o755);
});

after(() => rmSync(racine, { recursive: true, force: true }));
beforeEach(() => sauverRegistre({ version: 1, lignes: [], communs: {}, commun: null, dirigeant: DIRIGEANT }));

function agentsQuiVivent({ panes }) {
  return {
    async vivant(pane) {
      return panes.includes(pane);
    },
    async remettre() {
      return { delivered: true };
    },
    async agents() {
      return panes.map((p) => ({ agent: 'claude', pane_id: p, herdr_socket: null }));
    },
    async panes() {
      return {
        panes: panes.map((p) => ({ pane_id: p, agent_session: { agent: 'claude' }, herdr_socket: null })),
        sessionsInterrogees: 1,
        sessionsRefusees: [],
      };
    },
  };
}

async function avecPoste({ canaux = [], lignes = null, panes = ['w1:p1', 'w2:p7'] }, corps) {
  const monde = fauxSlack({
    canaux,
    utilisateurs: [{ id: UDIR, name: 'maxime', profile: { real_name: 'Maxime', email: DIRIGEANT.courriel } }],
  }).installer();
  // Le registre s'écrit AVANT le veilleur : il le charge à sa naissance.
  if (lignes) sauverRegistre({ version: 1, communs: {}, commun: null, dirigeant: DIRIGEANT, lignes });
  const v = new Veilleur({
    cheminSocket: join(racine, 'veilleur.sock'),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: UMOI },
    herdr: agentsQuiVivent({ panes }),
  });
  await v.ecouterLocal();
  const ld = async (args, { pane = 'w1:p1', wt = WT_A } = {}) => {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
        env: { ...process.env, LIGNE_DIRECTE_RACINE: racine, PATH: binFaux, FAUX_PANE: pane, FAUX_WT: wt },
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

const ouvertes = () => chargerRegistre().lignes.filter((l) => !l.close_le);
const creations = (monde) => monde.appels.filter((a) => a.methode === 'conversations.create').length;

// ═════════════════ 1. LE DOUBLON SILENCIEUX — CE QUI A ÉTÉ MESURÉ

test('UN AGENT ORDINAIRE QUI REDEMANDE SON CHANTIER DEPUIS UNE AUTRE COPIE EST REFUSÉ — rien n’est créé', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    const a = await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w1:p1', wt: WT_A });
    assert.equal(a.code, 0, a.stderr);
    const canal = monde.canalNomme('chantier-neuf');
    assert.ok(canal, 'la première ligne a son canal');

    const b = await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w2:p7', wt: WT_B });

    assert.notEqual(b.code, 0, 'le refus sort en code non nul — un code 0 se lirait comme une ouverture');
    assert.equal(monde.canaux.length, 1, 'AUCUN canal n’est né — le compte du monde est ce qui prouve l’absence');
    assert.equal(monde.canalNomme('chantier-neuf-2'), null);
    assert.equal(ouvertes().length, 1, 'le registre ne porte toujours qu’UNE ligne ouverte');
    assert.match(b.stderr, new RegExp(canal.id), 'le refus NOMME le canal existant par son identifiant');
    assert.match(b.stderr, /#chantier-neuf\b/, 'et par son nom');
    assert.match(b.stderr, new RegExp(`--canal ${canal.id}`), 'la première sortie est écrite telle qu’on la tape');
    assert.match(b.stderr, /--distincte/, 'la seconde sortie est nommée aussi');
  });
});

test('LE MÊME PANE DANS UNE AUTRE COPIE EST REFUSÉ AUSSI — le pane ne fait pas l’identité', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w1:p1', wt: WT_A });
    const b = await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w1:p1', wt: WT_B });
    assert.notEqual(b.code, 0, b.stdout);
    assert.equal(monde.canaux.length, 1);
    assert.equal(ouvertes().length, 1);
  });
});

test('LA CASSE DU CHANTIER NE CONTOURNE PAS LE REFUS — « J-9 » et « j-9 » sont le même chantier', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w1:p1', wt: WT_A });
    const b = await ld(['ouvrir', 'J-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w2:p7', wt: WT_B });
    assert.notEqual(b.code, 0, b.stdout);
    assert.equal(monde.canaux.length, 1);
  });
});

test('LE REFUS PASSE AUSSI AU VEILLEUR — ok:false, motif nommé, sans la commande', async () => {
  await avecPoste({}, async ({ monde, veilleur }) => {
    const a = await veilleur.ouvrir({ chantier: 'j-9', pane: 'w1:p1', worktree: WT_A, titre: 'Chantier neuf', au_dirigeant: true });
    assert.equal(a.ok, true, a.erreur);
    const b = await veilleur.ouvrir({ chantier: 'j-9', pane: 'w2:p7', worktree: WT_B, titre: 'Chantier neuf', au_dirigeant: true });
    assert.equal(b.ok, false);
    assert.equal(b.motif, 'ligne_deja_ouverte_ailleurs');
    assert.equal(b.existante?.canal_id, a.canal_id, 'le refus porte le canal existant, pour qu’un appelant n’ait pas à lire une phrase');
    assert.equal(creations(monde), 1, 'un seul conversations.create : celui de la première ligne');
  });
});

// ═════════════════ 2. LES DEUX SORTIES

test('--canal <id> REPREND LA LIGNE EXISTANTE — une seule entrée, rafraîchie', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w1:p1', wt: WT_A });
    const canal = monde.canalNomme('chantier-neuf');

    const b = await ld(['ouvrir', 'j-9', '--canal', canal.id, '--au-dirigeant'], { pane: 'w2:p7', wt: WT_B });
    assert.equal(b.code, 0, b.stderr);
    const rendu = JSON.parse(b.stdout);
    assert.equal(rendu.reprise, true);
    assert.equal(rendu.canal_id, canal.id, 'c’est le canal visé, inchangé');
    assert.equal(monde.canaux.length, 1);
    assert.equal(creations(monde), 1, 'la reprise n’a appelé aucun conversations.create');
    const lignes = ouvertes();
    assert.equal(lignes.length, 1, 'une seule ligne ouverte');
    assert.equal(lignes[0].pane, 'w2:p7', 'la ligne suit le pane de celui qui la reprend');
    assert.equal(lignes[0].worktree, WT_B, 'et sa copie de travail');
  });
});

test('--distincte OUVRE VOLONTAIREMENT UNE SECONDE LIGNE — comme avant, mais demandé', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w1:p1', wt: WT_A });
    const b = await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant', '--distincte'], {
      pane: 'w2:p7',
      wt: WT_B,
    });
    assert.equal(b.code, 0, b.stderr);
    assert.equal(JSON.parse(b.stdout).reprise, false);
    assert.equal(ouvertes().length, 2, 'le registre porte les DEUX lignes');
    assert.ok(monde.canalNomme('chantier-neuf-2'), 'et la seconde a son canal à elle');
  });
});

test('--distincte DANS UN TITRE N’EST PAS LE DRAPEAU — le refus tient', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w1:p1', wt: WT_A });
    const b = await ld(['ouvrir', 'j-9', '--titre', '--distincte', '--au-dirigeant'], { pane: 'w2:p7', wt: WT_B });
    assert.notEqual(b.code, 0, b.stdout);
    assert.equal(monde.canaux.length, 1);
  });
});

// ═════════════════ 3. CE QUE LE REFUS NE DOIT PAS TOUCHER

test('DEUX LIEUX .gestionnaire DISTINCTS SUR « dirigeant » RESTENT DEUX LIGNES — sans refus', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    const a = await ld(['ouvrir', 'dirigeant', '--titre', 'ligne dirigeant acme', '--au-dirigeant'], {
      pane: 'w1:p1',
      wt: '/Users/x/GitRepo.nosync/acme/.gestionnaire/acme',
    });
    assert.equal(a.code, 0, a.stderr);
    const b = await ld(['ouvrir', 'dirigeant', '--titre', 'ligne dirigeant beta', '--au-dirigeant'], {
      pane: 'w2:p7',
      wt: '/Users/x/GitRepo.nosync/beta/.gestionnaire/beta',
    });
    assert.equal(b.code, 0, b.stderr);
    assert.equal(JSON.parse(b.stdout).reprise, false);
    assert.equal(ouvertes().length, 2);
    assert.equal(monde.canaux.length, 2);
  });
});

test('UN LIEU DE RÔLE ET UN CHEMIN ORDINAIRE SUR LE MÊME CHANTIER : on ne sait pas si c’est le même agent — refus', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    await ld(['ouvrir', 'd-1', '--titre', 'Demande un', '--au-dirigeant'], {
      pane: 'w1:p1',
      wt: '/Users/x/GitRepo.nosync/pack/.orchestrateur/d-1',
    });
    const b = await ld(['ouvrir', 'd-1', '--titre', 'Demande un', '--au-dirigeant'], { pane: 'w2:p7', wt: WT_B });
    assert.notEqual(b.code, 0, b.stdout);
    assert.equal(monde.canaux.length, 1);
  });
});

test('CONTRE-ÉPREUVE : SANS LIGNE OUVERTE DU MÊME CHANTIER, OUVRIR CRÉE NORMALEMENT', async () => {
  // La garde doit se taire quand il n'y a rien à dire : une ligne d'un AUTRE chantier, et une
  // ligne CLOSE du même, ne sont pas des doublons.
  const close = {
    chantier: 'j-9',
    canal_id: 'CVIEUX',
    canal_nom: 'vieux-canal',
    pane: 'w1:p1',
    worktree: WT_A,
    nature: 'interne',
    libelle: 'j-9',
    autorises: [UDIR],
    pair: null,
    visage: null,
    jetable: true,
    ouverte_le: '2026-08-01T00:00:00.000Z',
    close_le: '2026-08-02T00:00:00.000Z',
  };
  const autre = { ...close, chantier: 'k-1', canal_id: 'CAUTRE', canal_nom: 'autre-chantier', close_le: null, jetable: undefined };
  await avecPoste({ lignes: [close, autre] }, async ({ monde, ld }) => {
    const b = await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w2:p7', wt: WT_B });
    assert.equal(b.code, 0, b.stderr);
    assert.equal(JSON.parse(b.stdout).reprise, false);
    assert.ok(monde.canalNomme('chantier-neuf'));
  });
});

// ═════════════════ 4. T-20260908-0057 — VISER UN CANAL EXISTANT PAR SON IDENTIFIANT

test('REGISTRE PERDU : --canal <id> POSE LA LIGNE SUR CE CANAL, JAMAIS SUR L’HOMONYME DU TITRE', async () => {
  const WT_REP = '/Users/x/GitRepo.nosync/acme/.gestionnaire/acme';
  const leSien = { id: 'CACME', name: 'espace-acme', is_private: true, membres: [UMOI, UDIR] };
  // LE PIÈGE MESURÉ : un canal privé étranger qui porte le nom que le titre produirait.
  const etranger = { id: 'CETRANGER', name: 'autre', is_private: true, membres: [UMOI] };
  await avecPoste({ canaux: [leSien, etranger] }, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'acme', '--nature', 'client', '--titre', 'Autre', '--canal', 'CACME'], {
      pane: 'w1:p1',
      wt: WT_REP,
    });
    assert.equal(r.code, 0, r.stderr);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.canal_id, 'CACME', 'la ligne est sur le canal VISÉ');
    assert.equal(rendu.canal, 'espace-acme', 'et porte SON nom, jamais un nom dérivé du titre');
    assert.equal(creations(monde), 0, 'aucun conversations.create — on n’a pas cherché de canal par le titre');
    assert.equal(monde.canaux.length, 2);
    const lignes = ouvertes();
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].canal_id, 'CACME');
    assert.equal(lignes[0].canal_nom, 'espace-acme');
    assert.equal(lignes[0].nature, 'client');
  });
});

test('--canal SUR UN CANAL INTROUVABLE EST REFUSÉ — rien n’est créé à sa place', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant', '--canal', 'CNEXISTEPAS'], {
      pane: 'w1:p1',
      wt: WT_A,
    });
    assert.notEqual(r.code, 0, r.stdout);
    assert.match(r.stderr, /CNEXISTEPAS/);
    assert.equal(monde.canaux.length, 0);
    assert.equal(ouvertes().length, 0);
  });
});

test('--canal NE CHANGE PAS LA CONFIDENTIALITÉ D’UN CANAL — un public ne porte pas une ligne cliente', async () => {
  const publique = { id: 'CPUB', name: 'general-acme', is_private: false, membres: [UMOI] };
  await avecPoste({ canaux: [publique] }, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'acme', '--nature', 'client', '--titre', 'Acme', '--canal', 'CPUB'], {
      pane: 'w1:p1',
      wt: '/Users/x/GitRepo.nosync/acme/.gestionnaire/acme',
    });
    assert.notEqual(r.code, 0, r.stdout);
    assert.match(r.stderr, /public/, 'le refus nomme la confidentialité — pas une panne d’à côté');
    assert.equal(ouvertes().length, 0);
    assert.equal(creations(monde), 0);
  });
});

test('--canal NE CHANGE PAS LA CONFIDENTIALITÉ D’UN CANAL — un privé ne porte pas une ligne interne', async () => {
  // L'AUTRE MOITIÉ DE LA MÊME GARDE, éprouvée à part : une garde réduite au seul sens
  // « public refusé au client » laissait toute la suite verte (revue de fond, passe 2). Le canal
  // privé d'un client ne doit pas devenir, par --canal, la ligne interne d'un chantier.
  const prive = { id: 'CPRIV', name: 'client-acme', is_private: true, membres: [UMOI] };
  await avecPoste({ canaux: [prive] }, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'j-9', '--au-dirigeant', '--canal', 'CPRIV'], { pane: 'w1:p1', wt: WT_A });
    assert.notEqual(r.code, 0, r.stdout);
    assert.match(r.stderr, /est privé/, 'le refus nomme la confidentialité — pas une panne d’à côté');
    assert.equal(ouvertes().length, 0);
    assert.equal(creations(monde), 0);
  });
});

test('--canal SUR UN CANAL ARCHIVÉ EST REFUSÉ — personne n’y écrirait', async () => {
  const archive = { id: 'CARCH', name: 'vieux', is_private: false, is_archived: true, membres: [UMOI, UDIR] };
  await avecPoste({ canaux: [archive] }, async ({ ld }) => {
    const r = await ld(['ouvrir', 'j-9', '--au-dirigeant', '--canal', 'CARCH'], { pane: 'w1:p1', wt: WT_A });
    assert.notEqual(r.code, 0, r.stdout);
    assert.match(r.stderr, /archivé/);
    assert.equal(ouvertes().length, 0);
  });
});

test('--canal D’UNE LIGNE D’UN AUTRE CHANTIER EST REFUSÉ — un canal ne porte qu’une ligne', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], { pane: 'w1:p1', wt: WT_A });
    const canal = monde.canalNomme('chantier-neuf');
    const r = await ld(['ouvrir', 'k-1', '--au-dirigeant', '--canal', canal.id], { pane: 'w2:p7', wt: WT_B });
    assert.notEqual(r.code, 0, r.stdout);
    assert.match(r.stderr, /porte déjà la ligne ouverte de « j-9 »/);
    const lignes = ouvertes();
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].chantier, 'j-9', 'la ligne d’origine n’a pas changé de chantier');
    assert.equal(lignes[0].pane, 'w1:p1', 'ni de porteur');
  });
});

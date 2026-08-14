// LE ROUTAGE SORTANT NOMMÉ — un geste qui parle ne devine plus sa ligne (T-20260813-0078).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER GARDE, ET POURQUOI IL EST ÉCRIT AINSI
//
// Le défaut corrigé tient en une expression : la commande choisissait sa ligne par le PANE,
// une clé qui ne l'identifie pas. Deux lignes sur un même pane, et `.find()` rendait la
// PREMIÈRE INSCRITE — un rapport destiné à un chantier est parti dans le canal d'un autre,
// avec `ok:true` et sans un mot. Sur une ligne cliente, c'est envoyer au client ce qu'on lui
// cache.
//
// LA PREUVE EST LE CANAL TOUCHÉ, JAMAIS LE TEXTE D'UN MESSAGE. Chaque test lit `monde.postes`
// — ce que le faux Slack a VRAIMENT reçu —, le drapeau `is_archived` du canal, ou son nom
// après renommage. Le refus, lui, se prouve par l'ABSENCE : zéro message dans les deux canaux,
// zéro archivage, zéro renommage. Un test qui chercherait un mot dans un refus prouverait
// seulement que quelqu'un a écrit une phrase — c'est le motif dominant de ce dépôt, et il vise
// ce lot nommément.
//
// ET C'EST LA VRAIE COMMANDE QUI EST LANCÉE, en processus séparé, contre un VRAI veilleur.
// Le chemin éprouvé est donc complet : argv → sélection → socket → veilleur → Slack. Rejouer
// la sélection dans le test aurait prouvé que le test est d'accord avec lui-même — c'est
// exactement le piège relevé sur le lot du canal commun.
//
// ⚠️ LA CLOISON D'ESSAIS N'EST PAS CONTOURNÉE : le transport (`globalThis.fetch`) est remplacé
// par le double de `tests/aide/faux-slack.js`, et la commande lancée ne voit qu'un
// `LIGNE_DIRECTE_RACINE` jetable et un faux `herdr`. Rien ne part vers slack.com.

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
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

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-routage-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre } = await import('../src/registre.js'));

  // UN FAUX `herdr`, ET C'EST LUI QUI DÉCIDE DU PANE COURANT. La commande lit son pane par
  // `herdr pane current` : sans ce double, elle s'arrête avant toute sélection — et le test
  // ne prouverait rien du chemin qu'il prétend éprouver.
  binFaux = join(racine, 'bin');
  mkdirSync(binFaux, { recursive: true });
  const faux = join(binFaux, 'herdr');
  writeFileSync(
    faux,
    `#!${process.execPath}\n` +
      `const a = process.argv.slice(2).join(' ');\n` +
      `if (a === 'pane current') {\n` +
      `  process.stdout.write(JSON.stringify({ result: { pane: { pane_id: process.env.FAUX_PANE, foreground_cwd: '/w' } } }));\n` +
      `} else {\n` +
      `  process.stdout.write(JSON.stringify({ error: { code: 'unsupported', message: a } }));\n` +
      `}\n`
  );
  chmodSync(faux, 0o755);
});

after(() => rmSync(racine, { recursive: true, force: true }));

beforeEach(() => sauverRegistre({ version: 1, lignes: [], commun: null }));

const CLIENT = { id: 'C_acme', name: 'acme', is_private: true, membres: ['UMOI', 'UCLIENT'] };
const DIRIGEANT_CANAL = { id: 'C_dir', name: 'ligne-dirigeant', is_private: false, membres: ['UMOI', 'UDIR'] };
const UDIR = 'UDIR';

function ligne({ chantier, canalId, canalNom, pane = 'w1:p1', worktree = '/w', nature = 'interne', libelle }) {
  return {
    chantier,
    canal_id: canalId,
    canal_nom: canalNom,
    pane,
    worktree,
    nature,
    libelle: libelle || chantier,
    autorises: nature === 'client' ? ['UCLIENT'] : [UDIR],
    visage: '🧭',
    ouverte_le: 'hier',
    close_le: null,
  };
}

/**
 * Des agents qui TRAVAILLENT — recevoir a un effet sur le disque, et c'est l'effet qu'on lit.
 * Un double qui empile les appels reçus laisserait passer un cadre tronqué ou une remise au
 * mauvais pane, c'est-à-dire très exactement le défaut de ce lot, dans l'autre sens.
 */
function agentsQuiTravaillent({ panes = ['w1:p1'] } = {}) {
  const dossier = join(racine, `travail-${(compteur += 1)}`);
  mkdirSync(dossier, { recursive: true });
  return {
    fichier: (pane) => join(dossier, `${pane.replace(/[^a-z0-9]/gi, '_')}.txt`),
    async vivant(pane) {
      return panes.includes(pane);
    },
    async remettre(pane, texte) {
      writeFileSync(this.fichier(pane), texte);
      return { delivered: true };
    },
    async agents() {
      return panes.map((p) => ({ agent: 'claude', pane_id: p, herdr_socket: `/s/${p}` }));
    },
  };
}

/**
 * Un poste complet : un registre, un espace Slack en mémoire, un veilleur qui écoute POUR DE
 * VRAI sur le socket que la commande ira chercher, et de quoi la lancer.
 */
async function avecPoste({ lignes, canaux, panes = ['w1:p1'] }, corps) {
  sauverRegistre({ version: 1, lignes, commun: null });
  const monde = fauxSlack({ canaux, utilisateurs: [{ id: 'UCLIENT', name: 'jean', profile: {} }] }).installer();
  const travail = agentsQuiTravaillent({ panes });
  const v = new Veilleur({
    cheminSocket: join(racine, 'veilleur.sock'),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    herdr: travail,
  });
  await v.ecouterLocal();
  /** Lance la VRAIE commande, depuis le pane demandé. */
  const ld = async (args, pane = 'w1:p1') => {
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
    return await corps({ monde, ld, veilleur: v, travail });
  } finally {
    await v.arreter();
    monde.restaurer();
  }
}

/** Les canaux touchés par un message, dans l'ordre — la preuve, et rien d'autre. */
const canauxTouches = (monde) => monde.postes.map((p) => p.channel);

/** Le pane porte les DEUX lignes — la configuration que ce lot ouvre. */
const DEUX_LIGNES = [
  ligne({ chantier: 'acme', canalId: 'C_acme', canalNom: 'acme', nature: 'client', libelle: 'Acme' }),
  ligne({ chantier: 'dirigeant', canalId: 'C_dir', canalNom: 'ligne-dirigeant' }),
];

// ═════════════════ 1. DEUX LIGNES SUR UN PANE, CHACUNE ATTEIGNABLE

test('DEUX LIGNES, DEUX CANAUX — chaque geste nommé atteint SA ligne, pas la première inscrite', async () => {
  await avecPoste({ lignes: DEUX_LIGNES, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ monde, ld }) => {
    // On vise d'abord la SECONDE inscrite, exprès : c'est celle que l'ancien `.find()` ne
    // pouvait pas atteindre. Sous le code d'avant, ce message partait chez le client.
    const r1 = await ld(['dire', 'le devis part demain', '--a', 'dirigeant']);
    assert.equal(r1.code, 0, r1.stderr);
    const r2 = await ld(['dire', 'bonjour, c’est noté', '--a', 'acme']);
    assert.equal(r2.code, 0, r2.stderr);

    assert.deepEqual(canauxTouches(monde), ['C_dir', 'C_acme'], 'chaque message part dans le canal de SA ligne');
    // Et le message est bien le texte de l'agent — pas le nom de la ligne pris pour lui.
    assert.equal(monde.postes[0].text, 'le devis part demain');
    assert.equal(monde.postes[1].text, 'bonjour, c’est noté');
  });
});

test('`demander` passe par la même sélection — l’arbitrage arrive chez qui doit trancher', async () => {
  await avecPoste({ lignes: DEUX_LIGNES, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ monde, ld }) => {
    const r = await ld(['demander', 'je fais quoi ?', '--a', 'dirigeant']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(canauxTouches(monde), ['C_dir']);
  });
});

test('LE CANAL SE NOMME AUSSI — `--a` accepte le nom du canal, accents et casse aplatis', async () => {
  await avecPoste({ lignes: DEUX_LIGNES, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ monde, ld }) => {
    const r = await ld(['dire', 'un jalon', '--a', 'Ligne-Dirigeant']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(canauxTouches(monde), ['C_dir']);
  });
});

// ═════════════════ 2. LE REFUS SANS NOM — prouvé par l'ABSENCE

test('SANS NOM, AVEC DEUX LIGNES : rien ne part — ni dans un canal, ni dans l’autre', async () => {
  await avecPoste({ lignes: DEUX_LIGNES, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ monde, ld }) => {
    const r = await ld(['dire', 'un rapport qui ne doit aller nulle part']);
    assert.equal(r.code, 1, 'le geste est refusé');
    assert.deepEqual(canauxTouches(monde), [], 'AUCUN canal touché — c’est ça, la preuve du refus');
  });
});

test('UN NOM QUI NE DÉSIGNE RIEN EST UN REFUS, même quand il n’y a qu’une seule ligne', async () => {
  // Sinon `--a` serait décoratif : un agent qui se trompe de nom se trompe de destinataire, et
  // se rabattre sur l'unique ligne présente lui donnerait raison en silence.
  await avecPoste(
    { lignes: [ligne({ chantier: 'acme', canalId: 'C_acme', canalNom: 'acme', nature: 'client' })], canaux: [CLIENT] },
    async ({ monde, ld }) => {
      const r = await ld(['dire', 'interne — jamais chez le client', '--a', 'dirigeant']);
      assert.equal(r.code, 1);
      assert.deepEqual(canauxTouches(monde), [], 'rien n’est parti chez le client');
    }
  );
});

// ═════════════════ 3. LA RÉTROCOMPATIBILITÉ — une seule ligne n'exige aucun nom

test('UNE SEULE LIGNE, APPEL SANS NOM : le message arrive — rien de ce qui tourne ne casse', async () => {
  await avecPoste(
    { lignes: [ligne({ chantier: 'd-1', canalId: 'C_dir', canalNom: 'ligne-dirigeant' })], canaux: [DIRIGEANT_CANAL] },
    async ({ monde, ld }) => {
      const r = await ld(['dire', 'jalon franchi']);
      assert.equal(r.code, 0, r.stderr);
      assert.deepEqual(canauxTouches(monde), ['C_dir']);
    }
  );
});

// ═════════════════ 4. LES DEUX AUTRES GESTES — `fermer` et `renommer`, mêmes preuves

test('FERMER NOMMÉ — le bilan et l’archivage tombent sur la ligne visée, l’autre est intacte', async () => {
  const deuxInternes = [
    ligne({ chantier: 'd-1', canalId: 'C_acme', canalNom: 'acme' }),
    ligne({ chantier: 'd-2', canalId: 'C_dir', canalNom: 'ligne-dirigeant' }),
  ];
  await avecPoste({ lignes: deuxInternes, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ monde, ld }) => {
    const r = await ld(['fermer', '--bilan', 'chantier terminé', '--a', 'd-2']);
    assert.equal(r.code, 0, r.stderr);

    assert.deepEqual(canauxTouches(monde), ['C_dir'], 'le bilan part dans le canal de la ligne visée');
    assert.equal(monde.canalNomme('ligne-dirigeant').is_archived, true, 'et c’est CE canal qui est archivé');
    assert.equal(monde.canalNomme('acme').is_archived, false, 'l’autre canal n’est pas touché');

    const apres = chargerRegistre();
    assert.equal(apres.lignes.find((l) => l.chantier === 'd-2').close_le != null, true, 'la ligne visée est close');
    assert.equal(apres.lignes.find((l) => l.chantier === 'd-1').close_le, null, 'l’autre reste ouverte');
  });
});

test('FERMER SANS NOM, AVEC DEUX LIGNES : aucun bilan posté, aucun canal archivé, aucune ligne close', async () => {
  // C'est le geste le plus coûteux des trois : il POSTE puis il ARCHIVE. Se tromper de ligne
  // ici, c'est laisser un bilan chez le mauvais interlocuteur ET fermer un lieu vivant.
  await avecPoste({ lignes: DEUX_LIGNES, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ monde, ld }) => {
    const r = await ld(['fermer', '--bilan', 'un bilan qui ne doit aller nulle part']);
    assert.equal(r.code, 1);
    assert.deepEqual(canauxTouches(monde), []);
    assert.equal(monde.canalNomme('acme').is_archived, false);
    assert.equal(monde.canalNomme('ligne-dirigeant').is_archived, false);
    assert.deepEqual(
      chargerRegistre().lignes.map((l) => l.close_le),
      [null, null],
      'les deux lignes restent ouvertes'
    );
  });
});

test('RENOMMER NOMMÉ — seul le canal visé change de nom', async () => {
  await avecPoste({ lignes: DEUX_LIGNES, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ monde, ld }) => {
    const r = await ld(['renommer', '--titre', 'Arbitrages du dirigeant', '--a', 'dirigeant']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(monde.canaux.find((c) => c.id === 'C_dir').name, 'arbitrages-du-dirigeant');
    assert.equal(monde.canaux.find((c) => c.id === 'C_acme').name, 'acme', 'le canal du client garde son nom');
  });
});

test('RENOMMER SANS NOM, AVEC DEUX LIGNES : aucun canal renommé', async () => {
  await avecPoste({ lignes: DEUX_LIGNES, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ monde, ld }) => {
    const r = await ld(['renommer', '--titre', 'Peu importe']);
    assert.equal(r.code, 1);
    assert.deepEqual(
      monde.canaux.map((c) => c.name),
      ['acme', 'ligne-dirigeant'],
      'les deux canaux gardent leur nom'
    );
  });
});

test('UNE LIGNE DÉJÀ CLOSE NE SE REFERME PAS DEUX FOIS — le bilan ne part pas dans un canal archivé', async () => {
  // La contrepartie du routage PAR CANAL : `ligneParCanal` retombe volontairement sur la
  // ligne close, pour pouvoir répondre « c'est clos » à qui écrit. Sans garde, `fermer`
  // aurait posté son bilan dans un canal en lecture seule — perdu, sans un mot — puis rejoué
  // l'archivage. On l'éprouve sur le veilleur : la commande ne propose que des lignes
  // ouvertes, mais rien n'empêche une ligne de se clore entre l'état et le geste.
  const close = ligne({ chantier: 'd-2', canalId: 'C_dir', canalNom: 'ligne-dirigeant' });
  close.close_le = '2026-08-13T00:00:00.000Z';
  await avecPoste({ lignes: [close], canaux: [DIRIGEANT_CANAL] }, async ({ monde, veilleur }) => {
    const r = await veilleur.fermer({ canal_id: 'C_dir', bilan: 'un bilan qui arrive trop tard' });
    assert.equal(r.ok, false);
    assert.deepEqual(canauxTouches(monde), [], 'aucun bilan posté');
    assert.equal(monde.canalNomme('ligne-dirigeant').is_archived, false, 'aucun archivage rejoué');
  });
});

// ═════════════════ 5. L'ENTRANT RESTE INTACT — il route déjà par une clé unique

test('ENTRANT — un message sur chaque ligne arrive au bon pane, avec le cadre de SA ligne', async () => {
  await avecPoste({ lignes: DEUX_LIGNES, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ veilleur, travail }) => {
    await veilleur.remettreAuChantier({ channel: 'C_acme', user: 'UCLIENT', text: 'une question' });
    const duClient = readFileSync(travail.fichier('w1:p1'), 'utf8');
    assert.match(duClient, /^\[LIGNE DIRECTE — acme \(#acme\)\]/, `cadre reçu : ${duClient.split('\n')[0]}`);
    assert.match(duClient, /du client/, 'et c’est bien une parole DU CLIENT');

    await veilleur.remettreAuChantier({ channel: 'C_dir', user: UDIR, text: 'tranche ça' });
    const duDirigeant = readFileSync(travail.fichier('w1:p1'), 'utf8');
    assert.match(duDirigeant, /^\[LIGNE DIRECTE — dirigeant \(#ligne-dirigeant\)\]/, duDirigeant.split('\n')[0]);
    assert.doesNotMatch(duDirigeant, /du client/, 'la seconde ligne n’emprunte pas le cadre de la première');
  });
});

// ═════════════════ 6. LA LECTURE DE LA LIGNE DE COMMANDE

test('`--a` NE MANGE PAS LE MESSAGE — placé avant le texte, il reste une option', async () => {
  // `--a` non déclaré comme option à valeur aurait fait prendre « dirigeant » pour le texte :
  // le mot « dirigeant » posté à la place du rapport, et le rapport perdu.
  await avecPoste({ lignes: DEUX_LIGNES, canaux: [CLIENT, DIRIGEANT_CANAL] }, async ({ monde, ld }) => {
    const r = await ld(['dire', '--a', 'dirigeant', 'le vrai texte']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(canauxTouches(monde), ['C_dir']);
    assert.equal(monde.postes[0].text, 'le vrai texte');
  });
});

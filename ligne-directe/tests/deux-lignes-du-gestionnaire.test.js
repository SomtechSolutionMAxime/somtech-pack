// LES DEUX LIGNES DU GESTIONNAIRE — celle de son client, celle du dirigeant (T-20260813-0076).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER GARDE
//
// Un gestionnaire client n'avait qu'une ligne — celle de son client — alors que quatre
// obligations livrées de son métier lui imposent de REMONTER : ce qui engage Somtech (prix,
// délai, faisabilité), toute situation problématique AVANT d'en parler au client, une question
// qu'il ne peut pas trancher, et son topo du matin. Il était tenu de faire une chose qu'il
// n'avait pas le moyen de faire.
//
// ⚠️ LE MODE DE PANNE UNIQUE DE CE LOT, ET IL EST IRRATTRAPABLE : un message destiné au
// dirigeant qui part chez le client. Ce qui transite sur cette ligne est PRÉCISÉMENT ce qu'on
// ne dit pas au client — « ce problème n'est pas encore dit », « il demande un prix ». Une
// inversion n'envoie donc pas un message au mauvais endroit : elle révèle au client la chose
// exacte qu'on lui cachait.
//
// LA PREUVE EST LE CANAL TOUCHÉ, JAMAIS LE TEXTE D'UN MESSAGE, et les refus se prouvent par
// l'ABSENCE — zéro message, zéro canal créé. Le motif dominant de ce dépôt vise ce lot
// nommément : « un test qui cherche un mot ne prouve rien », neuf occurrences. Et le piège
// spécifique : un test qui réécrirait le filtre de sélection ne prouverait que son accord avec
// lui-même — on appelle donc la VRAIE commande, en processus séparé, contre un VRAI veilleur.
//
// ⚠️ LA CLOISON D'ESSAIS N'EST PAS CONTOURNÉE (RA-REL-012) : le transport (`globalThis.fetch`)
// est remplacé par le double de `tests/aide/faux-slack.js`, la commande lancée ne voit qu'un
// `LIGNE_DIRECTE_RACINE` jetable et un faux `herdr`, et AUCUN essai ne lit le trousseau du
// poste. Des essais ont déjà fait naître deux veilleurs vers l'espace de PRODUCTION et
// détourné deux messages du dirigeant sur trois ; ça ne se recommence pas.

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fauxSlack } from './aide/faux-slack.js';

const execFileAsync = promisify(execFile);
const ICI = dirname(fileURLToPath(import.meta.url));
const CLI = join(ICI, '..', 'bin', 'ligne-directe.js');
const REPO = join(ICI, '..', '..');

let Veilleur, sauverRegistre, chargerRegistre;
let preparerLieuRepresentant, verifierLignesDuRepresentant;
let racine;
let binFaux;
let compteur = 0;

const UDIR = 'UDIR';
const UCLIENT = 'UCLIENT';
const PANE = 'w1:p1';

/** Le canal privé du client — il EXISTE déjà, un humain y a invité notre robot. */
const CANAL_CLIENT = { id: 'C_acme', name: 'espace-acme', is_private: true, membres: ['UMOI', UCLIENT] };

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-deux-lignes-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre } = await import('../src/registre.js'));
  ({ preparerLieuRepresentant, verifierLignesDuRepresentant } = await import('../src/representant.js'));

  // Un faux `herdr` : c'est lui qui décide du pane courant. Sans ce double, la commande
  // s'arrête avant toute sélection et l'essai ne prouverait rien du chemin qu'il éprouve.
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

beforeEach(() => sauverRegistre({ version: 1, lignes: [], commun: null, dirigeant: null }));

/** Des agents qui TRAVAILLENT : recevoir a un effet sur le disque, et c'est l'effet qu'on lit. */
function agentsQuiTravaillent({ panes = [PANE] } = {}) {
  const dossier = join(racine, `travail-${(compteur += 1)}`);
  mkdirSync(dossier, { recursive: true });
  return {
    fichier: (pane) => join(dossier, `${pane.replace(/[^a-z0-9]/gi, '_')}.txt`),
    recu: [],
    async vivant(pane) {
      return panes.includes(pane);
    },
    async remettre(pane, texte) {
      this.recu.push({ pane, texte });
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
 *
 * `dirigeantDesigne` est posé AU REGISTRE plutôt que par la commande `dirigeant` : celle-ci
 * résout un courriel en interrogeant Slack avec le jeton du POSTE, et la cloison interdit
 * qu'un essai approche le vrai trousseau. Ce que ces essais éprouvent est ce qui vient APRÈS —
 * l'ouverture, le routage, la remise — et cette partie-là est celle qui peut inverser un canal.
 */
async function avecPoste({ canaux, dirigeantDesigne = { id: UDIR, courriel: 'dirigeant@somtech.ca' } }, corps) {
  sauverRegistre({ version: 1, lignes: [], commun: null, dirigeant: dirigeantDesigne });
  const monde = fauxSlack({
    canaux,
    utilisateurs: [
      { id: UCLIENT, name: 'jean', profile: { real_name: 'Jean Tremblay', email: 'jean@acme.ca' } },
      { id: UDIR, name: 'maxime', profile: { real_name: 'Maxime', email: 'dirigeant@somtech.ca' } },
    ],
  }).installer();
  const travail = agentsQuiTravaillent();
  const v = new Veilleur({
    cheminSocket: join(racine, 'veilleur.sock'),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    herdr: travail,
  });
  await v.ecouterLocal();
  /** Lance la VRAIE commande, depuis le pane du gestionnaire. */
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
    return await corps({ monde, ld, veilleur: v, travail });
  } finally {
    await v.arreter();
    monde.restaurer();
  }
}

/**
 * L'identifiant du canal du dirigeant, RELU DANS L'ESPACE — jamais écrit en dur ici.
 *
 * Le nom du canal vient du titre donné à l'ouverture, et son identifiant, du service. Les
 * inscrire à la main dans l'essai aurait fait de lui son propre témoin : il aurait continué à
 * passer si la commande avait cessé de créer ce canal-là.
 */
function idDirigeant(monde) {
  const canal = monde.canalNomme('ligne-dirigeant-acme');
  assert.ok(canal, 'le canal du dirigeant doit exister avant qu’on puisse parler de ce qui y arrive');
  return canal.id;
}

/** Ouvre les DEUX lignes du gestionnaire, par la vraie commande. Rend les deux réponses. */
async function ouvrirLesDeuxLignes(ld) {
  const client = await ld(['ouvrir', 'acme', '--nature', 'client', '--titre', 'Espace Acme']);
  const dirigeant = await ld(['ouvrir', 'dirigeant', '--titre', 'ligne dirigeant acme', '--au-dirigeant']);
  return { client, dirigeant };
}

// ═════════════════ 1. LES DEUX LIGNES COEXISTENT — deux canaux distincts, côté Slack

test('UN GESTIONNAIRE RÉEL A DEUX CANAUX DISTINCTS — et ce n’est pas le registre qui le dit, c’est Slack', async () => {
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, ld }) => {
    const r = await ouvrirLesDeuxLignes(ld);
    assert.equal(r.client.code, 0, r.client.stderr);
    assert.equal(r.dirigeant.code, 0, r.dirigeant.stderr);

    // LA PREUVE EST DANS L'ESPACE, pas dans la réponse de la commande : deux canaux existent,
    // ils portent deux identifiants différents, et leur confidentialité n'est pas la même.
    const chezLeClient = monde.canalNomme('espace-acme');
    const chezLeDirigeant = monde.canalNomme('ligne-dirigeant-acme');
    assert.ok(chezLeClient, 'le canal du client doit être là — c’est celui qui préexistait');
    assert.ok(chezLeDirigeant, 'le canal du dirigeant doit avoir été CRÉÉ à la naissance');
    assert.notEqual(chezLeClient.id, chezLeDirigeant.id, 'deux lignes, deux canaux — jamais le même');
    assert.equal(chezLeClient.is_private, true, 'celui du client est privé : le client y parle');
    assert.equal(chezLeDirigeant.is_private, false, 'celui du dirigeant est interne : public, entre nous');
  });
});

test('LE DIRIGEANT Y EST AUTORISÉ À ÉCRIRE — sans invité, la ligne existerait et refuserait sa parole', async () => {
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, ld }) => {
    await ouvrirLesDeuxLignes(ld);

    // Une ligne INTERNE autorise par LISTE. Le fait qu'on lit est donc double : Slack l'a
    // invité (l'appartenance au canal), et le registre le porte comme autorisé (le droit de
    // piloter l'agent). L'un sans l'autre laisse une ligne muette ou une ligne ouverte à tous.
    const chezLeDirigeant = monde.canalNomme('ligne-dirigeant-acme');
    assert.ok(chezLeDirigeant.membres.includes(UDIR), 'Slack l’a bien invité dans son canal');

    const ligne = chargerRegistre().lignes.find((l) => l.chantier === 'dirigeant');
    assert.deepEqual(ligne.autorises, [UDIR], 'et il est le SEUL autorisé — personne d’autre ne pilote cet agent');
  });
});

test('SANS DIRIGEANT DÉSIGNÉ SUR LE POSTE, LA LIGNE N’EST PAS OUVERTE — et AUCUN canal n’est créé', async () => {
  // Le refus tombe AVANT toute création, et c'est ce que prouve l'absence du canal. Ouvrir
  // puis refuser aurait laissé dans la barre latérale du dirigeant un canal muet qui a l'air
  // d'une ligne — Slack ne reprend pas un canal créé, et personne n'irait le chercher.
  await avecPoste({ canaux: [CANAL_CLIENT], dirigeantDesigne: null }, async ({ monde, ld }) => {
    const r = await ld(['ouvrir', 'dirigeant', '--titre', 'ligne dirigeant acme', '--au-dirigeant']);
    assert.equal(r.code, 1, 'le geste est refusé');
    assert.equal(monde.canalNomme('ligne-dirigeant-acme'), null, 'AUCUN canal créé — c’est ça, la preuve');
    assert.deepEqual(chargerRegistre().lignes, [], 'et rien n’est inscrit au registre');

    // ⚠️ C'EST UN REFUS, PAS UNE CHUTE, et la distinction se mesure : le veilleur sert encore.
    // Une mutation posée sur ce lot l'a montré — retirer le contrôle faisait lever une
    // exception dans le geste, et l'absence de canal restait vraie POUR LA MAUVAISE RAISON.
    // Un essai qui ne regarde que l'absence ne sait pas départager les deux ; celui-ci si.
    const apres = await ld(['ouvrir', 'acme', '--nature', 'client', '--titre', 'Espace Acme']);
    assert.equal(apres.code, 0, `le veilleur doit avoir survécu à son propre refus : ${apres.stderr}`);
  });
});

test('UN GESTIONNAIRE RELANCÉ RETROUVE SES DEUX LIGNES — sans créer un second canal', async () => {
  // Le cycle NOMINAL : une session tombe, on la refait naître dans le même worktree, sur un
  // pane NEUF. `ouvrir` reprend alors la ligne existante et rafraîchit son pane. Créer un
  // second canal à la place aurait laissé le dirigeant écrire dans l'ancien — muet — pendant
  // que l'agent écoute le nouveau. Personne ne s'en apercevrait avant d'en avoir besoin.
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, ld }) => {
    await ouvrirLesDeuxLignes(ld);
    const canauxApresLaPremiere = monde.canaux.length;

    const r = await ld(['ouvrir', 'dirigeant', '--titre', 'ligne dirigeant acme', '--au-dirigeant'], 'w1:p9');
    assert.equal(r.code, 0, r.stderr);

    assert.equal(monde.canaux.length, canauxApresLaPremiere, 'AUCUN second canal — la ligne est reprise, pas refaite');
    const ligne = chargerRegistre().lignes.filter((l) => l.chantier === 'dirigeant');
    assert.equal(ligne.length, 1, 'une seule ligne au registre, pas deux');
    assert.equal(ligne[0].pane, 'w1:p9', 'et c’est le pane NEUF qui l’écoute désormais');
    assert.deepEqual(ligne[0].autorises, [UDIR], 'le dirigeant reste autorisé — la reprise ne le perd pas');
  });
});

// ═════════════════ 2. AUCUNE INVERSION — prouvée par l'ABSENCE, dans les deux sens

test('CE QUI VA AU DIRIGEANT EST ABSENT DU CANAL DU CLIENT — le mode de panne unique de ce lot', async () => {
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, ld }) => {
    await ouvrirLesDeuxLignes(ld);
    const avant = monde.postes.length; // le message d'ouverture de chaque ligne, s'il y en a un

    const r = await ld(['dire', 'il demande un prix, et ce problème n’est pas encore dit', '--a', 'dirigeant']);
    assert.equal(r.code, 0, r.stderr);

    const depuis = monde.postes.slice(avant);
    assert.deepEqual(
      depuis.map((p) => p.channel),
      [idDirigeant(monde)],
      'un seul canal touché, et c’est celui du dirigeant'
    );
    // ET LA RÉCIPROQUE EXPLICITE : rien de ce texte n'est jamais passé chez le client. C'est
    // la formulation par l'ABSENCE, la seule qui prouve un cloisonnement.
    const chezLeClient = monde.postes.filter((p) => p.channel === CANAL_CLIENT.id);
    assert.equal(chezLeClient.length, 0, 'RIEN n’est parti chez le client — ni ce message, ni un autre');
  });
});

test('ET RÉCIPROQUEMENT — ce qui va au client est absent du canal du dirigeant', async () => {
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, ld }) => {
    await ouvrirLesDeuxLignes(ld);
    const avant = monde.postes.length;

    const r = await ld(['dire', 'bonjour, c’est bien noté', '--a', 'acme']);
    assert.equal(r.code, 0, r.stderr);

    const depuis = monde.postes.slice(avant);
    assert.deepEqual(depuis.map((p) => p.channel), [CANAL_CLIENT.id], 'un seul canal touché, et c’est celui du client');
    assert.equal(
      depuis.filter((p) => p.channel === idDirigeant(monde)).length,
      0,
      'rien n’est monté chez le dirigeant par ce geste'
    );
  });
});

test('SANS NOM, RIEN NE PART — la garde de T-20260813-0078 tient sur la configuration réelle du gestionnaire', async () => {
  // C'est ici qu'elle sert vraiment : deux lignes sur un même pane, c'était son cas d'école,
  // c'est désormais la naissance NOMINALE d'un gestionnaire. Un `dire` sans destinataire ne
  // doit donc jamais retomber sur « la première inscrite » — qui est celle du client.
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, ld }) => {
    await ouvrirLesDeuxLignes(ld);
    const avant = monde.postes.length;

    const r = await ld(['dire', 'un rapport qui ne doit aller nulle part']);
    assert.equal(r.code, 1, 'le geste est refusé');
    assert.deepEqual(monde.postes.slice(avant), [], 'AUCUN canal touché — ni celui du client, ni celui du dirigeant');
  });
});

test('`demander` NE DESCEND JAMAIS CHEZ LE CLIENT — un arbitrage nommé pour le dirigeant y va, et n’y va que là', async () => {
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, ld }) => {
    await ouvrirLesDeuxLignes(ld);
    const avant = monde.postes.length;

    const r = await ld(['demander', 'je m’engage sur ce délai ou pas ?', '--a', 'dirigeant']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(monde.postes.slice(avant).map((p) => p.channel), [idDirigeant(monde)]);
  });
});

// ═════════════════ 3. LE DIRIGEANT INITIE — il écrit le premier, l'agent le reçoit

test('LE DIRIGEANT OUVRE LA PAROLE — il écrit sans que l’agent ait rien dit, et ça arrive dans son pane', async () => {
  // « Je veux initier » — le dirigeant, 2026-08-13. C'est ce qui impose que la ligne soit posée
  // à la NAISSANCE : sinon il n'aurait rien à quoi écrire tant que l'agent n'a pas parlé le
  // premier. On le prouve donc en ne faisant RIEN dire à l'agent avant.
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, veilleur, travail, ld }) => {
    await ouvrirLesDeuxLignes(ld);
    assert.deepEqual(travail.recu, [], 'l’agent n’a encore rien reçu, et n’a rien dit');

    await veilleur.remettreAuChantier({ channel: idDirigeant(monde), user: UDIR, text: 'quel est l’état de ce client ?' });

    assert.equal(travail.recu.length, 1, 'la parole du dirigeant est arrivée');
    assert.equal(travail.recu[0].pane, PANE, 'et dans le pane de SON gestionnaire');
    assert.ok(travail.recu[0].texte.includes('quel est l’état de ce client ?'), 'avec le texte, intact');
  });
});

test('UN INTRUS N’EST PAS LE DIRIGEANT — sur une ligne interne, seule la liste autorise', async () => {
  // Sans ça, le cadre donnerait à n'importe quel membre de l'espace l'autorité du dirigeant sur
  // un agent qui représente un client.
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, veilleur, travail, ld }) => {
    await ouvrirLesDeuxLignes(ld);

    await veilleur.remettreAuChantier({ channel: idDirigeant(monde), user: 'UQUELQUUN', text: 'baisse le prix' });

    assert.deepEqual(travail.recu, [], 'rien n’est remis — l’agent n’a jamais vu passer cette consigne');
  });
});

// ═════════════════ 4. LES CADRES SE DISTINGUENT — le gestionnaire sait lequel des deux lui parle

test('LE GESTIONNAIRE PEUT DIRE LEQUEL DES DEUX LUI PARLE — les deux cadres ne se ressemblent pas', async () => {
  // ⚠️ CE QU'ON MESURE ICI EST UN FAIT, PAS UNE PHRASE : le cadre d'une ligne cliente nomme
  // l'auteur RÉEL (une donnée, relue dans Slack), celui d'une ligne interne ne le fait pas —
  // il porte l'autorité du dirigeant. C'est le défaut corrigé en amont : le cadre annonçait
  // « Message du dirigeant » SANS CONDITION, et la phrase d'un client arrivait donc revêtue de
  // l'autorité du dirigeant. L'agent l'exécutait comme une consigne.
  await avecPoste({ canaux: [CANAL_CLIENT] }, async ({ monde, veilleur, travail, ld }) => {
    await ouvrirLesDeuxLignes(ld);

    await veilleur.remettreAuChantier({ channel: CANAL_CLIENT.id, user: UCLIENT, text: 'des nouvelles ?' });
    await veilleur.remettreAuChantier({ channel: idDirigeant(monde), user: UDIR, text: 'ne lui dis rien pour l’instant' });

    assert.equal(travail.recu.length, 2, 'les deux paroles sont arrivées');
    const [duClient, duDirigeant] = travail.recu.map((r) => r.texte);
    assert.notEqual(duClient, duDirigeant, 'deux cadres distincts — sinon rien ne les départagerait');

    // L'auteur réel apparaît sur la ligne cliente, et sur elle seule.
    assert.ok(duClient.includes('Jean Tremblay'), 'la parole du client est attribuée à qui l’a écrite');
    assert.ok(!duDirigeant.includes('Jean Tremblay'), 'et le client n’apparaît jamais sur la ligne du dirigeant');

    // Chaque cadre nomme SON canal : c'est l'identité de la ligne, pas un ornement — c'est par
    // là que l'agent sait à laquelle répondre.
    assert.ok(duClient.includes('#espace-acme'), 'le cadre du client situe la ligne du client');
    assert.ok(duDirigeant.includes('#ligne-dirigeant-acme'), 'celui du dirigeant situe la sienne');
    assert.ok(!duClient.includes('#ligne-dirigeant-acme'), 'et jamais l’un pour l’autre');
  });
});

// ═════════════════ 5. LA POSE RESTE ATOMIQUE — rien sur disque quand elle refuse

/** Un dépôt client jetable, qui a reçu les gabarits du pack. */
function depotClientJetable() {
  const depot = mkdtempSync(join(racine, 'depot-'));
  mkdirSync(join(depot, '.claude', 'templates'), { recursive: true });
  const source = join(REPO, '.claude', 'templates', 'gestionnaire-client');
  const cible = join(depot, '.claude', 'templates', 'gestionnaire-client');
  mkdirSync(join(cible, '.claude'), { recursive: true });
  for (const f of ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json', join('.claude', 'settings.json')]) {
    writeFileSync(join(cible, f), readFileSync(join(source, f)));
  }
  return depot;
}

test('UN DIRIGEANT INCONNU DE L’ESPACE REFUSE LA POSE — et rien n’est créé sur le disque', async () => {
  // Un courriel qui ne désigne personne ne se rattrape pas plus tard : la ligne s'ouvrirait sans
  // aucun autorisé, donc refuserait la parole à tout le monde — au dirigeant le premier — en
  // ayant l'air ouverte. Le refus doit donc tomber AVANT le premier fichier.
  const depot = depotClientJetable();
  const r = await preparerLieuRepresentant({
    depotClient: depot,
    client: 'acme',
    canal: 'espace-acme',
    verifierJoignabilite: () =>
      verifierLignesDuRepresentant({
        canal: 'espace-acme',
        courrielDirigeant: 'inconnu@nulle-part.invalid',
        lireJetonRobot: async () => 'valeur-de-test',
        verifierPoste: async () => ({ joignable: true }),
        verifier: async () => ({ joignable: true, canal: 'espace-acme', id: 'C_acme' }),
        chercherMembre: async () => null, // l'espace ne connaît personne à cette adresse
      }),
  });

  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'dirigeant_inconnu');
  assert.equal(r.refus.portee, 'dirigeant', 'la portée dit DE QUOI on parle — ni du canal, ni du trousseau');
  assert.equal(existsSync(join(depot, '.gestionnaire')), false, 'RIEN sur le disque — c’est ça, la preuve');
});

test('UN REFUS DU DIRIGEANT N’EST PAS RÉÉCRIT EN CONSEIL DE CANAL — il enverrait chercher au mauvais endroit', async () => {
  // « Une porte sur deux », par la porte qu'on n'avait pas encore ouverte : la pose listait les
  // portées à laisser passer (`=== 'poste'`), donc toute portée AJOUTÉE ensuite retombait par
  // défaut du côté qui réécrit — et un courriel mal orthographié aurait fait chercher une
  // invitation Slack dans un canal qui va parfaitement bien.
  const depot = depotClientJetable();
  const r = await preparerLieuRepresentant({
    depotClient: depot,
    client: 'acme',
    canal: 'espace-acme',
    verifierJoignabilite: async () => ({
      joignable: false,
      portee: 'dirigeant',
      motif: 'dirigeant_inconnu',
      message: 'MESSAGE DU DIRIGEANT, INTACT',
    }),
  });

  assert.equal(r.refus.message, 'MESSAGE DU DIRIGEANT, INTACT', 'le message d’origine n’est pas traduit en autre chose');
  assert.equal(existsSync(join(depot, '.gestionnaire')), false);
});

test('LE POSTE EST ÉPROUVÉ AVANT LE CANAL — un trousseau muet ne s’annonce jamais comme un canal injoignable', async () => {
  // T-20260813-0054, dans l'autre sens : un refus qui parle du canal alors que le trousseau est
  // verrouillé envoie faire inviter un robot déjà invité. L'ordre est donc éprouvé, pas supposé.
  let canalInterroge = false;
  const verdict = await verifierLignesDuRepresentant({
    canal: 'espace-acme',
    courrielDirigeant: 'dirigeant@somtech.ca',
    verifierPoste: async () => ({ joignable: false, motif: 'jeton_absent', message: 'le trousseau ne rend rien' }),
    lireJetonRobot: async () => {
      canalInterroge = true;
      return 'valeur-de-test';
    },
    verifier: async () => {
      canalInterroge = true;
      return { joignable: true };
    },
    chercherMembre: async () => 'UDIR',
  });

  assert.equal(verdict.joignable, false);
  assert.equal(verdict.portee, 'poste');
  assert.equal(canalInterroge, false, 'le canal n’a même pas été consulté — le refus ne peut donc pas parler de lui');
});

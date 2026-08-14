// LA LIGNE D'UN CHANTIER PORTE DEUX AGENTS — l'orchestrateur et son gestionnaire client
// (T-20260814-0093, cadrage D-20260805-0005 §D5).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER GARDE, ET DANS QUEL ORDRE
//
// Le manque tenait en une phrase : le gestionnaire faisait faire, et rien ne revenait. Le
// dirigeant a tranché le sens le 2026-08-14 — « c'est une équipe » : ce n'est pas un canal de
// compte rendu, c'est une conversation de travail entre pairs, dans les DEUX sens. Le
// gestionnaire signale ce qu'il a ouvert, demande une échéance, relance ; l'orchestrateur
// répond, dit où il en est, dit ce qui bloque — et reste maître de son chantier.
//
// DEUX PREUVES COMMANDENT TOUTES LES AUTRES, et ce sont celles que le dirigeant regarde :
//
//   1. **RIEN NE FUIT DANS LE CANAL DU CLIENT.** Prouvée par l'ABSENCE, côté Slack : le canal
//      privé du client ne reçoit RIEN de ce qui transite entre les deux agents, et le pane du
//      gestionnaire ne peut pas se tromper de ligne en répondant. C'est le mode de panne qui a
//      coûté le routage nommé, et il redevient possible dès qu'un agent porte une ligne de plus.
//   2. **UN ORCHESTRATEUR SANS GESTIONNAIRE EST INCHANGÉ.** Le cas nominal d'aujourd'hui — la
//      totalité des chantiers en cours. Il se prouve par ce que le registre NE porte pas et par
//      les remises qui N'ONT PAS eu lieu.
//
// ⚠️ LA PREUVE EST LE CANAL TOUCHÉ ET LE FICHIER ÉCRIT, JAMAIS LE TEXTE D'UN REFUS. Ce dépôt a
// dix occurrences du même défaut — un test qui cherche un mot ne prouve rien. Chaque test lit
// `monde.postes` (ce que le faux Slack a VRAIMENT reçu) ou le fichier qu'un agent a reçu.
//
// ⚠️ ET C'EST LA VRAIE COMMANDE QUI EST LANCÉE, contre un VRAI veilleur : argv → sélection →
// socket → veilleur → Slack → remise. Rejouer la sélection ici prouverait seulement que le test
// est d'accord avec lui-même — le piège nommé pour ce lot.
//
// ⚠️ LA CLOISON D'ESSAIS N'EST PAS CONTOURNÉE : `globalThis.fetch` est remplacé par le double,
// la racine est jetable, `herdr` est un faux binaire. Rien ne part vers slack.com.

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

let Veilleur, sauverRegistre, chargerRegistre;
let racine;
let binFaux;
let compteur = 0;

// Les panes, nommés une fois — un pane confondu avec un autre est exactement le défaut que ce
// lot pourrait réintroduire, et le lire en clair dans chaque assertion évite de le maquiller.
const PANE_ORCHESTRATEUR = 'w1:p1';
const PANE_GESTIONNAIRE = 'w9:pG';
const NOM_GESTIONNAIRE = 'acme-gestionnaire';

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-pair-'));
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
      `  process.stdout.write(JSON.stringify({ result: { pane: { pane_id: process.env.FAUX_PANE, foreground_cwd: process.env.FAUX_CWD || '/w' } } }));\n` +
      `} else {\n` +
      `  process.stdout.write(JSON.stringify({ error: { code: 'unsupported', message: a } }));\n` +
      `}\n`
  );
  chmodSync(faux, 0o755);
});

after(() => rmSync(racine, { recursive: true, force: true }));

beforeEach(() => sauverRegistre({ version: 1, lignes: [], communs: {}, commun: null, dirigeant: null }));

/**
 * UN VRAI LIEU D'AGENT SUR DISQUE — parce que le rôle d'un pair s'établit par le FAIT.
 *
 * `resoudrePair` refuse quiconque n'est pas un représentant, et il le lit par `roleDuLieu` :
 * les quatre fichiers de la pose ET les en-têtes réels du métier. Un double qui rendrait « rôle
 * representant » sur parole aurait prouvé que le test est d'accord avec lui-même — et laissé
 * passer le jour où l'un des deux en-têtes change.
 */
function poserLieu(nom, entetes) {
  const lieu = join(racine, `lieu-${nom}`);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), `${entetes.claude}\n\nle métier.\n`);
  writeFileSync(join(lieu, 'CONTEXTE.md'), `${entetes.contexte}\n\nle contexte.\n`);
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

const LIEU = {
  representant: () =>
    poserLieu('representant', {
      claude: '# Tu es le représentant de ce client',
      contexte: "# Ce qu'on sait de ce client",
    }),
  orchestrateur: () =>
    poserLieu('orchestrateur', {
      claude: "# Tu es l'orchestrateur de ce chantier",
      contexte: '# Ce qui est propre à ce dépôt',
    }),
};

/**
 * Des agents qui TRAVAILLENT — recevoir a un effet sur le disque, et c'est l'effet qu'on lit.
 * Un double qui empilerait les appels reçus laisserait passer une remise au mauvais pane :
 * c'est-à-dire, ici, un compte rendu de chantier livré au représentant d'un AUTRE client.
 */
function agentsQuiTravaillent(agents) {
  const dossier = join(racine, `travail-${(compteur += 1)}`);
  mkdirSync(dossier, { recursive: true });
  return {
    dossier,
    fichier(pane) {
      return join(dossier, `${pane.replace(/[^a-z0-9]/gi, '_')}.txt`);
    },
    recu(pane) {
      const f = this.fichier(pane);
      return existsSync(f) ? readFileSync(f, 'utf8') : null;
    },
    async vivant(pane) {
      return agents.some((a) => a.pane_id === pane);
    },
    async remettre(pane, texte) {
      writeFileSync(this.fichier(pane), texte);
      return { delivered: true };
    },
    async agents() {
      return agents.map((a) => ({ agent: 'claude', herdr_socket: `/s/${a.pane_id}`, ...a }));
    },
  };
}

/** Un poste complet : registre, espace Slack en mémoire, veilleur qui écoute vraiment. */
async function avecPoste({ lignes = [], canaux = [], agents = [] }, corps) {
  sauverRegistre({ version: 1, lignes, communs: {}, commun: null, dirigeant: null });
  const monde = fauxSlack({ canaux, utilisateurs: [{ id: 'UCLIENT', name: 'jean', profile: {} }] }).installer();
  const travail = agentsQuiTravaillent(agents);
  const v = new Veilleur({
    cheminSocket: join(racine, 'veilleur.sock'),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    herdr: travail,
  });
  await v.ecouterLocal();
  /** Lance la VRAIE commande, depuis le pane demandé. */
  const ld = async (args, pane = PANE_ORCHESTRATEUR) => {
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

/** Le canal privé du client. Il est là dans CHAQUE test : c'est lui qu'on regarde ne rien recevoir. */
const CANAL_CLIENT = { id: 'C_acme', name: 'acme', is_private: true, membres: ['UMOI', 'UCLIENT'] };

/** La ligne cliente du gestionnaire, ouverte depuis SON pane — telle que la pose la laisse. */
const LIGNE_CLIENTE = {
  chantier: 'acme',
  canal_id: 'C_acme',
  canal_nom: 'acme',
  pane: PANE_GESTIONNAIRE,
  worktree: '/g',
  nature: 'client',
  libelle: 'Acme',
  autorises: ['UCLIENT'],
  visage: '🧭',
  ouverte_le: 'hier',
  close_le: null,
};

/** Les deux agents du scénario nominal : un orchestrateur, et le gestionnaire qui l'a mandaté. */
function equipe() {
  return [
    { pane_id: PANE_ORCHESTRATEUR, name: 'd-1', foreground_cwd: LIEU.orchestrateur() },
    { pane_id: PANE_GESTIONNAIRE, name: NOM_GESTIONNAIRE, foreground_cwd: LIEU.representant() },
  ];
}

// ═════════════════ 1. LES DEUX SE PARLENT — le lot lui-même, dans les deux sens

test('L’ORCHESTRATEUR PARLE, ÇA ARRIVE DANS LE PANE DU GESTIONNAIRE — et dans le canal du chantier', async () => {
  await avecPoste({ lignes: [LIGNE_CLIENTE], canaux: [CANAL_CLIENT], agents: equipe() }, async ({ monde, ld, travail }) => {
    const o = await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE]);
    assert.equal(o.code, 0, o.stderr);

    const r = await ld(['dire', 'les stories sont créées, je commence']);
    assert.equal(r.code, 0, r.stderr);

    // LE FAIT, PAS LE MESSAGE : le gestionnaire a reçu quelque chose dans son pane.
    const recu = travail.recu(PANE_GESTIONNAIRE);
    assert.ok(recu, 'le pane du gestionnaire a reçu la parole de l’orchestrateur');
    assert.ok(recu.includes('les stories sont créées, je commence'), 'et c’est le texte de l’orchestrateur, intact');

    // ═══ LE CADRE ET LA COMMANDE S'ACCORDENT — prouvé en EXÉCUTANT ce que le cadre dicte.
    //
    // C'est le défaut de T-20260814-0033, par l'autre bout : un métier qui prescrit ce que le
    // mécanisme refuse bloque l'agent au premier geste. Le pane du gestionnaire porte DEUX
    // lignes ici : un cadre qui proposerait « dire "ta réponse" » sans nommer la ligne enverrait
    // son lecteur droit sur un refus. On ne relit donc pas la phrase — on la TAPE.
    const proposee = recu.split('\n').find((l) => l.includes('dire "ta réponse"'));
    assert.ok(proposee, 'le cadre dit comment répondre');
    const nomme = proposee.match(/--a\s+(\S+)/);
    assert.ok(nomme, 'et il nomme la ligne à viser');
    const reponse = await ld(['dire', 'reçu, je préviens le client', '--a', nomme[1]], PANE_GESTIONNAIRE);
    assert.equal(reponse.code, 0, `la commande que le cadre dicte est acceptée : ${reponse.stderr}`);
    assert.deepEqual(
      canauxTouches(monde),
      ['C_refonte-du-devis', 'C_refonte-du-devis'],
      'et elle atteint le canal du chantier — jamais celui du client'
    );
  });
});

test('LE GESTIONNAIRE DEMANDE, ÇA ARRIVE DANS LE PANE DE L’ORCHESTRATEUR — c’est une équipe, pas un rapport', async () => {
  await avecPoste({ lignes: [LIGNE_CLIENTE], canaux: [CANAL_CLIENT], agents: equipe() }, async ({ monde, ld, travail }) => {
    assert.equal((await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE])).code, 0);

    // Il parle depuis SON pane, et il nomme la ligne : son pane en porte maintenant DEUX.
    const r = await ld(['dire', 'j’ai ouvert D-2, peux-tu t’en occuper quand ce sera possible ?', '--a', 'd-1'], PANE_GESTIONNAIRE);
    assert.equal(r.code, 0, r.stderr);

    const recu = travail.recu(PANE_ORCHESTRATEUR);
    assert.ok(recu, 'le pane de l’orchestrateur a reçu la demande du gestionnaire');
    assert.ok(recu.includes('j’ai ouvert D-2'), 'et c’est le texte du gestionnaire, intact');
  });
});

test('LE GESTIONNAIRE PORTE TROIS LIGNES — chacune atteignable par son nom, aucune inversion', async () => {
  const lignes = [
    LIGNE_CLIENTE,
    {
      ...LIGNE_CLIENTE,
      chantier: 'dirigeant',
      canal_id: 'C_dir',
      canal_nom: 'ligne-dirigeant-acme',
      nature: 'interne',
      libelle: 'dirigeant',
      autorises: ['UDIR'],
    },
  ];
  const canaux = [CANAL_CLIENT, { id: 'C_dir', name: 'ligne-dirigeant-acme', is_private: false, membres: ['UMOI', 'UDIR'] }];
  await avecPoste({ lignes, canaux, agents: equipe() }, async ({ monde, ld }) => {
    assert.equal((await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE])).code, 0);

    assert.equal((await ld(['dire', 'où en est-on ?', '--a', 'd-1'], PANE_GESTIONNAIRE)).code, 0);
    assert.equal((await ld(['dire', 'ça avance', '--a', 'acme'], PANE_GESTIONNAIRE)).code, 0);
    assert.equal((await ld(['dire', 'un arbitrage', '--a', 'dirigeant'], PANE_GESTIONNAIRE)).code, 0);

    assert.deepEqual(
      canauxTouches(monde),
      ['C_refonte-du-devis', 'C_acme', 'C_dir'],
      'chaque message part dans le canal de SA ligne — jamais la première inscrite'
    );
  });
});

// ═════════════════ 2. RIEN NE FUIT CHEZ LE CLIENT — prouvé par l'ABSENCE

test('RIEN DE CE QUI TRANSITE ENTRE LES DEUX AGENTS N’ATTEINT LE CANAL DU CLIENT', async () => {
  await avecPoste({ lignes: [LIGNE_CLIENTE], canaux: [CANAL_CLIENT], agents: equipe() }, async ({ monde, ld }) => {
    assert.equal((await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE])).code, 0);

    await ld(['dire', 'la migration casse la table facture, je répare']);
    await ld(['demander', 'je bascule en lecture seule ?']);
    await ld(['dire', 'et lui, il a quoi comme échéance ?', '--a', 'd-1'], PANE_GESTIONNAIRE);

    // L'ABSENCE, CÔTÉ SLACK : le canal privé du client n'a rien reçu. C'est la garde que le
    // dirigeant regarde en premier, et elle se lit sur ce que le faux Slack a VRAIMENT reçu.
    assert.deepEqual(
      canauxTouches(monde).filter((c) => c === 'C_acme'),
      [],
      'le canal du client n’a reçu AUCUN de ces messages'
    );
    assert.deepEqual(
      [...new Set(canauxTouches(monde))],
      ['C_refonte-du-devis'],
      'tout est resté dans le canal du chantier, et nulle part ailleurs'
    );
  });
});

test('UNE LIGNE CLIENTE NE SE PARTAGE PAS — le canal n’est même pas créé, et personne n’y entre', async () => {
  // ⚠️ LE DANGER RÉEL SE VISE AVEC UN **SECOND** GESTIONNAIRE, et le premier essai écrit ici ne
  // le visait pas : en nommant le gestionnaire qui ouvre, il tombait sur « c'est toi » — un
  // refus voisin, qui aurait survécu au retrait de celui-ci. Le cas qui coûte, c'est un
  // représentant attaché à la ligne cliente d'un AUTRE : il aurait alors pu écrire dans le
  // canal privé d'un client qui n'est pas le sien.
  const autre = 'autre-gestionnaire';
  const agents = [
    ...equipe(),
    { pane_id: 'w9:pH', name: autre, foreground_cwd: LIEU.representant() },
  ];
  await avecPoste({ lignes: [], canaux: [CANAL_CLIENT], agents }, async ({ monde, ld, travail }) => {
    const avant = monde.canaux.length;
    const r = await ld(
      ['ouvrir', 'bidule', '--nature', 'client', '--titre', 'Espace Bidule', '--au-gestionnaire', autre],
      PANE_GESTIONNAIRE
    );
    assert.equal(r.code, 1, 'l’ouverture est refusée');
    // LE FAIT : aucun canal créé, aucune ligne inscrite, aucune remise. Slack ne reprend pas un
    // canal créé pour rien — le refus DOIT tomber avant la création, pas après.
    assert.equal(monde.canaux.length, avant, 'aucun canal n’a été créé');
    assert.deepEqual(chargerRegistre().lignes, [], 'aucune ligne n’est inscrite');
    assert.equal(travail.recu('w9:pH'), null, 'l’autre gestionnaire n’a rien reçu');

    // ET IL N'EST PAS ENTRÉ DANS LE CANAL : depuis son pane, il n'a aucune ligne à viser, donc
    // rien ne peut partir. C'est l'absence qui compte, pas le refus qu'on aurait pu lire.
    const tentative = await ld(['dire', 'bonjour', '--a', 'bidule'], 'w9:pH');
    assert.equal(tentative.code, 1);
    assert.deepEqual(canauxTouches(monde), [], 'rien n’est parti nulle part');
  });
});

test('UN AGENT QUI N’EST PAS UN GESTIONNAIRE N’EST PAS UN PAIR — même s’il vit et porte le bon nom', async () => {
  // Le piège réel : un agent quelconque (chef d'équipe, orchestrateur voisin) qu'on nomme par
  // erreur. Son lieu n'établit pas le rôle de représentant, il ne reçoit donc rien.
  const agents = [
    { pane_id: PANE_ORCHESTRATEUR, name: 'd-1', foreground_cwd: LIEU.orchestrateur() },
    { pane_id: 'w9:pX', name: NOM_GESTIONNAIRE, foreground_cwd: join(racine, 'worktree-ordinaire') },
  ];
  mkdirSync(join(racine, 'worktree-ordinaire'), { recursive: true });
  await avecPoste({ lignes: [], canaux: [CANAL_CLIENT], agents }, async ({ monde, ld, travail }) => {
    const avant = monde.canaux.length;
    const r = await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE]);
    assert.equal(r.code, 1, 'l’ouverture est refusée');
    assert.equal(monde.canaux.length, avant, 'aucun canal n’a été créé');
    assert.equal(travail.recu('w9:pX'), null, 'l’agent nommé par erreur n’a rien reçu');
  });
});

test('UN NOM QUI NE DÉSIGNE AUCUN AGENT VIVANT EST UN REFUS — pas une ligne qui a l’air partagée', async () => {
  await avecPoste({ lignes: [], canaux: [CANAL_CLIENT], agents: equipe() }, async ({ monde, ld }) => {
    const avant = monde.canaux.length;
    const r = await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', 'personne-de-ce-nom']);
    assert.equal(r.code, 1);
    assert.equal(monde.canaux.length, avant, 'aucun canal n’a été créé');
    assert.deepEqual(chargerRegistre().lignes, [], 'aucune ligne n’est inscrite');
  });
});

test('UN PANE REPRIS PAR UN AUTRE AGENT NE REÇOIT RIEN — le pair est revérifié à CHAQUE écho', async () => {
  // ⚠️ TROUVÉ EN REVUE DE FOND, REPRODUIT AVANT D'ÊTRE CRU. Le pair est établi UNE FOIS, à
  // l'ouverture ; `{nom, pane}` est ensuite figé au registre. Le pane du gestionnaire ferme,
  // herdr en rouvre un sous le MÊME identifiant pour un autre agent — et tout le fil technique
  // du chantier continuait de lui être remis, cadré « c'est ton pair qui te parle », avec
  // `remis: true`. Si cet autre agent est le représentant d'un AUTRE client, c'est la fuite que
  // ce lot ferme partout ailleurs, par la porte du temps.
  const agents = equipe();
  await avecPoste({ lignes: [LIGNE_CLIENTE], canaux: [CANAL_CLIENT], agents }, async ({ ld, travail }) => {
    assert.equal((await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE])).code, 0);

    // Le gestionnaire meurt ; SON PANE est repris par le représentant d'un AUTRE client.
    agents[1].name = 'bidule-gestionnaire';

    const r = await ld(['dire', 'la migration casse la table facture']);
    assert.equal(r.code, 0, r.stderr);
    // LE FAIT : rien n'a été écrit dans ce pane, et celui qui a parlé l'APPREND.
    assert.equal(travail.recu(PANE_GESTIONNAIRE), null, 'le nouvel occupant du pane ne reçoit rien');
    assert.equal(JSON.parse(r.stdout).pair.remis, false, 'et l’orchestrateur n’est pas laissé croire que c’est passé');
  });
});

test('UN PANE VIDÉ NE REÇOIT RIEN NON PLUS — dans les deux sens', async () => {
  // L'autre porte du même défaut : l'écho vers l'ORCHESTRATEUR. Aucun nom n'est inscrit pour
  // lui au registre, mais la vie de son pane l'est — la même garantie que le chemin entrant.
  const agents = equipe();
  await avecPoste({ lignes: [LIGNE_CLIENTE], canaux: [CANAL_CLIENT], agents }, async ({ ld, travail }) => {
    assert.equal((await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE])).code, 0);
    agents.splice(0, 1); // l'orchestrateur a disparu

    const r = await ld(['dire', 'et lui, il en est où ?', '--a', 'd-1'], PANE_GESTIONNAIRE);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(travail.recu(PANE_ORCHESTRATEUR), null, 'rien n’est écrit dans un pane sans agent');
    assert.equal(JSON.parse(r.stdout).pair.remis, false, 'et le gestionnaire l’apprend');
  });
});

// ═════════════════ 2-bis. PARLER SE PARTAGE, DISPOSER NON — l'autre porte de la même sélection

test('LE GESTIONNAIRE NE FERME PAS LE CHANTIER DE SON ORCHESTRATEUR — ni ne l’archive', async () => {
  // ⚠️ « UNE PORTE SUR DEUX » : `ligneDuPane` sert TROIS gestes, pas un. Ajouter un porteur pour
  // `dire` donnait au gestionnaire, du même geste, le pouvoir de POSTER UN BILAN au nom du
  // chantier puis d'ARCHIVER son canal — c'est-à-dire de mettre en lecture seule, sans retour,
  // le lieu où l'orchestrateur attend l'arbitrage du dirigeant.
  await avecPoste({ lignes: [LIGNE_CLIENTE], canaux: [CANAL_CLIENT], agents: equipe() }, async ({ monde, ld }) => {
    assert.equal((await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE])).code, 0);
    const chantier = monde.canaux.find((c) => c.name === 'refonte-du-devis');

    const r = await ld(['fermer', '--bilan', 'je clos ça', '--a', 'd-1'], PANE_GESTIONNAIRE);
    assert.equal(r.code, 1, 'le geste est refusé');
    // LE FAIT : aucun bilan posté, canal jamais archivé, ligne toujours ouverte.
    assert.deepEqual(canauxTouches(monde), [], 'aucun bilan n’est parti');
    assert.equal(chantier.is_archived, false, 'le canal du chantier n’est PAS archivé');
    assert.equal(chargerRegistre().lignes.find((l) => l.chantier === 'd-1').close_le, null, 'la ligne reste ouverte');

    // Et l'orchestrateur, lui, ferme la sienne — le refus porte sur le pair, pas sur le geste.
    assert.equal((await ld(['fermer', '--bilan', 'livré'], PANE_ORCHESTRATEUR)).code, 0);
    assert.equal(chantier.is_archived, true, 'celui qui mène le chantier le referme bien');
  });
});

test('IL NE RENOMME PAS SON CANAL NON PLUS — même en le désignant par son identifiant', async () => {
  // Le chemin `--canal <id>` existe pour renommer depuis un pane qui ne porte aucune ligne : il
  // contournerait le refus s'il ne lisait pas le pane courant. C'est la porte d'à côté.
  await avecPoste({ lignes: [LIGNE_CLIENTE], canaux: [CANAL_CLIENT], agents: equipe() }, async ({ monde, ld }) => {
    assert.equal((await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE])).code, 0);
    const chantier = monde.canaux.find((c) => c.name === 'refonte-du-devis');

    assert.equal((await ld(['renommer', '--titre', 'Autre chose', '--a', 'd-1'], PANE_GESTIONNAIRE)).code, 1);
    assert.equal(chantier.name, 'refonte-du-devis', 'le canal garde son nom');
    assert.equal((await ld(['renommer', '--titre', 'Autre chose', '--canal', chantier.id], PANE_GESTIONNAIRE)).code, 1);
    assert.equal(chantier.name, 'refonte-du-devis', 'et l’identifiant du canal ne contourne pas le refus');
  });
});

// ═════════════════ 3. LA NON-RÉGRESSION — celle qui compte le plus

test('UN ORCHESTRATEUR SANS GESTIONNAIRE : sa ligne s’ouvre et parle EXACTEMENT comme avant', async () => {
  await avecPoste({ lignes: [], canaux: [], agents: equipe() }, async ({ monde, ld, travail }) => {
    const o = await ld(['ouvrir', 'd-9', '--titre', 'Chantier seul', '--sujet', 'de quoi il s’agit']);
    assert.equal(o.code, 0, o.stderr);
    const ouverture = JSON.parse(o.stdout);
    assert.equal(ouverture.ok, true);
    assert.equal(ouverture.pair, undefined, 'aucun pair n’est annoncé');

    const r = await ld(['dire', 'un jalon']);
    assert.equal(r.code, 0, r.stderr);
    const dit = JSON.parse(r.stdout);
    assert.equal(dit.pair, undefined, 'aucun écho n’est annoncé');

    // LE FAIT : le message est parti dans SON canal, et AUCUN pane n’a rien reçu — ni le sien,
    // ni celui du gestionnaire qui existe pourtant sur ce poste.
    assert.deepEqual(canauxTouches(monde), ['C_chantier-seul']);
    assert.equal(travail.recu(PANE_GESTIONNAIRE), null, 'le gestionnaire du poste n’a rien reçu');
    assert.equal(travail.recu(PANE_ORCHESTRATEUR), null, 'l’orchestrateur ne se reçoit pas lui-même');

    // Et le registre ne porte rien de neuf : une ligne sans pair est la ligne d'hier.
    const [ligne] = chargerRegistre().lignes;
    assert.equal(ligne.pair, null, 'la ligne ne porte aucun pair');
    assert.equal(ligne.pane, PANE_ORCHESTRATEUR);
  });
});

test('SANS PAIR, LE PANE N’EN PORTE QU’UNE — `dire` sans nom marche toujours, rien n’est devenu obligatoire', async () => {
  await avecPoste({ lignes: [], canaux: [], agents: equipe() }, async ({ monde, ld }) => {
    assert.equal((await ld(['ouvrir', 'd-9', '--titre', 'Chantier seul'])).code, 0);
    const r = await ld(['dire', 'sans --a, comme hier']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(canauxTouches(monde), ['C_chantier-seul']);
  });
});

// ═════════════════ 4. L'ORCHESTRATEUR EXISTE DÉJÀ — le cas nominal du dirigeant

test('UNE LIGNE DÉJÀ OUVERTE ACCUEILLE SON GESTIONNAIRE — sans la refermer, sans changer de canal', async () => {
  // « Le gestionnaire ne lance pas l'orchestrateur, il lui parle — l'orchestrateur existe
  // déjà » (arbitrage du dirigeant, 2026-08-14). Sa ligne est ouverte depuis des jours.
  const dejaOuverte = {
    chantier: 'd-1',
    canal_id: 'C_chantier',
    canal_nom: 'refonte-du-devis',
    pane: PANE_ORCHESTRATEUR,
    worktree: '/w',
    nature: 'interne',
    libelle: 'd-1',
    autorises: ['UDIR'],
    visage: '🧭',
    ouverte_le: 'avant-hier',
    close_le: null,
  };
  const canaux = [CANAL_CLIENT, { id: 'C_chantier', name: 'refonte-du-devis', is_private: false, membres: ['UMOI', 'UDIR'] }];
  await avecPoste({ lignes: [LIGNE_CLIENTE, dejaOuverte], canaux, agents: equipe() }, async ({ monde, ld, travail }) => {
    const o = await ld(['ouvrir', 'd-1', '--titre', 'Refonte du devis', '--au-gestionnaire', NOM_GESTIONNAIRE]);
    assert.equal(o.code, 0, o.stderr);
    assert.equal(JSON.parse(o.stdout).reprise, true, 'c’est une reprise, pas un second canal');
    assert.equal(monde.canaux.length, canaux.length, 'aucun canal n’a été créé');

    await ld(['dire', 'ça avance']);
    assert.ok(travail.recu(PANE_GESTIONNAIRE), 'le gestionnaire reçoit désormais ce que dit l’orchestrateur');
    assert.deepEqual(canauxTouches(monde), ['C_chantier'], 'et ça reste dans le canal du chantier');
  });
});

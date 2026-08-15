// UN CROCHET SUR LE MESSAGE, POSÉ QUAND L'AGENT L'A PRIS (T-20260815-0011).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI L'A PROVOQUÉ
//
// Le dirigeant a écrit « allo » deux fois dans la même journée, puis : *« Pourquoi tu confirmes
// toujours pas la réception des messages, c'est ben compliqué. »* Ses deux messages étaient
// arrivés et l'agent y travaillait. **Il n'avait aucun moyen de le savoir.**
//
// La solution évidente — l'agent répond « bien reçu » — est la mauvaise : elle repose sur la
// discipline de l'agent, et un agent occupé est précisément celui qui n'y pense pas. Une
// garantie qui dépend de ce que quelqu'un doit penser à faire n'en est pas une.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LA FRONTIÈRE EST UN CRAN PLUS LOIN QU'ON NE CROIT — corrigée par le dirigeant lui-même
//
// La première spécification disait « à la remise effective à l'agent », en l'opposant à « à la
// réception par le veilleur ». Le dirigeant a répondu : *« Oui mais des fois le message est
// passé mais reste dans ton champ de prompt. »*
//
//   reçu par Slack  ≠  écrit dans le pane  ≠  PRIS par l'agent  ≠  lu
//
// Un crochet posé à l'écriture mentirait, et dans le pire sens : le dirigeant s'y fierait,
// cesserait d'écrire « allo », et ce jour-là le message serait vraiment perdu.
//
// MESURÉ le 2026-08-15 à 21 h 29 : sur quatre agents vivants, **trois panes sur trois**
// portaient un message écrit jamais soumis — dont un du dirigeant. Les trois agents étaient
// `done`. Un message coincé est donc indiscernable non seulement d'un agent occupé, mais d'un
// agent qui a fini.
//
// ⚠️ ET L'ABSENCE DE CROCHET EST LA MOITIÉ QUI A DE LA VALEUR. Sans elle, le crochet pourrait
// être posé toujours et ne rien signifier. C'est elle qui rend le silence lisible.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';

let Veilleur, sauverRegistre, poserCrochet;
let racine;
let compteur = 0;

const UMOI = 'UMOI';
const UDIR = 'UDIR';
const PANE = 'w1:p1';
const TS = '1755300000.000100';

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-crochet-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre } = await import('../src/registre.js'));
  ({ poserCrochet } = await import('../src/slack.js'));
});
after(() => rmSync(racine, { recursive: true, force: true }));
beforeEach(() => sauverRegistre({ version: 1, lignes: [], commun: null, dirigeant: { id: UDIR, courriel: 'd@somtech.ca' } }));

/**
 * Un herdr dont la remise dit si l'agent a PRIS le message.
 *
 * `pris` est le verdict que la vraie remise établit en relisant le pane — boîte vidée, message
 * en file d'attente, ou session sortie de l'attente. Le double le donne tel quel : ce qui est
 * éprouvé ici est ce que le VEILLEUR en fait, pas la façon de l'établir (voir `herdr.test.js`).
 */
function herdrQui({ pris = true, vivant = true } = {}) {
  return {
    remis: [],
    async vivant() {
      return vivant;
    },
    async remettre(pane, texte) {
      this.remis.push({ pane, texte });
      return { type: 'agent_prompted', pris };
    },
    async agents() {
      return vivant ? [{ agent: 'claude', pane_id: PANE }] : [];
    },
  };
}

const LIGNE = {
  chantier: 'j-1',
  canal_id: 'C1',
  canal_nom: 'ligne-du-chantier',
  pane: PANE,
  worktree: '/w',
  nature: 'interne',
  libelle: 'j-1',
  autorises: [UDIR],
  membres_vus: [UMOI, UDIR],
  visage: '🧭',
  ouverte_le: 'hier',
  close_le: null,
};

async function avecPoste({ ligne = LIGNE, herdr }, corps) {
  sauverRegistre({ version: 1, lignes: [ligne], commun: null, dirigeant: { id: UDIR, courriel: 'd@somtech.ca' } });
  const monde = fauxSlack({
    canaux: [{ id: 'C1', name: 'ligne-du-chantier', is_private: false, membres: [UMOI, UDIR] }],
    utilisateurs: [
      { id: UMOI, name: 'ligne_directe', is_bot: true, team_id: 'T_ESSAIS', profile: {} },
      { id: UDIR, name: 'maxime', team_id: 'T_ESSAIS', profile: { display_name: 'maxime' } },
    ],
    robot: UMOI,
    espace: 'T_ESSAIS',
  }).installer();
  // Le message du dirigeant EXISTE dans le canal — c'est lui qu'on va crocheter. Le double
  // refuse désormais un horodatage qu'il ne connaît pas, comme le vrai Slack : il faut donc
  // dire que celui-ci est là, plutôt que de compter sur un double complaisant.
  monde.horodatagesConnus = [TS];
  const v = new Veilleur({
    cheminSocket: join(racine, `v-${(compteur += 1)}.sock`),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T_ESSAIS', utilisateur: UMOI },
    herdr,
  });
  await v.ecouterLocal();
  try {
    return await corps({ monde, veilleur: v });
  } finally {
    await v.arreter();
    monde.restaurer();
  }
}

/**
 * UN VRAI LIEU D'ORCHESTRATEUR SUR DISQUE — parce que le rôle s'établit par le FAIT.
 *
 * La diffusion d'une consigne filtre ses destinataires sur `roleDuLieu(foreground_cwd)`, qui
 * lit les quatre fichiers de la pose ET les en-têtes réels du métier. Un double qui rendrait
 * « rôle orchestrateur » sur parole prouverait l'accord de l'essai avec lui-même.
 */
function lieuDOrchestrateur() {
  const lieu = join(racine, `lieu-${(compteur += 1)}`);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), "# Tu es l'orchestrateur de ce chantier\n\nle métier.\n");
  writeFileSync(join(lieu, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n\nle contexte.\n');
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

/** La parole du dirigeant, telle que Slack la livre — avec son horodatage, qui l'identifie. */
const parole = (texte, sur = {}) => ({ type: 'message', channel: 'C1', user: UDIR, text: texte, ts: TS, ...sur });

// ═════════════════ 1. LE CROCHET SE POSE QUAND L'AGENT A PRIS

test('UN MESSAGE PRIS PAR SON AGENT PORTE LE CROCHET — le dirigeant n’a plus à écrire « allo »', async () => {
  const h = herdrQui({ pris: true });
  await avecPoste({ herdr: h }, async ({ monde, veilleur }) => {
    await veilleur.remettreAuChantier(parole('l’option B, et n’attends pas'));

    // LA PREUVE EST DANS L'ESPACE : la réaction est sur SON message, désigné par l'horodatage
    // que Slack lui a donné. Pas sur le dernier message du canal, pas sur un autre.
    const posees = monde.reactions.filter((r) => r.ts === TS);
    assert.equal(posees.length, 1, `un crochet, sur son message : ${JSON.stringify(monde.reactions)}`);
    assert.equal(posees[0].canal, 'C1');
  });
});

// ═════════════════ 2. ET IL NE SE POSE PAS QUAND LA PRISE N'EST PAS CONSTATÉE
//
// ⚠️ C'EST CETTE MOITIÉ QUI PROUVE QUELQUE CHOSE. Un crochet posé dans tous les cas serait un
// « ok » rendu sans avoir agi — le motif que ce dépôt passe ses journées à fermer.

test('UN MESSAGE DONT LA PRISE N’EST PAS CONSTATÉE NE PORTE PAS LE CROCHET', async () => {
  // Le cas mesuré : le texte est écrit dans le pane, il y reste, l'agent ne voit rien. Trois
  // panes sur trois étaient dans cet état le 2026-08-15, dont celui du dirigeant.
  const h = herdrQui({ pris: false });
  await avecPoste({ herdr: h }, async ({ monde, veilleur }) => {
    await veilleur.remettreAuChantier(parole('le coût du chantier ?'));

    assert.equal(h.remis.length, 1, 'le texte a bien été écrit dans le pane…');
    assert.deepEqual(monde.reactions, [], '…mais rien ne dit qu’il a été pris : pas de crochet');
  });
});

test('UN AGENT MORT NE FAIT PAS POSER DE CROCHET NON PLUS — rien n’a été écrit du tout', async () => {
  const h = herdrQui({ vivant: false });
  await avecPoste({ herdr: h }, async ({ monde, veilleur }) => {
    await veilleur.remettreAuChantier(parole('tu es là ?'));

    assert.deepEqual(monde.reactions, [], 'aucun crochet');
    assert.ok(monde.postes.length > 0, 'et le dirigeant l’apprend par une réponse, comme avant');
  });
});

test('UNE LIGNE CLOSE NE FAIT PAS POSER DE CROCHET — elle répond, elle ne fait pas semblant', async () => {
  const h = herdrQui({ pris: true });
  await avecPoste({ ligne: { ...LIGNE, close_le: 'hier' }, herdr: h }, async ({ monde, veilleur }) => {
    await veilleur.remettreAuChantier(parole('coucou'));

    assert.deepEqual(monde.reactions, [], 'rien n’a été remis, donc rien n’est confirmé');
  });
});

// ═════════════════ 3. LE CROCHET NE REMPLACE RIEN ET NE CASSE RIEN

test('LA REMISE SE FAIT MÊME SI LE CROCHET ÉCHOUE — un accusé raté ne perd pas le message', async () => {
  // ⚠️ L'ORDRE ET LA TOLÉRANCE COMPTENT. Le crochet est un confort ; la remise est la mission.
  // Un droit `reactions:write` manquant ne doit pas empêcher un message d'arriver — sinon on
  // aurait troqué un inconfort contre une panne.
  const h = herdrQui({ pris: true });
  await avecPoste({ herdr: h }, async ({ monde, veilleur }) => {
    monde.crochetImpossible = true;
    await veilleur.remettreAuChantier(parole('l’option B'));

    assert.equal(h.remis.length, 1, 'le message est arrivé chez l’agent');
    assert.deepEqual(monde.reactions, [], 'et le crochet, lui, n’a pas pu être posé');
  });
});


// ═════════════════ 3-bis. LE GESTE DE POSE LUI-MÊME, ÉPROUVÉ SANS VEILLEUR
//
// ⚠️ CES TROIS ESSAIS EXISTENT PARCE QUE LES DEUX REVUES ONT MONTRÉ QUE RIEN NE LES COUVRAIT :
// supprimer la tolérance `already_reacted`, ou les refus du double, laissait toute la suite
// verte. Une garde que rien n'oblige n'est pas une garde — c'est un commentaire.
//
// On appelle `poserCrochet` directement : le monde installé remplace le transport, donc le
// geste s'éprouve sans monter un veilleur, et son verdict (`true`/`false`) devient lisible —
// ce qu'il n'est pas de l'extérieur, où seul le journal le laisse deviner.

/** Le monde Slack seul, sans veilleur — pour éprouver un geste plutôt qu'un enchaînement. */
async function avecMondeSeul(corps) {
  const monde = fauxSlack({
    canaux: [{ id: 'C1', name: 'ligne-du-chantier', is_private: false, membres: [UMOI, UDIR] }],
    utilisateurs: [{ id: UMOI, name: 'ligne_directe', is_bot: true, team_id: 'T_ESSAIS', profile: {} }],
    robot: UMOI,
    espace: 'T_ESSAIS',
  }).installer();
  monde.horodatagesConnus = [TS];
  try {
    return await corps(monde);
  } finally {
    monde.restaurer();
  }
}

test('UN CROCHET DÉJÀ POSÉ EST UN CROCHET POSÉ — « already_reacted » n’est pas une panne', async () => {
  // Le veilleur peut repasser sur un message déjà crocheté (reprise, double événement Slack).
  // Lire ce refus comme un échec ferait journaliser une alarme sur un dispositif qui marche —
  // et une alarme qui crie à tort cesse d'être lue, y compris le jour où elle a raison.
  await avecMondeSeul(async (monde) => {
    assert.equal(await poserCrochet('xoxb-x', 'C1', TS), true, 'le premier passage pose');
    assert.deepEqual(monde.reactions.length, 1);
    assert.equal(await poserCrochet('xoxb-x', 'C1', TS), true, 'le second constate qu’il est là');
    assert.equal(monde.reactions.length, 1, 'et il n’en a pas posé deux');
  });
});

test('UN CANAL QUE SLACK NE CONNAÎT PAS NE REÇOIT PAS DE CROCHET — et le geste le dit', async () => {
  await avecMondeSeul(async (monde) => {
    assert.equal(await poserCrochet('xoxb-x', 'C_JAMAIS_VU', TS), false);
    assert.deepEqual(monde.reactions, [], 'rien n’a été posé nulle part');
  });
});

test('UN MESSAGE QUE SLACK NE CONNAÎT PAS NON PLUS — le double refuse ce que le service refuse', async () => {
  // C'est la sixième fois dans ce dépôt qu'un double se montre plus permissif que le service
  // qu'il double. Un double complaisant fait passer des essais qui ne prouvent rien.
  await avecMondeSeul(async (monde) => {
    assert.equal(await poserCrochet('xoxb-x', 'C1', '9999999999.000000'), false);
    assert.deepEqual(monde.reactions, []);
  });
});


// ═════════════════ 4. LE VERDICT LUI-MÊME — les trois témoins, et leur absence
//
// Le crochet ne vaut que ce que vaut ce verdict. Il est donc éprouvé ici SANS transport, cas
// par cas — c'est la seule façon d'écrire l'absence de témoin, qui est la moitié qui compte.

test('LA BOÎTE QUI SE VIDE EST UNE PRISE', async () => {
  const { laPriseEstConstatee } = await import('../src/boite.js');
  const SEP = '─'.repeat(20);
  const avec = ['~/ici', SEP, '❯ mon texte', SEP, ''].join('\n');
  const sans = ['~/ici', SEP, '❯', SEP, ''].join('\n');

  assert.equal(laPriseEstConstatee({ statutAvant: 'idle', statut: 'idle', ecranAvant: avec, ecran: sans }), 'boite-videe');
});

test('UN MESSAGE QUI APPARAÎT EN FILE EST UNE PRISE — l’agent travaillait, il le prendra', async () => {
  const { laPriseEstConstatee } = await import('../src/boite.js');
  const SEP = '─'.repeat(20);
  const avant = ['~/ici', SEP, '❯', SEP, ''].join('\n');
  const apres = ['~/ici', SEP, '❯', SEP, 'Press up to edit queued messages'].join('\n');

  assert.equal(
    laPriseEstConstatee({ statutAvant: 'working', statut: 'working', ecranAvant: avant, ecran: apres }),
    'file-d-attente'
  );
});

test('UNE SESSION QUI QUITTE L’ATTENTE EST UNE PRISE', async () => {
  const { laPriseEstConstatee } = await import('../src/boite.js');
  assert.equal(
    laPriseEstConstatee({ statutAvant: 'idle', statut: 'working', ecranAvant: null, ecran: null }),
    'sortie-de-l-attente'
  );
});

test('UN ÉCRAN INCHANGÉ N’EST PAS UNE PRISE — c’est très exactement le cas mesuré le 2026-08-15', async () => {
  // ⚠️ LA MOITIÉ QUI A DE LA VALEUR. Trois panes sur trois portaient un message écrit jamais
  // soumis, dont un du dirigeant, et les trois agents étaient `done`. Rien n'avait bougé — et
  // c'est précisément ce « rien » qui doit empêcher le crochet, sans quoi il serait posé
  // toujours et ne signifierait rien.
  const { laPriseEstConstatee } = await import('../src/boite.js');
  const SEP = '─'.repeat(20);
  const coince = ['~/ici', SEP, '❯ [Pasted text #16]', SEP, ''].join('\n');

  assert.equal(
    laPriseEstConstatee({ statutAvant: 'done', statut: 'done', ecranAvant: coince, ecran: coince }),
    null,
    'rien n’a changé : on n’affirme pas qu’il l’a pris'
  );
});

test('UNE FILE DÉJÀ LÀ AVANT L’ENVOI NE TÉMOIGNE DE RIEN — le marqueur doit être APPARU', async () => {
  const { laPriseEstConstatee } = await import('../src/boite.js');
  const SEP = '─'.repeat(20);
  const dejaEnFile = ['~/ici', SEP, '❯', SEP, 'Press up to edit queued messages'].join('\n');

  assert.equal(
    laPriseEstConstatee({ statutAvant: 'working', statut: 'working', ecranAvant: dejaEnFile, ecran: dejaEnFile }),
    null,
    'il en avait déjà : ce marqueur-là ne dit rien de NOTRE message'
  );
});

test('UN ÉCRAN ILLISIBLE N’EST PAS UNE BOÎTE VIDÉE — « je n’ai pas vu » n’est pas « il n’y avait rien »', async () => {
  const { laPriseEstConstatee } = await import('../src/boite.js');
  const SEP = '─'.repeat(20);
  const avec = ['~/ici', SEP, '❯ mon texte', SEP, ''].join('\n');

  assert.equal(
    laPriseEstConstatee({ statutAvant: 'idle', statut: 'idle', ecranAvant: avec, ecran: null }),
    null
  );
});


// ═════════════════ 5. UN AVANT QU'ON N'A PAS PU LIRE NE FABRIQUE PAS DE TÉMOIN
//
// ⚠️ BLOQUANT RELEVÉ EN REVUE DE FOND, et c'est le défaut qui rendrait ce lot NUISIBLE.
//
// `laPriseEstConstatee` documentait l'invariant — « une boîte illisible ne témoigne de rien,
// on ne la compte ni comme vidée ni comme pleine » — et ne le gardait que du côté APRÈS. Côté
// AVANT, `messagesEnFile(null)` rend `false` et `boiteEstVide(null)` rend `false` : une lecture
// ratée se lisait donc comme « il n'y avait rien », et il suffisait que l'APRÈS paraisse vide
// pour fabriquer une « boîte vidée » sans avoir rien constaté.
//
// Le scénario n'a rien d'exotique : la remise lit l'état AVANT d'écrire, et cette lecture peut
// échouer sur un aléa transitoire. Le crochet serait alors posé sur un message dont personne ne
// sait s'il est arrivé — c'est-à-dire la fausse assurance que ce ticket existe pour empêcher.

test('UN AVANT ILLISIBLE NE DONNE PAS « BOÎTE VIDÉE » — on n’a pas vu, on ne conclut pas', async () => {
  const { laPriseEstConstatee } = await import('../src/boite.js');
  const SEP = '─'.repeat(20);
  const vide = ['~/ici', SEP, '❯', SEP, ''].join('\n');

  assert.equal(
    laPriseEstConstatee({ statutAvant: 'idle', statut: 'idle', ecranAvant: null, ecran: vide }),
    null,
    'la boîte paraît vide APRÈS, mais on ignore ce qu’elle contenait AVANT'
  );
});

test('UN AVANT ILLISIBLE NE DONNE PAS « FILE D’ATTENTE » NON PLUS', async () => {
  const { laPriseEstConstatee } = await import('../src/boite.js');
  const SEP = '─'.repeat(20);
  const enFile = ['~/ici', SEP, '❯', SEP, 'Press up to edit queued messages'].join('\n');

  assert.equal(
    laPriseEstConstatee({ statutAvant: 'working', statut: 'working', ecranAvant: null, ecran: enFile }),
    null,
    'il en avait peut-être déjà : sans l’avant, l’apparition n’est pas constatable'
  );
});

test('MAIS LE STATUT, LUI, RESTE UN TÉMOIN — il ne dépend pas de l’écran', async () => {
  // La garde ne doit pas déborder : le changement de statut est lisible même quand l'écran ne
  // l'est pas. L'aveugler aussi ferait perdre le seul témoin qui survit à un écran illisible.
  const { laPriseEstConstatee } = await import('../src/boite.js');

  assert.equal(
    laPriseEstConstatee({ statutAvant: 'idle', statut: 'working', ecranAvant: null, ecran: null }),
    'sortie-de-l-attente'
  );
});


// ═════════════════ 6. LA CONSIGNE COMMUNE COMPTE CE QU'ELLE A PROUVÉ
//
// ⚠️ RELEVÉ EN REVUE DE FOND. Ce chemin payait déjà le coût de la vérification — la remise
// établit le verdict pour tous ses appelants — et jetait la réponse : `remis` s'incrémentait
// sur la seule absence d'exception. Une consigne coincée dans le pane d'un orchestrateur était
// donc comptée « remise », et la machinerie qui le savait tournait à côté sans qu'on l'écoute.

test('UNE CONSIGNE DONT LA PRISE N’EST PAS CONSTATÉE N’EST PAS COMPTÉE COMME REMISE', async () => {
  const h = herdrQui({ pris: false });
  const lieu = lieuDOrchestrateur();
  h.agents = async () => [{ agent: 'claude', pane_id: PANE, foreground_cwd: lieu, herdr_socket: null }];
  await avecPoste({ herdr: h }, async ({ veilleur }) => {
    veilleur.registre.communs = {
      orchestrateur: { canal_id: 'C_COMMUN', canal_nom: 'les-orchestrateurs', autorises: [UDIR] },
    };
    const r = await veilleur.diffuserConsigne({ type: 'message', channel: 'C_COMMUN', user: UDIR, text: 'arrêtez tout', ts: TS });

    assert.equal(r.remis, 0, 'écrit n’est pas pris — on ne compte pas ce qu’on n’a pas prouvé');
    assert.deepEqual(r.non_prouves, [PANE], 'et on DIT chez qui la prise n’a pas été constatée');
  });
});

test('UNE CONSIGNE PRISE EST COMPTÉE, ELLE — la garde ne rend pas le compteur inerte', async () => {
  const h = herdrQui({ pris: true });
  const lieu = lieuDOrchestrateur();
  h.agents = async () => [{ agent: 'claude', pane_id: PANE, foreground_cwd: lieu, herdr_socket: null }];
  await avecPoste({ herdr: h }, async ({ veilleur }) => {
    veilleur.registre.communs = {
      orchestrateur: { canal_id: 'C_COMMUN', canal_nom: 'les-orchestrateurs', autorises: [UDIR] },
    };
    const r = await veilleur.diffuserConsigne({ type: 'message', channel: 'C_COMMUN', user: UDIR, text: 'arrêtez tout', ts: TS });

    assert.equal(r.remis, 1);
    assert.equal(r.non_prouves, undefined);
  });
});

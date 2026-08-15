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
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';

let Veilleur, sauverRegistre;
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

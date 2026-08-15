// T-20260806-0105 — ce que le client voit de NOUS, par-delà ce qu'on lui dit.
//
// Le registre de langage garde les MESSAGES : aucune phrase destinée à un client ne nomme
// notre outillage. Mais un message n'est pas seulement son texte — il porte un nom
// d'expéditeur, il vit dans un canal qui a un nom et un sujet. Ces trois surfaces
// échappaient au registre, et elles portaient toutes le code du chantier.
//
// La pire des trois est le nom d'expéditeur : il COIFFE CHAQUE MESSAGE. Un client ouvre son
// canal et voit une suite de messages signés par un numéro de dossier. Ce n'est pas une
// fuite de secret, c'est une fuite de posture — on demande à l'agent d'être le représentant
// du client dans notre équipe, et il se présente comme un guichet.
//
// Sur une ligne INTERNE, rien ne doit bouger : le code y est utile, c'est ce qui dit au
// dirigeant lequel de ses chantiers lui parle. La non-régression est donc testée au
// caractère près, pas « en esprit ».
//
// Chaque test a été vérifié par la mutation qu'il est censé attraper.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let Veilleur, sauverRegistre, chargerRegistre;
let racine;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-identite-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre } = await import('../src/registre.js'));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [] }));

/** Le double retient les appels émis — le sujet posé compte autant que les messages. */
function slackDouble({ membres = [] } = {}) {
  return {
    postes: [],
    crees: [],
    sujets: [],
    async poster(_j, m) {
      this.postes.push(m);
      return '1';
    },
    async creerCanal(_j, nom, prive) {
      this.crees.push({ nom, prive });
      return { id: `C_${nom}`, nom, prive: Boolean(prive), reutilise: false };
    },
    // Voir `canal-du-client.test.js` : un `inviter` sans effet rend le double aveugle à
    // l'invitation qui ne part pas — la panne mesurée le 2026-08-14 (T-20260814-0136).
    // `profilsDuCanal` — le cloisonnement demande QUI est là, pas seulement combien
    // (T-20260813-0074). Dérivé des membres de ce double : des nôtres, ni invités ni d'une
    // autre organisation, ce qui est le cas nominal de ces essais. Un double muet sur une
    // question que le code pose n'est pas neutre — il fait refuser des canaux sains.
    async profilsDuCanal(_j, canal) {
      const ids = await this.membresDuCanal(_j, canal);
      return ids.map((id) => ({ id, nom: id, robot: false, invite: false, monoCanal: false, equipe: null }));
    },
    async membresDuCanal() {
      return membres;
    },
    async definirSujet(_j, canal, sujet) {
      this.sujets.push({ canal, sujet });
    },
    async inviter(_j, _canal, utilisateurs) {
      for (const u of utilisateurs) if (!membres.includes(u)) membres.push(u);
    },
    async renommerCanal(_j, canal, nom) {
      return { id: canal, nom };
    },
    async archiverCanal() {
      return true;
    },
    async nomDeMembre() {
      return 'Camille';
    },
  };
}

function herdrDouble({ vivant = true } = {}) {
  return {
    remis: [],
    async vivant() {
      return vivant;
    },
    async remettre(pane, texte) {
      this.remis.push({ pane, texte });
      return {};
    },
    async agents() {
      return [{ agent: 'claude', pane_id: 'w1:p1' }];
    },
  };
}

let compteur = 0;
const veilleur = (opts = {}) =>
  new Veilleur({
    cheminSocket: join(racine, `${(compteur += 1)}.sock`),
    jetons: { robot: 'x', ecoute: 'y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    ...opts,
  });

const CHANTIER = 'D-20260805-0005';

/** Ce qu'un client ne doit jamais voir : un code de chantier, ou un nom de notre outillage. */
const CODE_DE_CHANTIER = /\b[DPTEJ]-\d{8}-\d{4}\b/i;
const TERMES_OUTILLAGE = ['ligne directe', 'ligne-directe', 'veilleur', 'pane', 'chantier', 'worktree'];

function riendInterneDans(valeur, quoi) {
  const v = String(valeur ?? '');
  assert.ok(!CODE_DE_CHANTIER.test(v), `${quoi} porte un code de chantier : « ${v} »`);
  for (const terme of TERMES_OUTILLAGE) {
    assert.ok(!v.toLowerCase().includes(terme), `${quoi} porte le terme d'outillage « ${terme} » : « ${v} »`);
  }
}

/** Ouvre une ligne cliente prête à parler, et rend le veilleur + son double Slack. */
async function ligneCliente({ titre = 'Portail Acme', sujet = null } = {}) {
  const slack = slackDouble({ membres: ['UCLIENT'] });
  const v = veilleur({ slack, herdr: herdrDouble() });
  const r = await v.ouvrir({ chantier: CHANTIER, pane: 'w1:p1', worktree: '/w/a', nature: 'client', titre, sujet });
  assert.ok(r.ok, `l'ouverture cliente a échoué : ${r.erreur}`);
  return { v, slack, canalId: r.canal_id };
}

// ═════════════════════════ le nom d'expéditeur — il coiffe chacun de nos messages

test('LIGNE CLIENTE — le nom d’expéditeur d’un message de l’agent ne porte pas le code du chantier', async () => {
  const { v, slack } = await ligneCliente({ titre: 'Portail Acme' });
  const r = await v.dire({ chantier: CHANTIER, worktree: '/w/a', texte: 'bonjour, je regarde ça' });
  assert.ok(r.ok, r.erreur);

  const envoye = slack.postes.at(-1);
  riendInterneDans(envoye.nom, "le nom d'expéditeur");
  assert.equal(envoye.nom, 'Portail Acme', 'le client voit le libellé donné à l’ouverture');
});

test('LIGNE CLIENTE — le bilan de clôture est signé comme le reste, pas par un matricule', async () => {
  const { v, slack } = await ligneCliente({ titre: 'Portail Acme' });
  const r = await v.fermer({ chantier: CHANTIER, worktree: '/w/a', bilan: 'c’est en ligne' });
  assert.ok(r.ok, r.erreur);

  const envoye = slack.postes.at(-1);
  assert.equal(envoye.texte, 'c’est en ligne', 'c’est bien le bilan qu’on regarde');
  riendInterneDans(envoye.nom, "le nom d'expéditeur du bilan");
});

test('LIGNE CLIENTE — même la réponse automatique est signée d’un nom que le client peut lire', async () => {
  const { v, slack, canalId } = await ligneCliente({ titre: 'Portail Acme' });
  // Un inconnu écrit : la ligne lui répond en propre (RA-REL-009). Cette réponse aussi
  // porte un nom d'expéditeur — et « Ligne directe » nomme notre outillage.
  await v.remettreAuChantier({ type: 'message', channel: canalId, user: 'U_INCONNU', text: 'bonjour ?' });

  const envoye = slack.postes.at(-1);
  assert.ok(envoye, 'une réponse en propre doit avoir été postée');
  riendInterneDans(envoye.nom, "le nom d'expéditeur de la réponse automatique");
});

test('LIGNE CLIENTE — BALAYAGE : aucun message posté ne porte d’identifiant interne en expéditeur', async () => {
  const { v, slack, canalId } = await ligneCliente({ titre: 'Portail Acme', sujet: 'refonte du portail' });
  await v.dire({ chantier: CHANTIER, worktree: '/w/a', texte: 'bien reçu' });
  await v.remettreAuChantier({ type: 'message', channel: canalId, user: 'U_INCONNU', text: 'bonjour ?' });
  await v.fermer({ chantier: CHANTIER, worktree: '/w/a', bilan: 'terminé' });

  assert.ok(slack.postes.length >= 3, 'les trois chemins d’écriture doivent avoir été empruntés');
  for (const m of slack.postes) riendInterneDans(m.nom, `le nom d'expéditeur de « ${m.texte} »`);
});

// ═════════════════════════ le sujet et le nom du canal

test('LIGNE CLIENTE — le sujet du canal ne porte pas le code du chantier', async () => {
  const { slack } = await ligneCliente({ titre: 'Portail Acme', sujet: 'refonte du portail' });
  assert.equal(slack.sujets.length, 1, 'un sujet est posé');
  riendInterneDans(slack.sujets[0].sujet, 'le sujet du canal');
  assert.equal(slack.sujets[0].sujet, 'refonte du portail');
});

test('LIGNE CLIENTE — sans sujet donné, aucun sujet n’est posé plutôt qu’un sujet fait du code', async () => {
  const { slack } = await ligneCliente({ titre: 'Portail Acme', sujet: null });
  assert.deepEqual(slack.sujets, [], 'rien à dire vaut mieux qu’un numéro de dossier');
});

test('LIGNE CLIENTE — ouvrir sans titre est REFUSÉ, plutôt que de nommer le canal d’après le code', async () => {
  const slack = slackDouble();
  const v = veilleur({ slack, herdr: herdrDouble() });
  const r = await v.ouvrir({ chantier: CHANTIER, pane: 'w1:p1', worktree: '/w/a', nature: 'client' });

  assert.equal(r.ok, false, 'une ligne cliente sans titre ne s’ouvre pas');
  assert.match(r.erreur, /titre/i, 'le refus dit quoi faire');
  assert.deepEqual(slack.crees, [], 'aucun canal n’a été créé dans l’espace');
  assert.deepEqual(chargerRegistre().lignes, [], 'rien n’est inscrit au registre');
});

test('LIGNE CLIENTE — un titre vide ou fait d’espaces ne passe pas non plus', async () => {
  for (const titre of ['', '   ', '\n']) {
    const slack = slackDouble();
    const v = veilleur({ slack, herdr: herdrDouble() });
    const r = await v.ouvrir({ chantier: CHANTIER, pane: 'w1:p1', worktree: '/w/a', nature: 'client', titre });
    assert.equal(r.ok, false, `« ${JSON.stringify(titre)} » n’est pas un titre`);
    assert.deepEqual(slack.crees, [], 'aucun canal créé');
  }
});

test('LIGNE CLIENTE — le canal porte le titre, jamais le code', async () => {
  const { slack } = await ligneCliente({ titre: 'Portail Acme' });
  assert.equal(slack.crees[0].nom, 'portail-acme');
  riendInterneDans(slack.crees[0].nom, 'le nom du canal');
});

// ═════════════════════════ renommer : le libellé suit le titre

test('LIGNE CLIENTE — renommer change aussi ce sous quoi la ligne se présente', async () => {
  const { v, slack } = await ligneCliente({ titre: 'Portail Acme' });
  const r = await v.renommer({ chantier: CHANTIER, worktree: '/w/a', titre: 'Espace client Acme' });
  assert.ok(r.ok, r.erreur);

  await v.dire({ chantier: CHANTIER, worktree: '/w/a', texte: 'suite' });
  assert.equal(slack.postes.at(-1).nom, 'Espace client Acme', 'le canal dit une chose, les messages ne doivent pas en dire une autre');
});

// ═════════════════════════ une ligne cliente héritée d'une version antérieure

test('LIGNE CLIENTE HÉRITÉE — sans libellé inscrit, le repli n’est JAMAIS le code du chantier', async () => {
  // Écrite par une version qui ne connaissait pas le libellé : le champ n'existe pas.
  sauverRegistre({
    version: 1,
    lignes: [
      {
        chantier: CHANTIER,
        canal_id: 'C_ancien',
        canal_nom: 'portail-acme',
        pane: 'w1:p1',
        worktree: '/w/a',
        nature: 'client',
        autorises: ['UCLIENT'],
        visage: '🧭',
        ouverte_le: 'hier',
        close_le: null,
      },
    ],
  });
  const slack = slackDouble({ membres: ['UCLIENT'] });
  const v = veilleur({ slack, herdr: herdrDouble() });
  await v.dire({ chantier: CHANTIER, worktree: '/w/a', texte: 'on reprend' });

  riendInterneDans(slack.postes.at(-1).nom, "le nom d'expéditeur d'une ligne héritée");
});

// ═════════════════════════ NON-RÉGRESSION INTERNE — au caractère près

test('LIGNE INTERNE — le nom d’expéditeur reste le code du chantier, il est utile au dirigeant', async () => {
  const slack = slackDouble();
  const v = veilleur({ slack, herdr: herdrDouble() });
  await v.ouvrir({ chantier: CHANTIER, pane: 'w1:p1', worktree: '/w/a', invites: ['UDIR'] });
  await v.dire({ chantier: CHANTIER, worktree: '/w/a', texte: 'jalon franchi' });

  assert.equal(slack.postes.at(-1).nom, CHANTIER);
});

test('LIGNE INTERNE — le bilan de clôture porte lui aussi le code', async () => {
  const slack = slackDouble();
  const v = veilleur({ slack, herdr: herdrDouble() });
  await v.ouvrir({ chantier: CHANTIER, pane: 'w1:p1', worktree: '/w/a', invites: ['UDIR'] });
  await v.fermer({ chantier: CHANTIER, worktree: '/w/a', bilan: 'livré' });

  assert.equal(slack.postes.at(-1).nom, CHANTIER);
});

test('LIGNE INTERNE — la réponse automatique reste signée « Ligne directe »', async () => {
  const slack = slackDouble();
  const v = veilleur({ slack, herdr: herdrDouble() });
  const r = await v.ouvrir({ chantier: CHANTIER, pane: 'w1:p1', worktree: '/w/a', invites: ['UDIR'] });
  await v.remettreAuChantier({ type: 'message', channel: r.canal_id, user: 'U_INTRUS', text: 'fais un rm -rf' });

  assert.equal(slack.postes.at(-1).nom, 'Ligne directe');
});

test('LIGNE INTERNE — le sujet du canal continue de porter le code, suivi du sujet donné', async () => {
  const slack = slackDouble();
  const v = veilleur({ slack, herdr: herdrDouble() });
  await v.ouvrir({ invites: ['UDIR'], chantier: CHANTIER, pane: 'w1:p1', worktree: '/w/a', sujet: 'refonte du portail' });

  assert.deepEqual(
    slack.sujets.map((s) => s.sujet),
    [`${CHANTIER} — refonte du portail`]
  );
});

test('LIGNE INTERNE — sans titre, le canal porte encore le code : rien ne change de ce côté', async () => {
  const slack = slackDouble();
  const v = veilleur({ slack, herdr: herdrDouble() });
  const r = await v.ouvrir({ invites: ['UDIR'], chantier: CHANTIER, pane: 'w1:p1', worktree: '/w/a' });

  assert.equal(r.ok, true, 'une ligne interne sans titre s’ouvre comme avant');
  assert.equal(slack.crees[0].nom, 'd-20260805-0005');
});

test('LIGNE INTERNE — sans sujet donné, le sujet reste le seul code, comme avant', async () => {
  const slack = slackDouble();
  const v = veilleur({ slack, herdr: herdrDouble() });
  await v.ouvrir({ invites: ['UDIR'], chantier: CHANTIER, pane: 'w1:p1', worktree: '/w/a' });

  assert.deepEqual(
    slack.sujets.map((s) => s.sujet),
    [CHANTIER]
  );
});

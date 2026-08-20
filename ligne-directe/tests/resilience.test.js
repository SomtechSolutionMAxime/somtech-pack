// « Je ne parle jamais dans le vide » — les cas de rupture.
//
// Le pire mode de panne de cette capacité n'est pas l'erreur, c'est le SILENCE : le
// dirigeant écrit, rien ne se passe, et rien ne le lui dit. Chaque cas ci-dessous est une
// façon d'échouer sans bruit, et chacun doit produire une réponse observable.
//
// Slack et herdr sont remplacés par des doubles : on ne va pas tuer un vrai agent et
// attendre qu'un humain écrive pour vérifier qu'on lui répond.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let Veilleur, sauverRegistre, chargerRegistre, ligneParCanal, lignesOuvertes;

before(async () => {
  // Doit précéder l'import : les chemins du registre sont figés au chargement du module.
  process.env.LIGNE_DIRECTE_RACINE = mkdtempSync(join(tmpdir(), 'ld-resilience-'));
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre, ligneParCanal, lignesOuvertes } = await import('../src/registre.js'));
});

/** Slack de laboratoire : retient ce qui a été posté et archivé. */
function slackDouble() {
  return {
    postes: [],
    archives: [],
    async poster(_jeton, { canal, texte, nom }) {
      this.postes.push({ canal, texte, nom });
      return '1.0';
    },
    async archiverCanal(_jeton, canal) {
      this.archives.push(canal);
      return true;
    },
    async creerCanal(_jeton, nom) {
      return { id: `C_${nom}`, nom, reutilise: false };
    },
    // Un canal sans ligne au registre n'est plus traité pareil selon sa nature : PUBLIC on se
    // tait, PRIVÉ on répond (c'est le canal d'un client dont la ligne s'est perdue). Sans
    // cette réponse, le test ci-dessous passerait au vert par accident — le veilleur se
    // taisant faute d'avoir pu classer le canal, et non parce qu'il l'a jugé public.
    async infoCanal(_jeton, canal) {
      return { id: canal, nom: canal.replace(/^C_/, ''), prive: false, archive: false };
    },
    async definirSujet() {},
    // Voir `faux-temoins.test.js` : l'invitation doit avoir un effet observable (T-20260814-0136).
    membres: [],
    // `profilsDuCanal` — le cloisonnement demande QUI est là, pas seulement combien
    // (T-20260813-0074). Dérivé des membres de ce double : des nôtres, ni invités ni d'une
    // autre organisation, ce qui est le cas nominal de ces essais. Un double muet sur une
    // question que le code pose n'est pas neutre — il fait refuser des canaux sains.
    async profilsDuCanal(_j, canal) {
      const ids = await this.membresDuCanal(_j, canal);
      return ids.map((id) => ({ id, nom: id, robot: false, invite: false, monoCanal: false, equipe: null }));
    },
    async membresDuCanal() {
      return this.membres;
    },
    async inviter(_j, _canal, utilisateurs) {
      for (const u of utilisateurs) if (!this.membres.includes(u)) this.membres.push(u);
    },
    async ouvrirEcoute() {
      return 'wss://exemple.invalide';
    },
  };
}

/** herdr de laboratoire : on décide qui est vivant et si la remise réussit. */
function herdrDouble({ vivants = [], remiseEchoue = null } = {}) {
  return {
    remis: [],
    async vivant(pane) {
      return vivants.includes(pane);
    },
    async remettre(pane, texte) {
      if (remiseEchoue) throw new Error(remiseEchoue);
      this.remis.push({ pane, texte });
      return { submitted: true };
    },
    async agents() {
      return vivants.map((p) => ({ agent: 'claude', pane_id: p }));
    },
    // ⚠️ LA SECONDE SOURCE DÉRIVE DE LA MÊME VÉRITÉ QUE LA PREMIÈRE (T-20260820-0022).
    // Depuis que la ronde ne ferme que sur DISPARITION POSITIVE, elle consulte le registre ET
    // la liste des panes : un double muet sur la seconde ferait reporter toutes les rondes, et
    // ces essais passeraient en n'éprouvant plus rien. Un pane « disparu » de ce test l'est
    // donc des deux côtés — le scénario est intact, le double a juste cessé d'être plus pauvre
    // que le service qu'il remplace.
    async panes() {
      return {
        panes: vivants.map((p) => ({ pane_id: p, agent_session: { agent: 'claude' } })),
        sessionsInterrogees: 1,
        sessionsRefusees: [],
      };
    },
  };
}

function ligne(sur = {}) {
  return {
    chantier: 'D-20260805-0004',
    canal_id: 'C1',
    canal_nom: 'd-20260805-0004',
    pane: 'w1:p1',
    worktree: '/w/a',
    visage: '🧭',
    ouverte_le: '2026-08-05T00:00:00.000Z',
    close_le: null,
    ...sur,
  };
}

function veilleurAvec({ lignes = [], slack, herdr }) {
  sauverRegistre({ version: 1, lignes });
  return new Veilleur({
    jetons: { robot: 'x', ecoute: 'y' },
    identite: { equipe: 'Test', utilisateur: 'UMOI', robot: 'BMOI' },
    slack,
    herdr,
  });
}

/** Une parole du dirigeant dans un canal. */
const parole = (canal, texte, sur = {}) => ({ type: 'message', channel: canal, user: 'UDIR', text: texte, ...sur });

beforeEach(() => sauverRegistre({ version: 1, lignes: [] }));

test('le cas nominal : la parole du dirigeant arrive dans le pane de son agent', async () => {
  const s = slackDouble();
  const h = herdrDouble({ vivants: ['w1:p1'] });
  const v = veilleurAvec({ lignes: [ligne()], slack: s, herdr: h });

  await v.remettreAuChantier(parole('C1', "L'option B, et n'attends pas."));

  assert.equal(h.remis.length, 1);
  // Apostrophes intactes : aucun shell n'est impliqué dans la remise. La parole est
  // ENCADRÉE (voir plus bas) mais jamais altérée — d'où le `includes` plutôt qu'un `equal`.
  assert.ok(h.remis[0].texte.includes("L'option B, et n'attends pas."));
  assert.equal(s.postes.length, 0, 'rien à répondre quand la remise réussit');
});

test('UNE LIGNE CLOSE RÉPOND — elle n’avale pas le message', async () => {
  const s = slackDouble();
  const h = herdrDouble({ vivants: ['w1:p1'] });
  const v = veilleurAvec({ lignes: [ligne({ close_le: '2026-08-06T12:00:00.000Z' })], slack: s, herdr: h });

  await v.remettreAuChantier(parole('C1', 'tu es là ?'));

  assert.equal(h.remis.length, 0, 'rien ne doit être remis sur une ligne close');
  assert.equal(s.postes.length, 1, 'le dirigeant doit recevoir une réponse');
  assert.match(s.postes[0].texte, /close/i);
  assert.equal(s.postes[0].nom, 'Ligne directe', "le veilleur parle en son nom, pas sous l'identité d'un agent parti");
});

test('UN AGENT DISPARU : la ligne se referme et le dirigeant l’apprend', async () => {
  const s = slackDouble();
  const h = herdrDouble({ vivants: [] }); // le pane a été fermé
  const v = veilleurAvec({ lignes: [ligne()], slack: s, herdr: h });

  await v.remettreAuChantier(parole('C1', 'où en es-tu ?'));

  assert.equal(h.remis.length, 0);
  assert.equal(s.postes.length, 1);
  assert.match(s.postes[0].texte, /n'est plus là|nest plus la/i);
  assert.equal(lignesOuvertes(chargerRegistre()).length, 0, 'la ligne doit être close sur disque, pas seulement en mémoire');
});

test('UNE REMISE QUI ÉCHOUE se dit — elle ne passe pas pour un succès', async () => {
  const s = slackDouble();
  const h = herdrDouble({ vivants: ['w1:p1'], remiseEchoue: 'agent_not_found' });
  const v = veilleurAvec({ lignes: [ligne()], slack: s, herdr: h });

  await v.remettreAuChantier(parole('C1', 'coucou'));

  assert.equal(s.postes.length, 1);
  assert.match(s.postes[0].texte, /agent_not_found/);
  // La ligne reste ouverte : l'agent est là, c'est la remise qui a échoué. La refermer
  // ferait perdre le canal pour une panne peut-être passagère.
  assert.equal(lignesOuvertes(chargerRegistre()).length, 1);
});

test('nos propres messages ne repartent pas dans la boucle', async () => {
  const s = slackDouble();
  const h = herdrDouble({ vivants: ['w1:p1'] });
  const v = veilleurAvec({ lignes: [ligne()], slack: s, herdr: h });

  // Un message posté par le robot porte un bot_id : sans ce garde-fou, chaque réponse du
  // veilleur relancerait une remise, qui relancerait une réponse.
  await v.surMessage({ data: JSON.stringify({ type: 'events_api', payload: { event: parole('C1', 'ma propre réponse', { bot_id: 'BMOI' }) } }) }, { send() {} });
  // Idem pour un message envoyé par l'utilisateur du robot lui-même.
  await v.surMessage({ data: JSON.stringify({ type: 'events_api', payload: { event: parole('C1', 'moi encore', { user: 'UMOI' }) } }) }, { send() {} });
  // Et une entrée dans le canal n'est pas une parole.
  await v.surMessage({ data: JSON.stringify({ type: 'events_api', payload: { event: parole('C1', 'a rejoint', { subtype: 'channel_join' }) } }) }, { send() {} });

  assert.equal(h.remis.length, 0);
  assert.equal(s.postes.length, 0);
});

test('chaque enveloppe reçue est acquittée, sinon Slack la rejoue indéfiniment', async () => {
  const s = slackDouble();
  const h = herdrDouble({ vivants: ['w1:p1'] });
  const v = veilleurAvec({ lignes: [ligne()], slack: s, herdr: h });
  const envoyes = [];

  await v.surMessage(
    { data: JSON.stringify({ type: 'events_api', envelope_id: 'E1', payload: { event: parole('C1', 'salut') } }) },
    { send: (m) => envoyes.push(JSON.parse(m)) }
  );

  assert.deepEqual(envoyes, [{ envelope_id: 'E1' }]);
  assert.equal(h.remis.length, 1);
});

test('un message dans un canal PUBLIC qui ne nous regarde pas est ignoré sans bruit', async () => {
  // La contrepartie du huitième chemin : notre robot figure dans des canaux d'équipe. Y
  // répondre à chaque message ferait de la ligne un importun. C'est la NATURE du canal qui
  // tranche — public, on se tait ; privé, c'est un client qu'on ne laisse pas sans réponse.
  const s = slackDouble();
  const h = herdrDouble({ vivants: ['w1:p1'] });
  const v = veilleurAvec({ lignes: [ligne()], slack: s, herdr: h });

  await v.remettreAuChantier(parole('C_AUTRE', 'discussion sans rapport'));

  assert.equal(h.remis.length, 0);
  assert.equal(s.postes.length, 0, 'on ne répond pas dans un canal dont on n’a pas la charge');
});

test('AU REDÉMARRAGE DU POSTE : les lignes dont l’agent a disparu sont refermées, les autres reprennent', async () => {
  const s = slackDouble();
  const h = herdrDouble({ vivants: ['w2:p2'] }); // seul le second agent a survécu
  const v = veilleurAvec({
    // `jetable` : depuis T-20260814-0085 une ligne durable garde son canal à la fermeture.
    // Cet essai éprouve le BALAYAGE, donc il monte la ligne où l'archivage s'exerce encore.
    lignes: [ligne({ canal_id: 'C1', pane: 'w1:p1', jetable: true }), ligne({ canal_id: 'C2', canal_nom: 'autre', pane: 'w2:p2', worktree: '/w/b' })],
    slack: s,
    herdr: h,
  });

  await v.reconcilier();

  const apres = chargerRegistre();
  assert.equal(ligneParCanal(apres, 'C1').close_le !== null, true, 'la ligne orpheline doit être close');
  assert.equal(ligneParCanal(apres, 'C2').close_le, null, 'la ligne encore tenue doit rester ouverte');
  assert.deepEqual(s.archives, ['C1'], 'seul le canal orphelin est archivé');
  assert.equal(s.postes.length, 1, 'le dirigeant apprend que cette ligne se referme');
});

test('le bilan de clôture part AVANT l’archivage — un canal archivé est en lecture seule', async () => {
  const s = slackDouble();
  const ordre = [];
  s.poster = async (_j, { canal, texte }) => {
    ordre.push(`poste:${canal}`);
    s.postes.push({ canal, texte });
    return '1.0';
  };
  s.archiverCanal = async (_j, canal) => {
    ordre.push(`archive:${canal}`);
    return true;
  };
  // Ligne jetable : c'est le seul cas où l'archivage a encore lieu, donc le seul où son
  // ORDRE vis-à-vis du bilan se mesure (T-20260814-0085).
  const v = veilleurAvec({ lignes: [ligne({ jetable: true })], slack: s, herdr: herdrDouble({ vivants: ['w1:p1'] }) });

  await v.fermer({ chantier: 'D-20260805-0004', worktree: '/w/a', bilan: 'livré' });

  assert.deepEqual(ordre, ['poste:C1', 'archive:C1'], "l'inverse perdrait le bilan sans rien dire");
});

test('un geste sur une ligne inexistante échoue clairement au lieu de faire semblant', async () => {
  const v = veilleurAvec({ lignes: [], slack: slackDouble(), herdr: herdrDouble() });

  const r = await v.dire({ chantier: 'D-INCONNU', worktree: '/w/a', texte: 'coucou' });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /aucune ligne ouverte/);
});

test('rouvrir une ligne existante la reprend et met à jour le pane', async () => {
  const v = veilleurAvec({ lignes: [ligne()], slack: slackDouble(), herdr: herdrDouble() });

  // Un agent relancé dans la même copie de travail naît dans un pane neuf : sans cette
  // mise à jour, le dirigeant écrirait vers un pane mort.
  const r = await v.ouvrir({ invites: ['UDIR'], chantier: 'D-20260805-0004', pane: 'w9:p9', worktree: '/w/a' });

  assert.equal(r.ok, true);
  assert.equal(r.reprise, true);
  assert.equal(ligneParCanal(chargerRegistre(), 'C1').pane, 'w9:p9');
});

// —————————————————————————————————————————————————————————————————————————————————
// Le cadre du message remis.
//
// Défaut trouvé à l'usage, pas au design : le premier échange réel a bien traversé le
// pont, mais l'agent a répondu DANS SON TERMINAL. Côté dirigeant : rien. Il a conclu que
// son message n'était jamais arrivé — alors qu'il avait été remis et lu.

test('LA PAROLE REMISE PORTE SON CADRE — sinon l’agent répond dans le vide', async () => {
  const s = slackDouble();
  const h = herdrDouble({ vivants: ['w1:p1'] });
  const v = veilleurAvec({ lignes: [ligne()], slack: s, herdr: h });

  await v.remettreAuChantier(parole('C1', "L'option B."));

  const remis = h.remis[0].texte;
  assert.match(remis, /LIGNE DIRECTE/, "l'agent doit savoir que ce message ne vient pas de son terminal");
  assert.match(remis, /D-20260805-0004/, 'le chantier concerné doit être nommé');
  assert.ok(remis.includes("L'option B."), 'la parole du dirigeant doit rester intacte dans le cadre');
  assert.match(remis, /ligne-directe\.js" dire/, 'la commande de réponse doit être donnée, pas évoquée');
  assert.match(remis, /il ne le voit pas/, "l'agent doit savoir que son terminal ne répond à personne");
});

test('le cadre ne dénature pas la parole : apostrophes, retours à la ligne, accents', async () => {
  const s = slackDouble();
  const h = herdrDouble({ vivants: ['w1:p1'] });
  const v = veilleurAvec({ lignes: [ligne()], slack: s, herdr: h });
  const parolePiegee = "Vas-y, mais n'oublie pas :\n- l'accès\n- la clôture";

  await v.remettreAuChantier(parole('C1', parolePiegee));

  assert.ok(h.remis[0].texte.includes(parolePiegee), 'la parole doit traverser mot pour mot');
});

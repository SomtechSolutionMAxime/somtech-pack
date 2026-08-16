// La NATURE d'une ligne — interne (le dirigeant) ou client (les gens d'un client) — et les
// deux choses qu'elle commande : la confidentialité du canal, et qui a le droit d'y écrire.
//
// Les deux défauts couverts ici n'échouaient ni l'un ni l'autre de façon visible :
//   1. le veilleur ne créait que des canaux PUBLICS, et le nom seul d'un canal expose le
//      portefeuille client ;
//   2. la ligne ne remettait un message que s'il venait d'un inscrit — et l'inscrit, c'est
//      le dirigeant. Le premier message d'un client était écarté EN SILENCE.
//
// Chaque test ci-dessous a été vérifié par la mutation qu'il est censé attraper : on casse
// volontairement ce qu'il couvre, on le voit rougir, on répare. Un test qui survit à sa
// propre mutation est à réécrire, pas à garder.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let Veilleur, sauverRegistre, chargerRegistre, CHEMIN_JOURNAL;
let racine;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-nature-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre, CHEMIN_JOURNAL } = await import('../src/registre.js'));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [] }));

/**
 * Le double de Slack retient les APPELS RÉELLEMENT ÉMIS, pas seulement leurs effets.
 * C'est le seul moyen de prouver qu'un canal client naît privé : côté registre, un canal
 * public et un canal privé se ressemblent trait pour trait.
 */
function slackDouble({ membres = [], membresIllisibles = false, rendPrive = null } = {}) {
  return {
    postes: [],
    crees: [],
    membresDemandes: [],
    async poster(_j, m) {
      this.postes.push(m);
      return '1';
    },
    async creerCanal(_j, nom, prive) {
      this.crees.push({ nom, prive });
      // `rendPrive` simule un Slack qui ne rend PAS ce qu'on lui a demandé. Le double
      // rendait jusqu'ici la confidentialité voulue plutôt que la confidentialité réelle —
      // c'est-à-dire qu'il prouvait l'intention, pas le résultat.
      return { id: `C_${nom}`, nom, prive: rendPrive === null ? Boolean(prive) : rendPrive, reutilise: false };
    },
    // `profilsDuCanal` — le cloisonnement demande QUI est là, pas seulement combien
    // (T-20260813-0074). Dérivé des membres de ce double : des nôtres, ni invités ni d'une
    // autre organisation, ce qui est le cas nominal de ces essais. Un double muet sur une
    // question que le code pose n'est pas neutre — il fait refuser des canaux sains.
    async profilsDuCanal(_j, canal) {
      const ids = await this.membresDuCanal(_j, canal);
      return ids.map((id) => ({ id, nom: id, robot: false, invite: false, monoCanal: false, equipe: null }));
    },
    async membresDuCanal(_j, canal) {
      this.membresDemandes.push(canal);
      if (membresIllisibles) throw new Error('missing_scope');
      return membres;
    },
    async definirSujet() {},
    // Voir `canal-du-client.test.js` : l'invitation doit avoir un effet observable, sinon la
    // preuve par les membres ne prouve rien du tout (T-20260814-0136).
    async inviter(_j, _canal, utilisateurs) {
      for (const u of utilisateurs) if (!membres.includes(u)) membres.push(u);
    },
    async archiverCanal() {
      return true;
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

const ligne = (sur = {}) => ({
  chantier: 'D-1',
  canal_id: 'C1',
  canal_nom: 'd-1',
  pane: 'w1:p1',
  worktree: '/w/a',
  visage: '🧭',
  ouverte_le: 'hier',
  close_le: null,
  herdr_socket: null,
  ...sur,
});

const parole = (texte, sur = {}) => ({ type: 'message', channel: 'C1', user: 'UDIR', text: texte, ...sur });

const journal = () => (existsSync(CHEMIN_JOURNAL) ? readFileSync(CHEMIN_JOURNAL, 'utf8') : '');

// ═══════════════════════════════════ T-20260806-0016 — la nature, et le canal privé

test('UNE LIGNE CLIENT CRÉE UN CANAL PRIVÉ — vérifié sur l’appel émis vers Slack', async () => {
  // Le nom seul d'un canal public expose le portefeuille client à quiconque a un compte
  // chez nous. Assertion portée sur l'APPEL, pas sur le registre : un registre qui note
  // « client » pendant que Slack crée un canal public serait le pire des deux mondes.
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble() });

  // `titre` est exigé depuis T-20260806-0105 : sans lui le canal porterait le code du
  // chantier, que le client verrait dans sa barre latérale. Il ne change rien à ce que ce
  // test prouve — la confidentialité de l'appel émis.
  const r = await v.ouvrir({ chantier: 'D-CLIENT', pane: 'w1:p1', worktree: '/w/a', nature: 'client', titre: 'Acme' });

  assert.equal(r.ok, true);
  assert.equal(s.crees.length, 1);
  assert.equal(s.crees[0].prive, true, 'un canal client doit naître privé');
  assert.equal(r.nature, 'client');
  assert.equal(chargerRegistre().lignes[0].nature, 'client');
});

test('NON-RÉGRESSION — une ligne sans nature déclarée reste interne ET publique', async () => {
  // Quatre lignes tournent en production sur le poste du dirigeant pendant ce travail,
  // dont celle du coordonnateur de ce chantier. Aucune ne déclare de nature.
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble() });

  const r = await v.ouvrir({ invites: ['UDIR'], chantier: 'D-INTERNE', pane: 'w1:p1', worktree: '/w/a' });

  assert.equal(r.ok, true);
  assert.notEqual(s.crees[0].prive, true, 'une ligne sans nature ne doit surtout pas devenir privée');
  assert.equal(chargerRegistre().lignes[0].nature, 'interne');
});

test('une nature inconnue est REFUSÉE, pas rabattue en silence sur « interne »', async () => {
  // `--nature cliet` créerait un canal PUBLIC pour un client, et rien ne le dirait. Le
  // rabattement silencieux est exactement le mode de panne que ce chantier combat.
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble() });

  const r = await v.ouvrir({ invites: ['UDIR'], chantier: 'D-1', pane: 'w1:p1', worktree: '/w/a', nature: 'cliet' });

  assert.equal(r.ok, false);
  assert.match(r.erreur, /nature/i);
  assert.match(r.erreur, /client/, 'le message doit nommer les natures admises');
  assert.equal(s.crees.length, 0, 'aucun canal ne doit avoir été créé');
});

test('rouvrir une ligne en changeant sa nature est REFUSÉ — un canal ne change pas de nature', async () => {
  // Un canal public déjà créé ne devient pas privé parce qu'on le rouvre en disant
  // « client » : Slack garde le canal tel quel. Accepter ici inscrirait « client » au
  // registre sur un canal resté visible de tout l'espace.
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble() });
  await v.ouvrir({ invites: ['UDIR'], chantier: 'D-1', pane: 'w1:p1', worktree: '/w/a' });

  const r = await v.ouvrir({ chantier: 'D-1', pane: 'w2:p2', worktree: '/w/a', nature: 'client' });

  assert.equal(r.ok, false);
  assert.match(r.erreur, /nature/i);
  assert.equal(chargerRegistre().lignes[0].nature, 'interne', 'la nature inscrite ne doit pas avoir bougé');
});

// ————————————————————— relevé en revue : le canal REPRIS gardait sa confidentialité à lui

test('UNE LIGNE CLIENT NE S’INSTALLE PAS DANS UN CANAL PUBLIC EXISTANT', async () => {
  // LE BLOQUANT de la revue, et c'est le défaut que tout cet epic existe pour supprimer.
  //
  // Le nom du canal vient du `--titre`. Une ligne client titrée du nom de son client tombe
  // très naturellement sur un canal public homonyme déjà présent dans l'espace. La reprise
  // rendait alors ce canal tel quel : registre marqué « client », canal resté PUBLIC, et
  // l'autorisation-par-appartenance ouvrant la ligne à quiconque peut y entrer. Les deux
  // défauts d'un coup — portefeuille exposé ET autorisation grande ouverte — en silence.
  const { ConfidentialiteIncompatible } = await import('../src/slack.js');
  const s = slackDouble();
  s.creerCanal = async (_j, nom, prive) => {
    s.crees.push({ nom, prive });
    throw new ConfidentialiteIncompatible(nom, prive, false); // homonyme public déjà là
  };
  const v = veilleur({ slack: s, herdr: herdrDouble() });

  const r = await v.ouvrir({ chantier: 'D-1', pane: 'w1:p1', worktree: '/w/a', titre: 'Acme', nature: 'client' });

  assert.equal(r.ok, false);
  assert.match(r.erreur, /public/i, 'le refus doit dire ce qui cloche');
  assert.equal(chargerRegistre().lignes.length, 0, 'AUCUNE ligne ne doit être inscrite sur un canal public');
});

test('la couche Slack REFUSE la reprise avant de rejoindre le canal — on ne s’installe pas où on va refuser', async () => {
  // Le refus doit tomber AVANT `conversations.unarchive` et `conversations.join` : sinon le
  // robot entre dans un canal public du client, y reste, et l'échec laisse une trace visible
  // de tout l'espace.
  const { creerCanal, ConfidentialiteIncompatible } = await import('../src/slack.js');
  const vraiFetch = globalThis.fetch;
  const methodes = [];
  globalThis.fetch = async (url) => {
    const methode = String(url).split('/').pop();
    methodes.push(methode);
    if (methode === 'conversations.create') {
      return { status: 200, headers: new Map(), async json() { return { ok: false, error: 'name_taken' }; } };
    }
    if (methode === 'conversations.list') {
      return {
        status: 200,
        headers: new Map(),
        async json() {
          return { ok: true, channels: [{ id: 'C_PUB', name: 'acme', is_private: false, is_archived: true }] };
        },
      };
    }
    return { status: 200, headers: new Map(), async json() { return { ok: true }; } };
  };
  try {
    await assert.rejects(() => creerCanal('jeton', 'acme', true), (err) => {
      assert.ok(err instanceof ConfidentialiteIncompatible);
      assert.equal(err.reelle, false);
      assert.equal(err.demandee, true);
      return true;
    });
    assert.ok(!methodes.includes('conversations.join'), 'on ne rejoint pas un canal qu’on refuse');
    assert.ok(!methodes.includes('conversations.unarchive'), 'on ne désarchive pas un canal qu’on refuse');
  } finally {
    globalThis.fetch = vraiFetch;
  }
});

test('la couche Slack rend la confidentialité RÉELLE du canal, pas celle qu’on espérait', async () => {
  // C'est le fait que jetait l'ancienne reprise. Sans lui, aucun verrou en amont ne peut
  // être écrit : on n'a rien à comparer.
  const { creerCanal } = await import('../src/slack.js');
  const vraiFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 200,
    headers: new Map(),
    async json() {
      return { ok: true, channel: { id: 'C1', name: 'acme', is_private: true } };
    },
  });
  try {
    assert.equal((await creerCanal('jeton', 'acme', true)).prive, true);
  } finally {
    globalThis.fetch = vraiFetch;
  }
});

test('SI SLACK REND UN CANAL PUBLIC ALORS QU’ON EN DEMANDAIT UN PRIVÉ, la ligne n’ouvre pas', async () => {
  // Le second verrou, et il n'est pas redondant : le premier protège la REPRISE d'un
  // homonyme, celui-ci la CRÉATION. Un droit manquant ou une politique d'espace de travail
  // peut rendre un canal public sans que Slack s'en plaigne. Inscrire « client » sans
  // vérifier, c'est signer une garantie qu'on n'a pas.
  const s = slackDouble({ rendPrive: false });
  const v = veilleur({ slack: s, herdr: herdrDouble() });

  const r = await v.ouvrir({ chantier: 'D-1', pane: 'w1:p1', worktree: '/w/a', nature: 'client', titre: 'Acme' });

  assert.equal(r.ok, false);
  assert.match(r.erreur, /groups:write|groups:read/, 'le message doit orienter vers la portée manquante');
  assert.equal(chargerRegistre().lignes.length, 0);
});

test('UN REGISTRE ÉCRIT PAR LA VERSION PRÉCÉDENTE se relit et se comporte comme avant', async () => {
  // Format d'avant : aucun champ `nature` nulle part. Le veilleur doit le charger sans
  // erreur ET traiter la ligne comme interne — pas la refuser, pas la traiter comme client
  // (ce qui irait interroger Slack pour des membres qu'un canal public n'autorise pas).
  const s = slackDouble();
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ autorises: ['UDIR'] })] }); // tel quel, sans `nature`
  const v = veilleur({ slack: s, herdr: h });

  await v.remettreAuChantier(parole('on continue'));

  assert.equal(h.remis.length, 1, 'le dirigeant d’une ligne d’avant doit continuer d’être entendu');
  assert.equal(s.membresDemandes.length, 0, 'une ligne d’avant est interne : rien à demander à Slack');
});

// ═══════════════════════════════════ T-20260806-0017 — les gens du client peuvent écrire

test('UNE PERSONNE DU CLIENT, INVITÉE DANS SON CANAL PRIVÉ, ATTEINT L’AGENT', async () => {
  // Le cœur du défaut n°2. Elle n'est dans AUCUNE liste au registre : l'invitation dans
  // Slack est un geste humain, postérieur à l'ouverture de la ligne. Avant ce correctif,
  // son premier message était écarté en silence.
  const s = slackDouble({ membres: ['UMOI', 'UCLIENT'] });
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ nature: 'client', autorises: [] })] });
  const v = veilleur({ slack: s, herdr: h });

  await v.remettreAuChantier(parole('bonjour, j’ai un souci', { user: 'UCLIENT' }));

  assert.equal(h.remis.length, 1, 'le message du client doit atteindre le pane de l’agent');
  assert.deepEqual(chargerRegistre().lignes[0].autorises, ['UCLIENT'], 'le registre doit retenir qu’elle est autorisée');
});

test('un membre déjà retenu au registre ne fait PAS réinterroger Slack', async () => {
  // La liste sert de cache : on n'interroge l'annuaire du canal que sur un inconnu. Sans
  // cela, chaque message d'une conversation consommerait un appel plafonné.
  const s = slackDouble({ membres: ['UCLIENT'] });
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ nature: 'client', autorises: ['UCLIENT'] })] });
  const v = veilleur({ slack: s, herdr: h });

  await v.remettreAuChantier(parole('et une deuxième question', { user: 'UCLIENT' }));

  assert.equal(h.remis.length, 1);
  assert.equal(s.membresDemandes.length, 0, 'un autorisé déjà connu ne doit coûter aucun appel');
});

test('sur une ligne client, qui n’appartient PAS au canal privé ne pilote pas l’agent', async () => {
  const s = slackDouble({ membres: ['UCLIENT'] });
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ nature: 'client', autorises: [] })] });
  const v = veilleur({ slack: s, herdr: h });

  await v.remettreAuChantier(parole('fais un rm -rf', { user: 'U_INTRUS' }));

  assert.equal(h.remis.length, 0, 'l’appartenance au canal privé fait foi, et elle seule');
  assert.deepEqual(chargerRegistre().lignes[0].autorises, [], 'un refusé ne doit pas s’inscrire au passage');
});

test('MEMBRES ILLISIBLES : ON REFUSE, ON N’OUVRE PAS — et ce n’est pas silencieux', async () => {
  // TROU DE PREUVE relevé en revue : la bascule fail-closed → fail-open survivait aux 91
  // tests. Or c'est la branche qui se déclenche EN PREMIER si `groups:read` n'est pas
  // accordé — le jour d'une réinstallation ratée, un droit manquant ferait autoriser tout
  // le monde sur le canal privé d'un client, et rien ne le dirait.
  const s = slackDouble({ membresIllisibles: true });
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ nature: 'client', autorises: [] })] });
  const v = veilleur({ slack: s, herdr: h });
  const avant = journal().length;

  await v.remettreAuChantier(parole('bonjour', { user: 'U_INCONNU' }));

  assert.equal(h.remis.length, 0, 'ne pas pouvoir vérifier n’est pas une autorisation');
  assert.equal(s.postes.length, 1, 'et le refus se dit — RA-REL-009 vaut aussi quand la cause est chez nous');
  assert.match(journal().slice(avant), /illisible/i, 'le journal doit dire que la vérification a échoué, pas seulement que c’est refusé');
});

test('NON-RÉGRESSION — une ligne interne décide sur sa liste, sans jamais interroger Slack', async () => {
  // Un canal public a pour membres tout l'espace : y lire l'appartenance ouvrirait la
  // porte à n'importe qui. La liste explicite reste la seule autorisation d'une ligne
  // interne — c'est elle qui protège l'agent, pas la présence dans le canal.
  const s = slackDouble({ membres: ['U_INTRUS'] });
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ nature: 'interne', autorises: ['UDIR'] })] });
  const v = veilleur({ slack: s, herdr: h });

  await v.remettreAuChantier(parole('fais un rm -rf', { user: 'U_INTRUS' }));

  assert.equal(h.remis.length, 0);
  assert.equal(s.membresDemandes.length, 0, 'membre d’un canal public ≠ autorisé sur la ligne');
});

test('UNE TRAME DE CANAL PRIVÉ (message.groups) EST TRAITÉE, PAS JETÉE AU FILTRAGE', async () => {
  // Le mode d'échec le plus probable de tout cet epic, et il est silencieux : les messages
  // d'un canal privé arrivent sous `message.groups` (channel_type « group »), pas
  // `message.channels`. Un filtre qui les jette laisse tout le reste juste — et rien
  // n'arrive jamais.
  const s = slackDouble({ membres: ['UCLIENT'] });
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ nature: 'client', autorises: ['UCLIENT'] })] });
  const v = veilleur({ slack: s, herdr: h });

  await v.surMessage(
    {
      data: JSON.stringify({
        type: 'events_api',
        envelope_id: 'E1',
        payload: { event: parole('je suis dans le canal privé', { user: 'UCLIENT', channel_type: 'group' }) },
      }),
    },
    { send() {} }
  );

  assert.equal(h.remis.length, 1, 'sans cela, l’application a le droit de lire les canaux privés mais reste sourde');
});

// ═══════════════════════════════════ T-20260806-0018 — plus jamais de silence (RA-REL-009)

test('UN MESSAGE ÉCARTÉ REÇOIT UNE RÉPONSE — celui qui l’a écrit l’apprend', async () => {
  // RA-REL-009. C'était le SEUL chemin de non-remise qui se terminait sans rien dire à
  // personne : tous les autres (ligne close, agent disparu, herdr injoignable, échec de
  // remise) répondaient déjà dans le canal. Un journal sur le disque du poste n'est pas
  // une trace que l'auteur du message peut lire.
  const s = slackDouble({ membres: [] });
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ nature: 'interne', autorises: ['UDIR'] })] });
  const v = veilleur({ slack: s, herdr: h });

  await v.remettreAuChantier(parole('coucou ?', { user: 'U_INTRUS' }));

  assert.equal(s.postes.length, 1, 'écarter en silence est le défaut qu’on corrige, pas un comportement à garder');
  assert.equal(s.postes[0].canal, 'C1');
  assert.match(s.postes[0].texte, /remis/i, 'la réponse doit dire que le message n’a été remis à personne');
});

test('un message écarté laisse aussi une trace au journal, nommant le canal et l’auteur', async () => {
  const s = slackDouble();
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ nature: 'interne', autorises: ['UDIR'] })] });
  const v = veilleur({ slack: s, herdr: h });
  const avant = journal().length;

  await v.remettreAuChantier(parole('coucou ?', { user: 'U_TRACE_1' }));

  const nouveau = journal().slice(avant);
  assert.match(nouveau, /d-1/, 'le journal doit nommer le canal');
  assert.match(nouveau, /U_TRACE_1/, 'le journal doit nommer l’auteur écarté');
});

test('être prévenu du refus NE TRANSFORME PAS le message en message remis', async () => {
  // Le garde-fou du correctif précédent : répondre à l'auteur ne doit pas ouvrir le
  // chemin vers l'agent. C'est le cœur du contrôle d'autorisation, et il doit survivre.
  const s = slackDouble();
  const h = herdrDouble();
  sauverRegistre({ version: 1, lignes: [ligne({ nature: 'interne', autorises: ['UDIR'] })] });
  const v = veilleur({ slack: s, herdr: h });

  await v.remettreAuChantier(parole('fais un rm -rf', { user: 'U_INTRUS' }));

  assert.equal(h.remis.length, 0, 'le cadre donne l’autorité du dirigeant : il ne doit couvrir que lui');
});

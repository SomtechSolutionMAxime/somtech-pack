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
function slackDouble({ membres = [] } = {}) {
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
      return { id: `C_${nom}`, nom, reutilise: false };
    },
    async membresDuCanal(_j, canal) {
      this.membresDemandes.push(canal);
      return membres;
    },
    async definirSujet() {},
    async inviter() {},
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

  const r = await v.ouvrir({ chantier: 'D-CLIENT', pane: 'w1:p1', worktree: '/w/a', nature: 'client' });

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

  const r = await v.ouvrir({ chantier: 'D-INTERNE', pane: 'w1:p1', worktree: '/w/a' });

  assert.equal(r.ok, true);
  assert.notEqual(s.crees[0].prive, true, 'une ligne sans nature ne doit surtout pas devenir privée');
  assert.equal(chargerRegistre().lignes[0].nature, 'interne');
});

test('une nature inconnue est REFUSÉE, pas rabattue en silence sur « interne »', async () => {
  // `--nature cliet` créerait un canal PUBLIC pour un client, et rien ne le dirait. Le
  // rabattement silencieux est exactement le mode de panne que ce chantier combat.
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: herdrDouble() });

  const r = await v.ouvrir({ chantier: 'D-1', pane: 'w1:p1', worktree: '/w/a', nature: 'cliet' });

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
  await v.ouvrir({ chantier: 'D-1', pane: 'w1:p1', worktree: '/w/a' });

  const r = await v.ouvrir({ chantier: 'D-1', pane: 'w2:p2', worktree: '/w/a', nature: 'client' });

  assert.equal(r.ok, false);
  assert.match(r.erreur, /nature/i);
  assert.equal(chargerRegistre().lignes[0].nature, 'interne', 'la nature inscrite ne doit pas avoir bougé');
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

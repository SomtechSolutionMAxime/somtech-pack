// LE CLOISONNEMENT EN USAGE — à l'ouverture d'une ligne, et avant d'écrire dedans.
//
// (T-20260813-0074 · T-20260814-0142)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CES ESSAIS GARDENT, ET POURQUOI ILS REGARDENT SLACK PLUTÔT QUE LE MESSAGE
//
// Le jugement lui-même est éprouvé à part (`cloisonnement.test.js`), sans transport. Ici on
// éprouve qu'il est BRANCHÉ : que la commande lit vraiment les membres, et que ce qu'elle en
// fait se voit dans l'espace — un canal non créé, un message non posté.
//
// ⚠️ LA PREUVE EST CE QUE LE FAUX SLACK A REÇU, jamais le texte d'un refus. Les deux tickets
// l'exigent en toutes lettres : « par le fait, jamais par le message ».
//
// ⚠️ ET LE CAS NOMINAL DOIT RESTER SILENCIEUX. Dix-huit des vingt et un canaux internes du
// poste ne contiennent que le dirigeant et le robot ; deux en plus portent un collègue. Une
// garde qui parlerait là cesserait d'être lue avant d'avoir servi une fois (RA-REL-008).

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';

let Veilleur, sauverRegistre, chargerRegistre;
let racine;
let compteur = 0;

const UMOI = 'UMOI';
const UDIR = 'UDIR';
const PANE = 'w1:p1';
const EQUIPE = 'T_ESSAIS';
const DIRIGEANT = { id: UDIR, courriel: 'dirigeant@somtech.ca' };

/**
 * Les profils tels que `users.info` les rend — avec les seuls champs que le robot obtient
 * RÉELLEMENT. Pas de `profile.email` : mesuré absent le 2026-08-15, le droit n'est pas accordé.
 * Un double qui en fournirait un serait plus permissif que le service, et rendrait vert un
 * critère qui ne se déclenche jamais en production.
 */
const NOUS = [
  { id: UMOI, name: 'ligne_directe', is_bot: true, team_id: EQUIPE, profile: { display_name: 'ligne_directe' } },
  { id: UDIR, name: 'maxime', team_id: EQUIPE, profile: { display_name: 'maxime.leboeuf' } },
  { id: 'UCOLL', name: 'bruno', team_id: EQUIPE, profile: { display_name: 'Bruno Potvin' } },
];
/** Un client, tel que Slack le marque quand on l'invite : `is_restricted`. */
const CLIENT = { id: 'UCLI', name: 'charles', is_restricted: true, team_id: EQUIPE, profile: { display_name: 'Charles-Olivier' } };
const CLIENT_2 = { id: 'UCLI2', name: 'max-perso', is_restricted: true, is_ultra_restricted: true, team_id: EQUIPE, profile: { display_name: 'Max perso' } };

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-cloison-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre } = await import('../src/registre.js'));
});
after(() => rmSync(racine, { recursive: true, force: true }));
beforeEach(() => sauverRegistre({ version: 1, lignes: [], commun: null, dirigeant: DIRIGEANT }));

function agentsQuiVivent() {
  return {
    async vivant() {
      return true;
    },
    async remettre() {
      return { delivered: true };
    },
    async agents() {
      return [{ agent: 'claude', pane_id: PANE, herdr_socket: null }];
    },
  };
}

async function avecPoste({ canaux = [], utilisateurs = [...NOUS], lignes = [] }, corps) {
  sauverRegistre({ version: 1, lignes, commun: null, dirigeant: DIRIGEANT });
  const monde = fauxSlack({ canaux, utilisateurs, robot: UMOI, espace: EQUIPE }).installer();
  const v = new Veilleur({
    cheminSocket: join(racine, `v-${(compteur += 1)}.sock`),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: EQUIPE, utilisateur: UMOI },
    herdr: agentsQuiVivent(),
  });
  // ⚠️ ON DÉMARRE L'ÉCOUTE LOCALE MÊME SANS S'EN SERVIR : `arreter()` attend la fermeture d'un
  // serveur qui n'existe pas quand on ne l'a jamais ouvert, et sa promesse ne se résout alors
  // JAMAIS — chaque essai de ce fichier a expiré au premier jet. Défaut réel du module, hors du
  // périmètre de ce lot : signalé à part plutôt que corrigé au passage.
  await v.ecouterLocal();
  try {
    return await corps({ monde, veilleur: v });
  } finally {
    await v.arreter();
    monde.restaurer();
  }
}

/** Une ligne déjà ouverte au registre, avec sa photo des membres si on lui en donne une. */
function ligneOuverte({ nature = 'interne', canalId = 'C1', canalNom = 'un-chantier', membresVus } = {}) {
  return {
    chantier: 'j-1',
    canal_id: canalId,
    canal_nom: canalNom,
    pane: PANE,
    worktree: '/w',
    nature,
    libelle: 'j-1',
    autorises: [UDIR],
    ...(membresVus ? { membres_vus: membresVus } : {}),
    pair: null,
    visage: '🧭',
    ouverte_le: 'hier',
    close_le: null,
  };
}

// ═════════════════ 1. T-20260814-0142 — AUCUN CLIENT DANS UN CANAL D'ORCHESTRATEUR

test('OUVRIR UNE LIGNE INTERNE SUR UN CANAL OÙ UN INVITÉ EST PRÉSENT EST REFUSÉ', async () => {
  // La règle du dirigeant, rendue mécanique. Un canal d'orchestrateur porte les arbitrages,
  // les pannes de production, les échéances et les coûts : un client qui y entre lit tout ce
  // que Somtech se dit — sur son dossier et sur d'autres.
  const canal = { id: 'C_dej', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, CLIENT.id] };
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT] }, async ({ monde, veilleur }) => {
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.equal(r.ok, false, 'la ligne ne doit pas s’ouvrir');
    assert.equal(r.refus.motif, 'etranger_dans_le_canal');
    // LA PREUVE EST DANS L'ESPACE : rien n'a été posté dans ce canal.
    assert.deepEqual(monde.postes, [], 'et rien n’y a été écrit');
    assert.deepEqual(chargerRegistre().lignes, [], 'rien n’est inscrit au registre');
  });
});

test('LE REFUS NOMME QUI, ET DIT LA LIMITE DU CRITÈRE — jamais une certitude qu’il n’a pas', async () => {
  const canal = { id: 'C_dej', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, CLIENT.id] };
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT] }, async ({ veilleur }) => {
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.match(r.refus.message, /Charles-Olivier/, 'le refus nomme qui est là');
    assert.match(r.refus.message, /invité|membre plein/i, 'et dit ce que le signal ne sait pas');
  });
});

test('UNE LIGNE INTERNE ENTRE COLLÈGUES S’OUVRE EN SILENCE — le cas des 20 canaux du poste', async () => {
  const canal = { id: 'C_ok', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, 'UCOLL'] };
  await avecPoste({ canaux: [canal] }, async ({ veilleur }) => {
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.equal(r.ok, true, r.refus?.message);
    assert.deepEqual(
      (r.avertissements || []).filter((a) => /invit|étrang/i.test(a)),
      [],
      'et rien à signaler : ce sont des nôtres'
    );
  });
});

test('LE CANAL D’UN CLIENT ACCUEILLE SES INVITÉS SANS BRONCHER — sa protection ne bouge pas', async () => {
  // ⚠️ NE PAS CONFONDRE LES DEUX NATURES. Un canal client EXISTE pour accueillir les gens du
  // client ; y appliquer la garde de la ligne interne fermerait la porte au nez de ceux à qui
  // elle est destinée.
  const canal = { id: 'C_cli', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id, CLIENT_2.id] };
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT, CLIENT_2] }, async ({ veilleur }) => {
    const r = await veilleur.ouvrir({
      chantier: 'acme',
      pane: PANE,
      worktree: '/w',
      nature: 'client',
      titre: 'espace acme',
    });

    assert.equal(r.ok, true, r.refus?.message);
  });
});

// ═════════════════ 2. T-20260813-0074 — L'ARRIVÉE D'UN NOUVEAU, APRÈS COUP

test('LA POSE PHOTOGRAPHIE LES MEMBRES — sans photo, aucune arrivée ne peut se constater', async () => {
  const canal = { id: 'C_cli', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id] };
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT] }, async ({ veilleur }) => {
    await veilleur.ouvrir({ chantier: 'acme', pane: PANE, worktree: '/w', nature: 'client', titre: 'espace acme' });

    const ligne = chargerRegistre().lignes[0];
    assert.deepEqual([...(ligne.membres_vus || [])].sort(), [UMOI, CLIENT.id].sort());
  });
});

test('QUELQU’UN ENTRÉ DEPUIS LA PHOTO EST SIGNALÉ AVANT QU’ON ÉCRIVE — c’est le vrai risque', async () => {
  // Le cas le plus probable, et celui que l'arbitrage vise : on invite quelqu'un des mois plus
  // tard sans se souvenir de ce que le canal porte. On ne prétend PAS savoir que c'est un autre
  // client — on dit que le lectorat a augmenté, ce qui est vérifiable et suffit à faire regarder.
  const canal = { id: 'C1', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id, CLIENT_2.id] };
  const ligne = ligneOuverte({ nature: 'client', canalNom: 'espace-acme', membresVus: [UMOI, CLIENT.id] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT, CLIENT_2], lignes: [ligne] }, async ({ veilleur }) => {
    const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'où en sont les travaux ?', pane: PANE });

    assert.equal(r.ok, true, 'le message part : on signale, on ne bâillonne pas une ligne cliente');
    assert.ok(r.nouveaux_venus?.some((n) => /Max perso/.test(n)), `on doit nommer qui est entré : ${JSON.stringify(r)}`);
  });
});

test('UNE FOIS SIGNALÉ, IL NE L’EST PLUS À CHAQUE MESSAGE — un signal répété devient du bruit', async () => {
  const canal = { id: 'C1', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id, CLIENT_2.id] };
  const ligne = ligneOuverte({ nature: 'client', canalNom: 'espace-acme', membresVus: [UMOI, CLIENT.id] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT, CLIENT_2], lignes: [ligne] }, async ({ veilleur }) => {
    await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'premier', pane: PANE });
    const second = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'second', pane: PANE });

    assert.equal(second.nouveaux_venus, undefined, 'la photo a été reprise : plus personne n’est « nouveau »');
  });
});

test('UN CANAL INCHANGÉ NE DIT RIEN DU TOUT — le cas de tous les messages, tous les jours', async () => {
  const canal = { id: 'C1', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id] };
  const ligne = ligneOuverte({ nature: 'client', canalNom: 'espace-acme', membresVus: [UMOI, CLIENT.id] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT], lignes: [ligne] }, async ({ veilleur }) => {
    const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'bonjour', pane: PANE });

    assert.equal(r.ok, true);
    assert.equal(r.nouveaux_venus, undefined);
  });
});

test('UN ÉTRANGER ENTRÉ DANS UNE LIGNE INTERNE COUPE L’ÉCRITURE — un canal compromis ne s’alimente pas', async () => {
  // T-20260814-0142, point 3 : « l'agent doit cesser d'écrire sur cette ligne et le dire,
  // plutôt que de continuer et d'espérer ». Sur une ligne INTERNE seulement — une ligne cliente
  // accueille les invités, les couper serait fermer la porte au client.
  const canal = { id: 'C1', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, CLIENT.id] };
  const ligne = ligneOuverte({ membresVus: [UMOI, UDIR] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT], lignes: [ligne] }, async ({ monde, veilleur }) => {
    const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'le coût du chantier est de…', pane: PANE });

    assert.equal(r.ok, false, 'on n’écrit pas dans un canal d’orchestrateur où un externe est entré');
    assert.deepEqual(monde.postes, [], 'et LE FAIT : rien n’a été posté');
    assert.match(r.erreur, /Charles-Olivier/, 'le refus nomme qui est là');
  });
});

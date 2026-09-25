// metier-garde-scribe-taches.test.js — le hook `Stop` comme scribe des tâches (T-20260925-0080).
//
// Le défaut que ce lot ferme : un scribe qui n'écrit pas ne produit aucune
// erreur — il produit un SILENCE, et un silence ressemble à « rien à
// signaler ». Ces témoins gardent donc les DEUX sens : le bloc valide écrit ce
// qu'il faut, dans l'ordre, ET tout ce qui n'est pas un bloc valide refuse en
// le NOMMANT — jamais en avalant l'échec.
//
// ⚠️ LE DOUBLE INJECTÉ (`appeler`) EST CONFORME AU RÉEL, MESURÉ AVANT D'ÉCRIRE
// CE FICHIER (lectures MCP du 2026-09-25) : `demands.get` rend `{demand:{...}}`
// SANS clé `success` ; `tickets.get`/`tickets.list` rendent `{success:true,…}` ;
// un code de ticket absent fait JETER le transport réel (le corps d'erreur
// n'est pas du JSON valide côté `transportServiceDesk`), donc le double JETTE
// aussi pour un code inconnu — il ne rend jamais un joli `{success:false}` sur
// ce cas précis, parce que ce n'est pas ce que le vrai fait.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  VERBES_CONNUS, CODE_TICKET, CODE_DEMANDE,
  extraireBloc, analyserBloc, lireCodeDemande,
  purgerHorodatages, jugerPlafond, empreinteBloc,
  preverifierDemande, verifierTicketAppartient, executerEcritures, trouverProchaineTache,
  deciderStop,
} from '../src/metier/gardes/scribe-taches.js';

const BLOC_VALIDE = [
  '```taches',
  'ouvrir: Nettoyer le journal des relances',
  'en-cours: T-20260925-0001',
  'fait: T-20260925-0002 — commentaire de fermeture',
  '```',
].join('\n');

// ═══════════════════════════════════════════════════════════════════════════
// L'EXTRACTION DU BLOC — présence, clôture, unicité.
// ═══════════════════════════════════════════════════════════════════════════

test('aucun bloc `taches` dans le texte → presence:false, jamais une erreur', () => {
  assert.deepEqual(extraireBloc('juste du texte, aucun bloc ici'), { presence: false });
  assert.deepEqual(extraireBloc(''), { presence: false });
  assert.deepEqual(extraireBloc(null), { presence: false });
  assert.deepEqual(extraireBloc(undefined), { presence: false });
});

test('un bloc `taches` qui TERMINE le message (rien que des blancs après) est extrait avec son contenu exact', () => {
  const r = extraireBloc('avant\n```taches\nouvrir: X\n```\n');
  assert.equal(r.presence, true);
  assert.equal(r.ok, true);
  assert.equal(r.contenu.trim(), 'ouvrir: X');
});

test('clôture non fermée (le dernier bloc ouvert n\'a rien après lui) → refus nommé', () => {
  const r = extraireBloc('```taches\nouvrir: X\nplus de fermeture');
  assert.equal(r.presence, true);
  assert.equal(r.ok, false);
  assert.match(r.erreur, /refermé/);
});

// ═══════════════════════════════════════════════════════════════════════════
// D1 — SEUL LE BLOC QUI TERMINE LE MESSAGE COMPTE (revue de fond, T-20260925-0080).
// Un exemple CITÉ (« voici la syntaxe : ```taches...``` ») ne doit jamais créer de
// ticket — silence total, jamais une erreur, jamais un appel.
// ═══════════════════════════════════════════════════════════════════════════

test('un bloc `taches` clos SUIVI de prose (pas seulement des blancs) → presence:false, PAS une erreur — c\'est une citation', () => {
  const r = extraireBloc('avant\n```taches\nouvrir: X\n```\naprès, encore du texte');
  assert.deepEqual(r, { presence: false });
});

test('deux blocs : un cité plus tôt, un terminal → SEUL le terminal est extrait', () => {
  const r = extraireBloc('```taches\nouvrir: CITÉ, ignoré\n```\ntexte entre les deux\n```taches\nouvrir: TERMINAL\n```\n');
  assert.equal(r.presence, true);
  assert.equal(r.ok, true);
  assert.equal(r.contenu.trim(), 'ouvrir: TERMINAL');
});

test('deux blocs, ni l\'un ni l\'autre terminal (prose après le second aussi) → presence:false', () => {
  const r = extraireBloc('```taches\nouvrir: A\n```\ntexte\n```taches\nouvrir: B\n```\nencore du texte après');
  assert.deepEqual(r, { presence: false });
});

test('un bloc terminal précédé d\'un bloc cité NON REFERMÉ → seul le terminal (bien refermé) compte', () => {
  // Le premier bloc n'est même pas syntaxiquement clos ; seul le dernier, qui
  // termine le message, doit être vu.
  const r = extraireBloc('exemple : ```taches\nouvrir sans fermeture ici\n```taches\nouvrir: TERMINAL\n```\n');
  assert.equal(r.presence, true);
  assert.equal(r.ok, true);
  assert.equal(r.contenu.trim(), 'ouvrir: TERMINAL');
});

// ═══════════════════════════════════════════════════════════════════════════
// L'ANALYSE DU BLOC — chaque cas de malformation du point 3 du brief.
// ═══════════════════════════════════════════════════════════════════════════

test('bloc vide → refus nommé', () => {
  const r = analyserBloc('   \n  \n');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /vide/);
});

test('verbe inconnu → refus nommé', () => {
  const r = analyserBloc('fermer: T-20260925-0001');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /verbe inconnu/);
});

test('`fait` sans commentaire (séparateur absent) → refus nommé', () => {
  const r = analyserBloc('fait: T-20260925-0001');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /commentaire/);
});

test('`fait` avec séparateur mais commentaire vide → refus nommé', () => {
  const r = analyserBloc('fait: T-20260925-0001 — ');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /commentaire/);
});

test('`fait` avec code mal formé → refus nommé', () => {
  const r = analyserBloc('fait: T-2026-1 — un commentaire');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /code invalide/);
});

test('`en-cours` avec code mal formé → refus nommé', () => {
  const r = analyserBloc('en-cours: pas-un-code');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /code invalide/);
});

test('`ouvrir` sans titre → refus nommé', () => {
  const r = analyserBloc('ouvrir:   ');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /titre/);
});

test('`attend:` avec une valeur autre que `dirigeant` → refus nommé', () => {
  const r = analyserBloc('attend: quelqu-un-d-autre');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /dirigeant/);
});

test('deux lignes `attend:` dans le même bloc → refus nommé, même si les deux valent « dirigeant »', () => {
  const r = analyserBloc('attend: dirigeant\nattend: dirigeant');
  assert.equal(r.ok, false);
  assert.match(r.erreur, /plusieurs lignes .attend:./);
});

test('ligne non reconnue (pas de « verbe: valeur ») → refus nommé', () => {
  const r = analyserBloc('ceci n\'est pas une ligne de tâche');
  assert.equal(r.ok, false);
});

test('bloc valide complet → analyse structurée exacte', () => {
  const extrait = extraireBloc(BLOC_VALIDE);
  assert.equal(extrait.ok, true);
  const r = analyserBloc(extrait.contenu);
  assert.equal(r.ok, true);
  assert.deepEqual(r.taches, {
    ouvrir: ['Nettoyer le journal des relances'],
    enCours: ['T-20260925-0001'],
    fait: [{ code: 'T-20260925-0002', commentaire: 'commentaire de fermeture' }],
    attend: null,
  });
});

test('VERBES_CONNUS et les regex de code sont ce que l\'analyse emploie réellement', () => {
  assert.deepEqual([...VERBES_CONNUS].sort(), ['attend', 'en-cours', 'fait', 'ouvrir']);
  assert.ok(CODE_TICKET.test('T-20260925-0001'));
  assert.ok(!CODE_TICKET.test('D-20260925-0001'));
  assert.ok(CODE_DEMANDE.test('D-20260925-0001'));
});

// ═══════════════════════════════════════════════════════════════════════════
// LE FICHIER `.demande`
// ═══════════════════════════════════════════════════════════════════════════

test('`.demande` absent (contenu null) → refus nommé', () => {
  const r = lireCodeDemande(null);
  assert.equal(r.ok, false);
  assert.match(r.erreur, /absent ou illisible/);
});

test('`.demande` mal formé (autre chose qu\'un code seul) → refus nommé', () => {
  assert.equal(lireCodeDemande('pas un code').ok, false);
  assert.equal(lireCodeDemande('D-20260925-0003 et un commentaire').ok, false);
  assert.equal(lireCodeDemande('T-20260925-0001').ok, false); // un code de TICKET n'est pas un code de demande
});

test('`.demande` valide, espaces et fin de ligne tolérés', () => {
  const r = lireCodeDemande('  D-20260925-0003  \n');
  assert.equal(r.ok, true);
  assert.equal(r.code, 'D-20260925-0003');
});

// ═══════════════════════════════════════════════════════════════════════════
// LE PLAFOND — garde ①.
// ═══════════════════════════════════════════════════════════════════════════

test('purgerHorodatages retire tout ce qui a plus d\'une heure', () => {
  const maintenant = 1_000_000_000;
  const horodatages = [
    maintenant - 61 * 60 * 1000, // trop vieux
    maintenant - 59 * 60 * 1000, // dans la fenêtre
    maintenant - 1000,           // dans la fenêtre
    maintenant + 5000,           // dans le futur : rejeté aussi (défensif)
  ];
  assert.deepEqual(purgerHorodatages(horodatages, maintenant), [maintenant - 59 * 60 * 1000, maintenant - 1000]);
});

test('purgerHorodatages — borne EXACTE de l\'heure glissante : 3 600 000 ms pile est EXCLU', () => {
  const maintenant = 2_000_000_000;
  const pile = maintenant - 3_600_000;       // exactement une heure : hors fenêtre (< strict)
  const unMsDedans = maintenant - 3_599_999; // un ms de moins : dans la fenêtre
  assert.deepEqual(purgerHorodatages([pile], maintenant), [],
    'un horodatage vieux de PILE une heure doit être purgé — la comparaison est stricte (<)');
  assert.deepEqual(purgerHorodatages([unMsDedans], maintenant), [unMsDedans],
    'un horodatage vieux d\'une heure moins 1 ms doit rester dans la fenêtre');
});

test('N absent ou invalide → aucune relance, et c\'est dit', () => {
  for (const plafondParHeure of [undefined, null, NaN, 0, -1, 'trente']) {
    const v = jugerPlafond({ horodatages: [], maintenant: 1000, plafondParHeure });
    assert.equal(v.autorise, false, `plafondParHeure=${String(plafondParHeure)}`);
    assert.match(v.raison, /absente ou invalide|aucune relance/);
  }
});

test('plafond non atteint → autorise', () => {
  const v = jugerPlafond({ horodatages: [900, 950], maintenant: 1000, plafondParHeure: 30 });
  assert.equal(v.autorise, true);
});

test('plafond atteint → refuse, et le dit avec le compte et le sens (message entrant relance normalement)', () => {
  const maintenant = 1_000_000;
  const horodatages = Array.from({ length: 30 }, (_, i) => maintenant - i * 1000);
  const v = jugerPlafond({ horodatages, maintenant, plafondParHeure: 30 });
  assert.equal(v.autorise, false);
  assert.match(v.raison, /plafond de 30/);
  assert.match(v.raison, /message entrant relance normalement/);
});

// ═══════════════════════════════════════════════════════════════════════════
// LE DOUBLE DU SERVICEDESK — conforme aux formes MESURÉES le 2026-09-25.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit un `appeler` de test, et un journal des appels réellement faits —
 * c'est CE journal que « zéro appel » / « dans l'ordre » examinent, jamais une
 * supposition sur ce que le code aurait dû faire.
 */
function construireAppeler({ demandes = {}, tickets = {}, listePages = [[]], echecs = {} } = {}) {
  const appels = [];
  const appeler = async (nom, args) => {
    appels.push({ nom, args });
    if (echecs[`${nom}:${args.action}:${args.id}`]) throw new Error(echecs[`${nom}:${args.action}:${args.id}`]);

    if (nom === 'demands' && args.action === 'get') {
      const d = demandes[args.id];
      if (!d) throw new Error(`demande « ${args.id} » introuvable (double conforme : le vrai jette sur un code inconnu)`);
      return { demand: d };
    }
    if (nom === 'tickets' && args.action === 'get') {
      const t = tickets[args.id];
      if (!t) throw new Error(`Ticket not found`); // forme mesurée du vrai (erreur non-JSON → transport jette)
      return { success: true, ticket: t };
    }
    if (nom === 'tickets' && args.action === 'list') {
      const page = Math.floor(args.offset / args.limit);
      const items = listePages[page] || [];
      return { success: true, tickets: items, count: listePages.flat().length };
    }
    if (nom === 'tickets' && (args.action === 'create' || args.action === 'update' || args.action === 'add_comment')) {
      return { success: true, ticket: { id: args.id || 'nouveau-uuid' } };
    }
    throw new Error(`appel non modélisé dans le double : ${nom}/${args.action}`);
  };
  return { appeler, appels };
}

const appelerQuiCrieSiAppele = async (nom, args) => {
  throw new Error(`APPEL RÉSEAU INATTENDU : ${nom}/${args?.action} — ce chemin doit rester à zéro appel`);
};

// ═══════════════════════════════════════════════════════════════════════════
// LES FONCTIONS RÉSEAU UNITAIRES
// ═══════════════════════════════════════════════════════════════════════════

test('preverifierDemande — succès sur une demande connue', async () => {
  const { appeler } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T03:36:28.213Z', direct_ticket_count: 3 } },
  });
  const r = await preverifierDemande({ code: 'D-20260925-0003', appeler });
  assert.deepEqual(r, { ok: true, id: 'uuid-demande', createdAt: '2026-09-25T03:36:28.213Z', directTicketCount: 3 });
});

test('preverifierDemande — ServiceDesk injoignable (jette) → refus nommé', async () => {
  const appeler = async () => { throw new Error('HTTP 503'); };
  const r = await preverifierDemande({ code: 'D-20260925-0003', appeler });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /injoignable/);
});

test('preverifierDemande — success:false explicite → refus nommé', async () => {
  const appeler = async () => ({ success: false, error: 'not authorized' });
  const r = await preverifierDemande({ code: 'D-x', appeler });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /refuse/);
});

test('verifierTicketAppartient — ticket d\'une autre demande → refus nommé', async () => {
  const { appeler } = construireAppeler({ tickets: { 'T-20260925-0002': { id: 'uuid-t2', demand_id: 'uuid-AUTRE-demande' } } });
  const r = await verifierTicketAppartient({ code: 'T-20260925-0002', demandeId: 'uuid-demande', appeler });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /n'appartient pas/);
});

test('verifierTicketAppartient — ticket de la bonne demande → ok', async () => {
  const { appeler } = construireAppeler({ tickets: { 'T-20260925-0002': { id: 'uuid-t2', demand_id: 'uuid-demande' } } });
  const r = await verifierTicketAppartient({ code: 'T-20260925-0002', demandeId: 'uuid-demande', appeler });
  assert.deepEqual(r, { ok: true, id: 'uuid-t2' });
});

test('executerEcritures — ordre exact : tous les ouvrir, puis en-cours, puis fait (commentaire puis fermeture)', async () => {
  const { appeler, appels } = construireAppeler();
  const taches = {
    ouvrir: ['Titre A'],
    enCours: ['T-20260925-0001'],
    fait: [{ code: 'T-20260925-0002', commentaire: 'fermé' }],
  };
  const ticketsVerifies = new Map([['T-20260925-0001', 'uuid-1'], ['T-20260925-0002', 'uuid-2']]);
  const r = await executerEcritures({ taches, demandeId: 'uuid-demande', ticketsVerifies, appeler });
  assert.equal(r.toutesReussies, true);
  assert.deepEqual(appels.map((a) => `${a.nom}.${a.args.action}`), [
    'tickets.create', 'tickets.update', 'tickets.add_comment', 'tickets.update',
  ]);
  assert.equal(appels[0].args.title, 'Titre A');
  assert.equal(appels[0].args.demand_id, 'uuid-demande');
  assert.equal(appels[1].args.id, 'uuid-1');
  assert.equal(appels[1].args.status, 'in_progress');
  assert.equal(appels[2].args.id, 'uuid-2');
  assert.equal(appels[2].args.content, 'fermé');
  assert.equal(appels[3].args.id, 'uuid-2');
  assert.equal(appels[3].args.status, 'completed');
});

test('executerEcritures — échec en cours de route : ce qui a été écrit ET ce qui ne l\'a pas été, nommés', async () => {
  let compteur = 0;
  const appeler = async (nom, args) => {
    compteur += 1;
    if (compteur === 2) throw new Error('panne réseau simulée');
    return { success: true };
  };
  const taches = { ouvrir: ['A'], enCours: ['T-20260925-0001'], fait: [{ code: 'T-20260925-0002', commentaire: 'x' }] };
  const ticketsVerifies = new Map([['T-20260925-0001', 'uuid-1'], ['T-20260925-0002', 'uuid-2']]);
  const r = await executerEcritures({ taches, demandeId: 'uuid-demande', ticketsVerifies, appeler });
  assert.equal(r.toutesReussies, false);
  assert.equal(r.ecrits.length, 1, `ecrits: ${JSON.stringify(r.ecrits)}`);
  assert.equal(r.nonEcrits.length, 3, `nonEcrits: ${JSON.stringify(r.nonEcrits)}`);
});

test('executerEcritures — ÉCHEC APPLICATIF (success:false, sans jeter) au milieu du plan : nomme aussi ce qui a été écrit et ce qui ne l\'a pas été', async () => {
  let compteur = 0;
  const appeler = async () => {
    compteur += 1;
    // Le 2e appel « réussit » côté transport (pas de throw) mais le corps porte
    // success:false — c'est L'AUTRE forme d'échec (estEchecApplicatif), distincte
    // du throw réseau du test précédent.
    if (compteur === 2) return { success: false, error: 'refusé par une policy côté serveur' };
    return { success: true };
  };
  const taches = { ouvrir: ['A'], enCours: ['T-20260925-0001'], fait: [{ code: 'T-20260925-0002', commentaire: 'x' }] };
  const ticketsVerifies = new Map([['T-20260925-0001', 'uuid-1'], ['T-20260925-0002', 'uuid-2']]);
  const r = await executerEcritures({ taches, demandeId: 'uuid-demande', ticketsVerifies, appeler });
  assert.equal(r.toutesReussies, false);
  assert.equal(r.ecrits.length, 1, `ecrits: ${JSON.stringify(r.ecrits)}`);
  assert.equal(r.nonEcrits.length, 3, `nonEcrits: ${JSON.stringify(r.nonEcrits)}`);
  assert.match(r.erreur, /refusée par le ServiceDesk/);
  assert.match(r.erreur, /refusé par une policy côté serveur/);
});

test('trouverProchaineTache — comptes cohérents, prochaine tâche triée sequence_order puis created_at', async () => {
  const listePages = [[
    { id: '1', ticket_id: 'T-20260925-0003', title: 'C', status: 'new', demand_id: 'uuid-demande', created_at: '2026-09-25T10:00:00Z', sequence_order: 2 },
    { id: '2', ticket_id: 'T-20260925-0002', title: 'B', status: 'completed', demand_id: 'uuid-demande', created_at: '2026-09-25T09:00:00Z', sequence_order: 1 },
    { id: '3', ticket_id: 'T-20260925-0001', title: 'A', status: 'new', demand_id: 'uuid-demande', created_at: '2026-09-25T08:00:00Z', sequence_order: 1 },
  ]];
  const { appeler } = construireAppeler({ listePages });
  const r = await trouverProchaineTache({
    demandeId: 'uuid-demande', demandeCreatedAt: '2026-09-25T03:36:28Z', directTicketCountAjuste: 3, appeler,
  });
  assert.equal(r.ok, true);
  assert.equal(r.mesureCoherente, true);
  // sequence_order 1 (A, créé le premier) avant sequence_order 1 (aucun autre) avant sequence_order 2 (C) ;
  // « B » est exclue (completed).
  assert.deepEqual(r.tache, { code: 'T-20260925-0001', titre: 'A' });
});

test('trouverProchaineTache — comptes divergents → mesureCoherente:false, aucune tâche', async () => {
  const listePages = [[
    { id: '1', ticket_id: 'T-20260925-0001', title: 'A', status: 'new', demand_id: 'uuid-demande', created_at: '2026-09-25T08:00:00Z', sequence_order: null },
  ]];
  const { appeler } = construireAppeler({ listePages });
  const r = await trouverProchaineTache({
    demandeId: 'uuid-demande', demandeCreatedAt: '2026-09-25T03:36:28Z', directTicketCountAjuste: 5, appeler,
  });
  assert.equal(r.ok, true);
  assert.equal(r.mesureCoherente, false);
  assert.equal(r.trouve, 1);
  assert.equal(r.annonce, 5);
});

// ═══════════════════════════════════════════════════════════════════════════
// L'ORCHESTRATION COMPLÈTE — `deciderStop`, les témoins du brief.
// ═══════════════════════════════════════════════════════════════════════════

test('pas de bloc → silence total, ZÉRO appel réseau, même si la clé/appeler serait joignable', async () => {
  const r = await deciderStop({
    texteAssistant: 'un message ordinaire, sans bloc `taches`',
    contenuDemande: 'D-20260925-0003',
    appeler: appelerQuiCrieSiAppele,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.deepEqual(r, { silence: true, sortie: {}, blocEmis: false });
});

test('bloc mal formé → refus nommé (decision:block), zéro écriture, ZÉRO appel', async () => {
  const r = await deciderStop({
    texteAssistant: '```taches\nverbe-inconnu: x\n```',
    contenuDemande: 'D-20260925-0003',
    appeler: appelerQuiCrieSiAppele,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.equal(r.silence, false);
  assert.equal(r.sortie.decision, 'block');
  assert.match(r.sortie.reason, /verbe inconnu/);
  assert.equal(r.blocEmis, true);
});

test('`.demande` absent avec un bloc présent → refus nommé, zéro écriture, zéro appel', async () => {
  const r = await deciderStop({
    texteAssistant: BLOC_VALIDE,
    contenuDemande: null,
    appeler: appelerQuiCrieSiAppele,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.equal(r.sortie.decision, 'block');
  assert.match(r.sortie.reason, /absent ou illisible/);
});

test('clé ServiceDesk absente (appeler:null) → refus nommé, zéro écriture', async () => {
  const r = await deciderStop({
    texteAssistant: BLOC_VALIDE,
    contenuDemande: 'D-20260925-0003',
    appeler: null,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.equal(r.sortie.decision, 'block');
  assert.match(r.sortie.reason, /clé absente/);
});

test('ServiceDesk injoignable au pré-vol → refus nommé, zéro écriture', async () => {
  const appeler = async () => { throw new Error('ECONNREFUSED'); };
  const r = await deciderStop({
    texteAssistant: BLOC_VALIDE,
    contenuDemande: 'D-20260925-0003',
    appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.equal(r.sortie.decision, 'block');
  assert.match(r.sortie.reason, /injoignable/);
});

test('success:false au pré-vol → refus nommé, zéro écriture', async () => {
  const appeler = async () => ({ success: false, error: 'clé invalide' });
  const r = await deciderStop({
    texteAssistant: BLOC_VALIDE,
    contenuDemande: 'D-20260925-0003',
    appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.equal(r.sortie.decision, 'block');
  assert.match(r.sortie.reason, /refuse/);
});

test('ticket `fait` d\'une AUTRE demande → refus AVANT toute écriture', async () => {
  const { appeler, appels } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 5 } },
    tickets: {
      'T-20260925-0001': { id: 'uuid-1', demand_id: 'uuid-demande' },
      'T-20260925-0002': { id: 'uuid-2', demand_id: 'uuid-UNE-AUTRE-demande' },
    },
  });
  const r = await deciderStop({
    texteAssistant: BLOC_VALIDE, // en-cours 0001 (bonne demande), fait 0002 (mauvaise demande)
    contenuDemande: 'D-20260925-0003',
    appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.equal(r.sortie.decision, 'block');
  assert.match(r.sortie.reason, /n'appartient pas/);
  assert.ok(!appels.some((a) => ['create', 'update', 'add_comment'].includes(a.args.action)),
    `une écriture est partie avant la vérification complète : ${JSON.stringify(appels)}`);
});

test('bloc valide COMPLET → écritures dans l\'ordre, sous la bonne demande, PUIS prochaine tâche rendue', async () => {
  const { appeler, appels } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 2 } },
    tickets: {
      'T-20260925-0001': { id: 'uuid-1', demand_id: 'uuid-demande' },
      'T-20260925-0002': { id: 'uuid-2', demand_id: 'uuid-demande' },
    },
    // direct_ticket_count=2, +1 ouvrir créé = 3 attendus à la relecture.
    listePages: [[
      { id: 'n', ticket_id: 'T-20260925-0009', title: 'Nettoyer le journal des relances', status: 'new', demand_id: 'uuid-demande', created_at: '2026-09-25T01:00:00Z', sequence_order: null },
      { id: '1', ticket_id: 'T-20260925-0001', title: 'X', status: 'in_progress', demand_id: 'uuid-demande', created_at: '2026-09-25T00:30:00Z', sequence_order: null },
      { id: '2', ticket_id: 'T-20260925-0002', title: 'Y', status: 'completed', demand_id: 'uuid-demande', created_at: '2026-09-25T00:10:00Z', sequence_order: null },
    ]],
  });
  const r = await deciderStop({
    texteAssistant: BLOC_VALIDE,
    contenuDemande: 'D-20260925-0003',
    appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  const ecritures = appels.filter((a) => ['create', 'update', 'add_comment'].includes(a.args.action));
  assert.deepEqual(ecritures.map((a) => a.args.action), ['create', 'update', 'add_comment', 'update']);
  assert.equal(r.sortie.decision, 'block');
  assert.match(r.sortie.reason, /prochaine tâche/);
  // « X » (in_progress) est plus ancien que « nettoyer... » (new) → X d'abord.
  assert.match(r.sortie.reason, /T-20260925-0001/);
  assert.equal(r.blocEmis, true);
});

test('`attend: dirigeant` → écrit mais NE RELANCE PAS (pas de decision:block)', async () => {
  const { appeler, appels } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 2 } },
    tickets: { 'T-20260925-0001': { id: 'uuid-1', demand_id: 'uuid-demande' } },
  });
  const texte = ['```taches', 'en-cours: T-20260925-0001', 'attend: dirigeant', '```'].join('\n');
  const r = await deciderStop({
    texteAssistant: texte, contenuDemande: 'D-20260925-0003', appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.equal(r.sortie.decision, undefined, `ne doit jamais relancer sous attend:dirigeant : ${JSON.stringify(r.sortie)}`);
  assert.equal(r.blocEmis, false);
  assert.ok(appels.some((a) => a.args.action === 'update' && a.args.status === 'in_progress'), 'l\'écriture doit avoir eu lieu malgré attend:dirigeant');
  // Aucun appel de pagination : la suite n'est jamais lue sous attend:dirigeant.
  assert.ok(!appels.some((a) => a.args.action === 'list'), 'la suite ne doit pas être lue sous attend:dirigeant');
});

test('comptes divergents à la lecture de la suite → aucune tâche nommée, arrêt permis (pas un block)', async () => {
  const { appeler } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 5 } },
    tickets: { 'T-20260925-0001': { id: 'uuid-1', demand_id: 'uuid-demande' } },
    listePages: [[{ id: '1', ticket_id: 'T-20260925-0001', title: 'X', status: 'new', demand_id: 'uuid-demande', created_at: '2026-09-25T00:30:00Z', sequence_order: null }]],
  });
  const texte = ['```taches', 'en-cours: T-20260925-0001', '```'].join('\n');
  const r = await deciderStop({
    texteAssistant: texte, contenuDemande: 'D-20260925-0003', appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.equal(r.sortie.decision, undefined);
  assert.equal(r.blocEmis, false);
  assert.match(r.sortie.systemMessage, /comptes divergents/);
  assert.match(r.sortie.systemMessage, /non mesuré/);
});

test('plafond atteint → arrêt permis, ET DIT — même sur un bloc autrement valide et relançable', async () => {
  const { appeler } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 0 } },
    listePages: [[{ id: 'n', ticket_id: 'T-20260925-0009', title: 'nouvelle tâche', status: 'new', demand_id: 'uuid-demande', created_at: '2026-09-25T01:00:00Z', sequence_order: null }]],
  });
  const maintenant = 1_000_000;
  const horodatagesRelances = Array.from({ length: 30 }, (_, i) => maintenant - i * 1000);
  const texte = ['```taches', 'ouvrir: nouvelle tâche', '```'].join('\n');
  const r = await deciderStop({
    texteAssistant: texte, contenuDemande: 'D-20260925-0003', appeler,
    horodatagesRelances, plafondParHeure: 30, maintenant,
  });
  assert.equal(r.sortie.decision, undefined, 'le plafond doit empêcher le block, pas seulement le mentionner');
  assert.equal(r.blocEmis, false);
  assert.match(r.sortie.systemMessage, /plafond/);
});

test('N absent → aucune relance jamais, et dit — même quand tout le reste réussit', async () => {
  const { appeler } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 0 } },
    listePages: [[{ id: 'n', ticket_id: 'T-20260925-0009', title: 'nouvelle tâche', status: 'new', demand_id: 'uuid-demande', created_at: '2026-09-25T01:00:00Z', sequence_order: null }]],
  });
  const texte = ['```taches', 'ouvrir: nouvelle tâche', '```'].join('\n');
  const r = await deciderStop({
    texteAssistant: texte, contenuDemande: 'D-20260925-0003', appeler,
    horodatagesRelances: [], plafondParHeure: undefined, maintenant: 1000,
  });
  assert.equal(r.sortie.decision, undefined);
  assert.equal(r.blocEmis, false);
  assert.match(r.sortie.systemMessage, /absente ou invalide|aucune relance/);
});

// ═══════════════════════════════════════════════════════════════════════════
// D1 (orchestration) — un exemple CITÉ n'écrit jamais, un bloc terminal précédé
// d'un bloc cité n'écrit QUE ce que le terminal porte.
// ═══════════════════════════════════════════════════════════════════════════

test('D1 — exemple `taches` CITÉ suivi de prose → silence total, ZÉRO appel (comme "pas de bloc")', async () => {
  const texte = [
    'Voici comment je vais faire à l\'avenir, pour référence :',
    '```taches',
    'ouvrir: exemple de titre',
    '```',
    'Et voilà, j\'attends ton retour.',
  ].join('\n');
  const r = await deciderStop({
    texteAssistant: texte,
    contenuDemande: 'D-20260925-0003',
    appeler: appelerQuiCrieSiAppele,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  assert.deepEqual(r, { silence: true, sortie: {}, blocEmis: false });
});

test('D1 — bloc terminal précédé d\'un bloc cité → SEULES les lignes du terminal sont écrites', async () => {
  const { appeler, appels } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 0 } },
    listePages: [[]],
  });
  const texte = [
    'Pour rappel, la syntaxe est :',
    '```taches',
    'ouvrir: CECI NE DOIT JAMAIS ÊTRE ÉCRIT',
    '```',
    'Ce que je fais réellement maintenant :',
    '```taches',
    'ouvrir: seul ceci doit être écrit',
    'attend: dirigeant',
    '```',
  ].join('\n');
  const r = await deciderStop({
    texteAssistant: texte, contenuDemande: 'D-20260925-0003', appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
  });
  const creations = appels.filter((a) => a.args.action === 'create');
  assert.equal(creations.length, 1, `une seule création attendue : ${JSON.stringify(creations)}`);
  assert.equal(creations[0].args.title, 'seul ceci doit être écrit');
  assert.ok(!creations.some((a) => a.args.title === 'CECI NE DOIT JAMAIS ÊTRE ÉCRIT'));
  assert.equal(r.sortie.decision, undefined, 'attend: dirigeant du bloc terminal doit être respecté, pas de relance');
});

// ═══════════════════════════════════════════════════════════════════════════
// D2 — REJEU = DOUBLONS. Le même dernier message relu (hook redéclenché) ne
// réécrit rien la seconde fois — mais peut toujours relire la suite.
// ═══════════════════════════════════════════════════════════════════════════

test('D2 — même message rejoué deux fois → UN SEUL tickets.create, la seconde fois le dit', async () => {
  const { appeler, appels } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 0 } },
    listePages: [[{ id: 'n', ticket_id: 'T-20260925-0009', title: 'nouvelle tâche', status: 'new', demand_id: 'uuid-demande', created_at: '2026-09-25T01:00:00Z', sequence_order: null }]],
  });
  const texte = ['```taches', 'ouvrir: nouvelle tâche', 'attend: dirigeant', '```'].join('\n');

  const premier = await deciderStop({
    texteAssistant: texte, contenuDemande: 'D-20260925-0003', appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
    empreinteDernierBloc: null,
  });
  assert.equal(typeof premier.empreinteAEnregistrer, 'string', 'un succès frais doit rendre une empreinte à enregistrer');
  assert.equal(premier.empreinteAEnregistrer, empreinteBloc(extraireBloc(texte).contenu));

  // Le hook est redéclenché (retry de l'hôte) sur EXACTEMENT le même message —
  // le fil mince relirait la même empreinte depuis l'état du lieu.
  const second = await deciderStop({
    texteAssistant: texte, contenuDemande: 'D-20260925-0003', appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 2000,
    empreinteDernierBloc: premier.empreinteAEnregistrer,
  });

  const creations = appels.filter((a) => a.args.action === 'create');
  assert.equal(creations.length, 1, `deux rejeux ne doivent créer qu'UN SEUL ticket : ${JSON.stringify(creations)}`);
  assert.match(second.sortie.systemMessage ?? '', /déjà écrit|empreinte identique/,
    'le second appel doit LE DIRE, pas rester muet sur le fait qu\'il n\'a rien réécrit');
  assert.equal(second.empreinteAEnregistrer, undefined, 'rien de neuf à enregistrer : l\'empreinte était déjà la bonne');
});

test('D2 — un rejeu peut RELIRE LA SUITE sans réécrire (pas seulement se taire)', async () => {
  const { appeler, appels } = construireAppeler({
    demandes: { 'D-20260925-0003': { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 1 } },
    tickets: { 'T-20260925-0001': { id: 'uuid-1', demand_id: 'uuid-demande' } },
    listePages: [[
      { id: '1', ticket_id: 'T-20260925-0001', title: 'X', status: 'in_progress', demand_id: 'uuid-demande', created_at: '2026-09-25T00:30:00Z', sequence_order: null },
    ]],
  });
  const texte = ['```taches', 'en-cours: T-20260925-0001', '```'].join('\n');
  const empreinte = empreinteBloc(extraireBloc(texte).contenu);

  const r = await deciderStop({
    texteAssistant: texte, contenuDemande: 'D-20260925-0003', appeler,
    horodatagesRelances: [], plafondParHeure: 30, maintenant: 1000,
    empreinteDernierBloc: empreinte, // déjà écrit lors d'un tour précédent
  });

  assert.ok(!appels.some((a) => ['create', 'update', 'add_comment'].includes(a.args.action)),
    `aucune écriture n'était attendue sur un rejeu : ${JSON.stringify(appels)}`);
  assert.ok(appels.some((a) => a.args.action === 'list'), 'la suite doit quand même être relue sur un rejeu');
  assert.equal(r.sortie.decision, 'block');
  assert.match(r.sortie.reason, /prochaine tâche/);
});

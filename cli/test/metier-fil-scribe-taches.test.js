// metier-fil-scribe-taches.test.js — le FIL MINCE `gardes/scribe-taches.js`,
// exécuté pour de vrai (T-20260925-0080) : lecture du transcript JSONL, lecture
// de `.demande`, état du plafond par lieu (sha1 du cwd), et la SEULE sortie
// muette (pas de bloc, aucun appel — ici mesuré par l'absence de clé ServiceDesk
// dans l'environnement de l'enfant, ce qui rendrait tout appel réseau impossible
// de toute façon).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GARDE = join(RACINE, 'gardes', 'scribe-taches.js');

function transcriptAvec(texteAssistant) {
  const lignes = [
    JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: 'go' }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: texteAssistant }] } }),
  ];
  return lignes.join('\n') + '\n';
}

function executerGarde({ cwd, transcriptPath, stopHookActive = false, env = {} }) {
  const entree = JSON.stringify({ cwd, transcript_path: transcriptPath, stop_hook_active: stopHookActive });
  return execFileSync(process.execPath, [GARDE], {
    input: entree, encoding: 'utf8',
    env: { ...process.env, ...env, SOMTECH_DESK_API_KEY: '', SERVICEDESK_MCP_TOKEN: '' },
  });
}

let TMP;
test.beforeEach(() => { TMP = mkdtempSync(join(tmpdir(), 'smtk-fil-scribe-')); });
test.afterEach(() => { rmSync(TMP, { recursive: true, force: true }); });

test('pas de bloc dans le dernier message assistant → sortie totalement vide (silence)', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec('un message ordinaire, aucun bloc `taches` ici'));
  const sortie = executerGarde({ cwd: TMP, transcriptPath: t });
  assert.equal(sortie, '', `sortie attendue vide, reçue : ${JSON.stringify(sortie)}`);
});

test('bloc valide, `.demande` présent, mais AUCUNE clé ServiceDesk dans l\'environnement → refus nommé "clé absente"', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'attend: dirigeant', '```'].join('\n')));
  writeFileSync(join(TMP, '.demande'), 'D-20260925-0003\n');
  const env = { SOMTECH_SCRIBE_ETAT: join(TMP, 'etat'), SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30' };
  const sortie = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env }));
  assert.equal(sortie.decision, 'block');
  assert.match(sortie.reason, /clé absente/);
});

test('bloc mal formé, `.demande` ABSENT → refus nommé sur le bloc (pas besoin de lire `.demande`)', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'verbe-inconnu: x', '```'].join('\n')));
  const env = { SOMTECH_SCRIBE_ETAT: join(TMP, 'etat'), SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30' };
  const sortie = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env }));
  assert.equal(sortie.decision, 'block');
  assert.match(sortie.reason, /verbe inconnu/);
});

test('une relance émise écrit l\'état du plafond SOUS LE SHA1 DU CWD, et un second lieu ne le partage pas', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'verbe-inconnu: x', '```'].join('\n')));
  const etat = join(TMP, 'etat');
  const env = { SOMTECH_SCRIBE_ETAT: etat, SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30' };
  executerGarde({ cwd: TMP, transcriptPath: t, env });

  const sha1 = createHash('sha1').update(TMP).digest('hex');
  const fichier = join(etat, `${sha1}.json`);
  assert.ok(existsSync(fichier), `l'état du plafond n'a pas été écrit à l'endroit attendu : ${fichier}`);
  const j = JSON.parse(readFileSync(fichier, 'utf8'));
  assert.equal(j.horodatages.length, 1, `un seul block a été émis, un seul horodatage attendu : ${JSON.stringify(j)}`);
});

test('N absent de l\'environnement → aucune relance émise, et l\'état du plafond n\'enregistre rien (blocEmis:false)', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'verbe-inconnu: x', '```'].join('\n')));
  const etat = join(TMP, 'etat');
  const sortie = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env: { SOMTECH_SCRIBE_ETAT: etat } }));
  assert.equal(sortie.decision, undefined);
  assert.match(sortie.systemMessage, /absente ou invalide|aucune relance/);
  const sha1 = createHash('sha1').update(TMP).digest('hex');
  assert.ok(!existsSync(join(etat, `${sha1}.json`)), 'aucun block émis : rien ne devait être écrit dans l\'état du plafond');
});

test('`last_assistant_message` de l\'entrée du hook prime sur le transcript, quand il existe', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec('rien dans le transcript'));
  const entree = JSON.stringify({
    cwd: TMP, transcript_path: t,
    last_assistant_message: ['```taches', 'verbe-inconnu: x', '```'].join('\n'),
  });
  const sortie = execFileSync(process.execPath, [GARDE], {
    input: entree, encoding: 'utf8',
    env: { ...process.env, SOMTECH_SCRIBE_ETAT: join(TMP, 'etat'), SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30', SOMTECH_DESK_API_KEY: '', SERVICEDESK_MCP_TOKEN: '' },
  });
  const j = JSON.parse(sortie);
  assert.equal(j.decision, 'block');
  assert.match(j.reason, /verbe inconnu/);
});

test('D2 — un fichier d\'état ANCIEN FORMAT (sans dernierBlocEmpreinte, pré-existant) ne fait pas planter le fil', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'verbe-inconnu: x', '```'].join('\n')));
  const etat = join(TMP, 'etat');
  const sha1 = createHash('sha1').update(TMP).digest('hex');
  mkdirSync(etat, { recursive: true });
  // Format du lot précédent (D1 seul) : uniquement `horodatages`.
  writeFileSync(join(etat, `${sha1}.json`), JSON.stringify({ horodatages: [] }));
  const env = { SOMTECH_SCRIBE_ETAT: etat, SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30' };
  const sortie = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env }));
  assert.equal(sortie.decision, 'block');
  assert.match(sortie.reason, /verbe inconnu/);
});

// ═══════════════════════════════════════════════════════════════════════════
// D3, BOUT EN BOUT — le VRAI fil mince, deux VRAIS lancements de process,
// LE MÊME fichier d'état. Ferme le trou que les témoins précédents ne
// pouvaient pas fermer : ils n'exercent que `deciderStop` (module pur) ou un
// SEUL lancement du fil — jamais la ligne qui PERSISTE le journal entre deux
// lancements (`gardes/scribe-taches.js` ~l.197). Une mutation qui désarme
// cette ligne (`journal: null` au lieu de `resultat.journalAEnregistrer ??
// journal`) restait invisible : 74/74 verts.
//
// ⚠️ LE DOUBLE DU SERVICEDESK, INJECTÉ SANS TOUCHER LA PROD, CLOISON ARMÉE.
// `transportServiceDesk()` (ligne-directe/src/mandat.js) REFUSE tout appel
// réseau sous `NODE_TEST_CONTEXT` (la cloison d'essais, `ligne-directe/src/
// cloison.js`) — et ce process enfant HÉRITE cette variable de ce lanceur de
// tests. Il n'y a PAS de façon de lui faire adopter un double : c'est voulu
// (« il n'y a pas d'autre chemin », cloison.js). `gardes/scribe-taches.js`
// porte donc un second seuil, hors de `transportServiceDesk`, gardé par LE
// MÊME signal (`NODE_TEST_CONTEXT`) ET un second (`SOMTECH_SCRIBE_APPELER_TEST`,
// le chemin d'un module qui exporte `appeler`) — les deux absents en
// production, donc ce chemin n'existe pas hors d'un `node --test` réel.
//
// L'ÉTAT PERSISTE ENTRE LES DEUX LANCEMENTS via un COMPTEUR SUR DISQUE (pas une
// variable JS : chaque lancement est un PROCESS SÉPARÉ) — c'est ce compteur qui
// fait échouer `en-cours` UNE SEULE FOIS (1er lancement), puis réussir ensuite.

/** Écrit le module double du ServiceDesk que `SOMTECH_SCRIBE_APPELER_TEST` cible. */
function ecrireDoubleServiceDesk(tmp) {
  const compteurPanne = join(tmp, 'compteur-panne.txt');
  const compteurCreate = join(tmp, 'compteur-create.txt');
  const chemin = join(tmp, 'double-servicedesk.mjs');
  writeFileSync(chemin, `
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const COMPTEUR_PANNE = ${JSON.stringify(compteurPanne)};
const COMPTEUR_CREATE = ${JSON.stringify(compteurCreate)};
function lu(chemin) { return existsSync(chemin) ? Number(readFileSync(chemin, 'utf8')) || 0 : 0; }
function incr(chemin) { writeFileSync(chemin, String(lu(chemin) + 1)); }

export async function appeler(nom, args) {
  if (nom === 'demands' && args.action === 'get') {
    // direct_ticket_count=1 : conforme au RÉEL une fois « ouvrir » réussi (1er
    // lancement) — le double modélise l'état RÉEL du ServiceDesk, pas un
    // instantané figé au premier appel.
    return { demand: { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 1 } };
  }
  if (nom === 'tickets' && args.action === 'get') {
    if (args.id === 'T-20260925-0001') return { success: true, ticket: { id: 'uuid-1', demand_id: 'uuid-demande' } };
    throw new Error('Ticket not found');
  }
  if (nom === 'tickets' && args.action === 'create') {
    incr(COMPTEUR_CREATE);
    return { success: true, ticket: { id: 'uuid-nouveau' } };
  }
  if (nom === 'tickets' && args.action === 'update' && args.status === 'in_progress') {
    const n = lu(COMPTEUR_PANNE);
    incr(COMPTEUR_PANNE);
    if (n === 0) throw new Error('ServiceDesk indisponible (panne simulée, 1er passage)');
    return { success: true };
  }
  if (nom === 'tickets' && args.action === 'list') {
    return {
      success: true,
      tickets: [{ id: 'n', ticket_id: 'T-20260925-0009', title: 'nouvelle tâche', status: 'new', demand_id: 'uuid-demande', created_at: '2026-09-25T01:00:00Z', sequence_order: null }],
      count: 1,
    };
  }
  throw new Error('appel non modélisé dans le double : ' + nom + '/' + args.action);
}
`);
  return { chemin, compteurCreate };
}

test('D3 bout en bout — VRAI fil mince, deux VRAIS lancements, MÊME état : le 2e ne recrée pas le ticket déjà ouvert', () => {
  const t = join(TMP, 'transcript.jsonl');
  const texte = ['```taches', 'ouvrir: nouvelle tâche', 'en-cours: T-20260925-0001', '```'].join('\n');
  writeFileSync(t, transcriptAvec(texte));
  writeFileSync(join(TMP, '.demande'), 'D-20260925-0003\n');
  const etat = join(TMP, 'etat');
  const { chemin: double, compteurCreate } = ecrireDoubleServiceDesk(TMP);
  const lireCompteurCreate = () => (existsSync(compteurCreate) ? Number(readFileSync(compteurCreate, 'utf8')) : 0);
  const env = {
    SOMTECH_SCRIBE_ETAT: etat, SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30',
    SOMTECH_SCRIBE_APPELER_TEST: double,
  };

  // 1er lancement : `ouvrir` réussit, `en-cours` tombe en panne (1x, simulé par
  // le double) → refus nommé (block).
  const premier = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env }));
  assert.equal(premier.decision, 'block');
  assert.match(premier.reason, /panne|indisponible/);
  assert.equal(lireCompteurCreate(), 1, 'ouvrir doit avoir créé le ticket UNE fois au 1er lancement');

  // Le journal doit déjà être SUR DISQUE, avec l'étape ouvrir marquée réussie —
  // c'est la ligne exacte que la mutation du chef désarme.
  const sha1 = createHash('sha1').update(TMP).digest('hex');
  const fichierEtat = join(etat, `${sha1}.json`);
  assert.ok(existsSync(fichierEtat), 'le journal doit être persisté après le 1er lancement, même en échec partiel');
  const etatApresPremier = JSON.parse(readFileSync(fichierEtat, 'utf8'));
  assert.deepEqual(etatApresPremier.journal?.etapes, ['ouvrir#0'],
    `le journal doit garder l'étape ouvrir réellement réussie : ${JSON.stringify(etatApresPremier)}`);

  // 2e lancement : l'agent réémet EXACTEMENT le même bloc — réaction normale à
  // un refus « ServiceDesk en panne ». Cette fois `en-cours` réussit (compteur
  // à 1 dans le double).
  const second = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env }));
  assert.equal(second.decision, 'block');
  assert.match(second.reason, /prochaine tâche/);
  assert.equal(lireCompteurCreate(), 1,
    `le 2e lancement ne doit PAS recréer le ticket déjà ouvert (1 seul create au total) : compteur=${lireCompteurCreate()}`);

  // Le compteur du double n'a incrémenté qu'à CHAQUE appel de « en-cours » — 2
  // appels au total (1er échoué, 2e réussi) prouve que `ouvrir` n'a PAS été
  // rejoué au 2e lancement (sinon on aurait un signal de double création à
  // chercher séparément — ici la preuve la plus directe est le journal final).
  const etatFinal = JSON.parse(readFileSync(fichierEtat, 'utf8'));
  assert.deepEqual([...etatFinal.journal.etapes].sort(), ['en-cours:T-20260925-0001', 'ouvrir#0'].sort(),
    `le 2e lancement doit compléter le journal (les deux étapes), sans repartir de zéro : ${JSON.stringify(etatFinal)}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// LE DÉLAI INTERNE — si le minuteur du fil mince tue le process AU MILIEU du
// plan d'écritures, la dernière étape réellement réussie doit déjà être sur
// disque : `deciderStop` ne rend JAMAIS son `journalAEnregistrer` si le
// process sort avant que sa promesse ne se résolve (voir `onEtapeReussie`
// dans cli/src/metier/gardes/scribe-taches.js). CHOIX FAIT : persister
// immédiatement (pas seulement documenter la limite) — ce témoin le prouve.
// ═══════════════════════════════════════════════════════════════════════════

/** Un double dont `en-cours` PEND indéfiniment — jamais de réponse, pour simuler la panne que le minuteur interrompt. */
function ecrireDoubleServiceDeskQuiPend(tmp) {
  const chemin = join(tmp, 'double-qui-pend.mjs');
  writeFileSync(chemin, `
export async function appeler(nom, args) {
  if (nom === 'demands' && args.action === 'get') {
    return { demand: { id: 'uuid-demande', created_at: '2026-09-25T00:00:00Z', direct_ticket_count: 0 } };
  }
  if (nom === 'tickets' && args.action === 'get') {
    if (args.id === 'T-20260925-0001') return { success: true, ticket: { id: 'uuid-1', demand_id: 'uuid-demande' } };
    throw new Error('Ticket not found');
  }
  if (nom === 'tickets' && args.action === 'create') {
    return { success: true, ticket: { id: 'uuid-nouveau' } };
  }
  if (nom === 'tickets' && args.action === 'update' && args.status === 'in_progress') {
    // Un VRAI appel réseau qui pend tient l'event loop en vie via son socket ouvert —
    // un \`new Promise(() => {})\` NU n'en tient aucun, et un minuteur \`unref()\`
    // sur une boucle par ailleurs VIDE ne tire jamais (le process sort avant, sans
    // rien répondre). Ce minuteur RÉFÉRENCÉ (pas de \`.unref()\`) imite le socket :
    // largement plus long que le délai du fil, jamais atteint en pratique.
    return new Promise((resolve) => setTimeout(resolve, 60_000));
  }
  throw new Error('appel non modélisé dans le double qui pend : ' + nom + '/' + args.action);
}
`);
  return { chemin };
}

test('le délai interne du fil mince : une étape réussie AVANT une étape qui PEND est déjà sur disque quand le minuteur coupe', () => {
  const t = join(TMP, 'transcript.jsonl');
  const texte = ['```taches', 'ouvrir: nouvelle tâche', 'en-cours: T-20260925-0001', '```'].join('\n');
  writeFileSync(t, transcriptAvec(texte));
  writeFileSync(join(TMP, '.demande'), 'D-20260925-0003\n');
  const etat = join(TMP, 'etat');
  const { chemin: double } = ecrireDoubleServiceDeskQuiPend(TMP);
  const env = {
    SOMTECH_SCRIBE_ETAT: etat, SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30',
    SOMTECH_SCRIBE_APPELER_TEST: double,
    SOMTECH_SCRIBE_DELAI_MS: '300', // court, pour ne pas faire traîner le banc
  };

  const sortie = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env }));
  assert.match(sortie.systemMessage ?? '', /délai dépassé/, 'le minuteur doit couper — la panne ne se résout jamais');

  const sha1 = createHash('sha1').update(TMP).digest('hex');
  const fichierEtat = join(etat, `${sha1}.json`);
  assert.ok(existsSync(fichierEtat), 'le journal doit être sur disque MÊME quand le minuteur coupe le process');
  const j = JSON.parse(readFileSync(fichierEtat, 'utf8'));
  assert.deepEqual(j.journal?.etapes, ['ouvrir#0'],
    `l'étape ouvrir, réussie AVANT la panne, doit survivre à la coupure du minuteur : ${JSON.stringify(j)}`);
});

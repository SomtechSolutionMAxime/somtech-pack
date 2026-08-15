// naitre-bin.test.js — le fichier exécutable réel (bin/naitre.js), avec un FAUX herdr en
// tête de PATH — même technique que ligne-directe/tests/herdr.test.js. Aucun vrai pane
// n'est créé, aucune vraie session herdr n'est touchée.
//
// CE QUE CE DOUBLE A COÛTÉ, ET CE QU'IL FAIT MAINTENANT (T-20260809-0023)
//
// L'ancien double répondait `{"result":{"ok":true}}` à TOUT ce qui n'était pas `tab create`.
// Il disait donc « oui » à `agent rename` sur un pane où aucun agent n'existait encore —
// alors que le vrai service répond `{"error":{"code":"agent_not_found"}}` et sort en 1. Les
// 52 tests du lot étaient verts et le tout premier geste de la chaîne échouait au premier
// usage réel : septième occurrence du motif « le double est plus indulgent que le vrai ».
//
// Ce double-ci REPRODUIT le vrai service sur les trois points qui ont mordu :
//   • un agent n'est pas détectable dès la création du pane — `agent get` refuse d'abord ;
//   • `agent rename` sur un pane sans agent REFUSE, et on éprouve ses DEUX formes de refus
//     (sortie non nulle, et sortie ZÉRO avec `{"error":…}` — c'est celle-ci qui rendait 0) ;
//   • `agent get` rapporte un répertoire de travail, qui peut ne pas être le lieu.
//
// Il reste un double : ce qu'il ne peut pas prouver — qu'une VRAIE session naît bien dans le
// lieu — est prouvé contre le vrai gestionnaire de panes par
// `scripts/tests/test-naissance-representant-reel.sh`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, rmdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { poserGarde } from '../src/naissance.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_NAISSANCE = resolve(HERE, '..');
const REPO_ROOT = resolve(REPO_NAISSANCE, '..');
const BIN = join(REPO_NAISSANCE, 'bin', 'naitre.js');

let bac;
let pathOriginal;

/**
 * Un faux `herdr` fidèle au vrai sur les points qui ont mordu. Son comportement est piloté
 * par un scénario écrit sur disque (un sous-processus ne partage pas la mémoire du test) :
 *
 *   detecteApres  — nombre d'appels `agent get` qui REFUSENT avant que l'agent existe
 *   refusRenommage— null | 'sortie-1' | 'sortie-0'  (la seconde est le chemin silencieux)
 *   refusLancement— `pane run` refuse (un pane disparu entre sa création et son lancement)
 *   repertoire    — ce que `agent get` rapporte comme répertoire de travail réel
 */
function installerFauxHerdr(scenario = {}) {
  const journal = join(bac, 'appels.jsonl');
  const etat = join(bac, 'scenario.json');
  writeFileSync(journal, '');
  writeFileSync(
    etat,
    JSON.stringify({
      detecteApres: 0,
      refusRenommage: null,
      refusLancement: false,
      repertoire: null,
      // Les espaces que la session visée porte. Le défaut de T-20260814-0120 est qu'un
      // identifiant d'une AUTRE session passait sans que rien ne le signale : un test doit
      // donc pouvoir décrire une session qui ne porte PAS l'espace demandé.
      espaces: ['w9'],
      ...scenario,
    })
  );
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const sc = JSON.parse(fs.readFileSync(${JSON.stringify(etat)}, 'utf8'));
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse).map((e) => e.a);
fs.appendFileSync(JOURNAL, JSON.stringify({ a: args, s: process.env.HERDR_SOCKET_PATH || null }) + '\\n');

const sortir = (obj, code) => { process.stdout.write(JSON.stringify(obj)); process.exit(code); };
const refus = (code) => ({ error: { code, message: code + ' pour ' + args.join(' ') } });
const cmd = args.slice(0, 2).join(' ');

if (cmd === 'workspace list') {
  sortir({ result: { workspaces: (sc.espaces || []).map((w) => ({ workspace_id: w, label: 'essai ' + w })) } }, 0);
}

if (cmd === 'tab create') sortir({ result: { root_pane: { pane_id: 'w9:p1' } } }, 0);

// Le vrai \`pane run\` ne rend RIEN quand il réussit : sortie vide, code 0. Le double le
// disait \`{"result":{"ok":true}}\` — et c'est ce mensonge-là qui a fait échouer la première
// version du correctif contre le vrai service, alors que la suite était verte. Huitième
// occurrence du motif, sur ce ticket même : le double doit dire ce que le service dit.
// Il refuse aussi, comme le vrai : un pane disparu entre sa création et son lancement.
if (cmd === 'pane run') {
  if (sc.refusLancement) sortir(refus('pane_not_found'), 1);
  process.exit(0);
}

if (cmd === 'agent get') {
  const vus = passes.filter((a) => a[0] === 'agent' && a[1] === 'get').length;
  // Le vrai herdr REFUSE, sortie non nulle, tant qu'aucun agent n'est détecté dans le pane.
  if (vus < sc.detecteApres) sortir(refus('agent_not_found'), 1);
  const renomme = passes.find((a) => a[0] === 'agent' && a[1] === 'rename');
  sortir({
    result: {
      type: 'agent_info',
      agent: {
        pane_id: 'w9:p1',
        agent_status: 'idle',
        name: renomme ? renomme[3] : null,
        cwd: sc.repertoire,
        foreground_cwd: sc.repertoire,
      },
    },
  }, 0);
}

if (cmd === 'agent rename') {
  const vus = passes.filter((a) => a[0] === 'agent' && a[1] === 'get').length;
  // Un renommage lancé avant qu'un agent existe échoue — c'est le défaut d'origine.
  if (vus < sc.detecteApres) sortir(refus('agent_not_found'), 1);
  if (sc.refusRenommage === 'sortie-1') sortir(refus('agent_not_found'), 1);
  // LE CHEMIN SILENCIEUX : le service refuse MAIS sort en zéro. Un appelant qui ne lit pas
  // la réponse croit avoir réussi — c'est ainsi que la commande rendait 0 sans rien faire.
  if (sc.refusRenommage === 'sortie-0') sortir(refus('agent_not_found'), 0);
  sortir({ result: { ok: true } }, 0);
}

if (cmd === 'pane close') sortir({ result: { ok: true } }, 0);
sortir({ result: { ok: true } }, 0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
  return journal;
}

function entreesJournalisees(journal) {
  return readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** Les gestes, tels que les contrôles existants les lisent. */
function appelsJournalises(journal) {
  return entreesJournalisees(journal).map((e) => e.a);
}

/**
 * La session à laquelle CHAQUE geste a parlé.
 *
 * ⚠️ SANS ÇA, RETIRER LE SOCKET D'UN SEUL APPEL NE ROUGISSAIT NULLE PART — le faux herdr ne
 * regardait pas à qui on s'adressait. Une revue en passe 1 l'a montré, et le trou était
 * réel : `livrerBrief` était appelé sans socket, donc l'amorce partait vers la session par
 * défaut. Cinq appels sur six portaient la session — neuvième occurrence du motif
 * « une porte sur deux » sur ce dépôt, et la première commise ici (T-20260814-0120).
 */
function sessionsJournalisees(journal) {
  return entreesJournalisees(journal).map((e) => e.s);
}

/**
 * Lance `bin/naitre.js` et rend `{ code, stdout, stderr }` — sans jamais jeter.
 *
 * ⚠️ `spawnSync`, et pas `execFileSync` : la commande écrit aussi sur la sortie d'erreur
 * quand elle RÉUSSIT — un avertissement d'amorce, un avis de casse (T-20260814-0143). La
 * version précédente de cette aide rendait `stderr: ''` sur le chemin du succès, ce qui
 * rendait ces avis structurellement inéprouvables : un test ne peut pas voir ce que son
 * outil de mesure jette.
 */
let depotCourant = null; // le dépôt jetable du test en cours — voir `avecLieu`
let sessionsDesEssais = '/tmp/faux-poste/.config/herdr/sessions/essai/herdr.sock';

function lancerNaitre(client, workspace = 'w9', { amorce = null } = {}) {
  const args = [BIN, client, '--workspace', workspace];
  if (depotCourant) args.push('--depot', depotCourant);
  if (amorce) args.push('--amorce-texte', amorce);
  // UNE seule session désignée : le cas non ambigu, celui qui doit continuer à marcher sans
  // que l'appelant précise quoi que ce soit. Les cas à plusieurs sessions sont éprouvés sur
  // la résolution elle-même (`tests/session.test.js`), sans faire naître personne.
  const r = spawnSync(process.execPath, args, {
    env: {
      ...process.env,
      NAISSANCE_ESSAIS: '6',
      NAISSANCE_DELAI_MS: '5',
      HERDR_SESSIONS_ESSAIS: sessionsDesEssais,
      HERDR_SOCKET_PATH: '',
    },
  });
  return {
    code: r.status ?? 1,
    stdout: (r.stdout ?? '').toString(),
    stderr: (r.stderr ?? '').toString(),
  };
}

// CHAQUE TEST A SON PROPRE DÉPÔT GIT, JETABLE — et ce n'est pas du confort.
//
// Ces tests posaient jusqu'ici leur lieu SOUS CE DÉPÔT-CI, faute de pouvoir désigner un
// autre dépôt : un commentaire l'affirmait ici même (« on ne peut pas lui faire croire à un
// autre dépôt sans le copier »). C'était faux — `--depot` existe et la commande l'accepte
// depuis longtemps. Le commentaire décrivait un état révolu, et personne ne l'avait relu.
//
// Deux raisons de corriger maintenant :
//   • la naissance REFUSE désormais un lieu qu'aucun commit ne porte (T-20260814-0139). Un
//     lieu posé à la volée dans le dépôt de travail n'est jamais versé — tous ces tests
//     seraient refusés, et pour la bonne raison ;
//   • éprouver le versionnement exige un vrai dépôt qu'on peut committer sans salir celui
//     dans lequel on travaille.
//
// `verser: false` reproduit l'état interdit : un lieu complet sur disque, dans aucun commit.
let compteur = 0;
function avecLieu(faire, prefixe = 'smoke', { verser = true } = {}) {
  compteur += 1;
  const client = `${prefixe}-${process.pid}-${compteur}`;
  const depot = mkdtempSync(join(tmpdir(), 'smtk-naitre-depot-'));
  const git = (...args) => execFileSync('git', ['-C', depot, ...args], { stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 'essai@somtech.ca');
  git('config', 'user.name', 'essai');

  const lieu = join(depot, '.gestionnaire', client);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
  writeFileSync(join(lieu, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
  writeFileSync(join(lieu, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');
  if (verser) {
    git('add', '-Af');
    git('commit', '-qm', 'le lieu, versé — comme la compétence le prescrit après la pose');
  }

  depotCourant = depot;
  try {
    return faire(client, lieu, depot);
  } finally {
    depotCourant = null;
    rmSync(depot, { recursive: true, force: true });
  }
}

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'smtk-naitre-bin-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});

after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});

test('naitre.js refuse proprement quand le lieu n’existe pas — sans jamais appeler herdr', () => {
  const journal = installerFauxHerdr();
  const r = lancerNaitre(`smoke-inexistant-${process.pid}`);
  assert.notEqual(r.code, 0);
  assert.equal(appelsJournalises(journal).length, 0, 'aucun appel herdr ne doit avoir lieu si le lieu est absent');
});

// T-20260814-0143 — LE LIEU ET L'AGENT PEUVENT PORTER DEUX NOMS, ET C'EST LÉGITIME.
// Ce qui ne l'est pas, c'est que la commande le fasse sans le dire : le seul endroit qui
// portait l'écart était un champ d'un objet JSON de douze clés, que personne ne relit.
// Mesuré en production avant ce correctif : `.gestionnaire/Charles-Olivier` → `charles-olivier`.
test('naitre.js DIT qu’elle a abaissé la casse, et nomme les deux noms', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: lieu });
    const attendu = client.toLowerCase();
    assert.notEqual(attendu, client, 'ce cas n’a de sens que si la casse est réellement abaissée');

    const r = lancerNaitre(client);
    assert.equal(r.code, 0, `naissance attendue réussie — stderr: ${r.stderr}`);

    // Le contrat de sortie ne bouge pas : les appelants qui lisent le JSON ne cassent pas.
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.nom, client);
    assert.equal(rendu.agent, attendu);

    // Et l'humain, lui, est prévenu — sur la sortie d'erreur, avec les DEUX noms.
    assert.match(r.stderr, new RegExp(`« ${client} »`), 'l’avis doit nommer le lieu');
    assert.match(r.stderr, new RegExp(`« ${attendu} »`), 'et le nom sous lequel on adresse l’agent');

    // L'agent est bien nommé en minuscules chez herdr — l'avis décrit ce qui ARRIVE.
    const appels = appelsJournalises(journal);
    const rename = appels.find((a) => a[0] === 'agent' && a[1] === 'rename');
    assert.equal(rename[3], attendu);
  }, 'Smoke'));

test('naitre.js se TAIT quand elle n’a rien abaissé — un avis systématique cesse d’être lu', () =>
  avecLieu((client, lieu) => {
    installerFauxHerdr({ detecteApres: 1, repertoire: lieu });
    assert.equal(client, client.toLowerCase(), 'ce cas exige un nom déjà en minuscules');

    const r = lancerNaitre(client);
    assert.equal(r.code, 0, `naissance attendue réussie — stderr: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /adresse|abaiss/i, `aucun avis de casse attendu — stderr: ${r.stderr}`);
  }));

// T-20260814-0139 — DE BOUT EN BOUT, SUR UN VRAI DÉPÔT.
//
// `avecLieu` pose son lieu sous CE dépôt, qui est un vrai dépôt git — et ce lieu n'est
// évidemment dans aucun commit. C'est exactement l'état d'un lieu client mesuré vivant :
// posé, fonctionnel, et nulle part dans l'historique. La commande doit le DIRE.
test('naitre.js REFUSE un lieu qu’aucun commit ne porte — et ne laisse RIEN derrière elle', () =>
  avecLieu(
    (client, lieu) => {
      const journal = installerFauxHerdr({ detecteApres: 1, repertoire: lieu });
      const avant = readFileSync(join(lieu, '.claude', 'settings.json'));

      const r = lancerNaitre(client);

      assert.equal(r.code, 1, `refus attendu — stderr: ${r.stderr}`);
      assert.match(r.stderr, /aucun commit ne porte/);
      assert.match(r.stderr, new RegExp(client), 'le refus doit nommer le lieu');
      assert.match(r.stderr, /git add/, 'et NOMMER LE GESTE qui le lève — c’est la condition posée');

      // Rien derrière lui, et les trois preuves valent mieux qu'une promesse :
      assert.equal(
        appelsJournalises(journal).length,
        0,
        'aucun appel herdr : le refus tombe avant qu’un pane existe'
      );
      assert.deepEqual(
        readFileSync(join(lieu, '.claude', 'settings.json')),
        avant,
        'le settings.json est à l’octet près celui qu’on a trouvé — la garde n’a PAS été posée'
      );
      assert.equal(r.stdout, '', 'et rien n’est rendu qui ressemblerait à un succès');
    },
    'smoke',
    { verser: false }
  ));

// ⚠️ L'ÉTAT EXACT DES TROIS LIEUX CLIENTS MESURÉS : le lieu est versé, et il porte une garde
// qu'aucun commit ne contient — posée par une naissance antérieure, jamais versée. C'est
// celui-là qui doit être refusé, et il se distingue de la garde que la naissance courante
// s'apprête à poser : celle-ci, personne ne pouvait la verser avant qu'elle existe.
test('naitre.js REFUSE une garde PRÉEXISTANTE qu’aucun commit ne porte', () =>
  avecLieu((client, lieu, depot) => {
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: lieu });
    // Une naissance antérieure a posé la garde ; personne ne l'a versée.
    poserGarde(depot, client);

    const r = lancerNaitre(client);

    assert.equal(r.code, 1, `refus attendu — stderr: ${r.stderr}`);
    assert.match(r.stderr, /garde/i, 'le refus doit nommer ce qui n’est pas versé');
    assert.match(r.stderr, /git add/, 'et le geste qui le lève');
    assert.equal(appelsJournalises(journal).length, 0, 'aucun pane créé');
  }));

// Le pendant du précédent : la garde que CETTE naissance pose ne peut pas être versée
// d'avance. La refuser rendrait toute première naissance impossible — on ne peut pas
// committer un fichier que la commande refuse d'écrire. Elle avertit, et elle aboutit.
test('naitre.js ABOUTIT sur un lieu versé, en signalant la garde qu’elle vient de poser', () =>
  avecLieu((client, lieu) => {
    installerFauxHerdr({ detecteApres: 1, repertoire: lieu });

    const r = lancerNaitre(client);

    assert.equal(r.code, 0, `naissance attendue réussie — stderr: ${r.stderr}`);
    assert.equal(JSON.parse(r.stdout).ok, true);
    assert.match(r.stderr, /garde/i, 'la garde fraîchement posée doit être signalée');
  }));

// Le troisième état, et le seul qui doit être MUET de bout en bout : lieu versé, garde
// versée. Il n'était prouvé qu'au niveau unitaire — la revue de fond l'a relevé, et un
// comportement silencieux non verrouillé est celui qui se met à parler sans qu'on le voie.
test('naitre.js se TAIT quand le lieu ET sa garde sont versés — le régime normal', () =>
  avecLieu((client, lieu, depot) => {
    installerFauxHerdr({ detecteApres: 1, repertoire: lieu });
    // Une naissance antérieure a posé la garde, et quelqu'un l'a versée, comme il se doit.
    poserGarde(depot, client);
    execFileSync('git', ['-C', depot, 'add', '-Af'], { stdio: 'ignore' });
    execFileSync('git', ['-C', depot, 'commit', '-qm', 'la garde, versée'], { stdio: 'ignore' });

    const r = lancerNaitre(client);

    assert.equal(r.code, 0, `naissance attendue réussie — stderr: ${r.stderr}`);
    assert.equal(JSON.parse(r.stdout).ok, true);
    assert.doesNotMatch(
      r.stderr,
      /aucun commit|git add/,
      `rien à verser, donc rien à dire — stderr: ${r.stderr}`
    );
  }));

// ═══════════════ T-20260814-0120 — L'ESPACE D'UNE AUTRE SESSION, PROUVÉ PAR L'ABSENCE
//
// Le cas vécu : `w2W`, lu dans la session `somtech`, donné pour une naissance dans
// `sibelanger`. Les identifiants d'espace ne sont pas globalement uniques — l'un désigne
// donc un espace qui existe, mais ailleurs. Sans ce refus, la naissance ne rate pas : elle
// réussit au mauvais endroit, et rien à l'écran ne le montre.
//
// La preuve exigée par le ticket est une ABSENCE : aucun onglet créé nulle part.
test('naitre.js REFUSE un espace que la session visée ne porte pas — et n’ouvre AUCUN onglet', () =>
  avecLieu((client, lieu) => {
    // La session ne porte que `wAUTRE` ; on va lui demander `w9`, qui vit ailleurs.
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: lieu, espaces: ['wAUTRE'] });

    const r = lancerNaitre(client);

    assert.equal(r.code, 1, `refus attendu — stderr: ${r.stderr}`);
    assert.match(r.stderr, /w9/, 'le refus doit citer l’espace demandé');
    assert.match(r.stderr, /wAUTRE/, 'et montrer ceux que la session porte vraiment');
    assert.match(r.stderr, /pas uniques|autre session/i, 'et dire POURQUOI, sinon on croit à une faute de frappe');

    const appels = appelsJournalises(journal);
    assert.equal(
      appels.filter((a) => a[0] === 'tab' && a[1] === 'create').length,
      0,
      'AUCUN onglet ne doit avoir été créé — la preuve est l’absence, pas le message'
    );
    assert.equal(r.stdout, '', 'et rien qui ressemble à un succès');
  }));

// ═══════════ T-20260814-0120 — TOUS les gestes parlent à la session visée, sans exception
//
// ⚠️ CE CONTRÔLE EXISTE PARCE QUE J'AI COMMIS LE DÉFAUT QU'IL GARDE. Cinq appels herdr
// portaient la session, le sixième non : `livrerBrief` était appelé sans socket, donc
// l'amorce partait vers la session par défaut — c'est-à-dire vers RIEN depuis un terminal
// ordinaire. Neuvième occurrence du motif « une porte sur deux » sur ce dépôt, et la
// première commise en le corrigeant. Une revue en passe 1 l'a vue ; aucun test ne la voyait,
// parce que le faux herdr ne regardait pas à qui on s'adressait.
//
// On compte donc les gestes, on ne les nomme pas un à un : une liste de noms se déphase au
// premier appel ajouté, et c'est exactement ainsi qu'un sixième se glisse sans socket.
test('CHAQUE geste herdr part vers la session visée — aucun ne parle à une autre', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: lieu });

    // ⚠️ L'AMORCE N'A PAS BESOIN DE RÉUSSIR POUR ÊTRE MESURÉE — il suffit qu'elle PARLE.
    // Le double ne sait pas jouer la danse complète d'une boîte de saisie, et la faire
    // aboutir demanderait de lui apprendre un dialogue que la suite de `livraison` éprouve
    // déjà. Mais la livraison lit l'écran avant d'écrire : ce geste-là part, il est
    // journalisé, et c'est lui qui portait le socket manquant.
    lancerNaitre(client, 'w9', { amorce: 'Voici ton brief, en une ligne.' });

    const appels = appelsJournalises(journal);
    assert.ok(
      appels.some((a) => a[0] === 'agent' && a[1] === 'read'),
      'la livraison de l’amorce doit avoir parlé à herdr — sans quoi ce contrôle ne mesure pas ce qu’il croit'
    );

    const sessions = sessionsJournalisees(journal);
    assert.ok(sessions.length >= 5, `trop peu de gestes pour que ce contrôle prouve quoi que ce soit (${sessions.length})`);
    const egarees = sessions.filter((s) => s !== sessionsDesEssais);
    assert.deepEqual(
      egarees,
      [],
      `${egarees.length} geste(s) sur ${sessions.length} ont parlé à une autre session que « ${sessionsDesEssais} »`
    );
  }));

test('naitre.js exige --workspace', () => {
  assert.throws(() => execFileSync(process.execPath, [BIN, 'un-client'], { stdio: 'pipe' }));
});

test('naitre.js pose le garde, fait naître le pane DANS le lieu, attend l’agent, PUIS le nomme', () =>
  avecLieu((client, lieu) => {
    // L'agent n'est détecté qu'au 3e sondage : c'est la situation réelle (une session met
    // plusieurs secondes à apparaître), celle où l'ancienne version échouait.
    const journal = installerFauxHerdr({ detecteApres: 3, repertoire: lieu });

    const r = lancerNaitre(client);
    assert.equal(r.code, 0, `naissance attendue réussie — stderr: ${r.stderr}`);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.ok, true);
    assert.equal(rendu.pane, 'w9:p1');
    assert.equal(rendu.agent, client);
    assert.equal(rendu.repertoire, lieu, 'la commande rend le répertoire RELU, pas celui qu’elle a composé');

    // Le garde a réellement été fusionné DANS leur fichier, sans effacer leurs permissions.
    const settingsFinal = JSON.parse(readFileSync(join(lieu, '.claude', 'settings.json'), 'utf8'));
    assert.deepEqual(settingsFinal.permissions, { allow: ['mcp__servicedesk__*'] });
    // Le garde se reconnaît au fichier qu'il appelle, jamais à la fin de la ligne : la
    // commande porte désormais son propre repli si le poste ne l'a pas (T-20260809-0032).
    assert.match(
      settingsFinal.hooks.PreToolUse[0].hooks[0].command,
      /\$HOME\/\.somtech\/naissance-representant\/hooks\/garde-ouverture-ligne\.js/
    );

    const appels = appelsJournalises(journal);

    // L'APPARTENANCE DE L'ESPACE SE VÉRIFIE AVANT QU'UN ONGLET EXISTE (T-20260814-0120).
    // C'est ce qui fait qu'un espace pris dans une autre session ne laisse rien derrière :
    // le refus tombe pendant qu'il n'y a encore rien à refermer.
    const iEspaces = appels.findIndex((a) => a[0] === 'workspace' && a[1] === 'list');
    const iTab = appels.findIndex((a) => a[0] === 'tab' && a[1] === 'create');
    assert.ok(iEspaces >= 0, 'la commande doit demander à la session quels espaces elle porte');
    assert.ok(iEspaces < iTab, 'et le demander AVANT de créer le moindre onglet');

    // Le pane naît DANS le lieu — le drapeau, pas seulement le `cd` écrit ensuite.
    assert.equal(appels[iTab][appels[iTab].indexOf('--cwd') + 1], lieu);
    // La session est lancée AVANT toute tentative de nommage.
    assert.deepEqual(appels[iTab + 1], ['pane', 'run', 'w9:p1', `cd ${lieu} && claude`]);

    // LE DÉFAUT D'ORIGINE, en une assertion : le renommage ne part qu'APRÈS que l'agent a
    // été vu. Sur l'ancienne version, `agent rename` était le DEUXIÈME appel.
    const iRename = appels.findIndex((a) => a[0] === 'agent' && a[1] === 'rename');
    const iRun = appels.findIndex((a) => a[0] === 'pane' && a[1] === 'run');
    const sondagesAvant = appels.slice(0, iRename).filter((a) => a[0] === 'agent' && a[1] === 'get').length;
    assert.ok(iRename > iRun, 'le renommage doit venir après le lancement de la session');
    assert.ok(sondagesAvant >= 3, `l’agent doit avoir été vu avant d’être nommé (${sondagesAvant} sondages)`);
    assert.deepEqual(appels[iRename], ['agent', 'rename', 'w9:p1', client]);

    // Et le nom porté est RELU après coup, pas supposé.
    assert.ok(
      appels.slice(iRename).some((a) => a[0] === 'agent' && a[1] === 'get'),
      'le nom doit être vérifié par relecture après le renommage'
    );
    assert.ok(!appels.some((a) => a[0] === 'pane' && a[1] === 'close'), 'aucune fermeture sur un succès');
  }));

test('un refus de renommage SORTI EN ZÉRO fait échouer la commande — c’est le défaut « code 0 »', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: lieu, refusRenommage: 'sortie-0' });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0, 'herdr a refusé : la commande ne peut pas rendre 0');
    assert.match(r.stderr, /agent_not_found/);
    assert.equal(r.stdout.trim(), '', 'rien ne doit être annoncé comme réussi');
    assert.ok(
      appelsJournalises(journal).some((a) => a[0] === 'pane' && a[1] === 'close' && a[2] === 'w9:p1'),
      'rien ne subsiste d’une naissance ratée — le pane doit être refermé'
    );
  }));

test('un refus de renommage sorti en 1 fait échouer la commande, et referme le pane', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: lieu, refusRenommage: 'sortie-1' });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0);
    assert.ok(appelsJournalises(journal).some((a) => a[0] === 'pane' && a[1] === 'close'));
  }));

test('un agent jamais détecté fait échouer la commande, et ne laisse aucun pane derrière', () =>
  avecLieu((client, lieu) => {
    // 99 refus : l'agent n'apparaît jamais dans la fenêtre d'attente.
    const journal = installerFauxHerdr({ detecteApres: 99, repertoire: lieu });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /aucun agent détecté/);
    assert.ok(appelsJournalises(journal).some((a) => a[0] === 'pane' && a[1] === 'close'));
  }));

test('une session née AILLEURS que dans le lieu fait échouer la commande — elle n’est pas représentante', () =>
  avecLieu((client, lieu) => {
    // Le cas exact trouvé au premier usage réel : le pane tourne dans le répertoire d'où la
    // commande a été lancée. La session s'ouvre, l'agent est nommé — et pourtant ce n'est
    // pas un représentant : il n'a chargé ni le métier ni le registre du lieu.
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: REPO_ROOT });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0, 'un répertoire de travail hors du lieu doit faire échouer la naissance');
    assert.match(r.stderr, /lieu du représentant/);
    assert.ok(r.stderr.includes(lieu), 'le message doit dire où elle aurait dû naître');
    assert.ok(appelsJournalises(journal).some((a) => a[0] === 'pane' && a[1] === 'close'));
  }));

// Relevé en revue de fond : la garde existait dans le code, mais AUCUN test ne l'exerçait —
// la retirer laissait la suite verte. Un garde que rien ne prouve n'est pas un garde.
test('un refus de LANCEMENT fait échouer la commande, et referme le pane', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: lieu, refusLancement: true });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0, 'la session ne s’est pas lancée : la commande ne peut pas rendre 0');
    assert.match(r.stderr, /pane_not_found/);
    assert.equal(r.stdout.trim(), '');
    assert.ok(
      appelsJournalises(journal).some((a) => a[0] === 'pane' && a[1] === 'close' && a[2] === 'w9:p1'),
      'un lancement refusé ne doit pas laisser le pane derrière lui'
    );
    assert.ok(
      !appelsJournalises(journal).some((a) => a[0] === 'agent' && a[1] === 'rename'),
      'inutile de nommer un agent dans un pane où rien n’a été lancé'
    );
  }));

// Relevé en revue de fond : le seul cas « née ailleurs » testé était un répertoire PARENT du
// lieu — plus court, donc structurellement incapable de démasquer une comparaison affaiblie.
// Un frère à préfixe partagé, lui, passerait un `startsWith` et échoue sur l'égalité. C'est
// ce qui verrouille la comparaison exacte contre une régression future.
test('un répertoire FRÈRE à préfixe partagé n’est pas le lieu — la comparaison est exacte, pas par préfixe', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: `${lieu}-bis` });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0, `${lieu}-bis n’est pas ${lieu} — la naissance doit échouer`);
    assert.match(r.stderr, /lieu du représentant/);
    assert.ok(appelsJournalises(journal).some((a) => a[0] === 'pane' && a[1] === 'close'));
  }));

test('un SOUS-répertoire du lieu n’est pas le lieu non plus — la session n’y charge pas le même projet', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ detecteApres: 1, repertoire: join(lieu, '.claude') });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /lieu du représentant/);
    assert.ok(appelsJournalises(journal).some((a) => a[0] === 'pane' && a[1] === 'close'));
  }));

test('un client que herdr ne saurait pas nommer est refusé AVANT qu’un pane existe', () => {
  const journal = installerFauxHerdr();
  // Une majuscule, elle, ne bloque pas : le nom est abaissé (herdr impose les minuscules).
  // Ce qu'aucune normalisation ne rattrape, c'est un caractère que herdr n'accepte pas —
  // ici une espace. Avant, la commande créait le pane, puis butait sur `invalid_agent_name`
  // et le laissait vide.
  const client = `smoke maj ${process.pid}`;
  const lieu = join(REPO_ROOT, '.gestionnaire', client);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), '#\n');
  writeFileSync(join(lieu, 'CONTEXTE.md'), '#\n');
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  try {
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0);
    assert.equal(appelsJournalises(journal).length, 0, 'aucun pane ne doit être créé pour être refermé ensuite');
  } finally {
    rmSync(lieu, { recursive: true, force: true });
    try {
      rmdirSync(join(REPO_ROOT, '.gestionnaire'));
    } catch {
      /* non vide ou déjà absent */
    }
  }
});

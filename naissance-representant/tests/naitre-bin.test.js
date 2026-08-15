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
      ...scenario,
    })
  );
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const sc = JSON.parse(fs.readFileSync(${JSON.stringify(etat)}, 'utf8'));
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');

const sortir = (obj, code) => { process.stdout.write(JSON.stringify(obj)); process.exit(code); };
const refus = (code) => ({ error: { code, message: code + ' pour ' + args.join(' ') } });
const cmd = args.slice(0, 2).join(' ');

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

function appelsJournalises(journal) {
  return readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
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
function lancerNaitre(client, workspace = 'w9') {
  const r = spawnSync(process.execPath, [BIN, client, '--workspace', workspace], {
    env: { ...process.env, NAISSANCE_ESSAIS: '6', NAISSANCE_DELAI_MS: '5' },
  });
  return {
    code: r.status ?? 1,
    stdout: (r.stdout ?? '').toString(),
    stderr: (r.stderr ?? '').toString(),
  };
}

// bin/naitre.js calcule REPO_ROOT depuis SA PROPRE position sur disque (../..) —
// invariable. On ne peut donc pas lui faire croire à un autre dépôt sans le copier ; les
// tests qui suivent posent un lieu réel, temporaire et nommé par PID, sous CE dépôt, et le
// retirent dans un `finally`.

let compteur = 0;
function avecLieu(faire, prefixe = 'smoke') {
  compteur += 1;
  const client = `${prefixe}-${process.pid}-${compteur}`;
  const lieu = join(REPO_ROOT, '.gestionnaire', client);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
  writeFileSync(join(lieu, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
  writeFileSync(join(lieu, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');
  try {
    return faire(client, lieu);
  } finally {
    rmSync(lieu, { recursive: true, force: true });
    // Retire aussi `.gestionnaire/` si ce test l'a créé et qu'il ne reste rien dedans —
    // sinon un répertoire vide traîne dans le dépôt à chaque exécution de la suite.
    try {
      rmdirSync(join(REPO_ROOT, '.gestionnaire'));
    } catch {
      /* non vide (un autre client y vit) ou déjà absent : rien à faire */
    }
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
    // Le pane naît DANS le lieu — le drapeau, pas seulement le `cd` écrit ensuite.
    assert.deepEqual(appels[0].slice(0, 2), ['tab', 'create']);
    assert.equal(appels[0][appels[0].indexOf('--cwd') + 1], lieu);
    // La session est lancée AVANT toute tentative de nommage.
    assert.deepEqual(appels[1], ['pane', 'run', 'w9:p1', `cd ${lieu} && claude`]);

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

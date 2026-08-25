// espace-herdr.test.js — L'ESPACE HERDR : l'ouvrir sur la bonne session, et savoir le défaire.
//
// ⚠️ CE QUE CE FICHIER COUVRE ET QUE `naitre-bin.test.js` NE PEUT PAS COUVRIR. Le double de
// herdr de la suite bout-en-bout rend TOUJOURS la même forme de réponse ; les branches que le
// service réel emprunte parfois — l'identifiant qui arrive par `workspace` plutôt que par
// `root_pane`, la réponse sans identifiant du tout — n'y sont jamais visitées. Une branche
// jamais visitée peut être supprimée sans qu'un essai rougisse.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  commandeOuvrirEspace,
  commandeFermerEspace,
  identifiantDeLEspace,
  ouvrirUnEspaceHerdr,
  fermerLEspaceHerdr,
} from '../src/espace-herdr.js';

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — LES COMMANDES : DES TABLEAUX D'ARGUMENTS, JAMAIS UNE LIGNE DE SHELL

test('ouvrir un espace s’écrit en TABLEAU — aucun shell, comme partout ailleurs dans ce dépôt', () => {
  assert.deepEqual(commandeOuvrirEspace({ cwd: '/un/depot', label: 'e-20260825-0002' }), [
    'workspace', 'create', '--cwd', '/un/depot', '--label', 'e-20260825-0002', '--no-focus',
  ]);
});

// ⚠️ `--no-focus` N'EST PAS UN ORNEMENT. Sans lui, chaque naissance vole l'écran du dirigeant —
// et un orchestrateur qui ouvre six chefs d'équipe le lui volerait six fois.
test('… et il ne vole pas l’écran', () => {
  assert.ok(commandeOuvrirEspace({ cwd: '/d', label: 'x' }).includes('--no-focus'));
});

test('le refermer aussi', () => {
  assert.deepEqual(commandeFermerEspace('w7'), ['workspace', 'close', 'w7']);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — L'IDENTIFIANT : LES DEUX CHEMINS QUE LE SCHÉMA DÉCLARE
//
// ⚠️ Le schéma d'API embarqué (protocole 20) déclare `workspace_created` porteur d'un
// `workspace`, d'un `tab` ET d'un `root_pane`. Le geste d'origine lisait le `root_pane` ; on lit
// les deux plutôt que de parier sur celui qui arrivera. La seconde branche n'est visitée par
// AUCUN essai bout-en-bout — sans ceci, elle pourrait être retirée sans qu'un rouge apparaisse.

test('l’identifiant se lit dans le root_pane — le chemin que le geste d’origine empruntait', () => {
  assert.equal(identifiantDeLEspace({ result: { root_pane: { workspace_id: 'wA' } } }), 'wA');
});

test('… ou dans le workspace, quand la réponse ne porte pas de root_pane', () => {
  assert.equal(identifiantDeLEspace({ result: { workspace: { workspace_id: 'wB' } } }), 'wB');
});

test('et une réponse qui n’en porte AUCUN rend null — on ne devine pas où l’agent naîtrait', () => {
  assert.equal(identifiantDeLEspace({ result: { type: 'workspace_created' } }), null);
  assert.equal(identifiantDeLEspace(null), null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — L'OUVERTURE : UN VERDICT, JAMAIS UNE EXCEPTION

test('l’ouverture rend l’identifiant, et parle à la SESSION VISÉE', async () => {
  const vus = [];
  const appeler = async (commande, options) => {
    vus.push({ commande, options });
    return { ok: true, reponse: { result: { root_pane: { workspace_id: 'wA' } } }, message: '' };
  };
  const r = await ouvrirUnEspaceHerdr({ cwd: '/d', label: 'x', socket: '/tmp/s.sock', appeler });

  assert.deepEqual(r, { ok: true, id: 'wA' });
  // ⚠️ LE SOCKET EST LA CORRECTION EN SOI : la porte d'entrée appelait `herdr` NU, donc ouvrait
  // dans la session par défaut — c'est-à-dire dans rien, depuis un terminal ordinaire.
  assert.equal(vus[0].options.socket, '/tmp/s.sock');
});

test('un herdr qui refuse rend un verdict qui NOMME le geste — jamais une exception', async () => {
  const appeler = async () => ({ ok: false, reponse: null, message: 'herdr est introuvable' });
  const r = await ouvrirUnEspaceHerdr({ cwd: '/d', label: 'x', socket: null, appeler });

  assert.equal(r.ok, false);
  assert.match(r.message, /herdr est introuvable/, 'la cause remonte telle quelle');
  assert.match(r.message, /herdr status/, 'et le geste qui lève le blocage');
  assert.match(r.message, /--workspace/, 'ainsi que la voie de contournement');
});

test('un succès SANS identifiant est un échec — un espace qu’on ne sait pas nommer n’est pas un espace', async () => {
  const appeler = async () => ({ ok: true, reponse: { result: { type: 'workspace_created' } }, message: '' });
  const r = await ouvrirUnEspaceHerdr({ cwd: '/d', label: 'x', socket: null, appeler });

  assert.equal(r.ok, false);
  assert.match(r.message, /identifiant/i);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 — LE DÉFAIRE : SYNCHRONE, ET IL NE JETTE JAMAIS
//
// ⚠️ IL EST APPELÉ DEPUIS `process.on('exit')`, où plus rien d'asynchrone ne s'exécute et où une
// exception emporterait le code de sortie. Les deux propriétés sont éprouvées ici, sur un double
// d'`execFileSync` — le vrai binaire n'est jamais appelé par ce fichier.

test('le défaire passe la commande, et le socket de la session', () => {
  const vus = [];
  const executer = (bin, argv, options) => {
    vus.push({ bin, argv, socket: options?.env?.HERDR_SOCKET_PATH });
    return '';
  };
  const r = fermerLEspaceHerdr('w7', { socket: '/tmp/s.sock', executer });

  assert.deepEqual(r, { ok: true, message: '' });
  assert.equal(vus[0].bin, 'herdr');
  assert.deepEqual(vus[0].argv, ['workspace', 'close', 'w7']);
  assert.equal(vus[0].socket, '/tmp/s.sock', 'sans lui, on refermerait un espace d’une AUTRE session');
});

test('sans socket, l’environnement n’est pas réécrit — on n’efface pas celui de l’appelant', () => {
  const vus = [];
  fermerLEspaceHerdr('w7', { socket: null, executer: (bin, argv, options) => (vus.push(options), '') });
  assert.equal('env' in vus[0], false);
});

test('🔴 un défaire qui échoue rend un verdict — il ne JETTE pas depuis un gestionnaire de sortie', () => {
  const r = fermerLEspaceHerdr('w7', {
    executer: () => {
      const err = new Error('exit 1');
      err.stderr = 'workspace_not_found pour workspace close w7';
      throw err;
    },
  });
  assert.equal(r.ok, false);
  assert.match(r.message, /workspace_not_found/, 'la parole de herdr est relayée, pas remplacée par une formule');
});

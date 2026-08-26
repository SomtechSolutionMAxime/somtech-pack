// naitre-bin.test.js — le fichier exécutable réel (bin/naitre.js), avec un FAUX herdr en
// tête de PATH — même technique que ligne-directe/tests/herdr.test.js. Aucun vrai pane
// n'est créé, aucune vraie session herdr n'est touchée.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE DOUBLE A COÛTÉ, ET CE QU'IL DIT MAINTENANT
//
// L'ancien double répondait `{"result":{"ok":true}}` à TOUT ce qui n'était pas `tab create`.
// Il disait donc « oui » à `agent rename` sur un pane où aucun agent n'existait encore —
// alors que le vrai service répond `{"error":{"code":"agent_not_found"}}` et sort en 1. Les
// 52 tests du lot étaient verts et le tout premier geste de la chaîne échouait au premier
// usage réel : septième occurrence du motif « le double est plus indulgent que le vrai »
// (T-20260809-0023).
//
// ⚠️ HUITIÈME OCCURRENCE, SUR LE MÊME FICHIER : le double disait `{"result":{"ok":true}}` d'un
// `pane run` réussi, alors que le vrai ne rend RIEN (sortie vide, code 0). La règle qui en est
// sortie tient en une ligne, et elle commande tout ce qui suit :
//
//     LE DOUBLE DIT CE QUE LE SERVICE DIT — jamais ce qui arrange l'essai.
//
// CE QU'IL REPRODUIT, MESURÉ CONTRE LE VRAI herdr LE 2026-08-16 (T-20260816-0038) :
//
//   • `agent start` en succès rend un `result` porteur d'un `agent` ET de l'`argv` exact
//     transmis à `claude` — c'est ce qui rend éprouvable que `--model` et `--permission-mode`
//     partent réellement, au lieu d'être seulement affichés dans le JSON de sortie ;
//   • `agent start` en échec rend `{"error":{"code":"agent_pane_not_found",…}}` ;
//   • ⚠️ ET SON SUCCÈS ANNONCE `agent_status: idle` + `interactive_ready: true` MÊME QUAND
//     L'AGENT EST PARQUÉ DERRIÈRE UN MODAL. C'est le piège central de ce lot : le double doit
//     le tendre, sinon aucun essai ne peut prouver que la commande ne s'y laisse pas prendre
//     (T-20260816-0033). Les scénarios `ecran: 'confiance'|'inconnu'` disent donc « prêt » à
//     `agent start` et montrent un modal à `agent read` ;
//   • `agent read` rend du TEXTE BRUT de terminal, PAS du JSON ;
//   • ce qu'il ne connaît pas, il le REFUSE — un herdr appelé sans commande ne répond pas
//     « d'accord ».
//
// Il reste un double : ce qu'il ne peut pas prouver — qu'une VRAIE session naît bien dans le
// lieu — est prouvé contre le vrai gestionnaire de panes par
// `scripts/tests/test-naissance-representant-reel.sh`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { poserGarde, MODELE_PAR_DEFAUT, MODE_PAR_DEFAUT } from '../src/naissance.js';
// ⚠️ LA PHRASE EST IMPORTÉE, JAMAIS RECOPIÉE. Ce qu'on éprouve plus bas n'est pas une tournure —
// c'est que CE QUE CETTE FONCTION PRODUIT parvienne à l'humain. Recopier son texte ici en ferait
// un banc qui rougit à la première reformulation légitime, et qui reste vert le jour où la ligne
// disparaît du binaire : l'inverse exact de ce qu'on veut garder.
import { phraseDuMandatIncomplet } from '../src/declaration.js';
import { estUneRiviere, FICHIER_NOM_AGENT, nomInscritDansLeLieu } from '../../ligne-directe/src/nom-de-riviere.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_NAISSANCE = resolve(HERE, '..');
const REPO_ROOT = resolve(REPO_NAISSANCE, '..');
const BIN = join(REPO_NAISSANCE, 'bin', 'naitre.js');

let bac;
let pathOriginal;

// ═══════════════════════════════════════════════════════════════════════════════════════
// LES ÉCRANS — RECOPIÉS DU VRAI, jamais écrits de mémoire.
//
// Mesurés le 2026-08-16 sur Claude Code 2.1.233 en faisant naître un agent d'essai (ce sont
// les mêmes que `ligne-directe/tests/ecran.test.js`, et c'est délibéré : deux jeux d'écrans
// pour un seul lecteur divergeraient, et le second à diverger serait celui qu'on ne relit pas).
// Un écran inventé prouverait que la commande est d'accord avec l'idée qu'on se fait de
// l'écran, pas avec l'écran.

const FILET = '─'.repeat(120);

/** L'écran NORMAL — une invite prête à recevoir, encadrée par ses deux filets. */
const ECRAN_PRET = `${FILET}
❯
${FILET}
  ⏵⏵ accept edits on (shift+tab to cycle) · ← for agents
`;

/** L'écran de CONFIANCE — connu, donc nommable, donc porteur d'un geste. */
const ECRAN_CONFIANCE = `${FILET}
 Accessing workspace:

 /tmp/essai/.orchestrateur/essai2

 Quick safety check: Is this a project you created or one you trust? (Like your own code, a well-known open source project, or work from your team). If not, take a moment to review what's in this folder first.

 Claude Code'll be able to read, edit, and execute files here.

 ❯ 1. Yes, I trust this folder
   2. No, continue without these permissions

 Enter to confirm · Esc to cancel
`;

/** Un écran qu'aucun motif ne connaît — le cas qui décide de tout. */
const ECRAN_INCONNU = `${FILET}
 ^ ce que verrait un utilisateur de Somcraft
   en ouvrant le CHANGELOG du produit
Notes: press n to add notes
Chat about this
Enter to select · ↑/↓ to navigate · n to add notes · Esc to cancel
`;

/**
 * L'ÉCRAN DES SERVEURS MCP — le SEUL que la naissance franchit, et le seul qui cède.
 *
 * MESURÉ le 2026-08-16 : `enter` confirme les serveurs déjà cochés, mais il faut lui laisser un
 * instant — un relire-tout-de-suite avait fait conclure à tort que la touche ne marchait pas
 * (T-20260815-0014). Franchir n'est pas deviner : l'écran est reconnu par son texte, le geste
 * est mesuré, et on RELIT ensuite. C'est la relecture qui en fait un fait plutôt qu'un pari.
 */
const ECRAN_SERVEURS = `${FILET}
  2 new MCP servers found in this project
  Select any you wish to enable.

  ❯ [✔] servicedesk
    [✔] somcraft
 Space to select · Enter to confirm · Esc to reject all
`;

const ECRANS = {
  pret: ECRAN_PRET,
  confiance: ECRAN_CONFIANCE,
  inconnu: ECRAN_INCONNU,
  serveurs: ECRAN_SERVEURS,
  // Le MÊME écran, mais qui ne cède jamais : un écran qu'on croit reconnaître et qui revient.
  // Insister indéfiniment redeviendrait « tenter sa chance » ; la commande doit s'arrêter.
  'serveurs-tetu': ECRAN_SERVEURS,
  // `illisible` n'a pas de texte : `agent read` ÉCHOUE, et ne rend rien. On ne remplace pas
  // une lecture ratée par une chaîne vide — « je n'ai pas pu lire » n'est pas « il n'y a rien ».
  illisible: null,
};

/**
 * Un faux `herdr` fidèle au vrai sur les points qui ont mordu. Son comportement est piloté
 * par un scénario écrit sur disque (un sous-processus ne partage pas la mémoire du test) :
 *
 *   espaces    — les espaces que la SESSION VISÉE porte (les identifiants ne sont pas
 *                globalement uniques : un essai doit pouvoir décrire une session qui ne porte
 *                PAS celui qu'on demande — T-20260814-0120) ;
 *   demarrage  — null | 'refus' (agent_pane_not_found, sortie 1)
 *                     | 'sans-agent' (SORTIE 0, `agent_started`, et AUCUN agent dans la
 *                       réponse : le défaut historique « code 0 alors que rien n'a abouti ») ;
 *   busyPendant— combien de fois `agent start` refuse d'abord avec `agent_pane_busy` — l'état
 *                TRANSITOIRE d'un onglet dont le shell démarre encore (mesuré : le refus tombe
 *                sur un pane créé une fraction de seconde plus tôt) ;
 *   ecran      — 'pret' | 'confiance' | 'inconnu' | 'illisible' ;
 *   repertoire — ce que `agent get` rapporte comme répertoire de travail réel ;
 *   nomPorte   — le nom que `agent get` rapporte, quand il diffère de celui demandé.
 */
function installerFauxHerdr(scenario = {}) {
  const journal = join(bac, 'appels.jsonl');
  const etat = join(bac, 'scenario.json');
  const ecranFichier = join(bac, 'ecran.txt');
  const ecranPretFichier = join(bac, 'ecran-pret.txt');
  const sc = {
    espaces: ['w9'],
    demarrage: null,
    busyPendant: 0,
    ecran: 'pret',
    repertoire: null,
    nomPorte: null,
    // LE PARC DES NOMS que `agent list` rend — vide par défaut, c'est-à-dire un poste où
    // aucune rivière n'est prise. Les essais qui éprouvent la renaissance le peuplent.
    agents: [],
    // L'espace que `workspace create` rend, et les deux façons dont herdr peut refuser d'ouvrir
    // ou de refermer — les deux moitiés dont dépend la promesse « un refus ne laisse rien ».
    espaceCree: 'wNEUF',
    creationRefusee: false,
    fermetureRefusee: false,
    promptRefuse: false,
    // ⚠️ L'AGENT QUI A DÉJÀ ÉCRIT. Sans lui, aucun essai bout-en-bout ne peut atteindre l'état
    // « un refus tombe sur un arbre qui porte du travail » — celui où un défaire aveugle détruit.
    travailEcrit: null,
    ...scenario,
  };
  writeFileSync(journal, '');
  writeFileSync(etat, JSON.stringify(sc));
  writeFileSync(ecranFichier, ECRANS[sc.ecran] ?? '');
  writeFileSync(ecranPretFichier, ECRAN_PRET);

  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const sc = JSON.parse(fs.readFileSync(${JSON.stringify(etat)}, 'utf8'));
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse).map((e) => e.a);
fs.appendFileSync(JOURNAL, JSON.stringify({ a: args, s: process.env.HERDR_SOCKET_PATH || null }) + '\\n');

const sortir = (obj, code) => { process.stdout.write(JSON.stringify(obj)); process.exit(code); };
const refus = (code) => ({ error: { code: code, message: code + ' pour ' + args.join(' ') } });
const cmd = args.slice(0, 2).join(' ');
const apres = (drapeau) => args[args.indexOf(drapeau) + 1];

if (cmd === 'workspace list') {
  sortir({ result: { workspaces: (sc.espaces || []).map((w) => ({ workspace_id: w, label: 'essai ' + w })) } }, 0);
}

// ═══ \`workspace create\` / \`workspace close\` — la naissance les fait elle-même depuis
// D-20260825-0002 (elle ouvre son espace APRÈS ses refus, et le referme si elle échoue ensuite).
//
// ⚠️ FORMES PRISES DU SCHÉMA D'API EMBARQUÉ (\`herdr api schema --json\`, protocole 20), pas de
// mémoire : \`workspace_created\` porte un \`workspace\`, un \`tab\` et un \`root_pane\` ; aucune
// variante \`workspace_closed\` n'existe côté RÉPONSE (elle n'existe qu'en ÉVÉNEMENT), la
// fermeture retombe donc sur la variante générique \`ok\`. Ce qui n'a PAS été mesuré contre le
// service vivant est dit ici plutôt que présenté comme un fait : ouvrir puis fermer un espace
// sur le poste du dirigeant serait un effet de bord visible, et ces essais n'en produisent aucun.
if (cmd === 'workspace create') {
  if (sc.creationRefusee) sortir(refus('workspace_create_failed'), 1);
  const id = sc.espaceCree || 'wNEUF';
  sortir({ result: { type: 'workspace_created', workspace: { workspace_id: id, label: apres('--label') }, tab: { tab_id: id + ':t1' }, root_pane: { pane_id: id + ':p1', workspace_id: id } } }, 0);
}
if (cmd === 'workspace close') {
  if (sc.fermetureRefusee) sortir(refus('workspace_not_found'), 1);
  sortir({ result: { type: 'ok' } }, 0);
}

// ⚠️ LE PANE NAÎT DANS L'ESPACE QU'ON LUI DONNE — et pas dans un « w9 » écrit en dur. Sans ça,
// un essai qui laisse la naissance OUVRIR son espace verrait quand même un pane de « w9 » : le
// double serait plus indulgent que le vrai, et prouverait le contraire de ce qu'il mesure.
if (cmd === 'tab create') {
  const ws = apres('--workspace');
  sortir({ result: { root_pane: { pane_id: ws + ':p1', workspace_id: ws } } }, 0);
}

// ═══ \`agent start\` — la forme EXACTE mesurée contre le vrai service le 2026-08-16.
if (cmd === 'agent start') {
  const pane = apres('--pane');
  // L'agent naît et se met au travail : ce qu'il écrit est là avant que la suite refuse.
  if (sc.travailEcrit) fs.writeFileSync(sc.travailEcrit, 'trois heures de travail\\n');
  // ⚠️ UN PANE QUI VIENT DE NAÎTRE N'EST PAS ENCORE UN SHELL — mesuré : herdr refuse
  // « agent_pane_busy … is not an available shell » sur un onglet créé une fraction de seconde
  // plus tôt. C'est un état TRANSITOIRE, et le seul que la commande ait le droit d'attendre.
  if (passes.filter((a) => a[0] === 'agent' && a[1] === 'start').length < (sc.busyPendant || 0)) {
    sortir({ error: { code: 'agent_pane_busy', message: 'pane ' + pane + ' is not an available shell' }, id: 'cli:agent:start' }, 1);
  }
  if (sc.demarrage === 'refus') {
    sortir({ error: { code: 'agent_pane_not_found', message: 'agent target ' + pane + ' not found' }, id: 'cli:agent:start' }, 1);
  }
  const sep = args.indexOf('--');
  const argv = ['claude'].concat(sep === -1 ? [] : args.slice(sep + 1));
  // LE CHEMIN SILENCIEUX : le service dit \`agent_started\` en sortant ZÉRO, et sa réponse ne
  // porte AUCUN agent. Un appelant qui lit le code de sortie croit avoir fait naître quelqu'un.
  if (sc.demarrage === 'sans-agent') {
    sortir({ id: 'cli:agent:start', result: { argv: argv, type: 'agent_started' } }, 0);
  }
  sortir({
    id: 'cli:agent:start',
    result: {
      agent: {
        agent: 'claude',
        agent_session: { id: 'sess-essai', kind: 'claude' },
        // ⚠️ CE COUPLE MENT, ET C'EST LE FAIT MESURÉ : herdr annonce l'agent disponible
        // PENDANT qu'il est parqué derrière un modal. Le double doit le dire aussi, sinon
        // aucun essai ne peut prouver que la commande lit l'écran plutôt que ce booléen.
        agent_status: 'idle',
        interactive_ready: true,
        cwd: sc.repertoire,
        foreground_cwd: sc.repertoire,
        name: args[2],
        pane_id: pane,
        tab_id: 'w9:t1',
        workspace_id: 'w9',
      },
      argv: argv,
      type: 'agent_started',
    },
  }, 0);
}

// \`agent read\` rend du TEXTE BRUT de terminal, pas du JSON. Une lecture ratée n'écrit RIEN.
if (cmd === 'agent read') {
  if (sc.ecran === 'illisible') process.exit(1);
  // ⚠️ L'ÉCRAN QUI CÈDE — et il ne cède qu'à la touche MESURÉE. Un double qui rendrait « prêt »
  // sans avoir vu la touche laisserait passer une naissance qui ne franchit rien ; un double qui
  // ne céderait jamais empêcherait de prouver le franchissement. Les deux moitiés comptent, et
  // le scénario « serveurs-tetu » existe pour la seconde : le même écran, qui ne cède pas.
  const aFranchi = passes.some((a) => a[0] === 'agent' && a[1] === 'send-keys' && a.includes('enter'));
  const fichier = sc.ecran === 'serveurs' && aFranchi ? ${JSON.stringify(ecranPretFichier)} : ${JSON.stringify(ecranFichier)};
  process.stdout.write(fs.readFileSync(fichier, 'utf8'));
  process.exit(0);
}

if (cmd === 'agent get') {
  const ne = passes.find((a) => a[0] === 'agent' && a[1] === 'start');
  sortir({
    result: {
      type: 'agent_info',
      agent: {
        pane_id: args[2],
        agent_status: 'idle',
        name: sc.nomPorte || (ne ? ne[2] : null),
        cwd: sc.repertoire,
        foreground_cwd: sc.repertoire,
      },
    },
  }, 0);
}

// \`agent list\` — la forme EXACTE mesurée le 2026-08-18 sur ce poste : un \`result.agents\`
// dont chaque entrée porte un \`name\`. C'est ce que le relevé du parc lit pour savoir quelles
// rivières sont déjà portées (E-20260818-0017).
if (cmd === 'agent list') {
  sortir({ id: 'cli:agent:list', result: { agents: (sc.agents || []).map((n) => ({ agent: 'claude', name: n, pane_id: 'w9:pX' })) } }, 0);
}

// ⚠️ UN REFUS DE \`agent prompt\` EST UN VRAI MODE DE PANNE — une session qui a perdu son agent
// entre le moment où on l'a vue prête et celui où on lui parle. Sans lui, aucun essai ne peut
// atteindre le chemin « née, vivante, mais qui n'a pas pris son amorce ».
if (cmd === 'agent prompt') {
  if (sc.promptRefuse) sortir(refus('agent_not_found'), 1);
  sortir({ result: { type: 'agent_prompted' } }, 0);
}
if (cmd === 'agent send-keys') sortir({ result: { type: 'keys_sent' } }, 0);
if (cmd === 'pane close') sortir({ result: { type: 'pane_closed' } }, 0);

// ⚠️ CE QU'IL NE CONNAÎT PAS, IL LE REFUSE. Le vrai herdr ne répond pas « d'accord » à une
// commande vide ou inconnue — et un double qui le ferait rendrait invisible l'appel malformé,
// c'est-à-dire exactement la classe de défaut que ce fichier existe pour attraper.
sortir(refus('unknown_command'), 1);
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

const aFerme = (journal, pane = 'w9:p1') =>
  appelsJournalises(journal).some((a) => a[0] === 'pane' && a[1] === 'close' && a[2] === pane);

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

function lancerNaitre(
  client,
  {
    workspace = 'w9',
    amorce = null,
    modele = null,
    mode = null,
    role = null,
    essais = '3',
    coordonnateur = null,
    base = null,
    horodatage = null,
    session = null,
    // ⚠️ UNE SEULE PORTE POUR L'ENVIRONNEMENT, jamais un second lanceur à côté. Les essais du
    // chef d'équipe doivent mettre trois racines du poste hors de portée (`~/worktrees`,
    // `~/.somtech/naissances`, `~/.claude.json`) ; leur donner leur propre lanceur ferait deux
    // cloisons pour une seule chaîne, et une cloison dupliquée est une cloison qu'on oublie
    // d'un côté — le motif « une porte sur deux » que ce fichier documente déjà.
    env = {},
    // ⚠️ UN MODULE CHARGÉ AVANT LE BINAIRE, et une seule raison de s'en servir : remplacer une
    // frontière que le sous-processus ne partage pas avec le banc. Le PATH remplace déjà `herdr` ;
    // ceci remplace `globalThis.fetch`, c'est-à-dire le ServiceDesk. Rien d'autre ne passe par
    // là — ce n'est pas une porte pour changer le comportement de la commande.
    preload = null,
  } = {}
) {
  // ⚠️ `workspace: null` OMET LE DRAPEAU — c'est LA POPULATION RÉELLE, celle que le métier
  // prescrit (`pack agent naitre <code> --role chef-equipe --depot <d> --coordonnateur <n>`).
  // Tous les essais de ce fichier passaient `--workspace w9`, ce qui court-circuitait le chemin
  // où l'espace herdr est ouvert — et c'est très exactement pour ça que le défaut ① a survécu.
  const args = [...(preload ? ['--import', preload] : []), BIN, client, ...(workspace ? ['--workspace', workspace] : [])];
  if (depotCourant) args.push('--depot', depotCourant);
  if (amorce) args.push('--amorce-texte', amorce);
  if (modele) args.push('--modele', modele);
  if (mode) args.push('--mode', mode);
  if (role) args.push('--role', role);
  if (coordonnateur) args.push('--coordonnateur', coordonnateur);
  if (base) args.push('--base', base);
  if (horodatage) args.push('--horodatage', horodatage);
  if (session) args.push('--session', session);
  // UNE seule session désignée : le cas non ambigu, celui qui doit continuer à marcher sans
  // que l'appelant précise quoi que ce soit. Les cas à plusieurs sessions sont éprouvés sur
  // la résolution elle-même (`tests/session.test.js`), sans faire naître personne.
  const r = spawnSync(process.execPath, args, {
    env: {
      ...process.env,
      NAISSANCE_ESSAIS: essais,
      NAISSANCE_DELAI_MS: '5',
      HERDR_SESSIONS_ESSAIS: sessionsDesEssais,
      HERDR_SOCKET_PATH: '',
      ...env,
    },
  });
  return {
    code: r.status ?? 1,
    stdout: (r.stdout ?? '').toString(),
    stderr: (r.stderr ?? '').toString(),
  };
}

/** Ce que git dit du dépôt d'essai — jamais un `status` global, jamais deviné. */
function gitDit(depot, ...args) {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Tous les fichiers que l'historique porte, tous commits confondus. */
function fichiersVerses(depot) {
  const sortie = gitDit(depot, 'log', '--all', '--name-only', '--format=');
  return [...new Set(sortie.split('\n').map((l) => l.trim()).filter(Boolean))];
}

/**
 * Combien de commits porte le dépôt.
 *
 * ⚠️ UN DÉPÔT SANS LE MOINDRE COMMIT FAIT ÉCHOUER `git log` (« does not have any commits yet »),
 * et c'est justement l'état qu'on veut pouvoir mesurer : « zéro » est une réponse, pas une
 * panne. La traduire en exception ferait rougir le contrôle pour la raison inverse de celle
 * qu'il surveille.
 */
const nombreDeCommits = (depot) => {
  try {
    const sortie = gitDit(depot, 'log', '--format=%H');
    return sortie ? sortie.split('\n').length : 0;
  } catch {
    return 0;
  }
};

// CHAQUE TEST A SON PROPRE DÉPÔT GIT, JETABLE — et ce n'est pas du confort.
//
// Ces tests posaient jusqu'ici leur lieu SOUS CE DÉPÔT-CI, faute de pouvoir désigner un
// autre dépôt : un commentaire l'affirmait ici même (« on ne peut pas lui faire croire à un
// autre dépôt sans le copier »). C'était faux — `--depot` existe et la commande l'accepte
// depuis longtemps. Le commentaire décrivait un état révolu, et personne ne l'avait relu.
//
// Deux raisons de l'avoir corrigé :
//   • la naissance VERSE désormais le lieu elle-même (T-20260816-0038), et le gate du commit
//     (T-20260814-0139) reste entier derrière : ces tests écriraient donc des commits dans le
//     dépôt de travail à chaque exécution ;
//   • éprouver le versement exige un vrai dépôt qu'on peut committer sans salir celui dans
//     lequel on travaille.
//
// Les options décrivent des états RÉELS, tous rencontrés sur un poste :
//   verser: false → un lieu complet sur disque, dans aucun commit (3 lieux clients sur 5) ;
//   git:    false → un répertoire qui n'est pas un dépôt (une installation de poste) ;
//   poser:  false → aucun lieu du tout.
let compteur = 0;
function avecLieu(faire, prefixe = 'smoke', { verser = true, git: avecGit = true, poser = true, nom = null, role = 'representant' } = {}) {
  compteur += 1;
  const client = nom || `${prefixe}-${process.pid}-${compteur}`;
  const depot = mkdtempSync(join(tmpdir(), 'smtk-naitre-depot-'));
  const git = (...args) => execFileSync('git', ['-C', depot, ...args], { stdio: 'ignore' });
  if (avecGit) {
    git('init', '-q');
    git('config', 'user.email', 'essai@somtech.ca');
    git('config', 'user.name', 'essai');
  }

  // ⚠️ LE LIEU EST CELUI DU RÔLE, et son en-tête aussi : `roles.js` reconnaît un lieu par ce
  // qu'il CONTIENT, pas seulement par son chemin. Un lieu d'orchestrateur portant l'en-tête du
  // représentant serait un lieu que la garde ne reconnaîtrait pas — le double serait alors plus
  // indulgent que le vrai, motif que ce fichier documente en tête et refuse.
  const dossier = role === 'orchestrateur' ? '.orchestrateur' : '.gestionnaire';
  const enTetes = role === 'orchestrateur'
    ? ["# Tu es l'orchestrateur de ce chantier\n", '# Ce qui est propre à ce dépôt\n']
    : ['# Tu es le représentant de ce client\n', "# Ce qu'on sait de ce client\n"];
  const lieu = join(depot, dossier, client);
  if (poser) {
    mkdirSync(join(lieu, '.claude'), { recursive: true });
    writeFileSync(join(lieu, 'CLAUDE.md'), enTetes[0]);
    writeFileSync(join(lieu, 'CONTEXTE.md'), enTetes[1]);
    writeFileSync(join(lieu, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
    writeFileSync(join(lieu, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');
  }
  if (avecGit && verser && poser) {
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

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — CE QUI DOIT ÊTRE REFUSÉ AVANT QUE QUOI QUE CE SOIT EXISTE

// ⚠️ LA COMMANDE POSE LE LIEU D'UN ORCHESTRATEUR, JAMAIS CELUI D'UN REPRÉSENTANT — et le refus
// n'est pas de la paresse. Le lieu d'un représentant se branche sur un canal que le client
// voit : sa pose exige un canal et un dirigeant, et le dirigeant a tranché le 2026-08-16
// qu'elle garde sa revue. Ne pas intervenir ne veut pas dire deviner : le refus NOMME le geste.
test('LA COMMANDE RÉELLE DIT QU’UN LIEU NE TIENT QU’À UNE BRANCHE — à la naissance, pas plus tard', () =>
  avecLieu((client, lieu, depot) => {
    // ⚠️ L'ESSAI QUI MANQUAIT, ET SON ABSENCE A VALU UN REJET. Le module de jugement avait ses
    // propres essais, tous verts ; la fonction était exportée ; et RIEN NE L'APPELAIT en
    // production. La garde existait dans le dépôt et nulle part dans la vie d'un agent —
    // exactement le défaut que ce dépôt ferme partout ailleurs, commis ici par son auteur.
    //
    // Le lieu est versé sur une branche de travail, et `main` ne le porte pas : c'est le cas
    // mesuré cinq fois en deux jours, et le pire d'entre eux — tout paraît normal tant que
    // personne ne change de branche.
    const git = (...args) => execFileSync('git', ['-C', depot, ...args], { stdio: 'ignore' });
    git('branch', '-M', 'chore/lieu-du-client');

    const r = lancerNaitre(client);

    assert.match(r.stderr, /une seule branche/i, 'la commande le DIT, elle ne se contente pas de le savoir');
    assert.match(r.stderr, new RegExp(client), 'avec le lieu réel, pas une formule');
    assert.match(r.stderr, /verse|main/i, 'et le geste qui met à l’abri');
    // ⚠️ ET JAMAIS le geste qui écrase le travail d'un autre.
    assert.ok(!/checkout <branche>|rétablis la branche/i.test(r.stderr), 'aucune invitation à rétablir la branche');
  }, 'expose'));

test('ET ELLE SE TAIT QUAND LE LIEU EST PORTÉ PAR LA BRANCHE PAR DÉFAUT — le cas de tous les jours', () =>
  avecLieu((client) => {
    // La moitié qui protège : une naissance qui avertit à chaque fois cesse d'être lue. Le
    // dépôt d'essai est sur `main` par défaut et le lieu y est versé — rien à signaler.
    const r = lancerNaitre(client);
    assert.ok(!/une seule branche/i.test(r.stderr), `rien ne devait être signalé — dit : ${r.stderr.slice(0, 120)}`);
  }, 'sain'));

test('sans lieu, un REPRÉSENTANT n’est pas posé d’autorité — le refus nomme /gestionnaire-client, et rien n’est écrit', () =>
  avecLieu(
    (client, lieu, depot) => {
      const journal = installerFauxHerdr();

      const r = lancerNaitre(client);

      assert.equal(r.code, 1, `refus attendu — stderr: ${r.stderr}`);
      assert.match(r.stderr, /\/gestionnaire-client/, 'le refus doit NOMMER la compétence qui lève le blocage');
      assert.match(r.stderr, /canal/i, 'et dire POURQUOI cette pose garde sa revue, sinon il passe pour un caprice');
      assert.match(r.stderr, new RegExp(client), 'et nommer celui dont le lieu manque');

      // Rien n'est posé — la preuve est l'absence, pas la phrase.
      assert.equal(existsSync(lieu), false, 'aucun lieu ne doit avoir été créé par un refus');
      assert.equal(appelsJournalises(journal).length, 0, 'aucun appel herdr : le refus tombe avant tout');
      assert.equal(nombreDeCommits(depot), 0, 'et aucun commit — la commande ne verse pas ce qu’elle n’a pas posé');
      assert.equal(r.stdout, '', 'rien n’est rendu qui ressemblerait à un succès');
    },
    'smoke',
    { poser: false }
  ));

// ⚠️ LE GATE DU COMMIT RESTE ENTIER (T-20260814-0139) — c'est le geste HUMAIN qui le satisfaisait
// qui disparaît (T-20260816-0038). Quand la commande ne PEUT PAS verser, elle refuse, et son
// refus ne laisse rien derrière lui : il tombe avant `poserGarde` et avant le moindre onglet.
// Le cas réel : la commande lancée sur une installation de poste, hors de tout dépôt.
test('un dépôt que git ne connaît pas fait REFUSER le versement — aucune écriture, aucun onglet', () =>
  avecLieu(
    (client, lieu) => {
      const journal = installerFauxHerdr();
      const avant = readFileSync(join(lieu, '.claude', 'settings.json'));

      const r = lancerNaitre(client);

      assert.equal(r.code, 1, `refus attendu — stderr: ${r.stderr}`);
      assert.match(r.stderr, /n’est pas un dépôt git/, 'le refus doit dire CE QUI manque');
      assert.match(r.stderr, /git init|--depot/, 'et NOMMER le geste qui le lève — c’est la condition posée');

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
    { git: false }
  ));

// ⚠️ UNE PRÉCONDITION SE VÉRIFIE AVANT D'AGIR — après, ce n'est plus une précondition, c'est un
// regret. La commande POSE le lieu d'un orchestrateur : si elle posait d'abord et découvrait
// ensuite qu'aucun commit ne pourra jamais le porter, elle laisserait un lieu sur disque sur un
// chemin d'échec. C'est le demi-succès qu'elle promet de ne jamais rendre.
test('hors dépôt git, un ORCHESTRATEUR n’est pas posé à moitié — rien n’arrive sur le disque', () =>
  avecLieu(
    (client, lieu, depot) => {
      const journal = installerFauxHerdr();
      const lieuOrchestrateur = join(depot, '.orchestrateur', client);

      const r = lancerNaitre(client, { role: 'orchestrateur' });

      assert.equal(r.code, 1, `refus attendu — stderr: ${r.stderr}`);
      assert.match(r.stderr, /n’est pas un dépôt git/);
      assert.match(r.stderr, /Rien n’a été posé|rien n’a été posé/, 'le refus doit DIRE que le disque est intact');
      assert.equal(existsSync(lieuOrchestrateur), false, 'aucun lieu ne doit rester derrière un refus');
      assert.equal(existsSync(join(depot, '.orchestrateur')), false, 'pas même le dossier de rôle');
      assert.equal(appelsJournalises(journal).length, 0, 'et aucun appel herdr');
    },
    'smoke',
    { git: false, poser: false }
  ));

test('un nom que herdr refuserait échoue AVANT qu’un pane existe', () =>
  avecLieu(
    (client, lieu, depot) => {
      const journal = installerFauxHerdr();
      // 33 caractères : un nom de dossier parfaitement valide, et un agent impossible pour
      // herdr (`invalid_agent_name`, 32 au plus). Avant, la commande créait le pane, butait
      // sur le renommage, et le laissait vide.
      assert.equal(client.length, 33, 'ce cas n’a de sens que si le nom dépasse ce que herdr accepte');

      const r = lancerNaitre(client);

      assert.equal(r.code, 1, `refus attendu — stderr: ${r.stderr}`);
      assert.match(r.stderr, /minuscule/, 'le refus doit dire la règle de herdr, pas « lieu absent »');
      assert.equal(appelsJournalises(journal).length, 0, 'aucun pane ne doit être créé pour être refermé ensuite');
      assert.equal(nombreDeCommits(depot), 1, 'et rien de neuf n’est versé — seul le commit de la pose subsiste');
      assert.deepEqual(
        JSON.parse(readFileSync(join(lieu, '.claude', 'settings.json'), 'utf8')).hooks,
        undefined,
        'la garde n’a pas été posée : le refus tombe avant toute écriture'
      );
    },
    'smoke',
    { nom: `a${'b'.repeat(32)}` }
  ));

test('naitre.js exige --workspace', () => {
  assert.throws(() => execFileSync(process.execPath, [BIN, 'un-client'], { stdio: 'pipe' }));
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — LE VERSEMENT, FAIT PAR LA COMMANDE ELLE-MÊME (T-20260816-0038)

// ⚠️ L'ÉTAT MESURÉ SUR UN POSTE RÉEL : sur cinq lieux clients posés, TROIS portaient une garde
// qu'aucun commit ne contenait. Le gate refusait — juste — et personne ne versait. La garantie
// ne bouge pas : c'est la commande qui fait désormais le geste.
//
// ET LE CONTRÔLE QUI COMPTE VRAIMENT EST LE SECOND : un dépôt de travail porte presque toujours
// autre chose d'INDEXÉ. Un `git commit` sans chemin l'emporterait — la commande signerait un
// travail qu'elle n'a jamais lu. On met donc un fichier étranger dans l'index, et on prouve
// qu'il est resté dehors.
test('la commande VERSE elle-même le lieu ET la garde — sans emporter le travail indexé d’à côté', () =>
  avecLieu(
    (client, lieu, depot) => {
      installerFauxHerdr({ repertoire: lieu });
      writeFileSync(join(depot, 'travail-de-quelquun-dautre.txt'), 'une modification en cours, indexée\n');
      execFileSync('git', ['-C', depot, 'add', 'travail-de-quelquun-dautre.txt'], { stdio: 'ignore' });

      const r = lancerNaitre(client);

      const verses = fichiersVerses(depot);
      const sous = `.gestionnaire/${client}`;
      for (const f of ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json', '.claude/settings.json']) {
        assert.ok(verses.includes(`${sous}/${f}`), `un commit doit porter ${f} — versés : ${verses.join(', ')}`);
      }
      assert.ok(
        !verses.includes('travail-de-quelquun-dautre.txt'),
        'le travail indexé d’à côté ne doit JAMAIS être emporté — la commande signerait ce qu’elle n’a pas lu'
      );
      assert.match(
        gitDit(depot, 'status', '--porcelain', '--', 'travail-de-quelquun-dautre.txt'),
        /^A\s+travail-de-quelquun-dautre\.txt$/,
        'il doit être resté exactement où il était : indexé, non commité'
      );

      // ⚠️ LA GARDE, PAS SEULEMENT LE LIEU. C'est elle qui manquait dans les trois lieux
      // mesurés : le `settings.json` était versé SANS ses `hooks`, donc parfaitement valide et
      // silencieusement désarmé. On relit donc ce que HEAD porte, pas ce qui est sur le disque.
      const dansHead = JSON.parse(gitDit(depot, 'show', `HEAD:${sous}/.claude/settings.json`));
      assert.match(
        dansHead.hooks.PreToolUse[0].hooks[0].command,
        /garde-ouverture-ligne\.js/,
        'la garde doit être DANS un commit — sinon un changement de branche la retire sans un mot'
      );
      assert.deepEqual(
        dansHead.permissions,
        { allow: ['mcp__servicedesk__*'] },
        'et les permissions du lieu doivent avoir survécu au versement'
      );
      assert.equal(gitDit(depot, 'status', '--porcelain', '--', sous), '', 'plus rien du lieu ne doit rester dehors');

      assert.equal(r.code, 0, `la naissance doit ABOUTIR après avoir versé elle-même — stderr: ${r.stderr}`);
    },
    'smoke',
    { verser: false }
  ));

// Un commit vide à chaque lancement rendrait l'historique illisible et ferait douter de tous
// les autres. La relance est le cas NOMINAL — un agent renaît plusieurs fois par jour.
test('relancer sur un lieu déjà versé ne crée AUCUN commit vide', () =>
  avecLieu(
    (client, lieu, depot) => {
      installerFauxHerdr({ repertoire: lieu });

      lancerNaitre(client);
      const apresLaPremiere = nombreDeCommits(depot);
      assert.ok(apresLaPremiere >= 1, 'la première naissance doit avoir versé quelque chose');

      lancerNaitre(client);

      assert.equal(
        nombreDeCommits(depot),
        apresLaPremiere,
        'rien n’avait changé : la seconde naissance ne doit rien avoir à verser'
      );
      assert.equal(gitDit(depot, 'status', '--porcelain', '--', `.gestionnaire/${client}`), '');
    },
    'smoke',
    { verser: false }
  ));

// Le troisième état, et le seul qui doit être MUET de bout en bout : lieu versé, garde versée.
// Un comportement silencieux non verrouillé est celui qui se met à parler sans qu'on le voie.
test('naitre.js se TAIT quand le lieu ET sa garde sont versés — le régime normal', () =>
  avecLieu((client, lieu, depot) => {
    installerFauxHerdr({ repertoire: lieu });
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

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — LA SESSION HERDR VISÉE, ET L'ESPACE QUI LUI APPARTIENT (T-20260814-0120)

// Le cas vécu : `w2W`, lu dans la session `somtech`, donné pour une naissance dans
// `sibelanger`. Les identifiants d'espace ne sont pas globalement uniques — l'un désigne donc
// un espace qui existe, mais ailleurs. Sans ce refus, la naissance ne rate pas : elle réussit
// au mauvais endroit, et rien à l'écran ne le montre.
//
// La preuve exigée par le ticket est une ABSENCE : aucun onglet créé nulle part.
test('naitre.js REFUSE un espace que la session visée ne porte pas — et n’ouvre AUCUN onglet', () =>
  avecLieu((client, lieu) => {
    // La session ne porte que `wAUTRE` ; on va lui demander `w9`, qui vit ailleurs.
    const journal = installerFauxHerdr({ repertoire: lieu, espaces: ['wAUTRE'] });

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

// ⚠️ CE CONTRÔLE EXISTE PARCE QUE J'AI COMMIS LE DÉFAUT QU'IL GARDE. Cinq appels herdr
// portaient la session, le sixième non : `livrerBrief` était appelé sans socket, donc l'amorce
// partait vers la session par défaut — c'est-à-dire vers RIEN depuis un terminal ordinaire.
// Neuvième occurrence du motif « une porte sur deux » sur ce dépôt, et la première commise en
// le corrigeant. Aucun test ne la voyait, parce que le faux herdr ne regardait pas à qui on
// s'adressait.
//
// On compte donc les gestes, on ne les nomme pas un à un : une liste de noms se déphase au
// premier appel ajouté, et c'est exactement ainsi qu'un sixième se glisse sans socket.
test('CHAQUE geste herdr part vers la session visée — aucun ne parle à une autre', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu });

    // ⚠️ L'AMORCE N'A PAS BESOIN DE RÉUSSIR POUR ÊTRE MESURÉE — il suffit qu'elle PARLE.
    // Le double ne joue pas la danse complète d'une boîte de saisie, et la faire aboutir
    // demanderait de lui apprendre un dialogue que la suite de `livraison` éprouve déjà.
    // Mais la livraison lit l'écran avant d'écrire : ce geste-là part, il est journalisé,
    // et c'est lui qui portait le socket manquant.
    lancerNaitre(client, { amorce: 'Voici ton brief, en une ligne.' });

    const appels = appelsJournalises(journal);
    assert.ok(
      appels.some((a) => a[0] === 'agent' && a[1] === 'prompt'),
      'la livraison de l’amorce doit avoir parlé à herdr — sans quoi ce contrôle ne mesure pas ce qu’il croit'
    );

    const sessions = sessionsJournalisees(journal);
    assert.ok(sessions.length >= 6, `trop peu de gestes pour que ce contrôle prouve quoi que ce soit (${sessions.length})`);
    const egarees = sessions.filter((s) => s !== sessionsDesEssais);
    assert.deepEqual(
      egarees,
      [],
      `${egarees.length} geste(s) sur ${sessions.length} ont parlé à une autre session que « ${sessionsDesEssais} »`
    );
  }));

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 — LA NAISSANCE NOMINALE : L'ORDRE DES GESTES, ET CE QUI EST RÉELLEMENT TRANSMIS

// ⚠️ `agent start` REMPLACE `pane run` + la boucle d'attente + `agent rename` (T-20260816-0038).
// Trois gestes, une minute d'attente, et une fenêtre pendant laquelle l'agent n'était
// adressable que par son numéro de pane — c'est-à-dire le moment exact où l'adressage cassait
// (T-20260816-0002). Ce contrôle ancre l'ordre qui reste : créer l'onglet DANS le lieu, faire
// naître, PUIS lire l'écran. Lire avant de faire naître ne mesurerait rien ; faire naître avant
// de poser le lieu ferait naître une session ordinaire.
test('naitre.js crée l’onglet DANS le lieu, fait naître l’agent, PUIS lit son écran', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu });

    const r = lancerNaitre(client);
    assert.equal(r.code, 0, `naissance attendue réussie — stderr: ${r.stderr}`);

    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.ok, true);
    assert.equal(rendu.pane, 'w9:p1');
    assert.equal(rendu.agent, client);
    assert.equal(rendu.repertoire, lieu, 'la commande rend le répertoire RELU, pas celui qu’elle a composé');
    assert.equal(rendu.modele, MODELE_PAR_DEFAUT, 'le modèle est DIT, jamais subi');
    assert.equal(rendu.mode, MODE_PAR_DEFAUT);

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
    const iStart = appels.findIndex((a) => a[0] === 'agent' && a[1] === 'start');
    const iRead = appels.findIndex((a) => a[0] === 'agent' && a[1] === 'read');
    assert.ok(iEspaces >= 0, 'la commande doit demander à la session quels espaces elle porte');
    assert.ok(iEspaces < iTab, 'et le demander AVANT de créer le moindre onglet');

    // Le pane naît DANS le lieu — le drapeau, pas seulement un `cd` écrit ensuite : une ligne
    // écrite dans un shell qui n'est pas prêt est perdue en entier (T-20260809-0023).
    assert.equal(appels[iTab][appels[iTab].indexOf('--cwd') + 1], lieu);

    assert.ok(iTab < iStart, 'on ne fait pas naître un agent dans un onglet qui n’existe pas');
    assert.ok(iStart < iRead, 'et on ne lit pas l’écran d’une session qui n’est pas née');

    // ⚠️ LA LECTURE D'ÉCRAN EST UNE VRAIE COMMANDE herdr, avec ses arguments. C'est le geste
    // qui distingue « herdr dit que l'agent est prêt » de « l'agent est prêt » : le double
    // annonce `interactive_ready: true` sur un modal, et seule cette lecture le démasque.
    assert.deepEqual(
      appels[iRead],
      // `--format ansi` ajouté le 2026-08-19 (E-20260819-0015) : la sonde d'écran dégrise, et
      // sans attributs elle n'a rien à dégriser. Voir `naissance.js`.
      ['agent', 'read', 'w9:p1', '--source', 'visible', '--lines', '40', '--format', 'ansi'],
      'l’écran se lit par la commande construite pour ça, sur le pane qui vient de naître'
    );

    // CE QUI A ÉTÉ VÉRIFIÉ, et pas seulement ce qui a été fait.
    assert.ok(Array.isArray(rendu.verifie), 'la sortie doit dire ce qu’elle a VÉRIFIÉ');
    assert.ok(
      rendu.verifie.some((v) => /écran/.test(v)),
      `la lecture d’écran doit être annoncée — reçu : ${JSON.stringify(rendu.verifie)}`
    );
    assert.ok(
      rendu.verifie.some((v) => /versé/.test(v)),
      `le versement doit être annoncé — reçu : ${JSON.stringify(rendu.verifie)}`
    );

    assert.ok(!appels.some((a) => a[0] === 'pane' && a[1] === 'close'), 'aucune fermeture sur un succès');
  }));

// ⚠️ UN LANCEMENT NU NAÎT SUR CE QUE LE COMPTE A PAR DÉFAUT, et personne ne sait quoi depuis
// l'extérieur. Un chef d'équipe qu'on croit sur un grand modèle et qui raisonne sur un petit
// rend un travail qu'on relira comme s'il venait de l'autre — c'est le pire des deux, parce
// que rien ne le dit.
//
// ⚠️ ET LE JSON DE SORTIE NE PROUVE RIEN : il dit ce que la commande CROIT avoir demandé. Ce
// contrôle lit donc le journal du double — c'est-à-dire ce que herdr a REÇU — et le `--` qui
// sépare les drapeaux de herdr de ceux de `claude`. Sans ce séparateur, herdr avalerait
// `--model` comme un des siens.
test('--modele et --mode partent RÉELLEMENT vers claude, après le séparateur `--`', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu });

    const r = lancerNaitre(client, { modele: 'sonnet', mode: 'plan' });
    assert.equal(r.code, 0, `naissance attendue réussie — stderr: ${r.stderr}`);

    const start = appelsJournalises(journal).find((a) => a[0] === 'agent' && a[1] === 'start');
    assert.deepEqual(
      start,
      [
        'agent', 'start', client,
        '--kind', 'claude',
        '--pane', 'w9:p1',
        '--timeout', '120000',
        '--', '--model', 'sonnet', '--permission-mode', 'plan',
      ],
      'herdr doit recevoir le nom à la naissance, le pane, et les drapeaux de claude après `--`'
    );

    // Et la sortie DÉCLARE ce qui a été transmis — les deux doivent coïncider, sinon le JSON
    // raconte une naissance que personne n'a faite.
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.modele, 'sonnet');
    assert.equal(rendu.mode, 'plan');

    // Le défaut, lui, ne s'invente pas non plus : sans drapeau, c'est celui du module.
    const journal2 = installerFauxHerdr({ repertoire: lieu });
    lancerNaitre(client);
    const parDefaut = appelsJournalises(journal2).find((a) => a[0] === 'agent' && a[1] === 'start');
    assert.deepEqual(parDefaut.slice(parDefaut.indexOf('--')), ['--', '--model', MODELE_PAR_DEFAUT, '--permission-mode', MODE_PAR_DEFAUT]);
  }));

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 — LES ÉCHECS APRÈS LA CRÉATION DU PANE : RIEN NE SUBSISTE D'UNE NAISSANCE RATÉE
//
// Un pane vide laissé derrière est ce que le dirigeant a trouvé au premier usage réel — et
// c'est ce qui rend une commande sortie en `0` doublement trompeuse : elle dit que tout va
// bien ET elle laisse une trace qui ressemble à un succès.

// LE DÉFAUT HISTORIQUE, TRANSPOSÉ À `agent start` : herdr sort en ZÉRO, annonce
// `agent_started`, et sa réponse ne porte AUCUN agent. Lire le code de sortie suffisait pour
// croire à une naissance (T-20260809-0023, même motif que T-20260807-0067).
test('un « succès » d’agent start SANS agent fait échouer la commande — un code 0 sans agent n’est pas une naissance', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu, demarrage: 'sans-agent' });

    const r = lancerNaitre(client);

    assert.notEqual(r.code, 0, 'herdr n’a fait naître personne : la commande ne peut pas rendre 0');
    assert.match(r.stderr, /succès sans agent|code 0 sans agent/, 'le message doit nommer le piège, pas seulement échouer');
    assert.equal(r.stdout.trim(), '', 'rien ne doit être annoncé comme réussi');
    assert.ok(aFerme(journal), 'rien ne subsiste d’une naissance ratée — le pane doit être refermé');
    assert.ok(
      !appelsJournalises(journal).some((a) => a[0] === 'agent' && a[1] === 'read'),
      'inutile de lire l’écran d’une session qui n’est jamais née'
    );
  }));

test('un refus d’agent start fait échouer la commande TOUT DE SUITE, et referme le pane', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu, demarrage: 'refus' });

    const r = lancerNaitre(client);

    assert.notEqual(r.code, 0);
    // Le refus est relayé TEL QUE herdr l'a dit — et il nomme la commande qui a refusé. Sans
    // ce second point, un refus recopié laisse chercher lequel des six gestes a échoué.
    assert.match(r.stderr, /agent target w9:p1 not found/, 'les mots de herdr, pas une paraphrase');
    assert.match(r.stderr, /herdr agent start/, 'et QUELLE commande a refusé');
    assert.equal(r.stdout.trim(), '');
    assert.ok(aFerme(journal), 'un démarrage refusé ne doit pas laisser le pane derrière lui');

    // ⚠️ ON NE RÉESSAIE QUE CE QU'ON SAIT TRANSITOIRE. Réessayer sur n'importe quel refus
    // transformerait une panne franche en une minute de silence, puis en un message qui ne
    // dirait plus la vraie cause : « le pane n'existe pas » ne s'arrange pas en attendant.
    assert.equal(
      appelsJournalises(journal).filter((a) => a[0] === 'agent' && a[1] === 'start').length,
      1,
      'un refus qui n’est pas transitoire ne doit être tenté qu’UNE fois'
    );
  }));

// ⚠️ TROUVÉ PAR LA PREUVE RÉELLE, PAS PAR LA SUITE : `herdr agent start` a refusé
// « agent_pane_busy … is not an available shell » sur un onglet créé une fraction de seconde
// plus tôt. Le pane existe, son shell démarre encore. C'est le seul état qu'on ait le droit
// d'attendre — et on l'attend en interrogeant, jamais en pariant sur un délai.
test('un pane dont le shell démarre encore est ATTENDU — ce refus-là n’est pas une panne', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu, busyPendant: 2 });

    const r = lancerNaitre(client);

    assert.equal(r.code, 0, `la naissance doit aboutir une fois le shell prêt — stderr: ${r.stderr}`);
    assert.equal(JSON.parse(r.stdout).ok, true);
    const essais = appelsJournalises(journal).filter((a) => a[0] === 'agent' && a[1] === 'start').length;
    assert.equal(essais, 3, `deux refus transitoires, puis la naissance — reçu ${essais} tentatives`);
    assert.ok(!aFerme(journal), 'un pane qu’on a fini par faire naître ne se referme pas');
  }));

// ═══════════════ T-20260816-0033 — L'ÉCRAN EST LE FAIT ; `interactive_ready` est un INDICE
//
// MESURÉ le 2026-08-16 sur Claude Code 2.1.233 : `agent start` rend `agent_status: idle` ET
// `interactive_ready: true` PENDANT que l'agent est parqué derrière un modal. Le double le
// rend aussi (voir plus haut) : ces trois contrôles échouent donc si la commande se contente
// de ce que herdr annonce — « une porte sur deux », dans la primitive même adoptée pour
// fermer le défaut.
//
// Deux agents ont été avalés par un écran de configuration en une journée, dont un pendant
// 36 minutes (T-20260815-0014), et un troisième est resté parqué, immobile ET injoignable,
// parce que le refus — juste — ne disait pas CE QU'IL Y AVAIT à l'écran (T-20260816-0001).

test('un écran CONNU fait échouer la naissance, le NOMME, donne le geste, et referme le pane', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu, ecran: 'confiance' });

    const r = lancerNaitre(client);

    assert.notEqual(r.code, 0, 'un agent parqué derrière un modal n’est pas né : la commande ne peut pas rendre 0');
    assert.match(r.stderr, /écran connu/, 'un écran qu’on sait lire doit être annoncé comme tel');
    assert.match(r.stderr, /confiance/i, 'et NOMMÉ — « bloqué sur l’écran X » débloque, « bloqué » ne débloque personne');
    assert.match(r.stderr, /Le geste qui le lève/, 'un écran nommé porte le geste qui le lève, parce qu’on l’a vérifié');
    assert.match(r.stderr, /approuverLieu|pré-approuve/, 'et ce geste doit être exécutable, pas une formule');
    assert.equal(r.stdout.trim(), '', 'rien ne doit être annoncé comme réussi');
    assert.ok(aFerme(journal), 'une session parquée est immobile ET injoignable : on ne la laisse pas derrière soi');
  }));

test('un écran connu QUI PORTE UN GESTE MESURÉ est FRANCHI — et la naissance va au bout', () =>
  avecLieu((client, lieu) => {
    // ⚠️ FRANCHIR N'EST PAS DEVINER, ET C'EST TOUTE LA DISTINCTION DE CE LOT.
    //
    // Le dirigeant a interdit de « tenter sa chance ». Il n'a pas interdit d'agir sur ce qu'on
    // reconnaît : il a interdit d'agir sur ce qu'on ne reconnaît pas. Ici l'écran est identifié
    // par son texte, le geste est MESURÉ (`enter` confirme les serveurs déjà cochés, 2026-08-16),
    // et — c'est ce qui en fait un fait plutôt qu'un pari — on RELIT après.
    //
    // Ce que cet essai attraperait : une naissance qui déclare l'agent né sans avoir franchi, et
    // une naissance qui franchit sans relire (le double ne rend « prêt » qu'après avoir VU la
    // touche, donc un code qui ne relirait pas resterait rouge).
    const journal = installerFauxHerdr({ repertoire: lieu, ecran: 'serveurs' });

    const r = lancerNaitre(client);

    assert.equal(r.code, 0, `la naissance doit aboutir après franchissement — stderr : ${r.stderr}`);
    const touches = appelsJournalises(journal).filter((a) => a[0] === 'agent' && a[1] === 'send-keys');
    assert.equal(touches.length, 1, 'un seul franchissement suffisait : en envoyer plusieurs serait marteler');
    assert.deepEqual(touches[0], ['agent', 'send-keys', 'w9:p1', 'enter'], 'la touche envoyée doit être celle qui a été mesurée');
    assert.match(r.stderr, /écran connu franchi/, 'un franchissement se DIT — un geste invisible ne se relit pas');
    assert.ok(!aFerme(journal), 'la naissance a abouti : le pane ne doit pas être refermé');
  }));

test('un écran connu qui NE CÈDE PAS finit par faire échouer — on n’insiste pas indéfiniment', () =>
  avecLieu((client, lieu) => {
    // Un écran qu'on croit reconnaître et qui revient n'est plus celui qu'on croit. Marteler la
    // même touche jusqu'à la fin des essais serait redevenir un dispositif qui tente sa chance,
    // et il resterait muet pendant tout ce temps. Le franchissement est donc BORNÉ.
    // ⚠️ ESSAIS > FRANCHISSEMENTS_MAX, ET C'EST TOUT LE SUJET DE CET ESSAI — trouvé par la revue
    // de fond. La suite fixe NAISSANCE_ESSAIS à 3 pour aller vite, et la borne vaut 3 : la boucle
    // n'avait jamais l'occasion de distinguer « borné à 3 » d'« illimité ». En production, où les
    // essais valent 30, retirer la borne ferait marteler trente fois la même touche sur un écran
    // qui ne cède pas — précisément ce que le code dit vouloir éviter, et l'essai le laissait
    // passer. Un essai dont la configuration masque ce qu'il mesure ne mesure rien.
    const journal = installerFauxHerdr({ repertoire: lieu, ecran: 'serveurs-tetu' });

    const r = lancerNaitre(client, { essais: '8' });

    assert.notEqual(r.code, 0, 'un écran qui ne cède pas n’est pas une naissance réussie');
    const touches = appelsJournalises(journal).filter((a) => a[0] === 'agent' && a[1] === 'send-keys');
    assert.ok(touches.length >= 1, 'la commande doit avoir ESSAYÉ de franchir un écran qu’elle reconnaît');
    assert.ok(
      touches.length <= 3,
      `le franchissement doit être borné — ${touches.length} tentatives, c’est du martèlement`
    );
    assert.match(r.stderr, /écran connu/, 'et le refus doit NOMMER ce devant quoi elle s’est arrêtée');
    assert.ok(aFerme(journal), 'une session qu’on laisse parquée est immobile ET injoignable');
  }));

test('un écran INCONNU fait échouer, cite ce qu’il a vu, et ne propose AUCUN geste', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu, ecran: 'inconnu' });

    const r = lancerNaitre(client);

    assert.notEqual(r.code, 0, 'un écran qu’on ne reconnaît pas n’est jamais « prêt » — l’absence de mesure n’est pas une bonne nouvelle');
    assert.match(r.stderr, /je ne reconnais pas/, 'la commande doit AVOUER qu’elle ne sait pas où elle est');
    assert.ok(
      r.stderr.includes('Notes: press n to add notes'),
      `elle doit citer ce qu’elle a VU, pour que quelqu’un le reconnaisse — stderr: ${r.stderr}`
    );
    assert.ok(r.stderr.includes('Chat about this'), 'et pas seulement une ligne prise au hasard');
    // ⚠️ ON N'INVENTE JAMAIS DE GESTE. Un mauvais conseil se croit ; un aveu d'ignorance se
    // vérifie. Le refus qui disait « désigne-le par son pane » à celui qui venait d'échouer
    // par son pane est le rappel qu'un conseil faux coûte plus cher que pas de conseil du tout
    // (T-20260816-0002).
    assert.doesNotMatch(
      r.stderr,
      /Le geste qui le lève/,
      'aucun geste ne doit être proposé pour un écran qu’on n’a pas su nommer'
    );
    assert.ok(aFerme(journal), 'le pane est refermé, comme pour un écran connu');
  }));

test('un écran ILLISIBLE ne vaut jamais un succès — on ne conclut pas de ce qu’on n’a pas mesuré', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu, ecran: 'illisible' });

    const r = lancerNaitre(client);

    assert.notEqual(r.code, 0, 'une lecture ratée fait s’arrêter — « je n’ai pas pu lire » n’est pas « tout va bien »');
    assert.match(r.stderr, /illisible|ne reconnais pas/, 'et le refus doit dire qu’il n’a rien pu lire');
    assert.equal(r.stdout.trim(), '');
    assert.ok(aFerme(journal), 'le pane est refermé là aussi');
  }));

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 — VÉRIFIER PAR LE FAIT : LE NOM PORTÉ, ET LE RÉPERTOIRE OÙ ÇA TOURNE

test('un agent qui ne porte pas le nom demandé fait échouer la commande — il resterait inadressable', () =>
  avecLieu((client, lieu) => {
    // `agent start` NOMME à la naissance, ce qui ferme la fenêtre où l'agent n'était
    // adressable que par son numéro de pane (T-20260816-0002). Le nom se relit quand même :
    // ce qui est promis par une primitive n'est pas ce qui est constaté.
    const journal = installerFauxHerdr({ repertoire: lieu, nomPorte: 'quelquun-dautre' });

    const r = lancerNaitre(client);

    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /ne porte pas le nom/);
    assert.ok(r.stderr.includes('quelquun-dautre'), 'le message doit dire quel nom il porte VRAIMENT');
    assert.ok(aFerme(journal));
  }));

test('une session née AILLEURS que dans le lieu fait échouer la commande — elle n’est pas représentante', () =>
  avecLieu((client, lieu) => {
    // Le cas exact trouvé au premier usage réel : le pane tourne dans le répertoire d'où la
    // commande a été lancée. La session s'ouvre, l'agent est nommé — et pourtant ce n'est pas
    // un représentant : il n'a chargé ni le métier ni le registre du lieu.
    const journal = installerFauxHerdr({ repertoire: REPO_ROOT });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0, 'un répertoire de travail hors du lieu doit faire échouer la naissance');
    assert.match(r.stderr, /lieu du représentant/);
    assert.ok(r.stderr.includes(lieu), 'le message doit dire où elle aurait dû naître');
    assert.ok(aFerme(journal));
  }));

// Relevé en revue de fond : le seul cas « née ailleurs » testé était un répertoire PARENT du
// lieu — plus court, donc structurellement incapable de démasquer une comparaison affaiblie.
// Un frère à préfixe partagé, lui, passerait un `startsWith` et échoue sur l'égalité.
test('un répertoire FRÈRE à préfixe partagé n’est pas le lieu — la comparaison est exacte, pas par préfixe', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: `${lieu}-bis` });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0, `${lieu}-bis n’est pas ${lieu} — la naissance doit échouer`);
    assert.match(r.stderr, /lieu du représentant/);
    assert.ok(aFerme(journal));
  }));

test('un SOUS-répertoire du lieu n’est pas le lieu non plus — la session n’y charge pas le même projet', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: join(lieu, '.claude') });
    const r = lancerNaitre(client);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /lieu du représentant/);
    assert.ok(aFerme(journal));
  }));

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 — CE QUE LA COMMANDE DIT À L'HUMAIN (T-20260814-0143)

// LE LIEU ET L'AGENT PEUVENT PORTER DEUX NOMS, ET C'EST LÉGITIME. Ce qui ne l'est pas, c'est
// que la commande le fasse sans le dire : le seul endroit qui portait l'écart était un champ
// d'un objet JSON de douze clés, que personne ne relit. Mesuré en production avant ce
// correctif : `.gestionnaire/Charles-Olivier` → `charles-olivier`.
test('naitre.js DIT qu’elle a abaissé la casse, et nomme les deux noms', () =>
  avecLieu((client, lieu) => {
    const journal = installerFauxHerdr({ repertoire: lieu });
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
    const start = appelsJournalises(journal).find((a) => a[0] === 'agent' && a[1] === 'start');
    assert.equal(start[2], attendu, 'c’est herdr qui nomme à la naissance : le nom part avec `agent start`');
  }, 'Smoke'));

test('naitre.js se TAIT quand elle n’a rien abaissé — un avis systématique cesse d’être lu', () =>
  avecLieu((client, lieu) => {
    installerFauxHerdr({ repertoire: lieu });
    assert.equal(client, client.toLowerCase(), 'ce cas exige un nom déjà en minuscules');

    const r = lancerNaitre(client);
    assert.equal(r.code, 0, `naissance attendue réussie — stderr: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /adresse|abaiss/i, `aucun avis de casse attendu — stderr: ${r.stderr}`);
  }));


// ═══════════════════════════════════════════════════════════════════════════════════════
// LE NOM DE RIVIÈRE — E-20260818-0017, T-20260818-0140
//
// Le défaut mesuré le 2026-08-18 : le nom d'un agent est L'ARGUMENT TRANSMIS. Les quatre
// rivières portées sur ce poste — `matapedia`, `batiscan`, `ristigouche`, `bonaventure` — ont
// TOUTES été données à la main ou par une amorce. Il n'y a jamais eu de mécanisme : le jour où
// personne n'y pense, l'agent naît sans rivière et rien ne le signale. Deux agents sur 42 le
// prouvaient déjà (`orchestrateur`, `rev-pr31`).
//
// Ces essais font naître SANS QUE RIEN NE DEMANDE DE NOM — c'est la seule forme qui prouve un
// mécanisme plutôt qu'une consigne bien suivie.

test('un ORCHESTRATEUR qui naît porte une RIVIÈRE — sans que rien ne la lui demande', () =>
  avecLieu(
    (code, lieu, depot) => {
      installerFauxHerdr({ repertoire: lieu });

      const r = lancerNaitre(code, { role: 'orchestrateur' });

      assert.equal(r.code, 0, `naissance attendue — stderr: ${r.stderr}`);
      const rendu = JSON.parse(r.stdout);
      assert.ok(
        estUneRiviere(rendu.agent),
        `l’agent porte « ${rendu.agent} » — aucun mécanisme ne lui a donné de rivière`,
      );
      // ⚠️ ET LE LIEU N'A PAS BOUGÉ : il porte le code du mandat. C'est la moitié de la
      // décision « lieu ≠ nom » (T-20260818-0124) que rien d'autre ne garde.
      assert.equal(rendu.nom, code, 'le lieu doit continuer de porter le code du mandat');
      assert.ok(lieu.endsWith(code), 'le chemin du lieu porte le code, pas la rivière');
    },
    'riv',
    { role: 'orchestrateur', nom: `d-20260818-${String(process.pid).slice(-4)}` },
  ));

test('un REPRÉSENTANT ne reçoit AUCUNE rivière — la règle ne déborde pas sur qui exécute', () =>
  avecLieu((client, lieu) => {
    installerFauxHerdr({ repertoire: lieu });
    const r = lancerNaitre(client);
    assert.equal(r.code, 0, `naissance attendue — stderr: ${r.stderr}`);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.agent, client.toLowerCase(), 'un représentant porte le nom de son lieu');
    assert.equal(estUneRiviere(rendu.agent), false);
  }));

test('un nom hors convention est REFUSÉ, et RIEN n’a été créé — prouvé par le disque et par le journal', () =>
  avecLieu(
    (code, lieu, depot) => {
      const journal = installerFauxHerdr({ repertoire: lieu });

      const r = spawnSync(process.execPath, [
        BIN, code, '--workspace', 'w9', '--depot', depot, '--role', 'orchestrateur',
        '--nom-agent', 'rev-pr31',
      ], { env: { ...process.env, NAISSANCE_ESSAIS: '3', NAISSANCE_DELAI_MS: '5', HERDR_SOCKET_PATH: '' } });

      assert.equal(r.status, 1, 'refus attendu');
      const stderr = (r.stderr ?? '').toString();
      assert.match(stderr, /rev-pr31/, 'le refus nomme ce qu’il refuse');
      assert.match(stderr, /rivière/, 'et le motif, pas seulement un « non »');
      assert.match(stderr, /Rien n’a été créé/, 'et il DIT que le disque est intact');
      // ⚠️ LE DIRE NE SUFFIT PAS — on le mesure. Un refus qui annonce « rien n'a été créé » en
      // laissant un onglet derrière lui est exactement le demi-succès que ce module refuse.
      assert.equal(existsSync(join(lieu, FICHIER_NOM_AGENT)), false, 'aucun nom inscrit');
      assert.equal(appelsJournalises(journal).length, 0, 'et aucun appel herdr n’est parti');
    },
    'riv',
    { role: 'orchestrateur', nom: `d-20260818-${String(process.pid).slice(-4)}r` },
  ));

test('la RENAISSANCE reprend le nom inscrit — un orchestrateur ne change pas de nom en redémarrant', () =>
  avecLieu(
    (code, lieu, depot) => {
      installerFauxHerdr({ repertoire: lieu });

      const premiere = JSON.parse(lancerNaitre(code, { role: 'orchestrateur' }).stdout);
      assert.ok(estUneRiviere(premiere.agent));
      assert.equal(nomInscritDansLeLieu(lieu).nom, premiere.agent, 'le lieu porte désormais le nom');

      // ⚠️ LE PARC A CHANGÉ ENTRE LES DEUX : la rivière qu'il porte est maintenant prise (par
      // lui). Sans le fichier, l'attribution l'enjamberait et lui donnerait un AUTRE nom — le
      // dirigeant l'appellerait par un nom qu'il ne porte plus.
      installerFauxHerdr({ repertoire: lieu, agents: [premiere.agent] });
      const seconde = JSON.parse(lancerNaitre(code, { role: 'orchestrateur' }).stdout);

      assert.equal(seconde.agent, premiere.agent, 'la renaissance doit reprendre le même nom');
    },
    'riv',
    { role: 'orchestrateur', nom: `d-20260818-${String(process.pid).slice(-4)}b` },
  ));

test('l’unicité NON VÉRIFIÉE est DITE — jamais conclue libre, et jamais mêlée aux noms relevés', () =>
  avecLieu(
    (code, lieu, depot) => {
      installerFauxHerdr({ repertoire: lieu });
      const r = lancerNaitre(code, { role: 'orchestrateur' });
      assert.equal(r.code, 0, `naissance attendue — stderr: ${r.stderr}`);
      assert.match(
        r.stderr,
        /n’a pas pu être vérifiée partout/,
        'ce qu’on n’a pas mesuré doit se dire là où un humain regarde',
      );
      assert.match(r.stderr, /ServiceDesk/, 'et nommer ce qui est resté hors d’atteinte');
    },
    'riv',
    { role: 'orchestrateur', nom: `d-20260818-${String(process.pid).slice(-4)}c` },
  ));

test('l’avis d’écart NE DIT PLUS une cause fausse — le lieu porte le code, l’agent porte son nom', () =>
  avecLieu(
    (code, lieu, depot) => {
      installerFauxHerdr({ repertoire: lieu });
      const r = lancerNaitre(code, { role: 'orchestrateur' });
      assert.equal(r.code, 0, `naissance attendue — stderr: ${r.stderr}`);
      // ⚠️ AVANT CE LOT, L'ÉCART NE POUVAIT VENIR QUE DE LA CASSE, et le message l'affirmait.
      // Servi devant « bonaventure » / « j-2026… », il aurait envoyé chercher du côté des
      // majuscules un écart qui n'en vient pas — un message qui explique par une cause fausse
      // est pire qu'un message absent.
      assert.match(r.stderr, /le lieu porte le code du mandat/);
      assert.doesNotMatch(r.stderr, /herdr n’accepte que les minuscules/);
    },
    'riv',
    { role: 'orchestrateur', nom: `d-20260818-${String(process.pid).slice(-4)}d` },
  ));

test('le nom inscrit est VERSÉ, pas seulement écrit — un clone frais doit le retrouver', () =>
  avecLieu(
    (code, lieu, depot) => {
      installerFauxHerdr({ repertoire: lieu });

      const rendu = JSON.parse(lancerNaitre(code, { role: 'orchestrateur' }).stdout);
      assert.ok(estUneRiviere(rendu.agent));

      // ⚠️ CET ESSAI EXISTE PARCE QUE LA PREUVE RÉELLE A TROUVÉ CE QUE LA SUITE NE VOYAIT PAS.
      // L'inscription tombait APRÈS le versement : le fichier était sur le disque, dans aucun
      // commit. Un `git checkout`, un clone frais, et le nom disparaissait SANS UN MOT — le
      // lieu restant par ailleurs valide. Les essais lisaient le fichier ; l'historique, non.
      // C'est le mode de panne de T-20260814-0139, rejoué un fichier plus loin.
      const verses = fichiersVerses(depot);
      const chemin = verses.find((f) => f.endsWith(FICHIER_NOM_AGENT));
      assert.ok(
        chemin,
        `« ${FICHIER_NOM_AGENT} » n’est dans AUCUN commit — il vit sur ce disque seulement, et ` +
          `un clone frais ferait dériver le nom de l’agent. Versés : ${verses.join(', ')}`,
      );
    },
    'riv',
    { role: 'orchestrateur', nom: `d-20260818-${String(process.pid).slice(-4)}e` },
  ));

test('un « .nom-agent » que herdr refuserait est un refus QUI NOMME SA CAUSE — pas deux messages sans fil', () =>
  avecLieu(
    (code, lieu, depot) => {
      const journal = installerFauxHerdr({ repertoire: lieu });
      // Écrit à la main : aucune naissance ne peut inscrire un nom que herdr refuse.
      writeFileSync(join(lieu, FICHIER_NOM_AGENT), 'Mon Agent !!\n');

      const r = lancerNaitre(code, { role: 'orchestrateur' });

      assert.equal(r.code, 1, 'refus attendu');
      // ⚠️ RELEVÉ EN REVUE DE FOND. Avant, l'opérateur lisait deux messages qui se
      // contredisent : le baptême disait « il est repris tel quel », puis l'échec parlait de
      // « 1 à 32 caractères » sans jamais nommer le fichier d'où venait le nom ni le geste.
      assert.match(r.stderr, /1 à 32 caractères/, 'la règle de herdr est dite');
      assert.match(r.stderr, /\.nom-agent/, 'et le FICHIER d’où le nom vient est nommé');
      assert.match(r.stderr, /efface-le/, 'et le geste qui lève le blocage');
      assert.match(r.stderr, /Rien n’a été créé/);
      assert.equal(appelsJournalises(journal).length, 0, 'aucun appel herdr n’est parti');
    },
    'riv',
    { role: 'orchestrateur', nom: `d-20260818-${String(process.pid).slice(-4)}f` },
  ));

// ═══════════════════════════════════════════════════════════════════════════════════════
// 9 — LE CHEF D'ÉQUIPE : UN AGENT SANS LIEU, DÉCLARÉ (D-20260825-0002)
//
// ⚠️ CES ESSAIS METTENT TROIS RACINES DU POSTE HORS DE PORTÉE, et il en faut trois parce que
// la naissance en touche trois : `~/worktrees` (l'espace), `~/.somtech/naissances` (la
// déclaration) et `~/.claude.json` (l'approbation du répertoire). En oublier une ferait écrire
// un essai dans le poste du dirigeant, en paraissant vert.
//
// ⚠️ MESURÉ EN ÉCRIVANT CE LOT : le reste de ce fichier ne pose PAS `HOME`, et `approuverLieu`
// écrit donc dans le VRAI `~/.claude.json`. Il y portait 25 553 entrées de répertoires
// temporaires sur 27 685 le 2026-08-25. Ce n'est pas le sujet de ce lot — c'est signalé, pas
// corrigé ici, parce que le corriger toucherait des essais qui ne sont pas de ma zone.

/**
 * Un dépôt de chantier AVEC son `origin/main` — la base dont l'espace de travail se tire.
 * Aucun lieu n'y est posé : un chef d'équipe n'en a pas, et c'est précisément ce qu'on éprouve.
 */
let compteurChef = 0;
function avecChefDEquipe(faire, { avecOrigin = true } = {}) {
  compteurChef += 1;
  const bac = mkdtempSync(join(tmpdir(), 'smtk-chef-bin-'));
  const depot = join(bac, 'le-chantier');
  mkdirSync(depot, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', depot, ...args], { stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'essai@somtech.ca');
  git('config', 'user.name', 'essai');
  writeFileSync(join(depot, 'LISEZMOI.md'), 'un chantier d’essai\n');
  git('add', '-A');
  git('commit', '-qm', 'le premier commit');
  if (avecOrigin) {
    const distant = join(bac, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', distant], { stdio: 'ignore' });
    git('remote', 'add', 'origin', distant);
    git('push', '-q', 'origin', 'main');
    git('fetch', '-q', 'origin');
  }

  const poste = {
    SOMTECH_WORKTREES_RACINE: join(bac, 'worktrees'),
    SOMTECH_NAISSANCES_RACINE: join(bac, 'naissances'),
    HOME: join(bac, 'faux-home'),
    // Sans clé, `declarerAuServiceDesk` rend « aucun accès » plutôt que de partir dehors.
    SOMTECH_DESK_API_KEY: '',
    SERVICEDESK_MCP_TOKEN: '',
  };
  mkdirSync(poste.HOME, { recursive: true });

  // Un code de mandat DIFFÉRENT à chaque essai : la déclaration refuse d'écraser un fait, et
  // deux essais du même nom dans la même milliseconde se disputeraient le même fichier.
  const code = `e-20260825-${String(1000 + compteurChef).slice(-4)}`;

  // ⚠️ L'HORODATAGE EST DICTÉ, ET C'EST CE QUI REND CES ESSAIS MESURABLES. Sans lui, l'espace
  // porte l'heure de la seconde où il naît : le faux herdr ne pourrait pas rapporter le
  // répertoire RÉEL de la session, et la commande — qui vérifie par le fait qu'elle tourne dans
  // son espace — refuserait toute naissance. Le drapeau existe pour de vraies raisons (rejouer
  // un refus, reprendre une session par son nom) ; ce n'est pas une porte d'essais.
  const horodatage = '20260825-083616';
  const espace = join(bac, 'worktrees', 'le-chantier', horodatage);

  depotCourant = depot;
  try {
    return faire({ code, depot, bac, poste, git, horodatage, espace });
  } finally {
    depotCourant = null;
    // ⚠️ ON RETIRE LES WORKTREES AVANT LE DÉPÔT. `rm -rf` sur le bac laisserait le dépôt
    // principal croire qu'ils existent — mais le dépôt part avec, donc rien ne survit. Ce qui
    // survivrait, en revanche, ce sont des worktrees pointant vers un `.git` disparu si la
    // racine était hors du bac : c'est pourquoi elle est DEDANS.
    rmSync(bac, { recursive: true, force: true });
  }
}

/** Les déclarations inscrites — lues comme un lecteur les lira, jamais depuis la mémoire. */
function declarationsInscrites(poste) {
  const racine = poste.SOMTECH_NAISSANCES_RACINE;
  if (!existsSync(racine)) return [];
  return execFileSync('/bin/ls', [racine], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(racine, f), 'utf8')));
}

const lancerChef = ({ code, poste, horodatage, ...reste }) =>
  lancerNaitre(code, { role: 'chef-equipe', env: poste, horodatage, ...reste });

// ── 9a — LE GESTE COMPLET, EN UNE FOIS

test('UN SEUL GESTE fait naître un chef d’équipe : son espace, son agent, sa déclaration', () =>
  avecChefDEquipe(({ code, depot, poste, horodatage, espace }) => {
    const journal = installerFauxHerdr({ repertoire: espace });

    const r = lancerChef({ code, poste, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    assert.ok(existsSync(espace), `l’espace n’existe pas : ${espace}`);
    assert.equal(
      execFileSync('git', ['-C', espace, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim(),
      `wt/${horodatage}`,
      'sur sa branche-socle'
    );
    assert.equal(
      execFileSync('git', ['-C', espace, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      execFileSync('git', ['-C', depot, 'rev-parse', 'origin/main'], { encoding: 'utf8' }).trim(),
      'tiré de origin/main'
    );

    // ⚠️ L'ONGLET NAÎT DANS L'ESPACE, PAR CONSTRUCTION — `--cwd`, pas un `cd` écrit dans un shell
    // qui vient de démarrer (une ligne écrite avant que le shell soit prêt est perdue en entier).
    const creation = appelsJournalises(journal).find((a) => a[0] === 'tab' && a[1] === 'create');
    assert.equal(creation[creation.indexOf('--cwd') + 1], espace);

    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.espace, espace);
    assert.equal(rendu.branche, `wt/${horodatage}`);
    assert.equal(rendu.base, 'origin/main');
    assert.equal(rendu.mandat, code.toUpperCase());
    assert.equal(rendu.coordonnateur, 'matapedia');
  }));

// ⚠️ LE CRITÈRE 5 DE L'EPIC, MESURÉ PAR `git status` DANS L'ESPACE CRÉÉ — pas par l'absence
// d'un chemin qu'on aurait choisi de regarder. Une garde qui vérifie « pas de .orchestrateur »
// se défait en posant un fichier ailleurs ; `git status --porcelain` voit TOUT ce qui a été
// posé, y compris ce à quoi on n'a pas pensé.
test('un chef d’équipe ne pose AUCUN fichier dans son espace — mesuré par le git status de l’espace', () =>
  avecChefDEquipe(({ code, depot, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace });
    const r = lancerChef({ code, poste, horodatage });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    const statut = execFileSync('git', ['-C', espace, 'status', '--porcelain'], { encoding: 'utf8' });
    assert.equal(statut, '', `l’espace doit être PROPRE — git status dit :\n${statut}`);
    assert.equal(existsSync(join(espace, '.orchestrateur')), false, 'aucun lieu d’orchestrateur');
    assert.equal(existsSync(join(espace, '.gestionnaire')), false, 'aucun lieu de représentant');
    assert.equal(existsSync(join(espace, FICHIER_NOM_AGENT)), false, 'et pas même le fichier du nom');
    assert.equal(existsSync(join(espace, '.claude', 'settings.json')), false, 'aucune garde d’ouverture');

    // Et RIEN N'A ÉTÉ VERSÉ DANS LE DÉPÔT DU CHANTIER non plus. Le versement est le geste qui
    // suit la pose d'un lieu ; un chef d'équipe n'en pose aucun, donc il ne commite rien à sa
    // naissance. Le dépôt d'essai porte UN commit — celui que le harnais y a mis.
    assert.equal(nombreDeCommits(depot), 1, 'la naissance n’a versé aucun lieu dans le dépôt');
    assert.equal(JSON.parse(r.stdout).garde, null, 'et le geste le DIT : aucune garde posée');
  }));

test('le chef d’équipe porte le CODE DE SON MANDAT en minuscules — jamais une rivière', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    const journal = installerFauxHerdr({ repertoire: espace });
    const r = lancerChef({ code, poste, horodatage });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.agent, code, 'le nom EST le code du mandat, abaissé');
    assert.equal(estUneRiviere(rendu.agent), false, 'et surtout PAS une rivière — elle est réservée aux orchestrateurs');

    const demarrage = appelsJournalises(journal).find((a) => a[0] === 'agent' && a[1] === 'start');
    assert.equal(demarrage[2], code, 'c’est bien ce nom-là que herdr reçoit');
  }));

// ── 9b — LA DÉCLARATION

test('la déclaration est inscrite, complète, et rendue dans la sortie du geste', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    const journal = installerFauxHerdr({ repertoire: espace });
    const r = lancerChef({ code, poste, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    const inscrites = declarationsInscrites(poste);
    assert.equal(inscrites.length, 1, 'une déclaration, et une seule');
    const d = inscrites[0];
    assert.equal(d.nom, code);
    assert.equal(d.role, 'chef-equipe', 'le rôle vit DANS la déclaration — il n’a pas de lieu où s’écrire');
    assert.equal(d.mandat, code.toUpperCase(), 'le mandat, tel que le ServiceDesk l’écrit');
    assert.equal(d.coordonnateur, 'matapedia', 'qui l’a ouvert');
    assert.equal(d.pane, 'w9:p1');
    assert.equal(d.pose_par, 'pack agent naitre');
    assert.match(d.ne_le, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(d.espace, /worktrees\/le-chantier\/\d{8}-\d{6}$/, 'son espace de travail, celui qu’on ne retrouve nulle part ailleurs');
    assert.equal(typeof d.session_herdr, 'string');

    // ⚠️ RENDUE DANS LA SORTIE, pas seulement écrite : l'appelant qui vient d'ouvrir un chef
    // d'équipe doit pouvoir consigner la filiation sans aller relire un répertoire.
    const rendu = JSON.parse(r.stdout);
    assert.deepEqual(rendu.declaration, d, 'ce qui est rendu EST ce qui est écrit');
    assert.ok(rendu.declaration_chemin.endsWith('.json'), 'et son chemin est dit');
    assert.equal(rendu.ok, true);
    assert.equal(rendu.role, 'chef-equipe');
    // Les champs du contrat de sortie d'origine ne bougent pas — des appelants les lisent.
    assert.equal(rendu.pane, 'w9:p1');
    assert.equal(rendu.modele, MODELE_PAR_DEFAUT);
    assert.equal(rendu.mode, MODE_PAR_DEFAUT);
    // ⚠️ CETTE ASSERTION ÉTAIT UNE ASSERTION DE FORME, ET C'EST CE QUI A LAISSÉ PASSER LE
    // DÉFAUT ③ : `Array.isArray(rendu.verifie)` reste vrai quel que soit le contenu, y compris
    // « le lieu est versé » sur un rôle QUI N'A PAS DE LIEU. Le champ voisin `garde`, lui, était
    // ÉPINGLÉ (`assert.equal(…, null)`) et n'a jamais menti. On épingle donc celui-ci aussi.
    assert.deepEqual(rendu.verifie, VERIFIE_DUN_CHEF, 'ce qu’un chef d’équipe a réellement fait vérifier');

    assert.ok(
      appelsJournalises(journal).some((a) => a[0] === 'agent' && a[1] === 'get'),
      'et elle vient APRÈS la vérification par le fait'
    );
  }));

// ⚠️ L'ORDRE EST LE CONTRAT : déclarer un agent dont on n'a pas prouvé qu'il porte son nom
// inscrirait un FAIT FAUX — et un fait faux se croit, là où un refus se voit.
test('un agent qui ne porte pas le nom demandé n’est PAS déclaré — et son pane est refermé', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    const journal = installerFauxHerdr({ nomPorte: 'quelquun-dautre', repertoire: espace });

    const r = lancerChef({ code, poste, horodatage });

    assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /ne porte pas le nom/, 'le refus dit ce qui n’a pas pu être prouvé');
    assert.equal(declarationsInscrites(poste).length, 0, 'AUCUNE déclaration : le fait n’a pas été établi');
    assert.ok(aFerme(journal), 'et le pane ne reste pas derrière');
    assert.equal(r.stdout, '', 'rien qui ressemblerait à un succès');
  }));

// ── 9c — LE SERVICEDESK, QUI NE TUE PAS LA NAISSANCE

// ⚠️ CE BANC A LONGTEMPS GARDÉ UN DÉFAUT AU LIEU D'UN CONTRAT. Il exigeait que la cause parle
// d'« epic », parce que `declarerAuServiceDesk` refusait alors toute famille autre que
// `tickets` : le CAS CANONIQUE d'un chef d'équipe — qui mène un EPIC — ne pouvait pas aboutir,
// et le banc l'inscrivait comme la règle. Un epic se remplit désormais par SES STORIES, toutes.
// Ce qui reste éprouvé ici est le vrai contrat : quoi qu'il arrive au ServiceDesk, la naissance
// TIENT et l'échec SE DIT. L'assertion négative empêche le retour de l'ancien refus.
test('le ServiceDesk qui ne peut pas être rempli ne tue pas la naissance — l’échec se dit dans la sortie', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace });
    const r = lancerChef({ code, poste, horodatage });

    assert.equal(r.code, 0, `la naissance tient — stderr : ${r.stderr}`);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.servicedesk.rempli, false, 'il n’a pas été rempli');
    assert.equal(typeof rendu.servicedesk.cause === 'string' && rendu.servicedesk.cause.trim().length > 0, true,
      `la CAUSE est dite, pas escamotée — reçu ${JSON.stringify(rendu.servicedesk)}`);
    assert.doesNotMatch(rendu.servicedesk.cause, /pas un ticket/i,
      'un mandat EPIC n’est plus refusé sur sa FAMILLE — s’il échoue, c’est pour une autre raison');
    assert.equal(declarationsInscrites(poste).length, 1, 'la déclaration locale, elle, tient');
  }));

test('sans clé ServiceDesk, la naissance tient aussi — et le geste dit qu’il n’avait aucun accès', () =>
  avecChefDEquipe(({ poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace });
    // Un mandat de famille `tickets` — le chemin le plus court jusqu'à la garde de clé.
    const ticket = `t-20260825-${String(2000 + compteurChef).slice(-4)}`;
    const r = lancerNaitre(ticket, { role: 'chef-equipe', env: poste, horodatage });

    assert.equal(r.code, 0, `la naissance tient — stderr : ${r.stderr}`);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.servicedesk.rempli, false);
    assert.match(rendu.servicedesk.cause, /aucun accès/i, 'l’absence d’accès est NOMMÉE, pas confondue avec un refus');
  }));

// ═══════════════════════════════════════════════════════════════════════════════════════
// 9c-quater — LE DIAGNOSTIC PARVIENT À L'HUMAIN, ET C'EST LE *LIEU* QU'ON GARDE ICI
//
// 🔴 CE QU'UNE PASSE DE REVUE A MESURÉ, ET QUI TENAIT DEBOUT DEPUIS LE DÉBUT DU LOT.
//
// `phraseDuMandatIncomplet` a été SORTIE du binaire pour être éprouvable — son propre docblock
// le dit en toutes lettres :
//
//     « ELLE VIT ICI, PAS DANS LA COMMANDE, pour être éprouvable : une phrase écrite au fil
//       d'un `process.stderr.write` n'a pour garde que la relecture, et c'est ce qui a laissé
//       passer les quatre vérifications affirmées d'un chef d'équipe. »
//
// Le CONTENU est donc passé sous garde (`declaration.test.js`). Le LIEU, non. Les trois
// `process.stderr.write` du chemin chef d'équipe — le coordonnateur qui manque, le mandat
// incomplet, ce qu'on n'a pas pu mesurer — n'avaient pour garde que la relecture, c'est-à-dire
// EXACTEMENT la condition que ce docblock désigne comme la cause d'un défaut déjà payé.
//
// ⚠️ CE QUE LA MUTATION A MONTRÉ : vider le corps de chacun de ces trois `if`, un à la fois,
// laissait la suite entière VERTE. Les trois branches se supprimaient sans qu'une seule
// assertion rougisse — et le geste qui les efface a l'allure d'un entretien.
//
// ⚠️ POURQUOI AUCUN BANC EXISTANT NE LES TUAIT. Toutes les observations de ces phrases vivent
// dans `declaration.test.js`, qui appelle la FONCTION PURE. Aucune ne lance le binaire. Un banc
// qui se contenterait d'appeler la fonction pure ici referait le même trou : ce qui manque n'est
// pas une seconde mesure du contenu, c'est une mesure du LIEU où il est écrit.
//
// ⚠️ ET CE QUI CASSE QUAND LA LIGNE PART : la sortie standard ne porte que du JSON. L'humain qui
// tape la commande n'a plus AUCUN signal lisible qu'un mandat a été repris, sauté, ou pas rempli
// du tout. Le fait reste dans `stdout` pour un script ; il disparaît pour la personne.
//
// ⚠️ CES BANCS PORTENT LA FONCTION, PAS LA TOURNURE. Ils exigent que le diagnostic PARVIENNE
// (la phrase que produit la fonction, l'option qui lève le manque, la zone d'ombre nommée) —
// jamais une formulation. Une reformulation légitime de l'une de ces phrases les laisse verts.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Ce que la sortie d'erreur d'un chef d'équipe a dit, sans la ligne du versement ni le bruit git. */
const surLaSortieDErreur = (r, quoi) => r.stderr.includes(quoi);

test('🔴 LE COORDONNATEUR QUI MANQUE SE DIT À L’HUMAIN — et la ligne porte le geste qui le lève', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace });

    // La ligne réelle d'un coordonnateur pressé : il oublie l'attache.
    const r = lancerChef({ code, poste, horodatage });

    assert.equal(r.code, 0, `la naissance TIENT — on signale, on n’empêche pas de naître : ${r.stderr}`);
    assert.match(r.stderr, /coordonnateur/i, 'l’humain doit APPRENDRE que l’attache manque');
    // ⚠️ LE DRAPEAU, PAS UNE FORMULE. Ce fichier exige déjà ailleurs qu’un refus « NOMME le geste
    // qui le lève » : un diagnostic sans son geste ne débloque personne. C’est le contrat de
    // sortie de ce module, pas une tournure de phrase.
    assert.ok(surLaSortieDErreur(r, '--coordonnateur'), `le geste qui pose l’attache doit être NOMMÉ — stderr : ${r.stderr}`);
    // Et le fait est bien celui-là, pas un autre : la déclaration n’a pas de coordonnateur.
    assert.equal(JSON.parse(r.stdout).coordonnateur, null);
  }));

test('… et quand le coordonnateur EST nommé, rien ne se dit — sinon ce banc ne discrimine pas', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace });

    const r = lancerChef({ code, poste, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    assert.ok(
      !surLaSortieDErreur(r, '--coordonnateur'),
      `rien ne devait être signalé : l’attache est là — stderr : ${r.stderr}`
    );
    assert.equal(JSON.parse(r.stdout).coordonnateur, 'matapedia');
  }));

test('🔴 LE MANDAT INCOMPLET SE DIT À L’HUMAIN — la phrase de `declaration.js` atteint la sortie d’erreur', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace });

    const r = lancerChef({ code, poste, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `la naissance TIENT — le ServiceDesk ne la tue pas : ${r.stderr}`);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.servicedesk.rempli, false, 'le cas éprouvé est bien celui d’un mandat non rempli');

    // ⚠️ L'ORACLE EST LA FONCTION ELLE-MÊME, nourrie de ce que le binaire vient de RENDRE. Il ne
    // réécrit pas la règle : il exige que la production et la sortie d'erreur disent LA MÊME
    // chose. C'est la jointure des deux étages — chacun juste de son côté, la ligne qui les
    // relie gardée par personne.
    const attendu = phraseDuMandatIncomplet(rendu.mandat, rendu.servicedesk);

    // ⚠️ ET L'ORACLE N'EST PAS VIDE. Sans ce contrôle-ci, vider `phraseDuMandatIncomplet`
    // rendrait `stderr.includes('')` — vrai partout, y compris sur un binaire muet.
    assert.ok(attendu.includes(rendu.mandat), `l’oracle doit nommer le mandat — reçu : « ${attendu} »`);
    assert.ok(attendu.includes(rendu.servicedesk.cause), `l’oracle doit porter la cause — reçu : « ${attendu} »`);

    assert.ok(
      surLaSortieDErreur(r, attendu),
      `le diagnostic n’est pas parvenu à l’humain.\n  attendu : « ${attendu} »\n  stderr  : ${r.stderr}`
    );
  }));

// ── LA TROISIÈME BRANCHE — ce qu'on n'a PAS PU MESURER, sur un mandat qui a RÉUSSI
//
// ⚠️ ELLE NE S'ATTEINT PAS SANS SERVICEDESK, et c'est ce qui la rendait invisible. Les deux
// branches précédentes se voient sur un poste sans clé ; celle-ci demande un `rempli: true`
// PORTEUR d'une zone d'ombre — donc un service qui répond. Le double est chargé AVANT le
// binaire (voir `tests/aide/faux-servicedesk-en-sous-processus.mjs`) : c'est la chaîne réelle
// moins UNE chose, nommée — le réseau.

const PRELOAD_DESK = join(REPO_NAISSANCE, 'tests', 'aide', 'faux-servicedesk-en-sous-processus.mjs');

/**
 * Un ticket DIRECT, VIVANT, tel que le ServiceDesk le rend.
 *
 * ⚠️ MÊME FORME QUE `unTicketVivant` DE `declaration.test.js` — mesurée sur le service, pas
 * écrite de mémoire. Elle n'est pas importée de là-bas : importer un fichier d'essais LE FAIT
 * TOURNER. Ce qui empêche les deux de diverger en silence n'est donc pas le partage, c'est que
 * ce banc-ci refuse de conclure sans que le binaire ait RENDU la zone d'ombre qu'il attend :
 * une forme qui dériverait ferait rougir l'assertion `non_mesure`, pas passer l'essai.
 */
const unTicketQueLeDeskRend = (sur = {}) => ({
  'tickets:get': { ticket: { id: '11111111-2222-4333-8444-555555555555', ticket_id: 'T-20260825-0001', status: 'in_progress', ...sur } },
  'tickets:update': { ok: true },
});

/** Lance un chef d'équipe dont le ServiceDesk répond — et rend aussi ce que le double a VU. */
function avecUnDeskQuiRepond({ bac, poste, horodatage, scenario }) {
  const fichier = join(bac, `desk-${Math.random().toString(36).slice(2)}.json`);
  const journal = join(bac, `desk-appels-${Math.random().toString(36).slice(2)}.jsonl`);
  writeFileSync(fichier, JSON.stringify(scenario));
  compteurChef += 1;
  const ticket = `t-20260825-${String(3000 + compteurChef).slice(-4)}`;
  const r = lancerNaitre(ticket, {
    role: 'chef-equipe',
    horodatage,
    preload: PRELOAD_DESK,
    env: {
      ...poste,
      // ⚠️ UNE CLÉ EST NÉCESSAIRE : sans elle `transportServiceDesk` rend `null` et la commande
      // n'appelle personne. Elle ne peut atteindre aucun service réel — la cloison d'essais
      // refuserait tout appel dont le transport n'aurait pas été remplacé, et il l'est.
      SOMTECH_DESK_API_KEY: 'une-clé-d-essai',
      FAUX_DESK_SCENARIO: fichier,
      FAUX_DESK_JOURNAL: journal,
    },
  });
  const appels = existsSync(journal)
    ? readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  return { r, appels, ticket };
}

test('🔴 CE QU’ON N’A PAS PU MESURER SE DIT À L’HUMAIN — sur un mandat pourtant REMPLI', () =>
  avecChefDEquipe(({ bac, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace });

    // La charge NE PORTE PAS `assigned_agent` : le nom est écrit, mais on ne peut pas dire si
    // on a remplacé celui de quelqu'un. C'est un `rempli: true` avec une zone d'ombre — la
    // seule combinaison où la ligne 988 se tait et où celle-ci doit parler.
    const { r, appels } = avecUnDeskQuiRepond({ bac, poste, horodatage, scenario: unTicketQueLeDeskRend() });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    // ⚠️ LE DOUBLE A ÉTÉ TOUCHÉ. Un essai vert dont le service n'a jamais été appelé mesurerait
    // le silence d'un chemin jamais emprunté.
    assert.deepEqual(appels.map((a) => a.args.action), ['get', 'update'], `le binaire a parlé au double : ${JSON.stringify(appels)}`);

    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.servicedesk.rempli, true, 'le remplissage a bien eu lieu — c’est la moitié où l’autre ligne se TAIT');
    assert.ok(
      Array.isArray(rendu.servicedesk.non_mesure) && rendu.servicedesk.non_mesure.length > 0,
      `le cas éprouvé exige une zone d’ombre — reçu : ${JSON.stringify(rendu.servicedesk)}`
    );

    for (const zone of rendu.servicedesk.non_mesure) {
      assert.ok(
        surLaSortieDErreur(r, zone),
        `« ${zone} » est resté dans le JSON et n’a jamais atteint l’humain — stderr : ${r.stderr}`
      );
    }
    assert.ok(surLaSortieDErreur(r, rendu.mandat), `la ligne doit dire SUR QUEL mandat — stderr : ${r.stderr}`);
  }));

test('… et quand le champ A ÉTÉ LU, rien ne se dit — une zone d’ombre annoncée sur une mesure faite ferait chercher un défaut inexistant', () =>
  avecChefDEquipe(({ bac, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace });

    // ⚠️ LA MOITIÉ SYMÉTRIQUE : `assigned_agent` PRÉSENT et vide est une MESURE, pas une lacune.
    const { r } = avecUnDeskQuiRepond({
      bac,
      poste,
      horodatage,
      scenario: unTicketQueLeDeskRend({ assigned_agent: null }),
    });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.servicedesk.rempli, true);
    assert.deepEqual(rendu.servicedesk.non_mesure, [], 'le champ a été LU — il n’y a rien à relever');
    assert.ok(
      !surLaSortieDErreur(r, 'non mesuré'),
      `rien ne devait être relevé — stderr : ${r.stderr}`
    );
  }));

// ── 9c-ter — CE QUE LA SORTIE AFFIRME D'UN CHEF D'ÉQUIPE (défaut ③)
//
// 🔴 CE QUE LA REVUE A MESURÉ, dans le contrat MACHINE que le métier fait lire par `jq` :
//
//     "pose":"déjà","verifie":["le lieu est versé","l'agent porte son nom",
//                              "il tourne dans son lieu","son écran est prêt à recevoir"]
//
// Un chef d'équipe N'A PAS DE LIEU. Rien n'a été versé, rien n'a été « déjà posé », il ne tourne
// pas « dans son lieu » — il tourne dans un worktree jetable. Trois faits faux sur cinq, dans
// une sortie que des scripts lisent.
//
// ⚠️ POURQUOI RIEN NE L'A ATTRAPÉ : le champ voisin `garde` est ÉPINGLÉ (`assert.equal(…, null)`)
// et n'a jamais menti ; celui-ci n'avait qu'une assertion de FORME (`Array.isArray`), vraie quel
// que soit le contenu. Une assertion trop faible sur un chemin correct — elle passe, elle donne
// l'illusion de la couverture, et elle SURVIT à toute relecture.

/** Ce qu'un rôle QUI A UN LIEU fait vérifier — inchangé : des appelants le lisent. */
const VERIFIE_DUN_LIEU = [
  'le lieu est versé',
  'l’agent porte son nom',
  'il tourne dans son lieu',
  'son écran est prêt à recevoir',
];

/** Ce qu'un CHEF D'ÉQUIPE fait vérifier — chaque ligne correspond à un geste réellement exécuté. */
const VERIFIE_DUN_CHEF = [
  'son espace de travail est né sur sa branche-socle',
  'l’agent porte son nom',
  'il tourne dans son espace de travail',
  'son écran est prêt à recevoir',
];

test('🔴 la sortie d’un chef d’équipe n’affirme AUCUNE vérification qui n’a pas eu lieu', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT' });

    // La ligne que les textes prescrivent : sans `--workspace`.
    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    const rendu = JSON.parse(r.stdout);

    assert.deepEqual(rendu.verifie, VERIFIE_DUN_CHEF, `reçu : ${JSON.stringify(rendu.verifie)}`);
    // Les trois affirmations fausses, nommées une à une — pour qu’un retour en arrière se voie.
    assert.ok(!rendu.verifie.some((v) => /versé/.test(v)), 'rien n’a été versé : il n’a pas de lieu');
    assert.ok(!rendu.verifie.some((v) => /dans son lieu/.test(v)), 'il ne tourne pas « dans son lieu »');
    assert.equal(rendu.pose, null, '« déjà » dirait qu’un lieu était déjà posé — il n’y en a aucun');
    assert.equal(rendu.garde, null, 'et sa garde d’ouverture reste nulle, comme avant');
  }));

test('… tandis qu’un rôle QUI A UN LIEU affirme exactement ce qu’il affirmait — le contrat ne bouge pas', () =>
  avecLieu(
    (client, lieu) => {
      installerFauxHerdr({ repertoire: lieu });
      const r = lancerNaitre(client, { role: 'orchestrateur' });
      assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
      const rendu = JSON.parse(r.stdout);
      assert.deepEqual(rendu.verifie, VERIFIE_DUN_LIEU, 'aucun rôle neuf ne réécrit la sortie des autres');
      assert.ok(rendu.pose === 'maintenant' || rendu.pose === 'déjà', `pose inattendue : ${rendu.pose}`);
    },
    'riv',
    { role: 'orchestrateur', nom: `d-20260825-${String(process.pid).slice(-4)}v` }
  ));

// ── 9c-bis — L'ESPACE HERDR, SUR LA POPULATION RÉELLE (défaut ①)
//
// 🔴 CE QUE LA REVUE A MESURÉ, et pourquoi aucun banc ne l'avait vu. La ligne que les textes
// prescrivent ne porte PAS `--workspace` :
//
//     pack agent naitre revue-pr180 --role chef-equipe --depot <d> --coordonnateur moi
//
// La porte d'entrée ouvrait alors `herdr workspace create --cwd <d> --label revue-pr180
// --no-focus` AVANT de lancer la naissance — qui refusait le mandat en écrivant « Rien n'a été
// créé : ni espace de travail, ni onglet, ni agent. » L'espace restait. Tous les essais
// bout-en-bout de ce chemin passaient `--workspace w7` ou `w9`, ce qui court-circuitait
// exactement l'appel non gardé : le banc éprouvait une population qui n'était pas la vraie.
//
// Ces essais-ci lancent la commande SANS `--workspace`. Elle ouvre alors son espace elle-même,
// après tous ses refus, et le referme quand elle échoue ensuite.

/** Les espaces ouverts et refermés, dans l'ordre — lus du journal, jamais de la mémoire. */
const espacesOuverts = (journal) =>
  appelsJournalises(journal).filter((a) => a[0] === 'workspace' && a[1] === 'create');
const espacesFermes = (journal) =>
  appelsJournalises(journal).filter((a) => a[0] === 'workspace' && a[1] === 'close').map((a) => a[2]);

test('🔴 SANS --workspace, un mandat refusé ne fait ouvrir AUCUN espace herdr — le refus dit vrai', () =>
  avecChefDEquipe(({ poste }) => {
    const journal = installerFauxHerdr();

    const r = lancerNaitre('revue-pr180', { role: 'chef-equipe', env: poste, workspace: null, horodatage: '20260825-083616' });

    assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /Rien n’a été créé/, 'le refus AFFIRME que rien n’a été créé');
    assert.deepEqual(
      appelsJournalises(journal),
      [],
      '… et c’est VRAI : pas même un `workspace create`. C’est le défaut ① mesuré à l’envers.'
    );
    assert.equal(existsSync(poste.SOMTECH_WORKTREES_RACINE), false, 'aucun espace de travail non plus');
    assert.equal(declarationsInscrites(poste).length, 0);
  }));

test('SANS --workspace, une naissance complète OUVRE son espace — et l’onglet naît DEDANS', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    const journal = installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT' });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    assert.equal(espacesOuverts(journal).length, 1, 'un seul espace, pas un par relance');
    const ouverture = espacesOuverts(journal)[0];
    assert.equal(ouverture[ouverture.indexOf('--label') + 1], code, 'l’espace porte le code du mandat');
    assert.ok(ouverture.includes('--no-focus'), 'et il ne vole pas l’écran du dirigeant');
    // ⚠️ SUR LA SESSION VISÉE, pas sur celle qu'on hérite. La porte d'entrée appelait `herdr` NU :
    // l'espace naissait dans la session par défaut — c'est-à-dire dans rien, depuis un terminal
    // ordinaire —, puis la naissance résolvait SA session et refusait l'espace pour non-appartenance.
    const socketDeLOuverture = entreesJournalisees(journal).find((e) => e.a[0] === 'workspace' && e.a[1] === 'create').s;
    assert.equal(socketDeLOuverture, sessionsDesEssais, 'l’espace naît sur la session que la commande a résolue');
    // Et l'onglet part DANS celui-là — pas dans un espace écrit en dur.
    const onglet = appelsJournalises(journal).find((a) => a[0] === 'tab' && a[1] === 'create');
    assert.equal(onglet[onglet.indexOf('--workspace') + 1], 'wOUVERT');
    assert.equal(JSON.parse(r.stdout).pane, 'wOUVERT:p1');
    assert.deepEqual(espacesFermes(journal), [], 'une naissance réussie ne défait rien');
  }));

test('🔴 un échec APRÈS l’ouverture REFERME l’espace ouvert — l’ordre seul ne couvre pas cette moitié', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    // `agent start` refuse : le pane existe déjà, l'espace aussi. C'est le cas que déplacer la
    // création ne peut PAS fermer — et sans le défaire, l'espace resterait vide et orphelin.
    const journal = installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT', demarrage: 'refus' });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage });

    assert.equal(r.code, 1, `échec attendu — stdout : ${r.stdout}`);
    assert.deepEqual(espacesFermes(journal), ['wOUVERT'], 'l’espace ouvert par ce geste est refermé');
    // ⚠️ ET LA FERMETURE A ABOUTI. Sans cette ligne, le banc ne prouvait que l’APPEL : muté — le
    // double cessant de connaître `workspace close` — il restait vert alors que l’espace
    // survivait. Un appel journalisé n’est pas un effet obtenu ; c’est la MOITIÉ qui manquait.
    assert.doesNotMatch(
      r.stderr,
      /n’a PAS pu être refermé/,
      `la fermeture devait aboutir — stderr : ${r.stderr}`
    );
    assert.equal(declarationsInscrites(poste).length, 0, 'et rien n’a été déclaré');
  }));

// ── 9c-ter — L'ESPACE DE TRAVAIL, SUR LA POPULATION QU'AUCUN BANC N'ÉPROUVAIT (défaut ①)
//
// 🔴 CE QUE LA REVUE A MESURÉ. « Un refus ne laisse rien derrière lui » est écrit dans trois
// textes opposables. C'était FAUX de l'objet le plus lourd du geste : DIX refus tombent APRÈS
// `creerEspaceDeTravail`, et le seul filet de sortie ne connaissait que l'espace HERDR. Mesuré
// sur un dépôt jetable, avec `--session` inconnue :
//
//     <bac>/worktrees/depot/20260825-152006   ← l'arbre
//     wt/20260825-152006                       ← la branche, dans le dépôt du chantier
//     git worktree list → 2 entrées            ← l'enregistrement
//
// ⚠️ POURQUOI LES QUATRE ASSERTIONS « AUCUN ESPACE DE TRAVAIL » N'ONT RIEN VU : elles visent
// toutes un refus qui tombe AVANT la création. Une assertion juste sur un chemin correct, qui
// laisse la vraie population non gardée. Ces essais-ci provoquent des refus POSTÉRIEURS.

/** L'espace de travail, tel qu'un lecteur le verrait : l'arbre, la branche, l'enregistrement. */
const cequiResteDeLEspace = (depot, espace, horodatage) => ({
  arbre: existsSync(espace),
  branche: gitDit(depot, 'branch', '--list', `wt/${horodatage}`) !== '',
  enregistrements: gitDit(depot, 'worktree', 'list').split('\n').filter(Boolean).length,
});

test('🔴 un refus APRÈS la création de l’espace de travail le DÉFAIT — l’arbre, la branche, l’enregistrement', () =>
  avecChefDEquipe(({ code, depot, poste, horodatage, espace }) => {
    // `agent start` refuse : l'espace de travail existe déjà, l'onglet aussi. C'est l'un des
    // dix refus postérieurs — celui que le banc voisin éprouvait déjà pour l'espace HERDR, et
    // qui ne regardait pas l'arbre.
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT', demarrage: 'refus' });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage });

    assert.equal(r.code, 1, `échec attendu — stdout : ${r.stdout}`);
    assert.deepEqual(
      cequiResteDeLEspace(depot, espace, horodatage),
      { arbre: false, branche: false, enregistrements: 1 },
      'rien ne reste : ni l’arbre, ni sa branche-socle, ni son entrée dans `git worktree list`'
    );
    // ⚠️ ET LE DÉFAIRE A ABOUTI — pas seulement été tenté. Sans cette ligne, un défaire qui
    // échoue en silence rendrait ce banc vert le jour où il cesse de retirer quoi que ce soit.
    assert.doesNotMatch(r.stderr, /n’a PAS pu être défait/, `le défaire devait aboutir — stderr : ${r.stderr}`);
  }));

test('🔴 un refus qui tombe AVANT le moindre onglet le défait aussi — la session que le poste ne connaît pas', () =>
  avecChefDEquipe(({ code, depot, poste, horodatage, espace }) => {
    // La session nommée n'existe pas : le refus tombe entre la création de l'espace de travail
    // et l'ouverture de l'espace herdr. C'est le refus EXACT que la revue a mesuré, et le seul
    // endroit où AUCUN autre filet n'est armé.
    installerFauxHerdr({ repertoire: espace });

    const r = lancerNaitre(code, {
      role: 'chef-equipe',
      env: poste,
      workspace: null,
      horodatage,
      session: 'session-qui-nexiste-pas',
    });

    assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /session-qui-nexiste-pas/, 'le refus mesuré, et pas un autre');
    assert.deepEqual(
      cequiResteDeLEspace(depot, espace, horodatage),
      { arbre: false, branche: false, enregistrements: 1 },
      'et cette fois « rien n’a été créé » est VRAI'
    );
  }));

// ⚠️ LES DEUX MOITIÉS D'UN DÉFAIRE : ce qu'il retire, ET ce à quoi il ne touche JAMAIS.
// Un défaire qui peut détruire du travail est PIRE que l'orphelin qu'il nettoie.

test('🔴 un arbre qui porte du TRAVAIL n’est pas détruit — le refus le nomme, et le geste est laissé à l’humain', () =>
  avecChefDEquipe(({ code, depot, poste, horodatage, espace }) => {
    // L'agent est né et a écrit ; c'est le contrôle du NOM qui refuse ensuite. Le pane est
    // refermé, la commande sort en 1 — et l'arbre porte trois heures de travail.
    installerFauxHerdr({
      repertoire: espace,
      espaceCree: 'wOUVERT',
      nomPorte: 'quelquun-dautre',
      travailEcrit: join(espace, 'ce-que-lagent-a-ecrit.txt'),
    });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage, essais: '1' });

    assert.equal(r.code, 1, `échec attendu — stdout : ${r.stdout}`);
    assert.ok(existsSync(join(espace, 'ce-que-lagent-a-ecrit.txt')), '🔴 le travail est INTACT');
    assert.equal(existsSync(espace), true, '… et l’arbre aussi');
    assert.match(r.stderr, new RegExp(horodatage), 'l’espace resté est NOMMÉ — un orphelin tu est pire que pas de ménage');
    assert.match(r.stderr, /worktree remove/, 'et le geste exact qui le retire, une fois qu’un humain a jugé');
  }));

test('🔴 une amorce non prise laisse l’agent VIVANT — donc son espace de travail sous ses pieds', () =>
  avecChefDEquipe(({ code, depot, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT', promptRefuse: true });

    const r = lancerNaitre(code, {
      role: 'chef-equipe',
      env: poste,
      workspace: null,
      horodatage,
      amorce: 'commence par lire le registre',
      essais: '1',
    });

    assert.equal(r.code, 1, `l’amorce doit ÉCHOUER pour que ce banc mesure quoi que ce soit — stdout : ${r.stdout}`);
    assert.match(r.stderr, /pane est laissé ouvert/i, 'la commande dit qu’elle laisse l’agent vivre');
    assert.deepEqual(
      cequiResteDeLEspace(depot, espace, horodatage),
      { arbre: true, branche: true, enregistrements: 2 },
      '… et elle ne le tue pas en retirant l’arbre où il travaille'
    );
  }));

test('🔴 une déclaration qui ne s’écrit pas laisse l’agent VIVANT — donc son espace de travail aussi', () =>
  avecChefDEquipe(({ code, depot, poste, bac, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT' });
    const barrage = join(bac, 'racine-prise-3');
    writeFileSync(barrage, 'je ne suis pas un répertoire\n');

    const r = lancerNaitre(code, {
      role: 'chef-equipe',
      env: { ...poste, SOMTECH_NAISSANCES_RACINE: barrage },
      workspace: null,
      horodatage,
    });

    assert.equal(r.code, 1, `échec attendu — stdout : ${r.stdout}`);
    assert.deepEqual(
      cequiResteDeLEspace(depot, espace, horodatage),
      { arbre: true, branche: true, enregistrements: 2 },
      'l’agent travaille : son arbre lui survit'
    );
  }));

test('une naissance RÉUSSIE ne défait évidemment rien — la moitié sans laquelle le défaire tuerait tout le monde', () =>
  avecChefDEquipe(({ code, depot, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT' });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    assert.deepEqual(cequiResteDeLEspace(depot, espace, horodatage), { arbre: true, branche: true, enregistrements: 2 });
  }));

test('🔴 mais un espace DONNÉ n’est JAMAIS refermé — on ne détruit pas ce qu’on n’a pas ouvert', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    // Le même échec, avec un espace nommé par l'appelant : le refermer emporterait le travail
    // d'un tiers pour une naissance ratée. C'est la moitié qui protège le geste du défaire.
    const journal = installerFauxHerdr({ repertoire: espace, demarrage: 'refus' });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: 'w9', horodatage });

    assert.equal(r.code, 1, `échec attendu — stdout : ${r.stdout}`);
    assert.deepEqual(espacesFermes(journal), [], 'aucun `workspace close` : cet espace appartient à qui l’a nommé');
    assert.equal(espacesOuverts(journal).length, 0, 'et aucun n’a été ouvert');
  }));

test('🔴 une amorce non prise laisse l’agent VIVANT — donc son espace aussi', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    // ⚠️ LE CAS QUI REND UN DÉFAIRE AVEUGLE DANGEREUX. La commande sort en 1 ET laisse
    // délibérément le pane ouvert : l'agent est né, vérifié, dans son espace. Refermer l'espace
    // ici le tuerait — c'est-à-dire ferait, par la porte d'à côté, exactement ce que l'arbitrage
    // du pane refuse de faire.
    const journal = installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT', promptRefuse: true });

    const r = lancerNaitre(code, {
      role: 'chef-equipe',
      env: poste,
      workspace: null,
      horodatage,
      amorce: 'commence par lire le registre',
      essais: '1',
    });

    // ⚠️ PAS D'ÉCHAPPATOIRE : un banc qui se tairait quand la livraison aboutit serait un banc
    // qui ne peut pas échouer — il passerait aussi bien le jour où ce chemin cesse d'exister.
    assert.equal(r.code, 1, `l’amorce doit ÉCHOUER pour que ce banc mesure quoi que ce soit — stdout : ${r.stdout}`);
    assert.match(r.stderr, /pane est laissé ouvert/i, 'la commande dit qu’elle laisse l’agent vivre');
    assert.deepEqual(espacesFermes(journal), [], '… et elle ne le tue pas par l’espace');
  }));

test('🔴 une déclaration qui ne s’écrit pas laisse l’agent VIVANT — donc son espace aussi', () =>
  avecChefDEquipe(({ code, poste, bac, horodatage, espace }) => {
    const journal = installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT' });
    const barrage = join(bac, 'racine-prise-2');
    writeFileSync(barrage, 'je ne suis pas un répertoire\n');

    const r = lancerNaitre(code, {
      role: 'chef-equipe',
      env: { ...poste, SOMTECH_NAISSANCES_RACINE: barrage },
      workspace: null,
      horodatage,
    });

    assert.equal(r.code, 1, `échec attendu — stdout : ${r.stdout}`);
    assert.equal(aFerme(journal, 'wOUVERT:p1'), false, 'le pane n’est pas refermé');
    assert.deepEqual(espacesFermes(journal), [], 'et l’espace qui le porte non plus');
  }));

test('quand herdr refuse d’OUVRIR l’espace, le refus le dit — et il n’y a rien à défaire', () =>
  avecChefDEquipe(({ code, poste, horodatage }) => {
    const journal = installerFauxHerdr({ creationRefusee: true });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage });

    assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /espace de travail/i);
    assert.match(r.stderr, /herdr status|--workspace/, 'et le geste qui lève le blocage');
    assert.deepEqual(espacesFermes(journal), [], 'rien à refermer : rien n’a été ouvert');
  }));

test('et quand herdr refuse de le REFERMER, l’orphelin est NOMMÉ — jamais tu', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    // ⚠️ UN DÉFAIRE QUI ÉCHOUE EN SILENCE SERAIT PIRE QUE PAS DE DÉFAIRE : on croirait le
    // ménage fait. On dit l'identifiant ET la commande qui le retire.
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT', demarrage: 'refus', fermetureRefusee: true });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage });

    assert.equal(r.code, 1);
    assert.match(r.stderr, /wOUVERT/, 'l’espace resté est nommé');
    assert.match(r.stderr, /herdr workspace close wOUVERT/, 'et le geste exact qui le retire');
  }));

// ── 9d — CE QUI EST REFUSÉ, ET CE QUE LE REFUS NE LAISSE PAS DERRIÈRE LUI

test('un chef d’équipe dont le nom n’est pas un code de chantier est REFUSÉ — rien n’est créé', () =>
  avecChefDEquipe(({ poste }) => {
    const journal = installerFauxHerdr();

    const r = lancerNaitre('revue-pr180', { role: 'chef-equipe', env: poste, horodatage: '20260825-083616' });

    assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /code de chantier/i, 'le refus dit ce qui manque');
    assert.match(r.stderr, /E-\d{8}-\d{4}/, 'et MONTRE la forme attendue');
    assert.equal(appelsJournalises(journal).length, 0, 'aucun appel herdr : le refus tombe avant tout');
    assert.equal(existsSync(poste.SOMTECH_WORKTREES_RACINE), false, 'aucun espace de travail');
    assert.equal(declarationsInscrites(poste).length, 0, 'aucune déclaration');
  }));

// 🔴 UN HORODATAGE DICTÉ HORS FORME EST REFUSÉ — POUR SON MOTIF VIVANT.
//
// `--horodatage` était pris TEL QUEL. Le motif d'origine de cette porte — « ce segment borne la
// population de la garde, un nom hors forme fait naître un agent jamais jugé » — est ABOLI : la
// garde borne sur la NAISSANCE de l'agent, lue au transcrit de sa session. Remesuré : un agent
// sans aucune déclaration né après la frontière dans `…/mon-essai` rend `horsPortee: 0,
// population: 1, prises: 1` — il est jugé comme les autres.
//
// La porte reste, pour ce qui n'a jamais eu besoin de la garde : cet horodatage nomme l'espace
// ET sa branche-socle `wt/<horodatage>`, c'est par LUI qu'on reprend une session
// (`claude-swt <horodatage>`) et c'est lui qui la rend unique à la seconde.
test('🔴 un horodatage que la garde ne saura pas lire est REFUSÉ — rien n’est créé', () =>
  avecChefDEquipe(({ code, poste }) => {
    const journal = installerFauxHerdr();

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, horodatage: 'mon-essai' });

    assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /mon-essai/, 'le refus cite la valeur reçue');
    assert.match(r.stderr, /AAAAMMJJ-HHMMSS|20260825-083616/, 'et montre la forme attendue');
    // ⚠️ CETTE ASSERTION EXIGEAIT LE MOT « garde » — le prédicat ainsi invoqué est aboli. Elle
    // garde la même FONCTION : un refus de forme doit dire POURQUOI, sinon il se lit comme du
    // zèle et se contourne. Elle vise désormais le motif que la mesure soutient.
    assert.match(r.stderr, /reprend|claude-swt/i, 'et dit POURQUOI : on reprend la session par cet horodatage');
    assert.doesNotMatch(r.stderr, /jamais jugé|hors portée/i, 'et n’invoque plus le prédicat aboli');
    assert.equal(appelsJournalises(journal).length, 0, 'aucun appel herdr : le refus tombe avant tout');
    assert.equal(existsSync(poste.SOMTECH_WORKTREES_RACINE), false, 'aucun espace de travail');
    assert.equal(declarationsInscrites(poste).length, 0, 'aucune déclaration');
  }));

// ⚠️ LA MOITIÉ QUI PROTÈGE LE CHEMIN NORMAL. Une porte qui refuserait aussi la valeur que la
// commande FABRIQUE elle-même tuerait toute naissance qui ne dicte pas son horodatage.
test('un horodatage canonique dicté passe, et l’espace porte exactement ce nom', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace });
    const r = lancerChef({ code, poste, horodatage });
    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    assert.ok(existsSync(espace), `l’espace n’existe pas : ${espace}`);
  }));

test('sans base à partir de quoi partir, le refus tombe AVANT le moindre onglet', () =>
  avecChefDEquipe(
    ({ code, poste, horodatage }) => {
      const journal = installerFauxHerdr();

      const r = lancerChef({ code, poste, horodatage });

      assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
      assert.match(r.stderr, /origin\/main/, 'la base cherchée est nommée');
      assert.equal(appelsJournalises(journal).length, 0, 'aucun onglet, aucun agent');
      assert.equal(declarationsInscrites(poste).length, 0);
    },
    { avecOrigin: false }
  ));

test('un espace de travail déjà occupé fait REFUSER — sans y toucher, et sans ouvrir d’onglet', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace: occupe }) => {
    const journal = installerFauxHerdr();
    mkdirSync(occupe, { recursive: true });
    writeFileSync(join(occupe, 'le-travail-dun-autre.txt'), 'ne me touche pas\n');

    const r = lancerChef({ code, poste, horodatage });

    assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /existe déjà/i);
    assert.match(r.stderr, /même arbre|deux agents/i, 'et POURQUOI on ne réutilise pas');
    assert.ok(existsSync(join(occupe, 'le-travail-dun-autre.txt')), 'le refus n’a rien effacé');
    assert.equal(appelsJournalises(journal).length, 0, 'aucun onglet');
    assert.equal(declarationsInscrites(poste).length, 0);
  }));

// ⚠️ CE QU'ON NE FAIT PAS : REFERMER LE PANE. L'agent est né, vérifié, dans son espace — le
// tuer pour un fichier de registre détruirait un travail prouvé bon au profit d'une écriture
// comptable. Mais la commande ÉCHOUE, exactement comme pour une amorce non prise : une
// naissance qu'on ne peut pas inscrire n'est pas une naissance réussie, et rendre `ok: true`
// serait le succès muet que tout ce fichier existe pour fermer.
test('une déclaration qui ne peut pas s’écrire fait ÉCHOUER le geste — mais ne tue pas l’agent né', () =>
  avecChefDEquipe(({ code, poste, bac, horodatage, espace }) => {
    const journal = installerFauxHerdr({ repertoire: espace });
    // La racine des naissances est un FICHIER : `mkdirSync` échouera (ENOTDIR), et c'est un
    // vrai mode de panne — un montage qui décroche, un chemin pris par autre chose.
    const barrage = join(bac, 'racine-prise');
    writeFileSync(barrage, 'je ne suis pas un répertoire\n');

    const r = lancerChef({ code, poste: { ...poste, SOMTECH_NAISSANCES_RACINE: barrage }, horodatage });

    assert.equal(r.code, 1, `échec attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /déclaration/i, 'le message dit CE QUI a échoué');
    assert.match(r.stderr, /pane/i, 'et dit que le pane reste ouvert');
    assert.equal(aFerme(journal), false, 'l’agent né et vérifié n’est PAS tué pour une écriture de registre');
    // ⚠️ CETTE ASSERTION A CHANGÉ DE FORME, PAS DE FONCTION — et la distinction est celle qui
    // empêche une garde d'être « mise au vert » par une réécriture ordonnée. Ce qu'elle gardait
    // est : RIEN NE DOIT RESSEMBLER À UN SUCCÈS. Elle l'exprimait par « stdout est vide », ce qui
    // était vrai tant que ce chemin ne rendait rien — et c'était précisément le défaut : un agent
    // vivant, déclaré ou non, que la sortie ne permettait plus d'adresser (`jq -r .pane` → null).
    // La commande rend désormais ce qu'elle a LAISSÉ ; la fonction gardée devient donc « ok est
    // FAUX », et elle est plus forte qu'un vide : un vide passerait aussi le jour où quelqu'un
    // rendrait `ok: true` par erreur sur une autre porte.
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.ok, false, 'et rien ne ressemble à un succès');
    assert.equal(rendu.vivant, true, '— mais ce qui vit est DIT, plutôt que tu');
  }));

test('hors dépôt git, un chef d’équipe ne naît pas — et aucun espace n’est créé', () => {
  const bac = mkdtempSync(join(tmpdir(), 'smtk-chef-nogit-'));
  const poste = {
    SOMTECH_WORKTREES_RACINE: join(bac, 'worktrees'),
    SOMTECH_NAISSANCES_RACINE: join(bac, 'naissances'),
    HOME: join(bac, 'faux-home'),
    SOMTECH_DESK_API_KEY: '',
    SERVICEDESK_MCP_TOKEN: '',
  };
  mkdirSync(poste.HOME, { recursive: true });
  depotCourant = bac;
  try {
    const journal = installerFauxHerdr();
    const r = lancerNaitre('e-20260825-0099', { role: 'chef-equipe', env: poste, horodatage: '20260825-083616' });

    assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /dépôt git/i, 'le refus dit CE QUI manque');
    assert.equal(appelsJournalises(journal).length, 0);
    assert.equal(existsSync(poste.SOMTECH_WORKTREES_RACINE), false);
  } finally {
    depotCourant = null;
    rmSync(bac, { recursive: true, force: true });
  }
});

// ⚠️ LA MOITIÉ QUI PROTÈGE LES AUTRES RÔLES. Un rôle neuf branché avant la validation de rôle
// pourrait, s'il était mal branché, avaler aussi les rôles qui ONT un lieu — et un
// orchestrateur naîtrait alors sans son lieu, sans sa garde et sans son versement, en silence.
test('les rôles qui ONT un lieu ne passent PAS par le chemin du chef d’équipe', () =>
  avecLieu(
    (code, lieu) => {
      installerFauxHerdr({ repertoire: lieu });
      const r = lancerNaitre(code, { role: 'orchestrateur' });
      assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
      const rendu = JSON.parse(r.stdout);
      assert.equal(rendu.lieu, lieu, 'un orchestrateur naît TOUJOURS dans son lieu');
      assert.ok(rendu.garde, 'et sa garde d’ouverture est posée');
      assert.equal(rendu.declaration, undefined, 'la déclaration reste au chef d’équipe — ce lot ne la lui donne pas');
    },
    'riv',
    { role: 'orchestrateur', nom: `d-20260825-${String(process.pid).slice(-4)}z` }
  ));

test('un rôle qui n’existe pas reste refusé — le rôle neuf n’a pas ouvert la porte à n’importe quoi', () =>
  avecLieu((client) => {
    const journal = installerFauxHerdr();
    const r = lancerNaitre(client, { role: 'chef-dorchestre' });
    assert.equal(r.code, 1, `refus attendu — stdout : ${r.stdout}`);
    assert.match(r.stderr, /rôle inconnu/i);
    assert.equal(appelsJournalises(journal).length, 0);
  }, 'inconnu'));

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 L'HORODATAGE DICTÉ, BIEN FORMÉ, MAIS D'AVANT LA MISE EN SERVICE (D-20260825-0002)
//
// Ce banc éprouvait ici le REFUS d'un tel horodatage, et le motif imprimé était : « cet agent
// naîtrait hors portée / ne serait jamais jugé ». Ce prédicat est ABOLI — la garde borne sur la
// NAISSANCE de l'agent, lue au transcrit de sa session, plus sur le nom de son répertoire.
// Remesuré : agent sans aucune déclaration né après la frontière dans `…/mon-essai`,
// `…/2026-08-25`, `…/20260819-005653` → `horsPortee: 0, population: 1, prises: 1` les trois fois.
//
// Le refus ne protégeait donc plus rien, et il coûtait un faux refus SUR L'USAGE PRESCRIT de
// l'option — « rejouer un refus à l'identique », « reprendre une session par son nom », qui
// redonnent tous deux un horodatage d'HIER. Ce banc éprouve désormais que la commande le mène
// jusqu'au bout : une porte retirée dont on ne mesure pas le passage se referme à la première
// réécriture, sans qu'un rouge le dise.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 un horodatage BIEN FORMÉ mais d’AVANT la mise en service va JUSQU’AU BOUT — le nom de l’espace ne décide plus de rien', () =>
  avecChefDEquipe(({ code, poste }) => {
    const horodatage = '20260824-235959';
    const espace = join(poste.SOMTECH_WORKTREES_RACINE, 'le-chantier', horodatage);
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT' });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    assert.equal(JSON.parse(r.stdout).espace, espace, 'et l’espace porte exactement le nom dicté');
    assert.ok(existsSync(espace), `l’arbre n’existe pas : ${espace}`);
    assert.equal(declarationsInscrites(poste).length, 1, 'la naissance est inscrite comme n’importe quelle autre');
  }));

test('la frontière EXACTE passe elle aussi — aucune date n’est plus une porte', () =>
  avecChefDEquipe(({ code, poste }) => {
    const horodatage = '20260825-000000';
    const espace = join(poste.SOMTECH_WORKTREES_RACINE, 'le-chantier', horodatage);
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT' });

    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    assert.equal(JSON.parse(r.stdout).espace, espace);
  }));

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 UN REFUS QUI LAISSE UN AGENT VIVANT DOIT RENDRE DE QUOI L'ADRESSER (D-20260825-0002)
//
// LE DÉFAUT MESURÉ. Sur le refus d'amorce : `code = 1`, `stdout = ""` — et pourtant un agent
// vivant, son worktree, sa branche-socle, l'espace herdr, ET SA DÉCLARATION ÉCRITE.
//
// Le geste que le métier prescrit trois lignes sous « un refus ne laisse rien derrière lui » :
//     NAISSANCE=$(… pack agent naitre …)
//     P=$(printf '%s' "$NAISSANCE" | jq -r .pane)
// rend donc `P=null`. L'orchestrateur vient de lire que rien ne survit — pendant qu'un chef
// d'équipe DÉCLARÉ travaille dans un arbre qu'il ne sait plus adresser. Et la garde des
// naissances ne le rattrapera pas : il est déclaré, donc « identifié ».
//
// CE QUI EST TRANCHÉ, ET POURQUOI. Garder l'agent vivant reste juste — `laisserVivre()` est un
// arbitrage écrit à deux endroits : un agent prouvé bon ne se tue pas pour une amorce non prise
// ni pour une écriture de registre. Ce qui était faux, c'est que la commande N'EN DISAIT RIEN
// LÀ OÙ ON LA LIT. Elle rend donc, sur stdout, ce qu'elle a LAISSÉ — `ok: false`, `vivant: true`,
// la cause, et le pane. La sortie reste 1 : rien de ce qui distingue un échec ne bouge.
//
// ⚠️ POURQUOI LES BANCS NE L'AVAIENT PAS VU : le harnais possède `declarationsInscrites(poste)`
// et AUCUN des deux essais « une amorce non prise laisse l'agent VIVANT » ne l'appelait. Ils
// mesuraient l'arbre et l'espace herdr, JAMAIS le registre.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 une amorce non prise laisse une DÉCLARATION au registre — et la sortie rend de quoi adresser l’agent', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT', promptRefuse: true });

    const r = lancerNaitre(code, {
      role: 'chef-equipe',
      env: poste,
      workspace: null,
      horodatage,
      amorce: 'commence par lire le registre',
      essais: '1',
      coordonnateur: 'matapedia',
    });

    assert.equal(r.code, 1, `l’amorce doit ÉCHOUER — stdout : ${r.stdout}`);

    // ① LE REGISTRE — la moitié qu'aucun banc ne regardait. Ce n'est pas un défaut à corriger :
    // c'est un fait à MESURER, parce que c'est lui qui rend l'agent invisible à la garde.
    const inscrites = declarationsInscrites(poste);
    assert.equal(inscrites.length, 1, 'la déclaration EST écrite — le refus ne l’a pas défaite');
    assert.equal(inscrites[0].nom, code);

    // ② ET LA SORTIE DIT CE QU'ELLE A LAISSÉ. C'est le geste prescrit par le métier, joué tel quel.
    assert.notEqual(r.stdout.trim(), '', 'un refus qui laisse un agent vivant ne peut pas être MUET sur stdout');
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.ok, false, 'ce n’est PAS un succès');
    assert.equal(rendu.vivant, true, '… mais quelque chose vit');
    // ⚠️ ON NE COMPARE PAS À UNE CONSTANTE ÉCRITE ICI : le pane dépend de l'espace ouvert par le
    // geste (`wOUVERT:p1` quand aucun `--workspace` n'est donné). On exige qu'il SOIT rendu, et
    // qu'il soit CELUI QUE LE REFUS NOMME sur stderr — deux rendus du même fait qui divergeraient
    // enverraient l'orchestrateur vers un pane qui n'est pas celui de son agent.
    assert.match(String(rendu.pane), /^w[^:]+:p\d+$/, '🔴 `jq -r .pane` doit rendre le pane, pas « null »');
    assert.ok(
      r.stderr.includes(rendu.pane),
      `stdout rend « ${rendu.pane} », stderr nomme autre chose :\n${r.stderr}`
    );
    assert.equal(rendu.espace, espace, 'et l’arbre où il travaille');
    assert.equal(rendu.amorcee, false, 'le brief n’a pas été pris');
    assert.match(String(rendu.cause), /amorce/i, 'la cause est nommée, pas devinée');
    assert.ok(rendu.declaration, 'et la déclaration écrite voyage avec — sinon il faut aller relire un répertoire');
  }));

test('🔴 une déclaration qui ne s’écrit pas laisse elle aussi un agent vivant — et la sortie l’adresse, sans mentir sur le registre', () =>
  avecChefDEquipe(({ code, poste, bac, horodatage, espace }) => {
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT' });
    const barrage = join(bac, 'racine-prise-4');
    writeFileSync(barrage, 'je ne suis pas un répertoire\n');

    const r = lancerNaitre(code, {
      role: 'chef-equipe',
      env: { ...poste, SOMTECH_NAISSANCES_RACINE: barrage },
      workspace: null,
      horodatage,
    });

    assert.equal(r.code, 1, `échec attendu — stdout : ${r.stdout}`);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.ok, false);
    assert.equal(rendu.vivant, true);
    assert.match(String(rendu.pane), /^w[^:]+:p\d+$/);
    assert.ok(r.stderr.includes(rendu.pane), 'le même pane des deux côtés');
    // ⚠️ ET ON NE PRÉTEND PAS QU'UNE DÉCLARATION EXISTE. Sur CE chemin-ci elle a échoué : la
    // rendre non nulle serait le fait faux que tout ce fichier existe pour interdire.
    assert.equal(rendu.declaration, null, 'aucune déclaration n’a été inscrite, et la sortie le dit');
    assert.match(String(rendu.cause), /déclaration/i);
  }));

test('une naissance RÉUSSIE ne porte pas ces champs — sinon un appelant ne distingue plus les deux', () =>
  avecChefDEquipe(({ code, poste, horodatage, espace }) => {
    // ⚠️ LA MOITIÉ QUI EMPÊCHE LE REMÈDE DE DEVENIR LE DÉFAUT. Si `vivant`/`cause` sortaient
    // aussi sur le succès, un appelant qui teste `.vivant` lirait la même chose des deux côtés.
    installerFauxHerdr({ repertoire: espace, espaceCree: 'wOUVERT' });
    const r = lancerNaitre(code, { role: 'chef-equipe', env: poste, workspace: null, horodatage, coordonnateur: 'matapedia' });

    assert.equal(r.code, 0, `naissance attendue — stderr : ${r.stderr}`);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.ok, true);
    assert.equal(rendu.vivant, undefined, 'le succès ne porte pas le vocabulaire du refus');
    assert.equal(rendu.cause, undefined);
  }));

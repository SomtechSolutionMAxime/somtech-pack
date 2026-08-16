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

if (cmd === 'tab create') sortir({ result: { root_pane: { pane_id: 'w9:p1' } } }, 0);

// ═══ \`agent start\` — la forme EXACTE mesurée contre le vrai service le 2026-08-16.
if (cmd === 'agent start') {
  const pane = apres('--pane');
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
        pane_id: 'w9:p1',
        agent_status: 'idle',
        name: sc.nomPorte || (ne ? ne[2] : null),
        cwd: sc.repertoire,
        foreground_cwd: sc.repertoire,
      },
    },
  }, 0);
}

if (cmd === 'agent prompt') sortir({ result: { type: 'agent_prompted' } }, 0);
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

function lancerNaitre(client, { workspace = 'w9', amorce = null, modele = null, mode = null, role = null, essais = '3' } = {}) {
  const args = [BIN, client, '--workspace', workspace];
  if (depotCourant) args.push('--depot', depotCourant);
  if (amorce) args.push('--amorce-texte', amorce);
  if (modele) args.push('--modele', modele);
  if (mode) args.push('--mode', mode);
  if (role) args.push('--role', role);
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
function avecLieu(faire, prefixe = 'smoke', { verser = true, git: avecGit = true, poser = true, nom = null } = {}) {
  compteur += 1;
  const client = nom || `${prefixe}-${process.pid}-${compteur}`;
  const depot = mkdtempSync(join(tmpdir(), 'smtk-naitre-depot-'));
  const git = (...args) => execFileSync('git', ['-C', depot, ...args], { stdio: 'ignore' });
  if (avecGit) {
    git('init', '-q');
    git('config', 'user.email', 'essai@somtech.ca');
    git('config', 'user.name', 'essai');
  }

  const lieu = join(depot, '.gestionnaire', client);
  if (poser) {
    mkdirSync(join(lieu, '.claude'), { recursive: true });
    writeFileSync(join(lieu, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
    writeFileSync(join(lieu, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
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
      ['agent', 'read', 'w9:p1', '--source', 'visible', '--lines', '40'],
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

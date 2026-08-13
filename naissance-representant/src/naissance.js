// naissance.js — ce qu'il faut pour faire naître une session dans le lieu d'un client :
// vérifier que le lieu existe déjà (posé par `ligne-directe representant`, E-20260807-0002),
// FUSIONNER le garde d'ouverture dans le `.claude/settings.json` que ce lieu porte déjà
// (jamais l'écraser — leurs permissions y vivent), et construire (sans les exécuter) les
// commandes herdr qui font naître le pane. L'exécution réelle vit dans bin/naitre.js — même
// séparation que src/garde.js vs hooks/garde-ouverture-ligne.js.
//
// FRONTIÈRE AVEC E-20260807-0002 (lots 2+4, fusionnés) :
//
// `ligne-directe representant <client> --canal <canal>` pose QUATRE fichiers sous
// `.gestionnaire/<client>/` : `CLAUDE.md`, `CONTEXTE.md`, `.mcp.json` (registre seul, à
// plat), `.claude/settings.json` (permissions lecture-seule + registre seul). Les deux
// derniers sont lus par Claude Code SANS drapeau au lancement dès lors qu'on démarre AVEC
// cwd = le lieu (mesuré par eux sur ce dépôt : `.mcp.json` se lit à la racine du PROJET, et
// le projet est là où `claude` démarre — pas la racine du dépôt git). La naissance n'a donc
// plus à câbler `--settings`/`--mcp-config` : `cd <lieu> && claude` suffit.
//
// CE QUI RESTE À CE MODULE : le garde d'ouverture, FUSIONNÉ dans leur settings.json plutôt
// qu'écrit à part — un seul `.claude/settings.json` existe par démarrage, et l'écraser
// perdrait leurs permissions.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GABARITS, racineLieu } from '../../ligne-directe/src/lieu-agent.js';
import { role as roleDe } from '../../ligne-directe/src/roles.js';

/** La commande qui POSE le lieu de chaque rôle — citée dans le refus, pour qu'il dise quoi faire. */
const COMMANDE_DE_POSE = {
  representant: 'ligne-directe representant <client> --canal <canal>',
  orchestrateur: 'ligne-directe orchestrateur <nom>',
};

export class LieuAbsent extends Error {
  constructor(nom, chemin, manquants, role = 'representant') {
    super(
      `le lieu de « ${nom} » n'existe pas encore ou est incomplet (${chemin}, manque : ` +
        `${manquants.join(', ')}) — pose-le d'abord (\`${COMMANDE_DE_POSE[role] || COMMANDE_DE_POSE.representant}\`) ; ` +
        `la naissance ne crée jamais le lieu, elle en dépend`
    );
    this.name = 'LieuAbsent';
    this.client = nom;
    this.nom = nom;
    this.role = role;
    this.chemin = chemin;
    this.manquants = manquants;
  }
}

/** Le chemin du lieu d'un agent, sous la racine du dépôt. */
export function cheminLieu(repoRoot, nom, role = 'representant') {
  return racineLieu(repoRoot, role, nom);
}

// ═══════════════════════════════ Le garde, tel qu'un fichier VERSIONNÉ peut le désigner
//
// T-20260809-0032. Le garde était inscrit en chemin ABSOLU, calculé depuis la position du
// dépôt au moment de l'appel — donc, quand on posait depuis un plan de travail horodaté :
//
//   "command": "node /Users/…/worktrees/somtech-pack/20260809-092622/naissance-…/garde….js"
//
// Deux torts, et seul le premier fait mal :
//
//   1. le chemin dépend d'OÙ LA POSE A ÉTÉ LANCÉE. Posé depuis un plan de travail, il meurt
//      au `claude-swt-done` — et un hook qui ne pointe sur rien NE DIT PAS qu'il ne garde
//      plus : `node <fichier absent>` sort en 1 sans rien écrire, et un PreToolUse sorti en
//      1 laisse passer l'appel d'outil. Le garde cesse de mordre, en silence ;
//   2. le chemin part dans git avec le nom d'utilisateur et l'arborescence de la machine.
//      Pas un incident — mais ça n'a rien à faire dans le dépôt d'un client.
//
// LE POINT D'ANCRAGE, ET POURQUOI CE N'EST PAS LA RACINE DU DÉPÔT. Le pack déclare bien ses
// propres hooks en relatif (`.claude/hooks/session-start-app-state.sh`), et la tentation est
// d'en faire autant. Elle est fausse ici : `naissance-representant` porte `scope: poste`
// dans `pack.json` — il vit dans `~/.somtech`, jamais copié dans un dépôt. Un chemin relatif
// au lieu (`../../naissance-representant/…`) ne résoudrait que dans ce dépôt-ci, qui héberge
// les deux par hasard ; dans le dépôt d'un client, il ne pointerait sur rien. Le gabarit du
// lieu tranche déjà, et depuis toujours, dans l'autre sens : il autorise
// `Bash(node $HOME/.somtech/ligne-directe/bin/ligne-directe.js *)`. On suit la même règle —
// l'outil de poste se désigne par son installation de poste.
//
// `$HOME` est développé par le shell qui exécute la commande du hook (mesuré : un hook reçoit
// l'environnement, et `CLAUDE_PROJECT_DIR`/`PWD` y valent le répertoire de démarrage).
const CHEMIN_GARDE_POSTE = '$HOME/.somtech/naissance-representant/hooks/garde-ouverture-ligne.js';

// Le refus servi quand le garde n'est PAS installé sur ce poste. Sans lui, l'absence est
// muette et permissive — exactement le motif « fonction inerte derrière des tests verts ».
// Aucune apostrophe droite dans le texte : la charge voyage entre guillemets simples de shell.
const REFUS_GARDE_ABSENT = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      'le garde d’ouverture est introuvable sur ce poste (~/.somtech/naissance-representant) — ' +
      'installe-le avec `npx @somtech-solutions/pack setup`. Refus par défaut : un garde absent ' +
      'ne vaut jamais un garde permissif.',
  },
});

/**
 * La commande de hook posée dans le `.claude/settings.json` VERSIONNÉ du lieu.
 *
 * Une constante, pas une fonction d'un `repoRoot` : c'est précisément ce dont elle ne doit
 * plus dépendre. Deux naissances lancées de deux endroits écrivent le même octet.
 *
 * `cat >/dev/null` avant le refus : Claude Code écrit la requête sur l'entrée du hook, et
 * sortir sans la lire fermerait le tuyau sous sa plume.
 */
export const COMMANDE_GARDE =
  `G="${CHEMIN_GARDE_POSTE}"; ` +
  'if [ -f "$G" ]; then exec node "$G"; ' +
  `else cat >/dev/null 2>&1; printf '%s\\n' '${REFUS_GARDE_ABSENT}'; fi`;

/** Le chemin du `.claude/settings.json` posé par la commande qui pose le lieu. */
function cheminSettings(repoRoot, nom, role) {
  return join(cheminLieu(repoRoot, nom, role), '.claude', 'settings.json');
}

/** Refuse de naître si le lieu n'a pas déjà été posé, EN ENTIER (les 4 gabarits de `GABARITS`). */
export function verifierLieu(repoRoot, nom, role = 'representant') {
  const chemin = cheminLieu(repoRoot, nom, role);
  const manquants = GABARITS.filter((f) => !existsSync(join(chemin, f)));
  if (manquants.length > 0) throw new LieuAbsent(nom, chemin, manquants, role);
  return chemin;
}

/**
 * Fusionne le garde d'ouverture dans un `settings.json` déjà posé — SANS toucher à ses
 * `permissions`. Idempotent : reposer deux fois ne double pas le hook (comparé par
 * `command`, remplacé s'il y est déjà plutôt que dupliqué).
 */
export function fusionnerGarde(settingsExistant) {
  const hooks = { ...(settingsExistant.hooks || {}) };
  // Reconnu par le FICHIER qu'il appelle, jamais par l'égalité de la commande entière : un
  // garde posé par une version antérieure porte un chemin absolu mort, qu'une comparaison
  // stricte laisserait en place à côté du neuf — deux hooks, dont un qui échoue à chaque
  // appel d'outil. On remplace, on ne juxtapose pas.
  const estLeGarde = (h) => typeof h?.command === 'string' && h.command.includes('garde-ouverture-ligne.js');
  const preToolUseSansNotreHook = (hooks.PreToolUse || []).filter(
    (bloc) => !(bloc.hooks || []).some(estLeGarde)
  );
  hooks.PreToolUse = [...preToolUseSansNotreHook, { hooks: [{ type: 'command', command: COMMANDE_GARDE }] }];
  return { ...settingsExistant, hooks };
}

/**
 * Pose (ou repose — c'est idempotent) le garde dans le `.claude/settings.json` du lieu,
 * SANS jamais écraser ses `permissions` — celles-ci restent la responsabilité du lot qui
 * pose le lieu. Appelé à CHAQUE naissance : c'est ce qui garantit que deux naissances du
 * même client portent, sur ce point, EXACTEMENT le même contenu (vérification « le même
 * représentant à chaque naissance »).
 */
export function poserGarde(repoRoot, nom, role = 'representant') {
  const lieu = verifierLieu(repoRoot, nom, role);
  const chemin = cheminSettings(repoRoot, nom, role);
  const existant = JSON.parse(readFileSync(chemin, 'utf8'));
  const fusionne = fusionnerGarde(existant);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(chemin, `${JSON.stringify(fusionne, null, 2)}\n`);
  return chemin;
}

/** Le contenu actuellement posé — pour la vérification, jamais utilisé pour décider. */
export function gardePose(repoRoot, nom, role = 'representant') {
  const chemin = cheminSettings(repoRoot, nom, role);
  if (!existsSync(chemin)) return null;
  return JSON.parse(readFileSync(chemin, 'utf8'));
}

/**
 * Le nom que l'agent portera dans herdr.
 *
 * herdr impose les minuscules : un nom commence par une lettre minuscule et ne contient que
 * minuscules, chiffres, `-` ou `_` (1 à 32 caractères) ; sinon `invalid_agent_name`. La
 * même contrainte est documentée dans /orchestrer-chantier §1-bis. On abaisse donc la casse
 * du nom du client — et on refuse AVANT de créer quoi que ce soit ce que herdr refuserait
 * après, plutôt que de laisser un pane orphelin derrière un renommage impossible.
 */
export function nomAgentHerdr(brut) {
  const nom = String(brut || '').toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(nom)) {
    throw new Error(
      `« ${brut} » ne peut pas nommer un agent herdr : attendu 1 à 32 caractères, ` +
        'commençant par une lettre minuscule, puis minuscules, chiffres, « - » ou « _ »'
    );
  }
  return nom;
}

/**
 * Lit une réponse de la CLI herdr et dit, d'un seul endroit, si l'appel a ABOUTI.
 *
 * C'EST LE CŒUR DU DÉFAUT DE SORTIE (T-20260809-0023, même motif que T-20260807-0067).
 * `herdr` n'a pas un seul registre d'échec, il en a trois, et deux passaient inaperçus :
 *
 *   1. le processus sort non nul                → l'appelant voyait une exception ;
 *   2. le processus sort ZÉRO avec `{"error":…}` → l'appelant ne regardait rien ;
 *   3. la sortie n'est pas du JSON              → `JSON.parse` jetait un message opaque.
 *
 * Le cas 2 est celui qui rend `0` alors que rien n'a abouti : `await herdr(renommer)` sans
 * lecture du résultat traitait `agent_not_found` comme un succès. On ne peut pas se fier au
 * code de sortie d'un service dont on n'a pas la maîtrise — on lit sa réponse.
 *
 * `resultatAttendu` — TOUTES les commandes herdr ne répondent pas. `tab create`, `agent get`,
 * `agent rename` et `pane close` rendent un `result` ; `pane run`, lui, ne rend RIEN du tout
 * (mesuré contre le vrai service : sortie vide, code 0). Exiger un `result` de celui-là
 * ferait échouer une naissance parfaitement réussie. On le déclare donc à l'appel, plutôt que
 * de deviner — et le refus, lui, reste lu de la même façon pour tout le monde : une réponse
 * porteuse d'`error` est un échec, quel que soit le code de sortie.
 *
 * Retourne `{ ok, reponse, message }`. `reponse` est l'objet lu (ou `null`).
 */
export function lireReponseHerdr(
  stdout,
  { commande = [], erreurProcessus = null, resultatAttendu = true } = {}
) {
  const quoi = ['herdr', ...commande].join(' ');
  const brut = String(stdout ?? '');
  let reponse = null;
  try {
    reponse = JSON.parse(brut);
  } catch {
    reponse = null;
  }

  if (reponse && reponse.error) {
    const e = reponse.error;
    const detail = typeof e === 'string' ? e : e.message || e.code || JSON.stringify(e);
    return { ok: false, reponse, message: `${quoi} a refusé : ${detail}` };
  }
  if (reponse && reponse.result != null) {
    return { ok: true, reponse, message: '' };
  }
  if (erreurProcessus) {
    return { ok: false, reponse, message: `${quoi} a échoué : ${erreurProcessus.message}` };
  }
  if (!resultatAttendu && brut.trim() === '') {
    return { ok: true, reponse: null, message: '' };
  }
  return {
    ok: false,
    reponse,
    message: `${quoi} n’a rendu aucun résultat exploitable : ${brut.slice(0, 300)}`,
  };
}

/**
 * L'agent est-il RÉELLEMENT là ? Vérifie par le fait, jamais par le mot : un `grep '"result"'`
 * accepterait `{"error":…,"result":null}` parce que le mot y est. On exige un `result.agent`.
 */
export function agentDetecte(reponse) {
  return Boolean(reponse && !reponse.error && reponse.result && reponse.result.agent);
}

/**
 * Le répertoire de travail RÉEL de la session née — pas la commande qu'on a composée.
 *
 * `foreground_cwd` d'abord, et c'est délibéré : c'est le répertoire du processus au premier
 * plan, donc celui où `claude` tourne vraiment — et c'est lui qui détermine quel `.mcp.json`
 * et quel `.claude/settings.json` la session a chargés. `cwd` est celui du shell du pane, qui
 * peut rester en arrière (le piège est déjà noté dans /orchestrer-chantier §4b-bis).
 */
export function repertoireDeLaSession(reponse) {
  const agent = reponse?.result?.agent;
  if (!agent) return null;
  return agent.foreground_cwd || agent.cwd || null;
}

/** Le nom effectivement porté par l'agent, comparé sans tenir compte de la casse. */
export function agentPorteLeNom(reponse, nom) {
  const porte = reponse?.result?.agent?.name;
  return typeof porte === 'string' && porte.toLowerCase() === String(nom).toLowerCase();
}

/**
 * Les commandes herdr qui font naître le pane — CONSTRUITES, jamais exécutées ici.
 * `bin/naitre.js` les exécute ; les tests les lisent comme des données.
 *
 * Aucun drapeau `--settings`/`--mcp-config` : `cd <lieu> && claude` suffit, `.mcp.json` et
 * `.claude/settings.json` du lieu sont lus par construction dès lors que c'est LÀ que
 * `claude` démarre (mesuré par E-20260807-0002 sur ce dépôt même).
 *
 * POURQUOI `--cwd` EN PLUS DU `cd`, ET PAS À LA PLACE (T-20260809-0023, défaut le plus grave).
 * Le `cd` seul ne suffit pas : `pane run` écrit une ligne dans le shell d'un pane qui vient de
 * naître, et une ligne écrite avant que le shell soit prêt est perdue en entier — `cd` compris.
 * La session démarrait alors là où herdr avait ouvert le pane, c'est-à-dire n'importe où : née
 * ailleurs que dans son lieu, elle ne charge ni le métier ni le registre du représentant, et
 * ce n'est plus une session représentante mais une session ordinaire. `--cwd` fait naître le
 * pane DANS le lieu par construction, avant que quiconque tape quoi que ce soit ; le `cd`
 * reste, inoffensif et idempotent, comme filet si une version de herdr ignorait le drapeau.
 * Ce que ni l'un ni l'autre ne prouve, c'est le résultat : il se lit après coup, dans le
 * répertoire de travail réel de la session (`repertoireDeLaSession`).
 */
export function commandesNaissance(repoRoot, quiVientAuMonde, { workspace, role = 'representant' } = {}) {
  if (!workspace) {
    throw new Error('--workspace est requis : l’espace de travail herdr où faire naître la session');
  }
  roleDe(role); // un rôle inconnu échoue AVANT qu'un pane soit ouvert
  const lieu = cheminLieu(repoRoot, quiVientAuMonde, role);
  const nom = nomAgentHerdr(quiVientAuMonde);
  return {
    lieu,
    nom,
    role,
    tabCreate: ['tab', 'create', '--workspace', workspace, '--cwd', lieu, '--label', quiVientAuMonde, '--no-focus'],
    paneRun: (paneId) => ['pane', 'run', paneId, `cd ${lieu} && claude`],
    interroger: (paneId) => ['agent', 'get', paneId],
    renommer: (paneId) => ['agent', 'rename', paneId, nom],
    fermer: (paneId) => ['pane', 'close', paneId],
  };
}

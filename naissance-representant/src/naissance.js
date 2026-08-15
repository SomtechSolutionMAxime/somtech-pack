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

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
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
 * L'avis à donner à l'humain quand le nom de l'agent NE SERA PAS celui du lieu.
 *
 * Abaisser la casse est juste — herdr n'accepte rien d'autre. **Le faire en silence est le
 * défaut** (T-20260814-0143) : le lieu s'appelle `Charles-Olivier`, l'agent s'appelle
 * `charles-olivier`, et qui cherche son agent par le nom de son lieu ne le trouve pas.
 * Mesuré sur un poste réel, sur quatre lieux.
 *
 * Le seul endroit qui portait déjà l'écart était un champ de l'objet JSON rendu — douze
 * clés, dont deux qui diffèrent d'une capitale. Un fait que personne ne relit n'est pas dit.
 *
 * ⚠️ ELLE SE TAIT QUAND RIEN N'A ÉTÉ ABAISSÉ, et ce n'est pas une économie de mots : un
 * avis qui tombe à chaque naissance devient du bruit, et un bruit cesse d'être lu — ce qui
 * ramènerait exactement le silence qu'il existe pour rompre.
 *
 * ⚠️ ELLE NE CALCULE RIEN — ELLE COMPARE. Une première version refaisait `toLowerCase()`
 * de son côté, ce qui remettait la règle de casse à un SECOND endroit : deux textes qui
 * portent la même règle divergent au premier changement de l'un des deux. C'est très
 * exactement le défaut que `T-20260814-0101` vient de fermer un cran plus haut — « un seul
 * nom de lieu, une seule règle » — et le refermer ici pour le rouvrir une commande plus
 * loin n'aurait rien fermé. Le nom de l'agent lui est donc DONNÉ par `nomAgentHerdr`, la
 * seule autorité, via ce que `commandesNaissance` a déjà rendu.
 *
 * @param {string} nomDuLieu  le nom tel que le lieu le porte
 * @param {string} nomDeLAgent le nom que l'agent portera — calculé ailleurs, jamais ici
 * @returns {string|null} la phrase à écrire, ou `null` s'il n'y a rien à dire.
 */
export function avisDeCasse(nomDuLieu, nomDeLAgent) {
  const lieu = String(nomDuLieu ?? '');
  const agent = String(nomDeLAgent ?? '');
  if (agent === lieu) return null;
  return (
    `le lieu s'appelle « ${lieu} », l'agent s'appellera « ${agent} » — herdr n'accepte que ` +
    `les minuscules. C'est sous « ${agent} » qu'on l'adresse : « herdr agent prompt ${agent} … ».`
  );
}

/**
 * Ce que git voit du lieu — et ce qu'il n'en voit pas (T-20260814-0139).
 *
 * DEUX ÉTATS, MESURÉS SUR UN POSTE RÉEL, QU'AUCUNE LECTURE NE DISTINGUE :
 *
 *   1. **Aucun commit ne porte le lieu.** Métier, contexte, moyens et droits n'existent que
 *      sur ce disque. Un lieu client entier était dans ce cas — il disparaissait avec la
 *      machine, et rien nulle part ne le disait.
 *   2. **Le lieu est versé, la garde ne l'est pas.** `poserGarde` réinjecte le hook à chaque
 *      naissance sans que personne ne le commit : sur les quatre lieux clients suivis par
 *      git, `HEAD` n'en portait AUCUN. Un `git checkout`, un `git stash`, un clone frais les
 *      désarme — **sans un mot**, puisque le fichier redevient un `settings.json`
 *      parfaitement valide, simplement sans `hooks`.
 *
 * ⚠️ CE QU'ELLE REND FAIT REFUSER LA NAISSANCE — elle ne se contente pas d'avertir.
 *
 * `bin/naitre.js` sort en 1 dès que cette fonction rend une phrase, **avant d'avoir écrit
 * quoi que ce soit**. Arbitrage du dirigeant : la compétence prescrit déjà de verser le lieu
 * après la pose, l'instruction n'était pas suivie (trois lieux clients sur cinq portaient une
 * garde qu'aucun commit ne contenait), et le refus la rend opposable sans rien exiger de neuf.
 *
 * ⚠️ Une rédaction antérieure de ce commentaire disait l'inverse — « elle avertit, elle ne
 * refuse pas » — et elle a survécu au changement de comportement. La revue de fond l'a
 * relevée : c'est la documentation la plus proche du code, donc **la plus susceptible d'être
 * crue**. Un commentaire qui contredit sa fonction est pire qu'un commentaire absent.
 *
 * Ce qu'elle NE fait PAS refuser : la garde que la naissance courante s'apprête à poser.
 * Personne ne peut verser un fichier avant qu'il existe — le refuser rendrait toute première
 * naissance impossible. `bin/naitre.js` la mesure donc une seconde fois, APRÈS la pose, et
 * s'en sert alors comme d'un simple signalement.
 *
 * ⚠️ ELLE SE TAIT HORS D'UN DÉPÔT GIT, et quand git n'est pas là. Reprocher l'absence de
 * commits à un répertoire qui n'a rien à verser serait du bruit — et un bruit cesse d'être
 * lu, ce qui rendrait l'avis inutile là où il compte.
 *
 * @returns {string|null} la phrase à écrire, ou `null` s'il n'y a rien à dire.
 */
export function avisDeVersionnement(repoRoot, nom, role = 'representant') {
  const git = (...args) => {
    try {
      execFileSync('git', ['-C', repoRoot, ...args], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  const gitDit = (...args) => {
    try {
      return execFileSync('git', ['-C', repoRoot, ...args], {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      return null;
    }
  };

  // Hors dépôt, ou git absent : rien à reprocher, et rien à vérifier.
  const racine = gitDit('rev-parse', '--show-toplevel');
  if (!racine) return null;

  const lieu = cheminLieu(repoRoot, nom, role);

  // ⚠️ LE CHEMIN SE CALCULE DEPUIS LA RACINE DU DÉPÔT, JAMAIS DEPUIS `repoRoot`.
  // `git cat-file -e HEAD:<chemin>` résout toujours depuis la racine — `-C` ne déplace pas
  // ce point d'ancrage. Calculer relativement à `repoRoot` déclarait donc « aucun commit »
  // un lieu entièrement versé, dès que la commande était lancée depuis un sous-répertoire.
  // Trouvé en revue de fond, reproduit contre le vrai module.
  // Les deux côtés sont ramenés au chemin RÉEL avant d'être soustraits : git rend toujours
  // une racine résolue, et sur macOS « /tmp » est un lien vers « /private/tmp ». Soustraire
  // l'un de l'autre sans les résoudre produisait un chemin en « ../.. » — et donc un lieu
  // entièrement versé déclaré absent de toute histoire.
  const reel = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return p;
    }
  };
  const lieuReel = reel(lieu);
  const versGit = (f) => relative(reel(racine), join(lieuReel, f)).split(sep).join('/');

  // ⚠️ ON INTERROGE `HEAD`, PAS L'INDEX. `git ls-files` répond sur ce qui est INDEXÉ — un
  // lieu simplement `git add`é lui paraîtrait versé, alors qu'aucun commit ne le porte et
  // qu'il disparaît toujours avec le disque. C'est précisément l'écart que ce contrôle
  // existe pour voir. Un dépôt sans le moindre commit est donc, lui aussi, un dépôt où
  // aucun commit ne porte ce lieu — il n'est pas une exception, il est le cas limite.
  const sansHead = !git('rev-parse', '--verify', 'HEAD');
  const absentsDeTouteHistoire = sansHead
    ? [...GABARITS]
    : GABARITS.filter((f) => !git('cat-file', '-e', `HEAD:${versGit(f)}`));

  if (absentsDeTouteHistoire.length === GABARITS.length) {
    return (
      `aucun commit ne porte « ${lieu} » — ce lieu n'existe que sur ce disque, et il ` +
      `disparaît avec lui. La compétence qui l'a posé demande de le verser ; c'est ce geste :\n` +
      `  git add -f ${lieu} && git commit -m "chore(${role}) : installe le lieu de ${nom}"`
    );
  }

  // ⚠️ UN LIEU PARTIELLEMENT VERSÉ EST LE CAS QUI SE TAISAIT, et c'était le cas MESURÉ.
  // `git diff --quiet HEAD -- <fichier jamais suivi>` sort en 0 : un fichier que git n'a
  // jamais vu n'a rien à comparer. Un lieu dont trois gabarits sont versés et dont le
  // `settings.json` n'a jamais été ajouté échappait donc aux deux branches — la première
  // voyait des fichiers dans HEAD, la seconde ne voyait aucun écart. Le fichier des DROITS
  // était le seul absent, et la commande se taisait. On nomme donc les manquants un à un.
  if (absentsDeTouteHistoire.length > 0) {
    return (
      `ce lieu est versé à moitié : aucun commit ne porte ${absentsDeTouteHistoire.join(', ')} ` +
      `(sous « ${lieu} »). Un lieu repris ailleurs — autre clone, autre poste — naîtra sans ` +
      `eux, et rien ne le signalera. Le geste :\n` +
      absentsDeTouteHistoire.map((f) => `  git add -f ${lieu}/${f}`).join('\n') +
      `\n  git commit -m "chore(${role}) : verse le lieu de ${nom} en entier"`
    );
  }

  const settings = join(lieu, '.claude', 'settings.json');
  if (!git('diff', '--quiet', 'HEAD', '--', settings)) {
    return (
      `la garde d'ouverture posée dans ce lieu n'est dans aucun commit — un changement de ` +
      `branche la retirerait sans un mot, et le fichier resterait valide, simplement sans ` +
      `garde. Le geste :\n` +
      `  git add -f ${settings} && git commit -m "chore(${role}) : verse la garde d ouverture de ${nom}"`
    );
  }

  return null;
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

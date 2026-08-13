// outils.js — lancer un programme du poste, et ne JAMAIS confondre « je n'ai pas pu poser la
// question » avec « la réponse est non ».
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// VÉCU, 2026-08-13 (T-20260813-0054) — le refus qui a menti deux fois
//
// Le dirigeant pose un orchestrateur. Refus : « aucune entrée « ligne-directe-bot » ne répond
// au trousseau de ce poste ». Ses deux jetons étaient là, valides, et servaient onze lignes.
//
// La cause : `execFile('security', …)` cherche `security` dans le `PATH` DU PROCESSUS. Une
// session dont le `PATH` ne porte pas `/usr/bin` ne lance donc jamais l'outil — et le seul
// `catch` du chemin traduisait TOUTE exception en « aucune entrée ne répond ». Mesuré, le
// trousseau restant intact, en n'amputant que le `PATH` :
//
//     PATH complet              → LU
//     PATH=/bin:/usr/local/bin  → ECHEC — cause ENOENT : spawn security ENOENT
//     PATH=                     → ECHEC — cause EACCES : spawn security EACCES
//
// La vraie cause vivait déjà dans `err.cause`, et n'était montrée à personne. Le refus
// possédait ce qui aurait fait gagner deux heures, et le jetait.
//
// C'était la SIXIÈME fois, sur ce dépôt, qu'un correctif ne couvrait qu'une porte sur deux :
// `T-20260811-0087` avait corrigé la porte du COMPTE (`process.env.USER` → `os.userInfo()`),
// précisément pour cesser de dépendre de l'environnement du processus lanceur — et avait
// laissé la porte du `PATH` ouverte, dans la même fonction.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CE QUE CE MODULE IMPOSE, ET POURQUOI IL EST UNIQUE
//
//   1. UN SEUL ENDROIT nomme les programmes. Les outils du système vivent à un emplacement
//      FIXE (`/usr/bin/security`, `/bin/launchctl`) : on les désigne par leur chemin, il n'y
//      a aucune raison de les chercher. Un outil installé par l'utilisateur — `herdr` — n'a
//      pas d'emplacement connu d'avance : on le cherche, mais alors on DIT qu'on ne l'a pas
//      trouvé, ce qui n'est pas la même chose que de conclure à sa place.
//
//   2. UN ÉCHEC DE LANCEMENT EST UNE ERREUR À PART. `OutilIntrouvable` n'est pas une réponse
//      de l'outil : c'est l'aveu qu'on ne lui a rien demandé. Chaque appelant doit alors
//      rendre un refus qui parle du BINAIRE, jamais du trousseau, jamais d'un agent mort,
//      jamais d'un service non chargé.
//
//   3. AUCUN GESTE DESTRUCTEUR n'est proposé ici. Un message d'erreur qui met « écrase ceci »
//      dans la bouche de son lecteur a déjà failli faire perdre au dirigeant le seul jeton
//      qui fonctionnait (`T-20260811-0087`). Ce module ne propose que des gestes qui LISENT.

import { execFile } from 'node:child_process';
import { dirname, delimiter } from 'node:path';
import { promisify } from 'node:util';

// execFile avec un tableau d'arguments : aucun shell n'est impliqué, donc aucun caractère
// spécial d'un argument ne peut être interprété.
const execFileAsync = promisify(execFile);

/**
 * Les programmes que ce dépôt lance, et OÙ ils se trouvent.
 *
 * `origine` n'est pas décoratif : c'est lui qui décide de ce qu'un refus a le droit de dire.
 * Un outil `systeme` introuvable est une anomalie du poste (ou un autre système d'exploitation) ;
 * un outil `pose-par-toi` introuvable est une installation qui manque, et le geste qui répare
 * n'est pas le même.
 */
export const OUTILS = {
  security: {
    nom: 'security',
    chemin: '/usr/bin/security',
    origine: 'systeme',
    quoi: 'le trousseau du poste',
  },
  launchctl: {
    nom: 'launchctl',
    chemin: '/bin/launchctl',
    origine: 'systeme',
    quoi: 'le gestionnaire de services du poste',
  },
  herdr: {
    // Installé par l'utilisateur : son emplacement n'est pas connu d'avance, et lui en
    // inventer un serait pire que de le chercher — on chercherait au mauvais endroit en
    // affirmant savoir. On le résout donc par le `PATH`, et le refus dit exactement ça.
    nom: 'herdr',
    chemin: 'herdr',
    origine: 'pose-par-toi',
    quoi: 'le gestionnaire de sessions',
  },
};

/**
 * Les codes que Node rend quand le programme N'A PAS DÉMARRÉ.
 *
 * La discrimination ne peut pas se faire sur le texte du message : `execFile` compose
 * « Command failed: … » dans les deux cas. Elle se fait sur la FORME de l'erreur —
 *
 *   • programme lancé puis sorti en échec → `err.code` est un NOMBRE (le statut de sortie) ;
 *   • programme jamais lancé             → `err.code` est une CHAÎNE (`ENOENT`, `EACCES`, …)
 *     et `err.syscall` vaut « spawn <programme> ».
 *
 * Le piège est `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` : code en CHAÎNE, alors que le programme
 * a parfaitement tourné (il a trop écrit). Le confondre avec un échec de lancement ferait
 * dire « outil introuvable » d'un outil qui a répondu — le même mensonge, retourné. D'où la
 * liste blanche, et jamais un simple `typeof code === 'string'`.
 */
const CODES_DE_LANCEMENT = new Set([
  'ENOENT', // le fichier n'existe pas à ce chemin / n'est pas dans le PATH
  'EACCES', // il existe mais n'est pas exécutable par ce compte (PATH vide : mesuré)
  'EPERM',
  'ENOTDIR',
  'EISDIR',
  'ELOOP',
  'ENAMETOOLONG',
  'ENOEXEC',
  'E2BIG',
]);

/**
 * Ce lancement a-t-il échoué AVANT que le programme tourne ? Rend son code, ou `null`.
 *
 * Rendre le code plutôt qu'un booléen est délibéré : c'est lui que le refus doit montrer.
 * `ENOENT` (« il n'est pas là ») et `EACCES` (« il est là et je n'ai pas le droit ») envoient
 * chercher à deux endroits différents, et les deux ont été mesurés sur ce défaut.
 */
export function echecDeLancement(err) {
  if (!err || typeof err.code !== 'string') return null;
  if (typeof err.syscall === 'string' && err.syscall.startsWith('spawn')) return err.code;
  return CODES_DE_LANCEMENT.has(err.code) ? err.code : null;
}

/** La première ligne de ce que l'outil a dit — jamais la commande, jamais plus de 200 signes. */
export function motsDeLOutil(err) {
  const brut = String(err?.stderr || '').trim() || String(err?.message || '').trim();
  const ligne = brut.split('\n').find((l) => l.trim()) || '';
  return ligne.trim().slice(0, 200);
}

/**
 * L'outil n'a pas pu être LANCÉ — donc on ne sait RIEN de ce qu'il aurait répondu.
 *
 * Cette erreur existe pour être impossible à confondre avec une réponse. Tout appelant qui la
 * reçoit doit rendre un refus qui parle du programme ; aucun n'a le droit d'en conclure une
 * absence, une mort ou un état.
 */
export class OutilIntrouvable extends Error {
  constructor(outil, code, cause) {
    const systeme = outil.origine === 'systeme';
    super(
      `« ${outil.nom} » n'a pas pu être lancé (${code}) — ${outil.quoi} n'a donc jamais été interrogé.\n` +
        `  Ce n'est PAS une réponse : c'est l'aveu qu'aucune question n'a été posée. Rien de ce qui\n` +
        `  suit n'est connu — ni ce qui existe, ni ce qui manque.\n` +
        (systeme
          ? `  Cherché à son emplacement fixe : ${outil.chemin}. Sur un poste macOS, il y est toujours ;\n` +
            `  s'il n'y est pas, c'est le poste qu'il faut regarder, pas ce qu'on lui demandait.\n` +
            `  Vérifie (cette commande ne modifie rien) :\n` +
            `    ls -l ${outil.chemin}`
          : `  Cherché dans le PATH de ce processus, parce que « ${outil.nom} » est installé par toi et\n` +
            `  que son emplacement n'est pas connu d'avance — lui en inventer un chercherait au mauvais\n` +
            `  endroit en ayant l'air de savoir.\n` +
            `  Vérifie (cette commande ne modifie rien) :\n` +
            `    command -v ${outil.nom}`) +
        `\n  Cause exacte, telle que le système l'a rendue : ${motsDeLOutil(cause)}`
    );
    this.name = 'OutilIntrouvable';
    this.outil = outil.nom;
    this.chemin = outil.chemin;
    this.origine = outil.origine;
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Lance un outil de `OUTILS`, et sépare les deux échecs à la source.
 *
 * L'exécuteur est INJECTABLE — c'est par là, et seulement par là, que le comportement de ce
 * module se prouve : la cloison (`cloison.js`) interdit à toute suite de tests d'approcher le
 * vrai trousseau, et elle existe pour une raison mesurée.
 *
 * @throws {OutilIntrouvable} si le programme n'a pas démarré
 * @throws {Error} l'erreur d'origine, intacte, si le programme a tourné et rendu un échec
 */
export async function lancer(outil, args, { executer = execFileAsync, ...options } = {}) {
  try {
    return await executer(outil.chemin, args, options);
  } catch (err) {
    const code = echecDeLancement(err);
    if (code) throw new OutilIntrouvable(outil, code, err);
    throw err;
  }
}

/**
 * Le `PATH` qu'un service du poste verra — un service ne charge AUCUN profil de shell.
 *
 * C'est la panne classique de ce genre d'installation : tout marche à la main, rien ne marche
 * au démarrage. Elle vivait en double, à l'identique, dans `service.js` et dans le réveil de
 * l'orchestrateur — deux copies d'une liste de chemins qui ne peuvent que diverger.
 *
 * ⚠️ CE `PATH` NE SERT PAS À TROUVER LES OUTILS DU SYSTÈME, et c'est tout le propos du
 * correctif : ceux-là sont désignés par leur chemin dans `OUTILS`. Il sert au seul outil dont
 * l'emplacement n'est pas connu d'avance — `herdr` —, et à ce que le service lancé hérite d'un
 * environnement vivable.
 */
export function cheminsUtiles() {
  const dirNode = dirname(process.execPath);
  const usuels = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  return [dirNode, ...usuels].filter((v, i, t) => t.indexOf(v) === i).join(delimiter);
}

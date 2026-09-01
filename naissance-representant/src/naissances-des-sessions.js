// naissances-des-sessions.js — QUAND CHAQUE AGENT VIVANT EST-IL NÉ. (T-20260825-0013.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA NAISSANCE D'UN AGENT EST LA NAISSANCE DE SA CONVERSATION
//
// Claude Code ouvre un transcript par session : `~/.claude/projects/<projet>/<session>.jsonl`.
// Sa date de création EST la naissance de cet agent-là. Mesuré sur le parc du 2026-08-25 :
// **123 des 124 agents vivants du poste y sont datables.**
//
// C'est ce fait-là que la garde des naissances borne sa population dessus — et pas
// l'horodatage porté par le nom du répertoire de travail, qui date le WORKTREE : une reprise
// (`claude-swt <horodatage>`, le geste que le pack prescrit) ouvre un transcript NEUF dans un
// répertoire d'hier. Voir l'en-tête de `garde-des-naissances.js`.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ON NE DEVINE PAS LE NOM DU RÉPERTOIRE DE PROJET — ON CHERCHE PAR L'IDENTIFIANT
//
// Le chemin de travail est encodé dans le nom du répertoire, et **la règle a changé de version
// de Claude Code**. Mesuré côte à côte sur ce poste le 2026-08-25 :
//
//   `-Users-maximeleboeuf-GitRepo.nosync-constructiongauthier`   ← le point SURVIT
//   `-Users-maximeleboeuf-GitRepo-nosync-actionprogex`           ← le point est REMPLACÉ
//
// Une règle « tout caractère non alphanumérique devient un tiret », appliquée aux 94 agents
// d'une session, en retrouve **90 sur 94**. Le balayage par identifiant en retrouve **94 sur
// 94**. Une règle devinée aurait donc rendu quatre agents « non datables » pour une raison qui
// n'a rien à voir avec eux — c'est le motif « on mesure un objet, on conclut sur un autre ».
//
// Le prix du balayage, mesuré : **77 ms** pour 1193 répertoires et 4899 transcrits, plus 14 ms
// pour les dater tous. On ne date que les sessions demandées.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ET PAS `~/.claude/sessions/<pid>.json`, QUI PORTE POURTANT `sessionId` ET `startedAt`
//
// Ce dépôt lit déjà ce dossier-là (`activite-session.js`), et il aurait été le chemin court.
// Mesuré : `startedAt` est le démarrage du PROCESSUS. **93 des 123 agents vivants le portent à
// la même seconde** — 2026-08-22T15:05 — un redémarrage en masse, pendant que leurs
// conversations ont des jours. Le prendre pour une naissance ferait entrer tout le parc dans la
// population au premier reboot postérieur à la frontière : une garde qui hurle sur le poste
// entier est une garde qu'on désarme dans la semaine.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE MODULE NE FAIT JAMAIS : rendre une date qu'il n'a pas lue.
//
// Une session qu'il ne trouve pas ne reçoit AUCUNE entrée. C'est le consommateur
// (`naissanceDeLAgent`) qui en fait un « non mesuré » — jamais un « né avant ». Les deux
// appellent des gestes opposés, et seul le second est vert.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { identifiantDeSessionDuPane } from './garde-des-naissances.js';

/**
 * Où Claude Code tient les transcrits de ses sessions.
 *
 * ⚠️ PAS DE `process.env` ICI, contrairement à `activite-session.js`. Une racine relogeable par
 * l'environnement serait, dans une garde, un interrupteur qu'on actionne sans diff. Les essais
 * l'injectent par paramètre ; le banc BOUT EN BOUT, lui, déplace `HOME` — ce qui déplace cette
 * racine-ci par la même porte que le monde réel l'emprunte.
 */
export const RACINE_TRANSCRITS = join(homedir(), '.claude', 'projects');

const SUFFIXE = '.jsonl';

/**
 * LES NAISSANCES DES SESSIONS QUI TIENNENT CES PANES.
 *
 * @param {object[]} panes      le parc brut, tel que `herdr pane list` le rend
 * @param {object} options
 * @param {string} options.racine   où chercher — injectable pour les essais
 * @param {function} options.lister la sonde, moitié « quels fichiers » — injectable pour la COUPER
 * @param {function} options.dater  la sonde, moitié « de quand date ce fichier » — idem
 * @returns {{mesure:'lue', instants: Map<string, number>, illisibles: number}
 *          |{mesure:'refusée', raison: string}}
 *
 * ⚠️ LES DEUX MOITIÉS DE LA SONDE SONT INJECTABLES SÉPARÉMENT — même raison qu'ailleurs dans ce
 * dépôt : une sonde qu'on ne peut couper que d'un côté laisse l'autre côté non éprouvé.
 */
export function lireLesNaissances(
  panes = [],
  { racine = RACINE_TRANSCRITS, lister = (d) => readdirSync(d), dater = (f) => statSync(f).birthtimeMs } = {}
) {
  const voulus = new Set();
  for (const p of panes) {
    const id = identifiantDeSessionDuPane(p);
    if (id) voulus.add(id);
  }
  // Rien à chercher n'est pas un refus : c'est une mesure faite, dont le résultat est vide.
  if (!voulus.size) return { mesure: 'lue', instants: new Map(), illisibles: 0 };

  let projets;
  try {
    projets = lister(racine);
  } catch (err) {
    // ⚠️ LA SONDE COUPÉE REND SON PROPRE MOT. Si elle rendait une carte vide, chaque agent se
    // lirait « transcrit absent » d'une source qu'on n'a jamais ouverte.
    return { mesure: 'refusée', raison: `je n’ai pas pu ouvrir ${racine} (${err?.message ?? err})` };
  }

  const instants = new Map();
  let illisibles = 0;
  for (const projet of projets) {
    // Une fois toutes les sessions voulues datées, il n'y a plus rien à chercher.
    if (instants.size === voulus.size) break;
    let fichiers;
    try {
      fichiers = lister(join(racine, projet));
    } catch {
      // Un répertoire de projet fermé est UN répertoire de moins, jamais une réponse — il PEUT
      // porter le transcrit qu'on cherche. On le compte pour que la raison le dise.
      illisibles += 1;
      continue;
    }
    for (const f of fichiers) {
      if (!f.endsWith(SUFFIXE)) continue;
      const session = f.slice(0, -SUFFIXE.length);
      if (!voulus.has(session) || instants.has(session)) continue;
      let quand;
      try {
        quand = dater(join(racine, projet, f));
      } catch {
        illisibles += 1;
        continue;
      }
      // ⚠️ UN `birthtime` DE ZÉRO N'EST PAS LE 1er JANVIER 1970 : c'est un système de fichiers
      // qui ne le tient pas. Mesuré ici : 0 des 4899 transcrits du poste. Le jour où ça change,
      // l'agent devient NON MESURÉ, pas né à l'aube des temps.
      if (Number.isFinite(quand) && quand > 0) instants.set(session, quand);
    }
  }

  return { mesure: 'lue', instants, illisibles };
}

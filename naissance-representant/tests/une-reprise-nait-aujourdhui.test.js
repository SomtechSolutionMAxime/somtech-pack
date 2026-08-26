// une-reprise-nait-aujourdhui.test.js — LA POPULATION SE BORNE SUR LA NAISSANCE DE L'AGENT,
// JAMAIS SUR LE NOM DE SON RÉPERTOIRE. (T-20260825-0013, sous D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LE DÉFAUT QUE CE BANC FERME, ET IL EST STRICTEMENT PIRE QUE CELUI DU PANE
//
// Le module fondait sa population sur l'horodatage porté par le NOM du répertoire de travail,
// au motif que « `claude-swt` l'y inscrit à la naissance, il ne peut pas être oublié — l'agent
// travaille dedans ». C'est vrai à la première naissance, et FAUX sur la REPRISE, qui est le
// geste que le pack prescrit lui-même (`claude-swt <horodatage>`, règle d'or n°11) :
// `scripts/shell/claude-swt.sh` fait « ↻ reprise de la session » quand le répertoire existe
// déjà, et lance un `claude` NEUF dedans. L'agent naît AUJOURD'HUI dans un répertoire d'hier.
//
// Conséquence mesurée : il ne tombait ni dans `population`, ni dans `prises`, ni dans
// `nonMesures` — il sortait en `horsPortee` avec la raison « né avant la mise en service ».
// `fauxRefus` ne pouvait pas le voir. Verdict « rien à signaler », sortie 0.
//
// C'est la même forme que le lot a fermée sur le pane (« reprendre un pane n'est pas naître »),
// laissée ouverte sur la reprise de worktree — et pire : le cas du pane laissait l'agent DANS
// la population, mal identifié ; celui-ci l'en SORTAIT.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE LA GARDE LIT DEPUIS, ET POURQUOI CETTE SOURCE-LÀ
//
// La naissance d'un agent est la naissance de sa CONVERSATION : le transcript que Claude Code
// ouvre sous `~/.claude/projects/<projet>/<session>.jsonl`. Mesuré sur le parc du 2026-08-25 :
// 123 des 124 agents vivants y sont datables.
//
// ⚠️ ET PAS `~/.claude/sessions/<pid>.json`, qui porte pourtant `sessionId` + `startedAt` et que
// ce dépôt lit déjà. Mesuré : `startedAt` est le démarrage du PROCESSUS — 93 des 123 agents
// vivants le portent à la même seconde (2026-08-22T15:05), un redémarrage en masse, pendant que
// leurs conversations ont des jours. Le prendre pour une naissance ferait entrer tout le parc
// dans la population au premier reboot postérieur à la frontière.
//
// ⚠️ QUAND ON NE SAIT PAS DATER, ON LE DIT. Un agent qu'on n'a pas pu dater n'est pas « né
// avant » : il est NON MESURÉ. C'est la distinction que ce module tient déjà partout ailleurs
// (`établi` / `non établi` / `refusée`), et la seule polarité qu'il accepte.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  jugerLeParc,
  normaliserLeParc,
  MISE_EN_SERVICE,
  VERDICTS,
  SORTIES,
} from '../src/garde-des-naissances.js';

const socketDe = (nom) => `/bac/.config/herdr/sessions/${nom}/herdr.sock`;
const SOCKET_S1 = socketDe('s1');

/** Un worktree né BIEN AVANT la mise en service — celui qu'on REPREND. */
const VIEUX_WORKTREE = '/bac/worktrees/un-depot/20260819-005653';

const FRONTIERE = Date.UTC(2026, 7, 25, 4, 0, 0); // 2026-08-25 00:00:00, heure locale du poste

const pane = (sur = {}) => ({
  agent: true,
  agent_session: { agent: 'claude', kind: 'id', source: 'herdr:claude', value: 'sess-de-la-reprise' },
  agent_status: 'working',
  cwd: '/Users/x/GitRepo.nosync/un-depot',
  foreground_cwd: VIEUX_WORKTREE,
  name: null,
  pane_id: 'w1:p1',
  herdr_socket: SOCKET_S1,
  ...sur,
});

const registreQuiAVuSansNommer = (panes) =>
  panes.map((p) => ({ pane_id: p.pane_id, herdr_socket: p.herdr_socket, agent: true, name: null }));

function juger({ panes = [pane()], naissances, declarations = [] } = {}) {
  return jugerLeParc({
    agents: normaliserLeParc({ panes, agentsHerdr: registreQuiAVuSansNommer(panes), naissances }),
    registre: { declarations, illisibles: [] },
    roleDuLieu: () => null,
    portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
    miseEnService: MISE_EN_SERVICE,
  });
}

/** Les naissances telles que le fil les mesure : une carte session → instant. */
const naissancesLues = (couples) => ({ mesure: 'lue', instants: new Map(couples) });

test('🔴 UN AGENT QUI REPREND UN VIEUX WORKTREE EST NÉ AUJOURD’HUI — il est DANS la population', () => {
  const r = juger({
    naissances: naissancesLues([['sess-de-la-reprise', FRONTIERE + 9 * 3600 * 1000]]),
  });

  assert.equal(r.comptes.horsPortee, 0, 'la garde l’a mis hors portée sur le NOM de son répertoire');
  assert.equal(r.comptes.population, 1);
  assert.equal(r.comptes.prises, 1, 'aucune source ne l’identifie : c’est une prise');
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF);
  assert.equal(r.sortie, SORTIES[VERDICTS.NES_HORS_DISPOSITIF]);
  assert.match(r.texte, /w1:p1/, 'la prise n’est pas nommée dans le rendu');
});

test('UN AGENT NÉ AVANT LA FRONTIÈRE RESTE HORS PORTÉE — même dans un répertoire d’aujourd’hui', () => {
  const r = juger({
    panes: [pane({ foreground_cwd: '/bac/worktrees/un-depot/20260825-093000' })],
    naissances: naissancesLues([['sess-de-la-reprise', FRONTIERE - 3600 * 1000]]),
  });

  assert.equal(r.comptes.population, 0, 'le nom du répertoire décide encore');
  assert.equal(r.comptes.horsPortee, 1);
  assert.equal(r.horsPortee[0].raison, 'né avant la mise en service du dispositif');
  assert.equal(r.verdict, VERDICTS.RIEN_A_SIGNALER);
});

test('🔴 UN AGENT QU’ON N’A PAS PU DATER EST « NON MESURÉ », JAMAIS « NÉ AVANT »', () => {
  const r = juger({ naissances: naissancesLues([]) });

  assert.equal(r.comptes.horsPortee, 0, 'un agent non datable a été rangé hors portée EN SILENCE');
  assert.equal(r.comptes.nonMesures, 1);
  assert.equal(r.comptes.prises, 0, 'ne pas savoir dater n’accuse personne');
  assert.equal(r.verdict, VERDICTS.ZONES_NON_MESUREES);
  assert.equal(r.sortie, SORTIES[VERDICTS.ZONES_NON_MESUREES]);
});

test('🔴 UNE SOURCE DES NAISSANCES REFUSÉE NE REND PAS LE PARC VERT — tout devient non mesuré', () => {
  const r = juger({ naissances: { mesure: 'refusée', raison: 'le dossier des transcrits est fermé' } });

  assert.equal(r.comptes.nonMesures, 1);
  assert.equal(r.verdict, VERDICTS.ZONES_NON_MESUREES);
  assert.match(r.texte, /transcrits est fermé/, 'la raison du refus ne remonte pas au lecteur');
});

test('LA NAISSANCE NON DONNÉE VAUT REFUS — le défaut d’un paramètre absent est BRUYANT', () => {
  const r = juger({ naissances: undefined });

  assert.equal(r.comptes.nonMesures, 1, 'l’absence de source s’est lue comme « rien à signaler »');
  assert.equal(r.verdict, VERDICTS.ZONES_NON_MESUREES);
});

/**
 * 🔴 UN PANE DONT LA SESSION N'A PAS D'IDENTIFIANT N'EN REÇOIT PAS UN INVENTÉ.
 *
 * herdr rend des panes dont `agent_session` existe SANS porter de `value` — les harnais de ce
 * dépôt en fabriquaient encore récemment. Si `identifiantDeSessionDuPane` leur donnait une
 * valeur de repli, tous la partageraient : dater UNE session daterait TOUS les agents sans
 * identifiant, avec la naissance de quelqu'un d'autre. Un agent né hier passerait pour né
 * aujourd'hui, ou l'inverse — et l'inverse est vert.
 *
 * ⚠️ TROUVÉ PAR MUTATION, PAS PAR RELECTURE : remplacer `?.value` par `?.value ?? 'x'` laissait
 * la suite entière au vert. Le chemin existait, il passait, il se lisait donc comme couvert.
 */
test('🔴 UN PANE SANS IDENTIFIANT DE SESSION N’EMPRUNTE PAS LA NAISSANCE D’UN AUTRE', () => {
  const sansIdentifiant = pane({
    pane_id: 'w7:p7',
    agent_session: { agent: 'claude' }, // herdr en rend : présent, mais sans `value`
  });
  const r = juger({
    panes: [pane({ pane_id: 'w1:p1' }), sansIdentifiant],
    naissances: naissancesLues([['sess-de-la-reprise', FRONTIERE + 9 * 3600 * 1000]]),
  });

  assert.equal(r.comptes.parcVivant, 2);
  assert.equal(r.comptes.nonMesures, 1, 'un pane sans identifiant a reçu une date qui n’est pas la sienne');
  assert.equal(r.comptes.prises, 1, 'seul l’agent RÉELLEMENT daté devait être jugé');
  assert.match(
    r.texte, /w7:p7/,
    'l’agent qu’on n’a pas su dater n’est pas nommé — un compte ne se corrige pas, on va voir un agent'
  );
  assert.match(r.texte, /aucun identifiant de session Claude/);
});

// UNE LIGNE DONT LE PANE A DISPARU EST SIGNALÉE, JAMAIS FERMÉE D'OFFICE (T-20260826-0068).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE SYMÉTRIQUE DE `T-20260826-0038` — ET LE MÊME MOTIF QU'UN CHANTIER DISPARU, UN ÉTAGE PLUS HAUT
//
// `hygiene.js` détecte déjà une ligne dont le CHANTIER (le worktree) a disparu du disque. Six
// lignes réelles montrent une panne voisine mais distincte : le chantier existe encore, mais le
// PANE qui le portait n'est plus dans sa session — le terminal est mort, pas le dossier.
//
// ⚠️ TROIS ÉTATS, JAMAIS DEUX. « Le pane a disparu » et « la session ne répond pas » sont deux
// faits différents : sur le parc réel mesuré pour ce ticket, zéro session muette sur les six —
// aucune ambiguïté dans ce lot précis, mais la distinction doit tenir dans tous les cas.
//
// ⚠️ ET UN PANE DISPARU N'EST PAS UN AGENT MORT. Il peut être un agent RENAISSANT ailleurs — le
// pane change d'identifiant à la renaissance (mesuré : `w8X:p2` → `w8X:pZ`). Refermer une ligne
// dont l'agent est vivant sous un nouveau pane le couperait du dirigeant. On mesure donc, avant
// de proposer le geste de fermeture, si un AUTRE pane vivant de la même session porte désormais
// le MÊME espace de travail — et si oui, on NOMME ce pane, on NE PROPOSE PAS de fermer.
//
// ⚠️ LA JOINTURE D'ESPACE RÉUTILISE `memeEspaceDeTravail` — LA MÊME QUE `declaration-des-agents.js`,
// PAS UNE SECONDE ÉCRITURE. Elle résout les liens symboliques des deux côtés (`/tmp` contre
// `/private/tmp` sur macOS) : une comparaison de chaînes nues manquerait le successeur sur
// exactement la machine qui a mesuré ce défaut.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, symlinkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { lignesAuPaneDisparu, avisDesPanesDisparus } from '../src/hygiene.js';

const ligne = (sur = {}) => ({
  chantier: 'chantier-x',
  canal_nom: 'chantier-x',
  worktree: '/chantiers/chantier-x',
  pane: 'w8X:p2',
  herdr_socket: '/s/session.sock',
  ...sur,
});

// ── doubles : ce module rend un jugement, il ne va pas interroger herdr lui-même ──

/** `etatDuPane` injecté : rend 'present' | 'disparu', ou lève pour une session muette. */
const etat = (table) => async (pane, socket) => {
  const cle = `${socket ?? ''} ${pane}`;
  if (!(cle in table)) throw new Error(`session « ${socket} » injoignable`);
  return table[cle];
};

/** `panesDeLaSession` injecté : les panes VIVANTS d'une session, tels que herdr les rendrait. */
const panesVus = (parSession) => async (socket) => {
  if (!(socket in parSession)) throw new Error(`session « ${socket} » injoignable`);
  return parSession[socket];
};

// ═════════════════ 1. CE QU'ELLE VOIT — les trois états

test('UN PANE PRÉSENT NE SIGNALE RIEN', async () => {
  const m = await lignesAuPaneDisparu([ligne()], {
    etatDuPane: etat({ '/s/session.sock w8X:p2': 'present' }),
  });
  assert.deepEqual(m, []);
});

test('UN PANE DISPARU, SANS SUCCESSEUR, PROPOSE LE GESTE DE FERMETURE', async () => {
  const m = await lignesAuPaneDisparu([ligne()], {
    etatDuPane: etat({ '/s/session.sock w8X:p2': 'disparu' }),
    panesDeLaSession: panesVus({ '/s/session.sock': [] }),
  });
  assert.equal(m.length, 1);
  assert.equal(m[0].etat, 'disparu');
  assert.equal(m[0].pane, 'w8X:p2');
  assert.equal(m[0].successeur, null);
  assert.match(m[0].geste, /ligne-directe fermer --a chantier-x/);
});

test('UNE SESSION MUETTE EST SIGNALÉE COMME TELLE — jamais confondue avec « disparu »', async () => {
  const m = await lignesAuPaneDisparu([ligne()], {
    etatDuPane: async () => {
      throw new Error('session injoignable');
    },
  });
  assert.equal(m.length, 1);
  assert.equal(m[0].etat, 'muette');
  // ⚠️ ET AUCUN GESTE N'EST PROPOSÉ SUR UNE MUETTE — on n'a rien constaté, on ne conclut rien.
  assert.equal(m[0].geste, null);
});

test('UN ÉTAT QUE `etatDuPane` NE DEVAIT PAS RENDRE N’EST NI SIGNALÉ NI PROJETÉ COMME « DISPARU »', async () => {
  // ⚠️ CE BANC EXISTE PARCE QUE LA MUTATION L'A MONTRÉ VIDE : retirer le garde-fou qui écarte
  // tout état hors de {'present','disparu','muette'} laissait la suite VERTE — les doubles
  // n'exerçaient jamais un contrat rompu. Un prédicat injecté qui rend autre chose que ce que
  // son contrat promet ('present'|'disparu', ou lève) ne doit ni faire signaler une ligne saine,
  // ni la faire traiter comme disparue par accident.
  const m = await lignesAuPaneDisparu([ligne()], {
    etatDuPane: async () => 'zorglub',
  });
  assert.deepEqual(m, [], 'un état hors contrat n’est ni un signalement ni un « disparu » implicite');
});

// ═════════════════ 2. LE PIÈGE DE LA RENAISSANCE — le cœur du ticket

test('🔴 UN PANE DISPARU DONT LE MÊME ESPACE VIT SUR UN AUTRE PANE : SUCCESSEUR NOMMÉ, AUCUN GESTE', async () => {
  const m = await lignesAuPaneDisparu([ligne({ pane: 'w8X:p2' })], {
    etatDuPane: etat({ '/s/session.sock w8X:p2': 'disparu' }),
    panesDeLaSession: panesVus({
      '/s/session.sock': [
        { pane_id: 'w8X:pZ', foreground_cwd: '/chantiers/chantier-x' },
        { pane_id: 'w8X:p9', foreground_cwd: '/chantiers/autre-chose' },
      ],
    }),
  });
  assert.equal(m.length, 1);
  assert.equal(m[0].etat, 'disparu_renaissance_probable');
  assert.equal(m[0].successeur, 'w8X:pZ');
  // 🔴 LE POINT QUI COMPTE LE PLUS : refermer cette ligne couperait un agent vivant.
  assert.equal(m[0].geste, null, 'aucun geste de fermeture proposé quand un successeur est nommé');
});

test('LA JOINTURE D’ESPACE TRAVERSE UN LIEN SYMBOLIQUE — la même fonction que declaration-des-agents.js, pas une réécriture', async () => {
  // Un vrai lien symbolique, sur disque — pas une comparaison de chaînes nues. C'est exactement
  // ce que `memeEspaceDeTravail` existe pour traverser (mesuré sur macOS : `/tmp` → `/private/tmp`).
  const racine = mkdtempSync(join(tmpdir(), 'smtk-hygiene-pane-'));
  try {
    const reel = join(racine, 'reel');
    const lien = join(racine, 'lien');
    mkdirSync(reel);
    symlinkSync(reel, lien);

    const m = await lignesAuPaneDisparu([ligne({ worktree: lien })], {
      etatDuPane: etat({ '/s/session.sock w8X:p2': 'disparu' }),
      panesDeLaSession: panesVus({
        '/s/session.sock': [{ pane_id: 'w8X:pZ', foreground_cwd: reel }],
      }),
    });
    assert.equal(m[0].etat, 'disparu_renaissance_probable', 'le successeur est trouvé malgré le lien symbolique');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('UN AUTRE PANE, MAIS UN AUTRE ESPACE : PAS UN SUCCESSEUR — le geste reste proposé', async () => {
  const m = await lignesAuPaneDisparu([ligne()], {
    etatDuPane: etat({ '/s/session.sock w8X:p2': 'disparu' }),
    panesDeLaSession: panesVus({
      '/s/session.sock': [{ pane_id: 'w8X:pZ', foreground_cwd: '/chantiers/un-tout-autre-chantier' }],
    }),
  });
  assert.equal(m[0].etat, 'disparu');
  assert.equal(m[0].successeur, null);
  assert.match(m[0].geste, /ligne-directe fermer --a/);
});

test('LA MESURE DU SUCCESSEUR QUI ÉCHOUE NE FAIT PAS TOMBER LA MESURE PRINCIPALE — « disparu » sans conclure sur un successeur', async () => {
  const m = await lignesAuPaneDisparu([ligne()], {
    etatDuPane: etat({ '/s/session.sock w8X:p2': 'disparu' }),
    panesDeLaSession: async () => {
      throw new Error('herdr injoignable pour lister les panes');
    },
  });
  assert.equal(m[0].etat, 'disparu', 'on ne remonte pas la panne de la mesure de successeur en muette');
  assert.equal(m[0].successeur, null);
});

// ═════════════════ 3. LES DEUX PORTEURS D'UNE LIGNE PARTAGÉE

test('LES DEUX PORTEURS D’UNE LIGNE PARTAGÉE SONT MESURÉS SÉPARÉMENT, CHACUN DANS SA SESSION', async () => {
  const l = ligne({ pair: { pane: 'w5:p3', herdr_socket: '/s/autre.sock' } });
  const m = await lignesAuPaneDisparu([l], {
    etatDuPane: etat({
      '/s/session.sock w8X:p2': 'present',
      '/s/autre.sock w5:p3': 'disparu',
    }),
    panesDeLaSession: panesVus({ '/s/autre.sock': [] }),
  });
  assert.equal(m.length, 1, 'seul le pair, disparu, est signalé — le propriétaire, présent, ne l’est pas');
  assert.equal(m[0].pane, 'w5:p3');
});

test('🔴 UN SUCCESSEUR NOMMÉ D’UNE AUTRE SESSION N’EST PAS RETENU — un pane n’est unique que dans sa session', async () => {
  // ⚠️ CE BANC EXISTE PARCE QU'UNE PASSE DE FOND A MONTRÉ LE TROU : `panesDeLaSession(socket)`
  // est CENSÉE rendre les panes de LA session demandée — mais rien ne le garantissait si son
  // câblage aval se trompait de session (le même défaut que `panes()`/`agents()` existent pour
  // fermer dans `herdr.js` : « un identifiant de pane n'est unique QUE dans sa session »). Un
  // prédicat bogué qui renvoie un pane de la BONNE forme d'espace mais d'une AUTRE session ne
  // doit jamais être pris pour un successeur — sans quoi une ligne disparue pour de bon resterait
  // ouverte parce qu'un homonyme d'un autre client occupe, par coïncidence, le même chemin.
  const m = await lignesAuPaneDisparu([ligne()], {
    etatDuPane: etat({ '/s/session.sock w8X:p2': 'disparu' }),
    panesDeLaSession: panesVus({
      '/s/session.sock': [
        // Même espace de travail, mais une AUTRE session : ce n'est PAS le même successeur.
        { pane_id: 'w8X:pZ', foreground_cwd: '/chantiers/chantier-x', herdr_socket: '/s/autre-client.sock' },
      ],
    }),
  });
  assert.equal(m[0].etat, 'disparu', 'un pane d’une autre session n’est pas un successeur — le geste reste proposé');
  assert.equal(m[0].successeur, null);
  assert.match(m[0].geste, /ligne-directe fermer --a/);
});

test('UN SUCCESSEUR SANS SESSION PRÉCISÉE RESTE ACCEPTÉ — rétrocompatible avec un `panesDeLaSession` qui n’en porte pas', async () => {
  // Les objets déjà en usage (et les tests existants) ne portent pas toujours `herdr_socket` sur
  // chaque pane rendu par `panesDeLaSession` — ce champ est un ENRICHISSEMENT, pas une exigence.
  // Un successeur sans session précisée n'est donc PAS rejeté d'office : seule une session
  // EXPLICITEMENT différente écarte le candidat.
  const m = await lignesAuPaneDisparu([ligne()], {
    etatDuPane: etat({ '/s/session.sock w8X:p2': 'disparu' }),
    panesDeLaSession: panesVus({
      '/s/session.sock': [{ pane_id: 'w8X:pZ', foreground_cwd: '/chantiers/chantier-x' }],
    }),
  });
  assert.equal(m[0].etat, 'disparu_renaissance_probable');
  assert.equal(m[0].successeur, 'w8X:pZ');
});

test('🔴 DEUX SESSIONS INCONNUES NE SONT PAS LA MÊME SESSION — `null === null` n’est pas une preuve', async () => {
  // ⚠️ CE BANC EXISTE PARCE QU'UNE PASSE DE FOND A MONTRÉ LE TROU LAISSÉ PAR LE CORRECTIF
  // PRÉCÉDENT. `porteursDeLigne` normalise une session inconnue en `null`
  // (`ligne.herdr_socket || null`, `registre.js`) — donc un porteur dont on ne connaît PAS la
  // session porte `socket: null`. La garde de session acceptait alors un candidat dont
  // `herdr_socket` vaut EXPLICITEMENT `null` par la seule égalité `null === null` : deux
  // « je ne sais pas » qui se sont égalés par accident, pas une preuve de même session.
  //
  // ⚠️ SANS RAPPORT AVEC LE CAS RÉTROCOMPATIBLE. Un candidat qui NE PORTE PAS `herdr_socket`
  // du tout (`undefined`) reste accepté — c'est un champ absent, pas une valeur qui prétend
  // dire quelque chose. `null`, lui, est une réponse explicite qui ne doit pas compter comme
  // une correspondance quand l'autre côté est LUI AUSSI incertain.
  const l = ligne({ herdr_socket: null });
  const m = await lignesAuPaneDisparu([l], {
    etatDuPane: async (pane, socket) => {
      assert.equal(socket, null, 'le porteur, sans session connue, interroge bien avec null');
      return 'disparu';
    },
    panesDeLaSession: async (socket) => {
      assert.equal(socket, null);
      return [{ pane_id: 'w1:pZ', foreground_cwd: '/chantiers/chantier-x', herdr_socket: null }];
    },
  });
  assert.equal(m[0].etat, 'disparu', 'deux sessions inconnues ne prouvent rien — le geste reste proposé');
  assert.equal(m[0].successeur, null);
  assert.match(m[0].geste, /ligne-directe fermer --a/);
});

// ═════════════════ 4. L'AVIS — comme `avisDHygiene`, jamais silencieux sur une muette

test('L’AVIS DISTINGUE LES TROIS ÉTATS DANS SON TEXTE', () => {
  const avis = avisDesPanesDisparus([
    { chantier: 'a', canal_nom: 'a', pane: 'w1:p1', worktree: '/x', etat: 'disparu', successeur: null, geste: 'ligne-directe fermer --a a' },
    { chantier: 'b', canal_nom: 'b', pane: 'w2:p2', worktree: '/y', etat: 'disparu_renaissance_probable', successeur: 'w2:pZ', geste: null },
    { chantier: 'c', canal_nom: 'c', pane: 'w3:p3', worktree: '/z', etat: 'muette', successeur: null, geste: null },
  ]);
  assert.match(avis, /« a »/);
  assert.match(avis, /ligne-directe fermer --a a/);
  assert.match(avis, /« b »/);
  assert.match(avis, /w2:pZ/, 'le pane successeur est NOMMÉ, pas seulement signalé');
  assert.match(avis, /« c »/);
  assert.match(avis, /muette|injoignable/i, 'une session muette se dit — elle ne se tait pas');
});

test('QUAND IL N’Y A RIEN À DIRE, L’AVIS SE TAIT', () => {
  assert.equal(avisDesPanesDisparus([]), null);
  assert.equal(avisDesPanesDisparus(null), null);
});

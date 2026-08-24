// LE GESTE `vue` RÉPOND — LA BORNE VIENT DU GESTE, ET LE REFUS DIT CE QU'IL A MESURÉ
// (E-20260824-0001, sous P-20260822-0001 — T-20260824-0001.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE FICHIER EXISTE PARCE QUE `ligne-directe vue` A PENDU 30 s CHEZ LE DIRIGEANT
//
// Le lot précédent l'avait DÉCLARÉ avant de livrer, dans son fichier de garde :
// « `lecteurDeChantier()` sans argument : seul des 6 appelants sans banc de même signature. »
// Il ne l'avait pas caché. Personne ne l'a exercé, et il a mordu au premier usage réel.
//
// ⚠️ ET L'HYPOTHÈSE ÉVIDENTE ÉTAIT FAUSSE. « Le veilleur n'a ni clé ni service » : mesuré,
// il a les deux. Il REÇOIT le geste et REND une réponse complète — chronométré au socket,
// **67 127 ms**, puis 71 797 ms. Il ne bloque rien : `ping` et `etat` répondent en 0 ms
// PENDANT que la vue tourne. C'est cette mesure-là qui tranche entre « le veilleur est
// bloqué » et « un geste est lent » — deux diagnostics opposés que la même plainte servait.
//
// **La cause était une borne de 30 s UNIFORME, appliquée à un geste qui en coûte 67.** Et un
// refus qui attribuait au veilleur un silence qu'il n'avait pas.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE BANC EXERCE, ET POURQUOI IL NE PEUT PAS ÊTRE REMPLACÉ PAR UN APPEL DIRECT
//
// 🔴 **UNE ARÊTE QUI FRANCHIT UN PROCESSUS NE SE MUTE PAS, ELLE S'EXERCE.** `laVueDuParc()`
// appelée en direct répond en **0 ms** — et ne prouve **rien** sur le geste que le dirigeant
// tape. Les bancs voisins appellent `traiterGeste()` en direct : ils sautent le socket ET le
// client, c'est-à-dire les deux seules pièces où la borne se décide.
//
// Ici : **veilleur réel, `createServer` réel, socket UNIX réel, `parler()` réel** — le chemin
// que la commande emprunte, moins UN point nommé (le contenu de la vue, dont le coût est
// mesuré ailleurs et n'appartient pas à ce lot).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

import { Veilleur } from '../src/veilleur.js';
import { parler, borneDuGeste, BORNE_PAR_DEFAUT, BORNES_PAR_GESTE } from '../src/client.js';
import { GESTE_DE_LA_VUE } from '../src/vue-du-parc.js';

let bac;
before(() => {
  bac = mkdtempSync(join(tmpdir(), 'vue-socket-'));
});
after(() => rmSync(bac, { recursive: true, force: true }));

const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Un veilleur RÉEL qui écoute sur un socket RÉEL. Un seul point est substitué, et il est
 * nommé : ce que `vue` rend, et en combien de temps. Tout le reste — `traiterGeste`, le
 * cadre `createServer`, le découpage des lignes — est le code livré.
 */
async function veilleurQuiEcoute(nom, { vue }) {
  const cheminSocket = join(bac, `${nom}.sock`);
  const v = new Veilleur({ cheminSocket, identite: { equipe: 'T' } });
  v.vueDuParc = vue;
  await v.ecouterLocal();
  return { v, cheminSocket, fermer: () => v.arreter().catch(() => {}) };
}

/**
 * Un socket qui accepte la connexion et ne répond JAMAIS — à rien, pas même au ping.
 *
 * ⚠️ ON RETIENT LES CONNEXIONS POUR LES DÉTRUIRE À LA FERMETURE. `srv.close()` attend que les
 * connexions ouvertes se referment : sans ce ménage, le banc ne rendait jamais la main — trois
 * essais ANNULÉS au bout de vingt secondes, alors que le code éprouvé refusait correctement en
 * 304 ms. Un banc qui ne peut pas finir ne mesure rien, et son silence ressemble à une panne
 * du code qu'il éprouve.
 */
async function socketMuet(nom) {
  const cheminSocket = join(bac, `${nom}.sock`);
  const vivantes = new Set();
  const srv = createServer((flux) => {
    // on accepte, on n'écrit rien : le veilleur est là, sa bouche est fermée
    vivantes.add(flux);
    flux.on('close', () => vivantes.delete(flux));
    flux.on('error', () => {});
  });
  await new Promise((r) => srv.listen(cheminSocket, r));
  return {
    cheminSocket,
    fermer: () =>
      new Promise((r) => {
        for (const f of vivantes) f.destroy();
        srv.close(r);
      }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1. LA BORNE VIENT DU GESTE — c'est le défaut exact qui a pendu chez le dirigeant
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le geste « vue » a SA borne, et elle est plus longue que celle des gestes ordinaires', () => {
  // ⚠️ CE N'EST PAS UN CONFORT, C'EST LE DÉFAUT LUI-MÊME. Mesuré sur le poste réel : `etat`
  // et `ping` rendent en 0 ms, `recensement` en 9 s, `vue` en 67 s. Une seule borne pour les
  // quatre ne peut être juste pour aucun d'eux — trop lâche pour trois, trop serrée pour un.
  assert.ok(
    borneDuGeste(GESTE_DE_LA_VUE) > borneDuGeste('etat'),
    'sans borne propre, la vue retombe sur les 30 s qui l’ont fait pendre'
  );
  assert.equal(borneDuGeste('etat'), BORNE_PAR_DEFAUT, 'les gestes ordinaires gardent leur borne');
  assert.ok(
    borneDuGeste(GESTE_DE_LA_VUE) >= 67_000,
    'la borne de la vue doit couvrir son coût MESURÉ (67 127 ms au socket), pas un chiffre rond'
  );
});

test('UN GESTE PLUS LONG QUE LA BORNE ORDINAIRE EST RENDU — par le socket, comme le dirigeant l’obtient', async () => {
  // 🔴 LE BANC QUI MANQUAIT. Un `vue` qui dure plus que la borne ordinaire et moins que la
  // sienne : avec une borne uniforme, la commande refuse ; avec une borne par geste, elle rend.
  const lent = await veilleurQuiEcoute('lent', {
    vue: async () => {
      await dodo(300);
      return { resume: 'le parc', orchestrateurs: [] };
    },
  });
  try {
    const rendu = await parler(
      { geste: GESTE_DE_LA_VUE },
      {
        reveiller: false,
        cheminSocket: lent.cheminSocket,
        borneParDefaut: 100,
        bornesParGeste: { [GESTE_DE_LA_VUE]: 5_000 },
      }
    );
    assert.equal(rendu.resume, 'le parc', 'la vue doit ARRIVER, pas être coupée par la borne d’un autre geste');
  } finally {
    await lent.fermer();
  }
});

test('la borne des AUTRES gestes n’a pas été relevée au passage — une borne haute pour tous ne garde plus rien', async () => {
  // ⚠️ LE PIÈGE ÉVIDENT, ET C'EST LUI QU'ON REFUSE. Relever la borne pour tout le monde
  // ferait attendre deux minutes le jour où un geste pend VRAIMENT : on aurait échangé un
  // faux refus contre une vraie attente, et c'est pire.
  assert.equal(BORNE_PAR_DEFAUT, 30_000, 'la borne ordinaire reste celle qui garde');
  const ordinaires = Object.keys(BORNES_PAR_GESTE);
  assert.deepEqual(ordinaires, [GESTE_DE_LA_VUE], 'un seul geste déroge, et c’est celui dont le coût est mesuré');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2. LE REFUS ÉTABLIT L'ÉTAT DU VEILLEUR — il ne le lui attribue pas
// ═══════════════════════════════════════════════════════════════════════════════════════

test('VEILLEUR VIVANT QUI NE REND PAS CE GESTE : le refus le DIT, il n’accuse pas un silence', async () => {
  // Le message d'avant — « le veilleur n'a pas répondu en 30s » — était FAUX au sens propre :
  // le veilleur répondait, en 0 ms, à tout le reste. Le refus doit MESURER, pas déduire.
  const pendu = await veilleurQuiEcoute('pendu', { vue: () => new Promise(() => {}) });
  try {
    await assert.rejects(
      () =>
        parler(
          { geste: GESTE_DE_LA_VUE },
          {
            reveiller: false,
            cheminSocket: pendu.cheminSocket,
            borneParDefaut: 400,
            bornesParGeste: { [GESTE_DE_LA_VUE]: 400 },
            sonde: { intervalle: 100, borne: 300 },
          }
        ),
      (err) => {
        assert.match(err.message, /vivant/i, 'le refus doit dire que le veilleur RÉPOND — c’est mesuré, pas supposé');
        assert.match(err.message, new RegExp(GESTE_DE_LA_VUE), 'et nommer LE GESTE qui n’a pas rendu');
        return true;
      }
    );
  } finally {
    await pendu.fermer();
  }
});

test('VEILLEUR MUET : le refus le dit AUTREMENT — sinon rien n’est distingué', async () => {
  const muet = await socketMuet('muet');
  try {
    await assert.rejects(
      () =>
        parler(
          { geste: GESTE_DE_LA_VUE },
          {
            reveiller: false,
            cheminSocket: muet.cheminSocket,
            borneParDefaut: 3_000,
            bornesParGeste: { [GESTE_DE_LA_VUE]: 3_000 },
            sonde: { intervalle: 100, borne: 200 },
          }
        ),
      (err) => {
        assert.doesNotMatch(
          err.message,
          /est vivant/i,
          'un veilleur qui ne répond pas au ping ne doit PAS être déclaré vivant'
        );
        assert.match(err.message, /ne répond plus|muet|sans réponse/i, 'le refus doit nommer le silence RÉEL');
        return true;
      }
    );
  } finally {
    await muet.fermer();
  }
});

test('LES DEUX REFUS DIFFÈRENT — un seul message pour deux causes ne distingue rien', async () => {
  // 🔴 LA CONDITION 3 DU BRIEF, ÉPROUVÉE PAR COMPARAISON et non par la présence d'un mot.
  // Un texte peut satisfaire chaque exigence prise à part et rester le même dans les deux cas.
  const vivant = await veilleurQuiEcoute('cmp-vivant', { vue: () => new Promise(() => {}) });
  const muet = await socketMuet('cmp-muet');
  const reglages = {
    reveiller: false,
    borneParDefaut: 600,
    bornesParGeste: { [GESTE_DE_LA_VUE]: 600 },
    sonde: { intervalle: 100, borne: 200 },
  };
  try {
    const m1 = await parler({ geste: GESTE_DE_LA_VUE }, { ...reglages, cheminSocket: vivant.cheminSocket }).then(
      () => null,
      (e) => e.message
    );
    const m2 = await parler({ geste: GESTE_DE_LA_VUE }, { ...reglages, cheminSocket: muet.cheminSocket }).then(
      () => null,
      (e) => e.message
    );
    assert.ok(m1 && m2, 'les deux appels doivent refuser');
    assert.notEqual(m1, m2, 'deux causes opposées ne peuvent pas rendre le même refus');
  } finally {
    await vivant.fermer();
    await muet.fermer();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3. UNE BORNE HAUTE NE DOIT PAS DEVENIR UNE LONGUE ATTENTE
// ═══════════════════════════════════════════════════════════════════════════════════════

test('UN VEILLEUR MUET NE FAIT PAS ATTENDRE LA BORNE HAUTE — on refuse dès qu’il cesse de répondre', async () => {
  // 🔴 L'OBJECTION QUI VAUT LE CORRECTIF. Une borne à 180 s ferait attendre trois minutes le
  // jour où le veilleur meurt. La sonde tranche AVANT : le silence se mesure sur le ping,
  // jamais sur la durée du geste.
  const muet = await socketMuet('rapide');
  try {
    const t0 = Date.now();
    await parler(
      { geste: GESTE_DE_LA_VUE },
      {
        reveiller: false,
        cheminSocket: muet.cheminSocket,
        borneParDefaut: 30_000,
        bornesParGeste: { [GESTE_DE_LA_VUE]: 30_000 },
        sonde: { intervalle: 150, borne: 250 },
      }
    ).catch(() => {});
    const ms = Date.now() - t0;
    assert.ok(ms < 5_000, `le refus doit tomber sur la SONDE (mesuré ${ms} ms), pas au bout de la borne du geste`);
  } finally {
    await muet.fermer();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4. « IL N'A PAS RÉPONDU » ≠ « IL A RÉPONDU QU'IL NE PEUT PAS »
// ═══════════════════════════════════════════════════════════════════════════════════════

test('UN REFUS DU VEILLEUR REMONTE COMME RÉPONSE — jamais comme une absence de réponse', async () => {
  // Le troisième état, et il est le plus facile à confondre avec les deux autres : le veilleur
  // a parlé, et ce qu'il a dit est « je ne peux pas ». Ça n'est pas un silence, et ça ne doit
  // pas emprunter le vocabulaire du silence.
  const refusant = await veilleurQuiEcoute('refus', {
    vue: async () => {
      throw new Error('aucun accès au ServiceDesk ne m’a été donné');
    },
  });
  try {
    const rendu = await parler(
      { geste: GESTE_DE_LA_VUE },
      { reveiller: false, cheminSocket: refusant.cheminSocket, bornesParGeste: { [GESTE_DE_LA_VUE]: 5_000 } }
    );
    assert.equal(rendu.ok, false, 'le veilleur A répondu — sa réponse est un refus, et elle arrive');
    assert.match(rendu.erreur, /ServiceDesk/, 'et elle porte SA cause à lui, pas celle du transport');
  } finally {
    await refusant.fermer();
  }
});

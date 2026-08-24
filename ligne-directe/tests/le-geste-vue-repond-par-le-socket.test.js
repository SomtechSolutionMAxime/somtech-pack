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
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

import { Veilleur } from '../src/veilleur.js';
import { parler, borneDuGeste, BORNE_PAR_DEFAUT, BORNES_PAR_GESTE } from '../src/client.js';
import { GESTE_DE_LA_VUE } from '../src/vue-du-parc.js';

const ICI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

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
// 3 bis. LES DEUX CHEMINS DU REFUS — trouvés SURVIVANTS par la campagne de mutation
//
// 🔴 UNE GARDE JUSTE SUR UN CHEMIN NON COUVERT NE GARDE RIEN. Les bancs ci-dessus passent tous
// par la SONDE : elle détecte le silence avant que la borne du geste ne tombe. Le refus FINAL —
// celui qui s'écrit quand c'est la borne qui gagne — n'était exercé par personne. Mutation
// mesurée : lui faire déclarer `vivant: true` SANS mesurer laissait les 983 essais VERTS.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('BORNE PLUS COURTE QUE LA SONDE : le refus final ÉTABLIT l’état, il ne le suppose pas', async () => {
  // Le chemin où la sonde n'a pas eu le temps de tourner une seule fois. Il existe pour de bon :
  // rien n'oblige un geste à avoir une borne plus longue que l'intervalle de sonde, et c'est
  // précisément là que « le veilleur est vivant » deviendrait une affirmation gratuite.
  const muet = await socketMuet('final');
  try {
    await assert.rejects(
      () =>
        parler(
          { geste: GESTE_DE_LA_VUE },
          {
            reveiller: false,
            cheminSocket: muet.cheminSocket,
            borneParDefaut: 200,
            bornesParGeste: { [GESTE_DE_LA_VUE]: 200 },
            // ⚠️ LA SONDE NE TOURNERA JAMAIS : son intervalle dépasse la borne du geste.
            sonde: { intervalle: 10_000, borne: 200 },
          }
        ),
      (err) => {
        assert.doesNotMatch(err.message, /est vivant/i, 'un veilleur muet ne se déclare pas vivant par défaut');
        assert.match(err.message, /ne répond plus/i, 'le refus final doit MESURER avant de nommer');
        return true;
      }
    );
  } finally {
    await muet.fermer();
  }
});

test('BORNE PLUS COURTE QUE LA SONDE, VEILLEUR VIVANT : le même chemin dit l’autre vérité', async () => {
  // La moitié symétrique. Sans elle, « ne répond plus » écrit en dur passerait aussi.
  const pendu = await veilleurQuiEcoute('final-vivant', { vue: () => new Promise(() => {}) });
  try {
    await assert.rejects(
      () =>
        parler(
          { geste: GESTE_DE_LA_VUE },
          {
            reveiller: false,
            cheminSocket: pendu.cheminSocket,
            borneParDefaut: 200,
            bornesParGeste: { [GESTE_DE_LA_VUE]: 200 },
            sonde: { intervalle: 10_000, borne: 500 },
          }
        ),
      (err) => {
        assert.match(err.message, /EST VIVANT/i, 'il répond au ping — le refus doit le dire');
        return true;
      }
    );
  } finally {
    await pendu.fermer();
  }
});

test('UNE ATTENTE ABANDONNÉE EST VRAIMENT COUPÉE — sinon la commande refuse puis reste debout', async () => {
  // 🔴 SURVIVANTE DE LA CAMPAGNE, ET SON EFFET EST INVISIBLE DEPUIS L'INTÉRIEUR. Neutraliser le
  // signal d'abandon laissait les 983 essais verts : le refus part bien, à la bonne seconde,
  // avec le bon texte. Ce qui reste en vol, c'est la CONNEXION et son minuteur — jusqu'à la
  // borne du geste, soit trois minutes pour la vue.
  //
  // ⚠️ CE N'EST DONC PAS LE MESSAGE QU'ON ÉPROUVE ICI, C'EST L'EFFET EMPÊCHÉ : le processus
  // rend-il la main ? On le mesure de la seule façon qui ne puisse pas mentir — en LANÇANT un
  // processus et en le chronométrant. Il n'appelle pas `process.exit` : s'il reste debout,
  // c'est qu'un handle est encore vivant. C'est ce défaut-là qui a fait pendre ce banc même,
  // vingt secondes par essai, avant qu'on ne coupe l'attente.
  const muet = await socketMuet('vol');
  const script = join(bac, 'attente-coupee.mjs');
  writeFileSync(
    script,
    `import { parler } from ${JSON.stringify(join(ICI_SRC, 'client.js'))};
` +
      `await parler({ geste: ${JSON.stringify(GESTE_DE_LA_VUE)} }, {
` +
      `  reveiller: false, cheminSocket: ${JSON.stringify(muet.cheminSocket)},
` +
      `  borneParDefaut: 120000, bornesParGeste: { ${JSON.stringify(GESTE_DE_LA_VUE)}: 120000 },
` +
      `  sonde: { intervalle: 150, borne: 250 },
` +
      `}).catch(() => {});
`
  );
  try {
    const t0 = Date.now();
    const code = await new Promise((resolve) => {
      const fils = spawn(process.execPath, [script], { stdio: 'ignore' });
      const bourreau = setTimeout(() => {
        fils.kill('SIGKILL');
        resolve('TUÉ');
      }, 15_000);
      fils.on('exit', (c) => {
        clearTimeout(bourreau);
        resolve(c);
      });
    });
    const ms = Date.now() - t0;
    assert.notEqual(code, 'TUÉ', `le processus est resté debout ${ms} ms : l’attente n’a pas été coupée`);
    assert.ok(ms < 10_000, `il doit rendre la main dès le refus (mesuré ${ms} ms), pas au bout de la borne du geste`);
  } finally {
    await muet.fermer();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 ter. LA SONDE NE DOIT RIEN COÛTER AUX GESTES QUI RÉPONDENT VITE
//
// 🔴 RÉGRESSION MESURÉE SUR LE POSTE RÉEL, ET AUCUN BANC NE L'AVAIT VUE. `ligne-directe etat`
// est passé de **62 ms à 3 062 ms** — très exactement l'intervalle de la sonde. La réponse
// arrivait bien en 60 ms ; c'est le MINUTEUR de la sentinelle, encore en vol, qui retenait le
// processus jusqu'à son échéance.
//
// ⚠️ ET LES ONZE BANCS D'AU-DESSUS SONT RESTÉS VERTS. Ils mesurent quand la PROMESSE se
// résout, dans un processus qui vit déjà par ailleurs — jamais quand la COMMANDE rend la main
// au shell. C'est un objet mesuré pour un autre : le seul instrument qui ne peut pas se
// tromper ici est un vrai processus, chronométré de son lancement à sa mort.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Lance la commande dans un VRAI processus et rend le temps qu'il a mis à MOURIR. */
async function tempsDeSortie(nom, cheminSocket, geste, reglages) {
  const script = join(bac, `${nom}.mjs`);
  writeFileSync(
    script,
    `import { parler } from ${JSON.stringify(join(ICI_SRC, 'client.js'))};\n` +
      `await parler({ geste: ${JSON.stringify(geste)} }, {\n` +
      `  reveiller: false, cheminSocket: ${JSON.stringify(cheminSocket)},\n` +
      `  ...${JSON.stringify(reglages)},\n` +
      `}).catch(() => {});\n`
  );
  const t0 = Date.now();
  const sortie = await new Promise((resolve) => {
    const fils = spawn(process.execPath, [script], { stdio: 'ignore' });
    const bourreau = setTimeout(() => {
      fils.kill('SIGKILL');
      resolve('TUÉ');
    }, 20_000);
    fils.on('exit', (c) => {
      clearTimeout(bourreau);
      resolve(c);
    });
  });
  return { ms: Date.now() - t0, sortie };
}

test('UN GESTE QUI RÉPOND VITE REND LA MAIN VITE — la sonde ne retient pas le processus', async () => {
  const prompt = await veilleurQuiEcoute('prompt', { vue: async () => ({ resume: 'le parc' }) });
  try {
    // La sonde est réglée BEAUCOUP plus longue que la réponse : si son minuteur retient le
    // processus, on le verra tout de suite — c'est exactement ce qui est arrivé sur le poste.
    const { ms, sortie } = await tempsDeSortie('vite', prompt.cheminSocket, GESTE_DE_LA_VUE, {
      borneParDefaut: 30_000,
      bornesParGeste: { [GESTE_DE_LA_VUE]: 180_000 },
      sonde: { intervalle: 8_000, borne: 2_000 },
    });
    assert.notEqual(sortie, 'TUÉ', 'la commande doit mourir d’elle-même');
    assert.ok(
      ms < 4_000,
      `la commande doit rendre la main dès la réponse (mesuré ${ms} ms) — un minuteur de sonde en vol la retient`
    );
  } finally {
    await prompt.fermer();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 quater. LA SENTINELLE S'ARRÊTE — trouvée SURVIVANTE trois fois de suite
//
// 🔴 SES TROIS SORTIES DE BOUCLE ÉTAIENT GARDÉES PAR PERSONNE. Neutraliser l'une quelconque
// laissait les 984 essais VERTS — et la sentinelle sondait le veilleur **pour toujours**, toutes
// les trois secondes, longtemps après que sa réponse était arrivée. Dans un processus qui vit
// (un agent qui parle plusieurs fois au veilleur), chaque geste y laisse une sentinelle
// immortelle de plus.
//
// ⚠️ AUCUN MESSAGE NE CHANGE, AUCUNE DURÉE NE BOUGE : la seule chose observable est le TRAFIC
// que la sentinelle continue de produire. C'est donc lui qu'on compte, à la source.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Un veilleur qui COMPTE les pings reçus — la seule trace observable d'une sentinelle en vie. */
async function veilleurQuiCompteLesPings(nom, { vue }) {
  const cheminSocket = join(bac, `${nom}.sock`);
  const v = new Veilleur({ cheminSocket, identite: { equipe: 'T' } });
  const compteur = { pings: 0 };
  const vraiTraiter = v.traiterGeste.bind(v);
  v.traiterGeste = async (requete) => {
    if (requete?.geste === 'ping') compteur.pings += 1;
    return vraiTraiter(requete);
  };
  v.vueDuParc = vue;
  await v.ecouterLocal();
  return { cheminSocket, compteur, fermer: () => v.arreter().catch(() => {}) };
}

test('APRÈS UNE RÉPONSE, LA SENTINELLE S’ARRÊTE — sinon elle sonde le veilleur pour toujours', async () => {
  const compte = await veilleurQuiCompteLesPings('sentinelle-fin', {
    vue: async () => {
      await dodo(150);
      return { resume: 'le parc' };
    },
  });
  try {
    await parler(
      { geste: GESTE_DE_LA_VUE },
      {
        reveiller: false,
        cheminSocket: compte.cheminSocket,
        borneParDefaut: 10_000,
        bornesParGeste: { [GESTE_DE_LA_VUE]: 10_000 },
        sonde: { intervalle: 100, borne: 500 },
      }
    );
    const apresReponse = compte.compteur.pings;
    await dodo(600); // six intervalles de sonde : largement de quoi voir une sentinelle en vie
    assert.equal(
      compte.compteur.pings,
      apresReponse,
      `la sentinelle a continué de sonder après la réponse (${apresReponse} → ${compte.compteur.pings} pings)`
    );
  } finally {
    await compte.fermer();
  }
});

test('APRÈS UN REFUS DE BORNE, LA SENTINELLE S’ARRÊTE AUSSI — l’autre sortie de la boucle', async () => {
  // La sortie sur la borne du geste, distincte de la sortie sur « c'est fini ». Elle a survécu
  // séparément : deux gardes voisines, deux mutations, deux fois zéro rouge.
  const compte = await veilleurQuiCompteLesPings('sentinelle-borne', { vue: () => new Promise(() => {}) });
  try {
    await parler(
      { geste: GESTE_DE_LA_VUE },
      {
        reveiller: false,
        cheminSocket: compte.cheminSocket,
        borneParDefaut: 400,
        bornesParGeste: { [GESTE_DE_LA_VUE]: 400 },
        sonde: { intervalle: 100, borne: 300 },
      }
    ).catch(() => {});
    const apresRefus = compte.compteur.pings;
    await dodo(600);
    assert.equal(
      compte.compteur.pings,
      apresRefus,
      `la sentinelle a continué de sonder après le refus (${apresRefus} → ${compte.compteur.pings} pings)`
    );
  } finally {
    await compte.fermer();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 quinquies. ON NE REQUALIFIE QUE SA PROPRE BORNE — trouvée SURVIVANTE
//
// 🔴 REPEINDRE TOUTE ERREUR EN « LE VEILLEUR NE RÉPOND PLUS » EST LE DÉFAUT QU'ON CORRIGE, PAR
// UN AUTRE CHEMIN. Une réponse illisible, un socket disparu, une connexion refusée : ce sont des
// faits distincts, déjà nommés par qui les a vus. Les rebaptiser envoie chercher la panne à
// côté — exactement ce que « le veilleur n'a pas répondu en 30s » a fait pendant une matinée.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('UNE RÉPONSE ILLISIBLE SE DIT ILLISIBLE — elle ne devient pas un silence du veilleur', async () => {
  const cheminSocket = join(bac, 'charabia.sock');
  const vivantes = new Set();
  const srv = createServer((flux) => {
    vivantes.add(flux);
    flux.on('close', () => vivantes.delete(flux));
    flux.on('error', () => {});
    flux.on('data', () => flux.write('ceci n’est pas du JSON\n'));
  });
  await new Promise((r) => srv.listen(cheminSocket, r));
  try {
    await assert.rejects(
      () =>
        parler(
          { geste: GESTE_DE_LA_VUE },
          { reveiller: false, cheminSocket, bornesParGeste: { [GESTE_DE_LA_VUE]: 3_000 } }
        ),
      (err) => {
        assert.match(err.message, /illisible/i, 'la cause vue doit survivre au passage');
        assert.doesNotMatch(err.message, /ne répond plus|EST VIVANT/i, 'et ne pas être repeinte en silence');
        return true;
      }
    );
  } finally {
    for (const f of vivantes) f.destroy();
    await new Promise((r) => srv.close(r));
  }
});

test('UN SOCKET ABSENT GARDE SON CODE — sans quoi le réveil paresseux ne le reconnaîtrait plus', async () => {
  // ⚠️ CE N'EST PAS QU'UNE QUESTION DE MOT. `parler` décide de FAIRE NAÎTRE le veilleur sur
  // `err.code === 'ENOENT'`. Une erreur requalifiée perd son code : le veilleur ne naîtrait
  // plus jamais tout seul, et la commande refuserait là où elle réparait.
  await assert.rejects(
    () => parler({ geste: GESTE_DE_LA_VUE }, { reveiller: false, cheminSocket: join(bac, 'jamais-ne.sock') }),
    (err) => {
      assert.equal(err.code, 'ENOENT', 'le code doit traverser intact');
      return true;
    }
  );
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

// UN `repare: false` DIT POURQUOI — et un `delivre: false` aussi (T-20260818-0031, critère 3).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI MANQUAIT, ET CE QUE ÇA COÛTAIT
//
// `livrerBrief` rendait `{ ok: true, statut, repare, attendu, delivre }`. Deux de ces champs
// sont des BOOLÉENS À FAUX PAR DÉFAUT, et un booléen à faux ne dit pas s'il l'est parce que
// rien n'était nécessaire, parce qu'on a été empêché, ou parce qu'on a essayé et échoué.
//
// MESURÉ le 2026-08-18 sur un cas réel : `{"ok":true,"statut":"done","repare":false,
// "delivre":false,"attendu":false}`. Trois faux, aucun mot. L'appelant qui lit ça ne peut RIEN
// en faire — et c'est précisément l'appelant qui, ne sachant pas, refait le geste à la main.
//
// ⚠️ ET LA CAUSE ÉTAIT DÉJÀ CALCULÉE. `causeObstacle` la nomme sur quatre branches,
// `delivrerLaBoite` sur neuf. Elle ne sortait que quand `ok` était faux — c'est-à-dire jamais
// dans le cas qui a produit le défaut. « Une porte sur deux », à sa forme la moins chère.
//
// ⚠️ CE FICHIER ÉPROUVE LES DEUX PORTES DE LA MÊME MAIN. `livraison.js` peut très bien rendre
// une cause que `bin/livrer.js` jette au sol : l'appelant lirait alors le même `repare: false`
// muet qu'avant, sur un code « corrigé ». La porte du bin est éprouvée dans `livrer-bin.test.js`,
// contre le vrai exécutable.
//
// ⚠️ ET IL EXIGE PLUSIEURS VERDICTS, PAS LA PRÉSENCE D'UN CHAMP. Une cause qui vaudrait toujours
// la même chose serait une constante déguisée en mesure — le défaut exact relevé sur le
// détecteur de gris de ce même ticket, où une garde ne pouvait rendre qu'un seul verdict et
// rendait le rassurant. L'essai du bas compare donc les causes de quatre chemins DISTINCTS entre
// elles, et rougirait sur un champ posé en dur.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livrerBrief } from '../src/livraison.js';

const SEP = '─'.repeat(40);
const boiteVide = (...avant) => [...avant, SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');
const boiteAvec = (texte, ...avant) => [...avant, SEP, `❯ ${texte}`, SEP, '  ⏵⏵ auto mode on'].join('\n');

/** Le dialogue de permission RÉEL, tel que `herdr agent read` l'a rendu le 2026-08-17. */
const DIALOGUE = [' Blocked by classifier', ' Do you want to proceed?', ' ❯ 1. Yes', '   2. No'];

/** Les réglages communs — l'I/O est injectée, aucun pane réel n'est touché. */
const socle = { pane: 'w9:p1', dormir: async () => {}, essais: 2, delaiMs: 0, pairOccupe: true };

/** Un `agent get` / `agent prompt` qui réussit toujours et se souvient de ce qu'on lui demande. */
const herdrOrdinaire = (appels, { envoiRefuse = false } = {}) => async (commande) => {
  appels.push(commande);
  if (envoiRefuse && commande[1] === 'send-keys') {
    return { ok: false, reponse: {}, message: 'send_keys_refused' };
  }
  return { ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE CAS DU TICKET — celui qui a été mesuré, et qui était muet

test('le cas mesuré : le brief passe du premier coup, `repare` est faux, et il DIT que rien n’était à réparer', async () => {
  // La boîte est vide, la session prend le brief : `repare: false` est ici une BONNE nouvelle.
  // Sans mot, elle est indistinguable de « j'ai essayé de réparer et je n'ai pas pu ».
  const appels = [];
  let ecrit = false;
  const r = await livrerBrief({
    ...socle,
    texte: 'un compte rendu ordinaire',
    appelHerdr: async (c) => {
      appels.push(c);
      if (c[1] === 'prompt') ecrit = true;
      return { ok: true, reponse: { result: { agent: { agent_status: ecrit ? 'working' : 'idle' } } }, message: '' };
    },
    lireEcran: async () => boiteVide(),
    immobiliteMs: 0,
  });

  assert.equal(r.ok, true, 'le brief est bien passé');
  assert.equal(r.repare, false, 'et rien n’a été réparé — c’est le cas du ticket');
  assert.equal(
    r.causeRepare,
    'inutile',
    'un `repare: false` doit dire POURQUOI — ici : la réparation n’était pas nécessaire'
  );
  assert.deepEqual(appels.filter((c) => c[1] === 'send-keys'), [], 'et aucune touche d’envoi n’est partie');
});

test('un `delivre: false` dit lui aussi POURQUOI — ici : aucune délivrance n’a été tentée', async () => {
  const r = await livrerBrief({
    ...socle,
    texte: 'un compte rendu ordinaire',
    appelHerdr: herdrOrdinaire([]),
    lireEcran: async () => boiteVide(),
    immobiliteMs: 0,
  });

  assert.equal(r.delivre, false);
  assert.equal(r.causeDelivre, 'non-tentee', 'la boîte n’était pas encombrée : il n’y avait rien à délivrer');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LES AUTRES CHEMINS — chacun rend une cause QUI LUI EST PROPRE

test('empêché par un dialogue apparu pendant la vérification : la cause le nomme', async () => {
  // Le chemin gardé par T-20260817-0008 : on n'a pas pressé Entrée, et pour une raison précise.
  // Le refus le disait en prose ; le CHAMP, lui, restait muet.
  const appels = [];
  let lectures = 0;
  const r = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    appelHerdr: herdrOrdinaire(appels),
    lireEcran: async () => {
      lectures += 1;
      return lectures === 1 ? boiteVide() : boiteAvec('mon compte rendu', ...DIALOGUE);
    },
    immobiliteMs: 0,
  });

  assert.equal(r.ok, false);
  assert.equal(r.repare, false);
  assert.equal(r.causeRepare, 'dialogue', 'la cause doit nommer le dialogue, pas se taire');
  assert.deepEqual(appels.filter((c) => c[1] === 'send-keys'), [], 'et rien n’a été soumis');
});

test('la touche d’envoi est partie et herdr l’a REFUSÉE : `repare` reste faux, et il le dit', async () => {
  // Le cas le plus trompeur : on a bel et bien agi, et le champ vaut quand même faux. Sans mot,
  // il ne se distingue pas d'un chemin où l'on n'a jamais rien tenté.
  const appels = [];
  let ecrit = false;
  const r = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    appelHerdr: async (c) => {
      appels.push(c);
      if (c[1] === 'prompt') ecrit = true;
      if (c[1] === 'send-keys') return { ok: false, reponse: {}, message: 'send_keys_refused' };
      return { ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' };
    },
    // Le texte reste coincé dans la boîte : la réparation est atteinte, et elle est refusée.
    lireEcran: async () => (ecrit ? boiteAvec('mon compte rendu') : boiteVide()),
    immobiliteMs: 0,
  });

  assert.equal(r.repare, false, 'herdr a refusé la touche d’envoi');
  assert.equal(appels.filter((c) => c[1] === 'send-keys').length, 1, 'elle a pourtant bien été tentée');
  assert.equal(r.causeRepare, 'envoi-refuse', 'et la cause doit distinguer « refusé » de « pas tenté »');
});

test('la réparation a mordu : `repare` est vrai, et la cause le dit aussi — un champ qui ne se tait jamais', async () => {
  const appels = [];
  let ecrit = false;
  let soumis = false;
  const r = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    essais: 3,
    appelHerdr: async (c) => {
      appels.push(c);
      if (c[1] === 'prompt') ecrit = true;
      if (c[1] === 'send-keys') soumis = true;
      return { ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' };
    },
    lireEcran: async () => (!ecrit || soumis ? boiteVide() : boiteAvec('mon compte rendu')),
    immobiliteMs: 0,
  });

  assert.equal(r.repare, true);
  assert.equal(r.causeRepare, 'soumise', 'le champ porte une cause même quand il est vrai');
});

test('refusé AVANT toute écriture : la cause dit qu’on n’a rien écrit, donc rien eu à réparer', async () => {
  // Boîte encombrée, délivrance désarmée : le refus est sec, et `repare: false` y est une
  // évidence — encore faut-il que l'appelant puisse la distinguer d'un échec de réparation.
  const appels = [];
  const r = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    appelHerdr: herdrOrdinaire(appels),
    lireEcran: async () => boiteAvec('le reste d’un autre'),
    immobiliteMs: 0,
  });

  assert.equal(r.ok, false);
  assert.equal(r.repare, false);
  assert.equal(r.causeRepare, 'rien-ecrit', 'on n’a jamais écrit : il n’y avait rien à réparer');
  assert.deepEqual(appels.filter((c) => c[1] === 'prompt'), [], 'et surtout : rien n’a été écrit par-dessus');
});

test('la délivrance a soumis le texte d’un autre : `causeDelivre` laisse sortir la cause DÉJÀ calculée', async () => {
  // `delivrerLaBoite` nomme sa cause sur neuf branches. Aucune ne sortait de `livrerBrief`.
  const appels = [];
  let soumis = false;
  let ecrit = false;
  const r = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    essais: 3,
    appelHerdr: async (c) => {
      appels.push(c);
      if (c[1] === 'send-keys') soumis = true;
      if (c[1] === 'prompt') ecrit = true;
      return { ok: true, reponse: { result: { agent: { agent_status: ecrit ? 'working' : 'idle' } } }, message: '' };
    },
    // La boîte porte le texte d'un autre, immobile ; la touche d'envoi la libère.
    lireEcran: async () => (soumis ? boiteVide() : boiteAvec('le reste d’un autre')),
    immobiliteMs: 6000,
  });

  assert.equal(r.delivre, true, 'la boîte a bien été délivrée');
  assert.equal(r.causeDelivre, 'soumis', 'et la cause de la délivrance remonte telle qu’elle est calculée');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA GARDE CONTRE LA CONSTANTE DÉGUISÉE
//
// Une cause posée en dur — `causeRepare: 'inutile'` écrit une fois pour toutes — ferait passer
// tous les essais du haut sauf un. Celui-ci compare les chemins ENTRE EUX : il exige que quatre
// scénarios distincts rendent quatre causes distinctes, ce qu'aucune valeur fixe ne peut faire.

test('quatre chemins distincts rendent quatre causes DISTINCTES — une cause figée ne passerait pas', async () => {
  const causes = new Set();

  // 1. rien à réparer
  causes.add(
    (
      await livrerBrief({
        ...socle,
        texte: 't',
        appelHerdr: herdrOrdinaire([]),
        lireEcran: async () => boiteVide(),
        immobiliteMs: 0,
      })
    ).causeRepare
  );

  // 2. refusé avant écriture
  causes.add(
    (
      await livrerBrief({
        ...socle,
        texte: 't',
        appelHerdr: herdrOrdinaire([]),
        lireEcran: async () => boiteAvec('le reste d’un autre'),
        immobiliteMs: 0,
      })
    ).causeRepare
  );

  // 3. empêché par un dialogue
  let lectures = 0;
  causes.add(
    (
      await livrerBrief({
        ...socle,
        texte: 't',
        appelHerdr: herdrOrdinaire([]),
        lireEcran: async () => {
          lectures += 1;
          return lectures === 1 ? boiteVide() : boiteAvec('t', ...DIALOGUE);
        },
        immobiliteMs: 0,
      })
    ).causeRepare
  );

  // 4. réparation tentée et acceptée
  let ecrit = false;
  let soumis = false;
  causes.add(
    (
      await livrerBrief({
        ...socle,
        texte: 't',
        essais: 3,
        appelHerdr: async (c) => {
          if (c[1] === 'prompt') ecrit = true;
          if (c[1] === 'send-keys') soumis = true;
          return { ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' };
        },
        lireEcran: async () => (!ecrit || soumis ? boiteVide() : boiteAvec('t')),
        immobiliteMs: 0,
      })
    ).causeRepare
  );

  assert.equal(causes.size, 4, `quatre chemins doivent rendre quatre causes — vu : ${[...causes].join(', ')}`);
  assert.ok(!causes.has(undefined), 'et aucun chemin ne doit rendre une cause absente');
});

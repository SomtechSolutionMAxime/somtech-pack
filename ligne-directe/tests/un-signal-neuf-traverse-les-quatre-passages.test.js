// UN SIGNAL NEUF TRAVERSE LES QUATRE PASSAGES — condition de fin n°5 de E-20260822-0003.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LE TROU QUE CE FICHIER FERME A ÉTÉ MESURÉ, PAS IMAGINÉ
//
// `e-20260822-0002` a muté un signal à chacune des quatre jointures du chemin qui va du lecteur
// de chantier jusqu'à l'œil du dirigeant :
//
//   | passage              | sa garde de famille |
//   |----------------------|---------------------|
//   | ① lecteur → vue      | ✅ ATTRAPÉE          |
//   | ② vue → compte       | ❌ PASSE             |
//   | ③ compte → résumé    | ❌ PASSE             |
//   | ④ résumé → texte     | ❌ PASSE             |
//
// ⚠️ LA NUANCE QUI TRANCHE, ET IL L'A CONSTRUITE LUI-MÊME : lancées contre la suite entière,
// les mutations de ②③④ SONT attrapées. Ces jointures ÉTAIENT donc gardées — mais par des bancs
// NOMMÉS, pour des signaux CONNUS. Il a alors ajouté un signal **NEUF** au lecteur, l'a fait
// traverser ① correctement, et l'a laissé mourir en ②③④ :
//
//   > **895 essais VERTS. Il passait.**
//
// > **Un signal NEUF est gardé au premier passage et À NU sur les trois autres.** Leur garde
// > attrape l'oubli de RECOPIE, jamais l'oubli d'AGRÉGATION ni l'oubli de RENDU.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE N'EST PAS « UN BANC DE PLUS », ET POURQUOI IL NE PEUT PAS ÊTRE UNE CONSIGNE
//
// Le piège était DÉJÀ ÉCRIT dans le brief du lot précédent. Son porteur a CODÉ la parade, et
// personne ne l'a ÉPROUVÉE. **Nommer un danger fait coder une parade, jamais l'éprouver.**
//
// D'où la forme de ce fichier : il ne vérifie AUCUN signal par son nom. Il itère le manifeste,
// et il vérifie que le manifeste couvre ce que le lecteur produit vraiment. Les deux gardes
// s'appuient l'une sur l'autre :
//
//   • un signal DÉCLARÉ traverse les quatre passages — prouvé un par un, en boucle ;
//   • un signal PRODUIT MAIS NON DÉCLARÉ rougit — donc on ne peut pas en ajouter un en silence ;
//   • un signal INVENTÉ À L'ESSAI traverse sans qu'on touche aux jointures — donc la machinerie
//     est GÉNÉRIQUE, pas une liste de cas déguisée en boucle.
//
// Ensemble, ces trois-là rendent le trou impossible à rouvrir sans qu'un essai rougisse.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIGNAUX_DU_LECTEUR,
  CHAMPS_DE_STRUCTURE,
  signauxDe,
  laVueDuParc,
  rendreLaVue,
  lecteurDeChantier,
} from '../src/vue-du-parc.js';

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE HARNAIS — un chantier où UN SEUL signal est chaud, et rien d'autre
// ═══════════════════════════════════════════════════════════════════════════════════════

/** La valeur qui ALLUME un signal, dérivée de sa nature — jamais écrite en dur par signal. */
const valeurChaude = (s) => (s.nature === 'compte' ? 7 : true);

/**
 * Fait tourner la chaîne ENTIÈRE avec un seul signal allumé, et rend les quatre observations.
 *
 * ⚠️ UN SEUL SIGNAL À LA FOIS. Les allumer en groupe ferait passer un signal muet derrière le
 * bruit d'un voisin bavard : un rouge prouverait qu'AU MOINS un est gardé, jamais que tous le
 * sont. C'est le motif « muter en groupe cache une survivante », appliqué à la mesure.
 */
async function chaineAvecUnSeulSignal(signal) {
  const chaud = valeurChaude(signal);
  const epic = {
    code: 'E-20260822-0003',
    titre: 'un epic',
    statut: 'in_execution',
    stories: [{ code: 'T-20260822-0015', titre: 'une story' }],
    // Tous les signaux d'epic au repos, sauf peut-être celui qu'on allume.
    ...Object.fromEntries(signauxDe('epic').map((s) => [s.cle, s.niveau === 'epic' && s.cle === signal.cle ? chaud : s.vide])),
  };
  const chantier = {
    code: 'P-20260822-0001',
    titre: 'un chantier',
    statut: 'in_progress',
    epics: [epic],
    ...Object.fromEntries(
      signauxDe('chantier').map((s) => [s.cle, s.niveau === 'chantier' && s.cle === signal.cle ? chaud : s.vide])
    ),
  };

  const vue = await laVueDuParc({
    recensement: { quand: 'T', borne: { sessionsRefusees: [] }, agents: [] },
    lieux: {
      mesure: 'lue',
      racines: ['/r'],
      racinesRefusees: [],
      entrees: [{ role: 'orchestrateur', mandat: 'p-20260822-0001', chemins: ['/r/.orchestrateur/p-20260822-0001'] }],
    },
    lireChantier: async () => chantier,
  });

  const o = vue.orchestrateurs[0];
  const porteurs = signal.niveau === 'chantier' ? [o.chantier] : (o.epics ?? []);
  return {
    chaud,
    // ① la valeur est-elle arrivée dans l'objet que la vue construit ?
    dansLaVue: porteurs.some((p) => p?.[signal.cle] === chaud),
    // ② le compte l'a-t-il agrégée ?
    dansLeCompte: vue.compte?.[signal.cleDuCompte],
    // ③ le résumé en parle-t-il ?
    resume: vue.resume ?? '',
    // ④ le dirigeant peut-il le lire ?
    texte: rendreLaVue(vue),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ① LA COMPLÉTUDE — on ne peut pas ajouter un signal au lecteur sans le déclarer
// ═══════════════════════════════════════════════════════════════════════════════════════

test('TOUT champ que le lecteur produit hors structure EST déclaré au manifeste', async () => {
  // 🔴 C'EST CETTE GARDE QUI REND LE TROU IRRÉOUVRABLE. Sans elle, la boucle des quatre
  // passages ne couvrirait que les signaux déjà connus — c'est-à-dire exactement la faiblesse
  // qu'on ferme : « gardé pour des signaux CONNUS, à nu pour un signal NEUF ».
  //
  // ⚠️ ON INTERROGE LE VRAI LECTEUR, pas une idée de ce qu'il produit. Un double écrit à la
  // main déclarerait ce qu'on croit, et la garde mesurerait notre croyance.
  const lire = lecteurDeChantier({
    appeler: async (nom) => {
      // ⚠️ `project_id` PORTE LE CODE LISIBLE, pas `code` — c'est ce que dit `CHAMP_DU_CODE`, et
      // c'est la forme que le service rend. Un double qui invente le nom du champ mesure sa
      // propre invention : le lecteur ne trouve alors « aucun chantier » et la garde s'éteint.
      if (nom === 'projects')
        return { projects: [{ id: 'u1', project_id: 'P-20260822-0001', title: 't', status: 'in_progress' }] };
      if (nom === 'epics') return { epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'e', status: 's' }] };
      return { tickets: [{ id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 's', status: 'new' }] };
    },
  });
  const chantier = await lire('P-20260822-0001');

  const declaresChantier = new Set(signauxDe('chantier').map((s) => s.cle));
  const inconnusChantier = Object.keys(chantier).filter(
    (k) => !CHAMPS_DE_STRUCTURE.chantier.includes(k) && !declaresChantier.has(k)
  );
  assert.deepEqual(
    inconnusChantier,
    [],
    'un champ de chantier ni structurel ni déclaré est un signal NEUF laissé à nu sur trois jointures'
  );

  const declaresEpic = new Set(signauxDe('epic').map((s) => s.cle));
  const inconnusEpic = Object.keys(chantier.epics[0]).filter(
    (k) => !CHAMPS_DE_STRUCTURE.epic.includes(k) && !declaresEpic.has(k)
  );
  assert.deepEqual(inconnusEpic, [], 'même règle un étage plus bas — les deux étages, jamais un seul');
});

test('la garde de complétude MORD : un champ non déclaré la fait rougir', async () => {
  // ⚠️ UNE GARDE QU'ON N'A PAS VUE REFUSER NE GARDE RIEN. On lui fait manger le cas qu'elle est
  // censée attraper, ici et maintenant, plutôt que de la croire sur sa forme.
  const chantierAvecSignalNeuf = { code: 'P', titre: 't', statut: 's', epics: [], signalToutNeuf: 4 };
  const declares = new Set(signauxDe('chantier').map((s) => s.cle));
  const inconnus = Object.keys(chantierAvecSignalNeuf).filter(
    (k) => !CHAMPS_DE_STRUCTURE.chantier.includes(k) && !declares.has(k)
  );
  assert.deepEqual(inconnus, ['signalToutNeuf'], 'le champ neuf doit être VU comme non déclaré');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ② LES QUATRE PASSAGES, UN SIGNAL À LA FOIS — la boucle, pas une liste
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le manifeste n’est pas vide — une boucle sur zéro entrée passe toujours', () => {
  // ⚠️ LA VACUITÉ D'UNE BOUCLE EST UN VERT QUI NE TOUCHE RIEN. Vider `SIGNAUX_DU_LECTEUR`
  // rendrait les quatre gardes ci-dessous silencieusement inoffensives.
  assert.ok(SIGNAUX_DU_LECTEUR.length >= 4, `le manifeste porte ${SIGNAUX_DU_LECTEUR.length} signal(aux)`);
  assert.ok(signauxDe('chantier').length >= 1, 'et les DEUX étages sont représentés');
  assert.ok(signauxDe('epic').length >= 1);
});

for (const signal of SIGNAUX_DU_LECTEUR) {
  test(`« ${signal.cle} » (${signal.niveau}) FRANCHIT LES QUATRE PASSAGES — ①vue ②compte ③résumé ④texte`, async () => {
    const r = await chaineAvecUnSeulSignal(signal);

    assert.equal(r.dansLaVue, true, `① lecteur → vue : « ${signal.cle} » n’est pas arrivé dans l’objet de la vue`);
    assert.equal(
      r.dansLeCompte,
      signal.nature === 'compte' ? r.chaud : 1,
      `② vue → compte : « ${signal.cleDuCompte} » n’agrège pas ce signal`
    );
    const morceau = signal.phrase(r.dansLeCompte);
    assert.ok(r.resume.includes(morceau), `③ compte → résumé : le résumé ne dit rien de « ${signal.cle} »`);
    assert.ok(r.texte.includes(morceau), `④ résumé → texte : le dirigeant ne peut pas LIRE « ${signal.cle} »`);
  });

  test(`« ${signal.cle} » SE TAIT quand il n’a rien à dire — un signal permanent n’est plus un signal`, async () => {
    // Le symétrique, et il est indispensable : sans lui, une phrase collée en dur passerait la
    // garde du dessus tout en criant « 0 écarté » à chaque ligne, jusqu'à ce qu'on cesse de lire.
    const vue = await laVueDuParc({
      recensement: { quand: 'T', borne: { sessionsRefusees: [] }, agents: [] },
      lieux: {
        mesure: 'lue',
        racines: ['/r'],
        racinesRefusees: [],
        entrees: [{ role: 'orchestrateur', mandat: 'p-20260822-0001', chemins: ['/r/.o/p'] }],
      },
      lireChantier: async () => ({
        code: 'P-20260822-0001',
        titre: 't',
        statut: 'in_progress',
        epics: [{ code: 'E-1', titre: 'e', stories: [] }],
      }),
    });
    assert.equal(vue.compte[signal.cleDuCompte], 0);
    assert.ok(!vue.resume.includes(signal.phrase(1).slice(0, 20)), 'aucune phrase quand le signal est au repos');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ③ LA PREUVE QUE LA MACHINERIE EST GÉNÉRIQUE — un signal QUI N'EXISTE PAS traverse
// ═══════════════════════════════════════════════════════════════════════════════════════

test('UN SIGNAL INVENTÉ À L’INSTANT franchit les quatre passages SANS qu’on touche aux jointures', async () => {
  // 🔴 C'EST LA GARDE QUI RÉPOND EXACTEMENT AU DÉFAUT MESURÉ. Les deux précédentes prouvent que
  // les signaux d'AUJOURD'HUI traversent ; celle-ci prouve qu'un signal de DEMAIN traversera —
  // c'est-à-dire que ②③④ sont DÉRIVÉES, et non une liste de cas déguisée en boucle.
  //
  // ⚠️ SANS ELLE, LA BOUCLE DU DESSUS RESTERAIT VERTE SUR DES JOINTURES ÉCRITES À LA MAIN,
  // puisque les quatre signaux d'aujourd'hui y sont câblés un par un. C'est précisément l'état
  // dans lequel le lot précédent a laissé le code : gardé pour le connu, à nu pour le neuf.
  const neuf = {
    cle: 'chantiersFantomes',
    niveau: 'chantier',
    nature: 'compte',
    vide: 0,
    cleDuCompte: 'chantiersFantomes',
    phrase: (n) => ` ⚠️ ${n} fantôme(s) — signal inventé par le banc, pour éprouver la chaîne.`,
  };

  SIGNAUX_DU_LECTEUR.push(neuf);
  try {
    const r = await chaineAvecUnSeulSignal(neuf);
    assert.equal(r.dansLaVue, true, '① il faut que le seul fait de le DÉCLARER le fasse recopier');
    assert.equal(r.dansLeCompte, 7, '② et agréger');
    assert.ok(r.resume.includes('fantôme(s)'), '③ et dire');
    assert.ok(r.texte.includes('fantôme(s)'), '④ et LIRE — sans une ligne de code écrite pour lui');
  } finally {
    // ⚠️ ON REPOSE LE MANIFESTE. Un banc qui laisse traîner sa mutation contamine les suivants,
    // et le rouge qu'il provoquerait accuserait le mauvais coupable.
    SIGNAUX_DU_LECTEUR.pop();
  }
  assert.equal(SIGNAUX_DU_LECTEUR.at(-1).cle !== 'chantiersFantomes', true, 'le manifeste est bien reposé');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ④ LES SIGNAUX QUE **CE LOT** AJOUTE — présence, activité, adresse
// ═══════════════════════════════════════════════════════════════════════════════════════

test('CHAQUE fait porté sur la ligne d’un orchestrateur ATTEINT le texte — la famille, pas trois cas', async () => {
  // 🔴 POURQUOI CETTE GARDE TOMBE SUR CE LOT-CI. L'epic ajoute des signaux d'un AUTRE étage —
  // ceux qui viennent du recensement, pas du lecteur de chantier : `presence`, `activite`,
  // `adresse`, `porteur`. Le manifeste ci-dessus ne les couvre pas : ils ne traversent pas
  // `compte` ni `resume`, ils vont directement au rendu. Leur jointure à eux est ①→④.
  //
  // ⚠️ ON NE LES NOMME PAS UN PAR UN. On énumère les clés que la vue POSE réellement sur une
  // ligne, et on exige que chacune laisse une trace lisible. Ajouter un quatrième fait demain
  // sans le rendre fera rougir CE banc, sans que personne ait eu à y penser.
  const vue = await laVueDuParc({
    recensement: {
      quand: 'T',
      borne: { sessionsRefusees: [] },
      agents: [
        {
          pane: 'w8X:p6',
          session: '/x/sessions/somtech/herdr.sock',
          nom: { mesure: 'lu', valeur: 'kamouraska' },
          role: { mesure: 'établi', nom: 'orchestrateur' },
          mandat: 'p-20260822-0001',
          titre: '◐ un titre reconnaissable',
          travailEnVol: { mesure: 'lue', enVol: true },
        },
      ],
    },
    lieux: {
      mesure: 'lue',
      racines: ['/r'],
      racinesRefusees: [],
      entrees: [
        { role: 'orchestrateur', mandat: 'p-20260822-0001', chemins: ['/r/.o/p'] },
        { role: 'orchestrateur', mandat: 'd-20260813-0005', chemins: ['/r/.o/d-20260813-0005'] },
      ],
    },
    lireChantier: async (code) => ({ code, titre: 'un chantier', statut: 'in_progress', epics: [] }),
  });

  const texte = rendreLaVue(vue);
  const vivant = vue.orchestrateurs.find((o) => o.presence.vivant === true);
  const mort = vue.orchestrateurs.find((o) => o.presence.vivant === false);
  assert.ok(vivant && mort, 'le cas éprouve LES DEUX états — une garde sur un seul en laisse un à nu');

  // Les clés que la vue pose sur une ligne, ÉNUMÉRÉES et non listées à la main.
  const faits = Object.keys(vivant).filter((k) => !['chantier', 'epics'].includes(k));
  assert.deepEqual(
    faits.sort(),
    ['activite', 'adresse', 'agent', 'porteur', 'presence'],
    'si cette liste change, c’est qu’un fait a été ajouté ou retiré — et les traces ci-dessous doivent suivre'
  );

  // La trace lisible de chacun, sur l'un ou l'autre des deux états.
  assert.ok(texte.includes('kamouraska'), 'agent — le nom se lit');
  assert.ok(texte.includes('◐ un titre reconnaissable'), 'adresse — le titre de fenêtre se lit');
  assert.ok(texte.includes('@ somtech'), 'adresse — la session se lit avec le pane');
  assert.ok(/activité MESURÉE à l’écran/.test(texte), 'activite — mesurée, avec sa source');
  assert.ok(texte.includes('/r/.o/d-20260813-0005'), 'porteur — le lieu qui porte le chantier sans terminal se lit');
  assert.ok(/aucun terminal vivant/.test(texte), 'presence — l’absence de terminal se lit');
});

test('la ligne d’un orchestrateur ne rend JAMAIS l’état de session brut — « idle » n’est pas un fait', async () => {
  // ⚠️ LA GARDE PORTE SUR LA FAMILLE DES ÉTATS, pas sur le seul `idle` qu'on a vu. `done`,
  // `blocked` et `unknown` sont rendus par la même source et valent aussi peu : mesurer le mot
  // qu'on a croisé et conclure sur la famille est le geste que ce lot passe son temps à fermer.
  for (const statut of ['idle', 'done', 'blocked', 'unknown', 'working']) {
    const vue = await laVueDuParc({
      recensement: {
        quand: 'T',
        borne: { sessionsRefusees: [] },
        agents: [
          {
            pane: 'w1:p1',
            session: 's',
            nom: { mesure: 'lu', valeur: 'un' },
            role: { mesure: 'établi', nom: 'orchestrateur' },
            mandat: 'p-20260822-0001',
            statut,
            travailEnVol: { mesure: 'non mesurée', raison: 'aucun lecteur d’écran', enVol: null },
          },
        ],
      },
      lieux: { mesure: 'lue', racines: ['/r'], racinesRefusees: [], entrees: [] },
      lireChantier: async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [] }),
    });
    const texte = rendreLaVue(vue);
    assert.doesNotMatch(
      texte,
      new RegExp(`\\b${statut}\\b`),
      `« ${statut} » est un mot d’instrument : il ne doit PAS se lire comme un constat d’activité`
    );
    assert.match(texte, /activité NON MESURÉE/, 'ce qui se lit, c’est qu’on n’a pas mesuré');
  }
});

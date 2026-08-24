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
  SIGNAUX_DE_LA_LIGNE,
  COMPTES_DE_STRUCTURE,
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

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑤ QUI GARDE LE MANIFESTE ? — la question de `kamouraska`, et elle a trouvé un trou
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 « Tu as déplacé le point unique d'un cran, tu ne l'as pas supprimé. » — et c'est exact.
// Les quatre gardes du dessus vérifient FIDÈLEMENT ce que le manifeste déclare, et RIEN de ce
// qu'il oublie. Si le manifeste est faux, elles sont justes ET vides.
//
// ⚠️ ET LE MANIFESTE EST ÉCRIT À CÔTÉ DU CODE, PAS DÉRIVÉ DE LUI. On ne le cache pas : rien
// n'empêche `lecteurDeChantier` de produire un champ que ce tableau ignore. Ce qui l'empêche,
// c'est que la divergence soit MESURÉE — contre le VRAI lecteur, DANS LES DEUX SENS, et sur un
// dénominateur qu'on ne peut pas élargir en silence.
//
// 🔴 LE TROU QUE CETTE QUESTION A TROUVÉ, ET IL ÉTAIT RÉEL : la garde de complétude soustrait
// `CHAMPS_DE_STRUCTURE` avant de comparer. **Il suffisait donc d'ajouter `epicsEcartes` à
// `CHAMPS_DE_STRUCTURE.chantier` pour que le signal cesse d'être exigé, sans qu'un seul essai
// ne rougisse.** Le dénominateur d'une garde EST une garde : s'il est libre, elle ne garde rien.

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 OÙ CETTE MONTÉE S'ARRÊTE — LE CRITÈRE, ET IL EST OPPOSABLE AU PROCHAIN LECTEUR
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// On peut monter à l'infini : les passages, puis le manifeste, puis le dénominateur du
// manifeste, puis ce qui garde le dénominateur. À chaque étage la question « qui garde le
// gardien ? » se repose, et **elle ne s'arrête jamais toute seule.**
//
// **LA QUESTION QUI TRANCHE N'EST PAS « EST-CE GARDÉ ? », C'EST : À CET ÉTAGE, LE GESTE DE
// DÉSARMEMENT EST-IL VISIBLE EN REVUE ?**
//
//   • Ajouter un nom à une liste d'exceptions — `CHAMPS_DE_STRUCTURE`, une allowlist, un
//     `skip` : **INVISIBLE.** Le diff ressemble à de l'entretien normal, et personne en revue
//     n'y verrait un problème. → IL FAUT GARDER. C'est pourquoi la garde ci-dessous existe.
//
//   • Changer un dénominateur ÉPINGLÉ — `assert.deepEqual(LISTE, ['a','b','c'])` : **VISIBLE.**
//     Le diff dit « j'ai changé le nombre attendu », et personne ne signe ça sans le justifier.
//     → ON S'ARRÊTE LÀ. Un étage de plus ne protégerait plus rien qu'un relecteur ne voie.
//
// ⚠️ ET C'EST UNE FORME DE DÉFAUT À PART ENTIÈRE, pire que celles qui se cachent : **une garde
// qui porte sa propre liste d'exceptions se désarme par un geste qui a l'air d'une bonne
// pratique.** Les autres formes se dissimulent ; celle-ci se présente comme de la maintenance.
//
// (Critère posé par `kamouraska`, coordonnateur de P-20260822-0001, le 2026-08-22.)

test('le dénominateur de la garde est ÉPINGLÉ — on ne peut pas cacher un signal en le disant structurel', () => {
  // ⚠️ UNE LISTE ÉCRITE EN DUR, ET C'EST VOULU. C'est le seul endroit de ce fichier qui nomme
  // des champs : il FAUT qu'élargir `CHAMPS_DE_STRUCTURE` COÛTE un rouge, sinon la soustraction
  // qui protège les signaux devient une porte de sortie silencieuse.
  // 🔴 CETTE ÉPINGLE A COÛTÉ SON ROUGE, ET C EST EXACTEMENT SON OFFICE (2026-08-24,
  // E-20260824-0005). Deux ajouts, tous deux STRUCTURELS et aucun signal déguisé :
  //   • `application` sur le chantier — le dirigeant veut grouper par app, et l'app se LIT
  //     au ServiceDesk, jamais ne se devine du nom ni du dépôt (D-20260824-0003, point 1) ;
  //   • l'étage `story`, qui n'était pas déclaré du tout — c'est pourquoi rien n'exigeait
  //     que le statut d’une story traverse.
  //
  // ⚠️ ET LA SOUSTRACTION QUE CETTE ÉPINGLE PROTÈGE A ÉTÉ REFERMÉE PAR AILLEURS : figurer
  // ici n’exempte plus de traverser. `recopierLaStructure` DÉRIVE la recopie de ce même
  // manifeste, et la garde de famille descend désormais aux trois étages. Un champ déclaré
  // structurel n’est donc plus un champ soustrait à toute exigence.
  assert.deepEqual(CHAMPS_DE_STRUCTURE.chantier, ['code', 'titre', 'statut', 'application', 'epics']);
  assert.deepEqual(CHAMPS_DE_STRUCTURE.epic, ['code', 'titre', 'statut', 'stories']);
  assert.deepEqual(CHAMPS_DE_STRUCTURE.story, ['code', 'titre', 'statut']);
});

test('structure et signaux sont DISJOINTS — un champ ne peut pas être les deux', () => {
  for (const s of SIGNAUX_DU_LECTEUR) {
    assert.ok(
      !CHAMPS_DE_STRUCTURE[s.niveau]?.includes(s.cle),
      `« ${s.cle} » est déclaré signal ET structurel : la soustraction l’effacerait de sa propre garde`
    );
  }
});

test('AUCUNE entrée du manifeste n’est un FANTÔME — chaque signal déclaré est vraiment produit', async () => {
  // ⚠️ LE SENS INVERSE DE LA COMPLÉTUDE, ET IL MANQUAIT. Un signal déclaré que le lecteur ne
  // produit plus reste éternellement à `vide` : sa garde des quatre passages passe — elle
  // l'allume elle-même dans son double — le compte rend 0, le résumé se tait, et personne
  // n'apprend que le fait a CESSÉ d'être mesuré. C'est la prose qui contredit la donnée, montée
  // d'un étage : le manifeste affirme un signal que le code ne rend plus.
  const lire = lecteurDeChantier({
    appeler: async (nom) => {
      if (nom === 'projects')
        return { projects: [{ id: 'u1', project_id: 'P-20260822-0001', title: 't', status: 'in_progress' }] };
      if (nom === 'epics') return { epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'e', status: 's' }] };
      return { tickets: [{ id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 's', status: 'new' }] };
    },
  });
  const chantier = await lire('P-20260822-0001');

  for (const s of signauxDe('chantier')) {
    assert.ok(s.cle in chantier, `« ${s.cle} » est déclaré, mais le lecteur ne le produit PLUS`);
  }
  for (const s of signauxDe('epic')) {
    assert.ok(s.cle in chantier.epics[0], `« ${s.cle} » est déclaré à l’étage epic, mais le lecteur ne le produit PLUS`);
  }
});

test('AUCUN CHAMP DE STRUCTURE n’est un FANTÔME non plus — le jumeau qui manquait, aux TROIS étages', async () => {
  // 🔴 CE BANC EXISTE PARCE QUE LA MUTATION A TROUVÉ CE QUE MA PREMIÈRE FERMETURE N’ATTRAPAIT
  // PAS (2026-08-24, E-20260824-0005). Deux familles de survivante, pas une :
  //
  //   ① LA VUE JETTE ce que le lecteur produit → fermée par la garde de famille, qui descend
  //     désormais aux trois étages (`la-vue-du-parc-est-vraiment-cablee`).
  //   ② LE LECTEUR CESSE DE PRODUIRE ce que le manifeste déclare → **restait libre**. Mesuré :
  //     retirer `statut` de l'epic dans le lecteur faisait 0 rouge sur 972 essais, AVANT comme
  //     APRÈS la fermeture de ①. La garde de famille compare les clés du lecteur à celles de
  //     la vue : un champ que le lecteur ne produit plus n'est perdu par personne.
  //
  // ⚠️ C'EST LE JUMEAU EXACT du banc au-dessus, qui existait pour les SIGNAUX et pas pour la
  // STRUCTURE. Le motif « une porte sur deux », dans le fichier qui le dénonce.
  const lire = lecteurDeChantier({
    appeler: async (nom) => {
      if (nom === 'projects')
        return { projects: [{ id: 'u1', project_id: 'P-20260822-0001', title: 't', status: 'in_progress', application_id: 'a1' }] };
      if (nom === 'epics') return { epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'e', status: 's' }] };
      if (nom === 'applications') return { applications: [{ id: 'a1', name: 'Somtech Pack' }] };
      return { tickets: [{ id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 's', status: 'new' }] };
    },
  });
  const chantier = await lire('P-20260822-0001');

  const etages = [
    { nom: 'chantier', objet: chantier },
    { nom: 'epic', objet: chantier.epics[0] },
    { nom: 'story', objet: chantier.epics[0].stories[0] },
  ];
  for (const e of etages) {
    assert.ok(e.objet, `l’étage « ${e.nom} » doit EXISTER, sinon cette garde ne mesure rien`);
    for (const champ of CHAMPS_DE_STRUCTURE[e.nom]) {
      assert.ok(
        champ in e.objet,
        `« ${champ} » est déclaré structurel à l’étage « ${e.nom} », mais le lecteur ne le produit PLUS — ` +
          'un champ déclaré que rien ne produit se rend éternellement `null`, et personne n’apprend que le fait a CESSÉ d’être mesuré'
      );
    }
  }
});

test('CHAQUE entrée du manifeste porte tout ce que les quatre passages lui demandent', () => {
  // Une entrée incomplète casse une jointure à l'exécution — `phrase` absente JETTE au moment
  // du résumé — ou pire, la traverse en silence : `cleDuCompte` absente écrit `compte[undefined]`,
  // que rien ne lit et que rien ne signale.
  for (const s of SIGNAUX_DU_LECTEUR) {
    assert.ok(['chantier', 'epic'].includes(s.niveau), `« ${s.cle} » : niveau inconnu`);
    assert.ok(['compte', 'drapeau'].includes(s.nature), `« ${s.cle} » : nature inconnue`);
    assert.ok(typeof s.cleDuCompte === 'string' && s.cleDuCompte, `« ${s.cle} » : sans nom dans le compte`);
    assert.equal(typeof s.phrase, 'function', `« ${s.cle} » : sans phrase, le résumé jetterait`);
    assert.ok(s.phrase(3).includes('3'), `« ${s.cle} » : sa phrase ne porte pas son nombre`);
    assert.equal(s.vide, s.nature === 'compte' ? 0 : false, `« ${s.cle} » : sa valeur de repos ne suit pas sa nature`);
  }
});

test('DEUX signaux ne partagent jamais leur nom dans le compte — l’un écraserait l’autre en silence', () => {
  const noms = SIGNAUX_DU_LECTEUR.map((s) => s.cleDuCompte);
  assert.equal(new Set(noms).size, noms.length, 'un doublon ferait disparaître un signal dans le compte');
  const cles = SIGNAUX_DU_LECTEUR.map((s) => `${s.niveau}:${s.cle}`);
  assert.equal(new Set(cles).size, cles.length);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑥ LES SIGNAUX DE NIVEAU **LIGNE** — le trou que le premier manifeste laissait ouvert
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 LA CONDITION N°5 DEVAIT FERMER LA CLASSE, ET ELLE NE LA FERMAIT QUE POUR LE LECTEUR.
// `SIGNAUX_DU_LECTEUR` dérive les quatre passages des signaux qui viennent du lecteur de
// chantier. Les faits de LIGNE — présence, activité, adresse — viennent du recensement, et leur
// chemin vers le résumé restait ÉCRIT À LA MAIN.
//
// **Ce que ça a coûté, mesuré par une passe de fond sur ce lot même :** `presencesNonEtablies`
// était CALCULÉ dans le compte et JAMAIS poussé au résumé ni au texte. Le bon signal existait ;
// il mourait au passage ③ — **la forme n°2, dans le module écrit pour l'empêcher.** Ces formes
// ne se neutralisent pas en les connaissant.
//
// **Et le silence produisait pire que le silence :** faute de ce signal, le résumé comptait
// `vivant !== true` sous l'étiquette « n'ont AUCUN terminal vivant » — il fondait `false`
// (mesuré) et `null` (non établi), et **affirmait une mort qu'on n'avait pas constatée**. La
// condition de fin n°4, violée dans la phrase que le dirigeant lit EN PREMIER.

test('le manifeste de LIGNE n’est pas vide — une boucle sur zéro entrée passe toujours', () => {
  assert.ok(SIGNAUX_DE_LA_LIGNE.length >= 2, `le manifeste de ligne porte ${SIGNAUX_DE_LA_LIGNE.length} signal(aux)`);
});

test('🔴 TOUT chiffre du compte est DÉCLARÉ — c’est cette garde qui interdit de calculer un signal sans le rendre', async () => {
  // 🔴 LA GARDE QUI FERME LA CLASSE, ET PAS LE CAS. Sans elle, on peut recalculer demain un
  // `presencesNonEtablies` bis, le mettre au compte, et ne jamais le rendre — exactement ce qui
  // vient d'arriver. Avec elle, un chiffre au compte doit être soit STRUCTUREL (liste épinglée),
  // soit déclaré à l'un des deux manifestes — et déclaré, il traverse ③ et ④ par construction.
  const vue = await laVueDuParc({
    recensement: { quand: 'T', borne: { sessionsRefusees: [] }, agents: [] },
    lieux: {
      mesure: 'lue',
      racines: ['/r'],
      racinesRefusees: [],
      entrees: [{ role: 'orchestrateur', mandat: 'p-20260822-0001', chemins: ['/r/.o/p'] }],
    },
    lireChantier: async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [] }),
  });

  const declares = new Set([
    ...COMPTES_DE_STRUCTURE,
    ...SIGNAUX_DU_LECTEUR.map((s) => s.cleDuCompte),
    ...SIGNAUX_DE_LA_LIGNE.map((s) => s.cleDuCompte),
  ]);
  const inconnus = Object.keys(vue.compte).filter((k) => !declares.has(k));
  assert.deepEqual(
    inconnus,
    [],
    'un chiffre au compte qui n’est ni structurel ni déclaré est un signal qui n’atteindra jamais le résumé'
  );
});

test('le dénominateur du compte est ÉPINGLÉ — on ne peut pas taire un signal en le disant structurel', () => {
  // ⚠️ MÊME RAISON QU'AU PREMIER MANIFESTE : la garde ci-dessus SOUSTRAIT cette liste avant de
  // comparer. Si elle est libre, il suffit d'y ajouter un nom pour qu'un signal cesse d'être
  // exigé — un geste qui ressemble à de l'entretien. Épinglée, l'élargir coûte un rouge.
  assert.deepEqual(COMPTES_DE_STRUCTURE, [
    'orchestrateurs',
    'horsHierarchie',
    'epicsLus',
    'chantiersNonMesures',
    'chantiersNonEtablis',
    'panesAmbigus',
    'entreesComparees',
  ]);
});

for (const signal of SIGNAUX_DE_LA_LIGNE) {
  test(`« ${signal.cle} » (ligne) ATTEINT le résumé ET le texte quand il a servi`, async () => {
    // La borne du recensement décide de l'état : muette ⇒ `null`, complète ⇒ `false`.
    const muette = signal.cle === 'presencesNonEtablies';
    const vue = await laVueDuParc({
      recensement: {
        quand: 'T',
        agents: [],
        borne: {
          sessionsInterrogees: 14,
          sessionsRefusees: muette ? [{ session: '/x/sessions/cg/herdr.sock', raison: 'server_not_running' }] : [],
        },
      },
      lieux: {
        mesure: 'lue',
        racines: ['/r'],
        racinesRefusees: [],
        entrees: [{ role: 'orchestrateur', mandat: 'p-20260601-0094', chemins: ['/r/.o/p'] }],
      },
      lireChantier: async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [] }),
    });

    assert.equal(vue.compte[signal.cleDuCompte], 1, `② le compte n’agrège pas « ${signal.cle} »`);
    const morceau = signal.phrase(1);
    assert.ok(vue.resume.includes(morceau), `③ le résumé ne dit rien de « ${signal.cle} »`);
    assert.ok(rendreLaVue(vue).includes(morceau), `④ le dirigeant ne peut pas LIRE « ${signal.cle} »`);
  });

  test(`« ${signal.cle} » SE TAIT quand il n’a rien à dire`, async () => {
    const vue = await laVueDuParc({
      recensement: { quand: 'T', borne: { sessionsRefusees: [] }, agents: [] },
      lieux: { mesure: 'lue', racines: ['/r'], racinesRefusees: [], entrees: [] },
      lireChantier: async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [] }),
    });
    assert.equal(vue.compte[signal.cleDuCompte], 0);
    assert.ok(!vue.resume.includes(signal.phrase(1)), 'aucune phrase quand le signal est au repos');
  });
}

test('🔴 UNE PRÉSENCE NON ÉTABLIE N’EST JAMAIS COMPTÉE COMME UNE MORT — les deux prédicats sont DISJOINTS', async () => {
  // 🔴 LE DÉFAUT EXACT, GARDÉ À SA FRONTIÈRE. `!== true` avalait `null` ; `=== false` ne l'avale
  // pas. Et on éprouve LES DEUX SENS : un état ne doit allumer qu'UN signal, jamais deux.
  const cas = async (refusees) =>
    (
      await laVueDuParc({
        recensement: { quand: 'T', agents: [], borne: { sessionsInterrogees: 14, sessionsRefusees: refusees } },
        lieux: {
          mesure: 'lue',
          racines: ['/r'],
          racinesRefusees: [],
          entrees: [{ role: 'orchestrateur', mandat: 'p-20260601-0094', chemins: ['/r/.o/p'] }],
        },
        lireChantier: async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [] }),
      })
    );

  const nonEtablie = await cas([{ session: '/x/sessions/cg/herdr.sock', raison: 'server_not_running' }]);
  assert.equal(nonEtablie.orchestrateurs[0].presence.vivant, null, 'le cas éprouvé est bien celui du poste');
  assert.equal(nonEtablie.compte.chantiersSansTerminal, 0, 'une présence NON ÉTABLIE ne se compte PAS comme une mort');
  assert.equal(nonEtablie.compte.presencesNonEtablies, 1);
  assert.doesNotMatch(
    nonEtablie.resume,
    /n’ont AUCUN terminal vivant/,
    'le résumé ne doit JAMAIS affirmer une mort qu’on n’a pas constatée — condition de fin n°4'
  );

  const morte = await cas([]);
  assert.equal(morte.orchestrateurs[0].presence.vivant, false);
  assert.equal(morte.compte.chantiersSansTerminal, 1, 'et le symétrique : une mort MESURÉE se dit');
  assert.equal(morte.compte.presencesNonEtablies, 0, 'sans se compter aussi comme non établie');
});

test('le résumé ne se CONTREDIT jamais avec la ligne de détail qu’il surplombe', async () => {
  // ⚠️ C'EST L'ASSERTION QUI AURAIT ATTRAPÉ LE DÉFAUT LA PREMIÈRE. La même sortie portait, à
  // trois lignes d'écart, « n'ont AUCUN terminal vivant » (résumé) et « ceci n'est PAS son
  // terminal est mort » (détail). Aucun banc ne lisait les deux ENSEMBLE.
  const vue = await laVueDuParc({
    recensement: {
      quand: 'T',
      agents: [],
      borne: { sessionsInterrogees: 14, sessionsRefusees: [{ session: '/x/sessions/cg/herdr.sock', raison: 'r' }] },
    },
    lieux: {
      mesure: 'lue',
      racines: ['/r'],
      racinesRefusees: [],
      entrees: [{ role: 'orchestrateur', mandat: 'p-20260601-0094', chemins: ['/r/.o/p'] }],
    },
    lireChantier: async (code) => ({ code, titre: 't', statut: 'in_progress', epics: [] }),
  });

  const texte = rendreLaVue(vue);
  assert.match(texte, /Ceci n’est PAS « son terminal est mort »/, 'la ligne de détail dit le doute');
  assert.doesNotMatch(texte, /n’ont AUCUN terminal vivant/, 'et le résumé ne l’affirme pas à trois lignes de là');
});

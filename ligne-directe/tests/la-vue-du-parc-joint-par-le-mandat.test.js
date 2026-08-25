// LA VUE DU PARC JOINT PAR LE CODE DU MANDAT — ET, DEPUIS RA-VUE-005 AMENDÉE, AUSSI PAR LE NOM
// DÉCLARÉ, QUI NE SE REND JAMAIS COMME UN NOM PROUVÉ
// (E-20260822-0002 puis E-20260825-0001, sous P-20260822-0001 / D-20260824-0003.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE BANC A CHANGÉ D'OFFICE LE 2026-08-25, ET C'EST ÉCRIT ICI POUR QUE PERSONNE NE RECOPIE
// SA VERSION PÉRIMÉE
//
// Il gardait : « le module ne LIT `assigned_agent` NULLE PART ». **Cette règle n'existe plus.**
// Le BRD v0.11.0 amende RA-VUE-005 : `assigned_agent` est une source ADMISE, dite **DÉCLARÉE**,
// à côté du mandat lu au lieu, dit **PROUVÉ**.
//
// POURQUOI L'INTERDIT EST TOMBÉ — mesuré, pas argumenté : 105 agents vivants, **13 seulement**
// avec un mandat prouvable par le lieu, 76 anonymes ; les chefs d'équipe qui portent réellement
// les tickets n'ont pas de lieu durable (T-20260822-0018). La jointure par le seul mandat
// rendait donc un écran de `NON ÉTABLI` sur un parc où **71 tickets sur 200** portaient un nom.
// Vrai, conforme, et inutile à qui demande qui travaille sur quoi — le dirigeant l'a contesté.
//
// ⚠️ CE QUI NE TOMBE PAS, ET QUE CE BANC GARDE MAINTENANT (RA-VUE-006) :
//
//   ① un nom DÉCLARÉ ne se rend JAMAIS comme un nom PROUVÉ — le mot qui décide est en tête ;
//   ② quand les deux sources se contredisent, **les deux se rendent** et l'écart est nommé.
//      Garder le prouvé et taire le déclaré serait un ARBITRAGE, et la vue n'arbitre rien ;
//   ③ le lecteur LIT vraiment le champ — une source admise qui cesserait d'être lue
//      redeviendrait un écran de `NON ÉTABLI` sans qu'un seul essai ne rougisse.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LES FIXTURES SONT DES LIEUX POSÉS POUR DE VRAI, ET CE N'EST PAS DU ZÈLE
//
// Le lot précédent a payé ce motif au prix fort : **un double non conforme ne rate pas seulement
// un défaut, il en FABRIQUE dans les gardes qui s'appuient dessus.** Un banc qui écrirait à la
// main `{ role: { mesure: 'établi', nom: 'orchestrateur' }, mandat: 'P-…' }` éprouverait sa
// propre idée de ce que rend le recensement, pas ce que le recensement rend. On passe donc par
// `unRecensement` avec de VRAIS lieux sur disque, comme le fait le banc du socle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { unRecensement } from '../src/recensement.js';
import { roleDuLieu } from '../src/lieu-agent.js';
import { role as roleDe } from '../src/roles.js';
import {
  laVueDuParc,
  lecteurDeChantier,
  rendreLaVue,
  rendreAttribution,
  PHRASE_DE_LINDICE,
  MOT_NON_ETABLI,
} from '../src/vue-du-parc.js';
import { unPaneDAgent } from './aide/formes-reelles.js';

const racine = () => mkdtempSync(join(tmpdir(), 'vue-du-parc-'));

const METIER = {
  orchestrateur: "# Tu es l'orchestrateur de ce chantier\n\nle métier du jour.\n",
  representant: '# Tu es le représentant de ce client\n\nle métier du jour.\n',
};
const CONTEXTE = {
  orchestrateur: '# Ce qui est propre à ce dépôt\n\nrien.\n',
  representant: "# Ce qu'on sait de ce client\n\nrien.\n",
};

/** Un lieu POSÉ POUR DE VRAI — dossier, quatre fichiers, vrais en-têtes. Voir l'en-tête. */
function poserLieu(depot, nomDuRole, nom) {
  const lieu = join(depot, roleDe(nomDuRole).dossier, nom);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), METIER[nomDuRole]);
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE[nomDuRole]);
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

/** Les noms tels que `herdr.agents()` les rend — la clé porte la SESSION, toujours. */
function nomsLus(entrees) {
  return {
    mesure: 'lue',
    noms: new Map(entrees.map(([pane, nom, session]) => [`${session ?? ''}\u0000${pane}`, nom])),
  };
}

/** Le recensement d'un poste de banc, construit par le VRAI module. */
function recenser(panes, noms) {
  return unRecensement({ panes, roleDuLieu, nomsConnus: nomsLus(noms) });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1ᵉʳ G/W/T — UN MANDAT QUI EST UN CODE : SON TRAVAIL LUI EST RATTACHÉ ET DIT « PROUVÉ » ;
//             UN `assigned_agent` QUI DÉSIGNE QUELQU'UN D'AUTRE EST RENDU COMME **ÉCART**
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le mandat lu au lieu fait foi et se dit PROUVÉ — et un nom déclaré qui le contredit se rend comme ÉCART, jamais tu', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieuOrch = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');
  const lieuChef = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'e-20260822-0002');

  const rendu = await recenser(
    [
      unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieuOrch }),
      unPaneDAgent({ pane_id: 'w1:p2', foreground_cwd: lieuChef }),
    ],
    [
      ['w1:p1', 'kamouraska', undefined],
      ['w1:p2', 'e-20260822-0002', undefined],
    ]
  );

  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => {
      assert.equal(code, 'P-20260822-0001', 'la vue interroge le ServiceDesk par le CODE DU MANDAT');
      return {
        code,
        titre: 'Voir qui travaille sur quoi',
        epics: [
          {
            code: 'E-20260822-0002',
            titre: 'La vue du parc',
            // 🔴 LE PIÈGE, ET IL A CHANGÉ DE SENS. Le registre DÉSIGNE quelqu'un d'autre que
            // le porteur mesuré. Avant l'amendement, la garde exigeait que « bernache »
            // n'apparaisse NULLE PART ; elle exige maintenant l'inverse — qu'il apparaisse,
            // **et jamais sans le mot ÉCART**. Taire une contradiction est l'arbitrage que
            // RA-VUE-006 interdit.
            //
            // ⚠️ ET LE CHAMP EST NOMMÉ `nomDeclare`, PAS `assigned_agent` : c'est le nom que
            // `lecteurDeChantier` produit. Ce double portait `assigned_agent` — la forme du
            // SERVICE, pas celle du LECTEUR — et il est resté VERT après l'amendement pour
            // cette seule raison : la vue lisait un champ que ce double ne posait pas. Un
            // double non conforme ne rate pas un défaut, il en fabrique.
            nomDeclare: 'bernache',
            stories: [],
          },
        ],
      };
    },
  });

  const ligne = vue.orchestrateurs[0].epics[0];
  assert.equal(ligne.agent.mesure, 'lue', 'le porteur est MESURÉ, par son mandat lu à son lieu');
  assert.deepEqual(
    ligne.agent.agents.map((a) => a.nom),
    ['e-20260822-0002'],
    'le RATTACHEMENT reste celui du mandat — le nom déclaré ne le remplace pas'
  );
  assert.deepEqual(
    ligne.agent.ecart?.declares?.map((d) => d.nom),
    ['bernache'],
    'et la contradiction est PORTÉE par la donnée, pas jetée en silence'
  );

  // Et jusque dans le texte que lit le dirigeant : les DEUX y sont, et l'écart est nommé.
  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('PROUVÉ : e-20260822-0002'), 'le porteur mesuré est nommé, avec le mot qui décide EN TÊTE');
  assert.ok(texte.includes('bernache'), 'le nom déclaré n’est PAS tu — le taire serait arbitrer');

  // 🔴 ET IL N'APPARAÎT SUR AUCUNE LIGNE QUI NE PORTE PAS `ÉCART`. C'est la garde qui compte :
  // « bernache est quelque part » ne dit rien ; « bernache n'est nulle part sans sa marque »
  // est ce qui empêche un nom déclaré de se lire comme un nom mesuré.
  for (const l of texte.split('\n')) {
    if (!l.includes('bernache')) continue;
    assert.ok(l.includes('ÉCART'), `« bernache » se rend sans le mot ÉCART sur : ${l}`);
  }
});

test('LE LECTEUR LIT VRAIMENT `assigned_agent` — une source admise qui cesse d’être lue redevient un écran de NON ÉTABLI', async () => {
  // 🔴 CE BANC REMPLACE CELUI QUI INTERDISAIT LA LECTURE (RA-VUE-005 amendée, BRD v0.11.0).
  // Il garde l'exigence INVERSE, et elle est plus dure : un module peut cesser de lire un champ
  // sans qu'aucun essai de comportement ne rougisse, parce que « pas de nom » se rend
  // exactement comme « pas de nom déclaré ». C'est le trou par lequel l'écran du 25 août est
  // arrivé chez le dirigeant — et il se rouvrirait à l'identique.
  //
  // ⚠️ LE DOUBLE PORTE LA FORME DU **SERVICE**, pas celle du lecteur : `assigned_agent` sur le
  // ticket, et la clé ABSENTE de l'epic — c'est ce qui a été MESURÉ contre le service réel le
  // 2026-08-25. Un double qui poserait `assigned_agent` sur l'epic éprouverait un service qui
  // n'existe pas, et ferait passer pour gardé un chemin que rien n'emprunte.
  const lire = lecteurDeChantier({
    appeler: async (nom) => {
      if (nom === 'projects')
        return { projects: [{ id: 'u1', project_id: 'P-20260822-0001', title: 't', status: 'in_progress' }] };
      if (nom === 'epics') return { epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'e', status: 's' }] };
      if (nom === 'applications') return { applications: [] };
      return {
        tickets: [
          { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 's', status: 'new', assigned_agent: 'e-20260825-0001' },
        ],
      };
    },
  });
  const chantier = await lire('P-20260822-0001');
  assert.equal(
    chantier.epics[0].stories[0].nomDeclare,
    'e-20260825-0001',
    'le lecteur doit faire descendre le nom déclaré du ticket — sans lui, la source est muette'
  );
  assert.equal(
    chantier.epics[0].nomDeclare,
    null,
    'et l’epic, dont le service ne rend PAS la clé, vaut `null` — pas `undefined`, qui se perdrait au JSON'
  );
});

test('AUCUN APPEL HTTP AJOUTÉ pour lire la source déclarée — elle voyage dans la charge déjà reçue', async () => {
  // 🔴 CONDITION DE FIN N°4 DE E-20260825-0001, ÉPROUVÉE PLUTÔT QU'AFFIRMÉE. Le repli naturel
  // — aller chercher `assigned_agent` par un `get` par ticket — coûterait UN appel PAR STORY,
  // soit des centaines sur ce poste, sur une jointure déjà mesurée à ~70 s.
  //
  // ⚠️ ON COMPTE LES APPELS, PAS LES OCTETS : c'est l'unité qui coûte, et c'est celle que la
  // condition de fin nomme.
  const appels = [];
  const lire = lecteurDeChantier({
    appeler: async (nom, args) => {
      appels.push(`${nom}:${args?.action}`);
      if (nom === 'projects')
        return { projects: [{ id: 'u1', project_id: 'P-20260822-0001', title: 't', status: 'in_progress' }] };
      if (nom === 'epics') return { epics: [{ id: 'e1', project_id: 'u1', epic_id: 'E-1', title: 'e', status: 's' }] };
      if (nom === 'applications') return { applications: [] };
      return {
        tickets: [
          { id: 't1', epic_id: 'e1', ticket_id: 'T-1', title: 's', status: 'new', assigned_agent: 'e-20260825-0001' },
          { id: 't2', epic_id: 'e1', ticket_id: 'T-2', title: 's', status: 'new', assigned_agent: 'e-20260824-0011' },
        ],
      };
    },
  });
  const chantier = await lire('P-20260822-0001');
  assert.deepEqual(
    chantier.epics[0].stories.map((s) => s.nomDeclare),
    ['e-20260825-0001', 'e-20260824-0011'],
    'les deux noms déclarés sont bien lus'
  );
  assert.deepEqual(
    appels,
    ['projects:list', 'epics:list', 'tickets:list'],
    'trois appels de liste, et RIEN de plus — aucun `get` par ticket ne s’est glissé pour lire le champ'
  );
});

test('AUCUN FRAGMENT D’ATTRIBUTION NE SE REND SANS SON MOT QUI DÉCIDE — les trois sources, la garde sur la FORME', () => {
  // 🔴 C'EST LA GARDE QUI REMPLACE L'INTERDIT DE LECTURE, ET ELLE PORTE SUR LE SEUL ENDROIT
  // OÙ LE DÉFAUT SE PRODUIT : le dirigeant lit une LIGNE. Un nom déclaré rendu nu se relit
  // comme un nom mesuré en trois lectures — c'est la leçon déjà payée par `PHRASE_DE_LINDICE`,
  // et elle vaut à l'identique pour la source déclarée.
  //
  // ⚠️ ELLE ÉNUMÈRE LES TROIS ÉTATS, pas un : une garde posée sur un cas ne couvre pas sa
  // famille. Chaque fragment doit COMMENCER par le mot de sa source.
  const cas = [
    {
      quoi: 'prouvé',
      attribution: { mesure: 'lue', agents: [{ nom: 'kamouraska', pane: 'w1:p1' }] },
      commencePar: 'PROUVÉ',
    },
    {
      quoi: 'déclaré',
      attribution: { mesure: 'déclarée', source: 'peu importe', declares: [{ nom: 'bernache', dOu: 'ce ticket' }], indices: [] },
      commencePar: 'DÉCLARÉ',
    },
    {
      quoi: 'non établi',
      attribution: { mesure: 'non établi', indices: [] },
      commencePar: MOT_NON_ETABLI,
    },
  ];
  for (const c of cas) {
    const rendu = rendreAttribution(c.attribution);
    assert.ok(
      rendu.startsWith(c.commencePar),
      `l’état « ${c.quoi} » doit s’ouvrir sur « ${c.commencePar} », il rend : ${rendu}`
    );
  }

  // ⚠️ ET LES TROIS MOTS SONT DISTINCTS À L'ŒIL — aucun n'est le préfixe d'un autre, sans quoi
  // la garde ci-dessus passerait sur deux états confondus.
  const mots = cas.map((c) => c.commencePar);
  assert.equal(new Set(mots).size, 3, 'les trois mots qui décident doivent être trois mots différents');
  for (const a of mots) {
    for (const b of mots) {
      if (a === b) continue;
      assert.ok(!a.startsWith(b), `« ${a} » commence par « ${b} » : les deux états se confondraient`);
    }
  }
});

test('UN NOM DÉCLARÉ NE PORTE JAMAIS LE MOT « PROUVÉ », ET RÉCIPROQUEMENT — la mutation la plus tentante', () => {
  // ⚠️ LA FORME DE DÉFAUT QU'ON FERME ICI : rendre le déclaré avec le mot du prouvé « parce
  // que c'est un nom d'agent dans les deux cas ». Une seule constante déplacée, et les trois
  // sources redeviennent une. La garde du dessus vérifie le DÉBUT ; celle-ci vérifie que le
  // mot de l'AUTRE source n'apparaît nulle part dans le fragment.
  const declare = rendreAttribution({
    mesure: 'déclarée',
    source: 'déclaré au registre à la naissance, jamais mesuré à un lieu',
    declares: [{ nom: 'bernache', dOu: 'ce ticket' }],
    indices: [],
  });
  assert.ok(!declare.includes('PROUVÉ'), `un fragment DÉCLARÉ ne doit pas porter le mot PROUVÉ : ${declare}`);
  assert.ok(declare.includes('bernache'), 'le nom déclaré est bien rendu — la marque ne le remplace pas');
  assert.ok(
    declare.includes('non mesuré à un lieu'),
    'et son qualificatif voyage avec lui : « déclaré » seul se lit comme un synonyme d’« assigné »'
  );

  const prouve = rendreAttribution({ mesure: 'lue', agents: [{ nom: 'kamouraska', pane: 'w1:p1' }] });
  assert.ok(!prouve.includes('DÉCLARÉ'), `un fragment PROUVÉ ne doit pas porter le mot DÉCLARÉ : ${prouve}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2ᵉ G/W/T — UN MANDAT QUI N'EST PAS UN CODE : IL APPARAÎT, SANS CHANTIER INVENTÉ
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un orchestrateur dont le mandat n’est pas un code de chantier apparaît, avec un chantier NON ÉTABLI — et aucun chantier ne lui est attribué par ressemblance', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  // Mesuré sur le poste le 2026-08-22 : `matapedia` a pour mandat `matapedia`. Son lieu est
  // parfaitement valide ; son chantier n'est traçable nulle part.
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'matapedia');

  const rendu = await recenser([unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })], [['w1:p1', 'matapedia', undefined]]);

  let interroge = null;
  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => {
      interroge = code;
      return { code, epics: [] };
    },
  });

  assert.equal(vue.orchestrateurs.length, 1, 'il n’est PAS omis — c’est un fait, pas un trou');
  const o = vue.orchestrateurs[0];
  assert.equal(o.chantier.mesure, 'non établi');
  assert.equal(o.chantier.code, null, 'aucun code ne lui est attribué');
  assert.equal(interroge, null, 'et le ServiceDesk n’est même pas interrogé : il n’y a rien à chercher');

  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('matapedia'), 'il figure dans la vue');
  assert.ok(texte.includes(MOT_NON_ETABLI), 'et son chantier est dit non établi');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3ᵉ G/W/T — DEUX AGENTS, LE MÊME MANDAT : LES DEUX SONT RENDUS
// ═══════════════════════════════════════════════════════════════════════════════════════

test('deux agents portant le même code de mandat sont rendus tous les deux — aucun n’est écarté au profit de l’autre', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieuOrch = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');
  // Mesuré : `w8W:p1` et `w8W:p2` portent tous deux `p-20260820-0001`, et aucun des deux n'a
  // de nom. Rien dans la mesure ne départage les deux — choisir, ici, c'est mentir.
  const lieuPartage = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'e-20260822-0002');

  const rendu = await recenser(
    [
      unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieuOrch }),
      unPaneDAgent({ pane_id: 'w2:p1', foreground_cwd: lieuPartage }),
      unPaneDAgent({ pane_id: 'w2:p2', foreground_cwd: lieuPartage }),
    ],
    [
      ['w1:p1', 'kamouraska', undefined],
      ['w2:p1', 'premier', undefined],
      ['w2:p2', 'second', undefined],
    ]
  );

  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => ({
      code,
      epics: [{ code: 'E-20260822-0002', titre: 'La vue du parc', stories: [] }],
    }),
  });

  const attribution = vue.orchestrateurs.find((o) => o.chantier.code === 'P-20260822-0001').epics[0].agent;
  assert.equal(attribution.mesure, 'lue');
  assert.deepEqual(
    attribution.agents.map((a) => a.nom).sort(),
    ['premier', 'second'],
    'LES DEUX porteurs sont rendus'
  );
  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('premier') && texte.includes('second'), 'et les deux se lisent sur la ligne');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4ᵉ G/W/T — UN CHANTIER QUE PERSONNE NE PORTE : RENDU COMME TEL, JAMAIS AU PLUS PLAUSIBLE
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un epic qu’aucun agent vivant ne porte est rendu SANS AGENT ÉTABLI — jamais rattaché à l’agent le plus plausible', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await recenser([unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })], [['w1:p1', 'kamouraska', undefined]]);

  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => ({
      code,
      epics: [{ code: 'E-20260822-0007', titre: 'un epic que personne ne tient', stories: [] }],
    }),
  });

  const a = vue.orchestrateurs[0].epics[0].agent;
  assert.equal(a.mesure, 'non établi');
  assert.deepEqual(a.indices, [], 'aucun agent ne porte même ce code comme nom');
  // ⚠️ ET LA RAISON DIT LEQUEL DES DEUX CAS C'EST — « personne, même pas comme nom » n'est pas
  // « personne comme mandat, mais quelqu'un comme nom ». Les deux rendent `mesure: 'non établi'`
  // et appellent des gestes opposés : chercher qui porte ce travail d'un côté, aller vérifier
  // le lieu d'un agent identifié de l'autre. Sans cette garde, les deux formulations étaient
  // interchangeables — mutation confirmée en revue de fond.
  assert.match(a.pourquoi, /ni comme mandat lu à son lieu, ni comme nom/, 'la raison distingue ce cas de celui à indice');
  assert.ok(!a.pourquoi.includes('chef d’équipe'), 'et n’emprunte pas la raison de l’autre cas');

  const texte = rendreLaVue(vue);
  // 🔴 LE PLUS PLAUSIBLE EST À PORTÉE : `kamouraska` est le SEUL agent vivant, il est
  // l'orchestrateur de ce chantier, et rattacher son epic à lui « tombe sous le sens ». C'est
  // exactement le geste que HS-VUE-002 interdit, et c'est ce que cette assertion refuse.
  const ligneEpic = texte.split('\n').find((l) => l.includes('E-20260822-0007'));
  assert.ok(ligneEpic.includes(MOT_NON_ETABLI), 'la ligne dit non établi');
  assert.ok(!ligneEpic.includes('kamouraska'), 'et elle ne porte AUCUN nom d’agent');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'ARBITRAGE DU 2026-08-22 — LES DEUX ÉTAGES, ET LE BANC QUI EMPÊCHE LEUR CONFUSION
//
// 🔴 CONDITION 3 DE L'ARBITRAGE, mot pour mot : « un test dédié qui prouve qu'une ligne à
// indice ne peut pas être confondue avec une ligne mesurée ». C'est cette garde qui empêche la
// dérive, pas la consigne qui l'a demandée.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('une ligne À INDICE ne peut pas être confondue avec une ligne MESURÉE — le mot qui décide se lit en premier, et l’indice porte sa propre phrase', () => {
  const mesuree = rendreAttribution({
    mesure: 'lue',
    source: 'le mandat lu au lieu de l’agent',
    agents: [{ nom: 'e-20260822-0002', pane: 'w8X:p5', session: 's', statut: 'working' }],
  });
  const aIndice = rendreAttribution({
    mesure: 'non établi',
    pourquoi: 'aucun agent ne porte ce code comme mandat',
    indices: [{ nom: 'e-20260822-0002', pane: 'w8X:p5', session: 's', statut: 'working' }],
    phraseDeLIndice: PHRASE_DE_LINDICE,
  });

  // Les deux portent le MÊME nom : c'est précisément ce qui les rendrait confusables.
  assert.ok(mesuree.includes('e-20260822-0002'));
  assert.ok(aIndice.includes('e-20260822-0002'));
  assert.notEqual(mesuree, aIndice, 'et pourtant les deux lignes ne se lisent pas pareil');

  // CONDITION 1 — le mot qui décide se lit AVANT l'indice, jamais après.
  assert.ok(aIndice.startsWith(MOT_NON_ETABLI), 'la ligne à indice COMMENCE par « NON ÉTABLI »');
  assert.ok(
    aIndice.indexOf(MOT_NON_ETABLI) < aIndice.indexOf('e-20260822-0002'),
    'et « NON ÉTABLI » se lit AVANT le nom, jamais après'
  );

  // CONDITION 2 — l'indice porte SA PROPRE PHRASE, jamais un nom nu.
  assert.ok(aIndice.includes(PHRASE_DE_LINDICE), 'la phrase voyage AVEC le nom');
  assert.ok(
    aIndice.indexOf(PHRASE_DE_LINDICE) < aIndice.indexOf('e-20260822-0002'),
    'et elle précède le nom : un nom nu redevient un rattachement en trois relectures'
  );

  // Et la ligne mesurée, elle, ne dit NI l'un NI l'autre — sinon la distinction s'évanouirait
  // par le haut plutôt que par le bas.
  assert.ok(!mesuree.includes(MOT_NON_ETABLI), 'une ligne mesurée ne dit jamais « non établi »');
  assert.ok(!mesuree.includes(PHRASE_DE_LINDICE), 'ni la phrase de l’indice');
});

test('l’étage 1 PRIME sur l’étage 2 : un agent qui porte le code à la fois comme mandat ET comme nom sort MESURÉ', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieuOrch = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');
  const lieuChef = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'e-20260822-0002');

  // Mesuré sur le poste : `w8:p6` se nomme `d-20260813-0005` ET porte ce mandat à son lieu.
  const rendu = await recenser(
    [
      unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieuOrch }),
      unPaneDAgent({ pane_id: 'w1:p2', foreground_cwd: lieuChef }),
    ],
    [
      ['w1:p1', 'kamouraska', undefined],
      ['w1:p2', 'e-20260822-0002', undefined],
    ]
  );

  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => ({ code, epics: [{ code: 'E-20260822-0002', stories: [] }] }),
  });

  const a = vue.orchestrateurs.find((o) => o.chantier.code === 'P-20260822-0001').epics[0].agent;
  assert.equal(a.mesure, 'lue', 'le mandat lu au lieu l’emporte : l’indice ne DÉCLASSE jamais une mesure');
  assert.equal(a.indices, undefined, 'et aucun indice n’est rendu là où il y a une mesure');
});

test('un epic porté par un agent SANS lieu mais dont le NOM est le code sort en INDICE — non établi, avec sa piste', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  // Le chef d'équipe n'a AUCUN lieu — mesuré, T-20260822-0018 : le geste qui le fait naître ne
  // dépose rien dans son worktree. Son `foreground_cwd` ne passe par le lieu d'aucun rôle.
  const rendu = await recenser(
    [
      unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu }),
      { pane_id: 'w1:p2', foreground_cwd: join(tmp, 'un-worktree-ordinaire') },
    ],
    [
      ['w1:p1', 'kamouraska', undefined],
      ['w1:p2', 'e-20260822-0002', undefined],
    ]
  );
  assert.equal(
    rendu.agents.find((x) => x.pane === 'w1:p2').mandat,
    null,
    'préalable mesuré : un chef d’équipe n’a aucun mandat lisible'
  );

  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => ({ code, epics: [{ code: 'E-20260822-0002', stories: [] }] }),
  });

  const a = vue.orchestrateurs[0].epics[0].agent;
  assert.equal(a.mesure, 'non établi', 'le champ dit NON ÉTABLI — ce n’est PAS une jointure');
  assert.deepEqual(a.indices.map((i) => i.nom), ['e-20260822-0002'], 'et il porte la piste');
});

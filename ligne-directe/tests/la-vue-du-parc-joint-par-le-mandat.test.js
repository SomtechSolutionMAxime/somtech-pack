// LA VUE DU PARC JOINT PAR LE CODE DU MANDAT — JAMAIS PAR `assigned_agent`
// (E-20260822-0002, sous P-20260822-0001 — story T-20260822-0012, RA-VUE-005.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE BANC FERME, ET IL EST À PORTÉE DE MAIN
//
// Le ServiceDesk porte un champ `assigned_agent` sur chaque ticket. Il est là, il est lisible,
// il porte un nom d'agent : c'est LE champ qu'on emploie sans réfléchir pour savoir qui fait
// quoi. Et il ment — c'est du **texte libre saisi à la main**, souvent vide, qui diverge et
// vieillit sans que rien ne le signale.
//
// RA-VUE-005 tranche : **la jointure passe par le CODE DU MANDAT que l'agent tient de son
// LIEU**, qui se mesure. Ce banc ne se contente pas de vérifier que la bonne réponse sort : il
// fait manger à la vue un ticket dont l'`assigned_agent` désigne QUELQU'UN D'AUTRE que le
// porteur mesuré, et exige que ce quelqu'un d'autre n'apparaisse nulle part.
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
import { laVueDuParc, rendreLaVue, rendreAttribution, PHRASE_DE_LINDICE, MOT_NON_ETABLI } from '../src/vue-du-parc.js';
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
// 1ᵉʳ G/W/T — UN MANDAT QUI EST UN CODE : SON TRAVAIL LUI EST RATTACHÉ, ET `assigned_agent`
//             N'INTERVIENT À AUCUN MOMENT
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le travail est rattaché par le CODE DU MANDAT, et l’`assigned_agent` du ticket est ignoré même quand il désigne quelqu’un d’autre', async (t) => {
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
            // 🔴 LE PIÈGE, ET C'EST TOUT L'OBJET DE CE BANC. Le ticket DÉSIGNE quelqu'un
            // d'autre. Une vue qui lirait ce champ rendrait « bernache » — un nom
            // parfaitement plausible, saisi à la main, et faux.
            assigned_agent: 'bernache',
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
    'et c’est le porteur du mandat, pas l’`assigned_agent` du ticket'
  );

  // Et jusque dans le texte que lit le dirigeant : le nom saisi à la main n'y est nulle part.
  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('e-20260822-0002'), 'le porteur mesuré est nommé sur la ligne');
  assert.ok(!texte.includes('bernache'), 'l’`assigned_agent` ne doit apparaître NULLE PART dans la vue');
});

test('le module ne LIT `assigned_agent` nulle part — la garde est sur la source, pas sur un cas', () => {
  // ⚠️ UN BANC DE COMPORTEMENT NE SUFFIT PAS ICI. Le cas ci-dessus prouve qu'un chemin ignore
  // le champ ; il ne prouve pas qu'aucun autre chemin ne le lira demain. RA-VUE-005 porte sur
  // le MODULE, pas sur un scénario — alors on garde le module.
  const source = readFileSync(fileURLToPath(new URL('../src/vue-du-parc.js', import.meta.url)), 'utf8');
  // Le mot apparaît dans la prose de l'en-tête, qui explique précisément pourquoi on ne s'en
  // sert pas. Ce qu'on interdit, c'est de le LIRE : un accès de propriété.
  // ⚠️ TROIS FAÇONS DE LIRE UN CHAMP, PAS UNE — et la garde n'en couvrait qu'une. Elle cherchait
  // l'accès par point ou par crochet (`t.assigned_agent`, `t['assigned_agent']`) et laissait
  // passer la DÉSTRUCTURATION (`const { assigned_agent } = ticket`), qui lit exactement le même
  // champ. Angle mort relevé en revue de fond : non exploité aujourd'hui, mais une garde qui
  // couvre deux formes sur trois se lit comme une garde qui couvre le champ.
  //
  // On cherche donc le NOM, partout où il pourrait être lu — et on tolère la seule occurrence
  // légitime : la prose de l'en-tête, qui explique précisément pourquoi on ne s'en sert pas.
  const lignesFautives = source
    .split('\n')
    .filter((l) => l.includes('assigned_agent'))
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l.trim()) && !l.trim().startsWith('*'));
  assert.deepEqual(
    lignesFautives,
    [],
    'aucune lecture de `assigned_agent` hors commentaire — accès par point, par crochet OU par déstructuration'
  );
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

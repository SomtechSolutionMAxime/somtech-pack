// RIEN DE CE QUE LE TUI ÉCRIT NE DÉPASSE LA LARGEUR DU PANE — T-20260825-0071.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 L'INCIDENT, RAPPORTÉ PAR LE DIRIGEANT EN USAGE RÉEL
//
// « j'ai des lignes qui se multiplient sans arrêt » — `ligne-directe vue --tui`, dans un split
// herdr. Reproduit dans un vrai pane de 65 colonnes, écran lu par `herdr pane read` :
// **+21 lignes en 8 secondes**, pendant les ~80 s de chargement.
//
// LA CAUSE, MESURÉE : `texteDeProgression` rend **116 caractères, longueur fixe**, et
// `avecProgression` le réécrit toutes les 120 ms avec `\r` + effacement de ligne. Sous 116
// colonnes le texte WRAPPE : le curseur passe à la ligne suivante, donc le `\r` du tour d'après
// revient au début de la NOUVELLE ligne et l'effacement porte sur celle-là. La précédente reste.
//
// ⚠️ POURQUOI PERSONNE NE L'AVAIT VU : en pane plein écran (> 116 colonnes) la ligne tient. Le
// symptôme n'existe QUE dans un pane étroit — c'est-à-dire exactement l'écran du dirigeant.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CES BANCS GARDENT, ET POURQUOI ILS NE GARDENT PAS « LE BUG »
//
// Ils gardent l'INVARIANT dont le bug n'était qu'une violation : **rien de ce que le TUI écrit
// ne dépasse la largeur du pane**. Deux endroits l'enfreignaient — la ligne de progression (le
// symptôme observé) et l'assemblage de `rendreEcran` sous 58 colonnes (mesuré, jamais observé,
// et ANTÉRIEUR aux lots #327/#328 : formule identique au tag v1.91.0).
//
// ⚠️ C'EST LA LEÇON DE E-20260825-0001, PAYÉE ONZE FOIS EN REVUE : fermer le cas qu'on a vu
// laisse la famille ouverte. On garde donc la RÈGLE, sur TOUTE largeur, pas les deux cas.
//
// 🔴 CE QU'AUCUN BANC NE PEUT FAIRE ICI, ET IL FAUT LE DIRE : le wrap est un comportement du
// TERMINAL. Ces bancs prouvent que ce qu'on ÉCRIT tient dans la largeur annoncée — ils ne
// peuvent pas prouver ce que le terminal en fait. Cette arête-là s'EXERCE, et elle l'a été :
// dans un vrai split herdr, avant et après le correctif.

// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE LES BANCS RETIRÉS OU RÉÉCRITS GARDAIENT — ÉNUMÉRÉ, ET PROUVÉ PAR MUTATION
//
// 🔴 CE TABLEAU EXISTE PARCE QU'UNE RÉÉCRITURE A PERDU TROIS PROPRIÉTÉS EN SILENCE, et que la
// première mesure n'en avait trouvé qu'une. « J'ai vérifié que le remplaçant garde la même
// chose » est une lecture ; seule une mutation le prouve. Chaque ligne ci-dessous a été mutée
// une par une, contrôle négatif vert d'abord, sur la suite ENTIÈRE.
//
// ── `L'ÉCRAN GARDE SES BANDEAUX AUX PETITES HAUTEURS` (réécrit, pas supprimé) ──────────────
//   stylesA(1) = ['pied']                     → gardé : « L'ORDRE DE SACRIFICE… » ① et ③
//   stylesA(2) = ['titre','pied']             → PERDU, restauré : ② et ③   ⚠️ survivait
//   stylesA(3), stylesA(5)                    → gardé : « L'ORDRE DE SACRIFICE… » ② (la barre
//                                               reste dernière ; on ne fige plus la composition
//                                               exacte du corps, qui rougissait pour rien)
//   balayage « q quitter » × filtres          → gardé : « LA SORTIE SURVIT À TOUTE ENTÊTE… »
//   « q quitter » SOUS le minimum             → SANS OBJET — c'était la décision `f05bc613`,
//                                               supersédée par `00a7b645` : sous le seuil la
//                                               sortie n'est montrable par aucun rendu.
//
// ── `LE CODE QUI ÉCRIT INTERROGE L'INVARIANT` (réécrit sous le même nom) ───────────────────
//   !depasseLaLargeurAutorisee(l, largeur)    → SANS OBJET (l'oracle est supprimé) et REMPLACÉ
//                                               par la mesure directe, plus forte
//   mesurees > 1000                           → gardé, même assertion
//   barre.style === 'pied' (mode recherche)   → gardé : « LA BARRE MONTRE LE CHAMP… »
//   barre.texte contient '/'                  → PERDU, restauré : idem   ⚠️ survivait
//   largeurAffichee(barre) <= 30              → gardé : idem, et la mesure directe le couvre
//
// ── `L'EXCEPTION DE L'INVARIANT NE COUVRE QUE CE QU'ELLE NOMME` (supprimé) ─────────────────
//   toutes ses assertions                     → SANS OBJET : elles mesuraient la PORTÉE d'une
//                                               exception qui n'existe plus (`00a7b645`).
//
// ── `CE QUI REND LE SOUS-TEST DU DRAPEAU REDONDANT SE GARDE` (supprimé) ────────────────────
//   toutes ses assertions                     → SANS OBJET : elles mesuraient le drapeau
//                                               `porteLaSortie`, absent du dépôt (0 occurrence).
//
// ⚠️ UNE PROPRIÉTÉ DE PLUS, PERDUE ET RESTAURÉE, QUI N'EST DANS AUCUN DES QUATRE : à hauteur 2,
// rien n'empêchait de rendre le TITRE DEUX FOIS — donc d'effacer entièrement la sortie. Aucun
// banc ancien ne la gardait explicitement ; l'ancien `stylesA(2)` la gardait par ricochet, en
// figeant la liste. Elle est désormais gardée pour elle-même.
// ═══════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unRecensement } from '../src/recensement.js';
import { roleDuLieu } from '../src/lieu-agent.js';
import { role as roleDe } from '../src/roles.js';
import { laVueDuParc, lecteurDeChantier } from '../src/vue-du-parc.js';
import {
  arbreDeLaVue,
  lignesVisibles,
  rendreEcran,
  etatInitial,
  RACCOURCI_VITAL,
  RACCOURCIS_UN_A_UN,
  raccourcisPour,
} from '../src/tui-vue-du-parc.js';
import { texteDeProgression, avecProgression } from '../src/tui-boucle.js';
import { unPaneDAgent } from './aide/formes-reelles.js';
import { rangeesPhysiques, texteVisible } from './aide/terminal.js';

/** La largeur AFFICHÉE — en points de code. `.length` compte faux sur la roue et les accents. */
const largeurAffichee = (texte) => [...String(texte ?? '')].length;

const racine = () => mkdtempSync(join(tmpdir(), 'pane-etroit-'));

function poserLieu(depot, nom) {
  const lieu = join(depot, roleDe('orchestrateur').dossier, nom);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), "# Tu es l'orchestrateur de ce chantier\n\nle métier du jour.\n");
  writeFileSync(join(lieu, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n\nrien.\n');
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

/** Un transport de banc — la forme du service, pas une simplification. */
const unServiceDesk = () => ({
  appeler: async (nom, args) => {
    if (nom === 'projects')
      return {
        projects: [
          {
            id: 'u1',
            project_id: 'P-20260822-0001',
            title: 'Un titre assez long pour remplir la colonne de gauche et forcer la troncature',
            status: 'in_progress',
            application_id: 'a1',
          },
        ],
      };
    if (nom === 'applications') return { applications: [{ id: 'a1', name: 'Somtech Pack' }] };
    if (nom === 'epics')
      return {
        epics: [
          {
            id: 'e1',
            project_id: 'u1',
            epic_id: 'E-20260825-0001',
            title: 'Un epic dont le titre est long lui aussi, pour que la ligne ait de quoi déborder',
            status: 'in_execution',
          },
        ],
      };
    const retenus = [
      {
        id: 't1',
        epic_id: 'e1',
        ticket_id: 'T-20260825-0071',
        title: 'Une story au titre long, avec un nom déclaré qui allonge encore le suffixe',
        status: 'in_progress',
        assigned_agent: 't-20260825-0071',
      },
    ];
    return { tickets: args?.limit ? retenus.slice(0, args.limit) : retenus };
  },
});

async function uneVue(lieu) {
  const recensement = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })],
    roleDuLieu,
    nomsConnus: { mesure: 'lue', noms: new Map([[`\u0000w1:p1`, 'kamouraska']]) },
  });
  return laVueDuParc({ recensement, lireChantier: lecteurDeChantier({ appeler: unServiceDesk().appeler }) });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA LIGNE DE PROGRESSION — la cause OBSERVÉE de l'incident
// ═══════════════════════════════════════════════════════════════════════════════════════

test('LA LIGNE DE PROGRESSION TIENT DANS LE PANE — à TOUTE largeur, c’est elle qui empilait', () => {
  // ⚠️ ON BALAIE, ON NE CHOISIT PAS TROIS LARGEURS. Un banc écrit sur les largeurs qu'on a en
  // tête garde les largeurs qu'on a en tête ; le dirigeant, lui, redimensionne son split comme
  // il veut. La largeur 1 est incluse exprès : c'est la seule qui ne pardonne aucune erreur
  // d'arrondi.
  for (let largeur = 1; largeur <= 200; largeur += 1) {
    for (const secondes of [0, 9, 21, 137]) {
      const rendu = texteDeProgression(secondes, secondes % 10, largeur);
      assert.ok(
        largeurAffichee(rendu) <= largeur,
        `à ${largeur} colonnes, la progression en écrit ${largeurAffichee(rendu)} — elle WRAPPE, ` +
          `donc elle empile une ligne toutes les 120 ms : ${JSON.stringify(rendu)}`
      );
    }
  }
});

test('SANS BORNE DONNÉE, LE MESSAGE RESTE ENTIER — la borne ne raccourcit pas le produit', () => {
  // 🔴 LE FAUX POSITIF SYMÉTRIQUE, ET IL COMPTE AUTANT. Le remède facile aurait été de
  // raccourcir le message. Il dit ce que le lecteur doit savoir pendant 80 s d'attente : que le
  // ServiceDesk est interrogé chantier par chantier, et combien de temps ça prend. Le mutiler
  // sur un écran LARGE pour un défaut qui n'existe que sur un écran ÉTROIT serait payer le
  // confort de tous pour le cas de quelques-uns.
  const entier = texteDeProgression(21, 3);
  assert.ok(entier.includes('chantier par chantier'), `le message a perdu sa raison : ${entier}`);
  assert.ok(entier.includes('~80 s'), `le message a perdu son ordre de grandeur : ${entier}`);
  assert.equal(largeurAffichee(entier), 116, 'le message entier fait toujours sa longueur d’origine');
  // Et une largeur PLUS GRANDE que lui ne le complète pas : ce n'est pas une colonne.
  assert.equal(texteDeProgression(21, 3, 200), entier, 'une largeur généreuse ne doit rien changer');
});

test('LA ROUE ET LES ACCENTS SONT COMPTÉS JUSTE — sinon la borne est fausse là où elle sert', () => {
  // ⚠️ `.length` COMPTE EN UNITÉS UTF-16. Les caractères de la roue (⠋ …) et les accents
  // pèseraient faux, et la borne laisserait passer un dépassement d'un ou deux caractères —
  // c'est-à-dire exactement ce qu'il faut pour wrapper.
  for (const largeur of [30, 65, 100]) {
    const rendu = texteDeProgression(7, 4, largeur);
    assert.equal(
      largeurAffichee(rendu),
      largeur,
      `à ${largeur}, la borne coupe à ${largeurAffichee(rendu)} points de code — le compte est faux`
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'ÉCRAN — le second membre de la famille, MESURÉ mais jamais observé
// ═══════════════════════════════════════════════════════════════════════════════════════

test('AUCUNE LIGNE DE L’ÉCRAN NE DÉPASSE LE PANE — à TOUTE largeur, sur une vue réelle', async (t) => {
  // 🔴 CE DÉFAUT PRÉEXISTE AUX LOTS #327 ET #328 : la formule des deux planchers est identique
  // au tag v1.91.0 (vérifié par `git archive`). Mesuré avant correctif : 51 caractères écrits
  // dans un pane de 40, 54 dans un pane de 50, 58 dans un pane de 57.
  //
  // ⚠️ IL N'A PAS ÉTÉ OBSERVÉ PRODUIRE L'EMPILEMENT, et c'est dit plutôt que sous-entendu :
  // l'écran est repeint entier (`ESC[H` + `ESC[2J`) à chaque frame, donc le wrap ne s'accumule
  // pas comme celui de la progression. Il est gardé quand même — même règle enfreinte.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));

  const racines = arbreDeLaVue(vue, { parApp: true });
  const etat = etatInitial();
  const lignes = lignesVisibles(racines, etat);

  // ⚠️ CONTRÔLE POSITIF : sans lignes à rendre, cette garde serait verte sur un écran vide.
  assert.ok(lignes.length >= 3, 'le décor doit produire un arbre — sinon ce banc ne mesure rien');

  for (let largeur = 1; largeur <= 200; largeur += 1) {
    const ecran = rendreEcran({ vue, etat, lignes, largeur, hauteur: 12 });
    for (const l of ecran) {
      // 🔴 LA MESURE EST DIRECTE, ET C'EST UNE CORRECTION. Ce banc a interrogé un invariant —
      // `depasseLaLargeurAutorisee` — parce qu'en recopier la condition la laissait s'élargir à
      // côté de la règle (quatre élargissements, quatre fois VERT). Sous la décision `00a7b645`
      // il n'y a plus de condition du tout : plus aucune ligne n'a le droit de dépasser. Un
      // oracle qui répond toujours « non » n'est plus un garde — il est SUPPRIMÉ, et ce qui
      // reste est la seule chose qui ne peut pas mentir : la longueur du texte rendu.
      assert.ok(
        largeurAffichee(l.texte) <= largeur,
        `à ${largeur} colonnes, une ligne en écrit ${largeurAffichee(l.texte)} : ${JSON.stringify(l.texte)}`
      );
    }
  }
});

test('L’ÉCRAN NE JETTE À AUCUNE LARGEUR — un TUI qui jette au redimensionnement est pire que le défaut', async (t) => {
  // ⚠️ LE PIÈGE DU CORRECTIF : bâtir la largeur de l'arbre sur une soustraction peut la rendre
  // NÉGATIVE, et `repeat(-1)` jette. Redimensionner un split est précisément ce qu'on fait
  // quand un affichage devient illisible — le TUI mourrait dans la main du dirigeant, au pire
  // moment.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const etat = etatInitial();
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etat);

  for (const [largeur, hauteur] of [
    [0, 0],
    [1, 1],
    [2, 3],
    [3, 2],
    [27, 77],
    [65, 24],
  ]) {
    assert.doesNotThrow(
      () => rendreEcran({ vue, etat, lignes, largeur, hauteur }),
      `l’écran jette à ${largeur}x${hauteur}`
    );
  }
});

test('L’ÉCRAN GARDE SA HAUTEUR — autant de lignes que le pane, ni plus ni moins', async (t) => {
  // ⚠️ LE JUMEAU VERTICAL, et il manquait. Une ligne de trop en HAUTEUR pousse la première
  // hors de l'écran et fait défiler — le même symptôme par l'autre dimension. Le rendu doit
  // occuper exactement ce que le pane offre.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const etat = etatInitial();
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etat);

  // 🔴 CE BANC BALAYAIT `[3, 12, 24, 77]`, ET C’EST EXACTEMENT CE QUI A LAISSÉ PASSER LE DÉFAUT.
  // Son jumeau sur la LARGEUR balaie 1 à 200 en continu, avec un commentaire qui explique
  // pourquoi — « la largeur 1 est incluse exprès : c’est la seule qui ne pardonne aucune erreur
  // d’arrondi ». Je n’ai pas appliqué la même discipline à la hauteur, et la borne basse (0, 1,
  // 2) n’était donc jamais éprouvée pour l’EXACTITUDE DU COMPTE : mesuré, l’écran rendait 3
  // lignes pour un pane de 0, 1 ou 2. Relevé en revue portail.
  //
  // ⚠️ UNE GARDE DISCRÈTE GARDE LES POINTS QU’ON A EN TÊTE ; le dirigeant, lui, redimensionne
  // son split comme il veut — et il le fait précisément quand l’affichage devient illisible.
  for (let hauteur = 0; hauteur <= 120; hauteur += 1) {
    const ecran = rendreEcran({ vue, etat, lignes, largeur: 65, hauteur });
    assert.equal(
      ecran.length,
      hauteur,
      `à ${hauteur} ligne(s) de pane, l’écran en rend ${ecran.length} — une ligne de trop pousse ` +
        `la première hors du pane et fait DÉFILER : le symptôme de l’incident, par l’autre dimension`
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE CHEMIN QUI ÉCRIT — et c'est lui que personne ne gardait
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 QUATRE MUTATIONS SUR SIX SURVIVAIENT À MA PREMIÈRE VERSION DE CE FICHIER. Je gardais le
// TEXTE rendu par `texteDeProgression` ; je ne gardais pas le GESTE qui l'écrit. Retirer la
// largeur passée au battement, ou la lire une seule fois au départ, laissait la suite entière
// VERTE — c'est-à-dire que le correctif de l'incident n'était gardé sur aucun de ses chemins.
//
// ⚠️ MÊME MOTIF QUE LES ONZE REJETS DE E-20260825-0001, appliqué au CHEMIN plutôt qu'au cas.

/** Une sortie de banc — elle enregistre ce qu'on lui écrit, et sa largeur peut changer. */
function uneSortie(colonnes) {
  const ecrits = [];
  return {
    get columns() {
      return this._c;
    },
    _c: colonnes,
    write(t) {
      ecrits.push(t);
    },
    ecrits,
    /** Les textes de progression seuls, sans les séquences de contrôle. */
    progressions() {
      return ecrits
        .map((t) => t.replace(/^\r\[2K/, ''))
        .filter((t) => t.includes('lecture du parc'));
    },
  };
}

/** Attendre que le battement ait écrit au moins `n` fois — sans dormir à l'aveugle. */
async function attendreEcritures(sortie, n) {
  for (let i = 0; i < 200 && sortie.progressions().length < n; i += 1) {
    await new Promise((r) => setTimeout(r, 5));
  }
  return sortie.progressions();
}

test('LE GESTE QUI ÉCRIT BORNE À LA LARGEUR DU PANE — pas seulement le texte qu’il rend', async () => {
  // 🔴 LA MUTATION QUI SURVIVAIT : retirer la largeur passée au battement. Ce banc l'attrape,
  // parce qu'il regarde ce que `avecProgression` ÉCRIT VRAIMENT, pas ce que la fonction de
  // texte saurait rendre si on la lui demandait.
  const sortie = uneSortie(65);
  let fini;
  const promesse = avecProgression(
    () => new Promise((r) => (fini = () => r({ registre: { mesure: 'lu' }, orchestrateurs: [] }))),
    sortie,
    { intervalle: 5 }
  );
  const vus = await attendreEcritures(sortie, 3);
  fini();
  await promesse;

  assert.ok(vus.length >= 3, `le battement doit avoir écrit — il a écrit ${vus.length} fois`);
  for (const t of vus) {
    assert.ok(
      [...t].length <= 65,
      `le geste écrit ${[...t].length} caractères dans un pane de 65 — il WRAPPE, donc il EMPILE ` +
        `une ligne à chaque tour : ${JSON.stringify(t)}`
    );
  }
});

test('LA LARGEUR EST RELUE À CHAQUE TOUR — un pane redimensionné pendant le chargement', async () => {
  // 🔴 L'AUTRE MUTATION QUI SURVIVAIT : lire la largeur UNE FOIS au départ. Redimensionner un
  // split est précisément ce qu'on fait quand un affichage devient illisible — le trou se
  // rouvrirait au moment exact où le dirigeant essaie de s'en sortir.
  const sortie = uneSortie(150);
  let fini;
  const promesse = avecProgression(
    () => new Promise((r) => (fini = () => r({ registre: { mesure: 'lu' }, orchestrateurs: [] }))),
    sortie,
    { intervalle: 5 }
  );
  await attendreEcritures(sortie, 2);
  const large = sortie.progressions().length;

  // Le pane rétrécit EN COURS de chargement.
  sortie._c = 40;
  await attendreEcritures(sortie, large + 3);
  fini();
  await promesse;

  const apres = sortie.progressions().slice(large + 1);
  assert.ok(apres.length >= 2, 'le battement doit avoir continué après le redimensionnement');
  for (const t of apres) {
    assert.ok(
      [...t].length <= 40,
      `après rétrécissement à 40, le geste écrit encore ${[...t].length} caractères : ${JSON.stringify(t)}`
    );
  }
  // ⚠️ CONTRÔLE POSITIF : avant le rétrécissement, la ligne était bien PLUS LONGUE que 40 —
  // sinon ce banc serait vert sur un texte qui n'a jamais dépassé, donc sur rien.
  assert.ok(
    [...sortie.progressions()[0]].length > 40,
    'le décor doit partir d’une ligne plus longue que la largeur d’arrivée'
  );
});

test('LE BATTEMENT S’ARRÊTE ET EFFACE — il ne laisse pas sa dernière ligne à l’écran', async () => {
  // ⚠️ LE JUMEAU DE LA BORNE : une progression qui ne s'efface pas laisse une ligne morte
  // au-dessus de l'écran du TUI. Le `finally` le fait déjà ; rien ne le gardait.
  const sortie = uneSortie(65);
  let fini;
  const promesse = avecProgression(
    () => new Promise((r) => (fini = () => r({ registre: { mesure: 'lu' }, orchestrateurs: [] }))),
    sortie,
    { intervalle: 5 }
  );
  await attendreEcritures(sortie, 2);
  const avant = sortie.ecrits.length;
  fini();
  await promesse;

  assert.ok(sortie.ecrits.length > avant, 'la fin doit écrire quelque chose');
  const dernier = sortie.ecrits[sortie.ecrits.length - 1];
  assert.ok(!dernier.includes('lecture du parc'), `la dernière écriture doit EFFACER : ${JSON.stringify(dernier)}`);
  assert.ok(dernier.includes('[2K'), `elle doit effacer la ligne : ${JSON.stringify(dernier)}`);

  // Et le battement ne bat plus : rien de neuf après la fin.
  const fige = sortie.ecrits.length;
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(sortie.ecrits.length, fige, 'le battement continue après la fin — il tiendrait le processus');
});

test('L’ÉCRAN TIENT DANS LE PANE — LES DEUX DIMENSIONS ENSEMBLE, et pas l’une puis l’autre', async (t) => {
  // 🔴 CE BANC EXISTE PARCE QUE J’AI FERMÉ UNE DIMENSION EN CROYANT FERMER LA FAMILLE.
  //
  // J’ai borné la LARGEUR — celle où le symptôme avait été observé — et laissé la HAUTEUR
  // ouverte : `hauteurCorps` portait un plancher inconditionnel, et l’écran rendait 3 lignes
  // pour un pane de 0, 1 ou 2. Relevé en revue portail, sur le lot qui venait de corriger la
  // dimension jumelle.
  //
  // ⚠️ DEUX BANCS SÉPARÉS NE VALENT PAS UN BANC CROISÉ : chacun fixe l’autre dimension à une
  // valeur commode, et c’est exactement là que l’angle mort se loge. On balaie donc le PLAN,
  // pas deux axes.
  //
  // ⚠️ ET ON ÉPROUVE LES TROIS PROPRIÉTÉS À CHAQUE POINT : le compte de lignes, la largeur de
  // chacune, et l’absence de jet. Une seule des trois laisserait passer les deux autres.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const etat = etatInitial();
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etat);

  // ⚠️ CONTRÔLE POSITIF : sans arbre à rendre, ce balayage serait vert sur du vide.
  assert.ok(lignes.length >= 3, 'le décor doit produire un arbre — sinon ce banc ne mesure rien');

  for (let largeur = 0; largeur <= 130; largeur += 1) {
    for (let hauteur = 0; hauteur <= 40; hauteur += 1) {
      let ecran;
      assert.doesNotThrow(() => {
        ecran = rendreEcran({ vue, etat, lignes, largeur, hauteur });
      }, `l’écran jette à ${largeur}x${hauteur} — un TUI qui meurt au redimensionnement est pire que le défaut`);

      assert.equal(
        ecran.length,
        hauteur,
        `à ${largeur}x${hauteur}, l’écran rend ${ecran.length} lignes — il DÉFILE`
      );
      for (const l of ecran) {
        // Même mesure directe que ci-dessus, et pour la même raison : il n'y a plus d'exception
        // à nommer, donc plus d'oracle à interroger. Voir la note ci-dessus.
        assert.ok(
          largeurAffichee(l.texte) <= largeur,
          `à ${largeur}x${hauteur}, une ligne écrit ${largeurAffichee(l.texte)} caractères : ${JSON.stringify(l.texte)}`
        );
      }
    }
  }
});

test('LE CODE QUI ÉCRIT INTERROGE L’INVARIANT — et plus RIEN ne déborde, sur tous les états', async (t) => {
  // 🔴 CE BANC EXISTE PARCE QUE J’AVAIS UN INVARIANT JUSTE, ÉPROUVÉ, ET JAMAIS CONSULTÉ.
  // `rendreEcran` recalculait sa propre condition, plus large, et laissait passer le pied en
  // mode RECHERCHE (43 caractères sur un pane de 30) — une régression de ce lot : sur
  // `origin/main`, `borner` s’appliquait sans condition.
  //
  // ⚠️ DEPUIS LA DÉCISION `00a7b645` (option B), IL N’Y A PLUS D’EXCEPTION DU TOUT : la barre
  // se tronque comme toute autre ligne. Ce banc mesure donc une règle sans réserve — et c’est
  // ce qui le rend impossible à affaiblir : il n’y a pas de justification à élargir.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));

  const etats = [
    { quoi: 'arbre', etat: etatInitial() },
    { quoi: 'filtre « non-pris seuls »', etat: { ...etatInitial(), nonPrisSeuls: true } },
    { quoi: 'mode RECHERCHE, terme court', etat: { ...etatInitial(), mode: 'recherche', recherche: 'a' } },
    { quoi: 'mode RECHERCHE, terme long', etat: { ...etatInitial(), mode: 'recherche', recherche: 'somcraft-cowork-espace-client' } },
    { quoi: 'mode RECHERCHE, terme vide', etat: { ...etatInitial(), mode: 'recherche', recherche: '' } },
    // ⚠️ LA CONTREFAÇON : le lecteur tape le raccourci vital DANS la recherche. Tant que
    // l’exception reconnaissait la barre à une sous-chaîne, ce texte se faisait passer pour
    // elle. L’exception a disparu ; le cas reste gardé, parce qu’il ne coûte rien de le garder.
    { quoi: 'mode RECHERCHE contenant le raccourci vital', etat: { ...etatInitial(), mode: 'recherche', recherche: RACCOURCI_VITAL } },
  ];

  let mesurees = 0;
  for (const { quoi, etat: e } of etats) {
    const l2 = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), e);
    for (let largeur = 1; largeur <= 130; largeur += 1) {
      for (const ligne of rendreEcran({ vue, etat: e, lignes: l2, largeur, hauteur: 10 })) {
        mesurees += 1;
        assert.ok(
          largeurAffichee(ligne.texte) <= largeur,
          `${quoi}, à ${largeur} colonnes : ${largeurAffichee(ligne.texte)} caractères de style ` +
            `« ${ligne.style} » : ${JSON.stringify(ligne.texte)}`
        );
        // ⚠️ ON NE CONFRONTE PLUS LE RENDU À UN ORACLE. Il en existait un —
        // `depasseLaLargeurAutorisee` — et le banc s’accordait avec lui : une tautologie, deux
        // faces d’un même calcul qui se seraient trompées ENSEMBLE. Mesuré par mutation : le
        // remplacer par `return false` laissait la suite verte. Il est supprimé du moteur ;
        // ce qui garde la propriété est la mesure ci-dessus, faite sur le texte rendu.
      }
    }
  }
  assert.ok(mesurees > 1000, `ce banc doit mesurer un vrai écran — il n’a vu que ${mesurees} lignes`);
});


test('CE QUE LE LECTEUR VOIT VRAIMENT AUX PETITES DIMENSIONS — balayage COMPLET, et chaque assertion compte ses déclenchements', async (t) => {
  // 🔴 CONDITION N°2 DE LA DÉCISION `00a7b645`, ET C’EST ELLE QUI A PERMIS AU DÉFAUT DE
  // TRAVERSER TROIS CORRECTIONS : un banc qui fait `includes()` sur la chaîne LOGIQUE ne peut
  // pas voir qu’un terminal wrappe et fait défiler. Un vert qui ne touche pas ce qu’il éprouve.
  //
  // Ce banc passe par `tests/aide/terminal.js`, un modèle d’auto-wrap et de défilement. ⚠️ C’est
  // un DOUBLE, et sa fidélité n’est pas éprouvée dans ce dépôt — sa note le dit, et elle nomme
  // l’instrument qui ne dépend pas de lui.
  //
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 CE BANC A ÉTÉ REFAIT PARCE QU’IL AVAIT UNE ASSERTION QUI NE SE DÉCLENCHAIT JAMAIS.
  //
  // Sa première version prenait un échantillon de dimensions ÉCRIT À LA MAIN :
  //     [[3,1],[5,1],[8,2],[9,1],[12,3],[20,3],[40,8],[65,12]]
  // Son assertion sur la sortie ne vaut qu’au-dessus du seuil ; son seul cas à `rows = 2` était
  // `8×2`, SOUS le seuil. **Elle ne s’est donc jamais déclenchée pour une hauteur de 2.** Le banc
  // était vert, l’assertion était morte, et l’ordre de sacrifice à hauteur 2 n’était plus gardé —
  // on pouvait effacer entièrement la sortie de l’écran sans qu’un essai bouge.
  //
  // ⚠️ DEUX REMÈDES, ET IL FAUT LES DEUX :
  //   ① le balayage est un PRODUIT CARTÉSIEN, plus un échantillon choisi. Un échantillon écrit à
  //      la main omet toujours le couple auquel on ne pense pas — et c’est celui-là qui casse.
  //   ② chaque assertion COMPTE ses déclenchements, et le banc rougit si un compte est à ZÉRO.
  //      Sans ce compte, une assertion morte est indiscernable d’une assertion satisfaite.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  //
  // ⚠️ CE QUE B GARANTIT, ET CE QU’ELLE NE GARANTIT PAS :
  //   • au-dessus du seuil, la sortie ne se sacrifie JAMAIS ;
  //   • sous le seuil, elle n’est montrable par AUCUN rendu — et ce qui se joue alors est
  //     « lequel abîme le moins le reste de l’écran ». La troncature garde l’écran stable et le
  //     titre en place ; le débordement emportait les deux (mesuré : à 8×2, `'q quitte'` / `'r'`,
  //     titre disparu).
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const etat = etatInitial();
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etat);
  const SEUIL = [...RACCOURCI_VITAL].length;

  // ⚠️ PRODUIT CARTÉSIEN, ET IL COUVRE LES DEUX CÔTÉS DU SEUIL DANS LES DEUX DIMENSIONS.
  const COLONNES = [1, 2, 3, 5, 8, SEUIL - 1, SEUIL, SEUIL + 1, 12, 20, 40, 65];
  const RANGEES = [1, 2, 3, 4, 5, 8, 12, 24];

  const declenche = { hauteur: 0, titre: 0, sortie: 0, sousLeSeuil: 0 };

  for (const cols of COLONNES) {
    for (const rows of RANGEES) {
      const ecran = rendreEcran({ vue, etat, lignes, largeur: cols, hauteur: rows });

      // ═══ ① L’ÉCRAN NE DÉFILE PAS : ce qu’on écrit tient dans les rangées du pane.
      declenche.hauteur += 1;
      assert.equal(
        rangeesPhysiques(ecran, cols),
        rows,
        `à ${cols}×${rows}, l’écran occupe ${rangeesPhysiques(ecran, cols)} rangées physiques — ` +
          'il DÉFILE, et ce qui précède est poussé hors de vue'
      );

      const vu = texteVisible(ecran, cols, rows);
      assert.ok(vu.length > 0, `à ${cols}×${rows}, l’écran est vide`);

      // ═══ ② LE TITRE SURVIT — c’est ce que le débordement emportait.
      if (rows >= 2) {
        declenche.titre += 1;
        assert.ok(
          vu.split('\n')[0].trim() !== '',
          `à ${cols}×${rows}, la première rangée visible est vide — le titre a été poussé dehors`
        );
      }

      // ═══ ③ LA SORTIE, SELON LE SEUIL — la garantie de B, énoncée telle qu’elle est.
      if (cols >= SEUIL) {
        declenche.sortie += 1;
        assert.ok(
          vu.includes(RACCOURCI_VITAL),
          `à ${cols}×${rows}, « ${RACCOURCI_VITAL} » tiendrait et n’est pas à l’écran : ${JSON.stringify(vu)}`
        );
      } else {
        // ⚠️ CONTRÔLE POSITIF DE L’IMPOSSIBILITÉ : on ne se contente pas de ne rien exiger, on
        // prouve que rien ne pouvait l’être. Sans ça, la branche serait une dispense muette.
        declenche.sousLeSeuil += 1;
        assert.ok(
          [...RACCOURCI_VITAL].length > cols,
          `à ${cols} colonnes, « ${RACCOURCI_VITAL} » TIENDRAIT — cette branche n’aurait pas dû s’appliquer`
        );
      }
    }
  }

  // ═══ ④ AUCUNE ASSERTION MORTE. C’est le défaut qui a coûté ce banc : une assertion qui ne se
  // déclenche jamais est verte pour rien, et indiscernable d’une assertion satisfaite.
  for (const [quoi, combien] of Object.entries(declenche)) {
    assert.ok(combien > 0, `l’assertion « ${quoi} » ne s’est JAMAIS déclenchée — elle est morte, verte pour rien`);
  }

  // ⚠️ ET LE COUPLE QUI MANQUAIT SE NOMME, pour qu’un futur rétrécissement du balayage le fasse
  // rougir plutôt que de le reperdre en silence : au-dessus du seuil, à HAUTEUR 2 exactement.
  const aHauteurDeux = COLONNES.filter((c) => c >= SEUIL).length * RANGEES.filter((r) => r === 2).length;
  assert.ok(
    aHauteurDeux > 0,
    'le balayage ne contient AUCUN couple (colonnes ≥ seuil, hauteur 2) — c’est exactement le ' +
      'trou par lequel l’ordre de sacrifice a cessé d’être gardé'
  );
});


test('CE QUI REND LA MUTATION `.length` ÉQUIVALENTE SE GARDE — sinon elle cesse de l’être en silence', () => {
  // 🔴 UNE MUTATION SURVIVANTE QUI N’EN EST PAS UNE, ET LE DIRE VAUT MIEUX QUE DE LA MASQUER.
  // Remplacer le comptage en points de code par `.length` laisse la suite verte — non pas
  // parce qu’un banc manque, mais parce que **le texte du jour est entièrement dans le BMP** :
  // les deux comptes rendent 116. Verdict : mutation ÉQUIVALENTE, pas survivante.
  //
  // ⚠️ MAIS L’ÉQUIVALENCE REPOSE SUR UN FAIT, PAS SUR UNE PROPRIÉTÉ. Le jour où quelqu’un met un
  // emoji dans ce message — un ✅, un 🔴, exactement ce que ce dépôt met partout ailleurs — la
  // mutation redevient mordante, et RIEN ne le dirait. Une équivalence non gardée est une
  // survivante en attente.
  //
  // Ce banc ne garde donc pas l’équivalence : il garde CE QUI LA REND VRAIE.
  //
  // ⚠️ RECONFIRMÉ EN CAMPAGNE LE 2026-08-25, SUR UNE AUTRE ÉCRITURE DE LA MÊME MUTATION :
  // `[...texte]` → `texte.split('')` survit aussi, et pour la même raison. J'ai commencé par
  // écrire un banc de plus — il figeait `tourne = 3`, donc il gardait MOINS que celui-ci. La
  // bonne conduite quand une survivante retombe sur une équivalence déjà gardée n'est pas
  // d'ajouter une garde : c'est de vérifier que celle qui existe couvre la FAMILLE, et de le
  // dire ici. Mesuré : un 🔴 glissé dans le message fait rougir ce banc.
  // ⚠️ ON BALAIE LA ROUE ENTIÈRE, ET C'EST UN ANGLE MORT RELEVÉ EN REVUE PORTAIL. Ce banc
  // figeait `tourne = 3` : il ne voyait qu'UN caractère sur les dix de la roue. Un emoji glissé
  // dans n'importe lequel des neuf autres serait passé sans qu'aucun essai ne bouge — la garde
  // annonçait une famille et gardait un point.
  //
  // ⚠️ ET LES SECONDES AUSSI VARIENT : leur nombre de chiffres change la longueur du message.
  for (let tourne = 0; tourne < 10; tourne += 1) {
    for (const secondes of [0, 9, 99, 999]) {
      const message = texteDeProgression(secondes, tourne);
      assert.equal(
        message.length,
        [...message].length,
        `le message de progression est sorti du BMP (roue ${tourne}, ${secondes} s) : la borne ` +
          'DOIT désormais compter en points de code, et la mutation `.length` cesse d’être ' +
          'équivalente — vérifiez que le banc de la largeur d’affichage l’attrape encore'
      );
    }
  }
});

test('LA BORNE COMPTE LA LARGEUR D’AFFICHAGE, PAS LES UNITÉS UTF-16', () => {
  // 🔴 CE BANC EXISTE PARCE QUE MA PROSE MENTAIT, et la mutation l'a prouvé. J'avais écrit que
  // « la roue et les accents seraient comptés faux par `.length` » : **c'est faux** — ⠋ (U+280B)
  // et é sont dans le BMP. Remettre `.length` SURVIVAIT à mes bancs.
  //
  // ⚠️ LE VRAI CAS est un caractère HORS BMP : il pèse 2 en UTF-16 et 1 à l'écran. Aucun n'est
  // dans le message d'aujourd'hui — c'est donc la MÉTHODE qu'on épingle, pas le texte courant :
  // la borne protège une largeur d'AFFICHAGE, elle doit se mesurer en points de code, juste par
  // construction et non par chance sur le texte du jour.
  const horsBMP = '🔴';
  assert.equal(horsBMP.length, 2, 'le décor doit vraiment porter un caractère hors BMP');
  assert.equal([...horsBMP].length, 1, 'qui ne pèse qu’une colonne à l’écran');

  // La fonction bornée doit couper en points de code : à N, exactement N points de code.
  // ⚠️ TOUTE LA ROUE, PAS `tourne = 3` : même angle mort que ci-dessus, relevé en revue portail.
  for (let tourne = 0; tourne < 10; tourne += 1) {
    for (const largeur of [10, 30, 65]) {
      const rendu = texteDeProgression(21, tourne, largeur);
      assert.equal(
        [...rendu].length,
        largeur,
        `à ${largeur} (roue ${tourne}), la borne rend ${[...rendu].length} points de code — ` +
          'elle ne compte pas l’affichage'
      );
    }
  }
});

test('LES DEUX PLANCHERS DE L’ÉCRAN SE CONNAISSENT — gardé À PART de l’invariant de sortie', async (t) => {
  // 🔴 CETTE MUTATION SURVIVAIT AUSSI, et pour une raison qui a l'air d'une bonne nouvelle :
  // l'invariant posé à la sortie (`borner`) rattrapait le débordement. Défense en profondeur,
  // certes — mais alors le correctif des planchers n'était gardé par RIEN, et il serait tombé
  // au premier « nettoyage » sans qu'aucun essai ne rougisse.
  //
  // ⚠️ ON MESURE DONC LA FORMULE ELLE-MÊME, avant que la borne de sortie ne l'efface : la somme
  // des deux largeurs plus le séparateur ne doit jamais dépasser le pane.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const etat = etatInitial();
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etat);

  for (let largeur = 3; largeur <= 200; largeur += 1) {
    const ecran = rendreEcran({ vue, etat, lignes, largeur, hauteur: 6 });
    // La ligne d'une rangée vide est faite des deux largeurs et du séparateur, sans troncature
    // de contenu : sa longueur AVANT bornage est donc la somme que la formule a décidée.
    const rangee = ecran[1]?.texte ?? '';
    const separateur = rangee.indexOf(' │ ');
    assert.ok(
      separateur >= 0 || largeur < 4,
      `à ${largeur}, le séparateur des deux colonnes a disparu : ${JSON.stringify(rangee)}`
    );
    if (separateur < 0) continue;
    const arbre = separateur;
    const detail = [...rangee].length - separateur - 3;
    assert.ok(
      arbre + 3 + detail <= largeur,
      `à ${largeur} colonnes, la formule décide arbre=${arbre} + 3 + détail=${detail} = ` +
        `${arbre + 3 + detail} — les deux planchers s’ignorent de nouveau`
    );
  }
});

test('LA SORTIE SURVIT À TOUTE ENTÊTE DE PIED — mesuré sur l’écran, à toutes les largeurs', async (t) => {
  // 🔴 TROUVÉ PAR MUTATION, PAS PAR RELECTURE — et le code disait déjà, en toutes lettres, que
  // c'était ce qu'il fallait éviter. Neutraliser le retrait de l'entête de filtre laissait la
  // suite VERTE. Mesuré sur le mutant, en mode filtre :
  //     20 col → 'FILTRE : non-pris s…'      · 24 → 'FILTRE : non-pris seuls…'
  //     30 col → 'FILTRE : non-pris seuls  ─  q…'
  // Le lecteur perd la sortie entre 20 et 34 colonnes, remplacée par une entête à demi lisible
  // qui ne se comprend pas ET mange la place. C'est le cas nommé dans la note de `pied()` — la
  // conduite était juste, elle n'était gardée par RIEN.
  //
  // ⚠️ ON MESURE SUR LE PIED RENDU, PAS SUR LA RÈGLE QUI LE COMPOSE. La règle a déjà changé
  // trois fois de forme ; la propriété que le dirigeant vit, elle, n'a pas bougé : au-dessus du
  // seuil, il voit comment sortir.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const SEUIL = [...RACCOURCI_VITAL].length;

  const avecEntete = [
    { quoi: 'filtre « non-pris seuls »', etat: { ...etatInitial(), nonPrisSeuls: true } },
    { quoi: 'recherche active', etat: { ...etatInitial(), recherche: 'somcraft' } },
    { quoi: 'les DEUX entêtes ensemble', etat: { ...etatInitial(), nonPrisSeuls: true, recherche: 'somcraft-cowork-espace-client' } },
  ];

  let mesurees = 0;
  for (const { quoi, etat: e } of avecEntete) {
    const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), e);
    for (let largeur = SEUIL; largeur <= 140; largeur += 1) {
      const ecran = rendreEcran({ vue, etat: e, lignes, largeur, hauteur: 8 });
      const pied = ecran[ecran.length - 1].texte;
      mesurees += 1;
      assert.ok(
        pied.includes(RACCOURCI_VITAL),
        `${quoi}, à ${largeur} colonnes : « ${RACCOURCI_VITAL} » TIENDRAIT et le pied ne le porte pas — ` +
          `l’entête a pris la place de la sortie : ${JSON.stringify(pied)}`
      );
    }
  }
  assert.ok(mesurees > 300, `ce banc doit balayer les largeurs — il n’en a vu que ${mesurees}`);
});

test('L’ORDRE DE SACRIFICE AUX HAUTEURS MINUSCULES — ce que la réécriture d’un banc avait laissé tomber', async (t) => {
  // 🔴 TROUVÉ PAR UNE PASSE DE FOND, ET LE DÉFAUT RÉEL ÉTAIT PIRE QUE CE QU’ELLE DÉCRIVAIT.
  //
  // Un banc gardait ces propriétés en comparant les STYLES rendus : `stylesA(2)` devait valoir
  // exactement `['titre','pied']`. Je l’ai RÉÉCRIT en un banc de rendu — meilleur sur la largeur,
  // et qui ne passait plus par ce point. Mesuré par mutation, sur la suite ENTIÈRE :
  //
  //     hauteur 1, rendre le titre au lieu de la sortie  → ROUGE   (encore gardé)
  //     hauteur 2, barre AVANT titre                     → SURVIVANTE
  //     hauteur 2, le titre DEUX FOIS (plus de sortie)   → SURVIVANTE   ← le pire
  //
  // La seconde survivante efface ENTIÈREMENT la sortie d’un écran de 2 lignes, et la suite reste
  // verte à 1119/1119. C’est le défaut que ce lot avait fermé deux jours plus tôt, rouvert par
  // une réécriture qui améliorait autre chose.
  //
  // ⚠️ LA LEÇON, ET ELLE EST DE FORME : mon message de commit disait « deux bancs devenus sans
  // objet retirés ». C’était VRAI des deux supprimés, et MUET sur le troisième — réécrit, qui a
  // laissé tomber une propriété. Un message doit nommer ce que la réécriture a PERDU, pas
  // seulement ce qu’elle a supprimé. Une suppression se voit au diff ; une réécriture, non.
  //
  // ⚠️ ON GARDE LA PROPRIÉTÉ, PAS LA LISTE DES STYLES. L’ancien banc figeait la composition
  // exacte à chaque hauteur, donc il rougissait sur tout remaniement innocent du corps. Ce qui
  // compte pour le dirigeant tient en deux phrases : à toute hauteur non nulle il voit COMMENT
  // SORTIR, et le titre ne passe jamais devant la sortie.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const etat = etatInitial();
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etat);
  const LARGE = 65; // au-dessus du seuil : la sortie TIENT, donc son absence est un défaut

  for (const hauteur of [1, 2, 3, 4, 5, 8, 20]) {
    const ecran = rendreEcran({ vue, etat, lignes, largeur: LARGE, hauteur });
    assert.equal(ecran.length, hauteur, `à ${hauteur} lignes de pane, l’écran en rend ${ecran.length}`);

    // ═══ ① LA SORTIE EST LÀ, À TOUTE HAUTEUR NON NULLE.
    const barre = ecran[ecran.length - 1];
    assert.ok(
      barre.texte.includes(RACCOURCI_VITAL),
      `à ${hauteur} lignes, « ${RACCOURCI_VITAL} » n’est pas sur la dernière ligne : ` +
        `${JSON.stringify(ecran.map((l) => l.texte))} — le dirigeant est enfermé dans un écran ` +
        'alternatif dont il ne connaît plus la sortie'
    );

    // ═══ ② ET ELLE EST LA DERNIÈRE — l’ordre de sacrifice va du moins vital au plus vital :
    // le CORPS cède d’abord, puis le TITRE, et le PIED reste. Une barre remontée au-dessus du
    // titre inverse silencieusement l’écran.
    assert.equal(barre.style, 'pied', `à ${hauteur} lignes, la dernière ligne est « ${barre.style} », pas le pied`);
    assert.equal(
      ecran.filter((l) => l.style === 'pied').length,
      1,
      `à ${hauteur} lignes, il y a ${ecran.filter((l) => l.style === 'pied').length} pieds`
    );

    // ═══ ③ LE TITRE CÈDE AVANT LA SORTIE, JAMAIS APRÈS.
    const titres = ecran.filter((l) => l.style === 'titre').length;
    if (hauteur === 1) {
      assert.equal(titres, 0, 'à 1 ligne, c’est la SORTIE qu’on garde, pas le titre');
    } else {
      assert.equal(titres, 1, `à ${hauteur} lignes, le titre doit être là une fois (il y en a ${titres})`);
      assert.equal(ecran[0].style, 'titre', `à ${hauteur} lignes, la PREMIÈRE ligne n’est pas le titre`);
    }
  }
});

test('LA BARRE MONTRE LE CHAMP DE RECHERCHE — le cas qu’une revue avait nommé À PART, et que j’ai laissé tomber', async (t) => {
  // 🔴 SECONDE PROPRIÉTÉ PERDUE PAR LA MÊME RÉÉCRITURE, et celle-ci est plus grave que l’autre :
  // elle avait été posée par une revue PRÉCÉDENTE, avec sa propre note — « ET LE CAS QUI A FUI,
  // NOMMÉ À PART : sans lui, un décor futur qui perdrait le mode recherche ferait retomber ce
  // banc sur les seuls états déjà gardés, sans que rien ne le dise. » J’ai retiré une garde
  // qu’une revue avait installée, et le commentaire qui expliquait pourquoi elle existait.
  //
  // Mesuré : neutraliser la branche `recherche` de `pied()` SURVIVAIT à la suite entière. Le
  // lecteur taperait « / », verrait la barre normale, et n’aurait aucun retour de ce qu’il tape.
  //
  // ⚠️ CE N’EST PAS UN DÉTAIL D’AFFICHAGE — c’est le SEUL retour visuel du mode recherche. Sans
  // lui, le mode est indiscernable d’un écran figé, et les touches semblent perdues.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const enRecherche = { ...etatInitial(), mode: 'recherche', recherche: 'somcraft' };
  const l3 = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), enRecherche);

  for (const largeur of [30, 40, 65, 120]) {
    const barre = rendreEcran({ vue, etat: enRecherche, lignes: l3, largeur, hauteur: 10 }).at(-1);
    assert.equal(barre.style, 'pied', `à ${largeur} colonnes, la dernière ligne n’est pas la barre`);
    assert.ok(
      barre.texte.includes('/'),
      `à ${largeur} colonnes, en mode recherche, la barre ne montre PAS le champ : ${JSON.stringify(barre.texte)}`
    );
    // ⚠️ ET ELLE MONTRE CE QUI EST TAPÉ, pas seulement la barre oblique — sinon un champ vidé
    // de son contenu passerait, et le lecteur ne verrait toujours pas ce qu’il écrit.
    if (largeur >= 40) {
      assert.ok(
        barre.texte.includes(enRecherche.recherche),
        `à ${largeur} colonnes, le terme tapé n’est pas à l’écran : ${JSON.stringify(barre.texte)}`
      );
    }
    // ⚠️ ET ELLE RESTE BORNÉE — c’est ce cas précis qui écrivait 43 caractères sur un pane de 30.
    assert.ok(
      largeurAffichee(barre.texte) <= largeur,
      `à ${largeur} colonnes, la barre de recherche écrit ${largeurAffichee(barre.texte)} caractères`
    );
  }
});

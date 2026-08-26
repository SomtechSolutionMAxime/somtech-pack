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
  depasseLaLargeurAutorisee,
  RACCOURCI_VITAL,
} from '../src/tui-vue-du-parc.js';
import { texteDeProgression, avecProgression } from '../src/tui-boucle.js';
import { unPaneDAgent } from './aide/formes-reelles.js';

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
      // 🔴 UNE SEULE EXCEPTION, NOMMÉE : la BARRE de raccourcis. Sous 9 colonnes, « q quitter »
      // ne peut pas tenir — et un contrat ANTÉRIEUR à ce lot exige qu'il soit rendu ENTIER
      // plutôt que tronqué, parce qu'un écran alternatif sans sortie enferme son lecteur.
      // L'arbitrage est écrit dans `rendreEcran`. Ce débordement ne peut PAS empiler : il vit
      // dans l'écran alternatif, repeint entier à chaque frame.
      //
      // ⚠️ L'EXCEPTION EST BORNÉE À CE CAS : elle ne vaut que pour le style `pied`, et
      // seulement sous la largeur où le raccourci vital tient.
      // 🔴 ON INTERROGE L'INVARIANT, ON NE RECOPIE PAS SON EXCEPTION (décision `f05bc613`,
      // condition n°1). Ce banc portait sa propre copie de la condition — donc l'exception
      // vivait à CÔTÉ de la règle, et quatre élargissements la désarmaient sans qu'un seul
      // essai ne bouge : borne supprimée, étendue au titre, étendue à toutes les lignes,
      // seuil porté de 9 à 40 — quatre fois VERT.
      assert.ok(
        !depasseLaLargeurAutorisee(l, largeur),
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
        // Même exception nommée que ci-dessus — la barre, sous la largeur de « q quitter ».
        // Même invariant interrogé, jamais recopié — voir la note ci-dessus.
        assert.ok(
          !depasseLaLargeurAutorisee(l, largeur),
          `à ${largeur}x${hauteur}, une ligne écrit ${largeurAffichee(l.texte)} caractères : ${JSON.stringify(l.texte)}`
        );
      }
    }
  }
});

test('LE CODE QUI ÉCRIT INTERROGE L’INVARIANT — un oracle que la production n’appelle pas ne garde rien', async (t) => {
  // 🔴 CE BANC EXISTE PARCE QUE J’AVAIS UN INVARIANT JUSTE, ÉPROUVÉ, ET JAMAIS CONSULTÉ.
  //
  // `depasseLaLargeurAutorisee` répondait correctement `true` sur le pied en mode recherche —
  // et `rendreEcran` recalculait sa PROPRE condition, plus large, qui laissait passer tout ce
  // que `pied()` rend. Mesuré (revue portail) : en mode recherche, sur un pane de 30 colonnes,
  // la barre écrivait 43 caractères et wrappait. C’était une RÉGRESSION de mon lot : sur
  // `origin/main`, `borner` s’appliquait sans condition.
  //
  // ⚠️ « L’exception vit DANS l’invariant » (décision `f05bc613`, condition n°1) était vrai dans
  // les bancs et FAUX dans le produit. Les deux oracles divergeaient, et seul celui que
  // personne n’appelait était gardé.
  //
  // ⚠️ ON MESURE DONC LE RENDU RÉEL CONTRE L’INVARIANT, sur TOUS les états de l’écran — c’est
  // la seule formulation qui ne peut pas diverger : si la production cesse d’interroger
  // l’invariant, les deux réponses se séparent et ce banc rougit.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));

  // ⚠️ LE MODE RECHERCHE EST LÀ PARCE QU’IL MANQUAIT — c’est l’état par lequel la régression est
  // passée. `pied()` y rend une branche entièrement indépendante de `raccourcisPour`.
  const etats = [
    { quoi: 'arbre', etat: etatInitial() },
    { quoi: 'filtre « non-pris seuls »', etat: { ...etatInitial(), nonPrisSeuls: true } },
    { quoi: 'mode RECHERCHE, terme court', etat: { ...etatInitial(), mode: 'recherche', recherche: 'a' } },
    { quoi: 'mode RECHERCHE, terme long', etat: { ...etatInitial(), mode: 'recherche', recherche: 'somcraft-cowork-espace-client' } },
    { quoi: 'mode RECHERCHE, terme vide', etat: { ...etatInitial(), mode: 'recherche', recherche: '' } },
  ];

  let mesurees = 0;
  for (const { quoi, etat: e } of etats) {
    const l2 = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), e);
    for (let largeur = 1; largeur <= 130; largeur += 1) {
      for (const ligne of rendreEcran({ vue, etat: e, lignes: l2, largeur, hauteur: 10 })) {
        mesurees += 1;
        assert.ok(
          !depasseLaLargeurAutorisee(ligne, largeur),
          `${quoi}, à ${largeur} colonnes : le rendu viole l’invariant que le code prétend suivre — ` +
            `${largeurAffichee(ligne.texte)} caractères de style « ${ligne.style} » : ${JSON.stringify(ligne.texte)}`
        );
      }
    }
  }
  assert.ok(mesurees > 1000, `ce banc doit mesurer un vrai écran — il n’a vu que ${mesurees} lignes`);

  // ⚠️ ET LE CAS QUI A FUI, NOMMÉ À PART : sans lui, un décor futur qui perdrait le mode
  // recherche ferait retomber ce banc sur les seuls états déjà gardés, sans que rien ne le dise.
  const enRecherche = { ...etatInitial(), mode: 'recherche', recherche: 'somcraft' };
  const l3 = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), enRecherche);
  const barre = rendreEcran({ vue, etat: enRecherche, lignes: l3, largeur: 30, hauteur: 10 }).at(-1);
  assert.equal(barre.style, 'pied', 'la dernière ligne est bien la barre');
  assert.ok(barre.texte.includes('/'), `en mode recherche, la barre montre le champ : ${JSON.stringify(barre.texte)}`);
  assert.ok(
    largeurAffichee(barre.texte) <= 30,
    `en mode recherche à 30 colonnes, la barre écrit ${largeurAffichee(barre.texte)} caractères — ` +
      'elle wrappe, et le champ de recherche n’a AUCUN lien avec le raccourci vital'
  );
});

test('L’EXCEPTION DE L’INVARIANT NE COUVRE QUE CE QU’ELLE NOMME — et elle ne s’élargit pas sans rougir', async (t) => {
  // 🔴 CE BANC EXISTE PARCE QUE L’EXCEPTION ÉTAIT DÉSARMABLE, ET QUE LA DÉPLACER N’A PAS SUFFI.
  //
  // Décision `f05bc613`, condition n°3 : « une exception qu’on peut élargir sans rougir n’est
  // pas une exception, c’est un trou avec un commentaire. » Mesuré AVANT ce banc — six
  // élargissements de `depasseLaLargeurAutorisee`, CINQ verts : l’exception étendue à toute
  // largeur, au titre, à toutes les lignes, avec un seuil écrit en dur à 40, ou décrochée du
  // manifeste. Rien ne bougeait.
  //
  // ⚠️ POURQUOI LES AUTRES BANCS NE POUVAIENT PAS L’ATTRAPER : ils demandent « aucune ligne ne
  // dépasse », et l’invariant leur répond « non » — plus l’exception est large, plus il répond
  // « non ». **Élargir une exception ne fait jamais rougir une garde qui l’interroge.** Il faut
  // une garde qui mesure l’exception ELLE-MÊME, sur les deux bords.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const etat = etatInitial();
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etat);
  const MINIMUM = [...RACCOURCI_VITAL].length;

  // ═══ BORD 1 — TOUT CE QUI EST EXCEPTÉ EST BIEN CE QUE LA RÈGLE NOMME.
  // Une ligne qui dépasse sans rougir DOIT être la barre, ET la largeur DOIT être sous le
  // seuil dérivé. Élargir l’exception (au titre, à toutes les lignes, à toute largeur) fait
  // apparaître ici une ligne exceptée qui ne remplit pas ces deux conditions.
  let exceptees = 0;
  for (let largeur = 1; largeur <= 130; largeur += 1) {
    for (const l of rendreEcran({ vue, etat, lignes, largeur, hauteur: 12 })) {
      if (largeurAffichee(l.texte) <= largeur) continue;
      exceptees += 1;
      assert.equal(
        l.style,
        'pied',
        `à ${largeur} colonnes, une ligne de style « ${l.style} » dépasse sans rougir — ` +
          'l’exception ne couvre QUE la barre de raccourcis'
      );
      assert.ok(
        largeur < MINIMUM,
        `à ${largeur} colonnes, la barre dépasse alors que le raccourci vital (${MINIMUM} ` +
          'caractères) y tiendrait — l’exception déborde de son seuil'
      );
      assert.ok(
        l.texte.includes(RACCOURCI_VITAL),
        `à ${largeur} colonnes, une ligne dépasse SANS porter le raccourci vital : ${JSON.stringify(l.texte)}`
      );
    }
  }

  // ⚠️ CONTRÔLE POSITIF — sans lui, tout ce qui précède serait vert sur un écran où RIEN ne
  // dépasse, c’est-à-dire sur rien du tout. C’est le défaut « une égalité vide », et il aurait
  // rendu ce banc inutile exactement comme les précédents.
  assert.ok(
    exceptees > 0,
    'aucune ligne n’a jamais été exceptée : ce banc ne mesure rien, et l’exception n’est pas gardée'
  );

  // ═══ BORD 2 — L’EXCEPTION NE S’APPLIQUE PAS LÀ OÙ ELLE N’A PAS LIEU D’ÊTRE.
  // Au-dessus du seuil, la barre est une ligne comme les autres : elle doit être refusée si
  // elle dépasse. Sans ce bord, « l’exception vaut pour TOUTE largeur » resterait vert.
  const barreTropLongue = { style: 'pied', texte: 'x'.repeat(200) };
  assert.ok(
    depasseLaLargeurAutorisee(barreTropLongue, MINIMUM),
    `à ${MINIMUM} colonnes (le seuil), une barre trop longue doit être REFUSÉE — l’exception ` +
      'ne vaut que STRICTEMENT en dessous'
  );
  assert.ok(
    depasseLaLargeurAutorisee(barreTropLongue, 120),
    'à 120 colonnes, une barre trop longue doit être refusée comme n’importe quelle ligne'
  );

  // ═══ BORD 3 — LES AUTRES STYLES NE SONT JAMAIS EXCEPTÉS, MÊME SOUS LE SEUIL.
  for (const style of ['titre', 'selection', 'arbre:epic', 'vide']) {
    assert.ok(
      depasseLaLargeurAutorisee({ style, texte: 'x'.repeat(50) }, 1),
      `une ligne de style « ${style} » qui dépasse doit être refusée, même à 1 colonne`
    );
  }

  // ═══ BORD 4 — LE SEUIL SUIT LE MANIFESTE, il n’est pas figé.
  // Si quelqu’un décroche le seuil du raccourci vital (littéral, ou autre nombre), la barre
  // cesse d’être exceptée à la bonne largeur — et c’est ce que cette assertion mesure.
  assert.equal(
    depasseLaLargeurAutorisee({ style: 'pied', texte: RACCOURCI_VITAL }, MINIMUM - 1),
    false,
    'juste sous le seuil, la barre portant le raccourci vital est exceptée'
  );
  assert.equal(
    depasseLaLargeurAutorisee({ style: 'pied', texte: RACCOURCI_VITAL + ' de trop' }, MINIMUM),
    true,
    'exactement au seuil, elle ne l’est plus'
  );

  // 🔴 ET CE QUI REND « ÉQUIVALENTE » LA DERNIÈRE MUTATION DE LA CAMPAGNE SE GARDE ICI.
  //
  // Réécrire le seuil en littéral (`'q quitter'.length` au lieu de `RACCOURCI_VITAL`) laisse la
  // suite verte — non par lacune de garde, mais parce que les deux valent le même nombre
  // AUJOURD'HUI. Verdict : mutation ÉQUIVALENTE, pas survivante.
  //
  // ⚠️ L'ÉQUIVALENCE REPOSE SUR UN FAIT, PAS SUR UNE PROPRIÉTÉ — c'est exactement ce que la
  // condition n°2 de la décision `f05bc613` refuse : « le jour où `q quitter` est renommé, un
  // seuil codé en dur devient faux EN SILENCE ». Ce banc rougit ce jour-là, et son message dit
  // au lecteur futur ce qu'il doit aller vérifier.
  assert.equal(
    RACCOURCI_VITAL,
    'q quitter',
    'le raccourci vital a été renommé : tout seuil écrit en littéral ailleurs dans le dépôt est ' +
      'désormais FAUX en silence — cherchez les copies et dérivez-les de `RACCOURCI_VITAL`'
  );
});

test('L’ÉCRAN GARDE SES BANDEAUX AUX PETITES HAUTEURS — ce qui rend le plancher de corps inobservable', async (t) => {
  // 🔴 UNE SECONDE MUTATION ÉQUIVALENTE, ET ELLE MÉRITE LE MÊME TRAITEMENT QUE LA PREMIÈRE.
  // Élargir le plancher de `hauteurCorps` (`max(1, …)` → `max(3, …)`) laisse la suite verte :
  // la borne de sortie tronque l’excédent, donc le plancher est INOBSERVABLE de l’extérieur.
  // Verdict : ÉQUIVALENTE, pas survivante.
  //
  // ⚠️ MAIS L’ÉQUIVALENCE REPOSE SUR LA TRONCATURE, PAS SUR UNE PROPRIÉTÉ DU PLANCHER. Le jour
  // où quelqu’un retire ou déplace cette troncature — un « nettoyage » qui a l’air d’une
  // simplification — le plancher redevient mordant, et le défaut du rejet portail se rouvre.
  //
  // ⚠️ CE BANC NE GARDE DONC PAS LE PLANCHER : il garde ce que le dirigeant VOIT aux petites
  // hauteurs, c’est-à-dire l’ORDRE dans lequel l’écran sacrifie ses parties. Une ligne de pane
  // montre le titre ; deux montrent le titre et une ligne d’arbre ; trois y ajoutent le pied.
  // C’est cet ordre qui rend le plancher sans effet, et c’est lui qui doit rougir s’il change.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const etat = etatInitial();
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etat);

  const stylesA = (hauteur) =>
    rendreEcran({ vue, etat, lignes, largeur: 65, hauteur }).map((l) => l.style.split(':')[0]);

  // 🔴 CE BANC VERROUILLAIT LE MAUVAIS ORDRE, et il le disait lui-même sans le voir : son
  // assertion à 3 lignes portait le commentaire « le pied apparaît — c'est lui qui porte les
  // raccourcis pour sortir », pendant que ses assertions à 1 et 2 lignes ENTÉRINAIENT son
  // absence. Relevé par une passe de fond.
  //
  // ⚠️ L'ORDRE DE SACRIFICE VA DU MOINS VITAL AU PLUS VITAL : le CORPS cède d'abord (il se
  // parcourt ligne à ligne, on peut y revenir), puis le TITRE (il dit où l'on est), et le PIED
  // reste le dernier — sans lui, le dirigeant ne sait plus SORTIR d'un écran alternatif.
  assert.deepEqual(stylesA(1), ['pied'], 'une ligne de pane : la SORTIE, pas le titre');
  assert.deepEqual(stylesA(2), ['titre', 'pied'], 'deux lignes : où l’on est, et comment sortir');
  assert.deepEqual(
    stylesA(3),
    ['titre', 'selection', 'pied'],
    'trois lignes : la ligne sélectionnée s’intercale entre les deux bandeaux'
  );
  assert.deepEqual(
    stylesA(5),
    ['titre', 'selection', 'arbre', 'arbre', 'pied'],
    'au-delà, le corps grandit entre les deux bandeaux'
  );

  // 🔴 ET LA GARANTIE QUI COMPTE VRAIMENT, ÉNONCÉE COMME TELLE PLUTÔT QUE DÉDUITE DE L'ORDRE :
  // « q quitter » est visible à TOUTE hauteur non nulle. Le fichier porte déjà cette règle pour
  // la LARGEUR — `RACCOURCIS_UN_A_UN` marque `q quitter` « le dernier qu'on retire, jamais le
  // premier ». Mon invariant de hauteur se disait « la jumelle verticale » de celui de largeur,
  // et il violait le principe qu'il jumelait.
  // 🔴 CE BALAYAGE NE PRENAIT QUE `[20, 40, 65, 120]` ET LE FILTRE INACTIF — deux choix commodes,
  // et le défaut vivait précisément dans ce qu'ils excluaient. Mesuré en revue portail : avec le
  // filtre `n` ACTIF, « q quitter » était absent de la barre pour TOUTE largeur de 1 à 36
  // colonnes. L'entête de filtre se servait en premier et laissait « ce qui reste » à la sortie.
  //
  // ⚠️ ON BALAIE DONC LA LARGEUR EN CONTINU **ET** LES ÉTATS DE FILTRE — c'est le produit des
  // deux qui casse, jamais l'un des deux seul.
  const etats = [
    { quoi: 'sans filtre', etat },
    { quoi: 'filtre « non-pris seuls »', etat: { ...etat, nonPrisSeuls: true } },
    { quoi: 'recherche active', etat: { ...etat, recherche: 'somcraft' } },
  ];
  // 9 = longueur de « q quitter ». En dessous, AUCUNE barre ne peut le dire : c'est une borne
  // physique, pas un choix — et le banc l'épingle pour qu'elle ne dérive pas en silence.
  // ⚠️ LE SEUIL SE DÉRIVE, IL NE S'ÉCRIT PAS (décision `f05bc613`, condition n°2) : le jour où
  // le raccourci vital est renommé, un `9` codé en dur devient faux EN SILENCE et cette garde
  // reste verte.
  const MINIMUM = [...RACCOURCI_VITAL].length;

  for (const { quoi, etat: e } of etats) {
    const l2 = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), e);
    for (let largeur = 1; largeur <= 130; largeur += 1) {
      for (const hauteur of [1, 2, 5, 24]) {
        const barre = rendreEcran({ vue, etat: e, lignes: l2, largeur, hauteur }).at(-1).texte;
        if (largeur >= MINIMUM) {
          assert.ok(
            barre.includes('q quitter'),
            `${quoi}, ${largeur}x${hauteur} : « q quitter » n’est nulle part — le dirigeant est ` +
              'enfermé dans un écran alternatif dont il ne connaît pas la sortie'
          );
        }
        // 🔴 ET « q quitter » EST LÀ MÊME SOUS LE MINIMUM — c'est un arbitrage assumé entre deux
        // invariants de ce dépôt qui se contredisent (voir `rendreEcran`) : la barre est la
        // SEULE ligne autorisée à déborder, parce qu'un écran alternatif dont l'aide ne dit
        // plus la sortie ENFERME son lecteur, alors qu'un débordement sur un pane de moins de
        // 9 colonnes se voit et se répare d'un coup d'œil.
        //
        // ⚠️ CE QUI RESTE FERMÉ — l'objet du rejet portail : le FRAGMENT. « q quitt… » ne dit
        // rien à qui ne connaît pas déjà la touche, c'est-à-dire exactement la personne coincée
        // qui lit cette barre. Ma propre première correction en produisait un.
        assert.ok(
          barre.includes('q quitter'),
          `${quoi}, ${largeur}x${hauteur} : « q quitter » manque ou est tronqué : ${JSON.stringify(barre)}`
        );
      }
    }
  }
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

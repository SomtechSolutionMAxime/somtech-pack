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
import { arbreDeLaVue, lignesVisibles, rendreEcran, etatInitial } from '../src/tui-vue-du-parc.js';
import { texteDeProgression } from '../src/tui-boucle.js';
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

  for (const hauteur of [3, 12, 24, 77]) {
    const ecran = rendreEcran({ vue, etat, lignes, largeur: 65, hauteur });
    assert.equal(ecran.length, hauteur, `à ${hauteur} lignes de pane, l’écran en rend ${ecran.length}`);
  }
});

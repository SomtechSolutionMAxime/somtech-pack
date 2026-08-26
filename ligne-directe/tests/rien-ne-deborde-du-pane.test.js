// RIEN DE CE QUE LE TUI ÉCRIT NE DÉPASSE LA LARGEUR DU PANE — T-20260825-0071.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 L'INCIDENT, RAPPORTÉ PAR LE DIRIGEANT EN USAGE RÉEL
//
// « j'ai des lignes qui se multiplient sans arrêt » — `ligne-directe vue --tui`, dans un split
// herdr. Reproduit dans un vrai pane de 65 colonnes, écran lu par `herdr pane read` :
// **+21 lignes en 8 secondes**, pendant les ~80 s de chargement.
//
// LA CAUSE, MESURÉE : `avecProgression` réécrit la ligne toutes les 120 ms avec `\r` +
// effacement de ligne. Sous la longueur du texte, il WRAPPE : le curseur passe à la ligne
// suivante, donc le `\r` du tour d'après revient au début de la NOUVELLE ligne et l'effacement
// porte sur celle-là. La précédente reste.
//
// ⚠️ ET LE SEUIL EST UNE PLAGE, PAS UN NOMBRE — c'est ce qui rend ce défaut coûteux à chercher.
// La longueur varie avec le NOMBRE DE CHIFFRES du compteur : 115 caractères de 0 à 9 secondes,
// 116 de 10 à 99, 117 au-delà. Sous 115 colonnes ça empile systématiquement ; entre 115 et 117,
// ça se met à empiler EN COURS DE ROUTE, quand le compteur passe à deux chiffres puis à trois.
//
// 🔴 QUELQU'UN QUI TESTE À 116 COLONNES PENDANT LES NEUF PREMIÈRES SECONDES NE VOIT RIEN, et
// conclut que le défaut n'existe pas. Un défaut qu'on ne voit pas quand on le cherche mal coûte
// plus cher qu'un défaut franc.
//
// ⚠️ CETTE PROSE A DIT « 116 caractères, longueur fixe » — une constante INVENTÉE, dans un
// commentaire qu'aucune garde ne peut atteindre. Deuxième fois dans ce lot.
//
// ⚠️ POURQUOI PERSONNE NE L'AVAIT VU : en pane large la ligne tient. Le symptôme n'existe QUE
// dans un pane étroit — c'est-à-dire exactement l'écran du dirigeant.
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
// CE CONTRE QUOI CES BANCS MESURENT — ANCRÉ OU DÉRIVÉ, ET CHAQUE LIGNE MESURÉE
//
// 🔴 UNE GARDE QUI MESURE CONTRE UNE VALEUR DÉRIVÉE DE LA PRODUCTION SUIT LA MUTATION AU LIEU
// DE L'ATTRAPER. Mesuré : poser `vital: 1` sur un second raccourci déplaçait `RACCOURCI_VITAL`
// vers « ↑↓ naviguer » ; la barre l'affichait, la SORTIE DISPARAISSAIT DE L'ÉCRAN, et la suite
// restait verte — parce que toutes mes assertions cherchaient `RACCOURCI_VITAL`, donc la chose
// déplacée. Elles prouvaient que le code s'accorde avec lui-même.
//
// ⚠️ C'EST LA TROISIÈME FORME DU MÊME MOTIF SUR CE LOT, ET LA PLUS DURE À VOIR :
//     l'oracle sans appelant     → garde INERTE    (elle ne mesure plus rien)
//     l'assertion non déclenchée → garde MUETTE    (elle ne s'exécute pas)
//     la dérivation              → garde COMPLICE  (elle s'exécute, passe, et bénit la mutation)
// Les deux premières se trouvent en cherchant du vert suspect ; la troisième ressemble en tout
// point à une garde qui travaille.
//
// LA QUESTION QUI TRANCHE, pour chaque valeur contre laquelle on mesure : **si je déplace sa
// définition dans la production, est-ce que l'assertion suit ?** Si oui, elle n'ancre rien.
//
//   valeur                     d'où elle vient              verdict, MESURÉ PAR MUTATION
//   ─────────────────────────  ───────────────────────────  ────────────────────────────────────
//   largeurAffichee            définie DANS ce banc (l.~99)  ANCRÉE — la production ne la fournit
//                                                            pas, donc rien ne peut la déplacer
//   rangeesNonVides            `tests/aide/terminal.js`      ANCRÉE — écrite côté banc. C'est un
//                                                            double, et sa note dit ce qu'il est ;
//                                                            il n'est plus branché que sur la
//                                                            progression, où le défaut existe
//   RACCOURCI_VITAL            production, DÉRIVÉ            était COMPLICE ; ancré depuis par
//                                                            « LE FAIT EST ANCRÉ, PAS DÉRIVÉ »
//   SEUIL                      dérivé de RACCOURCI_VITAL     ancré par transitivité — et il DOIT
//                                                            rester dérivé : écrit `9`, il
//                                                            deviendrait faux en silence
//   RACCOURCIS (la maquette)   production, DÉRIVÉ            ANCRÉE par le `assert.match` littéral
//                                                            de `le-tui-de-la-vue-du-parc.test.js`
//                                                            — mesuré : changer le séparateur rougit
//   RACCOURCIS_UN_A_UN         production                    lu contre un littéral dans le banc
//                                                            d'ancrage — c'est là que le fait vit
//   etatInitial()              production                    non ancré, mais NON COMPLICE : le
//                                                            déplacer rougit largement (mesuré)
//   styles 'titre' / 'pied'    littéraux dans les bancs      ANCRÉS
//
// ⚠️ DÉRIVER N'EST PAS LE DÉFAUT — c'est ce qui évite qu'un seuil écrit en chiffre pourrisse. Le
// défaut est une chaîne de dérivations qui n'est ANCRÉE NULLE PART. Il faut un point, un seul,
// où le fait s'écrit en toutes lettres : c'est « LE FAIT EST ANCRÉ, PAS DÉRIVÉ ».
// ═══════════════════════════════════════════════════════════════════════════════════════

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
//   🔴 CETTE LIGNE ÉTAIT FAUSSE, ET SA FAUSSETÉ A COÛTÉ DEUX PROPRIÉTÉS. Elle disait « toutes
//   ses assertions → SANS OBJET : elles mesuraient le drapeau `porteLaSortie` ». J'avais écrit
//   ce que je croyais être l'INTENTION du banc au lieu de ce qu'il ASSERTAIT. Ouvert et relu,
//   il n'asserte le drapeau NULLE PART — il asserte ceci, et les deux vivent encore :
//     raccourcisPour(l).includes(RACCOURCI_VITAL), l de 0 à 200
//                                               → PERDU, restauré : « LA BARRE NE SE VIDE JAMAIS »
//     minima.length === 1                       → PERDU, restauré : « LE FAIT EST ANCRÉ… »
//     minima[0].texte === RACCOURCI_VITAL       → idem
//
//   ⚠️ D'OÙ LA RÈGLE DE CE TABLEAU : chaque ligne n'affirme que ce qui est VÉRIFIABLE EN
//   OUVRANT LE BANC CITÉ — son nom, son fichier, ce qu'il asserte LITTÉRALEMENT. Jamais ce
//   qu'il « mesure » au sens de son intention : c'est exactement là que je me suis trompé, et
//   une ligne de tableau fausse se lit comme une ligne vraie.
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
  tronquer,
  texteDeLigne,
} from '../src/tui-vue-du-parc.js';
import { texteDeProgression, avecProgression } from '../src/tui-boucle.js';
import { unPaneDAgent } from './aide/formes-reelles.js';
import { readFileSync } from 'node:fs';
import { rangeesNonVides, ecranApresEcritures } from './aide/terminal.js';

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
      //
      // 🔴 CE BANC PASSAIT PAR LE MODÈLE DE TERMINAL, ET C’ÉTAIT INUTILE — mesuré, pas relu.
      // `rendreEcran` fait passer CHAQUE ligne par `borner`, qui rend exactement `largeur`
      // caractères. Donc `ceil(longueur / colonnes)` vaut 1 par construction, et le nombre de
      // rangées physiques ÉGALE le nombre de lignes, identiquement : zéro divergence sur 80
      // couples, 8×2 compris — le cas même que ce banc citait comme sa justification.
      //
      // ⚠️ C’ÉTAIT UNE QUATRIÈME FORME DE FAUSSE GARDE : ni inerte (elle s’exécutait), ni
      // complice (elle ne suivait aucune valeur déplacée) — un double bâti pour une classe de
      // défaut que le correctif voisin avait rendue IRREPRODUCTIBLE là où on le branchait.
      // Le modèle n’a pas été retiré du dépôt : il a été DÉPLACÉ là où le défaut est encore
      // atteignable — la ligne de progression, qui ne passe pas par `borner`. Voir
      // « LA PROGRESSION N’EMPILE PAS », qui reproduit l’incident du dirigeant.
      declenche.hauteur += 1;
      assert.equal(
        ecran.length,
        rows,
        `à ${cols}×${rows}, l’écran rend ${ecran.length} lignes`
      );
      for (const l of ecran) {
        assert.ok(
          largeurAffichee(l.texte) <= cols,
          `à ${cols}×${rows}, une ligne écrit ${largeurAffichee(l.texte)} caractères : ${JSON.stringify(l.texte)}`
        );
      }

      const vu = ecran.map((l) => l.texte).join('\n');
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

test('LE PIED TIENT SES DEUX SENS — la sortie ne cède jamais, ET l’entête reste quand elle tient', async (t) => {
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

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 CE PIVOT ÉTAIT DÉRIVÉ, DONC COMPLICE — ET LA MUTATION L'A PROUVÉ, PAS MA PROSE.
  //
  // Ma version précédente DEMANDAIT au pied à partir de quelle largeur il porte son entête :
  // elle balayait jusqu'à la première où l'entête apparaît, et appelait ça le pivot. Le motif
  // avait l'air excellent — refaire l'arithmétique de `pied()` à côté de lui recopie la règle,
  // et le banc et le code se trompent alors ENSEMBLE.
  //
  // Mais lire le pivot dans la sortie qu'on juge est PIRE : si le code déplace sa frontière, le
  // pivot mesuré se déplace AVEC elle, et l'assertion tient toujours. Mesuré : muter la
  // comparaison de `pied()` de `>` en `>=` restait SURVIVANTE dans le commit même qui prétendait
  // fermer cette frontière.
  //
  // ⚠️ LA SOUS-FORME QUE ÇA M'A APPRISE : j'avais gardé le DÉCLENCHEMENT, pas la VALEUR. Mon
  // contrôle vérifiait que le pivot tombe DANS le balayage — donc que la branche s'exécute — et
  // rien de plus. Une assertion peut être vraie, se déclencher, porter sur le rendu réel, et
  // SUIVRE le code quand il bouge.
  //
  // LA FORME QUI TIENT : le pivot se COMPOSE de faits ancrés, chacun écrit ici, à sa source.
  // Si quelqu'un change le libellé du filtre ou le raccourci vital, CE BANC rougit — et c'est
  // voulu : un tel changement doit passer par quelqu'un qui décide, pas glisser.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const ENTETE_ATTENDUE = {
    'filtre « non-pris seuls »': 'FILTRE : non-pris seuls',
    'recherche active': 'RECHERCHE : « somcraft »',
  };
  const SEPARATEUR_DENTETE = '  ─  ';

  const pivotDe = (quoi) => {
    const libelle = ENTETE_ATTENDUE[quoi];
    if (libelle === undefined) return undefined;
    // ⚠️ ON COMPOSE : l'entête entière (libellé + son séparateur) PLUS le raccourci vital, lu à
    // sa source. Aucun des deux nombres n'est écrit ici — ils sont mesurés sur les textes eux-mêmes.
    return libelle.length + SEPARATEUR_DENTETE.length + RACCOURCI_VITAL.length;
  };

  // ⚠️ CONTRÔLE : les libellés que ce banc ancre doivent être CEUX QUE LE PIED REND. Sans ça,
  // l'ancrage porterait sur un texte imaginaire et le banc mesurerait à côté — juste, déclenché,
  // et hors sujet.
  for (const { quoi, etat: e } of avecEntete) {
    const libelle = ENTETE_ATTENDUE[quoi];
    if (libelle === undefined) continue;
    const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), e);
    const large = rendreEcran({ vue, etat: e, lignes, largeur: 130, hauteur: 8 }).at(-1).texte;
    assert.ok(
      large.includes(libelle),
      `ce banc ancre l’entête « ${libelle} » pour « ${quoi} », et le pied ne la rend pas : ` +
        `${JSON.stringify(large.trimEnd())} — l’ancrage vise un texte qui n’existe pas`
    );
  }

  let mesurees = 0;
  for (const { quoi, etat: e } of avecEntete) {
    const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), e);
    for (let largeur = SEUIL; largeur <= 140; largeur += 1) {
      const ecran = rendreEcran({ vue, etat: e, lignes, largeur, hauteur: 8 });
      const pied = ecran[ecran.length - 1].texte;
      mesurees += 1;
      // ═══ SENS ① — LA SORTIE NE CÈDE JAMAIS. C'est le défaut d'origine : l'entête se servait
      // en premier et laissait « ce qui reste » à la sortie.
      assert.ok(
        pied.includes(RACCOURCI_VITAL),
        `${quoi}, à ${largeur} colonnes : « ${RACCOURCI_VITAL} » TIENDRAIT et le pied ne le porte pas — ` +
          `l’entête a pris la place de la sortie : ${JSON.stringify(pied)}`
      );

      // ═══ SENS ② — ET L'ENTÊTE RESTE QUAND ELLE TIENT. C'est le sens que ce banc NE GARDAIT PAS.
      //
      // 🔴 SON NOM DISAIT DÉJÀ LEQUEL DES DEUX IL GARDAIT : « la sortie survit à toute entête ».
      // Il n'a jamais promis plus que son titre — c'est nous qui avons lu « la frontière est
      // gardée ». Une garde dont le nom porte UN sens annonce elle-même que l'autre est ouvert.
      //
      // ⚠️ MESURÉ : à la largeur PIVOT — celle où l'entête et la sortie tiennent tout juste —
      // muter la comparaison de `pied()` de `>` en `>=` efface l'entête alors qu'elle TIENT, et
      // la suite entière restait VERTE. Le lecteur garde sa sortie, l'arbre continue de filtrer,
      // et plus rien ne le dit — ce que le code déclare inacceptable trois lignes plus haut.
      const pivot = pivotDe(quoi);
      if (pivot !== undefined) {
        const libelle = ENTETE_ATTENDUE[quoi];
        // ⚠️ ON ASSERTE LES DEUX CÔTÉS DU PIVOT, et c'est ça qui met la frontière en cause. Un
        // seul côté laisse la frontière libre de glisser d'un cran : c'est exactement ce qui
        // survivait. Au pivot EXACT, l'entête et la sortie tiennent tout juste — donc les deux
        // doivent être là.
        if (largeur >= pivot) {
          assert.ok(
            pied.includes(libelle),
            `${quoi}, à ${largeur} colonnes : l’entête TIENT (pivot ancré à ${pivot}) et elle n’est ` +
              `PAS là — la sortie a pris sa place, et l’arbre filtre sans le dire : ${JSON.stringify(pied.trimEnd())}`
          );
        } else {
          assert.ok(
            !pied.includes(libelle),
            `${quoi}, à ${largeur} colonnes : l’entête NE TIENT PAS (pivot ancré à ${pivot}) et elle ` +
              `est là quand même — elle mange la place de la sortie : ${JSON.stringify(pied.trimEnd())}`
          );
        }
      }
    }
  }
  assert.ok(mesurees > 300, `ce banc doit balayer les largeurs — il n’en a vu que ${mesurees}`);

  // ⚠️ ET LES DEUX CÔTÉS SE DÉCLENCHENT VRAIMENT — sinon on aurait remplacé une assertion
  // unilatérale par une assertion morte, ce que ce fichier a déjà payé une fois.
  for (const { quoi } of avecEntete) {
    const pivot = pivotDe(quoi);
    if (pivot === undefined) continue;
    assert.ok(
      pivot > SEUIL && pivot < 140,
      `le pivot ancré de « ${quoi} » vaut ${pivot} : hors du balayage, un des deux côtés ne s’éprouve jamais`
    );
  }
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
  // La seconde survivante efface ENTIÈREMENT la sortie d’un écran de 2 lignes, et la suite restait
  // verte. C’est le défaut que ce lot avait fermé deux jours plus tôt, rouvert par une réécriture
  // qui améliorait autre chose.
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

test('LE FAIT EST ANCRÉ, PAS DÉRIVÉ — sinon les gardes suivent la mutation au lieu de l’attraper', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 LE DÉFAUT LE PLUS DUR À VOIR DE TOUT CE CHANTIER, ET SA FORME EST NEUVE.
  //
  // Tous mes bancs vérifiaient la présence de `RACCOURCI_VITAL`. Il est **DÉRIVÉ** de la
  // production : `RACCOURCIS_UN_A_UN.reduce(…)`. Mesuré par mutation — poser `vital: 1` sur un
  // SECOND raccourci :
  //
  //     RACCOURCI_VITAL devient « ↑↓ naviguer »
  //     la barre à 12 colonnes affiche « ↑↓ naviguer »
  //     LA SORTIE A DISPARU DE L'ÉCRAN
  //     suite : 0 fail
  //
  // La mutation DÉPLACE la définition, et toutes mes assertions la SUIVENT. Elles prouvaient que
  // le code s'accorde avec lui-même — jamais que la sortie est « q quitter ».
  //
  // ⚠️ C'EST LA TROISIÈME FORME DU MÊME MOTIF SUR CE LOT, ET LA PIRE :
  //   • l'oracle sans appelant laissait une garde INERTE (elle ne mesurait plus rien) ;
  //   • l'assertion jamais déclenchée laissait une garde MUETTE (elle ne s'exécutait pas) ;
  //   • la dérivation laisse une garde ACTIVE ET COMPLICE — elle s'exécute, elle passe, et elle
  //     bénit la mutation. Les deux premières se voient en cherchant du vert suspect. Celle-ci
  //     ressemble en tout point à une garde qui fait son travail.
  //
  // ⚠️ CE BANC EST DONC LE SEUL DU FICHIER QUI A LE DROIT D'ÉCRIRE LE TEXTE EN TOUTES LETTRES.
  // Partout ailleurs, dériver reste juste — c'est ce qui évite qu'un seuil écrit `9` devienne
  // faux en silence. Mais une chaîne de dérivations doit être ANCRÉE quelque part, une fois,
  // ou elle ne dit rien. Ici est cet endroit.
  //
  // ⚠️ ET IL DOIT ROUGIR SI ON RENOMME LE RACCOURCI — c'est voulu, pas un inconvénient. Un
  // renommage légitime passe par ce banc, donc par quelqu'un qui décide sciemment que la sortie
  // du dirigeant s'appelle désormais autrement. Ce qu'on ne veut pas, c'est que ça glisse.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  assert.equal(
    RACCOURCI_VITAL,
    'q quitter',
    'la sortie du dirigeant a changé de nom. Si c’est voulu, mets-la à jour ICI — c’est le seul ' +
      'endroit du fichier qui l’écrit, et c’est exprès. Si ce n’est pas voulu, quelqu’un a ' +
      'déplacé la vitalité minimale dans `RACCOURCIS_UN_A_UN` et la sortie a disparu de l’écran.'
  );

  // ⚠️ ET LA DÉRIVATION DOIT ÊTRE DÉTERMINISTE : deux raccourcis à vitalité minimale égale, et
  // « lequel survit » devient l’ordre de la liste, c’est-à-dire un hasard. C’est exactement la
  // mutation ci-dessus. Le banc supprimé du lot gardait ce point ; je l’avais classé « sans
  // objet » à tort, et il a fallu le remesurer pour s’en apercevoir.
  const plancher = Math.min(...RACCOURCIS_UN_A_UN.map((r) => r.vital));
  const minima = RACCOURCIS_UN_A_UN.filter((r) => r.vital === plancher);
  assert.equal(
    minima.length,
    1,
    `${minima.length} raccourcis partagent la vitalité minimale (${JSON.stringify(minima.map((r) => r.texte))}) — ` +
      'lequel survit devient l’ordre de la liste, donc un hasard, et `RACCOURCI_VITAL` peut ' +
      'désigner autre chose que la sortie'
  );
  assert.equal(minima[0].texte, RACCOURCI_VITAL, 'et c’est bien celui que `RACCOURCI_VITAL` dérive');
});

test('LA BARRE NE SE VIDE JAMAIS — sous le seuil B dit TRONQUER, elle n’a jamais dit EFFACER', async (t) => {
  // 🔴 SECONDE PROPRIÉTÉ QUE J’AVAIS CLASSÉE « SANS OBJET » À TORT. Mesuré : passer la borne de
  // la boucle de retrait de `> 1` à `> 0` vide la barre entièrement — à 5 colonnes,
  // `raccourcisPour(5)` rend la chaîne VIDE. Suite verte, 0 fail.
  //
  // ⚠️ POURQUOI AUCUN BANC NE LE VOYAIT : au-dessus du seuil ils exigent la sortie, et elle y
  // est encore (à 9 colonnes la barre rend toujours « q quitter »). SOUS le seuil ils n’exigent
  // que l’impossibilité de la montrer entière. Entre les deux, personne ne demandait qu’il reste
  // QUELQUE CHOSE. Un trou entre deux gardes justes — la jointure, pas les étages.
  //
  // ⚠️ ET LA DÉCISION NE L’AUTORISE PAS : `00a7b645` dit que la barre se TRONQUE. Une barre
  // effacée n’est pas une barre tronquée — le lecteur d’un pane minuscule passe de « q qu… »,
  // dont il peut deviner la touche, à une ligne vide qui ne dit rien du tout.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const vue = await uneVue(poserLieu(join(tmp, 'depot'), 'p-20260822-0001'));
  const etat = etatInitial();
  const lignes = lignesVisibles(arbreDeLaVue(vue, { parApp: true }), etat);

  for (let largeur = 1; largeur <= 40; largeur += 1) {
    // ═══ ① LA COMPOSITION garde toujours au moins un raccourci, entier.
    const barre = raccourcisPour(largeur);
    assert.ok(
      barre.length > 0,
      `à ${largeur} colonnes, \`raccourcisPour\` rend une chaîne VIDE — la barre s’efface au lieu ` +
        'de se tronquer, et le lecteur n’a plus rien du tout'
    );

    // ═══ ② ET CE QUI RESTE EST LE PLUS VITAL, pas n’importe lequel.
    assert.ok(
      barre.includes(RACCOURCI_VITAL),
      `à ${largeur} colonnes, ce qui reste de la barre est ${JSON.stringify(barre)} — ce n’est pas la sortie`
    );

    // ═══ ③ ET À L’ÉCRAN, LA LIGNE DU PIED N’EST JAMAIS VIDE NON PLUS — la troncature de
    // `rendreEcran` ne doit pas produire ce que la composition refuse de produire.
    const pied = rendreEcran({ vue, etat, lignes, largeur, hauteur: 6 }).at(-1);
    assert.ok(
      pied.texte.trim().length > 0,
      `à ${largeur} colonnes, la ligne du pied est vide à l’écran : ${JSON.stringify(pied.texte)}`
    );
  }
});

test('LA PROGRESSION N’EMPILE PAS — l’incident du dirigeant, reproduit puis fermé', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 C’EST L’INCIDENT LUI-MÊME, ET C’EST LE SEUL BANC DU DÉPÔT QUI L’ATTEINT.
  //
  // Rapporté en usage réel : « j’ai des lignes qui se multiplient sans arrêt », TUI dans un
  // split herdr. Mesuré alors dans un vrai pane : **+21 lignes en 8 secondes** à 65 colonnes.
  //
  // La cause : `avecProgression` écrit DROIT au terminal — retour chariot, effacement de rangée,
  // puis un texte de 115 à 117 caractères selon le compteur — le seuil de wrap est une PLAGE, pas
  // un nombre, et entre 115 et 117 l'écran se met à empiler EN COURS DE ROUTE. Sous sa longueur
  // le texte wrappe ; le retour chariot
  // du tour suivant revient au début de la rangée physique COURANTE (la seconde) et l’effacement
  // ne nettoie que celle-là. La première reste, définitivement. Une de plus toutes les 120 ms.
  //
  // ⚠️ CE CHEMIN NE PASSE PAS PAR `borner`. C’est ce qui le distingue de tout le reste de ce
  // fichier, et c’est pourquoi le modèle de terminal y est IRREMPLAÇABLE : le défaut est une
  // histoire de CURSEUR — où le retour chariot atterrit, ce que l’effacement nettoie — et aucun
  // compte de longueurs ne peut le voir. Sur le chemin de `rendreEcran`, à l’inverse, ce même
  // modèle ne pouvait plus rien attraper (`borner` y rend la largeur exacte) : il y a été retiré.
  //
  // ⚠️ ET LE DOUBLE A DÛ ÊTRE CORRIGÉ POUR ÇA. Sa première version descendait d’une rangée dès
  // la dernière colonne atteinte ; elle affirmait donc que la version CORRIGÉE empilait encore.
  // Un vrai terminal ARME un report et ne descend qu’au caractère imprimable suivant — un retour
  // chariot le désarme. Sans ce détail, le double contredisait le pane réel : il aurait fabriqué
  // un défaut au lieu d’en trouver un.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const ESC = String.fromCharCode(27);
  const TOURS = 20;
  const battement = (largeur) =>
    Array.from({ length: TOURS }, (_, i) => `\r${ESC}[2K${texteDeProgression(20 + i, i, largeur)}`);

  // ═══ ① CONTRÔLE POSITIF — SANS LA BORNE, LE DÉFAUT SE REPRODUIT. Sans cette moitié, ce banc
  // serait vert sur un instrument incapable de voir quoi que ce soit.
  const sansBorne = Array.from({ length: TOURS }, (_, i) => `\r${ESC}[2K${texteDeProgression(20 + i, i)}`);
  assert.ok(
    rangeesNonVides(sansBorne, 65, 300) > TOURS,
    'le décor doit REPRODUIRE l’incident : sans borne, à 65 colonnes, la progression doit empiler ' +
      `— ce modèle n’en voit que ${rangeesNonVides(sansBorne, 65, 300)} rangées, il ne mesure rien`
  );

  // ═══ ② ET AVEC LA BORNE, À TOUTE LARGEUR, UNE SEULE RANGÉE. C’est la propriété que le
  // dirigeant voit : l’écran ne se remplit pas pendant les ~80 s de chargement.
  for (const largeur of [200, 150, 120, 116, 115, 100, 80, 65, 57, 40, 27, 20, 12, 5, 1]) {
    const vues = rangeesNonVides(battement(largeur), largeur, 300);
    assert.equal(
      vues,
      1,
      `à ${largeur} colonnes, ${TOURS} tours de progression laissent ${vues} rangées écrites — ` +
        'elles S’EMPILENT, exactement l’incident rapporté par le dirigeant'
    );
  }
});

test('LE DOUBLE DU TERMINAL EST CONFRONTÉ À UN VRAI ÉMULATEUR — et chaque capacité qu’il déclare a son cas', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 CE BANC EXISTE PARCE QUE LE DOUBLE A DIVERGÉ DEUX FOIS, MESURÉES.
  //
  //   ① il descendait d’une rangée dès la dernière colonne atteinte — il affirmait donc que la
  //      progression CORRIGÉE empilait encore, alors qu’un vrai pane herdr en montre UNE ligne.
  //      Le double contredisait le réel, et c’est LUI qui avait tort.
  //   ② il traitait l’effacement `[K` (de la colonne courante à la fin) comme `[2K` (la rangée
  //      entière), donc il emportait le texte à gauche du curseur.
  //
  // ⚠️ NI L’UN NI L’AUTRE N’A ÉTÉ TROUVÉ PAR RELECTURE. Le second est sorti d’un TIRAGE
  // DIFFÉRENTIEL contre un vrai émulateur — 400 séquences aléatoires mêlant texte, retours
  // chariot, sauts de ligne et effacements. Mes propres cas, choisis à la main, contenaient
  // ceux auxquels j’avais pensé ; le défaut était dans ceux auxquels je n’avais pas pensé.
  // C’est la MÉTHODE qui a trouvé, pas l’attention.
  //
  // ⚠️ POURQUOI CE DOUBLE DOIT ÊTRE GARDÉ SI SÉVÈREMENT, alors qu’un autre ne le serait pas :
  // sur le chemin de `rendreEcran` il n’était qu’un SECOND instrument — la mesure directe des
  // largeurs tenait sans lui. Sur la ligne de progression, il n’y a PAS de mesure directe : elle
  // n’est pas bornée par `borner`, elle est écrite droit au terminal. **Il y est le seul
  // instrument.** Un instrument unique qui a divergé deux fois ne se garde pas sur parole.
  //
  // ⚠️ LES PAIRES SONT CAPTURÉES DEPUIS L’ÉMULATEUR ET VERSIONNÉES — `terminal-cas-pyte.json`.
  // Elles se rejouent ici SANS dépendance : la suite reste éprouvable sur un poste nu. Les
  // regénérer demande l’émulateur ; les vérifier, non.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const cas = JSON.parse(readFileSync(new URL('./aide/terminal-cas-pyte.json', import.meta.url), 'utf8'));

  // ═══ ① CE QUE LA NOTE DU DOUBLE DÉCLARE COMPRENDRE — et rien ne peut y entrer sans son cas.
  //
  // 🔴 MA NOTE A DÉJÀ MENTI, ET DEUX FOIS DE SUITE SUR LE MÊME MODE. Elle énumérait le saut de
  // ligne parmi ce qu’elle comprenait ; il était FAUX. Une capacité listée sans cas en regard se
  // lit comme vérifiée par quelqu’un — c’est la forme la plus discrète de ce chantier : une
  // description juste d’intention, fausse de fait, dans un document écrit pour protéger.
  //
  // LA FORME QUI FERME ÇA : **ce qu’une note énumère, un cas l’éprouve.** Ajouter une ligne à
  // cette liste sans capturer son cas fait ROUGIR ce banc.
  const DECLARE = [
    'auto-wrap',
    'ligne vide',
    'retour chariot',
    'retour chariot désarme le report',
    'saut de ligne',
    'le report survit au saut de ligne',
    'report armé puis imprimable',
    'effacement de rangée',
    'défilement',
    'ESC avalé avec son caractère',
  ];
  const couverts = new Set(cas.map((c) => c.quoi));
  for (const capacite of DECLARE) {
    assert.ok(
      couverts.has(capacite),
      `la note du double déclare comprendre « ${capacite} » et AUCUN cas ne l’éprouve — ` +
        'une capacité annoncée sans cas se lit comme vérifiée par quelqu’un. Capture-la depuis ' +
        'l’émulateur, ou retire-la de la liste.'
    );
  }

  // ═══ ② ET LE TIRAGE EST LÀ, EN NOMBRE. Sans lui, ce banc ne couvrirait que ce à quoi j’ai
  // pensé — c’est-à-dire pas le défaut.
  const tirages = cas.filter((c) => c.quoi === 'tirage').length;
  assert.ok(
    tirages >= 200,
    `le corpus ne porte que ${tirages} tirages différentiels — c’est le tirage qui a trouvé le ` +
      'second défaut, pas les cas choisis à la main'
  );

  // ═══ ③ AUCUN ÉCART. Une seule divergence et le double est suspect, pas le code.
  const ecarts = [];
  for (const c of cas) {
    const rendu = ecranApresEcritures(c.ecrits, c.cols, c.rows).map((l) => l.replace(/\s+$/, ''));
    const attendu = c.attendu.map((l) => l.replace(/\s+$/, ''));
    if (JSON.stringify(rendu) !== JSON.stringify(attendu)) {
      ecarts.push(`${c.quoi} · ${c.cols}×${c.rows} · ${JSON.stringify(c.ecrits)}\n` +
        `      émulateur : ${JSON.stringify(attendu)}\n      double    : ${JSON.stringify(rendu)}`);
    }
  }
  assert.deepEqual(
    ecarts,
    [],
    `le double diverge de l’émulateur sur ${ecarts.length} cas sur ${cas.length} :\n    ` +
      ecarts.slice(0, 3).join('\n    ')
  );
});

test('LE DOUBLE REPRODUIT ENCORE L’INCIDENT — un double qui ne reproduit plus ne prouve plus rien', () => {
  // 🔴 LA MOITIÉ QU’ON OUBLIE. Un double corrigé jusqu’à ne plus rien voir rend vert pour rien.
  // Ce banc garde la capacité de REPRODUIRE le défaut connu, séparément de la propriété qui le
  // ferme — parce que les deux peuvent se perdre indépendamment.
  //
  // Mesuré dans un vrai pane herdr, à 65 colonnes : +21 lignes en 8 secondes avant le correctif.
  const ESC = String.fromCharCode(27);
  const sansBorne = Array.from({ length: 20 }, (_, i) => `\r${ESC}[2K${texteDeProgression(20 + i, i)}`);

  // Au-dessus de la longueur du message, rien ne wrappe : une seule rangée, avant comme après.
  assert.equal(rangeesNonVides(sansBorne, 150, 300), 1, 'à 150 colonnes le message tient — rien ne devrait empiler');

  // ⚠️ ET EN DESSOUS, ÇA EMPILE — c’est l’incident. Si cette assertion cesse de rougir, le double
  // a perdu ce qui le rend capable de voir quoi que ce soit.
  for (const largeur of [100, 80, 65, 40, 20]) {
    const vues = rangeesNonVides(sansBorne, largeur, 300);
    assert.ok(
      vues > 1,
      `à ${largeur} colonnes, le double ne voit que ${vues} rangée(s) pour une progression NON ` +
        'bornée — il ne reproduit plus l’incident, donc son vert sur la version corrigée ne prouve rien'
    );
  }
});

test('TOUT CE QUE LE DOUBLE EXPORTE A UN APPELANT — un orphelin a l’air d’un garde et n’en est pas', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 TROIS FONCTIONS EXPORTÉES SANS AUCUN APPELANT ONT VÉCU DANS CE FICHIER, ET LEUR LÉGENDE
  // LES DÉCLARAIT ACTIVES. Trouvé par une revue, jamais en relisant.
  //
  // Elles n’étaient pas mortes à l’écriture : elles servaient sur le chemin de `rendreEcran`.
  // Elles le sont devenues quand ce qu’elles faisaient a DÉMÉNAGÉ — le double a été déplacé sur
  // la ligne de progression. Une affirmation ne devient pas fausse seulement en étant mal
  // écrite : elle le devient aussi quand ce qu’elle décrit bouge et qu’on ne relit pas ce qu’on
  // laisse derrière.
  //
  // ⚠️ CE BANC EST LE GESTE MÉCANIQUE QUI FERME ÇA : déplacer quelque chose se termine par
  // COMPTER LES APPELANTS de ce qu’on laisse. Zéro appelant = un garde qui n’en est pas.
  //
  // ⚠️ IL NE COUVRE QUE CE FICHIER, ET C’EST DÉLIBÉRÉ. Le même comptage sur tout le module rend
  // sept exports sans appelant externe — mais ils sont utilisés CHEZ EUX, aucun n’a été touché
  // par ce lot, et une surface d’export trop large n’est pas un garde qui ment. Élargir ce banc
  // à eux, c’est élargir le lot ; le dire ici sans le faire, c’est le laisser trouvable.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const source = readFileSync(new URL('./aide/terminal.js', import.meta.url), 'utf8');
  const banc = readFileSync(new URL('./rien-ne-deborde-du-pane.test.js', import.meta.url), 'utf8');

  const exportes = [...source.matchAll(/^export function ([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]);
  assert.ok(exportes.length > 0, 'ce banc doit trouver des exports — sinon il ne mesure rien');

  for (const nom of exportes) {
    // ⚠️ ON CHERCHE L’APPEL, PAS LA MENTION : `nom(` et non `nom`. Une fonction citée dans un
    // commentaire n’a pas d’appelant — c’est exactement ce qui rendait les trois orphelines
    // invisibles, puisque leur légende les nommait.
    const appels = [...banc.matchAll(new RegExp(`\\b${nom}\\s*\\(`, 'g'))].length;
    assert.ok(
      appels > 0,
      `\`${nom}\` est exporté par le double et n’est APPELÉ nulle part dans le banc — un export ` +
        'sans appelant a l’air d’un garde et n’en est pas. Branche-le, ou supprime-le avec la ' +
        'prose qui l’annonce.'
    );
  }
});


test('LES FRONTIÈRES DU RENDU SONT INTERROGÉES, PAS SEULEMENT TRAVERSÉES', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 TROIS DÉFAUTS QUE HUIT TOURS DE REVUES N'AVAIENT PAS VUS, ET LE GESTE QUI LES A SORTIS.
  //
  // Une campagne de mutation ordinaire balaie des VALEURS : elle traverse une frontière sans
  // jamais la mettre en cause. Muter le COMPARATEUR — `>` en `>=`, `<` en `<=` — est le seul
  // geste qui l'interroge. Aucune mutation de ce lot ne l'avait fait ; quand on l'a fait,
  // treize frontières sont ressorties, dont celles-ci.
  //
  // ⚠️ CHACUNE A ÉTÉ INSTRUITE SUR LE RENDU, PAS SUR LA SUITE : la mutation appliquée, les
  // 10 788 sorties recalculées et comparées une à une. Une mutation qui ne change AUCUN rendu
  // est une équivalence ; une qui en change un est un défaut, que la suite le voie ou non.
  // ═══════════════════════════════════════════════════════════════════════════════════════

  // ═══ ① RIEN NE S'ÉCRIT DANS ZÉRO COLONNE. `tronquer(texte, 0)` rendait `'…'` une fois muté —
  // UN caractère là où il n'y a aucune place. C'est la classe de défaut du ticket, à l'endroit
  // le plus extrême. Deux rendus changés, et rien ne les gardait.
  for (const texte of ['abcdef', '', 'x', '🔴 rouge']) {
    assert.equal(
      tronquer(texte, 0),
      '',
      `\`tronquer(${JSON.stringify(texte)}, 0)\` écrit quelque chose dans ZÉRO colonne`
    );
    // ⚠️ ET LE VOISIN IMMÉDIAT NE CÈDE PAS NON PLUS : à 1 colonne, exactement 1 point de code.
    if (texte !== '') {
      assert.equal([...tronquer(texte, 1)].length, 1, `à 1 colonne, \`tronquer\` n’en rend pas un seul`);
    }
  }

  // ═══ ② LA QUEUE D'UNE LIGNE NE S'ÉCRIT PAS QUAND IL N'Y A PAS LA PLACE. Muté, `texteDeLigne`
  // ajoutait une espace de queue sous 2 colonnes — 26 rendus changés.
  //
  // ⚠️ ON MESURE LA LARGEUR RENDUE, pas la présence de la queue : c'est la propriété que le
  // lecteur voit, et elle survit à toute recomposition future de la ligne.
  for (const li of [
    { titre: 'un chantier', profondeur: 0, suffixe: 'DÉCLARÉ' },
    { titre: 'x', profondeur: 2, suffixe: 'y' },
    { titre: 'sans suffixe', profondeur: 0 },
  ]) {
    for (let largeur = 0; largeur <= 40; largeur += 1) {
      assert.ok(
        [...texteDeLigne(li, largeur)].length <= largeur,
        `à ${largeur} colonnes, la ligne écrit ${[...texteDeLigne(li, largeur)].length} caractères : ` +
          JSON.stringify(texteDeLigne(li, largeur))
      );
    }
  }

  // ═══ ③ L'ORDRE DE RETRAIT À VITALITÉ ÉGALE — voulu, DOCUMENTÉ en toutes lettres, et gardé
  // par rien. 1495 rendus changés par la mutation.
  //
  // Le code dit : « On retire le moins vital ; à vitalité égale, LE DERNIER de la liste. » Le
  // dernier est donc RETIRÉ EN PREMIER — c'est le PREMIER des ex æquo qui survit. Muté, l'ordre
  // s'inverse, et la barre affiche autre chose à toutes les largeurs intermédiaires. L'ordre de
  // la maquette est celui que le dirigeant a validé ; il ne se décide pas par un accident de
  // comparateur.
  //
  // ⚠️ J'AI ÉCRIT CETTE ASSERTION À L'ENVERS DU PREMIER COUP, et c'est le rouge qui l'a dit. Je
  // lisais « à vitalité égale, le dernier de la liste » comme « le dernier RESTE », alors que la
  // phrase porte sur ce qu'on RETIRE. Encore une intention supposée à la place du comportement :
  // la mesure a tranché en une ligne ce que ma lecture avait inversé.
  //
  // ⚠️ ON N'ÉCRIT PAS LA BARRE ATTENDUE EN DUR — elle changerait à chaque retouche de maquette.
  // On énonce la RÈGLE : à vitalité égale, celui qui reste est le plus loin dans le manifeste.
  const parVitalite = new Map();
  for (const r of RACCOURCIS_UN_A_UN) {
    if (!parVitalite.has(r.vital)) parVitalite.set(r.vital, []);
    parVitalite.get(r.vital).push(r);
  }
  const exAequo = [...parVitalite.values()].filter((g) => g.length > 1);
  assert.ok(
    exAequo.length > 0,
    'le manifeste ne porte plus AUCUN ex æquo de vitalité — cette règle n’a plus d’objet, et ce ' +
      'banc ne mesure plus rien : retire-le ou retrouve un cas'
  );

  for (const groupe of exAequo) {
    const dernier = groupe[groupe.length - 1];
    const avantDernier = groupe[groupe.length - 2];
    // La largeur où le groupe se fait retirer : on la CHERCHE, en descendant.
    let vueAvecAvantDernier = false;
    let vueSansDernier = false;
    for (let largeur = 200; largeur >= 1; largeur -= 1) {
      const barre = raccourcisPour(largeur);
      const aDernier = barre.includes(dernier.texte);
      const aAvant = barre.includes(avantDernier.texte);
      // ⚠️ LA RÈGLE, ÉNONCÉE COMME UNE IMPLICATION : si le DERNIER des ex æquo est encore là,
      // l'avant-dernier l'est forcément — puisque le dernier part EN PREMIER.
      assert.ok(
        !aDernier || aAvant,
        `à ${largeur} colonnes, « ${dernier.texte} » est là et « ${avantDernier.texte} » ne l’est ` +
          `pas — à vitalité égale (${groupe[0].vital}), c’est le DERNIER de la liste qui est retiré ` +
          `EN PREMIER : ${JSON.stringify(barre)}`
      );
      if (aAvant && !aDernier) vueSansDernier = true;
      if (aAvant) vueAvecAvantDernier = true;
    }
    // ⚠️ ET LES DEUX ÉTATS SE PRODUISENT VRAIMENT dans le balayage — sinon l'implication
    // ci-dessus serait vraie par vacuité, et on aurait écrit une assertion morte.
    assert.ok(
      vueAvecAvantDernier,
      `« ${avantDernier.texte} » n’apparaît à AUCUNE largeur — l’implication est vraie par vacuité`
    );
    assert.ok(
      vueSansDernier,
      `« ${dernier.texte} » n’est retiré à AUCUNE largeur avant « ${avantDernier.texte} » — ` +
        'le balayage ne traverse jamais le moment où la règle s’applique'
    );
  }
});


test('LA PRODUCTION N’ÉMET QUE DES SÉQUENCES BIEN FORMÉES — la frontière de ce que le double couvre', () => {
  // 🔴 CE BANC REMPLACE UNE CAPACITÉ QUE LE DOUBLE NE SAIT PAS TENIR. Il ne modélise pas les
  // séquences CSI TRONQUÉES : un vrai terminal les garde en attente, lui imprime leurs
  // paramètres. J’ai essayé de le corriger et j’ai inventé un mécanisme dont je n’avais pas la
  // spec — 45 écarts sur un tirage.
  //
  // ⚠️ PLUTÔT QUE DE MODÉLISER À L’AVEUGLE, ON GARDE LA FRONTIÈRE : tout ce que le TUI écrit
  // reste dans le sous-ensemble que le double a été confronté à tenir. Le jour où quelqu’un
  // ajoute une séquence tronquée ou exotique, c’est ICI que ça rougit — avant que le double ne
  // se mette à mentir en silence.
  const source = readFileSync(new URL('../src/tui-boucle.js', import.meta.url), 'utf8');
  const ESC = String.fromCharCode(27);

  // Toutes les séquences que le module écrit, telles qu’elles sont ÉCRITES dans la source.
  const sequences = [...source.matchAll(/\$\{ESC\}(\[[^`$'"\\]*)/g)].map((m) => m[1]);
  assert.ok(sequences.length > 0, 'ce banc doit trouver des séquences — sinon il ne mesure rien');

  for (const seq of sequences) {
    // ⚠️ BIEN FORMÉE = `[`, des paramètres, PUIS un caractère final alphabétique. C’est ce que
    // le double sait reconnaître, et le seul sous-ensemble éprouvé contre l’émulateur.
    assert.match(
      seq,
      /^\[[0-9;?]*[A-Za-z]/,
      `le module écrit ${JSON.stringify(ESC + seq)} — cette séquence n’est pas une CSI bien formée, ` +
        'et le double du terminal n’a jamais été confronté à elle. Soit tu la ramènes dans le ' +
        'sous-ensemble éprouvé, soit tu étends le double ET son corpus AVANT de l’écrire.'
    );
  }

  // ⚠️ ET AUCUN `ESC` NU : un ESC qui n’ouvre pas une séquence sort du sous-ensemble.
  const nus = [...source.matchAll(/\$\{ESC\}(?!\[)/g)].length;
  assert.equal(nus, 0, `le module écrit ${nus} ESC qui n’ouvrent aucune séquence`);
});

test('CHAQUE MÉCANISME DU DOUBLE EST ATTEINT PAR LE CORPUS — un nom rassure, un passage se compte', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 DEUX ÉTAGES DU MÊME DÉFAUT, TROUVÉS DANS LE MÊME GESTE — ET DANS LES DEUX, CE QUI
  // RASSURAIT ÉTAIT UN NOM.
  //
  //   ① la garde de la liste comptait les NOMS DE CAPACITÉ. « effacement de rangée » en
  //      recouvrait TROIS (`[K`, `[1K`, `[2K`) ; un seul cas suffisait à faire passer la ligne,
  //      et `[1K` n’a JAMAIS été confronté — zéro cas sur 412.
  //   ② le corpus portait un cas NOMMÉ « séquence inconnue ignorée » qui n’éprouvait pas ce
  //      mécanisme : son `ESC[31m` matche la regex, donc il passait par le chemin RECONNUE. Le
  //      nom du cas mentait sur ce qu’il éprouve.
  //
  // ⚠️ UN COMPTEUR DE PASSAGES NE PEUT PAS ÊTRE TROMPÉ PAR UN NOM. C’est pourquoi ce banc
  // compte ce que le corpus fait TOURNER, et non ce qu’il prétend couvrir.
  //
  // ⚠️ ET IL RAPPORTE LES BRANCHES FAIBLES SANS LES FAIRE ROUGIR : un mécanisme à un seul
  // passage n’est pas beaucoup mieux qu’à zéro — il est éprouvé par un cas dont rien ne dit
  // qu’il est représentatif. Le seuil de rougissement reste ZÉRO ; le rapport dit combien
  // chacun en a, pour qu’on voie venir le prochain.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const cas = JSON.parse(readFileSync(new URL('./aide/terminal-cas-pyte.json', import.meta.url), 'utf8'));
  const source = readFileSync(new URL('./aide/terminal.js', import.meta.url), 'utf8');

  // Les MÉCANISMES, reconnus dans la source du double par ce qui les distingue les uns des
  // autres — pas par un nom qu’on leur donnerait à côté.
  const MECANISMES = [
    ['écriture imprimable', /String\.fromCodePoint/],
    ['report de retour à la ligne', /if \(col >= cols\)/],
    ['retour chariot', /t\[i\] === '\\r'/],
    ['saut de ligne', /t\[i\] === '\\n'/],
    ['effacement [2K', /m\[1\] === '2'/],
    ['effacement [1K', /m\[1\] === '1'/],
    ['effacement [K', /else rangees\[ligne\] = r\.slice\(0, col\)/],
    ['complément de rangées', /rangees\.length < rows/],
    ['défilement', /slice\(-rows\)/],
  ];
  for (const [nom, motif] of MECANISMES) {
    assert.match(source, motif, `le mécanisme « ${nom} » n’existe plus dans le double — ce banc le cherche encore`);
  }

  // ═══ ON COMPTE LES PASSAGES, en rejouant le corpus à travers une copie instrumentée.
  const compte = Object.fromEntries(MECANISMES.map(([n]) => [n, 0]));
  for (const c of cas) {
    const ESC = String.fromCharCode(27);
    const flux = c.ecrits.join('');
    // ⚠️ ON N’INSTRUMENTE PAS LE DOUBLE : on reconnaît, sur le FLUX, ce qu’il devra faire. Un
    // compteur posé DANS le double se désarmerait avec lui ; celui-ci vit à côté.
    if (/[^\u0000-\u001f]/.test(flux.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, ''))) compte['écriture imprimable'] += 1;
    if (flux.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '').replace(/[\r\n]/g, '').length > c.cols) compte['report de retour à la ligne'] += 1;
    if (flux.includes('\r')) compte['retour chariot'] += 1;
    if (flux.includes('\n')) compte['saut de ligne'] += 1;
    if (flux.includes(`${ESC}[2K`)) compte['effacement [2K'] += 1;
    if (flux.includes(`${ESC}[1K`)) compte['effacement [1K'] += 1;
    if (/\u001b\[K/.test(flux)) compte['effacement [K'] += 1;
    const rendu = ecranApresEcritures(c.ecrits, c.cols, c.rows);
    if (rendu.filter((l) => l === '').length > 0) compte['complément de rangées'] += 1;
    if (c.rows < 6) compte['défilement'] += 1;
  }

  const faibles = [];
  for (const [nom, n] of Object.entries(compte)) {
    if (n > 0 && n < 5) faibles.push(`${nom} (${n})`);
    assert.ok(
      n > 0,
      `le mécanisme « ${nom} » n’est atteint par AUCUN des ${cas.length} cas du corpus — il est ` +
        'déclaré, jamais confronté à l’émulateur, et son nom seul le fait passer pour éprouvé. ' +
        'Capture des cas qui le font tourner, ou retire-le du double.'
    );
  }
  // ⚠️ LES FAIBLES NE FONT PAS ROUGIR — elles s’écrivent, pour qu’on voie venir le prochain zéro.
  if (faibles.length > 0) {
    console.log(`    ⚠️ mécanismes faiblement couverts : ${faibles.join(' · ')}`);
  }
});


test('LA BARRE GARDE LE MAXIMUM — entre « ça tient » et « ça ne se vide pas », le milieu était libre', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 UN SOUS-USAGE, ET C'EST L'INVERSE DE LA CLASSE QUE CE LOT FERME.
  //
  // Muter la borne de retrait de `raccourcisPour` (`>` en `>=`) change le rendu à SIX largeurs,
  // et la suite entière restait VERTE :
  //
  //     22 col   sain « ↑↓ naviguer  q quitter »              muté « q quitter »
  //     32 col   sain « ↑↓ naviguer  →← plier  q quitter »    muté sans « →← plier »
  //     44 col   sain « …  / chercher  q quitter »            muté sans « / chercher »
  //
  // La barre retire un raccourci qu'elle avait EXACTEMENT la place d'afficher. Ce n'est pas un
  // débordement — c'est de la place perdue, en silence, à la largeur de palier.
  //
  // ⚠️ POURQUOI AUCUN BANC NE LE VOYAIT : ils gardaient les deux BORDS. « Rien ne dépasse le
  // pane » d'un côté, « la barre ne se vide jamais » de l'autre. Entre les deux, personne ne
  // demandait qu'elle en garde le PLUS possible. Garder deux bords ne garde pas ce qu'il y a
  // entre eux.
  //
  // ⚠️ ET ON NE RÉIMPLÉMENTE PAS LA RÈGLE POUR LA VÉRIFIER — ce serait la recopier à côté
  // d'elle-même, et les deux se tromperaient ensemble. On énonce une propriété de PALIER qui
  // n'a besoin d'aucune arithmétique : là où la barre gagne un raccourci en passant de `c` à
  // `c + 1`, ce raccourci de plus ne pouvait PAS tenir dans `c`.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  let paliers = 0;
  for (let c = 1; c <= 200; c += 1) {
    const ici = raccourcisPour(c);
    const apres = raccourcisPour(c + 1);
    if (ici === apres) continue;

    // ═══ ① UN PALIER : la barre a changé. Ce qu'elle porte en plus doit être IMPOSSIBLE à `c`.
    paliers += 1;
    assert.ok(
      [...apres].length > c,
      `à ${c + 1} colonnes la barre devient ${JSON.stringify(apres)} (${[...apres].length} car.) — ` +
        `elle TENAIT déjà dans ${c} colonnes, donc à ${c} on a retiré un raccourci pour rien : ` +
        `${JSON.stringify(ici)}`
    );

    // ═══ ② ET ELLE NE PERD JAMAIS EN S'ÉLARGISSANT — la monotonie, dans le sens du gain.
    assert.ok(
      [...apres].length >= [...ici].length,
      `à ${c + 1} colonnes la barre RÉTRÉCIT : ${JSON.stringify(ici)} → ${JSON.stringify(apres)}`
    );
  }

  // ⚠️ ET LES PALIERS EXISTENT VRAIMENT — sans eux, tout le corps de la boucle serait sauté et ce
  // banc serait vert sans rien avoir mesuré. C'est le défaut qu'on vient de fermer ailleurs.
  assert.ok(paliers >= 4, `le balayage ne traverse que ${paliers} palier(s) — il n’éprouve presque rien`);
});

// la-garde-des-naissances-ne-se-desarme-pas.test.js — QUI GARDE LE GARDIEN. (T-20260825-0013.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LE GESTE QU'ON FERME, ET POURQUOI IL EST LE PLUS DANGEREUX DE TOUS
//
// Motif mesuré dans ce dépôt : **une garde qui porte sa propre liste d'exceptions est
// désarmable par ENTRETIEN.** Les autres formes de désarmement se cachent ; celle-là se
// présente comme une bonne pratique — « j'ajoute juste ce cas-là, il fait du bruit ». Personne
// ne la relève en revue, parce qu'elle ressemble exactement au travail normal.
//
// Le critère d'arrêt n'est donc PAS « rendre le désarmement impossible » — c'est
// **RENDRE LE GESTE DE DÉSARMEMENT VISIBLE EN REVUE**. Une liste d'exceptions qu'on élargit est
// invisible ; un dénominateur épinglé, non.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE QUE CE FICHIER NE FAIT PAS — L'ÉPINGLE AUTO-RÉFÉRENTIELLE
//
// Une épingle où LE BANC COMPARE LE CODE À UNE CONSTANTE QU'IL PORTE LUI-MÊME ne garde RIEN :
// qui édite les deux ensemble la désarme en silence, et le diff a l'air d'un réalignement. Elle
// a un air de rigueur et c'est tout ce qu'elle a. Aucune des quatre épingles ci-dessous n'est
// de cette forme :
//
//   ① **Le prédicat de population est prouvé TOTAL par VARIATION, pas par lecture.** Le banc
//      fait varier CHAQUE champ du dossier d'un agent — la liste des champs est tirée du
//      dossier lui-même, `Object.keys`, jamais écrite à la main — et exige que le verdict ne
//      bouge pas. Ajouter « sauf si … » sur n'importe quel champ fait rougir une cellule.
//
//   ② **Un agent INVENTÉ à l'essai est jugé pareil.** Il porte des champs que la garde n'a
//      jamais vus. S'il traverse, c'est que la machinerie est GÉNÉRIQUE — pas une liste de cas
//      déguisée en boucle. C'est la troisième garde du patron de
//      `un-signal-neuf-traverse-les-quatre-passages.test.js`.
//
//   ③ **La frontière se vérifie contre le REGISTRE RÉEL, pas contre un chiffre d'essai.**
//      Reculer `MISE_EN_SERVICE` est le désarmement le plus discret qui existe ici. La garde
//      compare sa frontière à la plus ancienne déclaration inscrite : la référence est une
//      DONNÉE DU MONDE que la garde lit de toute façon. On ne peut pas la déplacer en éditant
//      le module et son banc ensemble.
//
//   ④ **Les comptes balancent, et c'est le MODULE qui le vérifie.** Sortir un agent d'un panier
//      sans le remettre dans un autre LÈVE. Le banc n'a pas à énumérer les exceptions
//      interdites — y compris celle que quelqu'un inventera dans six mois.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MISE_EN_SERVICE,
  instantDeLHorodatage,
  FrontiereContredite,
  ComptesQuiNeBalancentPas,
  normaliserLeParc,
  jugerLeParc,
  VERDICTS,
  SORTIES,
} from '../src/garde-des-naissances.js';
// ⚠️ LE VRAI LECTEUR DU REGISTRE, ET IL EST ICI POUR UNE RAISON — voir le banc du `ne_le`
// ILLISIBLE en ③ : ce qui rend ce cas-là atteignable n'est pas une valeur, c'est une POSITION,
// et la position est décidée par le TRI de ce lecteur-ci. Un tableau rangé à la main
// prouverait un ordre que le monde ne produit pas.
import { lireLesDeclarations } from '../src/declaration.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const DECISION = resolve(ICI, '..', 'src', 'garde-des-naissances.js');

/**
 * LE SOCKET D'UNE SESSION, DANS LA FORME EXACTE OÙ HERDR LE DÉPOSE — mesuré le 2026-08-25 sur
 * les 5 sessions du poste qui répondent.
 *
 * 🔴 CE HARNAIS FABRIQUAIT AUTREFOIS `'/bac/s1.sock'` DES DEUX CÔTÉS, et c'est ce qui a caché
 * le défaut de la jointure : la déclaration recevait la forme du CONSOMMATEUR (un chemin) alors
 * que le producteur y inscrit un NOM. Les deux côtés se comparaient donc égaux dans le banc et
 * jamais dans le monde. Depuis : le pane porte le CHEMIN (ce que `herdr pane list` rend), la
 * déclaration porte le NOM (ce que `bin/naitre.js` inscrit) — chacun sa forme réelle.
 */
const socketDe = (nom) => `/bac/.config/herdr/sessions/${nom}/herdr.sock`;
const SOCKET_S1 = socketDe('s1');

const WT = '/bac/worktrees/un-depot';
const APRES = `${WT}/20260825-093000`;

/**
 * LE DOSSIER D'UN AGENT FAUTIF — tel que herdr le rend vraiment.
 *
 * ⚠️ LES CLÉS SONT CELLES DU VRAI `pane list`, relevées sur le poste le 2026-08-25. Un dossier
 * inventé plus pauvre que le vrai ferait un banc qui ne peut pas trouver le défaut qu'il
 * cherche : on ne pourrait pas faire varier ce qu'on n'a pas mis. C'est le motif « un double
 * non conforme fabrique des défauts ».
 */
const FAUTIF = Object.freeze({
  agent: true,
  // ⚠️ LA FORME DU MONDE : herdr rend un OBJET dont `value` porte l'identifiant. Ce banc
  // écrivait une chaîne ; depuis que la garde DATE l'agent par sa session, un double plus
  // pauvre que le vrai rendrait le fautif de référence non datable, donc « non mesuré » — et le
  // contrôle négatif passerait au vert sans rien éprouver.
  agent_session: { agent: 'claude', kind: 'id', source: 'herdr:claude', value: 'ses-1' },
  agent_status: 'working',
  cwd: '/Users/x/GitRepo.nosync/un-depot',
  focused: false,
  foreground_cwd: APRES,
  name: null,
  pane_id: 'w1:p1',
  revision: 412,
  state_change_seq: 9,
  tab_id: 't1',
  terminal_id: 'term-1',
  terminal_title: 'claude',
  terminal_title_stripped: 'claude',
  workspace_id: 'ws1',
  herdr_socket: SOCKET_S1,
});

/**
 * LES QUATRE CLÉS QUI DÉCIDENT, et rien d'autre n'a le droit de décider.
 *
 * ⚠️ CETTE LISTE-CI EST LA SEULE DU FICHIER, ET SA POLARITÉ EST L'INVERSE D'UNE EXCEPTION.
 * L'ÉLARGIR AFFAIBLIT LE BANC — c'est donc le geste à surveiller, et il porte son avertissement
 * dans son propre commentaire. La RÉDUIRE le durcit. Une liste d'exceptions se désarme en
 * grandissant ET personne ne le voit ; celle-ci se désarme en grandissant et le diff dit
 * exactement ce qu'il retire de la couverture.
 */
const CLES_QUI_DECIDENT = ['name', 'pane_id', 'herdr_socket', 'agent_session'];

/**
 * 🔴 `foreground_cwd` ET `cwd` SONT SORTIS DE CETTE LISTE LE 2026-08-25, ET C'EST UN
 * DURCISSEMENT — le seul sens dans lequel cette liste-ci a le droit de bouger.
 *
 * Ils y étaient parce que le répertoire de travail DÉCIDAIT de la population : la garde se
 * bornait sur l'horodatage porté par son nom. C'était le défaut — une reprise
 * (`claude-swt <horodatage>`, le geste que le pack prescrit) fait naître aujourd'hui dans un
 * répertoire d'hier, et la garde la rangeait « née avant la mise en service », au vert.
 *
 * La population se borne désormais sur la NAISSANCE de l'agent. Le répertoire est donc devenu
 * un champ comme les autres, que ce banc fait varier sur les 19 appâts — et c'était le champ
 * qui décidait. Si un jour il redécide, cette boucle rougit.
 */

/**
 * Des valeurs qui ressemblent à ce qu'une exception viserait — « c'est juste un essai »,
 * « c'est un agent jetable », « celui-là est au repos ». Si l'une d'elles change le verdict,
 * c'est qu'un « sauf » s'est glissé quelque part.
 */
const APPATS = [
  'essai', 'test', 'jetable', 'temporaire', 'scratch', 'claude', 'bash', 'sandbox',
  '', null, undefined, 0, 1, true, false, 'idle', 'busy', 'orchestrateur', 'representant',
];

const registreQuiAVu = (panes) =>
  panes.map((p) => ({ pane_id: p.pane_id, herdr_socket: p.herdr_socket, agent: true, name: p.name ?? null }));

/**
 * LES NAISSANCES QUE LE FIL AURAIT LUES. Par défaut chaque agent du banc naît APRÈS la
 * frontière — c'est la population que cette garde vise, donc le cas normal ici.
 *
 * ⚠️ EN UTC, ET À TREIZE HEURES DE LA FRONTIÈRE. `MISE_EN_SERVICE` se lit en heure LOCALE : un
 * instant choisi trop près tomberait du bon côté chez l'auteur et du mauvais en CI.
 */
const NE_APRES = Date.parse('2026-08-25T17:30:00.000Z');
const NE_AVANT = Date.parse('2026-07-24T20:46:45.000Z');

const naissancesDe = (panes, quand = NE_APRES) => ({
  mesure: 'lue',
  illisibles: 0,
  instants: new Map(
    panes.map((p) => [p?.agent_session?.value, quand]).filter(([id]) => Boolean(id))
  ),
});

function verdictDe(panes, extra = {}) {
  const { naissances = naissancesDe(panes), ...reste } = extra;
  return jugerLeParc({
    agents: normaliserLeParc({ panes, agentsHerdr: registreQuiAVu(panes), naissances }),
    registre: { declarations: [], illisibles: [] },
    roleDuLieu: () => null,
    portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
    ...reste,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ① LE PRÉDICAT DE POPULATION EST TOTAL — prouvé par VARIATION, un champ à la fois
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le contrôle négatif : le fautif de référence EST pris', () => {
  // ⚠️ SANS CE VERT-LÀ, TOUT CE QUI SUIT EST VIDE. Un banc dont le cas de base ne rougit pas
  // fait passer ses variations pour des preuves alors qu'il ne mesure rien.
  const r = verdictDe([{ ...FAUTIF }]);
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF);
  assert.equal(r.comptes.prises, 1);
});

test('AUCUN champ autre que les quatre qui décident ne peut changer le verdict — un par un', () => {
  // ⚠️ UN CHAMP À LA FOIS. Les faire varier en groupe ferait passer une exception derrière le
  // bruit d'une autre : un rouge prouverait qu'AU MOINS un champ est neutre, jamais que tous
  // le sont. C'est « muter en groupe cache une survivante », appliqué à la mesure.
  const aVarier = Object.keys(FAUTIF).filter((k) => !CLES_QUI_DECIDENT.includes(k));
  assert.ok(aVarier.length >= 8, 'le dossier de référence s’est appauvri : ce banc ne mesure presque plus rien');

  let cellules = 0;
  for (const champ of aVarier) {
    for (const appat of APPATS) {
      const r = verdictDe([{ ...FAUTIF, [champ]: appat }]);
      cellules += 1;
      assert.equal(
        r.verdict,
        VERDICTS.NES_HORS_DISPOSITIF,
        `« ${champ} = ${String(appat)} » a changé le verdict : un « sauf » s’est glissé dans le ` +
          'prédicat de population. Le dénominateur n’est plus épinglé.'
      );
    }
  }
  assert.ok(cellules > 100, `seulement ${cellules} cellules éprouvées`);
});

test('un champ que la garde n’a JAMAIS vu ne la fait pas dévier', () => {
  const r = verdictDe([{ ...FAUTIF, champ_invente_le_2026_08_25: 'jetable', priorite: -1, exclure: true }]);
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF, 'un champ « exclure » ne doit rien exclure');
});

test('un agent INVENTÉ à l’essai traverse la machinerie sans qu’on touche à la garde', () => {
  // ⚠️ LA TROISIÈME GARDE DU PATRON : si un cas qu'aucune liste n'a anticipé est jugé
  // correctement, c'est que la machinerie est GÉNÉRIQUE. Une liste de cas déguisée en boucle
  // échouerait ici, parce que ce cas-là n'y figure pas.
  const invente = {
    agent: true,
    agent_session: { agent: 'claude', kind: 'id', source: 'herdr:claude', value: 'session-jamais-vue' },
    foreground_cwd: `${WT}/20261231-235959`,
    pane_id: 'z99:p42',
    herdr_socket: socketDe('inconnue'),
    name: null,
    quelque_chose: { de: 'nouveau' },
  };
  const r = verdictDe([invente]);
  assert.equal(r.comptes.prises, 1);
  assert.match(r.texte, /z99:p42/, 'un agent inventé est NOMMÉ comme les autres');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ② LE PRODUIT CROISÉ COMPLET — l'oracle est une FORMULE, pas une table de résultats attendus
// ═══════════════════════════════════════════════════════════════════════════════════════

test('sur TOUTES les combinaisons des axes, la garde s’accorde à un oracle écrit à part', () => {
  // ⚠️ LE CORPUS EST ENGENDRÉ, PAS ÉNUMÉRÉ. « Retirer un cas » exigerait de retirer une VALEUR
  // d'axe — un diff qui dit à haute voix quelle moitié du monde on cesse d'éprouver. Une liste
  // de cas écrite à la main perd une ligne sans que personne ne le voie.
  const axeNaissance = ['après', 'avant', 'non datable'];
  const axeDeclaration = ['déclaré', 'non déclaré'];
  const axeLieu = ['établi', 'non établi', 'refusé'];
  const axeNom = ['conforme', 'non conforme', 'absent', 'non mesuré'];

  let cellules = 0;
  for (const naissance of axeNaissance) {
    for (const decl of axeDeclaration) {
      for (const lieu of axeLieu) {
        for (const nom of axeNom) {
          // ⚠️ L'AXE DE LA NAISSANCE PORTE DÉSORMAIS DES NAISSANCES, PAS DES CHEMINS. Il
          // encodait « né après / né avant / non datable » dans le NOM du répertoire de
          // travail, parce que c'est là que la garde le lisait — et c'était le défaut. La
          // troisième valeur y était d'ailleurs muette : « non datable » rendait le même
          // verdict que « avant » (au vert). Elle discrimine maintenant, et du bon côté :
          // ne pas savoir dater un agent est un NON MESURÉ, jamais un laissez-passer.
          const espace = `${WT}/20260825-093000`
            + (lieu === 'non établi' ? '' : '/.orchestrateur/batiscan');

          const pane = {
            agent: true,
            agent_session: { agent: 'claude', kind: 'id', source: 'herdr:claude', value: 'ses' },
            pane_id: 'w1:p1',
            herdr_socket: SOCKET_S1, foreground_cwd: espace,
            name: nom === 'conforme' ? 'batiscan' : nom === 'non conforme' ? 'Agent Infra-Ops' : null,
          };
          const agentsHerdr = nom === 'non mesuré' ? [] : [{ ...pane }];
          const naissances = naissance === 'non datable'
            ? { mesure: 'lue', instants: new Map(), illisibles: 0 }
            : naissancesDe([pane], naissance === 'après' ? NE_APRES : NE_AVANT);

          const r = jugerLeParc({
            agents: normaliserLeParc({ panes: [pane], agentsHerdr, naissances }),
            registre: {
              declarations: decl === 'déclaré'
                // ⚠️ `ne_le` SUIT LA NAISSANCE DE LA CELLULE — il ne la précède pas de quatre
                // heures, comme le faisait la valeur figée qui vivait ici. Une déclaration
                // s'inscrit quelques secondes APRÈS l'agent qu'elle couvre ; la lui donner
                // plus VIEILLE fabriquait un monde où le dispositif déclare des agents qui ne
                // sont pas encore nés, et l'oracle finissait par exiger ce comportement-là.
                //
                // ⚠️ ET TOUJOURS DÉRIVÉE DE `NE_APRES`, MÊME SUR LA CELLULE « né avant ». Une
                // déclaration ne peut pas être plus ancienne que la mise en service — le
                // dispositif n'existait pas — et la garde REFUSE de se prononcer quand le
                // registre dément sa frontière. L'agent « né avant » est de toute façon HORS
                // PORTÉE : sa déclaration n'est jamais atteinte.
                ? [{ nom: 'peu-importe', pane: 'w1:p1', session_herdr: 's1', espace,
                     ne_le: new Date(NE_APRES + 2_000).toISOString() }]
                : [],
              illisibles: [],
            },
            roleDuLieu: () => (lieu === 'établi' ? 'orchestrateur' : lieu === 'refusé' ? { refus: 'illisible' } : null),
            portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
          });

          // ── L'ORACLE, écrit une fois, en une phrase — et à part du code jugé.
          //
          // ⚠️ LE 2026-08-25, UN TERME EST SORTI D'ICI : `|| nom === 'conforme'`. C'est
          // précisément la vertu de la forme FORMULE — le diff nomme le terme retiré, là où une
          // table de résultats attendus aurait laissé glisser des cellules une à une. Le nom
          // n'identifie plus (module, section ⓿) : il ne porte ni le rôle, ni le coordonnateur,
          // ni l'espace, et celui d'un agent né par le dispositif est TOUJOURS conforme.
          //
          // ⚠️ IL RESTE DANS `uneSourceRefusee`, ET CE N'EST PAS UN RELIQUAT. Un nom NON MESURÉ
          // prive l'appariement de sa clé de repli : « déclaration pas trouvée » cesse alors de
          // valoir « déclaration absente ». Ne pas le refuser transformerait une panne de
          // lecture d'`agent list` en prises.
          // ⚠️ « NON DATABLE » A CHANGÉ DE CÔTÉ, ET C'EST LE CORRECTIF EN UNE LIGNE D'ORACLE.
          // Il rendait `RIEN_A_SIGNALER` — un agent qu'on ne sait pas dater passait au vert par
          // la borne. Il rend maintenant `ZONES_NON_MESUREES`, avant même qu'on regarde ses
          // sources : ne pas savoir SI un agent est dans la population n'est pas savoir qu'il
          // n'y est pas.
          const dansLaPopulation = naissance === 'après';
          const uneSourceEtablie = decl === 'déclaré' || lieu === 'établi';
          const uneSourceRefusee = lieu === 'refusé' || nom === 'non mesuré';
          const attendu = naissance === 'non datable'
            ? VERDICTS.ZONES_NON_MESUREES
            : !dansLaPopulation
            ? VERDICTS.RIEN_A_SIGNALER
            : uneSourceEtablie
              ? VERDICTS.RIEN_A_SIGNALER
              : uneSourceRefusee
                ? VERDICTS.ZONES_NON_MESUREES
                : VERDICTS.NES_HORS_DISPOSITIF;

          cellules += 1;
          assert.equal(
            r.verdict, attendu,
            `[naissance=${naissance} · déclaration=${decl} · lieu=${lieu} · nom=${nom}] ` +
              'la garde et l’oracle divergent : un terme a été ajouté ou retiré au jugement.'
          );

          // ⚠️ SANS CETTE SECONDE CELLULE, L'AXE DU NOM CESSERAIT DE DISCRIMINER SUR TROIS DE
          // SES QUATRE VALEURS. Depuis que le nom n'identifie plus, « conforme », « non
          // conforme » et « absent » rendent le MÊME verdict : le produit croisé continuerait
          // de tourner sur 72 cellules en n'éprouvant plus qu'une seule d'entre elles. Ce que
          // le nom décide encore, c'est ce que la garde DIT de la prise — et donc le chiffre
          // qui mesure ce que l'ancienne règle absolvait en silence.
          const attenduNomConforme = attendu === VERDICTS.NES_HORS_DISPOSITIF && nom === 'conforme' ? 1 : 0;
          assert.equal(
            r.comptes.prisesAuNomConforme, attenduNomConforme,
            `[naissance=${naissance} · déclaration=${decl} · lieu=${lieu} · nom=${nom}] ` +
              'le compte des prises au nom conforme diverge de l’oracle.'
          );
        }
      }
    }
  }
  assert.equal(cellules, axeNaissance.length * axeDeclaration.length * axeLieu.length * axeNom.length);
  assert.equal(cellules, 72, 'un axe a perdu une valeur : le corpus a rétréci sans le dire');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ③ LA FRONTIÈRE — le désarmement le plus discret, et le seul vérifié contre le monde
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * L'INSTANT D'UNE DÉCLARATION QUI DÉMENT UN RECUL — DÉRIVÉ DE CE QUI CALCULE LA FRONTIÈRE.
 *
 * 🔴 CE QU'IL REMPLACE, ET POURQUOI. Ces deux essais portaient « 2026-08-25T13:30:00.000Z »
 * écrit à la main. Un ISO est un instant ABSOLU ; la frontière, elle, se lit en HEURE LOCALE
 * (`instantDeLHorodatage`). Les deux ne se rencontraient donc au bon endroit que sur les postes
 * dont le décalage arrangeait la comparaison : mesuré vert à UTC−12, UTC−11, UTC, Asia/Tokyo,
 * et ROUGE dès UTC+11 (Guadalcanal, Auckland, Kiritimati), où `20260826-000000` en heure locale
 * tombe AVANT 13:30Z et où plus rien ne dément le recul.
 *
 * ⚠️ C'EST LE MOTIF QUE CE LOT A DÉJÀ FERMÉ UNE FOIS (« la frontière du banc était épinglée au
 * fuseau de l'auteur », e20d05f) — il avait survécu un banc plus loin. Un littéral recopié ne
 * suit pas la frontière ; une DÉRIVÉE, si.
 *
 * Ce que la dérivée dit, et que le littéral ne disait qu'ici : la déclaration naît DANS le
 * dispositif — après la frontière réelle, donc elle ne la dément pas — et à moins d'un jour
 * d'elle, donc AVANT le plus petit des reculs (`20260826-000000`). Les deux propriétés tiennent
 * sous tout fuseau, parce que les deux côtés passent par la même porte.
 */
const NE_LE_DANS_LE_DISPOSITIF = new Date(
  instantDeLHorodatage(MISE_EN_SERVICE).getTime() + 13 * 3_600_000 + 30 * 60_000
).toISOString();

test('reculer la frontière fait REFUSER la garde dès qu’une déclaration la dément', () => {
  const declarations = [{ nom: 'ristigouche', pane: 'w0:p0', espace: APRES, ne_le: NE_LE_DANS_LE_DISPOSITIF }];

  // Le geste d'entretien : « la garde fait du bruit sur les vieux worktrees, je recule la date ».
  for (const recul of ['20260826-000000', '20260901-000000', '20270101-000000']) {
    assert.throws(
      () => verdictDe([{ ...FAUTIF }], { registre: { declarations, illisibles: [] }, miseEnService: recul }),
      FrontiereContredite,
      `reculer la frontière à ${recul} doit REFUSER, pas rendre « rien à signaler »`
    );
  }
});

test('le refus de frontière NOMME la déclaration qui la dément — sinon il est indiscutable', () => {
  try {
    verdictDe([{ ...FAUTIF }], {
      registre: { declarations: [{ nom: 'ristigouche', ne_le: NE_LE_DANS_LE_DISPOSITIF }], illisibles: [] },
      miseEnService: '20260901-000000',
    });
    assert.fail('la garde a laissé passer une frontière contredite');
  } catch (e) {
    assert.ok(e instanceof FrontiereContredite);
    assert.match(e.message, /ristigouche/);
    // ⚠️ L'INSTANT RÉELLEMENT DÉMENTI, pas une date recopiée. L'assertion portait « 2026-08-25 »
    // en dur : dérivée, la déclaration peut tomber la veille en UTC sur un poste très à l'est,
    // et l'ancienne forme aurait rougi pour la mauvaise raison. Exiger le `ne_le` EXACT dit
    // mieux ce qu'on veut : le refus nomme LA déclaration qui le dément, pas une date voisine.
    assert.ok(
      e.message.includes(NE_LE_DANS_LE_DISPOSITIF),
      `le refus doit citer « ${NE_LE_DANS_LE_DISPOSITIF} » — reçu : ${e.message}`
    );
  }
});

test('une frontière ILLISIBLE refuse aussi — la vider n’est pas une façon de la déplacer', () => {
  for (const cassee of ['', 'demain', '2026-08-25', '20260825', null]) {
    assert.throws(
      () => verdictDe([{ ...FAUTIF }], { miseEnService: cassee }),
      FrontiereContredite,
      `« ${String(cassee)} » n’est pas une frontière : la garde doit refuser`
    );
  }
});

/**
 * UN RECUL EXPRIMÉ DANS LA FORME DE LA FRONTIÈRE — dérivé de `MISE_EN_SERVICE`, jamais écrit à
 * la main, et relu par la MÊME porte que le module (`instantDeLHorodatage`, heure LOCALE).
 *
 * ⚠️ UN RECUL EN DUR NE PEUT PAS ENCADRER DEUX DÉCLARATIONS DÉRIVÉES. Les `ne_le` portent un ISO
 * absolu ; la frontière se lit en heure locale. Écrire « 20260904-000000 » ferait tomber
 * l'encadrement du bon côté chez l'auteur et du mauvais sous un fuseau lointain — c'est le motif
 * « vert chez l'auteur, rouge en CI » que ce fichier a déjà payé. Passer par les COMPOSANTES
 * LOCALES d'un instant calculé rend l'aller-retour exact sous tout fuseau, et le test le
 * VÉRIFIE avant de mesurer quoi que ce soit.
 */
const deuxChiffres = (n) => String(n).padStart(2, '0');
const horodatageDeLInstant = (ms) => {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}${deuxChiffres(d.getMonth() + 1)}${deuxChiffres(d.getDate())}-` +
    `${deuxChiffres(d.getHours())}${deuxChiffres(d.getMinutes())}${deuxChiffres(d.getSeconds())}`
  );
};

const EN_SERVICE_MS = instantDeLHorodatage(MISE_EN_SERVICE).getTime();
const UN_JOUR = 24 * 3_600_000;

/** La première naissance du dispositif — une heure après la mise en service. */
const LA_PLUS_ANCIENNE = Object.freeze({
  nom: 'bonaventure',
  pane: 'w0:p0',
  espace: APRES,
  ne_le: new Date(EN_SERVICE_MS + 3_600_000).toISOString(),
});
/** Un chef d'équipe né un mois plus tard — le registre GROSSIT à chaque naissance. */
const LA_PLUS_RECENTE = Object.freeze({
  nom: 'ristigouche',
  pane: 'w0:p1',
  espace: APRES,
  ne_le: new Date(EN_SERVICE_MS + 30 * UN_JOUR).toISOString(),
});
/** Un recul qui tombe ENTRE les deux : après l'ancienne, avant la récente. */
const RECUL_ENTRE_LES_DEUX = horodatageDeLInstant(EN_SERVICE_MS + 10 * UN_JOUR);

test('sur un registre à PLUSIEURS voix, UNE SEULE déclaration antérieure suffit à démentir', () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 CE QUE CE BANC SOLLICITE ET QU'AUCUN AUTRE NE SOLLICITAIT : le terme qui RETIENT LA
  // PLUS ANCIENNE. Tous les bancs de frontière ci-dessus passent un registre de ZÉRO OU UNE
  // déclaration — et sur un registre de taille 1, « la plus ancienne » et « la plus récente »
  // sont le MÊME objet. Le comparateur pouvait donc être inversé sans qu'un seul essai bouge.
  //
  // Inversé, l'épingle change de sens : « la frontière n'est démentie que si TOUTES les
  // déclarations la précèdent » au lieu de « UNE SEULE suffit ». Le geste d'entretien que ce
  // fichier nomme — « la garde fait du bruit sur les vieux worktrees, je recule la date » —
  // repasserait dès que le registre porte une déclaration récente. C'est-à-dire dès demain :
  // le registre grossit d'une déclaration à CHAQUE naissance de chef d'équipe.
  // ═══════════════════════════════════════════════════════════════════════════════════════

  // Le harnais AVANT la mesure. Si l'encadrement ne tient pas, le terme n'est pas sollicité et
  // le vert qui suivrait ne prouverait rien — on veut alors rougir ICI, pour la bonne raison.
  const frontiere = instantDeLHorodatage(RECUL_ENTRE_LES_DEUX);
  assert.ok(frontiere, `le recul dérivé doit se relire par la porte du module : ${RECUL_ENTRE_LES_DEUX}`);
  assert.ok(
    Date.parse(LA_PLUS_ANCIENNE.ne_le) < frontiere.getTime(),
    `la plus ancienne (${LA_PLUS_ANCIENNE.ne_le}) doit PRÉCÉDER le recul ${RECUL_ENTRE_LES_DEUX}`
  );
  assert.ok(
    Date.parse(LA_PLUS_RECENTE.ne_le) > frontiere.getTime(),
    `la plus récente (${LA_PLUS_RECENTE.ne_le}) doit SUIVRE le recul ${RECUL_ENTRE_LES_DEUX} — ` +
      'sinon les deux déclarations démentent, et retenir l’une ou l’autre revient au même'
  );

  // Les DEUX ordres d'arrivée. L'ordre du registre ne doit rien décider : une boucle qui
  // retiendrait « la première vue » passerait sur un seul des deux.
  for (const declarations of [
    [LA_PLUS_ANCIENNE, LA_PLUS_RECENTE],
    [LA_PLUS_RECENTE, LA_PLUS_ANCIENNE],
  ]) {
    const ordre = declarations.map((d) => d.nom).join(' puis ');
    assert.throws(
      () =>
        verdictDe([{ ...FAUTIF }], {
          registre: { declarations, illisibles: [] },
          miseEnService: RECUL_ENTRE_LES_DEUX,
        }),
      (e) => {
        assert.ok(e instanceof FrontiereContredite, `reculer à ${RECUL_ENTRE_LES_DEUX} doit REFUSER (${ordre})`);
        // ⚠️ ET LE REFUS NOMME LAQUELLE. Sans cette moitié, un refus rendu pour la RÉCENTE
        // passerait pour bon : c'est le fait retenu qu'on épingle, pas seulement le fait qu'on
        // refuse.
        assert.ok(
          e.message.includes(LA_PLUS_ANCIENNE.ne_le),
          `le refus doit citer LA PLUS ANCIENNE (${LA_PLUS_ANCIENNE.ne_le}) — reçu (${ordre}) : ${e.message}`
        );
        return true;
      }
    );
  }
});

test('un registre à plusieurs voix ne fait PAS refuser une frontière que personne ne dément', () => {
  // La moitié symétrique : les deux déclarations naissent APRÈS la mise en service réelle. Sans
  // ce contrôle, un module qui refuserait TOUJOURS dès qu'il y a deux voix ferait passer le
  // banc ci-dessus au vert sans rien garder.
  for (const declarations of [
    [LA_PLUS_ANCIENNE, LA_PLUS_RECENTE],
    [LA_PLUS_RECENTE, LA_PLUS_ANCIENNE],
  ]) {
    const r = verdictDe([{ ...FAUTIF }], { registre: { declarations, illisibles: [] } });
    assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF, 'la frontière en service n’est démentie par aucune des deux');
  }
});

/**
 * ⚠️ UN REGISTRE FABRIQUÉ PAR SON VRAI LECTEUR, ET ÉCRIT À LA MAIN LÀ OÙ LE MONDE L’EXIGE.
 *
 * `inscrireLaDeclaration` est le SEUL écrivain de `ne_le` du dépôt, et il n’écrit que
 * `quand.toISOString()` : un `ne_le` illisible demande une édition manuelle du fichier. On la
 * fait donc à la main — et on le dit. C’est la gravité que ce lot a déjà choisi de fermer pour
 * le fichier non-objet ; le standard appliqué ici est celui du lot lui-même.
 *
 * La LECTURE, elle, passe par la porte réelle. Ce n’est pas un détail de forme : ce qui rend le
 * cas ci-dessous atteignable n’est pas la valeur du `ne_le`, c’est sa POSITION dans le registre,
 * et la position est décidée par le tri de `lireLesDeclarations`.
 */
const registreReel = (fichiers) => {
  const racine = mkdtempSync(join(tmpdir(), 'smtk-frontiere-'));
  try {
    for (const [nom, contenu] of fichiers) writeFileSync(join(racine, nom), JSON.stringify(contenu));
    const lu = lireLesDeclarations({ racine });
    assert.deepEqual(lu.illisibles, [], 'ces fichiers-ci sont des FAITS lisibles — un illégitime fausserait la mesure');
    assert.equal(lu.declarations.length, fichiers.length, 'toutes les déclarations doivent être lues');
    return lu.declarations;
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
};

/** Un `ne_le` non vide et non analysable — la seule forme qui remonte EN TÊTE du registre. */
const LILLISIBLE = Object.freeze({ nom: 'illisible', pane: 'w0:p9', espace: APRES, ne_le: 'zzz-pas-une-date' });

test('🔴 UNE DÉCLARATION AU `ne_le` ILLISIBLE NE DEVIENT PAS « LA PLUS ANCIENNE » — sinon elle emporte l’épingle avec elle', () => {
  // ════════════════════════════════════════════════════════════════════════════════════
  // 🔴 LE TERME GARDÉ ICI, ET CE QU’IL COÛTE QUAND IL TOMBE. L’épingle ci-dessus retient la plus
  // ancienne déclaration du registre et refuse si elle précède la frontière. Le terme qui ÉCARTE
  // une déclaration non datable — `if (Number.isNaN(quand)) continue;` — n’était sollicité par
  // AUCUN essai. Retiré, ou changé en `break`, la garde CESSE DE REFUSER : `NaN` s’installe comme
  // « plus ancienne » (rien ne le remplace, `NaN < x` étant faux), puis `NaN < frontiere` est faux
  // à son tour. Le geste d’entretien que ce fichier nomme — reculer `MISE_EN_SERVICE` « parce que
  // la garde fait du bruit » — repasse en silence, au VERT.
  //
  // ⚠️ ET C’EST LA MOITIÉ NON GARDÉE D’UN MÊME CAS. `couvertureDeLaDeclaration`, l’AUTRE lecteur
  // de `ne_le` du module, écarte exactement la même donnée (`!Number.isFinite(inscrite)`) et rend
  // « indécidable » — tenu par un banc nommé. Deux lecteurs, un même cas : celui-ci échouait
  // OUVERT là où l’autre échoue en refus de mesure. C’est la polarité qui compte, pas la symétrie.
  // ════════════════════════════════════════════════════════════════════════════════════
  const declarations = registreReel([
    ['illisible.json', LILLISIBLE],
    ['bonaventure.json', LA_PLUS_ANCIENNE],
  ]);

  // LE HARNAIS AVANT LA MESURE. Si l’illisible ne sort pas EN TÊTE, le terme n’est pas sollicité
  // et le vert qui suivrait ne prouverait rien — on veut alors rougir ICI, pour la bonne raison.
  assert.equal(
    declarations[0].ne_le,
    LILLISIBLE.ne_le,
    'le tri décroissant doit placer le `ne_le` illisible EN TÊTE — c’est la POSITION qui rend le cas atteignable'
  );

  assert.throws(
    () =>
      verdictDe([{ ...FAUTIF }], {
        registre: { declarations, illisibles: [] },
        miseEnService: RECUL_ENTRE_LES_DEUX,
      }),
    (e) => {
      assert.ok(
        e instanceof FrontiereContredite,
        `une déclaration au « ${LILLISIBLE.ne_le} » ne doit pas désarmer le recul à ${RECUL_ENTRE_LES_DEUX}`
      );
      // ⚠️ ET LE REFUS NOMME LA PLUS ANCIENNE DATABLE, pas l’illisible. Sans cette moitié, un
      // refus rendu POUR l’illisible passerait pour bon.
      assert.ok(
        e.message.includes(LA_PLUS_ANCIENNE.ne_le),
        `le refus doit citer la plus ancienne DATABLE (${LA_PLUS_ANCIENNE.ne_le}) — reçu : ${e.message}`
      );
      return true;
    }
  );
});

test('un `ne_le` illisible ne FABRIQUE pas de refus non plus — et vide ou absent trie en QUEUE, hors d’atteinte', () => {
  // La moitié symétrique. Sans elle, un module qui refuserait DÈS QU’un `ne_le` est illisible
  // ferait passer le banc ci-dessus au vert sans rien garder.
  const declarations = registreReel([
    ['illisible.json', LILLISIBLE],
    ['vide.json', { nom: 'vide', pane: 'w0:p8', espace: APRES, ne_le: '' }],
    ['absent.json', { nom: 'absent', pane: 'w0:p7', espace: APRES }],
    ['bonaventure.json', LA_PLUS_ANCIENNE],
    ['ristigouche.json', LA_PLUS_RECENTE],
  ]);

  // ⚠️ LA NUANCE MESURÉE, ET ELLE DIT POURQUOI CE BANC-CI PORTE « zzz… » ET PAS UN VIDE. Le tri
  // est DÉCROISSANT sur la chaîne : un `ne_le` non vide et non analysable passe devant tout ISO
  // et devient candidat « plus ancienne » ; vide et absent se comparent à la chaîne vide, tombent
  // en QUEUE, et n’ont jamais pu emporter l’épingle. Qui remplacerait la valeur de ce banc par un
  // vide croirait mesurer la même chose et ne mesurerait plus rien.
  assert.equal(declarations[0].nom, 'illisible', 'un `ne_le` non vide et non analysable trie EN TÊTE');
  assert.deepEqual(
    declarations.slice(-2).map((d) => d.nom).sort(),
    ['absent', 'vide'],
    'un `ne_le` vide ou absent trie en QUEUE — il ne peut pas devenir « la plus ancienne »'
  );

  // … et la frontière EN SERVICE n’est démentie par aucune de ces cinq voix.
  const r = verdictDe([{ ...FAUTIF }], { registre: { declarations, illisibles: [] } });
  assert.equal(
    r.verdict,
    VERDICTS.NES_HORS_DISPOSITIF,
    'un `ne_le` illisible ne DÉMENT rien : il ne doit pas faire refuser une frontière que personne ne conteste'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ④ LES COMPTES BALANCENT — le panier muet n'a nulle part où se mettre
// ═══════════════════════════════════════════════════════════════════════════════════════

test('sur un parc mêlé, les deux égalités tiennent — et le module les vérifie lui-même', () => {
  const parc = [];
  for (let i = 0; i < 30; i += 1) {
    parc.push({
      ...FAUTIF,
      pane_id: `w1:p${i}`,
      foreground_cwd: [APRES, `${WT}/20260724-204645`, `${WT}/t-00${i}`][i % 3],
      name: i % 5 === 0 ? 'batiscan' : null,
    });
  }
  const r = verdictDe(parc);
  assert.equal(r.comptes.parcVivant, r.comptes.horsPortee + r.comptes.population);
  assert.equal(r.comptes.population, r.comptes.identifies + r.comptes.prises + r.comptes.nonMesures);
  assert.equal(r.comptes.parcVivant, 30);
  assert.ok(r.comptes.prises > 0, 'un parc mêlé sans aucune prise ne prouverait rien');
});

test('ComptesQuiNeBalancentPas est LEVÉE, pas rendue — un déséquilibre ne se lit pas dans un champ', () => {
  // ⚠️ Un déséquilibre RENDU serait ignoré par le premier appelant qui ne lit que `verdict`.
  // C'est la garde de la garde : elle doit couper la chaîne, pas la décorer.
  assert.ok(ComptesQuiNeBalancentPas.prototype instanceof Error);
  const source = readFileSync(DECISION, 'utf8');
  assert.match(source, /throw new ComptesQuiNeBalancentPas/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⑤ AUCUN INTERRUPTEUR — un désarmement qui ne laisse pas de diff n'existe pas ici
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la décision ne lit ni environnement, ni disque, ni horloge', () => {
  // ⚠️ UN `process.env` DANS UNE DÉCISION DE GARDE EST UN INTERRUPTEUR DE DÉSARMEMENT : on
  // l'actionne sans diff, donc sans revue, donc sans trace. Une garde qu'on éteint par une
  // variable n'est pas une garde. Même chose pour une lecture de disque ou d'horloge : elles
  // rendraient le verdict dépendant de la machine, et « vert chez l'auteur, rouge en CI » est
  // un défaut que ce dépôt a déjà payé.
  const source = readFileSync(DECISION, 'utf8');
  const nu = source.replace(/^\s*(\/\/.*|\*.*|\/\*.*)$/gm, '');
  for (const interdit of ['process.env', 'readFileSync', 'existsSync', 'readdirSync', 'Date.now', 'new Date()']) {
    assert.ok(
      !nu.includes(interdit),
      `« ${interdit} » est apparu dans la décision : elle cesse d’être pure, et devient ` +
        'désarmable sans laisser de diff.'
    );
  }
});

test('la frontière est une constante NOMMÉE et EXPORTÉE — pas un nombre enfoui', () => {
  // Un seuil enfoui dans une expression se bouge sans que personne ne sache ce qu'il gardait.
  // Nommé et exporté, il porte son avertissement et son déplacement se lit en une ligne.
  const source = readFileSync(DECISION, 'utf8');
  assert.match(source, /export const MISE_EN_SERVICE = '\d{8}-\d{6}'/);
  assert.match(MISE_EN_SERVICE, /^\d{8}-\d{6}$/);
});

test('les trois verdicts sortent par trois portes distinctes, et le vert n’est pas la porte par défaut', () => {
  const codes = Object.values(VERDICTS).map((v) => SORTIES[v]);
  assert.equal(new Set(codes).size, 3);
  assert.equal(SORTIES[VERDICTS.RIEN_A_SIGNALER], 0);
  assert.ok(SORTIES[VERDICTS.NES_HORS_DISPOSITIF] > 0);
  assert.ok(SORTIES[VERDICTS.ZONES_NON_MESUREES] > 0);
  assert.notEqual(SORTIES[VERDICTS.NES_HORS_DISPOSITIF], SORTIES[VERDICTS.ZONES_NON_MESUREES]);
});

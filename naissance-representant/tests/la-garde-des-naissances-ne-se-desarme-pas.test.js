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
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MISE_EN_SERVICE,
  FrontiereContredite,
  ComptesQuiNeBalancentPas,
  normaliserLeParc,
  jugerLeParc,
  VERDICTS,
  SORTIES,
} from '../src/garde-des-naissances.js';

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
  agent_session: 'ses-1',
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
const CLES_QUI_DECIDENT = ['name', 'foreground_cwd', 'cwd', 'pane_id', 'herdr_socket', 'agent_session'];

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

function verdictDe(panes, extra = {}) {
  return jugerLeParc({
    agents: normaliserLeParc({ panes, agentsHerdr: registreQuiAVu(panes) }),
    registre: { declarations: [], illisibles: [] },
    roleDuLieu: () => null,
    portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
    ...extra,
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
    agent_session: 'session-jamais-vue',
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
          const espace = {
            'après': `${WT}/20260825-093000`,
            'avant': `${WT}/20260724-204645`,
            'non datable': `${WT}/t-0043`,
          }[naissance] + (lieu === 'non établi' ? '' : '/.orchestrateur/batiscan');

          const pane = {
            agent: true, agent_session: 'ses', pane_id: 'w1:p1',
            herdr_socket: SOCKET_S1, foreground_cwd: espace,
            name: nom === 'conforme' ? 'batiscan' : nom === 'non conforme' ? 'Agent Infra-Ops' : null,
          };
          const agentsHerdr = nom === 'non mesuré' ? [] : [{ ...pane }];

          const r = jugerLeParc({
            agents: normaliserLeParc({ panes: [pane], agentsHerdr }),
            registre: {
              declarations: decl === 'déclaré'
                ? [{ nom: 'peu-importe', pane: 'w1:p1', session_herdr: 's1', espace, ne_le: '2026-08-25T13:30:00.000Z' }]
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
          const dansLaPopulation = naissance === 'après';
          const uneSourceEtablie = decl === 'déclaré' || lieu === 'établi';
          const uneSourceRefusee = lieu === 'refusé' || nom === 'non mesuré';
          const attendu = !dansLaPopulation
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

test('reculer la frontière fait REFUSER la garde dès qu’une déclaration la dément', () => {
  const declarations = [{ nom: 'ristigouche', pane: 'w0:p0', espace: APRES, ne_le: '2026-08-25T13:30:00.000Z' }];

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
      registre: { declarations: [{ nom: 'ristigouche', ne_le: '2026-08-25T13:30:00.000Z' }], illisibles: [] },
      miseEnService: '20260901-000000',
    });
    assert.fail('la garde a laissé passer une frontière contredite');
  } catch (e) {
    assert.ok(e instanceof FrontiereContredite);
    assert.match(e.message, /ristigouche/);
    assert.match(e.message, /2026-08-25/);
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

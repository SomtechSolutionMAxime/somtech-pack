// un-refus-muet-est-aussi-un-refus-a-tort.test.js — LE CONTRE-CONTRÔLE VOIT AUSSI CE QUE LA
// GARDE A TU. (D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LE DÉFAUT QUE CE BANC FERME — MESURÉ SUR LE PARC RÉEL, LE 2026-08-25
//
// La couverture temporelle (`couvertureDeLaDeclaration`) a la bonne polarité : une déclaration
// plus jeune que l'agent qu'elle apparie n'identifie plus, et l'agent tombe chez les NON
// MESURÉS — jamais chez les prises. On n'accuse pas sur une mesure qui ne tranche pas.
//
// Mais `fauxRefus` ne croisait QUE LES PRISES. Un agent que la règle temporelle écarte tombe
// donc dans un panier que le contre-contrôle ne regarde pas — et le compteur rend `0` pendant
// que la garde vient d'en mal classer un. Mesuré, dans la MÊME page de sortie :
//
//     • t-20260825-0047 — sa déclaration de naissance : la déclaration qui l'apparie a été
//       inscrite 13999 s AVANT sa naissance — … je ne l'identifie pas là-dessus
//     …
//     refus à tort (mesurés) : 0
//
// La ligne de l'agent le dit. Le chiffre le nie. C'est la forme « un compte juste dans une
// phrase fausse » : un opérateur qui lit « refus à tort : 0 » conclut que la garde n'en fait
// aucun, alors qu'il lui faudrait relire les 17 lignes de prises ET les non mesurés pour voir
// le contraire. Le chiffre existe précisément pour lui éviter ça.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI DEUX CHIFFRES ET NON UN SEUL ÉLARGI
//
// Les deux natures ne coûtent pas la même chose et n'appellent pas le même geste :
//   · parmi les PRISES — la garde ACCUSE quelqu'un à tort. On va voir l'agent, on répare
//     l'APPARIEMENT.
//   · parmi les NON MESURÉS — la garde AVOUE ne pas savoir alors qu'une déclaration porte son
//     espace. Personne n'est accusé ; c'est la MESURE qu'on va réparer (la sonde de datation).
//
// Sur le parc réel du 2026-08-25 la répartition est 0 / 1 : tout le signal du jour est de la
// SECONDE nature. Un chiffre unique aurait donc rendu « 1 » et envoyé l'opérateur chercher un
// fautif parmi 17 prises où il n'y en a aucun — le même défaut qu'on ferme, d'un cran plus bas.
// Deux chiffres NOMMÉS, chacun avec sa population dans sa propre étiquette.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  jugerLeParc,
  normaliserLeParc,
  TOLERANCE_DE_DATATION_MS,
  VERDICTS,
} from '../src/garde-des-naissances.js';

const socketDe = (nom) => `/bac/.config/herdr/sessions/${nom}/herdr.sock`;
const SOCKET_S1 = socketDe('s1');
const WT = '/bac/worktrees/un-depot';
const APRES = `${WT}/20260825-093000`;

// ⚠️ EN UTC, ET À TREIZE HEURES DE LA FRONTIÈRE. `MISE_EN_SERVICE` se lit en heure LOCALE :
// un instant choisi à quelques heures d'elle tomberait du bon côté chez l'auteur et du mauvais
// en CI. Celui-ci est du même côté sous tous les fuseaux — c'est ce qui rend ce banc portable.
const NE_APRES = Date.parse('2026-08-25T17:30:00.000Z');

const sessionDe = (pane) => ({ agent: 'claude', kind: 'id', source: 'herdr:claude', value: `sess-${pane}` });

const agent = (sur = {}) => {
  const dossier = { pane_id: 'w1:p1', herdr_socket: SOCKET_S1, foreground_cwd: APRES, ...sur };
  return { agent_session: sessionDe(dossier.pane_id), ...dossier };
};

const declaration = (sur = {}) => ({
  version: 1,
  nom: 'ristigouche',
  role: 'orchestrateur',
  mandat: 'T-20260825-0013',
  espace: APRES,
  pane: 'w1:p1',
  session_herdr: 's1',
  ne_le: new Date(NE_APRES + 2_000).toISOString(),
  pose_par: 'pack agent naitre',
  ...sur,
});

/**
 * LA DÉCLARATION QUI NE COUVRE PLUS SON AGENT — dérivée de la tolérance, jamais recopiée.
 *
 * ⚠️ ELLE S'OBTIENT DE `TOLERANCE_DE_DATATION_MS`, la constante que le code JUGÉ emploie. Un
 * écart écrit à la main ici deviendrait faux le jour où la tolérance bouge, et le banc
 * continuerait à passer en éprouvant un autre cas que celui qu'il annonce.
 */
const declarationPerimee = (sur = {}) =>
  declaration({ ne_le: new Date(NE_APRES - TOLERANCE_DE_DATATION_MS - 3_600_000).toISOString(), ...sur });

const registreQuiAVuSansNommer = (panes) =>
  panes.map((p) => ({ pane_id: p.pane_id, herdr_socket: p.herdr_socket, agent: true, name: null }));

/** `null` pour un pane = « celui-là, je n'ai pas su le dater » — un NON MESURÉ, jamais un vert. */
function naissancesDe(panes, nes = {}) {
  const instants = new Map();
  for (const p of panes) {
    const id = p?.agent_session?.value;
    if (!id) continue;
    const quand = Object.prototype.hasOwnProperty.call(nes, p.pane_id) ? nes[p.pane_id] : NE_APRES;
    if (quand !== null) instants.set(id, quand);
  }
  return { mesure: 'lue', instants, illisibles: 0 };
}

function juger({ panes = [agent()], declarations = [], nes = {} } = {}) {
  return jugerLeParc({
    agents: normaliserLeParc({ panes, agentsHerdr: registreQuiAVuSansNommer(panes), naissances: naissancesDe(panes, nes) }),
    registre: { declarations, illisibles: [] },
    roleDuLieu: () => null,
    portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1. LE CAS RÉEL — celui que j'ai lu sur le parc, à l'écran, le 2026-08-25
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 UN AGENT ÉCARTÉ PAR LA RÈGLE TEMPORELLE SE COMPTE — le compteur ne rend plus 0 pendant que la garde en mal classe un', () => {
  const r = juger({ declarations: [declarationPerimee()] });

  // Le cas de base, d'abord : c'est bien un NON MESURÉ, pas une prise. Si ça change, ce banc
  // n'éprouve plus le contre-contrôle mais autre chose.
  assert.equal(r.comptes.nonMesures, 1, 'le cas de base a changé : ce banc n’éprouve plus ce qu’il annonce');
  assert.equal(r.comptes.prises, 0);
  assert.match(r.nonMesures[0].raisons.join(' '), /AVANT sa naissance/);

  // Le défaut : le contre-contrôle regardait ailleurs.
  assert.equal(
    r.comptes.fauxRefusNonMesures, 1,
    'une déclaration porte son espace de travail, et le seul chiffre qui mesure les refus à tort rend zéro',
  );
  assert.equal(r.fauxRefusNonMesures[0].designation, r.nonMesures[0].designation);

  // Et il se NOMME dans le rendu — un compte ne se corrige pas, on va voir un agent.
  assert.match(r.texte, /peut-être été À TORT/);
  assert.match(r.texte, new RegExp(APRES.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2. LE CHIFFRE NE MENT PAS SUR SA POPULATION — la phrase suit le calcul
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 AUCUNE LIGNE DE « REFUS À TORT » N’EST NUE — chacune nomme la population qu’elle compte', () => {
  const r = juger({ declarations: [declarationPerimee()] });

  const lignes = r.texte.split('\n').filter((l) => /^refus à tort/.test(l));
  assert.equal(lignes.length, 2, 'les deux natures doivent sortir, chacune sur sa ligne');
  for (const ligne of lignes) {
    assert.match(
      ligne,
      /parmi les (PRISES|NON MESURÉS)/,
      `un chiffre de refus à tort sans sa population : « ${ligne} » — le lecteur en conclut « aucun »`,
    );
  }
  assert.match(r.texte, /parmi les PRISES[^\n]*:\s*0/);
  assert.match(r.texte, /parmi les NON MESURÉS[^\n]*:\s*1/);
});

test('🔴 CHAQUE MÉTHODE DÉCRIT LA POPULATION QU’ELLE FILTRE VRAIMENT, ET PAS L’AUTRE', () => {
  const r = juger({ declarations: [declarationPerimee()] });

  // ⚠️ C'EST LA REVENDICATION DE POPULATION QU'ON ÉPINGLE — « parmi les X » — et pas le simple
  // mot. Chaque phrase doit pouvoir renvoyer à l'autre en prose sans faire rougir ce banc ;
  // ce qu'elle ne peut pas faire, c'est s'ATTRIBUER la population que son filtre ne touche pas.
  assert.match(r.methode.fauxRefus, /parmi les prises/i);
  assert.doesNotMatch(
    r.methode.fauxRefus,
    /parmi les non mesur/i,
    'la méthode de ce chiffre-ci s’attribue une population qu’il ne filtre pas',
  );

  assert.match(r.methode.fauxRefusNonMesures, /parmi les non mesur/i);
  assert.doesNotMatch(
    r.methode.fauxRefusNonMesures,
    /parmi les prises/i,
    'la méthode de ce chiffre-là s’attribue une population qu’il ne filtre pas',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3. LA RÈGLE D'ESPACE EST LA MÊME DES DEUX CÔTÉS — et sa moitié symétrique
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un NON MESURÉ descendu dans un sous-dossier de son espace déclaré se compte', () => {
  // ⚠️ Non mesuré par la DATATION cette fois — l'autre porte d'entrée du panier. Le prédicat du
  // contre-contrôle est uniforme sur les non mesurés : ce qu'on mesure est « une déclaration
  // porte son espace », pas « pourquoi il n'a pas été mesuré ».
  const r = juger({
    panes: [agent({ foreground_cwd: `${APRES}/naissance-representant/src` })],
    declarations: [declaration()],
    nes: { 'w1:p1': null },
  });
  assert.equal(r.comptes.nonMesures, 1);
  assert.equal(r.comptes.fauxRefusNonMesures, 1, 'la règle de préfixe ne s’applique pas des deux côtés');
});

test('un espace déclaré VOISIN n’est pas le même — `…-bis` ne mesure aucun refus à tort muet', () => {
  // La moitié symétrique : un préfixe NU rendrait `…-bis` indiscernable, et le chiffre
  // cesserait de vouloir dire quelque chose.
  const r = juger({
    panes: [agent({ foreground_cwd: `${APRES}-bis` })],
    declarations: [declaration()],
    nes: { 'w1:p1': null },
  });
  assert.equal(r.comptes.nonMesures, 1);
  assert.equal(r.comptes.fauxRefusNonMesures, 0, 'un worktree voisin a été compté comme un refus à tort');
});

test('un registre VIDE ne fabrique aucun refus à tort muet', () => {
  const r = juger({ declarations: [], nes: { 'w1:p1': null } });
  assert.equal(r.comptes.nonMesures, 1);
  assert.equal(r.comptes.fauxRefusNonMesures, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4. LA POLARITÉ NE CHANGE PAS — un détecteur, jamais un correctif
// ═══════════════════════════════════════════════════════════════════════════════════════

test('🔴 LE CONTRE-CONTRÔLE NE DÉPLACE PERSONNE — ni un non mesuré en prise, ni l’inverse', () => {
  const r = juger({
    panes: [
      agent({ pane_id: 'w1:p1' }),                                        // non mesuré : déclaration périmée
      agent({ pane_id: 'w1:p2', foreground_cwd: `${WT}/20260825-094000` }), // prise : rien ne l'apparie
    ],
    declarations: [
      declarationPerimee(),
      // Une déclaration qui porte l'espace du PRIS, sans l'apparier (autre pane, autre session,
      // autre nom) : c'est un faux refus de la PREMIÈRE nature.
      declaration({ nom: 'batiscan', pane: 'w9:p9', session_herdr: 'ailleurs', espace: `${WT}/20260825-094000` }),
    ],
  });

  assert.equal(r.comptes.prises, 1, 'le contre-contrôle a fait bouger un agent de panier');
  assert.equal(r.comptes.nonMesures, 1, 'le contre-contrôle a fait bouger un agent de panier');
  assert.equal(r.comptes.population, 2);
  assert.equal(r.verdict, VERDICTS.NES_HORS_DISPOSITIF, 'la prise passe avant : la polarité du verdict ne bouge pas');

  // Les deux chiffres, chacun sur sa population — et chaque membre vient bien de son panier.
  assert.equal(r.comptes.fauxRefus, 1);
  assert.equal(r.comptes.fauxRefusNonMesures, 1);
  for (const f of r.fauxRefus) {
    assert.ok(r.prises.some((p) => p.designation === f.designation), 'un « refus à tort parmi les prises » qui n’est pas une prise');
  }
  for (const f of r.fauxRefusNonMesures) {
    assert.ok(r.nonMesures.some((n) => n.designation === f.designation), 'un « refus à tort parmi les non mesurés » qui n’en est pas un');
  }
  assert.notEqual(r.fauxRefus[0].designation, r.fauxRefusNonMesures[0].designation);
});

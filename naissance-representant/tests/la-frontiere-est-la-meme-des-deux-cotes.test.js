// la-frontiere-est-la-meme-des-deux-cotes.test.js — LA SECONDE OÙ LE PRODUCTEUR ET LE JUGE SE
// TOUCHENT. (D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 POURQUOI CE BANC EXISTE — LA TROISIÈME JOINTURE NON GARDÉE DE CE LOT
//
// `MISE_EN_SERVICE` borne DEUX gestes qui ne vivent pas dans le même module :
//
//   • le PRODUCTEUR — `exigerUnHorodatageDEspace` (`chef-equipe.js`) REFUSE de faire naître un
//     agent dont l'espace porte un horodatage `< frontiere` ;
//   • le JUGE — `jugerLeParc` (`garde-des-naissances.js`) range en `horsPortee`, donc ne juge
//     JAMAIS, un agent dont l'espace porte un horodatage `< frontiere`.
//
// Les deux doivent tomber du même côté SUR LA MÊME SECONDE. Le producteur l'affirme en toutes
// lettres — « la borne est celle de la garde AU CARACTÈRE PRÈS » — et cette affirmation n'était
// gardée QUE PAR DE LA PROSE : deux mutations survivaient à la suite entière (738/738 verts),
// `<` → `<=` de chaque côté.
//
// ⚠️ CE QUI CASSE. Avec `<=` chez le juge, un espace nommé `20260825-000000` — que le
// producteur ACCEPTE explicitement — bascule en `horsPortee`. **Le dispositif ferait naître,
// par son propre geste, un agent qu'il ne jugerait jamais** : le désarmement par le côté
// naissance que `T-20260825-0013` existe pour fermer, rouvert d'une seconde, sans un rouge.
//
// ⚠️ POURQUOI LES BANCS EXISTANTS NE POUVAIENT PAS LE VOIR. `naitre-bin.test.js` éprouve la
// frontière exacte — mais SUR LE SEUL PRODUCTEUR. Côté juge, `MISE_EN_SERVICE` n'apparaît dans
// les trois bancs de la garde que dans deux assertions de FORME : aucun n'y plaçait un agent à
// l'horodatage exact de la frontière. Chacun gardait son côté ; la jointure n'appartenait à
// personne. C'est le motif « deux étages justes dont la jointure n'est pas gardée », pour la
// troisième fois dans ce lot.
//
// ⚠️ CE BANC NE RECOPIE DONC AUCUNE DATE. Il part de la constante RÉELLE et éprouve les deux
// côtés SUR LA MÊME VALEUR — sans quoi il mesurerait deux frontières au lieu d'une.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  exigerUnHorodatageDEspace,
  HorodatageAvantLaMiseEnService,
} from '../src/chef-equipe.js';
import {
  MISE_EN_SERVICE,
  FrontiereContredite,
  instantDeLHorodatage,
  normaliserLeParc,
  jugerLeParc,
} from '../src/garde-des-naissances.js';

/** L'horodatage que `claude-swt` écrirait pour cet instant-là — en HEURE LOCALE, comme lui. */
function horodatageDe(instant) {
  const d = (n) => String(n).padStart(2, '0');
  return (
    `${instant.getFullYear()}${d(instant.getMonth() + 1)}${d(instant.getDate())}-` +
    `${d(instant.getHours())}${d(instant.getMinutes())}${d(instant.getSeconds())}`
  );
}

/** Une seconde avant / après la frontière — DÉRIVÉES de la constante, jamais recopiées. */
const LA_FRONTIERE = MISE_EN_SERVICE;
const UNE_SECONDE_AVANT = horodatageDe(new Date(instantDeLHorodatage(MISE_EN_SERVICE).getTime() - 1000));
const UNE_SECONDE_APRES = horodatageDe(new Date(instantDeLHorodatage(MISE_EN_SERVICE).getTime() + 1000));

/**
 * LE JUGE, sur un agent NÉ à cet horodatage-là.
 *
 * 🔴 CE HARNAIS NOURRISSAIT LE JUGE PAR LE NOM DU RÉPERTOIRE DE TRAVAIL, parce que c'est là
 * qu'il lisait la naissance. Il la lit désormais sur la SESSION de l'agent — le répertoire date
 * le worktree, pas l'agent, et une reprise naît aujourd'hui dans un répertoire d'hier.
 *
 * ⚠️ CE QUE CE BANC GARDE N'A PAS BOUGÉ D'UN POUCE : les deux côtés se comparent-ils à la MÊME
 * seconde, et du même côté de `<` ? Le producteur juge l'horodatage qu'il va écrire, le juge
 * juge la naissance qui en découle. On dérive donc l'instant de la MÊME chaîne, par la MÊME
 * fonction — sans quoi ce banc comparerait deux frontières au lieu d'une.
 */
function leJugeRange(horodatage) {
  const ne = instantDeLHorodatage(horodatage);
  const v = jugerLeParc({
    agents: normaliserLeParc({
      panes: [{
        pane_id: 'w1:p1',
        agent_session: { agent: 'claude', kind: 'id', source: 'herdr:claude', value: 'sess-frontiere' },
        foreground_cwd: `/bac/worktrees/un-depot/${horodatage}`,
        herdr_socket: '/bac/.config/herdr/sessions/s1/herdr.sock',
      }],
      agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: '/bac/.config/herdr/sessions/s1/herdr.sock', name: null }],
      naissances: { mesure: 'lue', illisibles: 0, instants: new Map([['sess-frontiere', ne.getTime()]]) },
    }),
    registre: { declarations: [], illisibles: [] },
    portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
  });
  return v.comptes.horsPortee ? 'hors portée' : 'dans la population';
}

/** LE PRODUCTEUR, sur le MÊME horodatage. */
function leProducteurAccepte(horodatage) {
  try {
    exigerUnHorodatageDEspace(horodatage);
    return true;
  } catch (err) {
    if (err instanceof HorodatageAvantLaMiseEnService) return false;
    throw err;
  }
}

test('🔴 LA FRONTIÈRE EXACTE : le producteur l’ACCEPTE et le juge la JUGE — la même seconde, la même valeur', () => {
  // ⚠️ LE CŒUR. C'est la seule seconde où les deux bornes se touchent, et c'est là que `<` et
  // `<=` cessent d'être équivalents. Un `<=` chez le juge ferait naître par le geste un agent
  // que la garde ne regarderait jamais.
  assert.equal(leProducteurAccepte(LA_FRONTIERE), true, 'le producteur accepte la frontière elle-même');
  assert.equal(
    leJugeRange(LA_FRONTIERE),
    'dans la population',
    'donc le juge DOIT la juger — sans quoi le dispositif fait naître ce qu’il ne garde pas'
  );
});

test('🔴 UNE SECONDE AVANT : le producteur REFUSE et le juge écarte — les deux du même côté', () => {
  assert.equal(leProducteurAccepte(UNE_SECONDE_AVANT), false);
  assert.equal(leJugeRange(UNE_SECONDE_AVANT), 'hors portée');
});

test('UNE SECONDE APRÈS : les deux l’acceptent — la borne ne mord que d’un côté', () => {
  assert.equal(leProducteurAccepte(UNE_SECONDE_APRES), true);
  assert.equal(leJugeRange(UNE_SECONDE_APRES), 'dans la population');
});

test('🔴 LES DEUX CÔTÉS S’ACCORDENT SUR CHAQUE SECONDE DE LA FENÊTRE — accepté ⟺ jugé', () => {
  // ⚠️ L'ÉQUIVALENCE, PAS DEUX CONSTATS CÔTE À CÔTE. C'est elle que la prose affirme (« au
  // caractère près ») ; un banc qui vérifierait chaque côté séparément laisserait les deux
  // dériver ensemble. On exige donc qu'ACCEPTÉ et JUGÉ soient le MÊME prédicat, seconde
  // par seconde autour du point de contact.
  const base = instantDeLHorodatage(MISE_EN_SERVICE).getTime();
  for (let ecart = -3; ecart <= 3; ecart += 1) {
    const h = horodatageDe(new Date(base + ecart * 1000));
    assert.equal(
      leProducteurAccepte(h),
      leJugeRange(h) === 'dans la population',
      `à ${ecart}s de la frontière (${h}) : le producteur et le juge ne rangent pas cet agent du même côté`
    );
  }
});

test('🔴 UNE DÉCLARATION INSCRITE À LA SECONDE EXACTE DE LA FRONTIÈRE NE LA CONTREDIT PAS', () => {
  // ⚠️ LA TROISIÈME BORNE, ET ELLE EST DE L'AUTRE POLARITÉ. `verifierLaFrontiere` REFUSE de
  // rendre un verdict quand une déclaration PROUVE que le dispositif tournait déjà avant la
  // frontière. Un `<=` ici ferait de la frontière elle-même une contradiction : la garde
  // refuserait de se prononcer sur un poste parfaitement régulier — et un refus permanent se
  // désarme aussi vite qu'un rouge permanent.
  const aLaFrontiere = instantDeLHorodatage(MISE_EN_SERVICE).toISOString();
  const juger = (ne_le) =>
    jugerLeParc({
      agents: [],
      registre: { declarations: [{ nom: 'matapedia', espace: '/bac/x', ne_le }], illisibles: [] },
      portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
    });

  assert.doesNotThrow(() => juger(aLaFrontiere), 'la frontière elle-même n’est pas « avant » elle-même');

  // Une milliseconde avant, en revanche, PROUVE que le dispositif était déjà en service.
  const uneMsAvant = new Date(Date.parse(aLaFrontiere) - 1).toISOString();
  assert.throws(() => juger(uneMsAvant), FrontiereContredite, 'un fait antérieur à la frontière la dément');
});

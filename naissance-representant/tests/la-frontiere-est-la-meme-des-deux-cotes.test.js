// la-frontiere-est-la-meme-des-deux-cotes.test.js — LA SECONDE OÙ LES DEUX LECTURES DE LA
// FRONTIÈRE SE TOUCHENT. (D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE BANC A CHANGÉ DE SUJET, PARCE QUE SON SUJET A DISPARU
//
// Il gardait la jointure entre le PRODUCTEUR et le JUGE :
//
//   • le producteur — `exigerUnHorodatageDEspace` — REFUSAIT un horodatage `< frontiere` ;
//   • le juge — `jugerLeParc` — rangeait en `horsPortee` un agent dont l'ESPACE portait un
//     horodatage `< frontiere`.
//
// La seconde moitié n'existe plus : la garde borne sa population sur la NAISSANCE DE L'AGENT,
// lue au transcrit de sa session, et `horodatageDuChemin` le dit lui-même — « IL NE DÉCIDE PLUS
// DE RIEN, ET C'EST LE CORRECTIF ». Le producteur a donc perdu son second terme (voir
// `chef-equipe.js`), et cette jointure-là n'a plus de deux côtés.
//
// ⚠️ ET CE BANC LA FABRIQUAIT. Son harnais donnait au juge une naissance ÉGALE à l'instant de
// l'horodatage du chemin — `instantDeLHorodatage(horodatage)` — c'est-à-dire la coïncidence que
// la chaîne réelle ne produit plus : `naitre --horodatage H` crée un espace nommé H et fait
// naître un agent MAINTENANT. Le banc était vert sur un appelant qu'il inventait lui-même.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI RESTE, ET QUI EST BIEN UNE JOINTURE À DEUX CÔTÉS
//
// `MISE_EN_SERVICE` est lue par DEUX fonctions du même module, DANS DEUX POLARITÉS OPPOSÉES,
// et les deux comparent par un `<` STRICT :
//
//   • `jugerLeParc` — `a.naissance.instant < frontiere` ⇒ HORS PORTÉE. Un `<=` ici sortirait de
//     la population l'agent né À la seconde de la frontière : le dispositif ferait naître ce
//     qu'il ne garderait jamais. C'est le désarmement que `T-20260825-0013` existe pour fermer.
//
//   • `verifierLaFrontiere` — `plusAncienne.ne_le < frontiere` ⇒ REFUS GLOBAL. Un `<=` ici
//     ferait de la frontière elle-même une contradiction : la garde refuserait de se prononcer
//     sur un poste parfaitement régulier, et un refus permanent se désarme aussi vite qu'un
//     rouge permanent.
//
// Les deux doivent tomber du même côté SUR LA MÊME SECONDE, et personne ne gardait ce point de
// contact : chacune était éprouvée chez elle, la seconde exacte n'appartenait à aucune des deux.
//
// ⚠️ CE BANC NE RECOPIE AUCUNE DATE. Il part de la constante RÉELLE et dérive tout d'elle —
// sans quoi il mesurerait deux frontières au lieu d'une.
// ═══════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MISE_EN_SERVICE,
  FrontiereContredite,
  instantDeLHorodatage,
  normaliserLeParc,
  jugerLeParc,
} from '../src/garde-des-naissances.js';

const FRONTIERE = instantDeLHorodatage(MISE_EN_SERVICE).getTime();
const SOCKET = '/bac/.config/herdr/sessions/s1/herdr.sock';

/**
 * LE JUGE, sur un agent NÉ à cet instant-là.
 *
 * ⚠️ LA NAISSANCE ENTRE PAR LA SESSION, pas par le nom du répertoire — c'est là que la garde la
 * lit depuis ce lot. L'espace porte un nom quelconque et RESTE FIXE d'un cas à l'autre : s'il
 * variait avec l'instant, ce banc remesurerait le prédicat aboli sans s'en apercevoir.
 */
function leJugeRange(instant) {
  const v = jugerLeParc({
    agents: normaliserLeParc({
      panes: [{
        pane_id: 'w1:p1',
        agent_session: { agent: 'claude', kind: 'id', source: 'herdr:claude', value: 'sess-frontiere' },
        foreground_cwd: '/bac/worktrees/un-depot/un-espace-quelconque',
        herdr_socket: SOCKET,
      }],
      agentsHerdr: [{ pane_id: 'w1:p1', herdr_socket: SOCKET, name: null }],
      naissances: { mesure: 'lue', illisibles: 0, instants: new Map([['sess-frontiere', instant]]) },
    }),
    registre: { declarations: [], illisibles: [] },
    portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
  });
  return v.comptes.horsPortee ? 'hors portée' : 'dans la population';
}

/** L'ÉPINGLE DE LA FRONTIÈRE, sur une déclaration inscrite à cet instant-là. */
function leRegistreContredit(instant) {
  try {
    jugerLeParc({
      agents: [],
      registre: {
        declarations: [{ nom: 'matapedia', espace: '/bac/x', ne_le: new Date(instant).toISOString() }],
        illisibles: [],
      },
      portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
    });
    return false;
  } catch (err) {
    if (err instanceof FrontiereContredite) return true;
    throw err;
  }
}

test('🔴 LA FRONTIÈRE EXACTE : l’agent né À cette seconde EST jugé — « antérieur » est strict', () => {
  // ⚠️ C'EST LA SEULE SECONDE OÙ `<` ET `<=` CESSENT D'ÊTRE ÉQUIVALENTS. Un `<=` chez le juge
  // sortirait de la population un agent que le dispositif vient de faire naître.
  assert.equal(leJugeRange(FRONTIERE), 'dans la population');
});

test('🔴 LA FRONTIÈRE EXACTE : une déclaration inscrite À cette seconde NE la contredit PAS', () => {
  // ⚠️ L'AUTRE POLARITÉ, SUR LA MÊME SECONDE. Un `<=` ici ferait de la frontière elle-même une
  // contradiction, et la garde refuserait de se prononcer sur un poste parfaitement régulier.
  assert.equal(leRegistreContredit(FRONTIERE), false);
});

test('🔴 UNE MILLISECONDE AVANT, LES DEUX BASCULENT — et elles basculent ENSEMBLE', () => {
  // ⚠️ L'ÉQUIVALENCE, PAS DEUX CONSTATS CÔTE À CÔTE. Les deux lectures doivent partager la même
  // seconde : un banc qui vérifierait chaque côté séparément laisserait les deux dériver
  // ensemble. On exige donc que « hors portée » et « contredit » soient le MÊME prédicat,
  // milliseconde par milliseconde autour du point de contact.
  for (const ecart of [-2, -1, 0, 1, 2]) {
    const t = FRONTIERE + ecart;
    assert.equal(
      leJugeRange(t) === 'hors portée',
      leRegistreContredit(t),
      `à ${ecart} ms de la frontière : le juge et l’épingle ne rangent pas cet instant du même côté`
    );
  }
});

test('un registre VIDE ne contredit rien, et un agent né bien après reste jugé', () => {
  // Les deux replis commodes, fermés : l'épingle ne mord que sur des FAITS, et la population ne
  // se vide pas d'elle-même.
  assert.equal(leJugeRange(FRONTIERE + 86_400_000), 'dans la population');
  assert.doesNotThrow(() =>
    jugerLeParc({
      agents: [],
      registre: { declarations: [], illisibles: [] },
      portee: { sessionsInterrogees: 1, sessionsRefusees: [] },
    })
  );
});

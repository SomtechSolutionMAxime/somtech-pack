// À QUOI ON RECONNAÎT QUELQU'UN DE LA MAISON — et pourquoi la réponse tenait à un objet.
//
// (T-20260818-0046)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT, VÉCU EN PRODUCTION LE 2026-08-18
//
// L'orchestrateur du jalon a été rendu MUET vers le dirigeant. Le refus, mot pour mot :
//
//   #batiscan porte maxime.leboeuf, qui ne semble pas de la maison — rien n'est écrit.
//
// Le dirigeant est PROPRIÉTAIRE de l'espace Slack (`Admin: Yes · Owner: Yes · Restricted: No`).
// Ce n'est donc pas le critère de l'invité qui le rejetait — c'était l'autre :
//
//   cloisonnement.js :  if (nous && p.equipe && p.equipe !== nous) return true;
//
//   • `nous`     ← `identite()` rendait `equipe: d.team`     → « Somtech Solution »  (un NOM)
//   • `p.equipe` ← `membresDuCanal()` rend `equipe: u.team_id` → « T091JB7AVJ4 »     (un ID)
//
// Deux objets différents, comparés par égalité. **La condition était vraie pour TOUT membre de
// l'espace** — la garde n'a jamais pu rendre autre chose qu'« étranger ».
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE QUE CE DÉFAUT COÛTAIT VRAIMENT, ET CE N'EST PAS LE BLOCAGE
//
// Cette garde existe pour empêcher un client d'atterrir dans un canal interne (Loi 25). Comme
// elle refusait tout le monde, **elle n'a jamais trié personne** : le cloisonnement était
// nominal, pas réel. Ce lot ne l'assouplit pas — il la rend EFFECTIVE.
//
// LES DEUX CHIFFRES, mesurés sur le trafic réel du poste (27 lignes ouvertes, 31 jugements
// portés sur des personnes réelles, robots et profils illisibles exclus) :
//
//                       attrape un vrai étranger   refuse à TORT   laisse passer un étranger
//   AVANT ce lot                  3                     28                    0
//   APRÈS ce lot                  3                      0                    0
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ POURQUOI AUCUN DES 570 ESSAIS NE LE VOYAIT — c'est la leçon transportable
//
// Le double de Slack rendait `auth.test → { team: 'T_ESSAIS' }`, c'est-à-dire l'IDENTIFIANT là
// où le vrai service rend le NOM. Et les essais du cloisonnement fabriquaient l'identité du
// veilleur à la main. **Le banc comparait donc un identifiant à un identifiant** — la seule
// façon pour cette garde d'être verte. Un double plus cohérent que le service qu'il double
// rend un vert qui ne dit rien.
//
// Les deux sont corrigés avec ce lot : le double distingue `team` de `team_id`, et
// `cloisonnement-en-usage.test.js` LIT son identité par le même chemin que la production.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';
import * as slack from '../src/slack.js';

let Veilleur, sauverRegistre;
let racine;
let compteur = 0;

const UMOI = 'UMOI';
const UDIR = 'UDIR';
const PANE = 'w1:p1';
/** L'identifiant de l'espace — ce que `users.info` porte sur chaque membre. */
const EQUIPE = 'T_ESSAIS';
/** Son nom — ce que `auth.test` rend en `team`. Différent, comme chez le vrai Slack. */
const EQUIPE_NOM = 'Espace des essais';
const DIRIGEANT = { id: UDIR, courriel: 'dirigeant@somtech.ca' };

const ROBOT = { id: UMOI, name: 'ligne_directe', is_bot: true, team_id: EQUIPE, profile: { display_name: 'ligne_directe' } };
/** Le dirigeant tel que Slack le rend RÉELLEMENT : membre plein, propriétaire, pas invité. */
const LE_DIRIGEANT = { id: UDIR, name: 'maxime', team_id: EQUIPE, is_admin: true, is_owner: true, profile: { display_name: 'maxime.leboeuf' } };
/** Un client : Slack marque `is_restricted` les gens qu'on invite. */
const UN_CLIENT = { id: 'UCLI', name: 'charles', is_restricted: true, team_id: EQUIPE, profile: { display_name: 'Charles-Olivier' } };
/** Quelqu'un d'une AUTRE organisation Slack — la porte de Slack Connect. */
const UNE_AUTRE_ORG = { id: 'UEXT', name: 'ailleurs', team_id: 'T_AUTRE_ORG', profile: { display_name: 'Quelqu’un d’ailleurs' } };

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-maison-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre } = await import('../src/registre.js'));
});
after(() => rmSync(racine, { recursive: true, force: true }));
beforeEach(() => sauverRegistre({ version: 1, lignes: [], commun: null, dirigeant: DIRIGEANT }));

function agentsQuiVivent() {
  return {
    async vivant() {
      return true;
    },
    async remettre() {
      return { delivered: true };
    },
    async agents() {
      return [{ agent: 'claude', pane_id: PANE, herdr_socket: null }];
    },
  };
}

/** Une ligne interne déjà ouverte, avec sa photo — celle de `#batiscan` le jour du défaut. */
const ligneInterne = () => ({
  chantier: 'j-1',
  canal_id: 'C1',
  canal_nom: 'batiscan',
  pane: PANE,
  worktree: '/w',
  nature: 'interne',
  libelle: 'j-1',
  autorises: [UDIR],
  membres_vus: [UMOI, UDIR],
  pair: null,
  visage: '🧭',
  ouverte_le: 'hier',
  close_le: null,
});

/**
 * Un poste dont l'identité est LUE COMME EN PRODUCTION.
 *
 * ⚠️ `identite` n'est pas un paramètre de cette aide, et c'est délibéré : le moment où un essai
 * peut choisir ce que la garde comparera est le moment où il cesse d'éprouver la production.
 */
async function avecPoste({ canaux = [], utilisateurs = [], lignes = [] }, corps) {
  sauverRegistre({ version: 1, lignes, commun: null, dirigeant: DIRIGEANT });
  const monde = fauxSlack({ canaux, utilisateurs, robot: UMOI, espace: EQUIPE, espaceNom: EQUIPE_NOM }).installer();
  const identite = await slack.identite('xoxb-x');
  const v = new Veilleur({
    cheminSocket: join(racine, `m-${(compteur += 1)}.sock`),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite,
    herdr: agentsQuiVivent(),
  });
  await v.ecouterLocal();
  try {
    return await corps({ monde, veilleur: v, identite });
  } finally {
    await v.arreter();
    monde.restaurer();
  }
}

// ═════════════════ 1. CE QUE L'IDENTITÉ DE L'ESPACE PORTE

test('L’IDENTITÉ DE L’ESPACE PORTE SON IDENTIFIANT, PAS SEULEMENT SON NOM', async () => {
  // ⚠️ MESURÉ contre le vrai Slack le 2026-08-18 avec le jeton du robot :
  //   { ok: true, team: "Somtech Solution", team_id: "T091JB7AVJ4", … }
  // Le `[non établi]` du brief portait exactement là-dessus : `auth.test` rend-il un `team_id`
  // utilisable ? Oui. Ce qui suit s'appuie sur une mesure, pas sur une lecture de la doc.
  const monde = fauxSlack({ robot: UMOI, espace: EQUIPE, espaceNom: EQUIPE_NOM }).installer();
  try {
    const i = await slack.identite('xoxb-x');
    assert.equal(i.equipeId, EQUIPE, 'l’identifiant est ce que la garde compare aux profils');
    assert.equal(i.equipe, EQUIPE_NOM, 'et le nom reste — c’est lui qu’un humain lit dans le journal');
    assert.notEqual(i.equipe, i.equipeId, 'les deux ne sont PAS le même objet : tout le défaut tient là');
  } finally {
    monde.restaurer();
  }
});

// ═════════════════ 2. LE FAIT VÉCU — LE DIRIGEANT SUR SA PROPRE LIGNE

test('LE DIRIGEANT REÇOIT LE MESSAGE SUR SA LIGNE INTERNE — le fait du 2026-08-18', async () => {
  // Le scénario exact : `#batiscan`, le robot, le dirigeant, un orchestrateur qui écrit.
  // ⚠️ LA PREUVE EST CE QUE L'ESPACE A REÇU, jamais le texte d'une réponse — un `ok: true`
  // sur un message jamais posté est précisément le mode de panne que ce module a déjà connu.
  const canal = { id: 'C1', name: 'batiscan', is_private: false, membres: [UMOI, UDIR] };
  await avecPoste({ canaux: [canal], utilisateurs: [ROBOT, LE_DIRIGEANT], lignes: [ligneInterne()] }, async ({ monde, veilleur }) => {
    const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'le chantier avance', pane: PANE });

    assert.equal(r.ok, true, `le message doit partir : ${JSON.stringify(r)}`);
    assert.ok(
      monde.postes.some((p) => String(p.text || '').includes('le chantier avance')),
      'LE FAIT : le message est dans le canal'
    );
  });
});

test('ET UNE LIGNE INTERNE S’OUVRE SUR UN CANAL DE MEMBRES PLEINS', async () => {
  const canal = { id: 'C_ok', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR] };
  await avecPoste({ canaux: [canal], utilisateurs: [ROBOT, LE_DIRIGEANT] }, async ({ veilleur }) => {
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.equal(r.ok, true, `elle doit s’ouvrir : ${r.refus?.message || r.erreur}`);
  });
});

// ═════════════════ 3. CE QUE LA GARDE DOIT TOUJOURS ATTRAPER
//
// ⚠️ C'EST L'AUTRE MOITIÉ, et elle compte autant. « Le dirigeant parle » se satisferait de
// retirer la garde ; ces deux essais-ci rougissent si on le fait.

test('UN INVITÉ DANS UNE LIGNE INTERNE COUPE TOUJOURS L’ÉCRITURE — Loi 25', async () => {
  const canal = { id: 'C1', name: 'batiscan', is_private: false, membres: [UMOI, UDIR, UN_CLIENT.id] };
  await avecPoste(
    { canaux: [canal], utilisateurs: [ROBOT, LE_DIRIGEANT, UN_CLIENT], lignes: [ligneInterne()] },
    async ({ monde, veilleur }) => {
      const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'le coût du chantier est de…', pane: PANE });

      assert.equal(r.ok, false, 'un client n’a rien à faire dans un canal d’orchestrateur');
      assert.deepEqual(monde.postes, [], 'LE FAIT : rien n’a été posté');
      assert.match(r.erreur, /Charles-Olivier/, 'et le refus nomme qui est là');
    }
  );
});

test('UN MEMBRE D’UNE AUTRE ORGANISATION AUSSI — la porte de Slack Connect ne se referme pas', async () => {
  // ⚠️ C'EST LE CRITÈRE QUE CE LOT RÉPARE, et il aurait été facile de le perdre en le
  // réparant : une comparaison qui ne peut plus jamais être vraie « débloque » tout aussi bien
  // le dirigeant. Cet essai est la seule chose qui distingue les deux corrections.
  const canal = { id: 'C1', name: 'batiscan', is_private: false, membres: [UMOI, UDIR, UNE_AUTRE_ORG.id] };
  await avecPoste(
    { canaux: [canal], utilisateurs: [ROBOT, LE_DIRIGEANT, UNE_AUTRE_ORG], lignes: [ligneInterne()] },
    async ({ monde, veilleur }) => {
      const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'les échéances', pane: PANE });

      assert.equal(r.ok, false, 'un externe arrivé par Slack Connect reste un externe');
      assert.deepEqual(monde.postes, [], 'LE FAIT : rien n’a été posté');
      assert.match(r.erreur, /ailleurs/i, 'et le refus le nomme');
    }
  );
});

test('LA MÊME CHOSE À L’OUVERTURE — les deux portes, jamais une seule', async () => {
  // ⚠️ « UNE PORTE SUR DEUX » est le motif le plus coûteux de ce dépôt : `ouvrir` et `dire`
  // décident chacun de leur côté, avec leur propre appel à la garde. Réparer l'un sans l'autre
  // laisserait une ligne s'ouvrir sur un canal où l'on n'a plus le droit d'écrire — ou
  // l'inverse. Les deux chemins sont donc éprouvés séparément, sur les deux verdicts.
  const avecExterne = { id: 'C_ext', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, UNE_AUTRE_ORG.id] };
  await avecPoste({ canaux: [avecExterne], utilisateurs: [ROBOT, LE_DIRIGEANT, UNE_AUTRE_ORG] }, async ({ veilleur }) => {
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.equal(r.ok, false, 'la ligne ne doit pas s’ouvrir');
    assert.equal(r.refus.motif, 'etranger_dans_le_canal');
  });
});

// ═════════════════ 4. CE QU'UN HUMAIN LIT N'EST PAS CE QUE LA GARDE COMPARE
//
// ⚠️ L'ISSUE QU'ON POUVAIT LAISSER DERRIÈRE SOI. Le correctif le plus court — faire rendre
// `team_id` à la place de `team` — aurait réparé la garde ET remplacé « espace Somtech
// Solution » par « espace T091JB7AVJ4 » dans le journal du veilleur, dans `ligne-directe etat`
// et dans le bilan du poste. Trois surfaces que personne n'aurait regardées avant longtemps.

test('L’ÉTAT DU POSTE MONTRE LE NOM DE L’ESPACE, jamais son identifiant', async () => {
  await avecPoste({ canaux: [], utilisateurs: [ROBOT, LE_DIRIGEANT] }, async ({ veilleur }) => {
    const e = await veilleur.etat();

    assert.equal(e.espace, EQUIPE_NOM, 'un humain lit un nom');
    assert.notEqual(e.espace, EQUIPE, 'l’identifiant ne dit rien à personne');
  });
});

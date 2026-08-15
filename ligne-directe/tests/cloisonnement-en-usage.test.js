// LE CLOISONNEMENT EN USAGE — à l'ouverture d'une ligne, et avant d'écrire dedans.
//
// (T-20260813-0074 · T-20260814-0142)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CES ESSAIS GARDENT, ET POURQUOI ILS REGARDENT SLACK PLUTÔT QUE LE MESSAGE
//
// Le jugement lui-même est éprouvé à part (`cloisonnement.test.js`), sans transport. Ici on
// éprouve qu'il est BRANCHÉ : que la commande lit vraiment les membres, et que ce qu'elle en
// fait se voit dans l'espace — un canal non créé, un message non posté.
//
// ⚠️ LA PREUVE EST CE QUE LE FAUX SLACK A REÇU, jamais le texte d'un refus. Les deux tickets
// l'exigent en toutes lettres : « par le fait, jamais par le message ».
//
// ⚠️ ET LE CAS NOMINAL DOIT RESTER SILENCIEUX. Dix-huit des vingt et un canaux internes du
// poste ne contiennent que le dirigeant et le robot ; deux en plus portent un collègue. Une
// garde qui parlerait là cesserait d'être lue avant d'avoir servi une fois (RA-REL-008).

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';

let Veilleur, sauverRegistre, chargerRegistre;
let racine;
let compteur = 0;

const UMOI = 'UMOI';
const UDIR = 'UDIR';
const PANE = 'w1:p1';
const EQUIPE = 'T_ESSAIS';
const DIRIGEANT = { id: UDIR, courriel: 'dirigeant@somtech.ca' };

/**
 * Les profils tels que `users.info` les rend — avec les seuls champs que le robot obtient
 * RÉELLEMENT. Pas de `profile.email` : mesuré absent le 2026-08-15, le droit n'est pas accordé.
 * Un double qui en fournirait un serait plus permissif que le service, et rendrait vert un
 * critère qui ne se déclenche jamais en production.
 */
const NOUS = [
  { id: UMOI, name: 'ligne_directe', is_bot: true, team_id: EQUIPE, profile: { display_name: 'ligne_directe' } },
  { id: UDIR, name: 'maxime', team_id: EQUIPE, profile: { display_name: 'maxime.leboeuf' } },
  { id: 'UCOLL', name: 'bruno', team_id: EQUIPE, profile: { display_name: 'Bruno Potvin' } },
];
/** Un client, tel que Slack le marque quand on l'invite : `is_restricted`. */
const CLIENT = { id: 'UCLI', name: 'charles', is_restricted: true, team_id: EQUIPE, profile: { display_name: 'Charles-Olivier' } };
const CLIENT_2 = { id: 'UCLI2', name: 'max-perso', is_restricted: true, is_ultra_restricted: true, team_id: EQUIPE, profile: { display_name: 'Max perso' } };

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-cloison-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre } = await import('../src/registre.js'));
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

async function avecPoste({ canaux = [], utilisateurs = [...NOUS], lignes = [] }, corps) {
  sauverRegistre({ version: 1, lignes, commun: null, dirigeant: DIRIGEANT });
  const monde = fauxSlack({ canaux, utilisateurs, robot: UMOI, espace: EQUIPE }).installer();
  const v = new Veilleur({
    cheminSocket: join(racine, `v-${(compteur += 1)}.sock`),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: EQUIPE, utilisateur: UMOI },
    herdr: agentsQuiVivent(),
  });
  // ⚠️ ON DÉMARRE L'ÉCOUTE LOCALE MÊME SANS S'EN SERVIR : `arreter()` attend la fermeture d'un
  // serveur qui n'existe pas quand on ne l'a jamais ouvert, et sa promesse ne se résout alors
  // JAMAIS — chaque essai de ce fichier a expiré au premier jet. Défaut réel du module, hors du
  // périmètre de ce lot : signalé à part plutôt que corrigé au passage.
  await v.ecouterLocal();
  try {
    return await corps({ monde, veilleur: v });
  } finally {
    await v.arreter();
    monde.restaurer();
  }
}

/** Une ligne déjà ouverte au registre, avec sa photo des membres si on lui en donne une. */
function ligneOuverte({ nature = 'interne', canalId = 'C1', canalNom = 'un-chantier', membresVus } = {}) {
  return {
    chantier: 'j-1',
    canal_id: canalId,
    canal_nom: canalNom,
    pane: PANE,
    worktree: '/w',
    nature,
    libelle: 'j-1',
    autorises: [UDIR],
    ...(membresVus ? { membres_vus: membresVus } : {}),
    pair: null,
    visage: '🧭',
    ouverte_le: 'hier',
    close_le: null,
  };
}

// ═════════════════ 1. T-20260814-0142 — AUCUN CLIENT DANS UN CANAL D'ORCHESTRATEUR

test('OUVRIR UNE LIGNE INTERNE SUR UN CANAL OÙ UN INVITÉ EST PRÉSENT EST REFUSÉ', async () => {
  // La règle du dirigeant, rendue mécanique. Un canal d'orchestrateur porte les arbitrages,
  // les pannes de production, les échéances et les coûts : un client qui y entre lit tout ce
  // que Somtech se dit — sur son dossier et sur d'autres.
  const canal = { id: 'C_dej', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, CLIENT.id] };
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT] }, async ({ monde, veilleur }) => {
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.equal(r.ok, false, 'la ligne ne doit pas s’ouvrir');
    assert.equal(r.refus.motif, 'etranger_dans_le_canal');
    // LA PREUVE EST DANS L'ESPACE : rien n'a été posté dans ce canal.
    assert.deepEqual(monde.postes, [], 'et rien n’y a été écrit');
    assert.deepEqual(chargerRegistre().lignes, [], 'rien n’est inscrit au registre');
  });
});

test('LE REFUS NOMME QUI, ET DIT LA LIMITE DU CRITÈRE — jamais une certitude qu’il n’a pas', async () => {
  const canal = { id: 'C_dej', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, CLIENT.id] };
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT] }, async ({ veilleur }) => {
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.match(r.refus.message, /Charles-Olivier/, 'le refus nomme qui est là');
    assert.match(r.refus.message, /invité|membre plein/i, 'et dit ce que le signal ne sait pas');
  });
});

test('UNE LIGNE INTERNE ENTRE COLLÈGUES S’OUVRE EN SILENCE — le cas des 20 canaux du poste', async () => {
  const canal = { id: 'C_ok', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, 'UCOLL'] };
  await avecPoste({ canaux: [canal] }, async ({ veilleur }) => {
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.equal(r.ok, true, r.refus?.message);
    assert.deepEqual(
      (r.avertissements || []).filter((a) => /invit|étrang/i.test(a)),
      [],
      'et rien à signaler : ce sont des nôtres'
    );
  });
});

test('LE CANAL D’UN CLIENT ACCUEILLE SES INVITÉS SANS BRONCHER — sa protection ne bouge pas', async () => {
  // ⚠️ NE PAS CONFONDRE LES DEUX NATURES. Un canal client EXISTE pour accueillir les gens du
  // client ; y appliquer la garde de la ligne interne fermerait la porte au nez de ceux à qui
  // elle est destinée.
  const canal = { id: 'C_cli', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id, CLIENT_2.id] };
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT, CLIENT_2] }, async ({ veilleur }) => {
    const r = await veilleur.ouvrir({
      chantier: 'acme',
      pane: PANE,
      worktree: '/w',
      nature: 'client',
      titre: 'espace acme',
    });

    assert.equal(r.ok, true, r.refus?.message);
  });
});

// ═════════════════ 2. T-20260813-0074 — L'ARRIVÉE D'UN NOUVEAU, APRÈS COUP

test('LA POSE PHOTOGRAPHIE LES MEMBRES — sans photo, aucune arrivée ne peut se constater', async () => {
  const canal = { id: 'C_cli', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id] };
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT] }, async ({ veilleur }) => {
    await veilleur.ouvrir({ chantier: 'acme', pane: PANE, worktree: '/w', nature: 'client', titre: 'espace acme' });

    const ligne = chargerRegistre().lignes[0];
    assert.deepEqual([...(ligne.membres_vus || [])].sort(), [UMOI, CLIENT.id].sort());
  });
});

test('QUELQU’UN ENTRÉ DEPUIS LA PHOTO EST SIGNALÉ AVANT QU’ON ÉCRIVE — c’est le vrai risque', async () => {
  // Le cas le plus probable, et celui que l'arbitrage vise : on invite quelqu'un des mois plus
  // tard sans se souvenir de ce que le canal porte. On ne prétend PAS savoir que c'est un autre
  // client — on dit que le lectorat a augmenté, ce qui est vérifiable et suffit à faire regarder.
  const canal = { id: 'C1', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id, CLIENT_2.id] };
  const ligne = ligneOuverte({ nature: 'client', canalNom: 'espace-acme', membresVus: [UMOI, CLIENT.id] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT, CLIENT_2], lignes: [ligne] }, async ({ veilleur }) => {
    const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'où en sont les travaux ?', pane: PANE });

    assert.equal(r.ok, true, 'le message part : on signale, on ne bâillonne pas une ligne cliente');
    assert.ok(r.nouveaux_venus?.some((n) => /Max perso/.test(n)), `on doit nommer qui est entré : ${JSON.stringify(r)}`);
  });
});

test('UNE FOIS SIGNALÉ, IL NE L’EST PLUS À CHAQUE MESSAGE — un signal répété devient du bruit', async () => {
  const canal = { id: 'C1', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id, CLIENT_2.id] };
  const ligne = ligneOuverte({ nature: 'client', canalNom: 'espace-acme', membresVus: [UMOI, CLIENT.id] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT, CLIENT_2], lignes: [ligne] }, async ({ veilleur }) => {
    await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'premier', pane: PANE });
    const second = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'second', pane: PANE });

    assert.equal(second.nouveaux_venus, undefined, 'la photo a été reprise : plus personne n’est « nouveau »');
  });
});

test('UN CANAL INCHANGÉ NE DIT RIEN DU TOUT — le cas de tous les messages, tous les jours', async () => {
  const canal = { id: 'C1', name: 'espace-acme', is_private: true, membres: [UMOI, CLIENT.id] };
  const ligne = ligneOuverte({ nature: 'client', canalNom: 'espace-acme', membresVus: [UMOI, CLIENT.id] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT], lignes: [ligne] }, async ({ veilleur }) => {
    const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'bonjour', pane: PANE });

    assert.equal(r.ok, true);
    assert.equal(r.nouveaux_venus, undefined);
  });
});

test('UN ÉTRANGER ENTRÉ DANS UNE LIGNE INTERNE COUPE L’ÉCRITURE — un canal compromis ne s’alimente pas', async () => {
  // T-20260814-0142, point 3 : « l'agent doit cesser d'écrire sur cette ligne et le dire,
  // plutôt que de continuer et d'espérer ». Sur une ligne INTERNE seulement — une ligne cliente
  // accueille les invités, les couper serait fermer la porte au client.
  const canal = { id: 'C1', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, CLIENT.id] };
  const ligne = ligneOuverte({ membresVus: [UMOI, UDIR] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT], lignes: [ligne] }, async ({ monde, veilleur }) => {
    const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'le coût du chantier est de…', pane: PANE });

    assert.equal(r.ok, false, 'on n’écrit pas dans un canal d’orchestrateur où un externe est entré');
    assert.deepEqual(monde.postes, [], 'et LE FAIT : rien n’a été posté');
    assert.match(r.erreur, /Charles-Olivier/, 'le refus nomme qui est là');
  });
});


// ═════════════════ 4. LES PORTES QUE LA PREMIÈRE ÉCRITURE AVAIT LAISSÉES OUVERTES
//
// ⚠️ RELEVÉ EN REVUE DE FOND — « une porte sur deux », le motif de ce dépôt, rejoué dans le
// correctif qui prétend le fermer. Le premier jet gardait `ouvrir` et `dire`, et laissait
// `fermer` écrire son bilan sans aucune vérification — alors que c'est le SEUL geste qui pose
// systématiquement du contenu de synthèse : coûts, arbitrages, ce qui reste à faire.

test('LE BILAN DE CLÔTURE NE PART PAS DANS UN CANAL OÙ UN ÉTRANGER EST ENTRÉ', async () => {
  // Le scénario exact : un chantier court, aucun `dire` jamais appelé, un externe rejoint le
  // canal entre l'ouverture et la clôture. L'agent referme, et le bilan des coûts s'en va sous
  // ses yeux.
  const canal = { id: 'C1', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, CLIENT.id] };
  const ligne = ligneOuverte({ membresVus: [UMOI, UDIR] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT], lignes: [ligne] }, async ({ monde, veilleur }) => {
    const r = await veilleur.fermer({ chantier: 'j-1', worktree: '/w', bilan: 'coût final : 40 000 $', pane: PANE });

    assert.deepEqual(monde.postes, [], 'LE FAIT : le bilan n’a pas été posté');
    assert.ok(r.bilan_retenu, `la réponse doit dire que le bilan a été retenu : ${JSON.stringify(r)}`);
  });
});

test('MAIS LA LIGNE SE REFERME QUAND MÊME — on ne bloque pas le cycle de vie sur un canal compromis', async () => {
  // « Un canal compromis qu'on continue d'alimenter est pire qu'un canal fermé » : on cesse
  // d'écrire, on ne cesse pas de fermer. Refuser la fermeture laisserait l'agent attaché à un
  // canal qu'il ne doit plus alimenter — le pire des deux mondes.
  const canal = { id: 'C1', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, CLIENT.id] };
  const ligne = ligneOuverte({ membresVus: [UMOI, UDIR] });
  await avecPoste({ canaux: [canal], utilisateurs: [...NOUS, CLIENT], lignes: [ligne] }, async ({ veilleur }) => {
    const r = await veilleur.fermer({ chantier: 'j-1', worktree: '/w', bilan: 'coût final', pane: PANE });

    assert.equal(r.ok, true, 'la ligne se referme');
    assert.equal(chargerRegistre().lignes[0].close_le !== null, true, 'et elle est close au registre');
  });
});

test('UN BILAN ORDINAIRE PART COMME AVANT — la garde ne gêne pas la clôture normale', async () => {
  const canal = { id: 'C1', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR] };
  const ligne = ligneOuverte({ membresVus: [UMOI, UDIR] });
  await avecPoste({ canaux: [canal], lignes: [ligne] }, async ({ monde, veilleur }) => {
    const r = await veilleur.fermer({ chantier: 'j-1', worktree: '/w', bilan: 'livré', pane: PANE });

    assert.equal(r.ok, true);
    assert.equal(r.bilan_retenu, undefined);
    assert.ok(monde.postes.some((p) => String(p.text || '').includes('livré')), 'le bilan est parti');
  });
});

// ═════════════════ 5. QUAND ON N'A PAS PU LIRE — et c'est le trou que la revue a démontré
//
// ⚠️ QUATRIÈME FOIS QUE CE MOTIF EST RELEVÉ SUR CE CHANTIER. La revue a muté les deux branches
// de dégradation pour qu'elles se TAISENT au lieu d'avertir : les 19 essais sont restés verts.
// Un droit Slack révoqué, un jeton mort ou un plafond atteint dégradait donc ces gardes vers
// « toujours ouvert, jamais un mot » — sans que rien ne le dise.

test('UNE LECTURE IMPOSSIBLE À L’OUVERTURE FAIT ÉCHOUER — et le refus le nomme', async () => {
  // ⚠️ LES DEUX GARDES N'EXIGENT PAS LA MÊME CHOSE, ET C'EST VOULU. À L'OUVERTURE, la ligne ne
  // s'ouvre pas : `T-20260814-0136` impose de PROUVER que l'invité est bien entré dans le canal,
  // et une preuve qu'on ne peut pas lire n'est pas une preuve — une ligne ouverte sans elle
  // serait peut-être muette, ce que ce dispositif existe pour empêcher.
  //
  // AVANT D'ÉCRIRE, au contraire, la ligne existe déjà et quelqu'un attend : couper la parole
  // parce qu'un droit a hoqueté serait le remède pire que le mal. On le dit, on n'empêche pas.
  // La première écriture de cet essai attendait l'inverse — c'était l'essai qui avait tort.
  const canal = { id: 'C_ko', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR] };
  await avecPoste({ canaux: [canal] }, async ({ monde, veilleur }) => {
    monde.membresIllisibles = true;
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.equal(r.ok, false, 'on n’ouvre pas une ligne dont on ne peut pas prouver l’état');
    assert.match(r.erreur, /pas pu être lu/i, 'et le refus dit ce qu’on n’a pas pu faire');
    assert.equal(r.refus.motif, 'cloisonnement_invérifiable');
    assert.deepEqual(chargerRegistre().lignes, [], 'rien n’est inscrit');
  });
});

test('UNE LECTURE IMPOSSIBLE AVANT D’ÉCRIRE SE DIT AUSSI — sur la ligne interne comme sur la cliente', async () => {
  const canal = { id: 'C1', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR] };
  const ligne = ligneOuverte({ membresVus: [UMOI, UDIR] });
  await avecPoste({ canaux: [canal], lignes: [ligne] }, async ({ monde, veilleur }) => {
    monde.membresIllisibles = true;
    const r = await veilleur.dire({ chantier: 'j-1', worktree: '/w', texte: 'le coût', pane: PANE });

    assert.equal(r.ok, true, 'le message part : couper la parole sur un hoquet serait pire');
    assert.ok(r.cloisonnement_invérifiable, `mais on doit le DIRE : ${JSON.stringify(r)}`);
  });
});

// ═════════════════ 6. UN MEMBRE QU'ON NE SAIT PAS LIRE

test('UN MEMBRE DONT LE PROFIL EST ILLISIBLE N’EST PAS UN SUSPECT — et il ne bloque pas les autres', async () => {
  // Un compte supprimé, un profil restreint, un identifiant qui n'est plus servi. Le canal est
  // sain ; jeter sur ce membre-là rendrait la garde inopérante sur un canal parfaitement normal,
  // ce qui est la façon la plus sûre de la faire désactiver.
  const canal = { id: 'C_ok', name: 'un-chantier', is_private: false, membres: [UMOI, UDIR, 'U_DISPARU'] };
  await avecPoste({ canaux: [canal] }, async ({ veilleur }) => {
    const r = await veilleur.ouvrir({ chantier: 'un-chantier', pane: PANE, worktree: '/w', invites: [UDIR] });

    assert.equal(r.ok, true, `un profil illisible ne doit pas faire refuser : ${r.refus?.message}`);
    assert.ok(
      chargerRegistre().lignes[0].membres_vus.includes('U_DISPARU'),
      'et il compte quand même dans la photo — il est bien dans le canal'
    );
  });
});


test('LA BRANCHE « JE N\u2019AI PAS PU LIRE » DE L\u2019OUVERTURE EST \u00c9PROUV\u00c9E DIRECTEMENT', async () => {
  // \u26a0\ufe0f CINQUI\u00c8ME FOIS QUE CE MOTIF EST RELEV\u00c9 SUR CE CHANTIER, et cette fois je l\u2019ai
  // trouv\u00e9 moi-m\u00eame en rejouant la mutation de la revue : muter ce catch pour qu\u2019il se TAISE
  // laissait les 25 essais verts. L\u2019essai voisin, qui passe par `ouvrir`, s\u2019arr\u00eate plus t\u00f4t
  // \u2014 sur le refus de la preuve d\u2019invitation \u2014 et n\u2019atteint donc jamais cette branche-ci.
  //
  // On l\u2019\u00e9prouve donc DIRECTEMENT. Un droit r\u00e9voqu\u00e9 ne doit pas d\u00e9grader la garde vers
  // « rien \u00e0 signaler » : c\u2019est le d\u00e9faut que tout ce chantier ferme, retourn\u00e9 contre lui.
  await avecPoste({ canaux: [] }, async ({ monde, veilleur }) => {
    monde.membresIllisibles = true;
    const r = await veilleur.refusEtranger('C_quelconque', 'un-chantier', 'interne');

    assert.ok(r, 'on ne rend pas `null` : ce serait dire « rien \u00e0 signaler » sans avoir regard\u00e9');
    // ⚠️ ARBITRAGE RENDU APRÈS LA REVUE : à L'OUVERTURE d'une ligne interne, une lecture
    // impossible REFUSE. Pas de compteur d'échecs — un compteur est un état, et un état qui se
    // remet à zéro au redémarrage donne une garde qui PARAÎT armée sans l'être : exactement le
    // défaut que ce lot corrige. La distinction se fait donc sur le MOMENT, pas sur un seuil :
    // à l'ouverture on peut encore ne pas ouvrir ; sur une ligne vivante, quelqu'un attend.
    // `refusEtranger` rend le refus À PLAT — même forme que les autres refus du module.
    assert.equal(r.motif, 'cloisonnement_invérifiable', `on refuse : ${JSON.stringify(r)}`);
    assert.match(r.message, /pas pu être lu/i);
  });
});

test('ET SUR UNE LIGNE CLIENTE, ELLE NE S\u2019APPLIQUE PAS DU TOUT \u2014 rien \u00e0 lire, rien \u00e0 dire', async () => {
  await avecPoste({ canaux: [] }, async ({ monde, veilleur }) => {
    monde.membresIllisibles = true;
    assert.equal(await veilleur.refusEtranger('C_quelconque', 'espace-acme', 'client'), null);
  });
});

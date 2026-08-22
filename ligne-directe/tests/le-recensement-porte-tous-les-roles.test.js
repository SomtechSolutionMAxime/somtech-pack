// LE RECENSEMENT PORTE TOUS LES RÔLES VIVANTS, PAS SEULEMENT LES ORCHESTRATEURS
// (E-20260822-0001, sous P-20260822-0001 — stories T-20260822-0009/0010/0011).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE BANC FERME, ET IL A ÉTÉ MESURÉ AVANT D'ÊTRE ÉCRIT
//
// Le 2026-08-22 à 02 h 52, `ligne-directe recensement` rendait ceci :
//
//     AU MOINS 13 orchestrateur(s) vivant(s) — 3 à jour, 10 en retard
//     ⚠️ 10 session(s) herdr n’ont pas répondu : ce compte est amputé d’autant.
//
// **Treize agents sur les quatre-vingt-quatorze que porte le poste.** Les trois représentants
// de clients vivants (`.gestionnaire/Frederic`, `.gestionnaire/Charles-Olivier` ×2) n'y
// figuraient pas, et les quatre-vingt-un panes restants non plus — pas même comme « je ne sais
// pas ce qu'ils font ». Le dirigeant ne voyait pas une tranche du parc en le sachant : il
// voyait une tranche du parc en croyant voir le parc.
//
// ⚠️ ET LE RÔLE ÉTAIT IMPLICITE DANS LE NOM DU CHAMP. `orchestrateurs[]` : le rôle ne se lisait
// nulle part sur l'entrée elle-même. Un second rôle entrant, la seule façon de savoir ce qu'un
// agent est aurait été de regarder DANS QUEL TABLEAU il se trouve — c'est-à-dire de déduire un
// fait d'un rangement, exactement ce que RA-VUE-005 interdit.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA CONDUITE QUI NE SE RELÂCHE PAS EN S'ÉTENDANT — et c'est le vrai objet de ce banc
//
// Ajouter des rôles augmente le nombre d'agents trouvés. C'est précisément le moment où l'on
// est tenté de présenter le résultat comme un total, parce qu'il RESSEMBLE enfin au parc. Les
// bancs de ce fichier gardent le contraire : le compte reste un PLANCHER, les sessions muettes
// restent nommées, et tout ce qu'on n'a pas pu établir est rendu comme tel plutôt que comblé.
//
// ⚠️ TROIS ÉTATS QUI NE SE REPLIENT JAMAIS EN DEUX, et chacun a son banc ici :
//
//   « je l'ai mesuré, voici la valeur »   ≠   « je l'ai mesuré, il n'y a pas de valeur »
//                                         ≠   « je n'ai pas pu mesurer »
//
// Les confondre est le défaut d'origine de ce dépôt sous toutes ses formes. Sur le nom d'un
// agent il coûte cher deux fois : un `null` nu se lit comme un champ oublié alors qu'il dit un
// fait (l'agent est ANONYME, donc inadressable), et un nom deviné à partir du mandat ou du lieu
// est pire que pas de nom — on lui PARLE. Deux agents ont déjà porté le même nom sur ce poste
// parce qu'une naissance a comblé une vérification qu'elle venait de déclarer manquante
// (`T-20260822-0002`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unRecensement, referenceDuMetier } from '../src/recensement.js';
import { roleDuLieu } from '../src/lieu-agent.js';
import { role as roleDe, rolesConnus } from '../src/roles.js';

const racine = () => mkdtempSync(join(tmpdir(), 'recensement-roles-'));

/**
 * LES MÉTIERS RÉELS DES DEUX RÔLES POSÉS — copiés des en-têtes que `roles.js` exige.
 *
 * ⚠️ Ils ne sont pas décoratifs : `roleDuLieu` établit le rôle par le FAIT — les quatre
 * fichiers du gabarit ET la concordance des en-têtes. Un lieu de banc qui n'en poserait que le
 * nom du dossier ferait rendre « aucun agent de ce rôle » à un module parfaitement correct, et
 * c'est le module qu'on corrigerait.
 */
const METIER = {
  orchestrateur: "# Tu es l'orchestrateur de ce chantier\n\nle métier du jour.\n",
  representant: '# Tu es le représentant de ce client\n\nle métier du jour.\n',
};
const CONTEXTE = {
  orchestrateur: '# Ce qui est propre à ce dépôt\n\nrien.\n',
  representant: "# Ce qu'on sait de ce client\n\nrien.\n",
};

/** Un lieu POSÉ POUR DE VRAI, pour le rôle demandé — dossier, quatre fichiers, vrais en-têtes. */
function poserLieu(depot, nomDuRole, nom, { metier } = {}) {
  const lieu = join(depot, roleDe(nomDuRole).dossier, nom);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), metier ?? METIER[nomDuRole]);
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE[nomDuRole]);
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

/**
 * Le gabarit du pack pour un rôle, là où `referenceDuPoste` va réellement le chercher.
 *
 * ⚠️ LE DOSSIER DE GABARITS N'EST PAS LE NOM DU RÔLE, et s'en apercevoir tient à ce détail :
 * le rôle `representant` se sert du gabarit `gestionnaire-client`. Écrire le nom du rôle ici
 * ferait chercher une référence qui n'existe pas, et le banc conclurait « pas de référence »
 * pour la plus mauvaise des raisons.
 */
function poserReference(racineTmp, nomDuRole, metier) {
  const dir = join(
    racineTmp, 'foyer', '.claude', 'plugins', 'marketplaces', 'somtech-pack',
    '.claude', 'templates', roleDe(nomDuRole).gabarits
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'CLAUDE.md'), metier);
  return join(racineTmp, 'foyer');
}

/**
 * Les noms tels que `herdr.agents()` les rend quand il a RÉPONDU.
 *
 * ⚠️ LA CLÉ PORTE LA SESSION, TOUJOURS — et l'oublier ici a fait rougir un banc à juste titre.
 * Un identifiant de pane n'est unique que dans SA session : ce poste en porte treize, et deux
 * y emploient le même `w5:p3`. Une clé sans session ferait se prêter leurs noms à deux agents
 * différents — et un nom d'affichage faux est pire qu'un nom absent, parce qu'on lui PARLE.
 *
 * Une entrée dont la valeur est `null` dit « vu, et il n'a pas de nom » ; une entrée ABSENTE
 * dit « pas vu ». Ce sont deux faits distincts, et les bancs de ce fichier les séparent.
 */
function nomsLus(entrees) {
  return {
    mesure: 'lue',
    noms: new Map(entrees.map(([pane, nom, session]) => [`${session ?? ''}\u0000${pane}`, nom])),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0009 — LE RÔLE SE LIT AU LIEU, ET LE RECENSEMENT LE REND
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un agent sous « .orchestrateur/<code>/ » est rendu avec un rôle EXPLICITE, sur l’entrée elle-même', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await unRecensement({ panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }], roleDuLieu });

  assert.equal(rendu.agents.length, 1, 'l’agent doit être recensé');
  const a = rendu.agents[0];
  // ⚠️ LE CŒUR DE CE BANC : le rôle se lit SUR L'ENTRÉE, pas dans le nom du tableau qui la
  // contient. Un lecteur qui reçoit une entrée seule doit savoir ce qu'elle est.
  assert.equal(a.role.mesure, 'établi', 'le rôle doit être établi, pas supposé');
  assert.equal(a.role.nom, 'orchestrateur');
  assert.equal(a.mandat, 'p-20260822-0001', 'et son mandat vient du CHEMIN');
});

test('un agent sous « .gestionnaire/<client>/ » est rendu comme REPRÉSENTANT — le second rôle entre vraiment', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'representant', 'Charles-Olivier');

  const rendu = await unRecensement({ panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }], roleDuLieu });

  assert.equal(rendu.agents.length, 1, 'un représentant vivant ne doit plus être invisible');
  assert.equal(rendu.agents[0].role.nom, 'representant');
  assert.equal(rendu.agents[0].mandat, 'Charles-Olivier', 'ce que son lieu nomme, ici le client');
});

test('les deux rôles cohabitent dans UN SEUL registre — chacun reconnu à son propre lieu', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const orch = poserLieu(depot, 'orchestrateur', 'p-20260822-0001');
  const rep = poserLieu(depot, 'representant', 'Frederic');

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: orch },
      { pane_id: 'w2:p1', foreground_cwd: rep },
    ],
    roleDuLieu,
  });

  // ⚠️ RA-VUE-004 — UN SEUL REGISTRE. Deux tableaux par rôle divergeraient au premier correctif
  // appliqué à un seul des deux ; ce dépôt a payé ça neuf fois. Un tableau, un champ `role`.
  assert.equal(rendu.agents.length, 2, 'les deux vivent dans le MÊME tableau');
  const parPane = new Map(rendu.agents.map((a) => [a.pane, a.role.nom]));
  assert.equal(parPane.get('w1:p1'), 'orchestrateur');
  assert.equal(parPane.get('w2:p1'), 'representant');
});

test('un orchestrateur qui porte un CODE comme nom reste orchestrateur — le nom ne déclasse pas le lieu', async (t) => {
  // ⚠️ MESURÉ SUR LE POSTE le 2026-08-22 : `d-20260813-0005` est un orchestrateur vivant, né
  // avant la convention des noms de rivière, et il porte encore son code de mandat comme nom.
  // Un chef d'équipe porte AUSSI un code (`e-20260822-0001`). Trancher le rôle sur la forme du
  // nom aurait donc déclassé un orchestrateur réel en chef d'équipe — et RA-VUE-005 refuse la
  // convention de nom comme preuve précisément pour ce cas-là.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'd-20260813-0005');

  const rendu = await unRecensement({
    panes: [{ pane_id: 'w8:p6', foreground_cwd: lieu }],
    roleDuLieu,
    nomsConnus: nomsLus([['w8:p6', 'd-20260813-0005']]),
  });

  assert.equal(rendu.agents[0].role.nom, 'orchestrateur', 'son LIEU fait foi, pas son nom');
  assert.equal(rendu.agents[0].nom.valeur, 'd-20260813-0005', 'et son nom est rendu tel quel');
});

test('un agent dont le lieu ne porte AUCUN rôle connu est rendu « non établi » — jamais omis', async () => {
  // ⚠️ MESURÉ : 81 des 97 panes du poste travaillent hors de tout dossier de rôle. Les taire,
  // c'était rendre 13 agents sur 94 en ayant l'air complet. Un chef d'équipe vivant est
  // aujourd'hui dans ce cas — il n'a pas de lieu (mesuré le 2026-08-22 : le geste de naissance
  // ne dépose rien dans son worktree, et c'est voulu). Il doit donc être VU, sans être nommé
  // d'un rôle qu'on n'a pas su établir.
  const rendu = await unRecensement({
    panes: [{ pane_id: 'w8X:p3', foreground_cwd: '/Users/x/worktrees/somtech-pack/20260822-030500' }],
    roleDuLieu,
  });

  assert.equal(rendu.agents.length, 1, 'il n’est JAMAIS omis du résultat');
  assert.equal(rendu.agents[0].role.mesure, 'non établi');
  assert.equal(rendu.agents[0].role.nom, null, 'et on ne lui en invente pas un');
  assert.ok(rendu.agents[0].role.pourquoi, 'la raison est écrite, pas laissée à deviner');
});

test('un lieu à demi posé reste ÉCARTÉ et NOMMÉ — un rôle de plus n’assouplit pas la garde du fait', async (t) => {
  // ⚠️ CE BANC GARDE UNE RÉGRESSION FACILE. En élargissant aux rôles, la tentation est de
  // conclure le rôle du DOSSIER (`.orchestrateur/…` ⇒ orchestrateur), ce qui compterait les
  // coquilles. Le rôle s'établit par le CONTENU : quatre fichiers et les en-têtes du métier.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const vrai = poserLieu(depot, 'orchestrateur', 'p-20260822-0001');
  const coquille = join(depot, '.orchestrateur', 'p-20260728-0002');
  mkdirSync(join(coquille, 'briefs'), { recursive: true });

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: vrai },
      { pane_id: 'w3:p2', foreground_cwd: coquille },
    ],
    roleDuLieu,
  });

  const coq = rendu.agents.find((a) => a.pane === 'w3:p2');
  assert.ok(coq, 'la coquille ne DISPARAÎT pas — un agent y travaille');
  assert.equal(coq.role.mesure, 'non établi', 'mais elle ne devient pas un orchestrateur');
  assert.equal(rendu.borne.lieuxEcartes.length, 1, 'et l’écart est chiffré');
  assert.equal(rendu.borne.lieuxEcartes[0].pane, 'w3:p2', 'on sait QUEL pane, pour aller voir');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0010 — LES AUTRES RÔLES APPORTENT CE QUE PORTE DÉJÀ UN ORCHESTRATEUR
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un représentant porte nom, mandat, lieu et statut — au même titre qu’un orchestrateur', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'representant', 'Charles-Olivier');

  const rendu = await unRecensement({
    panes: [{ pane_id: 'w26:p27', herdr_socket: '/s/cg.sock', foreground_cwd: lieu, agent_status: 'idle' }],
    roleDuLieu,
    nomsConnus: nomsLus([['w26:p27', 'charles-olivier', '/s/cg.sock']]),
  });

  const a = rendu.agents[0];
  assert.equal(a.nom.valeur, 'charles-olivier');
  assert.equal(a.mandat, 'Charles-Olivier');
  assert.equal(a.lieu, lieu);
  assert.equal(a.statut, 'idle');
  // La session voyage avec le pane, toujours : `w26:p27` seul ne désigne rien sur un poste qui
  // porte treize sessions herdr, dont deux emploient les mêmes identifiants.
  assert.equal(a.session, '/s/cg.sock');
});

test('la référence se résout PAR RÔLE — un représentant ne se compare pas au gabarit d’orchestrateur', async (t) => {
  // ⚠️ LE FAUX « EN RETARD » QUE CE BANC ÉVITE EST CERTAIN, PAS HYPOTHÉTIQUE. Une référence
  // unique ferait comparer le métier d'un représentant à celui d'un orchestrateur : deux textes
  // qui n'ont AUCUNE raison de concorder. Les trois représentants du poste seraient rendus
  // « en retard » tous les jours, et le retard cesserait de vouloir dire quoi que ce soit.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const orch = poserLieu(depot, 'orchestrateur', 'p-20260822-0001');
  const rep = poserLieu(depot, 'representant', 'Frederic');

  // Chaque gabarit du poste porte SON métier — c'est la situation réelle.
  const foyer = poserReference(tmp, 'orchestrateur', METIER.orchestrateur);
  poserReference(tmp, 'representant', METIER.representant);

  const references = Object.fromEntries(
    rolesConnus().map((nom) => [nom, referenceDuMetier({ gabarit: roleDe(nom).gabarits, foyer })])
  );

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: orch },
      { pane_id: 'w2:p1', foreground_cwd: rep },
    ],
    roleDuLieu,
    references,
  });

  for (const a of rendu.agents) {
    assert.equal(a.aJour, true, `« ${a.role.nom} » porte son PROPRE métier courant, il est à jour`);
    assert.equal(a.ecartOctets, 0);
  }
});

test('le compte reste un PLANCHER et les sessions muettes restent nommées — même avec plusieurs rôles', async (t) => {
  // ⚠️ C'EST ICI QUE LA CONDUITE POURRAIT SE RELÂCHER SANS QUE PERSONNE NE LE VOIE. Un registre
  // qui trouve enfin plusieurs rôles RESSEMBLE au parc ; c'est le moment exact où l'on cesse
  // d'écrire « au moins ». Mesuré le 2026-08-22 : 10 sessions herdr sur 13 n'ont pas répondu.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');

  const rendu = await unRecensement({
    panes: async () => ({
      panes: [
        { pane_id: 'w1:p1', foreground_cwd: poserLieu(depot, 'orchestrateur', 'p-20260822-0001') },
        { pane_id: 'w2:p1', foreground_cwd: poserLieu(depot, 'representant', 'Frederic') },
      ],
      sessionsInterrogees: 13,
      sessionsRefusees: [
        { session: '/x/sessions/cg/herdr.sock', raison: 'connexion refusée' },
        { session: '/x/sessions/progex/herdr.sock', raison: 'délai dépassé' },
      ],
    }),
    roleDuLieu,
  });

  assert.match(rendu.resume, /AU MOINS/, 'le résumé ne se lit jamais comme un total');
  assert.match(rendu.resume, /amputé/i, 'et il porte l’amputation');
  assert.equal(rendu.borne.nature, 'plancher');
  assert.equal(rendu.borne.sessionsRefusees.length, 2, 'nommées, pas comptées');
  assert.match(rendu.borne.sessionsRefusees[0].session, /cg/, 'savoir LAQUELLE permet d’aller voir');
  // Et le résumé doit nommer les rôles trouvés — sans quoi « au moins 2 agents » ne dit pas
  // lesquels, et le dirigeant ne saurait toujours pas quelle tranche du parc il regarde.
  assert.match(rendu.resume, /orchestrateur/, 'le résumé dit QUELS rôles il a trouvés');
  assert.match(rendu.resume, /représentant|representant/i);
});

test('le compte par rôle ne replie jamais « non établi » sur un rôle connu', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: poserLieu(depot, 'orchestrateur', 'p-1') },
      { pane_id: 'w2:p1', foreground_cwd: poserLieu(depot, 'representant', 'Frederic') },
      { pane_id: 'w3:p1', foreground_cwd: '/Users/x/worktrees/quelconque' },
    ],
    roleDuLieu,
  });

  assert.equal(rendu.compte.parRole.orchestrateur, 1);
  assert.equal(rendu.compte.parRole.representant, 1);
  assert.equal(rendu.compte.roleNonEtabli, 1, 'les « je ne sais pas » se comptent À PART');
  assert.equal(rendu.agents.length, 3, 'et tout le monde est là');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260822-0011 — CE QU'ON N'A PAS PU ÉTABLIR EST RENDU COMME TEL
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un agent VU sans nom est déclaré ANONYME — jamais un « null » nu', async (t) => {
  // ⚠️ MESURÉ le 2026-08-22 : `w31:p3`, `w8W:p1` et `w8W:p2` sont VUS par `herdr agents()` et
  // n'ont réellement aucun nom. 35 des 94 agents du poste sont dans ce cas. Un `null` nu se lit
  // comme un champ oublié ; or c'est un FAIT, et un fait qui a une conséquence : l'agent est
  // inadressable — on ne peut ni le nommer sur une ligne (EF-VUE-003), ni lui écrire.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260820-0001');

  const rendu = await unRecensement({
    panes: [{ pane_id: 'w8W:p1', foreground_cwd: lieu }],
    roleDuLieu,
    nomsConnus: nomsLus([['w8W:p1', null]]),
  });

  const a = rendu.agents[0];
  assert.equal(a.nom.mesure, 'aucun', 'on l’a MESURÉ, et il n’y a pas de nom');
  assert.equal(a.nom.valeur, null);
  assert.ok(a.nom.consequence, 'et la conséquence est écrite : il est inadressable');
  assert.match(a.nom.consequence, /inadressable|ne peut/i);
});

test('un nom ne se comble JAMAIS depuis le mandat ni depuis le lieu — le piège nommé par T-20260822-0002', async (t) => {
  // ⚠️ CE BANC GARDE LE DÉFAUT LE PLUS COÛTEUX DE CETTE STORY, et il s'est déjà produit : deux
  // agents ont porté le MÊME nom sur ce poste parce qu'une naissance a attribué un nom sur une
  // vérification qu'elle venait de déclarer manquante. Combler ici serait pire qu'omettre : on
  // ne se contente pas de mal renseigner un registre, on ÉCRIT à quelqu'un qui n'existe pas.
  //
  // Le cas est construit pour être tentant : deux panes, même mandat, même lieu, aucun nom.
  // C'est exactement `w8W:p1` et `w8W:p2` sur le poste réel.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260820-0001');

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w8W:p1', foreground_cwd: lieu },
      { pane_id: 'w8W:p2', foreground_cwd: lieu },
    ],
    roleDuLieu,
    nomsConnus: nomsLus([['w8W:p1', null], ['w8W:p2', null]]),
  });

  assert.equal(rendu.agents.length, 2, 'deux agents, pas un — même lieu ne veut pas dire même agent');
  for (const a of rendu.agents) {
    assert.equal(a.nom.valeur, null, 'aucun nom déduit du mandat…');
    assert.notEqual(a.nom.valeur, a.mandat, '…ni égal au mandat…');
    assert.notEqual(a.nom.valeur, 'p-20260820-0001', '…ni au nom du lieu');
    assert.equal(a.nom.mesure, 'aucun');
  }
});

test('« il n’y a pas de nom » et « je n’ai pas pu lire le nom » ne se rendent PAS pareil', async (t) => {
  // ⚠️ CE SONT DEUX CONDUITES OPPOSÉES. Sur un anonyme, on sait qu'il faut le faire se nommer.
  // Sur un nom non mesuré, on sait qu'il faut refaire la mesure. Les confondre envoie corriger
  // ce qui va bien — et `herdr agents()` a déjà été mesuré partiel (83 sur 227 un jour,
  // 94 sur 94 un autre) : les deux cas se produisent réellement sur ce poste.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-1');

  const vus = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', null]]),
  });
  const jamaisVu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu,
    // Le registre des agents a RÉPONDU, mais il n'a pas vu ce pane — c'est son sous-comptage.
    nomsConnus: nomsLus([['w9:p9', 'quelquun']]),
  });
  const refus = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu,
    nomsConnus: { mesure: 'refusée', raison: 'herdr agents() n’a pas répondu' },
  });

  assert.equal(vus.agents[0].nom.mesure, 'aucun');
  assert.equal(jamaisVu.agents[0].nom.mesure, 'refusée', 'un pane absent du registre n’est pas un anonyme');
  assert.equal(refus.agents[0].nom.mesure, 'refusée');
  assert.ok(refus.agents[0].nom.raison, 'et le refus dit POURQUOI');
  // Les trois valeurs sont `null` : c'est justement pourquoi la seule valeur ne suffit pas.
  assert.equal(vus.agents[0].nom.valeur, null);
  assert.equal(jamaisVu.agents[0].nom.valeur, null);
  assert.equal(refus.agents[0].nom.valeur, null);
});

test('un rôle non établi, un agent anonyme et un pane sans agent sont TROIS choses distinctes', async () => {
  // ⚠️ MESURÉ : 3 des 97 panes du poste déclarent `agent: null` — ce sont des terminaux, pas des
  // agents. Les rendre comme « agent au rôle non établi » ferait affirmer qu'un agent existe là
  // où il n'y en a pas : un faux positif dans un registre dont tout l'objet est de ne pas en
  // produire. Mais on ne les fait pas DISPARAÎTRE non plus — ils sont comptés à part.
  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', agent: 'claude', foreground_cwd: '/Users/x/worktrees/nu' },
      { pane_id: 'w1:p2', agent: null, foreground_cwd: '/Users/x' },
    ],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', null]]),
  });

  assert.equal(rendu.agents.length, 1, 'un pane qui DÉCLARE ne porter aucun agent n’est pas un agent');
  assert.equal(rendu.borne.panesSansAgent, 1, 'mais il ne disparaît pas : il est compté');
  assert.equal(rendu.agents[0].role.mesure, 'non établi', 'rôle : je ne sais pas');
  assert.equal(rendu.agents[0].nom.mesure, 'aucun', 'nom : il n’y en a pas — et ce n’est pas la même chose');
});

test('un pane qui ne DIT RIEN de son agent n’est pas écarté — on ne présume pas une absence', async () => {
  // ⚠️ LA DIFFÉRENCE EST CELLE DE TOUT CE MODULE : `agent: null` est un fait mesuré (« ce pane
  // ne porte pas d'agent »), une clé ABSENTE n'est pas une mesure. Écarter sur l'absence de la
  // clé ferait taire un pane parce que la source ne s'est pas exprimée — c'est-à-dire présumer.
  const rendu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: '/Users/x/worktrees/nu' }],
    roleDuLieu,
  });

  assert.equal(rendu.agents.length, 1, 'un pane muet sur son agent reste recensé');
  assert.equal(rendu.borne.panesSansAgent, 0, 'et il n’est pas compté comme « sans agent »');
});

test('un inventaire refusé rend « agents: null », jamais une liste vide — la garde d’origine tient', async () => {
  // ⚠️ CETTE GARDE EST LA PIÈCE MAÎTRESSE DU MODULE, et un renommage de champ est exactement
  // l'occasion de la perdre sans qu'un banc rougisse : `orchestrateurs: null` devenu
  // `agents: []` se lirait « j'ai regardé, il n'y a personne » sur un poste où on n'a rien vu.
  const rendu = await unRecensement({
    panes: () => {
      throw new Error('herdr injoignable');
    },
    roleDuLieu,
  });

  assert.equal(rendu.agents, null, 'null, PAS []');
  assert.ok(rendu.inventaireRefuse, 'et le refus est nommé');
  assert.equal(rendu.panesVus, null, 'on n’a vu aucun pane, on n’en a pas COMPTÉ zéro');
  assert.match(rendu.resume, /n’ai pas (pu|su)/, 'le résumé dit l’impuissance, pas le vide');
  assert.doesNotMatch(rendu.resume, /rien à signaler|aucun agent vivant/i);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// COUPER LA SONDE — on teste « quand il n'y a rien », il faut AUSSI tester « quand on ne
// peut pas voir », et vérifier que le résultat DIFFÈRE.
//
// ⚠️ CE BLOC EXISTE PARCE QUE L'ABSENCE DE CES BANCS EST LE DÉFAUT LE PLUS RÉPANDU DU DÉPÔT.
// Sur quatre gardes défaillantes relevées le 19 août, TROIS étaient testées : leurs bancs
// couvraient l'absence de la chose, aucun ne couvrait la panne de la mesure. Un module qui rend
// la même valeur dans les deux cas est indiscernable d'un module qui ment — et le banc qui ne
// teste que l'absence le déclare vert.
//
// La forme est la même partout ici : on mesure les DEUX cas, et on assert qu'ils DIFFÈRENT.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un lieu ILLISIBLE ne se rend pas comme un lieu SANS RÔLE — la sonde coupée se dit', async (t) => {
  // ⚠️ « Aucun rôle connu ne correspond » et « je n'ai pas pu lire ce lieu » mènent à deux
  // conduites opposées : dans le premier cas on sait qu'il faut poser un lieu, dans le second
  // qu'il faut refaire la mesure. Les replier ferait envoyer quelqu'un poser un lieu qui existe.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-1');

  const sondeVivante = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu,
  });
  const sondeCoupee = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    // La lecture du lieu ÉCHOUE — c'est ce qui arrive sur un montage disparu ou un droit retiré.
    roleDuLieu: () => {
      throw new Error('EACCES: permission denied');
    },
  });

  // Le contrôle positif d'abord : sans lui, « les deux diffèrent » serait vrai pour la raison
  // la plus banale du monde — le banc n'aurait rien mesuré du tout.
  assert.equal(sondeVivante.agents[0].role.mesure, 'établi', 'sonde vivante : le rôle est établi');

  assert.equal(sondeCoupee.agents[0].role.mesure, 'refusée', 'sonde coupée : la mesure a REFUSÉ');
  assert.notEqual(
    sondeCoupee.agents[0].role.mesure,
    'non établi',
    '« je n’ai pas pu lire » n’est PAS « aucun rôle ne correspond »'
  );
  assert.match(sondeCoupee.agents[0].role.raison, /EACCES|permission/i, 'et la raison porte la panne réelle');
  assert.equal(sondeCoupee.agents[0].role.nom, null, 'on n’en conclut évidemment aucun rôle');
});

test('un métier ILLISIBLE ne rend pas un écart de zéro — la sonde coupée ne se lit pas « à jour »', async (t) => {
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-1');
  const foyer = poserReference(tmp, 'orchestrateur', METIER.orchestrateur);
  const references = { orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }) };

  const sondeVivante = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu,
    references,
  });
  const sondeCoupee = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu,
    references,
    mesurer: () => null, // le métier ne s'est pas laissé mesurer
  });

  assert.equal(sondeVivante.agents[0].aJour, true, 'contrôle positif : à jour quand tout se lit');
  assert.equal(sondeVivante.agents[0].ecartOctets, 0);

  assert.equal(sondeCoupee.agents[0].aJour, null, 'sonde coupée : ni à jour, ni en retard — INCONNU');
  assert.equal(sondeCoupee.agents[0].ecartOctets, null, 'et surtout PAS un écart de zéro');
  assert.ok(sondeCoupee.agents[0].metier.refus, 'le refus est nommé');
});

test('une SESSION injoignable n’efface pas ses agents en silence — elle se compte et se nomme', async (t) => {
  // ⚠️ MESURÉ le 2026-08-22 : 10 des 13 sessions herdr du poste n'ont pas répondu. Un registre
  // qui rendrait le même résultat avec 13 sessions muettes et avec 13 sessions vides ferait lire
  // un parc désert là où on n'a simplement parlé à personne.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-1');

  const toutesRepondent = await unRecensement({
    panes: async () => ({
      panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
      sessionsInterrogees: 13,
      sessionsRefusees: [],
    }),
    roleDuLieu,
  });
  const dixMuettes = await unRecensement({
    panes: async () => ({
      panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
      sessionsInterrogees: 13,
      sessionsRefusees: Array.from({ length: 10 }, (_, i) => ({
        session: `/x/sessions/s${i}/herdr.sock`,
        raison: 'connexion refusée',
      })),
    }),
    roleDuLieu,
  });

  // Les deux ont trouvé le MÊME agent : c'est ce qui rend la différence de rendu significative.
  assert.equal(toutesRepondent.agents.length, 1);
  assert.equal(dixMuettes.agents.length, 1);
  assert.notEqual(
    toutesRepondent.resume,
    dixMuettes.resume,
    'le même compte sur un parc amputé ne doit PAS se dire pareil'
  );
  assert.doesNotMatch(toutesRepondent.resume, /amputé/i);
  assert.match(dixMuettes.resume, /amputé/i);
  assert.equal(dixMuettes.borne.sessionsRefusees.length, 10, 'nommées une par une, pas résumées');
});

test('le nom NON MESURÉ et le nom ABSENT ne produisent pas le même résumé non plus', async (t) => {
  // ⚠️ La distinction existe déjà sur l'entrée (banc plus haut) ; celui-ci garde qu'elle
  // REMONTE. Un rendu qui distingue au détail et confond au résumé laisse le lecteur pressé —
  // c'est-à-dire le lecteur normal — avec la confusion qu'on avait pris soin d'éviter.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-1');
  const panes = [{ pane_id: 'w1:p1', foreground_cwd: lieu }];

  const anonyme = await unRecensement({ panes, roleDuLieu, nomsConnus: nomsLus([['w1:p1', null]]) });
  const nonMesure = await unRecensement({
    panes,
    roleDuLieu,
    nomsConnus: { mesure: 'refusée', raison: 'herdr agents() n’a pas répondu' },
  });

  assert.equal(anonyme.compte.anonymes, 1, 'un agent VU sans nom est un anonyme');
  assert.equal(anonyme.compte.nomsNonMesures, 0);
  assert.equal(nonMesure.compte.anonymes, 0, 'un nom non lu n’est PAS un anonyme');
  assert.equal(nonMesure.compte.nomsNonMesures, 1);
  assert.notEqual(anonyme.resume, nonMesure.resume, 'et les deux résumés diffèrent');
});

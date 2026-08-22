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
  // ⚠️ LA FORME EST CELLE QUE `herdr pane list` PRODUIT VRAIMENT, et l'ancienne était fausse.
  //
  // Ce banc injectait `{ agent: null }` — une forme que la source ne rend JAMAIS. Mesuré sur les
  // 97 panes du poste le 2026-08-22 : la clé `agent` est PRÉSENTE sur 94, `agent: null` sort
  // ZÉRO fois, et pour les 3 panes sans agent herdr OMET la clé en posant
  // `agent_status: "unknown"`. Le banc tenait donc vert une garde qui n'écartait rien : sur le
  // poste réel, `panesSansAgent` valait 0 alors qu'il y en avait 3, et trois TERMINAUX — dont un
  // ouvert dans le répertoire personnel — étaient rendus comme des agents vivants au rôle non
  // établi, avec un nom « NON MESURÉ » qui envoie refaire la mesure.
  //
  // C'est le motif que ce lot a déjà payé deux fois : un double plus coopératif que le réel.
  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', agent: 'claude', agent_status: 'idle', foreground_cwd: '/Users/x/worktrees/nu' },
      // La forme MESURÉE d'un pane sans agent : pas de clé `agent`, statut « unknown ».
      { pane_id: 'w1:p2', agent_status: 'unknown', cwd: '/Users/x' },
    ],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', null]]),
  });

  assert.equal(rendu.agents.length, 1, 'un pane qui DÉCLARE ne porter aucun agent n’est pas un agent');
  assert.equal(rendu.borne.panesSansAgent, 1, 'mais il ne disparaît pas : il est compté');
  assert.equal(rendu.agents[0].role.mesure, 'non établi', 'rôle : je ne sais pas');
  assert.equal(rendu.agents[0].nom.mesure, 'aucun', 'nom : il n’y en a pas — et ce n’est pas la même chose');

  // ⚠️ ET LA DÉCLARATION EXIGE LES DEUX. Un pane sans clé `agent` mais dont le statut dit qu'il
  // TRAVAILLE n'a rien déclaré : l'écarter le ferait taire. Il est recensé, et NOMMÉ comme
  // indécidable — c'est ce qui empêche « 94 agents » de se lire « 94 agents certains ».
  const muet = await unRecensement({
    panes: [{ pane_id: 'w2:p1', agent_status: 'working', foreground_cwd: '/Users/x/worktrees/nu' }],
    roleDuLieu,
  });
  assert.equal(muet.agents.length, 1, 'un silence n’écarte pas — on ne présume aucune absence');
  assert.equal(muet.borne.panesSansAgent, 0, 'et il n’est pas compté comme « sans agent »');
  assert.equal(muet.borne.panesIndecidables.length, 1, 'il est nommé comme indécidable');
  assert.match(muet.borne.panesIndecidables[0].pourquoi, /n’a pas dit/, 'et on dit ce qui manque');
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
  // ⚠️ LA FORME QUE LE VRAI CODE PRODUIT — `{ refus }`, pas une exception. `roleDuLieuOuRefus`
  // ne jette JAMAIS : un banc qui n'éprouverait que l'exception éprouverait un collaborateur
  // imaginaire, plus bavard que le réel, et resterait vert pendant que ce chemin-ci serait mort.
  // C'est très exactement le défaut qui a fait rejeter une version de ce lot.
  const sondeCoupee = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu: () => ({ refus: 'EACCES: permission denied' }),
  });
  // Et la forme DÉFENSIVE, gardée à part et nommée comme telle : un collaborateur qui jetterait
  // — un autre appelant, un futur lecteur de disque — ne doit pas faire tomber le tour ni se
  // rendre « aucun rôle ». Ce banc-ci garde le `catch`, pas la réalité.
  const sondeQuiJette = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu: () => {
      throw new Error('EACCES: permission denied');
    },
  });
  assert.equal(sondeQuiJette.agents[0].role.mesure, 'refusée', 'un collaborateur qui jette REFUSE aussi');

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


// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE LA PASSE DE REVUE PORTAIL A TROUVÉ — deux mutations qui SURVIVAIENT au banc.
//
// ⚠️ AUCUNE DES DEUX N'ÉTAIT UN BOGUE DU JOUR : les chemins qu'elles ouvrent ne sont pas
// exercés par le seul appelant réel (`referencesDesRoles` peuple toujours toutes les clés, et
// le résumé nomme les bons compteurs). Ce sont des TROUS DU FILET — et un trou du filet se
// répare avec une garde, pas en plaidant que personne n'est encore tombé dedans.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le résumé nomme la bonne ÉTIQUETTE sur le bon compte — pas seulement le bon nombre', async (t) => {
  // ⚠️ MUTATION SURVIVANTE, TROUVÉE EN REVUE. Le banc « les deux résumés diffèrent » reste vert
  // quand on ÉCHANGE les deux compteurs dans le texte : l'anonyme se dit alors « NON MESURÉ » et
  // l'inverse — deux phrases toujours différentes, toutes deux fausses.
  //
  // ⚠️ ET C'EST LE PIRE ENDROIT OÙ SE TROMPER. `compte.anonymes` est lu par du code ; la PHRASE
  // est lue par un humain pressé, qui n'ouvrira pas l'objet. Les deux étiquettes commandent des
  // gestes opposés — faire se nommer l'agent, ou refaire la mesure. Une étiquette échangée
  // envoie donc corriger ce qui va bien, avec un chiffre exact à l'appui.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-1');
  const panes = [{ pane_id: 'w1:p1', foreground_cwd: lieu }];

  const anonyme = await unRecensement({ panes, roleDuLieu, nomsConnus: nomsLus([['w1:p1', null]]) });
  assert.match(anonyme.resume, /1 ANONYME/, 'un agent VU sans nom se dit ANONYME dans la phrase');
  assert.doesNotMatch(anonyme.resume, /NON MESURÉ\(s\)/, 'et surtout PAS « nom non mesuré »');

  const nonMesure = await unRecensement({
    panes,
    roleDuLieu,
    nomsConnus: { mesure: 'refusée', raison: 'herdr agents() n’a pas répondu' },
  });
  assert.match(nonMesure.resume, /1 nom\(s\) NON MESURÉ/, 'un nom non lu se dit NON MESURÉ');
  assert.doesNotMatch(nonMesure.resume, /ANONYME/, 'et surtout PAS « anonyme »');

  // Le journal porte les deux compteurs côte à côte : l'échange s'y verrait aussi.
  const journal = [];
  await unRecensement({ panes, roleDuLieu, nomsConnus: nomsLus([['w1:p1', null]]), journaliser: (m) => journal.push(m) });
  assert.match(journal.join(''), /1 anonyme\(s\), 0 nom\(s\) non mesuré/, 'le battement de cœur aussi');
});

test('« RIEN À MESURER » NE SE DIT PAS « JE N’AI PAS PU MESURER » — ni sur l’entrée, ni dans le résumé', async (t) => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // REJET DE REVUE DE FOND, ET C'EST CE REGISTRE QUI FABRIQUAIT L'ÉCHEC. Le métier n'était
  // mesuré que si le rôle était établi, et TOUT `null` se rendait ensuite « le métier de … ne
  // s'est pas laissé mesurer ». Mesuré sur le parc réel : 81 des 97 entrées portaient
  // « le métier de « null » ne s'est pas laissé mesurer » — le message qui veut dire VA VOIR,
  // L'INSTRUMENT A ÉCHOUÉ, pour des agents qui n'ont simplement aucun lieu de rôle.
  //
  // ⚠️ ET LE COÛT EST DOUBLE. On envoie chercher une panne qui n'existe pas, ET on noie le seul
  // cas où ce message est vrai dans 81 fausses alertes de forme identique. Sur le parc réel, les
  // DEUX mandats réellement non mesurés étaient invisibles parmi 86.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  // Un VRAI code de chantier : c'est sa FORME qui décide si son état se lit au ServiceDesk.
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: lieu }, // un orchestrateur : tout est mesurable
      { pane_id: 'w2:p1', foreground_cwd: join(tmp, 'un-projet', 'src') }, // un worktree ordinaire
    ],
    roleDuLieu,
    etatDuMandat: async () => ({ mesure: 'lue', clos: false, statut: 'in_progress' }),
  });

  const sansLieu = rendu.agents.find((a) => a.pane === 'w2:p1');
  assert.equal(sansLieu.metier.mesure, 'sans objet', 'rien à mesurer n’est un ÉTAT, pas un refus');
  assert.equal(sansLieu.metier.refus, undefined, 'et surtout PAS un refus : rien n’a été tenté');
  assert.doesNotMatch(
    JSON.stringify(sansLieu.metier),
    /ne s.est pas laissé mesurer/,
    'le message d’échec d’instrument ne doit JAMAIS sortir quand la mesure n’a pas été tentée',
  );
  // ⚠️ ET SURTOUT PAS « null » DANS LA PHRASE. `le métier de « null »` est la trace visible que
  // le registre a construit un message sur un objet qui n’existe pas.
  assert.doesNotMatch(JSON.stringify(sansLieu), /« null »/, 'aucun message ne se construit sur un lieu absent');
  assert.equal(sansLieu.chantier.mesure, 'sans objet', 'sans lieu, il n’y a pas de mandat à lire');

  // Le contrôle positif : l’agent dont TOUT est mesurable ne bascule pas en « sans objet ».
  const orch = rendu.agents.find((a) => a.pane === 'w1:p1');
  assert.equal(orch.metier.mesure, 'lue', 'un lieu réel se mesure pour de vrai');
  assert.ok(orch.metier.empreinte, 'et rend son empreinte');
  assert.equal(orch.chantier.clos, false, 'et son mandat est lu au ServiceDesk');

  // ⚠️ LA DISTINCTION DOIT SURVIVRE JUSQU'À LA PHRASE — c'est la seule ligne que le lecteur
  // normal lit. Calculée puis aplatie au rendu, elle n'existe pour personne.
  assert.equal(rendu.compte.metierSansObjet, 1);
  // ⚠️ ET LES DEUX COEXISTENT DANS LE MÊME RENDU, c'est ce qui rend ce banc mordant. L'agent sans
  // lieu est « sans objet » ; l'orchestrateur, lui, a un métier bien mesuré mais AUCUNE référence
  // à quoi le comparer — son écart est vraiment NON MESURÉ. Fondre les deux compteurs ferait
  // disparaître ce second cas, le seul des deux qui appelle un geste.
  assert.equal(rendu.compte.nonMesures, 1, 'l’écart de l’orchestrateur, lui, est vraiment non mesuré');
  assert.equal(rendu.agents.find((a) => a.pane === 'w1:p1').metier.mesure, 'lue', 'et ce n’est pas son métier qui manque');
  assert.equal(rendu.compte.mandatsSansObjet, 1);
  // ⚠️ LES DEUX ÉTIQUETTES COEXISTENT DANS LA MÊME PHRASE, ET DISENT DEUX CHOSES DIFFÉRENTES.
  // C'est ce qui prouve qu'elles ne se sont pas fondues : « sans métier à comparer » n'appelle
  // RIEN, « à l'écart NON MESURÉ » appelle d'aller voir pourquoi la comparaison a manqué.
  assert.match(rendu.resume, /1 sans métier à comparer \(rien à mesurer, pas un échec\)/, 'le sans-objet se dit');
  assert.match(rendu.resume, /1 à l’écart NON MESURÉ/, 'et le vrai non-mesuré aussi, à part');
  assert.doesNotMatch(
    rendu.resume,
    /2 (à l’écart NON MESURÉ|sans métier à comparer)/,
    'JAMAIS les deux fondus en un seul compte : c’est la fusion qui rendait « 81 non mesurés » sur un parc sain',
  );
  assert.match(rendu.resume, /1 sans mandat de chantier \(rien à lire, pas un échec\)/, 'idem pour le mandat');
});

test('LE MANDAT D’UN REPRÉSENTANT N’EST PAS UN CHANTIER — on ne le déclare pas « non mesurable »', async (t) => {
  // Même défaut, autre porte, et celui-ci était nommé comme réserve non bloquante par une revue
  // précédente : le segment sous le dossier de rôle nomme un CODE DE CHANTIER pour un
  // orchestrateur et un NOM DE CLIENT pour un représentant. Interroger le ServiceDesk pour les
  // seconds rendait « « Charles-Olivier » n'est pas un code de chantier : son état ne se lit
  // nulle part » — la formulation d'une mesure RATÉE pour une question sans objet.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const rep = poserLieu(join(tmp, 'depot'), 'representant', 'Charles-Olivier');

  let interroge = 0;
  const rendu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: rep }],
    roleDuLieu,
    etatDuMandat: async () => {
      interroge += 1;
      return { mesure: 'lue', clos: false };
    },
  });

  const a = rendu.agents[0];
  assert.equal(a.role.nom, 'representant');
  assert.equal(a.mandat, 'Charles-Olivier', 'son mandat reste rendu tel quel — il nomme son client');
  assert.equal(a.chantier.mesure, 'sans objet', 'mais ce n’est pas un chantier dont l’état se lirait');
  // ⚠️ ET LE SERVICEDESK N'EST PAS INTERROGÉ. Sans cette ligne, on pourrait rendre le bon
  // libellé tout en posant quand même la question — un appel réseau par représentant, à chaque
  // tour de ronde, pour un enregistrement qui n'existe pas.
  assert.equal(interroge, 0, 'on n’interroge pas le registre des chantiers sur ce qui n’en est pas un');
  assert.doesNotMatch(JSON.stringify(a.chantier), /n.est pas un code de chantier/, 'pas de faux échec');
});

test('UN REPRÉSENTANT PÉRIMÉ SE VOIT PROPOSER SA REMISE À JOUR — le geste n’est pas réservé aux chantiers', async (t) => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // REJET DE REVUE DE FOND, ET IL FRAPPE LE SEUL CHAMP QUI PORTE UNE ACTION.
  //
  // La garde exigeait `chantier.clos === false` — un chantier PROUVÉ OUVERT. Pour un
  // représentant, dont le mandat nomme un CLIENT et non un chantier, `clos` vaut `null` par
  // construction : `aProposer: true` était STRUCTURELLEMENT hors d'atteinte pour le rôle que ce
  // lot ajoute. Le registre s'intitule « il porte TOUS les rôles vivants » et son unique geste
  // actionnable était mort pour l'un des deux.
  //
  // ⚠️ ET LE MOTIF AFFICHÉ ÉTAIT UNE PANNE FABRIQUÉE, avec un `undefined` littéral dans la
  // prose : « son mandat n'a pas pu être mesuré (undefined) ». La forme « sans objet » porte
  // `pourquoi`, le message lisait `raison`. C'est la classe de défaut que ce lot ferme, laissée
  // debout dans le champ qui décide.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const rep = poserLieu(depot, 'representant', 'Charles-Olivier');
  // ⚠️ UN VRAI CODE DE CHANTIER, pas « p-1 » : c'est la FORME du mandat qui décide si son état se
  // lit au ServiceDesk, et un banc qui emploie une forme que la production ne produit pas éprouve
  // un chemin que personne n'emprunte.
  const orch = poserLieu(depot, 'orchestrateur', 'p-20260822-0001');
  // Les foyers portent un métier DIFFÉRENT de celui posé : les deux agents sont donc périmés.
  const foyer = poserReference(tmp, 'representant', METIER.representant + 'une ligne de plus.\n');
  const gab = join(foyer, '.claude', 'plugins', 'marketplaces', 'somtech-pack', '.claude', 'templates', 'orchestrateur');
  mkdirSync(gab, { recursive: true });
  writeFileSync(join(gab, 'CLAUDE.md'), METIER.orchestrateur + 'une ligne de plus.\n');

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: rep },
      { pane_id: 'w2:p1', foreground_cwd: orch },
    ],
    roleDuLieu,
    references: {
      representant: referenceDuMetier({ gabarit: 'gestionnaire-client', foyer }),
      orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }),
    },
    // L'orchestrateur, lui, a un vrai chantier — et il est CLOS.
    etatDuMandat: async () => ({ mesure: 'lue', clos: true, statut: 'completed' }),
  });

  const r = rendu.agents.find((a) => a.pane === 'w1:p1');
  assert.equal(r.aJour, false, 'contrôle : le représentant est bien périmé');
  assert.equal(
    r.remiseAJour?.aProposer,
    true,
    `un représentant périmé DOIT se voir proposer le geste (rendu : ${JSON.stringify(r.remiseAJour)})`,
  );

  // ⚠️ ET LE CONTRÔLE NÉGATIF DANS LE MÊME RENDU : la garde qu'on assouplit doit continuer de
  // mordre là où elle existe. Un chantier CLOS ne se réveille pas — c'est le risque réel qu'elle
  // protège (deux orchestrateurs agissant sur les mêmes panes en se croyant seuls).
  const o = rendu.agents.find((a) => a.pane === 'w2:p1');
  assert.equal(o.aJour, false, 'contrôle : l’orchestrateur aussi est périmé');
  assert.equal(o.remiseAJour.aProposer, false, 'mais son chantier est CLOS : on ne propose rien');
  assert.match(o.remiseAJour.pourquoiPas, /CLOS/, 'et on dit pourquoi');

  // ⚠️ AUCUN « undefined » DANS AUCUNE PROSE RENDUE. Un message construit sur un champ absent est
  // la trace visible qu'on parle d'un objet qu'on n'a pas — et il se lit comme un fait.
  assert.doesNotMatch(JSON.stringify(rendu), /undefined/, 'aucun message ne se construit sur un champ absent');

  // ⚠️ ET LA CEINTURE, ÉPROUVÉE POUR DE VRAI. Le motif du refus lit `chantier.raison` ; un
  // lecteur d'état de mandat qui rendrait une forme sans `raison` — c'est un paramètre injecté,
  // n'importe quel appelant peut le faire — remettrait un `undefined` littéral dans la prose.
  // Le double employé ici est plus PAUVRE que le réel, jamais plus riche : c'est le bon sens
  // pour éprouver une ceinture, l'inverse fabriquerait un collaborateur imaginaire.
  const muet = await unRecensement({
    panes: [{ pane_id: 'w2:p1', foreground_cwd: orch }],
    roleDuLieu,
    references: { orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }) },
    etatDuMandat: async () => ({ mesure: 'non mesurée', clos: null }), // ni `raison`, ni `pourquoi`
  });
  const sansRaison = muet.agents[0];
  assert.equal(sansRaison.remiseAJour.aProposer, false, 'un mandat non mesuré ne se voit rien proposer');
  assert.doesNotMatch(
    sansRaison.remiseAJour.pourquoiPas,
    /undefined/,
    'et le motif ne porte JAMAIS « undefined » — un message construit sur un champ absent se lit comme un fait',
  );
  assert.match(sansRaison.remiseAJour.pourquoiPas, /sans raison dite/, 'il dit que la raison manque, au lieu de l’inventer');
});

test('UN MANDAT QUI A LA FORME D’UN CODE SE LIT — le métier du lieu ne le fait pas taire', async (t) => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // REJET DE REVUE DE FOND CONTRE LE CORRECTIF PRÉCÉDENT, et celui-là ouvrait un geste dangereux.
  //
  // La question « ce mandat est-il un chantier ? » avait été indexée sur le seul rôle ÉTABLI.
  // Pour un lieu `.orchestrateur/d-…/` portant le métier d'un REPRÉSENTANT — divergence que ce
  // module déclare supportée — le registre affirmait donc « ce mandat ne nomme pas un chantier »
  // d'un code parfaitement reconnaissable, N'INTERROGEAIT PAS le ServiceDesk, et PROPOSAIT
  // `/clear` sur un chantier CLOS : le réveil même que cette garde existe pour retenir.
  //
  // La règle est donc : la FORME du mandat décide de la lecture ; le rôle ne décide que pour ce
  // qui n'a pas la forme d'un code. Le doute va vers la lecture — lire pour rien coûte un appel,
  // ne pas lire coûte un chantier réveillé.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');

  // ① Un dossier de représentant dont le lieu ne s'est PAS LAISSÉ LIRE, et dont le mandat n'a
  //    pas la forme d'un code : on ne sait pas ce qu'il nomme, donc on ne range pas en « rien ».
  const illisible = poserLieu(depot, 'representant', 'Frederic');
  // ② Un dossier d'ORCHESTRATEUR portant le métier d'un REPRÉSENTANT, avec un VRAI code.
  const divergent = poserLieu(depot, 'orchestrateur', 'd-20260822-0077', { metier: METIER.representant });
  writeFileSync(join(divergent, 'CONTEXTE.md'), CONTEXTE.representant);
  // ③ Un représentant nominal : son mandat nomme un client, il n'a pas la forme d'un code.
  const rep = poserLieu(depot, 'representant', 'Charles-Olivier');

  const interroges = [];
  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: illisible },
      { pane_id: 'w1:p2', foreground_cwd: divergent },
      { pane_id: 'w1:p3', foreground_cwd: rep },
    ],
    roleDuLieu: (lieu) => (lieu === illisible ? { refus: 'EACCES' } : roleDuLieu(lieu)),
    etatDuMandat: async (m) => {
      interroges.push(m);
      return { mesure: 'lue', clos: true, statut: 'completed' };
    },
  });

  // ① Un lieu qu'on n'a pas su lire, mandat sans forme de code : ni « sans objet », ni interrogé.
  const a1 = rendu.agents.find((a) => a.pane === 'w1:p1');
  assert.equal(a1.role.mesure, 'refusée', 'contrôle : le rôle a refusé');
  assert.equal(
    a1.chantier.mesure,
    'non mesurée',
    `un échec de mesure ne se classe pas « sans objet » (rendu : ${JSON.stringify(a1.chantier)})`,
  );
  assert.match(a1.chantier.raison, /rôle .* n’est pas établi/, 'et la raison dit ce qui manque');
  // ⚠️ ET SON MÉTIER NON PLUS. « le lieu ne s'est pas laissé lire » n'est pas « rien à mesurer » :
  // rangé avec les sans-objet, il sortait sous l'étiquette « pas un échec », pendant que la
  // colonne qui appelle à aller voir restait à zéro.
  assert.equal(a1.metier.mesure, 'non mesurée', 'le métier non plus ne se dit pas « sans objet »');
  assert.match(a1.metier.raison, /ne s’est pas laissé lire/, 'et il nomme ce qui a refusé : le LIEU');

  // ② Le code se lit, malgré le métier divergent — et le chantier CLOS retient le geste.
  const a2 = rendu.agents.find((a) => a.pane === 'w1:p2');
  assert.equal(a2.role.nom, 'representant', 'contrôle : c’est le CONTENU qui établit le rôle');
  assert.equal(a2.chantier.mesure, 'lue', 'mais son MANDAT a la forme d’un code : il se lit');
  assert.equal(a2.chantier.clos, true);
  assert.ok(interroges.includes('d-20260822-0077'), 'le ServiceDesk EST interrogé sur un code de chantier');

  // ③ Un mandat sans forme de code, sur un rôle établi qui nomme un client : sans objet.
  const a3 = rendu.agents.find((a) => a.pane === 'w1:p3');
  assert.equal(a3.chantier.mesure, 'sans objet', 'un nom de client n’est pas un chantier à lire');
  assert.equal(interroges.includes('Charles-Olivier'), false, 'et on ne l’interroge pas');
  assert.match(a3.chantier.pourquoi, /n’a pas la forme d’un code de chantier/, 'et on dit pourquoi');

  assert.equal(rendu.compte.mandatsClos, 1);
  assert.equal(rendu.compte.mandatsNonMesures, 1, 'le seul échec réel se compte comme tel');
  assert.equal(rendu.compte.mandatsSansObjet, 1);
});

test('LE RÉSUMÉ NOMME LES RÔLES NON MESURÉS — la distinction ne s’arrête pas au compteur', async (t) => {
  // ⚠️ MUTATION SURVIVANTE, TROUVÉE EN REVUE DE FOND. `compte.roleNonMesure` était gardé, mais
  // la PHRASE — la ligne que le lecteur lit — pouvait perdre les rôles non mesurés sans qu'un
  // banc rougisse, alors que ce module affirme que la distinction tient « jusque dans le
  // résumé ». Un état calculé puis aplati au rendu n'existe pour personne.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-1');

  const rendu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: lieu }],
    roleDuLieu: () => ({ refus: 'le lieu ne s’est pas laissé lire (EACCES)' }),
  });

  assert.equal(rendu.compte.roleNonMesure, 1, 'contrôle : le compteur le porte');
  assert.match(rendu.resume, /1 au rôle NON MESURÉ/, 'et la PHRASE aussi — sinon personne ne le lit');
  assert.doesNotMatch(rendu.resume, /au rôle NON ÉTABLI/, 'et jamais confondu avec « aucun rôle ne correspond »');
});

test('UN REFUS DU REGISTRE DES NOMS RAPPORTE SA CAUSE — « je n’ai pas de lecteur » n’est pas « herdr a refusé »', async () => {
  // ⚠️ MUTATION SURVIVANTE, TROUVÉE PAR LES DEUX PASSES. Le câblage du veilleur a deux branches :
  // `{ mesure: 'lue', noms }` quand herdr répond, `{ mesure: 'refusée', raison }` quand il jette.
  // La première a reçu son banc (« deux étages justes dont la jointure n'est pas gardée ») ; la
  // seconde est restée nue — la remettre à `null` laissait les 819 essais verts.
  //
  // ⚠️ ET LA CONSÉQUENCE EST PLUS PETITE QUE CE QUE LE CODE AFFIRMAIT, ce qui vaut d'être dit :
  // `null` et `{ mesure: 'refusée' }` rendent le MÊME état (`mesure: 'refusée'`), le même compte,
  // le même résumé. Ce qui se perd est la CAUSE. Un diagnostic qui accuse le câblage (« aucun
  // lecteur ne m'a été donné ») au lieu de la source (« herdr agents() a refusé : … ») envoie
  // chercher la panne au mauvais endroit — c'est réel, et c'est tout ce que c'est.
  const cle = ['w1:p1', null];

  const cable = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: '/Users/x/un-projet' }],
    roleDuLieu,
    nomsConnus: { mesure: 'refusée', raison: 'herdr agents() a refusé (ECONNREFUSED)' },
  });
  const nu = await unRecensement({
    panes: [{ pane_id: 'w1:p1', foreground_cwd: '/Users/x/un-projet' }],
    roleDuLieu,
    nomsConnus: null,
  });
  void cle;

  // Les deux rendent le même ÉTAT — c'est mesuré, et c'est pourquoi l'état ne suffit pas à garder.
  assert.equal(cable.agents[0].nom.mesure, 'refusée');
  assert.equal(nu.agents[0].nom.mesure, 'refusée');
  assert.equal(cable.compte.nomsNonMesures, nu.compte.nomsNonMesures, 'même compte : l’état ne discrimine pas');

  // C'est la RAISON qui discrimine, et c'est elle qu'il faut garder.
  assert.match(cable.agents[0].nom.raison, /herdr agents\(\) a refusé/, 'la cause RÉELLE est rapportée…');
  assert.doesNotMatch(cable.agents[0].nom.raison, /aucun lecteur/, '…et pas celle du câblage');
  assert.match(nu.agents[0].nom.raison, /aucun lecteur/, 'sans lecteur, on dit que c’est le lecteur qui manque');
});

test('LE RÉSUMÉ NOMME CHACUNE DE SES HUIT ÉTIQUETTES — une assertion négative n’en garde aucune', async (t) => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // DEUX MUTATIONS SURVIVANTES, TROUVÉES EN REVUE PORTAIL, ET LEUR CAUSE EST UN MOTIF.
  //
  // « au rôle NON ÉTABLI » et « au mandat NON MESURÉ » pouvaient QUITTER le résumé sans qu'un
  // seul des 819 essais rougisse. Les deux étiquettes existaient pourtant dans `tests/` — mais
  // uniquement dans des `assert.doesNotMatch`, sur des rendus où leur compteur valait zéro.
  //
  // > UNE ASSERTION NÉGATIVE RESTE VRAIE QUAND ON SUPPRIME CE QU'ELLE CHERCHE.
  //
  // Le coût du premier est le défaut d'origine du lot rétabli au dernier étage : les 78 agents
  // hors de tout lieu de rôle disparaîtraient de la SEULE ligne que le lecteur normal lit, alors
  // que `compte.roleNonEtabli` reste juste. Un état calculé, compté, puis aplati au rendu.
  //
  // Ce banc construit donc UN rendu où les huit étiquettes sont simultanément non nulles, et
  // exige chacune POSITIVEMENT. Ajouter une étiquette au résumé sans l'ajouter ici la laissera
  // non gardée — c'est le prix, et il est visible.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const orchAJour = poserLieu(depot, 'orchestrateur', 'p-20260822-0001');
  const orchPerime = poserLieu(depot, 'orchestrateur', 'matapedia', { metier: METIER.orchestrateur + 'périmé.\n' });
  const rep = poserLieu(depot, 'representant', 'Charles-Olivier');
  const foyer = poserReference(tmp, 'orchestrateur', METIER.orchestrateur);

  const rendu = await unRecensement({
    // ⚠️ L'ENVELOPPE, pas la liste nue : c'est elle qui porte les sessions muettes, et sans elle
    // la borne serait exigée sur un rendu qui n'a aucune session à déclarer — une assertion
    // vacante de plus.
    panes: {
      panes: [
        { pane_id: 'w1:p1', foreground_cwd: orchAJour },                       // à jour + mandat ouvert
        { pane_id: 'w1:p2', foreground_cwd: orchPerime },                      // en retard + mandat non traçable
        { pane_id: 'w1:p3', foreground_cwd: rep },                             // mandat sans objet
        { pane_id: 'w1:p4', foreground_cwd: join(tmp, 'un-projet') },          // rôle non établi, métier sans objet
        { pane_id: 'w1:p5', foreground_cwd: join(depot, '.orchestrateur', 'illisible') }, // rôle refusé
        { pane_id: 'w1:p6', agent_status: 'unknown', cwd: '/Users/x' },        // pane sans agent
      ],
      sessionsInterrogees: 2,
      sessionsRefusees: [{ session: 'cg', raison: 'server_not_running' }],
    },
    roleDuLieu: (lieu) => (lieu.endsWith('illisible') ? { refus: 'EACCES' } : roleDuLieu(lieu)),
    references: { orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }) },
    etatDuMandat: async (m) => (m === 'p-20260822-0001' ? { mesure: 'lue', clos: false } : { mesure: 'non mesurée', clos: null, raison: 'x' }),
    nomsConnus: nomsLus([['w1:p1', 'kamouraska'], ['w1:p2', null], ['w1:p3', 'charles-olivier'], ['w1:p4', null]]),
  });

  const r = rendu.resume;
  const c = rendu.compte;
  // Chaque étiquette est exigée POSITIVEMENT, et sur le compte qu'elle porte — pas seulement sur
  // sa présence : une étiquette juste avec un nombre échangé est le défaut qu'un banc voisin garde.
  const attendus = [
    [/au rôle NON ÉTABLI/, c.roleNonEtabli, 'rôle non établi'],
    [/au rôle NON MESURÉ/, c.roleNonMesure, 'rôle non mesuré'],
    [/à l’écart NON MESURÉ/, c.nonMesures, 'écart non mesuré'],
    [/sans métier à comparer/, c.metierSansObjet, 'métier sans objet'],
    [/au mandat NON MESURÉ/, c.mandatsNonMesures, 'mandat non mesuré'],
    [/sans mandat de chantier/, c.mandatsSansObjet, 'mandat sans objet'],
    [/ANONYME\(s\), inadressable/, c.anonymes, 'anonymes'],
    [/nom\(s\) NON MESURÉ/, c.nomsNonMesures, 'noms non mesurés'],
  ];
  for (const [motif, compte, quoi] of attendus) {
    assert.ok(compte > 0, `le banc doit CONSTRUIRE le cas « ${quoi} » — sinon il ne garde rien (compte : ${compte})`);
    assert.match(r, motif, `l’étiquette « ${quoi} » doit être dans le résumé`);
    assert.match(r, new RegExp(`${compte}[^;]*?${motif.source}`), `« ${quoi} » doit porter SON compte (${compte})`);
  }
  // Et la borne, qui voyage avec le chiffre.
  assert.match(r, /AU MOINS \d+ agent\(s\) vivant\(s\)/, 'le compte reste un PLANCHER');
  assert.match(r, /1 session\(s\) herdr n’ont pas répondu/, 'et les sessions muettes restent nommées');
  assert.equal(rendu.borne.sessionsRefusees[0].session, 'cg', 'nommées une à une, pas seulement comptées');
});

test('LES RÉFÉRENCES ARRIVENT PAR RÔLE JUSQU’AU RENDU — un jeu vide n’est pas un jeu par rôle', async (t) => {
  // ⚠️ MUTATION SURVIVANTE, TROUVÉE EN REVUE DE FOND : remplacer le jeu de références du câblage
  // réel par `{}` laissait toute la suite verte. Le rendu bascule alors en « aucune référence ne
  // m'a été donnée » pour TOUS les rôles — c'est-à-dire que la colonne « à jour / en retard »
  // meurt en silence, en rendant partout « je ne sais pas », qui est la réponse la plus
  // rassurante possible pour un registre qui ne mesure plus rien.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const orch = poserLieu(depot, 'orchestrateur', 'p-1');
  const foyer = poserReference(tmp, 'orchestrateur', METIER.orchestrateur);
  const panes = [{ pane_id: 'w1:p1', foreground_cwd: orch }];

  const avec = await unRecensement({
    panes,
    roleDuLieu,
    references: { orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }) },
  });
  assert.equal(avec.agents[0].aJour, true, 'contrôle positif : avec sa référence, l’écart se mesure');

  const sans = await unRecensement({ panes, roleDuLieu, references: {} });
  assert.equal(sans.agents[0].aJour, null, 'sans référence, on ne conclut rien…');
  assert.match(
    sans.agents[0].reference?.refus ?? '',
    /aucune référence ne m’a été donnée pour le rôle « orchestrateur »/,
    '…et on DIT que c’est la référence qui manque, pas que le métier va bien',
  );
});

test('un rôle SANS sa référence ne se rabat sur AUCUNE autre — il rend « je ne sais pas »', async (t) => {
  // ⚠️ MUTATION SURVIVANTE, TROUVÉE EN REVUE. Ajouter un repli `?? references.orchestrateur` est
  // le « correctif » que quelqu'un écrira le jour où une clé manquera — et il rouvre EXACTEMENT
  // le défaut que T-20260822-0010 ferme : le représentant est alors comparé au gabarit
  // d'orchestrateur, deux textes sans aucune raison de concorder, et rendu « en retard » pour
  // toujours. Mesuré avec le repli en place : `aJour: false, ecartOctets: -27`.
  //
  // Le banc « la référence se résout PAR RÔLE » ne l'attrapait pas : il fournit TOUJOURS les deux
  // clés. Celui-ci fournit un objet PARTIEL — la seule forme qui distingue les deux conduites.
  const tmp = racine();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const depot = join(tmp, 'depot');
  const orch = poserLieu(depot, 'orchestrateur', 'p-1');
  const rep = poserLieu(depot, 'representant', 'Frederic');
  const foyer = poserReference(tmp, 'orchestrateur', METIER.orchestrateur);

  const rendu = await unRecensement({
    panes: [
      { pane_id: 'w1:p1', foreground_cwd: orch },
      { pane_id: 'w2:p1', foreground_cwd: rep },
    ],
    roleDuLieu,
    // PARTIEL, à dessein : la référence de l'orchestrateur est là, celle du représentant non.
    references: { orchestrateur: referenceDuMetier({ gabarit: 'orchestrateur', foyer }) },
  });

  const o = rendu.agents.find((a) => a.role.nom === 'orchestrateur');
  const r = rendu.agents.find((a) => a.role.nom === 'representant');

  // Contrôle positif : celui QUI A sa référence est bien comparé. Sans lui, « l'autre ne conclut
  // rien » serait vrai pour la raison la plus banale — aucune comparaison n'a eu lieu du tout.
  assert.equal(o.aJour, true, 'l’orchestrateur, lui, a sa référence et se compare');

  assert.equal(r.aJour, null, 'le représentant sans référence ne conclut RIEN — ni à jour, ni en retard');
  assert.equal(r.ecartOctets, null, 'et surtout aucun écart, qui serait celui d’un autre métier');
  assert.ok(r.metier?.empreinte, 'son métier A BIEN été lu — ce qui manque est la référence, pas la mesure');
});

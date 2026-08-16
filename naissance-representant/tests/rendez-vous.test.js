// rendez-vous.test.js — le réveil qui tient la ronde horaire et le topo de 7 h 00.
//
// CE QUI DOIT ÊTRE VRAI, ET POURQUOI CHACUN A COÛTÉ QUELQUE CHOSE
//
//   • à QUI il s'adresse — les lieux sont l'inventaire, pas un fichier à tenir. Un réveil qui
//     lirait une liste réveillerait des orchestrateurs morts et manquerait les vivants ;
//   • QUAND il déclenche — 7 h 00 pour le topo, l'heure pleine étant le livrable, et un
//     RYTHME horaire pour la ronde. Un descripteur qui perd son déclencheur ne fait plus rien
//     et ne le dit pas ;
//   • ce qu'il NE fait PAS — il ne rédige ni la ronde ni le topo. Un réveil qui composerait
//     le rapport à la place de l'orchestrateur produirait un compte rendu plausible et faux.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RENDEZ_VOUS, rendezVous, RendezVousInconnu, orchestrateursVivants, orchestrateursDuPoste, construirePlist, cheminPlist,
} from '../src/rendez-vous.js';

/** Une réponse de `herdr agent list`, dans la forme RÉELLE mesurée sur le poste. */
function listeAgents(agents) {
  return { result: { agents } };
}

// Les rôles, tels que `roleDuLieu` les rendrait — injectés pour rester sans disque.
const ROLE_DE = (chemins) => (cwd) => chemins[cwd] ?? null;

// ═══════════════════════════════ à qui le rendez-vous s'adresse

test('seuls les agents qui tournent DANS un lieu d’orchestrateur sont réveillés', () => {
  const vivants = orchestrateursVivants(
    listeAgents([
      { pane_id: 'w1:p1', name: 'd-20260813-0002', foreground_cwd: '/r/.orchestrateur/d-1' },
      { pane_id: 'w1:p2', name: 'acme', foreground_cwd: '/r/.gestionnaire/acme' },
      { pane_id: 'w1:p3', name: 't-1', foreground_cwd: '/r' },
    ]),
    { estUnLieu: ROLE_DE({ '/r/.orchestrateur/d-1': 'orchestrateur', '/r/.gestionnaire/acme': 'representant' }) }
  );

  assert.deepEqual(vivants.map((v) => v.pane), ['w1:p1']);
  // Le représentant n'est PAS réveillé, et ce n'est pas un oubli : son topo au dirigeant est
  // bloqué par sa seconde ligne (T-20260806-0005), et le faire écrire dans le canal de son
  // client serait de l'interne chez le client.
  assert.equal(vivants.some((v) => v.nom === 'acme'), false);
});

test('le répertoire lu est celui du PREMIER PLAN — c’est lui qui dit quel métier tourne', () => {
  // `cwd` est celui du shell du pane, qui peut rester en arrière. Le piège est le même qu'à
  // la naissance, et il a déjà fait déclarer née dans son lieu une session qui tournait ailleurs.
  const vivants = orchestrateursVivants(
    listeAgents([{ pane_id: 'w1:p1', cwd: '/ailleurs', foreground_cwd: '/r/.orchestrateur/d-1' }]),
    { estUnLieu: ROLE_DE({ '/r/.orchestrateur/d-1': 'orchestrateur' }) }
  );
  assert.equal(vivants.length, 1);
  assert.equal(vivants[0].repertoire, '/r/.orchestrateur/d-1');
});

test('un agent sans pane est écarté — on ne peut rien lui livrer', () => {
  const vivants = orchestrateursVivants(
    listeAgents([{ name: 'sans-pane', foreground_cwd: '/r/.orchestrateur/d-1' }]),
    { estUnLieu: ROLE_DE({ '/r/.orchestrateur/d-1': 'orchestrateur' }) }
  );
  assert.deepEqual(vivants, []);
});

test('une réponse illisible ne réveille personne, et ne jette pas', () => {
  // Un réveil qui exploserait sur une réponse inattendue laisserait le rendez-vous en panne
  // sans qu'aucun orchestrateur ne s'en aperçoive.
  for (const reponse of [null, {}, { result: {} }, { result: { agents: 'non' } }, { error: { code: 'x' } }]) {
    assert.deepEqual(orchestrateursVivants(reponse), []);
  }
});

// ═══════════════════════════════ quand il déclenche

test('le topo tombe à 7 h 00, et la ronde revient toutes les heures', () => {
  const topo = construirePlist('topo', { node: '/n', script: '/s', journal: '/j' });
  assert.match(topo, /<key>StartCalendarInterval<\/key>/);
  assert.match(topo, /<key>Hour<\/key><integer>7<\/integer>/);
  assert.match(topo, /<key>Minute<\/key><integer>0<\/integer>/);

  const ronde = construirePlist('ronde', { node: '/n', script: '/s', journal: '/j' });
  assert.match(ronde, /<key>StartInterval<\/key><integer>3600<\/integer>/);
});

test('installer le réveil ne déclenche PAS un topo à l’heure de l’installation', () => {
  // `RunAtLoad` à vrai ferait poser un topo à 14 h le jour où on installe le service. Le
  // rendez-vous est une HEURE, pas un événement d'installation.
  for (const nom of Object.keys(RENDEZ_VOUS)) {
    assert.match(construirePlist(nom, { node: '/n', script: '/s', journal: '/j' }), /<key>RunAtLoad<\/key><false\/>/);
  }
});

test('aucun rendez-vous ne se relance en boucle', () => {
  // `KeepAlive` réveillerait les orchestrateurs sans arrêt — le mode de panne inverse, et
  // pire : un agent qu'on interrompt en continu ne travaille plus.
  for (const nom of Object.keys(RENDEZ_VOUS)) {
    assert.ok(
      !construirePlist(nom, { node: '/n', script: '/s', journal: '/j' }).includes('KeepAlive'),
      `${nom} se relancerait en boucle`,
    );
  }
});

test('le descripteur porte son PATH — un service ne charge aucun profil de shell', () => {
  // La panne classique de ce genre d'installation : tout marche à la main, rien ne marche au
  // démarrage, parce que `herdr` est introuvable.
  const plist = construirePlist('ronde', { node: '/n', script: '/s', path: '/opt/homebrew/bin:/usr/bin', journal: '/j' });
  assert.match(plist, /<key>PATH<\/key><string>\/opt\/homebrew\/bin:\/usr\/bin<\/string>/);
});

test('les deux rendez-vous ont des étiquettes DISTINCTES', () => {
  // Une étiquette partagée ferait que poser le second décharge le premier — et un seul des
  // deux rendez-vous survivrait, en silence.
  const etiquettes = Object.keys(RENDEZ_VOUS).map((n) => rendezVous(n).etiquette);
  assert.equal(new Set(etiquettes).size, etiquettes.length);
  assert.notEqual(cheminPlist('ronde'), cheminPlist('topo'));
});

test('un chemin ou un nom à caractères spéciaux ne casse pas le descripteur', () => {
  const plist = construirePlist('ronde', { node: '/n & co', script: '/s<>', journal: '/j&' });
  assert.ok(!/[^&]&(?!amp;|lt;|gt;)/.test(plist), 'une esperluette nue rend le descripteur illisible par launchd');
  assert.match(plist, /\/s&lt;&gt;/);
});

test('un rendez-vous inconnu échoue bruyamment plutôt que de ne rien faire', () => {
  assert.throws(() => rendezVous('gouter'), RendezVousInconnu);
  assert.throws(() => construirePlist('gouter', {}), RendezVousInconnu);
});

// ═══════════════════════════════ ce qu'il dit, et ce qu'il ne dit pas

test('le rappel RAPPELLE — il ne rédige ni la ronde ni le topo', () => {
  // Un réveil qui composerait le rapport produirait un compte rendu plausible et faux : le
  // même défaut que le brief fusionné, un cran plus haut. Il n'a rien à dire du chantier.
  for (const nom of Object.keys(RENDEZ_VOUS)) {
    const rappel = rendezVous(nom).rappel;
    assert.ok(rappel.length < 600, `${nom} : le rappel est trop long pour un rappel — il commence à raconter`);
    assert.match(rappel, /c'est l'heure/i, `${nom} : le rappel doit dire que c'est l'heure`);
  }
});

test('le topo porte les trois rubriques du scrum, et l’interdiction de sauter son tour', () => {
  const r = RENDEZ_VOUS.topo.rappel;
  for (const rubrique of [/fait/i, /en cours/i, /bloque/i]) {
    assert.match(r, rubrique, 'une rubrique du scrum manque au rappel');
  }
  assert.match(r, /rien de neuf/i, 'on ne saute pas son tour : « rien de neuf » est une information');
});

test('la ronde rappelle ce qu’elle regarde — et qu’elle ne fait pas le travail des agents', () => {
  const r = RENDEZ_VOUS.ronde.rappel;
  assert.match(r, /bloqué/i);
  assert.match(r, /fini/i);
  assert.match(r, /rouge/i);
  assert.match(r, /pas le clavier|arbitres/i, 'la ronde ne transforme pas l’orchestrateur en exécutant');
});

// ═════════ T-20260815-0008 — LA RONDE BALAIE LES SESSIONS, ET CHAQUE RAPPEL SAIT OÙ ALLER
//
// CE QUI A ÉTÉ MESURÉ, ET QUI N'ÉTAIT PAS CE QU'ON CROYAIT
//
// `j-20260814-0002`, orchestrateur vivant : « je n'ai reçu AUCUN signal de réveil depuis ma
// naissance, ni pour ma ronde ni pour le topo de 7 h ». Il avait posé une boucle à la main
// sans savoir pourquoi le réveil ne venait pas.
//
// Deux causes, indépendantes :
//   1. les agents de session n'ont JAMAIS été installés — rien chez `launchctl`, aucun
//      descripteur sur disque, et aucun geste du pack ne les pose ;
//   2. même installés, ils n'auraient joint qu'UNE session : la ronde demandait la liste des
//      agents sans désigner personne, donc à celle de son environnement — c'est-à-dire, pour
//      un agent de session qui ne charge aucun profil, à AUCUNE.
//
// ⚠️ ET LE CORRECTIF ÉVIDENT ÉTAIT LE MAUVAIS. Poser `HERDR_SOCKET_PATH` dans le descripteur
// figerait la ronde sur une session choisie le jour de l'installation, pendant que le
// dirigeant en ouvre au fil de l'eau. Le veilleur de `ligne-directe`, lui, tourne et ne porte
// que `PATH` : il ne dépend d'aucune variable, il DÉCOUVRE les sessions et les balaie toutes.
// C'est ce modèle-là qui est repris ici.

const orchestrateurDe = (pane, nom) => ({ pane_id: pane, name: nom, foreground_cwd: `/depot/.orchestrateur/${nom}` });
const estUnLieuDEssai = (chemin) => (chemin.includes('.orchestrateur/') ? 'orchestrateur' : null);

/** Un herdr qui répond différemment selon la session à laquelle on parle. */
function appelPar(reponses) {
  return async (_commande, { socket } = {}) => {
    const r = reponses[socket];
    if (!r) return { ok: false, reponse: null, message: `session muette : ${socket}` };
    return { ok: true, reponse: { result: { agents: r } }, message: '' };
  };
}

test('la ronde trouve les orchestrateurs de TOUTES les sessions, pas seulement de la sienne', async () => {
  const r = await orchestrateursDuPoste({
    sessions: ['/s/somtech.sock', '/s/sibelanger.sock'],
    appel: appelPar({
      '/s/somtech.sock': [orchestrateurDe('w0:pB', 'j-20260814-0002')],
      '/s/sibelanger.sock': [orchestrateurDe('w9:p1', 'p-20260728-0002')],
    }),
    estUnLieu: estUnLieuDEssai,
  });
  assert.equal(r.orchestrateurs.length, 2, 'les deux sessions portent un orchestrateur — les deux doivent être vus');
  assert.deepEqual(r.orchestrateurs.map((o) => o.nom).sort(), ['j-20260814-0002', 'p-20260728-0002']);
});

// LE POINT QUI DÉCIDE DE TOUT : un rappel envoyé sur le mauvais socket ne joint personne.
test('chaque orchestrateur porte le socket de SA session — pas celui de la première venue', async () => {
  const r = await orchestrateursDuPoste({
    sessions: ['/s/somtech.sock', '/s/sibelanger.sock'],
    appel: appelPar({
      '/s/somtech.sock': [orchestrateurDe('w0:pB', 'chez-somtech')],
      '/s/sibelanger.sock': [orchestrateurDe('w9:p1', 'chez-sibelanger')],
    }),
    estUnLieu: estUnLieuDEssai,
  });
  const par = Object.fromEntries(r.orchestrateurs.map((o) => [o.nom, o.socket]));
  assert.equal(par['chez-somtech'], '/s/somtech.sock');
  assert.equal(par['chez-sibelanger'], '/s/sibelanger.sock');
});

test('une session muette n’empêche pas de réveiller les autres — et elle est rapportée', async () => {
  const r = await orchestrateursDuPoste({
    sessions: ['/s/morte.sock', '/s/vivante.sock'],
    appel: appelPar({ '/s/vivante.sock': [orchestrateurDe('w9:p1', 'vivant')] }),
    estUnLieu: estUnLieuDEssai,
  });
  assert.equal(r.orchestrateurs.length, 1, 'une session qui ne répond pas ne doit pas faire tomber la ronde');
  assert.deepEqual(r.muettes, ['/s/morte.sock'], 'et elle doit être NOMMÉE — sinon la ronde ment par omission');
});

test('aucune session ouverte se distingue d’aucun orchestrateur — deux silences, deux causes', async () => {
  const sansSession = await orchestrateursDuPoste({ sessions: [], appel: appelPar({}), estUnLieu: estUnLieuDEssai });
  assert.equal(sansSession.sessions, 0);
  assert.deepEqual(sansSession.orchestrateurs, []);

  const sansOrchestrateur = await orchestrateursDuPoste({
    sessions: ['/s/vide.sock'],
    appel: appelPar({ '/s/vide.sock': [{ pane_id: 'w1:p1', name: 'un-agent', foreground_cwd: '/depot' }] }),
    estUnLieu: estUnLieuDEssai,
  });
  assert.equal(sansOrchestrateur.sessions, 1, 'une session répond — le silence n’a pas la même cause');
  assert.deepEqual(sansOrchestrateur.orchestrateurs, []);
});

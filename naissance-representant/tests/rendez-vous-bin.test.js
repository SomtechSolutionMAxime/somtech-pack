// rendez-vous-bin.test.js — le fichier exécutable réel de la ronde, avec un FAUX herdr en
// tête de PATH. Aucun service n'est installé, aucun `launchctl` n'est touché.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260815-0008)
//
// Le correctif de ce ticket distingue TROIS silences que la ronde confondait. Une revue en
// passe 1 a posé la mutation qui manquait — retirer le refus « aucune session ouverte » de
// `tenir()` — et **les tests sont restés verts** : ils éprouvaient le balayage, jamais le
// code qui INTERPRÈTE ce que le balayage rend.
//
// C'était le motif dominant de ce dépôt, commis dans le lot qui le corrige : des messages
// écrits pour être lus par un humain, et que rien n'oblige à exister.
//
// ⚠️ LES TROIS SILENCES NE SE VALENT PAS, et c'est tout l'objet :
//
//   • aucune session ouverte      → PANNE : il n'y a nulle part où regarder ;
//   • toutes les sessions muettes → PANNE : on n'a rien pu établir ;
//   • aucun orchestrateur vivant  → SUCCÈS : personne n'attend de rappel.
//
// Les confondre est ce qui a laissé un orchestrateur vivre des jours sans un seul réveil.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const BIN = join(resolve(HERE, '..'), 'bin', 'rendez-vous.js');

let bac;
let pathOriginal;

/** Un faux herdr qui répond — ou non — selon la session à laquelle on lui parle. */
function installerFauxHerdr({ muettes = false, agents = [] } = {}) {
  const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'agent' && args[1] === 'list') {
  ${muettes ? 'process.stderr.write("session injoignable\\n"); process.exit(1);' : ''}
  process.stdout.write(JSON.stringify({ result: { agents: ${JSON.stringify(agents)} } }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ result: { ok: true } }));
process.exit(0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

/** Joue la ronde pour de vrai, avec les sessions qu'on lui désigne. */
function lancerRonde(sessions, surcharges = {}) {
  const r = spawnSync(process.execPath, [BIN, 'ronde'], {
    env: {
      ...process.env,
      HERDR_SESSIONS_ESSAIS: sessions.join(':'),
      HERDR_SOCKET_PATH: '',
      // ⚠️ LA RACINE DE LA RONDE VA DANS LE BAC, TOUJOURS (T-20260818-0014). Sans ça, un essai
      // lit le VRAI registre du poste et — depuis que la ronde note son dernier passage — y
      // ÉCRIT. Un essai qui touche l'état vivant du poste peut le faire mentir : la trace du
      // dernier passage dirait qu'une ronde vient d'aboutir alors qu'aucune n'a eu lieu, ce
      // qui est très exactement le mensonge que cette trace existe pour rendre impossible.
      LIGNE_DIRECTE_RACINE: join(bac, 'racine'),
      // ⚠️ CES DEUX-LÀ SEULEMENT — ce sont les seules que la ronde lit vraiment.
      // Une première version posait aussi `LIVRAISON_*`, que RIEN ne lit sur ce chemin :
      // une configuration morte qui affirme un contrôle qu'elle n'a pas. Le test paraissait
      // borné et ne l'était pas — le jour où le faux herdr déclencherait une relivraison,
      // les défauts de 15 essais et 20 s s'appliqueraient quand même.
      RENDEZ_VOUS_DELAI_MS: '5',
      RENDEZ_VOUS_ECHEANCE_MS: '50',
      // ⚠️ Les essais de la VIGIE ont besoin d'une échéance réelle : elle est bornée par le
      // même budget que la livraison, et 50 ms ne laissent pas la place à trois lectures
      // espacées. Le plafond a d'ailleurs coupé le premier jet de ces essais — il fonctionne.
      ...surcharges,
    },
  });
  return { code: r.status ?? 1, stdout: (r.stdout ?? '').toString(), stderr: (r.stderr ?? '').toString() };
}

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'smtk-rdv-bin-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});

after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});

test('AUCUNE SESSION OUVERTE est une panne, et la ronde le dit — pas un silence de plus', () => {
  installerFauxHerdr();
  const r = lancerRonde([], { LIGNE_DIRECTE_RACINE: join(bac, 'r-sans-session') });
  assert.equal(r.code, 1, `panne attendue — stderr: ${r.stderr}`);
  assert.match(r.stderr, /aucune session/i, 'le motif doit être nommé');
  assert.match(
    r.stderr,
    /personne n'attend|pas la même chose/i,
    'et distingué du cas où personne n’attend — c’est la confusion qui a coûté des jours'
  );
  // ⚠️ ET LA TRACE AUSSI, relevé en revue par mutation : ce chemin de sortie n'était gardé
  // par rien. Une ronde qui meurt sans trace est indiscernable d'une ronde jamais lancée.
  assert.equal(tracePassage('r-sans-session').ronde.verdict, 'aucune-session');
});

test('TOUTES LES SESSIONS MUETTES est une panne, et la ronde nomme celles qui n’ont pas répondu', () => {
  installerFauxHerdr({ muettes: true });
  const r = lancerRonde(['/s/a.sock', '/s/b.sock'], { LIGNE_DIRECTE_RACINE: join(bac, 'r-muettes') });
  assert.equal(r.code, 1, `panne attendue — stderr: ${r.stderr}`);
  assert.match(r.stderr, /muettes/i);
  assert.match(r.stderr, /\/s\/a\.sock/, 'chaque session muette doit être nommée — sinon la ronde ment par omission');
  assert.match(r.stderr, /\/s\/b\.sock/);
  const trace = tracePassage('r-muettes');
  assert.equal(trace.ronde.verdict, 'sessions-muettes', 'et sa mort est NOMMÉE, distincte des autres');
  assert.equal(trace.ronde.muettes, 2);
});

// ⚠️ LE CAS QUI DOIT RÉUSSIR, et c'est celui qu'on rangerait le plus volontiers avec les
// pannes : les sessions répondent, il n'y a simplement aucun orchestrateur vivant. Personne
// n'attend de rappel — un réveil qui échouerait là ferait du bruit chaque heure de la nuit.
test('AUCUN ORCHESTRATEUR VIVANT est un SUCCÈS — les sessions ont répondu, personne n’attend', () => {
  installerFauxHerdr({ agents: [{ pane_id: 'w1:p1', name: 'un-agent', foreground_cwd: '/un/depot/sans/lieu' }] });
  const r = lancerRonde(['/s/a.sock']);
  assert.equal(r.code, 0, `succès attendu — stderr: ${r.stderr}`);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.orchestrateurs, 0);
  assert.equal(rendu.sessions, 1, 'et le compte rendu dit combien de sessions ont été regardées');
  assert.deepEqual(rendu.muettes, [], 'aucune muette : le silence n’a pas la même cause');
});

test('le compte rendu porte ce que la ronde a REGARDÉ, pas seulement ce qu’elle a livré', () => {
  installerFauxHerdr({ agents: [] });
  const r = lancerRonde(['/s/a.sock', '/s/b.sock']);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.sessions, 2, 'sans ce compte, un réveil qui ne voit rien est indiscernable d’un réveil qui n’a rien cherché');
});

// ═══════ LE POINT QUI DÉCIDE DE TOUT : chaque rappel part vers la session de SON destinataire
//
// ⚠️ CE CONTRÔLE EXISTE PARCE QUE LA REVUE DE FOND A MONTRÉ QU'IL MANQUAIT. Elle a remplacé
// `socket: c.socket` par `socket: null` dans le binaire — le bug d'origine, exactement — et
// **224 tests sont restés verts**. Les contrôles unitaires éprouvaient le balayage, les
// contrôles de bout en bout n'atteignaient que les cas SANS orchestrateur.
//
// Sans lui, on aurait remplacé « ne réveiller personne » par « en réveiller un et croire
// avoir fait le tour » — et c'est le genre de régression qui ne se voit qu'à un réveil qui
// n'arrive pas, c'est-à-dire à rien.

/** Un vrai lieu d'orchestrateur sur disque — `roleDuLieu` le lit, il ne le devine pas. */
function lieuDOrchestrateur(nom) {
  // ⚠️ ON COPIE LES VRAIS GABARITS, on n'invente pas leur contenu. `roleDuLieu` reconnaît un
  // lieu à la PREMIÈRE LIGNE de chacun de ses fichiers — un lieu fabriqué à la main serait
  // rejeté, et le contrôle mesurerait alors le contraire de ce qu'il croit.
  const lieu = join(bac, 'depot', '.orchestrateur', nom);
  const gabarits = join(REPO_ROOT, '.claude', 'templates', 'orchestrateur');
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  for (const f of ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json', join('.claude', 'settings.json')]) {
    copyFileSync(join(gabarits, f), join(lieu, f));
  }
  return lieu;
}

/** Un faux herdr qui note À QUI on lui a parlé, pour chaque geste. */
function fauxHerdrQuiNoteLaSession(parSession) {
  const journal = join(bac, 'sessions.jsonl');
  writeFileSync(journal, '');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const socket = process.env.HERDR_SOCKET_PATH || null;
fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify({ a: args, s: socket }) + '\\n');
const parSession = ${JSON.stringify(parSession)};
if (args[0] === 'agent' && args[1] === 'list') {
  process.stdout.write(JSON.stringify({ result: { agents: parSession[socket] || [] } }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ result: { ok: true } }));
process.exit(0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
  return journal;
}

/**
 * Un faux herdr qui joue un pane FIGÉ : il répond, il se dit au travail, et sa `revision` ne
 * bouge jamais. C'est le troisième état — ni écran, ni erreur, rien qui cloche à première vue.
 */
function fauxHerdrQuiFige(pane, lieu) {
  const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'agent' && args[1] === 'list') {
  process.stdout.write(JSON.stringify({ result: { agents: [
    { pane_id: ${JSON.stringify(pane)}, name: 'orch-fige', agent_status: 'working',
      foreground_cwd: ${JSON.stringify(lieu)}, revision: 4242 },
  ] } }));
  process.exit(0);
}
if (args[0] === 'agent' && args[1] === 'get') {
  // TOUJOURS la même revision — c'est ça, être figé.
  process.stdout.write(JSON.stringify({ result: { agent: {
    pane_id: ${JSON.stringify(pane)}, agent_status: 'working', revision: 4242 } } }));
  process.exit(0);
}
if (args[0] === 'agent' && args[1] === 'read') { process.stdout.write('un ecran qui ne change pas'); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
process.exit(0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

test('LA RONDE VOIT UN AGENT FIGÉ ET LE RAPPORTE — sinon la vigie ne sert à rien en vrai', () => {
  // ⚠️ LA GARDE QUI MANQUAIT AU LOT PRÉCÉDENT, APPLIQUÉE À CELUI-CI. `verdictDeVigie` a ses
  // propres essais et ils sont verts ; ça ne prouve PAS que la ronde l'appelle. Sans cet
  // essai, on pourrait retirer tout le branchement et la suite resterait verte — la vigie
  // existerait dans le dépôt et nulle part dans la vie du poste.
  const lieu = lieuDOrchestrateur('fige');
  fauxHerdrQuiFige('w9:pF', lieu);
  // ⚠️ UNE SÉRIE RÉELLE, PAS INSTANTANÉE. Le premier jet de cet essai espaçait les lectures de
  // 10 ms : la vigie a rendu `null`, et elle avait raison — trois lectures dans le même
  // vingtième de seconde ne prouvent pas qu'un agent est figé, elles prouvent qu'on a regardé
  // trop vite. Abaisser le seuil du jugement pour faire passer l'essai aurait détruit la garde
  // que l'essai prétend éprouver. On paie donc les secondes.
  //
  // ⚠️ ET LA REPRISE FINIT EN UN TOUR, DÉLIBÉRÉMENT (T-20260818-0014). Avec le délai par
  // défaut du harnais (5 ms), la boucle de reprise dépense TOUT le budget de livraison en
  // essais serrés — ce qui rendait la durée de cet essai, et le temps qu'il reste à la vigie,
  // dépendants de la PART accordée à la livraison. Un essai de la vigie qui rougit quand on
  // ajuste le partage du budget ne garde plus la vigie : il garde une constante. Un délai
  // supérieur à la part fait sortir la reprise après un tour, et rend l'essai indifférent au
  // partage — ce qu'il doit être.
  const r = lancerRonde(['/s/a.sock'], {
    RENDEZ_VOUS_VIGIE_MS: '8000',
    RENDEZ_VOUS_ECHEANCE_MS: '60000',
    RENDEZ_VOUS_DELAI_MS: '60000',
  });
  const dit = JSON.parse(r.stdout.trim().split('\n').pop());

  assert.ok(dit.vigie, 'le compte rendu porte ce que la vigie a vu');
  assert.equal(dit.vigie.length, 1);
  assert.equal(dit.vigie[0].forme, 'fige-sans-ecran');
  assert.equal(dit.vigie[0].pane, 'w9:pF');
  // La capture, parce que le spécimen a été perdu deux fois faute d'avoir été mesuré.
  assert.deepEqual(dit.vigie[0].capture.revisions, [4242, 4242, 4242]);
  assert.match(dit.vigie[0].limite, /jamais/i, 'et la limite voyage avec le verdict');
});

/**
 * Un faux herdr COMPLET — il livre pour de vrai, et il NOTE chaque appel reçu.
 *
 * ⚠️ IL EXISTE PARCE QUE LE PREMIER ESSAI DE COÛT NE PROUVAIT RIEN, relevé en revue de fond.
 * Le double d'origine ne répondait qu'à `agent list` : `agent get` rendait `{ok:true}` sans
 * champ `agent`, donc la LIVRAISON échouait, donc l'agent « sain » était classé suspect et
 * regardé quand même. Retirer le filtre des suspects laissait l'essai VERT — il passait par
 * un autre chemin que celui qu'il nommait, le motif exact que ce lot documente ailleurs.
 *
 * Ici la boîte est vue vide, la session est `idle`, la remise aboutit — et le journal dit
 * combien de fois chaque pane a été interrogé.
 */
function fauxHerdrQuiLivreEtCompte(pane, lieu, journal) {
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(journal)}, args.join(' ') + '\\n');
if (args[0] === 'agent' && args[1] === 'list') {
  process.stdout.write(JSON.stringify({ result: { agents: [
    { pane_id: ${JSON.stringify(pane)}, name: 'orch-sain', agent_status: 'idle',
      foreground_cwd: ${JSON.stringify(lieu)}, revision: 7 },
  ] } }));
  process.exit(0);
}
if (args[0] === 'agent' && args[1] === 'get') {
  process.stdout.write(JSON.stringify({ result: { agent: {
    pane_id: ${JSON.stringify(pane)}, agent_status: 'idle', revision: 7 } } }));
  process.exit(0);
}
if (args[0] === 'agent' && args[1] === 'read') {
  // Une boîte de saisie VUE VIDE — sans ça la remise refuse et l'agent redevient suspect.
  process.stdout.write(['sortie', '──────────', '\\u276f ', '──────────'].join('\\n'));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ result: { ok: true } }));
process.exit(0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

test('UN AGENT QUI A PRIS SON RAPPEL N’EST PAS REGARDÉ — prouvé en COMPTANT les lectures', () => {
  // La série coûte trois lectures espacées PAR SUSPECT. La payer sur les 79 panes du poste à
  // chaque ronde serait un prix qu'on finirait par retirer, en emportant la garde avec.
  //
  // ⚠️ ET ON LE PROUVE PAR LE NOMBRE D'APPELS, pas par l'absence de verdict. Une vigie qui
  // regarderait tout le monde ne rendrait rien non plus sur un agent sain — l'absence de
  // section `vigie` ne distingue donc pas « il n'a pas été regardé » de « il a été regardé
  // pour rien ». C'est le compteur qui tranche.
  const lieu = lieuDOrchestrateur('sain');
  const journal = join(bac, 'appels.log');
  writeFileSync(journal, '');
  fauxHerdrQuiLivreEtCompte('w9:pS', lieu, journal);
  // Même budget que l'essai du figé : si la vigie regardait cet agent, elle EN AURAIT LE TEMPS.
  // Sans ça, l'essai prouverait le plafond au lieu de prouver le filtre.
  const r = lancerRonde(['/s/a.sock'], { RENDEZ_VOUS_VIGIE_MS: '8000', RENDEZ_VOUS_ECHEANCE_MS: '120000' });
  const dit = JSON.parse(r.stdout.trim().split('\n').pop());
  const appels = readFileSync(journal, 'utf8').split('\n').filter(Boolean);

  assert.equal(dit.livres, 1, 'le rappel a bien été pris — sinon l’agent serait un suspect');
  assert.equal(dit.vigie, undefined, 'et rien n’est signalé');
  // La remise elle-même interroge le pane ; la vigie en ajouterait TROIS de plus, espacées.
  const gets = appels.filter((a) => a.startsWith('agent get')).length;
  assert.ok(gets < 3, `la vigie n’a pas regardé un agent livré — ${gets} interrogation(s) au total`);
});

/** Deux panes figés dans la même session — pour éprouver ce que la vigie fait quand le temps manque. */
function fauxHerdrQuiFigeDeux(lieu) {
  const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'agent' && args[1] === 'list') {
  process.stdout.write(JSON.stringify({ result: { agents: [
    { pane_id: 'w9:pA', name: 'orch-a', agent_status: 'working', foreground_cwd: ${JSON.stringify(lieu)}, revision: 11 },
    { pane_id: 'w9:pB', name: 'orch-b', agent_status: 'working', foreground_cwd: ${JSON.stringify(lieu)}, revision: 22 },
  ] } }));
  process.exit(0);
}
if (args[0] === 'agent' && args[1] === 'get') {
  const rev = args[2] === 'w9:pA' ? 11 : 22;
  process.stdout.write(JSON.stringify({ result: { agent: { pane_id: args[2], agent_status: 'working', revision: rev } } }));
  process.exit(0);
}
if (args[0] === 'agent' && args[1] === 'read') { process.stdout.write('un ecran qui ne change pas'); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
process.exit(0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

test('CE QUE LA VIGIE N’A PAS EU LE TEMPS DE REGARDER EST DIT, JAMAIS TU', () => {
  // ⚠️ LA GARDE DE COÛT, ET ELLE N'ÉTAIT PROUVÉE PAR RIEN — la retirer laissait tout vert.
  // La série coûte trois lectures espacées PAR suspect, en séquence. Une panne herdr large
  // ferait plusieurs suspects d'un coup et la ronde s'allongerait sans plafond, jusqu'à mordre
  // sur la suivante. Elle est donc bornée par la même échéance que la livraison.
  //
  // Et ce qui saute doit se DIRE : un pane non regardé n'est ni sain ni figé, il n'est pas
  // mesuré. Le taire remettrait exactement le silence que ce lot existe pour supprimer.
  const lieu = lieuDOrchestrateur('deux');
  fauxHerdrQuiFigeDeux(lieu);
  // De quoi regarder UN suspect (2 × 8 s), pas deux.
  //
  // ⚠️ CE BUDGET A ÉTÉ RECALIBRÉ (T-20260818-0014), et il faut dire pourquoi. Il valait
  // `DELAI` par défaut (5 ms) et `ÉCHÉANCE` 25 s, et il ne tenait QUE parce que la vigie se
  // ré-armait une échéance pleine après celle de la livraison : la reprise mangeait les 25 s,
  // et la vigie repartait avec 25 s neuves. Le budget est désormais UN SEUL pour toute la
  // ronde. On donne donc explicitement à la reprise de quoi finir en un tour (`DELAI` ≥ sa
  // part du budget), et à la vigie de quoi regarder UN suspect (24 s réservées) mais pas deux
  // (48 s) — ce que l'essai éprouve, et rien d'autre.
  const r = lancerRonde(['/s/a.sock'], {
    RENDEZ_VOUS_VIGIE_MS: '8000',
    RENDEZ_VOUS_ECHEANCE_MS: '36000',
    RENDEZ_VOUS_DELAI_MS: '60000',
  });
  const dit = JSON.parse(r.stdout.trim().split('\n').pop());

  assert.equal(dit.vigie?.length, 1, 'un seul a pu être regardé');
  assert.deepEqual(dit.vigie_non_regardes, ['w9:pB'], 'et l’autre est NOMMÉ, pas passé sous silence');
  assert.match(r.stderr, /n'a pas eu le temps/, 'le journal le dit aussi, en clair');
});

test('LA RONDE SIGNALE UNE LIGNE DONT LE CHANTIER A DISPARU — et ne la ferme pas', () => {
  // ⚠️ L'ESSAI DU BRANCHEMENT, et c'est le point que ce dépôt oublie le plus souvent :
  // `hygiene.js` a ses propres essais et ils sont verts ; ça ne prouve PAS que la ronde
  // l'appelle. Sans celui-ci, on pourrait retirer tout le branchement et la suite resterait
  // verte — la passe existerait dans le dépôt et nulle part dans la vie du poste.
  const lieu = lieuDOrchestrateur('hygiene');
  installerFauxHerdr({ agents: [{ pane_id: 'w9:pH', name: 'orch', agent_status: 'idle', foreground_cwd: lieu }] });
  const registre = join(bac, 'registre-hygiene');
  mkdirSync(registre, { recursive: true });
  writeFileSync(
    join(registre, 'registre.json'),
    JSON.stringify({
      version: 1,
      lignes: [
        { chantier: 'chantier-mort', canal_id: 'C_mort', canal_nom: 'mort', pane: 'w26:pM',
          worktree: '/un/worktree/supprime/20260805', ouverte_le: 'h', close_le: null },
        { chantier: 'chantier-vivant', canal_id: 'C_vif', canal_nom: 'vif', pane: 'w26:pN',
          worktree: bac, ouverte_le: 'h', close_le: null },
      ],
      commun: null,
      dirigeant: null,
    })
  );
  const r = lancerRonde(['/s/a.sock'], { LIGNE_DIRECTE_RACINE: registre });
  const dit = JSON.parse(r.stdout.trim().split('\n').pop());

  assert.equal(dit.lignes_au_chantier_disparu?.length, 1, 'une seule ligne morte — pas la vivante');
  assert.equal(dit.lignes_au_chantier_disparu[0].chantier, 'chantier-mort');
  assert.match(r.stderr, /fermer --a chantier-mort/, 'le geste exact est écrit à l’humain');
  assert.match(r.stderr, /w26:pM/, 'avec le pane d’où le lancer');
  assert.match(r.stderr, /Rien n'a été fermé/i, 'et rien n’a été fermé à sa place');
});

test('chaque rappel part vers la session de SON orchestrateur — jamais celle du premier venu', () => {
  const lieuA = lieuDOrchestrateur('chez-a');
  const lieuB = lieuDOrchestrateur('chez-b');
  const sockA = '/s/a.sock';
  const sockB = '/s/b.sock';
  const journal = fauxHerdrQuiNoteLaSession({
    [sockA]: [{ pane_id: 'wA:p1', name: 'chez-a', foreground_cwd: lieuA }],
    [sockB]: [{ pane_id: 'wB:p1', name: 'chez-b', foreground_cwd: lieuB }],
  });

  lancerRonde([sockA, sockB]);

  const entrees = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const versPane = (pane) => entrees.filter((e) => e.a.includes(pane)).map((e) => e.s);

  const gestesA = versPane('wA:p1');
  const gestesB = versPane('wB:p1');
  assert.ok(gestesA.length > 0, 'l’orchestrateur de la session A doit avoir reçu au moins un geste');
  assert.ok(gestesB.length > 0, 'et celui de la session B aussi — sinon on n’en réveille qu’un');
  assert.deepEqual([...new Set(gestesA)], [sockA], 'tout geste vers wA:p1 passe par la session A');
  assert.deepEqual([...new Set(gestesB)], [sockB], 'tout geste vers wB:p1 passe par la session B');
});

// ═════ LES DEUX SILENCES QUE « AUCUN ORCHESTRATEUR » CONFONDAIT ENCORE
//
// ⚠️ TROUVÉ PAR LA REVUE DE FOND, et c'est le mode de panne de ce ticket qui se rouvre.
// « Zéro orchestrateur » avait deux causes que rien ne séparait : il n'y en a vraiment
// aucun, ou `roleDuLieu` n'en a reconnu aucun — un gabarit modifié, un en-tête déplacé, et
// la reconnaissance échoue **en silence**. Les deux rendaient le même succès, `exit 0`.
//
// Un poste avec onze agents vivants et zéro reconnu se déclarait donc content, exactement
// comme un poste vide. C'est l'état qu'aurait ce ticket s'il se rouvrait, et personne ne
// pouvait le voir sans compter les panes à la main.
test('le compte rendu sépare « personne n’attend » de « je ne reconnais personne »', () => {
  installerFauxHerdr({
    agents: [
      { pane_id: 'w1:p1', name: 'un', foreground_cwd: '/un/depot/sans/lieu' },
      { pane_id: 'w1:p2', name: 'deux', foreground_cwd: '/un/autre/sans/lieu' },
    ],
  });
  const avecDesAgents = JSON.parse(lancerRonde(['/s/a.sock']).stdout);
  assert.equal(avecDesAgents.orchestrateurs, 0);
  assert.equal(
    avecDesAgents.agents_vus,
    2,
    'deux agents vivants et aucun reconnu — un humain doit pouvoir le voir sans compter les panes à la main'
  );

  installerFauxHerdr({ agents: [] });
  const vraimentVide = JSON.parse(lancerRonde(['/s/a.sock']).stdout);
  assert.equal(vraimentVide.orchestrateurs, 0);
  assert.equal(vraimentVide.agents_vus, 0, 'ici il n’y a réellement personne — et ça ne se dit pas pareil');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE PLAFOND DE TEMPS — une ronde qui n'aboutit pas doit ÉCHOUER, jamais pendre
// (T-20260818-0014)
//
// ⚠️ CE QUI A ÉTÉ MESURÉ, ET CE QUI A ÉTÉ ÉCARTÉ. Le ticket portait deux hypothèses sur une
// ronde bloquée « dans `kevent`, sur une paire de tubes en fd 4/5, sans aucun enfant » : un
// enfant qui n'a jamais démarré, ou un parent qui garde son côté écriture ouvert. **Les deux
// sont fausses.** Mesuré : un processus Node qui ne fait qu'un `setTimeout`, sans le moindre
// enfant, montre exactement la même chose — fd 3 KQUEUE, fd 4 et 5 une paire de tubes. C'est
// le tube de réveil interne de libuv, présent dans TOUT processus Node. La signature ne
// désignait aucun enfant perdu : la ronde DORMAIT, dans la boucle de reprise.
//
// Le vrai défaut est ailleurs, et il est ici : **rien ne borne une ronde par le haut**. Ni
// le balayage des sessions, ni une remise, ni une lecture de la vigie n'a de plafond — un
// seul appel `herdr` qui ne rend jamais la main suffit à faire pendre la ronde pour toujours.
// Et comme le service n'accepte qu'une instance, une ronde qui pend n'en rate pas une : elle
// les ANNULE TOUTES, sans que rien ne le dise.
//
// Cet essai reproduit exactement ça — un `herdr` qui ne répond jamais — et exige que la ronde
// MEURE D'ELLE-MÊME, en le disant. Il distingue les deux morts : `signal` non nul veut dire
// que c'est le harnais qui l'a tuée, pas son plafond. Sans cette distinction, l'essai serait
// vert le jour où la ronde pend, ce qui est précisément le défaut qu'il éprouve.

/** Un faux herdr qui ne répond JAMAIS — le seul appel qui fait pendre une ronde sans plafond. */
function fauxHerdrQuiNeRepondJamais() {
  const script = `#!/usr/bin/env node
// Il ne sort pas, il n'écrit rien : c'est un appel dont on n'aura jamais la réponse.
// Le filet à 120 s est là pour le cas où le plafond ne le tuerait pas — il ne doit JAMAIS
// être atteint dans un essai vert, et il n'est pas ce que l'essai mesure.
setTimeout(() => process.exit(0), 120000);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

test('UNE RONDE QUI NE REND PAS LA MAIN MEURT DE SON PLAFOND, ET LE DIT', () => {
  fauxHerdrQuiNeRepondJamais();
  const debut = Date.now();
  const r = spawnSync(process.execPath, [BIN, 'ronde'], {
    env: {
      ...process.env,
      HERDR_SESSIONS_ESSAIS: '/s/a.sock',
      HERDR_SOCKET_PATH: '',
      // ⚠️ LA CLOISON, ICI AUSSI. Ce `spawnSync` en ligne ne passe pas par `lancerRonde` : il
      // a donc échappé à la cloison, et il a ÉCRIT une trace « plafond-depasse » dans le VRAI
      // ~/.somtech du poste — mesuré. Un essai qui fait dire au poste qu'une ronde vient de
      // mourir alors qu'aucune n'a eu lieu produit le mensonge exact que cette trace existe
      // pour rendre impossible.
      LIGNE_DIRECTE_RACINE: join(bac, 'racine'),
      RENDEZ_VOUS_DELAI_MS: '5',
      RENDEZ_VOUS_ECHEANCE_MS: '2000',
      RENDEZ_VOUS_PLAFOND_MS: '2500',
    },
    // ⚠️ LE FILET DU HARNAIS, ET IL N'EST PAS LE PLAFOND ÉPROUVÉ. Sans lui, cet essai
    // PENDRAIT au lieu d'échouer — le défaut même qu'il mesure, commis dans sa mesure.
    timeout: 30000,
    killSignal: 'SIGKILL',
  });
  const ecoule = Date.now() - debut;
  const stderr = (r.stderr ?? '').toString();

  assert.equal(
    r.signal,
    null,
    `la ronde doit mourir D'ELLE-MÊME : ${r.signal} veut dire que c'est le harnais qui l'a tuée, ` +
      `donc qu'elle pendait encore — stderr: ${stderr}`
  );
  assert.notEqual(r.status, 0, 'une ronde qui n’a rien pu établir est une PANNE, jamais un succès silencieux');
  assert.ok(
    ecoule < 15000,
    `la ronde doit rendre la main sous son plafond — ${ecoule} ms écoulées pour un plafond de 2500 ms`
  );
  assert.match(stderr, /plafond/i, 'et le journal doit NOMMER le plafond — un mort sans faire-part est un silence de plus');
  assert.match(stderr, /2500/, 'avec la durée exacte, sinon on ne sait pas ce qui a été dépassé');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'ÉCHÉANCE EST GLOBALE — la vigie ne s'en RE-ARME pas une deuxième
//
// ⚠️ LE DÉFAUT MESURÉ, et il tenait en une ligne. `tenir()` armait `fin = maintenant +
// ÉCHÉANCE` pour la livraison, puis — APRÈS l'avoir dépensée — `finVigie = maintenant +
// ÉCHÉANCE` pour la vigie. Deux budgets pleins à la suite : le plafond réel d'une ronde
// n'était pas l'échéance, c'était le DOUBLE. Avec les valeurs de production, 30 min + 30 min
// = 60 min, soit EXACTEMENT l'intervalle qui sépare deux rondes. Zéro marge, et le
// commentaire du code affirmait le contraire en toutes lettres.
//
// L'essai le prouve par le TEMPS, parce que c'est la seule chose que le défaut change.
test('UNE RONDE TIENT DANS SON ÉCHÉANCE — la vigie n’en re-arme pas une seconde', () => {
  const lieu = lieuDOrchestrateur('budget');
  fauxHerdrQuiFigeDeux(lieu);
  const ECHEANCE = 8000;
  const debut = Date.now();
  const r = lancerRonde(['/s/a.sock'], {
    // La reprise mord tout le budget de livraison : c'est le cas réel, mesuré sur le poste —
    // trois orchestrateurs dont la boîte de saisie ne se vide pas toute seule.
    RENDEZ_VOUS_DELAI_MS: '200',
    RENDEZ_VOUS_ECHEANCE_MS: String(ECHEANCE),
    // Trois lectures espacées de 1,5 s = 4,5 s par suspect. Il n'en reste pas tant.
    RENDEZ_VOUS_VIGIE_MS: '1500',
    RENDEZ_VOUS_PLAFOND_MS: '60000',
  });
  const ecoule = Date.now() - debut;
  const dit = JSON.parse(r.stdout.trim().split('\n').pop());

  assert.ok(
    ecoule < ECHEANCE + 2000,
    `la ronde doit tenir dans son échéance — ${ecoule} ms écoulées pour une échéance de ${ECHEANCE} ms. ` +
      `Au-delà, c'est la vigie qui s'est re-armé un budget plein, et le plafond réel est le double.`
  );
  assert.deepEqual(
    dit.vigie_non_regardes,
    ['w9:pA', 'w9:pB'],
    'et ce que le budget n’a pas permis de regarder est NOMMÉ — un pane non mesuré n’est ni sain ni figé'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA TRACE DU DERNIER PASSAGE — ce qui SÉPARE une vigilance morte d'une vigilance muette
// (T-20260818-0014, point 3)
//
// ⚠️ C'EST CE SILENCE-LÀ QUI A LAISSÉ LE DÉFAUT VIVRE DES JOURS. Une ronde qui n'a rien à
// signaler et une ronde qui n'a jamais eu lieu produisent **exactement la même chose** :
// rien. Personne ne pouvait répondre à « quand une ronde a-t-elle abouti pour la dernière
// fois ? » sans relire un journal que personne ne lit.
//
// ⚠️ ET LA MORT PAR PLAFOND EST CELLE QUI COMPTE LE PLUS. C'est la seule qui n'a produit
// aucun compte rendu — donc la seule qui, sans trace, reste indiscernable d'une nuit calme.
// ⚠️ UNE RACINE PAR ESSAI, relevé en revue par mutation. Avec une racine commune, un essai
// dont la trace n'est PAS écrite lit celle de l'essai précédent : il rougit ou verdit selon
// l'ORDRE d'exécution, pas selon le code. Une garde qui dépend de son voisin ne garde rien.
const tracePassage = (racine) =>
  JSON.parse(readFileSync(join(bac, racine, 'orchestrateur-dernier-passage.json'), 'utf8'));

test('UNE RONDE QUI ABOUTIT LAISSE UNE TRACE DATÉE — sinon son silence ne se distingue de rien', () => {
  installerFauxHerdr({ agents: [] });
  lancerRonde(['/s/a.sock'], { LIGNE_DIRECTE_RACINE: join(bac, 'r-abouti') });
  const trace = tracePassage('r-abouti');

  assert.equal(trace.ronde.verdict, 'abouti');
  assert.ok(Number.isFinite(Date.parse(trace.ronde.fini_le)), 'la date doit être lisible — c’est tout ce qui sépare « il y a 12 min » de « il y a 6 h »');
  assert.equal(typeof trace.ronde.duree_ms, 'number', 'et ce qu’elle a coûté, sinon une ronde qui dérive ne se voit qu’une fois trop tard');
  assert.equal(trace.topo, undefined, 'un passage PAR rendez-vous — le topo ne doit jamais faire croire la ronde vivante');
});

test('UNE RONDE TUÉE PAR SON PLAFOND LAISSE LA TRACE DE SA MORT — la seule qui n’a produit aucun compte rendu', () => {
  fauxHerdrQuiNeRepondJamais();
  const r = spawnSync(process.execPath, [BIN, 'ronde'], {
    env: {
      ...process.env,
      HERDR_SESSIONS_ESSAIS: '/s/a.sock',
      HERDR_SOCKET_PATH: '',
      LIGNE_DIRECTE_RACINE: join(bac, 'r-plafond'),
      RENDEZ_VOUS_DELAI_MS: '5',
      RENDEZ_VOUS_ECHEANCE_MS: '2000',
      RENDEZ_VOUS_PLAFOND_MS: '2500',
    },
    timeout: 30000,
    killSignal: 'SIGKILL',
  });
  assert.equal(r.signal, null, 'elle doit être morte de son plafond, pas du harnais');
  const trace = tracePassage('r-plafond');

  assert.equal(trace.ronde.verdict, 'plafond-depasse', 'et sa mort est NOMMÉE — « rien dans le journal » se lisait comme « rien à signaler »');
  assert.equal(trace.ronde.plafond_ms, 2500, 'avec le plafond qu’elle a dépassé');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE PARTAGE DU BUDGET EST UN ARBITRAGE — il se garde, il ne se laisse pas dériver
//
// ⚠️ RELEVÉ EN REVUE DE FOND. Borner la ronde à UN budget oblige à le partager entre la
// livraison et la vigie, et ce partage COÛTE des reprises à la livraison : un orchestrateur
// dont la boîte de saisie se libère après la dernière reprise attend l'heure suivante, pour
// rien. Le premier jet donnait 2/3 à la livraison et lui en coûtait DEUX, sans que rien ne
// le dise ni ne le mesure. Une valeur qu'aucun essai ne tient est une valeur qui dérivera.
//
// ⚠️ ET IL NE COMPTE PAS LES REPRISES, il regarde QUAND LA DERNIÈRE A EU LIEU — le premier jet
// exigeait « au moins cinq reprises » et une seconde passe de revue l'a pris en défaut : le
// compte dépend du COÛT de chaque tour (lancement du faux herdr, écriture du journal), donc de
// la charge de la machine. Une garde qui rougit quand le poste est occupé mesure le poste, pas
// le code — et elle finit retirée pour ça, en emportant ce qu'elle gardait.
//
// L'instant de la dernière reprise, lui, a une borne EXACTE d'un côté : une reprise ne peut
// jamais avoir lieu à l'échéance de la livraison ou après — la boucle sort avant. À 2/3 d'un
// budget de 12 s, cette échéance est 8 s : aucune reprise à 8 s ou au-delà, quel que soit le
// coût des tours, quelle que soit la charge du poste. C'est une impossibilité, pas une
// tendance.
//
// De l'autre côté, à 5/6 l'échéance est 10 s, et les reprises se suivent d'un délai plus le
// coût d'un tour : il y en a forcément une qui démarre dans la fenêtre [8,4 s ; 10 s] tant que
// ce pas reste sous 1,6 s — très large pour trois lancements d'un script de deux lignes. D'où
// un délai court (200 ms), qui resserre le pas et élargit la marge des deux côtés.
function fauxHerdrQuiRefuseEtCompte(pane, lieu, journal) {
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
// L'INSTANT de chaque geste, pas seulement son compte — voir l'essai.
fs.appendFileSync(${JSON.stringify(journal)}, args.slice(0, 2).join(' ') + ' ' + Date.now() + '\\n');
if (args[0] === 'agent' && args[1] === 'list') {
  process.stdout.write(JSON.stringify({ result: { agents: [
    { pane_id: ${JSON.stringify(pane)}, name: 'orch-occupe', agent_status: 'working',
      foreground_cwd: ${JSON.stringify(lieu)}, revision: 3 },
  ] } }));
  process.exit(0);
}
if (args[0] === 'agent' && args[1] === 'get') {
  process.stdout.write(JSON.stringify({ result: { agent: {
    pane_id: ${JSON.stringify(pane)}, agent_status: 'working', revision: 3 } } }));
  process.exit(0);
}
// Une boîte de saisie qui ne se vide JAMAIS — la remise est refusée à chaque tour, comme
// les trois orchestrateurs mesurés sur le poste.
if (args[0] === 'agent' && args[1] === 'read') { process.stdout.write('un reste qui ne part pas'); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
process.exit(0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

test('LA LIVRAISON GARDE SA PART DU BUDGET — le partage ne la vide pas de ses reprises', () => {
  const lieu = lieuDOrchestrateur('part');
  const journal = join(bac, 'part.log');
  writeFileSync(journal, '');
  fauxHerdrQuiRefuseEtCompte('w9:pP', lieu, journal);
  const ECHEANCE = 12000;
  // ⚠️ AU MILIEU des deux échéances — 8 s pour 2/3 (infranchissable), 10 s pour 5/6. Le premier
  // jet le posait à 8 400 ms, collé à la borne fautive : une passe de revue a mesuré quinze fois
  // sous charge CPU réelle et vu la marge tomber à 112 ms. Une garde qui détecte encore, mais
  // dont le pouvoir de détection dépend de la charge du poste, finit par rendre un faux verdict
  // un soir de CI chargée. Recentré, elle garde ~1 s des DEUX côtés — mesuré, pas supposé.
  const SEUIL = 9000;
  const debut = Date.now();
  const r = lancerRonde(['/s/a.sock'], {
    RENDEZ_VOUS_DELAI_MS: '200',
    RENDEZ_VOUS_ECHEANCE_MS: String(ECHEANCE),
    // Assez long pour que la vigie n'ait la place de regarder personne : cet essai mesure la
    // LIVRAISON, et une vigie qui tournerait ajouterait ses propres lectures au journal.
    RENDEZ_VOUS_VIGIE_MS: '9000',
    RENDEZ_VOUS_PLAFOND_MS: '60000',
    LIGNE_DIRECTE_RACINE: join(bac, 'r-part'),
  });
  const dit = JSON.parse(r.stdout.trim().split('\n').pop());
  const reprises = readFileSync(journal, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('agent read '))
    .map((l) => Number(l.split(' ').pop()) - debut);
  const derniere = Math.max(...reprises);

  // ⚠️ LA MESURE EST PRISE AVANT LE LANCEMENT du processus, donc l'écart mesuré est un peu
  // PLUS GRAND que l'horloge interne de la ronde. Le biais joue contre l'essai du côté 2/3
  // (il rendrait un dépassement apparent), et le seuil garde de la marge pour ça.
  assert.ok(
    derniere >= SEUIL,
    `la livraison doit reprendre au-delà de ${SEUIL} ms — à 2/3 elle se serait arrêtée à 8000 ms et ` +
      `AUCUNE reprise n'y serait possible. Dernière reprise à ${derniere} ms (${reprises.length} au total)`
  );
  assert.ok(dit.duree_ms <= ECHEANCE, `et la ronde tient dans son budget — ${dit.duree_ms} ms`);
  assert.equal(tracePassage('r-part').ronde.verdict, 'partiel', 'une remise qui n’a pas abouti n’est pas un succès');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// UN APPEL QUI NE RÉPOND PAS EST UNE SESSION MUETTE, PAS UNE RONDE MORTE
//
// ⚠️ RELEVÉ EN REVUE DE FOND, ET MESURÉ PAR ELLE : un enfant lancé par `execFile` SURVIT au
// `process.exit()` de son parent. Le plafond tue la ronde ; il ne tue pas l'appel `herdr` en
// vol. Sans limite par appel, chaque ronde morte de son plafond laisse un `herdr` bloqué
// derrière elle — un par heure, sur la même cible, indéfiniment.
//
// Et avec la limite, le plafond redevient le DERNIER recours : un herdr qui ne répond pas
// n'est plus une panne de la ronde, c'est une session muette — un fait qu'elle sait nommer.
test('UN HERDR QUI NE RÉPOND PAS NE LAISSE NI ORPHELIN NI RONDE MORTE', () => {
  // ⚠️ SON PROPRE HERDR, À SON PROPRE CHEMIN, et c'est la garde de la garde. Le premier jet
  // comptait les survivants par `pgrep` sur le `herdr` COMMUN du bac — il ramassait donc
  // aussi les orphelins des DEUX essais de plafond, qui en laissent par construction (leur
  // plafond est plus court que la limite d'appel). L'essai rougissait sur les enfants de ses
  // voisins : il mesurait un objet et concluait sur un autre.
  const coin = join(bac, 'orphelin');
  mkdirSync(coin, { recursive: true });
  const herdrDuCoin = join(coin, 'herdr');
  writeFileSync(herdrDuCoin, '#!/usr/bin/env node\nsetTimeout(() => process.exit(0), 120000);\n');
  chmodSync(herdrDuCoin, 0o755);

  const debut = Date.now();
  const r = lancerRonde(['/s/a.sock'], {
    PATH: `${coin}:${process.env.PATH}`,
    HERDR_DELAI_APPEL_MS: '1000',
    RENDEZ_VOUS_ECHEANCE_MS: '20000',
    RENDEZ_VOUS_PLAFOND_MS: '25000',
    LIGNE_DIRECTE_RACINE: join(bac, 'r-orphelin'),
  });
  const ecoule = Date.now() - debut;

  assert.match(r.stderr, /muettes/i, 'un appel sans réponse est une session MUETTE — un fait, pas une mort');
  assert.equal(tracePassage('r-orphelin').ronde.verdict, 'sessions-muettes', 'et surtout PAS « plafond-depasse »');
  assert.ok(ecoule < 10000, `la ronde n’attend pas son plafond — ${ecoule} ms`);

  // ⚠️ LA MOITIÉ QUI COMPTE : l'appel a-t-il été TUÉ, ou tourne-t-il encore ?
  const restants = spawnSync('pgrep', ['-f', herdrDuCoin], { encoding: 'utf8' });
  const vivants = (restants.stdout || '').trim().split('\n').filter(Boolean);
  assert.equal(vivants.length, 0, `aucun herdr ne doit survivre à la ronde — ${vivants.length} orphelin(s)`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// UNE MORT IMPRÉVUE LAISSE UNE TRACE — c'était le point 3 du ticket, manqué dans le lot
//
// ⚠️ RELEVÉ EN REVUE DE FOND. `tenir()` n'avait aucune garde : une exception traversait
// jusqu'à `main().catch()`, qui écrit une ligne et sort — **sans jamais noter le passage**.
// La ronde disparaissait en laissant l'état du poste exactement comme si elle n'avait jamais
// été lancée : le silence que ce lot existe pour supprimer, dans le lot qui le supprime.
//
// ⚠️ ET LA ROUTE QUE LA REVUE NOMMAIT N'EST PAS ATTEIGNABLE — mesuré : `orchestrateursVivants`
// filtre les agents sans `pane_id`, et les lectures de `roleDuLieu` sont déjà attrapées. La
// garde couvre donc une CLASSE d'échecs imprévus, pas un défaut connu. C'est précisément
// pourquoi elle a besoin d'une panne provoquée : on ne fabrique pas une exception imprévue.
test('UNE MORT IMPRÉVUE LAISSE SA TRACE — sinon la ronde disparaît comme si elle n’avait pas eu lieu', () => {
  installerFauxHerdr({ agents: [] });
  const r = lancerRonde(['/s/a.sock'], {
    RENDEZ_VOUS_PANNE_PROVOQUEE: 'une panne que personne n’avait prévue',
    LIGNE_DIRECTE_RACINE: join(bac, 'r-erreur'),
  });

  assert.equal(r.code, 1, 'une ronde qui s’arrête sur une erreur est une PANNE');
  assert.match(r.stderr, /n'a donc RIEN établi/i, 'et elle dit qu’elle n’a rien établi — pas « rien à signaler »');
  assert.match(r.stderr, /une panne que personne/, 'avec la cause exacte, telle qu’elle est venue');
  const trace = tracePassage('r-erreur');
  assert.equal(trace.ronde.verdict, 'erreur');
  assert.match(trace.ronde.message, /une panne que personne/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA PANNE PROVOQUÉE N'EXISTE QUE SOUS CLOISON — et ça se prouve HORS cloison
//
// ⚠️ RELEVÉ EN REVUE PAR MUTATION : retirer `enEssais()` de la garde ne faisait rougir aucun
// essai, et la revue en donnait la raison — toute la suite tourne sous `node --test`, donc
// `NODE_TEST_CONTEXT` est vrai et hérité par le sous-processus. La cloison ne pouvait pas
// valoir faux depuis l'intérieur du harnais, et la revue concluait « pas réparable ici ».
//
// Elle l'est : il suffit de RETIRER la marque de l'environnement de l'enfant. La ronde naît
// alors exactement comme sous `launchd` — sans cloison —, et la porte d'essai doit être close.
// Sans cet essai, une variable d'environnement suffirait à faire échouer une vraie ronde.
test('HORS CLOISON D’ESSAIS, LA PANNE PROVOQUÉE EST IGNORÉE — la porte n’existe pas en vrai', () => {
  installerFauxHerdr({ agents: [] });
  const sansCloison = { ...process.env };
  delete sansCloison.NODE_TEST_CONTEXT;

  const r = spawnSync(process.execPath, [BIN, 'ronde'], {
    env: {
      ...sansCloison,
      HERDR_SESSIONS_ESSAIS: '/s/a.sock',
      HERDR_SOCKET_PATH: '',
      LIGNE_DIRECTE_RACINE: join(bac, 'r-hors-cloison'),
      RENDEZ_VOUS_PANNE_PROVOQUEE: 'cette panne ne doit JAMAIS être honorée ici',
      RENDEZ_VOUS_DELAI_MS: '5',
      RENDEZ_VOUS_ECHEANCE_MS: '2000',
    },
    timeout: 30000,
    encoding: 'utf8',
  });

  assert.equal(r.status, 0, `la ronde doit aboutir normalement — stderr: ${r.stderr}`);
  assert.doesNotMatch(r.stderr, /cette panne ne doit JAMAIS/, 'la porte d’essai est CLOSE hors cloison');
  assert.equal(tracePassage('r-hors-cloison').ronde.verdict, 'abouti');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE JOURNAL DE LA RONDE TRIE CE QU'IL RAPPORTE — T-20260821-0011
//
// Mesuré sur le vrai journal, 69 rondes : 231 non-livraisons rangées sous un total unique, dont
// 107 blocages réels et 98 faux négatifs que le dispositif fabriquait lui-même. Rien ne les
// distinguait à la lecture. Ces essais lancent la VRAIE ronde et lisent SA sortie — pas un
// double de la fonction de tri, qui pourrait être parfaite et n'être appelée par personne.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('LE JOURNAL DE LA RONDE PORTE LE COMPTE PAR FAMILLE — un total unique était le défaut', () => {
  installerFauxHerdr({
    agents: [{ name: 'orch-un', pane: 'w1:p1', agent_status: 'idle', cwd: '/tmp/x' }],
  });
  const r = lancerRonde(['essai']);
  const lignes = r.stdout.trim().split('\n').filter(Boolean);
  const ronde = JSON.parse(lignes[lignes.length - 1]);

  assert.ok(ronde.familles, 'la ronde doit rendre son compte par famille');
  // ⚠️ LES CINQ CLÉS, TOUJOURS. Un journal dont les clés apparaissent selon la ronde ne se
  // compare pas d'une ronde à l'autre : « aucun blocage » et « je n'ai pas compté les
  // blocages » s'y liraient pareil, et c'est le motif exact de tout ce lot.
  for (const f of ['pris', 'bloque', 'injoignable', 'sonde-muette', 'sans-preuve']) {
    assert.ok(f in ronde.familles, `la famille « ${f} » doit être comptée même à zéro`);
  }
  const somme = Object.values(ronde.familles).reduce((a, b) => a + b, 0);
  assert.equal(somme, ronde.orchestrateurs, 'chaque cible tombe dans exactement une famille');
});

test('CHAQUE COMPTE PORTE SA FAMILLE — sans quoi le tri vit hors du journal', () => {
  installerFauxHerdr({
    agents: [{ name: 'orch-un', pane: 'w1:p1', agent_status: 'idle', cwd: '/tmp/x' }],
  });
  const r = lancerRonde(['essai']);
  const lignes = r.stdout.trim().split('\n').filter(Boolean);
  const ronde = JSON.parse(lignes[lignes.length - 1]);
  for (const c of ronde.comptes) {
    assert.ok(typeof c.famille === 'string' && c.famille, `« ${c.agent} » sort du journal sans famille`);
  }
});

test('UNE RONDE SANS BLOCAGE NE CRIE PAS — la clé de tête reste absente', () => {
  // Une garde qui crie à tort se fait couper, et elle emporte ce qu'elle gardait. Le faux herdr
  // rend une boîte vide : il n'y a rien de coincé, donc rien ne doit remonter en tête.
  installerFauxHerdr({
    agents: [{ name: 'orch-un', pane: 'w1:p1', agent_status: 'idle', cwd: '/tmp/x' }],
  });
  const r = lancerRonde(['essai']);
  const lignes = r.stdout.trim().split('\n').filter(Boolean);
  const ronde = JSON.parse(lignes[lignes.length - 1]);
  assert.equal(ronde.familles.bloque, 0, 'aucun blocage réel dans ce scénario');
  assert.ok(!('bloques' in ronde), 'la clé de tête ne doit pas apparaître quand rien ne bloque');
});

test('LA RONDE NE DEMANDE PLUS À HERDR UNE ATTENTE QU’IL N’OBSERVE PAS — T-20260821-0009', () => {
  // ⚠️ MESURÉ SUR LA VRAIE RONDE, pas sur `commandesLivraison` en isolation. La fonction peut
  // être corrigée et le binaire continuer d'appeler une ancienne voie — c'est le motif dominant
  // de ce dépôt, et c'est très exactement ce qui s'est passé ici : la garde de T-20260815-0007
  // était juste et ne couvrait qu'un destinataire sur deux.
  const journal = join(bac, 'appels-herdr.log');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify(args) + '\\n');
if (args[0] === 'agent' && args[1] === 'list') {
  process.stdout.write(JSON.stringify({ result: { agents: [{ name: 'orch-un', pane: 'w1:p1', agent_status: 'idle', cwd: '/tmp/x' }] } }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ result: { ok: true } }));
process.exit(0);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  lancerRonde(['essai']);

  const appels = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.ok(appels.length > 0, 'la ronde doit avoir appelé herdr — sinon on ne mesure rien');
  for (const a of appels) {
    assert.ok(!a.includes('--until'), `la ronde demande encore une attente morte : ${a.join(' ')}`);
    assert.ok(!a.includes('--wait'), `la ronde demande encore --wait : ${a.join(' ')}`);
  }
});

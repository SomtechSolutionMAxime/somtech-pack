// lenregistrement-en-cours-nest-pas-une-absence.test.js
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260819-0036)
//
// MESURE FRAÎCHE DU 2026-09-20, sur ce poste, par sonde en lecture seule sur une naissance
// réelle (`herdr pane run <pane> "claude --model haiku"`, relevé à la seconde) :
//
//   t+0.0s   agent get -> agent_not_found   pane get -> ok:unknown   ← le registre ne sait rien
//   t+1.2s   agent get -> agent_not_found   pane get -> ok:unknown
//   t+2.3s   agent get -> ok:unknown        pane get -> ok:unknown   ← INSCRIT, mais pas fini
//   t+4.7s   agent get -> ok:unknown        pane get -> ok:unknown
//   t+5.8s   agent get -> ok:idle           pane get -> ok:idle      ← inscription terminée
//
// ⚠️ IL Y A DONC **TROIS** ÉTATS, ET LE CODE N'EN CONNAISSAIT QUE DEUX. Entre « le registre
// ignore ce pane » (replié depuis T-20260820-0022) et « le registre le connaît », il existe une
// fenêtre où le registre RÉPOND en disant `unknown`. Mesurée TROIS FOIS le 2026-09-20 sur DEUX
// chemins de naissance : 3,5 s · 3,3 s (`pane run "claude"`) et 3,7 s (`herdr agent start`).
//
// ⚠️ Le « ~30 s » de l'occurrence vécue de `w26:p46` a été RETIRÉ par son auteur : un `sleep 8`
// suivi d'un seul relevé, donc une estimation, pas une mesure. Elle ne compte pas.
//
// ⚠️ ET LA TROISIÈME MESURE TRANCHE CE QUE LES DEUX AUTRES LAISSAIENT OUVERT : née par
// `herdr agent start`, la session PORTE DÉJÀ SON NOM pendant toute la fenêtre. Le discriminant
// ne peut donc pas être l'absence de nom — c'est mesuré sur les deux chemins, plus argumenté.
//
// 🔴 CE QUE LE CODE FAISAIT DANS CETTE FENÊTRE. `trouverDestinataire` trouve l'agent au
// registre, donc `parLePane` vaut FAUX, donc `statutExplicable` vaut FAUX, donc `causeObstacle`
// rend `STATUT`, donc le refus dit — mot pour mot :
//
//   « Ce pane n'a JAMAIS été inscrit au registre : il n'y a donc aucun retour à "idle" à
//     espérer, et attendre ne changera rien. Désigne-le par son PANE plutôt que par un nom. »
//
// **Trois affirmations, trois faussetés, dans le même refus** :
//   ① « jamais inscrit » — il vient de l'être, on le lit dans `agent list` à l'instant ;
//   ② « attendre ne changera rien » — attendre 3,5 s changeait tout ;
//   ③ « désigne-le par son PANE » — c'est ce que l'appelant a fait, et c'est justement parce
//      que le registre a RÉPONDU que le repli par le pane n'a pas joué. **Le refus conseille la
//      voie qu'il vient de fermer lui-même.**
//
// C'est la famille du jalon : un refus catégorique, plausible, et faux — le symétrique du
// silence qui se lit comme un succès.
//
// ⚠️ LE BRUIT DE LA GARDE, MESURÉ AVANT DE LA POSER. Sur les **66 agents** que `herdr agent
// list` rendait pour ce poste le 2026-09-20 : `done: 30`, `idle: 30`, `working: 5`,
// `blocked: 1` — **ZÉRO `unknown`**. Le discriminant ne se déclenche donc sur aucun agent
// établi. ⚠️ Et ce n'est PAS « sans nom » : **31 des 66 n'ont pas de nom** — un agent jamais
// renommé en est dépourvu toute sa vie. `unknown` discrimine ; l'absence de nom, non.
// (Borne : un instant, un poste, et la population que le registre rend — pas les invisibles.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(RACINE, 'bin', 'livrer.js');
const SEP = '─'.repeat(20);
const ECRAN_VIDE = [SEP, '❯ ', SEP].join('\n');

// ⚠️ SANS CETTE LIGNE, DEUX ESSAIS ROUGISSAIENT POUR LA MAUVAISE RAISON. `sessionsDuPoste()`
// REFUSE d'énumérer les sessions du poste sous essais (cloison de `destinataire.js`) : le rouge
// venait de l'instrument, pas du défaut visé. Un rouge parle d'abord de son instrument. Une
// session fictive suffit — l'`appel` est injecté partout où il compte.
process.env.HERDR_SESSIONS_ESSAIS = '/tmp/enregistrement-essai.sock';

// ─────────────────────────────────────────── ① LA RECHERCHE SÉPARE LES TROIS ÉTATS

test('UN AGENT AU REGISTRE EN STATUT `unknown` EST RENDU COMME « EN COURS D’ENREGISTREMENT »', async () => {
  const { trouverDestinataire } = await import('../src/destinataire.js');

  const r = await trouverDestinataire('w26:p49', {
    appel: async (args) =>
      args[0] === 'agent' && args[1] === 'list'
        ? { ok: true, reponse: { result: { agents: [{ pane_id: 'w26:p49', agent_status: 'unknown' }] } } }
        : { ok: false },
  });

  assert.equal(r.ok, true, 'le registre RÉPOND : ce n’est pas une absence');
  assert.equal(r.parLePane, undefined, 'et ce n’est pas le repli par le pane non plus — le registre a répondu');
  assert.equal(
    r.enregistrementEnCours,
    true,
    'le troisième état doit REMONTER : sans lui, l’appelant ne peut ni attendre ni le dire'
  );
});

test('UN AGENT ÉTABLI N’EST PAS MARQUÉ « EN COURS » — sinon la marque ne veut plus rien dire', async () => {
  const { trouverDestinataire } = await import('../src/destinataire.js');

  // ⚠️ SANS NOM, ET POURTANT ÉTABLI. 31 des 66 agents du poste sont dans ce cas : un agent
  // jamais renommé n'a pas de nom de toute sa vie. Si la marque se déclenchait là-dessus,
  // elle vaudrait pour la moitié du poste et ne discriminerait plus rien.
  const r = await trouverDestinataire('w26:p48', {
    appel: async (args) =>
      args[0] === 'agent' && args[1] === 'list'
        ? { ok: true, reponse: { result: { agents: [{ pane_id: 'w26:p48', agent_status: 'idle' }] } } }
        : { ok: false },
  });

  assert.equal(r.ok, true);
  assert.notEqual(r.enregistrementEnCours, true, '`idle` sans nom est un agent ÉTABLI, pas un agent en cours');
});

test('CHERCHÉ PAR SON NOM PENDANT LA FENÊTRE, LE REFUS DIT QU’UNE INSCRIPTION EST EN COURS', async () => {
  const { trouverDestinataire } = await import('../src/destinataire.js');

  // Pendant la fenêtre, l'agent n'a pas encore de nom : aucun `a.name === vise` ne peut
  // correspondre. Le refus disait « aucun agent vivant ne porte le nom X » — le même mot que
  // pour un nom qui n'a jamais existé, qui envoie chercher une faute de frappe.
  const r = await trouverDestinataire('t-20260920-0036', {
    appel: async (args) =>
      args[0] === 'agent' && args[1] === 'list'
        ? {
            ok: true,
            reponse: {
              result: {
                agents: [
                  { pane_id: 'w26:p48', agent_status: 'idle', name: 'batiscan' },
                  { pane_id: 'w26:p49', agent_status: 'unknown' },
                ],
              },
            },
          }
        : { ok: false },
  });

  assert.equal(r.ok, false, 'on ne devine pas que c’est celui-là : on refuse');
  assert.match(
    r.message,
    /en cours d’(inscription|enregistrement)/i,
    'le refus doit NOMMER le troisième état, sinon il ne le distingue pas d’une absence'
  );
  assert.match(r.message, /w26:p49/, 'et nommer le ou les panes concernés — c’est ce qui permet d’aller voir');
  assert.doesNotMatch(
    r.message,
    /aucun agent vivant ne porte/i,
    'le verdict catégorique ne doit plus tomber quand une inscription est en cours'
  );
});

test('AUCUNE INSCRIPTION EN COURS : LE REFUS CATÉGORIQUE REVIENT — la garde ne parle pas dans le vide', async () => {
  const { trouverDestinataire } = await import('../src/destinataire.js');

  const r = await trouverDestinataire('personne', {
    appel: async (args) =>
      args[0] === 'agent' && args[1] === 'list'
        ? { ok: true, reponse: { result: { agents: [{ pane_id: 'w26:p48', agent_status: 'idle', name: 'batiscan' }] } } }
        : { ok: false },
  });

  assert.equal(r.ok, false);
  assert.match(r.message, /aucun agent vivant ne porte/i, 'sans fenêtre ouverte, le refus reste catégorique');
  assert.doesNotMatch(r.message, /en cours d’(inscription|enregistrement)/i, 'et il n’invente pas une attente');
});

// ─────────────────────────────────────────── ② LE REFUS NE MENT PLUS SUR CE QU’IL A VU

test('LE REFUS SUR `unknown` NE DIT PLUS « JAMAIS INSCRIT » QUAND L’INSCRIPTION EST EN COURS', async () => {
  const { obstacleAvantLivraison } = await import('../src/livraison.js');

  const m = obstacleAvantLivraison(ECRAN_VIDE, 'unknown', { pane: 'w26:p49', enregistrementEnCours: true });

  assert.ok(m, 'on refuse encore — livrer pendant l’inscription n’est pas prouvé sûr');
  assert.doesNotMatch(m, /jamais/i, '« jamais inscrit » est FAUX : on vient de le lire dans `agent list`');
  assert.doesNotMatch(m, /attendre ne changera rien/i, 'attendre est EXACTEMENT ce qui change la situation');
  assert.match(m, /en cours d’(inscription|enregistrement)/i, 'et il nomme l’état réel');
});

test('LE REFUS SUR `unknown` HORS FENÊTRE GARDE SON TEXTE — on n’a pas remplacé un faux par un autre', async () => {
  const { obstacleAvantLivraison } = await import('../src/livraison.js');

  // Un pane que le registre ignore VRAIMENT, atteint sans repli : là, « jamais inscrit » est
  // vrai, et c'est le bon conseil. La correction ne doit pas l'effacer.
  const m = obstacleAvantLivraison(ECRAN_VIDE, 'unknown', { pane: 'w26:p49' });

  assert.ok(m);
  assert.match(m, /jamais/i, 'hors fenêtre, « jamais inscrit » reste la vérité');
});

// ─────────────────────────────────────────── ③ LE CÂBLAGE — l’attente est BORNÉE et DITE

test('LE BINAIRE ATTEND LA FIN DE L’INSCRIPTION, PUIS LIVRE — et il DIT qu’il attend', () => {
  // ⚠️ CE QUE CET ESSAI GARDE, ET QU'AUCUN ESSAI DE MODULE NE GARDE : que `bin/livrer.js`
  // CONSULTE le drapeau. Le lot précédent a payé exactement cette survivante — `parLePane`
  // savait basculer, la recherche savait trouver, et personne ne vérifiait que les deux se
  // parlaient (`livrer-malgre-le-registre.test.js`, survivante M7).
  const bac = mkdtempSync(join(tmpdir(), 'livrer-enregistrement-'));
  const socket = join(bac, 'seule.sock');
  const journal = join(bac, 'appels.jsonl');
  const compteur = join(bac, 'tours');
  writeFileSync(journal, '');
  writeFileSync(compteur, '0');

  // Le double reproduit LA MESURE : les deux premiers `agent list` rendent `unknown`, le
  // troisième rend `idle`. C'est la fenêtre, et rien d'autre ne change.
  writeFileSync(
    join(bac, 'herdr'),
    `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
if (cmd === 'agent list') {
  const n = Number(fs.readFileSync(${JSON.stringify(compteur)}, 'utf8')) + 1;
  fs.writeFileSync(${JSON.stringify(compteur)}, String(n));
  const statut = n <= 2 ? 'unknown' : 'idle';
  process.stdout.write(JSON.stringify({ result: { agents: [{ pane_id: 'w26:p49', agent_status: statut }] } }));
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { pane_id: args[2], agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent read') { process.stdout.write([SEP, '\\u276f ', SEP, '  auto mode on'].join('\\n')); process.exit(0); }
if (cmd === 'agent prompt' || cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ error: { code: 'unsupported', message: cmd } }));
process.exit(1);
`
  );
  chmodSync(join(bac, 'herdr'), 0o755);

  // ⚠️ `spawnSync`, ET PAS `execFileSync` — LE BANC A D'ABORD ROUGI SUR SA PROPRE CÉCITÉ.
  // `execFileSync` ne rend QUE stdout quand la commande réussit ; l'annonce d'attente part sur
  // STDERR. Le premier jet de cet essai concluait « il ne le dit pas » sur une sortie qu'il
  // n'avait jamais lue. Un rouge parle d'abord de son instrument.
  const r = spawnSync(process.execPath, [BIN, 'w26:p49', '--texte', 'mon compte rendu'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bac}:${process.env.PATH}`,
      HERDR_SESSIONS_ESSAIS: socket,
      HERDR_SOCKET_PATH: socket,
      LIVRAISON_ESSAIS: '2',
      LIVRAISON_DELAI_MS: '5',
      LIVRAISON_ATTENTE_MS: '50',
      LIVRAISON_IMMOBILITE_MS: '5',
      ENREGISTREMENT_BORNE_MS: '3000',
      ENREGISTREMENT_PAS_MS: '10',
    },
  });
  const code = r.status ?? 1;
  const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;

  const appels = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const listes = appels.filter((a) => a[0] === 'agent' && a[1] === 'list');
  const ecritures = appels.filter((a) => a[0] === 'agent' && a[1] === 'prompt');

  assert.ok(
    listes.length >= 3,
    `le binaire doit REDEMANDER tant que l’inscription n’est pas finie — ${listes.length} appel(s) \`agent list\` : ${sortie}`
  );
  assert.match(sortie, /en cours d’(inscription|enregistrement)/i, 'et il doit le DIRE — une attente muette est une panne');
  assert.match(sortie, /\b(borne|bornée)\b/i, 'en nommant sa borne : une attente non bornée est une pendaison');
  assert.equal(ecritures.length, 1, `puis livrer une fois l’inscription finie — sortie : ${sortie}`);
  assert.equal(code, 0, `et aboutir : ${sortie}`);

  rmSync(bac, { recursive: true, force: true });
});

test('LA BORNE MORD — une inscription qui ne finit jamais fait refuser, en disant la borne', () => {
  const bac = mkdtempSync(join(tmpdir(), 'livrer-borne-'));
  const socket = join(bac, 'seule.sock');
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');

  // ⚠️ SANS CET ESSAI, L'ATTENTE SERAIT UNE PENDAISON. Le dispositif a déjà payé une ronde qui
  // pend : « une ronde qui pend n'en rate pas une, elle les ANNULE TOUTES ». Une attente sans
  // borne dans `livrer.js` ferait exactement ça à son appelant.
  writeFileSync(
    join(bac, 'herdr'),
    `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
if (cmd === 'agent list') { process.stdout.write(JSON.stringify({ result: { agents: [{ pane_id: 'w26:p49', agent_status: 'unknown' }] } })); process.exit(0); }
process.stdout.write(JSON.stringify({ error: { code: 'unsupported', message: cmd } }));
process.exit(1);
`
  );
  chmodSync(join(bac, 'herdr'), 0o755);

  const debut = Date.now();
  const r = spawnSync(process.execPath, [BIN, 'w26:p49', '--texte', 'mon compte rendu'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bac}:${process.env.PATH}`,
      HERDR_SESSIONS_ESSAIS: socket,
      HERDR_SOCKET_PATH: socket,
      LIVRAISON_ESSAIS: '2',
      LIVRAISON_DELAI_MS: '5',
      LIVRAISON_ATTENTE_MS: '50',
      LIVRAISON_IMMOBILITE_MS: '5',
      ENREGISTREMENT_BORNE_MS: '300',
      ENREGISTREMENT_PAS_MS: '10',
    },
  });
  const code = r.status ?? 1;
  const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const dureeMs = Date.now() - debut;

  assert.notEqual(code, 0, `une inscription qui ne finit pas doit faire ÉCHOUER, pas livrer à l’aveugle : ${sortie}`);
  // ⚠️ CETTE ASSERTION A ÉTÉ RESSERRÉE APRÈS DEUX SURVIVANTES. Elle cherchait `/300/` dans
  // TOUTE la sortie — or l'annonce d'attente porte déjà ce chiffre. « la borne ne mord plus, on
  // livre à l'aveugle » et « le refus de borne ne chiffre plus » passaient donc toutes les deux :
  // le chiffre venait de la boucle, pas du refus. On exige désormais le refus LUI-MÊME, par une
  // marque qui n'appartient qu'à lui, ET son chiffre DANS LA MÊME LIGNE.
  const ligneDeBorne = sortie.split('\n').find((l) => l.includes('BORNE ATTEINTE'));
  assert.ok(ligneDeBorne, `le refus de borne doit exister et se distinguer de l’annonce d’attente : ${sortie}`);
  assert.match(ligneDeBorne, /300/, 'et CHIFFRER la borne qu’il a atteinte, dans sa propre phrase');
  assert.doesNotMatch(sortie, /jamais été inscrit/i, 'et surtout pas retomber sur le texte faux que ce lot ferme');
  assert.ok(dureeMs < 15000, `et rendre la main : ${dureeMs} ms écoulées, la borne était 300 ms`);
  // Aucune écriture : on n'a pas livré dans le doute.
  const appels = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  assert.equal(appels.filter((a) => a[1] === 'prompt' || a[1] === 'send-text').length, 0, 'et rien n’a été écrit');

  rmSync(bac, { recursive: true, force: true });
});

// ───────── ④ LE DRAPEAU TRAVERSE `livrerBrief`, ET LE SECOND APPELANT L'A AUSSI

test('`livrerBrief` TRANSMET LE DRAPEAU JUSQU’AU MESSAGE — sinon la correction est du code mort', async () => {
  const { livrerBrief } = await import('../src/livraison.js');

  // ⚠️ CET ESSAI EXISTE PARCE QUE LA CORRECTION ÉTAIT INATTEIGNABLE. Le bon texte vivait dans
  // `obstacleAvantLivraison`, et RIEN en production ne lui passait l'option : seule une garde
  // qui la posait à la main y touchait. Septième des huit règles — une garde juste, sur un
  // chemin que le nouvel appelant ne traverse pas.
  const r = await livrerBrief({
    pane: 'w26:p49',
    texte: 'mon compte rendu',
    enregistrementEnCours: true,
    socket: null,
    dormir: async () => {},
    essais: 1,
    delaiMs: 0,
    immobiliteMs: 0,
    appelHerdr: async () => ({ ok: true, reponse: { result: { agent: { agent_status: 'unknown' } } } }),
    lireEcran: async () => ECRAN_VIDE,
  });

  assert.equal(r.ok, false, 'on refuse encore — livrer pendant l’inscription n’est pas prouvé sûr');
  assert.match(r.message, /EN COURS D’INSCRIPTION/i, 'et le message qui sort est celui du troisième état');
  assert.doesNotMatch(r.message, /jamais/i, 'pas le faux, qui affirme ce que le registre contredit');
});

test('LA RONDE PORTE LE MÊME DRAPEAU — un fait corrigé à un seul endroit reste faux à l’autre', async () => {
  const { orchestrateursVivants } = await import('../src/rendez-vous.js');

  // ⚠️ `livrerBrief` A DEUX APPELANTS DE PRODUCTION, pas un : `bin/livrer.js` et la ronde de
  // `bin/rendez-vous.js`. Corriger le premier seulement laissait la ronde servir le texte faux
  // à tout orchestrateur qui vient de naître — « un fait redit ailleurs, corrigé à un seul
  // endroit », que la seconde passe de revue cherche nommément.
  const vus = orchestrateursVivants(
    { result: { agents: [
      { pane_id: 'w26:p1', agent_status: 'unknown', foreground_cwd: '/lieu/orch' },
      { pane_id: 'w26:p2', agent_status: 'idle', foreground_cwd: '/lieu/orch' },
    ] } },
    { estUnLieu: () => 'orchestrateur' }
  );

  assert.equal(vus.length, 2);
  assert.equal(vus[0].enregistrementEnCours, true, 'celui qui s’inscrit encore est reconnu comme tel');
  assert.equal(vus[1].enregistrementEnCours, false, 'et l’établi ne l’est pas');
});

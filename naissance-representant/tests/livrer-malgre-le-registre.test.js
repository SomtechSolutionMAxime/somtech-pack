// livrer-malgre-le-registre.test.js — LIVRER À UN AGENT QUE LE REGISTRE NE CONNAÎT PAS.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260820-0022)
//
// `livrer.js` refusait — « aucun agent vivant ne porte "w2D:pT" sur ce poste » — sur des
// agents qui travaillaient et recevaient parfaitement. Mesuré le 2026-08-20 : toute session
// née depuis le 18 août est absente de `agent list`.
//
// ⚠️ ET LE REPLI CHANGE DE VERBES, PAS SEULEMENT DE SOURCE. Mesuré sur le poste, sur un pane
// réellement invisible :
//     herdr agent read w2D:p11  ->  {"error":{"code":"agent_not_found",...}}
//     herdr pane  read w2D:p11  ->  l'écran
// Toute la famille `agent …` est fermée à ces sessions ; la famille `pane …` leur répond.
// Un repli qui se contenterait de trouver le pane et rappellerait ensuite `agent prompt`
// échouerait au dernier mètre — c'est-à-dire après avoir annoncé qu'il avait trouvé.
//
// ⚠️ CE QUI NE DOIT PAS BOUGER — la meilleure garantie de cet outil : le REFUS D'ÉCRIRE DANS
// UNE BOÎTE NON VIDE. Plusieurs orchestrateurs s'en servent. Le repli lit l'écran AVANT
// d'écrire, exactement comme le chemin nominal, et refuse pareil.

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('LES COMMANDES DE LIVRAISON PASSENT PAR `pane` QUAND ON LIVRE PAR LE PANE', async () => {
  const { commandesLivraison } = await import('../src/livraison.js');

  const c = commandesLivraison('w2D:p11', 'coucou', { parLePane: true });

  // La lecture d'écran garde `--format ansi` : le gris est la seule chose qui distingue une
  // suggestion d'un texte réel, et la garde de boîte en dépend des deux côtés du repli.
  assert.deepEqual(c.lireEcran, ['pane', 'read', 'w2D:p11', '--format', 'ansi']);
  assert.deepEqual(c.interroger, ['pane', 'get', 'w2D:p11']);
  assert.deepEqual(c.livrer, ['pane', 'send-text', 'w2D:p11', 'coucou']);
  assert.deepEqual(c.soumettre, ['pane', 'send-keys', 'w2D:p11', 'Enter']);

  // ⚠️ AUCUNE COMMANDE NE DOIT RESTER DE LA FAMILLE `agent` : c'est elle qui est fermée à ces
  // sessions. Une seule oubliée, et le repli échoue au dernier mètre en ayant l'air d'aboutir.
  for (const [nom, args] of Object.entries(c)) {
    assert.notEqual(args[0], 'agent', `\`${nom}\` reste sur la famille \`agent\`, fermée aux sessions invisibles`);
  }
});

test('LE CHEMIN NOMINAL NE BOUGE PAS — on ajoute une voie, on n’en remplace aucune', async () => {
  const { commandesLivraison } = await import('../src/livraison.js');

  // Sans le repli, TOUT reste tel quel : les sessions que le registre connaît continuent de
  // passer par `agent`, dont `--wait --until working` que la famille `pane` ne sait pas faire.
  const c = commandesLivraison('w1:p1', 'coucou', { attenteMs: 20000 });

  assert.deepEqual(c.lireEcran, ['agent', 'read', 'w1:p1', '--format', 'ansi']);
  assert.deepEqual(c.interroger, ['agent', 'get', 'w1:p1']);
  assert.deepEqual(c.livrer, ['agent', 'prompt', 'w1:p1', 'coucou', '--wait', '--until', 'working', '--timeout', '20000']);
  assert.deepEqual(c.soumettre, ['agent', 'send-keys', 'w1:p1', 'Enter']);
});

// ───────────────────────────────────────────── le repli de la RECHERCHE, en amont des verbes

import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bac = mkdtempSync(join(tmpdir(), 'livrer-malgre-registre-'));
const SOCKET_A = join(bac, 'a.sock');
const SOCKET_B = join(bac, 'b.sock');

/**
 * Un faux herdr qui reproduit LE POSTE MESURÉ : le registre ne connaît personne, mais les
 * panes répondent — et chaque session ne voit QUE les siens.
 *
 * @param {Record<string,string[]>} panesParSession  socket -> panes qu'elle porte
 */
function fauxHerdrDesPanes(panesParSession) {
  const script = `#!/usr/bin/env node
const carte = ${JSON.stringify(panesParSession)};
const args = process.argv.slice(2);
const socket = process.env.HERDR_SOCKET_PATH || '';
const cmd = args.slice(0, 2).join(' ');
// LE REGISTRE EST MUET — l'état exact du poste depuis le 18 août.
if (cmd === 'agent list') { process.stdout.write(JSON.stringify({ result: { agents: [] } })); process.exit(0); }
const ici = carte[socket] || [];
if (cmd === 'pane get') {
  if (!ici.includes(args[2])) { process.stdout.write(JSON.stringify({ error: { code: 'pane_not_found', message: 'pane_not_found' } })); process.exit(1); }
  process.stdout.write(JSON.stringify({ result: { pane: { pane_id: args[2] } } }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ error: { code: 'agent_not_found', message: 'agent_not_found' } }));
process.exit(1);
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
  process.env.PATH = `${bac}:${process.env.PATH}`;
  process.env.HERDR_SESSIONS_ESSAIS = [SOCKET_A, SOCKET_B].join(':');
}

test('UN PANE QUE LE REGISTRE IGNORE EST TROUVÉ, ET LA LIVRAISON SAIT QU’ELLE PASSE PAR LE PANE', async () => {
  const { trouverDestinataire } = await import('../src/destinataire.js');
  fauxHerdrDesPanes({ [SOCKET_A]: ['w2D:p11'], [SOCKET_B]: ['w9:p1'] });

  const r = await trouverDestinataire('w2D:p11');

  assert.equal(r.ok, true, `le pane répond dans une session : abandonner ici, c'est refuser de parler à quelqu'un qui écoute — ${r.message}`);
  assert.equal(r.pane, 'w2D:p11');
  assert.equal(r.socket, SOCKET_A, 'et dans LA session qui le porte, pas une autre');
  assert.equal(r.parLePane, true, 'la livraison doit savoir basculer ses verbes, sinon elle échoue au dernier mètre');
});

test('L’HOMONYMIE DE PANE RESTE UN REFUS DANS LE REPLI AUSSI — on ne tire pas au sort', async () => {
  const { trouverDestinataire } = await import('../src/destinataire.js');
  // `w5:p3` existe dans LES DEUX sessions : un identifiant de pane est interne à sa session.
  // Livrer à l'une pour l'autre remettrait un compte rendu au mauvais chantier, en silence,
  // et l'expéditeur aurait son accusé de réception. C'est la garde que le chemin nominal tient
  // déjà ; le repli ne doit pas être la porte par laquelle elle se contourne.
  fauxHerdrDesPanes({ [SOCKET_A]: ['w5:p3'], [SOCKET_B]: ['w5:p3'] });

  const r = await trouverDestinataire('w5:p3');

  assert.equal(r.ok, false, 'deux sessions portent ce pane : on ne choisit pas à sa place');
  assert.match(r.message, /deux sessions|interne à sa session/i, 'et le refus dit pourquoi');
});

test('UN NOM INCONNU RESTE UN REFUS — le repli ne s’applique qu’à ce qui a la FORME d’un pane', async () => {
  const { trouverDestinataire } = await import('../src/destinataire.js');
  fauxHerdrDesPanes({ [SOCKET_A]: ['w2D:p11'] });

  // `ristigouche` n'est pas un pane : le chercher comme tel enverrait son compte rendu dans le
  // vide. La forme est ce qui sépare les deux, et elle ne s'élargit pas.
  const r = await trouverDestinataire('ristigouche');

  assert.equal(r.ok, false, 'un nom que personne ne porte reste un refus');
});


// ───────────────────────── LA GARDE QUI NE DOIT PAS TOMBER, éprouvée SUR LE CHEMIN DE REPLI

test('LE REFUS D’ÉCRIRE DANS UNE BOÎTE NON VIDE TIENT AUSSI QUAND ON LIVRE PAR LE PANE', async () => {
  const { livrerBrief } = await import('../src/livraison.js');

  // C'est la meilleure garantie de cet outil et plusieurs orchestrateurs s'en servent : écrire
  // par-dessus un texte qui attend livrerait UN message fait des deux textes collés. Le repli
  // ajoute une voie ; il ne doit pas être la porte par laquelle cette garde se contourne.
  const vus = [];
  const r = await livrerBrief({
    pane: 'w2D:p11',
    texte: 'mon compte rendu',
    parLePane: true,
    socket: null,
    dormir: async () => {},
    essais: 1,
    delaiMs: 0,
    immobiliteMs: 0,
    appelHerdr: async (args) => {
      vus.push(args);
      return { ok: true, reponse: { result: { pane: { pane_id: 'w2D:p11' }, agent_status: 'idle' } } };
    },
    // La boîte porte DÉJÀ le texte de quelqu'un d'autre.
    lireEcran: async (commande) => {
      vus.push(commande);
      const filet = '─'.repeat(20);
      return [filet, '❯ un texte que quelqu’un attend de soumettre', filet].join('\n');
    },
  });

  assert.equal(r.ok, false, 'une boîte qui porte le texte d’autrui fait refuser — par le pane comme ailleurs');

  // ⚠️ ET LA LECTURE A BIEN EU LIEU PAR LA VOIE DU REPLI. Sans cette moitié, l'essai passerait
  // aussi pour un refus obtenu par accident — par exemple si le repli n'avait jamais lu l'écran.
  const lectures = vus.filter((a) => a[0] === 'pane' && a[1] === 'read');
  assert.ok(lectures.length >= 1, 'la garde se prend sur une lecture d’écran, et elle doit passer par `pane read`');
  assert.ok(
    lectures.every((a) => a.includes('--format') && a.includes('ansi')),
    'en ANSI : sans le gris, une suggestion se lirait comme un texte réel et la garde refuserait à tort'
  );
  // Aucun verbe de la famille fermée n'a été tenté.
  assert.equal(vus.filter((a) => a[0] === 'agent').length, 0, 'aucun appel `agent …` : ils sont fermés à ces sessions');
});

// ─────────── LA PORTE DU BINAIRE — trouver ne suffit pas, il faut ARRIVER (survivante M7)

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const BIN = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'bin', 'livrer.js');

test('LE BINAIRE LIVRE VRAIMENT À UN PANE INVISIBLE — le drapeau traverse jusqu’aux verbes', () => {
  // ⚠️ CET ESSAI EXISTE PARCE QU'UNE MUTATION A SURVÉCU. Remplacer, dans `bin/livrer.js`,
  // `parLePane: Boolean(ou.parLePane)` par `parLePane: false` ne faisait rougir AUCUN des
  // essais du lot : le module savait basculer ses verbes, la recherche savait trouver le pane,
  // et personne ne vérifiait que les deux se parlaient. C'est exactement le mode de panne que
  // ce lot ferme, un étage plus haut — TROUVER PUIS ÉCHOUER AU DERNIER MÈTRE, après avoir
  // annoncé qu'on avait trouvé.
  const bacBin = mkdtempSync(join(tmpdir(), 'livrer-bin-pane-'));
  const socket = join(bacBin, 'seule.sock');
  const journal = join(bacBin, 'appels.jsonl');
  writeFileSync(journal, '');

  // Le poste mesuré : le registre ne connaît personne, la famille `agent …` REFUSE TOUT,
  // et seule la famille `pane …` répond. C'est ce qui rend l'essai concluant — un double qui
  // accepterait `agent read` laisserait passer la mutation, comme les autres essais du lot.
  writeFileSync(
    join(bacBin, 'herdr'),
    `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
if (cmd === 'agent list') { process.stdout.write(JSON.stringify({ result: { agents: [] } })); process.exit(0); }
if (cmd === 'pane get') { process.stdout.write(JSON.stringify({ result: { pane: { pane_id: args[2], agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'pane read') { process.stdout.write([SEP, '\\u276f ', SEP, '  auto mode on'].join('\\n')); process.exit(0); }
if (cmd === 'pane send-text' || cmd === 'pane send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
// TOUTE la famille \`agent …\` est fermée à ces sessions — mesuré sur le poste le 2026-08-20.
process.stdout.write(JSON.stringify({ error: { code: 'agent_not_found', message: 'agent target not found' } }));
process.exit(1);
`
  );
  chmodSync(join(bacBin, 'herdr'), 0o755);

  let code = 0;
  let sortie = '';
  try {
    sortie = execFileSync(process.execPath, [BIN, 'w2D:p11', '--texte', 'mon compte rendu'], {
      stdio: 'pipe',
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bacBin}:${process.env.PATH}`,
        HERDR_SESSIONS_ESSAIS: socket,
        HERDR_SOCKET_PATH: socket,
        LIVRAISON_ESSAIS: '2',
        LIVRAISON_DELAI_MS: '5',
        LIVRAISON_ATTENTE_MS: '50',
        LIVRAISON_IMMOBILITE_MS: '5',
      },
    });
  } catch (err) {
    code = err.status ?? 1;
    sortie = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }

  const appels = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const ecritures = appels.filter((a) => a[0] === 'pane' && a[1] === 'send-text');
  const tentativesAgent = appels.filter((a) => a[0] === 'agent' && a[1] !== 'list');

  assert.equal(
    tentativesAgent.length,
    0,
    `aucun verbe \`agent …\` ne doit être tenté sur un pane invisible — tentés : ${JSON.stringify(tentativesAgent)}`
  );
  assert.equal(ecritures.length, 1, `le texte doit être réellement écrit par \`pane send-text\` — sortie : ${sortie}`);
  assert.equal(ecritures[0][3], 'mon compte rendu', 'et c’est bien le texte demandé qui part');
  assert.equal(code, 0, `la livraison doit aboutir : ${sortie}`);

  rmSync(bacBin, { recursive: true, force: true });
});

// ─────────────── LE TROISIÈME TROU : `unknown` EST LA SIGNATURE DU CAS QU'ON REPLIE

const ECRAN_VIDE = ['─'.repeat(20), '❯ ', '─'.repeat(20)].join('\n');

test('ARRIVÉ PAR LE PANE, UN STATUT `unknown` NE FAIT PLUS REFUSER — c’est la signature du cas', async () => {
  const { causeObstacle } = await import('../src/livraison.js');

  // ⚠️ MESURÉ SUR LES 98 PANES DU POSTE (2026-08-20) : les 83 vus du registre sont TOUS `idle`,
  // les 15 invisibles TOUS `unknown` — séparation parfaite, zéro contre-exemple. Refuser
  // `unknown` rendait donc le repli INOPÉRANT SUR EXACTEMENT LA POPULATION QU'IL VISE : un
  // agent qu'on rejoint par son pane parce que le registre l'ignore porte, par construction,
  // le statut que le refus écartait.
  assert.equal(
    causeObstacle(ECRAN_VIDE, 'unknown', { parLePane: true }),
    null,
    'arrivé par le pane, `unknown` dit « le registre ne me voit pas », pas « j’ai quitté l’attente »'
  );
});

test('ET LA GARDE DE LA BOÎTE TIENT QUAND MÊME — la conjonction ne lève que le statut', async () => {
  const { causeObstacle, CAUSES } = await import('../src/livraison.js');

  // C'est LA garde à ne pas perdre : ce n'est pas le statut qui protège le texte d'autrui,
  // c'est la boîte. On lève une condition, on ne les lève pas toutes.
  const occupee = ['─'.repeat(20), '❯ un texte que quelqu’un attend de soumettre', '─'.repeat(20)].join('\n');
  assert.equal(
    causeObstacle(occupee, 'unknown', { parLePane: true }),
    CAUSES.ENCOMBREE,
    'une boîte pleine fait toujours refuser, même arrivé par le pane et même en `unknown`'
  );

  // Et le dialogue reste un refus lui aussi — écrire devant un choix CONFIRME l'option.
  //
  // ⚠️ LA MARQUE EST CELLE QUE LE CODE CHERCHE VRAIMENT. Un premier jet posait « 1. Oui /
  // 2. Non » : `ecranAttendUnChoix` ne l'y voyait pas, l'essai rougissait, et il aurait pu se
  // conclure « le dialogue n'est plus gardé » — un faux verdict tiré d'un double approximatif.
  const dialogue = ['─'.repeat(20), '❯ ', '─'.repeat(20), 'Do you want to proceed? (y/n)'].join('\n');
  assert.notEqual(causeObstacle(dialogue, 'unknown', { parLePane: true }), null, 'un dialogue reste un refus');
});

test('ARRIVÉ PAR LE NOM, `unknown` RESTE UN REFUS — la levée est bornée au chemin qui la justifie', async () => {
  const { causeObstacle, CAUSES } = await import('../src/livraison.js');

  // Par le NOM, le registre a répondu : il connaît cet agent. Un `unknown` y veut peut-être dire
  // autre chose, et on n'a aucune mesure qui dise quoi. On ne généralise pas une levée obtenue
  // sur un cas dont on connaît la cause à un cas dont on ne la connaît pas.
  assert.equal(
    causeObstacle(ECRAN_VIDE, 'unknown'),
    CAUSES.STATUT,
    'sans le repli, `unknown` reste un état qu’on ne sait pas expliquer'
  );
});

test('LE REFUS SUR STATUT NE DIT PLUS « elle a quitté l’attente » À UN PANE QUE LE REGISTRE N’A JAMAIS VU', async () => {
  const { obstacleAvantLivraison } = await import('../src/livraison.js');

  // ⚠️ LE MESSAGE ÉTAIT FAUX, ET C'EST PIRE QU'UN REFUS MUET : « elle a déjà quitté l'attente
  // sans nous » décrit une session qui a été vue puis est partie. Un pane invisible au registre
  // n'a JAMAIS été vu. Le refus décrivait un état qui n'était pas le sien, et envoyait attendre
  // un retour à `idle` qui ne viendra pas.
  const m = obstacleAvantLivraison(ECRAN_VIDE, 'unknown', { pane: 'w2D:p11' });

  assert.doesNotMatch(m, /quitté l’attente/, 'ce pane n’a jamais été dans l’attente : il n’en est pas sorti');
  assert.match(m, /registre/i, 'le refus doit nommer la vraie cause — le registre ne le voit pas');
});

test('UN REFUS NE PROPOSE PAS LA VOIE QU’IL VIENT DE REFUSER (relevé par `ristigouche`)', async () => {
  const { trouverDestinataire } = await import('../src/destinataire.js');
  // On désigne PAR LE PANE, et ce pane n'existe nulle part — ni au registre, ni dans les panes.
  fauxHerdrDesPanes({ [SOCKET_A]: ['w1:p1'], [SOCKET_B]: [] });

  const r = await trouverDestinataire('w7:p9');

  assert.equal(r.ok, false, 'ce pane n’existe nulle part : le refus est juste');
  // ⚠️ MAIS SON CONSEIL ÉTAIT ABSURDE : « désigne-le par son pane » à quelqu'un qui VIENT de le
  // faire par son pane. Un refus qui propose la voie qu'il vient d'écarter se fait rejouer à
  // l'identique, et son lecteur conclut que l'outil est cassé. Un refus dit ce qu'il a ESSAYÉ.
  assert.doesNotMatch(
    r.message,
    /désigne-le par son pane/i,
    'on ne renvoie pas vers le geste qui vient d’échouer'
  );
  assert.match(r.message, /registre|pane/i, 'et il dit ce qui a été cherché, et où');
});

// ⚠️ CE BLOC RESTE LE DERNIER DU FICHIER. Placé plus haut, il retirait le bac SOUS les essais
// déclarés après lui — qui échouaient alors sur un `ENOENT` sans rapport avec ce qu'ils
// éprouvent. Un essai qui meurt de son harnais se lit comme un défaut du code.
test('APRÈS TOUT — le bac d’essai est retiré', () => {
  rmSync(bac, { recursive: true, force: true });
  assert.ok(true);
});

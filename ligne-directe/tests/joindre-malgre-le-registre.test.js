// joindre-malgre-le-registre.test.js — UN AGENT QUE LE REGISTRE IGNORE N'EST PAS UN AGENT MORT.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260820-0022)
//
// Mesuré le 2026-08-20 : **toute session née depuis le 18 août est absente du registre
// `herdr`** — `agent list` ne la rend pas, alors que `pane read` / `pane run` /
// `pane send-keys` fonctionnent parfaitement sur elle. Les 83 sessions visibles s'étalent
// du 19 juillet au 19 août ; les 11 invisibles datées sont TOUTES postérieures au 18 août
// 14 h 52.
//
// Conséquence, et c'est la plus grave : `vivant()` n'interrogeait QUE le registre. Le
// veilleur en concluait « l'agent a disparu », **refermait la ligne** et l'annonçait au
// dirigeant — pour un agent qui travaillait et écrivait au même moment. Un avis se
// rattrape ; une fermeture, non.
//
// ⚠️ CE QUE CE FICHIER NE DOIT PAS FAIRE PASSER — et c'est la moitié qui compte :
// un pane SANS agent (un shell ordinaire) n'est toujours PAS un destinataire. Élargir le
// repli jusqu'à « tout pane est vivant » remplacerait un faux négatif par un faux positif,
// et ferait écrire des messages dans des terminaux où personne n'écoute. Le discriminant
// est `agent_session`, pas l'existence du pane.
//
// ⚠️ LE DOUBLE DE CE FICHIER DISTINGUE `agent list` DE `pane list`, et il le doit.
// Le double partagé de `herdr.test.js` répond la même chose à toutes les commandes : sous
// lui, un repli par pane serait indistinguable d'une absence de repli, et ces essais
// passeraient sans rien éprouver. Un double plus cohérent que le service ne prouve rien.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let bac;
let pathOriginal;
let socketMemoire;

/**
 * Un faux herdr qui RÉPOND PAR COMMANDE — registre d'un côté, panes de l'autre.
 *
 * @param {object} o
 * @param {string} o.agents  JSON rendu par `agent list`
 * @param {string} o.panes   JSON rendu par `pane list`
 * @param {string} o.boite   ce que porte la boîte de saisie de l'écran rendu par `read`
 */
function fauxHerdrParCommande({ agents = '{"id":"cli:agent:list","result":{"agents":[]}}', panes = '{"id":"cli:pane:list","result":{"panes":[]}}', boite = '' } = {}) {
  const filet = '─'.repeat(20);
  const ecran = [filet, `❯ ${boite}`, filet].join('\n');
  const script =
    `#!/bin/sh\n` +
    `if [ "$1" = "agent" ] && [ "$2" = "read" ]; then cat <<'ECRAN'\n${ecran}\nECRAN\nexit 0\nfi\n` +
    `if [ "$1" = "pane" ] && [ "$2" = "read" ]; then cat <<'ECRAN'\n${ecran}\nECRAN\nexit 0\nfi\n` +
    `if [ "$1" = "pane" ] && [ "$2" = "list" ]; then cat <<'FIN'\n${panes}\nFIN\nexit 0\nfi\n` +
    `if [ "$1" = "agent" ] && [ "$2" = "list" ]; then cat <<'FIN'\n${agents}\nFIN\nexit 0\nfi\n` +
    `cat <<'FIN'\n{"id":"cli:x","result":{"submitted":true,"pane_id":"w2D:p11"}}\nFIN\nexit 0\n`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

/** Le pane réel de l'incident : né le 19 août à 21 h 02, invisible au registre. */
const PANE_INVISIBLE = '{"id":"cli:pane:list","result":{"panes":[' +
  '{"pane_id":"w2D:p11","agent_session":{"agent":"claude","kind":"id","value":"e7e97"},"agent_status":"unknown"},' +
  '{"pane_id":"w2D:p12","agent_status":"unknown"}' +
  ']}}';

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'joindre-malgre-registre-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
  socketMemoire = process.env.HERDR_SOCKET_PATH;
  // Une session désignée : sans elle le balayage lirait les sockets du VRAI poste, et le
  // verdict dépendrait des sessions ouvertes au moment où l'essai tourne.
  process.env.HERDR_SOCKET_PATH = join(bac, 'faux.sock');
});

after(() => {
  process.env.PATH = pathOriginal;
  if (socketMemoire === undefined) delete process.env.HERDR_SOCKET_PATH;
  else process.env.HERDR_SOCKET_PATH = socketMemoire;
  rmSync(bac, { recursive: true, force: true });
});

beforeEach(() => {
  fauxHerdrParCommande();
});

test('UN AGENT ABSENT DU REGISTRE MAIS DONT LE PANE RÉPOND EST VIVANT', async () => {
  const { vivant } = await import('../src/herdr.js');
  // Le registre est VIDE — exactement l'état mesuré le 2026-08-20 pour toute session née
  // après le 18 août. Le pane, lui, est là et porte une session d'agent.
  fauxHerdrParCommande({ agents: '{"id":"cli:agent:list","result":{"agents":[]}}', panes: PANE_INVISIBLE });

  assert.equal(
    await vivant('w2D:p11'),
    true,
    'le registre ignore ce pane, mais il porte un agent et répond : le déclarer mort referme la ligne d’un agent qui travaille'
  );
});

test("UN PANE SANS AGENT N'EST TOUJOURS PAS UN DESTINATAIRE — le repli ne s'élargit pas jusque-là", async () => {
  const { vivant } = await import('../src/herdr.js');
  fauxHerdrParCommande({ agents: '{"id":"cli:agent:list","result":{"agents":[]}}', panes: PANE_INVISIBLE });

  // `w2D:p12` existe dans la liste des panes mais ne porte AUCUNE session d'agent : c'est un
  // shell. Y écrire serait parler à un terminal où personne n'écoute. La garde d'origine
  // (herdr.test.js, « un pane sans agent n'est pas un destinataire valable ») tient.
  assert.equal(await vivant('w2D:p12'), false, 'un pane sans agent_session reste un shell, pas un agent');
  // Et un pane qui n'existe nulle part reste mort, évidemment.
  assert.equal(await vivant('w9:p9'), false, 'un pane absent des DEUX sources est bien mort');
});

test('LE REGISTRE RESTE PRIORITAIRE QUAND IL RÉPOND — le repli ne le court-circuite pas', async () => {
  const { vivant } = await import('../src/herdr.js');
  // Le registre connaît `w1:p1` ; la liste des panes ne le rend pas. Un repli qui
  // REMPLACERAIT le registre au lieu de le compléter ferait ici disparaître un agent vivant.
  fauxHerdrParCommande({
    agents: '{"id":"cli:agent:list","result":{"agents":[{"agent":"claude","pane_id":"w1:p1"}]}}',
    panes: '{"id":"cli:pane:list","result":{"panes":[]}}',
  });

  assert.equal(await vivant('w1:p1'), true, 'le registre fait toujours foi quand il connaît le pane');
});

test("UNE PANNE DE MESURE NE SE CONCLUT PAS EN MORT — on JETTE plutôt que de rendre « mort »", async () => {
  const { vivant } = await import('../src/herdr.js');
  // Le registre se tait ET la liste des panes est injoignable : on n'a RIEN mesuré.
  //
  // ⚠️ RENDRE `false` ICI SERAIT LE PIRE DES DEUX MONDES. L'arbitrage du 2026-08-20 dit
  // qu'on ne ferme que sur DISPARITION POSITIVE — absent du registre ET absent des panes,
  // tous deux CONSTATÉS. Une panne de mesure n'est pas un constat d'absence : conclure
  // « mort » ferait clore la ligne sur une question à laquelle personne n'a répondu.
  //
  // Jeter atteint le chemin « herdr injoignable » que le veilleur a déjà à ce site, et qui
  // REPORTE au lieu de trancher. C'est ce que le commentaire de `agents()` réclamait déjà.
  fauxHerdrParCommande({
    agents: '{"id":"cli:agent:list","result":{"agents":[]}}',
    panes: '{"error":{"code":"socket_refused","message":"session injoignable"},"id":"cli:pane:list"}',
  });

  await assert.rejects(
    () => vivant('w2D:p11'),
    'une liste de panes injoignable ne prouve pas une mort — il faut atteindre le chemin qui reporte'
  );
});

test('LA RONDE DE REPRISE NE FERME PAS LES LIGNES QUE LE SEUL REGISTRE IGNORE', async (t) => {
  // Le second site, et il est plus grave que le premier : `reconcilier()` tourne AU DÉMARRAGE
  // du veilleur et balaie TOUTES les lignes d'un coup. Avec un registre qui ne voit plus les
  // sessions neuves, un simple redémarrage refermait toutes leurs lignes en série — sans
  // qu'un dirigeant ni un agent n'ait rien demandé.
  const { mkdtempSync } = await import('node:fs');
  const racine = mkdtempSync(join(tmpdir(), 'ld-ronde-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  const { Veilleur } = await import('../src/veilleur.js');
  const { sauverRegistre, lignesOuvertes, chargerRegistre } = await import('../src/registre.js');

  sauverRegistre({
    version: 1,
    lignes: [
      {
        chantier: 'D-20260820-0001',
        canal_id: 'C1',
        canal_nom: 'matapedia-pack',
        pane: 'w2D:p11',
        worktree: '/w/a',
        visage: '🧭',
        ouverte_le: 'hier',
        close_le: null,
        herdr_socket: null,
        nature: 'interne',
        libelle: 'Le pack',
        autorises: ['UMOI'],
      },
    ],
  });

  const v = new Veilleur({
    cheminSocket: join(racine, 'r.sock'),
    jetons: { robot: 'x', ecoute: 'y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    slack: { async poster() { return '1'; }, async archiverCanal() {}, async nomDeMembre() { return 'x'; } },
    herdr: {
      // LE REGISTRE NE LE VOIT PAS — mais il rend une liste NON VIDE, sinon la garde
      // « aucune session joignable » couvrirait le défaut et l'essai ne prouverait rien.
      async agents() {
        return [{ agent: 'claude', pane_id: 'wZ:p1' }];
      },
      // LE PANE, LUI, EST BIEN LÀ, et il porte une session d'agent.
      async panes() {
        return { panes: [{ pane_id: 'w2D:p11', agent_session: { agent: 'claude' } }], sessionsInterrogees: 1, sessionsRefusees: [] };
      },
    },
  });

  await v.reconcilier();

  const apres = chargerRegistre();
  assert.equal(
    lignesOuvertes(apres).length,
    1,
    'le pane répond et porte un agent : sa ligne ne se referme pas parce que le registre l’ignore'
  );
});

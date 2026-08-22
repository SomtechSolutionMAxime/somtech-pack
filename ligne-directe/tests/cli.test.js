// La commande locale, éprouvée comme on l'utilise : en la lançant.
//
// `bin/` n'avait aucun test — c'est une des 500 lignes sans couverture que la revue
// indépendante a pointées. Et le défaut qui a motivé ce fichier est typique : le message
// d'erreur était juste, mais il sortait noyé sous une trace de pile Node. Personne ne lit
// la troisième ligne d'une trace ; le message était donc invisible.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { aucunGesteQuiDetruit } from './aide/gestes-qui-detruisent.js';

const execFileAsync = promisify(execFile);
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ligne-directe.js');

/**
 * Lance la commande et rend ce que l'utilisateur voit vraiment — SOUS CLOISON.
 *
 * VÉCU, et ça a coûté deux vrais canaux Slack : ces tests lancent la vraie commande, qui
 * sait réveiller le vrai veilleur du poste. Tant que le code est sain, l'argument manquant
 * arrête la commande avant tout appel — mais la vérification par mutation, que ce chantier
 * impose, casse justement ce garde-fou. Une campagne de mutations a donc fait créer deux
 * canaux `#client` dans l'espace Slack de production, depuis une suite de tests.
 *
 * Deux cloisons, parce qu'une seule laisse une porte :
 *   - un `LIGNE_DIRECTE_RACINE` jetable — le registre et le socket du poste sont hors de
 *     portée, quoi qu'il arrive ;
 *   - un `PATH` vide de `herdr` — la commande ne peut plus résoudre son pane, donc elle
 *     s'arrête avant d'avoir quoi que ce soit à dire à Slack. C'est la cloison qui compte :
 *     sans elle, un `LIGNE_DIRECTE_RACINE` neuf ferait NAÎTRE un veilleur, qui lirait le
 *     vrai trousseau et se connecterait pour de bon.
 */
async function lancer(args, env = {}) {
  const bac = mkdtempSync(join(tmpdir(), 'ld-bac-'));
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
      env: { ...process.env, LIGNE_DIRECTE_RACINE: bac, PATH: join(bac, 'sans-herdr'), ...env },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

test('sans argument, la commande explique ce qu’elle sait faire', async () => {
  const r = await lancer([]);
  assert.match(r.stdout, /ouvrir/);
  assert.match(r.stdout, /relever/);
  assert.equal(r.code, 0);
});

test('UNE ERREUR ATTENDUE SORT LISIBLE — pas sous une trace de pile', async () => {
  // On reproduit le cas exact qui a motivé ce correctif : un veilleur d'une version
  // antérieure qui refuse de céder la place. Le message était juste — il donnait la
  // commande à taper — mais il sortait sous « file:///…/client.js:111 / throw new Error( /
  // ^ », c'est-à-dire invisible.
  //
  // ⚠️ HONNÊTETÉ SUR LA PORTÉE : ce test vérifie le CONTENU (échec, explication, marche à
  // suivre) — PAS la mise en forme. Retirer le rattrapage d'erreur ne le fait pas rougir :
  // vérifié par mutation, Node 25 formate déjà proprement ce chemin d'erreur précis. La
  // trace observée venait d'un autre chemin, que je n'ai pas su reproduire ici. Plutôt que
  // de laisser croire à une garantie qui n'existe pas, on l'écrit.
  const bac = mkdtempSync(join(tmpdir(), 'ld-cli-'));
  const { createServer } = await import('node:net');
  const tetu = await new Promise((resolve) => {
    const srv = createServer((flux) => {
      flux.on('data', (m) => {
        const geste = JSON.parse(m.toString().trim()).geste;
        flux.write(`${JSON.stringify(geste === 'ceder' ? { ok: false, erreur: 'geste inconnu : ceder' } : { ok: true })}\n`);
      });
    });
    srv.listen(join(bac, 'veilleur.sock'), () => resolve(srv));
  });

  try {
    const r = await lancer(['relever'], { LIGNE_DIRECTE_RACINE: bac });

    assert.equal(r.code, 1, 'une relève qui n’a pas eu lieu doit sortir en échec');
    assert.match(r.stderr, /n'a pas cédé/, "l'explication doit être là");
    // « Elle doit dire quoi faire » exigeait le mot `pkill` — donc ce test ANCRAIT le geste
    // qui tuait tous les veilleurs du poste (T-20260811-0087). Ce qui compte n'est pas qu'un
    // mot soit là : c'est que le geste proposé vise LA place occupée, et qu'il ne détruise
    // rien au-delà.
    assert.ok(r.stderr.includes(join(bac, 'veilleur.sock')), `elle doit dire quoi faire, en visant CETTE place — reçu :\n${r.stderr}`);
    aucunGesteQuiDetruit(assert, r.stderr, 'relève refusée, vue depuis la ligne de commande');
    assert.doesNotMatch(r.stderr, /throw new Error/, "le code source ne doit pas être recopié à l'écran");
  } finally {
    tetu.close();
  }
});

test('LA SUITE NE PEUT PAS ATTEINDRE LE VEILLEUR DU POSTE — cloison prouvée, pas déclarée', async () => {
  // Une cloison qu'on affirme sans l'éprouver n'est pas une cloison. Ici on demande
  // explicitement une ouverture COMPLÈTE et bien formée : sans cloison, elle réveillerait
  // le veilleur du poste et créerait un vrai canal Slack — c'est arrivé.
  const { readdirSync } = await import('node:fs');
  const bac = mkdtempSync(join(tmpdir(), 'ld-cloison-'));

  const r = await lancer(['ouvrir', 'D-CANAL-QUI-NE-DOIT-PAS-NAITRE', '--nature', 'client'], {
    LIGNE_DIRECTE_RACINE: bac,
  });

  assert.equal(r.code, 1, 'sans herdr joignable, la commande doit renoncer');
  assert.deepEqual(readdirSync(bac), [], 'aucun veilleur, aucun registre, aucun socket : rien ne doit être né');
});

test('LA VALEUR DE --nature N’EST PAS PRISE POUR LE CHANTIER', async () => {
  // Le piège que la revue avait déjà attrapé sur `--inviter` : un « premier mot qui ne
  // commence pas par -- » prend la VALEUR d'une option pour le chantier. Ici, oublier
  // `--nature` dans la liste des options à valeur ferait ouvrir un canal nommé « client »
  // — silencieusement, et le canal reste.
  //
  // La commande sans chantier doit donc montrer l'usage. Avec le défaut, elle irait
  // chercher le pane courant et échouerait ailleurs, sans jamais montrer l'usage.
  const r = await lancer(['ouvrir', '--nature', 'client']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /ouvrir <chantier>/, 'sans chantier, la commande doit montrer son usage');
});

test('l’usage annonce --nature, et dit ce qu’elle change', async () => {
  // Une capacité du pack décrit ses commandes telles qu'elles existent réellement
  // (RA-AGT-002) : un drapeau livré mais absent de l'usage n'existe pour personne.
  const r = await lancer([]);
  assert.match(r.stdout, /--nature client/);
  assert.match(r.stdout, /PRIVE/i, "l'usage doit dire ce que la nature change vraiment");
});

test('un geste inconnu ne plante pas, il montre l’usage', async () => {
  const r = await lancer(['fais-moi-un-cafe']);
  assert.equal(r.code, 1);
  assert.match(r.stdout + r.stderr, /ouvrir/);
});

test('COMMUN — sans --dirigeant NI --role, la commande montre son usage et n’inscrit RIEN', async () => {
  // Le geste `commun` désigne le canal dont chaque message est remis aux agents d'un rôle.
  // Sans liste d'autorisés, n'importe quel membre de l'espace pourrait faire rafraîchir la
  // configuration de chacun d'eux ; sans rôle, on ne saurait pas à qui remettre. Les deux refus
  // se prononcent AVANT de joindre quoi que ce soit — ce qui est aussi la seule raison pour
  // laquelle ce test peut exister sous cloison.
  const sansRien = await lancer(['commun', 'annonces-orchestrateurs']);
  assert.equal(sansRien.code, 1);
  assert.match(sansRien.stdout, /commun <canal> --role <role> --dirigeant/, 'l’usage nomme les options manquantes');
  assert.doesNotMatch(sansRien.stdout, /^\{/m, 'aucun contrat JSON ne sort d’un refus d’usage');

  // LE RÔLE SEUL MANQUANT EST UN REFUS AUSSI — et c'est le chemin qui compte, parce qu'il est
  // celui d'un opérateur qui a l'habitude de l'ancienne commande : il tape ce qu'il tapait
  // hier, avec sa liste, et rien ne doit être désigné.
  const sansRole = await lancer(['commun', 'annonces-orchestrateurs', '--dirigeant', 'maxime.leboeuf@somtech.ca']);
  assert.equal(sansRole.code, 1, 'la commande d’hier, telle quelle, ne désigne plus rien');
  assert.doesNotMatch(sansRole.stdout, /^\{/m);
});

test('COMMUN — l’usage annonce le geste, son rôle, et dit qu’il est descendant', async () => {
  // RA-AGT-002 : un geste livré mais absent de l'usage n'existe pour personne. Et celui-ci
  // porte deux propriétés qu'on ne devine pas — rien n'y remonte, et il ne vise QU'UN rôle —,
  // sans quoi un opérateur croirait poser un canal que tout le poste entend.
  const r = await lancer([]);
  assert.match(r.stdout, /commun <canal> --role <role>/);
  assert.match(r.stdout, /agents de CE role/i, 'l’usage doit dire que les autres ne reçoivent pas');
  assert.match(r.stdout, /chef d'equipe jamais/i, 'et nommer celui qui ne reçoit jamais rien');
  assert.match(r.stdout, /Descendant\s+seulement/i, 'l’usage doit dire que rien n’y remonte');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA COMMANDE « vue » — ce que le dirigeant peut DÉCOUVRIR
//
// ⚠️ CE QU'ON NE PEUT PAS ÉPROUVER ICI, ET POURQUOI ON LE DIT PLUTÔT QUE DE LE TAIRE : lancer
// « vue » pour de vrai exige un veilleur, et un lancement sous `node --test` transmet le
// contexte de test à l'enfant — qui tente alors d'en faire naître un, ce que la cloison d'essais
// refuse à juste titre (10 s d'attente, puis échec). La sortie de la commande est donc éprouvée
// AILLEURS, sur `ecrireLaVue` et `GESTE_DE_LA_VUE`, sortis du `bin` exprès pour ça.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('l’aide annonce le geste « vue » — un geste qu’on ne peut pas découvrir n’existe pas', async () => {
  const r = await lancer([]);
  assert.match(r.stdout, /vue \[--json\]/, 'le geste figure dans l’aide');
  assert.match(r.stdout, /CODE DU MANDAT/, 'et l’aide dit par quoi la jointure passe');
});

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

const execFileAsync = promisify(execFile);
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ligne-directe.js');

/** Lance la commande et rend ce que l'utilisateur voit vraiment. */
async function lancer(args, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
      env: { ...process.env, ...env },
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
    assert.match(r.stderr, /pkill/, "et elle doit dire quoi faire");
    assert.doesNotMatch(r.stderr, /throw new Error/, "le code source ne doit pas être recopié à l'écran");
  } finally {
    tetu.close();
  }
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

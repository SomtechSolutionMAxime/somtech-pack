// « ligne-directe etat » NOMME L'ÉCART DE CODE, ET NE MENT JAMAIS PAR SILENCE
// (T-20260818-0035, critère 3 du ticket).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE BANC EXERCE
//
// La VRAIE commande (`node bin/ligne-directe.js etat`), lancée en sous-processus — comme
// `tests/cli.test.js` le fait pour les autres gestes. Le veilleur, lui, est un DOUBLE : un
// simple socket qui répond exactement ce qu'on lui donne. Ce qui est éprouvé ici n'est PAS
// le calcul de l'écart (couvert par `identite-du-code.js` et le veilleur eux-mêmes), mais le
// CÂBLAGE : que la commande lise `etat.code` et écrive le bon avertissement sur stderr, sans
// jamais changer le code de sortie ni casser le JSON rendu sur stdout.
//
// ⚠️ MÊME CLOISON QUE `cli.test.js` : `LIGNE_DIRECTE_RACINE` jetable et un `PATH` sans herdr,
// pour qu'une régression ne fasse jamais réveiller un vrai veilleur de production.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const execFileAsync = promisify(execFile);
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ligne-directe.js');

/** Un faux veilleur : il répond, à toute requête, EXACTEMENT la réponse qu'on lui donne. */
function veilleurFactice(chemin, reponse) {
  return new Promise((resolve) => {
    const serveur = createServer((flux) => {
      flux.on('data', () => flux.write(`${JSON.stringify(reponse)}\n`));
      flux.on('error', () => {});
    });
    serveur.listen(chemin, () => resolve(serveur));
  });
}

/** Lance `etat` contre un veilleur factice qui rend le `code` fourni. */
async function etatAvec(code) {
  const bac = mkdtempSync(join(tmpdir(), 'ld-etat-cli-'));
  const socket = join(bac, 'veilleur.sock');
  const reponse = { ok: true, espace: 'T', connecte: true, ouvertes: [], communs: [], sans_role: null, dirigeant: null, code };
  const serveur = await veilleurFactice(socket, reponse);
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, 'etat'], {
      env: { ...process.env, LIGNE_DIRECTE_RACINE: bac, PATH: join(bac, 'sans-herdr') },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout || '', stderr: err.stderr || '' };
  } finally {
    serveur.close();
    rmSync(bac, { recursive: true, force: true });
  }
}

test('code PÉRIMÉ → stderr NOMME l’écart et propose la relève, code de sortie inchangé (0)', async () => {
  const r = await etatAvec({
    empreinte: 'aaa111aaa111',
    date: '2026-08-17T00:00:00.000Z',
    chemin: '/x',
    demarre_le: '2026-08-17T00:00:00.000Z',
    ephemere: false,
    sur_disque: { empreinte: 'bbb222bbb222', date: '2026-08-20T00:00:00.000Z' },
    perime: true,
    motif:
      "le veilleur sert l'empreinte aaa111aaa111 (code du 2026-08-17T00:00:00.000Z), " +
      "le poste a installé bbb222bbb222 (code du 2026-08-20T00:00:00.000Z)",
  });
  assert.equal(r.code, 0, 'un code périmé se SIGNALE, il ne change pas le code de sortie');
  assert.match(r.stderr, /aaa111aaa111/, `stderr doit nommer l’empreinte SERVIE — reçu : ${r.stderr}`);
  assert.match(r.stderr, /bbb222bbb222/, `stderr doit nommer l’empreinte INSTALLÉE — reçu : ${r.stderr}`);
  assert.match(r.stderr, /ligne-directe relever/, 'stderr doit dire le geste qui répare');
  assert.equal(JSON.parse(r.stdout).code.perime, true, 'le JSON sur stdout doit rester intact');
});

test('code IMPOSSIBLE À COMPARER (perime: null) → stderr le dit, jamais « à jour »', async () => {
  const r = await etatAvec({
    empreinte: 'aaa111aaa111',
    date: 'X',
    chemin: '/x',
    demarre_le: 'X',
    ephemere: false,
    sur_disque: { empreinte: null, date: null, refus: 'dossier illisible' },
    perime: null,
    motif: 'impossible de comparer le code servi au code installé : dossier illisible',
  });
  assert.equal(r.code, 0);
  assert.match(r.stderr, /impossible de comparer/, `stderr doit dire l’impossibilité — reçu : ${r.stderr}`);
  assert.doesNotMatch(r.stderr, /à jour/, 'une mesure ratée ne doit JAMAIS se lire « à jour »');
});

test('code À JOUR → rien sur stderr', async () => {
  const r = await etatAvec({
    empreinte: 'aaa111aaa111',
    date: 'X',
    chemin: '/x',
    demarre_le: 'X',
    ephemere: false,
    sur_disque: { empreinte: 'aaa111aaa111', date: 'X' },
    perime: false,
    motif: null,
  });
  assert.equal(r.code, 0);
  assert.equal(r.stderr.trim(), '', `à jour : rien à signaler — reçu : ${r.stderr}`);
});

test('CHEMIN ÉPHÉMÈRE → avertissement dédié, cumulable avec le reste', async () => {
  const r = await etatAvec({
    empreinte: 'aaa111aaa111',
    date: 'X',
    chemin: '/tmp/xyz/ligne-directe/src',
    demarre_le: 'X',
    ephemere: true,
    sur_disque: { empreinte: 'aaa111aaa111', date: 'X' },
    perime: false,
    motif: null,
  });
  assert.equal(r.code, 0);
  assert.match(r.stderr, /éphémère/, `stderr doit signaler le chemin éphémère — reçu : ${r.stderr}`);
  assert.match(r.stderr, /\/tmp\/xyz\/ligne-directe\/src/, 'et le nommer');
});

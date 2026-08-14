// LA PAROLE DU DIRIGEANT SE PROUVE DANS LA BOÎTE DE SON AGENT (T-20260814-0138).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// L'AUTRE PORTE — et c'est celle qui porte le plus
//
// `remettre` est le chemin par lequel ce que le dirigeant écrit dans Slack arrive dans le pane
// de son agent. Il lisait la RÉPONSE de herdr — ce qui ferme déjà le piège du code de sortie 0
// sur `agent_not_found` — mais il ne relisait jamais la boîte de saisie. Or le mode de panne
// mesuré ce jour-là n'est pas une erreur : l'appel réussit, et le texte reste dans la boîte
// sans être soumis. L'agent ne voit rien, le dirigeant a son accusé.
//
// Le brief l'a nommé en toutes lettres : `agent prompt` ET `livrer.js` ET `rendez-vous.js`
// envoient du texte, et un correctif qui ferme un chemin et laisse l'autre ouvert n'a rien
// fermé. `livraison.js` relisait ; ici, rien ne relisait — c'est « une porte sur deux » sur le
// chemin le plus important du dispositif.
//
// ⚠️ CE QUE LA MESURE DU 2026-08-14 A ÉTABLI, ET QUI COMMANDE LA FORME DU REMÈDE.
//
// 25 envois contre le vrai service, de 350 à 24 000 caractères, de 1 à 100 lignes, avec et sans
// ponctuation exotique : AUCUN n'est resté collé sur `agent prompt`. Le seuil de longueur que le
// ticket supposait N'EXISTE PAS. Le phénomène est une COURSE — reproduit sur l'autre primitive,
// où le même envoi de 2400 caractères reste collé 2 fois sur 5.
//
// Conséquence directe : on ne code aucun seuil, et on ne se fie à aucune longueur. On vérifie
// APRÈS COUP, à chaque fois, et on répare. C'est la seule forme qui tienne contre une course.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let bac;
let pathOriginal;

/**
 * Un faux herdr qui se comporte comme le vrai sur le point qui compte : `agent prompt` rend un
 * SUCCÈS que le texte soit soumis ou resté dans la boîte, et seule la relecture les distingue.
 *
 * `colle` : le texte reste dans la boîte, rendu comme le vrai service le rend — un ou plusieurs
 * `[Pasted text #N]`, relevés verbatim pendant la mesure. `send-keys Enter` le débloque.
 */
function fauxHerdr({ colle = false } = {}) {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const COLLE = ${JSON.stringify(colle)};
const promptFait = passes.some((a) => a[0] === 'agent' && a[1] === 'prompt');
const enterEnvoye = passes.some((a) => a[1] === 'send-keys');

if (cmd === 'agent read') {
  const reste = COLLE && promptFait && !enterEnvoye ? '[Pasted text #56][Pasted text #57 +1 lines]' : '';
  process.stdout.write(['~/un-chantier', SEP, '\\u276f ' + reste, SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent prompt') {
  // LE DÉFAUT, REPRODUIT : succès rendu, que la soumission soit partie ou non.
  process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'idle' } } }));
  process.exit(0);
}
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
  return journal;
}

const appels = (journal) =>
  readFileSync(journal, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'ld-remise-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});
after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});
beforeEach(() => {});

test('UN MESSAGE RESTÉ DANS LA BOÎTE EST RATTRAPÉ — et la remise n’est rendue qu’après vérification', async () => {
  const { remettre } = await import('../src/herdr.js');
  const journal = fauxHerdr({ colle: true });

  const preuve = await remettre('w1:p1', 'L’option B, et n’attends pas.');

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(gestes.includes('agent send-keys'), 'la soumission bloquée doit avoir été débloquée');
  assert.ok(preuve, 'et la remise rend sa preuve une fois la boîte vidée');
});

test('UN MESSAGE QUI RESTE COLLÉ MALGRÉ TOUT FAIT ÉCHOUER LA REMISE — jamais un succès silencieux', async () => {
  const { remettre, RemiseEchouee } = await import('../src/herdr.js');
  // La touche d'envoi ne débloque rien ici : le double garde la boîte pleine quoi qu'il arrive.
  const script = readFileSync(join(bac, 'herdr'), 'utf8').replace('&& !enterEnvoye', '');
  writeFileSync(join(bac, 'herdr'), script);

  await assert.rejects(
    () => remettre('w1:p1', 'L’option B, et n’attends pas.'),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err.name}`);
      assert.match(err.message, /bo[iî]te/i, 'le refus doit dire ce qu’il a vu');
      return true;
    }
  );
});

test('UNE REMISE ORDINAIRE NE PAIE AUCUNE TOUCHE EN PLUS — on ne répare que ce qui est cassé', async () => {
  const { remettre } = await import('../src/herdr.js');
  const journal = fauxHerdr({ colle: false });

  await remettre('w1:p1', 'coucou');

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(!gestes.includes('agent send-keys'), 'rien à réparer : la touche d’envoi ne part pas');
  assert.ok(gestes.includes('agent read'), 'mais la boîte a bien été relue — c’est ça, la preuve');
});

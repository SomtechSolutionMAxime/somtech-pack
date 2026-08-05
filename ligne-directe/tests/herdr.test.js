// Ce fichier existe à cause d'un défaut réel, trouvé en mesurant l'outil plutôt qu'en le
// supposant : **herdr sort avec le code 0 même quand il échoue**. `agent_not_found` arrive
// sur la sortie standard, en JSON, sans code d'erreur processus.
//
// Un pont qui se fie au code de sortie déclare donc « message remis » alors que personne
// ne l'a reçu — exactement le mode de panne silencieux qu'on refuse ici.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let bac;
let pathOriginal;

/** Installe un faux `herdr` en tête de PATH, qui répond ce qu'on lui dit de répondre. */
function fauxHerdr(reponseJson, { codeSortie = 0 } = {}) {
  const script = `#!/bin/sh\ncat <<'FIN'\n${reponseJson}\nFIN\nexit ${codeSortie}\n`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'ligne-directe-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});

after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});

test('UNE ERREUR HERDR RENDUE AVEC LE CODE 0 NE PASSE PAS POUR UNE REMISE', async () => {
  const { remettre, RemiseEchouee } = await import('../src/herdr.js');
  fauxHerdr('{"error":{"code":"agent_not_found","message":"agent target w99:pZZ not found"},"id":"cli:agent:prompt"}');
  await assert.rejects(() => remettre('w99:pZZ', 'coucou'), (err) => {
    assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err.name}`);
    // On interroge le champ STRUCTURÉ, pas le message : une assertion sur le texte passait
    // encore après avoir retiré la détection d'erreur, parce que le garde-fou suivant
    // recopiait le JSON brut — donc le code d'erreur — dans sa propre phrase. Un test qui
    // survit à la mutation qu'il est censé attraper est un faux témoin (vérifié par mutation).
    assert.equal(err.raison, 'agent_not_found');
    return true;
  });
});

test('une remise réussie rend la preuve fournie par herdr, pas un booléen de confiance', async () => {
  const { remettre } = await import('../src/herdr.js');
  fauxHerdr('{"id":"cli:agent:prompt","result":{"submitted":true,"pane_id":"w1:p1"}}');
  const preuve = await remettre('w1:p1', 'coucou');
  assert.deepEqual(preuve, { submitted: true, pane_id: 'w1:p1' });
});

test('une réponse sans result ni error est traitée comme un échec, pas comme un succès', async () => {
  const { remettre } = await import('../src/herdr.js');
  fauxHerdr('{"id":"cli:agent:prompt"}');
  await assert.rejects(() => remettre('w1:p1', 'coucou'), /réponse inattendue/);
});

test("un message trop long est refusé AVANT l'appel, pas tronqué en chemin", async () => {
  const { remettre } = await import('../src/herdr.js');
  fauxHerdr('{"id":"x","result":{"submitted":true}}');
  await assert.rejects(() => remettre('w1:p1', 'x'.repeat(60_001)), /à découper/);
});

test('un pane vivant est reconnu, un pane fermé ne l’est pas', async () => {
  const { vivant } = await import('../src/herdr.js');
  fauxHerdr(
    '{"id":"cli:agent:list","result":{"agents":[{"agent":"claude","pane_id":"w1:p1"},{"agent":null,"pane_id":"w2:p2"}]}}'
  );
  assert.equal(await vivant('w1:p1'), true);
  assert.equal(await vivant('w9:p9'), false);
  // Un pane sans agent (un shell) n'est pas un destinataire valable.
  assert.equal(await vivant('w2:p2'), false);
});

test("SANS session herdr sur le disque, on interroge quand meme herdr", async () => {
  // Trouvé par la CI, pas en local : la découverte des sessions suppose une arborescence
  // qui peut ne pas exister (autre système, autre version, machine d'intégration). Le
  // veilleur cessait alors de consulter herdr — donc concluait que TOUS les agents étaient
  // morts et refermait toutes les lignes.
  const { agents } = await import('../src/herdr.js');
  const memoire = process.env.HERDR_SOCKET_PATH;
  const memoireHome = process.env.HOME;
  delete process.env.HERDR_SOCKET_PATH;
  process.env.HOME = bac; // un dossier personnel vide : aucune session à découvrir
  fauxHerdr('{"id":"cli:agent:list","result":{"agents":[{"agent":"claude","pane_id":"w1:p1"}]}}');
  try {
    const liste = await agents();
    assert.equal(liste.length, 1, 'herdr doit être interrogé même sans session découverte');
  } finally {
    if (memoire) process.env.HERDR_SOCKET_PATH = memoire;
    process.env.HOME = memoireHome;
  }
});

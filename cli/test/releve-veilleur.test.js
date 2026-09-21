// LA MISE À JOUR DU POSTE NE REND JAMAIS UN SUCCÈS MUET (T-20260818-0035, critère 2 du
// ticket) — `releverSiPerime`, entièrement injectée.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER ÉPROUVE
//
// Six cas, chacun avec sa phrase-clé attendue dans le journal (`log`) : c'est elle que la
// personne qui lance `pack setup` voit défiler, pas une valeur de retour qu'un script devrait
// aller inspecter. Toutes les dépendances d'I/O — `parler`, `passerLaMain`, `empreinteDuCode`
// — sont des DOUBLES : ce fichier ne fait naître aucun vrai veilleur, ne touche à aucun vrai
// socket, ne lit aucun vrai dossier de code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { releverSiPerime } from '../src/releve-veilleur.js';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

/** Un `toolsDir` avec (ou sans) le socket du veilleur déjà « présent ». */
function toolsDirAvecSocket({ socket = true } = {}) {
  const dir = tmp('smtk-releve-');
  const racineLigneDirecte = join(dir, 'ligne-directe');
  mkdirSync(racineLigneDirecte, { recursive: true });
  if (socket) writeFileSync(join(racineLigneDirecte, 'veilleur.sock'), '');
  return dir;
}

function collecteur() {
  const lignes = [];
  return { log: (m) => lignes.push(m), lignes };
}

const EMPREINTE_INSTALLEE = { empreinte: 'ccc333ccc333', date: '2026-08-20T00:00:00.000Z' };

test('1. SOCKET ABSENT → « aucun en cours », aucune tentative de parler ou de relever', async () => {
  const toolsDir = toolsDirAvecSocket({ socket: false });
  const { log, lignes } = collecteur();
  let parlerAppele = false;
  let releveAppelee = false;

  await releverSiPerime({
    toolsDir,
    parler: async () => { parlerAppele = true; return {}; },
    passerLaMain: async () => { releveAppelee = true; },
    empreinteDuCode: () => EMPREINTE_INSTALLEE,
    log,
  });

  assert.ok(lignes.some((l) => l.includes('aucun en cours')), `doit dire « aucun en cours » — reçu : ${lignes.join(' | ')}`);
  assert.equal(parlerAppele, false, 'sans socket, on ne PARLE à personne');
  assert.equal(releveAppelee, false, 'sans socket, on ne tente PAS de relever — il n’y a personne à relever');
});

test('2. PING QUI LÈVE → « ne répond pas », et le geste manuel est proposé', async () => {
  const toolsDir = toolsDirAvecSocket();
  const { log, lignes } = collecteur();
  let releveAppelee = false;

  await releverSiPerime({
    toolsDir,
    parler: async () => { throw new Error('ECONNREFUSED'); },
    passerLaMain: async () => { releveAppelee = true; },
    empreinteDuCode: () => EMPREINTE_INSTALLEE,
    log,
  });

  assert.ok(lignes.some((l) => l.includes('ne répond pas')), `doit dire « ne répond pas » — reçu : ${lignes.join(' | ')}`);
  assert.ok(lignes.some((l) => l.includes('ECONNREFUSED')), 'le message de l’échec doit être NOMMÉ, pas avalé');
  assert.ok(lignes.some((l) => l.includes('relève-le à la main')), 'et le geste manuel doit être proposé');
  assert.equal(releveAppelee, false, 'un socket qui ne répond pas n’est pas relevé automatiquement — on le dit, on ne le force pas');
});

test('3. PING SANS `code` (version antérieure à ce lot) → traité comme périmé, la relève est tentée', async () => {
  const toolsDir = toolsDirAvecSocket();
  const { log, lignes } = collecteur();
  let releveAppelee = false;
  let appels = 0;

  await releverSiPerime({
    toolsDir,
    // Un vrai veilleur d'AVANT ce lot répond au ping, mais sans `code` — c'est le seul fait
    // qui distingue ce cas du cas « à jour ». Le SECOND ping (après la relève) simule le
    // veilleur neuf, qui lui sait dire ce qu'il sert.
    parler: async () => {
      appels += 1;
      if (appels === 1) return { ok: true, veilleur: 'vivant' };
      return { ok: true, code: { empreinte: EMPREINTE_INSTALLEE.empreinte, date: EMPREINTE_INSTALLEE.date } };
    },
    passerLaMain: async () => { releveAppelee = true; },
    empreinteDuCode: () => EMPREINTE_INSTALLEE,
    log,
  });

  assert.equal(releveAppelee, true, 'un veilleur muet sur son code doit être traité comme périmé, donc relevé');
  assert.ok(lignes.some((l) => l.includes('relevé')), `doit annoncer la relève — reçu : ${lignes.join(' | ')}`);
});

test('4. À JOUR → « à jour », aucune tentative de relève', async () => {
  const toolsDir = toolsDirAvecSocket();
  const { log, lignes } = collecteur();
  let releveAppelee = false;

  await releverSiPerime({
    toolsDir,
    parler: async () => ({ ok: true, code: { empreinte: EMPREINTE_INSTALLEE.empreinte, date: EMPREINTE_INSTALLEE.date } }),
    passerLaMain: async () => { releveAppelee = true; },
    empreinteDuCode: () => EMPREINTE_INSTALLEE,
    log,
  });

  assert.ok(lignes.some((l) => l.includes('à jour')), `doit dire « à jour » — reçu : ${lignes.join(' | ')}`);
  assert.equal(releveAppelee, false, 'un veilleur à jour ne se relève pas');
});

test('5. PÉRIMÉ ET RELÈVE OK → « relevé », avec les deux empreintes nommées (confirmé par un RE-PING)', async () => {
  const toolsDir = toolsDirAvecSocket();
  const { log, lignes } = collecteur();
  let appels = 0;

  await releverSiPerime({
    toolsDir,
    // ⚠️ LE DOUBLE CHANGE DE RÉPONSE ENTRE LES DEUX APPELS — comme un vrai veilleur remplacé
    // par un neuf. Un double figé sur la même réponse aux deux pings ne prouverait rien du
    // RE-PING que ce lot exige : il resservirait la vieille empreinte, et le mismatch qui
    // en découlerait masquerait le comportement qu'on veut voir ici.
    parler: async () => {
      appels += 1;
      if (appels === 1) return { ok: true, code: { empreinte: 'aaa111aaa111', date: '2026-08-17T00:00:00.000Z' } };
      return { ok: true, code: { empreinte: EMPREINTE_INSTALLEE.empreinte, date: EMPREINTE_INSTALLEE.date } };
    },
    passerLaMain: async () => ({ ok: true }),
    empreinteDuCode: () => EMPREINTE_INSTALLEE,
    log,
  });

  assert.equal(appels, 2, 'la relève doit être CONFIRMÉE par un second ping, pas seulement affirmée');
  const ligne = lignes.find((l) => l.includes('relevé') && !l.includes('mais'));
  assert.ok(ligne, `doit annoncer « relevé » (sans « mais ») — reçu : ${lignes.join(' | ')}`);
  assert.ok(ligne.includes(EMPREINTE_INSTALLEE.empreinte), 'doit nommer l’empreinte NEUVE — MESURÉE au second ping, pas seulement celle qu’on installait');
  assert.ok(ligne.includes('aaa111aaa111'), 'doit nommer l’empreinte ANCIENNE (celle que servait le veilleur remplacé)');
});

test('6. PÉRIMÉ ET RELÈVE QUI LÈVE → « NON relevé », rien n’est avalé (mutation m4 du brief)', async () => {
  const toolsDir = toolsDirAvecSocket();
  const { log, lignes } = collecteur();

  await releverSiPerime({
    toolsDir,
    parler: async () => ({ ok: true, code: { empreinte: 'aaa111aaa111', date: '2026-08-17T00:00:00.000Z' } }),
    passerLaMain: async () => { throw new Error('Le veilleur en place n’a pas cédé la main'); },
    empreinteDuCode: () => EMPREINTE_INSTALLEE,
    log,
  });

  assert.ok(lignes.some((l) => l.includes('NON relevé')), `doit dire « NON relevé » — reçu : ${lignes.join(' | ')}`);
  assert.ok(lignes.some((l) => l.includes('relève-le à la main')), 'et proposer le geste manuel');
  assert.ok(
    lignes.some((l) => l.includes('n’a pas cédé la main')),
    'le motif de l’échec de la relève doit être NOMMÉ, pas avalé'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// « RELEVÉ » EST UNE MESURE, PAS UNE AFFIRMATION SUR L'OBJET (retour du coordonnateur,
// même famille de défaut que le ticket : vérifier qu'une chose est EN PLACE — `passerLaMain`
// a rendu `ok` — n'est pas vérifier qu'elle FONCTIONNE — le veilleur qui répond ENSUITE sert
// vraiment le code installé). Sans le RE-PING qui suit `passerLaMain`, un revenant encore en
// place, ou un veilleur neuf né du mauvais dossier, ferait annoncer « relevé » alors que rien
// n'a changé ou que ça a changé pour le pire.

test('7. PÉRIMÉ, RELÈVE « OK », MAIS LE RE-PING RÉVÈLE UNE AUTRE EMPREINTE → « relevé mais »', async () => {
  const toolsDir = toolsDirAvecSocket();
  const { log, lignes } = collecteur();
  let appels = 0;

  await releverSiPerime({
    toolsDir,
    parler: async () => {
      appels += 1;
      if (appels === 1) return { ok: true, code: { empreinte: 'aaa111aaa111', date: '2026-08-17T00:00:00.000Z' } };
      // `passerLaMain` a rendu `ok`, mais ce qui répond au socket APRÈS ne sert PAS
      // l'empreinte installée — le cas exact d'un revenant qui a gardé la place, ou d'un
      // veilleur neuf né d'un mauvais dossier.
      return { ok: true, code: { empreinte: 'zzz999zzz999', date: '2026-08-10T00:00:00.000Z' } };
    },
    passerLaMain: async () => ({ ok: true }),
    empreinteDuCode: () => EMPREINTE_INSTALLEE,
    log,
  });

  assert.equal(appels, 2, 'le re-ping doit avoir eu lieu');
  const ligne = lignes.find((l) => l.includes('relevé mais'));
  assert.ok(ligne, `doit dire « relevé mais » — reçu : ${lignes.join(' | ')}`);
  assert.ok(ligne.includes('zzz999zzz999'), 'doit nommer ce que le veilleur sert VRAIMENT (mesuré)');
  assert.ok(ligne.includes(EMPREINTE_INSTALLEE.empreinte), 'doit nommer ce qui était attendu (l’installée)');
  assert.ok(lignes.some((l) => l.includes('relève-le à la main')), 'et proposer le geste manuel — ce n’est PAS un succès');
  assert.ok(!lignes.some((l) => /^veilleur relevé :/.test(l)), 'le message de succès SANS réserve ne doit PAS sortir');
});

test('8. PÉRIMÉ, RELÈVE « OK », MAIS LE VEILLEUR NE RÉPOND PLUS AU RE-PING → « ne répond plus après »', async () => {
  const toolsDir = toolsDirAvecSocket();
  const { log, lignes } = collecteur();
  let appels = 0;

  await releverSiPerime({
    toolsDir,
    parler: async () => {
      appels += 1;
      if (appels === 1) return { ok: true, code: { empreinte: 'aaa111aaa111', date: '2026-08-17T00:00:00.000Z' } };
      throw new Error('ECONNRESET');
    },
    passerLaMain: async () => ({ ok: true }),
    empreinteDuCode: () => EMPREINTE_INSTALLEE,
    log,
  });

  assert.equal(appels, 2, 'le re-ping doit avoir été tenté');
  assert.ok(
    lignes.some((l) => l.includes('ne répond plus après')),
    `doit dire « ne répond plus après » — reçu : ${lignes.join(' | ')}`
  );
  assert.ok(lignes.some((l) => l.includes('ECONNRESET')), 'le motif de l’échec du re-ping doit être NOMMÉ');
  assert.ok(lignes.some((l) => l.includes('relève-le à la main')), 'et proposer le geste manuel');
  assert.ok(!lignes.some((l) => /^veilleur relevé/.test(l)), 'aucun succès ne doit être annoncé sur un re-ping qui échoue');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// AUCUNE EXCEPTION NE DOIT ÊTRE FATALE POUR `setup` — c'est l'invariant transversal du lot.

test('UNE EXCEPTION INATTENDUE EST LOGGÉE, JAMAIS AVALÉE, JAMAIS RELANCÉE', async () => {
  const toolsDir = toolsDirAvecSocket();
  const { log, lignes } = collecteur();

  // `releverSiPerime` ne doit JAMAIS lancer, quoi qu'il arrive dans ses dépendances.
  await assert.doesNotReject(() =>
    releverSiPerime({
      toolsDir,
      parler: async () => ({ ok: true, code: { empreinte: 'x', date: 'y' } }),
      passerLaMain: async () => ({ ok: true }),
      empreinteDuCode: () => {
        throw new Error('lecture du dossier de code explosée');
      },
      log,
    })
  );
  assert.ok(
    lignes.some((l) => l.includes('lecture du dossier de code explosée')),
    `l’échec inattendu doit être JOURNALISÉ — reçu : ${lignes.join(' | ')}`
  );
});

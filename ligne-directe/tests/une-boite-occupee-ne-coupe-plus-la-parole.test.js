// UNE BOÎTE OCCUPÉE NE COUPE PLUS LA PAROLE DU DIRIGEANT (T-20260818-0049).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT, DANS LES MOTS DU DIRIGEANT
//
//   « je reçois ce message de espace client ça marche pas votre solution ça me bloque et je
//     dois me connecter sur terminal et même débloqué je peux plus parler avec lui »
//   « c un vrai problème tout le monde est bloqué »
//   « là les boîtes occupées on fait un Enter dessus sinon ça part jamais »
//
// ⚠️ CE N'EST PAS UNE GARDE TROP ZÉLÉE : C'EST UNE MOITIÉ LIVRÉE. Mesuré le 2026-08-18 :
//
//   • `1dae9c7` (T-20260817-0006, v1.63.0) a posé le VETO ici — `remettre()` lève quand la
//     boîte du destinataire porte déjà un texte. Avant lui, elle écrivait sans rien regarder.
//   • `eceba2e` (T-20260816-0114, v1.63.0) a livré le REMÈDE le même jour — attendre, relire,
//     et SOUMETTRE le texte coincé pour son auteur.
//   • Mais le remède vit dans `naissance-representant/src/livraison.js` et n'est appelé que par
//     `livrer.js`, `rendez-vous.js`, `naitre.js`. **Jamais par ce chemin-ci.**
//
// Le chemin par lequel arrive la parole du dirigeant a donc reçu le veto sans le rattrapage.
// C'est pour ça qu'il doit ouvrir un terminal : le refus lui-même le lui dit.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA RÈGLE QU'IL A POSÉE, ET QUI COMMANDE LA FORME DU REMÈDE
//
//   « On ne doit jamais être bloqué via le Slack. Sinon on est pris. »
//
// Une garde sur un canal de parole AVERTIT — elle ne coupe pas. On ne retire pas la mesure,
// on retire le VETO : le diagnostic reste, la conséquence change.
//
// ⚠️ ET LE DISCRIMINANT QUI ÉVITE DE CASSER CE QUE LA GARDE PROTÉGEAIT. Soumettre n'est sans
// risque que pour un texte qu'un AGENT a collé — il a déjà été envoyé par quelqu'un qui croit
// l'avoir remis, donc le soumettre n'invente rien, ça achève un geste commencé. Un texte TAPÉ
// par un humain interrompu au milieu d'une phrase ne se soumet pas : le geste ne se défait pas.
// Les deux se distinguent à l'écran — un texte collé se replie en `[Pasted text #N]`, un texte
// tapé se lit entier. `estUnEspaceReserve` porte déjà cette lecture (`boite.js`).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let bac;
let pathOriginal;

/**
 * Un faux herdr piloté PAR LE GESTE, jamais par un compteur de lectures.
 *
 * ⚠️ C'EST LA LEÇON D'UN BANC QUI NE POUVAIT PAS ÉCHOUER, relevée dans ce dépôt même
 * (T-20260817-0008) : un double qui vide la boîte au n-ième `read` la vide AVANT que le
 * correctif n'agisse, et l'essai passe au vert sur un code qui ne fait rien. Ici, la boîte
 * ne se vide que si un `send-keys Enter` est RÉELLEMENT parti.
 *
 * @param occupePar  le texte déjà coincé dans la boîte d'autrui (ce que le dirigeant subit)
 * @param sourd      si vrai, la touche d'envoi ne libère jamais la boîte
 */
function fauxHerdr({ occupePar = '', sourd = false } = {}) {
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
const OCCUPE = ${JSON.stringify(occupePar)};
const SOURD = ${JSON.stringify(sourd)};

// Le geste, jamais le compteur : la boîte se vide quand — et seulement quand — Entrée est parti.
const entrees = passes.filter((a) => a[0] === 'agent' && a[1] === 'send-keys').length;
const prompts = passes.filter((a) => a[0] === 'agent' && a[1] === 'prompt');

if (cmd === 'agent read') {
  let boite = '';
  if (OCCUPE && (SOURD || entrees === 0)) boite = OCCUPE;          // le texte d'autrui, coincé
  else if (prompts.length && (SOURD || entrees < 2)) boite = '';    // notre texte : prompt le soumet
  process.stdout.write(['~/un-chantier', SEP, '\\u276f ' + boite, SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') {
  process.stdout.write(JSON.stringify({ result: { agent: { agent_status: entrees ? 'working' : 'idle' } } }));
  process.exit(0);
}
if (cmd === 'agent prompt') {
  process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'working' } } }));
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
  bac = mkdtempSync(join(tmpdir(), 'ld-boite-occupee-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
  // Le cas COLLÉ ne doit rien attendre ; on borne le cas TAPÉ pour que le banc reste court.
  process.env.LIGNE_IMMOBILITE_MS = '60';
});
after(() => {
  process.env.PATH = pathOriginal;
  delete process.env.LIGNE_IMMOBILITE_MS;
  rmSync(bac, { recursive: true, force: true });
});

// ═══ LE ROUGE QUI PORTE LE DÉFAUT ══════════════════════════════════════════════════════

test('UNE BOÎTE OCCUPÉE PAR UN TEXTE COLLÉ NE REFUSE PLUS — on soumet, puis on écrit', async () => {
  const { remettre } = await import('../src/herdr.js');
  // Le texte exact que le dirigeant a vu dans son refus, le 2026-08-18.
  const journal = fauxHerdr({ occupePar: '[Pasted text #83 +7 lines]' });

  const preuve = await remettre('w5:p8', 'Message du dirigeant, reçu par Slack.');

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(gestes.includes('agent send-keys'), 'la boîte d’autrui doit avoir été SOUMISE');
  assert.ok(gestes.includes('agent prompt'), 'et notre message doit être parti ensuite');
  assert.ok(
    gestes.indexOf('agent send-keys') < gestes.indexOf('agent prompt'),
    'L’ORDRE EST LE CORRECTIF : on soumet d’abord, on écrit ensuite. L’inverse les colle.'
  );
  assert.ok(preuve, 'et la remise rend sa preuve');
});

test('LES DEUX TEXTES NE SONT JAMAIS FUSIONNÉS — c’est ce que la garde protégeait', async () => {
  const journal = fauxHerdr({ occupePar: '[Pasted text #83 +7 lines]' });
  const { remettre } = await import('../src/herdr.js');

  await remettre('w5:p8', 'Message du dirigeant, reçu par Slack.');

  const ecrits = appels(journal).filter((a) => a[0] === 'agent' && a[1] === 'prompt');
  assert.equal(ecrits.length, 1, 'un seul message écrit — le nôtre');
  assert.equal(
    ecrits[0][3],
    'Message du dirigeant, reçu par Slack.',
    'notre texte part SEUL : jamais abouté au texte coincé'
  );
  assert.ok(
    !String(ecrits[0][3]).includes('Pasted text #83'),
    'le texte d’autrui ne doit jamais se retrouver dans notre message'
  );
});

// ═══ LA MOITIÉ QUI PROTÈGE — ces essais doivent rester verts après le correctif ═════════

test('UN TEXTE TAPÉ PAR UN HUMAIN N’EST PAS SOUMIS À SA PLACE — le geste ne se défait pas', async () => {
  const { remettre, RemiseEchouee } = await import('../src/herdr.js');
  // Pas un repli `[Pasted text #N]` : une phrase inachevée, tapée, et que rien ne libère.
  fauxHerdr({ occupePar: 'je pense qu’il faudrait plutôt', sourd: true });

  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant.'),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err?.name}`);
      assert.match(err.message, /bo[iî]te/i, 'le refus doit dire ce qu’il a vu');
      return true;
    }
  );
});

test('UNE BOÎTE QUI NE SE LIBÈRE PAS FAIT ÉCHOUER LA REMISE — jamais un succès silencieux', async () => {
  const { remettre, RemiseEchouee } = await import('../src/herdr.js');
  fauxHerdr({ occupePar: '[Pasted text #83 +7 lines]', sourd: true });

  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant.'),
    (err) => err instanceof RemiseEchouee
  );
});

test('UNE BOÎTE LIBRE NE PAIE AUCUNE TOUCHE EN PLUS — on ne délivre que ce qui bloque', async () => {
  const journal = fauxHerdr({ occupePar: '' });
  const { remettre } = await import('../src/herdr.js');

  await remettre('w5:p8', 'coucou');

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(!gestes.includes('agent send-keys'), 'rien à délivrer : la touche d’envoi ne part pas');
});

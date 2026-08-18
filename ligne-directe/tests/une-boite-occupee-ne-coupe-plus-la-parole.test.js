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

test('UNE PHRASE TAPÉE PAR UN HUMAIN N’EST JAMAIS SOUMISE À SA PLACE — et le refus est IMMÉDIAT', async () => {
  // ⚠️ CET ESSAI A ÉTÉ REFAIT TROIS FOIS, ET CHAQUE FORME A APPRIS QUELQUE CHOSE.
  //
  // Forme 1 — une boîte que rien ne libérait : le refus tombait de toute façon, donc condamner
  //   le discriminant collé/tapé ne le faisait pas rougir. Il passait pour une autre raison.
  // Forme 2 — un texte qui changeait à chaque LECTURE : il bougeait aussi bien avec un délai nul
  //   qu'avec un délai plein. **Il mesurait le nombre de lectures, pas le temps.**
  // Forme 3, celle-ci — le code a changé sous l'essai, et c'est le banc complet qui l'a dit :
  //   l'attente d'immobilité de cinq minutes, correcte là où celui qui patiente est un agent,
  //   a fait PENDRE un essai existant 300 secondes sur ce chemin-ci. Or ce chemin est celui d'un
  //   humain qui attend. Une phrase tapée n'y déclenche donc plus d'attente du tout : elle se
  //   refuse TOUT DE SUITE, en nommant le pane et le geste.
  //
  // Ce que l'essai garde, et qui est le cœur : AUCUNE TOUCHE D'ENVOI ne part sur une phrase que
  // quelqu'un est en train de taper. Condamner le discriminant fait passer ce texte par la
  // délivrance, la touche part, et l'essai rougit.
  const journal = fauxHerdr({ occupePar: 'je reprends la migration demain matin si', sourd: true });
  const { remettre, RemiseEchouee } = await import('../src/herdr.js');

  const debut = Date.now();
  await assert.rejects(
    () => remettre('w5:p8', 'Message du dirigeant.'),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err?.name}`);
      assert.match(err.message, /TAPÉE|en train d’écrire/i, 'le refus doit dire que quelqu’un écrit là');
      assert.ok(err.message.includes('w5:p8'), 'et nommer le pane — sinon personne ne sait où aller voir');
      return true;
    }
  );
  const ecoule = Date.now() - debut;

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(
    !gestes.includes('agent send-keys'),
    'ON NE SOUMET PAS la phrase de quelqu’un qui est en train de la taper — le geste ne se défait pas'
  );
  assert.ok(
    !gestes.includes('agent prompt'),
    'et on n’écrit pas par-dessus non plus : les deux textes partiraient collés en un seul message'
  );
  // ⚠️ LE DÉLAI EST UNE GARDE À PART ENTIÈRE ICI. Un refus juste rendu au bout de cinq minutes
  // laisse le dirigeant muet pendant cinq minutes — c'est la panne qu'on ferme, pas une autre.
  assert.ok(ecoule < 5000, `le refus doit être IMMÉDIAT — il a pris ${ecoule} ms`);
});

test('UNE BOÎTE QU’ON N’A PAS LIBÉRÉE NE REÇOIT RIEN — on n’écrit pas par-dessus, jamais', async () => {
  // ⚠️ RÉÉCRIT LUI AUSSI APRÈS UNE MUTATION SURVIVANTE. Sa première forme n'exigeait qu'un
  // échec — or l'échec tombait de toute façon plus bas, donc condamner le refus de délivrance
  // ne le faisait pas rougir. Ce qui compte n'est pas QU'ON ÉCHOUE, c'est QU'ON N'AIT PAS ÉCRIT :
  // écrire par-dessus un texte qu'on n'a pas pu libérer, c'est la FUSION — le défaut même que
  // la garde de v1.63.0 était venue fermer. Un correctif qui la rouvrirait aurait tourné en rond.
  const journal = fauxHerdr({ occupePar: '[Pasted text #83 +7 lines]', sourd: true });
  const { remettre, RemiseEchouee } = await import('../src/herdr.js');

  await assert.rejects(() => remettre('w5:p8', 'Message du dirigeant.'), (err) => err instanceof RemiseEchouee);

  const ecrits = appels(journal).filter((a) => a[0] === 'agent' && a[1] === 'prompt');
  assert.equal(
    ecrits.length,
    0,
    'AUCUNE écriture : la boîte porte encore le texte d’autrui, y écrire collerait les deux en un seul message'
  );
});

test('UNE BOÎTE LIBRE NE PAIE AUCUNE TOUCHE EN PLUS — on ne délivre que ce qui bloque', async () => {
  const journal = fauxHerdr({ occupePar: '' });
  const { remettre } = await import('../src/herdr.js');

  await remettre('w5:p8', 'coucou');

  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(!gestes.includes('agent send-keys'), 'rien à délivrer : la touche d’envoi ne part pas');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE SECOND DÉFAUT, ET C'EST CELUI QUE LE DIRIGEANT DÉCRIT EN DERNIER (T-20260818-0049)
//
//   « là les boîtes de texte ne se vident pas sur les fenêtres herdr et c'est vraiment un
//     très gros problème »
//
// Sa formulation déplace le sujet d'un cran, et elle a raison de le faire : le symptôme n'est
// pas le refus, c'est que LE TEXTE RESTE. Mesuré dans le code : `remettre()` SOUMET bien ce
// qu'elle écrit — `agent prompt` soumet, et si le texte reste elle envoie la touche d'envoi.
// L'hypothèse « elle écrit seulement » est donc écartée.
//
// ⚠️ MAIS ELLE NE RELIT QU'UNE FOIS, IMMÉDIATEMENT. Une touche d'envoi part, une seule lecture
// suit, sans un instant d'attente — et si le terminal n'a pas encore traité la touche, le refus
// tombe : « le message est resté dans la boîte de saisie — il n'a pas été soumis ». C'est le
// message EXACT que le dirigeant a reçu, et il peut être FAUX : la touche avait pu marcher.
//
// Une lecture unique ne dit rien quand le système retarde. `delivrerLaBoite`, à côté, relit
// jusqu'à `essais` fois en dormant entre deux — parce qu'une boîte ne se vide pas dans
// l'instant. Ici, rien. C'est la même asymétrie que le lot principal : le savoir-faire existait
// dans un module et manquait dans l'autre.

test('LA BOÎTE A LE TEMPS DE SE VIDER — une lecture unique ne dit rien quand le terminal retarde', async () => {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  // Le double reproduit le RETARD : après Entrée, la boîte reste pleine à la première
  // relecture et ne se vide qu'à la suivante. Piloté par le GESTE et le compte de lectures
  // POSTÉRIEURES à l'envoi — jamais par un compteur global, qui viderait la boîte trop tôt.
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const iEnter = passes.findIndex((a) => a[1] === 'send-keys');
const promptFait = passes.some((a) => a[1] === 'prompt');
// Combien de fois a-t-on relu DEPUIS la touche d'envoi ?
const luesDepuisEnter = iEnter === -1 ? 0 : passes.slice(iEnter).filter((a) => a[1] === 'read').length;

if (cmd === 'agent read') {
  // Notre texte reste collé après le prompt ; la touche d'envoi le libère, mais SEULEMENT à
  // partir de la deuxième relecture — le terminal a mis un instant à traiter la touche.
  const reste = promptFait && (iEnter === -1 || luesDepuisEnter < 1) ? 'notre message' : '';
  process.stdout.write(['~/x', SEP, '\\u276f ' + reste, SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent prompt') { process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const { remettre } = await import('../src/herdr.js');
  // AVANT LE CORRECTIF : une seule relecture, immédiate, et le refus tombe alors que la touche
  // d'envoi avait marché. Le dirigeant reçoit « il n'a pas été soumis » sur un message soumis.
  const preuve = await remettre('w5:p8', 'notre message');
  assert.ok(preuve, 'la remise doit aboutir : la touche d’envoi a marché, il fallait laisser le temps de le voir');

  const lectures = appels(journal).filter((a) => a[1] === 'read').length;
  const enter = appels(journal).filter((a) => a[1] === 'send-keys').length;
  assert.equal(enter, 1, 'UNE SEULE touche d’envoi — on ne matraque pas la boîte');
  assert.ok(lectures >= 3, `la boîte doit être relue plusieurs fois après la touche — vu ${lectures} lectures`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE CONTRÔLE QUE LE DIRIGEANT DEMANDE — et c'est le vrai livrable (T-20260818-0049)
//
//   « Ok on doit enlever le blocage commencer et mettre un contrôle pour s'assurer que les
//     messages sont bien soumis. »
//
// Son ordre est meilleur que celui qu'on poussait. On cherchait à garder le veto en le
// doublant d'un rattrapage ; lui renverse : on ne refuse plus, et on VÉRIFIE QUE ÇA PART.
// C'est plus sûr, parce que ça s'attaque à la cause au lieu de gérer la conséquence — si
// chaque message est soumis, une boîte ne se remplit pas, et le veto n'a plus d'objet.
//
// ⚠️ ET LE CONTRÔLE PORTE SUR NOTRE PROPRE TEXTE, PAS SEULEMENT SUR CELUI D'AUTRUI. C'est la
// moitié qui a manqué à `v1.63.0` : on a appris à refuser d'écrire sur le texte d'un autre
// avant d'avoir appris à constater que le nôtre était parti.
//
// ⚠️ CE QUI N'EST PAS UNE PREUVE : `ok: true`, « la boîte était libre », le code de sortie de
// la touche d'envoi. La seule preuve admise est que LE TEXTE N'EST PLUS DANS LA BOÎTE.

test('NOTRE PROPRE TEXTE ÉCRIT ET NON SOUMIS FAIT ÉCHOUER LA REMISE — jamais un « ok » dessus', async () => {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  // La boîte était LIBRE — donc aucun veto, aucune délivrance : on écrit. Et notre texte reste,
  // quoi qu'on fasse. C'est le mode de panne que le dirigeant décrit : « ça ne part jamais ».
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\\u2500'.repeat(20);
const promptFait = passes.some((a) => a[1] === 'prompt');
if (cmd === 'agent read') {
  process.stdout.write(['~/x', SEP, '\\u276f ' + (promptFait ? 'notre message qui ne part jamais' : ''), SEP, '  auto mode on'].join('\\n'));
  process.exit(0);
}
if (cmd === 'agent get') { process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent prompt') { process.stdout.write(JSON.stringify({ result: { type: 'agent_prompted', agent: { agent_status: 'idle' } } })); process.exit(0); }
if (cmd === 'agent send-keys') { process.stdout.write(JSON.stringify({ result: { type: 'ok' } })); process.exit(0); }
process.stdout.write(JSON.stringify({ result: { ok: true } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);

  const { remettre, RemiseEchouee } = await import('../src/herdr.js');
  await assert.rejects(
    () => remettre('w5:p8', 'notre message qui ne part jamais'),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err?.name}`);
      assert.match(err.message, /pas été soumis/i, 'le refus doit dire que le message n’est PAS parti');
      return true;
    },
    'un message écrit et jamais soumis ne doit JAMAIS rendre un succès — l’émetteur croirait avoir parlé'
  );

  // ET LA TOUCHE D'ENVOI A BIEN ÉTÉ TENTÉE : on ne se contente pas de constater l'échec, on
  // essaie d'abord de le lever. Un contrôle qui ne fait que refuser laisserait le dirigeant
  // exactement où il était.
  const gestes = appels(journal).map((a) => a.slice(0, 2).join(' '));
  assert.ok(gestes.includes('agent send-keys'), 'on tente la touche d’envoi avant de renoncer');
});

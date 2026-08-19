// livrer-bin.test.js — le fichier exécutable réel (bin/livrer.js), avec un FAUX herdr en tête
// de PATH. Aucune vraie session n'est touchée.
//
// LE DOUBLE REPRODUIT CE QUI A ÉTÉ MESURÉ SUR LE VRAI SERVICE, y compris ce qu'il a de
// déroutant — c'est tout l'intérêt (motif 2 du brief de revue, huit occurrences à ce jour) :
//   • `agent read` rend du TEXTE BRUT, pas du JSON ;
//   • `agent prompt` rend un succès MÊME quand la soumission n'est pas partie ;
//   • écrire dans une boîte non vide livre UN message, les deux textes collés ;
//   • `agent send-keys … Enter` soumet ce qui est dans la boîte.
//
// Ce que le double ne peut pas prouver — qu'une VRAIE session exécute le brief — est prouvé
// contre le vrai gestionnaire par `scripts/tests/test-livraison-brief-reel.sh`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(resolve(HERE, '..'), 'bin', 'livrer.js');

let bac;
let pathOriginal;

/**
 * Faux herdr piloté par un scénario sur disque :
 *   boiteInitiale — ce que `agent read` montre au premier appel
 *   soumetSeule   — `agent prompt` soumet-il vraiment, ou laisse-t-il le texte dans la boîte ?
 *   lectureCassee — `agent read` échoue (sortie vide) : la boîte est illisible
 *   statutMuet    — `agent get` reste bloqué sur `idle` : le seul témoin restant est la boîte
 *   dejaOccupee   — la session travaillait DÉJÀ avant qu'on arrive (un autre appelant lui parle)
 *
 * ═══ CE QUE T-20260816-0114 A AJOUTÉ, ET POURQUOI CHACUN EST UN ÉTAT RÉEL ═══
 *   boiteQuiChange — le texte de la boîte BOUGE d'une lecture à l'autre : quelqu'un est devant
 *                    son clavier en train de taper. C'est le seul cas où l'on ne doit RIEN
 *                    soumettre, et sans ce scénario la garde d'immobilité serait indémontrable
 *   boiteSeLibere  — la boîte se vide d'elle-même entre deux lectures : son auteur l'a soumise.
 *                    On ne doit alors avoir envoyé AUCUNE touche
 *   enterInoperant — `agent send-keys … Enter` ne libère pas la boîte. MESURÉ comme possible sur
 *                    le vrai service (un écran de confirmation par-dessus la boîte l'avale) : la
 *                    délivrance doit alors laisser le refus d'écraser exactement où il était
 */
function installerFauxHerdr(scenario = {}) {
  const journal = join(bac, 'appels.jsonl');
  const etat = join(bac, 'scenario.json');
  writeFileSync(journal, '');
  writeFileSync(
    etat,
    JSON.stringify({
      boiteInitiale: '',
      soumetSeule: true,
      lectureCassee: false,
      statutMuet: false,
      dejaOccupee: false,
      boiteQuiChange: false,
      boiteSeLibere: false,
      enterInoperant: false,
      // Ce que la session AFFICHE au-dessus de sa boîte — un modal, un écran de démarrage.
      // Sans ce levier, aucun essai ne pourrait éprouver la garde d'écran.
      horsBoite: '',
      ...scenario,
    })
  );
  const script = `#!/usr/bin/env node
const fs = require('fs');
const JOURNAL = ${JSON.stringify(journal)};
const args = process.argv.slice(2);
const sc = JSON.parse(fs.readFileSync(${JSON.stringify(etat)}, 'utf8'));
const passes = fs.readFileSync(JOURNAL, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
fs.appendFileSync(JOURNAL, JSON.stringify(args) + '\\n');
const cmd = args.slice(0, 2).join(' ');
const SEP = '\u2500'.repeat(20);   // le VRAI filet de l'ecran, pas un tiret ASCII

const promptFait  = passes.find((a) => a[0] === 'agent' && a[1] === 'prompt');
const enterEnvoye = passes.some((a) => a[0] === 'agent' && a[1] === 'send-keys');
const lectures    = passes.filter((a) => a[0] === 'agent' && a[1] === 'read').length;
const enterUtile  = enterEnvoye && !sc.enterInoperant;

// Contenu courant de la boîte, tel que le VRAI service le montrerait.
function boite() {
  let b = sc.boiteInitiale;
  // QUELQU'UN TAPE : le texte s'allonge d'une lecture a l'autre.
  if (sc.boiteQuiChange && b) b = b + ' ' + '.'.repeat(lectures);
  // SON AUTEUR L'A SOUMISE LUI-MEME entre deux lectures.
  if (sc.boiteSeLibere && lectures >= 1) b = '';
  if (promptFait) {
    // Le vrai service COLLE le nouveau texte au reste — il ne le remplace pas.
    if (sc.soumetSeule) b = '';
    else b = b + promptFait[3];
  }
  if (enterUtile) b = '';
  return b;
}
function travaille() {
  // MESURE du 2026-08-17 sur le vrai service : soumettre le texte d'un autre par la touche
  // d'envoi vide la boite ET met le destinataire au travail — il PREND le message.
  // Le double doit le reproduire, sinon la delivrance ne pourrait jamais etre vue aboutir.
  if (enterUtile && !promptFait) return true;
  return Boolean(promptFait) && (sc.soumetSeule || enterEnvoye);
}

if (cmd === 'agent list') {
  // La commande cherche d'abord OÙ vit son destinataire — elle ne suppose plus qu'il est
  // dans sa propre session (T-20260814-0138). Ce double n'en connaît qu'une, et c'est
  // suffisant ici : les sessions multiples sont éprouvées par parler-a-un-agent.test.js.
  process.stdout.write(JSON.stringify({
    result: { agents: [{ agent: 'claude', pane_id: 'w9:p1', name: 'acme', agent_status: sc.dejaOccupee ? 'working' : ((!sc.statutMuet && travaille()) ? 'working' : 'idle') }] },
  }));
  process.exit(0);
}
if (cmd === 'agent read') {
  // TEXTE BRUT — pas de JSON. Un écran cassé ne rend rien du tout.
  if (sc.lectureCassee) { process.stdout.write(''); process.exit(0); }
  process.stdout.write(
    ['~/.gestionnaire/acme', sc.horsBoite || '', SEP, '\\u276f ' + boite(), SEP, '  auto mode on'].join('\\n')
  );
  process.exit(0);
}
if (cmd === 'agent get') {
  process.stdout.write(JSON.stringify({
    result: { type: 'agent_info', agent: { pane_id: args[2], name: 'acme', agent_status: sc.dejaOccupee ? 'working' : ((!sc.statutMuet && travaille()) ? 'working' : 'idle') } },
  }));
  process.exit(0);
}
if (cmd === 'agent prompt') {
  // LE DÉFAUT : succès rendu que la soumission soit partie ou non. Avec --wait, le vrai
  // service sait dire qu'elle a calé — mais il n'est pas toujours écouté, et il se trompe
  // parfois dans l'autre sens (un tour plus court que son échantillonnage).
  if (!sc.soumetSeule) {
    process.stdout.write(JSON.stringify({ error: { code: 'agent_prompt_stalled', message: 'no state change observed' } }));
    process.exit(1);
  }
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
  readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

function livrer(...args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], {
      stdio: 'pipe',
      env: {
        ...process.env,
        LIVRAISON_ESSAIS: '3',
        LIVRAISON_DELAI_MS: '5',
        LIVRAISON_ATTENTE_MS: '50',
        // Le temps qu'on laisse au texte coincé pour BOUGER avant de le tenir pour immobile.
        // ⚠️ CE RÉGLAGE EST CE QUI A CACHÉ LE DÉFAUT DE T-20260818-0076 PENDANT TOUT UN LOT.
        // Il rend les essais rapides — et il REMPLACE la valeur que la production utilise. Le
        // banc empruntait donc le vrai binaire avec un réglage que personne n'a jamais en
        // usage réel : 12/12 verts pendant que le poste attendait 300 secondes. Ce que le
        // réglage RÉEL produit est éprouvé plus bas, par `lancerAvecPlafond`, qui ne l'écrase
        // pas. **Un banc qui règle ce qu'il éprouve n'éprouve que son réglage.**
        LIVRAISON_IMMOBILITE_MS: '5',
        // Les sessions à interroger sont DÉSIGNÉES — la cloison refuse d'énumérer celles du
        // poste sous essais. Onze y tournent avec du travail réel, et un essai qui les balaie
        // rend un verdict qui dépend de ce qui est ouvert au moment où il tourne : la première
        // version de ce fichier a vu « onze agents répondent à w9:p1 », le faux herdr répondant
        // pour chacune (T-20260814-0138).
        HERDR_SESSIONS_ESSAIS: '/tmp/faux-herdr-livrer.sock',
      },
    }).toString();
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.status ?? 1, stdout: (err.stdout ?? '').toString(), stderr: (err.stderr ?? '').toString() };
  }
}

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'smtk-livrer-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});
after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});

test('livrer.js exige un pane et un brief', () => {
  installerFauxHerdr();
  assert.notEqual(livrer().code, 0);
  assert.notEqual(livrer('w9:p1').code, 0);
});

test('un brief vide n’est pas un brief', () => {
  installerFauxHerdr();
  const r = livrer('w9:p1', '--texte', '   ');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /vide/);
});

test('livraison nominale : la boîte était vide, la session prend le brief', () => {
  const journal = installerFauxHerdr({ boiteInitiale: '', soumetSeule: true });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  assert.equal(r.code, 0, r.stderr);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.ok, true);
  assert.equal(rendu.repare, false, 'rien à réparer quand la soumission part du premier coup');

  const a = appels(journal);
  // On REGARDE avant d'écrire — les DEUX portes : l'état de la session et sa boîte.
  const iPrompt = a.findIndex((x) => x[0] === 'agent' && x[1] === 'prompt');
  const iRead = a.findIndex((x) => x[0] === 'agent' && x[1] === 'read');
  const iGet = a.findIndex((x) => x[0] === 'agent' && x[1] === 'get');
  assert.ok(iRead !== -1 && iRead < iPrompt, 'la boîte doit être regardée AVANT qu’on y écrive');
  assert.ok(iGet !== -1 && iGet < iPrompt, 'l’état de la session doit être lu AVANT qu’on y écrive');
  assert.ok(a[iPrompt].includes('--wait'), 'l’appel nu rend un succès dans tous les cas — --wait est obligatoire');
  // Et on RELIT après : la réponse de l'outil ne fait pas foi.
  assert.ok(
    a.slice(iPrompt).some((x) => x[0] === 'agent' && x[1] === 'read'),
    'la prise du brief doit être relue, pas déduite de la réponse de l’outil'
  );
});

// Relevé en revue de passe 1 : rien n'exerçait le SECOND témoin de prise. Le statut portait
// seul tous les cas, donc le vidage de la boîte pouvait être n'importe quoi sans qu'un test
// bronche. Ici le statut reste muet sur `idle` — si la boîte vidée ne témoignait pas, la
// livraison serait déclarée non prise alors qu'elle l'est.
test('le vidage de la boîte témoigne à lui seul quand le statut reste muet', () => {
  installerFauxHerdr({ boiteInitiale: '', soumetSeule: true, statutMuet: true });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  assert.equal(r.code, 0, `la boîte vidée doit suffire à prouver la prise — stderr: ${r.stderr}`);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.statut, 'idle', 'le statut n’a effectivement jamais bougé dans ce scénario');
  assert.equal(rendu.repare, false, 'aucune réparation n’était nécessaire : le brief était bien parti');
});

test('un statut muet ET une boîte encore pleine : la commande refuse de dire « livré »', () => {
  // Les deux témoins absents en même temps. La réparation part, et si elle ne suffit pas, la
  // commande doit échouer plutôt que d'accorder le bénéfice du doute.
  const journal = installerFauxHerdr({ boiteInitiale: '', soumetSeule: false, statutMuet: true });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  const a = appels(journal);
  assert.ok(
    a.some((x) => x[0] === 'agent' && x[1] === 'send-keys'),
    'la réparation doit être tentée'
  );
  // Le double vide la boîte dès que la touche d'envoi part : la réparation aboutit ici.
  assert.equal(r.code, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).repare, true);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT MESURÉ, celui qui rend un brief faux plutôt qu’absent — ET LE TÉMOIN CENTRAL DE
// T-20260816-0114 : la délivrance ne rouvre PAS la porte de l’écrasement.
//
// La boîte est encombrée et la touche d’envoi n’a aucun effet : elle reste donc pleine du
// début à la fin. Il ne doit sortir AUCUN `agent prompt` — jamais, sous aucun prétexte.
// C’est cet essai qui rougirait si la délivrance se mettait un jour à écrire par-dessus
// « puisqu’elle a essayé de libérer ».
test('une boîte NON VIDE qu’on n’a pas su libérer fait refuser la livraison — jamais écrire par-dessus', () => {
  const journal = installerFauxHerdr({ boiteInitiale: 'reste dune livraison precedente', enterInoperant: true });
  const r = livrer('w9:p1', '--texte', 'BRIEF-REEL');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /pas vide/);
  assert.match(r.stderr, /coll/, 'le message doit dire que les deux textes seraient collés');
  assert.ok(
    !appels(journal).some((x) => x[0] === 'agent' && x[1] === 'prompt'),
    'rien ne doit être écrit dans une boîte qui n’est pas vide'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260816-0114 — LA DÉLIVRANCE : le blocage doit FINIR, et sans écraser personne.
//
// Rappel du défaut : une boîte laissée pleine affame TOUS les émetteurs suivants, et seul le
// destinataire pouvait la libérer — alors qu’il est le seul à ne pas savoir qu’elle bloque.
// Trois occurrences sur trois blocages mesurés, et une fois sur trois l’auteur du texte coincé
// était DÉJÀ MORT : personne, jamais, n’allait le soumettre.

test('un texte coincé IMMOBILE est soumis — on finit le geste de son auteur, on ne l’écrase pas', () => {
  const journal = installerFauxHerdr({ boiteInitiale: 'compte rendu dun emetteur qui est mort depuis' });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu a moi');
  assert.equal(r.code, 0, `la boîte devait être délivrée puis la livraison aboutir — stderr: ${r.stderr}`);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.delivre, true, 'la commande doit DIRE qu’elle a délivré une boîte bloquée');

  const a = appels(journal);
  const iEnter = a.findIndex((x) => x[0] === 'agent' && x[1] === 'send-keys');
  const iPrompt = a.findIndex((x) => x[0] === 'agent' && x[1] === 'prompt');
  assert.ok(iEnter !== -1, 'la touche d’envoi doit partir : c’est le seul geste qui libère');
  assert.deepEqual(a[iEnter], ['agent', 'send-keys', 'w9:p1', 'Enter'], 'on soumet, on n’écrit pas un caractère');
  assert.ok(iPrompt !== -1 && iEnter < iPrompt, 'on ne livre qu’APRÈS avoir libéré la boîte');
  // ⚠️ ET LE TEXTE COINCÉ N’EST JAMAIS RÉÉCRIT NI COMPLÉTÉ — le seul geste posé dessus est Enter.
  assert.ok(
    !a.some((x) => x[0] === 'agent' && x[1] === 'send-text'),
    'on ne tape jamais à la place de quelqu’un — soumettre n’est pas écrire'
  );
});

test('le destinataire APPREND que sa boîte avait bloqué — l’avis voyage avec le message livré', () => {
  const journal = installerFauxHerdr({ boiteInitiale: 'un texte reste en plan' });
  const r = livrer('w9:p1', '--texte', 'MON-MESSAGE-A-MOI');
  assert.equal(r.code, 0, r.stderr);
  const prompt = appels(journal).find((x) => x[0] === 'agent' && x[1] === 'prompt');
  assert.ok(prompt, 'le message doit bien être livré');
  assert.match(prompt[3], /MON-MESSAGE-A-MOI/, 'le message de l’émetteur part en entier');
  assert.match(prompt[3], /bo[iî]te/i, 'et il est précédé d’un avis qui dit que sa boîte bloquait');
  assert.match(prompt[3], /soumis/i, 'l’avis dit ce qui a été fait du texte trouvé');
});

test('une livraison ORDINAIRE ne porte aucun avis — on n’annonce que ce qui est arrivé', () => {
  const journal = installerFauxHerdr({ boiteInitiale: '' });
  const r = livrer('w9:p1', '--texte', 'MON-MESSAGE-A-MOI');
  assert.equal(r.code, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).delivre, false, 'rien n’a été délivré : il n’y avait rien à délivrer');
  const prompt = appels(journal).find((x) => x[0] === 'agent' && x[1] === 'prompt');
  assert.equal(prompt[3], 'MON-MESSAGE-A-MOI', 'le message part tel quel, sans un mot ajouté');
});

test('un texte qui BOUGE n’est JAMAIS soumis — quelqu’un est devant son clavier', () => {
  const journal = installerFauxHerdr({ boiteInitiale: 'je suis en train de taper', boiteQuiChange: true });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu');
  assert.notEqual(r.code, 0, 'on refuse plutôt que de soumettre la phrase inachevée de quelqu’un');
  // ⚠️ LE MOTIF EST CHOISI POUR NE PAS EXISTER DANS LE REFUS ORDINAIRE. Écrit d’abord avec
  // « tape », cet essai passait AVANT le correctif : le vieux refus dit déjà « taper à sa
  // place ». Un essai qu’un vocabulaire voisin rend vert ne prouve pas le comportement neuf.
  assert.match(r.stderr, /a boug[ée]/i, 'le refus doit dire que le texte A BOUGÉ — c’est la raison de ne rien soumettre');
  const a = appels(journal);
  assert.ok(!a.some((x) => x[0] === 'agent' && x[1] === 'send-keys'), 'aucune touche envoyée sur un texte vivant');
  assert.ok(!a.some((x) => x[0] === 'agent' && x[1] === 'prompt'), 'et rien n’est écrit par-dessus');
});

test('une boîte que son auteur libère TOUT SEUL pendant l’attente : on livre sans avoir rien soumis', () => {
  const journal = installerFauxHerdr({ boiteInitiale: 'son auteur va le soumettre', boiteSeLibere: true });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu');
  assert.equal(r.code, 0, `la boîte s’est libérée d’elle-même — stderr: ${r.stderr}`);
  assert.equal(JSON.parse(r.stdout).delivre, false, 'on n’a rien délivré : personne n’avait besoin de nous');
  const a = appels(journal);
  assert.ok(!a.some((x) => x[0] === 'agent' && x[1] === 'send-keys'), 'aucune touche envoyée : le texte est parti seul');
});

test('une délivrance SANS EFFET laisse le refus exactement où il était, et le dit', () => {
  const journal = installerFauxHerdr({ boiteInitiale: 'un texte que rien ne deloge', enterInoperant: true });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /pas vide/, 'le refus d’origine est rendu intact');
  // ⚠️ MÊME PIÈGE QUE PLUS HAUT : le vieux refus contient déjà le mot « soumettre ». Le motif
  // doit porter sur le FAIT NEUF — qu’on a essayé, et que ça n’a rien libéré.
  assert.match(
    r.stderr,
    /sans effet|n’a rien lib[ée]r[ée]|na rien lib/i,
    'il dit que la soumission a été TENTÉE et n’a rien libéré — sinon on la retente à l’aveugle'
  );
  assert.ok(
    !appels(journal).some((x) => x[0] === 'agent' && x[1] === 'prompt'),
    'une tentative de délivrance ne donne AUCUN droit d’écrire par-dessus'
  );
});

test('une boîte ILLISIBLE n’est jamais délivrée — on ne soumet pas ce qu’on ne voit pas', () => {
  const journal = installerFauxHerdr({ lectureCassee: true });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu');
  assert.notEqual(r.code, 0);
  assert.ok(
    !appels(journal).some((x) => x[0] === 'agent' && x[1] === 'send-keys'),
    'soumettre un texte qu’on n’a pas lu serait soumettre n’importe quoi'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE LA REVUE DE FOND A TROUVÉ, ET C'ÉTAIT UN BLOQUANT JUSTE.
//
// La touche d'envoi ne « soumet un texte » que si ce qu'on regarde est bien une boîte de
// saisie. Devant un DIALOGUE DE CHOIX — « veux-tu que j'exécute cette commande ? » — la même
// touche CONFIRME L'OPTION PAR DÉFAUT. Le défaut change alors de nature : ce n'est plus un
// message corrompu, c'est une action approuvée à l'insu de celui devant qui elle s'affiche.
//
// ⚠️ NON ÉTABLI, ET C'EST POUR ÇA QUE LA GARDE EST LARGE : je n'ai pas su reproduire un vrai
// dialogue de permission Claude Code (mesuré le 2026-08-17 — le sélecteur `/model` rend une
// boîte ILLISIBLE, donc protégée par accident, et le mode auto ne demande rien). Ne pas savoir
// reproduire un danger n'est pas la preuve qu'il n'existe pas — c'est le premier piège nommé
// dans le brief de ce lot. On s'abstient donc dans le doute, puisque le geste est irréversible.

test('un DIALOGUE DE CHOIX n’est jamais « soumis » — la touche d’envoi y confirmerait une action', () => {
  const journal = installerFauxHerdr({
    boiteInitiale: '1. Yes, and don’t ask again\n  2. No, tell Claude what to do differently\n  Enter to confirm · Esc to cancel',
  });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu');
  assert.notEqual(r.code, 0, 'on refuse : ce n’est pas un message en souffrance');
  assert.match(r.stderr, /choix|confirm/i, 'et le refus dit ce qu’il a cru voir');
  const a = appels(journal);
  assert.ok(!a.some((x) => x[0] === 'agent' && x[1] === 'send-keys'), 'AUCUNE touche sur un dialogue');
  assert.ok(!a.some((x) => x[0] === 'agent' && x[1] === 'prompt'), 'et rien n’est écrit par-dessus');
});

test('un ÉCRAN CONNU par-dessus la boîte n’est jamais délivré — on ne tente pas sa chance', () => {
  // La sonde de `ligne-directe/src/ecran.js` reconnaît cet écran. `contenuBoite` peut fort bien
  // trouver une boîte en dessous : la garde doit porter sur l'ÉCRAN, pas seulement sur la boîte.
  const journal = installerFauxHerdr({
    boiteInitiale: 'un texte quelconque',
    horsBoite: 'Is this a project you created or one you trust?',
  });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu');
  assert.notEqual(r.code, 0);
  const a = appels(journal);
  assert.ok(!a.some((x) => x[0] === 'agent' && x[1] === 'send-keys'), 'aucune touche devant un écran connu');
  assert.ok(!a.some((x) => x[0] === 'agent' && x[1] === 'prompt'));
});

// ═══ CE QUE L'ORCHESTRATEUR A AJOUTÉ EN APPROUVANT LA CONCEPTION (2026-08-17) ═══
//
// « Ton garde d'immobilité couvre EN TRAIN DE TAPER ; il ne couvre PAS a tapé la moitié puis
// est parti. » Deux exigences en découlent, et les deux sont éprouvées ici.

test('l’avis porte CE QUI A ÉTÉ SOUMIS EN ENTIER — un incident constatable, pas inexplicable', () => {
  // Sans le texte, le destinataire voit un travail partir de chez lui sans pouvoir dire lequel.
  const coince =
    'reprends le dossier Belanger et refais la ventilation des heures du mois dernier en ' +
    'repartissant les surplus sur les trois chantiers ouverts, puis previens le controleur';
  assert.ok(coince.length > 120, 'le texte d’essai doit dépasser tout aperçu tronqué');
  const journal = installerFauxHerdr({ boiteInitiale: coince });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu');
  assert.equal(r.code, 0, r.stderr);
  const prompt = appels(journal).find((x) => x[0] === 'agent' && x[1] === 'prompt');
  assert.ok(
    prompt[3].includes(coince),
    'l’avis doit porter le texte soumis EN ENTIER — un aperçu tronqué ne permet pas de dire lequel c’était'
  );
});

// ═══ LE BUDGET DE TEMPS DU CHEMIN RÉEL — CE QUE LE BANC PRÉCÉDENT NE POUVAIT PAS VOIR ═══
//
// ⚠️ T-20260818-0076. Le lot d'avant rendait 12/12, 582 essais, huit mutations sans survivante,
// et le poste mettait CINQ MINUTES à délivrer une boîte pour laquelle le critère du jalon en
// demande moins de quinze secondes. L'écart n'était pas dans le code éprouvé : il était dans
// `LIVRAISON_IMMOBILITE_MS: '5'` ci-dessus, que tous les essais posaient. Le banc passait par
// le vrai binaire, avec la vraie boucle, sur le vrai faux-herdr — et remplaçait précisément la
// grandeur qui était fausse.
//
// Les deux essais qui suivent lancent donc le binaire SANS ce réglage. C'est la seule façon de
// mesurer ce qu'un appelant obtient vraiment.

// La fenêtre que le binaire applique à un texte TAPÉ, lue là où elle est décidée — jamais
// recopiée : un nombre écrit ici à la main cesserait de suivre le code au premier réglage.
const { FENETRE_ENTRE_AGENTS_MS: FENETRE_ATTENDUE_MS } = await import('../src/livraison.js');

/** Lancer le vrai binaire avec le réglage RÉEL de la fenêtre, et le tuer s'il dépasse. */
function lancerAvecPlafond(args, { plafondMs, env = {} }) {
  const debut = Date.now();
  const fils = spawnSync(process.execPath, [BIN, ...args], {
    stdio: 'pipe',
    timeout: plafondMs,
    killSignal: 'SIGKILL',
    env: {
      ...process.env,
      LIVRAISON_ESSAIS: '3',
      LIVRAISON_DELAI_MS: '5',
      LIVRAISON_ATTENTE_MS: '50',
      // ⚠️ `LIVRAISON_IMMOBILITE_MS` EST DÉLIBÉRÉMENT ABSENT — c'est tout l'objet de ces essais.
      HERDR_SESSIONS_ESSAIS: '/tmp/faux-herdr-livrer.sock',
      ...env,
    },
  });
  return {
    dureeMs: Date.now() - debut,
    tue: fils.error?.code === 'ETIMEDOUT' || fils.signal === 'SIGKILL',
    // ⚠️ UN PROCESSUS TUÉ N'A PAS DE CODE DE SORTIE — le rendre `0` par défaut ferait passer
    // pour un succès exactement le cas qu'on cherche à attraper.
    code: fils.status === null ? 1 : fils.status,
    stdout: (fils.stdout ?? '').toString(),
    stderr: (fils.stderr ?? '').toString(),
  };
}

test('un COLLAGE immobile est délivré tout de suite — le critère du jalon est de 15 s, le poste en faisait 300', () => {
  // ⚠️ LE CAS EXACT MESURÉ SUR LE POSTE le 2026-08-18 : une boîte portant `[Pasted text #33]`,
  // destinataire au repos, texte identique sur sept relevés. Cinq minutes d'attente avant le
  // geste — pour un texte devant lequel il n'y a, par construction, personne à attendre : un
  // collage est arrivé d'un seul coup.
  const journal = installerFauxHerdr({ boiteInitiale: '[Pasted text #33 +12 lines]' });
  const r = lancerAvecPlafond(['w9:p1', '--texte', 'mon compte rendu'], { plafondMs: 25000 });
  assert.ok(!r.tue, `le binaire a dépassé son plafond — il attendait encore après ${r.dureeMs} ms`);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(
    r.dureeMs < 15000,
    `le critère du jalon exige moins de 15 s de bout en bout — mesuré ${Math.round(r.dureeMs / 1000)} s`
  );
  // ⚠️ ET IL NE SUFFIT PAS DE TENIR DANS LE BUDGET : une mutation qui rendait la fenêtre du
  // texte tapé à `delivrerLaBoite` devant un COLLAGE a survécu à la seule borne de 15 s — six
  // secondes y tiennent aussi. Ce qui est éprouvé ici est que la fenêtre n'a PAS ÉTÉ ATTENDUE,
  // parce que devant un collage il n'y a rien à attendre.
  assert.ok(
    r.dureeMs < FENETRE_ATTENDUE_MS,
    `devant un collage, aucune fenêtre ne doit être observée — mesuré ${r.dureeMs} ms, ` +
      `soit au moins la fenêtre du texte tapé (${FENETRE_ATTENDUE_MS} ms)`
  );
  // ET LE GESTE A BIEN EU LIEU — sans ça, « rapide » voudrait seulement dire « n'a rien fait ».
  assert.ok(
    appels(journal).some((x) => x[0] === 'agent' && x[1] === 'send-keys'),
    'la touche d’envoi doit être partie : une délivrance rapide qui ne délivre pas n’est pas une délivrance'
  );
  assert.match(r.stdout, /"delivre":true/);
});

test('devant un COLLAGE, l’avis livré ne raconte pas une observation qui n’a pas eu lieu', () => {
  // ⚠️ CETTE GARDE VIENT D'UNE MUTATION SURVIVANTE. Repasser `immobiliteMs` au lieu de la
  // fenêtre réellement appliquée laissait tous les essais verts — et faisait dire à l'avis
  // « resté immobile pendant les 6 s où je l'ai observée » devant un texte qu'on n'a PAS
  // observé une seconde. Le destinataire à qui on vient de soumettre un texte en son nom
  // recevrait un compte rendu faux de ce qu'on a fait.
  const journal = installerFauxHerdr({ boiteInitiale: '[Pasted text #33 +12 lines]' });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu');
  assert.equal(r.code, 0, r.stderr);
  const prompt = appels(journal).find((x) => x[0] === 'agent' && x[1] === 'prompt');
  assert.ok(prompt, 'le message doit avoir été livré');
  assert.ok(
    !/où je l’ai observée/.test(prompt[3]),
    `aucune durée d’observation devant un collage — reçu : ${prompt[3].slice(0, 220)}`
  );
  assert.ok(
    /collé|d’un seul coup/i.test(prompt[3]),
    `l’avis doit dire POURQUOI il n’a pas observé — reçu : ${prompt[3].slice(0, 220)}`
  );
});

test('devant un COLLAGE, un refus ne prétend pas non plus avoir attendu', () => {
  // Même racine, autre sortie : quand la touche d'envoi reste sans effet, le refus explique ce
  // qu'on a tenté. Il citait la fenêtre de l'appelant, pas celle qu'on a réellement observée —
  // « après 6 s d'immobilité » devant un collage qu'on n'a pas regardé.
  installerFauxHerdr({ boiteInitiale: '[Pasted text #33 +12 lines]', enterInoperant: true });
  const r = livrer('w9:p1', '--texte', 'mon compte rendu');
  assert.notEqual(r.code, 0);
  assert.ok(
    !/après \d+ s d’immobilité/.test(r.stderr),
    `le refus ne doit pas chiffrer une attente qui n’a pas eu lieu — reçu : ${r.stderr.slice(0, 260)}`
  );
});

test('un texte TAPÉ immobile est délivré sous le budget du critère — sa fenêtre reste observée', () => {
  // ⚠️ CELUI-CI GARDE L'AUTRE MOITIÉ. Un texte tapé peut avoir des doigts dessus : on l'observe
  // vraiment, et cette attente-là est le prix d'un geste irréversible. Ce qui est éprouvé ici
  // n'est pas qu'elle soit nulle — c'est qu'elle TIENNE DANS LE BUDGET annoncé. Cinq minutes n'y
  // tenaient pas, et personne ne s'en apercevait parce que tous les essais la remplaçaient.
  const journal = installerFauxHerdr({ boiteInitiale: 'un compte rendu que son auteur n’a pas soumis' });
  const r = lancerAvecPlafond(['w9:p1', '--texte', 'mon compte rendu'], { plafondMs: 25000 });
  assert.ok(!r.tue, `le binaire a dépassé son plafond — il attendait encore après ${r.dureeMs} ms`);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(
    r.dureeMs < 15000,
    `le critère du jalon exige moins de 15 s de bout en bout — mesuré ${Math.round(r.dureeMs / 1000)} s`
  );
  // ⚠️ ET LA BORNE BASSE, QUI EST CELLE QUI GARDE VRAIMENT (relevé en REVUE DE FOND, bloquant,
  // et le rejet était juste). Sans elle, ces essais ne vérifiaient qu'un PLAFOND : une mutation
  // qui plafonnait l'attente réelle à 50 ms — `dormir(Math.min(immobiliteMs, 50))` dans
  // `delivrerLaBoite` — laissait **62 essais sur 62 verts**. C'est-à-dire qu'on pouvait
  // DÉSARMER l'observation du texte tapé, donc soumettre le brouillon de quelqu'un pendant
  // qu'il l'écrit, sans qu'un seul essai de ce paquet ne rougisse.
  //
  // Une attente ne peut pas être plus COURTE que ce qu'on a demandé : cette borne ne mesure
  // donc pas la machine, elle mesure que le geste a bien attendu avant d'agir.
  assert.ok(
    r.dureeMs >= FENETRE_ATTENDUE_MS,
    `un texte TAPÉ doit être OBSERVÉ avant d’être soumis — mesuré ${r.dureeMs} ms, ` +
      `soit moins que la fenêtre annoncée (${FENETRE_ATTENDUE_MS} ms) : l’attente n’a pas eu lieu`
  );
  // ⚠️ ET LA BORNE HAUTE SE PREND SUR LA FENÊTRE LUE, PAS SUR LE BUDGET DU JALON. Une mutation
  // survivante l'a montré : faire lire au binaire dix secondes au lieu de six tenait dans les
  // quinze secondes du critère **ici**, parce que le reste du chemin coûte une fraction de
  // seconde au banc — là où il en coûte jusqu'à 4,3 s sur le poste. Le budget aurait donc été
  // dépassé en usage réel sans qu'un seul essai ne rougisse. **Un banc plus rapide que le poste
  // rend une marge qui n'existe pas.** On vérifie donc que le binaire a lu SA fenêtre, en
  // mesurant qu'il n'a pas attendu sensiblement plus.
  assert.ok(
    r.dureeMs < FENETRE_ATTENDUE_MS + 4000,
    `le binaire doit observer SA fenêtre (${FENETRE_ATTENDUE_MS} ms) — mesuré ${r.dureeMs} ms, ` +
      `soit une attente qui n’est pas la sienne`
  );
  assert.ok(
    appels(journal).some((x) => x[0] === 'agent' && x[1] === 'send-keys'),
    'la touche d’envoi doit être partie'
  );
});

test('la fenêtre du texte tapé n’est ni nulle ni hors budget — ce que le défaut doit valoir, et pourquoi', async () => {
  // ⚠️ CET ESSAI PORTE UNE EXIGENCE, pas une implémentation, et elle a DEUX bords.
  //
  // Il gardait auparavant « au moins cinq minutes », au nom de « a tapé la moitié puis est
  // parti » — l'exigence posée par l'orchestrateur en approuvant la conception. Elle reste
  // vraie sur son bord, et elle est désormais tenue par ce que `delivrerLaBoite` RELIT avant
  // de soumettre (texte qui a bougé, dialogue, écran illisible), pas par la seule longueur de
  // l'attente. Le second bord est arrivé avec le critère du jalon : une attente qui dépasse le
  // budget annoncé fait conclure à une panne, et l'émetteur a raison de le conclure.
  //
  // La garde porte donc les deux : la fenêtre observe (elle n'est pas nulle) et elle tient dans
  // le budget (elle laisse de la place au reste du chemin).
  const { FENETRE_ENTRE_AGENTS_MS: FENETRE_TEXTE_TAPE_MS, fenetreDImmobilite } = await import('../src/livraison.js');
  assert.ok(FENETRE_TEXTE_TAPE_MS > 0, 'une fenêtre nulle sur un texte tapé n’observe plus rien');
  // ⚠️ LA BORNE LAISSE AU RESTE DU CHEMIN LE DOUBLE DE SON PIRE COÛT MESURÉ. Relire l'écran,
  // livrer, constater la prise ont coûté 2,4 s puis 4,3 s sur le même poste à trente secondes
  // d'intervalle — ça dépend de sa charge. Une fenêtre qui remplit le budget à 5 % près rendrait
  // le critère vert ou rouge selon ce qui tourne à côté.
  assert.ok(
    FENETRE_TEXTE_TAPE_MS <= 7000,
    `le critère du jalon est de 15 s de bout en bout, et le reste du chemin en coûte jusqu’à 4,3 s ` +
      `— une fenêtre de ${FENETRE_TEXTE_TAPE_MS} ms ne laisse pas de marge`
  );
  // ET LA RÈGLE QUI DÉCIDE : le COLLAGE n'a rien à observer, le TAPÉ garde sa fenêtre.
  assert.equal(fenetreDImmobilite('[Pasted text #33]', { texteTapeMs: FENETRE_TEXTE_TAPE_MS }), 0);
  assert.equal(fenetreDImmobilite('[Pasted text #137 +19 lines]', { texteTapeMs: FENETRE_TEXTE_TAPE_MS }), 0);
  assert.equal(
    fenetreDImmobilite('une phrase que quelqu’un est en train de taper', { texteTapeMs: FENETRE_TEXTE_TAPE_MS }),
    FENETRE_TEXTE_TAPE_MS
  );
  // ⚠️ UN TEXTE QUI *MENTIONNE* UN COLLAGE EST UN TEXTE LISIBLE — le confondre avec un repli
  // ferait sauter la fenêtre sur du texte réellement tapé.
  assert.equal(
    fenetreDImmobilite('je te renvoie le [Pasted text #6] que tu m’as passé', {
      texteTapeMs: FENETRE_TEXTE_TAPE_MS,
    }),
    FENETRE_TEXTE_TAPE_MS
  );
});

test('le brief de NAISSANCE ne délivre pas — une session qui vient de naître n’a rien à soumettre', () => {
  // `--en-attente` est la garde du brief de naissance : la session attend, et si sa boîte porte
  // quelque chose, ce n'est pas un compte rendu en souffrance — c'est un état qu'on ne sait pas
  // expliquer. On ne pose pas un geste irréversible dessus.
  const journal = installerFauxHerdr({ boiteInitiale: 'quelque chose dinattendu' });
  const r = livrer('w9:p1', '--texte', 'ton brief de naissance', '--en-attente');
  assert.notEqual(r.code, 0);
  assert.ok(
    !appels(journal).some((x) => x[0] === 'agent' && x[1] === 'send-keys'),
    'aucune touche envoyée sur la boîte d’une session qu’on brieffe à sa naissance'
  );
});

test('une session qui travaille DÉJÀ fait refuser la livraison — rien n’est écrit', () => {
  // Un autre appelant lui parle en ce moment. Écrire maintenant serait déclaré « livré » par
  // le seul fait qu'elle travaille — un témoin vrai avant même qu'on ait écrit.
  const journal = installerFauxHerdr({ dejaOccupee: true });
  // ⚠️ `--en-attente` — CE REFUS EST DEVENU CELUI DU BRIEF DE NAISSANCE (T-20260814-0138).
  // Il reste juste pour une session qui vient de naître, où « elle a quitté l'attente » EST la
  // preuve de prise. Il ne peut plus être le défaut : un pair est occupé la plupart du temps,
  // et l'exiger revenait à n'avoir aucune voie vérifiée pour parler à un agent vivant.
  const r = livrer('w9:p1', '--texte', 'BRIEF-REEL', '--en-attente');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /working/);
  assert.ok(
    !appels(journal).some((x) => x[0] === 'agent' && x[1] === 'prompt'),
    'rien ne doit être écrit dans une session déjà occupée'
  );
});

test('une boîte ILLISIBLE fait refuser la livraison — on ne livre pas à l’aveugle', () => {
  const journal = installerFauxHerdr({ lectureCassee: true });
  const r = livrer('w9:p1', '--texte', 'BRIEF-REEL');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /illisible/);
  assert.ok(!appels(journal).some((x) => x[0] === 'agent' && x[1] === 'prompt'));
});

// LE DÉFAUT DU TICKET : la soumission ne part pas, l’outil dit quand même « livré ».
test('quand la soumission ne part pas, la commande le VOIT, répare, et ne ment pas', () => {
  const journal = installerFauxHerdr({ boiteInitiale: '', soumetSeule: false });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  assert.equal(r.code, 0, `la réparation doit aboutir — stderr: ${r.stderr}`);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.repare, true, 'la commande doit dire qu’elle a dû réparer');
  assert.equal(rendu.attendu, false, 'et que herdr avait signalé le calage');

  const a = appels(journal);
  const envois = a.filter((x) => x[0] === 'agent' && x[1] === 'send-keys');
  assert.equal(envois.length, 1, 'on répare UNE fois, pas en boucle');
  assert.deepEqual(envois[0], ['agent', 'send-keys', 'w9:p1', 'Enter']);
  const prompts = a.filter((x) => x[0] === 'agent' && x[1] === 'prompt');
  assert.equal(prompts.length, 1, 'le brief n’est JAMAIS réécrit — il se collerait à lui-même');
});

test('un brief se lit depuis un fichier, d’un seul tenant', () => {
  installerFauxHerdr();
  const f = join(bac, 'brief.md');
  writeFileSync(f, '# Ton mandat\n\nDeux lignes, et un retour à la ligne au milieu.\n');
  const r = livrer('w9:p1', '--brief', f);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(JSON.parse(r.stdout).caracteres > 40, 'le brief entier doit partir, pas sa première ligne');
});

test('un fichier de brief absent fait échouer la commande avant tout appel à herdr', () => {
  const journal = installerFauxHerdr();
  const r = livrer('w9:p1', '--brief', join(bac, 'nexiste-pas.md'));
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /illisible/);
  assert.equal(appels(journal).length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA SECONDE PORTE — le motif doit survivre au passage par le BIN (T-20260818-0031, critère 3).
//
// `src/livraison.js` peut très bien calculer une cause que `bin/livrer.js` ne recopie pas dans
// son JSON : l'appelant — un agent, un orchestrateur, un script — lit alors le même
// `{"ok":true,…,"repare":false}` muet qu'avant, sur un code pourtant « corrigé ». C'est
// « une porte sur deux », le motif le plus cher de ce dépôt, et il a déjà été commis DEUX fois
// dans le correctif d'un défaut qu'il servait à fermer.
//
// Les essais unitaires de `un-repare-faux-dit-pourquoi.test.js` gardent la première porte ;
// ceux-ci gardent la seconde, contre le vrai exécutable, en lisant ce que l'appelant lit
// VRAIMENT : la sortie standard.

test('le JSON du bin porte le motif du `repare: false` — sinon l’appelant lit le même champ muet', () => {
  // Le cas exact mesuré le 2026-08-18 : la livraison passe, rien n'est réparé, et personne ne
  // sait si c'était inutile ou empêché.
  installerFauxHerdr({ boiteInitiale: '', soumetSeule: true });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  assert.equal(r.code, 0, r.stderr);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.repare, false);
  assert.equal(rendu.causeRepare, 'inutile', 'le motif doit traverser le bin, pas mourir dedans');
  assert.equal(rendu.delivre, false);
  assert.equal(rendu.causeDelivre, 'non-tentee', 'et `delivre` a droit au même traitement');
});

test('le motif que le bin rend SUIT le chemin réellement pris — il n’est pas écrit en dur', () => {
  // Même binaire, autre scénario : la soumission cale, la réparation part et aboutit. Si le bin
  // recopiait une valeur fixe, cet essai et le précédent ne pourraient pas être verts ensemble.
  installerFauxHerdr({ boiteInitiale: '', soumetSeule: false, statutMuet: true });
  const r = livrer('w9:p1', '--texte', 'voici ton brief');
  assert.equal(r.code, 0, r.stderr);
  const rendu = JSON.parse(r.stdout);
  assert.equal(rendu.repare, true, 'la réparation a bien mordu dans ce scénario');
  assert.equal(rendu.causeRepare, 'soumise', 'et le motif doit avoir changé avec le chemin');
});

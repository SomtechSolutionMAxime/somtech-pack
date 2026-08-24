// metier-garde-ecriture.test.js — la garde qui laisse passer UN fichier, et un seul.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QU'ELLE FERME, ET CELUI QU'ELLE POURRAIT OUVRIR
//
// Fermé : `permissions.deny` listait `Write` et `Edit` — des outils NUS, qui
// refusent partout, quel que soit le chemin. `CONTEXTE.md` était donc fermé à
// celui-là même qui l'apprend en travaillant. Le seul qui sait ne pouvait pas
// écrire (T-20260824-0002).
//
// Ouvert, si personne ne le garde : depuis que les outils nus ont quitté le
// refus, PLUS RIEN d'autre que cette garde n'empêche un orchestrateur d'écrire
// un livrable. Le motif du refus — « qu'il code » — repose entièrement sur elle.
// C'est pourquoi ces tests éprouvent les DEUX polarités, cas par cas : ce qui
// doit passer, et ce qui doit être refusé.
//
// ⚠️ LE TEST QUI GARDE LA MESURE. Mesuré sur Claude Code 2.1.241 le 2026-08-24 :
// quand un chemin tombe sous un `permissions.deny`, **le hook n'est jamais
// appelé** — trace à zéro ligne. Un `Write` ou un `Edit` qui reviendrait dans le
// refus ne rendrait donc pas cette garde « redondante » : il la rendrait MUETTE,
// et `CONTEXTE.md` redeviendrait inaccessible sans qu'aucun autre test ne bouge.
// C'est le contrôle `le refus ne porte plus aucun outil d'édition nu` ci-dessous.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { juger, FICHIER_PERMIS } from '../src/metier/gardes/ecriture.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Le lieu d'un orchestrateur : le répertoire où sa session est née. */
const LIEU = '/Users/x/GitRepo.nosync/un-depot/.orchestrateur/batiscan';

const decision = (outil, chemin, opts = {}) => juger({ outil, chemin, lieu: LIEU, ...opts }).decision;
const passe = (outil, chemin, opts) => decision(outil, chemin, opts) === 'allow';
const refuse = (outil, chemin, opts) => decision(outil, chemin, opts) === 'deny';

// ═════════════════════ 1. les huit cas du brief, un par un

// ── Write, les quatre cas

test('Write · son propre CONTEXTE.md PASSE — c est la fonction meme du lot', () => {
  assert.ok(passe('Write', join(LIEU, FICHIER_PERMIS)), 'le chemin absolu de sa propre mémoire');
  assert.ok(passe('Write', FICHIER_PERMIS), 'et le même, écrit relativement depuis son lieu');
});

test('Write · son CLAUDE.md est REFUSÉ — le pack le remplace en entier a chaque mise a jour', () => {
  assert.ok(refuse('Write', join(LIEU, 'CLAUDE.md')));
  assert.ok(refuse('Write', 'CLAUDE.md'));
});

test('Write · les chapitres de son métier sont REFUSÉS — ils sont rendus, pas écrits', () => {
  assert.ok(refuse('Write', join(LIEU, 'metier', 'chapitres', 'reflexes.md')));
  assert.ok(refuse('Write', 'metier/chapitres/anti-patterns.md'));
});

test('Write · hors de son lieu, tout est REFUSÉ — y compris un CONTEXTE.md qui n est pas le sien', () => {
  assert.ok(refuse('Write', '/Users/x/GitRepo.nosync/un-depot/src/app.ts'), 'du livrable');
  assert.ok(refuse('Write', '/Users/x/GitRepo.nosync/autre-depot/f.md'), 'un autre dépôt');
  // ⚠️ Le cas qui distingue « le fichier permis » de « un fichier qui porte son nom ».
  assert.ok(refuse('Write', '/Users/x/GitRepo.nosync/un-depot/.orchestrateur/mitis/CONTEXTE.md'),
    'le CONTEXTE.md d un PAIR — même nom, autre lieu, et il ne lui appartient pas');
  assert.ok(refuse('Write', `../mitis/${FICHIER_PERMIS}`),
    'et par « .. », qui est la façon de sortir du lieu en ayant l air d y rester');
});

// ── Edit, les quatre mêmes — c est une entrée DISTINCTE de Write

test('Edit · son propre CONTEXTE.md PASSE', () => {
  assert.ok(passe('Edit', join(LIEU, FICHIER_PERMIS)));
  assert.ok(passe('Edit', FICHIER_PERMIS));
});

test('Edit · son CLAUDE.md est REFUSÉ', () => {
  assert.ok(refuse('Edit', join(LIEU, 'CLAUDE.md')));
});

test('Edit · les chapitres de son métier sont REFUSÉS', () => {
  assert.ok(refuse('Edit', join(LIEU, 'metier', 'chapitres', 'outils.md')));
});

test('Edit · hors de son lieu, tout est REFUSÉ', () => {
  assert.ok(refuse('Edit', '/Users/x/GitRepo.nosync/un-depot/README.md'));
  assert.ok(refuse('Edit', '/etc/hosts'));
});

// ═════════════════════ 2. l exception ne s élargit pas d elle-même

test('un fichier qui RESSEMBLE au fichier permis ne passe pas', () => {
  for (const c of ['CONTEXTE.md.bak', 'mon-CONTEXTE.md', 'contexte.md', 'CONTEXTE.MD',
                   'sous/CONTEXTE.md', 'metier/CONTEXTE.md']) {
    assert.ok(refuse('Write', c), `« ${c} » n est pas le CONTEXTE.md à la racine du lieu`);
  }
});

test('NotebookEdit ne tient pas le fichier permis — un carnet n est pas un document', () => {
  assert.ok(refuse('NotebookEdit', join(LIEU, FICHIER_PERMIS)));
  assert.ok(refuse('NotebookEdit', join(LIEU, 'carnet.ipynb')));
});

// ═════════════════════ 3. la polarité — ce qu elle fait quand elle ne sait pas

test('🔴 elle REFUSE quand elle ne sait pas — ici un « oui » de repli ouvrirait tout', () => {
  // La garde du terminal peut rendre « allow » sur ce qu elle ne garde pas : là,
  // « allow » laisse les choses en l état. ICI, plus rien d autre ne refuse
  // l écriture — un « allow » par défaut la rendrait décorative.
  assert.ok(refuse('Write', join(LIEU, FICHIER_PERMIS), { role: 'un-role-inconnu' }), 'un rôle qu elle ne garde pas');
  assert.ok(refuse('Write', ''), 'aucun chemin à juger');
  assert.ok(refuse('Write', join(LIEU, FICHIER_PERMIS), { lieu: undefined }), 'aucun lieu où se situer');
  assert.ok(refuse('Write', join(LIEU, FICHIER_PERMIS), { lieu: 'pas/absolu' }), 'un lieu qui n est pas un chemin absolu');
  assert.ok(refuse(undefined, join(LIEU, FICHIER_PERMIS)), 'aucun outil');
  assert.ok(refuse('Bash', join(LIEU, FICHIER_PERMIS)), 'un outil qu elle ne sait pas juger');
});

test('un outil inconnu est refusé POUR LA BONNE RAISON — sinon on cherche le défaut au mauvais endroit', () => {
  // ⚠️ SURVIVANTE FERMÉE (campagne du 2026-08-24). Retirer la reconnaissance de l'outil
  // laissait tous les contrôles verts : un outil inconnu visant CONTEXTE.md retombait sur
  // le contrôle suivant et finissait refusé quand même. Le refus était juste, sa RAISON
  // était fausse — elle parlait d'un carnet. Un exploitant qui lit « un carnet n'est pas un
  // document » cherche du côté du fichier, alors que le défaut est que la garde a reçu un
  // outil qu'elle ne connaît pas : c'est le signe qu'un outil d'écriture neuf est apparu et
  // qu'elle ne le juge pas.
  const d = juger({ outil: 'UnOutilQuiNExistePas', chemin: join(LIEU, FICHIER_PERMIS), lieu: LIEU });
  assert.equal(d.decision, 'deny');
  assert.match(d.raison, /outil/i, 'le refus doit nommer l outil comme la cause');
  assert.match(d.raison, /UnOutilQuiNExistePas/, 'et le citer, pour qu on sache lequel elle ne connaît pas');
  assert.ok(!/carnet/i.test(d.raison),
    'la raison parle du fichier alors que la cause est l outil — le contrôle d outil a disparu');
});

test('le refus DIT ce qu il a mesuré et à qui le geste appartient', () => {
  const d = juger({ outil: 'Write', chemin: join(LIEU, 'src', 'app.ts'), lieu: LIEU });
  assert.equal(d.decision, 'deny');
  assert.match(d.raison, /app\.ts/, 'il nomme le chemin qu il a refusé');
  assert.match(d.raison, /appartient/i, 'et il dit que le geste est à quelqu un d autre');
  const a = juger({ outil: 'Write', chemin: FICHIER_PERMIS, lieu: LIEU });
  assert.match(a.raison, /mémoire/i, 'et l autorisation dit POURQUOI ce fichier-là');
});

// ═════════════════════ 4. le fil mince, bout en bout

test('le fil répond en JSON sur stdout, et refuse ce que la décision refuse', () => {
  const lancer = (requete) => JSON.parse(execFileSync(process.execPath,
    [join(RACINE, 'gardes', 'ecriture.js')], { input: JSON.stringify(requete), encoding: 'utf8' },
  )).hookSpecificOutput;

  assert.equal(lancer({ tool_name: 'Write', cwd: LIEU, tool_input: { file_path: FICHIER_PERMIS } }).permissionDecision, 'allow');
  assert.equal(lancer({ tool_name: 'Write', cwd: LIEU, tool_input: { file_path: 'CLAUDE.md' } }).permissionDecision, 'deny');
  assert.equal(lancer({ tool_name: 'Edit', cwd: LIEU, tool_input: { file_path: 'metier/chapitres/rondes.md' } }).permissionDecision, 'deny');
  // `NotebookEdit` nomme son chemin autrement. Ne lire que `file_path` le
  // refuserait pour la mauvaise raison — « aucun chemin » — et le dirait mal.
  assert.match(lancer({ tool_name: 'NotebookEdit', cwd: LIEU, tool_input: { notebook_path: 'c.ipynb' } }).permissionDecisionReason,
    /carnet|c\.ipynb/i, 'le refus doit porter sur le carnet, pas sur un chemin manquant');
  // Ce qui n est pas une écriture ne la regarde pas : elle garde l écriture, pas le travail.
  assert.equal(lancer({ tool_name: 'Read', cwd: LIEU, tool_input: { file_path: 'src/app.ts' } }).permissionDecision, 'allow');
});

test('le fil REFUSE une requête qu il n a pas pu lire — un garde absent ne vaut jamais un garde permissif', () => {
  const sortie = execFileSync(process.execPath, [join(RACINE, 'gardes', 'ecriture.js')],
    { input: 'ceci n est pas du JSON', encoding: 'utf8' });
  assert.equal(JSON.parse(sortie).hookSpecificOutput.permissionDecision, 'deny');
});

// ═════════════════════ 5. 🔴 ce qui rendrait la garde MUETTE sans la casser

test('🔴 le refus rendu ne porte plus aucun outil d édition NU — sinon le hook n est jamais appelé', () => {
  // Mesuré : sous un `deny`, le hook n est pas consulté. Un outil nu qui
  // reviendrait ici laisserait tous les tests ci-dessus au vert pendant que
  // CONTEXTE.md redeviendrait inaccessible dans la vraie session.
  const deny = JSON.parse(readFileSync(
    join(RACINE, '.claude', 'templates', 'orchestrateur', '.claude', 'settings.json'), 'utf8',
  )).permissions.deny;
  for (const outil of ['Write', 'Edit', 'MultiEdit']) {
    assert.ok(!deny.includes(outil),
      `« ${outil} » est revenu dans permissions.deny : le hook ne serait plus appelé, et la garde deviendrait muette`);
    assert.ok(!deny.some((r) => r.startsWith(`${outil}(`)),
      `un refus à motif sur « ${outil} » est revenu : il couvrirait CONTEXTE.md et rendrait le hook muet`);
  }
});

test('🔴 le refus rendu garde ce que la garde ne porte PAS — Task et NotebookEdit', () => {
  const deny = JSON.parse(readFileSync(
    join(RACINE, '.claude', 'templates', 'orchestrateur', '.claude', 'settings.json'), 'utf8',
  )).permissions.deny;
  assert.ok(deny.includes('Task'), 'sans lui, un orchestrateur ouvrirait des sous-agents (GF-ORC-002)');
  assert.ok(deny.includes('NotebookEdit'), 'la garde le refuse aussi, mais le refus de permission tient dès la naissance');
});

test('🔴 le hook d écriture est DÉCLARÉ dans le settings rendu, et il vise les outils d édition', () => {
  const st = JSON.parse(readFileSync(
    join(RACINE, '.claude', 'templates', 'orchestrateur', '.claude', 'settings.json'), 'utf8',
  ));
  const h = (st.hooks?.PreToolUse || []).find((x) => x.hooks?.[0]?.command?.includes('gardes/ecriture.js'));
  assert.ok(h, 'aucun hook ne branche la garde d écriture : plus rien ne refuserait un livrable');
  for (const outil of ['Write', 'Edit']) {
    assert.match(h.matcher, new RegExp(`(^|\\|)${outil}(\\||$)`),
      `le matcher « ${h.matcher} » ne vise pas ${outil} — la garde ne serait jamais consultée pour cet outil`);
  }
  assert.match(h.hooks[0].command, /permissionDecision":"deny/,
    'la commande doit refuser d elle-même quand la garde est introuvable sur le poste');
});

// ═════════════════════ 6. 🔴 la garde qui CASSE — le mode de panne mesuré

// Un `deny` déclaratif est inerte : il ne peut pas tomber en panne. Une garde est
// du code. Depuis que la garde porte seule ce que `permissions.deny` portait, sa
// panne est devenue un mode de défaillance du refus lui-même.
//
// MESURÉ le 2026-08-24 sur Claude Code 2.1.241, AVANT ce durcissement : une garde
// qui sort en erreur sans rien écrire dégrade le geste en DEMANDE de permission —
// et sous `--permission-mode acceptEdits`, une demande est un oui. Le fichier a
// été écrit pendant que la garde était morte. Ces tests gardent la contre-mesure.

/** La commande de hook rendue, avec sa garde remplacée par un script d'essai. */
function lancerCommandeAvec(scriptGarde, requete = { tool_name: 'Write', cwd: '/x', tool_input: { file_path: 'CLAUDE.md' } }) {
  const st = JSON.parse(readFileSync(
    join(RACINE, '.claude', 'templates', 'orchestrateur', '.claude', 'settings.json'), 'utf8'));
  const h = st.hooks.PreToolUse.find((x) => x.hooks?.[0]?.command?.includes('gardes/ecriture.js'));
  const cmd = h.hooks[0].command.replace('$HOME/.somtech/gardes/ecriture.js', scriptGarde);
  return execFileSync('/bin/sh', ['-c', cmd], { input: JSON.stringify(requete), encoding: 'utf8' });
}

test('🔴 la commande de hook REFUSE quand la garde casse — et non quand elle manque', () => {
  const bidon = mkdtempSync(join(tmpdir(), 'smtk-garde-'));
  const enPanne = join(bidon, 'en-panne.js');
  writeFileSync(enPanne, 'process.stderr.write("boum\\n"); process.exit(1);\n');
  const d = JSON.parse(lancerCommandeAvec(enPanne)).hookSpecificOutput;
  assert.equal(d.permissionDecision, 'deny',
    'une garde qui casse laissait le geste dégrader en DEMANDE de permission — un oui sous acceptEdits');
  assert.match(d.permissionDecisionReason, /echoue|verdict/i, 'le refus doit dire que la garde a échoué, pas qu elle est absente');
});

test('🔴 la commande de hook REFUSE quand la garde sort en SUCCÈS mais ne rend rien', () => {
  // Le cas que « le code de sortie est bon » laisserait passer : sortie vide,
  // rc 0. Claude Code n a alors aucun verdict, et retombe sur la demande.
  const bidon = mkdtempSync(join(tmpdir(), 'smtk-garde-'));
  const muette = join(bidon, 'muette.js');
  writeFileSync(muette, 'process.exit(0);\n');
  assert.equal(JSON.parse(lancerCommandeAvec(muette)).hookSpecificOutput.permissionDecision, 'deny');
});

test('la commande de hook REFUSE quand la garde est absente — le cas déjà couvert, qui ne doit pas être perdu', () => {
  const d = JSON.parse(lancerCommandeAvec('/un/chemin/qui/n/existe/pas.js')).hookSpecificOutput;
  assert.equal(d.permissionDecision, 'deny');
  assert.match(d.permissionDecisionReason, /introuvable/i, 'et il doit se distinguer du refus pour panne');
});

test('la commande de hook TRANSMET le verdict quand la garde fonctionne — sinon elle refuserait tout', () => {
  // ⚠️ Sans ce contrôle, une commande qui refuserait TOUJOURS passerait les trois
  // tests ci-dessus. Un refus qui n empêche rien de nouveau ne garde rien.
  const d = JSON.parse(lancerCommandeAvec(join(RACINE, 'gardes', 'ecriture.js'),
    { tool_name: 'Write', cwd: LIEU, tool_input: { file_path: FICHIER_PERMIS } })).hookSpecificOutput;
  assert.equal(d.permissionDecision, 'allow', 'le verdict de la garde doit remonter tel quel');
});

test('le fil REFUSE quand sa décision est illisible — il ne meurt pas en silence', () => {
  // Une panne qui remonterait hors du `try` sortirait en code non nul sans rien
  // écrire : c est exactement le mode mesuré. Le fil doit répondre lui-même.
  const bidon = mkdtempSync(join(tmpdir(), 'smtk-fil-'));
  writeFileSync(join(bidon, 'ecriture-decision.js'), 'throw new Error("décision cassée");\n');
  writeFileSync(join(bidon, 'ecriture.js'), readFileSync(join(RACINE, 'gardes', 'ecriture.js'), 'utf8'));
  const sortie = execFileSync(process.execPath, [join(bidon, 'ecriture.js')],
    { input: JSON.stringify({ tool_name: 'Write', cwd: LIEU, tool_input: { file_path: FICHIER_PERMIS } }), encoding: 'utf8' });
  assert.equal(JSON.parse(sortie).hookSpecificOutput.permissionDecision, 'deny');
});

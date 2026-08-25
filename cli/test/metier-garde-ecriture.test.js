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
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

import { juger, FICHIER_PERMIS, ROLES_GARDES } from '../src/metier/gardes/ecriture.js';

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
  // ⚠️ CE CAS-CI EST UN FAUX TÉMOIN, ET C'EST VOULU DE LE DIRE. Avec un `chemin`
  // ABSOLU, `resolve` ignore le lieu : le refus vient alors du répertoire qui ne
  // correspond pas, PAS du garde `isAbsolute`. Retirer ce garde laisse ce cas
  // rouge quand même — mesuré. Le cas qui l'éprouve vraiment est le suivant.
  assert.ok(refuse('Write', join(LIEU, FICHIER_PERMIS), { lieu: 'pas/absolu' }), 'un lieu qui n est pas un chemin absolu');
  // 🔴 LE CAS QUI ÉPROUVE VRAIMENT `isAbsolute` — trouvé par la quatrième passe de
  // fond, MESURÉ : un `lieu` relatif ET un `chemin` relatif ALIGNÉS. `resolve` les
  // fait alors coïncider, le répertoire correspond, et plus rien ne refuse — sauf
  // ce garde. Sans lui, la décision rend « allow » sur un lieu qu'elle n'a pas su
  // situer. Le test d'au-dessus ne pouvait pas le voir : son entrée était protégée
  // par un AUTRE mécanisme, qui masquait l'absence du premier.
  assert.ok(refuse('Write', FICHIER_PERMIS, { lieu: 'un-sous-dossier' }),
    'lieu ET chemin relatifs alignés : seul le garde « isAbsolute » refuse ici');
  assert.match(juger({ outil: 'Write', chemin: FICHIER_PERMIS, lieu: 'un-sous-dossier' }).raison, /où est ton lieu/i,
    'et il doit refuser POUR CETTE RAISON — sinon c est un autre mécanisme qui a répondu');
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

// ═════════════════════ 7. 🔴 les verdicts qui n'en sont pas

// Un troisième mode de panne, plus discret que les deux précédents : la garde
// RÉPOND, en code 0, avec une sortie non vide — mais ce qu'elle rend n'est pas un
// verdict. La commande de hook le transmet alors tel quel, croyant à un verdict, et
// Claude Code retombe sur la demande de permission : un oui sous `acceptEdits`.
//
// MESURÉ le 2026-08-24, et trouvé en éprouvant le fil, pas en le relisant : une
// décision devenue asynchrone (un `juger` qui rend une Promise) donnait
// `decision === undefined`, que `JSON.stringify` OMET. La garde émettait
// `{"hookSpecificOutput":{"hookEventName":"PreToolUse"}}` — sans décision.

/** Le fil, monté sur une décision d'essai, hors du dépôt. */
function filAvecDecision(source, requete = { tool_name: 'Write', cwd: LIEU, tool_input: { file_path: FICHIER_PERMIS } }, env = {}) {
  const bidon = mkdtempSync(join(tmpdir(), 'smtk-verdict-'));
  writeFileSync(join(bidon, 'ecriture-decision.js'), source);
  writeFileSync(join(bidon, 'ecriture.js'), readFileSync(join(RACINE, 'gardes', 'ecriture.js'), 'utf8'));
  return JSON.parse(execFileSync(process.execPath, [join(bidon, 'ecriture.js')],
    { input: JSON.stringify(requete), encoding: 'utf8', env: { ...process.env, ...env } })).hookSpecificOutput;
}

test('🔴 une décision devenue ASYNCHRONE ne produit pas un verdict sans décision', () => {
  const d = filAvecDecision('export function juger(){ return new Promise(() => {}); }\n');
  assert.equal(d.permissionDecision, 'deny',
    'sans décision, la clé est omise du JSON et le geste dégrade en demande de permission');
  assert.match(d.permissionDecisionReason, /ne reconnaît pas|undefined/i);
});

test('🔴 une décision INVENTÉE est refusée — « peut-être » n’est pas « allow »', () => {
  const d = filAvecDecision('export function juger(){ return { decision: "peut-etre", raison: "x" }; }\n');
  assert.equal(d.permissionDecision, 'deny');
});

test('🔴 une garde qui PEND rend son propre refus avant que l’hôte ne l’abandonne', () => {
  // Le troisième mode, mesuré sur la vraie chaîne : un hook qui pend laisse le geste
  // PASSER (`CLAUDE.md` écrit). Ni le `try` du fil ni la commande de hook ne le
  // ferment — le shell attend `node` avec lui, et `timeout` n'existe pas sur macOS.
  // Le seul endroit d'où l'on peut couper est l'intérieur du processus.
  //
  // ⚠️ CE QUE CE DÉLAI NE FERME PAS, écrit plutôt qu'espéré : une BOUCLE de calcul.
  // Node est mono-thread — un `while` qui tourne empêche le minuteur de se déclencher.
  // Mesuré aussi. Le délai couvre l'attente, pas le calcul.
  const d = filAvecDecision('await new Promise(() => {});\nexport function juger(){ return { decision: "allow", raison: "" }; }\n',
    undefined, { SOMTECH_GARDE_DELAI_MS: '700' });
  assert.equal(d.permissionDecision, 'deny');
  assert.match(d.permissionDecisionReason, /verdict|délai|700/i, 'le refus doit dire que le délai a été atteint');
});

test('le fil laisse passer un VRAI allow — sans quoi les trois refus ci-dessus ne prouveraient rien', () => {
  // ⚠️ Un fil qui refuserait TOUJOURS passerait les trois contrôles précédents.
  const d = filAvecDecision('export function juger(){ return { decision: "allow", raison: "essai" }; }\n');
  assert.equal(d.permissionDecision, 'allow');
  assert.equal(d.permissionDecisionReason, 'essai', 'et la raison de la décision remonte telle quelle');
});

// ═════════════════════ 8. 🔴 la contrainte que la garde s'impose à elle-même

// Apport de conception du coordonnateur, 2026-08-24, et il ne pouvait pas rester un
// commentaire : une contrainte écrite en prose s'oublie au premier ajout.
//
// LE RAISONNEMENT : un mode de panne de cette garde n'est PAS bornable — une boucle
// de calcul. Node est mono-thread, donc le délai que le fil s'impose ne peut pas se
// déclencher pendant qu'un `while` tourne, et une garde qui pend laisse le geste
// PASSER. Puisque ce risque ne se mesure pas, la seule parade est de ne pas le
// créer : la décision reste la plus simple possible.

/** Le code exécutable de la décision : sans commentaires, sans chaînes, sans vide. */
function codeNu() {
  return readFileSync(join(RACINE, 'gardes', 'ecriture-decision.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')       // les blocs de commentaire
    .replace(/^\s*\/\/.*$/gm, ' ')           // les lignes de commentaire
    // ⚠️ LES TROIS FORMES DE CHAÎNE EN UNE SEULE PASSE, ALTERNÉES. Les traiter l'une
    // APRÈS l'autre était un défaut réel, attrapé par la contre-épreuve ci-dessous :
    // une apostrophe française à l'intérieur d'une chaîne DOUBLE (« n'appartient »)
    // était lue comme l'ouverture d'une chaîne simple, qui se refermait bien plus
    // loin — emportant `export function juger` au passage. Le contrôle mesurait
    // alors un texte amputé, et se serait tu sur une boucle qui s'y trouvait.
    .replace(/`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '""');
}

test('🔴 la décision ne contient AUCUNE construction bouclante — le seul mode de panne non bornable', () => {
  const nu = codeNu();
  for (const mot of ['while', 'for', 'do']) {
    assert.ok(!new RegExp(`\\b${mot}\\s*[({]`).test(nu),
      `« ${mot} » est apparu dans la décision. Node est mono-thread : une boucle empêche le `
      + `délai du fil de se déclencher, et une garde qui pend laisse le geste PASSER — mesuré. `
      + `Ce n'est pas un interdit de style : c'est le seul mode de panne qu'on ne sait pas borner. `
      + `S'il le faut vraiment, dis ici ce que cet ajout coûte avant de lever ce contrôle.`);
  }
  // ⚠️ Sans cette contre-épreuve, le contrôle passerait aussi si `codeNu()` rendait du
  // vide — par exemple si la façon de dépouiller cassait un jour en silence.
  assert.ok(nu.includes('export function juger'),
    'le dépouillement a mangé le code : ce contrôle mesurerait alors une chaîne vide');
});

test('🔴 la décision tient sous son plafond de taille — un ajout doit se justifier, pas se glisser', () => {
  // ⚠️ Le plafond est ÉPINGLÉ SUR UNE MESURE, pas choisi rond : au 2026-08-24, la
  // décision fait 54 lignes de code nu. La marge est étroite VOLONTAIREMENT — elle
  // laisse passer un correctif, jamais un enrichissement.
  //
  // ⚠️ Le premier chiffre écrit ici était 41, et il était FAUX : il venait d'un
  // dépouillement qui mangeait une partie du code (voir `codeNu`). Un plafond posé
  // sur une mesure fausse aurait rougi à la première ligne ajoutée, pour la mauvaise
  // raison — et on l'aurait « corrigé » en le relevant.
  const lignes = codeNu().split('\n').filter((l) => l.trim() !== '').length;
  // ⚠️ 🔴 CE QUE TU T'APPRÊTES À FAIRE EN LISANT CE ROUGE. Le jour où ce contrôle
  // rougira sur un ajout LÉGITIME — et ce jour viendra —, le réflexe sera de relever
  // le chiffre. **C'est exactement le geste qui désarme**, et il ressemble à de
  // l'entretien : rien ne le distingue d'une mise à jour de routine. Le rouge n'est
  // pas un blocage, c'est un RAPPEL — il force à relire pourquoi cette garde doit
  // rester simple avant de décider. Le message ci-dessous le dit à celui qui le lira
  // dans six mois, parce qu'il ne lira pas ce commentaire : il lira le rouge.
  assert.ok(lignes <= 62,
    `la décision fait ${lignes} lignes de code pour un plafond de 62 (54 mesurées le 2026-08-24).\n\n`
    + `🔴 RELEVER CE PLAFOND DÉSARME LA SEULE PROTECTION CONTRE UNE PANNE QU'ON NE SAIT PAS BORNER.\n`
    + `Une boucle de calcul dans cette garde la fait PENDRE, et une garde qui pend laisse le geste `
    + `PASSER — mesuré le 2026-08-24 sur la vraie chaîne : le fichier a été écrit. Node est `
    + `mono-thread : ni le délai du fil, ni la commande de hook, ni rien d'autre ne ferme ce cas. `
    + `La seule parade est que cette décision reste trop simple pour qu'une boucle y entre.\n\n`
    + `Ce n'est donc pas un chiffre à réaligner. Trois issues, dans cet ordre : sortir l'ajout de `
    + `la garde · le réécrire plus court · ou, si rien d'autre ne marche, relever le plafond EN `
    + `ÉCRIVANT ICI ce que cet ajout achète et pourquoi il ne peut pas boucler.`);
  assert.ok(lignes >= 35,
    `la décision est tombée à ${lignes} lignes : elle a probablement été vidée. `
    + `Un plafond seul se satisfait d'une garde supprimée.`);
});

// ═════════════════════ 9. 🔴 la jointure entre DEUX hooks du même lieu

// MESURÉ le 2026-08-24, sur la vraie chaîne, dans les deux sens :
//
//   • un autre hook dit `allow` sur un livrable que cette garde refuse → LE REFUS TIENT
//     (`CLAUDE.md` intact). L'exception ne s'élargit pas par un voisin permissif ;
//   • un autre hook dit `deny` sur le `CONTEXTE.md` que cette garde autorise → LE REFUS
//     GAGNE (`CONTEXTE.md` intact). **Le `deny` de N'IMPORTE QUEL hook l'emporte.**
//
// Le second sens compte, parce que le lieu d'un orchestrateur porte un hook SANS
// `matcher` — la garde d'ouverture de ligne — qui s'exécute donc AUSSI sur `Write`.
// Si elle refusait un `Write` en toute circonstance, la fonction de ce lot tomberait
// en silence : la garde d'écriture dirait « oui » et rien ne s'écrirait.

test('🔴 la garde d’ouverture de ligne ne refuse PAS l’écriture une fois la ligne ouverte', async () => {
  // Ce que ce contrôle garde, c'est LA LIGNE QUI RELIE deux modules justes séparément.
  // Chacun a sa suite ; personne ne gardait leur rencontre.
  const { decider } = await import(join(RACINE, 'naissance-representant', 'src', 'garde.js'));

  // ① Ligne ouverte — elle se retire, et cette garde-ci décide seule.
  const ouverte = decider({
    toolName: 'Write', toolInput: { file_path: join(LIEU, FICHIER_PERMIS) },
    // ⚠️ « interne » — la nature RÉELLE de la ligne d'un orchestrateur, lue dans
    // `ligne-directe/src/roles.js`, pas devinée. Une nature inventée ici rendrait
    // ce contrôle vert pour la mauvaise raison : « rien n'est ouvert » aussi.
    naturesOuvertes: ['interne'], role: 'orchestrateur',
  });
  assert.equal(ouverte.permissionDecision, 'allow',
    'ligne ouverte, elle doit se retirer : sinon un orchestrateur ne pourrait JAMAIS tenir son '
    + 'CONTEXTE.md, quoi que dise la garde d’écriture — le deny d’un hook l’emporte sur le allow d’un autre');

  // ② Ligne PAS encore ouverte — elle refuse, et c'est voulu : l'ouverture précède tout.
  // Ce n'est pas un défaut de ce lot, c'est un SÉQUENÇAGE, et il doit rester écrit :
  // l'orchestrateur ouvre sa ligne, PUIS il tient sa mémoire.
  const fermee = decider({
    toolName: 'Write', toolInput: { file_path: join(LIEU, FICHIER_PERMIS) },
    naturesOuvertes: [], role: 'orchestrateur',
  });
  assert.equal(fermee.permissionDecision, 'deny',
    'ligne fermée, l’ouverture passe avant tout — si ce contrôle rougit, c’est que la garde '
    + 'd’ouverture a cessé de tenir, pas que ce lot a changé');

  // 🔴 ET SON REFUS DOIT NOMMER LA CAUSE ET LE GESTE QUI LA LÈVE. Un agent neuf qui
  // tente d'écrire son CONTEXTE.md avant d'ouvrir sa ligne verra CE refus-là, pas
  // celui de la garde d'écriture. S'il ne dit pas pourquoi, l'agent conclura que la
  // garde d'écriture est cassée et cherchera un défaut qui n'existe pas — un refus
  // qui ne dit pas pourquoi fabrique une enquête.
  //
  // Le message dit aujourd'hui ce qu'il faut ; ce contrôle empêche qu'il l'oublie.
  assert.match(fermee.permissionDecisionReason, /manque/i,
    'le refus doit dire ce qui manque, pas seulement qu’il refuse');
  assert.match(fermee.permissionDecisionReason, /ouvrir/,
    'et nommer le geste EXACT qui le lève — sans lui, l’agent relance la même chose ou renonce');
  assert.ok(!/CONTEXTE\.md|garde d.écriture/i.test(fermee.permissionDecisionReason),
    'il ne doit pas se faire passer pour le refus de la garde d’écriture : l’agent chercherait '
    + 'le défaut au mauvais endroit');
});

// ═════════════════════ 10. 🔴 les DEUX listes d'outils du fil et de la décision

// Trouvé par la revue de fond du 2026-08-24, et mesuré : le fil porte sa PROPRE
// liste d'outils d'écriture, distincte de celle de la décision. Retirer `MultiEdit`
// de celle du FIL laissait 1097/1097 au vert — et un `MultiEdit` aurait alors
// contourné `juger()` entièrement, avec un `allow` automatique. Deux listes qui
// doivent dire la même chose, et rien ne les comparait.
//
// ⚠️ La liste du fil est lue dans son TEXTE, jamais par un `import` : importer
// `gardes/ecriture.js` exécuterait son `main()`, c'est-à-dire ferait tourner la
// garde pendant qu'on prétend seulement la lire.

test('🔴 le fil et la décision jugent EXACTEMENT les mêmes outils — deux listes divergent en silence', async () => {
  const { OUTILS_ECRITURE } = await import('../src/metier/gardes/ecriture.js');
  const src = readFileSync(join(RACINE, 'gardes', 'ecriture.js'), 'utf8');
  const m = /const OUTILS_ECRITURE = new Set\(\[([^\]]*)\]\)/.exec(src);
  assert.ok(m, 'la liste du fil est introuvable dans son texte — ce contrôle ne mesurerait rien');
  const duFil = m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
  assert.deepEqual(duFil, [...OUTILS_ECRITURE].sort(),
    'le fil ne filtre pas sur les mêmes outils que la décision : celui qui manque au fil '
    + 'contourne « juger » entièrement, avec un « allow » automatique');
});

test('🔴 MultiEdit passe VRAIMENT par la garde — le contrôle de listes ne le prouve pas seul', () => {
  // Une liste peut être identique des deux côtés et le fil ne rien en faire.
  // Ce contrôle-ci exerce le fil réel, pour chacun des outils qu'il déclare juger.
  for (const outil of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
    const d = JSON.parse(execFileSync(process.execPath, [join(RACINE, 'gardes', 'ecriture.js')],
      { input: JSON.stringify({ tool_name: outil, cwd: LIEU, tool_input: { file_path: join(LIEU, 'src', 'app.ts') } }),
        encoding: 'utf8' })).hookSpecificOutput;
    assert.equal(d.permissionDecision, 'deny',
      `« ${outil} » sur un livrable doit être refusé — s'il passe, cet outil contourne la garde`);
  }
});

// ═════════════════════ 11. 🔴 le verdict TRANSMIS, et non seulement rendu

test('🔴 du bruit avant le JSON ne passe pas pour un verdict — « code 0 » et « non vide » n’en font pas un', () => {
  // Trouvé par la revue de fond, MESURÉ : la commande ne vérifiait que le code de
  // sortie et la non-vacuité. Une ligne de bruit sur stdout AVANT le JSON — un
  // `npm notice`, un `console.log` oublié, un avertissement de Node — et la sortie
  // transmise ne parse plus. Claude Code n'a alors aucun verdict et retombe sur la
  // demande de permission : un oui sous `acceptEdits`.
  const bidon = mkdtempSync(join(tmpdir(), 'smtk-bruit-'));
  const bruyante = join(bidon, 'bruyante.js');
  writeFileSync(bruyante, 'process.stdout.write("npm notice: du bruit\\n");'
    + 'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",'
    + 'permissionDecision:"allow",permissionDecisionReason:"x"}}));\n');
  const sortie = lancerCommandeAvec(bruyante);
  const d = JSON.parse(sortie).hookSpecificOutput;   // ⚠️ il DOIT parser : c'est la moitié du contrôle
  assert.equal(d.permissionDecision, 'deny',
    'un « allow » noyé dans du bruit ne doit pas être transmis — il ne parse pas, donc il ne vaut rien');
});

test('le verdict d’une garde SAINE traverse intact — sinon la validation refuserait tout le monde', () => {
  // ⚠️ Sans ce contrôle, une commande qui refuserait TOUJOURS passerait le précédent.
  const d = JSON.parse(lancerCommandeAvec(join(RACINE, 'gardes', 'ecriture.js'),
    { tool_name: 'Write', cwd: LIEU, tool_input: { file_path: FICHIER_PERMIS } })).hookSpecificOutput;
  assert.equal(d.permissionDecision, 'allow');
  assert.match(d.permissionDecisionReason, /mémoire/i, 'et la raison traverse aussi, pas seulement la décision');
});

// ═════════════════════ 12. 🔴 la PROPRIÉTÉ, pas l'état — tout hook qui peut voir un Write

/**
 * Les hooks dont on a ÉPROUVÉ la conduite face à un `Write`, et pourquoi.
 *
 * ⚠️ Cette table n'est pas une liste de ce qui existe : c'est une liste de ce qui a
 * été ÉPROUVÉ. Un hook ajouté demain sans matcher — donc actif sur `Write` — fera
 * rougir le contrôle ci-dessous tant que personne ne l'aura éprouvé. C'est voulu :
 * le `deny` de n'importe quel hook l'emporte, donc un voisin non éprouvé peut faire
 * tomber la fonction de ce lot EN SILENCE (la garde dirait oui, rien ne s'écrirait).
 */
/**
 * ⚠️ L'APPARIEMENT EST UNE EMPREINTE, PLUS UNE SOUS-CHAÎNE — et c'est un DÉFAUT
 * RÉEL qui l'a imposé, trouvé par la seconde passe de fond du 2026-08-24 et
 * mesuré deux fois : un cinquième hook sans `matcher`, répondant toujours
 * « allow », dont la commande ne faisait qu'IMPRIMER un message contenant par
 * hasard « gardes/ecriture.js », passait pour éprouvé. Le contrôle restait vert
 * pendant qu'un hook non éprouvé voyait tous les `Write`.
 *
 * L'empreinte ferme ce cas et en ouvre un utile : une commande qui CHANGE rougit,
 * donc doit être ré-éprouvée. C'est la bonne polarité — ce lot vient précisément
 * de montrer qu'un durcissement peut ne pas être redistribué partout.
 */
const empreinte = (cmd) => createHash('sha256').update(cmd, 'utf8').digest('hex').slice(0, 16);

const HOOKS_EPROUVES = [
  { sha: 'e52511a7320595f5', quoi: 'garde « terminal »', pourquoi: 'matcher « Bash » — ne voit jamais un Write' },
  { sha: '027326877c5f600d', quoi: 'garde « ligne-cliente »', pourquoi: 'matcher « Bash » — ne voit jamais un Write' },
  { sha: '5a11f09d4be1b385', quoi: 'garde « ecriture »', pourquoi: 'la garde de ce lot — éprouvée par les sections 1 à 11 ci-dessus' },
  { sha: '006488b51d844b07', quoi: 'garde « ouverture-ligne »', pourquoi: 'éprouvée en §9 : se retire une fois la ligne ouverte' },
];

test('🔴 tout hook du lieu qui PEUT voir un Write a été éprouvé — un voisin non éprouvé fait tomber ce lot en silence', () => {
  const st = JSON.parse(readFileSync(
    join(RACINE, '.claude', 'templates', 'orchestrateur', '.claude', 'settings.json'), 'utf8'));
  const hooks = st.hooks?.PreToolUse || [];
  assert.ok(hooks.length >= 4, `${hooks.length} hook(s) : le contrôle doit en voir au moins quatre`);

  // Un hook SANS matcher s'exécute sur TOUS les outils, `Write` compris. Un hook avec
  // matcher ne nous concerne que si ce matcher couvre `Write`.
  const voientUnWrite = hooks.filter((h) => !h.matcher || new RegExp(`(^|\\|)Write(\\||$)`).test(h.matcher));
  assert.ok(voientUnWrite.length >= 2,
    'le contrôle doit voir au moins la garde d’écriture et le hook sans matcher — sinon il ne mesure rien');

  for (const h of voientUnWrite) {
    const cmd = h.hooks?.[0]?.command || '';
    const connu = HOOKS_EPROUVES.find((e) => e.sha === empreinte(cmd));
    assert.ok(connu,
      `un hook qui voit les « Write » n’est pas dans la table des hooks éprouvés `
      + `(empreinte ${empreinte(cmd)}) :\n  ${cmd.slice(0, 120)}\n\n`
      + `🔴 Le « deny » de N'IMPORTE QUEL hook l'emporte sur le « allow » d'un autre — mesuré le `
      + `2026-08-24 dans les deux sens. Si celui-ci refuse un Write, un orchestrateur ne pourra `
      + `plus tenir son CONTEXTE.md, la garde d'écriture aura beau dire oui, et RIEN ne le dira. `
      + `Éprouve sa conduite face à un Write, puis inscris-le dans HOOKS_EPROUVES avec la raison.`);
  }
});

// ═════════════════════ 13. 🔴 les cas FINS jugés par le FIL RÉEL

// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE BLOC EXISTE, ET CE QU'IL RÉPOND
//
// La garde vit en DEUX exemplaires, et ce n'est pas un accident : `gardes/
// ecriture-decision.js` est déposé sur le poste (~/.somtech/gardes/), où
// `cli/src/` n'existe pas ; `cli/src/metier/gardes/ecriture.js` est celui que le
// CLI embarque et que les sections 1-3 importent. La distribution exige les deux.
//
// Leur identité est gardée par `metier-gardes-distribuees.test.js`, dont la liste
// est DÉRIVÉE du contenu de `gardes/`. Mesuré le 2026-08-24, les deux sens :
//   • muter UNE seule copie → le contrôle d'identité rougit ;
//   • muter LES DEUX identiquement → les contrôles de fonction (§1-3) rougissent.
//
// ⚠️ MAIS la troisième passe de fond a relevé un angle mort réel : les cas FINS
// — la traversée par « .. », le CONTEXTE.md d'un PAIR, NotebookEdit sur le
// fichier permis — n'étaient éprouvés QUE par les sections 1-3, donc uniquement
// sur la copie du CLI. Le fil réel, lui, ne voyait que des cas basiques. Ce bloc
// porte les cas fins jusqu'au FIL, qui charge la copie DÉPOSÉE en premier.
// ─────────────────────────────────────────────────────────────────────────────

test('🔴 le fil réel refuse les cas FINS — pas seulement les cas évidents', () => {
  const parLeFil = (chemin, outil = 'Write') => JSON.parse(execFileSync(process.execPath,
    [join(RACINE, 'gardes', 'ecriture.js')],
    { input: JSON.stringify({ tool_name: outil, cwd: LIEU, tool_input: { file_path: chemin } }),
      encoding: 'utf8' })).hookSpecificOutput.permissionDecision;

  // ① le fichier permis passe — sinon les refus ci-dessous ne prouveraient rien
  assert.equal(parLeFil(FICHIER_PERMIS), 'allow', 'le fichier permis doit passer PAR LE FIL');

  // ② le CONTEXTE.md d'un PAIR — même nom, autre lieu
  assert.equal(parLeFil('/Users/x/GitRepo.nosync/un-depot/.orchestrateur/mitis/CONTEXTE.md'), 'deny',
    'le CONTEXTE.md d’un pair ne lui appartient pas');

  // ③ la traversée par « .. » — sortir du lieu en ayant l'air d'y rester
  assert.equal(parLeFil(`../mitis/${FICHIER_PERMIS}`), 'deny', 'la traversée doit être refusée PAR LE FIL');

  // ④ un sous-répertoire du lieu — le nom est bon, le répertoire non
  assert.equal(parLeFil(`metier/${FICHIER_PERMIS}`), 'deny', 'le fichier permis est à la RACINE du lieu, pas ailleurs');
  assert.equal(parLeFil(`metier/chapitres/${FICHIER_PERMIS}`), 'deny');

  // ⑤ un nom qui ressemble
  for (const c of ['CONTEXTE.md.bak', 'contexte.md', 'mon-CONTEXTE.md']) {
    assert.equal(parLeFil(c), 'deny', `« ${c} » n’est pas le fichier permis`);
  }

  // ⑥ NotebookEdit sur le fichier permis — un carnet n'est pas un document
  assert.equal(parLeFil(FICHIER_PERMIS, 'NotebookEdit'), 'deny');
});

// ═════════════════════ 14. 🔴 MultiEdit — un chemin VIVANT et non prouvé

test('🔴 MultiEdit tient AUSSI le fichier permis — le seul outil admis que rien ne prouvait', () => {
  // Trouvé par la quatrième passe de fond, MESURÉ : `MultiEdit` figure dans
  // `OUTILS_DU_FICHIER_PERMIS`, mais aucun contrôle ne vérifiait qu'il PASSE sur
  // le fichier permis. La section 1 n'éprouve l'allow que pour Write et Edit ; les
  // sections 10 et 13 n'éprouvent MultiEdit que contre un livrable, donc en refus.
  // Le retirer du Set laissait toute la suite verte : un chemin vivant, et pas prouvé.
  assert.ok(passe('MultiEdit', join(LIEU, FICHIER_PERMIS)), 'chemin absolu, par la décision');
  assert.ok(passe('MultiEdit', FICHIER_PERMIS), 'et relatif depuis le lieu');

  // Et par le FIL réel, qui charge la copie DÉPOSÉE — pas celle du CLI.
  const d = JSON.parse(execFileSync(process.execPath, [join(RACINE, 'gardes', 'ecriture.js')],
    { input: JSON.stringify({ tool_name: 'MultiEdit', cwd: LIEU, tool_input: { file_path: FICHIER_PERMIS } }),
      encoding: 'utf8' })).hookSpecificOutput;
  assert.equal(d.permissionDecision, 'allow', 'le fil doit le laisser passer aussi');
});

// ═════════════════════ 15. Ce que ce fichier NE prouve PAS, et pourquoi
//
// ⚠️ Écrit plutôt qu'espéré. La quatrième passe de fond a muté deux gardes de
// `gardes/ecriture.js` qui ont SURVÉCU. Remesuré ici : ce ne sont pas des trous,
// ce sont des mutations ÉQUIVALENTES — leur retrait ne change aucun comportement
// observable. Les laisser passer pour des défauts ferait chercher un remède à un
// problème qui n'existe pas ; les taire laisserait la prochaine passe les
// retrouver et refaire le travail.
//
//   • `if (repondu) return` — l'idempotence de la réponse. MESURÉ : sans elle, la
//     sortie reste d'UNE seule ligne, parce que `repondre` termine le processus par
//     `process.exit(0)` avant qu'une seconde réponse puisse partir. La garde est une
//     ceinture derrière une bretelle : correcte, et non observable.
//
//   • le handler `unhandledRejection` — MESURÉ dans les deux positions possibles
//     (rejet au chargement de la décision, rejet pendant le jugement) : avec ou
//     sans lui, le fil rend le même verdict. Node ne fait pas tomber le processus
//     tant que la réponse est partie.
//
// Ces deux gardes RESTENT : elles ne coûtent rien et couvrent des états que Node
// pourrait traiter autrement demain. Mais leur preuve n'existe pas, et ce bloc
// est là pour que personne ne croie le contraire.

// ═════════════════════ 16. 🔴 LA CONSTANTE ELLE-MÊME — le trou que la suite ne pouvait pas voir
//
// Trouvé par la cinquième passe de fond, MESURÉ : renommer `FICHIER_PERMIS` en
// `'CONTEXTE2.md'` dans les deux copies laissait la suite ENTIÈREMENT verte.
//
// La cause est structurelle et elle vaut au-delà de ce fichier : **tous les
// contrôles ci-dessus passent par le SYMBOLE importé, jamais par le littéral.**
// La suite reste donc auto-cohérente même mutée — elle éprouve « le fichier
// permis », quel qu'il soit, et jamais « CONTEXTE.md ».
//
// Or la valeur, elle, est codée en dur AILLEURS, dans des modules qui ne
// s'importent pas les uns les autres. Une dérive de cette constante reproduirait
// EN SILENCE le défaut exact que ce lot corrige — CONTEXTE.md redevient
// inaccessible — pendant que tout serait vert.
//
// ⚠️ Ce contrôle n'ancre donc pas seulement au littéral : il ancre aux QUATRE
// lieux qui doivent s'accorder avec lui. Ancrer au seul littéral laisserait
// dériver n'importe lequel des autres.

test('🔴 FICHIER_PERMIS vaut « CONTEXTE.md », et TOUS les lieux qui codent cette valeur en dur s’accordent', async () => {
  // ① le littéral — sans quoi la suite entière éprouve un fichier imaginaire
  assert.equal(FICHIER_PERMIS, 'CONTEXTE.md',
    'la suite passe par le symbole, jamais par le littéral : elle reste verte si la constante dérive');

  // ② le fichier RÉEL que le pack distribue — la constante doit désigner quelque chose qui existe
  assert.ok(existsSync(join(RACINE, '.claude', 'templates', 'orchestrateur', FICHIER_PERMIS)),
    `le gabarit ne porte aucun « ${FICHIER_PERMIS} » : la garde autoriserait un fichier que personne ne pose`);

  // ③ ce que la mise à jour du pack PRÉSERVE — si CONTEXTE.md en sortait, la
  // convergence l'écraserait, et l'agent perdrait à chaque màj ce qu'il a appris
  const { PRESERVE } = await import('../src/commands/representant.js');
  assert.ok(PRESERVE.includes(FICHIER_PERMIS),
    `« ${FICHIER_PERMIS} » n'est plus préservé par la mise à jour : la convergence l'écraserait`);

  // ④ ce que le rendu REFUSE de produire — le rendu ne doit jamais écrire par-dessus.
  //
  // ⚠️ ANCRÉ À UN COMPORTEMENT, PAS À UNE SOUS-CHAÎNE. La première version cherchait
  // « CONTEXTE.md » dans le TEXTE de `rendu.js` — trouvé par la sixième passe de fond
  // et MESURÉ : retirer la vraie protection tout en laissant un commentaire qui cite
  // le nom laissait ce contrôle VERT, pendant que le rendu pouvait de nouveau écraser
  // le fichier. Un grep prouve qu'un mot est là ; il ne prouve jamais qu'une fonction
  // est servie. On FAIT donc rendre un artefact qui vise le fichier permis, et on
  // exige que le rendu le refuse.
  const { rendre } = await import('../src/metier/rendu.js');
  const essai = rendre({
    role: 'essai', version_abc: '1',
    items: [{ id: 'GF-R-001', nature: 'garde-fou', couche: 'refus-de-permission', refus: ['Task'], enonce: 'x', enonce_socle: 'court' }],
    refus: ['Task'],
    chapitres: [{ nom: 'CONTEXTE', abrege: 'a', version_pack: '1.0.0', contenu: 'x' }],
  });
  assert.ok((essai.erreurs || []).some((e) => e.includes(FICHIER_PERMIS)),
    `le rendu accepte de produire un artefact qui vise « ${FICHIER_PERMIS} » : il pourrait l'écraser, `
    + `et l'agent perdrait à chaque rendu ce que personne n'apprend à sa place`);

  // ⑤ les gabarits que la pose dépose dans le lieu d'un agent
  const { GABARITS } = await import(join(RACINE, 'ligne-directe', 'src', 'lieu-agent.js'));
  assert.ok(GABARITS.includes(FICHIER_PERMIS),
    `« ${FICHIER_PERMIS} » n'est plus posé à la naissance : la garde autoriserait un fichier absent`);
});

test('🔴 ROLES_GARDES ne contient QUE « orchestrateur » — élargir la garde changerait qui elle juge', () => {
  // Trou signalé par la sixième passe de fond, MESURÉ : élargir `ROLES_GARDES` dans
  // les deux copies laissait toute la suite verte — aucun contrôle n'ancrait son
  // CONTENU. Il est aujourd'hui inexploitable (aucun gabarit ne fait tourner cette
  // garde pour un autre rôle), et c'est exactement pourquoi il fallait l'ancrer :
  // le jour où un autre rôle câblerait cette garde, l'élargissement passerait seul,
  // et cette garde-ci rendrait des verdicts pour un métier qu'elle ne connaît pas.
  assert.deepEqual([...ROLES_GARDES].sort(), ['orchestrateur'],
    'la garde d’écriture ne juge que l’orchestrateur — tout autre rôle doit être une décision, pas une dérive');
});

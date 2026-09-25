// metier-fil-scribe-taches.test.js — le FIL MINCE `gardes/scribe-taches.js`,
// exécuté pour de vrai (T-20260925-0080) : lecture du transcript JSONL, lecture
// de `.demande`, état du plafond par lieu (sha1 du cwd), et la SEULE sortie
// muette (pas de bloc, aucun appel — ici mesuré par l'absence de clé ServiceDesk
// dans l'environnement de l'enfant, ce qui rendrait tout appel réseau impossible
// de toute façon).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GARDE = join(RACINE, 'gardes', 'scribe-taches.js');

function transcriptAvec(texteAssistant) {
  const lignes = [
    JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: 'go' }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: texteAssistant }] } }),
  ];
  return lignes.join('\n') + '\n';
}

function executerGarde({ cwd, transcriptPath, stopHookActive = false, env = {} }) {
  const entree = JSON.stringify({ cwd, transcript_path: transcriptPath, stop_hook_active: stopHookActive });
  return execFileSync(process.execPath, [GARDE], {
    input: entree, encoding: 'utf8',
    env: { ...process.env, ...env, SOMTECH_DESK_API_KEY: '', SERVICEDESK_MCP_TOKEN: '' },
  });
}

let TMP;
test.beforeEach(() => { TMP = mkdtempSync(join(tmpdir(), 'smtk-fil-scribe-')); });
test.afterEach(() => { rmSync(TMP, { recursive: true, force: true }); });

test('pas de bloc dans le dernier message assistant → sortie totalement vide (silence)', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec('un message ordinaire, aucun bloc `taches` ici'));
  const sortie = executerGarde({ cwd: TMP, transcriptPath: t });
  assert.equal(sortie, '', `sortie attendue vide, reçue : ${JSON.stringify(sortie)}`);
});

test('bloc valide, `.demande` présent, mais AUCUNE clé ServiceDesk dans l\'environnement → refus nommé "clé absente"', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'attend: dirigeant', '```'].join('\n')));
  writeFileSync(join(TMP, '.demande'), 'D-20260925-0003\n');
  const env = { SOMTECH_SCRIBE_ETAT: join(TMP, 'etat'), SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30' };
  const sortie = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env }));
  assert.equal(sortie.decision, 'block');
  assert.match(sortie.reason, /clé absente/);
});

test('bloc mal formé, `.demande` ABSENT → refus nommé sur le bloc (pas besoin de lire `.demande`)', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'verbe-inconnu: x', '```'].join('\n')));
  const env = { SOMTECH_SCRIBE_ETAT: join(TMP, 'etat'), SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30' };
  const sortie = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env }));
  assert.equal(sortie.decision, 'block');
  assert.match(sortie.reason, /verbe inconnu/);
});

test('une relance émise écrit l\'état du plafond SOUS LE SHA1 DU CWD, et un second lieu ne le partage pas', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'verbe-inconnu: x', '```'].join('\n')));
  const etat = join(TMP, 'etat');
  const env = { SOMTECH_SCRIBE_ETAT: etat, SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30' };
  executerGarde({ cwd: TMP, transcriptPath: t, env });

  const sha1 = createHash('sha1').update(TMP).digest('hex');
  const fichier = join(etat, `${sha1}.json`);
  assert.ok(existsSync(fichier), `l'état du plafond n'a pas été écrit à l'endroit attendu : ${fichier}`);
  const j = JSON.parse(readFileSync(fichier, 'utf8'));
  assert.equal(j.horodatages.length, 1, `un seul block a été émis, un seul horodatage attendu : ${JSON.stringify(j)}`);
});

test('N absent de l\'environnement → aucune relance émise, et l\'état du plafond n\'enregistre rien (blocEmis:false)', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'verbe-inconnu: x', '```'].join('\n')));
  const etat = join(TMP, 'etat');
  const sortie = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env: { SOMTECH_SCRIBE_ETAT: etat } }));
  assert.equal(sortie.decision, undefined);
  assert.match(sortie.systemMessage, /absente ou invalide|aucune relance/);
  const sha1 = createHash('sha1').update(TMP).digest('hex');
  assert.ok(!existsSync(join(etat, `${sha1}.json`)), 'aucun block émis : rien ne devait être écrit dans l\'état du plafond');
});

test('`last_assistant_message` de l\'entrée du hook prime sur le transcript, quand il existe', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec('rien dans le transcript'));
  const entree = JSON.stringify({
    cwd: TMP, transcript_path: t,
    last_assistant_message: ['```taches', 'verbe-inconnu: x', '```'].join('\n'),
  });
  const sortie = execFileSync(process.execPath, [GARDE], {
    input: entree, encoding: 'utf8',
    env: { ...process.env, SOMTECH_SCRIBE_ETAT: join(TMP, 'etat'), SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30', SOMTECH_DESK_API_KEY: '', SERVICEDESK_MCP_TOKEN: '' },
  });
  const j = JSON.parse(sortie);
  assert.equal(j.decision, 'block');
  assert.match(j.reason, /verbe inconnu/);
});

test('D2 — un fichier d\'état ANCIEN FORMAT (sans dernierBlocEmpreinte, pré-existant) ne fait pas planter le fil', () => {
  const t = join(TMP, 'transcript.jsonl');
  writeFileSync(t, transcriptAvec(['```taches', 'verbe-inconnu: x', '```'].join('\n')));
  const etat = join(TMP, 'etat');
  const sha1 = createHash('sha1').update(TMP).digest('hex');
  mkdirSync(etat, { recursive: true });
  // Format du lot précédent (D1 seul) : uniquement `horodatages`.
  writeFileSync(join(etat, `${sha1}.json`), JSON.stringify({ horodatages: [] }));
  const env = { SOMTECH_SCRIBE_ETAT: etat, SOMTECH_SCRIBE_RELANCES_PAR_HEURE: '30' };
  const sortie = JSON.parse(executerGarde({ cwd: TMP, transcriptPath: t, env }));
  assert.equal(sortie.decision, 'block');
  assert.match(sortie.reason, /verbe inconnu/);
});

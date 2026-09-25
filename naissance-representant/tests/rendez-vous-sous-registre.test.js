// rendez-vous-sous-registre.test.js — `service installer` REFUSE quand le registre des rondes
// du portail tourne, et ACCEPTE quand il ne tourne pas. Et la compétence ne le prescrit plus.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260925-0068)
//
// Le 20 sept., une session a suivi mot pour mot la compétence `orchestrateur` : elle a tapé
// `rendez-vous.js service installer`. Deux lanceurs `launchd` que le dirigeant avait fait
// retirer le 16 sept. sont revenus, et ont poussé des textes de rondes aux treize
// orchestrateurs SANS passer par le registre — sans affectation, sans trace. Le 16 sept.,
// le dirigeant avait décidé : « une seule source réveille les orchestrateurs ».
//
// ⚠️ UN TEXTE CORRIGÉ NE PROTÈGE QUE SES LECTEURS. Une copie installée plus vieille de la
// compétence prescrit encore l'installation. D'où la garde dans la commande elle-même.
//
// ⚠️ ET UNE GARDE SE JUGE DANS LES DEUX SENS. Un essai qui ne couvrirait que le refus
// resterait vert sur une commande qui refuse TOUT — y compris sur un poste neuf, sans
// registre, où ces lanceurs sont le seul réveil possible. C'est précisément le défaut du
// 15 août : un orchestrateur qui travaille des jours sans un seul réveil, et dont le silence
// ressemble trait pour trait à « rien à signaler ».
//
// ⚠️ LE SENS « ACCEPTE » SE LIT À LA CLOISON. Sous le lanceur de tests, l'installation est
// refusée par `cloison.js` (elle naîtrait hors cloison). Franchir la garde du registre se
// constate donc à ce que le refus rendu est CELUI DE LA CLOISON, et non celui du registre.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ETIQUETTE_REGISTRE, etatDuRegistre, verdictDInstallation } from '../src/rendez-vous.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const BIN = join(resolve(HERE, '..'), 'bin', 'rendez-vous.js');

// ═══════════════════════════════ la lecture de `launchctl print`

// Sorties RÉELLES mesurées le 2026-09-25 sur le poste du dirigeant :
//   `launchctl print gui/501/ca.somtech.rondes-portail` → rc 0, description du service ;
//   un service absent → rc 113, « Bad request. / Could not find service "…" in domain … ».
const ABSENT_MESURE =
  'Bad request.\nCould not find service "ca.somtech.rondes-portail" in domain for user gui: 501';

test('l’étiquette gardée est celle du registre des rondes du portail', () => {
  assert.equal(ETIQUETTE_REGISTRE, 'ca.somtech.rondes-portail');
});

test('launchctl répond → le registre est CHARGÉ', () => {
  const e = etatDuRegistre({ ok: true, outilIntrouvable: false, sortie: 'gui/501/ca.somtech.rondes-portail = {\n\tstate = not running' });
  assert.deepEqual({ mesure: e.mesure, charge: e.charge }, { mesure: true, charge: true });
});

test('« Could not find service » → le registre n’est PAS chargé, et c’est une mesure', () => {
  const e = etatDuRegistre({ ok: false, outilIntrouvable: false, sortie: ABSENT_MESURE });
  assert.deepEqual({ mesure: e.mesure, charge: e.charge }, { mesure: true, charge: false });
});

test('launchctl introuvable → NON MESURÉ, jamais « non chargé »', () => {
  const e = etatDuRegistre({ ok: false, outilIntrouvable: true, sortie: 'spawn /bin/launchctl ENOENT' });
  assert.equal(e.mesure, false);
  assert.equal(e.charge, null);
});

test('un autre échec de launchctl → NON MESURÉ : on ne lit pas une panne comme une absence', () => {
  const e = etatDuRegistre({ ok: false, outilIntrouvable: false, sortie: 'Operation not permitted' });
  assert.equal(e.mesure, false);
  assert.equal(e.charge, null);
});

test('verdict : registre chargé → REFUS, et le refus nomme le registre', () => {
  const v = verdictDInstallation({ mesure: true, charge: true });
  assert.equal(v.autorise, false);
  assert.match(v.motif, /rondes-portail/);
});

test('verdict : registre absent (mesuré) → ACCEPTÉ', () => {
  assert.equal(verdictDInstallation({ mesure: true, charge: false }).autorise, true);
});

test('verdict : registre non mesuré → REFUS, qui dit qu’on n’a pas pu mesurer', () => {
  const v = verdictDInstallation({ mesure: false, charge: null, motif: 'launchctl muet' });
  assert.equal(v.autorise, false);
  assert.match(v.motif, /pas pu|non mesur/i);
});

// ═══════════════════════════════ la commande réelle, dans les deux sens

function installer(registre) {
  const bac = mkdtempSync(join(tmpdir(), 'smtk-rdv-registre-'));
  try {
    const env = { ...process.env, LIGNE_DIRECTE_RACINE: join(bac, 'racine'), HERDR_SOCKET_PATH: '' };
    delete env.RENDEZ_VOUS_REGISTRE_ESSAIS;
    if (registre !== undefined) env.RENDEZ_VOUS_REGISTRE_ESSAIS = registre;
    const r = spawnSync(process.execPath, [BIN, 'service', 'installer'], { env });
    return { code: r.status ?? 1, stderr: (r.stderr ?? '').toString(), stdout: (r.stdout ?? '').toString() };
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

const REFUS_REGISTRE = /registre des rondes/i;
const CLOISON = /CLOISON D'ESSAIS/;

test('SENS 1 — registre CHARGÉ : `service installer` REFUSE au nom du registre, avant la cloison', () => {
  const r = installer('charge');
  assert.equal(r.code, 1, `refus attendu — stderr: ${r.stderr}`);
  assert.match(r.stderr, REFUS_REGISTRE, `le refus doit nommer le registre — stderr: ${r.stderr}`);
  assert.match(r.stderr, /rondes-portail/);
  assert.doesNotMatch(r.stderr, CLOISON, 'c’est la garde du registre qui doit refuser, pas la cloison');
});

test('SENS 2 — registre ABSENT : `service installer` FRANCHIT la garde (seule la cloison d’essais l’arrête)', () => {
  const r = installer('absent');
  assert.equal(r.code, 1, `la cloison d’essais doit arrêter l’installation — stderr: ${r.stderr}`);
  assert.match(r.stderr, CLOISON, `la garde du registre aurait dû laisser passer — stderr: ${r.stderr}`);
  assert.doesNotMatch(r.stderr, REFUS_REGISTRE, 'registre absent : aucun refus au nom du registre');
});

test('registre NON MESURÉ (double muet) : REFUS qui le dit — le doute ne se lit pas « absent »', () => {
  const r = installer('muet');
  assert.equal(r.code, 1);
  assert.match(r.stderr, /pas pu|non mesur/i, `stderr: ${r.stderr}`);
  assert.doesNotMatch(r.stderr, CLOISON);
});

test('sans double déclaré, l’essai ne mesure rien : REFUS « non mesuré », jamais un accord', () => {
  const r = installer(undefined);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /pas pu|non mesur/i, `stderr: ${r.stderr}`);
  assert.doesNotMatch(r.stderr, CLOISON, 'un double absent ne doit pas valoir « registre absent »');
});

// ═══════════════════════════════ la compétence ne prescrit plus l'installation

// Tout texte que le pack fait LIRE à un agent : compétences, gabarits, commandes, métier.
const LIEUX_LUS = ['.claude/skills', '.claude/templates', '.claude/commands', '.claude/agents', 'metier'];

function fichiersTexte(racine) {
  const out = [];
  let entrees;
  try { entrees = readdirSync(racine); } catch { return out; }
  for (const n of entrees) {
    const p = join(racine, n);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...fichiersTexte(p));
    else if (/\.(md|txt|ya?ml|json)$/.test(n)) out.push(p);
  }
  return out;
}

// La FONCTION cherchée, pas le mot : l'invocation d'installation des rendez-vous, sous ses
// deux noms (le fichier et le binaire déclaré dans package.json), sur une ligne JOINTE —
// une phrase coupée en deux lignes survivrait à un grep ligne à ligne.
const PRESCRIPTION = /(rendez-vous\.js|orchestrateur-rendez-vous)\s+service\s+installer/;

test('aucun texte lu par un agent ne prescrit `rendez-vous.js service installer`', () => {
  const fichiers = LIEUX_LUS.flatMap((l) => fichiersTexte(join(REPO_ROOT, l)));
  assert.ok(fichiers.length > 20, `balayage vide — ${fichiers.length} fichiers : le témoin ne regarderait rien`);
  const fautifs = fichiers.filter((f) => PRESCRIPTION.test(readFileSync(f, 'utf8').replace(/\s+/g, ' ')));
  assert.deepEqual(fautifs.map((f) => relative(REPO_ROOT, f)), []);
});

test('la compétence orchestrateur REMPLACE l’instruction : elle prescrit de vérifier l’affectation au registre', () => {
  const skill = readFileSync(join(REPO_ROOT, '.claude/skills/orchestrateur/SKILL.md'), 'utf8').replace(/\s+/g, ' ');
  assert.match(skill, /registre des rondes/i, 'retirer sans remplacer rend l’orchestrateur muet');
  assert.match(skill, /affectation/i);
  assert.match(skill, /rondes-portail/, 'la compétence doit dire que la commande refuse sous le registre');
});

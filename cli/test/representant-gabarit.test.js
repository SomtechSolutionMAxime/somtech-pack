// Le métier du représentant, dans le dépôt et dans le paquet publié.
//
// Trois familles, et aucune n'est décorative :
//
//   1. **Les gabarits existent, et le paquet les embarque.** Un gabarit présent au dépôt et
//      absent du paquet est exactement le défaut qu'EA-GBL-003 interdit — et le pack l'a
//      déjà commis : un payload parfait sur disque a produit un paquet amputé, sans qu'aucun
//      test, ni la CI, ni la publication ne s'en aperçoivent. La preuve se CONSTRUIT.
//
//   2. **Le métier dit ce qu'il doit dire.** Ces contrôles vivent dans `lib/metier-
//      representant.js` parce qu'une seconde suite — `representant-mutations.test.js` — les
//      rejoue sur des versions RETOURNÉES du gabarit. Un contrôle qui reste vert quand la
//      phrase qu'il couvre est remplacée par son contraire est décoratif ; ici, il est
//      démasqué au lieu d'être cru.
//
//   3. **Ce que le lot promet de ne pas casser.** La compétence `/gestionnaire-client`
//      actuelle survit jusqu'à E2 : ce lot la laisse strictement intacte.
//
// Traçabilité : EF-REL-014, RA-REL-013, RA-REL-014, RA-DIS-002, RA-DIS-004, EF-DIS-003.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTROLES, lireGabarits, CHEMIN_METIER, CHEMIN_CONTEXTE, REPO } from './lib/metier-representant.js';
import { readManifest } from '../src/modules.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const BUILD = join(CLI_DIR, 'scripts', 'build-payload.mjs');

const gabarits = lireGabarits();

// ═══════════════════════════════ 1. la chaîne de distribution

test('distribution : les deux gabarits existent dans les sources du dépôt', () => {
  // Le premier maillon. S'il casse, tous les suivants mentent en cascade — mieux vaut
  // qu'il le dise lui-même.
  for (const chemin of [CHEMIN_METIER, CHEMIN_CONTEXTE]) {
    assert.ok(existsSync(join(REPO, chemin)), `${chemin} est absent des sources`);
  }
});

test('distribution : ils vivent sous un chemin qu’un module déclaré embarque', () => {
  // La cause du mode de panne « présent au dépôt, absent du paquet » : un fichier posé
  // hors de tout chemin de module ne voyage pas, et rien ne le dit. On vérifie ici
  // l'appartenance ; le test suivant vérifie le résultat.
  const manifeste = readManifest(REPO);
  const chemins = Object.values(manifeste.modules).flatMap((m) => m.paths || []);
  const couvrant = chemins.filter((p) => CHEMIN_METIER.startsWith(p.replace(/\/+$/, '') + '/'));
  assert.ok(couvrant.length >= 1, `aucun module de pack.json ne couvre ${CHEMIN_METIER} — il ne partirait pas dans le paquet`);
});

test('distribution : le paquet CONSTRUIT les embarque, identiques à la source (RA-DIS-002)', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-repr-payload-'));
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: out }, stdio: 'pipe' });

  for (const [chemin, attendu] of [[CHEMIN_METIER, gabarits.metier], [CHEMIN_CONTEXTE, gabarits.contexte]]) {
    assert.ok(existsSync(join(out, chemin)), `${chemin} absent du paquet construit`);
    assert.equal(readFileSync(join(out, chemin), 'utf8'), attendu, `${chemin} publié diverge de la source (drift)`);
  }
});

// ── La survie au TARBALL npm est vérifiée dans `build-payload.test.js`, délibérément.
//
// Inspecter le répertoire `payload` ne prouve rien sur ce que npm met réellement dans le
// paquet : il applique les fichiers d'ignore IMBRIQUÉS au moment de packer, et c'est ainsi
// qu'un paquet amputé est déjà parti sans que personne le voie. Il faut donc interroger
// `npm pack`, qui lit `cli/payload` — un répertoire unique et partagé.
//
// Or `node --test` exécute UN PROCESSUS PAR FICHIER : deux fichiers qui construisent
// `cli/payload` se marchent dessus, l'un le supprimant pendant que l'autre l'empaquette.
// Le test qui perd la course accuse alors un fichier d'ignore imaginaire — c'est arrivé
// ici, et la CI l'a rattrapé. Un seul fichier touche donc à `cli/payload`.
//
// L'assertion elle-même n'est pas perdue : elle vit dans le test
// « paquet npm : le canvas et les gabarits du représentant survivent à la fabrication du
// tarball », qui interroge le vrai `cli/` — jamais une copie plus permissive.

// ═══════════════════════════════ 2. le métier dit ce qu'il doit dire

for (const controle of CONTROLES) {
  test(`métier : ${controle.quoi}`, () => controle.verifier(gabarits));
}

// ═══════════════════════════════ 3. ce que ce lot promet de ne pas casser

test('la compétence /gestionnaire-client actuelle est intacte — elle survit jusqu’à E2', () => {
  // Hors-scope explicite de l'epic : « elle survit telle quelle jusqu'à E2, qui la
  // remplacera. Ne pas la casser ici. » Sa propre suite (gestionnaire-client.test.js)
  // continue de la couvrir ; ce test-ci garde le fait qu'on ne l'a pas déplacée.
  const chemin = join(REPO, '.claude', 'skills', 'gestionnaire-client', 'SKILL.md');
  assert.ok(existsSync(chemin), 'la compétence a disparu — ce lot ne devait pas la retirer');
});

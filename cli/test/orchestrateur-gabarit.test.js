// Le métier de l'orchestrateur, dans le dépôt et dans le paquet publié.
//
// Trois familles, et aucune n'est décorative :
//
//   1. **Les gabarits existent, et le paquet les embarque.** Un gabarit présent au dépôt et
//      absent du paquet est exactement le défaut qu'EA-GBL-003 interdit — et le pack l'a déjà
//      commis : un payload parfait sur disque a produit un paquet amputé, sans qu'aucun test,
//      ni la CI, ni la publication ne s'en aperçoivent. La preuve se CONSTRUIT.
//
//   2. **Le métier dit ce qu'il doit dire.** Ces contrôles vivent dans
//      `lib/metier-orchestrateur.js` parce qu'une seconde suite — `orchestrateur-mutations.
//      test.js` — les rejoue sur des versions RETOURNÉES du gabarit. Un contrôle qui reste
//      vert quand la phrase qu'il couvre est remplacée par son contraire est décoratif ; ici
//      il est démasqué au lieu d'être cru.
//
//   3. **Ce que le lot promet de ne pas casser.** La compétence `/orchestrer-chantier`
//      actuelle survit jusqu'au lot qui la remplacera : celui-ci la laisse strictement intacte.
//
// Traçabilité : E-20260813-0001, D-20260813-0002, RA-DIS-002, RA-DIS-004, EF-DIS-003.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONTROLES, lireGabarits, GABARIT_DIR, CHEMIN_METIER, CHEMIN_CONTEXTE, CHEMIN_MCP, CHEMIN_PERMISSIONS,
  CHEMIN_COMPETENCE, REPO,
} from './lib/metier-orchestrateur.js';
import { readManifest } from '../src/modules.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const BUILD = join(CLI_DIR, 'scripts', 'build-payload.mjs');

const gabarits = lireGabarits();

// ═══════════════════════════════ 1. la chaîne de distribution

test('distribution : les QUATRE fichiers du lieu existent dans les sources du dépôt', () => {
  // Le lieu en compte quatre — le métier, le contexte, les outils, les permissions. N'en
  // garder que deux (ce que faisait ce test quand le gabarit n'en portait que deux) laisserait
  // naître un orchestrateur sans ses outils ni ses moyens bornés, derrière un test vert.
  for (const chemin of [CHEMIN_METIER, CHEMIN_CONTEXTE, CHEMIN_MCP, CHEMIN_PERMISSIONS]) {
    assert.ok(existsSync(join(REPO, chemin)), `${chemin} est absent des sources`);
  }
});

test('distribution : les outils du lieu sont lisibles et bornés à ce qu’il lui faut', () => {
  // Il tient le registre (ServiceDesk) et il est gardien des ADR, qui vivent dans les
  // documents (Somcraft) — sans ce second, il garderait de mémoire, ce que son métier lui
  // interdit désormais nommément.
  const mcp = JSON.parse(readFileSync(join(REPO, CHEMIN_MCP), 'utf8'));
  assert.deepEqual(Object.keys(mcp.mcpServers || {}).sort(), ['servicedesk', 'somcraft']);
});

test('distribution : les permissions ne portent aucun secret, et rien n’y est écrit en dur', () => {
  const brut = readFileSync(join(REPO, CHEMIN_PERMISSIONS), 'utf8');
  assert.ok(!/\/Users\//.test(brut), 'un chemin de machine est écrit en dur dans les permissions');
  const config = JSON.parse(brut);
  // T-20260816-0032 : les droits ont déménagé de `permissions.allow` vers `somtech.droitsAccordes`,
  // parce qu'un bloc `allow` dans le lieu déclenche un écran de confiance que la pré-approbation
  // ne fait pas taire (mesuré sur 2.1.233). Le fichier ne doit PLUS porter de bloc `allow` — un
  // qui reviendrait rendrait la naissance manuelle sans que rien ne le dise.
  assert.equal(config.permissions?.allow, undefined, 'un bloc permissions.allow est revenu : la naissance redeviendrait manuelle');
  const droits = config.somtech?.droitsAccordes;
  assert.ok(Array.isArray(droits) && droits.length > 0, 'un lieu sans aucun droit déclaré ferait tout demander');
  assert.ok(Array.isArray(config.permissions?.deny) && config.permissions.deny.length > 0, 'les refus sont la moitié qui garantit : ils ne peuvent pas disparaître');
});

test('distribution : ils vivent sous un chemin qu’un module déclaré embarque', () => {
  // La cause du mode de panne « présent au dépôt, absent du paquet » : un fichier posé hors
  // de tout chemin de module ne voyage pas, et rien ne le dit. On vérifie ici l'appartenance ;
  // le test suivant vérifie le résultat.
  const manifeste = readManifest(REPO);
  const chemins = Object.values(manifeste.modules).flatMap((m) => m.paths || []);
  const couvrant = chemins.filter((p) => CHEMIN_METIER.startsWith(p.replace(/\/+$/, '') + '/'));
  assert.ok(couvrant.length >= 1, `aucun module de pack.json ne couvre ${CHEMIN_METIER} — il ne partirait pas dans le paquet`);
});

test('distribution : le paquet CONSTRUIT les embarque, identiques à la source (RA-DIS-002)', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-orch-payload-'));
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: out }, stdio: 'pipe' });

  // ⚠️ On compare FICHIER À FICHIER, jamais contre `gabarits.metier` : depuis que
  // le métier est rendu, celui-ci porte le socle ET ses chapitres réunis, alors
  // que `CLAUDE.md` ne porte que le socle. Comparer l'un à l'autre rendrait un
  // faux « drift » — la mesure porterait sur deux objets différents.
  const aVerifier = [CHEMIN_METIER, CHEMIN_CONTEXTE];
  const chapitres = join(REPO, GABARIT_DIR, 'metier', 'chapitres');
  if (existsSync(chapitres)) {
    for (const f of readdirSync(chapitres)) aVerifier.push(join(GABARIT_DIR, 'metier', 'chapitres', f));
  }
  for (const chemin of aVerifier) {
    assert.ok(existsSync(join(out, chemin)), `${chemin} absent du paquet construit`);
    assert.equal(readFileSync(join(out, chemin), 'utf8'), readFileSync(join(REPO, chemin), 'utf8'),
      `${chemin} publié diverge de la source (drift)`);
  }
});

// ── La survie au TARBALL npm est vérifiée dans `build-payload.test.js`, délibérément :
// `node --test` exécute un processus par fichier, et deux fichiers qui construisent
// `cli/payload` se marchent dessus. Un seul fichier touche donc à ce répertoire partagé.

// ═══════════════════════════════ 2. le métier dit ce qu'il doit dire

for (const controle of CONTROLES) {
  test(`métier : ${controle.quoi}`, () => controle.verifier(gabarits));
}

// ═══════════════════════════════ 3. ce que ce lot promet de ne pas casser

test('la compétence /orchestrer-chantier actuelle est intacte — elle survit jusqu’au lot qui la remplacera', () => {
  // Hors-scope explicite de l'epic. Sa propre suite (`orchestrer-chantier.test.js` et
  // `orchestrer-chantier-mutations.test.js`) continue de la couvrir ; ce test-ci garde le
  // fait qu'on ne l'a ni déplacée ni vidée en la recopiant.
  const chemin = join(REPO, CHEMIN_COMPETENCE);
  assert.ok(existsSync(chemin), 'la compétence a disparu — ce lot ne devait pas la retirer');
  const src = readFileSync(chemin, 'utf8');
  assert.match(src, /^---\nname: orchestrer-chantier\n/, 'la compétence a perdu son en-tête : elle ne s’invoquerait plus');
});

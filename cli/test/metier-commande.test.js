// metier-commande.test.js — la commande `pack metier` (revue du 2026-08-20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMetier } from '../src/commands/metier.js';

function projet() {
  const d = mkdtempSync(join(tmpdir(), 'metier-'));
  mkdirSync(join(d, 'metier/r/chapitres'), { recursive: true });
  // le gabarit existe AVANT le premier rendu — sinon `distribuerAuGabarit` sort
  // sans rien poser, et les contrôles de distribution ne mesurent rien.
  mkdirSync(join(d, '.claude/templates/r'), { recursive: true });
  writeFileSync(join(d, 'metier/r/chapitres/c1.md'), '## Le geste\n\nLe comment, écrit à la main.\n');
  writeFileSync(join(d, 'metier/r/classement.json'), JSON.stringify({
    role: 'r', version_abc: '1.0.0',
    // ⚠️ des refus RÉELS : sans eux, `permissions.deny` est déjà vide et « le
    // vider » ne change rien — le contrôle du gate ne mesurerait alors rien.
    refus: ['Write', 'Task'],
    hooks: [{ evenement: 'PreToolUse', outil: 'Bash', garde: 'terminal' }],
    items: [{ id: 'GF-R-001', nature: 'garde-fou', couche: 'hook', enonce: 'x', enonce_socle: 'court' }],
    chapitres: [{ nom: 'c1', abrege: 'a', version_pack: '1.0.0' }],
  }));
  return d;
}

test('le contenu d un chapitre a UNE seule source : le fichier .md, jamais une copie dans le JSON', () => {
  const d = projet();
  assert.equal(runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d }), 0);
  const rendu = readFileSync(join(d, 'metier/r/rendu/chapitres/c1.md'), 'utf8');
  assert.ok(rendu.includes('Le comment, écrit à la main.'),
    'le rendu doit lire le .md — sinon éditer ce fichier est un no-op silencieux');

  // on modifie le .md : le rendu suivant doit le refléter, sans toucher au JSON
  writeFileSync(join(d, 'metier/r/chapitres/c1.md'), '## Le geste\n\nTexte modifié.\n');
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.ok(readFileSync(join(d, 'metier/r/rendu/chapitres/c1.md'), 'utf8').includes('Texte modifié.'));
  rmSync(d, { recursive: true, force: true });
});

test('`verifier` détecte un rendu périmé face à sa source — sinon rien ne le signalerait', () => {
  const d = projet();
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.equal(runMetier(['metier', 'verifier', '--role', 'r'], { cwd: d }), 0, 'rendu frais : conforme');

  writeFileSync(join(d, 'metier/r/chapitres/c1.md'), '## Le geste\n\nSource changée sans re-rendu.\n');
  assert.notEqual(runMetier(['metier', 'verifier', '--role', 'r'], { cwd: d }), 0,
    'une source modifiée sans re-rendu doit sortir non nul');
  rmSync(d, { recursive: true, force: true });
});

test('un chapitre retiré du classement ne laisse pas son fichier rendu derrière lui', () => {
  const d = projet();
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.ok(existsSync(join(d, 'metier/r/rendu/chapitres/c1.md')));

  const cl = JSON.parse(readFileSync(join(d, 'metier/r/classement.json'), 'utf8'));
  cl.chapitres = [];
  writeFileSync(join(d, 'metier/r/classement.json'), JSON.stringify(cl));
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.ok(!existsSync(join(d, 'metier/r/rendu/chapitres/c1.md')),
    'un fichier orphelin reste suivi par git et livré, sans que rien ne le signale');
  rmSync(d, { recursive: true, force: true });
});

test('un rôle absent, vide ou qui remonte le chemin est refusé AVANT toute lecture de disque', () => {
  const d = projet();
  // ⚠️ « code non nul » ne distingue rien : sans validation, une valeur absurde
  // finit par lever une erreur de chemin qui sort aussi non nul. On exige donc
  // le code 2 (usage) et le message d'usage, pas un plantage traduit.
  // Mesuré par mutation le 2026-08-20.
  for (const argv of [['metier', 'rendre', '--role'], ['metier', 'rendre', '--role', '../evade'],
                      ['metier', 'rendre', '--role', '--json'], ['metier', 'rendre', '--role', 'A/B']]) {
    assert.equal(runMetier(argv, { cwd: d }), 2, `${argv.join(' ')} doit être refusé en usage, pas planter`);
  }
  // et un rôle valide mais inexistant est un autre cas : code 1, pas 2
  assert.equal(runMetier(['metier', 'rendre', '--role', 'inexistant'], { cwd: d }), 1);
  rmSync(d, { recursive: true, force: true });
});

// ——— corrections de la revue indépendante du 2026-08-20 (2e passe) ———

test('FINDING 2 — `verifier` détecte un fichier de droits distribué qui a été vidé', () => {
  const d = projet();
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.equal(runMetier(['metier', 'verifier', '--role', 'r'], { cwd: d }), 0);

  const p = join(d, '.claude/templates/r/.claude/settings.json');
  const s = JSON.parse(readFileSync(p, 'utf8'));
  s.permissions.deny = [];                       // ce qui garantit, vidé
  writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
  assert.notEqual(runMetier(['metier', 'verifier', '--role', 'r'], { cwd: d }), 0,
    'vider les refus distribués passerait le gate, et tout agent posé ensuite pourrait écrire');
  rmSync(d, { recursive: true, force: true });
});

test('FINDING 3 — `verifier` détecte un chapitre ORPHELIN laissé dans le gabarit', () => {
  const d = projet();
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  writeFileSync(join(d, '.claude/templates/r/metier/chapitres/zz-orphelin.md'), 'plus produit\n');
  assert.notEqual(runMetier(['metier', 'verifier', '--role', 'r'], { cwd: d }), 0,
    '`verifier` vert doit impliquer que `rendre` ne changerait rien — c est le contrat du gate');
  rmSync(d, { recursive: true, force: true });
});

test('FINDING 4 — un fichier de droits que le rendu ne produit plus est RETIRÉ du gabarit', () => {
  const d = projet();
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.ok(existsSync(join(d, '.claude/templates/r/.claude/settings.json')));

  const cl = JSON.parse(readFileSync(join(d, 'metier/r/classement.json'), 'utf8'));
  cl.items[0].couche = 'persona';
  cl.items[0].sans_garantie = { motif: 'm', assume_par: 'a', definitif: true };
  delete cl.hooks; delete cl.refus; delete cl.droits;
  writeFileSync(join(d, 'metier/r/classement.json'), JSON.stringify(cl));
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.ok(!existsSync(join(d, '.claude/templates/r/.claude/settings.json')),
    'un fichier de droits périmé continuerait d être posé à chaque naissance');
  rmSync(d, { recursive: true, force: true });
});

test('FINDING 5 — un DOSSIER égaré parmi les chapitres ne fait pas planter le rendu', () => {
  const d = projet();
  mkdirSync(join(d, '.claude/templates/r/metier/chapitres/vieux-dossier'), { recursive: true });
  assert.equal(runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d }), 0,
    'le rendu ne doit pas s interrompre à moitié appliqué sur un EISDIR');
  rmSync(d, { recursive: true, force: true });
});

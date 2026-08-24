// metier-gabarit.test.js — le gabarit distribué EST le rendu, jamais un texte à la main.
//
// C'est le maillon qui rend le modèle réel : sans lui, `pack metier rendre`
// produit des artefacts à côté, et `/orchestrateur` continue de poser les
// 25 283 mots écrits à la main. Le rendu existait sans atteindre personne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROLES = ['orchestrateur', 'gestionnaire-client'];

for (const role of ROLES) {
  const gabarit = join(RACINE, '.claude', 'templates', role);
  const rendu = join(RACINE, 'metier', role, 'rendu');

  test(`${role} — le CLAUDE.md distribué est exactement L0 + L1 du rendu`, () => {
    const attendu = readFileSync(join(rendu, 'L0.md'), 'utf8') + readFileSync(join(rendu, 'L1.md'), 'utf8');
    const distribue = readFileSync(join(gabarit, 'CLAUDE.md'), 'utf8');
    assert.equal(distribue, attendu,
      `le gabarit de ${role} a divergé de son rendu — il a été édité à la main, ou le rendu n'a pas été rejoué`);
  });

  test(`${role} — les chapitres distribués sont ceux du rendu, ni plus ni moins`, () => {
    const src = readdirSync(join(rendu, 'chapitres')).sort();
    const dst = existsSync(join(gabarit, 'metier', 'chapitres'))
      ? readdirSync(join(gabarit, 'metier', 'chapitres')).sort() : [];
    assert.deepEqual(dst, src, 'un chapitre en trop reste distribué à jamais ; un chapitre manquant laisse un renvoi dans le vide');
    for (const f of src) {
      assert.equal(readFileSync(join(gabarit, 'metier', 'chapitres', f), 'utf8'),
                   readFileSync(join(rendu, 'chapitres', f), 'utf8'), `le chapitre ${f} a divergé`);
    }
  });

  test(`${role} — le fichier de droits distribué est celui que le rendu produit`, () => {
    assert.equal(readFileSync(join(gabarit, '.claude', 'settings.json'), 'utf8'),
                 readFileSync(join(rendu, '.claude', 'settings.json'), 'utf8'),
      'les refus et les hooks distribués doivent venir du classement, pas d une main');
  });

  test(`${role} — le socle distribué tient dans son budget`, async () => {
    const { compterTokens, BUDGETS } = await import('../src/metier/rendu.js');
    const n = compterTokens(readFileSync(join(gabarit, 'CLAUDE.md'), 'utf8'));
    assert.ok(n <= BUDGETS.L0 + BUDGETS.L1,
      `le socle distribué de ${role} pèse ${n} tokens pour un plafond de ${BUDGETS.L0 + BUDGETS.L1}`);
  });

  test(`${role} — CONTEXTE.md n est PAS produit par le rendu et survit`, () => {
    assert.ok(existsSync(join(gabarit, 'CONTEXTE.md')), 'le gabarit de contexte doit rester');
    assert.ok(!existsSync(join(rendu, 'CONTEXTE.md')), 'le rendu ne doit jamais en produire un (I6)');
  });
}

test('le gabarit ne contient plus de métier écrit à la main — la taille le prouve', () => {
  // Le gabarit de l'orchestrateur pesait 25 283 mots. Un socle en pèse moins de mille.
  const n = readFileSync(join(RACINE, '.claude/templates/orchestrateur/CLAUDE.md'), 'utf8').split(/\s+/).length;
  assert.ok(n < 2000, `le gabarit pèse ${n} mots — un socle rendu en pèse moins de mille, un métier écrit à la main 25 000`);
});

// ——— la DISTRIBUTION elle-même, éprouvée sur un projet jetable ———
//
// ⚠️ Les tests ci-dessus gardent l'ÉTAT COMMITTÉ : ils attrapent un gabarit
// édité à la main ou un rendu non rejoué, et c'est leur travail de gate en CI.
// Mais ils NE TESTENT PAS le geste de distribution : mesuré par mutation le
// 2026-08-20, désarmer entièrement `distribuerAuGabarit` les laissait TOUS
// VERTS — les fichiers étaient déjà corrects d'un rendu précédent, donc ne rien
// écrire ne changeait rien. Six mutations, zéro rouge.
//
// Ceux qui suivent partent d'un gabarit VIDE ou FAUX, et exigent que le geste
// le remplisse. C'est la moitié qui manquait.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runMetier } from '../src/commands/metier.js';

function projetAvecGabarit() {
  const d = mkdtempSync(join(tmpdir(), 'gabarit-'));
  mkdirSync(join(d, 'metier/r/chapitres'), { recursive: true });
  mkdirSync(join(d, '.claude/templates/r/metier/chapitres'), { recursive: true });
  writeFileSync(join(d, 'metier/r/chapitres/c1.md'), '## Le geste\n\nLe comment.\n');
  writeFileSync(join(d, 'metier/r/classement.json'), JSON.stringify({
    role: 'r', version_abc: '1.0.0',
    refus: ['Write'], hooks: [{ evenement: 'PreToolUse', outil: 'Bash', garde: 'terminal' }],
    items: [{ id: 'GF-R-001', nature: 'garde-fou', couche: 'hook', enonce: 'x', enonce_socle: 'court' }],
    chapitres: [{ nom: 'c1', abrege: 'a', version_pack: '1.0.0' }],
  }));
  // un gabarit qui porte du VIEUX : c'est ce que la distribution doit remplacer
  writeFileSync(join(d, '.claude/templates/r/CLAUDE.md'), 'ANCIEN MÉTIER ÉCRIT À LA MAIN\n');
  writeFileSync(join(d, '.claude/templates/r/CONTEXTE.md'), 'CE QUI EST PROPRE AU DÉPÔT\n');
  writeFileSync(join(d, '.claude/templates/r/metier/chapitres/disparu.md'), 'un chapitre que le classement ne produit plus\n');
  return d;
}

test('DISTRIBUTION — le rendu REMPLACE le métier écrit à la main dans le gabarit', () => {
  const d = projetAvecGabarit();
  assert.equal(runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d }), 0);
  const pose = readFileSync(join(d, '.claude/templates/r/CLAUDE.md'), 'utf8');
  assert.ok(!pose.includes('ANCIEN MÉTIER'), 'le métier écrit à la main doit disparaître du gabarit');
  assert.ok(pose.includes('GF-R-001'), 'le socle rendu doit le remplacer');
  assert.ok(pose.includes('Ce qui prime'), 'L1 doit être dans le gabarit, pas seulement L0');
  rmSync(d, { recursive: true, force: true });
});

test('DISTRIBUTION — les chapitres et le fichier de droits arrivent dans le gabarit', () => {
  const d = projetAvecGabarit();
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.ok(readFileSync(join(d, '.claude/templates/r/metier/chapitres/c1.md'), 'utf8').includes('Le comment.'));
  assert.ok(readFileSync(join(d, '.claude/templates/r/.claude/settings.json'), 'utf8').includes('deny'));
  rmSync(d, { recursive: true, force: true });
});

test('DISTRIBUTION — un chapitre que le classement ne produit plus est RETIRÉ du gabarit', () => {
  const d = projetAvecGabarit();
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.ok(!existsSync(join(d, '.claude/templates/r/metier/chapitres/disparu.md')),
    'un chapitre orphelin resterait distribué à jamais');
  rmSync(d, { recursive: true, force: true });
});

test('DISTRIBUTION — CONTEXTE.md du gabarit n est JAMAIS touché (I6)', () => {
  const d = projetAvecGabarit();
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });
  assert.equal(readFileSync(join(d, '.claude/templates/r/CONTEXTE.md'), 'utf8'), 'CE QUI EST PROPRE AU DÉPÔT\n');
  rmSync(d, { recursive: true, force: true });
});

test('DISTRIBUTION — un rendu REFUSÉ ne distribue rien : le gabarit garde ce qu il avait', () => {
  const d = projetAvecGabarit();
  const cl = JSON.parse(readFileSync(join(d, 'metier/r/classement.json'), 'utf8'));
  delete cl.hooks;                       // GF-R-001 est classé « hook » : le rendu doit refuser
  writeFileSync(join(d, 'metier/r/classement.json'), JSON.stringify(cl));
  assert.notEqual(runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d }), 0);
  assert.ok(readFileSync(join(d, '.claude/templates/r/CLAUDE.md'), 'utf8').includes('ANCIEN MÉTIER'),
    'un rendu refusé ne doit rien écrire — sinon il distribue un métier qu il vient de juger irrecevable');
  rmSync(d, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 LE MAILLON QUI MANQUAIT — le rendu VERSIONNÉ contre le rendu RECALCULÉ
//
// Les contrôles ci-dessus comparent deux artefacts VERSIONNÉS l'un à l'autre :
// le gabarit distribué et le rendu committé. Ils voient un ÉCART entre eux ;
// ils ne peuvent pas voir une ERREUR PARTAGÉE.
//
// ⚠️ **Deux objets identiques ne se valident pas l'un l'autre.** Mesuré le
// 2026-08-24, sur ce lot même : la fonction qui fabrique les commandes de hook a
// été durcie, mais le rendu n'a été rejoué que pour l'orchestrateur. Le gabarit
// du gestionnaire-client ET son rendu committé sont donc restés périmés — DE LA
// MÊME FAÇON, donc parfaitement cohérents entre eux, donc invisibles à tout
// contrôle d'identité. Le dépôt distribuait deux formes différentes de la même
// commande, dont une avec un mode de panne connu, et rien ne le disait.
//
// Ce contrôle-ci ferme la boucle : il REJOUE le rendu depuis le classement et le
// compare à ce qui est committé. Un changement dans `rendu.js` qui n'a pas été
// redistribué rougit, pour TOUS les rôles à la fois.
//
// Il fait en CI ce que `pack metier verifier` faisait à la main — et que rien
// n'appelait (relevé par la revue de fond du 2026-08-24).

test('🔴 le rendu committé est celui que le code produit AUJOURD’HUI — pour tous les rôles', async () => {
  const { rendre } = await import('../src/metier/rendu.js');
  const { lireClassement } = await import('../src/commands/metier.js');

  const perimes = [];
  for (const role of ROLES) {
    const artefacts = rendre(lireClassement(RACINE, role)).artefacts;
    for (const [chemin, attendu] of Object.entries(artefacts)) {
      const committe = join(RACINE, 'metier', role, 'rendu', chemin);
      if (!existsSync(committe)) { perimes.push(`${role} · ${chemin} : ABSENT du rendu committé`); continue; }
      if (readFileSync(committe, 'utf8') !== attendu) perimes.push(`${role} · ${chemin} : périmé`);
    }
  }
  assert.deepEqual(perimes, [],
    'le rendu committé ne correspond plus à ce que le code produit :\n  ' + perimes.join('\n  ')
    + '\n\n🔴 Un changement dans « rendu.js » n\'a pas été redistribué. Les contrôles d\'identité '
    + 'ci-dessus ne peuvent PAS l\'attraper : gabarit et rendu sont alors périmés de la même façon, '
    + 'donc cohérents entre eux. Deux objets identiques ne se valident pas l\'un l\'autre.'
    + '\n  Relance : node cli/bin/somtech-pack.js metier rendre --role <chacun des rôles>');
});

// La compétence de DÉSIGNATION — `/joindre-les-agents` — sa distribution et ses garanties.
//
// T-20260814-0071, et c'est la TROISIÈME fois que le même motif se produit : la mécanique est
// livrée et publiée (le canal commun par rôle en v1.46.0, la ligne du dirigeant en v1.45.0),
// et l'INTERFACE manque. Le dirigeant s'est retrouvé avec trois commandes brutes à taper, dont
// une qui exige un nom de rôle — `representant` — que personne ne prononce jamais en parlant.
//
// Ce fichier exécute les contrôles sur le texte RÉEL : ils doivent tous passer. Puis il les
// exécute sur des versions RETOURNÉES du même texte, et exige que le contrôle VISÉ rougisse
// pour chacune. Un contrôle qu'aucune mutation n'éprouve est un contrôle dont on ignore s'il
// tient — c'est le motif dominant de ce dépôt, et il a survécu à quatre passes de revue
// ailleurs.
//
// Ce que ce fichier NE prouve PAS, et il faut le savoir avant de s'y fier : le comportement de
// `commun` et `dirigeant` eux-mêmes. Ils ne sont pas touchés par ce lot — leurs refus, leur
// idempotence et leur registre sont prouvés dans `ligne-directe/tests/`. On ne prouve ici que
// la conformité du TEXTE au code qui existe déjà. Un texte n'exécute rien.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installGlobalSkills } from '../src/globalskills.js';
import {
  COMPETENCE,
  CONTROLES,
  CHEMINS_DES_REFUS,
  IDS_COMMUNS_ECARTES,
  MUTATIONS,
  REPO,
  communsRetenus,
  controlesQuiRougissent,
  idsDesControles,
  lireCompetence,
} from './lib/competence-joindre.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(resolve(HERE, '..'), 'scripts', 'build-payload.mjs');
const SOURCE = join(REPO, COMPETENCE.chemin);

// ═══════════════════════════════ 1. la chaîne de distribution (EA-GBL-003)

test('distribution : la compétence existe dans les sources du dépôt', () => {
  assert.ok(existsSync(SOURCE), `${COMPETENCE.chemin} est absent des sources`);
});

test('distribution : elle atterrit dans les compétences globales d’un poste vierge', () => {
  const skillsDir = mkdtempSync(join(tmpdir(), 'smtk-joindre-'));
  const r = installGlobalSkills({ payloadRoot: REPO, skillsDir });

  assert.ok(r.skills.includes(COMPETENCE.nom), `${COMPETENCE.nom} absent des compétences installées`);
  assert.equal(
    readFileSync(join(skillsDir, COMPETENCE.nom, 'SKILL.md'), 'utf8'),
    lireCompetence(),
    'la version installée diverge de la source',
  );
});

test('distribution : le paquet publié l’embarque, CONSTRUIT depuis la source (RA-DIS-002)', () => {
  // Une compétence qui n'est pas dans le paquet publié n'existe que sur le poste qui l'a
  // écrite — c'est-à-dire nulle part, pour celui qui en a besoin.
  const out = mkdtempSync(join(tmpdir(), 'smtk-joindre-payload-'));
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: out }, stdio: 'pipe' });

  assert.ok(existsSync(join(out, COMPETENCE.chemin)), `${COMPETENCE.chemin} absent du paquet publié`);
  assert.equal(
    readFileSync(join(out, COMPETENCE.chemin), 'utf8'),
    lireCompetence(),
    'la version publiée diverge de la source (drift)',
  );
});

test('distribution : les fichiers qui portent les refus existent tous', () => {
  // Un contrôle qui lit un fichier disparu jetterait un ENOENT que le harnais compterait comme
  // une garde qui mord. On vérifie d'abord que le terrain est là.
  for (const c of CHEMINS_DES_REFUS) {
    assert.ok(existsSync(join(REPO, c)), `${c} a disparu — la garde des citations ne prouverait plus rien`);
  }
});

// ═══════════════════════════════ 2. les garanties, sur le texte réel

test('référence : aucun contrôle ne rougit sur la compétence livrée', () => {
  const rouges = controlesQuiRougissent(lireCompetence());
  assert.deepEqual(
    rouges.map((r) => r.id),
    [],
    'des contrôles rougissent sur le texte livré :\n  ' + rouges.map((r) => `${r.id} → ${r.message}`).join('\n  '),
  );
});

test('les garanties communes retenues portent bien sur cette compétence', () => {
  // Le filtre par identifiant est le point faible d'une réutilisation : renommé en amont, il
  // ne retient plus rien et la suite reste verte. `communsRetenus()` refuse ce cas — ce test
  // prouve qu'il refuse, et que ce qu'il retient est réellement exécuté.
  const retenus = communsRetenus();
  assert.ok(retenus.length >= 5, `des garanties communes ont cessé de s’appliquer (${retenus.length} retenue·s)`);
  const executes = [];
  for (const c of retenus) {
    c.verifier({ texte: lireCompetence(), nom: COMPETENCE.nom, racine: REPO });
    executes.push(c.id);
  }
  for (const c of CONTROLES) {
    c.verifier({ texte: lireCompetence(), nom: COMPETENCE.nom, racine: REPO });
    executes.push(c.id);
  }
  assert.deepEqual(executes, idsDesControles(), 'des contrôles n’ont pas été exécutés');
  assert.ok(IDS_COMMUNS_ECARTES.length > 0, 'les garanties écartées doivent rester nommées, pas oubliées');
});

// ═══════════════════════════════ 3. les mutations — chaque contrôle est éprouvé

test('chaque mutation change vraiment le texte — sinon elle n’éprouve rien', () => {
  const source = lireCompetence();
  const inertes = MUTATIONS.filter((m) => m.muter(source) === source).map((m) => m.id);
  assert.deepEqual(inertes, [], `ces mutations ne modifient rien (le texte a bougé sous elles) : ${inertes.join(', ')}`);
});

for (const m of MUTATIONS) {
  test(`mutation « ${m.id} » : ${m.quoi} → « ${m.cible} » rougit`, () => {
    const rouges = controlesQuiRougissent(m.muter(lireCompetence())).map((r) => r.id);
    assert.ok(
      rouges.includes(m.cible),
      `le contrôle « ${m.cible} » est resté vert sur « ${m.id} » — il ne garde pas ce que son nom promet `
        + `(ont rougi : ${rouges.join(', ') || 'aucun'})`,
    );
  });
}

test('aucun contrôle n’échappe aux mutations', () => {
  // Un contrôle qu'aucune mutation ne vise est un contrôle décoratif : il reste vert pour
  // toujours et personne ne le sait. Le compte EST la garde.
  const vises = new Set(MUTATIONS.map((m) => m.cible));
  const orphelins = idsDesControles().filter((id) => !vises.has(id));
  assert.deepEqual(orphelins, [], `ces contrôles ne sont éprouvés par aucune mutation : ${orphelins.join(', ')}`);
});

// ═══════════════════════════════ 4. ce que la promesse de CETTE compétence interdit

test('NÉGATIF : elle ne parle jamais SUR une ligne — elle désigne où l’on parle', () => {
  // La frontière avec `/ligne-directe`, et elle n'est pas cosmétique : un opérateur qui
  // ouvrirait ou fermerait une ligne depuis cette compétence-ci poserait un canal au nom d'un
  // agent qui n'existe pas encore.
  const texte = lireCompetence();
  for (const geste of ['$LD ouvrir', '$LD dire', '$LD demander', '$LD fermer', '$LD renommer']) {
    assert.ok(!texte.includes(geste), `la compétence tient une ligne elle-même (« ${geste} ») — ce n’est pas son geste`);
  }
});

test('NÉGATIF : elle n’écrit rien dans un dépôt, et elle le DIT', () => {
  // Les deux compétences de pose versent leur travail dans une branche ; celle-ci n'a rien à
  // verser — ce qu'elle inscrit vit sur le poste. Un bloc `git` ici ferait commiter un
  // changement qui n'existe pas, et la PR vide qui suit use la revue.
  const texte = lireCompetence();
  for (const bloc of texte.matchAll(/```bash\n([\s\S]*?)```/g)) {
    for (const geste of ['git ', 'gh pr', 'npm publish', 'supabase db']) {
      assert.ok(!bloc[1].includes(geste), `un bloc à exécuter fait « ${geste}… » : cette compétence n’écrit dans aucun dépôt`);
    }
  }
  assert.match(
    texte,
    /n[e’']écrit rien dans le dépôt/i,
    'le texte doit dire qu’elle n’écrit rien dans le dépôt — sinon on lui cherchera une branche',
  );
});

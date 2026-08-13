// La compétence de pose de l'orchestrateur — sa DISTRIBUTION, et les garanties qu'elle tient.
//
// T-20260813-0030 : la mécanique des deux rôles était livrée et publiée (v1.37.0) ; il
// manquait l'INTERFACE. Le gestionnaire client, lui, en avait une — et les sept défauts qu'il
// a produits sont tous sortis de l'usage, jamais de la mécanique. Deux d'entre eux étaient
// des MESSAGES : un refus qui affirmait ce qu'il n'avait pas mesuré (et donnait une commande
// qui écrasait un jeton en service), et un lieu vide déclaré installé. Ce qu'on écrit ici est
// ce que l'humain lira quand quelque chose refusera.
//
// Ce fichier exécute les contrôles sur les textes RÉELS : ils doivent tous passer. Le fichier
// jumeau — `competence-orchestrateur-mutations.test.js` — les exécute sur des versions
// RETOURNÉES et exige que le contrôle visé rougisse. Un contrôle qu'aucune mutation n'éprouve
// est un contrôle dont on ignore s'il tient.
//
// Le comportement RÉEL de la pose — « rien n'a été créé » prouvé par l'ABSENCE sur disque —
// n'est pas reprouvé ici : il l'est au niveau du code, dans
// `ligne-directe/tests/orchestrateur-lieu.test.js`, et en conditions réelles dans
// `scripts/tests/test-naissance-orchestrateur-reel.sh`. Ce fichier-ci ne prouve que la
// conformité du TEXTE à ce code — un texte n'exécute rien.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installGlobalSkills } from '../src/globalskills.js';
import {
  COMPETENCES,
  CONTROLES_COMMUNS,
  CONTROLES_ORCHESTRATEUR,
  REPO,
  cheminsLus,
  controlesQuiRougissent,
  lireCompetences,
} from './lib/competences-de-pose.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const BUILD = join(CLI_DIR, 'scripts', 'build-payload.mjs');

const NOM = COMPETENCES.orchestrateur.nom;
const CHEMIN = COMPETENCES.orchestrateur.chemin;
const SOURCE = join(REPO, CHEMIN);

const skill = () => readFileSync(SOURCE, 'utf8');

// ═══════════════════════════════ 1. la chaîne de distribution (EA-GBL-003)

test('distribution : la compétence existe dans les sources du dépôt', () => {
  assert.ok(existsSync(SOURCE), `${CHEMIN} est absent des sources`);
});

test('distribution : elle atterrit dans les compétences globales d’un poste vierge', () => {
  const skillsDir = mkdtempSync(join(tmpdir(), 'smtk-orch-'));
  const r = installGlobalSkills({ payloadRoot: REPO, skillsDir });

  assert.ok(r.skills.includes(NOM), `${NOM} absent des compétences installées`);
  assert.equal(
    readFileSync(join(skillsDir, NOM, 'SKILL.md'), 'utf8'),
    skill(),
    'la version installée diverge de la source',
  );
});

test('distribution : le paquet publié l’embarque, CONSTRUIT depuis la source (RA-DIS-002)', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-orch-payload-'));
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: out }, stdio: 'pipe' });

  assert.ok(existsSync(join(out, CHEMIN)), `${CHEMIN} absent du paquet publié`);
  assert.equal(readFileSync(join(out, CHEMIN), 'utf8'), skill(), 'la version publiée diverge de la source (drift)');
});

test('distribution : les contrôles portent sur des fichiers qui existent tous', () => {
  // Un contrôle qui lit un fichier disparu jetterait un ENOENT que le harnais compterait
  // comme une garde qui mord. On vérifie d'abord que le terrain est là.
  const attendus = 6; // deux compétences, la ligne, la naissance, le CLI, les modules de refus
  assert.ok(
    cheminsLus().length >= attendus,
    `des fichiers lus par les contrôles ont disparu (${cheminsLus().length} trouvés, ${attendus} attendus)`,
  );
});

// ═══════════════════════════════ 2. les garanties, sur les textes réels

test('référence : aucun contrôle ne rougit sur les compétences réelles', () => {
  const rouges = controlesQuiRougissent(lireCompetences());
  assert.deepEqual(
    rouges.map((r) => r.id),
    [],
    'des contrôles rougissent sur les textes livrés :\n  '
      + rouges.map((r) => `${r.id} → ${r.message}`).join('\n  '),
  );
});

test('les garanties communes s’appliquent bien aux DEUX compétences de pose', () => {
  // La factorisation n'est pas une économie de lignes : c'est ce qui empêche un défaut
  // corrigé d'un côté de survivre de l'autre. Si un jour une compétence de pose échappait à
  // ces contrôles, ce test le dirait — le compte est la garde.
  const attendus = CONTROLES_COMMUNS.length * Object.keys(COMPETENCES).length + CONTROLES_ORCHESTRATEUR.length;
  const executes = [];
  for (const [cle, texte] of Object.entries(lireCompetences())) {
    for (const c of CONTROLES_COMMUNS) {
      c.verifier({ texte, nom: COMPETENCES[cle].nom, racine: REPO });
      executes.push(`${c.id}@${cle}`);
    }
  }
  for (const c of CONTROLES_ORCHESTRATEUR) {
    c.verifier({ texte: lireCompetences().orchestrateur, nom: NOM, racine: REPO });
    executes.push(`${c.id}@orchestrateur`);
  }
  assert.equal(executes.length, attendus, 'des contrôles n’ont pas été exécutés');
  assert.ok(Object.keys(COMPETENCES).length >= 2, 'les garanties communes doivent porter sur plus d’une compétence');
});

// ═══════════════════════════════ 3. ce que la promesse de CETTE compétence interdit

test('NÉGATIF : elle ne devient jamais l’orchestrateur — elle prépare son lieu', () => {
  // Le métier vit dans le `CLAUDE.md` du lieu (couvert par orchestrateur-gabarit.test.js) et
  // dans /orchestrer-chantier. Sa réapparition ici signalerait un lot à moitié fait : deux
  // sources qui disent la même chose divergent, c'est mécanique.
  const texte = skill();
  for (const geste of ['$LD ouvrir', '$LD demander', '$LD dire']) {
    assert.ok(!texte.includes(geste), `la compétence ouvre ou tient la ligne elle-même (« ${geste} ») — ce n’est pas son geste`);
  }
  assert.ok(
    !/mcp__servicedesk__/.test(texte),
    'la compétence tient le registre elle-même : c’est le métier de l’orchestrateur né, pas celui de sa pose',
  );
});

test('NÉGATIF : elle ne déploie, ne publie ni ne fusionne rien (HS-REL-001)', () => {
  const texte = skill();
  for (const bloc of texte.matchAll(/```bash\n([\s\S]*?)```/g)) {
    for (const geste of ['npm publish', '/pousse-staging', 'supabase db', 'gh pr merge', 'git push --force']) {
      assert.ok(!bloc[1].includes(geste), `la compétence enseigne « ${geste} » : elle ne fusionne ni ne déploie`);
    }
  }
});

test('NÉGATIF : elle n’exclut pas Somcraft — et c’est une différence, pas un oubli', () => {
  // Le représentant, lui, ne l'a PAS dans ses moyens : il porterait les documents de tous les
  // clients. L'orchestrateur travaille en interne et en a besoin. Recopier l'exclusion du lot
  // jumeau par symétrie aurait enseigné le contraire de ce que le lieu pose réellement — le
  // contrôle lit donc les MOYENS RÉELS du gabarit, jamais une intention.
  const moyens = readFileSync(join(REPO, '.claude', 'templates', 'orchestrateur', '.mcp.json'), 'utf8');
  const declares = Object.keys(JSON.parse(moyens).mcpServers);
  assert.ok(declares.includes('somcraft'), 'le lieu de l’orchestrateur déclare Somcraft — le test garderait une fiction');
  assert.ok(
    !/Somcraft en est exclu|ServiceDesk SEUL/.test(skill()),
    'la compétence enseigne une exclusion que le lieu ne pose pas : elle décrirait le lieu du représentant',
  );
});

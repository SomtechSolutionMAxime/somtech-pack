// lieux-versionnes.test.js — un lieu d'orchestrateur COMMITTÉ porte le métier courant.
//
// Le trou qu'il bouche, mesuré le 2026-08-22 (E-20260822-0004) : `main` portait
// 7 lieux sous `.orchestrateur/`, dont 5 avec un `CLAUDE.md` périmé — jusqu'à
// 146 349 o et zéro chapitre là où le métier rendu en fait 7 881 avec 11.
// Rien ne le voyait : `metier-gabarit.test.js` garde le maillon rendu → gabarit,
// personne ne gardait gabarit → lieux versionnés.
//
// La conséquence n'était pas un stock, c'était une hémorragie : `git worktree add`
// recopie ce que `main` porte, donc TOUT worktree neuf naissait périmé — y compris
// ceux qu'on créait pour réparer le reste.
//
// ⚠️ La population est ce que GIT SUIT, pas ce qui traîne sur le disque. Un lieu
// né localement dans un worktree n'est pas versionné : le gater ferait rougir la
// CI sur le travail en cours de quelqu'un d'autre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GABARIT = join(RACINE, '.claude', 'templates', 'orchestrateur');

/** Les lieux que `main` porte — mesurés sur l'index git, jamais sur le disque nu. */
function lieuxVersionnes() {
  const sortie = execFileSync('git', ['ls-files', '-z', '.orchestrateur'], {
    cwd: RACINE, encoding: 'utf8',
  });
  const mandats = new Set();
  for (const chemin of sortie.split('\0')) {
    // `.orchestrateur/<mandat>/…` — on ne retient que le segment du mandat.
    const m = /^\.orchestrateur\/([^/]+)\//.exec(chemin);
    if (m) mandats.add(m[1]);
  }
  return [...mandats].sort();
}

const LIEUX = lieuxVersionnes();

test('le dépôt porte au moins un lieu versionné — sinon ce fichier ne garde rien', () => {
  assert.ok(LIEUX.length > 0,
    'aucun lieu sous .orchestrateur/ n\'est suivi par git : la garde ci-dessous passerait à vide');
});

for (const mandat of LIEUX) {
  const lieu = join(RACINE, '.orchestrateur', mandat);

  test(`${mandat} — son CLAUDE.md est celui du métier rendu, à l'octet près`, () => {
    const attendu = readFileSync(join(GABARIT, 'CLAUDE.md'), 'utf8');
    const porte = readFileSync(join(lieu, 'CLAUDE.md'), 'utf8');
    assert.equal(porte, attendu,
      `le lieu versionné « ${mandat} » a divergé du métier rendu (${porte.length} o contre ${attendu.length} o) — ` +
      'tout worktree créé depuis main y fera naître un orchestrateur périmé');
  });

  test(`${mandat} — chaque renvoi de son CLAUDE.md atteint un chapitre qui existe`, () => {
    const texte = readFileSync(join(lieu, 'CLAUDE.md'), 'utf8');
    const renvois = [...new Set(
      [...texte.matchAll(/metier\/chapitres\/([A-Za-z0-9._-]+\.md)/g)].map((m) => m[1]),
    )].sort();
    assert.ok(renvois.length > 0,
      `« ${mandat} » ne renvoie à aucun chapitre : son métier tient dans un seul fichier, ou les renvois ont changé de forme`);
    const manquants = renvois.filter((n) => !existsSync(join(lieu, 'metier', 'chapitres', n)));
    assert.deepEqual(manquants, [],
      `« ${mandat} » renvoie vers des chapitres absents — l'agent y lit une carte vers rien (T-20260821-0032)`);
  });

  test(`${mandat} — aucun chapitre orphelin : ce qui est posé est renvoyé`, () => {
    const dossier = join(lieu, 'metier', 'chapitres');
    const poses = existsSync(dossier) ? readdirSync(dossier).filter((f) => f.endsWith('.md')).sort() : [];
    const texte = readFileSync(join(lieu, 'CLAUDE.md'), 'utf8');
    const orphelins = poses.filter((n) => !texte.includes(`metier/chapitres/${n}`));
    assert.deepEqual(orphelins, [],
      `« ${mandat} » porte des chapitres que rien ne renvoie — ils resteront distribués sans jamais être lus`);
  });
}

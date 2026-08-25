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

  test(`${mandat} — le CONTENU de chaque chapitre est celui du gabarit, à l'octet près`, () => {
    // ⚠️ Sans cette assertion, la garde ne tenait que le ROUTEUR (CLAUDE.md) et
    // les LIENS. Un lieu pouvait donc porter un CLAUDE.md identique à l'octet,
    // onze renvois qui résolvent — et onze chapitres périmés dessous. Ce n'était
    // pas une hypothèse : `p-20260820-0001` et `p-20260822-0001` étaient dans cet
    // état exact le 2026-08-22 (11 chapitres sur 11 divergents, ABC 2.0.0 contre
    // 2.1.0, RA-ORC-039/040/041 absents) et passaient la garde au vert.
    // Trouvé par la passe de revue de fond, pas par l'auteur.
    const attendus = readdirSync(join(GABARIT, 'metier', 'chapitres')).filter((f) => f.endsWith('.md')).sort();
    const dossier = join(lieu, 'metier', 'chapitres');
    const poses = existsSync(dossier) ? readdirSync(dossier).filter((f) => f.endsWith('.md')).sort() : [];
    assert.deepEqual(poses, attendus,
      `« ${mandat} » ne porte pas les mêmes chapitres que le gabarit`);
    const divergents = attendus.filter((n) =>
      readFileSync(join(dossier, n), 'utf8') !== readFileSync(join(GABARIT, 'metier', 'chapitres', n), 'utf8'));
    assert.deepEqual(divergents, [],
      `« ${mandat} » porte ${divergents.length} chapitre(s) divergent(s) du métier rendu — ` +
      "le CLAUDE.md a beau être à jour, c'est le chapitre que l'agent lit pour travailler");
  });

  test(`${mandat} — son FICHIER DE DROITS est celui du gabarit, à l'octet près`, () => {
    // ⚠️ LA GARDE QUI MANQUAIT, et le trou qu'elle bouche a été MESURÉ le 2026-08-24
    // (T-20260824-0002) : les sept lieux versionnés portaient chacun un
    // `.claude/settings.json`, et RIEN ne le gardait. Ce fichier garde le métier
    // (CLAUDE.md) et les chapitres — c'est-à-dire ce que l'agent LIT. Le fichier de
    // droits est ce qu'il PEUT, et il dérivait librement.
    //
    // L'état trouvé ce jour-là, avant convergence : cinq lieux sur sept portaient des
    // droits périmés, et `j-20260814-0002` — un lieu d'orchestrateur en service —
    // n'avait AUCUN hook là où le gabarit en pose trois. Ses trois gardes, dont celle
    // qui ferme la brèche du terminal, n'existaient pas chez lui.
    //
    // La conséquence est la même hémorragie que pour le métier : `git worktree add`
    // recopie ce que `main` porte, donc tout worktree neuf faisait naître un
    // orchestrateur aux droits périmés — et un correctif au gabarit ne l'atteignait
    // jamais. Tarir la source demande les deux fichiers, pas un seul.
    const attendu = readFileSync(join(GABARIT, '.claude', 'settings.json'), 'utf8');
    const porte = readFileSync(join(lieu, '.claude', 'settings.json'), 'utf8');
    assert.equal(porte, attendu,
      `le fichier de droits versionné de « ${mandat} » a divergé du gabarit — tout worktree créé ` +
      'depuis main y fera naître un orchestrateur avec des refus et des gardes périmés');
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

test('🔴 la convergence n\'écrase JAMAIS les CONTEXTE.md remplis — le seul fichier qui appartient à l\'agent', () => {
  // La contrepartie des deux gardes de convergence ci-dessus, et elle est nécessaire :
  // `CLAUDE.md` et le fichier de droits doivent CONVERGER vers le gabarit, `CONTEXTE.md`
  // ne le doit surtout pas. Il porte ce que l'agent a appris de SON chantier — ce que
  // personne n'apprend à sa place, et qu'un `cp` de convergence effacerait sans bruit.
  //
  // ⚠️ Le dénominateur est ÉPINGLÉ, et c'est ce qui empêche ce contrôle d'être décoratif.
  // « au moins un » resterait vert après une convergence qui en écraserait six sur sept.
  // Mesuré le 2026-08-24 : 3 lieux sur 7 portent un contexte rempli (`d-20260817-0006`,
  // `essai-metier-rendu`, `j-20260814-0002`), les 4 autres sont encore le gabarit vierge.
  // Une baisse de ce compte est un fait à regarder, jamais un chiffre à réaligner.
  const vierge = readFileSync(join(GABARIT, 'CONTEXTE.md'), 'utf8');
  const remplis = LIEUX.filter((m) => {
    const c = join(RACINE, '.orchestrateur', m, 'CONTEXTE.md');
    return existsSync(c) && readFileSync(c, 'utf8') !== vierge;
  });
  assert.ok(remplis.length >= 3,
    `${remplis.length} lieu(x) portent un CONTEXTE.md rempli, contre 3 mesurés le 2026-08-24 : `
    + 'une convergence a probablement écrasé ce que ses agents avaient appris — '
    + `remplis : ${remplis.join(', ') || 'aucun'}`);
  for (const m of LIEUX) {
    assert.ok(existsSync(join(RACINE, '.orchestrateur', m, 'CONTEXTE.md')),
      `« ${m} » n'a plus de CONTEXTE.md : la convergence l'a emporté`);
  }
});

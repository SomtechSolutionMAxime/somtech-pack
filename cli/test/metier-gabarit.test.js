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

/**
 * LE DÉNOMINATEUR DE CE FICHIER — MESURÉ SUR LE DISQUE, PLUS ÉCRIT À LA MAIN (T-20260826-0076).
 *
 * Il valait `['orchestrateur', 'gestionnaire-client']`, en toutes lettres. Une garde dont le
 * dénominateur est écrit à la main mesure ce qu'on a pensé à y mettre, jamais ce qui existe :
 * c'est le motif « zéro survivante sur un sous-ensemble », et il a été MESURÉ ici même le
 * 2026-08-26. Un troisième rôle déposé sous `metier/developpeur/`, avec un `CLAUDE.md` de
 * gabarit remplacé par du texte écrit à la main ET son fichier de droits SUPPRIMÉ, laissait
 * les 17 contrôles de ce fichier au vert. Le rôle n'était dans la liste, donc rien ne le
 * regardait — un agent posé dessus serait né sans aucun refus.
 *
 * ⚠️ POURQUOI `metier/*` ET NON `.claude/templates/*` — les deux ont été mesurées, elles ne
 * rendent pas la même chose :
 *
 *   • `metier/*`            → gestionnaire-client, orchestrateur          (2)
 *   • `.claude/templates/*` → bootstrap, gestionnaire-client, orchestrateur (3, + le fichier
 *                             USER_CLAUDE_MD.md)
 *
 * `bootstrap` est un gabarit de sources de vérité, pas un rôle d'agent : il n'a ni classement
 * ni rendu. L'énumérer forcerait une liste d'exceptions — et une liste d'exceptions se désarme
 * par un geste qui ressemble à de l'entretien. `metier/*` est l'énumération qui coïncide avec
 * le SUJET de ce fichier : « le gabarit distribué EST le rendu » ne se dit que d'un rôle qui a
 * un rendu.
 *
 * ⚠️ AUCUN FILTRE, ET C'EST DÉLIBÉRÉ. On prend TOUS les sous-dossiers de `metier/`, sans
 * exiger de `classement.json` pour entrer — un filtre qui se resserre est un dénominateur qui
 * rétrécit en silence. Ce que chaque rôle doit porter est vérifié PAR UN CONTRÔLE À PART, qui
 * NOMME celui à qui il manque quelque chose (voir juste dessous).
 */
function rolesDuMetier(racine) {
  const base = join(racine, 'metier');
  if (!existsSync(base)) return { roles: [], raison: `« ${base} » n’existe pas` };
  const roles = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return { roles, raison: roles.length ? null : `« ${base} » ne porte aucun sous-dossier de rôle` };
}

const { roles: ROLES, raison: RIEN_TROUVE } = rolesDuMetier(RACINE);

test('🔴 le dénominateur de ce fichier est MESURÉ, il n’est pas vide, et chaque rôle est complet', () => {
  // ⚠️ SANS CE CONTRÔLE, LA GARDE SE DÉSARME TOUTE SEULE. Les contrôles ci-dessous vivent dans
  // une boucle `for (const role of ROLES)` : si l’énumération rend une liste VIDE — répertoire
  // déplacé, renommé, filtre resserré — la boucle n’enregistre AUCUN test et la suite passe au
  // vert en n’ayant rien mesuré. « Un test qui attend RIEN ne peut pas distinguer *rien trouvé*
  // de *rien cherché* » (feed du 2026-08-25). Celui-ci fait la différence, et il rougit du côté
  // de « rien cherché ».
  assert.equal(RIEN_TROUVE, null,
    `l’énumération des rôles n’a rien rendu : ${RIEN_TROUVE}. Tous les contrôles de ce fichier `
    + 'sont alors muets — ils ne sont pas verts, ils n’existent pas.');
  assert.ok(ROLES.length > 0, 'aucun rôle énuméré — voir le message ci-dessus');

  // Le filtre est LARGE à l’entrée ; c’est ici qu’on exige, en NOMMANT, ce qu’un rôle doit
  // porter. Un rôle incomplet doit rougir d’un message qui dit quoi faire — pas disparaître du
  // dénominateur, ce qui reviendrait à cesser de le garder au moment où il en a le plus besoin.
  const incomplets = [];
  for (const role of ROLES) {
    const dit = (quoi) => incomplets.push(`${role} : ${quoi}`);
    if (!existsSync(join(RACINE, 'metier', role, 'classement.json'))) dit('pas de metier/<rôle>/classement.json');
    if (!existsSync(join(RACINE, 'metier', role, 'rendu'))) dit('pas de metier/<rôle>/rendu/ — lancer « pack metier rendre --role ' + role + ' »');
    if (!existsSync(join(RACINE, '.claude', 'templates', role))) dit('pas de .claude/templates/<rôle>/ — le rendu ne serait distribué à personne');
  }
  assert.deepEqual(incomplets, [],
    'un rôle de metier/ n’a pas de quoi être gardé :\n  ' + incomplets.join('\n  '));

  console.log(`  → dénominateur mesuré depuis metier/ : ${ROLES.join(', ')}`);
});

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

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 UN RÔLE SANS DOSSIER DE GABARITS — la réussite silencieuse (T-20260826-0076)
//
// `distribuerAuGabarit` rendait 0 EN SILENCE quand `.claude/templates/<rôle>/`
// n'existait pas, et `runMetier` rendait 0 par-dessus. Conséquence : `pack metier
// rendre` sur un rôle NEUF — celui qu'on vient d'inscrire, dont le classement est
// écrit mais dont le gabarit n'a pas encore été créé — annonçait « ✅ N artefacts
// écrits » sans avoir distribué quoi que ce soit. C'est la famille « un vert qui ne
// touche pas ce qu'il éprouve » : le geste réussit, son effet n'atteint personne.
//
// Le mode de panne n'est pas théorique : c'est exactement ce que rencontre chacun
// des neuf rôles arbitrés à son premier rendu.
//
// ⚠️ ET LE REFUS ARRIVE AVANT TOUTE ÉCRITURE, pas après. Refuser une fois le rendu
// écrit laisserait `metier/<rôle>/rendu/` posé et le gabarit vide : un demi-geste,
// dont l'état sur le disque ne se distingue pas d'un rendu réussi puis abîmé. Le
// dépôt tranche déjà dans ce sens juste au-dessus — « un rendu REFUSÉ ne distribue
// rien ».
//
// ⚠️ « CODE NON NUL » NE PROUVE RIEN ICI, et ce fichier a déjà payé la leçon
// (metier-commande.test.js : « une valeur absurde finit par lever une erreur de
// chemin qui sort aussi non nul »). On exige donc le code 1 — le refus métier, pas
// le 2 d'usage — ET un message qui NOMME le dossier manquant.

/** Ce que la commande a écrit sur stderr, sans le laisser polluer le rapport de test. */
function enEcoutantStderr(faire) {
  const vrai = process.stderr.write.bind(process.stderr);
  let vu = '';
  process.stderr.write = (chunk) => { vu += String(chunk); return true; };
  try { return { code: faire(), stderr: vu }; } finally { process.stderr.write = vrai; }
}

test('🔴 DISTRIBUTION — un rôle sans dossier de gabarits est REFUSÉ, pas réussi en silence', () => {
  const d = projetAvecGabarit();
  rmSync(join(d, '.claude/templates/r'), { recursive: true, force: true });

  const { code, stderr } = enEcoutantStderr(() => runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d }));

  assert.equal(code, 1,
    'un rendu que personne ne recevra doit être REFUSÉ (code 1, refus métier) — il rendait 0, '
    + 'et annonçait « artefacts écrits » sans avoir rien distribué');
  assert.ok(stderr.includes('.claude/templates/r'),
    `le refus doit NOMMER le dossier qui manque, sinon il n'est pas actionnable — obtenu : ${JSON.stringify(stderr)}`);
  rmSync(d, { recursive: true, force: true });
});

test('🔴 DISTRIBUTION — ce refus arrive AVANT d écrire : le rendu n est pas laissé à moitié posé', () => {
  const d = projetAvecGabarit();
  rmSync(join(d, '.claude/templates/r'), { recursive: true, force: true });
  enEcoutantStderr(() => runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d }));
  assert.ok(!existsSync(join(d, 'metier/r/rendu')),
    'un refus après écriture laisse un rendu posé que rien ne distribue — l état sur le disque '
    + 'se lit alors comme un rendu réussi');
  rmSync(d, { recursive: true, force: true });
});

test('🔴 `verifier` REFUSE aussi un rôle sans gabarit — sinon il serait vert là où `rendre` refuse', () => {
  // ⚠️ LE SYMÉTRIQUE, ET IL N EST PAS DÉCORATIF. `verifier` porte le MÊME
  // « if (existsSync(gabarit)) » : sans ce contrôle, il annoncerait « ✅ conforme »
  // sur un rôle dont `rendre` refuse de s occuper. Le contrat écrit de ce gate est
  // « verifier vert doit impliquer que rendre ne changerait rien » — corriger un
  // seul des deux côtés le briserait dans le sens le plus trompeur.
  const d = projetAvecGabarit();
  runMetier(['metier', 'rendre', '--role', 'r'], { cwd: d });        // rendu frais, gabarit à jour
  assert.equal(runMetier(['metier', 'verifier', '--role', 'r'], { cwd: d }), 0, 'témoin : conforme tant que le gabarit est là');

  rmSync(join(d, '.claude/templates/r'), { recursive: true, force: true });
  const { code, stderr } = enEcoutantStderr(() => runMetier(['metier', 'verifier', '--role', 'r'], { cwd: d }));
  assert.equal(code, 1, '`verifier` déclarait « conforme » un rôle dont le rendu n atteint personne');
  assert.ok(stderr.includes('.claude/templates/r'), `le refus doit nommer le dossier — obtenu : ${JSON.stringify(stderr)}`);
  rmSync(d, { recursive: true, force: true });
});

test('🔴 la garde de PROFONDEUR de distribuerAuGabarit lève, elle ne rend pas 0', async () => {
  // ⚠️ ELLE N EST PAS ATTEIGNABLE PAR LE CHEMIN NORMAL — `runMetier` refuse bien avant. On
  // l appelle donc DIRECTEMENT, sinon on aurait écrit une garde que rien ne peut éprouver, et
  // « désarmer entièrement distribuerAuGabarit laissait tout au vert » est déjà arrivé ici
  // (mutation du 2026-08-20, en tête de ce bloc).
  const { distribuerAuGabarit } = await import('../src/commands/metier.js');
  const d = mkdtempSync(join(tmpdir(), 'sans-gabarit-'));
  assert.throws(
    () => distribuerAuGabarit(d, 'r', { 'L0.md': 'x', 'L1.md': 'y' }),
    /n'existe pas/,
    'sur un dossier absent elle rendait 0 en silence — l appelant lisait « rien à distribuer » '
    + 'là où il fallait lire « je n ai rien pu distribuer »');
  assert.ok(!existsSync(join(d, '.claude/templates/r')),
    'elle ne doit surtout pas CRÉER le dossier : deux fichiers sur quatre font un gabarit '
    + 'incomplet, qui ne se découvre qu à la pose d un lieu, ailleurs et plus tard');
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
// Il fait en CI une partie de ce que `pack metier verifier` fait à la main — et
// que rien n'appelait (relevé par la revue de fond du 2026-08-24).
//
// ⚠️ ET LES DEUX SENS, PAS UN SEUL. La première version ne vérifiait que
// « chaque artefact produit aujourd'hui existe et correspond ». Elle ne voyait
// donc PAS un artefact ORPHELIN — présent en committé, plus produit par le
// classement. Mesuré par la troisième passe de fond : un chapitre fantôme déposé
// des deux côtés laissait les 17 contrôles de ce fichier au vert.
//
// C'est le même piège que celui dénoncé plus haut, d'un cran plus loin : la
// comparaison était ancrée à la source, mais SEULEMENT dans le sens qui ajoute.
// Un fichier que le classement ne produit plus reste distribué à jamais.

/** Ce que le rendu committé porte réellement, à plat, chemins relatifs. */
function renduCommitte(base) {
  const vus = [];
  (function marcher(d, prefixe) {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const rel = prefixe ? `${prefixe}/${e.name}` : e.name;
      if (e.isDirectory()) marcher(join(d, e.name), rel);
      else vus.push(rel);
    }
  })(base, '');
  return vus.sort();
}

test('🔴 le rendu committé est celui que le code produit AUJOURD’HUI — pour tous les rôles, DANS LES DEUX SENS', async () => {
  const { rendre } = await import('../src/metier/rendu.js');
  const { lireClassement } = await import('../src/commands/metier.js');

  const perimes = [];
  for (const role of ROLES) {
    const artefacts = rendre(lireClassement(RACINE, role)).artefacts;
    const base = join(RACINE, 'metier', role, 'rendu');
    for (const [chemin, attendu] of Object.entries(artefacts)) {
      const committe = join(base, chemin);
      if (!existsSync(committe)) { perimes.push(`${role} · ${chemin} : ABSENT du rendu committé`); continue; }
      if (readFileSync(committe, 'utf8') !== attendu) perimes.push(`${role} · ${chemin} : périmé`);
    }
    // ── LE SENS INVERSE : ce que le classement ne produit PLUS.
    const produits = new Set(Object.keys(artefacts));
    for (const chemin of renduCommitte(base)) {
      if (!produits.has(chemin)) perimes.push(`${role} · ${chemin} : ORPHELIN — le classement ne le produit plus, et il reste distribué`);
    }
  }
  assert.deepEqual(perimes, [],
    'le rendu committé ne correspond plus à ce que le code produit :\n  ' + perimes.join('\n  ')
    + '\n\n🔴 Un changement dans « rendu.js » n\'a pas été redistribué. Les contrôles d\'identité '
    + 'ci-dessus ne peuvent PAS l\'attraper : gabarit et rendu sont alors périmés de la même façon, '
    + 'donc cohérents entre eux. Deux objets identiques ne se valident pas l\'un l\'autre.'
    + '\n  Relance : node cli/bin/somtech-pack.js metier rendre --role <chacun des rôles>');
});

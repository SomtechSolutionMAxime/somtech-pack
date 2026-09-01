// la-pose-aboutit-pour-tout-role-du-registre.test.js — LA POSE ABOUTIT-ELLE POUR UN AUTRE RÔLE
// QUE L'ORCHESTRATEUR ? (T-20260826-0076, point 3)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE QUE CE FICHIER PROUVE, ET CE QU'IL NE PROUVE PAS — À LIRE AVANT DE S'EN SERVIR.
//
// IL PROUVE : le cœur de la pose (`preparerLieu`) mène un lieu jusqu'au disque pour CHAQUE
// rôle du registre, à son dossier à lui, avec ses gabarits à lui. Le rôle est un ARGUMENT, il
// ne l'a jamais été autrement, et ce fichier l'épingle pour que ça reste vrai.
//
// IL NE PROUVE PAS : que `bin/naitre.js` mène une pose jusqu'au bout. Et ce n'est pas une
// paresse — c'est INATTEIGNABLE dans un banc, pour une raison mesurée et délibérée :
//
//   `naitre.js` pose en passant `verifierLigneOuvrable`, qui lit le trousseau du poste. La
//   cloison d'essais (`ligne-directe/src/cloison.js`) refuse toute lecture du trousseau à un
//   processus DESCENDANT du lanceur de tests — `NODE_TEST_CONTEXT` s'hérite, et il n'y a
//   volontairement aucune porte de sortie. Deux veilleurs orphelins nés d'une campagne de
//   mutation ont déjà tenu une connexion de production pendant des heures ; c'est ce que cette
//   cloison existe pour empêcher.
//
// ⚠️ CE CONSTAT VAUT AUSSI POUR L'ORCHESTRATEUR, ET C'EST LE FAIT QUI SURPREND : la pose
// automatique n'a JAMAIS été prouvée de bout en bout dans un banc, pour aucun rôle. Le fichier
// `naissance-representant/tests/naitre-bin.test.js` le dit déjà en toutes lettres. Ce lot ne
// creuse donc pas un trou — il le nomme au bon endroit, et il prouve la seule moitié
// atteignable : que la pose est générique, et que la DÉCISION d'y entrer vient du registre
// (essais dans `le-registre-decide-de-la-pose-et-du-bapteme.test.js` et dans le banc du binaire).
//
// ⚠️ ET LE VÉRIFICATEUR INJECTÉ N'EST PAS UN APPELANT FABRIQUÉ. `preparerLieu` n'a pas de
// défaut pour `verifierLigne` : la production le passe explicitement, ici comme dans
// `naitre.js` et dans `ligne-directe/bin/ligne-directe.js`. Ce banc appelle donc avec la MÊME
// signature que la production, ce qui est la seule chose qui distingue une couture d'essais
// légitime d'un banc qui se fabrique son propre appelant.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { role as roleDe, rolesConnus } from '../src/roles.js';
import { preparerLieu, GABARITS, gabaritsDir, racineLieu } from '../src/lieu-agent.js';

/** Le vérificateur que la production injecte, réduit à son verdict — la cloison interdit le vrai. */
const OUVRABLE = async () => ({ joignable: true });

let bacs = [];
test.after(() => {
  for (const d of bacs) rmSync(d, { recursive: true, force: true });
  bacs = [];
});

/**
 * Un dépôt jetable qui porte les gabarits d'un rôle — écrits là où `gabaritsDir` les cherche.
 *
 * ⚠️ LE `foyer` EST DÉTOURNÉ VERS UN RÉPERTOIRE VIDE, ET C'EST NÉCESSAIRE. La garde de
 * fraîcheur compare le gabarit du dépôt à celui du pack INSTALLÉ SUR LE POSTE. Sans ce
 * détournement, le verdict de ce banc dépendrait de l'état du poste qui l'exécute : vert chez
 * qui a le pack à jour, rouge en intégration continue. Le dépôt a déjà payé ce défaut exact
 * (note « celui qui varie avec le poste ne se mêle pas à celui qui n'en dépend pas »,
 * `lieu-agent.js`). Un foyer vide rend la mesure IMPOSSIBLE, ce qui ne refuse rien — c'est la
 * conduite que la garde documente.
 */
function depotAvecLesGabaritsDe(role) {
  const depot = mkdtempSync(join(tmpdir(), 'smtk-pose-generique-'));
  bacs.push(depot);
  execFileSync('git', ['-C', depot, 'init', '-q']);

  const source = gabaritsDir(depot, role);
  for (const fichier of GABARITS) {
    const cible = join(source, fichier);
    mkdirSync(join(cible, '..'), { recursive: true });
    // Un contenu RECONNAISSABLE par rôle et par fichier : c'est ce qui prouve que le lieu a
    // reçu les gabarits de SON rôle, et pas ceux d'un autre.
    writeFileSync(cible, `gabarit de ${role} — ${fichier}\n`);
  }
  return depot;
}

test('LA POSE ABOUTIT POUR CHAQUE RÔLE DU REGISTRE — à son dossier, avec ses gabarits', async () => {
  for (const nom of rolesConnus()) {
    const r = roleDe(nom);
    const depot = depotAvecLesGabaritsDe(nom);
    const foyer = mkdtempSync(join(tmpdir(), 'smtk-foyer-vide-'));
    bacs.push(foyer);

    const pose = await preparerLieu({ depot, role: nom, nom: 'essai-de-pose', verifierLigne: OUVRABLE, foyer });

    assert.equal(pose.ok, true, `« ${nom} » : la pose a refusé (${pose.refus?.motif}) — ${pose.refus?.message ?? ''}`);
    assert.equal(pose.cree, true, `« ${nom} » : la pose dit « ok » sans avoir rien créé`);

    // ⚠️ LA PREUVE EST LE DISQUE, PAS LE RENDU. Un `ok:true` est ce que ce dépôt a déjà vu
    // mentir : quatre fichiers annoncés, une ligne joignable, et un contenu faux.
    const racine = racineLieu(depot, nom, 'essai-de-pose');
    assert.ok(racine.includes(`/${r.dossier}/`), `« ${nom} » : le lieu doit se ranger sous « ${r.dossier} » (lu : ${racine})`);
    for (const fichier of GABARITS) {
      const pose_ = join(racine, fichier);
      assert.ok(existsSync(pose_), `« ${nom} » : ${fichier} n’a pas été posé`);
      assert.equal(
        readFileSync(pose_, 'utf8'),
        `gabarit de ${nom} — ${fichier}\n`,
        `« ${nom} » : ${fichier} ne porte pas le gabarit de CE rôle`,
      );
    }
  }
});

// ⚠️ LA CONTRE-MESURE — sans elle, l'essai ci-dessus resterait vert si `preparerLieu` posait
// TOUJOURS au même endroit. Deux rôles posés dans le même dépôt ne doivent jamais se
// rencontrer : c'est ce qui distingue « le rôle est un argument » de « le rôle est décoratif ».
test('DEUX RÔLES POSÉS DANS LE MÊME DÉPÔT NE SE MARCHENT PAS DESSUS', async () => {
  const connus = rolesConnus();
  assert.ok(connus.length >= 2, 'cette contre-mesure exige au moins deux rôles au registre');

  const depot = mkdtempSync(join(tmpdir(), 'smtk-pose-deux-roles-'));
  bacs.push(depot);
  execFileSync('git', ['-C', depot, 'init', '-q']);
  const foyer = mkdtempSync(join(tmpdir(), 'smtk-foyer-vide-'));
  bacs.push(foyer);

  for (const nom of connus) {
    const source = gabaritsDir(depot, nom);
    for (const fichier of GABARITS) {
      mkdirSync(join(source, fichier, '..'), { recursive: true });
      writeFileSync(join(source, fichier), `gabarit de ${nom} — ${fichier}\n`);
    }
  }

  // LE MÊME NOM POUR TOUS : si le rôle ne décidait pas du dossier, le second écraserait le
  // premier — ou se ferait refuser pour « lieu déjà installé », ce qui serait tout aussi
  // parlant.
  for (const nom of connus) {
    const pose = await preparerLieu({ depot, role: nom, nom: 'homonyme', verifierLigne: OUVRABLE, foyer });
    assert.equal(pose.ok, true, `« ${nom} » : ${pose.refus?.motif} — ${pose.refus?.message ?? ''}`);
    assert.equal(pose.cree, true, `« ${nom} » : le lieu d’un autre rôle a été pris pour le sien`);
  }

  for (const nom of connus) {
    assert.equal(
      readFileSync(join(racineLieu(depot, nom, 'homonyme'), 'CLAUDE.md'), 'utf8'),
      `gabarit de ${nom} — CLAUDE.md\n`,
      `« ${nom} » : son lieu porte le gabarit d’un autre rôle`,
    );
  }
});

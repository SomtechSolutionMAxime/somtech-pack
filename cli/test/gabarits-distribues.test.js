// gabarits-distribues.test.js — CE QUE LA DISTRIBUTION DÉPOSE SUFFIT-IL À POSER UN LIEU ?
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// D'OÙ VIENT CETTE GARDE (T-20260818-0039)
//
// Un ticket a affirmé que les gabarits distribués chez les clients étaient INCOMPLETS —
// « 2 des 4 fichiers requis » — et qu'une pose neuve y échouerait. La mesure a démenti le
// fait : les quatre arrivent, dans le dépôt, dans le payload, et dans le tarball publié. Le
// « 2 sur 4 » venait de la façon de compter — un `ls` sans `-a` ne montre ni `.mcp.json` ni
// `.claude/`, qui sont deux des quatre. Un artefact de mesure, pas un défaut de distribution.
//
// Ce qui restait vrai, en revanche, c'est qu'AUCUN contrôle ne l'établissait. Le dépôt savait
// prouver que des fichiers avaient été COPIÉS (build-payload.test.js compare le payload au
// dépôt, fichier à fichier) ; il ne savait pas prouver que ce qui arrive chez un client SUFFIT
// à poser un lieu. C'est une question différente, et c'est celle qui compte pour quelqu'un qui
// part de zéro : la copie peut être fidèle et la liste incomplète — le jour où la pose exige un
// cinquième fichier, où un rôle nouveau arrive sans son dossier de gabarits, ou où un filtre du
// paquet en mange un au passage. Aucun de ces trois cas ne fait rougir une comparaison de copie.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI ELLE INTERROGE LA POSE PLUTÔT QUE DE RÉÉCRIRE SA LISTE
//
// La liste des fichiers requis n'est PAS recopiée ici. C'est `etatSource` — la fonction que la
// pose elle-même consulte avant d'écrire quoi que ce soit — qui rend le verdict, et
// `rolesConnus()` qui énumère les rôles. Une liste recopiée dans un test se déphase de celle
// qu'applique le code, et le test devient alors vert sur une exigence périmée : le dépôt a déjà
// payé ce motif ailleurs (« deux sources qui disent la même chose divergent, c'est mécanique »).
//
// Conséquence voulue : un rôle ajouté demain à `roles.js` sans son dossier de gabarits fait
// rougir cette garde sans qu'on ait à y toucher. Un fichier ajouté à `GABARITS` aussi.
//
// ⚠️ CE QU'ELLE NE COUVRE PAS. Elle prouve que la SOURCE des gabarits est complète dans un dépôt
// fraîchement servi — la première garde de la pose, celle qui refusait pour `gabarits_absents`.
// Elle ne rejoue pas une pose entière : la ligne, les droits versionnables et la naissance ont
// leurs propres épreuves, dans `ligne-directe/tests/`. Ce test-ci ferme la porte de la
// distribution, pas les trois autres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readManifest, resolveModules, defaultModules } from '../src/modules.js';
import { collectFiles, applyFiles } from '../src/engine.js';
import { etatSource, GABARITS } from '../../ligne-directe/src/lieu-agent.js';
import { rolesConnus, role as roleDe } from '../../ligne-directe/src/roles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const BUILD = join(CLI_DIR, 'scripts', 'build-payload.mjs');

const aNettoyer = [];
function jetable(prefixe) {
  const d = mkdtempSync(join(tmpdir(), prefixe));
  aNettoyer.push(d);
  return d;
}

/**
 * SERT UN DÉPÔT COMME LE FERAIT UNE VRAIE INSTALLATION — puis rend son chemin.
 *
 * Le payload est construit AILLEURS que dans `cli/payload` (via `PAYLOAD_OUT`) : ce répertoire
 * est partagé et un seul fichier de test a le droit d'y toucher, sans quoi deux processus
 * entrent en course et le perdant accuse un coupable imaginaire (cf. portee-de-la-suite).
 *
 * On passe par le VRAI moteur (`collectFiles` + `applyFiles`), pas par une copie de répertoire
 * écrite pour l'occasion : ce sont ses filtres — symlinks ignorés, `.DS_Store` écarté,
 * containment — qui décident de ce qui arrive réellement chez un client. Une copie de test
 * prouverait ce que le test sait faire, pas ce que la distribution fait.
 */
function servirUnDepot() {
  const payload = jetable('smtk-gabarits-payload-');
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: payload }, stdio: 'pipe' });

  const depot = jetable('smtk-gabarits-depot-');
  const manifest = readManifest(payload);
  // Les modules PAR DÉFAUT, pas une liste écrite ici : c'est ce que reçoit quelqu'un qui
  // installe sans rien préciser, donc le cas qui compte pour un dépôt qui part de zéro. Si
  // `.claude/` quittait un jour le lot par défaut, cette garde le dirait — et ce serait bien
  // la distribution qui aurait changé, pas le test.
  const { files } = collectFiles(payload, resolveModules(manifest, defaultModules(manifest)).flatMap((m) => m.paths));
  applyFiles({ payloadRoot: payload, target: depot, files });
  return depot;
}

test.after(() => {
  for (const d of aNettoyer) rmSync(d, { recursive: true, force: true });
});

test('un dépôt qui vient de recevoir le pack porte de quoi poser un lieu — pour CHAQUE rôle', () => {
  const depot = servirUnDepot();

  const incomplets = [];
  for (const nom of rolesConnus()) {
    const etat = etatSource(depot, nom);
    if (!etat.complete) {
      incomplets.push(`${nom} (${roleDe(nom).libelle}) : ${etat.manquants.join(', ')} sous « ${etat.source} »`);
    }
  }

  assert.deepEqual(
    incomplets, [],
    'Ce que la distribution dépose ne suffit pas à poser un lieu : '
      + `${incomplets.join(' · ')}. La pose refuserait pour « gabarits_absents » chez un client qui `
      + 'vient pourtant de recevoir le pack. Le geste qui lève le blocage : ajouter les fichiers '
      + 'manquants sous .claude/templates/<gabarit>/ (module core), ou — si un rôle a été ajouté à '
      + 'ligne-directe/src/roles.js — lui créer son dossier de gabarits.',
  );
});

test('la garde voit CHAQUE fichier manquer — un à un, pas seulement le premier', () => {
  // ⚠️ LA CONTRE-MESURE, ET ELLE N'EST PAS DÉCORATIVE. Le test au-dessus est vert ; il resterait
  // vert si `etatSource` cessait de regarder quoi que ce soit, ou si un fichier sortait de
  // `GABARITS`. On écarte donc chaque fichier à son tour et on exige que le verdict le NOMME —
  // c'est ce qui distingue une garde d'un rituel.
  //
  // On mute une COPIE JETABLE, hors du dépôt : rien de ce qui est versionné n'est touché, même
  // si le test tombe en cours de route (l'écart est refait dans le sens inverse, et le répertoire
  // entier est de toute façon supprimé après la suite).
  const depot = servirUnDepot();

  for (const nom of rolesConnus()) {
    const source = etatSource(depot, nom).source;
    for (const fichier of GABARITS) {
      const chemin = join(source, fichier);
      const ecarte = `${chemin}.ecarte-par-le-test`;
      assert.ok(existsSync(chemin), `${fichier} devrait être là avant qu'on l'écarte (rôle ${nom})`);
      renameSync(chemin, ecarte);
      try {
        const etat = etatSource(depot, nom);
        assert.equal(etat.complete, false, `${fichier} écarté et le rôle ${nom} se dit pourtant complet`);
        assert.deepEqual(
          etat.manquants, [fichier],
          `${fichier} écarté : le verdict devrait le nommer, lui et lui seul (rôle ${nom})`,
        );
      } finally {
        renameSync(ecarte, chemin);
      }
    }
  }
});

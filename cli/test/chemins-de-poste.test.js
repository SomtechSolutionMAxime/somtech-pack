// UN MODULE DE POSTE, NOMMÉ DEPUIS UN DÉPÔT, NE RÉSOUT NULLE PART (T-20260814-0140)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE
//
// Trois modules du pack portent `"scope": "poste"` dans `pack.json` : ils sont installés
// dans le dossier du poste et **ne sont jamais copiés dans un dépôt**. Les nommer par un
// chemin relatif à un dépôt — `<depot>/naissance-representant/bin/livrer.js` — ne résout
// que dans `somtech-pack` lui-même, le seul dépôt qui héberge les deux par hasard. Chez un
// client, ce chemin ne pointe sur rien.
//
// Le code l'avait compris et l'avait écrit (`naissance-representant/src/naissance.js`) :
//
//   « Un chemin relatif au lieu ne résoudrait que dans ce dépôt-ci, qui héberge les deux
//     par hasard ; dans le dépôt d'un client, il ne pointerait sur rien. »
//
// Deux documents ne l'ont pas suivi — et ce sont les deux qui comptent le plus, puisqu'ils
// sont ce qu'un orchestrateur LIT et RECOPIE : son métier, et la compétence qui le décrit.
// Un orchestrateur posé chez un client qui suivait son propre métier à la lettre pour
// briefer un chef d'équipe obtenait un `MODULE_NOT_FOUND`. Mesuré sur les quatre dépôts
// clients : `naissance-representant/` n'existe dans aucun.
//
// CE CONTRÔLE NE CHERCHE PAS DEUX CHEMINS CONNUS. Il lit `pack.json` pour savoir quels
// modules sont de portée poste, lit l'installateur pour savoir où le poste les installe, et
// éprouve l'ACCORD : tout module de poste nommé dans un document PRESCRIPTIF doit l'être
// depuis la racine du poste. Il attrapera donc la prochaine dérive, pas seulement celle-ci.
//
// CE QU'IL NE COUVRE PAS, DÉLIBÉRÉMENT : `scripts/tests/*.sh`. Ces scripts nomment bien les
// modules de poste relativement à la racine du dépôt — et c'est juste, parce qu'ils sont
// ÉPROUVÉS ici, où ces modules SONT des sous-dossiers.
//
// ⚠️ Et ils voyagent quand même : `scripts/` fait partie du module `core`, donc chaque
// installation cliente les reçoit. Ce qui les rend inertes là-bas n'est PAS leur absence —
// c'est le `[ -f "$BIN" ] || skip` que chacun porte avant tout usage du chemin. La nuance
// n'est pas cosmétique : le jour où l'un d'eux perdrait son `skip`, il faudrait le couvrir
// ici. (Une première version de ce commentaire disait qu'ils ne quittaient pas le pack —
// c'était faux, et la revue de fond l'a relevé.)
//
// Traçabilité : T-20260814-0140, issu de la revue de surface T-20260814-0135.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

/**
 * Les dossiers des modules que `pack.json` déclare de portée poste — lus, jamais recopiés.
 * Si un quatrième module devient « poste » demain, il entre dans ce contrôle tout seul.
 */
function dossiersDePoste() {
  const manifeste = JSON.parse(readFileSync(join(REPO, 'pack.json'), 'utf8'));
  const dossiers = [];
  for (const module of Object.values(manifeste.modules ?? {})) {
    if (module?.scope !== 'poste') continue;
    for (const chemin of module.paths ?? []) dossiers.push(chemin.replace(/\/+$/, ''));
  }
  return dossiers;
}

/**
 * La racine du poste, telle que l'INSTALLATEUR la nomme — pas telle que ce contrôle
 * l'imagine. Un contrôle qui porterait sa propre copie de `.somtech` resterait vert le jour
 * où l'installateur changerait de dossier, et c'est précisément le genre de désaccord
 * silencieux que ce fichier existe pour interdire.
 */
function racineDuPoste() {
  // On vise `destDir` NOMMÉMENT : `setup.js` calcule sept chemins par `join(home, …)`, et
  // prendre le premier venu donnerait `.zshrc` — un contrôle qui mesure autre chose que ce
  // qu'il croit mesurer, ce qui est pire qu'un contrôle absent. (Vécu en écrivant celui-ci.)
  const source = readFileSync(join(REPO, 'cli', 'src', 'commands', 'setup.js'), 'utf8');
  const trouve = source.match(/destDir\s*=[^\n]*join\(\s*home\s*,\s*'([^']+)'\s*\)/);
  assert.ok(trouve, "l'installateur de poste doit nommer le dossier où il installe (`destDir`)");
  return trouve[1];
}

/**
 * Tous les documents PRESCRIPTIFS du pack : ce qu'un agent lit, recopie ou subit.
 *
 * ⚠️ ON NE FILTRE PAS PAR NOM DE FICHIER. Une première version de ce contrôle ne regardait
 * que `CLAUDE.md` et `SKILL.md` — et laissait donc passer la MÊME dérive dans le
 * `settings.json` posé juste à côté, dans le même dossier, recopié chez le même client.
 * Démontré par la revue de fond : le défaut réintroduit là restait vert. On prend donc tout
 * ce qui est lu ou appliqué — `.md` et `.json` — sur les quatre racines que le pack
 * distribue.
 */
function documentsPrescriptifs() {
  const trouves = [];
  const parcourir = (repertoire) => {
    for (const entree of readdirSync(repertoire)) {
      const chemin = join(repertoire, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (entree.endsWith('.md') || entree.endsWith('.json')) trouves.push(chemin);
    }
  };
  for (const racine of ['templates', 'skills', 'commands', 'workflows']) {
    parcourir(join(REPO, '.claude', racine));
  }
  return trouves;
}

test('AUCUN DOCUMENT PRESCRIPTIF NE NOMME UN MODULE DE POSTE DEPUIS UN DÉPÔT', () => {
  const dossiers = dossiersDePoste();
  assert.ok(dossiers.length > 0, 'pack.json doit déclarer au moins un module de portée poste');

  const racine = racineDuPoste();
  const documents = documentsPrescriptifs();
  assert.ok(documents.length > 0, 'le pack doit porter des documents prescriptifs');

  // Seuls les chemins EXÉCUTABLES sont visés : `<module>/bin/…`, `<module>/hooks/…`,
  // `<module>/src/…`. Une mention en prose du dossier seul n'est pas une commande.
  const executable = new RegExp(
    `(\\S*)(${dossiers.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})/(bin|hooks|src)/`,
    'g',
  );

  const fautes = [];
  for (const document of documents) {
    const texte = readFileSync(document, 'utf8');
    for (const ligne of texte.split('\n')) {
      for (const occurrence of ligne.matchAll(executable)) {
        const avant = occurrence[1];
        const ancre = avant.endsWith(`$HOME/${racine}/`) || avant.endsWith(`~/${racine}/`);
        if (!ancre) {
          fautes.push(`${relative(REPO, document)} : « ${avant}${occurrence[2]}/${occurrence[3]}/… »`);
        }
      }
    }
  }

  assert.deepEqual(
    fautes,
    [],
    'un module de portée poste est nommé depuis un dépôt — il n’existe dans aucun dépôt client, ' +
      `et le chemin ne résout nulle part. Ancre-le sur « $HOME/${racine}/ » :\n  ` +
      fautes.join('\n  '),
  );
});

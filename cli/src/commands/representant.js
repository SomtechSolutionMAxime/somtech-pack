// representant.js — met à jour un lieu d'agent déjà POSÉ dans un dépôt : le lieu d'un
// représentant (E-20260807-0004, D-20260807-0001) ou celui d'un orchestrateur
// (E-20260813-0002). Complémentaire des commandes qui POSENT (`ligne-directe representant`,
// `ligne-directe orchestrateur`) : celle-ci ne crée jamais un lieu, elle ne fait que le
// rafraîchir.
//
// RA-REL-014 — la frontière absolue de ce fichier : CLAUDE.md (et tout ce que le
// pack distribue à ce lieu) appartient au pack et se REMPLACE INTÉGRALEMENT à
// chaque mise à jour ; CONTEXTE.md appartient à celui qui l'a écrit et n'est JAMAIS touché.
//
// Elle vaut mot pour mot pour l'orchestrateur : son CONTEXTE.md porte à qui il répond, le
// gestionnaire du projet et sa PORTÉE — et c'est cette portée, écrite à la main, qui empêche
// deux orchestrateurs d'un même dépôt de se marcher dessus. L'écraser les ferait collisionner
// sans que rien ne le dise.
//
// Toute l'écriture passe par `applyFiles`/`collectFiles` (engine.js), déjà revus
// pour la convergence pack↔projet ailleurs dans le CLI (init/update/setup) :
// AUCUN autre appel d'écriture fichier n'existe dans ce module. C'est délibéré —
// une seule porte à surveiller pour la frontière CONTEXTE.md, gardée par un test
// statique dans cli/test/representant-update.test.js.
//
// La liste des fichiers synchronisés n'est JAMAIS écrite en dur : elle est
// ÉNUMÉRÉE depuis le gabarit source (`collectFiles`). Un fichier ajouté demain au
// gabarit converge automatiquement, sans toucher ce fichier. C'est ce qui évite le motif
// « un correctif ne couvre qu'une porte sur deux » : compter les fichiers à
// synchroniser en dur, c'est en oublier un le jour où le gabarit grandit.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolvePayloadRoot } from '../modules.js';
import { collectFiles, applyFiles } from '../engine.js';
import { nomDeLieuValide, messageNomInvalide, messageLieuAmbigu, resoudreLieu } from '../lieu-nom.js';

/**
 * Les deux rôles qui posent un lieu, avec ce qui les distingue — le gabarit dont ils
 * convergent et le dossier où leurs lieux se rangent.
 *
 * Cette table double celle de `ligne-directe/src/roles.js`, et c'est une divergence
 * ASSUMÉE plutôt qu'un oubli : le CLI est publié en paquet npm à partir de `cli/` seul et
 * n'embarque pas `ligne-directe/` (module de POSTE, `scope: poste` dans pack.json). Un import
 * vers lui casserait le paquet publié. Ce que ça coûte est borné à deux champs, et un test
 * les compare à la source pour que la divergence rougisse si elle s'installe.
 */
export const ROLES = {
  representant: { gabarit: 'gestionnaire-client', dossier: '.gestionnaire', libelle: 'Représentant' },
  orchestrateur: { gabarit: 'orchestrateur', dossier: '.orchestrateur', libelle: 'Orchestrateur' },
};

/** Le lieu d'où le pack distribue les gabarits du représentant (module `core`). */
export const GABARIT_DIR = join('.claude', 'templates', ROLES.representant.gabarit);

/**
 * Appartient à celui qui l'a écrit à la main : JAMAIS écrasé, et JAMAIS non plus créé par une
 * mise à jour (RA-REL-014). Le `preserve` générique d'engine.js (utilisé pour
 * `.claude/settings.json` ailleurs dans le CLI) crée le fichier s'il est absent — c'est le
 * comportement voulu pour un fichier de config projet, mais pas ici : cette commande
 * REFRAÎCHIT un lieu déjà posé, elle n'en complète jamais la pose. Un CONTEXTE.md absent
 * signale un lieu posé PARTIELLEMENT — pas une occasion de le fabriquer à la place de la
 * commande qui pose. On l'exclut donc de la liste des fichiers avant même d'appeler
 * `applyFiles` : la seule porte d'écriture ne le voit jamais passer, dans un sens ou l'autre.
 */
export const PRESERVE = ['CONTEXTE.md'];

/**
 * CE QUI ARME UN LIEU — le fichier de droits, et le fichier que son garde appelle.
 *
 * T-20260818-0034 : rafraîchir un lieu le DÉSARMAIT en silence. `.claude/settings.json` porte
 * le garde d'ouverture de ligne, il est pack-owned, donc il convergeait — et le gabarit ne
 * portait aucun `hooks`. Le geste qu'on recommande pour mettre un lieu à jour était celui qui
 * lui retirait sa protection, sans un mot. Un lieu désarmé se lit exactement comme un lieu
 * armé : seul un essai réel montrait la différence.
 *
 * ⚠️ LE CORRECTIF N'EST PAS D'AJOUTER CE FICHIER À `PRESERVE`, ET C'EST DÉLIBÉRÉ. Ça aurait
 * protégé l'armement existant en condamnant tout le reste : un lieu qui n'a jamais eu le garde
 * ne l'aurait jamais reçu, et plus aucune correction de droits n'aurait descendu. Le garde vit
 * désormais DANS LES GABARITS — la convergence le PORTE au lieu de l'effacer, et les droits
 * continuent de converger dans le même passage.
 *
 * ⚠️ ET LA CONVERGENCE N'IMPORTE PAS LE GARDE, ELLE LE RECONNAÎT. Le garde appartient à
 * `naissance-representant`, module de POSTE : un `import` vers lui casserait le paquet npm
 * publié, qui n'embarque que `bin/`, `src/` et `payload/` — la même contrainte que celle
 * commentée plus haut pour `ligne-directe/src/roles.js`. On sonde donc LE FICHIER QU'IL
 * APPELLE, jamais l'égalité de la commande entière : c'est la même règle que `fusionnerGarde`
 * applique pour reconnaître le sien, et pour la même raison — un garde posé par une version
 * antérieure porte un chemin absolu mort, qu'une comparaison stricte lirait comme une absence.
 */
const FICHIER_DES_DROITS = join('.claude', 'settings.json');
const APPEL_DU_GARDE = 'garde-ouverture-ligne.js';

/**
 * Ce lieu est-il armé, tel qu'il se trouve MAINTENANT sur le disque ?
 *
 * Rend `null` — jamais `false` — quand le fichier manque ou ne se lit pas. « Je n'ai pas pu
 * regarder » n'est pas « il n'y a rien » : confondre les deux annoncerait un désarmement sur un
 * lieu simplement posé de façon partielle, et ferait douter d'un lieu sain. C'est un état à
 * dire, pas à deviner.
 */
function armement(target) {
  const chemin = join(target, FICHIER_DES_DROITS);
  if (!existsSync(chemin)) return null;
  let settings;
  try {
    settings = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch {
    return null;
  }
  const hooks = settings?.hooks || {};
  return Object.values(hooks).some((blocs) => (blocs || []).some(
    (bloc) => (bloc?.hooks || []).some((h) => typeof h?.command === 'string' && h.command.includes(APPEL_DU_GARDE))
  ));
}

/**
 * Un seul segment de chemin sûr — jamais une évasion. La casse est LIBRE.
 *
 * ⚠️ CETTE FONCTION NE PORTE PLUS LA RÈGLE : elle la relaie (T-20260814-0101). La règle vit
 * dans `../lieu-nom.js`, le même texte que la POSE applique — sans quoi les deux gestes se
 * déphasent, ce qui est exactement le défaut qu'on ferme ici. Elle reste exportée parce que
 * des tests et des appelants la nomment ; elle ne décide plus rien de son côté.
 *
 * Ce qui a changé, et le pourquoi est en tête de `lieu-nom.js` : elle exigeait des MINUSCULES,
 * pendant que la pose écrivait le nom brut. Quatre lieux réels sur cinq portent une majuscule
 * et étaient donc inatteignables. La garde anti-évasion, elle, n'a pas bougé d'un pouce.
 */
export function clientSlugValide(client) {
  return nomDeLieuValide(client);
}

/**
 * Met à jour un lieu posé. `role` décide du gabarit source et du dossier cible, et rien
 * d'autre : la frontière CONTEXTE.md, la porte d'écriture unique et l'énumération depuis la
 * source sont les mêmes pour les deux — elles ont été payées une fois.
 */
export async function cmdLieuUpdate(flags, roleNom) {
  const role = ROLES[roleNom];
  if (!role) throw new Error(`rôle inconnu : « ${roleNom} »`);

  const nom = flags.client ?? flags.nom;
  const designe = `--${roleNom === 'orchestrateur' ? 'nom' : 'client'}`;
  if (!nomDeLieuValide(nom)) throw new Error(messageNomInvalide(nom, designe));

  const payloadRoot = resolvePayloadRoot({ source: flags.source });
  const sourceDir = join(payloadRoot, '.claude', 'templates', role.gabarit);
  if (!existsSync(sourceDir)) {
    throw new Error(`Gabarit introuvable (${sourceDir}) — le pack ne distribue pas (encore) de ${roleNom}`);
  }

  // LE LIEU SE RÉSOUT, IL NE SE COMPOSE PLUS (T-20260814-0101). `join(…, nom)` visait le nom
  // tapé et manquait le lieu réel dès que la casse différait — sur macOS le noyau rattrapait
  // en silence, ailleurs la commande aurait échoué (ou, pire, posé sa cible à côté du vrai).
  // C'est la MÊME résolution que la pose applique, au même texte : `src/lieu-nom.js`.
  const depot = flags.target || process.cwd();
  const lieu = resoudreLieu(depot, role.dossier, nom, designe);
  if (lieu.ambigu) throw new Error(messageLieuAmbigu(nom, resolve(lieu.parent), lieu.homonymes));

  const target = resolve(lieu.racine);
  if (!existsSync(target)) {
    throw new Error(
      `${target} n'existe pas — ce ${roleNom} n'a jamais été « posé ». `
        + `Cette commande met à jour un lieu existant, elle n'en pose aucun.`
    );
  }

  const { files: tous } = collectFiles(sourceDir, ['']);
  const preserveSet = new Set(PRESERVE);
  const files = tous.filter((rel) => !preserveSet.has(rel));
  const report = applyFiles({
    payloadRoot: sourceDir,
    target,
    files,
    dryRun: flags.dryRun,
  });
  report.preserved = tous.filter((rel) => preserveSet.has(rel) && existsSync(join(target, rel)));

  const converged = flags.dryRun ? 'à converger' : 'convergés (version du pack)';
  console.log(`${role.libelle} « ${nom} » → ${target}${flags.dryRun ? ' [dry-run]' : ''}`);
  // Le lieu réel ne porte pas la casse demandée : on le DIT. Le taire, c'est laisser croire
  // qu'on a visé « francois » alors qu'on a écrit dans « Francois » — la confusion exacte que
  // macOS entretenait en silence.
  if (!lieu.exact) console.log(`  ↳ lieu trouvé sous le nom « ${lieu.nom} » (la casse diffère de « ${nom} »)`);
  if (report.created.length) console.log(`  créés : ${report.created.join(', ')}`);
  if (report.updated.length) console.log(`  ${converged} : ${report.updated.join(', ')}`);
  if (report.unchanged.length) console.log(`  inchangés : ${report.unchanged.length}`);
  if (report.backedUp.length) console.log(`  💾 dérives sauvegardées avant convergence (.somtech.bak) : ${report.backedUp.join(', ')}`);
  if (report.preserved.length) console.log(`  🔒 préservés (écrits à la main, jamais écrasés) : ${report.preserved.join(', ')}`);
  if (report.conflicts.length) console.log(`  ↩︎  en conflit (symlink en cible, non écrit à travers) : ${report.conflicts.join(', ')}`);

  // L'ÉTAT D'ARMEMENT DU LIEU, DIT À CHAQUE PASSAGE — et LU SUR LE DISQUE, jamais déduit de ce
  // qu'on croit avoir écrit. C'est ce qui répond à « un lieu peut dire s'il est armé sans qu'on
  // ait à provoquer un blocage » : la question se pose (`--dry-run` suffit, il n'écrit rien),
  // elle ne se déclenche plus.
  //
  // Et c'est le filet du correctif lui-même : si un jour le garde cesse de descendre — gabarit
  // amputé au paquet, `.claude/settings.json` laissé en conflit derrière un symlink — la
  // commande le DIT, au lieu de rendre le succès muet qui a fait ce ticket.
  const arme = armement(target);
  if (arme === true) {
    console.log('  🛡️ armé — le garde d’ouverture de ligne est en place dans ce lieu');
  } else if (arme === false) {
    console.log(
      '  ⚠️ DÉSARMÉ — aucun garde d’ouverture de ligne dans ce lieu : l’agent qui l’habitera '
        + 'pourra travailler AVANT d’avoir ouvert sa ligne, et personne ne le saura.'
    );
    console.log('     ↳ à rétablir en le faisant naître, ou en repassant cette commande depuis un pack à jour.');
  } else {
    console.log(`  ⚠️ armement INCONNU — ${FICHIER_DES_DROITS} est absent ou illisible : ce lieu est posé partiellement.`);
  }

  return flags.dryRun && report.updated.length ? 2 : 0;
}

export async function cmdRepresentantUpdate(flags) {
  return cmdLieuUpdate(flags, 'representant');
}

export async function cmdOrchestrateurUpdate(flags) {
  return cmdLieuUpdate(flags, 'orchestrateur');
}

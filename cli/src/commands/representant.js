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
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolvePayloadRoot } from '../modules.js';
import { collectFiles, applyFiles } from '../engine.js';

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

/** Un slug : un seul segment de chemin sûr, en minuscules — jamais une évasion. */
export function clientSlugValide(client) {
  return typeof client === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(client);
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
  if (!clientSlugValide(nom)) {
    throw new Error(
      `--${roleNom === 'orchestrateur' ? 'nom' : 'client'} requis : un slug en minuscules ` +
        `(lettres/chiffres/tirets), reçu « ${nom ?? ''} »`
    );
  }

  const payloadRoot = resolvePayloadRoot({ source: flags.source });
  const sourceDir = join(payloadRoot, '.claude', 'templates', role.gabarit);
  if (!existsSync(sourceDir)) {
    throw new Error(`Gabarit introuvable (${sourceDir}) — le pack ne distribue pas (encore) de ${roleNom}`);
  }

  const target = resolve(join(flags.target || process.cwd(), role.dossier, nom));
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
  if (report.created.length) console.log(`  créés : ${report.created.join(', ')}`);
  if (report.updated.length) console.log(`  ${converged} : ${report.updated.join(', ')}`);
  if (report.unchanged.length) console.log(`  inchangés : ${report.unchanged.length}`);
  if (report.backedUp.length) console.log(`  💾 dérives sauvegardées avant convergence (.somtech.bak) : ${report.backedUp.join(', ')}`);
  if (report.preserved.length) console.log(`  🔒 préservés (écrits à la main, jamais écrasés) : ${report.preserved.join(', ')}`);
  if (report.conflicts.length) console.log(`  ↩︎  en conflit (symlink en cible, non écrit à travers) : ${report.conflicts.join(', ')}`);

  return flags.dryRun && report.updated.length ? 2 : 0;
}

export async function cmdRepresentantUpdate(flags) {
  return cmdLieuUpdate(flags, 'representant');
}

export async function cmdOrchestrateurUpdate(flags) {
  return cmdLieuUpdate(flags, 'orchestrateur');
}

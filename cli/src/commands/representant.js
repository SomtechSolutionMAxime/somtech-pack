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
import { verifierFraicheur } from '../fraicheur-gabarit.js';

/**
 * Les rôles dont cette commande sait rafraîchir le lieu, avec ce qui les distingue — le
 * gabarit dont ils convergent et le dossier où leurs lieux se rangent.
 *
 * Cette table double celle de `ligne-directe/src/roles.js`, et c'est une divergence ASSUMÉE
 * plutôt qu'un oubli : aucun chemin d'import ne marche des deux côtés. Le paquet npm publié
 * porte `files: ["bin", "src", "payload"]` — il EMBARQUE bien `ligne-directe/`, mais sous
 * `payload/ligne-directe/` et nulle part ailleurs (`cli/scripts/build-payload.mjs` copie tous
 * les modules de `pack.json`). Donc :
 *
 *   • `../../../ligne-directe/src/roles.js` résout dans le dépôt et n'existe pas dans le
 *     paquet — la commande tomberait CHEZ LE CLIENT, jamais en CI ;
 *   • `../../payload/ligne-directe/src/roles.js` résout dans le paquet et fait dépendre le
 *     code de production d'un artefact de build gitignoré, absent d'un dépôt fraîchement cloné.
 *
 * ⚠️ CE QUI RENDAIT LA DIVERGENCE INOFFENSIVE N'EXISTAIT PAS (T-20260826-0076). Ce commentaire
 * affirmait qu'« un test les compare à la source » ; aucun ne le faisait. Mesuré par mutation
 * le 2026-08-26 : un rôle fantôme ajouté ICI, pointant un gabarit inexistant, laissait la suite
 * ENTIÈREMENT VERTE ; un rôle ajouté au registre et absent d'ici ne faisait rougir que le texte
 * d'une compétence. La garantie affirmée dispensait d'aller voir — c'est ce qui a bloqué la
 * naissance des neuf rôles arbitrés.
 *
 * La garde existe désormais : `cli/test/registre-des-roles-miroir.test.js`. Elle compare
 * `gabarit`/`dossier` ET L'ENSEMBLE DES CLÉS, DANS LES DEUX SENS — un rôle présent d'un côté et
 * absent de l'autre rougit. Ajouter un rôle au registre sans l'ajouter ici n'est plus silencieux.
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
// ⚠️ `RONDE.md` L'A REJOINT (T-20260826-0042), et pour la même raison exactement : il porte le
// chantier de l'agent, pas le métier du pack. Un briefing de ronde écrasé par une mise à jour
// ne se voit pas — il se constate à ce que l'agent ne se réveille plus, et une ronde éteinte ne
// produit aucune erreur. La liste est tenue en miroir de `FICHIERS_A_RENSEIGNER`
// (`ligne-directe/src/lieu-renseigne.js`), qu'un essai compare à celle-ci.
export const PRESERVE = ['CONTEXTE.md', 'RONDE.md'];

/**
 * CEUX DES PRÉSERVÉS QU'ON DÉPOSE QUAND ILS MANQUENT — et il n'y en a qu'un.
 *
 * ⚠️ `PRESERVE` NE VEUT PAS DIRE « JAMAIS ÉCRASÉ », IL VEUT DIRE « JAMAIS TOUCHÉ » : ses
 * entrées sont retirées de la liste AVANT `applyFiles`, donc la seule porte d'écriture ne les
 * voit passer dans aucun sens. C'est voulu pour `CONTEXTE.md` (RA-REL-014) et ça le reste.
 *
 * ⚠️ MAIS APPLIQUÉ TEL QUEL À `RONDE.md`, ÇA RENDAIT SON LOT INERTE (T-20260826-0042).
 * Le briefing n'aurait atteint AUCUN des dix-huit lieux vivants : ni par la pose, qui refuse
 * un lieu incomplet plutôt que de le compléter, ni par ici, qui ne crée pas un préservé. Un
 * cinquième élément du cycle présent dans le dépôt et absent de la vie de tous les agents.
 *
 * LA DISTINCTION SE MESURE, elle n'est pas une exception de confort :
 *
 *   • `CONTEXTE.md` a TOUJOURS fait partie du gabarit. Absent d'un lieu, il SIGNALE une pose
 *     partielle — un symptôme, que la pose attrape déjà par `lieu_partiel`. Le fabriquer ici
 *     masquerait ce qu'elle attrape.
 *   • `RONDE.md` n'existait pas avant ce lot. Absent, il ne signale rien : aucun lieu du parc
 *     n'a jamais pu l'avoir. Le déposer vierge n'écrase rien et ne masque rien.
 *
 * ⚠️ ET IL RESTE PRÉSERVÉ : déposé s'il manque, JAMAIS touché s'il est là. Un briefing écrasé
 * ne se voit pas — il se constate à ce que l'agent ne se réveille plus, et une ronde éteinte
 * ne produit aucune erreur. Un essai exige que tout `CREE_SI_ABSENT` soit aussi dans
 * `PRESERVE` : déposer sans protéger serait pire que ne rien déposer.
 */
export const CREE_SI_ABSENT = ['RONDE.md'];

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
 * L'ÉVÉNEMENT SOUS LEQUEL LE GARDE GARDE QUELQUE CHOSE — et le seul.
 *
 * Trouvé en revue : sonder tous les événements confondus faisait passer pour armé un lieu dont
 * le garde était rangé sous `SessionStart`. Ailleurs que sur `PreToolUse`, le garde ne
 * s'interpose devant aucun appel d'outil : le lieu est aussi nu que s'il n'en avait pas, et
 * l'annoncer protégé rejoue le mensonge que ce ticket ferme, déplacé d'un cran.
 */
const EVENEMENT_DU_GARDE = 'PreToolUse';

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
  // CHAQUE NIVEAU EST VÉRIFIÉ AVANT D'ÊTRE PARCOURU. `settings.json` est écrit à la main aussi
  // souvent qu'il est généré : un `hooks` syntaxiquement valide en JSON mais structurellement
  // faux (un objet là où un tableau est attendu, une chaîne à la place d'une liste de hooks) est
  // une forme qu'on rencontre, pas une hypothèse. Sans ces contrôles, la sonde levait un
  // TypeError et la commande rendait `exit 1` — elle faisait ÉCHOUER une convergence qui
  // réussissait avant ce lot, en cassant l'observabilité même qu'on venait d'ajouter.
  //
  // Une forme qu'on ne reconnaît pas rend `false` et non `null` : le fichier a bien été lu, et
  // ce qu'on y a lu ne porte aucun garde actif. C'est un désarmement constaté, pas une lecture
  // impossible.
  const blocs = settings?.hooks?.[EVENEMENT_DU_GARDE];
  if (!Array.isArray(blocs)) return false;
  // `some` SUR LES BLOCS, et ce n'est pas interchangeable avec `every` : Claude Code exécute
  // TOUS les blocs d'un même événement, donc un seul qui porte le garde suffit à armer le lieu.
  // Et la forme à plusieurs blocs est celle de la production — `fusionnerGarde` ajoute le garde
  // À LA SUITE des PreToolUse déjà présents plutôt que de les remplacer.
  return blocs.some((bloc) => {
    const hooks = bloc?.hooks;
    return Array.isArray(hooks)
      && hooks.some((h) => typeof h?.command === 'string' && h.command.includes(APPEL_DU_GARDE));
  });
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

  // ─── LA GARDE DE FRAÎCHEUR — la MÊME que celle de la pose (E-20260818-0014, T-20260818-0112).
  //
  // ⚠️ ELLE VAUT POUR LA FONCTION, PAS POUR LE GESTE OÙ ON L'A ÉCRITE. Sans elle ici, ce
  // geste-ci — celui qu'on RECOMMANDE pour remettre un lieu d'aplomb — réinstallerait le
  // métier périmé dans le lieu qu'il prétend réparer. Mesuré : sur les six dépôts du parc au
  // 2026-08-18, aucun ne portait le gabarit du poste ; rafraîchir un lieu dans l'un d'eux
  // l'aurait fait converger vers un métier d'une autre époque, en annonçant un succès.
  //
  // ⚠️ ET CE QU'ELLE MESURE ICI N'EST PAS CE QUE MESURE LA POSE — c'est voulu. La pose sert le
  // gabarit du DÉPÔT ; cette commande sert celui du PAYLOAD résolu (`resolvePayloadRoot` :
  // `--source`, `SOMTECH_PACK_PAYLOAD`, `cli/payload`, puis la racine du dépôt).
  //
  // CE QUI EST MESURÉ SUR CE POSTE, 2026-08-18 : `cli/payload` est ignoré par git
  // (`.gitignore:13`), produit par `npm run build:payload` / `prepublishOnly`, et son gabarit
  // orchestrateur CONCORDE aujourd'hui avec celui du dépôt sur les quatre fichiers. Mesuré
  // aussi, par un autre agent, sur le chemin du paquet PUBLIÉ : trois installations du jour
  // (v1.67, v1.68, v1.69) ont fait converger le poste vers `main`, fichier par fichier.
  //
  // `[non établi]` : qu'un payload SERVI puisse être périmé en pratique. C'est ce qu'on
  // attendrait d'un produit de build non versionné, ce n'est pas ce qu'on a constaté. La garde
  // ne repose donc sur aucune conclusion à ce sujet : elle compare `sourceDir` — quel qu'il
  // soit, payload ou `--source` — au pack du poste. Le payload est ce qu'on MESURE, jamais ce
  // contre quoi on mesure ; la référence ne vient QUE de `~/.claude/plugins/marketplaces/…`
  // (voir `referenceDuPoste`), et un test l'exige.
  //
  // Le refus tombe AVANT `applyFiles` : le lieu n'est pas touché.
  const fraicheur = verifierFraicheur({
    depot,
    gabaritDepot: sourceDir,
    gabarit: role.gabarit,
    libelle: role.libelle.toLowerCase(),
  });
  if (fraicheur.perime) {
    throw new Error(
      `${fraicheur.message}\n  Rien n’a été modifié dans « ${target} » : ce lieu porte encore ce qu’il portait.`
    );
  }

  const { files: tous } = collectFiles(sourceDir, ['']);
  const preserveSet = new Set(PRESERVE);
  // Un préservé de `CREE_SI_ABSENT` qui n'est PAS sur le disque passe la porte d'écriture —
  // une seule fois, pour naître. Dès qu'il existe, il redevient intouchable comme les autres.
  const aDeposer = new Set(CREE_SI_ABSENT.filter((rel) => !existsSync(join(target, rel))));
  const files = tous.filter((rel) => !preserveSet.has(rel) || aDeposer.has(rel));
  const report = applyFiles({
    payloadRoot: sourceDir,
    target,
    files,
    dryRun: flags.dryRun,
  });
  report.preserved = tous.filter((rel) => preserveSet.has(rel) && !aDeposer.has(rel) && existsSync(join(target, rel)));

  const converged = flags.dryRun ? 'à converger' : 'convergés (version du pack)';
  console.log(`${role.libelle} « ${nom} » → ${target}${flags.dryRun ? ' [dry-run]' : ''}`);
  // CE QU'ON N'A PAS PU MESURER SE DIT — il ne se tait pas. Une convergence qui ne sait pas si
  // le métier qu'elle sert est celui du pack l'annonce, plutôt que de rendre le succès muet
  // qui a fait ce ticket. C'est aussi ce qui rend visible un `cli/payload` périmé, produit de
  // build qu'aucun `git status` ne signale.
  if (!fraicheur.verifie) {
    console.log(`  ⚠️ métier NON VÉRIFIÉ — ${fraicheur.raison}`);
  }
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

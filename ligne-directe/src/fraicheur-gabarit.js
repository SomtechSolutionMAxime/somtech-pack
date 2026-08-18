// fraicheur-gabarit.js — le gabarit qu'on s'apprête à SERVIR est-il celui du pack installé
// sur ce poste ? Et RIEN D'AUTRE.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE FICHIER FERME (T-20260818-0102, E-20260818-0014)
//
// La pose d'un lieu sert le gabarit du DÉPÔT CIBLE (`lieu-agent.js`, `gabaritsDir`). Elle
// vérifiait qu'il était PRÉSENT — jamais qu'il était le BON. Mesuré le 2026-08-18 : un
// orchestrateur né chez un client a reçu, octet pour octet, le gabarit d'un pack `v1.48.0`
// installé là et jamais mis à jour, pendant que le poste était en `v1.69.0`. Le lieu posé
// disait « tu es le pilote d'un chantier » là où le métier à jour dit autre chose, et il lui
// manquait sept sections entières. La commande a rendu `ok:true`, quatre fichiers, une ligne
// joignable. **Rien ne signalait que le contenu était faux.**
//
// C'est le motif dominant de ce dépôt, à sa neuvième occurrence : vérifier qu'une chose est
// EN PLACE, jamais qu'elle est la BONNE.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI L'EMPREINTE, ET JAMAIS LE NUMÉRO DE VERSION
//
// T-20260816-0020 l'avait déjà établi, et la mesure du 2026-08-18 l'a reconstaté sur ce
// poste même : le clone de référence porte `VERSION` = `1.64.0` avec le gabarit de la
// `v1.69.0`. Un numéro dit ce qu'on a DÉCLARÉ ; l'empreinte dit ce qu'on a. Elle attrape en
// prime le gabarit modifié à la main, qu'aucun numéro ne trahirait.
//
// Le cache de `pack-freshness.sh` a été écarté pour la même raison, et pour une seconde :
// mesuré à `latest: 1.66.0` pour un poste en `v1.69.0` — trois versions de retard — et
// fail-silent par contrat. Une garde bâtie dessus se serait tue exactement là où il fallait
// qu'elle parle.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ RÉFÉRENCE INTROUVABLE ⇒ JAMAIS UN REFUS. C'est le piège que la conception nomme, et il
// est le vrai risque de ce lot : une garde qui refuse un poste neuf — un poste qui n'a
// simplement jamais ajouté le marketplace — serait retirée en une semaine, emportant avec
// elle ce qu'elle gardait vraiment. On ne conclut donc RIEN de ce qu'on n'a pas su mesurer :
// la mesure impossible se DIT, elle ne décide pas. C'est la même règle que `lieu-agent.js`
// applique déjà quand `git` ne répond pas sur la versionnabilité.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE FICHIER EXISTE EN DEUX EXEMPLAIRES OCTET POUR OCTET
//
//   ligne-directe/src/fraicheur-gabarit.js   ← la SOURCE (module de poste)
//   cli/src/fraicheur-gabarit.js             ← la copie (paquet npm publié)
//
// La duplication est imposée par la distribution, exactement comme pour `lieu-nom.js` : le
// paquet npm du CLI n'embarque que `bin/`, `src/` et `payload/` — un import vers un module de
// poste le casserait chez le client, pas en CI. Elle est rendue INOFFENSIVE par
// `cli/test/fraicheur-gabarit-miroir.test.js`, qui compare les deux octet pour octet ET fait
// juger le même corpus aux deux exemplaires. Le geste qui répare :
// « node cli/scripts/sync-fraicheur-gabarit.mjs ».
//
// ⚠️ CONSÉQUENCE DIRECTE : ce fichier n'importe QUE des modules `node:`. Un import vers
// `roles.js` ou tout autre voisin ferait tomber la copie côté CLI, où ils n'existent pas.
// Un test le vérifie.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Où le pack est déposé sur le POSTE, sous le répertoire personnel — le clone du marketplace
 * que Claude Code tient à jour. C'est la seule référence dont on dispose qui porte le gabarit
 * RÉEL plutôt qu'un numéro : un paquet npm résolu par `npx` peut venir d'un cache muet, et le
 * dépôt courant est justement l'objet de la question.
 *
 * Le sous-chemin s'arrête AVANT le nom du gabarit : `referenceDuPoste` y ajoute celui du rôle.
 */
export const SOUS_CHEMIN_REFERENCE = join(
  '.claude', 'plugins', 'marketplaces', 'somtech-pack', '.claude', 'templates'
);

/** Ce que l'opérateur a à faire, et la seule chose qu'on lui dise de faire. */
export const COMMANDE_DE_RATTRAPAGE = 'npx @somtech-solutions/pack update';

/**
 * CE QUI N'APPARTIENT À AUCUN PACK, et que l'empreinte ne compte donc pas.
 *
 * ⚠️ LES DEUX ENTRÉES ONT ÉTÉ MESURÉES, PAS IMAGINÉES — et la seconde aurait fait échouer ce
 * lot en production.
 *
 *   • `.DS_Store` — écrit par le Finder dans tout répertoire ouvert une fois, gitignoré ici,
 *     distribué par personne. Le compter ferait refuser un dépôt parfaitement à jour parce
 *     que quelqu'un a REGARDÉ le dossier. (Relevé : aucun dans les douze répertoires de
 *     gabarit du parc au 2026-08-18 — la porte était fermée avant d'avoir servi.)
 *
 *   • `*.somtech.bak`, `*.somtech.bak.<n>` — LE CAS QUI COMPTE, et il est certain. Ces
 *     fichiers sont les sauvegardes que la CONVERGENCE DU PACK LUI-MÊME dépose à côté d'un
 *     fichier qu'elle remplace. Mesuré sur le parc : `actionprogex/orchestrateur` et
 *     `sibelanger/orchestrateur` portent un gabarit au contenu RÉELLEMENT IDENTIQUE, et
 *     rendaient deux empreintes différentes — le second traînait un `CLAUDE.md.somtech.bak`.
 *     Les compter, c'est refuser un dépôt PARCE QU'IL A ÉTÉ MIS À JOUR : la mise à jour qu'on
 *     recommande dans le message de refus laisse le résidu qui reconduirait le refus. La
 *     garde aurait mordu la main qui la répare, et le geste de rattrapage n'aurait jamais
 *     convergé.
 *
 * ⚠️ ET LA LISTE S'ARRÊTE LÀ. Chaque motif ajouté ici est un fichier qu'un pack pourrait
 * distribuer sans que la garde le voie : on n'y met que ce qu'on a CONSTATÉ, jamais ce qu'on
 * imagine — un « au cas où » de plus, et la garde ne mesure plus le gabarit.
 */
export const PARASITES = [
  /^\.DS_Store$/,
  /\.somtech\.bak(\.\d+)?$/,
];

/** Ce nom de fichier appartient-il au pack, ou n'est-il que du bruit déposé à côté ? */
export function estParasite(nom) {
  return PARASITES.some((motif) => motif.test(nom));
}

/**
 * Les fichiers d'un répertoire de gabarit, en chemins relatifs POSIX triés — récursivement,
 * dotfiles compris.
 *
 * ⚠️ LES DOTFILES SONT LA MOITIÉ DU GABARIT, et les oublier serait mesurer un objet pour
 * conclure sur un autre : `.mcp.json` porte les moyens, `.claude/settings.json` porte les
 * DROITS et le garde d'ouverture de ligne. Un gabarit dont seul `settings.json` aurait
 * changé — le cas exact de T-20260818-0034, où rafraîchir un lieu le DÉSARMAIT — passerait à
 * travers une empreinte qui ne regarderait que `CLAUDE.md`. `readdirSync` les rend, contrairement
 * à un `*` de shell : c'est la raison de ne pas mesurer ça avec un glob.
 *
 * Lève si le répertoire ne se lit pas — l'appelant traduit ça en « je n'ai pas su mesurer ».
 */
function fichiersDuGabarit(dir) {
  const trouves = [];
  const marcher = (relatif) => {
    const entrees = readdirSync(relatif ? join(dir, relatif) : dir, { withFileTypes: true });
    for (const e of entrees) {
      if (estParasite(e.name)) continue;
      const rel = relatif ? `${relatif}/${e.name}` : e.name;
      if (e.isDirectory()) marcher(rel);
      else trouves.push(rel);
    }
  };
  marcher('');
  return trouves.sort();
}

/**
 * L'empreinte d'un répertoire de gabarit — `null` quand il n'a pas pu être mesuré.
 *
 * Elle porte les CHEMINS autant que les CONTENUS : un fichier retiré du gabarit change
 * l'empreinte au même titre qu'un fichier modifié. Sans les chemins, un pack qui perdrait
 * `.claude/settings.json` et un pack qui le garderait pourraient se ressembler.
 *
 * ⚠️ `null` N'EST PAS `false`. « Je n'ai pas pu regarder » et « ils diffèrent » mènent à deux
 * conduites opposées — la seconde refuse, la première ne refuse JAMAIS. Les confondre est
 * précisément ce qui transformerait cette garde en garde qui crie à tort.
 */
export function empreinteGabarit(dir) {
  let fichiers;
  try {
    fichiers = fichiersDuGabarit(dir);
  } catch {
    return null;
  }
  // Un répertoire VIDE n'a pas d'empreinte comparable : il n'est pas un gabarit, il est
  // l'absence d'un gabarit. Rendre une empreinte de « rien » ferait s'égaler deux répertoires
  // vides, et passer une pose qui n'a rien à servir.
  if (fichiers.length === 0) return null;

  const somme = createHash('sha256');
  for (const rel of fichiers) {
    let contenu;
    try {
      contenu = readFileSync(join(dir, rel));
    } catch {
      return null; // un seul fichier illisible, et l'empreinte entière est sans valeur
    }
    somme.update(rel, 'utf8');
    somme.update('\0');
    somme.update(createHash('sha256').update(contenu).digest());
    somme.update('\0');
  }
  return somme.digest('hex');
}

/**
 * Où trouver, sur CE poste, le gabarit de référence du rôle demandé.
 *
 * `foyer` est injectable — c'est ce qui rend la garde éprouvable sans dépendre de l'état du
 * poste qui exécute la suite. Aucun appelant de production ne le passe (un test le vérifie) :
 * la résolution réelle est donc toujours celle qui est exercée.
 */
export function referenceDuPoste(gabarit, { foyer } = {}) {
  const maison = foyer ?? process.env.HOME ?? homedir();
  if (!maison) {
    return { chemin: null, raison: 'aucun répertoire personnel n’est connu de ce processus' };
  }
  const chemin = join(maison, SOUS_CHEMIN_REFERENCE, gabarit);
  if (!existsSync(chemin)) {
    return { chemin: null, raison: `aucun gabarit de référence sous « ${chemin} »` };
  }
  return { chemin, raison: null };
}

/**
 * CE DÉPÔT EST-IL LA SOURCE DU PACK LUI-MÊME ?
 *
 * ⚠️ LE FAUX REFUS QUE CE TEST ÉVITE EST CERTAIN, PAS HYPOTHÉTIQUE. Le dépôt `somtech-pack`
 * est l'endroit où les gabarits SE MODIFIENT : dès qu'une branche y touche à un gabarit, son
 * arbre de travail diverge du pack installé sur le poste — c'est la définition même du
 * travail en cours, pas une péremption. Refuser là, ce serait empêcher de poser un
 * orchestrateur dans le seul dépôt où on en pose tous les jours, et pour la seule raison
 * qu'on y fait son métier. Une garde qui crie à tort finit par se faire retirer, en emportant
 * ce qu'elle gardait vraiment.
 *
 * ⚠️ RECONNU PAR LE FAIT, ET PAR LE NOM DÉCLARÉ — jamais par le nom du répertoire, qu'un
 * clone renomme, ni par la seule présence d'un fichier. `pack.json` à la racine avec
 * `"name": "somtech-pack"` est ce que porte la source et ce que ne porte AUCUN dépôt servi :
 * mesuré le 2026-08-18 sur les dépôts clients du poste — le pack y dépose `.claude/`,
 * `scripts/`, `docs/`, jamais son manifeste.
 *
 * ⚠️ ET CE N'EST PAS UNE PORTE DÉROBÉE : l'exemption ne se prend pas en silence. Elle rend
 * `metier_verifie: false` avec sa raison, comme toute mesure qu'on n'a pas faite — on ne
 * conclut rien, on le dit.
 */
export function depotEstLaSourceDuPack(depot) {
  if (!depot) return false;
  try {
    return JSON.parse(readFileSync(join(depot, 'pack.json'), 'utf8'))?.name === 'somtech-pack';
  } catch {
    // Absent, illisible ou mal formé : ce n'est pas la source. Le doute ne dispense pas.
    return false;
  }
}

/**
 * LA GARDE, et le seul endroit où le verdict se forme.
 *
 * Rend l'un de trois états, et jamais autre chose :
 *
 *   { verifie: true,  empreinte }                        le dépôt sert le métier du poste
 *   { verifie: false, raison }                           on n'a PAS su mesurer → ne refuse rien
 *   { verifie: false, perime: true, …, message }         les deux empreintes diffèrent → REFUS
 *
 * L'appelant décide quoi faire d'un `perime` — refuser à la pose, refuser à la mise à jour —
 * mais il ne redécide jamais du VERDICT. Deux endroits qui jugeraient chacun leur fraîcheur
 * se déphaseraient au premier correctif : ce dépôt a déjà payé ça neuf fois.
 *
 * @param {string} gabaritDepot  le répertoire de gabarits qu'on s'apprête à servir
 * @param {string} gabarit       le nom du dossier de gabarit du rôle (« orchestrateur », …)
 * @param {string} libelle       comment nommer le rôle à l'opérateur — le module ne le sait pas
 * @param {string} [foyer]       le répertoire personnel, pour les tests uniquement
 */
export function verifierFraicheur({ gabaritDepot, gabarit, libelle = 'agent', foyer, depot } = {}) {
  if (depotEstLaSourceDuPack(depot)) {
    return {
      verifie: false,
      raison:
        `le gabarit servi n’a pas été comparé au pack de ce poste : ce dépôt EST la source du ` +
        `pack, et son gabarit y fait foi — c’est ici qu’il se modifie.`,
    };
  }

  const reference = referenceDuPoste(gabarit, { foyer });
  if (!reference.chemin) {
    // ⚠️ LA BRANCHE QUI NE REFUSE JAMAIS. Elle est la raison d'être de la forme à trois états.
    return {
      verifie: false,
      raison:
        `le gabarit servi n’a pas pu être comparé au pack de ce poste (${reference.raison}) — ` +
        `on ne sait donc pas s’il est à jour, et on n’en conclut rien.`,
    };
  }

  const empreinteReference = empreinteGabarit(reference.chemin);
  const empreinteDepot = empreinteGabarit(gabaritDepot);
  if (!empreinteReference || !empreinteDepot) {
    const muet = !empreinteReference ? reference.chemin : gabaritDepot;
    return {
      verifie: false,
      raison:
        `le gabarit servi n’a pas pu être comparé au pack de ce poste (« ${muet} » ne s’est pas ` +
        `laissé mesurer) — on ne sait donc pas s’il est à jour, et on n’en conclut rien.`,
    };
  }

  if (empreinteDepot === empreinteReference) {
    return { verifie: true, empreinte: empreinteDepot, reference: reference.chemin };
  }

  // ⚠️ CE MESSAGE DIT CE QU'ON A MESURÉ, JAMAIS CE QU'ON EN CONCLUT (T-20260811-0087). Il ne
  // dit pas « ton pack est vieux » — il ne le sait pas : le dépôt peut porter un gabarit
  // MODIFIÉ, ou plus récent que le poste. Il porte les deux empreintes et les deux chemins,
  // et laisse l'opérateur juger.
  //
  // ⚠️ ET IL NE DIT PAS CE QUE L'APPELANT N'A PAS FAIT — relevé en essayant la commande pour de
  // vrai : « rien n'a été créé » sonnait faux au bout d'une MISE À JOUR, qui ne crée rien même
  // quand elle réussit. Ce message-ci dit ce qu'il a MESURÉ ; chaque appelant ajoute ce qu'il
  // n'a pas touché, parce que lui seul le sait.
  //
  // ⚠️ ET AUCUNE COMMANDE DESTRUCTRICE N'Y FIGURE — même règle. La seule chose qu'on
  // recommande met à jour ; rien n'efface, rien ne force.
  return {
    verifie: false,
    perime: true,
    empreinte_depot: empreinteDepot,
    empreinte_reference: empreinteReference,
    chemin_depot: gabaritDepot,
    chemin_reference: reference.chemin,
    message:
      `le gabarit du ${libelle} que ce dépôt porte n’est pas celui du pack installé sur ce poste. ` +
      `Mesuré :\n` +
      `    gabarit du dépôt   « ${gabaritDepot} »\n` +
      `      empreinte ${empreinteDepot}\n` +
      `    pack de ce poste   « ${reference.chemin} »\n` +
      `      empreinte ${empreinteReference}\n` +
      `  Un ${libelle} qui recevrait ce gabarit-là porterait un métier qui n’est pas celui du ` +
      `pack — et il ne le saurait jamais, puisqu’il ne lit que son lieu.\n` +
      `  Mets le pack à jour dans le dépôt cible (« ${COMMANDE_DE_RATTRAPAGE} »), puis relance.`,
  };
}

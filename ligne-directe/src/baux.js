// baux.js — LE BAIL D'UN PANE : « quelqu'un mesure ici, ne touche à rien ».
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT QUI REND CE MODULE NÉCESSAIRE (T-20260818-0078)
//
// Un balayeur va parcourir les panes du poste et SOUMETTRE les boîtes de saisie restées
// occupées par un texte non soumis. Le geste est irréversible : la touche d'envoi part au nom
// de celui devant qui la boîte s'affiche.
//
// Le danger n'est pas la boîte d'un agent au travail — `delivrance.js` porte déjà les gardes
// qui protègent celui-là (immobilité, relecture, refus devant un choix). Le danger est le BANC
// D'ESSAI : un agent qui, en ce moment même, mesure le comportement d'un autre en observant sa
// boîte. Soumettre ce texte-là ne casse pas un message — ça fausse un VERDICT, et le verdict
// faussé se lit comme un vrai.
//
// ⚠️ ET AUCUN SIGNE OBSERVABLE NE SÉPARE UN BANC D'UN AGENT EN EXERCICE. Mesuré le
// 2026-08-18 : **87 agents sur 87** portent une session Claude vivante. Ni la présence d'une
// session, ni l'activité de l'écran, ni le nom du pane ne disent lequel est en train de mesurer.
// Se rabattre sur un nom (`cible-*`) serait reconnaître une chose par un signe qui n'est pas la
// chose : le jour où un banc nomme sa cible autrement, le balayeur soumet dans sa mesure.
//
// D'OÙ CE MODULE : ce n'est pas le balayeur qui devine, c'est CELUI QUI MONTE L'ESSAI QUI
// DÉCLARE. Il pose un bail sur le pane qu'il mesure ; le balayeur s'abstient devant un pane
// sous bail, quel que soit le contenu de sa boîte. Le seul contrat entre les deux est
// `sousBail(pane) → boolean` — rien d'autre ne traverse.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI UN BAIL EXPIRE, ET POURQUOI CE N'EST PAS UN DÉTAIL DE COMMODITÉ
//
// Un bail éternel est un TROU PERMANENT. Celui qui monte un essai n'est presque jamais celui
// qui le range : une session meurt, un agent est tué, un banc échoue au milieu — et la
// réservation, elle, survit sur disque. Le poste finirait tapissé de baux morts que plus
// personne ne sait lever, sur des panes que plus personne ne mesure, et le balayeur n'aurait
// plus rien à balayer. C'est la panne exacte que ce dépôt paie le plus cher : une garde qui,
// faute d'être relevée, emporte silencieusement ce qu'elle gardait.
//
// L'expiration est donc portée par la DONNÉE (`jusqua`), pas par une passe de nettoyage : la
// lecture écarte les expirés d'elle-même. Un nettoyage séparé serait une seconde chose qui doit
// tourner pour que la première dise vrai — et le jour où il ne tourne pas, la lecture ment.

import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ⚠️ LA RACINE EST IMPORTÉE, JAMAIS RECALCULÉE. La recomposer ici (`homedir()` + le même
// chemin) donnerait un module qui a l'air d'accord avec `registre.js` et qui cesse de l'être au
// premier essai qui déplace la racine par `LIGNE_DIRECTE_RACINE` : les baux resteraient dans le
// dossier du poste — celui qui porte les lignes vivantes du dirigeant — pendant que tout le
// reste travaille dans un bac jetable. Une seule définition, un seul point de bascule.
import { RACINE } from './registre.js';

export const CHEMIN_BAUX = join(RACINE, 'baux.json');

const VERSION = 1;

/**
 * LA DURÉE PAR DÉFAUT — trente minutes.
 *
 * C'est l'ordre de grandeur du mal qu'on soigne, pas celui d'un essai : les blocages de boîte
 * mesurés duraient ~40 minutes (voir `delivrance.js`). Un bail par défaut du même ordre couvre
 * la mesure ordinaire sans jamais dépasser de beaucoup ce qu'il coûte s'il est oublié.
 *
 * ⚠️ **[non établi]** — AUCUNE MESURE DE LA DURÉE D'UN BANC D'ESSAI n'existe à ce jour. Ce
 * chiffre est un ordre de grandeur emprunté, et il est dit ici plutôt que présenté comme un
 * résultat. Ce qui le rend tenable est que poser un bail est IDEMPOTENT : re-poser prolonge.
 * Un banc long se renouvelle ; il n'a pas besoin qu'on parie juste du premier coup.
 */
export const MINUTES_PAR_DEFAUT = 30;

/**
 * LE PLAFOND DUR — deux heures, et ce qui dépasse est ÉCRÊTÉ, jamais refusé.
 *
 * ⚠️ POURQUOI UN PLAFOND. Sans lui, `--minutes 10000` (une semaine) est une seule frappe, et le
 * pane concerné sort du champ du balayeur jusqu'à ce qu'un humain aille lire un fichier JSON
 * dont il ignore l'existence. Le plafond est ce qui garantit qu'un bail oublié se referme
 * TOUJOURS de lui-même, dans un délai qu'on peut nommer.
 *
 * ⚠️ POURQUOI ÉCRÊTER ET NON REFUSER — c'est l'arbitrage, et il se joue sur la direction de
 * l'erreur. Refuser rend le pane NON PROTÉGÉ à l'instant où quelqu'un vient de demander une
 * protection : celui qui a tapé la commande croit avoir réservé, le balayeur ne voit rien, et
 * l'accident qu'on cherche à empêcher a lieu pendant que le refus dort dans un code de retour
 * que personne n'a lu. Écrêter protège tout de suite, moins longtemps que demandé, et le dit —
 * la commande rend la durée RÉELLEMENT accordée. Le pire cas de l'écrêtage est un bail qui
 * expire plus tôt qu'espéré, sur un pane dont le mesureur est encore là pour le renouveler ;
 * le pire cas du refus est une mesure faussée en silence.
 *
 * ⚠️ **[non établi]** — deux heures ne sortent d'aucune mesure de la durée des bancs de ce
 * poste. Le chiffre est choisi pour être plus long qu'un essai ordinaire et plus court qu'une
 * absence (une nuit, un week-end) : ce qu'un plafond doit garantir, ce n'est pas de couvrir le
 * banc le plus long, c'est qu'un bail oublié ne survive pas à celui qui l'a posé.
 */
export const MINUTES_PLAFOND = 120;

/**
 * CE QU'UNE CLÉ DE BAIL DÉSIGNE — et ce qu'elle NE désigne pas.
 *
 * ⚠️ UN NUMÉRO DE PANE N'EST PAS UNIQUE SUR CE POSTE. Mesuré le 2026-08-15 et inscrit dans
 * `registre.js` (`porteursDeLigne`) : onze sessions herdr numérotent leurs panes
 * indépendamment, et deux chantiers de deux CLIENTS différents portaient le même `w5:p3`.
 *
 * Conséquence assumée ici : un bail posé sur `w5:p3` protège LES DEUX `w5:p3` du poste. C'est
 * une abstention en trop, jamais un geste en trop — et l'abstention est le sens sûr de ce
 * module. L'inverse (une clé plus fine côté poseur que côté balayeur) ferait passer le balayeur
 * à côté d'un bail réel, c'est-à-dire soumettrait dans une mesure.
 *
 * ⚠️ ET SI LA CLÉ S'ÉLARGIT UN JOUR (`socket::pane`), ELLE DOIT S'ÉLARGIR DES DEUX CÔTÉS DANS
 * LE MÊME LOT. Une clé raffinée d'un seul côté ne rend pas les baux plus précis : elle les rend
 * invisibles. C'est « une porte sur deux », appliquée à la garde elle-même.
 */
function cleDePane(pane) {
  return String(pane ?? '').trim();
}

/**
 * Les baux tels qu'ils sont sur disque — EXPIRÉS COMPRIS. Usage interne : tout ce qui sort de ce
 * module passe par `bauxEnCours`, qui les écarte.
 *
 * ⚠️ UN FICHIER ABSENT, ILLISIBLE OU CORROMPU REND « AUCUN BAIL », ET C'EST LE SENS DANGEREUX.
 * Il faut le dire tel quel : ce repli fait PERDRE les protections, pas les renforcer. Un octet
 * de travers, et le balayeur croit le poste entièrement libre alors qu'un banc est en cours.
 *
 * C'est un arbitrage, pas un oubli. L'autre branche — remonter l'exception — donne un balayeur
 * qui MEURT à chaque tour tant que le fichier est abîmé : il ne balaie plus rien du tout, et les
 * boîtes bloquées (~40 minutes mesurées, pendant lesquelles PERSONNE ne peut joindre le
 * destinataire) redeviennent la panne du jour. On perd alors la protection ET le service.
 *
 * Ce qui rend l'arbitrage tenable : le fichier n'est écrit que par un renommage atomique (voir
 * `sauverBaux`), donc il n'est jamais vu à moitié écrit ; et un bail perdu se re-pose d'une
 * commande, alors qu'un balayeur mort ne se relève que si quelqu'un s'en aperçoit.
 */
function chargerBaux(chemin = CHEMIN_BAUX) {
  if (!existsSync(chemin)) return {};
  try {
    const brut = JSON.parse(readFileSync(chemin, 'utf8'));
    const table = brut?.baux;
    if (!table || typeof table !== 'object' || Array.isArray(table)) return {};
    return table;
  } catch {
    return {};
  }
}

/**
 * Écriture ATOMIQUE — fichier temporaire puis renommage, exactement comme `sauverRegistre`.
 *
 * Un poseur tué entre l'ouverture et la fermeture du fichier laisserait sinon un JSON tronqué,
 * c'est-à-dire — par le repli ci-dessus — la disparition de TOUS les baux du poste, pas
 * seulement de celui qu'il était en train d'écrire. Le renommage est la seule opération que le
 * système de fichiers nous rend indivisible ; le reste est une promesse.
 *
 * ⚠️ CE QUE L'ATOMICITÉ NE COUVRE PAS, ET C'EST NOMMÉ PLUTÔT QUE CACHÉ : deux poseurs qui
 * lisent puis écrivent au même instant se marchent dessus, et le second efface le bail du
 * premier. **[non établi]** — ce cas n'a pas été observé (poser un bail est un geste rare, tapé
 * par un humain ou par un banc au démarrage). Un verrou le fermerait, au prix d'un verrou
 * ORPHELIN qui bloque tous les poseurs suivants — une panne plus probable et plus muette que
 * celle qu'il éviterait. On reste sur le renommage, et on l'écrit ici pour que le jour où deux
 * bancs démarrent ensemble, personne n'ait à redécouvrir pourquoi.
 */
function sauverBaux(table, chemin = CHEMIN_BAUX) {
  mkdirSync(dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.tmp`;
  writeFileSync(temporaire, `${JSON.stringify({ version: VERSION, baux: table }, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaire, chemin);
  try {
    chmodSync(chemin, 0o600);
  } catch {
    /* un bail ne porte pas de secret, mais il nomme les panes et les essais en cours */
  }
  return chemin;
}

/** Un bail est-il encore valide à cet instant ? Point de lecture unique de l'expiration. */
function encoreValide(bail, maintenant) {
  return Number.isFinite(Number(bail?.jusqua)) && Number(bail.jusqua) > maintenant;
}

/**
 * POSER UN BAIL sur un pane — idempotent : re-poser REMPLACE, donc prolonge.
 *
 * Le remplacement est voulu. Un banc qui redémarre, un essai qui reprend après une panne : il
 * doit pouvoir re-réserver sans avoir à savoir s'il avait déjà réservé. L'alternative — refuser
 * un pane déjà sous bail — ferait échouer le geste le plus utile du module au moment précis où
 * il sert (une reprise), et pousserait celui qui le tape à lever d'abord, c'est-à-dire à ouvrir
 * une fenêtre sans protection au milieu de sa propre mesure.
 *
 * `maintenant` est INJECTÉ pour que l'expiration s'éprouve sans dormir : un essai qui prouve
 * qu'un bail de 30 minutes expire ne doit pas prendre 30 minutes, sans quoi il ne sera jamais
 * écrit et l'expiration ne sera jamais prouvée.
 *
 * @returns {{ok: boolean, bail?: object, ajustement?: string, erreur?: string}}
 *   `ajustement` vaut `plafond` (durée écrêtée) ou `defaut` (durée illisible, remplacée par le
 *   défaut) — jamais rien quand la durée demandée a été accordée telle quelle.
 */
export function poserUnBail(pane, { minutes, pourquoi = null, maintenant = Date.now(), chemin = CHEMIN_BAUX } = {}) {
  const cle = cleDePane(pane);
  // UN BAIL SUR RIEN EST UN TROU, PAS UNE PROTECTION : il occupe le fichier, se lit dans la
  // liste, et ne protège aucun pane. On refuse ici — c'est le seul refus du module, et il porte
  // sur ce qui ne peut en aucun cas rendre service.
  if (!cle) return { ok: false, erreur: 'un bail se pose sur un pane — aucun pane nommé' };

  // ⚠️ UNE DURÉE ILLISIBLE OU NÉGATIVE RETOMBE SUR LE DÉFAUT, ELLE NE VAUT PAS ZÉRO.
  // `--minutes abc` ou `--minutes -5` écrirait sinon un bail DÉJÀ expiré : un fichier qui dit
  // « réservé » et une lecture qui dit « libre ». Celui qui a tapé la commande croirait être
  // protégé. L'incertitude tombe du côté qui s'abstient — ici, protéger.
  const demandees = Number(minutes);
  let accordees = demandees;
  let ajustement = null;
  if (!Number.isFinite(demandees) || demandees <= 0) {
    accordees = MINUTES_PAR_DEFAUT;
    ajustement = minutes === undefined || minutes === null ? null : 'defaut';
  } else if (demandees > MINUTES_PLAFOND) {
    accordees = MINUTES_PLAFOND;
    ajustement = 'plafond';
  }

  const table = chargerBaux(chemin);
  // ON ÉCARTE LES EXPIRÉS À L'ÉCRITURE AUSSI — pas pour que la lecture soit juste (elle l'est
  // déjà, elle les ignore), mais pour que le fichier ne grossisse pas d'une ligne par essai
  // jusqu'à la fin des temps. C'est du rangement, jamais une garde : rien ne dépend de son
  // passage.
  const gardes = {};
  for (const [k, b] of Object.entries(table)) if (encoreValide(b, maintenant)) gardes[k] = b;

  const bail = {
    pane: cle,
    // LA VÉRITÉ EST `jusqua`, EN MILLISECONDES, ET ELLE EST SEULE. Ajouter une date lisible à
    // côté donnerait deux champs qui disent la même chose et qui divergeront le jour où l'un
    // sera recalculé sans l'autre. Ce qui doit être lu par un humain est mis en forme à
    // l'affichage, à partir de ce champ-ci.
    jusqua: maintenant + Math.round(accordees * 60_000),
    pose_le: maintenant,
    minutes: accordees,
    // POURQUOI CE PANE EST RÉSERVÉ — pour l'humain qui trouvera un bail vivant sur un pane dont
    // plus personne ne se souvient, et qui doit décider s'il le lève. Sans ce mot, la seule
    // décision possible devant un bail inconnu est de le laisser courir.
    pourquoi: pourquoi ? String(pourquoi) : null,
  };
  gardes[cle] = bail;
  sauverBaux(gardes, chemin);
  return { ok: true, bail, ajustement, minutes_demandees: Number.isFinite(demandees) ? demandees : null };
}

/**
 * LEVER UN BAIL — le geste de celui qui a fini de mesurer.
 *
 * Lever un bail qui n'existe pas n'est pas une erreur : `leve` vaut `false` et c'est tout. Celui
 * qui range après un essai ne sait pas toujours si le bail a déjà expiré de lui-même, et le
 * faire échouer pour ça ferait rougir des rangements parfaitement corrects.
 */
export function leverUnBail(pane, { maintenant = Date.now(), chemin = CHEMIN_BAUX } = {}) {
  const cle = cleDePane(pane);
  if (!cle) return { ok: false, erreur: 'lever un bail demande le pane — aucun pane nommé' };
  const table = chargerBaux(chemin);
  const gardes = {};
  let leve = false;
  for (const [k, b] of Object.entries(table)) {
    if (k === cle) {
      // Un bail expiré qu'on lève ne compte pas comme levé : il ne protégeait déjà plus rien, et
      // rendre `true` ferait croire à qui range qu'il vient d'interrompre une mesure.
      leve = encoreValide(b, maintenant);
      continue;
    }
    if (encoreValide(b, maintenant)) gardes[k] = b;
  }
  sauverBaux(gardes, chemin);
  return { ok: true, leve };
}

/**
 * LES BAUX ENCORE VALIDES — les expirés sont écartés À LA LECTURE.
 *
 * C'est la propriété qui tient tout le module : aucune passe de nettoyage n'a besoin de tourner
 * pour que cette liste dise vrai. Un balayeur qui démarre sur un poste dont le fichier n'a pas
 * été touché depuis trois jours voit exactement ce qui est vivant.
 */
export function bauxEnCours({ maintenant = Date.now(), chemin = CHEMIN_BAUX } = {}) {
  return Object.values(chargerBaux(chemin))
    .filter((b) => encoreValide(b, maintenant))
    .sort((a, b) => a.jusqua - b.jusqua);
}

/**
 * CE PANE EST-IL SOUS BAIL ? — la seule fonction que le balayeur appelle.
 *
 * Tout le reste de ce module est du service pour l'humain qui pose et qui lève. Le contrat avec
 * le balayeur tient en cette ligne, exprès : plus la surface est étroite, moins il y a de
 * manières pour lui de se tromper de question. Il n'a jamais à lire un `jusqua`, à comparer une
 * date, ni à savoir qu'un fichier existe — les trois endroits où une garde recopiée se trompe.
 */
export function sousBail(pane, { maintenant = Date.now(), chemin = CHEMIN_BAUX } = {}) {
  const cle = cleDePane(pane);
  if (!cle) return false;
  return encoreValide(chargerBaux(chemin)[cle], maintenant);
}

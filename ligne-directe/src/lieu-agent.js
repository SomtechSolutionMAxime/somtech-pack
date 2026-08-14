// lieu-agent.js — préparer le LIEU d'un agent qui dure, jamais transformer la session.
//
// Ce module est le corps éprouvé de `representant.js` (E-20260807-0002), rendu commun aux
// deux rôles qui en ont besoin (voir `roles.js` pour le POURQUOI de la mise en commun). Ce
// qui suit était vrai du représentant et le reste, mot pour mot, de l'orchestrateur.
//
// POURQUOI LA GARDE DE CE FICHIER EST STRUCTURÉE COMME ELLE L'EST
//
//   1. « une garde qui refuse doit être prouvée par ce qu'elle EMPÊCHE, jamais par ce
//      qu'elle affiche » — donc chaque test de refus vérifie l'ABSENCE du répertoire créé,
//      jamais le texte du message.
//   2. « une porte sur deux » — donc il n'existe qu'UN SEUL point d'écriture dans tout ce
//      fichier (voir plus bas), atteint par UN SEUL appelant, derrière TROIS gardes
//      empilées : l'idempotence, la source, puis la ligne. Chacune est testée séparément.
//
// Ce module ne parle jamais à Slack ni au trousseau lui-même : il reçoit la réponse à « la
// ligne peut-elle exister ? » en paramètre (`verifierLigne`), une fonction fournie par
// l'appelant. Les implémentations réelles vivent à côté — `verifierCanalJoignable` pour un
// représentant (son canal client existe déjà), `verifierLigneOuvrable` pour un orchestrateur
// (sa ligne se crée, mais seulement si le poste peut parler) — et un test peut en fournir
// une autre sans monter Slack du tout. C'est ce qui tient la cloison (RA-REL-012).

import { existsSync, mkdirSync, copyFileSync, rmSync, rmdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { role as roleDe, rolesConnus } from './roles.js';
import { nomDeLieuValide, messageNomInvalide, messageLieuAmbigu, resoudreLieu } from './lieu-nom.js';

/**
 * Les quatre fichiers qui constituent le lieu d'un agent, en CHEMINS RELATIFS à sa racine —
 * pas en simples noms. `settings.json` n'est PAS à plat : Claude Code ne lit les permissions
 * projet qu'à `.claude/settings.json`, jamais à la racine (mesuré sur ce dépôt même).
 *
 * DÉFAUT VÉCU ICI, et il n'est pas théorique : la première version posait les quatre
 * fichiers à plat. `.mcp.json` fonctionnait — Claude Code LE lit bien à la racine — et ce
 * seul succès a caché que `settings.json`, lui, était mort au même endroit : posé, présent,
 * jamais lu. RA-REL-015 (« aucune écriture, aucun envoi, aucune fusion ») aurait été fausse
 * en production, derrière des tests qui ne vérifiaient que le CONTENU du fichier, jamais où
 * Claude Code va le chercher — exactement le motif qui a coûté le plus cher au chantier
 * précédent : une fonction inerte, derrière des tests verts qui ne regardaient pas l'effet.
 */
export const GABARITS = ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json', join('.claude', 'settings.json')];

/** Fichiers dont la présence, à la racine du dépôt, atteste un accès au registre. */
export const FICHIERS_ENV_CONNUS = ['.env', '.envrc'];

/** Où le pack dépose les gabarits d'un rôle dans un dépôt qui l'a installé (module `core`). */
export function gabaritsDir(depot, role) {
  return join(depot, '.claude', 'templates', roleDe(role).gabarits);
}

/**
 * La racine du lieu d'un agent nommé, sous le dépôt.
 *
 * Ne compose PLUS le chemin elle-même (T-20260814-0101) : elle passe par `resoudreLieu`, la
 * règle unique que la mise à jour du CLI applique aussi. Deux conséquences, voulues :
 *   • un nom qui traverse un répertoire LÈVE ici, au lieu d'écrire hors du dépôt ;
 *   • un lieu déjà posé dont seule la casse diffère est RETROUVÉ — `Francois` répond à
 *     `francois`, sur macOS comme sur Linux, et non plus « seulement là où le noyau pardonne ».
 */
export function racineLieu(depot, role, nom) {
  return resoudreLieu(depot, roleDe(role).dossier, nom).racine;
}

/**
 * Ce que la SOURCE offre, avant qu'on ait écrit quoi que ce soit — fichier par fichier,
 * jamais « le répertoire existe ».
 *
 * DÉFAUT VÉCU ICI (T-20260807-0067) : rien ne vérifiait la source du tout. Sur un dépôt qui
 * n'avait pas reçu la version du pack portant les gabarits, `mkdirSync` créait le lieu, puis
 * `copyFileSync` levait un `ENOENT` brut — et le répertoire vide restait. La relance suivante
 * le lisait comme un lieu posé. Vérifier seulement la présence du RÉPERTOIRE de gabarits
 * n'aurait corrigé qu'une porte sur deux : un pack partiellement déposé serait passé, pour
 * échouer sur le fichier manquant, au même endroit.
 */
export function etatSource(depot, role) {
  const source = gabaritsDir(depot, role);
  const presents = GABARITS.filter((f) => existsSync(join(source, f)));
  const manquants = GABARITS.filter((f) => !presents.includes(f));
  return { source, complete: manquants.length === 0, presents, manquants };
}

function premiereLigne(chemin) {
  try {
    return readFileSync(chemin, 'utf8').split('\n', 1)[0] || '';
  } catch {
    // Illisible vaut absent : on n'établit RIEN d'un fichier qu'on n'a pas pu lire.
    return '';
  }
}

/**
 * Le rôle du lieu qu'est `repertoire`, ou `null` si ce n'en est pas un.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * C'EST LA SEULE CHOSE QUI ÉTABLISSE UN RÔLE PAR LE FAIT, et le reste du dépôt s'y fie déjà :
 * le garde d'ouverture de ligne (`naissance-representant/src/hook.js`) et le réveil horaire
 * des orchestrateurs (`rendez-vous.js`) décident tous deux là-dessus. Le canal commun par rôle
 * (T-20260814-0002) appelle la même fonction plutôt que d'en monter une troisième.
 *
 * CE QU'ON A ÉCARTÉ, ET POURQUOI :
 *   • le NOM de l'agent chez herdr — une chaîne libre, que n'importe qui écrit. C'est déjà la
 *     raison pour laquelle une ligne ne se désigne pas par son nom ;
 *   • le DOSSIER qui le porte (`.orchestrateur/…`, `.gestionnaire/…`) — une convention de
 *     nommage : un répertoire vide au bon nom passerait, et il ne porte aucun métier ;
 *   • sa LIGNE au registre — elle ne dit rien du rôle (n'importe quel agent en ouvre une), et
 *     le canal commun n'est justement PAS une ligne.
 *
 * Reste ce que la pose a réellement déposé : les QUATRE fichiers de `GABARITS`, et les EN-TÊTES
 * RÉELS du métier et du contexte. Un lieu à demi posé, un worktree ordinaire, un dossier au bon
 * nom mais vide : aucun n'établit de rôle.
 *
 * ⚠️ LE `null` EST LE CAS PAR DÉFAUT, ET C'EST VOULU. Tout ce qui se décide là-dessus doit se
 * TAIRE sur un `null`, jamais se rabattre sur un rôle supposé — un chef d'équipe qui exécute une
 * consigne d'orchestrateur est le mode de panne mesuré dans `D-20260813-0001` §1.
 */
export function roleDuLieu(repertoire) {
  if (!repertoire) return null;
  if (!GABARITS.every((f) => existsSync(join(repertoire, f)))) return null;
  for (const nom of rolesConnus()) {
    const attendus = roleDe(nom).entetes;
    const concorde = Object.entries(attendus).every(([fichier, entete]) =>
      entete.test(premiereLigne(join(repertoire, fichier)))
    );
    if (concorde) return nom;
  }
  return null;
}

/** Le dépôt porte-t-il un fichier d'environnement connu, à sa racine ? */
export function aFichierEnvironnement(depot) {
  return FICHIERS_ENV_CONNUS.some((f) => existsSync(join(depot, f)));
}

/**
 * Ce que le lieu d'un agent contient déjà, sans jamais y toucher.
 *
 * Rend `existe` ET `complet`, et la distinction n'est pas cosmétique : c'est le défaut le
 * plus grave de T-20260807-0067. Un répertoire créé puis abandonné par une pose qui a échoué
 * EXISTE sans être un lieu — `presents: []` et `deja_installe: true` ne peuvent pas
 * coexister. Un agent ouvert là n'aurait ni métier, ni outils, ni permissions bornées, et
 * rien ne le signalerait. L'idempotence ne repose donc que sur `complet` ; un lieu partiel
 * est nommé comme tel et refusé — jamais complété (« elle ne recrée rien, n'écrase rien »
 * reste entier), jamais déclaré installé.
 */
export function etatLieu(depot, role, nom) {
  const racine = racineLieu(depot, role, nom);
  if (!existsSync(racine)) return { existe: false, complet: false, racine, presents: [], manquants: [...GABARITS] };
  const presents = GABARITS.filter((f) => existsSync(join(racine, f)));
  const manquants = GABARITS.filter((f) => !presents.includes(f));
  return { existe: true, complet: manquants.length === 0, racine, presents, manquants };
}

/**
 * Retire ce qu'une pose interrompue avait commencé — le lieu de CET agent, et rien d'autre.
 *
 * DÉFAUT RELEVÉ EN REVUE, et il n'est pas théorique : la première version de ce retrait
 * décidait de supprimer le dossier de rôle entier d'après un `existsSync` lu AVANT l'écriture
 * (« il n'existait pas quand j'ai commencé, donc c'est moi qui l'ai créé, donc je peux le
 * reprendre »). Entre cette lecture et le retrait, un autre processus a le temps de poser le
 * lieu d'un AUTRE agent : deux poses lancées ensemble sur le même dépôt lisent toutes deux
 * « il n'existait pas », et celle qui échoue emporte le lieu que l'autre venait de réussir.
 *
 * On ne présume donc plus de qui a créé quoi : on retire le lieu de l'agent, puis on tente de
 * retirer le dossier de rôle SANS `recursive` — le noyau refuse (`ENOTEMPTY`) s'il reste le
 * moindre voisin dedans, et c'est lui, pas nous, qui arbitre au moment exact du retrait.
 *
 * Ce cas est passé du théorique au quotidien avec l'orchestrateur : deux orchestrateurs
 * cohabitant dans un même dépôt sont attendus, pas exceptionnels.
 */
export function retirerCeQuiAEteCommence(depot, role, nom) {
  rmSync(racineLieu(depot, role, nom), { recursive: true, force: true });
  try {
    rmdirSync(join(depot, roleDe(role).dossier)); // sans `recursive` : échoue s'il reste un voisin
  } catch {
    // Il reste quelque chose, ou il n'y a plus rien à retirer — dans les deux cas, ce n'est
    // plus notre affaire. Le lieu de cet agent, lui, est bien parti.
  }
}

/**
 * Prépare le lieu d'un agent dans un dépôt.
 *
 * UN SEUL POINT D'ÉCRITURE dans tout ce module : le bloc marqué plus bas. Il n'est atteint
 * que si `etatLieu` dit que rien n'existe encore, que la source est complète, ET que
 * `verifierLigne` dit que la ligne peut exister — dans cet ordre, pour que relancer un agent
 * déjà installé ne fasse JAMAIS un appel réseau (voir le test qui le prouve en faisant
 * échouer la vérification si elle est invoquée sur un lieu déjà posé).
 *
 * @param {object} p
 * @param {string} p.depot   racine du dépôt qui reçoit le lieu
 * @param {string} p.role    'representant' | 'orchestrateur'
 * @param {string} p.nom     nom de l'agent — dossier sous le dossier du rôle
 * @param {() => Promise<{joignable: boolean, motif?: string, message?: string}>} p.verifierLigne
 */
export async function preparerLieu({ depot, role, nom, verifierLigne }) {
  const r = roleDe(role); // un rôle inconnu échoue AVANT toute lecture de disque

  // ─── Garde 0 : LE NOM. Elle n'existait pas — `join(depot, dossier, '../../evil')` écrivait
  // hors du dépôt, et rien ne le disait (T-20260814-0101). Elle passe avant tout accès disque,
  // et avant le rôle lui-même côté message : un nom qui traverse un répertoire ne doit jamais
  // atteindre un `readdirSync`, encore moins un `mkdirSync`.
  if (!nomDeLieuValide(nom)) {
    return {
      ok: false,
      cree: false,
      role,
      nom,
      refus: {
        motif: 'nom_invalide',
        message: messageNomInvalide(nom, `nom du ${r.libelle}`),
      },
    };
  }

  // ─── Garde 0 bis : DEUX LIEUX QUI NE DIFFÈRENT QUE PAR LA CASSE. Impossible sur macOS, banal
  // sur un volume sensible à la casse dès qu'un doublon a été produit. On ne devine pas lequel
  // est le vrai : on refuse, et on ne crée surtout pas un TROISIÈME lieu à côté des deux.
  const resolution = resoudreLieu(depot, r.dossier, nom);
  if (resolution.ambigu) {
    return {
      ok: false,
      cree: false,
      role,
      nom,
      refus: {
        motif: 'lieu_ambigu',
        racine: resolution.parent,
        homonymes: resolution.homonymes,
        message: messageLieuAmbigu(nom, resolution.parent, resolution.homonymes),
      },
    };
  }

  // ─── Garde 1 : l'idempotence, et elle ne vaut QUE pour un lieu complet.
  const etat = etatLieu(depot, role, nom);
  if (etat.complet) {
    return { ok: true, cree: false, deja_installe: true, role, nom, ...etat };
  }
  if (etat.existe) {
    return {
      ok: false,
      cree: false,
      deja_installe: false,
      role,
      nom,
      ...etat,
      refus: {
        motif: 'lieu_partiel',
        racine: etat.racine,
        presents: etat.presents,
        manquants: etat.manquants,
        message:
          `« ${etat.racine} » existe mais n'est pas un lieu : il manque ${etat.manquants.join(', ')}. ` +
          `Un ${r.libelle} ouvert là n'aurait ni métier, ni moyens, ni permissions bornées. ` +
          `Écarte ce reste (« mv ${etat.racine} ${etat.racine}.ecarte »), puis relance — cette commande ` +
          `ne complète jamais un lieu à demi posé, elle ne saurait pas ce qu'un humain y a déjà changé. ` +
          `On l'écarte plutôt qu'on ne le supprime, pour cette raison exacte : ce message ne sait pas non plus.`,
      },
    };
  }

  // ─── Garde 2 : la SOURCE, vérifiée au même titre que la ligne, et AVANT elle — un refus
  // qui ne dépend que du disque local ne doit coûter aucun aller-retour réseau.
  const source = etatSource(depot, role);
  if (!source.complete) {
    return {
      ok: false,
      cree: false,
      role,
      nom,
      refus: {
        motif: 'gabarits_absents',
        source: source.source,
        manquants: source.manquants,
        message:
          `ce dépôt n'a pas reçu la version du pack qui porte les gabarits du ${r.libelle} : ` +
          `${source.manquants.join(', ')} ${source.manquants.length > 1 ? 'sont introuvables' : 'est introuvable'} ` +
          `sous « ${source.source} ». Mets le pack à jour dans ce dépôt ` +
          `(« npx @somtech-solutions/pack update »), puis relance.`,
      },
    };
  }

  // ─── Garde 3 : la LIGNE. Elle est obligatoire pour les deux rôles, et pour le même motif —
  // un agent né sans ligne est muet et croit parler. Ce que « la ligne peut exister » veut
  // dire diffère (un canal client déjà joignable ; un poste capable d'en ouvrir un), mais le
  // refus, lui, est le même geste : on ne crée rien.
  // ⚠️ LE FILET, ET IL EST STRUCTUREL — RELEVÉ EN REVUE (passe 2).
  //
  // Chaque vérificateur entoure ses propres appels, et chacun l'a appris à ses dépens : le
  // trousseau du côté de l'orchestrateur, puis Slack du côté du représentant, deux fois le même
  // défaut. Compter sur la discipline de CHAQUE vérificateur, présent et à venir, c'est
  // reconduire « une porte sur deux » — le motif que ce chantier existe pour fermer.
  //
  // On ferme donc ici, une fois : quoi qu'il arrive dans un vérificateur, la pose rend un REFUS
  // STRUCTURÉ. Jamais une exception qui traverse et laisse l'appelant sans contrat. Et le motif
  // suit le même renversement que partout ailleurs — on ne conclut rien de ce qu'on n'a pas su
  // mesurer, et on ne propose aucun geste.
  let ligne;
  try {
    ligne = await verifierLigne();
  } catch (err) {
    return {
      ok: false,
      cree: false,
      role,
      nom,
      refus: {
        motif: 'verification_impossible',
        portee: null,
        message:
          `La vérification préalable a échoué sans rendre de verdict — on ne sait donc pas si la ` +
          `ligne de « ${nom} » pouvait être ouverte.\n` +
          `  ⚠️ N'en conclus RIEN, et ne répare rien à l'aveugle : ni le trousseau, ni le canal, ni ` +
          `les gabarits n'ont été mis en cause ici.\n` +
          `  Cause brute, telle qu'elle a été levée : ${String(err?.message ?? err).slice(0, 300)}\n` +
          `  Rien n'a été créé : le lieu n'est posé qu'après un verdict favorable.`,
      },
    };
  }
  if (!ligne.joignable) {
    return {
      ok: false,
      cree: false,
      role,
      nom,
      // `portee` DIT DE QUOI ON PARLE, et ce n'est pas une commodité (T-20260813-0054) : un
      // refus du POSTE (le trousseau ne rend pas la valeur) et un refus du CANAL (le robot n'y
      // est pas invité) se lèvent par deux gestes qui n'ont AUCUN rapport. Les confondre a
      // envoyé chercher du côté de Slack un défaut qui était sur le poste — et enverrait, à
      // l'inverse, faire inviter un robot dans un canal pendant qu'un trousseau reste verrouillé.
      refus: { motif: ligne.motif, portee: ligne.portee ?? null, message: ligne.message },
    };
  }

  // ═══ SEUL POINT D'ÉCRITURE — rien avant cette ligne n'a créé quoi que ce soit sur disque.
  //
  // Il est enveloppé, et ce n'est pas de la ceinture-bretelles : les trois gardes ci-dessus
  // rendent l'échec improbable, pas impossible (disque plein, droits retirés, gabarit remplacé
  // par un répertoire). Ce qui ne doit JAMAIS survivre à un échec, c'est le lieu à demi posé —
  // c'est lui, et lui seul, que la relance suivante lirait comme un lieu.
  const racine = racineLieu(depot, role, nom);
  try {
    mkdirSync(racine, { recursive: true });
    for (const fichier of GABARITS) {
      const cible = join(racine, fichier);
      mkdirSync(dirname(cible), { recursive: true }); // ex. .claude/ pour settings.json
      copyFileSync(join(source.source, fichier), cible);
    }
  } catch (err) {
    retirerCeQuiAEteCommence(depot, role, nom);
    return {
      ok: false,
      cree: false,
      role,
      nom,
      refus: {
        motif: 'ecriture_interrompue',
        racine,
        message:
          `la pose de « ${racine} » s'est interrompue (${err.message}) — ce qu'elle avait commencé ` +
          `a été retiré, rien ne subsiste. Corrige la cause, puis relance.`,
      },
    };
  }
  // ═══ fin du point d'écriture.

  const avertissements = [];
  if (!aFichierEnvironnement(depot)) {
    avertissements.push(
      `${depot} ne porte aucun fichier d'environnement (${FICHIERS_ENV_CONNUS.join(' ou ')}) — ` +
        `le ${r.libelle} naîtra sans accès au registre tant que le dépôt n'en aura pas un.`
    );
  }

  // `ligne` — CE QUE LA VÉRIFICATION A MESURÉ, rendu tel quel à l'appelant.
  //
  // Elle interroge déjà le monde (le canal, le trousseau, l'espace) ; ce qu'elle en rapporte
  // n'appartient pas à ce module, qui ne sait pas ce qu'est un dirigeant ni un canal client.
  // Le faire redemander à la commande aurait remis un second aller-retour réseau APRÈS la
  // pose — et un second aller-retour, c'est une seconde façon d'échouer sur un lieu déjà posé.
  //
  // Rendue seulement quand elle a eu lieu : sur un lieu déjà installé, la vérification n'est
  // JAMAIS appelée (garde 1), et rendre un `ligne` inventé ferait croire à une mesure qui n'a
  // pas été faite.
  return { ok: true, cree: true, role, nom, racine, fichiers: [...GABARITS].sort(), avertissements, ligne };
}

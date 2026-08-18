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
import { OUTILS, OutilIntrouvable, lancer } from './outils.js';
import { join, dirname } from 'node:path';

import { role as roleDe, rolesConnus } from './roles.js';
import { nomDeLieuValide, messageNomInvalide, messageLieuAmbigu, resoudreLieu } from './lieu-nom.js';
import { FICHIERS_ENV_CONNUS, variablesManquantes } from './mcp-env.js';
import { verifierFraicheur } from './fraicheur-gabarit.js';

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

/**
 * CELUI DES QUATRE QUI PORTE LES DROITS — nommé une fois, pour que la garde de versionnabilité
 * ne le redésigne pas par une position dans la liste (T-20260813-0059).
 *
 * C'est le seul dont l'absence au dépôt vaut un REFUS : les trois autres manquent du contexte,
 * celui-ci manque des permissions. Un lieu dont il n'est pas versé fait naître ailleurs un agent
 * que rien ne borne.
 */
export const GABARITS_DROITS = join('.claude', 'settings.json');

/**
 * Fichiers d'environnement connus à la racine d'un dépôt.
 *
 * ⚠️ LEUR PRÉSENCE N'ATTESTE PLUS RIEN — c'est très exactement ce que T-20260815-0023 a fermé.
 * Ce qui compte est ce qu'ils DÉCLARENT, et la lecture vit dans `mcp-env.js`. La liste y est
 * définie et seulement ré-exportée ici, pour les appelants historiques (`representant.js`) :
 * deux listes qui disent la même chose divergent au premier correctif.
 */
export { FICHIERS_ENV_CONNUS };

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

/**
 * « Le représentant », « L'orchestrateur » — en tête de phrase, avec l'élision.
 *
 * Le `le ${r.libelle}` employé ailleurs dans ce fichier produit « le orchestrateur ». C'est
 * lisible, mais ces avertissements sont destinés à être lus par un humain puis recopiés dans
 * un ticket : on ne les laisse pas partir en français approximatif. Corrigé ici seulement —
 * les autres occurrences sont hors du périmètre de ce lot.
 */
function leRole(libelle) {
  const article = /^[aeiouyàâäéèêëîïôöùûü]/i.test(libelle) ? "L'" : 'Le ';
  return `${article}${libelle}`;
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

/**
 * Le dépôt porte-t-il un fichier d'environnement connu, à sa racine ?
 *
 * ⚠️ NE DÉCIDE PLUS RIEN, ET C'EST LE CŒUR DE T-20260815-0023. Elle a été, jusqu'ici, LE
 * critère de l'avertissement « cet agent naîtra sans accès au registre » — c'est-à-dire
 * l'INDICE au lieu du FAIT : elle ne consulte pas `process.env` et ignore ce que le
 * `.mcp.json` réclame. Deux pannes symétriques en sont sorties (voir `mcp-env.js`), dont un
 * FAUX NÉGATIF : un `.env` présent mais muet sur les bonnes variables la faisait répondre
 * « oui », et l'agent naissait sourd sans un mot.
 *
 * Elle reste ici parce qu'elle est ré-exportée par `representant.js` et qu'elle répond
 * honnêtement à SA question — « y a-t-il un tel fichier ? ». C'est le décideur qui a changé :
 * `variablesManquantes` (mcp-env.js). N'en refais jamais un critère d'accès au registre.
 */
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

/**
 * CE QUE GIT REFUSERA DE PRENDRE, parmi les fichiers d'un lieu (T-20260813-0059).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * TROIS VERDICTS, ET LES CONFONDRE EST LE DÉFAUT QU'ON FERME
 *
 * `git check-ignore -v` a été MESURÉ le 2026-08-15, et il ne répond pas par oui/non :
 *
 *   • code 0   — au moins un chemin est exclu, et chaque ligne dit `<source>:<ligne>:<motif>`
 *                puis le chemin. C'est de là que vient tout ce que le refus cite ;
 *   • code 1   — aucun n'est exclu. Rien à signaler ;
 *   • code 128 — pas de dépôt git, ou chemin hors du dépôt. **Ni l'un ni l'autre.**
 *
 * Le troisième est celui qui compte. « Je n'ai pas pu poser la question » n'est pas « la
 * réponse est non » — `outils.js` l'écrit en tête, et ce chantier l'a payé deux fois en deux
 * jours. On rend donc `connue: false` avec sa raison, et l'appelant en fait un AVERTISSEMENT :
 * ni un refus (poser dans un dossier qui n'est pas un dépôt reste un usage), ni un silence.
 *
 * ⚠️ ON INTERROGE DES CHEMINS QUI N'EXISTENT PAS ENCORE, et c'est délibéré : git répond sur le
 * chemin, pas sur le fichier. La garde tombe donc AVANT toute écriture, et le refus n'a rien à
 * nettoyer derrière lui.
 */
export async function versionnabiliteDe(depot, racine, { executer } = {}) {
  // ⚠️ « PAS DE DÉPÔT DU TOUT » EST UN FAIT, PAS UNE INCERTITUDE — et les deux ne se traitent
  // pas pareil.
  //
  // Hors dépôt, il n'y a rien à verser et rien d'exclu : la question que cette garde pose ne se
  // pose pas. Le dire quand même produirait un avertissement à chaque pose faite ailleurs que
  // dans un dépôt — du bruit, et un bruit finit par ne plus être lu, ce qui est exactement ce
  // que ce lot reproche à l'ancien comportement.
  //
  // ⚠️ CE QUE CE SILENCE NE COUVRE PAS, ET QUI N'EST PAS TRANCHÉ ICI : un lieu posé hors dépôt
  // n'est versionné nulle part, donc « pas un lieu » au sens strict de la compétence. En faire
  // un refus serait un arbitrage que le ticket n'a pas rendu — il porte sur un fichier exclu
  // PARMI d'autres qui, eux, sont versés. On s'en tient au périmètre, et on le note.
  //
  // Le précédent maison est `avisDeVersionnement` (côté naissance), qui interroge lui aussi
  // `rev-parse` avant de conclure quoi que ce soit.
  try {
    await lancer(OUTILS.git, ['rev-parse', '--show-toplevel'], { cwd: depot, executer });
  } catch (err) {
    if (err instanceof OutilIntrouvable) return { connue: false, raison: err.message };
    const dit = String(err?.stderr || err?.message || '').trim();
    // ⚠️ SEUL « ce n'est pas un dépôt » EST UN FAIT. Tout le reste est une absence de réponse.
    //
    // BLOQUANT RELEVÉ EN REVUE DE FOND : la première écriture traitait TOUT échec de `rev-parse`
    // comme le fait « hors dépôt », donc en SILENCE TOTAL — pendant que le bloc juste en dessous
    // traitait « tout le reste » comme une absence de réponse. Deux blocs du même fichier se
    // contredisaient, et c'était le défaut de ce lot rejoué dans son propre correctif.
    //
    // Le cas qui mord en production est la propriété douteuse (« dubious ownership », git ≥ 2.35),
    // courante dès qu'un dépôt appartient à un autre compte que celui qui l'interroge — conteneur,
    // sudo, intégration continue. Le dépôt EXISTE, il peut parfaitement exclure les droits, et on
    // serait passé à côté sans un mot : pire que le comportement qu'on corrige, qui laissait au
    // moins un compte de fichiers à relire.
    if (/not a git repository/i.test(dit)) return { connue: true, exclus: [], horsDepot: true };
    return { connue: false, raison: dit.split('\n')[0] || `git a échoué (code ${err?.code ?? '—'})` };
  }

  const chemins = GABARITS.map((f) => join(racine, f));
  try {
    const { stdout } = await lancer(OUTILS.git, ['check-ignore', '-v', ...chemins], {
      cwd: depot,
      executer,
    });
    return { connue: true, exclus: lireExclusions(stdout, racine) };
  } catch (err) {
    if (err instanceof OutilIntrouvable) return { connue: false, raison: err.message };
    // Code 1 : git a répondu, et sa réponse est « aucun n'est exclu ». C'est un verdict.
    if (err?.code === 1) return { connue: true, exclus: [] };
    // Tout le reste — 128 en tête — est une absence de réponse, pas une réponse.
    const dit = String(err?.stderr || err?.message || '').trim().split('\n')[0];
    return { connue: false, raison: dit || `git a échoué (code ${err?.code ?? '—'})` };
  }
}

/**
 * Les lignes de `check-ignore -v` ramenées à ce qu'un refus doit pouvoir dire.
 *
 * Format mesuré : `<source>:<ligne>:<motif>\t<chemin>` — par exemple
 * `.git/info/exclude:19:.claude/\t.orchestrateur/p-1/.claude/settings.json`. Le chemin est rendu
 * tel qu'il a été demandé, donc absolu ici : on le ramène au nom du gabarit, qui est ce que
 * l'appelant manipule.
 */
function lireExclusions(stdout, racine) {
  const exclus = [];
  for (const ligne of String(stdout || '').split('\n')) {
    const [gauche, chemin] = ligne.split('\t');
    if (!chemin) continue;
    const m = gauche.match(/^(.*):(\d+):(.*)$/);
    if (!m) continue;
    const fichier = GABARITS.find((f) => chemin.trim() === join(racine, f));
    if (!fichier) continue;
    exclus.push({ fichier, source: `${m[1]}:${m[2]}`, motif: m[3] });
  }
  return exclus;
}

export async function preparerLieu({ depot, role, nom, verifierLigne, verifierVersionnable = versionnabiliteDe, foyer }) {
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
  // Ce que les gardes d'avant l'écriture ont à dire — elles ne peuvent pas le rendre elles-mêmes,
  // puisque la réponse se construit à la toute fin.
  const avertissementsAvant = [];

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

  // ─── Garde 2 ter : LE GABARIT PRÉSENT EST-IL LE BON ? (T-20260818-0111, E-20260818-0014)
  //
  // La garde 2 ci-dessus vérifie que les gabarits SONT LÀ. Elle ne dit rien de ce qu'ils
  // CONTIENNENT — et c'est le motif dominant de ce dépôt, à sa neuvième occurrence : vérifier
  // qu'une chose est en place, jamais qu'elle est la bonne.
  //
  // VÉCU, mesuré le 2026-08-18 chez un client : `gabaritsDir` sert le gabarit du DÉPÔT CIBLE.
  // Un dépôt dont le pack date de la `v1.48.0` a fait naître un orchestrateur sur le métier de
  // cette époque, pendant que le poste était en `v1.69.0` — un métier qui disait « pilote » et
  // à qui il manquait sept sections entières. La commande a rendu `ok:true`, quatre fichiers,
  // une ligne joignable. Rien ne signalait que le contenu était faux, et l'agent ne pouvait pas
  // le découvrir : un orchestrateur ne lit que son lieu.
  //
  // ⚠️ ELLE TOMBE ICI, ET PAS AILLEURS. Après la source (comparer ce qui manque n'aurait aucun
  // sens) et AVANT la ligne (un refus qui ne dépend que du disque local ne doit coûter aucun
  // aller-retour réseau — la même raison qui a placé la garde 2 avant la garde 3), donc avant
  // toute écriture : le refus ne laisse rien derrière lui, sans avoir à nettoyer.
  //
  // ⚠️ ET ELLE NE REFUSE QUE SUR UNE DIVERGENCE CONSTATÉE. « Je n'ai pas su mesurer » —
  // référence absente sur un poste neuf, référence illisible — ne refuse RIEN et se DIT dans
  // le rendu (`metier_verifie: false`). Le verdict à trois formes vit dans `fraicheur-gabarit.js`,
  // avec le pourquoi complet ; ici on n'en fait qu'une conduite.
  const fraicheur = verifierFraicheur({
    depot,
    gabaritDepot: source.source,
    gabarit: r.gabarits,
    libelle: r.libelle,
    foyer,
  });
  if (fraicheur.perime) {
    return {
      ok: false,
      cree: false,
      role,
      nom,
      refus: {
        motif: 'gabarit_perime',
        empreinte_depot: fraicheur.empreinte_depot,
        empreinte_reference: fraicheur.empreinte_reference,
        chemin_depot: fraicheur.chemin_depot,
        chemin_reference: fraicheur.chemin_reference,
        message: fraicheur.message,
      },
    };
  }

  // ─── Garde 2 quater : LES DROITS DOIVENT POUVOIR ÊTRE VERSÉS (T-20260813-0059).
  //
  // Un lieu est « un dossier VERSIONNÉ dans le dépôt » — c'est sa définition, pas un détail de
  // rangement. La pose refusait déjà un lieu partiel en se fiant au DISQUE ; ce contrôle-ci est
  // le même raisonnement, appliqué à ce que GIT voit.
  //
  // VÉCU : un motif `.claude/` — dans un `.gitignore` ou, pire, dans le `.git/info/exclude` que
  // personne ne voit en revue — s'applique à TOUTE profondeur. `settings.json` est alors écrit,
  // présent, lu sur ce poste… et il n'entre jamais dans le dépôt. Le lieu paraît complet chez
  // celui qui l'a posé ; repris ailleurs, il fait naître un agent SANS DROITS BORNÉS.
  //
  // ⚠️ POURQUOI UN REFUS SUR CELUI-LÀ, ET UN AVERTISSEMENT SUR LES AUTRES. Ce qui manque quand
  // `CONTEXTE.md` n'est pas versé est du contexte, réparable ailleurs. Ce qui manque quand
  // `settings.json` ne l'est pas, ce sont les PERMISSIONS — et un avertissement de plus n'est
  // pas lu : mesuré le 2026-08-15 sur cinq lieux clients posés, dont deux sans aucune garde et
  // un dans aucun commit, pour zéro signalement.
  //
  // ⚠️ ET LE CONTRÔLE TOMBE AVANT TOUTE ÉCRITURE — `git check-ignore` répond sur un chemin qui
  // n'existe pas encore. Le refus ne laisse donc rien derrière lui, sans avoir à nettoyer :
  // c'est ce qui évite de rejouer T-20260807-0067 (une pose interrompue laissait un lieu que la
  // relance suivante déclarait installé).
  const versionnable = await verifierVersionnable(depot, racineLieu(depot, role, nom));
  if (!versionnable.connue) {
    // ON NE CONCLUT RIEN DE CE QU'ON N'A PAS SU MESURER. Hors dépôt git, ou git absent, le
    // verdict n'est ni « versionnable » ni « exclu » : le taire reviendrait à conclure d'une
    // absence de mesure à une absence de problème. On le DIT, et on pose quand même — poser
    // dans un dossier qui n'est pas un dépôt reste un usage, il n'est simplement pas gardé.
    avertissementsAvant.push(
      `impossible de vérifier que les droits du ${r.libelle} seront versés (${versionnable.raison}) — ` +
        `« ${GABARITS_DROITS} » est peut-être exclu de ce dépôt sans que rien ne le dise.`
    );
  } else {
    const droits = versionnable.exclus.find((e) => e.fichier === GABARITS_DROITS);
    if (droits) {
      return {
        ok: false,
        cree: false,
        role,
        nom,
        refus: {
          motif: 'droits_non_versionnables',
          fichier: droits.fichier,
          motif_exclusion: droits.motif,
          source: droits.source,
          message:
            `« ${droits.fichier} » ne peut pas être versé dans ce dépôt : le motif « ${droits.motif} » ` +
            `(${droits.source}) l'exclut. Le lieu serait complet sur ce disque et amputé partout ` +
            `ailleurs — un ${r.libelle} repris depuis un autre clone naîtrait SANS PERMISSIONS ` +
            `BORNÉES, et rien ne le dirait. Rien n'a été créé. Lève l'exclusion, puis relance : ` +
            `soit en suivant le fichier une fois posé (« git add -f <le fichier> »), soit en ` +
            `ajoutant une négation au fichier d'exclusion (« !${GABARITS_DROITS} »).`,
        },
      };
    }
    for (const e of versionnable.exclus) {
      avertissementsAvant.push(
        `« ${e.fichier} » ne sera pas versé : le motif « ${e.motif} » (${e.source}) l'exclut. ` +
          `Le ${r.libelle} l'aura sur ce disque et nulle part ailleurs.`
      );
    }
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

  // ─── L'ACCÈS AU REGISTRE — sur le FAIT, plus sur l'indice (T-20260815-0023).
  //
  // CE QUI SE MESURAIT AVANT : « ce dépôt porte-t-il un `.env` ou un `.envrc` ? ». La fonction
  // ne consultait jamais `process.env` et ne savait pas quelles variables le `.mcp.json` du
  // gabarit déclare. Un dépôt sans `.env` dont le shell porte déjà les jetons (le cas normal
  // sous `claude-swt`) était averti pour rien ; un dépôt AVEC un `.env` qui ne déclare pas les
  // bonnes variables se taisait, et l'agent naissait sans registre en silence.
  //
  // CE QUI SE MESURE MAINTENANT : les variables que le `.mcp.json` DU LIEU réclame réellement —
  // jamais une liste écrite en dur, sinon un gabarit qui gagne un serveur MCP demain
  // reconduirait le même angle mort. On lit le fichier POSÉ (`racine`), celui-là même que
  // Claude Code ouvrira, plutôt que le gabarit source : c'est le lieu réel qui est en question.
  //
  // ⚠️ ET LE PIÈGE QU'ON NE PREND PAS : consulter `process.env` À CÔTÉ du test de fichier puis
  // se taire dès que l'un des deux répond. Ce serait échanger un faux positif contre un faux
  // négatif. La présence du fichier ne prouve rien ; seules les variables RÉSOLUES prouvent.
  //
  // AVERTIR, JAMAIS REFUSER — inchangé : contrairement aux droits (garde 2 bis), ce qui manque
  // ici se répare après coup sans que rien ne soit à reposer.
  const avertissements = [...avertissementsAvant];
  const manquantes = variablesManquantes(join(racine, '.mcp.json'), { depot });
  if (manquantes.length > 0) {
    const pluriel = manquantes.length > 1;
    avertissements.push(
      `${depot} : le lieu réclame ${manquantes.join(', ')} — ` +
        `${pluriel ? 'introuvables' : 'introuvable'} à la fois dans l'environnement du processus et dans ` +
        `les fichiers d'environnement du dépôt (${FICHIERS_ENV_CONNUS.join(' ou ')}). ` +
        `${leRole(r.libelle)} naîtra sans accès au registre tant ` +
        `que ${pluriel ? 'ces variables ne seront pas résolues' : 'cette variable ne sera pas résolue'}.`
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
  // `metier_verifie` — CE QUE LA GARDE DE FRAÎCHEUR A PU ÉTABLIR, et rien de plus.
  //
  // `true` : le gabarit servi est celui du pack de ce poste, comparé par empreinte.
  // `false` : on n'a PAS su comparer, et `metier_non_verifie` dit pourquoi. Ce n'est jamais un
  // « le métier est faux » — ce cas-là ne parvient pas ici, il a refusé plus haut.
  //
  // ⚠️ IL EST RENDU MÊME QUAND IL VAUT `true`, et ce n'est pas du bavardage : c'est le champ
  // qui manquait. La pose rendait déjà `ok`, `cree`, quatre fichiers et une ligne joignable —
  // tous vrais — pendant qu'elle servait un métier faux. Un appelant qui veut savoir si le
  // métier posé fait foi n'avait rien à lire ; désormais il a ceci.
  const avertissementsFinaux = [...avertissements];
  if (!fraicheur.verifie) {
    avertissementsFinaux.push(fraicheur.raison);
  }
  return {
    ok: true,
    cree: true,
    role,
    nom,
    racine,
    fichiers: [...GABARITS].sort(),
    avertissements: avertissementsFinaux,
    ligne,
    metier_verifie: fraicheur.verifie,
    ...(fraicheur.verifie ? {} : { metier_non_verifie: fraicheur.raison }),
  };
}

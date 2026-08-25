#!/usr/bin/env node
// naitre.js — la commande qui fait naître une session dans le lieu d'un agent.
//
//   gestionnaire-naitre <nom> --workspace <espace herdr> [--role representant|orchestrateur]
//                             [--depot <chemin>]
//
// Elle ne pose jamais le lieu (E-20260807-0002 pour le représentant, E-20260813-0002 pour
// l'orchestrateur) : elle le vérifie, y repose le garde d'ouverture (à chaque appel —
// idempotent), puis fait naître le pane, EXACTEMENT à cet endroit. AUCUN shell : chaque commande herdr part par `execFile`
// avec un tableau d'arguments, comme ligne-directe/src/herdr.js et pour la même raison.
//
// L'ORDRE DES GESTES, ET POURQUOI IL A CHANGÉ (T-20260809-0023)
//
// Avant : créer le pane → NOMMER l'agent → lancer la session. L'agent était nommé avant
// d'exister — une session met plusieurs secondes à être détectée, le renommage partait
// aussitôt et échouait en `agent_not_found`. Le piège est documenté depuis longtemps dans
// /orchestrer-chantier §4b, avec sa boucle d'attente ; la naissance ne l'appliquait pas.
//
// Maintenant : créer le pane DANS le lieu → lancer la session → ATTENDRE que l'agent soit
// détecté → le nommer → VÉRIFIER PAR LE FAIT (le nom qu'il porte, le répertoire où il
// tourne). On ne parie sur aucun délai : on interroge jusqu'à ce que ce soit vrai, et on
// échoue bruyamment si ça ne l'est jamais.
//
// CE QUI NE SUBSISTE PAS D'UNE NAISSANCE RATÉE
// Dès qu'un pane est créé, tout échec ultérieur le referme avant de sortir. Un pane vide
// laissé derrière est ce que le dirigeant a trouvé au premier usage réel — et c'est ce qui
// rend une commande sortie en `0` doublement trompeuse : elle dit que tout va bien ET elle
// laisse une trace qui ressemble à un succès.

import { dirname, resolve } from 'node:path';
import { realpathSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  poserGarde,
  commandesNaissance,
  avisDeCasse,
  avisDeVersionnement,
  agentDetecte,
  MODELE_PAR_DEFAUT,
  MODE_PAR_DEFAUT,
  agentPorteLeNom,
  repertoireDeLaSession,
  cheminLieu,
  LieuAbsent,
} from '../src/naissance.js';
import { livrerBrief } from '../src/livraison.js';
import { approuverLieu, ConfigIllisible } from '../src/approbation.js';
import { appelHerdr, lireEcran, budgetPourUneAttente } from '../src/appel-herdr.js';
import { sessionVisee, espaceDeLaSession } from '../src/session.js';
import { verserLeLieu, exigerUnDepotGit, VersementImpossible, branchesQuiPortent } from '../src/versement.js';
import { expositionAlaNaissance, ATTENTE_NAISSANCE_MS } from '../src/naissance.js';
import { etatDeLEcran, refusDEcran, touchesPourFranchir } from '../../ligne-directe/src/ecran.js';
import { preparerLieuOrchestrateur } from '../../ligne-directe/src/orchestrateur.js';
import { nomDeLAgentQuiNait, inscrireNomDansLeLieu, FICHIER_NOM_AGENT } from '../../ligne-directe/src/nom-de-riviere.js';
import { chargerRegistre } from '../../ligne-directe/src/registre.js';
import {
  ROLE_CHEF_EQUIPE,
  estChefDEquipe,
  horodatageDEspace,
  creerEspaceDeTravail,
  exigerUnMandatDeChantier,
  exigerUnHorodatageDEspace,
  EspaceDeTravailImpossible,
  MandatSansChantier,
  HorodatageHorsForme,
  BASE_PAR_DEFAUT,
} from '../src/chef-equipe.js';
import { inscrireLaDeclaration, declarerAuServiceDesk, phraseDuMandatIncomplet } from '../src/declaration.js';
import { ouvrirUnEspaceHerdr, fermerLEspaceHerdr } from '../src/espace-herdr.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Le dépôt où le lieu a été posé.
 *
 * PAR DÉFAUT, celui qui héberge ce module — le comportement d'origine, et il reste juste
 * quand la commande est lancée depuis le dépôt du pack.
 *
 * DÉFAUT TROUVÉ PAR LA PREUVE RÉELLE, ET PAS PAR LES 826 TESTS VERTS : ce chemin est calculé
 * depuis la POSITION DU FICHIER. Or la pose, elle, accepte `--depot` depuis toujours. Poser
 * dans un dépôt et faire naître ailleurs donnait donc un refus parfaitement exact — « le lieu
 * n'existe pas » — sur un lieu qui venait d'être posé deux lignes plus haut. Le message était
 * juste, et il envoyait chercher au mauvais endroit.
 *
 * ⚠️ CE QUE CE CORRECTIF NE RÈGLE PAS, et qui est nommé plutôt qu'escamoté : installé en
 * outil de poste (`~/.somtech/naissance-representant`), le défaut vaut `~/.somtech` — donc
 * un représentant posé chez un client ne peut naître qu'en passant `--depot`. Le rendre
 * implicite (déduire le dépôt du répertoire courant) changerait le comportement d'appelants
 * déjà écrits ; ça se tranche sur un cas réel, pas ici.
 */
function depotDe(args) {
  const i = args.indexOf('--depot');
  return i === -1 ? resolve(HERE, '..', '..') : resolve(args[i + 1] ?? '.');
}

// La même patience que /orchestrer-chantier §4b : on interroge plutôt que de parier sur un
// délai. 30 × 2 s = une minute — assez pour une session qui démarre lentement, assez court
// pour qu'un échec réel se sache tout de suite. Surchargeable pour les tests seulement.
const ESSAIS = Number(process.env.NAISSANCE_ESSAIS || 30);
const DELAI_MS = Number(process.env.NAISSANCE_DELAI_MS || 2000);

function usage(code) {
  process.stderr.write(
    'gestionnaire-naitre <nom> --workspace <espace herdr> [--session <session herdr>]\n' +
      '                         [--role representant|orchestrateur|chef-equipe] [--depot <chemin>]\n' +
      '                         [--coordonnateur <nom>] [--base <ref>] [--horodatage <AAAAMMJJ-HHMMSS>]\n' +
      '                         [--amorce <fichier> | --amorce-texte "…"]\n' +
      '                         [--modele <alias>] [--mode <mode de permission>] [--sans-poser]\n' +
      '                         [--nom-agent <nom>]\n'
  );
  process.exit(code);
}

function option(args, nom) {
  const i = args.indexOf(nom);
  return i === -1 ? null : args[i + 1] ?? null;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * CE QU'ON DÉFAIT EN SORTANT — l'espace herdr que CETTE commande a ouvert (D-20260825-0002).
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 LE DÉFAUT QUE CECI FERME, POUR LA MOITIÉ QUE L'ORDRE NE FERME PAS. L'espace naît désormais
 * APRÈS tous les refus (voir plus bas) : aucun refus ne le laisse derrière lui. Mais des échecs
 * subsistent APRÈS sa création — l'onglet que herdr refuse, l'agent qui ne se laisse pas nommer,
 * l'écran qui ne cède jamais. Le fichier referme déjà le pane dans ces cas ; sans ceci, l'espace
 * qui le contenait resterait, vide.
 *
 * ⚠️ POURQUOI UN GESTIONNAIRE DE SORTIE ET PAS N APPELS. Une liste de sorties à corriger est une
 * liste qu'on complète — et celle qu'on ajoutera dans six mois n'y sera pas. Ici, TOUTE sortie
 * non nulle défait, y compris celle d'une exception non rattrapée. Ce qui reste à décider est
 * l'inverse : les rares cas où quelque chose de VIVANT doit survivre, et ils sont NOMMÉS par
 * `laisserVivre`.
 *
 * ⚠️ ET ON NE FERME QUE CE QU'ON A OUVERT. Un espace donné par `--workspace` appartient à celui
 * qui l'a nommé : le refermer sur un échec détruirait le travail d'un tiers pour une naissance
 * ratée. `armerLeDefaire` n'est appelé que sur le chemin de la création.
 */
let espaceAdefaire = null;
let socketDeLEspace = null;

function armerLeDefaire(id, socket) {
  espaceAdefaire = id;
  socketDeLEspace = socket;
}

/** Ce qui vit dans l'espace doit lui survivre — et la raison est dite, jamais implicite. */
function laisserVivre() {
  espaceAdefaire = null;
}

process.on('exit', (code) => {
  if (code === 0 || !espaceAdefaire) return;
  const fermeture = fermerLEspaceHerdr(espaceAdefaire, { socket: socketDeLEspace });
  if (!fermeture.ok) {
    process.stderr.write(
      `⚠️  l’espace herdr « ${espaceAdefaire} », ouvert par ce geste, n’a PAS pu être refermé ` +
        `(${fermeture.message}) — retire-le à la main : \`herdr workspace close ${espaceAdefaire}\`\n`
    );
  }
});

/** Deux chemins désignent-ils le même répertoire ? (`/tmp` → `/private/tmp` sur macOS). */
function memeRepertoire(a, b) {
  if (!a || !b) return false;
  const reel = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return p;
    }
  };
  return reel(a) === reel(b);
}

async function main() {
  const args = process.argv.slice(2);
  const nom = args[0];
  const workspace = option(args, '--workspace');
  // Le défaut reste `representant` : la commande existait pour lui, et un appelant déjà écrit
  // ne doit pas changer de comportement du seul fait qu'un second rôle existe.
  const role = option(args, '--role') || 'representant';
  const amorceFichier = option(args, '--amorce');
  const amorceTexte = option(args, '--amorce-texte');
  const sessionVoulue = option(args, '--session');
  // Le modèle et le mode sont DITS, jamais subis. Les défauts vivent dans `naissance.js`, à
  // côté de la commande qui les emploie — deux endroits qui portent la même valeur divergent
  // au premier changement de l'un.
  const modele = option(args, '--modele') || MODELE_PAR_DEFAUT;
  const mode = option(args, '--mode') || MODE_PAR_DEFAUT;
  const REPO_ROOT = depotDe(args);

  // ═══ LE RÔLE QUI N'A PAS DE LIEU — tranché ICI, avant la validation de rôle (D-20260825-0002).
  //
  // ⚠️ `chef-equipe` N'EST PAS DANS LA TABLE `ROLES`, ET C'EST MESURÉ, PAS UNE COMMODITÉ. Une
  // entrée sans le champ `entetes` fait tomber `roleDuLieuOuRefus` sur `Object.entries(undefined)`
  // (`lieu-agent.js:279`), dont le contrat est gelé et dont dépend le garde de naissance de TOUS
  // les autres rôles. `ROLES` est la table des rôles QUI ONT UN LIEU ; le rôle d'un chef d'équipe
  // vit dans sa DÉCLARATION. La branche doit donc tomber avant `roleDe(role)`, qui jetterait
  // `RoleInconnu` — et elle ne déborde sur rien : un rôle qui n'est ni celui-ci ni un rôle connu
  // continue d'être refusé par la même porte qu'avant.
  const chefEquipe = estChefDEquipe(role);
  // Qui l'a ouvert. Le champ existe pour l'attache que RIEN d'autre ne porte : la structure du
  // chantier est au ServiceDesk, l'ID de traçabilité est dans le nom des branches, mais le lien
  // « cet agent, ce coordonnateur » ne vit nulle part une fois le pane fermé.
  const coordonnateur = option(args, '--coordonnateur');
  const base = option(args, '--base') || BASE_PAR_DEFAUT;
  // ⚠️ L'HORODATAGE EST DICTABLE, ET CE N'EST PAS UNE PORTE D'ESSAIS. Il nomme l'espace ET sa
  // branche-socle : pouvoir le dire, c'est pouvoir rejouer un refus à l'identique et reprendre
  // une session par son nom (`claude-swt <horodatage>`). Par défaut, l'instant de la naissance.
  //
  // 🔴 ET IL EST VALIDÉ, DEPUIS D-20260825-0002. Il était pris tel quel : une frappe non
  // canonique (`2026-08-25`, `mon-essai`) nommait l'espace, donc le dernier segment du chemin de
  // travail — c'est-à-dire très exactement ce que la GARDE DES NAISSANCES lit pour borner sa
  // population. Mesuré : `horodatageDuChemin('…/worktrees/d/mon-essai')` rend `null`, et le même
  // agent SANS AUCUNE DÉCLARATION rend « rien à signaler », `prises: 0`, `horsPortee: 1`. Le
  // dispositif faisait donc naître, par son propre geste, un agent qu'il ne jugerait jamais — et
  // il le faisait EN SILENCE. La forme n'est pas réécrite ici : elle vient de la garde.
  let horodatage;
  try {
    horodatage = exigerUnHorodatageDEspace(option(args, '--horodatage') || horodatageDEspace());
  } catch (err) {
    if (err instanceof HorodatageHorsForme) {
      process.stderr.write(`${err.message}\n  Rien n\u2019a \u00e9t\u00e9 cr\u00e9\u00e9 : ni espace de travail, ni onglet, ni agent.\n`);
      process.exit(1);
    }
    throw err;
  }
  // ⚠️ `--workspace` N'EST PLUS EXIGÉ ICI, ET C'EST LE CŒUR DU CORRECTIF ① (D-20260825-0002).
  // Quand personne n'en donne, la commande en OUVRE UN — mais tout en bas, après tous ses
  // refus. C'est la porte d'entrée (`pack agent naitre`) qui le faisait, AVANT le lancement :
  // chacun de ses refus laissait alors un espace orphelin pendant qu'il écrivait « rien n'a
  // été créé ». L'exigence, elle, n'a pas disparu : `commandes.tabCreate` refuse toujours de
  // composer un onglet sans espace, et toujours avant qu'un pane existe.
  if (!nom || nom.startsWith('--')) usage(1);

  // L'amorce est lue AVANT qu'un pane existe : un fichier illisible doit arrêter la commande
  // ici, pas après avoir fait naître une session qu'on n'aura rien à dire.
  let amorce = null;
  if (amorceFichier || amorceTexte) {
    try {
      amorce = String(amorceFichier ? readFileSync(amorceFichier, 'utf8') : amorceTexte).trim();
    } catch (err) {
      process.stderr.write(`amorce illisible (${amorceFichier}) : ${err.message}\n`);
      process.exit(1);
    }
    if (!amorce) {
      process.stderr.write('une amorce vide n\u2019est pas une amorce\n');
      process.exit(1);
    }
  }

  // REFUSER UN LIEU QUE GIT NE PORTE PAS — MESURÉ AVANT LA MOINDRE ÉCRITURE (T-20260814-0139).
  //
  // POURQUOI UN REFUS. Arbitrage du dirigeant : la compétence prescrit **déjà** de verser le
  // lieu en branche après la pose. Le refus ne crée donc aucune friction nouvelle — il fait
  // mordre une instruction qui existe et que personne ne suit. Le chiffre qui l'a emporté :
  // sur cinq lieux clients posés, **trois portaient une garde qu'aucun commit ne contenait**.
  //
  // ⚠️ POURQUOI ICI, ET PAS APRÈS `poserGarde` — LE VERROU QU'ON A ÉVITÉ DE JUSTESSE.
  // Une première version mesurait après avoir posé la garde. Or c'est la naissance qui POSE
  // la garde : à la toute première, elle ne peut pas déjà être versée, et la refuser rendait
  // cette première naissance **impossible** — on ne peut pas committer un fichier que la
  // commande refuse d'écrire. Un verrou parfait, et invisible tant qu'on ne fait pas naître
  // un agent neuf. On mesure donc l'état PRÉEXISTANT :
  //
  //   • le lieu n'est dans aucun commit, ou versé à moitié → REFUS, et rien n'a été touché ;
  //   • une garde déjà posée par une naissance ANTÉRIEURE et jamais versée → REFUS aussi,
  //     c'est exactement l'état des trois lieux clients mesurés ;
  //   • la garde que CETTE naissance s'apprête à poser → simple avertissement plus bas :
  //     personne ne pouvait la verser avant qu'elle existe.
  //
  // Et le refus ne laisse rien derrière lui **par construction** : il tombe avant `poserGarde`.
  // Construire les commandes AVANT de créer quoi que ce soit : un nom que herdr refuserait
  // (`invalid_agent_name`), un rôle inconnu ou un espace manquant doivent arrêter la commande
  // ici, avant qu'un fichier soit écrit ou qu'un onglet soit ouvert.
  // LA PRÉCONDITION LOCALE D'ABORD — un dépôt qui n'en est pas un ne pourra jamais porter le
  // commit que la naissance exige, et poser d'abord pour l'apprendre ensuite laisserait un lieu
  // à moitié posé : le demi-succès qu'on promet de ne jamais rendre.
  //
  // ⚠️ ELLE EST REMONTÉE ICI, AU-DESSUS DU BAPTÊME (E-20260818-0017), ET C'EST UN ESSAI QUI L'A
  // EXIGÉ. Le baptême INTERROGE herdr pour relever le parc des noms ; le laisser au-dessus
  // faisait partir un appel herdr sur un chemin qui n'aboutira jamais — « hors dépôt git, un
  // ORCHESTRATEUR n'est pas posé à moitié » exige zéro appel, et il avait raison : on ne parle
  // pas au poste pour préparer un refus qu'on connaît déjà.
  try {
    exigerUnDepotGit(REPO_ROOT);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }

  // ═══ UN CHEF D'ÉQUIPE PORTE LE CODE DE SON MANDAT — exigé ICI, avant le moindre appel herdr.
  //
  // ⚠️ POURQUOI UN REFUS ET PAS UN AVERTISSEMENT. Son nom EST son mandat : c'est par là qu'on le
  // rattache à ce qu'il livre, et sa déclaration inscrit ce mandat comme un FAIT. Un nom inventé
  // (« revue-pr180 ») ferait naître un agent que rien ne raccorde à un chantier, et inscrirait
  // un mandat qui ne désigne rien — le métier de l'orchestrateur le nomme déjà comme une faute.
  let mandat = null;
  if (chefEquipe) {
    try {
      mandat = exigerUnMandatDeChantier(nom);
    } catch (err) {
      if (err instanceof MandatSansChantier) {
        process.stderr.write(`${err.message}\n  Rien n\u2019a \u00e9t\u00e9 cr\u00e9\u00e9 : ni espace de travail, ni onglet, ni agent.\n`);
        process.exit(1);
      }
      throw err;
    }
  }

  // ═══ QUEL NOM PORTERA-T-IL ? — tranché ICI, avant que quoi que ce soit existe.
  //
  // ⚠️ C'EST LE CŒUR DU LOT B (E-20260818-0017). Jusqu'ici le nom d'un agent était SIMPLEMENT
  // l'argument transmis : les quatre rivières du poste avaient toutes été données à la main ou
  // par une amorce, et le jour où personne n'y pensait, l'agent naissait sans rivière sans que
  // rien ne le signale. Deux agents sur 42 le prouvaient (`orchestrateur`, `rev-pr31`).
  //
  // ⚠️ ET LE LIEU NE BOUGE PAS. `nom` reste le code du mandat — il nomme le dossier, il est
  // versé dans le dépôt du chantier, son `CONTEXTE.md` décrit CE chantier. Seul le nom d'agent
  // change (décision « lieu ≠ nom », T-20260818-0124). `avisDeCasse` dit l'écart quelques
  // lignes plus bas : il était PRÉVU depuis T-20260814-0143, jamais interdit.
  //
  // Le parc herdr est interrogé SANS socket désigné — la session n'est résolue que plus bas, et
  // la décision doit tomber avant. La mesure est donc partielle sur un poste à plusieurs
  // sessions, et c'est DIT dans « nonVerifie » plutôt que conclu.
  const nomAgentPropose = option(args, '--nom-agent');
  const bapteme = nomDeLAgentQuiNait({
    role,
    // ⚠️ `null` POUR UN CHEF D'ÉQUIPE, ET LE CALCULER SERAIT UNE ERREUR : `cheminLieu` passe par
    // la table des rôles et jetterait `RoleInconnu`. `nomDeLAgentQuiNait` n'en a de toute façon
    // pas l'usage ici — sa première branche (« un rôle qui n'est pas orchestrateur ») rend le
    // code du mandat abaissé sans jamais regarder le lieu. C'est de là que vient le nom d'un chef
    // d'équipe : le code de son mandat, jamais une rivière (elle est réservée aux orchestrateurs).
    lieu: chefEquipe ? null : cheminLieu(REPO_ROOT, nom, role),
    code: nom,
    propose: nomAgentPropose,
    depot: REPO_ROOT,
    listerAgents: () => {
      const brut = execFileSync('herdr', ['agent', 'list'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const agents = JSON.parse(brut)?.result?.agents ?? [];
      return agents.map((a) => a?.name).filter(Boolean);
    },
    lireRegistre: () => chargerRegistre(),
  });
  if (!bapteme.nom) {
    // RIEN N'A ÉTÉ CRÉÉ, et le refus le dit — il tombe avant la pose, avant le versement, avant
    // le moindre appel herdr.
    process.stderr.write(`${bapteme.message}\n  Rien n’a été créé : ni lieu, ni onglet, ni agent.\n`);
    process.exit(1);
  }
  if (bapteme.avis) process.stderr.write(`${bapteme.avis}\n`);

  // ⚠️ LE FIL ENTRE LES DEUX MESSAGES — relevé en revue de fond (passe 2, E-20260818-0017).
  //
  // `nomAgentHerdr` refuse ici un nom que herdr refuserait. Quand ce nom vient du `.nom-agent`
  // du lieu — écrit à la main, puisqu'aucune naissance ne peut y mettre autre chose —, le
  // baptême venait de dire « il est repris tel quel » et l'échec tombait deux lignes plus loin
  // en parlant de « 1 à 32 caractères », SANS nommer le fichier ni le geste. L'opérateur lisait
  // deux messages qui se contredisent, dont le second ne dit pas d'où vient le nom.
  //
  // On ne redit pas la règle de herdr ici — elle reste à son seul endroit. On ATTACHE le refus
  // à sa cause, que seul cet appelant connaît.
  // ═══ L'ESPACE DE TRAVAIL D'UN CHEF D'ÉQUIPE — le geste que l'orchestrateur faisait à la main.
  //
  // ⚠️ IL NAÎT AVANT L'AGENT, et l'ordre n'est pas négociable (règle d'or n°11) : un worktree
  // créé PENDANT une session déjà démarrée fait dériver son contexte. Ici, l'espace existe avant
  // que le moindre onglet soit ouvert — la règle est respectée par construction.
  //
  // ⚠️ ET IL TOMBE AVANT TOUT APPEL HERDR. Un refus — pas de base, espace déjà occupé, git qui
  // dit non — ne doit laisser derrière lui ni onglet, ni agent, ni déclaration. C'est la même
  // promesse que le refus de versement tient un cran plus haut : rien à moitié.
  let espaceDuChef = null;
  if (chefEquipe) {
    try {
      espaceDuChef = creerEspaceDeTravail({ depot: REPO_ROOT, horodatage, base });
    } catch (err) {
      if (err instanceof EspaceDeTravailImpossible) {
        process.stderr.write(`${err.message}\n  Rien n\u2019a \u00e9t\u00e9 cr\u00e9\u00e9 : ni onglet, ni agent, ni d\u00e9claration.\n`);
        process.exit(1);
      }
      throw err;
    }
  }

  let commandes;
  try {
    commandes = commandesNaissance(REPO_ROOT, nom, {
      workspace,
      role,
      modele,
      mode,
      nomAgent: bapteme.nom,
      // Le seul rôle qui apporte son propre répertoire — voir `commandesNaissance`.
      lieu: espaceDuChef?.espace ?? null,
    });
  } catch (err) {
    if (bapteme.source === 'inscrit_dans_le_lieu') {
      process.stderr.write(
        `${err.message}\n` +
          `  Ce nom vient du fichier « ${FICHIER_NOM_AGENT} » du lieu, où il a été écrit à la main — ` +
          `aucune naissance n’aurait pu y inscrire un nom que herdr refuse.\n` +
          `  Le geste qui lève le blocage : corrige « ${FICHIER_NOM_AGENT} » dans le lieu, ou efface-le ` +
          `pour qu’une rivière soit attribuée de nouveau.\n` +
          `  Rien n’a été créé : ni lieu, ni onglet, ni agent.\n`
      );
      process.exit(1);
    }
    throw err;
  }

  // ═══ POSER LE LIEU S'IL MANQUE — le premier des gestes qu'un humain faisait à la main.
  //
  // ⚠️ SEULEMENT POUR UN ORCHESTRATEUR, et le refus pour l'autre rôle n'est pas de la paresse.
  // Le lieu d'un REPRÉSENTANT se branche sur un canal que le client voit : sa pose exige un
  // `--canal` et un `--dirigeant`, et le dirigeant a tranché le 2026-08-16 qu'elle garde sa
  // revue. Poser un lieu client d'autorité serait franchir la seule frontière qu'il a demandé
  // de ne pas franchir. On s'arrête donc, et on NOMME le geste — c'est l'autre moitié de la
  // promesse : ne pas intervenir ne veut pas dire deviner.
  let poseFaite = false;
  let cheminGarde = null;
  // ═══ CE QUI SUIT NE CONCERNE QUE LES RÔLES QUI ONT UN LIEU — pose, versement, garde,
  // exposition, inscription du nom. Un chef d'équipe N'EN POSE AUCUN : son espace est un arbre
  // jetable qu'on retirera à la fin de l'epic, et y verser un lieu ferait naître, dans le dépôt
  // du chantier, un dossier versionné par agent d'un jour que personne ne relirait — et le gate
  // de versement (T-20260814-0139) exigerait un commit pour chacun.
  if (!chefEquipe) {
    if (!existsSync(commandes.lieu)) {
      if (role !== 'orchestrateur') {
        process.stderr.write(
          `aucun lieu de ${role} pour « ${nom} » dans ${REPO_ROOT} — et cette commande ne pose pas ` +
            `les lieux de représentant : ils se branchent sur un canal que le client voit, et leur ` +
            `pose garde sa revue.\n` +
            `  Le geste qui lève le blocage : la compétence /gestionnaire-client, qui demande le canal ` +
            `et le dirigeant que la pose exige.\n`
        );
        process.exit(1);
      }
      let pose;
      try {
        pose = await preparerLieuOrchestrateur({ depot: REPO_ROOT, nom });
      } catch (err) {
        process.stderr.write(`la pose du lieu a échoué : ${err.message}\n`);
        process.exit(1);
      }
      if (!pose.ok) {
        // La pose refuse avec un motif nommé et, quand elle le sait, la portée du blocage. On
        // relaie SON message : le réécrire ici ferait diverger deux textes qui décrivent le même
        // refus, et c'est comme ça qu'on se retrouve avec un conseil qui ne marche plus.
        process.stderr.write(
          `le lieu de l’orchestrateur « ${nom} » n’a pas pu être posé (${pose.refus?.motif ?? 'motif inconnu'}) :\n` +
            `  ${pose.refus?.message ?? JSON.stringify(pose.refus)}\n`
        );
        process.exit(1);
      }
      poseFaite = pose.cree === true;
      for (const a of pose.avertissements || []) process.stderr.write(`${a}\n`);
      // CE QU'ON N'A PAS PU ÉTABLIR SUR LE MÉTIER SE DIT ICI (E-20260818-0014). La pose le rend
      // dans un champ à part — `avertissements` porte ce qui manquera au LIEU, jamais ce qu'on
      // n'a pas su mesurer DU GABARIT. Cette commande n'affiche que les avertissements : sans
      // cette ligne, un orchestrateur naîtrait sur un métier non vérifié en silence, et c'est
      // très exactement le succès muet que ce lot ferme.
      if (pose.metier_verifie === false && pose.metier_non_verifie) {
        process.stderr.write(`${pose.metier_non_verifie}\n`);
      }
    }

    // ═══ VERSER LE LIEU — le second des gestes qu'un humain faisait à la main.
    //
    // ⚠️ LA GARANTIE NE BOUGE PAS, SEUL L'HUMAIN PART. `avisDeVersionnement` continue de refuser
    // juste en dessous, et pour la raison mesurée qui l'a fait naître : 3 lieux clients sur 5
    // portaient une garde qu'aucun commit ne contenait (T-20260814-0139). Ce que la revue de
    // phase 1 a établi, c'est que ce gate n'a JAMAIS été une revue de code — il n'interroge que
    // `HEAD`. Un commit local le satisfait, et la commande sait le faire seule.
    // ═══ CE LIEU PEUT-IL ÊTRE RETIRÉ SOUS LUI ? — dit ICI, à la naissance (T-20260814-0014).
    //
    // ⚠️ LE PLUS TÔT POSSIBLE PLUTÔT QUE LE PLUS RÉGULIÈREMENT POSSIBLE. Une ronde passerait
    // après : l'agent serait né, aurait travaillé, aurait peut-être écrit dans un lieu qu'un
    // `git checkout` d'un tiers emporte. Ici, personne n'a encore rien perdu.
    //
    // ⚠️ ON SIGNALE, ON N'EMPÊCHE PAS DE NAÎTRE, et le geste nommé n'est JAMAIS de rétablir une
    // branche — ce réflexe écrase le travail de la session qui y a commité depuis.
    const expose = expositionAlaNaissance(REPO_ROOT, nom, role, {
      branchesQuiPortent: branchesQuiPortent(REPO_ROOT, commandes.lieu),
    });
    if (expose) {
      process.stderr.write(`⚠️  ${expose.quoi}\n    → ${expose.geste}\n`);
    }

    const verse = (quoi) => {
      try {
        return verserLeLieu(REPO_ROOT, commandes.lieu, { quoi, role, nom });
      } catch (err) {
        if (err instanceof VersementImpossible) {
          process.stderr.write(`${err.message}\n`);
          process.exit(1);
        }
        throw err;
      }
    };
    // ═══ INSCRIRE LE NOM DANS LE LIEU — AVANT de verser, pour qu'il parte dans le commit.
    //
    // ⚠️ SANS CE FICHIER, LE NOM DÉRIVE. L'attribution est déterministe, mais elle enjambe ce qui
    // est déjà pris : un orchestrateur qui redémarre après qu'une autre rivière a été prise
    // recevrait un AUTRE nom, et le dirigeant l'appellerait par un nom qu'il ne porte plus.
    //
    // ⚠️ ET SA PLACE ICI A ÉTÉ TROUVÉE PAR LA PREUVE RÉELLE, PAS PAR LA SUITE. Écrit plus bas —
    // après le versement — le fichier existait sur le disque et n'était dans AUCUN commit :
    // mesuré sur la première naissance réelle de ce lot, `git log --name-only` ne le portait pas.
    // Un clone frais, un `git checkout`, un nettoyage d'arbre, et le nom était perdu **sans un
    // mot** — le lieu restant par ailleurs parfaitement valide. C'est exactement le mode de
    // panne de T-20260814-0139, où la garde d'ouverture vivait hors de git sur trois lieux
    // clients sur cinq. Les essais ne pouvaient pas le voir : ils lisent le fichier, pas
    // l'historique.
    if (bapteme.attribue) {
      try {
        inscrireNomDansLeLieu(commandes.lieu, commandes.nom);
      } catch (err) {
        // ⚠️ ON SIGNALE, ON N'EMPÊCHE PAS DE NAÎTRE. Le nom est décidé et l'agent le portera ; ce
        // qui se perd est la FIDÉLITÉ de la prochaine renaissance, pas celle-ci. Refuser ici
        // détruirait une naissance valide pour un fichier d'une ligne.
        process.stderr.write(
          `le nom « ${commandes.nom} » n’a pas pu être inscrit dans le lieu (${err.message}) — ` +
            `il naîtra sous ce nom, mais sa prochaine renaissance pourra en recevoir un autre.\n`
        );
      }
    }

    verse('le lieu de');

    // REFUSER UN LIEU QUE GIT NE PORTE PAS — la garantie, inchangée (T-20260814-0139).
    const refusGit = avisDeVersionnement(REPO_ROOT, nom, role);
    if (refusGit) {
      process.stderr.write(`${refusGit}\n`);
      process.exit(1);
    }

    try {
      cheminGarde = poserGarde(REPO_ROOT, nom, role);
    } catch (err) {
      if (err instanceof LieuAbsent) {
        process.stderr.write(`${err.message}\n`);
        process.exit(1);
      }
      throw err;
    }

    // ═══ VERSER LA GARDE QU'ON VIENT DE POSER — le troisième geste, et celui qu'on oubliait.
    //
    // Personne ne pouvait la verser d'avance : elle n'existait pas. Elle était donc signalée par
    // un avertissement, que le prochain lancement transformait en refus. C'est exactement l'état
    // dans lequel trois lieux clients sur cinq ont été trouvés. On la verse.
    verse('la garde d’ouverture de');

    // Dire, AVANT que quoi que ce soit existe, que l'agent ne portera pas le nom du lieu
    // (T-20260814-0143). L'écart était déjà dans l'objet rendu — dans un champ que personne
    // ne relit. On le dit donc là où un humain regarde, et seulement quand il y a un écart.
    //
    // On lui DONNE `commandes.nom` — le nom que herdr recevra réellement, calculé par
    // `nomAgentHerdr` juste au-dessus. L'avis ne recalcule pas la règle de casse : deux
    // endroits qui portent la même règle divergent au premier changement de l'un (motif de
    // T-20260814-0101, refermé un cran plus haut le jour même).
    // ⚠️ CE QU'ON N'A PAS PU MESURER SE DIT — et il ne se mêle JAMAIS aux noms qu'on a relevés.
    // L'unicité d'un nom ne se mesure pas dans sa seule famille : un nom libre chez les agents
    // peut être pris par un chantier, un canal ou un BRD. On relève ce qu'on atteint, on NOMME ce
    // qu'on n'atteint pas, et on ne conclut rien du second.
    if (bapteme.attribue && bapteme.nonVerifie?.length) {
      process.stderr.write(
        `l’unicité de « ${commandes.nom} » n’a pas pu être vérifiée partout — non mesuré : ` +
          `${bapteme.nonVerifie.join(' · ')}.\n`
      );
    }

    const avis = avisDeCasse(nom, commandes.nom);
    if (avis) process.stderr.write(`${avis}\n`);

    // Après versement, plus rien ne devrait manquer. Si quelque chose manque encore, on le dit —
    // et cette fois c'est un vrai signal, pas le bruit de fond qu'il était devenu.
    const gardeAVerser = avisDeVersionnement(REPO_ROOT, nom, role);
    if (gardeAVerser) process.stderr.write(`${gardeAVerser}\n`);
  } // ═══ fin de ce qui n'appartient qu'aux rôles qui ont un lieu

  // À QUELLE SESSION HERDR ON PARLE — tranché AVANT que le moindre onglet existe
  // (T-20260814-0120).
  //
  // Onze sessions tournent sur ce poste, et la commande n'en connaissait aucune : elle
  // héritait passivement de `HERDR_SOCKET_PATH`, donc de RIEN depuis un terminal ordinaire.
  // Le dirigeant a tapé cette variable à la main quatre fois en une soirée.
  //
  // On ne devine pas : plusieurs sessions et rien pour choisir → refus qui les nomme toutes.
  const session = sessionVisee({ nomVoulu: sessionVoulue });
  if (!session.ok) {
    process.stderr.write(`${session.message}\n`);
    process.exit(1);
  }
  const socket = session.socket;

  // ═══ L'ESPACE HERDR — DONNÉ, OU OUVERT ICI ; et « ici » est le dernier endroit possible.
  //
  // 🔴 C'EST LE CORRECTIF ①. Ce geste vivait dans la porte d'entrée, AVANT le lancement de cette
  // commande. Mesuré sur la ligne que le métier prescrit — sans `--workspace` :
  //
  //     herdr workspace create --cwd <depot> --label revue-pr180 --no-focus   ← la porte
  //     « Rien n'a été créé : ni espace de travail, ni onglet, ni agent. »     ← ici, sortie 1
  //
  // L'espace restait. Et pas seulement sur ce refus : le mandat invalide, la base introuvable,
  // l'espace de travail occupé, le nom que herdr refuse, la session ambiguë — TOUS tombent
  // au-dessus de cette ligne. Les déplacer ici ne coûte rien et rend vraie une promesse que deux
  // textes opposables portaient déjà.
  //
  // ⚠️ POURQUOI PAS SIMPLEMENT « DÉFAIRE APRÈS ». Un `workspace close` après coup laisse le
  // message « rien n'a été créé » faux à l'instant où on le lit, et dépend d'un second appel qui
  // peut échouer — auquel cas l'orphelin reste ET la promesse est écrite. Créer après les refus
  // rend la promesse vraie par construction. (Le défaire existe quand même, pour la moitié que
  // l'ordre ne couvre pas : voir `armerLeDefaire` en tête de fichier.)
  let espaceHerdr = workspace;
  if (workspace) {
    // ⚠️ ET L'ESPACE DONNÉ DOIT APPARTENIR À CETTE SESSION-LÀ. C'est le contrôle qui ferme la
    // panne silencieuse : les identifiants d'espace ne sont PAS globalement uniques — `w2W` de la
    // session `somtech` a été donné pour une naissance dans `sibelanger`. Sans ce refus, la
    // naissance ne rate pas : elle RÉUSSIT, au mauvais endroit, et personne ne le voit.
    //
    // Il tombe ici, avant `tab create` : un espace refusé ne laisse aucun onglet nulle part.
    //
    // ⚠️ IL NE VAUT QUE POUR L'ESPACE DONNÉ. Celui qu'on ouvre soi-même sur `socket` appartient à
    // cette session par construction ; le vérifier serait mesurer le résultat de son propre geste.
    const espaces = await appelHerdr(['workspace', 'list'], { socket });
    const appartenance = espaceDeLaSession(espaces.reponse, { espace: workspace, session: session.nom });
    if (!appartenance.ok) {
      process.stderr.write(`${espaces.ok ? '' : `${espaces.message}\n`}${appartenance.message}\n`);
      process.exit(1);
    }
  } else {
    const ouvert = await ouvrirUnEspaceHerdr({ cwd: REPO_ROOT, label: nom, socket, appeler: appelHerdr });
    if (!ouvert.ok) {
      // L'ouverture a échoué : il n'y a rien à défaire, et le refus peut le dire sans mentir.
      process.stderr.write(`${ouvert.message}\n  Rien n\u2019a \u00e9t\u00e9 cr\u00e9\u00e9 : ni onglet, ni agent.\n`);
      process.exit(1);
    }
    espaceHerdr = ouvert.id;
    armerLeDefaire(ouvert.id, socket);
  }

  // APPROUVER LE LIEU AVANT DE LANCER LA SESSION — sans quoi elle s'arrête sur l'écran de
  // confiance de Claude Code et attend une touche que personne ne tapera. Elle serait
  // pourtant DÉTECTÉE, dans le bon répertoire, portant son nom : une naissance qui a l'air
  // réussie de tous les points de vue observables, et une session qui ne commence jamais.
  // Mesuré contre le vrai `claude` (voir src/approbation.js).
  let approbation;
  try {
    approbation = approuverLieu(commandes.lieu);
  } catch (err) {
    if (err instanceof ConfigIllisible) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const creation = await appelHerdr(commandes.tabCreate(espaceHerdr), { socket });

  if (!creation.ok) {
    process.stderr.write(`${creation.message}\n`);
    process.exit(1);
  }
  const paneId = creation.reponse?.result?.root_pane?.pane_id;
  if (!paneId) {
    process.stderr.write(
      `herdr tab create n’a rendu aucun pane_id : ${JSON.stringify(creation.reponse)}\n`
    );
    process.exit(1);
  }

  // À partir d'ici, un pane existe : tout échec le referme avant de sortir.
  const echouer = async (message) => {
    const fermeture = await appelHerdr(commandes.fermer(paneId), { socket });
    const reste = fermeture.ok ? '' : ` (⚠️ le pane ${paneId} n’a pas pu être refermé — ${fermeture.message})`;
    process.stderr.write(`${message}${reste}\n`);
    process.exit(1);
  };

  // ═══ FAIRE NAÎTRE — par la primitive de herdr, et en DÉCLARANT le modèle et le mode.
  //
  // ⚠️ CE QUE CE GESTE REMPLACE (T-20260816-0038). Avant : écrire `cd <lieu> && claude` dans un
  // shell, puis interroger trente fois pour deviner si ça avait pris, puis renommer — trois
  // gestes, une minute d'attente, et une fenêtre pendant laquelle l'agent n'était adressable
  // que par son numéro de pane, c'est-à-dire le moment exact où l'adressage cassait
  // (T-20260816-0002). `herdr agent start` fait les trois, nomme à la naissance, et transmet
  // les drapeaux à `claude` — vérifié par le fait le 2026-08-16 : il rend son `argv` exact.
  //
  // Et le lancement n'est plus nu : le modèle et le mode sont dits. Un chef d'équipe qu'on
  // croit sur un grand modèle et qui raisonne sur un petit rend un travail qu'on relira comme
  // s'il venait de l'autre.
  // ⚠️ UN PANE QUI VIENT DE NAÎTRE N'EST PAS ENCORE UN SHELL — trouvé par la preuve réelle, et
  // pas par la suite : `herdr agent start` a refusé « agent_pane_busy … is not an available
  // shell » sur un onglet créé une fraction de seconde plus tôt. Le pane existe, son shell
  // démarre encore. C'est un état TRANSITOIRE qu'on reconnaît, donc on l'attend — avec la même
  // patience bornée qu'ailleurs, jamais un délai fixe.
  //
  // On n'attend QUE celui-là : tout autre refus s'arrête tout de suite. Réessayer sur n'importe
  // quel refus transformerait une panne franche en une minute de silence, puis en un message
  // qui ne dirait plus la vraie cause.
  const PANE_PAS_PRET = /agent_pane_busy|not an available shell/i;
  let lancement = null;
  for (let i = 0; i < ESSAIS; i += 1) {
    // ⚠️ CET APPEL PORTE UNE ATTENTE DE DEUX MINUTES (`agent start … --timeout`), et le
    // plafond ordinaire par appel est d'une minute — relevé en revue de fond, comme une
    // RÉGRESSION que T-20260818-0014 introduisait : une naissance qui prend entre 60 s et
    // 120 s, dans la fenêtre que herdr s'autorise, aurait été tuée par le plafond avant
    // d'aboutir. Même geste que pour la livraison : le budget contient l'attente, par
    // construction.
    lancement = await appelHerdr(commandes.agentStart(paneId), {
      socket,
      delaiMs: budgetPourUneAttente(ATTENTE_NAISSANCE_MS),
    });
    if (lancement.ok || !PANE_PAS_PRET.test(lancement.message || '')) break;
    await dormir(DELAI_MS);
  }
  if (!lancement.ok) await echouer(lancement.message);
  if (!agentDetecte(lancement.reponse)) {
    await echouer(
      `herdr a rendu un succès sans agent pour ${paneId} : ${JSON.stringify(lancement.reponse)} — ` +
        'un code 0 sans agent n’est pas une naissance'
    );
  }

  // ═══ ET VÉRIFIER PAR L'ÉCRAN QU'IL PEUT RÉELLEMENT RECEVOIR (T-20260816-0033).
  //
  // ⚠️ LE POINT LE PLUS IMPORTANT DE CETTE COMMANDE, ET IL EST CONTRE-INTUITIF. `agent start`
  // vient de rendre `agent_status: idle` et `interactive_ready: true`. MESURÉ le 2026-08-16 :
  // il les rend AUSSI quand l'agent est parqué derrière un modal. S'arrêter là serait tenir un
  // indice pour le fait — « une porte sur deux », dans la primitive même qu'on adopte pour
  // fermer le défaut.
  //
  // On lit donc l'écran. Un écran connu est nommé avec le geste qui le lève ; un écran inconnu
  // est nommé avec ce qu'on y a vu, et RIEN d'autre — on ne conseille pas ce qu'on n'a pas
  // vérifié. Dans les deux cas la commande échoue et referme le pane : une session parquée
  // derrière un écran est immobile ET injoignable (T-20260816-0001), et la laisser derrière
  // soi en rendant un succès est précisément le mode de panne qu'on ferme.
  //
  // ⚠️ ET ON FRANCHIT LES ÉCRANS CONNUS — mais SEULEMENT eux, et jamais sans relire.
  //
  // La pré-approbation supprime l'écran de confiance (mesuré). Elle ne supprime PAS celui des
  // serveurs MCP : je l'ai cru un moment, sur un essai qui ne s'est pas reproduit, et je le dis
  // plutôt que de le laisser croire. Devant lui, la commande envoie le geste mesuré qui le
  // confirme, puis RELIT. Franchir sans relire serait un pari ; relire en fait un fait.
  //
  // Le franchissement est borné : trois fois, pas plus. Un écran qui revient trois fois n'est
  // plus l'écran qu'on croit reconnaître, et insister serait redevenir un dispositif qui tente
  // sa chance.
  const FRANCHISSEMENTS_MAX = 3;
  let franchis = 0;
  let ecran = null;
  for (let i = 0; i < ESSAIS; i += 1) {
    // ⚠️ `lireEcran` prend la COMMANDE, pas le pane — première écriture fautive, attrapée par la
    // preuve réelle : elle rendait `null` à tous les coups, donc « écran illisible », donc un
    // refus systématique. Le refus était juste dans sa forme et faux dans sa cause, ce qui est la
    // pire des deux situations : il a l'air d'un défaut du dispositif observé.
    ecran = etatDeLEcran(await lireEcran(commandes.lireEcran(paneId), { socket }));
    if (ecran.pretARecevoir) break;
    const touches = touchesPourFranchir(ecran);
    if (touches && franchis < FRANCHISSEMENTS_MAX) {
      franchis += 1;
      process.stderr.write(`écran connu franchi (${ecran.quoi}) — ${franchis}${franchis > 1 ? 'e' : 're'} fois\n`);
      await appelHerdr(['agent', 'send-keys', paneId, ...touches], { socket, resultatAttendu: false });
    }
    await dormir(DELAI_MS);
  }
  if (!ecran.pretARecevoir) {
    await echouer(
      `${refusDEcran(ecran, { cible: `la session de ${paneId}` })}\n` +
        `  Rien ne lui a été livré, et le pane est refermé : une naissance qu’on ne peut pas ` +
        `prouver joignable n’est pas une naissance.`
    );
  }

  // VÉRIFIER PAR LE FAIT, jamais par le mot : le nom qu'il porte et le répertoire où il
  // tourne, relus depuis herdr. Le renommage peut mettre un instant à se refléter, d'où la
  // relecture bornée — mais elle ne pardonne rien : ce qui n'est pas vrai à la fin échoue.
  let final = lancement.reponse;
  for (let i = 0; i < ESSAIS; i += 1) {
    const etat = await appelHerdr(commandes.interroger(paneId), { socket });
    if (etat.ok && agentPorteLeNom(etat.reponse, commandes.nom)) {
      final = etat.reponse;
      break;
    }
    if (etat.ok) final = etat.reponse;
    await dormir(DELAI_MS);
  }
  if (!agentPorteLeNom(final, commandes.nom)) {
    await echouer(
      `l’agent de ${paneId} ne porte pas le nom « ${commandes.nom} » ` +
        `(il porte « ${final?.result?.agent?.name ?? '—'} ») — il resterait inadressable`
    );
  }

  const repertoire = repertoireDeLaSession(final);
  if (!memeRepertoire(repertoire, commandes.lieu)) {
    await echouer(
      chefEquipe
        ? `la session de ${paneId} ne tourne pas dans son espace de travail : ` +
          `${repertoire ?? '—'} au lieu de ${commandes.lieu} — née ailleurs, elle commiterait ` +
          'dans l’arbre d’un autre, sur la branche d’un autre'
        // ⚠️ TEXTE INCHANGÉ POUR LES RÔLES QUI ONT UN LIEU. Le reformuler « lieu du ${role} »
        // a fait rougir trois essais d'un coup : ils cherchent « lieu du représentant », accent
        // compris, et l'interpolation rendait « representant ». Un rôle neuf n'a pas à réécrire
        // le refus des autres.
        : `la session de ${paneId} ne tourne pas dans le lieu du représentant : ` +
          `${repertoire ?? '—'} au lieu de ${commandes.lieu} — née ailleurs, ` +
          'elle n’est pas représentante, c’est une session ordinaire'
    );
  }

  // ═══ LA DÉCLARATION DE NAISSANCE — APRÈS la vérification par le fait, JAMAIS avant.
  //
  // 🔴 L'ORDRE EST LE CONTRAT. Déclarer un agent dont on n'a pas prouvé qu'il porte son nom et
  // qu'il tourne dans son espace inscrirait un FAIT FAUX — et un fait faux se croit, là où un
  // refus se voit. Les deux vérifications juste au-dessus referment le pane quand elles
  // échouent : à ce point-ci, l'agent EST là, nommé, au bon endroit.
  //
  // ⚠️ ELLE VIENT AVANT L'AMORCE, et c'est délibéré : l'amorce peut échouer en laissant le pane
  // OUVERT (voir plus bas). Un agent vivant et non déclaré est exactement l'état que ce lot
  // ferme — un agent que plus rien ne relie à son mandat ni à son coordonnateur.
  let declaration = null;
  let declarationChemin = null;
  let servicedesk = null;
  if (chefEquipe) {
    if (!coordonnateur) {
      // ⚠️ ON SIGNALE, ON N'EMPÊCHE PAS DE NAÎTRE. C'est l'attache que rien d'autre ne porte,
      // mais la refuser tuerait une naissance valide pour un champ qu'on peut encore inscrire.
      process.stderr.write(
        'aucun coordonnateur n’a été nommé (`--coordonnateur <nom>`) — la déclaration dira qui est ' +
          'né et pour quel mandat, mais pas qui l’a ouvert.\n'
      );
    }
    try {
      const inscrit = inscrireLaDeclaration({
        nom: commandes.nom,
        role: ROLE_CHEF_EQUIPE,
        mandat,
        coordonnateur,
        // ⚠️ `espace` PORTE LE WORKTREE, pas l'identifiant d'espace herdr — et le choix est
        // mesuré. L'espace herdr est déjà lisible dans le `pane` (« w9:p1 » le préfixe) ; ce qui
        // n'existe NULLE PART ailleurs une fois le pane fermé, c'est l'arbre où le travail a été
        // fait. C'est très exactement ce que /orchestrer-chantier §4b-bis dit qui se perd.
        espace: commandes.lieu,
        pane: paneId,
        session: session.nom,
      });
      declaration = inscrit.declaration;
      declarationChemin = inscrit.chemin;
    } catch (err) {
      // ⚠️ ON NE REFERME PAS LE PANE, ET C'EST UN ARBITRAGE. L'agent est né, vérifié, dans son
      // espace : le tuer pour une écriture de registre détruirait un travail prouvé bon au
      // profit d'une écriture comptable. Mais la commande ÉCHOUE — même règle que l'amorce non
      // prise : une naissance qu'on ne peut pas inscrire n'est pas une naissance réussie, et
      // rendre `ok: true` serait le succès muet que cette commande existe pour fermer.
      // ⚠️ ET L'ESPACE SURVIT AVEC LUI. Le défaire est armé pour TOUTE sortie non nulle ; ici,
      // une sortie non nulle recouvre un agent VIVANT dans son espace. Refermer l'espace le
      // tuerait — c'est-à-dire exactement ce que l'arbitrage juste au-dessus refuse de faire,
      // par la porte d'à côté.
      laisserVivre();
      process.stderr.write(
        `la session de ${paneId} est née dans son espace mais sa déclaration n’a pas pu être ` +
          `inscrite : ${err.message}\n` +
          `  Le pane est laissé ouvert — l’agent travaille. Lève la cause, puis inscris la ` +
          `naissance à la main plutôt que de le refaire naître.\n`
      );
      process.exit(1);
    }

    // ═══ ET LE NOM SUR LE TICKET DU MANDAT — dont l'échec ne défait RIEN.
    //
    // ⚠️ CE N'EST PAS UNE COURTOISIE : `assigned_agent` rempli à la naissance est une SOURCE au
    // sens de RA-VUE-005. Mais il ne vaut pas une naissance : la déclaration locale a déjà eu
    // lieu, et un agent vivant et déclaré vaut mieux qu'un agent tué pour un champ distant.
    //
    // ⚠️ ET LE CAS LE PLUS COURANT EST UN EPIC, PAS UN TICKET. Un chef d'équipe mène un epic ;
    // les tickets de son mandat sont LES STORIES de cet epic, et `declarerAuServiceDesk` les
    // remplit TOUTES. Ce commentaire disait l'inverse — « ce cas ne peut pas aboutir » — et
    // c'était vrai du code, pas du besoin : `assigned_agent` restait vide sur le chemin le plus
    // fréquenté. Le rendu porte alors le PLURIEL (`total`, `remplies`, `reprises`, `ignorees`,
    // `refusees`), et un succès partiel n'est pas un succès : `rempli` reste faux, la cause
    // nomme chaque story par son CODE.
    servicedesk = await declarerAuServiceDesk({ mandat, nom: commandes.nom });
    if (!servicedesk.rempli) {
      // ⚠️ « N'A PAS REÇU LE NOM » SERAIT FAUX SUR UNE REPRISE — et un message faux dans un
      // geste qui corrige des messages faux serait le défaut rejoué. `rempli: false` couvre
      // trois états différents : rien n'a abouti, un nom a été REMPLACÉ, une story a été
      // SAUTÉE. On dit lequel, plutôt qu'une formule qui les recouvre tous.
      process.stderr.write(`${phraseDuMandatIncomplet(mandat, servicedesk)}\n`);
    }
    // ⚠️ ET CE QU'ON N'A PAS PU MESURER NE SE MÊLE PAS AUX CAUSES. Un `rempli: true` peut cacher
    // une cécité — la charge des stories ne porte pas toujours `assigned_agent` — et la taire
    // ferait lire « rien n'a été pris à personne » à une mesure qui n'a jamais eu lieu.
    if (servicedesk.non_mesure?.length) {
      process.stderr.write(`sur le mandat ${mandat}, non mesuré : ${servicedesk.non_mesure.join(' · ')}.\n`);
    }
  }

  // ═══ L'AMORCE — le sixième des sept défauts : une session « née correctement, qui ne fait
  // rien, parce que personne ne lui dit de commencer ». Elle passe par la MÊME porte que
  // `livrer.js`, qui regarde la boîte avant d'écrire et vérifie par le fait que le brief a
  // été pris. Un `herdr agent prompt` nu rendrait « livré » sur un brief resté dans la boîte.
  //
  // Un échec d'amorce ne referme PAS le pane, et c'est délibéré : à ce stade la session est
  // née, elle est dans son lieu, elle porte son nom et son garde — la détruire coûterait plus
  // que de dire ce qui manque. Mais la commande ÉCHOUE : une naissance qui n'a pas amorcé
  // n'est pas une naissance réussie, et la déclarer telle est exactement ce que le défaut
  // faisait.
  let amorcee = false;
  if (amorce) {
    const livre = await livrerBrief({
      pane: paneId,
      texte: amorce,
      appelHerdr,
      lireEcran,
      dormir,
      essais: ESSAIS,
      delaiMs: DELAI_MS,
      // LE PANE VIENT DE NAÎTRE DANS LA SESSION VISÉE — c'est là qu'il faut lui parler.
      // Cet argument manquait, et c'était la neuvième occurrence du motif « une porte sur
      // deux » : cinq appels herdr portaient le socket, le sixième non. L'amorce serait
      // partie vers la session par défaut, c'est-à-dire vers rien depuis un terminal
      // ordinaire — exactement la panne que ce ticket ferme.
      socket,
      // La session vient de naître : on lui laisse le temps d'afficher sa boîte de saisie,
      // avec la même patience qu'on a mise à attendre qu'elle soit détectée.
      essaisDisponible: ESSAIS,
    });
    if (!livre.ok) {
      // ⚠️ MÊME ARBITRAGE QUE POUR LA DÉCLARATION : le pane reste ouvert, donc l'espace qui le
      // porte aussi. Le défaire s'applique aux naissances qui n'ont RIEN laissé de vivant.
      laisserVivre();
      process.stderr.write(
        `la session de ${paneId} est née dans son lieu mais n\u2019a pas pris son amorce : ${livre.message}\n` +
          `  Le pane est laissé ouvert — briefe-la à la main plutôt que de la refaire naître.\n`
      );
      process.exit(1);
    }
    amorcee = true;
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      role,
      nom,
      amorcee,
      client: nom, // conservé : le contrat de sortie d'origine, que des appelants lisent déjà
      depot: REPO_ROOT,
      agent: commandes.nom,
      pane: paneId,
      modele: commandes.modele,
      mode: commandes.mode,
      pose: poseFaite ? 'maintenant' : 'déjà',
      // CE QUI A ÉTÉ VÉRIFIÉ, et pas seulement ce qui a été fait — c'est la ligne que le ticket
      // réclame. « L'écran est prêt » n'est pas une formule : c'est la lecture qui a eu lieu.
      verifie: ['le lieu est versé', 'l’agent porte son nom', 'il tourne dans son lieu', 'son écran est prêt à recevoir'],
      garde: cheminGarde,
      approuve: approbation.deja ? 'déjà' : 'maintenant',
      lieu: commandes.lieu,
      repertoire,
      // ═══ CE QU'UN CHEF D'ÉQUIPE AJOUTE — et rien de ce qui précède ne bouge : des appelants
      // lisent déjà ces clés, et un contrat de sortie qui change sous eux est une panne qu'on
      // découvre chez quelqu'un d'autre.
      //
      // ⚠️ LA DÉCLARATION EST RENDUE, pas seulement écrite. L'orchestrateur qui vient d'ouvrir un
      // chef d'équipe doit pouvoir consigner la filiation sans aller relire un répertoire — et
      // c'est ce qui rend le geste utilisable dans un script, sans second appel.
      ...(chefEquipe
        ? {
            mandat,
            coordonnateur: coordonnateur ?? null,
            espace: commandes.lieu,
            branche: espaceDuChef.branche,
            base: espaceDuChef.base,
            declaration,
            declaration_chemin: declarationChemin,
            servicedesk,
          }
        : {}),
    })}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});

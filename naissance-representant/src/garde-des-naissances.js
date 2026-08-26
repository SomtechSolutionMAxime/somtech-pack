// garde-des-naissances.js — QUI TRAVAILLE ICI SANS QUE PERSONNE NE SACHE QUI IL EST.
// (T-20260825-0013, sous D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LE POINT DUR, ET IL DÉCIDE DE TOUTE LA FORME DE CE MODULE
//
// Si la SEULE trace qu'un agent est « né par le dispositif » est sa déclaration, alors retirer
// la déclaration le rend INVISIBLE à la garde — et la garde ne rougit jamais. Une garde dont on
// se débarrasse en effaçant la preuve qu'elle cherche est décorative.
//
// Il faut donc savoir qu'un agent AURAIT DÛ être déclaré, par un fait qui ne vit pas dans les
// déclarations. Ce fait est sa DATE DE NAISSANCE.
//
// **La population de la garde est donc : les agents vivants NÉS après la MISE EN SERVICE du
// dispositif.** Après cette date, naître hors dispositif EST ce qu'on veut attraper.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 ET CETTE DATE N'EST PAS CELLE QUE PORTE LE NOM DU RÉPERTOIRE DE TRAVAIL.
//
// Ce module l'a cru, et l'écrivait : « `claude-swt` inscrit l'horodatage de naissance dans le
// NOM du répertoire de travail ; il ne peut pas être oublié — l'agent travaille dedans. » C'est
// vrai à la PREMIÈRE naissance. C'est FAUX sur la REPRISE — et la reprise est le geste que le
// pack prescrit lui-même : règle d'or n°11, « réentrant via `claude-swt <timestamp>` ».
// `scripts/shell/claude-swt.sh` : `if [ -d "$wt" ]; then echo "↻ reprise de la session"`, puis
// il lance un `claude` NEUF dedans. **L'agent naît aujourd'hui dans un répertoire d'hier.**
//
// Ce que ça cassait : un agent né aujourd'hui HORS DISPOSITIF par `claude-swt 20260819-005653`
// travaille dans `~/worktrees/<dépôt>/20260819-005653`. La garde y lisait `20260819-005653`,
// le rangeait « né avant la mise en service », et il n'entrait NI dans `population`, NI dans
// `prises`, NI dans `nonMesures` ; `fauxRefus` ne pouvait pas le voir. Verdict « rien à
// signaler », sortie 0.
//
// C'est la forme que ce lot venait de fermer sur le pane — « reprendre un pane n'est pas
// naître » — laissée ouverte sur la reprise de worktree, et STRICTEMENT PIRE : le cas du pane
// laissait l'agent DANS la population, mal identifié ; celui-ci l'en SORTAIT.
//
// Mesuré sur le parc du 2026-08-25 : **59 des 124 agents vivants** étaient dans le panier « né
// avant la mise en service », et la garde ne pouvait pas dire lesquels étaient des reprises.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA NAISSANCE D'UN AGENT EST LA NAISSANCE DE SA CONVERSATION — et elle se lit
//
// Claude Code ouvre un transcript par session : `~/.claude/projects/<projet>/<session>.jsonl`.
// Sa date de création EST la naissance de cet agent-là. Mesuré : **123 des 124 agents vivants
// du poste y sont datables**, et une reprise par `claude-swt` ouvre un transcript NEUF — elle
// se date donc du jour, pas du worktree.
//
// ⚠️ ET PAS `~/.claude/sessions/<pid>.json`, qui porte pourtant `sessionId` + `startedAt` et que
// ce dépôt lit déjà par ailleurs (`activite-session.js`). Mesuré le 2026-08-25 : `startedAt` est
// le démarrage du PROCESSUS — **93 des 123 agents vivants le portent à la même seconde**
// (2026-08-22T15:05), un redémarrage en masse, pendant que leurs conversations ont des jours.
// Le prendre pour une naissance ferait entrer tout le parc dans la population au premier reboot
// postérieur à la frontière : une garde qui hurle sur le poste entier est une garde qu'on
// désarme dans la semaine.
//
// ⚠️ ET QUAND ON NE SAIT PAS DATER, ÇA SE DIT. Un agent qu'on n'a pas pu dater n'est PAS « né
// avant » : il est **NON MESURÉ**. C'est la distinction que ce module tient déjà partout
// ailleurs (`établi` / `non établi` / `refusée`), et la seule polarité qu'il accepte — un
// répertoire de transcrits fermé rend la garde plus BRUYANTE, jamais plus aveugle.
//
// ⚠️ L'HORODATAGE DU CHEMIN N'A PAS DISPARU : il ne DÉCIDE plus, il se DIT. Le rendu d'une prise
// porte toujours le worktree où l'agent travaille, parce que c'est là qu'on va le voir.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⓿ POURQUOI LE NOM N'IDENTIFIE PLUS — mesuré sur le poste le 2026-08-25, par le FAIT
//
// Le critère de ce module dit : « un agent né PAR LE DISPOSITIF dont la déclaration a été
// retirée → la garde rougit et le NOMME ». Fait pour de vrai : chef d'équipe `t-20260825-0047`,
// né par le geste, sa déclaration retirée du registre, garde relancée → **`prises : 0`**.
//
// La cause : les sources étaient TROIS, et il suffisait d'une. Retirer la déclaration en enlève
// UNE sur trois — l'agent restait identifié par son NOM. Or **le nom d'un chef d'équipe est
// TOUJOURS conforme** : c'est le code de son mandat, imposé par le geste de naissance lui-même.
// Pour la population que cette garde vise en premier, la branche « déclaration retirée » ne
// pouvait donc STRUCTURELLEMENT jamais rougir.
//
// 🔴 ET LE NOM NE POUVAIT PAS TENIR CE RÔLE. `T-20260822-0018` l'avait déjà établi : **le nom
// identifie, il ne CLASSE pas.** Il ne porte ni le rôle, ni le coordonnateur, ni l'espace — un
// orchestrateur d'avant la convention porte lui aussi un code. Une garde qui accepte le nom
// seul laisse passer exactement le défaut d'origine du chantier.
//
// LA RÈGLE, DEPUIS : après la mise en service, tout agent de la population doit avoir une
// **DÉCLARATION** — ou occuper un **LIEU DE RÔLE** sur disque, qui est l'identification propre
// d'un orchestrateur ou d'un représentant (ils ont un lieu, pas une déclaration ; les faire
// rougir serait le faux positif symétrique). Le nom, lui, ne rend plus personne régulier.
//
// ⚠️ IL GARDE DEUX EMPLOIS, ET AUCUN N'IDENTIFIE. ① Il reste la **clé de repli** qui apparie une
// déclaration à un agent dont le pane a bougé — mais SEULEMENT DANS L'ESPACE DE TRAVAIL QUE
// CETTE DÉCLARATION INSCRIT. Sans cette borne, le correctif ci-dessus n'avait fermé qu'une
// moitié : « nom conforme ⇒ identifié » tombait, « nom qui apparie une déclaration QUELCONQUE
// ⇒ identifié » restait — même population, même conséquence, et un `herdr agent rename` vers un
// nom déjà déclaré suffisait à rendre régulier n'importe quel agent né hors dispositif. Un nom
// NON MESURÉ rend donc la déclaration « refusée », jamais « absente ». ② Il se DIT sur la ligne de chaque prise qui en porte un —
// sans quoi un lecteur découvrant sept prises au nom conforme croirait la garde cassée.
//
// ⚠️ POURQUOI AUCUN BANC NE L'AVAIT VU : ils éprouvaient le retrait de déclaration sur des
// agents ANONYMES ou au nom NON conforme. Le chemin existait, il passait, il se lisait donc
// comme couvert — « une assertion trop faible sur un chemin correct ». Et la campagne de
// mutation ne pouvait pas le trouver : elle mutait le CODE, pas la POPULATION.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉNOMINATEUR EST ÉPINGLÉ — IL N'Y A AUCUNE LISTE D'EXCEPTIONS, ET C'EST DÉLIBÉRÉ
//
// Motif mesuré dans ce dépôt : **une garde qui porte sa propre liste d'exceptions est
// désarmable par ENTRETIEN.** Les autres formes de désarmement se cachent ; celle-là se
// présente comme une bonne pratique — « j'ajoute juste ce cas-là ». Le critère d'arrêt de « qui
// garde le gardien » est donc : le geste de désarmement doit devenir VISIBLE EN REVUE.
//
// Trois choses tiennent ce dénominateur, et aucune n'est une liste :
//
//   ① **UN SEUL PRÉDICAT, TOTAL.** Être dans la population ne dépend que de la DATE DE
//      NAISSANCE de l'agent. Ni le nom, ni le rôle, ni le mandat, ni le statut, **ni son
//      répertoire de travail** n'entrent dans ce jugement. Un banc le prouve par VARIATION : il
//      fait varier CHAQUE autre champ du dossier d'un agent et exige que le verdict ne bouge
//      pas — et `foreground_cwd` est désormais dans les champs qu'il fait varier, alors qu'il
//      était le champ qui décidait. C'est là que le défaut de la reprise vivait.
//
//   ② **LES COMPTES BALANCENT, ET LE MODULE LE VÉRIFIE LUI-MÊME.**
//        parc vivant = hors portée + population
//        population  = identifiés + prises + non mesurés
//      Ajouter un panier muet — « ceux-là, on les laisse passer » — casse l'égalité et LÈVE.
//      Une exception silencieuse n'a donc pas d'endroit où se mettre.
//
//   ③ **LA FRONTIÈRE EST VÉRIFIÉE CONTRE LES FAITS DU POSTE, PAS CONTRE UNE CONSTANTE D'ESSAI.**
//      Reculer `MISE_EN_SERVICE` est LE geste qui désarme sans toucher à aucune liste : tout ce
//      qui naît avant la nouvelle date cesse d'être jugé. La garde compare donc sa frontière à
//      la plus ANCIENNE déclaration réellement inscrite sur le poste : une déclaration
//      antérieure à la frontière PROUVE que le dispositif était déjà en service à cette
//      date-là, et la garde REFUSE de rendre un verdict.
//
//      ⚠️ C'est ce qui rend l'épingle NON AUTO-RÉFÉRENTIELLE. Une épingle où le banc compare le
//      code à une constante que le fichier d'essai porte lui-même ne garde RIEN : qui édite les
//      deux ensemble la désarme en silence. Ici la référence est une DONNÉE DU MONDE que la
//      garde lit de toute façon pour faire son travail. On ne peut pas la modifier en éditant
//      le module et son banc.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE MODULE NE FAIT PAS — il ne touche à RIEN
//
// Pas de disque, pas de réseau, pas d'horloge, pas de `process.env`. Tout entre par paramètre
// (patron de `recensement.js`). Ce n'est pas de l'élégance : un `process.env` dans une décision
// de garde est un INTERRUPTEUR DE DÉSARMEMENT qu'on actionne sans diff. Un banc l'interdit.

import { nomDeLieuValide } from '../../ligne-directe/src/lieu-nom.js';
// ⚠️ LA JOINTURE A UN SEUL ENDROIT OÙ VIVRE, ET C'EST LE MODULE QUI DÉFINIT LE CHAMP. Lire
// `session_herdr` avec une expression écrite ICI recréerait, à un fichier de distance, la
// divergence exacte que ce lot ferme — deux étages qui n'y mettent pas la même chose.
import { identiteDeSession } from './declaration.js';
import { lieuDeRoleDansLeChemin, nomDeLAgent } from '../../ligne-directe/src/recensement.js';

/**
 * LA MISE EN SERVICE DU DISPOSITIF DE NAISSANCE — la frontière de la population.
 *
 * 🔴 RECULER CETTE DATE DÉSARME LA GARDE pour tout ce qui naît avant la nouvelle valeur, sans
 * qu'aucune liste ne bouge. C'est le geste de désarmement le moins visible qui existe ici, et
 * c'est pourquoi il est le seul à être vérifié contre le monde : voir `verifierLaFrontiere`.
 *
 * Format : celui que `claude-swt` inscrit dans le nom du répertoire — `YYYYMMDD-HHMMSS`, en
 * HEURE LOCALE du poste.
 */
export const MISE_EN_SERVICE = '20260825-000000';

/** Les trois verdicts. Ils ne se replient jamais en deux. */
export const VERDICTS = {
  RIEN_A_SIGNALER: 'rien à signaler',
  NES_HORS_DISPOSITIF: 'des agents nés hors dispositif',
  ZONES_NON_MESUREES: 'des zones que je n’ai pas pu mesurer',
};

/**
 * La sortie de chaque verdict — une par verdict, toutes distinctes.
 *
 * ⚠️ `ZONES_NON_MESUREES` NE SORT PAS EN 0, et c'est une décision, pas un réglage. Une garde
 * qui ne peut pas mesurer et rend vert est pire que rien : elle certifie un parc qu'elle n'a
 * pas regardé. Mais elle ne sort pas non plus comme une PRISE — les deux appellent des gestes
 * opposés (aller voir l'agent / refaire la mesure), et une chaîne qui les confond enverrait
 * corriger ce qui va bien.
 */
export const SORTIES = {
  [VERDICTS.RIEN_A_SIGNALER]: 0,
  [VERDICTS.NES_HORS_DISPOSITIF]: 1,
  [VERDICTS.ZONES_NON_MESUREES]: 2,
};

/** La sortie d'un refus global — la garde n'a pas pu se prononcer du tout. */
export const SORTIE_REFUS = 3;

/**
 * LES DEUX SOURCES QUI IDENTIFIENT — le lecteur doit savoir CE QUI a identifié un agent.
 *
 * 🔴 ELLES ÉTAIENT TROIS. La troisième était le nom, et elle est tombée le 2026-08-25 : voir
 * l'en-tête, section ⓿. Ce qui reste au nom vit dans `NOM_CONFORME`, qui n'identifie personne.
 *
 * ⚠️ LES DEUX QUI RESTENT NE SONT PAS INTERCHANGEABLES AVEC ELLE. Toutes deux sont un ACTE :
 * quelqu'un a inscrit une déclaration, ou quelqu'un a posé un lieu de rôle sur le disque. Le
 * nom, lui, se porte — il ne s'obtient pas.
 */
export const SOURCES = {
  DECLARATION: 'sa déclaration de naissance',
  LIEU: 'le lieu de rôle qu’il occupe',
};

/**
 * CE QUI DATE UN AGENT — le mot du panier « non mesuré » quand c'est la NAISSANCE qui manque.
 *
 * ⚠️ CE N'EST PAS UNE SOURCE D'IDENTIFICATION, et il ne rejoint pas `SOURCES` : les deux
 * sources disent QUI est un agent, celle-ci dit S'IL EST DANS LA POPULATION. Les confondre
 * ferait apparaître la naissance dans la ventilation des identifiés, où elle n'a jamais
 * identifié personne — un compte juste dans une phrase fausse.
 */
export const DATATION = 'sa date de naissance';

/**
 * CE QUE LE NOM VAUT ENCORE — le mot que porte une PRISE qui en a un de conforme.
 *
 * ⚠️ IL SE DIT SUR LA LIGNE DE LA PRISE, PAS DANS UNE NOTE. Mesuré sur le trafic du 2026-08-25 :
 * 7 des 8 agents de la population ont un nom conforme et AUCUNE déclaration. Un lecteur qui
 * découvre sept prises toutes bien nommées, sans qu'on lui dise pourquoi le nom ne compte pas,
 * conclura que la garde est cassée — et la désarmera pour de bonnes raisons apparentes.
 */
export const NOM_CONFORME =
  'son nom est conforme à la convention — mais un nom n’est pas une naissance : il n’atteste ' +
  'ni le rôle, ni le coordonnateur, ni l’espace';

/** L'horodatage tel que `claude-swt` le pose : `YYYYMMDD-HHMMSS`, et rien d'autre. */
const HORODATAGE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/;

/**
 * LA FORME D'UN HORODATAGE DE NAISSANCE — exportée pour que le PRODUCTEUR la réutilise.
 *
 * 🔴 ELLE NE BORNE PLUS AUCUNE POPULATION, ET LE MOTIF QU'ON ÉCRIVAIT ICI EST MORT. On lisait :
 * « cette forme borne la POPULATION de la garde … ce qu'elle ne reconnaît pas devient
 * `horsPortee` — donc jamais jugé ». C'était vrai du prédicat que ce lot a ABOLI ; voir
 * `horodatageDuChemin`, soixante lignes plus bas, qui dit « IL NE DÉCIDE PLUS DE RIEN, ET C'EST
 * LE CORRECTIF ». Remesuré : un agent sans aucune déclaration né après la frontière dans
 * `…/mon-essai`, `…/2026-08-25` ou `…/20260819-005653` rend les trois fois `horsPortee: 0,
 * population: 1, prises: 1`.
 *
 * CE QU'ELLE FAIT ENCORE, ET QUI SUFFIT : ① elle dit ce qu'un rendu peut IMPRIMER comme
 * worktree d'une prise ; ② le producteur (`exigerUnHorodatageDEspace`) s'en sert pour refuser
 * un nom d'espace qui ne se reprend pas — `claude-swt <horodatage>` retrouve une session PAR ce
 * nom, et lui seul rend l'espace et sa branche-socle uniques à la seconde. Ce motif-là n'a
 * jamais eu besoin de la garde, et c'est pourquoi le refus lui survit.
 *
 * ⚠️ ET LE PRODUCTEUR NE RECOPIE PAS L'EXPRESSION. Deux copies d'une même forme divergent au
 * premier changement de l'une. Il n'y a donc qu'un `HORODATAGE` dans ce dépôt, et il est ici.
 */
export function estUnHorodatageDeNaissance(valeur) {
  return typeof valeur === 'string' && HORODATAGE.test(valeur);
}

/**
 * Levée quand la frontière de la garde est postérieure à un fait déjà inscrit.
 *
 * ⚠️ C'EST UN REFUS, PAS UN AVERTISSEMENT. Une garde dont la frontière est démentie par le
 * registre juge une population amputée : elle rendrait « rien à signaler » sur un parc qu'elle
 * a cessé de regarder. Rendre vert là-dessus serait exactement le désarmement qu'on ferme.
 */
export class FrontiereContredite extends Error {
  constructor(miseEnService, plusAncienne) {
    super(
      `garde des naissances : ma frontière est « ${miseEnService} », mais une déclaration du ` +
        `${plusAncienne.ne_le} (${plusAncienne.nom ?? 'sans nom'}) prouve que le dispositif ` +
        `était DÉJÀ en service avant elle. Tout ce qui est né entre les deux échappe à cette ` +
        `garde. Je REFUSE de rendre un verdict : reculer cette frontière est le geste qui me ` +
        `désarme, et je ne le couvre pas d’un « rien à signaler ».`
    );
    this.name = 'FrontiereContredite';
    this.miseEnService = miseEnService;
    this.plusAncienne = plusAncienne;
  }
}

/**
 * Levée quand les comptes ne se recoupent pas.
 *
 * ⚠️ ELLE N'EST PAS DÉFENSIVE, ELLE EST LA GARDE DE LA GARDE. Le seul moyen d'ajouter une
 * exception muette à ce module est de sortir un agent d'un panier sans le remettre dans un
 * autre. L'égalité l'attrape mécaniquement, quel que soit le prétexte de l'exception — y
 * compris une exception qu'on n'a pas encore imaginée. C'est ce qui remplace ici une liste de
 * cas interdits, laquelle n'aurait couvert que ceux qu'on savait nommer aujourd'hui.
 */
export class ComptesQuiNeBalancentPas extends Error {
  constructor(comptes) {
    super(
      `garde des naissances : mes comptes ne balancent pas (${JSON.stringify(comptes)}). Un ` +
        `agent est sorti d’un panier sans entrer dans un autre — c’est-à-dire qu’une exception ` +
        `muette s’est glissée dans le jugement. Je refuse de rendre un verdict bâti dessus.`
    );
    this.name = 'ComptesQuiNeBalancentPas';
    this.comptes = comptes;
  }
}

/**
 * L'HORODATAGE DE NAISSANCE QUE PORTE UN CHEMIN DE TRAVAIL — ou `null` s'il n'en porte aucun.
 *
 * ⚠️ LE PLUS PROFOND GAGNE, pour la même raison que `lieuDeRoleDansLeChemin` : un worktree peut
 * en contenir un autre, et c'est le dernier segment qui dit où l'agent travaille vraiment.
 *
 * 🔴 IL NE DÉCIDE PLUS DE RIEN, ET C'EST LE CORRECTIF. Cet horodatage a longtemps borné la
 * population ; il datait le RÉPERTOIRE, pas l'agent, et une reprise (`claude-swt <horodatage>`,
 * le geste que le pack prescrit) fait naître aujourd'hui dans un répertoire d'hier. Voir
 * l'en-tête. Ce qu'il reste : le rendu d'une prise dit le worktree où l'agent travaille, parce
 * que c'est là qu'on va le voir. Un fait qu'on IMPRIME, jamais un fait qui JUGE.
 */
export function horodatageDuChemin(chemin) {
  if (!chemin) return null;
  const morceaux = String(chemin).split('/');
  for (let i = morceaux.length - 1; i >= 0; i -= 1) {
    // ⚠️ PAR LA MÊME PORTE QUE LE PRODUCTEUR, et c'est ce qui les tient ensemble : une mutation
    // de la forme fait bouger les DEUX, donc rougir des deux côtés.
    if (estUnHorodatageDeNaissance(morceaux[i])) return morceaux[i];
  }
  return null;
}

/**
 * L'instant que désigne un horodatage — en HEURE LOCALE.
 *
 * ⚠️ LOCALE, PAS UTC, et ce n'est pas un détail de goût. `claude-swt` compose le nom du
 * répertoire avec l'heure du poste ; le lire en UTC décalerait chaque naissance de plusieurs
 * heures et ferait tomber du mauvais côté de la frontière tout ce qui naît en début de journée.
 * Les déclarations, elles, portent un ISO absolu : les deux se comparent donc en INSTANTS, pas
 * en chaînes — comparer les deux formes en texte est le motif « on mesure un objet, on conclut
 * sur un autre ».
 */
export function instantDeLHorodatage(horodatage) {
  const m = HORODATAGE.exec(String(horodatage ?? ''));
  if (!m) return null;
  const [, a, mo, j, h, mi, s] = m.map(Number);
  return new Date(a, mo - 1, j, h, mi, s);
}

/**
 * COMMENT ON DÉSIGNE UN AGENT DANS UN REFUS — son nom, sinon son adresse.
 *
 * ⚠️ « NOMMER » NE PEUT PAS VOULOIR DIRE « AVOIR UN NOM ». 77 des 112 agents vivants du poste
 * sont ANONYMES (mesuré le 2026-08-25) — et ce sont précisément ceux que le dispositif n'a pas
 * fait naître. Une garde qui ne saurait désigner qu'un agent nommé serait muette sur exactement
 * la population qu'elle existe pour attraper.
 *
 * L'adresse est donc la désignation de repli, et elle est ADRESSABLE : la session, le pane et
 * l'espace de travail suffisent à aller le voir. On ne lui INVENTE aucun nom — deux agents ont
 * déjà porté le même nom sur ce poste parce qu'une naissance en a comblé un.
 */
export function designationDe(agent) {
  if (agent?.nom?.mesure === 'lu' && agent.nom.valeur) return agent.nom.valeur;
  const ou = [
    `pane ${agent?.pane ?? '?'}`,
    agent?.session ? `session ${agent.session}` : null,
    agent?.espace ? agent.espace : null,
  ].filter(Boolean);
  return `«sans nom» ${ou.join(' · ')}`;
}

/**
 * LE PARC, NORMALISÉ — ce que herdr rend, réduit à ce que la garde juge.
 *
 * L'appariement entre un pane et son nom se fait par `«session» NUL «pane»`, jamais par le seul
 * pane : un identifiant de pane n'est unique QUE dans sa session, et ce poste en porte quinze.
 * C'est le même défaut que `panes()` et `agents()` ferment déjà chacun de leur côté.
 *
 * Le nom passe par `nomDeLAgent`, qui porte les TROIS états — « lu », « aucun », « refusée ».
 * On ne les replie pas : un pane que le registre des agents n'a pas vu n'est pas un anonyme,
 * c'est une mesure manquée (`agent list` a déjà été mesuré à 83 panes sur 227).
 */
export function normaliserLeParc({ panes = [], agentsHerdr = null, naissances = null } = {}) {
  // ⚠️ LE SÉPARATEUR EST ÉCRIT ÉCHAPPÉ, ET C’EST LA MÊME VALEUR — un NUL. L’octet BRUT était
  // dans le fichier : `file` rendait `data` pour ce module (le seul des 23 de `src/` et `bin/`)
  // et `grep -n export` dessus rendait ZÉRO ligne. Toute revue qui relève des formes par `grep`
  // sautait donc EN SILENCE le module qui porte la garde. On garde le NUL — aucun chemin de
  // socket ni identifiant de pane ne peut en contenir un — mais on l’écrit lisible.
  const cle = (p) => `${p?.herdr_socket ?? ''}\u0000${p?.pane_id}`;
  const nomsConnus = agentsHerdr
    ? { mesure: 'lue', noms: new Map(agentsHerdr.map((a) => [cle(a), a?.name ?? null])) }
    : { mesure: 'refusée', raison: 'le registre des agents ne m’a pas été donné' };

  return panes
    // Un pane sans session d'agent est un shell : personne n'y est né, personne n'y travaille.
    .filter((p) => Boolean(p?.agent_session))
    .map((p) => ({
      pane: p.pane_id,
      session: p.herdr_socket ?? null,
      // 🔴 LE MOTIF QU'ON INVOQUAIT ICI N'EST PAS CELUI QUE LE POSTE MONTRE. On écrivait
      // « un agent né par `claude-swt` garde le dépôt principal en `cwd` pendant que son
      // travail vit ailleurs ». Mesuré le 2026-08-25 sur le parc réel : **0 des 170 panes** —
      // 124 agents vivants compris — n'ont `cwd` différent de `foreground_cwd`. Le cas invoqué
      // ne se produit pas ici. Une justification que la mesure contredit se cite ensuite comme
      // un fait, et fait garder une branche que le réel n'emprunte pas.
      //
      // CE QUI RESTE VRAI, ET QUI SUFFIT : `foreground_cwd` est le répertoire du SHELL — donc
      // celui où l'agent travaille EN CE MOMENT — quand `cwd` est celui où le pane a été
      // ouvert. Les deux coïncident aujourd'hui ; le jour où ils divergeront, c'est le premier
      // qui dira où aller voir l'agent. `cwd` reste le repli, et `null` le dernier : un espace
      // absent ne s'invente pas.
      espace: p.foreground_cwd || p.cwd || null,
      nom: nomDeLAgent(p, cle(p), nomsConnus),
      // La NAISSANCE, dans le même vocabulaire à deux états que le nom — et pour la même
      // raison : ne pas savoir dater n'est pas une date. Voir `naissanceDeLAgent`.
      naissance: naissanceDeLAgent(p, naissances),
    }));
}

/**
 * L'IDENTIFIANT DE LA SESSION CLAUDE D'UN PANE — le seul endroit du module qui lise ce champ.
 *
 * ⚠️ LA FORME EST CELLE DU MONDE, relevée sur les 5 sessions qui répondent le 2026-08-25 :
 * `agent_session: { agent: 'claude', kind: 'id', source: 'herdr:claude', value: '<uuid>' }`.
 * C'est `value` qui porte l'identifiant, et rien d'autre. Un pane dont `agent_session` n'a pas
 * de `value` — herdr en rend — n'est pas datable, et ça se DIT (« non mesuré »), ça ne
 * s'invente pas.
 *
 * ⚠️ UNE SEULE FOIS DANS LE DÉPÔT, comme `identiteDeSession`. Le fil de la garde s'en sert pour
 * savoir QUELS transcrits chercher ; ce module s'en sert pour retrouver la date. Deux
 * expressions du même champ à un fichier de distance divergeraient au premier changement de
 * herdr — c'est le motif « deux étages qui n'y mettent pas la même chose », déjà payé ici.
 */
export function identifiantDeSessionDuPane(pane) {
  const v = pane?.agent_session?.value;
  return typeof v === 'string' && v ? v : null;
}

/**
 * QUAND CET AGENT EST-IL NÉ ? — `{ mesure: 'lu', instant }` ou `{ mesure: 'refusée', raison }`.
 *
 * 🔴 IL N'Y A PAS DE TROISIÈME ÉTAT, ET SURTOUT PAS « ANCIEN PAR DÉFAUT ». Un agent qu'on n'a
 * pas su dater n'est pas né avant la frontière : on ne sait pas quand il est né. Le ranger hors
 * portée le ferait passer au vert par un chemin que rien n'annonce — exactement le trou que ce
 * correctif ferme.
 *
 * ⚠️ ET L'ABSENCE DE SOURCE EST UN REFUS, PAS UN VIDE. `naissances = null` (le défaut) ne veut
 * pas dire « aucun agent n'est né » : il veut dire « personne ne m'a donné les naissances ».
 * Le défaut d'un paramètre absent est donc BRUYANT — tout le parc devient non mesuré, le
 * verdict tombe en `ZONES_NON_MESUREES`, sortie 2. C'est la seule polarité que ce fichier
 * accepte : ce qu'on ne sait pas classer est muet, et le vert tombe.
 */
export function naissanceDeLAgent(pane, naissances) {
  if (!naissances || naissances.mesure !== 'lue') {
    return {
      mesure: 'refusée',
      raison: naissances?.raison ?? 'les naissances des sessions ne m’ont pas été données',
    };
  }
  const session = identifiantDeSessionDuPane(pane);
  if (!session) {
    return { mesure: 'refusée', raison: 'son pane ne porte aucun identifiant de session Claude' };
  }
  const instant = naissances.instants?.get(session);
  if (!Number.isFinite(instant)) {
    // 🔴 « PAS TROUVÉ » N'EST PAS « ABSENT » QUAND LE BALAYAGE A DES ANGLES MORTS, ET LA RAISON
    // DOIT LE DIRE. `lireLesNaissances` COMPTE les répertoires de projet qu'il n'a pas su
    // ouvrir — son propre commentaire dit « on le compte pour que la raison le dise » — et ce
    // compte n'était consommé NULLE PART. La raison affirmait donc invariablement une absence
    // qu'elle n'avait pas mesurée : le transcrit cherché pouvait être dans le répertoire fermé,
    // et l'opérateur était envoyé chercher un fichier manquant pour une cause qui n'a rien à
    // voir avec lui.
    //
    // ⚠️ C'EST LE MÊME PARTAGE QUE CE MODULE TIENT UNE COUCHE PLUS BAS pour le registre des
    // déclarations (« un fait abîmé peut être celui de cet agent-ci ») — et qu'il n'avait pas
    // tenu pour le sien. La polarité ne change pas : dans les deux cas l'agent est NON MESURÉ.
    // Ce qui change est ce qu'on envoie faire — rouvrir un répertoire, ou chercher un agent.
    const angles = Number.isFinite(naissances.illisibles) ? naissances.illisibles : 0;
    return {
      mesure: 'refusée',
      raison:
        `aucun transcrit ne date la session ${session}` +
        (angles
          ? ` — mais ${angles} zone(s) du balayage n’ont pas pu être lues : le transcrit que je ` +
            `cherche peut être là. « Pas trouvé » n’y vaut pas « absent ».`
          : ''),
    };
  }
  return { mesure: 'lu', instant };
}

/**
 * LA FRONTIÈRE EST-ELLE DÉMENTIE PAR LE REGISTRE ? — l'épingle, et elle lit le monde.
 *
 * Voir l'en-tête, section ③. Un registre vide ne dit rien : l'épingle ne mord que sur des faits.
 */
function verifierLaFrontiere(declarations, miseEnService) {
  const frontiere = instantDeLHorodatage(miseEnService);
  if (!frontiere) {
    throw new FrontiereContredite(miseEnService, { ne_le: '(illisible)', nom: null });
  }
  let plusAncienne = null;
  for (const d of declarations) {
    const quand = Date.parse(d?.ne_le ?? '');
    if (Number.isNaN(quand)) continue;
    if (!plusAncienne || quand < Date.parse(plusAncienne.ne_le)) plusAncienne = d;
  }
  if (plusAncienne && Date.parse(plusAncienne.ne_le) < frontiere.getTime()) {
    throw new FrontiereContredite(miseEnService, plusAncienne);
  }
  return frontiere;
}

/**
 * CE QUE LE RETARD DE LA MESURE PEUT VALOIR — la tolérance de la couverture temporelle.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QU'ELLE ABSORBE N'EST PAS LE DÉLAI D'INSCRIPTION, C'EST LE RETARD DE LA MESURE.
 *
 * Une déclaration est écrite QUELQUES SECONDES APRÈS la naissance de l'agent — le geste vérifie
 * par le fait, puis inscrit. Mesuré sur la déclaration du poste le 2026-08-25 : le premier
 * événement de la session de l'agent déclaré précède son `ne_le` de **2,0 secondes**. Ce
 * délai-là ne demande aucune tolérance : il va dans le SENS qui identifie.
 *
 * Ce qui en demande une est la MESURE. La naissance d'un agent se lit à la date de création de
 * son transcrit, et un transcrit naît APRÈS le premier événement de sa session. Mesuré le
 * 2026-08-25 sur les **121 transcrits du poste qui datent une vraie conversation** :
 * médiane **19,5 s**, p90 **118 s**, p99 **964 s**, **maximum 2 208,8 s (36,8 min)**.
 * Une heure couvre cet observé avec 1,6× de marge.
 *
 * ⚠️ ET LE PLAFOND EST AUSSI UN CHOIX. Un chef d'équipe travaille des heures ; une tolérance
 * qui couvrirait sa journée rendrait la clé primaire aussi permissive qu'avant pour la reprise
 * d'un terminal. La tolérance doit rester COURTE devant la durée de vie d'un agent — c'est ce
 * que le banc épingle, par les deux bouts, contre les mesures ci-dessus.
 *
 * ⚠️ UN CAS MESURÉ SORT DE CETTE PLAGE, ET IL SORT PAR LE BON CÔTÉ. Le 122ᵉ transcrit du poste
 * — celui de l'unique agent DÉCLARÉ — porte un retard de **14 001 s (3 h 53)** : son fichier
 * ne contient aucun tour de conversation (il est « bridgé ») et a été RECRÉÉ en fin de course.
 * `birthtimeMs` n'y date donc pas la session. Avec cette tolérance, cet agent-là devient NON
 * MESURÉ — pas une prise. C'est la polarité que ce module tient partout : ce qu'on ne sait pas
 * classer est muet, et le vert tombe. La cause vraie est un défaut de la SONDE, pas de la
 * tolérance ; l'agrandir pour le cacher reviendrait à laisser une mesure cassée régler la
 * sensibilité de la garde.
 */
/**
 * LE RETARD DE LA MESURE, TEL QUE LE POSTE L'A MONTRÉ — la donnée contre laquelle la tolérance
 * est épinglée.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CE RELEVÉ EST DU CODE ET NON DE LA PROSE. Il ne l'était pas : ces chiffres
 * vivaient dans le commentaire ci-dessus, et l'épingle qui devait les faire mordre les
 * RECOPIAIT dans le banc — `2_209_000` et `4 * 3600 * 1000`, deux littéraux du fichier d'essai.
 * Son propre docblock avertissait pourtant : « Une épingle qui compare le module à une valeur
 * que le banc porte lui-même ne garde rien. »
 *
 * MESURÉ, copie hors dépôt : `TOLERANCE_DE_DATATION_MS` portée de 1 h à 4 h — UNE ligne —
 * 797 essais, 797 verts, épingle comprise. Portée à 8 h : un seul rouge, celui de l'épingle,
 * qu'une SECONDE édition d'allure d'entretien (`4 * 3600 * 1000` → `8 * 3600 * 1000`, dans le
 * banc) remettait au vert. Deux gestes anodins portaient la tolérance à la journée de travail
 * d'un chef d'équipe — ce que le texte ci-dessus désigne lui-même comme « rouvre exactement le
 * trou qu'on ferme ».
 *
 * ⚠️ CE QUE CE DÉPLACEMENT GAGNE, ET CE QU'IL NE GAGNE PAS — dit plutôt que tu. Le banc ne
 * porte plus AUCUN de ces nombres : une mutation d'un seul point sur la tolérance est désormais
 * impossible à faire passer. Mais la référence reste un relevé ENREGISTRÉ, pas une donnée que
 * la garde relit du monde à chaque tour — elle est donc plus faible que celle de
 * `verifierLaFrontiere`, qui compare sa frontière au registre RÉEL du poste. Ce qu'on a déplacé
 * est la VISIBILITÉ du désarmement : élargir la tolérance oblige maintenant à falsifier, dans
 * le module de décision et sous ce bloc, une mesure datée du poste. C'est le critère d'arrêt
 * que l'en-tête se donne — « le geste de désarmement doit devenir VISIBLE EN REVUE » — et non
 * une impossibilité.
 *
 * ⚠️ ET AUCUNE DONNÉE VIVANTE NE PEUT BORNER CETTE TOLÉRANCE PAR LE HAUT. Par le bas, le monde
 * parle : une tolérance trop courte fait tomber des réguliers chez les NON MESURÉS, et le
 * module le COMPTE déjà (`fauxRefusNonMesures`, rendu sur chaque page). Par le haut, rien — le
 * cas qu'une tolérance trop large laisse passer est un successeur qui a repris la place, et la
 * garde ne peut PAS le distinguer d'une mesure en retard : c'est très exactement ce pour quoi
 * la tolérance existe. Le relevé est donc le seul appui disponible, et on le dit.
 */
export const RETARD_DE_MESURE_OBSERVE = Object.freeze({
  /** Le pire retard observé, en ms — 2 208,8 s (36,8 min). En deçà, la garde refuse des réguliers. */
  maximumMs: 2_208_800,
  /** Sur combien de transcrits qui datent une VRAIE conversation. */
  transcrits: 121,
  /** Quand. Un relevé sans sa date ne se re-mesure pas. */
  leJour: '2026-08-25',
  /** Les quantiles du même relevé — ils disent que le maximum est une QUEUE, pas le régime. */
  medianeMs: 19_500,
  p90Ms: 118_000,
  p99Ms: 964_000,
});

/**
 * LA BANDE OÙ LA TOLÉRANCE A LE DROIT DE SE TENIR — en multiples du retard observé.
 *
 * ⚠️ LES DEUX BOUTS SONT DES DÉCISIONS, ET ILS N'ONT PAS LA MÊME NATURE.
 *
 *   · `minimale` — en dessous, la garde refuserait des agents réguliers dont le transcrit tarde
 *     comme le poste a déjà montré qu'il tarde. C'est une conséquence MESURÉE.
 *
 *   · `maximale` — au-dessus, la tolérance cesse d'être courte devant la durée de vie d'un
 *     agent, et la clé primaire redevient aussi permissive qu'avant pour la reprise d'un même
 *     terminal. C'est un JUGEMENT, appuyé sur ce que le module dit de lui-même — « une heure
 *     couvre cet observé avec 1,6× de marge » — et aucune mesure vivante ne peut le remplacer
 *     (voir le bloc ci-dessus). 2,5× laisse la marge du relevé respirer sans l'ouvrir à l'heure
 *     et demie près d'une session de travail.
 */
export const MARGE_SUR_LE_RETARD_OBSERVE = Object.freeze({ minimale: 1, maximale: 2.5 });

/**
 * Levée quand la tolérance de datation sort de la bande que le relevé du poste soutient.
 *
 * ⚠️ C'EST UN REFUS, PAS UN AVERTISSEMENT — même polarité que `FrontiereContredite`. Une garde
 * dont le seuil central n'est plus soutenu par sa propre mesure ne rend pas un verdict affaibli :
 * elle refuse d'en rendre un. Rendre vert là-dessus serait exactement le désarmement qu'on ferme.
 */
export class ToleranceHorsDeSaMesure extends Error {
  constructor(tolerance, plancher, plafond) {
    super(
      `garde des naissances : ma tolérance de datation est ${Math.round(tolerance / 1000)} s, ` +
        `mais le relevé du ${RETARD_DE_MESURE_OBSERVE.leJour} ` +
        `(${RETARD_DE_MESURE_OBSERVE.transcrits} transcrits, pire retard ` +
        `${Math.round(RETARD_DE_MESURE_OBSERVE.maximumMs / 1000)} s) ne soutient que ` +
        `[${Math.round(plancher / 1000)} s ; ${Math.round(plafond / 1000)} s]. Trop courte, je ` +
        `refuse des agents réguliers ; trop longue, je rends la clé primaire aussi permissive ` +
        `qu’avant pour la reprise d’un même terminal. Je REFUSE de rendre un verdict : ` +
        `re-mesurer le poste est le geste, pas élargir la bande.`
    );
    this.name = 'ToleranceHorsDeSaMesure';
    this.tolerance = tolerance;
    this.plancher = plancher;
    this.plafond = plafond;
  }
}

/**
 * LA TOLÉRANCE EST-ELLE SOUTENUE PAR SON RELEVÉ ? — l'épingle, et elle ne vit pas dans le banc.
 *
 * @throws {ToleranceHorsDeSaMesure}
 */
export function verifierLaTolerance(tolerance = TOLERANCE_DE_DATATION_MS) {
  const plancher = RETARD_DE_MESURE_OBSERVE.maximumMs * MARGE_SUR_LE_RETARD_OBSERVE.minimale;
  const plafond = RETARD_DE_MESURE_OBSERVE.maximumMs * MARGE_SUR_LE_RETARD_OBSERVE.maximale;
  if (!Number.isFinite(tolerance) || tolerance < plancher || tolerance > plafond) {
    throw new ToleranceHorsDeSaMesure(tolerance, plancher, plafond);
  }
  return tolerance;
}

/**
 * CET ÉCART DE DATATION EST-IL EXPLIQUÉ PAR LE RELEVÉ DU POSTE ? — le seul seuil du module qui
 * ne soit pas une décision, mais une mesure.
 *
 * ⚠️ IL NE DÉCIDE RIEN, IL QUALIFIE. La tolérance décide (couvre / ne couvre pas) ; celui-ci dit
 * si l'écart observé tombe dans ce que le poste a DÉJÀ montré (`RETARD_DE_MESURE_OBSERVE`) ou
 * s'il est plus grand que tout ce qu'on a mesuré. Un identifié à −2 s et un identifié à +59 min
 * se lisaient d'une seule façon dans le rendu ; seul le second est douteux, et le lecteur ne
 * pouvait pas les distinguer.
 *
 * ⚠️ LE SEUIL N'EST PAS INVENTÉ : c'est le relevé lui-même. Écrire ici un nombre choisi à la
 * main rouvrirait très exactement le défaut que `verifierLaTolerance` vient de fermer.
 */
export function ecartExpliqueParLeReleve(ecart) {
  return Number.isFinite(ecart) && Math.abs(ecart) <= RETARD_DE_MESURE_OBSERVE.maximumMs;
}

export const TOLERANCE_DE_DATATION_MS = 60 * 60 * 1000;

/**
 * CETTE DÉCLARATION COUVRE-T-ELLE UN AGENT NÉ À CET INSTANT ? — trois états, jamais deux.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CETTE FONCTION EXISTE. La clé primaire de l'appariement — pane-dans-sa-session,
 * dans l'espace déclaré — n'a AUCUN terme temporel. Or reprendre le worktree, c'est reprendre
 * l'espace ; le reprendre depuis le terminal où l'on était, c'est reprendre le pane. Les trois
 * termes coïncident donc EXACTEMENT sur `claude-swt <horodatage>`, le geste que le pack
 * PRESCRIT — et le successeur recevait la déclaration de son prédécesseur.
 *
 * La garde tenait pourtant les DEUX dates — `a.naissance.instant` d'un côté, `d.ne_le` de
 * l'autre — et ne les comparait jamais. Mesuré : déclaration du prédécesseur à 13 h 00,
 * successeur au même pane, même session, même espace, transcrit daté 22 h 00 — neuf heures
 * après la déclaration qui le couvre — verdict « rien à signaler », sortie 0.
 *
 * ⚠️ ET LE TROISIÈME ÉTAT N'EST PAS UN VIDE. Une déclaration dont la date est illisible ne
 * prouve NI qu'elle couvre cet agent, NI qu'elle ne le couvre pas. Les deux replis sont
 * commodes — l'un identifie à tort, l'autre accuse à tort. On rend « indécidable », et
 * l'appelant en fait un refus de mesure, jamais un verdict.
 */
export function couvertureDeLaDeclaration(
  declaration,
  instantDeNaissance,
  tolerance = TOLERANCE_DE_DATATION_MS
) {
  const inscrite = Date.parse(declaration?.ne_le ?? '');
  if (!Number.isFinite(inscrite)) {
    return {
      etat: 'indécidable',
      raison:
        `une déclaration l’apparie, mais sa date d’inscription est illisible ` +
        `(« ${declaration?.ne_le ?? 'absente'} ») : je ne peux pas dire si elle a été écrite ` +
        `pour CET agent-ci ou pour celui qui occupait ce pane avant lui`,
    };
  }
  // ⚠️ CE CAS-CI NE SE PRODUIT PAS DANS LA CHAÎNE DU MODULE, ET ON LE DIT PLUTÔT QUE DE LAISSER
  // CROIRE QU'IL GARDE QUELQUE CHOSE. `jugerLeParc` range un agent non datable chez les NON
  // MESURÉS AVANT d'appeler `sourcesDe` : la naissance y est toujours lue. La branche existe
  // parce que cette fonction est EXPORTÉE et que son contrat est total — trois états, jamais
  // deux, quel que soit l'appelant. Ce qui la garde est un essai, pas le trafic.
  if (!Number.isFinite(instantDeNaissance)) {
    return {
      etat: 'indécidable',
      raison:
        `une déclaration l’apparie, mais je n’ai pas su dater sa naissance : je ne peux pas ` +
        `dire si elle a été écrite pour lui ou pour son prédécesseur sur ce pane`,
    };
  }
  const ecart = instantDeNaissance - inscrite;
  // 🔴 LES DEUX CÔTÉS, ET ILS NE REFUSENT PAS LA MÊME CONFUSION. La borne n'existait que d'UN
  // côté : `ecart <= tolerance` laissait passer un écart négatif de n'importe quelle ampleur.
  // Mesuré : une déclaration inscrite TRENTE JOURS après la naissance rendait « couvre », et la
  // mutation `ecart` → `Math.abs(ecart)` SURVIVAIT à la suite entière.
  //
  //   · `ecart > 0` — l'agent est né APRÈS l'inscription. Risque : la déclaration est celle de
  //     son PRÉDÉCESSEUR sur ce pane. C'est le côté que la tolérance a été taillée pour
  //     absorber (le retard de la MESURE, relevé jusqu'à 36,8 min sur ce poste).
  //
  //   · `ecart < 0` — l'agent est né AVANT l'inscription. Risque SYMÉTRIQUE, et il n'est pas
  //     théorique : la déclaration est celle d'un SUCCESSEUR, et l'agent jugé est le
  //     prédécesseur encore vivant. Le repli par le NOM (`declarationDe`) l'atteint — et ce
  //     module écrit lui-même, sous `designationDe`, que « deux agents ont déjà porté le même
  //     nom sur ce poste parce qu'une naissance en a comblé un ».
  //
  // ⚠️ POURQUOI LA MÊME BORNE DES DEUX CÔTÉS ALORS QUE LES BESOINS DIFFÈRENT. Le côté APRÈS
  // demande infiniment moins : le geste prescrit vérifie par le fait PUIS inscrit, et l'unique
  // déclaration réelle du poste (2026-08-25) porte un écart de −2,043 s — ce que le module
  // affirme déjà plus haut (« précède son `ne_le` de 2,0 secondes »). Une borne taillée sur
  // N = 1 refuserait des réguliers pour économiser des minutes ; on prend donc la LARGE, qui
  // est la direction prudente ici — refuser à tort coûte une livraison, et ce que cette borne
  // ferme est GROSSIER (des jours, des semaines), pas fin. Elle mord, elle n'est pas décorative.
  if (Math.abs(ecart) <= tolerance) {
    return { etat: 'couvre', ecart, explique: ecartExpliqueParLeReleve(ecart) };
  }
  if (ecart > 0) {
    return {
      etat: 'périmée',
      ecart,
      raison:
        `la déclaration qui l’apparie a été inscrite ${Math.round(ecart / 1000)} s AVANT sa ` +
        `naissance — reprendre un pane dans son propre espace n’est pas naître. Elle couvre ` +
        `peut-être celui qui l’occupait avant lui ; je ne l’identifie pas là-dessus`,
    };
  }
  return {
    etat: 'périmée',
    ecart,
    raison:
      `la déclaration qui l’apparie a été inscrite ${Math.round(-ecart / 1000)} s APRÈS sa ` +
      `naissance — le geste qui fait naître inscrit dans la foulée, pas des heures plus tard. ` +
      `Elle a peut-être été écrite pour un SUCCESSEUR qui a repris sa place ou son nom ; je ne ` +
      `l’identifie pas là-dessus`,
  };
}

/**
 * LE SENS QUE LA RÈGLE TEMPORELLE REFUSE — obtenu EN LA JOUANT, jamais recopié à la main.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CETTE FONCTION EXISTE. La phrase que `methode.prises` imprime sur CHAQUE rendu
 * décrivait cette règle — et elle la décrivait À L'ENVERS, dans les deux sens. Elle posait
 * comme condition d'IDENTIFICATION qu'une déclaration soit « INSCRITE AVANT SA NAISSANCE À
 * LUI », et ajoutait qu'« une déclaration plus JEUNE que l'agent qu'elle apparie couvre
 * peut-être son prédécesseur : elle n'identifie pas ». Le code fait l'inverse — et une
 * déclaration plus jeune que l'agent est le cas NORMAL du régulier (le geste vérifie par le
 * fait, PUIS inscrit, deux secondes plus tard), qui ne peut par définition appartenir à aucun
 * PRÉDÉCESSEUR.
 *
 * Ce qui l'a laissée passer : elle était une SECONDE EXPRESSION de la règle, écrite à la main à
 * six cents lignes de celle qui décide. Aucune des six assertions posées sur `methode.prises`
 * ne la touchait — elles visent le pane, la session, l'espace, la frontière.
 *
 * ⚠️ ON NE LA RÉÉCRIT DONC PAS : ON LA DEMANDE. Cette fonction fabrique une déclaration dont
 * l'écart dépasse franchement la tolérance et demande à `couvertureDeLaDeclaration` ce qu'elle
 * en fait. Le mot imprimé est un RÉSULTAT de la décision, pas une opinion sur elle : inverser
 * la comparaison fait basculer la phrase avec le code, sans qu'aucune main ne s'en mêle.
 *
 * @returns {'AVANT'|'APRÈS'} de quel côté de sa naissance une déclaration cesse de l'identifier
 */
export function sensQueLaRegleTemporelleRefuse(tolerance = TOLERANCE_DE_DATATION_MS) {
  // Un instant fixe : la règle ne parle que d'ÉCARTS, l'origine n'entre pas dans son verdict.
  const naissance = Date.UTC(2026, 0, 1);
  const loin = 10 * tolerance;
  const inscriteAvant = couvertureDeLaDeclaration(
    { ne_le: new Date(naissance - loin).toISOString() },
    naissance,
    tolerance
  );
  return inscriteAvant.etat === 'couvre' ? 'APRÈS' : 'AVANT';
}

/**
 * L'AGENT TRAVAILLE-T-IL DANS L'ESPACE QUE CETTE DÉCLARATION INSCRIT ? — la borne du repli.
 *
 * ⚠️ LE SÉPARATEUR EST LA FRONTIÈRE, PAS LE PRÉFIXE. `…/20260825-101721-bis` commence par
 * `…/20260825-101721` sans être dedans : un `startsWith` nu rendrait deux worktrees voisins
 * indiscernables, c'est-à-dire rouvrirait le trou par la porte d'à côté.
 *
 * ⚠️ ET LE SOUS-DOSSIER COMPTE. `foreground_cwd` est le répertoire du SHELL, pas la racine de
 * l'arbre : un chef d'équipe qui descend dans un dossier de son worktree travaille toujours
 * dans son espace. Exiger l'égalité stricte ferait de lui une prise pour un `cd` — le faux
 * refus symétrique de celui qu'on ferme.
 */
export function memeEspaceDeTravail(espaceDeLAgent, espaceDeclare) {
  if (!espaceDeLAgent || !espaceDeclare) return false;
  const net = (c) => String(c).replace(/\/+$/, '');
  const a = net(espaceDeLAgent);
  const d = net(espaceDeclare);
  // Un espace déclaré vide après nettoyage — « / » — apparierait tout le poste.
  if (!d) return false;
  return a === d || a.startsWith(`${d}/`);
}

/**
 * L'agent est-il couvert par une déclaration ? Par son pane DANS sa session, ou par son nom.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LES DEUX CÔTÉS DE LA SESSION PASSENT PAR `identiteDeSession`, ET C'EST LE CORRECTIF.
 *
 * Ils ne parlaient pas la même langue : la déclaration porte le NOM de la session (« somtech »,
 * ce que `bin/naitre.js` inscrit), l'agent porte le CHEMIN de son socket
 * (« /Users/…/.config/herdr/sessions/somtech/herdr.sock », ce que `herdr pane list` rend). La
 * comparaison directe était donc TOUJOURS fausse sur une déclaration écrite par le vrai geste :
 * **cette clé-ci n'a jamais mordu**, et le vert de cette garde ne tenait que par le repli sur
 * le nom — alors que la méthode imprimée annonçait les deux.
 *
 * Le prix se payait sur la population que la garde vise : quand `agent list` ne rend pas le nom
 * d'un agent — mesuré à 83 panes sur 227 un jour — un agent parfaitement DÉCLARÉ devenait une
 * PRISE. Un faux refus, sur le seul agent régulier du poste.
 *
 * ⚠️ UNE SESSION INCONNUE N'APPARIE RIEN. `identiteDeSession` rend `null` sur un socket hors de
 * la forme `…/sessions/<nom>/…` — elle n'invente aucun nom. Laisser deux `null` se comparer
 * égaux apparierait sur le SEUL pane, c'est-à-dire le défaut que cette clé existe pour fermer :
 * un identifiant de pane n'est unique que dans sa session, et ce poste en porte quinze. On
 * exige donc les deux côtés NOMMÉS, et l'incertitude tombe du côté prudent — le repli par le
 * nom reste disponible, et un agent qu'aucune des deux clés n'atteint reste une prise.
 */
function declarationDe(agent, declarations) {
  const nom = agent.nom?.mesure === 'lu' ? agent.nom.valeur : null;
  const session = identiteDeSession(agent.session);
  return (
    // 🔴 LA CLÉ PRIMAIRE EST BORNÉE PAR L'ESPACE, ELLE AUSSI — et elle ne l'était par RIEN.
    // Elle appariait sur `pane === pane && session === session`, sans l'espace, ni la date, ni
    // le rôle, ni le mandat. C'est la CINQUIÈME fois dans ce lot qu'une correction ne ferme
    // qu'une moitié : le repli par le nom a reçu sa borne, la clé primaire est restée nue.
    //
    // ⚠️ ET LE CAS NE DEMANDE AUCUN RECYCLAGE D'IDENTIFIANT — il suffit de REPRENDRE LE PANE,
    // ce à quoi un terminal sert. Un chef d'équipe naît par le geste ; son travail fini, on
    // relance un `claude` À LA MAIN dans le même pane, sur un worktree NEUF. Cet agent n'a
    // aucune déclaration, aucun lieu de rôle, il est dans la population — et la garde le
    // rangeait en « identifié » par la déclaration de son PRÉDÉCESSEUR.
    //
    // ⚠️ `fauxRefus` NE POUVAIT PAS LE VOIR : il ne croise l'espace que sur les PRISES, jamais
    // sur les identifiés. Le contre-contrôle est aveugle dans cette direction PAR CONSTRUCTION.
    //
    // ⚠️ LA MÊME BORNE QUE LE REPLI, ET LA MÊME FONCTION — pas une variante écrite ici. Deux
    // copies d'une même règle divergent au premier changement de l'une, et celle qui divergerait
    // ici rouvrirait le trou qu'on ferme. C'est aussi ce qui interdit l'égalité stricte : un
    // agent qui descend dans un dossier de son arbre travaille toujours dans son espace, et
    // l'exiger identique ferait de lui une prise pour un `cd`.
    //
    // ⚠️ LE PRIX MESURÉ SUR LE TRAFIC RÉEL (2026-08-25, 5 sessions sur 15) : 14 agents dans la
    // population, 1 identifié — par cette clé-ci — et son `foreground_cwd` est EXACTEMENT
    // l'espace que sa déclaration inscrit. La borne ne coûte donc aucun faux refus mesurable.
    (session === null
      ? null
      : declarations.find(
          (d) =>
            d?.pane &&
            d.pane === agent.pane &&
            identiteDeSession(d.session_herdr) === session &&
            memeEspaceDeTravail(agent.espace, d.espace)
        )) ||
    // 🔴 LE REPLI EST BORNÉ PAR L'ESPACE DE TRAVAIL, et il ne l'était par RIEN. Il appariait
    // n'importe quelle déclaration portant ce nom — ni le pane, ni la session, ni l'espace, ni
    // la date n'entraient. La section ⓿ a fermé « nom conforme ⇒ identifié » et laissé ouvert
    // « nom qui apparie une déclaration QUELCONQUE ⇒ identifié » : même population, même
    // conséquence, une moitié sur deux. Mesuré : un agent ouvert à la main, sans déclaration,
    // dans un worktree NEUF, portant un nom déjà au registre → `identifies: 1`, sortie 0.
    //
    // ⚠️ ET C'EST L'ESPACE, PAS LE PANE. Le repli EXISTE parce que le pane a bougé : le borner
    // par le pane le supprimerait. L'espace est le seul fait que la déclaration inscrit à la
    // naissance ET que l'agent porte encore pendant qu'il travaille — le module le lisait déjà
    // pour `fauxRefus`, sans jamais s'en servir là où il identifie.
    //
    // ⚠️ LE PRIX MESURÉ SUR LE TRAFIC RÉEL (2026-08-25, 5 sessions sur 15) : 14 agents dans la
    // population, 1 identifié — et par la clé PANE-DANS-SA-SESSION, pas par ce repli. Zéro
    // identification passait par ici. La borne ne coûte donc aucun faux refus mesurable, et le
    // jour où le registre grossit, elle est ce qui empêche le repli de devenir un laissez-passer.
    (nom
      ? declarations.find((d) => d?.nom === nom && memeEspaceDeTravail(agent.espace, d.espace))
      : null) ||
    null
  );
}

/**
 * LES DEUX SOURCES, chacune dans le vocabulaire à trois états de `roleDuLieuOuRefus` :
 * `'établi'` · `'non établi'` · `'refusée'`.
 *
 * ⚠️ AUCUNE NE SE RABAT SUR UNE AUTRE. Une source qu'on n'a pas pu mesurer ne devient pas
 * « absente » parce qu'une autre a répondu : elle reste refusée, et si AUCUNE n'est établie,
 * l'agent est « non mesuré », jamais « hors dispositif ». Les deux appellent des gestes
 * opposés.
 */
function sourcesDe(agent, { declarations, illisibles, roleDuLieu, tolerance = TOLERANCE_DE_DATATION_MS }) {
  const decl = declarationDe(agent, declarations);
  // 🔴 L'APPARIEMENT EST STRUCTUREL ; LA COUVERTURE EST TEMPORELLE — ET IL FALLAIT LES DEUX.
  // `declarationDe` dit QUELLE déclaration désigne cette place (ce pane dans cette session, cet
  // espace, ce nom) ; elle ne peut pas dire si elle désigne CET occupant-ci ou le précédent.
  // Une place se reprend — c'est à ça qu'un terminal sert — et la reprise est le geste que le
  // pack PRESCRIT. Voir `couvertureDeLaDeclaration`.
  const naissance = agent.naissance?.mesure === 'lu' ? agent.naissance.instant : null;
  const couverture = decl ? couvertureDeLaDeclaration(decl, naissance, tolerance) : null;
  // ⚠️ LE NOM EST LA CLÉ DE REPLI DE L'APPARIEMENT (voir `declarationDe`) : un agent dont le
  // pane a bougé n'est retrouvé que par lui. Un nom NON MESURÉ rend donc la déclaration
  // « refusée », jamais « absente » — sinon `agent list`, mesuré à 83 panes sur 227 un jour,
  // suffirait à transformer des agents déclarés en prises par simple panne de lecture.
  const nomNonMesure = agent.nom?.mesure === 'refusée';
  const source1 = couverture?.etat === 'couvre'
    ? { etat: 'établi', quoi: SOURCES.DECLARATION, detail: decl, ecart: couverture.ecart, explique: couverture.explique }
    // ⚠️ UNE DÉCLARATION QUI NE LE COUVRE PAS REND LA SOURCE « REFUSÉE », JAMAIS « ABSENTE » —
    // et surtout pas une PRISE. Les deux lectures restent ouvertes : un successeur qui a repris
    // la place, ou l'agent déclaré dont la MESURE de naissance retarde (mesuré : un transcrit
    // du poste retarde de 3 h 53). Nommer un fautif là-dessus serait accuser sur une mesure qui
    // ne tranche pas ; l'identifier est le défaut qu'on ferme. Il reste NON MESURÉ, sortie 2.
    : couverture
      ? { etat: 'refusée', quoi: SOURCES.DECLARATION, raison: couverture.raison }
      : illisibles.length
      // ⚠️ UN FAIT ABÎMÉ PEUT ÊTRE CELUI DE CET AGENT-CI. Le registre ne sait pas dire de qui
      // parlait un fichier qu'il n'a pas su lire — donc « pas trouvé » n'y vaut pas « absent ».
      ? {
          etat: 'refusée',
          quoi: SOURCES.DECLARATION,
          raison: `le registre porte ${illisibles.length} déclaration(s) illisible(s) : ` +
            illisibles.map((i) => `${i.fichier} (${i.cause})`).join(', '),
        }
      : nomNonMesure
        ? {
            etat: 'refusée',
            quoi: SOURCES.DECLARATION,
            raison: `${agent.nom.raison} — or le nom est la clé de repli de l’appariement : ` +
              `sans lui, « pas trouvée » ne vaut pas « absente »`,
          }
        : { etat: 'non établi', quoi: SOURCES.DECLARATION };

  const candidat = lieuDeRoleDansLeChemin(agent.espace);
  let source2 = { etat: 'non établi', quoi: SOURCES.LIEU };
  if (candidat) {
    let vu;
    try {
      vu = roleDuLieu(candidat.lieu);
    } catch (err) {
      vu = { refus: String(err?.message ?? err).trim() };
    }
    if (typeof vu === 'string' && vu) source2 = { etat: 'établi', quoi: SOURCES.LIEU, detail: vu };
    else if (vu && typeof vu === 'object' && vu.refus) {
      source2 = { etat: 'refusée', quoi: SOURCES.LIEU, raison: vu.refus };
    }
  }

  // ⚠️ LE NOM SE JUGE, IL NE SE CONSTATE PAS — et depuis le 2026-08-25 il n'IDENTIFIE PLUS.
  // Ce qu'on en tire n'est plus une source : c'est ce qu'on DIRA sur la ligne de la prise. On
  // importe toujours `nomDeLieuValide` — on n'en réécrit pas une variante — parce que « nom
  // conforme » doit vouloir dire la même chose ici que partout ailleurs dans le dépôt.
  const nomConforme = agent.nom?.mesure === 'lu' && nomDeLieuValide(agent.nom.valeur);

  return { sources: [source1, source2], nomConforme };
}

/**
 * LE CODE QUE HERDR REND QUAND IL N'Y A PLUS DE SERVEUR DERRIÈRE UN SOCKET.
 *
 * ⚠️ C'EST UN IDENTIFIANT DE MACHINE, PAS UNE TOURNURE. Il arrive dans la charge JSON du refus
 * (`{"error":{"code":"server_not_running",…}}`) et `panes()` le recopie tel quel dans la raison.
 * On apparie donc un CODE, jamais une phrase — énumérer des tournures ne rejoint jamais la langue.
 */
const SERVEUR_ABSENT = 'server_not_running';

/**
 * UNE SESSION QUI A REFUSÉ ÉTAIT-ELLE ABSENTE, OU MUETTE ?
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 C'EST CE PARTAGE QUI DÉCIDE SI LE VERT EST PERMIS, et sans lui la garde certifiait un
 * parc qu'elle n'avait pas regardé : `sessionsRefusees` entrait dans les comptes et dans la
 * prose, jamais dans le verdict ni dans la sortie. Mesuré le 2026-08-25 : **15 sessions
 * interrogées, 10 refusent** — le `0` que lit une machine portait sur un tiers du poste.
 *
 * ⚠️ MAIS « UNE SESSION QUI REFUSE ⇒ ROUGE » AURAIT ÉTÉ IGNORÉ EN TROIS JOURS, et une garde
 * qu'on ignore ne garde rien. Le trafic réel tranche : les **10 refus sur 10** du poste portent
 * le code `server_not_running`. Une session dont le serveur ne tourne pas n'a NI pane NI agent —
 * il n'y a rien qu'on ait manqué de mesurer. C'est un socket qui a survécu à sa session, pas une
 * zone d'ombre. C'est le partage que ce dispositif fait déjà entre un registre ABSENT (le cas
 * normal, parfaitement jugeable) et un registre LÀ MAIS ILLISIBLE (un refus), une couche plus bas.
 *
 * 🔴 ET LA POLARITÉ DE SA PROPRE PANNE EST LE POINT. Reconnaître l'absence est ce qui rend cette
 * garde silencieuse ; le jour où herdr change ce code, la reconnaissance cesse de mordre. Cet
 * échec-là doit donc rendre la garde **PLUS BRUYANTE, jamais plus aveugle** : ce qu'on ne sait
 * pas classer est MUET, et le vert tombe. L'inverse — présumer l'absence — ferait de ce code un
 * interrupteur de désarmement logé chez un outil tiers.
 */
export function sessionAbsente(refus) {
  return String(refus?.raison ?? '').includes(SERVEUR_ABSENT);
}

/**
 * LE JUGEMENT DU PARC.
 *
 * @param {object[]} agents          le parc normalisé — `normaliserLeParc`
 * @param {{declarations: object[], illisibles: object[]}} registre  ce que `lireLesDeclarations` rend
 * @param {(lieu) => string|null|{refus}} roleDuLieu  INJECTÉ : il touche le disque, pas nous
 * @param {{sessionsInterrogees: number, sessionsRefusees: object[]}} portee  sur quoi on porte
 * @param {string} [miseEnService]   la frontière — `MISE_EN_SERVICE` par défaut
 *
 * @throws {FrontiereContredite}      la frontière est démentie par le registre
 * @throws {ComptesQuiNeBalancentPas} un agent est sorti d'un panier sans entrer dans un autre
 */
export function jugerLeParc({
  agents = [],
  registre = { declarations: [], illisibles: [] },
  roleDuLieu = () => null,
  portee = { sessionsInterrogees: 1, sessionsRefusees: [] },
  miseEnService = MISE_EN_SERVICE,
  // ⚠️ LE SEUL POINT DE SUBSTITUTION, ET IL N'ÉLARGIT RIEN. Il existe parce que l'épingle de la
  // tolérance n'était branchée que par un `grep` sur le source — deux caractères de commentaire
  // devant l'appel la débranchaient sans qu'un seul essai rougisse (le motif « chercher un mot
  // et conclure sur la fonction »). Une garde ne se prouve pas branchée en lisant son propre
  // fichier : elle se prouve en REFUSANT. Ce paramètre laisse un essai reproduire la CAUSE —
  // une tolérance hors de sa bande — sur la chaîne RÉELLE, moins cette seule chose nommée.
  //
  // ⚠️ IL NE PEUT PAS SERVIR À DÉSARMER : `verifierLaTolerance` s'applique à LUI. Un appelant
  // qui passerait une tolérance élargie ne fait pas juger la garde plus mollement — il la fait
  // REFUSER de se prononcer. La seule valeur qui traverse est une valeur que le relevé soutient.
  tolerance = TOLERANCE_DE_DATATION_MS,
} = {}) {
  const declarations = registre?.declarations ?? [];
  const illisibles = registre?.illisibles ?? [];
  const frontiere = verifierLaFrontiere(declarations, miseEnService);
  // ⚠️ LA SECONDE ÉPINGLE, AU MÊME ENDROIT QUE LA PREMIÈRE, ET DE LA MÊME POLARITÉ. Le seuil
  // central de la couverture temporelle ne se déplace pas sans que sa mesure le suive : voir
  // `verifierLaTolerance`. Une tolérance sortie de sa bande fait REFUSER la garde, elle ne la
  // fait pas juger plus mollement.
  verifierLaTolerance(tolerance);

  const horsPortee = [];
  const identifies = [];
  const prises = [];
  const nonMesures = [];

  for (const a of agents) {
    const designation = designationDe(a);
    const horodatage = horodatageDuChemin(a.espace);

    // ── ① LE PRÉDICAT DE POPULATION, ET IL N'A QU'UN SEUL TERME : LA NAISSANCE DE L'AGENT.
    // Pas le nom, pas le rôle, pas le mandat, pas le statut, ET PAS SON RÉPERTOIRE DE TRAVAIL —
    // qui était le terme qui décidait, et qui date le worktree, pas l'agent (voir l'en-tête :
    // une reprise `claude-swt <horodatage>` naît aujourd'hui dans un répertoire d'hier). C'est
    // ce qui rend le dénominateur épinglé plutôt qu'ouvert : il n'y a aucun endroit où glisser
    // « sauf celui-là ».
    //
    // ⚠️ ET « JE N'AI PAS PU LE DATER » N'EST PAS « NÉ AVANT ». Il sort par les NON MESURÉS,
    // qui ne sont pas verts — jamais par la borne, qui l'est.
    if (a.naissance?.mesure !== 'lu') {
      nonMesures.push({
        designation,
        espace: a.espace,
        raisons: [`${DATATION} : ${a.naissance?.raison ?? 'sans raison donnée'}`],
      });
      continue;
    }
    if (a.naissance.instant < frontiere.getTime()) {
      horsPortee.push({ designation, espace: a.espace, raison: 'né avant la mise en service du dispositif' });
      continue;
    }

    const { sources, nomConforme } = sourcesDe(a, { declarations, illisibles, roleDuLieu, tolerance });
    const etablie = sources.find((s) => s.etat === 'établi');
    if (etablie) {
      // ⚠️ L'ÉCART VOYAGE AVEC L'IDENTIFICATION. Sans lui, un identifié à −2 s (le régulier)
      // et un identifié à +59 min (le seul cas douteux) se lisaient d'une seule façon.
      identifies.push({
        designation,
        espace: a.espace,
        source: etablie.quoi,
        ecart: etablie.ecart ?? null,
        explique: etablie.ecart === undefined ? true : Boolean(etablie.explique),
      });
      continue;
    }
    const refusees = sources.filter((s) => s.etat === 'refusée');
    if (refusees.length) {
      nonMesures.push({
        designation,
        espace: a.espace,
        raisons: refusees.map((s) => `${s.quoi} : ${s.raison}`),
      });
      continue;
    }
    // ⚠️ `ne_le` EST LA NAISSANCE DE L'AGENT, pas celle de son répertoire. `worktree` porte
    // l'horodatage du chemin quand il y en a un — une information pour aller le voir, plus un
    // fait qui juge.
    prises.push({
      designation,
      espace: a.espace,
      ne_le: new Date(a.naissance.instant).toISOString(),
      worktree: horodatage,
      nomConforme,
    });
  }

  // ── LE FAUX REFUS, MESURÉ PAR UNE AUTRE CLÉ QUE CELLE DE L'APPARIEMENT.
  //
  // ⚠️ LE MESURER AVEC LA CLÉ QUI A SERVI À APPARIER LE RENDRAIT NUL PAR CONSTRUCTION — un
  // chiffre juste, tautologique, et donc invérifiable. On croise donc par l'ESPACE DE TRAVAIL :
  // une déclaration qui porte l'espace d'un agent pris prouve qu'une naissance a bien eu lieu
  // là, et que c'est l'APPARIEMENT qui a raté. C'est un défaut de cette garde, et il doit se
  // voir dans sa propre sortie plutôt que d'attendre qu'un humain le trouve.
  //
  // 🔴 ET IL CROISE PAR LA MÊME RÈGLE D'ESPACE QUE LA CLÉ QU'IL AUDITE — il était PLUS STRICT.
  // L'appariement identifie par PRÉFIXE (`memeEspaceDeTravail`), parce qu'un agent qui descend
  // dans un dossier de son arbre travaille toujours dans son espace. Ce contre-contrôle, lui,
  // croisait par ÉGALITÉ (`new Set(...).has`). Un agent déclaré, descendu d'un cran, dont le
  // pane a bougé et qui n'a pas de nom devenait une prise — et le seul chiffre censé mesurer
  // les refus à tort rendait ZÉRO. Il certifiait « aucun refus à tort » précisément sur le cas
  // pour lequel la règle de préfixe a été écrite.
  //
  // ⚠️ IL RESTE UN CROISEMENT PAR UNE CLÉ AUTRE, et c'est ce qui l'empêche de redevenir nul par
  // construction : l'appariement exige (pane-dans-sa-session ET espace) OU (nom ET espace) ;
  // celui-ci n'exige QUE l'espace. C'est la RÈGLE DE COMPARAISON qui s'aligne, pas la clé.
  //
  // 🔴 ET IL NE CROISAIT QUE LES PRISES — pendant que la règle temporelle en écartait un.
  // `couvertureDeLaDeclaration` a la bonne polarité : une déclaration inscrite AVANT la
  // naissance de l'agent qu'elle apparie, de plus que la tolérance, ne l'identifie pas — elle
  // couvre peut-être celui qui occupait sa place avant lui — et l'agent tombe chez les NON
  // MESURÉS, jamais chez les prises. (Ce commentaire disait « plus jeune », c'est-à-dire
  // exactement l'inverse : le cas NORMAL du régulier, inscrit deux secondes APRÈS sa naissance.) Mais le contre-contrôle ne regardait pas ce panier-là. Mesuré sur le parc réel le
  // 2026-08-25, dans la MÊME page de sortie : « t-20260825-0047 — … inscrite 13999 s AVANT sa
  // naissance … je ne l'identifie pas là-dessus » et, douze lignes plus bas, « refus à tort
  // (mesurés) : 0 ». La ligne de l'agent le dit, le chiffre le nie.
  //
  // ⚠️ DEUX CHIFFRES, PAS UN SEUL ÉLARGI — les deux natures n'appellent pas le même geste.
  // Parmi les PRISES, la garde ACCUSE à tort : on va voir l'agent, on répare l'APPARIEMENT.
  // Parmi les NON MESURÉS, elle AVOUE ne pas savoir alors qu'une déclaration porte son espace :
  // personne n'est accusé, c'est la MESURE qu'on va réparer. Sur le trafic du 2026-08-25 la
  // répartition est 0 / 1 — tout le signal du jour est de la seconde nature, et un chiffre
  // unique aurait envoyé l'opérateur chercher un fautif parmi 17 prises où il n'y en a aucun.
  //
  // ⚠️ UNE SEULE RÈGLE DE CROISEMENT POUR LES DEUX, écrite une fois. Deux copies divergeraient
  // au premier changement de l'une — c'est déjà ce qui avait rendu ce contre-contrôle PLUS
  // STRICT que la clé qu'il audite.
  //
  // ⚠️ ET IL RESTE UN DÉTECTEUR, JAMAIS UN CORRECTIF. Il filtre des paniers déjà constitués :
  // il ne fait d'un non mesuré ni une prise, ni l'inverse, et ne touche pas l'équilibre.
  const espacesDeclares = declarations.map((d) => d?.espace).filter(Boolean);
  const uneDeclarationPorteSonEspace = (x) => espacesDeclares.some((e) => memeEspaceDeTravail(x.espace, e));
  const fauxRefus = prises.filter(uneDeclarationPorteSonEspace);
  const fauxRefusNonMesures = nonMesures.filter(uneDeclarationPorteSonEspace);

  // ── LES SESSIONS QU'ON N'A PAS SU REGARDER — voir `sessionAbsente`. Une session dont le
  // serveur ne tourne pas n'avait rien à montrer ; toute autre était là et s'est tue.
  const sessionsMuettes = (portee?.sessionsRefusees ?? []).filter((r) => !sessionAbsente(r));

  // ⚠️ SUR QUOI LE VERT REPOSE — mesuré sur le trafic réel du 2026-08-25, et ça contredit une
  // lecture confortable du dispositif : les 8 agents de la population du jour étaient
  // identifiés **à 8 sur 8 par leur NOM**, zéro par déclaration, zéro par lieu de rôle.
  //
  // Or le nom est la source la plus FAIBLE des trois — la liste blanche du dépôt accepte à peu
  // près n'importe quel segment de chemin. Un « rien à signaler » entièrement porté par elle ne
  // vaut PAS le même « rien à signaler » qu'un parc déclaré, et un verdict nu ne permet pas au
  // lecteur de faire la différence : le compte est juste, la phrase qu'on en tirerait est
  // fausse. La ventilation voyage donc avec le verdict, toujours.
  const parSource = {};
  for (const i of identifies) parSource[i.source] = (parSource[i.source] ?? 0) + 1;

  // 🔴 LES IDENTIFIÉS QUE LA TOLÉRANCE SEULE RETIENT — le coût de cette tolérance, RENDU.
  // Le rendu ne distinguait pas un identifié à −2 s (le régulier : le geste inscrit deux
  // secondes après la naissance) d'un identifié à +59 min, alors que le SECOND est le seul cas
  // douteux : dans cette bande, la garde ne peut pas séparer « la mesure retarde » de « c'est
  // le successeur du déclaré ». Ceux-ci sont donc identifiés sur un écart que le relevé du
  // poste N'EXPLIQUE PAS — la garde les compte comme identifiés, et le DIT.
  //
  // ⚠️ CE N'EST PAS UN PANIER : un sous-ensemble des identifiés, il ne touche pas l'équilibre.
  const identifiesInexpliques = identifies.filter((i) => i.ecart !== null && !i.explique);

  const comptes = {
    parSource,
    parcVivant: agents.length,
    horsPortee: horsPortee.length,
    population: identifies.length + prises.length + nonMesures.length,
    identifies: identifies.length,
    identifiesInexpliques: identifiesInexpliques.length,
    prises: prises.length,
    // ⚠️ LE PRIX DE LA CORRECTION, RENDU EN CHIFFRE. Ces prises-là, l'ancienne règle les tenait
    // pour identifiées. C'est le seul endroit où le lecteur voit ce que le changement a
    // basculé — et le seul chiffre à surveiller si quelqu'un croit la garde trop bruyante.
    // Ce n'est PAS un panier : un sous-ensemble des prises, il ne touche pas l'équilibre.
    prisesAuNomConforme: prises.filter((p) => p.nomConforme).length,
    nonMesures: nonMesures.length,
    // ⚠️ DEUX CHIFFRES NOMMÉS, JAMAIS UN SEUL. Aucun des deux n'est un panier : ce sont des
    // sous-ensembles des prises et des non mesurés, et ils ne touchent pas l'équilibre.
    fauxRefus: fauxRefus.length,
    fauxRefusNonMesures: fauxRefusNonMesures.length,
    sessionsInterrogees: portee?.sessionsInterrogees ?? 0,
    sessionsRefusees: (portee?.sessionsRefusees ?? []).length,
    // ⚠️ LES MUETTES SONT UN SOUS-ENSEMBLE DES REFUSÉES, PAS UN PANIER — elles ne touchent pas
    // l'équilibre des comptes, qui ne parle que d'AGENTS. Ce qu'elles portent est d'un autre
    // ordre : non pas « quel agent », mais « quelle part du poste ai-je pu regarder ».
    sessionsMuettes: sessionsMuettes.length,
  };

  // ── ② LES COMPTES BALANCENT — voir l'en-tête. C'est ici qu'une exception muette se casse.
  if (
    comptes.parcVivant !== comptes.horsPortee + comptes.population ||
    comptes.population !== comptes.identifies + comptes.prises + comptes.nonMesures
  ) {
    throw new ComptesQuiNeBalancentPas(comptes);
  }

  // ⚠️ UNE SESSION MUETTE EST UNE ZONE NON MESURÉE AU MÊME TITRE QU'UN AGENT NON MESURÉ, et
  // c'est la moitié qui manquait. Le fil se donne pour contrat de « ne JAMAIS rendre vert sur
  // une mesure qu'il n'a pas faite » ; `sessionsRefusees` n'entrait pourtant ni dans le verdict
  // ni dans la sortie. Le vocabulaire existait déjà — `ZONES_NON_MESUREES`, sortie 2 — et ne
  // servait pas. Le texte disait la limite ; le contrat machine disait vert.
  //
  // ⚠️ LA PRISE PASSE AVANT, DÉLIBÉRÉMENT. Les deux appellent des gestes opposés — aller voir un
  // agent / refaire la mesure — et le plus urgent des deux est celui qui nomme un fautif. Les
  // deux sont non-verts, donc le contrat tient dans les deux cas, et la portée voyage de toute
  // façon sur chaque rendu.
  const verdict = prises.length
    ? VERDICTS.NES_HORS_DISPOSITIF
    : nonMesures.length || sessionsMuettes.length
      ? VERDICTS.ZONES_NON_MESUREES
      : VERDICTS.RIEN_A_SIGNALER;

  const methode = {
    prises:
      'un agent VIVANT dont la SESSION est née après ' +
      `« ${miseEnService} » — sa naissance à LUI, lue au transcrit de sa session, jamais ` +
      'l’horodatage de son répertoire : `claude-swt <horodatage>` REPREND un vieil espace pour ' +
      'y faire naître un agent neuf — et qu’AUCUNE des DEUX sources n’identifie — ni une déclaration ' +
      '(appariée par pane-dans-sa-session ET DANS L’ESPACE DE TRAVAIL QUE LA DÉCLARATION ' +
      'INSCRIT — reprendre un pane n’est pas naître, et un terminal se réutilise ; ' +
      'ou à défaut par nom, dans ce MÊME espace ' +
      // 🔴 LE SENS N'EST PAS ÉCRIT ICI, IL EST JOUÉ. Cette phrase a été imprimée À L'ENVERS sur
      // chaque rendu — voir `sensQueLaRegleTemporelleRefuse`. Une seconde expression de la
      // règle, à six cents lignes de celle qui décide, ne peut que diverger d'elle un jour.
      `— et INSCRITE ${sensQueLaRegleTemporelleRefuse() === 'AVANT' ? 'APRÈS' : 'AVANT'} SA ` +
      'NAISSANCE À LUI, au retard de la mesure près : reprendre le worktree reprend l’espace, ' +
      'le reprendre depuis son terminal reprend le pane, donc les trois termes de la clé ' +
      'coïncident sur le geste même que le pack prescrit. Une déclaration inscrite ' +
      `${sensQueLaRegleTemporelleRefuse()} sa naissance de plus que cette tolérance couvre ` +
      'peut-être celui qui occupait sa place AVANT lui : elle ne l’identifie pas, et l’agent ' +
      'tombe chez les NON MESURÉS, pas chez les prises ' +
      '— un nom seul apparierait la naissance de n’importe qui ; la session se compare par son ' +
      'NOM, celui que la déclaration inscrit et que le socket du pane porte dans son chemin — ' +
      'une session que rien ne nomme n’apparie personne par le pane), ni un lieu de rôle ' +
      'établi sur disque. ' +
      'Son NOM n’entre pas dans ce jugement, si conforme soit-il : le nom d’un agent né par le ' +
      'dispositif est le code de son mandat, donc toujours conforme — l’accepter comme preuve ' +
      'rendait la branche « déclaration retirée » incapable de rougir pour la population même ' +
      'que cette garde vise.',
    fauxRefus:
      'parmi les prises, et parmi elles SEULEMENT : ceux dont l’espace de travail figure comme ' +
      '« espace » dans une déclaration du registre — un croisement par une clé AUTRE que celle ' +
      'de l’appariement, donc capable de rendre autre chose que zéro. Ceux-là, la garde les ' +
      'ACCUSE peut-être à tort : le geste est d’aller voir l’agent et de réparer l’APPARIEMENT. ' +
      'Un faux refus est un défaut de cette garde, pas un agent fautif. Ceux qu’elle n’a pas su ' +
      'mesurer ont leur PROPRE chiffre, sur la ligne suivante — un chiffre unique mêlerait deux ' +
      'natures qui n’appellent pas le même geste.',
    fauxRefusNonMesures:
      'parmi les NON MESURÉS, et parmi eux SEULEMENT : ceux dont l’espace de travail figure ' +
      'comme « espace » dans une déclaration du registre — MÊME croisement, MÊME règle de ' +
      'comparaison de l’espace que la ligne au-dessus. Ceux-là, la garde n’accuse personne : ' +
      'elle AVOUE ne pas savoir alors qu’une déclaration porte leur espace. Le geste est de ' +
      'réparer la MESURE, pas l’agent. Sans ce chiffre, un agent écarté par la couverture ' +
      'temporelle ne se voyait dans AUCUN compte : la garde en mal classait un pendant que son ' +
      'seul compteur de refus à tort rendait zéro.',
    identifies:
      'ventilés par la source qui les a identifiés — une seule suffit, et c’est la PREMIÈRE ' +
      'établie dans l’ordre déclaration › lieu de rôle. Les deux sont un ACTE POSÉ : une ' +
      'déclaration inscrite, ou un lieu de rôle posé sur le disque. La ventilation reste ' +
      'affichée parce que c’est elle qui a rendu le défaut lisible — un « rien à signaler » ' +
      'entièrement porté par une source faible ne vaut pas celui d’un parc déclaré.',
    // 🔴 CE QUE LA TOLÉRANCE LAISSE PASSER — et ce n'était dit NULLE PART : ni dans le module,
    // ni ici, ni ailleurs. Une garantie centrale dont le prix n'est écrit nulle part se lit
    // comme une garantie sans prix.
    couvertureTemporelle:
      `une déclaration identifie un agent tant que les deux dates ne s’écartent pas de plus de ` +
      `${Math.round(TOLERANCE_DE_DATATION_MS / 60000)} min, DES DEUX CÔTÉS. Pendant cette ` +
      'fenêtre, la garde ne sait PAS séparer « la mesure de la naissance retarde » de « c’est ' +
      'le successeur de celui qui est déclaré » : c’est le prix de la tolérance, et il est payé ' +
      'sciemment — sans elle, la garde refuserait les agents réguliers dont le transcrit tarde ' +
      `(relevé du ${RETARD_DE_MESURE_OBSERVE.leJour} : jusqu’à ` +
      `${Math.round(RETARD_DE_MESURE_OBSERVE.maximumMs / 1000)} s sur ` +
      `${RETARD_DE_MESURE_OBSERVE.transcrits} transcrits). La ligne « dont l’écart n’est pas ` +
      'expliqué » nomme ceux qui tombent DANS la fenêtre sans que le relevé les explique — ' +
      'les seuls sur qui ce doute porte réellement.',
    portee:
      `mesuré sur ${comptes.sessionsInterrogees - comptes.sessionsRefusees} session(s) herdr ` +
      `qui ont répondu, sur ${comptes.sessionsInterrogees} interrogée(s). Tous les comptes ` +
      'ci-dessus sont donc des PLANCHERS, jamais des totaux. Sur les ' +
      `${comptes.sessionsRefusees} qui ont refusé, ${comptes.sessionsRefusees - comptes.sessionsMuettes} ` +
      'n’avaient plus de serveur derrière leur socket — un socket qui a survécu à sa session ' +
      'n’a ni pane ni agent, il n’y a rien qu’on ait manqué de voir — et ' +
      `${comptes.sessionsMuettes} étaient là sans répondre : celles-là, on ne les a PAS mesurées, ` +
      'et le verdict le dit plutôt que de les couvrir d’un vert.',
  };

  return { verdict, sortie: SORTIES[verdict], prises, nonMesures, identifies, identifiesInexpliques, horsPortee, fauxRefus, fauxRefusNonMesures, sessionsMuettes, comptes, methode, texte: rendre({ verdict, prises, nonMesures, identifiesInexpliques, horsPortee, fauxRefus, fauxRefusNonMesures, sessionsMuettes, comptes, methode, miseEnService }) };
}

/** Le compte rendu, tel qu'un humain le lit. Chaque fautif y est NOMMÉ, jamais compté. */
function rendre({ verdict, prises, nonMesures, identifiesInexpliques = [], horsPortee, fauxRefus, fauxRefusNonMesures = [], sessionsMuettes = [], comptes, methode, miseEnService }) {
  const l = [];
  l.push(`GARDE DES NAISSANCES — ${verdict}`);
  l.push(`frontière : ${miseEnService} · parc vivant : ${comptes.parcVivant} · dans la population : ${comptes.population}`);
  l.push(`${methode.portee}`);
  l.push('');

  if (prises.length) {
    l.push(`🔴 ${prises.length} agent(s) né(s) APRÈS la mise en service et identifiable(s) par AUCUNE source :`);
    // ⚠️ UN PAR LIGNE, NOMMÉ. Un compte ne se corrige pas : on va voir un agent, pas un nombre.
    for (const p of prises) {
      l.push(
        `   • ${p.designation} — né le ${p.ne_le}${p.worktree ? ` — worktree ${p.worktree}` : ''} — ${p.espace}`
      );
      // ⚠️ SUR SA PROPRE LIGNE, PAS EN NOTE DE BAS DE PAGE. Celui-là, l'ancienne règle le
      // laissait passer ; qui ne saurait pas pourquoi son beau nom ne le sauve plus prendrait
      // la garde pour cassée — et la désarmerait avec les meilleures raisons du monde.
      if (p.nomConforme) l.push(`     ↳ ${NOM_CONFORME}`);
    }
    if (comptes.prisesAuNomConforme) {
      l.push(
        `   ⚠️ ${comptes.prisesAuNomConforme} de ces ${prises.length} prise(s) portent un nom CONFORME — ` +
          `et c'est justement la population visée : le nom d'un agent né par le dispositif EST le ` +
          `code de son mandat. Tant qu'il valait preuve, retirer une déclaration ne pouvait pas ` +
          `faire rougir cette garde.`
      );
    }
    l.push('');
  }
  if (nonMesures.length) {
    l.push(`⚠️ ${nonMesures.length} agent(s) que je n’ai PAS PU mesurer — ce n’est pas « rien à signaler » :`);
    for (const n of nonMesures) l.push(`   • ${n.designation} — ${n.raisons.join(' ; ')}`);
    l.push('');
  }
  if (sessionsMuettes.length) {
    // ⚠️ NOMMÉES, COMME LES AGENTS. Un compte ne se refait pas : on relance une mesure sur une
    // session précise. Le lecteur doit savoir LAQUELLE, et pourquoi elle n'a pas répondu.
    l.push(`⚠️ ${sessionsMuettes.length} session(s) herdr étaient LÀ sans répondre — ce n’est pas « rien à signaler » :`);
    for (const s of sessionsMuettes) {
      l.push(`   • ${s?.session ?? '(session sans nom)'} — ${String(s?.raison ?? 'refus sans raison donnée').split('\n')[0]}`);
    }
    l.push('');
  }
  if (horsPortee.length) {
    // La borne se VOIT. Une borne silencieuse est un trou : le lecteur doit savoir combien
    // d'agents cette garde ne juge PAS, et pourquoi.
    l.push(`hors portée (${horsPortee.length}) — la borne de cette garde, dite plutôt que tue :`);
    for (const h of horsPortee) l.push(`   · ${h.designation} — ${h.raison}`);
    l.push('');
  }
  if (fauxRefus.length) {
    l.push(`⚠️ ${fauxRefus.length} de ces prises l’ont peut-être été À TORT — une déclaration porte leur espace de travail :`);
    for (const f of fauxRefus) l.push(`   • ${f.designation} — ${f.espace}`);
    l.push('');
  }
  // ⚠️ NOMMÉS, EUX AUSSI, ET DANS LEUR PROPRE BLOC. La garde ne les accuse pas — elle a dit ne
  // pas savoir alors qu'une déclaration porte leur espace. Un compte ne se répare pas : on va
  // voir une MESURE précise, sur un agent précis.
  if (fauxRefusNonMesures.length) {
    l.push(`⚠️ ${fauxRefusNonMesures.length} de ces agents NON MESURÉS l’ont peut-être été À TORT — une déclaration porte leur espace de travail :`);
    for (const f of fauxRefusNonMesures) l.push(`   • ${f.designation} — ${f.espace}`);
    l.push('');
  }

  if (Object.keys(comptes.parSource).length) {
    l.push(`identifiés (${comptes.identifies}) — sur quoi ce verdict repose :`);
    for (const [source, n] of Object.entries(comptes.parSource)) l.push(`   · ${source} : ${n}`);
    l.push(`   ${methode.identifies}`);
    // 🔴 LE SEUL SOUS-ENSEMBLE DOUTEUX DES IDENTIFIÉS, ET IL EST NOMMÉ — pas compté. Un chiffre
    // seul enverrait chercher dans tout le parc ; ces agents-là sont adressables.
    if (identifiesInexpliques.length) {
      l.push(
        `   dont l’écart de datation n’est PAS expliqué par le relevé du poste ` +
          `(${identifiesInexpliques.length}) — la tolérance seule les retient :`
      );
      for (const i of identifiesInexpliques) {
        const sens = i.ecart > 0 ? 'né APRÈS sa déclaration' : 'né AVANT sa déclaration';
        l.push(`      • ${i.designation} — ${Math.round(Math.abs(i.ecart) / 1000)} s, ${sens}${i.espace ? ` — ${i.espace}` : ''}`);
      }
    }
    l.push(`   ${methode.couvertureTemporelle}`);
    l.push('');
  }
  l.push(`prises : ${comptes.prises} — méthode : ${methode.prises}`);
  // 🔴 CHAQUE CHIFFRE PORTE SA POPULATION DANS SON ÉTIQUETTE. « refus à tort (mesurés) : 0 »
  // se lisait « la garde n'en fait aucun » — alors qu'il ne comptait que les prises, et qu'un
  // agent mal classé chez les NON MESURÉS était nommé douze lignes plus haut. Un chiffre juste
  // dans une phrase fausse : le lecteur devait tout remesurer pour s'en apercevoir.
  l.push(`refus à tort — parmi les PRISES, que la garde ACCUSE : ${comptes.fauxRefus} — méthode : ${methode.fauxRefus}`);
  l.push(`refus à tort — parmi les NON MESURÉS, sur qui elle SE TAIT : ${comptes.fauxRefusNonMesures} — méthode : ${methode.fauxRefusNonMesures}`);
  return l.join('\n');
}

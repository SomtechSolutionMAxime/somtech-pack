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
// déclarations. Ce fait existe : `claude-swt` inscrit l'horodatage de naissance dans le NOM du
// répertoire de travail (`~/worktrees/<dépôt>/20260825-083616`). Il survit au retrait de la
// déclaration, il ne se lit dans aucun registre, et il ne peut pas être « oublié » — l'agent
// travaille dedans.
//
// **La population de la garde est donc : les agents vivants dont l'espace de travail porte un
// horodatage de naissance postérieur à la MISE EN SERVICE du dispositif.** Après cette date,
// naître hors dispositif EST ce qu'on veut attraper.
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
// déclaration à un agent dont le pane a bougé : un nom NON MESURÉ rend donc la déclaration
// « refusée », jamais « absente ». ② Il se DIT sur la ligne de chaque prise qui en porte un —
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
//   ① **UN SEUL PRÉDICAT, TOTAL.** Être dans la population ne dépend que de l'horodatage porté
//      par le chemin de travail. Ni le nom, ni le rôle, ni le mandat, ni la session, ni le
//      statut n'entrent dans ce jugement. Un banc le prouve par VARIATION : il fait varier
//      CHAQUE autre champ du dossier d'un agent et exige que le verdict ne bouge pas.
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
 * ⚠️ ET `null` NE VEUT PAS DIRE « ANCIEN ». Mesuré sur le parc réel le 2026-08-25 : 13 agents
 * vivants sur 80 travaillent dans un worktree que son nom ne date pas (`t-0043`, `20260818-e3`),
 * et 32 de plus ne sont dans aucun worktree. Les traduire en « né avant » les ferait passer au
 * vert par un chemin que rien n'annonce — la borne deviendrait un trou.
 */
export function horodatageDuChemin(chemin) {
  if (!chemin) return null;
  const morceaux = String(chemin).split('/');
  for (let i = morceaux.length - 1; i >= 0; i -= 1) {
    if (HORODATAGE.test(morceaux[i])) return morceaux[i];
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
export function normaliserLeParc({ panes = [], agentsHerdr = null } = {}) {
  const cle = (p) => `${p?.herdr_socket ?? ''} ${p?.pane_id}`;
  const nomsConnus = agentsHerdr
    ? { mesure: 'lue', noms: new Map(agentsHerdr.map((a) => [cle(a), a?.name ?? null])) }
    : { mesure: 'refusée', raison: 'le registre des agents ne m’a pas été donné' };

  return panes
    // Un pane sans session d'agent est un shell : personne n'y est né, personne n'y travaille.
    .filter((p) => Boolean(p?.agent_session))
    .map((p) => ({
      pane: p.pane_id,
      session: p.herdr_socket ?? null,
      // Le worktree est `foreground_cwd`, pas `cwd` : un agent né par `claude-swt` garde le
      // dépôt principal en `cwd` pendant que son travail vit ailleurs.
      espace: p.foreground_cwd || p.cwd || null,
      nom: nomDeLAgent(p, cle(p), nomsConnus),
    }));
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
    (session === null
      ? null
      : declarations.find(
          (d) => d?.pane && d.pane === agent.pane && identiteDeSession(d.session_herdr) === session
        )) ||
    (nom ? declarations.find((d) => d?.nom === nom) : null) ||
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
function sourcesDe(agent, { declarations, illisibles, roleDuLieu }) {
  const decl = declarationDe(agent, declarations);
  // ⚠️ LE NOM EST LA CLÉ DE REPLI DE L'APPARIEMENT (voir `declarationDe`) : un agent dont le
  // pane a bougé n'est retrouvé que par lui. Un nom NON MESURÉ rend donc la déclaration
  // « refusée », jamais « absente » — sinon `agent list`, mesuré à 83 panes sur 227 un jour,
  // suffirait à transformer des agents déclarés en prises par simple panne de lecture.
  const nomNonMesure = agent.nom?.mesure === 'refusée';
  const source1 = decl
    ? { etat: 'établi', quoi: SOURCES.DECLARATION, detail: decl }
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
} = {}) {
  const declarations = registre?.declarations ?? [];
  const illisibles = registre?.illisibles ?? [];
  const frontiere = verifierLaFrontiere(declarations, miseEnService);

  const horsPortee = [];
  const identifies = [];
  const prises = [];
  const nonMesures = [];

  for (const a of agents) {
    const designation = designationDe(a);
    const horodatage = horodatageDuChemin(a.espace);

    // ── ① LE PRÉDICAT DE POPULATION, ET IL N'A QU'UN SEUL TERME.
    // Rien d'autre que l'horodatage du chemin n'entre ici. Pas le nom, pas le rôle, pas le
    // mandat, pas la session, pas le statut. C'est ce qui rend le dénominateur épinglé plutôt
    // qu'ouvert : il n'y a aucun endroit où glisser « sauf celui-là ».
    if (!horodatage) {
      horsPortee.push({ designation, espace: a.espace, raison: 'aucun horodatage de naissance dans son espace de travail' });
      continue;
    }
    if (instantDeLHorodatage(horodatage).getTime() < frontiere.getTime()) {
      horsPortee.push({ designation, espace: a.espace, raison: 'né avant la mise en service du dispositif' });
      continue;
    }

    const { sources, nomConforme } = sourcesDe(a, { declarations, illisibles, roleDuLieu });
    const etablie = sources.find((s) => s.etat === 'établi');
    if (etablie) {
      identifies.push({ designation, source: etablie.quoi });
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
    prises.push({ designation, espace: a.espace, ne_le: horodatage, nomConforme });
  }

  // ── LE FAUX REFUS, MESURÉ PAR UNE AUTRE CLÉ QUE CELLE DE L'APPARIEMENT.
  //
  // ⚠️ LE MESURER AVEC LA CLÉ QUI A SERVI À APPARIER LE RENDRAIT NUL PAR CONSTRUCTION — un
  // chiffre juste, tautologique, et donc invérifiable. On croise donc par l'ESPACE DE TRAVAIL :
  // une déclaration qui porte l'espace d'un agent pris prouve qu'une naissance a bien eu lieu
  // là, et que c'est l'APPARIEMENT qui a raté. C'est un défaut de cette garde, et il doit se
  // voir dans sa propre sortie plutôt que d'attendre qu'un humain le trouve.
  const espacesDeclares = new Set(declarations.map((d) => d?.espace).filter(Boolean));
  const fauxRefus = prises.filter((p) => espacesDeclares.has(p.espace));

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

  const comptes = {
    parSource,
    parcVivant: agents.length,
    horsPortee: horsPortee.length,
    population: identifies.length + prises.length + nonMesures.length,
    identifies: identifies.length,
    prises: prises.length,
    // ⚠️ LE PRIX DE LA CORRECTION, RENDU EN CHIFFRE. Ces prises-là, l'ancienne règle les tenait
    // pour identifiées. C'est le seul endroit où le lecteur voit ce que le changement a
    // basculé — et le seul chiffre à surveiller si quelqu'un croit la garde trop bruyante.
    // Ce n'est PAS un panier : un sous-ensemble des prises, il ne touche pas l'équilibre.
    prisesAuNomConforme: prises.filter((p) => p.nomConforme).length,
    nonMesures: nonMesures.length,
    fauxRefus: fauxRefus.length,
    sessionsInterrogees: portee?.sessionsInterrogees ?? 0,
    sessionsRefusees: (portee?.sessionsRefusees ?? []).length,
  };

  // ── ② LES COMPTES BALANCENT — voir l'en-tête. C'est ici qu'une exception muette se casse.
  if (
    comptes.parcVivant !== comptes.horsPortee + comptes.population ||
    comptes.population !== comptes.identifies + comptes.prises + comptes.nonMesures
  ) {
    throw new ComptesQuiNeBalancentPas(comptes);
  }

  const verdict = prises.length
    ? VERDICTS.NES_HORS_DISPOSITIF
    : nonMesures.length
      ? VERDICTS.ZONES_NON_MESUREES
      : VERDICTS.RIEN_A_SIGNALER;

  const methode = {
    prises:
      'un agent VIVANT dont l’espace de travail porte un horodatage de naissance postérieur à ' +
      `« ${miseEnService} », et qu’AUCUNE des DEUX sources n’identifie — ni une déclaration ` +
      '(appariée par pane-dans-sa-session, ou à défaut par nom ; la session se compare par son ' +
      'NOM, celui que la déclaration inscrit et que le socket du pane porte dans son chemin — ' +
      'une session que rien ne nomme n’apparie personne par le pane), ni un lieu de rôle ' +
      'établi sur disque. ' +
      'Son NOM n’entre pas dans ce jugement, si conforme soit-il : le nom d’un agent né par le ' +
      'dispositif est le code de son mandat, donc toujours conforme — l’accepter comme preuve ' +
      'rendait la branche « déclaration retirée » incapable de rougir pour la population même ' +
      'que cette garde vise.',
    fauxRefus:
      'parmi les prises, ceux dont l’espace de travail figure comme « espace » dans une ' +
      'déclaration du registre — un croisement par une clé AUTRE que celle de l’appariement, ' +
      'donc capable de rendre autre chose que zéro. Un faux refus est un défaut de cette ' +
      'garde, pas un agent fautif.',
    identifies:
      'ventilés par la source qui les a identifiés — une seule suffit, et c’est la PREMIÈRE ' +
      'établie dans l’ordre déclaration › lieu de rôle. Les deux sont un ACTE POSÉ : une ' +
      'déclaration inscrite, ou un lieu de rôle posé sur le disque. La ventilation reste ' +
      'affichée parce que c’est elle qui a rendu le défaut lisible — un « rien à signaler » ' +
      'entièrement porté par une source faible ne vaut pas celui d’un parc déclaré.',
    portee:
      `mesuré sur ${comptes.sessionsInterrogees - comptes.sessionsRefusees} session(s) herdr ` +
      `qui ont répondu, sur ${comptes.sessionsInterrogees} interrogée(s). Tous les comptes ` +
      'ci-dessus sont donc des PLANCHERS, jamais des totaux.',
  };

  return { verdict, sortie: SORTIES[verdict], prises, nonMesures, identifies, horsPortee, fauxRefus, comptes, methode, texte: rendre({ verdict, prises, nonMesures, horsPortee, fauxRefus, comptes, methode, miseEnService }) };
}

/** Le compte rendu, tel qu'un humain le lit. Chaque fautif y est NOMMÉ, jamais compté. */
function rendre({ verdict, prises, nonMesures, horsPortee, fauxRefus, comptes, methode, miseEnService }) {
  const l = [];
  l.push(`GARDE DES NAISSANCES — ${verdict}`);
  l.push(`frontière : ${miseEnService} · parc vivant : ${comptes.parcVivant} · dans la population : ${comptes.population}`);
  l.push(`${methode.portee}`);
  l.push('');

  if (prises.length) {
    l.push(`🔴 ${prises.length} agent(s) né(s) APRÈS la mise en service et identifiable(s) par AUCUNE source :`);
    // ⚠️ UN PAR LIGNE, NOMMÉ. Un compte ne se corrige pas : on va voir un agent, pas un nombre.
    for (const p of prises) {
      l.push(`   • ${p.designation} — worktree né le ${p.ne_le} — ${p.espace}`);
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

  if (Object.keys(comptes.parSource).length) {
    l.push(`identifiés (${comptes.identifies}) — sur quoi ce verdict repose :`);
    for (const [source, n] of Object.entries(comptes.parSource)) l.push(`   · ${source} : ${n}`);
    l.push(`   ${methode.identifies}`);
    l.push('');
  }
  l.push(`prises : ${comptes.prises} — méthode : ${methode.prises}`);
  l.push(`refus à tort (mesurés) : ${comptes.fauxRefus} — méthode : ${methode.fauxRefus}`);
  return l.join('\n');
}

// Les contrôles du métier de l'orchestrateur, et les mutations qui les mettent à l'épreuve.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER N'EST PAS UN TEST
//
// Il est importé par DEUX suites qui ne demandent pas la même chose aux mêmes contrôles :
//
//   • `orchestrateur-gabarit.test.js` les exécute sur le gabarit RÉEL — ils doivent passer ;
//   • `orchestrateur-mutations.test.js` les exécute sur des versions RETOURNÉES du gabarit —
//     et exige que le contrôle VISÉ rougisse, pour chacune.
//
// Les primitives de lecture de structure viennent de `metier-representant.js` : elles ont
// résisté à quatre passes de revue sur le lot jumeau, chacune ayant trouvé un cran plus fin
// du même défaut (garder un MOT, puis une POSITION, puis une MENTION, puis un MOT-CLÉ dans
// un libellé de colonne). Les réinventer moins bien ici aurait été la cinquième.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUE CE LOT DÉPLACE, ET CE QU'IL AJOUTE — LA DISTINCTION EST GARDÉE MÉCANIQUEMENT
//
// Le métier de l'orchestrateur est écrit, éprouvé et payé : chaque phrase de la compétence
// vient soit d'un défaut trouvé en production, soit d'un rappel du dirigeant. Ce lot le
// DÉPLACE d'une compétence (lue une fois au démarrage) vers un `CLAUDE.md` (relu à chaque
// échange). Il ne le rejuge pas.
//
// Le contrôle `le-metier-a-voyage-entier` en fait une garantie mécanique plutôt qu'une
// promesse : chaque section de la compétence doit exister dans le gabarit, avec un corps
// IDENTIQUE OCTET POUR OCTET — sauf les deux endroits nommément amendés. Une réécriture
// silencieuse, si petite soit-elle, rougit.
//
// C'est la garde qui manquait au lot du gestionnaire, où la même consigne — « on le déplace,
// on ne le réécrit pas » — n'a pas empêché une réécriture d'effacer une garantie livrée la
// veille.
//
// LES SEPT AJOUTS, liste fermée énoncée par le dirigeant :
//   1. il appelle les agents spécialisés (consulter, jamais sous-traiter) ;
//   2. il parle au dirigeant ;
//   3. sa ligne directe est OBLIGATOIRE — et cet ajout est un RETRAIT ;
//   4. il veille ses agents toutes les heures, par défaut ;
//   5. il pose un topo sur son canal chaque matin à 7 h 00 ;
//   6. il est le gardien des ADR et des bonnes pratiques de développement ;
//   7. il se sert des mémoires disponibles (2026-08-13, pendant le lot 2).
//
// Le septième est arrivé APRÈS la fusion du lot 1 : il est donc porté ici, dans le lot qui
// pose le lieu. Sa source normative est STD-039 (`accepted`), lue à la source plutôt que
// citée de mémoire — ce qui est, précisément, ce que l'ajout demande à l'orchestrateur.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REPO, sections, sectionDe, tableDe, colonne, colonneDe, pucesDe, blocsBash, enteteDe,
  exigeImperatif, exigePolarite, permuter,
} from './metier-representant.js';

export { REPO, permuter };

const HERE = dirname(fileURLToPath(import.meta.url));
assert.equal(resolve(HERE, '..', '..', '..'), REPO, 'la racine du dépôt a bougé');

/** Le lieu d'où le pack distribue les gabarits de l'orchestrateur (module `core`). */
export const GABARIT_DIR = join('.claude', 'templates', 'orchestrateur');
export const CHEMIN_METIER = join(GABARIT_DIR, 'CLAUDE.md');
export const CHEMIN_CONTEXTE = join(GABARIT_DIR, 'CONTEXTE.md');
/** Les deux autres fichiers du lieu, posés par le lot qui pose (E-20260813-0002). */
export const CHEMIN_MCP = join(GABARIT_DIR, '.mcp.json');
export const CHEMIN_PERMISSIONS = join(GABARIT_DIR, '.claude', 'settings.json');

/** La compétence dont ce lot déplace le métier. Elle survit jusqu'au lot qui la remplacera. */
export const CHEMIN_COMPETENCE = join('.claude', 'skills', 'orchestrer-chantier', 'SKILL.md');

export function lireGabarits(racine = REPO) {
  return {
    metier: readFileSync(join(racine, CHEMIN_METIER), 'utf8'),
    contexte: readFileSync(join(racine, CHEMIN_CONTEXTE), 'utf8'),
    // Le fichier de DROITS est lu comme les deux autres, et pour la même raison : il est
    // devenu porteur d'une garantie du métier (T-20260813-0062). Un texte qui promet « je ne
    // peux pas écrire » pendant que le fichier l'autorise est le pire des deux mondes — une
    // garantie fausse. Les contrôles apparient donc les deux.
    droits: readFileSync(join(racine, CHEMIN_PERMISSIONS), 'utf8'),
    // La COMPÉTENCE est lue ici depuis le 2026-08-17 (lot 2). Elle l'était auparavant en
    // direct, à l'intérieur des contrôles, ce qui la mettait hors d'atteinte du harnais de
    // mutation : aucune mutation ne pouvait la retourner, donc rien ne prouvait que les
    // gardes qui s'appuient dessus tiennent. Elle passe par ici pour être mutable comme les
    // trois autres.
    competence: readFileSync(join(racine, CHEMIN_COMPETENCE), 'utf8'),
  };
}

/** Les paragraphes d'un texte — un bloc séparé des autres par une ligne vide. */
export const parasDe = (t) => t.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 40);

/** Une sonde ancrée sur un titre de section littéral (les titres portent des points). */
const titre = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ICI VIVAIENT `SECTIONS_AMENDEES` ET `AMENDEMENTS_DU_LOT`, ET VOICI POURQUOI ELLES
// N'Y VIVENT PLUS (lot 2, 2026-08-17).
//
// Les deux listes ne servaient qu'à la comparaison OCTET POUR OCTET entre la compétence
// `/orchestrer-chantier` et le gabarit :
//
//   • `SECTIONS_AMENDEES` nommait les sections que le lot avait le droit de réécrire, et le
//     motif de chacune — un ENGAGEMENT plutôt qu'une constatation : élargir ce qu'on
//     s'autorise demandait d'éditer la liste, ce qui se voyait en revue.
//   • `AMENDEMENTS_DU_LOT` fermait le trou de cette exemption, découvert par la passe 2 du
//     lot précédent : exempter une section la sortait de TOUTE garde, bien au-delà de
//     l'amendement voulu — deux lignes d'origine et un paragraphe entier avaient disparu
//     sans une rougeur. La garde qui tenait était l'inclusion littérale de ce qui devait
//     rester, plus la déclaration nommée de ce qui partait.
//
// **Leur objet a disparu avec la comparaison.** La réécriture du gabarit par la fonction
// (`D-20260817-0006`) laisse **0 section identique sur 24** : il n'y a plus de corps à
// comparer, donc plus rien à exempter d'une comparaison qui n'a plus lieu. Les garder
// vivantes ferait croire qu'un engagement tient encore alors qu'il ne porte plus sur rien —
// exactement le faux témoin que ce harnais combat.
//
// **Ce qu'elles gardaient, et où c'est passé** : voir le pavé de `la-competence-reste-invocable`,
// qui redistribue nommément la couverture de la comparaison. La divergence elle-même est
// tracée en `T-20260817-0081`.
//
// ⚠️ **La leçon qu'elles portaient, elle, reste vraie et ne doit pas partir avec elles** :
// une exemption inscrite quelque part met la chose exemptée hors de TOUTE garde, pas
// seulement hors de celle qu'on visait. Toute liste d'exceptions écrite dans ce fichier
// doit être relue avec cette question-là.
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Les endroits du métier où un message PART vers le dirigeant — donc où la formule de fin
 * (« J'ai besoin de toi : ») doit être rappelée, sous peine de redevenir la rubrique d'un
 * seul geste. T-20260817-0016.
 *
 * ⚠️ CETTE LISTE EST LA GARDE, PAS UNE DOCUMENTATION. La première version du lot ne
 * vérifiait que deux de ces endroits, alors que le texte s'en déclarait cinq : retirer le
 * rappel du bilan de clôture laissait le contrôle vert. Ajouter ici un endroit qu'on écrit
 * dans le métier est ce qui empêche l'écart de se rouvrir en silence.
 *
 * ⚠️ LES SONDES ONT ÉTÉ RÉ-ANCRÉES SUR LES TITRES RÉELS (réécriture par la fonction,
 * 2026-08-17) : la numérotation `§1-bis … §8` a disparu au profit des blocs `R1 … R7`. Les
 * ENDROITS n'ont pas bougé — ce sont les cinq mêmes surfaces —, seul le titre sous lequel
 * chacun vit a changé. Sans ce ré-ancrage, la garde échouait sur « section introuvable » et
 * son rejet n'apprenait rien de la garantie ; ré-ancrée, elle dit lequel des cinq a perdu son
 * rappel. C'est un déplacement de sonde, jamais un assouplissement : la liste compte toujours
 * cinq entrées et le contrôle les exige toutes.
 */
export const ENDROITS_OU_UN_MESSAGE_SE_FABRIQUE = [
  // ⚠️ La sonde ne tient pas à l'adjectif : « Ta ligne est **requise** » dit la même chose
  // avec la même force, et faisait rougir cette garde (banc de faux positifs, lot 2). Ce
  // qu'on désigne, c'est la section qui AFFIRME quelque chose de ta ligne.
  { quoi: 'ta ligne avec le CTO', sonde: /^Ta ligne (?:est|reste|demeure)\b/i },
  { quoi: 'le topo du matin', sonde: /Le topo du matin/i },
  { quoi: 'ce que tu lui renvoies quand tu ne tranches pas', sonde: /Ce que tu fais monter, et ce que tu tranches/i },
  { quoi: 'le compte rendu d’avancement sur le chantier', sonde: /Tenir le ServiceDesk/i },
  { quoi: 'le bilan de clôture', sonde: /^Clore$/i },
];

/** La phrase que l'ajout 3 RETIRE. Un retrait se défait par mégarde plus facilement qu'un ajout. */
export const PHRASE_RETIREE = 'continue sans elle';

/**
 * Combien d'anti-patterns le gabarit ajoute à ceux du métier — un par ajout qui en appelle un,
 * et pas un de plus. Le nombre est écrit ici pour qu'en ajouter un sixième demande d'éditer
 * cette ligne : la liste des ajouts est fermée, et une idée de plus se voit alors en revue.
 */
export const NB_ANTI_PATTERNS = 69;
// ⚠️ CE NOMBRE A CHANGÉ DE NATURE LE 2026-08-17 (lot 2), ET LE MOTIF EST ICI.
//
// Il s'appelait `NB_ANTI_PATTERNS_AJOUTES` et valait 29 : le nombre de lignes que le gabarit
// AJOUTAIT à la table de la compétence. Ce compte se prenait donc sur un autre texte — et cet
// autre texte a été réécrit sur ordre (`D-20260817-0006`) : 28 de ses 35 lignes ont été
// reformulées, la différence ne mesure plus rien. Un compte dont la référence bouge est un
// compte qui se desserre tout seul.
//
// Il compte désormais la table du gabarit POUR ELLE-MÊME. La fonction gardée est exactement la
// même — en retirer une ligne rougit, en glisser une aussi — et elle n'a plus de prémisse à
// laquelle retomber. Tenu par `la-table-des-anti-patterns-est-une-liste-fermee`.
//
// ⚠️ Si tu ajoutes un anti-pattern, tu édites ce nombre, et ça se voit en revue. C'est tout
// l'intérêt : une idée de plus ne se glisse pas dans le texte en silence.
//
// ⚠️⚠️ ET CE QUE CE NOMBRE NE RATTRAPE PAS — écrit ici pour qu'il ne blanchisse rien.
//
// Une relecture indépendante l'a relevé contre ce chiffre même : poser `69` sur la table
// TELLE QU'ELLE EST rend invisibles les retraits déjà faits. La garde est vraie **à partir
// de maintenant** ; elle ne l'a pas été pour la réécriture qui a fixé le nombre. La table
// est passée de 64 à 69 lignes, et ce n'est pas +5 : c'est un solde. Mesuré ligne à ligne
// entre `878f9d5` (avant la reconstruction) et `f0fa26b`, **six anti-patterns ont disparu
// de la table SANS laisser une seule trace ailleurs dans le gabarit** :
//
//   • « Accrocher la dette du review à l'epic livré »
//   • « Déclarer une attente causée par une autre application »
//   • « Faire travailler deux de tes chefs d'équipe en même temps »
//   • « Inventer un nom d'agent “plus parlant” »
//   • « Mettre deux agents dans le même worktree »
//   • « Attendre passivement l'état d'un agent »
//
// Et deux autres ont perdu leur ligne en gardant la règle en prose — la faute n'est donc
// plus nommée comme faute : les noms d'agents sensibles à la casse (règle en l. 389) et
// « oui, et ne redemande plus » (règle en l. 521).
//
// Le gabarit est GELÉ pour ce lot : ces huit-là se remontent, elles ne se réparent pas ici.
// Elles sont au ServiceDesk plutôt que dans ce commentaire seul.
// 11 → 23 le 2026-08-16 (T-20260816-0099, T-20260816-0097, T-20260816-0018). Les douze qui
// s'ajoutent sont le miroir des garanties de cette version, une par garantie et pas une de plus :
//
//   • le grain du compte rendu (backlog = les Demandes) ;
//   • l'analyse ajoutée à une question fermée, ET SON REVERS — répondre en liste quand une
//     analyse est demandée ;
//   • la production cliente non mesurée avant le geste ;
//   • la relance faite sans avoir regardé sa propre boîte ;
//   • la récolte prise pour une solution complète ;
//   • l'erreur qu'on tait ;
//   • les agents `done` dont on ne tire rien, le lot de plus démarré pendant qu'on attend un
//     arbitrage, la reprise décidée au grain du ticket, la ronde terminée sans inscrire ;
//   • le critère faux des lignes ambiguës (« même destinataire »).
//
// ⚠️ Le REVERS de la concision est celui qu'on aurait oublié, et c'est justement lui qui fait
// la moitié exigée par la preuve du ticket : une version qui apprend à répondre court sans dire
// qu'on répond long quand on demande long aurait déplacé le défaut au lieu de le corriger.

/**
 * Tournures qui transforment une CONTRAINTE en CONSEIL sans la retirer.
 *
 * `PERMISSIF` (partagé avec le harnais du représentant) attrape la permission, l'exception et
 * la nécessité niée. Il manque la troisième porte, et c'est celle que ce lot combat : le
 * conseil bienveillant. « Évite de valider un compte rendu que tu n'as pas vérifié » ne
 * demande aucune permission, n'ouvre aucune exception, ne nie aucune nécessité — et ne
 * contraint plus rien. Un agent le lit comme une préférence de style.
 *
 * Elle est écrite ICI plutôt que dans le harnais partagé, à dessein : celui-ci est commun aux
 * deux métiers et ce lot n'a pas mandat de le changer. Le manque y est réel, et il est
 * remonté au registre plutôt que corrigé de la main d'un lot qui ne le porte pas.
 */
export const CONSEIL = /\bévite(?:r|z)? de\b|\bessaie de\b|\bidéalement\b|\btu devrais\b|\bil vaut mieux\b|\bpense à\b|\bn'hésite pas\b|\bmieux vaut\b|\bon recommande\b|\bil est conseillé\b/i;

/** Exige qu'un énoncé CONTRAIGNE : ni assoupli en permission, ni retombé en conseil. */
export function exigeContrainte(enonce, quoi) {
  exigeImperatif(enonce, quoi);
  const conseil = enonce.match(CONSEIL);
  assert.ok(
    !conseil,
    `« ${quoi} » est retombé au rang de conseil (« ${conseil && conseil[0]} ») : une contrainte `
      + `qui se contente de conseiller ne contraint plus rien — « ${enonce.trim()} »`,
  );
}

// ═════════════════════════════════════════ les contrôles

export const CONTROLES = [
  // ═══════════════════════════════════════════════════════════════════════════════════
  // ⚠️ ICI VIVAIT `le-metier-a-voyage-entier`, ET VOICI POURQUOI IL N'Y VIT PLUS.
  //
  // Il comparait chaque section de la compétence `/orchestrer-chantier` au gabarit, **corps
  // contre corps, octet pour octet** — la garantie mécanique que le métier avait été DÉPLACÉ
  // et non réécrit. C'était la garde qui manquait au lot du gestionnaire, où la même consigne
  // n'avait pas empêché une réécriture d'effacer une garantie livrée la veille.
  //
  // **Sa prémisse est tombée, et elle est tombée sur ordre.** La réécriture du gabarit par la
  // fonction (`D-20260817-0006`) réorganise le texte en blocs `R1`-`R7`. Mesuré le 2026-08-17
  // sur `e35bec4` : **0 section identique sur 24**, 4 réécrites, 20 absentes, 28 lignes
  // d'anti-patterns sur 35 reformulées. Il ne reste rien à comparer.
  //
  // **La décision** (coordonnateur `d-20260817-0006`, 2026-08-17) : la compétence est **hors
  // périmètre** de cette demande — elle « survit jusqu'au lot qui la remplacera » — et le
  // métier dit lui-même qu'**un orchestrateur ne lit pas le `SKILL.md`** : elle ne gouverne
  // rien. La garde ne peut donc plus exiger l'égalité. Elle garde ce qui reste vrai : que la
  // compétence **existe et reste invocable**. Rien de plus, et c'est écrit plutôt que tu.
  //
  // ⚠️ **LA DIVERGENCE NE SE PERD PAS** : elle a son ticket, `T-20260817-0081`. Ce qui sort
  // d'un texte se nomme avec sa destination.
  //
  // ⚠️ **OÙ EST PASSÉE LA COUVERTURE QU'IL APPORTAIT** — la seule question qui compte, parce
  // qu'un retrait sans cette réponse est une perte déguisée en ménage :
  //
  //   • le préambule et ses deux principes fondateurs (« un agent qui orchestre n'exécute
  //     jamais », « il ne déploie que des chefs d'équipe ») + le « tu ne codes pas »
  //         → `il-orchestre-il-n-execute-pas`, qui les garde sur le gabarit SEUL ;
  //   • « Le niveau se lit dans le rôle, jamais dans un seuil » — le seuil retiré par le CTO,
  //     que RIEN d'autre ne gardait
  //         → `le-niveau-se-lit-dans-le-role`, créé ici même pour le recueillir ;
  //   • la table d'anti-patterns : aucune ligne retirée en silence, et les ajouts en liste
  //     fermée — gardés jusqu'ici par différence avec la table de la compétence
  //         → `la-table-des-anti-patterns-est-une-liste-fermee`, qui compte la table du
  //           gabarit pour elle-même, donc sans prémisse à retomber ;
  //   • les paragraphes de la section qui ouvre la ligne → `ligne-obligatoire` ;
  //   • le corps de chaque autre section → les cinquante contrôles par la fonction de ce
  //     fichier : c'est précisément le chantier que cette demande a payé.
  // ═══════════════════════════════════════════════════════════════════════════════════
  {
    id: 'la-competence-reste-invocable',
    quoi: 'la compétence /orchestrer-chantier existe encore et s’invoque encore — elle ne gouverne rien, mais elle ne disparaît pas en silence',
    verifier({ competence }) {
      // Ce que cette garde peut encore prouver, la prémisse de l'égalité étant tombée : que
      // le lot n'a pas fait disparaître la compétence, ni ne l'a vidée en la « déplaçant ».
      // Deux gardes s'appuient encore sur son CONTENU — `gestes-de-session-existants` y lit
      // les formes `herdr` réellement employées — donc la vider désarmerait autre chose
      // qu'elle-même, et sans un mot.
      assert.match(
        competence, /^---\nname: orchestrer-chantier\n/,
        'la compétence a perdu son en-tête : elle ne s’invoquerait plus, et un texte qu’on ne '
          + 'peut plus appeler est retiré sans que son retrait soit décidé',
      );
      assert.ok(
        competence.length > 20000,
        `la compétence ne fait plus que ${competence.length} caractères : elle a été vidée en `
          + `étant « déplacée », et \`gestes-de-session-existants\` lit encore ses blocs de `
          + `commandes comme référence — la vider désarme une autre garde, en silence`,
      );
    },
  },

  {
    id: 'le-niveau-se-lit-dans-le-role',
    quoi: 'aucun seuil ne décide s’il faut un chef d’équipe — le niveau se lit dans le rôle, et la question ne se pose pas',
    verifier({ metier }) {
      // ⚠️ CETTE GARDE EST NÉE D'UN RETRAIT (lot 2, 2026-08-17). La garantie vivait dans la
      // comparaison octet pour octet avec la compétence : retirer celle-ci l'aurait emportée
      // avec elle, et c'est le seul endroit du métier où le CTO a RETIRÉ un seuil. Un retrait
      // se défait d'un copier-coller malheureux, sans que personne le remarque — c'est la
      // même fragilité que la phrase « continue sans elle » de `ligne-obligatoire`.
      // ⚠️ LA SONDE CHERCHE LE LIEU OÙ LA RÈGLE SERT, PAS CELUI OÙ ON L'ATTENDAIT. Écrite
      // d'abord sur « Dimensionner — la règle qui décide de tout », elle rougissait : cette
      // section-là dit COMBIEN d'agents ouvrir, pas ce qui fait d'un agent un chef d'équipe.
      // Le seuil retiré se lit là où les niveaux se définissent, et c'est le bon endroit.
      const s = sectionDe(metier, /^Les trois niveaux$/i, 'qui définit les trois niveaux');
      exigePolarite(
        s.corps, /jamais dans un seuil/i,
        'le niveau se lit dans le RÔLE, jamais dans un seuil',
        // ⚠️ L'INVERSE VISE LA FORME PRESCRIPTIVE, ET SEULEMENT ELLE. Une première version
        // cherchait aussi « deux périmètres parallèles » — la section RACONTE le seuil retiré
        // (« Elle s'est posée un temps, sous forme de seuil — *deux périmètres parallèles,
        // cinq agents* ») et la garde criait sur du texte correct. Une garde qui crie à tort
        // se fait retirer, et emporte ce qu'elle gardait vraiment.
        { inverse: /le niveau se lit dans un seuil/i },
      );
      // La moitié que la narration exige : raconter le seuil sans dire qu'il était infondé le
      // réhabiliterait. C'est le seul endroit du métier où un seuil est écrit, et ce qui
      // empêche de le relire comme une consigne est le jugement qui l'accompagne.
      exigePolarite(
        s.corps, /n'avait été mesuré par rien/i,
        'le seuil raconté est nommé comme infondé — sans ce jugement, le récit se relit comme une consigne',
        { inverse: /ce seuil (?:tient|reste|s'applique|a été mesuré)/i },
      );
      // La moitié qui ferme : dire « jamais dans un seuil » et poser la question quand même
      // rétablirait le seuil par la porte de derrière. Le texte doit dire que la question NE
      // SE POSE PAS.
      const posees = s.corps.split('\n').filter((l) => /ne se pose (donc )?pas/i.test(l));
      assert.ok(
        posees.length >= 1,
        'le métier ne dit plus que la question « ce chantier justifie-t-il un chef d’équipe ? » '
          + 'ne se pose pas : sans ça, « pas de seuil » se lit comme « à toi de juger », et le '
          + 'seuil revient sous forme de jugement',
      );
    },
  },

  {
    id: 'la-table-des-anti-patterns-est-une-liste-fermee',
    quoi: 'la table d’anti-patterns du gabarit compte exactement ce qu’elle doit compter — en retirer une ligne rougit, en glisser une aussi',
    verifier({ metier }) {
      // ⚠️ CETTE GARDE REMPLACE UN COMPTE QUI SE PRENAIT SUR UN AUTRE TEXTE. Jusqu'au
      // 2026-08-17, la fermeture de la liste se mesurait par DIFFÉRENCE avec la table de la
      // compétence (`NB_ANTI_PATTERNS_AJOUTES`, 29 ajouts attendus). Cette prémisse est tombée
      // avec la réécriture : 28 des 35 lignes de la compétence ont été reformulées, donc la
      // différence ne mesure plus rien. Le compte se prend désormais sur la table du gabarit
      // POUR ELLE-MÊME — il n'a plus de prémisse à laquelle retomber.
      //
      // Ce que ça garde, et c'est le mode de régression le plus silencieux d'un document :
      // une table dont on retire une ligne ne casse rien, et la faute redevient tentante.
      // Chaque ligne a été payée une fois. En ajouter une demande d'éditer le nombre ici, ce
      // qui se voit en revue — une idée de plus ne se glisse pas dans le texte en silence.
      const table = tableDe(sectionDe(metier, /^Anti-patterns$/i, 'd’anti-patterns').corps);
      assert.equal(
        table.lignes.length, NB_ANTI_PATTERNS,
        `la table d’anti-patterns porte ${table.lignes.length} ligne(s) pour ${NB_ANTI_PATTERNS} `
          + `attendue(s) : soit une faute payée a été retirée en silence, soit une idée s’est `
          + `glissée dans le texte. Les deux se décident, aucune ne se constate.`,
      );
      // Et le compte seul ne suffirait pas : une ligne retirée et une autre ajoutée le
      // laisseraient juste. Les deux colonnes doivent rester peuplées — une faute sans son
      // coût est une préférence, et c'est la moitié qui se vide en premier.
      const fautes = colonne(table, /^Ce qu'on est tenté de faire$/i, 'ce qu’on est tenté de faire');
      const raisons = colonne(table, /^Pourquoi ça casse$/i, 'pourquoi ça casse');
      // Le seuil est bas À DESSEIN : il vise la cellule VIDE ou décorative, pas la cellule
      // brève. Le gabarit en porte une légitime de 14 signes (« `rien` s’écrit ») — une garde
      // calée plus haut l'aurait fait crier sur du texte correct, et une garde qui crie à tort
      // se fait retirer en emportant ce qu'elle gardait vraiment.
      const vides = raisons
        .map((r, i) => [fautes[i], r])
        .filter(([, r]) => r.trim().length < 10 || /^[-–—.\s]*$/.test(r));
      assert.deepEqual(
        vides.map(([f]) => f), [],
        `ces anti-patterns n’expliquent plus pourquoi ça casse : une faute sans son coût est une `
          + `préférence, et personne ne renonce à une préférence`,
      );
    },
  },

  {
    id: 'ligne-obligatoire',
    quoi: 'la ligne est un préalable au chantier — la phrase « continue sans elle » a disparu et le refus oblige',
    verifier({ metier }) {
      // L'AJOUT QUI EST UN RETRAIT, et le plus fragile des six : un retrait se défait d'un
      // copier-coller malheureux, sans que personne le remarque. On garde donc les DEUX
      // moitiés — l'absence de l'ancienne consigne, et la présence effective du refus.
      assert.ok(
        !metier.includes(PHRASE_RETIREE),
        `le métier dit encore « ${PHRASE_RETIREE} » : la ligne est redevenue facultative, et un `
          + `orchestrateur sans ligne tranche seul ce qu'il ne devait pas trancher`,
      );

      // ⚠️ LA SONDE DE SECTION SUIT LA FONCTION, PAS LE TITRE D'HIER. Le geste vivait sous
      // « 1-bis. Ouvrir ta ligne avec le dirigeant » ; la réécriture par la fonction
      // (2026-08-17) le porte sous « Ta ligne est obligatoire », en R6. La sonde n'est pas
      // ancrée `^…$` À DESSEIN : c'est ce titre-là qui affirme désormais l'obligation, et un
      // titre s'assouplit comme un paragraphe (« Ta ligne est obligatoire, sauf si ça
      // presse ») — on veut le trouver ASSOUPLI plutôt que de ne plus le trouver du tout,
      // pour que l'échec nomme la garantie et pas une section introuvable.
      //
      // ⚠️ ET LA SONDE NE TIENT PLUS À L'ADJECTIF — le banc de faux positifs l'a attrapée.
      // Elle cherchait `Ta ligne est obligatoire` : écrire « Ta ligne est **requise** », qui
      // dit exactement la même chose avec la même force, faisait rougir cette garde ET
      // `la-formule-jai-besoin-de-toi`. Une garde qui crie sur du texte correct se fait
      // retirer par le premier qui la rencontre, et emporte ce qu'elle gardait vraiment.
      // Elle désigne désormais la section par ce dont elle PARLE — ta ligne, et le fait
      // qu'elle en AFFIRME quelque chose (« Ta ligne EST … ») — et la garantie elle-même
      // reste tenue par ce qui suit : la modalité du titre, le refus compté une fois, et le
      // moment de l'ouverture en polarité. Le mot « obligatoire » n'était pas la garantie ;
      // il était l'endroit où on la lisait.
      const s = sectionDe(metier, /^Ta ligne (?:est|reste|demeure)\b/i, 'sur l’ouverture de la ligne');
      exigeImperatif(s.titre, 'le titre de la section qui affirme l’obligation');

      const enonces = s.corps.split('\n').filter((l) => /ne peut pas s'ouvrir/i.test(l));
      assert.equal(enonces.length, 1, `le métier doit dire une fois exactement ce qui arrive quand la ligne ne s’ouvre pas (${enonces.length})`);
      exigeImperatif(enonces[0], 'le refus de commencer sans ligne');
      assert.match(
        enonces[0], /tu ne commences pas|arrête-toi/i,
        `« ${enonces[0].trim()} » ne refuse plus : sans ligne, le chantier ne commence pas`,
      );

      // ⚠️ « PRÉALABLE AU CHANTIER » N'EST PLUS ÉCRIT — LA FONCTION, ELLE, EST RESTÉE, et la
      // sonde a suivi. L'ancienne rédaction qualifiait la ligne de « préalable au chantier » ;
      // la réécriture dit la même chose par le MOMENT de son ouverture : « Tu l'ouvres en
      // naissant, tu la refermes en clôturant. » C'est le même fait, énoncé plus fort — une
      // ligne ouverte à la naissance ne peut pas être un confort qu'on se donne le jour où le
      // besoin se présente. Garder le mot « préalable » aurait gardé un mot ; on garde le
      // moment, qui est ce que la règle FAIT.
      exigePolarite(
        s.corps, /ouvres en naissant/i,
        'la ligne s’ouvre à la naissance — c’est ce qui en fait un préalable au chantier',
        { inverse: /tu l'ouvres (?:quand|si) tu en as besoin|ouvre-la (?:plus tard|au besoin)/i },
      );

      // Le refus doit dire QUOI FAIRE, pas seulement constater — le gestionnaire a mis trois
      // défauts à rendre ce geste honnête, autant les reprendre plutôt que les redécouvrir.
      assert.match(enonces[0], /dis (?:ce qui manque|quoi faire)|quoi faire/i, 'un refus qui ne dit pas quoi faire laisse le lecteur sans issue');

      // ⚠️ LA SECONDE AFFIRMATION A ÉTÉ FUSIONNÉE AVEC LA PREMIÈRE — c'est la réorganisation,
      // pas une perte, et la garde qui la surveillait est RETIRÉE ICI avec son motif.
      //
      // L'obligation était écrite à DEUX endroits : §1-bis, où vivait le geste, et une
      // sous-section « Ta ligne directe est obligatoire » qui la nommait parmi les capacités.
      // La passe 2 gardait le second parce qu'on pouvait l'assouplir seul, et un lecteur
      // applique alors celui qu'il a lu en dernier. La réécriture par la fonction n'a plus
      // qu'UN endroit — la section lue ci-dessus : il n'y a plus deux formulations qui
      // puissent diverger, donc plus rien à apparier. Ce qui restait de la garde a été
      // reporté sur ce qui porte l'affirmation maintenant : le TITRE de cette section unique,
      // gardé impératif tout en haut de ce contrôle. La mutation qui l'éprouvait
      // (`revue-P2-la-seconde-affirmation-s-assouplit`) a suivi le même chemin : elle assouplit
      // désormais ce titre.
    },
  },

  {
    id: 'consulter-jamais-sous-traiter',
    quoi: 'appeler un spécialiste est une question qu’on lui pose, jamais une unité de travail qu’on lui confie',
    verifier({ metier }) {
      // AJOUT 1. La frontière que le dirigeant a nommée : « un orchestrateur qui délègue son
      // chantier à un spécialiste au lieu de lui poser une question devient un guichet ».
      // Résolue par LIBELLÉ D'EN-TÊTE ANCRÉ : permuter les deux libellés, sans déplacer une
      // cellule, ferait de la sous-traitance la bonne pratique.
      const s = sectionDe(metier, /Tu appelles les agents spécialisés/i, 'sur l’appel des spécialistes');
      const table = tableDe(s.corps.split('**La frontière')[1] || '');
      const fait = colonne(table, /^\*\*Consulter — ce que tu fais\*\*$/i, 'ce que tu fais').join(' ');
      const jamais = colonne(table, /^\*\*Sous-traiter — ce que tu ne fais jamais\*\*$/i, 'ce que tu ne fais jamais').join(' ');

      for (const [sonde, quoi] of [
        [/question de son domaine/i, 'lui poser une question de son domaine'],
        [/gardes la décision/i, 'garder la décision'],
      ]) {
        assert.match(fait, sonde, `« ${quoi} » est ce que tu fais, il doit figurer de ce côté`);
        assert.ok(!sonde.test(jamais), `« ${quoi} » est donné comme ce qu’on ne fait jamais — la frontière est inversée`);
      }
      for (const [sonde, quoi] of [
        [/confies une unité de travail/i, 'lui confier une unité de travail'],
        [/relaies/i, 'relayer ce qu’il rend'],
      ]) {
        assert.match(jamais, sonde, `« ${quoi} » est de la sous-traitance, il doit figurer de ce côté`);
        assert.ok(!sonde.test(fait), `« ${quoi} » est donné comme ce que tu fais — la frontière est inversée`);
      }

      // ⚠️ LES TROIS DERNIÈRES SONDES CHERCHAIENT DES LIBELLÉS DE RUBRIQUE, PAS DES FONCTIONS
      // — ré-ancrage par la fonction, 2026-08-17. Le texte écrivait « **Quand appeler** » et
      // « **Lequel appeler** » ; la réécriture garde le premier libellé et abrège le second en
      // « **Lequel** : … ». La garde rougissait donc sur « le métier doit dire LEQUEL appeler »
      // pendant que le métier le disait — et le disait mieux. Un libellé de rubrique se
      // renomme sans qu'aucune règle bouge : ce qu'on garde, ce sont les deux CRITÈRES que ces
      // rubriques portent, chacun avec la moitié qui EXCLUT — c'est elle qui fait la frontière.
      // ⚠️ LES SONDES SONT ÉCRITES POUR TENIR À UNE REFORMULATION : chacune vise le COUPLE
      // (ce qui déclenche, ce qui est décidé) plutôt que la tournure. « change ce que tu vas
      // décider » et « modifie la décision que tu vas prendre » disent la même chose, et une
      // garde qui ne reconnaîtrait que la première se ferait retirer par le premier qui
      // reformule — en emportant ce qu'elle gardait vraiment.
      exigePolarite(
        s.corps, /(?:change|modifie|infléchit|détermine)[^.]{0,40}(?:ce que tu vas décider|(?:ta|la) décision)/i,
        'QUAND appeler : quand la réponse de ce spécialiste change ce que l’orchestrateur va décider',
      );
      // La moitié qui exclut, et sans laquelle « appeler quand c'est utile » se relit comme
      // « appeler quand il y a du travail » — c'est-à-dire exactement la sous-traitance.
      exigePolarite(
        s.corps, /(?:pas|jamais) quand[^.]{0,20}du travail à faire faire/i,
        'et jamais quand il y a du travail à faire faire — ça, c’est un chef d’équipe',
      );
      // LEQUEL : le domaine est le critère RETENU, la disponibilité celui qui est EXCLU.
      //
      // ⚠️ LA GARDE TIENT AUX DEUX RÔLES, PAS À L'ORDRE DES DEUX PROPOSITIONS — et c'est
      // mesuré. Une première version exigeait « domaine … jamais … disponible » dans cet
      // ordre ; écrire l'exclusion d'abord (« jamais celui qui est disponible — celui dont
      // c'est le domaine ») dit exactement la même chose et la faisait crier. Ce qui coûte
      // n'est pas l'ordre : c'est la PERMUTATION DES RÔLES, la négation qui glisse du
      // disponible vers le domaine — donc c'est elle, et elle seule, que l'inverse interdit.
      exigePolarite(
        s.corps, /(?:jamais|pas)[^.]{0,25}disponible/i,
        'LEQUEL appeler : la disponibilité est le critère EXCLU',
        { inverse: /(?:jamais|pas)[^.]{0,25}(?:c'est le |le )?domaine/i },
      );
      assert.match(
        s.corps, /celui dont c'est le domaine|dont c'est (?:le|son) domaine|celui qui tient (?:le|ce) domaine/i,
        'LEQUEL appeler : celui dont c’est le domaine — le critère RETENU doit être nommé, sinon '
          + 'exclure la disponibilité ne dit toujours pas lequel appeler',
      );
      // Ce qu'il devient s'il franchit la frontière. Le nom est la sanction : sans lui, la
      // table se lit comme deux façons de faire dont l'une serait moins élégante.
      exigePolarite(
        s.corps, /guichet/i,
        'un orchestrateur qui sous-traite devient un guichet',
      );
    },
  },

  {
    id: 'ouvrir-n-est-pas-appeler',
    quoi: 'ouvrir un chef d’équipe et appeler un spécialiste sont deux gestes distincts, et le spécialiste préexiste',
    verifier({ metier }) {
      // AJOUT 1, sa moitié descriptive. La compétence décrivait les agents qu'il OUVRE et ne
      // disait rien de ceux qui EXISTENT DÉJÀ. Confondre les deux est ce qui fait qu'on
      // « ouvre » un officier de sécurité — donc qu'on en fabrique un second, ignorant.
      const s = sectionDe(metier, /Tu appelles les agents spécialisés/i, 'sur l’appel des spécialistes');

      // ⚠️ LA TABLE « Le geste / Qui » N'EXISTE PLUS, ET CE N'EST PAS UNE PERTE — RÉ-ANCRAGE
      // PAR LA FONCTION, 2026-08-17. La sonde cherchait un EN-TÊTE DE COLONNE (« Le geste ») ;
      // `tableDe(s.corps)` rendait alors la PREMIÈRE table de la section — celle de la
      // frontière consulter/sous-traiter —, et la garde rougissait en nommant deux libellés
      // qui n'ont rien à voir avec ce qu'elle garde. Un rejet qui désigne la mauvaise table
      // n'apprend rien de la garantie.
      //
      // La fonction, elle, est restée EXACTEMENT LÀ OÙ ELLE SERT : la phrase d'ouverture de la
      // section oppose les deux gestes, et donne à chacun l'origine de son objet — « Tu
      // **ouvres** des chefs d'équipe — ils naissent pour ton chantier … Tu **appelles** des
      // agents spécialisés — ils existent déjà, ailleurs … ». C'est le même fait, dit en prose
      // plutôt qu'en table, et au même endroit.
      //
      // ⚠️ CE QU'ON GARDE EST L'OPPOSITION, PAS LES DEUX MOTS. La garde découpe la phrase À
      // L'ENDROIT OÙ ELLE BASCULE et vérifie que chaque moitié porte le bon objet ET la bonne
      // origine — donc qu'une PERMUTATION des deux descriptions, qui laisse tous les mots en
      // place, la fait rougir. C'était toute la valeur de la résolution par en-tête ; elle est
      // rendue ici par la position relative au geste, qui est ce que la phrase FAIT.
      // Les deux gestes sont reconnus sans tenir au gras ni à la majuscule : « tu ouvres » dit
      // exactement ce que dit « Tu **ouvres** », et une garde qui exigerait les astérisques
      // crierait sur une reformulation correcte.
      const OUVRE = /\btu \*{0,2}ouvres\*{0,2}/i;
      const APPELLE = /\btu \*{0,2}appelles\*{0,2}/i;
      const opposition = s.corps
        .split('\n')
        .find((l) => OUVRE.test(l) && APPELLE.test(l));
      assert.ok(
        opposition,
        'le métier n’oppose plus OUVRIR et APPELER dans une même phrase : sans cette opposition, '
          + 'on « ouvre » un officier de sécurité — donc on en fabrique un second, ignorant du '
          + 'domaine que le premier tient déjà',
      );
      const bascule = opposition.search(APPELLE);
      const cotéOuvrir = opposition.slice(0, bascule);
      const cotéAppeler = opposition.slice(bascule);

      assert.match(cotéOuvrir, /chefs d'équipe/i, 'ce qu’on OUVRE, ce sont des chefs d’équipe');
      assert.match(cotéAppeler, /agents spécialisés/i, 'ce qu’on APPELLE, ce sont des agents spécialisés');

      // L'origine de chacun, et la moitié qui ferme : ce qu'on ouvre naît de ta main, ce qu'on
      // appelle préexiste. Les deux assertions négatives sont ce qui attrape la permutation.
      // Les deux sondes acceptent les façons normales de dire l'origine — naître de ta main,
      // naître pour ce chantier — parce que c'est l'ORIGINE qui est gardée, jamais sa tournure.
      const NAIT = /na(?:issent|ît)\b[^.]*(?:de ta main|pour (?:ton|ce) chantier)/i;
      const PREEXISTE = /exist(?:ent|aient|ait)\b[^.]*(?:déjà|avant toi)|préexist/i;
      assert.match(cotéOuvrir, NAIT, 'un chef d’équipe naît de ta main, pour ton chantier');
      assert.match(
        cotéAppeler, PREEXISTE,
        'un spécialiste existait avant toi — sinon ce n’est pas un appel, c’est une ouverture',
      );
      assert.ok(
        !PREEXISTE.test(cotéOuvrir),
        'un chef d’équipe qui préexiste n’est pas un chef d’équipe — les deux moitiés sont permutées',
      );
      assert.ok(
        !NAIT.test(cotéAppeler),
        'un spécialiste qui naît pour ton chantier est un chef d’équipe de plus, ignorant du domaine '
          + '— les deux moitiés sont permutées',
      );
    },
  },

  {
    id: 'parole-au-dirigeant-exclusive',
    quoi: 'parler au dirigeant est sa capacité, et elle ne se partage pas avec ses chefs d’équipe',
    verifier({ metier }) {
      // AJOUT 2. Écrite comme capacité, et exclusive : si un chef d'équipe peut parler au
      // dirigeant, l'orchestrateur cesse d'être le point unique et deux versions du chantier
      // circulent. La ligne de rapport unique existe déjà pour les sous-agents ; celle-ci
      // est son pendant vers le haut.
      //
      // ⚠️⚠️ CETTE GARDE EST LAISSÉE ROUGE — LA FONCTION A ÉTÉ PERDUE À LA RÉÉCRITURE, ET
      // C'EST UNE PERTE, PAS UN RENOMMAGE.
      //
      // Le métier portait une section « Tu parles au dirigeant » dont le corps disait :
      // « C'est ta capacité, et elle n'appartient qu'à toi sur ce chantier. Ni tes chefs
      // d'équipe ni leurs sous-agents ne parlent au dirigeant : ce qui doit lui arriver passe
      // par toi, et ce qu'il tranche redescend par toi. » La réécriture par la fonction
      // (2026-08-17) a supprimé la section ET la phrase. Cherchée dans TOUT le gabarit, sous
      // les deux vocabulaires (« dirigeant » a été partout remplacé par « CTO »), l'exclusivité
      // VERS LE HAUT n'y est plus sous aucune forme. Ce qui subsiste — « Le chef d'équipe est
      // ton interlocuteur exclusif pour son périmètre. Ses sous-agents lui rendent compte,
      // jamais à toi. » — est l'exclusivité VERS LE BAS : elle dit qui parle à l'orchestrateur,
      // jamais qui a le droit de parler au CTO.
      //
      // C'est l'ajout 2 de la liste fermée des sept, énoncée par le dirigeant lui-même. On ne
      // met donc rien au vert, on n'élargit rien, et on ne retire pas la garde. On la réécrit
      // seulement pour qu'elle cherche la FONCTION dans le texte entier plutôt qu'un titre
      // disparu : son rejet nomme désormais la garantie perdue, au lieu d'annoncer une section
      // introuvable — un rejet fondé plutôt qu'un rejet qui a l'air d'un défaut de sonde.
      //
      // ✅ RENDUE À `b493a8f`, et la sonde a dû accepter LE PRONOM (2026-08-17). Le correctif
      // écrit « Ni tes chefs d'équipe ni leurs sous-agents ne LUI parlent », l'antécédent étant
      // posé par la phrase précédente. Écrite sur « ne parlent au CTO », la garde refusait une
      // rédaction parfaitement correcte — un français normal reprend par un pronom plutôt que
      // de répéter le nom. C'était le second chiffre en action : elle attrapait la perte, et
      // elle aurait crié sur sa réparation. Ce qu'on exige est la NÉGATION portée par les deux
      // sujets, pas la forme sous laquelle le destinataire est nommé.
      exigePolarite(
        metier, /ni tes chefs d'équipe ni leurs sous-agents ne (?:lui parlent|parlent (?:au CTO|au dirigeant|à lui))/i,
        'l’exclusivité de la parole vers le haut : ni tes chefs d’équipe ni leurs sous-agents ne parlent au CTO',
        { inverse: /chefs d'équipe (?:peuvent|pourront) (?:lui )?parler|parlent directement au CTO/i },
      );
      exigePolarite(
        metier, /ce qui doit lui arriver passe par toi/i,
        'et ce qui doit atteindre le CTO passe par l’orchestrateur — c’est ce qui en fait le point unique',
      );
    },
  },

  {
    id: 'ronde-horaire',
    quoi: 'la ronde a une cadence par défaut, chiffrée et posée à la naissance — et la veille de déblocage ne la remplace pas',
    verifier({ metier }) {
      // AJOUT 4. Mesuré : trois agents ont attendu en silence cette semaine, dont un près
      // d'une heure. La cadence est le livrable — « régulièrement » ne se vérifie pas, et
      // « sur demande » est exactement ce qui a produit les trois attentes.
      //
      // ⚠️ CE QUI A CHANGÉ, ET POURQUOI. La garde cherchait un TITRE (« Veiller tes agents »),
      // un MOT (« toutes les heures ») et une FORME (la cadence en citation de tête). Les trois
      // ont bougé, la fonction non : le déclenchement et la cadence vivent maintenant dans
      // « La ronde — ce qui te réveille », la valeur par défaut est passée de l'heure à 20-30
      // minutes, et elle est en corps de section. Garder « toutes les heures » aurait gardé un
      // CHIFFRE, et fait rougir un texte devenu plus strict ; on garde donc ce que le texte
      // FAIT — une cadence chiffrée, donnée à défaut d'instruction, et soustraite au jugement
      // en cours de route. Ce que le chiffre vaut n'appartient pas à la garde.
      const declenchement = sectionDe(metier, /^La ronde — ce qui te réveille$/, 'sur le déclenchement et la cadence de la ronde');
      exigeImperatif(declenchement.titre, 'le titre de la ronde');

      // ⚠️ LA SONDE A DÛ S'ÉLARGIR D'UN CRAN, ET C'EST UNE MESURE, PAS UNE FAVEUR. Écrite sur
      // un CHIFFRE (`\d+`), elle rougissait sur « un tour toutes les heures » — c'est-à-dire
      // sur la cadence que ce lot avait elle-même livrée. Une garde qui crie sur du texte
      // correct se fait retirer, en emportant ce qu'elle gardait. Ce qu'on exige est donc une
      // PÉRIODE : un quantificateur et une unité de temps, ce qu'aucun adverbe ne fournit.
      exigePolarite(
        declenchement.corps, /à défaut d'instruction[^\n]*(?:\d+|toutes les|chaque|une fois par)[^\n]*(?:minute|heure|jour)/i,
        'la cadence par défaut de la ronde, donnée en PÉRIODE — « régulièrement » ne se vérifie pas',
        { inverse: /sur demande|quand tu le sens|quand tu y penses|à ton propre rythme/i },
      );
      exigePolarite(
        declenchement.corps, /jamais laissée à ton jugement/i,
        'et elle est soustraite au jugement en cours de route — c’est précisément le jugement que la perte de contexte dégrade',
        { inverse: /tu choisis ta cadence|à ta convenance|c'est à toi de juger de la cadence/i },
      );

      const cadence = parasDe(declenchement.corps).filter((p) => /à défaut d'instruction/i.test(p));
      assert.equal(cadence.length, 1, `la cadence doit être énoncée une fois exactement (${cadence.length})`);
      exigeImperatif(cadence[0], 'la cadence de la ronde');

      // LA POLARITÉ QUI COMPTE : ce que la veille NE couvre pas. L'inverser ferait croire
      // que l'automatisme existant suffit — et la ronde deviendrait facultative de fait.
      // Elle a suivi le chapeau qui ouvre les rondes ; la sonde l'y suit.
      const rondes = sectionDe(metier, /^R5 — Tes rondes$/, 'qui ouvre les rondes');
      const veille = rondes.corps.split('\n').filter((l) => /veille de déblocage/i.test(l));
      assert.equal(veille.length, 1, `le chapeau doit situer la veille une fois exactement (${veille.length})`);
      exigePolarite(
        // ⚠️ SONDE ÉLARGIE AUX SYNONYMES DE « REMPLACER » — mesuré le 2026-08-17 par une
        // campagne de reformulations légitimes écrites à l'aveugle : « ne se substitue pas à
        // ta ronde » faisait crier cette garde sur un texte correct. La garantie est la
        // NÉGATION du remplacement, pas le verbe choisi ; l'`inverse` ci-dessous, lui, tient
        // la polarité et ne s'élargit pas.
        rondes.corps, /veille de déblocage ne (?:remplace pas|se substitue pas|tient pas lieu)/i,
        'la veille de déblocage ne remplace pas la ronde — sinon la ronde devient facultative de fait',
        { inverse: /la veille (?:de déblocage )?(?:fait|remplace|suffit|couvre|tient lieu)/i },
      );
      for (const angle of [/qui a fini/i, /arrêté proprement/i, /rouge/i]) {
        exigePolarite(rondes.corps, angle, `ce que la veille ne voit pas (${angle})`);
      }
    },
  },

  {
    id: 'ronde-n-execute-pas',
    quoi: 'ce que la ronde trouve retourne à qui de droit — elle ne fait pas de l’orchestrateur un exécutant',
    verifier({ metier }) {
      // AJOUT 4, son revers. Une consigne de surveillance régulière est une invitation à
      // « juste débloquer ça vite fait » douze fois par jour — c'est-à-dire exactement la
      // dérive que le métier existant nomme (« ce que tu ne fais pas de tes mains ») et que
      // le dirigeant a reprise sur ce chantier même.
      //
      // ⚠️⚠️ CE COMMENTAIRE DISAIT UNE CHOSE FAUSSE, ET C'EST CORRIGÉ ICI (lot 2, 2026-08-17).
      //
      // Il disait : « la réorganisation a séparé les deux moitiés — l'interdit du clavier est
      // REMONTÉ là où il vaut pour TOUS les gestes […] la garantie n'a pas disparu, elle a
      // changé de portée ». **Rien n'a remonté**, et c'est vérifiable au caractère près :
      //
      //   • `878f9d5:361` — la phrase « tu ne prends pas le clavier à sa place » vivait DÉJÀ
      //     sous « Ce que tu ne fais pas de tes mains », identique à une virgule près ;
      //   • `878f9d5:431` — la ronde en portait sa PROPRE copie, avec son renvoi.
      //   • `f0fa26b:700` — la copie de la ronde a été SUPPRIMÉE. Une seule survit.
      //
      // La sonde avait donc été pointée sur la copie survivante, et le commentaire attestait
      // d'un déménagement qui n'a pas eu lieu. **La portée n'a même pas été élargie : elle a
      // été restreinte** — le « sa » de la phrase survivante désigne **la veille de déblocage**
      // qui s'arrête devant un écran, pas l'agent bloqué que la ronde vient de trouver.
      //
      // ⚠️ **UN MOTIF FAUX FERME LA QUESTION ; UNE GARDE ABSENTE LA LAISSE OUVERTE.** C'est
      // pour ça que ce paragraphe est corrigé avant même que le texte le soit.
      //
      // ⚠️ **LA RÈGLE QUI EN SORT, ET ELLE VAUT POUR TOUT CE FICHIER** : *une garde ne se
      // ré-ancre JAMAIS sur ce qui reste sans que la perte soit d'abord actée.* Ré-ancrer,
      // c'est déplacer le témoin ; **le témoin doit rougir d'abord.**
      //
      // Donc : la perte est actée (`T-20260817-0088`, P1), et **cette garde reste ROUGE** —
      // elle exige la clause LÀ OÙ ELLE SERT, dans la ronde. Elle reverdira d'elle-même quand
      // le texte sera réparé. La sonde sur « Ce que tu ne fais pas de tes mains » est
      // conservée en plus, car cette moitié-là est réelle et gardait déjà quelque chose.
      const s = sectionDe(metier, /^1 — Tes agents et le travail qui tourne$/, 'sur ce que la ronde regarde');
      const enonces = s.corps.split('\n').filter((l) => /Ce que tu fais de ce que tu trouves/i.test(l));
      assert.equal(enonces.length, 1, 'la section doit dire ce qu’on fait de ce qu’on trouve');
      exigePolarite(
        s.corps, /Ce que tu fais de ce que tu trouves ne change pas/i,
        'la ronde ne change rien aux gestes qui ne t’appartiennent pas',
        { inverse: /ce que tu fais de ce que tu trouves t'appartient|tu prends le clavier|tu corriges à sa place/i },
      );
      exigePolarite(
        s.corps, /retourne à celui qui l'a rougie/i,
        'une chaîne rouge retourne à qui l’a rougie — la ronde renvoie le geste, elle ne l’exécute pas',
      );
      exigePolarite(
        s.corps, /ne te transforme pas en exécutant/i,
        'la section doit conclure sur ce qu’elle n’autorise pas',
        { inverse: /fait de toi un exécutant|te transforme en exécutant/i },
      );

      // ⚠️ LA MOITIÉ PERDUE, EXIGÉE LÀ OÙ ELLE SERT — et c'est ce qui rougit aujourd'hui.
      //
      // La ronde doit dire elle-même qu'on ne prend pas le clavier à la place de l'agent
      // qu'elle vient de trouver bloqué. C'est là que le lecteur agit : il vient de voir un
      // agent rouge, et c'est à cette seconde-là que « juste débloquer ça vite fait » se
      // décide. Un interdit qui vit 570 lignes plus haut, sur un autre geste, ne l'atteint pas.
      assert.ok(
        /tu ne prends pas le clavier à sa place|ne prends pas le clavier/i.test(s.corpsEtendu),
        'la ronde ne dit plus qu’on ne prend pas le clavier à la place de l’agent qu’elle vient '
          + 'de trouver bloqué. La phrase existe encore ailleurs (« Ce que tu ne fais pas de tes '
          + 'mains »), mais elle y gouverne un AUTRE geste — la veille qui s’arrête devant un '
          + 'écran. Le contenu survit, le lieu non : c’est la perte P1 de T-20260817-0088, et '
          + 'cette garde reste rouge jusqu’à ce que le texte la reçoive à l’endroit du geste.',
      );

      // L'autre moitié, elle, est réelle et gardait déjà quelque chose avant la reconstruction :
      // l'interdit vaut aussi pour la veille de déblocage qui s'arrête devant un écran inconnu.
      // Elle est conservée — on n'enlève pas une garde vraie parce qu'une autre est tombée.
      const mains = sectionDe(metier, /^Ce que tu ne fais pas de tes mains$/, 'sur les gestes qui ne sont pas les siens');
      exigePolarite(
        mains.corps, /tu ne prends pas le clavier à sa place/i,
        'et elle ne t’autorise pas à prendre le clavier à sa place',
        { inverse: /tu prends le clavier à sa place|tu peux prendre le clavier/i },
      );
    },
  },

  {
    id: 'topo-matinal',
    quoi: 'le topo est quotidien, à 7 h 00, sur son canal, et porte les quatre rubriques',
    verifier({ metier }) {
      // AJOUT 5. L'heure et le lieu sont le livrable : un topo « régulier » « quelque part »
      // ne se tient pas. Les quatre rubriques sont gardées en COMPTE — en retirer une (la
      // seule qui appelle une décision, en général) ne casserait rien d'autre.
      const s = sectionDe(metier, /Le topo du matin/i, 'sur le topo du matin');

      // ⚠️ LE RENDEZ-VOUS A CHANGÉ DE LIGNE, PAS DE NATURE. Il s'écrivait en tête de corps
      // (« Chaque matin à 7 h 00, tu poses un topo sur ta ligne. ») ; la réécriture par la
      // fonction (2026-08-17) l'a porté dans le TITRE — « 6 — Le topo du matin, 7 h 00 ». La
      // sonde le lit donc là où il vit maintenant. Un titre s'assouplit comme un paragraphe,
      // d'où l'exigence de modalité sur lui aussi.
      assert.match(s.titre, /7\s?h/i, `l’heure du topo doit être écrite — le titre « ${s.titre} » ne la porte plus`);
      assert.match(s.titre, /matin/i, `le topo est quotidien, il se tient le matin — le titre « ${s.titre} » ne le dit plus`);
      exigeImperatif(s.titre, 'le rendez-vous du topo');

      // ⚠️⚠️ LE LIEU DU TOPO A ÉTÉ PERDU À LA RÉÉCRITURE — GARDE LAISSÉE ROUGE, PERTE REMONTÉE.
      //
      // L'ajout 5 se dit en une phrase, et c'est la liste fermée des sept qui l'énonce :
      // « il pose un topo SUR SON CANAL chaque matin à 7 h 00 ». L'heure a survécu (dans le
      // titre) et les quatre rubriques aussi ; le LIEU, lui, n'est plus écrit nulle part dans
      // la section — cherché dans tout le gabarit, « tu poses un topo sur ta ligne » a disparu
      // et rien ne l'a remplacé. Or l'heure sans le lieu est exactement le « régulier, quelque
      // part » que cet ajout existe pour interdire, et le lecteur ne peut plus le déduire : la
      // section de la ligne lui interdit d'y pousser « ton journal de bord », donc un topo sans
      // destination écrite n'a plus de destination du tout. On ne l'élargit pas et on ne la
      // retire pas : elle cherche la fonction — où le topo se pose — là où elle doit vivre.
      //
      // ✅ RENDU À `b493a8f`, DANS LE TITRE : « 6 — Le topo du matin, 7 h 00, **sur ta ligne** ».
      // Le rendez-vous porte désormais ses trois éléments au même endroit — quand, à quelle
      // heure, où — et c'est mieux que ce qui existait. La garde lisait le seul corps : elle
      // aurait donc refusé la réparation. On lit le titre ET le corps, parce que ce qui compte
      // est que le lieu soit ÉCRIT dans la section, pas la ligne où il est écrit.
      exigePolarite(
        `${s.titre}\n${s.corps}`, /sur ta ligne|sur ton canal/i,
        'le topo se pose sur sa ligne — l’heure sans le lieu laisse un « régulier, quelque part »',
      );

      // ⚠️ LES RUBRIQUES NE SONT PLUS DES PUCES : elles sont énumérées EN LIGNE, séparées par
      // « · », derrière l'annonce « Quatre lignes ». La garde en COMPTE reste la même — en
      // retirer une (la seule qui appelle une décision, en général) ne casserait rien d'autre —
      // mais elle compte désormais les segments de l'énumération. `pucesDe` ne voyait plus rien
      // et rendait 0 pour 4, ce qui est un rejet fondé mais muet sur la cause.
      const RUBRIQUES = [
        { quoi: 'où en est le chantier', sonde: /où en est le chantier/i },
        { quoi: 'ce qui tourne en ce moment', sonde: /ce qui tourne/i },
        { quoi: 'ce qui est bloqué', sonde: /bloqué/i },
        { quoi: 'ce qui attend une décision du dirigeant', sonde: /attend une décision/i },
      ];
      const enumeration = s.corps.split('\n').filter((l) => /où en est le chantier/i.test(l));
      assert.equal(enumeration.length, 1, `les rubriques du topo doivent être énumérées une fois exactement (${enumeration.length})`);
      const rubriques = enumeration[0].split('·').map((x) => x.trim());
      assert.equal(rubriques.length, RUBRIQUES.length, `${rubriques.length} rubrique(s) écrite(s) pour ${RUBRIQUES.length} gardée(s)`);
      for (const { quoi, sonde } of RUBRIQUES) {
        assert.equal(rubriques.filter((p) => sonde.test(p)).length, 1, `« ${quoi} » doit figurer une fois exactement`);
      }

      // LE DÉCLENCHEMENT EXISTE DÉSORMAIS (E-20260813-0002), et le métier le dit — mais il
      // ne le PRESCRIT toujours pas : le mécanisme est un outil, remplaçable, et le graver
      // ici rendrait le métier faux le jour où il change. L'interdiction ci-dessous tient
      // donc entière ; c'est seulement l'attente qui est levée.
      //
      // ET LA GARANTIE QUI COMPTE VRAIMENT : le rendez-vous reste TIEN. Un réveil en panne
      // ne fait aucun bruit — un topo qui n'arrive pas ressemble trait pour trait à une
      // matinée sans rien à dire. Sans cette phrase, la panne serait indiscernable du
      // silence, et c'est exactement la confusion que le topo existe pour lever.
      //
      // ⚠️ ELLE A DÉMÉNAGÉ, ON LA SUIT PLUTÔT QUE DE L'ABANDONNER. Elle vivait sous le topo ;
      // elle vit maintenant en tête de métier, dans « La ronde — ce qui te réveille », où elle
      // couvre le topo ET la ronde — d'où la première sonde ci-dessous, sans laquelle un texte
      // qui cesserait de parler du topo à cet endroit rendrait la seconde muette sur lui.
      const reveil = sectionDe(metier, /ce qui te réveille/i, 'sur ce qui réveille l’orchestrateur');
      exigePolarite(
        reveil.corps, /pour le topo comme pour ta ronde/i,
        'le réveil couvre le topo autant que la ronde — sinon la garantie qui suit ne parle plus du topo',
      );
      exigePolarite(
        reveil.corps, /tu tiens le rendez-vous quand même/i,
        'le rendez-vous appartient à l’orchestrateur, réveil ou pas — sinon un réveil muet efface le topo sans que rien ne le signale',
        { inverse: /c'est qu'il n'y avait rien à dire|c'est qu'il n'y a rien à dire/i },
      );

      for (const invente of ['crontab', 'cron -', 'launchd', 'systemd']) {
        assert.ok(
          !s.corps.includes(invente) && !reveil.corps.includes(invente),
          `le métier prescrit un mécanisme d’horloge (« ${invente} ») qui n’a pas été tranché`,
        );
      }
    },
  },

  {
    id: 'gardien-des-adr',
    quoi: 'il garde les ADR par le brief, la revue et le signalement — jamais en relisant le code',
    verifier({ metier }) {
      // AJOUT 6, et sa TENSION avec le métier existant : « ne code pas, ne relit pas le
      // code ». Les trois gestes sont la résolution ; les garder en compte empêche qu'on en
      // perde un — et c'est « vérifier que la revue a couvert » qui disparaîtrait en premier,
      // parce que c'est le seul qui demande de renvoyer quelqu'un à son travail.
      const s = sectionDe(metier, /gardien des ADR/i, 'sur la garde des ADR');
      const table = tableDe(s.corps);
      const gestes = colonne(table, /^Ce que tu fais$/i, 'ce que tu fais');
      const pourquoi = colonne(table, /^Pourquoi ça tient sans lire le code$/i, 'pourquoi ça tient sans lire le code').join(' ');

      const GESTES = [
        { quoi: 'porter la contrainte dans le brief', sonde: /dans le brief/i },
        { quoi: 'vérifier que la revue l’a couverte', sonde: /la revue l'a couverte/i },
        { quoi: 'signaler l’écart sans le trancher', sonde: /signales l'écart/i },
      ];
      assert.equal(gestes.length, GESTES.length, `${gestes.length} geste(s) écrit(s) pour ${GESTES.length} gardé(s)`);
      for (const { quoi, sonde } of GESTES) {
        assert.equal(gestes.filter((g) => sonde.test(g)).length, 1, `« ${quoi} » doit figurer une fois exactement`);
      }
      assert.ok(
        !/tu relis le code|tu lis le code/i.test(gestes.join(' ')),
        'un des gestes fait relire le code à l’orchestrateur — c’est précisément ce que son métier lui interdit',
      );
      assert.match(pourquoi, /ignorance/i, 'le brief prévient la violation par ignorance, qui est la plus fréquente');

      // La tension doit être NOMMÉE, pas escamotée : un lecteur qui trouve les deux règles
      // sans la résolution appliquera celle qu'il a lue en dernier.
      assert.match(s.corps, /ne pas relire le code|ne relit pas le code/i, 'la tension avec l’interdit de relire le code doit être nommée');
      assert.match(s.corps, /Lire une décision n'est pas relire le code/i, 'et résolue explicitement');

      // ADR ≠ brief de revue. Deux registres, deux endroits ; les confondre ferait chercher
      // les décisions d'architecture dans les motifs de défaut du dépôt, où elles ne sont pas.
      const distinction = s.corps.split('\n').filter((l) => /BRIEF-REVUE\.md/.test(l));
      assert.equal(distinction.length, 1, 'la distinction avec le brief de revue doit être faite une fois exactement');

      // LA POLARITÉ, PAS LA PRÉSENCE. La première version de cette garde vérifiait que les
      // deux expressions figuraient dans la phrase : les PERMUTER les y laissait toutes les
      // deux, et la garde restait verte en enseignant le contraire — on cherchait les
      // décisions d'architecture dans les motifs de défaut du dépôt. On apparie donc chaque
      // registre à ce qu'il porte, en coupant la phrase là où le sujet change.
      const [pourLaRevue, pourLesAdr] = distinction[0].split(/Les ADR portent/i);
      assert.ok(pourLesAdr, 'la phrase doit dire ce que portent les ADR, après avoir dit ce que porte le brief de revue');
      assert.match(pourLaRevue, /motifs de défaut/i, 'le brief de revue porte les motifs de défaut du dépôt');
      assert.ok(!/décisions d'architecture/i.test(pourLaRevue), 'le brief de revue ne porte pas les décisions d’architecture — les deux registres sont inversés');
      assert.match(pourLesAdr, /décisions d'architecture/i, 'les ADR portent les décisions d’architecture');
      assert.ok(!/motifs de défaut/i.test(pourLesAdr), 'les ADR ne portent pas les motifs de défaut du dépôt — les deux registres sont inversés');
      assert.match(s.corps, /dossier Architecture/i, 'et le métier doit dire où vivent les ADR');
    },
  },

  {
    id: 'se-sert-des-memoires',
    quoi: 'il rappelle avant d’engager, borné à un sujet — et un rappel ne fait jamais foi',
    verifier({ metier }) {
      // AJOUT 7. Sa source normative est STD-039 (`accepted`), dont le noyau *always-on*
      // (§2.6) grave quatre invariants et POINTE le reste. Ce contrôle garde les quatre qui
      // concernent l'orchestrateur, et surtout celui dont la violation est silencieuse :
      // I3 — un rappel ne fait pas foi. Un orchestrateur qui tient un souvenir pour une
      // mesure ne se trompe pas bruyamment : il conclut, et personne ne voit d'où ça vient.
      // ⚠️ LES TROIS TERRAINS ONT CHANGÉ DE FORME, PAS DE LIEU — ré-ancrage par la fonction,
      // 2026-08-17. La garde désignait une section « … mémoires disponibles » et deux
      // sous-sections (« Les gestes, nommés par ce qu'ils font », « Un rappel ne fait pas
      // foi »), chacune avec sa table ; elle rougissait sur « section introuvable », ce qui
      // n'apprend rien de la garantie. La réécriture par la fonction met le tout sous
      // `## Sur les mémoires`, dans `# Tes outils` : les GESTES sont devenus une rangée de la
      // table des outils, les MOMENTS une énumération en ligne, et « un rappel ne fait pas
      // foi » une citation à l'intérieur de la section. **Mesuré avant de déplacer les
      // sondes** : c'est le même lieu du texte, et c'est celui où la règle s'exerce.
      const sMem = sectionDe(metier, /^Sur les mémoires$/i, 'sur l’usage des mémoires');
      const sOutils = sectionDe(metier, /^Tes outils$/i, 'sur ses outils');

      // ── I1, NOMMER PAR LA FONCTION. La garde la plus mécanique des quatre, et celle qui
      // se viole le plus facilement : écrire le nom du moteur au lieu du geste rend le texte
      // faux le jour où le moteur change — ce qui est l'argument entier de l'invariant.
      for (const mecanisme of [/graphiti/i, /neo4j/i]) {
        assert.ok(!mecanisme.test(metier), `le métier nomme un mécanisme (${mecanisme}) au lieu d’une fonction (I1)`);
      }
      // Les trois gestes ne vivent plus dans une table à eux : ils sont la rangée « Gestes de
      // mémoire » de la table des outils. On la résout par son ENTRÉE (l'outil nommé), pas par
      // son rang — une rangée se déplace dans une table sans qu'aucune règle bouge.
      const outils = tableDe(sOutils.corps);
      const nomDeLOutil = colonne(outils, /^Outil$/i, 'le nom de l’outil');
      const ceQueLOutilSert = colonne(outils, /^Ce qu'il te sert$/i, 'ce que l’outil te sert');
      const rGestes = nomDeLOutil.findIndex((n) => /Gestes de mémoire/i.test(n));
      assert.ok(
        rGestes >= 0,
        'les gestes de mémoire ne sont plus outillés : un orchestrateur à qui personne ne dit PAR QUOI '
          + 'rappeler ne rappellera pas',
      );
      const gestes = ceQueLOutilSert[rGestes].split('·');
      for (const attendu of ['/episodique', '/rappel', '/memoire']) {
        assert.equal(
          gestes.filter((g) => g.includes(attendu)).length, 1,
          `le geste « ${attendu} » doit être nommé une fois exactement, et par sa FONCTION (I1)`,
        );
      }

      // ── QUAND il rappelle. Trois moments, et ils ont en commun d'être AVANT qu'il engage
      // quelqu'un — un rappel fait après le brief ne sert plus à rien. Le COMPTE est la garde :
      // en retirer un ne casse rien et rouvre exactement le défaut que l'ajout ferme.
      const quandRappeler = sMem.corps.split('\n').find((l) => /Quand rappeler|trois moments/i.test(l));
      assert.ok(quandRappeler, 'le métier ne dit plus QUAND rappeler — un rappel sans moment ne se fait pas');
      exigePolarite(
        quandRappeler, /avant\*? (?:que tu engages|d'engager)/i,
        'les moments du rappel sont tous AVANT qu’il engage quelqu’un',
        { inverse: /(?:une fois|après) que tu (?:as|l'as) engagé|après (?:le|son) brief/i },
      );
      const moments = (quandRappeler.split(/\s:\s/)[1] || '').split('·');
      const MOMENTS = [
        /avant (?:de \*{0,2}cadrer|le \*{0,2}cadrage)/i,
        /avant (?:de \*{0,2}rouvrir|la \*{0,2}réouverture)/i,
        /avant (?:de \*{0,2}trancher|l'\*{0,2}arbitrage)/i,
      ];
      assert.equal(moments.length, MOMENTS.length, `${moments.length} moment(s) écrit(s) pour ${MOMENTS.length} gardé(s)`);
      for (const sonde of MOMENTS) {
        assert.equal(moments.filter((m) => sonde.test(m)).length, 1, `le moment « ${sonde} » doit figurer une fois exactement`);
      }

      // ── I5, le cantonnement. Un rappel non borné ramasse le vécu d'un autre projet et le
      // prend pour le sien. Deux moitiés : la borne elle-même, et ce qui la matérialise.
      exigePolarite(
        sMem.corps, /rappel épisodique se fait\b[^.]*borné à un sujet/i,
        'tout rappel épisodique est borné à un sujet (I5)',
        // L'inverse est écrit étroit À DESSEIN : le cantonnement se défait en retirant la
        // borne, pas en écrivant son contraire, et une formule large crierait sur la phrase
        // légitime qui explique CE QUE la borne évite.
        { inverse: /rappel épisodique se fait comme il vient/i },
      );
      assert.match(sMem.corps, /group_id/, 'et ce qui borne doit être nommé, sinon la borne ne s’applique pas (I5)');

      // ── I3, EN POLARITÉ ET PAS EN PRÉSENCE. Écrire les deux moitiés de la distinction
      // (« rappelle » / « fait foi ») sans les apparier laisserait passer leur PERMUTATION,
      // qui enseigne exactement le contraire : le registre rappellerait, la mémoire ferait foi.
      exigePolarite(
        sMem.corps, /un rappel ne fait pas foi/i,
        'un rappel ne fait pas foi (I3)',
        { inverse: /un rappel fait foi|la mémoire fait foi/i },
      );
      exigePolarite(
        sMem.corps, /ce qui fait foi est au ServiceDesk et dans les documents/i,
        'ce qui fait foi est nommé, et ce sont le registre et les documents — jamais un rappel',
      );
      const [avant, apres] = sMem.corps.split(/elle ne dit jamais/i);
      assert.ok(apres, 'la phrase qui sépare « où chercher » de « ce qui est vrai » a disparu');
      assert.match(avant, /te dit où chercher/i, 'la mémoire dit où chercher');
      assert.match(apres, /ce qui est vrai/i, 'et la mémoire ne dit jamais ce qui est vrai aujourd’hui');

      // ── I3 par sa conséquence pratique, et c'est la règle qui a coûté le plus cher :
      // le rappel fait gagner la RECHERCHE, jamais la VÉRIFICATION.
      //
      // ⚠️ ELLE ÉTAIT GARDÉE COMME UNE CITATION (« Un rappel ne remplace jamais une mesure. »,
      // exigée « telle quelle »). La phrase n'existe plus sous cette forme ; la réécriture dit
      // le même fait par ce qu'il FAUT FAIRE ENSUITE — « Le rappel t'a fait gagner la
      // recherche, pas la vérification. » —, précédé des deux exemples qui l'appliquent
      // (« Va le lire »). C'est la même règle, dite en geste plutôt qu'en maxime, et au même
      // endroit. Garder la citation aurait gardé des mots ; on garde ce que la règle impose.
      exigePolarite(
        sMem.corps, /fait gagner la recherche, (?:pas|jamais) la vérification/i,
        'un rappel ne remplace jamais une mesure : il fait gagner la recherche, pas la vérification',
        { inverse: /fait gagner la vérification|rappel vaut (?:généralement )?une mesure/i },
      );

      // ── I4, la frontière : chaque mémoire s'interroge chez elle, jamais à travers une autre.
      exigePolarite(
        sMem.corps, /tu interroges chaque mémoire chez elle/i,
        'chaque mémoire s’interroge chez elle, jamais à travers une autre (I4)',
        { inverse: /tu interroges les mémoires par le registre/i },
      );

      // ── Le pointeur, et RIEN de plus.
      //
      // STD-039 §2.6 borne le noyau *always-on* à quatre invariants + un pointeur, et dit que
      // le voir grossir est « un signal de dérive à corriger, pas à tolérer ». Ce que le
      // métier porte ici n'est pas ce noyau — c'est le MÉTIER de l'orchestrateur : quand il
      // rappelle, et pourquoi un rappel ne vaut pas une mesure. La distinction tient, mais
      // l'esprit du bornage s'applique quand même, et RIEN NE LE GARDAIT (relevé en revue de
      // fond) : on pouvait coller le standard entier ici sans qu'un test bronche.
      assert.match(sMem.corps, /STD-039/, 'le cadre doit être pointé par son code, pour qu’on aille le lire');
      assert.ok(
        sMem.corps.length < 4000,
        `la section mémoire fait ${sMem.corps.length} caractères : elle a cessé de pointer le cadre pour le `
          + `recopier. Une copie du standard vieillit en double, et ce n'est pas elle qui fait foi.`,
      );
      // Les invariants que le standard NE demande PAS de graver ici. Les y voir apparaître est
      // le signe qu'on a recopié §2.2 au lieu de pointer le standard.
      for (const horsNoyau of [/\bI2\b/, /\bI6\b/, /\bI7\b/, /\bI8\b/]) {
        assert.ok(
          !horsNoyau.test(sMem.corps),
          `la section recopie un invariant hors du noyau (${horsNoyau}) : le standard se consulte, il ne se duplique pas`,
        );
      }

      // ═══════════════════════════════════════════════════════════════════════════════════
      // ⚠️⚠️ LES DEUX ASSERTIONS QUI SUIVENT SONT LAISSÉES ROUGES — DEUX MOITIÉS PERDUES À LA
      // RÉÉCRITURE, ET CE SONT DES PERTES, PAS DES RENOMMAGES.
      //
      // Elles sont placées EN DERNIER À DESSEIN : tout ce qui précède est vrai du texte
      // d'aujourd'hui, donc chacune des mutations qui visent ce contrôle rougit **sur sa
      // propre assertion** et non sur ce rouge résiduel. Le jour où les deux moitiés
      // reviennent au gabarit, le contrôle passe vert sans qu'une ligne bouge ici.
      //
      // ⚠️ ON NE LES ASSOUPLIT PAS ET ON NE LES RETIRE PAS. Les retirer serait la seule chose
      // qui ferait disparaître la trace mécanique de la perte — c'est exactement ce qui est
      // arrivé, une fois, à l'exclusivité de la parole vers le haut.
      //
      // Elles ont toutes les deux la signature du lot : **une moitié survit, l'autre part.**
      // ═══════════════════════════════════════════════════════════════════════════════════

      // PERTE 1 — le MOTIF qui rend un rappel non probant. La section garde « va le lire »
      // pour un rappel qui rend QUELQUE CHOSE ; elle a perdu le cas d'un rappel qui ne rend
      // RIEN, qui est le piège silencieux (« la mémoire n'en parle pas, donc ça n'a pas eu
      // lieu »). Cherché dans TOUT le gabarit : la règle générale y survit deux fois — « Ne
      // conclus d'aucune absence » (R4.6) et l'anti-pattern « Conclure d'une absence », tous
      // deux motivés par le miroir des ADR — mais **jamais appliquée au rappel**, et jamais
      // ici. Le contenu survit, le lieu non.
      exigePolarite(
        sMem.corps, /absence de résultat/i,
        'PERTE — le motif qui rend un rappel non probant : un rappel qui ne rend RIEN ne prouve rien. '
          + 'La section garde « va le lire » pour le rappel qui rend quelque chose, et a perdu le cas '
          + 'du rappel vide. La règle générale (« ne conclus d’aucune absence ») vit ailleurs, motivée '
          + 'par les ADR — jamais appliquée à la mémoire, jamais ici',
      );

      // PERTE 2 — la seule remontée vers l'opposable. C'est la seconde moitié de I3 dans le
      // noyau *always-on* de STD-039 §2.6 : « la SEULE remontée d'un fait non-opposable vers
      // l'opposable (ServiceDesk / Somcraft) passe par le gate de promotion ». La première
      // moitié survit (« ce qui fait foi est au ServiceDesk et dans les documents ») ; celle
      // qui dit COMMENT un fait rappelé y accède a disparu — cherchée dans tout le gabarit,
      // sous « promotion » comme sous « opposable » : elle n'y est plus sous aucune forme.
      // Sans elle, l'orchestrateur sait qu'un rappel ne fait pas foi et ignore par quelle
      // porte le faire devenir opposable — donc il ne le fait pas.
      exigePolarite(
        metier, /gate de promotion/i,
        'PERTE — la seule voie d’un fait rappelé vers l’opposable, le gate de promotion (I3, STD-039 '
          + '§2.6). La moitié qui dit OÙ vit ce qui fait foi survit ; celle qui dit COMMENT y porter '
          + 'un rappel a disparu du gabarit entier',
      );
    },
  },

  {
    id: 'pas-de-chemin-de-machine',
    quoi: 'le gabarit ne porte aucun chemin de poste — il est déposé dans des dépôts qui ne sont pas celui-ci',
    verifier({ metier, contexte }) {
      // Un gabarit distribué qui nomme le disque d'une machine est faux partout ailleurs. Le
      // pack l'a déjà commis (« garde d'ouverture sans chemin de machine », T-20260809-0032),
      // et l'ajout 6 rouvrait précisément la porte : les ADR vivent dans un dossier
      // synchronisé dont le chemin absolu est propre à chaque poste.
      for (const [nom, texte] of [['CLAUDE.md', metier], ['CONTEXTE.md', contexte]]) {
        const trouve = texte.match(/\/Users\/[a-z]|\/home\/[a-z]|CloudStorage|Disques partagés/i);
        assert.ok(!trouve, `${nom} porte un chemin de machine (« ${trouve && trouve[0]} ») : faux dans tout autre dépôt que celui-ci`);
      }
    },
  },

  {
    id: 'contexte-appele-et-necessaire',
    quoi: 'le métier renvoie au contexte pour ce qu’il ne peut pas savoir, et le contexte porte ses trois rubriques',
    verifier({ metier, contexte }) {
      // La frontière entre les deux fichiers n'existe que si le métier RENVOIE réellement au
      // contexte. Les trois rubriques sont celles que le dirigeant a énoncées : « le contexte
      // porte à qui il répond, qui est le gestionnaire client de ce projet, quelle est sa
      // portée ». Un gabarit qui les perdrait ferait un orchestrateur sans destinataire.
      // ⚠️ LA SONDE DU VERBE DOIT ÊTRE ANCRÉE. La première version cherchait `/lis/i` dans
      // la ligne : `herdr agent list`, cité deux lignes plus bas, la satisfaisait. La garde
      // survivait donc au remplacement de l'appel par une simple mention — le contresens
      // exact de ce qu'elle prétendait garder.
      const appels = metier
        .split('\n')
        .filter((l) => !l.trim().startsWith('>'))
        .filter((l) => /\blis\b[^\n]*`CONTEXTE\.md`/i.test(l));
      assert.equal(
        appels.length, 1,
        `le métier doit dire une fois exactement de LIRE le contexte, pas seulement mentionner `
          + `qu'il existe (${appels.length} appel·s trouvé·s)`,
      );
      exigeImperatif(appels[0], 'l’appel au contexte');

      const RUBRIQUES = [
        { quoi: 'à qui il répond', sonde: /^À qui tu réponds$/i },
        { quoi: 'qui est le gestionnaire client du projet', sonde: /^Qui est le gestionnaire client de ce projet$/i },
        { quoi: 'sa portée', sonde: /^Ta portée$/i },
      ];
      // ⚠️ UN TITRE N'EST PAS UNE RUBRIQUE — la passe 2 a vidé le corps de chacune des trois
      // et rien n'a rougi. Une garde qui ne regarde que les titres laisse un contexte creux :
      // l'orchestrateur y trouve les bonnes questions et aucune place où lire les réponses.
      const rubriques = sections(contexte);
      const titres = rubriques.map((s) => s.titre);
      for (const { quoi, sonde } of RUBRIQUES) {
        const trouvees = rubriques.filter((s) => sonde.test(s.titre));
        assert.equal(trouvees.length, 1, `le contexte doit porter la rubrique « ${quoi} » (parmi : ${titres.join(' · ')})`);
        assert.ok(
          trouvees[0].corps.trim().length > 120,
          `la rubrique « ${quoi} » est vide ou creuse (${trouvees[0].corps.trim().length} caractères) : `
            + `un gabarit qui pose la question sans ménager la place de la réponse ne se remplit pas`,
        );
        // Et elle doit porter des emplacements à renseigner : c'est ce qui distingue un gabarit
        // d'un texte fini, et ce que le contexte dit lui-même — « un orchestrateur qui trouve un
        // chevron le dit plutôt que de deviner ».
        assert.match(
          trouvees[0].corps, /<[^>]{10,}>/,
          `la rubrique « ${quoi} » ne porte aucun emplacement à renseigner : rien n’indique à qui `
            + `la remplit ce qu’on attend d’elle`,
        );
      }

      // L'interdit que le contexte porte, et qui ne vit nulle part ailleurs pour lui : il ne
      // parle jamais au client. La revue l'a retiré sans qu'aucun contrôle s'en aperçoive.
      const interdits = contexte.split('\n').filter((l) => /client, ni de près ni de loin/i.test(l));
      assert.equal(interdits.length, 1, `le contexte doit dire une fois exactement qu’il ne parle jamais au client (${interdits.length})`);
      exigeImperatif(interdits[0], 'l’interdit de parler au client');
    },
  },

  {
    id: 'frontiere-des-deux-fichiers',
    quoi: 'chaque gabarit dit lequel des deux est remplacé et lequel n’est jamais touché',
    verifier({ metier, contexte }) {
      // Même garde que sur le lot du gestionnaire, et pour la même raison : si les deux
      // avertissements s'inversent, ce qui est propre au dépôt est écrit dans le fichier que
      // la prochaine mise à jour remplace. Perte silencieuse.
      //
      // La première version de cette garde, là-bas, était DÉCORATIVE — c'est le harnais de
      // mutation qui l'a dit, pas une relecture. Elle tient parce que chaque ligne NOMME le
      // fichier dont elle parle : on apparie alors la polarité au sujet qu'elle gouverne.
      for (const [nom, texte] of [['CLAUDE.md', metier], ['CONTEXTE.md', contexte]]) {
        // On ne retient que les lignes d'avertissement qui NOMMENT l'un des deux fichiers :
        // l'en-tête du métier porte aussi les deux principes fondateurs, dont l'un contient
        // « jamais » (« un agent qui orchestre n'exécute jamais »). Sans ce filtre, la garde
        // rougissait sur un gabarit correct — et une garde rouge à tort finit désactivée.
        const entete = enteteDe(texte).filter((l) => /`(?:CLAUDE|CONTEXTE)\.md`/.test(l));
        assert.ok(entete.length >= 2, `${nom} doit s’ouvrir sur un avertissement qui dit à qui appartient chacun des deux fichiers`);

        const sujetDe = (sonde, polarite) => {
          const lignes = entete.filter((l) => sonde.test(l));
          assert.equal(lignes.length, 1, `${nom} : une seule ligne doit porter « ${polarite} » (${lignes.length} trouvée·s)`);
          const nommes = ['CLAUDE.md', 'CONTEXTE.md'].filter((f) => lignes[0].includes(`\`${f}\``));
          assert.equal(nommes.length, 1, `${nom} : « ${lignes[0]} » doit nommer exactement un fichier`);
          return nommes[0];
        };

        assert.equal(sujetDe(/remplac/i, 'remplacé'), 'CLAUDE.md', `${nom} : la frontière est inversée`);
        assert.equal(sujetDe(/jamais/i, 'jamais touché'), 'CONTEXTE.md', `${nom} : la frontière est inversée`);
      }
    },
  },

  {
    id: 'il-orchestre-il-n-execute-pas',
    quoi: 'les interdits fondateurs ont survécu au déplacement — il ne code pas, ne relit pas le code, n’ouvre que des chefs d’équipe',
    verifier({ metier }) {
      // Ce que le dirigeant a rappelé le 2026-08-12 : « les moyens à lui retirer sont déjà
      // décrits dans le skill existant ». Ils voyagent avec le métier — encore faut-il qu'ils
      // arrivent. La table des trois niveaux est résolue par en-tête : permuter « ce qu'il
      // fait » et « ce qu'il ne fait jamais » ferait un orchestrateur qui code.
      const s = sectionDe(metier, /Les trois niveaux/i, 'sur les trois niveaux');
      const table = tableDe(s.corps);
      const fait = colonne(table, /^Ce qu'il fait$/i, 'ce qu’il fait').join(' ');
      const jamais = colonne(table, /^Ce qu'il ne fait \*\*jamais\*\*$/i, 'ce qu’il ne fait jamais').join(' ');

      for (const [sonde, quoi] of [
        [/ne code pas/i, 'ne pas coder'],
        [/ne relit pas le code/i, 'ne pas relire le code'],
        // ⚠️ LA SONDE TENAIT À UN ARTICLE (2026-08-17). Elle cherchait « qui ne soit UN chef
        // d'équipe » ; le texte écrit « n'ouvre aucun agent qui ne soit chef d'équipe ».
        // C'est le même interdit, à un mot de grammaire près — et la garde criait dessus.
        // Ce qu'on garde est la RESTRICTION (aucun agent hors chef d'équipe), jamais sa forme.
        [/n'ouvre aucun agent qui ne soit\b[^|]*chef d'équipe|n'ouvre que des chefs d'équipe/i, 'n’ouvrir que des chefs d’équipe'],
      ]) {
        assert.match(jamais, sonde, `« ${quoi} » doit figurer du côté de ce qu’il ne fait jamais`);
        assert.ok(!sonde.test(fait), `« ${quoi} » figure du côté de ce qu’il fait — la table est inversée`);
      }

      // Et LES DEUX principes fondateurs.
      //
      // La première version n'en gardait qu'un, alors que son titre en promettait trois. Une
      // revue a retiré le second — celui qui interdit d'ouvrir un agent qui ne soit pas un
      // chef d'équipe — et rien n'a rougi : le contrôle regardait ce qui était certain d'être
      // là plutôt que ce qu'il prétendait garder. C'est le motif dominant du dépôt, appliqué
      // cette fois à une garde que j'écrivais moi-même.
      //
      // ⚠️ LES DEUX ÉTAIENT GARDÉS COMME DES SLOGANS DU PRÉAMBULE, CITÉS AU POINT PRÈS
      // (« Un agent qui orchestre n'exécute jamais. », « L'orchestrateur ne déploie que des
      // chefs d'équipe qui gèrent des sous-agents. »). Ces deux phrases n'existent plus —
      // MAIS LES DEUX RÈGLES ONT CHANGÉ DE STATUT PLUTÔT QUE DISPARU, et c'est un
      // renforcement : elles ne sont plus des affirmations de préambule, elles sont écrites
      // là où le lieu de l'orchestrateur les REFUSE MÉCANIQUEMENT — la table de
      // « Ce que tu ne peux pas faire », qui apparie chaque geste refusé par le fichier de
      // droits avec ce que ce refus ferme. Mesuré avant de déplacer la sonde : c'est le seul
      // endroit du gabarit où les deux règles sont énoncées ensemble, et c'est celui où elles
      // servent. Garder les phrases d'hier aurait gardé deux citations ; on garde les deux
      // refus, qui sont ce que les principes FONT.
      const sRefus = sectionDe(metier, /^Ce que tu ne peux pas faire$/i, 'sur ce que ses droits lui refusent');
      const tRefus = tableDe(sRefus.corps);
      const refuses = colonne(tRefus, /^Ce qui t'est refusé$/i, 'ce qui t’est refusé');
      const ferme = colonne(tRefus, /^Ce que ça ferme$/i, 'ce que ce refus ferme');
      const rangDuRefus = (sonde) => refuses.findIndex((c) => sonde.test(c));

      const rEcrire = rangDuRefus(/Écrire ou modifier un fichier/i);
      assert.ok(
        rEcrire >= 0,
        'le premier principe — orchestrer n’est pas exécuter — n’est plus refusé nulle part : sans le '
          + 'refus d’écrire, « un agent qui orchestre n’exécute jamais » redevient une intention',
      );
      exigePolarite(
        ferme[rEcrire], /devient (?:un )?exécutant/i,
        'le premier principe — ce que le refus d’écrire ferme, c’est de devenir exécutant sans s’en apercevoir',
        // ⚠️ PAS D'`inverse` ICI, ET C'EST MESURÉ. Une première version interdisait « je code
        // juste ce petit bout » / « corrige son script » comme polarité contraire : la cellule
        // CITE ces deux phrases, entre guillemets, comme les deux gestes qu'elle ferme. La
        // garde criait donc sur du texte parfaitement correct — le second chiffre en action.
        // Un `inverse` juste devrait distinguer la citation de l'affirmation, ce que la regex
        // ne sait pas faire ; on garde la voie A (renversement dans la phrase porteuse) et on
        // écrit ici pourquoi la voie B est absente, plutôt que de la poser fausse.
      );

      const rSousAgent = rangDuRefus(/Ouvrir un sous-agent/i);
      assert.ok(
        rSousAgent >= 0,
        'le second principe — il n’ouvre que des chefs d’équipe — n’est plus refusé nulle part : '
          + 'l’orchestrateur ouvre alors ce qu’il veut, et fait du travail de chef d’équipe sans le nommer',
      );
      exigePolarite(
        ferme[rSousAgent], /tu n'ouvres (?:que|rien d'autre que) des chefs d'équipe/i,
        'le second principe — il n’ouvre que des chefs d’équipe',
        { inverse: /tu (?:peux|pourras) ouvrir (?:aussi |également )?(?:un|des) sous-agents?/i },
      );
      // Et la moitié du principe qu'on perd en premier : ce sont EUX qui distribuent. Sans
      // elle, « n'ouvre que des chefs d'équipe » se lit comme une règle de nommage, et le
      // niveau des sous-agents remonte chez l'orchestrateur sans qu'une phrase change.
      exigePolarite(
        ferme[rSousAgent], /qui (?:distribuent|répartissent|confient)[^|]*(?:à|entre) leurs sous-agents/i,
        'et ce sont EUX qui distribuent à leurs sous-agents — la moitié qui empêche le niveau de remonter',
      );
    },
  },

  {
    id: 'anti-patterns-des-ajouts',
    quoi: 'les six ajouts ont leur miroir dans les anti-patterns, du côté des fautes',
    verifier({ metier }) {
      // Une table d'anti-patterns dont on retire une ligne est le mode de régression le plus
      // silencieux d'un document : rien ne casse, et la faute redevient tentante. La colonne
      // est résolue par son en-tête — sinon permuter les deux libellés ferait de chaque faute
      // une raison de la commettre.
      const s = sectionDe(metier, /^Anti-patterns$/i, 'd’anti-patterns');
      const table = tableDe(s.corps);
      const fautes = colonne(table, /^Ce qu'on est tenté de faire$/i, 'ce qu’on est tenté de faire');
      const raisons = colonne(table, /^Pourquoi ça casse$/i, 'pourquoi ça casse').join(' ');

      const FAUTES = [
        // ⚠️ RÉ-ANCRÉE PAR LA FONCTION (2026-08-17). La sonde cherchait la TOURNURE de la
        // faute (« … agent spécialisé AU LIEU DE lui poser une question ») ; la réécriture
        // la nomme par le geste seul — « Confier une unité de travail à un agent spécialisé »
        // — et la met en regard de son coût (« il porte ton chantier sans en répondre : tu
        // deviens un guichet »). La faute est nommée, et nommée mieux. Ce qu'on garde est le
        // GESTE fautif (confier une unité de travail à un spécialiste), pas la façon dont il
        // est opposé au bon geste.
        { quoi: 'sous-traiter à un spécialiste', sonde: /unité de travail à un (?:agent )?spécialis(?:é|te)/i },
        { quoi: 'commencer sans ligne', sonde: /sans avoir ouvert sa ligne/i },
        { quoi: 'compter sur la veille pour savoir qu’un agent a fini', sonde: /veille de déblocage pour savoir/i },
        { quoi: 'sauter le topo', sonde: /sauter le topo/i },
        { quoi: 'brieffer sans l’ADR applicable', sonde: /sans lui donner l'ADR/i },
      ];
      for (const { quoi, sonde } of FAUTES) {
        assert.equal(fautes.filter((c) => sonde.test(c)).length, 1, `« ${quoi} » doit être nommée une fois exactement comme une faute`);
        assert.ok(!sonde.test(raisons), `« ${quoi} » figure du côté des raisons — les deux colonnes sont inversées`);
      }

      // Les anti-patterns du métier d'origine sont couverts par `le-metier-a-voyage-entier`,
      // qui compare la table entière : inutile de les redire ici.
    },
  },

  {
    id: 'aucune-substitution',
    quoi: 'le gabarit du métier est identique pour tous les dépôts — donc comparable octet pour octet',
    verifier({ metier }) {
      // Ce qui rendra la mise à jour des copies posées (lot suivant) capable de détecter une
      // divergence sans deviner. Un seul emplacement à substituer, et il faudrait re-rendre
      // le gabarit pour comparer.
      for (const moteur of [/\{\{[^}]+\}\}/, /%%[^%]+%%/, /<%[^%]*%>/]) {
        const trouve = metier.match(moteur);
        assert.ok(!trouve, `le gabarit porte un emplacement à substituer (« ${trouve && trouve[0]} ») : il cesse d’être comparable tel quel`);
      }
    },
  },

  {
    id: 'gestes-de-session-existants',
    quoi: 'chaque commande de session enseignée s’adresse à un objet connu et est employée par la compétence de référence',
    verifier({ metier }) {
      // L'outil de session n'est pas versionné ici : on n'admet que des formes déjà employées
      // par la compétence éprouvée, relevées dans ses BLOCS DE COMMANDES et jamais dans sa
      // prose — celle-ci cite nommément des contre-exemples (`herdr wait output`, qui n'existe
      // pas). Les ajouts introduisent des commandes : c'est le moment où l'on en invente une.
      const reference = readFileSync(join(REPO, CHEMIN_COMPETENCE), 'utf8');
      const formes = (t) => new Set([...t.matchAll(/\bherdr ([a-z-]+ [a-z-]+)/g)].map((m) => m[1]));
      const connues = formes(blocsBash(reference).join('\n'));
      assert.ok(connues.size >= 5, 'les formes de référence n’ont pas été relevées — le contrôle ne prouverait rien');

      for (const forme of formes(blocsBash(metier).join('\n'))) {
        assert.ok(['pane', 'agent', 'tab'].includes(forme.split(' ')[0]), `« herdr ${forme} » ne s’adresse à aucun objet connu — inventé ?`);
        assert.ok(connues.has(forme), `« herdr ${forme} » n’est employé nulle part ailleurs dans le pack — inventé ?`);
      }
    },
  },

  {
    id: 'inscrire-avant-de-tenir-a-jour',
    quoi: 'le gabarit prescrit d’INSCRIRE avant de faire — l’ordre, les quatre cas, le critère et sa borne — sous la promesse qui ouvre R1, et ça ne se confond pas avec « tiens le ServiceDesk à jour »',
    verifier({ metier }) {
      // T-20260813-0043. §7 était écrite, et bonne : elle traitait du SUIVI de ce qui existe
      // déjà. Elle ne disait nulle part qu'une tâche doit exister au registre AVANT d'être
      // faite — angle mort exact, payé trois fois dans la même journée par l'orchestrateur
      // lui-même (une publication sans ticket, un défaut corrigé au vol sans ticket, une
      // Demande restée `received` deux jours pendant que ses lots étaient en production).
      //
      // ⚠️ LE PIÈGE DE CE LOT, NOMMÉ D'AVANCE. Le métier parle DÉJÀ beaucoup du ServiceDesk :
      // une garde qui chercherait « ticket », « registre » ou « documenter » serait verte avant
      // qu'une ligne soit écrite. Et la substitution qui compte — remplacer le principe par
      // « tiens le registre à jour », qui est ce que le texte disait déjà — laisserait un
      // principe parfaitement plausible en ayant vidé l'ajout. Tout ce qui suit garde donc la
      // POSITION, la POLARITÉ et le COMPTE, jamais la présence d'un mot.
      // ⚠️ RÉ-ANCRAGE PAR LA FONCTION (lot 3, 2026-08-17), ET CE QUI A ÉTÉ MESURÉ AVANT DE LE
      // FAIRE. La sonde `/Tenir le ServiceDesk/` désignait §7 ; elle désigne aujourd'hui le
      // BLOC `R1 — Tenir le ServiceDesk du chantier`, dont le corps borné n'est plus que la
      // promesse d'ouverture. La garde rougissait sur « 2 énoncés pour 1 attendu » — un
      // artefact de la mauvaise section, pas un compte à relever.
      //
      // Le terrain de la fonction est la sous-section `## Inscrire vient avant tenir à jour`,
      // et elle est DÉSIGNÉE PAR L'ORDRE QU'ELLE ÉNONCE (`/vient avant/`) plutôt que par son
      // libellé : l'inverser reste alors une rougeur sur la POLARITÉ, au lieu d'une « section
      // introuvable » qui n'apprend rien.
      const s = sectionDe(metier, /vient avant/i, 'qui énonce l’ordre entre inscrire et tenir à jour');

      // ── L'ORDRE DES DEUX GESTES, EN POLARITÉ. Il n'est plus écrit dans une ligne du corps :
      // il EST le titre de la section. Le LIEU a changé, la fonction non — et un titre est du
      // texte comme un autre. Les permuter laisse la phrase debout et remet le métier
      // exactement là où il était avant T-20260813-0043.
      const [premier, second] = s.titre.split(/vient avant/i);
      exigeImperatif(s.titre, 'l’ordre des deux gestes');
      assert.match(premier, /inscrire/i, `« ${s.titre} » : c’est INSCRIRE qui vient en premier`);
      assert.match(second, /tenir à jour/i, `« ${s.titre} » : … et tenir à jour qui suit — les deux gestes sont inversés`);

      // ── LE PRINCIPE, EN POSITION ET EN POLARITÉ.
      //
      // ⚠️ CE QUE LA RECONSTRUCTION A DÉPLACÉ, ET CE QU'ELLE A RETIRÉ — les deux sont écrits
      // ici plutôt que tus, parce que le second est une PERTE et qu'elle se rapporte.
      //
      // DÉPLACÉ : le principe ne s'énonce plus en tête de la section d'inscription, il s'énonce
      // en tête du BLOC qui la contient. La réécriture par la fonction (`D-20260817-0006`) a
      // donné à chacun des sept blocs `R1`…`R7` une promesse en citation, suivie de ses
      // compteurs à zéro. C'est le même geste, remonté d'un cran, et il sert au même endroit :
      // il ouvre le bloc où l'inscription est prescrite. La garde suit ce déplacement.
      //
      // RETIRÉ : la phrase du CTO — « une tâche non documentée est une tâche non suivie » — et
      // avec elle la POLARITÉ de l'inexistence (c'est ce qui N'EST PAS au ServiceDesk qui
      // n'existe pas) ne figurent plus nulle part dans R1. Le seul endroit du gabarit qui porte
      // encore cette inexistence est la table des anti-patterns (« Faire un travail qu'aucun
      // ticket ne décrit | Il n'existe pour personne »), gardée par
      // `anti-patterns-de-l-inscription`. Le contenu survit ; le LIEU, non. C'est signalé au
      // chef d'équipe plutôt que réparé ici : le gabarit est gelé pour ce lot.
      //
      // Ce qui reste gardé ici est la PRESCRIPTION, qui elle est intacte et au complet : la
      // promesse du bloc, l'ordre, les quatre cas, le critère et sa borne.
      const bloc = sectionDe(metier, /^R1 — Tenir le ServiceDesk/i, 'qui tient le ServiceDesk du chantier');
      const citations = bloc.corps.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.startsWith('>'));
      assert.equal(
        citations.length, 1,
        `le bloc doit s’ouvrir sur sa promesse, énoncée une fois exactement, en citation `
          + `(${citations.length} trouvée·s) — deux promesses laissent choisir laquelle oblige`,
      );
      const promesse = citations[0];
      exigeImperatif(promesse, 'la promesse du bloc qui tient le ServiceDesk');
      // ⚠️ LA SONDE PORTE SES DEUX ANCRES — LE GESTE (« le ServiceDesk DIT ») ET SON OBJET
      // (« l'état réel DU CHANTIER ») —, et ce n'est pas de la coquetterie : `/dit l'état réel/`
      // seul s'appariait sur « le statut conTREDIT L'ÉTAT RÉEL », la ligne de compteurs qui suit
      // dans la même citation. Deux mutations de ce lot ont SURVÉCU comme ça, mesuré : la
      // promesse retirée, la garde restait verte sur son propre voisin.
      exigePolarite(
        promesse, /ServiceDesk dit l'état réel du chantier/i,
        'le ServiceDesk dit l’état RÉEL du chantier — pas ce qu’on allait faire, pas ce qu’on voudrait',
        { inverse: /état (?:approximatif|voulu|prévu|souhaité)|dit ce qu'on allait faire|peut mentir/i },
      );
      // ⚠️ LE POINT DE REPÈRE DE LA POSITION A CHANGÉ, ET C'EST ÉCRIT PLUTÔT QUE TU. La garde
      // exigeait « le principe AVANT la puce `À chaque étape …` » ; cette puce n'existe plus
      // (elle a été dissoute en sous-sections de R1 — voir `le-suivi-oblige-encore`, qui la
      // mesure et rapporte ce qu'elle a emporté). Le repère devient la section d'inscription
      // elle-même : une promesse écrite après ce qu'elle gouverne en devient la glose, exactement
      // comme avant.
      assert.ok(
        metier.indexOf(promesse) < metier.indexOf(s.titre),
        'la promesse du bloc est écrite APRÈS la section d’inscription — elle en devient une glose, '
          + 'alors que tout ce que le bloc prescrit (statuts, filiation, compte rendu) suppose le '
          + 'travail déjà inscrit',
      );

      // ── LES QUATRE CAS, EN COMPTE ET EN POLARITÉ D'EN-TÊTE. C'est là que ça se troue :
      // chacun est un manquement réel, et une table dont on retire une ligne est le mode de
      // régression le plus silencieux d'un document.
      const table = tableDe(s.corps);
      const natures = colonne(table, /^Ce qui naît en chantier$/i, 'ce qui naît en chantier');
      const inscriptions = colonne(table, /^Ce que tu inscris, et quand$/i, 'ce que tu inscris, et quand');

      // ⚠️ SONDES RÉ-ANCRÉES SUR LES CELLULES RÉELLES (lot 3) : la reconstruction a mis les
      // quatre cas à la troisième personne du texte (« le travail QUE TU TE DONNES », « une
      // tâche CONFIÉE à un chef d'équipe ») là où ils s'adressaient directement. Ce sont les
      // quatre MÊMES cas, dans le même ordre, avec les mêmes moments — seule la tournure a
      // bougé. Le compte, la colonne, le moment et la modalité restent exigés à l'identique.
      const CAS = [
        { quoi: 'le travail qu’il se donne à lui-même', sonde: /travail que tu te donnes/i, quand: /\*\*avant\*\* de le faire/i },
        { quoi: 'un défaut trouvé en chemin', sonde: /défaut trouvé en chemin/i, quand: /dans l'heure/i },
        { quoi: 'un ajustement demandé en cours de route', sonde: /ajustement demandé en cours de route/i, quand: /au moment où il est reçu/i },
        { quoi: 'une tâche confiée à un chef d’équipe', sonde: /confiée à un chef d'équipe/i, quand: /filiation/i },
      ];
      assert.equal(table.lignes.length, CAS.length, `${table.lignes.length} cas écrit(s) pour ${CAS.length} gardé(s)`);
      for (const { quoi, sonde, quand } of CAS) {
        const i = natures.findIndex((n) => sonde.test(n));
        assert.ok(i >= 0, `le cas « ${quoi} » doit figurer du côté de ce qui naît en chantier`);
        assert.ok(
          !sonde.test(inscriptions.join(' ')),
          `« ${quoi} » est donné comme ce qu’on inscrit — les deux colonnes de la table sont inversées`,
        );
        assert.match(inscriptions[i], quand, `le cas « ${quoi} » ne dit plus QUAND il s’inscrit (« ${inscriptions[i]} »)`);
        // LA MODALITÉ, TROISIÈME AXE — et il manquait ici, relevé en revue de fond. La cellule
        // peut garder sa colonne, son rang et sa portion littérale gardée, et cesser d'obliger
        // par une clause ajoutée APRÈS : « **avant** de le faire, si tu en as le temps ». Le
        // fragment cherché est toujours là, la consigne ne vaut plus rien.
        exigeImperatif(inscriptions[i], `le cas « ${quoi} »`);
      }

      // ── LE CRITÈRE, ET SON CONTRE-ÉCUEIL. Sans lui, le principe produit du bruit — et le
      // bruit tue une règle plus sûrement que l'oubli. Gardé en polarité : le permuter ferait
      // ouvrir un ticket par commande lancée.
      const criteres = s.corps.split('\n').filter((l) => /le critère est/i.test(l));
      assert.equal(criteres.length, 1, `le critère doit être énoncé une fois exactement (${criteres.length})`);
      const [retenu, exclu] = criteres[0].split(/,\s*jamais/i);
      exigeImperatif(criteres[0], 'le critère');
      assert.ok(exclu !== undefined, 'le critère doit dire ce qu’il EXCLUT, pas seulement ce qu’il retient');
      assert.match(retenu, /travail qui a un résultat/i, `« ${criteres[0].trim()} » : le critère est le travail qui a un résultat`);
      assert.match(exclu, /geste/i, `« ${criteres[0].trim()} » : … et ce n’est pas le geste`);
      assert.ok(!/\bgeste\b/i.test(retenu), 'le geste est donné comme le critère — la polarité est inversée, et un ticket par commande lancée s’ensuit');

      // ── OÙ LE PRINCIPE S'ARRÊTE. Le cas limite tranché en écrivant : un travail entièrement
      // décrit par un ticket existant en est l'aboutissement, pas un travail de plus.
      //
      // ⚠️ CE QUI A CHANGÉ DE FORME ICI, ET POURQUOI CE N'EN EST PAS UN ASSOUPLISSEMENT.
      // L'ancienne version illustrait la borne par DEUX PUBLICATIONS APPARIÉES — celle qui ne
      // livre qu'un ticket connu, celle qui en regroupe plusieurs — et la garde exigeait les
      // deux moitiés côte à côte, pour qu'une permutation se voie. L'exemple ne figure plus
      // dans le gabarit reconstruit ; ce qui le remplace est **la question qui tranche** (« as-tu
      // quelque chose à écrire que le ticket existant ne dit pas ? »), qui couvre les deux sens
      // au lieu de les illustrer. La garde suit : elle exige le critère (« en entier »), la
      // conséquence (pas de second ticket), et la question — trois éléments, comme avant, dont
      // un porte à lui seul la bidirectionnalité que l'exemple portait à deux.
      const arrets = s.corps.split('\n').filter((l) => /aboutissement/i.test(l));
      assert.equal(arrets.length, 1, `le métier doit dire une fois exactement où le principe s’arrête (${arrets.length})`);
      // Le cas limite est celui qui appelle le plus une échappatoire : « … n'en demande pas un
      // second, SAUF si le CTO en demande un » laisse le critère écrit et le rend nul.
      exigeImperatif(arrets[0], 'l’endroit où le principe s’arrête');
      assert.match(
        arrets[0], /décrit \*\*en entier\*\*/i,
        'le critère qui sépare les deux doit être écrit — « en entier », pas « à peu près »',
      );
      assert.match(
        arrets[0], /n'en demande pas un second/i,
        'et sa conséquence : un travail que le ticket existant décrit en entier n’en demande pas un second',
      );
      assert.match(arrets[0], /que le ticket existant ne dit pas/i, 'et la question qui tranche doit être posée');
    },
  },

  {
    id: 'transition-initiale-de-la-demande',
    quoi: 'la Demande passe `received → in_analysis` au moment où l’orchestrateur prend le chantier — c’est une mécanique, pas une écriture de ServiceDesk',
    verifier({ metier }) {
      // T-20260813-0043, la troisième preuve et la plus instructive : `D-20260813-0002` a dit
      // « reçue » pendant deux jours alors que ses deux lots étaient livrés et publiés. Ce
      // n'est pas un oubli d'écriture — c'est un geste manuel jamais posé qui a rendu
      // INOPÉRANTE toute la cascade en aval, les déclencheurs partant de `in_analysis`.
      //
      // La table des statuts mentionnait déjà l'exception (« sauf `received → in_analysis` qui
      // t'appartient ») : une garde qui se contenterait de trouver la transition dans §2 serait
      // verte sur le texte d'avant. On exige donc une PRESCRIPTION hors de la table, avec son
      // moment et son motif.
      //
      // ⚠️ RÉ-ANCRAGE PAR LA FONCTION (lot 3, 2026-08-17). La sonde cherchait `§2. Cadrer`, un
      // RANG qui n'existe plus. Le geste n'a pas déménagé au hasard : il vit là où la fonction
      // s'exerce — la section qui dit quand un statut change —, à côté de la table des statuts
      // qu'il faut continuer d'opposer à la prescription. C'est un déplacement de sonde, pas un
      // assouplissement : les cinq exigences (une prescription hors table, son moment, sa
      // mécanique, le départ des déclencheurs, l'incident qui prouve le coût) sont inchangées.
      //
      // ⚠️ LA SONDE NE PORTE PAS SUR LE VERBE DU TITRE, ET C'EST MESURÉ. `/statut change/`
      // rougissait sur « Le statut SE MODIFIE au moment où l'état change » — une reformulation
      // parfaitement légitime, attrapée par le harnais de faux positifs. Elle porte donc sur
      // l'objet de la section (le statut) et sur sa borne de début de titre, ce qui la garde
      // unique — `/statut/i` seul attraperait aussi « Merger et fermer les statuts dans le même
      // geste », et une désignation ambiguë rend l'assertion ininterprétable.
      const s = sectionDe(metier, /^Le statut\b/i, 'sur le moment où le statut change');
      const prescriptions = s.corps
        .split('\n')
        .filter((l) => !l.trim().startsWith('|'))
        .filter((l) => /received\s*→\s*in_analysis/.test(l));
      assert.equal(
        prescriptions.length, 1,
        `le geste doit être prescrit une fois exactement HORS de la table des statuts, qui se `
          + `contentait de le mentionner (${prescriptions.length} prescription·s trouvée·s)`,
      );
      const geste = prescriptions[0];
      exigeImperatif(geste, 'la transition initiale de la Demande');
      assert.match(
        geste, /au moment où tu prends le chantier/i,
        `« ${geste.trim()} » ne dit plus QUAND : différé, le geste vaut son absence — c’est déjà `
          + `ce qui s’est produit`,
      );

      // LA MÉCANIQUE, EN POLARITÉ. Le point entier est que les déclencheurs partent de
      // `in_analysis` : les faire partir de `received` rendrait le geste inutile en le gardant.
      const [, depart] = geste.split(/partent de/i);
      assert.ok(depart !== undefined, `« ${geste.trim()} » ne dit plus d’où partent les déclencheurs — le motif du geste disparaît`);
      assert.match(
        depart.trim(), /^`in_analysis`/,
        `les déclencheurs sont donnés comme partant d’ailleurs (« ${depart.trim().slice(0, 40)}… ») : `
          + `c’est de \`in_analysis\` qu’ils partent, et c’est toute la raison du geste`,
      );
      // ⚠️ CE QUI TENAIT « le métier doit dire ce que son absence coûte » ÉTAIT UNE TOURNURE
      // (« rien ne s'automatise en aval »), et elle n'est plus écrite. Ce n'est pas une perte :
      // le coût est dit par l'INCIDENT MESURÉ, gardé quinze lignes plus bas en polarité — et un
      // incident est un meilleur terrain qu'une affirmation, c'est exactement ce que la PASSE 1
      // de la revue avait relevé en ajoutant cette garde-là. On ne garde donc plus la tournure,
      // qui faisait double emploi avec l'incident et rougissait sur une reformulation légitime.
      assert.match(geste, /mécanique/i, 'et le nommer pour ce qu’il est — une mécanique, pas une écriture de ServiceDesk de plus');

      // ── LE COÛT MESURÉ, PAS SEULEMENT NOMMÉ — relevé en PASSE 1 de revue, et c'était un
      // vrai trou : « rien ne s'automatise en aval » est une affirmation, et une affirmation
      // se renégocie au premier chantier pressé. L'incident qui l'a prouvée, non. Gardé en
      // POLARITÉ, parce que le retourner serait la façon silencieuse de le vider : c'est la
      // DEMANDE qui est restée `received` pendant que ses LOTS étaient en production.
      const [immobile, pendant] = geste.split(/pendant que/i);
      assert.ok(
        pendant !== undefined,
        `« ${geste.trim()} » a perdu l'incident qui prouve le coût du geste non posé — il ne reste `
          + `qu'une prescription, et une prescription sans son coût se renégocie au premier chantier pressé`,
      );
      // ⚠️ ON APPARIE LA DERNIÈRE PHRASE, PAS TOUTE LA MOITIÉ GAUCHE — et pour deux raisons
      // mesurées. (1) Une sonde lâche sur l'ensemble s'apparierait sur la prescription
      // elle-même (« sur une Demande : `received` → … »), donc resterait verte devant l'incident
      // retourné. (2) Le VERBE ne se garde pas : « restée » → « demeurée » est une reformulation
      // légitime, et le harnais de faux positifs l'a fait rougir. Ce qui se garde est le couple
      // — la DEMANDE d'un côté, `received` de l'autre — et sa contrepartie « en production ».
      const incident = immobile.split(/(?<=[.!?])\s+/).pop();
      assert.match(incident, /^\s*une demande/i, `c’est la Demande qui est restée immobile (« ${incident.trim()} »)`);
      assert.match(incident, /`received`/, `… et c’est à \`received\` qu’elle est restée (« ${incident.trim()} »)`);
      assert.match(pendant, /en production/i, '… pendant que ses lots étaient en production — les deux sont inversés');
    },
  },

  {
    id: 'le-suivi-oblige-encore',
    quoi: 'les cinq consignes de suivi de R1 obligent toujours — celle qui porte la règle d’or n°13 comme les autres',
    verifier({ metier }) {
      // MOTIF 3 DU DÉPÔT — « un correctif qui ne couvre qu'une porte sur deux » —, relevé par la
      // contre-vérification des correctifs. Ce lot a apporté la MODALITÉ dans §7 et l'a posée sur
      // ce qu'il écrivait : la table des quatre cas, le critère, le cas limite. Les consignes
      // VOISINES, dans la même section, restaient sans aucune garde de modalité — dont celle qui
      // cite nommément la règle d'or n°13. Mesuré : « statuts au moment où l'état change, jamais
      // différés, SAUF SI TU MANQUES DE TEMPS » survivait à tout.
      //
      // Ces consignes viennent du métier transporté, pas de ce lot. Les garder ici n'est pas les
      // rejuger : c'est refuser de laisser à côté d'une garantie neuve une garantie voisine que
      // la même altération vide, et qui dit précisément la même chose que le principe qu'on ajoute.
      //
      // ⚠️ RÉ-ANCRAGE PAR LA FONCTION, ET IL A DÉCOUVERT DEUX PERTES (lot 3, 2026-08-17).
      //
      // Les cinq consignes vivaient dans une puce unique ouverte par « À chaque étape … ». Cette
      // liste n'existe plus : la reconstruction (`D-20260817-0006`) les a dissoutes en
      // sous-sections du bloc `R1 — Tenir le ServiceDesk du chantier`. La garde ne cherche donc
      // plus une PUCE — une forme —, elle cherche chaque consigne PAR SA FONCTION dans le corps
      // étendu du bloc, quel que soit le rang, le niveau de titre ou la mise en forme qui la
      // porte. Le compte reste cinq, et chacune doit encore OBLIGER.
      //
      // ⚠️ CE QUE LA MESURE A RENDU, ET POURQUOI CETTE GARDE RESTE ROUGE. Trois consignes sur
      // cinq ont un porteur dans R1 ; DEUX N'EN ONT AUCUN :
      //
      //   • « ce qui reste ouvert, et ce qui bloque quoi » — R1 n'en dit plus un mot. Ce qui
      //     s'en rapproche vit ailleurs et sert autre chose : `depends_on_ids` en R2 est le
      //     DÉCOUPAGE (posé une fois), et R5.1 fait CHERCHER ce qui bloque au fil des rondes
      //     (« la ronde rend une liste d'écarts »). Aucun des deux n'est la tenue continue du
      //     ServiceDesk, qui est la fonction de R1 ;
      //   • « ce qui appartient au dirigeant » — R1 n'en dit plus un mot non plus. Ce qui s'en
      //     rapproche est la table de récolte de R7.2 (« un arbitrage que le CTO t'a rendu sur
      //     ta ligne → une Demande ou un Projet ») et l'inscription de la décision en R6. Là
      //     encore : le contenu survit, le LIEU non.
      //
      // C'est la signature exacte que la repasse cherche — une moitié survit, l'autre disparaît ;
      // le contenu survit, le lieu non. On ne déplace donc PAS la sonde pour aller chercher la
      // fonction là où elle a atterri : la garde reste rouge et nomme les deux manquantes.
      const bloc = sectionDe(metier, /^R1 — Tenir le ServiceDesk/i, 'qui tient le ServiceDesk du chantier');
      const lignes = bloc.corpsEtendu.split('\n').filter((l) => l.trim().length > 0);

      const CONSIGNES = [
        { quoi: 'les statuts au moment où l’état change (règle d’or n°13)', sonde: /jamais différé/i },
        { quoi: 'la filiation de chaque agent ouvert', sonde: /filiation — au moment où tu ouvres/i },
        { quoi: 'le compte rendu d’avancement sur le chantier', sonde: /compte rendu d'avancement/i },
        { quoi: 'ce qui reste ouvert, et ce qui bloque quoi', sonde: /ce qui reste ouvert|ce qui bloque quoi/i },
        { quoi: 'ce qui appartient au dirigeant', sonde: /appartient au (?:CTO|dirigeant)/i },
      ];
      const absentes = [];
      for (const { quoi, sonde } of CONSIGNES) {
        const trouvees = lignes.filter((l) => sonde.test(l));
        if (trouvees.length === 0) { absentes.push(quoi); continue; }
        assert.equal(
          trouvees.length, 1,
          `« ${quoi} » doit figurer une fois exactement dans le bloc qui tient le ServiceDesk `
            + `(${trouvees.length} trouvée·s) — deux énoncés laissent choisir lequel oblige`,
        );
        exigeImperatif(trouvees[0], `la consigne de suivi « ${quoi} »`);
      }
      // Et la relecture après livraison, qui ferme le bloc : c'est elle qui rattrape ce qu'un
      // agent fermé a laissé de faux, et elle est la seule qu'aucune des cinq ne porte.
      //
      // ⚠️ ELLE EST VÉRIFIÉE **AVANT** LE CONSTAT DE PERTE, ET C'EST DÉLIBÉRÉ. Le constat plus
      // bas rougit déjà sur l'état intact du gabarit ; s'il était posé le premier, la mutation
      // `la-relecture-devient-negociable` serait « attrapée » par une rougeur qui ne la
      // concerne pas, et sa garde propre ne serait jamais exécutée. Une mutation dont la cible
      // est déjà rouge ne prouve rien tant que c'est SA ligne qui la voit.
      const relectures = lignes.filter((l) => /^\*\*Relis-toi/.test(l.trim()));
      assert.equal(relectures.length, 1, `la relecture après livraison doit être prescrite une fois exactement (${relectures.length})`);
      exigeImperatif(relectures[0], 'la relecture après livraison');

      assert.deepEqual(
        absentes, [],
        `${CONSIGNES.length - absentes.length} consigne(s) de suivi sur ${CONSIGNES.length} ont un `
          + `porteur dans « ${bloc.titre} ». Sans porteur LÀ : ${absentes.map((a) => `« ${a} »`).join(' · ')}. `
          + `Ce que ces consignes font faire n'est plus demandé à l'endroit où la fonction s'exerce — `
          + `ce qui s'en rapproche vit en R2 (le découpage), R5 (la ronde) et R7 (la récolte), qui `
          + `servent autre chose. C'est une PERTE de la reconstruction, pas un déménagement : la `
          + `garde la nomme au lieu de déplacer sa sonde pour aller la chercher où elle a atterri.`,
      );
    },
  },

  {
    id: 'anti-patterns-de-l-inscription',
    quoi: 'les trois manquements qui ont motivé le principe sont nommés comme des fautes, du côté des fautes',
    verifier({ metier }) {
      // RELEVÉ EN REVUE DE FOND, et c'était une garantie du lot NON GARDÉE DU TOUT : les trois
      // lignes que ce lot ajoute à la table d'anti-patterns n'étaient couvertes par rien.
      // `anti-patterns-des-ajouts` ne garde que les six ajouts du lot précédent, et
      // `le-metier-a-voyage-entier` ne compare que le gabarit à la compétence — or ce lot écrit
      // dans LES DEUX, identiquement. Retirer une des trois lignes des deux fichiers laissait
      // les 25 tests du gabarit verts, mesuré.
      //
      // Chacune de ces trois lignes est un manquement RÉEL de l'orchestrateur, daté du même
      // jour. Une table d'anti-patterns dont on retire une ligne est le mode de régression le
      // plus silencieux d'un document : rien ne casse, et la faute redevient tentante.
      const s = sectionDe(metier, /^Anti-patterns$/i, 'd’anti-patterns');
      const table = tableDe(s.corps);
      const fautes = colonne(table, /^Ce qu'on est tenté de faire$/i, 'ce qu’on est tenté de faire');
      const raisons = colonne(table, /^Pourquoi ça casse$/i, 'pourquoi ça casse');

      const FAUTES = [
        { quoi: 'faire un travail qu’aucun ticket ne décrit', sonde: /qu'aucun ticket ne décrit/i, cout: /n'existe pour personne/i },
        { quoi: 'greffer un défaut sur le ticket d’un voisin', sonde: /sur le ticket d'un voisin/i, cout: /ne l'y cherchera/i },
        { quoi: 'laisser une Demande à `received`', sonde: /laisser une Demande à `received`/i, cout: /part de `in_analysis`/i },
      ];
      for (const { quoi, sonde, cout } of FAUTES) {
        const i = fautes.findIndex((c) => sonde.test(c));
        assert.ok(i >= 0, `« ${quoi} » doit être nommée comme une faute — c’est un manquement mesuré, pas une idée`);
        assert.equal(fautes.filter((c) => sonde.test(c)).length, 1, `« ${quoi} » doit être nommée une fois exactement`);
        assert.ok(!sonde.test(raisons.join(' ')), `« ${quoi} » figure du côté des raisons — les deux colonnes sont inversées`);
        // Une faute sans son coût est une préférence : c'est la moitié qui se retire en premier.
        assert.match(raisons[i], cout, `l’anti-pattern « ${quoi} » n’explique plus pourquoi ça casse (« ${raisons[i]} »)`);
        exigeImperatif(raisons[i], `l’anti-pattern « ${quoi} »`);
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════════════
  // T-20260813-0062 — protéger l'orchestrateur des biais LLM, en remontant le plus haut
  // possible : d'abord ce qu'il NE PEUT PAS faire, ensuite ce qu'il relit à chaque tour,
  // ensuite le réflexe placé à l'endroit de l'acte. La liste de biais arrive dernière.
  // ═══════════════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════════════
  // ⚠️ ICI VIVAIT `les-amendements-ne-cachent-pas-une-reecriture`, ET VOICI POURQUOI IL
  // N'Y VIT PLUS (lot 2, 2026-08-17).
  //
  // Il gardait le trou que la passe 2 du lot précédent avait trouvé : inscrire une section
  // dans `SECTIONS_AMENDEES` la sortait de la comparaison octet pour octet — donc de TOUTE
  // garde, bien au-delà de l'amendement voulu. Il exigeait que chaque paragraphe d'origine
  // des trois sections amendées (§4-bis, §5, §6) se retrouve MOT POUR MOT dans le gabarit,
  // sauf ceux que `AMENDEMENTS_DU_LOT` déclarait remplacés. Ajouter était libre ; retirer
  // se déclarait.
  //
  // **Sa prémisse est la même que celle de la comparaison, et elle est tombée avec elle** :
  // il lisait la compétence `/orchestrer-chantier` comme texte d'origine, et §4-bis, §5, §6
  // n'existent plus dans le gabarit réorganisé par la fonction (`D-20260817-0006`). Sa sonde
  // ne trouvait plus ses sections — il rougissait en disant « section introuvable », ce qui
  // n'apprend rien de la garantie.
  //
  // ⚠️ **CE QU'IL GARDAIT EST GARDÉ, ET AILLEURS QUE DANS UNE COMPARAISON.** Les garanties
  // que les trois sections amendées portaient ont chacune leur contrôle, qui les cherche
  // dans le gabarit SEUL, par la fonction :
  //
  //   • §4-bis → `le-brief-va-au-registre` · `un-compte-rendu-se-verifie-avant-d-etre-valide`
  //              · `la-revue-est-lancee-par-le-chef-d-equipe` ;
  //   • §5     → `il-calibre-au-moment-ou-il-tranche` · `le-doute-est-une-information-attendue` ;
  //   • §6     → `un-ordre-transmis-porte-sa-source`.
  //
  // C'est un meilleur terrain que celui qu'on perd : ces contrôles rougissent sur ce que le
  // texte DIT, là où celui-ci rougissait sur ce qu'un autre texte contenait.
  //
  // La divergence compétence / gabarit est tracée en `T-20260817-0081`.
  // ═══════════════════════════════════════════════════════════════════════════════════

  {
    id: 'les-droits-refusent-ce-que-le-metier-promet',
    quoi: 'le fichier de droits REFUSE d’écrire un fichier et d’ouvrir un sous-agent, et le métier dit la même chose que lui',
    verifier({ metier, droits }) {
      // LE NIVEAU LE PLUS HAUT DE LA PROTECTION : ce que l'agent n'a pas le moyen de faire.
      //
      // ⚠️ CE QUI A ÉTÉ MESURÉ (Claude Code 2.1.231, 2026-08-13), et pourquoi les entrées sont
      // exigées SOUS CES FORMES-LÀ :
      //   • un refus l'emporte sur une autorisation, tient sur un dossier jamais approuvé, et
      //     tient sous `--permission-mode acceptEdits` ;
      //   • une AUTORISATION est ignorée EN ENTIER tant que le dossier n'est pas approuvé
      //     (« Ignoring N permissions.allow entries: this workspace has not been trusted ») —
      //     la liste `allow` est un confort, la liste `deny` est la garantie ;
      //   • `Write(chemin)` n'est PAS évalué sur les fichiers — Claude Code le dit lui-même :
      //     seules les règles `Edit(chemin)` le sont, et elles couvrent tous les outils
      //     d'écriture ;
      //   • `Edit(**)` laisse écrire HORS du répertoire (mesuré : `../evade.txt` créé), et
      //     `Edit(../**)` est totalement inerte. Seule la forme absolue `Edit(//**)` a fermé
      //     les quatre gestes essayés. Une de ces deux formes à la place de l'autre donnerait
      //     un fichier qu'on croit contraignant et qui ne l'est pas — pire que rien.
      // ⚠️ OÙ VIVENT LES DROITS DEPUIS T-20260816-0032, et pourquoi ils ont déménagé.
      //
      // MESURÉ le 2026-08-16 (Claude Code 2.1.233) : un lieu qui porte `permissions.allow`
      // déclenche TOUJOURS un écran de confiance renforcé — « ⚠ This folder pre-approves N tool
      // permissions … Only proceed if you trust this configuration » — et la pré-approbation ne
      // le fait pas taire. L'agent naît alors PARQUÉ : détecté, nommé, dans le bon répertoire, et
      // injoignable. C'est le geste n°5 du décompte de T-20260816-0004.
      //
      // Le fait mesuré de 2.1.231 reste vrai et c'est lui qui rend le déménagement sans coût :
      // une autorisation était DÉJÀ ignorée tant que le dossier n'était pas approuvé. Le bloc
      // `allow` n'achetait donc rien à la naissance, et il coûtait un modal. Les droits sont
      // désormais déclarés sous `somtech.droitsAccordes` — une clé que Claude Code ignore
      // (vérifié par le fait : zéro écran, zéro avertissement) — et `approuverLieu` les rend
      // effectifs dans l'`allowedTools` de l'entrée de projet.
      //
      // `permissions.deny` NE BOUGE PAS : c'est la moitié qui garantit, elle tient dès la
      // naissance, et tout ce que ce contrôle exige d'elle reste exigé mot pour mot.
      // On lit encore `permissions.allow` en second : les lieux déjà posés le portent, et un
      // contrôle aveugle à eux cesserait de garder ce qu'il garde là où ils vivent.
      const config = JSON.parse(droits);
      const deny = config.permissions?.deny || [];
      const allow = [...(config.somtech?.droitsAccordes || []), ...(config.permissions?.allow || [])];

      const REFUS = [
        { quoi: 'écrire ou modifier un fichier', entrees: ['Write', 'Edit', 'NotebookEdit', 'Edit(//**)'] },
        { quoi: 'ouvrir un sous-agent', entrees: ['Task'] },
      ];
      for (const { quoi, entrees } of REFUS) {
        for (const e of entrees) {
          assert.ok(
            deny.includes(e),
            `« ${e} » a disparu des refus : ${quoi} redevient possible — et ce qui n’est pas refusé `
              + `n’est pas interdit, c’est demandé, donc accordable par une veille`,
          );
        }
      }

      // Une autorisation ne rattrape jamais un refus (mesuré), mais un `allow` qui porte un
      // outil refusé se lit comme une permission par quiconque relit le fichier — et c'est le
      // premier pas d'un desserrage « puisque c'est déjà autorisé plus haut ».
      for (const e of allow) {
        assert.ok(
          !/^(Write|Edit|NotebookEdit|Task)\b/.test(e),
          `« ${e} » est autorisé alors que le même outil est refusé : le fichier se contredit`,
        );
      }

      // ET LE TEXTE DIT LA MÊME CHOSE QUE LE FICHIER. Les deux dérivent l'un de l'autre sinon :
      // un métier qui promet « je ne peux pas écrire » pendant que le fichier l'autorise est
      // une garantie fausse, exactement ce que ce lot existe pour empêcher.
      const s = sectionDe(metier, /Ce que tu ne peux pas faire/i, 'sur ce qui lui est mécaniquement refusé');
      const table = tableDe(s.corps);
      const cellules = colonne(table, /^Ce qui t'est refusé$/i, 'ce qui t’est refusé');
      const refuse = cellules.join(' ');
      assert.equal(table.lignes.length, REFUS.length, `${table.lignes.length} refus décrit(s) pour ${REFUS.length} posé(s) dans le fichier`);
      assert.match(refuse, /écrire ou modifier un fichier/i, 'le métier doit nommer le refus d’écrire');
      assert.match(refuse, /ouvrir un sous-agent/i, 'le métier doit nommer le refus d’ouvrir un sous-agent');

      // ⚠️ RELEVÉ PAR LA PASSE 1 DE LA REVUE, et c'est le motif dominant du dépôt appliqué à
      // ce lot même : les deux lignes ci-dessus cherchent une SOUS-CHAÎNE. Une cellule
      // réécrite en « **Écrire ou modifier un fichier** — tu peux le faire n'importe où »
      // garde les mots gardés et dit le contraire. On garde donc aussi la MODALITÉ de chaque
      // cellule : un refus qui s'assouplit ou qui s'excepte cesse d'être un refus.
      //
      // ⚠️ LES DEUX COLONNES, ET C'EST LA REVUE DE FOND QUI L'A EXIGÉ. Ne tenir la modalité que
      // sur la colonne des refus laissait poser l'exception dans la colonne d'à côté : « … tu
      // n'ouvres que des chefs d'équipe, SAUF pour la revue à deux passes, que tu peux lancer
      // toi-même » restait vert. Une exception écrite dans l'explication vide le refus aussi
      // sûrement qu'une exception écrite dans le refus.
      for (const ligne of table.lignes) {
        for (const cellule of ligne) exigeContrainte(cellule, `le refus « ${cellule.slice(0, 45)}… »`);
      }

      const ferme = colonne(table, /^Ce que ça ferme$/i, 'ce que ça ferme').join(' ');
      assert.ok(
        !/écrire ou modifier un fichier/i.test(ferme),
        'la table des refus est inversée : ce qui est refusé figure du côté de ce que ça ferme',
      );
    },
  },

  {
    id: 'la-contrainte-dit-aussi-ce-qu-elle-ne-borne-pas',
    quoi: 'le métier nomme les trois zones que le fichier de droits ne borne pas, et refuse qu’un refus se contourne',
    verifier({ metier }) {
      // Une garantie partielle qu'on présente comme totale est une garantie fausse. Le métier
      // doit donc dire OÙ la contrainte s'arrête — sans quoi un orchestrateur croira que ne
      // pas pouvoir écrire l'empêche d'exécuter, alors que le terminal reste ouvert.
      const s = sectionDe(metier, /Ce que tu ne peux pas faire/i, 'sur ce qui lui est mécaniquement refusé');
      const NON_BORNE = [
        { quoi: 'le terminal', sonde: /terminal/i },
        { quoi: 'ce qu’il fait faire ailleurs', sonde: /pane run/i },
        { quoi: 'le registre', sonde: /registre/i },
      ];
      const puces = pucesDe(s.corps).filter((p) => NON_BORNE.some(({ sonde }) => sonde.test(p)));
      assert.equal(
        puces.length, NON_BORNE.length,
        `${puces.length} zone(s) non bornée(s) nommée(s) pour ${NON_BORNE.length} — en retirer une fait `
          + `croire à une clôture qui n’existe pas`,
      );
      for (const { quoi, sonde } of NON_BORNE) {
        assert.equal(puces.filter((p) => sonde.test(p)).length, 1, `« ${quoi} » doit être nommé une fois exactement`);
      }

      // Ce qui n'est pas refusé est DEMANDÉ, pas interdit : sans cette phrase, l'absence d'un
      // geste de la liste se lit comme une interdiction, et la veille qui l'accorde passe pour
      // un incident plutôt que pour le fonctionnement normal.
      assert.match(
        s.corps, /n'est pas interdit\s*:\s*c'est demandé/i,
        'le métier doit dire que ce qui n’est pas refusé est demandé — donc accordable',
      );

      // Et le refus ne se contourne pas : c'est ici que se joue la différence entre une
      // contrainte et un obstacle.
      const enonces = s.corps.split('\n').filter((l) => /mode plus permissif/i.test(l));
      assert.equal(enonces.length, 1, `le métier doit dire une fois exactement ce qu’on ne fait pas d’un refus (${enonces.length})`);
      exigeContrainte(enonces[0], 'l’interdiction de relancer la session dans un mode plus permissif');
      assert.match(enonces[0], /refus n'est pas une panne|tu ne relances pas/i, `« ${enonces[0].trim()} » n’interdit plus le contournement`);
    },
  },

  {
    id: 'ce-qui-a-ete-mesure-garde-sa-polarite',
    quoi: 'c’est le REFUS qui l’emporte et l’AUTORISATION qui est ignorée — jamais l’inverse',
    verifier({ metier }) {
      // RELEVÉ EN REVUE DE FOND : ces deux phrases portent tout le raisonnement du dispositif,
      // et rien ne les gardait. Les inverser — « une autorisation l'emporte sur un refus » —
      // ne faisait rougir personne, et un lecteur en conclurait qu'il suffit d'ajouter une
      // autorisation pour se délier d'un refus. On garde donc le SUJET de chaque affirmation,
      // pas les mots qu'elle contient : une permutation déplace le sujet, elle ne le cache pas.
      const s = sectionDe(metier, /Ce que tu ne peux pas faire/i, 'sur ce qui lui est mécaniquement refusé');
      const puces = pucesDe(s.corps);

      const emporte = puces.filter((p) => /l'emporte sur/i.test(p));
      assert.equal(emporte.length, 1, `une seule affirmation doit dire ce qui l’emporte (${emporte.length} trouvée·s)`);
      assert.match(
        emporte[0], /^-\s*un \*\*refus\*\*/i,
        `« ${emporte[0].trim()} » : c’est le REFUS qui l’emporte sur l’autorisation — l’inverse ferait `
          + `croire qu’une autorisation ajoutée délie d’un refus`,
      );

      const ignoree = puces.filter((p) => /ignorée en entier/i.test(p));
      assert.equal(ignoree.length, 1, `une seule affirmation doit dire ce qui est ignoré (${ignoree.length} trouvée·s)`);
      assert.match(
        ignoree[0], /^-\s*une \*\*autorisation\*\*/i,
        `« ${ignoree[0].trim()} » : c’est l’AUTORISATION qui est ignorée tant que le dossier n’est pas `
          + `approuvé — l’inverse ferait tenir la garantie pour nulle à la naissance de l’agent`,
      );
      assert.match(ignoree[0], /la liste de ce qui est refusé est la garantie/i, 'et la conséquence doit être tirée : la garantie est la liste des refus');
    },
  },

  {
    id: 'la-revue-est-lancee-par-le-chef-d-equipe',
    quoi: 'les deux passes de revue sont lancées par celui qui tient le lot, jamais par l’orchestrateur — dont les droits les refusent',
    verifier({ metier }) {
      // ⚠️ LE DÉFAUT QUE LA REVUE DE FOND A TROUVÉ, ET IL ÉTAIT GRAVE.
      //
      // §4-bis(e) prescrivait la revue à deux sous-agents « pour chaque epic (si orchestrateur) ».
      // Le refus mécanique d'ouvrir un sous-agent la rendait donc impossible — silencieusement,
      // jusqu'à ce qu'il essaie. Un métier qui prescrit un geste que les droits refusent est
      // pire qu'un métier muet : il envoie contourner.
      //
      // La réconciliation retenue suit ce que le métier disait DÉJÀ ailleurs, à trois endroits :
      // l'orchestrateur « n'ouvre aucun agent qui ne soit un chef d'équipe », « lancer soi-même
      // deux sous-agents » est un anti-pattern nommé, et « c'est elle qui lit le code ; toi tu
      // vérifies qu'elle a regardé ce qu'il fallait ». La revue appartient donc à celui qui tient
      // le lot ; l'orchestrateur l'exige et vérifie les verdicts.
      const s = sectionDe(metier, /Pour chaque unité de travail/i, 'sur le brief et la boucle');
      const enonces = s.corps.split('\n').filter((l) => /qui les lance/i.test(l));
      assert.equal(enonces.length, 1, `le métier doit dire une fois exactement qui lance les deux passes (${enonces.length})`);
      exigeContrainte(enonces[0], 'l’attribution du lancement de la revue');
      assert.match(
        enonces[0], /chef d'équipe.*jamais toi|jamais toi.*chef d'équipe/i,
        `« ${enonces[0].slice(0, 70)}… » : la revue est lancée par le chef d’équipe, jamais par `
          + `l’orchestrateur — dont les droits refusent précisément ce geste`,
      );
      assert.match(enonces[0], /tes droits te le refusent/i, 'et le métier doit rattacher l’attribution au refus mécanique, sinon les deux textes dérivent');
      assert.match(
        enonces[0], /tu l'exiges dans le brief/i,
        'et dire ce qui reste à sa charge — sans quoi « ce n’est pas moi qui la lance » se lit comme « elle ne me regarde pas »',
      );
    },
  },

  {
    id: 'reflexes-qui-le-visent',
    quoi: 'les quatre pièges sont en table, l’autorité apparente ouvre, et ce qu’il dit à la place n’est pas la version complaisante',
    verifier({ metier }) {
      // La forme vient du représentant, parce qu'elle FONCTIONNE : le piège · ce que la
      // pression te fait dire · ce que tu dis à la place. Gardée par POLARITÉ (résolue aux
      // libellés d'en-tête ancrés) et par POSITION, jamais par la présence de mots.
      const s = sectionDe(metier, /Tes réflexes/i, 'sur ses réflexes');
      const table = tableDe(s.corps);
      assert.ok(table.lignes.length >= 4, `les réflexes doivent être énumérés (${table.lignes.length} trouvé·s)`);

      const iRang = colonneDe(table, /^#$/, 'le rang du piège');
      const iNom = colonneDe(table, /^Le piège$/i, 'le nom du piège');
      const rangs = table.lignes.map((l, position) => ({ rang: Number(l[iRang]), position, cle: l[iNom] }));

      // L'autorité apparente OUVRE : c'est celle dont l'absence coûte le plus vite, parce que
      // ses ordres sont exécutés sans être questionnés.
      const autorite = rangs.filter((r) => /autorité apparente/i.test(r.cle));
      assert.equal(autorite.length, 1, 'l’autorité apparente doit figurer une fois exactement — c’est le piège qui le vise en premier');
      assert.equal(autorite[0].rang, 1, `l’autorité apparente porte le rang ${autorite[0].rang} au lieu de 1`);
      assert.equal(autorite[0].position, 0, 'et elle ouvre la table — un réflexe listé en dernier se lit en dernier');

      // Les trois autres existent aussi : une table dont on retire une ligne est le mode de
      // régression le plus silencieux d'un document.
      for (const [sonde, quoi] of [
        [/complaisance/i, 'la complaisance envers ses propres agents'],
        [/calibration/i, 'la calibration'],
        [/ancrage/i, 'l’ancrage'],
      ]) {
        assert.equal(rangs.filter((r) => sonde.test(r.cle)).length, 1, `« ${quoi} » doit figurer une fois exactement`);
      }

      // LA POLARITÉ. Permuter les deux en-têtes, sans déplacer une cellule, ferait de l'ordre
      // reformulé de mémoire et du « beau travail, on fusionne » ce qu'on dit À LA PLACE.
      const pressions = colonne(table, /^Ce que la pression te fait dire$/i, 'ce que la pression te fait dire').join(' ');
      const reponses = colonne(table, /^Ce que tu dis à la place$/i, 'ce que tu dis à la place');

      const COMPLAISANTES = [/reformulé de mémoire/i, /on fusionne/i, /rendus comme un constat/i];
      for (const sonde of COMPLAISANTES) {
        assert.match(pressions, sonde, `${sonde} doit figurer sous l’en-tête « ce que la pression te fait dire »`);
      }
      for (const reponse of reponses) {
        for (const sonde of COMPLAISANTES) {
          assert.ok(!sonde.test(reponse), `« ${reponse} » est donné comme la réponse à faire alors qu’il porte ${sonde} — la polarité est inversée`);
        }
        // ET LA MODALITÉ, dans la cellule même : « évite de valider trop vite » garde sa
        // colonne, son rang et son vocabulaire, et ne contraint plus rien.
        exigeContrainte(reponse, `la réponse « ${reponse.slice(0, 40)}… »`);
      }
    },
  },

  {
    id: 'le-doute-est-une-information-attendue',
    quoi: '« je n’ai pas vérifié » est déclaré attendu et jamais une faute — aux deux endroits qui le portent',
    verifier({ metier }) {
      // Ce que STD-011 ne dit pas, et sans quoi tous les réflexes cèdent sous la pression : un
      // agent invente surtout quand admettre son ignorance semble coûteux. Écrit à deux
      // endroits — la section des réflexes et celle où il tranche —, donc gardé aux deux :
      // n'en garder qu'un laisse assouplir l'autre, et le lecteur applique ce qu'il a lu en dernier.
      const enonces = metier.split('\n').filter((l) => /je n'ai pas vérifié/i.test(l) && /information attendue/i.test(l));
      assert.equal(
        enonces.length, 2,
        `« je n’ai pas vérifié » doit être déclaré une information attendue aux DEUX endroits qui le `
          + `portent (${enonces.length} trouvé·s) — la section des réflexes et celle où il tranche`,
      );
      for (const e of enonces) {
        exigeContrainte(e, 'la déclaration que le doute est attendu');
        assert.match(
          e, /jamais une faute/i,
          `« ${e.trim()} » ne dit plus que ce n’est jamais une faute : devant un dirigeant pressé, `
            + `« je ne sais pas » se sent comme un échec, et c’est là qu’on invente`,
        );
      }
    },
  },

  {
    id: 'il-ne-s-evalue-pas-lui-meme',
    quoi: 'ses conclusions sont tenues au standard qu’il impose au code : ce qui n’a pas été repris se dit comme tel',
    verifier({ metier }) {
      // La règle d'or n°8 est déjà dans le métier pour le CODE ; elle ne l'était pas pour ses
      // propres conclusions. Trois diagnostics faux en une soirée sur un seul défaut, dont deux
      // de l'orchestrateur — et son métier portait déjà, fortement, l'anti-hallucination.
      const s = sectionDe(metier, /Tes réflexes/i, 'sur ses réflexes');
      const enonces = s.corps.split('\n').filter((l) => /tu ne t'évalues pas toi-même/i.test(l));
      assert.equal(enonces.length, 1, `le métier doit dire une fois exactement qu’il ne s’évalue pas lui-même (${enonces.length})`);
      exigeContrainte(enonces[0], 'l’interdit de s’évaluer soi-même');
      assert.match(enonces[0], /règle d'or n°8/i, 'et il doit le rattacher à la règle qui l’impose déjà au code');
      assert.match(
        enonces[0], /conclusions n'y échappent pas/i,
        'la règle doit porter sur SES CONCLUSIONS — appliquée au seul code, elle était déjà là et n’ajoute rien',
      );
      assert.match(
        s.corps, /nommer un biais ne protège pas/i,
        'et la section doit dire pourquoi la liste des biais ne suffit pas — c’est la leçon du vécu qui l’a motivée',
      );
    },
  },

  {
    id: 'le-brief-va-au-registre',
    quoi: 'le brief s’écrit au registre — jamais dans un fichier, que ses droits lui refusent de toute façon',
    verifier({ metier }) {
      // Conséquence directe du refus mécanique : un métier qui demanderait encore d'écrire un
      // fichier pousserait l'orchestrateur vers la seule porte qui reste — le terminal —,
      // c'est-à-dire lui enseignerait le contournement. Les deux moitiés se tiennent.
      const s = sectionDe(metier, /Pour chaque unité de travail/i, 'sur le brief et la boucle');
      const enonces = s.corps.split('\n').filter((l) => /^\*\*a\. Écrire le brief/.test(l));
      assert.equal(enonces.length, 1, `le métier doit dire une fois exactement où s’écrit le brief (${enonces.length})`);
      assert.match(enonces[0], /au registre/i, `« ${enonces[0].slice(0, 60)}… » : le brief doit aller au registre`);
      assert.match(enonces[0], /jamais dans un fichier/i, 'et le métier doit dire qu’il ne va pas dans un fichier');
      exigeContrainte(enonces[0], 'la consigne d’écrire le brief au registre');
      assert.match(enonces[0], /epics` action `update`|epics action update/, 'et il doit donner la surface exacte, pas une intention');

      // La livraison du brief pointe vers le registre, pas vers un chemin de fichier.
      //
      // ⚠️ ON IDENTIFIE LE BLOC DU BRIEF PAR CE QU'IL FAIT — il lit le registre — et non par
      // le fait d'être le seul à nommer `livrer.js` dans cette section (T-20260814-0138).
      // Depuis que parler à un agent passe par la même commande vérifiée, la section en porte
      // d'autres : le compte rendu du chef d'équipe, et les deux signaux du sas. Compter les
      // blocs revenait à interdire ces gestes-là pour garder celui-ci, alors que ce qui est
      // gardé est « le brief va au REGISTRE, jamais vers un chemin de fichier ».
      const avecLivraison = blocsBash(s.corps).filter((b) => b.includes('livrer.js'));
      assert.ok(avecLivraison.length >= 1, 'la section ne montre plus aucune livraison');
      const briefs = avecLivraison.filter((b) => /epics action get/.test(b));
      assert.equal(briefs.length, 1, `le brief se livre par une seule commande (${briefs.length} trouvée·s)`);
      assert.ok(!/<chemin>/.test(briefs[0]), 'la livraison pointe encore vers un chemin de fichier');
      // Et AUCUNE des autres ne doit ressusciter le chemin de fichier : c'est là que la
      // régression rentrerait, par la porte d'à côté.
      for (const b of avecLivraison) {
        assert.ok(!/<chemin>/.test(b), 'une commande de livraison pointe vers un chemin de fichier');
      }
    },
  },

  {
    id: 'un-compte-rendu-se-verifie-avant-d-etre-valide',
    quoi: 'devant un compte rendu qui conclut sans montrer, le lot attend — et la consigne contraint encore',
    verifier({ metier }) {
      // LE BIAIS QUI LE VISE, LUI, À L'ENDROIT EXACT OÙ IL SE COMMET. Il valide le travail
      // d'agents qu'il a lui-même ouverts, briefés et dimensionnés : refuser leur lot, c'est se
      // déjuger sur son propre découpage. Le métier disait qu'il « vérifie que la revue a eu
      // lieu » ; il ne disait rien de ce qu'il fait devant un compte rendu plausible.
      const s = sectionDe(metier, /Pour chaque unité de travail/i, 'sur le brief et la boucle');
      const enonces = s.corps.split('\n').filter((l) => /tant que tu ne l'as pas/i.test(l));
      assert.equal(enonces.length, 1, `le métier doit dire une fois exactement ce qu’il exige avant de valider (${enonces.length})`);
      exigeContrainte(enonces[0], 'l’exigence de preuve avant validation');
      assert.match(enonces[0], /n'est pas validé|le lot attend/i, `« ${enonces[0].slice(0, 60)}… » : sans conséquence, l’exigence n’en est pas une`);
      assert.match(enonces[0], /verdict/i, 'et elle doit nommer ce qui est exigé — un verdict par passe, pas « des preuves »');
      assert.match(
        s.corps, /n'est pas une preuve\s*:\s*la preuve est ce qu'il \*\*montre\*\*/i,
        'le métier doit distinguer un compte rendu qui CONCLUT d’un compte rendu qui MONTRE',
      );
      // Et l'exigence ne doit pas contredire l'interdit de relire le code : demander une
      // preuve n'est pas aller la chercher soi-même dans les fichiers.
      assert.match(s.corps, /n'est pas relire le code/i, 'et dire pourquoi exiger une preuve ne le fait pas relire le code');
    },
  },

  {
    id: 'un-ordre-transmis-porte-sa-source',
    quoi: 'ce qu’il transmet se recopie avec son origine — un ordre reformulé de mémoire est un ordre que personne n’a donné',
    verifier({ metier }) {
      // AUTORITÉ APPARENTE, au seul endroit où il émet vraiment des ordres. Mesuré :
      // des consignes arrivées aux équipes ne venaient de personne, 2/10 puis 5/11 puis 5/6.
      const s = sectionDe(metier, /Coordonner les chantiers voisins/i, 'sur les chantiers voisins');
      const enonces = s.corps.split('\n').filter((l) => /porte sa source/i.test(l));
      assert.equal(enonces.length, 1, `le métier doit dire une fois exactement ce que porte un message transmis (${enonces.length})`);
      exigeContrainte(enonces[0], 'l’obligation de transmettre avec la source');
      assert.match(
        enonces[0], /se recopie/i,
        `« ${enonces[0].slice(0, 60)}… » : une source qui se reformule est une source inventée`,
      );
      assert.ok(
        !/se reformule\b(?!\s*pas)/i.test(enonces[0]),
        'le métier autorise la reformulation de la source — c’est exactement l’ordre que personne n’a donné',
      );
      assert.match(s.corps, /ordre que personne n'a donné/i, 'et il doit nommer ce que devient un ordre reformulé de mémoire');
    },
  },

  {
    id: 'il-calibre-au-moment-ou-il-tranche',
    quoi: 'les trois états de ce qu’il sait sont nommés là où il décide, et « non prouvé » n’est pas « faux »',
    verifier({ metier }) {
      // C3 était pratiqué sans jamais être nommé comme une échelle. Placé en §5 — l'endroit où
      // il rend une décision —, pas en annexe : ce qui protège est le geste imposé au moment
      // où l'acte se pose.
      const s = sectionDe(metier, /Ce que tu tranches toi-même/i, 'sur ce qu’il tranche');
      const enonces = s.corps.split('\n').filter((l) => /sépare ce que tu as mesuré/i.test(l));
      assert.equal(enonces.length, 1, `le métier doit poser l’échelle une fois exactement (${enonces.length})`);
      exigeContrainte(enonces[0], 'la séparation entre ce qui est mesuré et ce qui est supposé');

      for (const etat of ['vérifié', 'déduit', 'supposé']) {
        assert.match(s.corps, new RegExp(`\\*\\*${etat}\\*\\*`, 'i'), `l’état « ${etat} » doit être nommé — une échelle à deux crans n’en est pas une`);
      }
      assert.match(
        s.corps, /non prouvée n'est pas une hypothèse fausse/i,
        'le métier doit distinguer « non prouvé » de « faux » — l’écart a coûté une soirée, et celle '
          + 'qu’on avait déclarée fausse était juste',
      );
      assert.match(s.corps, /autre session/i, 'et nommer le cas mesuré : une mesure faite ailleurs rendue comme un constat d’ici');
    },
  },

  {
    id: 'crochet-pose-par-le-dispositif',
    quoi: 'le crochet est posé par le dispositif, il n’est pas l’accusé de réception de l’orchestrateur',
    verifier({ metier }) {
      // ⚠️ CE CONTRÔLE EXISTE PARCE QUE SON JUMEAU EXISTAIT SEUL — bloquant relevé en revue de
      // fond (T-20260815-0011). Le même paragraphe a été posé dans les DEUX gabarits, et seul
      // celui du gestionnaire était gardé : supprimer le paragraphe entier du gabarit
      // orchestrateur laissait les 702 essais du CLI verts. C'est le motif dominant de ce
      // dépôt — un correctif ferme une porte et laisse sa jumelle ouverte — et il s'est
      // rejoué dans le lot qui l'avait nommé.
      //
      // Le fond est le même des deux côtés : un métier qui enseignerait « pose un crochet
      // quand tu as lu » redonnerait à la discipline de l'agent ce que le dispositif venait
      // de lui retirer — or un orchestrateur occupé est exactement celui qui n'y pense pas.
      const enonces = metier.split('\n').filter((l) => /crochet/i.test(l));
      assert.ok(enonces.length >= 1, 'le métier ne dit rien du crochet — un orchestrateur ne saura pas ce qu’il vaut');

      const dit = enonces.join('\n');

      // La garde porte sur la POLARITÉ, pas sur la présence des mots : une négation qui
      // enveloppe l'énoncé le retourne sans en toucher un seul. Et elle lit la ligne
      // PORTEUSE, pas tout ce qui parle de crochet — le paragraphe voisin contient « ce
      // n'est pas ta mémoire qui flanche », phrase saine qu'une garde plus large accuserait.
      const porteuse = enonces.find((l) => /le dispositif le pose seul/i.test(l)) || '';
      const avantLEnonce = porteuse.slice(0, porteuse.toLowerCase().indexOf('le dispositif le pose seul'));
      assert.ok(
        !/\b(?:ne crois pas|contrairement|au contraire|n['’]est pas vrai|est faux)\b/i.test(avantLEnonce),
        `« ${porteuse.trim().slice(0, 90)}… » : l'énoncé est enveloppé d'une négation — les ` +
          'mots-clés survivent à leur propre contresens',
      );
      assert.match(
        dit, /le dispositif le pose seul|tu n['’]as rien à faire/i,
        'le métier doit dire que le crochet est posé SANS l’orchestrateur — sinon il redevient une discipline',
      );
      assert.ok(
        !/\bpose(-le|s)?\s+(un\s+)?crochet\b/i.test(dit),
        'le métier enseigne à l’orchestrateur de poser un crochet : c’est ce que ce dispositif remplace',
      );
      assert.match(
        dit, /ne le remplace pas|reste utile/i,
        'le métier doit dire que « je m’en occupe » garde sa valeur — le crochet dit seulement que c’est arrivé',
      );
      // L'ABSENCE est la moitié qui a de la valeur, et elle l'est davantage pour un
      // orchestrateur : ce qu'on lui écrit et qu'il ne voit pas, ce sont des arbitrages.
      assert.match(dit, /absence/i, 'le métier doit dire ce que l’absence de crochet signifie');
    },
  },

  // ───────────────────────────────────────────────────────────────────────────────────
  // T-20260816-0015 · T-20260816-0018 · T-20260816-0006 — les garanties de CE lot.
  //
  // Ce qui suit garde ce que l'alignement sur les ADR et le feed a ajouté. Sans ces
  // contrôles, 145 lignes de règles neuves entraient dans le métier sans qu'une seule
  // mutation puisse les retourner — exactement ce que ce harnais existe pour empêcher.
  // ───────────────────────────────────────────────────────────────────────────────────

  {
    id: 'le-gabarit-fait-foi',
    quoi: 'le gabarit se déclare source, et dit POURQUOI — un orchestrateur ne lit pas la compétence',
    verifier({ metier }) {
      // La hiérarchie est le socle des autres gardes : si la compétence pouvait l'emporter,
      // tout ce que ce fichier ajoute serait contournable en lisant l'autre.
      const tete = metier.split('\n').slice(0, 20).join('\n');
      exigePolarite(tete, /fait foi/i, 'la déclaration en TÊTE — plus bas, elle serait lue après ce qu’elle gouverne');
      exigePolarite(tete, /en découle/i, 'la compétence DÉCOULE de ce fichier, pas l’inverse');
      exigePolarite(
        tete, /celui-ci qui gagne/i,
        'la règle de conflit — en cas de divergence, c’est CE fichier qui gagne',
      );
      // Le motif, pas seulement la règle : une hiérarchie sans sa raison se renégocie.
      exigePolarite(
        tete, /ne lit pas le `SKILL\.md`|ne lit pas la compétence/i,
        'le motif de la hiérarchie — c’est parce qu’un orchestrateur ne lit pas la compétence que ce fichier gagne',
      );
    },
  },

  {
    id: 'les-adr-se-lisent-au-miroir-et-une-absence-ne-prouve-rien',
    quoi: 'le métier pointe le miroir lisible, écarte le dossier illisible, et interdit de conclure d’une absence',
    verifier({ metier }) {
      // Deux moitiés, et la seconde est celle qui coûte : un registre incomplet présenté
      // comme faisant foi fabrique des « il n'y a pas d'ADR là-dessus » qui sont faux.
      const s = sectionDe(metier, /gardien des ADR/i, 'sur le rôle de gardien des ADR');
      exigePolarite(s.corps, /MCP `somcraft`/i, 'la voie réelle par où les ADR se lisent');
      exigePolarite(s.corps, /\/architecture\/adr/i, 'le chemin des décisions dans le miroir');

      exigePolarite(
        s.corps, /illisible|Operation not permitted/i,
        'le dossier du disque est illisible — sinon le prochain y perd son temps',
      );

      exigePolarite(
        s.corps, /miroir est incomplet/i,
        'le miroir est INCOMPLET — c’est ce qui rend une absence non concluante',
      );
      exigePolarite(
        s.corps, /\[non établi\]/i,
        'le mot à employer quand on ne trouve pas : `[non établi]`',
      );
      // POLARITÉ : l'interdit doit porter sur le fait de CONCLURE, pas seulement recommander la prudence.
      exigePolarite(
        s.corps, /ne conclus (donc )?jamais|tu ne conclus JAMAIS|ne prouve rien/i,
        'l’interdit d’une absence, écrit en négation ferme — « ne conclus jamais », pas « sois prudent »',
      );
    },
  },

  {
    id: 'le-feed-se-lit-avant-de-brieffer',
    quoi: 'le feed du ServiceDesk entre au cadrage — c’est là que vivent les consignes aux agents',
    verifier({ metier }) {
      // Le feed était ABSENT du métier : 54 posts et 16 consignes opposables qu'aucun
      // orchestrateur n'avait de raison de lire. La garde tient la place ET le moment.
      const s = sectionDe(metier, /Cadrer/i, 'sur le cadrage');
      exigePolarite(s.corps, /feed/i, 'le cadrage doit envoyer lire le feed');
      exigePolarite(
        s.corps, /avant de brieffer/i,
        'le moment de la lecture du feed — avant de brieffer, un feed lu après n’a rien changé',
      );
      exigePolarite(
        s.corps, /consignes aux agents/i,
        'le métier doit dire ce qu’on y trouve : des consignes, pas des annonces',
      );
      // La règle d'amendement : sans elle, un orchestrateur applique la plus ancienne des
      // deux consignes contradictoires qu'il croise.
      exigePolarite(
        s.corps, /le plus récent gagne|s['’]amende lui-même/i,
        'le métier doit dire que le feed s’amende lui-même et que le post récent gagne',
      );
    },
  },

  {
    id: 'le-verrou-du-sas-ne-fait-pas-foi',
    quoi: 'le sas se mesure par l’écart git — le verrou a failli en lecture ET en acquisition',
    verifier({ metier }) {
      // LA trouvaille du lot : le métier s'appuyait sur un verrou que le feed déclare menteur,
      // dans le paragraphe même censé faire respecter la règle d'or n°14.
      // Le sas vit dans la boucle de chantier (§4g), pas dans une section à lui.
      const s = sectionDe(metier, /Pour chaque unité de travail/i, 'sur la poussée et le sas');
      exigePolarite(
        s.corps, /ne fait pas foi/i,
        'le verrou ne fait pas foi — la garantie centrale de ce lot',
      );
      // Les DEUX défaillances : ne garder que la lecture laisserait croire qu’un `acquired: true` suffit.
      exigePolarite(
        s.corps, /acquisition/i,
        'le métier doit dire que l’ACQUISITION aussi a failli — pas seulement la lecture du verrou',
      );
      // Et la mesure de remplacement doit être exécutable, pas une intention.
      const mesure = blocsBash(s.corps).filter((b) => /origin\/main\.\.origin\/staging/.test(b));
      assert.equal(
        mesure.length, 1,
        'le métier doit donner UNE fois la mesure qui tranche : l’écart git entre main et staging',
      );
    },
  },

  {
    id: 'la-conception-precede-le-brief-de-construction',
    quoi: 'concevoir est une étape, et sauter la conception est une faute — pas une maladresse',
    verifier({ metier }) {
      // T-20260816-0006 : le métier allait de « découper » à « brieffer » sans rien entre les
      // deux. Ce qui manquait n'était pas le conseil de réfléchir, c'était le REFUS.
      const s = sectionDe(metier, /Concevoir/i, 'sur l’étape de conception');

      // POSITION : entre le découpage et la boucle de chantier. Écrite après, elle arrive
      // quand le code est déjà commandé.
      const iConcevoir = metier.indexOf('Concevoir');
      const iBoucle = metier.indexOf('La boucle');
      assert.ok(iConcevoir > 0 && iBoucle > 0, 'les deux sections doivent exister');
      assert.ok(
        iConcevoir < iBoucle,
        'la conception doit précéder la boucle de chantier — après elle, elle ne prévient plus rien',
      );

      // POLARITÉ : c'est une faute, au même rang que fermer sans QA.
      assert.match(
        s.corps, /est une faute/i,
        'le métier doit qualifier de FAUTE le brief de construction sans conception écrite',
      );
      assert.match(
        s.corps, /sans QA|ticket sans QA/i,
        'et l’adosser à une faute déjà reconnue — sinon le rang de gravité reste flou',
      );
      // La moitié qui empêche la cérémonie inutile.
      assert.match(
        s.corps, /mécanique/i,
        'le métier doit dire que le lot mécanique en est dispensé — sans quoi la règle meurt de bruit',
      );
      assert.match(s.corps, /au registre/i, 'et la conception s’écrit au registre, pas dans un terminal');
    },
  },

  {
    id: 'la-ronde-tient-l-hygiene-du-registre',
    quoi: 'la ronde regarde le ServiceDesk, signale sans fermer, et se tait quand elle ne trouve rien',
    verifier({ metier }) {
      // T-20260816-0018. Les deux pièges qui comptent plus que la liste sont gardés ici :
      // fermer à la place de quelqu'un, et parler pour ne rien dire.
      //
      // ⚠️ CE QUI A CHANGÉ : la garde lisait une seule section (« Veiller tes agents ») qui
      // portait à la fois la table du tour et les questions. Elles se sont séparées — la table
      // de ce que chaque tour parcourt est passée au déclenchement, les questions et les deux
      // pièges sont restés dans la rubrique des agents. Et le lieu que la ronde interroge ne
      // s'appelle plus « le registre du chantier » mais le ServiceDesk : la sonde suit le NOM
      // réel de l'objet, sinon elle garderait un vocabulaire mort.
      const declenchement = sectionDe(metier, /^La ronde — ce qui te réveille$/, 'sur ce que chaque tour parcourt');
      const s = sectionDe(metier, /^1 — Tes agents et le travail qui tourne$/, 'sur ce que la ronde regarde');

      // Le ServiceDesk entre dans ce que la ronde parcourt — lu par le LIBELLÉ de la colonne,
      // jamais par le rang : permuter deux en-têtes déplacerait les cellules sans se voir.
      const parcours = colonne(tableDe(declenchement.corps), /^Ce que tu regardes$/, 'ce que chaque tour parcourt');
      assert.ok(
        parcours.some((c) => /ServiceDesk/i.test(c)),
        'le tour de ronde doit parcourir le ServiceDesk — sinon un ticket fini qui traîne ne fait aucun bruit',
      );

      // Les cinq questions, en compte : en retirer une ne casserait rien d'autre.
      const QUESTIONS = [
        { quoi: 'un ticket fini qui n’a pas bougé', sonde: /ready_to_deploy/i },
        { quoi: 'un ticket en cours sans agent vivant', sonde: /in_progress`? sans agent vivant/i },
        { quoi: 'la fusion et le ticket qui se contredisent — dans les deux sens', sonde: /et l['’]inverse/i },
        { quoi: 'un agent assigné qui n’existe plus', sonde: /assigné qui n['’]existe plus/i },
        { quoi: 'un défaut publié mais pas installé', sonde: /publié n['’]est pas installé/i },
      ];
      for (const { quoi, sonde } of QUESTIONS) {
        exigePolarite(s.corps, sonde, `la question « ${quoi} » que la ronde pose au registre`);
      }

      // PIÈGE 1 — signaler n'est pas fermer. La polarité est tout : « tu peux fermer » ruinerait la garantie.
      // ⚠️ VOIE B — cette garantie est la plus lourde du lot, et elle n'a AUCUN filet ailleurs :
      // la section n'existe pas dans la compétence, donc la comparaison octet pour octet ne la
      // rattrape pas. On n'y garde donc pas la tournure (filtre) mais le FAIT : quelle que soit
      // la façon de l'amener, la section ne doit jamais autoriser la ronde à fermer.
      //
      // Le motif inverse est écrit étroit exprès : le texte dit légitimement « Fermer un ticket
      // parce qu'une fusion est passée, c'est confondre… » et « un agent fini se ferme (§4f) ».
      // Interdire « fermer » en général rougirait sur du texte correct — donc on ne vise que les
      // formes qui AUTORISENT.
      exigePolarite(
        // ⚠️ SONDE ÉLARGIE À LA REFORMULATION DU MÊME REFUS — même campagne, même motif :
        // « Tu signales ; fermer n'est pas ton geste » dit exactement ce que « tu ne fermes
        // pas » dit, et faisait crier la garde. On exige la négation du geste de fermer, pas
        // sa tournure.
        s.corps, /tu ne fermes pas|fermer n'est pas ton geste/i,
        'la ronde SIGNALE sans fermer — confondre « la PR est mergée » et « le défaut est réglé » a déjà fait rouvrir un ticket',
        { inverse: /tu peux fermer|tu dois fermer|permis de fermer|autorisée? à fermer|en réalité tu fermes|la ronde ferme/i },
      );
      exigePolarite(
        s.corps, /jamais elle/i,
        'et dire explicitement que ce n’est jamais la ronde qui tranche',
      );

      // PIÈGE 3 — les deux moitiés. Une ronde qui trouve toujours quelque chose n'est plus lue.
      exigePolarite(
        s.corps, /tu te tais|le silence est un résultat/i,
        'la ronde doit se taire quand elle ne trouve rien — sinon elle cesse d’être lue',
      );
    },
  },

  {
    id: 'le-topo-passe-les-deux-verifications-quotidiennes',
    quoi: 'les espaces orphelins et les lignes ambiguës se vérifient une fois par jour — et le critère des lignes n’est pas « le dossier existe »',
    verifier({ metier }) {
      // Elles vivent au topo, PAS dans la ronde horaire : leur objet bouge lentement, et les
      // passer à l'heure ne produirait que du bruit. La cadence fait partie de la garantie.
      const s = sectionDe(metier, /Le topo du matin/i, 'sur le topo du matin');
      exigePolarite(
        s.corps, /une fois par jour/i,
        'la cadence doit être écrite — ces deux-là ne sont pas des contrôles horaires',
      );
      exigePolarite(s.corps, /orphelin/i, 'le topo doit vérifier les espaces de travail orphelins');
      exigePolarite(s.corps, /lignes ouvertes/i, 'et les lignes ouvertes sans personne au bout');

      // LE POINT QUI FAIT LA DIFFÉRENCE, et il a été corrigé une fois déjà : le critère naïf
      // passe sur les 25 lignes et ne prouve rien. Ce qu'on cherche est l'ambiguïté d'adressage.
      // ⚠️ VOIE B — même raison que pour la ronde : cette section n'existe pas dans la compétence,
      // donc aucun filet. On garde le fait : le critère naïf ne doit jamais être réhabilité,
      // quelle que soit la tournure qui l'amène.
      exigePolarite(
        s.corps, /ne prouve rien/i,
        'vérifier l’existence du dossier NE PROUVE RIEN — sinon on écrit le contrôle inutile',
        { inverse: /dossier (?:d['’]une ligne )?existe\s*\*{0,2}\s*(?:suffit|prouve)|ce (?:test|critère) suffit|suffit à (?:le )?prouver/i },
      );
      exigePolarite(
        // ⚠️ LA SONDE A DÛ CHANGER AVEC LE CRITÈRE, ET C'EST LE PIÈGE QUI A ÉTÉ COMMIS ICI
        // AVANT D'ÊTRE VU PAR UNE MUTATION (2026-08-16).
        //
        // Elle cherchait `/même destinataire/` — donc elle restait VERTE sur la régression
        // exacte qu'on voulait interdire : ramener le critère à « deux lignes qui répondent au
        // même destinataire » laisse cette sous-chaîne en place. Corriger le libellé du message
        // sans corriger la sonde donne une garde qui DIT garder le bon critère et garde
        // l'ancien. C'est le motif dominant du dépôt, une fois de plus, à l'endroit précis où
        // l'on croyait le fermer.
        s.corps, /deux lignes de deux CHANTIERS DIFFÉRENTS/,
        'et nommer le vrai défaut : deux CHANTIERS différents au même bout du fil',
        { inverse: /le défaut (?:à nommer )?est deux lignes qui répondent au même destinataire/i },
      );

      // ⚠️ ET LE FAUX POSITIF DOIT ÊTRE NOMMÉ, SANS QUOI LA CORRECTION SE DÉFAIT.
      //
      // Un représentant de client porte DEUX lignes par définition de poste — celle de son
      // client et celle du CTO. Sans cette phrase, le prochain qui lit « deux lignes sur le même
      // terminal » réécrira le critère d'origine en croyant simplifier, et il rougira de nouveau
      // trois fois sur quatre.
      //
      // ⚠️ LA SONDE A ÉTÉ RESSERRÉE SUR CE QUI PORTE LA GARANTIE, ET SEULEMENT SUR LUI. Elle
      // cherchait « pas une anomalie, c'est sa définition de poste » ; la réécriture dit la
      // même chose sans le premier membre — « un représentant de client porte **normalement**
      // deux lignes […], c'est sa définition de poste ». La moitié « pas une anomalie » était
      // la formulation, la moitié « définition de poste » est le FAIT : c'est elle qui empêche
      // le prochain lecteur de traiter le cas normal comme un défaut. On garde le fait, et
      // `inverse` continue d'interdire qu'on le déclare anomalie, quelle que soit la tournure.
      exigePolarite(
        s.corps, /c'est sa définition de poste/i,
        'le faux positif nommé : un représentant porte deux lignes par définition de poste',
        { inverse: /deux lignes (?:pour|chez) un (?:gestionnaire|représentant) (?:est|sont) (?:une )?anomalie|porter deux lignes est (?:une )?anomalie/i },
      );
    },
  },

  {
    id: 'l-orchestrateur-est-le-bras-droit',
    quoi: 'la définition de poste — bras droit, homme de confiance — ouvre le métier, avant toute mécanique',
    verifier({ metier }) {
      // T-20260816-0099. Le dirigeant l'a dite en propres termes, et elle explique les quatre
      // points de ce ticket mieux qu'ils ne s'expliquent eux-mêmes : ce ne sont pas quatre
      // défauts séparés, ce sont quatre manières d'avoir manqué à ça.
      //
      // ⚠️ ELLE VIT DANS LE PRÉAMBULE, PAS DANS UNE SECTION — et c'est la garantie elle-même,
      // « en tête, pas en annexe ». `sections()` ne rend que ce qui suit un titre : une garde
      // écrite sur une section ne pourrait donc pas la voir. On lit le préambule directement,
      // comme `le-metier-a-voyage-entier` a dû apprendre à le faire après une revue.
      const preambule = metier.split(/^##\s/m)[0];

      exigePolarite(
        preambule, /bras droit, mon homme de confiance/i,
        'la définition de poste, dans les mots du dirigeant',
      );
      exigePolarite(
        preambule, /pas un compliment/i,
        'et c’est une définition de POSTE, pas un compliment — l’adoucir la vide entièrement',
        { inverse: /(?:n'est qu'|seulement |juste )un compliment|une simple façon de parler/i },
      );

      // ⚠️ LA POSITION EST LA GARANTIE, PAS LA PRÉSENCE.
      //
      // « Elle va EN TÊTE, pas en annexe » : un orchestrateur naît en lisant son métier, et la
      // première chose qu'il doit savoir n'est pas la mécanique des espaces de travail ni
      // l'ordre des statuts — c'est qui il est pour celui qui l'a fait naître. Reléguer ce bloc
      // plus bas laisserait TOUS SES MOTS EN PLACE et retirerait exactement ce qui compte : une
      // garde en présence resterait verte sur cette régression-là.
      //
      // ⚠️ CE QUI A CHANGÉ ICI, ET POURQUOI CE N'EST PAS UN ASSOUPLISSEMENT (2026-08-17).
      //
      // Cette garde situait la définition par rapport à un VOISIN littéral — « Tu es le
      // **pilote** d'un chantier », la phrase qui ouvrait alors les trois formes de chantier.
      // La reconstruction du métier a retiré ce repère du préambule, délibérément : le texte
      // oppose désormais les deux rôles (« un pilote exécute un plan de vol ; un bras droit
      // décide à la place de quelqu'un d'autre »), donc nommer le lecteur « le pilote » aurait
      // contredit la définition même que cette garde protège. Sa fonction — présenter les
      // trois formes de chantier — a une destination nommée : la section « Trois formes de
      // chantier » et sa table `D`/`P`/`J`. VÉRIFIÉ avant de toucher à quoi que ce soit : ce
      // n'était pas une perte, c'était un repère périmé.
      //
      // Une garde qui mesure une position contre un VOISIN ne survit pas au déplacement de ce
      // voisin — et elle rougit alors en accusant le texte d'une perte qu'il n'a pas commise.
      // On mesure donc contre ce que le texte lui-même oppose à la définition : LA MÉCANIQUE.
      // Rien de mécanique ne peut la précéder, et elle vit avant le premier titre de section.
      const rangDefinition = metier.indexOf('bras droit');
      assert.ok(rangDefinition > 0, 'la définition de poste a disparu du métier');

      const rangPremierTitre = metier.search(/^##\s/m);
      assert.ok(
        rangPremierTitre > 0 && rangDefinition < rangPremierTitre,
        'la définition de poste est passée sous un titre de section : elle n’ouvre plus le métier, '
          + 'elle le complète. Le préambule est le seul endroit qu’un orchestrateur lit à coup sûr '
          + 'avant de commencer.',
      );

      // Les trois mécaniques que le texte nomme lui-même comme ce qui vient APRÈS elle. Les
      // deux premières apparaissent dans la phrase de la définition — c'est voulu : la mesure
      // reste vraie tant que la définition les précède, et rougit dès qu'un passage mécanique
      // remonte au-dessus d'elle.
      const MECANIQUES = [
        { quoi: 'la mécanique des espaces de travail', sonde: /espaces? de travail|worktree/i },
        { quoi: 'l’ordre des statuts', sonde: /ordre des statuts/i },
        { quoi: 'un bloc de commandes', sonde: /\n```/ },
      ];
      for (const { quoi, sonde } of MECANIQUES) {
        const trouve = sonde.exec(metier);
        assert.ok(
          !trouve || trouve.index > rangDefinition,
          `${quoi} précède la définition de poste. Elle doit OUVRIR le métier, pas le compléter : `
            + 'un pilote exécute un plan de vol, et c’est précisément ce que cette phrase corrige.',
        );
      }

      // Les trois conséquences, EN COMPTE : en retirer une ne casserait rien d'autre, et c'est
      // la deuxième qui partirait — la seule qui coûte, puisqu'elle interdit de remonter un
      // arbitrage qu'on pouvait rendre soi-même. Remonter est toujours le geste confortable.
      //
      // ⚠️ LES SONDES SONT ÉCRITES SUR LE GESTE, PAS SUR LA PERSONNE (2026-08-17). Les trois
      // conséquences étaient énoncées à la troisième personne (« il ne fait pas extraire sa
      // réponse ») ; la reconstruction les adresse à l'orchestrateur (« Tu ne fais pas extraire
      // ta réponse »). Le geste gardé est le même au mot près — seule la personne a changé, et
      // une garde qui rougit sur un changement de personne rougit sur de la grammaire, pas sur
      // une garantie. Les sondes acceptent donc les deux personnes et ne lâchent rien d'autre.
      //
      // ⚠️ ET SUR SES DEUX ANCRES, PAS SUR SA TOURNURE — MESURÉ, PAS SUPPOSÉ (2026-08-17).
      //
      // Une campagne de reformulations LÉGITIMES, écrites à l'aveugle par quelqu'un qui ne
      // voyait pas ces gardes, a fait crier celle-ci deux fois sur vingt : « Tu ne fais pas
      // extraire ta réponse » écrit au passif (« Ta réponse ne doit pas être extraite »), et
      // « tu retires des décisions » écrit « tu enlèves des décisions ». Les deux disent la
      // même obligation ; la garde refusait un texte correct. C'est le SECOND chiffre, celui
      // qu'on oublie de mesurer — et une garde qui crie à tort se fait retirer, en emportant
      // ce qu'elle gardait vraiment.
      //
      // On garde donc DEUX ANCRES par conséquence — le geste et son objet — présentes sur la
      // même ligne, plus la MODALITÉ de cette ligne. Et le COMPTE reste : trois conséquences,
      // une fois chacune.
      //
      // ⚠️⚠️ ET LA POLARITÉ, QUE LA PREMIÈRE VERSION DE CE CORRECTIF AVAIT PERDUE. Elle se
      // contentait des deux ancres plus `exigeImperatif`, en affirmant en commentaire que
      // « deux ancres plus l'impératif ne se conservent pas en retournant la phrase ». C'était
      // FAUX, et la passe de fond l'a prouvé en l'exécutant : « Tu laisses le CTO extraire
      // lui-même sa réponse depuis ton rapport » et « Tu ajoutes des décisions à son assiette,
      // tu ne les retires jamais » gardent les deux ancres, restent impératives, et disent
      // l'inverse exact. `exigeImperatif` ne voit que l'assouplissement, jamais le
      // renversement. En réparant le bruit d'une garde, on lui avait retiré sa prise — les
      // deux chiffres se paient l'un l'autre quand on ne mesure que celui qu'on vient de
      // corriger. Chaque conséquence passe donc par `exigePolarite`, avec son inverse écrit.
      const lignes = preambule.split('\n');
      const CONSEQUENCES = [
        {
          quoi: 'ne pas faire extraire sa réponse',
          ancres: [/extrai/i, /réponse/i],
          sonde: /(?=.*extrai)(?=.*réponse)/i,
          inverse: /laisses? (?:le CTO|le dirigeant|quelqu'un|l'autre) extraire|à (?:lui|eux) d'extraire|(?:il|le CTO) extrait/i,
        },
        {
          quoi: 'retirer des décisions de l’assiette du dirigeant',
          ancres: [/décisions/i, /assiette/i],
          sonde: /(?=.*décisions)(?=.*assiette)/i,
          inverse: /ajoutes? des décisions (?:à|dans|sur) son assiette|tu n'en retires (?:pas|aucune|jamais)/i,
        },
        {
          quoi: 'dire d’abord ce qu’on n’a pas envie d’entendre',
          ancres: [/envie d'entendre/i],
          sonde: /envie d'entendre/i,
          inverse: /(?:tais|caches|gardes pour toi) ce qu'on n'a pas envie d'entendre|dis d'abord ce qu'(?:on|il) (?:veut|a envie d')entendre/i,
        },
      ];
      for (const { quoi, ancres, sonde, inverse } of CONSEQUENCES) {
        const portantes = lignes.filter((l) => ancres.every((a) => a.test(l)));
        assert.equal(
          portantes.length, 1,
          `la conséquence « ${quoi} » doit figurer une fois exactement dans le préambule`,
        );
        exigeImperatif(portantes[0], `la conséquence « ${quoi} »`);
        exigePolarite(portantes[0], sonde, `la conséquence « ${quoi} »`, { inverse });
      }

      // ⚠️ LA MOITIÉ QUI PROTÈGE, ET ELLE SE RETIRE SANS BRUIT.
      //
      // Un homme de confiance qui se trompe et le cache cesse d'être l'un et l'autre en même
      // temps. Sans cette phrase, « bras droit » se lit comme un titre honorifique — c'est-à-dire
      // le sens exact que le dirigeant ne lui donne pas, et celui qui rend le rôle dangereux.
      exigePolarite(
        preambule, /elle en est la condition/i,
        'la franchise est la CONDITION du rôle, jamais une vertu qu’on y ajoute',
        { inverse: /franchise est (?:une |la )?(?:vertu|qualité) ajoutée|franchise est facultative|franchise n'est pas la condition/i },
      );
    },
  },

  {
    id: 'le-backlog-ce-sont-les-demandes',
    quoi: 'il rend compte au grain de la Demande, répond la chose demandée — ET donne une analyse quand on lui en demande une — ET inscrit au même grain ce qui vient du dirigeant',
    verifier({ metier }) {
      // T-20260816-0099, points 1 et 2. Mesurés le même jour, et ils se manquent séparément :
      // le premier est un GRAIN, le second un FORMAT. Les confondre revient à corriger l'un en
      // croyant avoir fait les deux.
      //
      // ⚠️ T-20260817-0016 — LE TROISIÈME, ET IL A COÛTÉ UN SECOND REPROCHE EN DEUX JOURS.
      // Les deux premiers portaient sur ce que l'orchestrateur REND. Le grain auquel le
      // dirigeant suit gouverne aussi ce qu'il OUVRE, et le texte se taisait là-dessus : quatre
      // consignes reçues un matin, quatre tickets ouverts, aucun à son grain. La section a donc
      // été renommée par sa fonction (le grain, pas le geste de rendre compte) — un titre qui
      // nomme un seul geste est précisément ce qui a laissé le geste voisin découvert.
      // ⚠️ RÉ-ANCRAGE PAR LA FONCTION — ET CE CONTRÔLE EN GARDE TROIS, QUI ONT REPRIS CHACUNE
      // LEUR PLACE (lot 3, 2026-08-17).
      //
      // La section unique « Le grain auquel il suit » n'existe plus. Elle avait été fabriquée
      // en réunissant trois règles sous un même titre, précisément parce qu'un titre qui nomme
      // un seul geste avait laissé le geste voisin découvert. La reconstruction
      // (`D-20260817-0006`) les remet chacune à l'endroit où elle s'exerce — et le gabarit
      // porte désormais, en propre, la règle de lecture qui rend ce découpage sûr (« une règle
      // vaut pour sa FONCTION », gardée par `une-regle-vaut-pour-sa-fonction`, dont la
      // troisième ligne est exactement ce couple : ce qu'il REND · ce qu'il OUVRE).
      //
      // Les trois terrains, et pourquoi chacun est bien « là où la fonction sert » :
      //   • ce qu'il REND quand on lui demande le backlog → R1, `Ton backlog, ce sont les DEMANDES` ;
      //   • ce qu'il OUVRE quand une consigne vient de lui → R1, `Ce qui vient de lui s'ouvre en
      //     Demande — jamais en ticket`, qui porte le discriminant d'origine ;
      //   • la FORME de ce qu'il lui répond (la chose demandée, l'analyse entière) → R6, `Des
      //     faits, pas ton raisonnement`, où vit la façon de lui parler.
      // Aucune des trois n'a été cherchée ailleurs qu'à l'endroit où elle s'applique.
      //
      // ⚠️ UNE SONDE A CHANGÉ D'OBJET SANS CHANGER DE FONCTION, ET C'EST ÉCRIT PLUTÔT QUE TU :
      // « les tickets sont sa mécanique INTERNE » ne s'écrit plus ainsi. Le gabarit dit
      // aujourd'hui, dans la ligne « de toi » du discriminant, « c'est **ta** mécanique » — la
      // même chose, au meilleur endroit : celui qui oppose les deux origines. La garde y suit le
      // texte au lieu de garder un adjectif qui a disparu.
      const grain = sectionDe(metier, /^Ton backlog/i, 'sur le grain du backlog');
      const origine = sectionDe(metier, /s'ouvre en Demande/i, 'sur ce qu’ouvre une consigne du CTO');
      const parole = sectionDe(metier, /Des faits, pas ton raisonnement/i, 'sur la façon de lui parler');

      // Le titre porte ici la règle : on le rend au texte plutôt que de le laisser hors garde.
      const grainDit = `${grain.titre}\n\n${grain.corps}`;
      exigePolarite(
        grainDit, /ce sont les DEMANDES/,
        'le backlog d’un orchestrateur, ce sont les Demandes',
        { inverse: /backlog,? ce sont les tickets|les tickets sont (?:le|ton|son) backlog|tu réponds par les tickets/i },
      );
      exigePolarite(
        grain.corps, /demandes ouvertes, par statut/i,
        'et ce qu’il attend est nommé : les demandes ouvertes, par statut',
      );
      exigePolarite(
        origine.corps, /c'est \*{0,2}ta\*{0,2} mécanique/i,
        'et les tickets sont sa mécanique à lui — il les tient sans en accabler personne',
      );
      exigePolarite(
        parole.corps, /tu réponds la chose demandée/i,
        'à une question fermée, il répond la chose demandée, sans la commenter',
      );

      // ⚠️⚠️ LA SECONDE MOITIÉ, ET C'EST ELLE QUE LA PREUVE DU TICKET EXIGE NOMMÉMENT.
      //
      // « Un orchestrateur né sur cette version, à qui on demande le backlog, répond par les
      // DEMANDES — et un orchestrateur à qui on demande une analyse en donne toujours une. Une
      // version qui rend l'un muet sur l'autre n'a fait que déplacer le défaut. »
      //
      // Une règle qui apprend à répondre court, SANS dire qu'on répond long quand on demande
      // long, fabrique un orchestrateur qui rend une liste à « qu'est-ce que tu en penses ? ».
      // C'est le même défaut, retourné — et il serait plus difficile à voir que l'original.
      exigePolarite(
        parole.corps, /tu la donnes \*{0,2}entière/i,
        'quand une analyse est demandée, il en donne une — sinon la correction a seulement déplacé le défaut',
        { inverse: /jamais d'analyse|ne donnes? (?:jamais )?d'analyse|refuse l'analyse|réponds toujours en liste/i },
      );
      exigePolarite(
        // La sonde tolère l'emphase markdown autour du mot : le texte écrit « jamais un
        // **plafond** », et une sonde qui l'ignorerait rendrait la garde introuvable au premier
        // coup de gras — c'est-à-dire décorative pour une raison qui n'a rien à voir avec le sens.
        parole.corps, /jamais un \*{0,2}plafond/i,
        'et la concision est nommée comme un DÉFAUT, jamais comme une limite',
      );

      // ── LA TROISIÈME RÈGLE : CE QUI VIENT DE LUI S'OUVRE EN DEMANDE.
      // Elle est portée par le titre de sa section, et le titre est du texte comme un autre.
      exigePolarite(
        `${origine.titre}\n\n${origine.corps}`, /s'ouvre en Demande — jamais en ticket/i,
        'ce que le dirigeant demande s’ouvre en Demande ou en Projet, jamais directement en ticket',
        { inverse: /s'ouvre en ticket|un ticket suffit|inscris-le comme ticket/i },
      );

      // Le DISCRIMINANT, apparié : c'est l'origine qui décide, pas la taille ni l'urgence. Une
      // table dont on permute les deux lignes garde chaque mot et renverse la règle — et c'est
      // le renversement le moins visible, parce que les deux moitiés restent vraies séparément.
      const origines = tableDe(origine.corps);
      const sources = colonne(origines, /^D'où ça vient$/i, 'd’où ça vient');
      const ouvertures = colonne(origines, /^Ce que tu ouvres$/i, 'ce qu’il ouvre');
      assert.equal(origines.lignes.length, 2, `le discriminant doit porter ses DEUX origines (${origines.lignes.length}) : n’en garder qu’une laisse deviner l’autre`);
      const deLui = sources.findIndex((o) => /De lui/i.test(o));
      const deMoi = sources.findIndex((o) => /De toi/i.test(o));
      assert.ok(deLui >= 0 && deMoi >= 0, 'les deux origines — de lui, de toi — doivent être nommées');
      assert.match(ouvertures[deLui], /Demande/i, `ce qui vient du dirigeant s’ouvre en Demande (« ${ouvertures[deLui]} »)`);
      assert.match(ouvertures[deMoi], /ticket/i, `ce qui vient de l’orchestrateur s’ouvre en ticket (« ${ouvertures[deMoi]} »)`);
      assert.ok(
        !/^\s*\|?\s*\*{0,2}ticket/i.test(ouvertures[deLui]),
        'ce qui vient du dirigeant est donné comme un ticket — les deux origines sont inversées, et le reproche recommence',
      );

      // ⚠️ LA MOITIÉ QUI PROTÈGE, ET ELLE EST FACILE À PERDRE. La règle dit d'où viennent les
      // tickets, pas d'arrêter d'en ouvrir. Un orchestrateur qui cesserait d'inscrire ses
      // propres défauts au registre aurait obéi à la lettre en cassant la règle d'or n°7.
      exigePolarite(
        origine.corps, /ne dit pas d'arrêter d'ouvrir des tickets/i,
        'les tickets restent sa mécanique — la règle dit d’où ils viennent, jamais de cesser d’en ouvrir',
        { inverse: /n'ouvre plus de tickets?|aucun ticket|les tickets disparaissent/i },
      );
    },
  },

  {
    id: 'la-production-cliente-se-mesure-avant-le-geste',
    quoi: 'l’état de la production d’un client se mesure et s’inscrit AVANT le geste — pour que la suite reste attribuable',
    verifier({ metier }) {
      // T-20260816-0099, point 3 — « la leçon la plus chère de ces 48 heures ».
      //
      // Ce qui rend cette garantie particulière : son motif n'est PAS la prudence. Un agent l'a
      // formulé mieux que la consigne ne l'aurait fait — si je fusionne maintenant, plus personne
      // ne peut attribuer l'état du chat. Écrite comme une précaution, elle se négocie ; écrite
      // comme une condition d'attribution, elle ne se négocie pas.
      const s = sectionDe(metier, /dépôt client — mesure et inscris/i, 'sur la mesure de la production cliente');

      exigePolarite(
        s.corps, /s'inscrit AVANT qu'on y pose un geste/i,
        'la mesure PRÉCÈDE le geste — c’est toute la garantie, et l’ordre est la garantie',
        { inverse: /mesure(?:r|s)? après (?:le|ton) geste|il suffit de mesurer ensuite|tu peux mesurer après/i },
      );
      exigePolarite(
        s.corps, /reste attribuable/i,
        'et son motif : l’attribution de ce qui arrivera ensuite, pas la prudence',
      );
      exigePolarite(
        s.corps, /ne prouve plus rien/i,
        'une mesure prise après le geste ne sait plus séparer ce qui était déjà cassé de ce qu’on vient de casser',
        { inverse: /mesurer après suffit|aussi bien après|on peut toujours mesurer plus tard/i },
      );
      exigePolarite(
        s.corps, /se referme au premier commit/i,
        'la fenêtre où cette preuve existe se referme — et elle ne se rouvre pas',
      );

      // ⚠️ LA MOITIÉ QUI GARDE LE PREMIER PRINCIPE, et sans elle cette section serait une
      // invitation à le violer : MESURER EST DE L'EXÉCUTION. Un orchestrateur qui va mesurer
      // lui-même la production d'un client vient de reprendre le clavier — et ses droits le lui
      // refusent de toute façon, ce qui ferait de ce texte une garantie fausse.
      exigePolarite(
        s.corps, /appartient à ton chef d'équipe/i,
        'mesurer appartient au chef d’équipe : l’orchestrateur porte l’exigence, pas le geste',
        { inverse: /tu mesures toi-même|va (?:le )?mesurer toi-même|c'est à toi de mesurer/i },
      );
    },
  },

  {
    id: 'avant-de-relancer-regarde-ta-propre-boite',
    quoi: 'un silence a deux causes — la réponse déjà arrivée, et sa propre boîte pleine',
    verifier({ metier }) {
      // T-20260816-0099, point 4, mesuré DES DEUX CÔTÉS le même jour : une nuit passée à
      // chercher qui donnait des ordres aux agents alors que le blocage était la boîte de
      // l'orchestrateur (239 tentatives de jonction), et un agent qui redemande cinq fois un
      // mandat déjà présent trois fois dans son pane.
      //
      // ⚠️ CE QUI A CHANGÉ : la sonde cherchait le TITRE de l'ancienne rubrique (« regarde
      // d'abord ta propre boîte »). La rubrique a été renommée par ce qu'elle FAIT — elle tient
      // ensemble les deux surfaces dont l'orchestrateur répond lui-même, sa ligne et sa boîte.
      // La sonde désigne donc ce titre entier plutôt qu'un fragment : une sonde large sur
      // « ta propre boîte » attraperait aussi ce qui parle du crochet et de la ligne.
      const s = sectionDe(metier, /^2 — Ta propre ligne et ta propre boîte de saisie$/, 'sur la vérification avant relance');

      exigePolarite(
        s.corps, /tu es l'une des deux/i,
        'un silence a deux causes, et l’orchestrateur est l’une des deux',
        { inverse: /le silence vient toujours de l'autre|jamais de ton côté|c'est toujours lui qui/i },
      );

      const VERIFICATIONS = [
        { quoi: 'la réponse est-elle déjà arrivée', sonde: /déjà arrivée/i },
        { quoi: 'ta propre boîte de saisie est-elle libre', sonde: /boîte de saisie est-elle libre/i },
      ];
      for (const { quoi, sonde } of VERIFICATIONS) {
        exigePolarite(s.corps, sonde, `la vérification « ${quoi} »`);
      }

      exigePolarite(
        s.corps, /Tu ne conclus jamais d'un silence/i,
        'et l’interdit qui les rend obligatoires : on ne conclut pas d’un silence sans avoir mesuré les deux',
        { inverse: /un silence prouve|tu peux conclure d'un silence/i },
      );
    },
  },

  {
    id: 'la-recolte-ecrit-au-lieu-de-constater',
    quoi: 'la rubrique de récolte RÉCOLTE — elle écrit au ServiceDesk au lieu de constater l’oubli — et sa limite est dite',
    verifier({ metier }) {
      // T-20260816-0097. L'arbitrage du dirigeant a écarté trois pistes de CONTRÔLE au profit
      // d'une RÉCOLTE, et la différence est toute la valeur du lot.
      //
      // ⚠️ CE QUI A CHANGÉ : la sonde cherchait un TITRE qui nommait le RANG de la rubrique
      // (« La récolte — la huitième tâche de ta ronde »), et le rang a bougé à la
      // réorganisation. Elle désigne maintenant la rubrique par ce qu'elle fait, récolter son
      // propre contexte — un rang se renumérote, une fonction non. Et le lieu où la récolte
      // écrit s'appelle désormais le ServiceDesk : la sonde suit le nom réel de l'objet.
      const s = sectionDe(metier, /^3 — Récolter ton propre contexte$/, 'sur la récolte');

      exigePolarite(
        s.corps, /tu l'écris au ServiceDesk/i,
        'la récolte ÉCRIT au ServiceDesk — c’est son livrable, pas un constat',
      );

      // ⚠️⚠️ LA DISTINCTION QUI PORTE TOUT LE LOT, ET ELLE SE PERD EN UN MOT.
      //
      // Un contrôle dit « tu as oublié » ; une récolte fait le travail. Sur un défaut qui vient
      // de l'oubli, le second l'emporte — on ne peut pas se rappeler de se rappeler. Ramener la
      // récolte à une vérification la vide ENTIÈREMENT sans rien retirer de visible : le texte
      // garderait sa place, son titre et sa cadence, et ne ferait plus rien.
      exigePolarite(
        s.corps, /une récolte fait le travail d'écrire/i,
        'la récolte FAIT le travail, là où un contrôle se contente de dire qu’on a oublié',
        { inverse: /la récolte (?:constate|vérifie|signale|contrôle)\b|elle se contente de constater|il s'agit d'un contrôle/i },
      );
      exigePolarite(
        s.corps, /se rappeler de se rappeler/i,
        'et la raison pour laquelle un contrôle ne suffit pas sur un défaut d’oubli',
      );

      // ⚠️ SA LIMITE FAIT PARTIE DE LA GARANTIE, ET ELLE EST CONTRE-INTUITIVE : la retirer
      // rendrait la récolte plus rassurante et le dispositif plus faux. Ce qui a été compacté
      // avant la ronde est perdu — et l'agent ne le saura même pas, ce qui est le pire des deux.
      exigePolarite(
        s.corps, /ne rattrape jamais ce qui a déjà été compacté/i,
        'sa limite : elle attrape ce qui a ÉCHAPPÉ, jamais ce qui a DISPARU',
        { inverse: /la récolte rattrape tout|rien n'est perdu|elle rattrape (?:aussi )?ce qui a été compacté/i },
      );
      // ⚠️ LA SONDE A DÛ CHANGER PARCE QUE LE RENVOI A CHANGÉ, PAS LA GARANTIE. Le texte disait
      // « du principe d'inscrire au plus tôt » ; il pointe maintenant la rubrique qui porte ce
      // principe. Garder l'ancienne formule aurait fait rougir un texte devenu plus précis. Ce
      // qu'on exige est donc les DEUX MOITIÉS sur la même ligne : qu'elle n'abroge rien, et
      // quoi — l'inscription AU PLUS TÔT. La première seule laisserait « elle n'abroge donc
      // rien » suivi de n'importe quoi.
      exigePolarite(
        s.corps, /n'abroge donc rien[^\n]*inscrire \*\*au plus tôt\*\*/i,
        'donc elle n’abroge pas le principe d’inscrire au plus tôt — les deux sont nécessaires',
        { inverse: /remplace le principe|dispense d'inscrire|il n'est plus nécessaire d'inscrire/i },
      );

      // ⚠️ LA CADENCE A ÉTÉ TRANCHÉE, ET LA GARDE SUIT LA FONCTION PLUTÔT QUE LE MARQUEUR.
      //
      // Elle exigeait `[non établi]` — le mot juste tant que la fréquence n'était pas mesurée,
      // et le ticket le demandait ainsi. La réorganisation l'a tranchée : la récolte passe À
      // CHAQUE RONDE, et c'est ce que la table du tour porte aussi (rubrique 3). Exiger encore
      // le marqueur ferait rougir la réponse qu'on attendait. Ce que la garde tient est donc ce
      // qu'il gardait vraiment : la récolte a une cadence ÉCRITE, et non laissée au jugé.
      exigePolarite(
        s.corps, /À chaque ronde, tu relis ton propre contexte/i,
        'la cadence de la récolte, écrite — elle passe à chaque ronde, elle n’est pas laissée au jugé',
        { inverse: /si tu y penses|quand tu as le temps|de temps à autre/i },
      );
    },
  },

  {
    id: 'la-ronde-tire-une-consequence-de-ce-qu-elle-voit',
    quoi: 'rien ne tourne → on repart du backlog au grain de la Demande, et la ronde ne finit pas avant que ses trouvailles soient au ServiceDesk',
    verifier({ metier }) {
      // T-20260816-0018, tâche 9 + condition de fin. Mesuré le 2026-08-16 : trois agents au
      // repos avec du travail devant eux, correctement listés `done` par la ronde — et RIEN
      // n'en a été conclu, parce qu'aucune tâche ne demandait « est-ce que quelque chose
      // avance ? ». Personne ne l'a su avant que le dirigeant demande « vous travaillez sur quoi ? ».
      //
      // ⚠️⚠️ CE QUI A CHANGÉ, ET C'EST LE CAS LE PLUS DÉLICAT DU LOT : CETTE GARDE CITAIT UN RANG.
      //
      // Elle désignait sa section par un titre imagé (« Une ronde qui observe sans agir est un
      // journal ») et nommait sa règle « la neuvième tâche ». La réorganisation a renuméroté les
      // rubriques de ronde : la reprise par le backlog est devenue la QUATRIÈME. Un rang n'est
      // pas une garantie — il se renumérote sans qu'aucune règle bouge, et une garde qui le
      // compte rougit sur un texte parfaitement juste. On garde donc la FONCTION : une ronde ne
      // rend pas un état, elle en tire une conséquence, et cette conséquence-là est de repartir
      // du backlog. Les deux conséquences se sont séparées en deux sections, la garde lit les deux.
      const s = sectionDe(metier, /^4 — Si rien n'avance, repars du backlog$/, 'sur la conséquence que la ronde tire quand rien n’avance');
      const fin = sectionDe(metier, /^Ta ronde ne se termine pas tant que/, 'sur la condition de fin de la ronde');

      // ⚠️⚠️ CETTE SONDE ÉTAIT ANCRÉE SUR UN RÉCIT, ET C'EST CORRIGÉ ICI (lot 2, 2026-08-17).
      //
      // Elle cherchait « et elle n'en a rien conclu » — la narration d'un incident daté du
      // 2026-08-16. **Un récit ne peut pas être violé, donc il ne peut pas garder** : il
      // n'oblige rien, et on ne renverse pas un fait. Une garde posée dessus est verte parce
      // que l'anecdote est encore racontée, pas parce que la règle est encore prescrite.
      //
      // La PRESCRIPTION qui portait la garantie a disparu. Elle vivait en deux endroits, et
      // les deux sont partis ensemble (mesuré entre `878f9d5` et `f0fa26b`) :
      //
      //   • `878f9d5:464-466` — un titre de section ET une maxime :
      //       `### Une ronde qui observe sans agir est un journal`
      //       > « Une ronde ne rend pas un état : elle en tire une conséquence. Sinon elle est
      //         un journal, et un journal que personne ne lit n'a rien dit. »
      //   • `878f9d5:1183` — le miroir, dans la colonne de coût de l'anti-pattern :
      //       « … **Une ronde qui rend des états sans en tirer de conséquence est un journal** »
      //       — aujourd'hui la faute est encore nommée, son coût a été retiré.
      //
      // ⚠️ **On ne ré-ancre pas une garde sur ce qui reste sans acter la perte d'abord.**
      // Ré-ancrer, c'est déplacer le témoin. La perte est actée (`T-20260817-0088`, P2), et
      // cette garde reste ROUGE : elle exige la PRESCRIPTION, pas son souvenir. Elle reverdira
      // d'elle-même quand le texte la reprendra.
      const prescriptions = s.corpsEtendu
        .split('\n')
        .filter((l) => /ne rend pas un état|est un journal|sans en tirer de conséquence/i.test(l));
      assert.ok(
        prescriptions.length >= 1,
        'la ronde ne PRESCRIT plus de tirer une conséquence de ce qu’elle voit. Ce qui reste est '
          + 'le RÉCIT d’un incident du 2026-08-16 (« et elle n’en a rien conclu ») — un récit '
          + 'n’oblige rien et ne se renverse pas, donc il ne garde rien. La maxime qui portait la '
          + 'règle (« Une ronde ne rend pas un état : elle en tire une conséquence. Sinon elle est '
          + 'un journal ») a disparu du texte, et son miroir a perdu son coût dans la table '
          + 'd’anti-patterns. C’est la perte P2 de T-20260817-0088.',
      );
      for (const p of prescriptions) {
        exigePolarite(
          p, /ne rend pas un état|est un journal|sans en tirer de conséquence/i,
          'une ronde ne rend pas un état, elle en tire une conséquence — sinon c’est un journal',
          { inverse: /se contente de rendre l'état|il suffit de constater|un état rendu suffit|rendre l'état suffit/i },
        );
      }

      exigePolarite(
        s.corps, /tu prends la suite \*\*dans le backlog/i,
        'si rien ne tourne, on reprend le travail au backlog',
        { inverse: /tu attends qu'on te réveille|tu attends une consigne|rien à faire tant qu'on ne te dit rien/i },
      );
      exigePolarite(
        s.corps, /au grain de la Demande/i,
        'et la reprise se décide au grain de la Demande, jamais du ticket',
        // ⚠️ L'ALTERNATIVE « ticket par ticket » A ÉTÉ RETIRÉE (revue de fond, 2026-08-16).
        //
        // Elle ne désignait PAS le renversement de cette garantie : « ticket par ticket » nomme
        // un tout autre geste, le rattachement d'un ticket à un jalon (`deliveries` actions
        // `add_ticket` / `remove_ticket`), écrit légitimement en §3 du même gabarit. La garde ne
        // criait pas encore, parce que `sectionDe` borne le corps à cette section — mais la
        // première clarification légitime qui aurait employé ces trois mots ICI l'aurait fait
        // rougir à tort. Et une garde qui crie à tort se fait retirer, EN EMPORTANT ce qu'elle
        // gardait : ce dépôt l'a déjà payé, et un `inverse` trop large est la façon la plus
        // discrète de préparer ce retrait.
        //
        // Ce qui reste est l'exacte polarité contraire, et elle n'a aucun usage légitime ici :
        // décider la reprise au grain du ticket est précisément ce que la garantie interdit.
        { inverse: /au grain du ticket/i },
      );

      // ⚠️⚠️ LE PIÈGE EST L'EXACT REVERS DE LA TÂCHE, ET SANS LUI ELLE NUIT.
      //
      // Les deux situations se ressemblent trait pour trait de l'extérieur — personne ne
      // travaille — et elles appellent des gestes OPPOSÉS. Un orchestrateur qui attend un
      // arbitrage n'est pas à l'arrêt : il est bloqué, et démarrer un lot de plus disperse au
      // lieu d'avancer. Ce qui les sépare n'est pas l'observation, c'est le discriminant.
      exigePolarite(
        s.corps, /n'est pas à l'arrêt, il est bloqué/i,
        'attendre un arbitrage n’est PAS être à l’arrêt — relancer là disperse au lieu d’avancer',
        { inverse: /attendre un arbitrage,? c'est être à l'arrêt|tu relances quand même|relance dans tous les cas/i },
      );
      exigePolarite(
        s.corps, /est-ce que j'attends quelqu'un/i,
        'et le discriminant est nommé — « est-ce que j’attends quelqu’un ? », jamais « est-ce que quelqu’un travaille ? »',
      );

      // ⚠️ LA SECONDE CONSÉQUENCE, ET C'EST SA FORMULATION QUI EST LA GARANTIE.
      //
      // « Une ronde ne se termine pas tant que ce qu'elle a trouvé n'est pas au ServiceDesk » est
      // une CONDITION DE FIN. Écrite comme une bonne habitude, elle redevient exactement ce
      // qu'elle remplace : une documentation qui repose sur le souvenir d'un seul agent.
      //
      // Elle a sa propre section maintenant, et l'énoncé est passé dans son TITRE — que la sonde
      // de `sectionDe` ci-dessus ancre. Ce qui reste à garder ici est ce que le corps ajoute, et
      // c'est là que la garantie se perdrait sans bruit : le rang de la consigne. « Condition de
      // fin » ou « bonne habitude » — le texte est presque le même, la garantie n'existe que
      // dans le premier cas.
      exigePolarite(
        // ⚠️ SONDE ÉLARGIE — même campagne : « c'est **la condition qui la termine** » est la
        // même règle. La garantie est que l'inscription CONDITIONNE la fin de la ronde ; la
        // formulation exacte ne lui appartient pas.
        fin.corps, /c'est \*\*(?:sa condition de fin|la condition qui la termine)\*\*/i,
        'la ronde ne finit pas avant que ses trouvailles soient inscrites — c’est sa condition de fin, pas une bonne habitude',
        { inverse: /si tu y penses|quand tu as le temps|il est bon d'inscrire|tu peux l'inscrire plus tard/i },
      );
      exigePolarite(
        fin.corps, /mourir avec la session/i,
        'et le motif : un constat non inscrit meurt avec la session, sans que personne sache qu’il a existé',
      );
    },
  },

  // ═══════════ T-20260817-0016 — les trois règles du 2026-08-17, et le motif qui les relie
  //
  // Les trois existaient DÉJÀ sous une forme voisine, et aucune n'a mordu : chacune était
  // bornée au geste où on l'avait rencontrée, jamais à la fonction qu'elle sert. Les gardes
  // qui suivent portent donc toutes, en plus de la règle, LA COUVERTURE DE SA FONCTION —
  // c'est-à-dire ce que la règle FAIT, pas les mots qu'elle contient. Une garde qui se
  // contenterait de trouver la phrase laisserait revenir exactement le défaut d'origine :
  // une règle juste, écrite une fois, muette là où elle sert aussi.

  {
    id: 'la-parole-au-dirigeant-porte-des-faits',
    quoi: 'sur la ligne il rend des faits, jamais son raisonnement — et la règle nomme TOUTES les surfaces où sa parole atteint le dirigeant',
    verifier({ metier }) {
      const s = sectionDe(metier, /Des faits, pas ton raisonnement/i, 'sur la façon de parler au dirigeant');

      // ── LE CALCUL QUI TRANCHE. Sans lui, la règle se lit comme une préférence de style, et
      // un orchestrateur convaincu de sa rigueur la contourne de bonne foi : son message est
      // juste. Ce qui ne l'est pas, c'est qu'il soit le dixième.
      //
      // ⚠️ LA SONDE COMPTE LES AGENTS, PLUS LES SEULS ORCHESTRATEURS. La réécriture élargit le
      // dénombrement (« le nombre d'agents », dix lieux sur ce poste) là où il ne comptait que
      // les orchestrateurs. C'est la même garantie, et elle mord plus large : ce qui la porte
      // est la MULTIPLICATION, pas la catégorie de ceux qui écrivent. La sonde s'arrête donc
      // avant le mot qui a bougé.
      exigePolarite(
        s.corps, /se multiplie par le nombre d'/i,
        'le motif est la multiplication — ce qu’il écrit est lu dix fois, pas une',
        { inverse: /ton message est le seul|un seul (?:orchestrateur|agent) t'écrit/i },
      );

      // ── LE TRI, APPARIÉ CASE PAR CASE. Permuter les deux colonnes garde tous les mots de la
      // règle et envoie le raisonnement sur la ligne : le défaut reproché, à la lettre.
      const table = tableDe(s.corps);
      const matieres = colonne(table, /^Ce que tu as en main$/i, 'ce qu’il a en main');
      const destinations = colonne(table, /^Où ça va$/i, 'où ça va');
      const TRI = [
        { quoi: 'un fait, un chiffre, un état', sonde: /un \*\*fait\*\*/i, ou: /\*\*la ligne\*\*/i },
        { quoi: 'une décision qui lui appartient', sonde: /décision qui lui appartient/i, ou: /\*\*la ligne\*\*/i },
        // ⚠️ LA DESTINATION S'ÉCRIT « le ServiceDesk », plus « le registre » : le mot maison a
        // été retiré du métier (44 occurrences, jamais employé chez Somtech). Le lieu n'a pas
        // changé, seul son nom — la sonde suit le nom réel, sinon elle garde un mot mort.
        { quoi: 'le raisonnement', sonde: /ton raisonnement/i, ou: /\*\*le ServiceDesk\*\*/i },
        { quoi: 'la rétractation et l’aveu de méthode', sonde: /rétractation/i, ou: /\*\*le ServiceDesk\*\*/i },
      ];
      assert.equal(table.lignes.length, TRI.length, `${table.lignes.length} matière(s) triée(s) pour ${TRI.length} gardée(s) : une ligne retirée d’une table est le mode de régression le plus silencieux d’un texte`);
      for (const { quoi, sonde, ou } of TRI) {
        const i = matieres.findIndex((m) => sonde.test(m));
        assert.ok(i >= 0, `« ${quoi} » ne figure plus parmi ce qu’il a en main`);
        assert.match(destinations[i], ou, `« ${quoi} » ne va plus où il doit (« ${destinations[i]} ») — les deux colonnes sont inversées`);
      }

      // ── LE SEUIL DE REMONTÉE D'UNE ERREUR. Sans lui, le tri ci-dessus se lit comme une
      // règle de volume : un orchestrateur consciencieux remonte tout, « pour être franc », et
      // la ligne redevient illisible sans qu'aucune consigne soit violée. Relevé par la passe
      // de fond : cette phrase n'était gardée par rien, et l'inverser passait inaperçu.
      exigePolarite(
        s.corps, /ne remonte sur la ligne que si elle change une décision/i,
        'une erreur ne remonte sur la ligne QUE si elle change une décision en cours — sinon elle s’inscrit et se tait',
        { inverse: /toute erreur remonte|chaque erreur (?:se dit|remonte)|remonte-les toutes/i },
      );

      // ── LES SURFACES, ET C'EST LA MOITIÉ QUI DISTINGUE CETTE RÈGLE DE CELLE QU'ELLE REMPLACE.
      // La version d'avant visait la conversation ; la ligne y échappait, et c'est par elle que
      // le débordement est passé sans qu'aucune règle ne soit techniquement violée. Retirer une
      // seule de ces surfaces rend la règle à nouveau bornée — sans qu'une phrase manque.
      //
      // ⚠️ ELLES NE SONT PLUS DES PUCES : la réécriture les énumère EN LIGNE, séparées par
      // « · », derrière « chaque surface où ta parole l'atteint ». La garde lit donc les
      // segments de cette énumération — et elle en COMPTE le nombre, ce que la version en
      // puces ne faisait pas : `some()` seul laissait ajouter du bruit autour, et surtout ne
      // disait rien du jour où l'énumération elle-même serait remplacée par une phrase vague.
      const declaration = s.corps.split('\n').filter((l) => /chaque surface où ta parole/i.test(l));
      assert.equal(declaration.length, 1, `les surfaces doivent être énumérées une fois exactement (${declaration.length})`);
      const surfaces = declaration[0].split('·').map((x) => x.trim());
      const ATTENDUES = [
        // Le gras a bougé d'un mot (« ta **ligne** » → « **ta ligne** ») quand la liste a été
        // corrigée : la sonde tient le NOM de la surface, pas l'endroit où l'auteur ouvre son
        // gras.
        { quoi: 'sa ligne avec le CTO', sonde: /\*\*(?:ta )?ligne\*\*|ta \*\*ligne\*\*/i },
        { quoi: 'le topo du matin', sonde: /topo du matin/i },
        { quoi: 'sa conversation', sonde: /conversation/i },
        { quoi: 'un commentaire au ServiceDesk qu’il lira', sonde: /commentaire au ServiceDesk/i },
        { quoi: 'ce qu’un représentant de client relaie de sa part', sonde: /représentant de client/i },
      ];
      // ⚠️ ON COMPTE LES SURFACES NOMMÉES, PAS LES SEGMENTS — et c'est la correction d'un
      // faux témoin qu'on a vu vivre (2026-08-17). La garde exigeait autant de segments que de
      // surfaces gardées. Une revue a fait corriger le texte : le topo du matin **se pose sur
      // la ligne**, ce n'est pas une surface à part, et la liste le dit maintenant en le
      // nommant DANS le segment de la ligne. Quatre segments pour cinq surfaces, toutes
      // nommées — la garde a rougi sur une correction qu'elle avait elle-même provoquée.
      //
      // Ce qui compte n'a pas changé d'un mot : aucune surface ne disparaît, et l'énumération
      // reste une énumération plutôt qu'une phrase vague. On garde donc les deux — chaque
      // surface nommée quelque part dans la déclaration, et au moins autant de segments qu'il
      // faut pour que ce soit une liste. Le rang exact d'une surface dans la liste, lui,
      // n'appartient pas à la garde : deux surfaces qui fusionnent parce que l'une vit dans
      // l'autre est une clarification, pas une perte.
      for (const { quoi, sonde } of ATTENDUES) {
        assert.ok(
          sonde.test(declaration[0]),
          `la surface « ${quoi} » n’est plus nommée : la règle redevient bornée au geste où on l’a écrite — le défaut même que ce lot ferme`,
        );
      }
      assert.ok(
        surfaces.length >= 4,
        `la déclaration ne compte que ${surfaces.length} segment(s) : l’énumération a été remplacée par une phrase, `
          + `et une règle qui vaut « partout » sans dire où redevient la règle du geste où on l’a écrite`,
      );
      exigePolarite(
        s.corps, /pas sur un geste/i,
        'et il est dit que la règle porte sur la FONCTION — lui parler — et non sur un geste',
        { inverse: /ne vaut que (?:sur|pour|dans) la conversation|seulement dans la conversation/i },
      );

      // ── LES DEUX MOITIÉS QUI PROTÈGENT, ET ELLES NE SE VALENT PAS.
      // La première est la plus grave : une règle de brièveté qui laisserait croire qu'on peut
      // taire une erreur aurait cassé infiniment plus que la verbosité qu'elle corrige.
      exigePolarite(
        s.corps, /déplace l'aveu, ça ne le supprime jamais/i,
        'la concision DÉPLACE l’aveu vers le ServiceDesk — elle ne l’abroge pas',
        { inverse: /tu peux taire|inutile de le dire|garde-la pour toi|n'en parle pas/i },
      );

      // ⚠️ « LA FRANCHISE EST LA CONDITION DU RÔLE » A DÉMÉNAGÉ — ON DÉPLACE LA SONDE, ON NE
      // L'AFFAIBLIT PAS. La réécriture par la fonction l'a sortie de cette section et la dit
      // deux fois ailleurs : au préambule, où elle définit le poste (« La franchise n'est pas
      // une vertu ajoutée au rôle — elle en est la condition »), et dans la règle de lecture du
      // métier, où elle porte exactement ce que cette garde-ci protège — que la CONCISION ne
      // rabote pas la FRANCHISE, parce que ce sont deux fonctions et non une. C'est cette
      // seconde formulation qu'on garde ici : c'est elle, et elle seule, qui empêche la règle
      // de brièveté écrite juste au-dessus de manger la règle de franchise.
      const lecture = sectionDe(metier, /une règle vaut pour sa FONCTION/i, 'sur la façon de lire ce métier');
      exigePolarite(
        lecture.corps, /La franchise et la concision sont deux fonctions, pas une/i,
        'et la franchise reste la condition du rôle, jamais une vertu qu’on sacrifie à la brièveté',
        { inverse: /la concision (?:prime|l'emporte)|sois bref avant d'être franc/i },
      );
      exigePolarite(
        s.corps, /la concision est le défaut, jamais un \*{0,2}plafond/i,
        'la concision est nommée comme un défaut, jamais comme une limite',
        { inverse: /réponds toujours court|jamais plus de trois lignes|même quand il demande une analyse/i },
      );
    },
  },

  {
    id: 'la-formule-jai-besoin-de-toi',
    quoi: 'tout message se termine par la formule LITTÉRALE, le « rien » compris — et elle est rappelée là où les messages se fabriquent',
    verifier({ metier }) {
      const s = sectionDe(metier, /Tout message se termine par/i, 'sur la formule de fin de message');

      // ── LA FORMULE, LITTÉRALE — et ici la littéralité EST la règle, pas un raccourci de garde.
      // Le bénéfice décrit par le dirigeant est le coup d'œil : reconnaître une chaîne identique,
      // toujours au même endroit, sans lire. Une garde qui accepterait un synonyme garderait
      // l'intention en laissant tomber le seul effet recherché.
      const LITTERALE = "J'ai besoin de toi :";
      const lignes = s.corps.split('\n').filter((l) => /besoin de toi/i.test(l));
      assert.ok(lignes.length >= 2, `la formule doit être montrée dans ses DEUX formes — la demande et le « rien » (${lignes.length} ligne·s trouvée·s)`);
      for (const l of lignes) {
        assert.ok(
          l.includes(LITTERALE),
          `« ${l.trim()} » n’écrit pas la formule telle quelle : le bénéfice est de reconnaître une chaîne IDENTIQUE sans lire, et une variation le détruit`,
        );
      }
      assert.ok(
        lignes.some((l) => /:\s*rien\./i.test(l)),
        'la forme « J’ai besoin de toi : rien. » doit être montrée — c’est celle qu’on omet, et son omission annule la règle',
      );

      // ── LA VARIANTE PROSCRITE EST NOMMÉE, ET DONNÉE COMME DESTRUCTRICE.
      // Elle doit figurer, sinon personne ne sait ce qui est interdit ; et elle doit figurer du
      // mauvais côté, sinon le texte l'autorise en croyant l'illustrer.
      const variantes = s.corps.split('\n').filter((l) => /ce que j'attends de toi/i.test(l));
      assert.equal(variantes.length, 1, `la reformulation à proscrire doit être nommée une fois exactement (${variantes.length})`);
      assert.match(
        variantes[0], /détruit/i,
        `« ${variantes[0].trim()} » : la variante doit être donnée comme DÉTRUISANT le bénéfice, jamais comme une formulation acceptable`,
      );

      // La sonde accepte « s'écrit » comme « doit s'écrire » : la garantie est que le `rien`
      // S'ÉCRIT, pas la façon dont l'obligation est conjuguée — mesuré par la campagne de
      // reformulations légitimes du 2026-08-17, où « Le `rien` doit s'écrire » faisait crier
      // cette garde sur un texte plus impératif que l'original.
      exigePolarite(
        s.corps, /Le `rien` (?:s'écrit|doit s'écrire)/i,
        'le « rien » s’écrit — une ligne qui n’apparaît qu’en cas de demande oblige à lire le reste pour savoir s’il y en a une',
        { inverse: /inutile de l'écrire|seulement quand tu as besoin|on l'omet|facultative/i },
      );
      exigePolarite(
        s.corps, /La formule est littérale/i,
        'la formule est littérale — l’esprit ne suffit pas, c’est la chaîne qui se balaie',
        { inverse: /tu peux la reformuler|formule-la comme tu veux|l'esprit suffit|à ta façon/i },
      );

      // ⚠️ LA PORTÉE NE S'ÉCRIT PLUS « tous tes messages, sans exception » : la réécriture
      // l'énonce par le défaut qu'elle corrige — « Ce n'est pas la rubrique d'un compte rendu,
      // c'est la dernière ligne de tout message. » C'est la même portée, dite à l'envers, et
      // c'est bien elle qui fait le travail : ce qui la ruine est qu'on la prenne pour la
      // rubrique d'un geste. La sonde suit donc l'énoncé réel de la portée, et continue
      // d'exiger qu'il CONTRAIGNE — « il vaut mieux la mettre partout » ne porterait rien.
      const portees = s.corps.split('\n').filter((l) => /dernière ligne de tout message/i.test(l));
      assert.equal(portees.length, 1, `la portée de la formule doit être énoncée une fois exactement (${portees.length})`);
      exigeContrainte(portees[0], 'la portée de la formule');

      // ── ⚠️ LA COUVERTURE — ET C'EST ELLE QUI FERME LE DÉFAUT D'ORIGINE.
      //
      // La règle existait déjà : le point 3 du format de compte rendu. Elle n'a jamais mordu
      // parce qu'elle était la RUBRIQUE D'UN GESTE — un topo dans la conversation — et que les
      // autres messages n'en savaient rien. Exiger qu'elle soit écrite ici ne prouverait donc
      // rien du tout : ce qu'on garde, c'est qu'elle soit rappelée À CHAQUE ENDROIT OÙ UN
      // MESSAGE SE FABRIQUE. Si l'un d'eux la perd, la règle est redevenue ce qu'elle était.
      //
      // ⚠️ LA PASSE DE FOND A TROUVÉ CE TROU DANS LA PREMIÈRE VERSION DE CE LOT, et il est
      // instructif : la règle se DÉCLARAIT valable sur cinq surfaces, et la garde n'en
      // vérifiait que deux. Retirer le rappel du bilan de clôture laissait le contrôle vert.
      // Une garde qui vérifie moins que ce que le texte promet est un faux témoin — et c'est
      // le motif exact que ce lot ferme, commis dans le lot qui le ferme.
      //
      // ⚠️⚠️ CETTE MOITIÉ EST LAISSÉE ROUGE — LES RAPPELS ONT ÉTÉ PERDUS À LA RÉÉCRITURE.
      //
      // Les sondes de `ENDROITS_OU_UN_MESSAGE_SE_FABRIQUE` ont été RÉ-ANCRÉES sur les titres
      // réels du métier réorganisé (voir la liste, en tête de fichier) : sans ça, la garde
      // échouait sur « section introuvable » et son rejet n'apprenait rien. Ré-ancrée, elle
      // rend un verdict fondé — et ce verdict est que QUATRE des cinq rappels ont disparu.
      // Le métier d'avant les portait tous les cinq ; il n'en reste qu'un, celui du bilan de
      // clôture. Le texte compense par un énoncé unique de portée (« la dernière ligne de tout
      // message ») et par la règle de lecture qui dit d'étendre une règle à sa fonction — mais
      // c'est exactement ce dispositif-là qui n'a PAS mordu la première fois : le métier le
      // dit lui-même, « aucune des trois n'était fausse, et aucune n'a mordu », et il cite
      // nommément « J'ai besoin de toi » comme la règle bornée à une rubrique. Le rappel à
      // chaque surface était le correctif payé par T-20260817-0016 ; on ne le remplace pas par
      // la constatation qu'il a disparu. On ne met donc rien au vert et on n'élargit rien.
      //
      // ⚠️ ON LIT `corpsEtendu`, PAS `corps` : le rappel doit vivre QUELQUE PART sous ce titre,
      // pas forcément dans le chapeau. R1 est un titre de niveau 1 dont le corps propre tient
      // en deux lignes — l'exiger là aurait fabriqué un rejet faux.
      const perdus = [];
      for (const { quoi, sonde } of ENDROITS_OU_UN_MESSAGE_SE_FABRIQUE) {
        const autre = sectionDe(metier, sonde, `« ${quoi} »`);
        if (!/besoin de toi/i.test(autre.corpsEtendu)) perdus.push(`${quoi} (« ${autre.titre} »)`);
      }
      assert.deepEqual(
        perdus, [],
        `${perdus.length} surface(s) ne rappellent plus la formule : elle redevient la rubrique d’un `
          + `seul geste — exactement le défaut qu’elle corrige. ${perdus.join(' · ')}`,
      );
    },
  },

  {
    id: 'une-regle-vaut-pour-sa-fonction',
    quoi: 'le métier dit comment il se lit — une règle vaut pour la fonction qu’elle sert, pas pour le geste où elle est écrite — ET l’extension est bornée',
    verifier({ metier }) {
      const s = sectionDe(metier, /une règle vaut pour sa FONCTION/i, 'sur la façon de lire ce métier');

      exigePolarite(
        s.corps, /applique-la partout où tu exerces cette fonction/i,
        'une règle s’applique partout où sa fonction s’exerce, y compris là où le texte ne la répète pas',
        { inverse: /seulement là où elle est écrite|uniquement au geste décrit|ne l'étends pas|s'arrête au geste/i },
      );

      // ── LES TROIS CAS MESURÉS, APPARIÉS. C'est ce qui distingue cette section d'un principe
      // général : chaque ligne nomme le geste couvert ET le geste resté découvert. Permuter les
      // deux colonnes rend la table plausible et enseigne l'inverse.
      const table = tableDe(s.corps);
      const ecrits = colonne(table, /^Le geste pour lequel elle était écrite$/i, 'le geste pour lequel elle était écrite');
      const decouverts = colonne(table, /^Le geste voisin, resté découvert$/i, 'le geste voisin resté découvert');
      // ⚠️ UNE SONDE RÉ-ANCRÉE, ET C'EST UN RENOMMAGE, PAS UN DÉMÉNAGEMENT (lot 3, 2026-08-17).
      // Le geste resté découvert du premier cas s'écrivait « la ligne directe » ; le gabarit
      // reconstruit dit partout « ta ligne » — le titre de la section qui l'ouvre en R6 est
      // `Ta ligne est obligatoire`, et la cellule dit « **ta ligne** — là où il lit vraiment »,
      // ce que R6 répète mot pour mot (« la ligne est la surface où il lit vraiment »). Même
      // objet, même endroit, autre mot. La sonde accepte les deux plutôt que de garder un
      // vocabulaire que le métier n'emploie plus.
      const CAS = [
        { quoi: 'le format court', ecrit: /conversation/i, decouvert: /ta ligne|ligne directe/i },
        { quoi: '« ce dont j’ai besoin de toi »', ecrit: /rubrique/i, decouvert: /tout message/i },
        { quoi: 'le grain du backlog', ecrit: /rends/i, decouvert: /ouvres/i },
      ];
      assert.equal(table.lignes.length, CAS.length, `${table.lignes.length} cas écrit(s) pour ${CAS.length} gardé(s) — les trois sont ce qui prouve que la règle vient d’une mesure`);
      for (const { quoi, ecrit, decouvert } of CAS) {
        const i = ecrits.findIndex((e) => ecrit.test(e));
        assert.ok(i >= 0, `le cas « ${quoi} » ne nomme plus le geste pour lequel la règle était écrite`);
        assert.match(decouverts[i], decouvert, `le cas « ${quoi} » ne nomme plus le geste resté découvert (« ${decouverts[i]} »)`);
        assert.ok(
          !decouvert.test(ecrits[i]),
          `le cas « ${quoi} » donne le geste découvert comme celui qui était couvert — les deux colonnes sont inversées, et le texte enseigne alors le contraire`,
        );
      }

      // ── LA BORNE, ET ELLE EST OBLIGATOIRE. Une règle qui dit « étends tout » fabrique un
      // orchestrateur qui invente des consignes en croyant les déduire — c'est-à-dire le
      // premier de ses biais (l'autorité apparente), armé par son propre métier.
      // ⚠️ DEUX SONDES RÉ-ANCRÉES SUR LA MÊME PHRASE REFORMULÉE (lot 3). « à une fonction
      // différente, EST une invention » s'écrit aujourd'hui sans son verbe (« … à une fonction
      // **différente**, une invention »), et « se corrige à la source » a pris son gras. Deux
      // tournures, zéro changement de sens : les sondes gardent le FAIT (l'extension bornée, le
      // lieu de la correction) et cessent de dépendre d'un verbe et d'une paire d'astérisques.
      exigePolarite(
        s.corps, /une invention/i,
        'l’extension est bornée à la fonction voisine — l’étendre à une fonction différente est une invention',
        { inverse: /étends-la à tout|toute règle vaut partout|aucune limite/i },
      );
      exigePolarite(
        s.corps, /se corrige \*{0,2}à la source/i,
        'et un trou trouvé se corrige à la SOURCE du gabarit, jamais dans le lieu posé — qui sera remplacé sans prévenir',
        { inverse: /corrige-le dans ton lieu|modifie ton propre CLAUDE\.md|édite-le sur place/i },
      );
    },
  },
];

// ═════════════════════════════════════════ les mutations

/**
 * Chaque mutation : { id, quoi, cible, fichier, muter(texte) }.
 *
 * `cible` nomme le contrôle qui DOIT la voir — et ici, contrairement au harnais du
 * gestionnaire, c'est EXIGÉ et non seulement affiché. La raison est propre à ce lot :
 * `le-metier-a-voyage-entier` compare des sections entières, donc il attraperait
 * accidentellement presque toutes les mutations posées sur le métier transporté. Un
 * harnais qui se contenterait d'« au moins un contrôle rouge » déclarerait alors gardées
 * des garanties dont le contrôle dédié est décoratif.
 */
export const MUTATIONS = [
  {
    id: 'crochet-retourne-par-une-negation',
    quoi: 'l’énoncé du crochet est retourné par une négation, en gardant tous ses mots-clés',
    cible: 'crochet-pose-par-le-dispositif',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 2) : le gabarit reconstruit a rendu sa queue de phrase — « , tu n'as
    // rien à faire » — à la suite du même énoncé. Le motif littéral ne mordait plus, donc la
    // garde passait pour éprouvée sans l'être. Ce que la mutation FAIT est inchangé.
    muter: (t) => t.replace(
      "**Un crochet apparaît sur le message qu'on t'écrit dès que tu l'as pris** — le dispositif le pose seul.",
      "**Ne crois pas qu'un crochet apparaisse seul** — contrairement à ce qu'on dit, le dispositif le pose seul est faux : c'est toi qui le poses.",
    ),
  },
  {
    id: 'crochet-devenu-une-discipline',
    quoi: 'le métier enseigne à l’orchestrateur de poser lui-même le crochet — la garantie redevient une discipline',
    cible: 'crochet-pose-par-le-dispositif',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 2), même cause que la précédente.
    muter: (t) => t.replace(
      'le dispositif le pose seul.',
      'pose un crochet sur son message dès que tu l\'as lu.',
    ),
  },

  // ── ce que la compétence garantit encore, et le seuil que le CTO a retiré
  //
  // ⚠️ CES MUTATIONS VISAIENT `le-metier-a-voyage-entier`, QUI N'EXISTE PLUS (lot 2). Leur
  // cible a été redirigée vers la garde qui a RECUEILLI la fonction qu'elles éprouvaient —
  // jamais retirée pour faire taire un rouge. Le motif du retrait de la garde est écrit là où
  // elle vivait, en tête de `la-competence-reste-invocable`.
  {
    id: 'la-competence-perd-son-en-tete',
    quoi: 'la compétence cesse d’être invocable — son en-tête part, et elle disparaît sans que son retrait soit décidé',
    cible: 'la-competence-reste-invocable',
    fichier: 'competence',
    muter: (t) => t.replace(/^---\nname: orchestrer-chantier\n/, '---\nname: orchestrer-un-chantier\n'),
  },
  {
    id: 'la-competence-est-videe-en-etant-deplacee',
    quoi: 'la compétence garde son en-tête et perd son corps — et `gestes-de-session-existants`, qui y lit les formes herdr réelles, est désarmé sans un mot',
    cible: 'la-competence-reste-invocable',
    fichier: 'competence',
    muter: (t) => t.slice(0, t.indexOf('\n---\n') + 5) + '\nVoir le `CLAUDE.md` du lieu.\n',
  },

  {
    id: 'une-section-du-metier-disparait',
    quoi: 'le bloc qui définit les trois niveaux est perdu en entier — avec lui, ce qui fait qu’un agent ouvert EST un chef d’équipe',
    cible: 'le-niveau-se-lit-dans-le-role',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE (lot 2) : elle retirait « ### 3-bis. Dimensionner », un titre que la
    // réécriture par la fonction a fait disparaître — le motif ne mordait plus. Elle retire
    // désormais le bloc où la règle SERT. Ce qu'elle éprouve n'a pas bougé : qu'une section
    // entière puisse partir sans qu'une garde s'en aperçoive.
    muter: (t) => t.replace(/^## Les trois niveaux\n[\s\S]*?(?=^### Combien de chefs)/m, ''),
  },
  {
    id: 'une-section-du-metier-est-reecrite',
    quoi: 'le seuil retiré par le dirigeant est réintroduit en « améliorant » une section au passage',
    cible: 'le-niveau-se-lit-dans-le-role',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Le niveau se lit dans le rôle, jamais dans un seuil.**',
      '**Le niveau se lit dans un seuil : deux périmètres parallèles, ou cinq agents à coordonner.**',
    ),
  },

  {
    id: 'revue-P1-le-preambule-est-reecrit',
    quoi: 'le « tu ne codes pas » devient son contraire — le premier interdit fondateur du métier',
    cible: 'il-orchestre-il-n-execute-pas',
    fichier: 'metier',
    // Trouvée par la PASSE 1 de la revue indépendante : le préambule échappait entièrement à
    // la garde de fidélité, `sections()` ne rendant que ce qui suit un titre.
    // ⚠️ RECIBLÉE (lot 2) : elle visait `le-metier-a-voyage-entier`, qui gardait le préambule
    // par comparaison avec la compétence. Cette prémisse est tombée ; l'interdit, lui, est
    // gardé sur le gabarit SEUL par `il-orchestre-il-n-execute-pas`, qui est son vrai terrain.
    // Le « Tu ne codes pas. » du préambule d'origine n'existe plus comme phrase : la
    // réécriture par la fonction porte le même interdit dans la colonne « Ce qu'il ne fait
    // **jamais** » de la table des niveaux. Le motif suit la fonction, pas l'ancienne phrase.
    muter: (t) => t.replace(
      'ne code pas, ne relit pas le code',
      'code ce qui va vite, relit le code',
    ),
  },
  {
    id: 'revue-P1-le-second-principe-fondateur-disparait',
    quoi: 'le principe « l’orchestrateur ne déploie que des chefs d’équipe » est retiré — il ouvrait ce qu’il voulait',
    cible: 'il-orchestre-il-n-execute-pas',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE (2026-08-17) : elle retirait la ligne de citation du préambule qui portait
    // le principe. Cette ligne n'existe plus — le principe est passé dans la table de
    // « Ce que tu ne peux pas faire », où il est REFUSÉ plutôt qu'affirmé. Elle retire donc
    // désormais la rangée qui porte ce refus. Ce qu'elle FAIT est identique : le second
    // principe fondateur disparaît du gabarit, et l'orchestrateur ouvre ce qu'il veut.
    muter: (t) => t.replace(/^\| \*\*Ouvrir un sous-agent\*\* \|.*\n/m, ''),
  },

  // ── ajout 3 : la ligne obligatoire (le retrait)
  {
    id: 'la-phrase-retiree-revient',
    quoi: 'la phrase « continue sans elle » est réintroduite — la ligne redevient facultative',
    cible: 'ligne-obligatoire',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE sur le texte réel : la phrase retournée s'écrivait « Ta ligne est
    // obligatoire, et c'est un préalable au chantier. » ; la réécriture par la fonction dit le
    // même fait par le MOMENT de l'ouverture. La mutation retourne donc ce moment — et
    // réintroduit du même geste la phrase que l'ajout 3 avait retirée, ce qui est exactement
    // ce qu'elle éprouvait avant.
    muter: (t) => t.replace(
      "**Tu l'ouvres en naissant, tu la refermes en clôturant.**",
      "**Tu l'ouvres quand tu en as besoin** — et si elle ne peut pas s'ouvrir, dis-le et continue sans elle.",
    ),
  },
  {
    id: 'le-refus-devient-une-recommandation',
    quoi: 'le refus garde sa place et cesse d’obliger — « tu peux commencer sans elle si ça presse »',
    cible: 'ligne-obligatoire',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**tu ne commences pas** : dis ce qui manque",
      "tu peux commencer quand même si ça presse : dis ce qui manque",
    ),
  },

  {
    id: 'revue-P2-la-seconde-affirmation-s-assouplit',
    quoi: 'l’obligation est assouplie là où elle est nommée, pendant qu’elle tient là où elle est gardée',
    cible: 'ligne-obligatoire',
    fichier: 'metier',
    // Trouvée par la PASSE 2 : l'ajout 3 affirmait l'obligation à deux endroits, et un seul
    // était gardé. Un lecteur applique celui qu'il a lu en dernier.
    //
    // ⚠️ RÉ-ANCRÉE : la réécriture par la fonction a FUSIONNÉ les deux endroits en un seul, et
    // c'est désormais le TITRE de la section qui porte l'affirmation. Un titre s'assouplit
    // exactement comme le paragraphe d'hier, et sans qu'on le relise — c'est donc lui que
    // cette mutation retourne, pour éprouver l'`exigeImperatif` posé dessus.
    muter: (t) => t.replace(
      '## Ta ligne est obligatoire\n',
      '## Ta ligne est obligatoire, sauf si ça presse\n',
    ),
  },
  {
    id: 'revue-P2-un-anti-pattern-d-origine-disparait',
    quoi: 'une ligne de la table d’anti-patterns est retirée — le mode de régression le plus silencieux d’un document',
    // ⚠️ RECIBLÉE (lot 2) : elle visait la comparaison avec la table de la compétence, qui a
    // été réécrite sur ordre. Le compte se prend désormais sur la table du gabarit pour
    // elle-même — même fonction gardée, sans prémisse à laquelle retomber.
    cible: 'la-table-des-anti-patterns-est-une-liste-fermee',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| Coder « juste ce petit bout » soi-même \|.*\n/m, ''),
  },
  {
    id: 'revue-P2-un-paragraphe-de-1bis-disparait',
    quoi: 'la section qui rend la ligne obligatoire perd un paragraphe — et c’est un retrait qui ne casse rien',
    // ⚠️ RECIBLÉE ET RÉ-ANCRÉE (lot 2) : elle visait la comparaison avec la compétence sur
    // §1-bis, et son motif littéral (« Un arbitrage rendu dans la conversation… ») a été
    // reformulé par la réécriture — donc elle ne mordait plus ET sa cible n'existait plus.
    // La fonction éprouvée est la même : la section qui porte l'obligation de la ligne ne
    // perd pas un paragraphe en silence. Elle est gardée par `ligne-obligatoire`.
    cible: 'ligne-obligatoire',
    fichier: 'metier',
    // Le paragraphe visé est celui qui porte le MOMENT de l'ouverture (« Tu l'ouvres en
    // naissant ») : c'est lui qui fait de la ligne un préalable plutôt qu'un confort, et son
    // retrait ne casse rien d'autre — exactement le retrait qu'on ne voit pas.
    muter: (t) => t.replace(/^[^\n]*ouvres en naissant[^\n]*\n/m, ''),
  },
  {
    id: 'revue-P2-un-septieme-anti-pattern-se-glisse',
    quoi: 'une idée de plus entre dans la table — la liste n’est plus fermée, et personne ne l’a énoncée',
    // ⚠️ RECIBLÉE (lot 2), même motif que la précédente.
    cible: 'la-table-des-anti-patterns-est-une-liste-fermee',
    fichier: 'metier',
    muter: (t) => t.replace(
      /^\| Sauter le topo du matin/m,
      "| Laisser un chef d'équipe fusionner sans revue | Une idée qui n'a jamais été énoncée par le dirigeant |\n| Sauter le topo du matin",
    ),
  },
  {
    id: 'revue-P2-une-rubrique-du-contexte-est-videe',
    quoi: 'la portée garde son titre et perd son corps — l’orchestrateur trouve la question et aucune place pour la réponse',
    cible: 'contexte-appele-et-necessaire',
    fichier: 'contexte',
    muter: (t) => t.replace(/(## Ta portée\n)[\s\S]*?(?=\n## )/m, '$1\n'),
  },
  {
    id: 'revue-P2-l-interdit-de-parler-au-client-disparait',
    quoi: 'l’orchestrateur peut parler au client — le cloisonnement que le représentant existe pour tenir tombe',
    cible: 'contexte-appele-et-necessaire',
    fichier: 'contexte',
    muter: (t) => t.replace(/^> \*\*Tu ne parles jamais au client.*\n/m, ''),
  },

  // ── ajout 1 : appeler les spécialistes
  {
    id: 'la-frontiere-de-l-appel-est-permutee',
    quoi: 'les en-têtes consulter/sous-traiter sont permutés — confier son chantier devient la bonne pratique, sans qu’une cellule bouge',
    cible: 'consulter-jamais-sous-traiter',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| **Consulter — ce que tu fais** | **Sous-traiter — ce que tu ne fais jamais** |',
      '| **Sous-traiter — ce que tu ne fais jamais** | **Consulter — ce que tu fais** |',
    ),
  },
  {
    id: 'sous-traiter-devient-permis',
    quoi: 'confier une unité de travail à un spécialiste passe du côté de ce qu’on fait',
    cible: 'consulter-jamais-sous-traiter',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      "Tu lui poses une question de son domaine",
      "Tu lui confies une unité de travail de ton chantier",
    ),
  },
  {
    id: 'le-specialiste-devient-un-agent-qu-on-ouvre',
    quoi: 'le spécialiste naît de la main de l’orchestrateur — on en fabrique donc un second, ignorant du domaine',
    cible: 'ouvrir-n-est-pas-appeler',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE, ET ELLE LEVAIT UNE EXCEPTION AU LIEU DE MUTER (2026-08-17) : `permuter`
    // refuse une permutation inapplicable, donc ses deux chaînes absentes ne laissaient pas
    // une mutation inopérante — elles faisaient tomber le harnais avant la mesure. Les deux
    // cellules de table qu'elle permutait ont disparu avec la table ; l'opposition, elle, est
    // passée en prose au même endroit. Ce qu'elle FAIT est inchangé au mot près : elle échange
    // l'origine du chef d'équipe et celle du spécialiste, sans toucher aux gestes — donc le
    // spécialiste naît de la main de l'orchestrateur, et on en fabrique un second, ignorant.
    muter: (t) => permuter(
      t,
      'ils naissent pour ton chantier et meurent avec lui',
      'ils existent déjà, ailleurs, et tiennent leur propre domaine',
    ),
  },

  // ── ajout 2 : parler au dirigeant
  {
    id: 'les-chefs-d-equipe-parlent-au-dirigeant',
    quoi: 'l’exclusivité de la parole tombe — deux versions du chantier circulent',
    cible: 'parole-au-dirigeant-exclusive',
    fichier: 'metier',
    // ⚠️ ELLE A ÉTÉ INOPÉRANTE UNE HEURE, ET C'ÉTAIT UN CONSTAT PLUTÔT QU'UN OUBLI : la phrase
    // qu'elle retourne avait été perdue à la réécriture, donc il n'existait plus de texte sur
    // lequel poser le retournement. Elle n'a PAS été retirée pendant ce temps — la retirer
    // aurait effacé la seule trace mécanique de la perte. Rendue au texte par `b493a8f`, elle
    // remord, et c'est ce qu'on attendait d'elle : la garde et sa mutation se sont rouvertes
    // ensemble. Le retournement accepte les deux façons de nommer le destinataire, le pronom
    // comme le nom, pour ne pas redevenir muette à la prochaine reformulation.
    muter: (t) => t.replace(
      /Ni tes chefs d'équipe ni leurs sous-agents ne (?:lui parlent|parlent (?:au CTO|au dirigeant))/,
      'Tes chefs d\'équipe peuvent lui parler directement',
    ),
  },

  {
    id: 'la-ronde-devient-occasionnelle',
    quoi: 'la cadence chiffrée devient un « quand tu le sens » qui ne se vérifie pas',
    cible: 'ronde-horaire',
    fichier: 'metier',
    // RÉ-ANCRÉE : la cadence a quitté la citation de tête pour le corps de « La ronde — ce qui
    // te réveille », et sa valeur par défaut est passée de l'heure à 20-30 minutes. L'ancien
    // motif ne mordait plus — donc la garde ne prouvait plus rien. Ce qu'on retourne reste le
    // même FAIT : une cadence donnée à défaut d'instruction devient une affaire de ressenti.
    muter: (t) => t.replace(
      "À défaut d'instruction : **un tour toutes les 20 à 30 minutes** tant que des agents tournent",
      'À toi de voir : **un tour quand tu le sens nécessaire** tant que des agents tournent',
    ),
  },
  {
    id: 'la-veille-est-donnee-comme-suffisante',
    quoi: 'la veille de déblocage est présentée comme couvrant la ronde — celle-ci devient facultative de fait',
    cible: 'ronde-horaire',
    fichier: 'metier',
    // RÉ-ANCRÉE : la phrase a suivi le chapeau des rondes et gagné son point à l'intérieur du
    // gras (« ta ronde.** »), ce qui suffisait à rendre l'ancien motif inopérant.
    muter: (t) => t.replace(
      '**La veille de déblocage ne remplace pas ta ronde.**',
      '**La veille de déblocage fait déjà ta ronde.**',
    ),
  },
  {
    id: 'la-ronde-autorise-a-prendre-le-clavier',
    quoi: 'la ronde devient une tournée de dépannage — la dérive que le dirigeant a reprise sur ce chantier même',
    cible: 'ronde-n-execute-pas',
    fichier: 'metier',
    // RÉ-ANCRÉE : la phrase de la ronde ne cite plus le clavier (l'interdit est remonté à
    // « Ce que tu ne fais pas de tes mains », muté juste après). Ce qui se retourne ici est ce
    // que la ronde AUTORISE — la moitié qui vit encore dans la rubrique.
    muter: (t) => t.replace(
      '**Ce que tu fais de ce que tu trouves ne change pas** : un agent bloqué se **relance par son brief ou par sa naissance**',
      "**Ce que tu fais de ce que tu trouves t'appartient** : un agent bloqué, tu prends le clavier à sa place quand c'est plus rapide",
    ),
  },
  {
    id: 'le-clavier-redevient-permis-quand-c-est-plus-rapide',
    quoi: 'l’interdit du clavier tombe à son nouveau lieu — la ronde peut de nouveau finir en dépannage, sans qu’un mot bouge dans la ronde',
    cible: 'ronde-n-execute-pas',
    fichier: 'metier',
    // MUTATION NEUVE, et elle suit une garantie qui a DÉMÉNAGÉ. « Tu ne prends pas le clavier à
    // sa place » a quitté la rubrique de ronde pour la section qui vaut pour tous les gestes.
    // Sans elle, la moitié déplacée serait gardée sans être éprouvée — ce qui est exactement
    // l'état qu'on ne sait pas distinguer d'une garde décorative.
    muter: (t) => t.replace(
      "tu ne prends pas le clavier à sa place** — tu regardes et tu tranches",
      "tu prends le clavier à sa place quand c'est plus rapide** — puis tu tranches",
    ),
  },

  // ── ajout 5 : le topo matinal
  {
    id: 'le-topo-perd-son-heure',
    quoi: 'le topo n’a plus de rendez-vous — donc il n’a plus lieu',
    cible: 'topo-matinal',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE SUR LE TITRE : le rendez-vous s'écrivait en tête de corps, il s'écrit
    // maintenant dans le titre de la section. La mutation lui retire son heure sans toucher au
    // reste — le topo garde son nom, ses rubriques et son paragraphe, et n'a plus d'heure.
    muter: (t) => t.replace(
      '## 6 — Le topo du matin, 7 h 00',
      '## 6 — Le topo du matin, quand tu en ressens le besoin',
    ),
  },
  {
    id: 'le-topo-perd-la-rubrique-qui-decide',
    quoi: 'la rubrique « ce qui attend une décision de lui » disparaît — le topo devient un bulletin qu’on lit sans rien faire',
    cible: 'topo-matinal',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE : les quatre rubriques ne sont plus des puces, elles sont énumérées en
    // ligne et séparées par « · ». On retire le segment, pas la puce.
    muter: (t) => t.replace(' · **ce qui attend une décision de lui**, nommément.', '.'),
  },
  {
    id: 'une-horloge-est-inventee',
    quoi: 'le métier prescrit un mécanisme de déclenchement que personne n’a tranché',
    cible: 'topo-matinal',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE : le paragraphe du réveil a quitté la section du topo pour la tête de
    // métier (« La ronde — ce qui te réveille »), où il couvre le topo ET la ronde. La
    // mutation y grave l'horloge que personne n'a tranchée.
    muter: (t) => t.replace(
      '**Tu seras aussi rappelé par un réveil** posé à ta naissance',
      '**Le déclenchement** : pose une entrée `crontab` à 7 h 00 sur ton poste. **Tu seras aussi rappelé par un réveil** posé à ta naissance',
    ),
  },

  // ── ajout 6 : gardien des ADR
  {
    id: 'la-verification-de-la-revue-disparait',
    quoi: 'le geste qui demande de renvoyer une revue incomplète est retiré — celui qui coûte le plus à faire',
    cible: 'gardien-des-adr',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| \*\*Tu vérifies que la revue l'a couverte\*\*.*\n/m, ''),
  },
  {
    id: 'le-gardien-se-met-a-relire-le-code',
    quoi: 'la tension est résolue dans le mauvais sens — l’orchestrateur va vérifier lui-même dans les fichiers',
    cible: 'gardien-des-adr',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| **Tu portes la contrainte dans le brief** |',
      '| **Tu relis le code des chantiers sensibles** |',
    ),
  },
  {
    id: 'les-adr-sont-confondus-avec-le-brief-de-revue',
    quoi: 'les décisions d’architecture sont renvoyées aux motifs de défaut du dépôt, où elles ne sont pas',
    cible: 'gardien-des-adr',
    fichier: 'metier',
    muter: (t) => permuter(t, 'motifs de défaut', "décisions d'architecture"),
  },

  {
    id: 'le-reveil-devient-le-responsable',
    quoi: 'le topo repose entièrement sur le réveil — un réveil muet efface le rendez-vous sans que rien ne le dise',
    cible: 'topo-matinal',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE : la phrase n'ouvre plus sa ligne (elle vit au milieu du paragraphe du
    // réveil, en tête de métier), donc l'ancre `^> **S'il ne fait pas signe` ne mordait plus.
    // On retourne la phrase elle-même, où qu'elle soit dans le paragraphe.
    muter: (t) => t.replace(
      "**S'il ne fait pas signe, tu tiens le rendez-vous quand même** et tu signales qu'il manque",
      "S'il ne fait pas signe, c'est qu'il n'y avait rien à dire",
    ),
  },

  // ── l'ajout 7 : les mémoires
  {
    id: 'le-standard-est-recopie-au-lieu-d-etre-pointe',
    quoi: 'la section mémoire recopie le standard au lieu de le pointer — une copie qui vieillit et ne fait pas foi',
    cible: 'se-sert-des-memoires',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE (2026-08-17) : le pointeur a quitté sa ligne de citation pour la fin du
    // dernier paragraphe de la section — « *(Cadre complet : STD-039.)* ». Ce qu'elle FAIT est
    // inchangé : elle recopie le standard là où le métier se contentait de le pointer.
    muter: (t) => t.replace(
      '*(Cadre complet : STD-039.)*',
      'Les huit invariants, in extenso : I1 nommage par fonction. I2 symétrie des gestes : si une '
        + 'fonction expose une écriture, sa lecture vit au même endroit nommé. I3 un rappel ne fait pas '
        + 'foi. I4 frontière D5. I5 cantonnement group_id. I6 secret hors bande : les credentials '
        + 'restent côté agent. I7 l’encodage travail vers épisodique ne passe pas par le gate. I8 la '
        + 'discipline prime sur le geste. *(Cadre complet : STD-039.)*',
    ),
  },
  {
    id: 'le-rappel-se-met-a-faire-foi',
    quoi: 'la mémoire dit ce qui est vrai, et le registre ne fait plus que rappeler — I3 renversé',
    cible: 'se-sert-des-memoires',
    fichier: 'metier',
    muter: (t) => permuter(t, 'où chercher', "ce qui est vrai aujourd'hui"),
  },
  {
    id: 'un-rappel-vaut-une-mesure',
    quoi: 'la règle qui a coûté le plus cher s’assouplit en recommandation',
    cible: 'se-sert-des-memoires',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE (2026-08-17) : la maxime « Un rappel ne remplace jamais une mesure. » a été
    // remplacée par ce qu'elle IMPOSE — « Le rappel t'a fait gagner la recherche, pas la
    // vérification. » C'est la même règle, dite en geste. La mutation retourne donc la phrase
    // qui la porte aujourd'hui, et fait exactement ce qu'elle faisait : elle transforme la
    // règle qui a coûté le plus cher en recommandation à géométrie variable.
    muter: (t) => t.replace(
      "**Le rappel t'a fait gagner la recherche, pas la vérification.**",
      '**Le rappel vaut généralement une mesure, sauf sur les points sensibles.**',
    ),
  },
  {
    id: 'le-rappel-cesse-d-etre-borne',
    quoi: 'le cantonnement disparaît — l’orchestrateur ramasse le vécu d’un autre projet et le prend pour le sien (I5)',
    cible: 'se-sert-des-memoires',
    fichier: 'metier',
    muter: (t) => t.replace(/^Tout rappel épisodique se fait \*\*borné.*$/m, 'Tout rappel épisodique se fait comme il vient.'),
  },
  {
    id: 'le-geste-est-nomme-par-son-mecanisme',
    quoi: 'le métier nomme le moteur au lieu de la fonction — faux le jour où le moteur change (I1)',
    cible: 'se-sert-des-memoires',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE (2026-08-17) : les gestes n'ont plus de table à eux — ils sont la rangée
    // « Gestes de mémoire » de la table des outils. La mutation nomme donc le moteur à la
    // place du geste dans cette rangée-là. Ce qu'elle FAIT est inchangé au mot près.
    muter: (t) => t.replace('`/episodique` (le vécu)', '`/graphiti` (Neo4j)'),
  },
  {
    id: 'un-moment-du-rappel-disparait',
    quoi: 'on cesse de rappeler avant de trancher — retrancher autrement ce qui l’était déjà redevient possible',
    cible: 'se-sert-des-memoires',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE (2026-08-17) : les trois moments ne sont plus les rangées d'une table mais
    // les trois membres d'une énumération en ligne, séparés par `·`. La mutation retire le
    // troisième membre au lieu de la troisième rangée — même geste, même conséquence : on
    // cesse de rappeler avant de trancher, et retrancher autrement ce qui l'était déjà
    // redevient possible.
    muter: (t) => t.replace(/ · avant de \*\*trancher\*\*[^.]*\./, '.'),
  },
  {
    id: 'les-memoires-se-lisent-l-une-par-l-autre',
    quoi: 'la frontière entre substrats tombe — une réponse qui n’a traversé aucune des deux mémoires (I4)',
    cible: 'se-sert-des-memoires',
    fichier: 'metier',
    muter: (t) => t.replace('**Tu interroges chaque mémoire chez elle**', '**Tu interroges les mémoires par le registre**'),
  },

  // ── les interdits transportés, et la frontière des deux fichiers
  {
    id: 'la-table-des-trois-niveaux-est-permutee',
    quoi: 'les en-têtes « ce qu’il fait » et « ce qu’il ne fait jamais » sont permutés — l’orchestrateur code',
    cible: 'il-orchestre-il-n-execute-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      "| Niveau | Qui | Ce qu'il fait | Ce qu'il ne fait **jamais** |",
      "| Niveau | Qui | Ce qu'il ne fait **jamais** | Ce qu'il fait |",
    ),
  },
  {
    id: 'la-frontiere-des-fichiers-s-inverse',
    quoi: 'le contexte devient le fichier remplacé — ce qui est propre au dépôt disparaît à la première mise à jour',
    cible: 'frontiere-des-deux-fichiers',
    fichier: 'contexte',
    muter: (t) => permuter(t, '`CONTEXTE.md` — ce fichier —', '`CLAUDE.md`'),
  },
  {
    id: 'le-metier-cesse-d-appeler-le-contexte',
    quoi: 'l’appel au contexte devient une mention — l’orchestrateur ne sait plus à qui il répond',
    cible: 'contexte-appele-et-necessaire',
    fichier: 'metier',
    muter: (t) => t.replace('**Avant tout : lis `CONTEXTE.md`.**', 'Un fichier `CONTEXTE.md` existe à côté de celui-ci.'),
  },
  {
    id: 'une-rubrique-du-contexte-disparait',
    quoi: 'la portée n’est plus écrite — deux orchestrateurs d’un même dépôt se marchent dessus',
    cible: 'contexte-appele-et-necessaire',
    fichier: 'contexte',
    muter: (t) => t.replace('## Ta portée', '## Divers'),
  },

  // ── les anti-patterns et la distribution
  {
    id: 'un-anti-pattern-des-ajouts-disparait',
    quoi: 'la faute « commencer un chantier sans ligne » n’est plus nommée comme une faute',
    cible: 'anti-patterns-des-ajouts',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| Commencer un chantier sans avoir ouvert sa ligne \|.*\n/m, ''),
  },
  {
    id: 'les-anti-patterns-sont-permutes',
    quoi: 'les deux en-têtes de la table sont permutés — chaque faute devient une raison de la commettre',
    cible: 'anti-patterns-des-ajouts',
    fichier: 'metier',
    muter: (t) => t.replace(
      "| Ce qu'on est tenté de faire | Pourquoi ça casse |",
      "| Pourquoi ça casse | Ce qu'on est tenté de faire |",
    ),
  },
  {
    id: 'un-chemin-de-machine-entre-dans-le-gabarit',
    quoi: 'le chemin du dossier Architecture est écrit en dur — faux dans tout autre poste',
    cible: 'pas-de-chemin-de-machine',
    fichier: 'metier',
    // T-20260816-0015 : le motif visait « vivent dans le dossier Architecture partagé », une
    // phrase que ce lot a dû retirer — ce dossier est ILLISIBLE depuis le poste (macOS,
    // `Operation not permitted`, T-20260816-0007) et le métier pointe désormais le miroir
    // Somcraft. Le motif suit son texte : ce qu'il éprouve n'a pas bougé d'un pouce — qu'un
    // chemin de machine entre dans le gabarit et que la garde le voie.
    muter: (t) => t.replace(
      'se lisent **par le MCP `somcraft`**',
      'se lisent dans `/Users/maximeleboeuf/Library/CloudStorage/GoogleDrive-maxime.leboeuf@somtech.ca/Disques partagés/Architecture/`',
    ),
  },
  {
    id: 'un-emplacement-a-substituer-entre-dans-le-gabarit',
    quoi: 'le gabarit cesse d’être comparable tel quel — la mise à jour des copies ne saurait plus détecter une divergence',
    cible: 'aucune-substitution',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 2) : la phrase « Tu es le **pilote** d'un chantier. » n'existe plus —
    // la reconstruction oppose désormais le pilote au bras droit. Le motif littéral ne mordait
    // plus. Ré-ancrée sur le TITRE du document, qui est le seul point du texte dont la
    // disparition serait elle-même une perte visible ; ce que la mutation FAIT est inchangé :
    // faire entrer un emplacement à substituer dans le gabarit.
    muter: (t) => t.replace('# Tu es l\'orchestrateur de ce chantier', '# Tu es l\'orchestrateur de {{CHANTIER}}'),
  },
  {
    id: 'une-commande-de-session-est-inventee',
    quoi: 'la ronde enseigne une commande qui n’existe pas — chaque orchestrateur qui la suit perd du temps sur une erreur qui n’est pas la sienne',
    cible: 'gestes-de-session-existants',
    fichier: 'metier',
    muter: (t) => t.replace('herdr agent list                       #', 'herdr agent survey                     #'),
  },

  // ── inscrire ce qui naît, avant de le faire (T-20260813-0043)
  //
  // ⚠️ LES QUATRE SUIVANTES SONT RÉ-ANCRÉES (lot 3, 2026-08-17), ET LEUR MOTIF EST LE MÊME :
  // la phrase du CTO qu'elles retournaient (« une tâche non documentée est une tâche non
  // suivie ») n'existe plus dans le gabarit reconstruit, et l'énoncé du principe s'est déplacé
  // en tête du bloc `R1` sous forme de promesse. **Ce que chacune FAIT est inchangé** — retirer
  // l'énoncé, lui substituer un principe de tenue à jour, le déplacer après ce qu'il gouverne,
  // inverser l'ordre des deux gestes ; seul le lieu où elles mordent a suivi le texte.
  {
    id: 'le-principe-d-inscription-disparait',
    quoi: 'l’énoncé du principe est retiré — R1 revient à ne parler que du suivi de ce qui existe déjà',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace(/^> \*\*À tout moment, le ServiceDesk dit l'état réel du chantier.*\n/m, ''),
  },
  {
    id: 'le-principe-devient-tiens-le-registre-a-jour',
    quoi: 'le principe est remplacé par « tiens le ServiceDesk à jour » — ce que le texte disait DÉJÀ, et exactement la confusion qu’on corrige',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    // LA MUTATION QUI COMPTE LE PLUS. Elle laisse un principe parfaitement plausible en tête
    // de bloc, énoncé de la même façon, au même endroit — et l'ajout est vidé. Une garde
    // qui cherche « ServiceDesk », « ticket » ou « documenter » reste verte devant elle.
    muter: (t) => t.replace(
      /^> \*\*À tout moment, le ServiceDesk dit l'état réel du chantier.*$/m,
      '> **Tiens le ServiceDesk à jour.** Ce qui y est écrit doit refléter la réalité — pour le CTO, pour l\'agent qui reprendra, et pour toi dans deux jours.',
    ),
  },
  {
    id: 'le-principe-passe-apres-le-suivi',
    quoi: 'le principe garde ses mots et perd sa place — écrit après ce qu’il gouverne, il en devient la glose',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      "> **À tout moment, le ServiceDesk dit l'état réel du chantier au grain où le CTO suit.**",
      '**Relis-toi après chaque livraison**',
    ),
  },
  {
    id: 'l-ordre-des-deux-gestes-s-inverse',
    quoi: 'tenir à jour vient avant inscrire — le texte revient à supposer le travail déjà écrit',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace('## Inscrire vient avant tenir à jour', '## Tenir à jour vient avant inscrire'),
  },
  {
    id: 'les-cas-qui-naissent-sont-permutes',
    quoi: 'les deux en-têtes de la table sont permutés — ce qu’on inscrit devient ce qui naît, sans qu’une cellule bouge',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| Ce qui naît en chantier | Ce que tu inscris, et quand |',
      '| Ce que tu inscris, et quand | Ce qui naît en chantier |',
    ),
  },
  {
    id: 'le-defaut-trouve-en-chemin-perd-son-ticket',
    quoi: 'le cas du défaut trouvé en chemin disparaît — celui-là même qui a été greffé sur le ticket d’un voisin',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| \*\*Un défaut trouvé en chemin\*\*.*\n/m, ''),
  },
  {
    id: 'le-travail-qu-on-se-donne-s-inscrit-apres-coup',
    quoi: 'le ticket du travail qu’on se donne s’écrit après l’avoir fait — donc, en pratique, jamais',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace('| son propre ticket, **avant** de le faire |', '| son propre ticket, une fois qu\'il est fait |'),
  },
  {
    id: 'le-critere-devient-le-geste',
    quoi: 'le critère bascule du résultat vers le geste — un ticket par commande lancée, et la règle meurt de bruit',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => permuter(t, 'le travail qui a un résultat', 'le geste'),
  },
  {
    // ⚠️ RENOMMÉE ET RÉ-ANCRÉE (lot 3, 2026-08-17), ET LE MOTIF EST ÉCRIT ICI PARCE QUE SON
    // OBJET A DISPARU DU TEXTE. Elle s'appelait `la-publication-qui-regroupe-perd-son-ticket`
    // et permutait les DEUX PUBLICATIONS APPARIÉES qui illustraient la borne du principe. La
    // reconstruction (`D-20260817-0006`) a remplacé cet exemple par LA QUESTION QUI TRANCHE
    // (« as-tu quelque chose à écrire que le ticket existant ne dit pas ? »), qui couvre les
    // deux sens au lieu de les illustrer. Garder l'ancien id nommerait un objet inexistant.
    // **Ce que la mutation FAIT est inchangé** : retourner la borne pour qu'elle décide à
    // l'envers — le travail qui aboutit se dédouble, celui qui existe pour lui-même reste sans
    // trace. Elle mord désormais sur la question, seul porteur restant de la bidirectionnalité.
    id: 'la-question-qui-tranche-est-retournee',
    quoi: 'la question qui borne le principe décide à l’envers — ce qui reste à écrire ne demande plus de ticket, et ce qui est déjà écrit en demande un',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace(
      'as-tu quelque chose à écrire que le ticket existant ne dit pas ?',
      'le ticket existant dit-il déjà tout ce que tu aurais à écrire ?',
    ),
  },

  // ── le geste manuel qui déverrouille la cascade (T-20260813-0043)
  {
    id: 'la-transition-initiale-disparait',
    quoi: 'la prescription est retirée — la table mentionne encore l’exception, et plus rien ne dit de POSER le geste',
    cible: 'transition-initiale-de-la-demande',
    fichier: 'metier',
    muter: (t) => t.replace(/^\*\*Ton tout premier geste sur une Demande.*\n/m, ''),
  },
  {
    id: 'la-transition-initiale-est-differee',
    quoi: 'le geste est reporté à plus tard — différé, il vaut son absence, et c’est déjà ce qui s’est produit',
    cible: 'transition-initiale-de-la-demande',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : le moment n'est plus collé au gras fermant. Ce qu'elle FAIT est
    // inchangé — différer le geste, ce qui vaut son absence.
    muter: (t) => t.replace(', au moment où tu prends le chantier (', ', quand ton découpage est prêt ('),
  },
  {
    id: 'les-declencheurs-partent-de-received',
    quoi: 'la mécanique est retournée — les déclencheurs partiraient de `received`, et le geste devient inutile en restant écrit',
    cible: 'transition-initiale-de-la-demande',
    fichier: 'metier',
    muter: (t) => t.replace('**partent de `in_analysis`**', '**partent de `received`**'),
  },
  {
    id: 'l-incident-qui-prouve-le-cout-disparait',
    quoi: 'la prescription garde son coût nommé et perd l’incident qui l’a prouvé — il ne reste qu’une affirmation, et une affirmation se renégocie',
    cible: 'transition-initiale-de-la-demande',
    fichier: 'metier',
    // Trouvée par la PASSE 1 de la revue indépendante : la garde exigeait que le coût soit
    // NOMMÉ, pas qu'il soit PROUVÉ. Vider l'incident laissait le contrôle vert.
    // ⚠️ Ré-ancrée (lot 3) : l'incident est devenu une phrase autonome au lieu d'une incise.
    muter: (t) => t.replace(' Une demande est restée `received` deux jours pendant que ses lots étaient en production.', ''),
  },
  {
    id: 'l-incident-est-retourne',
    quoi: 'l’incident est retourné — la Demande aurait été en production pendant que ses lots disaient « reçue », ce qui n’accuse plus le geste manquant',
    cible: 'transition-initiale-de-la-demande',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : même phrase, initiale devenue majuscule.
    muter: (t) => t.replace(
      'Une demande est restée `received` deux jours pendant que ses lots étaient en production',
      'Une demande est restée en production deux jours pendant que ses lots étaient `received`',
    ),
  },

  // ── les échappatoires : la consigne reste écrite et cesse d'obliger (revue de fond)
  //
  // Les trois mutations qui suivent ont été MESURÉES SURVIVANTES par la revue de fond. Elles
  // ne retirent rien et ne permutent rien : elles ajoutent une clause APRÈS la portion
  // littérale que les gardes cherchaient. Le fragment est toujours là, la consigne ne vaut
  // plus rien — et le filet du transport fidèle ne joue pas, ce lot écrivant dans les deux
  // fichiers identiquement.
  {
    id: 'un-cas-s-assouplit-dans-sa-cellule',
    quoi: 'le ticket du travail qu’on se donne s’écrit avant… « si tu en as le temps » — la cellule garde sa colonne, son rang et son mot gardé',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| son propre ticket, **avant** de le faire |',
      '| son propre ticket, **avant** de le faire, si tu en as le temps |',
    ),
  },
  {
    id: 'le-critere-recoit-une-exception',
    quoi: 'le critère s’ouvre une porte — « jamais le geste, sauf décision contraire ponctuelle »',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : la phrase ouvre désormais par une majuscule.
    muter: (t) => t.replace(
      'Le critère est le travail qui a un résultat, jamais le geste.**',
      'Le critère est le travail qui a un résultat, jamais le geste — sauf décision contraire ponctuelle.**',
    ),
  },
  {
    id: 'le-cas-limite-recoit-une-exception',
    quoi: 'l’endroit où le principe s’arrête devient négociable — « sauf si le dirigeant en demande un »',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : la borne s'écrit maintenant « n'en demande pas un second ». Ce
    // qu'elle FAIT est inchangé — laisser le critère écrit et lui ouvrir une porte.
    muter: (t) => t.replace(
      "n'en demande pas un second",
      "n'en demande pas un second, sauf si le CTO en demande un",
    ),
  },

  {
    id: 'la-regle-d-or-13-s-assouplit-dans-le-suivi',
    quoi: 'la consigne voisine du principe — les statuts au moment où l’état change — s’ouvre une porte, et le ServiceDesk se remet à mentir',
    cible: 'le-suivi-oblige-encore',
    fichier: 'metier',
    // Mesurée survivante par la contre-vérification : la modalité était posée sur ce que le lot
    // écrivait, jamais sur la consigne d'à côté, qui dit pourtant la même chose.
    // ⚠️ Ré-ancrée (lot 3) : la puce est devenue la phrase qui suit le titre de la sous-section.
    muter: (t) => t.replace(
      "Jamais différé (règle d'or n°13)",
      "Jamais différé (règle d'or n°13) — sauf si tu manques de temps",
    ),
  },
  {
    id: 'une-consigne-de-suivi-disparait',
    quoi: 'la consigne du compte rendu d’avancement est retirée — le chantier dit ce qu’on allait faire, jamais où on en est',
    cible: 'le-suivi-oblige-encore',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : la puce est devenue un paragraphe de `L'hygiène du ServiceDesk`.
    muter: (t) => t.replace(/^\*\*Le compte rendu d'avancement va sur le chantier lui-même\*\*.*\n/m, ''),
  },
  {
    id: 'la-relecture-devient-negociable',
    quoi: 'la relecture après livraison cesse d’obliger — ce qu’un agent fermé a laissé de faux y reste',
    cible: 'le-suivi-oblige-encore',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : « Relis-toi » et « après chaque livraison » tiennent désormais
    // dans le même gras.
    muter: (t) => t.replace(
      '**Relis-toi après chaque livraison** :',
      '**Relis-toi après chaque livraison**, à moins que la livraison ne soit petite :',
    ),
  },
  {
    id: 'une-cellule-nie-sa-necessite',
    quoi: 'la cellule du chef d’équipe est vidée par une nécessité niée — ni permission ni exception, la troisième famille',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    // Posée par la contre-vérification, et survivante : `PERMISSIF` ne connaissait que la
    // permission et l'exception.
    // ⚠️ Ré-ancrée (lot 3) : la cellule renvoie à R3 au lieu de §4b-bis.
    muter: (t) => t.replace(
      "c'est la filiation (R3) |",
      "c'est la filiation (R3), même si ce n'est pas strictement nécessaire tout de suite |",
    ),
  },

  // ── les anti-patterns miroir du principe
  {
    id: 'un-anti-pattern-de-l-inscription-disparait',
    quoi: 'la faute « laisser une Demande à `received` » n’est plus nommée comme une faute — celle-là même qui a bloqué la cascade deux jours',
    cible: 'anti-patterns-de-l-inscription',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| Laisser une Demande à `received` pendant qu'on travaille dessus \|.*\n/m, ''),
  },
  {
    id: 'un-anti-pattern-de-l-inscription-perd-son-cout',
    quoi: 'la faute reste nommée et perd la raison qui la rend une faute — une faute sans son coût est une préférence',
    cible: 'anti-patterns-de-l-inscription',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 2) : la cellule de coût a perdu son deux-points et sa suite à la
    // reconstruction. Le motif littéral ne mordait plus. Ce que la mutation FAIT est inchangé :
    // laisser la faute nommée et lui retirer son coût.
    muter: (t) => t.replace(
      "| Greffer un défaut trouvé en chemin sur le ticket d'un voisin | Personne ne l'y cherchera |",
      "| Greffer un défaut trouvé en chemin sur le ticket d'un voisin | Ce n'est pas idéal |",
    ),
  },
  {
    id: 'la-mecanique-devient-une-ecriture-de-registre',
    quoi: 'le geste de §2 cesse d’être nommé comme une mécanique — il redevient une consigne de documentation parmi d’autres, donc négligeable',
    cible: 'transition-initiale-de-la-demande',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : « registre » — le mot maison que le métier bannit désormais — a
    // été remplacé par « ServiceDesk » dans la phrase visée. Ce qu'elle FAIT est inchangé.
    muter: (t) => t.replace(
      "Ce n'est pas de la tenue de ServiceDesk, c'est une **mécanique**",
      "C'est de la tenue de ServiceDesk comme le reste",
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════════════════
  // T-20260813-0062 — ce qui doit rougir pour que la protection ne soit pas décorative.
  // Les trois premières sont celles que le ticket nomme : la version complaisante de « ce
  // que tu dis à la place », le retrait de l'autorité apparente, et la contrainte
  // transformée en conseil — la dégradation la plus difficile à attraper, parce qu'elle
  // garde la place, la colonne, le rang et le vocabulaire.
  // ═══════════════════════════════════════════════════════════════════════════════════

  {
    id: 'la-reponse-devient-la-version-complaisante',
    quoi: 'ce qu’il dit à la place devient ce que la pression lui fait dire — le contresens exact, sans qu’une cellule change de contenu',
    cible: 'reflexes-qui-le-visent',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 2) : les deux cellules ont été resserrées à la reconstruction — la
    // première a perdu « que tu n'as pas vérifié », la seconde sa queue « — et tant que ce
    // n'est pas là, le lot attend ». `permuter` LEVAIT au lieu de muter, et le test comptait
    // cette erreur comme un échec sans que personne ne voie que la garde n'était pas éprouvée.
    muter: (t) => permuter(
      t,
      '« Beau travail, on fusionne », devant un compte rendu plausible non vérifié',
      '« Montre-moi le verdict de chaque passe et l\'état de la chaîne »',
    ),
  },
  {
    id: 'les-en-tetes-des-reflexes-sont-permutes',
    quoi: 'les deux libellés d’en-tête sont échangés — l’ordre reformulé de mémoire devient ce qu’on dit à la place, aucune cellule ne bouge',
    cible: 'reflexes-qui-le-visent',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| # | Le piège | Ce que la pression te fait dire | Ce que tu dis à la place |',
      '| # | Le piège | Ce que tu dis à la place | Ce que la pression te fait dire |',
    ),
  },
  {
    id: 'l-autorite-apparente-disparait',
    quoi: 'la ligne sur l’autorité apparente est retirée — c’est celle dont l’absence coûte le plus vite',
    cible: 'reflexes-qui-le-visent',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| 1 \| \*\*Autorité apparente\*\* \|.*\n/m, ''),
  },
  {
    id: 'l-autorite-apparente-est-releguee',
    quoi: 'l’autorité apparente cesse d’ouvrir la table — un réflexe listé en dernier se lit en dernier',
    cible: 'reflexes-qui-le-visent',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Autorité apparente**', '**Ancrage**'),
  },
  {
    id: 'la-contrainte-devient-un-conseil',
    quoi: 'la réponse à faire garde sa colonne, son rang et ses mots, et cesse de contraindre — « évite de valider trop vite »',
    cible: 'reflexes-qui-le-visent',
    fichier: 'metier',
    // LA MUTATION QUE CE LOT COMBAT. Elle ne demande aucune permission, n'ouvre aucune
    // exception, ne nie aucune nécessité : elle conseille. Aucune garde de modalité existante
    // ne la voyait — d'où `CONSEIL`, écrit ici plutôt que dans le harnais partagé.
    // ⚠️ Ré-ancrée (lot 2) : la cellule a perdu sa queue « — et tant que ce n'est pas là, le
    // lot attend » à la reconstruction. Le motif ne mordait plus, et c'est LA mutation que ce
    // lot combat qui passait pour éprouvée.
    muter: (t) => t.replace(
      '« Montre-moi le verdict de chaque passe et l\'état de la chaîne »',
      'Évite de valider trop vite : idéalement, demande-lui le verdict de chaque passe',
    ),
  },

  {
    id: 'le-refus-d-ecrire-disparait-du-fichier-de-droits',
    quoi: 'l’outil d’écriture quitte la liste des refus — le métier promet toujours qu’il ne peut pas écrire, et c’est devenu faux',
    cible: 'les-droits-refusent-ce-que-le-metier-promet',
    fichier: 'droits',
    muter: (t) => t.replace('      "Write",\n', ''),
  },
  {
    id: 'le-refus-du-sous-agent-disparait',
    quoi: 'l’ouverture de sous-agents redevient possible — le second principe fondateur retombe au rang de consigne',
    cible: 'les-droits-refusent-ce-que-le-metier-promet',
    fichier: 'droits',
    muter: (t) => t.replace('      "Task"\n', '      "Read"\n'),
  },
  {
    id: 'le-refus-absolu-devient-le-refus-permeable',
    quoi: 'le refus passe de la forme absolue à la forme relative — MESURÉ perméable : elle laisse écrire hors du répertoire',
    cible: 'les-droits-refusent-ce-que-le-metier-promet',
    fichier: 'droits',
    // C'est le cœur du « à mesurer, jamais à supposer » : les deux formes se ressemblent, et
    // une seule ferme la porte. `Edit(**)` a laissé créer `../evade.txt` ; `Edit(../**)` n'a
    // rien borné du tout. Un fichier de droits qu'on croit contraignant est pire que rien.
    muter: (t) => t.replace('"Edit(//**)"', '"Edit(**)"'),
  },
  {
    id: 'un-outil-refuse-est-aussi-autorise',
    quoi: 'le même outil figure des deux côtés — le fichier se contredit, et se relit comme une permission',
    cible: 'les-droits-refusent-ce-que-le-metier-promet',
    fichier: 'droits',
    muter: (t) => t.replace('      "Read",\n', '      "Read",\n      "Write",\n'),
  },
  {
    id: 'le-metier-cesse-de-nommer-ce-qui-lui-est-refuse',
    quoi: 'la table des refus perd la ligne du sous-agent — le texte et le fichier divergent',
    cible: 'les-droits-refusent-ce-que-le-metier-promet',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| \*\*Ouvrir un sous-agent\*\* \|.*\n/m, ''),
  },

  {
    id: 'revue-passe-1-le-refus-dit-son-contraire-en-gardant-ses-mots',
    quoi: 'la cellule du refus garde les mots gardés et autorise ce qu’elle refusait — « tu peux le faire n’importe où »',
    cible: 'les-droits-refusent-ce-que-le-metier-promet',
    fichier: 'metier',
    // Posée par la PASSE 1 de la revue indépendante : la garde du texte cherchait une
    // SOUS-CHAÎNE, donc le contresens exact la laissait verte. C'est le motif dominant du
    // dépôt, retrouvé un cran plus loin — dans le contrôle censé apparier le texte au fichier.
    muter: (t) => t.replace(
      '| **Écrire ou modifier un fichier** — tous les outils d\'édition, partout sur le disque |',
      '| **Écrire ou modifier un fichier** — tu peux le faire partout sur le disque |',
    ),
  },
  {
    id: 'revue-passe-2-le-refus-du-sous-agent-recoit-son-exception',
    quoi: 'l’exception se pose dans la colonne d’à côté — « sauf pour la revue à deux passes, que tu peux lancer toi-même »',
    cible: 'les-droits-refusent-ce-que-le-metier-promet',
    fichier: 'metier',
    // Posée par la REVUE DE FOND, et elle a survécu à la première version : la modalité n'était
    // tenue que sur la colonne des refus, pas sur celle qui les explique.
    // ⚠️ Ré-ancrée (lot 2) : la cellule a perdu son « le second principe : » à la
    // reconstruction. Le motif ne mordait plus.
    muter: (t) => t.replace(
      '| **Ouvrir un sous-agent** | tu n\'ouvres que des chefs d\'équipe',
      '| **Ouvrir un sous-agent** | tu n\'ouvres que des chefs d\'équipe, sauf pour la revue à deux passes,',
    ),
  },
  {
    id: 'revue-passe-2-la-revue-retombe-sur-l-orchestrateur',
    quoi: 'les deux passes redeviennent son geste à lui — un geste que ses droits refusent, donc une consigne qui envoie contourner',
    cible: 'la-revue-est-lancee-par-le-chef-d-equipe',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Qui les lance : celui qui tient le lot — le chef d\'équipe —, jamais toi.**',
      '**Qui les lance : toi, à chaque epic qui revient.**',
    ),
  },
  {
    id: 'revue-passe-2-l-autorisation-l-emporte-sur-le-refus',
    quoi: 'la polarité de ce qui a été mesuré s’inverse — il suffirait d’ajouter une autorisation pour se délier d’un refus',
    cible: 'ce-qui-a-ete-mesure-garde-sa-polarite',
    fichier: 'metier',
    muter: (t) => t.replace(
      '- un **refus** l\'emporte sur une autorisation',
      '- une **autorisation** l\'emporte sur un refus',
    ),
  },
  {
    id: 'revue-passe-2-c-est-le-refus-qui-serait-ignore',
    quoi: 'le refus passerait pour ignoré tant que le dossier n’est pas approuvé — la garantie serait nulle à la naissance de l’agent',
    cible: 'ce-qui-a-ete-mesure-garde-sa-polarite',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 2) : la puce a perdu son « , elle, » à la reconstruction.
    muter: (t) => t.replace(
      '- une **autorisation** est **ignorée en entier**',
      '- un **refus** est **ignoré en entier**',
    ),
  },
  {
    id: 'une-zone-non-bornee-disparait',
    quoi: 'le terminal cesse d’être nommé comme non borné — la contrainte partielle se lit comme totale',
    cible: 'la-contrainte-dit-aussi-ce-qu-elle-ne-borne-pas',
    fichier: 'metier',
    muter: (t) => t.replace(/^- \*\*le terminal\*\*.*\n/m, ''),
  },
  {
    id: 'le-refus-devient-un-obstacle-a-contourner',
    quoi: 'relancer la session dans un mode plus permissif cesse d’être interdit',
    cible: 'la-contrainte-dit-aussi-ce-qu-elle-ne-borne-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Tu ne relances pas ta session dans un mode plus permissif, et tu ne desserres pas ta propre laisse**',
      'Tu peux relancer ta session dans un mode plus permissif si un refus te bloque',
    ),
  },
  {
    id: 'ce-qui-n-est-pas-refuse-devient-interdit',
    quoi: 'le métier laisse croire qu’un geste absent des listes est interdit, alors qu’il est seulement demandé — donc accordable',
    cible: 'la-contrainte-dit-aussi-ce-qu-elle-ne-borne-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**ce qui n'est pas refusé n'est pas interdit : c'est demandé.**",
      '**ce qui ne figure dans aucune des deux listes est interdit.**',
    ),
  },

  {
    id: 'le-doute-redevient-une-faute',
    quoi: '« je n’ai pas vérifié » cesse d’être une information attendue — et tous les réflexes cèdent sous la pression',
    cible: 'le-doute-est-une-information-attendue',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Un « je n\'ai pas vérifié » est une information attendue de toi, jamais une faute**',
      'Un « je n\'ai pas vérifié » reste un aveu qu\'il vaut mieux éviter',
    ),
  },
  {
    id: 'le-doute-ne-reste-attendu-qu-a-un-seul-endroit',
    quoi: 'la seconde affirmation s’efface pendant que la première tient — le lecteur applique celle qu’il a lue en dernier',
    cible: 'le-doute-est-une-information-attendue',
    fichier: 'metier',
    muter: (t) => t.replace(
      'et **« je n\'ai pas vérifié » est une information attendue de toi, jamais une faute** (voir « Tes réflexes »)',
      'et tu le signales si tu le juges utile',
    ),
  },

  {
    id: 'il-se-remet-a-s-evaluer-lui-meme',
    quoi: 'la règle d’or n°8 cesse de porter sur ses propres conclusions — appliquée au seul code, elle était déjà là',
    cible: 'il-ne-s-evalue-pas-lui-meme',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 2) : le point final est sorti du gras à la reconstruction
    // (« pas**. » au lieu de « pas.** »). Un signe de ponctuation suffisait à rendre la
    // mutation muette — le cinquième piège mesuré par le lot 1, vérifié ici.
    muter: (t) => t.replace(
      '**Et tu ne t\'évalues pas toi-même.** La règle d\'or n°8 fait relire le code par quelqu\'un qui ne l\'a pas écrit ; **tes conclusions n\'y échappent pas**.',
      '**Et tu fais relire le code.** La règle d\'or n°8 le veut ; tes conclusions, elles, sont les tiennes.',
    ),
  },

  {
    id: 'le-brief-retourne-dans-un-fichier',
    quoi: 'le brief redevient un fichier — que ses droits lui refusent, donc le métier l’envoie contourner par le terminal',
    cible: 'le-brief-va-au-registre',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**a. Écrire le brief au registre.**',
      '**a. Écrire le brief dans un fichier.**',
    ),
  },
  {
    id: 'la-livraison-repointe-vers-un-chemin',
    quoi: 'la commande de livraison renvoie l’agent vers un fichier local plutôt que vers le registre',
    cible: 'le-brief-va-au-registre',
    fichier: 'metier',
    muter: (t) => t.replace(
      'Lis ton brief complet au registre — epics action get E-20260727-0010 — et execute-le.',
      'Lis ton brief complet ici et execute-le : <chemin>',
    ),
  },

  {
    id: 'le-compte-rendu-se-valide-sur-parole',
    quoi: 'l’exigence de preuve perd sa conséquence — sans conséquence, une exigence n’en est pas une',
    cible: 'un-compte-rendu-se-verifie-avant-d-etre-valide',
    fichier: 'metier',
    muter: (t) => t.replace(
      'et tant que tu ne l\'as pas, le lot n\'est pas validé.**',
      'et tant que tu ne l\'as pas, tu peux quand même avancer si le compte rendu paraît sérieux.**',
    ),
  },
  {
    id: 'un-compte-rendu-qui-conclut-vaut-preuve',
    quoi: 'la distinction entre un compte rendu qui CONCLUT et un compte rendu qui MONTRE disparaît',
    cible: 'un-compte-rendu-se-verifie-avant-d-etre-valide',
    fichier: 'metier',
    muter: (t) => t.replace(
      'n\'est pas une preuve : la preuve est ce qu\'il **montre**.',
      'vaut preuve quand il est circonstancié.',
    ),
  },

  {
    id: 'la-source-d-un-ordre-se-reformule',
    quoi: 'un ordre du dirigeant peut être relayé « en substance » — c’est ainsi qu’arrivent des ordres que personne n’a donnés',
    cible: 'un-ordre-transmis-porte-sa-source',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Ce que tu transmets porte sa source, et une source se recopie — elle ne se reformule pas.**',
      '**Ce que tu transmets porte sa source, et une source se reformule volontiers pour être plus claire.**',
    ),
  },

  {
    id: 'l-echelle-de-calibration-perd-un-cran',
    quoi: 'l’état « supposé » disparaît — une échelle à deux crans laisse rendre une supposition comme une déduction',
    cible: 'il-calibre-au-moment-ou-il-tranche',
    fichier: 'metier',
    muter: (t) => t.replace('**supposé**, tu le penses', 'et voilà'),
  },
  {
    id: 'non-prouve-redevient-faux',
    quoi: 'la distinction entre « non prouvé » et « faux » disparaît — l’écart a coûté une soirée, et l’hypothèse déclarée fausse était juste',
    cible: 'il-calibre-au-moment-ou-il-tranche',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Et une hypothèse non prouvée n\'est pas une hypothèse fausse.**',
      '**Et une hypothèse que rien n\'appuie peut être écartée comme fausse.**',
    ),
  },

  // ═══════════════════════════════════════════════════════════════════════════════════
  // ⚠️ ICI VIVAIT `un-paragraphe-d-origine-disparait-d-une-section-amendee`, ET VOICI
  // POURQUOI ELLE N'Y VIT PLUS (lot 2, 2026-08-17).
  //
  // Elle retirait un paragraphe d'origine d'une section que le lot s'autorisait à amender —
  // pour prouver que l'exemption servait d'amendement et pas de trou. Elle éprouvait
  // `les-amendements-ne-cachent-pas-une-reecriture`, dont la prémisse (§4-bis, §5, §6 de la
  // compétence, comparées au gabarit) est tombée avec la réécriture par la fonction : ni les
  // sections ni la comparaison n'existent plus, et son motif littéral ne mordait plus non plus.
  //
  // **Elle n'est pas retirée pour faire taire un rouge, et ce qu'elle éprouvait est éprouvé
  // ailleurs** : les garanties des trois sections amendées sont désormais gardées une par une
  // sur le gabarit SEUL, et chacune de ces gardes a ses propres mutations —
  // `le-brief-va-au-registre` (2), `un-compte-rendu-se-verifie-avant-d-etre-valide` (2),
  // `il-calibre-au-moment-ou-il-tranche` (2), `le-doute-est-une-information-attendue` (2),
  // `un-ordre-transmis-porte-sa-source` (1). La ré-écrire ici aurait dupliqué l'une d'elles.
  // ═══════════════════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────────────────
  // T-20260816-0015 · T-20260816-0018 · T-20260816-0006 — les mutations de CE lot.
  //
  // Chacune retourne UNE garantie en polarité, en position ou en portée — jamais en
  // retirant un mot au hasard. Toutes ont été posées et vues rougir avant d'être écrites
  // ici : une mutation qu'on n'a pas vue mordre ne prouve rien (c'est le défaut de la
  // passe 1 sur ce lot, qui a « posé » trois mutations sans jamais les appliquer).
  // ───────────────────────────────────────────────────────────────────────────────────

  {
    id: 'la-hierarchie-des-deux-textes-devient-une-lecture-conjointe',
    quoi: 'le gabarit cesse de gagner en cas de divergence — les deux textes « se lisent ensemble », et la compétence redevient opposable',
    cible: 'le-gabarit-fait-foi',
    fichier: 'metier',
    muter: (t) => t.replace(
      'celui-ci qui gagne',
      'chacun porte une part de la vérité',
    ),
  },

  {
    id: 'le-miroir-des-adr-est-declare-complet',
    quoi: 'le miroir est présenté comme complet — une absence redevient une preuve, et « pas d’ADR là-dessus » recommence',
    cible: 'les-adr-se-lisent-au-miroir-et-une-absence-ne-prouve-rien',
    fichier: 'metier',
    muter: (t) => t.replace(
      'miroir est incomplet',
      'miroir est exhaustif',
    ),
  },

  {
    id: 'le-feed-se-lit-quand-on-a-un-moment',
    quoi: 'la lecture du feed perd son moment — lue après le brief, elle n’a rien empêché',
    cible: 'le-feed-se-lit-avant-de-brieffer',
    fichier: 'metier',
    muter: (t) => t.replace(
      'avant de brieffer qui que ce soit',
      'quand tu as un moment dans la journée',
    ),
  },

  {
    id: 'seule-la-lecture-du-verrou-aurait-failli',
    quoi: 'la moitié « acquisition » disparaît — un `acquired: true` redevient une autorisation de pousser',
    cible: 'le-verrou-du-sas-ne-fait-pas-foi',
    fichier: 'metier',
    muter: (t) => t.replace(
      'acquisition ont failli',
      'seule lecture a failli',
    ),
  },

  {
    id: 'sauter-la-conception-devient-une-maladresse',
    quoi: 'le brief sans conception écrite cesse d’être une faute — il devient déconseillé, donc permis quand ça presse',
    cible: 'la-conception-precede-le-brief-de-construction',
    fichier: 'metier',
    muter: (t) => t.replace(
      'est une faute, au même titre',
      'est déconseillé, un peu comme',
    ),
  },

  {
    id: 'la-ronde-se-met-a-fermer',
    quoi: 'la ronde ferme ce qu’elle juge fini — « la PR est mergée » redevient « le défaut est réglé »',
    cible: 'la-ronde-tient-l-hygiene-du-registre',
    fichier: 'metier',
    muter: (t) => t.replace(
      'Tu signales, tu ne fermes pas',
      'Tu peux fermer ce qui est manifestement fini',
    ),
  },

  {
    id: 'le-critere-des-lignes-redevient-le-dossier-existe',
    quoi: 'le contrôle naïf est réhabilité — il passe sur les 25 lignes et laisse filer les deux qui répondent au même destinataire',
    cible: 'le-topo-passe-les-deux-verifications-quotidiennes',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**ne prouve rien** — sur 25 lignes',
      '**suffit** — sur 25 lignes',
    ),
  },

  // ───────────────────────────────────────────────────────────────────────────────────
  // LA NÉGATION ENVELOPPANTE — six mutations, une par garantie de ce lot.
  //
  // Trouvée le 2026-08-16 par une revue fraîche, sur les gardes que ce lot venait
  // d'écrire : elles cherchaient une SOUS-CHAÎNE, donc « il n'est pas vrai que tu ne
  // fermes pas » les laissait toutes vertes. La phrase gardée est encore là, et elle dit
  // le contraire. Quatre gardes sont tombées d'un coup ; deux autres ne survivaient que
  // par accident, rattrapées par la comparaison octet pour octet parce que leur texte est
  // dupliqué — un filet non voulu n'est pas une garantie, alors les six sont éprouvées.
  //
  // Ces six-là gardent `exigePolarite` honnête. Sans elles, on pourrait le retirer d'un
  // contrôle sans qu'aucun test ne s'en aperçoive.
  // ───────────────────────────────────────────────────────────────────────────────────

  {
    id: 'polarite-la-hierarchie-est-niee-sur-place',
    quoi: 'le gabarit garde tous ses mots et cesse de gagner — la hiérarchie est renversée sans qu’un terme disparaisse',
    cible: 'le-gabarit-fait-foi',
    fichier: 'metier',
    muter: (t) => t.replace('celui-ci qui gagne', 'celui-ci qui gagne — au contraire'),
  },

  {
    id: 'polarite-le-miroir-est-nie-incomplet',
    quoi: 'le miroir reste dit « incomplet » et la phrase le dédit aussitôt — une absence redevient une preuve',
    cible: 'les-adr-se-lisent-au-miroir-et-une-absence-ne-prouve-rien',
    fichier: 'metier',
    muter: (t) => t.replace('miroir est incomplet', 'miroir est incomplet, en réalité il est complet'),
  },

  {
    id: 'polarite-le-moment-du-feed-est-nie',
    quoi: 'le feed garde son « avant de brieffer » et le perd dans la même phrase',
    cible: 'le-feed-se-lit-avant-de-brieffer',
    fichier: 'metier',
    muter: (t) => t.replace(
      'avant de brieffer qui que ce soit',
      'avant de brieffer qui que ce soit — en réalité quand tu en trouves le temps',
    ),
  },

  {
    id: 'polarite-le-verrou-refait-foi',
    quoi: 'le verrou « ne fait pas foi » et fait foi trois mots plus loin — la garantie centrale du lot, renversée sur place',
    cible: 'le-verrou-du-sas-ne-fait-pas-foi',
    fichier: 'metier',
    // « ne fait pas foi » seul mordait AILLEURS — le gabarit le dit aussi du fil de la ligne et
    // d'un rappel de mémoire, et `replace` prend la première occurrence. La mutation mordait
    // donc hors du sas et aucun contrôle ne la voyait : survivante, attrapée par la GARDE 2.
    muter: (t) => t.replace('Le verrou ne fait pas foi', 'Le verrou ne fait pas foi — au contraire'),
  },

  {
    id: 'polarite-la-ronde-se-remet-a-fermer',
    quoi: 'LE cas qui a motivé cette famille de mutations : « il n’est pas vrai que tu signales, tu ne fermes pas »',
    cible: 'la-ronde-tient-l-hygiene-du-registre',
    fichier: 'metier',
    muter: (t) => t.replace(
      'Tu signales, tu ne fermes pas',
      "Il n'est pas vrai que tu signales, tu ne fermes pas",
    ),
  },

  {
    id: 'polarite-le-critere-naif-est-rehabilite-par-la-negation',
    quoi: 'le critère du dossier « ne prouve rien », et la phrase le réhabilite immédiatement',
    cible: 'le-topo-passe-les-deux-verifications-quotidiennes',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**ne prouve rien** — sur 25 lignes',
      '**ne prouve rien** — au contraire, sur 25 lignes',
    ),
  },

  // ── Les trois tournures qui ont fait sauter la garde le 2026-08-16, chacune la sienne.
  // Elles n'étaient pas dans la liste ; la garde restait verte pendant que la garantie était
  // renversée. Elles sont désormais mutées, donc leur retrait de `RENVERSEMENT` se verrait.

  {
    id: 'polarite-la-ronde-est-niee-par-a-l-oppose',
    quoi: 'la ronde est renversée par « à l’opposé de ce qu’on pourrait croire » — tournure absente de la liste jusqu’au 2026-08-16',
    cible: 'la-ronde-tient-l-hygiene-du-registre',
    fichier: 'metier',
    muter: (t) => t.replace(
      'Tu signales, tu ne fermes pas',
      "À l'opposé de ce qu'on pourrait croire, tu signales, tu ne fermes pas",
    ),
  },

  {
    id: 'polarite-la-ronde-est-niee-par-c-est-faux',
    quoi: 'la ronde est renversée par « c’est faux : » — la forme nue figure légitimement dans le gabarit, seule celle à deux-points est un renversement',
    cible: 'la-ronde-tient-l-hygiene-du-registre',
    fichier: 'metier',
    muter: (t) => t.replace(
      'Tu signales, tu ne fermes pas',
      "C'est faux : tu signales, tu ne fermes pas",
    ),
  },

  {
    id: 'polarite-la-ronde-est-niee-par-dans-les-faits',
    quoi: 'la ronde est renversée par « dans les faits »',
    cible: 'la-ronde-tient-l-hygiene-du-registre',
    fichier: 'metier',
    muter: (t) => t.replace(
      'Tu signales, tu ne fermes pas',
      'Dans les faits, tu signales, tu ne fermes pas',
    ),
  },

  // ── VOIE B : la garantie tombe SANS aucune tournure de négation.
  // La phrase gardée reste intacte, aucun mot de `RENVERSEMENT` n'apparaît — c'est la polarité
  // CONTRAIRE qui est écrite ailleurs dans la section. Un filtre de tournures ne voit rien ici ;
  // seul `inverse` l'attrape. Ces deux mutations sont la preuve que B garde le fait.

  {
    id: 'inverse-la-ronde-est-autorisee-a-fermer',
    quoi: 'la ronde garde son « tu ne fermes pas » ET reçoit l’autorisation de fermer trois lignes plus bas — aucune négation, aucune tournure : la garantie tombe quand même',
    cible: 'la-ronde-tient-l-hygiene-du-registre',
    fichier: 'metier',
    // RÉ-ANCRÉE : « liste d'écarts » n'est plus en gras isolé, la phrase entière l'est. Le
    // motif littéral ne mordait plus ; la mutation reste la même — l'autorisation s'ajoute à
    // côté de l'interdit, sans y toucher.
    muter: (t) => t.replace(
      "**La ronde rend une liste d'écarts",
      "Tu peux fermer ce qui est manifestement fini. **La ronde rend une liste d'écarts",
    ),
  },

  {
    id: 'inverse-le-critere-naif-est-declare-suffisant',
    quoi: 'le critère du dossier garde son « ne prouve rien » ET se voit déclaré suffisant juste après — sans une seule tournure de négation',
    cible: 'le-topo-passe-les-deux-verifications-quotidiennes',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE sur la phrase qui introduit le VRAI critère : « Ce qu'il faut chercher est
    // autre chose » a disparu de la réécriture, mais l'endroit est le même — juste après le
    // « ne prouve rien », là où l'affirmation contraire se glisse le plus naturellement.
    muter: (t) => t.replace(
      '⚠️ **Et le défaut à chercher est deux lignes',
      'Ce test suffit. ⚠️ **Et le défaut à chercher est deux lignes',
    ),
  },

  // ═══════════════ la version « bras droit » (2026-08-16)
  //
  // T-20260816-0099, T-20260816-0097, T-20260816-0018. Toutes ces mutations sont posées sur la
  // COPIE EN MÉMOIRE que `lireGabarits()` rend — aucune n'écrit sur le disque, et l'arbre de
  // travail n'est jamais touché. C'est ce qui permet de retourner un gabarit versionné sans
  // laisser la mutation derrière soi.

  {
    id: 'la-definition-de-poste-est-releguee-apres-la-mecanique',
    quoi: 'le bloc « bras droit » garde TOUS SES MOTS mais passe après la mécanique du chantier — « en tête » devient « en annexe »',
    cible: 'l-orchestrateur-est-le-bras-droit',
    fichier: 'metier',
    // ⚠️ LA MUTATION QUI COMPTE LE PLUS SUR CE LOT, parce que c'est la seule qu'une garde en
    // présence de mots ne verrait JAMAIS : pas un caractère ne disparaît, seule la position
    // change. Or la position EST la garantie — « elle va EN TÊTE, pas en annexe ».
    //
    // ⚠️ RÉ-ANCRÉE LE 2026-08-17, ET SANS ELLE LE CHIFFRE AURAIT MENTI. Elle déplaçait le bloc
    // autour du repère « Tu es le **pilote** », que la reconstruction du métier a retiré : son
    // motif ne mordait plus, le texte revenait intact, et un harnais naïf aurait compté ce
    // silence comme « attrapée ». Elle DÉPLACE désormais le bloc réel — citation, définition,
    // les trois conséquences et la moitié qui protège — sous un titre de section, derrière la
    // table des trois formes de chantier : pas un caractère perdu, la mécanique devant.
    muter: (t) => {
      const bloc = /> 🧭 \*\*« L'orchestrateur[\s\S]*?elle en est la condition\.\*\*\n/.exec(t);
      if (!bloc) return t;
      const sansLeBloc = t.slice(0, bloc.index) + t.slice(bloc.index + bloc[0].length);
      return sansLeBloc.replace(
        /(\| \*\*Livraison\*\* \| `J-…` \|[^\n]*\n)/,
        `$1\n${bloc[0]}`,
      );
    },
  },
  {
    id: 'la-definition-de-poste-redevient-un-compliment',
    quoi: 'la phrase du dirigeant est ramenée à une marque d’estime — le rôle perd ce qu’elle lui imposait',
    cible: 'l-orchestrateur-est-le-bras-droit',
    fichier: 'metier',
    // Ré-ancrée le 2026-08-17 : la phrase porte désormais sa suite dans le même gras (« … pas
    // un compliment — et c'est la première chose que tu dois savoir »), donc le motif qui se
    // fermait sur `**` ne mordait plus. Le retournement, lui, n'a pas bougé d'un mot.
    muter: (t) => t.replace(
      "C'est une définition de poste, pas un compliment",
      "C'est une simple façon de parler, un compliment",
    ),
  },
  {
    id: 'polarite-la-franchise-redevient-une-vertu-ajoutee',
    quoi: 'la condition du rôle est retournée sur place, tous ses mots-clés conservés',
    cible: 'l-orchestrateur-est-le-bras-droit',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**La franchise n\'est pas une vertu ajoutée au rôle — elle en est la condition.**',
      '**Il n\'est pas vrai que la franchise n\'est pas une vertu ajoutée au rôle — elle en est la condition, dit-on, et c\'est faux : c\'est un supplément.**',
    ),
  },

  {
    id: 'le-backlog-redevient-les-tickets',
    quoi: 'le grain du compte rendu bascule sur les tickets — exactement le défaut que le dirigeant a dû reprendre deux fois',
    cible: 'le-backlog-ce-sont-les-demandes',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : la règle est passée d'une puce numérotée au titre de sa section.
    muter: (t) => t.replace(
      '## Ton backlog, ce sont les DEMANDES',
      '## Ton backlog, ce sont les tickets',
    ),
  },
  {
    id: 'inverse-la-concision-devient-un-plafond',
    quoi: 'la règle « réponds la chose demandée » garde tous ses mots ET se voit étendue à l’analyse — la moitié qui protège tombe sans une seule négation',
    cible: 'le-backlog-ce-sont-les-demandes',
    fichier: 'metier',
    // ⚠️ C'EST LA MOITIÉ QUE LA PREUVE DU TICKET EXIGE, et elle tombe par EXTENSION plutôt que
    // par retrait : le texte reste lisible, la règle paraît simplement plus générale. Un
    // orchestrateur muté rendrait une liste à « qu'est-ce que tu en penses ? » — le défaut
    // d'origine, retourné, et plus difficile à voir que lui.
    // ⚠️ Ré-ancrée (lot 3) : « tu en donnes une — entière » s'écrit « tu la donnes **entière** ».
    muter: (t) => t.replace(
      'tu la donnes **entière**',
      'tu réponds toujours en liste',
    ),
  },

  {
    id: 'la-production-cliente-se-mesure-apres-le-geste',
    quoi: 'la mesure passe APRÈS le geste — la fenêtre où la preuve d’attribution existe est refermée',
    cible: 'la-production-cliente-se-mesure-avant-le-geste',
    fichier: 'metier',
    muter: (t) => t.replace(
      "L'état de la production d'un client se mesure et s'inscrit AVANT qu'on y pose un geste.",
      "L'état de la production d'un client se mesure après le geste, et il suffit de mesurer ensuite.",
    ),
  },
  {
    id: 'l-orchestrateur-mesure-la-production-lui-meme',
    quoi: 'mesurer redevient le geste de l’orchestrateur — le premier principe cède, et ses droits le lui refusent de toute façon',
    cible: 'la-production-cliente-se-mesure-avant-le-geste',
    fichier: 'metier',
    muter: (t) => t.replace(
      "ça appartient à ton chef d'équipe",
      "c'est à toi de mesurer",
    ),
  },

  {
    id: 'le-silence-vient-toujours-de-l-autre',
    quoi: 'la moitié qui met l’orchestrateur en cause disparaît — sa propre boîte cesse d’être une cause possible',
    cible: 'avant-de-relancer-regarde-ta-propre-boite',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Un silence a deux causes, et tu es l\'une des deux.**',
      '**Le silence vient toujours de l\'autre bout, jamais de ton côté.**',
    ),
  },
  {
    id: 'polarite-on-peut-conclure-d-un-silence',
    quoi: 'l’interdit de conclure d’un silence est retourné sur place, tous ses mots conservés',
    cible: 'avant-de-relancer-regarde-ta-propre-boite',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Tu ne conclus jamais d'un silence sans avoir mesuré les deux.**",
      "**Ce n'est pas vrai que tu ne conclus jamais d'un silence sans avoir mesuré les deux : un silence prouve qu'il ne travaille pas.**",
    ),
  },

  {
    id: 'la-recolte-redevient-un-controle',
    quoi: 'la récolte est ramenée à une vérification — elle constate l’oubli au lieu de faire le travail, et le lot perd tout ce qui le distinguait',
    cible: 'la-recolte-ecrit-au-lieu-de-constater',
    fichier: 'metier',
    // C'est l'arbitrage du dirigeant qu'on retourne ici : il a écarté trois pistes de CONTRÔLE
    // au profit d'une RÉCOLTE. Le texte muté garde son titre, sa cadence et sa place ; il ne
    // fait plus rien.
    // RÉ-ANCRÉE : la phrase ouvre maintenant le paragraphe, donc sa majuscule a changé — une
    // seule lettre suffisait à rendre la mutation inopérante, et la garde muette.
    muter: (t) => t.replace(
      "**Un contrôle te dit « tu as oublié » ; une récolte fait le travail d'écrire.**",
      "**La récolte vérifie que tu n'as rien oublié.**",
    ),
  },
  {
    id: 'la-limite-de-la-recolte-disparait',
    quoi: 'la récolte se déclare complète — ce qui a été compacté avant elle est réputé rattrapé, et personne ne saura que non',
    cible: 'la-recolte-ecrit-au-lieu-de-constater',
    fichier: 'metier',
    muter: (t) => t.replace(
      'une récolte qui passe après coup ne rattrape jamais ce qui a déjà été compacté',
      'la récolte rattrape tout, y compris ce qui a été compacté',
    ),
  },
  {
    id: 'inverse-la-recolte-dispense-d-inscrire-au-plus-tot',
    quoi: 'la récolte garde sa limite ET se voit déclarée suffisante juste après — sans une seule tournure de négation',
    cible: 'la-recolte-ecrit-au-lieu-de-constater',
    fichier: 'metier',
    // RÉ-ANCRÉE : le renvoi a changé de forme (le principe est désormais pointé par la rubrique
    // qui le porte) et le gras a disparu. La mutation reste la même — la limite tient, et la
    // phrase d'à côté déclare la récolte suffisante.
    muter: (t) => t.replace(
      "Elle n'abroge donc rien de R7.5 : inscrire **au plus tôt**",
      "Elle remplace le principe d'inscrire **au plus tôt**",
    ),
  },

  {
    id: 'la-ronde-se-contente-de-rendre-l-etat',
    quoi: 'la ronde redevient un journal — elle rend des états et n’en tire plus de conséquence',
    cible: 'la-ronde-tire-une-consequence-de-ce-qu-elle-voit',
    fichier: 'metier',
    // RÉ-ANCRÉE : la maxime en tête de section a disparu à la réorganisation ; ce qui porte
    // désormais la garantie est le défaut mesuré, où la ronde avait l'état juste et n'en a rien
    // conclu. On retourne donc ce verdict-là — l'état rendu devient une fin en soi.
    muter: (t) => t.replace(
      "**et elle n'en a rien conclu**",
      "**et un état rendu suffit**",
    ),
  },
  {
    id: 'la-reprise-se-decide-au-grain-du-ticket',
    quoi: 'la reprise repart au grain du ticket — on relance un fragment sans savoir ce qu’il sert',
    cible: 'la-ronde-tire-une-consequence-de-ce-qu-elle-voit',
    fichier: 'metier',
    muter: (t) => t.replace(
      'tu prends la suite **dans le backlog, au grain de la Demande** — jamais du ticket',
      'tu prends la suite **dans le backlog, au grain du ticket**',
    ),
  },
  {
    id: 'le-piege-de-la-neuvieme-tache-disparait',
    quoi: 'l’orchestrateur qui attend un arbitrage est déclaré à l’arrêt — la reprise par le backlog se met à disperser au lieu d’avancer',
    cible: 'la-ronde-tire-une-consequence-de-ce-qu-elle-voit',
    fichier: 'metier',
    // ⚠️ LE REVERS DE LA TÂCHE 9, et sans lui elle NUIT. Les deux situations se ressemblent
    // trait pour trait de l'extérieur : personne ne travaille. Elles appellent des gestes
    // opposés. Une garde qui ne tiendrait que la tâche laisserait passer sa moitié dangereuse.
    muter: (t) => t.replace(
      "**qui attend un arbitrage n'est pas à l'arrêt, il est bloqué**",
      "**qui attend un arbitrage est à l'arrêt comme un autre, et tu relances quand même**",
    ),
  },
  {
    id: 'la-ronde-inscrit-si-elle-y-pense',
    quoi: 'la condition de fin redevient une bonne habitude — la documentation retombe sur le souvenir d’un seul agent',
    cible: 'la-ronde-tire-une-consequence-de-ce-qu-elle-voit',
    fichier: 'metier',
    // RÉ-ANCRÉE : l'énoncé est passé dans le TITRE de sa propre section, et le corps porte
    // maintenant le RANG de la consigne. C'est ce rang qu'on retourne — le texte reste presque
    // identique, et la garantie n'existe plus : « bonne habitude » ne conditionne aucune fin.
    muter: (t) => t.replace(
      "Ce n'est pas une bonne habitude, c'est **sa condition de fin**.",
      "C'est une bonne habitude, quand tu y penses.",
    ),
  },

  {
    id: 'le-critere-des-lignes-regresse-vers-le-meme-destinataire',
    quoi: 'le critère corrigé retourne à sa version FAUSSE — celle qui rendait trois faux positifs sur quatre',
    cible: 'le-topo-passe-les-deux-verifications-quotidiennes',
    fichier: 'metier',
    // ⚠️ CETTE MUTATION GARDE UNE CORRECTION, PAS UN AJOUT — et c'est le cas le plus fragile.
    // Le critère « deux lignes qui répondent au même destinataire » a été écrit d'abord, validé,
    // et trouvé faux à la PREMIÈRE EXÉCUTION RÉELLE : un gestionnaire client porte deux lignes
    // par définition de poste. Une garde qui crie à tort trois fois sur quatre se fait retirer
    // et emporte ce qu'elle gardait. Sans cette mutation, rien n'empêcherait quelqu'un de
    // « resimplifier » le texte vers la version d'origine en croyant l'alléger.
    muter: (t) => t.replace(
      'deux lignes de deux CHANTIERS DIFFÉRENTS sur le même terminal',
      'deux lignes qui répondent au même destinataire',
    ),
  },

  // ═══════════ T-20260817-0016 — les mutations des trois règles du 2026-08-17
  //
  // Chacune est écrite pour ressembler à une amélioration, jamais à un vandalisme : c'est ainsi
  // que ces trois règles ont disparu la première fois — non pas retirées, mais écrites à un seul
  // endroit par quelqu'un de rigoureux. Une mutation qui hurlerait ne prouverait rien.

  {
    id: 'le-raisonnement-remonte-sur-la-ligne',
    quoi: 'le tri garde ses quatre lignes et envoie le raisonnement sur la ligne — chaque mot de la règle est encore là',
    cible: 'la-parole-au-dirigeant-porte-des-faits',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE : la destination s'écrit « le ServiceDesk » depuis que le mot maison
    // « le registre » a été retiré du métier. La cellule est la même, seul son libellé change.
    muter: (t) => t.replace(
      'le détail de ta méthode | **le ServiceDesk** |',
      'le détail de ta méthode | **la ligne** |',
    ),
  },

  {
    id: 'la-ligne-directe-sort-des-surfaces',
    quoi: 'la surface où le dirigeant lit le plus disparaît de la liste — la règle redevient celle qui ne visait que la conversation',
    cible: 'la-parole-au-dirigeant-porte-des-faits',
    fichier: 'metier',
    // ⚠️ C'EST LA RÉGRESSION EXACTE QUE CE LOT FERME, et elle ne retire aucune phrase de règle :
    // le texte continue d'interdire le raisonnement, il cesse seulement de dire OÙ.
    //
    // ⚠️ RÉ-ANCRÉE : les surfaces ne sont plus des puces, elles sont énumérées en ligne et
    // séparées par « · ». On retire le premier segment — celui de la ligne — sans toucher aux
    // quatre autres, comme la version en puces le faisait.
    // Ré-ancrée le 2026-08-17 : le segment de la ligne porte désormais le topo (« **ta ligne**
    // — et le **topo du matin** s'y pose … »). Retirer le segment retire donc les deux, ce qui
    // est exactement la régression que la cible doit voir.
    muter: (t) => t.replace(/\*\*ta ligne\*\* — et le \*\*topo du matin\*\* s'y pose[^·]*· /, ''),
  },

  {
    id: 'la-brievete-autorise-a-taire-une-erreur',
    quoi: 'la moitié qui protège la franchise se retourne en permission de se taire, sous couvert de concision',
    cible: 'la-parole-au-dirigeant-porte-des-faits',
    fichier: 'metier',
    // La plus grave des trois : elle échange une règle de FORME contre une règle de FOND, et le
    // texte reste parfaitement cohérent avec lui-même.
    muter: (t) => t.replace(
      "⚠️ **Ceci déplace l'aveu, ça ne le supprime jamais.**",
      "⚠️ **Ceci vaut aussi pour tes erreurs : inutile de le dire quand ça n'a rien changé.**",
    ),
  },

  {
    id: 'la-formule-est-reformulee',
    quoi: 'la formule du « rien » est remplacée par une variante de même sens — et le coup d’œil meurt sans qu’aucune règle ne manque',
    cible: 'la-formule-jai-besoin-de-toi',
    fichier: 'metier',
    muter: (t) => t.replace(
      "J'ai besoin de toi : rien.",
      'Rien de ton côté.',
    ),
  },

  {
    id: 'le-rien-devient-facultatif',
    quoi: 'la dernière ligne n’apparaît plus que lorsqu’il y a une demande — c’est-à-dire qu’il faut lire le message pour savoir s’il y en a une',
    cible: 'la-formule-jai-besoin-de-toi',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Le `rien` s'écrit — c'est la moitié qui fait fonctionner la règle.**",
      "**Le `rien` est facultatif — la ligne n'apparaît que si tu as une demande.**",
    ),
  },

  {
    id: 'la-formule-nest-plus-rappelee-au-topo',
    quoi: 'la formule reste écrite une fois, dans sa section, et redevient la rubrique d’un seul geste',
    cible: 'la-formule-jai-besoin-de-toi',
    fichier: 'metier',
    // ⚠️ INOPÉRANTE, ET IRRÉ-ANCRABLE EN L'ÉTAT — c'est un constat, pas un oubli. Le rappel
    // qu'elle retourne a été RETIRÉ du métier par la réécriture du 2026-08-17 : la section du
    // topo ne dit plus que le topo se termine par la formule. Il n'y a donc plus de phrase à
    // retourner. C'est très exactement l'état que cette mutation existait pour interdire — le
    // texte est déjà dans sa version mutée. On la laisse : elle rougit en disant « mon motif
    // ne s'applique plus », pendant que `la-formule-jai-besoin-de-toi` rougit en nommant les
    // quatre surfaces qui ont perdu le rappel. Les deux se refermeront ensemble.
    // Ré-ancrée le 2026-08-17, après que `748c67c` a rendu le rappel au topo : le texte dit
    // maintenant « **Le topo est un message comme les autres** : des faits, et `J'ai besoin de
    // toi : …` en dernière ligne ». La mutation le vide de sa dernière ligne sans retirer une
    // seule règle — c'est le geste exact que la cible doit voir.
    muter: (t) => t.replace(
      "**Le topo est un message comme les autres** : des faits, et `J'ai besoin de toi : …` en dernière ligne — `rien.` compris.",
      '**Le topo est un message comme les autres** : des faits.',
    ),
  },

  {
    id: 'la-formule-nest-plus-rappelee-au-bilan',
    quoi: 'le dernier message du chantier perd la formule — la mutation que la première version de ce lot laissait passer',
    cible: 'la-formule-jai-besoin-de-toi',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Le bilan est un message comme les autres** : des faits, et `J'ai besoin de toi : …` en dernière ligne — `rien.` s'il ne reste rien qui lui appartienne, et c'est précisément le cas où l'écrire compte, puisque c'est le dernier mot du chantier.\n\n",
      '',
    ),
  },

  {
    id: 'le-compte-rendu-du-chantier-nest-plus-une-surface-de-parole',
    quoi: 'la surface que le texte déclare — « c’est là que le dirigeant regarde » — cesse de porter la formule',
    cible: 'la-formule-jai-besoin-de-toi',
    fichier: 'metier',
    // ⚠️ INOPÉRANTE POUR LA MÊME RAISON QUE `la-formule-nest-plus-rappelee-au-topo` : le rappel
    // sur le compte rendu du chantier a été retiré du métier par la réécriture du 2026-08-17.
    // Le texte est déjà dans l'état que cette mutation fabriquait. Elle reste écrite pour que
    // la perte ait une trace mécanique, et elle remordra quand le rappel reviendra.
    // Ré-ancrée le 2026-08-17, après que `748c67c` a rendu le rappel : la ponctuation du texte
    // rendu diffère d'un tiret de l'ancienne (« — des faits », et non « : des faits »). Un
    // signe suffisait à la rendre muette, et une mutation muette compte comme une preuve.
    muter: (t) => t.replace(
      " **C'est donc une surface de sa parole comme la ligne** — des faits, et `J'ai besoin de toi : …` en dernière ligne, `rien.` compris.",
      '',
    ),
  },

  {
    id: 'toute-erreur-remonte-sur-la-ligne',
    quoi: 'le seuil de remontée saute : la franchise se remet à tout envoyer sur la ligne, et elle redevient illisible',
    cible: 'la-parole-au-dirigeant-porte-des-faits',
    fichier: 'metier',
    // ⚠️ RÉ-ANCRÉE : la ponctuation de la phrase a changé au fil de la réécriture (le point est
    // devenu un point-virgule, et le « Sinon » a perdu sa majuscule). Le motif suivait la
    // ponctuation ; il suit maintenant la phrase.
    muter: (t) => t.replace(
      "**Une erreur ne remonte sur la ligne que si elle change une décision qu'il est en train de prendre** ; sinon elle s'inscrit, et elle se tait.",
      '**Toute erreur remonte sur la ligne, dès que tu la vois.**',
    ),
  },

  {
    id: 'la-regle-sarrete-au-geste-ou-elle-est-ecrite',
    quoi: 'la consigne de lecture est retournée : une règle ne vaut plus que là où elle est écrite',
    cible: 'une-regle-vaut-pour-sa-fonction',
    fichier: 'metier',
    muter: (t) => t.replace(
      'puis applique-la partout où tu exerces cette fonction, y compris là où le texte ne la répète pas',
      'puis applique-la au geste qu’elle décrit',
    ),
  },

  {
    id: 'lextension-perd-sa-borne',
    quoi: 'la règle de lecture cesse de borner l’extension — un orchestrateur invente alors des consignes en croyant les déduire',
    cible: 'une-regle-vaut-pour-sa-fonction',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : la phrase a perdu son verbe (« … à une fonction **différente**,
    // une invention »).
    muter: (t) => t.replace(
      'à une fonction **différente**, une invention',
      'à une fonction **différente**, encore ton travail',
    ),
  },

  {
    id: 'la-consigne-du-dirigeant-devient-un-ticket',
    quoi: 'les deux origines sont permutées — chaque moitié reste vraie séparément, et la règle est renversée',
    cible: 'le-backlog-ce-sont-les-demandes',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      '**Demande (`D-…`)** ou **Projet (`P-…`)**',
      '**ticket**, sous le jalon ou sous la demande',
    ),
  },

  {
    id: 'les-tickets-disparaissent-avec-la-regle',
    quoi: 'la moitié qui protège tombe : la règle sur l’origine se lit comme une interdiction d’ouvrir des tickets',
    cible: 'le-backlog-ce-sont-les-demandes',
    fichier: 'metier',
    // ⚠️ Ré-ancrée (lot 3) : « ne te dit pas » s'écrit « ne dit pas ».
    muter: (t) => t.replace(
      "⚠️ **Ceci ne dit pas d'arrêter d'ouvrir des tickets — ça dit d'où ils viennent.**",
      "⚠️ **Ceci dit d'arrêter d'ouvrir des tickets.**",
    ),
  },
];

/**
 * Les garanties de ce lot qui se gardent EN POLARITÉ, et non en présence de mots.
 *
 * ⚠️ CETTE LISTE EST UN OUTIL, PAS UNE DOCUMENTATION. Un test la parcourt et refuse qu'un
 * contrôle inscrit ici garde sa règle avec un simple `assert.match` — parce que corriger six
 * assertions ne ferme rien : le prochain qui écrira une garde écrira une sous-chaîne, comme
 * nous l'avons tous fait, parce que c'est le geste le plus court. Il l'est encore moins
 * maintenant : `exigePolarite(corps, sonde, quoi)` s'écrit en une ligne, comme `assert.match`,
 * et le test ci-dessous rend l'autre chemin plus pénible que celui-là.
 */
export const GARANTIES_DE_POLARITE = [
  'le-gabarit-fait-foi',
  'les-adr-se-lisent-au-miroir-et-une-absence-ne-prouve-rien',
  'le-feed-se-lit-avant-de-brieffer',
  'le-verrou-du-sas-ne-fait-pas-foi',
  'la-ronde-tient-l-hygiene-du-registre',
  'le-topo-passe-les-deux-verifications-quotidiennes',
  // 2026-08-16 — les garanties de la version « bras droit » (T-20260816-0099, T-20260816-0097,
  // T-20260816-0018). Toutes en polarité : ce lot ne produit QUE du texte, et une garde en
  // sous-chaîne y est systématiquement renversable — c'est le défaut mesuré sur quatre gardes
  // neuves le matin même.
  'l-orchestrateur-est-le-bras-droit',
  'le-backlog-ce-sont-les-demandes',
  'la-production-cliente-se-mesure-avant-le-geste',
  'avant-de-relancer-regarde-ta-propre-boite',
  'la-recolte-ecrit-au-lieu-de-constater',
  'la-ronde-tire-une-consequence-de-ce-qu-elle-voit',
  // 2026-08-17 — T-20260817-0016. Les trois règles du jour, plus la consigne de lecture qui
  // ferme le motif commun. Toutes en polarité, pour la même raison que les précédentes : ce
  // sont des règles de texte, et une garde en sous-chaîne y survit à son propre renversement.
  'la-parole-au-dirigeant-porte-des-faits',
  'la-formule-jai-besoin-de-toi',
  'une-regle-vaut-pour-sa-fonction',
];

/** Le source de ce fichier — lu pour vérifier COMMENT les contrôles sont écrits, pas ce qu'ils rendent. */
export function sourceDesControles() {
  return readFileSync(fileURLToPath(import.meta.url), 'utf8');
}

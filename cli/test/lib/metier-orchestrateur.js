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
  exigeImperatif, permuter,
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
  };
}

/** Les paragraphes d'un texte — un bloc séparé des autres par une ligne vide. */
export const parasDe = (t) => t.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 40);

/** Une sonde ancrée sur un titre de section littéral (les titres portent des points). */
const titre = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/**
 * Les deux seules sections que ce lot avait le droit d'amender, avec le motif de chacune.
 *
 * Elles sont écrites ici, en dur et nommément, pour que la liste soit un ENGAGEMENT plutôt
 * qu'une constatation : élargir ce qu'on s'autorise à réécrire demande d'éditer cette liste,
 * ce qui se voit en revue. Une garde qui s'adapterait à ce qu'elle trouve ne garderait rien.
 */
export const SECTIONS_AMENDEES = new Map([
  ['1-bis. Ouvrir ta ligne avec le dirigeant', 'ajout 3 — la ligne devient obligatoire, la phrase de repli disparaît'],
  ['Anti-patterns', 'le miroir des ajouts, dans la table qui existe déjà pour ça'],
  ['4-bis. Pour chaque unité de travail', 'T-20260813-0062 — le brief va au registre (écrire un fichier lui est mécaniquement refusé), et un compte rendu se vérifie avant d’être validé'],
  ['5. Ce que tu tranches toi-même', 'T-20260813-0062 — la calibration et le « je n’ai pas vérifié », à l’endroit exact où il tranche'],
  ['6. Coordonner les chantiers voisins', 'T-20260813-0062 — un ordre transmis porte sa source, parce qu’il sera exécuté sans être questionné'],
]);

/**
 * Ce que les amendements de T-20260813-0062 REMPLACENT dans la section d'origine — et rien
 * d'autre n'a le droit d'y disparaître.
 *
 * ⚠️ POURQUOI CETTE LISTE EXISTE, ET C'EST LA LEÇON DE LA PASSE 2 DU LOT PRÉCÉDENT.
 *
 * Inscrire une section dans `SECTIONS_AMENDEES` la sort de la comparaison octet pour octet :
 * elle est alors hors de TOUTE garde, bien au-delà de l'amendement qu'on voulait s'autoriser.
 * Sur le lot précédent, cette exemption a laissé retirer deux lignes d'origine et un
 * paragraphe entier sans une rougeur. La garde qui tient est **l'inclusion littérale de ce
 * qui devait rester**, plus la déclaration nommée de ce qui part.
 */
export const AMENDEMENTS_DU_LOT = new Map([
  ['4-bis. Pour chaque unité de travail', [
    '**a. Écrire le brief dans un fichier.**',        // → au registre
    "execute-le : <chemin>'",                          // → epics action get
  ]],
  ['5. Ce que tu tranches toi-même', []],              // que des ajouts
  ['6. Coordonner les chantiers voisins', []],         // que des ajouts
]);

/** La phrase que l'ajout 3 RETIRE. Un retrait se défait par mégarde plus facilement qu'un ajout. */
export const PHRASE_RETIREE = 'continue sans elle';

/**
 * Combien d'anti-patterns le gabarit ajoute à ceux du métier — un par ajout qui en appelle un,
 * et pas un de plus. Le nombre est écrit ici pour qu'en ajouter un sixième demande d'éditer
 * cette ligne : la liste des ajouts est fermée, et une idée de plus se voit alors en revue.
 */
export const NB_ANTI_PATTERNS_AJOUTES = 11;

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
  {
    id: 'le-metier-a-voyage-entier',
    quoi: 'chaque section de la compétence existe dans le gabarit, mot pour mot — sauf les deux nommément amendées',
    verifier({ metier }) {
      // « On ne réinvente pas le but, on réinvente le comment. » Le support change ; le
      // texte, non. Comparer les corps OCTET POUR OCTET est la seule façon de le prouver :
      // une garde qui vérifierait que les titres sont là laisserait vider les sections.
      const competence = readFileSync(join(REPO, CHEMIN_COMPETENCE), 'utf8');
      const dansLeGabarit = new Map(sections(metier).map((s) => [s.titre, s.corps]));

      // ⚠️ LE PRÉAMBULE D'ABORD, ET C'EST UN TROU QU'UNE REVUE A TROUVÉ.
      //
      // `sections()` ne rend que ce qui suit un titre : tout ce qui précède la première
      // section échappait donc à la comparaison. Or c'est là que vivent LES DEUX PRINCIPES
      // FONDATEURS et le « tu ne codes pas ». Retirer « l'orchestrateur ne déploie que des
      // chefs d'équipe qui gèrent des sous-agents » ne faisait rougir personne — le cœur du
      // métier était le seul endroit non gardé.
      //
      // Le préambule du gabarit s'ouvre légitimement sur autre chose (son titre, la frontière
      // des deux fichiers, l'appel au contexte) et le verbe change — on ne DEVIENT pas
      // l'orchestrateur d'un `CLAUDE.md`, on l'EST. La comparaison porte donc sur tout ce qui
      // suit ce pivot, et exige une inclusion littérale.
      const PIVOT = "d'un chantier. Il en existe trois formes";
      const preambuleSource = competence.split(/^##\s/m)[0];
      const pivot = preambuleSource.indexOf(PIVOT);
      assert.ok(pivot > 0, `le pivot du préambule (« ${PIVOT} ») a disparu de la compétence : la comparaison ne mordrait plus`);
      const commun = preambuleSource.slice(pivot);
      assert.ok(
        commun.length > 1200,
        `le préambule commun ne fait que ${commun.length} caractères : trop court pour que son `
          + `inclusion prouve quoi que ce soit`,
      );
      assert.ok(
        metier.split(/^##\s/m)[0].includes(commun),
        'le PRÉAMBULE du métier a été réécrit en étant déplacé — c\'est là que vivent les deux '
          + 'principes fondateurs (« un agent qui orchestre n\'exécute jamais », « l\'orchestrateur '
          + 'ne déploie que des chefs d\'équipe qui gèrent des sous-agents ») et le « tu ne codes pas »',
      );

      const perdues = [];
      const reecrites = [];
      let comparees = 0;
      for (const s of sections(competence)) {
        if (SECTIONS_AMENDEES.has(s.titre)) continue;
        if (!dansLeGabarit.has(s.titre)) { perdues.push(s.titre); continue; }
        comparees += 1;
        if (dansLeGabarit.get(s.titre) !== s.corps) reecrites.push(s.titre);
      }

      // ⚠️ AUCUNE SECTION N'EST EXEMPTÉE SANS ÊTRE REPRISE PAR UNE AUTRE GARDE.
      //
      // Le seuil chiffré qui vivait ici (« au moins 20 comparées ») avait un défaut : chaque
      // lot qui amende une section de plus le fait baisser, et on abaisse alors le seuil — la
      // garde se desserre d'elle-même, lot après lot. On exige donc DEUX choses qui ne se
      // desserrent pas : que tout ce qui n'est pas exempté ait bien été comparé, et que tout
      // ce qui est exempté soit nommément gardé ailleurs (le compte des anti-patterns et
      // l'inclusion des paragraphes de §1-bis, ici même ; l'inclusion paragraphe par
      // paragraphe pour les sections de T-20260813-0062).
      const GARDEES_AUTREMENT = new Set([
        '1-bis. Ouvrir ta ligne avec le dirigeant',
        'Anti-patterns',
        ...AMENDEMENTS_DU_LOT.keys(),
      ]);
      for (const t of SECTIONS_AMENDEES.keys()) {
        assert.ok(
          GARDEES_AUTREMENT.has(t),
          `« ${t} » est exemptée de la comparaison octet pour octet sans qu’aucune garde ne la `
            + `reprenne : l’exemption la met hors de TOUTE garde, bien au-delà de l’amendement voulu`,
        );
      }
      assert.equal(
        comparees, sections(competence).length - SECTIONS_AMENDEES.size,
        `${comparees} section(s) comparée(s) pour ${sections(competence).length} au métier moins `
          + `${SECTIONS_AMENDEES.size} amendée(s) : des sections échappent à la comparaison sans être déclarées`,
      );
      assert.ok(
        comparees >= 15,
        `seules ${comparees} sections ont été comparées : le métier fait plusieurs dizaines de `
          + `sections, un si petit nombre veut dire que la comparaison ne mord plus`,
      );
      assert.deepEqual(perdues, [], `ces sections du métier n'ont pas voyagé : ${perdues.join(' · ')}`);
      assert.deepEqual(
        reecrites, [],
        `ces sections ont été RÉÉCRITES en étant déplacées, alors que le lot devait les `
          + `transporter telles quelles : ${reecrites.join(' · ')}`,
      );

      // ⚠️ LES DEUX SECTIONS AMENDÉES SONT GARDÉES AUSSI — ET C'EST LA PASSE 2 QUI L'A EXIGÉ.
      //
      // Les exempter de la comparaison octet-pour-octet les avait mises hors de TOUTE garde,
      // au-delà des quelques phrases que les contrôles dédiés ciblent nommément. La revue a
      // retiré deux lignes d'origine de la table d'anti-patterns et une phrase de §1-bis :
      // les trois mutations sont restées vertes. Une exemption qui devait couvrir un amendement
      // précis couvrait en fait tout le reste de la section.
      //
      // La garde qui tient : **inclusion littérale de ce qui devait rester, plus un compte
      // exact de ce qui s'ajoute.** Retirer une ligne d'origine rougit ; en ajouter une
      // sixième rougit aussi.
      const tableSource = tableDe(sectionDe(competence, /^Anti-patterns$/i, 'd’anti-patterns de la compétence').corps);
      const tableGabarit = tableDe(sectionDe(metier, /^Anti-patterns$/i, 'd’anti-patterns du gabarit').corps);
      const cle = (l) => l.join(' | ');
      const perduesTable = tableSource.lignes.map(cle).filter((l) => !tableGabarit.lignes.map(cle).includes(l));
      assert.deepEqual(
        perduesTable, [],
        `ces anti-patterns du métier ont disparu au déplacement — chacun a été payé une fois, et `
          + `une table dont on retire une ligne est le mode de régression le plus silencieux d'un `
          + `document : ${perduesTable.join(' · ')}`,
      );
      assert.equal(
        tableGabarit.lignes.length - tableSource.lignes.length, NB_ANTI_PATTERNS_AJOUTES,
        `le gabarit ajoute ${tableGabarit.lignes.length - tableSource.lignes.length} anti-pattern(s) `
          + `pour ${NB_ANTI_PATTERNS_AJOUTES} attendu(s) — les ajouts sont une liste fermée, et un `
          + `anti-pattern de plus est une idée qui s'est glissée dans le texte`,
      );

      // §1-bis : même principe, au paragraphe. Tout ce que la compétence y écrit doit se
      // retrouver dans le gabarit, SAUF l'unique paragraphe que l'ajout 3 retire.
      const sourceBis = sectionDe(competence, /Ouvrir ta ligne avec le dirigeant/i, 'de l’ouverture de la ligne (compétence)').corps;
      const gabaritBis = sectionDe(metier, /Ouvrir ta ligne avec le dirigeant/i, 'de l’ouverture de la ligne (gabarit)').corps;
      const aRetirer = parasDe(sourceBis).filter((p) => p.includes(PHRASE_RETIREE));
      assert.equal(aRetirer.length, 1, `la compétence doit porter une fois exactement le paragraphe que l’ajout 3 retire (${aRetirer.length})`);
      const conserves = parasDe(sourceBis).filter((p) => !p.includes(PHRASE_RETIREE));
      assert.ok(conserves.length >= 3, `trop peu de paragraphes conservés (${conserves.length}) pour que la garde morde`);
      const perdusBis = conserves.filter((p) => !gabaritBis.includes(p));
      assert.deepEqual(
        perdusBis, [],
        `ces paragraphes de §1-bis ont disparu au déplacement, alors que seul celui qui porte `
          + `« ${PHRASE_RETIREE} » devait partir : ${perdusBis.map((p) => p.slice(0, 60) + '…').join(' · ')}`,
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

      const s = sectionDe(metier, /Ouvrir ta ligne avec le dirigeant/i, 'sur l’ouverture de la ligne');
      const enonces = s.corps.split('\n').filter((l) => /ne peut pas s'ouvrir/i.test(l));
      assert.equal(enonces.length, 1, `le métier doit dire une fois exactement ce qui arrive quand la ligne ne s’ouvre pas (${enonces.length})`);
      exigeImperatif(enonces[0], 'le refus de commencer sans ligne');
      assert.match(
        enonces[0], /tu ne commences pas|arrête-toi/i,
        `« ${enonces[0].trim()} » ne refuse plus : sans ligne, le chantier ne commence pas`,
      );
      assert.match(s.corps, /préalable au chantier/i, 'et le métier doit nommer la ligne comme un préalable');

      // Le refus doit dire QUOI FAIRE, pas seulement constater — le gestionnaire a mis trois
      // défauts à rendre ce geste honnête, autant les reprendre plutôt que les redécouvrir.
      assert.match(enonces[0], /dis (?:ce qui manque|quoi faire)|quoi faire/i, 'un refus qui ne dit pas quoi faire laisse le lecteur sans issue');

      // ⚠️ LA SECONDE AFFIRMATION, ET LA PASSE 2 L'A TROUVÉE NON GARDÉE.
      //
      // L'obligation est écrite à DEUX endroits — §1-bis, où vit le geste, et la sous-section
      // des capacités, où elle est nommée. Ne garder que le premier laissait assouplir le
      // second : « tu peux commencer un chantier sans elle si ça presse » restait vert. Un
      // lecteur qui trouve les deux appliquera celui qu'il a lu en dernier.
      const dediee = sectionDe(metier, /Ta ligne directe est obligatoire/i, 'de la ligne comme capacité');
      exigeImperatif(dediee.titre, 'le titre de la sous-section de la ligne');
      const affirmations = dediee.corps.split('\n').filter((l) => /sans elle\b/i.test(l));
      assert.equal(affirmations.length, 1, `la sous-section doit affirmer l’obligation une fois exactement (${affirmations.length})`);
      exigeImperatif(affirmations[0], 'l’affirmation de l’obligation dans la sous-section dédiée');
      assert.match(
        affirmations[0], /ne commences pas/i,
        `« ${affirmations[0].trim()} » n’affirme plus l’obligation : les deux endroits qui la portent `
          + `doivent dire la même chose`,
      );
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

      assert.match(s.corps, /guichet/i, 'le métier doit dire ce qu’un orchestrateur qui sous-traite devient');
      assert.match(s.corps, /Quand appeler/i, 'le métier doit dire QUAND appeler');
      assert.match(s.corps, /Lequel appeler/i, 'le métier doit dire LEQUEL appeler');
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
      const table = tableDe(s.corps);
      const gestes = colonne(table, /^Le geste$/i, 'le geste');
      const qui = colonne(table, /^Qui$/i, 'qui c’est');

      const rang = (sonde) => gestes.findIndex((g) => sonde.test(g));
      const ouvrir = rang(/\*\*Ouvrir\*\*/);
      const appeler = rang(/\*\*Appeler\*\*/);
      assert.ok(ouvrir >= 0 && appeler >= 0, 'les deux gestes doivent être nommés dans la table');
      assert.notEqual(ouvrir, appeler, 'ouvrir et appeler ne sont pas le même geste');

      assert.match(qui[ouvrir], /naît de ta main/i, 'un chef d’équipe naît de ta main');
      assert.match(qui[appeler], /existait avant toi/i, 'un spécialiste existait avant toi — sinon ce n’est pas un appel, c’est une ouverture');
      assert.ok(!/existait avant toi/i.test(qui[ouvrir]), 'un chef d’équipe qui préexiste n’est pas un chef d’équipe — la table est inversée');
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
      const s = sectionDe(metier, /Tu parles au dirigeant/i, 'sur la parole au dirigeant');
      const enonces = s.corps.split('\n').filter((l) => /chefs d'équipe/i.test(l));
      assert.equal(enonces.length, 1, `l’exclusivité doit être énoncée une fois exactement (${enonces.length})`);
      assert.match(
        enonces[0], /ni tes chefs d'équipe ni leurs sous-agents ne parlent au dirigeant/i,
        `« ${enonces[0].trim()} » n’énonce plus l’exclusivité : ce qui doit arriver au dirigeant passe par toi`,
      );
      assert.match(s.corps, /passe par toi/i, 'et le métier doit dire que ce qui remonte passe par lui');
    },
  },

  {
    id: 'ronde-horaire',
    quoi: 'la ronde est horaire et par défaut, et la veille de déblocage ne la remplace pas',
    verifier({ metier }) {
      // AJOUT 4. Mesuré : trois agents ont attendu en silence cette semaine, dont un près
      // d'une heure. La cadence est le livrable — « régulièrement » ne se vérifie pas, et
      // « sur demande » est exactement ce qui a produit les trois attentes.
      const s = sectionDe(metier, /Veiller tes agents/i, 'sur la ronde');
      exigeImperatif(s.titre, 'le titre de la ronde');

      const citation = s.corps.split('\n').filter((l) => l.trim().startsWith('>'));
      assert.ok(citation.length >= 1, 'la cadence doit être énoncée en tête de section, comme un principe');
      const enonce = citation.join(' ');
      assert.match(enonce, /toutes les heures/i, 'la cadence est horaire');
      assert.match(enonce, /par défaut/i, 'et elle vaut par défaut');
      assert.ok(
        !/sur demande\b(?!,)/i.test(enonce.replace(/pas sur demande/i, '')),
        'la ronde ne se déclenche pas sur demande — c’est ce qui a laissé trois agents attendre',
      );
      exigeImperatif(enonce, 'la cadence de la ronde');

      // LA POLARITÉ QUI COMPTE : ce que la veille NE couvre pas. L'inverser ferait croire
      // que l'automatisme existant suffit — et la ronde deviendrait facultative de fait.
      const veille = s.corps.split('\n').filter((l) => /veille de déblocage/i.test(l));
      assert.equal(veille.length, 1, `la section doit situer la veille une fois exactement (${veille.length})`);
      assert.match(veille[0], /ne remplace pas/i, `« ${veille[0].trim()} » laisse croire que la veille suffit`);
      for (const angle of [/a fini/i, /arrêté proprement/i, /rouge/i]) {
        assert.match(s.corps, angle, `la section doit nommer ce que la veille ne voit pas (${angle})`);
      }
    },
  },

  {
    id: 'ronde-n-execute-pas',
    quoi: 'ce que la ronde trouve retourne à qui de droit — elle ne fait pas de l’orchestrateur un exécutant',
    verifier({ metier }) {
      // AJOUT 4, son revers. Une consigne de surveillance horaire est une invitation à
      // « juste débloquer ça vite fait » douze fois par jour — c'est-à-dire exactement la
      // dérive que le métier existant nomme (« ce que tu ne fais pas de tes mains ») et que
      // le dirigeant a reprise sur ce chantier même.
      const s = sectionDe(metier, /Veiller tes agents/i, 'sur la ronde');
      const enonces = s.corps.split('\n').filter((l) => /Ce que tu fais de ce que tu trouves/i.test(l));
      assert.equal(enonces.length, 1, 'la section doit dire ce qu’on fait de ce qu’on trouve');
      assert.match(enonces[0], /ne change pas/i, 'la ronde ne change rien aux gestes qui ne t’appartiennent pas');
      assert.match(enonces[0], /ne prends pas le clavier/i, 'et elle ne t’autorise pas à prendre le clavier à sa place');
      assert.match(s.corps, /ne te transforme pas en exécutant/i, 'la section doit conclure sur ce qu’elle n’autorise pas');
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
      const cadence = s.corps.split('\n').filter((l) => /7\s?h/i.test(l));
      assert.ok(cadence.length >= 1, 'l’heure du topo doit être écrite');
      assert.match(cadence[0], /chaque matin/i, 'le topo est quotidien');
      assert.match(cadence[0], /ta ligne|ton canal/i, 'et il se pose sur son canal');
      exigeImperatif(cadence[0], 'le rendez-vous du topo');

      const RUBRIQUES = [
        { quoi: 'où en est le chantier', sonde: /où en est le chantier/i },
        { quoi: 'ce qui tourne en ce moment', sonde: /ce qui tourne/i },
        { quoi: 'ce qui est bloqué', sonde: /bloqué/i },
        { quoi: 'ce qui attend une décision du dirigeant', sonde: /attend une décision/i },
      ];
      const puces = pucesDe(s.corps);
      assert.equal(puces.length, RUBRIQUES.length, `${puces.length} rubrique(s) écrite(s) pour ${RUBRIQUES.length} gardée(s)`);
      for (const { quoi, sonde } of RUBRIQUES) {
        assert.equal(puces.filter((p) => sonde.test(p)).length, 1, `« ${quoi} » doit figurer une fois exactement`);
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
      assert.match(
        s.corps, /le rendez-vous reste tien/i,
        'le métier doit dire que le rendez-vous appartient à l’orchestrateur, réveil ou pas — sinon un réveil muet efface le topo sans que rien ne le signale',
      );
      assert.match(
        s.corps, /tu tiens le rendez-vous quand même/i,
        'et ce qu’il fait quand le rappel ne vient pas',
      );
      for (const invente of ['crontab', 'cron -', 'launchd', 'systemd']) {
        assert.ok(!s.corps.includes(invente), `le métier prescrit un mécanisme d’horloge (« ${invente} ») qui n’a pas été tranché`);
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
      // Trois terrains, et ils sont distincts À DESSEIN : `tableDe` lit toutes les rangées
      // d'un corps comme UNE table, donc deux tables dans une même section se fondraient
      // l'une dans l'autre et la résolution par en-tête cesserait de mordre. Les moments et
      // les gestes vivent donc chacun dans leur (sous-)section.
      const s = sectionDe(metier, /mémoires disponibles/i, 'sur l’usage des mémoires');
      const sGestes = sectionDe(metier, /Les gestes, nommés par ce qu'ils font/i, 'sur les gestes de mémoire');
      const sFoi = sectionDe(metier, /Un rappel ne fait pas foi/i, 'sur l’autorité d’un rappel');

      // ── I3, EN POLARITÉ ET PAS EN PRÉSENCE. Écrire les deux moitiés de la distinction
      // (« rappelle » / « fait foi ») sans les apparier laisserait passer leur PERMUTATION,
      // qui enseigne exactement le contraire : le registre rappellerait, la mémoire ferait foi.
      const [avant, apres] = sFoi.corps.split(/elle ne dit jamais/i);
      assert.ok(apres, 'la phrase qui sépare « où chercher » de « ce qui est vrai » a disparu');
      assert.match(avant, /où chercher/i, 'la mémoire dit où chercher');
      assert.match(
        avant,
        /ce qui fait foi est au ServiceDesk et dans les documents/i,
        'ce qui fait foi doit être nommé, et ce sont le registre et les documents — jamais un rappel',
      );
      assert.ok(
        !/la mémoire fait foi|le rappel fait foi/i.test(sFoi.corps),
        'le texte accorde à un rappel l’autorité qu’il n’a pas (I3)',
      );
      assert.match(apres, /ce qui est vrai/i, 'et la mémoire ne dit jamais ce qui est vrai aujourd’hui');

      // La phrase qui porte tout l'ajout, dans les mots du dirigeant. Elle est courte, donc
      // facile à adoucir en « complète rarement » — et l'adoucir la vide.
      assert.match(
        sFoi.corps,
        /Un rappel ne remplace jamais une mesure\./,
        'la règle qui a coûté le plus cher — un rappel ne remplace jamais une mesure — doit être écrite telle quelle',
      );
      assert.match(sFoi.corps, /absence de résultat/i, 'et le motif nommé : conclure d’une absence de résultat');

      // ── I5, le cantonnement. Un rappel non borné ramasse le vécu d'un autre projet.
      assert.match(sGestes.corps, /group_id/, 'le cantonnement du rappel épisodique doit être nommé (I5)');

      // ── I4, la frontière : chaque mémoire s'interroge chez elle, jamais à travers une autre.
      assert.match(sFoi.corps, /chaque mémoire chez elle/i, 'la frontière entre substrats doit être écrite (I4)');

      // ── I3 encore, par sa conséquence : la seule remontée vers l'opposable.
      assert.match(sFoi.corps, /gate de promotion/i, 'la seule voie vers l’opposable — le gate de promotion — doit être nommée');

      // ── I1, NOMMER PAR LA FONCTION. La garde la plus mécanique des quatre, et celle qui
      // se viole le plus facilement : écrire le nom du moteur au lieu du geste rend le texte
      // faux le jour où le moteur change — ce qui est l'argument entier de l'invariant.
      for (const mecanisme of [/graphiti/i, /neo4j/i]) {
        assert.ok(!mecanisme.test(metier), `le métier nomme un mécanisme (${mecanisme}) au lieu d’une fonction (I1)`);
      }
      const gestes = colonne(tableDe(sGestes.corps), /^Geste$/i, 'les gestes de mémoire');
      for (const attendu of ['/episodique', '/rappel', '/memoire']) {
        assert.equal(
          gestes.filter((g) => g.includes(attendu)).length, 1,
          `le geste « ${attendu} » doit être nommé une fois exactement`,
        );
      }

      // ── QUAND il rappelle. Trois moments, et ils ont en commun d'être AVANT qu'il engage
      // quelqu'un — un rappel fait après le brief ne sert plus à rien.
      const moments = colonne(tableDe(s.corps), /^Moment$/i, 'les moments du rappel');
      const MOMENTS = [/avant de cadrer/i, /avant de rouvrir/i, /avant de trancher/i];
      assert.equal(moments.length, MOMENTS.length, `${moments.length} moment(s) écrit(s) pour ${MOMENTS.length} gardé(s)`);
      for (const sonde of MOMENTS) {
        assert.equal(moments.filter((m) => sonde.test(m)).length, 1, `le moment « ${sonde} » doit figurer une fois exactement`);
      }

      // ── Le pointeur, et RIEN de plus.
      //
      // STD-039 §2.6 borne le noyau *always-on* à quatre invariants + un pointeur, et dit que
      // le voir grossir est « un signal de dérive à corriger, pas à tolérer ». Ce que le
      // métier porte ici n'est pas ce noyau — c'est le MÉTIER de l'orchestrateur : quand il
      // rappelle, et pourquoi un rappel ne vaut pas une mesure. La distinction tient, mais
      // l'esprit du bornage s'applique quand même, et RIEN NE LE GARDAIT (relevé en revue de
      // fond) : on pouvait coller le standard entier ici sans qu'un test bronche.
      assert.match(sFoi.corps, /STD-039/, 'le cadre doit être pointé par son code, pour qu’on aille le lire');

      const section = s.corps + sGestes.corps + sFoi.corps;
      assert.ok(
        section.length < 4000,
        `la section mémoire fait ${section.length} caractères : elle a cessé de pointer le cadre pour le `
          + `recopier. Une copie du standard vieillit en double, et ce n'est pas elle qui fait foi.`,
      );
      // Les invariants que le standard NE demande PAS de graver ici. Les y voir apparaître est
      // le signe qu'on a recopié §2.2 au lieu de pointer le standard.
      for (const horsNoyau of [/\bI2\b/, /\bI6\b/, /\bI7\b/, /\bI8\b/]) {
        assert.ok(
          !horsNoyau.test(section),
          `la section recopie un invariant hors du noyau (${horsNoyau}) : le standard se consulte, il ne se duplique pas`,
        );
      }
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
        [/qui ne soit un chef d'équipe/i, 'n’ouvrir que des chefs d’équipe'],
      ]) {
        assert.match(jamais, sonde, `« ${quoi} » doit figurer du côté de ce qu’il ne fait jamais`);
        assert.ok(!sonde.test(fait), `« ${quoi} » figure du côté de ce qu’il fait — la table est inversée`);
      }

      // Et LES DEUX principes fondateurs, hors table.
      //
      // La première version n'en gardait qu'un, alors que son titre en promettait trois. Une
      // revue a retiré le second — celui qui interdit d'ouvrir un agent qui ne soit pas un
      // chef d'équipe — et rien n'a rougi : le contrôle regardait ce qui était certain d'être
      // là plutôt que ce qu'il prétendait garder. C'est le motif dominant du dépôt, appliqué
      // cette fois à une garde que j'écrivais moi-même.
      for (const [principe, quoi] of [
        [/Un agent qui orchestre n'exécute jamais\./, 'le premier principe — orchestrer n’est pas exécuter'],
        [/L'orchestrateur ne déploie que des chefs d'équipe qui gèrent des sous-agents\./, 'le second principe — il n’ouvre que des chefs d’équipe'],
      ]) {
        assert.match(metier, principe, `${quoi} doit avoir voyagé intact`);
      }
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
        { quoi: 'sous-traiter à un spécialiste', sonde: /agent spécialisé au lieu de lui poser une question/i },
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
    quoi: 'le principe d’inscription ouvre §7 et précède le suivi — et il ne se confond pas avec « tiens le registre à jour »',
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
      const s = sectionDe(metier, /Tenir le ServiceDesk/i, 'sur la tenue du ServiceDesk');

      // ── LE PRINCIPE, EN POSITION. « Précède » est le livrable : la section entière parlait
      // du suivi, et un principe écrit après lui se lit comme sa glose.
      const citations = s.corps.split('\n').filter((l) => l.trim().startsWith('>'));
      assert.equal(citations.length, 1, `le principe doit être énoncé une fois exactement, en citation (${citations.length} trouvée·s)`);
      const principe = citations[0];
      exigeImperatif(principe, 'le principe d’inscription');

      const suivi = s.corps.search(/^À chaque étape/m);
      assert.ok(suivi > 0, 'la section doit toujours porter le suivi qu’elle portait déjà');
      assert.ok(
        s.corps.indexOf(principe) < suivi,
        'le principe est écrit APRÈS le suivi — il en devient une glose, alors que tout ce que le '
          + 'suivi demande (statuts, filiation, compte rendu) suppose le travail déjà inscrit',
      );

      // ── LA POLARITÉ DU PRINCIPE. On apparie le SUJET de « n'existe pas » : c'est ce qui
      // N'EST PAS au registre. « Ce qui est au registre n'existe pas » rougit, et « tiens le
      // registre à jour » — qui n'énonce aucune inexistence — rougit aussi.
      const [sujet, consequence] = principe.split(/n'existe pas/);
      assert.ok(
        consequence !== undefined,
        `« ${principe.trim()} » n’énonce plus l’inexistence de ce qui n’est pas inscrit : c’est un `
          + `principe de tenue à jour, pas d’inscription — la confusion que ce lot corrige`,
      );
      assert.match(
        sujet, /n'est pas au registre/i,
        `« ${principe.trim()} » : c’est ce qui N’EST PAS au registre qui n’existe pas — la polarité est inversée`,
      );
      assert.match(
        principe, /non documentée est une tâche non suivie/i,
        'la phrase du dirigeant doit être écrite telle quelle — c’est elle qui porte tout l’ajout',
      );

      // ── L'ORDRE DES DEUX GESTES, EN POLARITÉ. Les permuter laisse la phrase debout et
      // remet le texte exactement là où il était.
      const ordres = s.corps.split('\n').filter((l) => /vient avant/i.test(l));
      assert.equal(ordres.length, 1, `l’ordre des deux gestes doit être énoncé une fois exactement (${ordres.length})`);
      const [premier, second] = ordres[0].split(/vient avant/i);
      exigeImperatif(ordres[0], 'l’ordre des deux gestes');
      assert.match(premier, /inscrire/i, `« ${ordres[0].trim()} » : c’est INSCRIRE qui vient en premier`);
      assert.match(second, /tenir à jour/i, `« ${ordres[0].trim()} » : … et tenir à jour qui suit — les deux gestes sont inversés`);

      // ── LES QUATRE CAS, EN COMPTE ET EN POLARITÉ D'EN-TÊTE. C'est là que ça se troue :
      // chacun est un manquement réel, et une table dont on retire une ligne est le mode de
      // régression le plus silencieux d'un document.
      const table = tableDe(s.corps);
      const natures = colonne(table, /^Ce qui naît en chantier$/i, 'ce qui naît en chantier');
      const inscriptions = colonne(table, /^Ce que tu inscris, et quand$/i, 'ce que tu inscris, et quand');

      const CAS = [
        { quoi: 'le travail qu’il se donne à lui-même', sonde: /te donnes à toi-même/i, quand: /\*\*avant\*\* de le faire/i },
        { quoi: 'un défaut trouvé en chemin', sonde: /défaut trouvé en chemin/i, quand: /dans l'heure/i },
        { quoi: 'un ajustement demandé en cours de route', sonde: /ajustement que le dirigeant demande/i, quand: /au moment où il est reçu/i },
        { quoi: 'une tâche confiée à un chef d’équipe', sonde: /confies à un chef d'équipe/i, quand: /filiation/i },
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
      // décrit par un ticket existant en est l'aboutissement, pas un travail de plus. Les deux
      // moitiés de l'exemple sont appariées — les permuter ferait dédoubler chaque publication
      // et laisserait sans trace celle qui en regroupe plusieurs.
      const arrets = s.corps.split('\n').filter((l) => /aboutissement/i.test(l));
      assert.equal(arrets.length, 1, `le métier doit dire une fois exactement où le principe s’arrête (${arrets.length})`);
      // Le cas limite est celui qui appelle le plus une échappatoire : « … n'a pas de ticket
      // propre, SAUF si le dirigeant en demande un » laisse le critère écrit et le rend nul.
      exigeImperatif(arrets[0], 'l’endroit où le principe s’arrête');
      assert.match(
        arrets[0], /décrit déjà \*\*en entier\*\*/i,
        'le critère qui sépare les deux doit être écrit — « en entier », pas « à peu près »',
      );
      assert.match(arrets[0], /que le ticket existant ne dit pas/i, 'et la question qui tranche doit être posée');

      const [aboutit, pourLuiMeme] = arrets[0].split(/;\s*celle qui/);
      assert.ok(pourLuiMeme !== undefined, 'les deux cas de la publication doivent être donnés côte à côte');
      assert.match(aboutit, /ne livre qu'un seul ticket connu/i, 'la publication qui ne livre qu’un ticket connu est l’aboutissement');
      assert.match(aboutit, /n'a pas de ticket propre/i, '… et c’est elle qui n’a pas de ticket propre');
      assert.match(pourLuiMeme, /regroupe plusieurs lots/i, 'celle qui regroupe plusieurs lots existe pour elle-même');
      assert.match(pourLuiMeme, /en a un/i, '… et c’est elle qui a un ticket');
      assert.ok(
        !/n'a pas de ticket propre/i.test(pourLuiMeme),
        'la publication qui regroupe plusieurs lots est donnée comme sans ticket — les deux cas sont inversés',
      );
    },
  },

  {
    id: 'transition-initiale-de-la-demande',
    quoi: 'la Demande passe `received → in_analysis` au moment où l’orchestrateur prend le chantier — c’est une mécanique, pas une écriture de registre',
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
      const s = sectionDe(metier, /^2\. Cadrer/i, 'sur le cadrage');
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
      assert.match(geste, /rien ne s'automatise en aval/i, 'et le métier doit dire ce que son absence coûte');
      assert.match(geste, /mécanique/i, 'et le nommer pour ce qu’il est — une mécanique, pas une écriture de registre de plus');

      // ── LE COÛT MESURÉ, PAS SEULEMENT NOMMÉ — relevé en PASSE 1 de revue, et c'était un
      // vrai trou : « rien ne s'automatise en aval » est une affirmation, et une affirmation
      // se renégocie au premier chantier pressé. L'incident qui l'a prouvée, non. Gardé en
      // POLARITÉ, parce que le retourner serait la façon silencieuse de le vider : c'est la
      // DEMANDE qui est restée `received` pendant que ses LOTS étaient en production.
      const [immobile, pendant] = geste.split(/pendant que/i);
      assert.ok(
        pendant !== undefined,
        `« ${geste.trim()} » a perdu l'incident qui prouve le coût du geste non posé — il ne reste `
          + `qu'une affirmation, et une affirmation se renégocie`,
      );
      assert.match(immobile, /restée `received`/i, 'c’est la Demande qui est restée `received`');
      assert.match(pendant, /en production/i, '… pendant que ses lots étaient en production — les deux sont inversés');
    },
  },

  {
    id: 'le-suivi-oblige-encore',
    quoi: 'les cinq consignes de suivi de §7 obligent toujours — celle qui porte la règle d’or n°13 comme les autres',
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
      const s = sectionDe(metier, /Tenir le ServiceDesk/i, 'sur la tenue du ServiceDesk');
      const suivi = s.corps.slice(s.corps.search(/^À chaque étape/m));

      const CONSIGNES = [
        { quoi: 'les statuts au moment où l’état change (règle d’or n°13)', sonde: /statuts au moment où l'état change/i },
        { quoi: 'la filiation de chaque agent ouvert', sonde: /filiation de chaque agent/i },
        { quoi: 'le compte rendu d’avancement sur le chantier', sonde: /compte rendu d'avancement/i },
        { quoi: 'ce qui reste ouvert, et ce qui bloque quoi', sonde: /ce qui reste ouvert/i },
        { quoi: 'ce qui appartient au dirigeant', sonde: /appartient au dirigeant/i },
      ];
      const puces = pucesDe(suivi);
      assert.equal(puces.length, CONSIGNES.length, `${puces.length} consigne(s) de suivi écrite(s) pour ${CONSIGNES.length} gardée(s)`);
      for (const { quoi, sonde } of CONSIGNES) {
        const trouvees = puces.filter((p) => sonde.test(p));
        assert.equal(trouvees.length, 1, `« ${quoi} » doit figurer une fois exactement (${trouvees.length} trouvée·s)`);
        exigeImperatif(trouvees[0], `la consigne de suivi « ${quoi} »`);
      }

      // Et la relecture après livraison, qui ferme la section : c'est elle qui rattrape ce qu'un
      // agent fermé a laissé de faux, et elle est la seule qui n'a pas de puce pour la porter.
      const relectures = s.corps.split('\n').filter((l) => /^\*\*Relis-toi\.\*\*/.test(l));
      assert.equal(relectures.length, 1, `la relecture après livraison doit être prescrite une fois exactement (${relectures.length})`);
      exigeImperatif(relectures[0], 'la relecture après livraison');
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

  {
    id: 'les-amendements-ne-cachent-pas-une-reecriture',
    quoi: 'les sections que ce lot amende ne perdent rien d’autre que ce qu’il déclare remplacer',
    verifier({ metier }) {
      // Inscrire une section dans SECTIONS_AMENDEES la sort de la comparaison octet pour
      // octet — donc de toute garde. C'est le trou que la passe 2 du lot précédent a trouvé.
      // Ici, chaque paragraphe d'origine doit se retrouver MOT POUR MOT dans le gabarit, sauf
      // ceux que `AMENDEMENTS_DU_LOT` nomme. Ajouter est libre ; retirer se déclare.
      const competence = readFileSync(join(REPO, CHEMIN_COMPETENCE), 'utf8');
      for (const [t, remplaces] of AMENDEMENTS_DU_LOT) {
        const source = sectionDe(competence, titre(t), `« ${t} » (compétence)`).corps;
        const cible = sectionDe(metier, titre(t), `« ${t} » (gabarit)`).corps;
        const paras = parasDe(source);
        assert.ok(paras.length >= 3, `« ${t} » ne porte que ${paras.length} paragraphe(s) : la garde ne mordrait pas`);

        for (const marqueur of remplaces) {
          assert.equal(
            paras.filter((p) => p.includes(marqueur)).length, 1,
            `« ${marqueur} » ne désigne plus un paragraphe unique de « ${t} » : la déclaration `
              + `de ce qui est remplacé a cessé de correspondre au texte, et la garde exempterait au hasard`,
          );
          assert.ok(
            !cible.includes(marqueur),
            `« ${marqueur} » est déclaré remplacé mais figure encore dans le gabarit — l’amendement n’a pas eu lieu`,
          );
        }

        const perdus = paras
          .filter((p) => !remplaces.some((m) => p.includes(m)))
          .filter((p) => !cible.includes(p));
        assert.deepEqual(
          perdus, [],
          `ces paragraphes de « ${t} » ont disparu alors que ce lot ne devait qu’y ajouter : `
            + perdus.map((p) => p.slice(0, 70) + '…').join(' · '),
        );
      }
    },
  },

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
      const perms = JSON.parse(droits).permissions;
      const deny = perms.deny || [];
      const allow = perms.allow || [];

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
      const refuse = colonne(table, /^Ce qui t'est refusé$/i, 'ce qui t’est refusé').join(' ');
      assert.equal(table.lignes.length, REFUS.length, `${table.lignes.length} refus décrit(s) pour ${REFUS.length} posé(s) dans le fichier`);
      assert.match(refuse, /écrire ou modifier un fichier/i, 'le métier doit nommer le refus d’écrire');
      assert.match(refuse, /ouvrir un sous-agent/i, 'le métier doit nommer le refus d’ouvrir un sous-agent');

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
      const livraisons = blocsBash(s.corps).filter((b) => b.includes('livrer.js'));
      assert.equal(livraisons.length, 1, `le brief se livre par une seule commande (${livraisons.length} trouvée·s)`);
      assert.ok(!/<chemin>/.test(livraisons[0]), 'la livraison pointe encore vers un chemin de fichier');
      assert.match(livraisons[0], /epics action get/, 'la livraison doit pointer vers le registre');
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
  // ── le transport fidèle
  {
    id: 'une-section-du-metier-disparait',
    quoi: 'la règle de dimensionnement — « aucun agent ne doit jamais avoir besoin de compacter » — est perdue au déplacement',
    cible: 'le-metier-a-voyage-entier',
    fichier: 'metier',
    muter: (t) => t.replace(/^### 3-bis\. Dimensionner[\s\S]*?(?=^### 4\. )/m, ''),
  },
  {
    id: 'une-section-du-metier-est-reecrite',
    quoi: 'le seuil retiré par le dirigeant est réintroduit en « améliorant » une section au passage',
    cible: 'le-metier-a-voyage-entier',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Le niveau se lit dans le rôle, jamais dans un seuil.**',
      '**Le niveau se lit dans un seuil : deux périmètres parallèles, ou cinq agents à coordonner.**',
    ),
  },

  {
    id: 'revue-P1-le-preambule-est-reecrit',
    quoi: 'le « tu ne codes pas » du préambule devient son contraire — hors de toute section, donc hors de la comparaison',
    cible: 'le-metier-a-voyage-entier',
    fichier: 'metier',
    // Trouvée par la PASSE 1 de la revue indépendante : le préambule échappait entièrement à
    // la garde de fidélité, `sections()` ne rendant que ce qui suit un titre.
    muter: (t) => t.replace(
      "**Tu ne codes pas.** Tu cadres, tu découpes",
      "**Tu peux coder ce qui va vite.** Tu cadres, tu découpes",
    ),
  },
  {
    id: 'revue-P1-le-second-principe-fondateur-disparait',
    quoi: 'le principe « l’orchestrateur ne déploie que des chefs d’équipe » est retiré — il ouvrait ce qu’il voulait',
    cible: 'il-orchestre-il-n-execute-pas',
    fichier: 'metier',
    muter: (t) => t.replace(/^> \*\*L'orchestrateur ne déploie que des chefs d'équipe qui gèrent des sous-agents\.\*\*\n/m, ''),
  },

  // ── ajout 3 : la ligne obligatoire (le retrait)
  {
    id: 'la-phrase-retiree-revient',
    quoi: 'la phrase « continue sans elle » est réintroduite — la ligne redevient facultative',
    cible: 'ligne-obligatoire',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Ta ligne est obligatoire, et c'est un préalable au chantier.**",
      "Si la ligne ne peut pas s'ouvrir — jeton absent du poste, par exemple —, dis-le et continue sans elle : ce n'est pas un préalable au chantier.\n\n**Ta ligne est recommandée.**",
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
    // Trouvée par la PASSE 2 : l'ajout 3 affirme l'obligation à deux endroits, et un seul
    // était gardé. Un lecteur applique celui qu'il a lu en dernier.
    muter: (t) => t.replace(
      "**Tu ne commences pas un chantier sans elle**",
      "Tu peux commencer un chantier sans elle si ça presse",
    ),
  },
  {
    id: 'revue-P2-un-anti-pattern-d-origine-disparait',
    quoi: 'une ligne d’origine de la table d’anti-patterns est retirée — la section amendée servait de trou, pas d’amendement',
    cible: 'le-metier-a-voyage-entier',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| Coder « juste ce petit bout » soi-même \|.*\n/m, ''),
  },
  {
    id: 'revue-P2-un-paragraphe-de-1bis-disparait',
    quoi: 'la phrase « un arbitrage n’est acquis qu’une fois réinscrit au ServiceDesk » est perdue dans la section exemptée',
    cible: 'le-metier-a-voyage-entier',
    fichier: 'metier',
    muter: (t) => t.replace(/^Un arbitrage rendu dans la conversation \*\*n'est acquis[\s\S]*?\n\n/m, ''),
  },
  {
    id: 'revue-P2-un-septieme-anti-pattern-se-glisse',
    quoi: 'une idée de plus entre dans la table par la porte de la section exemptée — la liste des ajouts n’est plus fermée',
    cible: 'le-metier-a-voyage-entier',
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
    muter: (t) => permuter(t, 'il naît de ta main, pour ton chantier', 'il existait avant toi, il te survivra'),
  },

  // ── ajout 2 : parler au dirigeant
  {
    id: 'les-chefs-d-equipe-parlent-au-dirigeant',
    quoi: 'l’exclusivité de la parole tombe — deux versions du chantier circulent',
    cible: 'parole-au-dirigeant-exclusive',
    fichier: 'metier',
    muter: (t) => t.replace(
      "Ni tes chefs d'équipe ni leurs sous-agents ne parlent au dirigeant",
      "Tes chefs d'équipe peuvent lui parler directement quand ça va plus vite",
    ),
  },

  // ── ajout 4 : la ronde horaire
  {
    id: 'la-ronde-devient-occasionnelle',
    quoi: 'la cadence horaire devient un « régulièrement » qui ne se vérifie pas',
    cible: 'ronde-horaire',
    fichier: 'metier',
    muter: (t) => t.replace(
      '> **Tu fais le tour de tes agents et du travail qui tourne toutes les heures. Par défaut, pas sur demande.**',
      '> **Tu fais le tour de tes agents et du travail qui tourne régulièrement, au besoin.**',
    ),
  },
  {
    id: 'la-veille-est-donnee-comme-suffisante',
    quoi: 'la veille de déblocage est présentée comme couvrant la ronde — celle-ci devient facultative de fait',
    cible: 'ronde-horaire',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**La veille de déblocage ne remplace pas ta ronde**',
      '**La veille de déblocage fait déjà ta ronde**',
    ),
  },
  {
    id: 'la-ronde-autorise-a-prendre-le-clavier',
    quoi: 'la ronde devient une tournée de dépannage — la dérive que le dirigeant a reprise sur ce chantier même',
    cible: 'ronde-n-execute-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Ce que tu fais de ce que tu trouves ne change pas** : tu ne prends pas le clavier à sa place",
      "**Ce que tu fais de ce que tu trouves t'appartient** : tu prends le clavier à sa place quand c'est plus rapide",
    ),
  },

  // ── ajout 5 : le topo matinal
  {
    id: 'le-topo-perd-son-heure',
    quoi: 'le topo n’a plus de rendez-vous — donc il n’a plus lieu',
    cible: 'topo-matinal',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Chaque matin à 7 h 00, tu poses un topo sur ta ligne.**',
      '**Quand tu en ressens le besoin, tu peux poser un topo sur ta ligne.**',
    ),
  },
  {
    id: 'le-topo-perd-la-rubrique-qui-decide',
    quoi: 'la rubrique « ce qui attend une décision de lui » disparaît — le topo devient un bulletin qu’on lit sans rien faire',
    cible: 'topo-matinal',
    fichier: 'metier',
    muter: (t) => t.replace(/^- \*\*ce qui attend une décision de lui\*\*.*\n/m, ''),
  },
  {
    id: 'une-horloge-est-inventee',
    quoi: 'le métier prescrit un mécanisme de déclenchement que personne n’a tranché',
    cible: 'topo-matinal',
    fichier: 'metier',
    muter: (t) => t.replace(
      "> **Tu seras rappelé, et le rendez-vous reste tien.**",
      "> **Le déclenchement** : pose une entrée `crontab` à 7 h 00 sur ton poste.\n>\n> **Tu seras rappelé.**",
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
    muter: (t) => t.replace(
      /^> \*\*S'il ne fait pas signe.*$/m,
      '> Si le réveil ne fait pas signe, c’est qu’il n’y avait rien à dire.',
    ),
  },

  // ── l'ajout 7 : les mémoires
  {
    id: 'le-standard-est-recopie-au-lieu-d-etre-pointe',
    quoi: 'la section mémoire recopie le standard au lieu de le pointer — une copie qui vieillit et ne fait pas foi',
    cible: 'se-sert-des-memoires',
    fichier: 'metier',
    muter: (t) => t.replace(
      '> Le cadre complet est **STD-039**.',
      '> Les huit invariants, in extenso : I1 nommage par fonction. I2 symétrie des gestes : si une '
        + 'fonction expose une écriture, sa lecture vit au même endroit nommé. I3 un rappel ne fait pas '
        + 'foi. I4 frontière D5. I5 cantonnement group_id. I6 secret hors bande : les credentials '
        + 'restent côté agent. I7 l’encodage travail vers épisodique ne passe pas par le gate. I8 la '
        + 'discipline prime sur le geste.\n>\n> Le cadre complet est **STD-039**.',
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
    muter: (t) => t.replace(
      '**Un rappel ne remplace jamais une mesure.**',
      '**Un rappel vaut généralement une mesure, sauf sur les points sensibles.**',
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
    muter: (t) => t.replace('| `/episodique` |', '| `/graphiti` (Neo4j) |'),
  },
  {
    id: 'un-moment-du-rappel-disparait',
    quoi: 'on cesse de rappeler avant de trancher — retrancher autrement ce qui l’était déjà redevient possible',
    cible: 'se-sert-des-memoires',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| \*\*Avant de trancher\*\* \|.*\n/m, ''),
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
    muter: (t) => t.replace(
      'vivent dans le dossier Architecture partagé',
      'vivent dans `/Users/maximeleboeuf/Library/CloudStorage/GoogleDrive-maxime.leboeuf@somtech.ca/Disques partagés/Architecture/`',
    ),
  },
  {
    id: 'un-emplacement-a-substituer-entre-dans-le-gabarit',
    quoi: 'le gabarit cesse d’être comparable tel quel — la mise à jour des copies ne saurait plus détecter une divergence',
    cible: 'aucune-substitution',
    fichier: 'metier',
    muter: (t) => t.replace('Tu es le **pilote** d\'un chantier.', 'Tu es le **pilote** de {{CHANTIER}}.'),
  },
  {
    id: 'une-commande-de-session-est-inventee',
    quoi: 'la ronde enseigne une commande qui n’existe pas — chaque orchestrateur qui la suit perd du temps sur une erreur qui n’est pas la sienne',
    cible: 'gestes-de-session-existants',
    fichier: 'metier',
    muter: (t) => t.replace('herdr agent list                       #', 'herdr agent survey                     #'),
  },

  // ── inscrire ce qui naît, avant de le faire (T-20260813-0043)
  {
    id: 'le-principe-d-inscription-disparait',
    quoi: 'le principe est retiré — §7 revient à ne parler que du suivi de ce qui existe déjà',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace(/^> \*\*Une tâche non documentée est une tâche non suivie\.\*\*.*\n/m, ''),
  },
  {
    id: 'le-principe-devient-tiens-le-registre-a-jour',
    quoi: 'le principe est remplacé par « tiens le registre à jour » — ce que le texte disait DÉJÀ, et exactement la confusion qu’on corrige',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    // LA MUTATION QUI COMPTE LE PLUS. Elle laisse un principe parfaitement plausible en tête
    // de section, énoncé de la même façon, au même endroit — et l'ajout est vidé. Une garde
    // qui cherche « registre », « ticket » ou « documenter » reste verte devant elle.
    muter: (t) => t.replace(
      /^> \*\*Une tâche non documentée est une tâche non suivie\.\*\*.*$/m,
      '> **Tiens le registre à jour.** Ce qui y est écrit doit refléter la réalité — pour le dirigeant, pour l\'agent qui reprendra, et pour toi dans deux jours.',
    ),
  },
  {
    id: 'le-principe-passe-apres-le-suivi',
    quoi: 'le principe garde ses mots et perd sa place — écrit après le suivi, il en devient la glose',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      '> **Une tâche non documentée est une tâche non suivie.**',
      '**Relis-toi.**',
    ),
  },
  {
    id: 'l-ordre-des-deux-gestes-s-inverse',
    quoi: 'tenir à jour vient avant inscrire — le texte revient à supposer le travail déjà écrit',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace('**Inscrire vient avant tenir à jour**', '**Tenir à jour vient avant inscrire**'),
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
    id: 'la-publication-qui-regroupe-perd-son-ticket',
    quoi: 'les deux cas de la publication sont permutés — celle qui livre un ticket connu est dédoublée, celle qui regroupe plusieurs lots reste sans trace',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      "ne livre qu'un seul ticket connu est un aboutissement et n'a pas de ticket propre",
      'regroupe plusieurs lots, ou qui répare la publication précédente, est un travail pour lui-même et en a un',
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
    muter: (t) => t.replace('au moment où tu prends le chantier**', 'quand ton découpage est prêt**'),
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
    muter: (t) => t.replace(' — une demande est restée `received` deux jours pendant que ses lots étaient en production', ''),
  },
  {
    id: 'l-incident-est-retourne',
    quoi: 'l’incident est retourné — la Demande aurait été en production pendant que ses lots disaient « reçue », ce qui n’accuse plus le geste manquant',
    cible: 'transition-initiale-de-la-demande',
    fichier: 'metier',
    muter: (t) => t.replace(
      'une demande est restée `received` deux jours pendant que ses lots étaient en production',
      'une demande est restée en production deux jours pendant que ses lots étaient `received`',
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
    muter: (t) => t.replace(
      'le critère est le travail qui a un résultat, jamais le geste.**',
      'le critère est le travail qui a un résultat, jamais le geste — sauf décision contraire ponctuelle.**',
    ),
  },
  {
    id: 'le-cas-limite-recoit-une-exception',
    quoi: 'l’endroit où le principe s’arrête devient négociable — « sauf si le dirigeant en demande un »',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    muter: (t) => t.replace(
      "est un aboutissement et n'a pas de ticket propre",
      "est un aboutissement et n'a pas de ticket propre, sauf si le dirigeant en demande un",
    ),
  },

  {
    id: 'la-regle-d-or-13-s-assouplit-dans-le-suivi',
    quoi: 'la consigne voisine du principe — les statuts au moment où l’état change — s’ouvre une porte, et le ServiceDesk se remet à mentir',
    cible: 'le-suivi-oblige-encore',
    fichier: 'metier',
    // Mesurée survivante par la contre-vérification : la modalité était posée sur ce que le lot
    // écrivait, jamais sur la consigne d'à côté, qui dit pourtant la même chose.
    muter: (t) => t.replace(
      "- **statuts au moment où l'état change**, jamais différés (règle d'or n°13)",
      "- **statuts au moment où l'état change**, jamais différés (règle d'or n°13) — sauf si tu manques de temps",
    ),
  },
  {
    id: 'une-consigne-de-suivi-disparait',
    quoi: 'la consigne du compte rendu d’avancement est retirée — le chantier dit ce qu’on allait faire, jamais où on en est',
    cible: 'le-suivi-oblige-encore',
    fichier: 'metier',
    muter: (t) => t.replace(/^- \*\*un compte rendu d'avancement sur le chantier lui-même\*\*.*\n/m, ''),
  },
  {
    id: 'la-relecture-devient-negociable',
    quoi: 'la relecture après livraison cesse d’obliger — ce qu’un agent fermé a laissé de faux y reste',
    cible: 'le-suivi-oblige-encore',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Relis-toi.** Après chaque livraison,',
      '**Relis-toi.** À moins que la livraison ne soit petite, après chaque livraison,',
    ),
  },
  {
    id: 'une-cellule-nie-sa-necessite',
    quoi: 'la cellule du chef d’équipe est vidée par une nécessité niée — ni permission ni exception, la troisième famille',
    cible: 'inscrire-avant-de-tenir-a-jour',
    fichier: 'metier',
    // Posée par la contre-vérification, et survivante : `PERMISSIF` ne connaissait que la
    // permission et l'exception.
    muter: (t) => t.replace(
      "c'est la filiation de §4b-bis, qui est ce principe appliqué |",
      "c'est la filiation de §4b-bis, même si ce n'est pas strictement nécessaire tout de suite |",
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
    muter: (t) => t.replace(
      "| Greffer un défaut trouvé en chemin sur le ticket d'un voisin | Personne ne l'y cherchera :",
      "| Greffer un défaut trouvé en chemin sur le ticket d'un voisin | Ce n'est pas idéal :",
    ),
  },
  {
    id: 'la-mecanique-devient-une-ecriture-de-registre',
    quoi: 'le geste de §2 cesse d’être nommé comme une mécanique — il redevient une consigne de documentation parmi d’autres, donc négligeable',
    cible: 'transition-initiale-de-la-demande',
    fichier: 'metier',
    muter: (t) => t.replace(
      "Ce n'est pas de la tenue de registre, c'est une **mécanique**",
      "C'est de la tenue de registre comme le reste",
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
    muter: (t) => permuter(
      t,
      '« Beau travail, on fusionne », devant un compte rendu plausible que tu n\'as pas vérifié',
      '« Montre-moi le verdict de chaque passe et l\'état de la chaîne » — et tant que ce n\'est pas là, le lot attend',
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
    muter: (t) => t.replace(
      '« Montre-moi le verdict de chaque passe et l\'état de la chaîne » — et tant que ce n\'est pas là, le lot attend',
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
    muter: (t) => t.replace(
      '**Et tu ne t\'évalues pas toi-même.** La règle d\'or n°8 fait relire le code par quelqu\'un qui ne l\'a pas écrit ; **tes conclusions n\'y échappent pas.**',
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

  {
    id: 'un-paragraphe-d-origine-disparait-d-une-section-amendee',
    quoi: 'un paragraphe d’origine est retiré d’une section que ce lot s’autorise à amender — l’exemption servirait de trou, pas d’amendement',
    cible: 'les-amendements-ne-cachent-pas-une-reecriture',
    fichier: 'metier',
    muter: (t) => t.replace(
      /^\*\*Inscris la décision dans le ServiceDesk\*\*[\s\S]*?\n\n/m,
      '',
    ),
  },
];

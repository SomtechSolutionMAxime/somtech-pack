// Les contrôles de la compétence d'orchestration, et les mutations qui les éprouvent.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER N'EST PAS UN TEST
//
// Il est importé par DEUX suites qui ne demandent pas la même chose aux mêmes contrôles :
//
//   • `orchestrer-chantier.test.js` les exécute sur les TEXTES RÉELS — ils doivent passer ;
//   • `orchestrer-chantier-mutations.test.js` les exécute sur des versions MUTÉES — pour
//     chaque mutation, le contrôle qu'elle vise doit rougir.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LA RÈGLE D'ÉCRITURE D'UN CONTRÔLE
//
// Un contrôle ne cherche JAMAIS la présence d'un mot. Il porte sur :
//
//   • la POLARITÉ  — de quel côté d'une table une affirmation vit ;
//   • la POSITION  — à quel rang d'une suite ordonnée un élément se trouve ;
//   • la MODALITÉ  — un énoncé oblige-t-il, ou s'est-il assoupli ?
//   • le COMPTE    — combien d'éléments sont énumérés, pour combien d'attendus ;
//   • la STRUCTURE — chaque niveau doit être NOMMÉ et EXPLIQUÉ, pas seulement mentionné.
//
// Le motif qui a coûté le plus cher sur ce dépôt : « Tu remontes au dirigeant » devenant
// « Tu remontes au dirigeant SI TU AS UN DOUTE » garde le mot-clé et retourne le sens.
// Aucune relecture ne l'a trouvé ; quatre mutations l'ont trouvé quatre fois.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LA FORME D'UN CONTRÔLE
//
// `verifier({ skill, brief })` — les DEUX textes lui sont passés explicitement. Aucun
// contrôle ne relit le disque : sinon une mutation du brief n'atteindrait jamais le
// contrôle qui l'audite, et le harnais compterait comme « attrapée » une mutation qui
// n'a en réalité rien touché.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // cli/test/lib
export const REPO = resolve(HERE, '..', '..', '..');
export const CHEMIN = join('.claude', 'skills', 'orchestrer-chantier', 'SKILL.md');
export const CHEMIN_BRIEF = join('.claude', 'skills', 'orchestrer-chantier', 'BRIEF-REVUE.md');

export const lireSkill = (racine = REPO) => readFileSync(join(racine, CHEMIN), 'utf8');
export const lireBrief = (racine = REPO) => readFileSync(join(racine, CHEMIN_BRIEF), 'utf8');

/** Les deux textes réels, tels qu'un contrôle les reçoit. */
export const textesReels = (racine = REPO) => ({ skill: lireSkill(racine), brief: lireBrief(racine) });

// ═════════════════════════════════════════ lecture de structure

/** Découpe un markdown en sections { niveau, titre, corps }. */
export function sections(texte) {
  const out = [];
  let prec = null;
  for (const m of texte.matchAll(/^(#{2,4})\s+(.+)$/gm)) {
    if (prec) prec.corps = texte.slice(prec._fin, m.index);
    prec = { niveau: m[1].length, titre: m[2].trim(), _fin: m.index + m[0].length };
    out.push(prec);
  }
  if (prec) prec.corps = texte.slice(prec._fin);
  return out;
}

/** La section dont le titre répond à la sonde. Échoue si elle manque, ou si plusieurs répondent. */
export function sectionDe(texte, sonde, quoi) {
  const trouvees = sections(texte).filter((x) => sonde.test(x.titre));
  assert.equal(
    trouvees.length, 1,
    `le texte doit porter une section ${quoi} — une seule (${trouvees.length} trouvée·s)`
  );
  return trouvees[0];
}

/**
 * TOUTES les tables markdown d'un corps, chacune lue AVEC son en-tête.
 *
 * Elles sont séparées : une section qui porte deux tables rendait, dans la version
 * précédente, une seule table monstrueuse dont les colonnes ne voulaient rien dire —
 * et une sonde de colonne y répondait par accident.
 */
export function tablesDe(corps) {
  const tables = [];
  let courante = null;
  for (const ligne of corps.split('\n')) {
    if (ligne.trim().startsWith('|')) {
      const cellules = ligne.split('|').slice(1, -1).map((c) => c.trim());
      if (cellules.every((x) => /^:?-{2,}:?$/.test(x))) continue; // ligne de séparation
      (courante ??= []).push(cellules);
    } else if (courante) {
      tables.push(courante);
      courante = null;
    }
  }
  if (courante) tables.push(courante);

  return tables
    .filter((rangees) => rangees.length >= 2)
    .map((rangees) => ({ entetes: rangees[0], lignes: rangees.slice(1) }));
}

/**
 * L'unique table d'un corps dont l'EN-TÊTE répond à toutes les sondes données.
 * On désigne une table par ce qu'elle promet, jamais par son rang dans la section.
 */
export function tableDe(corps, sondes, quoi) {
  const candidates = tablesDe(corps).filter(
    (t) => sondes.every((s) => t.entetes.some((e) => s.test(e)))
  );
  assert.equal(
    candidates.length, 1,
    `la table « ${quoi} » doit se reconnaître une fois exactement à ses en-têtes (${candidates.length} trouvée·s)`
  );
  return candidates[0];
}

/**
 * L'index de la colonne dont le LIBELLÉ D'EN-TÊTE répond à la sonde.
 * La sonde DOIT couvrir le libellé entier : /^…$/ — sinon un mot-clé suffirait, et
 * renommer une colonne en son contraire passerait inaperçu.
 */
export function colonneDe(table, sonde, quoi) {
  assert.ok(
    sonde.source.startsWith('^') && sonde.source.endsWith('$'),
    `la sonde de la colonne « ${quoi} » n'est pas ancrée (${sonde})`
  );
  const trouves = table.entetes
    .map((libelle, i) => ({ libelle, i }))
    .filter(({ libelle }) => sonde.test(libelle));
  assert.equal(
    trouves.length, 1,
    `la colonne « ${quoi} » doit se reconnaître une fois exactement (${trouves.length} trouvée·s)`
  );
  return trouves[0].i;
}

/** La ligne d'une table dont la cellule de `iCle` répond à la sonde. */
export function ligneDe(table, iCle, sonde, quoi) {
  const trouvees = table.lignes.filter((l) => sonde.test(l[iCle] ?? ''));
  assert.equal(
    trouvees.length, 1,
    `la ligne « ${quoi} » doit se reconnaître une fois exactement (${trouvees.length} trouvée·s)`
  );
  return trouvees[0];
}

/** Les puces de premier niveau d'un corps. */
export const pucesDe = (corps) => corps.split('\n').filter((l) => /^-\s+\S/.test(l));

/** Les items numérotés de premier niveau d'un corps. */
export const itemsNumerotesDe = (corps) => corps.split('\n').filter((l) => /^\d+\.\s+\S/.test(l));

/**
 * Le CHAPEAU d'un item : son premier segment en gras — l'affirmation elle-même,
 * avant les explications qui la suivent.
 *
 * Pourquoi ça compte : une garantie s'énonce dans son chapeau et se justifie dans la
 * suite du paragraphe. Éprouver la modalité sur le paragraphe entier laisse passer le
 * pire cas connu — « ne dit **jamais** son sens » retourné en « indique généralement
 * son sens » reste vert parce qu'un « jamais » subsiste trente mots plus loin, dans une
 * phrase qui parle d'autre chose.
 */
export function chapeauDe(item, quoi) {
  const m = item.match(/\*\*(.+?)\*\*/);
  assert.ok(m, `l'item « ${quoi} » n'énonce plus sa garantie en gras — il n'y a plus de chapeau à éprouver`);
  return m[1];
}

/**
 * Exige qu'un énoncé oblige, plutôt qu'il ne recommande.
 *
 * ⚠️ **Cette garde est un filet, jamais la garantie principale.** Elle repose sur une
 * liste de tournures, donc sur une énumération qu'on peut toujours contourner par une
 * formule absente : une revue a fait passer « à la veille, **jamais** à ta main » à
 * « à la veille, **autant que possible** » — sens exactement retourné, liste muette.
 * La liste s'élargit quand un contournement est trouvé, mais la vraie garde d'une
 * prescription est la résolution de son AFFIRMATION (voir `chapeauDe`, et les
 * assertions de négation explicite portées par les contrôles eux-mêmes).
 */
export function exigeImperatif(enonce, quoi) {
  const PERMISSIF = new RegExp([
    /\btu peux\b|\bfacultati|\boptionnel|\bpas obligatoire\b/.source,
    /\bsi (?:tu le souhaites|besoin|ça presse|celui-ci presse|tu as un doute|tu peux|possible|c'est possible)\b/.source,
    /\bau besoin\b|\bde préférence\b|\bsi possible\b|\bidéalement\b|\bsauf si\b|\bsauf exception\b/.source,
    /\bautant que possible\b|\bdans la mesure du possible\b|\bquand c'est possible\b/.source,
    /\ben principe\b|\ben général\b|\bgénéralement\b|\bhabituellement\b|\bnormalement\b/.source,
    /\ble plus souvent\b|\bparfois\b|\bsouvent\b|\bplutôt que de\b/.source,
  ].join('|'), 'i');
  const relache = enonce.match(PERMISSIF);
  assert.ok(!relache, `« ${quoi} » s'est assoupli en recommandation (« ${relache && relache[0]} »)`);
}

// ═════════════════════════════════════════ les contrôles
//
// Chaque contrôle : { id, quoi, verifier({ skill, brief }) } — jette si la garantie tombe.

const SONDE_NIVEAUX = /les trois niveaux/i;
const H_NIVEAU = /^Niveau$/;
const H_QUI = /^Qui$/;
const H_FAIT = /^Ce qu'il fait$/;
const H_JAMAIS = /^Ce qu'il ne fait \*\*jamais\*\*$/;

/** La table des trois niveaux, désignée par ce que son en-tête promet. */
function tableNiveaux(skill) {
  const s = sectionDe(skill, SONDE_NIVEAUX, 'sur les trois niveaux');
  return tableDe(s.corps, [H_NIVEAU, H_FAIT, H_JAMAIS], 'des trois niveaux');
}

export const CONTROLES = [
  {
    id: 'trois-niveaux-prescrits',
    quoi: 'les trois niveaux sont nommés, et chacun porte ce qu\'il fait ET ce qu\'il ne fait jamais',
    verifier({ skill }) {
      const table = tableNiveaux(skill);
      const iNiveau = colonneDe(table, H_NIVEAU, 'le niveau');
      colonneDe(table, H_QUI, 'qui');
      const iFait = colonneDe(table, H_FAIT, "ce qu'il fait");
      const iJamais = colonneDe(table, H_JAMAIS, "ce qu'il ne fait jamais");

      assert.equal(table.lignes.length, 3, `la table doit porter exactement 3 niveaux (${table.lignes.length})`);

      for (const sonde of [/orchestrat/i, /chef.*équipe/i, /sous-agent/i]) {
        ligneDe(table, iNiveau, sonde, `du niveau ${sonde}`);
      }
      for (const l of table.lignes) {
        assert.ok(l[iFait]?.length > 10, `le niveau « ${l[iNiveau]} » n'explique pas ce qu'il fait`);
        assert.ok(l[iJamais]?.length > 10, `le niveau « ${l[iNiveau]} » n'énonce aucun interdit`);
        exigeImperatif(l[iJamais], `l'interdit du niveau « ${l[iNiveau]} »`);
      }
    },
  },

  {
    id: 'orchestrateur-jamais-code',
    quoi: 'coder est du côté des interdits de l\'orchestrateur, jamais du côté de ce qu\'il fait',
    verifier({ skill }) {
      const table = tableNiveaux(skill);
      const iNiveau = colonneDe(table, H_NIVEAU, 'le niveau');
      const l = ligneDe(table, iNiveau, /orchestrat/i, 'de l\'orchestrateur');
      const fait = l[colonneDe(table, H_FAIT, "ce qu'il fait")];
      const jamais = l[colonneDe(table, H_JAMAIS, "ce qu'il ne fait jamais")];

      // La sonde porte sur la NÉGATION entière, pas sur le mot « code » : celui-ci
      // survit dans « ne relit pas le code », et une garde qui s'en contente reste verte
      // alors même que l'interdit de coder a été retiré.
      assert.match(jamais, /\bne code pas\b/i, 'l\'orchestrateur ne code pas — l\'interdit entier doit vivre du côté des interdits');
      assert.ok(!/(?<!ne )\bcode\b/i.test(fait), `« code » est passé du côté de ce que l'orchestrateur fait (« ${fait} »)`);
    },
  },

  {
    id: 'orchestrateur-jamais-relit',
    quoi: 'relire le code est du côté des interdits de l\'orchestrateur',
    verifier({ skill }) {
      const table = tableNiveaux(skill);
      const iNiveau = colonneDe(table, H_NIVEAU, 'le niveau');
      const l = ligneDe(table, iNiveau, /orchestrat/i, 'de l\'orchestrateur');
      const fait = l[colonneDe(table, H_FAIT, "ce qu'il fait")];
      const jamais = l[colonneDe(table, H_JAMAIS, "ce qu'il ne fait jamais")];

      assert.match(jamais, /\bne relit pas le code\b/i, 'l\'orchestrateur ne relit pas le code — l\'interdit entier doit vivre du côté des interdits');
      assert.ok(!/relit|relire/i.test(fait), `« relit » est passé du côté de ce que l'orchestrateur fait (« ${fait} »)`);
    },
  },

  {
    id: 'orchestrateur-nouvre-que-des-chefs-equipe',
    quoi: 'l\'orchestrateur ne déploie que des chefs d\'équipe — énoncé en principe ET tenu dans la table',
    verifier({ skill }) {
      // 1. Le principe est posé en tête, sans échappatoire.
      const principe = skill.match(/^>\s+\*\*L'orchestrateur ne déploie que des chefs d'équipe.*$/m);
      assert.ok(principe, 'le principe « l\'orchestrateur ne déploie que des chefs d\'équipe » doit être posé en principe gouvernant');
      exigeImperatif(principe[0], 'le principe de déploiement');
      // ⚠️ RÉ-ANCRÉ (D-20260826-0010, ABC 3.0.0) : le principe porte désormais son périmètre —
      // le chef d'équipe est pour le travail qui produit un LIVRABLE, et les sous-agents
      // d'analyse sont les propres moyens de l'orchestrateur (R2.6, R3.1). Le périmètre est
      // gardé AVEC sa borne : « propres moyens » sans « ne portent jamais un lot » se relit
      // comme « fais mener tes lots par tes sous-agents ».
      assert.match(
        principe[0], /pour le travail qui produit un livrable/i,
        'le principe de déploiement doit porter son périmètre (ABC 3.0.0) — sans lui, il redevient l\'ancien interdit total',
      );
      assert.match(
        principe[0], /ils ne portent jamais un lot/i,
        'et la borne des sous-agents d\'analyse — sans elle, « propres moyens » rouvre le niveau',
      );

      // 2. La table le tient : ouvrir autre chose est du côté des interdits.
      const table = tableNiveaux(skill);
      const iNiveau = colonneDe(table, H_NIVEAU, 'le niveau');
      const l = ligneDe(table, iNiveau, /orchestrat/i, 'de l\'orchestrateur');
      const jamais = l[colonneDe(table, H_JAMAIS, "ce qu'il ne fait jamais")];
      // ⚠️ RÉ-ANCRÉ (D-20260826-0010) : la restriction porte sur les PANES — tout agent ouvert
      // en pane est un chef d'équipe (R3.1) ; « aucun agent » est devenu faux par ordre.
      assert.match(
        jamais, /n'ouvre en pane que des chefs d'équipe/i,
        'l\'interdit d\'ouvrir en pane autre chose qu\'un chef d\'équipe doit vivre dans la colonne des interdits'
      );
    },
  },

  {
    id: 'aucun-seuil-nouvre-le-niveau',
    quoi: 'le niveau chef d\'équipe ne se justifie par AUCUN seuil — le rôle le définit',
    verifier({ skill }) {
      const s = sectionDe(skill, SONDE_NIVEAUX, 'sur les trois niveaux');
      const table = tableNiveaux(skill);

      // Aucune colonne ne conditionne l'existence du niveau.
      const conditionnelle = table.entetes.filter((e) => /justifi|quand|seuil|condition/i.test(e));
      assert.equal(
        conditionnelle.length, 0,
        `la table des niveaux ne doit porter aucune colonne de justification conditionnelle (« ${conditionnelle.join(', ')} »)`
      );

      // Le « Qui » du chef d'équipe quantifie universellement, il ne conditionne pas.
      const l = ligneDe(table, colonneDe(table, H_NIVEAU, 'le niveau'), /chef.*équipe/i, 'du chef d\'équipe');
      const qui = l[colonneDe(table, H_QUI, 'qui')];
      assert.match(
        qui, /\b(tout|tous|chaque)\b/i,
        `le chef d'équipe doit être quantifié universellement, pas décrit comme un cas particulier (« ${qui} »)`
      );
      assert.ok(
        !/optionnel|facultat|si\b|au-delà|à partir de/i.test(qui),
        `l'existence du niveau chef d'équipe est redevenue conditionnelle (« ${qui} »)`
      );

      // Aucun seuil chiffré ne gouverne le niveau dans la section.
      const seuil = s.corps.match(/\d+\s*\+|\b(?:à partir de|au-delà de|dès)\s+\d/i);
      assert.ok(!seuil, `un seuil chiffré est réapparu dans la section des niveaux (« ${seuil && seuil[0]} »)`);

      // La règle ET son motif — deux affirmations distinctes, deux assertions distinctes.
      // Un « ou » entre les deux laisserait chaque moitié disparaître en silence : c'est
      // le motif « une porte sur deux », et c'est une revue qui l'a trouvé ici.
      assert.match(
        s.corps, /jamais dans un seuil/i,
        'le texte doit dire que le niveau se lit dans le rôle, JAMAIS dans un seuil'
      );
      assert.match(
        s.corps, /n'avait été mesuré par rien/i,
        'le texte doit dire POURQUOI le seuil est tombé : il n\'avait été mesuré par rien'
      );
    },
  },

  {
    id: 'chef-equipe-jamais-agent-herdr',
    quoi: 'le chef d\'équipe n\'ouvre aucun agent herdr — c\'est le niveau au-dessus',
    verifier({ skill }) {
      const table = tableNiveaux(skill);
      const iNiveau = colonneDe(table, H_NIVEAU, 'le niveau');
      const l = ligneDe(table, iNiveau, /chef.*équipe/i, 'du chef d\'équipe');
      const fait = l[colonneDe(table, H_FAIT, "ce qu'il fait")];
      const jamais = l[colonneDe(table, H_JAMAIS, "ce qu'il ne fait jamais")];

      assert.match(jamais, /agent herdr/i, 'l\'interdit d\'ouvrir un agent herdr doit vivre du côté des interdits du chef d\'équipe');
      assert.ok(!/\bagent herdr\b/i.test(fait), `ouvrir un agent herdr est passé du côté de ce que le chef d'équipe fait (« ${fait} »)`);
      assert.match(fait, /sous-agent/i, 'ce que le chef d\'équipe fait doit nommer ses sous-agents');
    },
  },

  {
    id: 'sous-agents-jamais-fusionnent',
    quoi: 'les sous-agents ne fusionnent rien et ne parlent pas à l\'orchestrateur',
    verifier({ skill }) {
      const table = tableNiveaux(skill);
      const iNiveau = colonneDe(table, H_NIVEAU, 'le niveau');
      const l = ligneDe(table, iNiveau, /sous-agent/i, 'des sous-agents');
      const fait = l[colonneDe(table, H_FAIT, "ce qu'il fait")];
      const jamais = l[colonneDe(table, H_JAMAIS, "ce qu'il ne fait jamais")];

      assert.match(jamais, /fusionn/i, 'l\'interdit de fusionner doit vivre du côté des interdits des sous-agents');
      assert.match(jamais, /orchestrateur/i, 'les sous-agents ne parlent pas à l\'orchestrateur — interdit à garder');
      assert.ok(!/fusionn/i.test(fait), `fusionner est passé du côté de ce que les sous-agents font (« ${fait} »)`);
    },
  },

  {
    id: 'chef-equipe-trois-regles',
    quoi: 'les trois règles du chef d\'équipe sont énumérées, comptées, et impératives',
    verifier({ skill }) {
      const s = sectionDe(skill, SONDE_NIVEAUX, 'sur les trois niveaux');
      const annonce = s.corps.match(/\*\*(Trois|Deux|Quatre|Cinq) règles non négociables pour le chef d'équipe\*\*/);
      assert.ok(annonce, 'les règles non négociables du chef d\'équipe doivent être annoncées');
      assert.equal(annonce[1], 'Trois', `l'annonce du nombre de règles a changé (« ${annonce[1]} »)`);

      const items = itemsNumerotesDe(s.corps.slice(annonce.index));
      assert.equal(items.length, 3, `trois règles annoncées, ${items.length} énumérées`);

      const attendues = [
        [/ligne de rapport unique/i, 'la ligne de rapport unique'],
        [/agrégation, pas relais/i, 'l\'agrégation plutôt que le relais'],
        [/arbitrage immédiat/i, 'l\'arbitrage immédiat'],
      ];
      for (const [sonde, quoi] of attendues) {
        const item = items.find((i) => sonde.test(i));
        assert.ok(item, `la règle « ${quoi} » a disparu de l'énumération`);
        exigeImperatif(item, `la règle « ${quoi} »`);
      }

      const arbitrage = items.find((i) => /arbitrage immédiat/i.test(i));
      assert.match(
        arbitrage, /jamais gardé pour la fin|tout de suite/i,
        'la règle d\'arbitrage doit interdire de garder ce qui bloque pour la fin'
      );
    },
  },

  {
    id: 'critere-de-non-ouverture',
    quoi: 'le critère de taille dit COMBIEN d\'agents ouvrir — et surtout quand n\'en ouvrir AUCUN',
    verifier({ skill }) {
      const s = sectionDe(skill, /combien d'agents ouvrir/i, 'sur le nombre d\'agents à ouvrir');

      // 1. La section commence par désamorcer la confusion que le seuil retiré causait.
      assert.match(
        s.corps, /ne décide pas \*\*si\*\*/i,
        'la section doit dire que le critère de taille ne décide PAS si le niveau existe'
      );
      assert.match(
        s.corps, /décide \*\*combien\*\*/i,
        'la section doit dire ce que le critère décide : combien de chefs d\'équipe ouvrir'
      );

      // 2. Les trois cas sont énumérés, et le premier est celui qui dit de NE PAS ouvrir.
      const puces = pucesDe(s.corps);
      assert.equal(puces.length, 3, `trois cas de dimensionnement attendus (${puces.length})`);

      const petite = puces.find((p) => /30 min|5 fichiers/i.test(p));
      assert.ok(
        petite,
        'le cas de la petite tâche doit rester chiffré — c\'est la forme LÉGITIME du chiffre, celle qui dit de ne pas ouvrir un agent de plus'
      );
      assert.match(
        petite, /n'ouvre pas un agent|ne pas ouvrir/i,
        `le cas de la petite tâche doit conclure qu'on N'OUVRE PAS d'agent (« ${petite} »)`
      );
      assert.ok(
        !/→\s*(?:un|ouvre)\b/i.test(petite.split('→')[1] ?? ''),
        `le cas de la petite tâche prescrit désormais d'ouvrir un agent (« ${petite} »)`
      );

      // 3. Le coût qui fonde le critère est chiffré, sinon il n'est plus opposable.
      assert.match(s.corps, /15-20 min/i, 'le coût de démarrage d\'un agent herdr doit rester chiffré');

      // 4. Et le contre-exemple qui coûte le plus : paralléliser sur des fichiers partagés.
      assert.match(
        s.corps, /partagent des fichiers/i,
        'la section doit garder le contre-exemple des périmètres qui partagent des fichiers'
      );
      assert.match(
        s.corps, /réellement indépendants/i,
        'le nombre d\'agents suit les périmètres RÉELLEMENT indépendants, jamais le nombre d\'epics'
      );
    },
  },

  {
    id: 'anti-patterns-portent-les-decisions',
    quoi: 'la table des anti-patterns porte une ligne pour chacune des quatre décisions',
    verifier({ skill }) {
      // Les anti-patterns sont des prescriptions comme les autres — les laisser sans
      // garde, c'est laisser retirer en silence la moitié opérationnelle du texte.
      const s = sectionDe(skill, /^Anti-patterns$/i, 'des anti-patterns');
      const table = tableDe(
        s.corps,
        [/^Ce qu'on est tenté de faire$/, /^Pourquoi ça casse$/],
        'des anti-patterns'
      );
      const iTente = colonneDe(table, /^Ce qu'on est tenté de faire$/, 'ce qu\'on est tenté de faire');
      const iCasse = colonneDe(table, /^Pourquoi ça casse$/, 'pourquoi ça casse');

      const DECISIONS = [
        [/seuil qui justifierait/i, 'le seuil qui rouvrirait le niveau'],
        [/sans déclarer son modèle/i, 'le modèle non déclaré au lancement'],
        [/d'après le sujet du chantier/i, 'le nom tiré du sujet du chantier'],
        [/à la place d'un agent/i, 'les gestes faits à la place d\'un agent'],
      ];
      for (const [sonde, quoi] of DECISIONS) {
        const l = ligneDe(table, iTente, sonde, `de l'anti-pattern « ${quoi} »`);
        assert.ok(
          l[iCasse]?.length > 20,
          `l'anti-pattern « ${quoi} » n'explique pas pourquoi ça casse (« ${l[iCasse]} »)`
        );
        exigeImperatif(l[iCasse], `l'anti-pattern « ${quoi} »`);
      }

      // Le seuil : sa ligne doit NIER qu'il en existe un, pas seulement le mentionner.
      const seuil = ligneDe(table, iTente, /seuil qui justifierait/i, 'du seuil')[iCasse];
      assert.match(
        seuil, /il n'y en a pas/i,
        `l'anti-pattern du seuil doit nier qu'il en existe un (« ${seuil} »)`
      );
    },
  },

  {
    id: 'modele-declare-au-lancement',
    quoi: 'le modèle se déclare TOUJOURS au lancement, et il ne s\'hérite pas',
    verifier({ skill }) {
      const s = sectionDe(skill, /déclarer le modèle/i, 'sur la déclaration du modèle');

      const principe = s.corps.match(/^>\s+\*\*.*modèle.*$/mi);
      assert.ok(principe, 'la déclaration du modèle doit être posée en principe');
      assert.match(principe[0], /toujours/i, 'la déclaration doit être annoncée comme toujours requise');
      exigeImperatif(principe[0], 'le principe de déclaration du modèle');
      assert.match(s.titre, /toujours/i, 'le titre doit porter le caractère systématique de la déclaration');

      // Le fait qui rend la règle nécessaire : un lancement nu n'hérite PAS.
      assert.match(
        s.corps, /n'hérite \*\*pas\*\*/i,
        'le texte doit dire qu\'un agent lancé nu n\'hérite PAS du modèle de la session appelante'
      );
      assert.match(s.corps, /démarre en Haiku/i, 'le texte doit dire en quoi démarre un lancement nu');
    },
  },

  {
    id: 'modele-par-nature-d-agent',
    quoi: 'agent herdr = Opus jamais Haiku ; sous-agent = Haiku possible — la polarité est gardée',
    verifier({ skill }) {
      const s = sectionDe(skill, /déclarer le modèle/i, 'sur la déclaration du modèle');
      const table = tableDe(s.corps, [/^Modèle$/, /^Pourquoi$/], 'des modèles par nature d\'agent');
      const iQuoi = colonneDe(table, /^Ce que tu fais naître$/, 'ce que tu fais naître');
      const iModele = colonneDe(table, /^Modèle$/, 'le modèle');

      assert.equal(table.lignes.length, 2, `la table doit distinguer exactement 2 natures d'agent (${table.lignes.length})`);

      const herdr = ligneDe(table, iQuoi, /agent herdr/i, 'de l\'agent herdr')[iModele];
      assert.match(herdr, /Opus/i, 'un agent herdr naît en Opus');
      assert.match(herdr, /jamais Haiku/i, 'Haiku doit être explicitement interdit pour un agent herdr');
      exigeImperatif(herdr, 'le modèle d\'un agent herdr');

      const sous = ligneDe(table, iQuoi, /sous-agent/i, 'du sous-agent')[iModele];
      assert.match(sous, /Haiku/i, 'Haiku doit rester possible pour un sous-agent');
      assert.ok(
        !/jamais/i.test(sous),
        `Haiku est devenu interdit pour les sous-agents, alors qu'il y est utile (« ${sous} »)`
      );
      assert.match(
        s.corps, /passe 1/i,
        'le texte doit dire où Haiku sert en sous-agent : la passe 1 de revue'
      );
    },
  },

  {
    id: 'nom-vient-du-mandat',
    quoi: 'le nom d\'un agent vient de son mandat au registre, jamais du sujet du chantier',
    verifier({ skill }) {
      const s = sectionDe(skill, /registre .* mandat .* agent/i, 'sur la chaîne registre → mandat → agent');

      const principe = s.corps.match(/^>\s+\*\*.*mandat.*$/mi);
      assert.ok(principe, 'la chaîne registre → mandat → agent doit être posée en principe');
      exigeImperatif(principe[0], 'le principe de nommage');

      assert.match(
        s.corps, /jamais du sujet du chantier/i,
        'le texte doit interdire de nommer un agent d\'après le sujet du chantier'
      );
      assert.match(
        s.corps, /indistinguable de son orchestrateur/i,
        'le texte doit dire POURQUOI : l\'agent devient indistinguable de son orchestrateur'
      );

      // Polarité des exemples : les codes du registre en ✅, les noms inventés en ❌.
      const bons = pucesDe(s.corps).filter((p) => p.includes('✅'));
      const mauvais = pucesDe(s.corps).filter((p) => p.includes('❌'));
      assert.ok(bons.length >= 2, `au moins deux exemples de noms conformes attendus (${bons.length})`);
      assert.ok(mauvais.length >= 1, `au moins un exemple de nom fautif attendu (${mauvais.length})`);

      for (const p of bons) {
        assert.match(p, /`[a-z]-\d{8}-\d{4}`/, `un exemple donné pour conforme ne porte pas un code du registre : ${p}`);
      }
      for (const p of mauvais) {
        assert.ok(
          !/`[a-z]-\d{8}-\d{4}`/.test(p),
          `un code du registre est donné en exemple de nom fautif : ${p}`
        );
      }
    },
  },

  {
    id: 'libelle-onglet-code-puis-mots',
    quoi: 'le libellé de l\'onglet porte le code, puis 2 à 4 mots sur ce que l\'agent fabrique',
    verifier({ skill }) {
      const s = sectionDe(skill, /registre .* mandat .* agent/i, 'sur la chaîne registre → mandat → agent');

      assert.match(s.corps, /libellé de l'onglet/i, 'le libellé de l\'onglet doit être traité');
      assert.match(
        s.corps, /\bdeux à quatre mots\b|\b2 à 4 mots\b/i,
        'le libellé doit prescrire un nombre de mots — deux à quatre'
      );
      assert.match(
        s.corps, /fabrique/i,
        'le libellé doit dire ce que l\'agent FABRIQUE, pas son domaine ni son rôle'
      );

      // Les exemples de libellé sont dans un bloc de code : chacun = un code + 2 à 4 mots.
      const bloc = s.corps.match(/```\n([\s\S]*?)```/);
      assert.ok(bloc, 'des exemples de libellé doivent être donnés');
      const exemples = bloc[1].split('\n').map((l) => l.trim()).filter(Boolean);
      assert.ok(exemples.length >= 2, `au moins deux exemples de libellé attendus (${exemples.length})`);
      for (const ex of exemples) {
        const mots = ex.split(/\s+/);
        assert.match(mots[0], /^[a-z]-\d{8}-\d{4}$/, `le libellé « ${ex} » ne commence pas par un code du registre`);
        const reste = mots.length - 1;
        assert.ok(
          reste >= 2 && reste <= 4,
          `le libellé « ${ex} » porte ${reste} mot(s) après le code, or la règle en demande 2 à 4`
        );
      }
    },
  },

  {
    id: 'quatre-gestes-hors-orchestrateur',
    quoi: 'renommer, débloquer, corriger, relancer — les QUATRE gestes appartiennent au chef d\'équipe',
    verifier({ skill }) {
      const s = sectionDe(skill, /tes mains/i, 'sur ce que l\'orchestrateur ne fait pas de ses mains');

      const principe = s.corps.match(/^>\s+\*\*.*a déjà perdu le fil.*$/mi);
      assert.ok(principe, 'le principe « a déjà perdu le fil » doit être posé');
      exigeImperatif(principe[0], 'le principe des gestes hors orchestrateur');

      const GESTES = [
        [/renomm/i, 'renommer'],
        [/débloqu/i, 'débloquer une permission'],
        [/corrig/i, 'corriger un script'],
        [/relanc/i, 'relancer un processus'],
      ];
      for (const [sonde, quoi] of GESTES) {
        assert.match(principe[0], sonde, `le geste « ${quoi} » a disparu de l'énoncé du principe`);
      }

      const table = tableDe(s.corps, [/^Le geste$/, /^À qui il appartient$/], 'des gestes hors orchestrateur');
      const iGeste = colonneDe(table, /^Le geste$/, 'le geste');
      const iQui = colonneDe(table, /^À qui il appartient$/, 'à qui il appartient');

      assert.equal(table.lignes.length, 4, `les quatre gestes doivent tous être rendus (${table.lignes.length} ligne·s)`);
      for (const [sonde, quoi] of GESTES) {
        const l = ligneDe(table, iGeste, sonde, `du geste « ${quoi} »`);
        assert.ok(
          !/\b(toi|orchestrateur)\b/i.test(l[iQui]),
          `le geste « ${quoi} » est rendu à l'orchestrateur lui-même (« ${l[iQui]} »)`
        );
        // Une attribution s'écrit « à … » — un énoncé qui cesse d'attribuer a cessé
        // de rendre le geste, même s'il ne nomme pas l'orchestrateur pour autant.
        assert.match(l[iQui], /^à\s+\S/i, `le geste « ${quoi} » n'attribue plus à personne (« ${l[iQui]} »)`);
        exigeImperatif(l[iQui], `l'attribution du geste « ${quoi} »`);
      }

      // Le déblocage est le seul des quatre dont l'attribution porte une NÉGATION : elle
      // dit à qui il revient ET qu'il ne revient pas à ta main. C'est cette négation qui
      // se fait retourner — « jamais à ta main » devenu « autant que possible » a passé
      // la garde de modalité, qui ne connaissait pas la formule. On résout donc
      // l'affirmation elle-même, pas le vocabulaire qui l'entoure.
      const deblocage = ligneDe(table, iGeste, /débloqu/i, 'du geste « débloquer »')[iQui];
      assert.match(
        deblocage, /jamais à ta main/i,
        `le déblocage doit rester interdit à la main de l'orchestrateur, sans réserve (« ${deblocage} »)`
      );
    },
  },

  {
    id: 'veille-trois-garanties',
    quoi: 'la veille de déblocage porte ses TROIS garanties, dont le refus devant l\'inconnu',
    verifier({ skill }) {
      const s = sectionDe(skill, /veille de déblocage/i, 'sur la veille de déblocage');

      const annonce = s.corps.match(/\*\*(Trois|Deux|Quatre) garanties\*\*|(Trois|Deux|Quatre) garanties la rendent utilisable/i);
      assert.ok(annonce, 'le nombre de garanties de la veille doit être annoncé');
      assert.match(annonce[0], /Trois/i, `l'annonce du nombre de garanties a changé (« ${annonce[0]} »)`);

      const items = itemsNumerotesDe(s.corps);
      assert.equal(items.length, 3, `trois garanties annoncées, ${items.length} énumérées`);

      // Chaque garantie est éprouvée sur son CHAPEAU — l'affirmation elle-même — et non
      // sur le paragraphe, où un mot-clé égaré suffirait à sauver un sens retourné.

      const deuxSignes = items.find((i) => /signes? concordants?/i.test(i));
      assert.ok(deuxSignes, 'la garantie des signes concordants a disparu');
      assert.match(
        chapeauDe(deuxSignes, 'des signes concordants'), /ne répond que/i,
        'la veille ne doit répondre QUE devant une vraie demande — la restriction est la garantie'
      );
      assert.match(deuxSignes, /\bdeux signes concordants\b/i, 'il faut DEUX signes concordants, pas un');
      assert.match(deuxSignes, /jamais un seul/i, 'un seul signe ne doit jamais suffire');
      exigeImperatif(deuxSignes, 'la garantie des deux signes concordants');

      const inconnu = items.find((i) => /ne reconnaît pas/i.test(i));
      assert.ok(inconnu, 'la garantie du refus devant un écran non reconnu a disparu');
      assert.match(
        chapeauDe(inconnu, 'du refus devant l\'inconnu'), /elle ne répond pas/i,
        'devant un écran non reconnu, la veille ne doit PAS répondre — c\'est le chapeau qui le dit'
      );
      assert.match(inconnu, /s'arrête/i, 'devant l\'inconnu, la veille doit s\'arrêter et le dire');
      exigeImperatif(inconnu, 'la garantie du refus devant l\'inconnu');

      const position = items.find((i) => /position/i.test(i));
      assert.ok(position, 'la garantie « la position ne dit pas le sens » a disparu');
      assert.match(
        chapeauDe(position, 'sur la position des options'), /ne dit jamais son sens/i,
        'la position d\'une option ne dit JAMAIS son sens — c\'est le chapeau qui doit le nier'
      );
      assert.match(
        position, /\*\*lu\*\*|après avoir lu/i,
        'on ne descend sur une option qu\'après avoir LU qu\'elle autorise durablement'
      );
      exigeImperatif(position, 'la garantie sur la position des options');
    },
  },

  {
    id: 'revue-deux-passes-polarite-des-verdicts',
    quoi: 'passe 1 Haiku ne conclut JAMAIS mergeable ; passe 2 Sonnet le peut — dans le SKILL et dans le brief',
    verifier({ skill, brief }) {
      for (const [texte, ou] of [[skill, 'le SKILL'], [brief, 'le brief de revue']]) {
        const tables = tablesDe(texte).filter(
          (t) => t.entetes.some((e) => /^Passe$/.test(e)) && t.entetes.some((e) => /verdict/i.test(e))
        );
        assert.equal(tables.length, 1, `${ou} doit porter une table des passes de revue (${tables.length} trouvée·s)`);
        const table = tables[0];
        const iPasse = colonneDe(table, /^Passe$/, 'la passe');
        const iAdmis = colonneDe(table, /^Verdicts? (?:admis|autorisés?)$/, 'les verdicts admis');
        const iInterdit = colonneDe(table, /^Verdicts? interdits?$/, 'les verdicts interdits');

        assert.equal(table.lignes.length, 2, `${ou} doit décrire exactement 2 passes (${table.lignes.length})`);

        // Le modèle vit dans une colonne dédiée ici, dans le libellé de la passe là :
        // on le cherche donc sur la LIGNE, qui est l'unité stable des deux tables.
        const p1 = ligneDe(table, iPasse, /\b1\b/, 'de la passe 1');
        assert.match(p1.join(' | '), /Haiku/i, `${ou} : la passe 1 doit être portée par Haiku`);
        assert.match(p1[iInterdit], /mergeable/i, `${ou} : « mergeable » doit être interdit à la passe 1`);
        assert.ok(
          !/mergeable/i.test(p1[iAdmis]),
          `${ou} : « mergeable » est passé du côté des verdicts admis de la passe 1 (« ${p1[iAdmis]} »)`
        );
        exigeImperatif(p1[iInterdit], `${ou} : l'interdit de la passe 1`);

        const p2 = ligneDe(table, iPasse, /\b2\b/, 'de la passe 2');
        assert.match(p2.join(' | '), /Sonnet/i, `${ou} : la passe 2 doit être portée par Sonnet`);
        assert.match(p2[iAdmis], /mergeable/i, `${ou} : la passe 2 doit pouvoir conclure « mergeable »`);
      }

      assert.match(
        skill, /Deux revues superficielles valent \*\*moins qu'une\*\*/,
        'le SKILL doit dire que « RIEN VU » de la passe 1 ne baisse jamais la garde de la passe 2'
      );
    },
  },

  {
    id: 'brief-porte-ses-motifs',
    quoi: 'le brief de revue existe, est référencé par le SKILL, et porte ses TROIS motifs de défaut',
    verifier({ skill, brief }) {
      assert.match(skill, /brief de revue/i, 'le SKILL doit renvoyer au brief de revue');
      assert.match(brief, /EF-AGT-001/, 'le brief doit citer l\'exigence fonctionnelle qu\'il sert');

      const motifs = sections(brief).filter((s) => /^Motif \d/.test(s.titre));
      assert.equal(motifs.length, 3, `le brief doit porter exactement 3 motifs de défaut (${motifs.length})`);
      for (const m of motifs) {
        assert.match(m.corps, /Ce qu'il a coûté/i, `le motif « ${m.titre} » ne dit pas ce qu'il a coûté`);
        assert.match(m.corps, /Garde efficace/i, `le motif « ${m.titre} » ne dit pas quelle garde l'attrape`);
      }
    },
  },

  {
    id: 'brief-exige-des-mutations-du-cru',
    quoi: 'le brief exige TROIS mutations du cru de chaque reviewer, et le signalement des faux témoins',
    verifier({ brief }) {
      const s = sectionDe(brief, /mutations du cru/i, 'sur les mutations du cru');
      exigeImperatif(s.titre, 'l\'exigence de mutations du cru');

      const annonce = s.corps.match(/pose \*\*(trois|deux|quatre|cinq) mutations\*\*/i);
      assert.ok(annonce, 'le brief doit prescrire un nombre de mutations');
      assert.match(annonce[1], /trois/i, `le nombre de mutations exigées a changé (« ${annonce[1]} »)`);

      const items = itemsNumerotesDe(s.corps);
      assert.equal(items.length, 3, `trois mutations exigées, ${items.length} décrites`);
      for (const i of items) {
        assert.match(i, /doit rougir/i, `une mutation exigée ne dit pas qu'elle doit rougir : ${i}`);
      }
      assert.match(
        s.corps, /faux témoin/i,
        'le brief doit nommer ce qu\'est une mutation restée verte : un faux témoin'
      );
    },
  },

  {
    id: 'brief-cherche-le-seuil-reintroduit',
    quoi: 'le brief fait chercher au reviewer le seuil qui rouvrirait conditionnellement le niveau',
    verifier({ brief }) {
      const s = sectionDe(brief, /les trois niveaux/i, 'du brief sur les trois niveaux');
      assert.match(
        s.corps, /ne se justifie par aucun chiffre/i,
        'le brief doit dire que le niveau chef d\'équipe ne se justifie par aucun chiffre'
      );
      assert.match(
        s.corps, /combien.*jamais.*si le niveau existe/is,
        'le brief doit distinguer le chiffre qui dit COMBIEN d\'agents de celui qui dirait SI le niveau existe'
      );
    },
  },

  {
    id: 'brief-verifie-les-trois-autres-prescriptions',
    quoi: 'le brief fait vérifier le modèle déclaré, la chaîne du nom, et les quatre gestes',
    verifier({ brief }) {
      const s = sectionDe(brief, /trois autres prescriptions/i, 'du brief sur les autres prescriptions');
      const table = tableDe(s.corps, [/^Prescription$/, /^Défaut à chercher$/], 'des prescriptions à vérifier');
      const iPresc = colonneDe(table, /^Prescription$/, 'la prescription');
      const iDoit = colonneDe(table, /^Ce que le texte doit dire$/, 'ce que le texte doit dire');

      assert.equal(table.lignes.length, 3, `trois prescriptions annoncées, ${table.lignes.length} listée·s`);
      for (const sonde of [/modèle/i, /registre.*mandat/i, /gestes/i]) {
        const l = ligneDe(table, iPresc, sonde, `de la prescription ${sonde}`);
        assert.ok(l[iDoit]?.length > 40, `la prescription « ${l[iPresc]} » n'explique pas ce que le texte doit dire`);
      }

      const gestes = ligneDe(table, iPresc, /gestes/i, 'des quatre gestes');
      assert.match(
        gestes[iDoit], /\*\*les quatre\*\*/i,
        'le brief doit exiger le COMPTE des gestes, pas leur simple présence'
      );
    },
  },

  {
    id: 'aucun-envoi-nu-prescrit',
    quoi: 'aucun bloc de commande ne PRESCRIT `herdr agent prompt` pour parler à un agent',
    verifier({ skill }) {
      // ⚠️ CE CONTRÔLE PORTE SUR CE QUI EST PRESCRIT, PAS SUR LA PRÉSENCE DU MOT — et c'est
      // toute la difficulté ici : le texte DOIT continuer de nommer `herdr agent prompt` pour
      // expliquer pourquoi on ne s'en sert pas. Un contrôle qui chercherait l'absence du mot
      // obligerait à effacer l'explication, c'est-à-dire à perdre la raison.
      //
      // Ce qu'on regarde, c'est donc les BLOCS DE COMMANDE et les gestes donnés en ligne comme
      // « voici la commande » : ce qu'un agent copiera. La prose peut en parler tant qu'elle
      // veut ; ce qui est offert à la copie doit passer par la voie vérifiée (T-20260814-0138).
      const blocs = skill.match(/```[\s\S]*?```/g) || [];
      for (const bloc of blocs) {
        assert.ok(
          !/herdr\s+agent\s+prompt/.test(bloc),
          'un bloc de commande prescrit encore `herdr agent prompt` : ce geste rend un succès ' +
            'même quand le message reste dans la boîte du destinataire sans être soumis. La voie ' +
            'à enseigner est `livrer.js`, qui relit la boîte après avoir écrit.'
        );
      }

      // Et la voie vérifiée doit être PRÉSENTE — sinon le contrôle ci-dessus serait satisfait
      // par un texte qui n'enseigne plus aucun moyen de parler à un agent.
      assert.ok(
        blocs.some((b) => /livrer\.js/.test(b)),
        'aucun bloc n’enseigne la voie vérifiée (`livrer.js`) pour parler à un agent'
      );
    },
  },
];

// ═════════════════════════════════════════ les mutations
//
// Chaque mutation : { id, quoi, sur: 'skill' | 'brief', cible: <id de contrôle>, muter(texte) }.
//
// `sur` dit quel texte est muté — l'autre reste réel. Sans ça, une mutation du brief
// serait servie au contrôle comme si elle était le SKILL, il rougirait pour une raison
// qui n'a rien à voir, et le harnais compterait une prise imaginaire.

export const MUTATIONS = [
  {
    id: 'envoi-nu-reintroduit',
    quoi: 'un bloc de commande réenseigne `herdr agent prompt` pour rendre compte',
    sur: 'skill',
    cible: 'aucun-envoi-nu-prescrit',
    muter: (t) => t.replace(
      "node $HOME/.somtech/naissance-representant/bin/livrer.js <ton-nom> --texte '<son-nom> : poussee passee, le sas etait libre'",
      "herdr agent prompt <ton-nom> '<son-nom> : poussee passee, le sas etait libre'"
    ),
  },

  {
    id: 'orchestrateur-code',
    quoi: 'l\'orchestrateur code — la fonction principale retournée',
    sur: 'skill',
    cible: 'orchestrateur-jamais-code',
    // ⚠️ Ré-ancrée (D-20260826-0010) : la cellule porte la restriction sur les panes.
    muter: (t) => t.replace(
      '| ne code pas, ne relit pas le code, n\'ouvre en pane que des chefs d\'équipe |',
      '| ne relit pas le code, n\'ouvre en pane que des chefs d\'équipe |'
    ),
  },

  {
    id: 'orchestrateur-relit',
    quoi: 'l\'orchestrateur relit le code — l\'interdit passe du côté de ce qu\'il fait',
    sur: 'skill',
    cible: 'orchestrateur-jamais-relit',
    muter: (t) => t.replace(
      '| cadre, découpe, arbitre, fusionne, tient le registre | ne code pas, ne relit pas le code,',
      '| cadre, découpe, arbitre, fusionne, tient le registre, relit le code | ne code pas,'
    ),
  },

  {
    id: 'orchestrateur-ouvre-ce-qu-il-veut',
    quoi: 'l\'orchestrateur peut ouvrir autre chose qu\'un chef d\'équipe',
    sur: 'skill',
    cible: 'orchestrateur-nouvre-que-des-chefs-equipe',
    // ⚠️ Ré-ancrée (D-20260826-0010) : la cellule porte la restriction sur les panes.
    muter: (t) => t.replace(
      ", n'ouvre en pane que des chefs d'équipe |",
      ' |'
    ),
  },

  {
    id: 'principe-de-deploiement-assoupli',
    quoi: 'le principe de déploiement s\'assouplit en recommandation — le mot-clé reste, le sens part',
    sur: 'skill',
    cible: 'orchestrateur-nouvre-que-des-chefs-equipe',
    // ⚠️ Ré-ancrée (D-20260826-0010) : le principe porte le périmètre de l'ABC 3.0.0.
    muter: (t) => t.replace(
      'sont ses propres moyens, et ils ne portent jamais un lot.**',
      'sont ses propres moyens, et ils ne portent jamais un lot, sauf si ça presse.**'
    ),
  },
  {
    id: 'le-principe-perd-son-perimetre',
    quoi: 'le principe redevient l\'ancien interdit total — « ne déploie que des chefs d\'équipe » sans le périmètre du livrable ni les moyens d\'analyse',
    sur: 'skill',
    cible: 'orchestrateur-nouvre-que-des-chefs-equipe',
    muter: (t) => t.replace(
      "> **L'orchestrateur ne déploie que des chefs d'équipe pour le travail qui produit un livrable — ses sous-agents d'analyse (lecture seule, résultat au ServiceDesk) sont ses propres moyens, et ils ne portent jamais un lot.**",
      "> **L'orchestrateur ne déploie que des chefs d'équipe qui gèrent des sous-agents.**"
    ),
  },
  {
    id: 'les-moyens-d-analyse-portent-des-lots',
    quoi: 'la borne des sous-agents d\'analyse tombe du principe — « propres moyens » se relit comme « fais mener tes lots par tes sous-agents »',
    sur: 'skill',
    cible: 'orchestrateur-nouvre-que-des-chefs-equipe',
    muter: (t) => t.replace(
      'sont ses propres moyens, et ils ne portent jamais un lot.**',
      'sont ses propres moyens.**'
    ),
  },

  {
    id: 'seuil-reintroduit-en-colonne',
    quoi: 'le seuil revient sous forme de colonne « Quand le justifier »',
    sur: 'skill',
    cible: 'aucun-seuil-nouvre-le-niveau',
    muter: (t) => t
      .replace(
        "| Niveau | Qui | Ce qu'il fait | Ce qu'il ne fait **jamais** |\n|---|---|---|---|",
        "| Niveau | Qui | Ce qu'il fait | Ce qu'il ne fait **jamais** | Quand le justifier |\n|---|---|---|---|---|"
      )
      .replace(
        "| **Orchestrateur** | toi (agent herdr) | cadre, découpe, arbitre, fusionne, tient le registre | ne code pas, ne relit pas le code, n'ouvre en pane que des chefs d'équipe |",
        "| **Orchestrateur** | toi (agent herdr) | cadre, découpe, arbitre, fusionne, tient le registre | ne code pas, ne relit pas le code, n'ouvre en pane que des chefs d'équipe | toujours |"
      )
      .replace(
        "| **Chef d'équipe** | tout agent herdr que tu ouvres | mène son unité de travail, la distribue à ses sous-agents, intègre, rend compte | n'ouvre aucun agent herdr |",
        "| **Chef d'équipe** | agent herdr optionnel | mène son unité de travail, la distribue à ses sous-agents, intègre, rend compte | n'ouvre aucun agent herdr | 2+ périmètres parallèles, ou 5+ agents à coordonner |"
      )
      .replace(
        "| **Sous-agents et coéquipiers** | outil `Agent`, autant que nécessaire | écrivent, testent, reviewent | ne fusionnent rien, ne parlent pas à l'orchestrateur |",
        "| **Sous-agents et coéquipiers** | outil `Agent`, autant que nécessaire | écrivent, testent, reviewent | ne fusionnent rien, ne parlent pas à l'orchestrateur | toujours |"
      ),
  },

  {
    id: 'chef-equipe-redevient-optionnel',
    quoi: 'le chef d\'équipe redevient un cas particulier, sans qu\'aucun chiffre n\'apparaisse',
    sur: 'skill',
    cible: 'aucun-seuil-nouvre-le-niveau',
    muter: (t) => t.replace(
      "| **Chef d'équipe** | tout agent herdr que tu ouvres |",
      "| **Chef d'équipe** | agent herdr optionnel, si le chantier le justifie |"
    ),
  },

  {
    // Trouvée par la passe 1 de revue : la garde acceptait la règle OU son motif.
    id: 'motif-du-retrait-du-seuil-efface',
    quoi: 'le motif du retrait disparaît — la règle survit, la raison qui la fonde s\'efface',
    sur: 'skill',
    cible: 'aucun-seuil-nouvre-le-niveau',
    muter: (t) => t.replace(
      "**Ce seuil n'avait été mesuré par rien** : il a été inventé en rédigeant.",
      'Ce seuil rendait des services : il avait sa logique.'
    ),
  },

  {
    id: 'regle-du-role-effacee',
    quoi: 'la règle disparaît — le motif survit, mais plus rien ne dit que le niveau se lit dans le rôle',
    sur: 'skill',
    cible: 'aucun-seuil-nouvre-le-niveau',
    muter: (t) => t.replace(
      '**Le niveau se lit dans le rôle, jamais dans un seuil.**',
      '**Le niveau se lit dans le rôle autant que dans le volume.**'
    ),
  },

  {
    // Trouvée par la passe 2 de revue : aucun contrôle ne sondait cette section.
    id: 'petite-tache-ouvre-quand-meme-un-agent',
    quoi: 'la petite tâche mérite désormais son propre agent — le seul critère qui dit de NE PAS ouvrir se retourne',
    sur: 'skill',
    cible: 'critere-de-non-ouverture',
    muter: (t) => t.replace(
      "- Tâche < 30 min de travail, ou < 5 fichiers à toucher → traite-la **dans le chef d'équipe qui est déjà ouvert**, ou attends de la regrouper avec une autre. N'ouvre pas un agent pour ça.",
      '- Toute tâche, même de 5 minutes → un chef d\'équipe dédié, systématiquement.'
    ),
  },

  {
    id: 'critere-de-taille-devient-un-critere-d-existence',
    quoi: 'le critère de taille redevient ce qui décide SI le niveau existe',
    sur: 'skill',
    cible: 'critere-de-non-ouverture',
    muter: (t) => t.replace(
      'Le critère de taille ne décide pas **si** le niveau chef d\'équipe existe : il existe toujours. Il décide **combien** de chefs d\'équipe tu ouvres, et s\'il en faut un seul.',
      'Le critère de taille décide si le niveau chef d\'équipe se justifie, et combien tu en ouvres.'
    ),
  },

  {
    id: 'anti-pattern-du-seuil-retire',
    quoi: 'l\'anti-pattern qui interdit de rechercher un seuil disparaît de la table',
    sur: 'skill',
    cible: 'anti-patterns-portent-les-decisions',
    muter: (t) => t.replace(/^\| Chercher le seuil qui justifierait un chef d'équipe \|.*\n/m, ''),
  },

  {
    id: 'anti-pattern-du-modele-assoupli',
    quoi: 'l\'anti-pattern du modèle non déclaré s\'assouplit en cas particulier',
    sur: 'skill',
    cible: 'anti-patterns-portent-les-decisions',
    muter: (t) => t.replace(
      '| Faire naître un agent sans déclarer son modèle | Il naît en Haiku, sans mode auto, et s\'arrête à chaque permission.',
      '| Faire naître un agent sans déclarer son modèle | Il naît parfois en Haiku, sans mode auto.'
    ),
  },

  {
    // Trouvée par la passe 2 de revue : « jamais à ta main » → « autant que possible »
    // retournait le sens sans qu'aucune garde ne bouge.
    id: 'deblocage-rendu-tolerable-a-la-main',
    quoi: 'le déblocage à la main redevient acceptable « autant que possible » — la négation s\'efface sans mot interdit',
    sur: 'skill',
    cible: 'quatre-gestes-hors-orchestrateur',
    muter: (t) => t.replace(
      '| **Débloquer** une permission | à la veille, jamais à ta main |',
      '| **Débloquer** une permission | à la veille, autant que possible |'
    ),
  },

  {
    id: 'chef-equipe-ouvre-des-agents-herdr',
    quoi: 'le chef d\'équipe ouvre des agents herdr — il empiète sur le niveau au-dessus',
    sur: 'skill',
    cible: 'chef-equipe-jamais-agent-herdr',
    muter: (t) => t.replace(
      "| mène son unité de travail, la distribue à ses sous-agents, intègre, rend compte | n'ouvre aucun agent herdr |",
      "| mène son unité de travail, ouvre des agents herdr, intègre, rend compte | ne fusionne rien |"
    ),
  },

  {
    id: 'sous-agents-fusionnent',
    quoi: 'les sous-agents fusionnent — ils franchissent la frontière d\'exécution',
    sur: 'skill',
    cible: 'sous-agents-jamais-fusionnent',
    muter: (t) => t.replace(
      "| écrivent, testent, reviewent | ne fusionnent rien, ne parlent pas à l'orchestrateur |",
      "| écrivent, testent, reviewent, fusionnent | ne parlent pas à l'orchestrateur |"
    ),
  },

  {
    id: 'quatrieme-niveau-ajoute',
    quoi: 'un quatrième niveau apparaît dans la table — le compte n\'est plus tenu',
    sur: 'skill',
    cible: 'trois-niveaux-prescrits',
    muter: (t) => t.replace(
      "| **Sous-agents et coéquipiers** | outil `Agent`, autant que nécessaire | écrivent, testent, reviewent | ne fusionnent rien, ne parlent pas à l'orchestrateur |",
      "| **Sous-agents et coéquipiers** | outil `Agent`, autant que nécessaire | écrivent, testent, reviewent | ne fusionnent rien, ne parlent pas à l'orchestrateur |\n| **Superviseur** | agent herdr au-dessus de toi | supervise plusieurs orchestrateurs | ne code pas |"
    ),
  },

  {
    id: 'arbitrage-du-chef-equipe-differe',
    quoi: 'l\'arbitrage du chef d\'équipe peut attendre la fin — le mot-clé reste, la modalité tombe',
    sur: 'skill',
    cible: 'chef-equipe-trois-regles',
    muter: (t) => t.replace(
      '3. **Arbitrage immédiat** — ce qui bloque remonte tout de suite, jamais gardé pour la fin.',
      '3. **Arbitrage immédiat** — ce qui bloque remonte au besoin, de préférence avant la fin.'
    ),
  },

  {
    id: 'modele-devient-facultatif',
    quoi: 'la déclaration du modèle devient facultative — « toujours » survit dans le titre',
    sur: 'skill',
    cible: 'modele-declare-au-lancement',
    muter: (t) => t.replace(
      "> **Le modèle d'un agent que tu fais naître se déclare au lancement. Toujours. Sans exception.**",
      "> **Le modèle d'un agent que tu fais naître se déclare au lancement. Toujours, si tu le souhaites.**"
    ),
  },

  {
    id: 'modele-pretendu-herite',
    quoi: 'le modèle est présenté comme hérité de la session appelante — le fait qui fonde la règle disparaît',
    sur: 'skill',
    cible: 'modele-declare-au-lancement',
    muter: (t) => t.replace(
      "Il n'hérite **pas** du modèle de la session qui l'a lancé.",
      'Il hérite du modèle de la session qui l\'a lancé.'
    ),
  },

  {
    id: 'haiku-autorise-en-agent-herdr',
    quoi: 'Haiku redevient admissible pour un agent herdr',
    sur: 'skill',
    cible: 'modele-par-nature-d-agent',
    muter: (t) => t.replace(
      '| **Opus** — **jamais Haiku** |',
      '| **Opus**, ou Haiku au besoin |'
    ),
  },

  {
    id: 'haiku-interdit-en-sous-agent',
    quoi: 'Haiku devient interdit en sous-agent — l\'interdit déborde du bon côté vers le mauvais',
    sur: 'skill',
    cible: 'modele-par-nature-d-agent',
    muter: (t) => t.replace(
      '| **Haiku possible, et utile** |',
      '| **jamais Haiku** |'
    ),
  },

  {
    id: 'nom-tire-du-sujet-du-chantier',
    quoi: 'le nom peut venir du sujet du chantier — l\'interdit qui le distingue de l\'orchestrateur tombe',
    sur: 'skill',
    cible: 'nom-vient-du-mandat',
    muter: (t) => t.replace(
      '**Le nom vient du mandat, jamais du sujet du chantier.**',
      '**Le nom vient du mandat, ou du sujet du chantier si celui-ci est plus parlant.**'
    ),
  },

  {
    id: 'nom-invente-donne-en-exemple',
    quoi: 'un nom inventé passe du côté des exemples conformes',
    sur: 'skill',
    cible: 'nom-vient-du-mandat',
    muter: (t) => t.replace(
      '- ❌ `chef-equipe-orchestration`, `achever-orchestration`, `revue-pr180` — des noms inventés',
      '- ✅ `chef-equipe-orchestration` — un nom parlant\n- ❌ `achever-orchestration`, `revue-pr180` — des noms inventés'
    ),
  },

  {
    id: 'libelle-onglet-reduit-au-domaine',
    quoi: 'les exemples de libellé retombent à un seul mot de domaine',
    sur: 'skill',
    cible: 'libelle-onglet-code-puis-mots',
    muter: (t) => t.replace(
      'e-20260807-0006 preuves de la compétence\nd-20260807-0005 orchestration et veille',
      'e-20260807-0006 orchestration\nd-20260807-0005 orchestration'
    ),
  },

  {
    id: 'un-geste-rendu-a-l-orchestrateur',
    quoi: 'le déblocage revient à l\'orchestrateur — un geste sur quatre change de camp',
    sur: 'skill',
    cible: 'quatre-gestes-hors-orchestrateur',
    muter: (t) => t.replace(
      '| **Débloquer** une permission | à la veille, jamais à ta main |',
      '| **Débloquer** une permission | à toi, quand la veille n\'y arrive pas |'
    ),
  },

  {
    id: 'un-geste-disparait-du-principe',
    quoi: 'le principe n\'énumère plus que trois gestes sur quatre',
    sur: 'skill',
    cible: 'quatre-gestes-hors-orchestrateur',
    muter: (t) => t.replace(
      "> **L'orchestrateur qui renomme, débloque des permissions, corrige des scripts ou relance des processus a déjà perdu le fil.**",
      "> **L'orchestrateur qui renomme, débloque des permissions ou corrige des scripts a déjà perdu le fil.**"
    ),
  },

  {
    id: 'veille-repond-devant-l-inconnu',
    quoi: 'devant un écran non reconnu, la veille répond quand même — la garantie qui la rend inoffensive tombe',
    sur: 'skill',
    cible: 'veille-trois-garanties',
    muter: (t) => t.replace(
      "2. **Devant un écran qu'elle ne reconnaît pas, elle ne répond pas.** Elle s'arrête et le dit.",
      "2. **Devant un écran qu'elle ne reconnaît pas, elle répond au mieux.** Elle poursuit et le note."
    ),
  },

  {
    id: 'veille-deduit-le-sens-de-la-position',
    quoi: 'la position d\'une option redevient un indice de son sens',
    sur: 'skill',
    cible: 'veille-trois-garanties',
    muter: (t) => t.replace(
      '3. **La position d\'une option ne dit jamais son sens.**',
      '3. **La position d\'une option indique généralement son sens.**'
    ),
  },

  {
    id: 'veille-se-contente-d-un-signe',
    quoi: 'un seul signe suffit à déclencher une réponse de la veille',
    sur: 'skill',
    cible: 'veille-trois-garanties',
    muter: (t) => t.replace(
      '**Elle ne répond que devant une vraie demande de permission**, reconnue par **deux signes concordants** — jamais un seul.',
      '**Elle répond devant une demande de permission**, reconnue par **un signe** — deux si possible.'
    ),
  },

  {
    id: 'haiku-peut-conclure-mergeable',
    quoi: 'la passe 1 peut conclure « mergeable » — le portail s\'ouvre trop tôt',
    sur: 'skill',
    cible: 'revue-deux-passes-polarite-des-verdicts',
    muter: (t) => t.replace(
      '| rejette rapidement les défauts évidents | `REJET` ou `RIEN VU` | **jamais** « mergeable » |',
      '| rejette rapidement les défauts évidents | `REJET`, `RIEN VU` ou « mergeable » | — |'
    ),
  },

  {
    id: 'brief-ouvre-mergeable-a-la-passe-1',
    quoi: 'le brief autorise « mergeable » à la passe 1, alors que le SKILL l\'interdit encore',
    sur: 'brief',
    cible: 'revue-deux-passes-polarite-des-verdicts',
    muter: (t) => t.replace(
      '| `REJET`, `RIEN VU` | **`mergeable`** — jamais |',
      '| `REJET`, `RIEN VU`, `mergeable` | — |'
    ),
  },

  {
    id: 'brief-perd-un-motif',
    quoi: 'un des trois motifs de défaut disparaît du brief',
    sur: 'brief',
    cible: 'brief-porte-ses-motifs',
    muter: (t) => t.replace(/## Motif 2[\s\S]*?\n---\n/, ''),
  },

  {
    id: 'brief-reduit-le-nombre-de-mutations',
    quoi: 'le brief n\'exige plus que deux mutations du cru',
    sur: 'brief',
    cible: 'brief-exige-des-mutations-du-cru',
    muter: (t) => t
      .replace('pose **trois mutations** de ton invention', 'pose **deux mutations** de ton invention')
      .replace('3. Crée un trou dans le motif que tu audites — ça doit rougir\n', ''),
  },

  {
    id: 'brief-rend-les-mutations-facultatives',
    quoi: 'les mutations du cru deviennent facultatives dans le brief',
    sur: 'brief',
    cible: 'brief-exige-des-mutations-du-cru',
    muter: (t) => t.replace(
      '## Mutations du cru — exigence obligatoire',
      '## Mutations du cru — au besoin'
    ),
  },

  {
    id: 'brief-cesse-de-chercher-le-seuil',
    quoi: 'le brief ne fait plus chercher le seuil qui rouvrirait le niveau conditionnellement',
    sur: 'brief',
    cible: 'brief-cherche-le-seuil-reintroduit',
    muter: (t) => t.replace(
      '**ne se justifie par aucun chiffre**',
      'se justifie surtout par le rôle'
    ),
  },

  {
    id: 'brief-perd-le-compte-des-gestes',
    quoi: 'le brief ne demande plus de COMPTER les quatre gestes, seulement de les voir',
    sur: 'brief',
    cible: 'brief-verifie-les-trois-autres-prescriptions',
    muter: (t) => t.replace(
      'renommer, débloquer une permission, corriger un script, relancer un processus — **les quatre**, chacun rendu au chef d\'équipe',
      'renommer, débloquer une permission, corriger un script, relancer un processus — rendus au chef d\'équipe'
    ),
  },

  {
    id: 'brief-perd-une-prescription',
    quoi: 'la prescription du modèle disparaît de la table des vérifications du brief',
    sur: 'brief',
    cible: 'brief-verifie-les-trois-autres-prescriptions',
    muter: (t) => t.replace(/^\| \*\*Modèle déclaré au lancement\*\*.*\n/m, ''),
  },
];

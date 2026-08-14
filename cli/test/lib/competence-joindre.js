// Les contrôles de la compétence de DÉSIGNATION — `/joindre-les-agents` — et les mutations qui
// les mettent à l'épreuve.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE À CÔTÉ DE `competences-de-pose.js`
//
// Celui-là garde deux compétences qui POSENT un lieu : elles écrivent sur disque, versent leur
// travail dans une branche, ouvrent une PR. Celle-ci ne pose rien — elle inscrit au POSTE ce
// que les agents chercheront ensuite. Deux de ses garanties communes n'ont donc aucun objet
// ici (« le principe précède la procédure de POSE », « la PR reste un brouillon »), et les
// appliquer quand même n'aurait pas gardé la compétence : ça l'aurait forcée à enseigner un
// versement qu'elle ne fait pas.
//
// Les cinq autres, elles, valent pour tout texte qu'un agent exécute — un geste inventé, une
// commande destructrice, une compétence citée qui n'existe pas ne dépendent pas de ce que le
// texte prescrit. Elles sont donc IMPORTÉES, jamais recopiées : « deux sources qui disent la
// même chose divergent, c'est mécanique ».
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUE CES CONTRÔLES GARDENT, ET POURQUOI CHACUN
//
//   • l'état est MESURÉ avant qu'on désigne quoi que ce soit — sans quoi la compétence n'est
//     qu'un copier-coller de trois commandes, ce que le ticket lui reproche d'être ;
//   • chaque refus est CITÉ mot pour mot depuis le code qui le rend — une reformulation qui
//     dérive est exactement le défaut que T-20260811-0087 a payé ;
//   • la traduction « gestionnaire » → `representant` est juste, et confrontée aux rôles que
//     le code connaît réellement — pas à une liste recopiée ;
//   • l'idempotence oblige : sur un poste complet, rien n'est redésigné ;
//   • le périmètre que le dirigeant a lui-même resserré tient — ni mise à jour du pack, ni
//     relève du veilleur dans les gestes enseignés.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO, sectionDe, tableDe, colonne, blocsBash, exigeImperatif } from './metier-representant.js';
import { CONTROLES_COMMUNS, horsBlocs, invocations } from './competences-de-pose.js';
import { rolesConnus } from '../../../ligne-directe/src/roles.js';

export { REPO };

export const COMPETENCE = { nom: 'joindre-les-agents', chemin: join('.claude', 'skills', 'joindre-les-agents', 'SKILL.md') };

export const lireCompetence = (racine = REPO) => readFileSync(join(racine, COMPETENCE.chemin), 'utf8');

/**
 * Les GARANTIES COMMUNES qui valent aussi pour une compétence qui ne pose rien.
 *
 * Écartées, et il faut savoir lesquelles pour que l'écart reste un choix plutôt qu'un oubli :
 *
 *   • `le-principe-precede-la-procedure` — il exige littéralement « elle ne crée rien tant
 *     que… ». Celle-ci ne crée rien, jamais : son principe porte sur la MESURE, et il est
 *     gardé par `l-etat-se-mesure-avant-de-designer` ci-dessous, qui garde en plus l'ordre.
 *   • `la-pr-reste-un-brouillon` — elle n'écrit aucun fichier, donc n'ouvre aucune PR. Exiger
 *     `gh pr create --draft` l'obligerait à enseigner un versement qui n'existe pas.
 */
export const IDS_COMMUNS_RETENUS = [
  'aucun-geste-qui-detruit',
  'les-gestes-enseignes-existent',
  'les-sous-commandes-du-pack-existent',
  'les-competences-citees-existent',
  'l-entete-declenche',
];

/** Ceux qu'on écarte — nommés, pour qu'un renommage en amont se voie au lieu de les faire sauter. */
export const IDS_COMMUNS_ECARTES = ['le-principe-precede-la-procedure', 'la-pr-reste-un-brouillon'];

export function communsRetenus() {
  const connus = new Set(CONTROLES_COMMUNS.map((c) => c.id));
  // SANS CETTE GARDE, UN RENOMMAGE EN AMONT DÉSARMERAIT TOUT EN SILENCE : un filtre par
  // identifiant ne rougit pas quand l'identifiant disparaît — il ne retient simplement plus
  // rien, et la suite reste verte autour d'une compétence que plus personne ne contrôle.
  for (const id of [...IDS_COMMUNS_RETENUS, ...IDS_COMMUNS_ECARTES]) {
    assert.ok(connus.has(id), `le contrôle commun « ${id} » n'existe plus — la liste doit suivre, pas retenir zéro contrôle`);
  }
  return CONTROLES_COMMUNS.filter((c) => IDS_COMMUNS_RETENUS.includes(c.id));
}

/**
 * Les trois sources qui portent RÉELLEMENT les refus que cette compétence relaie.
 *
 * ⚠️ CE N'EST PAS `CHEMINS_REFUS` DU MODULE VOISIN, et c'en est le contraire d'un oubli : cette
 * liste-là couvre les refus d'une POSE (`lieu-agent.js`, `orchestrateur.js`). Les refus qu'on
 * garde ici viennent du veilleur (le canal absent, archivé, sans robot, déjà pris), de la table
 * des rôles (le rôle inconnu) et de la commande elle-même (le courriel qui ne désigne
 * personne). S'appuyer sur la liste voisine aurait cherché nos refus là où ils ne sont pas — et
 * la garde serait passée, en ne prouvant rien. (T-20260813-0069 signale déjà que cette liste
 * voisine ne couvre pas tout ce qu'on croit ; on ne s'y adosse donc pas.)
 */
export const CHEMINS_DES_REFUS = [
  join('ligne-directe', 'src', 'veilleur.js'),
  join('ligne-directe', 'src', 'roles.js'),
  join('ligne-directe', 'bin', 'ligne-directe.js'),
];

export const sourcesDesRefus = (racine = REPO) =>
  CHEMINS_DES_REFUS.map((c) => readFileSync(join(racine, c), 'utf8')).join('\n');

/** La table de la section des refus, et l'index de la colonne qui cite le code. */
function tableDesRefus(texte) {
  const section = sectionDe(texte, /refuse/i, 'sur ce qui se passe quand elle refuse');
  return { section, table: tableDe(section.corps) };
}

/** Les invocations montrées d'un geste de ligne — `$LD commun`, `$LD dirigeant`… */
const invocationsDe = (texte, geste) => invocations(texte, 'LD').filter((i) => new RegExp(`\\$LD\\s+${geste}\\b`).test(i));

// ═════════════════════════════════════════ les contrôles propres à la désignation

export const CONTROLES = [
  {
    id: 'l-etat-se-mesure-avant-de-designer',
    quoi: 'le principe impose de mesurer d’abord, et la mesure est montrée AVANT toute désignation',
    verifier({ texte }) {
      const principe = sectionDe(texte, /principe/i, 'sur le principe qui gouverne le reste');
      assert.match(
        principe.corps,
        /ne d[ée]signe rien tant qu/i,
        'le principe doit dire qu’elle ne désigne RIEN tant qu’elle n’a pas mesuré',
      );
      exigeImperatif(principe.corps, 'le principe qui gouverne la désignation');

      // POSITION, pas seulement présence. Un texte qui montre les deux désignations puis
      // explique en fin de page qu'il aurait fallu mesurer d'abord est le copier-coller que le
      // ticket reproche — avec une section de plus.
      const iEtat = texte.indexOf('$LD etat');
      assert.ok(iEtat > 0, 'la compétence doit montrer la mesure de l’état');
      for (const geste of ['dirigeant', 'commun']) {
        const invs = invocationsDe(texte, geste);
        assert.ok(invs.length > 0, `la compétence doit montrer le geste « ${geste} »`);
        for (const inv of invs) {
          assert.ok(
            texte.indexOf(inv) > iEtat,
            `« $LD ${geste} » est montré avant la mesure de l’état — on désignerait sans savoir ce qui est là`,
          );
        }
      }

      // Ce que la mesure APPREND, et que personne ne peut demander au poste autrement : quels
      // rôles n'ont pas encore de canal. Sans cette phrase, la mesure se réduit à un affichage.
      assert.match(
        horsBlocs(texte),
        /r[ôo]les? qui n[e’']ont pas de canal|r[ôo]les? n[e’']ont encore aucun canal|quels r[ôo]les/i,
        'le texte doit dire que la mesure sert à savoir quels RÔLES n’ont pas encore de canal',
      );
    },
  },

  {
    id: 'chaque-refus-est-cite-mot-pour-mot',
    quoi: 'chaque refus tabulé est un fragment qui existe LITTÉRALEMENT dans le code qui le rend',
    verifier({ texte, racine }) {
      // C'est la garde centrale de ce lot, et elle est plus stricte que celle des compétences
      // de pose : là-bas on comparait le vocabulaire partagé, ce qui ferme la porte du vidage
      // mais pas celle du contresens. Ici, la table CITE le refus — donc toute reformulation,
      // même juste, casse le contrôle. C'est possible parce que ces refus-là sont déjà écrits
      // et bons : le lot n'a rien à en dire de neuf, il a seulement à les relayer.
      const sources = sourcesDesRefus(racine);
      const { table } = tableDesRefus(texte);
      const cites = colonne(table, /^Ce que le refus dit, mot pour mot$/, 'la citation du refus');
      assert.ok(cites.length >= 6, `la table des refus doit couvrir les refus des deux gestes (${cites.length} ligne·s)`);

      for (const cellule of cites) {
        const fragment = (cellule.match(/`([^`]+)`/) || [])[1];
        assert.ok(fragment, `une ligne de la table ne cite aucun refus : « ${cellule} »`);
        // UN FRAGMENT COURT NE PROUVE RIEN : « le », « #canal » se retrouvent partout dans un
        // fichier source, et la citation deviendrait une formalité qu'on satisfait sans citer.
        assert.ok(
          fragment.length >= 15,
          `« ${fragment} » est trop court pour prouver quoi que ce soit — cite une phrase du refus, pas un mot`,
        );
        assert.ok(
          sources.includes(fragment),
          `« ${fragment} » n’apparaît dans aucun des fichiers qui rendent les refus `
            + `(${CHEMINS_DES_REFUS.join(', ')}) : le refus a été reformulé, ou il a changé sans que la table suive`,
        );
      }

      // Les quatre refus que le ticket nomme, et qui doivent être couverts quoi qu'il arrive :
      // canal absent, archivé, robot non membre, canal portant déjà une ligne.
      const tout = table.lignes.map((l) => l.join(' ')).join('\n');
      for (const [quoi, sonde] of [
        ['le canal absent', /aucun canal|ne porte ce nom/i],
        ['le canal archivé', /archiv/i],
        ['le robot non membre', /robot/i],
        ['le canal qui porte déjà une ligne', /porte d[ée]j[àa] la ligne|à la fois/i],
      ]) {
        assert.match(tout, sonde, `la table des refus ne dit rien de ${quoi}`);
      }
    },
  },

  {
    id: 'la-traduction-des-roles-est-juste',
    quoi: '« gestionnaire » mène bien à `representant`, et aucun rôle enseigné n’est inventé',
    verifier({ texte }) {
      // Le piège nommé par le ticket : l'humain dit « gestionnaire », la commande attend
      // `representant`. La garde confronte la table aux rôles que le CODE connaît — jamais à
      // une liste recopiée, qui divergerait le jour où un rôle s'ajoute.
      const connus = rolesConnus();
      assert.ok(connus.includes('representant'), 'le code ne connaît plus « representant » — la traduction serait fausse');

      const section = sectionDe(texte, /noms/i, 'sur la traduction des noms');
      const table = tableDe(section.corps);
      const dits = colonne(table, /^Ce qu['’]on dit en parlant$/, 'ce qu’on dit en parlant');
      const tapes = colonne(table, /^Ce que tu tapes$/, 'ce que tu tapes');

      const rang = dits.findIndex((d) => /gestionnaire/i.test(d));
      assert.ok(rang !== -1, 'la table doit partir du mot qu’on emploie vraiment : « gestionnaire »');
      assert.match(
        tapes[rang] || '',
        /`representant`/,
        `« gestionnaire » doit mener à \`representant\` — la table dit « ${tapes[rang]} »`,
      );

      for (const cellule of tapes) {
        const role = (cellule.match(/`([a-z-]+)`/) || [])[1];
        assert.ok(role, `une ligne de traduction ne nomme aucun rôle : « ${cellule} »`);
        assert.ok(connus.includes(role), `la table enseigne le rôle « ${role} », que le code ne connaît pas (${connus.join(', ')})`);
      }

      // Chaque rôle connu doit avoir sa traduction : celui qu'on oublie est celui dont
      // l'opérateur ne saura pas qu'il a un canal à désigner.
      const traduits = new Set(tapes.map((c) => (c.match(/`([a-z-]+)`/) || [])[1]).filter(Boolean));
      const oublies = connus.filter((r) => !traduits.has(r));
      assert.deepEqual(oublies, [], `ces rôles n’ont aucune ligne de traduction : ${oublies.join(', ')}`);
    },
  },

  {
    id: 'l-idempotence-oblige',
    quoi: 'sur un poste complet elle ne redésigne rien, et ce n’est pas une recommandation',
    verifier({ texte }) {
      // LES ESPACES SONT NORMALISÉS AVANT DE CHERCHER, et ce n'est pas de la commodité : le
      // texte est enroulé à 100 colonnes, donc une phrase clé se coupe au milieu. Une sonde qui
      // s'arrête au retour à la ligne ne verrait alors JAMAIS la phrase qu'elle garde — elle
      // rougirait sur un texte juste, on la relâcherait, et la garde serait perdue.
      const dehors = horsBlocs(texte).replace(/\s+/g, ' ');
      const phrase = dehors.match(/[^.]*(?:ne red[ée]signe rien|ne redésigne pas|ne refait rien)[^.]*\./i);
      assert.ok(
        phrase,
        'le texte doit dire qu’elle ne redésigne RIEN sur un poste déjà pourvu — sans quoi elle rejoue les commandes',
      );
      exigeImperatif(phrase[0], 'la promesse d’idempotence');
      assert.match(
        dehors,
        /pour être sûr|n[e’']as rien à faire|s[e’']arrête là/i,
        'le texte doit fermer la porte du « je relance pour être sûr » — c’est le geste qui use le poste',
      );
    },
  },

  {
    id: 'le-perimetre-tranche-tient',
    quoi: 'ni la mise à jour du pack ni la relève du veilleur ne sont enseignées comme un geste du lot',
    verifier({ texte }) {
      // Le dirigeant a resserré le périmètre lui-même : « la mise à jour du pack c'est ok,
      // mais désigner les canaux ça prend des compétences ». Une compétence qui reprend ces
      // deux gestes recrée le copier-coller qu'on remplace, avec une couche de plus.
      for (const bloc of blocsBash(texte)) {
        assert.ok(!/\brelever\b/.test(bloc), `un bloc à exécuter relève le veilleur : hors périmètre\n${bloc}`);
        assert.ok(!/pack (?:update|setup)/.test(bloc), `un bloc à exécuter met le pack à jour : hors périmètre\n${bloc}`);
      }
      assert.match(
        horsBlocs(texte),
        /ne relève pas le veilleur|ne met pas le poste à jour|ne sont pas dans ce lot/i,
        'le texte doit DIRE ce qu’il ne fait pas — sinon l’absence se lit comme un oubli',
      );
    },
  },
];

// ═════════════════════════════════════════ exécution

export function controlesQuiRougissent(texte, racine = REPO) {
  const rouges = [];
  const essayer = (id, fn) => {
    try {
      fn();
    } catch (e) {
      rouges.push({ id, message: e.message });
    }
  };
  for (const c of communsRetenus()) essayer(c.id, () => c.verifier({ texte, nom: COMPETENCE.nom, racine }));
  for (const c of CONTROLES) essayer(c.id, () => c.verifier({ texte, nom: COMPETENCE.nom, racine }));
  return rouges;
}

export const idsDesControles = () => [...IDS_COMMUNS_RETENUS, ...CONTROLES.map((c) => c.id)];

// ═════════════════════════════════════════ les mutations

const remplacer = (texte, quoi, par) => texte.replace(quoi, par);

/** Chaque mutation : { id, quoi, cible, muter(texte) } — `cible` est le contrôle qui DOIT rougir. */
export const MUTATIONS = [
  {
    id: 'mesure-apres-la-designation',
    quoi: 'la mesure de l’état passe après les deux désignations — on désigne à l’aveugle',
    cible: 'l-etat-se-mesure-avant-de-designer',
    muter(t) {
      const mesure = sectionDe(t, /mesure/i, 'mesure');
      const bloc = `## ${mesure.titre}${mesure.corps}`;
      return `${t.replace(bloc, '')}\n${bloc}`;
    },
  },
  {
    id: 'principe-assoupli',
    quoi: 'la mesure cesse d’obliger — « au besoin »',
    cible: 'l-etat-se-mesure-avant-de-designer',
    muter: (t) => remplacer(t, '**La mesure précède littéralement la première désignation**', 'La mesure précède, au besoin, la première désignation'),
  },
  {
    id: 'refus-reformule',
    quoi: 'un refus est reformulé dans les mots de la compétence — le défaut de T-20260811-0087',
    cible: 'chaque-refus-est-cite-mot-pour-mot',
    muter: (t) => remplacer(t, '`Un robot ne rejoint pas un canal de lui-même.`', '`Le robot ne peut pas entrer tout seul dans un canal.`'),
  },
  {
    id: 'refus-cite-a-la-virgule-pres-mais-faux',
    quoi: 'la citation garde sa forme et perd un mot — la dérive silencieuse',
    cible: 'chaque-refus-est-cite-mot-pour-mot',
    muter: (t) => remplacer(t, '`est archivé — personne ne peut plus y écrire`', '`est archivé — personne ne peut y écrire`'),
  },
  {
    id: 'citation-reduite-a-un-mot',
    quoi: 'la citation se réduit à un fragment qu’on trouve partout — citer devient une formalité',
    cible: 'chaque-refus-est-cite-mot-pour-mot',
    muter: (t) => remplacer(t, '`Nomme au moins une personne.`', '`canal`'),
  },
  {
    id: 'refus-du-canal-archive-perdu',
    quoi: 'la table perd la ligne du canal archivé — celui qui a l’air posé et ne diffuse rien',
    cible: 'chaque-refus-est-cite-mot-pour-mot',
    muter: (t) => t.replace(/^\| `est archivé[^\n]*\n/m, ''),
  },
  {
    id: 'traduction-vers-un-role-inconnu',
    quoi: '« gestionnaire » mène vers un rôle que le code ne connaît pas',
    cible: 'la-traduction-des-roles-est-juste',
    muter: (t) => remplacer(t, '| `representant` |', '| `gestionnaire` |'),
  },
  {
    id: 'traduction-qui-perd-un-role',
    quoi: 'un rôle connu n’a plus de traduction — personne ne saura qu’il lui faut un canal',
    cible: 'la-traduction-des-roles-est-juste',
    muter: (t) => t.replace(/^\| l'orchestrateur[^\n]*\n/m, ''),
  },
  {
    id: 'idempotence-devenue-souhait',
    quoi: 'ne rien redésigner devient une recommandation',
    cible: 'l-idempotence-oblige',
    muter: (t) => remplacer(t, '**relancée sur un poste complet, elle ne redésigne rien.**', 'au besoin, elle ne redésigne rien.'),
  },
  {
    id: 'idempotence-effacee',
    quoi: 'la promesse de ne rien redésigner disparaît',
    cible: 'l-idempotence-oblige',
    muter: (t) =>
      t
        .replace('**relancée sur un poste complet, elle ne redésigne rien.**', 'elle est relançable.')
        .replace('Mais ne le fais jamais « pour être sûr » :\nsur un rôle déjà pourvu du bon canal, tu n\'as rien à faire.', '')
        .replace('Elle dit ce qui est en place et s\'arrête là.', ''),
  },
  {
    id: 'la-releve-revient-dans-les-gestes',
    quoi: 'un bloc enseigne la relève du veilleur — le périmètre que le dirigeant a écarté',
    cible: 'le-perimetre-tranche-tient',
    muter: (t) => remplacer(t, '$LD etat\n', '$LD etat\n$LD relever\n'),
  },
  {
    id: 'geste-de-ligne-invente',
    quoi: 'la compétence enseigne un geste que la commande ne connaît pas',
    cible: 'les-gestes-enseignes-existent',
    muter: (t) => remplacer(t, '$LD commun <canal>', '$LD designer-commun <canal>'),
  },
  {
    id: 'option-de-ligne-inventee',
    quoi: 'la compétence enseigne une option que la commande ne connaît pas',
    cible: 'les-gestes-enseignes-existent',
    muter: (t) => remplacer(t, '--role <role>', '--pour <role>'),
  },
  {
    id: 'geste-qui-detruit-dans-un-refus',
    quoi: 'un geste qui débloque envoie écraser une entrée du trousseau',
    cible: 'aucun-geste-qui-detruit',
    muter: (t) =>
      remplacer(
        t,
        'Corrige le courriel. Rien n\'a changé',
        'Redépose l\'entrée : `security add-generic-password -U -a "$USER" -s ligne-directe-bot -w "$(pbpaste)"`. Rien n\'a changé',
      ),
  },
  {
    id: 'sous-commande-du-pack-inventee',
    quoi: 'le prérequis envoie lancer une sous-commande que le CLI ne connaît pas',
    cible: 'les-sous-commandes-du-pack-existent',
    muter: (t) => remplacer(t, 'pack setup', 'pack install'),
  },
  {
    id: 'competence-citee-inexistante',
    quoi: 'le texte renvoie vers une compétence qui n’existe pas',
    cible: 'les-competences-citees-existent',
    muter: (t) => t.replace(/\/ligne-directe/g, '/ligne-direct'),
  },
  {
    id: 'entete-au-mauvais-nom',
    quoi: 'l’en-tête déclare un autre nom que son dossier — la compétence est installée mais introuvable',
    cible: 'l-entete-declenche',
    muter: (t) => remplacer(t, 'name: joindre-les-agents', 'name: designer-les-canaux'),
  },
  {
    id: 'description-trop-etroite',
    quoi: 'la description se réduit à une ligne — la compétence ne se déclenche plus',
    cible: 'l-entete-declenche',
    muter: (t) => t.replace(/^description:.*$/m, 'description: Désigne les canaux.'),
  },
];

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
  // ET LA COUVERTURE DANS L'AUTRE SENS — trouvé en revue de fond. La garde ci-dessus ferme la
  // porte du RENOMMAGE ; celle-ci ferme celle de l'AJOUT. Une garantie commune ajoutée en amont
  // serait sinon ignorée en silence par cette compétence : ni retenue, ni écartée, ni signalée.
  // Aujourd'hui les comptes concordent, mais par coïncidence — et une coïncidence ne garde rien.
  const declares = new Set([...IDS_COMMUNS_RETENUS, ...IDS_COMMUNS_ECARTES]);
  const ignores = CONTROLES_COMMUNS.map((c) => c.id).filter((id) => !declares.has(id));
  assert.deepEqual(
    ignores,
    [],
    `ces garanties communes sont apparues en amont sans que cette compétence dise si elles s'appliquent : `
      + `${ignores.join(', ')}. Les ajouter à IDS_COMMUNS_RETENUS, ou les écarter NOMMÉMENT avec leur raison.`,
  );
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
  // LE TROUSSEAU EN FAIT PARTIE, et c'est le refus qui arrive AVANT tous les autres : les deux
  // gestes lisent le jeton du robot avant de joindre Slack, et son échec traverse le filet de
  // la commande. Sur un poste neuf, c'est même le refus le plus probable — l'omettre laissait
  // l'opérateur devant le seul message qu'aucune ligne de la table n'expliquait.
  join('ligne-directe', 'src', 'trousseau.js'),
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
      //
      // ⚠️ LA SONDE PAR MOT-CLÉ NE SUFFISAIT PAS, et la revue de fond l'a prouvé par mutation :
      // « L'état ne te dit **jamais** quels rôles restent à désigner — tu peux tous les
      // redésigner par prudence » garde les mots « quels rôles » et retourne le principe central
      // de la compétence. C'est le motif dominant du dépôt, dixième tour.
      //
      // On garde donc le LIEN MÉCANIQUE que la phrase doit établir — les rôles sans canal se
      // lisent dans le champ `communs` du rendu — et non la présence d'un mot. Une phrase qui
      // nie que l'état renseigne les rôles ne peut pas nommer le champ où on les lit.
      const dehors = horsBlocs(texte).replace(/\s+/g, ' ');
      //
      // La sonde EXCLUT les barres de table (`[^.|]`) et exige le manque, pas le rôle : la
      // table de lecture porte déjà « un objet par rôle **déjà** pourvu » avec `communs` dans
      // sa cellule voisine — une sonde qui se contentait de « rôle » près de `communs` y était
      // satisfaite, et la phrase pouvait donc être retirée sans que rien ne rougisse.
      const lien = dehors.match(/[^.|]*(?:pas de canal|aucun canal)[^.|]*`communs`[^.|]*\./i);
      assert.ok(
        lien,
        'le texte doit relier les rôles SANS canal au champ `communs` du rendu — sinon la mesure '
          + 'se réduit à un affichage, et rien ne dit ce qu’on en tire',
      );
      // Et la phrase qui l'établit doit OBLIGER : « tu peux tous les redésigner par prudence »
      // dit le contraire de ce que la compétence promet, en gardant tout son vocabulaire.
      exigeImperatif(lien[0], 'la phrase qui dit ce que la mesure apprend');
      // ⚠️ ET ELLE DOIT AFFIRMER LE LIEN, PAS LE NIER — trouvé en vérifiant les correctifs :
      // « Savoir quels rôles n'ont pas de canal n'a rien à voir avec `communs` : ce champ répond
      // à une autre question » porte les mêmes jetons, dans le même ordre, sans un seul mot
      // permissif. Le sens était retourné et la sonde restait verte.
      const rupture = lien[0].match(/n['’]a rien à voir|aucun rapport|ne dit pas|ne renseigne pas|autre question|sans rapport/i);
      assert.ok(
        !rupture,
        `la phrase NIE le lien qu’elle doit établir (« ${rupture && rupture[0]} ») : « ${lien[0].trim()} »`,
      );
      // ⚠️ ET LA LISTE NOIRE NE SUFFIT PAS — c'est la seule porte de ce lot qu'on a jugée non
      // refermable par une liste d'interdits, et il faut le dire plutôt que de faire semblant.
      // L'INVERSION est affirmative : retirer le « n' » de « n'apparaissent pas » donne « sont
      // ceux qui apparaissent dans `communs` », qui est faux, qui garde tous les jetons dans le
      // même ordre, et qui ne porte aucune trace lexicale — ni mot permissif, ni mot de rupture.
      // Aucun interdit supplémentaire n'attrape cette classe.
      //
      // On renverse donc la charge : le motif exact est EXIGÉ plutôt que ses contraires
      // interdits. Retirer la négation casse alors le motif requis, au lieu de laisser passer
      // une affirmation fausse par défaut.
      //
      // ⚠️ CE QUE CETTE FORME COÛTE, et c'est assumé : une reformulation parfaitement légitime
      // de cette phrase fera rougir le test. C'est voulu — on préfère qu'une réécriture de la
      // phrase la plus importante du texte passe par une décision explicite.
      assert.match(
        lien[0],
        /n['’]apparaissent pas dans `communs`/i,
        'la phrase doit dire, dans ces termes, que les rôles sans canal sont ceux qui '
          + 'N’APPARAISSENT PAS dans `communs`. Le motif est exigé plutôt que son contraire interdit : '
          + 'l’inversion (« sont ceux qui apparaissent ») ne laisse aucune trace qu’une liste d’interdits '
          + 'puisse reconnaître. Si tu reformules cette phrase, mets à jour cette garde sciemment.',
      );

      // La seconde porte, et elle est structurelle plutôt que verbale : la table de lecture de
      // l'état doit dire, sur sa ligne `communs`, que ce champ porte les rôles. Une phrase se
      // réécrit ; une ligne de table qui perd son sens se voit.
      const lecture = tableDe(sectionDe(texte, /mesure/i, 'sur ce qu’elle mesure d’abord').corps);
      const iLu = lecture.entetes.findIndex((e) => /^Ce que tu lis$/.test(e));
      assert.ok(iLu !== -1, 'la table de lecture doit porter une colonne « Ce que tu lis »');
      const ligneCommuns = lecture.lignes.find((l) => /`communs`/.test(l[iLu]));
      assert.ok(ligneCommuns, 'la table de lecture doit porter une ligne pour le champ `communs`');
      assert.match(
        ligneCommuns.filter((_, i) => i !== iLu).join(' '),
        /r[ôo]le/i,
        '`communs` doit s’expliquer par les RÔLES qu’il porte — c’est ce qui rend les rôles manquants lisibles',
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
        // Le jeton du poste n'est pas dans la liste du ticket, et c'est justement pour ça qu'il
        // y est ici : c'est le refus qui arrive AVANT les quatre autres, sur le poste neuf que
        // cette compétence sert précisément à configurer.
        // Les deux sondes du trousseau sont DISJOINTES : « trousseau » apparaît sur les deux
        // lignes, donc en supprimer une laissait l'autre satisfaire la sonde — la garde ne
        // gardait alors qu'une ligne sur deux, sans le dire.
        ['le jeton qu’on n’a pas obtenu', /obtenu/i],
        // L'ENTRÉE VIDE A SA PROPRE LIGNE, et c'est la correction de la revue de fond : la
        // ligne du trousseau citait un fragment qui n'existe QUE dans les deux autres refus
        // (« aucune entrée n'a répondu », « la valeur n'a pas pu être obtenue »). Une entrée
        // qui EXISTE et qui est vide est un troisième cas, dont le geste diffère des deux
        // autres — on ne la dépose pas, on la remplace, et le message le dit exprès sans
        // proposer de commande.
        ['l’entrée vide', /vide/i],
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
    id: 'le-refus-se-relaie-tel-quel',
    quoi: 'le texte dit de RECOPIER le refus mesuré, et n’invite nulle part à le reformuler',
    verifier({ texte }) {
      // ⚠️ CE CONTRÔLE MANQUAIT, ET C'ÉTAIT LE DÉFAUT BLOQUANT DE LA REVUE DE FOND. La garde
      // voisine confronte les CITATIONS au code — elle ferme la porte de la citation fausse.
      // Elle ne dit rien de l'INSTRUCTION donnée au lecteur. Remplacer « Recopie-le tel quel »
      // par « Résume-le dans tes mots, ce sera plus clair » laissait tout vert, et rouvrait
      // très exactement T-20260811-0087 : c'est la reformulation qui a transformé « je n'ai pas
      // su lire l'entrée » en « le jeton n'est pas là », puis en une commande qui l'écrasait.
      //
      // LES DEUX SENS, parce qu'un seul ne couvre qu'une porte : l'injonction de relayer doit
      // être là, ET l'invitation à reformuler doit être absente. « Recopie-le, ou résume-le »
      // garderait le premier volet en rouvrant le défaut.
      const section = sectionDe(texte, /refuse/i, 'sur ce qui se passe quand elle refuse');
      assert.match(
        section.corps,
        /mesur[ée]/i,
        'le refus doit être présenté comme ce qui a été MESURÉ, jamais comme une conclusion',
      );
      assert.match(
        section.corps,
        /recopie-le/i,
        'le texte doit dire de RECOPIER le message de la commande, en toutes lettres',
      );
      // ⚠️ LA PREMIÈRE VERSION DE CETTE SONDE ÉTAIT UNE LISTE NOIRE ÉTROITE, et la vérification
      // des correctifs l'a contournée du premier coup : « Traduis-le dans tes propres mots si la
      // phrase brute te semble trop technique » gardait l'injonction de recopier, échappait aux
      // cinq expressions listées, et rouvrait le défaut en entier.
      //
      // On vise donc la FAMILLE, sur ses deux axes : le VERBE qui transforme un texte, et la
      // tournure « avec tes mots » sous toutes ses formes.
      //
      // ⚠️ CE QUE CETTE GARDE NE COUVRE PAS, et il faut le savoir avant de s'y fier : une
      // périphrase qui n'emploie aucun de ces verbes (« dis-lui l'essentiel », « garde ce qui
      // compte ») passerait. Aucune garde mécanique ne lit le sens. Celle-ci ferme la porte des
      // formulations qu'on écrit spontanément ; la relecture humaine reste requise.
      // ⚠️ ON EXCLUT LA NOMINALISATION, ON N'ÉNUMÈRE PAS LES CONJUGAISONS. Le problème d'origine
      // était un seul mot : « une reformulation remplace ce qui a été mesuré » — la phrase qui
      // EXPLIQUE le danger — que `\w*` prenait pour une prescription. La première correction a
      // répondu par une liste blanche de terminaisons, et cette liste a aussitôt laissé passer
      // le FUTUR : « tu le résumeras », « on le reformulera », « elle le traduira » — mêmes
      // verbes, temps non listé. Une liste de terminaisons doit couvrir deux groupes, deux
      // temps et six personnes ; elle oubliera toujours une case.
      //
      // On revient donc à `\w*` en excluant la seule vraie source du faux positif : le suffixe
      // `-ation(s)`. Une exclusion vaut mieux qu'une énumération quand ce qu'on veut attraper
      // est ouvert et ce qu'on veut écarter est fermé.
      const TRANSFORME = /\b(?:r[ée]sum|reformul|r[ée][ée]cri|tradui|paraphras|simplifi|clarifi|adapt|synth[ée]tis|abr[èe]g|condens|vulgaris)\w*(?<!ations?)(?:-(?:le|la|les|ça))?\b/i;
      const AVEC_TES_MOTS = /\b(?:tes|ses|vos|leurs|mes)\s+(?:propres\s+)?(?:mots|termes|phrases)\b/i;
      // La négation est TOLÉRÉE, et il le faut : le texte livré dit « Ne le reformule sous
      // aucune forme » — l'interdire reviendrait à interdire au texte de s'interdire.
      //
      // ⚠️ MAIS ELLE DOIT PORTER SUR CE VERBE-LÀ, DANS SA PROPOSITION. La version d'avant
      // regardait une fenêtre de 30 caractères à gauche, sans frontière grammaticale : « Sans
      // hésiter, traduis-le dans tes mots » satisfaisait la sonde par le « sans » d'une
      // proposition VOISINE, qui ne niait rien du tout. Une fenêtre de caractères n'est pas une
      // portée ; la proposition en est une.
      const NIE_EN_TETE = /^[^a-zà-ÿ]*(?:ne\b|n['’]|jamais\b|aucune?\b|sans\b|pas\b)/i;
      for (const [sonde, quoi] of [[TRANSFORME, 'un verbe qui transforme le texte'], [AVEC_TES_MOTS, '« avec tes mots »']]) {
        for (const proposition of section.corps.split(/[,;:—.\n]|\bmais\b|\bpuis\b|\bet\b|\bou\b/)) {
          const m = proposition.match(sonde);
          if (!m) continue;
          assert.ok(
            NIE_EN_TETE.test(proposition.trim()),
            `le texte invite à reformuler le refus — ${quoi} : « ${m[0]} », dans « ${proposition.trim()} ». `
              + 'Une reformulation remplace ce qui a été mesuré par ce qu’on en conclut.',
          );
        }
      }
      exigeImperatif(section.corps, 'la consigne de relais du refus');
    },
  },

  {
    id: 'aucune-action-pretee-au-robot',
    quoi: 'aucun geste tabulé ne fait faire au robot ce qu’il ne peut pas faire',
    verifier({ texte }) {
      // TROUVÉ EN REVUE DE FOND. La colonne du remède n'était confrontée à rien : « un humain
      // le crée dans Slack — notre robot ne crée aucun canal » pouvait devenir « notre robot
      // crée le canal lui-même au besoin » sans qu'un contrôle bronche. Ça contredit le code
      // (`conversations.join` répond `missing_scope`, mesuré le 2026-08-06) ET la section « ce
      // qu'elle ne fait jamais » du même fichier — le lecteur suivrait un geste qui n'existe pas
      // et attendrait un canal que personne ne crée.
      //
      // La garde est de POLARITÉ, pas de vocabulaire : toute phrase de la table qui parle du
      // robot doit le faire au NÉGATIF. C'est le seul mode sous lequel ces phrases sont vraies —
      // notre robot ne crée aucun canal, ne s'invite nulle part, ne désarchive rien.
      // Les quatre gestes qu'un robot ne peut PAS faire dans Slack, et eux seuls : dire qu'il
      // est membre d'un canal, ou qu'il ne l'est pas, reste une constatation légitime — c'est
      // l'ACTION qui lui est interdite, pas la mention.
      // ⚠️ LA PREMIÈRE VERSION CHERCHAIT UNE NÉGATION QUELQUE PART DANS LA CELLULE, et la
      // vérification des correctifs l'a contournée : « Notre robot ne rejoint aucun canal de
      // lui-même, il le crée automatiquement dès qu'il en a besoin » — la négation du PREMIER
      // verbe couvrait la cellule entière, et le second passait par ricochet, sujet devenu « il ».
      //
      // On découpe donc la cellule en PROPOSITIONS et on juge chacune séparément. Dans une
      // cellule qui parle du robot, toute proposition portant un de ces quatre verbes doit soit
      // le NIER, soit en attribuer explicitement l'action à un HUMAIN — les deux seules formes
      // sous lesquelles ces phrases sont vraies.
      const ACTIONS = /\b(?:cré(?:e|er|é|ent)|rejoin(?:t|dre|nent)|invite|désarchive)\w*/i;
      // ⚠️ POINT DE VIGILANCE, relevé en revue et assumé : cette négation-ci n'est PAS
      // positionnelle, contrairement à `NIE_EN_TETE` de la garde voisine — elle accepte le
      // marqueur n'importe où dans la proposition. Le découpage en propositions borne déjà la
      // portée, et aucune édition de bonne foi exploitant l'écart n'a été trouvée ; mais si
      // cette garde doit être renforcée un jour, c'est par là.
      const NEGATION = /\bne\s|\bn['’]|\baucun/i;
      // ⚠️ « HUMAIN » DOIT PRÉCÉDER LE VERBE, et pas seulement se trouver dans la proposition :
      // « notre robot crée le canal lui-même comme le ferait un humain » contient le mot sans
      // en faire l'agent — c'est une comparaison, et elle affirme exactement le contraire. La
      // co-présence ne dit rien de qui fait l'action ; l'ordre, si.
      const HUMAIN = /\bhumain\b[^.;—]{0,30}?\b(?:le\s+|l['’]y\s+|les\s+)?(?:cré|rejoin|invite|désarchive)/i;
      const { table } = tableDesRefus(texte);
      for (const ligne of table.lignes) {
        for (const cellule of ligne) {
          if (!/robot/i.test(cellule)) continue;
          // `et`/`ou` COMPTENT COMME SÉPARATEURS, et c'est précisément ce qui manquait : la
          // mutation qui a contourné la première version n'avait pas de virgule — « ne rejoint
          // aucun canal de lui-même ET il le crée automatiquement » tenait en une seule
          // proposition, donc la négation du premier verbe couvrait le second.
          for (const proposition of cellule.split(/[,;—.]|\bmais\b|\bpuis\b|\bet\b|\bou\b/)) {
            if (!ACTIONS.test(proposition)) continue;
            assert.ok(
              NEGATION.test(proposition) || HUMAIN.test(proposition),
              `une proposition de la table prête une action à notre robot sans la nier ni la donner `
                + `à un humain : « ${proposition.trim()} » (dans « ${cellule} »). Il ne crée aucun canal, `
                + 'ne rejoint aucun canal de lui-même et ne désarchive rien.',
            );
          }
        }
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

      // ⚠️ LA SONDE PAR MOT-CLÉ NE FERMAIT RIEN, et la revue de fond l'a prouvé : « Tu peux
      // relancer la désignation pour être sûr que rien n'a changé, ça ne coûte rien » garde le
      // mot-clé « pour être sûr » et enseigne exactement le geste que la compétence existe pour
      // supprimer. Une édition d'une seule phrase, parfaitement plausible.
      //
      // On garde donc la MODALITÉ de la phrase, sur ses deux portes : elle doit INTERDIRE, et
      // elle ne doit pas permettre.
      //
      // ⚠️ TOUTES LES OCCURRENCES, PAS LA PREMIÈRE — et c'est le défaut exact que la
      // vérification des correctifs a prouvé. `match()` sans `/g` ne rend que la première : la
      // phrase d'origine, celle qui interdit, satisfaisait le contrôle, et il suffisait
      // d'AJOUTER plus loin « Si le doute persiste, relance la désignation pour être sûr : ça
      // ne fait de mal à personne » pour que la permission coexiste avec son interdiction, sans
      // que rien ne l'inspecte. Un correctif qui ne couvre qu'une occurrence sur deux.
      //
      // ⚠️ LE SÉLECTEUR À QUATRE EXPRESSIONS ÉTAIT LUI-MÊME LA PORTE : « Relance-la quand même,
      // ça ne mange pas de pain » n'en portait aucune, donc n'était jamais inspectée. On élargit
      // aux tournures qui présentent un geste comme sans conséquence — c'est ça, la famille —,
      // et on ajoute une seconde porte : toute phrase qui parle de relancer ou de redésigner,
      // HORS de la section des refus (où relancer après correction est le geste normal), doit
      // obliger.
      //
      // ⚠️ CE QUE CETTE GARDE NE COUVRE PAS : une permission écrite dans un vocabulaire qu'on
      // n'a pas prévu (« vas-y, c'est indolore ») passerait. C'est la limite de toute sonde
      // lexicale ; la relecture humaine reste requise sur ce point précis.
      const PRUDENCE = /par prudence|pour être sûr|ça ne coûte rien|ne fait de mal à personne|ne mange pas de pain|sans risque|quand même|au pire|indolore/i;
      const phrases = dehors.split(/(?<=\.)\s+/).filter((p) => PRUDENCE.test(p));
      assert.ok(
        phrases.length > 0,
        'le texte doit fermer la porte du « je relance pour être sûr » — c’est le geste qui use le poste',
      );
      for (const p of phrases) {
        assert.match(
          p,
          /ne le fais (?:jamais|pas)|ne relance (?:jamais|pas)|ne red[ée]signe (?:jamais|pas)|jamais « pour être sûr »/i,
          `redésigner par prudence doit être INTERDIT partout où on en parle, pas seulement la première fois : « ${p.trim()} »`,
        );
        exigeImperatif(p, 'l’interdiction de redésigner par prudence');
      }
      // La seconde porte : hors de la section des refus, aucune phrase qui parle de relancer ou
      // de redésigner ne doit se relâcher. Dans la section des refus, relancer APRÈS avoir
      // corrigé est le geste attendu — l'y interdire ferait rougir un texte juste.
      const sectionRefus = sectionDe(texte, /refuse/i, 'sur ce qui se passe quand elle refuse');
      const horsRefus = horsBlocs(texte.replace(sectionRefus.corps, '')).replace(/\s+/g, ' ');
      for (const p of horsRefus.split(/(?<=\.)\s+/).filter((x) => /\b(?:relanc|red[ée]sign)\w*/i.test(x))) {
        exigeImperatif(p, 'une phrase qui parle de relancer ou de redésigner');
      }
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
    id: 'refus-du-jeton-perdu',
    quoi: 'la table perd le refus du trousseau — le premier que rencontre un poste neuf',
    cible: 'chaque-refus-est-cite-mot-pour-mot',
    muter: (t) => t.replace(/^\| `au trousseau de ce poste`[^\n]*\n/m, ''),
  },
  {
    id: 'refus-de-lentree-vide-perdu',
    quoi: 'la table perd l’entrée qui existe et qui est vide — un troisième cas, un autre geste',
    cible: 'chaque-refus-est-cite-mot-pour-mot',
    muter: (t) => t.replace(/^\| `existe au trousseau sous le compte`[^\n]*\n/m, ''),
  },
  {
    id: 'refus-reformule-en-supposition',
    quoi: 'le texte invite à résumer le refus dans ses mots — le défaut bloquant de la revue de fond',
    cible: 'le-refus-se-relaie-tel-quel',
    muter: (t) => remplacer(t, '**Recopie-le tel\nquel.**', '**Résume-le dans tes mots**, ce sera plus clair.'),
  },
  {
    id: 'relais-du-refus-assoupli',
    quoi: 'recopier le refus devient facultatif',
    cible: 'le-refus-se-relaie-tel-quel',
    muter: (t) => remplacer(t, 'Ne le reformule sous aucune forme', 'Tu peux le reformuler si tu le souhaites'),
  },
  {
    id: 'le-robot-cree-le-canal',
    quoi: 'un geste tabulé fait créer le canal par notre robot — ce qu’il ne peut pas faire',
    cible: 'aucune-action-pretee-au-robot',
    muter: (t) =>
      remplacer(
        t,
        "s'il n'existe pas, un humain le crée dans Slack — notre robot ne crée aucun canal",
        "s'il n'existe pas, notre robot le crée lui-même dans Slack",
      ),
  },
  {
    id: 'la-mesure-nie-ce-quelle-apprend',
    quoi: 'le texte affirme que l’état ne dit pas quels rôles restent — et invite à tout redésigner',
    cible: 'l-etat-se-mesure-avant-de-designer',
    muter: (t) =>
      t.replace(
        /\*\*Les rôles qui n'ont pas de canal[\s\S]*?un copier-coller\./,
        'L’état ne te dit **jamais** quels rôles restent à désigner — tu peux tous les redésigner par prudence.',
      ),
  },
  {
    id: 'redesigner-par-prudence-autorise',
    quoi: 'relancer « pour être sûr » devient permis — le geste qui use le poste',
    cible: 'l-idempotence-oblige',
    muter: (t) =>
      remplacer(
        t,
        'Mais ne le fais jamais « pour être sûr » :\nsur un rôle déjà pourvu du bon canal, tu n\'as rien à faire.',
        'Tu peux relancer la désignation pour être sûr que rien n\'a changé, ça ne coûte rien.',
      ),
  },
  // ═══ LES QUATRE MUTATIONS QUI ONT CONTOURNÉ LA PREMIÈRE VERSION DES CORRECTIFS.
  //
  // Elles sont reprises ici TELLES QUELLES, plutôt que résumées : c'est la seule façon qu'un
  // correctif futur ne rouvre pas la porte qu'elles ont trouvée. Chacune était verte.
  {
    id: 'refus-traduit-en-mots-plus-simples',
    quoi: 'le texte fait « traduire » le refus dans ses propres mots — la liste noire étroite était contournée',
    cible: 'le-refus-se-relaie-tel-quel',
    muter: (t) =>
      remplacer(
        t,
        'Ne le reformule sous aucune forme',
        'Traduis-le dans tes propres mots si la phrase brute te semble trop technique',
      ),
  },
  {
    id: 'le-robot-cree-apres-avoir-nie-rejoindre',
    quoi: 'une négation couvre le premier verbe, le second passe par ricochet avec « il » pour sujet',
    cible: 'aucune-action-pretee-au-robot',
    muter: (t) =>
      remplacer(
        t,
        "s'il n'existe pas, un humain le crée dans Slack — notre robot ne crée aucun canal",
        "notre robot ne rejoint aucun canal de lui-même et il le crée automatiquement dès qu'il en a besoin",
      ),
  },
  {
    id: 'le-lien-des-roles-est-nie',
    quoi: 'la phrase garde ses jetons et leur ordre, et nie le lien qu’elle établissait',
    cible: 'l-etat-se-mesure-avant-de-designer',
    muter: (t) =>
      t.replace(
        /\*\*Les rôles qui n'ont pas de canal[\s\S]*?un copier-coller\./,
        "Savoir quels rôles n'ont pas de canal n'a rien à voir avec `communs` : ce champ répond à une autre question.",
      ),
  },
  {
    id: 'une-seconde-permission-plus-loin',
    quoi: 'l’interdiction reste, et une permission est AJOUTÉE plus bas — jamais inspectée',
    cible: 'l-idempotence-oblige',
    muter: (t) =>
      remplacer(
        t,
        '## Si elle refuse',
        'Si le doute persiste, relance la désignation pour être sûr : ça ne fait de mal à personne.\n\n## Si elle refuse',
      ),
  },
  // ═══ ET LES QUATRE DU SECOND TOUR — celles qui ont contourné la première correction.
  //
  // Trois d'entre elles sont des AJOUTS PURS : rien n'est retiré du texte, une phrase est
  // glissée à côté. C'est la forme la plus difficile à voir en relecture, et celle qu'une garde
  // qui n'inspecte que « la » phrase attendue ne peut pas attraper.
  {
    id: 'sans-hesiter-traduis-le',
    quoi: 'une invitation ajoutée dont le « sans » d’à côté satisfaisait la fenêtre de négation',
    cible: 'le-refus-se-relaie-tel-quel',
    muter: (t) =>
      remplacer(
        t,
        'et c\'est exactement ainsi qu\'un refus se met à mentir.',
        'et c\'est exactement ainsi qu\'un refus se met à mentir. Sans hésiter, traduis-le dans tes mots pour que ce soit plus limpide.',
      ),
  },
  {
    id: 'le-refus-resume-au-futur',
    quoi: 'le même verbe, au futur — le temps qu’une liste de terminaisons oublie toujours',
    cible: 'le-refus-se-relaie-tel-quel',
    muter: (t) =>
      remplacer(
        t,
        'et c\'est exactement ainsi qu\'un refus se met à mentir.',
        'et c\'est exactement ainsi qu\'un refus se met à mentir. Si le message te semble confus, tu le résumeras avant de le montrer.',
      ),
  },
  {
    id: 'le-robot-cree-comme-un-humain',
    quoi: '« humain » présent dans la proposition, mais en comparaison — le robot reste l’agent',
    cible: 'aucune-action-pretee-au-robot',
    muter: (t) =>
      remplacer(
        t,
        "s'il n'existe pas, un humain le crée dans Slack — notre robot ne crée aucun canal",
        "s'il n'existe pas, notre robot crée le canal lui-même comme le ferait un humain",
      ),
  },
  {
    id: 'le-lien-des-roles-inverse',
    quoi: 'un seul « n’ » retiré : le lien devient faux en gardant tous ses jetons dans l’ordre',
    cible: 'l-etat-se-mesure-avant-de-designer',
    muter: (t) => remplacer(t, "ceux qui n'apparaissent pas dans `communs`", 'ceux qui apparaissent dans `communs`'),
  },
  {
    id: 'permission-sans-marqueur-connu',
    quoi: 'une permission ajoutée sans aucun des marqueurs de prudence surveillés',
    cible: 'l-idempotence-oblige',
    muter: (t) =>
      remplacer(
        t,
        '## Si elle refuse',
        'Relance-la quand même, ça ne mange pas de pain.\n\n## Si elle refuse',
      ),
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

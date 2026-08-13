// La onzième règle du représentant — « ne jamais créer de danger chez le client » — et les
// mutations qui mettent ses gardes à l'épreuve.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EST À CÔTÉ DE `metier-representant.js`, ET NON DEDANS
//
// `metier-representant.js` est un harnais PARTAGÉ : d'autres chantiers s'en servaient au
// moment où celui-ci a été écrit, et le brief de T-20260813-0061 l'a mis hors d'atteinte —
// « sers-t'en, ne le modifie pas ». Ses fonctions de lecture de structure (`sectionDe`,
// `tableDe`, `colonneDe`, `exigeImperatif`, `permuter`…) sont donc IMPORTÉES telles quelles,
// et seuls les contrôles et mutations propres à cette règle vivent ici.
//
// Même contrat qu'elles, et pour la même raison : ces contrôles sont exécutés sur le gabarit
// RÉEL (ils doivent passer) ET sur des versions RETOURNÉES du gabarit (au moins un doit
// rougir, pour chacune). Sans cette seconde exécution, un contrôle décoratif reste vert pour
// toujours et personne ne le sait.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUE CETTE RÈGLE A DE PARTICULIER, ET CE QUE LES GARDES DOIVENT DONC VOIR
//
// La règle a un contraire NON ÉVIDENT. « Le problème remonte au dirigeant avant d'être dit
// au client » se retourne de deux façons, et une seule saute aux yeux :
//
//   • L'INVERSION D'ORDRE — « informe le client, puis remonte » — est le contresens visible.
//     Elle est gardée par le RANG des trois gestes, jamais par une phrase.
//
//   • LA SUPPRESSION DE LA CONTREPARTIE — on retire la remontée immédiate et son échéance —
//     ne ressemble à rien : le texte continue de dire « remonte d'abord ». Il enseigne
//     pourtant l'inverse de ce qui est demandé, puisqu'une remontée sans date est une
//     permission de se taire, et qu'un client sans réponse est un autre échec. Elle est
//     gardée par le COMPTE des gestes, l'unicité de l'échéance et sa MODALITÉ.
//
// Un troisième retournement compte autant, et il est propre à l'urgence : lu vite, le texte
// devient une permission d'attendre pendant qu'un client perd ses données. D'où
// `exigeImmediat` ci-dessous — la modalité du DÉLAI, là où `exigeImperatif` ne garde que
// celle de l'OBLIGATION. Les deux sont nécessaires : « tu remontes en fin de journée »
// oblige toujours, et a perdu la garantie.

// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUE CES CONTRÔLES NE COUVRENT PAS, ET IL FAUT LE SAVOIR AVANT DE LIRE LEUR VERT
//
// Ils lisent les SECTIONS QU'ILS NOMMENT, jamais le document entier. Une exception plantée
// ailleurs — « sauf pour dépanner », glissée dans « Le ton » ou dans les anti-patterns —
// contredirait la règle sans faire rougir personne. La revue indépendante l'a exécuté :
// tout est resté vert.
//
// C'est assumé plutôt que corrigé. Garder le document entier contre toute permission
// contradictoire demanderait de lire le sens de chaque phrase, ce qu'aucune sonde ne fait ;
// et le harnais partagé a exactement la même portée. Mais la limite est écrite ici pour que
// personne ne lise ce vert comme « le gabarit ne peut plus autoriser de danger ».

import assert from 'node:assert/strict';

import {
  sectionDe,
  tableDe,
  colonne,
  etapesDe,
  pucesDe,
  exigeImperatif,
  permuter,
} from './metier-representant.js';

// ═════════════════════════════════════════ la modalité du délai

/**
 * Tournures qui repoussent un geste que la règle veut immédiat.
 *
 * L'oubli du négatif serait fatal ici : le gabarit REJETTE nommément ces tournures
 * (« pas en fin de journée, pas quand tu en sauras plus »). Une sonde naïve rougirait donc
 * sur le texte correct, et on la « corrigerait » en la supprimant. Les occurrences précédées
 * d'une négation sont donc ignorées.
 */
const DIFFERE = /(?<!pas )(?<!ni )(?<!jamais )\b(?:en fin de journée|quand tu en sauras plus|plus tard|le moment venu|quand tu auras le temps|une fois que tout sera clair)\b/i;

/** Exige qu'un énoncé se fasse maintenant, plutôt qu'à un moment repoussé. */
export function exigeImmediat(enonce, quoi) {
  const repousse = enonce.match(DIFFERE);
  assert.ok(
    !repousse,
    `« ${quoi} » a été repoussé (« ${repousse && repousse[0]} ») : la règle perd sa contrepartie `
      + `dès que la remontée peut attendre — « ${enonce.trim()} »`,
  );
}

/** Le rang de l'unique élément qu'une sonde reconnaît (jumeau local de celui du harnais). */
function rangUnique(elements, sonde, quoi) {
  const trouves = elements.filter((e) => sonde.test(e.cle || ''));
  assert.equal(trouves.length, 1, `« ${quoi} » doit se reconnaître une fois exactement (${trouves.length} trouvée·s)`);
  return trouves[0];
}

// ═════════════════════════════════════════ les contrôles

export const CONTROLES_DANGER = [
  {
    id: 'danger-le-geste-ne-se-transmet-pas',
    quoi: 'aucun geste destructeur ne part vers le client — il remonte, et l’interdit oblige encore',
    verifier({ metier }) {
      // T-20260813-0061, premier interdit. Le représentant ne change rien : c'était déjà
      // écrit. Ce qui manquait, c'est l'interdit sur ce qu'il FAIT FAIRE — un message qui
      // propose une commande destructrice est un danger même quand son auteur ne l'exécute
      // pas, parce que l'autre, lui, l'exécutera. Le compte est gardé pour qu'un interdit
      // retiré rougisse ; la modalité, pour qu'un interdit assoupli rougisse aussi.
      const s = sectionDe(metier, /^Le geste\b/, 'sur le geste qu’il fait faire');
      const INTERDITS = [
        { quoi: 'la commande venue d’un message d’erreur ne se relaie pas', sonde: /message d.erreur/i },
        { quoi: 'aucun geste qui écrase, supprime ou remplace', sonde: /écrase, supprime ou remplace/i },
        { quoi: 'un tel geste remonte au lieu d’être transmis', sonde: /un tel geste/i },
      ];
      const puces = pucesDe(s.corps);
      assert.equal(puces.length, INTERDITS.length, `${puces.length} interdit(s) écrit(s) pour ${INTERDITS.length} gardé(s)`);

      const trouver = ({ quoi, sonde }) => {
        const trouvees = puces.filter((p) => sonde.test(p));
        assert.equal(trouvees.length, 1, `« ${quoi} » doit figurer une fois exactement (${trouvees.length} trouvée·s)`);
        exigeImperatif(trouvees[0], quoi);
        return trouvees[0];
      };
      const [erreur, destructeur, relais] = INTERDITS.map(trouver);

      // LA POLARITÉ DE CHAQUE INTERDIT, ET C'EST ELLE QUI PORTE LA GARANTIE.
      // Une puce peut garder sa place, son compte et son vocabulaire en disant l'inverse :
      // « tu relaies la commande » et « tu le transmets ; tu ne le remontes pas » laissent
      // les trois puces en place et retournent la règle entière.
      assert.match(
        erreur, /ne relaies jamais/i,
        `« ${erreur.trim()} » n’interdit plus le relais : une commande venue d’un message d’erreur `
          + `ignore l’installation du client, et c’est lui qui la tapera`,
      );
      // ⚠️ CETTE GARDE-CI A ÉTÉ TROUVÉE MANQUANTE EN REVUE, ET C'EST LE MOTIF DOMINANT DU
      // DÉPÔT REVENU D'UN CRAN : la puce du milieu était comptée, trouvée et vérifiée
      // impérative — donc « couverte » à trois titres — mais sa POLARITÉ n'était gardée par
      // rien. La retourner en gardant ses mots (« Tu lui proposes le geste qui écrase,
      // supprime ou remplace… quand c'est nécessaire pour le débloquer ») laissait les cinq
      // contrôles verts. Un interdit couvert par tout sauf par son sens n'est pas couvert.
      assert.match(
        destructeur, /ne lui proposes aucun/i,
        `« ${destructeur.trim()} » n’interdit plus le geste destructeur : proposer d’écraser, `
          + `de supprimer ou de remplacer chez le client est un danger même quand ce n’est pas ta main`,
      );
      assert.match(relais, /tu le remontes/i, `« ${relais.trim()} » : un geste dangereux doit REMONTER`);
      assert.match(
        relais, /ne le transmets pas/i,
        `« ${relais.trim()} » : le geste dangereux doit cesser de descendre vers le client — c’est l’interdit lui-même`,
      );
    },
  },

  {
    id: 'danger-le-probleme-remonte-avant-d-etre-dit',
    quoi: 'remonter au dirigeant précède de parler au client — et le constat n’autorise pas à informer',
    verifier({ metier }) {
      // LE CONTRESENS VISIBLE : « informe le client, puis remonte ». Gardé par le RANG des
      // gestes, jamais par une phrase — permuter deux libellés en gras ne change pas un mot
      // du vocabulaire de la section.
      const s = sectionDe(metier, /^La parole\b/, 'sur la parole vers le client');
      const etapes = etapesDe(s.corps).map((e) => ({ ...e, cle: e.libelle }));
      assert.ok(etapes.length >= 3, `la conduite doit être une suite d’au moins 3 gestes (${etapes.length})`);
      for (const e of etapes) assert.ok(e.libelle, `le geste ${e.rang} n’a pas de libellé en gras — son rang serait illisible`);

      const remonter = rangUnique(etapes, /remontes au dirigeant/i, 'remonter au dirigeant');
      const parler = rangUnique(etapes, /parles au client/i, 'parler au client');
      assert.ok(
        remonter.rang < parler.rang,
        `remonter au dirigeant (rang ${remonter.rang}) doit précéder la parole au client (rang ${parler.rang}) — `
          + `l’ordre inverse fait du représentant le porte-parole de nos problèmes chez le client`,
      );

      // LE RANG NE SUFFIT PAS : un geste peut garder sa place et cesser d'obliger.
      for (const e of etapes) exigeImperatif(e.enonce, `geste ${e.rang} de la conduite face à un problème`);

      // Et la prémisse, sans laquelle l'ordre n'a plus d'objet : CONSTATER n'autorise pas à
      // informer. La retourner (« t'autorise à l'en informer ») laisserait les trois gestes
      // intacts et rendrait la suite facultative dans les faits.
      assert.match(
        s.corps, /ne t.autorise pas/i,
        'la section doit dire que constater une situation problématique n’autorise PAS à en informer le client',
      );
    },
  },

  {
    id: 'danger-la-contrepartie-tient',
    quoi: 'la remontée est immédiate, porte une échéance, et l’échéance dit ce qui sera dit au client',
    verifier({ metier }) {
      // LE RETOURNEMENT INVISIBLE, et c'est celui qui coûterait le plus cher : on retire la
      // remontée immédiate et son échéance, le texte continue de dire « remonte d'abord »,
      // et la règle est devenue une permission de se taire. Un client laissé sans réponse
      // est un autre échec, pas une réussite prudente (règle 4 de D-20260812-0001, appliquée
      // aux problèmes plutôt qu'aux questions).
      const s = sectionDe(metier, /^La parole\b/, 'sur la parole vers le client');
      const etapes = etapesDe(s.corps);

      const remontees = etapes.filter((e) => /remontes au dirigeant/i.test(e.libelle || ''));
      assert.equal(remontees.length, 1, `la remontée doit être un geste nommé une fois exactement (${remontees.length} trouvée·s)`);
      assert.match(
        remontees[0].enonce, /au moment du constat/i,
        `« ${remontees[0].enonce.trim()} » ne dit plus QUAND remonter : sans « au moment du constat », `
          + `la remontée se fait quand on a le temps, c’est-à-dire trop tard`,
      );
      exigeImmediat(remontees[0].enonce, 'la remontée au dirigeant');

      const echeances = etapes.filter((e) => /échéance/i.test(e.enonce));
      assert.equal(
        echeances.length, 1,
        `l’échéance est la CONTREPARTIE de la règle : elle doit être un geste à part entière, `
          + `nommé une fois exactement (${echeances.length} trouvée·s). Sans elle, la remontée s’endort `
          + `et le client reste sans réponse.`,
      );
      exigeImperatif(echeances[0].enonce, 'l’échéance portée par la remontée');
      exigeImmediat(echeances[0].enonce, 'l’échéance portée par la remontée');

      // Et l'échéance doit se RÉSOUDRE VERS LE CLIENT. Une échéance purement interne
      // (« je relance le dirigeant ») laisse le client exactement où la règle silencieuse
      // l'aurait laissé : sans réponse.
      assert.match(
        echeances[0].enonce, /sans réponse[\s\S]*au client/i,
        `« ${echeances[0].enonce.trim()} » ne dit pas ce qui est dit AU CLIENT faute de réponse — `
          + `une échéance qui ne se résout pas vers lui ne rattrape rien`,
      );
    },
  },

  {
    id: 'danger-l-urgence-ne-devient-jamais-une-attente',
    quoi: 'client déjà en danger : la remontée devient immédiate et prioritaire, et jamais une attente',
    verifier({ metier }) {
      // Le garde-fou du ticket, écrit noir sur blanc : « sinon la règle sera lue comme une
      // permission d'attendre ». Les deux formulations sont données côte à côte, marquées
      // ✅ et ❌ ; permuter les deux marques ferait recommander l'attente pendant qu'un
      // client perd ses données. On apparie donc chaque marque à ce qu'elle qualifie.
      const s = sectionDe(metier, /déjà en danger/i, 'sur le client déjà en danger');
      const citations = s.corps.split('\n').filter((l) => /^>\s*[✅❌]/.test(l));
      assert.equal(citations.length, 2, `les deux conduites doivent être données côte à côte (${citations.length} trouvée·s)`);

      const bonne = citations.filter((l) => l.includes('✅'));
      const mauvaise = citations.filter((l) => l.includes('❌'));
      assert.equal(bonne.length, 1, 'une seule conduite recommandée');
      assert.equal(mauvaise.length, 1, 'une seule conduite proscrite');

      assert.match(bonne[0], /immédiatement/i, 'la conduite recommandée est de remonter immédiatement');
      assert.match(bonne[0], /priorité/i, 'et en priorité — avant ce qui est en cours');
      assert.ok(
        !/\b(?:patiente|patienter|attends|attendre)\b/i.test(bonne[0]),
        `« ${bonne[0].trim()} » recommande d’attendre alors qu’un client subit un danger réel`,
      );
      assert.match(mauvaise[0], /\b(?:patiente|patienter|attends|attendre)\b/i, 'la conduite proscrite est d’attendre la décision');
      assert.ok(
        !/immédiatement/i.test(mauvaise[0]),
        `« ${mauvaise[0].trim()} » proscrit la remontée immédiate — les deux marques sont inversées`,
      );

      assert.match(
        s.corps, /jamais une attente/i,
        'la section doit dire explicitement que la remontée ne devient jamais une attente',
      );

      // ET LA PROMESSE D'IMMÉDIATETÉ DOIT DÉSIGNER UN CHEMIN QUI ATTEINT QUELQU'UN.
      // Contradiction relevée en revue : le gabarit dit deux sections plus haut qu'une note
      // sur la demande « ne prévient personne ». Une urgence remontée par ce seul chemin,
      // en croyant avoir remonté immédiatement, laisse le client dans son danger — le
      // contresens exact, obtenu sans toucher à un seul mot de cette section.
      assert.match(
        s.corps, /Comment tu remontes/,
        'le cas d’urgence doit renvoyer au chemin de remontée, sinon « immédiatement » ne désigne aucun geste',
      );
      assert.match(
        s.corps, /n.est pas une notification/i,
        'et il doit rappeler qu’une note sur la demande ne prévient personne — sans quoi l’urgence s’arrête à une inscription',
      );

      // ⚠️ ET C'EST ICI QUE LES DEUX ASSERTIONS CI-DESSUS NE SUFFISENT PAS.
      //
      // Elles gardent une PRÉSENCE : elles voient le retrait de la phrase, jamais son
      // assouplissement. La seconde revue l'a exécuté — « l'orchestrateur du chantier en
      // cours d'abord, SI L'IDÉE TE VIENT » gardait les deux phrases, les deux mots-clés,
      // et rendait facultatif le seul chemin qui prévienne une personne. C'est le motif
      // dominant du dépôt rouvert d'un cran, dans le correctif du cran précédent.
      //
      // On garde donc la CLAUSE elle-même, sur deux axes : sa modalité (elle ordonne, elle
      // ne suggère pas, et elle ne se conditionne pas) et sa position (le chemin qui atteint
      // quelqu'un vient AVANT le chemin qui n'atteint personne).
      const chemin = s.corps.split('\n').find((l) => /prends le chemin/i.test(l));
      assert.ok(chemin, 'la clause qui désigne le chemin de remontée en urgence a disparu');

      const priorite = chemin.split(/(?<=\.)\s/)[0];
      exigeImperatif(priorite, 'la clause qui désigne le chemin de remontée en urgence');
      assert.ok(
        !/\b(?:si|lorsque|éventuellement|dans la mesure)\b/i.test(priorite),
        `« ${priorite.trim()} » conditionne le chemin prioritaire : une priorité qui dépend d’une `
          + `condition n’en est plus une, et le mot « d’abord » y survit intact`,
      );

      const iAtteint = chemin.search(/orchestrateur/i);
      const iInscrit = chemin.search(/sur la demande/i);
      assert.ok(iAtteint >= 0 && iInscrit >= 0, 'les deux chemins de remontée doivent être nommés tous les deux');
      assert.ok(
        iAtteint < iInscrit,
        'le chemin qui ATTEINT quelqu’un doit être donné avant celui qui ne prévient personne — '
          + 'l’ordre inverse envoie l’urgence vers une note que personne ne lira',
      );

      exigeImperatif(s.corps, 'la conduite quand le client est déjà en danger');
    },
  },

  {
    id: 'danger-anti-patterns-nommes',
    quoi: 'les trois fautes de cette règle sont nommées comme des fautes, du côté de ce qu’on ne fait pas',
    verifier({ metier }) {
      // Retirer discrètement une ligne d'une table d'anti-patterns est le mode de régression
      // le plus silencieux d'un document : rien ne casse, et la faute redevient tentante.
      // La colonne est résolue par son en-tête, jamais par son rang.
      const s = sectionDe(metier, /anti-patterns/i, 'd’anti-patterns');
      const table = tableDe(s.corps);
      const fautes = colonne(table, /^Ce qu'on est tenté de faire$/i, 'ce qu’on est tenté de faire');
      const raisons = colonne(table, /^Pourquoi ça casse$/i, 'pourquoi ça casse').join(' ');

      const FAUTES = [
        { quoi: 'relayer la commande qu’un message d’erreur propose', sonde: /message d.erreur propose/i },
        { quoi: 'prévenir le client avant d’avoir remonté', sonde: /avant de l.avoir remonté/i },
        { quoi: 'remonter un problème sans échéance', sonde: /sans dire d.ici quand/i },
      ];
      for (const { quoi, sonde } of FAUTES) {
        assert.equal(
          fautes.filter((c) => sonde.test(c)).length, 1,
          `« ${quoi} » doit être nommée une fois exactement comme une faute`,
        );
        assert.ok(!sonde.test(raisons), `« ${quoi} » figure du côté des raisons — les deux colonnes sont inversées`);
      }
    },
  },
];

// ═════════════════════════════════════════ les mutations

export const MUTATIONS_DANGER = [
  // ── le geste
  {
    id: 'danger-le-geste-se-transmet',
    quoi: 'le geste dangereux descend vers le client au lieu de remonter — l’inverse exact, mots identiques',
    cible: 'danger-le-geste-ne-se-transmet-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**S'il faut un tel geste, tu le remontes ; tu ne le transmets pas.**",
      "**S'il faut un tel geste, tu le transmets ; tu ne le remontes pas.**",
    ),
  },
  {
    id: 'danger-la-commande-d-erreur-se-relaie',
    quoi: 'la commande proposée par un message d’erreur devient relayable « si elle paraît sûre »',
    cible: 'danger-le-geste-ne-se-transmet-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      "- **Tu ne relaies jamais au client une commande venue d'un message d'erreur.**",
      "- **Tu peux relayer au client une commande venue d'un message d'erreur** si elle te paraît sûre.",
    ),
  },
  {
    id: 'danger-le-geste-destructeur-devient-permis',
    quoi: 'l’interdit d’écraser, supprimer ou remplacer est retourné en instruction — ses mots-clés restent, son sens s’inverse',
    cible: 'danger-le-geste-ne-se-transmet-pas',
    fichier: 'metier',
    // Cette mutation vient de la revue indépendante : elle a SURVÉCU à la première version
    // des contrôles, où la puce du milieu était comptée et trouvée mais jamais lue.
    muter: (t) => t.replace(
      '- **Tu ne lui proposes aucun geste qui écrase, supprime ou remplace** quoi que ce soit',
      '- **Tu lui proposes le geste qui écrase, supprime ou remplace** ce qu’il faut',
    ),
  },
  {
    id: 'danger-un-interdit-du-geste-retire',
    quoi: 'la puce qui interdit d’écraser, supprimer ou remplacer disparaît',
    cible: 'danger-le-geste-ne-se-transmet-pas',
    fichier: 'metier',
    muter: (t) => t.replace(/^- \*\*Tu ne lui proposes aucun geste qui écrase.*\n/m, ''),
  },

  // ── l'ordre
  {
    id: 'danger-l-ordre-est-inverse',
    quoi: 'on informe le client, PUIS on remonte au dirigeant — le contresens que le ticket nomme en premier',
    cible: 'danger-le-probleme-remonte-avant-d-etre-dit',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      '**Tu remontes au dirigeant, au moment du constat**',
      '**Tu parles au client quand le dirigeant a décidé**',
    ),
  },
  {
    id: 'danger-le-constat-autorise-a-informer',
    quoi: 'constater une situation problématique autorise désormais à en informer le client',
    cible: 'danger-le-probleme-remonte-avant-d-etre-dit',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**ne t'autorise pas à l'en informer.**",
      "**t'autorise à l'en informer sans attendre.**",
    ),
  },

  // ── la contrepartie
  {
    id: 'danger-la-contrepartie-disparait',
    quoi: 'l’échéance disparaît : la remontée n’a plus de date, et la règle devient une permission de se taire',
    cible: 'danger-la-contrepartie-tient',
    fichier: 'metier',
    muter: (t) => t.replace(/^2\. \*\*Tu poses une échéance dans la même remontée\*\*.*\n/m, ''),
  },
  {
    id: 'danger-l-echeance-devient-facultative',
    quoi: 'l’échéance garde son geste et son rang, mais cesse d’obliger',
    cible: 'danger-la-contrepartie-tient',
    fichier: 'metier',
    muter: (t) => t.replace(
      "C'est la contrepartie de la règle, et elle n'est pas négociable :",
      'Tu peux la poser quand le sujet te paraît sensible :',
    ),
  },
  {
    id: 'danger-la-remontee-est-repoussee',
    quoi: 'la remontée se fait en fin de journée, le temps d’en savoir plus — elle oblige encore, et ne garantit plus rien',
    cible: 'danger-la-contrepartie-tient',
    fichier: 'metier',
    muter: (t) => t.replace(
      "1. **Tu remontes au dirigeant, au moment du constat** — pas en fin de journée, pas quand tu en sauras plus.",
      "1. **Tu remontes au dirigeant en fin de journée** — le temps d'en savoir plus.",
    ),
  },
  {
    id: 'danger-l-echeance-ne-se-resout-plus-vers-le-client',
    quoi: 'l’échéance devient une relance interne : le dirigeant est rappelé, le client reste sans réponse',
    cible: 'danger-la-contrepartie-tient',
    fichier: 'metier',
    muter: (t) => t.replace(
      "« sans réponse d'ici <la date>, voici ce que je dis au client »",
      '« sans réponse d\'ici <la date>, je relance le dirigeant »',
    ),
  },

  // ── l'urgence
  {
    id: 'danger-l-urgence-devient-une-attente',
    quoi: 'les marques ✅ et ❌ sont permutées — patienter pendant qu’un client perd ses données devient recommandé',
    cible: 'danger-l-urgence-ne-devient-jamais-une-attente',
    fichier: 'metier',
    muter: (t) => permuter(t, "> ✅ « C'est grave et ça court", "> ❌ « C'est grave, donc je patiente"),
  },
  {
    id: 'danger-l-urgence-s-arrete-a-une-inscription',
    quoi: 'l’urgence se remonte par une note sur la demande — que le gabarit dit lui-même ne prévenir personne',
    cible: 'danger-l-urgence-ne-devient-jamais-une-attente',
    fichier: 'metier',
    muter: (t) => t.replace(
      /^\*\*Et prends le chemin qui atteint réellement quelqu'un\*\*.*$/m,
      '**Écris-le sur la demande** : quelqu’un finira par le lire.',
    ),
  },
  {
    id: 'danger-le-chemin-d-urgence-devient-facultatif',
    quoi: 'le seul chemin qui prévienne une personne devient « si l’idée te vient » — mots-clés intacts, priorité perdue',
    cible: 'danger-l-urgence-ne-devient-jamais-une-attente',
    fichier: 'metier',
    // Posée par la seconde revue : elle a survécu aux gardes de PRÉSENCE qui la précédaient.
    muter: (t) => t.replace(
      "l'orchestrateur du chantier en cours d'abord, parce que c'est le seul qui prévienne une personne.",
      "l'orchestrateur du chantier en cours d'abord, si l'idée te vient.",
    ),
  },
  {
    id: 'danger-le-chemin-d-urgence-est-inverse',
    quoi: 'l’urgence part d’abord vers la note que personne ne lit, et l’orchestrateur ne vient qu’ensuite',
    cible: 'danger-l-urgence-ne-devient-jamais-une-attente',
    fichier: 'metier',
    muter: (t) => t.replace(
      "celui de « Comment tu remontes », plus haut : l'orchestrateur du chantier en cours d'abord, parce que c'est le seul qui prévienne une personne. S'il n'y a aucun chantier en route, tu écris sur la demande,",
      "celui de « Comment tu remontes », plus haut : tu écris sur la demande d'abord, parce que ça survit à ta session. S'il y a un chantier en route, tu préviens ensuite son orchestrateur,",
    ),
  },
  {
    id: 'danger-le-cas-d-urgence-disparait',
    quoi: 'le cas du client déjà en danger n’est plus écrit — la règle se lit alors comme une permission d’attendre',
    cible: 'danger-l-urgence-ne-devient-jamais-une-attente',
    fichier: 'metier',
    muter: (t) => t.replace(/\n#### Quand le client est déjà en danger[\s\S]*?(?=\n## )/, ''),
  },

  // ── les anti-patterns
  {
    id: 'danger-un-anti-pattern-retire',
    quoi: 'la faute « prévenir le client avant d’avoir remonté » disparaît de la table',
    cible: 'danger-anti-patterns-nommes',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| Prévenir le client d'un problème avant de l'avoir remonté \|.*\n/m, ''),
  },
];

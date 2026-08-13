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
//
// DEUX AUTRES LIMITES CONNUES, trouvées en revue et laissées ouvertes en connaissance de
// cause plutôt que refermées par une garde qui ferait semblant :
//
//   • LA COLONNE « POURQUOI ÇA CASSE » DES ANTI-PATTERNS n'est gardée que par sa polarité
//     (les fautes ne s'y trouvent pas). Remplacer une raison par « ce n'est pas idéal, mais
//     ça arrive parfois » passe : vider une explication n'est pas un contresens détectable
//     par appariement, et une garde de longueur ne prouverait que la longueur.
//
//   • UNE JUSTIFICATION SÉMANTIQUEMENT VIDE mais syntaxiquement correcte (« d'abord, parce
//     que c'est ainsi ») passe la garde de forme du chemin d'urgence. Vérifier qu'une raison
//     justifie vraiment demande de lire, pas d'apparier.
//
// Ce qui est gardé ici est ce qui a été retourné au moins une fois, en vrai. Le reste du
// texte est écrit, pas gardé — et c'est le décompte qu'il faut lire, jamais « le gabarit est
// sûr ».

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

/**
 * Réserves qui vident une obligation sans la contredire : conditions et exceptions.
 *
 * `exigeImperatif` (harnais partagé) garde la modalité de l'OBLIGATION — « tu peux »,
 * « facultatif ». Elle ne voit ni « si tu juges que c'est nécessaire », ni « dans la mesure
 * du possible », ni « sauf si le client insiste » : trois tournures qui laissent l'énoncé
 * impératif et le rendent inapplicable. Les trois ont été posées en revue, les trois ont
 * survécu.
 *
 * ⚠️ CE QUE CETTE LISTE EST, ET CE QU'ELLE N'EST PAS. C'est une liste FINIE contre un
 * phénomène OUVERT — le français a plus de façons d'atténuer qu'on n'en énumérera. Là où
 * une forme positive existait (la clause du chemin d'urgence, plus bas), elle a été
 * préférée. Ici, aucune forme unique ne couvre six énoncés rédigés librement : on garde
 * donc les tournures connues, et la limite est écrite plutôt que passée sous silence.
 */
const RESERVE = /\bsi tu (?:juges|estimes|penses|le sens)\b|\bdans la mesure\b|\bsauf si\b|\bsauf lorsque\b|\bà moins que\b|\bautant que possible\b|\bsi possible\b|\bidéalement\b|\ben principe\b|\bquand (?:tu peux|tu y penses|c.est possible)\b|\blorsque tu\b/i;

/** Exige qu'un énoncé oblige SANS réserve : ni condition, ni exception. */
export function exigeSansReserve(enonce, quoi) {
  exigeImperatif(enonce, quoi);
  const reserve = enonce.match(RESERVE);
  assert.ok(
    !reserve,
    `« ${quoi} » a pris une réserve (« ${reserve && reserve[0]} ») : l’énoncé oblige encore et `
      + `ne s’applique plus que quand celui qui le lit veut bien — « ${enonce.trim()} »`,
  );
}

/** Un énoncé débarrassé de ses citations : ce que le gabarit AFFIRME, hors formules citées. */
const horsCitations = (enonce) => enonce.replace(/«[^»]*»/g, ' ');

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
        // SANS RÉSERVE, et pas seulement impératif : « Sauf si le client insiste
        // explicitement, auquel cas le geste devient acceptable » a survécu en revue. Un
        // interdit qui admet une exception n'est plus un interdit — et l'exception qui
        // vient toujours est justement celle-là, puisque c'est le client qui insiste.
        exigeSansReserve(trouvees[0], quoi);
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

      // LE RANG NE SUFFIT PAS : un geste peut garder sa place, obliger encore, et ne
      // s'appliquer que quand celui qui le lit veut bien (« si tu juges que c'est
      // nécessaire », « dans la mesure du possible »). Les deux ont survécu en revue.
      for (const e of etapes) exigeSansReserve(e.enonce, `geste ${e.rang} de la conduite face à un problème`);

      // ET RIEN NE PARLE AU CLIENT AVANT LE GESTE QUI LE PRÉVOIT.
      //
      // La mutation la plus grave trouvée en revue ne touchait ni au rang, ni à la modalité :
      // elle GREFFAIT sur le premier geste « et tu donnes tout de suite un premier mot au
      // client pour qu'il ne s'inquiète pas ». Le texte muté se contredisait à trois lignes
      // d'écart — « ne t'autorise pas à l'en informer », puis un geste qui informe — et
      // l'ordre, le compte et la modalité restaient intacts. On garde donc que les gestes
      // ANTÉRIEURS à la parole ne s'adressent pas au client. Les formules CITÉES sont
      // retirées d'abord : l'échéance en contient une, légitimement (elle dit ce qui sera
      // dit au client PLUS TARD, elle ne le dit pas maintenant).
      for (const e of etapes.filter((x) => x.rang < parler.rang)) {
        const affirme = horsCitations(e.enonce);
        assert.ok(
          !/\bau client\b/i.test(affirme),
          `le geste ${e.rang} s’adresse au client alors qu’il précède la parole : « ${affirme.trim()} ». `
            + `Tant que le dirigeant n’a pas décidé, rien ne part vers le client — c’est la règle elle-même.`,
        );
      }

      // Et la prémisse, sans laquelle l'ordre n'a plus d'objet : CONSTATER n'autorise pas à
      // informer. La retourner (« t'autorise à l'en informer ») laisserait les trois gestes
      // intacts et rendrait la suite facultative dans les faits.
      assert.match(
        s.corps, /ne t.autorise pas/i,
        'la section doit dire que constater une situation problématique n’autorise PAS à en informer le client',
      );

      // LA FRONTIÈRE AVEC « TENIR LE CLIENT INFORMÉ », relevée en revue comme une zone grise
      // réelle : dire qu'un chantier bute reste le travail du représentant, en dire la cause
      // ne l'est pas. Sans cette phrase, un agent en situation doit deviner laquelle des deux
      // sections s'applique. Gardée dans son ORDRE : ce qui est permis d'abord, ce qui est
      // interdit ensuite — l'inverser (« jamais que ça attend, seulement pourquoi ») est le
      // contresens, et il garde tous les mots.
      assert.match(
        s.corps, /que ça attend[^.]*jamais pourquoi/i,
        'la section doit dire ce qui reste dicible pendant l’attente — que ça attend — et ce qui ne l’est '
          + 'pas — pourquoi —, dans cet ordre, sans quoi la frontière avec « tenir le client informé » se devine',
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
      // La contrepartie garde la modalité de SES DEUX gestes, même si l'ordre des gestes la
      // garde aussi : c'est ici qu'elle a un sens (« si tu juges que c'est nécessaire »
      // annule la remontée immédiate, pas l'ordre), et une garantie ne doit pas dépendre
      // d'un contrôle voisin qui pourrait changer de portée demain.
      exigeSansReserve(remontees[0].enonce, 'la remontée au dirigeant');

      const echeances = etapes.filter((e) => /échéance/i.test(e.enonce));
      assert.equal(
        echeances.length, 1,
        `l’échéance est la CONTREPARTIE de la règle : elle doit être un geste à part entière, `
          + `nommé une fois exactement (${echeances.length} trouvée·s). Sans elle, la remontée s’endort `
          + `et le client reste sans réponse.`,
      );
      exigeSansReserve(echeances[0].enonce, 'l’échéance portée par la remontée');
      exigeImmediat(echeances[0].enonce, 'l’échéance portée par la remontée');

      // Et l'échéance doit se RÉSOUDRE VERS LE CLIENT. Une échéance purement interne
      // (« je relance le dirigeant ») laisse le client exactement où la règle silencieuse
      // l'aurait laissé : sans réponse.
      const resolution = echeances[0].enonce.match(/sans réponse(.*?)au client/i);
      assert.ok(
        resolution,
        `« ${echeances[0].enonce.trim()} » ne dit pas ce qui est dit AU CLIENT faute de réponse — `
          + `une échéance qui ne se résout pas vers lui ne rattrape rien`,
      );
      // ET ELLE SE RÉSOUT EN PAROLE, PAS EN SILENCE. Trouvé en revue : « sans réponse d'ici
      // <la date>, JE NE DIS TOUJOURS RIEN au client » satisfaisait la garde précédente mot
      // pour mot. C'est le contresens que le ticket nomme en toutes lettres — « la règle
      // devient une permission de se taire » — arrivé par la seule porte que la garde
      // laissait ouverte : elle exigeait que le client soit nommé, jamais qu'on lui parle.
      assert.ok(
        !/\b(?:ne|rien|jamais|aucun)\b/i.test(resolution[1]),
        `« ${echeances[0].enonce.trim()} » : à l’échéance, la résolution est NÉGATIVE — le client `
          + `est nommé et rien ne lui est dit. L’échéance doit dire ce qu’on LUI DIT faute de réponse, `
          + `sans quoi elle n’est qu’un délai avant le même silence.`,
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

      // ⚠️ POURQUOI UNE FORME ATTENDUE ICI, ET NON UNE LISTE DE MOTS INTERDITS.
      //
      // La version précédente bannissait quatre connecteurs conditionnels (« si »,
      // « lorsque »…). La revue a trouvé la sortie en une passe : « d'abord, IDÉALEMENT »,
      // « d'abord, quand tu y penses », « d'abord, une fois que tu as un instant » — aucun
      // mot de la liste, la priorité devenue un souhait, tout vert. Le français a plus
      // d'adverbes d'atténuation qu'une liste n'en contiendra jamais : bannir un à un est un
      // puits sans fond, et chaque tour donne l'illusion d'avoir refermé la porte.
      //
      // On inverse donc la garde : au lieu d'énumérer ce qui est REFUSÉ, on exige la FORME
      // ACCEPTÉE. La clause nomme le chemin prioritaire, puis dit POURQUOI il l'est — rien
      // d'autre ne s'attache à « d'abord ». Toute atténuation, connue ou non, échoue par
      // construction, puisqu'elle n'est pas une justification.
      //
      // Contrepartie assumée : une reformulation légitime qui abandonnerait le « parce que »
      // rougira. C'est voulu — cette clause porte le seul chemin qui prévienne une personne
      // pendant qu'un client perd ses données, et le message ci-dessous dit quelle forme
      // reprendre.
      assert.match(
        priorite, /d.abord\s*(?:,\s*(?:parce qu|car\b|puisqu|étant donné)|\s*[:—–])/i,
        `« ${priorite.trim()} » : ce qui suit « d’abord » n’est pas une justification. La clause `
          + `doit nommer le chemin prioritaire PUIS dire pourquoi il l’est — par « parce que », `
          + `« car », « puisque », « étant donné que », un deux-points ou un tiret explicatif. `
          + `Toute autre suite — « idéalement », « quand tu y penses », « si l’idée te vient » — `
          + `transforme une priorité en souhait en gardant le mot « d’abord » intact.`,
      );

      // ET LA JUSTIFICATION NE DOIT PAS NIER CE QU'ELLE JUSTIFIE.
      //
      // Trouvé par la revue contre la version précédente : « d'abord, PARCE QUE ÇA NE PRESSE
      // PAS » respecte la forme à la lettre et retire l'urgence. La forme dit qu'une raison
      // est donnée ; elle ne dit rien de ce que cette raison affirme. On garde donc aussi la
      // MODALITÉ DU DÉLAI sur toute la section — dont le sujet entier est le contraire d'un
      // délai, ce qui rend tout vocabulaire d'ajournement contradictoire par construction.
      //
      // ⚠️ CE QUI RESTE OUVERT, ET IL FAUT LE SAVOIR AVANT DE LIRE CE VERT. Une justification
      // syntaxiquement correcte et sémantiquement vide — « d'abord, parce que c'est ainsi » —
      // passe, et aucune sonde ne l'en empêchera : vérifier qu'une raison justifie vraiment
      // demande de lire, pas d'apparier. Ce qui est gardé ici : la priorité est énoncée, elle
      // est motivée, et rien dans la section ne la reporte. Pas davantage.
      exigeImmediat(s.corps, 'la conduite quand le client est déjà en danger');
      const nieUrgence = s.corps.match(/\b(?:ne presse pas|n.est pas urgent|peut attendre|rien ne presse|sans urgence)\b/i);
      assert.ok(
        !nieUrgence,
        `la section du client déjà en danger contient « ${nieUrgence && nieUrgence[0]} » : sa raison d’être `
          + `est que rien n’attend. Une justification qui nie l’urgence retire la priorité qu’elle prétend motiver.`,
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
    id: 'danger-l-interdit-du-geste-admet-une-exception',
    quoi: 'l’interdit du geste destructeur accepte « sauf si le client insiste » — c’est-à-dire le cas qui arrive',
    cible: 'danger-le-geste-ne-se-transmet-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      '- **Tu ne lui proposes aucun geste qui écrase, supprime ou remplace** quoi que ce soit',
      '- **Tu ne lui proposes aucun geste qui écrase, supprime ou remplace** quoi que ce soit, sauf si le client insiste explicitement',
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

  {
    id: 'danger-un-premier-mot-part-avant-la-decision',
    quoi: 'le premier geste greffe « tu donnes tout de suite un premier mot au client » — le texte se contredit à trois lignes d’écart',
    cible: 'danger-le-probleme-remonte-avant-d-etre-dit',
    fichier: 'metier',
    // La plus grave des cinq trouvées par la revue indépendante : ni le rang, ni le compte,
    // ni la modalité ne bougent — la parole part quand même avant la décision.
    muter: (t) => t.replace(
      'Tu dis ce que tu as mesuré, et **séparément** ce qui reste incertain.',
      'Tu dis ce que tu as mesuré, et **séparément** ce qui reste incertain, et tu donnes tout de suite un premier mot au client pour qu’il ne s’inquiète pas.',
    ),
  },
  {
    id: 'danger-la-frontiere-du-dicible-est-inversee',
    quoi: 'pendant l’attente, on dit le pourquoi et jamais que ça attend — la frontière avec « tenir le client informé » retournée',
    cible: 'danger-le-probleme-remonte-avant-d-etre-dit',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Et pendant que tu attends la décision : tu peux lui dire que ça attend, jamais pourquoi.**',
      '**Et pendant que tu attends la décision : tu peux lui dire pourquoi, jamais que ça attend.**',
    ),
  },

  // ── la contrepartie
  {
    id: 'danger-la-remontee-devient-conditionnelle',
    quoi: 'la remontée ne se fait plus que « si tu juges que c’est nécessaire » — impérative, et inapplicable',
    cible: 'danger-la-contrepartie-tient',
    fichier: 'metier',
    muter: (t) => t.replace(
      '1. **Tu remontes au dirigeant, au moment du constat**',
      '1. **Tu remontes au dirigeant, si tu juges que c’est nécessaire, au moment du constat**',
    ),
  },
  {
    id: 'danger-l-echeance-devient-une-intention',
    quoi: 'l’échéance se pose « dans la mesure du possible » — la contrepartie survit en mots et disparaît en fait',
    cible: 'danger-la-contrepartie-tient',
    fichier: 'metier',
    muter: (t) => t.replace(
      '2. **Tu poses une échéance dans la même remontée**',
      '2. **Tu poses, dans la mesure du possible, une échéance dans la même remontée**',
    ),
  },
  {
    id: 'danger-l-echeance-se-resout-en-silence',
    quoi: 'à l’échéance, « je ne dis toujours rien au client » — le client est nommé, et rien ne lui est dit',
    cible: 'danger-la-contrepartie-tient',
    fichier: 'metier',
    muter: (t) => t.replace(
      "« sans réponse d'ici <la date>, voici ce que je dis au client »",
      '« sans réponse d\'ici <la date>, je ne dis toujours rien au client »',
    ),
  },
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
    id: 'danger-le-chemin-d-urgence-devient-un-souhait',
    quoi: 'la priorité devient « idéalement » — un seul adverbe, aucun connecteur conditionnel, la priorité s’efface',
    cible: 'danger-l-urgence-ne-devient-jamais-une-attente',
    fichier: 'metier',
    // La plus nette des quatre trouvées par la seconde revue contre la liste de mots
    // interdits (« idéalement », « quand tu y penses », « quand l'occasion se présente »,
    // « une fois que tu as un instant »). Elles échouent toutes désormais par la même
    // garde de forme ; celle-ci est posée pour que la garde ne puisse pas y revenir.
    muter: (t) => t.replace(
      "l'orchestrateur du chantier en cours d'abord, parce que c'est le seul qui prévienne une personne.",
      "l'orchestrateur du chantier en cours d'abord, idéalement.",
    ),
  },
  {
    id: 'danger-l-urgence-se-justifie-par-l-absence-d-urgence',
    quoi: 'la justification respecte la forme et retire l’urgence — « d’abord, parce que ça ne presse pas »',
    cible: 'danger-l-urgence-ne-devient-jamais-une-attente',
    fichier: 'metier',
    // Posée par la revue contre la garde de forme : elle en respectait la lettre entière.
    muter: (t) => t.replace(
      "l'orchestrateur du chantier en cours d'abord, parce que c'est le seul qui prévienne une personne.",
      "l'orchestrateur du chantier en cours d'abord, parce que ça ne presse pas.",
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

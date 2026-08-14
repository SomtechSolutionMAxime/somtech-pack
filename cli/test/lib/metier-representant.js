// Les contrôles du métier du représentant, et les mutations qui les mettent à l'épreuve.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER N'EST PAS UN TEST
//
// Il est importé par DEUX suites qui ne demandent pas la même chose aux mêmes contrôles :
//
//   • `representant-gabarit.test.js` les exécute sur le gabarit RÉEL — ils doivent passer ;
//   • `representant-mutations.test.js` les exécute sur des versions RETOURNÉES du gabarit —
//     au moins un doit rougir, pour chacune.
//
// Sans cette séparation, un contrôle décoratif reste vert pour toujours et personne ne le
// sait. C'est très exactement le défaut qui a dominé le chantier D-20260805-0005 : six fois
// sur neuf, la garde vérifiait ce que le texte CONTENAIT, pas ce qu'il FAISAIT. Le pire cas
// y a survécu au remplacement de la phrase gardée par son contresens exact — le mot y était
// encore, le test est resté vert, le comportement était inversé.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LA RÈGLE D'ÉCRITURE D'UN CONTRÔLE, ET ELLE A ÉTÉ CORRIGÉE UNE FOIS
//
// Un contrôle ne cherche JAMAIS la présence d'une phrase. Il porte sur :
//
//   • la POLARITÉ  — de quel côté d'une table une affirmation vit, la colonne étant
//     désignée par SON LIBELLÉ D'EN-TÊTE et jamais par son rang ;
//   • la POSITION  — à quel rang d'une suite ordonnée une étape se trouve ;
//   • la MODALITÉ  — l'énoncé est-il impératif, ou s'est-il assoupli en recommandation ;
//   • le COMPTE    — combien d'interdits sont écrits pour combien de gardés.
//
// ⚠️ LE PIÈGE QUI A ÉTÉ TROUVÉ EN REVUE, ET QUI VAUT D'ÊTRE RACONTÉ.
//
// La première version de ces contrôles lisait la polarité à l'INDEX de la colonne : « la
// faisabilité doit être dans la colonne 1 ». `tableDe` jetait l'en-tête, considéré comme du
// décor. Or c'est le libellé d'en-tête qui donne un sens à l'index — et lui seul.
//
// Conséquence : permuter deux libellés d'en-tête, UNE ligne, sans déplacer une seule
// cellule, retournait la frontière de l'engagement ET les réflexes anti-biais. Le gabarit
// muté enseignait que le prix, le délai et « est-ce possible ? » se répondent seul, et que
// « oui, c'est possible » est ce qu'on dit à la place de la complaisance. Zéro contrôle
// rougissait.
//
// C'était le motif dominant du chantier, remonté d'un cran : la garde ne cherchait plus des
// mots, mais elle vérifiait OÙ le texte est sans lire CE QU'IL DIT. Une table markdown dont
// on permute les en-têtes en oubliant de déplacer les cellules est par ailleurs l'édition à
// moitié faite la plus banale qui soit.
//
// D'où `colonneDe`, ci-dessous : aucun index de colonne n'est jamais écrit en dur.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // cli/test/lib
export const REPO = resolve(HERE, '..', '..', '..');

/** Le lieu d'où le pack distribue les gabarits du représentant (module `core`). */
export const GABARIT_DIR = join('.claude', 'templates', 'gestionnaire-client');
export const CHEMIN_METIER = join(GABARIT_DIR, 'CLAUDE.md');
export const CHEMIN_CONTEXTE = join(GABARIT_DIR, 'CONTEXTE.md');

/** Les deux gabarits, lus depuis une racine (le dépôt par défaut, ou un paquet construit). */
export function lireGabarits(racine = REPO) {
  return {
    metier: readFileSync(join(racine, CHEMIN_METIER), 'utf8'),
    contexte: readFileSync(join(racine, CHEMIN_CONTEXTE), 'utf8'),
  };
}

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

/** La section dont le titre répond à la sonde. Échoue si elle manque — un contrôle qui ne
 *  trouve pas son terrain ne doit jamais passer en silence. */
export function sectionDe(texte, sonde, quoi) {
  const s = sections(texte).find((x) => sonde.test(x.titre));
  assert.ok(s, `le gabarit doit porter une section ${quoi}`);
  return s;
}

/**
 * Une table markdown lue AVEC son en-tête : `{ entetes, lignes }`.
 *
 * L'en-tête n'est pas du décor : c'est la seule chose qui donne un sens aux colonnes.
 * L'avoir jeté est le défaut que la revue de la PR #180 a trouvé — voir l'avertissement en
 * tête de fichier. Il est désormais rendu, et `colonneDe` oblige à s'en servir.
 */
export function tableDe(corps) {
  const rangees = corps
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((c) => !c.every((x) => /^:?-{2,}:?$/.test(x)));
  assert.ok(rangees.length >= 2, 'une table doit porter un en-tête et au moins une ligne');
  return { entetes: rangees[0], lignes: rangees.slice(1) };
}

/**
 * L'index de la colonne dont le LIBELLÉ D'EN-TÊTE répond à la sonde.
 *
 * Échoue si aucune n'y répond, ou si plusieurs y répondent — même contrat que `rangUnique` :
 * une désignation ambiguë rendrait l'assertion de polarité ininterprétable, donc inutile.
 *
 * C'est ce qui rend la permutation de deux en-têtes détectable : le contrôle suit le sens,
 * pas la géométrie. Permuter les libellés déplace l'index que cette fonction renvoie, et
 * les cellules restées en place se retrouvent alors du mauvais côté.
 *
 * ⚠️ LA SONDE DOIT COUVRIR LE LIBELLÉ ENTIER — et cette exigence est le quatrième tour du
 * même motif, trouvé en seconde revue.
 *
 * La version précédente reconnaissait la colonne à un MOT-CLÉ contenu dans son libellé :
 * `/remontes/i` pour « Tu remontes au dirigeant ». Six reformulations gardaient le mot-clé
 * en retournant le sens, et passaient toutes :
 *
 *     « Tu remontes au dirigeant SI TU AS UN DOUTE »   ← l'obligation devient une option
 *     « Ce que tu NE dis JAMAIS à la place »           ← la colonne des réponses s'inverse
 *     « Tu NE remontes RIEN »                          ← l'inverse exact, mot-clé intact
 *
 * On était revenu, un cran plus bas, à garder par la présence d'un mot. Une sonde non
 * ancrée est donc refusée ici même : l'ancrage n'est pas une convention d'écriture, c'est
 * la garantie elle-même. Et le libellé retenu doit ENCORE OBLIGER — un en-tête peut être
 * exact et s'être assoupli (« Ta posture, quand tu as le temps »).
 */
export function colonneDe(table, sonde, quoi) {
  assert.ok(
    sonde.source.startsWith('^') && sonde.source.endsWith('$'),
    `la sonde de la colonne « ${quoi} » n'est pas ancrée (${sonde}) : une sonde qui cherche `
      + `un mot-clé dans le libellé accepte « ${quoi} si tu as un doute » ou sa négation, `
      + `qui gardent le mot et retournent le sens. Ancrer sur le libellé ENTIER (^…$).`,
  );

  const trouves = table.entetes
    .map((libelle, i) => ({ libelle, i }))
    .filter(({ libelle }) => sonde.test(libelle));
  assert.equal(
    trouves.length, 1,
    `la colonne « ${quoi} » doit se reconnaître une fois exactement à son en-tête `
      + `(${trouves.length} trouvée·s parmi : ${table.entetes.map((e) => `« ${e} »`).join(', ')})`,
  );

  exigeImperatif(trouves[0].libelle, `l'en-tête de colonne « ${trouves[0].libelle} »`);
  return trouves[0].i;
}

/** Les cellules d'une colonne désignée par son en-tête. */
export function colonne(table, sonde, quoi) {
  const i = colonneDe(table, sonde, quoi);
  return table.lignes.map((l) => l[i] ?? '');
}

/** Les étapes d'une suite numérotée, avec leur rang et leur libellé en gras. */
export function etapesDe(corps) {
  return [...corps.matchAll(/^(\d+)\.\s+(.+)$/gm)].map((m) => ({
    rang: Number(m[1]),
    enonce: m[2],
    libelle: (m[2].match(/\*\*(.+?)\*\*/) || [])[1] || null,
  }));
}

/** Les puces de premier niveau d'un corps de section. */
export const pucesDe = (corps) => corps.split('\n').filter((l) => /^-\s+\S/.test(l));

/** Le contenu des blocs de commandes. */
export const blocsBash = (texte) => [...texte.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);

/** L'avertissement de tête d'un gabarit : ses lignes de citation, avant la première section. */
export function enteteDe(texte) {
  const avant = texte.split(/^##\s/m)[0];
  return avant.split('\n').filter((l) => l.trim().startsWith('>')).map((l) => l.trim());
}

/**
 * Tournures qui transforment une obligation en suggestion.
 *
 * La MODALITÉ est le troisième axe, après la polarité et la position, et il manquait. Un
 * énoncé peut garder sa place, sa colonne et son rang tout en cessant d'obliger : « ouvre ta
 * ligne » reste l'étape 2, mais devient « tu peux aussi le faire après si ça presse ».
 * Le rang est nécessaire ; il n'est pas suffisant.
 *
 * ⚠️ DEUX FAMILLES, ET LA SECONDE MANQUAIT — relevée en revue de fond du lot T-20260813-0043.
 *
 * La PERMISSION (« tu peux », « facultatif ») dit que l'obligation n'en est pas une. L'EXCEPTION
 * (« sauf si… », « si tu en as le temps ») la laisse debout et lui ouvre une porte — ce qui la
 * vide tout aussi bien, en ayant l'air de la respecter. Trois altérations mesurées passaient
 * la garde : « son propre ticket, **avant** de le faire, SI TU EN AS LE TEMPS », « … n'a pas de
 * ticket propre, SAUF si le dirigeant en demande un », « … jamais le geste — SAUF décision
 * contraire ponctuelle ». Aucune n'est une permission ; toutes rendent la consigne inopérante.
 *
 * Une TROISIÈME famille est arrivée par la contre-vérification du même lot : la NÉCESSITÉ niée
 * (« même si ce n'est pas strictement nécessaire tout de suite »), qui ne demande ni permission
 * ni exception — elle nie simplement que la consigne s'applique maintenant.
 *
 * ⚠️ CE QUE CETTE GARDE NE PEUT PAS FAIRE, ET IL FAUT LE SAVOIR AVANT DE S'Y FIER.
 *
 * C'est une LISTE DE VOCABULAIRE, donc finie par construction : elle attrape les tournures
 * connues, jamais « toute façon d'assouplir une consigne ». Deux idiomes usuels lui ont échappé
 * jusqu'à ce qu'un reviewer les pose (« à moins que », « pas strictement nécessaire ») et il en
 * reste. Elle vaut comme filet sur la MODALITÉ ; elle ne remplace pas la polarité et la position,
 * qui, elles, ne dépendent d'aucun vocabulaire.
 *
 * ⚠️ PAS DE `\b` DEVANT UNE INITIALE ACCENTUÉE. En JavaScript, `à` n'est pas un caractère de mot :
 * `\bà moins que` ne s'apparie JAMAIS, et l'alternative serait morte-née — vraie par construction,
 * donc invisible. Le piège est le jumeau exact de celui documenté sur `privé\b` plus bas, et il
 * a été attrapé ici par une mutation, pas par une relecture.
 */
export const PERMISSIF = /\btu peux\b|\bfacultati|\boptionnel|\bpas obligatoire\b|\bsi (?:tu le souhaites|ça presse|celui-ci presse)\b|\bau besoin\b|\bde préférence\b|\bsauf\b|à moins que\b|\bsi tu (?:en )?as le temps\b|\bsi le temps le permet\b|\bsi possible\b|\bdans la mesure du possible\b|à ta discrétion\b|\bpas (?:strictement )?(?:nécessaire|indispensable|essentiel)\b|évite(?:r)? (?:de|d.|que)|en évitant|essaie(?:r)? (?:de|d.)|tâche(?:r)? de|efforce-toi/i;

/** Exige qu'un énoncé oblige, plutôt qu'il ne recommande. */
export function exigeImperatif(enonce, quoi) {
  const relache = enonce.match(PERMISSIF);
  assert.ok(
    !relache,
    `« ${quoi} » s'est assoupli en recommandation (« ${relache && relache[0]} ») : `
      + `sa place ne suffit pas, une consigne qui se contente de conseiller se relâche — « ${enonce.trim()} »`,
  );
}

/**
 * Le rang de l'unique élément qu'une sonde reconnaît.
 * Échoue si la sonde n'en reconnaît aucun, ou plus d'un — une sonde ambiguë rendrait
 * l'assertion de position ininterprétable, donc inutile.
 */
function rangUnique(elements, sonde, quoi) {
  const trouves = elements.filter((e) => sonde.test(e.cle || ''));
  assert.equal(trouves.length, 1, `« ${quoi} » doit se reconnaître une fois exactement (${trouves.length} trouvée·s)`);
  return trouves[0];
}

// ═════════════════════════════════════════ les contrôles

/**
 * Chaque contrôle : { id, quoi, verifier({ metier, contexte }) } — jette si la garantie
 * n'est plus tenue. Ils sont exécutés tels quels sur le gabarit réel ET sur ses mutants.
 */
export const CONTROLES = [
  {
    id: 'ordre-ouverture',
    quoi: 'se rendre joignable vient AVANT de relever, qui vient avant de parler — et chaque étape oblige',
    verifier({ metier }) {
      // T-20260806-0192 : un représentant a relevé l'historique avant d'ouvrir sa ligne.
      // Pendant ce temps on lui a écrit quatre fois, et rien n'est arrivé. L'ordre est le
      // livrable ; une consigne qui le RECOMMANDE sans que rien ne le garde se relâche.
      const s = sectionDe(metier, /ordre d.ouverture/i, 'sur l’ordre d’ouverture');
      const etapes = etapesDe(s.corps).map((e) => ({ ...e, cle: e.libelle }));
      assert.ok(etapes.length >= 4, `l’ordre doit être une suite d’au moins 4 étapes (${etapes.length})`);
      for (const e of etapes) assert.ok(e.libelle, `l’étape ${e.rang} n’a pas de libellé en gras — son rang serait illisible`);

      const contexte = rangUnique(etapes, /CONTEXTE\.md/, 'lire son contexte');
      // T-20260814-0033 : l'étape 2 ouvre désormais LES DEUX lignes. Le libellé le dit, et
      // c'est voulu — le rang seul ne prouverait pas que la seconde y est.
      const ouvrir = rangUnique(etapes, /ouvre tes deux lignes/i, 'ouvrir ses deux lignes');
      const relever = rangUnique(etapes, /relève/i, 'relever');
      const parler = rangUnique(etapes, /parle/i, 'parler');

      assert.ok(contexte.rang < ouvrir.rang, `le contexte (rang ${contexte.rang}) donne le canal : il se lit avant d’ouvrir (rang ${ouvrir.rang})`);
      assert.ok(ouvrir.rang < relever.rang, `ouvrir sa ligne (rang ${ouvrir.rang}) doit précéder le relèvement (rang ${relever.rang})`);
      assert.ok(relever.rang < parler.rang, `relever (rang ${relever.rang}) doit précéder la parole (rang ${parler.rang})`);

      // LE RANG NE SUFFIT PAS. Une étape peut garder sa place et cesser d'obliger — c'est
      // le relâchement que ce document redoute explicitement, et il ne coûte qu'une
      // incise. On garde donc aussi la modalité de chaque étape.
      for (const e of etapes) exigeImperatif(e.enonce, `étape ${e.rang} de l’ordre d’ouverture`);

      // Et la condition d'arrêt : sans ligne installée, le représentant naîtrait muet en
      // croyant parler. Elle vient du métier d'origine (section « Prérequis ») et avait
      // été perdue au déplacement.
      assert.match(
        s.corps, /arrête-toi/i,
        'l’ordre d’ouverture doit dire de s’arrêter quand la ligne de discussion n’est pas installée',
      );
    },
  },

  {
    id: 'anti-complaisance-en-tete',
    quoi: 'l’anti-complaisance ouvre les réflexes, et le « oui c’est possible » vit sous l’en-tête « ce que la pression fait dire »',
    verifier({ metier }) {
      // Le réflexe qui compte le plus pour un agent face à un client : il insiste, l'agent
      // veut plaire, et le « oui c'est possible » sort tout seul.
      const s = sectionDe(metier, /réflexes/i, 'sur les réflexes');
      const table = tableDe(s.corps);
      assert.ok(table.lignes.length >= 4, `les réflexes doivent être énumérés (${table.lignes.length} trouvé·s)`);

      const iRang = colonneDe(table, /^#$/, 'le rang du réflexe');
      const iNom = colonneDe(table, /^Le réflexe$/i, 'le nom du réflexe');
      const rangs = table.lignes.map((l, position) => ({ rang: Number(l[iRang]), position, cle: l[iNom] }));

      const complaisance = rangs.filter((r) => /complaisance/i.test(r.cle));
      assert.equal(complaisance.length, 1, 'un seul réflexe d’anti-complaisance');
      assert.equal(complaisance[0].rang, 1, `l’anti-complaisance porte le rang ${complaisance[0].rang} au lieu de 1`);
      assert.equal(complaisance[0].position, 0, 'et elle ouvre la table — un réflexe listé en dernier se lit en dernier');

      // LA POLARITÉ, RÉSOLUE PAR LES LIBELLÉS D'EN-TÊTE ET JAMAIS PAR L'INDEX.
      // Permuter les deux en-têtes ferait dire au métier que « oui, c'est possible » est ce
      // qu'on répond à la place de la complaisance — le contresens exact. Les cellules
      // n'ayant pas bougé, seul l'appariement en-tête↔contenu le voit.
      const pressions = colonne(table, /^Ce que la pression te fait dire$/i, 'ce que la pression te fait dire').join(' ');
      const reponses = colonne(table, /^Ce que tu dis à la place$/i, 'ce que tu dis à la place');

      const COMPLAISANTES = [/c.est possible/i, /devrait être prêt/i, /\bbientôt\b/i];
      for (const sonde of COMPLAISANTES) {
        assert.match(pressions, sonde, `${sonde} doit figurer sous l’en-tête « ce que la pression te fait dire »`);
      }
      for (const reponse of reponses) {
        for (const sonde of COMPLAISANTES) {
          assert.ok(
            !sonde.test(reponse),
            `« ${reponse} » est donné comme la réponse à faire alors qu’il porte ${sonde} — la polarité est inversée`,
          );
        }
      }
    },
  },

  {
    id: 'posture-fondatrice',
    quoi: 'le renversement de posture tient : chercher le besoin est la posture, pas le réflexe de guichet',
    verifier({ metier }) {
      // Le principe qui gouverne tout le reste — « tu es le représentant du client dans
      // notre équipe, pas un guichet ». Cette table n'était gardée par rien, et permuter
      // ses deux en-têtes faisait de « ce n'est pas prévu au contrat » la posture à tenir.
      const table = tableDe(metier.split(/^##\s/m)[0]);
      const guichet = colonne(table, /^Le réflexe de guichet$/i, 'le réflexe de guichet').join(' ');
      const posture = colonne(table, /^Ta posture$/i, 'ta posture').join(' ');

      for (const [sonde, quoi] of [
        [/pas prévu au contrat/i, 'opposer le contrat'],
        [/vocabulaire/i, 'traduire dans notre vocabulaire'],
        [/question posée/i, 'répondre à la question posée'],
      ]) {
        assert.match(guichet, sonde, `« ${quoi} » est un réflexe de guichet, il doit figurer de ce côté`);
        assert.ok(!sonde.test(posture), `« ${quoi} » est donné comme ta posture — le renversement est inversé`);
      }
      for (const [sonde, quoi] of [
        [/débloquerait/i, 'chercher ce que ça débloque'],
        [/ses mots/i, 'garder ses mots'],
        [/défendre/i, 'défendre son besoin'],
      ]) {
        assert.match(posture, sonde, `« ${quoi} » est ta posture, il doit figurer de ce côté`);
        assert.ok(!sonde.test(guichet), `« ${quoi} » est donné comme un réflexe de guichet — le renversement est inversé`);
      }

      // Et le principe lui-même, hors table : la demande s'écrit dans les mots du client.
      const ouverture = metier.split(/^##\s/m)[0];
      assert.match(ouverture, /dans ses mots/i, 'le métier doit dire que la demande s’écrit dans les mots du client');
      assert.ok(
        !/\*\*Tu (?:la )?tradui[st]/i.test(ouverture),
        'le métier enseigne de traduire la demande dans notre vocabulaire — c’est le principe fondateur inversé',
      );
    },
  },

  {
    id: 'faisabilite-remonte',
    quoi: '« est-ce possible ? » vit sous l’en-tête qui REMONTE au dirigeant',
    verifier({ metier }) {
      // Le seul cas qu'un agent tranchera de travers de bonne foi : la réponse paraît
      // factuelle et engage en réalité. Résolu par en-tête : permuter les deux libellés
      // de cette table faisait répondre seul sur le prix, le délai et la faisabilité.
      const s = sectionDe(metier, /frontière de l.engagement/i, 'sur la frontière de l’engagement');
      const table = tableDe(s.corps);
      const seul = colonne(table, /^Tu réponds seul$/i, 'ce à quoi tu réponds seul').join(' ');
      const remonte = colonne(table, /^Tu remontes au dirigeant$/i, 'ce qui remonte au dirigeant').join(' ');

      assert.match(remonte, /est-ce possible/i, 'la faisabilité remonte au dirigeant');
      assert.ok(!/est-ce possible/i.test(seul), 'la faisabilité ne se répond pas seul');
    },
  },

  {
    id: 'engagements-remontent',
    quoi: 'tout ce qui engage l’organisation remonte — présent d’un côté ET absent de l’autre',
    verifier({ metier }) {
      // DEUX PORTES, PAS UNE. La première version n'exigeait que la PRÉSENCE à droite :
      // ajouter « un prix approximatif, si tu le connais » à gauche passait sans rougir,
      // puisque « prix » figurait toujours à droite, apporté par la ligne d'origine.
      // C'est le motif « un correctif ne couvre qu'une porte sur deux », que le commentaire
      // d'origine annonçait pourtant garder.
      const s = sectionDe(metier, /frontière de l.engagement/i, 'sur la frontière de l’engagement');
      const table = tableDe(s.corps);
      const seul = colonne(table, /^Tu réponds seul$/i, 'ce à quoi tu réponds seul').join(' ').toLowerCase();
      const remonte = colonne(table, /^Tu remontes au dirigeant$/i, 'ce qui remonte au dirigeant').join(' ').toLowerCase();

      for (const engage of ['délai', 'prix', 'priorité', 'engagement']) {
        assert.ok(remonte.includes(engage), `« ${engage} » doit figurer du côté qui remonte`);
        assert.ok(!seul.includes(engage), `« ${engage} » figure du côté où l’on répond seul : c’est un engagement pris sans le dirigeant`);
      }
    },
  },

  {
    id: 'cloisonnement',
    quoi: 'le cloisonnement énumère ses interdits, et leur nombre est gardé',
    verifier({ metier }) {
      // RA-REL-001. Sur le chantier précédent, la section a été supprimée EN ENTIER et
      // 346 tests sont restés verts ; puis une version qui cherchait trois motifs sur
      // quatre a laissé retirer le quatrième sans une rougeur. On garde donc la STRUCTURE
      // en plus des mots : autant de puces que d'interdits, chacune reconnue une fois.
      const s = sectionDe(metier, /un seul client, un seul canal/i, 'de cloisonnement');
      const INTERDITS = [
        { quoi: 'un second client se refuse', sonde: /second client/i },
        { quoi: 'un second canal se refuse', sonde: /second canal/i },
        { quoi: 'une session ne change pas de client en route', sonde: /ne change pas de client/i },
        { quoi: 'le travail d’un autre client ne se cite jamais', sonde: /autre client/i },
      ];
      const puces = pucesDe(s.corps);
      assert.equal(puces.length, INTERDITS.length, `${puces.length} interdit(s) écrit(s) pour ${INTERDITS.length} gardé(s)`);
      for (const { quoi, sonde } of INTERDITS) {
        const trouvees = puces.filter((p) => sonde.test(p));
        assert.equal(trouvees.length, 1, `« ${quoi} » doit figurer une fois exactement`);
        // La MODALITÉ manquait ici : un interdit peut garder sa puce, son compte et son
        // vocabulaire tout en cessant d'obliger — « tu peux refuser » n'est pas « tu refuses ».
        exigeImperatif(trouvees[0], quoi);
      }
      assert.match(s.corps, /refuse/i, 'le verbe doit être le refus, pas la préférence');
      assert.match(s.corps, /structurel/i, 'le cloisonnement est structurel, pas déclaratif');
      assert.match(s.corps, /fuite/i, 'et la section doit dire ce qu’une violation coûte');
    },
  },

  {
    id: 'interdits-du-metier',
    quoi: 'la liste des « jamais » est complète, et chaque interdit oblige encore',
    verifier({ metier }) {
      // Même garde que le cloisonnement, appliquée à l'autre liste d'interdits. Elle porte
      // notamment l'interdit d'inviter quelqu'un dans le canal du client — une règle du
      // métier d'origine qui avait été perdue au déplacement, et que rien n'aurait
      // rattrapée. Le compte est gardé pour que retirer une puce fasse rougir.
      const s = sectionDe(metier, /ce que tu ne fais pas/i, 'des interdits du métier');
      const INTERDITS = [
        { quoi: 'il n’écrit pas de code', sonde: /n.écris pas de code/i },
        { quoi: 'il ne tranche aucun arbitrage', sonde: /aucun arbitrage/i },
        { quoi: 'il ne s’engage sur aucune condition', sonde: /ne t.engages sur aucun/i },
        { quoi: 'l’orchestrateur ne parle pas au client', sonde: /orchestrateur parler au client/i },
        { quoi: 'aucun mécanisme de file', sonde: /mécanisme de file/i },
        { quoi: 'il n’invite personne dans le canal', sonde: /n.invites personne/i },
        { quoi: 'il ne renvoie aucune pièce au client', sonde: /ne renvoies aucune pièce/i },
        // T-20260814-0033 — CE QUI REMPLACE L'ANCIEN INTERDIT. « Tu n'ouvres jamais une
        // seconde ligne » est tombé parce qu'il est devenu faux ; le risque qu'il protégeait,
        // lui, n'a pas bougé d'un pouce. Il est désormais tenu par le nommage obligatoire, et
        // c'est donc CE nommage qui doit figurer parmi les « jamais » — sans quoi on aurait
        // retiré une garde en croyant retirer une erreur.
        { quoi: 'il n’écrit jamais sans nommer la ligne visée', sonde: /sans nommer la ligne/i },
      ];
      const puces = pucesDe(s.corps);
      assert.equal(puces.length, INTERDITS.length, `${puces.length} interdit(s) écrit(s) pour ${INTERDITS.length} gardé(s)`);
      for (const { quoi, sonde } of INTERDITS) {
        const trouvees = puces.filter((p) => sonde.test(p));
        assert.equal(trouvees.length, 1, `« ${quoi} » doit figurer une fois exactement (${trouvees.length} trouvée·s)`);
        exigeImperatif(trouvees[0], quoi);
      }
    },
  },

  {
    id: 'validation-avant-lancement',
    quoi: 'faire valider la formulation précède le lancement du travail',
    verifier({ metier }) {
      // RA-REL-004. Un besoin mal formulé transformé en travail coûte un chantier ; la
      // validation coûtait une question. Gardé par le RANG des étapes, pas par une phrase.
      const etapes = sections(metier)
        .filter((s) => s.niveau === 3 && /^\d+\./.test(s.titre))
        .map((s) => ({ rang: Number(s.titre.match(/^(\d+)\./)[1]), cle: s.titre }));
      assert.ok(etapes.length >= 5, `le cycle doit être une suite ordonnée (${etapes.length} étape·s)`);

      const valider = rangUnique(etapes, /faire valider/i, 'faire valider la formulation');
      const lancer = rangUnique(etapes, /lancer l.exécution/i, 'lancer l’exécution');
      assert.ok(valider.rang < lancer.rang, `la validation (rang ${valider.rang}) doit précéder le lancement (rang ${lancer.rang})`);

      // LE RANG NE SUFFIT PAS, ICI NON PLUS. L'étape peut rester à sa place et cesser
      // d'obliger : « tu peux lancer sans attendre si le besoin est clair » laisse l'ordre
      // intact et supprime la garantie. C'est RA-REL-004 qui tombe — un besoin mal formulé
      // parti en travail coûte un chantier, quand la validation coûtait une question.
      const corps = sectionDe(metier, /faire valider/i, 'de la validation de la formulation').corps;
      exigeImperatif(corps, 'l’étape « faire valider la formulation »');
    },
  },

  {
    id: 'verite-au-client',
    quoi: 'dire « ça attend son tour » est la bonne réponse, dire « c’est en cours » est la mauvaise',
    verifier({ metier }) {
      // EF-REL-011. Le cas qu'on rate presque toujours : un chantier terminé qui attend la
      // mise en ligne. Les deux formulations sont données côte à côte, marquées ✅ et ❌ ;
      // permuter les deux marques ferait recommander le mensonge. On apparie donc chaque
      // marque à ce qu'elle qualifie, plutôt que de constater que les deux existent.
      const s = sectionDe(metier, /tenir le client informé/i, 'sur ce qu’on dit au client');
      const citations = s.corps.split('\n').filter((l) => /^>\s*[✅❌]/.test(l));
      assert.equal(citations.length, 2, `les deux formulations doivent être données côte à côte (${citations.length} trouvée·s)`);

      const bonne = citations.filter((l) => l.includes('✅'));
      const mauvaise = citations.filter((l) => l.includes('❌'));
      assert.equal(bonne.length, 1, 'une seule formulation recommandée');
      assert.equal(mauvaise.length, 1, 'une seule formulation proscrite');

      assert.match(bonne[0], /attend son tour/i, 'la formulation recommandée doit dire que ça attend son tour');
      assert.match(mauvaise[0], /en cours/i, 'la formulation proscrite est « c’est en cours »');
      assert.ok(!/attend son tour/i.test(mauvaise[0]), 'dire qu’on attend son tour ne peut pas être la formulation proscrite');
    },
  },

  {
    id: 'relevement-avant-de-parler',
    quoi: 'le relèvement se lit avant de parler, et ses trois règles obligent encore',
    verifier({ metier }) {
      // EF-REL-012. Une consigne allusive sera lue par un agent, pas par une personne : le
      // chemin doit être une suite de lectures numérotées, pas une intention. Et les trois
      // règles qui l'accompagnent sont des interdits — les retourner ferait saluer avant
      // d'avoir lu et annoncer qu'on est la session neuve.
      const s = sectionDe(metier, /^Le relèvement/, 'de relèvement');
      const etapes = [...s.corps.matchAll(/^\s*\d+\.\s+\S/gm)];
      assert.ok(etapes.length >= 4, `le relèvement doit être une suite de lectures ordonnées (${etapes.length} trouvée·s)`);
      assert.match(s.corps, /action get/, 'il doit relire les demandes une à une, pas seulement leur liste');
      assert.match(s.corps, /commentaires/i, 'c’est le fil de commentaires qui porte ce qui a été compris et promis');

      const REGLES = [
        { quoi: 'ne rien dire avant d’avoir lu', sonde: /ne dis rien avant/i },
        { quoi: 'ne pas annoncer qu’on est nouveau', sonde: /n.annonces pas que tu es nouveau/i },
        { quoi: 'ne pas inventer ce qu’on n’a pas lu', sonde: /n.inventes pas/i },
      ];
      const puces = pucesDe(s.corps);
      assert.equal(puces.length, REGLES.length, `${puces.length} règle(s) écrite(s) pour ${REGLES.length} gardée(s)`);
      for (const { quoi, sonde } of REGLES) {
        const trouvees = puces.filter((p) => sonde.test(p));
        assert.equal(trouvees.length, 1, `« ${quoi} » doit figurer une fois exactement (${trouvees.length} trouvée·s)`);
        exigeImperatif(trouvees[0], quoi);
      }
    },
  },

  {
    id: 'anti-patterns-couverts',
    quoi: 'les fautes déjà commises sont toutes nommées comme des fautes, du côté de ce qu’on ne fait pas',
    verifier({ metier }) {
      // Chacune de ces lignes a été payée une fois. Une table d'anti-patterns dont on
      // retire discrètement une ligne est le mode de régression le plus silencieux d'un
      // document : rien ne casse, et la faute redevient tentante. La colonne est résolue
      // par son en-tête — sans quoi permuter les deux libellés ferait de chaque faute une
      // raison de la commettre.
      const s = sectionDe(metier, /anti-patterns/i, 'd’anti-patterns');
      const table = tableDe(s.corps);
      const fautes = colonne(table, /^Ce qu'on est tenté de faire$/i, 'ce qu’on est tenté de faire');
      const raisons = colonne(table, /^Pourquoi ça casse$/i, 'pourquoi ça casse').join(' ');

      const FAUTES = [
        { quoi: 'relever avant d’être joignable', sonde: /avant d.avoir ouvert sa ligne/i },
        { quoi: 'répondre « oui c’est possible »', sonde: /c.est possible/i },
        { quoi: 'tout inscrire à la fin', sonde: /à la fin/i },
        { quoi: 'lancer avant validation', sonde: /avant que le client ait validé/i },
        { quoi: 'prendre un second client', sonde: /second client/i },
        { quoi: 'écrire ce qu’on sait du client dans le fichier généré', sonde: /CLAUDE\.md/ },
        { quoi: 'renvoyer une pièce au client', sonde: /renvoyer au client/i },
        { quoi: 'inviter quelqu’un dans le canal', sonde: /inviter soi-même/i },
        { quoi: 'trancher un arbitrage « simple »', sonde: /trancher un arbitrage/i },
        { quoi: 'saluer avant d’avoir relevé', sonde: /saluer avant/i },
      ];
      for (const { quoi, sonde } of FAUTES) {
        assert.equal(fautes.filter((c) => sonde.test(c)).length, 1, `« ${quoi} » doit être nommée une fois exactement comme une faute`);
      }
      // Et la colonne des raisons ne doit pas porter les fautes : si les deux en-têtes sont
      // permutés, ce qui était « ce qu'on est tenté de faire » devient « pourquoi ça casse ».
      assert.ok(
        !/renvoyer au client/i.test(raisons),
        'les fautes figurent du côté des raisons — les deux colonnes de la table sont inversées',
      );
    },
  },

  {
    id: 'reception-seulement',
    quoi: 'la pièce se reçoit et ne se renvoie jamais — et l’interdit n’est pas devenu une permission',
    verifier({ metier }) {
      // HS-REL-003. La première version gardait cet interdit par ABSENCE DE JETONS
      // techniques (`files.upload`, …) que le gabarit n'a jamais contenus : l'assertion
      // était vraie par construction, pas par garde. Remplacer la phrase par son contraire
      // — « tu peux lui renvoyer les pièces qu'il demande » — ne faisait rougir personne.
      // On garde donc la MODALITÉ de l'énoncé, là où il vit.
      const s = sectionDe(metier, /ce que le client dépose/i, 'sur les pièces déposées par le client');

      // On ne retient que les énoncés MIS EN AVANT (en gras) dont le sujet est l'envoi vers
      // le client : la prose de la section parle aussi de ce que le client, lui, envoie —
      // et confondre les deux sens ferait rougir le gabarit intact.
      const enonces = s.corps
        .split('\n')
        .map((l) => ({ ligne: l, gras: [...l.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]).join(' ') }))
        .filter(({ gras }) => /\b(?:envoies|renvoies|renvoyer|envoyer)\b/i.test(gras));
      assert.equal(enonces.length, 1, `la section doit dire une fois exactement ce qu’il advient de l’envoi vers le client (${enonces.length} trouvée·s)`);

      const { ligne, gras } = enonces[0];
      exigeImperatif(ligne, 'l’interdit d’envoyer une pièce au client');
      assert.match(
        gras, /jamais|aucune|ne\s+lui\s+envoies/i,
        `« ${ligne.trim()} » ne nie plus l’envoi : la réception seule entre dans le périmètre (HS-REL-003)`,
      );
      // Les jetons techniques restent proscrits — mais comme filet, jamais comme garde
      // principale : ils ne prouvent rien tant qu'aucun d'eux ne pourrait apparaître.
      for (const envoi of ['files.upload', 'files_upload', 'chat.postMessage']) {
        assert.ok(!metier.includes(envoi), `le métier enseigne « ${envoi} » : il ne renvoie rien au client`);
      }
    },
  },

  {
    id: 'contexte-necessaire',
    quoi: 'le canal n’est nommé nulle part ailleurs que dans CONTEXTE.md — le métier ne peut pas s’exécuter sans le lire',
    verifier({ metier }) {
      // RA-REL-014. La frontière entre les deux fichiers n'existe sur le papier que si le
      // métier RENVOIE réellement au contexte. Un titre écrit en dur dans le gabarit le
      // rendrait décoratif — et ferait signer tous les représentants du même nom.
      // T-20260814-0033 : DEUX ouvertures, et on les distingue par ce qu'elles PORTENT, pas
      // par leur rang dans le texte. Les compter sans les apparier laisserait passer deux
      // lignes clientes, ou deux lignes internes — c'est-à-dire un gestionnaire muet d'un côté
      // ou l'autre, avec le bon nombre de commandes.
      const ouvertures = [...metier.matchAll(/\$LD ouvrir[^\n]*/g)].map((m) => m[0]);
      assert.equal(ouvertures.length, 2, `un gestionnaire ouvre DEUX lignes — celle du client et celle du dirigeant (${ouvertures.length} trouvée·s)`);

      const clientes = ouvertures.filter((o) => /--nature client/.test(o));
      assert.equal(clientes.length, 1, 'une seule ligne CLIENTE — un client, un canal privé');
      assert.match(clientes[0], /--titre/, 'sans titre, la commande refuse d’ouvrir une ligne cliente');

      const titre = clientes[0].match(/--titre\s+"([^"]*)"/);
      assert.ok(titre, 'le titre doit être passé entre guillemets');
      assert.match(titre[1], /CONTEXTE\.md/, `le titre « ${titre[1]} » est écrit en dur : il doit venir du contexte du client`);

      // ═══ LA LIGNE DU DIRIGEANT — et chacune de ces trois choses a une conséquence propre.
      const internes = ouvertures.filter((o) => !/--nature client/.test(o));
      assert.equal(internes.length, 1, 'une seule ligne vers le DIRIGEANT');
      assert.ok(
        !/--nature/.test(internes[0]),
        `« ${internes[0]} » nomme une nature : sa ligne interne n’en porte aucune, et le garde du lieu la refuserait`,
      );
      // Le CHANTIER est ce que `--a` visera (T-20260813-0078) : s'il change ici, « --a
      // dirigeant » ne désigne plus rien et chaque remontée est refusée.
      assert.match(
        internes[0], /\$LD ouvrir dirigeant(?=\s|$)/,
        `« ${internes[0]} » n’ouvre pas le chantier « dirigeant » — « --a dirigeant » ne désignerait plus sa ligne`,
      );
      // Sans ce drapeau, la ligne s'ouvre avec une liste d'autorisés VIDE : elle a l'air
      // ouverte et refuse la parole à tout le monde, au dirigeant le premier.
      assert.match(
        internes[0], /--au-dirigeant(?=\s|$)/,
        `« ${internes[0]} » n’autorise personne : la ligne naîtrait muette`,
      );
    },
  },

  {
    id: 'deux-lignes-et-ce-qui-ne-traverse-pas',
    quoi: 'les deux lignes sont distinguées par leur DESTINATAIRE, le nommage oblige, et l’étanchéité est un interdit — pas un conseil',
    verifier({ metier }) {
      // T-20260814-0033. L'ancien métier interdisait la seconde ligne ; elle existe désormais
      // (T-20260813-0076) et le garde du lieu l'EXIGE. Ce qui a disparu, c'est l'interdit —
      // pas le risque : ce qui transite vers le dirigeant est précisément ce qu'on ne dit pas
      // au client, et une inversion lui livre la chose exacte qu'on lui cachait.
      //
      // ⚠️ CE CONTRÔLE NE CHERCHE PAS DE PHRASE. Il porte sur la POLARITÉ (quelle ligne porte
      // quel destinataire, résolue par les libellés d'en-tête et jamais par l'index), sur la
      // MODALITÉ (l'étanchéité est-elle un interdit ou une recommandation), et sur le COMPTE
      // des gestes qui exigent d'être nommés. C'est la seule forme qui survive à une
      // reformulation légitime tout en rougissant sur un affaiblissement.
      const s = sectionDe(metier, /tes deux lignes/i, 'sur les deux lignes');
      const table = tableDe(s.corps);

      // LA POLARITÉ. Permuter les deux en-têtes ferait viser le client par « --a dirigeant »
      // sans déplacer une seule cellule — l'inversion, écrite dans le métier lui-même.
      const versClient = colonne(table, /^ta ligne avec le client$/i, 'la ligne du client').join(' ');
      const versDirigeant = colonne(table, /^ta ligne avec le dirigeant$/i, 'la ligne du dirigeant').join(' ');
      assert.match(versDirigeant, /--a dirigeant/, 'la ligne du dirigeant se vise par « --a dirigeant »');
      assert.ok(
        !/--a dirigeant/.test(versClient),
        'le client se viserait par « --a dirigeant » : les deux colonnes sont inversées',
      );
      // Et ce qui y passe : le client reçoit ce qu'on lui dit, le dirigeant ce qu'on ne lui
      // dit PAS. Une table dont les deux moitiés diraient la même chose n'enseignerait rien.
      assert.notEqual(
        versClient, versDirigeant,
        'les deux lignes portent le même contenu : rien ne les distingue plus',
      );

      // LE NOMMAGE OBLIGE — et le compte des gestes est gardé, parce qu'en oublier un dans
      // l'énumération est exactement la façon dont une garde se perd sans qu'on la retire.
      const nommage = s.corps.split('\n').filter((l) => /--a\b/.test(l) && /\bexige|\btoujours\b/i.test(l));
      assert.ok(nommage.length >= 1, 'le métier doit dire que la ligne visée se nomme TOUJOURS');
      exigeImperatif(nommage.join(' '), 'le nommage de la ligne visée');
      for (const geste of ['dire', 'demander', 'fermer', 'renommer']) {
        assert.match(
          s.corps, new RegExp(`\`${geste}\``),
          `« ${geste} » exige d’être nommé lui aussi — l’oublier ici le laisse deviner sa ligne`,
        );
      }
      // Sans nom, le geste est REFUSÉ. Si le métier annonçait qu'il part quand même « sur la
      // ligne la plus probable », il enseignerait le contraire de ce que la commande fait.
      assert.match(s.corps, /refus/i, 'le métier doit dire qu’un geste sans nom est REFUSÉ, pas deviné');

      // L'ÉTANCHÉITÉ EST UN INTERDIT, PAS UN CONSEIL. C'est la mutation qui compte : « évite
      // de faire descendre… » garde tous les mots et ne garde plus rien.
      const etanche = s.corps
        .split('\n')
        .filter((l) => /ne\s+(?:descend|traverse)|ne\s+descend|traverse jamais/i.test(l) || /rien de ce qui monte/i.test(l));
      assert.ok(etanche.length >= 1, 'le métier doit dire ce qui ne traverse JAMAIS d’une ligne à l’autre');
      exigeImperatif(etanche.join(' '), 'l’étanchéité entre les deux lignes');
      // ⚠️ CE CONTRÔLE N'A PLUS DE SONDE À LUI, ET C'EST LE CORRECTIF — relevé en revue de fond.
      //
      // Il en portait une (« évite », « essaie »…), écrite ici parce que `PERMISSIF` ne les
      // connaissait pas : `\bévite` ne s'apparie JAMAIS (`é` n'est pas un caractère de mot),
      // le piège que ce fichier documente déjà pour « privé\b », rejoué par l'autre bout.
      // Corriger LOCALEMENT laissait la même famille ouverte sur la dizaine d'autres appels
      // d'`exigeImperatif` — dont celui qui garde le nommage, c'est-à-dire la garde qui
      // REMPLACE l'ancien interdit. « Une porte sur deux », dans le correctif d'une porte sur
      // deux. La famille est donc entrée dans `PERMISSIF`, et `exigeImperatif` ci-dessus la
      // porte pour tout le monde.
      //
      // Sa forme y est PRÉCISE — « évite de », « en évitant » — jamais « évite » nu : le
      // gabarit dit légitimement « l'aveu qu'on cherche à éviter », dans une puce elle-même
      // gardée. Une sonde plus large aurait fait rougir ce qui marche.
      // Et elle doit dire ce qu'une inversion COÛTE — sans quoi elle se lit comme une règle
      // d'hygiène qu'on relâche le jour où elle gêne.
      assert.match(s.corps, /ne se reprend pas|irrattrapable|lu avant d.être effacé/i, 'et ce qu’une inversion coûte');
    },
  },

  {
    id: 'remontee-par-la-ligne',
    quoi: 'la remontée passe par la ligne du dirigeant — le registre garde la trace, il ne prévient personne',
    verifier({ metier }) {
      // T-20260814-0033. L'ancien texte disait que la remontée était « un pis-aller » et
      // envoyait vers un orchestrateur tiers, ou vers une note qui « ne prévient personne ».
      // Les deux obligations du métier — remonter ce qui engage, remonter un danger AVANT
      // d'en parler au client — n'avaient donc aucun chemin qui atteigne quelqu'un.
      const s = sectionDe(metier, /comment tu remontes/i, 'sur la remontée au dirigeant');

      // LE GESTE, ET SA LIGNE. Un `demander` qui ne nomme pas sa ligne serait refusé ; un
      // `demander` nommé vers le client poserait AU CLIENT la question qui appartient au
      // dirigeant. C'est l'appariement des deux qui compte, pas leur présence séparée.
      const blocs = blocsBash(s.corps).join('\n');
      assert.match(blocs, /demander[^\n]*--a dirigeant/, 'la remontée se fait par « demander … --a dirigeant »');
      assert.ok(
        !/--a\s+<le client>/.test(blocs),
        'la section de remontée enseigne un geste vers le CLIENT : l’arbitrage lui serait posé à lui',
      );

      // LA DISTINCTION QUI PORTE TOUT : la ligne fait ARRIVER, le registre fait DURER. Les
      // confondre ramène le défaut d'origine — une question inscrite quelque part et jamais lue.
      assert.match(s.corps, /registre|demands/i, 'ce qui doit survivre à la session va aussi au registre');
      assert.match(
        s.corps, /n.est pas une notification|ne prévient personne/i,
        'le métier doit dire qu’une note au registre ne prévient personne',
      );
      // Et le pis-aller ne doit plus être présenté comme le chemin : un métier qui dit encore
      // « ce n'est pas le mécanisme prévu » enseigne de ne pas s'en servir.
      // ⚠️ LE TITRE COMPTE AUTANT QUE LE CORPS, et c'est une mutation SURVIVANTE qui l'a
      // imposé : elle remettait « et pourquoi c'est aujourd'hui un pis-aller » dans le TITRE
      // seul, que `sectionDe` ne rend pas avec le corps. Un agent lit le titre en premier —
      // « ce n'est pas le mécanisme prévu » lui dit de ne pas s'en servir, quoi que dise la suite.
      const entier = `${s.titre}\n${s.corps}`;
      assert.ok(
        !/pis-aller|n.est pas le mécanisme prévu|en attendant/i.test(entier),
        'la remontée est encore présentée comme un pis-aller — elle est le mécanisme, désormais',
      );
    },
  },

  {
    id: 'canal-prive',
    quoi: 'le canal du client naît PRIVÉ, et le métier dit pourquoi ça n’est pas négociable',
    verifier({ metier }) {
      // RA-REL-001 au niveau du transport. Un canal client public expose le portefeuille à
      // quiconque a un compte chez nous. Changer « privé » en « public » dans l'explication
      // de `--nature client` ne faisait rougir personne, alors que c'est une fuite.
      const s = sectionDe(metier, /ordre d.ouverture/i, 'sur l’ordre d’ouverture');
      const puces = pucesDe(s.corps).filter((p) => /--nature client/.test(p));
      assert.equal(puces.length, 1, 'la nature cliente de la ligne doit être expliquée une fois exactement');
      // Note : pas de `\b` après « privé ». En JavaScript, `é` n'est pas un caractère de
      // mot, donc `privé\b` ne s'apparie jamais en fin de mot — le contrôle serait rouge
      // sur un gabarit correct. Le piège est classique dès qu'on garde du texte français.
      assert.match(puces[0], /\bprivé/i, 'la ligne cliente fait naître un canal PRIVÉ — c’est ce qui cloisonne le portefeuille');
      assert.ok(
        !/\bcanal public\b/i.test(puces[0]),
        `« ${puces[0].trim()} » annonce un canal public : le portefeuille client serait exposé`,
      );

      // Et le refus de s'installer sur un canal public, s'il porte le bon nom, doit tenir.
      const refus = pucesDe(s.corps).filter((p) => /confidentialité/i.test(p));
      assert.equal(refus.length, 1, 'le métier doit dire quoi faire quand la ligne refuse pour confidentialité');
      exigeImperatif(refus[0], 'le refus de s’installer sur un canal public');
      assert.match(refus[0], /n.insiste pas|ne contourne pas/i, 'et ce refus ne se contourne pas');
    },
  },

  {
    id: 'aucune-substitution',
    quoi: 'le gabarit du métier est identique pour tous les clients — donc comparable octet pour octet',
    verifier({ metier }) {
      // Ce qui rendra la mise à jour (E4) capable de détecter une divergence sans deviner.
      // Un seul emplacement à substituer, et il faudrait re-rendre le gabarit pour comparer.
      for (const moteur of [/\{\{[^}]+\}\}/, /%%[^%]+%%/, /<%[^%]*%>/]) {
        const trouve = metier.match(moteur);
        assert.ok(!trouve, `le gabarit porte un emplacement à substituer (« ${trouve && trouve[0]} ») : il cesse d’être comparable tel quel`);
      }
    },
  },

  {
    id: 'il-represente-il-ne-code-pas',
    quoi: 'aucun geste enseigné n’exécute le travail ni ne prend la mise en ligne',
    verifier({ metier }) {
      // HS-REL-001, HS-REL-005 et RA-REL-015. La tentation arrive toujours par la même
      // porte : « ce petit bout, c'est plus rapide ». Ici les jetons SONT la bonne garde —
      // ce sont réellement des commandes dans le texte, et l'une d'elles pourrait y entrer.
      // (L'interdit d'ENVOI de pièce, lui, est une phrase : il est gardé par
      // `reception-seulement`, pas par des jetons qui n'apparaîtraient jamais.)
      for (const bloc of blocsBash(metier)) {
        for (const geste of ['git commit', 'git push', 'git checkout', 'npm publish', '/pousse', '/merge', 'supabase db']) {
          assert.ok(!bloc.includes(geste), `le métier enseigne « ${geste} » : un représentant ne réalise pas`);
        }
      }
      assert.match(metier, /lock_status/, 'il doit savoir LIRE l’état de la mise en ligne pour dire la vérité au client');
      for (const pris of ['lock_acquire', 'lock_release']) {
        assert.ok(!metier.includes(pris), `il ne prend ni ne rend le droit d’accès à la mise en ligne (« ${pris} »)`);
      }
    },
  },

  {
    id: 'frontiere-des-deux-fichiers',
    quoi: 'chaque gabarit dit lequel des deux est remplacé et lequel n’est jamais touché',
    verifier({ metier, contexte }) {
      // RA-REL-014, et c'est la garantie dont E4 dépendra entièrement. Si les deux
      // avertissements s'inversent, le représentant écrit ce qu'il sait de son client dans
      // le fichier que la prochaine mise à jour remplace : perte silencieuse, et le client
      // s'entend redemander ce qu'il a déjà expliqué.
      //
      // ATTENTION — LA PREMIÈRE VERSION DE CE CONTRÔLE ÉTAIT DÉCORATIVE, et c'est le harnais
      // de mutation qui l'a dit, pas une relecture. Elle vérifiait que « la ligne qui parle
      // de remplacement ne nomme pas l'autre fichier » : trivialement vrai, puisque cette
      // ligne disait « ce fichier » sans nommer personne. Deux mutations lui ont survécu.
      //
      // La garde tient désormais parce que chaque ligne d'en-tête NOMME le fichier dont elle
      // parle : on peut alors apparier la POLARITÉ (remplacé / jamais touché) au SUJET
      // qu'elle gouverne. Croiser les deux noms fait rougir, dans les deux fichiers.
      const REMPLACE = /remplac/i;
      const PRESERVE = /jamais/i;

      for (const [nom, texte] of [['CLAUDE.md', metier], ['CONTEXTE.md', contexte]]) {
        const entete = enteteDe(texte);
        assert.ok(entete.length >= 2, `${nom} doit s’ouvrir sur un avertissement qui dit à qui appartient chacun des deux fichiers`);

        /** Le fichier que nomme l'unique ligne d'en-tête portant cette polarité. */
        const sujetDe = (sonde, polarite) => {
          const lignes = entete.filter((l) => sonde.test(l));
          assert.equal(lignes.length, 1, `${nom} : une seule ligne doit porter « ${polarite} » (${lignes.length} trouvée·s)`);
          const nommes = ['CLAUDE.md', 'CONTEXTE.md'].filter((f) => lignes[0].includes(`\`${f}\``));
          assert.equal(
            nommes.length, 1,
            `${nom} : « ${lignes[0]} » doit nommer exactement un fichier — sans nom, l’affirmation n’est apparentable à rien`
          );
          return nommes[0];
        };

        assert.equal(
          sujetDe(REMPLACE, 'remplacé'), 'CLAUDE.md',
          `${nom} : c’est CLAUDE.md qui est remplacé à chaque mise à jour — la frontière est inversée`
        );
        assert.equal(
          sujetDe(PRESERVE, 'jamais touché'), 'CONTEXTE.md',
          `${nom} : c’est CONTEXTE.md qu’aucune mise à jour ne touche — la frontière est inversée`
        );
      }
    },
  },

  {
    id: 'gestes-de-ligne-existants',
    quoi: 'chaque geste et chaque option de ligne enseignés existent dans la commande',
    verifier({ metier }) {
      // EF-AGT-002. Le pack s'est déjà fait avoir : une compétence enseignait un geste qui
      // n'existe pas, et chaque agent qui la suivait perdait du temps sur une erreur qui
      // n'était pas la sienne. Ici la source est lue, jamais recopiée.
      const src = readFileSync(join(REPO, 'ligne-directe', 'bin', 'ligne-directe.js'), 'utf8');
      const gestes = new Set([...src.matchAll(/geste === '([a-zà-ÿ-]+)'/g)].map((m) => m[1]));
      const options = new Set([...src.matchAll(/'(--[a-zà-ÿ-]+)'/g)].map((m) => m[1]));
      assert.ok(gestes.size >= 5, 'les gestes de la commande n’ont pas été relevés — le contrôle ne prouverait rien');

      const gestesCites = [...metier.matchAll(/\$LD\s+([a-zà-ÿ-]+)/g)].map((m) => m[1]);
      assert.ok(gestesCites.length > 0, 'le métier doit montrer au moins un geste de ligne');
      for (const g of gestesCites) assert.ok(gestes.has(g), `le métier enseigne « ${g} », que la commande ne connaît pas`);

      const optionsCitees = [...metier.matchAll(/\$LD\s+[a-zà-ÿ-]+[^\n`]*?(--[a-zà-ÿ-]+)/g)].map((m) => m[1]);
      assert.ok(optionsCitees.length > 0, 'le métier doit montrer au moins une option');
      for (const o of optionsCitees) assert.ok(options.has(o), `le métier enseigne « ${o} », que la commande ne connaît pas`);
    },
  },

  {
    id: 'gestes-de-session-existants',
    quoi: 'chaque commande de session enseignée s’adresse à un objet connu et est employée ailleurs dans le pack',
    verifier({ metier }) {
      // L'outil de session n'est pas versionné ici : on n'admet que des formes déjà
      // employées par une compétence éprouvée, relevées dans ses BLOCS DE COMMANDES et
      // jamais dans sa prose — celle-ci cite nommément un contre-exemple.
      const reference = readFileSync(join(REPO, '.claude', 'skills', 'orchestrer-chantier', 'SKILL.md'), 'utf8');
      const formes = (t) => new Set([...t.matchAll(/\bherdr ([a-z-]+ [a-z-]+)/g)].map((m) => m[1]));
      const connues = formes(blocsBash(reference).join('\n'));
      assert.ok(connues.size >= 5, 'les formes de référence n’ont pas été relevées — le contrôle ne prouverait rien');

      for (const forme of formes(metier)) {
        assert.ok(['pane', 'agent', 'tab'].includes(forme.split(' ')[0]), `« herdr ${forme} » ne s’adresse à aucun objet connu — inventé ?`);
        assert.ok(connues.has(forme), `« herdr ${forme} » n’est employé nulle part ailleurs dans le pack — inventé ?`);
      }
    },
  },
];

// ═════════════════════════════════════════ les mutations

/** Applique une mutation au seul en-tête (tout ce qui précède la première section). */
function dansEntete(texte, muter) {
  const coupe = texte.search(/^##\s/m);
  assert.ok(coupe > 0, 'le gabarit doit avoir un en-tête avant sa première section');
  return muter(texte.slice(0, coupe)) + texte.slice(coupe);
}

/** Remplace `a` par `b` et `b` par `a`, en une passe. Jette si l'un des deux manque. */
export function permuter(texte, a, b) {
  assert.ok(texte.includes(a) && texte.includes(b), `permutation inapplicable : « ${a} » ou « ${b} » est absent`);
  const jeton = ' JETON ';
  return texte.split(a).join(jeton).split(b).join(a).split(jeton).join(b);
}

/**
 * Chaque mutation : { id, quoi, cible, muter(texte) }.
 *
 * `cible` nomme le contrôle qui DOIT la voir. Le harnais ne s'en sert pas pour décider —
 * il exige seulement qu'AU MOINS UN contrôle rougisse — mais il l'affiche quand la
 * mutation survit, pour dire ce qui n'était pas gardé.
 *
 * Chaque mutation est vérifiée OPÉRANTE avant d'être jugée : une mutation dont le motif ne
 * s'applique plus au texte ne change rien, tous les contrôles restent verts, et on la
 * compterait comme « attrapée » alors qu'elle n'a jamais été posée. C'est le faux témoin
 * de cette famille de harnais, et il est fatal ici.
 *
 * Les mutations préfixées `revue-` viennent de la revue indépendante de la PR #180 : ce
 * sont celles qui ont SURVÉCU à la première version des contrôles. Elles restent ici pour
 * que le défaut qu'elles ont révélé ne puisse pas revenir.
 */
export const MUTATIONS = [
  // ── l'ordre d'ouverture
  {
    id: 'relever-avant-d-etre-joignable',
    quoi: 'on relève l’historique avant d’ouvrir sa ligne — le défaut exact de T-20260806-0192',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Ouvre tes deux lignes**', '**Relève ce qui existe déjà**'),
  },
  {
    id: 'parler-avant-de-relever',
    quoi: 'on parle au client avant d’avoir relevé son histoire',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Relève ce qui existe déjà**', '**Alors seulement, parle.**'),
  },
  {
    id: 'revue-R5-l-ordre-devient-facultatif',
    quoi: 'l’étape 2 garde son rang mais cesse d’obliger — « tu peux aussi le faire après si ça presse »',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => t.replace(
      "2. **Ouvre tes deux lignes** — celle du client, puis celle du dirigeant. C'est ce qui te rend **joignable** des deux côtés.",
      "2. **Ouvre tes deux lignes** — celle du client, puis celle du dirigeant. C'est utile, mais tu peux aussi le faire après le relèvement si celui-ci presse. C'est ce qui te rend **joignable** des deux côtés.",
    ),
  },
  {
    id: 'la-condition-d-arret-disparait',
    quoi: 'plus rien ne dit de s’arrêter quand la ligne n’est pas installée — le représentant naît muet',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => t.replace(/^\*\*Si la ligne de discussion n'est pas installée.*\n/m, ''),
  },

  // ── les réflexes anti-biais
  {
    id: 'complaisance-devient-la-reponse',
    quoi: 'le « oui c’est possible » passe du côté de ce qu’on dit — le contresens exact',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      '« Oui, c\'est possible » — parce qu\'il insiste et que refuser est inconfortable',
      '« Je ne peux pas te répondre là-dessus moi-même — je fais remonter la question »',
    ),
  },
  {
    id: 'complaisance-reléguée-en-dernier',
    quoi: 'l’anti-complaisance cesse d’ouvrir les réflexes',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Anti-complaisance**', '**Anti-ancrage**'),
  },
  {
    id: 'revue-R2-en-tete-des-reflexes-permute',
    quoi: 'les en-têtes de la table des réflexes sont permutés — « oui c’est possible » devient ce qu’on dit à la place, sans qu’une cellule bouge',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| # | Le réflexe | Ce que la pression te fait dire | Ce que tu dis à la place |',
      '| # | Le réflexe | Ce que tu dis à la place | Ce que la pression te fait dire |',
    ),
  },

  // ── la posture fondatrice
  {
    id: 'revue-R3-en-tete-de-la-posture-permute',
    quoi: 'les en-têtes de la table de posture sont permutés — « ce n’est pas prévu au contrat » devient la posture à tenir',
    cible: 'posture-fondatrice',
    fichier: 'metier',
    muter: (t) => t.replace('| Le réflexe de guichet | Ta posture |', '| Ta posture | Le réflexe de guichet |'),
  },
  {
    id: 'revue-R10-la-demande-se-traduit',
    quoi: 'la demande se traduit dans notre vocabulaire au lieu de garder les mots du client',
    cible: 'posture-fondatrice',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Tu écris sa demande dans ses mots.**',
      '**Tu traduis sa demande dans notre vocabulaire.**',
    ),
  },

  // ── la frontière de l'engagement
  {
    id: 'faisabilite-se-repond-seul',
    quoi: '« est-ce possible ? » passe du côté où l’on répond seul',
    cible: 'faisabilite-remonte',
    fichier: 'metier',
    muter: (t) => permuter(t, 'Reformulation du besoin, pour qu\'il la valide', '**Une faisabilité — « est-ce possible ? »**'),
  },
  {
    id: 'le-prix-se-repond-seul',
    quoi: 'le prix quitte le côté qui remonte',
    cible: 'engagements-remontent',
    fichier: 'metier',
    muter: (t) => t.replace('| Un prix, un budget, une portée facturable |', '| Une question de vocabulaire |'),
  },
  {
    id: 'revue-R1-en-tete-de-la-frontiere-permute',
    quoi: 'les en-têtes de la frontière sont permutés — le prix, le délai et la faisabilité se répondent seul',
    cible: 'faisabilite-remonte',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| Tu réponds seul | Tu remontes au dirigeant |',
      '| Tu remontes au dirigeant | Tu réponds seul |',
    ),
  },
  {
    id: 'revue-R4-le-prix-ajoute-a-gauche',
    quoi: 'le prix approximatif est ajouté du côté où l’on répond seul, sans être retiré de l’autre',
    cible: 'engagements-remontent',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| Accusé de réception | Un délai, une échéance |',
      '| Accusé de réception | Un délai, une échéance |\n| Un prix approximatif, si tu le connais | Une question de vocabulaire |',
    ),
  },

  // ── les interdits
  {
    id: 'un-interdit-de-cloisonnement-retire',
    quoi: 'la puce « une session ne change pas de client » disparaît',
    cible: 'cloisonnement',
    fichier: 'metier',
    muter: (t) => t.replace(/^- Si ta session porte déjà un client.*\n/m, ''),
  },
  {
    id: 'le-refus-devient-une-preference',
    quoi: 'le cloisonnement cesse de refuser et se contente de déconseiller',
    cible: 'cloisonnement',
    fichier: 'metier',
    muter: (t) => t.replaceAll('**tu refuses**', '**c\'est déconseillé**'),
  },
  {
    id: 'revue-R8-il-tranche-les-arbitrages-simples',
    quoi: 'le représentant se met à trancher les arbitrages qu’il juge simples',
    cible: 'interdits-du-metier',
    fichier: 'metier',
    muter: (t) => t.replace(
      '- **Tu ne tranches aucun arbitrage** — ni technique, ni de priorité entre clients.',
      '- **Tu tranches les arbitrages simples toi-même** — techniques comme de priorité entre clients.',
    ),
  },
  {
    id: 'l-interdit-d-invitation-disparait',
    quoi: 'plus rien n’empêche le représentant d’inviter qui il veut dans le canal du client',
    cible: 'interdits-du-metier',
    fichier: 'metier',
    muter: (t) => t.replace(/^- \*\*Tu n'invites personne dans le canal du client\.\*\*.*\n/m, ''),
  },

  // ── le cycle et la vérité dite au client
  {
    id: 'on-lance-avant-de-faire-valider',
    quoi: 'le travail part avant que le client ait validé sa formulation',
    cible: 'validation-avant-lancement',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      'Faire valider la formulation — le point de bascule',
      'Lancer l\'exécution — c\'est toi qui appuies',
    ),
  },
  {
    id: 'revue-R7-le-mensonge-devient-la-bonne-reponse',
    quoi: 'les marques ✅ et ❌ sont permutées — dire « c’est en cours » quand ça attend devient recommandé',
    cible: 'verite-au-client',
    fichier: 'metier',
    muter: (t) => permuter(t, '> ✅ « C\'est prêt.', '> ❌ « C\'est en cours. »'),
  },

  // ── le relèvement
  {
    id: 'revue-R9-il-salue-avant-d-avoir-lu',
    quoi: 'les règles du relèvement sont retournées — il salue avant d’avoir lu et annonce qu’il est nouveau',
    cible: 'relevement-avant-de-parler',
    fichier: 'metier',
    muter: (t) => t.replace(
      '- **Tu ne dis rien avant d\'avoir lu.**',
      '- **Tu peux saluer avant d\'avoir lu.**',
    ),
  },

  // ── les pièces
  {
    id: 'revue-R6-l-envoi-devient-permis',
    quoi: '« tu ne lui envoies jamais rien en retour » devient « tu peux lui renvoyer les pièces qu’il demande »',
    cible: 'reception-seulement',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Tu ne lui envoies jamais rien en retour.** La réception entre dans ton périmètre, l'envoi non.",
      "**Tu peux lui renvoyer les pièces qu'il demande.** La réception et l'envoi entrent tous deux dans ton périmètre.",
    ),
  },

  // ── les anti-patterns
  {
    id: 'la-faute-de-l-ordre-n-est-plus-nommee',
    quoi: 'l’anti-pattern « relever avant d’être joignable » disparaît de la table',
    cible: 'anti-patterns-couverts',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| Relever l'historique avant d'avoir ouvert sa ligne \|.*\n/m, ''),
  },
  {
    id: 'en-tete-des-anti-patterns-permute',
    quoi: 'les en-têtes des anti-patterns sont permutés — chaque faute se lit comme la raison de la commettre',
    cible: 'anti-patterns-couverts',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| Ce qu\'on est tenté de faire | Pourquoi ça casse |',
      '| Pourquoi ça casse | Ce qu\'on est tenté de faire |',
    ),
  },

  // ── les deux lignes du gestionnaire (T-20260814-0033)
  //
  // Les trois premières sont celles que le lot demandait nommément : elles rejouent la
  // régression exacte que ce lot existe pour rendre impossible.
  {
    id: 'l-interdit-de-la-seconde-ligne-revient',
    quoi: '« tu n’ouvres jamais une seconde ligne » est réintroduit — le métier redit le contraire de ce que le garde exige',
    cible: 'contexte-necessaire',
    fichier: 'metier',
    // C'EST LA RÉGRESSION QUE CE LOT FERME. Le garde du lieu tient le pane fermé tant que les
    // deux lignes ne sont pas là ; un métier qui interdit la seconde fait naître un agent qui
    // ne peut RIEN faire — muet, en croyant pouvoir parler.
    muter: (t) =>
      t.replace(
        '$LD ouvrir dirigeant --titre "ligne dirigeant <le client>" --au-dirigeant\n',
        '',
      ).replace(
        '- **Tu ouvres les DEUX, et la seconde n\'est pas facultative.**',
        '- **Tu n\'ouvres jamais une seconde ligne depuis ce pane.**',
      ),
  },
  {
    id: 'revue-l-ordre-s-assouplit-par-l-evitement',
    quoi: 'l’étape 2 garde son rang et son verbe, et s’assouplit par « en évitant de trop tarder »',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    // ⚠️ POSÉE PAR LA REVUE DE FOND, ET ELLE PASSAIT. La famille de l'évitement manquait à
    // `PERMISSIF` ; sa première correction avait été écrite dans un seul contrôle, laissant
    // tous les autres appels d'`exigeImperatif` ouverts — dont celui-ci, qui garde l'ordre
    // même où un représentant s'est déjà fait écrire quatre fois sans que rien n'arrive.
    muter: (t) => t.replace(
      "C'est ce qui te rend **joignable** des deux côtés.",
      "C'est ce qui te rend **joignable** des deux côtés, en évitant de trop tarder.",
    ),
  },
  {
    id: 'le-nommage-de-la-ligne-devient-facultatif',
    quoi: 'le nommage obligatoire tombe — le geste « choisit » sa ligne, et l’autre est le canal du client',
    cible: 'deux-lignes-et-ce-qui-ne-traverse-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Tu nommes toujours la ligne que tu vises.** Chaque geste qui écrit — `dire`, `demander`, `fermer`, `renommer` — exige `--a`.',
      '**Tu peux nommer la ligne que tu vises.** Chaque geste qui écrit — `dire`, `demander`, `fermer`, `renommer` — accepte `--a`.',
    ),
  },
  {
    id: 'l-etancheite-devient-un-conseil',
    quoi: '« ce qui ne traverse jamais » se change en recommandation — les mots restent, la garde part',
    cible: 'deux-lignes-et-ce-qui-ne-traverse-pas',
    fichier: 'metier',
    // Le motif dominant de ce dépôt, appliqué à la règle la plus coûteuse du lot : une
    // interdiction qui garde tout son vocabulaire et cesse d'obliger.
    muter: (t) => t.replace(
      '**Rien de ce qui monte vers le dirigeant ne descend chez le client.**',
      '**Évite que ce qui monte vers le dirigeant ne descende chez le client.**',
    ),
  },
  {
    id: 'les-deux-lignes-sont-permutees',
    quoi: 'les en-têtes des deux lignes sont permutés — « --a dirigeant » désigne le client, sans qu’une cellule bouge',
    cible: 'deux-lignes-et-ce-qui-ne-traverse-pas',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| | ta ligne avec le client | ta ligne avec le dirigeant |',
      '| | ta ligne avec le dirigeant | ta ligne avec le client |',
    ),
  },
  {
    id: 'la-ligne-du-dirigeant-n-autorise-personne',
    quoi: '`--au-dirigeant` disparaît de l’ouverture — la ligne naît muette et refuse sa parole au dirigeant',
    cible: 'contexte-necessaire',
    fichier: 'metier',
    muter: (t) => t.replace(
      '$LD ouvrir dirigeant --titre "ligne dirigeant <le client>" --au-dirigeant',
      '$LD ouvrir dirigeant --titre "ligne dirigeant <le client>"',
    ),
  },
  {
    id: 'la-remontee-redevient-un-pis-aller',
    quoi: 'la remontée repasse par un tiers et par une note — les deux chemins qui n’atteignent personne',
    cible: 'remontee-par-la-ligne',
    fichier: 'metier',
    muter: (t) => t.replace(
      "### Comment tu remontes — par ta ligne, et elle atteint quelqu'un",
      "### Comment tu remontes — et pourquoi c'est aujourd'hui un pis-aller",
    ),
  },
  {
    id: 'l-arbitrage-est-pose-au-client',
    quoi: 'la remontée nomme la ligne du CLIENT — l’arbitrage qui appartient au dirigeant lui est posé à lui',
    cible: 'remontee-par-la-ligne',
    fichier: 'metier',
    muter: (t) => t.replace('ta recommandation>" --a dirigeant', 'ta recommandation>" --a <le client>'),
  },

  // ── le transport et la frontière des fichiers
  {
    id: 'revue-R12-le-canal-naît-public',
    quoi: 'le canal du client naît public — le portefeuille est exposé à quiconque a un compte chez nous',
    cible: 'canal-prive',
    fichier: 'metier',
    muter: (t) => t.replace('Il fait naître le canal privé,', 'Il fait naître le canal public,'),
  },
  {
    id: 'le-titre-est-ecrit-en-dur',
    quoi: 'le titre de la ligne cesse de venir du contexte du client',
    cible: 'contexte-necessaire',
    fichier: 'metier',
    muter: (t) => t.replace('"<le titre donné par CONTEXTE.md>"', '"Support client"'),
  },
  {
    id: 'un-emplacement-a-substituer',
    quoi: 'le gabarit cesse d’être identique pour tous les clients',
    cible: 'aucune-substitution',
    fichier: 'metier',
    muter: (t) => t.replace('# Tu es le représentant de ce client', '# Tu es le représentant de {{client}}'),
  },
  {
    id: 'il-se-met-a-coder',
    quoi: 'un geste qui écrit dans le dépôt du client entre dans le métier',
    cible: 'il-represente-il-ne-code-pas',
    fichier: 'metier',
    muter: (t) => t.replace('herdr pane current', 'git commit -am "petit ajustement"\nherdr pane current'),
  },
  {
    id: 'il-prend-la-mise-en-ligne',
    quoi: 'le représentant acquiert le droit d’accès à la mise en ligne au lieu de le lire',
    cible: 'il-represente-il-ne-code-pas',
    fichier: 'metier',
    muter: (t) => t.replace('action lock_status        → la mise en ligne', 'action lock_acquire       → la mise en ligne'),
  },
  {
    id: 'la-frontiere-des-fichiers-inversee',
    quoi: 'le métier annonce que c’est le contexte du client qui sera remplacé',
    cible: 'frontiere-des-deux-fichiers',
    fichier: 'metier',
    muter: (t) => dansEntete(t, (e) => permuter(e, '`CLAUDE.md`', '`CONTEXTE.md`')),
  },
  {
    id: 'la-frontiere-inversee-cote-contexte',
    quoi: 'le contexte du client s’annonce lui-même comme remplaçable',
    cible: 'frontiere-des-deux-fichiers',
    fichier: 'contexte',
    muter: (t) => dansEntete(t, (e) => permuter(e, '`CLAUDE.md`', '`CONTEXTE.md`')),
  },
  {
    id: 'revue-R11-le-contexte-se-dit-remplacable',
    quoi: 'l’en-tête du contexte est RÉÉCRIT (et non permuté) pour s’annoncer remplaçable comme les autres',
    cible: 'frontiere-des-deux-fichiers',
    fichier: 'contexte',
    muter: (t) => t.replace(
      "il t'appartient, et aucune mise à jour du pack n'y touchera jamais.",
      "les mises à jour du pack le remplacent comme les autres.",
    ),
  },

  // ── les libellés d'en-tête reformulés : le mot-clé reste, le sens s'inverse
  //
  // Ces six-là viennent de la SECONDE revue. Elles survivaient toutes tant que `colonneDe`
  // reconnaissait une colonne à un mot-clé contenu dans son libellé. Elles sont la raison
  // pour laquelle la sonde doit désormais couvrir le libellé ENTIER.
  {
    id: 'revue2-R13-la-remontee-devient-conditionnelle',
    quoi: 'l’en-tête devient « Tu remontes au dirigeant si tu as un doute » — l’obligation se change en option, mot-clé intact',
    cible: 'faisabilite-remonte',
    fichier: 'metier',
    muter: (t) => t.replace('| Tu réponds seul | Tu remontes au dirigeant |', '| Tu réponds seul | Tu remontes au dirigeant si tu as un doute |'),
  },
  {
    id: 'revue2-R14-on-ne-remonte-plus-rien',
    quoi: 'l’en-tête devient « Tu ne remontes rien » — l’inverse exact, et le mot-clé y est encore',
    cible: 'faisabilite-remonte',
    fichier: 'metier',
    muter: (t) => t.replace('| Tu réponds seul | Tu remontes au dirigeant |', '| Tu réponds seul | Tu ne remontes rien |'),
  },
  {
    id: 'revue2-R15-la-colonne-des-reponses-se-nie',
    quoi: 'l’en-tête devient « Ce que tu ne dis jamais à la place » — la colonne des bonnes réponses devient celle des interdits',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => t.replace('| Ce que tu dis à la place |', '| Ce que tu ne dis jamais à la place |'),
  },
  {
    id: 'revue2-R16-la-posture-devient-optionnelle',
    quoi: 'l’en-tête devient « Ta posture, quand tu as le temps »',
    cible: 'posture-fondatrice',
    fichier: 'metier',
    muter: (t) => t.replace('| Le réflexe de guichet | Ta posture |', '| Le réflexe de guichet | Ta posture, quand tu as le temps |'),
  },
  {
    id: 'revue2-R17-les-anti-patterns-deviennent-des-conseils',
    quoi: 'l’en-tête « Pourquoi ça casse » devient « Pourquoi ça peut aider »',
    cible: 'anti-patterns-couverts',
    fichier: 'metier',
    muter: (t) => t.replace("| Ce qu'on est tenté de faire | Pourquoi ça casse |", "| Ce qu'on est tenté de faire | Pourquoi ça peut aider |"),
  },
  {
    id: 'revue2-R18-la-pression-devient-conditionnelle',
    quoi: 'l’en-tête devient « Ce que la pression te fait dire, parfois » — la colonne cesse de désigner une faute',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => t.replace('| Ce que la pression te fait dire |', '| Ce que la pression te fait dire, si tu le souhaites |'),
  },

  // ── la modalité, là où seul le rang ou le compte était gardé
  {
    id: 'revue2-le-cloisonnement-devient-optionnel',
    quoi: 'le refus d’un second canal garde sa puce et son verbe, mais cesse d’obliger',
    cible: 'cloisonnement',
    fichier: 'metier',
    muter: (t) => t.replace(
      'ou vers un autre : **tu refuses** de la même façon',
      'ou vers un autre : **tu peux refuser** de la même façon',
    ),
  },
  {
    id: 'revue2-on-lance-sans-attendre-si-c-est-clair',
    quoi: 'l’étape de validation garde son rang mais devient facultative — « tu peux lancer sans attendre »',
    cible: 'validation-avant-lancement',
    fichier: 'metier',
    muter: (t) => t.replace(
      '**Rien ne part avant qu\'il ait dit « oui, c\'est ça ».**',
      '**Tu peux lancer sans attendre si le besoin te paraît clair.**',
    ),
  },

  // ── les gestes enseignés
  {
    id: 'un-geste-de-ligne-invente',
    quoi: 'le métier enseigne un geste de ligne qui n’existe pas',
    cible: 'gestes-de-ligne-existants',
    fichier: 'metier',
    muter: (t) => t.replace('$LD ouvrir', '$LD demarrer'),
  },
  {
    id: 'une-option-de-ligne-inventee',
    quoi: 'le métier enseigne une option que la commande ne connaît pas',
    cible: 'gestes-de-ligne-existants',
    fichier: 'metier',
    muter: (t) => t.replace('--nature client --titre', '--type client --titre'),
  },
  {
    id: 'une-commande-de-session-inventee',
    quoi: 'le métier enseigne un verbe de session qui n’existe pas — la famille de « herdr wait output »',
    cible: 'gestes-de-session-existants',
    fichier: 'metier',
    muter: (t) => t.replaceAll('herdr pane run', 'herdr wait output'),
  },
];

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
// LA RÈGLE D'ÉCRITURE D'UN CONTRÔLE, ET ELLE N'EST PAS NÉGOCIABLE
//
// Un contrôle ne cherche JAMAIS la présence d'une phrase. Il porte sur :
//
//   • la POLARITÉ  — de quel côté d'une table une affirmation vit (« ce qu'on dit » vs
//     « ce qu'on ne dit pas ») ;
//   • la POSITION  — à quel rang d'une suite ordonnée une étape se trouve ;
//   • le COMPTE    — combien d'interdits sont écrits pour combien de gardés.
//
// Les expressions régulières servent à IDENTIFIER un élément dans la structure ; l'assertion
// porte sur l'endroit où cet élément se trouve. Un contresens déplace l'élément : le contrôle
// le voit. Une reformulation ne le déplace pas : le contrôle la laisse passer, et c'est
// voulu — on garde un comportement, pas une rédaction.

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

/** Les lignes de données d'une table markdown, en cellules — l'en-tête et le trait retirés. */
export function tableDe(corps) {
  return corps
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((c) => !c.every((x) => /^:?-{2,}:?$/.test(x)))
    .slice(1); // l'en-tête
}

/** Les étapes d'une suite numérotée, avec leur rang et leur libellé en gras. */
export function etapesDe(corps) {
  return [...corps.matchAll(/^(\d+)\.\s+(.+)$/gm)].map((m) => ({
    rang: Number(m[1]),
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
 * Le rang de l'unique élément qu'une sonde reconnaît.
 * Échoue si la sonde n'en reconnaît aucun, ou plus d'un — une sonde ambiguë rendrait
 * l'assertion de position ininterprétable, donc inutile.
 */
function rangUnique(elements, sonde, quoi) {
  const trouves = elements.filter((e) => sonde.test(e.cle || ''));
  assert.equal(trouves.length, 1, `« ${quoi} » doit se reconnaître une fois exactement (${trouves.length} trouvée·s)`);
  return trouves[0].rang;
}

// ═════════════════════════════════════════ les contrôles

/**
 * Chaque contrôle : { id, quoi, verifier({ metier, contexte }) } — jette si la garantie
 * n'est plus tenue. Ils sont exécutés tels quels sur le gabarit réel ET sur ses mutants.
 */
export const CONTROLES = [
  {
    id: 'ordre-ouverture',
    quoi: 'se rendre joignable vient AVANT de relever, qui vient avant de parler',
    verifier({ metier }) {
      // T-20260806-0192 : un représentant a relevé l'historique avant d'ouvrir sa ligne.
      // Pendant ce temps on lui a écrit quatre fois, et rien n'est arrivé. L'ordre est le
      // livrable ; une consigne qui le RECOMMANDE sans que rien ne le garde se relâche.
      const s = sectionDe(metier, /ordre d.ouverture/i, 'sur l’ordre d’ouverture');
      const etapes = etapesDe(s.corps).map((e) => ({ ...e, cle: e.libelle }));
      assert.ok(etapes.length >= 4, `l’ordre doit être une suite d’au moins 4 étapes (${etapes.length})`);
      for (const e of etapes) assert.ok(e.libelle, `l’étape ${e.rang} n’a pas de libellé en gras — son rang serait illisible`);

      const contexte = rangUnique(etapes, /CONTEXTE\.md/, 'lire son contexte');
      const ouvrir = rangUnique(etapes, /ouvre ta ligne/i, 'ouvrir sa ligne');
      const relever = rangUnique(etapes, /relève/i, 'relever');
      const parler = rangUnique(etapes, /parle/i, 'parler');

      assert.ok(contexte < ouvrir, `le contexte (rang ${contexte}) donne le canal : il se lit avant d’ouvrir (rang ${ouvrir})`);
      assert.ok(ouvrir < relever, `ouvrir sa ligne (rang ${ouvrir}) doit précéder le relèvement (rang ${relever})`);
      assert.ok(relever < parler, `relever (rang ${relever}) doit précéder la parole (rang ${parler})`);
    },
  },

  {
    id: 'anti-complaisance-en-tete',
    quoi: 'l’anti-complaisance ouvre les réflexes, et le « oui c’est possible » vit du côté de ce qu’on NE dit PAS',
    verifier({ metier }) {
      // Le réflexe qui compte le plus pour un agent face à un client : il insiste, l'agent
      // veut plaire, et le « oui c'est possible » sort tout seul. La garde porte sur la
      // POLARITÉ (de quel côté de la table la locution vit) et sur le RANG (elle ouvre la
      // liste). Un contresens la fait changer de colonne : le contrôle le voit.
      const s = sectionDe(metier, /réflexes/i, 'sur les réflexes');
      const lignes = tableDe(s.corps);
      assert.ok(lignes.length >= 4, `les réflexes doivent être énumérés (${lignes.length} trouvé·s)`);
      for (const l of lignes) {
        assert.equal(l.length, 4, `chaque réflexe porte son rang, son nom, la pression et la réponse : « ${l.join(' | ')} »`);
      }

      const rangs = lignes.map((l, i) => ({ rang: Number(l[0]), position: i, cle: l[1] }));
      const complaisance = rangs.filter((r) => /complaisance/i.test(r.cle));
      assert.equal(complaisance.length, 1, 'un seul réflexe d’anti-complaisance');
      assert.equal(complaisance[0].rang, 1, `l’anti-complaisance porte le rang ${complaisance[0].rang} au lieu de 1`);
      assert.equal(complaisance[0].position, 0, 'et elle ouvre la table — un réflexe listé en dernier se lit en dernier');

      // La polarité, colonne par colonne. `pression` = ce que l'envie de plaire fait dire ;
      // `reponse` = ce qu'on dit à la place. Une locution de complaisance qui passe à droite
      // fait dire au métier l'exact contraire de ce qu'il existe pour dire.
      const COMPLAISANTES = [/c.est possible/i, /devrait être prêt/i, /\bbientôt\b/i];
      const pressions = lignes.map((l) => l[2]).join(' ');
      for (const sonde of COMPLAISANTES) {
        assert.match(pressions, sonde, `${sonde} doit figurer du côté de ce que la pression fait dire`);
      }
      for (const l of lignes) {
        for (const sonde of COMPLAISANTES) {
          assert.ok(!sonde.test(l[3]), `« ${l[3]} » est proposé comme réponse alors qu’il porte ${sonde} — la polarité est inversée`);
        }
      }
    },
  },

  {
    id: 'faisabilite-remonte',
    quoi: '« est-ce possible ? » est du côté qui REMONTE au dirigeant',
    verifier({ metier }) {
      // Le seul cas qu'un agent tranchera de travers de bonne foi : la réponse paraît
      // factuelle et engage en réalité. S'il glisse dans la colonne « tu réponds seul »,
      // le métier enseigne l'inverse de ce qu'il existe pour dire.
      const s = sectionDe(metier, /frontière de l.engagement/i, 'sur la frontière de l’engagement');
      const lignes = tableDe(s.corps).filter((l) => l.some((c) => /est-ce possible/i.test(c)));
      assert.equal(lignes.length, 1, 'le cas doit figurer une fois exactement dans la table de la frontière');
      assert.ok(!/est-ce possible/i.test(lignes[0][0]), 'la faisabilité ne se répond pas seul');
      assert.match(lignes[0][1], /est-ce possible/i, 'la faisabilité remonte au dirigeant');
    },
  },

  {
    id: 'engagements-remontent',
    quoi: 'tout ce qui engage l’organisation est du côté qui remonte',
    verifier({ metier }) {
      // Couverture : un correctif qui ne garde qu'un des engagements laisse passer les
      // autres — le motif « une porte sur deux », trois fois sur D-20260805-0005.
      const s = sectionDe(metier, /frontière de l.engagement/i, 'sur la frontière de l’engagement');
      const droite = tableDe(s.corps).map((l) => l[1].toLowerCase()).join(' ');
      for (const engage of ['délai', 'prix', 'priorité', 'engagement']) {
        assert.ok(droite.includes(engage), `« ${engage} » doit figurer du côté qui remonte`);
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
        assert.equal(puces.filter((p) => sonde.test(p)).length, 1, `« ${quoi} » doit figurer une fois exactement`);
      }
      assert.match(s.corps, /refuse/i, 'le verbe doit être le refus, pas la préférence');
      assert.match(s.corps, /structurel/i, 'le cloisonnement est structurel, pas déclaratif');
      assert.match(s.corps, /fuite/i, 'et la section doit dire ce qu’une violation coûte');
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
      assert.ok(valider < lancer, `la validation (rang ${valider}) doit précéder le lancement (rang ${lancer})`);
    },
  },

  {
    id: 'anti-patterns-couverts',
    quoi: 'les fautes déjà commises sont toutes nommées comme des fautes',
    verifier({ metier }) {
      // Chacune de ces lignes a été payée une fois. Une table d'anti-patterns dont on
      // retire discrètement une ligne est le mode de régression le plus silencieux d'un
      // document : rien ne casse, et la faute redevient tentante.
      const s = sectionDe(metier, /anti-patterns/i, 'd’anti-patterns');
      const gauche = tableDe(s.corps).map((l) => l[0]);
      const FAUTES = [
        { quoi: 'relever avant d’être joignable', sonde: /avant d.avoir ouvert sa ligne/i },
        { quoi: 'répondre « oui c’est possible »', sonde: /c.est possible/i },
        { quoi: 'tout inscrire à la fin', sonde: /à la fin/i },
        { quoi: 'lancer avant validation', sonde: /avant que le client ait validé/i },
        { quoi: 'prendre un second client', sonde: /second client/i },
        { quoi: 'écrire ce qu’on sait du client dans le fichier généré', sonde: /CLAUDE\.md/ },
      ];
      for (const { quoi, sonde } of FAUTES) {
        assert.equal(gauche.filter((c) => sonde.test(c)).length, 1, `« ${quoi} » doit être nommée une fois exactement comme une faute`);
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
      const ouvertures = [...metier.matchAll(/\$LD ouvrir[^\n]*/g)].map((m) => m[0]);
      assert.equal(ouvertures.length, 1, 'une session, un client, un canal : une seule ouverture de ligne');
      assert.match(ouvertures[0], /--nature client/, 'le canal d’un client doit naître privé');
      assert.match(ouvertures[0], /--titre/, 'sans titre, la commande refuse d’ouvrir une ligne cliente');

      const titre = ouvertures[0].match(/--titre\s+"([^"]*)"/);
      assert.ok(titre, 'le titre doit être passé entre guillemets');
      assert.match(titre[1], /CONTEXTE\.md/, `le titre « ${titre[1]} » est écrit en dur : il doit venir du contexte du client`);
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
    quoi: 'aucun geste enseigné n’exécute le travail, ne prend la mise en ligne, ni ne renvoie de pièce au client',
    verifier({ metier }) {
      // HS-REL-001, HS-REL-003, HS-REL-005 et RA-REL-015. La tentation arrive toujours par
      // la même porte : « ce petit bout, c'est plus rapide ». Seul le mode IMPÉRATIF est
      // proscrit — la table des anti-patterns a le droit de nommer ce qu'on ne fait pas.
      for (const bloc of blocsBash(metier)) {
        for (const geste of ['git commit', 'git push', 'git checkout', 'npm publish', '/pousse', '/merge', 'supabase db']) {
          assert.ok(!bloc.includes(geste), `le métier enseigne « ${geste} » : un représentant ne réalise pas`);
        }
      }
      assert.match(metier, /lock_status/, 'il doit savoir LIRE l’état de la mise en ligne pour dire la vérité au client');
      for (const pris of ['lock_acquire', 'lock_release']) {
        assert.ok(!metier.includes(pris), `il ne prend ni ne rend le droit d’accès à la mise en ligne (« ${pris} »)`);
      }
      for (const envoi of ['files.upload', 'files_upload', 'chat.postMessage']) {
        assert.ok(!metier.includes(envoi), `il n’envoie rien au client (« ${envoi} ») : la réception seule est dans son périmètre`);
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

/**
 * Applique une mutation au seul en-tête (tout ce qui précède la première section).
 * Borner la portée garde la valeur de diagnostic : une mutation qui déborderait sur le
 * corps ferait rougir un autre contrôle, et on ne saurait plus lequel a réellement mordu.
 */
function dansEntete(texte, muter) {
  const coupe = texte.search(/^##\s/m);
  assert.ok(coupe > 0, 'le gabarit doit avoir un en-tête avant sa première section');
  return muter(texte.slice(0, coupe)) + texte.slice(coupe);
}

/** Remplace `a` par `b` et `b` par `a`, en une passe. Jette si l'un des deux manque. */
function permuter(texte, a, b) {
  assert.ok(texte.includes(a) && texte.includes(b), `permutation inapplicable : « ${a} » ou « ${b} » est absent`);
  const jeton = ' JETON ';
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
 */
export const MUTATIONS = [
  {
    id: 'relever-avant-d-etre-joignable',
    quoi: 'on relève l’historique avant d’ouvrir sa ligne — le défaut exact de T-20260806-0192',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Ouvre ta ligne.**', '**Relève ce qui existe déjà**'),
  },
  {
    id: 'parler-avant-de-relever',
    quoi: 'on parle au client avant d’avoir relevé son histoire',
    cible: 'ordre-ouverture',
    fichier: 'metier',
    muter: (t) => permuter(t, '**Relève ce qui existe déjà**', '**Alors seulement, parle.**'),
  },
  {
    id: 'complaisance-devient-la-reponse',
    quoi: 'le « oui c’est possible » passe du côté de ce qu’on dit — le contresens exact',
    cible: 'anti-complaisance-en-tete',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      '« Oui, c\'est possible » — parce qu\'il insiste et que refuser est inconfortable',
      '« Je ne peux pas te répondre là-dessus moi-même — je fais remonter la question »'
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
    id: 'un-interdit-de-cloisonnement-retire',
    quoi: 'la puce « une session ne change pas de client » disparaît',
    cible: 'cloisonnement',
    fichier: 'metier',
    muter: (t) => t.replace(
      /^- Si ta session porte déjà un client.*\n/m,
      ''
    ),
  },
  {
    id: 'le-refus-devient-une-preference',
    quoi: 'le cloisonnement cesse de refuser et se contente de déconseiller',
    cible: 'cloisonnement',
    fichier: 'metier',
    muter: (t) => t.replaceAll('**tu refuses**', '**c\'est déconseillé**'),
  },
  {
    id: 'on-lance-avant-de-faire-valider',
    quoi: 'le travail part avant que le client ait validé sa formulation',
    cible: 'validation-avant-lancement',
    fichier: 'metier',
    muter: (t) => permuter(
      t,
      'Faire valider la formulation — le point de bascule',
      'Lancer l\'exécution — c\'est toi qui appuies'
    ),
  },
  {
    id: 'la-faute-de-l-ordre-n-est-plus-nommee',
    quoi: 'l’anti-pattern « relever avant d’être joignable » disparaît de la table',
    cible: 'anti-patterns-couverts',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| Relever l'historique avant d'avoir ouvert sa ligne \|.*\n/m, ''),
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
    muter: (t) => t.replace('--nature client', '--type client'),
  },
  {
    id: 'une-commande-de-session-inventee',
    quoi: 'le métier enseigne un verbe de session qui n’existe pas — la famille de « herdr wait output »',
    cible: 'gestes-de-session-existants',
    fichier: 'metier',
    muter: (t) => t.replaceAll('herdr pane run', 'herdr wait output'),
  },
];

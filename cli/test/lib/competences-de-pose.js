// Les contrôles des DEUX compétences de pose — celle du représentant et celle de
// l'orchestrateur — et les mutations qui les mettent à l'épreuve.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER N'EST PAS UN TEST, ET POURQUOI IL EN PORTE DEUX
//
// Il est importé par DEUX suites qui ne demandent pas la même chose aux mêmes contrôles :
//
//   • `competence-orchestrateur.test.js` les exécute sur les compétences RÉELLES — ils
//     doivent passer ;
//   • `competence-orchestrateur-mutations.test.js` les exécute sur des versions RETOURNÉES
//     de ces textes — et exige que le contrôle VISÉ rougisse, pour chacune.
//
// Sans cette séparation, un contrôle décoratif reste vert pour toujours et personne ne le
// sait. C'est le motif dominant de ce dépôt — *la garde vérifie ce que le texte CONTIENT,
// pas ce qu'il FAIT* — qui a résisté à quatre passes de revue sur le lot jumeau.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUI EST FACTORISÉ ICI, ET CE QUI NE L'EST PAS
//
// Les deux compétences enveloppent des gestes désormais communs (la mécanique l'est déjà :
// `lieu-agent.js`, `roles.js`). Ce qui se factorise n'est donc PAS leur texte — elles
// n'enseignent pas la même chose, et leurs deux lieux comme leurs deux gabarits sont
// délibérément séparés — mais **les garanties que les deux doivent tenir** :
//
//   • un refus se prononce AVANT toute écriture, et le principe précède la procédure ;
//   • aucun message ne met un geste destructeur dans la bouche de qui le lit ;
//   • la PR s'ouvre en brouillon et ne se fusionne jamais toute seule ;
//   • tout ce que le texte ENSEIGNE existe réellement — gestes, options, sous-commandes,
//     compétences citées (EF-AGT-002).
//
// Les écrire une fois et les appliquer aux deux, c'est ce qui empêche la dérive que ce dépôt
// a déjà payée ailleurs : « deux sources qui disent la même chose divergent, c'est
// mécanique ». Le premier passage de cette garde a d'ailleurs trouvé son défaut du premier
// coup — la compétence du représentant envoyait `rm -rf` sur un lieu à demi posé, là où la
// commande, elle, dit depuis sa correction d'ÉCARTER (`mv … .ecarte`) parce qu'elle ne sait
// pas ce qu'un humain a mis là.
//
// Ce qui est propre à l'orchestrateur — pas de `--canal`, la ligne obligatoire, le rôle
// porté à la naissance — vit dans `CONTROLES_ORCHESTRATEUR`, en dessous.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { REPO, sectionDe, tableDe, colonne, blocsBash, exigeImperatif } from './metier-representant.js';
import { GESTES_QUI_DETRUISENT } from '../../../ligne-directe/tests/aide/gestes-qui-detruisent.js';

export { REPO };

/** Les deux compétences de pose, par la clé courte que les mutations utilisent pour les viser. */
export const COMPETENCES = {
  orchestrateur: { nom: 'orchestrateur', chemin: join('.claude', 'skills', 'orchestrateur', 'SKILL.md') },
  gestionnaire: { nom: 'gestionnaire-client', chemin: join('.claude', 'skills', 'gestionnaire-client', 'SKILL.md') },
};

export const CHEMIN_LIGNE = join('ligne-directe', 'bin', 'ligne-directe.js');
export const CHEMIN_NAISSANCE = join('naissance-representant', 'bin', 'naitre.js');
export const CHEMIN_CLI = join('cli', 'src', 'cli.js');
/** Les deux modules dont les motifs de refus sont RENDUS à l'appelant d'une pose. */
export const CHEMINS_REFUS = [join('ligne-directe', 'src', 'lieu-agent.js'), join('ligne-directe', 'src', 'orchestrateur.js')];

export function lireCompetences(racine = REPO) {
  const out = {};
  for (const [cle, c] of Object.entries(COMPETENCES)) out[cle] = readFileSync(join(racine, c.chemin), 'utf8');
  return out;
}

// ═════════════════════════════════════════ lecture de ce que les outils acceptent VRAIMENT

/**
 * Les gestes et options qu'un outil de ligne accepte réellement, lus dans SA SOURCE.
 *
 * EF-AGT-002 : le pack s'est déjà fait avoir par une compétence qui enseignait `herdr wait
 * output …`, une commande qui n'existe pas. Un texte n'exécute rien — la seule façon de
 * prouver qu'il n'invente pas est de confronter ce qu'il montre à ce que l'outil connaît.
 */
export function outilDeLigne(racine = REPO) {
  const src = readFileSync(join(racine, CHEMIN_LIGNE), 'utf8');
  const gestes = new Set();
  for (const m of src.matchAll(/geste === '([a-zà-ÿ-]+)'/g)) gestes.add(m[1]);
  const options = new Set();
  for (const m of src.matchAll(/'(--[a-zà-ÿ-]+)'/g)) options.add(m[1]);
  return { gestes, options };
}

/** Les options que la commande de naissance accepte réellement, lues dans sa source. */
export function outilDeNaissance(racine = REPO) {
  const src = readFileSync(join(racine, CHEMIN_NAISSANCE), 'utf8');
  const options = new Set();
  for (const m of src.matchAll(/'(--[a-zà-ÿ-]+)'/g)) options.add(m[1]);
  return { options };
}

/** Les sous-commandes que le CLI du pack accepte réellement. */
export function sousCommandesDuPack(racine = REPO) {
  const src = readFileSync(join(racine, CHEMIN_CLI), 'utf8');
  return new Set([...src.matchAll(/case '([a-z][a-z-]*)':\s*return await cmd/g)].map((m) => m[1]));
}

/**
 * Les motifs de refus que le CODE peut réellement rendre à une pose.
 *
 * Relevés sur les lignes `motif:` des deux modules — y compris la forme ternaire
 * (`motif: err instanceof JetonVide ? 'jeton_vide' : 'jeton_absent'`), qui en porte deux.
 * `motif: ligne.motif` ne porte aucun littéral et ne compte donc pour rien : c'est le relais
 * des motifs de l'autre module, déjà relevés là-bas.
 */
export function motifsDuCode(racine = REPO) {
  const motifs = new Set();
  for (const chemin of CHEMINS_REFUS) {
    const src = readFileSync(join(racine, chemin), 'utf8');
    for (const ligne of src.matchAll(/^\s*motif:\s*(.+)$/gm)) {
      for (const lit of ligne[1].matchAll(/'([a-z][a-z_]*)'/g)) motifs.add(lit[1]);
    }
  }
  return motifs;
}

/**
 * Ce que le CODE dit réellement de chaque motif — le texte du refus tel qu'il part vers
 * l'humain.
 *
 * ⚠️ POURQUOI CETTE FONCTION A ÉTÉ AJOUTÉE, ET PAR QUI. La première version des contrôles
 * gardait la table des refus par ses CODES seuls : `lieu_partiel` devait y avoir une ligne.
 * Une revue en passe 1 a posé la mutation qui manquait — remplacer l'explication d'un motif
 * par une phrase creuse en gardant le code entre ses accents graves — et la garde est restée
 * verte. C'était le motif dominant du dépôt, une fois de plus : on gardait la présence d'un
 * jeton de texte, pas ce que la ligne APPREND à qui la lit.
 *
 * Le refus qui appartient à `jeton_absent` et `jeton_vide` est écrit dans le trousseau, pas
 * dans les deux modules de pose : c'est lui qui nomme le compte et le service cherchés, et
 * c'est le texte que l'humain verra. On le lit donc là où il est.
 */
export function messagesDesMotifs(racine = REPO) {
  const lieu = readFileSync(join(racine, 'ligne-directe', 'src', 'lieu-agent.js'), 'utf8');
  const orchestrateur = readFileSync(join(racine, 'ligne-directe', 'src', 'orchestrateur.js'), 'utf8');
  const trousseau = readFileSync(join(racine, 'ligne-directe', 'src', 'trousseau.js'), 'utf8');

  /** Le corps du refus qui suit `motif: '<m>'`, jusqu'à la fermeture de son objet. */
  const blocApres = (src, motif) => {
    const i = src.indexOf(`motif: '${motif}'`);
    if (i === -1) return '';
    return src.slice(i, i + 1200);
  };
  /** Le corps d'une classe d'erreur, qui porte son message. */
  const classe = (src, nom) => {
    const i = src.indexOf(`class ${nom}`);
    return i === -1 ? '' : src.slice(i, i + 1200);
  };

  // La CONSÉQUENCE que le module de pose ajoute au message du trousseau — bornée à son bloc,
  // pas au fichier.
  //
  // ⚠️ RELEVÉ EN REVUE (passe 2) : ces deux motifs recevaient `orchestrateur.js` EN ENTIER,
  // cinq fois plus de vocabulaire que les trois autres. Le seuil de deux mots partagés est
  // alors bien plus facile à atteindre — la garde était donc plus lâche pour les deux motifs
  // qu'elle avait le plus de raisons de tenir. Une garde inégale selon la ligne qu'elle
  // regarde ne garde pas ce que son nom laisse croire.
  const iMessage = orchestrateur.indexOf('message:');
  const consequence = iMessage === -1 ? '' : orchestrateur.slice(iMessage, iMessage + 600);

  return {
    lieu_partiel: blocApres(lieu, 'lieu_partiel'),
    gabarits_absents: blocApres(lieu, 'gabarits_absents'),
    ecriture_interrompue: blocApres(lieu, 'ecriture_interrompue'),
    jeton_absent: classe(trousseau, 'JetonManquant') + consequence,
    jeton_vide: classe(trousseau, 'JetonVide') + consequence,
  };
}

/** Les mots porteurs d'un texte : cinq lettres ou plus, accents compris, casse écrasée. */
export function motsPorteurs(texte) {
  return new Set((String(texte).toLowerCase().match(/[a-zà-ÿ]{5,}/g) || []));
}

// ═════════════════════════════════════════ lecture de structure propre aux compétences

/** L'en-tête YAML d'une compétence, brut. */
export function enteteYaml(texte) {
  const m = texte.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'aucun en-tête lisible en tête de fichier — la compétence serait installée mais inerte');
  return m[1];
}

/**
 * Les invocations d'un outil, telles que la compétence les MONTRE — continuations `\` incluses.
 *
 * Le filtrage par outil n'est pas cosmétique : sans lui, `gh pr create --draft --title` ferait
 * accuser la compétence d'inventer des options de ligne directe qu'elle n'enseigne pas — un
 * faux positif, qui ne prouve rien et qu'on finit par désarmer.
 */
export function invocations(texte, variable) {
  // Les continuations sont recollées LIGNE À LIGNE, jamais par un motif unique. Un
  // `[^\n]*(?:\\\n[^\n]*)*` paraît naturel et ne marche pas : la première partie, gloutonne,
  // avale le `\` de fin de ligne, et il ne reste rien à quoi la continuation puisse
  // s'accrocher. L'invocation s'arrête alors à la première ligne — donc `--amorce`, écrite
  // sur la seconde, n'était jamais vue, et le contrôle qui garde les options restait vert
  // même en enseignant une option inventée. Trouvé par le harnais de mutation, pas en
  // relisant.
  const lignes = texte.split('\n');
  const out = [];
  for (let i = 0; i < lignes.length; i += 1) {
    if (!new RegExp(`\\$${variable}\\s`).test(lignes[i])) continue;
    let inv = lignes[i];
    while (inv.trimEnd().endsWith('\\') && i + 1 < lignes.length) {
      i += 1;
      inv += `\n${lignes[i]}`;
    }
    out.push(inv);
  }
  return out;
}

/** Les options citées sur les invocations d'un outil. */
export function optionsCitees(texte, variable) {
  const opts = new Set();
  for (const inv of invocations(texte, variable)) {
    for (const m of inv.matchAll(/--[a-zà-ÿ-]+/g)) opts.add(m[0]);
  }
  return opts;
}

/** Le corps du texte, en dehors des blocs de code — là où vivent les phrases, pas les gestes. */
export const horsBlocs = (texte) => texte.replace(/```[\s\S]*?```/g, '');

// ═════════════════════════════════════════ les contrôles COMMUNS aux deux compétences

/**
 * Chaque contrôle : { id, quoi, verifier({ texte, nom, racine }) } — jette si la garantie
 * n'est plus tenue. Exécutés tels quels sur les compétences réelles ET sur leurs mutants.
 */
export const CONTROLES_COMMUNS = [
  {
    id: 'le-principe-precede-la-procedure',
    quoi: 'le refus-avant-écriture est énoncé, il oblige, et il vient AVANT la procédure de pose',
    verifier({ texte }) {
      // POSITION, pas seulement présence : un lecteur pressé applique la procédure et lit le
      // principe ensuite — c'est-à-dire jamais. Le lot jumeau garde déjà cet ordre ; il vaut
      // pour les deux, et pour la même raison.
      const principe = sectionDe(texte, /principe/i, 'sur le principe qui gouverne le reste');
      const geste = sectionDe(texte, /^le geste/i, 'sur le geste de pose');
      const iPrincipe = texte.indexOf(principe.titre);
      const iGeste = texte.indexOf(geste.titre);
      assert.ok(iPrincipe > 0 && iGeste > 0, 'les deux sections doivent être repérables dans le texte');
      assert.ok(
        iPrincipe < iGeste,
        `le principe (position ${iPrincipe}) doit précéder la procédure (position ${iGeste}) — `
          + 'sinon on pose d’abord et on vérifie après',
      );

      // Il ne suffit pas d'être là ni d'être en tête : il faut que ça OBLIGE. « elle ne crée
      // rien tant qu'elle n'a pas de quoi finir » cesse de mordre dès qu'on y glisse « au
      // besoin » ou « tu peux ».
      exigeImperatif(principe.corps, 'le principe qui gouverne la pose');
      assert.match(
        principe.corps,
        /ne cr[ée]e rien tant qu/i,
        'le principe doit dire qu’elle ne crée RIEN tant qu’elle n’a pas de quoi finir',
      );
    },
  },

  {
    id: 'aucun-geste-qui-detruit',
    quoi: 'le texte ne met aucune commande destructrice dans la bouche de qui le lit',
    verifier({ texte, nom }) {
      // T-20260811-0087 : un refus affirmait que le jeton n'était pas au trousseau — il y
      // était — et donnait une commande qui l'ÉCRASE. Onze lignes vivantes en dépendaient.
      // Un message d'erreur est lu par quelqu'un qui a déjà un problème, qui fait confiance,
      // et qui colle : ce qu'on y écrit est exécuté. La garde vaut pour le texte qui PRESCRIT
      // autant que pour le message qui refuse — c'est le même lecteur, dans le même état.
      const trouves = GESTES_QUI_DETRUISENT.filter((g) => g.motif.test(texte)).map((g) => g.quoi);
      assert.deepEqual(trouves, [], `« ${nom} » envoie détruire :\n    ${trouves.join('\n    ')}`);
    },
  },

  {
    id: 'la-pr-reste-un-brouillon',
    quoi: 'la PR s’ouvre en brouillon, et rien dans les blocs ne fusionne, ne publie ni ne force',
    verifier({ texte, nom }) {
      const blocs = blocsBash(texte).join('\n');
      assert.match(
        blocs,
        /gh pr create --draft/,
        `« ${nom} » doit ouvrir sa PR en BROUILLON dès le premier commit`,
      );
      for (const interdit of ['gh pr merge', 'git push --force', 'npm publish', 'gh pr ready ']) {
        assert.ok(
          !blocs.includes(interdit),
          `« ${nom} » met « ${interdit} » dans un bloc à exécuter : elle ne fusionne, ne publie ni ne force rien`,
        );
      }
    },
  },

  {
    id: 'les-gestes-enseignes-existent',
    quoi: 'chaque geste et chaque option de ligne directe montrés existent dans la commande (EF-AGT-002)',
    verifier({ texte, nom, racine }) {
      const { gestes, options } = outilDeLigne(racine);
      assert.ok(gestes.size >= 5, 'les gestes de la commande n’ont pas été relevés — le contrôle ne prouverait rien');

      const cites = [...texte.matchAll(/\$LD\s+([a-zà-ÿ-]+)/g)].map((m) => m[1]);
      assert.ok(cites.length > 0, `« ${nom} » doit montrer au moins un geste de ligne`);
      for (const geste of cites) {
        assert.ok(gestes.has(geste), `« ${nom} » enseigne le geste « ${geste} », que la commande ne connaît pas`);
      }
      for (const option of optionsCitees(texte, 'LD')) {
        assert.ok(options.has(option), `« ${nom} » enseigne l’option « ${option} », que la commande ne connaît pas`);
      }
    },
  },

  {
    id: 'les-sous-commandes-du-pack-existent',
    quoi: 'chaque `npx @somtech-solutions/pack <sous-commande>` citée existe dans le CLI',
    verifier({ texte, nom, racine }) {
      const connues = sousCommandesDuPack(racine);
      assert.ok(connues.size >= 3, 'les sous-commandes du CLI n’ont pas été relevées — le contrôle ne prouverait rien');

      // Ancré sur le nom COMPLET du paquet, et borné à la même ligne : un `\s+` traverse les
      // retours à la ligne et prend le premier mot du paragraphe suivant pour une
      // sous-commande — « le pack » suivi d'un bloc `gh pr …` accusait la compétence
      // d'enseigner « pack pr ». Un faux positif finit toujours par faire désarmer la garde.
      const citees = [...texte.matchAll(/@somtech-solutions\/pack(?:@[a-z0-9.]+)?[ \t]+([a-z][a-z-]*)/g)].map((m) => m[1]);
      assert.ok(citees.length > 0, `« ${nom} » doit citer au moins une sous-commande du pack`);
      for (const cmd of citees) {
        assert.ok(connues.has(cmd), `« ${nom} » envoie lancer « pack ${cmd} », que le CLI ne connaît pas`);
      }
    },
  },

  {
    id: 'les-competences-citees-existent',
    quoi: 'chaque compétence renvoyée par son nom existe réellement sous .claude/skills/',
    verifier({ texte, nom, racine }) {
      // Un renvoi vers une compétence qui n'existe pas envoie le lecteur dans le vide, et
      // c'est la même famille que le geste inventé : ni l'un ni l'autre ne s'exécute jamais.
      const installees = new Set(readdirSync(join(racine, '.claude', 'skills')));
      const citees = new Set([...texte.matchAll(/(?:^|[\s(«])\/([a-z][a-z0-9-]{3,})/g)].map((m) => m[1]));
      for (const c of citees) {
        assert.ok(
          installees.has(c),
          `« ${nom} » renvoie vers /${c}, qui n’existe pas sous .claude/skills/ `
            + `(présentes : ${[...installees].slice(0, 6).join(', ')}…)`,
        );
      }
    },
  },

  {
    id: 'l-entete-declenche',
    quoi: 'l’en-tête déclare le nom du dossier et une description assez large pour déclencher',
    verifier({ texte, nom }) {
      const entete = enteteYaml(texte);
      const declare = entete.match(/^name:\s*(\S+)\s*$/m);
      assert.ok(declare, 'l’en-tête ne déclare pas de nom');
      assert.equal(declare[1], nom, 'le nom déclaré doit être celui du dossier, sinon l’invocation ne trouve rien');

      const description = entete.match(/^description:\s*([\s\S]+?)(?=\n[a-z-]+:|$)/m);
      assert.ok(description, 'l’en-tête ne déclare pas de description');
      assert.ok(
        description[1].trim().length > 120,
        'une description trop courte ne déclenche jamais la compétence',
      );
    },
  },
];

// ═════════════════════════════════════════ les contrôles PROPRES à l'orchestrateur

export const CONTROLES_ORCHESTRATEUR = [
  {
    id: 'les-motifs-de-refus-sont-au-complet',
    quoi: 'la table des refus couvre EXACTEMENT les motifs que le code peut rendre — ni un de moins, ni un inventé',
    verifier({ texte, racine }) {
      // Motif 3 du brief de revue : *un correctif qui ne couvre qu'une porte sur deux*. Une
      // table qui oublie un motif laisse le lecteur devant un refus qu'aucune ligne n'explique ;
      // une table qui en invente un envoie chercher un geste pour un cas qui n'arrive jamais.
      // Les deux sens sont donc gardés, et la référence est le CODE, jamais une liste recopiée.
      const attendus = motifsDuCode(racine);
      assert.ok(attendus.size >= 4, 'les motifs du code n’ont pas été relevés — le contrôle ne prouverait rien');

      const section = sectionDe(texte, /refuse/i, 'sur ce qui se passe quand elle refuse');
      const table = tableDe(section.corps);
      const cites = new Set(
        colonne(table, /^Motif rendu$/, 'le motif rendu')
          .map((c) => (c.match(/`([a-z_]+)`/) || [])[1])
          .filter(Boolean),
      );

      const manquants = [...attendus].filter((m) => !cites.has(m)).sort();
      assert.deepEqual(manquants, [], `ces motifs, que le code rend, n’ont aucune ligne dans la table : ${manquants.join(', ')}`);

      const inventes = [...cites].filter((m) => !attendus.has(m)).sort();
      assert.deepEqual(inventes, [], `ces motifs sont tabulés mais aucun code ne les rend : ${inventes.join(', ')}`);
    },
  },

  {
    id: 'chaque-ligne-de-refus-dit-ce-que-le-code-dit',
    quoi: 'l’explication et le geste de chaque motif recoupent le refus que le CODE rend vraiment',
    verifier({ texte, racine }) {
      // TROUVÉ EN REVUE (passe 1), et c'est le motif dominant du dépôt : le contrôle d'à côté
      // garde les CODES de la table — `lieu_partiel` doit y figurer. Vider la ligne de son
      // sens en gardant le code entre ses accents graves le laissait vert. La table pouvait
      // enseigner n'importe quoi.
      //
      // On compare donc chaque ligne au TEXTE DU REFUS que le code envoie réellement, par les
      // mots porteurs qu'ils partagent. Le seuil est de DEUX : un seul se rencontre par
      // hasard (« relance », « lieu » traînent partout), deux supposent qu'on parle de la même
      // chose.
      //
      // ⚠️ CE QUE CETTE GARDE NE COUVRE PAS, et il faut le savoir avant de s'y fier : une
      // explication remplacée par une AUTRE explication plausible mais fausse — deux mots
      // justes, un sens retourné — passerait. Aucune garde mécanique ne lit le sens ; celle-ci
      // ferme la porte du vidage, pas celle du contresens. La relecture humaine reste requise.
      const messages = messagesDesMotifs(racine);
      const section = sectionDe(texte, /refuse/i, 'sur ce qui se passe quand elle refuse');
      const table = tableDe(section.corps);
      const iMotif = table.entetes.findIndex((e) => /^Motif rendu$/.test(e));
      assert.ok(iMotif !== -1, 'la table des refus doit porter une colonne « Motif rendu »');

      for (const ligne of table.lignes) {
        const motif = (ligne[iMotif].match(/`([a-z_]+)`/) || [])[1];
        if (!motif) continue; // couvert par le contrôle voisin
        const source = messages[motif];
        assert.ok(source, `aucun message de code n’a été retrouvé pour « ${motif} » — le contrôle ne prouverait rien`);

        const dit = ligne.filter((_, i) => i !== iMotif).join(' ');
        const partages = [...motsPorteurs(dit)].filter((m) => motsPorteurs(source).has(m));
        assert.ok(
          partages.length >= 2,
          `la ligne « ${motif} » ne dit rien de ce que le refus dit vraiment `
            + `(${partages.length} mot·s en commun : ${partages.join(', ') || '—'}). `
            + `Ce qu’elle affirme : « ${dit} »`,
        );
      }
    },
  },

  {
    id: 'les-deux-refus-de-jeton-ne-se-confondent-pas',
    quoi: 'l’entrée ABSENTE et l’entrée VIDE restent chacune de son côté — leurs gestes ne sont pas les mêmes',
    verifier({ texte }) {
      // TROUVÉ EN REVUE (passe 2) : permuter le contenu des deux lignes en gardant leurs codes
      // laissait tout vert. Le recoupement de vocabulaire ne pouvait pas les séparer — les deux
      // refus parlent du même trousseau, du même compte, du même service. C'est un axe de
      // POLARITÉ, pas de vocabulaire.
      //
      // Et la distinction n'est pas une subtilité : `trousseau.js` l'ouvre par « les deux
      // erreurs qu'on ne doit jamais confondre ». L'absente se dépose (sans écraser) ; la vide
      // EXISTE, et remplacer une entrée en place suppose de détruire ce qui y est — c'est
      // pourquoi ce refus-là ne propose délibérément aucune commande. Un lecteur qui suit la
      // mauvaise ligne fait exactement le geste que T-20260811-0087 a interdit.
      const section = sectionDe(texte, /refuse/i, 'sur ce qui se passe quand elle refuse');
      const table = tableDe(section.corps);
      const iMotif = table.entetes.findIndex((e) => /^Motif rendu$/.test(e));
      const ligneDe = (motif) => {
        const l = table.lignes.find((x) => new RegExp(`\`${motif}\``).test(x[iMotif]));
        assert.ok(l, `la table doit porter une ligne « ${motif} »`);
        return l.filter((_, i) => i !== iMotif).join(' ');
      };

      const absent = ligneDe('jeton_absent');
      assert.match(absent, /aucune entrée|n[e’']a répondu|introuvable/i, '« jeton_absent » doit dire qu’AUCUNE entrée n’a répondu');
      assert.ok(
        !/l[e’']entrée existe/i.test(absent),
        '« jeton_absent » affirme que l’entrée existe : c’est le refus de l’entrée VIDE, pas celui-ci',
      );

      const vide = ligneDe('jeton_vide');
      assert.match(vide, /existe/i, '« jeton_vide » doit dire que l’entrée EXISTE — c’est ce qui le distingue de l’absence');
      assert.match(vide, /vide/i, '« jeton_vide » doit dire qu’elle est vide');
      assert.ok(
        !/aucune entrée/i.test(vide),
        '« jeton_vide » nie l’existence de l’entrée : il enverrait déposer là où il faut remplacer',
      );
    },
  },

  {
    id: 'aucun-geste-tabule-que-le-code-ne-propose',
    quoi: 'les commandes que la table met dans la bouche du lecteur sont celles que le refus propose',
    verifier({ texte, racine }) {
      // L'autre porte du même défaut. La garde des gestes destructeurs attrape les quatre
      // gestes qui coûtent ; celle-ci attrape le geste INVENTÉ — celui que le code ne propose
      // pas, qui n'a donc été mesuré par personne, et dont personne ne sait ce qu'il fait sur
      // le poste de qui le colle.
      const messages = messagesDesMotifs(racine);
      const section = sectionDe(texte, /refuse/i, 'sur ce qui se passe quand elle refuse');
      const table = tableDe(section.corps);
      const iMotif = table.entetes.findIndex((e) => /^Motif rendu$/.test(e));

      for (const ligne of table.lignes) {
        const motif = (ligne[iMotif].match(/`([a-z_]+)`/) || [])[1];
        if (!motif || !messages[motif]) continue;
        const commandes = [...ligne.join(' ').matchAll(/`([a-z][a-z0-9-]*)\s[^`]*`/g)].map((m) => m[1]);
        for (const verbe of commandes) {
          assert.ok(
            messages[motif].includes(verbe),
            `la ligne « ${motif} » propose « ${verbe} … », que le refus du code ne propose pas — `
              + 'un geste que personne n’a mesuré n’a rien à faire dans un message d’erreur',
          );
        }
      }
    },
  },

  {
    id: 'le-refus-se-relaie-tel-quel',
    quoi: 'le texte dit de recopier le message mesuré plutôt que de le reformuler en supposition',
    verifier({ texte }) {
      const section = sectionDe(texte, /refuse/i, 'sur ce qui se passe quand elle refuse');
      assert.match(
        section.corps,
        /mesur[ée]/i,
        'le refus doit être présenté comme ce qui a été MESURÉ, jamais comme une conclusion',
      );
      // LES DEUX SENS, parce qu'un seul ne couvrirait qu'une porte : l'injonction de relayer
      // doit être là, ET l'invitation à reformuler doit être absente. Un texte qui dirait
      // « relaie-le, ou résume-le dans tes mots » garderait le premier volet en rouvrant
      // exactement le défaut — c'est la reformulation qui a transformé « je n'ai pas su lire
      // l'entrée » en « le jeton n'est pas là ».
      assert.match(
        section.corps,
        /recopie-le/i,
        'le texte doit dire de RECOPIER le message de la commande, en toutes lettres',
      );
      const reformulation = section.corps.match(/résume-le|reformule-le|dans tes mots|réécris-le/i);
      assert.ok(
        !reformulation,
        `le texte invite à reformuler le refus (« ${reformulation && reformulation[0]} ») : `
          + 'une reformulation remplace ce qui a été mesuré par ce qu’on en conclut',
      );
      exigeImperatif(section.corps, 'la consigne de relais du refus');
    },
  },

  {
    id: 'la-ligne-est-obligatoire',
    quoi: 'aucune voie ne pose un orchestrateur sans ligne — la phrase de repli du lot jumeau n’a pas repoussé',
    verifier({ texte }) {
      // Arbitrage du dirigeant, 2026-08-12. L'ajout est un RETRAIT, et un retrait se défait
      // par mégarde plus facilement qu'un ajout : c'est pour ça qu'on le garde nommément.
      assert.ok(
        !/continue sans elle/i.test(texte),
        'la phrase de repli « continue sans elle » est réapparue : la ligne de l’orchestrateur est obligatoire',
      );
      const principe = sectionDe(texte, /principe/i, 'sur le principe qui gouverne le reste');
      assert.match(
        principe.corps,
        /ligne est donc obligatoire|ligne est obligatoire/i,
        'le principe doit dire que la ligne est obligatoire, pas seulement souhaitable',
      );
      // Les DEUX entrées, pas seulement celle qui fait parler : un orchestrateur qui poste
      // sans jamais entendre la réponse est sourd en croyant dialoguer.
      assert.match(
        principe.corps,
        /parler.*entendre|entendre.*parler/is,
        'le principe doit dire que sa ligne sert à parler ET à entendre — les deux entrées',
      );
    },
  },

  {
    id: 'aucun-canal-a-la-pose',
    quoi: 'la pose d’un orchestrateur ne montre jamais --canal, et le texte dit pourquoi',
    verifier({ texte }) {
      // L'option EXISTE dans la commande (le représentant s'en sert) : le contrôle de
      // conformité ne l'attraperait donc pas. C'est une frontière de métier, pas une faute
      // d'orthographe — un orchestrateur qui se brancherait sur un canal client y déverserait
      // des codes de chantier que le client n'a pas à voir.
      for (const inv of invocations(texte, 'LD')) {
        assert.ok(!/--canal/.test(inv), `une invocation de pose porte --canal : « ${inv.trim()} »`);
      }
      assert.match(
        horsBlocs(texte),
        /pas de `--canal`|n[e']est pas un oubli|ouvre sa propre ligne/i,
        'le texte doit dire POURQUOI il n’y a pas de --canal ici, sinon l’absence se lit comme un oubli',
      );
    },
  },

  {
    id: 'chaque-naissance-porte-son-role',
    quoi: 'aucune invocation de la naissance n’est montrée sans --role orchestrateur',
    verifier({ texte }) {
      // Le second trou du ticket. Mesuré, les deux cas : sans l'option, la naissance vise
      // `.gestionnaire/<nom>` — elle refuse en envoyant poser un représentant quand ce lieu
      // n'existe pas, et elle RÉUSSIT quand il existe, faisant naître une session
      // représentante sous le nom qu'on attendait de l'orchestrateur. La compétence porte donc
      // l'option pour l'utilisateur : c'est cette promesse-là qui est gardée ici.
      const invs = invocations(texte, 'NAITRE');
      assert.ok(invs.length > 0, 'la compétence doit montrer au moins une invocation de la naissance');
      for (const inv of invs) {
        assert.match(inv, /--role\s+orchestrateur\b/, `une naissance est montrée sans son rôle : « ${inv.trim()} »`);
      }
    },
  },

  {
    id: 'chaque-naissance-porte-son-depot',
    quoi: 'aucune invocation de la naissance n’est montrée sans --depot',
    verifier({ texte }) {
      // L'autre porte du même défaut : installée en outil de poste, la commande calcule son
      // dépôt par défaut depuis SA position (~/.somtech), jamais le tien. Sans --depot, on se
      // voit refuser un lieu qu'on vient de poser — un refus exact qui cherche au mauvais
      // endroit. Garder le rôle sans garder le dépôt ne couvrirait qu'une porte sur deux.
      for (const inv of invocations(texte, 'NAITRE')) {
        assert.match(inv, /--depot\b/, `une naissance est montrée sans --depot : « ${inv.trim()} »`);
      }
    },
  },

  {
    id: 'les-options-de-naissance-existent',
    quoi: 'chaque option de naissance montrée existe dans la commande (EF-AGT-002)',
    verifier({ texte, racine }) {
      const { options } = outilDeNaissance(racine);
      assert.ok(options.size >= 3, 'les options de la naissance n’ont pas été relevées — le contrôle ne prouverait rien');
      const citees = optionsCitees(texte, 'NAITRE');
      assert.ok(citees.size > 0, 'la compétence doit montrer au moins une option de naissance');
      for (const option of citees) {
        assert.ok(options.has(option), `la compétence enseigne « ${option} », que la naissance ne connaît pas`);
      }
    },
  },

  {
    id: 'le-lieu-est-celui-de-l-orchestrateur',
    quoi: 'le texte n’écrit que dans .orchestrateur/, jamais dans le lieu du représentant',
    verifier({ texte }) {
      // Les deux lieux sont délibérément séparés, et la compétence de pose est le dernier
      // endroit où une confusion serait invisible : le lecteur n'a pas de quoi la démentir.
      for (const bloc of blocsBash(texte)) {
        assert.ok(
          !/\.gestionnaire\//.test(bloc),
          `un bloc à exécuter touche au lieu du représentant :\n${bloc}`,
        );
      }
      assert.match(texte, /\.orchestrateur\//, 'le texte doit nommer le lieu qu’il pose');
    },
  },

  {
    id: 'le-contexte-se-remplit-avant-la-naissance',
    quoi: 'la consigne de remplir CONTEXTE.md précède la naissance, et elle oblige',
    verifier({ texte }) {
      // Sondes DISJOINTES, et ce n'est pas un détail d'écriture : la section du contexte
      // parle de la naissance dans son titre même (« Avant de le faire naître »). Deux sondes
      // qui reconnaissent la même section rendent deux fois la même position, et la
      // comparaison d'ordre devient une tautologie qui ne garde plus rien.
      const contexte = sectionDe(texte, /son contexte$/i, 'sur le contexte à remplir');
      const naissance = sectionDe(texte, /^L.y faire naître/i, 'sur la naissance');
      const iContexte = texte.indexOf(contexte.titre);
      const iNaissance = texte.indexOf(naissance.titre);
      assert.ok(iContexte > 0 && iNaissance > 0, 'les deux sections doivent être repérables');
      assert.ok(
        iContexte < iNaissance,
        'le contexte se remplit AVANT la naissance : un orchestrateur né sans portée écrite '
          + 'marche sur le chantier d’un autre, et rien ne le lui dit',
      );
      exigeImperatif(contexte.corps, 'la consigne de remplir le contexte');
    },
  },
];

// ═════════════════════════════════════════ exécution des contrôles

/**
 * Les contrôles qui rougissent sur un jeu de textes, identifiés `id@compétence`.
 *
 * Les communs tournent sur les DEUX compétences — c'est ce qui fait qu'un défaut corrigé
 * d'un côté ne peut plus survivre de l'autre.
 */
export function controlesQuiRougissent(textes, racine = REPO) {
  const rouges = [];
  const essayer = (id, fn) => {
    try {
      fn();
    } catch (e) {
      rouges.push({ id, message: e.message });
    }
  };

  for (const [cle, texte] of Object.entries(textes)) {
    for (const c of CONTROLES_COMMUNS) {
      essayer(`${c.id}@${cle}`, () => c.verifier({ texte, nom: COMPETENCES[cle].nom, racine }));
    }
  }
  for (const c of CONTROLES_ORCHESTRATEUR) {
    essayer(`${c.id}@orchestrateur`, () =>
      c.verifier({ texte: textes.orchestrateur, nom: COMPETENCES.orchestrateur.nom, racine }));
  }
  return rouges;
}

/** Tous les identifiants de contrôle, pour vérifier qu'aucun n'échappe aux mutations. */
export function idsDesControles() {
  const ids = [];
  for (const cle of Object.keys(COMPETENCES)) for (const c of CONTROLES_COMMUNS) ids.push(`${c.id}@${cle}`);
  for (const c of CONTROLES_ORCHESTRATEUR) ids.push(`${c.id}@orchestrateur`);
  return ids;
}

// ═════════════════════════════════════════ les mutations

/** Remplace la première occurrence, ou rend le texte inchangé — le harnais refuse alors la mutation. */
const remplacer = (texte, quoi, par) => texte.replace(quoi, par);

/**
 * Chaque mutation : { id, quoi, competence, cible, muter(texte) }.
 *
 * `cible` est l'identifiant COMPLET du contrôle qui doit rougir — pas « au moins un ». Les
 * contrôles se recouvrent (le principe et la ligne obligatoire lisent la même section) : se
 * contenter d'un rouge quelconque déclarerait gardées des garanties dont le contrôle dédié
 * ne garde rien.
 */
export const MUTATIONS = [
  {
    id: 'principe-apres-la-procedure',
    quoi: 'le principe passe APRÈS la procédure de pose — on pose d’abord, on vérifie ensuite',
    competence: 'orchestrateur',
    cible: 'le-principe-precede-la-procedure@orchestrateur',
    muter(t) {
      const principe = sectionDe(t, /principe/i, 'principe');
      const bloc = `## ${principe.titre}${principe.corps}`;
      return `${t.replace(bloc, '')}\n${bloc}`;
    },
  },
  {
    id: 'principe-assoupli',
    quoi: 'le principe cesse d’obliger — « au besoin »',
    competence: 'orchestrateur',
    cible: 'le-principe-precede-la-procedure@orchestrateur',
    muter: (t) => remplacer(t, 'elle **précède littéralement**', 'elle précède, au besoin,'),
  },
  {
    id: 'principe-du-gestionnaire-assoupli',
    quoi: 'le même relâchement, sur la compétence jumelle — la garde commune doit mordre des deux côtés',
    competence: 'gestionnaire',
    cible: 'le-principe-precede-la-procedure@gestionnaire',
    muter: (t) => remplacer(t, 'elle **précède littéralement**', 'tu peux la faire précéder'),
  },
  {
    id: 'refus-qui-envoie-detruire',
    quoi: 'la table des refus renvoie à `rm -rf` — le geste exact que le lot jumeau a payé',
    competence: 'orchestrateur',
    cible: 'aucun-geste-qui-detruit@orchestrateur',
    muter: (t) => remplacer(t, 'Écarte ce reste (`mv .orchestrateur', 'Supprime ce reste (`rm -rf .orchestrateur'),
  },
  {
    id: 'refus-qui-envoie-ecraser-le-jeton',
    quoi: 'le refus de ligne propose de redéposer le jeton — la commande qui écrase celui qui marchait',
    competence: 'orchestrateur',
    cible: 'aucun-geste-qui-detruit@orchestrateur',
    muter: (t) =>
      remplacer(
        t,
        'Suis la marche à suivre que le message donne',
        'Redépose-la : `security add-generic-password -U -a "$USER" -s ligne-directe-bot -w "$(pbpaste)"`',
      ),
  },
  {
    id: 'gestionnaire-qui-envoie-detruire',
    quoi: 'la compétence jumelle renvoie de nouveau à `rm -rf` — le défaut que cette garde a trouvé',
    competence: 'gestionnaire',
    cible: 'aucun-geste-qui-detruit@gestionnaire',
    muter: (t) => remplacer(t, 'Écarte ce reste (`mv .gestionnaire', 'Retire ce reste (`rm -rf .gestionnaire'),
  },
  {
    id: 'pr-ouverte-en-pret',
    quoi: 'la PR s’ouvre directement en prêt — la revue saute',
    competence: 'orchestrateur',
    cible: 'la-pr-reste-un-brouillon@orchestrateur',
    muter: (t) => remplacer(t, 'gh pr create --draft', 'gh pr create'),
  },
  {
    id: 'pr-fusionnee-toute-seule',
    quoi: 'un bloc fusionne la PR qu’il vient d’ouvrir',
    competence: 'orchestrateur',
    cible: 'la-pr-reste-un-brouillon@orchestrateur',
    muter: (t) => remplacer(t, 'gh pr create --draft', 'gh pr merge --squash && gh pr create --draft'),
  },
  {
    id: 'pr-du-gestionnaire-ouverte-en-pret',
    quoi: 'la compétence jumelle ouvre sa PR en prêt — la garde commune doit mordre des deux côtés',
    competence: 'gestionnaire',
    cible: 'la-pr-reste-un-brouillon@gestionnaire',
    muter: (t) => remplacer(t, 'gh pr create --draft', 'gh pr create'),
  },
  {
    id: 'geste-de-ligne-invente',
    quoi: 'la compétence enseigne un geste que la commande ne connaît pas',
    competence: 'orchestrateur',
    cible: 'les-gestes-enseignes-existent@orchestrateur',
    muter: (t) => remplacer(t, '$LD orchestrateur <nom>', '$LD poser-orchestrateur <nom>'),
  },
  {
    id: 'option-de-ligne-inventee',
    quoi: 'la compétence enseigne une option de ligne qui n’existe pas',
    competence: 'orchestrateur',
    cible: 'les-gestes-enseignes-existent@orchestrateur',
    muter: (t) => remplacer(t, '$LD orchestrateur <nom> [--depot <chemin>]', '$LD orchestrateur <nom> [--dossier <chemin>]'),
  },
  {
    id: 'sous-commande-du-pack-inventee',
    quoi: 'le geste qui débloque envoie lancer une sous-commande que le CLI ne connaît pas',
    competence: 'orchestrateur',
    cible: 'les-sous-commandes-du-pack-existent@orchestrateur',
    muter: (t) => remplacer(t, 'pack update', 'pack refresh'),
  },
  {
    id: 'competence-citee-inexistante',
    quoi: 'le texte renvoie vers une compétence qui n’existe pas',
    competence: 'orchestrateur',
    cible: 'les-competences-citees-existent@orchestrateur',
    muter: (t) => remplacer(t, '/orchestrer-chantier', '/orchestrer-le-chantier'),
  },
  {
    id: 'entete-au-mauvais-nom',
    quoi: 'l’en-tête déclare un autre nom que son dossier — la compétence est installée mais introuvable',
    competence: 'orchestrateur',
    cible: 'l-entete-declenche@orchestrateur',
    muter: (t) => remplacer(t, 'name: orchestrateur', 'name: poser-orchestrateur'),
  },
  {
    id: 'description-trop-etroite',
    quoi: 'la description se réduit à une ligne — la compétence ne se déclenche plus',
    competence: 'gestionnaire',
    cible: 'l-entete-declenche@gestionnaire',
    muter: (t) => t.replace(/^description:.*$/m, 'description: Pose un représentant.'),
  },
  {
    id: 'motif-de-refus-manquant',
    quoi: 'la table des refus perd le motif du lieu à demi posé — le plus grave du lot jumeau',
    competence: 'orchestrateur',
    cible: 'les-motifs-de-refus-sont-au-complet@orchestrateur',
    muter: (t) => t.replace(/^\| `lieu_partiel`.*$\n/m, ''),
  },
  {
    id: 'motif-de-refus-invente',
    quoi: 'la table tabule un motif qu’aucun code ne rend — le lecteur cherche un geste pour rien',
    competence: 'orchestrateur',
    cible: 'les-motifs-de-refus-sont-au-complet@orchestrateur',
    muter: (t) =>
      t.replace(
        /^(\| `jeton_vide`.*)$/m,
        '$1\n| `canal_absent` | Aucun canal de ce nom | Vérifie l’orthographe, ou fais créer le canal |',
      ),
  },
  {
    id: 'explication-de-refus-videe',
    quoi: 'la ligne d’un motif garde son code et perd ce qu’elle apprend — la mutation trouvée en revue',
    competence: 'orchestrateur',
    cible: 'chaque-ligne-de-refus-dit-ce-que-le-code-dit@orchestrateur',
    muter: (t) =>
      t.replace(
        /^\| `lieu_partiel` \|[^\n]*$/m,
        '| `lieu_partiel` | Rien de grave, ça arrive parfois | On verra plus tard |',
      ),
  },
  {
    id: 'les-deux-refus-de-jeton-permutes',
    quoi: 'le contenu des lignes « absente » et « vide » est échangé, codes intacts — la mutation de la passe 2',
    competence: 'orchestrateur',
    cible: 'les-deux-refus-de-jeton-ne-se-confondent-pas@orchestrateur',
    muter(t) {
      const absent = t.match(/^\| `jeton_absent` \|([^\n]*)$/m);
      const vide = t.match(/^\| `jeton_vide` \|([^\n]*)$/m);
      assert.ok(absent && vide, 'les deux lignes doivent exister pour être permutées');
      return t
        .replace(absent[0], `| \`jeton_absent\` |${vide[1]}`)
        .replace(vide[0], `| \`jeton_vide\` |${absent[1]}`);
    },
  },
  {
    id: 'refus-de-jeton-absent-qui-affirme-l-existence',
    quoi: 'la ligne « absente » affirme que l’entrée est là — elle enverrait remplacer au lieu de déposer',
    competence: 'orchestrateur',
    cible: 'les-deux-refus-de-jeton-ne-se-confondent-pas@orchestrateur',
    muter: (t) =>
      t.replace(
        /^\| `jeton_absent` \|[^|]*\|/m,
        '| `jeton_absent` | L’entrée existe au trousseau mais le poste ne sait pas la lire |',
      ),
  },
  {
    id: 'geste-invente-dans-la-table',
    quoi: 'la table propose une commande que le refus du code ne propose pas',
    competence: 'orchestrateur',
    cible: 'aucun-geste-tabule-que-le-code-ne-propose@orchestrateur',
    // Ancrée sur la LIGNE DE LA TABLE, pas sur la chaîne : le même geste est cité en
    // Prérequis, et un simple remplacement y mordait au lieu de la table — la mutation
    // changeait bien quelque chose, mais pas ce qu'elle prétendait éprouver.
    muter: (t) =>
      t.replace(
        /^(\| `gabarits_absents` \|[^|]*\|)[^\n]*$/m,
        '$1 `brew reinstall somtech-pack` sur ce poste |',
      ),
  },
  {
    id: 'refus-reformule-en-supposition',
    quoi: 'le texte invite à reformuler le refus plutôt qu’à relayer ce qui a été mesuré',
    competence: 'orchestrateur',
    cible: 'le-refus-se-relaie-tel-quel@orchestrateur',
    muter: (t) => remplacer(t, '**Recopie-le.', '**Résume-le dans tes mots.'),
  },
  {
    id: 'ligne-redevenue-facultative',
    quoi: 'la phrase de repli du lot jumeau repousse — « continue sans elle »',
    competence: 'orchestrateur',
    cible: 'la-ligne-est-obligatoire@orchestrateur',
    muter: (t) =>
      remplacer(
        t,
        'aucune voie « pose-le quand même, il fera sans »',
        'une voie de repli : si le poste ne peut pas l’ouvrir, continue sans elle',
      ),
  },
  {
    id: 'geste-de-ligne-invente-chez-le-gestionnaire',
    quoi: 'la compétence jumelle enseigne un geste que la commande ne connaît pas',
    competence: 'gestionnaire',
    cible: 'les-gestes-enseignes-existent@gestionnaire',
    muter: (t) => remplacer(t, '$LD representant <client>', '$LD representant-client <client>'),
  },
  {
    id: 'sous-commande-inventee-chez-le-gestionnaire',
    quoi: 'la compétence jumelle envoie lancer une sous-commande que le CLI ne connaît pas',
    competence: 'gestionnaire',
    cible: 'les-sous-commandes-du-pack-existent@gestionnaire',
    muter: (t) => remplacer(t, 'pack update', 'pack sync'),
  },
  {
    id: 'competence-inexistante-chez-le-gestionnaire',
    quoi: 'la compétence jumelle renvoie vers une compétence qui n’existe pas',
    competence: 'gestionnaire',
    cible: 'les-competences-citees-existent@gestionnaire',
    muter: (t) => remplacer(t, '/ligne-directe', '/ligne-direct'),
  },
  {
    id: 'une-seule-entree-suffit',
    quoi: 'la ligne n’a plus besoin que de faire parler — l’orchestrateur devient sourd sans le savoir',
    competence: 'orchestrateur',
    cible: 'la-ligne-est-obligatoire@orchestrateur',
    muter: (t) =>
      remplacer(
        t,
        "L'une fait **parler**, l'autre fait\n**entendre**.",
        "L'une fait **parler**, et c'est la seule qui compte à la pose.",
      ),
  },
  {
    id: 'canal-a-la-pose',
    quoi: 'la pose se branche sur un canal, comme celle du représentant',
    competence: 'orchestrateur',
    cible: 'aucun-canal-a-la-pose@orchestrateur',
    muter: (t) => remplacer(t, '$LD orchestrateur <nom> [--depot <chemin>]', '$LD orchestrateur <nom> --canal <canal> [--depot <chemin>]'),
  },
  {
    id: 'naissance-sans-role',
    quoi: 'l’invocation de la naissance perd son rôle — la session naît représentante',
    competence: 'orchestrateur',
    cible: 'chaque-naissance-porte-son-role@orchestrateur',
    muter: (t) => remplacer(t, '--role orchestrateur --depot', '--depot'),
  },
  {
    id: 'naissance-au-mauvais-role',
    quoi: 'le rôle est écrit, mais c’est celui du représentant',
    competence: 'orchestrateur',
    cible: 'chaque-naissance-porte-son-role@orchestrateur',
    muter: (t) => remplacer(t, '--role orchestrateur', '--role representant'),
  },
  {
    id: 'naissance-sans-depot',
    quoi: 'l’invocation perd son dépôt — la naissance cherche dans ~/.somtech',
    competence: 'orchestrateur',
    cible: 'chaque-naissance-porte-son-depot@orchestrateur',
    muter: (t) => remplacer(t, '--depot <chemin du dépôt> \\\n', '\\\n'),
  },
  {
    id: 'option-de-naissance-inventee',
    quoi: 'la compétence enseigne une option de naissance qui n’existe pas',
    competence: 'orchestrateur',
    cible: 'les-options-de-naissance-existent@orchestrateur',
    muter: (t) => remplacer(t, '[--amorce <fichier de brief>]', '[--brief <fichier de brief>]'),
  },
  {
    id: 'versement-dans-le-lieu-du-representant',
    quoi: 'le versement ajoute le lieu du représentant au lieu du sien',
    competence: 'orchestrateur',
    cible: 'le-lieu-est-celui-de-l-orchestrateur@orchestrateur',
    muter: (t) => remplacer(t, 'git add .orchestrateur/<nom>/', 'git add .gestionnaire/<nom>/'),
  },
  {
    id: 'contexte-apres-la-naissance',
    quoi: 'le contexte se remplit après la naissance — l’orchestrateur naît sans portée écrite',
    competence: 'orchestrateur',
    cible: 'le-contexte-se-remplit-avant-la-naissance@orchestrateur',
    muter(t) {
      const contexte = sectionDe(t, /contexte/i, 'contexte');
      const bloc = `## ${contexte.titre}${contexte.corps}`;
      return `${t.replace(bloc, '')}\n${bloc}`;
    },
  },
  {
    id: 'contexte-devenu-facultatif',
    quoi: 'remplir le contexte cesse d’obliger',
    competence: 'orchestrateur',
    cible: 'le-contexte-se-remplit-avant-la-naissance@orchestrateur',
    muter: (t) => remplacer(t, '**Remplis-le, ou fais-le remplir, avant la naissance.**', 'Tu peux le remplir avant la naissance.'),
  },
];

/** Les gabarits que ce module lit — pour que la suite vérifie qu'ils existent avant de conclure. */
export function cheminsLus(racine = REPO) {
  return [
    ...Object.values(COMPETENCES).map((c) => join(racine, c.chemin)),
    join(racine, CHEMIN_LIGNE),
    join(racine, CHEMIN_NAISSANCE),
    join(racine, CHEMIN_CLI),
    ...CHEMINS_REFUS.map((c) => join(racine, c)),
  ].filter((c) => existsSync(c));
}

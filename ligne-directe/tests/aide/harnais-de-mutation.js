// harnais-de-mutation.js — muter le code, exiger un rouge, et REFUSER de conclure quand
// l'instrument ne peut pas rendre de verdict.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE — un harnais faux a rendu « 8 sur 8 attrapées » sur du vent
//
// Le 2026-08-22, une campagne de mutation sur ce module a rendu deux comptes successifs
// (« 6/6 » puis « 2/2 »), et les DEUX ont dû être retirés. Cause exacte, mesurée après coup :
// le harnais copiait `ligne-directe/` SEUL hors du dépôt, alors que ses bancs importent
// `../../naissance-representant/` et lisent les gabarits de `.claude/templates/` à la RACINE.
// La copie rendait donc 69 rouges sur 757 SANS AUCUNE MUTATION — et chaque « rouge donc
// attrapée » l'était pour une raison sans rapport avec la mutation posée.
//
// > Un rouge prouve qu'au moins une chose était gardée. Il ne prouve JAMAIS que c'était la
// > mutation. Sans contrôle négatif, un harnais de mutation confirme tout ce qu'on lui
// > demande — et d'autant plus volontiers que la campagne est grande.
//
// ⚠️ ET CE N'EST PAS UNE RÉPARATION PONCTUELLE. La recette (« copier la racine ») est facile à
// perdre : elle tient dans un filtre de trois lignes que la prochaine main peut resserrer pour
// aller plus vite. C'est pourquoi le contrôle négatif est ici une CONDITION D'EXÉCUTION —
// `campagne` ne pose AUCUNE mutation tant que la copie intacte n'est pas verte — et pourquoi
// `le-harnais-de-mutation-ne-ment-pas.test.js` l'éprouve, plutôt que de compter sur l'intention
// de celui qui lance la campagne.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LES TROIS AUTRES FAUX TÉMOINS DE CETTE FAMILLE, ET COMMENT ILS SONT FERMÉS ICI
//
//   ① La mutation INOPÉRANTE. Un motif qui ne s'applique plus laisse le fichier intact ; la
//      suite reste verte, et un harnais naïf compte ce silence comme un verdict.
//      → `appliquer` doit changer le texte, sinon la mutation est rendue « INOPÉRANTE ».
//   ② MUTER EN GROUPE. Un rouge sur un lot dit qu'au moins UNE mutation était gardée, jamais
//      que toutes l'étaient. → une copie NEUVE et UNE SEULE mutation par tour.
//   ③ Un lancement QUI N'EXÉCUTE RIEN. Un import cassé, un chemin faux, un `--test` qui ne
//      trouve aucun fichier : le processus sort sans résumé, et « 0 échec » se lit comme un
//      succès. → le compte se PARSE, et son absence est un REFUS, jamais un zéro.

import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * La racine du DÉPÔT, pas celle du module.
 *
 * ⚠️ C'EST LA LIGNE QUI PORTE LA LEÇON. Copier `ligne-directe/` seul est le geste naturel — le
 * module qu'on éprouve est là — et c'est exactement ce qui a produit 69 faux rouges. Les bancs
 * de ce module traversent la frontière : ils importent `../../naissance-representant/` et
 * lisent `.claude/templates/`. Mesuré sur deux bancs témoins : `ligne-directe/` seul rend 3
 * rouges sans aucune mutation, la racine en rend 0.
 */
export function racineDuDepot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

/**
 * Jusqu'où un harnais peut s'emboîter avant de refuser.
 *
 * Deux, et pas un : au premier niveau tourne la suite mutée ; au second, les bancs « RÉEL » de
 * ce harnais, qui doivent pouvoir être éprouvés sous mutation comme n'importe quel autre code.
 * Au troisième, on refuse — mesuré avant la borne : 69 copies du dépôt en dix minutes.
 */
const PROFONDEUR_MAX = 2;

/** Ce qu'on n'emporte pas : lourd, régénérable, et sans effet sur un verdict de mutation. */
const ECARTES = new Set(['.git', 'node_modules']);

/**
 * Une copie neuve, prête à être mutée — jamais le dépôt lui-même.
 *
 * Le code du dépôt n'est JAMAIS modifié : une mutation laissée dans l'arbre de travail est le
 * défaut le plus cher de cette famille — elle survit à la campagne, se commit avec le reste, et
 * personne ne la cherche puisque le harnais s'est déclaré content.
 *
 * @param sousLaRacineSeulement  le sous-dossier À COPIER SEUL. N'existe QUE pour que le banc de
 *   ce harnais puisse reproduire la copie fautive et mesurer qu'elle est rouge. Aucune campagne
 *   réelle ne le passe.
 */
export function copierLeDepot({ racine = racineDuDepot(), sousLaRacineSeulement = null } = {}) {
  const dest = mkdtempSync(join(tmpdir(), 'mutation-'));
  const source = sousLaRacineSeulement ? join(racine, sousLaRacineSeulement) : racine;
  const cible = sousLaRacineSeulement ? join(dest, sousLaRacineSeulement) : dest;
  cpSync(source, cible, {
    recursive: true,
    dereference: false,
    filter: (chemin) => !ECARTES.has(basename(chemin)),
  });
  return dest;
}

/**
 * Lance `node --test` DANS la copie, et rend ce qu'il a réellement compté.
 *
 * @returns `{ tests, pass, fail, sortie }` — ou `{ refus }` quand le compte n'a pas pu être lu.
 *   Un lancement qui ne rend pas son résumé n'a rien prouvé : le rendre comme « 0 échec » ferait
 *   d'un import cassé le meilleur résultat possible de la campagne.
 */
export function lancerLaSuite(copie, { fichiers = [], sousDossier = 'ligne-directe', delaiMs = 600_000 } = {}) {
  // ⚠️ `sousDossier` EST UNE BORNE, ET ELLE SE DÉCLARE. Une campagne lancée sur la seule suite
  // de `ligne-directe` rendra SURVIVANTE toute mutation dont les seuls gardes vivent ailleurs
  // — `naissance-representant` importe `lieu-agent.js` et en a 513. `lancerToutesLesSuites`
  // existe pour ça ; qui appelle celle-ci mesure UNE suite et doit le savoir.
  // ⚠️ UN HARNAIS QUI SE RELANCE LUI-MÊME NE S'ARRÊTE JAMAIS — mesuré, 69 copies du dépôt en dix
  // minutes avant que la commande ne soit tuée. Les bancs de ce harnais VIVENT dans la suite
  // qu'il lance : sans liste de fichiers, `node --test` les retrouve dans la copie, ils
  // relancent une copie, et ainsi de suite. Le défaut est silencieux — chaque niveau a l'air de
  // travailler — et il remplit le disque avant de rendre quoi que ce soit.
  //
  // La borne est une PROFONDEUR, pas une exclusion de fichiers : un banc qu'on écarterait de la
  // copie cesserait d'être éprouvé sous mutation, ce qui est exactement le contraire du but.
  // Ici, le premier niveau tourne entier ; le second REFUSE, en le disant.
  //
  // ⚠️ ET C'EST UN PLAFOND DE PROFONDEUR, PAS UN REFUS AU PREMIER NIVEAU — corrigé après une
  // revue de fond. Refuser dès la profondeur 1 rendait ROUGES, dans toute copie, les cinq bancs
  // « RÉEL » de ce harnais : une campagne lancée par le chemin documenté (`lancerToutesLesSuites`
  // sans liste de fichiers) rendait alors 5 rouges au CONTRÔLE NÉGATIF, et `campagne` refusait
  // en accusant la recette de copie — un refus juste dans sa forme et FAUX dans son motif,
  // exactement le travers que ce fichier dit avoir corrigé pour `NODE_TEST_*`. Ces cinq bancs
  // n'étaient de surcroît jamais éprouvés sous mutation.
  //
  // À la profondeur 2, les bancs « RÉEL » passent des fichiers témoins bornés qui ne les
  // contiennent pas : la chaîne s'arrête d'elle-même, et le plafond la coupe de toute façon.
  const profondeur = Number(process.env.SOUS_HARNAIS_DE_MUTATION ?? 0);
  if (profondeur >= PROFONDEUR_MAX) {
    return {
      refus:
        `ce lancement est DÉJÀ à la profondeur ${profondeur} d’un harnais de mutation (plafond ` +
        `${PROFONDEUR_MAX}) : le relancer se répéterait sans fin. Une campagne se lance depuis le ` +
        'dépôt, jamais depuis une copie déjà en cours de mesure.',
    };
  }
  // ⚠️ LE RAPPORTEUR SE FORCE, ET L'ENVIRONNEMENT DU RUNNER SE RETIRE — les deux, mesurés.
  // Lancé DEPUIS un `node --test`, l'enfant hérite de `NODE_TEST_CONTEXT` et bascule sur un
  // autre rapporteur : le résumé change de forme, le compte devient introuvable, et la campagne
  // rend « la suite n'a rendu aucun compte » sur une suite qui a parfaitement tourné (code 0).
  // Le harnais refusait alors de conclure pour une raison qui n'a rien à voir avec le code
  // mesuré — un refus juste dans sa forme et faux dans son motif.
  const env = { ...process.env };
  for (const cle of Object.keys(env)) if (cle.startsWith('NODE_TEST_')) delete env[cle];
  env.SOUS_HARNAIS_DE_MUTATION = String(profondeur + 1);
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...fichiers], {
    cwd: join(copie, sousDossier),
    encoding: 'utf8',
    timeout: delaiMs,
    maxBuffer: 64 * 1024 * 1024,
    env,
  });
  const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const lire = (quoi) => {
    const m = sortie.match(new RegExp(`^\\u2139 ${quoi} (\\d+)$`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const tests = lire('tests');
  const pass = lire('pass');
  const fail = lire('fail');
  if (tests === null || fail === null) {
    return { refus: `la suite n’a rendu aucun compte (code ${r.status}, signal ${r.signal ?? 'aucun'})`, sortie };
  }
  if (tests === 0) {
    return { refus: 'la suite n’a exécuté AUCUN test — un lancement qui n’exécute rien ne garde rien', sortie };
  }
  return { tests, pass, fail, sortie };
}

/**
 * Les suites du dépôt que `lieu-agent.js` sert — TOUTES, pas seulement celle de son module.
 *
 * ⚠️ UNE MUTATION N'EST « SURVIVANTE » QUE PAR RAPPORT À CE QU'ON A LANCÉ. `lieu-agent.js` est
 * importé par `naissance-representant` (513 essais, dont le garde de naissance) : une campagne
 * qui ne lance que `ligne-directe` rendrait SURVIVANTE une mutation que l'autre suite attrape,
 * et le rapport dirait « garde manquante » là où la garde existe, ailleurs. Le dénominateur
 * d'un verdict de mutation, c'est l'ensemble des essais qu'on a fait tourner.
 *
 * @returns `{ tests, pass, fail, parSuite }` — la somme, et le détail par suite ; ou `{ refus }`
 *   dès qu'UNE suite n'a pas rendu son compte : une somme partielle se lit comme un total.
 */
export function lancerToutesLesSuites(copie, { suites = ['ligne-directe', 'naissance-representant'], delaiMs } = {}) {
  // Une liste vide rendrait `{tests: 0, fail: 0}` — un « tout va bien » qui n'a rien regardé.
  if (!suites.length) return { refus: 'aucune suite désignée : il n’y a rien à mesurer', parSuite: {} };
  const parSuite = {};
  let tests = 0;
  let pass = 0;
  let fail = 0;
  for (const entree of suites) {
    // Une suite se désigne par son dossier, ou par `{ sousDossier, fichiers }` quand on veut en
    // mesurer une part nommée plutôt que le tout.
    const { sousDossier, fichiers = [] } = typeof entree === 'string' ? { sousDossier: entree } : entree;
    const r = lancerLaSuite(copie, { sousDossier, fichiers, delaiMs });
    if (r.refus) return { refus: `suite « ${sousDossier} » : ${r.refus}`, parSuite };
    parSuite[sousDossier] = { tests: r.tests, pass: r.pass, fail: r.fail };
    tests += r.tests;
    pass += r.pass ?? 0;
    fail += r.fail;
  }
  return { tests, pass, fail, parSuite };
}

/**
 * Une campagne de mutation — et son PREMIER geste est de vérifier qu'elle peut conclure.
 *
 * @param mutations  `[{ id, appliquer(copie) → boolean }]` — `appliquer` rend `false` quand son
 *   motif ne s'applique plus. UNE seule est posée par copie.
 * @param preparer   `() → copie`, injecté pour que les bancs de ce harnais l'éprouvent sans
 *   copier 16 Mo à chaque cas.
 * @param lancer     `(copie) → { fail, tests } | { refus }`, idem.
 * @returns `{ verdictPossible, controleNegatif, resultats }`. Quand `verdictPossible` est
 *   `false`, `resultats` est VIDE et aucune mutation n'a été posée : l'instrument ne pouvait
 *   rien affirmer, et une campagne qui rendrait quand même des verdicts serait pire que rien.
 */
export function campagne({
  mutations = [],
  preparer,
  lancer,
  ranger = (c) => rmSync(c, { recursive: true, force: true }),
} = {}) {
  // ═══ LE CONTRÔLE NÉGATIF, ET IL PASSE AVANT TOUT LE RESTE.
  const intacte = preparer();
  let temoin;
  try {
    temoin = lancer(intacte);
  } finally {
    ranger(intacte);
  }
  if (temoin.refus) {
    return { verdictPossible: false, controleNegatif: temoin, resultats: [] };
  }
  // ⚠️ UNE COPIE QUI N'A EXÉCUTÉ AUCUN ESSAI N'EST PAS UNE COPIE VERTE — REJET de revue de fond.
  // `lancerLaSuite` porte cette garde ; les deux étages au-dessus ne l'avaient pas, et une
  // campagne pouvait conclure « SURVIVANTE » sur un contrôle négatif à `{tests: 0, fail: 0}`.
  // Le mensonge penche du côté prudent — il sur-déclare des gardes manquantes plutôt que d'en
  // bénir l'absence — mais c'est un verdict rendu sans contrôle, et le harnais est versionné
  // comme l'instrument qui refuse précisément cela.
  if (!(temoin.tests > 0)) {
    return {
      verdictPossible: false,
      controleNegatif: {
        ...temoin,
        refus:
          `la copie NON MUTÉE n’a exécuté AUCUN essai (${temoin.tests ?? 'aucun compte'}) : « zéro rouge » ` +
          'n’y dit rien du tout. Vérifier les suites et les fichiers désignés avant toute campagne.',
      },
      resultats: [],
    };
  }
  if (temoin.fail !== 0) {
    return {
      verdictPossible: false,
      controleNegatif: {
        ...temoin,
        refus:
          `la copie NON MUTÉE rend déjà ${temoin.fail} rouge(s) sur ${temoin.tests} : ce harnais ne peut ` +
          'ni confirmer ni infirmer une mutation. Le geste attendu est de réparer la COPIE (la racine du ' +
          'dépôt, pas le seul module), jamais d’excuser ces rouges.',
      },
      resultats: [],
    };
  }

  const resultats = [];
  for (const m of mutations) {
    // ⚠️ UNE COPIE NEUVE PAR MUTATION. Les cumuler ferait qu'un rouge dirait « au moins une des
    // n posées était gardée » — ce qui laisse passer une survivante derrière une attrapée.
    //
    // ⚠️ ET LA PRÉPARATION EST DANS LE `try` — trouvé en revue de fond. Hors du `try`, un disque
    // plein à la troisième copie faisait JETER la campagne, qui perdait alors les DEUX verdicts
    // déjà acquis. S'arrêter est juste ; s'arrêter les mains vides ne l'est pas : on rend ce
    // qu'on a mesuré, et on NOMME ce qu'on n'a pas pu poser.
    let copie;
    try {
      copie = preparer();
    } catch (err) {
      resultats.push({ id: m.id, verdict: 'INDÉCIDABLE', pourquoi: `la copie n’a pas pu être faite (${err?.message || err})` });
      continue;
    }
    try {
      const posee = m.appliquer(copie);
      if (posee === false) {
        resultats.push({ id: m.id, verdict: 'INOPÉRANTE', pourquoi: 'le motif ne s’applique plus au code' });
        continue;
      }
      const r = lancer(copie);
      if (r.refus) {
        resultats.push({ id: m.id, verdict: 'INDÉCIDABLE', pourquoi: r.refus });
        continue;
      }
      resultats.push({ id: m.id, verdict: r.fail > 0 ? 'attrapée' : 'SURVIVANTE', rouges: r.fail, tests: r.tests });
    } finally {
      ranger(copie);
    }
  }
  return { verdictPossible: true, controleNegatif: temoin, resultats };
}

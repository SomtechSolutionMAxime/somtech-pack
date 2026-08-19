#!/usr/bin/env node
// MESURE CE QUE VAUT LA GARDE DU REFUS — les DEUX chiffres, pas un (T-20260819-0009).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE
//
// Le lot qui a posé cette garde annonçait « 8 mutations, 0 survivante — 12 leurres sur 12
// attrapés, 0 refus à tort sur 15 ». Une passe de fond a relevé que **ces chiffres n'étaient
// reproductibles par personne** : le harnais qui les produisait vivait dans un dossier de
// travail jetable. Un compte qu'on ne peut pas rejouer n'est pas un compte — c'est une
// affirmation, et elle se périme au premier changement de la garde sans que personne le voie.
//
// Ce script les rejoue. Il ne touche JAMAIS le dépôt : il copie le module dans un dossier
// temporaire, y mute un point à la fois, et compare à la baseline de cette copie.
//
// Usage :  node scripts/mesure-garde-du-refus.mjs
// Rend 0 si la garde tient (aucune mutation survivante, aucun leurre passé, aucun refus à tort).

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const MODULE = resolve(ICI, '..');
const RACINE = resolve(MODULE, '..');
const CIBLES = ['tests/un-refus-ne-tait-pas-le-geste-pose.test.js', 'tests/livrer-bin.test.js'];

// ⚠️ LES DEUX PROSES SONT LUES DANS LE SOURCE, JAMAIS RECOPIÉES ICI. Une copie divergerait le
// jour où on retouche le texte, et le harnais mesurerait alors une phrase qui n'existe plus —
// en rendant « 0 survivante » sur des mutations qui ne s'appliquent à rien.
const source = readFileSync(join(MODULE, 'src/livraison.js'), 'utf8');
const proseDe = (marque) => {
  const debut = source.indexOf(marque);
  if (debut === -1) throw new Error(`prose introuvable dans src/livraison.js : ${marque}`);
  const fin = source.indexOf("presser une autre.'", debut);
  if (fin === -1) throw new Error(`fin de prose introuvable pour : ${marque}`);
  return source.slice(source.lastIndexOf("'", debut), fin + "presser une autre.'".length);
};
const ACCEPTE = proseDe('ET UNE TOUCHE D’ENVOI EST DÉJÀ PARTIE');
const REFUSE = proseDe('ET LA TOUCHE D’ENVOI A ÉTÉ TENTÉE');

const DIALOGUE = "'\\n⚠️ ET JE N’AI PAS TENTÉ DE LE SOUMETTRE : un DIALOGUE attendait un choix.'";

/** Ce qui NIE le geste, ou en attribue une issue fausse. La garde doit tout attraper. */
const LEURRES = {
  'phrase vide': "''",
  'espace blanc': "'\\n   '",
  'texte quelconque': "'\\n⚠️ Quelque chose n’a pas fonctionné, va voir ce pane.'",
  'phrase du dialogue': DIALOGUE,
  'négation': "'\\n⚠️ Je n’ai RIEN soumis vers ce pane.'",
  'conditionnel': "'\\n⚠️ Une touche d’envoi aurait confirmé l’option surlignée.'",
  'conditionnel passé': "'\\n⚠️ La touche d’envoi aurait déjà été pressée si la boîte l’avait permis.'",
  'conditionnel + déni ailleurs': "'\\n⚠️ J’ai déjà relu l’écran : la touche d’envoi aurait normalement dû suffire, ' + 'mais je ne l’ai pas encore essayée.'",
  'futur': "'\\n⚠️ Une touche d’envoi partira vers ce pane si tu relances.'",
  'parle de la boîte seule': "'\\n⚠️ La boîte de ce pane est restée pleine malgré mon passage.'",
  'parle du texte, pas du geste': "'\\n⚠️ Ton texte est déjà dans la boîte de ce pane, entier.'",
  // ⚠️ CE LEURRE-CI ÉTAIT DANS LES FORMULATIONS HONNÊTES JUSQU'À LA QUATRIÈME PASSE DE FOND.
  // Il annonce le geste, au passé, sans rien nier — et il ne dit pas ce que le geste laisse
  // derrière lui. C'est très exactement la mutation qui survivait. Ce qui devient inacceptable
  // change de camp ; on ne le retire pas du jeu, sinon plus rien ne mesure la nouvelle exigence.
  'annonce le geste SANS sa conséquence': "'\\n⚠️ Une touche d’envoi est déjà partie vers ce pane. Va le regarder.'",
  'INVERSION à sens unique': "'\\n⚠️ ET LA TOUCHE D’ENVOI DE CE PANE A ÉTÉ REFUSÉE PAR HERDR : elle est déjà partie, ' + 'mais herdr l’a repoussée, donc rien ne l’a atteinte.'",
};

/** Le même fait, écrit autrement. La garde ne doit en refuser AUCUNE. */
const HONNETES = {
  courte: "'\\n⚠️ Une touche d’envoi est déjà partie vers ce pane, et elle n’a pas suffi.'",
  'je-forme': "'\\n⚠️ J’ai déjà pressé la touche d’envoi sur ce pane, et la boîte n’a pas bougé.'",
  passive: "'\\n⚠️ La touche d’envoi a déjà été envoyée à ce pane, sans effet.'",
  majuscules: "'\\n⚠️ ATTENTION : LA TOUCHE D’ENVOI EST DÉJÀ PARTIE ICI, ET ELLE N’A PAS SUFFI.'",
  'ordre inverse': "'\\n⚠️ La boîte n’a pas été vidée, alors que la touche d’envoi est déjà partie.'",
  irréversible: "'\\n⚠️ Un geste irréversible a déjà eu lieu ici : la touche d’envoi, partie de ma main.'",
  "apostrophe droite": "'\\n⚠️ Une touche d\\'envoi est déjà partie vers ce pane, sans vider la boîte.'",
  'très longue': "'\\n⚠️ Avant de toucher à ce pane : j’ai pressé la touche d’envoi, herdr l’a acceptée, ' + 'et la boîte n’a pas été vidée pour autant.'",
  'sans accent': "'\\n⚠️ Une touche d’envoi est deja partie vers ce pane, sans effet sur la boite.'",
  'appuyé sur Entrée': "'\\n⚠️ J’ai déjà appuyé sur Entrée dans ce pane, et la boîte est restée pleine.'",
  'frappe de soumission': "'\\n⚠️ La frappe de soumission est déjà partie vers ce pane, sans effet.'",
  "raccourci d’envoi": "'\\n⚠️ Le raccourci d’envoi a déjà été utilisé sur ce pane, sans vider la boîte.'",
  '« aurait » dans une autre proposition': "'\\n⚠️ La touche d’envoi est déjà partie vers ce pane sans le vider — quelqu’un aurait pu ' + 'm’avertir que cette boîte était fragile, mais le geste a eu lieu.'",
  'acceptation nommée': "'\\n⚠️ La touche d’envoi est déjà partie, herdr l’a acceptée, et la boîte n’a pas bougé.'",
  'rejet EN AVAL, pas par herdr': "'\\n⚠️ J’ai déjà pressé la touche d’envoi et herdr a accepté ce geste, mais la session a ' + 'ensuite rejeté ma commande sans vider la boîte.'",
};

const bac = mkdtempSync(join(tmpdir(), 'mesure-garde-refus-'));
const copie = join(bac, 'naissance-representant');
cpSync(MODULE, copie, { recursive: true });
cpSync(join(RACINE, 'ligne-directe'), join(bac, 'ligne-directe'), { recursive: true });

const LIVRAISON = join(copie, 'src/livraison.js');
const BANC_BIN = join(copie, 'tests/livrer-bin.test.js');
const livraison0 = readFileSync(LIVRAISON, 'utf8');
const bancBin0 = readFileSync(BANC_BIN, 'utf8');

/** Les essais qui échouent — le nom seul, pour se soustraire à la baseline. */
function echecs(fichiers = CIBLES) {
  let sortie = '';
  try {
    sortie = execFileSync(process.execPath, ['--test', ...fichiers], { cwd: copie, stdio: 'pipe' }).toString();
  } catch (err) {
    sortie = (err.stdout ?? '').toString();
  }
  return new Set(
    sortie.split('\n').filter((l) => l.startsWith('✖') && !l.includes('failing tests')).map((l) => l.split('(')[0].trim())
  );
}

// ⚠️ LA BASELINE SE MESURE AVANT DE MUTER — une copie hors dépôt n'a pas le reste du dépôt, et
// certains essais y échouent pour cette seule raison. Sans elle, chaque mutation paraîtrait
// mordre, y compris celles qui survivent.
const BASELINE = echecs();
const remettre = () => {
  writeFileSync(LIVRAISON, livraison0);
  writeFileSync(BANC_BIN, bancBin0);
};
const muter = (fichier, avant, apres, original) => {
  if (original.split(avant).length - 1 !== 1) throw new Error(`ancre absente ou multiple : ${avant.slice(0, 50)}`);
  writeFileSync(fichier, original.replace(avant, apres));
};
/** Rend vrai si la mutation a fait rougir au moins un essai qui ne rougissait pas déjà. */
// ⚠️ TOUT PASSE PAR LES DEUX PORTES — le module ET le vrai exécutable (`CIBLES`). C'est lent :
// le banc du binaire lance `bin/livrer.js` à chaque cas. C'est le prix de la seule chose qui
// compte ici — une prose peut être juste dans le module et ne jamais franchir le binaire, défaut
// exact de T-20260818-0031. Une conséquence à connaître avant de lire un « rougit » : il suffit
// qu'UNE des deux portes attrape. Pour éprouver ce banc lui-même, il faut donc désarmer la garde
// AUX DEUX ENDROITS — ne la retirer que d'un côté rend un vert qu'on croit à tort probant.
const mord = () => [...echecs()].some((e) => !BASELINE.has(e));

const MUTATIONS = [
  ['la prose du cas ACCEPTÉ retirée', LIVRAISON, ACCEPTE, "''", livraison0],
  ['la prose du cas ACCEPTÉ ← celle du dialogue', LIVRAISON, ACCEPTE, DIALOGUE, livraison0],
  ['la prose du cas REFUSÉ retirée', LIVRAISON, REFUSE, "''", livraison0],
  ['la prose du cas REFUSÉ ← celle du cas accepté', LIVRAISON, REFUSE, ACCEPTE, livraison0],
  ['le cas REFUSÉ ← un texte qui affirme l’inverse', LIVRAISON, REFUSE, LEURRES['négation'], livraison0],
  // ⚠️ CETTE MUTATION-CI INJECTAIT LE MÊME TEXTE QUE CELLE DU DIALOGUE, deux lignes plus haut —
  // relevé en quatrième passe de fond. Le tableau annonçait donc une couverture d'un cran
  // supérieure à celle qu'il payait. Un compte gonflé par une redondance qu'on n'a pas vue reste
  // un compte faux, même quand chaque ligne est vraie prise seule.
  ['le cas ACCEPTÉ ← un texte qui affirme l’inverse', LIVRAISON, ACCEPTE, LEURRES['négation'], livraison0],
  ['le cas ACCEPTÉ ← une INVERSION à sens unique', LIVRAISON, ACCEPTE, LEURRES['INVERSION à sens unique'], livraison0],
  [
    'le double herdr : `enterUtile` revenu à son ancienne formule',
    BANC_BIN,
    'const enterUtile  = enterEnvoye && !sc.enterInoperant && !sc.enterRefuse;',
    'const enterUtile  = enterEnvoye && !sc.enterInoperant;',
    bancBin0,
  ],
  [
    'la CONSÉQUENCE retirée du cas ACCEPTÉ — l’annonce du geste reste',
    LIVRAISON,
    ACCEPTE,
    "'\\n⚠️ ET UNE TOUCHE D’ENVOI EST DÉJÀ PARTIE VERS CE PANE : le texte était bien dans la ' + 'boîte, je l’ai donc soumis — herdr a accepté ce geste. Va le regarder avant d’en presser une autre.'",
    livraison0,
  ],
  [
    'les libellés de la boîte permutés (illisible ↔ vide)',
    LIVRAISON,
    "reste === null ? 'illisible' : reste === '' ? 'vide'",
    "reste === null ? 'vide' : reste === '' ? 'illisible'",
    livraison0,
  ],
];

let survivantes = 0;
console.log(`baseline de la copie : ${BASELINE.size} essai(s) rouge(s) — soustraits partout\n`);
console.log('── CE QU’ELLE ATTRAPE — mutations du code, un point à la fois');
for (const [nom, fichier, avant, apres, original] of MUTATIONS) {
  muter(fichier, avant, apres, original);
  const ok = mord();
  if (!ok) survivantes += 1;
  console.log(`   ${ok ? 'rougit  ' : '⚠️ SURVIT'} │ ${nom}`);
  remettre();
}

// ⚠️ LES VARIANTES SE POSENT SUR LES DEUX BRANCHES, PAS UNE. Relevé en quatrième passe de fond :
// tout était injecté dans la prose du cas ACCEPTÉ, si bien que « 12 sur 12 » caractérisait la
// robustesse d'UN emplacement, jamais celle des deux. Les leurres passent maintenant par les
// deux ; les formulations honnêtes, elles, sont écrites pour le cas ACCEPTÉ (elles annoncent un
// geste abouti) et n'ont de sens que là — c'est dit plutôt que passé sous silence.
const BRANCHES = [
  ['cas ACCEPTÉ', ACCEPTE],
  ['cas REFUSÉ', REFUSE],
];

let passes = 0;
let leurresPoses = 0;
console.log('\n── CE QU’ELLE ATTRAPE — textes qui nient le geste ou en faussent l’issue');
for (const [ouNom, ou] of BRANCHES) {
  for (const [nom, texte] of Object.entries(LEURRES)) {
    // Injecter dans une branche le texte qui est déjà le sien ne mesure rien.
    if (texte === ou) continue;
    muter(LIVRAISON, ou, texte, livraison0);
    leurresPoses += 1;
    const ok = mord();
    if (!ok) passes += 1;
    console.log(`   ${ok ? 'rougit  ' : '⚠️ PASSE '} │ ${nom} — ${ouNom}`);
    remettre();
  }
}

let refusesATort = 0;
console.log('\n── CE QU’ELLE REFUSE À TORT — le même fait, écrit autrement');
for (const [nom, texte] of Object.entries(HONNETES)) {
  muter(LIVRAISON, ACCEPTE, texte, livraison0);
  const rouge = mord();
  if (rouge) refusesATort += 1;
  console.log(`   ${rouge ? '⚠️ REFUSÉ' : 'acceptée'} │ ${nom}`);
  remettre();
}

rmSync(bac, { recursive: true, force: true });

console.log(
  `\n→ mutations survivantes : ${survivantes} / ${MUTATIONS.length}` +
    `\n→ leurres passés        : ${passes} / ${leurresPoses} (chaque leurre sur les deux branches)` +
    `\n→ refusés à tort        : ${refusesATort} / ${Object.keys(HONNETES).length} (branche ACCEPTÉ — les formulations annoncent un geste abouti)`
);
process.exit(survivantes + passes + refusesATort === 0 ? 0 : 1);

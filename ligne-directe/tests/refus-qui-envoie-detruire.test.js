// UN JETON PRÉSENT DÉCLARÉ ABSENT — et le refus qui envoie détruire celui qui marche.
//
// VÉCU, 2026-08-11 (T-20260811-0087). Le dirigeant pose un représentant depuis une session
// fraîche. La commande refuse : « le jeton `ligne-directe-bot` n'est pas au trousseau de ce
// poste ». **Il y était.** Entrée présente, bon service, bon compte — et la ligne directe de
// l'orchestrateur parlait au même moment, sur le même poste.
//
// La cause : le compte sous lequel on interroge le trousseau sortait d'une VARIABLE
// D'ENVIRONNEMENT (`USER`, puis `LOGNAME`). Une session qui ne les porte pas — et il en
// existe, c'est tout le sujet — cherchait donc sous le compte « » (vide). `security` ne
// trouvait rien, et ce rien était traduit en « il n'y a pas de jeton ».
//
// CE QUI REND CE DÉFAUT PIRE QU'UN MESSAGE IMPRÉCIS, et c'est ce que ce fichier garde :
// le refus donnait une marche à suivre qui ÉCRASE l'entrée du trousseau (`-U`). Un dirigeant
// qui la suit sans avoir le bon jeton en main détruit celui qui marchait, et coupe les onze
// lignes de discussion vivantes du poste — dont celle par laquelle on lui parle.
//
// Un refus n'a donc pas seulement à être poli. Il doit :
//   1. chercher sous le compte RÉEL, que l'environnement le dise ou non ;
//   2. dire ce qu'il A CHERCHÉ (compte, service), jamais affirmer plus qu'il n'a mesuré ;
//   3. ne proposer AUCUN geste qui détruit — l'entrée qui existe est ce qu'on protège.
//
// SUR LA CLOISON, et elle n'est pas contournée ici : `lireJeton` reste refusé sous essais
// (voir cloison-essais.test.js, MUR 1), et rien dans ce fichier ne l'atteint. `chercherJeton`
// n'a AUCUNE porte par défaut vers le vrai `security` — l'exécuteur est obligatoire, donc un
// test ne peut interroger qu'un double. Le vrai trousseau du poste n'est jamais lu ici, et
// il n'est jamais écrit nulle part : c'est précisément l'incident qu'on prévient.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { userInfo, tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GESTES_QUI_DETRUISENT, gestesQuiDetruisentDans, aucunGesteQuiDetruit } from './aide/gestes-qui-detruisent.js';
import { compteDuPoste, chercherJeton, JetonManquant, JetonVide, SERVICE_ROBOT } from '../src/trousseau.js';
import { refusVeilleurTetu } from '../src/client.js';
import { preparerLieuRepresentant, GABARITS } from '../src/representant.js';

const execFileAsync = promisify(execFile);
const ICI = dirname(fileURLToPath(import.meta.url));
const TROUSSEAU = pathToFileURL(join(ICI, '..', 'src', 'trousseau.js')).href;
/** La racine du pack — d'où viennent les gabarits qu'une pose exige. */
const REPO_RACINE = resolve(ICI, '..', '..');
const CLOISON = pathToFileURL(join(ICI, '..', 'src', 'cloison.js')).href;

// ═════════════════════════════ 1. le compte, qui ne vient plus d'une variable

/**
 * Fait tourner une expression dans un processus enfant DONT L'ENVIRONNEMENT EST AMPUTÉ de
 * `USER` et `LOGNAME` — l'état exact de la session où le dirigeant s'est fait refuser.
 *
 * L'enfant hérite de `NODE_TEST_CONTEXT` : la cloison y est donc LEVÉE, et on le vérifie
 * dans chaque rapport. On reproduit le vécu sans ouvrir la porte que la cloison ferme.
 */
async function sousEnvironnementAmpute(code) {
  const env = { ...process.env };
  delete env.USER;
  delete env.LOGNAME;
  const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '-e', code], { env });
  return JSON.parse(stdout.trim().split('\n').pop());
}

/**
 * Le double du trousseau. Il se comporte comme `security` : il ÉCHOUE quand on l'interroge
 * sous un compte qui ne porte rien — c'est cet échec-là, et lui seul, que l'ancien code
 * traduisait en « aucun jeton au trousseau ».
 *
 * L'entrée qu'il porte est déposée sous le compte RÉEL du poste, parce que c'est là que le
 * vrai trousseau porte la sienne. Le jeton rendu est inventé : aucun secret ne transite ici.
 */
const CHERCHER_AVEC_UN_DOUBLE = `
import { userInfo } from 'node:os';
import { chercherJeton } from ${JSON.stringify(TROUSSEAU)};
import { enEssais } from ${JSON.stringify(CLOISON)};

const COMPTE_REEL = userInfo().username;
let compteInterroge = null;

async function doubleDuTrousseau(args) {
  compteInterroge = args[args.indexOf('-a') + 1];
  const service = args[args.indexOf('-s') + 1];
  if (compteInterroge !== COMPTE_REEL || service !== 'ligne-directe-bot') {
    throw Object.assign(
      new Error('security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.'),
      { code: 44 }
    );
  }
  return 'un-jeton-de-double\\n';
}

const rapport = { cloison_levee: enEssais(), compte_reel: COMPTE_REEL };
try {
  const jeton = await chercherJeton('ligne-directe-bot', { executer: doubleDuTrousseau });
  rapport.trouve = true;
  rapport.longueur = jeton.length;
} catch (err) {
  rapport.trouve = false;
  rapport.nom = err.name;
}
rapport.compte_interroge = compteInterroge;
console.log(JSON.stringify(rapport));
`;

test('UN JETON PRÉSENT RESTE TROUVÉ QUAND L’ENVIRONNEMENT N’A NI USER NI LOGNAME', async () => {
  // LE test de ce correctif. Il ne vérifie pas que le refus est joli : il vérifie que le
  // refus N'A PAS LIEU. L'entrée est là, sous le compte du poste ; la seule chose qui a
  // changé est que la session ne dit plus qui elle est.
  const r = await sousEnvironnementAmpute(CHERCHER_AVEC_UN_DOUBLE);

  assert.equal(r.cloison_levee, true, 'sans cloison levée dans l’enfant, ce fichier ne prouverait rien de ce qu’il prétend');
  assert.equal(
    r.trouve,
    true,
    `le jeton est au trousseau : le déclarer absent est le défaut. Reçu ${r.nom}, ` +
      `après avoir cherché sous le compte « ${r.compte_interroge} » au lieu de « ${r.compte_reel} »`
  );
  assert.equal(r.compte_interroge, r.compte_reel, 'la recherche doit porter sur le compte réel du poste, pas sur ce que l’environnement en dit');
});

test('LE COMPTE NE SORT PAS DE L’ENVIRONNEMENT — retiré il tient, et menteur il ne suit pas', () => {
  const avant = { USER: process.env.USER, LOGNAME: process.env.LOGNAME };
  const attendu = userInfo().username;
  assert.notEqual(attendu, '', 'le poste doit savoir qui l’exécute, sinon le reste du test ne dit rien');
  try {
    delete process.env.USER;
    delete process.env.LOGNAME;
    assert.equal(compteDuPoste(), attendu, 'absentes, les variables ne doivent rien changer');

    // L'autre moitié de la même porte : une variable PRÉSENTE mais fausse ne doit pas
    // davantage décider du compte. Un environnement hérité d'un autre utilisateur — c'est
    // ce que fait `sudo -E`, ou un service lancé par un tiers — enverrait sinon chercher
    // les jetons de quelqu'un d'autre.
    process.env.USER = 'quelqu-un-d-autre';
    process.env.LOGNAME = 'quelqu-un-d-autre';
    assert.equal(compteDuPoste(), attendu, 'présentes et fausses, elles ne doivent pas décider non plus');
  } finally {
    if (avant.USER === undefined) delete process.env.USER;
    else process.env.USER = avant.USER;
    if (avant.LOGNAME === undefined) delete process.env.LOGNAME;
    else process.env.LOGNAME = avant.LOGNAME;
  }
});

// ═════════════════════════════ 2. le refus dit ce qu'il a cherché, pas ce qui est absent

test('LE REFUS PORTE LE COMPTE ET LE SERVICE CHERCHÉS — en donnée, pas seulement en prose', async () => {
  // « Je n'ai rien trouvé sous ce compte-là » est mesuré. « Il n'y a pas de jeton » ne l'est
  // pas : c'est une conclusion tirée d'une absence de résultat. Le refus doit porter de quoi
  // voir l'écart tout de suite — sans quoi on cherche du côté de Slack pendant une heure.
  const trousseauMuet = async () => {
    throw Object.assign(new Error('The specified item could not be found in the keychain.'), { code: 44 });
  };

  await assert.rejects(
    () => chercherJeton(SERVICE_ROBOT, { compte: 'un-compte-precis', executer: trousseauMuet }),
    (err) => {
      assert.ok(err instanceof JetonManquant, `attendu JetonManquant, reçu ${err.name}`);
      assert.equal(err.compte, 'un-compte-precis', 'le refus doit PORTER le compte sous lequel il a cherché');
      assert.equal(err.service, SERVICE_ROBOT, 'et le service');
      assert.ok(err.message.includes('un-compte-precis'), 'et le dire à qui le lit, pas seulement à qui inspecte l’objet');
      return true;
    }
  );
});

test('UNE ENTRÉE PRÉSENTE MAIS VIDE N’EST PAS DÉCLARÉE ABSENTE — ce ne sont pas les mêmes gestes', async () => {
  // Distinction déjà tenue avant ce correctif, et qu'il ne doit pas perdre : l'entrée vide
  // EXISTE. La confondre avec l'absence envoie déposer par-dessus quelque chose qui est là.
  const trousseauQuiRendDuVide = async () => '   \n';

  await assert.rejects(
    () => chercherJeton(SERVICE_ROBOT, { compte: 'un-compte-precis', executer: trousseauQuiRendDuVide }),
    (err) => {
      assert.ok(err instanceof JetonVide, `attendu JetonVide, reçu ${err.name}`);
      assert.equal(err.compte, 'un-compte-precis');
      return true;
    }
  );
});

test('LE VRAI TROUSSEAU N’EST ATTEIGNABLE PAR AUCUN DÉFAUT — l’exécuteur est obligatoire', async () => {
  // Ce qui permet à ce fichier de travailler sans désarmer la cloison : il n'existe pas de
  // chemin implicite vers `security`. Si un refactor en réintroduisait un, un test distrait
  // lirait le vrai trousseau du poste — et on serait revenu au monde des veilleurs orphelins.
  await assert.rejects(() => chercherJeton(SERVICE_ROBOT, { compte: 'x' }), TypeError);
  await assert.rejects(() => chercherJeton(SERVICE_ROBOT, {}), TypeError);
});

// ═════════════════════════════ 3. aucun refus n'envoie détruire

// La garde vit dans `aide/gestes-qui-detruisent.js`, parce que trois fichiers de test s'en
// servent. Elle est éprouvée ICI — sur la copie PARTAGÉE, jamais sur un double local.
//
// DÉFAUT VÉCU SUR CE CORRECTIF MÊME, relevé en seconde revue : la garde avait d'abord été
// écrite en deux exemplaires — un partagé, un local à ce fichier — et le test positif
// n'exerçait que le local. Vider entièrement le partagé laissait donc les 251 tests verts :
// un détecteur désarmé, et invisible. C'est le motif 2 dans sa forme la plus discrète, et il
// visait la garde elle-même. Un seul exemplaire, éprouvé là où il vit.

test('LA GARDE PARTAGÉE SAIT RECONNAÎTRE UN GESTE QUI DÉTRUIT — sinon elle passerait tout', () => {
  // Un détecteur qu'on n'a jamais vu mordre est une opinion. On lui donne le message EXACT
  // qui a été rendu au dirigeant le 2026-08-11, et il doit le refuser.
  const messageDuVecu =
    'Aucun jeton « ligne-directe-bot » au trousseau du poste.\n' +
    '  Dépose-le : security add-generic-password -U -a "$USER" -s ligne-directe-bot -w "$(pbpaste)"';

  assert.deepEqual(
    gestesQuiDetruisentDans(messageDuVecu),
    ['« security add-generic-password -U » ÉCRASE l’entrée existante — celle qui marchait'],
    'le message du vécu DOIT être attrapé, et nommé pour ce qu’il coûte'
  );

  // Chacun des gestes gardés doit mordre SÉPARÉMENT, et mordre sur SON PROPRE exemple.
  //
  // Apparier par le nombre ne suffisait pas, et c'est le trou qu'a trouvé la seconde revue :
  // un motif mort accompagné d'un exemple attrapé par un AUTRE motif faisait tomber le compte
  // juste. On exige donc l'égalité nommée — l'exemple d'un geste rend CE geste, et lui seul.
  assert.ok(GESTES_QUI_DETRUISENT.length >= 4, 'les quatre gestes du vécu doivent au moins être gardés');
  for (const geste of GESTES_QUI_DETRUISENT) {
    assert.deepEqual(
      gestesQuiDetruisentDans(geste.exemple),
      [geste.quoi],
      `l’exemple de ce geste doit être attrapé par LUI, pas par un autre ni par personne : ${geste.exemple}`
    );
  }

  // Et elle doit laisser passer ce qui ne détruit rien — une garde qui refuse tout serait
  // désarmée dès la semaine suivante. Ce sont les gestes que ce correctif met à la place.
  for (const sur of [
    'security find-generic-password -a "maximeleboeuf" -s ligne-directe-bot',
    'security add-generic-password -a "maximeleboeuf" -s ligne-directe-bot -w "$(pbpaste)"',
    'mv /tmp/un-lieu /tmp/un-lieu.ecarte',
    'lsof -t /tmp/veilleur.sock',
  ]) {
    assert.deepEqual(gestesQuiDetruisentDans(sur), [], `ce geste ne détruit rien et doit passer : ${sur}`);
  }
});

/** Prépare un lieu de représentant À DEMI POSÉ dans un bac jetable, pour obtenir son refus. */
function lieuADemiPose() {
  const bac = mkdtempSync(join(tmpdir(), 'ld-refus-'));
  const racine = join(bac, '.gestionnaire', 'un-client');
  mkdirSync(join(racine, dirname(GABARITS[3])), { recursive: true });
  writeFileSync(join(racine, GABARITS[0]), 'reste d’une pose interrompue');
  return bac;
}

/**
 * Un VRAI dépôt git dont un motif exclut le fichier des droits — le cas de T-20260813-0059.
 *
 * Il faut un vrai dépôt : c'est `git check-ignore` qui rend le motif et sa source, et c'est de
 * là que vient le texte du refus qu'on éprouve ici.
 */
function depotQuiExclutLesDroits() {
  const bac = mkdtempSync(join(tmpdir(), 'ld-refus-git-'));
  execFileSync('git', ['init', '-q', bac]);
  writeFileSync(join(bac, '.gitignore'), '.claude/\n');
  cpSync(join(REPO_RACINE, '.claude', 'templates', 'gestionnaire-client'),
    join(bac, '.claude', 'templates', 'gestionnaire-client'), { recursive: true });
  return bac;
}

test('AUCUN REFUS DE CE MODULE NE PROPOSE UN GESTE QUI DÉTRUIT', async () => {
  // Les refus que ce module peut rendre à un humain, pris là où ils sont PRODUITS — pas
  // recopiés. Un message recopié dans un test survit à son propre remplacement.
  //
  // ⚠️ CETTE LISTE SE COMPLÈTE À CHAQUE NOUVEAU REFUS, et l'oublier est le motif relevé en
  // revue de fond sur T-20260813-0059 : `droits_non_versionnables` proposait un geste
  // parfaitement sûr — mais il le devait à personne. Une propriété qui tient parce que nul
  // ne l'a attaquée n'est pas gardée ; elle est seulement encore vraie.
  const refus = [
    ['JetonManquant', new JetonManquant(SERVICE_ROBOT, 'maximeleboeuf', new Error('introuvable')).message],
    ['JetonVide', new JetonVide(SERVICE_ROBOT, 'maximeleboeuf').message],
    ['veilleur qui ne cède pas', refusVeilleurTetu('geste inconnu').message],
    ['lieu à demi posé', (await preparerLieuRepresentant({
      depotClient: lieuADemiPose(),
      client: 'un-client',
      canal: 'd-un-canal',
      verifierJoignabilite: async () => {
        throw new Error('la garde d’idempotence doit refuser AVANT tout aller-retour réseau');
      },
    })).refus.message],
    // T-20260813-0059. Celui-ci PROPOSE deux gestes (« git add -f », une négation d'exclusion) :
    // c'est exactement le genre de refus où un geste destructeur se glisserait sans qu'on le voie.
    ['droits non versionnables', (await preparerLieuRepresentant({
      depotClient: depotQuiExclutLesDroits(),
      client: 'un-client',
      canal: 'd-un-canal',
      verifierJoignabilite: async () => {
        throw new Error('la garde de versionnabilité doit refuser AVANT tout aller-retour réseau');
      },
    })).refus.message],
  ];

  for (const [quel, message] of refus) {
    aucunGesteQuiDetruit(assert, message, quel);
  }
});

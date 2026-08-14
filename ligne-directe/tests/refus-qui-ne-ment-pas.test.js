// T-20260813-0054 — LE REFUS NE DOIT PAS MENTIR SUR CE QU'IL A MESURÉ.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CE QUI EST ARRIVÉ, ET POURQUOI CE FICHIER EXISTE
//
// Le même refus — « aucune entrée « ligne-directe-bot » ne répond au trousseau » — a été
// rendu au dirigeant pour TROIS causes sans le moindre rapport, sur trois tickets :
//
//   T-20260811-0087  le compte cherché était vide (`process.env.USER` absent)
//   ce ticket, §1    `security` n'était pas dans le `PATH` (ENOENT / EACCES au lancement)
//   ce ticket, §2    le TROUSSEAU ÉTAIT VERROUILLÉ (code 36, stderr VIDE) ← la panne réelle
//
// Ses jetons étaient là à chaque fois. Et le message proposait `security add-generic-password`,
// c'est-à-dire d'écrire par-dessus un secret vivant.
//
// À chaque fois, on a AJOUTÉ la cause du jour à la liste des cas reconnus. À chaque fois, la
// porte suivante est restée ouverte. C'est pour ça que ce fichier ne teste PAS une liste de
// causes : il teste le RENVERSEMENT DE LA CHARGE DE LA PREUVE.
//
//   • `JetonManquant` — donc un message qui propose un dépôt — n'est admis que sur une preuve
//     POSITIVE d'absence : le code 44, ou la phrase que `security` écrit dans ce cas ;
//   • tout le reste, CONNU OU INCONNU, est `JetonIllisible`.
//
// LA LIGNE QUI COMPTE VRAIMENT est celle du code JAMAIS VU. Sans elle, cette suite resterait
// verte le jour où une quatrième porte s'ouvre — et elle s'ouvrira. Elle est ci-dessous, et
// elle est même généralisée : on balaie tout l'espace des codes plausibles.
//
// ⚠️ AUCUN VRAI JETON N'EST APPROCHÉ. `chercherJeton` prend un exécuteur injecté, et c'est par
// là — et seulement par là — que tout ceci se prouve. La cloison (`cloison.js`) reste intacte :
// aucun test de ce fichier n'appelle `lireJeton`, la porte de production.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  chercherJeton,
  lireJetons,
  absenceProuvee,
  JetonManquant,
  JetonIllisible,
  JetonVide,
  SERVICE_ROBOT,
  SERVICE_ECOUTE,
} from '../src/trousseau.js';
import { OUTILS, OutilIntrouvable, echecDeLancement, lancer } from '../src/outils.js';
import { verifierCanalOuvrable, messageDeRefus, preparerLieuRepresentant } from '../src/representant.js';
import { verifierLigneOuvrable } from '../src/orchestrateur.js';
import { aucunGesteQuiDetruit } from './aide/gestes-qui-detruisent.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(ICI, '..', '..');
const COMPTE = 'quelquun';

/** Une erreur telle que `execFile` la rend quand le programme A TOURNÉ et a échoué. */
function sortieEnEchec({ code, stderr = '', stdout = '' }) {
  const err = new Error(`Command failed: ${OUTILS.security.chemin} find-generic-password …\n${stderr}`);
  err.code = code;
  err.stdout = stdout;
  err.stderr = stderr;
  return err;
}

/** Une erreur telle que Node la rend quand le programme N'A PAS DÉMARRÉ. */
function lancementEnEchec(code) {
  const err = new Error(`spawn security ${code}`);
  err.code = code;
  err.errno = -2;
  err.syscall = 'spawn security';
  err.path = 'security';
  return err;
}

/** L'exécuteur qui rejette avec ce qu'on lui donne — jamais rien d'autre. */
const rejette = (err) => async () => {
  throw err;
};

/** Le verdict rendu par `chercherJeton`, capturé sans jamais approcher un vrai trousseau. */
async function verdict(executer) {
  try {
    const jeton = await chercherJeton(SERVICE_ROBOT, { compte: COMPTE, executer });
    return { nom: 'ok', jeton };
  } catch (err) {
    return { nom: err.name, err, message: err.message };
  }
}

/**
 * Ce qu'un refus n'a JAMAIS le droit de proposer quand l'absence n'est pas prouvée.
 *
 * Les deux jetons sont les deux moitiés du geste qui détruit : `add-generic-password` écrit
 * l'entrée, `pbpaste` fournit la valeur. Un message qui porte l'un ou l'autre met le geste
 * dans la bouche de quelqu'un qui a déjà un problème et qui colle.
 */
function aucunDepotPropose(message, quel) {
  for (const geste of ['add-generic-password', 'pbpaste', 'delete-generic-password']) {
    assert.ok(
      !message.includes(geste),
      `le refus « ${quel} » propose « ${geste} » alors que RIEN ne prouve que l’entrée manque — ` +
        `c’est le geste qui écrase un jeton en service.\n  message rendu :\n${message}`
    );
  }
  aucunGesteQuiDetruit(assert, message, quel);
}

// ═════════════════════════════════════════ 1. LE RENVERSEMENT LUI-MÊME

test('LE CAS DU DIRIGEANT : trousseau verrouillé (code 36, stderr VIDE) — ce n’est pas une absence', async () => {
  // MESURÉ le 2026-08-13, sur une entrée dont l'existence était établie à la seconde d'avant
  // par la même commande SANS `-w` (code 0). Seul l'accès à la VALEUR était refusé.
  const r = await verdict(rejette(sortieEnEchec({ code: 36, stdout: '', stderr: '' })));

  assert.equal(r.nom, 'JetonIllisible', `attendu JetonIllisible, reçu ${r.nom}`);
  assert.ok(
    !/aucune entrée/i.test(r.message),
    `le refus affirme qu’aucune entrée ne répond alors que rien ne l’établit :\n${r.message}`
  );
  aucunDepotPropose(r.message, 'trousseau verrouillé');
});

test('LA LIGNE QUI ANCRE LE RENVERSEMENT : un code JAMAIS VU tombe du côté prudent', async () => {
  // Si cette assertion tombait, ça voudrait dire qu'on a rallongé une liste au lieu de
  // renverser la charge — et la garde resterait verte jusqu'à la prochaine porte.
  const r = await verdict(rejette(sortieEnEchec({ code: 99 })));

  assert.equal(r.nom, 'JetonIllisible', `un code inconnu doit être illisible, pas absent (reçu ${r.nom})`);
  aucunDepotPropose(r.message, 'code 99, jamais vu');
});

test('ET CE N’EST PAS QUE 99 : TOUT l’espace des issues inconnues tombe du côté prudent', async () => {
  // Un seul code inventé se code en dur, et le jour où quelqu'un ajoute `if (code === 99)` la
  // garde reste verte pour de mauvaises raisons. On balaie donc : tout code de sortie plausible
  // SAUF le seul qui prouve l'absence, plus des formes d'erreur qu'on n'a jamais rencontrées.
  const codes = [];
  for (let c = 1; c <= 128; c += 1) if (c !== 44) codes.push(c);

  for (const code of codes) {
    const r = await verdict(rejette(sortieEnEchec({ code })));
    assert.equal(r.nom, 'JetonIllisible', `le code de sortie ${code} a été pris pour une absence`);
    aucunDepotPropose(r.message, `code de sortie ${code}`);
  }

  // Et les échecs qui ne sont même pas des codes de sortie : un exécuteur qui casse, une
  // promesse rejetée sans forme connue. Aucun d'eux n'établit une absence.
  for (const [quoi, err] of [
    ['une erreur de programmation dans l’exécuteur', new TypeError('executer is not a function')],
    ['un rejet sans code du tout', new Error('quelque chose a mal tourné')],
    ['un rejet qui n’est même pas une Error', { bidule: true }],
    ['un délai dépassé', Object.assign(new Error('timeout'), { killed: true, signal: 'SIGTERM', code: null })],
  ]) {
    const r = await verdict(rejette(err));
    assert.equal(r.nom, 'JetonIllisible', `« ${quoi} » a été pris pour une absence`);
    aucunDepotPropose(r.message, quoi);
  }
});

test('L’ABSENCE PROUVÉE reste une absence — et c’est le SEUL cas où le dépôt est proposé', async () => {
  // L'étalon, mesuré sur un service inexistant : code 44 ET la phrase de `security`.
  const stderr = 'security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.';
  const r = await verdict(rejette(sortieEnEchec({ code: 44, stderr })));

  assert.equal(r.nom, 'JetonManquant', `attendu JetonManquant, reçu ${r.nom}`);
  assert.match(r.message, /aucune entrée/i, 'le refus d’absence doit dire qu’aucune entrée n’a répondu');
  assert.ok(
    r.message.includes('add-generic-password'),
    'ici, et ici seulement, la marche à suivre a le droit de proposer un dépôt'
  );
  // Il reste interdit de proposer un dépôt qui ÉCRASE — c'est T-20260811-0087, et ça ne bouge pas.
  aucunGesteQuiDetruit(assert, r.message, 'jeton réellement absent');
});

test('LES DEUX TÉMOINS D’ABSENCE SONT REDONDANTS — l’un sans l’autre suffit', async () => {
  // Une version de macOS peut changer le code sans changer la phrase, ou l'inverse. Exiger
  // les deux ferait basculer une vraie absence du côté illisible — un refus trop timide, pas
  // dangereux, mais faux. Chacun seul doit donc suffire.
  const phrase = 'security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.';

  const parLeCode = await verdict(rejette(sortieEnEchec({ code: 44, stderr: '' })));
  assert.equal(parLeCode.nom, 'JetonManquant', 'le code 44 seul prouve l’absence');

  const parLaPhrase = await verdict(rejette(sortieEnEchec({ code: 1, stderr: phrase })));
  assert.equal(parLaPhrase.nom, 'JetonManquant', 'la phrase de security seule prouve l’absence');

  assert.equal(absenceProuvee(sortieEnEchec({ code: 36, stderr: '' })), false);
  assert.equal(absenceProuvee(undefined), false, 'rien du tout ne prouve rien');
});

// ═════════════════════════════════════════ 2. LE DÉFAUT D'ORIGINE — LE PATH

test('UN JETON PRÉSENT + UN LANCEMENT EN ÉCHEC : le refus parle de l’OUTIL, jamais du trousseau', async () => {
  // La table du ticket, jouée en entier. Le MÊME service, le MÊME compte : la seule chose qui
  // change est la capacité à lancer le programme. Un refus qui parlerait des entrées dans le
  // second cas mentirait — et c'est exactement ce qu'il faisait.
  const present = await verdict(async () => 'valeur-de-test-sans-rapport-avec-un-jeton');
  assert.equal(present.nom, 'ok', 'l’entrée est lisible : c’est l’étalon qui donne son sens à la suite');

  for (const code of ['ENOENT', 'EACCES']) {
    const r = await verdict(rejette(lancementEnEchec(code)));
    assert.equal(r.nom, 'JetonIllisible', `un lancement ${code} n’est pas une absence d’entrée`);
    assert.ok(
      !/aucune entrée/i.test(r.message),
      `le refus parle du trousseau alors que le programme n’a pas démarré :\n${r.message}`
    );
    assert.ok(
      r.message.includes(String(code)),
      `le refus doit MONTRER la cause qu’il possède déjà (${code}) — elle vivait dans err.cause ` +
        `et n’était affichée à personne :\n${r.message}`
    );
    aucunDepotPropose(r.message, `lancement ${code}`);
  }
});

test('LE REFUS MONTRE CE QUE L’OUTIL A DIT — la cause n’est plus jetée', async () => {
  const r = await verdict(rejette(sortieEnEchec({ code: 36, stderr: 'security: quelque chose de précis' })));
  assert.match(r.message, /36/, 'le code rendu par le poste doit figurer dans le refus');
  assert.match(r.message, /quelque chose de précis/, 'et les mots de l’outil avec');

  // ─── LE CAS MUET — celui du dirigeant : code 36, stderr VIDE.
  //
  // ⚠️ RELEVÉ EN REVUE (passe 1) : la première version gardait ça par un MOT — `/silence|aucun
  // message/`. C'est le motif dominant de ce dépôt, retombé dans le fichier même qui prétend
  // le fermer : la phrase est écrite par le code d'à côté, donc l'assertion vérifiait que
  // nous avions bien recopié notre propre texte. Une reformulation la faisait rougir pour
  // rien ; une régression qui garde le mot la laissait verte.
  //
  // Ce qu'il faut garder est le FAIT, et il est précis. Le piège réel — celui que j'ai écrit,
  // puis corrigé — est de se rabattre sur `err.message` quand `stderr` est vide : `execFile`
  // y compose « Command failed: /usr/bin/security find-generic-password … », c'est-à-dire LA
  // COMMANDE QU'ON A LANCÉE. Affichée sous « ce que le poste a répondu », elle fait passer
  // notre propre écho pour la parole de l'outil, et le SILENCE — le seul indice qui menait au
  // trousseau verrouillé — disparaît sous du texte.
  //
  // On garde donc LA LIGNE DE CAUSE, isolée — pas le message entier. Le refus propose par
  // ailleurs des gestes qui LISENT, et ceux-là nomment légitimement `find-generic-password` :
  // les confondre avec l'écho du lanceur ferait rougir un refus correct (mesuré : c'est ce
  // qu'a fait la première version de cette garde).
  const ligneDeCause = (message) => message.split('\n').find((l) => /Cause brute/.test(l)) ?? '';

  const muet = await verdict(rejette(sortieEnEchec({ code: 36, stderr: '' })));
  assert.match(muet.message, /36/, 'le code doit figurer même quand l’outil se tait');
  const causeMuette = ligneDeCause(muet.message);
  assert.ok(causeMuette, 'le refus doit porter une ligne de cause identifiable');
  for (const echo of ['Command failed', 'find-generic-password']) {
    assert.ok(
      !causeMuette.includes(echo),
      `la ligne de cause resert « ${echo} » — c’est NOTRE commande, présentée comme la réponse ` +
        `de l’outil, et le silence disparaît dessous :\n  ${causeMuette}`
    );
  }

  // Et les deux cas doivent être DISTINGUABLES : un outil qui parle et un outil qui se tait ne
  // peuvent pas rendre le même refus, sinon le lecteur n'a aucun moyen de savoir lequel il a.
  assert.notEqual(
    muet.message,
    r.message,
    'un échec muet et un échec bavard rendent le même texte — le silence n’est plus une information'
  );
});

test('L’ENTRÉE VIDE reste l’entrée vide — le renversement ne l’a pas avalée', async () => {
  // Un succès qui rend une chaîne vide n'est pas un échec : l'entrée EXISTE. Le confondre avec
  // « illisible » enverrait chercher un verrou là où il faut corriger une valeur.
  const r = await verdict(async () => '   ');
  assert.equal(r.nom, 'JetonVide', `attendu JetonVide, reçu ${r.nom}`);
  aucunDepotPropose(r.message, 'entrée vide');
});

// ═════════════════════════════════════════ 3. LES BINAIRES DU SYSTÈME, PAR LEUR CHEMIN

test('les outils du système sont désignés par un chemin ABSOLU, et il existe sur ce poste', () => {
  for (const cle of ['security', 'launchctl']) {
    const outil = OUTILS[cle];
    assert.equal(outil.origine, 'systeme');
    assert.ok(outil.chemin.startsWith('/'), `« ${cle} » est désigné par « ${outil.chemin} » — ce n’est pas un chemin`);
    if (process.platform !== 'darwin') continue;
    assert.ok(existsSync(outil.chemin), `« ${outil.chemin} » n’existe pas sur ce poste`);
    assert.ok(statSync(outil.chemin).mode & 0o111, `« ${outil.chemin} » n’est pas exécutable`);
  }
  // `herdr` est le SEUL à rester résolu par le PATH, et c'est assumé : il est installé par
  // l'utilisateur. Lui inventer un chemin chercherait au mauvais endroit en ayant l'air de savoir.
  assert.equal(OUTILS.herdr.origine, 'pose-par-toi');
});

test('AUCUNE PORTE NE LANCE UN PROGRAMME PAR SON NOM — les cinq portes, et les suivantes', () => {
  // ⚠️ C'EST LA GARDE QUI REMPLACE L'ÉNUMÉRATION. Le ticket listait cinq portes ; il y en avait
  // sept. Les compter à la main, c'est se préparer à en oublier une la prochaine fois — le
  // motif « une porte sur deux », septième occurrence sur ce dépôt.
  //
  // On ne compte donc plus : on interdit la FORME. Un programme lancé par un nom nu dépend du
  // `PATH` du processus ; toute nouvelle porte écrite comme les anciennes fait rougir ceci.
  const LANCEURS = /\b(?:execFile|execFileAsync|execSync|exec|spawn|spawnSync)\s*\(\s*(['"`])([^'"`]*)\1/g;
  /** Le CODE seul — les commentaires de ce dépôt CITENT la forme fautive pour l'expliquer. */
  const codeSeul = (texte) =>
    texte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*(?:\/\/|\*)/.test(l))
      .join('\n');
  const RACINES = [
    join(REPO, 'ligne-directe', 'src'),
    join(REPO, 'ligne-directe', 'bin'),
    join(REPO, 'naissance-representant', 'src'),
    join(REPO, 'naissance-representant', 'bin'),
    join(REPO, 'naissance-representant', 'hooks'),
  ];

  const sources = RACINES.filter(existsSync).flatMap((d) =>
    readdirSync(d)
      .filter((f) => f.endsWith('.js'))
      .map((f) => ({ chemin: join(d, f), texte: readFileSync(join(d, f), 'utf8') }))
  );
  assert.ok(sources.length >= 15, `les sources n’ont pas été relevées (${sources.length}) — la garde ne prouverait rien`);

  const nus = [];
  for (const { chemin, texte } of sources) {
    for (const m of codeSeul(texte).matchAll(LANCEURS)) {
      if (!m[2].startsWith('/')) nus.push(`${chemin.slice(REPO.length + 1)} → « ${m[2]} »`);
    }
  }
  assert.deepEqual(
    nus,
    [],
    'ces portes lancent un programme par son NOM, donc par le PATH du processus lanceur :\n  ' + nus.join('\n  ')
  );

  // Et la garde doit MORDRE : on lui donne la forme fautive telle qu'elle était écrite, et on
  // exige qu'elle la voie. Sans ça, une expression cassée laisserait tout passer en silence.
  const fautif = [...`const { stdout } = await execFileAsync('security', args);`.matchAll(LANCEURS)];
  assert.equal(fautif.length, 1, 'la garde ne reconnaît plus la forme qu’elle est censée interdire');
  assert.equal(fautif[0][2], 'security');
});

test('les trois programmes ne sont nommés QU’À UN SEUL ENDROIT — leur inventaire', () => {
  // Le corollaire de la garde précédente : si un nom de programme réapparaît ailleurs comme
  // cible de lancement, c'est qu'une seconde source de vérité est née.
  const outils = join(REPO, 'ligne-directe', 'src', 'outils.js');
  const texte = readFileSync(outils, 'utf8');
  for (const cle of ['security', 'launchctl', 'herdr']) {
    assert.ok(texte.includes(OUTILS[cle].chemin), `l’inventaire ne porte pas le chemin de « ${cle} »`);
  }
});

// ═════════════════════════════════════════ 4. `lancer` ET LA FRONTIÈRE DES DEUX ÉCHECS

test('CE QUI ARRIVE À L’EXÉCUTEUR EST LE CHEMIN, JAMAIS LE NOM — la garantie centrale', async () => {
  // ⚠️ TROUVÉ EN REVUE (passe 2), ET C'ÉTAIT LE TROU LE PLUS GRAVE DE CETTE SUITE.
  //
  // Remplacer `outil.chemin` par `outil.nom` dans `lancer()` — c'est-à-dire réintroduire MOT
  // POUR MOT la cause d'origine du ticket, `security` relancé par son nom nu — laissait les 21
  // essais VERTS. Tous injectaient un exécuteur qui IGNORE son premier argument : aucun
  // n'observait ce qui lui était réellement passé.
  //
  // C'est le motif 2 du brief — le double plus permissif que le vrai service — posé sur le
  // mécanisme même que ce lot existe pour garantir. La garde structurelle sur le texte des
  // sources interdit bien la forme fautive AILLEURS ; elle ne dit rien de ce que `lancer` fait.
  const vus = [];
  const espion = async (binaire, args) => {
    vus.push({ binaire, args });
    return { stdout: '', stderr: '' };
  };

  await lancer(OUTILS.security, ['find-generic-password'], { executer: espion });
  await lancer(OUTILS.launchctl, ['print'], { executer: espion });

  assert.deepEqual(
    vus.map((v) => v.binaire),
    ['/usr/bin/security', '/bin/launchctl'],
    'l’exécuteur reçoit un NOM de programme — il serait donc résolu par le PATH du processus, ' +
      'ce qui est exactement la panne que ce lot corrige'
  );
  assert.deepEqual(vus[0].args, ['find-generic-password'], 'et les arguments passent intacts');

  // `herdr` est la seule exception, et elle est ASSUMÉE : installé par l'utilisateur, son
  // emplacement n'est pas connu d'avance. On l'épingle ici pour que le jour où quelqu'un lui
  // invente un chemin, ce soit une décision et pas un glissement.
  vus.length = 0;
  await lancer(OUTILS.herdr, ['agent', 'list'], { executer: espion });
  assert.equal(vus[0].binaire, 'herdr', 'herdr reste résolu par le PATH — et son refus le DIT');
});

test('« lancé puis en échec » et « jamais lancé » ne se confondent pas', async () => {
  // La discrimination ne peut pas porter sur le texte du message : `execFile` compose
  // « Command failed: … » dans les deux cas.
  assert.equal(echecDeLancement(lancementEnEchec('ENOENT')), 'ENOENT');
  assert.equal(echecDeLancement(lancementEnEchec('EACCES')), 'EACCES');
  assert.equal(echecDeLancement(sortieEnEchec({ code: 44 })), null, 'un code de sortie veut dire que le programme a TOURNÉ');
  assert.equal(echecDeLancement(sortieEnEchec({ code: 36 })), null);

  // Le piège : un code en CHAÎNE alors que le programme a parfaitement tourné (il a trop écrit).
  // Le confondre ferait dire « outil introuvable » d’un outil qui a répondu — le mensonge retourné.
  const trop = Object.assign(new Error('stdout maxBuffer length exceeded'), {
    code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
  });
  assert.equal(echecDeLancement(trop), null, 'un dépassement de tampon n’est pas un échec de lancement');
});

test('`lancer` qualifie l’échec de lancement et laisse l’autre intact', async () => {
  await assert.rejects(
    () => lancer(OUTILS.security, ['x'], { executer: rejette(lancementEnEchec('ENOENT')) }),
    (err) => {
      assert.ok(err instanceof OutilIntrouvable, `attendu OutilIntrouvable, reçu ${err.name}`);
      assert.equal(err.code, 'ENOENT');
      assert.equal(err.chemin, OUTILS.security.chemin, 'le refus doit nommer OÙ il a cherché');
      aucunGesteQuiDetruit(assert, err.message, 'outil du système introuvable');
      return true;
    }
  );

  const rendu = sortieEnEchec({ code: 44 });
  await assert.rejects(
    () => lancer(OUTILS.security, ['x'], { executer: rejette(rendu) }),
    (err) => {
      assert.equal(err, rendu, 'une réponse en échec doit remonter INTACTE — sinon son code est perdu');
      return true;
    }
  );

  // `herdr` n'a pas de chemin fixe : son refus doit dire qu'on l'a cherché dans le PATH, et
  // ne jamais laisser conclure qu'un agent est mort.
  await assert.rejects(
    () => lancer(OUTILS.herdr, ['agent', 'list'], { executer: rejette(lancementEnEchec('ENOENT')) }),
    (err) => {
      assert.ok(err instanceof OutilIntrouvable);
      assert.match(err.message, /PATH/, 'le refus de herdr doit dire OÙ il a cherché');
      return true;
    }
  );
});

// ═════════════════════════════════════════ 5. L'ENTRÉE ACCUSÉE NE CHANGE PLUS DE NOM

test('QUAND LES DEUX ENTRÉES ÉCHOUENT, le refus nomme TOUJOURS la même — pas celle qui a perdu la course', async () => {
  // `Promise.all` rejetait sur la PREMIÈRE erreur ARRIVÉE. Les deux entrées échouant pour la
  // même cause, l'entrée accusée changeait d'une exécution à l'autre : bot, puis app, puis bot.
  // Le dirigeant a cherché une heure ce qui distinguait ses deux jetons. Rien ne les
  // distinguait — c'était l'ordonnanceur qui parlait.
  //
  // On fait donc perdre la course à `robot` EXPRÈS : en parallèle, `ecoute` serait accusée.
  const accusees = new Set();
  for (let i = 0; i < 12; i += 1) {
    const lire = async (service) => {
      if (service === SERVICE_ROBOT) await new Promise((r) => setTimeout(r, 5));
      throw new JetonIllisible(service, COMPTE, sortieEnEchec({ code: 36 }));
    };
    try {
      await lireJetons({ lire });
      assert.fail('les deux lectures échouent : lireJetons ne peut pas réussir');
    } catch (err) {
      accusees.add(err.service);
    }
  }
  assert.deepEqual(
    [...accusees],
    [SERVICE_ROBOT],
    `l’entrée accusée change d’une exécution à l’autre (${[...accusees].join(', ')}) — ` +
      'un diagnostic qui désigne une cible au hasard est pire qu’un diagnostic muet'
  );
});

// ═════════════════════════════════════════ 6. L'ORCHESTRATEUR — LE MOTIF RENDU

test('l’orchestrateur rend un motif qui distingue l’illisible de l’absent et du vide', async () => {
  const cas = [
    ['jeton_illisible', new JetonIllisible(SERVICE_ROBOT, COMPTE, sortieEnEchec({ code: 36 }))],
    ['jeton_absent', new JetonManquant(SERVICE_ROBOT, COMPTE, sortieEnEchec({ code: 44 }))],
    ['jeton_vide', new JetonVide(SERVICE_ECOUTE, COMPTE)],
  ];
  for (const [attendu, err] of cas) {
    const r = await verifierLigneOuvrable({
      lire: async () => {
        throw err;
      },
    });
    assert.equal(r.joignable, false);
    assert.equal(r.motif, attendu, `« ${err.name} » doit rendre « ${attendu} », pas « ${r.motif} »`);
    if (attendu !== 'jeton_absent') aucunDepotPropose(r.message, `orchestrateur / ${attendu}`);
  }

  const ouvrable = await verifierLigneOuvrable({ lire: async () => ({ robot: 'x', ecoute: 'y' }) });
  assert.equal(ouvrable.joignable, true, 'l’étalon positif : sans lui, ce test passerait pour la mauvaise raison');
});

// ═════════════════════════════════════════ 7. LE REPRÉSENTANT — LA PORTE OUBLIÉE

test('LE REFUS DU REPRÉSENTANT EST STRUCTURÉ — la lecture du jeton ne traverse plus la pose', async () => {
  // MESURÉ : la lecture se faisait dans l'ARGUMENT de la vérification. Son échec traversait
  // tout et finissait au filet global du binaire — aucun JSON de contrat, et le message brut
  // de JetonManquant sur stderr, celui qui propose d'écraser.
  const r = await verifierCanalOuvrable({
    canal: 'client-x',
    lireJetonRobot: async () => {
      throw new JetonIllisible(SERVICE_ROBOT, COMPTE, sortieEnEchec({ code: 36 }));
    },
    verifier: async () => assert.fail('le canal ne doit même pas être consulté quand le poste ne répond pas'),
  });

  assert.equal(r.joignable, false);
  assert.equal(r.motif, 'jeton_illisible');
  assert.equal(r.portee, 'poste', 'un refus du poste doit se déclarer comme tel');
  aucunDepotPropose(r.message, 'représentant / poste injoignable');
});

test('POSTE ET CANAL NE SE CONFONDENT PAS — deux gestes de réparation sans rapport', async () => {
  // Les confondre enverrait faire inviter un robot dans un canal pendant qu'un trousseau reste
  // verrouillé — et, dans l'autre sens, chercher un jeton pour un canal mal orthographié.
  const canal = await verifierCanalOuvrable({
    canal: 'client-x',
    lireJetonRobot: async () => 'valeur-de-test',
    verifier: async () => ({ joignable: false, motif: 'non_membre', canal: 'client-x' }),
  });
  assert.equal(canal.portee, 'canal');

  // Les DEUX conseils de canal, tels que le code les rend vraiment — jamais recopiés ici. Un
  // test qui chercherait le mot « invite » se ferait avoir par n'importe quelle reformulation,
  // et se ferait aussi rougir par un refus du poste qui dit « n'y invite personne ». C'est le
  // motif dominant de ce dépôt : garder le MOT au lieu du FAIT.
  const CONSEILS_DE_CANAL = ['absent', 'non_membre'].map((motif) => messageDeRefus({ motif, canal: 'client-x' }));

  const poste = await verifierCanalOuvrable({
    canal: 'client-x',
    lireJetonRobot: async () => {
      throw new JetonIllisible(SERVICE_ROBOT, COMPTE, sortieEnEchec({ code: 36 }));
    },
  });
  assert.notEqual(poste.portee, 'canal');
  for (const conseil of CONSEILS_DE_CANAL) {
    assert.ok(
      !poste.message.includes(conseil),
      `un refus du POSTE porte un conseil de CANAL :\n  « ${conseil} »\n  refus rendu :\n${poste.message}`
    );
  }
  assert.ok(!/\/invite/.test(poste.message), 'et il ne met aucun geste Slack dans la bouche de son lecteur');

  // Et `messageDeRefus` n'a plus de cas par défaut : un motif du poste qui s'y égarerait
  // recevait « fais-le inviter à la main dans Slack ». C'était le contresens, à une ligne près.
  const egare = messageDeRefus({ motif: 'jeton_illisible', canal: 'client-x' });
  for (const conseil of CONSEILS_DE_CANAL) {
    assert.ok(egare !== conseil, `un motif du poste reçoit encore le conseil du canal : « ${egare} »`);
  }
});

test('POSTE INJOIGNABLE + GABARITS PRÉSENTS : un JSON de contrat, et RIEN sur le disque', async (t) => {
  // La preuve demandée, de bout en bout : on ne se contente pas de constater que rien n'est
  // créé — on exige que la commande le DISE, dans la forme que son appelant lit.
  const depot = mkdtempSync(join(tmpdir(), 'ld-representant-'));
  t.after(() => rmSync(depot, { recursive: true, force: true }));
  // Les gabarits sont PRÉSENTS, et c'est la condition qui donne son sens au test : sans eux,
  // la pose refuserait pour `gabarits_absents` et l'on prouverait la mauvaise garde.
  cpSync(
    join(REPO, '.claude', 'templates', 'gestionnaire-client'),
    join(depot, '.claude', 'templates', 'gestionnaire-client'),
    { recursive: true }
  );

  const r = await preparerLieuRepresentant({
    depotClient: depot,
    client: 'client-x',
    canal: 'client-x',
    verifierJoignabilite: () =>
      verifierCanalOuvrable({
        canal: 'client-x',
        lireJetonRobot: async () => {
          throw new JetonIllisible(SERVICE_ROBOT, COMPTE, sortieEnEchec({ code: 36 }));
        },
      }),
  });

  assert.equal(r.ok, false, 'la pose doit refuser');
  assert.equal(r.cree, false, 'et le dire — « rien n’a été créé » n’était jamais écrit');
  assert.equal(r.refus.motif, 'jeton_illisible');
  assert.equal(r.refus.portee, 'poste');
  aucunDepotPropose(r.refus.message, 'pose du représentant / poste injoignable');
  assert.ok(!existsSync(join(depot, '.gestionnaire')), 'aucun lieu ne doit exister sur le disque');
});

test('la commande ne lit plus le jeton DANS L’ARGUMENT de la vérification', () => {
  // ⚠️ CE QUE CE CONTRÔLE PROUVE, ET CE QU'IL NE PROUVE PAS. C'est une garde de CÂBLAGE, pas
  // de comportement : le comportement, lui, est prouvé par les trois essais ci-dessus, qui
  // exercent `verifierCanalOuvrable` et la pose entière. Celui-ci ferme la seule chose qu'ils
  // ne voient pas — que la commande soit rebranchée sur l'ancien montage.
  //
  // Il est écrit ainsi faute de mieux : forcer l'échec du trousseau dans un processus fils
  // supposerait de toucher au VRAI trousseau du poste, ce que la cloison interdit et ce qui a
  // déjà coûté deux veilleurs orphelins. On garde donc la forme, en le disant.
  const cli = readFileSync(join(REPO, 'ligne-directe', 'bin', 'ligne-directe.js'), 'utf8');
  const branche = cli.slice(cli.indexOf("geste === 'representant'"), cli.indexOf("geste === 'orchestrateur'"));
  assert.ok(branche.length > 100, 'la branche « representant » n’a pas été retrouvée — le contrôle ne prouverait rien');

  assert.ok(
    !/verifierCanalJoignable\s*\(\s*await\s+lireJeton/.test(branche),
    'la lecture du jeton est repassée dans l’ARGUMENT de la vérification : son échec traverserait ' +
      'de nouveau toute la pose, sans le moindre JSON de contrat'
  );
  assert.match(
    branche,
    /verifierLignesDuRepresentant\s*\(/,
    'la commande doit passer par la vérification qui ENTOURE la lecture du jeton — et qui, depuis ' +
      'T-20260813-0076, éprouve les DEUX lignes du gestionnaire, pas seulement le canal du client'
  );
});

test('AUCUNE VÉRIFICATION NE S’ÉCHAPPE — un vérificateur qui jette rend quand même un contrat', async (t) => {
  // ⚠️ TROUVÉ EN REVUE (passe 2). La lecture du jeton était entourée ; l'interrogation de Slack
  // qui suit ne l'était pas. Un jeton révoqué, une limite de débit, un hoquet réseau — et
  // l'exception traversait de nouveau toute la pose, sans le moindre JSON de contrat. Le défaut
  // d'origine, avec une autre cause, DANS le correctif qui prétendait le fermer.
  const depot = mkdtempSync(join(tmpdir(), 'ld-echappee-'));
  t.after(() => rmSync(depot, { recursive: true, force: true }));
  cpSync(
    join(REPO, '.claude', 'templates', 'gestionnaire-client'),
    join(depot, '.claude', 'templates', 'gestionnaire-client'),
    { recursive: true }
  );

  // 1. Slack jette pendant la vérification du canal : ni « absent », ni « non membre » — on ne
  //    sait pas, et les deux gestes porteraient à faux.
  const surSlack = await verifierCanalOuvrable({
    canal: 'client-x',
    lireJetonRobot: async () => 'valeur-de-test',
    verifier: async () => {
      throw Object.assign(new Error('invalid_auth'), { name: 'ErreurSlack' });
    },
  });
  assert.equal(surSlack.joignable, false);
  assert.notEqual(surSlack.motif, 'absent', 'un canal qu’on n’a pas su interroger n’est pas un canal absent');
  assert.notEqual(surSlack.motif, 'non_membre', 'ni un canal dont notre robot serait exclu');
  assert.match(surSlack.message, /invalid_auth/, 'la cause brute doit être montrée');
  for (const conseil of ['absent', 'non_membre'].map((motif) => messageDeRefus({ motif, canal: 'client-x' }))) {
    assert.ok(!surSlack.message.includes(conseil), 'et aucun geste de canal ne doit être proposé');
  }

  // 2. LE FILET : n'importe quel vérificateur qui jette, pour n'importe quelle raison, doit
  //    encore produire un refus STRUCTURÉ — et rien sur le disque.
  const r = await preparerLieuRepresentant({
    depotClient: depot,
    client: 'client-x',
    canal: 'client-x',
    verifierJoignabilite: async () => {
      throw new Error('une panne que personne n’avait prévue');
    },
  });
  assert.equal(r.ok, false, 'la pose doit rendre un verdict, pas jeter');
  assert.equal(r.cree, false);
  assert.ok(r.refus?.motif, 'le refus doit porter un motif lisible');
  assert.match(r.refus.message, /personne n’avait prévue/, 'et montrer la cause brute');
  aucunDepotPropose(r.refus.message, 'vérificateur qui jette');
  assert.ok(!existsSync(join(depot, '.gestionnaire')), 'aucun lieu ne doit exister sur le disque');
});

// ═════════════════════════════════════════ 8. HERDR — ABSENT N'EST PAS MORT

test('HERDR INTROUVABLE N’EST PAS « TOUS LES AGENTS SONT MORTS »', async (t) => {
  // ⚠️ LA CONSÉQUENCE LA PLUS CHÈRE DE CETTE FAMILLE. `agents()` avalait toute erreur de
  // session — bon pour une session morte, catastrophique pour un outil absent : TOUTES les
  // sessions échouent, la liste revient VIDE, et une liste vide veut dire « aucun agent
  // vivant ». En aval, le veilleur clôt la ligne d'office et répond « agent disparu » — pour
  // un agent qui travaille, dans une session ouverte.
  //
  // On le prouve par le fait : un PATH sans `herdr`. Aucun vrai herdr n'est touché.
  const bac = mkdtempSync(join(tmpdir(), 'ld-sans-herdr-'));
  const pathOriginal = process.env.PATH;
  const socketOriginal = process.env.HERDR_SOCKET_PATH;
  t.after(() => {
    process.env.PATH = pathOriginal;
    if (socketOriginal === undefined) delete process.env.HERDR_SOCKET_PATH;
    else process.env.HERDR_SOCKET_PATH = socketOriginal;
    rmSync(bac, { recursive: true, force: true });
  });
  process.env.PATH = bac;
  process.env.HERDR_SOCKET_PATH = join(bac, 'herdr.sock');

  const { agents, vivant } = await import('../src/herdr.js');

  await assert.rejects(
    () => agents(),
    (err) => {
      assert.ok(err instanceof OutilIntrouvable, `attendu OutilIntrouvable, reçu ${err.name} — ` +
        'une liste vide aurait fait refermer les lignes de tous les agents vivants');
      return true;
    },
    'agents() rend une liste vide au lieu de dire que herdr est introuvable'
  );

  await assert.rejects(() => vivant('w1:p1'), OutilIntrouvable,
    'vivant() rend « false » — donc « agent disparu » — pour un outil qu’on n’a pas su lancer');
});

test('les commandes de la naissance disent que herdr est introuvable, sans rien en conclure', async () => {
  const { appelHerdr, lireEcran } = await import('../../naissance-representant/src/appel-herdr.js');

  const verdictHerdr = await appelHerdr(['agent', 'list'], { executer: rejette(lancementEnEchec('ENOENT')) });
  assert.equal(verdictHerdr.ok, false);
  assert.equal(verdictHerdr.outilIntrouvable, true, 'l’appelant doit pouvoir distinguer « absent » de « a refusé »');
  assert.match(verdictHerdr.message, /herdr/, 'et le message doit nommer le programme');

  // L'écran : `null` veut dire « on n'a pas lu », jamais « la boîte est vide » — c'est ce qui
  // fait REFUSER la livraison au lieu d'écrire par-dessus un contenu qu'on n'a jamais vu.
  const ecran = await lireEcran(['agent', 'read', 'w1:p1'], { executer: rejette(lancementEnEchec('ENOENT')) });
  assert.equal(ecran, null, 'une lecture d’écran ratée ne doit jamais passer pour un écran vide');
});

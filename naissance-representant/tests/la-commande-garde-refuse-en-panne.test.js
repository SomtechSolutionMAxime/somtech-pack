// la-commande-garde-refuse-en-panne.test.js — T-20260824-0020.
//
// CE QUE CE BANC ÉPROUVE, ET POURQUOI IL EXISTE
//
// `COMMANDE_GARDE` est la commande de hook posée dans le `.claude/settings.json` de TOUS
// les lieux — orchestrateurs ET représentants, y compris chez des clients. C'est elle qui
// rend la ligne d'un agent obligatoire.
//
// Avant ce lot, elle appelait sa garde par `exec node "$G"` et transmettait la sortie TELLE
// QUELLE. Mesuré le 2026-08-24 sur Claude Code 2.1.241 (T-20260824-0002) : quand une garde
// ne rend pas de verdict lisible, Claude Code n'a AUCUNE décision et dégrade le geste en
// DEMANDE de permission — et sous `--permission-mode acceptEdits`, une demande est un OUI.
//
// 🔴 LA POLARITÉ DE PANNE D'UNE GARDE EST LE REFUS, JAMAIS LA DEMANDE. Chacun des modes
// ci-dessous a donc son test, et chacun a été mesuré ROUGE sur la commande d'avant.
//
// LA MÉTHODE : la chaîne RÉELLE moins UN point nommé. On joue la vraie commande dans
// `/bin/sh` (le shell le plus strict que Claude Code puisse employer), avec un faux `$HOME`
// dont le seul écart au poste réel est le FICHIER de la garde — remplacé par un double qui
// reproduit la CAUSE (elle casse, elle pend, elle boucle, elle bruite), jamais l'état.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDE_GARDE, echapper } from '../src/naissance.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = resolve(HERE, '..');
const RACINE = resolve(MODULE_ROOT, '..');

/**
 * Une boucle de calcul qui BRÛLE un cœur — mais qui finit toute seule.
 *
 * ⚠️ ELLE EST BORNÉE, ET CE N EST PAS UN CONFORT. Un `while (true) {}` nu survit à
 * l interruption du runner : le lanceur qui devait le tuer est mort avant lui. Mesuré sur ce
 * poste — 61 doubles orphelins, dont un à 27 minutes de temps processeur, et une charge de
 * 396 qui faussait toutes les mesures de durée du banc lui-même.
 *
 * La borne ne l affaiblit pas : ce qui est éprouvé, c est que la commande refuse et que le
 * double MEURT en moins de trois secondes — trente fois moins que sa propre limite.
 */
const BOUCLE = 'const t = Date.now();\nwhile (Date.now() - t < 90000) {}\n';

/** Le délai que le banc impose : assez court pour que « pend » se mesure en secondes. */
const DELAI_ESSAI = '900';

const aJeter = [];
const temp = (p) => { const d = mkdtempSync(join(tmpdir(), p)); aJeter.push(d); return d; };
test.after(() => { for (const d of aJeter) rmSync(d, { recursive: true, force: true }); });

/**
 * Un faux poste : `$HOME/.somtech/naissance-representant/` porte le VRAI module (par lien),
 * sauf `hooks/garde-ouverture-ligne.js` — le seul point substitué.
 *
 * ⚠️ Le lien porte `src/`, `bin/` et tout le reste : le double vit dans la vraie arborescence,
 * donc un double qui `import`erait `../src/hook.js` le trouverait. On ne mesure pas un module
 * amputé.
 */
function posteAvecGarde(sourceDuDouble) {
  const home = temp('smtk-poste-panne-');
  const modu = join(home, '.somtech', 'naissance-representant');
  mkdirSync(join(modu, 'hooks'), { recursive: true });
  for (const e of ['src', 'bin', 'package.json']) symlinkSync(join(MODULE_ROOT, e), join(modu, e));
  writeFileSync(join(modu, 'hooks', 'garde-ouverture-ligne.js'), sourceDuDouble);
  return home;
}

/** Le poste RÉEL, sans aucune substitution — pour les contre-épreuves. */
function posteReel() {
  const home = temp('smtk-poste-reel-');
  mkdirSync(join(home, '.somtech'), { recursive: true });
  symlinkSync(MODULE_ROOT, join(home, '.somtech', 'naissance-representant'));
  return home;
}

/** Un poste SANS le module — la garde absente. */
function posteNu() {
  const home = temp('smtk-poste-nu-');
  mkdirSync(join(home, '.somtech'), { recursive: true });
  return home;
}

/**
 * Joue la commande RÉELLE. Rend `{ sortie, ms }` — la durée compte : un refus qui n'arrive
 * qu'après que l'hôte a renoncé ne refuse rien.
 */
function jouer(home, { commande = COMMANDE_GARDE, cwd, requete, delai = DELAI_ESSAI, timeout = 20000, env = {} } = {}) {
  const ou = cwd || temp('smtk-ailleurs-');
  const t0 = process.hrtime.bigint();
  const sortie = execFileSync('/bin/sh', ['-c', commande], {
    input: JSON.stringify(requete || { cwd: ou, tool_name: 'Bash', tool_input: { command: 'git status' } }),
    cwd: ou,
    env: { ...process.env, HOME: home, SOMTECH_GARDE_OUVERTURE_DELAI_MS: delai, ...env },
    encoding: 'utf8',
    timeout,
  });
  return { sortie, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

/** Le verdict, tel que Claude Code le lirait — un parse strict, comme le sien. */
function verdict(home, options) {
  const { sortie, ms } = jouer(home, options);
  return { ...JSON.parse(sortie).hookSpecificOutput, ms };
}

// ═════════════ ① la garde ABSENTE — le cas déjà couvert, qui ne doit pas se perdre

test('① garde ABSENTE du poste : refus, et il se distingue du refus pour panne', () => {
  const d = verdict(posteNu());
  assert.equal(d.permissionDecision, 'deny');
  assert.match(d.permissionDecisionReason, /introuvable/i);
});

// ═════════════ ② la garde CASSE — sortie vide, code non nul

test('② garde qui CASSE : refus — pas une demande de permission', () => {
  const d = verdict(posteAvecGarde('process.stderr.write("boum\\n"); process.exit(1);\n'));
  assert.equal(d.permissionDecision, 'deny',
    'une garde morte laissait le geste dégrader en DEMANDE de permission — un oui sous acceptEdits');
  assert.doesNotMatch(d.permissionDecisionReason, /introuvable/i,
    'le refus pour panne ne doit pas se faire passer pour une absence : on ne réinstalle pas une garde présente');
});

test('② bis garde MUETTE — code 0, aucune sortie : refus', () => {
  // Ce que « le code de sortie est bon » laisserait passer.
  assert.equal(verdict(posteAvecGarde('process.exit(0);\n')).permissionDecision, 'deny');
});

// ═════════════ ③ la garde PEND — le mode que le shell attendrait avec elle

test('③ garde qui PEND : refus rendu par le délai, pas par l abandon de l hôte', () => {
  // ⚠️ LA BORNE EST LARGE, ET C EST VOULU. Un seuil serré mesurerait la CHARGE DU POSTE :
  // ce banc a rendu un faux rouge une fois, sous une charge de 212. Sans le délai, ce test
  // ne finit pas du tout (l attente est infinie, et c est `timeout` qui coupe) — n importe
  // quelle borne finie prouve donc le mécanisme, et une borne large ne prouve pas moins.
  const d = verdict(posteAvecGarde('setInterval(() => {}, 1000);\n'), { timeout: 60000 });
  assert.equal(d.permissionDecision, 'deny');
  assert.ok(d.ms < 30000, `le refus a mis ${Math.round(d.ms)} ms : le délai ne mord pas`);
  // ⚠️ ET LE REFUS DOIT NOMMER SA CAUSE. Sans cette assertion, retirer le refus du délai est
  // INDOLORE : la sortie devient vide, le shell rend son refus de panne, et le verdict reste
  // « deny » — mesuré. L agent lirait alors « elle a échoué » là où elle PEND, et chercherait
  // un défaut qui n existe pas.
  assert.match(d.permissionDecisionReason, /delai|délai/i,
    'un refus de délai qui se fait passer pour un refus de panne envoie chercher au mauvais endroit');
});

// ═════════════ ④ un verdict SANS décision — sortie non vide, code 0, et rien à décider

test('④ verdict SANS décision : refus — une clé omise n est pas un oui', () => {
  const d = verdict(posteAvecGarde(
    'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse"}}));\n'));
  assert.equal(d.permissionDecision, 'deny');
});

test('④ bis une décision INVENTÉE est refusée — « peut-etre » n est pas « allow »', () => {
  const d = verdict(posteAvecGarde(
    'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"peut-etre"}}));\n'));
  assert.equal(d.permissionDecision, 'deny');
});

// ═════════════ ⑤ du BRUIT avant le JSON — le mode qui ne demande aucune erreur d auteur

test('⑤ BRUIT avant le JSON : refus — il suffit d un jour où npm parle', () => {
  const d = verdict(posteAvecGarde(
    'process.stdout.write("npm notice New major version available\\n");'
    + 'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",'
    + 'permissionDecision:"allow",permissionDecisionReason:"ligne ouverte"}}));\n'));
  assert.equal(d.permissionDecision, 'deny',
    'la sortie ne parse plus : Claude Code n aurait aucun verdict, donc la commande doit refuser elle-même');
});

// ═════════════ ⑥ une BOUCLE de calcul — le mode que le lot précédent n a pas pu fermer

test('⑥ garde qui BOUCLE : refus — le minuteur vit dans un AUTRE processus que la boucle', () => {
  // ⚠️ Node est mono-thread : un délai que la garde s impose à elle-même ne peut pas tirer
  // pendant qu un `while` tourne (mesuré dans T-20260824-0002, laissé NON FERMÉ). Le délai
  // de cette commande vit dans un processus DISTINCT de la garde, et il la TUE — c est ce
  // que ce test mesure, et c est la seule raison pour laquelle ce mode se ferme ici.
  const d = verdict(posteAvecGarde(BOUCLE), { timeout: 60000 });
  assert.equal(d.permissionDecision, 'deny');
  assert.ok(d.ms < 30000, `le refus a mis ${Math.round(d.ms)} ms : la boucle n est pas coupée`);
});

// ═════════════ ⑦ les contre-épreuves — sans elles, une commande qui refuse TOUT passerait

test('⑦ un vrai ALLOW remonte, avec sa raison — sinon les six refus ci-dessus ne prouvent rien', () => {
  const ailleurs = temp('smtk-ailleurs-');
  const d = verdict(posteReel(), { cwd: ailleurs, requete: { cwd: ailleurs, tool_name: 'Bash', tool_input: { command: 'git status' } } });
  assert.equal(d.permissionDecision, 'allow');
  assert.match(d.permissionDecisionReason, /hors du lieu/,
    'la raison de la VRAIE garde doit remonter telle quelle, pas une forme vidée');
});

test('⑦ bis un vrai DENY remonte, avec sa raison', () => {
  const d = verdict(posteAvecGarde(
    'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",'
    + 'permissionDecision:"deny",permissionDecisionReason:"ouvre ta ligne dabord"}}));\n'));
  assert.equal(d.permissionDecision, 'deny');
  assert.equal(d.permissionDecisionReason, 'ouvre ta ligne dabord');
});

// ═════════════ ⑧ la commande DÉPOSÉE dans les lieux versionnés est bien celle-ci

test('⑧ les gabarits des DEUX rôles portent exactement cette commande — le lieu versionné n est pas la constante', () => {
  for (const role of ['orchestrateur', 'gestionnaire-client']) {
    const st = JSON.parse(readFileSync(
      join(RACINE, '.claude', 'templates', role, '.claude', 'settings.json'), 'utf8'));
    const cmds = (st.hooks?.PreToolUse || []).flatMap((b) => (b.hooks || []).map((h) => h.command || ''));
    const garde = cmds.filter((c) => c.includes('garde-ouverture-ligne.js'));
    assert.equal(garde.length, 1, `${role} : un seul garde d ouverture, jamais deux`);
    assert.equal(garde[0], COMMANDE_GARDE,
      `${role} : le gabarit porte une AUTRE commande que celle qu on vient d éprouver — `
      + 'les tests ci-dessus ne mesureraient alors rien de ce qui est distribué');
  }
});

// ═════════════ ⑨ face à un WRITE — ce que la table des hooks éprouvés garde

test('⑨ l enveloppe ne refuse pas un Write par elle-même — elle transmet le verdict de la garde', () => {
  // ⚠️ POURQUOI CE CONTRÔLE, ET POURQUOI ICI. Ce hook est posé SANS `matcher` : il voit
  // donc AUSSI les `Write`. Et le `deny` de N IMPORTE QUEL hook l emporte sur le `allow`
  // d un autre (mesuré le 2026-08-24, T-20260824-0002, dans les deux sens). Si cette
  // enveloppe refusait un Write de son propre chef, un orchestrateur ne pourrait plus
  // tenir son CONTEXTE.md — la garde d écriture aurait beau dire oui, et RIEN ne le dirait.
  //
  // C est précisément ce que la table `HOOKS_EPROUVES` de `cli/test/metier-garde-ecriture.
  // test.js` exige d avoir mesuré avant d inscrire une empreinte. Ce lot a changé la
  // commande, donc l empreinte : cette ré-épreuve est la contrepartie de la nouvelle ligne.
  const d = verdict(posteAvecGarde(
    'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",'
    + 'permissionDecision:"allow",permissionDecisionReason:"ligne ouverte — je me retire"}}));\n'),
    { requete: { cwd: '/x', tool_name: 'Write', tool_input: { file_path: '/x/CONTEXTE.md' } } });
  assert.equal(d.permissionDecision, 'allow');
  assert.equal(d.permissionDecisionReason, 'ligne ouverte — je me retire');
});

// ═════════════ ⑩ le DÉLAI lui-même — la borne, et le fait qu il ARRÊTE

test('⑩ une valeur d environnement démesurée NE DÉSARME PAS le délai', () => {
  // 🔴 TROUVÉ PAR LA PASSE PORTAIL, ET LE TROU ÉTAIT RÉEL. Le bornage était écrit, commenté
  // — et gardé par RIEN : le retirer laissait le banc entièrement vert. Il n était « tué »
  // que par la table des empreintes de hooks, c est-à-dire par une garde d IDENTITÉ, qui
  // disparaît dès qu on met la table à jour. Une garde d identité ne prouve jamais une
  // fonction.
  //
  // Ce que ce contrôle empêche : `SOMTECH_GARDE_OUVERTURE_DELAI_MS=99999999` dans un
  // environnement de session, et le SEUL mécanisme qui ferme « elle pend » et « elle
  // boucle » ne mord plus — sans qu aucun test ne rougisse.
  // La valeur démesurée vaut 27 HEURES : toute borne finie tranche, et une borne large ne
  // mesure plus la charge du poste (voir ③).
  const d = verdict(posteAvecGarde('setInterval(() => {}, 1000);\n'), { delai: '99999999', timeout: 60000 });
  assert.equal(d.permissionDecision, 'deny');
  assert.ok(d.ms < 30000,
    `le refus a mis ${Math.round(d.ms)} ms : la valeur hors bornes a été appliquée telle quelle, `
    + 'donc le délai est désarmable depuis l environnement');
});

test('⑩ bis une valeur trop PETITE ne tue pas une garde saine — la borne basse sert aussi', () => {
  // La borne a deux côtés, et le second n est pas décoratif : un délai de 50 ms couperait
  // une garde parfaitement saine (la vraie met ~60 à 100 ms rien qu à démarrer), et TOUT
  // serait refusé — une garde qui refuse tout finit par être désactivée à la main.
  const d = verdict(posteAvecGarde(
    'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",'
    + 'permissionDecision:"allow",permissionDecisionReason:"ligne ouverte"}}));\n'), { delai: '50' });
  assert.equal(d.permissionDecision, 'allow',
    'une valeur sous la borne basse a été appliquée : la garde saine a été tuée avant de répondre');
});

test('⑩ ter la garde qui boucle est ARRÊTÉE, pas seulement dépassée', () => {
  // ⚠️ Mesuré : sans le `kill`, ③ et ⑥ restent VERTS — le refus arrive quand même, parce
  // que le lanceur sort de son côté. Le verdict est donc juste et le processus survit :
  // une garde qui boucle continuerait à brûler un cœur, à CHAQUE appel d outil, sans que
  // rien ne le dise. Le refus dit « il vient d etre arrete » ; ce contrôle l établit.
  //
  // 🔴 LA PREMIÈRE FORME DE CE CONTRÔLE MESURAIT SON PROPRE INSTRUMENT. Elle comptait les
  // processus par `pgrep -f <chemin du double>` : sous Linux, le `sh -c` qui exécute ce
  // pgrep porte le chemin dans SA PROPRE ligne de commande et se compte lui-même — vert
  // sur macOS, rouge en CI, et pour une raison qui n avait rien à voir avec la garde.
  // Le double déclare donc son PID, et on interroge CE processus-là, jamais une recherche
  // par motif.
  const temoin = join(temp('smtk-pid-'), 'pid');
  const home = posteAvecGarde(
    `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(temoin)}, String(process.pid));\n${BOUCLE}`);
  const d = verdict(home, { timeout: 60000 });
  assert.equal(d.permissionDecision, 'deny');

  const pid = Number(readFileSync(temoin, 'utf8'));
  assert.ok(Number.isInteger(pid) && pid > 0, 'le double n a pas déclaré son PID : le contrôle ne mesurerait rien');

  // On SONDE : un SIGKILL n est pas instantané, et le processus reste brièvement zombie
  // tant que personne ne l a récolté.
  let vivant = true;
  for (let i = 0; i < 30 && vivant; i += 1) {
    try { process.kill(pid, 0); execFileSync('/bin/sh', ['-c', 'sleep 0.1']); } catch { vivant = false; }
  }
  assert.equal(vivant, false,
    `la garde qui boucle (pid ${pid}) a survécu au refus : elle brûlera un cœur jusqu à la fin de `
    + 'la session, et il y en aura une de plus à chaque appel d outil');
});

// ═════════════ ⑪ elle a DÉCIDÉ, puis elle n est jamais sortie

test('⑪ un verdict déjà écrit ne survit pas au délai — une garde qui ne SORT pas est en panne', () => {
  // 🔴 TROUVÉ PAR LA PASSE DE FOND, ET MESURÉ : la garde écrivait un `allow` valide puis
  // bouclait ; au délai, le lanceur re-parsait ce qu elle avait déjà écrit et ré-émettait
  // son `allow` — verdict transmis intact, aucune mention de panne. Le texte du lot
  // promettait « pend → refus » et « boucle → refus » : la promesse dépassait le code.
  //
  // Pourquoi le refus est le bon verdict : rien ne dit que ce qu une garde a écrit avant de
  // se bloquer était son DERNIER mot. Une garde qui ne se termine pas n a pas fini de juger.
  const d = verdict(posteAvecGarde(
    'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",'
    + 'permissionDecision:"allow",permissionDecisionReason:"decide puis bloque"}}));\n'
    + BOUCLE), { timeout: 60000 });
  assert.equal(d.permissionDecision, 'deny',
    'le allow d une garde qui ne sort jamais a été transmis : la panne doit primer sur ce qu elle a dit avant');
  assert.match(d.permissionDecisionReason, /delai|délai/i);
});

// ═════════════ ⑫ le VOLUME — une requête qui ne tient pas dans un tube

test('⑫ une requête volumineuse ne fait pas échouer le hook — le refus arrive quand même', () => {
  // 🔴 TROUVÉ PAR LA PASSE PORTAIL, ET MESURÉ : au-delà d environ 256 Ko de requête, quand la
  // garde meurt ou n écoute pas, PLUS PERSONNE ne lit l entrée du hook. L appelant se bloque
  // en écrivant, puis échoue en EPIPE — AVANT que le refus soit émis. Il n y a alors ni
  // verdict ni refus : exactement le trou que ce lot existe pour fermer, sous une autre forme.
  //
  // ⚠️ CE N EST PAS UN CAS DE LABORATOIRE : la requête d un `Write` ou d un `Edit` porte le
  // CONTENU du fichier. 256 Ko de contenu, c est un fichier ordinaire.
  const gros = 'x'.repeat(512 * 1024);
  for (const [quoi, double] of [
    ['qui casse', 'process.exit(1);\n'],
    ['qui pend', 'setInterval(() => {}, 1000);\n'],
  ]) {
    const d = verdict(posteAvecGarde(double), {
      requete: { cwd: '/x', tool_name: 'Write', tool_input: { file_path: '/x/gros.md', content: gros } },
      timeout: 60000,
    });
    assert.equal(d.permissionDecision, 'deny', `garde ${quoi} + grosse requête : aucun verdict rendu`);
  }
});

test('⑬ une RAISON énorme ne corrompt pas le verdict — il reste lisible', () => {
  // 🔴 TROUVÉ PAR LA PASSE DE FOND, ET MESURÉ : la sortie du lanceur passe par une
  // substitution de commande, dont le tube fait 64 Ko sur ce poste — et le lanceur sortait
  // AVANT d avoir fini d écrire. Au-delà, la sortie était tronquée à 65 537 octets : un JSON
  // invalide, NON VIDE, que le garde-fou `[ -n "$S" ]` laissait passer tel quel. Claude Code
  // n avait alors aucun verdict — la panne même que ce lot ferme.
  //
  // ⚠️ Et la raison peut vraiment être énorme : celle d un refus de `Bash` cite le segment de
  // commande refusé, verbatim. Un blob base64 sur une seule ligne suffit.
  const raison = 'R'.repeat(200 * 1024);
  const d = verdict(posteAvecGarde(
    `process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",`
    + `permissionDecision:"deny",permissionDecisionReason:${JSON.stringify(raison)}}}));\n`),
    { timeout: 60000 });
  assert.equal(d.permissionDecision, 'deny',
    'le verdict a été perdu : sa raison ne tenait pas dans le tube et le JSON est arrivé tronqué');
  assert.ok(d.permissionDecisionReason.length > 0, 'un refus sans raison envoie chercher à l aveugle');
});

// ═════════════ ⑭ le PRIX de ⑪, fixé plutôt que découvert

test('⑭ une garde qui a répondu mais ne sort pas dans le délai est refusée — c est le prix de ⑪, et il est voulu', () => {
  // 🔴 CE CONTRÔLE FIXE UN FAUX POSITIF ASSUMÉ, il ne le corrige pas. Trouvé par la troisième
  // passe de fond : depuis ⑪, une garde qui rend un verdict juste puis met plus que le délai
  // à FERMER SON PROCESSUS est refusée. À l instant du délai, ce cas est indiscernable de
  // « elle a parlé puis s est bloquée ».
  //
  // L arbitrage : refuser à tort coûte un refus lisible que l agent lève en ouvrant sa ligne ;
  // accepter à tort laisse passer le `allow` d une garde bloquée — la panne que ce lot ferme.
  // Et le cas refusé à tort ne se produit pas en vrai : la garde d ouverture sort par un
  // `process.exit(0)` explicite dès qu elle a répondu, et le délai vaut 10 secondes.
  //
  // ⚠️ Si ce test rougit un jour, ça ne veut PAS dire « remets le verdict avant le délai » :
  // ça veut dire que quelqu un a changé cet arbitrage. Qu il le dise ici, avec son motif.
  const d = verdict(posteAvecGarde(
    'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",'
    + 'permissionDecision:"allow",permissionDecisionReason:"repond vite, sort tard"}}));\n'
    + 'setTimeout(() => process.exit(0), 5000);\n'), { delai: '400', timeout: 60000 });
  assert.equal(d.permissionDecision, 'deny',
    'le verdict d une garde qui n a pas fini dans le délai est écarté — arbitrage de polarité, pas un défaut');
  assert.match(d.permissionDecisionReason, /delai|délai/i);
});

// ═════════════ ⑮ l échappement de la charge — une convention n est pas une garde

test('⑮ une apostrophe droite dans un refus ne casse pas la commande — echapper le tient', () => {
  // 🔴 TROUVÉ PAR LA PASSE PORTAIL : neutraliser `echapper` ne faisait rougir AUCUN test.
  // Les deux refus n en portent pas aujourd hui — par convention d écriture, pas par garde.
  // Le jour où une apostrophe droite y entre (`d'ouverture` au lieu de `d’ouverture`, une
  // faute de frappe ordinaire), la commande devient un shell invalide : `syntax error`,
  // exit 2, AUCUNE sortie. C est la dégradation même que ce lot ferme, par la porte de
  // derrière — et ni le contrôle ⑧ ni la table des empreintes ne la verraient : ils
  // compareraient deux commandes également cassées.
  const sousLeShell = (charge) =>
    execFileSync('/bin/sh', ['-c', `printf '%s\\n' '${charge}'`], { encoding: 'utf8', stdio: 'pipe' }).trimEnd();

  // ⚠️ DEUX FORMES, ET ELLES CASSENT DIFFÉREMMENT — une seule des deux ne prouverait que
  // la moitié. Un nombre IMPAIR d apostrophes laisse la chaîne ouverte : erreur de syntaxe,
  // aucune sortie. Un nombre PAIR referme et rouvre la chaîne : le shell ne se plaint pas,
  // et la charge arrive DÉFORMÉE — le refus dirait autre chose que ce qu on a écrit.
  for (const charge of [
    `le garde d'ouverture a echoue`,                       // impair : casse
    `l'ouverture n'est pas faite`,                          // pair : déforme en silence
  ]) {
    assert.equal(sousLeShell(echapper(charge)), charge, 'la charge n a pas traversé le shell intacte');
    let sansEchappement;
    try { sansEchappement = sousLeShell(charge); } catch { sansEchappement = null; }
    assert.notEqual(sansEchappement, charge,
      `« ${charge} » traverse le shell intacte SANS échappement : ce contrôle passerait aussi `
      + 'sur une fonction identité, donc il ne prouverait rien');
  }
});

// ═════════════ ⑯ ce que la sortie de la garde traverse — les octets, puis la borne

test('⑯ un accent coupé entre deux paquets du tube arrive intact — pas deux points d interrogation', () => {
  // 🔴 TROUVÉ PAR LA QUATRIÈME PASSE DE FOND, ET MESURÉ : sans `setEncoding`, chaque paquet du
  // tube est décodé séparément. Un caractère accentué à cheval sur deux paquets se décode en
  // deux caractères de remplacement — le JSON reste VALIDE, donc rien ne rougit, et la raison
  // du refus arrive corrompue. Les refus de ce dépôt sont en français : « caractère » devenait
  // « caract??re ».
  //
  // Le double écrit en DEUX paquets, coupés au milieu du « è » (deux octets en UTF-8).
  const raison = 'un caractère à la frontière';
  const octets = Buffer.from(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: raison } }), 'utf8');
  const coupe = octets.indexOf(Buffer.from('è', 'utf8')) + 1;   // AU MILIEU du è
  const d = verdict(posteAvecGarde(
    'import { writeSync } from "node:fs";\n'
    + `const o = Buffer.from(${JSON.stringify(octets.toString('base64'))}, "base64");\n`
    + `writeSync(1, o.subarray(0, ${coupe}));\n`
    + `setTimeout(() => { writeSync(1, o.subarray(${coupe})); process.exit(0); }, 120);\n`));
  assert.equal(d.permissionDecision, 'deny');
  assert.equal(d.permissionDecisionReason, raison,
    'la raison a traversé le tube corrompue : un accent coupé entre deux paquets a été décodé deux fois');
});

test('⑯ bis une raison démesurée est BORNÉE, et le dit', () => {
  // ⚠️ CE CONTRÔLE ÉPROUVE LA BORNE ELLE-MÊME. Deux mécanismes protègent la sortie du lanceur :
  // cette borne, et l attente de fin d écriture avant de sortir. Mesuré par mutation : chacun
  // SEUL suffit à faire passer ⑬ — donc aucun des deux n était gardé isolément, et l un pouvait
  // disparaître sans qu un rouge le dise. La borne est désormais éprouvée pour elle-même ;
  // l attente de fin d écriture reste une ceinture assumée, et c est écrit ici plutôt qu espéré.
  const d = verdict(posteAvecGarde(
    `process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",`
    + `permissionDecision:"deny",permissionDecisionReason:"R".repeat(200000)}}));\n`),
    { timeout: 60000 });
  assert.equal(d.permissionDecision, 'deny');
  assert.ok(d.permissionDecisionReason.length < 2200,
    `la raison rendue fait ${d.permissionDecisionReason.length} caractères : la borne ne mord pas`);
  assert.match(d.permissionDecisionReason, /tronqu/i, 'une raison coupée doit dire qu elle est coupée');
});

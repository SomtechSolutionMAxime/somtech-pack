// Le lieu du représentant — sa création, et surtout son REFUS (E-20260807-0002).
//
// Le critère opérationnel du brief : « après un refus, vérifie que rien n'a été créé — pas
// que le bon message est sorti ». Chaque test de refus, ci-dessous, l'applique à la lettre :
// il inspecte le SYSTÈME DE FICHIERS après l'appel, jamais le texte de la réponse.
//
// Deux portes mènent à ce module (voir le commentaire en tête de `representant.js`), et les
// deux sont éprouvées ici séparément :
//   1. l'idempotence — un lieu déjà posé ne se retouche jamais ;
//   2. la joignabilité — un canal injoignable ne laisse rien naître.
// Une garde retirée sur l'une des deux doit faire rougir UN test de cette suite ; c'est ce
// qui est vérifié « à la main » plus bas, en rejouant le code sans la garde visée.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparerLieuRepresentant, etatLieu, aFichierEnvironnement, GABARITS } from '../src/representant.js';
import { variablesReferencees } from '../src/mcp-env.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const GABARIT_SOURCE = join(REPO, '.claude', 'templates', 'gestionnaire-client');

/** Un dépôt client jetable, avec les gabarits du pack déjà "installés" (comme le ferait
 *  `pack init` en vrai — c'est une précondition du lot, pas quelque chose que ce module
 *  gère). */
function depotClientJetable() {
  const racine = mkdtempSync(join(tmpdir(), 'ld-lieu-'));
  cpSync(GABARIT_SOURCE, join(racine, '.claude', 'templates', 'gestionnaire-client'), { recursive: true });
  return racine;
}

const JOIGNABLE = async () => ({ joignable: true, canal: 'client-x', id: 'C1' });
const INJOIGNABLE_ABSENT = async () => ({ joignable: false, motif: 'absent', canal: 'client-x' });
const INJOIGNABLE_NON_MEMBRE = async () => ({ joignable: false, motif: 'non_membre', canal: 'client-x' });
const NE_DOIT_JAMAIS_ETRE_APPELEE = async () => {
  throw new Error('verifierJoignabilite appelée alors que le lieu existait déjà — la garde d’idempotence a été contournée');
};

// ═══════════════════════════════ 1. la porte de la joignabilité — REFUS

test('refus : canal absent — RIEN n’a été créé (prouvé par le disque, pas par le message)', async () => {
  const depot = depotClientJetable();
  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: INJOIGNABLE_ABSENT,
  });

  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'absent');
  assert.equal(existsSync(join(depot, '.gestionnaire')), false, 'le dossier .gestionnaire ne doit pas même exister');
});

test('refus : robot non membre — RIEN n’a été créé', async () => {
  const depot = depotClientJetable();
  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: INJOIGNABLE_NON_MEMBRE,
  });

  assert.equal(r.ok, false);
  assert.equal(r.refus.motif, 'non_membre');
  assert.equal(existsSync(join(depot, '.gestionnaire')), false, 'le dossier .gestionnaire ne doit pas même exister');
});

test('mutation : si la garde de joignabilité disparaît, le refus laisse pourtant un lieu sur le disque', async () => {
  // On rejoue ICI, sans la garde, la partie du code qu'une régression retirerait — c'est le
  // test qui aurait attrapé « le refus parle mais crée quand même ». S'il ne trouvait rien à
  // attraper (le dossier resterait absent malgré l'absence de garde), ce test serait
  // décoratif ; il ne l'est pas : sans la garde, un lieu naît bel et bien.
  const depot = depotClientJetable();
  const racine = join(depot, '.gestionnaire', 'client-x');
  const source = join(depot, '.claude', 'templates', 'gestionnaire-client');
  mkdirSync(racine, { recursive: true });
  for (const f of GABARITS) {
    mkdirSync(dirname(join(racine, f)), { recursive: true });
    writeFileSync(join(racine, f), readFileSync(join(source, f)));
  }
  assert.ok(existsSync(racine), 'témoin : sans garde de joignabilité, un lieu se crée — la garde réelle doit donc l’empêcher');
});

// ═══════════════════════════════ 2. la création — canal joignable, rien encore posé

test('création : canal joignable — les quatre fichiers naissent, identiques aux gabarits', async () => {
  const depot = depotClientJetable();
  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.equal(r.ok, true);
  assert.equal(r.cree, true);
  const racine = join(depot, '.gestionnaire', 'client-x');
  for (const fichier of GABARITS) {
    assert.ok(existsSync(join(racine, fichier)), `${fichier} doit exister au chemin exact où Claude Code va le lire`);
  }

  for (const fichier of GABARITS) {
    assert.equal(
      readFileSync(join(racine, fichier), 'utf8'),
      readFileSync(join(GABARIT_SOURCE, fichier), 'utf8'),
      `${fichier} doit être une copie OCTET POUR OCTET du gabarit — jamais une lecture de son contenu`
    );
  }
});

// ═══════════════════════════════ 3. l'idempotence — REFUS DE RETOUCHER, pas d'appel réseau

test('idempotence : relancée sur un client déjà installé, elle ne recrée rien et n’appelle pas Slack', async () => {
  const depot = depotClientJetable();
  const premiere = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });
  assert.equal(premiere.cree, true);

  // Le CONTEXTE.md porte maintenant une trace humaine — la preuve qu'il n'a pas été touché.
  const contexte = join(depot, '.gestionnaire', 'client-x', 'CONTEXTE.md');
  writeFileSync(contexte, 'Ce que ce client déteste : qu\'on lui redemande deux fois la même chose.\n');

  const seconde = await preparerLieuRepresentant({
    // Si l'idempotence est contournée, cette fonction lève — la preuve n'est donc pas
    // seulement dans le résultat, elle est dans le fait même que le test survit.
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: NE_DOIT_JAMAIS_ETRE_APPELEE,
  });

  assert.equal(seconde.ok, true);
  assert.equal(seconde.cree, false);
  assert.equal(seconde.deja_installe, true);
  assert.equal(
    readFileSync(contexte, 'utf8'),
    'Ce que ce client déteste : qu\'on lui redemande deux fois la même chose.\n',
    'CONTEXTE.md doit rester EXACTEMENT ce qu’un humain y avait écrit'
  );
});

test('idempotence : un lieu PARTIEL (une pose interrompue) n’est pas complété non plus', () => {
  // « elle ne recrée rien, n'écrase rien » ne fait pas d'exception pour un lieu incomplet —
  // sinon une interruption au milieu d'une pose précédente redeviendrait une porte d'entrée.
  const depot = depotClientJetable();
  const racine = join(depot, '.gestionnaire', 'client-x');
  mkdirSync(racine, { recursive: true });
  writeFileSync(join(racine, 'CONTEXTE.md'), 'seul fichier présent\n');

  const etat = etatLieu(depot, 'client-x');
  assert.equal(etat.existe, true);
  assert.deepEqual(etat.presents, ['CONTEXTE.md']);
  // ⚠️ RECIBLÉ (T-20260821-0032) : ce qui manque est tout ce que le gabarit porte et que le
  // lieu n'a pas — chapitres compris. On vérifie donc que les obligatoires manquants sont
  // nommés, ET que le seul présent ne l'est pas.
  for (const f of GABARITS.filter((f) => f !== 'CONTEXTE.md')) {
    assert.ok(etat.manquants.includes(f), `« ${f} » manque et doit être nommé`);
  }
  assert.ok(!etat.manquants.includes('CONTEXTE.md'), 'le seul fichier présent ne peut pas manquer');
  assert.ok(etat.manquants.some((f) => f.startsWith('metier/')),
    'les chapitres absents comptent aussi — un lieu sans eux porte un socle sans profondeur');
});

// ═══════════════════════════════ 4. absence de Somcraft — constatée, pas lue

test('le lieu créé ne donne accès qu’au ServiceDesk — Somcraft est structurellement ABSENT', async () => {
  const depot = depotClientJetable();
  await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  const mcp = JSON.parse(readFileSync(join(depot, '.gestionnaire', 'client-x', '.mcp.json'), 'utf8'));
  const serveurs = Object.keys(mcp.mcpServers || {});
  assert.ok(serveurs.includes('servicedesk'), 'le ServiceDesk doit être présent');
  assert.ok(!serveurs.includes('somcraft'), 'Somcraft ne doit figurer NULLE PART dans les serveurs déclarés');
});

// ═══════════════════════════════ 5. l'accès au registre — prévient sans bloquer, dans les DEUX sens
//
// ⚠️ CE QUE CETTE SECTION MESURE A CHANGÉ, ET C'EST LE DÉFAUT T-20260815-0023.
//
// Elle éprouvait les deux sens SUR LE FICHIER : « un `.env` existe-t-il à la racine ? ». C'est
// l'INDICE au lieu du FAIT. Un dépôt sans `.env` dont le shell porte déjà les variables était
// averti pour rien ; un dépôt avec un `.env` qui ne déclare PAS ce que le `.mcp.json` réclame
// se taisait — et l'agent naissait muet, sans que rien ne le dise.
//
// ⚠️ ET LE PIÈGE DU CORRECTIF, NOMMÉ PAR LE TICKET : consulter `process.env` À CÔTÉ du test de
// fichier et se taire dès que l'un des deux répond. Ça ne fait que remplacer un faux positif
// par un faux négatif — la PRÉSENCE du fichier ne prouve toujours rien. La seule question est
// « ces variables-là sont-elles résolubles, oui ou non ? », et le troisième cas ci-dessous est
// celui qui saute quand on corrige vite. C'est pour lui que cette section existe.
//
// Les variables ne sont JAMAIS écrites en dur ici : elles sont lues du `.mcp.json` du gabarit,
// exactement comme le code sous test les lit. Un gabarit qui changerait de serveur MCP demain
// ferait suivre ces tests sans une ligne à toucher.

/** Ce que le gabarit du représentant réclame RÉELLEMENT — jamais une liste écrite à la main. */
const RECLAMEES = variablesReferencees(join(GABARIT_SOURCE, '.mcp.json'));

/**
 * Exécute `f` avec un environnement de processus MAÎTRISÉ pour les variables nommées.
 *
 * Sans ça, cette suite mesurerait l'environnement du POSTE qui la lance : un développeur dont
 * le shell porte déjà `SOMTECH_DESK_API_KEY` verrait vert un test que l'intégration continue,
 * elle, verrait rouge — ou l'inverse. La valeur posée est un jeton FACTICE, et aucune
 * assertion ne la lit : ce qu'on éprouve, ce sont des NOMS et un verdict présent/absent.
 */
async function avecEnvironnement(valeurs, f) {
  const avant = new Map();
  for (const [k, v] of Object.entries(valeurs)) {
    avant.set(k, Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await f();
  } finally {
    for (const [k, v] of avant) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Les variables du gabarit, toutes retirées de l'environnement du processus. */
const AUCUNE = () => Object.fromEntries(RECLAMEES.map((v) => [v, undefined]));

const poser = (depot) =>
  preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

test('le gabarit du représentant réclame au moins une variable — sinon toute cette section ne prouve rien', () => {
  assert.ok(RECLAMEES.length > 0, 'aucun ${…} dans le .mcp.json du gabarit : les cas qui suivent seraient vides');
});

test('CRITÈRE 1 — aucun fichier d’environnement, mais le processus porte les variables : AUCUN avertissement', async () => {
  // C'est le faux positif de T-20260815-0023, dans sa forme la plus courante : `claude-swt`
  // fournit les jetons au processus, le dépôt n'a aucun `.env`, et l'agent était averti d'un
  // défaut qui n'existait pas. Un avertissement qui se trompe est un avertissement qu'on
  // n'écoute plus — c'est ce que ce cas empêche.
  const depot = depotClientJetable();
  assert.equal(aFichierEnvironnement(depot), false, 'témoin : le dépôt ne porte VRAIMENT aucun fichier d’environnement');

  const r = await avecEnvironnement(Object.fromEntries(RECLAMEES.map((v) => [v, 'factice'])), () => poser(depot));

  assert.equal(r.cree, true);
  assert.deepEqual(r.avertissements, [], 'des variables résolues par le processus ne doivent produire AUCUN avertissement');
});

test('CRITÈRE 2 — ni fichier, ni environnement : un avertissement qui NOMME les variables manquantes', async () => {
  const depot = depotClientJetable();

  const r = await avecEnvironnement(AUCUNE(), () => poser(depot));

  assert.equal(r.cree, true, 'l’absence d’accès au registre ne doit JAMAIS bloquer la création');
  assert.equal(r.avertissements.length, 1, 'et elle doit le dire — une fois');
  for (const v of RECLAMEES) {
    assert.match(
      r.avertissements[0], new RegExp(v),
      `l’avertissement ne nomme pas « ${v} » — « il manque quelque chose » n’a jamais fait réparer personne`,
    );
  }
});

test('CRITÈRE 3 — un .env présent qui ne déclare PAS les variables attendues : averti QUAND MÊME', async () => {
  // ⚠️ LE CAS QUI SAUTE QUAND ON CORRIGE VITE, et la raison d'être du ticket. Un correctif qui
  // se contente d'ajouter `process.env` À CÔTÉ du test de fichier passe les critères 1 et 2 et
  // ÉCHOUE ici : le fichier existe, donc il se tait, donc l'agent naît muet en silence.
  // La présence du fichier ne prouve rien — seule la RÉSOLUTION des variables prouve.
  const depot = depotClientJetable();
  writeFileSync(join(depot, '.env'), '# un vrai .env, mais pas celui-là\nAUTRE_CHOSE=peu-importe\n');
  assert.equal(aFichierEnvironnement(depot), true, 'témoin : le fichier est bien là — c’est tout l’intérêt du cas');

  const r = await avecEnvironnement(AUCUNE(), () => poser(depot));

  assert.equal(r.avertissements.length, 1, 'un .env qui ne déclare pas ce que le .mcp.json réclame ne résout RIEN');
  for (const v of RECLAMEES) {
    assert.match(r.avertissements[0], new RegExp(v), `« ${v} » n’est déclarée nulle part et n’est pourtant pas nommée`);
  }
});

test('CRITÈRE 5 — une variable présente mais VIDE dans l’environnement compte comme manquante', async () => {
  // Une chaîne vide part quand même dans l'en-tête `Authorization` : le serveur répond 401 et
  // disparaît de la session. « Définie » n'est pas « utilisable » — c'est déjà le verdict de
  // `mcp_env_missing` côté shell, et il ne se perd pas en traversant vers ici.
  const depot = depotClientJetable();

  const r = await avecEnvironnement(Object.fromEntries(RECLAMEES.map((v) => [v, ''])), () => poser(depot));

  assert.equal(r.avertissements.length, 1, 'une variable vide a été prise pour une variable fournie');
  for (const v of RECLAMEES) {
    assert.match(r.avertissements[0], new RegExp(v));
  }
});

test('le sens inverse tient : un .env qui déclare RÉELLEMENT les variables — aucun avertissement', async () => {
  const depot = depotClientJetable();
  writeFileSync(join(depot, '.env'), RECLAMEES.map((v) => `${v}=factice`).join('\n') + '\n');

  const r = await avecEnvironnement(AUCUNE(), () => poser(depot));

  assert.equal(r.cree, true);
  assert.deepEqual(r.avertissements, [], 'un dépôt réellement pourvu ne doit produire aucun faux avertissement');
});

test('un .envrc (direnv, « export VAR=… ») vaut un .env — c’est la même déclaration', async () => {
  const depot = depotClientJetable();
  writeFileSync(join(depot, '.envrc'), RECLAMEES.map((v) => `export ${v}="factice"`).join('\n') + '\n');

  const r = await avecEnvironnement(AUCUNE(), () => poser(depot));
  assert.deepEqual(r.avertissements, [], 'la forme « export VAR=… » du .envrc n’a pas été reconnue');
});

test('un .env qui déclare la variable À VIDE ne la résout pas davantage', async () => {
  const depot = depotClientJetable();
  writeFileSync(join(depot, '.env'), RECLAMEES.map((v) => `${v}=`).join('\n') + '\n');

  const r = await avecEnvironnement(AUCUNE(), () => poser(depot));
  assert.equal(r.avertissements.length, 1, 'une déclaration vide dans un .env a été prise pour une variable fournie');
});

test('l’avertissement ne laisse JAMAIS fuir une valeur — seulement des noms', async () => {
  // Un avertissement est imprimé, journalisé, collé dans un ticket. Il ne porte que des NOMS —
  // la même garantie que `mcp-env.sh` tient côté shell (« ce qu'il ne fait jamais »).
  const depot = depotClientJetable();
  const TEMOIN = 'valeur-temoin-qui-ne-doit-jamais-sortir-0001';
  // Une seule des deux moitiés est fournie côté fichier : il RESTE donc un avertissement, et
  // c'est lui qu'on fouille. Un test sans avertissement ne prouverait aucune non-fuite.
  writeFileSync(join(depot, '.env'), `AUTRE_CHOSE=${TEMOIN}\n`);

  const r = await avecEnvironnement(Object.fromEntries(RECLAMEES.map((v) => [v, TEMOIN + '-env'])), () =>
    preparerLieuRepresentant({
      depotClient: depot, client: 'client-y', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
    })
  );
  // Ici tout est résolu : rien à dire. On refait le tour avec RIEN de résolu, pour avoir un
  // avertissement réel à fouiller.
  assert.deepEqual(r.avertissements, []);

  const depot2 = depotClientJetable();
  writeFileSync(join(depot2, '.env'), `AUTRE_CHOSE=${TEMOIN}\n`);
  const r2 = await avecEnvironnement(AUCUNE(), () => poser(depot2));

  assert.equal(r2.avertissements.length, 1);
  assert.ok(
    !r2.avertissements.join('\n').includes(TEMOIN),
    'une valeur d’environnement a fui dans un avertissement — elle finira dans un journal, puis dans un ticket',
  );
});

// ═══════════════════════════════ 6. l'EFFET du placement, pas son contenu — défaut confirmé sur #181
//
// Défaut vécu : la première version de ce lot posait les quatre fichiers À PLAT. `.mcp.json`
// fonctionnait — Claude Code le lit bien à la racine du répertoire de travail — et ce seul
// succès a caché que `settings.json`, lui, était mort au même endroit : présent, jamais lu,
// parce que Claude Code ne résout les permissions PROJET qu'à `.claude/settings.json`. La
// garantie RA-REL-015 (« aucune écriture, aucun envoi, aucune fusion ») aurait été FAUSSE en
// production, derrière des tests qui ne vérifiaient que le CONTENU du fichier posé, jamais
// l'endroit où l'outil va le chercher — le même motif, encore : la garde regardait ce que le
// fichier CONTIENT, pas ce qu'il FAIT.
//
// CE QUE CES TESTS PROUVENT, ET CE QU'ILS NE PROUVENT PAS — À LIRE AVANT DE LES CROIRE :
//
// Ils prouvent le PLACEMENT, condition nécessaire pour que Claude Code lise le fichier du
// tout, en l'ANCRANT sur la réalité observée de CE dépôt-ci, qui tourne actuellement sous sa
// propre configuration. Ce n'est pas une supposition relue dans une documentation : c'est
// vérifié ci-dessous, sur le dépôt réel, avant même de tester le code produit.
//
// Ils ne prouvent PAS l'effet de bout en bout — qu'une vraie session Claude Code démarrée
// dans le lieu produit refuserait réellement une écriture hors périmètre. Ça demanderait de
// faire tourner le harnais Claude Code lui-même à l'intérieur du test, ce qu'aucun test de ce
// dépôt ne fait nulle part ailleurs non plus : le harnais n'est pas un module qu'on importe.
// Le dire ici plutôt que de laisser croire que c'est réglé.

test('réalité observée : CE dépôt lit ses permissions à .claude/settings.json, jamais à plat', () => {
  assert.ok(
    existsSync(join(REPO, '.claude', 'settings.json')),
    'ce dépôt doit avoir un .claude/settings.json — sinon l’ancrage qui suit ne prouve rien'
  );
  assert.ok(
    !existsSync(join(REPO, 'settings.json')),
    'et aucun settings.json à plat à sa racine — sinon les deux coexisteraient sans qu’on sache lequel compte'
  );
});

test('réalité observée : CE dépôt lit son .mcp.json À PLAT, à sa racine', () => {
  assert.ok(existsSync(join(REPO, '.mcp.json')), 'ce dépôt doit avoir un .mcp.json à sa racine — sinon l’ancrage qui suit ne prouve rien');
});

test('le lieu créé place settings.json exactement là où cette réalité dit qu’il est lu — jamais à plat', async () => {
  const depot = depotClientJetable();
  await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });
  const racine = join(depot, '.gestionnaire', 'client-x');

  assert.ok(existsSync(join(racine, '.claude', 'settings.json')), 'settings.json doit exister sous .claude/');
  assert.ok(
    !existsSync(join(racine, 'settings.json')),
    'et JAMAIS à plat — c’est très exactement le défaut confirmé sur #181 : un fichier posé, présent, jamais lu'
  );
});

test('le lieu créé place .mcp.json à plat — comme ce dépôt le fait lui-même', async () => {
  const depot = depotClientJetable();
  await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });
  const racine = join(depot, '.gestionnaire', 'client-x');

  assert.ok(existsSync(join(racine, '.mcp.json')), '.mcp.json doit exister à la racine du lieu');
  assert.ok(
    !existsSync(join(racine, '.claude', '.mcp.json')),
    '.mcp.json ne doit pas être sous .claude/ — ce n’est pas là que Claude Code le lit'
  );
});

test('la convention suivie ici reste alignée sur celle du pack — cli/src/commands/setup.js, jamais réinventée', () => {
  // Ancrage indépendant de ce dépôt-ci : le point cité en revue (cli/src/commands/setup.js:57)
  // résout DÉJÀ les permissions à `.claude/settings.json`. Ce test garde ce module aligné sur
  // cette convention établie — si l'un des deux dérive un jour, ce test le voit avant qu'un
  // lieu de représentant ne reparte inerte pour la même raison.
  const src = readFileSync(join(REPO, 'cli', 'src', 'commands', 'setup.js'), 'utf8');
  assert.match(
    src,
    /join\([^)]*'\.claude',\s*'settings\.json'\)/,
    'cli/src/commands/setup.js ne résout plus les permissions à .claude/settings.json — la convention citée en revue a changé, GABARITS doit suivre'
  );
});

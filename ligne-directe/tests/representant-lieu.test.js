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
  assert.deepEqual(etat.manquants, GABARITS.filter((f) => f !== 'CONTEXTE.md'));
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

// ═══════════════════════════════ 5. le fichier d'environnement — prévient sans bloquer, dans les DEUX sens

test('avertit sans bloquer : dépôt sans fichier d’environnement — créé quand même, avec un avertissement', async () => {
  const depot = depotClientJetable();
  assert.equal(aFichierEnvironnement(depot), false);

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.equal(r.cree, true, 'l’absence de fichier d’environnement ne doit JAMAIS bloquer la création');
  assert.ok(r.avertissements.length > 0, 'et elle doit le dire');
});

test('aucun avertissement quand le dépôt porte déjà un fichier d’environnement', async () => {
  const depot = depotClientJetable();
  writeFileSync(join(depot, '.env'), 'SOMTECH_DESK_API_KEY=essai\n');
  assert.equal(aFichierEnvironnement(depot), true);

  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });

  assert.equal(r.cree, true);
  assert.deepEqual(r.avertissements, [], 'un dépôt déjà pourvu ne doit produire aucun faux avertissement');
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

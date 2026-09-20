// ============================================================
// Le banc de « quelle version est installée sur ce poste » — T-20260816-0020.
//
// Ce que ce banc garde, et pourquoi chaque cas existe :
//
//   · Un poste jamais installé doit le DIRE. Un numéro plausible se cite ; une
//     absence se cherche. Le ticket est né d'un chiffre fabriqué, répété toute
//     une soirée, qui a servi d'argument dans trois décisions.
//   · « Je n'ai pas pu regarder » ne doit JAMAIS ressembler à « à jour ». C'est
//     la même famille que le tag local périmé de T-20260820-0097 : un silence
//     qui se lit comme un succès.
//   · Une valeur de cache doit dire son ÂGE. Mesuré : le cache servait un
//     « dernier publié » vieux de 24 h et de sept versions, sans l'annoncer.
//
// Les deux modules sous garde sont surchargeables par SOMTECH_VERSION_POSTE_SRC
// et SOMTECH_VERSION_CMD_SRC : c'est ce qui permet au banc de mutation de jouer
// cette même suite contre une COPIE mutée, et d'exiger qu'elle rougisse.
// ============================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC_LIB = process.env.SOMTECH_VERSION_POSTE_SRC
  || new URL('../src/version-poste.js', import.meta.url).pathname;
const SRC_CMD = process.env.SOMTECH_VERSION_CMD_SRC
  || new URL('../src/commands/version-poste-cmd.js', import.meta.url).pathname;

const lib = await import(pathToFileURL(SRC_LIB).href);
const cmd = await import(pathToFileURL(SRC_CMD).href);

const MAINTENANT = 1_700_000_000_000; // epoch ms figé : aucun cas ne dépend de l'heure

function posteJetable() {
  return mkdtempSync(join(tmpdir(), 'poste-'));
}
function poserMarqueur(dir, contenu) {
  mkdirSync(join(dir, '.somtech-pack'), { recursive: true });
  writeFileSync(join(dir, '.somtech-pack', 'version.json'),
    typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
}
function poserCache(dir, contenu) {
  writeFileSync(join(dir, 'pack-latest.json'),
    typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
}
function poserVerrou(dir, nom, ageSecondes) {
  const p = join(dir, nom);
  mkdirSync(p, { recursive: true });
  const t = MAINTENANT / 1000 - ageSecondes;
  utimesSync(p, t, t);
  return p;
}

test('un poste jamais installé le DIT, et ne rend AUCUN numéro', () => {
  const d = posteJetable();
  try {
    const r = lib.lireVersionPoste(d);
    assert.equal(r.etat, 'ABSENTE');
    assert.equal(r.version, null, 'une absence ne doit jamais porter de numéro');

    const e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: '9.9.9' });
    const rendu = cmd.rendreEtat(e).join('\n');
    assert.match(rendu, /AUCUNE INSTALLATION POSTE/);
    // Le numéro publié a le droit d'apparaître ; celui du poste, non — il n'existe pas.
    assert.doesNotMatch(rendu, /installée sur ce poste : \d/,
      'un poste vierge ne doit pas se voir attribuer un numéro');
    assert.equal(cmd.codeRetour(e), 2, 'rc=0 se lirait « tout va bien »');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('un marqueur illisible se distingue d’une absence', () => {
  const d = posteJetable();
  try {
    poserMarqueur(d, 'ceci n’est pas du JSON');
    assert.equal(lib.lireVersionPoste(d).etat, 'ILLISIBLE');
    poserMarqueur(d, { name: 'x' });
    assert.equal(lib.lireVersionPoste(d).etat, 'ILLISIBLE');
    poserMarqueur(d, { version: 'la-version-du-tonnerre' });
    assert.equal(lib.lireVersionPoste(d).etat, 'ILLISIBLE');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('un poste installé rend sa version ET l’écart avec le registre', () => {
  const d = posteJetable();
  try {
    poserMarqueur(d, { version: '1.99.2' });
    const e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: '1.100.0' });
    assert.equal(e.poste.version, '1.99.2');
    assert.equal(e.publiee, '1.100.0');
    assert.equal(e.sourcePubliee, 'REGISTRE');
    assert.equal(e.ecart, 'EN-RETARD');
    assert.equal(cmd.codeRetour(e), 1);
    const rendu = cmd.rendreEtat(e).join('\n');
    assert.match(rendu, /1\.99\.2/);
    assert.match(rendu, /1\.100\.0/);
    assert.match(rendu, /EN RETARD/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('à jour : les deux moitiés concordent, rc=0', () => {
  const d = posteJetable();
  try {
    poserMarqueur(d, { version: '2.0.0' });
    const e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: '2.0.0' });
    assert.equal(e.ecart, 'A-JOUR');
    assert.equal(cmd.codeRetour(e), 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('registre injoignable ET aucun cache : INDÉTERMINÉ, jamais « à jour »', () => {
  const d = posteJetable();
  try {
    poserMarqueur(d, { version: '1.2.3' });
    const e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: null });
    assert.equal(e.sourcePubliee, 'INCONNUE');
    assert.equal(e.ecart, 'INDETERMINE');
    assert.equal(cmd.codeRetour(e), 3, 'ne pas avoir pu regarder n’est pas un succès');
    const rendu = cmd.rendreEtat(e).join('\n');
    assert.match(rendu, /INDÉTERMIN/);
    assert.doesNotMatch(rendu, /À JOUR/, '« à jour » ne doit pas apparaître sur une mesure impossible');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('le cache sert de repli, et DIT son âge', () => {
  const d = posteJetable();
  try {
    poserMarqueur(d, { version: '1.99.2' });
    poserCache(d, { checkedAt: Math.floor(MAINTENANT / 1000) - 86400 * 2, latest: '1.100.0' });
    const e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: null });
    assert.equal(e.sourcePubliee, 'CACHE');
    assert.equal(e.publiee, '1.100.0');
    assert.equal(e.agePubliee, 86400 * 2);
    const rendu = cmd.rendreEtat(e).join('\n');
    assert.match(rendu, /CACHE, 2 j/, 'un cache qui tait son âge se cite comme s’il était frais');
    assert.match(rendu, /registre injoignable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('le registre PRIME sur le cache quand les deux répondent', () => {
  const d = posteJetable();
  try {
    poserMarqueur(d, { version: '1.0.0' });
    poserCache(d, { checkedAt: Math.floor(MAINTENANT / 1000), latest: '1.50.0' });
    const e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: '2.0.0' });
    assert.equal(e.publiee, '2.0.0');
    assert.equal(e.sourcePubliee, 'REGISTRE');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('un cache corrompu ne devient pas une valeur publiée', () => {
  const d = posteJetable();
  try {
    poserMarqueur(d, { version: '1.0.0' });
    poserCache(d, 'pas du json');
    let e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: null });
    assert.equal(e.ecart, 'INDETERMINE');
    assert.equal(e.sourcePubliee, 'INCONNUE');

    // ⚠️ L'écart seul ne DISCRIMINE PAS ici : une valeur non-semver retenue
    // comme publiée rendrait *aussi* INDETERMINE, par l'autre bout. C'est la
    // SOURCE qui tranche — un cache corrompu ne doit pas être retenu du tout.
    poserCache(d, { checkedAt: 0, latest: 'derniere' });
    e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: null });
    assert.equal(e.ecart, 'INDETERMINE');
    assert.equal(e.sourcePubliee, 'INCONNUE', 'une valeur de cache non-semver n\u2019est pas une version publi\u00e9e');
    assert.equal(e.publiee, null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('le comparateur ne déborde pas sur le champ voisin', () => {
  // La clé pondérée `maj*1e6 + min*1e3 + pat` donne le MÊME nombre à ces couples.
  assert.equal(lib.comparerVersions('1.0.1000', '1.1.0'), -1);
  assert.equal(lib.comparerVersions('1.1000.0', '2.0.0'), -1);
  assert.equal(lib.comparerVersions('1.100.0', '1.9.0'), 1);
  assert.equal(lib.comparerVersions('0.999.999', '1.0.0'), -1);
  assert.equal(lib.comparerVersions('2.3.4', '2.3.4'), 0);
  assert.equal(lib.comparerVersions('pas-un-semver', '1.0.0'), null);
  assert.equal(lib.ecartVersions('1.0.1000', '1.1.0'), 'EN-RETARD');
  assert.equal(lib.ecartVersions('2.0.0', '1.0.0'), 'EN-AVANCE');
  // La branche « on n'a pas su comparer » se juge ICI : dans `etatDuPoste`, les
  // deux valeurs sont déjà validées, donc elle n'y est jamais atteinte. Une
  // branche qu'aucun appel ne traverse est une branche qu'aucune épreuve ne juge.
  assert.equal(lib.ecartVersions('pas-un-semver', '1.0.0'), 'INDETERMINE');
  assert.equal(lib.ecartVersions('1.0.0', null), 'INDETERMINE');
  assert.equal(lib.ecartVersions(undefined, undefined), 'INDETERMINE');
});

test('les verrous périmés sont nommés avec leur âge ; les frais sont épargnés', () => {
  const d = posteJetable();
  try {
    poserVerrou(d, 'pack-update-vieux.lock', 86400 * 30);
    poserVerrou(d, 'pack-update-moyen.lock', 3600);
    poserVerrou(d, 'pack-update-frais.lock', 10);
    poserVerrou(d, 'autre-chose.lock', 86400 * 30); // pas un verrou de mise à jour
    const v = lib.verrousPerimes(d, 600, MAINTENANT);
    assert.deepEqual(v.map((x) => x.nom), ['pack-update-vieux.lock', 'pack-update-moyen.lock'],
      'le plus vieux en tête, le frais épargné, l’étranger ignoré');
    assert.equal(v[0].ageSecondes, 86400 * 30);
    assert.match(lib.direAge(v[0].ageSecondes), /30 j/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('les verrous périmés apparaissent dans le rendu, avec le geste qui les lève', () => {
  const d = posteJetable();
  try {
    poserMarqueur(d, { version: '1.0.0' });
    poserVerrou(d, 'pack-update-vieux.lock', 86400 * 30);
    const e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: '1.0.0' });
    const rendu = cmd.rendreEtat(e).join('\n');
    assert.match(rendu, /pack-update-vieux\.lock/);
    assert.match(rendu, /30 j/);
    assert.match(rendu, /setup --yes/, 'un verrou signalé sans le geste qui le lève ne sert à rien');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('ALLER-RETOUR RÉEL : ce que setup écrit, la commande le relit', async () => {
  const ecrire = await import(pathToFileURL(
    process.env.SOMTECH_VERSION_ECRIRE_SRC
      || new URL('../src/version-poste-ecrire.js', import.meta.url).pathname).href);
  const d = posteJetable();
  try {
    // Avant : le poste ne sait rien de lui-même.
    assert.equal(lib.lireVersionPoste(d).etat, 'ABSENTE');

    ecrire.ecrireVersionPoste(d, { version: '1.100.0', contenu: '1.64.0' });

    const apres = lib.lireVersionPoste(d);
    assert.equal(apres.etat, 'INSTALLEE');
    assert.equal(apres.version, '1.100.0', 'la version écrite est celle du PAQUET, pas le vestige du dépôt');
    assert.equal(apres.marqueur.packContentVersion, '1.64.0');
    assert.equal(apres.marqueur.portee, 'poste');

    const e = cmd.etatDuPoste({ toolsDir: d, maintenant: MAINTENANT, registre: '1.100.0' });
    assert.equal(e.ecart, 'A-JOUR');
    assert.equal(cmd.codeRetour(e), 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('le ramassage retire les verrous périmés et épargne les frais', async () => {
  const ecrire = await import(pathToFileURL(
    process.env.SOMTECH_VERSION_ECRIRE_SRC
      || new URL('../src/version-poste-ecrire.js', import.meta.url).pathname).href);
  const d = posteJetable();
  try {
    poserVerrou(d, 'pack-update-vieux.lock', 86400 * 30);
    poserVerrou(d, 'pack-update-frais.lock', 10);

    const sec = ecrire.ramasserVerrous(d, { ttlSecondes: 600, maintenant: MAINTENANT, dryRun: true });
    assert.equal(sec.retires.length, 0, 'un dry-run ne retire rien');
    assert.equal(sec.candidats.length, 1);
    assert.equal(lib.verrousPerimes(d, 600, MAINTENANT).length, 1, 'et le verrou est toujours là');

    const r = ecrire.ramasserVerrous(d, { ttlSecondes: 600, maintenant: MAINTENANT });
    assert.deepEqual(r.retires.map((x) => x.nom), ['pack-update-vieux.lock']);
    assert.equal(lib.verrousPerimes(d, 600, MAINTENANT).length, 0);
    // Le frais est épargné : le mesurer est ce qui distingue « ramasser les
    // périmés » de « vider le dossier ».
    assert.equal(lib.lireVersionPoste(join(d, 'pack-update-frais.lock')).etat, 'ABSENTE');
    const restants = lib.verrousPerimes(d, 0, MAINTENANT).map((x) => x.nom);
    assert.deepEqual(restants, ['pack-update-frais.lock'], 'le verrou frais doit survivre');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

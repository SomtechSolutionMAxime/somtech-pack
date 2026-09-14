// la-pose-inscrit-ce-quelle-tient.test.js — T-20260809-0024.
//
// LE DÉFAUT : la pose d'un représentant reçoit le canal (et le client) en argument, le
// VÉRIFIE contre Slack, puis le JETTE. Mesuré le 2026-09-14 : `preparerLieuRepresentant`
// rendait `ok:true, cree:true, avertissements:[]` et le `CONTEXTE.md` posé était identique
// octet pour octet au gabarit — « le canal où tu lui parles » restait `<le canal privé, sans
// le croisillon>`, alors que la commande venait de le prouver joignable. Et le rendu disait
// « rien à signaler » sur un lieu que la naissance allait refuser.
//
// CE QUI EST GARDÉ ICI, sur un disque réel, dans un dépôt jetable :
//   1. ce que la pose TIENT est inscrit, à SA rubrique — et rien d'autre ne bouge, à l'octet ;
//   2. le titre n'est inscrit que s'il est donné, et son absence est NOMMÉE dans le rendu ;
//   3. un lieu qui existait déjà n'est JAMAIS réécrit (RA-REL-014) ;
//   4. la commande lit `--titre` et le transmet (garde de câblage : la commande réelle
//      interroge Slack, ce qu'un essai ne fait pas).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparerLieuRepresentant } from '../src/representant.js';
import { chevronsDuGabarit } from '../src/lieu-renseigne.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const GABARIT_SOURCE = join(REPO, '.claude', 'templates', 'gestionnaire-client');
const GABARIT_CONTEXTE = readFileSync(join(GABARIT_SOURCE, 'CONTEXTE.md'), 'utf8');

const JOIGNABLE = async () => ({ joignable: true, canal: 'client-x', id: 'C1' });

/** Le chevron que le gabarit porte sur la ligne de tableau dont la première cellule est `libelle`. */
function chevronDeLaRubrique(libelle) {
  const ligne = GABARIT_CONTEXTE.split('\n').find(
    (l) => l.startsWith('|') && l.split('|')[1]?.replace(/\*/g, '').trim() === libelle
  );
  assert.ok(ligne, `la rubrique « ${libelle} » n’existe plus au gabarit — cet essai ne prouverait rien`);
  const [chevron] = chevronsDuGabarit(ligne);
  assert.ok(chevron, `la rubrique « ${libelle} » ne porte plus de chevron au gabarit`);
  return { ligne, chevron };
}

const CLIENT = chevronDeLaRubrique('Le client');
const CANAL = chevronDeLaRubrique('Le canal où tu lui parles');
const TITRE = chevronDeLaRubrique('Le titre de ta ligne');

function depotJetable(t) {
  const racine = mkdtempSync(join(tmpdir(), 'ld-pose-inscrit-'));
  t.after(() => rmSync(racine, { recursive: true, force: true }));
  cpSync(GABARIT_SOURCE, join(racine, '.claude', 'templates', 'gestionnaire-client'), { recursive: true });
  return racine;
}

const contexteDe = (depot, client = 'client-x') => join(depot, '.gestionnaire', client, 'CONTEXTE.md');

test('la pose inscrit le client et le canal (sans croisillon) À LEUR RUBRIQUE — le reste reste au gabarit, à l’octet', async (t) => {
  const depot = depotJetable(t);
  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: '#client-x-prive', verifierJoignabilite: JOIGNABLE,
  });
  assert.equal(r.ok, true, r.refus?.message);
  assert.equal(r.cree, true);

  const pose = readFileSync(contexteDe(depot), 'utf8');
  const attendu = GABARIT_CONTEXTE
    .replace(CLIENT.ligne, CLIENT.ligne.replace(CLIENT.chevron, 'client-x'))
    .replace(CANAL.ligne, CANAL.ligne.replace(CANAL.chevron, 'client-x-prive'));
  // La comparaison est ENTIÈRE : une inscription au mauvais endroit, une rubrique touchée en
  // plus, un croisillon conservé — tout rougit ici, pas seulement l'absence du mot.
  assert.equal(pose, attendu, 'CONTEXTE.md posé ≠ gabarit + client + canal, et rien d’autre');
  assert.ok(pose.includes(TITRE.chevron), 'sans --titre, la rubrique du titre reste vierge');
});

test('avec un titre : il est inscrit à sa rubrique, et le rendu ne le réclame plus', async (t) => {
  const depot = depotJetable(t);
  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', titre: 'Votre équipe Somtech',
    verifierJoignabilite: JOIGNABLE,
  });
  assert.equal(r.ok, true, r.refus?.message);

  const pose = readFileSync(contexteDe(depot), 'utf8');
  const attendu = GABARIT_CONTEXTE
    .replace(CLIENT.ligne, CLIENT.ligne.replace(CLIENT.chevron, 'client-x'))
    .replace(CANAL.ligne, CANAL.ligne.replace(CANAL.chevron, 'client-x'))
    .replace(TITRE.ligne, TITRE.ligne.replace(TITRE.chevron, 'Votre équipe Somtech'));
  assert.equal(pose, attendu);

  const tout = r.avertissements.join('\n');
  assert.ok(!tout.includes(TITRE.chevron), `le titre est inscrit et pourtant réclamé : ${tout}`);
  assert.ok(!/--titre/.test(tout), `le titre est inscrit et le rendu envoie encore le fournir : ${tout}`);
});

test('sans titre : le rendu N’EST PLUS avertissements:[] — il nomme le titre et ce qui reste à renseigner', async (t) => {
  const depot = depotJetable(t);
  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });
  assert.equal(r.ok, true, r.refus?.message);
  assert.notDeepEqual(r.avertissements, [], 'un lieu qui ne peut pas naître a été rendu « sans rien à signaler »');

  const tout = r.avertissements.join('\n');
  assert.ok(tout.includes(TITRE.chevron), `le titre manquant n’est pas nommé : ${tout}`);
  assert.match(tout, /--titre/, 'le geste qui inscrit le titre n’est pas nommé');
  // Ce que la pose a inscrit n'est plus réclamé — sinon le rendu mentirait sur le fichier.
  assert.ok(!tout.includes(CLIENT.chevron), 'le client est inscrit et pourtant réclamé');
  assert.ok(!tout.includes(CANAL.chevron), 'le canal est inscrit et pourtant réclamé');
});

test('RA-REL-014 — une re-pose sur un lieu existant ne touche JAMAIS CONTEXTE.md, même avec un titre', async (t) => {
  const depot = depotJetable(t);
  const premiere = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', verifierJoignabilite: JOIGNABLE,
  });
  assert.equal(premiere.cree, true);

  // Un fichier resté AU GABARIT — le cas où une réécriture serait la plus tentante.
  writeFileSync(contexteDe(depot), GABARIT_CONTEXTE);
  const seconde = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'autre-canal', titre: 'Un titre neuf',
    verifierJoignabilite: JOIGNABLE,
  });
  assert.equal(seconde.ok, true);
  assert.equal(seconde.cree, false);
  assert.equal(readFileSync(contexteDe(depot), 'utf8'), GABARIT_CONTEXTE, 'la re-pose a réécrit CONTEXTE.md');
});

test('un refus n’inscrit rien — et ne crée rien', async (t) => {
  const depot = depotJetable(t);
  const r = await preparerLieuRepresentant({
    depotClient: depot, client: 'client-x', canal: 'client-x', titre: 'T',
    verifierJoignabilite: async () => ({ joignable: false, motif: 'non_membre', canal: 'client-x' }),
  });
  assert.equal(r.ok, false);
  assert.equal(existsSync(join(depot, '.gestionnaire')), false);
});

test('câblage — la commande `representant` lit --titre et le transmet à la pose', () => {
  // ⚠️ GARDE DE FORME, dite comme telle : la commande réelle interroge Slack et le trousseau du
  // poste, ce qu'aucun essai ne fait. Le comportement est prouvé par les essais ci-dessus.
  const cli = readFileSync(join(REPO, 'ligne-directe', 'bin', 'ligne-directe.js'), 'utf8');
  const branche = cli.slice(cli.indexOf("geste === 'representant'"), cli.indexOf("geste === 'orchestrateur'"));
  assert.ok(branche.length > 100, 'branche « representant » introuvable');
  const appel = branche.slice(branche.indexOf('preparerLieuRepresentant('));
  assert.match(branche, /option\(args, '--titre'\)/, '--titre n’est pas lu par la sous-commande representant');
  assert.match(appel.slice(0, appel.indexOf('});')), /\btitre\b/, '--titre est lu mais pas transmis à la pose');
  const usageRepr = cli.split('\n').filter((l) => /representant <client>/.test(l));
  assert.equal(usageRepr.length, 2, 'l’en-tête et l’usage doivent chacun décrire la sous-commande');
  for (const l of usageRepr) {
    assert.match(l, /--titre/, `une description de la sous-commande ignore --titre : ${l.trim()}`);
    assert.match(l, /--dirigeant/, `une description de la sous-commande ignore --dirigeant : ${l.trim()}`);
  }
});

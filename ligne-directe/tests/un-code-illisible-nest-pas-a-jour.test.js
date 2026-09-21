// UN CODE ILLISIBLE N'EST PAS « À JOUR » (T-20260818-0035) — LA SONDE COUPÉE.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE MODE DE PANNE QUE CE BANC FERME
//
// « Je n'ai pas pu mesurer » et « c'est à jour » sont deux faits opposés, et une mesure
// aveugle qui retomberait sur le second par défaut mentirait exactement là où on a le plus
// besoin d'elle : un dossier de code disparu, ou illisible, ne doit JAMAIS se lire comme un
// veilleur à jour. C'est la garde « couper la sonde » du brief — chaque cas où la mesure est
// aveugle doit rendre un verdict DIFFÉRENT de « tout est à jour ».
//
// Contrôle en fin de fichier : le même geste sur un dossier LISIBLE rend `perime: false`,
// et les deux verdicts diffèrent — sinon la garde serait vraie par accident (elle rendrait
// toujours la même chose, mesure ou pas).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { empreinteDuCode, ecartDeCode, identiteDuCode } from '../src/identite-du-code.js';

let bac;
before(() => {
  bac = mkdtempSync(join(tmpdir(), 'ld-code-illisible-'));
});
after(() => rmSync(bac, { recursive: true, force: true }));

test('un dossier INEXISTANT rend une empreinte NULLE, avec un refus nommé — jamais une empreinte vide', () => {
  const inexistant = join(bac, 'nexiste-pas');
  const mesure = empreinteDuCode(inexistant);
  assert.equal(mesure.empreinte, null, 'un dossier inexistant ne mesure RIEN — pas une empreinte de contenu vide');
  assert.equal(mesure.fichiers, 0);
  assert.equal(mesure.date, null);
  assert.ok(mesure.refus && mesure.refus.length > 0, 'le refus doit être NOMMÉ, pas silencieux');
});

test('un dossier VIDE (aucun .js) rend aussi une empreinte NULLE, avec un refus', () => {
  const vide = join(bac, 'vide');
  mkdirSync(vide, { recursive: true });
  writeFileSync(join(vide, 'notes.txt'), 'rien à mesurer ici');
  const mesure = empreinteDuCode(vide);
  assert.equal(mesure.empreinte, null, 'aucun .js à mesurer : pas d’empreinte qui aurait l’air d’une mesure');
  assert.ok(mesure.refus, 'le refus doit nommer l’absence');
});

test('ecartDeCode rend perime: null quand une des deux identités n’a pas d’empreinte', () => {
  const servi = identiteDuCode({ dossierSrc: join(bac, 'nexiste-pas-non-plus') });
  const installe = identiteDuCode({ dossierSrc: (() => {
    const d = join(bac, 'installe-lisible');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'a.js'), 'export const a = 1;\n');
    return d;
  })() });

  const ecart = ecartDeCode(servi, installe);
  // ⚠️ STRICTEMENT `null`, PAS `false` : un mutant qui rendrait `perime:false` ici ferait
  // passer une mesure ratée pour un veilleur à jour — exactement le mensonge que ce lot ferme.
  assert.equal(ecart.perime, null, `« je n’ai pas pu mesurer » doit rester null, jamais false — reçu ${JSON.stringify(ecart)}`);
  assert.match(ecart.motif, /impossible de comparer/, `le motif doit dire l’impossibilité, pas inventer un verdict — reçu : ${ecart.motif}`);
});

test('CONTRÔLE — le même geste sur un dossier LISIBLE ET INCHANGÉ rend perime: false, et les deux verdicts diffèrent', () => {
  const d = join(bac, 'controle-lisible');
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'a.js'), 'export const a = 1;\n');

  const identite = identiteDuCode({ dossierSrc: d });
  const surDisque = empreinteDuCode(d);
  const ecart = ecartDeCode(identite, surDisque);

  assert.equal(ecart.perime, false, 'un dossier lisible et inchangé doit être jugé À JOUR');
  // Le contrôle : les deux verdicts (sonde coupée vs sonde qui mesure) doivent différer,
  // sinon la garde du dessus serait verte par accident.
  const inexistant = ecartDeCode(identiteDuCode({ dossierSrc: join(bac, 'toujours-absent') }), surDisque);
  assert.notEqual(inexistant.perime, ecart.perime, 'la sonde coupée et la sonde qui mesure ne doivent PAS rendre le même verdict');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// UNE DÉRIVE SAUVEGARDÉE N'EST PAS DU CODE SERVI (mutation survivante, passe de fond)
//
// ⚠️ MUTATION QUI A SURVÉCU AUX 1444 : retirer le filtre `.somtech.bak` de `empreinteDuCode`.
// Le fait qui rend ce filtre nécessaire est mesuré sur ce poste — `~/.somtech/ligne-directe/
// src/` porte `arguments.js.somtech.bak`, `.somtech.bak.1`, `.somtech.bak.2` : les dérives que
// `pack setup` met de côté AVANT d'écraser un fichier modifié à la main. Node ne les charge
// jamais ; le veilleur ne sert donc pas une ligne de leur contenu.
//
// Sans le filtre, l'empreinte les COMPTE. Deux conséquences, et la seconde est la grave :
//   1. deux postes au code IDENTIQUE rendent des empreintes DIFFÉRENTES, selon l'historique
//      de leurs dérives — l'empreinte cesse d'identifier le code ;
//   2. une simple sauvegarde posée à côté fait basculer le veilleur en « périmé », donc
//      `pack setup` le RELÈVE pour rien, et le journal annonce un écart qui n'existe pas.
//      Un veilleur relevé sans raison est un dispositif qui crie au loup : on cesse de le lire.
//
// ⚠️ LE BANC NE COMPTE PAS LES FICHIERS, IL COMPARE DEUX MESURES. Vérifier « 3 fichiers »
// serait une copie du contenu du dossier dans le banc ; ce qu'on exige est une PROPRIÉTÉ :
// poser une sauvegarde ne change pas ce que le veilleur sert.
test('une dérive sauvegardée (.somtech.bak) ne change pas l’empreinte — elle n’est pas servie', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'smtk-bak-'));
  writeFileSync(join(dossier, 'veilleur.js'), 'export const x = 1;\n');
  const avant = empreinteDuCode(dossier);
  assert.ok(avant.empreinte, 'le dossier est lisible : l’empreinte doit exister');

  // Exactement ce que `pack setup` dépose à côté d'un fichier qu'il converge.
  writeFileSync(join(dossier, 'veilleur.js.somtech.bak'), 'export const x = 0; // la version d’avant\n');
  writeFileSync(join(dossier, 'veilleur.js.somtech.bak.1'), 'export const x = -1;\n');
  const apres = empreinteDuCode(dossier);

  assert.equal(
    apres.empreinte,
    avant.empreinte,
    'le code servi n’a pas bougé : poser une sauvegarde à côté ne doit pas faire basculer le veilleur en « périmé »'
  );
  assert.equal(apres.fichiers, avant.fichiers, 'une sauvegarde n’est pas un fichier servi et ne se compte pas');

  // LE CONTRÔLE — la mesure n'est pas aveugle : un VRAI changement, lui, change l'empreinte.
  writeFileSync(join(dossier, 'veilleur.js'), 'export const x = 2;\n');
  assert.notEqual(empreinteDuCode(dossier).empreinte, avant.empreinte, 'un vrai changement doit se voir');
});

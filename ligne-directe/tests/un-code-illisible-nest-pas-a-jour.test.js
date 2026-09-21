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

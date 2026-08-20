// metier-rendu.test.js — le rendu ABC → L0/L1/L2 (P-20260820-0001 phase 2, STD-047).
//
// Ce que ces tests gardent, et qui a coûté cher : un métier sans plafond devient
// une taxe permanente (33 000 tokens mesurés), et un garde-fou qui n'atterrit
// qu'en persona est une garantie fausse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compterTokens, rendre, BUDGETS } from '../src/metier/rendu.js';

/** Classement minimal valide — chaque garde-fou porte une couche qui garantit. */
function classementValide() {
  return {
    role: 'orchestrateur',
    version_abc: '2.0.0',
    items: [
      { id: 'GF-ORC-001', nature: 'garde-fou', couche: 'refus-de-permission', enonce: 'N exécute jamais.', enonce_socle: 'Tu ne construis jamais.' },
      { id: 'GF-ORC-014', nature: 'garde-fou', couche: 'hook', enonce: 'Ta ligne est obligatoire.', enonce_socle: 'Ta ligne est obligatoire.' },
      { id: 'RA-ORC-001', nature: 'regle', couche: 'persona', enonce: 'Des faits, jamais le raisonnement.', chapitre: 'rendre-compte' },
    ],
    chapitres: [
      { nom: 'rendre-compte', abrege: 'Comment il parle au CTO.', version_pack: '1.81.0' },
    ],
  };
}

test('compterTokens surestime plutôt que de sous-estimer — une garde qui sous-compte ne garde rien', () => {
  // 350 caractères → 100 tokens au ratio déclaré de 3,5 car/token.
  assert.equal(compterTokens('a'.repeat(350)), 100);
  // le vrai coût d'un texte français dense est d'environ 4,2 car/token :
  // le compte rendu doit donc être PLUS GRAND que le compte réel, jamais plus petit.
  const reel = Math.ceil(350 / 4.2);
  assert.ok(compterTokens('a'.repeat(350)) > reel,
    'le comptage doit majorer le coût réel, sinon la garde laisse passer un dépassement');
});

test('compterTokens ne rend jamais 0 sur un texte non vide', () => {
  assert.equal(compterTokens(''), 0);
  assert.ok(compterTokens('x') >= 1);
});

test('un rendu valide produit L0, L1 et un fichier par chapitre', () => {
  const r = rendre(classementValide());
  assert.equal(r.ok, true, r.erreurs && r.erreurs.join(' · '));
  assert.ok(r.artefacts['L0.md']);
  assert.ok(r.artefacts['L1.md']);
  assert.ok(r.artefacts['chapitres/rendre-compte.md']);
});

test('R1 — un garde-fou qui n atterrit qu en persona FAIT ÉCHOUER le rendu', () => {
  const c = classementValide();
  c.items[0].couche = 'persona';
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('GF-ORC-001') && e.includes('persona')),
    `l'erreur doit nommer l'item et sa couche — reçu : ${JSON.stringify(r.erreurs)}`);
});

test('R2 — une compétence n est pas une couche de garantie, elle échoue comme la persona', () => {
  const c = classementValide();
  c.items[1].couche = 'competence';
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('GF-ORC-014')));
});

test('une couche inconnue est refusée — on ne classe pas dans une couche inventée', () => {
  const c = classementValide();
  // ⚠️ sur une RÈGLE, jamais sur un garde-fou : R1 attraperait la couche inconnue
  // à la place de cette garde, et le test resterait vert en l'éprouvant PAS.
  // Mesuré par mutation le 2026-08-20 : c'était le cas, et c'était sa seule survivante.
  c.items[2].couche = 'bonne-volonte';
  const r = rendre(c);
  assert.equal(r.ok, false);
  const e = r.erreurs.find((x) => x.includes('bonne-volonte'));
  assert.ok(e, `l erreur doit nommer la couche inventée — reçu : ${JSON.stringify(r.erreurs)}`);
  assert.ok(e.includes('couche inconnue'), `c est la garde de couche qui doit refuser, pas R1 — reçu : ${e}`);
});

test('I2 — un L1 qui dépasse son budget fait échouer le rendu, en nommant de combien', () => {
  const c = classementValide();
  // une règle démesurée : elle part en L1 parce qu'elle n'a pas de chapitre
  c.items.push({ id: 'RA-ORC-999', nature: 'regle', couche: 'persona', enonce: 'court', enonce_socle: 'x'.repeat(BUDGETS.L1 * 4) });
  const r = rendre(c);
  assert.equal(r.ok, false);
  const e = r.erreurs.find((x) => x.includes('L1'));
  assert.ok(e, `une erreur doit nommer L1 — reçu : ${JSON.stringify(r.erreurs)}`);
  assert.match(e, /\d+ *(tokens|jetons)/, 'l erreur doit dire de combien ça dépasse');
});

test('I2 — le budget de L0 mord aussi', () => {
  const c = classementValide();
  c.identite = 'y'.repeat(BUDGETS.L0 * 10);
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((x) => x.includes('L0')));
});

test('I4 — un chapitre sans abrégé ou sans version d origine est refusé', () => {
  const sansAbrege = classementValide();
  sansAbrege.chapitres[0].abrege = '';
  assert.equal(rendre(sansAbrege).ok, false);

  const sansVersion = classementValide();
  delete sansVersion.chapitres[0].version_pack;
  assert.equal(rendre(sansVersion).ok, false);
});

test('I4 — le chapitre rendu PORTE son abrégé et sa version, pas seulement le classement', () => {
  const r = rendre(classementValide());
  const ch = r.artefacts['chapitres/rendre-compte.md'];
  assert.ok(ch.includes('Comment il parle au CTO.'), 'l abrégé doit être dans le fichier rendu');
  assert.ok(ch.includes('1.81.0'), 'la version d origine doit être dans le fichier rendu');
});

test('une règle qui désigne un chapitre inexistant est refusée — pas de renvoi dans le vide', () => {
  const c = classementValide();
  c.items[2].chapitre = 'chapitre-fantome';
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('chapitre-fantome')));
});

test('I7 — chaque règle rendue cite l item d ABC dont elle dérive', () => {
  const r = rendre(classementValide());
  assert.ok(r.artefacts['chapitres/rendre-compte.md'].includes('RA-ORC-001'));
  assert.ok(r.artefacts['L1.md'].includes('GF-ORC-001'));
});

test('I5 — le rendu ne produit AUCUN chemin qui viserait le lieu d un agent', () => {
  const r = rendre(classementValide());
  for (const chemin of Object.keys(r.artefacts)) {
    assert.ok(!chemin.includes('.orchestrateur'), `chemin interdit : ${chemin}`);
    assert.ok(!chemin.includes('.gestionnaire'), `chemin interdit : ${chemin}`);
    assert.ok(!chemin.startsWith('/'), `chemin absolu interdit : ${chemin}`);
    assert.ok(!chemin.includes('..'), `remontée de chemin interdite : ${chemin}`);
  }
});

test('I6 — le rendu ne produit jamais de CONTEXTE.md', () => {
  const r = rendre(classementValide());
  assert.ok(!Object.keys(r.artefacts).some((c) => c.includes('CONTEXTE.md')));
});

test('un classement sans aucun garde-fou est refusé — un rôle sans garde-fou est un rôle mal décrit', () => {
  const c = classementValide();
  c.items = c.items.filter((i) => i.nature !== 'garde-fou');
  assert.equal(rendre(c).ok, false);
});

test('une dérogation à R1 exige un motif ET un nom qui l assume — sinon le refus tient', () => {
  const c = classementValide();
  c.items[0].couche = 'persona';

  c.items[0].sans_garantie = { motif: 'porte sur le contenu d un énoncé' };   // sans nom
  assert.equal(rendre(c).ok, false, 'un motif seul ne suffit pas à déroger');

  c.items[0].sans_garantie = { assume_par: 'le dirigeant' };                   // sans motif
  assert.equal(rendre(c).ok, false, 'un nom seul ne suffit pas à déroger');

  c.items[0].sans_garantie = { motif: 'porte sur le contenu d un énoncé', assume_par: 'le dirigeant' };
  assert.equal(rendre(c).ok, true, 'motif + nom : la dérogation est recevable');
});

test('un item dérogé est EXPOSÉ dans le socle rendu — une dérogation ne se cache pas', () => {
  const c = classementValide();
  c.items[0].couche = 'persona';
  c.items[0].sans_garantie = { motif: 'aucune couche ne juge un énoncé', assume_par: 'le dirigeant' };
  const r = rendre(c);
  assert.equal(r.ok, true);
  assert.deepEqual(r.deroges, ['GF-ORC-001']);
  const l1 = r.artefacts['L1.md'];
  assert.ok(l1.includes('GF-ORC-001'), 'l item dérogé doit apparaître dans le socle');
  assert.ok(l1.includes('aucune couche ne juge un énoncé'), 'son motif doit être lisible dans le socle');
  assert.ok(l1.includes('le dirigeant'), 'qui l assume doit être lisible dans le socle');
});

test('ce qui monte au socle EXIGE un énoncé court — sinon le socle recopie l ABC et le budget saute', () => {
  const c = classementValide();
  assert.equal(rendre(c).ok, true);

  delete c.items[0].enonce_socle;   // un garde-fou sans énoncé court
  const r = rendre(c);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => e.includes('GF-ORC-001') && e.includes('enonce_socle')));
});

test('une règle rattachée à un chapitre n a PAS besoin d énoncé court — elle ne monte pas au socle', () => {
  const c = classementValide();
  // items[2] est une règle rattachée à un chapitre, et elle n'a pas d'enonce_socle
  assert.ok(!c.items[2].enonce_socle);
  assert.equal(rendre(c).ok, true);
});

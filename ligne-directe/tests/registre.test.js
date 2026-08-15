import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  chargerRegistre,
  sauverRegistre,
  cleDeLigne,
  inscrireLigne,
  clore,
  ligneParCanal,
  ligneOuverteParCle,
  lignesOuvertes,
  nomsPris,
} from '../src/registre.js';

function bac() {
  return mkdtempSync(join(tmpdir(), 'registre-'));
}

function ligne(sur = {}) {
  return {
    chantier: 'D-20260805-0004',
    canal_id: 'C1',
    canal_nom: 'd-20260805-0004',
    pane: 'w1:p1',
    worktree: '/w/a',
    visage: '🧭',
    ouverte_le: '2026-08-05T00:00:00.000Z',
    close_le: null,
    ...sur,
  };
}

test('un registre absent donne un registre vide, pas une erreur', () => {
  const d = bac();
  try {
    assert.deepEqual(chargerRegistre(join(d, 'rien.json')).lignes, []);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('un registre corrompu ne doit pas empêcher le veilleur de vivre', () => {
  const d = bac();
  const chemin = join(d, 'registre.json');
  try {
    writeFileSync(chemin, '{ ceci n est pas du JSON');
    assert.deepEqual(chargerRegistre(chemin).lignes, []);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('le registre est écrit en 0600 — il nomme les chantiers en cours', () => {
  const d = bac();
  const chemin = join(d, 'sous', 'registre.json');
  try {
    sauverRegistre({ version: 1, lignes: [ligne()] }, chemin);
    assert.equal(statSync(chemin).mode & 0o777, 0o600);
    assert.equal(chargerRegistre(chemin).lignes.length, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('la clé d’une ligne est insensible à la casse du chantier', () => {
  // Le code Somtech s'écrit en majuscules, herdr impose les minuscules aux noms d'agents :
  // une comparaison sensible à la casse ne retrouve jamais sa ligne.
  assert.equal(cleDeLigne('D-20260805-0004', '/w/a'), cleDeLigne('d-20260805-0004', '/w/a'));
});

test('DEUX WORKTREES DU MÊME CHANTIER sont deux lignes distinctes', () => {
  const r = { version: 1, lignes: [] };
  inscrireLigne(r, ligne({ canal_id: 'C1', worktree: '/w/a', pane: 'w1:p1' }));
  inscrireLigne(r, ligne({ canal_id: 'C2', canal_nom: 'd-20260805-0004-2', worktree: '/w/b', pane: 'w2:p2' }));
  assert.equal(ligneOuverteParCle(r, 'D-20260805-0004', '/w/a').pane, 'w1:p1');
  assert.equal(ligneOuverteParCle(r, 'D-20260805-0004', '/w/b').pane, 'w2:p2');
  assert.equal(lignesOuvertes(r).length, 2);
});

test('une ligne close reste inscrite — c’est ce qui permet de répondre au lieu d’avaler', () => {
  const r = { version: 1, lignes: [ligne()] };
  assert.ok(clore(r, 'C1', '2026-08-06T00:00:00.000Z'));
  assert.equal(lignesOuvertes(r).length, 0);
  // Elle doit rester retrouvable par son canal, sinon un message arrivé après la clôture
  // ne correspondrait à rien et serait silencieusement ignoré.
  const trouvee = ligneParCanal(r, 'C1');
  assert.ok(trouvee);
  assert.equal(trouvee.close_le, '2026-08-06T00:00:00.000Z');
});

test('clore deux fois ne réécrit pas la date de clôture', () => {
  const r = { version: 1, lignes: [ligne()] };
  clore(r, 'C1', 'A');
  assert.equal(clore(r, 'C1', 'B'), null);
  assert.equal(ligneParCanal(r, 'C1').close_le, 'A');
});

test('UNE LIGNE CLOSE DURABLE GARDE SON NOM — son canal, lui, existe toujours', () => {
  // ⚠️ RELEVÉ EN REVUE DE FOND (T-20260814-0085). Tant qu'une ligne interne s'archivait à la
  // fermeture, libérer son nom était sans risque : une collision retombait sur `CanalArchive`,
  // un refus visible. Depuis qu'une ligne est DURABLE par défaut, son canal survit — et un
  // AUTRE chantier qui produirait le même nom normalisé ne verrait aucune collision, tomberait
  // sur `name_taken`, et **reprendrait silencieusement** le canal de l'ancien : son historique
  // et ses membres, rattachés à un chantier sans rapport.
  const r = { version: 1, lignes: [ligne({ close_le: 'hier' })] };
  assert.equal(nomsPris(r).has('d-20260805-0004'), true, 'le nom reste pris : le canal est encore là');
});

test('SAUF POUR ELLE-MÊME — rouvrir son propre chantier doit retrouver son canal, pas un « -2 »', () => {
  // C'est le cycle nominal que le correctif de T-20260814-0085 rend possible : refermer, puis
  // rouvrir sous le même titre. Si son propre nom lui était compté comme pris, elle repartirait
  // sur un canal suffixé et perdrait le lien avec le chantier tel qu'il était nommé.
  const r = { version: 1, lignes: [ligne({ close_le: 'hier' })] };
  const sienne = cleDeLigne('D-20260805-0004', '/w/a');
  assert.equal(nomsPris(r, { saufCle: sienne }).has('d-20260805-0004'), false);
});

test('une ligne close JETABLE libère son nom — son canal est archivé, Slack refusera de lui-même', () => {
  const r = { version: 1, lignes: [ligne({ close_le: 'hier', jetable: true })] };
  assert.equal(nomsPris(r).has('d-20260805-0004'), false);
});

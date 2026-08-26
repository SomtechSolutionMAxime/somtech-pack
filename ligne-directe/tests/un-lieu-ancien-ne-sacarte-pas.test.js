// un-lieu-ancien-ne-sacarte-pas.test.js — ce qui manque à un lieu VIVANT parce que le gabarit
// a grandi depuis sa pose ne se répare PAS en écartant le lieu.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CES ESSAIS FERMENT, ET IL A ÉTÉ INTRODUIT PAR SON PROPRE LOT
//
// `RONDE.md` a rejoint le gabarit (T-20260826-0042). La liste de ce qu'un lieu doit porter se
// DÉRIVE du répertoire de gabarits : dès le lendemain, les DIX-HUIT lieux vivants du parc ont
// donc un fichier « manquant » — un fichier qu'aucun d'eux n'a jamais pu avoir.
//
// ⚠️ ET LE MESSAGE DE REFUS ENVOYAIT LES ÉCARTER. Mesuré le 2026-08-26 sur un lieu d'essai
// posé à l'ancienne : `lieu_partiel`, `manquants: ["RONDE.md"]`, et le geste proposé
// « mv <lieu> <lieu>.ecarte ». Sur un lieu vivant, ce geste emporte le `CONTEXTE.md` qu'un
// humain a rempli à la main — c'est-à-dire la seule chose du lieu que personne ne peut
// reconstituer. Le message était juste sur ce qu'il avait mesuré, et il envoyait détruire.
//
// La distinction qui tranche, et elle est mesurable sans rien deviner :
//
//   • les QUATRE OBLIGATOIRES manquent → le lieu n'a jamais été posé en entier, ou une pose a
//     été interrompue. Écarter est le bon geste : il n'y a rien à sauver ;
//   • les quatre sont là, et il manque autre chose → le gabarit a grandi. Le lieu est vivant,
//     son contexte est rempli, et le geste est de le METTRE À JOUR — jamais de l'écarter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparerLieuOrchestrateur } from '../src/orchestrateur.js';
import { GABARITS } from '../src/lieu-agent.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GABARIT_SOURCE = join(RACINE, '.claude', 'templates', 'orchestrateur');
const LIGNE_OK = async () => ({ joignable: true });

/**
 * Un dépôt qui porte le gabarit COURANT et un lieu posé par une version ANCIENNE — celle qui
 * ne connaissait pas encore `omis`.
 */
function depotAvecLieuAncien(omis) {
  const depot = mkdtempSync(join(tmpdir(), 'lieu-ancien-'));
  cpSync(GABARIT_SOURCE, join(depot, '.claude', 'templates', 'orchestrateur'), { recursive: true });
  const lieu = join(depot, '.orchestrateur', 'ancien');
  mkdirSync(lieu, { recursive: true });
  cpSync(join(depot, '.claude', 'templates', 'orchestrateur'), lieu, {
    recursive: true,
    filter: (src) => !src.endsWith(`/${omis}`),
  });
  // Le lieu est VIVANT : son contexte a été rempli à la main, et c'est ce que le geste proposé
  // emporterait.
  writeFileSync(join(lieu, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n\nRempli à la main.\n');
  return { depot, lieu, defaire: () => rmSync(depot, { recursive: true, force: true }) };
}

test('un lieu à qui il ne manque QUE ce que le gabarit a gagné depuis n’est jamais envoyé à l’écart', async () => {
  const b = depotAvecLieuAncien('RONDE.md');
  try {
    const r = await preparerLieuOrchestrateur({
      depot: b.depot, nom: 'ancien', verifierLigne: LIGNE_OK, verifierVersionnable: () => ({ versionnable: true, exclus: [] }),
    });
    assert.equal(r.ok, false, 'un lieu incomplet reste refusé — la garantie ne bouge pas');
    assert.equal(r.refus.motif, 'lieu_partiel');
    assert.ok(
      !/\.ecarte|mv /.test(r.refus.message),
      `le message ne doit PAS envoyer écarter un lieu vivant — dit : ${r.refus.message}`,
    );
    assert.match(r.refus.message, /à jour|mets? le lieu/i, 'il nomme le geste qui répare sans rien détruire');
    assert.match(r.refus.message, /RONDE\.md/, 'et ce qui manque');
    // ⚠️ PROUVÉ PAR L'EFFET, pas par le texte : le contexte rempli est toujours là.
    assert.ok(existsSync(join(b.lieu, 'CONTEXTE.md')));
  } finally { b.defaire(); }
});

// ⚠️ LA MOITIÉ QUI PROTÈGE. Un lieu à qui manque un OBLIGATOIRE n'a jamais été posé en entier :
// écarter reste le bon geste, et le retirer de ce message rouvrirait le défaut d'origine — un
// répertoire vide, résidu d'une pose interrompue, relu comme un lieu posé.
test('un lieu privé d’un OBLIGATOIRE s’écarte toujours — c’est une pose interrompue, pas un gabarit qui a grandi', async () => {
  const b = depotAvecLieuAncien('CONTEXTE.md');
  try {
    rmSync(join(b.lieu, 'CONTEXTE.md'), { force: true });
    const r = await preparerLieuOrchestrateur({
      depot: b.depot, nom: 'ancien', verifierLigne: LIGNE_OK, verifierVersionnable: () => ({ versionnable: true, exclus: [] }),
    });
    assert.equal(r.ok, false);
    assert.equal(r.refus.motif, 'lieu_partiel');
    assert.match(r.refus.message, /\.ecarte/, 'ici, écarter EST le geste juste');
  } finally { b.defaire(); }
});

test('les quatre obligatoires restent la frontière, et elle n’est pas écrite deux fois', () => {
  assert.deepEqual(GABARITS, ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json', join('.claude', 'settings.json')]);
});

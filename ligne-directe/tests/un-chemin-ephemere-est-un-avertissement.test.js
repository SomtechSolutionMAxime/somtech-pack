// UN CHEMIN ÉPHÉMÈRE EST UN AVERTISSEMENT, PAS UNE ADRESSE (T-20260818-0035).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI A ÉTÉ MESURÉ
//
// Un veilleur tournait depuis `/private/var/folders/…/T/tmp.XXXX/ligne-directe/src` — le
// dossier temporaire d'un `npx` ou d'un banc, jamais une installation. Un tel veilleur est
// voué à disparaître avec son dossier, et rien ne le disait avant ce lot : `etat` répondait
// comme n'importe quel autre veilleur, en vie, sans nommer le sol sur lequel il tient.
//
// Ce banc teste la fonction PURE, sans faire naître de veilleur : elle n'a besoin ni de
// Slack, ni d'un socket, ni d'un registre.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { identiteDuCode } from '../src/identite-du-code.js';

test('un chemin sous os.tmpdir() est déclaré ÉPHÉMÈRE', () => {
  const chemin = join(tmpdir(), 'ligne-directe-essai', 'src');
  const id = identiteDuCode({ dossierSrc: chemin });
  assert.equal(id.ephemere, true, `un chemin sous ${tmpdir()} doit être marqué éphémère`);
});

test('le motif littéral « /T/tmp. » — celui mesuré sur le poste réel — est déclaré ÉPHÉMÈRE', () => {
  // Le chemin RÉEL mesuré par batiscan (macOS résout /var vers /private/var par un lien) ne
  // commence pas forcément par `os.tmpdir()` tel que ce processus le rendrait : le motif
  // littéral est la seconde attrape, indépendante du premier calcul.
  const chemin = '/private/var/folders/zz/abc123/T/tmp.XyZ9/ligne-directe/src';
  const id = identiteDuCode({ dossierSrc: chemin });
  assert.equal(id.ephemere, true, 'le motif « /T/tmp. » mesuré sur le poste doit être reconnu même hors de os.tmpdir()');
});

test('un chemin sous un HOME de poste (« .somtech/ligne-directe/src ») N’EST PAS éphémère', () => {
  const chemin = '/Users/quelquun/.somtech/ligne-directe/src';
  const id = identiteDuCode({ dossierSrc: chemin });
  assert.equal(id.ephemere, false, `une installation réelle ne doit pas être accusée d’être éphémère — reçu ${JSON.stringify(id.ephemere)}`);
});

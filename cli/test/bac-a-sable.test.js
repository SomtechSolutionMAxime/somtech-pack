// bac-a-sable.test.js — LA GARDE QUI FERME L'INCIDENT .zshenv (T-20260818-0035).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER ÉPROUVE
//
// `empreinteDuHome`/`assertHomeIntact` avec `obtenirHome` INJECTÉ — jamais le vrai
// `os.userInfo().homedir()`. C'est la SEULE façon d'éprouver « la garde crie quand le home
// bouge » sans jamais risquer de faire bouger le VRAI home de la machine qui exécute ces
// tests. Le dossier jetable joue ici le rôle du home : ce que ce fichier écrit dedans, il
// l'écrirait dans `/Users/…` en production si `obtenirHome` n'était pas substitué — c'est
// tout le sens de l'injection.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { empreinteDuHome, assertHomeIntact, HorsBacASable } from './lib/bac-a-sable.js';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

test('« absent » reste « absent » — un poste sans .zshrc/.zshenv ne fait pas rougir la garde', () => {
  const home = tmp('smtk-bac-vide-');
  const avant = empreinteDuHome({ obtenirHome: () => home });
  assert.equal(avant.zshenv, 'absent');
  assert.equal(avant.zshrc, 'absent');
  assert.equal(avant.somtechBin, 'absent');
  assert.doesNotThrow(() => assertHomeIntact(avant), 'rien n’a bougé : la garde doit rester muette');
});

test('RIEN NE CHANGE → assertHomeIntact reste SILENCIEUSE', () => {
  const home = tmp('smtk-bac-stable-');
  writeFileSync(join(home, '.zshenv'), 'export FOO=bar\n');
  mkdirSync(join(home, '.somtech', 'bin'), { recursive: true });
  writeFileSync(join(home, '.somtech', 'bin', 'ligne-directe'), '#!/bin/sh\n');

  const avant = empreinteDuHome({ obtenirHome: () => home });
  assert.doesNotThrow(() => assertHomeIntact(avant));
});

test('LA GARDE CRIE — un .zshenv modifié après la mesure fait ROUGIR, avec le fichier NOMMÉ', () => {
  const home = tmp('smtk-bac-zshenv-');
  writeFileSync(join(home, '.zshenv'), 'contenu original\n');

  const avant = empreinteDuHome({ obtenirHome: () => home });

  // ⚠️ C'EST EXACTEMENT CE QU'UN TEST NON SANDBOXÉ FERAIT AU VRAI `~/.zshenv` — reproduit ici
  // sur un dossier JETABLE, jamais sur le vrai home de ce poste.
  writeFileSync(join(home, '.zshenv'), 'export PATH="/var/folders/.../tmp.XXXX/somtech/bin:$PATH"\n');

  assert.throws(
    () => assertHomeIntact(avant),
    (err) => {
      assert.ok(err instanceof HorsBacASable, 'doit lever HorsBacASable, pas une erreur générique');
      assert.match(err.message, /ce test a écrit hors de son bac à sable/, `message inattendu : ${err.message}`);
      assert.match(err.message, /\.zshenv/, `le fichier touché doit être NOMMÉ — reçu : ${err.message}`);
      return true;
    }
  );
});

test('LA GARDE CRIE AUSSI SUR .zshrc', () => {
  const home = tmp('smtk-bac-zshrc-');
  writeFileSync(join(home, '.zshrc'), '# rc original\n');
  const avant = empreinteDuHome({ obtenirHome: () => home });
  writeFileSync(join(home, '.zshrc'), '# rc modifié\n');
  assert.throws(() => assertHomeIntact(avant), /\.zshrc/);
});

test('LA GARDE CRIE SUR UN NOUVEAU FICHIER POSÉ DANS .somtech/bin — pas seulement une modif', () => {
  const home = tmp('smtk-bac-bin-');
  mkdirSync(join(home, '.somtech', 'bin'), { recursive: true });
  const avant = empreinteDuHome({ obtenirHome: () => home });
  writeFileSync(join(home, '.somtech', 'bin', 'ligne-directe'), '#!/bin/sh\n');
  assert.throws(() => assertHomeIntact(avant), /\.somtech.*bin/);
});

test('UNE MTIME CHANGÉE SANS CHANGER LE CONTENU FAIT AUSSI ROUGIR — une réécriture identique reste une réécriture', () => {
  const home = tmp('smtk-bac-mtime-');
  writeFileSync(join(home, '.zshenv'), 'export FOO=bar\n');
  const avant = empreinteDuHome({ obtenirHome: () => home });
  // Même contenu, mtime avancée d'une minute : un `writeFileSync` identique en production
  // laisserait ce signal-là, et une garde qui ne regarderait QUE le contenu le manquerait.
  const dansUneMinute = new Date(Date.now() + 60_000);
  utimesSync(join(home, '.zshenv'), dansUneMinute, dansUneMinute);
  assert.throws(() => assertHomeIntact(avant), /\.zshenv/);
});

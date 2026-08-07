#!/usr/bin/env node
// naitre.js — la commande qui fait naître une session dans le lieu d'un client.
//
//   gestionnaire-naitre <client> --workspace <espace herdr>
//
// Elle ne pose jamais le lieu (compétence /gestionnaire-client, E-20260807-0002) : elle le
// vérifie, y repose le garde d'ouverture (à chaque appel — idempotent), puis fait naître le
// pane, EXACTEMENT à cet endroit. AUCUN shell : chaque commande herdr part par `execFile`
// avec un tableau d'arguments, comme ligne-directe/src/herdr.js et pour la même raison.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { poserGarde, commandesNaissance, LieuAbsent } from '../src/naissance.js';

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function usage(code) {
  process.stderr.write('gestionnaire-naitre <client> --workspace <espace herdr>\n');
  process.exit(code);
}

function option(args, nom) {
  const i = args.indexOf(nom);
  return i === -1 ? null : args[i + 1] ?? null;
}

async function herdr(args) {
  const { stdout } = await execFileAsync('herdr', args, { maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function main() {
  const args = process.argv.slice(2);
  const client = args[0];
  const workspace = option(args, '--workspace');
  if (!client || client.startsWith('--') || !workspace) usage(1);

  let cheminGarde;
  try {
    cheminGarde = poserGarde(REPO_ROOT, client);
  } catch (err) {
    if (err instanceof LieuAbsent) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const commandes = commandesNaissance(REPO_ROOT, client, { workspace });

  const creation = await herdr(commandes.tabCreate);
  if (creation.error) {
    process.stderr.write(`herdr tab create a refusé : ${creation.error.message || creation.error.code}\n`);
    process.exit(1);
  }
  const paneId = creation.result?.root_pane?.pane_id;
  if (!paneId) {
    process.stderr.write(`herdr tab create n’a rendu aucun pane_id : ${JSON.stringify(creation)}\n`);
    process.exit(1);
  }

  await herdr(commandes.renommer(paneId));
  const lancement = await herdr(commandes.paneRun(paneId));
  if (lancement.error) {
    process.stderr.write(`herdr pane run a refusé : ${lancement.error.message || lancement.error.code}\n`);
    process.exit(1);
  }

  process.stdout.write(`${JSON.stringify({ ok: true, client, pane: paneId, garde: cheminGarde })}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});

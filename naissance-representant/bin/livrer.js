#!/usr/bin/env node
// livrer.js — livrer un brief à une session déjà née, et PROUVER qu'elle l'a pris.
//
//   gestionnaire-livrer <pane> --brief <fichier>
//   gestionnaire-livrer <pane> --texte "…"
//
// Le brief se passe par FICHIER de préférence : un retour à la ligne tapé dans un terminal
// soumet le message et le coupe en deux (/orchestrer-chantier §4a). Le fichier est lu ici et
// livré d'un seul tenant.
//
// POURQUOI CETTE COMMANDE EXISTE (T-20260809-0033)
// `herdr agent prompt` rend un succès que le brief soit pris ou non — et, mesuré contre le
// vrai service, écrire dans une boîte qui contient déjà quelque chose livre UN message : les
// deux textes collés. Le détail de ce qui a été mesuré est en tête de `src/livraison.js`.
//
// Cette commande ne corrige pas herdr (règle d'or n°7 : ce dépôt n'est pas le sien). Elle
// refuse de livrer dans une boîte qu'elle n'a pas trouvée vide, elle relit pour savoir si le
// brief a été pris, elle répare une fois le cas connu, et elle échoue bruyamment sinon.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { lireReponseHerdr } from '../src/naissance.js';
import { livrerBrief } from '../src/livraison.js';

const execFileAsync = promisify(execFile);

const ESSAIS = Number(process.env.LIVRAISON_ESSAIS || 15);
const DELAI_MS = Number(process.env.LIVRAISON_DELAI_MS || 2000);
const ATTENTE_MS = Number(process.env.LIVRAISON_ATTENTE_MS || 20000);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function usage(code) {
  process.stderr.write('gestionnaire-livrer <pane> (--brief <fichier> | --texte "…")\n');
  process.exit(code);
}

function option(args, nom) {
  const i = args.indexOf(nom);
  return i === -1 ? null : args[i + 1] ?? null;
}

/** Un appel herdr qui rend du JSON — le verdict passe par le lecteur commun de la naissance. */
async function appelHerdr(commande, { resultatAttendu = true } = {}) {
  try {
    const { stdout } = await execFileAsync('herdr', commande, { maxBuffer: 16 * 1024 * 1024 });
    return lireReponseHerdr(stdout, { commande, resultatAttendu });
  } catch (err) {
    return lireReponseHerdr(err?.stdout ?? '', { commande, erreurProcessus: err, resultatAttendu });
  }
}

/**
 * `herdr agent read` rend du TEXTE BRUT, pas du JSON — il ne passe donc pas par
 * `lireReponseHerdr` (mesuré : la sortie n'est pas parsable). Un échec de lecture rend `null`,
 * que `contenuBoite` traduira en « boîte illisible » — jamais en « boîte vide ».
 */
async function lireEcran(commande) {
  try {
    const { stdout } = await execFileAsync('herdr', commande, { maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    return typeof err?.stdout === 'string' && err.stdout ? err.stdout : null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const pane = args[0];
  const fichier = option(args, '--brief');
  const direct = option(args, '--texte');
  if (!pane || pane.startsWith('--') || (!fichier && !direct)) usage(1);

  let texte;
  try {
    texte = fichier ? readFileSync(fichier, 'utf8') : direct;
  } catch (err) {
    process.stderr.write(`brief illisible (${fichier}) : ${err.message}\n`);
    process.exit(1);
  }
  texte = String(texte).trim();
  if (!texte) {
    process.stderr.write('un brief vide n’est pas un brief\n');
    process.exit(1);
  }

  const resultat = await livrerBrief({
    pane,
    texte,
    appelHerdr,
    lireEcran,
    dormir,
    essais: ESSAIS,
    delaiMs: DELAI_MS,
    attenteMs: ATTENTE_MS,
  });

  if (!resultat.ok) {
    process.stderr.write(`${resultat.message}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      pane,
      caracteres: texte.length,
      statut: resultat.statut,
      repare: resultat.repare,
      attendu: resultat.attendu,
    })}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});

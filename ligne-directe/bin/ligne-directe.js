#!/usr/bin/env node
// ligne-directe — la commande que tape un agent.
//
//   ligne-directe ouvrir <chantier> [--sujet "..."] [--inviter courriel]
//   ligne-directe dire "..."
//   ligne-directe demander "..."
//   ligne-directe fermer [--bilan "..."] [--sans-archiver]
//   ligne-directe etat
//   ligne-directe veilleur          (démarre le veilleur au premier plan, pour l'observer)
//
// Le chantier n'est demandé qu'à l'ouverture : ensuite, la commande retrouve la ligne
// par le pane depuis lequel elle est invoquée. Un agent n'a donc rien à retenir.

import { parler } from '../src/client.js';
import * as herdr from '../src/herdr.js';
import { trouverMembre } from '../src/slack.js';
import { lireJeton, SERVICE_ROBOT } from '../src/trousseau.js';

function usage(code = 0) {
  process.stdout.write(`ligne-directe — ouvrir une ligne de discussion avec le dirigeant

  ouvrir <chantier> [--sujet "..."] [--inviter courriel]   ouvre le canal du chantier
  dire "texte"                                             rapporte un jalon
  demander "texte"                                         sollicite un arbitrage
  fermer [--bilan "texte"] [--sans-archiver]               referme la ligne
  etat                                                     ce qui est ouvert
  veilleur                                                 lance le veilleur au premier plan

Le chantier est déduit du pane courant, sauf à l'ouverture.
`);
  process.exit(code);
}

function option(args, nom) {
  const i = args.indexOf(nom);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}

function rendre(reponse) {
  if (reponse.ok) {
    process.stdout.write(`${JSON.stringify(reponse)}\n`);
    process.exit(0);
  }
  process.stderr.write(`${reponse.erreur || 'échec'}\n`);
  process.exit(1);
}

const [geste, ...args] = process.argv.slice(2);
if (!geste || geste === '--help' || geste === '-h') usage();

if (geste === 'veilleur') {
  await import('../src/demarrer-veilleur.js');
} else if (geste === 'ouvrir') {
  const chantier = args.find((a) => !a.startsWith('--'));
  if (!chantier) usage(1);
  const courriel = option(args, '--inviter');
  const invites = [];
  if (courriel) {
    const id = await trouverMembre(await lireJeton(SERVICE_ROBOT), courriel);
    if (id) invites.push(id);
    else process.stderr.write(`avertissement : aucun membre pour ${courriel} — le canal est créé sans lui\n`);
  }
  const ici = await herdr.paneCourant();
  rendre(
    await parler({
      geste: 'ouvrir',
      chantier,
      pane: ici.pane,
      worktree: ici.worktree,
      sujet: option(args, '--sujet'),
      invites,
    })
  );
} else if (geste === 'dire' || geste === 'demander') {
  const texte = args.find((a) => !a.startsWith('--'));
  if (!texte) usage(1);
  const ici = await herdr.paneCourant();
  const etat = await parler({ geste: 'etat' });
  const mienne = (etat.ouvertes || []).find((l) => l.pane === ici.pane);
  if (!mienne) {
    process.stderr.write("aucune ligne ouverte depuis ce pane — commence par : ligne-directe ouvrir <chantier>\n");
    process.exit(1);
  }
  const corps = geste === 'demander' ? `❓ *J'attends ton arbitrage*\n\n${texte}` : texte;
  rendre(await parler({ geste: 'dire', chantier: mienne.chantier, worktree: mienne.worktree, texte: corps }));
} else if (geste === 'fermer') {
  const ici = await herdr.paneCourant();
  const etat = await parler({ geste: 'etat' });
  const mienne = (etat.ouvertes || []).find((l) => l.pane === ici.pane);
  if (!mienne) {
    process.stderr.write('aucune ligne ouverte depuis ce pane\n');
    process.exit(1);
  }
  rendre(
    await parler({
      geste: 'fermer',
      chantier: mienne.chantier,
      worktree: mienne.worktree,
      bilan: option(args, '--bilan'),
      archiver: !args.includes('--sans-archiver'),
    })
  );
} else if (geste === 'etat') {
  const etat = await parler({ geste: 'etat' });
  process.stdout.write(`${JSON.stringify(etat, null, 2)}\n`);
} else {
  usage(1);
}

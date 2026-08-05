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
  service installer|retirer|etat                           le veilleur revient après un redémarrage
  veilleur                                                 lance le veilleur au premier plan

Le chantier est déduit du pane courant, sauf à l'ouverture.
`);
  process.exit(code);
}

/** Options qui consomment la valeur suivante — elle n'est donc jamais un argument libre. */
const OPTIONS_A_VALEUR = new Set(['--sujet', '--inviter', '--bilan']);

function option(args, nom) {
  const i = args.indexOf(nom);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}

/**
 * Le premier argument libre — en sautant les VALEURS d'options.
 *
 * Relevé en revue : un simple « premier mot qui ne commence pas par -- » prenait la valeur
 * d'une option pour le chantier. `ouvrir --inviter maxime@somtech.ca D-1` créait un canal
 * nommé d'après l'adresse courriel. Silencieux, et le canal reste.
 */
function premierLibre(args) {
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      if (OPTIONS_A_VALEUR.has(a)) i += 1; // sa valeur n'est pas un argument libre
      continue;
    }
    return a;
  }
  return null;
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

if (geste === 'service') {
  const { installerService, retirerService, etatService } = await import('../src/service.js');
  const quoi = args[0] || 'etat';
  if (quoi === 'installer') {
    const r = await installerService();
    if (!r.ok) {
      process.stderr.write(`installation refusée : ${r.erreur}\n`);
      process.exit(1);
    }
    process.stdout.write(`service installé (${r.chemin}) — le veilleur reviendra à chaque ouverture de session\n`);
  } else if (quoi === 'retirer') {
    const r = await retirerService();
    process.stdout.write(`service retiré (${r.chemin})\n`);
  } else {
    process.stdout.write(`${JSON.stringify(await etatService(), null, 2)}\n`);
  }
} else if (geste === 'veilleur') {
  await import('../src/demarrer-veilleur.js');
} else if (geste === 'ouvrir') {
  const chantier = premierLibre(args);
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
      herdr_socket: ici.herdr_socket,
      sujet: option(args, '--sujet'),
      invites,
    })
  );
} else if (geste === 'dire' || geste === 'demander') {
  const texte = premierLibre(args);
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

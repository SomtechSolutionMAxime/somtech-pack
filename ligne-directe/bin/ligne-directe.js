#!/usr/bin/env node
// ligne-directe — la commande que tape un agent.
//
//   ligne-directe ouvrir <chantier> [--sujet "..."] [--inviter courriel]
//   ligne-directe dire "..."
//   ligne-directe demander "..."
//   ligne-directe fermer [--bilan "..."] [--sans-archiver]
//   ligne-directe representant <client> --canal <canal> [--depot <chemin>]
//   ligne-directe orchestrateur <nom> [--depot <chemin>]
//   ligne-directe etat
//   ligne-directe veilleur          (démarre le veilleur au premier plan, pour l'observer)
//
// Le chantier n'est demandé qu'à l'ouverture : ensuite, la commande retrouve la ligne
// par le pane depuis lequel elle est invoquée. Un agent n'a donc rien à retenir.

import { parler, passerLaMain } from '../src/client.js';
import * as herdr from '../src/herdr.js';
import { trouverMembre } from '../src/slack.js';
import { lireJeton, SERVICE_ROBOT } from '../src/trousseau.js';
import { preparerLieuRepresentant, verifierCanalJoignable } from '../src/representant.js';
import { preparerLieuOrchestrateur } from '../src/orchestrateur.js';

function usage(code = 0) {
  process.stdout.write(`ligne-directe — ouvrir une ligne de discussion avec le dirigeant

  ouvrir <chantier> [--titre "..."] [--sujet "..."] [--inviter courriel] [--nature client]
                                                           ouvre le canal du chantier
                                                           (--titre nomme le canal ET signe chaque message ;
                                                            sans lui, en interne, c'est le code du chantier)
                                                           (--nature client : canal PRIVE, ou parlent les
                                                            gens du client qu'un humain y a invites.
                                                            --titre y est OBLIGATOIRE : le client ne doit
                                                            jamais voir un code de chantier.
                                                            Sans --nature, la ligne est interne : canal
                                                            public, autorisation par --inviter)
  dire "texte"                                             rapporte un jalon
  demander "texte"                                         sollicite un arbitrage
  fermer [--bilan "texte"] [--sans-archiver]               referme la ligne
  renommer --titre "..." [--canal <id>]                    renomme le canal (Slack + registre)
  representant <client> --canal <canal> [--depot <chemin>] prepare le lieu d'un representant
                                                           dans <chemin> (defaut : le repertoire
                                                           courant) — refuse tout net et NE CREE
                                                           RIEN si <canal> n'est pas joignable
  orchestrateur <nom> [--depot <chemin>]                   prepare le lieu d'un orchestrateur,
                                                           nomme, dans <chemin> — refuse tout net
                                                           et NE CREE RIEN si le poste ne peut pas
                                                           ouvrir de ligne (sa ligne est obligatoire)
  etat                                                     ce qui est ouvert
  service installer|retirer|etat                           le veilleur revient après un redémarrage
  relever                                                  fait passer la main a un veilleur neuf
                                                           (a lancer apres chaque mise a jour du pack)
  veilleur                                                 lance le veilleur au premier plan

Le chantier est déduit du pane courant, sauf à l'ouverture.
`);
  process.exit(code);
}

/** Options qui consomment la valeur suivante — elle n'est donc jamais un argument libre. */
const OPTIONS_A_VALEUR = new Set(['--sujet', '--inviter', '--bilan', '--titre', '--nature', '--canal', '--depot']);

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

// Tout le corps est enveloppé : une erreur attendue — jeton absent, veilleur qui refuse de
// céder — porte un message écrit pour être lu et suivi. Le déverser sous une trace de pile
// Node, c'est le rendre invisible : personne ne lit la troisième ligne d'une trace.
try {

if (geste === 'relever') {
  const r = await passerLaMain();
  process.stdout.write(`${JSON.stringify(r)}\n`);
} else if (geste === 'service') {
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
      titre: option(args, '--titre'),
      // Transmise TELLE QUELLE, jamais normalisée ici : c'est le veilleur qui refuse une
      // nature inconnue. Rabattre une faute de frappe sur le défaut côté commande créerait
      // un canal public pour un client sans que rien ne le dise.
      nature: option(args, '--nature'),
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
} else if (geste === 'renommer') {
  const titre = option(args, '--titre');
  if (!titre) usage(1);
  const canalId = option(args, '--canal');
  if (canalId) {
    rendre(await parler({ geste: 'renommer', canal_id: canalId, titre }));
  } else {
    const ici = await herdr.paneCourant();
    const etat = await parler({ geste: 'etat' });
    const mienne = (etat.ouvertes || []).find((l) => l.pane === ici.pane);
    if (!mienne) {
      process.stderr.write('aucune ligne ouverte depuis ce pane — precise --canal <id>\n');
      process.exit(1);
    }
    rendre(await parler({ geste: 'renommer', chantier: mienne.chantier, worktree: mienne.worktree, titre }));
  }
} else if (geste === 'representant') {
  const client = premierLibre(args);
  const canal = option(args, '--canal');
  if (!client || !canal) usage(1);
  const depotClient = option(args, '--depot') || process.cwd();
  const r = await preparerLieuRepresentant({
    depotClient,
    client,
    canal,
    verifierJoignabilite: async () => verifierCanalJoignable(await lireJeton(SERVICE_ROBOT), canal),
  });
  process.stdout.write(`${JSON.stringify(r)}\n`);
  // Le JSON est le contrat de qui appelle ; le motif écrit en clair est celui de qui LIT. Sans
  // cette ligne, un refus ne laissait sur stderr que ce que Node y avait déversé lui-même — un
  // « ENOENT ... copyfile ... » brut, illisible et faux (T-20260807-0067).
  if (!r.ok && r.refus?.message) process.stderr.write(`${r.refus.message}\n`);
  process.exit(r.ok ? 0 : 1);
} else if (geste === 'orchestrateur') {
  const nom = premierLibre(args);
  if (!nom) usage(1);
  const depot = option(args, '--depot') || process.cwd();
  const r = await preparerLieuOrchestrateur({ depot, nom });
  process.stdout.write(`${JSON.stringify(r)}\n`);
  // Même contrat que `representant` : le JSON pour qui appelle, le motif en clair pour qui LIT.
  // Un refus qui ne laisse sur stderr que ce que Node y a déversé est illisible et faux.
  if (!r.ok && r.refus?.message) process.stderr.write(`${r.refus.message}\n`);
  process.exit(r.ok ? 0 : 1);
} else if (geste === 'etat') {
  const etat = await parler({ geste: 'etat' });
  process.stdout.write(`${JSON.stringify(etat, null, 2)}\n`);
} else {
  usage(1);
}
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}

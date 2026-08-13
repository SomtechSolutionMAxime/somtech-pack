#!/usr/bin/env node
// rendez-vous.js — le réveil qui tient les deux rendez-vous du métier de l'orchestrateur.
//
//   orchestrateur-rendez-vous ronde|topo            tient le rendez-vous, maintenant
//   orchestrateur-rendez-vous service installer     pose les deux agents de session
//   orchestrateur-rendez-vous service retirer|etat
//
// Le POURQUOI du mécanisme (launchd plutôt qu'une boucle ou cron, et les lieux comme
// inventaire) est en tête de `src/rendez-vous.js`. Ici, l'I/O réelle et rien d'autre.
//
// CE QUE CE RÉVEIL NE FAIT PAS, ET C'EST L'ESSENTIEL
//
// Il ne rédige NI la ronde NI le topo. Il n'a rien à en dire : ce qu'il y a à rapporter,
// seul l'orchestrateur le sait. Un réveil qui composerait le topo à sa place produirait un
// rapport plausible et faux — le même défaut que le brief fusionné, un cran plus haut.
//
// Il livre un RAPPEL, court, et c'est le métier chargé à chaque échange qui dit quoi faire.
// C'est aussi ce qui le rend robuste au temps : le jour où le topo change de forme, ce
// fichier n'a pas à bouger.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lireReponseHerdr } from '../src/naissance.js';
import { livrerBrief } from '../src/livraison.js';
import { rendezVous, orchestrateursVivants, cheminPlist, construirePlist, RENDEZ_VOUS } from '../src/rendez-vous.js';
import { RACINE } from '../../ligne-directe/src/registre.js';
import { enEssais, refuser } from '../../ligne-directe/src/cloison.js';

const execFileAsync = promisify(execFile);
const ICI = dirname(fileURLToPath(import.meta.url));
const JOURNAL = join(RACINE, 'orchestrateur-rendez-vous.log');

// Une session occupée ne peut pas recevoir de rappel — et ce n'est pas un échec, c'est
// « pas maintenant ». On repasse, plutôt que de renoncer : « on ne saute pas son tour ».
//
// L'ÉCHÉANCE EST GLOBALE, PAS PAR ORCHESTRATEUR — relevé en revue de fond. Compter les
// essais par orchestrateur, séquentiellement, faisait dépendre la durée totale du NOMBRE
// d'orchestrateurs vivants : trois occupés × six essais de cinq minutes = une heure et demie,
// donc un réveil horaire encore en train de tourner quand le suivant démarre. Deux réveils
// qui se chevauchent écriraient dans la même boîte de saisie — précisément la fusion de
// briefs que ce dépôt a déjà payée une fois.
//
// La demi-heure couvre un tour de travail ordinaire et laisse le rendez-vous le plus serré
// (l'horaire) se terminer bien avant le suivant, quel que soit le nombre d'orchestrateurs.
const DELAI_MS = Number(process.env.RENDEZ_VOUS_DELAI_MS || 5 * 60 * 1000);
const ECHEANCE_MS = Number(process.env.RENDEZ_VOUS_ECHEANCE_MS || 30 * 60 * 1000);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function usage(code) {
  process.stderr.write(
    'orchestrateur-rendez-vous ronde|topo\n' +
      'orchestrateur-rendez-vous service installer|retirer|etat\n'
  );
  process.exit(code);
}

/** Un appel herdr, et son verdict — jamais une exception. Même lecteur qu'à la naissance. */
async function appelHerdr(commande, { resultatAttendu = true } = {}) {
  try {
    const { stdout } = await execFileAsync('herdr', commande, { maxBuffer: 16 * 1024 * 1024 });
    return lireReponseHerdr(stdout, { commande, resultatAttendu });
  } catch (err) {
    return lireReponseHerdr(err?.stdout ?? '', { commande, erreurProcessus: err, resultatAttendu });
  }
}

/** `herdr agent read` rend du TEXTE BRUT — un échec rend `null`, jamais « boîte vide ». */
async function lireEcran(commande) {
  try {
    const { stdout } = await execFileAsync('herdr', commande, { maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    return typeof err?.stdout === 'string' && err.stdout ? err.stdout : null;
  }
}

async function launchctl(args) {
  try {
    const { stdout, stderr } = await execFileAsync('launchctl', args);
    return { ok: true, sortie: `${stdout}${stderr}`.trim() };
  } catch (err) {
    return { ok: false, sortie: `${err.stdout || ''}${err.stderr || ''}`.trim() || err.message };
  }
}

/** Le PATH que le service verra — un service n'hérite d'aucun profil de shell. */
function cheminsUtiles() {
  const dirNode = dirname(process.execPath);
  const usuels = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  return [dirNode, ...usuels].filter((v, i, t) => t.indexOf(v) === i).join(':');
}

/**
 * Pose les deux agents de session.
 *
 * MÊME CLOISON QUE `ligne-directe/src/service.js`, et pour un motif plus direct encore : un
 * `launchd` ne reçoit que le `PATH` de son descripteur — il n'hérite PAS de la marque
 * d'essais. Un test qui atteindrait ce chemin poserait un réveil de PRODUCTION, qui irait
 * livrer des rappels à de VRAIS orchestrateurs, hors de toute cloison. C'est exactement par
 * cette porte que deux veilleurs orphelins sont nés.
 */
async function installerService() {
  if (enEssais()) {
    refuser(
      "l'installation des rendez-vous de l'orchestrateur",
      'Les LaunchAgents naîtraient HORS cloison — launchd ne transmet pas la marque d’essais — et ' +
        'iraient réveiller de vrais orchestrateurs.'
    );
  }
  const script = join(ICI, 'rendez-vous.js');
  const cible = `gui/${process.getuid()}`;
  const poses = [];
  mkdirSync(RACINE, { recursive: true });

  for (const nom of Object.keys(RENDEZ_VOUS)) {
    const chemin = cheminPlist(nom);
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, construirePlist(nom, { script, path: cheminsUtiles(), journal: JOURNAL }), { mode: 0o644 });
    // Réinstaller doit être sans douleur : on décharge d'abord, sans bruit si rien n'était là.
    await launchctl(['bootout', `${cible}/${rendezVous(nom).etiquette}`]);
    const chargement = await launchctl(['bootstrap', cible, chemin]);
    if (!chargement.ok) return { ok: false, chemin, erreur: chargement.sortie };
    await launchctl(['enable', `${cible}/${rendezVous(nom).etiquette}`]);
    poses.push({ nom, chemin });
  }
  return { ok: true, poses };
}

async function retirerService() {
  if (enEssais()) {
    refuser(
      "le retrait des rendez-vous de l'orchestrateur",
      'Son bootout porte sur les étiquettes du POSTE : il priverait les orchestrateurs vivants de ' +
        'leur ronde et de leur topo, sans laisser de trace qui l’explique.'
    );
  }
  const retires = [];
  for (const nom of Object.keys(RENDEZ_VOUS)) {
    const chemin = cheminPlist(nom);
    await launchctl(['bootout', `gui/${process.getuid()}/${rendezVous(nom).etiquette}`]);
    if (existsSync(chemin)) unlinkSync(chemin);
    retires.push({ nom, chemin });
  }
  return { ok: true, retires };
}

async function etatService() {
  const etats = {};
  for (const nom of Object.keys(RENDEZ_VOUS)) {
    const r = await launchctl(['print', `gui/${process.getuid()}/${rendezVous(nom).etiquette}`]);
    etats[nom] = r.ok
      ? { installe: true, charge: true, etat: /\bstate = (\w+)/.exec(r.sortie)?.[1] || null }
      : { installe: existsSync(cheminPlist(nom)), charge: false };
  }
  return etats;
}

/**
 * Tient le rendez-vous : rappelle à CHAQUE orchestrateur vivant que c'est l'heure.
 *
 * Le compte rendu dit ce qui a été CONSTATÉ pour chacun — livré, reporté (la session
 * travaillait, on a repassé), ou échoué. Un réveil qui se contenterait de sortir en `0` sans
 * dire à qui il a parlé serait invérifiable, et c'est la famille de défauts que ce module
 * hérite : « le mot, pas le fait ».
 */
async function tenir(nom) {
  const r = rendezVous(nom);
  const liste = await appelHerdr(['agent', 'list']);
  if (!liste.ok) {
    process.stderr.write(`${r.etiquette} : impossible de lire les agents — ${liste.message}\n`);
    process.exit(1);
  }

  const vivants = orchestrateursVivants(liste.reponse);
  const fin = Date.now() + ECHEANCE_MS;

  // Un tour pour tout le monde, puis on ne repasse que sur ceux qui n'ont pas pris — et
  // seulement tant que l'échéance GLOBALE le permet. Un orchestrateur occupé ne fait donc
  // plus attendre les autres, et le rendez-vous se termine avant le suivant quel que soit
  // leur nombre.
  const comptes = vivants.map((o) => ({ agent: o.nom, pane: o.pane, livre: false, motif: null }));
  let restants = comptes;
  while (restants.length > 0) {
    for (const c of restants) {
      // On ne force JAMAIS : écrire par-dessus un reste ne livrerait pas deux messages, ça en
      // livrerait un, les deux textes collés.
      const livre = await livrerBrief({ pane: c.pane, texte: r.rappel, appelHerdr, lireEcran, dormir });
      c.livre = livre.ok;
      c.motif = livre.ok ? null : livre.message;
    }
    restants = restants.filter((c) => !c.livre);
    if (restants.length === 0 || Date.now() + DELAI_MS >= fin) break;
    await dormir(DELAI_MS);
  }

  const manques = comptes.filter((c) => !c.livre);
  process.stdout.write(
    `${JSON.stringify({ rendez_vous: nom, orchestrateurs: comptes.length, livres: comptes.length - manques.length, comptes })}\n`
  );
  // Aucun orchestrateur vivant n'est un SUCCÈS, pas un échec : personne n'attend de rappel.
  process.exit(manques.length === 0 ? 0 : 1);
}

async function main() {
  const [quoi, ...args] = process.argv.slice(2);
  if (!quoi || quoi === '--help' || quoi === '-h') usage(0);

  if (quoi === 'service') {
    const geste = args[0] || 'etat';
    if (geste === 'installer') {
      const res = await installerService();
      if (!res.ok) {
        process.stderr.write(`installation refusée : ${res.erreur}\n`);
        process.exit(1);
      }
      process.stdout.write(
        `rendez-vous posés : ${res.poses.map((p) => p.nom).join(', ')} — la ronde revient chaque heure, ` +
          `le topo chaque matin à 7 h 00\n`
      );
      return;
    }
    if (geste === 'retirer') {
      const res = await retirerService();
      process.stdout.write(`rendez-vous retirés : ${res.retires.map((p) => p.nom).join(', ')}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify(await etatService(), null, 2)}\n`);
    return;
  }

  if (!RENDEZ_VOUS[quoi]) usage(1);
  await tenir(quoi);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});

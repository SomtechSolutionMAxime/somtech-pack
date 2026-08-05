// service.js — faire du veilleur un service du poste, qui revient après un redémarrage.
//
// Sans lui, la ligne ne survit pas à un reboot : le démarrage paresseux ne réveille le
// veilleur que lorsqu'un agent ouvre une ligne — donc jamais pour les lignes DÉJÀ ouvertes.
// Le dirigeant écrirait dans un canal que plus personne n'écoute, et rien ne le lui dirait.
//
// Choix, et ses raisons :
//   - un agent de session (`LaunchAgent`), pas un démon système : le veilleur doit tourner
//     SOUS le compte du poste, sans quoi il ne peut pas lire le trousseau — les jetons y
//     sont déposés par l'utilisateur, pas par le système ;
//   - `KeepAlive` conditionné à un échec : un veilleur qui se retire proprement parce qu'un
//     autre tourne déjà (sortie 0) ne doit PAS être relancé en boucle ;
//   - `PATH` explicite : un service ne charge aucun profil de shell, et le veilleur a besoin
//     de trouver `herdr`. C'est la panne classique de ce genre d'installation — tout marche
//     à la main, rien ne marche au démarrage.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHEMIN_JOURNAL, RACINE } from './registre.js';

const execFileAsync = promisify(execFile);

export const ETIQUETTE = 'ca.somtech.ligne-directe';
const ICI = dirname(fileURLToPath(import.meta.url));

export function cheminPlist() {
  return join(homedir(), 'Library', 'LaunchAgents', `${ETIQUETTE}.plist`);
}

/** Le PATH que le service verra — un service n'hérite d'aucun profil de shell. */
function cheminsUtiles() {
  const dirNode = dirname(process.execPath);
  const usuels = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  return [dirNode, ...usuels].filter((v, i, t) => t.indexOf(v) === i).join(delimiter);
}

function echapper(texte) {
  return String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function construirePlist({ node = process.execPath, script = join(ICI, 'demarrer-veilleur.js'), path = cheminsUtiles() } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${ETIQUETTE}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${echapper(node)}</string>
    <string>${echapper(script)}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
  </dict>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${echapper(path)}</string>
  </dict>
  <key>StandardOutPath</key><string>${echapper(CHEMIN_JOURNAL)}</string>
  <key>StandardErrorPath</key><string>${echapper(CHEMIN_JOURNAL)}</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
`;
}

async function launchctl(args) {
  try {
    const { stdout, stderr } = await execFileAsync('launchctl', args);
    return { ok: true, sortie: `${stdout}${stderr}`.trim() };
  } catch (err) {
    return { ok: false, sortie: `${err.stdout || ''}${err.stderr || ''}`.trim() || err.message };
  }
}

/** Installe (ou réinstalle) le service, et le démarre. */
export async function installerService() {
  const chemin = cheminPlist();
  mkdirSync(dirname(chemin), { recursive: true });
  mkdirSync(RACINE, { recursive: true });
  writeFileSync(chemin, construirePlist(), { mode: 0o644 });

  const cible = `gui/${process.getuid()}`;
  // Réinstaller doit être sans douleur : on décharge d'abord, sans faire de bruit si le
  // service n'était pas là.
  await launchctl(['bootout', `${cible}/${ETIQUETTE}`]);
  const chargement = await launchctl(['bootstrap', cible, chemin]);
  if (!chargement.ok) return { ok: false, chemin, erreur: chargement.sortie };
  await launchctl(['enable', `${cible}/${ETIQUETTE}`]);
  await launchctl(['kickstart', `${cible}/${ETIQUETTE}`]);
  return { ok: true, chemin };
}

export async function retirerService() {
  const chemin = cheminPlist();
  const r = await launchctl(['bootout', `gui/${process.getuid()}/${ETIQUETTE}`]);
  if (existsSync(chemin)) unlinkSync(chemin);
  return { ok: true, chemin, sortie: r.sortie };
}

export async function etatService() {
  const r = await launchctl(['print', `gui/${process.getuid()}/${ETIQUETTE}`]);
  if (!r.ok) return { installe: existsSync(cheminPlist()), charge: false };
  const pid = /\bpid = (\d+)/.exec(r.sortie)?.[1];
  const etat = /\bstate = (\w+)/.exec(r.sortie)?.[1];
  return { installe: true, charge: true, pid: pid ? Number(pid) : null, etat: etat || null };
}

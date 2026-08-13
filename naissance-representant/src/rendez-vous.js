// rendez-vous.js — les deux rendez-vous que le métier de l'orchestrateur lui impose, et le
// mécanisme qui les DÉCLENCHE.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUE LE MÉTIER DIT, ET CE QU'IL LAISSAIT OUVERT
//
// Le lot 1 a écrit le QUOI, et il a explicitement laissé le COMMENT à celui-ci :
//
//   • « Tu fais le tour de tes agents et du travail qui tourne toutes les heures. Par
//     défaut, pas sur demande. » (ajout 4)
//   • « Chaque matin à 7 h 00, tu poses un topo sur ta ligne » — un scrum : fait / en cours
//     / bloqué, et on ne saute pas son tour, « rien de neuf » étant une information (ajout 5).
//
// Le gabarit dit, en toutes lettres : « Ce que ce document ne dit pas encore : comment ce
// rendez-vous se déclenche. […] l'inventer ici produirait un mécanisme calibré sur une
// supposition. » Le voici, et il est calibré sur ce qui a été MESURÉ sur ce poste.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI UN AGENT DE SESSION (launchd), ET PAS UNE BOUCLE NI CRON — MESURÉ
//
// Trois candidats existaient. Ce qui a été constaté sur ce poste le 2026-08-13 :
//
//   • une BOUCLE dans la session de l'orchestrateur — écartée d'abord, et pas pour une
//     raison technique : elle meurt avec la session. Or ce lot existe précisément pour que
//     le rôle SURVIVE à la session. Un rendez-vous qui disparaît quand on ferme l'onglet
//     rejoue le défaut qu'on corrige ;
//   • CRON — vivant mais marginal : UNE seule entrée sur tout le poste. Il ne survit pas non
//     plus proprement au sommeil de la machine (un rendez-vous manqué est simplement perdu) ;
//   • un AGENT DE SESSION `launchd` — c'est le mécanisme du poste : NEUF services Somtech y
//     sont chargés, dont TROIS déjà déclenchés au calendrier (`StartCalendarInterval`). Il
//     revient après un redémarrage, il rattrape un rendez-vous manqué au réveil de la
//     machine, et le dépôt sait déjà en poser un — `ligne-directe/src/service.js` porte les
//     leçons payées (PATH explicite parce qu'un service ne charge aucun profil de shell ;
//     agent de SESSION et non démon système, sans quoi le trousseau reste hors d'atteinte).
//
// Retenu : l'agent de session. Ce n'est pas le plus élégant dans l'absolu — c'est celui que
// ce poste sait déjà faire vivre, et dont les modes de panne ont déjà coûté leur prix une fois.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// À QUI LE RENDEZ-VOUS S'ADRESSE — LES LIEUX SONT L'INVENTAIRE
//
// Aucun registre local des orchestrateurs (arbitrage du dirigeant : le ServiceDesk fait foi,
// les lieux sont l'inventaire). Le réveil énumère donc les agents VIVANTS et retient ceux qui
// tournent dans un lieu d'orchestrateur — reconnu par ce qu'il CONTIENT (`roleDuLieu`), pas
// par le nom de son dossier.
//
// C'est ce qui rend le mécanisme juste par construction : un orchestrateur fermé cesse d'être
// réveillé sans qu'on ait rien à désinscrire, et un second orchestrateur né dans le même
// dépôt est servi sans qu'on ait rien à ajouter. Un fichier à tenir est un fichier qui ment
// dès qu'on oublie de le mettre à jour.

import { join } from 'node:path';
import { homedir } from 'node:os';

import { roleDuLieu } from './lieu.js';

/** Les deux rendez-vous, et rien d'autre — la liste est fermée parce que le métier l'est. */
export const RENDEZ_VOUS = {
  ronde: {
    etiquette: 'ca.somtech.orchestrateur-ronde',
    /**
     * Toutes les heures. `StartInterval` plutôt qu'un calendrier : ce qui compte est le
     * RYTHME, pas l'heure ronde — un orchestrateur né à 14 h 40 n'a pas à attendre 15 h 00
     * pour son premier tour.
     */
    declencheur: '  <key>StartInterval</key><integer>3600</integer>',
    rappel:
      "C'est l'heure de ta ronde. Fais le tour de tes agents ouverts et du travail qui tourne : " +
      "qui est bloqué, qui a fini sans le dire, quelle chaîne est rouge. Ce que tu en fais est " +
      "dans ton métier — tu arbitres, tu ne prends pas le clavier à leur place. " +
      "Si tout va bien, dis-le en une ligne et reprends ce que tu faisais.",
  },
  topo: {
    etiquette: 'ca.somtech.orchestrateur-topo',
    /** 7 h 00, tous les jours. */
    declencheur:
      '  <key>StartCalendarInterval</key>\n' +
      '  <dict>\n' +
      '    <key>Hour</key><integer>7</integer>\n' +
      '    <key>Minute</key><integer>0</integer>\n' +
      '  </dict>',
    rappel:
      "C'est l'heure de ton topo du matin, sur ta ligne. Un scrum, pas un journal de bord : " +
      "ce qui a été fait depuis hier, ce qui est en cours, ce qui bloque — et c'est le blocage " +
      "seul qui appelle une action du dirigeant. Tu ne sautes pas ton tour : si rien n'a bougé, " +
      "dis « rien de neuf », c'est une information — elle distingue « ça n'avance pas » de « il est mort ».",
  },
};

export class RendezVousInconnu extends Error {
  constructor(nom) {
    super(`rendez-vous inconnu : « ${nom} » — les rendez-vous connus sont ${Object.keys(RENDEZ_VOUS).join(', ')}`);
    this.name = 'RendezVousInconnu';
    this.rendezVous = nom;
  }
}

export function rendezVous(nom) {
  const r = RENDEZ_VOUS[nom];
  if (!r) throw new RendezVousInconnu(nom);
  return r;
}

/**
 * Les orchestrateurs VIVANTS, lus dans une réponse de `herdr agent list`.
 *
 * `foreground_cwd` d'abord, et c'est la même raison qu'à la naissance : c'est le répertoire
 * du processus au premier plan, donc celui où `claude` tourne vraiment — et c'est lui qui
 * détermine quel métier la session a chargé. `cwd` est celui du shell du pane, qui peut
 * rester en arrière.
 *
 * Un agent SANS pane est écarté : on ne peut rien lui livrer, et le retenir ferait échouer un
 * réveil pour une raison qui n'en est pas une.
 */
export function orchestrateursVivants(reponse, { estUnLieu = roleDuLieu } = {}) {
  const agents = reponse?.result?.agents;
  if (!Array.isArray(agents)) return [];
  return agents
    .filter((a) => a?.pane_id)
    .map((a) => ({ pane: a.pane_id, nom: a.name || null, repertoire: a.foreground_cwd || a.cwd || null }))
    .filter((a) => a.repertoire && estUnLieu(a.repertoire) === 'orchestrateur');
}

/** Le chemin du descripteur d'un rendez-vous, dans les agents de session du poste. */
export function cheminPlist(nom) {
  return join(homedir(), 'Library', 'LaunchAgents', `${rendezVous(nom).etiquette}.plist`);
}

function echapper(texte) {
  return String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Le descripteur de l'agent de session qui tient un rendez-vous.
 *
 * PAS de `KeepAlive` : un réveil qui a fini son tour a fini. Le relancer en boucle
 * réveillerait les orchestrateurs sans arrêt — c'est le mode de panne inverse de celui qu'on
 * corrige, et il serait pire (un agent qu'on interrompt toutes les secondes ne travaille plus).
 *
 * `RunAtLoad` est à FAUX pour les deux, et c'est délibéré : installer le service ne doit pas
 * déclencher un topo à 14 h. Le rendez-vous est une HEURE, pas un événement d'installation.
 *
 * `PATH` explicite pour la raison déjà payée ailleurs : un service ne charge aucun profil de
 * shell, et ce réveil a besoin de trouver `herdr`. C'est la panne classique de ce genre
 * d'installation — tout marche à la main, rien ne marche au démarrage.
 */
export function construirePlist(nom, { node = process.execPath, script, path = '', journal } = {}) {
  const r = rendezVous(nom);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${r.etiquette}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${echapper(node)}</string>
    <string>${echapper(script)}</string>
    <string>${echapper(nom)}</string>
  </array>
  <key>RunAtLoad</key><false/>
${r.declencheur}
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${echapper(path)}</string>
  </dict>
  <key>StandardOutPath</key><string>${echapper(journal)}</string>
  <key>StandardErrorPath</key><string>${echapper(journal)}</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
`;
}

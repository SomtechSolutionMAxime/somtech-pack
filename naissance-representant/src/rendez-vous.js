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
import { sessionsDuPoste } from './destinataire.js';

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
/**
 * ⚠️ CE `'orchestrateur'` LITTÉRAL RESTE, ET VOICI SA RAISON (T-20260826-0076, point 6).
 *
 * Le lot qui a sorti les comparaisons de rôle du code vivant s'est arrêté ici, à dessein. Ce
 * n'est PAS une décision qui se dérive d'une propriété de rôle : c'est le PÉRIMÈTRE d'un
 * dispositif écrit pour un métier nommé. Tout ce module l'est — ses deux rendez-vous sont ceux
 * « que le métier de l'orchestrateur lui impose » (en-tête), leurs étiquettes launchd sont
 * `ca.somtech.orchestrateur-ronde` et `ca.somtech.orchestrateur-topo`, et leurs rappels
 * TUTOIENT ce métier (« fais le tour de tes agents », « ton topo du matin, sur ta ligne »).
 *
 * ⚠️ ET LE REMPLACER PAR UN PRÉDICAT SERAIT UN CHANGEMENT DE COMPORTEMENT DÉGUISÉ EN RANGEMENT.
 * Réveiller un rôle qui ne l'était pas, c'est INTERROMPRE des sessions vivantes — mesuré le
 * 2026-08-26 : `ca.somtech.orchestrateur-ronde` et `-topo` sont tous deux CHARGÉS sur ce poste.
 * Un de-harcodage n'ajoute jamais un destinataire ; s'il faut en ajouter un, c'est un arbitrage,
 * pas un nettoyage.
 *
 * ⚠️ CE QUI A ÉTÉ MESURÉ AU PASSAGE, ET QUI N'EST PAS LE TROU QU'ON CRAIGNAIT : `RONDE.md` est
 * bien distribué aux DEUX gabarits, mais il ne dépend pas de ce module. C'est « le texte que tu
 * poses en `/loop` à ta naissance » (les deux gabarits, mot pour mot) — la ronde d'un agent
 * part de SA propre `/loop`, pas d'ici. Le gestionnaire n'a donc pas un briefing que personne ne
 * déclenche : il a le sien, et son métier écrit que « ta ronde est une boucle `/loop`, que tu
 * poses en naissant » (`joignabilite.md`). Ce module est un réveil EN PLUS, propre à
 * l'orchestrateur.
 */
export function orchestrateursVivants(reponse, { estUnLieu = roleDuLieu } = {}) {
  const agents = reponse?.result?.agents;
  if (!Array.isArray(agents)) return [];
  return agents
    .filter((a) => a?.pane_id)
    .map((a) => ({ pane: a.pane_id, nom: a.name || null, repertoire: a.foreground_cwd || a.cwd || null }))
    .filter((a) => a.repertoire && estUnLieu(a.repertoire) === 'orchestrateur');
}

/**
 * Les orchestrateurs vivants du POSTE — toutes sessions confondues, chacun avec la sienne.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE BALAYAGE (T-20260815-0008)
 *
 * La ronde demandait la liste des agents **sans désigner de session**. Elle ne joignait donc
 * que celle de son environnement — et un agent de session ne charge aucun profil de shell :
 * pour lui, c'était **aucune**. Un orchestrateur vivant a passé toute sa vie sans recevoir
 * un seul réveil, ni pour sa ronde ni pour son topo, et a fini par poser une boucle à la
 * main sans savoir ce qu'il contournait.
 *
 * ⚠️ LE CORRECTIF ÉVIDENT ÉTAIT LE MAUVAIS, et c'est ce qui rend ce commentaire utile.
 * Poser `HERDR_SOCKET_PATH` dans le descripteur du service figerait la ronde sur **une**
 * session, choisie le jour de l'installation, pendant que le dirigeant en ouvre au fil de
 * l'eau. Le veilleur de `ligne-directe`, lui, tourne depuis des semaines et son descripteur
 * ne porte que `PATH` : il ne dépend d'aucune variable, il **découvre** les sessions. C'est
 * ce modèle-là qu'on suit — la vigilance ne se pose pas sur une adresse, elle regarde.
 *
 * ⚠️ ET CHAQUE ORCHESTRATEUR PORTE LE SOCKET DE SA SESSION. Un pane ne se joint pas depuis
 * une autre session : sans ça, on aurait remplacé « ne réveiller personne » par « réveiller
 * ceux d'une session et croire avoir fait le tour ».
 *
 * @returns {Promise<{orchestrateurs: Array, muettes: Array, sessions: number}>}
 */
export async function orchestrateursDuPoste({ appel, sessions, estUnLieu = roleDuLieu } = {}) {
  const aBalayer = sessions ?? sessionsDuPoste();
  const orchestrateurs = [];
  const muettes = [];
  let agentsVus = 0;

  for (const socket of aBalayer) {
    const r = await appel(['agent', 'list'], { socket });
    // Une session qui ne répond pas ne fait pas tomber la ronde : les autres attendent leur
    // réveil, et une session morte est un fait à RAPPORTER, pas une raison d'abandonner.
    if (!r.ok) {
      muettes.push(socket);
      continue;
    }
    // ⚠️ ON COMPTE CE QU'ON A VU AVANT DE FILTRER, et ce n'est pas de la statistique.
    // « Aucun orchestrateur » a DEUX causes que rien ne distinguait : il n'y en a vraiment
    // aucun, ou `roleDuLieu` n'en a reconnu aucun — un gabarit modifié, un en-tête déplacé,
    // et la reconnaissance échoue en silence. Les deux rendaient le même succès. Or c'est
    // exactement l'état qu'aurait ce ticket s'il se rouvrait : onze agents vivants, zéro
    // reconnu, et un réveil qui se déclare content. Le compte des agents VUS les sépare.
    agentsVus += Array.isArray(r.reponse?.result?.agents) ? r.reponse.result.agents.length : 0;
    for (const o of orchestrateursVivants(r.reponse, { estUnLieu })) orchestrateurs.push({ ...o, socket });
  }

  return { orchestrateurs, muettes, sessions: aBalayer.length, agentsVus };
}

/**
 * LE PLAFOND DE TEMPS D'UN RENDEZ-VOUS — il le TUE, et il le DIT (T-20260818-0014).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * POURQUOI IL EXISTE, ET CE QU'AUCUNE ÉCHÉANCE NE PEUT FAIRE À SA PLACE
 *
 * Les échéances de `tenir()` sont COOPÉRATIVES : elles décident de ne pas demander un tour
 * de plus. Elles supposent donc que chaque tour REVIENT. Rien ne le garantit — un appel
 * `herdr` qui ne rend jamais la main fait pendre la ronde pour toujours, et aucune échéance
 * n'est jamais consultée, parce que le code qui la consulte n'est jamais atteint.
 *
 * Et une ronde qui pend ne rate pas UN rendez-vous :
 *
 *   > le service n'accepte qu'une instance à la fois — tant qu'elle ne rend pas la main,
 *   > la SUIVANTE n'est pas lancée. Une ronde qui pend les ANNULE TOUTES.
 *
 * C'est la panne la plus chère du dispositif, parce qu'elle est SILENCIEUSE : une vigilance
 * morte et une vigilance qui n'a rien à dire produisent exactement le même silence. D'où le
 * plafond, et d'où le fait qu'il ÉCRIT avant de tuer. Une panne bruyante vaut infiniment
 * mieux qu'un silence qui annule les suivantes.
 *
 * ⚠️ LE MINUTEUR EST `unref`, ET VOICI CE QUE ÇA FAIT VRAIMENT — la première rédaction de ce
 * commentaire affirmait un effet qui ne se produit PAS, et une passe de revue par mutation l'a
 * pris en défaut : retirer le `unref` ne changeait rien d'observable, parce que `tenir()`
 * termine aujourd'hui par un `process.exit()` sur CHACUN de ses chemins, et qu'un `exit` ne
 * regarde aucun minuteur en attente. La justification était donc invérifiable, ce qui est le
 * défaut dominant de ce dépôt, commis dans le lot qui le corrige.
 *
 * Ce que `unref` garantit réellement, et qui vaut d'être tenu : **cette fonction ne retient
 * jamais un processus en vie**. Le jour où un chemin de sortie RENDRA la main au lieu de
 * sortir — un refactor ordinaire —, un minuteur ordinaire ferait attendre trente-cinq minutes
 * à une ronde de dix secondes, et annulerait la suivante par le mécanisme censé l'en
 * protéger. C'est une propriété de `poserPlafond`, pas de son appelant : elle est donc
 * éprouvée sur `poserPlafond` seul, sans passer par la ronde (`tests/plafond.test.js`).
 *
 * @param {object} p
 * @param {number} p.ms        le plafond, en millisecondes
 * @param {string} p.quoi      ce qui est plafonné, pour que le faire-part nomme sa victime
 * @param {(t: string) => void} p.ecrire  où le faire-part est écrit (le journal du service)
 * @param {(code: number) => void} p.sortir  comment on meurt
 * @param {Function} [p.minuteur]  injectable : c'est par là que ce comportement se prouve
 */
export function poserPlafond({ ms, quoi, ecrire, sortir, minuteur = setTimeout }) {
  const t = minuteur(() => {
    ecrire(
      `${quoi} : PLAFOND DE TEMPS DÉPASSÉ (${ms} ms) — la ronde est tuée ICI, elle n'a donc RIEN établi.\n` +
        `  Ce n'est pas « rien à signaler » : c'est « on n'a pas pu regarder ». Les deux se ressemblent\n` +
        `  dans un journal, et c'est cette ressemblance qui a laissé le dispositif muet des jours durant.\n` +
        `  Une ronde qui pend n'en rate pas une, elle les ANNULE TOUTES — le service n'accepte qu'une\n` +
        `  instance à la fois. Mourir bruyamment est donc la seule issue qui laisse partir la suivante.\n` +
        `  Ce qu'il faut regarder : le dernier appel « herdr » du journal ci-dessus — c'est celui qui\n` +
        `  n'est jamais revenu.\n`
    );
    sortir(1);
  }, ms);
  // Voir plus haut : sans `unref`, le plafond retiendrait lui-même la ronde jusqu'à son terme.
  if (typeof t?.unref === 'function') t.unref();
  return t;
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

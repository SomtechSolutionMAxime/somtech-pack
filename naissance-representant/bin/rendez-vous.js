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

import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { livrerBrief } from '../src/livraison.js';
import { rendezVous, orchestrateursDuPoste, cheminPlist, construirePlist, poserPlafond, RENDEZ_VOUS } from '../src/rendez-vous.js';
import { appelHerdr, lireEcran } from '../src/appel-herdr.js';
import { verdictDeVigie, LECTURES_MINIMALES } from '../src/vigie.js';
import { RACINE, chargerRegistre, lignesOuvertes } from '../../ligne-directe/src/registre.js';
import { lignesAuChantierDisparu, avisDHygiene } from '../../ligne-directe/src/hygiene.js';
import { enEssais, refuser } from '../../ligne-directe/src/cloison.js';
import { OUTILS, OutilIntrouvable, cheminsUtiles, lancer } from '../../ligne-directe/src/outils.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const JOURNAL = join(RACINE, 'orchestrateur-rendez-vous.log');

// ═══ LA TRACE DU DERNIER PASSAGE — ce qui SÉPARE une vigilance morte d'une vigilance qui n'a
// rien à dire (T-20260818-0014, point 3)
//
// C'est le défaut qui a laissé celui-ci vivre des jours : les deux produisent **exactement le
// même silence**. Personne ne pouvait répondre à « quand une ronde a-t-elle abouti pour la
// dernière fois ? » sans relire un journal que personne ne lit.
//
// ⚠️ CE FICHIER N'ALERTE PERSONNE, et il ne prétend pas le faire. Il rend l'absence
// MESURABLE — « la dernière ronde a fini il y a six heures » se distingue enfin de « la
// dernière ronde a fini il y a douze minutes ». Prévenir quelqu'un est un autre geste, et
// l'écrire ici en ferait un mécanisme de plus qu'on croirait vivant sans l'avoir mesuré.
//
// Un passage PAR RENDEZ-VOUS : la ronde et le topo n'ont pas la même cadence, et écraser
// l'un avec l'autre ferait croire la ronde vivante parce que le topo est passé.
const DERNIER_PASSAGE = join(RACINE, 'orchestrateur-dernier-passage.json');

/**
 * Note qu'un rendez-vous s'est TERMINÉ, et comment. Ne fait jamais échouer la ronde.
 *
 * Un défaut d'écriture de la trace n'est pas un défaut du rendez-vous : le taire serait un
 * silence de plus, le faire échouer priverait les orchestrateurs de leur rappel pour un
 * fichier d'observation. Il se DIT, et la ronde continue.
 */
function noterLePassage(nom, verdict, debut, details = {}) {
  try {
    mkdirSync(RACINE, { recursive: true });
    let tout = {};
    try {
      tout = JSON.parse(readFileSync(DERNIER_PASSAGE, 'utf8'));
    } catch {
      /* premier passage, ou trace illisible : on la refait, on ne perd pas celui d'aujourd'hui */
    }
    tout[nom] = { fini_le: new Date().toISOString(), verdict, duree_ms: Date.now() - debut, ...details };
    writeFileSync(DERNIER_PASSAGE, `${JSON.stringify(tout, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${nom} : trace du dernier passage NON écrite — ${err.message}\n`);
  }
}

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

// L'écart entre deux lectures de la vigie. Assez long pour qu'un agent qui pense ait redessiné
// son compteur d'activité — mesuré à ~1 redessin par seconde — assez court pour que la ronde
// ne s'éternise pas sur un pane suspect.
const DELAI_VIGIE_MS = Number(process.env.RENDEZ_VOUS_VIGIE_MS || 20000);

// ═══ LE BUDGET D'UNE RONDE, ET IL EST UN SEUL (T-20260818-0014)
//
// ⚠️ IL ÉTAIT COMPTÉ DEUX FOIS, et le commentaire d'à côté affirmait le contraire. `tenir()`
// armait une échéance pleine pour la livraison, puis — APRÈS l'avoir dépensée — une SECONDE
// échéance pleine pour la vigie. Le plafond réel d'une ronde n'était donc pas l'échéance,
// c'était son DOUBLE : 30 min + 30 min = 60 min, soit EXACTEMENT l'intervalle qui sépare
// deux rondes. Zéro marge, sur le mécanisme dont toute la raison d'être est de finir avant
// le suivant. Mesuré : 14 605 ms pour une échéance de 8 000 ms.
//
// Il est donc armé UNE fois, au début, et il couvre TOUT — balayage, livraison, vigie.
const ECHEANCE_MS = Number(process.env.RENDEZ_VOUS_ECHEANCE_MS || 30 * 60 * 1000);

// La part du budget que la LIVRAISON a le droit de dépenser. Elle en mangerait la totalité si
// on la laissait faire — sa boucle de reprise ne s'arrête que quand le budget est épuisé —, et
// la vigie n'aurait alors jamais un instant pour regarder qui que ce soit. Le figé est
// précisément celui à qui la remise n'aboutit pas, donc celui qui vide le budget : sans part
// réservée, la garde tombe exactement là où elle sert.
//
// ⚠️ CE PARTAGE COÛTE UNE REPRISE, ET C'EST UN ARBITRAGE, PAS UN EFFET DE BORD — relevé en
// revue de fond, où il valait 2/3 et en coûtait deux. L'arithmétique, aux valeurs de
// production (échéance 30 min, reprise toutes les 5 min, vigie 3 lectures espacées de 20 s) :
//
//   avant le lot   6 reprises (dernière à t+25) puis une vigie qui SE RÉ-ARMAIT 30 min → 60 min
//   à 2/3          4 reprises (dernière à t+15) — un orchestrateur qui se libère à t+20 attend
//                  l'heure suivante, pour rien : le budget global n'exigeait pas ça
//   à 5/6          5 reprises (dernière à t+20) + 5 min de vigie = 5 suspects au tarif réservé
//
// Sur ce poste, la ronde mesurée avait 4 orchestrateurs dont 3 suspects. Cinq minutes de vigie
// les couvrent. On rend donc à la livraison tout ce que la vigie n'a pas besoin de prendre.
const PART_LIVRAISON = Number(process.env.RENDEZ_VOUS_PART_LIVRAISON || 5 / 6);

// ═══ LE PLAFOND DUR — ce que le budget ne peut PAS attraper
//
// Le budget est COOPÉRATIF : il décide de ne pas demander un tour de plus, ce qui suppose
// que chaque tour revienne. Un appel `herdr` qui ne rend jamais la main ne revient pas, et
// le code qui consulte le budget n'est alors jamais atteint. Le plafond, lui, ne demande
// rien à personne. Il est au-dessus du budget pour ne pas se déclencher sur une ronde qui
// travaille encore, et très en dessous de l'heure qui sépare deux rondes.
const PLAFOND_MS = Number(process.env.RENDEZ_VOUS_PLAFOND_MS || ECHEANCE_MS + 5 * 60 * 1000);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function usage(code) {
  process.stderr.write(
    'orchestrateur-rendez-vous ronde|topo\n' +
      'orchestrateur-rendez-vous service installer|retirer|etat\n'
  );
  process.exit(code);
}

/**
 * Un appel à `launchctl`, et son verdict — jamais une exception.
 *
 * Même séparation que dans `ligne-directe/src/service.js`, et pour la même raison : « je n'ai
 * pas pu parler à launchd » n'est pas « le rendez-vous n'est pas chargé ». Conclure le second
 * ferait croire au dirigeant que sa ronde ne tourne plus, alors qu'elle tourne.
 */
async function launchctl(args) {
  try {
    const { stdout, stderr } = await lancer(OUTILS.launchctl, args);
    return { ok: true, outilIntrouvable: false, sortie: `${stdout}${stderr}`.trim() };
  } catch (err) {
    if (err instanceof OutilIntrouvable) {
      return { ok: false, outilIntrouvable: true, sortie: err.message };
    }
    return {
      ok: false,
      outilIntrouvable: false,
      sortie: `${err.stdout || ''}${err.stderr || ''}`.trim() || err.message,
    };
  }
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
    if (r.outilIntrouvable) {
      // On n'a pas posé la question : on ne répond donc pas à sa place. `charge: null` se lit
      // « inconnu », là où `false` aurait affirmé une absence qui n'a jamais été mesurée.
      etats[nom] = { installe: existsSync(cheminPlist(nom)), charge: null, mesure: false, motif: r.sortie };
      continue;
    }
    etats[nom] = r.ok
      ? { installe: true, charge: true, mesure: true, etat: /\bstate = (\w+)/.exec(r.sortie)?.[1] || null }
      : { installe: existsSync(cheminPlist(nom)), charge: false, mesure: true };
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
  const debut = Date.now();
  try {
    await tenirLeRendezVous(nom, debut);
  } catch (err) {
    // ⚠️ LA MORT LA PLUS GRAVE ÉTAIT LA SEULE SANS TRACE — relevé en revue de fond, et c'est
    // le point 3 du ticket manqué dans le lot qui le corrige. `tenir()` n'avait aucune garde :
    // une exception imprévue (`commandesLivraison` lève si un `pane` manque à la réponse de
    // herdr) traversait jusqu'à `main().catch()`, qui écrit une ligne et sort — sans jamais
    // noter le passage. La ronde disparaissait donc en laissant l'état du poste EXACTEMENT
    // comme si elle n'avait jamais été lancée : le silence que ce lot existe pour supprimer.
    process.stderr.write(
      `${rendezVous(nom).etiquette} : la ronde s'est ARRÊTÉE sur une erreur imprévue — elle n'a donc RIEN établi.\n` +
        `  Ce n'est pas « rien à signaler ». Cause exacte : ${err.message}\n`
    );
    noterLePassage(nom, 'erreur', debut, { message: err.message });
    process.exit(1);
  }
}

async function tenirLeRendezVous(nom, debut) {
  const r = rendezVous(nom);

  // ⚠️ UNE PANNE PROVOQUÉE, ET C'EST LA SEULE FAÇON DE PROUVER LA GARDE D'AU-DESSUS. Elle
  // existe pour les exceptions IMPRÉVUES : par définition, on ne peut pas en fabriquer une
  // vraie. Cherchée, d'ailleurs — la route nommée en revue (`commandesLivraison` sur un pane
  // vide) est filtrée en amont par `orchestrateursVivants`, et les lectures de fichiers de
  // `roleDuLieu` sont déjà attrapées. La garde couvre donc une classe, pas un défaut connu :
  // raison de plus pour qu'elle soit éprouvée, et pas seulement affirmée.
  //
  // SOUS CLOISON D'ESSAIS UNIQUEMENT — `launchd` ne pose jamais `NODE_TEST_CONTEXT`, ce
  // chemin est donc inatteignable en production, quoi qu'on mette dans l'environnement.
  if (enEssais() && process.env.RENDEZ_VOUS_PANNE_PROVOQUEE) {
    throw new Error(process.env.RENDEZ_VOUS_PANNE_PROVOQUEE);
  }

  // ⚠️ POSÉ AVANT LE PREMIER APPEL, et pas une ligne plus bas : le balayage des sessions est
  // le premier endroit où un `herdr` muet fait pendre la ronde pour toujours. Un plafond
  // posé après lui serait un plafond qui ne couvre pas le sol sur lequel on tombe le plus.
  poserPlafond({
    ms: PLAFOND_MS,
    quoi: r.etiquette,
    ecrire: (t) => process.stderr.write(t),
    sortir: (code) => {
      // ⚠️ NOTÉ AVANT DE MOURIR, sinon la mort la plus grave serait la seule sans trace — et
      // c'est exactement celle qu'on ne voit pas passer.
      noterLePassage(nom, 'plafond-depasse', debut, { plafond_ms: PLAFOND_MS });
      process.exit(code);
    },
  });

  // TOUTES LES SESSIONS DU POSTE, PAS SEULEMENT LA SIENNE (T-20260815-0008). Un agent de
  // session ne charge aucun profil de shell : sans balayage, ce réveil ne joignait AUCUNE
  // session, et un orchestrateur vivant a passé sa vie sans en recevoir un seul.
  const balayage = await orchestrateursDuPoste({ appel: appelHerdr });
  const vivants = balayage.orchestrateurs;

  // ⚠️ UN RÉVEIL QUI NE JOINT PERSONNE DOIT DIRE POURQUOI — les trois silences n'ont pas la
  // même cause, et les confondre est ce qui a laissé le défaut vivre des jours dans le
  // journal d'un service que personne ne lit.
  if (balayage.sessions === 0) {
    process.stderr.write(
      `${r.etiquette} : aucune session herdr n'est ouverte sur ce poste — il n'y a personne à réveiller, ` +
        `et ce n'est pas la même chose que « personne n'attend ».\n`
    );
    noterLePassage(nom, 'aucune-session', debut, { sessions: 0 });
    process.exit(1);
  }
  if (balayage.muettes.length === balayage.sessions) {
    process.stderr.write(
      `${r.etiquette} : les ${balayage.sessions} session(s) du poste sont muettes — aucune n'a rendu ` +
        `sa liste d'agents. Le réveil n'a donc RIEN pu établir :\n  ${balayage.muettes.join('\n  ')}\n`
    );
    noterLePassage(nom, 'sessions-muettes', debut, { sessions: balayage.sessions, muettes: balayage.muettes.length });
    process.exit(1);
  }

  // Le budget global de la ronde, compté depuis son DÉBUT — le balayage des sessions en fait
  // partie : il coûte un appel par session du poste, dont les muettes, qui coûtent le plus.
  const finRonde = debut + ECHEANCE_MS;
  const fin = debut + ECHEANCE_MS * PART_LIVRAISON;

  // Un tour pour tout le monde, puis on ne repasse que sur ceux qui n'ont pas pris — et
  // seulement tant que l'échéance GLOBALE le permet. Un orchestrateur occupé ne fait donc
  // plus attendre les autres, et le rendez-vous se termine avant le suivant quel que soit
  // leur nombre.
  const comptes = vivants.map((o) => ({ agent: o.nom, pane: o.pane, socket: o.socket, livre: false, motif: null }));
  let restants = comptes;
  while (restants.length > 0) {
    for (const c of restants) {
      // On ne force JAMAIS : écrire par-dessus un reste ne livrerait pas deux messages, ça en
      // livrerait un, les deux textes collés.
      // Le socket de SA session : un pane ne se joint pas depuis une autre. Sans lui, on
      // remplacerait « ne réveiller personne » par « en réveiller un et croire avoir fait le tour ».
      const livre = await livrerBrief({ pane: c.pane, socket: c.socket, texte: r.rappel, appelHerdr, lireEcran, dormir });
      c.livre = livre.ok;
      c.motif = livre.ok ? null : livre.message;
    }
    restants = restants.filter((c) => !c.livre);
    if (restants.length === 0 || Date.now() + DELAI_MS >= fin) break;
    await dormir(DELAI_MS);
  }

  // ═══ LA VIGIE — CEUX QUI N'ONT PAS PRIS SE FONT REGARDER DANS LE TEMPS (T-20260816-0063).
  //
  // ⚠️ ON NE REGARDE QUE CEUX QUI N'ONT PAS PRIS, et c'est délibéré. Un agent qui a reçu son
  // rappel n'a rien à prouver ; le figé, lui, est exactement celui à qui la remise n'aboutit
  // pas. La série se paie donc sur les seuls cas suspects, jamais sur les 79 panes du poste.
  //
  // ⚠️ ET ELLE NE FAIT QUE REGARDER. Aucune touche n'est envoyée, aucun déblocage n'est tenté :
  // envoyer une touche à un agent figé, c'est taper à sa place. Le but est qu'il SE VOIE.
  //
  // ⚠️ ET ELLE EST BORNÉE PAR L'ÉCHÉANCE, comme la livraison — relevé en revue de fond. La
  // série coûte trois lectures espacées PAR SUSPECT, en séquence. Une panne herdr large ferait
  // plusieurs suspects d'un coup, et la ronde s'allongerait de N fois ce coût sans plafond,
  // jusqu'à mordre sur la ronde suivante. Ce qui n'a pas pu être regardé est DIT, jamais tu :
  // un silence qu'on ne s'explique pas est exactement ce que ce lot existe pour supprimer.
  const vigie = [];
  const nonRegardes = [];
  // ⚠️ ELLE NE S'ARME PLUS RIEN : elle hérite de CE QUI RESTE du budget de la ronde. Une
  // seconde échéance pleine ici doublait le plafond réel — voir `ECHEANCE_MS`.
  const finVigie = finRonde;
  for (const c of comptes.filter((x) => !x.livre)) {
    if (Date.now() + LECTURES_MINIMALES * DELAI_VIGIE_MS > finVigie) {
      nonRegardes.push(c.pane);
      continue;
    }
    const lectures = [];
    for (let i = 0; i < LECTURES_MINIMALES; i += 1) {
      const r = await appelHerdr(['agent', 'get', c.pane], { socket: c.socket });
      const a = r?.reponse?.result?.agent;
      let ecran = null;
      try {
        ecran = await lireEcran(['agent', 'read', c.pane, '--format', 'ansi'], { socket: c.socket });
      } catch {
        /* un écran illisible est une lecture de moins, jamais un écran vide */
      }
      lectures.push({
        t: Date.now(),
        statut: a?.agent_status ?? null,
        revision: a?.revision ?? null,
        introuvable: !a,
        ecran,
      });
      if (i < LECTURES_MINIMALES - 1) await dormir(DELAI_VIGIE_MS);
    }
    const v = verdictDeVigie(lectures);
    if (v) vigie.push({ agent: c.agent, pane: c.pane, ...v });
  }
  if (nonRegardes.length) {
    process.stderr.write(
      `${r.etiquette} : la vigie n'a pas eu le temps de regarder ${nonRegardes.length} pane(s) — ` +
        `${nonRegardes.join(', ')}. Ils ne sont ni sains ni figés : ils n'ont pas été mesurés.\n`
    );
  }

  // ═══ L'HYGIÈNE DU REGISTRE — il cesse de mentir, il n'est pas filtré (T-20260816-0083).
  //
  // Une ligne dont le chantier a disparu du disque reste ouverte, attachée à un numéro de pane
  // que le poste réattribue. Le prochain occupant hérite d'un canal ouvert pour un autre
  // client. La ronde est le bon endroit : elle passe déjà, régulièrement, et elle ne code rien.
  //
  // ⚠️ ELLE SIGNALE, ELLE NE FERME RIEN — refermer une ligne à tort ferait taire un canal
  // client. Et son avis NOMME SA SORTIE : la commande exacte, et le pane d'où la lancer.
  let hygiene = [];
  try {
    hygiene = lignesAuChantierDisparu(lignesOuvertes(chargerRegistre()), { chantierExiste: existsSync });
  } catch (err) {
    // Un registre illisible n'est pas un registre sans lignes mortes : on ne conclut rien.
    process.stderr.write(`${r.etiquette} : hygiène du registre non faite — ${err.message}\n`);
  }
  const avis = avisDHygiene(hygiene);
  if (avis) process.stderr.write(`${r.etiquette} : ${avis}\n`);

  const manques = comptes.filter((c) => !c.livre);
  process.stdout.write(
    `${JSON.stringify({ rendez_vous: nom, duree_ms: Date.now() - debut, sessions: balayage.sessions, muettes: balayage.muettes, agents_vus: balayage.agentsVus, orchestrateurs: comptes.length, livres: comptes.length - manques.length, comptes, ...(vigie.length ? { vigie } : {}), ...(nonRegardes.length ? { vigie_non_regardes: nonRegardes } : {}), ...(hygiene.length ? { lignes_au_chantier_disparu: hygiene } : {}) })}\n`
  );
  noterLePassage(nom, manques.length === 0 ? 'abouti' : 'partiel', debut, {
    orchestrateurs: comptes.length,
    livres: comptes.length - manques.length,
    sessions: balayage.sessions,
    muettes: balayage.muettes.length,
  });
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

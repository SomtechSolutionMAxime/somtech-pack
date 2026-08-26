#!/usr/bin/env node
// garde-des-naissances.js — LE FIL MINCE de la garde. (T-20260825-0013.)
//
// Patron de `gardes/ecriture.js` et de STD-047 R3bis : ici, UNIQUEMENT de l'I/O réelle — parler
// à herdr, lire le registre du poste, lire les lieux sur disque, écrire le compte rendu, sortir.
// Toute la décision vit dans un module PUR (`jugerLeParc`), qui est ce que les bancs exercent.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE FIL NE REND JAMAIS VERT SUR UNE MESURE QU'IL N'A PAS FAITE.
//
// Une garde qui ne peut pas mesurer et rend « rien à signaler » est PIRE QUE PAS DE GARDE : son
// vert se cite, se colle dans un rapport, et certifie un parc que personne n'a regardé. Les
// quatre pannes qui l'empêchent de se prononcer sortent donc toutes par la même porte,
// distincte du vert ET distincte d'une prise :
//
//   ① herdr injoignable — aucune session n'a répondu (`panes()` lève, et c'est voulu chez lui) ;
//   ② `herdr` absent du PATH — `OutilIntrouvable`, qui ferait rendre « aucun agent vivant » ;
//   ③ le registre des naissances est là mais illisible — À NE PAS CONFONDRE avec absent, qui
//      est le cas NORMAL d'un poste où personne n'est encore né et se juge très bien ;
//   ④ la frontière de la garde est démentie par le registre — le désarmement le plus discret.
//
// ⚠️ ET LE SUCCÈS PARTIEL SE DIT. Une session herdr qui refuse ne fait pas tomber les autres,
// mais son prix se voit : le compte rendu porte toujours combien de sessions ont répondu sur
// combien ont été interrogées. Mesuré le 2026-08-25 : **5 sessions répondent sur 15**. Un compte
// tiré de cinq sessions présenté comme un total serait amputé des deux tiers.

import { panes, agents } from '../../ligne-directe/src/herdr.js';
import { roleDuLieuOuRefus } from '../../ligne-directe/src/lieu-agent.js';
import { lireLesDeclarations } from '../src/declaration.js';
import { lireLesNaissances } from '../src/naissances-des-sessions.js';
import {
  jugerLeParc,
  normaliserLeParc,
  MISE_EN_SERVICE,
  SORTIE_REFUS,
} from '../src/garde-des-naissances.js';

/**
 * Le corps de la commande, avec ses quatre points de substitution NOMMÉS.
 *
 * ⚠️ LES DÉFAUTS SONT LA VRAIE CHAÎNE. Le banc du binaire ne s'en sert pas : il substitue
 * l'exécutable `herdr` lui-même et laisse tout ceci tourner pour de bon. Ces paramètres existent
 * pour qu'un appelant Node puisse composer la garde sans passer par un processus — pas pour
 * qu'un banc se fabrique un monde plus commode que le vrai.
 */
export async function main({
  lireLeParc = () => panes({}),
  lireLesAgents = () => agents({}),
  lireLeRegistre = () => lireLesDeclarations({}),
  lireLesDates = (panesVus) => lireLesNaissances(panesVus),
  roleDuLieu = roleDuLieuOuRefus,
  miseEnService = MISE_EN_SERVICE,
  ecrire = (t) => process.stdout.write(`${t}\n`),
  alerter = (t) => process.stderr.write(`${t}\n`),
  json = process.argv.includes('--json'),
} = {}) {
  let parc;
  let portee;
  try {
    const vu = await lireLeParc();
    parc = vu.panes;
    portee = { sessionsInterrogees: vu.sessionsInterrogees, sessionsRefusees: vu.sessionsRefusees };
  } catch (err) {
    return refuser(alerter, `je n’ai pas pu lire le parc herdr (${err?.message ?? err}). Je ne rends AUCUN verdict : une garde qui ne voit pas le parc et rend vert certifie ce qu’elle n’a pas regardé.`);
  }

  // ⚠️ LE REGISTRE DES AGENTS PORTE LES NOMS, ET SON SILENCE NE DIT RIEN. Un `agent list` qui
  // ne voit pas un pane ne prouve PAS que ce pane est anonyme : `agent list` a déjà été mesuré
  // à 83 panes sur 227 un jour, et à 94 sur 94 un autre. `normaliserLeParc` en fait donc un
  // « nom NON MESURÉ », qui range l'agent dans les non-mesurés — jamais dans les prises.
  //
  // ⚠️ ET IL N'Y A PAS DE `catch` ICI, DÉLIBÉRÉMENT. Il y en avait un, qui repliait un échec sur
  // `null` ; une mutation l'a remplacé par `[]` et **AUCUN banc n'a rougi**. En cherchant
  // pourquoi : `agents()` ne propage QUE `OutilIntrouvable`, et `panes()` — qui tourne trois
  // lignes plus haut — le propage déjà. Ce `catch` ne pouvait donc jamais se déclencher. Un
  // filet qu'aucun chemin n'atteint ne protège de rien : il déclare seulement un repli permissif
  // comme s'il était nécessaire. Sans lui, une panne future REMONTE et devient un REFUS, ce qui
  // est la seule polarité que ce fichier accepte.
  const registreDAgents = await lireLesAgents();

  // ⚠️ LA DATE DE NAISSANCE EST CE QUI BORNE LA POPULATION — voir l'en-tête du module de
  // décision. Elle se lit dans les transcrits de Claude Code, PAS dans le nom du répertoire de
  // travail : une reprise (`claude-swt <horodatage>`, le geste que le pack prescrit) fait naître
  // aujourd'hui dans un répertoire d'hier.
  //
  // ⚠️ ET SON ÉCHEC NE SORT PAS PAR UN REFUS GLOBAL, DÉLIBÉRÉMENT. `lireLesNaissances` ne lève
  // pas : elle rend « refusée », et chaque agent devient NON MESURÉ — verdict
  // `ZONES_NON_MESUREES`, sortie 2. C'est plus BRUYANT qu'un vert et plus PRÉCIS qu'un refus
  // global : le compte rendu nomme alors chaque agent qu'on n'a pas su dater, et le lecteur
  // sait quelle mesure refaire. Un refus global, lui, ne dirait pas sur qui il porte.
  const naissances = await lireLesDates(parc);

  let registre;
  try {
    registre = await lireLeRegistre();
  } catch (err) {
    // `RegistreDeNaissancesIllisible` — le répertoire est LÀ mais fermé. Un registre ABSENT,
    // lui, ne lève pas : il rend un parc vide, et c'est un cas parfaitement jugeable.
    return refuser(alerter, `${err?.message ?? err}`);
  }

  let verdict;
  try {
    verdict = jugerLeParc({
      agents: normaliserLeParc({ panes: parc, agentsHerdr: registreDAgents, naissances }),
      registre,
      roleDuLieu,
      portee,
      miseEnService,
    });
  } catch (err) {
    // `FrontiereContredite`, `ToleranceHorsDeSaMesure` et `ComptesQuiNeBalancentPas` passent
    // par ici. Les trois sont des refus de se prononcer, pas des pannes : leur message porte
    // déjà tout ce qu'il faut.
    return refuser(alerter, `${err?.message ?? err}`);
  }

  ecrire(json ? JSON.stringify(verdict, null, 2) : verdict.texte);
  return verdict.sortie;
}

function refuser(alerter, message) {
  alerter(`GARDE DES NAISSANCES — REFUS : ${message}`);
  return SORTIE_REFUS;
}

// ⚠️ LA PANNE QUI TOMBE HORS DU `try` SORT PAR LE REFUS, JAMAIS PAR LE VERT. Un `process.exit`
// implicite à 0 sur une exception non rattrapée ferait exactement ce que tout ce fichier
// interdit : rendre un succès sans avoir mesuré.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`GARDE DES NAISSANCES — REFUS : panne avant tout verdict (${err?.message ?? err})\n`);
      process.exit(SORTIE_REFUS);
    });
}

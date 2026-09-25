#!/usr/bin/env node
// scribe-taches.js — le FIL MINCE du hook `Stop` qui écrit les tâches au ServiceDesk.
//
// Patron de STD-047 R3bis, comme `sous-agent.js` : ici, uniquement de l'I/O réelle
// — lire stdin, lire le transcript, lire `.demande`, appeler le transport, lire et
// écrire l'état du plafond, répondre. Toute la décision vit dans un module PUR
// (`deciderStop`), qui est ce que les tests exercent (T-20260925-0080).
//
// ⚠️ LA FORME `Stop` DIFFÈRE DE `PreToolUse` : `{"decision":"block","reason":…}`
// pour relancer l'agent (il ne peut pas s'arrêter) ; rien, ou `{}`, pour le laisser
// s'arrêter ; `systemMessage` pour dire quelque chose à l'humain sans relancer.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

const ICI = dirname(fileURLToPath(import.meta.url));

let repondu = false;

function repondre(sortie) {
  if (repondu) return;
  repondu = true;
  const texte = sortie && Object.keys(sortie).length ? JSON.stringify(sortie) + '\n' : '';
  const fin = () => process.exit(0);
  if (!texte) { fin(); return; }
  try {
    writeSync(1, texte);
  } catch {
    process.stdout.write(texte);
  }
  fin();
}

/**
 * Le délai que ce hook s'impose à lui-même — plus long que celui de la garde des
 * sous-agents : ce scribe fait PLUSIEURS appels réseau séquentiels (pré-vol,
 * vérification de chaque ticket cité, écritures, pagination de la suite). Reste
 * sous le délai par défaut de Claude Code pour un hook (60 s).
 */
const DELAI_MS = Number(process.env.SOMTECH_SCRIBE_DELAI_MS || 45_000);
const minuteur = setTimeout(() => {
  repondre({ systemMessage: `scribe des tâches : délai dépassé (${DELAI_MS} ms) sans verdict — arrêt permis plutôt que de faire pendre le tour.` });
}, DELAI_MS);
if (typeof minuteur.unref === 'function') minuteur.unref();

for (const evenement of ['uncaughtException', 'unhandledRejection']) {
  process.on(evenement, (e) => {
    repondre({ systemMessage: `scribe des tâches : panne interne (${e?.message ?? evenement}) — arrêt permis plutôt qu'un verdict non calculé.` });
  });
}

async function lireStdin() {
  const morceaux = [];
  for await (const m of process.stdin) morceaux.push(m);
  return Buffer.concat(morceaux).toString('utf8');
}

/**
 * Le dernier message `assistant` QUI PORTE DU TEXTE, dans le transcript JSONL —
 * chaque ligne est un événement.
 *
 * ⚠️ CE CHEMIN N'ÉTAIT EXERCÉ PAR AUCUN TÉMOIN (revue de fond, T-20260925-0080,
 * Z2) : tous fournissaient `last_assistant_message` directement, qui PRIME sur
 * ce parcours. C'est pourtant le chemin du POSTE dès qu'une version de l'hôte
 * ne porte pas ce champ dans l'entrée du hook.
 *
 * MESURÉ sur un vrai transcript de ce poste (169 messages assistant, lecture
 * seule) : **71/169 sont du `tool_use` PUR, zéro bloc texte** — un « dernier
 * message assistant » brut est très souvent un appel d'outil silencieux, pas
 * les mots de l'agent. 40/169 portent EXACTEMENT un bloc texte ; AUCUN n'en
 * porte plus d'un dans cet échantillon (le `.join('\n')` ci-dessous reste
 * défensif pour le jour où un message en porterait plusieurs).
 *
 * ✅ DÉCISION, tranchée sur cette mesure : on lit le texte du DERNIER message
 * assistant QUI EN A — jamais le silence d'un `tool_use` final, jamais le
 * premier trouvé. On remonte donc la liste depuis la fin, et on saute tout
 * message sans bloc `text`.
 */
function dernierMessageAssistant(cheminTranscript) {
  if (!cheminTranscript || !existsSync(cheminTranscript)) return null;
  let brut;
  try { brut = readFileSync(cheminTranscript, 'utf8'); } catch { return null; }
  const lignes = brut.split('\n').filter((l) => l.trim().length > 0);
  for (let i = lignes.length - 1; i >= 0; i -= 1) {
    let evt;
    try { evt = JSON.parse(lignes[i]); } catch { continue; }
    if (evt?.type !== 'assistant') continue;
    const blocs = evt?.message?.content;
    if (!Array.isArray(blocs)) continue;
    const texte = blocs.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
    if (texte) return texte;
  }
  return null;
}

/** Le fichier `.demande` du lieu — `null` si absent ou illisible (jamais une exception qui remonte). */
function lireFichierDemande(cwd) {
  const p = join(cwd, '.demande');
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

/** L'état du plafond, PAR LIEU — un fichier nommé par le sha1 du cwd. */
function cheminEtat(cwd) {
  const base = process.env.SOMTECH_SCRIBE_ETAT || join(homedir(), '.somtech', 'etat', 'scribe');
  return join(base, `${createHash('sha1').update(cwd).digest('hex')}.json`);
}

/**
 * L'état du plafond ET le JOURNAL PAR ÉTAPE (D2/D3) — LE MÊME fichier, par lieu.
 * `journal` reste `null` tant qu'aucune écriture n'a encore été tentée avec
 * succès sur au moins une étape. Sa forme : `{ empreinte, etapes }`.
 *
 * ⚠️ TOLÉRANT À UN FICHIER D'UN FORMAT ANTÉRIEUR (`dernierBlocEmpreinte` seul,
 * ou rien du tout) — un champ absent ou mal formé rend simplement `journal:null`,
 * jamais une exception : un état périmé ne doit jamais faire pendre le hook.
 */
function lireEtat(chemin) {
  if (!existsSync(chemin)) return { horodatages: [], journal: null, corrompu: false };
  let j;
  try {
    j = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch {
    // 🔴 JSON ILLISIBLE (texte tronqué, corrompu, ou pas du JSON du tout) —
    // revue de fond, T-20260925-0080, Z3. À DISTINGUER d'une FORME inattendue
    // (JSON valide, champs manquants ou mal typés) : CELLE-LÀ reste tolérée
    // plus bas, silencieusement — c'est le cas légitime d'un ancien format de
    // ce même fichier (témoin dédié). Ici, le fichier ne se laisse même pas
    // PARSER : on ne sait RIEN de ce qui a réellement été écrit. Reconstruire
    // un état VIDE effacerait le journal — et un rejeu du même bloc, croyant
    // n'avoir rien fait, RECRÉERAIT ce qui existe déjà (exactement le défaut
    // D3). `corrompu:true` fait REFUSER `deciderStop` plutôt que deviner.
    return { horodatages: [], journal: null, corrompu: true };
  }
  const horodatages = Array.isArray(j?.horodatages) ? j.horodatages.filter((n) => typeof n === 'number') : [];
  const journalBrut = j?.journal;
  const journal = (journalBrut && typeof journalBrut.empreinte === 'string' && Array.isArray(journalBrut.etapes))
    ? { empreinte: journalBrut.empreinte, etapes: journalBrut.etapes.filter((e) => typeof e === 'string') }
    : null;
  return { horodatages, journal, corrompu: false };
}

function ecrireEtat(chemin, etat) {
  try {
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, JSON.stringify(etat));
  } catch {
    // Best-effort : une écriture d'état qui échoue ne doit pas faire tomber le
    // verdict déjà rendu — au pire, le plafond suivant sous-comptera, ou un
    // rejeu réécrira ce que le journal aurait sauté.
  }
}

async function main() {
  let requete;
  try {
    requete = JSON.parse(await lireStdin());
  } catch {
    repondre({ systemMessage: "scribe des tâches : entrée du hook illisible — arrêt permis plutôt qu'un verdict non calculé." });
    return;
  }

  const cwd = requete?.cwd || process.cwd();

  let module;
  try {
    for (const p of [join(ICI, 'scribe-taches-decision.js'), join(ICI, '..', '..', 'cli', 'src', 'metier', 'gardes', 'scribe-taches.js')]) {
      if (existsSync(p)) { module = await import(p); break; }
    }
  } catch (e) {
    repondre({ systemMessage: `scribe des tâches : décision introuvable ou illisible sur ce poste (${e?.message ?? 'cause inconnue'}) — arrêt permis.` });
    return;
  }
  if (!module) {
    repondre({ systemMessage: 'scribe des tâches : décision introuvable sur ce poste — arrêt permis.' });
    return;
  }

  const texteAssistant = typeof requete?.last_assistant_message === 'string'
    ? requete.last_assistant_message
    : dernierMessageAssistant(requete?.transcript_path);

  // Court-circuit délibéré, AVANT toute autre lecture : « pas de bloc → silence
  // total, aucun appel réseau, même si la clé manque ». On appelle `extraireBloc`
  // ici plutôt que d'attendre `deciderStop` pour éviter de lire `.demande` ou de
  // construire le transport quand ce n'est même pas nécessaire.
  const extrait = module.extraireBloc(texteAssistant);
  if (!extrait.presence) { repondre({}); return; }

  const contenuDemande = lireFichierDemande(cwd);

  let appeler = null;
  // 🔒 SEUIL DE TEST, DOUBLEMENT GARDÉ — jamais un chemin de production.
  // `SOMTECH_SCRIBE_APPELER_TEST` pointe un module qui exporte `appeler`, et n'est
  // honoré QUE si `NODE_TEST_CONTEXT` est AUSSI présent — le même signal que la
  // cloison d'essais de `ligne-directe/src/cloison.js`, posé UNIQUEMENT par
  // `node --test`, jamais en production. Sans ce seuil, un témoin de bout en
  // bout du fil mince (deux VRAIS lancements du process, même fichier d'état) ne
  // peut atteindre AUCUN double : `transportServiceDesk()` refuse tout appel
  // réseau sous `NODE_TEST_CONTEXT` (la cloison), par construction — et c'est
  // voulu, pas contourné : ce seuil bypasse `transportServiceDesk` lui-même
  // plutôt que de désarmer sa cloison.
  if (process.env.NODE_TEST_CONTEXT && process.env.SOMTECH_SCRIBE_APPELER_TEST) {
    try {
      const mod = await import(process.env.SOMTECH_SCRIBE_APPELER_TEST);
      appeler = typeof mod.appeler === 'function' ? mod.appeler : null;
    } catch {
      appeler = null;
    }
  } else {
    try {
      const { transportServiceDesk } = await import(join(ICI, '..', 'ligne-directe', 'src', 'mandat.js'));
      appeler = transportServiceDesk();
    } catch {
      appeler = null; // absence de transport = absence de clé/dépendance : jugée par `deciderStop`.
    }
  }

  const N = Number(process.env.SOMTECH_SCRIBE_RELANCES_PAR_HEURE);
  const chemin = cheminEtat(cwd);
  const maintenant = Date.now();
  const { horodatages, journal, corrompu } = lireEtat(chemin);

  let resultat;
  try {
    resultat = await module.deciderStop({
      texteAssistant, contenuDemande, appeler,
      horodatagesRelances: horodatages,
      plafondParHeure: Number.isFinite(N) ? N : undefined,
      maintenant,
      journalPrecedent: journal,
      etatCorrompu: corrompu,
      // ⚠️ FERME LE TROU DU DÉLAI INTERNE (T-20260925-0080, revue de fond, passe 3) :
      // si le minuteur ci-dessus tue le process AU MILIEU du plan d'écritures, cette
      // fonction `deciderStop` ne rend JAMAIS son `journalAEnregistrer` — le process
      // sort par `repondre()`/`process.exit(0)` avant que sa promesse ne se résolve.
      // Ce rappel persiste donc le journal IMMÉDIATEMENT, étape par étape, pendant
      // que le plan tourne encore — la DERNIÈRE écriture réellement réussie est ainsi
      // déjà sur disque quoi qu'il arrive ensuite (délai dépassé, SIGKILL, panne).
      // La persistance finale plus bas reste nécessaire pour les horodatages du
      // plafond et pour un bloc qui échoue sans jamais écrire une seule étape.
      onEtapeReussie: (j) => ecrireEtat(chemin, { horodatages, journal: j }),
    });
  } catch (e) {
    repondre({ systemMessage: `scribe des tâches : panne de décision (${e?.message ?? 'cause inconnue'}) — arrêt permis plutôt qu'un verdict non calculé.` });
    return;
  }

  // Deux champs indépendants du même état : le plafond compte les BLOCKS émis,
  // le journal (D2/D3) retient les étapes du plan RÉELLEMENT réussies, à jour
  // même sur un chemin de refus (échec partiel). L'un peut bouger sans l'autre
  // (un `attend: dirigeant` écrit sans jamais émettre de block).
  //
  // 🔴 SAUF SI L'ÉTAT ÉTAIT CORROMPU (Z3) — alors on n'écrit RIEN ici. Le
  // refus de `deciderStop` (`etatCorrompu`) ne porte jamais `journalAEnregistrer`
  // (il refuse avant d'y toucher) : sans cette garde, l'écriture ci-dessous
  // ÉCRASERAIT le fichier corrompu par un état neuf (`journal:null`) — la
  // preuve de corruption disparaîtrait, et LE PROCHAIN tour redémarrerait
  // silencieusement à vide, exactement le doublon que ce refus existe pour
  // empêcher. Le fichier corrompu reste tel quel : un humain le répare ou le
  // supprime — ce n'est pas au hook de deviner à sa place.
  if (corrompu) {
    // rien à écrire : le fichier reste dans l'état où un humain doit le trouver.
  } else if (resultat.blocEmis || resultat.journalAEnregistrer) {
    ecrireEtat(chemin, {
      horodatages: resultat.blocEmis ? [...module.purgerHorodatages(horodatages, maintenant), maintenant] : horodatages,
      journal: resultat.journalAEnregistrer ?? journal,
    });
  }
  repondre(resultat.sortie);
}

main().catch((e) => {
  repondre({ systemMessage: `scribe des tâches : panne avant décision (${e?.message ?? 'cause inconnue'}) — arrêt permis.` });
});

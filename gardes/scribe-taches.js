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

/** Le dernier message `assistant` du transcript JSONL — chaque ligne est un événement. */
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
 * L'état du plafond ET l'empreinte du dernier bloc écrit (D2) — LE MÊME fichier,
 * par lieu. `dernierBlocEmpreinte` reste `null` tant qu'aucune écriture n'a
 * encore réussi.
 */
function lireEtat(chemin) {
  if (!existsSync(chemin)) return { horodatages: [], dernierBlocEmpreinte: null };
  try {
    const j = JSON.parse(readFileSync(chemin, 'utf8'));
    return {
      horodatages: Array.isArray(j?.horodatages) ? j.horodatages.filter((n) => typeof n === 'number') : [],
      dernierBlocEmpreinte: typeof j?.dernierBlocEmpreinte === 'string' ? j.dernierBlocEmpreinte : null,
    };
  } catch { return { horodatages: [], dernierBlocEmpreinte: null }; }
}

function ecrireEtat(chemin, etat) {
  try {
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, JSON.stringify(etat));
  } catch {
    // Best-effort : une écriture d'état qui échoue ne doit pas faire tomber le
    // verdict déjà rendu — au pire, le plafond suivant sous-comptera, ou un
    // rejeu réécrira ce que D2 aurait sauté.
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
  try {
    const { transportServiceDesk } = await import(join(ICI, '..', 'ligne-directe', 'src', 'mandat.js'));
    appeler = transportServiceDesk();
  } catch {
    appeler = null; // absence de transport = absence de clé/dépendance : jugée par `deciderStop`.
  }

  const N = Number(process.env.SOMTECH_SCRIBE_RELANCES_PAR_HEURE);
  const chemin = cheminEtat(cwd);
  const maintenant = Date.now();
  const { horodatages, dernierBlocEmpreinte } = lireEtat(chemin);

  let resultat;
  try {
    resultat = await module.deciderStop({
      texteAssistant, contenuDemande, appeler,
      horodatagesRelances: horodatages,
      plafondParHeure: Number.isFinite(N) ? N : undefined,
      maintenant,
      empreinteDernierBloc: dernierBlocEmpreinte,
    });
  } catch (e) {
    repondre({ systemMessage: `scribe des tâches : panne de décision (${e?.message ?? 'cause inconnue'}) — arrêt permis plutôt qu'un verdict non calculé.` });
    return;
  }

  // Deux champs indépendants du même état : le plafond compte les BLOCKS émis,
  // D2 retient l'empreinte du dernier bloc ÉCRIT AVEC SUCCÈS. L'un peut bouger
  // sans l'autre (un `attend: dirigeant` écrit sans jamais émettre de block).
  if (resultat.blocEmis || resultat.empreinteAEnregistrer) {
    ecrireEtat(chemin, {
      horodatages: resultat.blocEmis ? [...module.purgerHorodatages(horodatages, maintenant), maintenant] : horodatages,
      dernierBlocEmpreinte: resultat.empreinteAEnregistrer ?? dernierBlocEmpreinte,
    });
  }
  repondre(resultat.sortie);
}

main().catch((e) => {
  repondre({ systemMessage: `scribe des tâches : panne avant décision (${e?.message ?? 'cause inconnue'}) — arrêt permis.` });
});

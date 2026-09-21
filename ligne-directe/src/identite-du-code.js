// identite-du-code.js — quel code sert-on, et depuis où ? (T-20260818-0035, + 2 commentaires
// de batiscan).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT
//
// Le veilleur est un processus PERMANENT : une fois né, rien ne le force à relire son propre
// code. Un pack mis à jour sur le poste laisse donc un veilleur en place continuer de servir
// l'ANCIEN — mesuré : trois jours d'écart, et rien ne le disait. Mesuré aussi : un veilleur
// qui tournait depuis un répertoire TEMPORAIRE (`/private/var/folders/…/T/tmp.XXXX/…`) — un
// chemin éphémère est un avertissement, pas une adresse.
//
// Ce module donne au veilleur une manière de MESURER ce qu'il sert, indépendamment de ce
// qu'il croit avoir chargé.
//
// ⚠️ PUR, SANS I/O RÉSEAU. Seule la lecture d'un dossier de fichiers `.js` — jamais un appel
// à Slack, jamais le socket. C'est ce qui le rend appelable à chaque geste `etat` et à chaque
// tour du chien de garde sans rien coûter (de l'ordre de la quarantaine de fichiers).

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Longueur de l'empreinte rendue — assez pour distinguer, assez court pour se lire au journal. */
const LONGUEUR_EMPREINTE = 12;

/**
 * L'empreinte du code sous `dossierSrc` — les `.js` de premier niveau, triés par nom.
 *
 * Non récursif : `src/` de ce dépôt est plat, et un balayage récursif coûterait pour un gain
 * que rien ne réclame ici.
 *
 * ⚠️ JAMAIS UNE EMPREINTE VIDE QUI AURAIT L'AIR D'UNE MESURE. Un dossier illisible ou sans
 * fichier `.js` rend `empreinte: null` avec un `refus` NOMMÉ — jamais le hachage d'un contenu
 * vide, qui se comparerait « identique » à lui-même d'un poste à l'autre sans avoir mesuré
 * quoi que ce soit. « Je n'ai pas pu mesurer » et « c'est vide » ne sont pas le même fait.
 */
export function empreinteDuCode(dossierSrc) {
  let entrees;
  try {
    entrees = readdirSync(dossierSrc);
  } catch (err) {
    return { empreinte: null, fichiers: 0, date: null, refus: `dossier illisible (${dossierSrc}) : ${err?.message || err}` };
  }

  // `*.somtech.bak*` : les dérives sauvegardées par le pack (installGlobalSkills et
  // consorts, voir setup.js) — jamais du code servi, jamais compté.
  const fichiers = entrees.filter((f) => f.endsWith('.js') && !f.includes('.somtech.bak')).sort();

  if (!fichiers.length) {
    return { empreinte: null, fichiers: 0, date: null, refus: `aucun fichier .js dans ${dossierSrc}` };
  }

  const hachage = createHash('sha256');
  let dateLaPlusRecenteMs = 0;
  for (const nom of fichiers) {
    const chemin = join(dossierSrc, nom);
    // Le NOM entre dans le hachage, pas seulement le contenu : échanger le contenu de deux
    // fichiers sans y toucher produirait sinon la même empreinte qu'avant l'échange.
    hachage.update(nom);
    hachage.update(readFileSync(chemin));
    const { mtimeMs } = statSync(chemin);
    if (mtimeMs > dateLaPlusRecenteMs) dateLaPlusRecenteMs = mtimeMs;
  }

  return {
    empreinte: hachage.digest('hex').slice(0, LONGUEUR_EMPREINTE),
    fichiers: fichiers.length,
    date: new Date(dateLaPlusRecenteMs).toISOString(),
  };
}

/**
 * Ce chemin est-il ÉPHÉMÈRE — un dossier temporaire, voué à disparaître avec son processus,
 * jamais une installation ?
 *
 * DEUX ATTRAPES, PAS UNE SEULE. `os.tmpdir()` couvre le cas générique ; le motif littéral
 * `/T/tmp.` couvre le cas RÉEL mesuré par batiscan le 2026-08-20 sur ce poste : macOS résout
 * `/var` vers `/private/var` par un lien, et le chemin que porte le processus n'est donc pas
 * toujours préfixé par ce que `os.tmpdir()` rendrait sur la même machine. Se fier au seul
 * calcul aurait laissé passer très exactement le cas qui a motivé ce lot.
 */
export function estEphemere(chemin) {
  const c = String(chemin ?? '');
  if (!c) return false;
  const racineTmp = tmpdir();
  return c === racineTmp || c.startsWith(`${racineTmp}/`) || c.includes('/T/tmp.');
}

/**
 * L'identité complète du code qu'un veilleur sert : son empreinte, D'OÙ il s'exécute, QUAND
 * ce processus a démarré.
 *
 * `demarreLe` est injectable pour les essais uniquement — aucun appelant de production ne le
 * passe : c'est `new Date()` au moment où le veilleur se construit qui fait foi.
 */
export function identiteDuCode({ dossierSrc, demarreLe = new Date() }) {
  return {
    ...empreinteDuCode(dossierSrc),
    chemin: dossierSrc,
    demarre_le: demarreLe.toISOString(),
    ephemere: estEphemere(dossierSrc),
  };
}

/**
 * L'écart entre ce qu'un veilleur SERT et ce que le poste a INSTALLÉ — nommé, jamais deviné.
 *
 * ⚠️ « JE N'AI PAS PU MESURER » ≠ « À JOUR ». Rendre `perime: false` faute d'empreinte d'un
 * côté déclarerait à jour un veilleur qu'on n'a en réalité jamais pu vérifier — c'est
 * exactement le succès muet que ce lot existe pour fermer, une couche plus haut. Le doute se
 * rend donc `null`, jamais `false`.
 */
export function ecartDeCode(servi, installe) {
  if (!servi?.empreinte || !installe?.empreinte) {
    const refus = servi?.refus || installe?.refus || 'empreinte manquante';
    return { perime: null, motif: `impossible de comparer le code servi au code installé : ${refus}` };
  }
  if (servi.empreinte === installe.empreinte) return { perime: false, motif: null };
  return {
    perime: true,
    motif:
      `le veilleur sert l'empreinte ${servi.empreinte} (code du ${servi.date}), ` +
      `le poste a installé ${installe.empreinte} (code du ${installe.date})`,
  };
}

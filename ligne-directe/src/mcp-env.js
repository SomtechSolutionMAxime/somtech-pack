// mcp-env.js — ce qu'un `.mcp.json` RÉCLAME, et ce qui manque VRAIMENT pour le résoudre.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE MODULE FERME — T-20260815-0023, « l'indice au lieu du fait »
//
// La pose d'un lieu avertissait sur la PRÉSENCE D'UN FICHIER : « ce dépôt ne porte ni `.env`
// ni `.envrc`, l'agent naîtra sans accès au registre ». Elle ne consultait jamais
// `process.env`, et ne savait pas quelles variables le `.mcp.json` du gabarit déclare. Deux
// pannes symétriques, et la seconde est la grave :
//
//   • FAUX POSITIF — un dépôt sans `.env` dont le shell porte déjà les jetons (le cas normal
//     avec `claude-swt`, qui les fournit AU PROCESSUS) était averti pour rien. Un
//     avertissement qui se trompe est un avertissement qu'on cesse de lire ;
//   • FAUX NÉGATIF — un dépôt AVEC un `.env` qui ne déclare pas ce que le `.mcp.json`
//     réclame se taisait. L'agent naissait sans registre, et rien ne le disait.
//
// ⚠️ LE PIÈGE DU CORRECTIF, ET IL EST NOMMÉ DANS LE TICKET : ajouter une consultation de
// `process.env` À CÔTÉ du test de fichier, puis se taire dès que l'un des deux répond. Ça
// remplace un faux positif par un faux négatif — la présence du fichier ne prouve toujours
// RIEN. La seule question posée ici est : « ces variables-là sont-elles résolubles, oui ou
// non ? ». Le fichier n'est pas une réponse ; ce qu'il DÉCLARE en est une.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// CE MODULE NE RÉINVENTE RIEN — IL PORTE `scripts/shell/mcp-env.sh` EN JS
//
// `mcp_env_refs` / `mcp_env_missing` (l. 108-131) font déjà exactement ce travail côté shell,
// et elles ont été écrites au prix d'un défaut vécu : une détection limitée à l'en-tête
// `Authorization` RATAIT `SOMCRAFT_MCP_API_KEY`, qui vit dans la CHAÎNE DE REQUÊTE d'une URL —
// le serveur disparaissait de la session sans un mot (voir `scripts/tests/test-mcp-env.sh`).
// Aucun équivalent JS n'existait. On reconnaît donc `${VAR}` OÙ QU'ELLE SOIT dans le fichier,
// comme le `grep -oE` du shell, plutôt que d'aller la chercher à des emplacements connus.
//
// CE QU'IL FAIT DE PLUS QUE SON JUMEAU SHELL : il consulte aussi les fichiers d'environnement
// du dépôt. Le shell tourne DANS un shell — direnv y a déjà exporté ce qu'il fallait. Ici on
// répond pour un agent qui n'est pas encore né, dans un dépôt qu'on inspecte de l'extérieur :
// une variable déclarée dans le `.env` du dépôt sera bien là quand il naîtra, même si le
// processus qui pose le lieu ne la porte pas.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// CE QU'IL NE FAIT JAMAIS — même garantie que son jumeau shell
// Rendre, journaliser ou laisser fuir la VALEUR d'une variable. Tout ce qui sort d'ici est un
// NOM ou un verdict présent/absent. Ces avertissements finissent imprimés, journalisés, collés
// dans un ticket : une valeur qui s'y glisse est une fuite de secret, pas une maladresse.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fichiers dont le CONTENU peut déclarer des variables, à la racine du dépôt.
 *
 * Déclaré ICI plutôt que dans `lieu-agent.js` (qui le ré-exporte pour ne casser aucun
 * appelant) : c'est ce module qui sait quoi en faire. Deux listes qui disent la même chose
 * divergent au premier correctif — le dépôt a déjà payé ça.
 */
export const FICHIERS_ENV_CONNUS = ['.env', '.envrc'];

/**
 * Le motif d'une référence, porté fidèlement du `grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*\}'` de
 * `mcp-env.sh`. Volontairement AVEUGLE à la structure JSON : en-tête, URL, argument de
 * commande, valeur imbriquée — tout compte. C'est cette cécité qui est la garantie.
 */
const REFERENCE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Une clé d'environnement légale — même filtre que `mcp_env_fill` (`case "$k" in [A-Za-z_]*`). */
const CLE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Lit un fichier texte, ou rend `''`. Illisible vaut absent : on n'établit rien de ce qu'on
 *  n'a pas pu lire — c'est le renversement appliqué partout ailleurs dans ce dépôt. */
function lire(chemin) {
  try {
    return readFileSync(chemin, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Les noms des variables d'environnement que ce `.mcp.json` référence — triés, dédoublonnés.
 *
 * Port de `mcp_env_refs`. Un fichier illisible ou absent rend `[]` : on ne réclame rien au nom
 * d'un fichier qu'on n'a pas lu.
 *
 * @param {string} cheminMcpJson
 * @returns {string[]} des NOMS, jamais de valeurs
 */
export function variablesReferencees(cheminMcpJson) {
  const contenu = lire(cheminMcpJson);
  return [...new Set([...contenu.matchAll(REFERENCE)].map((m) => m[1]))].sort();
}

/**
 * Les noms des variables qu'un fichier d'environnement déclare AVEC UNE VALEUR NON VIDE.
 *
 * Reconnaît les deux formes qui cohabitent dans nos dépôts — `VAR=…` (`.env`) et
 * `export VAR=…` (`.envrc`, direnv) — parce que `FICHIERS_ENV_CONNUS` contient les deux et
 * qu'un contrôle qui n'en lit qu'une rejouerait « une porte sur deux ».
 *
 * ⚠️ UNE DÉCLARATION VIDE NE COMPTE PAS, et c'est le même verdict que `mcp_env_missing` côté
 * shell : une chaîne vide part quand même dans l'en-tête `Authorization`, le serveur répond
 * 401 et disparaît de la session. « Déclarée » n'est pas « utilisable ».
 *
 * ⚠️ CE QU'IL NE SAIT PAS FAIRE, DIT PLUTÔT QUE CACHÉ : un `.envrc` peut appeler `dotenv`,
 * `source_env`, ou calculer une valeur — direnv seul sait exécuter ça, et on n'exécute JAMAIS
 * le contenu d'un dépôt pour répondre à une question de diagnostic. Ces indirections nous
 * échappent, ce qui pourrait produire un avertissement de trop. C'est le sens SÛR de l'erreur :
 * le shell de l'agent, lui, aura vraiment exporté la variable, et l'autre source — le
 * processus — rattrape le cas dès que la session est née sous direnv.
 *
 * @returns {Set<string>} des NOMS, jamais de valeurs
 */
export function variablesDeclareesDans(cheminFichierEnv) {
  const declarees = new Set();
  for (const brute of lire(cheminFichierEnv).split('\n')) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#')) continue;

    const egal = ligne.indexOf('=');
    if (egal < 0) continue; // `export VAR` seul ne déclare aucune valeur

    const cle = ligne.slice(0, egal).replace(/^export\s+/, '').trim();
    if (!CLE.test(cle)) continue;

    // La valeur n'est LUE que pour répondre « vide ou non ». Elle ne sort pas d'ici, et rien
    // dans ce module ne la range dans une structure rendue à l'appelant.
    const valeur = ligne
      .slice(egal + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/s, '$2');
    if (valeur) declarees.add(cle);
  }
  return declarees;
}

/**
 * Tout ce qui, dans ce dépôt, résout une variable — l'environnement du processus ET les
 * fichiers d'environnement, réunis.
 *
 * LES DEUX SOURCES SE COMPLÈTENT, elles ne s'excluent pas : un poste sous `claude-swt` fournit
 * une moitié au processus pendant que le dépôt déclare l'autre dans son `.env`. Exiger une
 * source unique refuserait ce montage parfaitement sain.
 *
 * @returns {Set<string>} des NOMS, jamais de valeurs
 */
export function variablesResolues(depot, { env = process.env, fichiers = FICHIERS_ENV_CONNUS } = {}) {
  const resolues = new Set();
  for (const [cle, valeur] of Object.entries(env)) {
    if (valeur) resolues.add(cle); // vide = non résolue, comme `mcp_env_missing`
  }
  if (depot) {
    for (const f of fichiers) {
      for (const cle of variablesDeclareesDans(join(depot, f))) resolues.add(cle);
    }
  }
  return resolues;
}

/**
 * LA question du ticket, et la seule : parmi ce que ce `.mcp.json` réclame, qu'est-ce qui n'est
 * résoluble NI par l'environnement du processus, NI par un fichier d'environnement du dépôt ?
 *
 * Port de `mcp_env_missing`, élargi aux fichiers du dépôt. Sortie vide = tout est résolu, donc
 * rien à signaler. Un `.mcp.json` sans aucun `${…}` rend `[]` : il n'y a rien à résoudre.
 *
 * @param {string} cheminMcpJson  le `.mcp.json` dont on veut la liste — le FICHIER décide, pas
 *                                une liste écrite en dur : c'est ce qui a fermé T-20260815-0023
 * @param {object} [p]
 * @param {string} [p.depot]      racine du dépôt, pour ses fichiers d'environnement
 * @param {object} [p.env]        l'environnement à consulter (injectable pour les essais)
 * @returns {string[]} des NOMS triés, jamais de valeurs
 */
export function variablesManquantes(cheminMcpJson, { depot, env = process.env, fichiers = FICHIERS_ENV_CONNUS } = {}) {
  const resolues = variablesResolues(depot, { env, fichiers });
  return variablesReferencees(cheminMcpJson).filter((v) => !resolues.has(v));
}

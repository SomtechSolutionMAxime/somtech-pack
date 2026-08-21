// activite-session.js — LA PREUVE D'ACTIVITÉ QUI PEUT RÉELLEMENT SURVENIR (T-20260821-0009).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE
//
// Le dispositif de réveil jugeait ses livraisons sur `herdr agent prompt … --wait --until
// working`, et sur le `agent_status` que herdr rend. **Ces deux témoins sont morts.**
//
// MESURÉ SUR CE POSTE le 2026-08-21, contrôle positif inclus :
//
//   herdr agent list        →  83 agents,  agent_status = « idle »  pour les 83.  Zéro `working`.
//   ~/.claude/sessions/*    →  146 fichiers,  status ∈ { idle 143 · waiting 1 · busy 1 · shell 1 }
//
//   Et un flagrant délit d'appariement : le pane `w26:p28` rendait `idle` chez herdr pendant
//   que SON PROPRE fichier de session disait `waiting`. La session de cet agent-ci rendait
//   `busy` au moment même où elle exécutait la commande qui interrogeait herdr.
//
// `--until working` guette donc une transition vers un état que la surface interrogée ne
// produit jamais. La condition ne peut pas survenir : le dispositif ne pouvait pas constater
// un succès, quoi qu'il arrive réellement au destinataire.
//
// ⚠️ CE N'EST PAS UNE MESURE D'ACTIVITÉ QU'IL FALLAIT INVENTER — C'EST LA BONNE QU'IL FALLAIT
// LIRE. Elle existait déjà, à côté, dans les fichiers de session de Claude Code.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE PIÈGE QUE CE FICHIER DOIT ÉVITER, ET C'EST LE MÊME QUE CELUI QU'IL CORRIGE
//
// Une sonde a DEUX façons de ne rien montrer :
//
//   • elle regarde, et il n'y a pas d'activité              → c'est une DÉCISION
//   • elle ne peut pas regarder — source absente, fichier   → c'est un SILENCE, et il ne
//     illisible, identifiant introuvable                      décide rien du tout
//
// Les deux produisent « pas de preuve ». Les confondre, c'est réinstaller le défaut d'origine
// sous un autre nom : un juge aveugle qui rend un verdict bien formé.
//
// D'où TROIS états, jamais deux. `INDETERMINEE` n'est pas une commodité défensive : c'est le
// seul mot qui empêche un silence de se lire comme un constat.
//
// ⚠️ ET LE MOTIF DE CHAQUE SILENCE EST NOMMÉ. Trois causes distinctes rendues sous un même mot,
// c'est exactement ce qui a laissé le défaut d'origine vivre des jours dans un journal que
// personne ne relisait — six lignes « non livré » dont une seule méritait qu'on se lève.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** Où Claude Code tient l'état de ses sessions. Injectable — les essais n'écrivent pas ici. */
export const RACINE_SESSIONS = join(homedir(), '.claude', 'sessions');

/**
 * LES TROIS ÉTATS, et le troisième est celui qui protège.
 *
 * `INDETERMINEE` ne veut pas dire « probablement au repos ». Il veut dire « je n'ai pas
 * regardé », et un juge doit le traiter comme une absence de témoin, pas comme un témoin qui
 * dit non.
 */
export const ACTIVITE = Object.freeze({
  TRAVAIL: 'travail',
  REPOS: 'repos',
  INDETERMINEE: 'indeterminee',
});

/**
 * POURQUOI LA SONDE EST MUETTE — un mot par cause, jamais un mot pour toutes.
 *
 * Elles n'appellent pas la même action : un identifiant absent est un défaut d'annuaire
 * `herdr` (hors de notre code), un fichier absent est une session que la source ne connaît
 * pas, une source absente est une installation incomplète sur ce poste.
 */
export const SILENCES = Object.freeze({
  SANS_IDENTIFIANT: 'sans-identifiant-de-session',
  SOURCE_INTROUVABLE: 'source-des-sessions-introuvable',
  SANS_FICHIER: 'aucun-fichier-ne-porte-cet-identifiant',
  ETAT_INCONNU: 'etat-de-session-non-reconnu',
});

/**
 * LES QUATRE STATUTS RÉELS DE LA SOURCE, rangés — mesurés, pas devinés.
 *
 * ⚠️ `waiting` COMPTE COMME DU TRAVAIL, et ce n'est pas une facilité. Une session qui a pris un
 * brief, lancé une commande, et attend qu'on approuve un dialogue A PRIS LE BRIEF. La ranger
 * au repos ferait déclarer non livré précisément l'agent qui a le mieux obéi.
 *
 * ⚠️ ET UN STATUT QU'ON NE CONNAÎT PAS NE SE RANGE PAS AU REPOS. C'est la ligne où le défaut
 * d'origine se réinstallerait : « je ne reconnais pas cet état, donc il ne travaille pas » est
 * exactement le raisonnement de `--until working`. Un état non reconnu est un état non lu.
 */
const AU_TRAVAIL = Object.freeze(['busy', 'waiting']);
const AU_REPOS = Object.freeze(['idle', 'shell']);

export function etatDeLActivite(statut) {
  if (AU_TRAVAIL.includes(statut)) return ACTIVITE.TRAVAIL;
  if (AU_REPOS.includes(statut)) return ACTIVITE.REPOS;
  return ACTIVITE.INDETERMINEE;
}

/**
 * L'IDENTIFIANT DE SESSION D'UN PANE — sur les DEUX surfaces de herdr, parce qu'il en a deux
 * et qu'elles ne montrent pas la même population.
 *
 * ⚠️ `agent get` rend `agent_not_found` sur les panes que `agent list` ignore, pendant que
 * `pane get` rend leur `agent_session` sans broncher. Mesuré, et documenté au chantier parent :
 * c'est une divergence entre deux surfaces du même outil, pas une perte de donnée.
 *
 * Ne lire que la surface `agent` rendrait cette sonde muette EXACTEMENT sur la population
 * qu'elle vise — les orchestrateurs que le registre ne montre pas. C'est la faute qui a déjà
 * été commise une fois dans ce module (T-20260820-0022), sur un autre champ.
 */
export function identifiantDeSession(reponse) {
  const r = reponse?.result;
  return r?.agent?.agent_session?.value ?? r?.pane?.agent_session?.value ?? null;
}

/**
 * CE QUE LA SOURCE DIT DE CETTE SESSION.
 *
 * @param {?string} sessionId  l'identifiant rendu par herdr, ou `null` s'il n'a rien rendu
 * @param {object} options
 * @param {string} options.racine  où chercher — injectable pour les essais
 * @param {function} options.lister  la sonde, moitié « quels fichiers » — injectable pour la COUPER
 * @param {function} options.lire    la sonde, moitié « que dit ce fichier » — idem
 * @returns {{etat: string, statut: ?string, motif: ?string, horodatage: ?number}}
 *
 * ⚠️ LES DEUX MOITIÉS DE LA SONDE SONT INJECTABLES SÉPARÉMENT, et c'est délibéré. Le critère
 * qui garde ce module exige de la COUPER, pas seulement de la laisser rendre du vide — et une
 * sonde qu'on ne peut couper que d'un seul côté laisse l'autre côté non éprouvé.
 */
export function lireActivite(
  sessionId,
  { racine = RACINE_SESSIONS, lister = (d) => readdirSync(d), lire = (f) => readFileSync(f, 'utf8') } = {}
) {
  if (!sessionId) {
    return { etat: ACTIVITE.INDETERMINEE, statut: null, horodatage: null, motif: SILENCES.SANS_IDENTIFIANT };
  }

  let fichiers;
  try {
    fichiers = lister(racine).filter((f) => f.endsWith('.json'));
  } catch (err) {
    // ⚠️ LA SONDE COUPÉE REND SON PROPRE MOT. Si elle rendait « aucun fichier », on lirait
    // « cette session n'existe pas » d'une source qu'on n'a jamais ouverte.
    return {
      etat: ACTIVITE.INDETERMINEE,
      statut: null,
      horodatage: null,
      motif: `${SILENCES.SOURCE_INTROUVABLE} (${err.message})`,
    };
  }

  let echecDeLecture = null;
  for (const f of fichiers) {
    let d;
    try {
      d = JSON.parse(lire(join(racine, f)));
    } catch (err) {
      // Un fichier corrompu est UN fichier de moins, jamais une réponse. On retient le premier
      // échec au cas où aucun autre ne réponde : sans lui, une source entièrement illisible se
      // rendrait « session inconnue », qui envoie chercher au mauvais endroit.
      echecDeLecture ??= err.message;
      continue;
    }
    if (d?.sessionId !== sessionId) continue;

    const etat = etatDeLActivite(d.status);
    return {
      etat,
      statut: d.status ?? null,
      horodatage: d.statusUpdatedAt ?? d.updatedAt ?? null,
      motif: etat === ACTIVITE.INDETERMINEE ? `${SILENCES.ETAT_INCONNU} (« ${d.status} »)` : null,
    };
  }

  return {
    etat: ACTIVITE.INDETERMINEE,
    statut: null,
    horodatage: null,
    motif: echecDeLecture
      ? `${SILENCES.SOURCE_INTROUVABLE} (${echecDeLecture})`
      : SILENCES.SANS_FICHIER,
  };
}

/**
 * LA PREUVE, ÉNONCÉE — un couple avant/après, jamais un état seul.
 *
 * ⚠️ POURQUOI UN COUPLE. C'est la garde que ce module s'est donnée en T-20260814-0138, et elle
 * vaut pour tout témoin : un état vrai AVANT qu'on écrive serait vrai quoi qu'on fasse. Une
 * session déjà au travail ne prouve rien ; seul le PASSAGE du repos au travail porte sur un
 * état qui pouvait être différent.
 */
export function laSessionSestMiseAuTravail(avant, apres) {
  return avant === ACTIVITE.REPOS && apres === ACTIVITE.TRAVAIL;
}

/**
 * LE MOT DU JOURNAL — ce que la sonde a établi, en une ligne lisible par un humain pressé.
 *
 * Rend `null` quand il n'y a rien à dire : la preuve a été faite, elle se lit ailleurs.
 */
export function motDeLActivite({ avant, apres, motifAvant = null, motifApres = null }) {
  if (apres === ACTIVITE.INDETERMINEE || avant === ACTIVITE.INDETERMINEE) {
    const cause = apres === ACTIVITE.INDETERMINEE ? motifApres : motifAvant;
    return `la preuve d’activité n’a pas pu être lue (${cause ?? 'cause non nommée'}) — ce n’est PAS un constat d’inactivité`;
  }
  if (avant === ACTIVITE.TRAVAIL) {
    return 'la session travaillait déjà avant l’envoi — son activité ne prouve rien sur ce brief-ci';
  }
  if (apres === ACTIVITE.REPOS) return 'la session est restée au repos après l’envoi';
  return null;
}

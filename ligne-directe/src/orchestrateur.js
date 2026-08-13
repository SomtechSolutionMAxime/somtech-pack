// orchestrateur.js — le lieu d'un orchestrateur, et ce qui lui est PROPRE.
//
// Le corps de la pose vit dans `lieu-agent.js`, commun aux deux rôles. Ce fichier ne garde
// que ce qui ne vaut QUE pour un orchestrateur : la vérification que sa ligne PEUT s'ouvrir.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI LA VÉRIFICATION N'EST PAS LA MÊME QUE CELLE DU REPRÉSENTANT
//
// Les deux rôles ont désormais la même exigence — **la ligne est obligatoire**, la pose
// refuse sans elle (arbitrage du dirigeant, 2026-08-12, qui CORRIGE ce que la compétence
// disait : « continue sans elle » a disparu du métier). Mais « la ligne peut exister » ne se
// mesure pas de la même façon :
//
//   • un REPRÉSENTANT rejoint un canal qui EXISTE DÉJÀ, privé, où un humain a dû inviter
//     notre robot → on mesure la joignabilité de ce canal-là ;
//   • un ORCHESTRATEUR CRÉE sa ligne au premier geste de son chantier (`ligne-directe ouvrir
//     <chantier>`, canal interne). Il n'y a aucun canal à joindre au moment de la pose. Ce
//     qu'on peut mesurer — et ce qui manque quand ça rate — c'est la capacité du POSTE à en
//     ouvrir un : les deux jetons du trousseau.
//
// Le motif nommé par le métier lui-même est celui-là, mot pour mot : « si elle ne peut pas
// s'ouvrir — jeton absent du poste, par exemple —, tu ne commences pas ».
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LES DEUX JETONS, ET POURQUOI PAS SEULEMENT LE PREMIER
//
// Le jeton du robot fait PARLER ; celui de l'écoute fait ENTENDRE. Un orchestrateur qui
// pourrait poster sans jamais recevoir la réponse du dirigeant est exactement le mode de
// panne que le lot du gestionnaire a nommé : « né sur un canal injoignable, il est muet et
// croit parler ». Ici il serait sourd et croirait dialoguer — et c'est pire pour un rôle dont
// la raison d'être est de faire trancher ce qu'il ne doit pas trancher seul.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUE CE MODULE NE FAIT PLUS JAMAIS, ET CE QUE ÇA A COÛTÉ (T-20260811-0087)
//
// Le septième défaut du gestionnaire était un refus MENTEUR : un jeton parfaitement en place
// était déclaré absent (le compte du trousseau venait d'une variable d'environnement qu'une
// session fraîche ne porte pas), et le message envoyait « déposer » un jeton — donc écraser
// celui qui servait onze lignes. Deux règles en sortent, tenues ici :
//
//   1. **on dit ce qu'on a mesuré**, jamais ce qu'on en conclut. Le message de refus est
//      celui du trousseau lui-même, qui nomme le compte et le service cherchés ;
//   2. **on ne met aucune commande destructrice dans la bouche de personne** — c'est déjà la
//      garantie de `trousseau.js`, et on la relaie telle quelle plutôt que de la reformuler.

import { lireJetons, SERVICE_ROBOT, SERVICE_ECOUTE, JetonVide } from './trousseau.js';
import { preparerLieu } from './lieu-agent.js';

/**
 * Le poste peut-il ouvrir une ligne ?
 *
 * L'accès au trousseau est INJECTÉ (`lire`) pour la même raison que la joignabilité du canal
 * l'est chez le représentant : la cloison (RA-REL-012) interdit qu'une suite de tests
 * approche les vrais jetons — deux veilleurs orphelins sont déjà nés par cette porte, et
 * deux messages du dirigeant sur trois ont été détournés vers l'espace de production. Le
 * défaut de production est `lireJetons`, qui est elle-même cloisonnée.
 *
 * @param {{lire?: () => Promise<{robot: string, ecoute: string}>}} options
 * @returns {Promise<{joignable: boolean, motif?: string, message?: string}>}
 */
export async function verifierLigneOuvrable({ lire = lireJetons } = {}) {
  try {
    await lire();
    return { joignable: true };
  } catch (err) {
    // Le message vient du trousseau : il dit ce qui a été cherché — quel service, sous quel
    // compte — plutôt que d'affirmer une absence. On y ajoute seulement la CONSÉQUENCE, qui
    // est ce que ce module sait et que le trousseau ignore : sans ligne, pas d'orchestrateur.
    return {
      joignable: false,
      motif: err instanceof JetonVide ? 'jeton_vide' : 'jeton_absent',
      message:
        `${err.message}\n` +
        `  Rien n'a été créé : un orchestrateur né sans ligne tranche seul ce qui ne lui appartient pas, ` +
        `ou dort jusqu'à ce que quelqu'un passe — les deux ont été observés.\n` +
        `  Sa ligne lui sert à parler ET à entendre : les deux entrées (« ${SERVICE_ROBOT} » et ` +
        `« ${SERVICE_ECOUTE} ») sont requises. Rétablis celle qui manque, puis relance.`,
    };
  }
}

/**
 * Prépare le lieu d'un orchestrateur dans le dépôt.
 *
 * @param {object} p
 * @param {string} p.depot   racine du dépôt qui reçoit le lieu
 * @param {string} p.nom     nom de l'orchestrateur — dossier sous `.orchestrateur/`
 * @param {() => Promise<{joignable: boolean, motif?: string, message?: string}>} [p.verifierLigne]
 */
export async function preparerLieuOrchestrateur({ depot, nom, verifierLigne = verifierLigneOuvrable }) {
  return preparerLieu({ depot, role: 'orchestrateur', nom, verifierLigne });
}

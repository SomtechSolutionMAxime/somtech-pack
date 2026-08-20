// destinataire.js — RETROUVER L'AGENT À QUI ON PARLE, dans quelque session qu'il vive.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260814-0138)
//
// Un agent se désigne de deux façons : par son pane (`w5:p3`) ou par son NOM (`general`). Le
// nom est celui qu'on emploie, parce que personne ne retient l'identifiant de pane d'un autre —
// et parce qu'un pane change quand une session est relancée, là où le nom reste.
//
// Les deux se cherchent DANS TOUTES LES SESSIONS DU POSTE. `livrer.js` ne connaissait que la
// sienne : il cherchait le destinataire là où, dans le cas normal, il n'est pas.
//
// ⚠️ DEUX REFUS, ET AUCUN DES DEUX N'EST DÉCORATIF.
//
// 1. UN NOM QUE PERSONNE NE PORTE. Le nom est une chaîne libre qu'un humain ou un brief a
//    tapée. Écrire dans un pane qu'on n'a pas vu vivre, c'est écrire dans le vide en croyant
//    avoir parlé — le mode de panne que tout ce lot ferme.
//
// 2. DEUX AGENTS QUI RÉPONDENT À LA MÊME DÉSIGNATION. C'est banal des deux côtés : deux
//    chantiers, deux orchestrateurs nommés `general` — et deux sessions qui portent chacune un
//    pane `w5:p3`, puisqu'un identifiant de pane est INTERNE à sa session. Prendre le premier
//    trouvé livrerait un compte rendu au mauvais chantier, en silence, et l'expéditeur aurait
//    son accusé de réception. Le veilleur de `ligne-directe` refuse déjà les homonymes pour la
//    même raison (`resoudrePair`) ; c'est la même règle.
//
//    ⚠️ CE REFUS DOIT NOMMER LA SORTIE QUAND ELLE EXISTE, ET SE TAIRE QUAND ELLE N'EXISTE PAS
//    (T-20260816-0034) — le détail est au pied de `trouverDestinataire`, là où il se décide.

import { socketsHerdr } from '../../ligne-directe/src/herdr.js';
import { enEssais, refuser } from '../../ligne-directe/src/cloison.js';
import { appelHerdr } from './appel-herdr.js';

/**
 * Un pane herdr s'écrit `w<id>:p<id>` — c'est ce qui distingue un pane d'un nom d'agent.
 *
 * ⚠️ LES DEUX IDENTIFIANTS SONT EN BASE 36, PAS EN DÉCIMAL, et l'avoir supposé rendait cette
 * garde fausse sur près d'un pane sur deux. Mesuré le 2026-08-19 : sur les **213 panes** que
 * `herdr pane list` rendait alors, la forme `w\d+:p\w+` n'en reconnaissait que **113** — les
 * **100 autres** (`wQ:p1`, `w2D:pY`, `w1E:pG`) se faisaient prendre pour des NOMS d'agent, donc
 * cherchés au registre sous une désignation que personne ne porte.
 *
 * ⚠️ ET ELLE NE S'ÉLARGIT PAS JUSQU'À TOUT ACCEPTER : les deux points sont ce qui sépare un pane
 * d'un nom, et les noms de ce poste (rivières, codes de ticket) n'en portent pas. Une forme qui
 * accepterait tout ferait chercher `ristigouche` comme un pane, et son compte rendu partirait
 * dans le vide.
 */
const FORME_PANE = /^w[0-9a-z]+:p[0-9a-z]+$/i;

export function estUnPane(cible) {
  return FORME_PANE.test(String(cible ?? '').trim());
}

/**
 * Les sessions à interroger.
 *
 * `HERDR_SESSIONS_ESSAIS` n'existe que pour les essais : le vrai balayage lit les sockets
 * déposés par les sessions sous `~/.config/herdr/sessions/`, ce qu'un essai ne peut pas
 * fabriquer sans toucher au poste. Sans cette porte, aucun essai ne pourrait éprouver le
 * balayage — et c'est exactement le trou qui a laissé passer le défaut : le chemin des sessions
 * n'était couvert par rien.
 */
export function sessionsDuPoste() {
  // ⚠️ `!== undefined`, PAS UNE VÉRITÉ. Une liste injectée VIDE veut dire « aucune session
  // ouverte » — c'est un état réel, et le refus qui lui répond doit pouvoir être éprouvé.
  // Avec un test de vérité, la chaîne vide retombait sur le balayage du VRAI poste : un
  // essai qui dit « zéro session » mesurait alors les onze qui tournent. Le défaut est de la
  // même famille que ceux que ce fichier existe pour fermer — une porte laissée ouverte par
  // une condition trop lâche (T-20260814-0120).
  const forcees = process.env.HERDR_SESSIONS_ESSAIS;
  if (forcees !== undefined) return forcees.split(':').filter(Boolean);
  // ⚠️ SOUS ESSAIS, ON N'ÉNUMÈRE PAS LES SESSIONS DU POSTE — même en lecture.
  //
  // Onze sessions y tournent avec du travail réel. Un essai qui les balaie devient dépendant
  // de ce qui est ouvert au moment où il tourne : le premier écrit ici a rendu « onze agents
  // répondent à w9:p1 » parce qu'un faux herdr en tête de PATH répondait pour chacune. Un
  // essai dont le verdict dépend de l'état du poste ne prouve rien de stable.
  //
  // Même motif que le refus de lire le trousseau (`trousseau.js`) : la cloison vit dans le
  // code, pas dans les essais, parce que le geste part souvent dans un processus enfant que
  // le fichier d'essai ne contrôle plus.
  if (enEssais()) {
    refuser(
      'l’énumération des sessions herdr du poste',
      'Un essai doit désigner ses sessions par HERDR_SESSIONS_ESSAIS — sans quoi son verdict ' +
        'dépend des sessions réellement ouvertes sur le poste au moment où il tourne.'
    );
  }
  return socketsHerdr();
}

/**
 * Où joindre l'agent visé — `{ok: true, pane, socket, nom, statut}` ou un refus qui dit pourquoi.
 *
 * Le balayage est complet AVANT de conclure, même quand un premier candidat correspond : c'est
 * ce qui permet de voir les homonymes. S'arrêter au premier trouvé aurait rendu le refus n° 2
 * impossible à écrire — et le défaut qu'il ferme invisible.
 */
export async function trouverDestinataire(cible, { appel = appelHerdr } = {}) {
  const vise = String(cible ?? '').trim();
  if (!vise) return { ok: false, message: 'à qui ? — le pane ou le nom de l’agent destinataire est requis' };

  const trouves = [];
  const sessionsMuettes = [];
  for (const socket of sessionsDuPoste()) {
    const r = await appel(['agent', 'list'], { socket });
    if (!r.ok) {
      sessionsMuettes.push(socket);
      continue;
    }
    const agents = r.reponse?.result?.agents || [];
    for (const a of agents) {
      if (a.pane_id === vise || a.name === vise) {
        trouves.push({ pane: a.pane_id, socket, nom: a.name || null, statut: a.agent_status || null });
      }
    }
  }

  if (trouves.length === 1) return { ok: true, ...trouves[0] };

  if (trouves.length > 1) {
    // ⚠️ CE REFUS RENVOYAIT VERS LE GESTE QUI VENAIT D'ÉCHOUER (T-20260816-0034). Il disait
    // « désigne-le par son pane » à quelqu'un qui avait désigné par le pane : un identifiant de
    // pane est une coordonnée INTERNE à une session, deux sessions du poste peuvent porter le
    // même `w5:p3`. Un refus juste dont le conseil est inapplicable coûte autant qu'un échec
    // muet — on rejoue le même geste et on conclut que l'outil est cassé.
    //
    // La sortie existait pourtant, quelques lignes plus haut : la cible est comparée au pane ET
    // au nom. Le refus doit donc NOMMER les agents qu'il a trouvés — c'est ce qui permet de
    // choisir — et montrer la forme de commande qui passe.
    const ou = trouves.map((t) => (t.nom ? `${t.pane} « ${t.nom} » (${t.socket})` : `${t.pane} (${t.socket})`)).join(', ');
    const noms = trouves.map((t) => t.nom);
    const nomsDepartagent = noms.every(Boolean) && new Set(noms).size === noms.length;

    if (nomsDepartagent) {
      const exemples = noms.map((n) => `« ${n} »`).join(' ou ');
      return {
        ok: false,
        message:
          `deux agents ou plus répondent à « ${vise} » — ${ou}. On ne tire pas au sort le ` +
          `destinataire d’un compte rendu : ici leurs NOMS les distinguent, désigne-le par le ` +
          `sien — ${exemples} (gestionnaire-livrer <nom> --texte "…").`,
      };
    }

    // ⚠️ ET QUAND LE NOM NE DÉPARTAGE PAS NON PLUS, ON S'ARRÊTE SANS CONSEIL. Deux agents du
    // même nom, ou sans nom, ne se distinguent par aucune désignation que cette commande
    // accepte. Proposer quand même un geste — une option de session, un socket à passer —
    // reviendrait à refaire, à un mot près, le défaut que ce refus vient de fermer : conseiller
    // un chemin qu'on n'a pas vérifié praticable. Ce qu'on peut dire honnêtement, c'est ce
    // qu'on a vu et que rien n'est parti.
    const raison = noms.every(Boolean)
      ? 'ils portent le même nom'
      : 'ils n’ont pas tous un nom qui les distingue';
    return {
      ok: false,
      message:
        `deux agents ou plus répondent à « ${vise} » — ${ou}. On ne tire pas au sort le ` +
        `destinataire d’un compte rendu, et ${raison} : aucune désignation que cette commande ` +
        'accepte ne les départage. Rien n’a été envoyé.',
    };
  }

  // AUCUN TROUVÉ — et il faut distinguer « il n'existe pas » de « je n'ai rien pu lire ».
  // Une session injoignable ne prouve pas l'absence de l'agent : conclure « introuvable »
  // quand on n'a interrogé personne, c'est conclure d'une absence de mesure à une absence.
  if (sessionsMuettes.length && sessionsMuettes.length === sessionsDuPoste().length) {
    return {
      ok: false,
      message:
        `aucune session herdr n’a répondu (${sessionsMuettes.length} essayée(s)) — impossible de dire ` +
        `où vit « ${vise} », donc impossible de lui parler. Vérifie que herdr tourne.`,
    };
  }
  return {
    ok: false,
    message:
      `aucun agent vivant ne porte « ${vise} » sur ce poste — rien n’a été envoyé. ` +
      'Vérifie le nom (`herdr agent list`), ou désigne-le par son pane.',
  };
}

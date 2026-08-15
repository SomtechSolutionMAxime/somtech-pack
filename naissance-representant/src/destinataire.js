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
// 2. DEUX AGENTS DU MÊME NOM. C'est banal : deux chantiers, deux orchestrateurs nommés
//    `general`. Prendre le premier trouvé livrerait un compte rendu au mauvais chantier, en
//    silence, et l'expéditeur aurait son accusé de réception. Le veilleur de `ligne-directe`
//    refuse déjà les homonymes pour la même raison (`resoudrePair`) ; c'est la même règle.

import { socketsHerdr } from '../../ligne-directe/src/herdr.js';
import { enEssais, refuser } from '../../ligne-directe/src/cloison.js';
import { appelHerdr } from './appel-herdr.js';

/** Un pane herdr s'écrit `w<n>:p<x>` — c'est ce qui distingue un pane d'un nom d'agent. */
const FORME_PANE = /^w\d+:p\w+$/i;

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
    const ou = trouves.map((t) => `${t.pane} (${t.socket})`).join(', ');
    return {
      ok: false,
      message:
        `deux agents ou plus répondent à « ${vise} » — ${ou}. On ne tire pas au sort le ` +
        'destinataire d’un compte rendu : désigne-le par son pane.',
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

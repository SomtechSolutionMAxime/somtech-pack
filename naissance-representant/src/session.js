// session.js — à QUELLE session herdr la naissance parle, et comment elle refuse de deviner.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT (T-20260814-0120)
//
// Onze sessions herdr tournent sur ce poste, chacune avec son propre canal de commande.
// `bin/naitre.js` ne connaissait que `--workspace` : il parlait à la session que
// `HERDR_SOCKET_PATH` désigne — c'est-à-dire, depuis un terminal ordinaire, à AUCUNE.
//
// Deux pannes, les deux vécues le même soir :
//
//   • hors d'un pane → `ConnectionRefused`, un message qui ne nomme pas la cause ;
//   • avec un identifiant d'espace lu dans une AUTRE session → l'espace existe, mais
//     ailleurs. Les identifiants (`w5`, `w8`, `w2W`) ne sont **pas globalement uniques**,
//     et rien ne signalait qu'on désignait le mauvais.
//
// Le contournement imposé au dirigeant, tapé QUATRE FOIS en une soirée :
//
//     HERDR_SOCKET_PATH=~/.config/herdr/sessions/sibelanger/herdr.sock node …/naitre.js …
//
// Un chemin de socket n'est pas de l'ordre de ce qu'un utilisateur devrait connaître.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE PRINCIPE : ON NE DEVINE JAMAIS, ON NE PREND JAMAIS LA PREMIÈRE
//
// Quand plusieurs sessions existent et que rien ne dit laquelle, on REFUSE en les nommant
// toutes. C'est le renversement déjà livré sur le trousseau et sur le routage :
// **l'incertitude tombe du côté prudent**. Ici il n'y a pas d'alternative raisonnable —
// une naissance dans la mauvaise session ne se voit pas à l'œil, elle RÉUSSIT.
//
// ⚠️ LES SESSIONS NE SONT ÉCRITES NULLE PART. Elles vivent sous
// `~/.config/herdr/sessions/`, et le dirigeant en ouvre au fil de l'eau : tout inventaire
// figé se déphaserait au premier ajout. On lit donc ce qui est là, à chaque appel.

import { sessionsDuPoste } from './destinataire.js';

/**
 * Le nom d'une session, lu là où herdr le pose : `…/sessions/<nom>/herdr.sock`.
 *
 * Rendu `null` sur toute autre forme — un socket désigné à la main par `HERDR_SOCKET_PATH`
 * peut vivre ailleurs, et lui inventer un nom serait pire que de n'en donner aucun.
 */
export function nomDeSession(socket) {
  const trouve = String(socket ?? '').match(/[/\\]sessions[/\\]([^/\\]+)[/\\][^/\\]+$/);
  return trouve ? trouve[1] : null;
}

/** Ce qu'on montre à l'humain : les noms qu'il peut donner à `--session`. */
function nomsConnus(sockets) {
  return sockets.map((s) => nomDeSession(s)).filter(Boolean);
}

/**
 * À quelle session parler — `{ok: true, socket, nom}` ou un refus qui dit quoi taper.
 *
 * L'ORDRE DES RÈGLES EST LE FOND DU CORRECTIF :
 *
 *   1. `--session <nom>` **prime sur tout**, y compris sur le pane courant. Un agent qui
 *      fait naître ailleurs que chez lui est le cas NORMAL, pas l'exception : si le pane
 *      l'emportait, l'option serait décorative précisément là où elle sert.
 *   2. sinon, `HERDR_SOCKET_PATH` — lancé depuis un pane, l'environnement dit déjà tout, et
 *      ce cas marchait déjà. Il continue de marcher sans rien préciser.
 *   3. sinon, une seule session ouverte : il n'y a rien à trancher.
 *   4. sinon — zéro session, ou plusieurs — REFUS.
 */
export function sessionVisee({ nomVoulu = null } = {}) {
  const sockets = sessionsDuPoste();

  if (nomVoulu) {
    const voulu = sockets.find((s) => nomDeSession(s) === nomVoulu);
    if (voulu) return { ok: true, socket: voulu, nom: nomVoulu };
    const noms = nomsConnus(sockets);
    return {
      ok: false,
      message:
        `aucune session herdr ne s'appelle « ${nomVoulu} » sur ce poste. ` +
        (noms.length
          ? `Celles qui existent : ${noms.join(', ')}.`
          : `Aucune session n'est ouverte — démarre herdr, ou lance ce geste depuis un pane.`),
    };
  }

  const duPane = process.env.HERDR_SOCKET_PATH;
  if (duPane) return { ok: true, socket: duPane, nom: nomDeSession(duPane) };

  if (sockets.length === 1) return { ok: true, socket: sockets[0], nom: nomDeSession(sockets[0]) };

  if (sockets.length === 0) {
    return {
      ok: false,
      message:
        "aucune session herdr n'est ouverte sur ce poste — il n'y a nulle part où faire " +
        'naître un agent. Démarre herdr, ou lance ce geste depuis un pane.',
    };
  }

  // Le cas du ticket. On NOMME toutes les sessions : sans ça, il faut aller les chercher
  // ailleurs, et c'est exactement le chemin qui a produit un identifiant d'espace pris dans
  // la mauvaise session.
  return {
    ok: false,
    message:
      `${sockets.length} sessions herdr tournent sur ce poste, et rien ne dit dans laquelle ` +
      `faire naître cet agent. Je ne devine pas — une naissance dans la mauvaise session ` +
      `RÉUSSIT, et ne se voit pas.\n` +
      `  Désigne-la : --session <nom>\n` +
      `  Celles qui existent : ${nomsConnus(sockets).join(', ')}`,
  };
}

/**
 * L'espace visé appartient-il bien à la session visée ?
 *
 * C'EST CE CONTRÔLE QUI FERME LA PANNE SILENCIEUSE. Les identifiants d'espace ne sont pas
 * globalement uniques : `w2W` existe dans `somtech` ET ailleurs. Donner celui d'une session
 * pour une naissance dans une autre produit soit un échec obscur, soit — le cas grave — une
 * naissance parfaitement réussie **au mauvais endroit**.
 *
 * ⚠️ CE QU'IL NE PEUT PAS FAIRE, et il faut le dire : si l'identifiant existe dans les DEUX
 * sessions, rien ici ne distingue celui qu'on voulait de celui qu'on a. On rend donc aussi
 * le libellé de l'espace, pour que l'humain reconnaisse — ou ne reconnaisse pas — le sien.
 *
 * @returns {{ok: true, libelle: ?string} | {ok: false, message: string}}
 */
export function espaceDeLaSession(reponseWorkspaceList, { espace, session }) {
  const espaces = reponseWorkspaceList?.result?.workspaces;
  if (!Array.isArray(espaces)) {
    return {
      ok: false,
      message:
        `la session ${session ? `« ${session} »` : 'visée'} n'a pas rendu la liste de ses ` +
        `espaces — on ne peut donc pas établir que « ${espace} » lui appartient, et faire ` +
        `naître sans le savoir est précisément ce qu'on refuse.`,
    };
  }

  const trouve = espaces.find((e) => e?.workspace_id === espace);
  if (trouve) return { ok: true, libelle: trouve.label ?? null };

  const apercu = espaces
    .slice(0, 12)
    .map((e) => `${e.workspace_id}${e.label ? ` (${e.label})` : ''}`)
    .join(', ');
  return {
    ok: false,
    message:
      `l'espace « ${espace} » n'existe pas dans la session ` +
      `${session ? `« ${session} »` : 'visée'} — il vient probablement d'une autre : les ` +
      `identifiants d'espace se ressemblent d'une session à l'autre et ne sont pas uniques.\n` +
      `  Les siens : ${apercu}${espaces.length > 12 ? `, … (${espaces.length} en tout)` : ''}`,
  };
}

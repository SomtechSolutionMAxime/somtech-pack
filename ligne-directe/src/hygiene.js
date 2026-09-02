// hygiene.js — LE REGISTRE CESSE DE MENTIR, IL N'EST PAS FILTRÉ (T-20260816-0083).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT
//
// Une ligne dont le worktree a disparu du disque reste ouverte au registre, attachée à un
// numéro de pane que le poste peut réattribuer à n'importe quel chantier. Le prochain occupant
// hérite alors d'une ligne ouverte pour un client dont il n'a jamais entendu parler.
//
//   > Une ligne qu'on abandonne sans la refermer ne reste pas inerte : elle attend le
//   > prochain occupant du numéro. — `T-20260816-0003`
//
// MESURÉ sur le registre du poste le 2026-08-16, et cette mesure a dû être REFAITE : le premier
// compte annonçait « 2 lignes ouvertes sur 42 » en filtrant sur un champ qui n'existe pas au
// registre (`fermee_le`) — donc en ne filtrant rien. Sur le vrai champ (`close_le`) : **25
// lignes ouvertes, aucune au chantier disparu** ; les 2 lignes concernées sont **closes**.
//
// ⚠️ CE QUE ÇA CHANGE, ET IL FAUT LE DIRE : le mécanisme est réel — une ligne ouverte qu'on
// n'a pas refermée attend le prochain occupant de son pane — mais AUCUNE occurrence vivante
// n'est observée aujourd'hui. Cette passe est une prévention, pas la réponse à un incident en
// cours. Elle coûte une lecture de registre par ronde et ne se déclenche que sur preuve.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI UNE HYGIÈNE ET PAS UN FILTRE — l'arbitrage, et sa raison
//
// La première écriture posait la garde dans `ligneDuPane` : la ligne morte cessait d'être
// proposée. Ça marchait, et c'était la mauvaise place.
//
// **Un filtre à la sélection laisse le registre DIRE que la ligne est ouverte pendant qu'on la
// cache.** Deux sources de vérité qui divergent en silence — le motif exact que ce dépôt paie
// le plus cher, et qu'il a passé deux jours à fermer ailleurs. Une passe d'hygiène fait que le
// registre **cesse de mentir** au lieu d'en corriger la lecture : on soigne le fait, pas sa
// lecture.
//
// Un second symptôme le confirmait : brancher le disque dans la sélection faisait rougir 26
// essais dont les registres portent des chemins inventés. Ce n'est PAS la raison du choix —
// une garde bien placée mérite qu'on paie son nettoyage — mais c'est ce qui a fait regarder.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CETTE PASSE NE FAIT PAS
//
// ⚠️ ELLE SIGNALE, ELLE NE FERME RIEN. Refermer une ligne à tort ferait taire un canal client.
// C'est la même règle que la ronde et la vigie : on nomme, on ne force pas. Et conformément à
// l'invariant de `T-20260816-0045`, ce signalement **nomme sa sortie** — la commande exacte qui
// referme la ligne, et l'endroit d'où elle doit être lancée.
//
// ⚠️ ON N'ÉCARTE QUE SUR PREUVE. Un chemin qu'on n'a pas pu lire n'est pas un chemin absent.
// Un worktree non enregistré, vide, ou illisible ne prouve RIEN et ne fait rien signaler. C'est
// la même distinction que « boîte vide » et « message livré » — et l'erreur que le correctif de
// `T-20260816-0003` a déjà payée vingt essais rouges, en rendant des lignes injoignables au nom
// d'une absence de donnée.

import { porteursDeLigne } from './registre.js';
// ⚠️ LA MÊME JOINTURE D'ESPACE QUE `declaration-des-agents.js`, PAS UNE SECONDE ÉCRITURE — elle
// résout les liens symboliques des deux côtés (`/tmp` contre `/private/tmp` sur macOS) et fait
// du séparateur, jamais du préfixe, la frontière d'un espace. Une expression réécrite ici
// divergerait au premier correctif appliqué d'un seul côté, et ferait manquer un successeur
// né exactement sur la machine qui a mesuré ce défaut (T-20260826-0068).
import { memeEspaceDeTravail } from '../../naissance-representant/src/garde-des-naissances.js';

/**
 * Le geste qui referme une ligne — avec sa CONDITION, parce qu'elle décide s'il marche.
 *
 * ⚠️ CE GESTE NE MARCHE PAS TOUJOURS, ET LE TAIRE SERAIT LE DÉFAUT QU'ON FERME. Relevé en revue
 * de fond, par un REFUS : `fermer` passe par la même sélection que `dire`, donc par la garde de
 * session de `T-20260816-0035` — une ligne n'est candidate que si le socket courant concorde
 * avec le sien. Reproduit contre le vrai sélecteur : socket A au registre, socket B au pane,
 * et `ligneDuPane` rend `{ ligne: null, refus: aucune_ligne }`.
 *
 * Autrement dit : **si le pane a été repris par une AUTRE session herdr, aucune commande ne
 * referme cette ligne** — et c'est précisément le cas que ce lot décrit, « un numéro de pane
 * que le poste réattribue ». Conseiller la commande sans sa condition enverrait quelqu'un se
 * faire répondre « aucune ligne ouverte depuis ce pane » : un avis qui nomme une sortie qu'on
 * ne peut pas emprunter, c'est-à-dire `T-20260816-0045` retourné contre son propre auteur.
 *
 * On nomme donc la commande, l'endroit, **la session**, et ce qui se passe quand elle a changé.
 */
export function gesteDeFermeture(ligne) {
  const chantier = ligne?.chantier ?? '';
  const pane = ligne?.pane ?? null;
  const session = typeof ligne?.herdr_socket === 'string' ? ligne.herdr_socket : null;
  const commande = `ligne-directe fermer --a ${chantier}`;
  if (!pane) return `\`${commande}\` (depuis le pane qui porte cette ligne)`;
  const ou = session
    ? `depuis le pane « ${pane} » de la session « ${session} »`
    : `depuis le pane « ${pane} »`;
  return (
    `${ou} : \`${commande}\` — et SEULEMENT de là : si ce pane est passé à une autre session ` +
    `herdr, la ligne n'y est plus candidate et aucune commande ne la referme ; elle doit être ` +
    `ôtée du registre à la main.`
  );
}

/**
 * Les lignes ouvertes dont le chantier a disparu du disque — et rien d'autre.
 *
 * `chantierExiste` est INJECTÉ : ce module rend un jugement, il ne va pas chercher le disque
 * de lui-même. C'est ce qui le rend éprouvable sans monter un poste, et ce qui garantit qu'il
 * ne s'active pas tout seul là où personne ne le lui a demandé.
 */
export function lignesAuChantierDisparu(ouvertes, { chantierExiste } = {}) {
  // ⚠️ CETTE LIGNE-CI EST REDONDANTE AVEC LE FILET plus bas, et il faut le dire : sans
  // prédicat, l'appel lèverait et le `catch` rendrait `false` — donc rien ne serait signalé de
  // toute façon. Relevé en revue de fond, qui l'a mutée sans faire rougir un seul essai. On la
  // garde pour l'intention — se taire faute de moyen de constater n'est pas la même chose que
  // se taire parce qu'un appel a échoué — mais on ne la compte pas comme une garde prouvée.
  if (typeof chantierExiste !== 'function') return [];
  return (ouvertes || [])
    .filter((l) => {
      const w = typeof l?.worktree === 'string' ? l.worktree.trim() : '';
      if (!w) return false; // pas de worktree connu : aucune preuve, aucun signalement
      try {
        return !chantierExiste(w);
      } catch {
        return false; // un chemin qu'on n'a pas pu interroger n'est pas un chemin absent
      }
    })
    .map((l) => ({
      chantier: l.chantier ?? null,
      canal_nom: l.canal_nom ?? null,
      pane: l.pane ?? null,
      worktree: l.worktree,
      geste: gesteDeFermeture(l),
    }));
}

/**
 * Ce qu'on écrit à un humain — ce qui bloque, avec les valeurs trouvées, et le geste qui lève.
 *
 * Rend `null` quand il n'y a rien à dire : une passe d'hygiène qui parle pour ne rien dire
 * finit par n'être plus lue, et emporte avec elle le jour où elle avait raison.
 */
export function avisDHygiene(mortes) {
  if (!mortes?.length) return null;
  const lignes = mortes.map(
    (m) => `  • « ${m.chantier} » (#${m.canal_nom}) — chantier disparu : ${m.worktree}\n    → ${m.geste}`
  );
  return (
    `${mortes.length} ligne(s) ouverte(s) pointent vers un chantier qui n'existe plus. Elles ` +
    `attendent le prochain occupant de leur pane, avec un canal ouvert pour un autre client :\n` +
    `${lignes.join('\n')}\n` +
    `Rien n'a été fermé — refermer une ligne à tort ferait taire un canal client.`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE SYMÉTRIQUE, UN ÉTAGE PLUS HAUT — LE CHANTIER EXISTE, LE PANE N'Y EST PLUS (T-20260826-0068)
//
// `lignesAuChantierDisparu` ci-dessus détecte un worktree absent du disque. Six lignes réelles
// montrent une panne voisine mais distincte : le chantier existe encore, le terminal qui le
// portait n'est plus dans sa session. Trois états, jamais deux : « présent », « disparu », et
// « muette » (la session ne répond pas — on n'a rien constaté, on ne conclut rien).
//
// ⚠️ ET UN PANE DISPARU N'EST PAS UN AGENT MORT. Le pane change d'identifiant à la renaissance
// (mesuré : `w8X:p2` → `w8X:pZ`, sur un successeur né dans le même espace de travail). Avant de
// proposer le geste de fermeture, on mesure donc si un AUTRE pane vivant de la même session
// porte désormais le MÊME espace — et si oui, on NOMME ce pane, on NE PROPOSE PAS de fermer.
// Refermer une ligne dont l'agent est vivant ailleurs le couperait du dirigeant.

/**
 * Les lignes ouvertes dont le PANE a disparu — le chantier existe, le terminal non.
 *
 * `etatDuPane` et `panesDeLaSession` sont INJECTÉS, même contrat que `chantierExiste` plus
 * haut : ce module rend un jugement, il ne va pas interroger herdr lui-même.
 *
 *   • `etatDuPane(pane, socket)` → `'present'` ou `'disparu'` ; une levée est lue comme une
 *     session MUETTE — on n'a rien constaté du tout, distinct d'un pane constaté absent.
 *   • `panesDeLaSession(socket)` → les panes vivants de cette session (forme `herdr pane
 *     list`) ; n'est appelée QUE pour chercher un successeur, jamais pour l'état lui-même.
 *
 * Chaque PORTEUR (`porteursDeLigne`) est mesuré séparément, dans SA session — la même raison
 * que `porteursDeLigne` documente : un porteur sans socket connu n'est jamais rattaché à celui
 * d'un autre.
 */
export async function lignesAuPaneDisparu(ouvertes, { etatDuPane, panesDeLaSession } = {}) {
  if (typeof etatDuPane !== 'function') return [];
  const resultats = [];
  for (const ligne of ouvertes || []) {
    for (const porteur of porteursDeLigne(ligne)) {
      let etat;
      try {
        etat = await etatDuPane(porteur.pane, porteur.socket);
      } catch {
        etat = 'muette';
      }
      if (etat === 'present') continue;
      if (etat !== 'disparu' && etat !== 'muette') continue; // état inconnu : on ne conclut rien

      const base = {
        chantier: ligne.chantier ?? null,
        canal_nom: ligne.canal_nom ?? null,
        pane: porteur.pane,
        worktree: ligne.worktree ?? null,
      };

      if (etat === 'muette') {
        // ⚠️ AUCUN GESTE SUR UNE MUETTE : on n'a rien constaté, proposer une fermeture serait
        // conclure sur une panne de mesure — exactement le défaut que `panes()`/`vivant()`
        // existent pour fermer un étage plus bas.
        resultats.push({ ...base, etat: 'muette', successeur: null, geste: null });
        continue;
      }

      // etat === 'disparu' : le pane est constaté absent. Cherche un successeur AVANT de
      // proposer quoi que ce soit — la cause se mesure avant que le geste se pose.
      let successeur = null;
      if (ligne.worktree && typeof panesDeLaSession === 'function') {
        try {
          const vivants = await panesDeLaSession(porteur.socket);
          const trouve = (vivants || []).find(
            (p) =>
              p.pane_id !== porteur.pane &&
              memeEspaceDeTravail(p.foreground_cwd || p.cwd || null, ligne.worktree)
          );
          if (trouve) successeur = trouve.pane_id;
        } catch {
          // La mesure du successeur a échoué : on ne le sait pas, on ne l'affirme pas — mais
          // ça ne fait PAS retomber « disparu » en « muette » : le pane, lui, EST constaté
          // absent, et c'est une mesure distincte de celle du successeur.
        }
      }

      resultats.push({
        ...base,
        etat: successeur ? 'disparu_renaissance_probable' : 'disparu',
        successeur,
        geste: successeur ? null : gesteDeFermeture({ chantier: ligne.chantier, pane: porteur.pane, herdr_socket: porteur.socket }),
      });
    }
  }
  return resultats;
}

/**
 * Ce qu'on écrit à un humain — les trois états, jamais confondus dans le texte non plus.
 *
 * Rend `null` quand il n'y a rien à dire, même règle qu'`avisDHygiene` : un avis qui parle
 * pour ne rien dire finit par n'être plus lu.
 */
export function avisDesPanesDisparus(constats) {
  if (!constats?.length) return null;
  const lignes = constats.map((c) => {
    if (c.etat === 'muette') {
      return `  • « ${c.chantier} » (#${c.canal_nom}), pane « ${c.pane} » — session MUETTE : rien n'a pu être constaté, aucune conclusion.`;
    }
    if (c.etat === 'disparu_renaissance_probable') {
      return (
        `  • « ${c.chantier} » (#${c.canal_nom}), pane « ${c.pane} » — disparu, mais un successeur ` +
        `probable vit désormais sur « ${c.successeur} » (même espace de travail). Rien n'est fermé : ` +
        `vérifier que la ligne doit être reprise sur ce nouveau pane plutôt que refermée.`
      );
    }
    return `  • « ${c.chantier} » (#${c.canal_nom}), pane « ${c.pane} » — disparu : ${c.worktree}\n    → ${c.geste}`;
  });
  return (
    `${constats.length} ligne(s) ouverte(s) désignent un pane qui n'existe plus (ou une session ` +
    `qui ne répond pas) :\n${lignes.join('\n')}\n` +
    `Rien n'a été fermé — refermer une ligne à tort ferait taire un canal client.`
  );
}

#!/usr/bin/env node
// etat-boite.js — DIRE L'ÉTAT D'UNE BOÎTE DE SAISIE, nommé, sans rien y toucher.
//
//   gestionnaire-etat-boite <pane|nom-d-agent>
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CETTE COMMANDE EXISTE — SIX HEURES, LE MÊME JOUR (E-20260819-0015)
//
// Le 2026-08-19, DEUX orchestrateurs ont perdu ~3 heures CHACUN, séparément, sur des boîtes
// qu'ils croyaient bloquées. Elles étaient vides : ce qu'ils lisaient était une SUGGESTION
// grisée de Claude Code — le rappel d'un message déjà envoyé. Chacun a remonté trois fois au
// dirigeant un geste qui n'avait aucun objet ; l'un a inscrit huit occurrences d'un « défaut de
// canal » dont personne ne sait combien étaient réelles. C'est le dirigeant qui les a corrigés
// tous les deux — parce qu'il avait l'écran physique, et eux une lecture réseau.
//
// 🔴 CE N'ÉTAIT PAS DE L'INATTENTION, ET C'EST TOUT LE SUJET. Le geste que les textes de ce
// dépôt prescrivaient — `herdr pane read "$P"` — rend le MÊME écran pour une suggestion et pour
// un texte saisi. La seule mesure qui les sépare (`--format ansi | cat -v`, chercher `[2m`)
// demande de décoder du SGR à la main, et personne n'a de raison de la taper avant d'avoir été
// trompé une fois. **Un lecteur ne devrait pas avoir à décoder du SGR pour savoir s'il y a du
// texte** — c'est la formulation du lot, et c'est ce que cette commande rend inutile.
//
// ⚠️ ELLE NE TOUCHE À RIEN. Pas de touche, pas d'écriture, aucun geste : elle est faite pour
// être tapée sur le pane de quelqu'un d'autre, ce qui est précisément le cas où l'on hésite.
//
// ⚠️ ET ELLE NE DÉGUISE PAS SON IGNORANCE. Une boîte qu'on n'a pas su lire rend `illisible` et
// un code de sortie NON NUL — jamais « vide » : les deux appellent des conduites opposées, et
// un appelant qui enchaîne doit s'arrêter là.

import { trouverDestinataire, estUnPane, sessionsDuPoste } from '../src/destinataire.js';
import { lireEcran } from '../src/appel-herdr.js';
import { appelHerdr } from '../src/appel-herdr.js';
import { etatDeLaBoite, ETATS_BOITE, riensASoumettre } from '../../ligne-directe/src/boite.js';

/** Ce que chaque état veut dire pour celui qui allait poser un geste. */
const CONDUITE = {
  [ETATS_BOITE.VIDE]: 'boîte VIDE — rien dedans, rien de proposé : on peut y livrer',
  [ETATS_BOITE.SUGGESTION]:
    'boîte VIDE derrière une SUGGESTION grisée — il n’y a RIEN à soumettre. ' +
    'Ce que tu vois à l’écran est une proposition de l’éditeur, pas un texte saisi : ' +
    'aucune touche d’envoi n’a d’objet ici, et rien n’est bloqué',
  [ETATS_BOITE.COLLEE]:
    'boîte PLEINE — un texte COLLÉ y attend (l’écran n’en montre qu’un repli). ' +
    'On n’écrit pas par-dessus : `livrer.js` sait la délivrer sans l’écraser',
  [ETATS_BOITE.SAISIE]:
    'boîte PLEINE — un texte saisi en clair y attend. ' +
    'On n’écrit pas par-dessus : `livrer.js` sait la délivrer sans l’écraser',
  [ETATS_BOITE.ILLISIBLE]:
    'boîte ILLISIBLE — on n’a pas reconnu l’écran. Ce n’est PAS une boîte vide : ' +
    'va la regarder toi-même, ou bien le format a changé et c’est un défaut à inscrire',
};

/**
 * OÙ EST LA BOÎTE — et pourquoi le registre ne suffit pas (T-20260819-0121).
 *
 * 🔴 LE REGISTRE MENT SUR LES AGENTS NEUFS. Mesuré le 2026-08-19, trois naissances, deux
 * orchestrateurs indépendants : `herdr agent get` rend `agent_not_found` sur un pane qui
 * TRAVAILLE, pendant que `herdr pane read` rend son écran à l'instant. Une commande de
 * diagnostic qui exigerait un agent au registre serait donc aveugle exactement là où l'on doute
 * le plus — et elle répondrait « aucun agent vivant » sur une boîte parfaitement lisible, ce qui
 * est un second faux verdict par-dessus le premier.
 *
 * On demande donc d'abord au registre — il donne le NOM, qui aide le lecteur —, et s'il ne
 * connaît personne alors que la cible a la forme d'un pane, on retombe sur `pane`, qui ne lui
 * demande rien.
 *
 * ⚠️ L'HOMONYMIE RESTE UN REFUS, ET DANS LES DEUX CHEMINS. Un identifiant de pane est INTERNE à
 * sa session : `w7:p1` existait dans DEUX sessions du poste au moment de la mesure. Lire l'un
 * pour l'autre rendrait un verdict juste sur un objet qu'on n'a pas visé — le pire des rendus,
 * puisqu'il a l'air fondé. On ne tire pas au sort l'écran qu'on lit.
 */
async function ouEstLaBoite(cible) {
  const parAgent = await trouverDestinataire(cible);
  if (parAgent.ok) return { ...parAgent, parPane: false };
  if (!estUnPane(cible)) return parAgent;

  const trouves = [];
  for (const socket of sessionsDuPoste()) {
    const r = await appelHerdr(['pane', 'get', String(cible).trim()], { socket });
    if (r.ok && r.reponse?.result?.pane) trouves.push({ socket, pane: r.reponse.result.pane.pane_id ?? String(cible).trim() });
  }
  if (trouves.length === 0) return parAgent; // le refus du registre reste le bon message
  if (trouves.length > 1) {
    return {
      ok: false,
      message:
        `deux sessions ou plus portent le pane « ${cible} » (${trouves.map((t) => t.socket).join(', ')}) — ` +
        'un identifiant de pane est interne à sa session, et lire l’un pour l’autre rendrait un ' +
        'verdict juste sur un écran qu’on n’a pas visé. Rien n’a été lu.',
    };
  }
  // ⚠️ AUCUN NOM À DONNER, ET ON LE DIT EN LE LAISSANT NUL — plutôt que d'inventer un libellé
  // qui ferait croire à un agent connu du registre.
  return { ok: true, pane: trouves[0].pane, socket: trouves[0].socket, nom: null, parPane: true };
}

async function main() {
  const cible = process.argv[2];
  if (!cible || cible.startsWith('-')) {
    process.stderr.write('gestionnaire-etat-boite <pane|nom-d-agent>\n');
    process.exit(1);
  }

  const ou = await ouEstLaBoite(cible);
  if (!ou.ok) {
    process.stderr.write(`${ou.message}\n`);
    process.exit(1);
  }

  // `--format ansi` — LE GRIS EST LA SEULE CHOSE QUI DISTINGUE UNE SUGGESTION D'UN RESTE.
  // Sans lui, cette commande rendrait exactement le verdict trompeur qu'elle existe pour
  // supprimer, et le ferait avec l'autorité d'un outil qui a l'air de savoir.
  // `agent read` quand un agent est au registre, `pane read` sinon — voir `ouEstLaBoite`.
  const ecran = await lireEcran([ou.parPane ? 'pane' : 'agent', 'read', ou.pane, '--format', 'ansi'], {
    socket: ou.socket,
  });
  const vu = etatDeLaBoite(ecran);

  const ligne =
    `${ou.pane}${ou.nom ? ` (${ou.nom})` : ''} — ${CONDUITE[vu.etat]}` +
    (vu.suggestion ? `\n  ce qui est PROPOSÉ en gris : « ${vu.suggestion} »` : '') +
    (vu.texte ? `\n  ce qui ATTEND dans la boîte : « ${vu.texte.slice(0, 120)}${vu.texte.length > 120 ? '…' : ''} »` : '');
  process.stdout.write(`${ligne}\n`);
  process.stdout.write(
    `${JSON.stringify({
      pane: ou.pane,
      agent: ou.nom ?? null,
      etat: vu.etat,
      // ⚠️ LE BOOLÉEN QUI PORTE LA CONDUITE, et il ne se déduit pas de `etat` sans savoir que
      // `suggestion` compte comme vide. Un appelant qui script (`… | jq .aSoumettre`) doit
      // pouvoir décider sans réapprendre la nomenclature — sinon chaque appelant se réécrit sa
      // moitié de règle, et la première qui se trompe écrit dans la boîte de quelqu'un.
      aSoumettre: vu.etat === ETATS_BOITE.ILLISIBLE ? null : !riensASoumettre(vu.etat),
      texte: vu.texte,
      suggestion: vu.suggestion,
    })}\n`
  );

  // Une lecture ratée n'est pas un verdict : elle doit couper une chaîne de commandes.
  if (vu.etat === ETATS_BOITE.ILLISIBLE) process.exit(2);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});

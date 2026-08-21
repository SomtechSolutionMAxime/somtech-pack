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
  [ETATS_BOITE.FILE_DATTENTE]:
    'boîte VIDE, et le destinataire est OCCUPÉ — ses messages sont en FILE et partiront à la ' +
    'fin de son tour. Rien à soumettre, rien n’est bloqué : ce que tu vois en gris est le ' +
    'marqueur de file d’attente, pas un texte',
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
  // Un NOM d'agent n'est pas ambigu au niveau des panes : `trouverDestinataire` a déjà refusé
  // les homonymes de nom, et il n'y a pas de second chemin à consulter.
  //
  // ⚠️ `parLePane` VIENT DE LA RÉSOLUTION — ON NE LE RÉINVENTE PAS (T-20260821-0024). Ce
  // chemin-ci écrivait `parPane: false` en dur ; voir le commentaire du chemin par pane, plus
  // bas, pour ce que ça coûtait.
  if (!estUnPane(cible)) {
    return parAgent.ok ? { ...parAgent, parPane: Boolean(parAgent.parLePane) } : parAgent;
  }

  // ⚠️ ON COMPTE LES SESSIONS QUI PORTENT CE PANE **MÊME QUAND LE REGISTRE A RÉPONDU** — relevé
  // par une revue indépendante, et c'est le côté qui n'était pas gardé.
  //
  // Le refus d'homonymie ne couvrait que le chemin de repli : dès qu'un agent enregistré
  // portait l'identifiant visé, on partait lire son écran sans demander si une AUTRE session du
  // poste porte un pane du même nom. Or un identifiant de pane est INTERNE à sa session, et
  // `w7:p1` existait dans deux sessions de ce poste au moment de la mesure — dont une seule
  // avec un agent au registre (qui, lui, ment sur les agents neufs : `T-20260819-0121`).
  //
  // ⚠️ CE QUE ÇA PRODUISAIT EST LE PIRE DES RENDUS : un verdict JUSTE sur un écran qu'on n'a pas
  // visé. Il a l'air fondé — il porte même un nom d'agent — et rien ne dit qu'il parle d'ailleurs.
  const trouves = [];
  for (const socket of sessionsDuPoste()) {
    const r = await appelHerdr(['pane', 'get', String(cible).trim()], { socket });
    if (r.ok && r.reponse?.result?.pane) trouves.push({ socket, pane: r.reponse.result.pane.pane_id ?? String(cible).trim() });
  }
  if (trouves.length > 1) {
    return {
      ok: false,
      message:
        `deux sessions ou plus portent le pane « ${cible} » (${trouves.map((t) => t.socket).join(', ')}) — ` +
        'un identifiant de pane est interne à sa session, et lire l’un pour l’autre rendrait un ' +
        'verdict juste sur un écran qu’on n’a pas visé. Rien n’a été lu. Désigne-le par le NOM ' +
        'de son agent, qui est unique sur le poste.',
    };
  }
  // Une seule session le porte : si le registre y connaît un agent, on garde son NOM — il aide
  // le lecteur à reconnaître de qui on parle. Sinon on lit le pane directement, et le nom reste
  // nul plutôt qu'inventé.
  //
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 LE VERBE SUIT LE FAIT QUE LA RÉSOLUTION A ÉTABLI — il ne se redécide pas ici
  // (T-20260821-0024).
  //
  // Cette ligne écrivait `parPane: false` EN DUR. Or `trouverDestinataire` rend déjà le fait,
  // sous un autre nom : `parLePane`. Quand il a trouvé la cible par son PANE — le cas NORMAL
  // des agents que le registre ignore —, il rend `{ ok: true, nom: null, parLePane: true }`, et
  // ce `ok: true` suffisait à faire écraser le fait par `false`.
  //
  // **Deux noms pour la même chose, et le second effaçait le premier.** La lecture partait donc
  // en `herdr agent read` sur un pane qu'aucun agent n'occupe au registre — qui refuse, et dont
  // le refus se faisait passer pour un écran illisible (voir `estUnRefusHerdr`).
  //
  // 🔴 MESURÉ : sur les 297 lectures du poste, **23 verdicts `illisible` disparaissent par ce
  // seul choix** — dont trois des quatre cas de référence du chantier. Un `illisible` se lit
  // « rien à signaler » : c'est ainsi qu'un orchestrateur reste injoignable sans le savoir.
  //
  // ⚠️ LIRE UN ÉCRAN NE DEVRAIT RIEN DEMANDER AU REGISTRE, et c'est le fond de l'affaire. Le
  // registre sert à donner un NOM, qui aide le lecteur ; il n'a pas à décider si l'écran est
  // lisible. Un défaut d'annuaire rendait aveugle un outil qui lit un terminal.
  if (parAgent.ok) return { ...parAgent, parPane: Boolean(parAgent.parLePane) };
  if (trouves.length === 0) return parAgent; // le refus du registre reste le bon message
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

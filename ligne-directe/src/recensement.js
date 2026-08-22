// recensement.js — QUI EST VIVANT, QUEL MÉTIER PORTE-T-IL, EST-IL À JOUR.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE FICHIER FERME (E-20260819-0005, sous D-20260819-0001)
//
// On ne pouvait pas répondre à cette question sans une passe manuelle. Faite une fois le
// 2026-08-19 (`T-20260819-0044`) : trente-huit lieux, AUCUN portant le métier courant, et les
// orchestrateurs vivants tous en retard de 8 646 octets — dont un qui avait renaît la veille.
// **Cette passe périme le lendemain et personne ne la relance.** Le veilleur, lui, fait déjà la
// ronde du poste et parle déjà aux orchestrateurs : il lui manquait de savoir quel métier
// chacun porte. Ce module est cette mesure — et rien d'autre.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA RÈGLE DE CONDUITE DU REGISTRE, ET ELLE EST DANS LE CODE PARCE QU'ELLE SE PERD AILLEURS
//
//   ⚠️ LE REGISTRE MESURE ET REND. IL NE PRÉSUME JAMAIS.
//      Une lecture ratée se dit « je n'ai pas pu mesurer », JAMAIS « rien en vol ».
//
//   ⚠️ LE REGISTRE PROPOSE, IL N'IMPOSE PAS — et l'agent doit pouvoir dire « pas maintenant »
//      AVANT. Un consentement demandé APRÈS ne vaut rien : il ne saura plus à quoi il consent.
//
// Ces deux phrases ne sont pas de la prudence de principe, elles sortent de deux mesures faites
// le 2026-08-19 sur des agents jetables ouverts pour ça (`T-20260819-0050`) :
//
//   ① UN AGENT VIVANT PEUT RECHARGER SON MÉTIER SANS RENAÎTRE. Le geste est `/clear`, envoyé
//      dans son pane. Mesuré 2 fois sur 2 : un marqueur unique changé à chaud dans le CLAUDE.md
//      est repris après le geste, et le `.claude/settings.json` est relu aussi — un hook
//      `SessionStart` ajouté à chaud se déclenche ; retiré, il ne se déclenche plus. C'est le
//      redémarrage qui ne suffit pas, pas le rechargement.
//
//   ② MAIS LE GESTE A UN PRIX, ET CE N'EST PAS CELUI QU'ON CROIT. `/clear` n'ARRÊTE rien : un
//      shell d'arrière-plan continue de tourner, un sous-agent en vol survit et rend son
//      résultat. C'est l'AGENT qui perd le fil — interrogé juste après, il répond « rien en
//      cours, session propre », puis reçoit le retour d'un sous-agent qu'il ne se rappelle plus
//      avoir lancé. **Rien n'est tué, tout devient orphelin de sa raison d'être.**
//
// C'est pourquoi ce module NE DÉCLENCHE RIEN. Il n'envoie aucun `/clear`. Il rend le geste, son
// prix, et ce qu'il a pu mesurer du travail en vol — la décision appartient à l'agent concerné.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ON INVENTORIE PAR LE CHEMIN, JAMAIS PAR LE NOM. C'est une contrainte, pas un goût.
//
// Depuis la `v1.72.0`, un agent porte un NOM DE RIVIÈRE : son nom ne correspond plus au nom de
// son lieu. Une passe d'inventaire qui cherchait les agents dont le nom figurait dans la liste
// des noms de lieux en a manqué un le 2026-08-19 — **alors qu'il était sous ses yeux dans la
// liste**. Le correctif de nommage avait périmé la méthode d'inventaire, et personne ne l'avait
// vu en le livrant. Le `foreground_cwd` d'un pane, lui, dit `.orchestrateur/<mandat>/` quel que
// soit le nom porté. Le prochain qui touchera ce code aura le même réflexe : qu'il lise ceci.
//
// ⚠️ ET LE RÔLE SE RECONNAÎT AU FAIT, PAS AU NOM DU DOSSIER. `roleDuLieu` (lieu-agent.js) exige
// les quatre fichiers posés ET les en-têtes réels du métier : un répertoire vide au bon nom ne
// porte aucun métier, et le compter gonflerait le registre de lieux qui n'existent qu'à moitié.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE MODULE NE TOUCHE AUCUN PROCESSUS. Comme `balayage.js`, toute l'I/O entre par paramètre —
// c'est ce qui le rend éprouvable sans jamais s'approcher des agents vivants du poste.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { referenceDuPoste } from './fraicheur-gabarit.js';
// ⚠️ RA-VUE-004 — LE REGISTRE DES RÔLES EST UNIQUE, ET C'EST `roles.js`. On l'IMPORTE plutôt
// que d'en recopier ne serait-ce que la liste des dossiers : une seconde table diverge au
// premier rôle ajouté d'un seul côté, et ce dépôt a payé cette mécanique neuf fois. Ce n'est
// pas de l'I/O — c'est une table pure — donc l'importer n'entame pas la règle « toute l'I/O
// entre par paramètre » qui rend ce module éprouvable loin des agents vivants.
import { role as roleDe, rolesConnus } from './roles.js';

/**
 * CE QUE CE RECENSEMENT NE PEUT PAS VOIR — par construction, et pas par accident.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ LE COMPTE RENDU EST UN **PLANCHER**, JAMAIS UN TOTAL. Et ce n'est pas une précaution de
 * style : le 2026-08-19, le même parc — qui n'avait pas bougé — a été compté **trois**, puis
 * **cinq**, puis **sept** en une matinée. Ce qui changeait à chaque fois était L'INSTRUMENT.
 * **Sept n'est donc pas un total non plus** ; rien ne prouve qu'on a fini de chercher.
 *
 * Une seule chose a protégé le compte de trois : la marque « plancher » écrite À CÔTÉ du chiffre.
 * Elle vit donc dans le RENDU, pas dans un compte rendu qu'on relit une fois.
 *
 * Ce que cette liste énumère, ce sont les façons dont un orchestrateur bien vivant peut ne pas
 * figurer ici. Elle est incomplète par nature — c'est le propre d'un plancher — mais chacune de
 * ses entrées a été constatée ou lue dans le code, aucune n'est imaginée.
 */
export const CE_QUE_LE_RECENSEMENT_NE_VOIT_PAS = [
  'un agent qui ne tourne pas dans une session herdr (terminal ordinaire, tmux, IDE) : herdr ne le voit pas, donc nous non plus',
  'une session herdr dont le socket ne vit pas sous « ~/.config/herdr/sessions/<nom>/herdr.sock » : la découverte ne la trouve pas',
  'une session herdr qui a REFUSÉ de répondre pendant ce tour : ses panes manquent, et c’est pourquoi ses refus sont rendus nommément',
  'un agent dont le répertoire de travail n’est plus sous son lieu (il a changé de dossier) : le chemin ne dit plus rien de son mandat',
  'un lieu dont le métier ne porte plus l’en-tête attendu du rôle : « roleDuLieu » ne l’établit alors pas — un métier assez ancien peut être invisible pour cette raison même',
  'un lieu à demi posé : les quatre fichiers du rôle sont exigés, et il en manque un',
];

/**
 * LA CADENCE DE LA RONDE DE RECENSEMENT — et elle est déclarée ICI, avec ce qu'elle règle.
 *
 * ⚠️ PAS AUPRÈS DE `CADENCE_DU_BALAYAGE_MS`, et ce n'est pas un oubli. La leçon de
 * T-20260818-0076 est que deux réglages du MÊME comportement ne doivent jamais vivre à deux
 * endroits ; elle ne dit pas d'entasser les réglages de comportements différents. Le balayage
 * délivre des boîtes, ce recensement mesure des métiers : les mêler ferait régler l'un en
 * croyant régler l'autre.
 *
 * Quinze minutes : le métier est publié plusieurs fois par jour, et un recensement complet du
 * poste a été mesuré à 408 ms sur 301 panes et treize sessions herdr (2026-08-19). Rien
 * n'oblige à le payer plus souvent.
 */
export const CADENCE_DU_RECENSEMENT_MS = 15 * 60_000;

/**
 * LE DÉLAI AU-DELÀ DUQUEL UN TOUR EST ABANDONNÉ — et ce réglage garde la RONDE, pas la mesure.
 *
 * ⚠️ RELEVÉ EN PASSE DE REVUE DE FOND, et le rejet était juste. Les appels à `herdr` n'ont aucun
 * délai propre : un socket VIVANT MAIS MUET fait pendre l'appel indéfiniment. Sans ce garde-fou,
 * `recensementEnCours` restait `true` pour toujours — ni le `catch` ni le `finally` ne
 * s'exécutant jamais — et **la ronde s'éteignait en silence**. C'est mot pour mot le pire cas
 * que `balayage.js` nomme : un dispositif indiscernable d'un dispositif mort.
 *
 * Deux minutes : un recensement complet du poste a été mesuré à 408 ms sur 301 panes et treize
 * sessions ; une passe manuelle sur un poste chargé a déjà atteint deux minutes (2026-08-18).
 * Le seuil laisse donc passer le pire cas connu et n'attrape que ce qui ne reviendra jamais.
 */
export const DELAI_MAX_DUN_TOUR_MS = 120_000;

/**
 * LE GESTE DE REMISE À JOUR, et le seul que ce dispositif nomme.
 *
 * ⚠️ IL EST RENDU, JAMAIS ENVOYÉ. Voir la règle de conduite en tête de fichier.
 */
export const GESTE_DE_REMISE_A_JOUR = '/clear';

/** Ce que coûte le geste, dit à celui à qui on le propose — jamais tu après coup. */
export const PRIX_DU_GESTE =
  "il efface le fil de l'agent : rien n'est arrêté (un shell d'arrière-plan et un sous-agent " +
  "en vol survivent) mais l'agent perd la connaissance de ce qui tourne et déclarera sa " +
  "session propre. Il doit pouvoir dire « pas maintenant » AVANT — après, il ne saura plus à " +
  'quoi il consent.';

/** La règle, en une phrase, pour qui lit le rendu sans lire ce fichier. */
export const REGLE_DE_CONDUITE =
  'ce registre MESURE et REND, il ne PRÉSUME jamais ; et il PROPOSE, il n’IMPOSE pas.';

/**
 * SUR QUEL RENDU L'INDICE DE TRAVAIL EN VOL A ÉTÉ MESURÉ — et pourquoi cette ligne existe.
 *
 * Le travail en vol ne se lit pas dans une interface : il se lit dans la BARRE D'ÉTAT que
 * Claude Code dessine au bas du pane. Ce libellé appartient au rendu, pas à un contrat. Le jour
 * où il changera, `travailEnVol` rendra « rien en vol » pour un agent qui en a — un faux
 * négatif silencieux, c'est-à-dire le motif exact que ce dépôt traque partout. Cette constante
 * existe pour qu'on puisse relier ce jour-là à un changement de version sans refaire l'enquête.
 */
export const RENDU_MESURE_SUR = 'Claude Code v2.1.235 (mesuré le 2026-08-19)';

/**
 * LE FICHIER QUI PORTE LE MÉTIER, ET LUI SEUL.
 *
 * ⚠️ POURQUOI PAS LE RÉPERTOIRE ENTIER, alors que `empreinteGabarit` (fraicheur-gabarit.js) sait
 * le mesurer. Parce que ce n'est pas la même question. Le lieu posé contient `CONTEXTE.md`, que
 * le représentant ou l'orchestrateur écrit à la main et que le pack ne touche JAMAIS
 * (RA-REL-014) : une empreinte de répertoire diverge donc du gabarit pour tout lieu vivant, et
 * dirait « périmé » de chacun d'eux, tout le temps. `verifierFraicheur` garde la POSE, où le
 * répertoire est encore celui du pack ; ce module mesure le MÉTIER d'un lieu déjà habité.
 *
 * ⚠️ ET ÇA BORNE CE QU'ON REND, ce qui est écrit à côté du chiffre : les MOYENS (`.mcp.json`) et
 * les DROITS (`.claude/settings.json`) d'un lieu ne sont pas mesurés ici. Un lieu peut porter le
 * métier courant et des droits périmés — T-20260818-0034 a montré qu'un rafraîchissement pouvait
 * DÉSARMER un lieu sans toucher son `CLAUDE.md`. C'est une mesure de plus, pas celle-ci.
 */
export const FICHIER_DU_METIER = 'CLAUDE.md';

/**
 * L'empreinte du métier d'un lieu — `null` quand il ne s'est pas laissé mesurer.
 *
 * Rend l'empreinte SHA-256 ET les octets. Les deux, parce que l'écart se dit en octets et que
 * personne ne lit un écart entre deux sommes de contrôle.
 *
 * ⚠️ `null` N'EST PAS « ZÉRO OCTET ». « Je n'ai pas pu lire » et « le fichier est vide » mènent
 * à deux conduites opposées, et les confondre ferait rendre un écart de 125 274 octets pour un
 * fichier parfaitement à jour qu'on a simplement raté.
 */
export function empreinteDuMetier(lieu, { lire = readFileSync } = {}) {
  try {
    const contenu = lire(join(lieu, FICHIER_DU_METIER));
    return {
      empreinte: createHash('sha256').update(contenu).digest('hex'),
      octets: contenu.length,
    };
  } catch {
    return null;
  }
}

/**
 * LA RÉFÉRENCE DU POSTE POUR UN RÔLE — l'empreinte à laquelle tout le reste se compare.
 *
 * ⚠️ ELLE SE RÉSOUT PAR `referenceDuPoste`, ET SURTOUT PAS PAR UNE SECONDE RÉSOLUTION.
 * `fraicheur-gabarit.js` sait déjà où le pack est déposé sur ce poste ; s'en écrire une
 * variante ici ferait « une porte sur deux », et la copie n'hérite jamais des corrections de
 * l'autre — ce dépôt a payé ça neuf fois.
 *
 * ⚠️ L'EMPREINTE FAIT FOI, JAMAIS LE NUMÉRO DE VERSION. Mesuré sur ce poste le 2026-08-19 :
 * `VERSION` dit `1.64.0` pendant que les tags publiés vont à `v1.74.0` — le fichier ne suit pas
 * les tags. Un numéro dit ce qu'on a DÉCLARÉ ; l'empreinte dit ce qu'on a, et elle attrape en
 * prime le métier modifié à la main.
 *
 * ⚠️ RÉFÉRENCE INTROUVABLE ⇒ ON N'EN CONCLUT RIEN. Elle rend `{ refus }`, et le recensement
 * rend alors des orchestrateurs SANS écart plutôt que des orchestrateurs « à jour ».
 */
export function referenceDuMetier({ gabarit = 'orchestrateur', foyer, mesurer = empreinteDuMetier } = {}) {
  const ou = referenceDuPoste(gabarit, { foyer });
  if (!ou.chemin) return { refus: ou.raison };
  const mesure = mesurer(ou.chemin);
  if (!mesure) {
    return { refus: `la référence « ${join(ou.chemin, FICHIER_DU_METIER)} » ne s’est pas laissé mesurer` };
  }
  return { empreinte: mesure.empreinte, octets: mesure.octets, chemin: ou.chemin };
}

/**
 * LE MANDAT PORTÉ PAR UN CHEMIN — `.orchestrateur/<mandat>/…` → `<mandat>`, ou `null`.
 *
 * ⚠️ C'EST LE CHEMIN QUI FAIT FOI, JAMAIS LE NOM DE L'AGENT. Voir l'en-tête : depuis la
 * `v1.72.0` un agent porte un nom de rivière, sans rapport avec le mandat de son lieu.
 */
export function mandatDuChemin(chemin, dossier) {
  if (!chemin || !dossier) return null;
  const morceaux = String(chemin).split('/');
  const i = morceaux.lastIndexOf(dossier);
  if (i < 0 || i + 1 >= morceaux.length) return null;
  return morceaux[i + 1] || null;
}

/** Le répertoire du lieu, tel qu'on l'ouvrira pour le mesurer — `null` si le chemin n'en porte pas. */
export function lieuDuChemin(chemin, dossier) {
  const mandat = mandatDuChemin(chemin, dossier);
  if (!mandat) return null;
  const morceaux = String(chemin).split('/');
  const i = morceaux.lastIndexOf(dossier);
  return morceaux.slice(0, i + 2).join('/');
}

/**
 * CE QU'UN AGENT A EN VOL — lu à l'écran, parce que rien d'autre ne le dit.
 *
 * ⚠️ C'EST UN INDICE, PAS UN FAIT, et la différence décide de la conduite. La barre d'état de
 * Claude Code annonce « N shell » quand un shell d'arrière-plan tourne et « /tasks to see
 * subagents » quand des sous-agents existent. Contre-épreuve faite sur un même agent le
 * 2026-08-19 : la mention est ABSENTE avant qu'il ne lance quoi que ce soit, PRÉSENTE ensuite.
 * Mais ce libellé appartient au rendu (`RENDU_MESURE_SUR`), pas à une interface.
 *
 * ⚠️ ET « AU REPOS » N'EST PAS « SANS TRAVAIL EN VOL ». Un agent `idle` peut avoir un shell qui
 * tourne et un sous-agent en vol — mesuré. C'est exactement le cas qu'un `/clear` proposé « à un
 * agent au repos » raterait, et c'est pourquoi les deux se rendent séparément.
 *
 * @returns `{ mesure: 'lue'|'refusée', ... }` — un écran illisible rend `refusée`, JAMAIS
 *          « rien en vol ».
 */
export function travailEnVol(ecran) {
  if (ecran === null || ecran === undefined) {
    return { mesure: 'refusée', raison: "l'écran du pane ne s'est pas laissé lire", enVol: null };
  }
  const texte = String(ecran);
  const shells = texte.match(/·\s*(\d+)\s+shells?\b/);
  const sousAgents = /\/tasks to see subagents/.test(texte);
  const occupe = /esc to interrupt/.test(texte);
  return {
    mesure: 'lue',
    shells: shells ? Number(shells[1]) : 0,
    sousAgents,
    occupe,
    enVol: Boolean((shells && Number(shells[1]) > 0) || sousAgents || occupe),
    rendu: RENDU_MESURE_SUR,
  };
}

function motDeLErreur(err) {
  return err?.message || String(err);
}

/**
 * LE LIEU DE RÔLE QUE PORTE UN CHEMIN DE TRAVAIL — pour TOUS les rôles connus, pas un seul.
 *
 * ⚠️ CE QUI EST RENDU EST UN CANDIDAT, PAS UN RÔLE. Cette fonction ne lit que le CHEMIN : elle
 * dit « ce chemin passe par le dossier du rôle X ». C'est `roleDuLieu` — injecté, parce qu'il
 * touche le disque — qui établit le rôle par le CONTENU du lieu : les quatre fichiers du
 * gabarit ET les en-têtes réels du métier. Un répertoire vide au bon nom ne porte aucun métier,
 * et le compter gonflerait le registre de lieux qui n'existent qu'à moitié (T-20260819-0070).
 *
 * ⚠️ LE PLUS PROFOND GAGNE, et ce n'est pas arbitraire. Un chemin peut traverser deux dossiers
 * de rôle — le lieu d'un représentant posé dans un dépôt qui porte lui-même un `.orchestrateur/`
 * en est le cas réel, mesuré sur ce poste. Le lieu où l'agent TRAVAILLE est le dernier segment
 * de rôle du chemin, jamais le premier ; prendre le premier rendrait un représentant pour un
 * orchestrateur, avec un mandat qui n'est pas le sien.
 *
 * @returns `{ role, dossier, lieu, mandat }` ou `null` si le chemin ne passe par aucun lieu.
 */
export function lieuDeRoleDansLeChemin(chemin) {
  if (!chemin) return null;
  const morceaux = String(chemin).split('/');
  let trouve = null;
  for (const nom of rolesConnus()) {
    const dossier = roleDe(nom).dossier;
    const i = morceaux.lastIndexOf(dossier);
    // `i + 1 >= length` : le dossier de rôle SANS lieu nommé dessous ne désigne personne.
    if (i < 0 || i + 1 >= morceaux.length || !morceaux[i + 1]) continue;
    if (!trouve || i > trouve.i) {
      trouve = { i, role: nom, dossier, mandat: morceaux[i + 1], lieu: morceaux.slice(0, i + 2).join('/') };
    }
  }
  if (!trouve) return null;
  const { role, dossier, lieu, mandat } = trouve;
  return { role, dossier, lieu, mandat };
}

/**
 * LA RÉFÉRENCE DU POSTE POUR CHAQUE RÔLE — une par rôle, et c'est le fond du problème.
 *
 * ⚠️ UNE RÉFÉRENCE UNIQUE FERAIT RENDRE « EN RETARD » À TOUS LES REPRÉSENTANTS, TOUS LES JOURS.
 * Le métier d'un représentant et celui d'un orchestrateur sont deux textes qui n'ont AUCUNE
 * raison de concorder : les comparer au même gabarit ne mesure rien, et un « en retard »
 * permanent apprend au lecteur à ne plus lire la colonne — ce qui coûte le vrai retard le jour
 * où il arrive.
 *
 * ⚠️ ET LE DOSSIER DE GABARITS N'EST PAS LE NOM DU RÔLE : `representant` se sert de
 * `gestionnaire-client`. C'est `roles.js` qui le sait, et lui seul — on ne le réécrit pas ici.
 */
export function referencesDesRoles({ foyer, mesurer = empreinteDuMetier } = {}) {
  return Object.fromEntries(
    rolesConnus().map((nom) => [nom, referenceDuMetier({ gabarit: roleDe(nom).gabarits, foyer, mesurer })])
  );
}

/**
 * CE QU'ON SAIT DU NOM D'UN AGENT — et les trois états ne se replient jamais en deux.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ « IL N'A PAS DE NOM » ET « JE N'AI PAS PU LIRE SON NOM » MÈNENT À DEUX CONDUITES
 * OPPOSÉES. Sur un anonyme, il faut le faire se nommer. Sur un nom non mesuré, il faut refaire
 * la mesure. Les confondre envoie corriger ce qui va bien — et les deux cas se produisent
 * réellement : `herdr agents()` a été mesuré à 83 panes sur 227 un jour, et à 94 sur 94 le
 * 2026-08-22. Un instrument dont la complétude varie ne peut pas servir de preuve d'absence.
 *
 * ⚠️ ET ON NE COMBLE JAMAIS UN NOM MANQUANT — ni depuis le mandat, ni depuis le lieu, ni depuis
 * le libellé de l'onglet. Deux agents ont déjà porté le même nom sur ce poste parce qu'une
 * naissance a attribué un nom sur une vérification qu'elle venait de déclarer manquante
 * (T-20260822-0002). Ici le prix serait plus élevé qu'un registre mal renseigné : on ÉCRIT à
 * un nom, donc un nom plausible fait parler à quelqu'un qui n'existe pas.
 *
 * @param pane        le pane, qui porte parfois son nom lui-même.
 * @param cle         `«session» NUL «pane»` — la session voyage TOUJOURS avec le pane.
 * @param nomsConnus  `null` · `{ mesure: 'refusée', raison }` · `{ mesure: 'lue', noms: Map }`.
 *                    Dans la Map, une entrée à `null` dit « vu, sans nom » ; une entrée ABSENTE
 *                    dit « pas vu ». C'est cette distinction qui porte les trois états.
 */
export function nomDeLAgent(pane, cle, nomsConnus) {
  const porte = pane?.name ?? pane?.nom ?? null;
  if (porte) return { mesure: 'lu', valeur: porte, source: 'le pane lui-même' };

  if (!nomsConnus) {
    return {
      mesure: 'refusée',
      valeur: null,
      raison: 'aucun lecteur de noms ne m’a été donné — ceci n’est pas « il n’a pas de nom »',
    };
  }
  if (nomsConnus.mesure === 'refusée') {
    return { mesure: 'refusée', valeur: null, raison: nomsConnus.raison ?? 'le registre des agents a refusé' };
  }
  const noms = nomsConnus.noms;
  if (!noms?.has?.(cle)) {
    return {
      mesure: 'refusée',
      valeur: null,
      raison: 'le registre des agents n’a pas vu ce pane — il SOUS-COMPTE, son silence ne dit rien',
    };
  }
  const valeur = noms.get(cle);
  if (valeur) return { mesure: 'lu', valeur, source: 'le registre des agents' };
  return {
    mesure: 'aucun',
    valeur: null,
    // ⚠️ LA CONSÉQUENCE VOYAGE AVEC LE FAIT. « nom: null » se lit comme un champ oublié ; c'est
    // un fait mesuré, et il a un prix que le lecteur doit connaître sans lire ce fichier.
    consequence:
      'cet agent est ANONYME, donc inadressable : on ne peut ni le nommer sur une ligne, ni lui ' +
      'écrire. Il doit se nommer lui-même — on ne lui en attribue aucun d’ici.',
  };
}

/**
 * UN RECENSEMENT — qui est vivant, quel métier il porte, et de combien il s'écarte.
 *
 * L'I/O est injectée, sans exception :
 *
 * @param panes       la liste des panes, ou une fonction (éventuellement asynchrone) qui la
 *                    rend. **Elle a le droit de JETER, et c'est le cœur de ce module.**
 * @param dossier     le nom du dossier qui porte les lieux du rôle (`.orchestrateur`).
 * @param roleDuLieu  `(repertoire) → 'orchestrateur'|null` — le rôle établi PAR LE FAIT.
 * @param mesurer     `(lieu) → { empreinte, octets }|null`.
 * @param reference   `{ empreinte, octets, chemin }` ou `{ refus: '…' }` — jamais deviné.
 * @param lireEcran   `(pane) → texte|null` — pour le travail en vol. Facultatif : sans lui, le
 *                    travail en vol est rendu `non mesuré`, jamais « rien en vol ».
 * @param maintenant  l'horloge en ms. Injectée : un recensement doit pouvoir être rejoué.
 * @param journaliser `(message) → void` — le battement de cœur de la ronde.
 *
 * @returns le compte rendu (voir la forme dans le corps).
 *
 * ⚠️ LA PIÈCE MAÎTRESSE : QUAND L'INVENTAIRE REFUSE, `orchestrateurs` EST `null`, PAS `[]`.
 * Une liste vide se lit « il n'y en a aucun » — c'est la traduction exacte qu'on refuse. Un
 * lecteur qui ne lit QUE ce rendu doit pouvoir distinguer « je n'ai pas su regarder » de « j'ai
 * regardé et il n'y a personne », sans rien savoir du code qui l'a produit.
 */
export async function unRecensement({
  panes = [],
  roleDuLieu = () => null,
  mesurer = empreinteDuMetier,
  // ⚠️ UNE RÉFÉRENCE PAR RÔLE, jamais une seule. Voir `referencesDesRoles` : comparer le métier
  // d'un représentant au gabarit d'orchestrateur rendrait « en retard » tous les représentants,
  // tous les jours, et le retard cesserait de vouloir dire quelque chose.
  references = {},
  lireEcran = null,
  // ⚠️ L'ÉTAT DU MANDAT, ET IL NE SE DEVINE PAS (T-20260819-0056). Injecté : sans lui, chaque
  // orchestrateur porte « non mesuré » — jamais « ouvert ». Voir `mandat.js` pour la raison, et
  // la conduite qui en découle plus bas : **on ne propose rien à un mandat qu'on n'a pas mesuré.**
  etatDuMandat = null,
  // ⚠️ UN ENRICHISSEMENT, JAMAIS UNE SOURCE. Les noms viennent de `herdr.agents()`, dont la
  // complétude VARIE : 83 panes sur 227 le 2026-08-19, 94 sur 94 le 2026-08-22. S'en servir
  // pour savoir QUI EXISTE ferait reculer ce module au défaut qu'il ferme. On ne lui demande
  // que d'habiller un pane trouvé autrement — et son silence ne retire personne du registre.
  //
  // ⚠️ ET SA FORME PORTE CE QU'IL N'A PAS VU. `{ mesure: 'lue', noms: Map }` où une entrée à
  // `null` dit « vu, sans nom » et une entrée ABSENTE dit « pas vu » ; `{ mesure: 'refusée' }`
  // quand il n'a pas répondu du tout. Une Map nue ne saurait pas distinguer les deux, et c'est
  // exactement la distinction que `nomDeLAgent` doit rendre.
  nomsConnus = null,
  maintenant = Date.now(),
  journaliser = () => {},
} = {}) {
  const quand = new Date(maintenant).toISOString();

  // ═══ UNE PANNE D'INVENTAIRE N'EST PAS « AUCUN AGENT » — la prudence de `balayage.js`, reprise
  // ici sur son propre objet. `herdr.panes()` jette quand l'outil est introuvable ou qu'aucune
  // session ne répond ; traduire ça en liste vide ferait rendre un registre parfaitement vert,
  // avec zéro orchestrateur, sur un poste où plus rien n'est mesuré.
  let liste;
  try {
    liste = typeof panes === 'function' ? await panes() : panes;
  } catch (err) {
    const raison = motDeLErreur(err);
    journaliser(
      `recensement — SANS INVENTAIRE : la liste des panes ne s’est pas laissé lire (${raison}). ` +
        'Je ne sais pas qui est vivant : ceci n’est PAS « aucun agent », ni « aucun orchestrateur ».'
    );
    return {
      quand,
      inventaireRefuse: raison,
      panesVus: null,
      references,
      // ⚠️ `null`, PAS `[]`. Voir la note de la signature — c'est ici que se joue la garde, et
      // un renommage de champ est exactement l'occasion de la perdre sans qu'un banc rougisse.
      agents: null,
      resume:
        'je n’ai pas pu mesurer qui est vivant : la liste des panes ne s’est pas laissé lire ' +
        `(${raison}). Ce n’est pas « aucun agent » — c’est « je n’ai pas su regarder ».`,
      regle: REGLE_DE_CONDUITE,
    };
  }
  // ⚠️ DEUX FORMES ACCEPTÉES, ET LA SECONDE PORTE CE QUI MANQUE. `herdr.panes()` rend
  // « { panes, sessionsInterrogees, sessionsRefusees } » : une session injoignable ne fait pas
  // échouer le tour, mais son absence se PAIE en panes non vus. Trois sessions muettes sur
  // treize amputent le compte d'un quart — et sans ce champ, l'amputation serait invisible.
  const enveloppe = liste && !Array.isArray(liste) && Array.isArray(liste.panes) ? liste : null;
  const sessionsRefusees = enveloppe?.sessionsRefusees ?? [];
  const sessionsInterrogees = enveloppe?.sessionsInterrogees ?? null;
  liste = enveloppe ? enveloppe.panes : Array.isArray(liste) ? liste : [];

  const agents = [];
  // ⚠️ CE QU'ON A ÉCARTÉ SE COMPTE, IL NE DISPARAÎT PAS. Un chemin qui porte un
  // `.orchestrateur/<mandat>/` sans porter le métier est écarté du RÔLE à juste titre — le rôle
  // s'établit par le fait — mais l'écart entre « candidats » et « comptés » est justement ce qui
  // chiffre le plancher. Mesuré sur ce poste le 2026-08-19 : huit candidats, sept comptés, et le
  // huitième était un agent bien vivant dans un lieu à demi posé (T-20260819-0070).
  //
  // ⚠️ ET DEPUIS E-20260822-0001, ÊTRE ÉCARTÉ DU RÔLE N'EST PLUS ÊTRE ÉCARTÉ DU REGISTRE :
  // l'agent y figure avec un rôle « non établi ». C'est EF-VUE-008 — dire ce qu'on ne sait pas —
  // et c'est ce qui a manqué le plus longtemps : 81 des 97 panes du poste travaillaient hors de
  // tout dossier de rôle et n'apparaissaient NULLE PART, pas même comme « je ne sais pas ».
  const lieuxEcartes = [];
  // Les panes qui DÉCLARENT ne porter aucun agent — des terminaux, pas des agents. Mesuré :
  // 3 sur 97 le 2026-08-22. Les rendre comme « agent au rôle non établi » affirmerait qu'un
  // agent existe là où il n'y en a pas — un faux positif dans un registre dont tout l'objet est
  // de n'en produire aucun. On ne les fait pas disparaître pour autant : on les compte.
  let panesSansAgent = 0;
  for (const p of liste) {
    // ⚠️ SEULE UNE DÉCLARATION ÉCARTE, JAMAIS UN SILENCE. `agent: null` est un fait mesuré
    // (« ce pane ne porte pas d'agent ») ; une clé ABSENTE n'est pas une mesure. Écarter sur
    // l'absence de la clé ferait taire un pane parce que la source ne s'est pas exprimée —
    // c'est-à-dire présumer, ce que ce registre ne fait jamais.
    if (p && Object.hasOwn(p, 'agent') && !p.agent) {
      panesSansAgent += 1;
      continue;
    }
    // ⚠️ LE CHEMIN DE TRAVAIL, PAS LE `cwd`. Un agent né par `claude-swt` garde le dépôt
    // principal en `cwd` pendant que son lieu vit ailleurs — `herdr.js` le dit déjà de son côté.
    const chemin = p?.foreground_cwd || p?.cwd || null;
    const candidat = lieuDeRoleDansLeChemin(chemin);
    const lieu = candidat?.lieu ?? null;
    const mandat = candidat?.mandat ?? null;

    // ═══ LE RÔLE, EN TROIS ÉTATS QUI NE SE REPLIENT PAS. « établi » · « non établi » (mesuré,
    // aucun rôle connu ne correspond) · « refusée » (le lieu ne s'est pas laissé lire). Le
    // troisième existe parce qu'un module qui rend la même chose quand il ne sait pas et quand
    // il n'y a rien est indiscernable d'un module qui ment.
    let role;
    if (!candidat) {
      role = {
        mesure: 'non établi',
        nom: null,
        pourquoi:
          'son chemin de travail ne passe par le lieu d’aucun rôle connu — un chef d’équipe est ' +
          'aujourd’hui dans ce cas : le geste qui le fait naître ne dépose rien dans son worktree',
      };
    } else {
      let etabli;
      try {
        etabli = roleDuLieu(lieu);
      } catch (err) {
        etabli = { refus: motDeLErreur(err) };
      }
      if (etabli && typeof etabli === 'object' && etabli.refus) {
        role = { mesure: 'refusée', nom: null, raison: `le lieu « ${lieu} » ne s’est pas laissé lire (${etabli.refus})` };
      } else if (etabli) {
        // Le lieu porte bien un métier de rôle. On rend CELUI QU'IL PORTE, pas celui que son
        // dossier annonce : les deux peuvent diverger, et c'est le contenu qui fait foi.
        role = { mesure: 'établi', nom: etabli, libelle: roleDe(etabli).libelle };
      } else {
        lieuxEcartes.push({
          pane: p?.pane_id ?? p?.pane ?? null,
          lieu,
          pourquoi: `le dossier « ${candidat.dossier} » y est, mais le métier du rôle n’y est pas établi`,
        });
        role = {
          mesure: 'non établi',
          nom: null,
          pourquoi: `son lieu porte le dossier « ${candidat.dossier} » sans porter le métier du rôle — lieu à demi posé`,
        };
      }
    }

    // ═══ LA RÉFÉRENCE EST CELLE DE SON RÔLE. Sans rôle établi, il n'y a rien à quoi comparer :
    // on ne se rabat PAS sur une référence par défaut, qui rendrait un écart entre deux métiers
    // qui n'ont aucune raison de concorder.
    const reference = role.mesure === 'établi'
      ? references?.[role.nom] ?? { refus: `aucune référence ne m’a été donnée pour le rôle « ${role.nom} »` }
      : { refus: `le rôle n’étant pas établi, aucune référence ne s’applique` };

    const mesure = role.mesure === 'établi' && lieu ? mesurer(lieu) : null;
    // ⚠️ `idle` NE DIT RIEN DU MANDAT. Un chantier clos et une session au repos rendent tous les
    // deux `idle` — c'est écrit ici parce que c'est ici qu'on serait tenté de les confondre.
    const chantier = etatDuMandat
      ? await etatDuMandat(mandat)
      : { mesure: 'non mesurée', clos: null, raison: 'aucun lecteur d’état de mandat ne m’a été donné' };
    const enVol = lireEcran
      ? travailEnVol(await lireEcran(p))
      : { mesure: 'non mesurée', raison: 'aucun lecteur d’écran ne m’a été donné', enVol: null };

    // ⚠️ L'ÉCART N'EXISTE QUE SI LES DEUX CÔTÉS ONT ÉTÉ MESURÉS. Une référence absente ou un
    // métier illisible ne font JAMAIS conclure « à jour » : ils rendent `null`, qui se lit
    // « je ne sais pas » et ne se compte ni dans les à-jour ni dans les en-retard.
    const comparable = Boolean(mesure && reference?.empreinte);
    const pane = p?.pane_id ?? p?.pane ?? null;
    const socket = p?.herdr_socket ?? p?.socket ?? null;
    agents.push({
      pane,
      // ⚠️ LA SESSION EST RENDUE AVEC LE PANE, JAMAIS SANS. Un identifiant de pane n'est unique
      // que dans sa session : ce poste en porte treize, et deux sessions y emploient le même
      // `w5:p3`. Un registre qui ne rendrait que le pane désignerait deux agents à la fois.
      session: socket,
      // ⚠️ LE RÔLE SE LIT SUR L'ENTRÉE, JAMAIS DANS LE NOM DU TABLEAU QUI LA CONTIENT. Un
      // `orchestrateurs[]` rendait le rôle implicite dans un rangement : un lecteur qui reçoit
      // une entrée seule ne savait pas ce qu'elle est, et déduire un fait d'un rangement est
      // exactement ce que RA-VUE-005 interdit — « le rôle se MESURE au lieu ».
      role,
      // ⚠️ LE NOM PORTE SA PROPRE MESURE. `pane list` ne rend JAMAIS de nom (0 sur 97, mesuré
      // le 2026-08-22) : tout vient du registre des agents, dont la complétude varie. « Pas de
      // nom » et « nom non lu » appellent deux gestes opposés — voir `nomDeLAgent`.
      nom: nomDeLAgent(p, `${socket ?? ''}\u0000${pane}`, nomsConnus),
      // Ce que le LIEU nomme : le code du chantier pour un orchestrateur, le client pour un
      // représentant. `null` quand aucun lieu de rôle ne porte cet agent — et un `null` ici se
      // lit avec `role.mesure`, qui dit POURQUOI.
      mandat,
      lieu,
      // L'état de la SESSION — et rien de plus. Il ne dit pas si le chantier existe encore.
      statut: p?.agent_status ?? null,
      // L'état du CHANTIER, qui est une autre question et une autre source.
      chantier,
      metier: mesure
        ? { empreinte: mesure.empreinte, octets: mesure.octets }
        : { refus: `le métier de « ${lieu} » ne s’est pas laissé mesurer` },
      aJour: comparable ? mesure.empreinte === reference.empreinte : null,
      ecartOctets: comparable ? mesure.octets - reference.octets : null,
      travailEnVol: enVol,
      // Le geste est RENDU, jamais envoyé — et il ne vient jamais sans son prix.
      //
      // ⚠️ ET IL NE SE PROPOSE QU'À UN MANDAT PROUVÉ OUVERT. Ni à un mandat clos — réveiller
      // deux orchestrateurs sur les mêmes panes, chacun croyant l'autre parti, est le vrai
      // risque nommé par T-20260819-0056 — ni à un mandat NON MESURÉ, parce que se rabattre sur
      // « probablement ouvert » referait automatiquement l'écart qu'un humain a commis une fois.
      remiseAJour:
        comparable && mesure.empreinte !== reference.empreinte
          ? chantier.clos === false
            ? { geste: GESTE_DE_REMISE_A_JOUR, prix: PRIX_DU_GESTE, aProposer: true, aImposer: false }
            : {
                geste: GESTE_DE_REMISE_A_JOUR,
                prix: PRIX_DU_GESTE,
                aProposer: false,
                aImposer: false,
                pourquoiPas:
                  chantier.clos === true
                    ? `son mandat est CLOS (${chantier.statut}) : le remettre à jour réveillerait un ` +
                      'chantier terminé, et deux orchestrateurs pourraient agir sur les mêmes panes'
                    : `son mandat n’a pas pu être mesuré (${chantier.raison}) — on ne propose rien ` +
                      'sur un chantier dont on ignore s’il existe encore',
              }
          : null,
    });
  }

  const aJour = agents.filter((a) => a.aJour === true).length;
  const enRetard = agents.filter((a) => a.aJour === false).length;
  const nonMesures = agents.filter((a) => a.aJour === null).length;
  // ⚠️ LES MANDATS SE COMPTENT À PART, et leurs trois états ne se replient pas en deux : un
  // mandat non mesuré compté avec les ouverts ferait dire au registre qu'il sait ce qu'il ignore.
  const mandatsClos = agents.filter((a) => a.chantier?.clos === true).length;
  const mandatsOuverts = agents.filter((a) => a.chantier?.clos === false).length;
  const mandatsNonMesures = agents.filter((a) => a.chantier?.clos == null).length;

  // ⚠️ UN COMPTE PAR RÔLE, ET « JE NE SAIS PAS » SE COMPTE À PART. Replier les rôles non établis
  // sur un rôle connu — même sur le plus probable — ferait dire au registre qu'il sait ce qu'il
  // ignore, et c'est précisément le tableau de bord « plus faux qu'une absence de tableau »
  // (HS-VUE-002). Les trois compartiments sont donc étanches, comme ceux du mandat au-dessus.
  const parRole = Object.fromEntries(rolesConnus().map((nom) => [nom, 0]));
  let roleNonEtabli = 0;
  let roleNonMesure = 0;
  for (const a of agents) {
    if (a.role.mesure === 'établi') parRole[a.role.nom] = (parRole[a.role.nom] ?? 0) + 1;
    else if (a.role.mesure === 'refusée') roleNonMesure += 1;
    else roleNonEtabli += 1;
  }

  // ⚠️ ET LES DEUX FAÇONS DE N'AVOIR PAS DE NOM SE COMPTENT SÉPARÉMENT, jusque dans le résumé.
  // Un lecteur qui ne lit que la dernière ligne — c'est-à-dire le lecteur normal — hériterait
  // sinon de la confusion qu'on a pris soin d'éviter sur chaque entrée. Mesuré le 2026-08-22 :
  // 35 des 94 agents du poste sont ANONYMES (vus, sans nom), et zéro non mesuré ce jour-là.
  const anonymes = agents.filter((a) => a.nom?.mesure === 'aucun').length;
  const nomsNonMesures = agents.filter((a) => a.nom?.mesure === 'refusée').length;

  // Les rôles réellement trouvés, nommés dans le résumé : « au moins 15 agents » ne dit pas
  // QUELS rôles, donc ne dit toujours pas au dirigeant quelle tranche du parc il regarde.
  const rolesTrouves = rolesConnus()
    .filter((nom) => parRole[nom] > 0)
    .map((nom) => `${parRole[nom]} ${roleDe(nom).libelle_pluriel}`);

  // ⚠️ LE BATTEMENT DE CŒUR — ÉCRIT MÊME QUAND LA RONDE N'A RIEN TROUVÉ. Un dispositif qui ne se
  // signale que lorsqu'il a quelque chose à dire est indiscernable d'un dispositif mort ; c'est
  // le pire cas de `balayage.js`, et il ne se rejoue pas ici.
  journaliser(
    `recensement — ${liste.length} pane(s) vus, AU MOINS ${agents.length} agent(s) : ` +
      (rolesTrouves.length ? rolesTrouves.join(', ') : 'aucun rôle établi') +
      `, ${roleNonEtabli} au rôle non établi, ${roleNonMesure} au rôle non mesuré ; ` +
      `${aJour} à jour, ${enRetard} en retard, ${nonMesures} non mesuré(s) ; mandats ` +
      `${mandatsOuverts} ouvert(s), ${mandatsClos} clos, ${mandatsNonMesures} non mesuré(s) ; ` +
      `${anonymes} anonyme(s), ${nomsNonMesures} nom(s) non mesuré(s)` +
      (panesSansAgent ? ` ; ${panesSansAgent} pane(s) sans agent, écartés` : '') +
      (sessionsRefusees.length
        ? ` — ⚠️ COMPTE AMPUTÉ : ${sessionsRefusees.length} session(s) herdr muette(s) : ` +
          sessionsRefusees.map((r) => `${r.session ?? 'sans socket'} (${r.raison})`).join(' ; ')
        : '')
  );

  return {
    quand,
    inventaireRefuse: null,
    panesVus: liste.length,
    references,
    // ⚠️ UN SEUL TABLEAU POUR TOUS LES RÔLES — RA-VUE-004. Un tableau par rôle divergerait au
    // premier correctif appliqué d'un seul côté ; le rôle vit SUR l'entrée, pas dans le nom du
    // tableau qui la contient.
    agents,
    compte: {
      parRole,
      roleNonEtabli,
      roleNonMesure,
      anonymes,
      nomsNonMesures,
      aJour,
      enRetard,
      nonMesures,
      mandatsOuverts,
      mandatsClos,
      mandatsNonMesures,
    },
    // ⚠️ LA BORNE VOYAGE AVEC LE CHIFFRE, dans le rendu — pas dans un compte rendu à côté.
    // C'est elle qui interdit de lire « sept orchestrateurs » comme « il y en a sept ».
    borne: {
      nature: 'plancher',
      phrase:
        `AU MOINS ${agents.length} agent(s) — ce compte est un PLANCHER, jamais un total : chaque ` +
        'amélioration de l’instrument en a trouvé davantage sur un parc inchangé (3, puis 5, puis ' +
        '7 dans la même matinée du 2026-08-19 ; 13 puis tout le poste le 2026-08-22, en ouvrant ' +
        'le registre aux autres rôles). Rien ne prouve qu’on a fini de chercher.',
      sessionsInterrogees,
      // Nommées, pas comptées : une session muette est une part du poste qu'on n'a pas regardée,
      // et savoir LAQUELLE est ce qui permet d'aller voir.
      sessionsRefusees,
      // Les chemins qui RESSEMBLAIENT à un lieu du rôle sans en porter le métier. Écartés à
      // juste titre, mais nommés : c'est ce qui distingue « il n'y en avait pas » de « j'en ai
      // écarté un, et voici lequel ».
      lieuxEcartes,
      // Les panes qui ont DÉCLARÉ ne porter aucun agent. Comptés, pas effacés : sans ce champ,
      // « 94 agents sur 97 panes » se lirait comme une perte de trois agents.
      panesSansAgent,
      angleMort: CE_QUE_LE_RECENSEMENT_NE_VOIT_PAS,
    },
    resume:
      `AU MOINS ${agents.length} agent(s) vivant(s) — ` +
      (rolesTrouves.length ? `${rolesTrouves.join(', ')}` : 'aucun rôle établi') +
      (roleNonEtabli ? `, ${roleNonEtabli} au rôle NON ÉTABLI` : '') +
      (roleNonMesure ? `, ${roleNonMesure} au rôle NON MESURÉ` : '') +
      ` — ${aJour} à jour, ${enRetard} en retard, ${nonMesures} non mesuré(s) ; mandats : ` +
      `${mandatsOuverts} ouvert(s), ${mandatsClos} clos, ${mandatsNonMesures} non mesuré(s)` +
      // ⚠️ LES DEUX FAÇONS DE N'AVOIR PAS DE NOM, DISTINCTES JUSQU'ICI. « anonyme » appelle à le
      // faire se nommer ; « non mesuré » appelle à refaire la mesure. Les fondre enverrait
      // corriger ce qui va bien.
      (anonymes ? ` ; ${anonymes} ANONYME(s), inadressable(s)` : '') +
      (nomsNonMesures ? ` ; ${nomsNonMesures} nom(s) NON MESURÉ(s) — ce n’est pas « sans nom »` : '') +
      '.' +
      (sessionsRefusees.length
        ? ` ⚠️ ${sessionsRefusees.length} session(s) herdr n’ont pas répondu : ce compte est amputé d’autant.`
        : ' (plancher, pas un total)'),
    regle: REGLE_DE_CONDUITE,
  };
}

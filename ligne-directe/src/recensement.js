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
// ⚠️ MÊME RAISON QUE CI-DESSUS : la FORME d'un code de chantier est écrite une seule fois, dans
// `mandat.js`. Ce module a besoin de savoir si un mandat EN EST un — pas de le lire, ce qui reste
// de l'I/O et entre par paramètre (`etatDuMandat`). Recopier la forme ici la ferait diverger au
// premier préfixe ajouté.
import { familleDuMandat } from './mandat.js';
// ⚠️ MÊME RAISON ENCORE : l'appariement d'une déclaration à un agent vivant est une RÈGLE, pas
// une donnée — et elle est déjà écrite (`declaration-des-agents.js`, qui emprunte lui-même la
// jointure d'espace à la garde qui l'a payée). La recopier ici la ferait diverger au premier
// correctif appliqué d'un seul côté, et celle qui divergerait ferait porter à un agent le rôle
// et le coordonnateur d'un autre. Ce n'est pas de l'I/O — les déclarations, elles, entrent par
// paramètre, comme tout le reste.
import {
  declarationDeLAgent,
  roleDeclareDe,
  libellesDuRoleDeclare,
  SOURCE_DECLAREE,
} from './declaration-des-agents.js';

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
 * CE QUE LA DÉCLARATION DE NAISSANCE DIT D'UN AGENT SANS LIEU — ou `null` quand elle ne dit rien.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ TROIS SORTIES, ET LA TROISIÈME EST CELLE QUI COÛTE.
 *
 *   • un bloc `role` en `mesure: 'déclarée'` — une déclaration l'apparie et porte un rôle ;
 *   • un bloc `role` en `mesure: 'refusée'` — ON N'A PAS PU CONCLURE, et l'appelant NE DOIT PAS
 *     le lire comme une absence ;
 *   • `null` — on a regardé, il n'y a rien : l'appelant rend « non établi », inchangé.
 *
 * 🔴 « PAS TROUVÉE » NE VAUT PAS « ABSENTE », ET DEUX CHOSES LE RENDENT VRAI ICI.
 *
 *   ① **Un fait ABÎMÉ peut être celui de cet agent-ci.** Le registre ne sait pas dire de qui
 *      parlait un fichier qu'il n'a pas su lire. C'est mot pour mot la règle que
 *      `garde-des-naissances.js` tient sur le même registre, un étage plus haut.
 *   ② **Un nom NON MESURÉ retire la clé de repli.** Le nom retrouve un agent dont le pane a
 *      bougé ; sans lui, l'appariement peut échouer sur un agent parfaitement déclaré. Et
 *      `herdr agents()` a déjà été mesuré à 83 panes sur 227 un jour : une panne de lecture
 *      suffirait, sinon, à faire retomber des agents déclarés dans « non établi ».
 *
 * ⚠️ ET UN REGISTRE ABSENT NE REFUSE PAS. `declarations = null` veut dire « on ne me l'a pas
 * donné » : l'appelant rend alors EXACTEMENT ce qu'il rendait avant ce lot, prose comprise.
 * C'est ce qui rend vérifiable « seuls les agents déclarés ont changé de rendu ».
 */
/**
 * CE QUE LE REGISTRE DIT DE SA SOURCE DÉCLARÉE — et « on ne me l'a pas donnée » se DIT.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE CHAMP EXISTE PARCE QU'UNE MUTATION A SURVÉCU. Retirer le câblage du veilleur —
 * `declarations: lesDeclarationsDuPoste()` — laissait les 1 065 essais du dépôt VERTS. C'est
 * même une propriété VOULUE du paramètre : sans registre, le rendu est exactement celui d'avant
 * T-20260825-0012. Le correctif devenait donc inerte sur le poste réel sans que rien ne rougisse,
 * et les chefs d'équipe déclarés y redevenaient « rôle non établi » en silence.
 *
 * ⚠️ ET LE COMPTE NE POUVAIT PAS L'ATTRAPER : `roleDeclare` vaut 0 quand personne n'est déclaré
 * COMME quand la source n'a pas été consultée. Un zéro qui recouvre deux états est très
 * exactement ce que ce module refuse partout ailleurs — « je n'ai pas su regarder » n'est pas
 * « j'ai regardé et il n'y a personne ».
 *
 * C'est donc au RENDU de porter la différence, dans `borne`, où vivent déjà les sessions muettes
 * et les angles morts — c'est-à-dire tout ce qui borne ce que ce compte vaut.
 */
function ceQueDitLaSourceDeclaree(registre) {
  if (!registre) {
    return {
      mesure: 'non donnée',
      faits: null,
      illisibles: null,
      consequence:
        'aucun registre de déclarations de naissance ne m’a été donné : les agents SANS lieu de ' +
        'rôle sont tous rendus « rôle non établi », y compris ceux qui sont parfaitement ' +
        'déclarés. Ce n’est PAS « aucun agent n’est déclaré » — c’est une source que je n’ai pas lue.',
    };
  }
  const faits = Array.isArray(registre.declarations) ? registre.declarations.length : 0;
  const illisibles = Array.isArray(registre.illisibles) ? registre.illisibles : [];
  // ⚠️ « QUELQUES FAITS ABÎMÉS » ET « JE N'AI RIEN PU LIRE DU TOUT » NE SE DISENT PAS PAREIL —
  // et l'étiquette disait « lue » dans les deux cas. Un registre dont le RÉPERTOIRE a refusé la
  // lecture n'a rien été mesuré : rendre « lue » y affirmait une mesure qui n'a pas eu lieu, sur
  // le champ même qui existe pour dire ce que le compte vaut. Le producteur marque ce refus
  // (`refusGlobal`, posé par `lesDeclarationsDuPoste`) ; on le rend, on ne le devine pas.
  if (registre.refusGlobal) {
    return {
      mesure: 'refusée',
      faits: null,
      illisibles,
      raison: String(registre.refusGlobal),
      consequence:
        'le registre des déclarations n’a pas pu être lu du tout : les agents SANS lieu de rôle ' +
        'sont rendus « refusée », jamais « non établi ». Ce n’est PAS « aucun agent n’est ' +
        'déclaré » — c’est un répertoire qu’il faut aller rouvrir.',
    };
  }
  return {
    mesure: 'lue',
    faits,
    // Nommés, pas comptés : un fait abîmé peut être celui de n'importe quel agent de ce rendu.
    illisibles,
  };
}

/**
 * COMBIEN D'ILLISIBLES ON NOMME DANS LA RAISON D'UN AGENT — et pourquoi ce n'est pas « tous ».
 *
 * Cette raison se compose PAR AGENT. Nommer les mille fichiers abîmés d'un registre malade sur
 * chacun des soixante agents sans lieu ferait un rendu que personne ne peut lire — et la ligne
 * de résumé, qui est ce qu'un humain lit, s'y noierait. Trois suffisent à reconnaître de quoi on
 * parle ; la liste INTÉGRALE vit dans `borne.sourceDeclaree.illisibles`, calculée une seule fois.
 */
const ILLISIBLES_NOMMES = 3;

function declarationDuPane(p, chemin, registre, nom) {
  if (!registre) return null;

  // 🔴 UN ESPACE NON MESURÉ N'EST PAS UN ESPACE QUI NE CORRESPOND PAS — et c'était le seul champ
  // du module sans son troisième état. Les DEUX clés d'appariement passent par l'espace ; quand
  // `foreground_cwd` et `cwd` manquent tous les deux, `memeEspaceDeTravail(null, …)` rend `false`
  // inconditionnellement, et un agent dont le pane, la session ET le nom concordent EXACTEMENT
  // avec sa propre déclaration recevait la prose d'un agent JAMAIS DÉCLARÉ. Le repli par le nom
  // — conçu précisément pour rattraper ce genre de cas — ne pouvait pas le sauver : il est borné
  // par le même espace.
  //
  // ⚠️ ON NE DEVINE PAS L'ESPACE POUR AUTANT. Le retirer de l'appariement ferait de la déclaration
  // d'un homonyme un laissez-passer — c'est la borne que ce lot a posée deux fois. On rend donc
  // « refusée » : « je n'ai pas pu mesurer où il travaille », qui envoie refaire la mesure, là où
  // « non établi » envoie le faire déclarer.
  if (!chemin) {
    return {
      mesure: 'refusée',
      nom: null,
      raison:
        'je n’ai pas pu lire où cet agent travaille (ni « foreground_cwd » ni « cwd ») — or les ' +
        'deux clés d’appariement d’une déclaration passent par son espace. « Pas trouvée » ne ' +
        'vaut donc pas « absente » : sa déclaration existe peut-être',
    };
  }

  // 🔴 UN REGISTRE QUI A REFUSÉ EN BLOC N'IDENTIFIE PERSONNE — MÊME S'IL PORTE DES FAITS.
  //
  // `ceQueDitLaSourceDeclaree`, dix lignes plus haut, lit `refusGlobal` EN PREMIER et rend
  // « refusée » ; cette fonction-ci ne le regardait pas. Les deux moitiés du MÊME rendu pouvaient
  // donc se contredire : la borne annonçant « le registre n'a pas pu être lu du tout », et le
  // résumé, dans la même page, « 1 chef d'équipe DÉCLARÉ » avec son mandat et son coordonnateur.
  // C'est la confusion que RA-VUE-006 interdit, servie au lecteur en une seule vue.
  //
  // ⚠️ AUCUN CHEMIN DE PRODUCTION N'Y MÈNE AUJOURD'HUI — `lesDeclarationsDuPoste` force
  // `declarations: []` dans sa branche de refus. Mais la cohérence d'un rendu ne peut pas
  // dépendre de la discipline de son appelant : `unRecensement` est EXPORTÉ, et le jour où un
  // second producteur rend les deux à la fois, rien ici ne l'arrêterait. On refuse donc au même
  // endroit que la borne, sur le même champ, et on le DIT — « je n'ai pas pu lire » n'est jamais
  // « il n'a pas de déclaration ».
  if (registre.refusGlobal) {
    return {
      mesure: 'refusée',
      nom: null,
      raison:
        `le registre des déclarations n’a pas pu être lu du tout (${String(registre.refusGlobal)}) : ` +
        `je n’identifie personne dessus, même s’il porte des faits — ils ne sont pas ceux d’une ` +
        `lecture aboutie`,
    };
  }

  const trouvee = declarationDeLAgent(
    {
      pane: p?.pane_id ?? p?.pane ?? null,
      session: p?.herdr_socket ?? p?.socket ?? null,
      espace: chemin,
      nom,
    },
    registre.declarations
  );
  if (trouvee) {
    // Une déclaration SANS rôle n'en invente pas un : on retombe sur ce qu'on rendait avant.
    const declare = roleDeclareDe(trouvee);
    if (declare) return declare;
  }

  // ⚠️ CE QU'ON A TROUVÉ CHANGE CE QU'ON A LE DROIT DE DIRE. Les deux raisons ci-dessous
  // s'ouvraient toutes deux sur « aucune déclaration ne l'apparie » — faux quand `trouvee`
  // existait et ne portait simplement pas de rôle. Un lecteur était alors envoyé chercher un
  // fichier étranger (« la sienne peut être dedans »), ou soupçonner un nom qui n'avait jamais
  // été nécessaire, alors que la déclaration était là, sous ses yeux, et muette sur le rôle.
  const tete = trouvee
    ? `une déclaration l’apparie mais ne porte AUCUN rôle (inscrite le ${trouvee.ne_le ?? 'sans date'})`
    : 'aucune déclaration de naissance ne l’apparie';

  const illisibles = Array.isArray(registre.illisibles) ? registre.illisibles : [];
  if (illisibles.length) {
    return {
      mesure: 'refusée',
      nom: null,
      // ⚠️ LA LISTE EST BORNÉE ICI, ET ELLE NE L'ÉTAIT PAS. Cette raison se compose PAR AGENT :
      // sur le parc réel, 63 des 83 agents sont sans lieu, et chacun recevait la liste ENTIÈRE
      // des illisibles. Vingt fichiers abîmés faisaient donc plus de mille fragments répétés
      // dans un rendu dont la ligne de résumé est ce qu'un humain lit. Le module borne déjà de
      // la même façon partout ailleurs — `lieuxEcartes`, `panesIndecidables`,
      // `sessionsRefusees` sont calculés UNE fois, dans `borne`.
      //
      // ⚠️ ET CE QU'ON COUPE SE DIT. Un « … » muet ferait croire à une liste complète ; le
      // compte total reste en tête de phrase, et `borne.sourceDeclaree.illisibles` porte la
      // liste intégrale pour qui veut aller voir.
      raison:
        `${tete}, et le registre en porte ` +
        `${illisibles.length} d’ILLISIBLE(s) — la sienne peut être dedans : ` +
        illisibles
          .slice(0, ILLISIBLES_NOMMES)
          .map((i) => `${i.fichier} (${i.cause})`)
          .join(', ') +
        // ⚠️ `>` ET NON `>=` — SURVIVANTE. À EXACTEMENT trois illisibles, `>=` faisait rendre
        // « … et 0 autre(s) », une phrase qui se contredit elle-même. Aucun banc n'employait ce
        // nombre-là : la frontière d'une coupe se mesure SUR sa frontière, jamais à côté.
        (illisibles.length > ILLISIBLES_NOMMES
          ? ` … et ${illisibles.length - ILLISIBLES_NOMMES} autre(s) — tous nommés dans « borne.sourceDeclaree.illisibles »`
          : ''),
    };
  }
  if (nom?.mesure === 'refusée') {
    return {
      mesure: 'refusée',
      nom: null,
      raison:
        `${tete}, et ${nom.raison ?? 'son nom n’a pas été mesuré'} ` +
        `— or le nom est la clé de repli de l’appariement : sans lui, « pas trouvée » ne vaut pas « absente »`,
    };
  }
  return null;
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
 * @param roleDuLieu  `(repertoire) → '<rôle>'|null` — le rôle établi PAR LE FAIT, pour TOUS les
 *                    rôles connus. Le dossier de chaque rôle vient de `roles.js`, jamais d'un
 *                    paramètre : un `dossier` unique ne pouvait porter qu'un seul rôle.
 * @param mesurer     `(lieu) → { empreinte, octets }|null`.
 * @param references  `{ '<rôle>': { empreinte, octets, chemin } | { refus } }` — UNE PAR RÔLE, et
 *                    jamais devinée. Un rôle absent de cet objet ne se rabat sur AUCUNE autre :
 *                    il rend `aJour: null`. Se rabattre comparerait deux métiers qui n'ont
 *                    aucune raison de concorder — le défaut que T-20260822-0010 ferme.
 * @param lireEcran   `(pane) → texte|null` — pour le travail en vol. Facultatif : sans lui, le
 *                    travail en vol est rendu `non mesuré`, jamais « rien en vol ».
 * @param maintenant  l'horloge en ms. Injectée : un recensement doit pouvoir être rejoué.
 * @param journaliser `(message) → void` — le battement de cœur de la ronde.
 *
 * @returns le compte rendu (voir la forme dans le corps).
 *
 * ⚠️ LA PIÈCE MAÎTRESSE : QUAND L'INVENTAIRE REFUSE, `agents` EST `null`, PAS `[]`.
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
  // ⚠️ LE REGISTRE DES DÉCLARATIONS DE NAISSANCE — INJECTÉ, et `null` VEUT DIRE « ON NE ME L'A
  // PAS DONNÉ », jamais « personne n'est né ». C'est de l'I/O (il vit hors dépôt, dans
  // `~/.somtech/naissances`) : il entre donc par paramètre comme tout le reste, ce qui garde ce
  // module éprouvable loin du poste réel.
  //
  // ⚠️ SANS LUI, LE RENDU EST STRICTEMENT CELUI D'AVANT. Ce n'est pas de la prudence de style :
  // c'est ce qui rend vérifiable la promesse « seuls les agents déclarés ont changé de rendu »
  // (T-20260825-0012). Un appelant qui ne le passe pas ne voit RIEN bouger, pas même une prose.
  //
  // ⚠️ ET SA FORME PORTE CE QU'ON N'A PAS SU LIRE. `{ declarations, illisibles }` — un fait
  // abîmé peut être celui de CET agent-ci, donc « pas trouvée » n'y vaut pas « absente » : un
  // registre qui porte des illisibles rend le rôle « refusée », jamais « non établi ». C'est la
  // règle que `garde-des-naissances.js` tient déjà sur le même registre, un étage plus haut.
  declarations = null,
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
  const panesIndecidables = [];
  for (const p of liste) {
    // ⚠️ SEULE UNE DÉCLARATION ÉCARTE, JAMAIS UN SILENCE — et ce qui suit est la DEUXIÈME forme
    // que prend la déclaration dans la source réelle. Le principe ne bouge pas ; c'est
    // l'attribution qui était fausse, et elle l'était dans le code ET dans son banc.
    //
    // 🔴 MESURÉ SUR `herdr pane list`, LE 2026-08-22, 97 panes : la clé `agent` est PRÉSENTE sur
    // 94, et `agent: null` ne sort JAMAIS — zéro occurrence. Pour les 3 panes sans agent, herdr
    // OMET la clé et pose `agent_status: "unknown"`. Le test « clé présente et falsy » ne pouvait
    // donc rien écarter : `panesSansAgent` valait 0 sur un poste qui en portait 3, et trois
    // TERMINAUX — dont un ouvert dans le répertoire personnel — étaient rendus comme des agents
    // vivants « au rôle non établi », avec un nom « NON MESURÉ » qui envoie refaire la mesure.
    // C'est mot pour mot le faux positif que le commentaire ci-dessus dit vouloir empêcher.
    //
    // ⚠️ ET LE BANC LE TENAIT VERT AVEC UNE FORME QUE LA SOURCE NE PRODUIT PAS : il injectait
    // `{ agent: null }`. Un double plus coopératif que le réel — le motif que ce lot a déjà payé
    // deux fois. C'est pourquoi la garde neuve est éprouvée sur la forme MESURÉE.
    //
    // La déclaration, c'est donc l'un OU l'autre — mais TOUJOURS confirmée par le statut, jamais
    // l'absence seule : `agent_status: 'unknown'` est ce que herdr pose quand il sait qu'il n'y a
    // personne (mesuré : les 3 sans clé l'ont, les 94 autres portent done/idle/working/blocked).
    //
    // ⚠️ ET `agent_session` PASSE AVANT TOUT — REJET de revue de fond, et c'est le faux négatif
    // SYMÉTRIQUE de celui que le critère ci-dessus vient de fermer. `agent_session` est le
    // discriminant que ce dépôt a établi il y a deux jours (`herdr.js` : « la marque qu'une
    // session d'agent habite ce pane, QUE LE REGISTRE L'AIT INSCRITE OU NON ») et je ne le
    // consultais pas. Or T-20260820-0022 a mesuré exactement la forme qui tombait dans le
    // nouveau critère : toute session née après le 18 août 14 h 52 sortait avec `agent_session`
    // PRÉSENT, aucune clé `agent`, et `agent_status: "unknown"` — parce que herdr ignorait son
    // statut, pas parce qu'il n'y avait personne. Un agent vivant était donc écarté du registre
    // ET compté parmi les panes qui ont DÉCLARÉ n'en porter aucun : le registre affirmait une
    // mesure fausse sur la population même qu'il existe pour trouver.
    //
    // Mesuré sur le poste le 2026-08-22 : les 94 panes qui portent un agent ont TOUS
    // `agent_session`, les 3 terminaux ne l'ont pas. Une session qui habite le pane suffit donc
    // à interdire de le déclarer vide, quel que soit ce que le registre en dit.
    const sansAgentDeclare =
      p &&
      !p.agent_session &&
      (!Object.hasOwn(p, 'agent') || !p.agent) &&
      p.agent_status === 'unknown';
    if (sansAgentDeclare) {
      panesSansAgent += 1;
      continue;
    }
    // ⚠️ ET LE TROISIÈME CAS SE DIT, IL NE SE TRANCHE PAS. Un pane sans clé `agent` dont le statut
    // n'est PAS `unknown` n'a rien déclaré du tout : l'écarter le ferait taire, le recenser
    // affirmerait un agent. On le recense — ne jamais omettre reste la règle — et on le NOMME
    // ici, pour que « 97 agents » ne se lise pas comme « 97 agents certains ».
    // ⚠️ ET UNE SESSION QUI HABITE LE PANE N'EST PAS UN DOUTE. `agent_session` est une PREUVE de
    // présence — le registre peut ignorer le statut sans que l'occupation soit incertaine.
    // Compter ces panes comme « indécidables » ferait porter au rendu un doute qu'on n'a pas.
    if (p && !Object.hasOwn(p, 'agent') && !p.agent_session) {
      panesIndecidables.push({
        pane: p?.pane_id ?? p?.pane ?? null,
        pourquoi: `la source n’a pas dit si ce pane porte un agent (statut « ${p.agent_status ?? 'absent'} ») — il est recensé, sans preuve`,
      });
    }
    // ⚠️ LE CHEMIN DE TRAVAIL, PAS LE `cwd`. Un agent né par `claude-swt` garde le dépôt
    // principal en `cwd` pendant que son lieu vit ailleurs — `herdr.js` le dit déjà de son côté.
    const chemin = p?.foreground_cwd || p?.cwd || null;
    const candidat = lieuDeRoleDansLeChemin(chemin);
    const lieu = candidat?.lieu ?? null;
    const mandat = candidat?.mandat ?? null;
    const pane = p?.pane_id ?? p?.pane ?? null;
    // ⚠️ LA SESSION VOYAGE AVEC LE PANE, TOUJOURS. Un identifiant de pane n'est unique que dans
    // sa session : ce poste en porte quinze, et deux y emploient le même `w5:p3`.
    const socket = p?.herdr_socket ?? p?.socket ?? null;
    // ⚠️ LE NOM SE MESURE ICI PLUTÔT QU'AU MOMENT DE RENDRE L'ENTRÉE, ET C'EST UN DÉPLACEMENT,
    // PAS UN CALCUL DE PLUS. Il est la clé de REPLI de l'appariement d'une déclaration — un
    // agent dont le pane a bougé n'est retrouvé que par lui — donc le rôle en dépend, et le
    // rôle se décide avant. Une seconde mesure du nom ici en ferait deux qui peuvent diverger.
    const nomDeCetAgent = nomDeLAgent(p, `${socket ?? ''}\u0000${pane}`, nomsConnus);

    // ═══ LE RÔLE, EN TROIS ÉTATS QUI NE SE REPLIENT PAS. « établi » · « non établi » (mesuré,
    // aucun rôle connu ne correspond) · « refusée » (le lieu ne s'est pas laissé lire). Le
    // troisième existe parce qu'un module qui rend la même chose quand il ne sait pas et quand
    // il n'y a rien est indiscernable d'un module qui ment.
    let role;
    if (!candidat) {
      // ═══ AUCUN LIEU NE LE PORTE — ON DEMANDE ALORS À SA DÉCLARATION DE NAISSANCE.
      //
      // ⚠️ ET SEULEMENT ICI. Un agent qui occupe un lieu de rôle passe par la branche du dessous,
      // où le rôle se MESURE au lieu : le PROUVÉ prime le DÉCLARÉ (RA-VUE-006), et ajouter cette
      // source ne peut donc pas dégrader une ligne qui était déjà juste. Un lieu à DEMI POSÉ y
      // reste « non établi » avec sa prose — « va finir de le poser » est le geste à faire, et
      // le recouvrir d'un rôle déclaré le ferait disparaître.
      const declaree = declarationDuPane(p, chemin, declarations, nomDeCetAgent);
      role = declaree ?? {
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
        // ⚠️ `roleDe` EST DANS LE `try`, ET C'ÉTAIT UNE RÉSERVE DE REVUE. Il était hors : un
        // `roleDuLieu` rendant un nom hors table faisait tomber TOUT le recensement
        // (`RoleInconnu`), là où un `roleDuLieu` qui JETTE était proprement rattrapé — deux
        // traitements opposés pour le même collaborateur, et le plus sévère réservé au cas le
        // moins bruyant. Un registre qui meurt entier parce qu'UNE entrée est inclassable est
        // le contraire de sa règle : il MESURE et REND, il ne présume jamais.
        let libelle;
        try {
          libelle = roleDe(etabli).libelle;
        } catch (err) {
          role = {
            mesure: 'refusée',
            nom: null,
            raison:
              `le lieu « ${lieu} » établit un rôle « ${etabli} » que la table des rôles ne connaît ` +
              `pas (${motDeLErreur(err)}) — c’est la MESURE qui est hors table, pas l’agent`,
          };
        }
        if (libelle !== undefined) role = { mesure: 'établi', nom: etabli, libelle };
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

    // ═══ « JE N'AI PAS PU MESURER » ET « IL N'Y A RIEN À MESURER » NE SE DISENT PAS PAREIL.
    //
    // ⚠️ DÉFAUT RÉEL, TROUVÉ EN REVUE DE FOND, ET C'EST CE REGISTRE QUI LE FABRIQUAIT. Le métier
    // n'était mesuré que si le rôle était établi, et TOUT `null` était ensuite rendu « le métier
    // de … ne s'est pas laissé mesurer ». Sur le parc réel : 81 des 97 entrées portaient
    // « le métier de « null » ne s'est pas laissé mesurer » — le message qui veut dire VA VOIR,
    // L'INSTRUMENT A ÉCHOUÉ, pour des agents qui n'ont simplement aucun lieu de rôle.
    //
    // Le coût n'est pas cosmétique, et il est double : on envoie chercher une panne qui n'existe
    // pas, ET on noie le seul cas où ce message est vrai — un lieu réel dont le métier refuse la
    // lecture — dans 81 fausses alertes de forme identique. C'est très exactement le « faux
    // positif dans un registre dont tout l'objet est de n'en produire aucun » que ce module
    // s'interdit trente lignes plus haut, pris à l'envers : une lecture JAMAIS ENTREPRISE se
    // disait « je n'ai pas pu ».
    // ⚠️ QUATRE ÉTATS, PAS TROIS — et le quatrième est un REJET de revue de fond contre le
    // correctif précédent. « Le lieu ne s'est pas laissé lire » avait été rangé avec « il n'y a
    // rien à mesurer », donc compté dans `metierSansObjet` et rendu dans le résumé sous
    // l'étiquette « rien à mesurer, PAS UN ÉCHEC ». C'est l'erreur exactement INVERSE de celle
    // qu'on venait de corriger : un vrai échec de mesure silencieusement classé « rien à voir
    // ici », pendant que `nonMesures` — la colonne qui appelle à aller voir — restait à zéro.
    //
    //   • « lue »          — mesurée, on a l'empreinte ;
    //   • « refusée »      — on a TENTÉ de lire le métier et ça a échoué ;
    //   • « non mesurée »  — on n'a pas pu tenter : un amont a refusé (le lieu est illisible) ;
    //   • « sans objet »   — il n'y a rien à mesurer, et ça n'appelle aucun geste.
    //
    // Seul le dernier est « pas un échec ». Les deux du milieu se comptent avec les non-mesurés.
    const aQuoiMesurer = role.mesure === 'établi' && Boolean(lieu);
    const mesure = aQuoiMesurer ? mesurer(lieu) : null;
    const metier = mesure
      ? { mesure: 'lue', empreinte: mesure.empreinte, octets: mesure.octets }
      : aQuoiMesurer
        ? { mesure: 'refusée', refus: `le métier de « ${lieu} » ne s’est pas laissé mesurer` }
        : role.mesure === 'refusée'
          ? {
              mesure: 'non mesurée',
              raison:
                `le lieu « ${lieu} » ne s’est pas laissé lire : on n’a pas pu tenter de mesurer son ` +
                'métier. Ce n’est pas le métier qui a refusé — c’est le lieu, et il faut refaire la mesure',
            }
          : lieu
            ? {
                // ⚠️ UN LIEU QUI EXISTE NE SE DIT PAS « IL N'Y A PAS DE LIEU » — REJET de revue de
                // fond. Le refactor à quatre états avait laissé UNE SEULE prose pour les deux cas
                // de « non établi » : celui sans lieu du tout, et le LIEU À DEMI POSÉ, où `lieu`
                // est bien là. Ce second cas est T-20260819-0070, que ce module cite comme sa
                // motivation — et il recevait « aucun lieu de rôle ne porte cet agent », c'est-à-
                // dire « rien à faire », au lieu de « le lieu est là, va finir de le poser ». Sur
                // le parc réel, 78 agents portent légitimement la première phrase : celui qui a un
                // lieu s'y noyait, sous les mêmes mots.
                mesure: 'sans objet',
                pourquoi:
                  `le lieu « ${lieu} » porte le dossier d’un rôle sans en porter le métier — il n’y a ` +
                  'pas de métier à mesurer tant qu’il n’est pas achevé. Le lieu EXISTE : il est à finir de poser',
              }
            : {
                mesure: 'sans objet',
                pourquoi: 'aucun lieu de rôle ne porte cet agent : il n’y a pas de métier à mesurer',
              };

    // ⚠️ `idle` NE DIT RIEN DU MANDAT. Un chantier clos et une session au repos rendent tous les
    // deux `idle` — c'est écrit ici parce que c'est ici qu'on serait tenté de les confondre.
    //
    // ⚠️ ET ON N'INTERROGE PAS LE SERVICEDESK SUR CE QUI N'EST PAS UN CHANTIER — même motif que
    // pour le métier ci-dessus. Le segment sous le dossier de rôle nomme un CODE DE CHANTIER
    // pour un orchestrateur et un NOM DE CLIENT pour un représentant (`roles.js`,
    // `mandat_designe`). Poser la question pour les seconds rendait « « Charles-Olivier » n'est
    // pas un code de chantier : son état ne se lit nulle part » — la formulation d'une mesure
    // ratée pour une question qui n'avait pas lieu d'être posée. Sans lieu du tout, c'était
    // « « null » n'est pas un code de chantier », 81 fois.
    // ⚠️ C'EST LE RÔLE ÉTABLI QUI DÉCIDE, JAMAIS LE DOSSIER — et c'est un REJET de revue de fond.
    // Lu sur `candidat.role` (le rôle que le CHEMIN annonce), ce test se trompait dans les deux
    // sens, et le module dit lui-même trente lignes plus haut que les deux peuvent diverger :
    //   • un lieu `.gestionnaire/…` qu'on n'a PAS PU LIRE était classé « sans objet — le mandat
    //     d'un représentant nomme son client », c'est-à-dire qu'un vrai échec de mesure était
    //     silencieusement rangé en « rien à voir ici », dans la même entrée qui venait de dire
    //     « je n'ai pas pu lire ce lieu » ;
    //   • un lieu `.orchestrateur/…` portant le métier d'un REPRÉSENTANT faisait interroger le
    //     ServiceDesk sur son nom, et le comptait parmi les mandats ouverts.
    // La branche `metier` juste au-dessus lit `role.mesure` ; celle-ci ne l'avait pas suivie.
    //
    // ⚠️ ET UN MANDAT QUI A LA FORME D'UN CODE DE CHANTIER SE LIT, QUEL QUE SOIT LE MÉTIER DU
    // LIEU — second REJET contre ce même correctif, et celui-là ouvrait un geste dangereux.
    // Indexer la question sur le seul rôle ÉTABLI faisait, pour un lieu
    // `.orchestrateur/d-20260822-0077/` portant le métier d'un représentant — la divergence que ce
    // module déclare supportée quinze lignes plus haut — affirmer « ce mandat ne nomme pas un
    // chantier » d'un code que `familleDuMandat` reconnaît parfaitement, NE PAS interroger le
    // ServiceDesk, et donc PROPOSER `/clear` sur un chantier CLOS : très exactement le réveil que
    // la garde de `remiseAJour` existe pour retenir (T-20260819-0056). La garde s'était retrouvée
    // indexée sur le métier écrit dans le fichier, alors que le risque vit dans le mandat porté
    // par le chemin.
    //
    // On n'affirme donc « sans objet » que quand le mandat n'a PAS la forme d'un code ET que le
    // rôle établi dit qu'il n'en porte pas. Le doute va toujours vers la LECTURE : lire pour rien
    // coûte un appel, ne pas lire coûte un chantier réveillé.
    const mandatDesigne = role.mesure === 'établi' ? roleDe(role.nom).mandat_designe : null;
    const chantier = !mandat
      ? {
          mesure: 'sans objet',
          clos: null,
          pourquoi: 'aucun lieu de rôle ne porte cet agent : il n’y a pas de mandat à lire',
        }
      : familleDuMandat(mandat)
        ? etatDuMandat
          ? await etatDuMandat(mandat)
          : { mesure: 'non mesurée', clos: null, raison: 'aucun lecteur d’état de mandat ne m’a été donné' }
        : role.mesure !== 'établi'
          ? {
              // ⚠️ « JE NE SAIS PAS CE QUE CE MANDAT DÉSIGNE » N'EST PAS « IL N'Y A RIEN À LIRE ».
              // Sans rôle établi, et le mandat n'ayant pas la forme d'un code, on ignore ce que ce
              // segment nomme : c'est un échec de mesure, et le ranger en « sans objet » le ferait
              // disparaître du décompte des choses à aller voir.
              mesure: 'non mesurée',
              clos: null,
              raison:
                `le rôle de cet agent n’est pas établi (${role.mesure}) : on ne sait pas si « ${mandat} » ` +
                'nomme un chantier ou autre chose, donc on ne lit rien',
            }
          : mandatDesigne && mandatDesigne !== 'chantier'
            ? {
                mesure: 'sans objet',
                clos: null,
                pourquoi:
                  `le mandat d’un ${roleDe(role.nom).libelle} nomme ${mandatDesigne === 'client' ? 'son client' : 'autre chose'}, ` +
                  `et « ${mandat} » n’a pas la forme d’un code de chantier : son état ne se lit nulle part`,
              }
            : {
                // ⚠️ ET C'EST AUSSI LA BRANCHE D'UN RÔLE FUTUR QUI N'AURAIT PAS DE
                // `mandat_designe` — réserve de revue. Sans le test `mandatDesigne &&` ci-dessus,
                // un rôle ajouté à `roles.js` sans cette clé tombait en « sans objet », donc se
                // voyait PROPOSER `/clear` par défaut : un geste destructeur offert sur un rôle
                // dont on ne sait rien. Le défaut par défaut doit être « je ne sais pas », jamais
                // « rien à voir ici ».
                //
                // ⚠️ UN CHANTIER QU'ON NE PEUT PAS TRACER N'EST PAS UNE ABSENCE DE CHANTIER —
                // attrapé par un banc préexistant, et il avait raison. Un orchestrateur PORTE un
                // chantier par définition de son rôle ; celui-ci peut s'appeler `matapedia` ou
                // `general` (« son lieu est parfaitement valide, et son chantier n'est traçable
                // nulle part », `mandat.js`). C'est un mandat dont l'état NE SE MESURE PAS, pas un
                // mandat qui n'existe pas : le ranger en « sans objet » le sortirait du décompte
                // des choses qu'on ignore, sous une étiquette qui dit « pas un échec ».
                mesure: 'non mesurée',
                clos: null,
                raison:
                  `« ${mandat} » n’est pas un code de chantier : son état ne se lit nulle part. Ce rôle ` +
                  'en porte pourtant un — c’est un chantier NON TRAÇABLE, pas une absence de chantier',
              };
    const enVol = lireEcran
      ? travailEnVol(await lireEcran(p))
      : { mesure: 'non mesurée', raison: 'aucun lecteur d’écran ne m’a été donné', enVol: null };

    // ⚠️ L'ÉCART N'EXISTE QUE SI LES DEUX CÔTÉS ONT ÉTÉ MESURÉS. Une référence absente ou un
    // métier illisible ne font JAMAIS conclure « à jour » : ils rendent `null`, qui se lit
    // « je ne sais pas » et ne se compte ni dans les à-jour ni dans les en-retard.
    const comparable = Boolean(mesure && reference?.empreinte);
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
      // ⚠️ MESURÉ UNE SEULE FOIS, PLUS HAUT — le rôle en dépend (il est la clé de repli de
      // l'appariement d'une déclaration), donc il se mesure avant lui. Deux mesures du même nom
      // sont deux choses qui peuvent diverger, et celle qui divergerait ferait rendre au registre
      // un nom qui n'est pas celui sur lequel il a classé.
      nom: nomDeCetAgent,
      // Ce que le LIEU nomme : le code du chantier pour un orchestrateur, le client pour un
      // représentant. `null` quand aucun lieu de rôle ne porte cet agent — et un `null` ici se
      // lit avec `role.mesure`, qui dit POURQUOI.
      mandat,
      lieu,
      // ⚠️ LE TITRE DE FENÊTRE — ET C'EST LA SEULE CHOSE QUE LE DIRIGEANT RECONNAÎT À L'ŒIL.
      // EF-VUE-006 : le pane, la session, le dossier ET le nom de l'agent lui avaient été
      // donnés, et il a répondu « je trouve pas le pane ». Ce poste porte treize sessions herdr,
      // chacune numérotant ses panes indépendamment ; `w7M:p2` ne désigne rien pour un humain.
      //
      // 🔴 LA CLÉ EST OMISE PAR LA SOURCE QUAND IL N'Y EN A PAS, elle n'est pas rendue à `null`
      // — mesuré le 2026-08-22 : `herdr pane list` porte `terminal_title` sur 73 panes sur 76.
      // C'est la forme exacte du piège déjà payé sur `agent` (voir `formes-reelles.js`), et le
      // `?? null` est ce qui empêche `undefined` de fuir jusque dans le texte rendu.
      titre: p?.terminal_title ?? null,
      // L'état de la SESSION — et rien de plus. Il ne dit pas si le chantier existe encore.
      //
      // ⚠️ ET IL NE DIT PAS NON PLUS S'IL TRAVAILLE : `idle` signifie « vu au registre », pas
      // « au repos » — zéro `working` sur 227 cas mesurés. La vue ne le rend jamais tel quel
      // (EF-VUE-005) ; c'est `travailEnVol`, plus bas, qui répond à cette question-là.
      statut: p?.agent_status ?? null,
      // L'état du CHANTIER, qui est une autre question et une autre source.
      chantier,
      metier,
      // ⚠️ LA RÉFÉRENCE EST RENDUE SUR L'ENTRÉE, PAS SEULEMENT DANS LE JEU GLOBAL. `aJour: null`
      // a TROIS causes qui appellent trois gestes différents — le métier n'a pas été mesuré, le
      // rôle n'est pas établi, ou aucune référence n'existe pour ce rôle — et sans ce champ,
      // l'entrée les rend toutes les trois comme un « je ne sais pas » muet. Mesuré en écrivant
      // la garde du câblage des références : elle ne pouvait rien affirmer, faute de ce champ.
      reference,
      aJour: comparable ? mesure.empreinte === reference.empreinte : null,
      ecartOctets: comparable ? mesure.octets - reference.octets : null,
      travailEnVol: enVol,
      // Le geste est RENDU, jamais envoyé — et il ne vient jamais sans son prix.
      //
      // ⚠️ ET IL NE SE PROPOSE QU'À UN MANDAT PROUVÉ OUVERT. Ni à un mandat clos — réveiller
      // deux orchestrateurs sur les mêmes panes, chacun croyant l'autre parti, est le vrai
      // risque nommé par T-20260819-0056 — ni à un mandat NON MESURÉ, parce que se rabattre sur
      // « probablement ouvert » referait automatiquement l'écart qu'un humain a commis une fois.
      //
      // ⚠️ ET « PAS DE CHANTIER » N'EST PAS « CHANTIER DONT J'IGNORE L'ÉTAT » — REJET de revue de
      // fond, et c'est le champ qui porte l'ACTION. La garde exigeait `chantier.clos === false`,
      // c'est-à-dire un chantier PROUVÉ OUVERT. Pour un représentant, dont le mandat nomme un
      // client et non un chantier, `clos` vaut `null` par construction : `aProposer: true` était
      // donc STRUCTURELLEMENT hors d'atteinte pour le rôle que ce lot ajoute, et le motif affiché
      // était `son mandat n’a pas pu être mesuré (undefined)` — une panne d'instrument fabriquée,
      // avec un `undefined` littéral dans la prose, parce que la forme « sans objet » porte
      // `pourquoi` et non `raison`.
      //
      // Le risque que cette garde protège — réveiller un chantier terminé — n'existe pas quand il
      // n'y a pas de chantier. On propose donc, et on ne se tait que sur un mandat CLOS ou sur un
      // mandat qu'on n'a pas su lire.
      remiseAJour:
        comparable && mesure.empreinte !== reference.empreinte
          ? chantier.clos === false || chantier.mesure === 'sans objet'
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
                    : // ⚠️ JAMAIS `undefined` DANS LA PROSE : un message construit sur un champ
                      // absent est la trace visible qu'on parle d'un objet qu'on n'a pas.
                      `son mandat n’a pas pu être mesuré (${chantier.raison ?? chantier.pourquoi ?? 'sans raison dite'}) — ` +
                      'on ne propose rien sur un chantier dont on ignore s’il existe encore',
              }
          : null,
    });
  }

  const aJour = agents.filter((a) => a.aJour === true).length;
  const enRetard = agents.filter((a) => a.aJour === false).length;
  // ⚠️ ET « SANS OBJET » SE COMPTE À PART DE « PAS SU MESURER » — jusque dans le résumé, qui est
  // la seule ligne que le lecteur normal lit. Fondus, ils faisaient dire au registre « 81 non
  // mesurés » là où il n'y avait rien à mesurer : le lecteur y lisait un instrument en panne sur
  // 84 % du parc, et le seul vrai échec disparaissait dedans.
  // ⚠️ SEUL « sans objet » EST « PAS UN ÉCHEC ». « refusée » (on a tenté, ça a échoué) et
  // « non mesurée » (un amont a refusé) se comptent avec les non-mesurés : les ranger avec les
  // sans-objet les ferait sortir sous une étiquette qui dit littéralement « pas un échec ».
  const metierSansObjet = agents.filter((a) => a.aJour === null && a.metier?.mesure === 'sans objet').length;
  const nonMesures = agents.filter((a) => a.aJour === null && a.metier?.mesure !== 'sans objet').length;
  // ⚠️ LES MANDATS SE COMPTENT À PART, et leurs états ne se replient pas les uns sur les autres :
  // un mandat non mesuré compté avec les ouverts ferait dire au registre qu'il sait ce qu'il
  // ignore ; un mandat SANS OBJET compté avec les non mesurés lui ferait dire qu'il a échoué là
  // où il n'a rien tenté.
  const mandatsClos = agents.filter((a) => a.chantier?.clos === true).length;
  const mandatsOuverts = agents.filter((a) => a.chantier?.clos === false).length;
  const mandatsSansObjet = agents.filter((a) => a.chantier?.mesure === 'sans objet').length;
  const mandatsNonMesures = agents.filter(
    (a) => a.chantier?.clos == null && a.chantier?.mesure !== 'sans objet'
  ).length;

  // ⚠️ UN COMPTE PAR RÔLE, ET « JE NE SAIS PAS » SE COMPTE À PART. Replier les rôles non établis
  // sur un rôle connu — même sur le plus probable — ferait dire au registre qu'il sait ce qu'il
  // ignore, et c'est précisément le tableau de bord « plus faux qu'une absence de tableau »
  // (HS-VUE-002). Les trois compartiments sont donc étanches, comme ceux du mandat au-dessus.
  const parRole = Object.fromEntries(rolesConnus().map((nom) => [nom, 0]));
  // ⚠️ UN QUATRIÈME COMPARTIMENT, ET IL EST ÉTANCHE COMME LES TROIS AUTRES. Verser les rôles
  // DÉCLARÉS dans `parRole` ferait dire au registre qu'il a MESURÉ ce qu'on lui a déclaré — la
  // confusion exacte que RA-VUE-006 interdit. Les compter avec les « non établis » ferait
  // l'inverse : il tairait ce qu'il sait. Un compte à part, donc, avec sa ventilation.
  //
  // ⚠️ ET `parRoleDeclare` N'EST PAS PRÉ-REMPLI depuis `rolesConnus()`. Les rôles déclarés ne
  // sont PAS ceux de cette table (un chef d'équipe n'y est pas, et `chef-equipe.js` mesure ce
  // que l'y forcer casse) : la pré-remplir afficherait des rôles à zéro qui ne se déclarent
  // jamais, et tairait ceux qui se déclarent.
  const parRoleDeclare = {};
  let roleDeclare = 0;
  let roleNonEtabli = 0;
  let roleNonMesure = 0;
  for (const a of agents) {
    if (a.role.mesure === 'établi') parRole[a.role.nom] = (parRole[a.role.nom] ?? 0) + 1;
    else if (a.role.mesure === SOURCE_DECLAREE) {
      roleDeclare += 1;
      parRoleDeclare[a.role.nom] = (parRoleDeclare[a.role.nom] ?? 0) + 1;
    } else if (a.role.mesure === 'refusée') roleNonMesure += 1;
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

  // Les rôles DÉCLARÉS, nommés de la même façon — « 2 au rôle déclaré » ne dit pas quels rôles,
  // donc ne dit toujours pas au dirigeant quelle tranche du parc il regarde.
  //
  // ⚠️ ET LE LIBELLÉ NE PASSE PAS PAR `roleDe`, QUI JETTE sur un rôle inconnu. Un registre qui
  // mourrait entier parce qu'UNE déclaration porte un rôle futur serait le contraire de sa
  // conduite : NOMMER ne décide de rien — c'est la règle que `libellePluriel` écrit déjà.
  const rolesDeclares = Object.keys(parRoleDeclare)
    .sort()
    .map((nom) => `${parRoleDeclare[nom]} ${libellesDuRoleDeclare(nom).pluriel}`);

  // ⚠️ LE BATTEMENT DE CŒUR — ÉCRIT MÊME QUAND LA RONDE N'A RIEN TROUVÉ. Un dispositif qui ne se
  // signale que lorsqu'il a quelque chose à dire est indiscernable d'un dispositif mort ; c'est
  // le pire cas de `balayage.js`, et il ne se rejoue pas ici.
  journaliser(
    // ⚠️ LA TÊTE DU JOURNAL SUIT LA BORNE, COMME CELLE DU RÉSUMÉ — et c'est le lieu qui compte
    // le plus. `recenser()` JETTE le rendu : `resume` et `borne` ne sont lus par personne dans le
    // système qui tourne, et cette ligne de journal est la SEULE sortie d'un tour de ronde. Le
    // correctif précédent avait redressé les deux lieux que personne ne lit et laissé intact le
    // seul qui l'est — où la phrase s'ouvrait sur « AU MOINS N » et se refermait sur « ce compte
    // peut sur-compter ».
    `recensement — ${liste.length} pane(s) vus, ` +
      (panesIndecidables.length ? `${agents.length} agent(s)` : `AU MOINS ${agents.length} agent(s)`) +
      ' : ' +
      (rolesTrouves.length ? rolesTrouves.join(', ') : 'aucun rôle établi') +
      // ⚠️ LES DÉCLARÉS ATTEIGNENT LE JOURNAL, PAS SEULEMENT `compte`. `recenser()` JETTE le
      // rendu : cette ligne est la SEULE sortie d'un tour de ronde du veilleur. Un compte qui ne
      // vivrait que dans le rendu ne serait lu par personne — et le mot « déclaré » y est ce qui
      // empêche de relire ces agents comme mesurés.
      (rolesDeclares.length ? `, ${rolesDeclares.join(', ')} déclaré(s)` : '') +
      `, ${roleNonEtabli} au rôle non établi, ${roleNonMesure} au rôle non mesuré ; ` +
      `${aJour} à jour, ${enRetard} en retard, ${nonMesures} non mesuré(s), ` +
      `${metierSansObjet} sans métier à comparer ; mandats ` +
      `${mandatsOuverts} ouvert(s), ${mandatsClos} clos, ${mandatsNonMesures} non mesuré(s), ` +
      `${mandatsSansObjet} sans mandat de chantier ; ` +
      `${anonymes} anonyme(s), ${nomsNonMesures} nom(s) non mesuré(s)` +
      (panesSansAgent ? ` ; ${panesSansAgent} pane(s) sans agent, écartés` : '') +
      // ⚠️ LE JOURNAL AUSSI — relevé en revue de fond, et l'omission n'était pas un choix de
      // forme : cette ligne porte déjà les panes écartés et les sessions muettes. Le journal est
      // la SEULE trace qu'un tour a eu lieu ; y taire ce qui rend le compte incertain fait
      // relire « AU MOINS N » comme un plancher pour toujours.
      (panesIndecidables.length
        ? ` ; ${panesIndecidables.length} pane(s) INDÉCIDABLE(s), recensés sans preuve — ce compte peut sur-compter`
        : '') +
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
      parRoleDeclare,
      roleDeclare,
      roleNonEtabli,
      roleNonMesure,
      anonymes,
      nomsNonMesures,
      aJour,
      enRetard,
      nonMesures,
      metierSansObjet,
      mandatsOuverts,
      mandatsClos,
      mandatsNonMesures,
      mandatsSansObjet,
    },
    // ⚠️ LA BORNE VOYAGE AVEC LE CHIFFRE, dans le rendu — pas dans un compte rendu à côté.
    // C'est elle qui interdit de lire « sept orchestrateurs » comme « il y en a sept ».
    borne: {
      // ⚠️ « PLANCHER » N'EST PLUS INCONDITIONNEL — relevé en revue de fond, et c'est juste. Un
      // pane INDÉCIDABLE peut être un terminal : tant qu'il y en a, le compte peut aussi
      // SUR-compter, et affirmer « plancher » serait affirmer un sens qu'on n'a pas mesuré.
      nature: panesIndecidables.length ? 'incertaine' : 'plancher',
      phrase: panesIndecidables.length
        ? `${agents.length} agent(s) — et ce compte n’est PAS un plancher sûr : ${panesIndecidables.length} pane(s) ` +
          'n’ont rien déclaré de leur agent, donc il peut aussi SUR-compter. Les deux sens sont ouverts, ' +
          'et c’est pourquoi ils sont nommés un à un dans « panesIndecidables ».'
        : `AU MOINS ${agents.length} agent(s) — ce compte est un PLANCHER, jamais un total : chaque ` +
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
      // Les panes dont la source n'a RIEN dit — ni « il y a un agent », ni « il n'y en a pas ».
      // Recensés (on n'omet jamais), mais nommés : c'est ce qui distingue un compte d'un compte
      // certain.
      panesIndecidables,
      // Ce que vaut le compte des rôles DÉCLARÉS — « lue » ou « non donnée », jamais un zéro nu.
      sourceDeclaree: ceQueDitLaSourceDeclaree(declarations),
      angleMort: CE_QUE_LE_RECENSEMENT_NE_VOIT_PAS,
    },
    resume:
      // ⚠️ LA TÊTE DE LA PHRASE SUIT LA BORNE — relevé en revue de fond. Elle s'ouvrait toujours
      // sur « AU MOINS », puis se contredisait en fin de ligne (« ce compte peut aussi
      // SUR-compter »). Un lecteur lit le début ; la contradiction n'était pas une nuance, c'était
      // deux affirmations opposées dans la seule ligne que ce module déclare lue.
      (panesIndecidables.length ? `${agents.length} agent(s) vivant(s) — ` : `AU MOINS ${agents.length} agent(s) vivant(s) — `) +
      (rolesTrouves.length ? `${rolesTrouves.join(', ')}` : 'aucun rôle établi') +
      // ⚠️ « DÉCLARÉ » EST ÉCRIT À CÔTÉ DU CHIFFRE, comme « plancher » l'est du compte des agents,
      // et pour la même raison : c'est le seul mot qui empêche de lire ces rôles comme mesurés.
      // Le retirer rendrait la phrase plus courte et le registre plus faux (RA-VUE-006).
      (rolesDeclares.length ? `, ${rolesDeclares.join(', ')} DÉCLARÉ(s)` : '') +
      (roleNonEtabli ? `, ${roleNonEtabli} au rôle NON ÉTABLI` : '') +
      (roleNonMesure ? `, ${roleNonMesure} au rôle NON MESURÉ` : '') +
      ` — ${aJour} à jour, ${enRetard} en retard` +
      // ⚠️ ON NOMME CE QUI N'A PAS PU ÊTRE MESURÉ, jamais « NON MESURÉ » tout court. Trois choses
      // distinctes peuvent l'être dans cette phrase — le métier, le mandat, le nom — et elles
      // appellent trois gestes différents. Un « 1 NON MESURÉ(s) » nu se lisait comme celui du
      // NOM, l'étiquette la plus chargée de la ligne, et envoyait chercher un agent muet.
      (nonMesures ? `, ${nonMesures} à l’écart NON MESURÉ` : '') +
      // ⚠️ « SANS OBJET » N'EST PAS « PAS SU MESURER », et le résumé doit le dire. Les deux
      // appellent des gestes opposés : l'un n'appelle RIEN, l'autre envoie refaire la mesure.
      (metierSansObjet ? `, ${metierSansObjet} sans métier à comparer (rien à mesurer, pas un échec)` : '') +
      ` ; mandats : ${mandatsOuverts} ouvert(s), ${mandatsClos} clos` +
      (mandatsNonMesures ? `, ${mandatsNonMesures} au mandat NON MESURÉ` : '') +
      (mandatsSansObjet ? `, ${mandatsSansObjet} sans mandat de chantier (rien à lire, pas un échec)` : '') +
      // ⚠️ LES DEUX FAÇONS DE N'AVOIR PAS DE NOM, DISTINCTES JUSQU'ICI. « anonyme » appelle à le
      // faire se nommer ; « non mesuré » appelle à refaire la mesure. Les fondre enverrait
      // corriger ce qui va bien.
      (anonymes ? ` ; ${anonymes} ANONYME(s), inadressable(s)` : '') +
      (nomsNonMesures ? ` ; ${nomsNonMesures} nom(s) NON MESURÉ(s) — ce n’est pas « sans nom »` : '') +
      '.' +
      // ⚠️ LES INDÉCIDABLES ATTEIGNENT LA PHRASE, PAS SEULEMENT LA BORNE — relevé en revue de
      // fond. Vivant dans `borne` seule, ce compte n'était lu par personne, et « AU MOINS N »
      // continuait d'annoncer un plancher alors que N pouvait aussi sur-compter.
      (panesIndecidables.length
        ? ` ⚠️ ${panesIndecidables.length} pane(s) n’ont rien déclaré de leur agent : ce compte peut ` +
          'aussi SUR-compter — il n’est pas un plancher sûr.'
        : '') +
      (sessionsRefusees.length
        ? ` ⚠️ ${sessionsRefusees.length} session(s) herdr n’ont pas répondu : ce compte est amputé d’autant.`
        : panesIndecidables.length
          ? ''
          : ' (plancher, pas un total)'),
    regle: REGLE_DE_CONDUITE,
  };
}

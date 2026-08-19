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
  dossier = '.orchestrateur',
  roleDuLieu = () => null,
  role = 'orchestrateur',
  mesurer = empreinteDuMetier,
  reference = { refus: 'aucune référence ne m’a été donnée' },
  lireEcran = null,
  // ⚠️ L'ÉTAT DU MANDAT, ET IL NE SE DEVINE PAS (T-20260819-0056). Injecté : sans lui, chaque
  // orchestrateur porte « non mesuré » — jamais « ouvert ». Voir `mandat.js` pour la raison, et
  // la conduite qui en découle plus bas : **on ne propose rien à un mandat qu'on n'a pas mesuré.**
  etatDuMandat = null,
  // ⚠️ UN ENRICHISSEMENT, JAMAIS UNE SOURCE. Les noms viennent de `herdr.agents()`, qui
  // SOUS-COMPTE (40 % mesurés le 2026-08-19) : s'en servir pour savoir QUI EXISTE ferait
  // reculer ce module au défaut qu'il ferme. On ne lui demande donc que d'habiller un pane
  // qu'on a déjà trouvé autrement — et son silence ne retire personne du registre.
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
        'Je ne sais pas qui est vivant : ceci n’est PAS « aucun orchestrateur ».'
    );
    return {
      quand,
      inventaireRefuse: raison,
      panesVus: null,
      reference,
      // ⚠️ `null`, PAS `[]`. Voir la note de la signature — c'est ici que se joue la garde.
      orchestrateurs: null,
      resume:
        'je n’ai pas pu mesurer qui est vivant : la liste des panes ne s’est pas laissé lire ' +
        `(${raison}). Ce n’est pas « aucun orchestrateur » — c’est « je n’ai pas su regarder ».`,
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

  const orchestrateurs = [];
  // ⚠️ CE QU'ON A ÉCARTÉ SE COMPTE, IL NE DISPARAÎT PAS. Un chemin qui porte un
  // `.orchestrateur/<mandat>/` sans porter le métier est écarté à juste titre — le rôle
  // s'établit par le fait — mais l'écart entre « candidats » et « comptés » est justement ce qui
  // chiffre le plancher. Mesuré sur ce poste le 2026-08-19 : huit candidats, sept comptés, et le
  // huitième était un agent bien vivant dans un lieu à demi posé (T-20260819-0070). Sans ce
  // champ, il n'aurait laissé aucune trace nulle part.
  const lieuxEcartes = [];
  for (const p of liste) {
    // ⚠️ LE CHEMIN DE TRAVAIL, PAS LE `cwd`. Un agent né par `claude-swt` garde le dépôt
    // principal en `cwd` pendant que son lieu vit ailleurs — `herdr.js` le dit déjà de son côté.
    const chemin = p?.foreground_cwd || p?.cwd || null;
    const lieu = lieuDuChemin(chemin, dossier);
    if (!lieu) continue;
    if (roleDuLieu(lieu) !== role) {
      lieuxEcartes.push({ pane: p?.pane_id ?? p?.pane ?? null, lieu, pourquoi: `le métier du rôle « ${role} » n’y est pas établi` });
      continue; // le rôle se reconnaît au fait, pas au nom du dossier
    }

    const mesure = mesurer(lieu);
    const mandat = mandatDuChemin(chemin, dossier);
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
    orchestrateurs.push({
      pane,
      // ⚠️ LA SESSION EST RENDUE AVEC LE PANE, JAMAIS SANS. Un identifiant de pane n'est unique
      // que dans sa session : ce poste en porte treize, et deux sessions y emploient le même
      // `w5:p3`. Un registre qui ne rendrait que le pane désignerait deux agents à la fois.
      session: socket,
      // Le nom herdr est rendu POUR L'AFFICHAGE seulement — il ne décide de rien, et il n'est
      // pas toujours là : `pane list` ne le porte pas, et depuis la `v1.72.0` il n'a de toute
      // façon plus de rapport avec le mandat du lieu. C'est `mandat` qui identifie.
      nom: p?.name ?? p?.nom ?? nomsConnus?.get?.(`${socket ?? ''}\u0000${pane}`) ?? null,
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

  const aJour = orchestrateurs.filter((o) => o.aJour === true).length;
  const enRetard = orchestrateurs.filter((o) => o.aJour === false).length;
  const nonMesures = orchestrateurs.filter((o) => o.aJour === null).length;
  // ⚠️ LES MANDATS SE COMPTENT À PART, et leurs trois états ne se replient pas en deux : un
  // mandat non mesuré compté avec les ouverts ferait dire au registre qu'il sait ce qu'il ignore.
  const mandatsClos = orchestrateurs.filter((o) => o.chantier?.clos === true).length;
  const mandatsOuverts = orchestrateurs.filter((o) => o.chantier?.clos === false).length;
  const mandatsNonMesures = orchestrateurs.filter((o) => o.chantier?.clos == null).length;

  // ⚠️ LE BATTEMENT DE CŒUR — ÉCRIT MÊME QUAND LA RONDE N'A RIEN TROUVÉ. Un dispositif qui ne se
  // signale que lorsqu'il a quelque chose à dire est indiscernable d'un dispositif mort ; c'est
  // le pire cas de `balayage.js`, et il ne se rejoue pas ici.
  journaliser(
    `recensement — ${liste.length} pane(s) vus, AU MOINS ${orchestrateurs.length} orchestrateur(s) : ` +
      `${aJour} à jour, ${enRetard} en retard, ${nonMesures} non mesuré(s) ; mandats ` +
      `${mandatsOuverts} ouvert(s), ${mandatsClos} clos, ${mandatsNonMesures} non mesuré(s)` +
      (reference?.empreinte ? ` (référence ${reference.empreinte.slice(0, 16)})` : ' (SANS référence)') +
      (sessionsRefusees.length
        ? ` — ⚠️ COMPTE AMPUTÉ : ${sessionsRefusees.length} session(s) herdr muette(s) : ` +
          sessionsRefusees.map((r) => `${r.session ?? 'sans socket'} (${r.raison})`).join(' ; ')
        : '')
  );

  return {
    quand,
    inventaireRefuse: null,
    panesVus: liste.length,
    reference,
    orchestrateurs,
    compte: {
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
        `AU MOINS ${orchestrateurs.length} orchestrateur(s) — ce compte est un PLANCHER, jamais ` +
        'un total : chaque amélioration de l’instrument en a trouvé davantage sur un parc ' +
        'inchangé (3, puis 5, puis 7 dans la même matinée du 2026-08-19).',
      sessionsInterrogees,
      // Nommées, pas comptées : une session muette est une part du poste qu'on n'a pas regardée,
      // et savoir LAQUELLE est ce qui permet d'aller voir.
      sessionsRefusees,
      // Les chemins qui RESSEMBLAIENT à un lieu du rôle sans en porter le métier. Écartés à
      // juste titre, mais nommés : c'est ce qui distingue « il n'y en avait pas » de « j'en ai
      // écarté un, et voici lequel ».
      lieuxEcartes,
      angleMort: CE_QUE_LE_RECENSEMENT_NE_VOIT_PAS,
    },
    resume:
      `AU MOINS ${orchestrateurs.length} orchestrateur(s) vivant(s) — ${aJour} à jour, ` +
      `${enRetard} en retard, ${nonMesures} non mesuré(s) ; mandats : ${mandatsOuverts} ` +
      `ouvert(s), ${mandatsClos} clos, ${mandatsNonMesures} non mesuré(s).` +
      (sessionsRefusees.length
        ? ` ⚠️ ${sessionsRefusees.length} session(s) herdr n’ont pas répondu : ce compte est amputé d’autant.`
        : ' (plancher, pas un total)'),
    regle: REGLE_DE_CONDUITE,
  };
}

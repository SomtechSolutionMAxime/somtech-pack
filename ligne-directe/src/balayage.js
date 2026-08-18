// balayage.js — LE TOUR QUI VA VOIR LES BOÎTES DONT PLUS PERSONNE NE S'OCCUPE (T-20260818-0078).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT, DANS LES MOTS DU DIRIGEANT
//
//   « Ok et c quoi notre stratégie pour débloquer les boîtes automatiquement ? »
//
// Il n'y en avait pas. `delivrerLaBoite` n'est appelée que depuis les chemins de LIVRAISON :
// une boîte encombrée n'est délivrée que si quelqu'un écrit à son porteur. Le remède était donc
// entièrement suspendu à l'arrivée d'un message — et une boîte que plus personne ne relance
// reste bloquée indéfiniment.
//
// MESURÉ le 2026-08-18, et le second cas est le pire : `ristigouche` bloqué **55 minutes** ; et
// deux fois le prompt de ronde d'un orchestrateur coincé dans sa propre boîte. **Cet
// orchestrateur ne faisait plus ses rondes, et rien ne le lui disait.** Une ronde éteinte ne
// produit aucune erreur : on ne détecte pas son absence, on constate son silence des heures
// plus tard. C'est pourquoi ce module JOURNALISE CHAQUE TOUR, même quand il n'a rien fait —
// construire le balayeur sans ce témoin serait reproduire le défaut dans son propre correctif.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE MODULE N'EST PAS
//
// ⚠️ IL N'ÉCRIT AUCUNE GARDE QUI EXISTE DÉJÀ. Le geste — attendre, relire, refuser devant un
// choix, un dialogue, un écran inconnu, un texte qui bouge, une touche sans effet — appartient
// à `delivrerLaBoite`, et il lui est INJECTÉ (`delivrer`). Ce dépôt a payé dix fois « une porte
// sur deux » : une copie n'hérite jamais des corrections de l'autre. Ce module ne décide que de
// CE QU'IL FAUT REGARDER et de QUAND on a le droit d'appeler le geste.
//
// ⚠️ IL NE TOUCHE AUCUN PROCESSUS ENFANT. Comme `delivrance.js`, toute l'I/O entre par
// paramètre — c'est ce qui le rend éprouvable sans jamais s'approcher des agents vivants du
// poste.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LES TROIS RÉGLAGES VIVENT DANS `delivrance.js`, PAS ICI ET SURTOUT PAS CHEZ L'APPELANT
//
// `CADENCE_DU_BALAYAGE_MS`, `TOURS_DIMMOBILITE_EXIGES` et `FENETRE_DU_BALAYAGE_MS` sont déclarés
// auprès des deux fenêtres d'immobilité qu'ils complètent. La raison est écrite là-bas et elle
// est le cœur du lot : deux réglages qu'on ne voit jamais ensemble sont deux comportements dont
// un seul est annoncé (T-20260818-0076).

import { contenuBoite } from './boite.js';
import {
  TOURS_DIMMOBILITE_EXIGES,
  FENETRE_DU_BALAYAGE_MS,
  DELIVRANCES_PAR_TOUR,
  ECRANS_LUS_DE_FRONT,
  fenetreDImmobilite,
  avisDeBoiteBloquee,
} from './delivrance.js';

/**
 * Un agent, quel que soit le vocabulaire de celui qui le décrit.
 *
 * `herdr.agents()` rend `pane_id` / `name` / `herdr_socket` ; un banc d'essai écrit plus
 * volontiers `pane` / `nom` / `socket`. Traduire ici plutôt qu'exiger une forme évite qu'un
 * essai éprouve un vocabulaire que l'appelant réel n'emploie pas — c'est-à-dire un banc qui
 * passe au vert sur un chemin que personne ne prend.
 */
function normaliser(a) {
  return {
    pane: a?.pane_id ?? a?.pane ?? null,
    nom: a?.name ?? a?.nom ?? null,
    socket: a?.herdr_socket ?? a?.socket ?? null,
    // ⚠️ LA RAISON D'UNE LECTURE RATÉE TRAVERSE, et il a fallu l'écrire : sans elle, la décision
    // rendait `pas-lue` sans dire si l'écran était d'un format inconnu ou si herdr était
    // injoignable. Deux pannes qui ne se cherchent pas au même endroit.
    lectureRefusee: a?.lectureRefusee ?? null,
  };
}

/** Ce qu'on écrit dans un journal qui est fait de lignes : le texte entier, jamais tronqué. */
function surUneLigne(texte) {
  return String(texte ?? '').replace(/\r?\n/g, ' ⏎ ');
}

function motDeLErreur(err) {
  return err?.message || String(err);
}

/**
 * UNE PASSE — ce qu'il faudrait faire de chaque pane, décidé SANS RIEN FAIRE.
 *
 * @param agents      les panes observés. Chaque entrée porte ce qu'on a LU de sa boîte, dans
 *                    `contenu` : `''` (vide), une chaîne (occupée), ou `null` / absent (PAS
 *                    LUE — ce qui n'est pas la même chose que vide, cf. `boite.js`).
 * @param memoire     Map `pane → { texte, tours, depuis }`, celle rendue par la passe précédente.
 * @param sousBail    `(pane, { maintenant }) → boolean` — injecté, jamais importé.
 * @param maintenant  l'horloge, en ms. Injectée : un tour doit pouvoir être rejoué.
 * @returns `{ decisions, memoire }` — la mémoire est une Map NEUVE ; celle qu'on reçoit n'est
 *          jamais mutée. C'est ce qui permet de rejouer une passe deux fois et d'obtenir deux
 *          fois le même verdict — sans quoi un essai mesure l'ordre de ses propres appels.
 *
 * ⚠️ L'ORDRE DES ABSTENTIONS EST LA PIÈCE, ET IL VA DU PLUS SÛR AU MOINS SÛR :
 *
 *   1. `bail`                — quelqu'un d'autre s'est réservé ce pane. On ne touche pas, QUEL
 *                              QUE SOIT le contenu de sa boîte : un bail ne se discute pas
 *                              contre ce qu'on croit voir à l'écran.
 *   2. `pas-lue`             — `contenuBoite` a rendu `null`. **On ne soumet pas ce qu'on n'a
 *                              pas lu.** Une lecture ratée n'est pas une boîte vide, et la
 *                              traiter comme telle est le motif que ce dépôt ferme partout.
 *   3. `vide`                — rien à faire, et surtout rien à retenir.
 *   4. `pas-encore-immobile` — moins de trois tours du même texte.
 *   5. et seulement là, le GESTE — qui applique ses propres gardes et relit avant de soumettre.
 */
export function unePasse({ agents = [], memoire = new Map(), sousBail = () => false, maintenant = Date.now() } = {}) {
  const decisions = [];
  const suivante = new Map();

  for (const brut of agents) {
    const a = normaliser(brut);
    if (!a.pane) continue; // un agent sans pane n'est pas un pane : rien à balayer, rien à retenir

    // ═══ 1. LE BAIL, AVANT TOUT LE RESTE.
    // ⚠️ ET IL FAIT SORTIR DE LA MÉMOIRE. Garder le compteur d'un pane sous bail le ferait
    // délivrer à la seconde où le bail tombe, sur une immobilité constatée AVANT que l'autre
    // n'y travaille — c'est-à-dire sur une mesure périmée. Il repart de zéro : trois tours
    // frais, ou rien.
    if (sousBail(a.pane, { maintenant })) {
      decisions.push({ ...a, action: 'sabstenir', cause: 'bail', tours: 0 });
      continue;
    }

    const contenu = brut?.contenu;

    // ═══ 2. UNE BOÎTE QU'ON N'A PAS LUE N'EST PAS UNE BOÎTE VIDE (`boite.js`).
    //
    // ⚠️ ET ELLE NE FAIT PAS SORTIR DE LA MÉMOIRE — relevé en passe de revue de fond, et le
    // rejet était juste. Une lecture ratée ne dit RIEN du texte : elle dit qu'on n'a pas vu.
    // L'effacer revenait à traiter « je n'ai pas regardé » comme « le texte a changé », c'est-à-
    // dire le motif que ce dépôt ferme partout ailleurs, appliqué à un compteur.
    //
    // Ce que ça coûtait, et ce n'est pas théorique : sur un poste à quatre-vingt-dix agents où
    // chaque écran se lit par un appel séparé, UN timeout ponctuel sur UN tour remettait ce pane
    // à zéro — donc trois minutes de plus, silencieusement. **La borne annoncée n'aurait tenu
    // que si chaque tour lisait chaque pane sans faute**, hypothèse que personne n'avait posée.
    //
    // On garde donc l'entrée telle quelle, SANS incrémenter : le tour n'a rien constaté, il ne
    // gagne rien. Le pane reprend son compte là où il l'avait laissé.
    if (contenu === null || contenu === undefined) {
      const garde = memoire.get(a.pane);
      if (garde) suivante.set(a.pane, garde);
      decisions.push({ ...a, action: 'sabstenir', cause: 'pas-lue', tours: garde?.tours ?? 0 });
      continue;
    }

    // ═══ 3. VIDE — et elle sort de la mémoire, comme un pane disparu.
    // ⚠️ SANS CETTE SORTIE, LA MÉMOIRE ENFLE SANS BORNE. Ce dispositif tourne des semaines sur
    // un poste où les panes naissent et meurent en continu ; une Map qui ne perd jamais une clé
    // finit par porter tous les panes qui ont existé.
    if (contenu === '') {
      decisions.push({ ...a, action: 'sabstenir', cause: 'vide', tours: 0 });
      continue;
    }

    // ═══ 4. LE MÊME TEXTE, AU MÊME PANE, SUR TROIS TOURS ESPACÉS.
    // ⚠️ UN TEXTE QUI CHANGE REMET LE COMPTEUR À ZÉRO, et c'est TOUTE la garde de ce chemin :
    // c'est ce qui distingue un banc vivant — qu'on écrit, qu'on relit, qu'on relance — d'une
    // boîte oubliée. Sans la remise à zéro, quelqu'un qui compose lentement une phrase longue
    // verrait sa phrase soumise pendant qu'il la tape.
    const vu = memoire.get(a.pane);
    const memeTexte = vu != null && vu.texte === contenu;
    const tours = memeTexte ? vu.tours + 1 : 1;
    const depuis = memeTexte ? vu.depuis : maintenant;
    const immobiliteMs = Math.max(0, maintenant - depuis);

    if (tours < TOURS_DIMMOBILITE_EXIGES) {
      suivante.set(a.pane, { texte: contenu, tours, depuis });
      decisions.push({ ...a, action: 'sabstenir', cause: 'pas-encore-immobile', tours, contenu, immobiliteMs });
      continue;
    }

    // ⚠️ ON NE REPORTE PAS LE COMPTEUR D'UN CANDIDAT, ET C'EST DÉLIBÉRÉ. Une boîte qui ne se
    // décoince pas — le geste peut échouer, `sans-effet` existe — repasserait sinon candidate
    // à CHAQUE tour, c'est-à-dire une touche d'envoi par minute sur le même pane, indéfiniment.
    // En repartant de zéro, une boîte réellement collée est retentée toutes les trois minutes
    // au lieu de chaque minute, et chaque tentative repose sur une immobilité fraîchement
    // constatée. Après une délivrance réussie la question ne se pose pas : la boîte est vide.
    decisions.push({ ...a, action: 'delivrer', cause: null, tours, contenu, immobiliteMs });
  }

  return { decisions, memoire: suivante };
}

/**
 * LA PHRASE QUI DIT PAR QUOI — et elle n'existe QUE sur ce chemin-ci.
 *
 * ⚠️ POURQUOI L'AVIS NE SUFFIT PAS ICI. `avisDeBoiteBloquee` dit ce qui est parti ; il ne dit
 * pas QUI l'a fait partir. Sur les deux autres chemins, la question ne se pose pas : l'avis est
 * PRÉFIXÉ au message qu'on allait livrer de toute façon, et l'expéditeur est visible dans le
 * message qui suit. Ici il n'y a pas de message qui suit — l'avis voyage seul. Sans cette
 * phrase, le destinataire apprend qu'un texte est parti sous sa signature et n'a aucun moyen de
 * savoir d'où vient le geste : « il apprend que son texte a été soumis pour lui, ET PAR QUOI »
 * est le critère du ticket, et la seconde moitié n'est portée par rien d'autre.
 */
export function phraseDuBalayeur({ tours = TOURS_DIMMOBILITE_EXIGES, immobiliteMs = 0 } = {}) {
  const minutes = Math.max(1, Math.round(Number(immobiliteMs) / 60000));
  return (
    '\n\n┈┈┈\nPAR QUOI : le **balayeur de boîtes oubliées** de `ligne-directe` — une ronde ' +
    'automatique, pas un humain et pas un pair. Personne ne t’écrivait : c’est la ronde qui a ' +
    `trouvé ta boîte figée, en y lisant le MÊME texte sur ${tours} passages successifs ` +
    `(~${minutes} min). Tant qu’une boîte reste pleine, PERSONNE ne peut te joindre et rien ne ` +
    'te le dit — c’est ce que cette ronde existe pour rompre.'
  );
}

/**
 * UN TOUR DE BALAYAGE — on regarde, on décide, on agit, et on rend compte de TOUT.
 *
 * L'I/O est injectée, sans exception :
 *
 * @param agents      la liste des agents, ou une fonction (éventuellement asynchrone) qui la
 *                    rend. Chaque entrée porte au moins un pane, et le socket de SA session.
 * @param lireEcran   `(agent) → texte|null` — l'écran brut. Ce module en tire la boîte avec
 *                    `contenuBoite`, jamais l'appelant : la lecture d'une boîte a une seule
 *                    implémentation dans ce dépôt et c'est la sienne.
 * @param delivrer    `({ pane, nom, socket, texteCoince, immobiliteMs }) → résultat de
 *                    `delivrerLaBoite`. **Le geste et ses gardes ne sont pas réécrits ici.**
 * @param avertir     `(pane, texte, { socket }) → any` — le transport de l'avis.
 * @param sousBail    `(pane, { maintenant }) → boolean`.
 * @param memoire     la mémoire rendue par le tour précédent. Le tour rend la suivante.
 * @param maintenant  l'horloge en ms.
 * @param journaliser `(message) → void` — le battement de cœur, et la trace des délivrances.
 *
 * @returns le COMPTE RENDU du tour (voir la forme dans le corps) — il porte LES DEUX CHIFFRES :
 *          ce qui a été débloqué, et ce qui a été refusé AVEC SA CAUSE. Ils sont comptés par
 *          construction, jamais reconstitués après coup : **un compteur qui n'existe pas ne se
 *          mesure pas a posteriori**, et le coordonnateur exige que les torts de ce dispositif
 *          — un banc d'essai faussé par une soumission — soient attribuables. Chaque délivrance
 *          est donc ré-identifiable par le triplet (pane, texte, heure), au compte rendu comme
 *          au journal.
 */
export async function unTourDeBalayage({
  agents = [],
  lireEcran = async () => null,
  delivrer,
  avertir,
  sousBail = () => false,
  memoire = new Map(),
  maintenant = Date.now(),
  journaliser = () => {},
} = {}) {
  const quand = new Date(maintenant).toISOString();
  const parCause = {};
  const compter = (cause) => {
    parCause[cause] = (parCause[cause] || 0) + 1;
  };

  // ⚠️ UNE PANNE D'INVENTAIRE N'EST PAS « AUCUN AGENT ». `herdr.agents()` jette quand l'outil
  // est introuvable (T-20260813-0054) — le traduire en liste vide ferait rendre un tour
  // parfaitement vert, avec zéro pane vu, sur un poste où plus rien n'est balayé. C'est le mode
  // de panne exact du ticket : une ronde qui ne fait plus rien et ne le dit pas.
  let liste;
  try {
    liste = typeof agents === 'function' ? await agents() : agents;
  } catch (err) {
    journaliser(`balayage — TOUR SANS INVENTAIRE : herdr n’a pas rendu la liste des agents (${motDeLErreur(err)})`);
    return {
      quand,
      vus: 0,
      inventaireRefuse: motDeLErreur(err),
      debloques: [],
      refus: [],
      parCause: {},
      avisPerdus: 0,
      memoire,
    };
  }
  liste = Array.isArray(liste) ? liste : [];

  // ═══ CE QU'ON A VU. On ne lit PAS l'écran d'un pane sous bail : « on ne touche pas » se tient
  // jusque dans la lecture, et son contenu ne pourrait de toute façon rien décider.
  // ⚠️ PAR PAQUETS, ET PAS UN PAR UN — le coût en série a été mesuré et il dépasse la cadence.
  // Le 2026-08-18, un balayage à la main sur 97 panes a EXPIRÉ à deux minutes sur un poste
  // chargé, là où le même geste coûte moins d'une seconde sur un poste au repos. La taille du
  // paquet est nommée dans `delivrance.js`, auprès des autres réglages de ce chemin — l'écrire
  // ici rejouerait le défaut que ce module passe son temps à rappeler.
  //
  // ⚠️ L'ORDRE DES OBSERVATIONS RESTE CELUI DE L'INVENTAIRE. Un `Promise.all` par paquet rend
  // ses résultats dans l'ordre de ses entrées ; on les concatène paquet après paquet. Sans ça,
  // deux tours sur le même poste rendraient des comptes rendus dont les lignes ne se comparent
  // pas — et c'est en les comparant qu'on lit ce qui s'est passé entre les deux.
  const aObserver = [];
  for (const brut of liste) {
    const a = normaliser(brut);
    if (!a.pane) continue;
    // On ne lit PAS l'écran d'un pane sous bail : « on ne touche pas » se tient jusque dans la
    // lecture, et son contenu ne pourrait de toute façon rien décider.
    if (sousBail(a.pane, { maintenant })) {
      aObserver.push({ brut, a, sousBail: true });
      continue;
    }
    aObserver.push({ brut, a, sousBail: false });
  }

  const observations = [];
  const paquet = Math.max(1, Number(ECRANS_LUS_DE_FRONT) || 1);
  for (let i = 0; i < aObserver.length; i += paquet) {
    const lot = await Promise.all(
      aObserver.slice(i, i + paquet).map(async ({ brut, a, sousBail: reserve }) => {
        if (reserve) return { ...a, contenu: undefined };
        try {
          return { ...a, contenu: contenuBoite(await lireEcran({ ...a, ...brut })) };
        } catch (err) {
          // Une lecture qui jette rend le même verdict qu'une lecture illisible — `pas-lue` —
          // mais la RAISON est conservée : sans elle, un herdr injoignable et un écran d'un
          // format inconnu se ressemblent au compte rendu, et on cherche la panne du mauvais côté.
          return { ...a, contenu: null, lectureRefusee: motDeLErreur(err) };
        }
      })
    );
    observations.push(...lot);
  }

  const { decisions, memoire: suivante } = unePasse({ agents: observations, memoire, sousBail, maintenant });

  const debloques = [];
  const refus = [];
  let avisPerdus = 0;

  // ⚠️ COMBIEN DE DÉLIVRANCES DANS UN MÊME TOUR — relevé en passe de revue de fond, et MESURÉ
  // ensuite sur le poste réel : une passe à blanc du 2026-08-18 a trouvé **neuf candidats au
  // même tour**. Ce n'est donc pas un cas d'école.
  //
  // Chaque délivrance se paie en série : sa fenêtre d'immobilité (jusqu'à dix secondes pour un
  // texte tapé) puis la relecture qui constate la boîte vidée (jusqu'à trois secondes). Neuf
  // candidats, c'est deux minutes — soit **plus que la cadence entière**, pendant lesquelles
  // rien du reste du poste n'est regardé. La borne annoncée est calculée pour un candidat
  // isolé ; sans plafond, elle se dégrade avec le nombre de candidats sans que rien ne le dise.
  //
  // ⚠️ ET LES REPORTÉS GARDENT LEUR CANDIDATURE. C'est la moitié qui compte : les rendre à la
  // mémoire avec un compteur remis à zéro les ferait attendre trois tours de plus — le plafond
  // punirait alors les boîtes qu'il est censé servir, et d'autant plus qu'elles sont nombreuses.
  // Ils repartent avec leur compte intact : ils sont candidats au tour suivant.
  //
  // ⚠️ ET RIEN N'EST TRONQUÉ EN SILENCE. Ce qui est reporté est compté sous sa propre cause et
  // journalisé. Un plafond muet se lit « tout a été traité » alors qu'il en reste.
  const aDelivrer = decisions.filter((d) => d.action === 'delivrer');
  const reportes = aDelivrer.slice(DELIVRANCES_PAR_TOUR);
  const retenus = new Set(aDelivrer.slice(0, DELIVRANCES_PAR_TOUR).map((d) => d));
  if (reportes.length) {
    journaliser(
      `balayage — ${reportes.length} boîte(s) REPORTÉE(S) au tour suivant (plafond de ` +
        `${DELIVRANCES_PAR_TOUR} par tour) : ${reportes.map((d) => d.pane).join(', ')}`
    );
    for (const d of reportes) {
      suivante.set(d.pane, { texte: d.contenu, tours: d.tours, depuis: maintenant - d.immobiliteMs });
      compter('reporte');
      refus.push({ pane: d.pane, nom: d.nom, cause: 'reporte', tours: d.tours, detail: null });
    }
  }

  for (const d of decisions) {
    if (d.action === 'sabstenir') {
      compter(d.cause);
      refus.push({ pane: d.pane, nom: d.nom, cause: d.cause, tours: d.tours, detail: d.lectureRefusee || null });
      continue;
    }
    if (!retenus.has(d)) continue; // reporté : déjà compté, déjà rendu à la mémoire

    // ⚠️ LE DISCRIMINANT COLLÉ / TAPÉ N'EST PAS RÉÉCRIT ICI : `fenetreDImmobilite` le porte pour
    // les trois chemins depuis T-20260818-0076, et elle JETTE si on ne lui nomme pas la fenêtre.
    const fenetreMs = fenetreDImmobilite(d.contenu, { texteTapeMs: FENETRE_DU_BALAYAGE_MS });

    let resultat;
    try {
      resultat = await delivrer({
        pane: d.pane,
        nom: d.nom,
        socket: d.socket,
        texteCoince: d.contenu,
        immobiliteMs: fenetreMs,
      });
    } catch (err) {
      // Un geste qui jette ne fait pas tomber le tour : les autres panes attendent encore.
      compter('geste-refuse');
      refus.push({ pane: d.pane, nom: d.nom, cause: 'geste-refuse', tours: d.tours, detail: motDeLErreur(err) });
      journaliser(`balayage — geste refusé sur ${d.pane} : ${motDeLErreur(err)}`);
      continue;
    }

    // ⚠️ SEUL `soumis` EST UNE DÉLIVRANCE. `ok` couvre aussi `vide-cause-inconnue` — la boîte
    // s'est vidée pendant qu'on regardait, et on ne sait pas pourquoi. On n'a alors RIEN fait :
    // le compter comme un déblocage gonflerait le chiffre du bien avec un non-événement.
    if (!resultat?.soumis) {
      const cause = resultat?.cause || 'sans-cause';
      compter(cause);
      refus.push({
        pane: d.pane,
        nom: d.nom,
        cause,
        tours: d.tours,
        detail: resultat?.resume || resultat?.texteVu || resultat?.texteDisparu || null,
      });
      continue;
    }

    const texte = resultat.texte ?? d.contenu;
    const trace = {
      pane: d.pane,
      nom: d.nom,
      texte,
      quand,
      tours: d.tours,
      immobiliteMs: d.immobiliteMs,
      avis: 'non-tente',
      avisRefuse: null,
    };

    // ⚠️ LA TRACE EST ÉCRITE AVANT L'AVIS, jamais après. Un geste irréversible vient d'être posé ;
    // si l'avis jette et que la trace suivait, l'unique preuve qu'une touche d'envoi est partie
    // sur ce pane dépendrait du succès d'une AUTRE opération. Le texte y est ENTIER — c'est le
    // triplet (pane, texte, heure) qui permettra d'attribuer un banc d'essai faussé à ce tour-ci.
    journaliser(
      `balayage — DÉLIVRÉ ${d.pane}${d.nom ? ` (${d.nom})` : ''} après ${d.tours} tours ` +
        `(immobile ~${Math.round(d.immobiliteMs / 1000)} s) : « ${surUneLigne(texte)} »`
    );

    if (typeof avertir === 'function') {
      try {
        await avertir(
          d.pane,
          avisDeBoiteBloquee({ texteLibere: texte, immobiliteMs: d.immobiliteMs, suite: 'aucune' }) +
            phraseDuBalayeur({ tours: d.tours, immobiliteMs: d.immobiliteMs }),
          { socket: d.socket }
        );
        trace.avis = 'remis';
      } catch (err) {
        // ⚠️ UN AVIS PERDU NE FAIT PAS ÉCHOUER LE TOUR — mais il ne se perd pas EN SILENCE, et
        // c'est tout l'enjeu : l'avis existe pour qu'un texte parti sous la signature de
        // quelqu'un ne soit pas un incident inexplicable. Un avis avalé rouvre exactement ça,
        // en pire, puisque le geste, lui, a bien eu lieu.
        trace.avis = 'perdu';
        trace.avisRefuse = motDeLErreur(err);
        avisPerdus += 1;
        journaliser(`balayage — AVIS PERDU pour ${d.pane} : ${motDeLErreur(err)} (le texte, lui, EST parti)`);
      }
    }

    debloques.push(trace);
  }

  // ⚠️ LE BATTEMENT DE CŒUR — ÉCRIT MÊME QUAND LE TOUR N'A RIEN FAIT, et ce n'est pas du confort.
  // « Une ronde éteinte ne produit aucune erreur — on ne détecte pas son absence » : c'est le
  // pire cas du ticket, subi par un orchestrateur qui ne faisait plus ses rondes pendant que
  // tout paraissait normal. Un dispositif qui ne se signale que lorsqu'il agit est indiscernable
  // d'un dispositif mort.
  const abstentions = Object.entries(parCause)
    .map(([c, n]) => `${c} ${n}`)
    .join(', ');
  journaliser(
    `balayage — tour passé : ${observations.length} pane(s) vus, ${debloques.length} débloqué(s), ` +
      `${refus.length} abstention(s)${abstentions ? ` (${abstentions})` : ''}` +
      `${avisPerdus ? `, ${avisPerdus} avis PERDU(S)` : ''}`
  );

  return {
    quand,
    vus: observations.length,
    inventaireRefuse: null,
    debloques,
    refus,
    parCause,
    avisPerdus,
    memoire: suivante,
  };
}

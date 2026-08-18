// herdr.js — parler à un agent, et savoir s'il est encore là.
//
// Deux garanties, et elles ont chacune coûté cher ailleurs :
//
// 1. AUCUN SHELL. `execFile` avec un tableau d'arguments : le texte du dirigeant part tel
//    quel dans argv. Apostrophes, guillemets, accents, points-virgules — rien n'est
//    interprété. Le piège documenté (« un retour à la ligne soumet le prompt et coupe le
//    message en deux ») vient de la frappe dans un terminal, pas de la commande : il
//    disparaît dès qu'on cesse de passer par un shell.
//
// 2. AUCUNE REMISE SUPPOSÉE. On ne conclut « transmis » que sur un `result` rendu par
//    herdr. Un code de sortie nul ne suffit pas : c'est la façon dont un message se perd
//    sans que personne ne s'en aperçoive.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { OUTILS, OutilIntrouvable, lancer } from './outils.js';
import { contenuBoite, laPriseEstConstatee, estUnEspaceReserve } from './boite.js';
// ⚠️ LE REMÈDE EST REPRIS, PAS RÉÉCRIT (T-20260818-0049, règle d'or n°15). `delivrerLaBoite`
// porte des gardes MESURÉES qui ont coûté un lot chacune — sur le texte coincé, sur l'écran,
// sur l'immobilité. Une seconde copie n'hériterait jamais des corrections de la première.
import { delivrerLaBoite, avisDeBoiteBloquee, avisDeBoiteVidee } from './delivrance.js';
import { etatDeLEcran, refusDEcran, ecranAttendUnChoix, resumeDeLEcran } from './ecran.js';

/** Un message plus long que ça part par fichier plutôt que par argv (limite système). */
const SEUIL_ARGV = 60_000;

export class RemiseEchouee extends Error {
  constructor(pane, raison) {
    super(`Message non remis à ${pane} : ${raison}`);
    this.name = 'RemiseEchouee';
    this.pane = pane;
    this.raison = raison;
  }
}

/**
 * Où joindre herdr.
 *
 * MESURÉ, et c'est la panne qui ne se voit qu'au démarrage du poste : herdr trouve son
 * socket par la variable `HERDR_SOCKET_PATH`, posée par le shell d'un pane. Un service
 * lancé par le gestionnaire du poste n'hérite d'aucun environnement de session — il obtient
 * donc « connexion refusée », et le veilleur ne peut plus remettre AUCUN message. Tout
 * marche à la main, rien ne marche après un redémarrage.
 *
 * On retombe donc sur la découverte : les sessions herdr déposent leur socket sous
 * `~/.config/herdr/sessions/<nom>/herdr.sock`. On prend la plus récemment active.
 */
export function socketsHerdr() {
  const vus = new Set();
  const liste = [];
  if (process.env.HERDR_SOCKET_PATH) {
    liste.push(process.env.HERDR_SOCKET_PATH);
    vus.add(process.env.HERDR_SOCKET_PATH);
  }
  const racine = join(homedir(), '.config', 'herdr', 'sessions');
  if (!existsSync(racine)) return liste;
  const candidats = [];
  for (const session of readdirSync(racine)) {
    const chemin = join(racine, session, 'herdr.sock');
    if (vus.has(chemin) || !existsSync(chemin)) continue;
    try {
      candidats.push({ chemin, quand: statSync(chemin).mtimeMs });
    } catch {
      /* socket disparu entre-temps */
    }
  }
  candidats.sort((a, b) => b.quand - a.quand);
  return [...liste, ...candidats.map((c) => c.chemin)];
}

/** Le socket d'une session précise, ou la plus récemment active à défaut. */
export function socketHerdr() {
  return socketsHerdr()[0] || null;
}

/**
 * `herdr` est résolu par le `PATH`, et c'est le SEUL cas où c'est justifié : il est installé
 * par l'utilisateur, son emplacement n'est pas connu d'avance, et lui en inventer un
 * chercherait au mauvais endroit en ayant l'air de savoir. Ce qui n'est pas justifiable, en
 * revanche, c'est de traduire « je ne l'ai pas trouvé » en autre chose — d'où `lancer`, qui
 * qualifie l'échec de lancement au lieu de le laisser se fondre dans les autres.
 */
// ⚠️ CE QU'ON S'ACCORDE POUR CONSTATER QU'UNE BOÎTE S'EST VIDÉE (T-20260818-0049).
//
// Ce n'est PAS un délai avant d'agir : le geste est déjà posé quand ce compteur commence. C'est
// le temps qu'on se donne pour VOIR son effet, parce qu'une lecture unique ne distingue pas
// « la touche n'a rien fait » de « le terminal n'a pas encore fini ». Confondre les deux fait
// rendre un refus sur un message qui est bien parti — le défaut que le dirigeant a subi.
//
// Dix lectures espacées de 300 ms, soit trois secondes : assez pour couvrir un terminal chargé,
// assez court pour que sa parole ne poireaute pas quand la touche a vraiment échoué.
// ⚠️ LA FENÊTRE D'OBSERVATION D'UN TEXTE TAPÉ, SUR LA LIGNE D'UN HUMAIN (T-20260818-0049).
// Dix secondes : de quoi voir des doigts sur un clavier, pas de quoi faire attendre celui qui
// écrit depuis Slack. À ne pas confondre avec `IMMOBILITE_PAR_DEFAUT_MS` (cinq minutes), réglé
// pour le chemin où celui qui patiente est un agent — l'appliquer ici a fait pendre un essai
// 300 secondes, mesuré, et aurait laissé le dirigeant muet autant de temps.
const FENETRE_TEXTE_TAPE_MS = 10_000;

const RELECTURES_APRES_ENVOI = 10;
const DELAI_RELECTURE_MS = 300;

async function herdr(args, socket) {
  const env = socket ? { ...process.env, HERDR_SOCKET_PATH: socket } : process.env;
  const { stdout } = await lancer(OUTILS.herdr, args, { maxBuffer: 16 * 1024 * 1024, env });
  return JSON.parse(stdout);
}

/** Comme `herdr`, mais lève si la réponse porte une erreur applicative (code de sortie 0 compris). */
async function herdrStrict(args, socket) {
  const reponse = await herdr(args, socket);
  if (reponse?.error) {
    const e = new Error(reponse.error.message || reponse.error.code || 'erreur herdr');
    e.code = reponse.error.code;
    throw e;
  }
  return reponse;
}

/**
 * POURQUOI LA DÉLIVRANCE N'A PAS ABOUTI — des mots ajoutés au refus, jamais un verdict.
 *
 * Sans eux, le lecteur voit « boîte encore pleine » et retente le même geste à l'aveugle. Ce
 * qui bloque n'est pas la même chose selon la cause, et le geste qui le lève non plus.
 */
function motDuRefusDeDelivrance(delivrance) {
  switch (delivrance?.cause) {
    case 'choix':
    case 'dialogue':
    case 'ecran':
      return ' : ce que je vois ressemble à un DIALOGUE qui attend un choix, et la touche d’envoi y confirmerait une action au lieu de soumettre un texte';
    case 'bouge':
      return ' : le texte a BOUGÉ pendant que je l’observais — quelqu’un est en train d’écrire là, et je ne soumets pas une phrase inachevée à sa place';
    case 'sans-effet':
      return ' : la touche d’envoi est partie et la boîte est restée pleine';
    case 'illisible':
      return ' : je n’ai plus su lire l’écran';
    default:
      return '';
  }
}

/**
 * Remet un message à un agent, et prouve la remise.
 * @returns {Promise<object>} le `result` rendu par herdr — la preuve, pas une supposition
 */
export async function remettre(pane, texte, { socket } = {}) {
  if (texte.length > SEUIL_ARGV) {
    throw new RemiseEchouee(pane, `message de ${texte.length} caractères — au-delà de ${SEUIL_ARGV}, à découper`);
  }
  // CE QU'ON VOIT AVANT D'ÉCRIRE — sans quoi rien de ce qu'on verra après ne prouvera quoi que
  // ce soit. Un état qui ne pouvait pas être différent n'est pas un témoin (T-20260815-0011).
  // Ce qui partira réellement : le message, et — seulement si une boîte a été délivrée —
  // l'avis qui dit au destinataire ce qui est parti en son nom.
  let texteALivrer = texte;

  const avant = await etatDuPane(pane, socket);

  // ═══ 1. ON NE POSE RIEN DEVANT UN ÉCRAN DE CHOIX — relevé en REVUE DE FOND, bloquant, et il
  // était juste : le refus de boîte, plus bas, ne regardait que la BOÎTE. Un dialogue affiché
  // au-dessus d'une boîte vide passait donc entièrement.
  //
  // ⚠️ MESURÉ LE 2026-08-17, ET C'EST LE FAIT QUI MANQUAIT À DEUX LOTS. `livraison.js` portait
  // **[non établi]** — personne n'avait su reproduire un vrai dialogue de permission. Reproduit
  // ici, et la mesure est pire que la crainte :
  //
  //   • écran : « Do you want to proceed? ❯ 1. Yes », proposant `touch /tmp/mesure-dialogue-…` ;
  //   • geste : `herdr agent prompt <pane> "ceci est un texte ordinaire, pas une confirmation"` ;
  //   • résultat : **le fichier a été créé**. Le texte n'a pas été reçu comme un message — il a
  //     servi de CONFIRMATION, et l'action a été approuvée.
  //
  // Ce n'est donc pas seulement la touche d'envoi qui est dangereuse devant un dialogue :
  // **c'est l'écriture elle-même**. Le garde doit regarder l'écran avant d'écrire, exactement
  // comme il le fait avant d'envoyer la touche — la symétrie n'est pas une élégance, c'est la
  // moitié manquante.
  //
  // Sur le dialogue mesuré, la boîte était de surcroît illisible, donc le refus d'en dessous
  // aurait mordu — mais PAR ACCIDENT, et « protégé par accident » est le motif que ce dépôt
  // ferme partout. Un écran de choix qui laisse une boîte lisible sous lui n'était gardé par rien.
  const etatAvant = etatDeLEcran(avant.ecran);
  if (ecranAttendUnChoix(avant.ecran) || (avant.ecran && !etatAvant.pretARecevoir)) {
    throw new RemiseEchouee(
      pane,
      // ⚠️ ON MONTRE CE QU'ON A VU, TOUJOURS. `refusDEcran` rend `null` quand l'écran est par
      // ailleurs « prêt » — c'est le cas d'un dialogue INCONNU posé au-dessus d'une boîte
      // lisible, donc précisément le cas le plus fréquent ici. Se rabattre alors sur une phrase
      // générique priverait le dirigeant de la seule chose qui l'aide : ce qu'il y a à l'écran.
      `${pane} est devant un écran qui attend un choix, pas un message — ` +
        `${
          refusDEcran(etatAvant, { cible: 'la session' }) ||
          `voici ce que j’ai vu :\n${etatAvant.resume || String(avant.ecran).slice(-400)}`
        }. ` +
        `Y écrire ne livrerait pas ta parole : ça CONFIRMERAIT l'action affichée (mesuré). Je m'abstiens. ` +
        `Le geste : va voir l'écran (« herdr agent focus ${pane} »), réponds au dialogue toi-même, ` +
        `puis renvoie ton message.`
    );
  }

  // ═══ 2. ET ON REFUSE SI LA BOÎTE N'EST PAS VIDE — le défaut fondateur de ce lot.
  //
  // ⚠️ MESURÉ le 2026-08-17 contre le vrai service, la preuve prise dans la TRANSCRIPTION du
  // destinataire : `agent prompt` n'écrit pas dans une boîte vide, il ABOUTE son texte à ce qui
  // s'y trouve, sans séparateur, ET SOUMET. Une boîte portant « AAAA…AAAA » a fait recevoir à
  // l'agent, en un seul tour de parole, « AAAA…AAAABBBB…BBBB ».
  //
  // Deux textes que personne n'a écrits ensemble partent donc comme UN SEUL message — sur le
  // chemin par lequel arrive la parole du dirigeant. Un arbitrage mêlé à autre chose et soumis
  // est un ordre que personne n'a donné, et il est exécuté.
  //
  // ⚠️ IL N'Y A AUCUN RATTRAPAGE APRÈS COUP, et c'est ce qui commande la forme du remède : quand
  // on relit la boîte plus bas, le mélange est déjà parti. La lecture d'écran ci-dessus n'était
  // qu'un témoin de preuve ; elle devient aussi un GARDE. C'est le seul instant où l'on peut agir.
  //
  // ⚠️ ET UN ÉCRAN QU'ON N'A PAS SU LIRE EST UN REFUS. Le commentaire d'avant justifiait le
  // contraire — « contrairement à la livraison d'un brief, on n'écrit pas par-dessus quoi que ce
  // soit ici ». Cette prémisse était fausse : on écrit bien par-dessus. Le raisonnement s'inverse
  // donc avec elle. Ne pas savoir ce qu'il y a dans la boîte ne permet pas d'affirmer qu'elle est
  // vide — et c'est en écrivant sur cette supposition qu'on fusionne.
  const dejaLa = contenuBoite(avant.ecran);
  if (dejaLa === null) {
    throw new RemiseEchouee(
      pane,
      `je n’ai pas su lire l’écran de ${pane}, donc je ne peux pas garantir que sa boîte de saisie ` +
        `est vide — et y écrire par-dessus collerait les deux textes en un seul message. ` +
        `Le geste : va voir l’écran (« herdr agent read ${pane} »), puis renvoie ton message.`
    );
  }
  if (dejaLa !== '') {
    // ═══ ON NE REFUSE PLUS : ON DÉLIVRE, PUIS ON ÉCRIT (T-20260818-0049).
    //
    // ⚠️ LA RÈGLE VIENT DU DIRIGEANT, ET ELLE EST DE CONCEPTION, pas de confort :
    //
    //   > « On ne doit jamais être bloqué via le Slack. Sinon on est pris. »
    //   > « Là les boîtes occupées on fait un Enter dessus sinon ça part jamais. »
    //
    // « Pris », c'est-à-dire sans recours ET sans moyen de signaler qu'on l'est : le seul canal
    // par lequel on le dirait est celui qui est coupé. Le mode de panne se referme sur lui-même.
    //
    // ⚠️ CE QU'ON NE FAIT PAS POUR AUTANT : retirer la garde. Elle mesurait quelque chose de
    // RÉEL — `agent prompt` aboute son texte à ce qui traîne dans la boîte ET soumet, donc deux
    // textes que personne n'a écrits ensemble partent comme UN SEUL message. Retirer le veto
    // sans rien mettre à la place ramènerait exactement ce défaut-là. On garde la mesure, on
    // change la CONSÉQUENCE : le diagnostic devient un rattrapage au lieu d'un refus.
    //
    // ⚠️ ET C'ÉTAIT UNE MOITIÉ MANQUANTE, PAS UNE GARDE TROP ZÉLÉE. Le veto a été posé ici par
    // `1dae9c7` (T-20260817-0006) ; le rattrapage a été livré le MÊME JOUR par `eceba2e`
    // (T-20260816-0114) — mais dans `livraison.js`, et seulement pour ses appelants à lui.
    // Ce chemin-ci, celui par lequel arrive la parole du dirigeant, a reçu l'interdit sans le
    // remède. Vingt-quatre heures pendant lesquelles il a dû ouvrir un terminal pour parler à
    // ses propres agents — et le refus le lui disait lui-même.
    // ⚠️ LE DISCRIMINANT COLLÉ / TAPÉ DÉCIDE DE CE QU'ON OBSERVE — PAS DE QUI ON REFUSE.
    //
    // Il a d'abord décidé de la DURÉE de l'attente (5 min pour du tapé) : ça faisait patienter
    // le dirigeant en silence. Il a ensuite décidé d'un REFUS SEC sur le tapé : ça le laissait
    // PRIS. Mesuré, mot pour mot, ce qu'il recevait alors sur Slack — « Le geste : va voir
    // l'écran (« herdr agent focus w5:p8 »), et renvoie ton message. » **Il ne peut pas.** Il
    // est au téléphone. Le refus était juste, nommé, instantané, et il le laissait exactement
    // où il était : « une porte sur deux » posée par le correctif qui ferme la première.
    //
    // SA CONSIGNE TRANCHE : « je dois pouvoir débloquer en écrivant un message, ça va lancer
    // les deux messages ». Son message doit PARTIR, même devant un texte tapé.
    //
    // LA FORME QUI HONORE LES DEUX, et c'est `delivrerLaBoite` qui la porte déjà :
    //   • le texte BOUGE pendant qu'on regarde → quelqu'un a les doigts sur le clavier. Il
    //     soumettra lui-même dans quelques secondes. On s'abstient, on le dit, et l'état se
    //     résout tout seul — transitoire et nommé, ce n'est pas « être pris ».
    //   • le texte est IMMOBILE → son auteur est parti. On le soumet, et LE DESTINATAIRE EST
    //     PRÉVENU de ce qui est parti en son nom.
    //
    // ⚠️ LA FENÊTRE EST COURTE, ET C'EST CE CHEMIN-CI QUI LE COMMANDE. Les cinq minutes de
    // `IMMOBILITE_PAR_DEFAUT_MS` ont été réglées là où celui qui patiente est un agent. Ici
    // c'est un humain, et sa ligne est tout l'objet du dispositif. Dix secondes voient des
    // doigts sur un clavier ; elles ne font attendre personne.
    //
    // ⚠️ CE QUE ÇA COÛTE, ET IL FAUT LE DIRE : une fenêtre courte soumet plus souvent la phrase
    // de quelqu'un qui a tapé la moitié puis s'est levé. C'est l'arbitrage du dirigeant, pris
    // les yeux ouverts — et ce qui le rend tenable est l'AVIS ci-dessous, qui rend l'incident
    // constatable au lieu de le laisser muet.
    const colle = estUnEspaceReserve(dejaLa);
    const fenetreMs = colle ? 0 : Number(process.env.LIGNE_IMMOBILITE_MS || FENETRE_TEXTE_TAPE_MS);

    const delivrance = await delivrerLaBoite({
      texteCoince: dejaLa,
      commandes: {
        lireEcran: ['agent', 'read', pane, '--format', 'ansi'],
        soumettre: ['agent', 'send-keys', pane, 'Enter'],
      },
      appelHerdr: async (cmd) => {
        try {
          await herdr(cmd, socket);
          return { ok: true };
        } catch {
          // Le code de retour de la touche d'envoi ne prouve rien ici — c'est la boîte vidée qui
          // tranche, et `delivrerLaBoite` la relit. On rend l'échec sans l'interpréter.
          return { ok: false };
        }
      },
      lireEcran: async () => ecranDe(pane, socket),
      dormir: (ms) => new Promise((r) => setTimeout(r, ms)),
      // Zéro pour un texte COLLÉ — il est par construction déjà envoyé, il n'y a rien à
      // observer. La fenêtre ne sert qu'au texte tapé. `delivrerLaBoite` relit dans les deux
      // cas avant de soumettre et s'abstient si le contenu a bougé : la garde ne dépend pas
      // du délai, le délai ne fait que lui donner de quoi voir.
      immobiliteMs: fenetreMs,
    });

    // ⚠️ ON NE PASSE QUE SUR CE QU'ON A VU. `ok` couvre deux issues : la boîte a été soumise, ou
    // elle s'est vidée pendant qu'on regardait. Dans les deux cas elle est LIBRE maintenant, et
    // écrire n'y collera rien. Tout le reste — écran de choix, texte qui bouge, touche sans
    // effet — reste un refus, et il sort en erreur : un refus qui rendrait un succès serait pire
    // que le blocage, parce que l'émetteur croirait avoir parlé.
    if (!delivrance.ok || delivrance.cause === 'bouge') {
      throw new RemiseEchouee(
        pane,
        `la boîte de saisie de ${pane} porte un texte que son auteur n’a pas soumis ` +
          `(« ${dejaLa.slice(0, 60)}… »), et je n’ai pas pu l’en sortir${motDuRefusDeDelivrance(delivrance)}. ` +
          `Écrire par-dessus ne livrerait pas deux messages, ça en livrerait UN, les deux textes ` +
          `collés — je m’abstiens. Le geste : libère la boîte (« herdr agent focus ${pane} », puis ` +
          `soumets ou efface ce qui s’y trouve), et renvoie ton message.`
      );
    }

    // ⚠️ LE MOT QUI ACCOMPAGNE LE GESTE — sans lui, l'incident est INEXPLICABLE.
    //
    // On vient de soumettre le texte d'un tiers en son nom. Une boîte pleine ne se signale pas
    // toute seule : sans cet avis, il voit un travail partir de chez lui sans pouvoir dire
    // lequel. L'avis voyage par le chemin qu'on vient de libérer — aucun transport de plus à
    // maintenir — et il n'existe QUE quand quelque chose a réellement eu lieu.
    //
    // ⚠️ CE N'EST PAS LA FUSION QU'ON INTERDIT. Le texte ajouté est LE NÔTRE, pas celui du
    // tiers, et il est séparé du message. La fusion interdite, c'est deux messages d'AUTEURS
    // DIFFÉRENTS collés en un ; ici l'auteur est l'émetteur, qui parle en son nom de ce qu'il
    // a trouvé.
    if (delivrance.soumis) {
      texteALivrer = `${avisDeBoiteBloquee({ texteLibere: delivrance.texte, immobiliteMs: fenetreMs })}\n\n${texte}`;
    }

    // ⚠️ ET L'AUTRE ISSUE, CELLE QU'ON NE SAIT PAS EXPLIQUER — relevée en passe de revue
    // fraîche, bloquante, et le rejet était juste (T-20260818-0049).
    //
    // La boîte a pu être trouvée VIDE : ni immobile, ni changée. Deux causes, et ON N'EN
    // CONNAÎT AUCUNE. Soit son auteur l'a soumise pendant qu'on regardait — bénin, et c'est
    // le cas MAJORITAIRE. Soit le texte a disparu SANS être soumis, et il est alors perdu :
    // un texte non soumis n'existe nulle part ailleurs, ni au ServiceDesk, ni dans un fil.
    //
    // `delivrerLaBoite` rend cette issue `ok` — à raison, la boîte est libre et écrire n'y
    // collera rien. Mais elle rend AUSSI `texteDisparu`, et c'est ce qui rend la perte
    // réparable au lieu de la rendre muette. Ce code ne testait que `!ok` (faux) et `soumis`
    // (faux) : aucune branche ne la traitait, et le message partait sans un mot.
    //
    // ⚠️ C'EST LA TROISIÈME MOITIÉ LAISSÉE DERRIÈRE DANS CE LOT, et la troisième dans le
    // correctif écrit pour fermer les précédentes. Le geste a suivi, l'avis de boîte BLOQUÉE
    // a suivi sur un premier rejet, l'avis de boîte VIDÉE était encore resté. Le module frère
    // le posait déjà depuis T-20260817-0090 ; seul ce chemin-ci l'ignorait.
    //
    // ⚠️ ET CE N'EST PAS LE MÊME AVIS QUE L'AUTRE, délibérément : là-bas le texte A ÉTÉ soumis
    // et on peut dire d'aller le relire ; ici ON N'A RIEN SOUMIS, il n'est nulle part en aval,
    // et promettre par symétrie qu'on le retrouvera enverrait chercher ce qui n'existe pas.
    else if (delivrance.texteDisparu) {
      texteALivrer = `${avisDeBoiteVidee({ texteDisparu: delivrance.texteDisparu })}\n\n${texte}`;
    }

    // ═══ ON REGARDE À NOUVEAU. ON NE DÉDUIT PAS. (T-20260818-0049)
    //
    // ⚠️ RELEVÉ EN PASSE DE CONFIRMATION, BLOQUANT, ET C'EST LE PLUS GRAVE DES QUATRE DÉFAUTS
    // DE CE LOT — parce que c'est LE RATTRAPAGE LUI-MÊME qui ouvre le danger que le lot existe
    // pour fermer.
    //
    // Le texte qu'on vient de soumettre pour son auteur peut être une COMMANDE. Sa soumission
    // déclenche alors, chez le destinataire, une demande de permission : l'écran porte
    // « Do you want to proceed? ❯ 1. Yes » AU-DESSUS d'une boîte parfaitement lisible et vide.
    //
    // `delivrerLaBoite` ne teste que `boiteEstVide` avant de conclure « soumis » — elle voit la
    // boîte vide et rend `ok`. La garde d'entrée de cette fonction, elle, consulte bien l'écran,
    // MAIS AVANT la délivrance. Entre le geste et l'écriture, il n'y avait plus rien.
    //
    // Or écrire là ne livre pas un message : ça CONFIRME l'option affichée. Mesuré le
    // 2026-08-17 contre le vrai service — un texte parfaitement ordinaire a fait EXÉCUTER la
    // commande proposée, le fichier a été créé. Le dirigeant aurait reçu un accusé de réception
    // pour un message que personne n'a lu, et une action que personne n'a validée serait partie.
    //
    // ⚠️ LE MODULE FRÈRE LE FAISAIT DÉJÀ : après une délivrance réussie, `livrerBrief` relit
    // l'état et rejoue sa garde. Encore une moitié posée d'un côté et pas de l'autre — la
    // quatrième de ce lot, et la quatrième du même motif.
    const ecranApresDelivrance = await ecranDe(pane, socket);
    const etatApresDelivrance = etatDeLEcran(ecranApresDelivrance);
    const resteApresDelivrance = contenuBoite(ecranApresDelivrance);
    if (
      ecranAttendUnChoix(ecranApresDelivrance) ||
      (ecranApresDelivrance && !etatApresDelivrance.pretARecevoir) ||
      resteApresDelivrance === null ||
      resteApresDelivrance !== ''
    ) {
      // ⚠️ ET LE REFUS AVOUE LE GESTE DÉJÀ POSÉ. Sans cet aveu, le lecteur voit « dialogue » et
      // ignore qu'une touche d'envoi est DÉJÀ partie vers ce pane, sur le texte d'un AUTRE, qui
      // lui est bien parti. C'est une action irréversible qu'on lui cacherait ; il la
      // découvrirait par ses effets, sans pouvoir la relier à ce refus.
      const vu =
        refusDEcran(etatApresDelivrance, { cible: 'la session' }) ||
        (resteApresDelivrance === null
          ? 'je n’ai plus su lire son écran'
          : resteApresDelivrance !== ''
            ? `sa boîte porte de nouveau un texte (« ${String(resteApresDelivrance).slice(0, 60)}… »)`
            : `ce que je vois attend un CHOIX, pas un message${
                resumeDeLEcran(String(ecranApresDelivrance ?? '')) ? `. Voici ce que j’ai vu :\n${resumeDeLEcran(String(ecranApresDelivrance ?? ''))}` : ''
              }`);
      throw new RemiseEchouee(
        pane,
        `l’état de ${pane} a CHANGÉ pendant que je débloquais sa boîte — ${vu}. Y écrire maintenant ` +
          `ne livrerait pas ta parole : devant un choix, l’écriture CONFIRME l’option affichée ` +
          `(mesuré). Je m’abstiens.` +
          (delivrance.soumis
            ? ` ⚠️ ET J’AI DÉJÀ SOUMIS un premier texte qui bloquait cette boîte — il est parti, ` +
              `entier, tel que son auteur l’avait écrit ; c’est peut-être lui qui a produit cet état.`
            : '') +
          ` Le geste : va voir l’écran (« herdr agent focus ${pane} »), puis renvoie ton message.`
      );
    }
  }

  // ⚠️ CE QUI RESTE OUVERT, ET QUI DOIT ÊTRE DIT — relevé en revue de fond.
  //
  // Entre la lecture de l'écran ci-dessus et l'écriture ci-dessous, il y a deux appels de
  // processus. Quelqu'un peut taper dans la boîte pendant cet intervalle — le destinataire
  // lui-même en train de composer sa réponse, un écho de pair. `agent prompt` aboutera alors
  // quand même, et la garde n'aura rien vu.
  //
  // **Ce n'est pas fermé, et ça ne peut pas l'être ici** : il faudrait que herdr offre un geste
  // atomique « écris seulement si la boîte est vide », ce qu'il n'expose pas. Ce qui est fermé,
  // c'est le cas qui se produit vraiment — une boîte laissée pleine, parfois depuis des heures.
  // La fenêtre restante se compte en centaines de millisecondes.
  //
  // On le nomme plutôt que de laisser croire que la porte est close des deux côtés : c'est la
  // règle de ce module, et taire une fenêtre parce qu'elle est étroite est la façon dont elle
  // se fait oublier.
  let reponse;
  try {
    reponse = await herdr(['agent', 'prompt', pane, texteALivrer], socket);
  } catch (err) {
    throw new RemiseEchouee(pane, err.message);
  }
  // MESURÉ, et c'est le piège central de cette intégration : herdr sort avec le CODE 0
  // même quand il échoue — `agent_not_found` arrive sur stdout, en JSON, sans code
  // d'erreur processus. Se fier au code de sortie, c'est déclarer remis un message que
  // personne n'a reçu. On lit donc la réponse, toujours.
  if (reponse?.error) {
    throw new RemiseEchouee(pane, reponse.error.code || reponse.error.message || 'erreur herdr sans code');
  }
  if (!reponse || !reponse.result) {
    throw new RemiseEchouee(pane, `réponse inattendue de herdr : ${JSON.stringify(reponse).slice(0, 200)}`);
  }

  // ═══ ET ON RELIT LA BOÎTE — parce que « l'appel a réussi » ne veut pas dire « il a lu ».
  //
  // Le contrôle ci-dessus ferme le piège du code de sortie 0 sur une ERREUR. Il ne dit rien du
  // mode de panne mesuré le 2026-08-14 : l'appel réussit, et le texte reste dans la boîte de
  // saisie sans être soumis. L'agent ne voit rien, le dirigeant a son accusé de réception, et
  // c'est le chemin par lequel arrive sa parole.
  //
  // ⚠️ ON NE CODE AUCUN SEUIL DE LONGUEUR, et c'est la leçon de la mesure : 25 envois de 350 à
  // 24 000 caractères n'ont produit aucun collage, alors que le même envoi de 2 400 caractères
  // sur l'autre primitive reste bloqué 2 fois sur 5. Ce n'est pas une frontière, c'est une
  // COURSE. La seule forme qui tienne contre une course est de vérifier à chaque fois.
  const ecranApres = await ecranDe(pane, socket);
  const reste = contenuBoite(ecranApres) || null;
  if (reste) {
    // ═══ LA TOUCHE D'ENVOI EST GARDÉE — T-20260817-0006, et le danger est MESURÉ, pas supposé.
    //
    // Devant une boîte, la touche d'envoi SOUMET un texte. Devant un dialogue de choix, elle
    // CONFIRME l'option par défaut — ce n'est plus un message qui part, c'est une ACTION
    // approuvée à l'insu de tout le monde. Le 2026-08-17, sur le pane où un message fusionné
    // venait de partir, l'écran portait `Do you want to proceed? ❯ 1. Yes`. Envoyer `Enter`
    // là-dessus aurait approuvé la commande qu'un ordre inventé venait de déclencher.
    //
    // On s'abstient donc devant tout ce qui ressemble à un choix, et devant tout écran non
    // déclaré prêt — l'inconnu n'est jamais prêt. Le message reste dans la boîte et le refus le
    // dit : perdre une remise coûte un renvoi, approuver une action ne se reprend pas.
    //
    // ⚠️ LA SONDE PORTE SUR L'ÉCRAN ENTIER, PAS SUR LA BOÎTE — et c'est un essai qui l'a corrigé,
    // pas un raisonnement. Sonder la seule boîte laissait passer le cas mesuré : le dialogue
    // s'affiche AU-DESSUS d'une boîte parfaitement lisible, qui porte notre propre texte. La
    // boîte ne ressemblait donc à rien de suspect, `etatDeLEcran` la déclarait prête — un écran
    // de permission n'est pas parmi les écrans connus — et la touche partait quand même.
    //
    // Le prix de ce choix est assumé : une sortie d'agent qui parlerait de confirmation ou
    // commencerait par « 1. » ferait refuser à tort. On aura perdu une remise — que son refus
    // nomme, et que le dirigeant peut renvoyer — au lieu d'avoir approuvé une action que
    // personne ne peut reprendre. Et ce chemin n'est atteint que si le texte est resté coincé,
    // c'est-à-dire dans un cas déjà anormal.
    const etat = etatDeLEcran(ecranApres);
    if (ecranAttendUnChoix(ecranApres) || !etat.pretARecevoir) {
      throw new RemiseEchouee(
        pane,
        `le message est resté dans la boîte de saisie de ${pane}, et je ne peux pas l’en sortir : ` +
          `${refusDEcran(etat, { cible: 'la session' }) || 'ce que je vois ressemble à un choix, pas à un message'}. ` +
          `La touche d’envoi y confirmerait une action au lieu de soumettre un texte — je m’abstiens. ` +
          `Le geste : va voir l’écran (« herdr agent focus ${pane} »), puis renvoie ton message.`
      );
    }
    // Le cas connu : le texte est bien arrivé, la soumission n'est pas partie. On envoie la
    // touche d'envoi — jamais le texte à nouveau, ce qui le collerait à lui-même.
    // ⚠️ L'ERREUR DE LA TOUCHE D'ENVOI N'EST PLUS AVALÉE — elle est GARDÉE (T-20260818-0049).
    //
    // Ce `.catch(() => null)` jetait ce que herdr avait répondu. Sa conséquence n'était PAS de
    // rendre un faux succès — la relecture d'en dessous reste l'autorité, et elle refuse si le
    // texte est encore là. Sa conséquence était autre, et coûteuse : ON NE POUVAIT PAS SAVOIR
    // POURQUOI. Un refus qui dit « le message n'est pas parti » sans dire ce que la touche a
    // répondu laisse son lecteur sans prise, et oblige le prochain qui enquête à refaire la
    // mesure depuis zéro. C'est ce qui a coûté une heure sur ce lot.
    //
    // ⚠️ ON NE LÈVE TOUJOURS PAS DESSUS, et c'est délibéré : le code de retour de la touche
    // d'envoi ne prouve rien DANS LES DEUX SENS — il peut rendre `ok` sans que la touche ait
    // pris, et rendre une erreur alors qu'elle a pris. C'est la boîte vidée qui tranche, jamais
    // lui. Mais ce qu'il a dit rejoint désormais le refus, quand il y en a un.
    let erreurDeLEnvoi = null;
    await herdr(['agent', 'send-keys', pane, 'Enter'], socket).catch((err) => {
      erreurDeLEnvoi = err?.message || String(err);
      return null;
    });

    // ═══ ON LAISSE À LA BOÎTE LE TEMPS DE SE VIDER (T-20260818-0049).
    //
    // ⚠️ UNE LECTURE UNIQUE NE DIT RIEN QUAND LE SYSTÈME RETARDE, et c'est le dirigeant qui a
    // nommé le symptôme :
    //
    //   > « là les boîtes de texte ne se vident pas sur les fenêtres herdr et c'est vraiment
    //   > un très gros problème »
    //
    // Ce code envoyait la touche d'envoi puis relisait DANS LA FOULÉE, sans un instant
    // d'attente. Si le terminal n'avait pas encore traité la touche — et il met le temps qu'il
    // met —, le refus tombait : « le message est resté dans la boîte de saisie — il n'a pas été
    // soumis ». C'est le message EXACT que le dirigeant a reçu, ET IL PEUT ÊTRE FAUX : la touche
    // avait pu marcher. Un refus qui se prononce sur une lecture trop tôt est un refus qui ment.
    //
    // ⚠️ ET LE SAVOIR-FAIRE EXISTAIT DÉJÀ, À CÔTÉ. `delivrerLaBoite` relit jusqu'à dix fois en
    // dormant entre deux, précisément parce qu'une boîte ne se vide pas dans l'instant. Ici,
    // rien. C'est la même asymétrie que celle que ce lot ferme par ailleurs : le geste juste
    // vivait dans un module et manquait dans l'autre.
    //
    // UNE SEULE TOUCHE, PLUSIEURS LECTURES. On ne matraque pas la boîte — envoyer Entrée en
    // boucle soumettrait ce que le destinataire aurait commencé à taper entre-temps. On a posé
    // le geste une fois ; on se donne seulement de quoi le CONSTATER.
    let apres = contenuBoite(await ecranDe(pane, socket)) || null;
    for (let i = 0; apres && i < RELECTURES_APRES_ENVOI; i += 1) {
      await new Promise((r) => setTimeout(r, DELAI_RELECTURE_MS));
      apres = contenuBoite(await ecranDe(pane, socket)) || null;
    }
    if (apres) {
      throw new RemiseEchouee(
        pane,
        `le message est resté dans la boîte de saisie (« ${apres.slice(0, 60)}… ») — il n'a pas été soumis, ` +
          `et la touche d'envoi n'y a rien changé en ${Math.round((RELECTURES_APRES_ENVOI * DELAI_RELECTURE_MS) / 1000)} s` +
          (erreurDeLEnvoi ? ` ; la touche d'envoi a d'ailleurs répondu : ${erreurDeLEnvoi}` : '')
      );
    }
  }

  // ═══ L'AGENT A-T-IL PRIS ? — le verdict que l'accusé de réception du dirigeant attend.
  //
  // ⚠️ « ÉCRIT DANS LE PANE » N'EST PAS « PRIS ». Le dirigeant l'a dit mieux que le ticket :
  // « des fois le message est passé mais reste dans ton champ de prompt ». On relit donc l'état
  // APRÈS et on le compare à celui d'AVANT — trois témoins, un seul suffit, et aucun d'eux
  // n'aurait pu être vrai sans qu'il se passe quelque chose.
  //
  // ⚠️ ET SI AUCUN N'EST CONSTATABLE, ON REND `pris: false` PLUTÔT QUE DE JETER. Le message est
  // peut-être arrivé — la boîte est vide, le statut n'a pas bougé, on ne sait pas. Ce qu'on
  // refuse, c'est de l'AFFIRMER : le crochet ne sera pas posé, et son absence est justement
  // l'information que ce dispositif existe pour rendre lisible.
  const apres = await etatDuPane(pane, socket);
  const temoin = laPriseEstConstatee({
    statutAvant: avant.statut,
    statut: apres.statut,
    ecranAvant: avant.ecran,
    ecran: apres.ecran,
  });
  return { ...reponse.result, pris: Boolean(temoin), temoin };
}

/**
 * L'état d'un pane à un instant — son statut et son écran, lus ensemble.
 *
 * Rendus tels quels, `null` compris : une lecture ratée ne doit pas se déguiser en écran vide,
 * sinon « je n'ai pas vu » deviendrait « il n'y avait rien », qui est le motif que ce dépôt
 * ferme partout ailleurs.
 */
async function etatDuPane(pane, socket) {
  let statut = null;
  try {
    const r = await herdr(['agent', 'get', pane], socket);
    statut = r?.result?.agent?.agent_status ?? null;
  } catch {
    /* pas de statut lisible : on le dit en le laissant à null */
  }
  let ecran = null;
  try {
    const { stdout } = await lancer(OUTILS.herdr, ['agent', 'read', pane, '--format', 'ansi'], {
      maxBuffer: 16 * 1024 * 1024,
      ...(socket ? { env: { ...process.env, HERDR_SOCKET_PATH: socket } } : {}),
    });
    ecran = stdout;
  } catch {
    /* écran illisible */
  }
  return { statut, ecran };
}

/**
 * L'écran d'un pane, tel que le terminal le rend — `null` si on n'a pas su le lire.
 *
 * ⚠️ C'EST L'ÉCRAN ENTIER QU'ON REND, PAS SEULEMENT LA BOÎTE, et ce n'est pas un détail : un
 * dialogue de choix s'affiche PAR-DESSUS un écran qui porte une boîte parfaitement lisible.
 * Qui ne regarde que la boîte ne voit pas le modal, et envoie sa touche d'envoi dedans.
 */
async function ecranDe(pane, socket) {
  try {
    const { stdout } = await lancer(OUTILS.herdr, ['agent', 'read', pane, '--format', 'ansi'], {
      maxBuffer: 16 * 1024 * 1024,
      ...(socket ? { env: { ...process.env, HERDR_SOCKET_PATH: socket } } : {}),
    });
    return stdout;
  } catch {
    return null;
  }
}

/** Tous les panes qui portent un agent, tels que herdr les voit maintenant. */
export async function agents({ socket } = {}) {
  if (socket) {
    const reponse = await herdrStrict(['agent', 'list'], socket);
    return (reponse.result?.agents || []).filter((a) => a.agent);
  }
  // Sans socket désigné : agréger TOUTES les sessions herdr du poste. Se contenter de la
  // plus récente ferait conclure « cet agent est mort » pour tout agent vivant dans une
  // autre session — et refermerait sa ligne alors qu'il travaille.
  const vus = new Map();
  // Aucune session trouvée sur le disque ne veut pas dire « pas de herdr » : la découverte
  // suppose une arborescence qui peut ne pas exister (autre système, autre version). On
  // tente alors l'appel sans socket imposé et on laisse herdr chercher lui-même — sans
  // cela, le veilleur cessait purement et simplement de consulter herdr, donc concluait
  // que tous les agents étaient morts.
  const sessions = socketsHerdr();
  for (const s of sessions.length ? sessions : [undefined]) {
    try {
      const reponse = await herdrStrict(['agent', 'list'], s);
      for (const a of (reponse.result?.agents || []).filter((x) => x.agent)) {
        if (!vus.has(a.pane_id)) vus.set(a.pane_id, { ...a, herdr_socket: s });
      }
    } catch (err) {
      // ⚠️ UN OUTIL INTROUVABLE N'EST PAS UNE SESSION INJOIGNABLE — T-20260813-0054, et c'est
      // la conséquence la plus chère de toute cette famille de défauts.
      //
      // Ce `catch` est bon pour ce pour quoi il a été écrit : une session herdr morte ne doit
      // pas invalider les autres. Mais `herdr` absent du `PATH` fait échouer TOUTES les
      // sessions, ce silence rend alors une liste VIDE, et une liste vide veut dire « aucun
      // agent vivant ». En aval, `vivant()` rend `false`, le veilleur clôt la ligne d'office
      // et répond « agent disparu » — pour un agent qui travaille, dans une session ouverte.
      //
      // On ne l'avale donc pas : l'appelant a déjà, à chaque site, un chemin « herdr
      // injoignable » qui reporte au lieu de conclure. C'est celui-là qu'il faut atteindre.
      if (err instanceof OutilIntrouvable) throw err;
      /* session injoignable : les autres restent valables */
    }
  }
  return [...vus.values()];
}

/**
 * Un agent est-il encore vivant dans ce pane ?
 *
 * ATTENTION à ce que ça veut dire : herdr voit des PANES. Un pane fermé disparaît de la
 * liste — c'est notre signal de mort. Un agent qui a rendu la main mais dont le pane est
 * ouvert reste « vivant » : il peut encore recevoir un message, et c'est précisément ce
 * qu'on veut pour un chantier en attente d'arbitrage.
 */
export async function vivant(pane, { socket } = {}) {
  const liste = await agents({ socket });
  return liste.some((a) => a.pane_id === pane);
}

/** Le pane courant — celui depuis lequel la commande locale est invoquée. */
export async function paneCourant() {
  const reponse = await herdrStrict(['pane', 'current'], process.env.HERDR_SOCKET_PATH);
  const p = reponse.result?.pane;
  if (!p) throw new Error("herdr ne rend pas de pane courant — la commande n'est pas lancée depuis un pane herdr.");
  return {
    pane: p.pane_id,
    nom: p.name || null,
    // Le worktree est `foreground_cwd`, pas `cwd` : un agent né par claude-swt garde le
    // dépôt principal en `cwd` pendant que son travail vit ailleurs.
    worktree: p.foreground_cwd || p.cwd || null,
    statut: p.agent_status || null,
    // La session herdr d'où vient cet agent : le veilleur ne peut pas la deviner, il y a
    // plusieurs sessions sur un poste et la plus récente n'est pas forcément la bonne.
    herdr_socket: process.env.HERDR_SOCKET_PATH || null,
  };
}

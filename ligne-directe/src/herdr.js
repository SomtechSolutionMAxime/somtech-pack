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
import { contenuBoite, laPriseEstConstatee } from './boite.js';
import { etatDeLEcran, refusDEcran, ecranAttendUnChoix } from './ecran.js';

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
 * Remet un message à un agent, et prouve la remise.
 * @returns {Promise<object>} le `result` rendu par herdr — la preuve, pas une supposition
 */
export async function remettre(pane, texte, { socket } = {}) {
  if (texte.length > SEUIL_ARGV) {
    throw new RemiseEchouee(pane, `message de ${texte.length} caractères — au-delà de ${SEUIL_ARGV}, à découper`);
  }
  // CE QU'ON VOIT AVANT D'ÉCRIRE — sans quoi rien de ce qu'on verra après ne prouvera quoi que
  // ce soit. Un état qui ne pouvait pas être différent n'est pas un témoin (T-20260815-0011).
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
    throw new RemiseEchouee(
      pane,
      `la boîte de saisie de ${pane} porte déjà un texte que son auteur n’a pas soumis ` +
        `(« ${dejaLa.slice(0, 60)}… ») — écrire par-dessus ne livrerait pas deux messages, ` +
        `ça en livrerait UN, les deux textes collés. Le geste : libère la boîte (« herdr agent focus ` +
        `${pane} », puis soumets ou efface ce qui s’y trouve), et renvoie ton message.`
    );
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
    reponse = await herdr(['agent', 'prompt', pane, texte], socket);
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
    await herdr(['agent', 'send-keys', pane, 'Enter'], socket).catch(() => null);
    const apres = contenuBoite(await ecranDe(pane, socket)) || null;
    if (apres) {
      throw new RemiseEchouee(
        pane,
        `le message est resté dans la boîte de saisie (« ${apres.slice(0, 60)}… ») — il n'a pas été soumis`
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

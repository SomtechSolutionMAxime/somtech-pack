// client.js — parler au veilleur depuis un agent, et le réveiller s'il dort.
//
// Le démarrage paresseux suit le patron du canvas : on tente le socket, et s'il ne répond
// pas, on fait naître le veilleur détaché puis on réessaie. Un agent n'a donc jamais à
// savoir si le veilleur tourne — il ouvre sa ligne, c'est tout.

import { connect } from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

import { CHEMIN_SOCKET, CHEMIN_JOURNAL, RACINE } from './registre.js';
import { ETIQUETTE as ETIQUETTE_SERVICE } from './service.js';
import { GESTE_DE_LA_VUE } from './vue-du-parc.js';

const ICI = dirname(fileURLToPath(import.meta.url));

/**
 * LA BORNE ORDINAIRE — celle qui GARDE, et qui ne bouge pas.
 *
 * 🔴 ELLE NE SE RELÈVE PAS « POUR ÊTRE TRANQUILLE ». Une borne haute pour tout le monde ne
 * garde plus rien : le jour où un geste pend VRAIMENT, elle fait attendre deux minutes avant
 * de le dire. On aurait échangé un faux refus contre une vraie attente, et c'est pire.
 */
export const BORNE_PAR_DEFAUT = 30_000;

/**
 * LES GESTES QUI COÛTENT PLUS QUE LES AUTRES — nommés un par un, avec leur mesure.
 *
 * 🔴 `vue` A PENDU CHEZ LE DIRIGEANT PARCE QU'UNE SEULE BORNE SERVAIT LES QUATRE GESTES.
 * Mesuré au socket sur le poste réel, le 2026-08-24 : `ping` et `etat` rendent en **0 ms**,
 * `recensement` en **9 s**, `vue` en **67 127 ms** (puis 71 797 ms au second essai). Une borne
 * unique ne peut être juste pour aucun d'eux : trop lâche pour trois, trop serrée pour un.
 *
 * ⚠️ ET LE COÛT DE LA VUE ÉTAIT STRUCTUREL, PAS ACCIDENTEL — mesuré appel par appel, transport
 * instrumenté : 9 217 ms de recensement, puis 54 144 ms de jointure en **91 appels HTTP
 * séquentiels**. Aucun appel n'était lent (médiane 624-778 ms, max 976 ms) : c'était le NOMBRE
 * qui coûtait. Sa loi d'alors :
 *
 *     T ≈ recensement + 0,7 s × (2 × mandats + epics)
 *
 * — une liste par mandat, un `epics/list` par mandat, **un `tickets/list` par epic**.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA PHRASE ÉCRITE ICI LE 2026-08-24 S'EST RÉALISÉE, ET C'EST POURQUOI CETTE BORNE A BAISSÉ
 *
 * Elle disait : *« Ce jour-là, la réponse ne sera pas une borne plus haute : ce sera le nombre
 * d'appels, qu'aucune borne ne peut rattraper. »* C'est ce qu'a fait `E-20260824-0011` : les
 * appels partent de front, bornés à 32 en vol (`src/plafond.js`, et le chiffre y est mesuré
 * contre le vrai service).
 *
 * **Remesuré en tapant la commande, poste réel, 2026-08-25**, l'avant et l'après ENTRELACÉS tour
 * par tour pour qu'ils portent le même parc au même instant — 18 lignes d'orchestrateur dont 14
 * codées (13 codes distincts), 91 lignes d'epic (86 epics distincts), 265 lignes de story :
 *
 *     tour        1        2        3        4        5
 *     avant   89,38 s  65,91 s  68,08 s  75,86 s  65,77 s
 *     après   15,55 s  14,30 s  14,87 s  14,97 s  13,08 s
 *
 * 🔴 ET UNE PASSE DE REVUE A MESURÉ BIEN PIRE, SUR UN POSTE SATURÉ (load average ~105, 242
 * processus node) — entrelacé pareil, sept tours : 14,39 · 15,42 · 15,96 · 16,22 · 16,71 ·
 * 20,03 · **26,51** s. C'est ce chiffre-là qu'on retient : une borne se pose sur le pire cas
 * mesuré, jamais sur la campagne la plus favorable.
 *
 * ⚠️ LES DEUX CAMPAGNES SONT JUSTES — elles mesurent deux charges de poste. **Une durée absolue
 * est une propriété de la machine autant que du code** ; ce qui mesure le LOT est le rapport
 * avant/après, que l'entrelacement rend insensible à la charge : ×4,5 à ×5,8 sur poste calme,
 * ×3,3 à ×5,5 sur poste saturé.
 *
 * ⚠️ ET LE SERVICEDESK N'EST PLUS LE POSTE DOMINANT, c'est le recensement du poste — d'autant
 * plus net sur poste chargé, où la jointure résiduelle ne pesait plus que **0,4 s et 1,7 s**.
 *
 * 🔴 ALORS 300 s NE GARDAIENT PLUS RIEN, et c'est l'argument écrit six lignes plus haut au sujet
 * de `BORNE_PAR_DEFAUT` : une borne trop lâche fait attendre cinq minutes le jour où un geste
 * pend VRAIMENT. On l'a donc RAMENÉE à 60 s — **2,3× le pire cas mesuré (26,51 s)**, donc
 * au-dessus du 2× que l'épingle du banc exige, et cinq fois moins d'attente devant un vrai
 * blocage. La marge est mince, et c'est dit : le jour où un poste plus chargé encore fera
 * dépasser 30 s à ce geste, il faudra relever cette borne, et l'épingle le réclamera.
 *
 * ⚠️ ET LA CHAÎNE A ROUGI EN CHEMIN, comme elle devait. Baisser cette valeur a fait rougir
 * l'épingle de `tests/le-geste-vue-repond-par-le-socket.test.js` et l'essai qui exigeait que la
 * borne couvre le coût de 67 s. On les a SUIVIS — coût remesuré, date refaite, épingle
 * réalignée — au lieu de les contourner. C'est la chaîne posée par `E-20260824-0001` qui a
 * fonctionné exactement comme elle le prévoyait, dans l'autre sens.
 *
 * ⚠️ CE N'EST PAS UNE PERMISSION D'ATTENDRE UNE MINUTE. La sonde ci-dessous refuse dès que
 * le veilleur cesse de répondre : la borne haute n'est atteinte que par un veilleur VIVANT et
 * occupé, jamais par un veilleur mort.
 */
export const BORNES_PAR_GESTE = Object.freeze({ [GESTE_DE_LA_VUE]: 60_000 });

/**
 * LA SONDE DE VIE — ce qui rend une borne haute admissible.
 *
 * Elle mesure « le veilleur est-il MUET ? », jamais « ce geste est-il long ? ». Ce sont deux
 * questions opposées que la même attente servait : c'est en chronométrant `ping` et `etat`
 * PENDANT que la vue tournait (0 ms, tous les deux, sur 71 s de vue) qu'on a su que le
 * veilleur n'était pas bloqué. Le refus fait désormais cette mesure au lieu de la deviner.
 */
export const SONDE_PAR_DEFAUT = Object.freeze({ intervalle: 3_000, borne: 2_000 });

/** La borne d'un geste — la sienne s'il en a une, celle qui garde sinon. */
export function borneDuGeste(geste, { bornesParGeste = BORNES_PAR_GESTE, borneParDefaut = BORNE_PAR_DEFAUT } = {}) {
  const propre = bornesParGeste?.[geste];
  return Number.isFinite(propre) ? propre : borneParDefaut;
}

/** Un aller-retour sur le socket local. Ne démarre rien. */
export function demander(requete, cheminSocket = CHEMIN_SOCKET, { delai = BORNE_PAR_DEFAUT, signal } = {}) {
  return new Promise((resolve, reject) => {
    const flux = connect(cheminSocket);
    let tampon = '';
    const minuteur = setTimeout(() => {
      flux.destroy();
      reject(new Error(`le veilleur n'a pas répondu en ${delai / 1000}s`));
    }, delai);
    // ⚠️ UNE ATTENTE QU'ON PEUT COUPER, ET ELLE MANQUAIT. Sans elle, une attente abandonnée
    // laisse son minuteur ET sa connexion en vol : avec la borne de la vue, le processus
    // appelant reste debout TROIS MINUTES après avoir déjà rendu son refus — mesuré sur ce
    // lot même, la suite d'essais ne rendait jamais la main. Ce qui ne se coupe pas ne
    // s'abandonne pas vraiment.
    const couper = () => {
      clearTimeout(minuteur);
      flux.destroy();
      reject(Object.assign(new Error('attente abandonnée'), { code: 'ABANDONNEE' }));
    };
    if (signal) {
      if (signal.aborted) return couper();
      signal.addEventListener('abort', couper, { once: true });
    }
    flux.on('connect', () => flux.write(`${JSON.stringify(requete)}\n`));
    flux.on('data', (m) => {
      tampon += m.toString('utf8');
      const coupure = tampon.indexOf('\n');
      if (coupure === -1) return;
      clearTimeout(minuteur);
      flux.end();
      try {
        resolve(JSON.parse(tampon.slice(0, coupure)));
      } catch (err) {
        reject(new Error(`réponse illisible du veilleur : ${err.message}`));
      }
    });
    flux.on('error', (err) => {
      clearTimeout(minuteur);
      reject(err);
    });
  });
}

/** Fait naître le veilleur, détaché de l'agent qui l'invoque — il doit lui survivre. */
export function reveillerVeilleur() {
  mkdirSync(RACINE, { recursive: true });
  const sortie = openSync(CHEMIN_JOURNAL, 'a');
  const enfant = spawn(process.execPath, [join(ICI, 'demarrer-veilleur.js')], {
    detached: true,
    stdio: ['ignore', sortie, sortie],
    env: process.env,
  });
  enfant.unref();
  return enfant.pid;
}

const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Aller-retour avec le veilleur, en le réveillant au besoin.
 *
 * Une seule tentative de réveil : si le veilleur ne peut pas naître (jeton absent, par
 * exemple), il faut le DIRE, pas boucler en silence. L'erreur du veilleur mort-né est
 * dans son journal, dont on donne le chemin.
 */
/**
 * LA PLACE EST-ELLE TENUE ? — question DIFFÉRENTE de « quelqu'un répond-il ? ».
 *
 * 🔴 C'EST LA CONFUSION QUI A FAIT VIVRE DEUX VEILLEURS (T-20260825-0101). Mesuré sur le
 * poste le 2026-08-25 : deux processus sur `veilleur.sock` (22215 et 67661), le second né la
 * veille et sourd au geste `ceder` ; le journal du poste porte deux « veilleur démarré » à
 * **77 secondes d'écart**, et celui du début vivait encore 28 h plus tard. Deux écoutes
 * Slack, donc chaque parole du dirigeant remise en double.
 *
 * La cause tient en une ligne : « il ne répond pas » était lu comme « il est mort ». Or un
 * veilleur dont la boucle d'événements est occupée TIENT toujours sa place et son écoute —
 * il est vivant, il est muet. Et ce n'est pas un cas d'école : mesuré au socket du poste, le
 * geste `vue` a pendu **67 127 ms**, soit trente-trois fois la borne du sondage de présence.
 *
 * ⚠️ ON NE DEMANDE RIEN — ON PREND LA POIGNÉE. Un socket UNIX dont le processus est mort
 * refuse la connexion (`ECONNREFUSED`, mesuré) ; un socket tenu par un processus vivant
 * l'accepte MÊME SI SA BOUCLE EST BLOQUÉE — le noyau la met en file d'attente sans que
 * l'application ait à lever le petit doigt (mesuré sur une boucle bloquée 6 s : la connexion
 * aboutit). C'est la seule sonde qui distingue « muet » de « mort ».
 *
 * ⚠️ ET ON NE LIT PAS LA RÉPONSE, EXPRÈS. Attendre un `ok` ferait déclarer libre une place
 * tenue par un veilleur qui n'a pas fini de charger son identité — le veilleur le dit
 * lui-même de son `ping` : *« un ping répond la PRÉSENCE, jamais la disponibilité »*.
 *
 * ⚠️ SON DOUTE PENCHE DU CÔTÉ DE LA PRUDENCE, délibérément. Si rien ne se conclut à temps,
 * on rend « tenue » : refuser à tort de prendre la place laisse le poste sans veilleur —
 * bruyant, réparable — là où prendre à tort la place d'un vivant remet chaque parole en
 * double, en silence.
 *
 * 🔴 CE QUE CETTE SONDE NE VOIT PAS, ET C'EST MESURÉ, PAS SUPPOSÉ. Un socket UNIX dont la
 * FILE D'ATTENTE EST PLEINE **refuse** la connexion au lieu de la faire attendre : mesuré,
 * 200 connexions simultanées sur une file de 1 avec la boucle du serveur bloquée rendent
 * 199 `ECONNREFUSED` et une seule prise. Un veilleur vivant dont la file serait saturée
 * serait donc lu comme mort. Ce qu'il faudrait pour y arriver : **511 connexions locales en
 * attente** (la file par défaut de Node) pendant que sa boucle est bloquée — soit cinq cents
 * commandes simultanées sur un poste. La limite est nommée ici parce qu'un trou tu est un
 * trou qui revient ; elle n'est pas fermée parce qu'on ne sait pas la reproduire autrement
 * que par une saturation dépendante de la machine, et une garde qu'on ne peut pas éprouver
 * ne garde rien.
 *
 * ⚠️ ET LA BRANCHE DU MINUTEUR CI-DESSOUS EST, DE FAIT, INATTEIGNABLE — l'épreuve par
 * mutation le dit : la retourner ne fait rougir aucun banc. Mesuré, la prise tranche 30 fois
 * sur 30 avant le minuteur, même réglé à zéro. Elle reste comme filet, et son sens est écrit
 * juste au-dessus ; elle n'est PAS gardée.
 */
export function placeTenue(cheminSocket = CHEMIN_SOCKET, { borne = 2000 } = {}) {
  // ⚠️ PAS DE RACCOURCI « le fichier n'existe pas, donc personne » — il y en avait un, et
  // l'épreuve par mutation l'a rendu SURVIVANT : le retirer ne faisait rougir aucun banc,
  // parce que la connexion échoue de toute façon (`ENOENT`) et rend le même verdict. Une
  // ligne que rien ne garde est une ligne qui dérivera sans qu'on le voie ; ici, la laisser
  // partir REND en plus la branche d'erreur porteuse du cas « il n'y a rien ».
  return new Promise((resolve) => {
    let rendu = false;
    const trancher = (verdict) => {
      if (rendu) return;
      rendu = true;
      clearTimeout(minuteur);
      try {
        flux.destroy();
      } catch {
        /* déjà fermé */
      }
      resolve(verdict);
    };
    const flux = connect(cheminSocket);
    const minuteur = setTimeout(() => trancher(true), borne);
    minuteur.unref?.();
    flux.on('connect', () => trancher(true));
    flux.on('error', () => trancher(false));
  });
}

/**
 * QUI TIENT LA PLACE — comptés un par un, jamais déduits d'une réponse.
 *
 * 🔴 UNE RÉPONSE NE VIENT QUE D'UN SEUL. C'est ce qui a laissé `passerLaMain()` rendre
 * `{"ok":true,"ancien_cede":true}` pendant que deux veilleurs vivaient : elle avait la parole
 * d'un occupant, elle n'a jamais demandé combien ils étaient. Ce geste-ci pose la question au
 * système, pas à un interlocuteur.
 *
 * ⚠️ `lsof -t <chemin>` APPARIE PAR NOM, PAS PAR INODE — vérifié sur ce poste : après un
 * `unlink` suivi d'un `listen` par un autre processus, il rend **les deux** (mesuré : 47387
 * et 47491). C'est ce qui le rend capable de voir le revenant, celui qui tient encore un
 * socket dont le chemin a été effacé sous lui. Et il ne compte QUE les occupants : un client
 * simplement connecté n'y figure pas (mesuré).
 *
 * ⚠️ « AUCUN OCCUPANT » ET « JE N'AI PAS PU COMPTER » NE SONT PAS LE MÊME FAIT, et les
 * confondre serait refaire le défaut d'un cran plus haut. `lsof` sort en 1 avec une sortie
 * vide quand il n'a rien trouvé — c'est une réponse, on rend `[]`. S'il est introuvable, tué
 * ou expiré, on n'a rien mesuré du tout — on rend `null`, et l'appelant devra le dire.
 */
export function occupantsDeLaPlace(cheminSocket = CHEMIN_SOCKET) {
  let sortie;
  try {
    sortie = execFileSync('lsof', ['-t', '--', cheminSocket], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
  } catch (err) {
    // Un code de sortie NUMÉRIQUE veut dire que l'outil a tourné et s'est prononcé ; sans
    // lui (`ENOENT`, `SIGTERM` d'expiration), la question n'a pas été posée.
    if (typeof err?.status !== 'number') return null;
    sortie = err.stdout || '';
  }
  return sortie
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isInteger);
}

/**
 * Le refus rendu quand PLUSIEURS processus tiennent encore la place.
 *
 * 🔴 « UN VEILLEUR NEUF RÉPOND » N'EST PAS « UN SEUL VEILLEUR TOURNE ». La relève a beau
 * avoir eu lieu, un revenant d'avant peut vivre à côté — c'est l'état exact mesuré le
 * 2026-08-25. Rendre « ok » là-dessus, c'est signer l'unicité qu'on vient de ne pas vérifier.
 *
 * ⚠️ LE GESTE PROPOSÉ NOMME SES CIBLES ET NE FRAPPE PAS PAR MOTIF. `pkill -f` a déjà coûté
 * onze lignes de discussion vivantes sur ce poste (T-20260811-0087) : il tue tout ce qui
 * ressemble au motif, jusqu'à un `tail` ouvert sur le fichier. On montre donc d'abord QUI
 * est là et depuis quand, et on n'arrête que le pid désigné.
 */
export function refusPlacePartagee(occupants, { cheminSocket = CHEMIN_SOCKET } = {}) {
  return new Error(
    `La relève a eu lieu, mais ${occupants.length} occupants tiennent encore la place — un veilleur de trop, ` +
      'et chaque parole du dirigeant sera remise en double.\n' +
      `  Ils sont nommés, pas à chercher : ${occupants.join(', ')}\n` +
      '  Regarde lequel est le revenant (le plus ancien), puis arrête CELUI-LÀ, par son pid :\n' +
      `    ps -o pid=,lstart=,args= ${occupants.map((p) => `-p ${p}`).join(' ')}\n` +
      '    kill <le pid le plus ancien>\n' +
      `  La place en cause : ${cheminSocket}`
  );
}

/**
 * Le refus rendu quand le veilleur en place ne cède pas la main.
 *
 * CE REFUS PROPOSAIT `pkill -f demarrer-veilleur.js`, et c'est le même défaut que celui du
 * trousseau (T-20260811-0087) par un autre chemin : `pkill -f` frappe PAR MOTIF, sur la
 * ligne de commande entière. Il tuait donc tout veilleur du poste — les onze lignes de
 * discussion vivantes avec — et jusqu'à un `tail` ou un éditeur ouvert sur ce fichier-là.
 * Un message d'erreur ne met pas ce geste dans la bouche de quelqu'un qui lui fait confiance.
 *
 * On nomme donc le processus AVANT de l'arrêter : `lsof` rend le seul qui tient la place.
 */
export function refusVeilleurTetu(refus, { cheminSocket = CHEMIN_SOCKET, occupants = null } = {}) {
  // ⚠️ QUAND ON SAIT QUI C'EST, ON LE DIT. Envoyer chercher un pid qu'on a déjà mesuré une
  // seconde plus tôt, c'est faire refaire à la main un travail déjà fait — et c'est pendant
  // ce travail-là qu'on tape `pkill` par lassitude.
  const nommes = occupants?.length
    ? `  La place est tenue par : ${occupants.join(', ')} — arrête CELUI-LÀ, par son pid.\n`
    : `  Sinon, nomme d'abord le seul processus qui tient la place, puis arrête CELUI-LÀ :\n    lsof -t ${cheminSocket}\n`;
  return new Error(
    `Le veilleur en place n'a pas cédé la main${refus ? ` (${refus})` : ''}.\n` +
      `  C'est le cas d'une version antérieure à celle qui sait céder — ou d'un veilleur occupé au point de ne plus répondre.\n` +
      `  S'il vient du service du poste, un redémarrage suffit et ne touche à rien d'autre :\n` +
      `    launchctl kickstart -k gui/$(id -u)/${ETIQUETTE_SERVICE}\n` +
      nommes +
      `  La place en cause : ${cheminSocket}\n` +
      `  Les relèves suivantes se feront toutes seules.`
  );
}

/**
 * Fait passer la main : le veilleur en place se retire, un neuf prend sa suite.
 *
 * C'est le geste qui manquait. Le verrou d'unicité protège des remises en double, mais il
 * interdisait du même coup toute mise à jour : le veilleur neuf trouvait la place occupée
 * et se retirait, donc une version fraîchement publiée restait sans effet — sans que rien
 * ne le signale. Il fallait chercher un identifiant de processus et le tuer à la main.
 */
export async function passerLaMain({ cheminSocket = CHEMIN_SOCKET, reveiller = reveillerVeilleur } = {}) {
  let cede = false;
  let refus = null;
  try {
    const r = await demander({ geste: 'ceder' }, cheminSocket, { delai: 5000 });
    cede = r?.ok === true;
    if (!cede) refus = r?.erreur || 'refus sans motif';
  } catch {
    // Personne au bout du fil : rien à faire céder, on démarre simplement.
    cede = true;
  }

  // La place se libère-t-elle VRAIMENT ? On ne se fie pas à la réponse, on regarde.
  //
  // 🔴 ET « REGARDER » N'EST PAS « REDEMANDER ». Ce qui vivait ici concluait « la place est
  // libre » dès qu'un `ping` restait sans réponse — le MÊME verdict pour un veilleur mort et
  // pour un veilleur seulement occupé. On faisait donc naître un veilleur par-dessus un
  // vivant, et c'est la moitié du double mesuré le 2026-08-25 (T-20260825-0101). La question
  // se pose désormais à la place elle-même : quelqu'un tient-il encore la poignée ?
  let libre = false;
  for (let essai = 0; essai < 20; essai += 1) {
    await dodo(250);
    if (!existsSync(cheminSocket)) {
      libre = true;
      break;
    }
    if (!(await placeTenue(cheminSocket, { borne: 1000 }))) {
      libre = true; // plus personne à la poignée : la place est vraiment libre
      break;
    }
  }

  // ÉCHOUER PLUTÔT QUE MENTIR — le refus vit dans `refusVeilleurTetu`, plus bas.
  // Un veilleur d'une version antérieure ne connaît pas le
  // geste : il refuse, garde la place, et le neuf se retire. Rendre « ok » ici laisserait
  // croire à une relève qui n'a pas eu lieu — et c'est précisément le mode de panne que
  // cette capacité passe sa vie à combattre.
  if (!libre) {
    // Le socket EN CAUSE, pas celui du poste : un message qui nomme la mauvaise place
    // envoie regarder à côté — c'est la même faute que celle qu'on corrige ici.
    throw refusVeilleurTetu(refus, { cheminSocket, occupants: occupantsDeLaPlace(cheminSocket) });
  }

  reveiller();
  for (let essai = 0; essai < 40; essai += 1) {
    await dodo(250);
    let r = null;
    try {
      r = await demander({ geste: 'ping' }, cheminSocket, { delai: 2000 });
    } catch {
      continue; // pas encore prêt
    }
    if (!r?.ok) continue;

    // 🔴 UN VEILLEUR NEUF QUI RÉPOND N'EST PAS « UN SEUL VEILLEUR TOURNE ». C'est le
    // mensonge exact du 2026-08-25 : `{"ok":true,"ancien_cede":true}` rendu pendant que deux
    // processus tenaient le socket. La réponse ne vient QUE d'un occupant ; elle ne dit rien
    // de ceux qui se taisent. On compte donc, au lieu de conclure.
    //
    // ⚠️ LE REFUS EST HORS DU `try`, ET C'EST STRUCTUREL : à l'intérieur, le `catch` du
    // sondage l'avalerait et la boucle repartirait comme si de rien n'était — un refus qui
    // n'empêche rien.
    const occupants = occupantsDeLaPlace(cheminSocket);
    if (occupants && occupants.length > 1) throw refusPlacePartagee(occupants, { cheminSocket });

    // `occupants` remonte tel quel, `null` compris : « je n'ai pas pu compter » est un fait
    // que l'appelant a le droit de connaître. Le taire rendrait cette relève-là
    // indiscernable d'une relève vérifiée.
    return { ok: true, ancien_cede: cede, occupants };
  }
  throw new Error(`Le veilleur n'a pas repris la main en 10s. Regarde pourquoi : tail -20 ${CHEMIN_JOURNAL}`);
}

/**
 * UN SOMMEIL QUI NE RETIENT PAS LE PROCESSUS — `unref`, et ce n'est pas un détail.
 *
 * 🔴 MESURÉ SUR LE POSTE, ET AUCUN BANC NE L'AVAIT VU : `ligne-directe etat` est passé de
 * **62 ms à 3 062 ms** — très exactement l'intervalle de la sonde. La réponse arrivait bien en
 * 60 ms ; c'est le minuteur de la sentinelle, encore en vol, qui tenait le processus debout
 * jusqu'à son échéance. Une surveillance ne doit rien coûter à ce qu'elle surveille.
 *
 * ⚠️ `dodo` RESTE INTACT POUR SES AUTRES USAGES. `passerLaMain` et le réveil paresseux
 * ATTENDENT vraiment : leur sommeil doit tenir le processus, sinon la commande meurt avant que
 * le veilleur soit né. Deux sommeils, deux besoins opposés — les fondre casserait l'un des deux.
 */
const sommeilQuiNeRetientRien = (ms) =>
  new Promise((r) => {
    const t = setTimeout(r, ms);
    t.unref?.();
  });

/**
 * LE VEILLEUR PARLE-T-IL ENCORE ? — mesuré, sur une connexion À PART.
 *
 * ⚠️ ON JUGE SUR « UNE RÉPONSE ARRIVE », PAS SUR `ok`. Le veilleur le dit lui-même à son
 * geste `ping` : *« un ping répond la PRÉSENCE, jamais la disponibilité »*. Exiger `ok: true`
 * ferait déclarer muet un veilleur qui parle mais n'a pas fini de charger son identité — la
 * confusion exacte qui avait déjà coûté deux écoutes et chaque message remis en double.
 *
 * ⚠️ ET C'EST BIEN UNE SECONDE CONNEXION. Mesuré sur le poste : `ping` et `etat` rendent en
 * 0 ms pendant que `vue` tourne depuis 71 s. Le socket sert plusieurs conversations à la fois ;
 * sonder sur le même flux ne mesurerait que notre propre attente.
 */
async function veilleurParleEncore(cheminSocket, borneSonde, signal) {
  try {
    await demander({ geste: 'ping' }, cheminSocket, { delai: borneSonde, signal });
    return true;
  } catch (err) {
    // ⚠️ UN PING QU'ON A COUPÉ SOI-MÊME NE DIT RIEN DU VEILLEUR. Il n'a pas échoué, on l'a
    // interrompu parce que la réponse était arrivée : le lire comme un silence ferait refuser
    // un geste déjà servi.
    if (err?.code === 'ABANDONNEE') return true;
    return false;
  }
}

/**
 * LE REFUS QUI DIT CE QU'IL A MESURÉ — et les deux cas ne portent pas le même mot.
 *
 * 🔴 LE MESSAGE D'AVANT ÉTAIT FAUX AU SENS PROPRE. « Le veilleur n'a pas répondu en 30s » a
 * été rendu au dirigeant par un veilleur qui répondait en 0 ms à tout le reste, et qui a rendu
 * sa vue complète en 67 s. Le refus attribuait au veilleur un silence qu'il n'avait pas, et
 * envoyait chercher la panne là où elle n'était pas.
 */
export function refusSansReponse({ geste, ms, vivant }) {
  // ⚠️ AU DIXIÈME, PAS À LA SECONDE. Une attente de 0,3 s arrondie à la seconde s'affiche « 0s »
  // — un refus qui dit avoir attendu zéro seconde se lit comme un bogue, pas comme une mesure.
  const secondes = Math.round(ms / 100) / 10;
  if (vivant) {
    return new Error(
      `Le veilleur EST VIVANT — il répond au ping — mais il n'a pas rendu « ${geste} » en ${secondes}s.\n` +
        `  Ce geste est donc plus long que sa borne, ce n'est pas une panne de veilleur.\n` +
        `  Vois ce qu'il fait : tail -20 ${CHEMIN_JOURNAL}`
    );
  }
  return new Error(
    `Le veilleur NE RÉPOND PLUS — « ${geste} » attendu ${secondes}s, et le ping reste sans réponse.\n` +
      `  Sa bouche est fermée : ce n'est pas un geste lent, c'est un veilleur en panne.\n` +
      `  Regarde pourquoi : tail -20 ${CHEMIN_JOURNAL}`
  );
}

/**
 * Un aller-retour BORNÉ PAR LE GESTE, sous surveillance de la vie du veilleur.
 *
 * Deux issues, et elles sont mesurées, jamais déduites :
 *   — le veilleur cesse de répondre au ping → on refuse TOUT DE SUITE, sans attendre la borne
 *     (c'est ce qui rend une borne haute admissible : elle n'est atteinte que par un veilleur
 *      vivant et occupé) ;
 *   — la borne du geste tombe → on établit l'état du veilleur, puis on le DIT.
 */
async function demanderSousSurveillance(requete, cheminSocket, { borne, sonde }) {
  const geste = requete?.geste ?? 'ce geste';
  const t0 = Date.now();
  let fini = false;
  const abandon = new AbortController();
  // 🔴 LE PING DE LA SONDE A SON PROPRE ABANDON, ET IL LE FALLAIT — relevé en passe portail, et
  // le rejet était juste. Sans lui, ce lot rejouait EXACTEMENT le défaut qu'il corrige, par une
  // porte laissée ouverte : la vue s'affiche, puis la commande reste debout le temps qu'un ping
  // parti juste avant veuille bien se régler. Mesuré par la passe — réponse à 122 ms, mort du
  // processus à 1 646 ms. Ce n'est pas le minuteur du ping qui retient, c'est sa CONNEXION :
  // un `unref` n'y aurait rien changé, il faut la couper.
  const abandonDeLaSonde = new AbortController();
  const reponse = demander(requete, cheminSocket, { delai: borne, signal: abandon.signal }).finally(() => {
    fini = true;
    abandonDeLaSonde.abort();
  });

  // ⚠️ UNE SENTINELLE QUI NE GAGNE JAMAIS SI LE VEILLEUR PARLE. Elle ne fait que retirer à une
  // borne haute son pouvoir de faire attendre pour rien.
  const sentinelle = (async () => {
    for (;;) {
      await sommeilQuiNeRetientRien(sonde.intervalle);
      if (fini) return null;
      // ⚠️ AUCUNE GARDE DE BORNE ICI, ET C'EST MESURÉ. Il y en avait une ; la campagne l'a
      // trouvée SURVIVANTE, et pour la même raison que sa voisine : quand la borne du geste
      // tombe, `demander` rejette et `fini` bascule — la ligne au-dessus suffit. La fenêtre
      // qu'elle prétendait couvrir dure le temps d'un `.finally`, et rien ne l'observe.
      if (await veilleurParleEncore(cheminSocket, sonde.borne, abandonDeLaSonde.signal)) continue;
      // ⚠️ PAS DE SECONDE GARDE `fini` ICI, ET C'EST DÉLIBÉRÉ. Il y en avait une : la campagne
      // de mutation l'a trouvée SURVIVANTE, et en cherchant son banc on a compris pourquoi —
      // elle est INOBSERVABLE. Si la réponse est arrivée, `Promise.race` a déjà été gagnée par
      // elle ; ce que la sentinelle rend ensuite ne parvient à personne. Une garde qu'aucun
      // banc ne peut faire rougir n'est pas une garde, c'est une consolation.
      //
      // On coupe l'attente AVANT de rendre le refus : sinon la requête et son minuteur
      // survivent jusqu'à la borne du geste, longtemps après qu'on a répondu.
      abandon.abort();
      return refusSansReponse({ geste, ms: Date.now() - t0, vivant: false });
    }
  })();

  // 🔴 LA SEULE GARDE QUE PERSONNE NE PEUT DÉSARMER EN ÉDITANT UN BANC — elle vit DANS LE
  // PRODUIT, et elle parle à l'humain qui tape la commande.
  //
  // Mesuré en passe de fond : trois éditions coordonnées — la borne de production, son épingle
  // dans le banc, et le coût mesuré cité à côté — ramènent la borne à 68 s, **sous le coût réel
  // du geste**, avec 30 essais sur 30 VERTS. Chacune se lit comme de l'entretien. Le lot avait
  // écrit « la baisser rougit, par quelque chemin que ce soit » : c'était faux.
  //
  // ⚠️ ET AUCUN BANC NE PEUT FERMER ÇA. Une suite compare le code à des constantes qu'elle porte
  // elle-même ; qui édite les deux ensemble la désarme en silence, et un seuil de plus se
  // désarme d'un cran plus haut. **Alors on sort de la suite.** Le geste qui approche sa propre
  // borne le DIT, à l'écran, à celui qui l'a tapé — et ce signal-là ne dépend d'aucun essai :
  // il se déclenche sur le poste, sur le vrai parc, le jour où la marge fond pour de bon.
  const marge = (ms) => {
    if (ms <= borne / 2) return;
    process.stderr.write(
      `⚠️  « ${geste} » a mis ${Math.round(ms / 100) / 10}s, soit plus de la moitié de sa borne ` +
        `(${borne / 1000}s). La marge fond : quand elle passera, ce geste sera REFUSÉ alors qu'il ` +
        `travaillait. Relève la borne dans ligne-directe/src/client.js (BORNES_PAR_GESTE), ` +
        `ou fais coûter moins cher à ce geste.\n`
    );
  };

  const issue = await Promise.race([
    reponse.then((r) => ({ r }), (err) => ({ err })),
    sentinelle.then((refus) => (refus ? { err: refus } : new Promise(() => {}))),
  ]);
  if ('r' in issue) {
    marge(Date.now() - t0);
    return issue.r;
  }

  // ⚠️ ON NE REQUALIFIE QUE NOTRE PROPRE BORNE. Une connexion refusée, un socket disparu, une
  // réponse illisible : ce sont des faits distincts, déjà nommés par qui les a vus. Les
  // repeindre en « le veilleur ne répond plus » ferait chercher la panne à côté — le défaut
  // même que ce lot corrige.
  const err = issue.err;
  const notreBorne = err instanceof Error && /n'a pas répondu en/.test(err.message);
  if (!notreBorne) throw err;
  // ⚠️ UNE SONDE NEUVE ICI, JAMAIS `abandonDeLaSonde` — il vient d'être déclenché par le
  // `.finally` ci-dessus. Le réutiliser rendrait `ABANDONNEE` tout de suite, donc « vivant »
  // sans avoir mesuré quoi que ce soit : le défaut exact que ce refus existe pour fermer.
  const vivant = await veilleurParleEncore(cheminSocket, sonde.borne, new AbortController().signal);
  throw refusSansReponse({ geste, ms: Date.now() - t0, vivant });
}

export async function parler(
  requete,
  {
    reveiller = true,
    cheminSocket = CHEMIN_SOCKET,
    bornesParGeste = BORNES_PAR_GESTE,
    borneParDefaut = BORNE_PAR_DEFAUT,
    sonde = SONDE_PAR_DEFAUT,
    // ⚠️ INJECTÉ PAR PARAMÈTRE, comme partout ailleurs — c'est ce qui rend le réveil paresseux
    // observable sans qu'un banc ait à faire naître un vrai veilleur. Un veilleur né sous essais
    // capterait les messages de production : la cloison du dépôt le refuse, et elle a raison.
    naitre = reveillerVeilleur,
  } = {}
) {
  // 🔴 LA BORNE VIENT DU GESTE, ET C'EST TOUT LE CORRECTIF. Une borne unique servait les
  // quatre gestes ; `vue` en coûte 67 et se faisait couper à 30. Elle se résout ICI, à
  // l'entrée que la commande emprunte — pas dans `demander`, qui reste l'aller-retour nu dont
  // `passerLaMain` a besoin avec ses bornes courtes à lui.
  const borne = borneDuGeste(requete?.geste, { bornesParGeste, borneParDefaut });
  const surveille = (chemin) => demanderSousSurveillance(requete, chemin, { borne, sonde });
  try {
    if (!existsSync(cheminSocket)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return await surveille(cheminSocket);
  } catch (err) {
    const absent = err.code === 'ENOENT' || err.code === 'ECONNREFUSED';
    if (!absent || !reveiller) throw err;
  }
  naitre();
  for (let essai = 0; essai < 40; essai += 1) {
    await dodo(250);
    try {
      if (existsSync(cheminSocket)) return await surveille(cheminSocket);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ECONNREFUSED') throw err;
    }
  }
  throw new Error(
    `Le veilleur n'a pas démarré en 10s. Regarde pourquoi : tail -20 ${CHEMIN_JOURNAL}\n` +
      `(cause la plus fréquente : un jeton absent ou vide au trousseau)`
  );
}

// veilleur.js — le pont, et la seule pièce qui vit en permanence.
//
// Il tient trois choses à la fois :
//   1. une connexion d'écoute vers Slack, qu'il rétablit seul quand elle tombe ;
//   2. un registre sur disque qui apparie chantier ↔ canal ↔ pane, et qui SURVIT aux
//      agents comme au redémarrage du poste ;
//   3. un point d'entrée LOCAL — un socket UNIX en 0600, pas un port réseau — par lequel
//      les agents du poste lui parlent.
//
// Un seul veilleur pour tous les agents, et c'est le choix structurant : un veilleur par
// agent multiplierait les connexions, laisserait des processus orphelins à chaque agent
// mal terminé, et se heurterait au plafond de connexions par application. Surtout, le
// veilleur unique SURVIT À SES AGENTS — c'est ce qui lui permet de répondre « ce chantier
// est clos » plutôt que d'avaler un message dans le vide.

import { createServer } from 'node:net';
import { existsSync, unlinkSync, chmodSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { lireJetons } from './trousseau.js';
import { enEssais, transportRemplace, refuser } from './cloison.js';
import * as slack from './slack.js';
import * as herdr from './herdr.js';
import { nomDeCanal, visageDe, libelleDeCanal } from './nommage.js';
import { roleDuLieu } from './lieu-agent.js';
import { role as roleDe, rolesConnus, libellePluriel, RoleInconnu } from './roles.js';
import { cadrerPourAgent, cadrerConsigneCommune, cadrerPourPair } from './cadre.js';
import { etrangersParmi, nouveauxVenus, photographier, NOUS } from './cloisonnement.js';
import { reponse } from './langage.js';
import { TAILLE_MAX, typeDePiece, pieceACompleter, deposer, gabarit } from './pieces.js';
import {
  CHEMIN_SOCKET,
  CHEMIN_JOURNAL,
  chargerRegistre,
  sauverRegistre,
  lignesOuvertes,
  ligneParCanal,
  ligneOuverteParCle,
  nomsPris,
  cleDeLigne,
  inscrireLigne,
  clore,
  natureDe,
  jetabiliteDe,
  libelleDeLigne,
  canauxCommuns,
  canalCommunDuRole,
  canalCommunSansRole,
  communPourCanal,
  estCanalCommun,
  dirigeantDuPoste,
  designerDirigeant,
  NATURES,
  NATURE_PAR_DEFAUT,
  panesDeLigne,
} from './registre.js';

// États d'une connexion, tels que les définit la norme WebSocket. On ne lit PAS
// `WebSocket.OPEN` : le global n'existe qu'à partir de Node 22, et une simple lecture de
// constante y suffirait à faire tomber le veilleur sur un poste plus ancien — avec une
// erreur qui ne parle de rien. Les valeurs, elles, sont figées par la norme.
const CONNEXION_EN_COURS = 0;

/**
 * La connexion d'écoute telle qu'elle est à l'ouverture du module — référence de la cloison
 * d'essais. C'est LA connexion qui a fait des dégâts : deux veilleurs orphelins nés sous
 * tests l'ont tenue pendant des heures, et Slack, qui répartit ses événements entre les
 * connexions actives, en a jeté les deux tiers dans un veilleur sans registre.
 */
const ECOUTE_NATIVE = globalThis.WebSocket;
const CONNEXION_OUVERTE = 1;

/**
 * Les sous-types de message qui SONT une parole adressée à la ligne.
 *
 * Liste blanche, et c'est le sens de la garde : tout le reste — entrée et sortie de canal,
 * modification, suppression, changement de sujet, message de robot — n'est pas quelqu'un qui
 * s'adresse à l'agent, et n'attend donc ni remise ni réponse.
 *
 *   - `file_share`      : un message accompagné d'un fichier. LE cas du client.
 *   - `me_message`      : la forme `/me`, qui reste une phrase écrite par quelqu'un.
 *   - `thread_broadcast`: une réponse en fil, renvoyée dans le canal — écrite, adressée, lue.
 */
const SOUS_TYPES_PAROLE = new Set(['file_share', 'me_message', 'thread_broadcast']);

const RECONNEXION_MIN = 1_000;
const RECONNEXION_MAX = 60_000;
/** Cadence du chien de garde : à quelle fréquence on vérifie qu'on écoute VRAIMENT. */
const SURVEILLANCE = 30_000;

function maintenant() {
  return new Date().toISOString();
}

export function journaliser(message, chemin = CHEMIN_JOURNAL) {
  const ligne = `${maintenant()} ${message}\n`;
  try {
    mkdirSync(dirname(chemin), { recursive: true });
    appendFileSync(chemin, ligne);
  } catch {
    /* le journal ne doit jamais faire tomber le veilleur */
  }
  if (process.env.LIGNE_DIRECTE_VERBEUX) process.stderr.write(ligne);
}

/**
 * UNE LIGNE INTERNE SANS PERSONNE À INVITER N'EST PAS UNE LIGNE (T-20260814-0136).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * L'aide de la commande promettait déjà ce refus — « Sans dirigeant désigné sur le poste, la
 * ligne est REFUSÉE : une ligne interne sans invité refuse la parole à tous » — et le code ne
 * le tenait que pour `--au-dirigeant`. Ouvrir sans aucun drapeau créait un canal public dont la
 * liste d'autorisés était vide : `autorise()` y refuse alors TOUT LE MONDE, y compris celui à
 * qui la ligne est destinée. C'est le premier geste mesuré de la panne du 2026-08-14, et il
 * rendait `ok`.
 *
 * ⚠️ LA GARDE PORTE SUR L'ÉTAT, PAS SUR LES DRAPEAUX. Elle regarde la liste d'autorisés à
 * laquelle le geste aboutit, quel que soit le chemin qui l'a remplie — `--au-dirigeant`,
 * `--inviter`, ou ce qu'une reprise trouve déjà inscrit. Une garde écrite sur les drapeaux
 * aurait laissé passer le troisième chemin, et il n'y a pas de raison qu'un quatrième
 * n'apparaisse pas.
 *
 * ⚠️ ET ELLE NE TOUCHE PAS À LA LIGNE CLIENTE, dont la liste démarre vide par construction :
 * les gens du client sont invités à la main dans leur canal privé, et c'est leur appartenance
 * qui les autorise. Étendre le refus à elle aurait fermé la porte du client pour réparer celle
 * du dirigeant.
 */
export function refusLigneMuette(nature, autorises, chantier) {
  if (nature === 'client' || autorises.length) return null;
  return {
    ok: false,
    erreur:
      `la ligne de « ${chantier} » n’est pas ouverte : une ligne interne autorise par LISTE ` +
      'd’invités, et celle-ci serait vide — le canal existerait, il aurait l’air d’une ligne, ' +
      'et il refuserait la parole à tout le monde, à commencer par celui à qui elle est ' +
      'destinée. Désigne le dirigeant une fois (« ligne-directe dirigeant <courriel> ») puis ' +
      'rouvre avec --au-dirigeant, ou nomme un invité avec --inviter <courriel>.',
  };
}

export class Veilleur {
  constructor({ jetons, identite, cheminSocket = CHEMIN_SOCKET, slack: slackInjecte, herdr: herdrInjecte, surArret } = {}) {
    this.jetons = jetons;
    this.identite = identite;
    this.cheminSocket = cheminSocket;
    // Slack et herdr sont injectables : les cas de rupture (ligne close, agent disparu,
    // veilleur qui reprend du service) ne se prouvent pas autrement — on ne va pas tuer un
    // vrai agent et attendre qu'un dirigeant écrive pour vérifier qu'on lui répond.
    this.slack = slackInjecte || slack;
    this.herdr = herdrInjecte || herdr;
    this.registre = chargerRegistre();
    // La nature des canaux où l'on écrit sans y avoir de ligne — demandée une fois, retenue.
    // Sans ce cache, un canal d'équipe actif coûterait un appel plafonné par message.
    this.canauxEtrangers = new Map();
    this.ws = null;
    this.serveur = null;
    this.chienDeGarde = null;
    // Ce que le veilleur fait une fois arrêté — fourni par le point d'entrée, jamais
    // décidé ici : une bibliothèque ne met pas fin au processus de son appelant.
    this.surArret = surArret || null;
    this.attente = RECONNEXION_MIN;
    this.arrete = false;
  }

  /**
   * Y a-t-il DÉJÀ un veilleur au bout du socket ?
   *
   * Question vitale depuis qu'il y a deux façons de naître : le démarrage paresseux (un
   * agent qui ouvre sa ligne) et le service du poste (au démarrage de la machine). Deux
   * veilleurs, c'est deux connexions d'écoute — donc CHAQUE MESSAGE DU DIRIGEANT REMIS EN
   * DOUBLE dans le pane de l'agent. Le second doit renoncer, pas s'installer par-dessus.
   *
   * On ne se fie pas à la présence du fichier : un socket résiduel d'un veilleur tué
   * survit à son processus. Seule une réponse fait foi.
   */
  static async dejaVivant(cheminSocket = CHEMIN_SOCKET) {
    if (!existsSync(cheminSocket)) return false;
    try {
      const { demander } = await import('./client.js');
      // Sondage COURT : c'est un test de présence, pas un appel de travail. Avec le délai
      // ordinaire, un socket muet ferait attendre trente secondes au démarrage du poste —
      // pile au moment où l'on veut que la ligne reprenne vite.
      const r = await demander({ geste: 'ping' }, cheminSocket, { delai: 2000 });
      return r?.ok === true;
    } catch {
      return false; // socket orphelin : la place est libre
    }
  }

  static async demarrer(options = {}) {
    // La place D'ABORD, le reste ensuite. Lire le trousseau puis interroger Slack prend
    // quelques centaines de millisecondes : assez pour qu'un second veilleur naisse en
    // croyant la place libre. On prend donc le socket avant toute opération lente, et on
    // le rend si la suite échoue.
    const v = new Veilleur(options);
    await v.ecouterLocal();
    try {
      // APRÈS la prise du socket, et l'ordre compte : un veilleur qui trouve la place déjà
      // occupée doit se retirer en disant « un autre tourne », pas se plaindre de sa version
      // de Node. Le verrou d'unicité prime sur tout le reste.
      //
      // Le veilleur tient sa connexion d'écoute avec le WebSocket natif. Sans lui rien ne
      // fonctionne — autant le dire en une phrase plutôt que de laisser sortir une erreur
      // de référence au premier message.
      if (typeof WebSocket === 'undefined') {
        throw new Error(
          `Node ${process.versions.node} ne fournit pas WebSocket — la ligne directe demande Node 22 ou plus récent.`
        );
      }
      v.jetons = await lireJetons();
      v.identite = await slack.identite(v.jetons.robot);
    } catch (err) {
      await v.arreter();
      throw err;
    }
    const { identite } = v;
    v.connecterSlack();
    v.surveiller();
    await v.reconcilier();
    journaliser(`veilleur démarré — espace ${identite.equipe}, ${lignesOuvertes(v.registre).length} ligne(s) ouverte(s)`);
    return v;
  }

  // ————————————————————————————————————————————————————————————— point d'entrée local

  /**
   * Socket UNIX en 0600 : seul le compte du poste peut s'y connecter. Aucun port, donc
   * rien à joindre depuis le réseau — « n'accepte d'instructions que du poste » cesse
   * d'être une intention de design pour devenir une propriété vérifiable.
   */
  ecouterLocal({ reprendrePlaceOrpheline = true } = {}) {
    return new Promise((resolve, reject) => {
      mkdirSync(dirname(this.cheminSocket), { recursive: true });
      this.serveur = createServer((flux) => {
        let tampon = '';
        flux.on('data', async (morceau) => {
          tampon += morceau.toString('utf8');
          let coupure = tampon.indexOf('\n');
          while (coupure !== -1) {
            const ligne = tampon.slice(0, coupure);
            tampon = tampon.slice(coupure + 1);
            if (ligne.trim()) {
              let reponse;
              try {
                reponse = await this.traiterGeste(JSON.parse(ligne));
              } catch (err) {
                reponse = { ok: false, erreur: err.message, nom: err.name };
              }
              flux.write(`${JSON.stringify(reponse)}\n`);
            }
            coupure = tampon.indexOf('\n');
          }
        });
        flux.on('error', () => {});
      });
      // C'EST ICI QUE SE JOUE L'UNICITÉ, et elle doit se jouer AVANT tout appel lent.
      //
      // Mesuré : deux veilleurs lancés à 200 ms d'écart (le service du poste et un
      // démarrage paresseux) sondaient tous deux un socket encore absent, parce que le
      // premier était occupé à lire le trousseau puis à interroger Slack. Résultat : deux
      // connexions d'écoute, et CHAQUE MESSAGE DU DIRIGEANT REMIS EN DOUBLE.
      //
      // La création du socket, elle, est atomique : `EADDRINUSE` est un verrou fiable, là
      // où un sondage préalable ne l'est pas.
      this.serveur.on('error', async (err) => {
        if (err.code !== 'EADDRINUSE') return reject(err);
        if (!reprendrePlaceOrpheline) return reject(err);
        // Place occupée : quelqu'un répond-il vraiment, ou est-ce un socket d'un veilleur
        // mort ? Seule une réponse fait foi.
        if (await Veilleur.dejaVivant(this.cheminSocket)) {
          const occupe = new Error('Un veilleur tourne déjà sur ce poste — celui-ci se retire.');
          occupe.code = 'DEJA_VIVANT';
          return reject(occupe);
        }
        try {
          unlinkSync(this.cheminSocket);
        } catch {
          /* disparu entre-temps : tant mieux */
        }
        // Une seule reprise : si la place se réoccupe dans l'intervalle, c'est qu'un vrai
        // veilleur est né — on lui laisse.
        this.ecouterLocal({ reprendrePlaceOrpheline: false }).then(resolve, reject);
      });
      this.serveur.listen(this.cheminSocket, () => {
        try {
          chmodSync(this.cheminSocket, 0o600);
        } catch {
          /* rare, mais on préfère un veilleur qui vit à un veilleur qui refuse de naître */
        }
        resolve();
      });
    });
  }

  async traiterGeste(requete) {
    const { geste } = requete;
    switch (geste) {
      case 'ouvrir':
        return this.ouvrir(requete);
      case 'dire':
        return this.dire(requete);
      case 'fermer':
        return this.fermer(requete);
      case 'renommer':
        return this.renommer(requete);
      case 'commun':
        return this.designerCommun(requete);
      case 'dirigeant':
        return this.designerDirigeantDuPoste(requete);
      case 'etat':
        return this.etat();
      case 'ceder':
        // Le veilleur en place se retire pour laisser la place à une version plus récente.
        //
        // Sans ce geste, le verrou d'unicité — qui protège des remises en double — INTERDIT
        // toute mise à jour : le veilleur neuf trouve la place occupée et se retire
        // poliment, donc les correctifs publiés n'arrivent jamais. Tout a l'air installé,
        // et rien ne l'est. Il faut une porte de sortie volontaire.
        // On NE SORT PAS du processus ici. C'est au point d'entrée de décider comment
        // mourir — un `process.exit` enfoui dans une méthode tue aussi le lanceur de tests,
        // et fait passer pour verts des tests qui n'ont jamais été exécutés (vécu : seize
        // tests rapportés, le dix-septième jamais lancé, code de sortie 0).
        setTimeout(() => {
          this.arreter().then(() => this.surArret?.());
        }, 50).unref?.();
        return { ok: true, cede: true };
      case 'ping':
        // BLOQUANT relevé en revue : ce ping répondait `ok:false` tant que l'identité
        // n'était pas chargée — plusieurs centaines de millisecondes, le temps de lire le
        // trousseau et d'interroger Slack. Un second veilleur y lisait « place libre »,
        // retirait le socket et s'installait : DEUX écoutes, chaque message remis en
        // double. Un ping répond la PRÉSENCE, jamais la disponibilité.
        return { ok: true, veilleur: 'vivant', espace: this.identite?.equipe ?? null, pret: Boolean(this.identite) };
      default:
        return { ok: false, erreur: `geste inconnu : ${geste}` };
    }
  }

  // ————————————————————————————————————————————————————————————————— les quatre gestes

  async ouvrir({
    chantier,
    pane,
    worktree,
    sujet,
    titre,
    invites = [],
    invites_courriels: invitesCourriels = [],
    nature,
    jetable = false,
    au_dirigeant: auDirigeant = false,
    au_gestionnaire: auGestionnaire = null,
    herdr_socket: herdrSocket = null,
  }) {
    if (!chantier) return { ok: false, erreur: 'chantier requis' };
    if (!pane) return { ok: false, erreur: 'pane requis' };

    // ═══ « AVEC LE DIRIGEANT » — l'agent le demande, il n'apprend jamais son adresse.
    //
    // Une ligne INTERNE autorise par LISTE : sans invité, `autorise()` refuse tout le monde, y
    // compris celui à qui la ligne est destinée. Elle existerait, elle aurait l'air ouverte, et
    // chaque message du dirigeant repartirait « tu n'es pas autorisé » — la panne la plus
    // silencieuse du lot, puisque c'est justement la ligne dont personne ne vérifie qu'elle
    // marche tant qu'on n'en a pas besoin.
    //
    // ON REFUSE PLUTÔT QUE D'OUVRIR SANS PERSONNE. Le canal, lui, serait déjà créé : Slack ne
    // le reprend pas, et un canal muet resterait dans la barre latérale du dirigeant comme une
    // ligne qui existe. Le refus tombe donc AVANT toute création — ici, avant même de lire un
    // titre.
    // Ce que les gardes ont à dire sans l'empêcher — rendu à la fin, avec la réponse.
    const avertissementsAvant = [];

    // LES COURRIELS SE RÉSOLVENT ICI, PAS DANS LA COMMANDE (T-20260814-0136).
    //
    // `--inviter <courriel>` était résolu côté commande, qui lisait le trousseau du poste et
    // appelait Slack elle-même. Deux conséquences, et la seconde est celle qui a mordu :
    //
    //   • un courriel qui ne désignait personne produisait un AVERTISSEMENT sur la sortie
    //     d'erreur, code 0, et la ligne s'ouvrait sans lui — muette, comme ci-dessous ;
    //   • ce chemin est INÉPROUVABLE : la cloison d'essais refuse la lecture du trousseau, donc
    //     aucun essai n'a jamais pu l'exercer. Un essai qui l'appelait passait au vert parce que
    //     la commande tombait, pas parce qu'elle refusait.
    //
    // Le veilleur, lui, a déjà le jeton et parle déjà à Slack. La résolution lui revient.
    let invitesEffectifs = invites;
    for (const courriel of invitesCourriels) {
      const id = await this.slack.trouverMembre(this.jetons.robot, String(courriel).trim());
      if (!id) {
        return {
          ok: false,
          erreur:
            `aucun membre de l’espace ne porte « ${courriel} » — la ligne n’est pas ouverte. ` +
            'Ouvrir sans lui donnerait une ligne où il ne peut pas parler, et rien ne le dirait.',
        };
      }
      invitesEffectifs = [...new Set([...invitesEffectifs, id])];
    }
    if (auDirigeant) {
      const d = dirigeantDuPoste(this.registre);
      if (!d?.id) {
        return {
          ok: false,
          erreur:
            'aucun dirigeant n’est désigné sur ce poste — la ligne n’est pas ouverte. Une ligne ' +
            'interne autorise par liste d’invités : ouverte sans lui, elle refuserait sa parole. ' +
            'Désigne-le une fois (« ligne-directe dirigeant <courriel> »), puis relance.',
        };
      }
      invitesEffectifs = [...new Set([...invites, d.id])];
    }

    // Une nature mal orthographiée NE SE RABAT PAS sur le défaut. `--nature cliet` créerait
    // un canal PUBLIC pour un client — le portefeuille client exposé par une faute de
    // frappe, et rien pour le dire. Refuser coûte une seconde, l'autre issue est définitive.
    if (nature != null && nature !== '' && !NATURES.includes(nature)) {
      return { ok: false, erreur: `nature inconnue : « ${nature} » — les natures admises sont ${NATURES.join(', ')}` };
    }
    const natureVoulue = nature || NATURE_PAR_DEFAUT;

    // ═══ LE PAIR QUI PARTAGE CETTE LIGNE — résolu AVANT toute création, comme le dirigeant.
    //
    // Un `--au-gestionnaire` qui ne désigne personne donnerait une ligne qui A L'AIR partagée et
    // ne l'est pas : l'orchestrateur rendrait compte dans le vide, le gestionnaire attendrait, et
    // rien ne le dirait. C'est le mode de panne silencieux que tout ce dispositif combat. Le
    // refus tombe donc ici — avant le canal, que Slack ne reprend pas.
    let pair = null;
    if (auGestionnaire != null && String(auGestionnaire).trim()) {
      const r = await this.resoudrePair(String(auGestionnaire).trim(), natureVoulue, pane);
      if (!r.ok) return r;
      pair = r.pair;
    }

    const deja = ligneOuverteParCle(this.registre, chantier, worktree);
    if (deja) {
      // ⚠️ LA REPRISE EST LA BRANCHE QUI A MENTI CINQ FOIS. Ce qui suit — la garde de ligne
      // muette et la preuve par les membres — vaut ICI AUTANT QU'À LA CRÉATION, et c'est
      // exactement ce qui manquait : la création invitait, la reprise se contentait d'écrire
      // la liste au registre et rendait `ok`. « Une porte sur deux », dixième occurrence.
      //
      // On garde sur l'UNION des autorisés déjà inscrits et des nouveaux : reprendre une ligne
      // sans redonner `--au-dirigeant` est le cas nominal, et ce n'est pas parce que le geste
      // n'apporte aucun invité que la ligne n'en a pas.
      // Une ligne ne CHANGE PAS de nature en cours de route : le canal existe déjà dans
      // Slack, et Slack ne bascule pas un canal public en privé parce qu'on le rouvre
      // autrement. Accepter ici inscrirait « client » au registre sur un canal resté
      // visible de tout l'espace — un mensonge du registre sur la seule chose qui compte.
      if (natureDe(deja) !== natureVoulue) {
        return {
          ok: false,
          erreur:
            `la ligne de « ${deja.chantier} » est déjà ouverte en nature ${natureDe(deja)} ` +
            `(#${deja.canal_nom}) — un canal ne change pas de nature ; referme-la d'abord`,
        };
      }
      const autorisesFinaux = [...new Set([...(deja.autorises || []), ...invitesEffectifs])];
      const muette = refusLigneMuette(natureVoulue, autorisesFinaux, deja.chantier);
      if (muette) return muette;
      const etrangerDeja = await this.refusEtranger(deja.canal_id, deja.canal_nom, natureVoulue);
      if (etrangerDeja?.avertissement) avertissementsAvant.push(etrangerDeja.avertissement);
      else if (etrangerDeja) {
        return { ok: false, cree: false, refus: etrangerDeja, erreur: etrangerDeja.message };
      }

      const entres = await this.assurerPresence(deja.canal_id, deja.canal_nom, autorisesFinaux, natureVoulue);
      if (!entres.ok) return entres;

      // La photo se refait à la reprise : ce qui est là maintenant devient la référence.
      const vusDeja = await this.membresPhotographies(deja.canal_id);
      if (vusDeja) deja.membres_vus = vusDeja;

      // Rouvrir une ligne déjà ouverte n'est pas une erreur : un agent relancé dans le
      // même worktree retrouve son canal. On rafraîchit seulement son pane, qui a changé.
      deja.pane = pane;
      if (herdrSocket) deja.herdr_socket = herdrSocket;
      deja.autorises = autorisesFinaux;
      // LE PAIR S'ATTACHE AUSSI À LA REPRISE, et c'est le cas nominal, pas un extra : un
      // orchestrateur EXISTE DÉJÀ quand un gestionnaire ouvre la demande qui le concerne
      // (arbitrage du dirigeant, 2026-08-14 — « le gestionnaire ne lance pas l'orchestrateur, il
      // lui parle »). Sa ligne est ouverte depuis longtemps ; sans cette branche, il n'aurait
      // aucun moyen d'y accueillir son pair sans la refermer d'abord.
      if (pair) deja.pair = pair;
      sauverRegistre(this.registre);
      return {
        ok: true,
        reprise: true,
        ...(avertissementsAvant.length ? { avertissements: avertissementsAvant } : {}),
        canal: deja.canal_nom,
        canal_id: deja.canal_id,
        visage: deja.visage,
        nature: natureDe(deja),
        ...(deja.pair ? { pair: { role: deja.pair.role, nom: deja.pair.nom, pane: deja.pair.pane } } : {}),
      };
    }

    // SUR UNE LIGNE CLIENTE, LE TITRE N'EST PLUS UN CONFORT. Sans lui, `libelleDeCanal`
    // retombe sur le code du chantier : le canal s'appelle `#d-20260805-0005`, et le client
    // le voit dans sa barre latérale à longueur de journée. Le repli qui rend service en
    // interne est exactement ce qu'on refuse ici — et il est irréparable, Slack ne renomme
    // pas un canal sans que tout le monde le remarque. On refuse, plutôt.
    const muette = refusLigneMuette(natureVoulue, invitesEffectifs, chantier);
    if (muette) return muette;

    const titreUtile = String(titre ?? '').trim();
    if (natureVoulue === 'client' && !titreUtile) {
      return {
        ok: false,
        erreur:
          'une ligne cliente exige --titre : sans lui le canal porterait le code du chantier, ' +
          'et c’est la première chose que le client verrait de nous',
      };
    }

    // `saufCle` : sa propre ligne close ne lui fait pas concurrence — sans quoi refermer puis
    // rouvrir le même chantier repartirait sur un « -2 » (T-20260814-0085, relevé en revue).
    const pris = nomsPris(this.registre, { saufCle: cleDeLigne(chantier, worktree) });
    // Le NOM vient du titre. En interne, le CODE part dans le sujet du canal — il reste donc
    // lisible d'un coup d'œil sans encombrer le nom.
    const nom = nomDeCanal(libelleDeCanal(chantier, titre), (n) => pris.has(n));
    const visage = visageDe(chantier);

    // LA CONFIDENTIALITÉ SE JOUE ICI : Slack fixe la nature d'un canal à sa création et ne
    // la change plus jamais. Un canal client né public le reste.
    const privePrevu = natureVoulue === 'client';
    let canal;
    try {
      canal = await this.slack.creerCanal(this.jetons.robot, nom, privePrevu);
    } catch (err) {
      // Le nom vient du TITRE du chantier. Une ligne client titrée du nom de son client
      // tombe très naturellement sur un canal public homonyme déjà présent dans l'espace —
      // et le reprendre exposerait ce qu'on cherchait précisément à cacher.
      // On relaie sur le FAIT — « réessayer ne changera rien » —, jamais sur une liste de
      // noms d'erreurs. Une liste oublie la prochaine ; le fait, lui, voyage avec l'erreur.
      //
      // Et on relaie le message TEL QUEL. Le composer ici avait produit le pire conseil du
      // lot : « ou archive le canal #X », qui détruit sans retour un canal d'équipe pour
      // libérer un nom. Le conseil vit désormais avec la cause, en un seul endroit qu'on
      // peut garder.
      if (err.reessayable === false) {
        journaliser(`ouverture refusée — ${chantier} : ${err.message}`);
        return { ok: false, erreur: err.message };
      }
      throw err;
    }

    // UNE LIGNE NE S'INSTALLE PAS SUR LE CANAL COMMUN, et ce n'est pas une hypothèse d'école :
    // le nom d'un canal vient du TITRE, la normalisation aplatit accents, casse et ponctuation,
    // et `creerCanal` REPREND un canal homonyme existant au lieu d'échouer. Un chantier titré
    // « Annonces » tomberait donc naturellement sur le canal d'annonces — et à partir de là,
    // tout ce que cet agent dit part dans le pane de tous les autres, sous l'autorité du
    // dirigeant. On refuse avant d'inscrire quoi que ce soit : sujet, invitations, registre.
    if (estCanalCommun(this.registre, canal.id)) {
      journaliser(`ouverture refusée — ${chantier} : #${canal.nom} est le canal commun`);
      return {
        ok: false,
        erreur:
          `#${canal.nom} est le canal commun, celui qui porte les consignes du dirigeant à TOUS les agents : ` +
          `aucune ligne ne s'y ouvre. Donne un autre titre à ce chantier.`,
      };
    }

    // DEUXIÈME VERROU, et il n'est pas redondant : le premier protège la REPRISE d'un canal
    // homonyme, celui-ci protège la CRÉATION. Slack peut rendre un canal public alors qu'on
    // en demandait un privé — un droit manquant, une politique d'espace de travail — et il
    // le fait sans se plaindre. Inscrire « client » au registre sur un canal dont on n'a pas
    // vérifié la confidentialité, c'est signer une garantie qu'on n'a pas.
    if (Boolean(canal.prive) !== privePrevu) {
      journaliser(
        `ouverture refusée — ${chantier} : #${canal.nom} est ${canal.prive ? 'privé' : 'public'}, ` +
          `on attendait ${privePrevu ? 'privé' : 'public'}`
      );
      return {
        ok: false,
        erreur:
          `Slack a rendu un canal ${canal.prive ? 'privé' : 'public'} (#${canal.nom}) alors qu'une ligne ` +
          `${natureVoulue} en demande un ${privePrevu ? 'privé' : 'public'} — la ligne n'est pas ouverte. ` +
          `Vérifie les portées ${privePrevu ? 'groups:write / groups:read' : 'channels:manage'} de l'application.`,
      };
    }

    // Le sujet du canal est la deuxième surface par laquelle le code atteignait le client.
    // En interne il ouvre le sujet — c'est ce qui permet de retrouver le chantier depuis
    // Slack. Sur une ligne cliente, il n'y a rien à retrouver : le client sait de quoi il
    // parle, et un numéro de dossier en tête de son canal ne renseigne que nous. S'il n'y a
    // pas de sujet à dire, on n'en pose aucun plutôt que d'y mettre le code par défaut.
    const sujetComplet =
      natureVoulue === 'client' ? String(sujet ?? '').trim() : [chantier, sujet].filter(Boolean).join(' — ');
    if (sujetComplet) await this.slack.definirSujet(this.jetons.robot, canal.id, sujetComplet);

    // LA MÊME PREUVE QU'À LA REPRISE, PAR LE MÊME CHEMIN — et c'est le point. Deux appels
    // d'invitation écrits séparément, c'est deux portes, et l'histoire de ce dépôt dit qu'une
    // seule des deux finit gardée. Il n'y a donc qu'un seul endroit qui invite.
    //
    // ⚠️ SI L'INVITÉ N'EST PAS ENTRÉ, LA LIGNE N'EST PAS INSCRITE. Le canal, lui, existe déjà —
    // Slack ne le reprend pas. C'est le moindre mal, et il est réparable : `creerCanal` reprend
    // un canal du même nom, donc la relance retombera dessus et retentera l'invitation. Inscrire
    // la ligne malgré l'échec aurait laissé au registre une ligne d'apparence saine, et c'est
    // précisément l'illusion que tout ce lot démonte.
    // ═══ QUI EST DÉJÀ DANS CE CANAL (T-20260814-0142). Un canal REPRIS peut porter des gens :
    // c'est le cas que cette garde existe pour attraper. Elle tombe avant qu'on inscrive la
    // ligne et avant qu'on y écrive quoi que ce soit.
    const etranger = await this.refusEtranger(canal.id, canal.nom, natureVoulue);
    if (etranger?.avertissement) avertissementsAvant.push(etranger.avertissement);
    else if (etranger) return { ok: false, cree: false, refus: etranger, erreur: etranger.message };

    const entres = await this.assurerPresence(canal.id, canal.nom, invitesEffectifs, natureVoulue);
    if (!entres.ok) return entres;

    // LA PHOTO DES MEMBRES (T-20260813-0074) — les identifiants, rien d'autre. C'est elle qui
    // permettra de constater qu'un NOUVEAU est entré, sans jamais prétendre savoir qui il est.
    const vus = await this.membresPhotographies(canal.id);

    const ligne = inscrireLigne(this.registre, {
      chantier,
      canal_id: canal.id,
      canal_nom: canal.nom,
      pane,
      worktree: worktree || null,
      herdr_socket: herdrSocket,
      nature: natureVoulue,
      ...(vus ? { membres_vus: vus } : {}),
      // JETABLE OU DURABLE — inscrit ici, et nulle part ailleurs (T-20260814-0085).
      //
      // Le champ n'existe QUE s'il a été demandé : une ligne ordinaire n'en porte pas, et
      // `jetabiliteDe` la lit comme durable. C'est ce qui aligne les lignes déjà au registre,
      // écrites par une version qui n'avait pas ce champ, sur le comportement sûr.
      ...(jetable === true ? { jetable: true } : {}),
      // Le nom sous lequel la ligne se présente dans son canal — voir `libelleDeLigne`.
      // Inscrit à l'ouverture, jamais recalculé : le titre peut changer (`renommer`), et
      // c'est ce geste-là qui le met à jour, en même temps que le nom du canal.
      libelle: natureVoulue === 'client' ? titreUtile : chantier,
      // Qui a le droit de piloter l'agent par cette ligne.
      //
      // Sur une ligne INTERNE, le canal est public : sans cette liste, n'importe quel
      // membre de l'espace ferait passer un message pour une consigne du dirigeant — le
      // cadre lui en donne l'autorité.
      //
      // Sur une ligne CLIENT, elle démarre vide et c'est normal : les gens du client sont
      // invités À LA MAIN dans Slack, après l'ouverture. C'est leur appartenance au canal
      // privé qui les autorise, et cette liste ne sert plus qu'à s'en souvenir.
      autorises: invitesEffectifs.slice(),
      // LE SECOND PORTEUR DE CETTE LIGNE, s'il y en a un — `null` sinon, et `null` est le cas
      // par défaut : une ligne ouverte sans `--au-gestionnaire` est EXACTEMENT celle d'hier.
      pair,
      visage,
      ouverte_le: maintenant(),
      close_le: null,
    });
    sauverRegistre(this.registre);
    journaliser(
      `ligne ouverte — ${chantier} → #${canal.nom} (${canal.id}) pane ${pane} nature ${natureVoulue}` +
        (pair ? ` — partagée avec ${pair.nom} (${pair.pane})` : '')
    );
    return {
      ok: true,
      reprise: false,
      ...(avertissementsAvant.length ? { avertissements: avertissementsAvant } : {}),
      canal: canal.nom,
      canal_id: canal.id,
      visage,
      nature: natureVoulue,
      canal_reutilise: canal.reutilise,
      ...(pair ? { pair: { role: pair.role, nom: pair.nom, pane: pair.pane } } : {}),
    };
  }

  /**
   * QUI EST DANS CE CANAL — lu chez Slack, jugé par `cloisonnement.js` (T-20260814-0142).
   *
   * ⚠️ SUR UNE LIGNE INTERNE SEULEMENT. Un canal CLIENT existe pour accueillir les gens du
   * client : y appliquer cette garde fermerait la porte au nez de ceux à qui il est destiné.
   * C'est la confusion la plus coûteuse que ce lot pouvait produire, et elle est écrite ici.
   *
   * Rend `null` quand il n'y a rien à redire, sinon le refus tout prêt.
   */
  /** La photo des membres, ou `null` si on n'a pas pu la prendre — on ne l'invente pas. */
  async membresPhotographies(canalId) {
    try {
      return photographier(await this.slack.profilsDuCanal(this.jetons.robot, canalId));
    } catch {
      // Pas de photo vaut mieux qu'une fausse : `nouveauxVenus` ne crie pas sans référence.
      return null;
    }
  }

  async refusEtranger(canalId, canalNom, nature) {
    if (nature === 'client') return null;
    let profils;
    try {
      profils = await this.slack.profilsDuCanal(this.jetons.robot, canalId);
    } catch (err) {
      // ⚠️ ON NE CONCLUT RIEN DE CE QU'ON N'A PAS PU LIRE — et on n'ouvre pas non plus la porte
      // en silence. Le même renversement que partout ailleurs ici : un droit manquant deviendrait
      // « personne d'étranger », c'est-à-dire l'inverse de ce que la garde promet.
      journaliser(`membres de #${canalNom} illisibles (${err.message}) — cloisonnement non vérifié`);
      // ⚠️ À L'OUVERTURE, UNE LECTURE IMPOSSIBLE REFUSE — arbitrage rendu après revue de fond.
      //
      // La recommandation était un compteur d'échecs qui basculerait en refus après N essais.
      // Écartée, et pour la bonne raison : **un compteur est un ÉTAT**, et un état qui se remet
      // à zéro au redémarrage donne une garde qui PARAÎT armée sans l'être — très exactement le
      // défaut que ce lot corrige, réintroduit par son propre remède.
      //
      // La distinction se fait donc sur le MOMENT, sans seuil et sans mémoire :
      //   • à l'OUVERTURE, on peut encore ne pas ouvrir — personne n'attend, rien n'est perdu ;
      //   • sur une ligne VIVANTE, quelqu'un attend une réponse, et couper la parole parce qu'un
      //     droit a hoqueté serait le remède pire que le mal (voir `veillerAvantDEcrire`).
      return {
        motif: 'cloisonnement_invérifiable',
        message:
          `qui est dans #${canalNom} n'a pas pu être lu (${err.message}) — impossible de garantir ` +
          `qu'aucun externe n'y est, donc la ligne ne s'ouvre pas. Une ligne interne porte les ` +
          `arbitrages, les pannes de production, les échéances et les coûts. ⚠️ ${NOUS.limite}.`,
      };
    }
    const etrangers = etrangersParmi(profils, this.identite?.equipe || null);
    if (!etrangers.length) return null;
    return {
      motif: 'etranger_dans_le_canal',
      qui: etrangers.map((e) => e.nom),
      message:
        `#${canalNom} porte ${etrangers.length > 1 ? 'des gens' : 'quelqu\'un'} qui ne ${
          etrangers.length > 1 ? 'sont' : 'semble'
        } pas de la maison : ${etrangers.map((e) => e.nom).join(', ')}. Une ligne interne porte ` +
        'les arbitrages, les pannes de production, les échéances et les coûts — « pas de client ' +
        'dans les canaux des orchestrateurs ». Fais-les sortir du canal, ou ouvre la ligne ' +
        `ailleurs. ⚠️ ${NOUS.limite}.`,
    };
  }

  /**
   * FAIT ENTRER LES INVITÉS DANS LE CANAL, ET LE PROUVE EN RELISANT SES MEMBRES.
   *
   * ═══════════════════════════════════════════════════════════════════════════════════════
   * LA PREUVE PORTE SUR UN ÉTAT QUI POUVAIT ÊTRE DIFFÉRENT (T-20260814-0136).
   *
   * Le code de retour de `conversations.invite` ne dit pas que quelqu'un est entré : il dit que
   * l'appel n'a pas jeté. `slack.js` avale d'ailleurs délibérément deux de ses erreurs
   * (`already_in_channel`, `cant_invite_self`), et toute erreur avalée est un chemin par lequel
   * un `ok` sort sans que personne soit dans le canal. Ce qui établit la présence, c'est la
   * LISTE DES MEMBRES — le même motif que le retrait d'une pièce jointe, prouvé par relecture
   * du bucket et jamais par un code de retour.
   *
   * ⚠️ ON RELIT AVANT D'INVITER, et pas seulement après. C'est ce qui rend le geste reprenable
   * sans coût : une reprise sur une ligne saine — le cas de loin le plus fréquent — constate la
   * présence et n'appelle rien. Sans cette lecture d'abord, chaque redémarrage d'agent paierait
   * une invitation inutile, et `already_in_channel` la masquerait.
   *
   * ⚠️ UN DROIT MANQUANT EST NOMMÉ. L'erreur de Slack (`missing_scope` et les autres) remonte
   * dans le message plutôt que d'être avalée : le ticket l'exige, et c'est la seule façon que
   * la personne devant l'écran sache que ce n'est pas à elle de réessayer.
   */
  async assurerPresence(canalId, canalNom, invites, nature) {
    // Une ligne CLIENTE n'invite personne : les gens du client entrent à la main dans leur
    // canal privé, et c'est leur appartenance qui les autorise. Rien à prouver ici.
    if (nature === 'client' || !invites.length) return { ok: true };

    // ⚠️ UNE LECTURE IMPOSSIBLE NE FAIT PAS TOMBER L'OUVERTURE — défaut de T-20260814-0136,
    // trouvé en éprouvant le cloisonnement : l'exception traversait `ouvrir` et l'appelant
    // recevait une pile au lieu d'un refus lisible. On la nomme.
    let avant;
    try {
      avant = await this.slack.membresDuCanal(this.jetons.robot, canalId);
    } catch (err) {
      return {
        ok: false,
        erreur:
          `impossible de lire qui est déjà dans #${canalNom} (${err.code || err.message}) — donc ` +
          'impossible de savoir qui reste à inviter, ni de prouver que quiconque y est entré.',
      };
    }
    const manquants = invites.filter((u) => !avant.includes(u));
    if (!manquants.length) return { ok: true };

    try {
      await this.slack.inviter(this.jetons.robot, canalId, manquants);
    } catch (err) {
      journaliser(`invitation refusée — #${canalNom} : ${err.code || err.message}`);
      return {
        ok: false,
        erreur:
          `Slack a refusé de faire entrer ${manquants.length} personne(s) dans #${canalNom} ` +
          `(${err.code || err.message}) — la ligne n’est pas ouverte. Un droit manquant se ` +
          'nomme : il ne se retente pas, et personne ne devinerait qu’il manque.',
      };
    }

    const apres = await this.slack.membresDuCanal(this.jetons.robot, canalId);
    const absents = invites.filter((u) => !apres.includes(u));
    if (absents.length) {
      journaliser(`invitation sans effet — #${canalNom} : ${absents.join(', ')} absents après invitation`);
      return {
        ok: false,
        erreur:
          `l’invitation a été acceptée mais ${absents.length} personne(s) ne sont PAS membres de ` +
          `#${canalNom} — la ligne serait muette, et un « ok » l’aurait caché. Vérifie le canal ` +
          'dans Slack, puis relance.',
      };
    }
    return { ok: true };
  }

  /**
   * Le PAIR qu'on attache à une ligne de chantier — établi par le FAIT, jamais sur parole.
   *
   * ═══════════════════════════════════════════════════════════════════════════════════════
   * TROIS REFUS, ET CHACUN FERME UNE PORTE DIFFÉRENTE (T-20260814-0093).
   *
   * 1. **JAMAIS SUR UNE LIGNE CLIENTE.** C'est LA garde de ce lot, et elle est structurelle
   *    plutôt que déclarative : une ligne cliente ne peut pas porter de pair, donc aucun écho
   *    ne peut partir vers le canal d'un client — il n'existe pas de chemin, pas seulement pas
   *    d'intention. Le mode de panne unique de ce lot est fermé ici, et `echoAuPair` le
   *    revérifie pour un registre écrit avant cette version.
   *
   * 2. **UN AGENT QU'ON NE TROUVE PAS N'EST PAS UN PAIR.** Le nom d'agent est une chaîne libre
   *    qu'un humain ou un brief a tapée. Attacher un nom qu'on n'a pas vu vivre donnerait une
   *    ligne qui a l'air partagée : le compte rendu part, `ok:true`, personne ne le reçoit.
   *
   * 3. **ET SON RÔLE S'ÉTABLIT PAR SON LIEU**, via `roleDuLieu` — le point unique du dépôt qui
   *    établit un rôle par le fait (les quatre fichiers de la pose ET les en-têtes réels du
   *    métier). Ni son nom herdr, ni le dossier qui le porte. Sans ce contrôle,
   *    `--au-gestionnaire <n'importe quel agent>` déverserait le compte rendu technique d'un
   *    chantier chez un agent quelconque — et si cet agent est le représentant d'un AUTRE
   *    client, c'est très exactement la fuite qu'on ferme au point 1, par la porte d'à côté.
   *
   * ⚠️ HERDR INJOIGNABLE NE VAUT PAS « AGENT ABSENT » — c'est la leçon de T-20260813-0054 : un
   * outil introuvable rendait une liste vide, qu'on lisait comme « aucun agent vivant ». On
   * refuse en le disant, on ne conclut pas.
   */
  async resoudrePair(nom, natureVoulue, paneOuvreur) {
    if (natureVoulue === 'client') {
      return {
        ok: false,
        erreur:
          `une ligne CLIENTE ne se partage pas : « --au-gestionnaire » y est refusé, et la ligne n'est ` +
          `pas ouverte. Le canal d'un client n'a qu'un interlocuteur — un compte rendu de chantier qui ` +
          `y atterrirait serait lu par le client.`,
      };
    }
    let vivants;
    try {
      vivants = await this.herdr.agents();
    } catch (err) {
      return {
        ok: false,
        erreur:
          `herdr est injoignable (${err.message}) — on ne sait pas si « ${nom} » travaille, et la ligne ` +
          `n'est pas ouverte. Rien n'a été créé : relance quand herdr répond.`,
      };
    }
    const candidats = vivants.filter((a) => a.name === nom);
    if (!candidats.length) {
      return {
        ok: false,
        erreur:
          `aucun agent nommé « ${nom} » ne travaille sur ce poste — la ligne n'est PAS ouverte. Vérifie le ` +
          `nom que ton gestionnaire s'est donné (« herdr agent list »), ou ouvre ta ligne sans ` +
          `« --au-gestionnaire » si personne ne t'a mandaté.`,
      };
    }
    if (candidats.length > 1) {
      return {
        ok: false,
        erreur:
          `« ${nom} » désigne ${candidats.length} agents de ce poste — on ne devine pas lequel, et la ligne ` +
          `n'est pas ouverte. Fais renommer l'un des deux, puis relance.`,
      };
    }
    const a = candidats[0];
    if (a.pane_id === paneOuvreur) {
      return { ok: false, erreur: `« ${nom} », c'est toi — une ligne ne se partage pas avec soi-même.` };
    }
    const role = roleDuLieu(a.foreground_cwd || a.cwd);
    if (role !== 'representant') {
      return {
        ok: false,
        erreur:
          `« ${nom} » n'est pas un gestionnaire client : son lieu de travail n'en porte pas le métier — la ` +
          `ligne n'est PAS ouverte. Seul un représentant posé par « ligne-directe representant » partage la ` +
          `ligne d'un chantier ; y attacher quelqu'un d'autre lui livrerait ce qui ne le regarde pas.`,
      };
    }
    return { ok: true, pair: { role, nom, pane: a.pane_id, herdr_socket: a.herdr_socket || null } };
  }

  /**
   * LE REFUS OPPOSÉ AU PAIR QUI DISPOSERAIT D'UNE LIGNE QUI N'EST PAS LA SIENNE — ou `null`.
   *
   * ═══════════════════════════════════════════════════════════════════════════════════════
   * ⚠️ « UNE PORTE SUR DEUX », ET C'ÉTAIT LA MIENNE (T-20260814-0093, trouvé en relecture).
   *
   * Partager une ligne, c'est ajouter un porteur à `panesDeLigne` — et `ligneDuPane` sert
   * TROIS gestes, pas un : `dire`, `fermer`, `renommer`. Le lot n'avait pensé qu'au premier.
   * Le gestionnaire pouvait donc **fermer la ligne du chantier de son orchestrateur**, poster
   * un bilan en son nom et faire ARCHIVER son canal — c'est-à-dire mettre en lecture seule,
   * sans retour, le lieu où l'orchestrateur attend l'arbitrage du dirigeant. Et le renommer.
   *
   * PARLER SE PARTAGE, DISPOSER NE SE PARTAGE PAS. Le chantier appartient à celui qui le mène :
   * il l'a ouvert, il le referme. Le pair y parle, et c'est tout ce qu'on lui a donné.
   *
   * C'est la même forme de garde que `refusSurCommun`, au même endroit et pour la même raison :
   * le veilleur est le point d'écriture unique, et une garde posée dans la commande se contourne
   * par un appel direct au socket.
   */
  refusDuPair(geste, ligne, pane) {
    if (!pane || !ligne?.pair?.pane || pane !== ligne.pair.pane) return null;
    // Le porteur d'origine reste maître, même s'il partage son pane avec le pair (cas d'école,
    // mais un `===` qui rendrait un refus au propriétaire serait pire que la porte qu'on ferme).
    if (pane === ligne.pane) return null;
    return {
      ok: false,
      motif: 'ligne_du_pair',
      erreur:
        `la ligne de « ${ligne.chantier} » (#${ligne.canal_nom}) est celle de l'orchestrateur qui mène ce ` +
        `chantier : tu y parles, tu n'en disposes pas. « ${geste} » est refusé — rien n'a changé. ` +
        `Pour parler : dire "…" --a ${ligne.chantier}.`,
    };
  }

  /**
   * L'ÉCHO D'UNE PAROLE AUX AUTRES PORTEURS DE LA LIGNE — ce qui fait que les deux se parlent.
   *
   * Ce qui part dans Slack est lu par le dirigeant. Les agents, eux, ne lisent pas Slack : sans
   * cet écho, un orchestrateur et son gestionnaire partageraient un canal sans jamais s'entendre.
   *
   * ⚠️ IL NE FAIT JAMAIS ÉCHOUER LE `dire`. Le message est DÉJÀ posté quand on arrive ici :
   * lever remettrait un échec de remise sur le compte d'un envoi réussi, et l'agent renverrait
   * son message — deux fois dans le canal. Ce qui n'est pas passé est RENDU (`pair.remis: false`)
   * plutôt qu'avalé : « un rapport qui échoue bruyamment vaut mieux qu'un rapport perdu ».
   *
   * ⚠️ ET IL NE PART QUE VERS L'AUTRE. On compare des PANES, jamais des rôles : si l'émetteur
   * n'est aucun des porteurs connus, on ne devine pas de destinataire — on journalise. Se
   * rabattre sur « l'autre porteur » renverrait à un agent la parole d'un tiers, cadrée comme
   * celle de son pair.
   */
  async echoAuPair(ligne, paneEmetteur, texte) {
    const pair = ligne?.pair;
    if (!pair?.pane) return null;
    // Une ligne CLIENTE ne porte pas de pair — `resoudrePair` le refuse. On le revérifie ici
    // pour un registre écrit à la main ou par une version antérieure : la garde qui compte ne
    // se tient pas sur la seule promesse de son point d'entrée.
    if (natureDe(ligne) === 'client') {
      journaliser(`écho refusé — #${ligne.canal_nom} est une ligne cliente : elle ne porte pas de pair`);
      return null;
    }
    if (!paneEmetteur) {
      journaliser(`écho non remis — #${ligne.canal_nom} : le geste ne dit pas de quel pane il part`);
      return { remis: false, raison: 'pane de l’émetteur inconnu' };
    }
    const versPair = paneEmetteur === ligne.pane;
    if (!versPair && paneEmetteur !== pair.pane) {
      journaliser(`écho non remis — #${ligne.canal_nom} : ${paneEmetteur} n'est pas un porteur de cette ligne`);
      return { remis: false, raison: 'ce pane ne porte pas cette ligne' };
    }
    const vers = versPair ? pair.pane : ligne.pane;
    const socket = versPair ? pair.herdr_socket : ligne.herdr_socket;

    // ═══ ON REVÉRIFIE QUI EST AU BOUT, À CHAQUE ÉCHO — le pair est établi UNE FOIS, à
    // l'ouverture, et un pane n'appartient pas pour toujours à qui l'occupait ce jour-là.
    //
    // ⚠️ TROUVÉ EN REVUE DE FOND, ET REPRODUIT : `resoudrePair` vérifiait la vie et le rôle au
    // moment d'attacher, puis `{nom, pane}` était figé au registre. Le pane du gestionnaire
    // ferme, herdr en rouvre un sous le même identifiant pour un AUTRE agent — et tout le fil
    // technique du chantier continuait de lui être remis, cadré « c'est ton pair qui te parle »,
    // avec `remis: true`. Si cet autre agent est le représentant d'un AUTRE client, c'est la
    // fuite que ce lot ferme partout ailleurs, par la porte du temps.
    //
    // VERS LE PAIR, on exige le pane ET LE NOM : c'est ce que le registre sait de lui, et un
    // pane repris par quelqu'un d'autre ne porte plus ce nom. VERS L'ORCHESTRATEUR, on exige la
    // vie du pane — la même garantie que `remettreAuChantier` applique à l'entrant, ni plus
    // (aucun nom n'est inscrit pour lui) ni moins.
    let porteurs;
    try {
      porteurs = await this.herdr.agents();
    } catch (err) {
      // Herdr injoignable N'EST PAS un agent mort (T-20260813-0054) — mais ce n'est pas non plus
      // une permission de remettre à l'aveugle. On ne remet pas, et on le DIT à qui a parlé.
      journaliser(`écho non remis — #${ligne.canal_nom} : herdr injoignable (${err.message})`);
      return { remis: false, pane: vers, raison: `herdr injoignable : ${err.message}` };
    }
    const occupant = porteurs.find((a) => a.pane_id === vers);
    if (!occupant || (versPair && occupant.name !== pair.nom)) {
      journaliser(
        `écho non remis — #${ligne.canal_nom} : ${vers} ne porte plus ` +
          (versPair ? `« ${pair.nom} » (${occupant ? `c'est « ${occupant.name} »` : 'plus aucun agent'})` : "l'agent de cette ligne")
      );
      return {
        remis: false,
        pane: vers,
        raison: occupant
          ? `ce pane porte désormais un autre agent — rien ne lui a été remis`
          : `plus aucun agent ne travaille dans ce pane`,
      };
    }
    const cadre = cadrerPourPair({
      chantier: ligne.chantier,
      texte,
      canal: ligne.canal_nom,
      deRole: versPair ? 'orchestrateur' : pair.role,
      deNom: versPair ? ligne.chantier : pair.nom,
      versRole: versPair ? pair.role : 'orchestrateur',
    });
    try {
      // ═══ « ÉCRIT DANS LE PANE » N'EST PAS « PRIS » — ici comme ailleurs (T-20260815-0021).
      //
      // ⚠️ CE FAIT ÉTAIT DÉJÀ CALCULÉ, ET SEUL CE CHEMIN LE JETAIT. Depuis `T-20260815-0011`,
      // `remettre()` lit l'état du pane avant d'écrire, relit après, et rend `pris` selon que
      // quelque chose a changé. Trois appelants dans ce fichier ; les deux autres le lisent.
      // Celui-ci rendait `remis: true` sur la seule absence d'exception — donc un écho qui
      // dort dans la session d'un pair était annoncé remis à celui qui l'avait envoyé.
      //
      // Ce que ça coûtait tient dans la question du dirigeant — « peut-on parler d'un agent à
      // l'autre ? ». La réponse restait « oui » même quand ça ne marchait pas : un gestionnaire
      // relance son orchestrateur, obtient « remis », et attend une réponse que personne n'a lue.
      //
      // ⚠️ ET « PAS PRIS » N'EST PAS « PAS PARTI ». Le message est peut-être arrivé — on refuse
      // seulement de l'AFFIRMER, et on le dit en clair à qui a parlé plutôt que de le taire.
      const remise = await this.herdr.remettre(vers, cadre, { socket: socket || undefined });
      // ⚠️ ON EXIGE LE VERDICT, ON NE SE CONTENTE PAS DE SON ABSENCE DE DÉMENTI. Lire
      // `pris === false` laisserait passer un `remettre` qui ne rend rien du tout — donc un
      // double d'essai plus permissif que le service, la porte même que ce lot ferme.
      if (!remise?.pris) {
        journaliser(
          `écho NON prouvé — #${ligne.canal_nom} : ${paneEmetteur} → ${vers} : ` +
            `le texte est parti, mais rien ne montre que l'agent l'a pris`
        );
        return {
          remis: false,
          pane: vers,
          nom: versPair ? pair.nom : null,
          raison: 'le texte est parti, mais la prise par l’agent n’a pas été constatée',
        };
      }
      journaliser(`écho remis — #${ligne.canal_nom} : ${paneEmetteur} → ${vers} (${remise?.temoin || 'pris'})`);
      return { remis: true, pane: vers, nom: versPair ? pair.nom : null, temoin: remise?.temoin ?? null };
    } catch (err) {
      journaliser(`ÉCHEC de l'écho — #${ligne.canal_nom} : ${paneEmetteur} → ${vers} : ${err.message}`);
      return { remis: false, pane: vers, raison: err.message };
    }
  }

  /**
   * Le refus opposé à tout geste qui viserait le canal commun — ou `null` si ce n'est pas lui.
   *
   * LE « DESCENDANT SEULEMENT » EST UNE GARANTIE, PAS UNE CONVENTION, et c'est ici qu'il le
   * devient. Trois gestes écrivent ou modifient un canal — `dire`, `fermer`, `renommer` — et
   * chacun peut recevoir un `canal_id` de son appelant. Sans cette garde, le canal commun leur
   * est déjà inaccessible par le chemin ordinaire (il n'entre pas dans `lignes[]`, donc pas
   * dans `etat().ouvertes`, donc pas dans la sélection par pane de la commande) — mais « il ne
   * s'y trouve pas aujourd'hui » n'est pas la même phrase que « il ne peut pas s'y trouver ».
   *
   * Ce qui est en jeu tient en une image : une parole d'agent — la réponse d'un représentant à
   * son client, un rapport de chantier — arrivant dans le pane de TOUS les agents du poste.
   * Le refus est donc nommé, à un seul endroit, et il vaut quelle que soit la porte.
   *
   * ON LUI DONNE TOUTES LES DÉSIGNATIONS DU CANAL, pas seulement l'argument reçu — et c'est une
   * vérification par mutation qui l'a imposé : gardée sur le seul `canal_id` passé par
   * l'appelant, elle laissait passer le chemin par CHANTIER. Le registre survit aux versions du
   * pack : une ligne inscrite sur ce canal par une version qui ne connaissait pas le canal
   * commun y reste, et `fermer` aurait posté son bilan puis ARCHIVÉ le canal de tous les agents.
   * On teste donc aussi la ligne une fois résolue.
   */
  refusSurCommun(geste, ...canaux) {
    // IL Y EN A PLUSIEURS DEPUIS T-20260814-0002 — un par rôle, plus celui d'avant, désigné
    // sans rôle. On refuse sur CELUI QUI EST VISÉ, jamais sur « le » canal commun : nommer le
    // premier inscrit dirait à l'agent qu'il a touché un canal auquel il n'a rien fait, et
    // laisserait le vrai passer le jour où la garde serait écrite contre un seul.
    const vise = canaux.map((c) => communPourCanal(this.registre, c)).find(Boolean);
    if (!vise) return null;
    const pour = vise.role ? `des ${libellePluriel(vise.role)}` : 'commun';
    journaliser(`refusé — ${geste} visait le canal ${pour} #${vise.canal_nom} : rien n'y remonte`);
    return {
      ok: false,
      erreur:
        `#${vise.canal_nom} est le canal ${pour} : il porte les consignes du dirigeant à tous les agents ` +
        `concernés, et rien n'y remonte jamais. Le geste « ${geste} » y est refusé — ce que tu as à dire ` +
        `va sur ta ligne.`,
    };
  }

  /**
   * Désigne le canal commun D'UN RÔLE — celui dont chaque message est remis aux agents de ce
   * rôle qui travaillent en ce moment, et à eux seuls.
   *
   * On ne le CRÉE pas, on le désigne : un canal où le dirigeant parle à toute son équipe
   * existe déjà, et notre robot doit y avoir été invité par un humain — un robot ne se met pas
   * lui-même dans un canal (mesuré le 2026-08-06 : `conversations.join` répond `missing_scope`,
   * et le refus suivant attend sur les canaux privés). Deux refus distincts, parce que les
   * gestes qui les lèvent ne sont pas les mêmes : un canal ABSENT se corrige, un canal dont on
   * n'est PAS MEMBRE demande une invitation.
   *
   * LA LISTE DES AUTORISÉS EST OBLIGATOIRE, et c'est le refus le moins évident des quatre. Sur
   * une ligne, un intrus fait passer un message pour une consigne à UN agent ; ici, il parle à
   * tous à la fois, dans un cadre qui annonce le dirigeant. Sans liste, tout membre de l'espace
   * pourrait faire rafraîchir la configuration de chaque agent du poste — ou pire.
   *
   * ─────────────────────────────────────────────────────────────────────────────────────
   * LE RÔLE EST OBLIGATOIRE, ET IL NE SE DEVINE PAS (T-20260814-0002). Les consignes diffèrent
   * réellement selon le rôle — « un nouveau MCP au ServiceDesk » ne dit rien à un gestionnaire,
   * « une règle de conduite face au client a changé » ne dit rien à un orchestrateur. Se rabattre
   * sur un rôle par défaut poserait le canal, l'opérateur le croirait posé pour le rôle qu'il
   * visait, et les consignes partiraient chez les autres.
   */
  async designerCommun({ canal, role, autorises = [] }) {
    if (!canal) return { ok: false, erreur: 'canal requis' };
    if (!role) {
      return {
        ok: false,
        motif: 'role_absent',
        erreur:
          `un canal commun se désigne POUR UN RÔLE — les rôles connus sont ${rolesConnus().join(', ')}. ` +
          `Sans lui, on ne saurait pas à qui remettre ses consignes, et deviner viserait le mauvais public.`,
      };
    }
    try {
      roleDe(role); // un rôle inconnu échoue AVANT tout appel à Slack
    } catch (err) {
      if (!(err instanceof RoleInconnu)) throw err;
      return { ok: false, motif: 'role_inconnu', erreur: err.message };
    }
    if (!autorises.length) {
      return {
        ok: false,
        erreur:
          'un canal commun sans autorisé n’est pas désigné : il porte la parole du dirigeant à tous les agents, ' +
          'et sans liste n’importe quel membre de l’espace pourrait la prendre. Nomme au moins une personne.',
      };
    }

    const trouve = await this.slack.trouverCanal(this.jetons.robot, canal);
    if (!trouve) return { ok: false, erreur: `aucun canal #${canal} dans cet espace`, motif: 'absent' };

    // UN CANAL ARCHIVÉ EST EN LECTURE SEULE, ET IL RESTE DANS LA LISTE. `trouverCanal`
    // interroge Slack avec `exclude_archived: false` — c'est voulu ailleurs, pour pouvoir DIRE
    // qu'un canal est archivé plutôt que « introuvable ». Ici, sans ce refus, la désignation
    // répondait `ok:true` : le canal commun aurait l'air posé, et AUCUNE consigne ne serait
    // jamais partie, puisque plus personne ne peut écrire dans ce canal. Le silence exact que
    // tout ce dispositif existe pour supprimer, sur le canal censé réveiller le poste entier.
    // (Et le robot en reste membre : `estMembreDuCanal` n'aurait rien vu.)
    if (trouve.is_archived) {
      return {
        ok: false,
        motif: 'archive',
        erreur:
          `#${canal} est archivé — personne ne peut plus y écrire, aucune consigne n’en partirait. ` +
          `Désarchive-le dans Slack (un compte humain le peut, pas notre robot) ou désigne-en un autre.`,
      };
    }

    if (!(await this.slack.estMembreDuCanal(this.jetons.robot, trouve))) {
      return {
        ok: false,
        motif: 'non_membre',
        erreur:
          `notre robot n’est pas dans #${canal} — il faut l’y inviter à la main. ` +
          `Un robot ne rejoint pas un canal de lui-même.`,
      };
    }

    // UN CANAL NE PEUT PAS ÊTRE LES DEUX. Désigner comme canal commun le canal d'une ligne
    // ouverte ferait remettre chaque message de cet interlocuteur à TOUS les agents — et, si
    // c'est une ligne cliente, c'est le client qui parlerait à tout le poste.
    const dejaLigne = this.registre.lignes.find((l) => l.canal_id === trouve.id && !l.close_le);
    if (dejaLigne) {
      return {
        ok: false,
        erreur:
          `#${canal} porte déjà la ligne de « ${dejaLigne.chantier} » — un canal ne peut pas être à la fois ` +
          `une ligne et le canal commun. Choisis-en un autre.`,
      };
    }

    // UN CANAL NE SERT PAS DEUX RÔLES, et le refus est le lot lui-même : un canal partagé est
    // très exactement le canal unique qu'on remplace, avec l'inconvénient de plus d'avoir l'air
    // séparé. Chacun y trierait ce qui ne le concerne pas, et un canal qu'on trie cesse d'être
    // lu (RA-REL-008). Redésigner LE MÊME rôle, en revanche, n'est pas un conflit : c'est ainsi
    // qu'on corrige une liste d'autorisés.
    const dejaAilleurs = canauxCommuns(this.registre).find((c) => c.canal_id === trouve.id && c.role && c.role !== role);
    if (dejaAilleurs) {
      return {
        ok: false,
        motif: 'deja_dun_autre_role',
        erreur:
          `#${canal} est déjà le canal des ${libellePluriel(dejaAilleurs.role)} — un canal ne sert ` +
          `qu'un seul rôle, sinon chacun doit y trier ce qui ne le concerne pas. Désigne-en un autre.`,
      };
    }

    this.registre.communs = { ...(this.registre.communs || {}) };
    this.registre.communs[role] = {
      canal_id: trouve.id,
      canal_nom: trouve.name || canal,
      autorises: [...new Set(autorises)],
      designe_le: maintenant(),
    };
    // LE CANAL D'AVANT CESSE D'ÊTRE ORPHELIN quand c'est LUI qu'on vient de désigner : sans ça,
    // il resterait signalé « sans rôle » à perpétuité sur un canal qui en a désormais un, et
    // l'état mentirait dans le sens qui use — un avertissement permanent qu'on finit par ignorer.
    if (canalCommunSansRole(this.registre)?.canal_id === trouve.id) this.registre.commun = null;
    sauverRegistre(this.registre);
    const inscrit = this.registre.communs[role];
    journaliser(
      `canal des ${libellePluriel(role)} désigné — #${inscrit.canal_nom} (${trouve.id}), ` +
        `${inscrit.autorises.length} autorisé(s)`
    );
    return { ok: true, role, canal: inscrit.canal_nom, canal_id: trouve.id, autorises: inscrit.autorises.length };
  }

  /** Poste sous l'identité du chantier. Échoue BRUYAMMENT : un rapport perdu en silence est pire qu'une erreur. */
  async dire({ chantier, worktree, texte, canal_id: canalId, pane }) {
    const ligne = canalId ? ligneParCanal(this.registre, canalId) : ligneOuverteParCle(this.registre, chantier, worktree);
    const refus = this.refusSurCommun('dire', canalId, ligne?.canal_id);
    if (refus) return refus;
    if (!ligne) return { ok: false, erreur: `aucune ligne ouverte pour « ${chantier || canalId} » — ouvre-la d'abord` };
    if (ligne.close_le) return { ok: false, erreur: `la ligne de « ${ligne.chantier} » est close depuis ${ligne.close_le}` };

    // ═══ AVANT D'ÉCRIRE, REGARDER QUI LIRA (T-20260813-0074 · T-20260814-0142).
    //
    // C'est le moment juste, et c'est le seul. `autorise()` relit déjà les membres — mais
    // seulement quand quelqu'un ÉCRIT, alors que le risque de ce lot est la LECTURE : « ce n'est
    // pas le client B qui écrit, c'est ce que le client A reçoit et que B lit par-dessus son
    // épaule ». Un lecteur silencieux ne se manifeste jamais ; ce qu'on peut faire, c'est
    // regarder avant de lui donner à lire.
    const veille = await this.veillerAvantDEcrire(ligne);
    if (veille.refus) return { ok: false, refus: veille.refus, erreur: veille.refus.message };

    const ts = await this.slack.poster(this.jetons.robot, {
      canal: ligne.canal_id,
      texte,
      nom: libelleDeLigne(ligne),
      emoji: ligne.visage,
    });
    // L'ÉCHO VIENT APRÈS L'ENVOI, et l'ordre est celui de `fermer` pour la même raison : ce qui
    // part chez l'interlocuteur humain ne dépend jamais de ce qui part chez un agent.
    const pair = await this.echoAuPair(ligne, pane, texte);
    return {
      ok: true,
      canal: ligne.canal_nom,
      ts,
      ...(veille.nouveaux ? { nouveaux_venus: veille.nouveaux } : {}),
      ...(veille.invérifiable ? { cloisonnement_invérifiable: veille.invérifiable } : {}),
      ...(pair ? { pair } : {}),
    };
  }

  /**
   * CE QU'ON CONSTATE DU CANAL JUSTE AVANT D'Y ÉCRIRE — et ce qu'on en fait.
   *
   * Deux choses, et elles ne se traitent pas pareil :
   *
   *   • un ÉTRANGER dans une ligne INTERNE ⇒ on n'écrit pas. « Un canal compromis qu'on
   *     continue d'alimenter est pire qu'un canal fermé » — le point 3 de T-20260814-0142.
   *     Sur une ligne cliente, au contraire, les invités sont ceux à qui elle est destinée ;
   *   • un NOUVEAU VENU depuis la photo ⇒ on le DIT, et on écrit quand même. On ne prétend pas
   *     savoir que c'est un autre client : sans registre des personnes, rien ne le permet, et
   *     deux personnes d'un même client sont le cas nominal. On dit que le lectorat a augmenté.
   *
   * ⚠️ LA PHOTO SE REPREND UNE FOIS LE SIGNAL DONNÉ. Un signal répété à chaque message devient
   * du bruit, et un bruit cesse d'être lu — ce que ce dépôt écrit partout ailleurs (RA-REL-008).
   */
  async veillerAvantDEcrire(ligne) {
    const nature = natureDe(ligne);
    let profils;
    try {
      profils = await this.slack.profilsDuCanal(this.jetons.robot, ligne.canal_id);
    } catch (err) {
      // On n'a pas pu regarder. Dans les DEUX natures on laisse écrire — couper la parole parce
      // qu'un droit Slack a hoqueté serait le remède pire que le mal — mais sur une ligne interne
      // on le DIT, et sur une ligne cliente on se tait : un client n'a pas à recevoir nos avaries
      // d'outillage. (Le commentaire d'origine annonçait ici un refus que le code ne faisait pas
      // — relevé en revue de fond.)
      if (nature === 'client') return {};
      journaliser(`membres de #${ligne.canal_nom} illisibles avant écriture (${err.message})`);
      // On le DIT sans empêcher : se taire serait conclure d'une absence de mesure, et refuser
      // couperait la parole d'un agent parce qu'un droit Slack a hoqueté.
      return { invérifiable: `qui lit #${ligne.canal_nom} n'a pas pu être vérifié (${err.message})` };
    }

    if (nature !== 'client') {
      const etrangers = etrangersParmi(profils, this.identite?.equipe || null);
      if (etrangers.length) {
        return {
          refus: {
            motif: 'etranger_dans_le_canal',
            qui: etrangers.map((e) => e.nom),
            message:
              `#${ligne.canal_nom} porte ${etrangers.map((e) => e.nom).join(', ')}, qui ne semble ` +
              'pas de la maison — rien n\'est écrit. Une ligne interne porte les arbitrages, les ' +
              `pannes de production, les échéances et les coûts. ⚠️ ${NOUS.limite}.`,
          },
        };
      }
    }

    const venus = nouveauxVenus(ligne.membres_vus, profils);
    ligne.membres_vus = photographier(profils);
    sauverRegistre(this.registre);
    if (!venus.length) return {};
    journaliser(`nouveau(x) venu(s) dans #${ligne.canal_nom} : ${venus.map((v) => v.nom).join(', ')}`);
    return { nouveaux: venus.map((v) => v.nom) };
  }

  /**
   * Renomme le canal d'une ligne — dans Slack ET au registre, en un seul geste.
   *
   * Les deux ensemble, jamais l'un sans l'autre : un renommage fait à la main dans Slack
   * laisse le registre sur l'ancien nom, et l'état affiché cesse de correspondre à ce que
   * le dirigeant voit dans son espace.
   */
  async renommer({ chantier, worktree, titre, canal_id: canalId, pane }) {
    const ligne = canalId ? ligneParCanal(this.registre, canalId) : ligneOuverteParCle(this.registre, chantier, worktree);
    const refus = this.refusSurCommun('renommer', canalId, ligne?.canal_id);
    if (refus) return refus;
    if (!ligne) return { ok: false, erreur: `aucune ligne pour « ${chantier || canalId} »` };
    // Le nom d'un canal est ce que le dirigeant voit dans sa barre latérale, et sur une ligne
    // cliente c'est aussi la SIGNATURE de chaque message : un pair ne le change pas.
    const refusPairRenom = this.refusDuPair('renommer', ligne, pane);
    if (refusPairRenom) return refusPairRenom;
    if (!titre) return { ok: false, erreur: 'titre requis' };
    // MÊME GARDE QUE `fermer`, ET C'EST LA PORTE QUE LE PREMIER CORRECTIF AVAIT LAISSÉE —
    // relevée en revue de fond, sur le lot qui corrigeait précisément « une porte sur deux ».
    //
    // `ligneParCanal` retombe volontairement sur la ligne CLOSE quand aucune n'est ouverte, pour
    // pouvoir répondre « c'est clos » à qui écrit. `renommer --canal <id>` atteint donc n'importe
    // quelle ligne close SANS aucune course : le canal d'un client parti serait renommé sous ses
    // yeux — il en reste membre, un canal client ne s'archive jamais — et le libellé de la ligne
    // close écrasé au registre, c'est-à-dire l'historique réécrit.
    if (ligne.close_le) {
      return { ok: false, erreur: `la ligne de « ${ligne.chantier} » est close depuis ${ligne.close_le} — son canal ne se renomme plus` };
    }

    // Sur une ligne cliente, le titre nomme DEUX choses : le canal, et l'expéditeur de
    // chaque message. Ne suivre que la première laisserait le canal dire « Espace client
    // Acme » pendant que chaque message continue d'être signé de l'ancien libellé — et le
    // décalage passerait d'autant plus inaperçu qu'il n'est visible que côté client.
    //
    // Mis à jour AVANT la sortie « nom inchangé » : deux titres différents peuvent mener au
    // même nom de canal (la normalisation aplatit accents, casse et ponctuation), et c'est
    // précisément là qu'un renommage n'aurait servi à rien.
    if (natureDe(ligne) === 'client') {
      ligne.libelle = String(titre).trim();
      sauverRegistre(this.registre);
    }

    const pris = nomsPris(this.registre);
    pris.delete(ligne.canal_nom); // son propre nom ne se fait pas concurrence
    const nom = nomDeCanal(libelleDeCanal(ligne.chantier, titre), (n) => pris.has(n));
    if (nom === ligne.canal_nom) return { ok: true, inchange: true, canal: nom };

    const ancien = ligne.canal_nom;
    const d = await this.slack.renommerCanal(this.jetons.robot, ligne.canal_id, nom);
    ligne.canal_nom = d.nom;
    sauverRegistre(this.registre);
    journaliser(`canal renommé — ${ligne.chantier} : #${ancien} → #${d.nom}`);
    return { ok: true, inchange: false, avant: ancien, canal: d.nom };
  }

  async fermer({ chantier, worktree, bilan, archiver = true, canal_id: canalId, pane }) {
    // `fermer` porte un bilan qu'il POSTE, et il archive : les deux gestes qu'on ne veut voir
    // ni l'un ni l'autre sur le canal de tous les agents.
    const ligne = canalId ? ligneParCanal(this.registre, canalId) : ligneOuverteParCle(this.registre, chantier, worktree);
    const refus = this.refusSurCommun('fermer', canalId, ligne?.canal_id);
    if (refus) return refus;
    if (!ligne) return { ok: false, erreur: `aucune ligne ouverte pour « ${chantier || canalId} »` };
    // `fermer` POSTE UN BILAN ET ARCHIVE : les deux gestes qu'un pair ne doit pas pouvoir
    // exercer sur le chantier de quelqu'un d'autre.
    const refusPair = this.refusDuPair('fermer', ligne, pane);
    if (refusPair) return refusPair;
    // UNE LIGNE DÉJÀ CLOSE NE SE REFERME PAS DEUX FOIS, et la garde est arrivée avec le chemin
    // par canal (T-20260813-0078). Par chantier, `ligneOuverteParCle` ne rendait QUE des lignes
    // ouvertes ; `ligneParCanal`, lui, retombe volontairement sur la plus récemment close — pour
    // pouvoir répondre « c'est clos » à qui écrit. Sans ce contrôle, `fermer` aurait posté son
    // bilan dans un canal archivé (donc en lecture seule : le bilan perdu, sans un mot) et
    // rejoué l'archivage d'un canal déjà clos.
    if (ligne.close_le) {
      return { ok: false, erreur: `la ligne de « ${ligne.chantier} » est déjà close depuis ${ligne.close_le}` };
    }
    // ═══ LE BILAN EST DU CONTENU DE SYNTHÈSE — coûts, arbitrages, ce qui reste. C'est le SEUL
    // geste qui en pose systématiquement, et il n'était gardé par rien : « une porte sur deux »,
    // relevé en revue de fond sur ce lot même. Le scénario : un chantier court, aucun `dire`
    // jamais appelé, un externe entré entre l'ouverture et la clôture.
    //
    // ⚠️ ON RETIENT LE BILAN, ON NE BLOQUE PAS LA FERMETURE. « Un canal compromis qu'on continue
    // d'alimenter est pire qu'un canal fermé » — donc on cesse d'écrire, pas de fermer. Refuser
    // la clôture laisserait l'agent attaché à un canal qu'il ne doit plus alimenter.
    const veille = await this.veillerAvantDEcrire(ligne);
    const bilanRetenu = Boolean(bilan && veille.refus);
    if (bilan && !veille.refus) {
      await this.slack.poster(this.jetons.robot, {
        canal: ligne.canal_id,
        texte: bilan,
        nom: libelleDeLigne(ligne),
        emoji: ligne.visage,
      });
    }
    // ORDRE IMPOSÉ PAR SLACK, mesuré : un canal archivé est en LECTURE SEULE. Le bilan
    // doit donc partir AVANT l'archivage — l'inverse perd le message sans rien dire.
    //
    // ET UN CANAL CLIENT NE S'ARCHIVE PAS, MÊME ICI. La règle porte sur le canal, pas sur
    // le chemin qui y mène : qu'on disparaisse ou qu'on referme volontairement, il
    // appartient toujours au client. Refermer sa ligne veut dire « je n'écoute plus », pas
    // « ce lieu n'existe plus » — et l'archivage est irréversible pour nous (voir
    // `CanalArchive` : le désarchivage est refusé au jeton dont nous disposons).
    //
    // Les chemins qui archivent sont énumérés et gardés : `fermer` et `reconcilier`, tous
    // deux éprouvés dans les deux natures. C'est ce qui empêche un troisième d'apparaître
    // en silence — trois correctifs de ce chantier n'avaient couvert qu'une porte sur deux.
    //
    // ET UNE LIGNE DURABLE NE S'ARCHIVE PAS NON PLUS (T-20260814-0085). La protection du canal
    // client ci-dessus reste une garde à part entière — elle ne bouge pas, elle ne dépend de
    // rien d'autre — mais elle ne suffisait plus : refermer une ligne INTERNE archivait son
    // canal, et rouvrir sous le même titre butait alors sur un canal que nous ne savons pas
    // désarchiver. Le 2026-08-14, une ligne d'orchestrateur y est restée morte.
    let archive = false;
    if (archiver && natureDe(ligne) !== 'client' && jetabiliteDe(ligne) === 'jetable') {
      archive = await this.slack.archiverCanal(this.jetons.robot, ligne.canal_id);
    }
    clore(this.registre, ligne.canal_id, maintenant());
    sauverRegistre(this.registre);
    journaliser(`ligne close — ${ligne.chantier} (#${ligne.canal_nom}) archive=${archive}`);
    if (bilanRetenu) journaliser(`bilan RETENU — #${ligne.canal_nom} : ${veille.refus.message}`);
    return {
      ok: true,
      canal: ligne.canal_nom,
      archive,
      ...(bilanRetenu ? { bilan_retenu: veille.refus.message } : {}),
      ...(veille.nouveaux ? { nouveaux_venus: veille.nouveaux } : {}),
    };
  }

  /**
   * Désigne le dirigeant du poste — une fois, pour tous les agents qui y naîtront.
   *
   * ON REÇOIT L'IDENTIFIANT DÉJÀ RÉSOLU, et c'est délibéré : la résolution d'un courriel en
   * membre Slack est un appel réseau, et la faire ici l'aurait mise sur le chemin de chaque
   * pose. La commande la fait une fois, en amont, exactement comme elle le fait déjà pour
   * `--inviter` et pour les autorisés du canal commun — et son échec devient alors un refus
   * de la pose, avant que rien n'ait été créé, plutôt qu'un veilleur qui rend `ok:false`
   * après coup.
   *
   * RIEN N'EST DEVINÉ D'UN COURRIEL SEUL : sans identifiant, la désignation est refusée. Une
   * désignation à moitié faite serait pire que pas de désignation du tout — elle passerait le
   * contrôle de `--au-dirigeant` et ouvrirait une ligne dont la liste d'autorisés vaut
   * `[undefined]`, c'est-à-dire une ligne où le dirigeant lui-même n'a pas la parole.
   */
  async designerDirigeantDuPoste({ id, courriel }) {
    if (!id) {
      return {
        ok: false,
        erreur:
          'aucun identifiant Slack pour ce dirigeant — rien n’est désigné. C’est l’identifiant, ' +
          'pas le courriel, qui autorise une parole : sans lui la ligne s’ouvrirait muette.',
      };
    }
    const d = designerDirigeant(this.registre, { id, courriel });
    sauverRegistre(this.registre);
    journaliser(`dirigeant du poste désigné — ${courriel || '—'} (${id})`);
    return { ok: true, dirigeant: { id: d.id, courriel: d.courriel } };
  }

  etat() {
    const ouvertes = lignesOuvertes(this.registre).map((l) => ({
      chantier: l.chantier,
      canal: l.canal_nom,
      // LA CLÉ UNIQUE, rendue à la commande pour qu'elle puisse DÉSIGNER sa ligne au lieu de la
      // faire redéduire. Sans elle, le chemin sortant n'avait que le pane — qui n'identifie
      // rien dès qu'il en porte deux (T-20260813-0078). Ce n'est pas un secret : le registre
      // est celui du poste, et l'identifiant de canal est déjà lisible dans Slack.
      canal_id: l.canal_id,
      nature: natureDe(l),
      pane: l.pane,
      // LE SECOND PORTEUR, RENDU TEL QUEL — c'est ce qui rend la ligne désignable depuis le pane
      // du gestionnaire : la commande fait sa sélection sur `etat().ouvertes`, et `panesDeLigne`
      // y lit `pair.pane` exactement comme il le lit au registre. L'omettre ici aurait donné une
      // ligne partagée au registre et introuvable depuis la commande — un partage qui n'existe
      // que du côté qui ne s'en sert pas.
      pair: l.pair ? { role: l.pair.role, nom: l.pair.nom, pane: l.pair.pane } : null,
      worktree: l.worktree,
      depuis: l.ouverte_le,
    }));
    // LE CANAL COMMUN EST RENDU À CÔTÉ DE `ouvertes`, JAMAIS DEDANS. C'est la même règle que
    // celle du registre, et pour la même raison : `ouvertes` est ce que la commande parcourt
    // pour savoir de quelle ligne un agent parle. Un canal commun qui s'y glisserait
    // deviendrait un candidat de cette sélection.
    const communs = canauxCommuns(this.registre)
      .filter((c) => c.role)
      .map((c) => ({ role: c.role, canal: c.canal_nom, autorises: (c.autorises || []).length }));
    // LE CANAL D'AVANT EST NOMMÉ À PART, ET C'EST TOUT LE POINT. Désigné par une version qui ne
    // connaissait pas les rôles, il ne diffuse plus rien — mais s'il ne se voyait nulle part,
    // l'opérateur chercherait pourquoi ses consignes ne partent plus sur le seul canal qu'il
    // avait posé. C'est le silence exact que ce dispositif existe pour supprimer.
    const orphelin = canalCommunSansRole(this.registre);
    return {
      ok: true,
      espace: this.identite.equipe,
      connecte: this.ws?.readyState === CONNEXION_OUVERTE,
      ouvertes,
      communs,
      sans_role: orphelin
        ? {
            canal: orphelin.canal_nom,
            message:
              `#${orphelin.canal_nom} a été désigné avant que les canaux aient un rôle : il ne diffuse plus ` +
              `rien (personne ne saurait à qui), mais rien n'y remonte non plus. Redésigne-le pour un rôle ` +
              `(« ligne-directe commun ${orphelin.canal_nom} --role <rôle> --dirigeant … »).`,
          }
        : null,
      // LE DIRIGEANT EST RENDU COMME UNE PRÉSENCE, PAS COMME UNE ADRESSE. Ce que l'appelant a
      // besoin de savoir, c'est « le poste sait à qui ouvrir la ligne » — jamais qui c'est.
      // Rendre le courriel ici l'aurait fait ressortir dans chaque `etat` d'un dépôt client,
      // c'est-à-dire à l'endroit précis d'où ce lot cherche à le tenir.
      dirigeant: dirigeantDuPoste(this.registre) ? { designe: true } : null,
    };
  }

  // —————————————————————————————————————————————————————————————— écoute permanente

  /**
   * Le chien de garde — et il n'est pas une ceinture de sécurité, il est la ceinture.
   *
   * MESURÉ : la connexion d'écoute est tombée et n'est JAMAIS revenue. Se reposer sur
   * l'événement de fermeture suppose qu'il arrive toujours ; sur un portable, il n'arrive
   * pas — le Mac se met en veille, le réseau change, et la connexion meurt à moitié : plus
   * rien ne transite, aucun événement n'est émis, et le veilleur se croit à l'écoute.
   *
   * Personne ne s'en aperçoit : le dirigeant écrit, rien ne se passe, rien ne le dit. La
   * seule défense est de VÉRIFIER périodiquement plutôt que d'attendre qu'on nous prévienne.
   */
  surveiller(cadence = SURVEILLANCE) {
    clearInterval(this.chienDeGarde);
    this.chienDeGarde = setInterval(() => {
      if (this.arrete) return;
      const etat = this.ws?.readyState;
      if (etat === CONNEXION_OUVERTE || etat === CONNEXION_EN_COURS) return;
      journaliser(`chien de garde : plus d'écoute (état ${etat ?? 'aucun'}) — on rétablit`);
      this.attente = RECONNEXION_MIN;
      this.connecterSlack();
    }, cadence);
    this.chienDeGarde.unref?.();
    return this.chienDeGarde;
  }

  connecterSlack() {
    if (this.arrete) return;
    // TROISIÈME MUR, et le dernier avant la connexion elle-même. Il se lève AVANT tout
    // appel : un veilleur né sous tests ne doit pas même demander son adresse d'écoute.
    if (enEssais() && !transportRemplace(ECOUTE_NATIVE, globalThis.WebSocket)) {
      refuser(
        'l’ouverture de la connexion d’écoute',
        'Un veilleur né sous tests capterait les messages destinés aux lignes de production.'
      );
    }
    // Ne jamais empiler deux connexions : le chien de garde et l'événement de fermeture
    // peuvent viser en même temps, et deux écoutes remettraient chaque message en double.
    if (this.ws && (this.ws.readyState === CONNEXION_OUVERTE || this.ws.readyState === CONNEXION_EN_COURS)) return;
    if (this.connexionEnCours) return;
    this.connexionEnCours = true;
    this.slack
      .ouvrirEcoute(this.jetons.ecoute)
      .then((url) => {
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.addEventListener('open', () => {
          this.attente = RECONNEXION_MIN;
          this.connexionEnCours = false;
          journaliser('écoute permanente établie');
        });
        ws.addEventListener('message', (evt) => this.surMessage(evt, ws));
        ws.addEventListener('close', () => {
          this.connexionEnCours = false;
          this.reconnecter('connexion fermée');
        });
        ws.addEventListener('error', () => {
          /* le `close` qui suit déclenche la reconnexion */
        });
      })
      .catch((err) => {
        this.connexionEnCours = false;
        this.reconnecter(`ouverture refusée : ${err.message}`);
      });
  }

  reconnecter(raison) {
    if (this.arrete) return;
    journaliser(`reconnexion dans ${Math.round(this.attente / 1000)}s — ${raison}`);
    const delai = this.attente;
    this.attente = Math.min(this.attente * 2, RECONNEXION_MAX);
    setTimeout(() => this.connecterSlack(), delai).unref?.();
  }

  async surMessage(evt, ws) {
    try {
      await this.traiterTrame(evt, ws);
    } catch (err) {
      // BLOQUANT relevé en revue : un rejet qui s'échappait d'ici n'était rattrapé par
      // personne — rejet non géré, processus à terre. Et l'enveloppe ayant déjà été
      // acquittée, Slack ne rejouait jamais le message : perdu, définitivement, en
      // silence. Rien ne doit sortir de ce listener.
      journaliser(`trame non traitée : ${err?.message || err}`);
    }
  }

  async traiterTrame(evt, ws) {
    let trame;
    try {
      trame = JSON.parse(evt.data);
    } catch {
      return;
    }
    // Slack veut un accusé de réception par enveloppe, sinon il rejoue le message.
    if (trame.envelope_id) ws.send(JSON.stringify({ envelope_id: trame.envelope_id }));
    if (trame.type === 'disconnect') {
      ws.close();
      return;
    }
    if (trame.type !== 'events_api') return;

    const ev = trame.payload?.event;
    if (!ev || ev.type !== 'message') return;
    // Nos propres messages ne repartent jamais dans la boucle.
    if (ev.bot_id) return;
    // LE SOUS-TYPE NE DISQUALIFIAIT PAS UNE TRAME, IL LA FAISAIT DISPARAÎTRE. Tout sous-type
    // était écarté ici — donc `file_share`, c'est-à-dire TOUT MESSAGE PORTANT UNE PIÈCE
    // JOINTE. Un client qui signale un problème dépose sa capture avant d'écrire trois
    // phrases : il ne recevait rien, et l'agent ignorait qu'on lui avait parlé.
    //
    // On énumère donc ce qui EST une parole, jamais ce qui ne l'est pas : une liste de
    // sous-types à exclure oublie celui que Slack ajoutera, et l'oubli irait dans le mauvais
    // sens — une entrée dans un canal remise à l'agent, un client à qui l'on répond parce
    // qu'il a changé le sujet du canal.
    // UN MESSAGE REPRIS PAR SON AUTEUR A SON PROPRE CHEMIN, et il ne pouvait pas en être
    // autrement : la trame de `message_changed` ne porte rien à sa racine — ni texte, ni
    // auteur. Le message vit sous `ev.message`, le canal reste sur l'enveloppe. L'ajouter à la
    // liste blanche aurait donc remis à l'agent un message vide, ce qui est une autre façon de
    // ne rien lui dire.
    if (ev.subtype === 'message_changed') {
      await this.remettreLaReprise(ev);
      return;
    }
    if (ev.subtype && !SOUS_TYPES_PAROLE.has(ev.subtype)) return;
    if (ev.user === this.identite.utilisateur) return;

    await this.remettreAuChantier(ev);
  }

  /**
   * Un message que son auteur a repris — corrigé, complété, précisé.
   *
   * HUITIÈME CHEMIN MUET, relevé en revue après le septième : un client qui écrit de son
   * téléphone se relit et complète. C'est un geste ordinaire, et il n'était entendu de
   * personne — ni remis, ni répondu, ni journalisé, comme le septième.
   *
   * LE PIÈGE INVERSE EST TOUT AUSSI RÉEL, et c'est pour ça qu'on compare les textes : Slack
   * émet exactement la même trame quand il attache LUI-MÊME l'aperçu d'un lien, sans que
   * personne n'ait rien écrit. Remettre celle-là ferait recevoir deux fois le même message à
   * l'agent — qui répondrait deux fois, sous les yeux du client.
   */
  async remettreLaReprise(ev) {
    const message = ev.message;
    if (!message) return;
    if (message.bot_id || message.user === this.identite.utilisateur) return;

    const avant = (ev.previous_message?.text || '').trim();
    const apres = (message.text || '').trim();
    const memesPieces = (ev.previous_message?.files || []).length === (message.files || []).length;
    if (avant === apres && memesPieces) return; // rien n'a été dit : un aperçu, une épingle…

    await this.remettreAuChantier({ ...message, channel: ev.channel, subtype: undefined, modifie: true });
  }

  /**
   * Le message du dirigeant vers le pane de son agent — et la réponse quand il n'y a
   * personne au bout du fil. C'est ici que se joue la promesse « je ne parle jamais dans
   * le vide » : chaque écriture reçoit une suite, réponse de l'agent ou explication.
   */
  async remettreAuChantier(ev) {
    // LA CONSIGNE COMMUNE SE DÉTOURNE ICI, avant toute lecture de ligne — et l'endroit est
    // choisi : la reprise d'un message (`remettreLaReprise`) repasse par cette méthode, donc
    // une consigne corrigée par son auteur est rediffusée sans qu'on ait à y penser.
    if (estCanalCommun(this.registre, ev.channel)) {
      await this.diffuserConsigne(ev);
      return;
    }

    const ligne = ligneParCanal(this.registre, ev.channel);
    if (!ligne) {
      await this.canalSansLigne(ev);
      return;
    }

    const texte = (ev.text || '').trim();
    // DEUX FORMES POUR LA MÊME CHOSE, et n'en lire qu'une rouvre le trou qu'on vient de
    // fermer : Slack envoie une liste `files`, et a longtemps envoyé — envoie encore — un
    // champ `file` unique. Un message qui ne porte que le second passerait pour vide, et son
    // auteur s'entendrait répondre que son message n'avait rien dedans, sa capture à la main.
    const fichiers = Array.isArray(ev.files) ? ev.files : ev.file ? [ev.file] : [];

    // Qui parle ? Le cadre que reçoit l'agent donne à ce texte l'autorité du dirigeant : on
    // ne remet donc que ce qui vient de quelqu'un que la nature de la ligne autorise.
    if (!(await this.autorise(ligne, ev.user))) {
      journaliser(`écarté — #${ligne.canal_nom} : ${ev.user} n'est pas autorisé sur cette ligne`);
      // RA-REL-009 — un message non remis laisse une trace ET celui qui l'a écrit l'apprend.
      //
      // C'était le SEUL chemin de non-remise qui se terminait sans rien dire à personne :
      // ligne close, agent disparu, herdr injoignable et échec de remise répondent tous
      // déjà dans le canal. Un journal sur le disque du poste n'est pas une trace que
      // l'auteur du message peut lire — il croyait avoir été entendu et attendait une
      // réponse qui ne serait jamais venue.
      //
      await this.repondreEnPropre(ligne, 'non_autorise');
      return;
    }

    if (ligne.close_le) {
      await this.repondreEnPropre(ligne, 'ligne_close');
      return;
    }

    // RIEN À REMETTRE N'EST PAS UNE RAISON DE SE TAIRE. Un texte vide sortait d'ici sans un
    // mot ; l'auteur croyait avoir été entendu et attendait une réponse qui ne viendrait
    // jamais. Le contrôle arrive APRÈS l'autorisation, volontairement : dire à un intrus que
    // son message était vide lui cacherait la vraie cause et le ferait retenter.
    //
    // Une pièce jointe SANS un mot reste une parole — c'est même la façon la plus fréquente
    // dont un client signale un problème. Ce n'est donc pas la présence de texte qui décide,
    // c'est l'absence de tout.
    if (!texte && !fichiers.length) {
      journaliser(`message vide — #${ligne.canal_nom} : ni texte ni pièce jointe, rien à remettre`);
      await this.repondreEnPropre(ligne, 'message_vide');
      return;
    }

    // Un herdr injoignable N'EST PAS un agent mort : la session peut être momentanément
    // absente. Le confondre refermait la ligne d'un agent bien vivant — et, avant ça,
    // laissait échapper un rejet qui mettait le veilleur à terre.
    let present;
    try {
      present = await this.herdr.vivant(ligne.pane, { socket: ligne.herdr_socket });
    } catch (err) {
      await this.repondreEnPropre(ligne, 'agent_injoignable', { erreur: err.message });
      journaliser(`herdr injoignable — #${ligne.canal_nom} : ${err.message}`);
      return;
    }
    if (!present) {
      clore(this.registre, ligne.canal_id, maintenant());
      sauverRegistre(this.registre);
      await this.repondreEnPropre(ligne, 'agent_disparu');
      journaliser(`ligne close d'office — agent disparu (${ligne.chantier}, pane ${ligne.pane})`);
      return;
    }

    // LES PIÈCES SE RECUEILLENT APRÈS avoir vérifié qu'il y a quelqu'un au bout du fil, et
    // l'ordre n'est pas un détail : rapatrier la capture d'écran d'un client — souvent une
    // donnée personnelle — pour la déposer sur le disque d'un poste dont l'agent est mort
    // serait écrire pour personne, en prenant le risque pour rien.
    const { pieces, refus } = await this.recueillirPieces(ligne, fichiers);

    let remise;
    try {
      // On remet la parole CADRÉE, jamais brute : un agent qui reçoit un message nu répond
      // dans son terminal, et son interlocuteur conclut que rien n'est arrivé.
      //
      // Le cadre suit la NATURE de la ligne : sur une ligne cliente, il nomme l'auteur réel
      // et rappelle à l'agent que ces mots sont une demande, pas une consigne du dirigeant.
      remise = await this.herdr.remettre(
        ligne.pane,
        cadrerPourAgent({
          chantier: ligne.chantier,
          texte,
          canal: ligne.canal_nom,
          nature: natureDe(ligne),
          auteur: await this.nomDeLAuteur(ligne, ev.user),
          pieces,
          piecesManquantes: refus.length,
          modifie: Boolean(ev.modifie),
        }),
        { socket: ligne.herdr_socket }
      );
      journaliser(`remis — #${ligne.canal_nom} → ${ligne.pane} (${texte.length} car., ${pieces.length} pièce(s))`);

      // ═══ LE CROCHET, ET SEULEMENT SI L'AGENT A PRIS (T-20260815-0011).
      //
      // Le dirigeant écrivait « allo » pour savoir s'il avait été entendu. Ce fait — « il l'a » —
      // le veilleur l'avait déjà : il ne le disait qu'à un journal que personne ne lit.
      //
      // ⚠️ LA FRONTIÈRE EST UN CRAN PLUS LOIN QU'ON NE CROIT, et c'est le dirigeant qui l'a
      // corrigée : « des fois le message est passé mais reste dans ton champ de prompt ». Écrire
      // dans le pane n'est PAS être pris. Mesuré le 2026-08-15 : trois panes sur trois portaient
      // un message jamais soumis, dont un de lui, et les trois agents avaient l'air d'avoir fini.
      //
      // On ne pose donc le crochet que sur le verdict de PRISE que la remise établit en relisant
      // le pane. Sans lui, PAS de crochet — et c'est cette absence qui rend le silence lisible.
      if (remise?.pris) {
        const pose = await this.slack.poserCrochet(this.jetons.robot, ev.channel, ev.ts);
        if (!pose) journaliser(`crochet non posé — #${ligne.canal_nom} (le message est bien arrivé)`);
      } else {
        journaliser(`crochet NON posé — #${ligne.canal_nom} → ${ligne.pane} : la prise n'a pas été constatée`);
      }
    } catch (err) {
      await this.repondreEnPropre(ligne, 'echec_remise', { erreur: err.message });
      journaliser(`ÉCHEC de remise — #${ligne.canal_nom} → ${ligne.pane} : ${err.message}`);
      return;
    }

    // CE QUI N'EST PAS PASSÉ SE DIT — après la remise, jamais à sa place (RA-REL-010).
    //
    // Une seule phrase par RAISON, pas par fichier : trois pièces refusées pour le même motif
    // n'apprennent rien de plus que la première, et un lieu de conversation qu'on inonde cesse
    // d'être lu — ce qui reviendrait à perdre le message suivant.
    //
    // Chaque cause est nommée à son propre point d'appel, en toutes lettres. C'est plus long
    // qu'une boucle, et c'est voulu : la garde structurelle qui empêche une phrase interne de
    // partir chez un client lit les points d'appel, pas les variables qui les traversent.
    const causes = new Set(refus.map((r) => r.cause));
    if (causes.has('piece_trop_lourde')) await this.repondreEnPropre(ligne, 'piece_trop_lourde');
    if (causes.has('piece_type_refuse')) await this.repondreEnPropre(ligne, 'piece_type_refuse');
    if (causes.has('piece_non_recuperee')) {
      const detail = refus.find((r) => r.cause === 'piece_non_recuperee');
      await this.repondreEnPropre(ligne, 'piece_non_recuperee', { erreur: detail?.detail });
    }
  }

  /**
   * Une consigne du dirigeant, remise aux agents DU RÔLE de ce canal qui travaillent en ce
   * moment — et à eux seuls.
   *
   * PERSONNE NE S'ABONNE, ET C'EST LE CŒUR DE LA CONCEPTION. On aurait pu faire inscrire les
   * agents un à un — c'était le chemin naturel, et c'était le piège : une inscription veut dire
   * une seconde écoute par pane, donc une seconde entrée quelque part, donc un second candidat
   * à la sélection par pane du chemin sortant. C'est très exactement le défaut mesuré des deux
   * lignes, rejoué par le mécanisme censé aider. Et « les agents d'un rôle » serait devenu
   * « ceux qui ont pensé à s'inscrire ».
   *
   * On demande donc à herdr qui vit MAINTENANT, et on retient ceux dont le LIEU établit le rôle.
   * Rien n'est écrit au registre : ni ligne, ni abonnement, ni pane. La ligne propre de chaque
   * agent est intouchée, au sens strict — aucune structure qu'elle emprunte n'a changé.
   *
   * ─────────────────────────────────────────────────────────────────────────────────────
   * À QUI, ET COMMENT ON LE SAIT (T-20260814-0002)
   *
   * Le lot précédent remettait à tous. La source a corrigé : « on parle aux orchestrateurs et
   * ils retransmettent, on ne parle jamais au chef d'équipe ». Le rôle se lit donc dans le LIEU
   * depuis lequel l'agent tourne — `foreground_cwd`, puis `roleDuLieu`, qui exige les quatre
   * fichiers de la pose ET les en-têtes réels du métier. Ni son nom herdr (une chaîne libre), ni
   * le dossier qui le porte (une convention de nommage), ni sa ligne au registre (qui ne dit
   * rien du rôle).
   *
   * ⚠️ CE QUI NE S'ÉTABLIT PAS NE REÇOIT RIEN. Un chef d'équipe tourne dans un worktree
   * ordinaire : `roleDuLieu` rend `null`, il est hors de la remise sans qu'on ait rien à
   * exclure nommément. Un lieu à demi posé, un agent sans répertoire, un rôle nouveau que ce
   * canal ne vise pas : tous silencieux, par le même chemin. Il faut ajouter du code pour
   * diffuser, jamais pour se taire — et c'est l'inverse du mode de panne de `D-20260813-0001`
   * §1, où des consignes venues de nulle part étaient exécutées jusqu'à cinq fois sur six.
   *
   * RIEN N'EST POSTÉ DANS CE CANAL, JAMAIS — ni refus, ni accusé, ni compte rendu de diffusion.
   * C'est une exception assumée à RA-REL-009 (« celui qui écrit apprend que son message n'est
   * pas passé »), et elle se justifie par l'audience : une réponse ici serait lue par tous les
   * agents à la fois, et un canal d'urgence qu'on encombre est un canal qu'on cesse de lire
   * (RA-REL-008) — ce qui coûterait la consigne SUIVANTE. Ce qui ne passe pas va au journal.
   */
  async diffuserConsigne(ev) {
    const commun = communPourCanal(this.registre, ev.channel);
    if (!commun) return; // le canal n'est plus commun : `remettreAuChantier` a déjà tranché
    const texte = (ev.text || '').trim();

    // UN CANAL SANS RÔLE NE DIFFUSE PAS — celui que v1.42.0 avait désigné avant que les canaux
    // en aient un. On ne peut pas lui en deviner un : « probablement tout le monde » est très
    // exactement ce que ce lot supprime, et ce serait le rétablir au pire endroit. Il reste
    // gardé en écriture ; `etat()` le nomme pour que personne ne cherche pourquoi rien n'en part.
    if (!commun.role) {
      journaliser(
        `consigne non diffusée — #${commun.canal_nom} : ce canal a été désigné sans rôle, on ne sait pas ` +
          `à qui le remettre. Redésigne-le (« ligne-directe commun ${commun.canal_nom} --role <rôle> … »).`
      );
      return;
    }

    // Qui a le droit de parler à tous. La liste est la seule autorisation : le canal est
    // interne et public, y lire l'appartenance reviendrait à autoriser l'espace entier.
    if (!ev.user || !(commun.autorises || []).includes(ev.user)) {
      journaliser(`consigne écartée — #${commun.canal_nom} : ${ev.user || 'auteur inconnu'} n'est pas autorisé`);
      return;
    }

    // LES PIÈCES JOINTES NE SUIVENT PAS. Une consigne est une phrase ; rapatrier un fichier
    // pour le déposer sur le poste autant de fois qu'il y a d'agents coûterait le réseau et le
    // disque pour un usage que personne n'a demandé. Un message qui ne porte QUE des pièces
    // n'a donc rien à diffuser — et on ne le dit pas dans le canal, on le dit au journal.
    if (!texte) {
      journaliser(`consigne sans texte — #${commun.canal_nom} : rien à diffuser (les pièces ne suivent pas ce canal)`);
      return;
    }

    let vivants;
    try {
      vivants = await this.herdr.agents();
    } catch (err) {
      journaliser(`consigne non diffusée — #${commun.canal_nom} : herdr injoignable (${err.message})`);
      return;
    }
    if (!vivants.length) {
      journaliser(`consigne non diffusée — #${commun.canal_nom} : aucun agent au travail en ce moment`);
      return;
    }

    // LE FILTRE, ET IL TIENT TOUT LE LOT. `foreground_cwd` d'abord — c'est le répertoire du
    // processus au premier plan, donc celui où `claude` tourne vraiment, donc celui qui a décidé
    // quel métier la session a chargé ; `cwd` est celui du shell du pane, qui peut rester en
    // arrière. Même lecture que le réveil horaire des orchestrateurs, à dessein : trois
    // décisions qui portent sur le rôle, une seule définition de ce qu'est un rôle.
    const destinataires = vivants.filter((a) => roleDuLieu(a.foreground_cwd || a.cwd) === commun.role);
    const eux = libellePluriel(commun.role);
    if (!destinataires.length) {
      // On NE SE RABAT PAS sur les autres agents : ce serait remettre la consigne d'un rôle à
      // ceux qu'elle ne concerne pas, c'est-à-dire le canal unique qu'on vient de remplacer.
      journaliser(`consigne non diffusée — #${commun.canal_nom} : aucun des ${eux} au travail en ce moment`);
      return;
    }

    const cadre = cadrerConsigneCommune({
      texte,
      canal: commun.canal_nom,
      // LE RÔLE VIENT DU CANAL, jamais d'un destinataire : un seul cadre est composé pour toute
      // la diffusion, et le prendre sur le premier servi ferait porter aux suivants une étiquette
      // qui n'est pas la leur le jour où le filtre laisserait passer autre chose.
      role: commun.role,
      modifie: Boolean(ev.modifie),
    });
    let remis = 0;
    const echecs = [];
    /** Ceux à qui le texte a été écrit sans qu'on puisse constater qu'ils l'ont pris. */
    const nonProuves = [];
    for (const agent of destinataires) {
      try {
        // ⚠️ ON LIT LE VERDICT DE PRISE ICI AUSSI — relevé en revue de fond. Ce chemin payait
        // déjà le coût de la vérification (la remise l'établit pour tous ses appelants) et
        // jetait la réponse : `remis` s'incrémentait sur la seule absence d'exception, soit
        // très exactement le défaut que ce lot ferme sur le chemin d'à côté.
        //
        // Une consigne coincée dans le pane d'un orchestrateur était donc comptée « remise ».
        // La machinerie qui le savait tournait à côté, sans que personne l'écoute.
        const r = await this.herdr.remettre(agent.pane_id, cadre, { socket: agent.herdr_socket });
        // ⚠️ ON EXIGE LE VERDICT, PAS L'ABSENCE DE DÉMENTI — relevé en revue de fond de
        // `T-20260815-0021`, et c'est encore la porte jumelle : ce chemin lisait
        // `pris === false`, donc un `remettre` qui ne rend RIEN repassait pour « remis ».
        // C'est exactement la forme que l'ancien double d'essai rendait (`{ delivered: true }`),
        // et c'est ainsi que le défaut d'à côté a survécu à une suite verte.
        if (!r?.pris) {
          // Pas un échec — le texte est peut-être arrivé — mais pas une remise prouvée non
          // plus. On ne le compte pas parmi les remis, et on le DIT plutôt que de l'arrondir.
          nonProuves.push(agent.pane_id);
          journaliser(`consigne écrite mais prise NON constatée — ${agent.pane_id}`);
        } else {
          remis += 1;
        }
      } catch (err) {
        // UN AGENT QUI NE REÇOIT PAS N'EN EMPÊCHE AUCUN AUTRE. Une consigne qui s'arrête au
        // premier pane mort n'atteindrait qu'une partie du poste, et rien ne dirait laquelle.
        echecs.push(agent.pane_id);
        journaliser(`consigne non remise à ${agent.pane_id} : ${err.message}`);
      }
    }
    // Le dénominateur est le nombre de DESTINATAIRES, pas d'agents vivants : « 2/9 » ferait
    // lire une diffusion à moitié perdue là où sept agents étaient simplement hors périmètre.
    journaliser(
      `consigne diffusée — #${commun.canal_nom} → ${remis}/${destinataires.length} ${eux} ` +
        `(${vivants.length} agent(s) au travail)${echecs.length ? `, échec sur ${echecs.join(', ')}` : ''}` +
        `${nonProuves.length ? `, prise non constatée chez ${nonProuves.join(', ')}` : ''}`
    );
    return {
      remis,
      echecs,
      ...(nonProuves.length ? { non_prouves: nonProuves } : {}),
      role: commun.role,
      destinataires: destinataires.length,
    };
  }

  /**
   * Un message arrivé dans un canal dont AUCUNE ligne n'est au registre.
   *
   * « Canal qui ne nous regarde pas » : c'est ce que disait le commentaire, et c'était vrai
   * d'un canal d'équipe. Ça ne l'est pas du canal PRIVÉ d'un client — on ne s'invite pas
   * soi-même dans un canal privé, on nous y a mis à la main. Un registre reparti à vide (il le
   * fait quand il est illisible) suffit à produire la situation, et le client, lui, continue
   * d'écrire dans le silence le plus complet des trois directions.
   *
   * LA NATURE DU CANAL TRANCHE, et il fallait un critère qui ne demande rien à personne :
   *   - **public** → un canal d'équipe où notre robot ne fait que figurer. On se tait, sinon
   *     la ligne devient un importun qui répond à chaque phrase du salon commun ;
   *   - **privé** → presque à coup sûr un client orphelin. On lui répond, dans SON registre de
   *     langage : la ligne perdue est notre affaire, pas la sienne.
   *
   * La nature est demandée UNE FOIS par canal et retenue : sans ce cache, un canal d'équipe
   * actif ferait un appel Slack par message, sur une méthode plafonnée.
   */
  async canalSansLigne(ev) {
    let canal = this.canauxEtrangers.get(ev.channel);
    if (!canal) {
      try {
        canal = await this.slack.infoCanal(this.jetons.robot, ev.channel);
      } catch (err) {
        // On ne peut pas classer ce canal : se taire est le moindre risque — répondre dans un
        // salon d'équipe est visible de tous, et se répéterait à chaque message.
        journaliser(`canal ${ev.channel} inclassable (${err.message}) — aucune réponse par prudence`);
        return;
      }
      this.canauxEtrangers.set(ev.channel, canal);
      if (!canal.prive) journaliser(`canal #${canal.nom} sans ligne, public — on n'y répond pas`);
    }
    if (!canal.prive) return;

    journaliser(
      `message sur #${canal.nom} (${ev.channel}) : canal privé ABSENT du registre — ` +
        `non remis, son auteur en est informé`
    );
    // Une ligne le temps de répondre, et rien de plus : elle n'entre pas au registre — on ne
    // sait pas à quel chantier ce canal appartenait, et l'inventer serait pire que l'oublier.
    // Sa nature est cliente parce que c'est le seul registre de langage présentable à
    // quelqu'un qu'on ne sait pas identifier : il n'y a rien à lui apprendre de nos rouages.
    const etrangere = { canal_id: ev.channel, canal_nom: canal.nom, nature: 'client', libelle: canal.nom };
    await this.repondreEnPropre(etrangere, 'ligne_inconnue', { canal: canal.nom });
  }

  /**
   * Rapatrie ce que le client a déposé, et rend le compte de ce qui n'a pas suivi.
   *
   * NE LÈVE JAMAIS. C'est la propriété qui compte de toute cette méthode : ce qui accompagne
   * un message ne conditionne jamais son arrivée. Perdre trois phrases parce qu'une image n'a
   * pas pu être rapatriée transforme un incident mineur en conversation manquée.
   *
   * Deux refus se prononcent AVANT tout appel réseau — la taille et le type sont annoncés par
   * Slack, et les deux limites sont celles du registre des demandes. Rapatrier six mégaoctets
   * pour les refuser ensuite coûterait le réseau, la mémoire, et déposerait sur le poste une
   * donnée personnelle qu'on ne pourrait pas utiliser.
   *
   * CE QUI VA AU JOURNAL EST LE FAIT, JAMAIS LE CONTENU — ni les octets, ni même le NOM du
   * fichier : « bilan-sanguin-jean-tremblay.png » en dit déjà trop, et un journal se lit, se
   * copie et survit plus longtemps que la conversation.
   */
  async recueillirPieces(ligne, fichiers) {
    const pieces = [];
    const refus = [];
    for (const recu of fichiers) {
      // UN OBJET TROP PAUVRE SE COMPLÈTE AVANT DE SE JUGER. Un objet caviardé n'a ni nom ni
      // type : le refuser sur cette absence rendrait un refus DÉFINITIF de type sur une
      // capture d'écran valable, et le client ne la renverrait jamais. On demande sa fiche.
      let fichier = recu;
      if (pieceACompleter(recu)) {
        try {
          fichier = (await this.slack.infoFichier(this.jetons.robot, recu.id)) || recu;
          journaliser(`pièce complétée — #${ligne.canal_nom} : ${recu.id} livrée sans nom ni type`);
        } catch (err) {
          // On ne sait PAS ce qu'était cette pièce. Le dire ainsi, plutôt qu'affirmer un type
          // qu'on ignore : la seule réponse honnête est celle qui invite à réessayer.
          refus.push({ cause: 'piece_non_recuperee', detail: 'fiche_illisible' });
          journaliser(`fiche illisible — #${ligne.canal_nom} : ${recu.id} (${err?.code || err?.message})`);
          continue;
        }
      }

      const mime = typeDePiece(fichier);
      if (!mime) {
        // Toujours sans nom ni type APRÈS sa fiche : on ne conclut pas davantage qu'avant.
        // Le refus définitif est réservé à ce qu'on a vraiment lu.
        if (pieceACompleter(fichier)) {
          refus.push({ cause: 'piece_non_recuperee', detail: 'fiche_incomplete' });
          journaliser(`pièce indéchiffrable — #${ligne.canal_nom} : ${fichier?.id} sans nom ni type même après sa fiche`);
          continue;
        }
        refus.push({ cause: 'piece_type_refuse' });
        journaliser(`pièce écartée — #${ligne.canal_nom} : ${fichier?.id} d'un type non recevable`);
        continue;
      }
      if (Number(fichier?.size) > TAILLE_MAX) {
        refus.push({ cause: 'piece_trop_lourde' });
        journaliser(`pièce écartée — #${ligne.canal_nom} : ${fichier?.id} dépasse 5 Mo (${gabarit(Number(fichier.size))})`);
        continue;
      }
      try {
        const { octets } = await this.slack.telechargerFichier(this.jetons.robot, fichier, { tailleMax: TAILLE_MAX });
        const chemin = deposer(ligne.canal_id, fichier, octets);
        pieces.push({ nom: fichier.name, mime, chemin, gabarit: gabarit(octets.length) });
        journaliser(`pièce recueillie — #${ligne.canal_nom} : ${fichier?.id} (${mime}, ${gabarit(octets.length)})`);
      } catch (err) {
        const cause = err?.code === 'trop_lourde' ? 'piece_trop_lourde' : 'piece_non_recuperee';
        refus.push({ cause, detail: err?.code || 'échec' });
        journaliser(`pièce non recueillie — #${ligne.canal_nom} : ${fichier?.id} (${err?.code || err?.message})`);
      }
    }
    return { pieces, refus };
  }

  /**
   * Qui a écrit ce message — sous le nom que porterait un humain qui le lit.
   *
   * **Ligne interne** : personne à nommer. C'est le dirigeant, le cadre le dit déjà, et
   * interroger l'annuaire à chaque message ajouterait un appel plafonné sur le chemin le
   * plus fréquent de tout le veilleur.
   *
   * **Ligne cliente** : on résout le nom d'usage, puis on s'en souvient au registre — même
   * raison que pour la liste des autorisés, on n'interroge Slack que sur un inconnu.
   *
   * Quand le nom ne se résout pas, on rend l'IDENTIFIANT, jamais rien. Un cadre sans auteur
   * du tout retomberait sur une désignation vague, et le repli qui compte vraiment — celui
   * sur « le dirigeant » — est structurellement impossible : `cadrerPourAgent` ne l'écrit
   * que sur une ligne interne.
   */
  async nomDeLAuteur(ligne, utilisateur) {
    if (natureDe(ligne) !== 'client' || !utilisateur) return null;
    if (ligne.noms?.[utilisateur]) return ligne.noms[utilisateur];
    let nom = null;
    try {
      nom = await this.slack.nomDeMembre(this.jetons.robot, utilisateur);
    } catch (err) {
      // Un droit d'annuaire manquant ne doit pas coûter une conversation : le message part
      // avec l'identifiant de son auteur, et on le dit au journal plutôt qu'au client.
      journaliser(`nom de ${utilisateur} illisible (${err.message}) — l'identifiant fera foi`);
    }
    if (!nom) return utilisateur;
    ligne.noms = { ...(ligne.noms || {}), [utilisateur]: nom };
    sauverRegistre(this.registre);
    return nom;
  }

  /**
   * Cette parole a-t-elle le droit de piloter l'agent ? La NATURE de la ligne en décide.
   *
   * **Ligne interne** — la liste des invités portés à l'ouverture, et elle seule. Le canal
   * est public : y lire l'appartenance reviendrait à autoriser tout l'espace.
   *
   * **Ligne client** — l'appartenance au canal PRIVÉ fait foi. On ne s'invite pas soi-même
   * dans un canal privé : y être, c'est y avoir été mis par un humain, et ce geste EST
   * l'autorisation. Les gens du client sont invités à la main APRÈS l'ouverture de la
   * ligne — les attendre dans une liste inscrite à l'ouverture, c'est écarter leur premier
   * message en silence, ce qui était exactement le défaut.
   */
  async autorise(ligne, utilisateur) {
    if (!utilisateur) return false;

    if (natureDe(ligne) === 'client') {
      // La liste au registre sert de MÉMOIRE, pas de source de vérité : on n'interroge
      // Slack que sur un inconnu. Sans cela, chaque message d'une conversation consommerait
      // un appel plafonné — et `conversations.members` l'est.
      if (Array.isArray(ligne.autorises) && ligne.autorises.includes(utilisateur)) return true;

      let membres;
      try {
        membres = await this.slack.membresDuCanal(this.jetons.robot, ligne.canal_id);
      } catch (err) {
        // Ne PAS ouvrir la porte quand on n'a pas pu vérifier : un droit Slack manquant
        // deviendrait une autorisation universelle sur le canal d'un client. On refuse, et
        // l'auteur l'apprend par la réponse que RA-REL-009 impose de toute façon.
        journaliser(`membres de #${ligne.canal_nom} illisibles (${err.message}) — parole refusée par prudence`);
        return false;
      }

      if (!membres.includes(utilisateur)) return false;
      ligne.autorises = [...new Set([...(ligne.autorises || []), utilisateur])];
      sauverRegistre(this.registre);
      journaliser(`autorisé — #${ligne.canal_nom} : ${utilisateur} appartient au canal privé`);
      return true;
    }

    // Une ligne OUVERTE AVANT ce contrôle ne porte pas de liste du tout. La traiter comme
    // une liste vide couperait la parole à un dirigeant en pleine conversation, sans qu'il
    // comprenne pourquoi. On la laisse passer et on le dit — la liste se remplira à la
    // prochaine réouverture.
    if (!Array.isArray(ligne.autorises)) {
      journaliser(`ligne ${ligne.chantier} sans liste d'autorisés (ouverte avant le contrôle) — parole acceptée`);
      return true;
    }
    return ligne.autorises.includes(utilisateur);
  }

  /**
   * Le veilleur parle en son nom propre — jamais sous l'identité d'un agent qui n'est plus là.
   *
   * ON NE LUI PASSE PAS UNE PHRASE, mais une CAUSE : la rédaction vit dans `langage.js`, où
   * chaque cause porte sa variante interne et sa variante cliente. C'est ce qui rend la
   * couverture structurelle plutôt que déclarative — un chemin de non-remise ajouté demain
   * ne peut pas envoyer sa propre phrase à un client, il n'a pas où l'écrire.
   */
  async repondreEnPropre(ligne, cause, details = {}) {
    const texte = reponse(cause, natureDe(ligne), {
      chantier: ligne.chantier,
      pane: ligne.pane,
      close_le: ligne.close_le,
      ...details,
    });
    // Le NOM d'expéditeur suit la même règle que le texte. « Ligne directe » nomme notre
    // outillage : devant le dirigeant c'est juste — il sait que c'est la ligne qui parle et
    // non son agent —, devant un client c'est une fuite de plus, sur la surface la plus
    // visible qui soit. Le client, lui, n'a qu'un interlocuteur : la ligne lui répond donc
    // sous le même nom que le reste de la conversation.
    const nom = natureDe(ligne) === 'client' ? libelleDeLigne(ligne) : 'Ligne directe';
    try {
      await this.slack.poster(this.jetons.robot, { canal: ligne.canal_id, texte, nom, emoji: '📻' });
    } catch (err) {
      journaliser(`impossible de répondre dans #${ligne.canal_nom} : ${err.message}`);
    }
  }

  /**
   * Au démarrage : rattraper ce qui a changé pendant qu'on n'était pas là. Les agents
   * meurent, le poste redémarre — des lignes du registre peuvent n'avoir plus personne
   * au bout. On les referme plutôt que de les laisser mentir.
   */
  async reconcilier() {
    let liste;
    try {
      liste = await this.herdr.agents();
    } catch (err) {
      journaliser(`réconciliation impossible (herdr injoignable) : ${err.message}`);
      return;
    }
    // « Aucun agent » et « aucune session joignable » se ressemblent et ne veulent pas dire
    // la même chose. Au démarrage du poste, le service naît AVANT les sessions herdr : lire
    // une liste vide comme « tout le monde est mort » refermait et archivait TOUTES les
    // lignes vivantes à chaque redémarrage — l'inverse exact de ce qu'on promet.
    if (!liste.length) {
      journaliser('réconciliation reportée — aucune session herdr joignable pour le moment');
      return;
    }
    const vivants = new Set(liste.map((a) => a.pane_id));
    let fermees = 0;
    for (const ligne of lignesOuvertes(this.registre)) {
      if (!vivants.has(ligne.pane)) {
        clore(this.registre, ligne.canal_id, maintenant());
        fermees += 1;

        // LE CANAL D'UN CLIENT NE SUIT PAS LE SORT DU TRAVAIL QU'ON Y MÈNE.
        //
        // Un canal interne naît avec un chantier et meurt avec lui : l'archiver referme un
        // lieu qui n'a plus d'objet, et le dirigeant a besoin de savoir que la ligne s'est
        // refermée sans lui. Rien ne change de ce côté.
        //
        // Un canal client, lui, appartient au client. L'archiver le met en LECTURE SEULE :
        // il ne peut plus écrire, et aucune session neuve ne peut reprendre la relation —
        // c'est-à-dire qu'on lui ferme la porte au nez pour un incident qui n'est pas le
        // sien, et qu'on rend le relèvement impossible au moment précis où il servirait.
        //
        // On ne lui dit rien non plus : la mort de notre session est un événement interne,
        // la sienne continue. Le silence s'arrête au moment où il écrit — son message tombe
        // alors dans le chemin « personne au bout du fil », qui a sa variante cliente et qui
        // se garde bien de lui annoncer une fin.
        if (natureDe(ligne) === 'client') {
          journaliser(`ligne cliente refermée sans archivage — #${ligne.canal_nom} reste au client`);
          continue;
        }

        await this.repondreEnPropre(ligne, 'reprise_agent_disparu');

        // ET LA MÊME RÈGLE QU'À `fermer` : une ligne DURABLE garde son canal (T-20260814-0085).
        //
        // Ce balayage tourne tout seul au démarrage du veilleur. Ne corriger que `fermer`
        // aurait laissé la panne se produire sans que personne n'ait rien demandé — un agent
        // qui meurt, un veilleur qui redémarre, et la ligne du gestionnaire irrécupérable.
        // C'est le motif « une porte sur deux », qui a déjà eu ce dépôt dix fois.
        if (jetabiliteDe(ligne) !== 'jetable') {
          journaliser(`ligne durable refermée sans archivage — #${ligne.canal_nom} pourra rouvrir`);
          continue;
        }
        await this.slack.archiverCanal(this.jetons.robot, ligne.canal_id);
      }
    }
    if (fermees) {
      sauverRegistre(this.registre);
      journaliser(`réconciliation — ${fermees} ligne(s) refermée(s), agent disparu`);
    }
  }

  async arreter() {
    this.arrete = true;
    clearInterval(this.chienDeGarde);
    try {
      this.ws?.close();
    } catch {
      /* déjà fermé */
    }
    await new Promise((resolve) => this.serveur?.close(resolve));
    if (existsSync(this.cheminSocket)) {
      try {
        unlinkSync(this.cheminSocket);
      } catch {
        /* rien à faire de plus */
      }
    }
    journaliser('veilleur arrêté');
  }
}

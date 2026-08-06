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
import * as slack from './slack.js';
import * as herdr from './herdr.js';
import { nomDeCanal, visageDe, libelleDeCanal } from './nommage.js';
import { cadrerPourAgent } from './cadre.js';
import {
  CHEMIN_SOCKET,
  CHEMIN_JOURNAL,
  chargerRegistre,
  sauverRegistre,
  lignesOuvertes,
  ligneParCanal,
  ligneOuverteParCle,
  nomsPris,
  inscrireLigne,
  clore,
  natureDe,
  NATURES,
  NATURE_PAR_DEFAUT,
} from './registre.js';

// États d'une connexion, tels que les définit la norme WebSocket. On ne lit PAS
// `WebSocket.OPEN` : le global n'existe qu'à partir de Node 22, et une simple lecture de
// constante y suffirait à faire tomber le veilleur sur un poste plus ancien — avec une
// erreur qui ne parle de rien. Les valeurs, elles, sont figées par la norme.
const CONNEXION_EN_COURS = 0;
const CONNEXION_OUVERTE = 1;

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

  async ouvrir({ chantier, pane, worktree, sujet, titre, invites = [], nature, herdr_socket: herdrSocket = null }) {
    if (!chantier) return { ok: false, erreur: 'chantier requis' };
    if (!pane) return { ok: false, erreur: 'pane requis' };

    // Une nature mal orthographiée NE SE RABAT PAS sur le défaut. `--nature cliet` créerait
    // un canal PUBLIC pour un client — le portefeuille client exposé par une faute de
    // frappe, et rien pour le dire. Refuser coûte une seconde, l'autre issue est définitive.
    if (nature != null && nature !== '' && !NATURES.includes(nature)) {
      return { ok: false, erreur: `nature inconnue : « ${nature} » — les natures admises sont ${NATURES.join(', ')}` };
    }
    const natureVoulue = nature || NATURE_PAR_DEFAUT;

    const deja = ligneOuverteParCle(this.registre, chantier, worktree);
    if (deja) {
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
      // Rouvrir une ligne déjà ouverte n'est pas une erreur : un agent relancé dans le
      // même worktree retrouve son canal. On rafraîchit seulement son pane, qui a changé.
      deja.pane = pane;
      if (herdrSocket) deja.herdr_socket = herdrSocket;
      if (invites.length) deja.autorises = [...new Set([...(deja.autorises || []), ...invites])];
      sauverRegistre(this.registre);
      return {
        ok: true,
        reprise: true,
        canal: deja.canal_nom,
        canal_id: deja.canal_id,
        visage: deja.visage,
        nature: natureDe(deja),
      };
    }

    const pris = nomsPris(this.registre);
    // Le NOM vient du titre ; le CODE, lui, part dans le sujet du canal — il reste donc
    // lisible d'un coup d'œil sans encombrer le nom.
    const nom = nomDeCanal(libelleDeCanal(chantier, titre), (n) => pris.has(n));
    const visage = visageDe(chantier);

    // LA CONFIDENTIALITÉ SE JOUE ICI, et nulle part ailleurs : Slack fixe la nature d'un
    // canal à sa création et ne la change plus jamais. Un canal client né public le reste.
    const canal = await this.slack.creerCanal(this.jetons.robot, nom, natureVoulue === 'client');
    const sujetComplet = [chantier, sujet].filter(Boolean).join(' — ');
    if (sujetComplet) await this.slack.definirSujet(this.jetons.robot, canal.id, sujetComplet);
    if (invites.length) await this.slack.inviter(this.jetons.robot, canal.id, invites);

    const ligne = inscrireLigne(this.registre, {
      chantier,
      canal_id: canal.id,
      canal_nom: canal.nom,
      pane,
      worktree: worktree || null,
      herdr_socket: herdrSocket,
      nature: natureVoulue,
      // Qui a le droit de piloter l'agent par cette ligne.
      //
      // Sur une ligne INTERNE, le canal est public : sans cette liste, n'importe quel
      // membre de l'espace ferait passer un message pour une consigne du dirigeant — le
      // cadre lui en donne l'autorité.
      //
      // Sur une ligne CLIENT, elle démarre vide et c'est normal : les gens du client sont
      // invités À LA MAIN dans Slack, après l'ouverture. C'est leur appartenance au canal
      // privé qui les autorise, et cette liste ne sert plus qu'à s'en souvenir.
      autorises: invites.slice(),
      visage,
      ouverte_le: maintenant(),
      close_le: null,
    });
    sauverRegistre(this.registre);
    journaliser(`ligne ouverte — ${chantier} → #${canal.nom} (${canal.id}) pane ${pane} nature ${natureVoulue}`);
    return {
      ok: true,
      reprise: false,
      canal: canal.nom,
      canal_id: canal.id,
      visage,
      nature: natureVoulue,
      canal_reutilise: canal.reutilise,
    };
  }

  /** Poste sous l'identité du chantier. Échoue BRUYAMMENT : un rapport perdu en silence est pire qu'une erreur. */
  async dire({ chantier, worktree, texte, canal_id: canalId }) {
    const ligne = canalId ? ligneParCanal(this.registre, canalId) : ligneOuverteParCle(this.registre, chantier, worktree);
    if (!ligne) return { ok: false, erreur: `aucune ligne ouverte pour « ${chantier} » — ouvre-la d'abord` };
    if (ligne.close_le) return { ok: false, erreur: `la ligne de « ${ligne.chantier} » est close depuis ${ligne.close_le}` };
    const ts = await this.slack.poster(this.jetons.robot, {
      canal: ligne.canal_id,
      texte,
      nom: ligne.chantier,
      emoji: ligne.visage,
    });
    return { ok: true, canal: ligne.canal_nom, ts };
  }

  /**
   * Renomme le canal d'une ligne — dans Slack ET au registre, en un seul geste.
   *
   * Les deux ensemble, jamais l'un sans l'autre : un renommage fait à la main dans Slack
   * laisse le registre sur l'ancien nom, et l'état affiché cesse de correspondre à ce que
   * le dirigeant voit dans son espace.
   */
  async renommer({ chantier, worktree, titre, canal_id: canalId }) {
    const ligne = canalId ? ligneParCanal(this.registre, canalId) : ligneOuverteParCle(this.registre, chantier, worktree);
    if (!ligne) return { ok: false, erreur: `aucune ligne pour « ${chantier || canalId} »` };
    if (!titre) return { ok: false, erreur: 'titre requis' };

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

  async fermer({ chantier, worktree, bilan, archiver = true, canal_id: canalId }) {
    const ligne = canalId ? ligneParCanal(this.registre, canalId) : ligneOuverteParCle(this.registre, chantier, worktree);
    if (!ligne) return { ok: false, erreur: `aucune ligne ouverte pour « ${chantier} »` };
    if (bilan) {
      await this.slack.poster(this.jetons.robot, {
        canal: ligne.canal_id,
        texte: bilan,
        nom: ligne.chantier,
        emoji: ligne.visage,
      });
    }
    // ORDRE IMPOSÉ PAR SLACK, mesuré : un canal archivé est en LECTURE SEULE. Le bilan
    // doit donc partir AVANT l'archivage — l'inverse perd le message sans rien dire.
    let archive = false;
    if (archiver) archive = await this.slack.archiverCanal(this.jetons.robot, ligne.canal_id);
    clore(this.registre, ligne.canal_id, maintenant());
    sauverRegistre(this.registre);
    journaliser(`ligne close — ${ligne.chantier} (#${ligne.canal_nom}) archive=${archive}`);
    return { ok: true, canal: ligne.canal_nom, archive };
  }

  etat() {
    const ouvertes = lignesOuvertes(this.registre).map((l) => ({
      chantier: l.chantier,
      canal: l.canal_nom,
      nature: natureDe(l),
      pane: l.pane,
      worktree: l.worktree,
      depuis: l.ouverte_le,
    }));
    return { ok: true, espace: this.identite.equipe, connecte: this.ws?.readyState === CONNEXION_OUVERTE, ouvertes };
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
    // Nos propres messages, les entrées/sorties de canal, les modifications : rien de tout
    // cela n'est une parole du dirigeant.
    if (ev.bot_id || ev.subtype) return;
    if (ev.user === this.identite.utilisateur) return;

    await this.remettreAuChantier(ev);
  }

  /**
   * Le message du dirigeant vers le pane de son agent — et la réponse quand il n'y a
   * personne au bout du fil. C'est ici que se joue la promesse « je ne parle jamais dans
   * le vide » : chaque écriture reçoit une suite, réponse de l'agent ou explication.
   */
  async remettreAuChantier(ev) {
    const ligne = ligneParCanal(this.registre, ev.channel);
    if (!ligne) return; // canal qui ne nous regarde pas

    const texte = (ev.text || '').trim();
    if (!texte) return;

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
      // TEXTE PROVISOIRE : la rédaction des réponses du veilleur — et le fait qu'elle
      // s'adresse aujourd'hui à un client comme au dirigeant — appartient à
      // E-20260806-0009 (registre de langage). Ici on transporte, on ne rédige pas.
      await this.repondreEnPropre(ligne, "Ton message n'a été remis à aucun agent : tu n'es pas autorisé à écrire sur cette ligne.");
      return;
    }

    if (ligne.close_le) {
      await this.repondreEnPropre(ligne, `Cette ligne est close depuis le ${ligne.close_le.slice(0, 10)} — plus personne ne travaille sur ${ligne.chantier}. Ton message n'a donc été remis à aucun agent.`);
      return;
    }

    // Un herdr injoignable N'EST PAS un agent mort : la session peut être momentanément
    // absente. Le confondre refermait la ligne d'un agent bien vivant — et, avant ça,
    // laissait échapper un rejet qui mettait le veilleur à terre.
    let present;
    try {
      present = await this.herdr.vivant(ligne.pane, { socket: ligne.herdr_socket });
    } catch (err) {
      await this.repondreEnPropre(ligne, `Je n'arrive pas à joindre l'agent de ${ligne.chantier} en ce moment (${err.message}). Ton message n'a été remis à personne — renvoie-le dans un instant.`);
      journaliser(`herdr injoignable — #${ligne.canal_nom} : ${err.message}`);
      return;
    }
    if (!present) {
      clore(this.registre, ligne.canal_id, maintenant());
      sauverRegistre(this.registre);
      await this.repondreEnPropre(ligne, `L'agent de ${ligne.chantier} n'est plus là — son pane ${ligne.pane} a disparu. Je referme la ligne ; ton message n'a été remis à personne.`);
      journaliser(`ligne close d'office — agent disparu (${ligne.chantier}, pane ${ligne.pane})`);
      return;
    }

    try {
      // On remet la parole CADRÉE, jamais brute : un agent qui reçoit un message nu répond
      // dans son terminal, et le dirigeant conclut que rien n'est arrivé.
      await this.herdr.remettre(
        ligne.pane,
        cadrerPourAgent({ chantier: ligne.chantier, texte, canal: ligne.canal_nom }),
        { socket: ligne.herdr_socket }
      );
      journaliser(`remis — #${ligne.canal_nom} → ${ligne.pane} (${texte.length} car.)`);
    } catch (err) {
      await this.repondreEnPropre(ligne, `Je n'ai pas pu remettre ton message à l'agent de ${ligne.chantier} : ${err.message}`);
      journaliser(`ÉCHEC de remise — #${ligne.canal_nom} → ${ligne.pane} : ${err.message}`);
    }
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

  /** Le veilleur parle en son nom propre — jamais sous l'identité d'un agent qui n'est plus là. */
  async repondreEnPropre(ligne, texte) {
    try {
      await this.slack.poster(this.jetons.robot, { canal: ligne.canal_id, texte, nom: 'Ligne directe', emoji: '📻' });
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
        await this.repondreEnPropre(ligne, `Je reprends du service et l'agent de ${ligne.chantier} n'est plus là. Je referme cette ligne.`);
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

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
import { nomDeCanal, visageDe } from './nommage.js';
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
} from './registre.js';

const RECONNEXION_MIN = 1_000;
const RECONNEXION_MAX = 60_000;

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
  constructor({ jetons, identite, cheminSocket = CHEMIN_SOCKET } = {}) {
    this.jetons = jetons;
    this.identite = identite;
    this.cheminSocket = cheminSocket;
    this.registre = chargerRegistre();
    this.ws = null;
    this.serveur = null;
    this.attente = RECONNEXION_MIN;
    this.arrete = false;
  }

  static async demarrer(options = {}) {
    const jetons = await lireJetons();
    const identite = await slack.identite(jetons.robot);
    const v = new Veilleur({ ...options, jetons, identite });
    await v.ecouterLocal();
    v.connecterSlack();
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
  ecouterLocal() {
    return new Promise((resolve, reject) => {
      mkdirSync(dirname(this.cheminSocket), { recursive: true });
      if (existsSync(this.cheminSocket)) {
        try {
          unlinkSync(this.cheminSocket);
        } catch {
          /* socket résiduel d'un veilleur mort */
        }
      }
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
      this.serveur.on('error', reject);
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
      case 'etat':
        return this.etat();
      case 'ping':
        return { ok: true, veilleur: 'vivant', espace: this.identite.equipe };
      default:
        return { ok: false, erreur: `geste inconnu : ${geste}` };
    }
  }

  // ————————————————————————————————————————————————————————————————— les quatre gestes

  async ouvrir({ chantier, pane, worktree, sujet, invites = [] }) {
    if (!chantier) return { ok: false, erreur: 'chantier requis' };
    if (!pane) return { ok: false, erreur: 'pane requis' };

    const deja = ligneOuverteParCle(this.registre, chantier, worktree);
    if (deja) {
      // Rouvrir une ligne déjà ouverte n'est pas une erreur : un agent relancé dans le
      // même worktree retrouve son canal. On rafraîchit seulement son pane, qui a changé.
      deja.pane = pane;
      sauverRegistre(this.registre);
      return { ok: true, reprise: true, canal: deja.canal_nom, canal_id: deja.canal_id, visage: deja.visage };
    }

    const pris = nomsPris(this.registre);
    const nom = nomDeCanal(chantier, (n) => pris.has(n));
    const visage = visageDe(chantier);

    const canal = await slack.creerCanal(this.jetons.robot, nom);
    if (sujet) await slack.definirSujet(this.jetons.robot, canal.id, sujet);
    if (invites.length) await slack.inviter(this.jetons.robot, canal.id, invites);

    const ligne = inscrireLigne(this.registre, {
      chantier,
      canal_id: canal.id,
      canal_nom: canal.nom,
      pane,
      worktree: worktree || null,
      visage,
      ouverte_le: maintenant(),
      close_le: null,
    });
    sauverRegistre(this.registre);
    journaliser(`ligne ouverte — ${chantier} → #${canal.nom} (${canal.id}) pane ${pane}`);
    return { ok: true, reprise: false, canal: canal.nom, canal_id: canal.id, visage, canal_reutilise: canal.reutilise };
  }

  /** Poste sous l'identité du chantier. Échoue BRUYAMMENT : un rapport perdu en silence est pire qu'une erreur. */
  async dire({ chantier, worktree, texte, canal_id: canalId }) {
    const ligne = canalId ? ligneParCanal(this.registre, canalId) : ligneOuverteParCle(this.registre, chantier, worktree);
    if (!ligne) return { ok: false, erreur: `aucune ligne ouverte pour « ${chantier} » — ouvre-la d'abord` };
    if (ligne.close_le) return { ok: false, erreur: `la ligne de « ${ligne.chantier} » est close depuis ${ligne.close_le}` };
    const ts = await slack.poster(this.jetons.robot, {
      canal: ligne.canal_id,
      texte,
      nom: ligne.chantier,
      emoji: ligne.visage,
    });
    return { ok: true, canal: ligne.canal_nom, ts };
  }

  async fermer({ chantier, worktree, bilan, archiver = true, canal_id: canalId }) {
    const ligne = canalId ? ligneParCanal(this.registre, canalId) : ligneOuverteParCle(this.registre, chantier, worktree);
    if (!ligne) return { ok: false, erreur: `aucune ligne ouverte pour « ${chantier} »` };
    if (bilan) {
      await slack.poster(this.jetons.robot, {
        canal: ligne.canal_id,
        texte: bilan,
        nom: ligne.chantier,
        emoji: ligne.visage,
      });
    }
    // ORDRE IMPOSÉ PAR SLACK, mesuré : un canal archivé est en LECTURE SEULE. Le bilan
    // doit donc partir AVANT l'archivage — l'inverse perd le message sans rien dire.
    let archive = false;
    if (archiver) archive = await slack.archiverCanal(this.jetons.robot, ligne.canal_id);
    clore(this.registre, ligne.canal_id, maintenant());
    sauverRegistre(this.registre);
    journaliser(`ligne close — ${ligne.chantier} (#${ligne.canal_nom}) archive=${archive}`);
    return { ok: true, canal: ligne.canal_nom, archive };
  }

  etat() {
    const ouvertes = lignesOuvertes(this.registre).map((l) => ({
      chantier: l.chantier,
      canal: l.canal_nom,
      pane: l.pane,
      worktree: l.worktree,
      depuis: l.ouverte_le,
    }));
    return { ok: true, espace: this.identite.equipe, connecte: this.ws?.readyState === WebSocket.OPEN, ouvertes };
  }

  // —————————————————————————————————————————————————————————————— écoute permanente

  connecterSlack() {
    if (this.arrete) return;
    slack
      .ouvrirEcoute(this.jetons.ecoute)
      .then((url) => {
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.addEventListener('open', () => {
          this.attente = RECONNEXION_MIN;
          journaliser('écoute permanente établie');
        });
        ws.addEventListener('message', (evt) => this.surMessage(evt, ws));
        ws.addEventListener('close', () => this.reconnecter('connexion fermée'));
        ws.addEventListener('error', () => {
          /* le `close` qui suit déclenche la reconnexion */
        });
      })
      .catch((err) => this.reconnecter(`ouverture refusée : ${err.message}`));
  }

  reconnecter(raison) {
    if (this.arrete) return;
    journaliser(`reconnexion dans ${Math.round(this.attente / 1000)}s — ${raison}`);
    const delai = this.attente;
    this.attente = Math.min(this.attente * 2, RECONNEXION_MAX);
    setTimeout(() => this.connecterSlack(), delai).unref?.();
  }

  async surMessage(evt, ws) {
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

    if (ligne.close_le) {
      await this.repondreEnPropre(ligne, `Cette ligne est close depuis le ${ligne.close_le.slice(0, 10)} — plus personne ne travaille sur ${ligne.chantier}. Ton message n'a donc été remis à aucun agent.`);
      return;
    }

    if (!(await herdr.vivant(ligne.pane))) {
      clore(this.registre, ligne.canal_id, maintenant());
      sauverRegistre(this.registre);
      await this.repondreEnPropre(ligne, `L'agent de ${ligne.chantier} n'est plus là — son pane ${ligne.pane} a disparu. Je referme la ligne ; ton message n'a été remis à personne.`);
      journaliser(`ligne close d'office — agent disparu (${ligne.chantier}, pane ${ligne.pane})`);
      return;
    }

    try {
      await herdr.remettre(ligne.pane, texte);
      journaliser(`remis — #${ligne.canal_nom} → ${ligne.pane} (${texte.length} car.)`);
    } catch (err) {
      await this.repondreEnPropre(ligne, `Je n'ai pas pu remettre ton message à l'agent de ${ligne.chantier} : ${err.message}`);
      journaliser(`ÉCHEC de remise — #${ligne.canal_nom} → ${ligne.pane} : ${err.message}`);
    }
  }

  /** Le veilleur parle en son nom propre — jamais sous l'identité d'un agent qui n'est plus là. */
  async repondreEnPropre(ligne, texte) {
    try {
      await slack.poster(this.jetons.robot, { canal: ligne.canal_id, texte, nom: 'Ligne directe', emoji: '📻' });
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
    let vivants;
    try {
      vivants = new Set((await herdr.agents()).map((a) => a.pane_id));
    } catch (err) {
      journaliser(`réconciliation impossible (herdr injoignable) : ${err.message}`);
      return;
    }
    let fermees = 0;
    for (const ligne of lignesOuvertes(this.registre)) {
      if (!vivants.has(ligne.pane)) {
        clore(this.registre, ligne.canal_id, maintenant());
        fermees += 1;
        await this.repondreEnPropre(ligne, `Je reprends du service et l'agent de ${ligne.chantier} n'est plus là. Je referme cette ligne.`);
        await slack.archiverCanal(this.jetons.robot, ligne.canal_id);
      }
    }
    if (fermees) {
      sauverRegistre(this.registre);
      journaliser(`réconciliation — ${fermees} ligne(s) refermée(s), agent disparu`);
    }
  }

  async arreter() {
    this.arrete = true;
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

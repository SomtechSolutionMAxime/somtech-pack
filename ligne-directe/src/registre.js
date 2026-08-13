// registre.js — qui parle à qui, et où.
//
// Le registre est la seule chose qui survit à la mort d'un agent ET au redémarrage du
// poste. C'est lui qui permet de répondre « ce chantier est clos » au lieu d'avaler un
// message dans le vide : une ligne fermée reste inscrite, marquée close.
//
// Il vit sur disque en JSON. Écriture atomique (fichier temporaire puis renommage) : un
// veilleur tué en plein vol ne doit pas laisser un registre tronqué derrière lui — on
// perdrait l'appariement de toutes les lignes ouvertes, pas seulement celle en cours.

import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const RACINE = process.env.LIGNE_DIRECTE_RACINE || join(homedir(), '.somtech', 'ligne-directe');
export const CHEMIN_REGISTRE = join(RACINE, 'registre.json');
export const CHEMIN_SOCKET = join(RACINE, 'veilleur.sock');
export const CHEMIN_JOURNAL = join(RACINE, 'veilleur.log');

const VERSION = 1;

/**
 * La NATURE d'une ligne — qui commande la confidentialité du canal et qui a le droit d'y
 * écrire. `interne` : le dirigeant, canal public, autorisation par liste d'invités.
 * `client` : les gens d'un client, canal privé, autorisation par appartenance au canal.
 */
export const NATURES = ['interne', 'client'];
export const NATURE_PAR_DEFAUT = 'interne';

/**
 * Lit la nature d'une ligne — et c'est le SEUL point de lecture, volontairement.
 *
 * Un registre écrit par une version antérieure ne porte aucun champ `nature`. Le faire
 * retomber ici sur `interne` est ce qui garantit que les lignes déjà ouvertes en production
 * ne changent pas de comportement : tout test d'égalité fait ailleurs (`l.nature === …`)
 * traiterait `undefined` comme un troisième cas, et c'est là que la régression se glisse.
 */
export function natureDe(ligne) {
  return ligne?.nature === 'client' ? 'client' : NATURE_PAR_DEFAUT;
}

/**
 * Le nom sous lequel une ligne se présente dans son canal — ce qui COIFFE chacun de ses
 * messages, et donc ce que l'interlocuteur lit avant même de lire le texte.
 *
 * Sur une ligne INTERNE, c'est le code du chantier, et c'est utile : le dirigeant suit
 * plusieurs chantiers à la fois et doit voir lequel lui parle.
 *
 * Sur une ligne CLIENT, un code de chantier est un matricule. Le registre de langage avait
 * nettoyé ce qu'on DIT à un client sans toucher à ce qu'on EST devant lui : il voyait une
 * suite de messages signés d'un numéro de dossier, alors qu'on prétend lui donner un
 * représentant. C'est donc le libellé donné à l'ouverture qui parle.
 *
 * Le repli d'une ligne cliente inscrite par une version antérieure — le champ n'existait
 * pas — n'est PAS le chantier : c'est le nom du canal, qui vient déjà du titre et ne porte
 * donc aucun code. Moins joli, jamais fuyant. Un repli sur le chantier ferait exactement
 * réapparaître le défaut là où personne n'a plus la main pour le corriger.
 */
export function libelleDeLigne(ligne) {
  if (ligne?.libelle) return ligne.libelle;
  if (natureDe(ligne) === 'client') return ligne?.canal_nom || 'votre interlocuteur';
  return ligne?.chantier;
}

/**
 * LE CANAL COMMUN N'EST PAS UNE LIGNE, et ce n'est pas un choix de rangement : c'est la
 * garantie du dispositif.
 *
 * MESURÉ (2026-08-13, contre le vrai code) : le défaut « deux lignes sur un même pane font
 * partir les messages dans le mauvais canal » ne vient ni du registre, ni du veilleur, ni de
 * Slack. Il vient du chemin SORTANT, et d'une seule expression — la sélection que fait la
 * commande pour savoir de quelle ligne elle parle :
 *
 *     (etat.ouvertes || []).find((l) => l.pane === ici.pane)
 *
 * Un `.find()` sur une clé qui n'est pas unique. Deux lignes ouvertes depuis le même pane, et
 * il rend la PREMIÈRE INSCRITE — jamais celle qu'on visait. Un rapport destiné à `D-2` part
 * dans le canal de `D-1`, en silence, avec `ok:true`. (Le chemin ENTRANT, lui, est sain : il
 * route par `ev.channel`, chaque message arrive cadré du bon chantier.)
 *
 * Conséquence directe sur la conception du canal commun : **il ne doit jamais entrer dans
 * `lignes[]`**, parce que `lignesOuvertes()` alimente `etat().ouvertes`, qui alimente ce
 * `.find()`. Une consigne commune inscrite comme une ligne ferait du canal de TOUS les agents
 * un candidat à la sélection — et le premier `dire` d'un agent, ou la réponse d'un
 * représentant à son client, partirait chez tout le monde.
 *
 * Il vit donc à côté, dans un champ qui n'est parcouru par aucun geste sortant. Aucun pane,
 * aucun chantier, aucun worktree : rien par quoi un agent puisse le désigner.
 */
function vide() {
  return { version: VERSION, lignes: [], commun: null };
}

export function chargerRegistre(chemin = CHEMIN_REGISTRE) {
  if (!existsSync(chemin)) return vide();
  try {
    const brut = JSON.parse(readFileSync(chemin, 'utf8'));
    if (!brut || !Array.isArray(brut.lignes)) return vide();
    // `commun` absent d'un registre écrit par une version antérieure vaut « aucun canal
    // commun désigné » — pas d'objet vide, qui aurait l'air d'une désignation faite.
    return { version: brut.version || VERSION, lignes: brut.lignes, commun: brut.commun || null };
  } catch {
    // Un registre illisible ne doit pas empêcher le veilleur de démarrer : il repart
    // à vide plutôt que de refuser de vivre. Les canaux orphelins seront signalés.
    return vide();
  }
}

export function sauverRegistre(registre, chemin = CHEMIN_REGISTRE) {
  mkdirSync(dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.tmp`;
  writeFileSync(temporaire, `${JSON.stringify(registre, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaire, chemin);
  try {
    chmodSync(chemin, 0o600);
  } catch {
    /* le registre ne porte pas de secret, mais il nomme les chantiers en cours */
  }
  return chemin;
}

/** Clé d'identité d'une ligne : le couple chantier + copie de travail. */
export function cleDeLigne(chantier, worktree) {
  return `${String(chantier).toLowerCase()}::${worktree || ''}`;
}

export function lignesOuvertes(registre) {
  return registre.lignes.filter((l) => !l.close_le);
}

/**
 * La ligne d'un canal — **l'ouverte d'abord**.
 *
 * BLOQUANT relevé en revue : un `.find()` naïf rendait la ligne CLOSE quand un chantier
 * était rouvert. Or Slack réutilise le même canal quand on reprend un nom libéré : la
 * nouvelle ligne partage donc l'identifiant de l'ancienne. L'agent vivant ne recevait
 * jamais rien, et le dirigeant s'entendait répondre « cette ligne est close » à
 * perpétuité — le registre survivant au redémarrage, c'était définitif. Et c'est le cycle
 * NOMINAL d'un chantier repris.
 */
export function ligneParCanal(registre, canalId) {
  const ouverte = registre.lignes.find((l) => l.canal_id === canalId && !l.close_le);
  if (ouverte) return ouverte;
  // Aucune ouverte : on rend la plus récemment close, pour pouvoir répondre « c'est clos »
  // au lieu d'avaler le message.
  const closes = registre.lignes.filter((l) => l.canal_id === canalId);
  return closes.length ? closes[closes.length - 1] : null;
}

export function ligneOuverteParCle(registre, chantier, worktree) {
  const cle = cleDeLigne(chantier, worktree);
  return lignesOuvertes(registre).find((l) => cleDeLigne(l.chantier, l.worktree) === cle) || null;
}

export function nomsPris(registre) {
  return new Set(registre.lignes.filter((l) => !l.close_le).map((l) => l.canal_nom));
}

export function inscrireLigne(registre, ligne) {
  registre.lignes.push(ligne);
  return ligne;
}

export function clore(registre, canalId, quand) {
  const ligne = ligneParCanal(registre, canalId);
  if (!ligne || ligne.close_le) return null;
  ligne.close_le = quand;
  return ligne;
}

// ————————————————————————————————————————————————————————————————— le canal commun

/** Le canal commun désigné, ou `null` — jamais un objet vide, qui aurait l'air d'une désignation. */
export function canalCommun(registre) {
  return registre?.commun || null;
}

/**
 * Ce canal est-il LE canal commun ?
 *
 * Point de lecture unique, et c'est voulu : chaque geste qui écrit dans un canal doit pouvoir
 * poser la question d'une seule façon. Un test d'égalité recopié à cinq endroits en oublie un,
 * et l'oubli est du côté qui coûte — une parole d'agent chez tous les agents.
 */
export function estCanalCommun(registre, canalId) {
  const commun = canalCommun(registre);
  return Boolean(commun && canalId && commun.canal_id === canalId);
}

/**
 * La ligne ouverte depuis CE pane — la sélection que fait la commande pour savoir de quelle
 * ligne elle parle quand un agent dit, ferme ou renomme.
 *
 * ELLE VIVAIT DANS `bin/ligne-directe.js`, recopiée à trois endroits. Elle est ici pour une
 * raison précise : le canal commun promet de ne jamais passer par ce chemin, et une promesse
 * ne se prouve pas contre une copie du code — un test qui réécrirait ce `.filter` prouverait
 * seulement que le test est d'accord avec lui-même. Il appelle donc la fonction que la
 * commande appelle.
 *
 * SON DÉFAUT CONNU EST CONSERVÉ TEL QUEL, et c'est délibéré : avec deux lignes ouvertes sur un
 * même pane, elle rend la première inscrite et ignore l'autre en silence (mesuré le
 * 2026-08-13). Le renversement — refuser et demander de nommer la ligne — est un changement de
 * comportement de `dire`, `fermer` et `renommer` : il mérite sa preuve à lui, pas d'être
 * emporté dans le lot d'à côté. `candidates` est rendu pour que ce jour-là il n'y ait rien à
 * chercher.
 *
 * @returns {{ligne: object|null, candidates: object[]}}
 */
export function ligneDuPane(ouvertes, pane) {
  const candidates = (ouvertes || []).filter((l) => l.pane === pane);
  return { ligne: candidates[0] || null, candidates };
}

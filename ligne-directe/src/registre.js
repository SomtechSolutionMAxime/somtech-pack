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

import { dossiersDesLieux } from './roles.js';

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
 * La JETABILITÉ d'une ligne — dit si son canal peut être archivé quand elle se referme.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE N'EST PLUS LA NATURE QUI LE DIT (T-20260814-0085).
 *
 * Le code déduisait « jetable » de « interne » : `client` → on garde le canal, tout le reste →
 * on archive. La règle « un canal interne naît avec un chantier et meurt avec lui » était vraie
 * quand toutes les lignes internes étaient des lignes de chantier. Elle a cessé de l'être en
 * v1.45.0, quand la ligne permanente entre un gestionnaire et le dirigeant est devenue interne
 * elle aussi ; et l'incident du 2026-08-14 a montré qu'une ligne de CHANTIER est durable pour
 * la même raison — on peut avoir besoin de la refaire, et un canal archivé ne se rouvre pas.
 *
 * ⚠️ LE REPLI EST L'INVERSE DE CELUI DE `natureDe`, ET C'EST DÉLIBÉRÉ.
 *
 * `natureDe` retombe sur `interne` parce que c'est le cas le plus courant. Ici, ce qui décide
 * n'est pas la fréquence, c'est la RÉVERSIBILITÉ : archiver est définitif pour nous (Slack
 * réserve le désarchivage à un compte humain), ne pas archiver laisse un canal qu'un humain
 * ferme en trente secondes. Une ligne dont on ne sait rien est donc DURABLE.
 *
 * Ce n'est pas de la prudence abstraite : le registre survit aux versions du pack et rien ne
 * migre. Toutes les lignes déjà ouvertes sur le poste du dirigeant sont sans ce champ — dont
 * celles qui ont mordu. Un repli vers `jetable` aurait livré un correctif qui ne corrige rien
 * pour le parc existant.
 */
export function jetabiliteDe(ligne) {
  return ligne?.jetable === true ? 'jetable' : 'durable';
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
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * UN CANAL PAR RÔLE (T-20260814-0002), ET C'EST CETTE DÉCISION-LÀ QUI LE REND POSSIBLE.
 *
 * `communs` est une table `rôle → canal`. Passer de UN canal à PLUSIEURS ne touche donc rien
 * du routage des lignes : ils restent tous hors de `lignes[]`, donc hors de `etat().ouvertes`,
 * donc hors de la sélection par pane. Un canal de rôle NE REÇOIT PAS DE NATURE pour la même
 * raison — la nature qualifie une ligne, et lui en donner une l'y ferait entrer.
 */
function vide() {
  return { version: VERSION, lignes: [], communs: {}, commun: null, dirigeant: null };
}

export function chargerRegistre(chemin = CHEMIN_REGISTRE) {
  if (!existsSync(chemin)) return vide();
  try {
    const brut = JSON.parse(readFileSync(chemin, 'utf8'));
    if (!brut || !Array.isArray(brut.lignes)) return vide();
    // `communs` absent d'un registre écrit par une version antérieure vaut « aucun canal
    // désigné » — pas d'objet vide, qui aurait l'air d'une désignation faite.
    //
    // `commun` — LE CANAL D'AVANT, désigné par v1.42.0 SANS rôle — est relu tel quel, et c'est
    // délibéré. On ne peut pas lui deviner un rôle : le diffuser à tout le monde rejouerait ce
    // que ce lot corrige, et l'oublier rouvrirait la porte par laquelle `fermer` postait son
    // bilan dans le canal de tous puis l'ARCHIVAIT. Il reste donc gardé sans être diffusé, et
    // l'état le nomme pour que personne ne cherche pourquoi rien n'en part.
    return {
      version: brut.version || VERSION,
      lignes: brut.lignes,
      communs: brut.communs && typeof brut.communs === 'object' ? brut.communs : {},
      commun: brut.commun || null,
      // Même règle : absent d'un registre écrit par une version antérieure vaut « aucun
      // dirigeant désigné sur ce poste » — jamais un objet vide, qui aurait l'air d'une
      // désignation faite et ferait ouvrir une ligne interne SANS AUCUN autorisé, c'est-à-dire
      // un canal où plus personne n'a le droit d'écrire.
      dirigeant: brut.dirigeant || null,
    };
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

/**
 * CE QUI, DANS UN CHEMIN, IDENTIFIE UN AGENT D'UNE RENAISSANCE À L'AUTRE — SON LIEU.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE N'EST PLUS LA COPIE DE TRAVAIL (T-20260827-0033).
 *
 * L'identité d'une ligne retenait le chemin COMPLET du pane. Or un successeur ne naît presque
 * jamais dans la copie de travail de son prédécesseur : mesuré le 2026-08-26 sur
 * `P-20260815-0002`, le mort vivait dans `~/worktrees/somcraft/20260817-210120/.orchestrateur/
 * p-20260815-0002`, le vivant est né dans `~/GitRepo.nosync/somcraft/.orchestrateur/
 * p-20260815-0002`. Même chantier, même rôle, même lieu — deux clés. Aucune reprise possible,
 * un second canal créé sous un `-2`, et le canal d'origine — libre, ouvert, non archivé, celui
 * où le dirigeant écrivait — hors d'atteinte. L'ordre reçu ce soir-là était « même channel ».
 *
 * ⚠️ CE QUI DEVAIT SURVIVRE AU CORRECTIF. Retirer la copie de travail sans rien mettre à la
 * place confondrait deux agents ORDINAIRES du même chantier travaillant dans deux copies —
 * exactement ce que la clé sépare, et un routage croisé. On ne retire donc rien : on remonte
 * du chemin au LIEU quand il y en a un, et un chemin sans lieu de rôle reste distinctif de
 * bout en bout. Ce qui n'est pas mesuré n'est pas aplati.
 *
 * ⚠️ ET ELLE SE CALCULE À LA LECTURE, JAMAIS À L'ÉCRITURE. Le registre survit aux versions et
 * RIEN NE MIGRE : les lignes déjà ouvertes sur le poste portent leur chemin complet, écrit par
 * la version qui a mordu — dont le seul cas mesuré. Une ancre inscrite au registre n'aurait
 * corrigé que les lignes à venir, c'est-à-dire personne.
 *
 * ⚠️ LES DOSSIERS DE RÔLE VIENNENT DU REGISTRE DES RÔLES, jamais d'une liste écrite ici. Une
 * liste recopiée ignore le troisième rôle le jour où il naît : ses agents perdraient la reprise
 * sans qu'aucune erreur ne le dise — la panne muette que ce fichier passe son temps à fermer.
 *
 * La casse du segment de lieu est aplatie pour la raison qui vaut déjà pour le chantier : elle
 * n'identifie rien. Le chemin rendu tel quel, lui, n'est pas touché — sur un système de
 * fichiers qui distingue la casse, deux chemins distincts le restent.
 */
export function ancreDeLigne(worktree) {
  const chemin = String(worktree ?? '').trim();
  if (!chemin) return '';
  const segments = chemin.split('/');
  const dossiers = dossiersDesLieux();
  // On cherche depuis la FIN : c'est le lieu le plus profond qui porte l'agent. Et il faut un
  // segment DERRIÈRE le dossier — `.orchestrateur` seul ne nomme aucun agent, c'est un rangement.
  for (let i = segments.length - 2; i >= 0; i -= 1) {
    if (dossiers.includes(segments[i]) && segments[i + 1]) {
      return `${segments[i]}/${segments[i + 1]}`.toLowerCase();
    }
  }
  return chemin;
}

/** Clé d'identité d'une ligne : le couple chantier + lieu de l'agent (voir `ancreDeLigne`). */
export function cleDeLigne(chantier, worktree) {
  return `${String(chantier).toLowerCase()}::${ancreDeLigne(worktree)}`;
}

export function lignesOuvertes(registre) {
  return registre.lignes.filter((l) => !l.close_le);
}

/**
 * LES PANES QUI PORTENT CETTE LIGNE — son agent, et le PAIR qui la partage avec lui.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * UNE LIGNE À DEUX AGENTS (T-20260814-0093), ET C'EST LE SEUL ENDROIT QUI LE SAIT.
 *
 * La ligne d'un chantier était portée par un pane : celui de l'orchestrateur. Le gestionnaire
 * client qui a ouvert la demande n'avait donc aucun chemin vers lui — il faisait faire, et le
 * compte rendu n'avait nulle part où revenir. L'arbitrage du dirigeant (2026-08-14) : « c'est
 * une équipe », la ligne du chantier les porte tous les deux, dans les deux sens.
 *
 * ⚠️ CE N'EST PAS UNE SECONDE LIGNE, et la distinction commande tout le reste. Une seconde
 * ligne aurait voulu dire un second canal par chantier, une seconde inscription au registre, et
 * un candidat de plus à la sélection par pane du chemin sortant — le défaut mesuré de
 * T-20260813-0078, rejoué par le mécanisme censé aider. C'est la MÊME ligne, le MÊME canal, le
 * MÊME `--a <chantier>` : un porteur de plus, rien d'autre.
 *
 * ⚠️ ET C'EST UN POINT DE LECTURE UNIQUE, pour la raison qui vaut partout ici : un
 * `l.pane === pane` recopié ailleurs continuerait de ne voir qu'un porteur, et la ligne
 * deviendrait indésignable selon d'où on la regarde. Ce qui lit ENCORE `l.pane` seul le fait
 * exprès — le garde d'ouverture compte les lignes que l'agent doit ouvrir LUI-MÊME, et une
 * ligne qu'un pair lui a partagée n'en est pas une.
 */
export function panesDeLigne(ligne) {
  return [ligne?.pane, ligne?.pair?.pane].filter(Boolean);
}

/**
 * LES PORTEURS D'UNE LIGNE, CHACUN AVEC SA SESSION (T-20260816-0035).
 *
 * ⚠️ POURQUOI UN NUMÉRO DE PANE NE SUFFIT PAS À DÉSIGNER UN PORTEUR. Onze sessions herdr
 * vivent sur ce poste et NUMÉROTENT LEURS PANES INDÉPENDAMMENT. Mesuré le 2026-08-15 : deux
 * chantiers de deux CLIENTS différents portaient le même `w5:p3` — l'un sur `actionprogex`,
 * l'autre sur `somcraft`. Un agent qui parlait sans destinataire explicite pouvait donc
 * atteindre le canal d'un client qui n'était pas le sien. Le pire cas de ce dépôt n'est pas un
 * message perdu, c'est un message LIVRÉ AU MAUVAIS CLIENT.
 *
 * ⚠️ LE DISCRIMINANT EXISTAIT DÉJÀ, et c'est ce qui rend ce correctif petit : `herdr_socket`
 * est inscrit à l'ouverture et renseigné sur 25 lignes ouvertes sur 25 (mesuré). La donnée
 * était là ; c'est la recherche qui l'ignorait — encore « une porte sur deux ».
 *
 * ⚠️ ET CHAQUE PORTEUR PORTE LA SIENNE. Le pair d'une ligne partagée vit dans SA session, pas
 * dans celle du propriétaire. Rattacher son pane au socket du propriétaire rendrait la ligne
 * invisible depuis chez lui — le défaut de T-20260814-0093, rejoué par le mécanisme censé le
 * protéger. Un porteur sans socket connu rend `null` : c'est un porteur qu'on ne sait pas
 * situer, jamais un porteur qui serait « de partout ».
 */
export function porteursDeLigne(ligne) {
  const porteurs = [];
  if (ligne?.pane) porteurs.push({ pane: ligne.pane, socket: ligne.herdr_socket || null });
  if (ligne?.pair?.pane) porteurs.push({ pane: ligne.pair.pane, socket: ligne.pair.herdr_socket || null });
  return porteurs;
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

/**
 * Les noms de canaux déjà occupés — et « occupé » a changé de sens avec T-20260814-0085.
 *
 * ⚠️ RELEVÉ EN REVUE DE FOND, et c'est un effet de bord du correctif lui-même.
 *
 * Cette fonction ne comptait que les lignes OUVERTES : un chantier clos libérait son nom. Ça
 * ne coûtait rien tant qu'une ligne interne s'archivait à la fermeture — une collision
 * retombait alors sur `CanalArchive`, un refus explicite que quelqu'un lisait.
 *
 * Depuis qu'une ligne est DURABLE par défaut, son canal SURVIT à la fermeture. Un autre
 * chantier, sans rapport, qui produirait le même nom normalisé — deux titres qui se
 * ressemblent, ça arrive — ne verrait aucune collision ici, tomberait sur `name_taken` côté
 * Slack, et **reprendrait silencieusement le canal de l'ancien** : son historique et ses
 * membres, rattachés à un chantier qui n'a rien à voir. Le correctif aurait remplacé une
 * panne bruyante par une confusion muette.
 *
 * `saufCle` est ce qui garde le cycle nominal ouvert : une ligne ne se fait pas concurrence à
 * elle-même, sinon refermer puis rouvrir SON PROPRE chantier repartirait sur un « -2 » et
 * perdrait le lien avec le chantier tel qu'il était nommé — c'est-à-dire exactement ce que
 * T-20260814-0085 existe pour réparer.
 *
 * Une ligne close JETABLE, elle, ne retient rien : son canal est archivé, et Slack refusera
 * l'homonyme de lui-même, par un refus qui se lit.
 *
 * ⚠️ ET UNE LIGNE CLOSE CLIENTE NE RETIENT RIEN NON PLUS — c'est LE RELÈVEMENT, et il ne doit
 * pas être pris pour une collision. Le canal d'un client lui appartient : quand notre session
 * meurt, une session NEUVE doit pouvoir s'y rattacher et reprendre la relation — qu'elle porte
 * la même clé que la morte (même lieu d'agent, depuis T-20260827-0033) ou une autre (lieu
 * refait ailleurs). Les deux chemins mènent ici, et aucun ne doit buter sur un nom retenu. Retenir son nom l'aurait envoyée sur un « -2 », c'est-à-dire un
 * canal vide à côté de celui où le client parle — la panne qu'on est en train de fermer,
 * rejouée sur le seul canal qui n'est pas à nous. La première écriture de cette garde a fait
 * exactement ça, et l'essai du relèvement l'a arrêtée.
 */
export function nomsPris(registre, { saufCle = null } = {}) {
  const pris = new Set();
  for (const l of registre.lignes) {
    if (saufCle && cleDeLigne(l.chantier, l.worktree) === saufCle) continue;
    const retient = !l.close_le || (natureDe(l) !== 'client' && jetabiliteDe(l) !== 'jetable');
    if (retient) pris.add(l.canal_nom);
  }
  return pris;
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

/**
 * TOUS les canaux communs, celui d'avant compris.
 *
 * Rend `{role, canal_id, canal_nom, autorises}` — `role` valant `null` pour le canal désigné
 * par une version qui ne connaissait pas les rôles. **Cette liste est celle que la garde
 * parcourt**, et elle inclut l'orphelin exprès : ce qu'on cesse de diffuser, on ne cesse pas de
 * protéger. Ce qui se DIFFUSE, en revanche, se lit par `communPourCanal`, qui rend le rôle.
 */
export function canauxCommuns(registre) {
  const table = registre?.communs || {};
  const par_role = Object.entries(table)
    .filter(([, c]) => c && c.canal_id)
    .map(([role, c]) => ({ ...c, role }));
  const orphelin = registre?.commun;
  return orphelin?.canal_id ? [...par_role, { ...orphelin, role: null }] : par_role;
}

/** Le canal commun désigné pour un rôle, ou `null`. */
export function canalCommunDuRole(registre, role) {
  return registre?.communs?.[role] || null;
}

/** Le canal commun désigné SANS rôle par une version antérieure — gardé, jamais diffusé. */
export function canalCommunSansRole(registre) {
  return registre?.commun || null;
}

/**
 * L'entrée du canal commun qui porte cet identifiant — avec son `role`, ou `null`.
 *
 * C'est ce que lit la diffusion : un canal dont le `role` est `null` ne s'adresse à personne
 * qu'on puisse nommer, donc il ne diffuse pas. Deviner « probablement tout le monde » serait
 * très exactement le comportement que ce lot supprime.
 */
export function communPourCanal(registre, canalId) {
  if (!canalId) return null;
  return canauxCommuns(registre).find((c) => c.canal_id === canalId) || null;
}

/**
 * Ce canal est-il UN canal commun ?
 *
 * Point de lecture unique, et c'est voulu : chaque geste qui écrit dans un canal doit pouvoir
 * poser la question d'une seule façon. Un test d'égalité recopié à cinq endroits en oublie un,
 * et l'oubli est du côté qui coûte — une parole d'agent chez tous les agents.
 *
 * IL EN EXISTE PLUSIEURS DEPUIS T-20260814-0002, et c'est précisément pourquoi la question ne
 * doit se poser qu'ici : une garde écrite contre « le » canal commun aurait laissé passer le
 * second dès le jour de sa désignation.
 */
export function estCanalCommun(registre, canalId) {
  return Boolean(canalId && canauxCommuns(registre).some((c) => c.canal_id === canalId));
}

// ————————————————————————————————————————————————————————————————— le dirigeant du poste

/**
 * QUI EST LE DIRIGEANT, SUR CE POSTE — désigné une fois, jamais recopié dans un dépôt.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI IL VIT ICI ET PAS DANS LE LIEU DE L'AGENT (T-20260813-0076)
 *
 * La ligne du gestionnaire vers le dirigeant est INTERNE : canal public, autorisation par
 * liste d'invités. Sans invité, `autorise()` refuse tout le monde — la ligne existerait et
 * personne ne pourrait y écrire, le dirigeant le premier. Il faut donc un courriel au moment
 * d'ouvrir.
 *
 * Le mettre dans le lieu du gestionnaire aurait fait partir le courriel du dirigeant dans le
 * dépôt VERSIONNÉ d'un client — un renseignement personnel de chez nous, chez eux, pour
 * toujours et dans chaque dépôt. Le poste le sait déjà et n'a aucune raison de le dire deux
 * fois : l'agent demande « le dirigeant » (`--au-dirigeant`) et n'apprend jamais son adresse.
 *
 * Ce n'est PAS une ligne : aucun pane, aucun chantier, aucun canal. Rien ici n'entre dans
 * `lignes[]`, donc rien n'en fait un candidat à la sélection du chemin sortant — la même
 * raison exactement qui tient le canal commun à l'écart.
 */
export function dirigeantDuPoste(registre) {
  return registre?.dirigeant || null;
}

/**
 * Désigne le dirigeant du poste. Idempotent : c'est la même personne pour tous les agents.
 *
 * On exige l'IDENTIFIANT Slack, pas le courriel : c'est lui qui sert à autoriser une parole
 * (`autorise()` compare des identifiants), et le résoudre au moment d'ouvrir une ligne aurait
 * remis un appel réseau — donc un échec possible — sur le chemin de la naissance. Le courriel
 * n'est conservé que pour être RELU par un humain qui se demanderait qui est désigné.
 */
export function designerDirigeant(registre, { id, courriel }) {
  registre.dirigeant = { id, courriel: courriel || null };
  return registre.dirigeant;
}

// ————————————————————————————————————————————————————— la ligne que l'agent DÉSIGNE

/**
 * Les motifs de refus de la sélection. Nommés, parce que le message en clair est écrit par la
 * commande — un test qui vérifierait ce message ne prouverait rien du routage.
 */
export const REFUS_SELECTION = {
  AUCUNE: 'aucune_ligne',
  NOM_REQUIS: 'nom_requis',
  NOM_INCONNU: 'nom_inconnu',
  NOM_AMBIGU: 'nom_ambigu',
};

/**
 * Ramène une désignation à sa forme comparable — accents, casse, ponctuation et `#` aplatis.
 *
 * C'est la même normalisation d'esprit que celle des noms de canaux : un agent qui écrit
 * `--a "Espace client Acme"` vise le canal `#espace-client-acme`, et lui refuser sa ligne pour
 * une majuscule serait un refus qui n'apprend rien. Ce qu'on n'aplatit PAS, c'est la
 * différence entre deux lignes : deux désignations distinctes le restent.
 */
export function normaliserDesignation(nom) {
  return String(nom ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Sous quels noms une ligne peut être DÉSIGNÉE : son chantier, son canal.
 *
 * DEUX CLÉS, JAMAIS SA NATURE — et l'écart n'est pas théorique. La nature tombe juste par
 * coïncidence chez un gestionnaire (sa ligne client est `client`, celle du dirigeant est
 * `interne`) et se casse au cas suivant : un orchestrateur a sa ligne ET d'autres canaux, tous
 * `interne`. Deux candidats, même genre, et on serait revenu au premier arrivé. C'est
 * l'identité qui tranche.
 *
 * On lit `canal` (la forme rendue par `etat()`) ET `canal_nom` (la forme du registre) : la même
 * sélection sert des deux côtés, et n'en lire qu'une rendrait une ligne indésignable selon d'où
 * on l'appelle.
 */
export function designationsDeLigne(ligne) {
  return [ligne?.chantier, ligne?.canal, ligne?.canal_nom]
    .map(normaliserDesignation)
    .filter(Boolean);
}

/** Ce sous quoi une ligne se présente à qui doit la nommer — le chantier d'abord, il est court. */
export function nomsDesignables(candidates) {
  return (candidates || []).map((l) => l.chantier || l.canal || l.canal_nom).filter(Boolean);
}

/**
 * La ligne que l'agent DÉSIGNE depuis ce pane — la sélection que fait la commande quand il
 * dit, ferme ou renomme.
 *
 * ELLE VIVAIT DANS `bin/ligne-directe.js`, recopiée à trois endroits. Elle est ici pour une
 * raison précise : le canal commun promet de ne jamais passer par ce chemin, et une promesse
 * ne se prouve pas contre une copie du code — un test qui réécrirait ce `.filter` prouverait
 * seulement que le test est d'accord avec lui-même. Il appelle donc la fonction que la
 * commande appelle.
 *
 * LE RENVERSEMENT (T-20260813-0078) : elle rendait la PREMIÈRE INSCRITE quand un pane portait
 * plusieurs lignes, et ignorait l'autre en silence — un rapport destiné à un chantier est parti
 * dans le canal d'un autre, avec `ok:true`. Elle ne devine plus : dès qu'il y a un choix, le
 * nom est exigé, et son absence est un REFUS. L'incertitude tombe du côté prudent, parce que
 * l'autre côté envoie au client ce qui ne lui était pas destiné.
 *
 * Un seul candidat n'exige aucun nom : c'est toute la configuration de production d'aujourd'hui,
 * et rien de ce qui tourne ne casse.
 *
 * UN NOM QUI NE DÉSIGNE RIEN EST AUSSI UN REFUS, même avec un seul candidat. Se rabattre sur
 * l'unique ligne parce qu'elle est là serait rendre le nom décoratif : un agent qui se trompe
 * de nom se trompe de destinataire, et c'est exactement ce qu'on refuse de deviner.
 *
 * @returns {{ligne: object|null, candidates: object[], refus: {motif: string, nom?: string, noms: string[]}|null}}
 */
export function ligneDuPane(ouvertes, pane, nom = null, { socket = null } = {}) {
  //
  // ⚠️ ET LE DISQUE N'ENTRE PAS ICI (T-20260816-0083). Une ligne dont le worktree a disparu
  // attend bien le prochain occupant de son numéro — mais la traiter par un FILTRE laisserait
  // le registre DIRE qu'elle est ouverte pendant qu'on la cache : deux sources de vérité qui
  // divergent en silence, le motif que ce dépôt paie le plus cher. On soigne le fait, pas sa
  // lecture — voir `hygiene.js`, qui SIGNALE ces lignes avec le geste qui les referme.
  const candidates = (ouvertes || []).filter((l) =>
    porteursDeLigne(l).some(
      (porteur) => porteur.pane === pane && !(socket && porteur.socket && porteur.socket !== socket)
    )
  );
  const noms = nomsDesignables(candidates);
  if (!candidates.length) return { ligne: null, candidates, refus: { motif: REFUS_SELECTION.AUCUNE, noms } };

  // « AUCUN NOM DONNÉ » ET « UN NOM QUI NE VEUT RIEN DIRE » NE SONT PAS LA MÊME CHOSE — relevé
  // en revue de fond. La normalisation aplatit `--a "---"`, `--a "!!!"` et `--a ""` sur la chaîne
  // vide : les confondre avec l'absence d'option rendait le nom DÉCORATIF dès qu'il n'y avait
  // qu'un candidat, en contradiction avec ce que la commande promet. Qui a tapé `--a` a voulu
  // désigner quelqu'un ; s'il n'a désigné personne, on refuse.
  if (nom == null) {
    if (candidates.length > 1) return { ligne: null, candidates, refus: { motif: REFUS_SELECTION.NOM_REQUIS, noms } };
    return { ligne: candidates[0], candidates, refus: null };
  }

  const vise = normaliserDesignation(nom);
  if (!vise) return { ligne: null, candidates, refus: { motif: REFUS_SELECTION.NOM_INCONNU, nom, noms } };

  const vises = candidates.filter((l) => designationsDeLigne(l).includes(vise));
  if (vises.length === 1) return { ligne: vises[0], candidates, refus: null };
  // Deux lignes qui répondent au même nom : le registre n'a pas de quoi les distinguer, et
  // choisir serait rejouer le défaut qu'on corrige, une couche plus haut.
  const motif = vises.length ? REFUS_SELECTION.NOM_AMBIGU : REFUS_SELECTION.NOM_INCONNU;
  return { ligne: null, candidates, refus: { motif, nom, noms } };
}

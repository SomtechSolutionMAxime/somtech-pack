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
export function ligneDuPane(ouvertes, pane, nom = null) {
  const candidates = (ouvertes || []).filter((l) => l.pane === pane);
  const noms = nomsDesignables(candidates);
  if (!candidates.length) return { ligne: null, candidates, refus: { motif: REFUS_SELECTION.AUCUNE, noms } };

  const vise = normaliserDesignation(nom);
  if (!vise) {
    if (candidates.length > 1) return { ligne: null, candidates, refus: { motif: REFUS_SELECTION.NOM_REQUIS, noms } };
    return { ligne: candidates[0], candidates, refus: null };
  }

  const vises = candidates.filter((l) => designationsDeLigne(l).includes(vise));
  if (vises.length === 1) return { ligne: vises[0], candidates, refus: null };
  // Deux lignes qui répondent au même nom : le registre n'a pas de quoi les distinguer, et
  // choisir serait rejouer le défaut qu'on corrige, une couche plus haut.
  const motif = vises.length ? REFUS_SELECTION.NOM_AMBIGU : REFUS_SELECTION.NOM_INCONNU;
  return { ligne: null, candidates, refus: { motif, nom, noms } };
}

// slack.js — le strict nécessaire de l'API Slack, sans dépendance.
//
// Aucune bibliothèque tierce : `fetch` et `WebSocket` sont natifs à Node. C'est un choix,
// pas une économie de bouts de chandelle — chaque poste Somtech porterait ces dépendances,
// et le chemin de publication du pack a déjà montré qu'il sait les perdre en silence.
//
// Les erreurs de Slack sont relayées telles quelles : `not_authed` (aucun jeton reçu) et
// `invalid_auth` (jeton refusé) ne veulent pas dire la même chose, et un veilleur qui les
// aplatit en « échec d'authentification » fait chercher au mauvais endroit.

import { enEssais, transportRemplace, refuser } from './cloison.js';

const BASE = 'https://slack.com/api';

/**
 * Le transport tel qu'il est à l'ouverture du module — la référence de la cloison d'essais.
 * Un test qui monte un faux Slack remplace `globalThis.fetch` ; tant qu'il ne l'a pas fait,
 * un appel partirait vers slack.com pour de bon.
 */
const TRANSPORT_NATIF = globalThis.fetch;

export class ErreurSlack extends Error {
  constructor(methode, code, details) {
    super(`Slack a refusé ${methode} : ${code}`);
    this.name = 'ErreurSlack';
    this.methode = methode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Encode les arguments comme Slack les attend TOUJOURS : en formulaire.
 *
 * MESURÉ CONTRE LE VRAI SLACK, et ça a rendu toute la capacité inerte : le corps JSON
 * n'est servi que par une PARTIE des méthodes d'écriture. Les méthodes de lecture
 * (`conversations.members`, `conversations.list`, `conversations.info`, `users.list`…) ne
 * le lisent pas — et elles ne s'en plaignent pas non plus. Elles s'exécutent simplement
 * avec zéro argument : `conversations.members` répond « missing required field: channel »,
 * `conversations.list` rend ses défauts (100 canaux, publics seulement) comme si de rien
 * n'était. Une ligne cliente naissait donc avec une liste d'autorisés VIDE, et refusait
 * poliment le premier message de chaque personne du client — pour toujours.
 *
 * Le formulaire, lui, est accepté par toutes les méthodes sans exception. On l'utilise
 * donc partout : il n'y a aucun appel pour lequel il soit le mauvais choix, et une règle
 * uniforme ne peut pas se tromper de méthode.
 *
 * Deux pièges propres à cet encodage, tenus ici :
 *   - une valeur absente doit être ABSENTE, pas envoyée comme le mot « undefined » —
 *     Slack prendrait `cursor=undefined` pour un vrai curseur et rendrait une page vide ;
 *   - un argument composé (`blocks`, `attachments`) se transmet en texte JSON DANS le
 *     champ de formulaire. Le code n'en envoie pas aujourd'hui ; celui qui en ajoutera un
 *     demain n'aura pas à redécouvrir la règle.
 */
function encoderFormulaire(corps) {
  const champs = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(corps)) {
    if (valeur === undefined || valeur === null) continue;
    champs.set(cle, typeof valeur === 'object' ? JSON.stringify(valeur) : String(valeur));
  }
  return champs.toString();
}

/**
 * Appelle une méthode de l'API Slack.
 * @param {string} methode ex. 'chat.postMessage'
 * @param {string} jeton
 * @param {object} corps
 */
export async function appeler(methode, jeton, corps = {}, { essais = 3 } = {}) {
  // DEUXIÈME MUR. Il vaut même si le premier tombe — un jeton pourrait arriver autrement
  // (variable d'environnement d'un poste, jeton injecté par un test mal cloisonné).
  if (enEssais() && !transportRemplace(TRANSPORT_NATIF, globalThis.fetch)) {
    refuser(
      `l'appel Slack « ${methode} »`,
      'Aucun double n’a été monté : cet appel partirait vers l’espace Slack de production.'
    );
  }
  const charge = encoderFormulaire(corps);
  for (let essai = 1; ; essai += 1) {
    const reponse = await fetch(`${BASE}/${methode}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jeton}`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body: charge,
    });

    // Slack plafonne ses méthodes et le dit par un 429 + Retry-After. Ignorer cet en-tête,
    // c'est transformer une attente d'une seconde en échec définitif — et l'annuaire des
    // membres, plafonné bas, est justement celui qu'on interroge à chaque ouverture.
    if (reponse.status === 429 && essai <= essais) {
      const attente = Number(reponse.headers.get('retry-after') || 1);
      await new Promise((r) => setTimeout(r, Math.min(attente, 30) * 1000));
      continue;
    }

    const data = await reponse.json();
    if (!data.ok) {
      if (data.error === 'ratelimited' && essai <= essais) {
        await new Promise((r) => setTimeout(r, essai * 1000));
        continue;
      }
      throw new ErreurSlack(methode, data.error || 'erreur_inconnue', data);
    }
    return data;
  }
}

/**
 * Une pièce qui n'a pas pu être rapatriée. Porte un CODE, jamais une phrase à reconnaître :
 * c'est lui que l'appelant lit pour décider ce qu'il dit — et ce qu'il dit dépend du registre
 * de langage, pas du texte de cette erreur.
 *
 * Le jeton n'entre dans aucun de ces champs, et c'est délibéré : un message d'erreur voyage
 * dans les journaux, dans les rapports, parfois jusque dans un canal. C'est la sortie la plus
 * distraite du système, donc celle qu'on garde le plus.
 */
export class ErreurFichierSlack extends Error {
  constructor(code, detail) {
    super(`la pièce n'a pas pu être récupérée (${code})`);
    this.name = 'ErreurFichierSlack';
    this.code = code;
    this.detail = detail || null;
  }
}

/**
 * Rapatrie une pièce déposée dans un canal.
 *
 * **Ce n'est PAS un appel d'API** : autre hôte (`files.slack.com`), autre méthode (un GET),
 * autre forme de réponse (des octets). Une seule chose ne change pas — il faut présenter le
 * jeton, parce que les adresses de fichiers Slack sont privées. C'est précisément pour ça que
 * rien n'arrivait jusqu'ici.
 *
 * DEUX PIÈGES TENUS ICI, et le premier ne se signale pas :
 *
 *   1. **Sans le droit `files:read`, Slack ne refuse pas.** Il répond `200` avec la page de
 *      connexion en HTML. Un code qui se fie au code de réponse déposerait cette page sur le
 *      poste, l'appellerait « capture.png », et l'agent ouvrirait un formulaire de connexion.
 *      On regarde donc le TYPE de ce qui revient, pas seulement le code.
 *   2. **La taille annoncée peut mentir.** On la vérifie avant de lire, puis on vérifie ce
 *      qu'on a réellement reçu : c'est le second contrôle qui protège la mémoire du poste.
 *
 * @returns {{octets: Buffer, mime: string|null}}
 */
export async function telechargerFichier(jetonRobot, fichier, { tailleMax = Infinity } = {}) {
  const adresse = fichier?.url_private_download || fichier?.url_private;
  if (!adresse) throw new ErreurFichierSlack('adresse_absente');

  // MÊME MUR QUE POUR L'API, et il vaut autant : ceci sort du poste vers Slack, avec le jeton
  // de production. Une suite de tests n'a rien à faire sur files.slack.com.
  if (enEssais() && !transportRemplace(TRANSPORT_NATIF, globalThis.fetch)) {
    refuser(
      'le téléchargement d’une pièce Slack',
      'Aucun double n’a été monté : cet appel partirait vers l’espace Slack de production.'
    );
  }

  const reponse = await fetch(adresse, { headers: { Authorization: `Bearer ${jetonRobot}` } });
  if (reponse.status !== 200) throw new ErreurFichierSlack('refus', `code ${reponse.status}`);

  const type = String(reponse.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (type === 'text/html') {
    throw new ErreurFichierSlack('droit_manquant', 'Slack a rendu sa page de connexion — la portée files:read manque à l’application');
  }

  const annoncee = Number(reponse.headers.get('content-length') || 0);
  if (annoncee > tailleMax) throw new ErreurFichierSlack('trop_lourde', `${annoncee} octets annoncés`);

  const octets = Buffer.from(await reponse.arrayBuffer());
  if (!octets.length) throw new ErreurFichierSlack('vide');
  if (octets.length > tailleMax) throw new ErreurFichierSlack('trop_lourde', `${octets.length} octets reçus`);
  return { octets, mime: type || null };
}

/** Ouvre la connexion d'écoute permanente et rend son adresse. */
export async function ouvrirEcoute(jetonEcoute) {
  const { url } = await appeler('apps.connections.open', jetonEcoute);
  return url;
}

/** Identité du robot — sert de garde-fou anti-boucle : on ignore nos propres messages. */
export async function identite(jetonRobot) {
  const d = await appeler('auth.test', jetonRobot);
  return { equipe: d.team, robot: d.bot_id, utilisateur: d.user_id, url: d.url };
}

/**
 * Un refus qu'il ne sert à RIEN de réessayer — et cette propriété n'est pas décorative :
 * c'est elle que l'appelant lit pour décider s'il relaie le message ou s'il laisse remonter.
 *
 * Elle existe parce qu'un test qui vérifie la présence de certains mots dans un message ne
 * prouve rien de ce que le message DIT. Remplacer tout le texte d'un refus définitif par
 * « réessaie dans quelques minutes » — le contresens exact — passait au vert. En liant le
 * texte à un fait que le code utilise, le contresens devient détectable : une erreur
 * `reessayable = false` dont le texte invite à réessayer se contredit elle-même, et c'est
 * cette contradiction qu'on garde, pas un vocabulaire.
 */
export class RefusDefinitif extends Error {
  constructor(message) {
    super(message);
    this.name = 'RefusDefinitif';
    /** Réessayer ne changera rien : la situation demande un geste, pas de la patience. */
    this.reessayable = false;
  }
}

/**
 * Le canal repris n'a pas la confidentialité demandée. On refuse, on ne s'accommode pas.
 *
 * RELEVÉ EN REVUE, et c'était le défaut que tout ce chantier existe pour supprimer : la
 * reprise d'un canal existant rendait le canal tel quel, en JETANT son `is_private`. Un
 * canal client tombant sur un homonyme public naissait donc public, s'inscrivait au
 * registre comme « client », et son autorisation-par-appartenance ouvrait la ligne à
 * quiconque peut entrer dans un canal public. Les deux défauts d'un coup, en silence.
 */
export class ConfidentialiteIncompatible extends RefusDefinitif {
  constructor(nom, demandee, reelle) {
    super(
      `le canal #${nom} existe déjà et il est ${reelle ? 'privé' : 'public'} — ` +
        `on en demandait un ${demandee ? 'privé' : 'public'}. ` +
        // LE CONSEIL A CHANGÉ, et l'ancien était dangereux : il proposait d'archiver le
        // canal qui gêne. Suivre ce conseil détruit sans retour un canal d'équipe — on ne
        // sait pas désarchiver (voir `CanalArchive`) — pour libérer un nom. Renommer est
        // réversible et obtient la même chose ; c'est donc ce qu'on propose.
        `Donne un --titre qui mène à un autre nom, ou fais renommer #${nom} dans Slack. ` +
        `N'archive pas #${nom} pour libérer son nom : l'archivage est sans retour.`
    );
    this.name = 'ConfidentialiteIncompatible';
    this.canal = nom;
    this.demandee = Boolean(demandee);
    this.reelle = Boolean(reelle);
  }
}

/**
 * Le canal existe, mais il est archivé — donc en lecture seule, et hors de notre portée.
 *
 * Erreur NOMMÉE plutôt que message à reconnaître : l'appelant doit pouvoir la distinguer
 * d'une panne passagère, parce que la suite n'est pas la même. Une panne se retente ; ceci
 * ne se retente jamais et demande un geste humain.
 */
export class CanalArchive extends RefusDefinitif {
  constructor(canal, id) {
    super(
      `#${canal} est archivé : un canal archivé est en lecture seule, et le désarchiver ` +
        `n'est pas à notre portée — Slack le réserve à un compte humain. ` +
        `Fais-le sortir des archives à la main dans Slack (#${canal}, ${id}), puis recommence.`
    );
    this.name = 'CanalArchive';
    this.canal = canal;
    this.id = id;
  }
}

/**
 * Crée un canal. Slack impose des noms en minuscules, sans espace ni accent, 80 car. max.
 * Si le canal existe déjà, on le rejoint plutôt que d'échouer : rouvrir une ligne sur un
 * chantier repris est un cas normal, pas une erreur — MAIS seulement à confidentialité
 * égale, et le `prive` rendu est toujours celui du canal RÉEL, jamais celui qu'on espérait.
 */
export async function creerCanal(jetonRobot, nom, prive = false) {
  try {
    const d = await appeler('conversations.create', jetonRobot, { name: nom, is_private: prive });
    return { id: d.channel.id, nom: d.channel.name, prive: Boolean(d.channel.is_private), reutilise: false };
  } catch (err) {
    if (err.code !== 'name_taken') throw err;
    const existant = await trouverCanal(jetonRobot, nom);
    if (!existant) throw err;
    // AVANT de désarchiver et de rejoindre : on ne s'installe pas dans un canal qu'on va
    // refuser. Le nom vient du titre du chantier — un titre portant le nom d'un client
    // tombe très naturellement sur un canal déjà existant à ce nom.
    if (Boolean(existant.is_private) !== Boolean(prive)) {
      throw new ConfidentialiteIncompatible(nom, prive, existant.is_private);
    }
    // UN CANAL ARCHIVÉ EST PERDU POUR NOUS, et il faut le dire au lieu de faire semblant.
    //
    // Ce code tentait `conversations.unarchive`. Slack ne sert cette méthode qu'à un jeton
    // d'utilisateur — le nôtre est un jeton de robot, le seul dont ce composant dispose.
    // L'appel ne pouvait donc pas aboutir : il donnait au lecteur, et aux tests, la
    // certitude fausse qu'on savait rattraper une situation qu'on ne sait pas rattraper.
    //
    // Conséquence à connaître : tout canal client archivé — y compris ceux archivés avant
    // que ce chemin ne soit fermé — ne se rejoint plus par le code. Le geste qui le lève
    // est humain, il prend trente secondes dans Slack, et c'est exactement pour ça que le
    // refus doit le nommer plutôt que de laisser tomber une erreur brute au premier message.
    if (existant.is_archived) throw new CanalArchive(nom, existant.id);
    await rejoindreCanal(jetonRobot, existant.id);
    // On rend la confidentialité DU CANAL, pas celle qu'on demandait.
    //
    // MUTATION ÉQUIVALENTE, dite plutôt que maquillée : remplacer ceci par `Boolean(prive)`
    // survit à toute la suite, et c'est normal — le garde-fou juste au-dessus a déjà prouvé
    // que les deux sont égaux ici. Aucun test ne peut les départager, et en inventer un
    // serait décoratif. Ce qui est prouvé, c'est le garde-fou lui-même : le retirer fait
    // rougir. On garde la formulation qui énonce un FAIT plutôt qu'un souhait, parce que
    // c'est elle qui reste juste si quelqu'un déplace le garde-fou un jour.
    return { id: existant.id, nom: existant.name, prive: Boolean(existant.is_private), reutilise: true };
  }
}

/**
 * Ce que Slack sait d'un canal — et surtout : est-il PRIVÉ ?
 *
 * Cette question tranche le sort d'un message arrivé dans un canal dont aucune ligne n'est au
 * registre. Un canal public où notre robot figure est un canal d'équipe : on n'y répond pas,
 * sous peine de devenir un importun. Un canal PRIVÉ, lui, ne s'obtient pas par hasard — on
 * nous y a mis à la main, et c'est presque toujours celui d'un client dont la ligne s'est
 * perdue. Le silence y est le pire résultat possible.
 *
 * Demande `channels:read` (public) ou `groups:read` (privé) — les deux sont déjà exigés.
 */
export async function infoCanal(jetonRobot, canal) {
  const d = await appeler('conversations.info', jetonRobot, { channel: canal });
  const c = d.channel || {};
  return { id: c.id, nom: c.name, prive: Boolean(c.is_private), archive: Boolean(c.is_archived) };
}

/** Cherche un canal par son nom, archives comprises. */
export async function trouverCanal(jetonRobot, nom) {
  let curseur;
  do {
    const d = await appeler('conversations.list', jetonRobot, {
      types: 'public_channel,private_channel',
      exclude_archived: false,
      limit: 1000,
      cursor: curseur,
    });
    const trouve = d.channels.find((c) => c.name === nom);
    if (trouve) return trouve;
    curseur = d.response_metadata?.next_cursor || '';
  } while (curseur);
  return null;
}

/**
 * Les membres d'un canal — c'est-à-dire, sur un canal PRIVÉ, la liste de ceux qui ont le
 * droit d'y parler.
 *
 * Un canal privé est invisible et on ne s'y invite pas soi-même : y être, c'est y avoir
 * été mis par un humain. Ce geste EST l'autorisation, ce qui évite d'entretenir une
 * seconde liste en parallèle de la réalité Slack — et c'est la divergence entre les deux
 * qui écarterait un client en silence.
 *
 * Demande `groups:read` pour un canal privé (`channels:read` pour un public).
 */
export async function membresDuCanal(jetonRobot, canal) {
  const membres = [];
  let curseur;
  do {
    const d = await appeler('conversations.members', jetonRobot, { channel: canal, limit: 200, cursor: curseur });
    membres.push(...(d.members || []));
    curseur = d.response_metadata?.next_cursor || '';
  } while (curseur);
  return membres;
}

export async function rejoindreCanal(jetonRobot, canal) {
  try {
    await appeler('conversations.join', jetonRobot, { channel: canal });
  } catch (err) {
    // Déjà dedans : ce n'est pas un échec.
    if (err.code !== 'already_in_channel' && err.code !== 'method_not_supported_for_channel_type') throw err;
  }
}

/** Invite des membres. Ceux qui y sont déjà ne font pas échouer l'ouverture d'une ligne. */
export async function inviter(jetonRobot, canal, utilisateurs) {
  if (!utilisateurs.length) return;
  try {
    await appeler('conversations.invite', jetonRobot, { channel: canal, users: utilisateurs.join(',') });
  } catch (err) {
    if (err.code !== 'already_in_channel' && err.code !== 'cant_invite_self') throw err;
  }
}

export async function definirSujet(jetonRobot, canal, sujet) {
  try {
    await appeler('conversations.setPurpose', jetonRobot, { channel: canal, purpose: sujet.slice(0, 250) });
  } catch {
    // Le sujet est un confort, pas une condition de la ligne.
  }
}

/**
 * Poste un message SOUS L'IDENTITÉ DE L'AGENT — c'est ce qui fait que trois chantiers
 * actifs ressemblent à trois interlocuteurs distincts avec une seule application déclarée.
 */
export async function poster(jetonRobot, { canal, texte, nom, emoji }) {
  const d = await appeler('chat.postMessage', jetonRobot, {
    channel: canal,
    text: texte,
    username: nom,
    icon_emoji: emoji,
    unfurl_links: false,
    unfurl_media: false,
  });
  return d.ts;
}

/**
 * Renomme un canal.
 *
 * Ne JAMAIS renommer à la main dans Slack quand une ligne est ouverte : l'identifiant du
 * canal ne change pas, donc les messages continuent d'arriver — mais le registre garde
 * l'ancien nom et se met à mentir sur ce qui est ouvert.
 */
export async function renommerCanal(jetonRobot, canal, nom) {
  const d = await appeler('conversations.rename', jetonRobot, { channel: canal, name: nom });
  return { id: d.channel.id, nom: d.channel.name };
}

export async function archiverCanal(jetonRobot, canal) {
  try {
    await appeler('conversations.archive', jetonRobot, { channel: canal });
    return true;
  } catch (err) {
    if (err.code === 'already_archived') return true;
    return false;
  }
}

/**
 * Le nom d'usage d'un membre — pour que le cadre remis dans un pane NOMME l'auteur du
 * message plutôt que de rendre un identifiant illisible.
 *
 * Ne demande que `users:read`, droit déjà exigé par `trouverMembre` : aucune portée
 * supplémentaire, donc aucune réinstallation de l'application.
 *
 * Rend `null` quand le nom ne se résout pas, et n'invente rien : l'appelant retombe sur
 * l'identifiant. Un nom introuvable ne doit jamais empêcher un message d'arriver — c'est
 * l'accessoire, la parole est le principal.
 */
export async function nomDeMembre(jetonRobot, utilisateur) {
  if (!utilisateur) return null;
  const d = await appeler('users.info', jetonRobot, { user: utilisateur });
  const u = d.user || {};
  return u.profile?.display_name || u.profile?.real_name || u.real_name || u.name || null;
}

/**
 * Résout un membre pour l'inviter dans sa ligne.
 *
 * MESURÉ : la recherche par courriel exige le droit `users:read.email`, distinct de
 * `users:read` — sans lui, Slack répond `missing_scope` et le canal se crée sans son
 * destinataire, ce qui est le pire résultat possible (une ligne que personne ne lit).
 * On retombe donc sur l'annuaire, qui ne demande que `users:read` : la partie locale du
 * courriel y suffit presque toujours à identifier quelqu'un, et un identifiant Slack
 * fourni directement court-circuite tout.
 *
 * @param {string} jetonRobot
 * @param {string} qui courriel, identifiant Slack (U…), ou nom d'usage
 */
export async function trouverMembre(jetonRobot, qui) {
  if (!qui) return null;
  if (/^[UW][A-Z0-9]{6,}$/.test(qui)) return qui; // déjà un identifiant Slack

  try {
    const d = await appeler('users.lookupByEmail', jetonRobot, { email: qui });
    return d.user.id;
  } catch (err) {
    if (err.code !== 'missing_scope' && err.code !== 'users_not_found') throw err;
  }

  const cible = qui.toLowerCase();
  const locale = cible.includes('@') ? cible.split('@')[0] : cible;
  const candidats = [cible, locale, locale.replace(/[._-]+/g, ' ')];

  let curseur;
  do {
    const d = await appeler('users.list', jetonRobot, { limit: 200, cursor: curseur });
    for (const u of d.members || []) {
      if (u.deleted || u.is_bot) continue;
      const champs = [u.name, u.real_name, u.profile?.email, u.profile?.display_name, u.profile?.real_name]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      if (champs.some((v) => candidats.includes(v))) return u.id;
    }
    curseur = d.response_metadata?.next_cursor || '';
  } while (curseur);
  return null;
}

// slack.js — le strict nécessaire de l'API Slack, sans dépendance.
//
// Aucune bibliothèque tierce : `fetch` et `WebSocket` sont natifs à Node. C'est un choix,
// pas une économie de bouts de chandelle — chaque poste Somtech porterait ces dépendances,
// et le chemin de publication du pack a déjà montré qu'il sait les perdre en silence.
//
// Les erreurs de Slack sont relayées telles quelles : `not_authed` (aucun jeton reçu) et
// `invalid_auth` (jeton refusé) ne veulent pas dire la même chose, et un veilleur qui les
// aplatit en « échec d'authentification » fait chercher au mauvais endroit.

const BASE = 'https://slack.com/api';

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
 * Appelle une méthode de l'API Slack.
 * @param {string} methode ex. 'chat.postMessage'
 * @param {string} jeton
 * @param {object} corps
 */
export async function appeler(methode, jeton, corps = {}, { essais = 3 } = {}) {
  for (let essai = 1; ; essai += 1) {
    const reponse = await fetch(`${BASE}/${methode}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jeton}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(corps),
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
 * Le canal repris n'a pas la confidentialité demandée. On refuse, on ne s'accommode pas.
 *
 * RELEVÉ EN REVUE, et c'était le défaut que tout ce chantier existe pour supprimer : la
 * reprise d'un canal existant rendait le canal tel quel, en JETANT son `is_private`. Un
 * canal client tombant sur un homonyme public naissait donc public, s'inscrivait au
 * registre comme « client », et son autorisation-par-appartenance ouvrait la ligne à
 * quiconque peut entrer dans un canal public. Les deux défauts d'un coup, en silence.
 */
export class ConfidentialiteIncompatible extends Error {
  constructor(nom, demandee, reelle) {
    super(
      `le canal #${nom} existe déjà et il est ${reelle ? 'privé' : 'public'} — ` +
        `on en demandait un ${demandee ? 'privé' : 'public'}`
    );
    this.name = 'ConfidentialiteIncompatible';
    this.canal = nom;
    this.demandee = Boolean(demandee);
    this.reelle = Boolean(reelle);
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
    // Un canal archivé est en lecture seule : il faut le sortir des archives avant d'y
    // écrire, sinon toute la ligne échoue au premier message.
    if (existant.is_archived) await appeler('conversations.unarchive', jetonRobot, { channel: existant.id });
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

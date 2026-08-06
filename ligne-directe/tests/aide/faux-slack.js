// faux-slack.js — un double de l'API Slack qui REFUSE CE QUE SLACK REFUSE.
//
// POURQUOI CE FICHIER EXISTE, et c'est la leçon la plus chère du chantier :
//
// Les doubles précédents rendaient `{ ok: true }` à tout ce qu'on leur présentait, sans
// jamais regarder COMMENT la requête était encodée. Quatre-vingt-dix-sept tests verts ont
// ainsi couvert une capacité entièrement inerte en production : le code envoyait un corps
// JSON à des méthodes que Slack ne sert qu'en formulaire, Slack jetait les arguments, et
// la ligne cliente démarrait avec une liste d'autorisés vide — donc refusait tout le monde,
// poliment, pour toujours.
//
// Un double plus permissif que le service qu'il imite ne teste rien : il transforme chaque
// test en faux témoin. Celui-ci reproduit donc le MÉCANISME de Slack, pas seulement ses
// réponses heureuses — il n'extrait les arguments que là où Slack les extrait vraiment.
//
// Règle appliquée (documentation Slack, « Web API » / Content types) :
//   - `application/x-www-form-urlencoded` est accepté par TOUTES les méthodes ;
//   - `application/json` n'est accepté que par une PARTIE des méthodes d'écriture.
// Pour les autres, un corps JSON n'est pas une erreur bruyante : il est simplement IGNORÉ,
// et la méthode s'exécute avec zéro argument. C'est ce silence qui a coûté le chantier —
// `conversations.list` rendait 43 canaux publics au lieu des 44 demandés, et personne ne
// voyait passer d'erreur.

/**
 * Les méthodes qui n'acceptent QUE le formulaire. Mesuré contre le vrai Slack pour les
 * trois premières ; les suivantes relèvent de la même famille (méthodes de lecture,
 * interrogeables en GET) et sont listées pour que le double reste juste si le code se met
 * à les appeler.
 */
export const FORMULAIRE_SEULEMENT = new Set([
  'conversations.list',
  'conversations.members',
  'conversations.info',
  'conversations.history',
  'conversations.replies',
  'users.list',
  'users.info',
  'users.lookupByEmail',
]);

function enTete(init, nom) {
  const entetes = init?.headers || {};
  for (const [cle, valeur] of Object.entries(entetes)) {
    if (cle.toLowerCase() === nom.toLowerCase()) return String(valeur);
  }
  return '';
}

/**
 * Extrait les arguments comme Slack les extrait — c'est-à-dire pas toujours.
 * Un corps JSON envoyé à une méthode qui ne le sert pas rend `{}`, silencieusement.
 */
function argumentsRecus(methode, init) {
  const type = enTete(init, 'content-type');
  const corps = init?.body ?? '';
  if (type.includes('application/json')) {
    if (FORMULAIRE_SEULEMENT.has(methode)) return {}; // Slack ne lit pas ce corps-là
    try {
      return JSON.parse(corps || '{}');
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(corps));
}

const vrai = (v) => v === true || v === 'true';

/** Au-delà, ce n'est plus de la pagination : c'est une boucle. */
const PLAFOND_APPELS = 40;

function reponse(charge) {
  return { status: 200, headers: new Map(), async json() { return charge; } };
}

function echec(erreur, extra = {}) {
  return reponse({ ok: false, error: erreur, ...extra });
}

/**
 * Un espace Slack en mémoire, servi à travers `globalThis.fetch`.
 *
 * @param {object} etat
 * @param {Array}  etat.canaux      { id, name, is_private, is_archived, membres:[] }
 * @param {Array}  etat.utilisateurs { id, name, real_name, profile:{email} }
 */
export function fauxSlack({ canaux = [], utilisateurs = [], espace = 'T_ESSAIS', robot = 'UMOI' } = {}) {
  const monde = {
    canaux: canaux.map((c) => ({ is_private: false, is_archived: false, membres: [], ...c })),
    utilisateurs,
    appels: [],
    postes: [],
  };

  let precedent;

  const servir = async (url, init = {}) => {
    const methode = String(url).split('/').pop();
    const args = argumentsRecus(methode, init);
    monde.appels.push({ methode, args, type: enTete(init, 'content-type') });

    // GARDE-FOU DE BOUCLE, et il gagne sa place : quand un curseur de pagination n'atteint
    // pas Slack, l'appelant redemande éternellement la même première page. C'est un vrai
    // symptôme du défaut d'encodage — mais un test qui PEND ne prouve rien à personne, il
    // fait juste expirer la CI sans dire pourquoi. On coupe donc en nommant la cause.
    if (monde.appels.filter((a) => a.methode === methode).length > PLAFOND_APPELS) {
      return echec('essais_boucle', {
        detail: `${methode} appelée plus de ${PLAFOND_APPELS} fois — pagination qui tourne en rond (curseur non transmis ?)`,
      });
    }

    // Slack veut un jeton porteur. Un double qui s'en passe laisserait passer un veilleur
    // qui a perdu son jeton en route.
    if (!enTete(init, 'authorization').startsWith('Bearer ')) return echec('not_authed');

    switch (methode) {
      case 'auth.test':
        return reponse({ ok: true, team: espace, user_id: robot, bot_id: 'B1', url: 'https://essais.slack.com/' });

      case 'apps.connections.open':
        return reponse({ ok: true, url: 'wss://essais.invalide/lien' });

      case 'conversations.create': {
        if (!args.name) return echec('invalid_arguments', { detail: 'missing required field: name' });
        if (monde.canaux.some((c) => c.name === args.name)) return echec('name_taken');
        const canal = {
          id: `C_${args.name}`,
          name: args.name,
          is_private: vrai(args.is_private),
          is_archived: false,
          membres: [robot],
        };
        monde.canaux.push(canal);
        return reponse({ ok: true, channel: canal });
      }

      case 'conversations.list': {
        // Les DÉFAUTS de Slack, et ce sont eux qui font mal : sans `types`, on ne voit
        // que les canaux publics ; sans `limit`, on n'en voit que cent.
        const types = String(args.types || 'public_channel').split(',');
        const inclutPrive = types.includes('private_channel');
        const inclutPublic = types.includes('public_channel');
        const excluteArchives = args.exclude_archived === undefined ? true : vrai(args.exclude_archived);
        const limite = Math.min(Number(args.limit) || 100, 1000);
        const depart = Number(args.cursor || 0);

        const visibles = monde.canaux.filter(
          (c) => (c.is_private ? inclutPrive : inclutPublic) && !(excluteArchives && c.is_archived)
        );
        const page = visibles.slice(depart, depart + limite);
        const suite = depart + limite < visibles.length ? String(depart + limite) : '';
        return reponse({ ok: true, channels: page, response_metadata: { next_cursor: suite } });
      }

      case 'conversations.members': {
        // C'EST L'APPEL QUI DÉCIDE QUI PEUT ÉCRIRE SUR UNE LIGNE CLIENTE. Sans `channel`,
        // Slack ne devine pas : il refuse, et le refus vaut liste vide côté appelant.
        if (!args.channel) return echec('invalid_arguments', { detail: 'missing required field: channel' });
        const canal = monde.canaux.find((c) => c.id === args.channel);
        if (!canal) return echec('channel_not_found');
        const limite = Math.min(Number(args.limit) || 100, 1000);
        const depart = Number(args.cursor || 0);
        const page = canal.membres.slice(depart, depart + limite);
        const suite = depart + limite < canal.membres.length ? String(depart + limite) : '';
        return reponse({ ok: true, members: page, response_metadata: { next_cursor: suite } });
      }

      case 'conversations.unarchive':
        // SLACK REFUSE LE DÉSARCHIVAGE À UN JETON DE ROBOT, et c'est le seul jeton dont ce
        // code dispose. Le double l'acceptait — quatrième fois qu'il se montre plus
        // permissif que le service réel, et cette fois il laissait croire qu'un canal
        // archivé se récupère. Il ne se récupère pas.
        //
        // Le refus est inconditionnel ici, volontairement : ce n'est pas une simulation de
        // la politique de jetons de Slack, c'est la vérité de ce que NOUS pouvons faire.
        // Si quelqu'un réintroduit l'appel un jour, il rougit avant d'atteindre l'espace.
        return echec('not_allowed_token_type');

      case 'conversations.join':
      case 'conversations.archive': {
        if (!args.channel) return echec('invalid_arguments', { detail: 'missing required field: channel' });
        const canal = monde.canaux.find((c) => c.id === args.channel);
        if (!canal) return echec('channel_not_found');
        if (methode === 'conversations.join') {
          if (canal.is_private) return echec('method_not_supported_for_channel_type');
          if (!canal.membres.includes(robot)) canal.membres.push(robot);
        }
        if (methode === 'conversations.archive') {
          if (canal.is_archived) return echec('already_archived');
          canal.is_archived = true;
        }
        return reponse({ ok: true });
      }

      case 'conversations.invite': {
        if (!args.channel) return echec('invalid_arguments', { detail: 'missing required field: channel' });
        if (!args.users) return echec('invalid_arguments', { detail: 'missing required field: users' });
        const canal = monde.canaux.find((c) => c.id === args.channel);
        if (!canal) return echec('channel_not_found');
        for (const u of String(args.users).split(',')) if (!canal.membres.includes(u)) canal.membres.push(u);
        return reponse({ ok: true });
      }

      case 'conversations.setPurpose': {
        if (!args.channel) return echec('invalid_arguments', { detail: 'missing required field: channel' });
        if (typeof args.purpose !== 'string') return echec('invalid_arguments', { detail: 'missing required field: purpose' });
        return reponse({ ok: true, purpose: args.purpose });
      }

      case 'conversations.rename': {
        if (!args.channel) return echec('invalid_arguments', { detail: 'missing required field: channel' });
        if (!args.name) return echec('invalid_arguments', { detail: 'missing required field: name' });
        const canal = monde.canaux.find((c) => c.id === args.channel);
        if (!canal) return echec('channel_not_found');
        canal.name = args.name;
        return reponse({ ok: true, channel: canal });
      }

      case 'chat.postMessage': {
        if (!args.channel) return echec('invalid_arguments', { detail: 'missing required field: channel' });
        if (!args.text) return echec('no_text');
        monde.postes.push(args);
        return reponse({ ok: true, ts: `${monde.postes.length}.0` });
      }

      case 'users.lookupByEmail': {
        if (!args.email) return echec('invalid_arguments', { detail: 'missing required field: email' });
        const u = monde.utilisateurs.find((x) => x.profile?.email === args.email);
        return u ? reponse({ ok: true, user: u }) : echec('users_not_found');
      }

      case 'users.list': {
        const limite = Math.min(Number(args.limit) || 100, 1000);
        const depart = Number(args.cursor || 0);
        const page = monde.utilisateurs.slice(depart, depart + limite);
        const suite = depart + limite < monde.utilisateurs.length ? String(depart + limite) : '';
        return reponse({ ok: true, members: page, response_metadata: { next_cursor: suite } });
      }

      default:
        return echec('unknown_method');
    }
  };

  monde.installer = () => {
    precedent = globalThis.fetch;
    globalThis.fetch = servir;
    return monde;
  };
  monde.restaurer = () => {
    globalThis.fetch = precedent;
  };
  monde.servir = servir;
  monde.canalNomme = (nom) => monde.canaux.find((c) => c.name === nom) || null;

  return monde;
}

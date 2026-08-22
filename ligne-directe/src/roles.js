// roles.js — ce qui distingue le lieu d'un représentant de celui d'un orchestrateur, et
// RIEN D'AUTRE.
//
// POURQUOI CE FICHIER EXISTE PLUTÔT QU'UN SECOND JEU DE MODULES
//
// Le gestionnaire client fait déjà les trois gestes que l'orchestrateur demande : poser un
// lieu versionné, y faire naître une session, garder les copies fidèles. Ils ont été
// corrigés SEPT fois au premier usage réel — un lieu vide déclaré installé, une naissance au
// mauvais endroit, un agent nommé avant d'exister, un brief jamais soumis, un garde inerte,
// une session qui attend, un jeton présent déclaré absent.
//
// Écrire un second mécanisme sous un second nom, c'est parier que les deux copies recevront
// les mêmes correctifs. Ce dépôt a déjà tranché la question dans l'autre sens et à ses
// dépens : « deux sources qui disent la même chose divergent, c'est mécanique » — écrit à
// propos du registre, vrai ici pour la même raison.
//
// Les deux rôles ne diffèrent donc QUE par ce tableau. Tout le reste — les gardes, le point
// d'écriture unique, le retrait de ce qui a été commencé, l'attente avant de nommer, la
// vérification par le fait — est le même code, appelé deux fois.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUI NE CHANGE PAS DE NOM, ET POURQUOI CE N'EST PAS UN OUBLI
//
// Le module de poste s'appelle toujours `naissance-representant/`. Son nom ment désormais
// d'un demi-pas : il fait naître les deux. Le renommer casserait tous les gardes DÉJÀ POSÉS
// dans des dépôts clients — leur `.claude/settings.json` est versionné et porte
// `$HOME/.somtech/naissance-representant/hooks/garde-ouverture-ligne.js`, avec un repli qui
// REFUSE quand le fichier est absent (et c'est voulu : un garde absent ne vaut jamais un
// garde permissif). Un renommage transformerait donc chaque garde posé en refus permanent,
// dans des dépôts qu'on ne contrôle pas. Le nom reste ; la dette est nommée ici.

/** L'entrée d'un rôle. Ajouter un rôle, c'est ajouter une ligne — jamais un module. */
const ROLES = {
  representant: {
    /** Le nom du rôle tel qu'on le dit — pour les messages, jamais pour décider. */
    libelle: 'représentant',
    /**
     * Le même, au pluriel, pour le cadre d'une consigne commune : « À TOUS LES … ». Écrit
     * plutôt que dérivé — une règle d'accord tenue par du code se trompe au premier rôle qui
     * ne finit pas en « s », et ce cadre est la première ligne que lit un agent interrompu.
     */
    libelle_pluriel: 'représentants de clients',
    /** Le dossier, à la racine du dépôt, sous lequel les lieux de ce rôle se rangent. */
    dossier: '.gestionnaire',
    /**
     * CE QUE NOMME LE SEGMENT SOUS `dossier` — et il ne nomme PAS la même chose selon le rôle.
     *
     * `.orchestrateur/d-20260822-0001/` porte un CODE DE CHANTIER, dont l'état se lit au
     * ServiceDesk. `.gestionnaire/Charles-Olivier/` porte un NOM DE CLIENT, qui ne se lit
     * nulle part comme un chantier.
     *
     * ⚠️ SANS CETTE CLÉ, LE REGISTRE FABRIQUE UN ÉCHEC DE MESURE. Interroger l'état du mandat
     * d'un représentant rendait « « Charles-Olivier » n'est pas un code de chantier : son état
     * ne se lit nulle part » — la formulation d'une mesure RATÉE, pour une question qui n'avait
     * simplement pas lieu d'être posée. Un faux échec d'instrument coûte plus qu'un silence :
     * il envoie chercher une panne qui n'existe pas, et il noie les vrais échecs dans son bruit.
     */
    mandat_designe: 'client',
    /** Le dossier de gabarits que le pack dépose sous `.claude/templates/`. */
    gabarits: 'gestionnaire-client',
    /**
     * La nature de la ligne que ce rôle ouvre — `client` (canal privé, où le client parle)
     * ou `interne` (canal public, entre nous). Elle décide de la séquence d'ouverture que le
     * garde laisse passer : un orchestrateur qui ouvrirait une ligne `client` créerait un
     * canal où le client verrait le code d'un chantier.
     *
     * ⚠️ CONSERVÉE, MAIS CE N'EST PLUS ELLE QUI DÉCIDE : depuis T-20260813-0076 un rôle porte
     * PLUSIEURS lignes (voir `lignes` juste dessous), et cette clé ne nomme que la première.
     * Elle reste pour les appelants déjà écrits ; le garde, lui, lit `lignes`.
     */
    nature: 'client',

    /**
     * LES LIGNES QUE CE RÔLE DOIT AVOIR À SA NAISSANCE — toutes, pas la première.
     *
     * ═══════════════════════════════════════════════════════════════════════════════════
     * POURQUOI LE GESTIONNAIRE EN A DEUX (T-20260813-0076)
     *
     * Quatre obligations livrées de son métier lui imposent de REMONTER : ce qui engage
     * Somtech (prix, délai, faisabilité), toute situation problématique AVANT d'en parler au
     * client, une question du client qu'il ne peut pas trancher, et son topo du matin. Il
     * n'avait qu'une ligne — celle de son client — donc aucun chemin pour honorer aucune des
     * quatre. Il était tenu de faire une chose qu'il n'avait pas le moyen de faire.
     *
     * Sa seconde ligne est INTERNE et PAR GESTIONNAIRE (arbitrage du dirigeant, 2026-08-13).
     * Un canal unique « les gestionnaires et le dirigeant » a été écarté explicitement : il
     * aurait fait se lire les représentants entre eux — donc les affaires d'un client
     * visibles par le représentant d'un autre. La prolifération est le prix du cloisonnement.
     *
     * ELLE EST POSÉE À LA NAISSANCE, PAS AU PREMIER MESSAGE — le dirigeant INITIE (« je veux
     * initier », 2026-08-13), et une ligne créée au premier `dire` de l'agent ne lui laisserait
     * rien à quoi écrire tant que l'agent n'a pas parlé le premier. C'est le garde d'ouverture
     * qui le rend mécanique : il tient le pane fermé tant que les DEUX lignes ne sont pas là.
     *
     * ─────────────────────────────────────────────────────────────────────────────────────
     * `chantier` FIXE SUR LA LIGNE DU DIRIGEANT, ET CE N'EST PAS COSMÉTIQUE.
     *
     * `--a` (T-20260813-0078) résout une ligne par son CHANTIER ou par le nom de son CANAL —
     * jamais par sa nature, et c'est délibéré de leur part. Le nom que la ligne porte à
     * l'ouverture EST donc ce que l'agent tapera pour la viser. `dirigeant` est court, se tape
     * sans réfléchir, et se lit comme le destinataire qu'il désigne : `--a dirigeant`.
     *
     * Le CANAL, lui, ne peut pas s'appeler `dirigeant` : il y en a un par gestionnaire, et
     * Slack les suffixerait en `-2`, `-3` — le dirigeant ne saurait plus lequel lui parle. Il
     * porte donc le client dans son nom (`ligne-dirigeant-<client>`, via `--titre`), ce qui le
     * fait aussi se ranger avec ses semblables dans la barre latérale et se retrouver d'un
     * `ligne-dirigeant` dans la recherche.
     */
    lignes: [
      { cle: 'client', nature: 'client', titreRequis: true },
      // `auDirigeant` — la ligne EXIGE que son ouverture demande le dirigeant du poste.
      // Sans lui, elle s'ouvre avec une liste d'autorisés VIDE : elle refuse alors la parole
      // à tout le monde, dirigeant compris, en ayant l'air ouverte. Le garde le tient.
      { cle: 'dirigeant', nature: 'interne', chantier: 'dirigeant', titreRequis: true, auDirigeant: true },
    ],
    /**
     * Les en-têtes RÉELS des deux gabarits, pour reconnaître un lieu par ce qu'il CONTIENT
     * et pas seulement par son nom. Une session ordinaire qui aurait, par coïncidence, un
     * fichier `CONTEXTE.md` ne doit pas se voir appliquer le garde d'un rôle.
     */
    entetes: {
      'CLAUDE.md': /^# Tu es le représentant de ce client/,
      'CONTEXTE.md': /^# Ce qu'on sait de ce client/,
    },
  },

  orchestrateur: {
    libelle: 'orchestrateur',
    libelle_pluriel: 'orchestrateurs',
    // `.orchestrateur/<nom>/` — NOMMÉ, et le nom n'est pas cosmétique. Un projet d'envergure
    // ouvrira un second orchestrateur le jour où le premier ne tiendra plus (arbitrage du
    // dirigeant, 2026-08-12) ; un lieu anonyme ne se dédouble pas. Et ces lieux SONT
    // l'inventaire : les lister, c'est voir qui vit ici — aucun registre local ne les
    // recopie, le ServiceDesk faisant foi sur les chantiers eux-mêmes.
    dossier: '.orchestrateur',
    // Le segment sous `.orchestrateur/` est un CODE DE CHANTIER — voir `mandat_designe` du
    // représentant pour le pourquoi de cette clé.
    mandat_designe: 'chantier',
    gabarits: 'orchestrateur',
    nature: 'interne',
    // UNE SEULE LIGNE, et son chantier est LIBRE : c'est le code du chantier qu'il mène, connu
    // de lui seul au moment d'ouvrir. La fixer ici l'empêcherait d'ouvrir la sienne.
    lignes: [{ cle: 'chantier', nature: 'interne', titreRequis: false }],
    entetes: {
      'CLAUDE.md': /^# Tu es l'orchestrateur de ce chantier/,
      'CONTEXTE.md': /^# Ce qui est propre à ce dépôt/,
    },
  },
};

export class RoleInconnu extends Error {
  constructor(role) {
    super(`rôle inconnu : « ${role} » — les rôles connus sont ${Object.keys(ROLES).join(', ')}`);
    this.name = 'RoleInconnu';
    this.role = role;
  }
}

/** Le rôle nommé, ou une erreur. Jamais un défaut implicite : deviner poserait un lieu ailleurs. */
export function role(nom) {
  const r = ROLES[nom];
  if (!r) throw new RoleInconnu(nom);
  return r;
}

/** Les noms de rôles connus — pour les commandes qui les énumèrent, jamais pour décider. */
export function rolesConnus() {
  return Object.keys(ROLES);
}

/**
 * Comment NOMMER un rôle au pluriel, même s'il n'est plus connu.
 *
 * ⚠️ CE REPLI N'EST PAS DE LA COURTOISIE — il évite une panne muette. LE REGISTRE SURVIT AUX
 * VERSIONS DU PACK : un canal commun inscrit pour un rôle qu'une version ultérieure ne déclare
 * plus y reste, et personne ne peut l'en retirer depuis le code. Or ce libellé est composé sur
 * DEUX chemins qui ne pardonnent pas :
 *
 *   • le refus d'un geste sortant — une exception y remplacerait un refus par un plantage ;
 *   • la diffusion d'une consigne, appelée depuis l'écoute Slack, dont l'enveloppe est DÉJÀ
 *     acquittée quand on y arrive. Une exception à cet endroit perd le message définitivement,
 *     sans que personne ne l'apprenne — le mode de panne exact que ce dispositif combat.
 *
 * On rend donc le nom brut du rôle plutôt que de lever. `role()` continue, lui, de refuser un
 * rôle inconnu : DÉCIDER sur un rôle qu'on ne connaît pas reste interdit — seul le NOMMER est
 * permis, et nommer ne décide de rien.
 */
export function libellePluriel(nom) {
  // Un rôle INCONNU se nomme par son nom brut — c'est ce qui permet à l'opérateur de le
  // retrouver au registre. Un rôle ABSENT, lui, n'a pas de nom à donner : on ne rend pas
  // « undefined » dans un cadre que lit un agent interrompu au milieu de son travail.
  return ROLES[nom]?.libelle_pluriel || (nom ? String(nom) : 'agents de ce rôle');
}

/**
 * Les lignes qu'un rôle doit avoir — jamais moins.
 *
 * Un rôle inscrit sans `lignes` retombe sur SA nature, en une seule ligne : c'est le
 * comportement d'avant T-20260813-0076, et il vaut mieux qu'un rôle muet fasse comme hier que
 * comme rien. Le repli est ici, en un seul endroit, plutôt que chez chaque lecteur — sans quoi
 * un `?? []` oublié quelque part rendrait un rôle SANS aucune ligne requise, donc un agent né
 * muet derrière un garde qui n'exige plus rien.
 */
export function lignesDuRole(nom) {
  const r = role(nom);
  return r.lignes?.length ? r.lignes : [{ cle: 'ligne', nature: r.nature, titreRequis: r.nature === 'client' }];
}

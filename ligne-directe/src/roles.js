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
     * `naitre` PEUT-IL POSER CE LIEU D'AUTORITÉ QUAND IL MANQUE ?
     *
     * ⚠️ CE `false` EST UNE RAISON DE RESTER, PAS UNE PARESSE — ET C'EST POURQUOI ELLE EST ICI.
     *
     * La décision vivait dans `naissance-representant/bin/naitre.js:272`, sous la forme
     * `if (role !== 'orchestrateur')`. Elle y était juste et parfaitement invisible du registre :
     * ajouter un rôle, c'était donc aller éditer une commande qui ne parle pas des rôles — très
     * exactement ce que l'en-tête de ce fichier interdit (« ajouter un rôle, c'est ajouter une
     * ligne, jamais un module »). Le cœur de la pose, lui, n'a JAMAIS été en dur : `preparerLieu`
     * (`lieu-agent.js`) prend le rôle en argument depuis toujours.
     *
     * ⚠️ ET LE REPLI PENCHE DU CÔTÉ QUI N'ÉCRIT PAS : un rôle qui ne déclare rien ne se fait pas
     * poser d'autorité (`poseAutomatique` exige `true` explicite). Se tromper en refusant coûte
     * une commande à relancer ; se tromper en posant écrit un lieu que personne n'a demandé.
     */
    pose_automatique: false,
    /**
     * QUAND LA POSE EST REFUSÉE : POURQUOI, ET OÙ ALLER.
     *
     * ⚠️ SANS CETTE CLÉ, ON DÉPLACE LE LITTÉRAL AU LIEU DE L'ENLEVER. Le refus de `naitre.js`
     * portait ces deux phrases en dur ; un rôle neuf à pose manuelle aurait hérité du motif du
     * représentant et du geste du représentant, tous les deux faux pour lui.
     *
     * Le motif est celui que le dirigeant a tranché le 2026-08-16, recopié du commentaire qu'il
     * remplace : ne pas intervenir ne veut pas dire deviner — le refus NOMME le geste.
     */
    pose_manuelle: {
      motif: 'ils se branchent sur un canal que le client voit, et leur pose garde sa revue',
      geste: 'la compétence /gestionnaire-client, qui demande le canal et le dirigeant que la pose exige',
    },
    /**
     * COMMENT CE RÔLE EST NOMMÉ À SA NAISSANCE — `riviere` ou `code`.
     *
     * `code` : le segment de son lieu fait son nom. Un gestionnaire porte le prénom de la
     * personne qu'il représente (`charles-olivier`) — c'est légitime et distinct, et c'est ce
     * que `nom-de-riviere.js` faisait déjà sous la forme `role !== 'orchestrateur'`.
     *
     * ⚠️ LE REPLI PENCHE ENCORE DU CÔTÉ ÉCONOME : un rôle muet est nommé par son code. Les
     * rivières sont une liste FINIE et partagée — en attribuer une à un rôle dont personne n'a
     * décidé qu'il en portait une, c'est retirer un nom du parc sans qu'on l'ait voulu.
     */
    bapteme: 'code',
    /**
     * PEUT-IL ÊTRE ATTACHÉ COMME PAIR À LA LIGNE D'UN CHANTIER QUI N'EST PAS LE SIEN ?
     *
     * ⚠️ C'EST UNE PERMISSION, PAS UNE DESCRIPTION — ET C'EST POURQUOI ELLE EST DÉCLARÉE PLUTÔT
     * QUE DÉRIVÉE. Ce qu'elle ouvre est le fil TECHNIQUE d'un chantier mené par quelqu'un
     * d'autre : `--au-gestionnaire` attache un pair, et tout ce qui se dit sur cette ligne lui
     * est ensuite remis. `veilleur.js` le dit déjà de son côté — si le pair est le représentant
     * d'un AUTRE client, c'est la fuite que le lot T-20260814-0093 ferme partout ailleurs.
     *
     * ⚠️ ON A MESURÉ LES CLÉS EXISTANTES AVANT D'EN AJOUTER UNE, et aucune ne dit CELLE-CI.
     * `mandat_designe: 'client'` dit de quoi son mandat porte le nom ; `lignes` dit ce qu'il
     * ouvre POUR LUI. Dériver la permission de l'une des deux la donnerait, en silence, à tout
     * rôle futur qui leur ressemble — un conseiller au client aurait un mandat « client » sans
     * avoir à lire le fil technique d'un chantier. Une permission qui s'accorde par ressemblance
     * n'est pas une permission.
     *
     * ⚠️ ET LE REPLI REFUSE, comme celui de `pose_automatique` : un rôle muet n'est pas un pair.
     * Se tromper en refusant coûte une ligne à rouvrir ; se tromper en acceptant livre un
     * chantier à quelqu'un qu'il ne regarde pas.
     */
    pair_de_chantier: true,
    /**
     * COMMENT SA PAROLE EST ANNONCÉE quand elle tombe dans le pane de son pair.
     *
     * ⚠️ ÉCRIT AVEC SON ARTICLE, comme `libelle_pluriel` et pour la même raison : l'élision se
     * tient par du code (« de l’orchestrateur »), le genre non (« du conseillère »). Le registre
     * le dit déjà — une règle d'accord tenue par du code se trompe au premier rôle qu'elle n'a
     * pas prévu.
     *
     * ⚠️ ET CE N'EST PAS `libelle`. Le cadre d'un pair a UNE fonction : dire que la parole ne
     * vient NI du client NI du dirigeant (T-20260814-0093). « du gestionnaire client » la
     * remplit ; « du représentant » — ce que `libelle` rendrait — la remplit moins bien pour un
     * lecteur qui a un client au bout de sa propre ligne. Le texte reste donc celui qui a été
     * écrit pour ce cadre, mot pour mot.
     */
    libelle_de_pair: 'du gestionnaire client',
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
    // SA POSE EST AUTOMATIQUE — c'est le seul chemin par lequel un agent naît sans qu'un humain
    // touche un écran, et il existe depuis E-20260813-0002. Sa ligne est INTERNE : rien de ce
    // qu'elle ouvre n'est visible d'un client, donc rien à faire relire avant de poser.
    pose_automatique: true,
    // SON BAPTÊME EST UNE RIVIÈRE (C1, tranché par `matapedia` le 2026-08-18) : il vit longtemps
    // et porte plusieurs mandats successifs — un code unique le décrirait mal par construction,
    // et son lieu porte déjà ce code.
    bapteme: 'riviere',
    // IL N'EST PAS UN PAIR — il est le PORTEUR de la ligne d'un chantier, celui à qui on en
    // attache un. `pair_de_chantier` est donc absent, et le repli refuse (voir la clé chez le
    // représentant). Mesuré : `resoudrePair` refusait déjà un orchestrateur nommé par erreur en
    // `--au-gestionnaire`, sous la forme littérale `role !== 'representant'`.
    //
    // Sa parole, elle, est annoncée quand elle arrive chez son pair.
    libelle_de_pair: 'de l’orchestrateur du chantier',
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

/**
 * LES RÔLES QUI EXISTENT SANS AVOIR DE LIEU — et pourquoi ils ne sont pas dans `ROLES`.
 *
 * 🔴 CE CRAN NAÎT D'UNE FUSION, ET DE DEUX RÈGLES JUSTES DONT LA JOINTURE NE L'ÉTAIT PAS
 * (2026-09-01). D'un côté, `baptemeDuRole` LÈVE sur un rôle absent de la table — délibéré :
 * « nommer est permis, décider sur un rôle inconnu ne l'est pas ». De l'autre, un chef d'équipe
 * est un rôle parfaitement CONNU du dépôt, qui n'a simplement pas de lieu : pas de dossier
 * versionné, pas de gabarit, pas d'entêtes. L'inscrire dans `ROLES` a été mesuré et refusé —
 * une entrée sans `entetes` fait tomber `roleDuLieuOuRefus` sur `Object.entries(undefined)`, et
 * une entrée AVEC un `dossier` ferait balayer par le registre des lieux qui n'existent pas.
 *
 * ⚠️ « INCONNU » ET « SANS LIEU » NE SONT PAS LE MÊME FAIT, et les confondre coûtait 32 essais
 * d'un coup, dans deux fichiers que git n'avait aucune raison de marquer en conflit. Cette table
 * dit le second sans toucher au premier : un rôle inventé lève toujours.
 *
 * ⚠️ ET ELLE RESTE UNE LIGNE, PAS UN MODULE — la promesse de l'en-tête tient dans les deux
 * tables. Ce qui s'y déclare est le strict minimum de ce qu'on peut savoir d'un rôle sans lieu.
 */
const ROLES_SANS_LIEU = {
  'chef-equipe': {
    libelle: "chef d’équipe",
    /** Il porte le CODE DE SON MANDAT, jamais une rivière — c'est ce qui le rattache à son ticket. */
    bapteme: 'code',
  },
};

/** Les noms de rôles connus — pour les commandes qui les énumèrent, jamais pour décider. */
export function rolesConnus() {
  return Object.keys(ROLES);
}

/**
 * Les rôles connus QUI N'ONT PAS DE LIEU. Séparés de `rolesConnus()` à dessein : tout ce qui
 * lit un lieu (le registre, le garde de naissance, la pose) ne doit JAMAIS les voir passer.
 * Seul ce qui ÉNUMÈRE les rôles utilisables — une aide en ligne — a besoin des deux.
 */
export function rolesSansLieu() {
  return Object.keys(ROLES_SANS_LIEU);
}

/**
 * L'entrée d'un rôle SANS LIEU, ou `undefined`. Elle existe pour que le banc puisse éprouver
 * la FORME de ce qui est inscrit ici — pas seulement les noms.
 *
 * ⚠️ ELLE NE LÈVE PAS, ET C'EST VOULU : `role()` reste la seule porte qui décide. Celle-ci
 * ne sert qu'à REGARDER, jamais à trancher — un appelant qui déciderait sur son retour
 * contournerait la porte, et le banc `qui-garde-le-gardien` de ce fichier le dirait.
 */
export function roleSansLieu(nom) {
  return ROLES_SANS_LIEU[nom];
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

/**
 * `naitre` peut-il poser le lieu de ce rôle d'autorité quand il manque ?
 *
 * ⚠️ LES TROIS ACCESSEURS CI-DESSOUS PASSENT PAR `role()`, DONC ILS REFUSENT UN RÔLE INCONNU —
 * contrairement à `libellePluriel`, qui ne fait que NOMMER. La règle est écrite juste au-dessus
 * et elle vaut ici plus qu'ailleurs : deux de ces trois décisions décident d'écrire sur le
 * disque. Décider sur un rôle qu'on ne connaît pas, ce serait poser un lieu pour personne.
 *
 * ⚠️ ET LE REPLI EST ICI, EN UN SEUL ENDROIT — même raison que `lignesDuRole`. Un `?? true`
 * oublié chez un lecteur ferait poser d'autorité le lieu d'un rôle qui n'a rien demandé ; on
 * exige donc un `true` EXPLICITE, et tout le reste — clé absente, valeur douteuse — refuse.
 */
export function poseAutomatique(nom) {
  return role(nom).pose_automatique === true;
}

/**
 * Quand la pose n'est pas automatique : POURQUOI, et OÙ ALLER.
 *
 * ⚠️ LE REPLI N'INVENTE AUCUN GESTE. Un rôle qui refuse la pose sans dire où aller laisse
 * l'opérateur sur place ; lui servir le geste d'un autre rôle l'enverrait au mauvais endroit
 * avec l'assurance d'un texte écrit. On rend donc ce qu'on a mesuré — « ce rôle ne le dit
 * pas » — et on nomme le fichier où l'inscrire. Un essai rend ce repli inatteignable pour les
 * rôles déclarés ; il reste pour celui qu'on ajoutera en oubliant la clé.
 */
export function poseManuelle(nom) {
  const dit = role(nom).pose_manuelle;
  if (dit?.motif && dit?.geste) return dit;
  return {
    motif: `le registre ne dit pas ce qui garde la revue de la pose d’un ${role(nom).libelle}`,
    geste: `aucun geste n’est inscrit pour ce rôle — il s’ajoute dans « ligne-directe/src/roles.js » (clé « pose_manuelle »)`,
  };
}

/**
 * Comment ce rôle est NOMMÉ à sa naissance — `riviere` ou `code`. Voir le repli au registre.
 *
 * ⚠️ UN RÔLE SANS LIEU RÉPOND AUSSI, et c'est la seule chose que cette fonction sait de lui.
 * Sans ça, `nomDeLAgentQuiNait` levait sur un chef d'équipe — un rôle que le dépôt connaît
 * parfaitement — au motif qu'il n'est pas dans la table des rôles QUI ONT UN LIEU. Un rôle
 * réellement inventé, lui, lève toujours : `role()` reste la seule porte.
 */
export function baptemeDuRole(nom) {
  const sansLieu = ROLES_SANS_LIEU[nom];
  if (sansLieu) return sansLieu.bapteme === 'riviere' ? 'riviere' : 'code';
  return role(nom).bapteme === 'riviere' ? 'riviere' : 'code';
}

/**
 * CE RÔLE MÈNE-T-IL UN CHANTIER — c'est-à-dire son mandat EST-IL un code de chantier ?
 *
 * ⚠️ AUCUNE CLÉ NEUVE : `mandat_designe` répond déjà à cette question depuis qu'elle existe, et
 * `vue-du-parc.js` l'écrivait en toutes lettres tout en décidant par un littéral — « seul le
 * rôle « orchestrateur » en porte un (un représentant a pour mandat un nom de client) ». Le
 * commentaire disait le registre ; le code disait `!== 'orchestrateur'`.
 *
 * C'est ce prédicat qui fait d'un rôle une TÊTE DE HIÉRARCHIE dans la vue du parc : c'est sous
 * un code de chantier, et sous rien d'autre, que des epics et des stories se rangent.
 */
export function meneUnChantier(nom) {
  return role(nom).mandat_designe === 'chantier';
}

/**
 * CE RÔLE TIENT-IL UNE LIGNE QUE SON CLIENT VOIT ?
 *
 * ⚠️ AUCUNE CLÉ NEUVE NON PLUS, et c'est `lignes` qu'on lit — pas `nature`. Le registre le dit
 * lui-même à propos de `nature` : « CONSERVÉE, MAIS CE N'EST PLUS ELLE QUI DÉCIDE […] cette clé
 * ne nomme que la première [ligne] ». Un rôle dont la ligne cliente ne serait pas la première
 * serait déclaré sans client par `nature`, et l'avertissement qui protège ce client sauterait.
 *
 * C'est ce prédicat qui décide de l'avertissement « RIEN DE CE FIL NE DESCEND AU CLIENT » du
 * cadre d'un pair : il ne vaut d'être dit qu'à celui qui a effectivement un client au bout
 * d'une de ses lignes.
 */
export function tientUneLigneCliente(nom) {
  return lignesDuRole(nom).some((l) => l?.nature === 'client');
}

/**
 * CE RÔLE PEUT-IL ÊTRE ATTACHÉ COMME PAIR À LA LIGNE D'UN CHANTIER ?
 *
 * ⚠️ MÊME REPLI QUE `poseAutomatique`, ET POUR UN RISQUE DE MÊME NATURE : on exige un `true`
 * EXPLICITE. Un rôle qui ne dit rien n'est pas un pair. Ce que le repli protège n'est pas un
 * fichier sur le disque, c'est le fil technique d'un chantier — dont le destinataire par erreur
 * peut être le représentant d'un autre client.
 */
export function pairDeChantier(nom) {
  return role(nom).pair_de_chantier === true;
}

/**
 * « du gestionnaire client », « de l’orchestrateur du chantier » — COMMENT LA PAROLE DE CE RÔLE
 * EST ANNONCÉE quand elle tombe dans le pane de son pair.
 *
 * ⚠️ LE REPLI N'ATTRIBUE JAMAIS LA PAROLE À UN AUTRE RÔLE. C'est le défaut exact que ce lot
 * ferme : `cadre.js` portait `deRole === 'representant' ? … : …`, donc TOUT rôle qui n'était pas
 * le représentant était annoncé comme l'orchestrateur du chantier. Une attribution fausse se lit
 * exactement comme une vraie — et celle-ci donne à une demande l'autorité de celui qui mène.
 *
 * On compose donc depuis `libelle`, qui existe pour tout rôle. L'élision est tenue par du code ;
 * le genre ne l'est pas, et c'est pourquoi les rôles déclarent leur formule (même raison que
 * `libelle_pluriel`). ⚠️ Cette règle d'élision existe AUSSI dans `naissance-representant/bin/
 * naitre.js` — deux copies, mesurées, que ce lot n'avait pas mandat de fondre.
 */
export function libelleDePair(nom) {
  const r = role(nom);
  const dit = r.libelle_de_pair;
  if (typeof dit === 'string' && dit.trim()) return dit;
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(r.libelle) ? `de l’${r.libelle}` : `du ${r.libelle}`;
}

/**
 * TOUS LES DOSSIERS sous lesquels des lieux d'agents se rangent, dédoublonnés.
 *
 * ⚠️ CE QUE SON ABSENCE COÛTAIT EST UN DOUBLON DE NOM, ET IL EST MUET. `nom-de-riviere.js`
 * relevait les noms DÉJÀ PRIS d'un dépôt en balayant `['.orchestrateur', '.gestionnaire']`,
 * écrits à la main. Les lieux d'un troisième rôle n'auraient pas été vus : le nom d'un agent
 * vivant aurait été rendu « libre », et deux agents du même dépôt auraient porté le même nom —
 * donc auraient été inadressables l'un comme l'autre, sans qu'aucune erreur ne le dise.
 */
export function dossiersDesLieux() {
  return [...new Set(rolesConnus().map((nom) => ROLES[nom].dossier).filter(Boolean))];
}

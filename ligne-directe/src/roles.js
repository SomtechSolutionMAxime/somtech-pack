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
    /** Le dossier, à la racine du dépôt, sous lequel les lieux de ce rôle se rangent. */
    dossier: '.gestionnaire',
    /** Le dossier de gabarits que le pack dépose sous `.claude/templates/`. */
    gabarits: 'gestionnaire-client',
    /**
     * La nature de la ligne que ce rôle ouvre — `client` (canal privé, où le client parle)
     * ou `interne` (canal public, entre nous). Elle décide de la séquence d'ouverture que le
     * garde laisse passer : un orchestrateur qui ouvrirait une ligne `client` créerait un
     * canal où le client verrait le code d'un chantier.
     */
    nature: 'client',
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
    // `.orchestrateur/<nom>/` — NOMMÉ, et le nom n'est pas cosmétique. Un projet d'envergure
    // ouvrira un second orchestrateur le jour où le premier ne tiendra plus (arbitrage du
    // dirigeant, 2026-08-12) ; un lieu anonyme ne se dédouble pas. Et ces lieux SONT
    // l'inventaire : les lister, c'est voir qui vit ici — aucun registre local ne les
    // recopie, le ServiceDesk faisant foi sur les chantiers eux-mêmes.
    dossier: '.orchestrateur',
    gabarits: 'orchestrateur',
    nature: 'interne',
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

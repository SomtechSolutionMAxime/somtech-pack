// garde.js — la décision d'un PreToolUse : rien ne passe avant que la ligne soit ouverte.
//
// T-20260806-0192 : un représentant a relevé l'historique du client AVANT d'ouvrir sa ligne.
// Le dirigeant lui a écrit quatre fois pendant ce temps ; rien n'est arrivé, rien n'a été
// signalé. Le gabarit du métier (E-20260807-0002) DIT désormais l'ordre — mais une consigne
// que rien ne garde se relâche (voir cli/test/lib/metier-representant.js, mutation
// « l'étape 2 garde son rang mais cesse d'obliger »). Ce fichier est le rattrapage
// MÉCANIQUE : même si un agent choisit d'ignorer l'ordre, l'appel d'outil qui s'y prendrait
// autrement est refusé avant d'être exécuté.
//
// Fonction pure, sans I/O — toute l'incertitude d'environnement (herdr, ligne-directe) est
// résolue AVANT d'appeler `decider`, dans le hook lui-même (garde-ouverture-ligne.js). C'est
// ce qui la rend exhaustivement testable sans jamais toucher un vrai processus, un vrai
// pane, ni le vrai espace de conversation Slack (RA-REL-012 — voir cloison.js).

/**
 * Les segments de commande Bash qui font partie de la séquence d'ouverture, et RIEN
 * D'AUTRE. Chacun est ancré (^...$) : une sonde non ancrée laisserait passer une commande
 * composée qui commence par un segment autorisé et enchaîne autre chose derrière.
 *
 * Ce qui précède la ligne d'ouverture est commun aux deux rôles — trouver son pane, se
 * nommer, lire l'état des lignes. C'est la ligne elle-même qui diffère, et la différence
 * n'est pas cosmétique : la NATURE du canal.
 */
const SEGMENTS_COMMUNS = [
  /^\s*$/, // ligne vide
  /^#.*$/, // commentaire
  /^LD=.*ligne-directe\.js.*$/, // pose la variable, aucun effet
  /^herdr pane current$/,
  /^herdr agent rename \S+ \S+$/,
  /^\$LD etat$/,
  /^node \S*ligne-directe\.js etat$/,
];

/**
 * L'ouverture propre à chaque rôle.
 *
 * REPRÉSENTANT — `--nature client` OBLIGATOIRE (canal privé, où parlent les gens du client)
 * et `--titre` obligatoire avec elle : le client ne doit jamais voir un code de chantier.
 *
 * ORCHESTRATEUR — sa ligne est INTERNE : canal public, entre nous, nommé par le code de son
 * chantier. `--nature` y est donc absente, et c'est délibéré : l'autoriser ici laisserait un
 * orchestrateur ouvrir un canal privé de client pour y déverser de l'interne — précisément
 * ce que le cloisonnement interdit. La forme admise est celle que son métier enseigne
 * (§1-bis), et le sujet comme l'invitation restent libres.
 */
const OUVERTURE = {
  representant: [
    /^\$LD ouvrir \S+.*--nature client.*--titre\s+".+"$/,
    /^node \S*ligne-directe\.js ouvrir \S+.*--nature client.*--titre\s+".+"$/,
  ],
  orchestrateur: [
    /^\$LD ouvrir \S+(?!.*--nature).*$/,
    /^node \S*ligne-directe\.js ouvrir \S+(?!.*--nature).*$/,
  ],
};

/** Les segments admis pour le rôle donné — un rôle inconnu n'admet que le commun, donc rien qui ouvre. */
export function segmentsAutorises(role) {
  return [...SEGMENTS_COMMUNS, ...(OUVERTURE[role] || [])];
}

/** Découpe une commande Bash en segments indépendants — chacun doit être autorisé. */
export function segments(commande) {
  return String(commande || '')
    .split(/\n|&&|;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Les segments d'une commande qui n'appartiennent pas à la séquence d'ouverture de ce rôle. */
export function segmentsHorsSequence(commande, role = 'representant') {
  const admis = segmentsAutorises(role);
  return segments(commande).filter((s) => !admis.some((r) => r.test(s)));
}

/**
 * La décision pour un appel d'outil, sachant si la ligne est déjà ouverte pour ce pane.
 *
 * @param {{toolName: string, toolInput: object, ligneOuverte: boolean, role?: string}} params
 * @returns {{permissionDecision: 'allow'|'deny', permissionDecisionReason: string}}
 */
export function decider({ toolName, toolInput, ligneOuverte, role = 'representant' }) {
  if (ligneOuverte) {
    return { permissionDecision: 'allow', permissionDecisionReason: 'la ligne est déjà ouverte pour ce pane' };
  }

  // Lire est sans effet et nécessaire à l'étape 1 (« Lis CONTEXTE.md ») — mais seulement
  // TANT QUE la ligne n'est pas ouverte : une fois ouverte, cette branche n'est plus
  // atteinte, tout est permis (governé par le reste du métier, pas par ce garde).
  if (toolName === 'Read') {
    return { permissionDecision: 'allow', permissionDecisionReason: 'lecture locale, permise avant l’ouverture (étape 1)' };
  }

  if (toolName === 'Bash') {
    // Une commande vide (ou absente) ne contient aucun segment « hors séquence » — un
    // `.every()` sur un tableau vide serait vrai par vide, et laisserait passer par défaut
    // ce qui n'a jamais été reconnu comme la séquence d'ouverture. Il faut donc AU MOINS UN
    // segment reconnu, pas seulement AUCUN segment refusé.
    const segs = segments(toolInput?.command);
    const hors = segmentsHorsSequence(toolInput?.command, role);
    if (segs.length > 0 && hors.length === 0) {
      return { permissionDecision: 'allow', permissionDecisionReason: 'fait partie de la séquence d’ouverture de ligne' };
    }
    const quoi = hors[0] || '(commande vide)';
    return {
      permissionDecision: 'deny',
      permissionDecisionReason:
        `bloqué : « ${quoi} » n’ouvre pas la ligne. Ouvre-la d’abord — tout le reste attend (T-20260806-0192).`,
    };
  }

  return {
    permissionDecision: 'deny',
    permissionDecisionReason:
      `bloqué : ${toolName} n’ouvre pas la ligne. Ouvre-la d’abord — tout le reste attend (T-20260806-0192).`,
  };
}

/** La ligne est-elle ouverte pour CE pane, d'après un `etat` rendu par ligne-directe ? */
export function ligneEstOuverte(etat, pane) {
  return (etat?.ouvertes || []).some((l) => l.pane === pane);
}

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
import { lignesDuRole } from '../../ligne-directe/src/roles.js';

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
 * L'ouverture propre à chaque LIGNE d'un rôle — DÉRIVÉE de `roles.js`, jamais recopiée.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE N'EST PLUS UNE TABLE PAR RÔLE (T-20260813-0076)
 *
 * Un rôle avait UNE ligne, il en a maintenant plusieurs : le gestionnaire naît avec celle de
 * son client ET celle du dirigeant. Écrire une seconde table de formes à côté de la table des
 * rôles, c'était garantir qu'elles divergeraient — le dépôt l'a déjà payé, et `roles.js` le
 * dit en toutes lettres : « deux sources qui disent la même chose divergent, c'est mécanique ».
 * La source est donc `lignesDuRole()`, et ce fichier ne fait que traduire en formes de
 * commande ce que la table déclare.
 *
 * CHAQUE LIGNE PORTE SES PROPRES INTERDITS, ET C'EST LE POINT DÉLICAT DE CE LOT.
 *
 * Avant, `--nature` était interdite AU RÔLE orchestrateur et libre au représentant. Ça ne
 * tient plus : le représentant ouvre maintenant deux lignes, dont une INTERNE — et si
 * `--nature` restait libre pour lui, `ouvrir acme --titre "Acme"` (sans nature) serait admis
 * par la forme interne, c'est-à-dire un canal PUBLIC portant le nom du client. L'interdit
 * descend donc de l'ANCIEN niveau du rôle au niveau de la ligne :
 *
 *   • ligne `client`   → la forme EXIGE `--nature client` ;
 *   • ligne `interne`  → la forme INTERDIT `--nature`, où qu'elle soit dans le segment.
 *
 * ET LA LIGNE INTERNE D'UN REPRÉSENTANT EST ANCRÉE SUR SON CHANTIER (`dirigeant`), pas
 * ouverte à n'importe quel mot. Sans cet ancrage, `ouvrir acme --titre "Acme"` retomberait sur
 * la forme interne : le nom du client dans un canal public, qui est très exactement le refus
 * que garde-par-role.test.js tient depuis E-20260813-0002. L'orchestrateur, lui, garde son
 * chantier LIBRE — c'est le code du chantier qu'il mène, connu de lui seul.
 *
 * ⚠️ L'INTERDIT RESTE UNE QUESTION DE FAIT, JAMAIS DE POSITION — la leçon de la passe 2 sur
 * E-20260813-0002 : la première version écrivait `ouvrir \S+(?!.*--nature)`, donc après le
 * premier mot, et `ouvrir --nature client D-1` passait parce que `\S+` avalait le drapeau. On
 * demande donc « ce segment contient-il ceci ? », à quoi la position ne peut rien changer.
 */
function formesDeLigne(ligne, reserves = []) {
  // UN CHANTIER FIXÉ SE TERMINE, et l'oubli de cette borne est un vrai trou : sans elle,
  // `ouvrir dirigeants` (au pluriel, ou n'importe quel mot qui COMMENCE par le bon) tombait
  // dans la forme de la ligne du dirigeant. Trouvé par l'essai qui le cherchait, pas supposé.
  //
  // ⚠️ ET UN CHANTIER LIBRE EXCLUT LES CHANTIERS RÉSERVÉS DU MÊME RÔLE. Sans ça,
  // `ouvrir dirigeant --nature client --titre "X"` était admis par la forme de la ligne
  // CLIENTE — dont le chantier est libre —, c'est-à-dire un canal PRIVÉ portant la
  // désignation réservée au dirigeant, où l'appartenance vaut autorisation : n'importe quel
  // invité y piloterait le représentant d'un client. La désignation `dirigeant` ne veut dire
  // qu'une chose, ou `--a dirigeant` ne veut plus rien dire.
  //
  // L'exclusion est écrite en tête de motif — immédiatement après `ouvrir ` — et c'est le seul
  // endroit où une contrainte de POSITION est légitime ici : elle porte sur le premier mot, qui
  // EST une position. Les interdictions qui ne portent pas sur une position (`--nature`)
  // restent, elles, des questions de fait, éprouvées à part.
  const exclusion = reserves.length ? `(?!(?:${reserves.map(echapper).join('|')})(?:\\s|$))` : '';
  const chantier = ligne.chantier ? `${echapper(ligne.chantier)}(?=\\s|$)` : `${exclusion}\\S+`;
  const titre = ligne.titreRequis ? '.*--titre\\s+".+"' : '';
  if (ligne.nature === 'client') {
    return {
      cle: ligne.cle,
      nature: ligne.nature,
      motifs: [
        new RegExp(`^\\$LD ouvrir ${chantier}.*--nature client${titre}$`),
        new RegExp(`^node \\S*ligne-directe\\.js ouvrir ${chantier}.*--nature client${titre}$`),
      ],
      interdits: [],
    };
  }
  return {
    cle: ligne.cle,
    nature: ligne.nature,
    motifs: [
      new RegExp(`^\\$LD ouvrir ${chantier}${titre}.*$`),
      new RegExp(`^node \\S*ligne-directe\\.js ouvrir ${chantier}${titre}.*$`),
    ],
    // Une ligne interne ne se nomme JAMAIS d'une nature : l'autoriser laisserait ouvrir un
    // canal privé de client pour y déverser de l'interne, ou publier le nom d'un client.
    interdits: [/--nature/],
  };
}

/** Un nom de chantier fixé par la table devient un motif littéral — pas un motif deviné. */
function echapper(texte) {
  return String(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Les formes d'ouverture admises pour ce rôle — une par ligne qu'il doit avoir. */
export function formesDOuverture(role) {
  try {
    const lignes = lignesDuRole(role);
    // Les chantiers que ce rôle RÉSERVE — ceux qu'une ligne nomme explicitement. Une ligne au
    // chantier libre ne doit jamais pouvoir les reprendre : deux lignes du même rôle
    // répondraient au même nom, et `--a` (T-20260813-0078) refuserait alors les deux plutôt
    // que d'en choisir une — un gestionnaire sans destinataire adressable.
    const reserves = lignes.map((l) => l.chantier).filter(Boolean);
    return lignes.map((l) => formesDeLigne(l, l.chantier ? [] : reserves));
  } catch {
    // Un rôle inconnu n'ouvre RIEN : il n'admet que le commun. Rendre une liste permissive
    // ici serait un garde qui s'élargit sur une faute de frappe.
    return [];
  }
}

/** Les segments admis pour le rôle donné — un rôle inconnu n'admet que le commun, donc rien qui ouvre. */
export function segmentsAutorises(role) {
  return [...SEGMENTS_COMMUNS, ...formesDOuverture(role).flatMap((f) => f.motifs)];
}

/**
 * Le segment ouvre-t-il une ligne de ce rôle — et LAQUELLE ?
 *
 * Rend la clé de la ligne, ou `null`. La forme et son interdit sont éprouvés ENSEMBLE : une
 * forme reconnue dont l'interdit est porté n'ouvre rien du tout. Les tester séparément, comme
 * le faisait la version par rôle, revenait à demander « ce rôle a-t-il des interdits ? » —
 * question qui n'a plus de sens dès qu'un rôle porte deux lignes aux interdits opposés.
 */
export function ligneOuverteParSegment(segment, role) {
  for (const forme of formesDOuverture(role)) {
    if (forme.interdits.some((r) => r.test(segment))) continue;
    if (forme.motifs.some((r) => r.test(segment))) return forme.cle;
  }
  return null;
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
  return segments(commande).filter(
    (s) => !SEGMENTS_COMMUNS.some((r) => r.test(s)) && !ligneOuverteParSegment(s, role)
  );
}

/**
 * Ce qui manque encore à ce pane pour que le rôle ait TOUTES ses lignes.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LE GARDE TIENT DÉSORMAIS JUSQU'À LA DERNIÈRE LIGNE (T-20260813-0076), ET C'EST LUI QUI
 * POSE LA SECONDE À LA NAISSANCE
 *
 * Le dirigeant INITIE sur la ligne du gestionnaire : elle doit donc exister AVANT que l'agent
 * ait quoi que ce soit à dire, sans quoi le dirigeant n'aurait rien à quoi écrire tant que
 * l'agent n'a pas parlé le premier. Rien ne peut la poser à sa place — un canal se crée depuis
 * le pane qui l'écoutera, sinon la remise partirait ailleurs.
 *
 * Le seul dispositif qui l'oblige sans dépendre de ce que l'agent a lu, c'est ce garde : il
 * relâche le pane quand les DEUX lignes sont là, jamais à la première. Une consigne écrite
 * dans un métier se relâche (mesuré : « l'étape 2 garde son rang mais cesse d'obliger ») ; un
 * refus mécanique, non.
 *
 * ON COMPTE PAR NATURE, PAS PAR NOMBRE. Deux lignes clientes ouvertes ne valent pas une
 * cliente et une interne : compter jusqu'à deux aurait relâché le pane d'un gestionnaire qui a
 * rouvert deux fois vers son client et jamais vers le dirigeant — c'est-à-dire l'agent exact
 * que ce lot existe pour ne plus laisser naître.
 */
export function lignesManquantes(role, naturesOuvertes = []) {
  const presentes = new Set(naturesOuvertes);
  try {
    return lignesDuRole(role).filter((l) => !presentes.has(l.nature));
  } catch {
    // Rôle inconnu : rien ne peut être déclaré ouvert pour lui. On ne rend pas « rien ne
    // manque », qui relâcherait le pane sur une faute de frappe.
    return [{ cle: 'ligne', nature: 'inconnue' }];
  }
}

/**
 * La décision pour un appel d'outil, sachant quelles NATURES de ligne sont ouvertes sur ce pane.
 *
 * @param {{toolName: string, toolInput: object, naturesOuvertes?: string[], role?: string}} params
 * @returns {{permissionDecision: 'allow'|'deny', permissionDecisionReason: string}}
 */
export function decider({ toolName, toolInput, naturesOuvertes = [], role = 'representant' }) {
  const manquantes = lignesManquantes(role, naturesOuvertes);
  if (manquantes.length === 0) {
    return { permissionDecision: 'allow', permissionDecisionReason: 'toutes les lignes de ce rôle sont ouvertes pour ce pane' };
  }
  // CE QUI MANQUE EST NOMMÉ, avec la commande exacte — pas un renvoi à une documentation. Un
  // agent bloqué par un refus qui ne dit pas quoi ouvrir relance la même commande, ou renonce.
  const quiManque = manquantes
    .map((l) =>
      l.nature === 'client'
        ? 'celle de ton client (`ouvrir <le client> --nature client --titre "…"`)'
        : `celle du dirigeant (\`ouvrir ${l.chantier || '<chantier>'} --titre "…"${l.cle === 'dirigeant' ? ' --au-dirigeant' : ''}\`)`
    )
    .join(' et ');

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
        `bloqué : « ${quoi} » n’ouvre aucune de tes lignes. Il te manque ${quiManque} — ` +
        `tout le reste attend (T-20260806-0192, T-20260813-0076).`,
    };
  }

  return {
    permissionDecision: 'deny',
    permissionDecisionReason:
      `bloqué : ${toolName} n’ouvre aucune de tes lignes. Il te manque ${quiManque} — ` +
      `tout le reste attend (T-20260806-0192, T-20260813-0076).`,
  };
}

/** La ligne est-elle ouverte pour CE pane, d'après un `etat` rendu par ligne-directe ? */
export function ligneEstOuverte(etat, pane) {
  return (etat?.ouvertes || []).some((l) => l.pane === pane);
}

/**
 * Les NATURES de ligne ouvertes sur ce pane, d'après un `etat` rendu par ligne-directe.
 *
 * ⚠️ UNE LIGNE SANS NATURE VAUT `interne`, EXACTEMENT COMME AU REGISTRE (`natureDe`). Le
 * champ n'existait pas avant les lignes clientes, et une ligne inscrite par une version
 * antérieure n'en porte pas : la traiter comme un troisième cas aurait tenu fermé, pour
 * toujours, le pane d'un orchestrateur dont la ligne fonctionne — le pire refus possible,
 * puisqu'il porte sur ce qui marche.
 */
export function naturesOuvertesDuPane(etat, pane) {
  return [
    ...new Set(
      (etat?.ouvertes || []).filter((l) => l.pane === pane).map((l) => (l.nature === 'client' ? 'client' : 'interne'))
    ),
  ];
}

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
// LES FONCTIONS QUE LA COMMANDE APPELLE ELLE-MÊME — pas une copie de leur logique. Un garde
// qui réécrirait la lecture d'arguments prouverait seulement qu'il est d'accord avec lui-même,
// et divergerait de la commande au premier correctif porté à l'une des deux (T-20260813-0078
// a payé exactement ça sur `option`, qui trouvait un drapeau là où il n'était qu'une valeur).
import { optionDonnee, premierLibre } from '../../ligne-directe/src/arguments.js';

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
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ LE GARDE LIT LES ARGUMENTS COMME LA COMMANDE LES LIT — il ne les RECONNAÎT plus de loin.
 *
 * DEUX DÉFAUTS RÉELS ONT IMPOSÉ CE RENVERSEMENT, et le premier était BLOQUANT (relevé en
 * revue de fond, vérifié contre un vrai veilleur) :
 *
 *   1. `ouvrir dirigeant --titre "…"` SANS `--au-dirigeant` était admis. La commande
 *      réussissait, créait le canal, et inscrivait `autorises: []` — une liste VIDE, que
 *      `autorise()` distingue d'une liste absente : elle refuse alors TOUT LE MONDE, le
 *      dirigeant le premier. La ligne existait, comptait comme `interne` présente, le garde
 *      relâchait le pane — et chaque message du dirigeant repartait « non autorisé », en
 *      silence. C'est le mode de panne exact que `--au-dirigeant` existe pour fermer, laissé
 *      ouvert par la porte d'à côté ;
 *   2. l'exigence de `--titre` (et celle de `--nature client`) était écrite EN POSITION —
 *      `.*--nature client.*--titre\s+".+"$` —, donc `ouvrir acme --titre "Acme" --nature
 *      client` y échappait par le seul ordre des mots. Le corriger en cherchant les drapeaux
 *      « n'importe où » aurait ouvert le trou inverse, celui de T-20260813-0078 :
 *      `ouvrir acme --titre "--nature client"` — un TITRE qui vaut littéralement le drapeau —
 *      aurait été pris pour une ligne cliente, alors qu'il ouvre un canal PUBLIC portant le
 *      nom du client.
 *
 * Aucune expression ne ferme les deux à la fois, parce que la question n'est pas « ce texte
 * contient-il ceci ? » mais « cette commande PORTE-T-ELLE ce drapeau ? ». On la pose donc à
 * `optionDonnee` et `premierLibre` — LES FONCTIONS QUE LA COMMANDE APPELLE ELLE-MÊME. Elles
 * parcourent les jetons et sautent la valeur d'une option à valeur : un `--nature` consommé
 * comme titre n'est pas un drapeau, et un `--au-dirigeant` oublié n'en est pas un non plus.
 * Le garde et la commande ne peuvent plus diverger : ils lisent avec le même outil.
 */

/**
 * Les jetons d'un segment, comme un shell les passerait à la commande — ou `null` quand on
 * n'en est pas sûr.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * `null` PLUTÔT QU'UNE APPROXIMATION, ET C'EST TOUT L'ENJEU (relevé en CONTRE-revue de fond,
 * reproduit contre un vrai veilleur à travers un vrai shell avant d'être cru).
 *
 * La première version ne lisait que les guillemets DOUBLES propres. Sur
 * `--titre 'x --au-dirigeant y'` — des apostrophes, qu'un agent choisit spontanément —, elle
 * éclatait la valeur et voyait un `--au-dirigeant` que le shell, lui, ne passe JAMAIS comme
 * drapeau : il est à l'intérieur du titre. Le garde admettait donc l'ouverture, la commande
 * ouvrait la ligne SANS demander le dirigeant, et on retombait exactement sur le bloquant
 * qu'on venait de fermer — `autorises: []`, une ligne qui a l'air ouverte et refuse la parole
 * à tout le monde. Même effet avec un guillemet double ÉCHAPPÉ, par un second mécanisme.
 *
 * ÉCRIRE UN VRAI DÉCOUPAGE DE SHELL EST LE MAUVAIS REMÈDE : il faudrait suivre les
 * apostrophes, les échappements, l'expansion, et il divergerait quelque part — c'est la même
 * dette que deux sources qui disent la même chose. On fait donc l'inverse : dès qu'une forme
 * de citation nous rend le découpage INCERTAIN, on ne devine pas, on rend `null` — et un
 * segment qu'on ne sait pas lire n'ouvre RIEN.
 *
 * ⚠️ CE REFUS TOMBE DU CÔTÉ RÉCUPÉRABLE. Une ouverture légitime écrite en apostrophes est
 * refusée : l'agent la réécrit en guillemets doubles et poursuit. L'autre côté — admettre une
 * commande dont on a mal lu les drapeaux — donne une ligne muette que personne ne voit avant
 * d'en avoir besoin. Et ce n'est même pas un durcissement : la forme d'avant ce lot exigeait
 * déjà `--titre "…"` en guillemets doubles.
 *
 * L'APOSTROPHE À L'INTÉRIEUR D'UNE VALEUR CITÉE RESTE PERMISE — `--sujet "le lieu de
 * l'orchestrateur"` est la séquence d'ouverture réelle d'un orchestrateur, et la refuser
 * aurait été un refus portant sur ce qui marche.
 */
export function jetonsDuSegment(segment) {
  const texte = String(segment || '');
  const jetons = [];
  let courant = null;
  let cite = false;
  for (const c of texte) {
    // Un échappement rend le découpage incertain où qu'il soit : hors citation il colle le
    // caractère suivant, dedans il neutralise une fermeture. On ne tranche ni l'un ni l'autre.
    if (c === '\\') return null;
    if (c === '"') {
      cite = !cite;
      courant ??= '';
      continue;
    }
    // Une apostrophe HORS citation ouvre une citation qu'on ne sait pas suivre. Dedans, ce
    // n'est qu'un caractère du texte, et c'est le cas nominal en français.
    if (c === "'" && !cite) return null;
    if (!cite && /\s/.test(c)) {
      if (courant !== null) jetons.push(courant);
      courant = null;
      continue;
    }
    courant = (courant ?? '') + c;
  }
  // GUILLEMET JAMAIS REFERMÉ. ⚠️ CE REFUS-LÀ NE GARDE CONTRE AUCUNE DIVERGENCE, et c'est dit
  // plutôt que maquillé : une mutation qui le retire SURVIT à toute la suite, et c'est normal —
  // un shell refuse de toute façon d'exécuter une citation ouverte, donc la commande admise ne
  // s'exécuterait jamais. Écrire un essai pour le couvrir aurait été décoratif. Il reste parce
  // que cette fonction ne doit jamais rendre un découpage qu'elle SAIT faux : le jour où
  // quelqu'un s'en sert ailleurs, c'est cette promesse-là qui compte, pas le shell d'aujourd'hui.
  if (cite) return null;
  if (courant !== null) jetons.push(courant);
  return jetons;
}

/** Les deux façons d'invoquer la commande, et rien d'autre — la seule contrainte de position. */
const APPELS = [/^\$LD$/, /^node$/];

/**
 * Les arguments de `ouvrir` portés par ce segment, ou `null` si ce segment n'ouvre rien.
 *
 * La position n'est éprouvée QUE là où elle est le fait : l'invocation, puis le geste. Tout le
 * reste — le chantier, les drapeaux — est lu, jamais reconnu de loin.
 */
function argumentsDOuverture(segment) {
  const jetons = jetonsDuSegment(segment);
  // `null` — on n'a pas su lire ce segment. Il n'ouvre donc rien : deviner ici, c'est admettre
  // une commande dont on a mal lu les drapeaux.
  if (!jetons || !jetons.length || !APPELS.some((r) => r.test(jetons[0]))) return null;
  // `node <chemin>/ligne-directe.js ouvrir …` porte le chemin en deuxième position ; `$LD` non.
  const debut = jetons[0] === 'node' ? 2 : 1;
  if (jetons[0] === 'node' && !/ligne-directe\.js$/.test(jetons[1] || '')) return null;
  if (jetons[debut] !== 'ouvrir') return null;
  return jetons.slice(debut + 1);
}

/** Les lignes d'un rôle, avec les chantiers que ce rôle réserve — jamais l'une sans l'autre. */
export function formesDOuverture(role) {
  try {
    const lignes = lignesDuRole(role);
    // Les chantiers que ce rôle RÉSERVE — ceux qu'une ligne nomme explicitement. Une ligne au
    // chantier libre ne doit jamais pouvoir les reprendre : sans ça,
    // `ouvrir dirigeant --nature client --titre "X"` serait admis par la ligne CLIENTE — un
    // canal PRIVÉ portant la désignation réservée au dirigeant, où l'appartenance vaut
    // autorisation : n'importe quel invité y piloterait le représentant d'un client. La
    // désignation `dirigeant` ne veut dire qu'une chose, ou `--a dirigeant` ne veut plus rien
    // dire (T-20260813-0078).
    const reserves = lignes.map((l) => l.chantier).filter(Boolean);
    return lignes.map((l) => ({ ...l, reserves: l.chantier ? [] : reserves }));
  } catch {
    // Un rôle inconnu n'ouvre RIEN : il n'admet que le commun. Rendre une liste permissive
    // ici serait un garde qui s'élargit sur une faute de frappe.
    return [];
  }
}

/** Ce segment ouvre-t-il CETTE ligne ? Toutes les conditions, jamais une sur deux. */
function ouvreCetteLigne(args, ligne) {
  const chantier = premierLibre(args);
  if (!chantier) return false;
  // Le chantier : celui que la ligne fixe, ou n'importe lequel SAUF ceux qu'une autre réserve.
  if (ligne.chantier) {
    if (chantier !== ligne.chantier) return false;
  } else if (ligne.reserves.includes(chantier)) {
    return false;
  }

  const nature = optionDonnee(args, '--nature');
  if (ligne.nature === 'client') {
    // Une ligne cliente EXIGE sa nature — sans elle, le canal naîtrait public, portant le nom
    // du client. On compare la VALEUR entière : `--nature clientele` n'est pas `client`.
    if (nature.valeur !== 'client') return false;
  } else if (nature.presente) {
    // Une ligne interne ne se nomme JAMAIS d'une nature : l'autoriser laisserait ouvrir un
    // canal privé de client pour y déverser de l'interne.
    return false;
  }

  if (ligne.titreRequis) {
    const titre = optionDonnee(args, '--titre');
    // Un titre PRÉSENT MAIS VIDE, ou dont la valeur est le drapeau suivant, n'est pas un titre.
    if (!titre.presente || !String(titre.valeur ?? '').trim() || String(titre.valeur).startsWith('--')) return false;
  }

  // LE DIRIGEANT SE DEMANDE EXPLICITEMENT, et son oubli est un REFUS — c'est le bloquant de la
  // revue de fond. Sans ce drapeau, la ligne s'ouvre avec une liste d'autorisés VIDE : elle
  // refuse alors la parole à tout le monde, dirigeant compris, en ayant l'air ouverte.
  if (ligne.auDirigeant && !optionDonnee(args, '--au-dirigeant').presente) return false;

  return true;
}

/**
 * Le segment ouvre-t-il une ligne de ce rôle — et LAQUELLE ?
 *
 * Rend la clé de la ligne, ou `null`. Toutes les conditions d'une ligne sont éprouvées
 * ENSEMBLE : une forme reconnue à qui il manque une condition n'ouvre rien du tout.
 */
export function ligneOuverteParSegment(segment, role) {
  const args = argumentsDOuverture(segment);
  if (!args) return null;
  for (const ligne of formesDOuverture(role)) {
    if (ouvreCetteLigne(args, ligne)) return ligne.cle;
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

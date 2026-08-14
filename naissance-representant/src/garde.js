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
import { optionDonnee, premierLibre, OPTIONS_A_VALEUR } from '../../ligne-directe/src/arguments.js';

const SEGMENTS_COMMUNS = [
  /^\s*$/, // ligne vide
  /^#.*$/, // commentaire
  // POSE LA VARIABLE, AUCUN EFFET — mais la BORNE compte autant que la forme. `.*` en queue
  // laissait passer `LD="…ligne-directe.js" | rm -rf /tmp` : le segment était reconnu, et tout
  // ce qui suivait le pipe s'exécutait. Défaut antérieur à ce lot, fermé ici parce qu'il est de
  // la MÊME famille que celui qu'on ferme juste à côté — en laisser un ouvert à côté de
  // l'autre, c'est « une porte sur deux ».
  //
  // ⚠️ LA VALEUR CITÉE PORTE UN ESPACE, ET C'EST LA FORME RÉELLE : la séquence d'ouverture écrit
  // `LD="node $HOME/.somtech/ligne-directe/bin/ligne-directe.js"`. Interdire l'espace tout court
  // — première tentative — refusait la commande que le gabarit prescrit, c'est-à-dire un refus
  // portant sur ce qui marche. On borne donc à la fermeture du guillemet, pas à l'espace.
  /^LD=(?:"[^"]*ligne-directe\.js"|\S*ligne-directe\.js)$/,
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
    // ⚠️ UN COMMENTAIRE SHELL COUPE LA COMMANDE, ET C'EST LA TROISIÈME PORTE DU MÊME BLOQUANT
    // (relevée au troisième passage de la revue de fond, reproduite contre un vrai veilleur à
    // travers un vrai shell). `ouvrir dirigeant --titre "…" # --au-dirigeant` — un agent qui
    // s'annote en fin de ligne, geste des plus ordinaires : le shell n'a JAMAIS passé ce
    // drapeau, et le garde le lisait comme un drapeau. La ligne s'ouvrait sans autorisé.
    //
    // ON TRONQUE PLUTÔT QUE DE REFUSER, et c'est la différence avec les deux autres portes :
    // ici on sait EXACTEMENT ce que le shell fait — il jette la suite. Refuser aurait porté
    // sur des commandes commentées parfaitement légitimes ; tronquer, c'est lire comme lui.
    //
    // Seulement EN TÊTE D'UN MOT : `a#b` est littéral pour un shell, et le couper là aurait
    // amputé un titre ou un nom de canal qui porte un croisillon.
    if (c === '#' && !cite && courant === null) break;
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
 * Les options que `ouvrir` connaît — et donc, par différence, TOUT LE RESTE.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LA BORNE DE FIN, ET C'EST LA PORTE LA PLUS GRAVE DU LOT (4ᵉ passage de la revue de fond,
 * vérifiée jusqu'à l'exécution réelle).
 *
 * `segments()` découpe sur `\n`, `&&` et `;` — jamais sur un PIPE, un `||`, ni un `&` seul. Et
 * rien ne vérifiait qu'il ne restait RIEN après les drapeaux reconnus :
 *
 *     $LD ouvrir dirigeant --titre "x" --au-dirigeant | rm -rf /tmp
 *
 * était admis. Les deux membres s'exécutaient. Le garde dont la raison d'être, écrite en tête
 * de ce fichier, est « rien ne passe avant que la ligne soit ouverte » laissait passer
 * n'importe quoi — pendant la fenêtre exacte où il doit tout bloquer.
 *
 * ⚠️ CE LOT AVAIT ÉLARGI LE TROU SANS LE SAVOIR. La forme d'avant finissait par `--titre
 * ".+"$` : l'ancrage de fin bloquait le pipe PAR EFFET DE BORD. En passant aux jetons, cet
 * ancrage a disparu sans être remplacé. (L'orchestrateur, lui, était déjà exposé sur `main` —
 * son motif finissait par `.*` ; on le ferme du même geste.)
 *
 * ON NE COURT PAS APRÈS LA SYNTAXE D'UN SHELL — `|`, `||`, `&`, `>`, `<`, et le suivant qu'on
 * n'aurait pas listé. On borne par ce qu'on CONNAÎT : la commande porte le chantier et ces
 * options-là, rien d'autre. Tout jeton qui n'entre pas dans ce compte fait que le segment
 * n'ouvre rien — quel que soit le mécanisme qui l'a mis là.
 */
const OPTIONS_OUVRIR = new Set(['--titre', '--sujet', '--inviter', '--nature', '--au-dirigeant']);

/**
 * Ce segment ne porte-t-il QUE l'ouverture — un chantier, et des options connues ?
 *
 * La valeur d'une option à valeur est sautée comme `premierLibre` et `optionDonnee` la
 * sautent : sans ça, un titre serait compté comme un second argument libre et toute ouverture
 * légitime serait refusée.
 */
function rienDApresLOuverture(args) {
  let libres = 0;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      if (!OPTIONS_OUVRIR.has(a)) return false;
      if (OPTIONS_A_VALEUR.has(a)) i += 1;
      continue;
    }
    // UN SEUL argument libre : le chantier. Le deuxième est déjà la commande de quelqu'un
    // d'autre — `rm`, un chemin, un opérateur que le shell nous a laissé passer.
    libres += 1;
    if (libres > 1) return false;
  }
  return true;
}

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
  const args = jetons.slice(debut + 1);
  // LA BORNE DE FIN — voir `OPTIONS_OUVRIR`. Sans elle, tout ce qui suit une ouverture
  // syntaxiquement correcte passait avec elle, pipe compris.
  return rienDApresLOuverture(args) ? args : null;
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

/**
 * Une SUBSTITUTION DE COMMANDE — `$(…)` ou un accent grave — s'exécute avant que la commande
 * démarre, MÊME À L'INTÉRIEUR DE GUILLEMETS DOUBLES PROPRES.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * TROUVÉE AU 5ᵉ PASSAGE DE LA REVUE DE FOND, vérifiée jusqu'à l'exécution réelle, sur deux
 * points d'entrée — la pose de la variable et un `--titre` :
 *
 *     $LD ouvrir dirigeant --titre "$(touch /tmp/preuve)x" --au-dirigeant
 *
 * était admis, et l'argv reçu par la commande était parfaitement normal (`--titre x
 * --au-dirigeant`) : la ligne se serait ouverte correctement, avec son dirigeant. Et pourtant
 * la commande arbitraire avait tourné — sans aucun rapport avec le sort de la ligne.
 *
 * ⚠️ CE N'EST PAS UNE RÉGRESSION DE CE LOT : l'ancien motif `--titre\s+".+"$` acceptait déjà
 * n'importe quel contenu de valeur. Elle est fermée ici parce que la conséquence est celle de
 * la porte d'à côté — exécution arbitraire pendant la fenêtre où ce garde doit tout bloquer —
 * et qu'en laisser une ouverte à côté de l'autre est « une porte sur deux ».
 *
 * ⚠️ ET ELLE NE FERME PAS LA FAMILLE, elle ferme les deux formes qu'on a mesurées. Le plafond
 * reste : ce fichier lit un texte comme un shell le lirait sans en être un, et le shell, lui,
 * évalue. La borne de structure (`rienDApresLOuverture`) tient sur ce qui est HORS des valeurs ;
 * ceci tient sur ce qu'on sait reconnaître DEDANS. Le reste est au registre.
 *
 * L'expansion simple — `$HOME`, `$LD` — n'est PAS visée : elle n'exécute rien, et la séquence
 * d'ouverture réelle en porte deux. Les refuser aurait porté sur ce qui marche.
 */
const SUBSTITUTION = /\$\(|`/;

/**
 * Ce qu'un shell EXÉCUTE d'un segment — la suite d'un commentaire est jetée.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ « UNE PORTE SUR DEUX », ET C'ÉTAIT LA MIENNE (T-20260814-0033).
 *
 * Le commentaire shell a été appris au garde par le chemin des OUVERTURES (`jetonsDuSegment`,
 * T-20260813-0076) — et par lui seul. Les segments COMMUNS, eux, restaient éprouvés sur le
 * texte brut, contre des expressions ancrées de bout en bout. Or c'est exactement là que le
 * métier écrit les siens :
 *
 *     herdr pane current                    # ton pane
 *     $LD etat                              # une ligne est-elle déjà ouverte sur ce pane ?
 *
 * Mesuré : les deux étaient REFUSÉS. Le métier prescrivait donc, mot pour mot, une séquence
 * que le garde interdisait — le dispositif se contredisant lui-même, ce que ce lot existe
 * précisément pour empêcher. Un agent qui recopie son propre métier se voyait bloqué au
 * premier geste, sans que rien ne lui dise pourquoi.
 *
 * La coupe remonte donc d'un cran : elle a lieu UNE FOIS, ici, et les deux chemins lisent
 * ensuite le même texte. C'est aussi ce qui empêche la prochaine asymétrie du même genre.
 */
function sansCommentaire(segment) {
  const texte = String(segment || '');
  let cite = false;
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    if (c === '"') cite = !cite;
    // ⚠️ ON NE COUPE PAS CE QU'ON NE SAIT PAS LIRE, et c'est la MÊME règle que
    // `jetonsDuSegment` (relevé en revue de fond : les deux lisaient le même texte et n'en
    // faisaient pas la même chose). Une apostrophe hors citation ou un échappement rendent la
    // position des citations incertaine — donc celle des croisillons.
    //
    // ⚠️ ET UNE MUTATION QUI RETIRE CES DEUX LIGNES SURVIT À TOUTE LA SUITE. C'est dit plutôt
    // que maquillé : la revue avait déjà classé la divergence NON EXPLOITABLE, et la
    // vérification le confirme — toute troncature qui aurait lieu ici laisse forcément le `'`
    // ou le `\` ORPHELIN dans le préfixe conservé, et cet orphelin fait échouer aussi bien les
    // expressions ancrées de bout en bout de `SEGMENTS_COMMUNS` que le `null` de
    // `jetonsDuSegment`. Aucun essai ne peut donc départager les deux versions, et en écrire
    // un aurait été décoratif.
    //
    // Ces deux lignes restent pour une raison qui n'est pas d'aujourd'hui : deux fonctions qui
    // lisent le même texte et n'en font pas la même chose divergent au premier correctif porté
    // à l'une des deux. Le jour où `SEGMENTS_COMMUNS` cesse d'être ancré, ou où un autre
    // appelant se sert de la troncature, c'est cette règle-là qui tient — pas la coïncidence.
    if (c === "'" && !cite) return texte;
    if (c === '\\') return texte;
    // Un croisillon n'ouvre un commentaire qu'EN TÊTE D'UN MOT et hors citation : `a#b` est
    // littéral pour un shell, et couper là amputerait un titre qui porte un croisillon.
    if (c === '#' && !cite && (i === 0 || /\s/.test(texte[i - 1]))) return texte.slice(0, i);
  }
  return texte;
}

/** Découpe une commande Bash en segments indépendants — chacun doit être autorisé. */
export function segments(commande) {
  return String(commande || '')
    .split(/\n|&&|;/)
    .map((s) => sansCommentaire(s).trim())
    .filter((s) => s.length > 0);
}

/** Les segments d'une commande qui n'appartiennent pas à la séquence d'ouverture de ce rôle. */
export function segmentsHorsSequence(commande, role = 'representant') {
  return segments(commande).filter(
    (s) =>
      // La substitution est éprouvée AVANT toute reconnaissance : un segment qui en porte une
      // n'appartient à la séquence d'ouverture sous AUCUNE forme, fût-il par ailleurs parfait.
      SUBSTITUTION.test(s) || (!SEGMENTS_COMMUNS.some((r) => r.test(s)) && !ligneOuverteParSegment(s, role))
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

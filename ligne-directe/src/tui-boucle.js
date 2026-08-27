/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LA BOUCLE DU TUI — L'ARÊTE DU TERMINAL, celle qui ne se mute pas et s'EXERCE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Tout ce qui est décidable vit dans `tui-vue-du-parc.js` et s'éprouve sans terminal. Ici ne
 * restent que les gestes qui franchissent un PROCESSUS : le mode brut du clavier, le redraw,
 * le resize, et le `herdr agent focus` d'un pane.
 *
 * 🔴 CETTE COUCHE SE RÉVÈLE EN TAPANT LA COMMANDE, jamais par mutation. La leçon est celle du
 * geste `vue` : le code des deux côtés était juste, et l'écran sortait quand même vide — il a
 * fallu LANCER pour le voir. On garde donc `decoderTouche` PURE et exportée (elle, se mute),
 * et on EXERCE le reste.
 */

import { OUTILS, lancer } from './outils.js';
import { ecrireLaVue, rendreLaVue } from './vue-du-parc.js';
import { rendreEcran, arbreDeLaVue, lignesVisibles, appliquerTouche, etatInitial } from './tui-vue-du-parc.js';

// ⚠️ ÉCRITS EN ÉCHAPPEMENTS, JAMAIS EN CARACTÈRES BRUTS. Un octet de contrôle collé dans une
// source est INVISIBLE à la relecture : une comparaison contre lui se lit exactement comme
// une comparaison contre la chaîne VIDE, et les deux n'ont rien à voir — l'une reconnaît la
// touche « effacer », l'autre effacerait un caractère au moindre signal que personne n'a su
// nommer. On ne se fie pas à l'œil pour départager : on écrit le point de code.
const ESC = '\u001b';
const CTRL_C = '\u0003';
const EFFACER = ['\u007f', '\b'];

/** Les couleurs, par style de ligne — la seule place du dépôt qui en pose. */
const COULEURS = {
  titre: `${ESC}[48;5;238m${ESC}[38;5;253m`,
  pied: `${ESC}[48;5;238m${ESC}[38;5;222m`,
  selection: `${ESC}[48;5;240m${ESC}[97m`,
  'arbre:app': `${ESC}[1m${ESC}[38;5;117m`,
  'arbre:section': `${ESC}[1m${ESC}[38;5;245m`,
  'arbre:orchestrateur': `${ESC}[38;5;114m`,
  'arbre:epic': `${ESC}[38;5;252m`,
  'arbre:story': `${ESC}[38;5;245m`,
  'arbre:agent-hors': `${ESC}[38;5;245m`,
  vide: '',
};
const FIN = `${ESC}[0m`;

/**
 * QUEL RENDU LE DIRIGEANT A DEMANDÉ — l'écran, ou le texte.
 *
 * 🔴 CETTE DÉCISION NE PEUT PAS VIVRE DANS LE `bin`, ET UNE GARDE L'A REFUSÉE AVANT MOI.
 * Le `bin` est STRUCTURELLEMENT hors d'atteinte des bancs : un lancement sous `node --test`
 * transmet le contexte de test à l'enfant, qui tente de faire naître un veilleur que la cloison
 * refuse à juste titre. Un `if` posé là serait invisible à la mutation COMME à la relecture.
 * C'est la même raison qui avait fait sortir `ecrireLaVue` du `bin` un lot plus tôt.
 *
 * ⚠️ ET LE TEXTE RESTE LE DÉFAUT. Des scripts et des agents sans terminal lisent cette sortie :
 * en faire un écran interactif par défaut casserait leur lecture SANS QU'AUCUN D'EUX PUISSE LE
 * DIRE — une perte silencieuse de plus, sur le chemin le plus fréquenté.
 */
export const DRAPEAU_DE_LECRAN = '--tui';

export function veutLEcran(args) {
  return (args ?? []).includes(DRAPEAU_DE_LECRAN);
}

/**
 * SERVIR LA VUE — le seul point que le `bin` appelle, et il ne fait que déléguer.
 */
export async function servirLaVue({
  args = [],
  lireLaVue,
  entree,
  sortie = process.stdout,
  focus,
  socket = process.env.HERDR_SOCKET_PATH ?? null,
  surRefus,
  ouvrirLEcran = boucleDuTui,
} = {}) {
  if (!veutLEcran(args)) {
    const vue = await lireLaVue();
    sortie.write(ecrireLaVue(vue, args));
    return { code: 0 };
  }
  return ouvrirLEcran({ lireLaVue, entree, sortie, focus, socket, surRefus });
}

/**
 * UNE SÉQUENCE DE CLAVIER → UN NOM DE TOUCHE. Pure, donc éprouvable.
 *
 * ⚠️ LES FLÈCHES ARRIVENT EN TROIS OCTETS (`ESC [ A`), et `Échap` seul en un. Les confondre
 * ferait quitter le TUI à chaque flèche — c'est-à-dire rendre la navigation impossible par
 * l'exacte touche qui la sert.
 */
export function decoderTouche(donnees) {
  const s = String(donnees ?? '');
  if (s === `${ESC}[A`) return 'haut';
  if (s === `${ESC}[B`) return 'bas';
  if (s === `${ESC}[C`) return 'droite';
  if (s === `${ESC}[D`) return 'gauche';
  if (s === '\r' || s === '\n') return 'entree';
  if (EFFACER.includes(s)) return 'effacer';
  if (s === ESC) return 'echap';
  // ⚠️ Ctrl-C N'EST PAS UNE LETTRE. En mode brut le terminal ne l'intercepte plus : sans cette
  // ligne, le seul moyen de sortir d'un TUI figé serait de tuer le terminal.
  if (s === CTRL_C) return 'q';
  if (s.length === 1) return s;
  return null;
}

/**
 * UN BLOC D’OCTETS → UNE SUITE DE TOUCHES. Pure, donc éprouvable.
 *
 * 🔴 CE DÉFAUT EST SORTI EN TAPANT, ET RIEN D’AUTRE NE POUVAIT LE TROUVER. La boucle
 * appelait `decoderTouche` sur le bloc ENTIER que le terminal lui remettait. Un terminal ne
 * remet pas les touches une par une : il remet ce qui est arrivé depuis la dernière lecture.
 * MESURÉ en exerçant le vrai TUI dans un vrai pty : **six touches arrivées en un bloc de 10
 * octets rendaient `null`** — les six étaient perdues, et l’écran restait figé jusqu’à ce
 * qu’on le tue.
 *
 * ⚠️ CE N’EST PAS UN CAS DE BORD : **tenir la flèche ↓ enfoncée suffit** — la répétition
 * clavier produit exactement cette rafale. Le dirigeant l’aurait rencontré au premier écran.
 * Aucun banc du dépôt ne pouvait le voir : tous appellent le décodeur avec UNE touche,
 * c’est-à-dire qu’ils fabriquaient leur propre appelant.
 */
export function decoderTouches(donnees, reste = '') {
  // 🔴 LE RESTE TRAVERSE LES LECTURES, ET C'EST UN DÉFAUT MESURÉ QUI SE FERME ICI. Ce décodeur
  // n'avait AUCUNE mémoire d'un appel à l'autre. Quand le terminal remet l'octet `ESC` seul
  // dans une lecture, puis `[B` dans la suivante — SSH, tmux, ou simplement la latence entre
  // deux `read()` — le `ESC` isolé était lu comme Échap. La flèche voulue n'était jamais vue.
  //
  // ⚠️ LA GARDE PRÉCÉDENTE NE COUVRAIT QU'UN BORD. Elle attendait la suite quand `ESC` et `[`
  // arrivaient ENSEMBLE sans la lettre finale ; elle ne disait rien de `ESC` arrivant SEUL.
  // C'est la même famille que la rafale fermée un commit plus tôt, sur l'autre bord — et
  // c'est une passe de revue qui l'a trouvée, pas une relecture.
  const s = String(reste ?? '') + String(donnees ?? '');
  const touches = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === ESC) {
      // ⚠️ UN `ESC` EN TOUTE FIN DE TAMPON EST INDÉCIDABLE : Échap, ou le premier octet d'une
      // flèche coupée en deux lectures ? On ne tranche pas — on le GARDE pour la suite.
      if (i === s.length - 1) return { touches, reste: ESC };
      if (s[i + 1] === '[') {
        // ⚠️ UNE SÉQUENCE CSI SE LIT ENTIÈRE OU SE JETTE ENTIÈRE. La découper ferait lire son
        // `ESC` comme Échap — donc agir sur une séquence que le terminal a émise seul (souris,
        // collage encadré, touche de fonction).
        let j = i + 2;
        while (j < s.length && !(s.charCodeAt(j) >= 0x40 && s.charCodeAt(j) <= 0x7e)) j += 1;
        if (j >= s.length) return { touches, reste: s.slice(i) };
        const t = decoderTouche(s.slice(i, j + 1));
        if (t !== null) touches.push(t);
        i = j + 1;
        continue;
      }
      // `ESC` suivi d'autre chose que `[` : c'est bien Échap, et on peut le dire.
      touches.push('echap');
      i += 1;
      continue;
    }
    const t = decoderTouche(s[i]);
    if (t !== null) touches.push(t);
    i += 1;
  }
  return { touches, reste: '' };
}

/**
 * METTRE UN TERMINAL EN FOCUS — de l'ADRESSAGE, et rien d'autre (HS-VUE-001).
 *
 * ⚠️ LA SESSION VOYAGE AVEC LE PANE. Mesuré : `w7:p1` existe dans `somtech` ET dans `progex`.
 * Un focus sans sa session met devant les yeux du dirigeant le terminal d'un autre agent.
 */
export async function mettreEnFocus(pane, socket, { executer } = {}) {
  try {
    await lancer(OUTILS.herdr, ['agent', 'focus', pane], {
      ...(executer ? { executer } : {}),
      ...(socket ? { env: { ...process.env, HERDR_SOCKET_PATH: socket } } : {}),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, pourquoi: err?.message ?? String(err) };
  }
}

/**
 * LA PROGRESSION DU PREMIER CHARGEMENT — ce qu'on écrit pendant les ~80 s.
 *
 * 🔴 ON N'INVENTE AUCUN POURCENTAGE. La lecture est UN appel au veilleur qui ne rend aucun
 * jalon : une barre qui avancerait affirmerait une progression qu'on ne mesure pas. On rend
 * donc ce qu'on MESURE — le temps écoulé — et ce qu'on ATTEND, en toutes lettres.
 */
/**
 * LE TEXTE DE PROGRESSION — ET IL SE BORNE À LA LARGEUR DU PANE (T-20260825-0071).
 *
 * 🔴 SANS LA BORNE, IL EMPILE UNE LIGNE TOUTES LES 120 ms. C’est l’incident que le dirigeant
 * a rapporté en usage réel : « j’ai des lignes qui se multiplient sans arrêt », dans un split
 * herdr. Reproduit dans un vrai pane de 65 colonnes, écran lu par `herdr pane read` :
 * **+21 lignes en 8 secondes**, pendant les ~80 s de chargement.
 *
 * LE MÉCANISME, MESURÉ : `avecProgression` réécrit cette ligne avec `\r` + effacement de
 * ligne. Sous la longueur du texte, il WRAPPE — le curseur passe à la ligne suivante, donc le
 * `\r` du tour d’après revient au début de la NOUVELLE ligne et l’effacement porte sur celle-là.
 * La précédente reste, définitivement.
 *
 * ⚠️ ET LE SEUIL EST UNE PLAGE, PAS UN NOMBRE — c'est ce qui rend ce défaut coûteux à chercher.
 * La longueur varie avec le NOMBRE DE CHIFFRES du compteur : 115 caractères de 0 à 9 secondes,
 * 116 de 10 à 99, 117 au-delà. Donc sous 115 colonnes ça empile systématiquement ; entre 115 et
 * 117, ça se met à empiler EN COURS DE ROUTE, quand le compteur passe à deux chiffres puis à
 * trois.
 *
 * 🔴 QUELQU'UN QUI TESTE À 116 COLONNES PENDANT LES NEUF PREMIÈRES SECONDES NE VOIT RIEN, et
 * conclut que le défaut n'existe pas. Un défaut qu'on ne voit pas quand on le cherche mal coûte
 * plus cher qu'un défaut franc.
 *
 * ⚠️ CETTE PROSE A DIT « 116 caractères, longueur fixe » — une constante INVENTÉE pour expliquer
 * le mécanisme, dans un commentaire qu'aucune garde ne peut atteindre. C'est la deuxième fois
 * dans ce lot. Le code, lui, n'a jamais dépendu du chiffre : il mesure `[...texte].length` à
 * l'exécution.
 *
 * ⚠️ ET C’EST POURQUOI PERSONNE NE L’AVAIT VU : en pane large la ligne tient, et rien ne
 * s’empile. Le symptôme n’existe QUE dans un pane étroit — c’est-à-dire exactement l’écran que
 * le dirigeant regardait.
 *
 * ⚠️ ON TRONQUE, ON NE RACCOURCIT PAS LE MESSAGE. Le texte dit ce que le lecteur doit savoir
 * pendant 80 s d’attente : que ça interroge chantier par chantier, et combien de temps ça
 * prend. Le réécrire plus court le priverait de cette information sur un écran LARGE, pour
 * un défaut qui n’existe que sur un écran ÉTROIT.
 */
export function texteDeProgression(secondes, tourne, largeur = Infinity) {
  const roue = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const texte =
    `${roue[tourne % roue.length]} lecture du parc — ${secondes} s écoulées ` +
    `(le ServiceDesk est interrogé chantier par chantier ; ~80 s au premier chargement)`;
  // ⚠️ ON COMPTE EN POINTS DE CODE, pas en unités UTF-16.
  //
  // 🔴 CORRECTION D’UNE PROSE FAUSSE QUE J’AVAIS ÉCRITE ICI, relevée en campagne de mutation :
  // elle disait « la roue et les accents seraient comptés faux par `.length` ». **C’est faux** —
  // ⠋ (U+280B) et é sont dans le BMP, `.length` les compte juste, et la mutation qui remettait
  // `.length` SURVIVAIT à mes bancs. Un motif faux qui garde une conduite juste finit par la
  // faire tomber avec lui le jour où quelqu’un le vérifie.
  //
  // LE VRAI MOTIF : un caractère HORS BMP (emoji, U+1F534…) pèse 2 en UTF-16 et 1 à l’écran.
  // Rien n’en met dans ce message aujourd’hui — mais la borne protège la LARGEUR D’AFFICHAGE,
  // et c’est en points de code qu’elle se mesure. On compte donc juste par construction,
  // plutôt que juste par chance sur le texte du jour.
  const points = [...texte];
  if (!Number.isFinite(largeur) || points.length <= largeur) return texte;
  return points.slice(0, Math.max(0, largeur)).join('');
}

const ALT_ON = `${ESC}[?1049h${ESC}[?25l`;
const ALT_OFF = `${ESC}[?25h${ESC}[?1049l`;

/**
 * LA BOUCLE — elle ne DÉCIDE rien : elle lit une touche, demande au modèle, exécute l'effet.
 *
 * @param lireLaVue  `() => Promise<vue>` — injecté, pour que la boucle n'appelle pas le veilleur.
 * @param entree/sortie  les flux, injectables : un banc peut en fournir de faux.
 * @param focus      `(pane, socket) => Promise` — injecté, pour ne pas bouger un vrai terminal.
 */
export async function boucleDuTui({
  lireLaVue,
  entree = process.stdin,
  sortie = process.stdout,
  focus = mettreEnFocus,
  socket = null,
  surRefus = () => {},
} = {}) {
  let vue = await avecProgression(lireLaVue, sortie);
  // 🔴 LA MÊME GARDE QUE `rendreLaVue`, À LA PORTE DU TUI. Un veilleur plus ancien que le
  // disque rend `{ ok:false, erreur:'geste inconnu' }` — un objet qui traverserait tout ce
  // module sans résistance et peindrait un parc PARFAITEMENT MIS EN PAGE ET DÉSERT.
  if (!vue || typeof vue !== 'object' || !('registre' in vue)) {
    const cause = vue?.erreur ?? vue?.raison ?? 'ce qui a été reçu n’est pas une vue du parc';
    sortie.write(
      `LA VUE DU PARC — REFUSÉE\n\nje n’ai pas obtenu de vue : ${cause}.\n\n` +
        (/geste inconnu/i.test(String(cause))
          ? 'Ceci ne dit PAS que le code est fautif : le veilleur EN VIE porte une version plus\n' +
            'ancienne que celle installée sur le disque. Le geste : le redémarrer.\n\n'
          : '') +
        'Ceci n’est PAS « personne ne travaille » — c’est « je n’ai pas su regarder ».\n'
    );
    return { code: 1 };
  }

  // 🔴 « EST-CE UNE VUE ? » N'EST QUE LA MOITIÉ DE LA QUESTION. L'AUTRE EST « A-T-ELLE PU
  // MESURER ? », et elle manquait — c'est le MODE DE PANNE FONDATEUR de ce chantier, laissé
  // ouvert par le module qui existe pour le fermer.
  //
  // ⚠️ MESURÉ. Quand le recensement refuse (herdr injoignable), `laVueDuParc` rend
  // `orchestrateurs: null` AVEC une clé `registre` — donc la garde du dessus la laisse passer,
  // `arbreDeLaVue` replie ce `null` en tableau vide, et l'écran peint :
  //     VUE DU PARC ─── par APP · ? orchestrateurs · ? epics
  //                                       │ (rien de sélectionné)
  // Un parc PARFAITEMENT MIS EN PAGE ET PARFAITEMENT DÉSERT. Le dirigeant y lit « personne ne
  // travaille » ; la vérité est que personne n'a REGARDÉ.
  //
  // 🔴 ET LE RENDU TEXTE QUE CE TUI DOUBLE TRAITAIT DÉJÀ CE CAS MIEUX QUE LUI — il écrit « LA
  // VUE DU PARC — SANS REGISTRE … Ce n'est pas "personne ne travaille", c'est "je n'ai pas su
  // regarder" ». Livrer l'écran sans cette garde, c'était livrer une RÉGRESSION du produit sorti
  // deux jours plus tôt.
  //
  // ⚠️ ON DÉLÈGUE LA PHRASE À `rendreLaVue`, ON NE LA RÉÉCRIT PAS. Une seconde formulation du
  // même refus finirait par diverger de la première — et c'est la première qui porte les gardes.
  if (!Array.isArray(vue.orchestrateurs)) {
    sortie.write(rendreLaVue(vue));
    return { code: 1 };
  }

  let etat = etatInitial();
  const dessiner = () => {
    const racines = arbreDeLaVue(vue, { parApp: etat.parApp });
    const lignes = lignesVisibles(racines, etat);
    // ⚠️ DEUX REPLIS DIFFÉRENTS DANS CE FICHIER, ET C’EST VOULU — mais ça ne se voyait nulle
    // part (relevé en revue portail). ICI, sans TTY, on doit quand même DESSINER quelque
    // chose : un écran de 100×30 est un défaut raisonnable. Dans `avecProgression`, le repli
    // est `Infinity` — voir la note là-bas : ne rien borner y est le bon geste, parce qu’il
    // n’y a alors aucun terminal pour wrapper.
    //
    // ⚠️ NE PAS LES FONDRE : appliquer 100 à la progression la tronquerait sans raison dans
    // un journal, et appliquer `Infinity` ici demanderait un écran de largeur infinie.
    const largeur = sortie.columns || 100;
    const hauteur = sortie.rows || 30;
    const ecran = rendreEcran({ vue, etat, lignes, largeur, hauteur });
    // ⚠️ ON REPEINT L'ÉCRAN ENTIER EN UNE SEULE ÉCRITURE. Écrire ligne par ligne fait
    // scintiller, et un écran qui scintille se lit comme un écran qui plante.
    sortie.write(
      `${ESC}[H${ESC}[2J${ecran.map((l) => `${COULEURS[l.style] ?? ''}${l.texte}${FIN}`).join('\r\n')}`
    );
    return lignes;
  };

  const brut = typeof entree.setRawMode === 'function';
  if (brut) entree.setRawMode(true);
  // 🔴 ON NE `resume()` PAS, ET C'EST UN DÉFAUT MESURÉ, PAS UN DÉTAIL DE STYLE. `resume()` met
  // le flux en mode COURANT ; les octets qui arrivent avant qu'un consommateur soit attaché sont
  // alors JETÉS. Entre ce `resume()` et le `for await` plus bas, il y a le premier `dessiner()` —
  // une fenêtre pendant laquelle tout ce que le terminal a déjà remis disparaît.
  //
  // ⚠️ MESURÉ EN PTY RÉEL : des touches présentes dans le tampon AVANT l'ouverture de l'écran
  // étaient perdues, et le TUI restait à attendre une entrée qu'il venait d'avaler. L'itérateur
  // asynchrone gère lui-même le débit — il n'a besoin d'aucun `resume()`.
  //
  // ⚠️ ET UN HUMAIN NE L'AURAIT PRESQUE JAMAIS VU : il tape APRÈS que l'écran s'affiche. Ce sont
  // les touches déjà en attente — un collage, une frappe pendant les ~80 s de chargement — qui
  // tombaient. C'est-à-dire précisément l'impatience que la progression est censée soulager.
  if (typeof entree.setEncoding === 'function') entree.setEncoding('utf8');
  sortie.write(ALT_ON);

  // ⚠️ LE RESIZE SE REDESSINE, il ne se subit pas : une fenêtre agrandie laisserait sinon la
  // moitié droite de l'ancien écran collée à l'écran neuf.
  const surResize = () => dessiner();
  sortie.on?.('resize', surResize);

  let lignes = dessiner();

  try {
    let reste = '';
    boucle: for await (const donnees of entree) {
      // 🔴 UNE RAFALE, PAS UNE TOUCHE. Le terminal remet ce qui est arrivé depuis la dernière
      // lecture — tenir ↓ enfoncé en met six ou dix dans le même bloc. Décoder le bloc comme
      // UNE touche les perdait TOUTES et figeait l’écran (mesuré en pty réel).
      //
      // 🔴 ET LE RESTE TRAVERSE LES LECTURES. Une flèche coupée entre deux `read()` laissait
      // son `ESC` seul, lu comme Échap : la flèche faisait QUITTER. Le décodeur garde
      // désormais ce qu'il ne peut pas trancher, et on le lui rend au tour suivant.
      const decode = decoderTouches(donnees, reste);
      reste = decode.reste;
      for (const touche of decode.touches) {
        const { etat: suivant, effet } = appliquerTouche(etat, touche, lignes);
        etat = suivant;
        if (effet?.type === 'quitter') break boucle;
        if (effet?.type === 'relire') {
          sortie.write(ALT_OFF);
          vue = await avecProgression(lireLaVue, sortie);
          sortie.write(ALT_ON);
        }
        if (effet?.type === 'refus') surRefus(effet.pourquoi);
        if (effet?.type === 'focus') {
          await focus(effet.pane, socket);
          // ⚠️ ON REND LA MAIN APRÈS UN FOCUS. Le dirigeant vient de demander à REGARDER un
          // autre terminal : garder le TUI par-dessus lui rendrait le geste inopérant.
          break boucle;
        }
        // ⚠️ ON REDESSINE À CHAQUE TOUCHE DE LA RAFALE, PAS UNE FOIS À LA FIN : `lignes` sert
        // à la touche SUIVANTE (le curseur s’y repère), et une rafale de flèches sur des
        // `lignes` périmées désignerait la mauvaise ligne au moment du focus.
        lignes = dessiner();
      }
    }
  } finally {
    sortie.off?.('resize', surResize);
    if (brut) entree.setRawMode(false);
    entree.pause?.();
    sortie.write(ALT_OFF);
  }
  return { code: 0 };
}

/**
 * LA PROGRESSION PENDANT LES ~80 s DE CHARGEMENT — ET C’EST ELLE QUI EMPILAIT.
 *
 * 🔴 EXPORTÉE POUR ÊTRE ÉPROUVABLE (T-20260825-0071). Elle ne l’était pas, et c’est ce qui a
 * laissé l’incident sortir : `texteDeProgression` était testable, mais la fonction qui ÉCRIT
 * — celle qui borne, ou pas — n’était atteinte par AUCUN banc. Mesuré en campagne : retirer
 * la largeur passée au battement, ou la lire une seule fois au départ, laissait la suite
 * ENTIÈREMENT VERTE.
 *
 * ⚠️ C’est le motif « une garde posée sur le cas, prise pour une garde sur la famille » —
 * payé onze fois sur E-20260825-0001. Ici il portait sur le CHEMIN : je gardais le texte
 * rendu, pas le geste qui l’écrit.
 *
 * @param intervalle  la période du battement, injectable : un banc ne doit pas attendre 120 ms.
 */
export async function avecProgression(lireLaVue, sortie, { intervalle = 120 } = {}) {
  const depart = Date.now();
  let tour = 0;
  const battement = setInterval(() => {
    const s = Math.round((Date.now() - depart) / 1000);
    // ⚠️ LA LARGEUR SE RELIT À CHAQUE TOUR. Lue une seule fois au départ, un pane redimensionné
    // pendant les 80 s de chargement rouvrirait le trou en silence — et redimensionner un
    // split est précisément ce qu’on fait quand un affichage devient illisible.
    // ⚠️ REPLI `Infinity`, ET IL DIFFÈRE DE CELUI DE `dessiner()` (100) — les deux sont justes
    // pour leur chemin, et le dire ici évite qu’on les « harmonise » un jour.
    //
    // Sans TTY (`columns` absent), la sortie n’est pas un terminal : personne ne wrappe, donc
    // rien à borner — et tronquer priverait un journal du message entier. Le défaut ne se
    // produit QUE devant un vrai terminal, qui annonce toujours sa largeur.
    //
    // ⚠️ `|| Infinity` ATTRAPE AUSSI `columns === 0`, qui ne se produit pas sur un terminal
    // réel. Si un jour ça arrivait, ne rien borner serait le pire choix — mais borner à 0
    // effacerait la progression entière. Cas non mesuré : signalé, pas comblé à l’aveugle.
    const largeur = sortie.columns || Infinity;
    sortie.write(`\r${ESC}[2K${texteDeProgression(s, (tour += 1), largeur)}`);
  }, intervalle);
  // ⚠️ IL NE TIENT PAS LE PROCESSUS EN VIE. Sans `unref`, un battement de 120 ms empêcherait
  // node de sortir si la lecture échouait sans rejeter — un TUI qui ne rend jamais la main.
  battement.unref?.();
  try {
    return await lireLaVue();
  } finally {
    clearInterval(battement);
    sortie.write(`\r${ESC}[2K`);
  }
}

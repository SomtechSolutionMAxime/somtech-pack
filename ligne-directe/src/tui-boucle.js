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
export function texteDeProgression(secondes, tourne) {
  const roue = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  return (
    `${roue[tourne % roue.length]} lecture du parc — ${secondes} s écoulées ` +
    `(le ServiceDesk est interrogé chantier par chantier ; ~80 s au premier chargement)`
  );
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

  let etat = etatInitial();
  const dessiner = () => {
    const racines = arbreDeLaVue(vue, { parApp: etat.parApp });
    const lignes = lignesVisibles(racines, etat);
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
  entree.resume?.();
  if (typeof entree.setEncoding === 'function') entree.setEncoding('utf8');
  sortie.write(ALT_ON);

  // ⚠️ LE RESIZE SE REDESSINE, il ne se subit pas : une fenêtre agrandie laisserait sinon la
  // moitié droite de l'ancien écran collée à l'écran neuf.
  const surResize = () => dessiner();
  sortie.on?.('resize', surResize);

  let lignes = dessiner();

  try {
    for await (const donnees of entree) {
      const touche = decoderTouche(donnees);
      if (touche === null) continue;
      const { etat: suivant, effet } = appliquerTouche(etat, touche, lignes);
      etat = suivant;
      if (effet?.type === 'quitter') break;
      if (effet?.type === 'relire') {
        sortie.write(ALT_OFF);
        vue = await avecProgression(lireLaVue, sortie);
        sortie.write(ALT_ON);
      }
      if (effet?.type === 'refus') surRefus(effet.pourquoi);
      if (effet?.type === 'focus') {
        await focus(effet.pane, socket);
        // ⚠️ ON REND LA MAIN APRÈS UN FOCUS. Le dirigeant vient de demander à REGARDER un autre
        // terminal : garder le TUI en plein écran par-dessus lui rendrait le geste inopérant.
        break;
      }
      lignes = dessiner();
    }
  } finally {
    sortie.off?.('resize', surResize);
    if (brut) entree.setRawMode(false);
    entree.pause?.();
    sortie.write(ALT_OFF);
  }
  return { code: 0 };
}

async function avecProgression(lireLaVue, sortie) {
  const depart = Date.now();
  let tour = 0;
  const battement = setInterval(() => {
    const s = Math.round((Date.now() - depart) / 1000);
    sortie.write(`\r${ESC}[2K${texteDeProgression(s, (tour += 1))}`);
  }, 120);
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

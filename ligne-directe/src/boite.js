// boite.js — LIRE LA BOÎTE DE SAISIE D'UNE SESSION, et c'est le seul endroit qui sait le faire.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER A ÉTÉ SORTI DE `livraison.js` (T-20260814-0138)
//
// Deux chemins écrivent du texte dans le pane d'un agent, et un seul savait vérifier :
//
//   • `naissance-representant` — le brief livré à une session, qui relisait la boîte ;
//   • `ligne-directe` — la parole du DIRIGEANT remise à son agent, et l'écho entre pairs, qui
//     ne relisaient rien du tout.
//
// Le second est le plus exposé : le texte y vient de Slack, donc de longueur arbitraire, et
// c'est la longueur qui fait rester un message dans la boîte sans être soumis. Un arbitrage du
// dirigeant pouvait donc se perdre sur le chemin même qui existe pour le lui garantir.
//
// Recopier la lecture de boîte dans `ligne-directe` aurait rejoué « une porte sur deux » — le
// motif que ce dépôt a payé dix fois, et deux fois DANS le correctif d'un défaut de cette
// famille. Elle vit donc ici, au niveau que les deux importent déjà, et `livraison.js` la
// réexporte pour ne rien casser de ce qui la nommait.

/** La marque de la boîte de saisie d'une session Claude Code dans un terminal. */
const INVITE = '❯';

/** Un filet — la ligne de tirets qui encadre la boîte de saisie à l'écran. */
const FILET = /^[─-╿]{8,}\s*$/;

/**
 * Le contenu ACTUEL de la boîte de saisie, lu dans un dump de terminal.
 *
 * POURQUOI ON NE CHERCHE PAS SIMPLEMENT L'INVITE (relevé en revue de fond, motif 1 — « la
 * garde vérifie le contenu, pas le fait »). La première version prenait la DERNIÈRE ligne
 * portant `❯`. C'était déjà mieux que la première (les messages déjà soumis restent affichés
 * avec la même marque, et les lire ferait prendre un message traité pour un reste) — mais ça
 * reste une garde sur un CARACTÈRE. Un brief bloqué dans la boîte dont une ligne ne porte
 * qu'un `❯` — cas plausible dès qu'un brief parle de terminaux, comme ceux de ce dépôt — se
 * lisait alors comme une boîte VIDE, et on écrivait par-dessus : exactement la fusion que ce
 * module existe pour empêcher.
 *
 * On s'ancre donc sur la STRUCTURE de l'écran, qui est ce qui distingue vraiment la boîte :
 * elle est encadrée par deux filets, et c'est le dernier couple de filets du dump. Tout ce qui
 * est entre les deux est le contenu de la boîte — y compris ses lignes suivantes, ce que la
 * lecture ligne-à-ligne ne savait pas faire non plus.
 *
 * Rend `''` quand la boîte est vue vide. Rend `null` quand on n'a pas su la reconnaître — ce
 * n'est PAS une boîte vide : c'est une boîte qu'on n'a pas lue, et les deux ne se traitent pas
 * pareil. Un écran dont le format change rend donc `null`, ce qui fait refuser la livraison
 * plutôt que la fusionner : c'est le sens sûr.
 */
/**
 * Ce qui est rendu en GRIS (SGR 2) dans un dump ANSI — et pourquoi il faut le jeter.
 *
 * ⚠️ MESURÉ le 2026-08-14, et ça a pris la mesure elle-même au piège : une boîte de saisie VIDE
 * n'est pas un écran vide. Claude Code y affiche une SUGGESTION grisée, tirée de l'historique de
 * la session — un agent jetable qui n'avait jamais rien reçu proposait « ignore that, check the
 * staging sas on this repo », phrase d'une AUTRE session.
 *
 * En texte brut, rien ne la distingue d'un reste. On lisait donc « la boîte contient quelque
 * chose » sur une boîte parfaitement vide, et on REFUSAIT de livrer alors que tout allait bien —
 * un refus injustifié sur le chemin même qui existe pour ne rien perdre.
 *
 * Le seul discriminant est le rendu. On lit l'écran en `--format ansi`, on retire ce qui est
 * grisé, puis toutes les séquences restantes. Un dump SANS ANSI traverse inchangé : les essais
 * qui portent des écrans recopiés en texte brut continuent de dire ce qu'ils disaient.
 */
const ESC = String.fromCharCode(27);
const GRISE = new RegExp(`${ESC}\\[(?:[0-9;]*;)?2m[\\s\\S]*?${ESC}\\[(?:22|0)m`, 'g');
const SEQUENCE = new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, 'g');

export function sansGris(texteTerminal) {
  return String(texteTerminal ?? '')
    .replace(GRISE, '')
    .replace(SEQUENCE, '');
}

export function contenuBoite(texteTerminal) {
  const lignes = sansGris(texteTerminal).split('\n');
  const filets = [];
  for (let i = 0; i < lignes.length; i += 1) {
    if (FILET.test(lignes[i].trim())) filets.push(i);
  }
  if (filets.length < 2) return null;

  const bas = filets[filets.length - 1];
  const haut = filets[filets.length - 2];
  const dedans = lignes.slice(haut + 1, bas);
  if (dedans.length === 0) return null;

  const j = dedans[0].indexOf(INVITE);
  if (j === -1) return null; // ce n'est pas la boîte de saisie : on ne l'a pas reconnue
  const corps = [dedans[0].slice(j + INVITE.length), ...dedans.slice(1)];
  return corps.join('\n').trim();
}

/** La boîte est-elle vide ET lisible ? Une boîte illisible n'est pas une boîte vide. */
export function boiteEstVide(texteTerminal) {
  return contenuBoite(texteTerminal) === '';
}

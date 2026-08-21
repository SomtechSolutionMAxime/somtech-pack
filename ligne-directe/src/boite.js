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

/**
 * La marque de la boîte de saisie d'une session Claude Code dans un terminal.
 *
 * ⚠️ EXPORTÉE — elle vivait en deux exemplaires, ici et dans `ecran.js` (T-20260821-0027).
 */
export const INVITE = '❯';

/**
 * UN FILET — la ligne de tracé qui encadre la boîte de saisie à l'écran.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 UN FILET PEUT PORTER UN TITRE, ET L'IGNORER A RENDU UN ORCHESTRATEUR INJOIGNABLE
 * (T-20260821-0025).
 *
 * La première écriture exigeait une ligne faite RIEN QUE de tracé — `/^[─-╿]{8,}\s*$/`. Or une
 * session **rattachée** (ouverte par `claude agents`) affiche le nom de son chantier DANS son
 * filet haut, en inversé. Mesuré le 2026-08-21 sur `w7M:p2` :
 *
 *   ─────────…───────── CRM ActionProgex finalisation ─
 *   ❯ Rien à signaler, silence.
 *   ──────────────────…──────────────────────────────────
 *
 * **Les deux lignes font 165 caractères et sont indistinguables à l'œil.** La basse ne porte que
 * du tracé — reconnue. La haute porte 30 caractères de titre — rejetée. Il ne restait donc qu'UN
 * filet, la boîte n'était plus reconnue, et le verdict devenait `illisible` : c'est-à-dire
 * injoignable, puisque tout ce dispositif refuse — à juste titre — d'écrire dans ce qu'il ne voit
 * pas. Le dirigeant a écrit « allo » deux fois sur ce canal ; aucun des deux n'est parti.
 *
 * ⚠️ ET LA GARDE NE S'INVERSE PAS — c'est la moitié qui compte. Accepter n'importe quelle ligne
 * bordée de tracé ferait découper la boîte au mauvais endroit, donc lire un morceau d'écran comme
 * s'il était son contenu, donc écrire par-dessus le texte de quelqu'un. On exige donc trois
 * choses ensemble, et un titre les satisfait toutes les trois :
 *
 *   • la ligne COMMENCE par du tracé — une bordure s'ouvre par son trait, jamais par son titre ;
 *   • elle FINIT par du tracé — le titre est une incise, elle est refermée ;
 *   • elle porte AU PLUS UNE INCISE de non-tracé, et cette incise est COURTE ;
 *   • le TRACÉ DOMINE — au moins la moitié de la ligne ;
 *   • et au moins 8 caractères de tracé en tout.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ LES QUATRE CONDITIONS SONT CUMULATIVES, ET J'AI PAYÉ POUR L'APPRENDRE.
 *
 * Une version intermédiaire de cette sonde avait RETIRÉ la proportion, en la remplaçant par la
 * seule règle de l'incise. Le commentaire affirmait alors qu'elle gardait « strictement plus ».
 * **C'était faux, et une revue de fond l'a reproduit de bout en bout** :
 *
 *     ──── Notes de version publiees hier soir pour verification ────
 *
 * Cette ligne porte UNE incise de 55 caractères — sous la borne — et passait donc pour un filet,
 * alors qu'elle n'est que 13 % de tracé. Deux lignes de ce genre dans le scrollback d'un SHELL
 * ORDINAIRE suffisaient à faire lire une « boîte vide et prête à écrire » là où il n'y a pas de
 * boîte du tout. Et `❯` est le prompt par défaut de thèmes de shell très répandus.
 *
 * > **On perd une livraison quand on refuse à tort. On écrase le message de quelqu'un quand on
 * > accepte à tort. Les deux ne se valent pas.** L'élargissement avait échangé le premier
 * > défaut, réparable, contre le second, qui ne l'est pas.
 *
 * ⚠️ CE QUE LA PROPORTION COÛTE, ET QUE J'ASSUME PLUTÔT QUE DE LE CACHER. Elle dépend de la
 * largeur de la fenêtre : pour un titre de 31 caractères, la bordure n'est reconnue qu'à partir
 * de ~62 colonnes. Sur ce poste, **5 panes sur 146 portent un filet plus étroit que 80
 * colonnes** — trois à 48, deux à 60. Une session rattachée dans un de ces panes rendrait
 * `illisible`.
 *
 * **`[non établi]` : je n'ai JAMAIS mesuré ce que Claude Code affiche comme bordure dans une
 * fenêtre de 48 colonnes** — il tronque peut-être le titre, ou ne l'affiche pas. J'avais
 * construit ce cas et bâti une garde dessus ; c'est cette garde qui a ouvert le trou ci-dessus.
 * On ne relâche donc pas la proportion sur un cas qu'on n'a pas vu : le sens de son échec est
 * `illisible`, donc l'abstention, et c'est le seul côté où l'on peut se tromper sans casse.
 */
const TRACE = /[─-╿]/;
const TRACE_MINIMUM = 8;
/** Le tracé doit dominer : sans ça, une ligne de prose encadrée passe pour une bordure. */
const PROPORTION_MINIMALE_DE_TRACE = 0.5;
/**
 * Un titre est bref par nature. Le cas mesuré en fait 31 ; on laisse de la marge, pas un boulevard.
 *
 * ⚠️ CE QUE CETTE SONDE NE COUVRE PAS, ET JE LE DIS PLUTÔT QUE DE LE LAISSER CROIRE. Deux formes
 * de bordure titrée lui échappent encore, éprouvées le 2026-08-21 :
 *
 *   • un titre de PLUS de 60 caractères ;
 *   • un titre qui contiendrait lui-même un caractère de TRACÉ (`─`), ce qui le couperait en
 *     deux incises.
 *
 * **Les deux sont improbables et aucune n'est attestée** — le seul titre mesuré sur ce poste en
 * fait 31, et `─` n'est pas une ponctuation qu'on écrit dans un nom de chantier. `[non établi]`
 * reste le mot juste pour la distribution réelle des longueurs de titre : un seul cas observé.
 *
 * ⚠️ ET LEUR SENS D'ÉCHEC EST LE SENS SÛR : elles font rendre `illisible`, donc REFUSER
 * d'écrire. On perd une livraison, on n'écrase le message de personne. C'est pour ça qu'on ne
 * relâche pas la borne « au cas où » : élargir sans mesure échangerait un refus contre une
 * fusion, et seule la seconde est irréparable.
 */
const INCISE_MAXIMALE = 60;

/**
 * EST-CE UN FILET ? — la sonde, exportée, parce que DEUX modules la posaient chacun de leur côté.
 *
 * ⚠️ ELLE VIVAIT EN DEUX EXEMPLAIRES — ici et dans `ecran.js`, ce dernier commentant lui-même
 * « même sonde que `boite.js` ». Une copie n'hérite jamais des corrections de l'autre, et on ne
 * s'en aperçoit qu'au prochain incident : corriger la bordure titrée ici seulement aurait laissé
 * l'angle mort entier chez le veilleur — c'est-à-dire sur le chemin par lequel arrive la parole
 * du dirigeant.
 */
/**
 * UN FILET **PUR** — rien que du tracé, la forme d'origine de cette sonde.
 *
 * ⚠️ IL SERT AU FILET **BAS**, ET C'EST UNE ASYMÉTRIE MESURÉE, pas une astuce (T-20260821-0025).
 * Sur l'écran réel d'une session rattachée, **seul le filet HAUT porte le titre ; le bas est
 * nu**. Un outil tiers qui encadre une bannière, lui, l'encadre des deux côtés de la même façon.
 *
 * 🔴 CETTE DISTINCTION FERME UN DÉFAUT RÉEL, trouvé en revue de fond. Une bannière CENTRÉE —
 * `─────── 3 tests failed, 12 passed, done in 4.2s ───────` — satisfait la dominance (54 % de
 * tracé) ET la règle de l'incise unique. Deux lignes de ce genre autour d'un prompt de shell
 * faisaient lire une « boîte vide, prête à écrire » là où il n'y a pas de boîte. Exiger que le
 * BAS soit nu ne coûte rien au cas qu'on répare, et referme celui-là.
 */
export function estUnFiletPur(ligne) {
  const l = [...String(ligne ?? '').trim()];
  // ⚠️ LA LONGUEUR N'EST PAS REDONDANTE ICI, contrairement à `estUnFilet` : `[].every(…)` est
  // VRAI par vacuité en JavaScript, donc une chaîne vide passerait pour un filet nu. Relevé
  // survivant en revue de fond — inerte au seul site d'appel actuel, mais cette fonction est
  // exportée, et rien ne garantit qu'un appelant futur la filtre d'abord.
  return l.length >= TRACE_MINIMUM && l.every((c) => TRACE.test(c));
}

/**
 * L'ANCRE D'UNE SESSION CLAUDE CODE — le pied de page qui suit sa boîte (T-20260821-0025).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI LA FORME DES FILETS NE SUFFIT PAS, ET C'EST MESURÉ DANS LES DEUX SENS.
 *
 * Reconnaître une boîte à la seule forme de ses bordures est un cul-de-sac. Trois passes de
 * revue l'ont montré, chacune avec un écran de shell plus plausible que le précédent — une prose
 * encadrée, une bannière centrée, puis **un en-tête titré suivi d'une règle de clôture nue**,
 * qui est très exactement ce qu'imprime un outil en ligne de commande ordinaire.
 *
 * ⚠️ ET LA MESURE INTERDIT LA SOLUTION QUI VENAIT À L'ESPRIT. En relevant les filets titrés des
 * écrans réels de ce poste, on en trouve de **presque parfaitement centrés** (`gauche=93,
 * droite=94`) : des bannières de transcript. Une garde fondée sur l'asymétrie d'une bordure
 * aurait donc été fausse — elle reposait sur un seul écran observé.
 *
 * ✅ CE QUI EST UNIVERSEL, LUI, A ÉTÉ COMPTÉ : sur **521 boîtes réelles** relevées sur ce poste,
 * la ligne qui suit le filet bas porte **toujours** un marqueur de mode Claude Code.
 * **521 sur 521**, quatre libellés distincts :
 *
 *     ⏵⏵ auto mode on   ·   ⏸ manual mode on   ·   ⏸ plan mode on   ·   ⏵⏵ bypass permissions on
 *
 * On s'accroche donc aux deux GLYPHES, pas aux libellés : ce sont eux le fait, le reste est de la
 * tournure. Aucun shell ne les imprime par accident sous une règle horizontale.
 *
 * ⚠️ SI CE PIED DE PAGE CHANGE UN JOUR, LA PANNE EST SILENCIEUSE — la sonde cessera de
 * reconnaître les sessions rattachées et rendra `illisible`. C'est le sens sûr (on s'abstient),
 * mais ça ne se signalera pas tout seul.
 */
const MODE_CLAUDE_CODE = /[⏵⏸]/;

export function estUnFilet(ligne) {
  const l = [...String(ligne ?? '').trim()];
  // Ouvrir ET refermer par du tracé : c'est ce qui distingue une bordure titrée d'une phrase.
  // (Une ligne plus courte que le plancher est écartée par le compte de tracé, plus bas : le
  // tracé ne peut pas dépasser la longueur. Une garde sur `l.length` y serait morte.)
  if (!l.length || !TRACE.test(l[0]) || !TRACE.test(l[l.length - 1])) return false;
  const trace = l.filter((c) => TRACE.test(c)).length;
  // ⚠️ LE PLANCHER GARDE SEUL LES LIGNES COURTES : sans lui, la dominance laisse descendre le
  // tracé effectif à 4 (« ── ab ── » est à 50 % pile). Relevé survivant en revue de fond.
  if (trace < TRACE_MINIMUM) return false;
  // ⚠️ LE TRACÉ DOIT DOMINER — retirer cette ligne fait passer un shell pour une boîte vide.
  // La frontière est INCLUSIVE : à la moitié pile, le tracé domine encore.
  if (trace / l.length < PROPORTION_MINIMALE_DE_TRACE) return false;

  // Les incises : chaque suite contiguë de non-tracé. Une bordure titrée en a UNE, brève.
  let incises = 0;
  let courante = 0;
  for (const c of l) {
    if (TRACE.test(c)) {
      courante = 0;
      continue;
    }
    if (courante === 0) incises += 1;
    courante += 1;
    if (incises > 1 || courante > INCISE_MAXIMALE) return false;
  }
  return true;
}


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

/**
 * LE DÉCOUPAGE DE LA BOÎTE, ÉCRIT UNE FOIS — parce que DEUX lectures en ont besoin, et qu'elles
 * n'entrent pas par la même porte (E-20260819-0015).
 *
 * `contenuBoite` travaille sur un écran DÉGRISÉ — ce qui est proposé n'y est plus. `suggestion`,
 * elle, a besoin de l'écran TEL QUEL, puisque c'est justement le gris qu'elle cherche. Recopier
 * le repérage des filets chez la seconde aurait rejoué « une porte sur deux », le motif que ce
 * dépôt a déjà payé dix fois : la copie n'hérite jamais des corrections de l'autre, et on ne s'en
 * aperçoit qu'au prochain incident. Il vit donc ici, et chacune lui donne l'écran qu'elle lit.
 *
 * Rend `null` quand la boîte n'a pas été reconnue — jamais une chaîne vide, qui se lirait
 * « boîte vue vide ».
 */
/**
 * ⚠️ DEUX TABLEAUX, ET C'EST LA MOITIÉ QUI COMPTE. `reperes` sert à RECONNAÎTRE — filets et
 * invite —, et il doit donc être débarrassé des séquences ANSI, sinon une ligne de filet ne
 * ressemble plus à un filet. `aExtraire` est ce qu'on RAPPORTE, et il garde ce que l'appelant
 * veut lire : le texte nu pour `contenuBoite`, le rendu entier pour `suggestionDansLaBoite`.
 * Les deux ont les mêmes indices — c'est l'appelant qui le garantit en dérivant l'un de l'autre.
 */
function corpsDeLaBoite(reperes, aExtraire = reperes) {
  const filets = [];
  for (let i = 0; i < reperes.length; i += 1) {
    if (estUnFilet(reperes[i])) filets.push(i);
  }
  if (filets.length < 2) return null;

  // ⚠️ LA BOÎTE EST LA PAIRE QUI PORTE L'INVITE, PAS LA DERNIÈRE PAIRE DE L'ÉCRAN
  // (T-20260820-0022). Prendre les deux derniers filets marchait tant que l'écran n'en portait
  // que deux. Dès qu'un PIED DE PAGE ENCADRÉ suit la boîte — cas courant — la « boîte »
  // devenait l'espace entre le bas de la vraie boîte et ce pied : un espace sans invite, donc
  // `null`, donc « illisible » sur une boîte parfaitement lisible.
  //
  // ⚠️ LE DÉFAUT A ÉTÉ RAPPORTÉ COMME « LE MULTI-LIGNES CASSE », ET C'ÉTAIT FAUX : trois lignes
  // se lisent parfaitement (essai de non-régression). La corrélation trompait — un texte long
  // fait défiler l'écran et fait apparaître un filet de plus. Deux faits corrélés, cause
  // différente.
  //
  // On remonte donc les paires de la plus basse à la plus haute et on retient la PREMIÈRE dont
  // la ligne suivante porte l'invite. La garde ne s'élargit pas : si aucune paire ne la porte,
  // on rend toujours `null` — « je n'ai pas su lire » n'est pas « c'est vide », et seul le
  // second autorise à écrire.
  let haut = -1;
  let bas = -1;
  for (let i = filets.length - 1; i >= 1; i -= 1) {
    const b = filets[i];
    const h = filets[i - 1];
    if (b - h <= 1) continue;
    // ⚠️ LE FILET BAS DOIT ÊTRE NU — voir `estUnFiletPur`. C'est l'asymétrie de l'écran réel, et
    // c'est ce qui empêche deux bannières centrées d'un outil tiers de se faire prendre pour une
    // boîte de saisie.
    if (!estUnFiletPur(reperes[b])) continue;
    // ⚠️ ET SI LE FILET HAUT PORTE UN TITRE, ON EXIGE L'ANCRE DE MODE — voir `MODE_CLAUDE_CODE`.
    //
    // C'est le périmètre EXACT de ce qui a été élargi le 2026-08-21, et rien de plus : un filet
    // haut NU garde le comportement d'avant, au caractère près. Accepter un filet titré est ce
    // qui a ouvert la porte aux bannières d'outils tiers ; on ne la referme donc que là.
    //
    // ⚠️ LE CAS « DEUX FILETS NUS AUTOUR D'UN PROMPT DE SHELL » SE LISAIT DÉJÀ « VIDE » AVANT ce
    // lot — mesuré en rejouant le code de `main`. C'est un défaut PRÉEXISTANT, distinct, et il
    // n'appartient pas à ce mandat : l'élargir ici reviendrait à changer un contrat que trois
    // appelants et des centaines d'essais tiennent pour acquis.
    if (!estUnFiletPur(reperes[h]) && !MODE_CLAUDE_CODE.test(reperes[b + 1] ?? '')) continue;
    if (aExtraire[h + 1].includes(INVITE)) {
      haut = h;
      bas = b;
      break;
    }
  }
  if (haut === -1) return null;

  // ⚠️ UN SEUL INDICE, ET C'EST DÉLIBÉRÉ. L'invite se cherche et se coupe sur la ligne qu'on
  // RAPPORTE, jamais dans les repères : les séquences ANSI décalent tout, et couper la ligne
  // rendue à l'indice lu dans la ligne nue tronquerait le texte ou laisserait un morceau
  // d'échappement. Le caractère `❯` survit au retrait des séquences — les deux tableaux le
  // portent au même endroit du texte, à un décalage près —, donc la détection n'y perd rien.
  //
  // La première écriture gardait les deux indices, l'un pour détecter et l'autre pour couper.
  // Une passe de mutation a montré que les confondre ne faisait rougir AUCUN essai : deux
  // indices dont un seul est juste sont un défaut qui attend son écran. Il n'y en a plus qu'un.
  const premiere = aExtraire[haut + 1];
  const k = premiere.indexOf(INVITE);
  if (k === -1) return null; // ce n'est pas la boîte de saisie : on ne l'a pas reconnue
  return [premiere.slice(k + INVITE.length), ...aExtraire.slice(haut + 2, bas)].join('\n');
}

export function contenuBoite(texteTerminal) {
  const corps = corpsDeLaBoite(sansGris(texteTerminal).split('\n'));
  return corps === null ? null : corps.trim();
}

/** La boîte est-elle vide ET lisible ? Une boîte illisible n'est pas une boîte vide. */
/**
 * LE MARQUEUR DE FILE D'ATTENTE — un message envoyé à un agent occupé n'entre pas dans sa
 * boîte : il est mis en file et part à la fin de son tour (mesuré le 2026-08-15).
 *
 * ⚠️ ON S'ACCROCHE À LA PARTIE STABLE DE LA PHRASE, pas à la phrase entière : « Press up to
 * edit » est de la tournure, « queued messages » est le fait. Si elle change quand même, la
 * panne est SILENCIEUSE — le témoin cesse de témoigner et on retombe sur les autres.
 *
 * ⚠️ ET IL NE PROUVE QUE S'IL EST APPARU. Un destinataire qui avait déjà des messages en
 * attente le porte avant qu'on écrive : c'est à l'appelant de comparer l'avant et l'après.
 */
const FILE_DATTENTE = /queued messages/i;

export function messagesEnFile(texteTerminal) {
  return FILE_DATTENTE.test(String(texteTerminal ?? ''));
}

/**
 * L'AGENT A-T-IL PRIS LE MESSAGE ? — le verdict, et ses trois témoins (T-20260815-0011).
 *
 * ⚠️ « ÉCRIT DANS LE PANE » N'EST PAS « PRIS », et c'est le dirigeant qui a corrigé la
 * frontière : « des fois le message est passé mais reste dans ton champ de prompt ». Mesuré le
 * 2026-08-15 : trois panes sur trois portaient un message jamais soumis — dont un de lui — et
 * les trois agents avaient l'air d'avoir FINI. Un message coincé n'est donc pas seulement
 * indiscernable d'un agent occupé : il l'est aussi d'un agent au repos.
 *
 * Trois témoins, un seul suffit, et chacun porte sur un état qui POUVAIT être différent :
 *
 *   • la BOÎTE S'EST VIDÉE — le texte en est sorti ;
 *   • un message est APPARU EN FILE — l'agent travaillait, il le prendra à la fin de son tour ;
 *   • la SESSION A QUITTÉ L'ATTENTE — elle s'est mise au travail.
 *
 * Si aucun n'est constatable : **pas de prise**. C'est cette absence qui donne sa valeur au
 * crochet, et sans elle il serait posé toujours et ne signifierait rien.
 *
 * ⚠️ UNE BOÎTE ILLISIBLE NE TÉMOIGNE DE RIEN — on ne la compte ni comme vidée, ni comme pleine.
 */
export function laPriseEstConstatee({ statutAvant, statut, ecranAvant, ecran }) {
  // ⚠️ SANS L'AVANT, LES DEUX TÉMOINS D'ÉCRAN NE TÉMOIGNENT DE RIEN — bloquant relevé en revue
  // de fond. `messagesEnFile(null)` rend `false` et `boiteEstVide(null)` rend `false` : une
  // lecture ratée se lisait donc comme « il n'y avait rien », et il suffisait que l'APRÈS
  // paraisse vide pour fabriquer une « boîte vidée » sans avoir rien constaté. L'invariant
  // était écrit quatre lignes plus bas et n'était gardé que du côté APRÈS.
  //
  // Le crochet serait alors posé sur un message dont personne ne sait s'il est arrivé —
  // c'est-à-dire la fausse assurance que ce dispositif existe pour empêcher.
  const avantLisible = ecranAvant != null;

  if (avantLisible && !messagesEnFile(ecranAvant) && messagesEnFile(ecran)) return 'file-d-attente';
  // ⚠️ IL FAUT UN CHANGEMENT, pas un état. La première écriture acceptait `done → done` comme
  // une sortie de l'attente — c'est-à-dire très exactement le cas MESURÉ le 2026-08-15, où les
  // trois agents portant un message coincé étaient `done` avant comme après. Elle aurait donc
  // posé le crochet sur les trois messages perdus. L'essai l'a attrapée.
  const auRepos = (e) => e === 'idle' || e === 'done';
  if (auRepos(statutAvant) && statut === 'working') return 'sortie-de-l-attente';
  // La boîte contenait quelque chose, elle n'a plus rien : le texte en est sorti. Écrite
  // d'abord avec une double négation qui inversait la condition — les essais l'ont attrapée.
  // ⚠️ LE STATUT, LUI, NE DÉPEND PAS DE L'ÉCRAN : il reste lisible quand l'écran ne l'est pas,
  // et c'est le seul témoin qui survit à cette panne-là. L'aveugler aussi serait déborder.
  if (avantLisible && !boiteEstVide(ecranAvant) && boiteEstVide(ecran)) return 'boite-videe';
  return null;
}

export function boiteEstVide(texteTerminal) {
  return contenuBoite(texteTerminal) === '';
}

/**
 * Ce qu'on a lu est-il l'ESPACE RÉSERVÉ que l'écran met à la place d'un texte, plutôt que le
 * texte lui-même ? (T-20260817-0091)
 *
 * ⚠️ CE N'EST PAS UNE AFFAIRE DE LONGUEUR — c'est une affaire de MODE D'ARRIVÉE, et s'être
 * trompé là-dessus a coûté une mesure fausse. Mesuré sur banc le 2026-08-17 :
 *
 *   • 900 caractères TAPÉS AU CLAVIER → lus ENTIERS (910/910), aucun espace réservé ;
 *   • les MÊMES 900 caractères COLLÉS → `[Pasted text #N]`, soit 16 caractères lus.
 *
 * Une première mesure avait conclu « seuil à ~600 caractères » : elle déposait tout par
 * collage, donc elle mesurait le collage en croyant mesurer la longueur.
 *
 * ⚠️ ET C'EST LE CAS COURANT ICI, pas un cas limite : écrire dans la boîte d'un agent se fait
 * par collage. Un texte qui bloque une boîte est donc très souvent un texte qu'un autre agent
 * y a collé — et que personne ne peut plus lire à l'écran.
 *
 * ⚠️ ON EXIGE QUE L'ESPACE RÉSERVÉ SOIT TOUT CE QU'ON A LU, pas qu'il y figure. Un texte réel
 * qui MENTIONNE `[Pasted text #6]` est un texte parfaitement lisible : le prendre pour un repli
 * ferait taire l'avis sur ce qu'on a su lire — la garde qui crie à tort, sur le chemin même qui
 * existe pour ne rien perdre.
 */
// ⚠️ LE SUFFIXE « +N lines » FAIT PARTIE DE LA FORME, et l'oublier ramenait le défaut ENTIER
// sur le cas le plus probable (relevé en revue de fond). Un collage d'UNE ligne rend
// `[Pasted text #6]` ; dès qu'il en fait plusieurs — c'est-à-dire dès qu'il s'agit d'un brief,
// d'un ordre, de tout ce qui bloque réellement une boîte — il rend `[Pasted text #137 +19 lines]`.
//
// ⚠️ CES FORMES NE SONT PAS DEVINÉES : elles sont attestées par les doubles d'écran DÉJÀ dans
// ce dépôt — `livraison.test.js` fixe `[Pasted text #56][Pasted text #57 +1 lines]`,
// `un-refus-nomme-sa-sortie.test.js` fixe `[Pasted text #137 +19 lines]`. La première écriture
// de cette garde ne les couvrait pas : elle avait été réglée sur un banc neuf sans regarder ce
// que les essais voisins savaient déjà. `lines?` parce que le singulier existe aussi.
const ESPACE_RESERVE = /\[Pasted text #\d+(?: \+\d+ lines?)?\]/g;

export function estUnEspaceReserve(texteLu) {
  const texte = String(texteLu ?? '').trim();
  if (!texte) return false;
  // Tout retirer, et voir s'il restait autre chose. Si oui, on a lu du texte — pas un repli.
  return texte.replace(ESPACE_RESERVE, '').trim() === '';
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LES TROIS ÉTATS D'UNE BOÎTE DE SAISIE, NOMMÉS (E-20260819-0015)
 *
 * 🔴 CE QUE COÛTE LE FAIT DE NE PAS LES NOMMER, MESURÉ. Le 2026-08-19, DEUX orchestrateurs ont
 * perdu ~3 heures CHACUN, le même jour, séparément, sur des boîtes qu'ils croyaient bloquées.
 * Elles étaient vides : ce qu'ils lisaient était une SUGGESTION grisée de Claude Code. Chacun a
 * remonté trois fois au dirigeant un geste qui n'avait aucun objet, et l'un d'eux a inscrit huit
 * occurrences d'un « défaut de canal » dont personne ne sait plus combien étaient réelles.
 *
 * ⚠️ CE N'ÉTAIT PAS DE L'INATTENTION. `contenuBoite` — lui — ne s'y trompait déjà pas : mesuré
 * le 2026-08-19 sur les 94 panes Claude Code du poste, dont 33 portaient une suggestion, il rend
 * « vide » sur les 33 et « pleine » sur le seul vrai texte collé. **Le défaut n'était pas dans
 * la lecture, il était dans ce que la lecture RENDAIT** : un contenu vide, muet sur la raison.
 * L'orchestrateur qui a l'écran devant les yeux voit un texte ; l'outil lui répond « vide » sans
 * lui dire pourquoi — alors il ne le croit pas, et il a raison de ne pas le croire.
 *
 * **Un verdict qu'on ne peut pas vérifier ne convainc personne : ce module rend donc l'état
 * NOMMÉ, avec le texte de la suggestion qu'il a écartée.**
 *
 * ⚠️ ET LA GARDE NE S'INVERSE PAS. Ignorer une suggestion est sûr — il n'y a rien à soumettre.
 * Ignorer un vrai texte ferait écrire par-dessus le message de quelqu'un. Dans le doute, on
 * traite comme un texte réel : un gris qu'on n'a pas su isoler rend « vide » sans nom, pas
 * « suggestion », et un contenu non vide reste toujours une boîte pleine.
 */
export const ETATS_BOITE = Object.freeze({
  /** On n'a pas reconnu la boîte — ce n'est PAS une boîte vide, et ça ne se traite pas pareil. */
  ILLISIBLE: 'illisible',
  /** Rien dedans, rien de proposé. */
  VIDE: 'vide',
  /**
   * Rien à soumettre non plus — mais l'écran dit autre chose : le destinataire est OCCUPÉ et
   * ses messages attendent la fin de son tour (`Press up to edit queued messages`).
   *
   * ⚠️ CE MARQUEUR EST GRIS LUI AUSSI, et le confondre avec une suggestion serait refaire le
   * défaut que ce module ferme : nommer un mauvais motif. Mesuré le 2026-08-19 sur `w0:p1F`,
   * une heure après l'écriture de `etatDeLaBoite` — c'est l'usage réel qui l'a trouvé.
   */
  FILE_DATTENTE: 'file-attente',
  /**
   * Rien à soumettre : ce qui s'affiche est en gris, et ce n'est aucun des marqueurs qu'on sait
   * nommer — donc, pour tout ce qu'on en sait, une proposition de l'éditeur.
   *
   * ⚠️ CE NOM DIT « DU GRIS QUE JE N'AI PAS SU NOMMER AUTREMENT », et c'est délibéré. La
   * CONDUITE, elle, est la même pour tout gris : il n'y a rien à soumettre. Le cas
   * `queued messages` l'a montré une heure après l'écriture de ce module — un second marqueur
   * gris existait, portant un autre fait. D'autres peuvent apparaître ; ils se nommeront ici.
   *
   * ⚠️ UNE REVUE A DEMANDÉ SI UN VRAI TEXTE POUVAIT ÊTRE PRIS POUR DU GRIS. Mesuré le
   * 2026-08-19 sur un pane jetable : un texte portant lui-même `ESC[2m … ESC[22m`, COLLÉ dans
   * la boîte, est rendu **sans aucun attribut** — Claude Code n'interprète pas les séquences
   * qu'on lui donne, il ne met du gris que pour ses propres marqueurs. Le banc
   * `les-trois-etats-dune-boite.test.js` fixe cette mesure.
   */
  SUGGESTION: 'suggestion',
  /** Un vrai texte, arrivé par COLLAGE — l'écran n'en montre qu'un repli, `[Pasted text #N]`. */
  COLLEE: 'collee',
  /** Un vrai texte, saisi en clair. */
  SAISIE: 'saisie',
});

/**
 * LE TEXTE GRISÉ DE LA BOÎTE — et rien d'autre de l'écran.
 *
 * ⚠️ C'EST LA BOÎTE QU'ON REGARDE, PAS L'ÉCRAN. Le pied de page de Claude Code est lui-même
 * grisé (« ⏵⏵ auto mode on » l'est sur le poste mesuré, et `ESC[2m` y apparaît 86 fois sur 119
 * écrans relevés). Une garde qui chercherait le gris n'importe où déclarerait une suggestion sur
 * presque toutes les sessions du poste — y compris celles dont la boîte porte un VRAI texte, et
 * elle ferait alors écrire par-dessus le message de quelqu'un. C'est l'inversion de garde à ne
 * pas commettre, et c'est pourquoi le découpage passe par `corpsDeLaBoite`.
 *
 * Rend `null` s'il n'y a pas de gris dans la boîte, ou si on n'a pas su la découper.
 */
export function suggestionDansLaBoite(texteTerminal) {
  // L'écran TEL QUEL : on retire les séquences seulement pour reconnaître les filets, jamais
  // du texte qu'on va lire — sinon on effacerait ce qu'on cherche.
  const brut = String(texteTerminal ?? '');
  const lignes = brut.split('\n');
  const reperes = lignes.map((l) => l.replace(SEQUENCE, ''));
  const corps = corpsDeLaBoite(reperes, lignes);
  if (corps === null) return null;
  const grises = corps.match(GRISE) ?? [];
  const texte = grises
    .map((g) => g.replace(SEQUENCE, ''))
    .join('')
    .trim();
  return texte === '' ? null : texte;
}

/**
 * L'ÉTAT DE LA BOÎTE, NOMMÉ — le verdict qu'un lecteur peut vérifier sans décoder du SGR.
 *
 * @returns {{etat: string, texte: string|null, suggestion: string|null}}
 *   `texte` est ce qu'il y a **à soumettre** — `''` quand il n'y a rien, `null` quand on n'a pas
 *   lu. `suggestion` porte ce qui a été écarté, pour que le lecteur reconnaisse son écran.
 */
export function etatDeLaBoite(texteTerminal) {
  const contenu = contenuBoite(texteTerminal);
  if (contenu === null) return { etat: ETATS_BOITE.ILLISIBLE, texte: null, suggestion: null };
  if (contenu !== '') {
    return {
      etat: estUnEspaceReserve(contenu) ? ETATS_BOITE.COLLEE : ETATS_BOITE.SAISIE,
      texte: contenu,
      // ⚠️ ON NE NOMME PAS DE SUGGESTION SUR UNE BOÎTE PLEINE. Le fait qui décide la conduite est
      // le texte réel ; annoncer en plus « il y avait du gris » inviterait à s'en autoriser
      // quelque chose, alors qu'il n'y a rien à en tirer : la boîte est pleine, on n'écrit pas.
      suggestion: null,
    };
  }
  // ⚠️ LE MARQUEUR DE FILE D'ATTENTE SE LIT AVANT LA SUGGESTION — il est gris lui aussi, et il
  // porte un fait DIFFÉRENT : le destinataire travaille, ses messages partiront à la fin de son
  // tour. C'est déjà un témoin de prise ailleurs dans ce dépôt (`laPriseEstConstatee`) ; deux
  // mécanismes qui lisent le même écran doivent en dire la même chose.
  // ⚠️ DANS LA BOÎTE, PAS SUR L'ÉCRAN — `messagesEnFile` regarde l'écran entier, ce qui est juste
  // pour son autre emploi (témoin de prise) et faux ici : les agents de ce dépôt affichent
  // constamment le texte `queued messages` dans leur transcript, puisque c'est le mot que le
  // code contient. Un écran qui en parle plus haut ferait nommer « file d'attente » une boîte
  // qui porte une suggestion — un mauvais motif, sur le chemin qui existe pour ne plus en donner.
  const corpsRendu = corpsDeLaBoite(
    String(texteTerminal ?? '').split('\n').map((l) => l.replace(SEQUENCE, ''))
  );
  if (messagesEnFile(corpsRendu)) {
    return { etat: ETATS_BOITE.FILE_DATTENTE, texte: '', suggestion: null };
  }
  const suggestion = suggestionDansLaBoite(texteTerminal);
  return suggestion === null
    ? { etat: ETATS_BOITE.VIDE, texte: '', suggestion: null }
    : { etat: ETATS_BOITE.SUGGESTION, texte: '', suggestion };
}

/** Une boîte où l'on peut écrire — vide, ou vide derrière une suggestion. C'est la même conduite. */
export function riensASoumettre(etat) {
  return (
    etat === ETATS_BOITE.VIDE ||
    etat === ETATS_BOITE.SUGGESTION ||
    etat === ETATS_BOITE.FILE_DATTENTE
  );
}

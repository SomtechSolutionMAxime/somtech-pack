// une-bordure-titree-reste-une-boite.test.js — UNE SESSION RATTACHÉE EST UN ÉTAT NORMAL,
// PAS UN ÉCRAN INCONNU (T-20260821-0025, E-20260821-0003).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QUE ÇA A COÛTÉ, ET CE N'EST PAS UNE GÊNE D'AFFICHAGE
//
// Le dirigeant a écrit « allo » deux fois sur le canal d'un orchestrateur. Aucun des deux
// n'est parti. Il l'a découvert en parlant dans le vide.
//
// La cause, mesurée le 2026-08-21 sur l'écran de `bonaventure` (`w7M:p2`) : sa session est
// RATTACHÉE, donc son filet haut porte le nom de son chantier —
// `─────… CRM ActionProgex finalisation ─────`. La sonde de filet exigeait une ligne faite
// RIEN QUE de caractères de tracé. Elle en trouvait donc UN au lieu de DEUX, ne reconnaissait
// plus la boîte, et rendait `illisible` — c'est-à-dire injoignable, `livrer.js` refusant à
// juste titre d'écrire dans ce qu'il ne voit pas.
//
// ⚠️ LES DEUX FILETS SONT INDISTINGUABLES À L'ŒIL — même longueur, même tracé. Le coordonnateur
// a lu cette bordure de ses propres yeux à 09 h 46 sans faire le lien, et a passé la journée à
// chercher ailleurs. Ce n'est pas de l'inattention : rien à l'écran ne dit que ces deux lignes
// ne sont pas la même chose.
//
// ⚠️ ON RÉPARE LA LECTURE, JAMAIS LE REFUS. Le refus de `livrer.js` — « on ne livre pas dans ce
// qu'on ne voit pas » — est sain, et il a fonctionné. Les essais ci-dessous éprouvent donc les
// DEUX sens : que la bordure titrée redevient lisible, ET que rien de ce que la sonde gardait
// ne se met à passer.

import test from 'node:test';
import assert from 'node:assert/strict';

import { contenuBoite, etatDeLaBoite, ETATS_BOITE, estUnFilet } from '../src/boite.js';
import {
  BORDURE_TITREE,
  BOITE_VIDE,
  BOITE_PLEINE,
  SUGGESTION_GRISEE,
  SHELL_DETACHE,
} from './aide/ecrans-mesures.js';

const FILET_NU = '─'.repeat(60);

test('LE CAS DE RÉFÉRENCE — la boîte de `w7M:p2` cesse d’être illisible', () => {
  // 🔴 L'ESSAI QUI PORTE TOUT LE LOT. Avant correction il rend `illisible` ; c'est la mesure
  // du 2026-08-21, et c'est ce qui rendait `bonaventure` injoignable.
  const vu = etatDeLaBoite(BORDURE_TITREE);
  assert.notEqual(
    vu.etat,
    ETATS_BOITE.ILLISIBLE,
    'une session rattachée est un état NORMAL — la déclarer illisible la rend injoignable'
  );
  // ⚠️ ET SON ÉTAT EXACT EST `suggestion`, PAS `vide` — sa boîte porte un texte GRISÉ, mesuré.
  // Les deux se conduisent pareil (rien à soumettre), et c'est ce qui compte ; mais nommer
  // `vide` un écran qui porte du gris serait remplacer un verdict faux par un autre.
  assert.equal(vu.etat, ETATS_BOITE.SUGGESTION);
  assert.equal(vu.texte, '', 'il n’y a rien à soumettre derrière la suggestion');
});

test('CONTRÔLE POSITIF ET NÉGATIF DE LA SONDE DE FILET — elle doit séparer, pas tout accepter', () => {
  // ⚠️ UNE SONDE QUI REND LA MÊME VALEUR SUR LES DEUX NE MESURE RIEN. C'est la contrainte
  // qui compte le plus sur ce lot : deux instruments aveugles ont été fabriqués en trois
  // heures sur ce sujet précis, et ce sont des valeurs grossièrement identiques qui les ont
  // trahis — pas la discipline de celui qui les écrivait.
  assert.equal(estUnFilet(FILET_NU), true, 'connu-POSITIF : un filet nu reste un filet');
  assert.equal(
    estUnFilet(`${'─'.repeat(70)} CRM ActionProgex finalisation ${'─'.repeat(70)}`),
    true,
    'connu-POSITIF : un filet TITRÉ est un filet — c’est tout l’objet de ce lot'
  );
  assert.equal(
    estUnFilet('Voici une phrase de prose ordinaire qui parle de ─ tirets.'),
    false,
    'connu-NÉGATIF : de la prose n’est pas un filet'
  );
  assert.equal(
    estUnFilet('─── court'),
    false,
    'connu-NÉGATIF : trois tirets suivis d’un mot ne sont pas un filet'
  );
  assert.equal(estUnFilet(''), false, 'connu-NÉGATIF : une ligne vide n’est pas un filet');
});

test('CE QUE LA SONDE GARDAIT CONTINUE D’ÊTRE GARDÉ', () => {
  // ⚠️ LE PIÈGE DE CE LOT : élargir une sonde pour guérir un cas, et laisser passer ce
  // qu'elle empêchait. Une boîte PLEINE déclarée vide ferait écrire par-dessus le message
  // de quelqu'un, et le soumettrait mêlé au nôtre.
  assert.equal(etatDeLaBoite(BOITE_PLEINE).etat, ETATS_BOITE.COLLEE);
  assert.equal(etatDeLaBoite(SUGGESTION_GRISEE).etat, ETATS_BOITE.SUGGESTION);
  assert.equal(etatDeLaBoite(BOITE_VIDE).etat, ETATS_BOITE.VIDE);
  // Un shell n'a pas de boîte de saisie : `illisible` y est le verdict HONNÊTE, et sur les
  // 297 lectures du poste mesurées le 2026-08-21 c'est le cas de 135 des 141 non-lues.
  assert.equal(etatDeLaBoite(SHELL_DETACHE).etat, ETATS_BOITE.ILLISIBLE);
});

test('COUPER LA SONDE — une lecture qui n’a pas eu lieu ne se lit pas « vide »', () => {
  // ⚠️ UN ESSAI QUI COUVRE L'ABSENCE PASSE PARFAITEMENT PENDANT QUE LA MESURE EST AVEUGLE.
  // On fait donc échouer la lecture elle-même, et on exige que le résultat DIFFÈRE de
  // « boîte vide » — le seul état qui autorise à écrire.
  for (const rien of [null, undefined, '']) {
    assert.equal(contenuBoite(rien), null, 'une absence de lecture n’est pas une boîte vide');
    assert.equal(etatDeLaBoite(rien).etat, ETATS_BOITE.ILLISIBLE);
  }
});

test('UN TITRE NE PEUT PAS SERVIR À FAIRE PASSER DU CONTENU POUR UN FILET', () => {
  // ⚠️ LA GARDE NE S'INVERSE PAS. Élargir la sonde pour accepter un titre ouvre la question :
  // une ligne de texte quelconque peut-elle désormais se faire prendre pour un filet, et
  // faire découper la boîte au mauvais endroit ? On exige que la ligne reste MAJORITAIREMENT
  // du tracé — un titre est une incise, pas le contenu de la ligne.
  assert.equal(
    estUnFilet(`──── ${'du texte qui prend toute la place '.repeat(4)}────`),
    false,
    'une ligne surtout faite de texte n’est pas un filet, même bordée de tracé'
  );
});

test('LA BORDURE TITRÉE EST RECONNUE À TOUTES LES LARGEURS MESURÉES — et je dis où ça s’arrête', () => {
  // ✅ CE QUI EST ATTESTÉ. Le seul écran de session rattachée mesuré sur ce poste fait 165
  // colonnes pour un titre de 31 caractères. La médiane des filets du poste est de 335 colonnes.
  const titre = ' CRM ActionProgex finalisation ';
  const bord = (largeur) => `${'─'.repeat(Math.max(1, largeur - titre.length - 1))}${titre}─`;
  for (const largeur of [80, 100, 165, 335]) {
    assert.equal(estUnFilet(bord(largeur)), true, `une bordure titrée de ${largeur} colonnes est reconnue`);
  }

  // ⚠️ ET CE QUI NE L'EST PAS — je l'inscris plutôt que de le laisser croire.
  //
  // Sous ~62 colonnes (pour ce titre-là), le tracé ne domine plus et la sonde rend `illisible`.
  // Sur ce poste, **5 panes sur 146 portent un filet plus étroit que 80 colonnes** — trois à 48,
  // deux à 60. Une session rattachée dans l'un d'eux resterait donc injoignable.
  //
  // 🔴 J'AVAIS ÉCRIT L'INVERSE, ET ÇA A COÛTÉ. Une version de cet essai EXIGEAIT que 48 et 60
  // colonnes soient reconnues — sur un écran que **je n'ai jamais mesuré** : je l'avais fabriqué
  // en supposant que Claude Code y afficherait le même titre. Pour satisfaire ce cas construit,
  // j'ai retiré l'exigence que le tracé domine — et j'ai ouvert un trou par lequel un SHELL
  // ORDINAIRE se lisait « boîte vide, prête à écrire ». Une revue de fond l'a reproduit.
  //
  // > **Une garde bâtie sur un cas qu'on n'a pas vu ne garde rien : elle déplace le risque vers
  // > un cas qu'on n'a pas regardé.**
  //
  // `[non établi]` : ce que Claude Code affiche réellement comme bordure à 48 colonnes — il
  // tronque peut-être le titre, ou ne l'affiche pas. Tant qu'on ne l'a pas mesuré, le sens sûr
  // est celui qui fait s'abstenir.
  for (const largeur of [48, 60]) {
    assert.equal(
      estUnFilet(bord(largeur)),
      false,
      `à ${largeur} colonnes le tracé ne domine plus : la sonde rend « illisible », donc on ` +
        `s’abstient — c’est une limite CONNUE, pas un accident`
    );
  }
});

test('DEUX INCISES NE SONT PAS UNE BORDURE — la garde qui remplace la proportion', () => {
  // ⚠️ CE QUI REMPLACE LE SEUIL DOIT GARDER AUTANT QUE LUI. Une bordure titrée porte UNE incise,
  // centrée, courte. Une ligne d'écran quelconque qui aurait du tracé aux deux bouts n'a aucune
  // raison de n'en porter qu'une seule et brève.
  assert.equal(
    estUnFilet(`────── un morceau ────── et un autre ──────`),
    false,
    'deux incises : c’est une ligne de contenu, pas une bordure'
  );
  assert.equal(
    estUnFilet(`──── ${'du texte qui prend toute la place '.repeat(3)}────`),
    false,
    'une incise trop longue n’est pas un titre — un titre est bref par nature'
  );
});

test('UN SÉPARATEUR SUIVI D’UN TEXTE N’EST PAS UNE BORDURE — la garde de FIN, armée', () => {
  // ⚠️ CETTE GARDE A ÉTÉ TROUVÉE SURVIVANTE, ET C'EST POURQUOI CET ESSAI EXISTE. En mutant la
  // sonde un point à la fois, retirer l'exigence « la ligne FINIT par du tracé » ne faisait
  // rougir AUCUN essai. Une mutation groupée l'aurait masquée : un rouge prouve qu'au moins une
  // chose était gardée, jamais que toutes l'étaient.
  //
  // ⚠️ ET LE CAS EST CONSTRUIT, PAS MESURÉ — je le dis plutôt que de le laisser croire. Sur les
  // 270 écrans réels du poste, **aucune ligne** n'est refusée par cette seule garde. Elle
  // couvre une forme PLAUSIBLE (un séparateur de sortie d'outil suivi d'un libellé), pas une
  // forme attestée. On la garde parce que son sens est le sens sûr : refuser fait rendre
  // « illisible », donc s'abstenir d'écrire — jamais l'inverse.
  assert.equal(
    estUnFilet('──────────────────── Résultat : 3 échecs'),
    false,
    'une ligne qui s’ouvre par un séparateur et se termine par du texte est du CONTENU — ' +
      'la prendre pour une bordure ferait découper la boîte au mauvais endroit'
  );
  // Et le contrôle positif de la même garde : refermée, c'est bien une bordure.
  assert.equal(estUnFilet('──────────────────── Résultat ────────'), true);
});

test('UN TEXTE SUIVI D’UN SÉPARATEUR N’EST PAS UNE BORDURE — la garde de DÉBUT, armée', () => {
  // La symétrique, armée pour la même raison : elle doit rougir si on la retire.
  assert.equal(
    estUnFilet('Résultat : 3 échecs ────────────────────'),
    false,
    'une ligne qui commence par du texte est du CONTENU, quelle que soit sa fin'
  );
});

test('QUELQUES TIRETS NE SONT PAS UNE BORDURE — la borne basse, armée', () => {
  // ⚠️ SECONDE SURVIVANTE TROUVÉE PAR MUTATION. Ramener `TRACE_MINIMUM` à zéro ne faisait rougir
  // aucun essai — et un simple « ─ » serait alors devenu un filet. Or de courtes suites de
  // tirets abondent dans une sortie de terminal ordinaire ; chacune serait devenue un bord de
  // boîte candidat, et la boîte aurait pu se découper n'importe où.
  //
  // ⚠️ LES ESSAIS VOISINS NE COUVRAIENT PAS CE CAS : « ─── court » est refusé pour sa FIN, pas
  // pour sa longueur, et une chaîne vide l'est pour son premier caractère. Aucun ne portait sur
  // la borne elle-même. Une garde qu'on peut ramener à zéro sans un rouge n'était pas gardée.
  for (const court of ['─', '──', '───────']) {
    assert.equal(estUnFilet(court), false, `« ${court} » est trop court pour être une bordure`);
  }
  // Le contrôle positif de la même borne, juste au-dessus du seuil.
  assert.equal(estUnFilet('────────'), true, 'huit caractères de tracé font une bordure');
});

test('LA BORNE DE L’INCISE EST GARDÉE À SA VALEUR — pas seulement « quelque part au-dessus »', () => {
  // ⚠️ TROISIÈME SURVIVANTE, ET C'EST LA PASSE DE REVUE QUI L'A SIGNALÉE. Elle a mesuré qu'on
  // pouvait faire glisser `INCISE_MAXIMALE` de 60 à 100 sans faire rougir un seul essai : le cas
  // négatif voisin porte une incise de 103 caractères, donc il reste refusé des deux côtés.
  //
  // > **Un essai qui refuse une incise de 103 caractères ne garde pas une borne à 60. Il garde
  // > « une borne quelque part sous 103 » — ce qui n'est pas une borne, c'est une direction.**
  //
  // On encadre donc la valeur des DEUX côtés, au caractère près. Une borne qu'on peut déplacer
  // sans rien casser finit par se déplacer.
  const bord = (incise) => `${'─'.repeat(40)}${incise}${'─'.repeat(40)}`;
  assert.equal(
    estUnFilet(bord(` ${'x'.repeat(58)} `)),
    true,
    'une incise de 60 caractères est encore un titre — la borne est inclusive'
  );
  assert.equal(
    estUnFilet(bord(` ${'x'.repeat(59)} `)),
    false,
    'une incise de 61 caractères n’en est plus un — si cet essai ne rougit pas quand la borne ' +
      'bouge, c’est que la borne n’était pas gardée'
  );
});

test('UN SHELL DONT LE SCROLLBACK PORTE DEUX LIGNES ENCADRÉES N’EST PAS UNE BOÎTE', () => {
  // 🔴 BLOQUANT TROUVÉ EN REVUE DE FOND, ET REPRODUIT DE BOUT EN BOUT. C'est le défaut le plus
  // grave que ce dépôt connaisse : une boîte lue « vide et prête à écrire » là où il n'y a pas
  // de boîte du tout.
  //
  // ⚠️ IL A ÉTÉ INTRODUIT PAR MA PROPRE CORRECTION. En remplaçant la proportion de tracé par
  // « une seule incise, bornée », j'ai écrit dans le commentaire que le nouveau critère gardait
  // « strictement PLUS » que l'ancien. **C'était faux.** Une ligne de prose encadrée de quatre
  // tirets de chaque côté porte UNE incise de 55 caractères — sous la borne — et passait, là où
  // la proportion (13 % de tracé) la refusait.
  //
  // ⚠️ ET LE GLYPHE `❯` EST LE PROMPT PAR DÉFAUT de thèmes de shell très répandus, tandis que les
  // bordures Unicode abondent dans les sorties d'outils — y compris celles de ce dépôt. Le
  // mécanisme n'est donc pas une curiosité de laboratoire.
  //
  // > **On perd une livraison quand on refuse à tort. On écrase le message de quelqu'un quand on
  // > accepte à tort. Les deux ne se valent pas, et c'est ce que j'avais oublié en élargissant.**
  const shell = [
    'maximeleboeuf@Mac somtech-pack % cat CHANGELOG.md | head -3',
    '──── Notes de version publiees hier soir pour verification ────',
    '❯ ',
    '──── Fin du rappel, rien de plus a signaler ici pour le moment ────',
    'maximeleboeuf@Mac somtech-pack % ',
  ].join('\n');
  assert.equal(
    estUnFilet('──── Notes de version publiees hier soir pour verification ────'),
    false,
    'une ligne de prose encadrée de quelques tirets est du CONTENU — le tracé doit DOMINER'
  );
  assert.equal(
    contenuBoite(shell),
    null,
    'ce terminal n’a aucune boîte de saisie — le lire « vide » autoriserait à y écrire'
  );
  assert.equal(etatDeLaBoite(shell).etat, ETATS_BOITE.ILLISIBLE);
});

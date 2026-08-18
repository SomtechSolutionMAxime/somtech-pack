// UN AVIS NE CITE PAS UN ESPACE RÉSERVÉ COMME SI C'ÉTAIT LE TEXTE (T-20260817-0091).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT QUI COMMANDE CE FICHIER — et le coordonnateur en est le SUJET, pas le rapporteur
//
// Le 2026-08-17 vers 19 h 30, `d-20260817-0006` a reçu ceci :
//
//     VOICI CE QUI A ÉTÉ SOUMIS EN TON NOM (tel que je l’ai lu à l’écran,
//     qui n’en montre que la partie visible) :
//     ┈┈┈
//     [Pasted text #6]
//     ┈┈┈
//
// **Il ne sait toujours pas ce qui est parti sous son nom.** `livrer.js` avait fait une chose
// irréversible et légitime — soumettre pour son auteur un texte qui bloquait la boîte — puis
// l'en avait avisé. Mais ce qu'il a cité n'est pas le texte : c'est l'ESPACE RÉSERVÉ que
// l'écran affiche à sa place.
//
// ⚠️ CE DÉFAUT N'EST PAS UNE RÉGRESSION. `avisDeBoiteBloquee` PRÉEXISTE à tous les correctifs
// de cette série. Il ne s'était jamais montré parce qu'il faut, pour le voir, qu'une boîte soit
// bloquée par un texte que l'écran replie.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE LA MESURE A ÉTABLI, ET QUI COMMANDE LA FORME DU CORRECTIF
//
// 1. LE REPLI N'EST PAS UNE AFFAIRE DE LONGUEUR — c'est une affaire de MODE D'ARRIVÉE.
//    Mesuré sur banc : 900 caractères TAPÉS AU CLAVIER sont lus ENTIERS (910/910, aucun repli).
//    Les mêmes 900 caractères COLLÉS deviennent `[Pasted text #N]`, soit 16 caractères lus.
//    ⚠️ Une première mesure avait conclu « seuil à ~600 caractères » : elle était fausse, parce
//    qu'elle déposait tout par collage. Le seuil est celui du collage, pas celui du texte.
//    C'est le cas COURANT sur ce canal : `livrer.js` écrit dans une boîte par collage, donc un
//    texte qui bloque une boîte est très souvent un texte qu'un autre agent y a collé.
//
// 2. LE TEXTE N'EST PAS PERDU, ET C'EST LE POINT QUI REND L'AVIS RÉPARABLE.
//    Mesuré bout en bout : un témoin de 924 caractères, collé donc replié à l'écran, a été
//    soumis par `delivrerLaBoite` ; interrogé sur le TOUR QU'IL AVAIT REÇU AVANT L'AVIS, le
//    destinataire a restitué le dernier mot du témoin. **Il l'avait reçu entier.**
//    L'outil ne sait pas lire ce texte ; le destinataire, lui, l'a. L'avis peut donc lui dire
//    OÙ REGARDER — c'est le chemin que le ticket disait inexistant, et il existe.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE QU'IL NE FAUT SURTOUT PAS FAIRE, ET C'EST GARDÉ ICI
//
// **Rendre l'avis plus RASSURANT.** La phrase « tel que je l’ai lu à l’écran, qui n’en montre
// que la partie visible » est la SEULE raison pour laquelle ce défaut est visible au lieu
// d'être silencieux. Un avis qui cite `[Pasted text #1]` sans dire qu'il ne sait pas lire est
// PIRE qu'un avis qui l'avoue. On ne rend donc pas l'avis rassurant : on le rend INFORMATIF.
//
// *Consigne de `d-20260817-0006`, qui atteste le fait au lieu de le rapporter.*

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  avisDeBoiteBloquee,
  avisDeBoiteVidee,
  estUnEspaceReserve,
} from '../src/livraison.js';

// ⚠️ LE TÉMOIN EST LONG — PLUS DE 120 CARACTÈRES, DÉLIBÉRÉMENT.
// La revue de fond de `383c9d9` a relevé que le témoin d'alors faisait 54 caractères : une
// troncature réintroduite à 80 ou à 120 serait passée VERTE. Un seuil qu'un témoin ne franchit
// pas est un seuil que la suite ne garde pas.
const TEXTE_LONG =
  'un compte rendu de chantier qui fait bien plus de cent vingt caracteres, parce qu un temoin ' +
  'trop court laisse passer exactement la troncature qu il pretend interdire, et parce que les ' +
  'textes qui bloquent une boite sont longs par nature';

const REPLI = '[Pasted text #6]';

// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QU'ON SAIT RECONNAÎTRE — et ce qu'on se garde de prendre pour un repli
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un espace réservé est reconnu — c’est ce que l’écran met À LA PLACE du texte', () => {
  assert.equal(estUnEspaceReserve('[Pasted text #6]'), true);
  assert.equal(estUnEspaceReserve('[Pasted text #1]'), true);
  assert.equal(estUnEspaceReserve('  [Pasted text #12]  '), true);
  // Mesuré : un collage assez gros se replie en PLUSIEURS espaces réservés d'affilée.
  assert.equal(estUnEspaceReserve('[Pasted text #13][Pasted text #14]'), true);
});

test('⚠️ le suffixe « +N lines » EST la forme du cas qui bloque vraiment une boîte', () => {
  // ⚠️ CES CHAÎNES SONT RECOPIÉES DES DOUBLES D'ÉCRAN DÉJÀ PRÉSENTS DANS CE DÉPÔT — elles ne
  // sont pas inventées ici : `livraison.test.js` et `un-refus-nomme-sa-sortie.test.js` les
  // fixent depuis plus longtemps que ce fichier.
  //
  // La première écriture de cette garde ne couvrait que `[Pasted text #6]`. Elle avait été
  // réglée sur un banc neuf — où les collages d'essai tenaient sur une ligne — SANS regarder ce
  // que les essais voisins savaient déjà. Résultat : elle protégeait le cas rare et laissait
  // filer le cas courant, c'est-à-dire tout collage de plusieurs lignes : un brief, un ordre,
  // exactement ce qui bloque une boîte dans la vraie vie. **Le défaut d'origine repassait
  // entier par là.** Relevé en revue de fond, sur le code committé et sans mutation.
  assert.equal(estUnEspaceReserve('[Pasted text #137 +19 lines]'), true);
  assert.equal(estUnEspaceReserve('[Pasted text #56][Pasted text #57 +1 lines]'), true);
  assert.equal(estUnEspaceReserve('[Pasted text #7 +1 line]'), true, 'le singulier existe aussi');

  // Et l'avis doit se comporter en conséquence : c'est le bout qui compte pour le signataire.
  const avis = avisDeBoiteBloquee({ texteLibere: '[Pasted text #137 +19 lines]', immobiliteMs: 300000 });
  assert.ok(
    !avis.includes('┈┈┈\n[Pasted text #137 +19 lines]\n┈┈┈'),
    'la forme multi-lignes ne doit pas non plus occuper le bloc de citation',
  );
  assert.ok(/JE NE SAIS PAS/i.test(avis));
});

test('un texte ordinaire n’est PAS pris pour un espace réservé — même s’il parle de collage', () => {
  assert.equal(estUnEspaceReserve(TEXTE_LONG), false);
  assert.equal(estUnEspaceReserve(''), false);
  // ⚠️ LE CAS QUI FERAIT LE PLUS DE DÉGÂTS : un texte RÉEL qui MENTIONNE un espace réservé.
  // Le prendre pour un repli ferait taire l'avis sur un texte parfaitement lisible — la garde
  // qui crie à tort, encore, et sur le chemin qui existe pour ne rien perdre.
  assert.equal(estUnEspaceReserve(`je te renvoie ${REPLI} parce que je ne le lis pas`), false);
  assert.equal(estUnEspaceReserve(null), false);
});

test('une boîte qui ne porte que du BLANC n’est pas un espace réservé — elle est vide', () => {
  // ⚠️ CET ESSAI EXISTE PARCE QU'UNE MUTATION EST RESTÉE VERTE SANS LUI (revue portail de ce
  // lot) : retirer le `trim()` d'entrée laissait `'   '` franchir la garde de vacuité, puis
  // « rien d'autre qu'un espace réservé » devenait vrai sur une chaîne qui n'en contient aucun.
  // L'avis serait alors parti sur le chemin de l'aveu en annonçant un repère vide — il aurait
  // dit « je ne sais pas lire » à propos de rien.
  assert.equal(estUnEspaceReserve('   '), false);
  assert.equal(estUnEspaceReserve('\n\t  '), false);
  assert.equal(estUnEspaceReserve(undefined), false);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'AVIS DE BOÎTE BLOQUÉE — un geste irréversible posé au nom de quelqu'un
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un texte lisible est cité ENTIER, et l’avis d’origine ne bouge pas', () => {
  const avis = avisDeBoiteBloquee({ texteLibere: TEXTE_LONG, immobiliteMs: 300000 });
  assert.ok(avis.includes(TEXTE_LONG), 'le texte lisible doit être cité en entier');
  assert.ok(avis.includes('VOICI CE QUI A ÉTÉ SOUMIS EN TON NOM'));
  // Rien du discours de l'espace réservé ne doit apparaître sur un texte qu'on a su lire.
  assert.ok(!avis.includes('ESPACE RÉSERVÉ'), 'pas de discours d’aveu sur un texte lu');
});

test('⚠️ un espace réservé n’est JAMAIS cité comme s’il était le texte', () => {
  const avis = avisDeBoiteBloquee({ texteLibere: REPLI, immobiliteMs: 300000 });
  // Le défaut d'origine, mot pour mot : le placeholder posé entre les filets de citation,
  // présenté comme « ce qui a été soumis en ton nom ».
  assert.ok(
    !avis.includes(`┈┈┈\n${REPLI}\n┈┈┈`),
    'l’espace réservé ne doit pas occuper le bloc de citation à la place du texte',
  );
});

test('⚠️ l’avis AVOUE qu’il n’a pas lu le texte — il ne se rend pas rassurant', () => {
  const avis = avisDeBoiteBloquee({ texteLibere: REPLI, immobiliteMs: 300000 });
  assert.ok(/ESPACE RÉSERVÉ/.test(avis), 'l’avis doit nommer ce qu’il a réellement lu');
  assert.ok(
    /JE NE SAIS PAS/i.test(avis),
    'l’avis doit dire qu’il ignore le contenu — un aveu, pas une atténuation',
  );
});

test('l’avis nomme l’espace réservé — `#6` est le seul repère qui existe', () => {
  const avis = avisDeBoiteBloquee({ texteLibere: REPLI, immobiliteMs: 300000 });
  assert.ok(avis.includes(REPLI), 'le repère lui-même doit être rendu, il ne coûte rien et il situe');
});

test('⚠️ l’avis dit OÙ le texte se trouve encore — c’est le seul chemin de réparation', () => {
  const avis = avisDeBoiteBloquee({ texteLibere: REPLI, immobiliteMs: 300000 });
  // Mesuré : le destinataire a REÇU le texte entier dans son tour précédent, alors que
  // l'écran n'en montrait que l'espace réservé. Le lui dire est un fait, pas un espoir.
  assert.ok(
    /tour|message/i.test(avis) && /précède|précédent|avant/i.test(avis),
    'l’avis doit renvoyer le destinataire au message qu’il a reçu juste avant',
  );
});

test('⚠️ LA PHRASE HONNÊTE EST PRÉSERVÉE — c’est elle qui a rendu ce défaut visible', () => {
  const lisible = avisDeBoiteBloquee({ texteLibere: TEXTE_LONG, immobiliteMs: 300000 });
  const replie = avisDeBoiteBloquee({ texteLibere: REPLI, immobiliteMs: 300000 });
  const AVEU = 'tel que je l’ai lu à l’écran, qui n’en montre que la partie visible';
  assert.ok(lisible.includes(AVEU), 'la phrase doit survivre sur le chemin ordinaire');
  assert.ok(replie.includes(AVEU), 'la phrase doit survivre sur le chemin de l’espace réservé');
});

test('le geste irréversible reste annoncé — on ne l’adoucit pas parce qu’on lit mal', () => {
  const avis = avisDeBoiteBloquee({ texteLibere: REPLI, immobiliteMs: 300000 });
  assert.ok(/SOUMIS/.test(avis), 'le fait d’avoir soumis pour son auteur reste dit');
  assert.ok(avis.includes('EN TON NOM'), 'la signature engagée reste nommée');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'AVIS DE BOÎTE VIDÉE — et l'ASYMÉTRIE qu'il ne faut pas gommer
// ═══════════════════════════════════════════════════════════════════════════════════════

test('⚠️ sur une boîte VIDÉE, on ne renvoie PAS au tour précédent — rien n’a été soumis', () => {
  const avis = avisDeBoiteVidee({ texteDisparu: REPLI });
  // La symétrie serait un MENSONGE : sur ce chemin, `delivrerLaBoite` n'a rien soumis. Le texte
  // n'est donc nulle part en aval, et promettre au destinataire qu'il le retrouvera dans son
  // tour précédent l'enverrait chercher ce qui n'existe pas.
  assert.ok(
    !/tu l’as (donc )?reçu|dans ton tour précédent|le message que tu as reçu juste avant/i.test(avis),
    'ne jamais renvoyer en aval un texte qui n’a pas été soumis',
  );
  assert.ok(/ESPACE RÉSERVÉ/.test(avis), 'l’aveu de lecture vaut ici aussi');
  assert.ok(
    /perdu|introuvable|aucun moyen/i.test(avis),
    'sur ce chemin, l’avis doit dire que le texte est hors d’atteinte',
  );
});

test('sur une boîte vidée, un texte LISIBLE remonte toujours entier', () => {
  const avis = avisDeBoiteVidee({ texteDisparu: TEXTE_LONG });
  assert.ok(avis.includes(TEXTE_LONG), 'non-régression de T-20260817-0090');
  assert.ok(!avis.includes('ESPACE RÉSERVÉ'));
});

// ═══ CE QUE L'AVIS DIT DE SA PROPRE OBSERVATION (T-20260818-0076) ═══
//
// ⚠️ CETTE PHRASE A ÉTÉ ÉCRITE QUAND LA SEULE FENÊTRE EXISTANTE VALAIT CINQ MINUTES, et elle
// arrondissait à la minute. Depuis que la fenêtre d'un texte tapé se compte en secondes et
// celle d'un collage vaut zéro, elle rendait « resté immobile pendant les 0 min où je l'ai
// observée » — à quelqu'un dont on vient de soumettre le texte en son nom. Le chemin de la
// parole du dirigeant la produisait DÉJÀ, sans qu'aucun essai la regarde.

test('l’avis ne prétend jamais avoir observé ZÉRO minute — il dit des secondes quand il en compte', () => {
  const avis = avisDeBoiteBloquee({ texteLibere: 'un compte rendu resté dans la boîte', immobiliteMs: 6000 });
  assert.ok(!/0 min/.test(avis), 'une durée arrondie à la minute ne sait pas dire six secondes');
  assert.ok(/6 s/.test(avis), `l’avis doit citer la durée réellement observée — reçu : ${avis.slice(0, 200)}`);
});

test('devant un COLLAGE, l’avis ne parle pas d’une observation qui n’a pas eu lieu', () => {
  // La fenêtre vaut zéro devant un collage : il n'y a rien à observer, personne n'a les doigts
  // dessus. Annoncer « les 0 min où je l'ai observée » ferait croire à une surveillance ratée
  // là où il n'y avait, par construction, rien à surveiller.
  const avis = avisDeBoiteBloquee({ texteLibere: '[Pasted text #33 +12 lines]', immobiliteMs: 0 });
  assert.ok(!/0 min|0 s/.test(avis), 'ne jamais annoncer une observation nulle comme si c’en était une');
  assert.ok(
    /collé|d’un seul coup/i.test(avis),
    `l’avis doit dire POURQUOI il n’a pas observé — reçu : ${avis.slice(0, 200)}`,
  );
  // Et il garde son aveu : ce qu'on a lu n'était pas le texte.
  assert.ok(/ESPACE RÉSERVÉ/.test(avis), 'non-régression de T-20260817-0091');
});

test('une fenêtre longue continue de se dire en minutes — non-régression', () => {
  const avis = avisDeBoiteBloquee({ texteLibere: 'un compte rendu', immobiliteMs: 300000 });
  assert.ok(/5 min/.test(avis), 'cinq minutes se disent en minutes, pas en 300 s');
});

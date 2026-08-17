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

test('un texte ordinaire n’est PAS pris pour un espace réservé — même s’il parle de collage', () => {
  assert.equal(estUnEspaceReserve(TEXTE_LONG), false);
  assert.equal(estUnEspaceReserve(''), false);
  // ⚠️ LE CAS QUI FERAIT LE PLUS DE DÉGÂTS : un texte RÉEL qui MENTIONNE un espace réservé.
  // Le prendre pour un repli ferait taire l'avis sur un texte parfaitement lisible — la garde
  // qui crie à tort, encore, et sur le chemin qui existe pour ne rien perdre.
  assert.equal(estUnEspaceReserve(`je te renvoie ${REPLI} parce que je ne le lis pas`), false);
  assert.equal(estUnEspaceReserve(null), false);
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

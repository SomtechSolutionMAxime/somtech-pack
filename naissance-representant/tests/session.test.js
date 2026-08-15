// À QUELLE SESSION HERDR LA NAISSANCE PARLE (T-20260814-0120)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE ÇA A COÛTÉ AU DIRIGEANT, ET POURQUOI CE N'EST PAS UN CONFORT
//
// Onze sessions herdr tournent sur ce poste. La naissance n'en connaissait aucune : elle
// héritait passivement de `HERDR_SOCKET_PATH`, c'est-à-dire, depuis un terminal ordinaire,
// de RIEN. Deux pannes, les deux vécues le même soir :
//
//   • lancée hors d'un pane → `ConnectionRefused`, un message qui ne nomme pas la cause ;
//   • lancée avec un identifiant d'espace lu dans une AUTRE session → l'espace existe, mais
//     ailleurs. Les identifiants (`w5`, `w8`, `w2W`) ne sont PAS globalement uniques, et
//     rien ne signalait qu'on désignait le mauvais.
//
// Le dirigeant a tapé la variable à la main QUATRE FOIS en une soirée. Ses mots : « encore
// une fois tu ne gères pas les sessions herdr par-dessus les espaces ».
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE PRINCIPE QUE CES CONTRÔLES ANCRENT
//
// **On ne devine jamais, et on ne prend jamais la première.** Quand plusieurs sessions
// existent et que rien ne désigne laquelle, la commande REFUSE en les nommant toutes.
// C'est le renversement déjà livré sur le trousseau et sur le routage : l'incertitude
// tombe du côté prudent, parce qu'une naissance dans la mauvaise session est indétectable
// à l'œil — elle réussit.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sessionVisee, nomDeSession, espaceDeLaSession } from '../src/session.js';

/** Le socket d'une session, tel que herdr le dépose réellement. */
const socketDe = (nom) => `/tmp/faux-poste/.config/herdr/sessions/${nom}/herdr.sock`;

/** Joue `sessionVisee` avec des sessions et un environnement maîtrisés. */
function avec({ sessions = [], socketDuPane = null, nomVoulu = null }) {
  const essaisAvant = process.env.HERDR_SESSIONS_ESSAIS;
  const socketAvant = process.env.HERDR_SOCKET_PATH;
  process.env.HERDR_SESSIONS_ESSAIS = sessions.map(socketDe).join(':');
  if (socketDuPane) process.env.HERDR_SOCKET_PATH = socketDuPane;
  else delete process.env.HERDR_SOCKET_PATH;
  try {
    return sessionVisee({ nomVoulu });
  } finally {
    if (essaisAvant === undefined) delete process.env.HERDR_SESSIONS_ESSAIS;
    else process.env.HERDR_SESSIONS_ESSAIS = essaisAvant;
    if (socketAvant === undefined) delete process.env.HERDR_SOCKET_PATH;
    else process.env.HERDR_SOCKET_PATH = socketAvant;
  }
}

test('nomDeSession lit le nom là où herdr le pose — dans le chemin du socket', () => {
  assert.equal(nomDeSession(socketDe('sibelanger')), 'sibelanger');
  assert.equal(nomDeSession(socketDe('sd-demands')), 'sd-demands');
  assert.equal(nomDeSession('/un/chemin/sans/forme'), null);
});

// LE CŒUR DU TICKET : plusieurs sessions, rien qui désigne laquelle.
test('plusieurs sessions et rien pour choisir → REFUS, et le refus les nomme TOUTES', () => {
  const r = avec({ sessions: ['somtech', 'sibelanger', 'cg'] });
  assert.equal(r.ok, false);
  for (const nom of ['somtech', 'sibelanger', 'cg']) {
    assert.match(r.message, new RegExp(nom), `le refus doit nommer « ${nom} » — sinon il faut aller chercher ailleurs`);
  }
  assert.match(r.message, /--session/, 'et dire par quelle option on tranche');
});

test('une seule session → elle est prise sans rien préciser (non-régression)', () => {
  const r = avec({ sessions: ['somtech'] });
  assert.equal(r.ok, true);
  assert.equal(r.nom, 'somtech');
  assert.equal(r.socket, socketDe('somtech'));
});

test('--session désigne, et c’est CE socket qui est rendu', () => {
  const r = avec({ sessions: ['somtech', 'sibelanger'], nomVoulu: 'sibelanger' });
  assert.equal(r.ok, true);
  assert.equal(r.nom, 'sibelanger');
  assert.equal(r.socket, socketDe('sibelanger'));
});

test('--session sur une session qui n’existe pas → REFUS qui liste celles qui existent', () => {
  const r = avec({ sessions: ['somtech', 'sibelanger'], nomVoulu: 'belanger' });
  assert.equal(r.ok, false);
  assert.match(r.message, /belanger/, 'le refus doit citer ce qu’on lui a demandé');
  assert.match(r.message, /somtech/, 'et nommer celles qui existent — une faute de frappe se voit alors seule');
});

// Depuis un pane, l'environnement dit déjà tout : c'est le cas qui marchait, il doit continuer.
test('lancé depuis un pane → l’environnement suffit, même avec onze sessions ouvertes', () => {
  const r = avec({ sessions: ['somtech', 'sibelanger', 'cg'], socketDuPane: socketDe('cg') });
  assert.equal(r.ok, true);
  assert.equal(r.socket, socketDe('cg'));
});

// ⚠️ ET IL PRIME SUR L'ENVIRONNEMENT : un agent qui fait naître ailleurs que chez lui est le
// cas NORMAL, pas l'exception. Si le pane courant l'emportait, `--session` serait décoratif
// partout où il sert vraiment — c'est-à-dire depuis un pane.
test('--session l’emporte sur le pane courant — sinon l’option ne sert nulle part où elle compte', () => {
  const r = avec({ sessions: ['somtech', 'sibelanger'], socketDuPane: socketDe('somtech'), nomVoulu: 'sibelanger' });
  assert.equal(r.ok, true);
  assert.equal(r.nom, 'sibelanger');
});

test('aucune session ouverte → REFUS qui le dit, plutôt qu’un refus de connexion illisible', () => {
  const r = avec({ sessions: [] });
  assert.equal(r.ok, false);
  assert.match(r.message, /aucune session/i);
});

// ════════════════ L'ESPACE APPARTIENT-IL À CETTE SESSION — ET QUE FAIT-ON QUAND ON L'IGNORE
//
// ⚠️ CES CONTRÔLES EXISTENT PARCE QUE LA REVUE DE FOND A CHERCHÉ CE QUE LES AUTRES LAISSENT
// PASSER, ET L'A TROUVÉ : `espaceDeLaSession` n'avait AUCUN contrôle unitaire. Muter sa
// garde sur réponse malformée — retomber sur une liste vide au lieu de refuser — laissait
// 27 tests verts. Le code était juste ; rien ne l'ancrait.
//
// Le cas malformé est celui qui compte le plus : ne pas savoir si l'espace appartient à la
// session n'est PAS la même chose que savoir qu'il n'y appartient pas. Confondre les deux
// ferait accuser l'utilisateur d'une erreur qu'il n'a pas commise — et, pire, ferait naître
// sur une ignorance.

const reponse = (...ids) => ({ result: { workspaces: ids.map((w) => ({ workspace_id: w, label: `espace ${w}` })) } });

test('espaceDeLaSession accepte un espace que la session porte, et rend son libellé', () => {
  const r = espaceDeLaSession(reponse('w4', 'w9'), { espace: 'w9', session: 'somtech' });
  assert.equal(r.ok, true);
  assert.equal(r.libelle, 'espace w9', 'le libellé sert à RECONNAÎTRE le sien — deux sessions peuvent porter le même identifiant');
});

test('espaceDeLaSession REFUSE un espace qui vit ailleurs, et dit pourquoi ce n’est pas une faute de frappe', () => {
  const r = espaceDeLaSession(reponse('w4', 'w7'), { espace: 'w2W', session: 'sibelanger' });
  assert.equal(r.ok, false);
  assert.match(r.message, /w2W/, 'le refus cite l’espace demandé');
  assert.match(r.message, /sibelanger/, 'et la session où on l’a cherché');
  assert.match(r.message, /w4/, 'et montre ceux qu’elle porte vraiment');
  assert.match(r.message, /pas uniques|autre session/i, 'et donne la CAUSE — sinon on corrige l’orthographe d’un identifiant juste');
});

test('espaceDeLaSession REFUSE aussi quand la session n’a rien rendu d’exploitable — ignorer n’est pas savoir', () => {
  for (const malformee of [null, undefined, {}, { result: {} }, { result: { workspaces: 'pas une liste' } }]) {
    const r = espaceDeLaSession(malformee, { espace: 'w9', session: 'somtech' });
    assert.equal(r.ok, false, `une réponse illisible ne doit jamais valoir un feu vert : ${JSON.stringify(malformee)}`);
    assert.match(
      r.message,
      /n'a pas rendu|pas établir/i,
      'et le refus doit mettre en cause la RÉPONSE, pas l’utilisateur — il n’a rien fait de mal'
    );
  }
});

test('espaceDeLaSession refuse une session qui ne porte AUCUN espace — le cas limite de la liste vide', () => {
  const r = espaceDeLaSession(reponse(), { espace: 'w9', session: 'somtech' });
  assert.equal(r.ok, false);
  assert.match(r.message, /w9/);
});

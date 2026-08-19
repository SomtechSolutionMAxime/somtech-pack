// UN REFUS FINAL NE TAIT PAS LA TOUCHE D’ENVOI DÉJÀ PARTIE (T-20260819-0009).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI MANQUAIT, ET CE QUE ÇA COÛTAIT
//
// `livrerBrief` pose lui-même l'invariant, trente lignes avant le défaut :
//
//   ⚠️ UN REFUS QUI TAIT UN GESTE DÉJÀ POSÉ EST UN REFUS QUI MENT PAR OMISSION […] c'est une
//   action irréversible qu'on lui cacherait ; il la découvrirait par ses effets, sans pouvoir
//   la relier à ce refus.
//
// Il l'appliquait D'UN SEUL CÔTÉ. Le refus du cas symétrique — délivrance réussie, boîte
// rebloquée — nomme le texte déjà soumis. Le refus final, lui, se taisait : quand la touche
// d'envoi de l'étape 4 était partie sans suffire, le lecteur voyait « boîte encore pleine » et
// ignorait qu'une touche avait DÉJÀ été pressée sur ce pane.
//
// ⚠️ ET LE CONTRASTE ÉTAIT DANS LE MÊME `return`. La branche qui dit « je n'ai PAS agi » (un
// dialogue attendait un choix) porte cinq lignes de prose. Les branches qui disent « j'AI agi »
// n'en portaient aucune. « Une porte sur deux », appliqué à un invariant plutôt qu'à un champ.
//
// ⚠️ CE N'EST PAS UN DÉFAUT DU CHAMP. `causeRepare` sort déjà `soumise` / `envoi-refuse`
// (T-20260818-0031) et reste honnête. Le champ sert la MACHINE ; le `message` sert le LECTEUR,
// et c'est lui qu'un agent ou un humain lit quand il cherche pourquoi son brief n'est pas passé.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE FICHIER EXIGE, ET QU'UN TEXTE QUELCONQUE NE DONNE PAS
//
// Une garde qui vérifie qu'un texte est PRÉSENT se laisse désarmer : on y colle la phrase du
// dialogue et elle reste verte, alors que cette phrase dit L'INVERSE de ce qu'on veut prouver.
// Les essais du bas ferment cette porte de trois côtés :
//   1. le refus AFFIRME le geste (le mot de la touche d'envoi, et « déjà ») ;
//   2. il ne porte AUCUNE formule de non-tentative — celle du dialogue en est une ;
//   3. les trois proses (dialogue / soumise / envoi refusé) sont deux à deux DISTINCTES.
// Et la dernière ferme la porte inverse : sur les chemins où aucune touche n'est partie, le
// refus ne doit annoncer AUCUN geste — annoncer ce qui n'a pas eu lieu est le défaut jumeau.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livrerBrief } from '../src/livraison.js';

const SEP = '─'.repeat(40);
const boiteVide = (...avant) => [...avant, SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');
const boiteAvec = (texte, ...avant) => [...avant, SEP, `❯ ${texte}`, SEP, '  ⏵⏵ auto mode on'].join('\n');

/** Le dialogue de permission RÉEL, tel que `herdr agent read` l'a rendu le 2026-08-17. */
const DIALOGUE = [' Blocked by classifier', ' Do you want to proceed?', ' ❯ 1. Yes', '   2. No'];

const socle = { pane: 'w9:p1', dormir: async () => {}, essais: 2, delaiMs: 0, pairOccupe: true };

/**
 * Le scénario du ticket : on écrit, le texte reste dans la boîte, la touche d'envoi part —
 * et la boîte ne se vide JAMAIS. `envoiRefuse` bascule sur le second cas où un geste a eu lieu.
 */
async function refusApresUneTentativeDeSoumission({ envoiRefuse = false } = {}) {
  const appels = [];
  let ecrit = false;
  const r = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    appelHerdr: async (c) => {
      appels.push(c);
      if (c[1] === 'prompt') ecrit = true;
      if (envoiRefuse && c[1] === 'send-keys') return { ok: false, reponse: {}, message: 'send_keys_refused' };
      return { ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' };
    },
    lireEcran: async () => (ecrit ? boiteAvec('mon compte rendu') : boiteVide()),
    immobiliteMs: 0,
  });
  return { r, envois: appels.filter((c) => c[1] === 'send-keys') };
}

/** Le refus rendu quand un DIALOGUE a empêché la soumission — aucun geste posé. */
async function refusDevantUnDialogue() {
  let lectures = 0;
  return livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    appelHerdr: async () => ({ ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' }),
    lireEcran: async () => {
      lectures += 1;
      return lectures === 1 ? boiteVide() : boiteAvec('mon compte rendu', ...DIALOGUE);
    },
    immobiliteMs: 0,
  });
}

/** Ce qui trahit une NON-tentative — la phrase du dialogue en porte deux. */
const FORMULES_DE_NON_TENTATIVE = [/n[’']ai\s+pas\s+tent/iu, /RIEN\s+soumis/iu, /aurait\s+confirm/iu];

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE CAS DU TICKET

test('la touche d’envoi est partie et herdr l’a ACCEPTÉE, sans suffire : le refus la nomme', async () => {
  const { r, envois } = await refusApresUneTentativeDeSoumission();

  assert.equal(r.ok, false, 'le brief n’a pas été pris');
  assert.equal(r.repare, true, 'et pourtant une touche d’envoi est partie, acceptée par herdr');
  assert.equal(r.causeRepare, 'soumise');
  assert.equal(envois.length, 1, 'le geste a bien eu lieu — c’est lui que le refus doit avouer');

  assert.match(r.message, /touche d[’']envoi/iu, 'le refus doit NOMMER la touche d’envoi');
  assert.match(r.message, /d[ée]j[àa]/iu, 'et dire qu’elle est DÉJÀ partie, pas qu’elle pourrait l’être');
  for (const formule of FORMULES_DE_NON_TENTATIVE) {
    assert.ok(
      !formule.test(r.message),
      `un geste POSÉ ne s’annonce pas avec la formule d’une non-tentative (${formule}) : ${r.message}`
    );
  }
});

test('la touche d’envoi est partie et herdr l’a REFUSÉE : le refus dit aussi qu’elle a été tentée', async () => {
  // Le geste a EU LIEU dans les deux cas ; ce qui change est ce que herdr en a fait. Se taire
  // ici laisserait croire qu’aucune touche n’est partie vers ce pane.
  const { r, envois } = await refusApresUneTentativeDeSoumission({ envoiRefuse: true });

  assert.equal(r.ok, false);
  assert.equal(r.repare, false, 'herdr a refusé le geste…');
  assert.equal(r.causeRepare, 'envoi-refuse');
  assert.equal(envois.length, 1, '…mais il a bien été tenté');

  assert.match(r.message, /touche d[’']envoi/iu, 'le refus doit nommer la touche d’envoi tentée');
  assert.match(r.message, /refus/iu, 'et dire que herdr l’a refusée — c’est ce qui distingue les deux cas');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA GARDE CONTRE LA PHRASE EMPRUNTÉE
//
// Coller la prose de la branche `dialogue` dans les deux branches ci-dessus rendrait un texte
// bien formé qui dit l’INVERSE. Cet essai compare les trois refus ENTRE EUX : aucun texte
// unique ne peut les satisfaire tous.

test('trois refus, trois proses DISTINCTES — une phrase empruntée à une autre branche ne passe pas', async () => {
  const { r: soumise } = await refusApresUneTentativeDeSoumission();
  const { r: refuse } = await refusApresUneTentativeDeSoumission({ envoiRefuse: true });
  const dialogue = await refusDevantUnDialogue();

  const proses = [soumise.message, refuse.message, dialogue.message];
  assert.equal(new Set(proses).size, 3, `trois chemins doivent rendre trois refus différents :\n${proses.join('\n---\n')}`);

  // Et le sens, pas seulement la différence : celle du dialogue avoue une ABSTENTION.
  assert.ok(
    FORMULES_DE_NON_TENTATIVE.some((f) => f.test(dialogue.message)),
    'le refus du dialogue doit continuer de dire qu’on n’a RIEN tenté'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA PORTE INVERSE — n’annoncer aucun geste qui n’a pas eu lieu

test('aucune touche partie : le refus n’en annonce aucune', async () => {
  // Deux chemins où rien n’a été soumis : le dialogue, et le refus AVANT toute écriture.
  const dialogue = await refusDevantUnDialogue();
  const avantEcriture = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    appelHerdr: async () => ({ ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' }),
    lireEcran: async () => boiteAvec('le reste d’un autre'),
    immobiliteMs: 0,
  });

  assert.equal(avantEcriture.causeRepare, 'rien-ecrit');
  for (const r of [dialogue, avantEcriture]) {
    assert.ok(
      !/d[ée]j[àa]\s+(?:press|part|soumis)/iu.test(r.message),
      `aucun geste n’a été posé sur ce chemin : le refus ne doit pas en annoncer un — ${r.message}`
    );
  }
});

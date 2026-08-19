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
const boiteVideEcran = (...avant) => [...avant, SEP, '❯', SEP, '  ⏵⏵ auto mode on'].join('\n');
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
    lireEcran: async () => (ecrit ? boiteAvec('mon compte rendu') : boiteVideEcran()),
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
      return lectures === 1 ? boiteVideEcran() : boiteAvec('mon compte rendu', ...DIALOGUE);
    },
    immobiliteMs: 0,
  });
}

/** Ce qui trahit une NON-tentative — la phrase du dialogue en porte deux. */
// ⚠️ LE CONDITIONNEL EST À LUI SEUL UNE NON-TENTATIVE — mesuré sur un leurre qui passait :
// « la touche d'envoi aurait déjà été pressée si la boîte l'avait permis » porte le geste ET le
// passé, et dit pourtant que rien n'a eu lieu.
//
// ⚠️ MAIS IL NE SE JUGE QUE SUR LE GESTE (resserré en seconde passe de fond). Interdire « aurait »
// N'IMPORTE OÙ refusait une phrase honnête où le mot vivait dans une tout autre proposition :
// « la touche d'envoi est déjà partie — quelqu'un aurait pu m'avertir, mais le geste a eu lieu ».
// Une garde qui crie sur du texte correct se fait retirer par le premier qui la rencontre, et
// emporte avec elle ce qu'elle gardait vraiment.
const FORMULES_DE_NON_TENTATIVE = [
  /n[’']ai\s+pas\s+tent/iu,
  /RIEN\s+soumis/iu,
  /aurait\s+(?:d[ée]j[àa]\s+)?(?:[ée]t[ée]\s+)?(?:press|soumis|confirm|envoy|tent|abouti)/iu,
];

// ⚠️ CE QU'ON CHERCHE EST LA FONCTION, PAS MA RÉDACTION (relevé en passe de fond : une première
// version exigeait le substrat exact « touche d'envoi » et refusait 6 formulations honnêtes sur
// 8 — « j'ai appuyé sur Entrée », « la frappe de soumission est partie »… Une garde qui n'accepte
// qu'une seule tournure est une garde figée : elle rougirait à la prochaine réécriture du texte
// sans qu'aucun fait ait changé, et c'est ainsi qu'on apprend à la contourner plutôt qu'à la lire.)
//
// Deux exigences, et il les faut TOUTES LES DEUX :
//   • LE GESTE est nommé — la touche, Entrée, la soumission, la frappe ;
//   • IL EST AU PASSÉ — « déjà », « est partie », « j'ai pressé ». Un geste au futur ou au
//     conditionnel n'est pas un geste posé, et c'est très exactement ce que ce lot ferme.
const NOMME_LE_GESTE = /(touche\s+d[’']envoi|entr[ée]e|soumission|soumis|frappe|raccourci|press[ée])/iu;
// ⚠️ PAS DE `\b` APRÈS UNE LETTRE ACCENTUÉE — MESURÉ : `/ai\s+[a-zà-ÿ]+[ée]s?\b/` refusait
// « j'ai pressé » et « j'ai appuyé ». En JavaScript, `\b` se calcule sur `[A-Za-z0-9_]` : « é »
// n'y est pas, donc entre « é » et l'espace il n'y a AUCUNE frontière, et le motif ne peut pas
// se fermer. La garde refusait ainsi deux tournures parfaitement honnêtes — un faux rejet né
// d'un détail d'implémentation, jamais d'un fait.
const AU_PASSE = /(d[ée]j[àa]|a\s+[ée]t[ée]|est\s+partie?|ai\s+[a-zà-ÿ]+[ée]s?(?![a-zà-ÿ]))/iu;

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE CAS DU TICKET

test('la touche d’envoi est partie et herdr l’a ACCEPTÉE, sans suffire : le refus la nomme', async () => {
  const { r, envois } = await refusApresUneTentativeDeSoumission();

  assert.equal(r.ok, false, 'le brief n’a pas été pris');
  assert.equal(r.repare, true, 'et pourtant une touche d’envoi est partie, acceptée par herdr');
  assert.equal(r.causeRepare, 'soumise');
  assert.equal(envois.length, 1, 'le geste a bien eu lieu — c’est lui que le refus doit avouer');

  assert.match(r.message, NOMME_LE_GESTE, 'le refus doit NOMMER le geste d’envoi');
  assert.match(r.message, AU_PASSE, 'et le dire au PASSÉ — pas « elle pourrait partir », mais « elle est partie »');
  for (const formule of FORMULES_DE_NON_TENTATIVE) {
    assert.ok(
      !formule.test(r.message),
      `un geste POSÉ ne s’annonce pas avec la formule d’une non-tentative (${formule}) : ${r.message}`
    );
  }
  // ⚠️ ET IL NE DIT PAS QUE HERDR A REFUSÉ — TROUVÉ EN SECONDE PASSE DE FOND, une mutation y
  // survivait. Un texte annonçant « la touche a été REFUSÉE par herdr » sur ce chemin-ci reste
  // DISTINCT des deux autres proses, nomme le geste, le dit au passé, ne porte aucune formule de
  // non-tentative — il satisfaisait donc tout ce qu'on exigeait. Et il ment sur le seul point qui
  // compte : l'autre prose du module dit en propres termes qu'un refus de herdr « est la seule
  // raison de croire qu'aucune touche n'a atteint ce pane ». L'inverser ici rendrait au lecteur
  // exactement la conclusion que ce lot existe pour lui retirer.
  assert.ok(
    !/(refus|repouss[ée]|rejet)/iu.test(r.message),
    `herdr a ACCEPTÉ ce geste : le refus ne doit pas annoncer l’inverse — ${r.message}`
  );
});

test('la touche d’envoi est partie et herdr l’a REFUSÉE : le refus dit aussi qu’elle a été tentée', async () => {
  // Le geste a EU LIEU dans les deux cas ; ce qui change est ce que herdr en a fait. Se taire
  // ici laisserait croire qu’aucune touche n’est partie vers ce pane.
  const { r, envois } = await refusApresUneTentativeDeSoumission({ envoiRefuse: true });

  assert.equal(r.ok, false);
  assert.equal(r.repare, false, 'herdr a refusé le geste…');
  assert.equal(r.causeRepare, 'envoi-refuse');
  assert.equal(envois.length, 1, '…mais il a bien été tenté');

  assert.match(r.message, NOMME_LE_GESTE, 'le refus doit nommer le geste tenté');
  assert.match(r.message, AU_PASSE, 'au PASSÉ : la commande est bel et bien partie vers herdr');
  assert.match(
    r.message,
    /(refus|repouss[ée]|rejet)/iu,
    'et dire que herdr l’a repoussée — c’est ce qui distingue ce cas de celui qui a abouti'
  );
  // ⚠️ CETTE BOUCLE MANQUAIT, ET UNE MUTATION Y SURVIVAIT (trouvée en passe de fond, pas en
  // relecture). On pouvait remplacer cette prose par « LA TOUCHE N’A JAMAIS ÉTÉ TENTÉE… je n’ai
  // donc RIEN soumis » — un texte qui affirme L’INVERSE du fait — et rester vert, parce qu’il
  // portait quand même les mots « touche d’envoi » et « refus ». C’est le défaut que ce lot
  // ferme, réapparu dans la moitié du lot qui le ferme.
  for (const formule of FORMULES_DE_NON_TENTATIVE) {
    assert.ok(
      !formule.test(r.message),
      `un geste TENTÉ ne s’annonce pas avec la formule d’une non-tentative (${formule}) : ${r.message}`
    );
  }
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

test('aucune touche partie : AUCUN des quatre chemins muets n’en annonce une', async () => {
  // ⚠️ QUATRE CHEMINS, PAS DEUX (élargi en passe de fond). Le `return` du refus connaît CINQ
  // valeurs de `causeRepare` ; n'en garder que deux laissait `boite-vide` et `boite-illisible`
  // libres d'annoncer un geste que personne n'a posé — le défaut JUMEAU de celui qu'on ferme,
  // et le plus coûteux des deux : il enverrait quelqu'un chercher les effets d'une touche
  // imaginaire sur un pane intact.
  const dialogue = await refusDevantUnDialogue();

  const avantEcriture = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    appelHerdr: async () => ({ ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' }),
    lireEcran: async () => boiteAvec('le reste d’un autre'),
    immobiliteMs: 0,
  });

  // L'écriture est refusée par herdr : la boîte n'a jamais rien porté, il n'y a rien à soumettre.
  const boiteVide = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    appelHerdr: async (c) => {
      if (c[1] === 'prompt') return { ok: false, reponse: {}, message: 'agent_prompt_stalled' };
      return { ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' };
    },
    lireEcran: async () => boiteVideEcran(),
    immobiliteMs: 0,
  });

  // L'écran devient illisible APRÈS l'écriture : on ne soumet pas ce qu'on n'a pas vu.
  let lectures = 0;
  const boiteIllisible = await livrerBrief({
    ...socle,
    texte: 'mon compte rendu',
    appelHerdr: async () => ({ ok: true, reponse: { result: { agent: { agent_status: 'idle' } } }, message: '' }),
    lireEcran: async () => {
      lectures += 1;
      return lectures === 1 ? boiteVideEcran() : '';
    },
    immobiliteMs: 0,
  });

  const muets = [
    ['dialogue', dialogue],
    ['rien-ecrit', avantEcriture],
    ['boite-vide', boiteVide],
    ['boite-illisible', boiteIllisible],
  ];
  assert.deepEqual(
    muets.map(([attendue, r]) => [attendue, r.causeRepare]),
    muets.map(([attendue]) => [attendue, attendue]),
    'chacun de ces chemins doit être atteint par sa propre cause — sinon on garde un chemin pour un autre'
  );
  for (const [nom, r] of muets) {
    assert.ok(
      !(NOMME_LE_GESTE.test(r.message) && AU_PASSE.test(r.message)),
      `aucun geste n’a été posé sur le chemin « ${nom} » : le refus ne doit pas en annoncer un — ${r.message}`
    );
  }
});

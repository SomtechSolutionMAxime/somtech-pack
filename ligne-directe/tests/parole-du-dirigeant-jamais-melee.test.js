// LA PAROLE DU DIRIGEANT NE PART JAMAIS MÊLÉE À CELLE D'UN AUTRE (T-20260817-0006).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT, MESURÉ CONTRE LE VRAI SERVICE LE 2026-08-17
//
// Deux mesures, sur deux panes réels portant un vrai agent, avec la preuve prise dans la
// TRANSCRIPTION du destinataire — jamais dans un code de retour :
//
//   1. Une boîte laissée pleine (« AAAA-texte-immobile-de-son-auteur-AAAA »), puis un
//      `herdr agent prompt` portant « BBBB-arbitrage-du-dirigeant-BBBB ». L'agent a reçu, en un
//      seul tour de parole :
//
//          AAAA-texte-immobile-de-son-auteur-AAAABBBB-arbitrage-du-dirigeant-BBBB
//
//      Un seul message. Deux textes. Aucun séparateur. `agent prompt` a soumis lui-même.
//
//   2. Le vrai `remettre()`, contre une boîte portant « CCCC…CCCC ». L'agent a reçu
//      « CCCC…CCCCDDDD-arbitrage-du-dirigeant-DDDD » — la fusion est PARTIE, a été exécutée,
//      et l'agent s'est retrouvé devant un dialogue de confirmation. `remettre()` a pourtant
//      rendu `RemiseEchouee` : le dirigeant est informé que son message n'est pas passé,
//      pendant qu'un ordre que personne n'a écrit est en cours d'exécution.
//
// ⚠️ CE QUE CETTE MESURE DÉMENT DANS LE TICKET. Le ticket supposait que la fusion partait par
// la touche d'envoi de `remettre` (le geste de réparation), et que la fonction rendait un
// SUCCÈS. La réalité est à la fois plus simple et plus grave : `agent prompt` aboute et soumet
// de lui-même, donc la fusion part AVANT que le moindre garde-fou existant soit sollicité — et
// selon la course, `remettre` rend un succès (mesure 1) ou un échec (mesure 2). Dans les deux
// cas, l'ordre fusionné est parti.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CET ESSAI N'AURAIT RIEN PU PROUVER HIER
//
// `aide/faux-herdr.js` faisait `e.boite = texte` sur `agent prompt` : il REMPLAÇAIT le contenu
// de la boîte là où le vrai service l'ABOUTE. Le mode de panne n'existait donc nulle part dans
// ce module — aucune mutation, si méchante soit-elle, ne pouvait le faire rougir. Le double a
// été corrigé AVANT ce correctif, et cet essai a été vu ROUGE avant d'être vu vert.
//
// L'assertion porte sur CE QUE L'AGENT A REÇU, jamais sur ce que `remettre()` a rendu — c'est
// la règle de toute cette famille : le code de retour ne prouve rien.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { posteHerdr } from './aide/faux-herdr.js';

let remettre;
let RemiseEchouee;
let racine;
let pathOriginal;
let etatOriginal;
// ⚠️ LA FENÊTRE D'OBSERVATION D'UN TEXTE TAPÉ EST BORNÉE ICI (T-20260818-0049) : en
// production elle vaut dix secondes, et ce banc l'a payée trois fois — 10,4 s par essai,
// mesuré. On borne le DÉLAI, jamais la garde : c'est le mouvement du texte qui protège, pas
// la durée pendant laquelle on le regarde.
process.env.LIGNE_IMMOBILITE_MS = process.env.LIGNE_IMMOBILITE_MS || '60';

let compteur = 0;

/** Le texte de quelqu'un d'autre, déjà dans la boîte, que son auteur n'a pas soumis. */
const TEXTE_DUN_TIERS = 'je reprends la migration demain matin si';
/** Ce que le dirigeant, lui, a écrit — et rien d'autre ne doit partir avec. */
const PAROLE_DU_DIRIGEANT = "L'option B, et n'attends pas.";

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-parole-'));
  pathOriginal = process.env.PATH;
  etatOriginal = process.env.FAUX_HERDR_ETAT;
  ({ remettre, RemiseEchouee } = await import('../src/herdr.js'));
});
after(() => {
  process.env.PATH = pathOriginal;
  if (etatOriginal === undefined) delete process.env.FAUX_HERDR_ETAT;
  else process.env.FAUX_HERDR_ETAT = etatOriginal;
  rmSync(racine, { recursive: true, force: true });
});
beforeEach(() => {
  process.env.PATH = pathOriginal;
});

/**
 * Un poste neuf par essai — sinon l'état d'un pane survit d'un scénario à l'autre.
 *
 * ⚠️ `FAUX_HERDR_ETAT` n'est pas décoratif : sans lui le faux binaire meurt avant de jouer son
 * scénario, `recu()` rend `null`, et TOUTES les assertions de non-mélange passent — sur un banc
 * qui n'a rien exercé. Ça s'est produit ici, à la première exécution.
 */
function poste(options) {
  compteur += 1;
  const p = posteHerdr(racine, [{ pane_id: 'w9:p1' }], `parole${compteur}`);
  p.pane('w9:p1', options);
  process.env.PATH = p.path;
  process.env.FAUX_HERDR_ETAT = p.etat;
  return p;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CES TROIS ESSAIS ONT CHANGÉ DE CONTRAT LE 2026-08-18, SUR ARBITRAGE DU DIRIGEANT
// (T-20260818-0049). Ils ne sont pas « mis au vert » : ils sont RECLASSÉS PAR FONCTION, et
// ce qu'ils gardaient est redistribué. Le lecteur doit savoir QUI a changé la règle et POURQUOI.
//
// LA RÈGLE D'AVANT (T-20260817-0006) : une boîte occupée fait REFUSER, et le texte de son
// auteur n'est jamais soumis à sa place. Elle protégeait un défaut RÉEL et MESURÉ — écrire
// par-dessus ne livre pas deux messages, ça en livre UN, les deux textes collés.
//
// CE QU'ELLE A COÛTÉ, MESURÉ LE 2026-08-18 : le dirigeant s'est retrouvé incapable de parler à
// ses propres agents, et le refus lui disait d'ouvrir un terminal — depuis Slack, depuis son
// téléphone. Ses mots, recopiés :
//
//   « c un vrai problème tout le monde est bloqué règle moi ça au pc »
//   « je dois pouvoir débloquer en envoyant un message, ça va lancer les deux messages,
//     y a aucun risque, le message avait déjà été envoyé et aurait dû être reçu »
//   « On ne dois jamais être bloqué via le slack. Sinon on ai pris. »
//   « Ok on dois enlever le blocage commencer et mettre un contrle pour sassure ruqe les
//     message sont bien soumis. »
//
// LA RÈGLE D'APRÈS : on ne retire pas la MESURE, on retire le VETO. Une boîte occupée est
// DÉLIVRÉE — son texte soumis pour son auteur — puis on écrit. Deux messages, jamais fusionnés.
//
// ⚠️ ET CE QUI EST GARDÉ DE L'ANCIENNE RÈGLE, PARCE QUE ÇA N'A PAS ÉTÉ RENVERSÉ : on ne soumet
// pas la phrase de quelqu'un QUI EST EN TRAIN DE LA TAPER. Le raisonnement du dirigeant vaut
// pour un texte déjà envoyé par quelqu'un qui croit l'avoir remis ; il ne vaut pas pour une
// phrase inachevée, et le geste ne se défait pas. Le discriminant n'est pas le TYPE du texte,
// c'est qu'il BOUGE — immobile veut dire que son auteur est parti.

test('LES DEUX TEXTES PARTENT SÉPARÉMENT, JAMAIS COLLÉS EN UN SEUL MESSAGE', async () => {
  // ⚠️ CE QUE CET ESSAI GARDE EST INCHANGÉ, et c'est le cœur de la garde d'origine : deux
  // textes que personne n'a écrits ensemble ne doivent pas partir comme UN message. Un ordre
  // mêlé à autre chose et soumis est un ordre que personne n'a donné, et il est exécuté.
  //
  // ⚠️ CE QU'IL A CESSÉ D'EXIGER, ET POURQUOI. Sa seconde assertion interdisait que le
  // destinataire voie les deux textes — `!(recu.includes(TIERS) && recu.includes(PAROLE))`.
  // Sous le contrat neuf, il les voit LES DEUX, en deux tours distincts, et c'est le but même
  // du correctif. Cette assertion mesurait donc « les deux présents » en croyant mesurer
  // « les deux fusionnés » : deux choses différentes que l'ancien contrat rendait équivalentes.
  const p = poste({ statut: 'idle', boite: TEXTE_DUN_TIERS });

  await remettre('w9:p1', PAROLE_DU_DIRIGEANT).catch(() => null);

  const recu = p.recu('w9:p1') || '';
  assert.ok(
    !recu.includes(TEXTE_DUN_TIERS + PAROLE_DU_DIRIGEANT),
    `l'agent a reçu les deux textes COLLÉS en un seul message : « ${recu.slice(0, 120)} »`
  );
});

test('LE TEXTE IMMOBILE D’UN AUTRE EST SOUMIS POUR LUI — et le destinataire en est PRÉVENU', async () => {
  // ⚠️ CET ESSAI DIT L'INVERSE DE CE QU'IL DISAIT, ET C'EST UN ARBITRAGE, PAS UNE CORRECTION.
  // Son ancien titre : « ET LE TEXTE DE SON AUTEUR N'EST PAS SOUMIS À SA PLACE — on ne parle
  // pour personne ». Le dirigeant a renversé cette règle, en connaissance du risque :
  //
  //   « le message avait déjà été envoyé et aurait dû être reçu »
  //
  // Il a raison sur le fait : un texte laissé dans une boîte a DÉJÀ été envoyé par quelqu'un
  // qui croit l'avoir remis. Le soumettre n'invente rien — ça achève un geste commencé. Et
  // mesuré : quatre blocages réels en une nuit, QUATRE messages d'agent, zéro brouillon humain.
  //
  // ⚠️ CE QUI REND L'ARBITRAGE TENABLE EST L'AVIS. On ne soumet pas en silence : le
  // destinataire reçoit, avec le message, ce qui est parti en son nom. Sans lui, il verrait un
  // travail quitter sa boîte sans pouvoir dire lequel — un incident inexplicable au lieu d'un
  // incident constatable.
  const p = poste({ statut: 'idle', boite: TEXTE_DUN_TIERS, colle: true, cede: true });

  await remettre('w9:p1', PAROLE_DU_DIRIGEANT).catch(() => null);

  const recu = p.recu('w9:p1') || '';
  assert.ok(
    recu.includes(PAROLE_DU_DIRIGEANT),
    `la parole du dirigeant doit ARRIVER — c'est tout l'objet du lot : « ${recu.slice(0, 200)} »`
  );
  assert.match(
    recu,
    /BOÎTE DE SAISIE ÉTAIT BLOQUÉE/,
    'et le destinataire doit être prévenu de ce qui est parti en son nom'
  );
});

test('LE REFUS, QUAND IL RESTE, DIT CE QU’IL A VU ET NOMME LE PANE', async () => {
  // ⚠️ IL RESTE DES REFUS, ET ILS DOIVENT RESTER LISIBLES. Le veto a sauté sur la boîte
  // occupée ; il subsiste là où aucun geste sûr n'existe — ici, une boîte que la touche
  // d'envoi ne libère pas. Un refus qui ne nomme pas le pane laisse son lecteur sans prise.
  poste({ statut: 'idle', boite: TEXTE_DUN_TIERS, colle: true });

  await assert.rejects(
    () => remettre('w9:p1', PAROLE_DU_DIRIGEANT),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err.name}`);
      assert.match(err.message, /bo[iî]te/i, 'le refus nomme ce qui bloque');
      assert.ok(
        err.message.includes('w9:p1'),
        'et il nomme le pane réel — sans quoi personne ne sait où aller regarder'
      );
      return true;
    }
  );
});

test('DEVANT UN DIALOGUE, ON N’ÉCRIT MÊME PAS — écrire y CONFIRME l’action, c’est mesuré', async () => {
  // ⚠️ LE FAIT QUI A MANQUÉ À DEUX LOTS, ÉTABLI LE 2026-08-17 CONTRE LE VRAI SERVICE.
  //
  // `livraison.js` portait **[non établi]** : personne n'avait su reproduire un vrai dialogue de
  // permission Claude Code. Il l'a été ici, et la mesure est pire que la crainte :
  //
  //   1. un vrai dialogue de permission est affiché — « Do you want to proceed? ❯ 1. Yes »,
  //      proposant d'exécuter `touch /tmp/mesure-dialogue-t0006` ;
  //   2. `herdr agent prompt <pane> "ceci est un texte ordinaire, pas une confirmation"` ;
  //   3. **le fichier a été créé.** Le texte n'a pas été reçu comme un message : il a servi de
  //      CONFIRMATION, et l'action a été approuvée.
  //
  // Donc ce n'est pas seulement la touche d'envoi qui est dangereuse ici — c'est **l'écriture
  // elle-même**. Le garde ne peut pas se contenter de regarder la boîte : il doit regarder
  // l'écran AVANT d'écrire, exactement comme il le fait avant d'envoyer la touche.
  //
  // ⚠️ Sur le dialogue mesuré, `contenuBoite` rend `null` — le refus « écran illisible » aurait
  // mordu. Mais **par accident, pas par conception** : c'est le motif que ce dépôt nomme depuis
  // `T-20260816-0114`. Un écran de choix qui laisse une boîte lisible sous lui n'était gardé par
  // rien. C'est ce que cet essai éprouve : boîte vide et parfaitement lisible, dialogue au-dessus.
  // ⚠️ ET LA SONDE A DÛ ÊTRE RESSERRÉE, sur mesure elle aussi. Appliquer la sonde LARGE de la
  // boîte à un écran entier déclarait « en attente de choix » **3 panes réels sur 14** de ce
  // poste — 21 % —, tous `idle`, boîte prête, parfaitement joignables. La cause était la même
  // dans les trois cas : une simple liste numérotée dans la sortie ordinaire de leur agent.
  // Une garde qui refuse un agent sur cinq rend la ligne du dirigeant inutilisable : ce serait
  // une panne PIRE, en fréquence, que celle qu'on ferme. `ecranAttendUnChoix` exige donc le
  // curseur de sélection (« ❯ 1. ») ou une formule d'invite — les trois faux positifs
  // disparaissent, et le dialogue mesuré reste reconnu.
  const p = poste({
    statut: 'idle',
    boite: '',
    horsBoite: 'Do you want to proceed?\n❯ 1. Yes\n  2. No',
  });

  await assert.rejects(
    () => remettre('w9:p1', PAROLE_DU_DIRIGEANT),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err.name}`);
      return true;
    }
  );

  const gestes = p.gestes('w9:p1');
  assert.ok(
    !gestes.some((g) => g[1] === 'prompt'),
    'RIEN ne doit être écrit devant un écran de choix — l’écriture y confirme l’action'
  );
  assert.ok(
    !gestes.some((g) => g[1] === 'send-keys'),
    'et aucune touche d’envoi non plus'
  );
});

test('DEVANT UN DIALOGUE, LA TOUCHE D’ENVOI N’EST PAS ENVOYÉE — elle y confirmerait une action', async () => {
  // ⚠️ CE DANGER EST MESURÉ, PAS SUPPOSÉ. Le 2026-08-17, sur le pane où un message fusionné
  // venait de partir, l'écran portait `Do you want to proceed? ❯ 1. Yes`. La touche d'envoi n'y
  // soumet pas un texte : elle approuve l'option par défaut — donc la commande qu'un ordre que
  // personne n'a écrit venait de déclencher.
  //
  // ⚠️ LE DIALOGUE APPARAÎT **APRÈS** L'ÉCRITURE, et il le faut : l'écran est propre au départ,
  // sinon c'est la garde d'AVANT qui refuse et ce chemin-ci n'est jamais atteint — l'essai
  // deviendrait décoratif, satisfait par une garde qu'il ne teste pas. C'est exactement la
  // séquence mesurée le 2026-08-17 : le texte part, l'agent agit, un dialogue s'affiche, et
  // c'est le geste de RÉPARATION qui tomberait dessus.
  const p = poste({
    statut: 'idle',
    boite: '',
    colle: true,
    horsBoiteApres: 'Do you want to proceed?\n❯ 1. Yes\n  2. No',
  });

  await assert.rejects(
    () => remettre('w9:p1', PAROLE_DU_DIRIGEANT),
    (err) => {
      assert.ok(err instanceof RemiseEchouee, `attendu RemiseEchouee, reçu ${err.name}`);
      // Le refus doit dire qu'il s'ABSTIENT devant un choix — pas se rabattre sur « resté dans
      // la boîte », qui serait vrai mais tairait la raison qui compte.
      assert.match(err.message, /confirm|choix|dialogue/i, 'le refus nomme ce dont il s’abstient');
      return true;
    }
  );

  const gestes = p.gestes('w9:p1');
  assert.ok(
    gestes.some((g) => g[1] === 'prompt'),
    'le texte a bien été écrit — c’est ce chemin-ci qu’on éprouve, pas la garde d’avant'
  );
  assert.ok(
    !gestes.some((g) => g[1] === 'send-keys'),
    'aucune touche d’envoi ne doit partir devant un écran de choix'
  );
});

test('UNE BOÎTE VIDE NE CHANGE RIEN — on ne casse pas la voie par laquelle le dirigeant parle', async () => {
  const p = poste({ statut: 'idle', boite: '' });

  const preuve = await remettre('w9:p1', PAROLE_DU_DIRIGEANT);

  assert.equal(preuve.pris, true, 'la remise ordinaire est toujours prouvée');
  assert.equal(p.recu('w9:p1'), PAROLE_DU_DIRIGEANT, 'et l’agent reçoit exactement ce qui a été dit');
});

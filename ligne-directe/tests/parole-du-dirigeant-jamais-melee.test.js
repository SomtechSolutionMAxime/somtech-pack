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

test('UNE BOÎTE QUI PORTE LE TEXTE D’UN AUTRE NE REÇOIT PAS LA PAROLE DU DIRIGEANT PAR-DESSUS', async () => {
  // Le service soumet de lui-même : c'est la mesure n°1, celle où `remettre` rend un SUCCÈS.
  const p = poste({ statut: 'idle', boite: TEXTE_DUN_TIERS });

  await remettre('w9:p1', PAROLE_DU_DIRIGEANT).catch(() => null);

  const recu = p.recu('w9:p1') || '';
  assert.ok(
    !recu.includes(TEXTE_DUN_TIERS + PAROLE_DU_DIRIGEANT),
    `l’agent a reçu les deux textes collés en un seul message : « ${recu.slice(0, 120)} »`
  );
  assert.ok(
    !(recu.includes(TEXTE_DUN_TIERS) && recu.includes(PAROLE_DU_DIRIGEANT)),
    `la parole du dirigeant est partie mêlée à celle d’un autre : « ${recu.slice(0, 120)} »`
  );
});

test('ET LE TEXTE DE SON AUTEUR N’EST PAS SOUMIS À SA PLACE — on ne parle pour personne', async () => {
  // La mesure n°2, à l'identique : `agent prompt` ne soumet PAS (le mélange reste en boîte), et
  // c'est la touche d'envoi de réparation de `remettre` qui le confirme. Ce que l'auteur n'a
  // pas soumis ne doit partir d'aucune façon — surtout pas par le geste censé le sauver.
  const p = poste({ statut: 'idle', boite: TEXTE_DUN_TIERS, colle: true, cede: true });

  await remettre('w9:p1', PAROLE_DU_DIRIGEANT).catch(() => null);

  const recu = p.recu('w9:p1') || '';
  assert.ok(
    !recu.includes(TEXTE_DUN_TIERS),
    `le texte immobile de son auteur a été soumis sans lui : « ${recu.slice(0, 120)} »`
  );
});

test('LE REFUS DIT CE QU’IL A VU ET CE QU’IL FAUT FAIRE — un arbitrage perdu en silence est pire', async () => {
  poste({ statut: 'idle', boite: TEXTE_DUN_TIERS });

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

// UN LIEU PORTÉ PAR UNE SEULE BRANCHE PEUT DISPARAÎTRE SOUS SON AGENT (T-20260814-0014).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT, DEUX FOIS — et le ticket en compte cinq, dont trois d'une AUTRE surface
//
// Le lieu d'un orchestrateur — son `CLAUDE.md`, son `CONTEXTE.md`, ses briefs — vit sous
// `.orchestrateur/<nom>/` **dans l'arbre de travail du dépôt partagé**. Qu'une autre session
// bascule ce dépôt sur une branche qui ne porte pas ce répertoire, et le répertoire courant de
// l'agent **disparaît sous lui, en pleine session** :
//
//   Working directory ".orchestrateur/p-20260728-0002" was deleted;
//   shell cwd recovered to "/Users/maximeleboeuf"
//
// Deux orchestrateurs l'ont vécu. L'un travaillait encore sans le savoir — il avait chargé son
// métier à sa naissance, il le portait dans son contexte et non sur le disque. **Il n'aurait
// pas survécu à un redémarrage** : ni qui il est, ni quelle est sa portée.
//
// ⚠️ ET LE RATTRAPAGE ÉVIDENT EST LE MAUVAIS : rétablir la branche remettrait les fichiers ET
// écraserait le travail de la session qui y a commité depuis. C'est un cas où le réflexe de
// réparation est plus dommageable que la panne — raison de plus pour que ce module SIGNALE et
// ne répare rien.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LE CRITÈRE N'EST PAS « EST-CE SUR MAIN » — ET C'EST LE CŒUR
//
// La première formulation demandait si le lieu est porté par la branche par défaut. **Elle
// aurait manqué le pire des cas**, celui d'un orchestrateur vivant mesuré le 2026-08-16 :
//
//   son lieu n'est porté QUE par sa propre branche — et cette branche est CELLE QUI EST SORTIE.
//
// Tout va bien tant que personne ne change de branche, et **rien ne se voit**. Un lieu porté
// par une seule branche est exposé **même quand cette branche est la sienne** : il suffit d'un
// `git checkout` par n'importe qui.
//
// Le critère est donc **le nombre de branches qui portent le lieu**, jamais laquelle est sortie.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { expositionDuLieu, RISQUE } from '../src/lieu-expose.js';

const LIEU = '.orchestrateur/j-20260814-0002';

// ═════════════════ 1. CE QUI EST EXPOSÉ

test('UN LIEU PORTÉ PAR UNE SEULE BRANCHE EST EXPOSÉ — même si c’est celle qui est sortie', () => {
  // ⚠️ LE CAS MESURÉ SUR UN ORCHESTRATEUR VIVANT, et celui qu'un critère « est-ce sur main »
  // aurait déclaré sain. Sa branche est sortie, tout a l'air normal, et un seul `git checkout`
  // par n'importe qui lui retire ses fichiers.
  const v = expositionDuLieu({
    lieu: LIEU,
    branchesQuiPortent: ['origin/chore/orchestrateur-j-20260814-0002'],
    brancheCourante: 'chore/orchestrateur-j-20260814-0002',
  });

  assert.equal(v?.risque, RISQUE.UNE_SEULE_BRANCHE);
  assert.match(v.quoi, /une seule branche/i);
});

test('UN LIEU QUI N’EST SUR AUCUNE BRANCHE EST PIRE ENCORE — rien ne le porte', () => {
  // Le lieu existe sur le disque mais aucun commit ne le contient : il n'est pas versionné du
  // tout. Un `git clean` l'emporte, et il n'y a rien d'où le restaurer.
  const v = expositionDuLieu({ lieu: LIEU, branchesQuiPortent: [], brancheCourante: 'main' });

  assert.equal(v?.risque, RISQUE.AUCUNE_BRANCHE);
  assert.match(v.quoi, /aucune branche|pas versionné/i);
});

test('LE VERDICT NOMME LE GESTE QUI LÈVE — et à qui il appartient', () => {
  // ⚠️ L'invariant de `T-20260816-0045` : un signalement qui ne nomme pas la sortie laisse son
  // lecteur exactement où il était. Ici la sortie est de VERSER le lieu sur la branche par
  // défaut — et ce geste appartient à qui peut fusionner, pas à l'agent qui l'habite.
  const v = expositionDuLieu({ lieu: LIEU, branchesQuiPortent: ['origin/x'], brancheCourante: 'x' });

  assert.match(v.geste, new RegExp(LIEU), 'le lieu réel, pas un gabarit');
  assert.match(v.geste, /main/, 'la branche qui le mettrait à l’abri');
});

// ═════════════════ 2. CE QUI NE L'EST PAS — la moitié qui protège

test('UN LIEU PORTÉ PAR LA BRANCHE PAR DÉFAUT N’EST PAS SIGNALÉ', () => {
  // Le cas nominal une fois le lieu versé : toutes les branches qui descendent de `main` le
  // portent, donc aucun changement de branche ordinaire ne peut le retirer.
  assert.equal(
    expositionDuLieu({ lieu: LIEU, branchesQuiPortent: ['origin/main'], brancheCourante: 'wt/x' }),
    null,
  );
});

test('UN LIEU PORTÉ PAR PLUSIEURS BRANCHES DONT LA PAR DÉFAUT N’EST PAS SIGNALÉ NON PLUS', () => {
  assert.equal(
    expositionDuLieu({
      lieu: LIEU,
      branchesQuiPortent: ['origin/main', 'origin/chore/x', 'origin/wt/y'],
      brancheCourante: 'chore/x',
    }),
    null,
  );
});

test('⚠️ DEUX BRANCHES SANS LA PAR DÉFAUT RESTENT EXPOSÉES — le nombre ne suffit pas', () => {
  // Deux branches de travail peuvent disparaître toutes les deux ; seule la branche par défaut
  // est portée par ce qui en descend. Compter sans regarder LAQUELLE serait un faux négatif.
  const v = expositionDuLieu({
    lieu: LIEU,
    branchesQuiPortent: ['origin/chore/a', 'origin/chore/b'],
    brancheCourante: 'chore/a',
  });

  assert.equal(v?.risque, RISQUE.PAS_SUR_LA_PAR_DEFAUT);
});

// ═════════════════ 3. ON NE CONCLUT PAS D'UNE ABSENCE DE MESURE

test('SANS LISTE DE BRANCHES, ON NE SIGNALE RIEN — « je n’ai pas pu lire » n’est pas « rien ne le porte »', () => {
  // ⚠️ Le motif que ce dépôt ferme partout. Une interrogation de git qui échoue rendrait une
  // liste vide, et une liste vide vaut « aucune branche » — soit l'alarme maximale sur un lieu
  // parfaitement sain. On distingue donc « mesuré vide » de « pas mesuré ».
  assert.equal(expositionDuLieu({ lieu: LIEU, branchesQuiPortent: null, brancheCourante: 'main' }), null);
  assert.equal(expositionDuLieu({ lieu: LIEU, branchesQuiPortent: undefined, brancheCourante: 'main' }), null);
});

test('SANS LIEU NOMMÉ, IL N’Y A RIEN À JUGER', () => {
  assert.equal(expositionDuLieu({ lieu: null, branchesQuiPortent: [], brancheCourante: 'main' }), null);
  assert.equal(expositionDuLieu({}), null);
});

// ═════════════════ 3-bis. ET LA NAISSANCE LE DIT — le plus tôt possible

test('LA NAISSANCE SIGNALE UN LIEU EXPOSÉ — quand il reste encore le temps d’agir', async () => {
  // ⚠️ LE BRANCHEMENT, ET IL EST LE POINT DU LOT. `expositionDuLieu` a ses propres essais ; ça
  // ne prouve pas que quelqu'un l'appelle. Sans cet essai, on pourrait retirer l'appel de la
  // naissance et tout resterait vert — la garde existerait dans le dépôt et nulle part dans la
  // vie d'un agent.
  //
  // Et c'est la NAISSANCE, pas seulement la ronde : la ronde passe après, quand l'agent a déjà
  // travaillé dans un lieu qu'un tiers peut emporter. Ici, personne n'a encore rien perdu.
  const { expositionAlaNaissance } = await import('../../naissance-representant/src/naissance.js');

  const v = expositionAlaNaissance('/depot', 'j-0002', 'orchestrateur', {
    branchesQuiPortent: ['origin/chore/orchestrateur-j-0002'],
  });

  assert.equal(v?.risque, RISQUE.UNE_SEULE_BRANCHE);
  assert.match(v.lieu, /\.orchestrateur[/\\]j-0002/, 'le lieu réel, relatif au dépôt');
  assert.ok(!/^\//.test(v.lieu), 'jamais un chemin absolu de poste dans un message');
});

test('ET ELLE NE DIT RIEN QUAND LE LIEU EST À L’ABRI — une naissance qui parle pour rien n’est plus lue', async () => {
  const { expositionAlaNaissance } = await import('../../naissance-representant/src/naissance.js');
  assert.equal(
    expositionAlaNaissance('/depot', 'j-0002', 'orchestrateur', { branchesQuiPortent: ['origin/main'] }),
    null,
  );
});

// ═════════════════ 4. CE QUE CE MODULE NE FAIT PAS

test('LE VERDICT NE PROPOSE JAMAIS DE RÉTABLIR LA BRANCHE — le réflexe le plus dommageable', () => {
  // ⚠️ Le ticket le dit deux fois : rétablir la branche remettrait les fichiers ET écraserait
  // le travail de la session qui y a commité depuis. Un signalement qui suggérerait ce geste
  // ferait plus de dégâts que la panne qu'il annonce.
  const v = expositionDuLieu({ lieu: LIEU, branchesQuiPortent: ['origin/x'], brancheCourante: 'x' });

  assert.ok(!/checkout|rétablir|rebasculer/i.test(v.geste), 'aucun geste qui déplace la branche partagée');
  assert.ok(!('reparer' in v) && !('branche_a_retablir' in v), 'et rien qui invite à le faire');
});

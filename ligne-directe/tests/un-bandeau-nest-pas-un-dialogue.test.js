// ═══════════════════════════════════════════════════════════════════════════════════════════
// UN BANDEAU DE LIMITE D'USAGE N'EST PAS UN DIALOGUE — T-20260825-0073, défaut ② de la Phase 0
//
// CE QUE CE BANC FERME. `livrer.js` a refusé d'écrire à un agent parfaitement joignable en
// affirmant « la session est devant un DIALOGUE qui attend un choix ». Il a empêché la livraison
// du rapport de Phase 0 lui-même (T-20260825-0067, addendum). Trois mesures indépendantes prises
// dans la minute disaient le contraire : `agent get` → idle, `pane read` → boîte vide,
// `etat-boite.js` → « on peut y livrer ». **Deux outils du même dispositif se contredisaient
// formellement, au même instant, sur le même pane** — et c'est celui qui regardait la BOÎTE qui
// avait raison.
//
// ⚠️ LA CAUSE N'EST PAS CELLE QUE LE RAPPORT SUPPOSAIT, et il faut le dire ici parce qu'un banc
// bâti sur la mauvaise cause serait vert sans rien garder. Le rapport pensait à un scrollback lu
// à la place de l'écran courant, et proposait de restreindre la lecture aux dernières lignes
// rendues. **Mesuré le 2026-08-25 sur les 85 panes réels du poste : la garde mord sur 4 panes
// avec `--source visible` EXACTEMENT COMME avec `--source recent`** — la ligne fautive est bel et
// bien à l'écran courant, à la ligne 26, 43, 44 ou 54 d'un écran de 79 lignes. Ce n'est pas un
// problème d'historique : c'est une marque qui attrape une ligne de sortie ORDINAIRE.
//
// ⚠️ ET RESSERRER LA TOURNURE NE RÉPARE PAS NON PLUS. On pouvait croire que le remplissage de la
// regex (`esc` … 20 caractères … `cancel`) était le coupable, et qu'exiger `esc to cancel` collé
// suffirait. **Mesuré sur les 87 panes : les DEUX tournures existent sur le bandeau bénin** —
// « esc or type to cancel » ET « esc to cancel », cette dernière identique au mot pour mot du
// vrai dialogue. La tournure ne discrimine rien.
//
// ⚠️ CE QUI DISCRIMINE, MESURÉ DES DEUX CÔTÉS DE LA FRONTIÈRE : **un vrai dialogue REMPLACE la
// boîte de saisie**, un bandeau la laisse en place.
//   • le vrai dialogue de permission du 2026-08-17 (celui qui a fait exécuter une commande) :
//     état de boîte `illisible` — il n'y a plus de boîte, le dialogue a pris sa place ;
//   • les 8 panes réels où la garde mordait le 2026-08-25 : état de boîte `vide`, 8 sur 8.
// C'est exactement ce que `etat-boite.js` disait déjà le jour du faux refus. Le dispositif
// détenait la réponse ; elle n'était simplement pas branchée sur ce chemin-là.
// ═══════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ecranAttendUnChoix } from '../src/ecran.js';
import { etatDeLaBoite, ETATS_BOITE } from '../src/boite.js';

const ICI = dirname(fileURLToPath(import.meta.url));

/**
 * L'ÉCRAN RÉEL QUI A PRODUIT LE FAUX REFUS — capturé sur un pane du poste en `--format ansi`,
 * jamais réécrit à la main.
 *
 * ⚠️ IL EST GARDÉ EN OCTETS, ET C'EST LE POINT. Une fixture retapée aurait pu ne pas reproduire
 * l'état de boîte du vrai écran — et un double plus complaisant que le service fabrique des
 * défauts au lieu d'en attraper. Contrôle explicite plus bas : cette fixture DOIT rendre une
 * boîte `vide`, comme le pane d'origine.
 */
const BANDEAU_REEL = readFileSync(join(ICI, 'aide', 'ecran-bandeau-limite-usage.ansi.txt'), 'utf8');

/** Le vrai dialogue de permission mesuré le 2026-08-17 — celui qui a fait exécuter une commande. */
const DIALOGUE_REEL = [
  ' Bash command',
  '',
  '   touch /tmp/mesure-dialogue-t0006',
  '',
  ' Do you want to proceed?',
  ' ❯ 1. Yes',
  '   2. Yes, and always allow access',
  '   3. No',
  '',
  ' Esc to cancel · Tab to amend',
].join('\n');

// ── Le contrôle de la fixture elle-même ────────────────────────────────────────────────────
test('LA FIXTURE REPRODUIT L’ÉTAT RÉEL — boîte vide, comme le pane du 2026-08-25', () => {
  // Sans ce contrôle, tout ce fichier pourrait être vert sur un écran qui n'est pas celui du
  // défaut. C'est l'assertion qui empêche le banc de s'auto-satisfaire.
  assert.equal(etatDeLaBoite(BANDEAU_REEL).etat, ETATS_BOITE.VIDE);
  assert.match(BANDEAU_REEL, /esc or type to cancel/i, 'la tournure large du bandeau');
  assert.match(BANDEAU_REEL, /esc to cancel/i, 'ET la tournure tendue, identique au vrai dialogue');
});

test('LE VRAI DIALOGUE N’A PAS DE BOÎTE — c’est lui qui a pris sa place', () => {
  assert.equal(etatDeLaBoite(DIALOGUE_REEL).etat, ETATS_BOITE.ILLISIBLE);
});

// ── Le défaut, et son symétrique ───────────────────────────────────────────────────────────
test('LE BANDEAU DE LIMITE D’USAGE N’EST PAS UN DIALOGUE — il a bloqué la remise d’un rapport', () => {
  // 🔴 L'ASSERTION QUI PORTE LE LOT. Rouge avant le correctif : la garde rendait `true` et
  // `livrer.js` renvoyait vers un geste humain devant un dialogue qui n'existait pas.
  assert.equal(
    ecranAttendUnChoix(BANDEAU_REEL),
    false,
    'un agent au repos, boîte vide, est joignable — le bandeau ne le rend pas injoignable'
  );
});

test('LE VRAI DIALOGUE DE PERMISSION EST TOUJOURS RECONNU — le refus fondé n’a pas été emporté', () => {
  // ⚠️ L'AUTRE CÔTÉ DE LA FRONTIÈRE, et il compte autant. Fermer un faux positif ouvre son
  // symétrique sur la même frontière : un correctif qui rendrait `false` ici ferait écrire un
  // message ordinaire devant un dialogue, ce qui CONFIRME l'option affichée et lance l'action.
  assert.equal(ecranAttendUnChoix(DIALOGUE_REEL), true);
});

test('« Esc to cancel » SEUL, sans boîte, reste un dialogue — la marque n’est pas retirée', () => {
  // Le correctif ne supprime pas la marque : il exige qu'aucune boîte ordinaire ne soit là.
  // Un écran qui ne porte QUE cette invite n'a pas de boîte, donc il compte toujours.
  assert.equal(ecranAttendUnChoix('Esc to cancel'), true);
  assert.equal(ecranAttendUnChoix(' Esc to cancel · Tab to amend'), true);
});

test('LES QUATRE AUTRES MARQUES DÉCIDENT SEULES — le correctif ne les affaiblit pas', () => {
  // ⚠️ MESURÉ AVANT DE TOUCHER À QUOI QUE CE SOIT : sur les 87 panes réels du poste, la garde
  // n'a mordu QUE sur `esc…cancel` — les quatre autres marques n'ont produit aucun faux positif.
  // C'est pourquoi elles gardent leur pouvoir de décider seules, boîte ou pas. Les rendre elles
  // aussi conditionnelles à l'absence de boîte ouvrirait des faux NÉGATIFS sur des marques qui
  // n'ont jamais fauté — un correctif qui coûterait plus qu'il ne rapporte.
  const boiteOrdinaire = '\n────────\n❯ \n────────\n';
  for (const marque of ['Do you want to proceed?', 'Continue? (y/n)', 'Enter to confirm']) {
    assert.equal(
      ecranAttendUnChoix(marque + boiteOrdinaire),
      true,
      `« ${marque} » doit rester décisive même quand une boîte est rendue`
    );
  }
  assert.equal(
    ecranAttendUnChoix('❯ 1. Yes\n  2. No' + boiteOrdinaire),
    true,
    'le curseur sur une option numérotée reste décisif'
  );
});

test('UNE SORTIE ORDINAIRE QUI PARLE D’ANNULER NE REND PERSONNE INJOIGNABLE', () => {
  // Le cas générique dont le bandeau n'est qu'un exemplaire : un agent dont le transcript
  // contient les deux mots reste joignable tant que sa boîte est là.
  const prose =
    '⏺ Je vais lancer la commande ; esc or type to cancel si tu veux arrêter.\n' +
    '\n────────\n❯ \n────────\n';
  assert.equal(etatDeLaBoite(prose).etat, ETATS_BOITE.VIDE, 'la boîte est bien là');
  assert.equal(ecranAttendUnChoix(prose), false);
});

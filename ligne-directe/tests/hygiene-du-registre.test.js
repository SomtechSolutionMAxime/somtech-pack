// UNE LIGNE DONT LE CHANTIER A DISPARU EST SIGNALÉE, JAMAIS FERMÉE D'OFFICE (T-20260816-0083).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LA MOITIÉ QUE `T-20260816-0003` A NOMMÉE SANS LA FERMER
//
// Ce lot-là a fait entrer la SESSION dans l'identité d'une ligne — deux chantiers de deux
// clients partageaient `w5:p3`. Fermé. Mais son commentaire de clôture nommait lui-même une
// moitié `[non fermé]` : une ligne dont le worktree n'existe plus attend encore le prochain
// occupant de son pane, **dans la même session**, avec un canal ouvert pour un autre client.
//
// ⚠️ MESURE CORRIGÉE AVANT LA FUSION, par son auteur. Le premier compte disait « 2 lignes
// ouvertes sur 42 » — faux : le filtre portait sur `fermee_le`, un champ qui n'existe pas au
// registre, donc il ne filtrait rien. Sur le vrai champ `close_le` : **25 ouvertes, aucune au
// chantier disparu** ; les 2 lignes concernées sont **closes**. Le mécanisme reste réel, mais
// cette passe est une PRÉVENTION — pas la réponse à un incident en cours.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI UNE HYGIÈNE ET PAS UN FILTRE — et c'est un arbitrage, pas un détail
//
// La première écriture posait la garde dans la SÉLECTION : la ligne morte cessait d'être
// proposée. Ça marchait, et c'était la mauvaise place.
//
// **Un filtre laisse le registre DIRE que la ligne est ouverte pendant qu'on la cache** — deux
// sources de vérité qui divergent en silence, le motif que ce dépôt paie le plus cher. Une
// passe d'hygiène fait que le registre CESSE de mentir : on soigne le fait, pas sa lecture.
//
// Mesure qui a fait regarder, et qui n'est PAS la raison du choix : brancher le disque dans la
// sélection faisait rougir **26 essais** (538 verts / 0 rouge sans, 512 / 26 avec) dont les
// registres portent des chemins inventés. Une garde bien placée mériterait qu'on paie ce
// nettoyage ; celle-ci n'était pas à sa place, et c'est ça qui tranche.
//
// ⚠️ ELLE SIGNALE, ELLE NE FERME RIEN — section 3. Refermer à tort ferait taire un canal client.
// ⚠️ ELLE N'ÉCARTE QUE SUR PREUVE — section 2. « Je n'ai pas lu » n'est pas « ça n'existe pas ».

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lignesAuChantierDisparu, gesteDeFermeture, avisDHygiene } from '../src/hygiene.js';

/** Le disque, doublé : ce module rend un jugement, il ne va pas le chercher lui-même. */
const existe = (vivants) => (chemin) => vivants.includes(chemin);

const VIVANT = '/chantiers/vivant';
const DISPARU = '/worktrees/somtech-pack/20260805-212943';
const surLeDisque = existe([VIVANT]);

const ligne = (chantier, worktree, sur = {}) => ({
  chantier,
  worktree,
  pane: 'w26:pM',
  canal_nom: chantier,
  canal_id: `C_${chantier}`,
  ...sur,
});

// ═════════════════ 1. CE QU'ELLE VOIT

test('UNE LIGNE DONT LE CHANTIER A DISPARU EST SIGNALÉE — avec ce qu’on a trouvé', () => {
  const m = lignesAuChantierDisparu([ligne('chantier-mort', DISPARU)], { chantierExiste: surLeDisque });

  assert.equal(m.length, 1);
  assert.equal(m[0].chantier, 'chantier-mort');
  assert.equal(m[0].worktree, DISPARU, 'le chemin réel, pas une mention générique');
  assert.equal(m[0].pane, 'w26:pM', 'et le pane qu’elle occupe encore');
});

test('UNE LIGNE VIVANTE N’EST JAMAIS SIGNALÉE — sinon la passe crie sur tout le poste', () => {
  // Les 25 lignes ouvertes du registre réel sont TOUTES vivantes. Les signaler rendrait la
  // passe inaudible avant qu'elle ait servi une seule fois.
  assert.deepEqual(lignesAuChantierDisparu([ligne('vivant', VIVANT)], { chantierExiste: surLeDisque }), []);
});

test('ELLE NE VOIT QUE LES LIGNES QU’ON LUI DONNE — et rien quand il n’y en a pas', () => {
  assert.deepEqual(lignesAuChantierDisparu([], { chantierExiste: surLeDisque }), []);
  assert.deepEqual(lignesAuChantierDisparu(null, { chantierExiste: surLeDisque }), []);
});

// ═════════════════ 2. ON N'ÉCARTE QUE SUR PREUVE — la leçon des vingt rouges

test('UNE LIGNE SANS WORKTREE ENREGISTRÉ N’EST PAS SIGNALÉE — l’absence de donnée ne prouve rien', () => {
  // ⚠️ C'EST L'ERREUR QUE LE CORRECTIF DE `T-20260816-0003` A PAYÉE VINGT ESSAIS ROUGES : il
  // écartait sur absence de donnée, et rendait injoignables EN SILENCE les lignes écrites avant
  // que le champ existe. Signaler ici « chantier disparu » sur une ligne sans worktree
  // enverrait quelqu'un fermer une ligne parfaitement saine.
  for (const rien of [null, undefined, '', '   ']) {
    assert.deepEqual(lignesAuChantierDisparu([ligne('flou', rien)], { chantierExiste: surLeDisque }), [],
      `« ${rien} » n’est pas une preuve d’absence`);
  }
});

test('UN CHEMIN QU’ON N’A PAS PU INTERROGER N’EST PAS UN CHEMIN ABSENT', () => {
  // Le disque peut refuser de répondre — permission, montage disparu, chemin trop long. Lire
  // ce silence comme « ça n'existe pas » ferait signaler des chantiers bien vivants.
  const quiJette = () => {
    throw new Error('EACCES');
  };
  assert.deepEqual(lignesAuChantierDisparu([ligne('illisible', DISPARU)], { chantierExiste: quiJette }), []);
});

test('SANS MOYEN DE CONSTATER, ON NE SIGNALE RIEN DU TOUT', () => {
  // ⚠️ Le module ne va pas chercher le disque lui-même. Sans prédicat, il se tait — plutôt que
  // de s'inventer un accès et de s'activer là où personne ne le lui a demandé.
  assert.deepEqual(lignesAuChantierDisparu([ligne('mort', DISPARU)]), []);
  assert.deepEqual(lignesAuChantierDisparu([ligne('mort', DISPARU)], { chantierExiste: 'oui' }), []);
});

// ═════════════════ 3. ELLE SIGNALE, ELLE NE FERME PAS — et son signalement nomme sa sortie

test('LE SIGNALEMENT PORTE LE GESTE EXACT QUI REFERME, ET D’OÙ LE LANCER', () => {
  // ⚠️ L'INVARIANT DE `T-20260816-0045` appliqué à l'hygiène : un refus — ou ici un avis — qui
  // ne nomme pas la sortie laisse son lecteur exactement où il était. Et `fermer` choisit parmi
  // les lignes du PANE COURANT : donner la commande sans dire d'où la lancer serait un
  // demi-geste, c'est-à-dire le défaut qu'on a fermé la semaine même.
  const g = gesteDeFermeture(ligne('chantier-mort', DISPARU));

  assert.match(g, /ligne-directe fermer --a chantier-mort/, 'la commande, avec la valeur réelle');
  assert.match(g, /w26:pM/, 'et le pane d’où elle doit être lancée');
});

test('SANS PANE CONNU, LE GESTE NE FABRIQUE PAS UN ENDROIT — il dit ce qu’il sait', () => {
  const g = gesteDeFermeture({ chantier: 'orpheline', worktree: DISPARU, pane: null });
  assert.match(g, /ligne-directe fermer --a orpheline/);
  assert.ok(!/« null »|undefined/.test(g), 'aucun trou dans le texte rendu');
});

test('L’AVIS DIT QU’IL N’A RIEN FERMÉ — parce qu’une ligne fermée à tort fait taire un client', () => {
  const avis = avisDHygiene(lignesAuChantierDisparu([ligne('mort', DISPARU)], { chantierExiste: surLeDisque }));

  assert.match(avis, /chantier-mort|mort/, 'la ligne concernée');
  assert.match(avis, new RegExp(DISPARU.replace(/[/\\]/g, '\\$&')), 'le chemin trouvé');
  assert.match(avis, /fermer --a/, 'le geste');
  assert.match(avis, /Rien n'a été fermé/i, 'et l’aveu qu’on n’a rien fait à sa place');
});

test('QUAND IL N’Y A RIEN À DIRE, L’AVIS SE TAIT — une passe qui parle pour rien cesse d’être lue', () => {
  assert.equal(avisDHygiene([]), null);
  assert.equal(avisDHygiene(null), null);
});

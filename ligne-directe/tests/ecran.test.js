// ecran.test.js — NOMMER UN ÉCRAN QU'ON NE RECONNAÎT PAS (T-20260816-0033).
//
// Les écrans ci-dessous sont RECOPIÉS DU VRAI, mesurés le 2026-08-16 sur Claude Code 2.1.233 en
// faisant naître un agent d'essai. Ce n'est pas de la fiction : un essai écrit de mémoire aurait
// prouvé que le module est d'accord avec l'idée qu'on se fait de l'écran, pas avec l'écran.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { etatDeLEcran, touchesPourFranchir, ECRANS_CONNUS, ecranAttendUnChoix, ressembleAUnChoix, resumeDeLEcran } from '../src/ecran.js';

const FILET = '─'.repeat(120);

/** L'écran de CONFIANCE, tel que mesuré sur un lieu portant un bloc `permissions.allow`. */
const ECRAN_CONFIANCE = `
${FILET}
 Accessing workspace:

 /tmp/essai/.orchestrateur/essai2

 Quick safety check: Is this a project you created or one you trust? (Like your own code, a well-known open source project, or work from your team). If not, take a moment to review what's in this folder first.

 Claude Code'll be able to read, edit, and execute files here.

 ⚠ This folder pre-approves 20 tool permissions in .claude/settings.json:
   mcp__servicedesk__*, mcp__somcraft__*, Bash(git log*), and 12 more
 These will apply without asking. Only proceed if you trust this configuration.

 Security guide

 ❯ 1. Yes, I trust this folder
   2. No, continue without these permissions

 Enter to confirm · Esc to cancel
`;

/** L'écran des SERVEURS MCP, tel que mesuré une fois le bloc `allow` retiré. */
const ECRAN_SERVEURS = `
${FILET}
  2 new MCP servers found in this project
  Select any you wish to enable.

  MCP servers may execute code or access system resources. All tool calls require approval.

  ❯ [✔] servicedesk
    [✔] somcraft
 Space to select · Enter to confirm · Esc to reject all
`;

/** L'écran NORMAL — une invite prête à recevoir, encadrée par ses deux filets. */
const ECRAN_PRET = `
⏺ Compris.

${FILET}
❯
${FILET}
  ⏵⏵ accept edits on (shift+tab to cycle) · ← for agents
`;

/** L'écran d'un agent au travail, boîte vide : prêt à recevoir aussi (la file s'en charge). */
const ECRAN_PRET_AVEC_TEXTE = `
${FILET}
❯ un brief resté dans la boîte
${FILET}
  ⏵⏵ accept edits on (shift+tab to cycle)
`;

/** Un écran qu'aucun motif ne connaît — le cas qui décide de tout. */
const ECRAN_INCONNU = `
${FILET}
 ^ ce que verrait un utilisateur de Somcraft
   en ouvrant le CHANGELOG du produit
Notes: press n to add notes
Chat about this
Enter to select · ↑/↓ to navigate · n to add notes · Esc to cancel
`;

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — L'INVITE PRÊTE

test('une invite prête est reconnue comme prête, et ne nomme aucun écran', () => {
  const e = etatDeLEcran(ECRAN_PRET);
  assert.equal(e.pretARecevoir, true);
  assert.equal(e.ecran, null);
  assert.equal(e.inconnu, false);
});

test('une invite qui porte déjà du texte reste PRÊTE — la boîte pleine est le problème d’un autre', () => {
  // Ce module dit si l'agent est joignable, pas si la boîte est libre : c'est `contenuBoite`
  // qui tranche la seconde question, et les confondre ferait deux gardes pour un seul fait.
  assert.equal(etatDeLEcran(ECRAN_PRET_AVEC_TEXTE).pretARecevoir, true);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — LES ÉCRANS CONNUS SONT NOMMÉS, ET ILS DISENT LE GESTE

test('l’écran de confiance est nommé, et le refus donne le geste qui le lève', () => {
  const e = etatDeLEcran(ECRAN_CONFIANCE);
  assert.equal(e.pretARecevoir, false, 'un agent derrière un modal n’est PAS prêt');
  assert.equal(e.ecran, 'confiance');
  assert.equal(e.inconnu, false);
  assert.ok(e.geste && e.geste.length > 20, `le geste qui lève le blocage doit être nommé — reçu : ${e.geste}`);
});

test('l’écran des serveurs MCP est nommé, et il n’est pas confondu avec celui de confiance', () => {
  const e = etatDeLEcran(ECRAN_SERVEURS);
  assert.equal(e.pretARecevoir, false);
  assert.equal(e.ecran, 'serveurs-mcp');
  assert.equal(e.inconnu, false);
  assert.ok(e.geste);
});

test('chaque écran connu porte une sonde ET un geste — aucun ne peut être déclaré sans dire quoi faire', () => {
  assert.ok(ECRANS_CONNUS.length >= 2);
  for (const ec of ECRANS_CONNUS) {
    assert.ok(ec.cle, 'un écran connu doit avoir une clé');
    assert.ok(ec.sonde instanceof RegExp, `${ec.cle} : la sonde doit être une expression régulière`);
    assert.ok(ec.geste && ec.geste.length > 20, `${ec.cle} : un écran nommé sans geste laisse le lecteur aussi bloqué qu’avant`);
  }
});

test('les sondes des écrans connus sont DISTINCTES — aucune n’attrape l’écran d’une autre', () => {
  // Une sonde trop large ferait nommer un écran pour un autre, et le geste proposé serait faux.
  // C'est pire que « inconnu » : un mauvais nom se croit, un aveu d'ignorance se vérifie.
  const echantillons = { confiance: ECRAN_CONFIANCE, 'serveurs-mcp': ECRAN_SERVEURS };
  for (const ec of ECRANS_CONNUS) {
    for (const [cle, texte] of Object.entries(echantillons)) {
      if (cle === ec.cle) continue;
      assert.ok(!ec.sonde.test(texte), `la sonde de « ${ec.cle} » attrape aussi l’écran « ${cle} »`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — L'INCONNU, ET C'EST LE CŒUR

test('un écran qu’aucun motif ne connaît est déclaré INCONNU, jamais prêt', () => {
  const e = etatDeLEcran(ECRAN_INCONNU);
  assert.equal(e.pretARecevoir, false, 'l’inconnu ne se lit JAMAIS comme une bonne nouvelle');
  assert.equal(e.inconnu, true);
  assert.equal(e.ecran, null);
});

test('un écran inconnu rend un RÉSUMÉ de ce qui a été réellement vu', () => {
  const e = etatDeLEcran(ECRAN_INCONNU);
  assert.ok(e.resume, 'sans résumé, « inconnu » ne dit rien de plus que « bloqué »');
  assert.ok(
    e.resume.includes('Chat about this') || e.resume.includes('press n to add notes'),
    `le résumé doit citer des lignes RÉELLEMENT vues — reçu : ${JSON.stringify(e.resume)}`
  );
  assert.ok(e.resume.length <= 600, 'le résumé est un résumé, pas un dump');
});

test('un écran illisible est INCONNU — l’absence de mesure n’est pas une absence d’écran', () => {
  for (const rien of [null, undefined, '', '   \n  \n']) {
    const e = etatDeLEcran(rien);
    assert.equal(e.pretARecevoir, false, `« ${JSON.stringify(rien)} » ne doit jamais passer pour prêt`);
    assert.equal(e.inconnu, true);
  }
});

test('un écran inconnu ne fabrique jamais de geste — on ne conseille pas ce qu’on n’a pas vérifié', () => {
  const e = etatDeLEcran(ECRAN_INCONNU);
  assert.equal(e.geste, null, 'inventer un geste devant un écran qu’on ne comprend pas, c’est deviner');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 — ADVERSARIAL : ce qui pourrait faire mentir le verdict

test('un écran connu qui porte AUSSI une boîte encadrée reste nommé, il ne passe pas pour prêt', () => {
  // L'ordre de décision compte : si on cherchait la boîte d'abord, un modal affiché par-dessus
  // un écran qui en porte une se lirait comme « prêt ». C'est la porte-sur-deux, appliquée ici.
  const melange = `${ECRAN_CONFIANCE}\n${FILET}\n❯\n${FILET}\n`;
  const e = etatDeLEcran(melange);
  assert.equal(e.pretARecevoir, false);
  assert.equal(e.ecran, 'confiance');
});

test('le texte d’un brief qui PARLE d’un écran ne le déclenche pas', () => {
  // Un brief de ce dépôt cite les écrans : s'ils étaient détectés dans la boîte de saisie, tout
  // agent à qui on parle de ces défauts paraîtrait bloqué.
  const brief = `
${FILET}
❯ corrige le défaut où l'agent voit « Is this a project you created or one you trust? »
${FILET}
  ⏵⏵ accept edits on (shift+tab to cycle)
`;
  const e = etatDeLEcran(brief);
  assert.equal(e.pretARecevoir, true, 'un écran cité DANS la boîte n’est pas un écran affiché');
  assert.equal(e.ecran, null);
});

test('le verdict ne dépend pas des séquences ANSI — un dump coloré dit la même chose', () => {
  const ESC = String.fromCharCode(27);
  const colore = ECRAN_CONFIANCE.replace('Quick safety check', `${ESC}[1mQuick safety check${ESC}[0m`);
  assert.equal(etatDeLEcran(colore).ecran, 'confiance');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 — LE GESTE MESURÉ QUI FRANCHIT — et il n'existe que là où on l'a mesuré

test('l’écran des serveurs porte un geste mesuré ; celui de confiance n’en porte pas', () => {
  // La distinction est la frontière entre « franchir » et « deviner ». Un geste ne s'invente
  // pas : il se mesure, une fois, contre le vrai outil. L'écran de confiance, lui, se SUPPRIME
  // par la pré-approbation — lui envoyer une touche serait accepter à la place d'un humain une
  // question de confiance, ce qui n'est pas la même chose que confirmer une liste déjà cochée.
  assert.deepEqual(touchesPourFranchir(etatDeLEcran(ECRAN_SERVEURS)), ['enter']);
  assert.equal(touchesPourFranchir(etatDeLEcran(ECRAN_CONFIANCE)), null);
});

test('un écran INCONNU ne porte JAMAIS de geste à envoyer — c’est la garantie centrale', () => {
  assert.equal(touchesPourFranchir(etatDeLEcran(ECRAN_INCONNU)), null);
  assert.equal(touchesPourFranchir(etatDeLEcran(null)), null);
  assert.equal(touchesPourFranchir(etatDeLEcran(ECRAN_PRET)), null);
});

test('aucun écran connu ne propose « esc » — rejeter n’est pas franchir', () => {
  // « Esc to reject all » ferait naître l'agent SANS son registre : muet sur le chantier qu'il
  // vient d'ouvrir. Un franchissement qui coûte à l'agent ce pour quoi il naît est un abandon.
  for (const ec of ECRANS_CONNUS) {
    for (const t of ec.touches || []) {
      assert.ok(!/^esc(ape)?$/i.test(t), `l’écran « ${ec.cle} » propose « ${t} » : ce n’est pas un franchissement`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 — UN ÉCRAN QUI ATTEND UN CHOIX, ET SURTOUT UN ÉCRAN QUI N'EN ATTEND PAS (T-20260817-0006)
//
// ⚠️ CE BLOC EXISTE PARCE QU'UNE PASSE DE REVUE A RELEVÉ QU'IL MANQUAIT. `ecranAttendUnChoix`
// n'était éprouvée que de biais, par deux essais d'intégration de `herdr.js`. Le cas NÉGATIF —
// une liste numérotée ordinaire ne doit PAS déclencher le refus — n'avait aucun témoin, alors
// que c'est la raison d'être même de cette fonction. Si les marques régressaient un jour vers
// un motif plus large, rien ne l'aurait vu.
//
// ⚠️ ET CE N'EST PAS UNE CRAINTE THÉORIQUE, C'EST UNE MESURE. Appliquer la sonde LARGE
// (`ressembleAUnChoix`, faite pour le contenu de la BOÎTE) à un écran entier déclarait « en
// attente de choix » 3 panes réels sur 14 dans une première mesure, et **23 sur 65 — 35,4 %** —
// dans une seconde, indépendante. Tous idle, boîte prête, parfaitement joignables. Une garde qui
// refuse un agent sur trois rend la ligne du dirigeant inutilisable : une panne PIRE, en
// fréquence, que celle qu'elle prétend fermer. Après resserrement : 0 sur 65.

/** Le vrai dialogue de permission mesuré le 2026-08-17 — celui qui a fait exécuter une commande. */
const DIALOGUE_REEL = [
  ' Bash command',
  '',
  '   touch /tmp/mesure-dialogue-t0006',
  '',
  ' Do you want to proceed?',
  ' \u276f 1. Yes',
  '   2. Yes, and always allow access',
  '   3. No',
  '',
  ' Esc to cancel \u00b7 Tab to amend',
].join('\n');

/** Une sortie d'agent parfaitement ordinaire — relevée sur des panes réels de ce poste. */
const LISTE_ORDINAIRE = [
  'Voici ce que je propose :',
  '',
  '  1. Mesurer le defaut contre le vrai service',
  '  2. Reparer le double avant le correctif',
  '  3. Poser la garde',
  '',
  '\u2500'.repeat(20),
  '\u276f ',
  '\u2500'.repeat(20),
].join('\n');

test('UN VRAI DIALOGUE DE PERMISSION EST RECONNU — c’est celui qui a fait exécuter une commande', () => {
  assert.equal(ecranAttendUnChoix(DIALOGUE_REEL), true);
});

test('UNE LISTE NUMÉROTÉE ORDINAIRE N’EST PAS UN CHOIX — 35 % des agents devenaient injoignables', () => {
  // ⚠️ L'ESSAI QUI COMPTE LE PLUS DE CE FICHIER. C'est lui qui empêche la garde de redevenir
  // une panne. La sonde LARGE, elle, s'y trompe — et c'est normal : elle n'est pas faite pour
  // ça. On éprouve les deux ensemble pour que la différence reste visible et voulue.
  assert.equal(ressembleAUnChoix(LISTE_ORDINAIRE), true, 'la sonde de BOÎTE s’y trompe — elle est large exprès');
  assert.equal(ecranAttendUnChoix(LISTE_ORDINAIRE), false, 'la sonde d’ÉCRAN, elle, ne doit pas s’y tromper');
});

test('LE CURSEUR DE SÉLECTION EST CE QUI DISTINGUE — une option pointée, pas une liste qu’on lit', () => {
  assert.equal(ecranAttendUnChoix('  1. Oui\n  2. Non'), false, 'une liste seule ne suffit pas');
  assert.equal(ecranAttendUnChoix('\u276f 1. Oui\n  2. Non'), true, 'le curseur sur l’option, si');
});

test('LES FORMULES D’INVITE SUFFISENT SEULES — sans aucune option numérotée', () => {
  for (const invite of ['Do you want to continue?', 'Continue? (y/n)', 'Esc to cancel', 'Enter to confirm']) {
    assert.equal(ecranAttendUnChoix(invite), true, `« ${invite} » doit être reconnu`);
  }
});

test('UN ÉCRAN VIDE OU ILLISIBLE N’EST PAS « un choix » — il est traité ailleurs, et autrement', () => {
  // Il ne faut pas que l'absence de lecture se déguise en dialogue : ce sont deux refus
  // différents, avec deux messages différents, et les confondre priverait le dirigeant du bon.
  assert.equal(ecranAttendUnChoix(null), false);
  assert.equal(ecranAttendUnChoix(''), false);
  assert.equal(ecranAttendUnChoix('   \n  '), false);
});

// ── `resumeDeLEcran` — exportée par T-20260817-0008, et elle nettoie désormais elle-même.

test('LE RÉSUMÉ NETTOIE SON ENTRÉE — sinon un refus part truffé de séquences illisibles', () => {
  // Elle n'était appelée que depuis `etatDeLEcran`, qui lui passait du texte DÉJÀ dégrisé :
  // un contrat tacite, invisible à la lecture. Le premier appelant du dehors — le refus posé
  // devant un dialogue, dans `naissance-representant/src/livraison.js` — a rendu un message
  // truffé de codes ANSI, illisible pour la personne à qui il s'adresse. Mesuré sur un vrai
  // pane le 2026-08-17, corrigé ici plutôt que chez l'appelant : le suivant aurait retrouvé
  // le même piège.
  const ESC = String.fromCharCode(27);
  const brut = `${ESC}[38;5;7m❯ 1. Yes${ESC}[0m\n${ESC}[38;5;9m  2. No${ESC}[0m`;
  const vu = resumeDeLEcran(brut);
  assert.doesNotMatch(vu, new RegExp(ESC), 'aucune séquence ne doit survivre');
  assert.match(vu, /❯ 1\. Yes/, 'le texte, lui, doit rester entier');
  assert.match(vu, /2\. No/);
});

test('LE RÉSUMÉ EST IDEMPOTENT — l’appelant d’origine ne change pas de comportement', () => {
  // `etatDeLEcran` lui passe déjà du texte dégrisé. Nettoyer deux fois doit rendre la même chose,
  // sinon ce correctif aurait déplacé le défaut au lieu de le fermer.
  const propre = '❯ 1. Yes\n  2. No';
  assert.equal(resumeDeLEcran(propre), resumeDeLEcran(resumeDeLEcran(propre)));
});

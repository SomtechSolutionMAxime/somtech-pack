// ecran.test.js — NOMMER UN ÉCRAN QU'ON NE RECONNAÎT PAS (T-20260816-0033).
//
// Les écrans ci-dessous sont RECOPIÉS DU VRAI, mesurés le 2026-08-16 sur Claude Code 2.1.233 en
// faisant naître un agent d'essai. Ce n'est pas de la fiction : un essai écrit de mémoire aurait
// prouvé que le module est d'accord avec l'idée qu'on se fait de l'écran, pas avec l'écran.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { etatDeLEcran, touchesPourFranchir, ECRANS_CONNUS } from '../src/ecran.js';

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

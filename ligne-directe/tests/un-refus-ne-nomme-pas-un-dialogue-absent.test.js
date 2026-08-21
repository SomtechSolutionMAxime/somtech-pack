// un-refus-ne-nomme-pas-un-dialogue-absent.test.js — UN REFUS NE NOMME JAMAIS UNE CAUSE
// QU'IL N'A PAS ÉTABLIE (T-20260821-0026, lot ⑤ de D-20260820-0002).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LE DÉFAUT, ET IL EST PIRE QU'UN SILENCE
//
// Le veilleur refusait de remettre un message sur une DISJONCTION de deux conditions :
//
//     if (ecranAttendUnChoix(ecran) || (ecran && !etatAvant.pretARecevoir)) { … }
//
// …et rendait UN SEUL message, qui affirmait dans les deux cas :
//
//     « <pane> est devant un écran qui attend un choix, pas un message […]
//       réponds au dialogue toi-même, puis renvoie ton message. »
//
// La SECONDE branche mord dès qu'un écran n'est pas reconnu — un shell, une bordure titrée,
// n'importe quelle forme neuve. **Aucun dialogue n'a alors été identifié**, et le refus en
// affirme un quand même.
//
// > **Un outil qui dit « je ne reconnais pas » est sain. Un outil qui dit « il attend un
// > choix » FABRIQUE UN FAIT.**
//
// ⚠️ ET LE FAUX MOTIF PRESCRIT UN GESTE IMPOSSIBLE. « Réponds au dialogue toi-même » a envoyé
// le dirigeant ET son orchestrateur chercher un écran qui n'existe pas. Le mode d'échec est le
// pire qui soit : le refus RESSEMBLE À DE LA PRUDENCE. L'émetteur lit un message rassurant,
// le destinataire ne sait pas qu'on lui parle, et personne ne voit rien.
//
// ⚠️ ON NE RETIRE PAS LE REFUS — on répare ce qu'il DIT. Le second essai ci-dessous garde la
// moitié qui protège : devant un VRAI dialogue, mesuré le 2026-08-17 comme faisant EXÉCUTER
// une commande, le refus doit continuer de nommer le dialogue et d'y envoyer.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SHELL_DETACHE, DIALOGUE_ACTIF, BOITE_VIDE } from './aide/ecrans-mesures.js';

let bac;
let pathOriginal;

/** Un faux herdr qui rend l'écran qu'on lui a déposé, et accepte tout le reste. */
function fauxHerdrQuiMontre(ecran) {
  const fichier = join(bac, 'ecran.txt');
  writeFileSync(fichier, ecran);
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const cmd = args.slice(0, 2).join(' ');
if (cmd === 'agent read' || cmd === 'pane read') {
  process.stdout.write(fs.readFileSync(${JSON.stringify(fichier)}, 'utf8'));
  process.exit(0);
}
if (cmd === 'agent get' || cmd === 'pane get') {
  process.stdout.write(JSON.stringify({ result: { agent: { agent_status: 'idle' }, pane: { pane_id: args[2] } } }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ result: { ok: true, type: 'agent_prompted', agent: { agent_status: 'idle' } } }));
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
}

before(() => {
  pathOriginal = process.env.PATH;
});
beforeEach(() => {
  bac = mkdtempSync(join(tmpdir(), 'ld-refus-'));
  process.env.PATH = `${bac}:${pathOriginal}`;
});
after(() => {
  process.env.PATH = pathOriginal;
  if (bac) rmSync(bac, { recursive: true, force: true });
});

/** Les mots qui AFFIRMENT un dialogue — ceux qu'un écran non reconnu ne doit jamais produire. */
const AFFIRME_UN_DIALOGUE = /attend un choix|réponds au dialogue|confirmerait l'action|confirmerait l’action/i;

test('UN ÉCRAN NON RECONNU, SANS AUCUN DIALOGUE — le refus ne doit pas en inventer un', async () => {
  fauxHerdrQuiMontre(SHELL_DETACHE);
  const { remettre } = await import(`../src/herdr.js?refus-inconnu-${Date.now()}`);

  let message = null;
  try {
    await remettre('w9:p1', 'allo');
    assert.fail('un écran non reconnu doit rester un REFUS — la garde ne se retire pas');
  } catch (err) {
    message = String(err.message);
  }

  // 🔴 L'ASSERTION QUI PORTE LE LOT. Sur cet écran, `ecranAttendUnChoix` rend `false` : aucun
  // dialogue n'a été identifié. Le refus n'a donc pas le droit d'en nommer un.
  assert.doesNotMatch(
    message,
    AFFIRME_UN_DIALOGUE,
    'aucun dialogue n’a été identifié sur cet écran — le refus ne peut pas en affirmer un, ' +
      'ni prescrire d’y répondre : c’est un geste sans objet'
  );
  // Et il doit dire ce qu'il SAIT : qu'il ne reconnaît pas, et ce qu'il a vu.
  assert.match(
    message,
    /ne reconnais pas|pas su lire|non reconnu/i,
    'un aveu d’ignorance est le verdict sain — il se vérifie, là où un mauvais motif se croit'
  );
});

test('UN VRAI DIALOGUE — la garde mesurée du 2026-08-17 reste entière', async () => {
  // ⚠️ LA MOITIÉ QU'ON NE DOIT PAS EMPORTER EN DÉMOLISSANT LE FAUX MOTIF. Devant
  // « Do you want to proceed? ❯ 1. Yes », un texte ordinaire envoyé par `agent prompt` a FAIT
  // EXÉCUTER la commande proposée : il n'a pas été reçu comme un message, il a servi de
  // CONFIRMATION. Ce refus-là doit continuer de nommer le dialogue et d'y envoyer.
  fauxHerdrQuiMontre(DIALOGUE_ACTIF);
  const { remettre } = await import(`../src/herdr.js?refus-dialogue-${Date.now()}`);

  try {
    await remettre('w9:p1', 'allo');
    assert.fail('un dialogue actif doit rester un refus — la touche y confirmerait une action');
  } catch (err) {
    assert.match(
      String(err.message),
      AFFIRME_UN_DIALOGUE,
      'devant un dialogue IDENTIFIÉ, le nommer est juste — c’est l’affirmer sans l’avoir vu qui ne l’est pas'
    );
  }
});

test('UNE BOÎTE ORDINAIRE ET VIDE — aucun refus, la parole passe', async () => {
  // ⚠️ LE CHIFFRE QU'ON OUBLIE : une garde qui refuse à tort rend la ligne du dirigeant
  // inutilisable — une panne PIRE, en fréquence, que celle qu'on ferme. Ce contrôle négatif
  // existe pour qu'un resserrement du refus ne se paie pas en faux refus.
  fauxHerdrQuiMontre(BOITE_VIDE);
  const { remettre } = await import(`../src/herdr.js?refus-vide-${Date.now()}`);
  await remettre('w9:p1', 'allo');
});

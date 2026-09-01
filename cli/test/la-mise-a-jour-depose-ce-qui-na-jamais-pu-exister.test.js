// la-mise-a-jour-depose-ce-qui-na-jamais-pu-exister.test.js — un fichier écrit à la main est
// PRÉSERVÉ quand il est là, et DÉPOSÉ VIERGE quand il ne l'a jamais été.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CES ESSAIS FERMENT, ET IL EST NÉ DU LOT QUI LES ÉCRIT (T-20260826-0042)
//
// `RONDE.md` a rejoint `PRESERVE` pour la raison qui gouverne cette liste : il porte le
// chantier de l'agent, pas le métier du pack, et une mise à jour ne doit jamais l'écraser.
//
// ⚠️ MAIS `PRESERVE` NE VEUT PAS DIRE « JAMAIS ÉCRASÉ » — IL VEUT DIRE, DEPUIS RA-REL-014,
// « JAMAIS TOUCHÉ, NI DANS UN SENS NI DANS L'AUTRE ». Les préservés sont retirés de la liste
// AVANT `applyFiles` : la seule porte d'écriture ne les voit jamais passer. Conséquence
// mesurée : `RONDE.md` n'aurait JAMAIS été déposé sur aucun des dix-huit lieux vivants —
// ni par la pose, qui refuse un lieu incomplet, ni par la mise à jour, qui ne crée pas un
// préservé. Le cinquième élément du cycle serait resté un correctif inerte, présent dans le
// dépôt et absent de la vie de tous les agents.
//
// LA DISTINCTION QUI TRANCHE, et elle n'est pas une exception de confort :
//
//   • `CONTEXTE.md` a TOUJOURS fait partie du gabarit. Absent d'un lieu, il SIGNALE une pose
//     partielle — c'est un symptôme, pas une occasion de le fabriquer (RA-REL-014). La pose
//     le refuse déjà par `lieu_partiel` ; le créer ici masquerait ce qu'elle attrape.
//   • `RONDE.md` n'existait pas. Absent, il ne signale rien : AUCUN lieu du parc n'a jamais
//     pu l'avoir. Le déposer vierge n'écrase rien et ne masque rien.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { run } from '../src/cli.js';
import { alignerLePosteSur } from './lib/poste-conforme.js';

const CLAUDE = '# Tu es le représentant de ce client\n\nle métier.\n';
const CONTEXTE_GABARIT = "# Ce qu'on sait de ce client\n\n| Le client | `<son nom>` |\n";
const RONDE_GABARIT = '# Le briefing de ta ronde\n\nécrit à la main.\n\n`<Ta cadence>`\n';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

function payloadAvecRonde() {
  const root = tmp('smtk-ronde-payload-');
  writeFileSync(join(root, 'pack.json'), JSON.stringify({
    name: 'fixture-pack', version: '9.9.9', modules: { core: { default: true, paths: ['.claude/'] } },
  }, null, 2));
  const gabarit = join(root, '.claude', 'templates', 'gestionnaire-client');
  mkdirSync(gabarit, { recursive: true });
  writeFileSync(join(gabarit, 'CLAUDE.md'), CLAUDE);
  writeFileSync(join(gabarit, 'CONTEXTE.md'), CONTEXTE_GABARIT);
  writeFileSync(join(gabarit, 'RONDE.md'), RONDE_GABARIT);
  alignerLePosteSur(root);
  return root;
}

/** Un lieu posé À L'ANCIENNE : le briefing n'existait pas quand il a été posé. */
function lieuAncien({ ronde = null } = {}) {
  const repo = tmp('smtk-ronde-client-');
  const l = join(repo, '.gestionnaire', 'acme');
  mkdirSync(l, { recursive: true });
  writeFileSync(join(l, 'CLAUDE.md'), '# Tu es le représentant de ce client\n\nvieux métier.\n');
  writeFileSync(join(l, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n\nAcme. Rempli à la main.\n");
  if (ronde !== null) writeFileSync(join(l, 'RONDE.md'), ronde);
  return { repo, lieu: l };
}

test('un lieu qui n’a jamais pu avoir de briefing le REÇOIT, vierge', async () => {
  const payload = payloadAvecRonde();
  const { repo, lieu } = lieuAncien();
  assert.ok(!existsSync(join(lieu, 'RONDE.md')), 'le fixture doit partir sans briefing, sinon il ne prouve rien');

  const code = await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);

  assert.equal(code, 0);
  assert.ok(existsSync(join(lieu, 'RONDE.md')), 'sans ça, le cinquième élément du cycle n’atteint aucun agent');
  assert.equal(readFileSync(join(lieu, 'RONDE.md'), 'utf8'), RONDE_GABARIT);
});

// ⚠️ LA MOITIÉ QUI PROTÈGE — sans elle, on aurait échangé un correctif inerte contre une
// perte : le briefing qu'un agent a rempli est ce qui le réveille.
test('un briefing DÉJÀ REMPLI n’est jamais écrasé par une mise à jour', async () => {
  const payload = payloadAvecRonde();
  const REMPLI = '# Le briefing de ta ronde\n\nCadence : 20 minutes. Chantier : P-20260819-0001.\n';
  const { repo, lieu } = lieuAncien({ ronde: REMPLI });

  const code = await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);

  assert.equal(code, 0);
  assert.equal(
    readFileSync(join(lieu, 'RONDE.md'), 'utf8'),
    REMPLI,
    'un briefing écrasé ne se voit pas : il se constate à ce que l’agent ne se réveille plus',
  );
});

// ⚠️ ET CE QUI NE CHANGE PAS. `CONTEXTE.md` absent reste un SYMPTÔME de pose partielle, jamais
// une occasion de le fabriquer (RA-REL-014). Le créer ici masquerait ce que la pose attrape.
test('un CONTEXTE.md absent n’est toujours PAS fabriqué — sa disparition est un symptôme', async () => {
  const payload = payloadAvecRonde();
  const { repo, lieu } = lieuAncien();
  const { rmSync } = await import('node:fs');
  rmSync(join(lieu, 'CONTEXTE.md'));

  await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);

  assert.ok(
    !existsSync(join(lieu, 'CONTEXTE.md')),
    'le fabriquer masquerait un lieu posé à demi, que la pose refuse par « lieu_partiel »',
  );
});

test('les deux listes disent chacune ce qu’elle garde, et ne se confondent pas', async () => {
  const { PRESERVE, CREE_SI_ABSENT } = await import('../src/commands/representant.js');
  assert.ok(PRESERVE.includes('CONTEXTE.md') && PRESERVE.includes('RONDE.md'), 'les deux sont préservés');
  assert.deepEqual(CREE_SI_ABSENT, ['RONDE.md'], 'un seul est déposé quand il manque');
  for (const f of CREE_SI_ABSENT) {
    assert.ok(PRESERVE.includes(f), `« ${f} » doit être préservé aussi — déposer sans protéger écraserait`);
  }
});

// ⚠️ SURVIVANTE RELEVÉE EN PASSE DE FOND : retirer `!aDeposer.has(rel)` du calcul de
// `report.preserved` laissait TOUTE la suite verte. Le rapport console annonçait alors
// « 🔒 préservés (écrits à la main, jamais écrasés) : RONDE.md » pour un fichier que la commande
// venait de DÉPOSER vierge. Rien sur le disque, mais un rapport qui ment sur ce qu'il a fait —
// et c'est par un rapport qu'on croit savoir ce qui s'est passé.
test('le rapport ne dit pas « préservé » d’un fichier qu’il vient de DÉPOSER', async () => {
  const payload = payloadAvecRonde();
  const { repo, lieu } = lieuAncien();
  const lignes = [];
  const vrai = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  try {
    await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);
  } finally { console.log = vrai; }

  const rapport = lignes.join('\n');
  const preserves = (rapport.match(/préservés[^\n]*/) || [''])[0];
  assert.ok(
    !preserves.includes('RONDE.md'),
    `« RONDE.md » vient d’être déposé, pas préservé — le rapport dit : ${preserves}`,
  );
  assert.ok(rapport.includes('RONDE.md'), 'il doit tout de même être annoncé — parmi les créés');
  assert.ok(existsSync(join(lieu, 'RONDE.md')));
});

// La moitié qui protège : un briefing DÉJÀ là est bien annoncé comme préservé.
test('le rapport dit « préservé » d’un briefing qui était déjà là', async () => {
  const payload = payloadAvecRonde();
  const { repo } = lieuAncien({ ronde: '# Le briefing de ta ronde\n\nUn tour par heure.\n' });
  const lignes = [];
  const vrai = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  try {
    await run(['representant-update', '--client', 'acme', '--source', payload, '--target', repo]);
  } finally { console.log = vrai; }

  const preserves = (lignes.join('\n').match(/préservés[^\n]*/) || [''])[0];
  assert.ok(preserves.includes('RONDE.md'), `il était là et n’a pas bougé — dit : ${preserves}`);
});

// UNE INSTALLATION DU PACK LAISSE L'ARRÊT DE SOUMISSION EN PLACE (D-20260921-0003)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE FICHIER FERME
//
// Le 2026-09-21, sur ordre du dirigeant (« je veux que ça cesse »), deux dispositifs qui soumettaient
// la boîte de saisie d'un autre ont été arrêtés À LA MAIN dans `~/.somtech/ligne-directe/src/` —
// une ligne commentée dans `veilleur.js`, un `return` inséré dans `delivrance.js`. Ces correctifs
// étaient LOCAUX : la prochaine installation du pack les écrasait et rallumait les deux mécanismes.
// Deux lots déjà fusionnés sur `main` ne pouvaient plus être installés à cause de ça.
//
// ⚠️ CE BANC N'ÉPROUVE PAS LA PRÉSENCE DU CODE. Il SIMULE l'installation — la vraie fonction
// (`installPosteModules`), depuis le dépôt, vers un faux poste — sur un poste qui porte l'ANCIEN code
// (celui qui soumet), puis interroge l'ÉTAT APRÈS : le module INSTALLÉ, importé depuis le faux poste,
// est mis en face d'une boîte pleine. Lire le dépôt prouverait ce que le dépôt dit ; ce qui compte est
// ce que le poste fait une fois installé.
//
// ⚠️ ET LE REFUS DOIT DIRE POURQUOI. Une installation qui laisserait l'arrêt muet rendrait le défaut
// que ce lot combat : un dispositif qui ne fait rien et ne le dit pas. On vérifie donc AUSSI que le
// journal du balayeur installé nomme la cause.
//
// Isolation : aucun test ne touche le vrai `~/.somtech` — le poste est un dossier jetable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { installPosteModules } from '../src/posteonly.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEXTE = 'un texte coincé que son auteur a laissé';
const ecran = (t) => ['x', '─'.repeat(40), `❯ ${t}`, '─'.repeat(40)].join('\n');

/** L'ANCIEN code, tel qu'il tournait avant l'arrêt : la garde retournée. C'est ce qu'un poste en retard porte. */
function ancienneDelivrance() {
  const src = readFileSync(join(REPO, 'ligne-directe', 'src', 'delivrance.js'), 'utf8');
  const ancien = src.replace(
    /export const SOUMISSION_DE_LA_BOITE_DAUTRUI_AUTORISEE = false;/,
    'export const SOUMISSION_DE_LA_BOITE_DAUTRUI_AUTORISEE = true;'
  );
  assert.notEqual(ancien, src, 'le banc ne sait plus fabriquer l’ancien code — la constante a bougé');
  return ancien;
}

/**
 * Un poste qui porte l'ancien code, sous la forme qu'un poste réel porte : un `~/.somtech` DÉJÀ
 * INSTALLÉ (tout le module, ses dépendances comprises), dont `delivrance.js` est celui qui soumet.
 */
function posteEnRetard() {
  const poste = mkdtempSync(join(tmpdir(), 'smtk-arret-soumission-'));
  installPosteModules({ payloadRoot: REPO, toolsDir: poste, force: true });
  writeFileSync(join(poste, 'ligne-directe', 'src', 'delivrance.js'), ancienneDelivrance());
  return poste;
}

async function delivrerSurLePoste(poste) {
  const { delivrerLaBoite } = await import(`${pathToFileURL(join(poste, 'ligne-directe', 'src', 'delivrance.js')).href}?t=${Date.now()}${Math.random()}`);
  const touches = [];
  const resultat = await delivrerLaBoite({
    texteCoince: TEXTE,
    commandes: { lireEcran: ['read'], soumettre: ['send-keys', 'Enter'] },
    appelHerdr: async (cmd) => {
      touches.push(cmd);
      return { ok: true };
    },
    // La boîte se vide une fois la touche partie : c'est ce que fait une vraie soumission.
    lireEcran: async () => ecran(touches.length ? '' : TEXTE),
    dormir: async () => {},
    immobiliteMs: 6000,
    essais: 1,
  });
  return { touches, resultat };
}

test('SANITÉ DU BANC — le poste en retard SOUMET : sans ça, « il ne soumet plus » ne prouverait rien', async () => {
  const poste = posteEnRetard();
  try {
    const { touches, resultat } = await delivrerSurLePoste(poste);
    assert.ok(touches.length > 0, 'le poste en retard devait soumettre — le banc ne mesure plus l’ancien comportement');
    assert.equal(resultat.soumis, true);
  } finally {
    rmSync(poste, { recursive: true, force: true });
  }
});

for (const force of [true, false]) {
  test(`APRÈS UNE INSTALLATION (force=${force}) sur un poste en retard, la boîte d’autrui n’est plus soumise — refus nommé`, async () => {
    const poste = posteEnRetard();
    try {
      const rapport = installPosteModules({ payloadRoot: REPO, toolsDir: poste, force });
      assert.ok(rapport.modules.includes('ligne-directe'), `ligne-directe n’a pas été installée : ${JSON.stringify(rapport.modules)}`);

      const { touches, resultat } = await delivrerSurLePoste(poste);
      assert.equal(touches.length, 0, `la touche d’envoi est partie APRÈS l’installation : ${JSON.stringify(touches)}`);
      assert.equal(resultat.soumis, false);
      assert.equal(resultat.cause, 'soumission-interdite', `cause rendue par le poste installé : ${resultat.cause}`);
    } finally {
      rmSync(poste, { recursive: true, force: true });
    }
  });
}

test('APRÈS INSTALLATION, le balayeur installé arme toujours son tour ET le journal dit pourquoi rien n’est parti', async () => {
  const poste = posteEnRetard();
  try {
    installPosteModules({ payloadRoot: REPO, toolsDir: poste, force: true });
    const src = join(poste, 'ligne-directe', 'src');

    // Le fil n'est pas coupé : `v.balayer()` est actif (le geste local d'origine le commentait, ce qui
    // tuait AUSSI la relance des messages gardés, sans le dire).
    const veilleur = readFileSync(join(src, 'veilleur.js'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    assert.match(veilleur, /\bv\.balayer\(\);/, 'le poste installé n’arme plus le balayeur');

    const url = (f) => `${pathToFileURL(join(src, f)).href}?t=${Date.now()}${Math.random()}`;
    const { delivrerLaBoite, TOURS_DIMMOBILITE_EXIGES } = await import(url('delivrance.js'));
    const { unTourDeBalayage } = await import(url('balayage.js'));

    const touches = [];
    const journal = [];
    const pane = 'w1:p1';
    const rendu = await unTourDeBalayage({
      agents: [{ pane, nom: 'a' }],
      lireEcran: async () => ecran(TEXTE),
      delivrer: ({ texteCoince, immobiliteMs }) =>
        delivrerLaBoite({
          texteCoince,
          immobiliteMs,
          commandes: { lireEcran: ['read'], soumettre: ['send-keys', 'Enter'] },
          appelHerdr: async (c) => (touches.push(c), { ok: true }),
          lireEcran: async () => ecran(TEXTE),
          dormir: async () => {},
          essais: 1,
        }),
      memoire: new Map([[pane, { texte: TEXTE, tours: TOURS_DIMMOBILITE_EXIGES - 1, depuis: 0 }]]),
      maintenant: 600_000,
      journaliser: (l) => journal.push(l),
    });
    assert.equal(touches.length, 0, 'le balayeur installé a fait partir une touche d’envoi');
    assert.equal(rendu.debloques.length, 0);
    assert.ok(
      journal.some((l) => /NON DÉLIVRÉ/.test(l) && /soumission-interdite/.test(l)),
      `le journal du poste installé doit dire POURQUOI rien n’est parti — reçu : ${JSON.stringify(journal)}`
    );
  } finally {
    rmSync(poste, { recursive: true, force: true });
  }
});

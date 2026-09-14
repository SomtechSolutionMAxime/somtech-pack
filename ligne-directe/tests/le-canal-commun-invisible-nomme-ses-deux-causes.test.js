// le-canal-commun-invisible-nomme-ses-deux-causes.test.js — le voisin de T-20260806-0197.
//
// LE DÉFAUT, MESURÉ LE 2026-09-14 SUR LE DOUBLE CONFORME (a2ecb90) : `designerCommun` rendait,
// pour un canal PRIVÉ où notre robot n'est pas invité, `{ motif: 'absent', erreur: « aucun canal
// #… dans cet espace » }`. Slack ne montre au robot aucun canal privé dont il n'est pas membre :
// le canal existe, et le refus AFFIRMAIT le contraire — il envoyait le faire créer au lieu d'y
// faire inviter le robot. `verifierCanalJoignable` (représentant) avait déjà été corrigé ; la
// désignation du canal commun, non : une porte sur deux.
//
// Le robot ne peut pas départager les deux causes. Le refus juste les porte TOUTES DEUX, en faits
// (`causes`, `gestes`) — la même forme que `verifierCanalJoignable` — et son texte n'affirme plus
// l'inexistence. Contre-épreuve : le même canal AVEC le robot est désigné.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxSlack } from './aide/faux-slack.js';

let Veilleur, sauverRegistre, verifierCanalJoignable;
let racine;
let compteur = 0;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-commun-invisible-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre } = await import('../src/registre.js'));
  ({ verifierCanalJoignable } = await import('../src/representant.js'));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [], communs: {}, commun: null }));

const veilleur = () =>
  new Veilleur({
    cheminSocket: join(racine, `${(compteur += 1)}.sock`),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
  });

async function avecSlack(etat, corps) {
  const monde = fauxSlack(etat).installer();
  try {
    return await corps(monde);
  } finally {
    monde.restaurer();
  }
}

const PRIVE = { id: 'C_ANN', name: 'annonces-agents', is_private: true };

test('canal PRIVÉ sans le robot : le refus porte les deux causes et les deux gestes, et n’affirme pas l’inexistence', async () => {
  await avecSlack({ canaux: [{ ...PRIVE, membres: ['UDIR'] }], robot: 'UMOI' }, async () => {
    const r = await veilleur().designerCommun({ canal: 'annonces-agents', role: 'orchestrateur', autorises: ['UDIR'] });
    assert.equal(r.ok, false);
    assert.equal(r.motif, 'absent', 'la clé lue par les appelants reste celle que le robot voit');
    assert.deepEqual(r.causes, ['absent', 'prive_sans_robot']);
    assert.deepEqual(r.gestes, ['corriger_ou_faire_creer', 'invitation_humaine']);
    assert.notEqual(r.erreur, 'aucun canal #annonces-agents dans cet espace', 'le refus affirme encore, seul, que le canal n’existe pas');
    assert.match(r.erreur, /privé/, 'la cause « canal privé sans le robot » n’est pas nommée');
    assert.match(r.erreur, /invit/, 'le geste d’invitation n’est pas nommé');

    // LA MÊME FORME que le représentant — mesurée, pas recopiée.
    const j = await verifierCanalJoignable('xoxb-x', 'annonces-agents');
    assert.deepEqual({ causes: r.causes, gestes: r.gestes }, { causes: j.causes, gestes: j.gestes });
  });
});

test('contre-épreuve : le même canal privé AVEC le robot est désigné', async () => {
  await avecSlack({ canaux: [{ ...PRIVE, membres: ['UDIR', 'UMOI'] }], robot: 'UMOI' }, async () => {
    const r = await veilleur().designerCommun({ canal: 'annonces-agents', role: 'orchestrateur', autorises: ['UDIR'] });
    assert.equal(r.ok, true, r.erreur);
  });
});

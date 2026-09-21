// un-refus-du-veilleur-porte-sa-cause.test.js — T-20260914-0004.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE BANC FERME
//
// `hook.js` avalait TOUTE exception de son sondage en `naturesOuvertes = []` : un veilleur
// en panne et une ligne jamais ouverte tombaient dans le MÊME état, et le garde d'ouverture
// appliquait la même branche — « n'ouvre aucune de tes lignes ». Distinguer les deux exige un
// fait STABLE sur l'erreur, pas un `.match()` sur un message en français qui peut changer de
// mot sans changer de cause.
//
// Ce fichier éprouve que les TROIS constructeurs d'erreur du veilleur posent bien leur `code`,
// SÉPARÉMENT — sans code, `hook.js` ne peut rien classer, et retombe silencieusement sur
// « cause inconnue ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refusSansReponse, parler } from '../src/client.js';

// ═════════════ le veilleur ne répond plus DU TOUT — le ping lui-même reste sans réponse

test('refusSansReponse({vivant:false}) porte VEILLEUR_MUET', () => {
  const err = refusSansReponse({ geste: 'etat', ms: 300, vivant: false });
  assert.equal(err.code, 'VEILLEUR_MUET');
  // Le message ne change pas de mot : ce lot AJOUTE un code, il ne réécrit rien.
  assert.match(err.message, /NE RÉPOND PLUS/);
});

// ═════════════ le veilleur répond au ping, mais pas au geste dans sa borne — il est VIVANT

test('refusSansReponse({vivant:true}) porte VEILLEUR_LENT', () => {
  const err = refusSansReponse({ geste: 'vue', ms: 84_400, vivant: true });
  assert.equal(err.code, 'VEILLEUR_LENT');
  assert.match(err.message, /EST VIVANT/);
});

// ═════════════ le veilleur n'a jamais décroché du tout — troisième fait, distinct des deux

test(
  'parler() dont le veilleur ne démarre jamais porte VEILLEUR_NE_DEMARRE_PAS',
  { timeout: 15_000 },
  async () => {
    const racine = mkdtempSync(join(tmpdir(), 'ld-code-demarre-'));
    try {
      // ⚠️ `naitre` NE FAIT RIEN, DÉLIBÉRÉMENT — un vrai réveil ferait naître un vrai processus,
      // c'est-à-dire toucher au poste. Le socket n'apparaîtra donc JAMAIS, et `parler()` épuise
      // ses 40 essais de 250 ms (la boucle de retry est en dur dans `parler`, non injectable :
      // ce test mesure le VRAI délai de production, pas un raccourci).
      await assert.rejects(
        () =>
          parler(
            { geste: 'etat' },
            {
              cheminSocket: join(racine, 'jamais-cree.sock'),
              reveiller: true,
              naitre: () => {},
            }
          ),
        (err) => {
          assert.equal(err.code, 'VEILLEUR_NE_DEMARRE_PAS');
          assert.match(err.message, /n'a pas démarré en 10s/);
          return true;
        }
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  }
);

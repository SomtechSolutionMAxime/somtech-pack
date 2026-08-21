// les-trois-canaux-jugent-le-meme-ecran.test.js — UNE SEULE SONDE, ET C'EST LA PREUVE QUI LE
// DIT (T-20260821-0027, lot ① de D-20260820-0002).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 TROIS CANAUX ÉCRIVENT DANS LA BOÎTE D'UN AGENT, ET ILS JUGEAIENT SÉPARÉMENT
//
//   • `livrer.js` — le brief qu'un coordonnateur remet à son chef d'équipe ;
//   • le veilleur `ligne-directe` — **la parole du DIRIGEANT**, arrivée de Slack ;
//   • `gestionnaire-etat-boite` — le diagnostic qu'un orchestrateur tape à chaque ronde.
//
// Ils importent bien le même `boite.js`. Mais chacun RECOMPOSE son verdict : l'un lit
// `contenuBoite`, l'autre `etatDeLaBoite`, le troisième croise `etatDeLEcran`. Rien ne
// garantissait qu'ils disent la même chose du même écran — et le 2026-08-21 ils ne le
// disaient pas : `gestionnaire-etat-boite` rendait `illisible` sur `w0:p25` à l'instant même
// où `livrer.js` y livrait un brief avec succès.
//
// 🔴 ET LA SONDE DE FILET VIVAIT EN DEUX EXEMPLAIRES — `boite.js` et `ecran.js`, ce dernier
// commentant lui-même « même sonde que `boite.js` ». **Une copie n'hérite jamais des
// corrections de l'autre.** Guérir la bordure titrée dans `boite.js` seulement laissait le
// veilleur aveugle — c'est-à-dire laissait fermé le chemin par lequel arrive la parole du
// dirigeant, celui-là même qui a motivé tout le chantier. C'est « une porte sur deux », le
// motif le plus cher de ce dépôt, commis DANS le correctif d'un défaut de cette famille.
//
// ⚠️ CE BANC N'EXIGE PAS QUE LES TROIS RENDENT LE MÊME OBJET — ils n'ont pas le même métier.
// Il exige qu'ils s'accordent sur les deux faits dont dépend le geste : **ai-je su lire cette
// boîte**, et **y a-t-il quelque chose à ne pas écraser**.

import test from 'node:test';
import assert from 'node:assert/strict';

import { etatDeLaBoite, ETATS_BOITE, riensASoumettre, contenuBoite } from '../../ligne-directe/src/boite.js';
import { etatDeLEcran, ecranAttendUnChoix } from '../../ligne-directe/src/ecran.js';
import { causeObstacle, CAUSES } from '../src/livraison.js';
import {
  BORDURE_TITREE,
  SUGGESTION_GRISEE,
  BOITE_VIDE,
  BOITE_PLEINE,
  SHELL_DETACHE,
  DIALOGUE_ACTIF,
} from '../../ligne-directe/tests/aide/ecrans-mesures.js';

/** Ce que chaque canal conclut de l'écran, ramené aux deux faits qui commandent le geste. */
const CANAUX = {
  'gestionnaire-etat-boite': (ecran) => {
    const vu = etatDeLaBoite(ecran);
    return { luBoite: vu.etat !== ETATS_BOITE.ILLISIBLE, aEcraser: !riensASoumettre(vu.etat) && vu.etat !== ETATS_BOITE.ILLISIBLE };
  },
  'livrer.js': (ecran) => {
    const cause = causeObstacle(ecran, 'idle', { parLePane: true });
    return { luBoite: cause !== CAUSES.ILLISIBLE, aEcraser: cause === CAUSES.ENCOMBREE };
  },
  'veilleur ligne-directe': (ecran) => {
    // Le veilleur lit l'écran ENTIER (`etatDeLEcran`) puis la boîte (`contenuBoite`). Sa
    // question « ai-je su lire la boîte » est celle que `horsBoite` tranche.
    const reste = contenuBoite(ecran);
    return { luBoite: reste !== null && etatDeLEcran(ecran).pretARecevoir, aEcraser: reste !== null && reste !== '' };
  },
};

/** Les écrans réels, et ce que les trois doivent en dire — la lisibilité d'abord. */
const ATTENDU = [
  ['la bordure titrée d’une session rattachée', BORDURE_TITREE, { luBoite: true, aEcraser: false }],
  ['une suggestion grisée', SUGGESTION_GRISEE, { luBoite: true, aEcraser: false }],
  ['une boîte franchement vide', BOITE_VIDE, { luBoite: true, aEcraser: false }],
  ['une boîte pleine (texte collé)', BOITE_PLEINE, { luBoite: true, aEcraser: true }],
  ['un shell détaché, sans boîte Claude Code', SHELL_DETACHE, { luBoite: false, aEcraser: false }],
];

for (const [quoi, ecran, attendu] of ATTENDU) {
  test(`LES TROIS CANAUX S’ACCORDENT — ${quoi}`, () => {
    const vus = Object.fromEntries(Object.entries(CANAUX).map(([n, f]) => [n, f(ecran)]));
    for (const [nom, vu] of Object.entries(vus)) {
      assert.equal(
        vu.luBoite,
        attendu.luBoite,
        `« ${nom} » diverge sur la LISIBILITÉ — verdicts : ${JSON.stringify(vus)}`
      );
      assert.equal(
        vu.aEcraser,
        attendu.aEcraser,
        `« ${nom} » diverge sur CE QU'IL Y A À NE PAS ÉCRASER — verdicts : ${JSON.stringify(vus)}`
      );
    }
  });
}

test('COUPER LA SONDE — aucun des trois ne conclut d’une absence de mesure', () => {
  // ⚠️ UN ESSAI QUI COUVRE L'ABSENCE PASSE PARFAITEMENT PENDANT QUE LA MESURE EST AVEUGLE. On
  // fait donc échouer la lecture elle-même — c'est ce que rend `lireEcran` quand herdr refuse —
  // et on exige des trois que leur verdict DIFFÈRE de « boîte vide », le seul qui autorise à
  // écrire.
  for (const rien of [null, undefined, '']) {
    for (const [nom, f] of Object.entries(CANAUX)) {
      assert.equal(f(rien).luBoite, false, `« ${nom} » doit refuser de conclure d’une lecture qui n’a pas eu lieu`);
    }
  }
});

test('UN DIALOGUE ACTIF EST VU PAR TOUS CEUX QUI ÉCRIVENT — la garde du 2026-08-17 ne se perd pas', () => {
  // ⚠️ CELUI-LÀ EST À PART, et c'est délibéré : sa boîte est parfaitement LISIBLE et VIDE.
  // Ce n'est donc pas la lisibilité qui l'arrête, mais le dialogue posé par-dessus — et un
  // canal qui ne regarderait que la boîte y écrirait, ce qui CONFIRMERAIT l'action affichée
  // (mesuré : un `agent prompt` ordinaire a fait exécuter la commande proposée).
  assert.equal(ecranAttendUnChoix(DIALOGUE_ACTIF), true, 'le dialogue doit être identifié');
  assert.equal(
    causeObstacle(DIALOGUE_ACTIF, 'idle', { parLePane: true }),
    CAUSES.DIALOGUE,
    '`livrer.js` doit refuser sur le DIALOGUE, pas sur un effet de bord'
  );
  // Et la boîte, elle, est bel et bien lisible et vide : c'est ce qui rend ce cas dangereux.
  assert.equal(etatDeLaBoite(DIALOGUE_ACTIF).etat, ETATS_BOITE.VIDE);
});

test('LA SONDE DE FILET N’EXISTE QU’EN UN EXEMPLAIRE — le prouver, pas l’affirmer', async () => {
  // ⚠️ « AUCUNE DÉTECTION NE SUBSISTE AILLEURS » SE PROUVE PAR RECHERCHE. Une copie ne se voit
  // pas à la lecture : elle se voit le jour où l'une est corrigée et pas l'autre.
  const { readFileSync } = await import('node:fs');
  const { dirname, join, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  for (const f of ['ligne-directe/src/ecran.js', 'ligne-directe/src/boite.js']) {
    const src = readFileSync(join(racine, f), 'utf8');
    const definitions = (src.match(/^const FILET\s*=/gm) ?? []).length;
    assert.ok(
      definitions <= (f.endsWith('boite.js') ? 1 : 0),
      `« ${f} » redéfinit la sonde de filet — une copie n’hérite jamais des corrections de l’autre`
    );
  }
});

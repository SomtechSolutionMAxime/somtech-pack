// un-mandat-clos-ne-se-reveille-plus.test.js
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260819-0056)
//
// La ronde réveille tout orchestrateur VIVANT dont le lieu porte le métier. Rien ne lui dit
// qu'un MANDAT est terminé. Un orchestrateur fermé qui laisse sa session ouverte continue donc
// d'être réveillé — et le risque n'est pas le gaspillage, c'est la COLLISION : deux
// orchestrateurs qui soumettent des boîtes en parallèle sur les mêmes panes, sans se voir.
//
// 🔴 LE DÉFAUT EST VIVANT, MESURÉ LE 2026-09-20 SUR CE POSTE, pas repris du ticket. La ronde
// réveille 13 orchestrateurs ; l'un d'eux — `portneuf`, lieu `.orchestrateur/d-20260819-0002` —
// tourne sur une demande dont le ServiceDesk dit `delivered`, donc CLOSE.
//
// ⚠️ ET ON NE FABRIQUE PAS UN SECOND LECTEUR. `etatDuMandat` existe, et le recensement s'en
// sert déjà (`ligne-directe/src/recensement.js`). Deux copies d'un même critère ne se jugent pas
// sur « sont-elles justes » mais sur « rendent-elles le MÊME verdict sur les mêmes entrées ».
// Mesuré sur les 13 orchestrateurs réels, verdict `clos` comparé un à un : **ACCORD 13/13**.
// La ronde emploie donc les deux mêmes fonctions, IMPORTÉES — `lieuDeRoleDansLeChemin` pour
// résoudre le mandat, `etatDuMandat` pour lire son état.
//
// ⚠️ TROIS DES TREIZE RENDENT « NON MESURÉE », ET C'EST LE CAS QUI DÉCIDE DU DÉFAUT PAR DÉFAUT :
//   • `j-20260814-0001-bis` (mingan) — le lieu ne porte pas un code de chantier : le suffixe
//     `-bis` le sort de la forme. Un résolveur qui « corrigerait » ça devinerait.
//   • `p-20260522-0001` et `p-20260601-0094` — ⚠️ CES DEUX-LÀ NE SONT PLUS DANS CE CAS. Leur
//     projet était au-delà de la première page d'un lecteur qui n'en lisait qu'une ; depuis
//     qu'il PAGINE, ils se lisent. **Cette phrase a menti : elle a survécu à la correction du
//     mécanisme qu'elle invoquait, dans le lot même qui l'a corrigé — et rien ne pouvait la
//     faire rougir, puisque aucune assertion ne dépend de ces deux codes.** Il ne reste donc
//     qu'UN cas « non mesurée » sur les 13.
// Dans les trois cas : **on RÉVEILLE, et on DIT qu'on n'a pas pu mesurer.** Taire un « je ne
// sais pas » en le rangeant du côté « rien à signaler » est le défaut que tout ce jalon combat ;
// et ne pas réveiller sur une mesure ratée couperait un orchestrateur vivant en silence.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const LIEU = '/depot/.orchestrateur/d-20260819-0002';
const AUTRE = '/depot/.orchestrateur/p-20260920-0001';
const SANS_CODE = '/depot/.orchestrateur/j-20260814-0001-bis';

const vivant = (pane, repertoire, nom) => ({ pane, repertoire, nom, enregistrementEnCours: false });

test('UN MANDAT CLOS SORT DE LA LISTE DES RÉVEILS, ET IL EST NOMMÉ', async () => {
  const { avecLetatDuMandat } = await import('../src/rendez-vous.js');

  const vus = await avecLetatDuMandat([vivant('w8:p9', LIEU, 'portneuf'), vivant('w9:p1', AUTRE, 'chicoutimi')], {
    lireLetat: async (m) =>
      m === 'd-20260819-0002'
        ? { mesure: 'lue', clos: true, statut: 'delivered', code: 'D-20260819-0002' }
        : { mesure: 'lue', clos: false, statut: 'in_progress', code: 'P-20260920-0001' },
  });

  const clos = vus.filter((v) => v.chantier.clos === true);
  assert.equal(clos.length, 1, 'le mandat clos est reconnu');
  assert.equal(clos[0].nom, 'portneuf', 'et c’est le bon — on ne coupe pas le voisin');
  assert.equal(clos[0].chantier.code, 'D-20260819-0002', 'le refus doit pouvoir NOMMER le chantier');
  assert.equal(vus.find((v) => v.nom === 'chicoutimi').chantier.clos, false, 'le mandat ouvert reste réveillé');
});

test('UN MANDAT QU’ON N’A PAS PU MESURER FAIT RÉVEILLER QUAND MÊME — et la RAISON survit', async () => {
  const { avecLetatDuMandat } = await import('../src/rendez-vous.js');

  // ⚠️ LE DÉFAUT PAR DÉFAUT EST « JE NE SAIS PAS », JAMAIS « RIEN À VOIR ICI ». Se taire ici
  // couperait un orchestrateur vivant sur une mesure ratée, en silence — et un « je ne sais
  // pas » rangé du côté du succès est exactement le motif de tout ce jalon.
  const vus = await avecLetatDuMandat([vivant('w8Z:pK', SANS_CODE, 'mingan')], {
    lireLetat: async () => ({
      mesure: 'non mesurée',
      clos: null,
      raison: '« j-20260814-0001-bis » n’est pas un code de chantier : son état ne se lit nulle part',
    }),
  });

  assert.equal(vus[0].chantier.clos, null, '`clos` n’est JAMAIS faux par défaut');
  assert.notEqual(vus[0].chantier.clos, true, 'donc il n’est pas écarté du réveil');
  assert.match(vus[0].chantier.raison, /n’est pas un code de chantier/, 'et la raison arrive entière jusqu’à l’appelant');
});

test('RIEN N’EST MÉMORISÉ — un mandat ROUVERT est réveillé de nouveau', async () => {
  const { avecLetatDuMandat } = await import('../src/rendez-vous.js');

  // ⚠️ LE MANDAT CHANGE D'ÉTAT PLUSIEURS FOIS, PAS UNE. `batiscan` a été fermé le 19 août puis
  // ROUVERT le 20 — et le service n'a rien su des deux. Une solution qui ne gère que la
  // fermeture laisserait un agent rouvert hors des rondes : le défaut symétrique, et il serait
  // plus silencieux que celui-ci. On ne stocke donc RIEN : on relit à chaque passage.
  const agents = [vivant('w26:p31', '/depot/.orchestrateur/j-20260814-0002', 'batiscan')];
  let ferme = true;
  const lireLetat = async () => ({ mesure: 'lue', clos: ferme, statut: ferme ? 'cancelled' : 'in_progress' });

  const avant = await avecLetatDuMandat(agents, { lireLetat });
  assert.equal(avant[0].chantier.clos, true, 'fermé : pas de réveil');

  ferme = false;
  const apres = await avecLetatDuMandat(agents, { lireLetat });
  assert.equal(apres[0].chantier.clos, false, 'rouvert : le réveil revient, sans qu’on ait rien à désinscrire');
});

test('LE MANDAT EST RÉSOLU PAR LE MÊME RÉSOLVEUR QUE LE RECENSEMENT — pas par une seconde copie', async () => {
  const { avecLetatDuMandat } = await import('../src/rendez-vous.js');
  const { lieuDeRoleDansLeChemin } = await import('../../ligne-directe/src/recensement.js');

  // ⚠️ C'EST L'EXIGENCE POSÉE AVANT D'ÉCRIRE UNE LIGNE : deux copies d'un même critère ne se
  // jugent pas sur « sont-elles justes » mais sur « rendent-elles le même verdict sur les mêmes
  // entrées ». On n'en garde donc qu'UNE, et cet essai prouve que la ronde interroge bien
  // celle-là — en comparant ce qu'elle passe au lecteur avec ce que le résolveur canonique rend.
  const cas = [LIEU, AUTRE, SANS_CODE, '/depot/pas-un-lieu'];
  const demandes = [];
  await avecLetatDuMandat(
    cas.map((r, i) => vivant(`w1:p${i}`, r, `a${i}`)),
    { lireLetat: async (m) => { demandes.push(m); return { mesure: 'lue', clos: false }; } }
  );

  const attendu = cas.map((r) => lieuDeRoleDansLeChemin(r)?.mandat ?? null).filter(Boolean);
  assert.deepEqual(demandes, attendu, 'la ronde interroge exactement les mandats que le résolveur canonique rend');
  assert.equal(attendu.includes('j-20260814-0001-bis'), true, 'y compris celui qui n’a pas la forme d’un code');
});

test('UN CHEMIN QUI NE PORTE AUCUN LIEU N’INTERROGE PERSONNE — et il le dit', async () => {
  const { avecLetatDuMandat } = await import('../src/rendez-vous.js');

  let appele = 0;
  const vus = await avecLetatDuMandat([vivant('w1:p1', '/depot/ailleurs', 'x')], {
    lireLetat: async () => { appele += 1; return { mesure: 'lue', clos: true }; },
  });

  assert.equal(appele, 0, 'on n’invente pas un mandat pour pouvoir le lire');
  assert.equal(vus[0].chantier.clos, null, 'et surtout on ne le déclare pas clos — il serait coupé pour rien');
  assert.match(vus[0].chantier.raison ?? '', /lieu|mandat/i, 'la cause est dite');
});

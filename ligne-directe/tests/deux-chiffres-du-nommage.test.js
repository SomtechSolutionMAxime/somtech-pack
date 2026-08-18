// LES DEUX CHIFFRES DE LA GARDE DE NOMMAGE — ce qu'elle attrape, et ce qu'elle refuse à tort.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI DEUX CHIFFRES, ET PAS UN
//
// Une garde ne se juge pas sur ce qu'elle attrape. **Une garde qui crie sur du texte correct
// ne survit pas** : le premier qui la rencontre la « corrige » en la retirant, et elle emporte
// avec elle tout ce qu'elle gardait vraiment. Le dépôt l'a déjà établi pour les gardes du
// métier (`cli/test/orchestrateur-faux-positifs.test.js`, T-20260817-0082) ; la garde de
// nommage se juge de la même façon, et par le même moyen : **un banc dans le dépôt, pas un
// chiffre dans un compte rendu.** Un chiffre que personne d'autre ne peut refaire n'est pas
// une mesure.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ LE PARC EST FIGÉ, ET C'EST LA CONDITION DE LA MESURE. Interroger `herdr agent list` ici
// ferait dépendre le verdict de l'état du poste qui exécute la suite — vert chez l'un, rouge
// chez l'autre, exactement ce que le lot A a payé. Le relevé vit donc dans
// `fixtures-parc-des-noms.json`, avec sa date et sa méthode.
//
// ⚠️ ET LE PÉRIMÈTRE COMPTE AUTANT QUE LE CHIFFRE. La garde ne juge QUE les naissances
// d'orchestrateur (`nomDeLAgentQuiNait` rend le nom du lieu pour tout autre rôle). Compter
// « 36 refusés sur 40 » sans le dire ferait passer pour une prise ce qui n'est même pas jugé.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { jugerNomDOrchestrateur, nomDeLAgentQuiNait } from '../src/nom-de-riviere.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const PARC = JSON.parse(readFileSync(join(ICI, 'fixtures-parc-des-noms.json'), 'utf8'));

/** Un code de mandat au sens Somtech — `d-`, `p-`, `j-`, `e-`, `t-` suivi de la date et du rang. */
const CODE_DE_MANDAT = /^[a-z]-\d{8}-\d{4}$/;

const refuses = PARC.noms.filter((n) => !jugerNomDOrchestrateur(n).conforme);
const acceptes = PARC.noms.filter((n) => jugerNomDOrchestrateur(n).conforme);

// ═══════════════ CHIFFRE 1 — CE QU'ELLE ATTRAPE

test('PREMIER CHIFFRE — les noms hors convention du parc sont TOUS attrapés', () => {
  // Ceux qui ne relèvent d'aucune des deux règles : ni rivière, ni code de mandat. C'est la
  // population que ce lot existe pour empêcher — `orchestrateur` est un rôle que tous
  // pourraient porter, `e-0004-reprise` un nom raccordé à rien dont on ne remonte à aucun
  // chantier (comme `rev-pr31`, relevé le même jour et disparu depuis).
  const horsConvention = PARC.noms.filter(
    (n) => !CODE_DE_MANDAT.test(n) && !jugerNomDOrchestrateur(n).conforme && n !== 'charles-olivier',
  );
  assert.ok(horsConvention.includes('orchestrateur'), 'le rôle porté comme un nom doit être attrapé');
  assert.ok(horsConvention.includes('e-0004-reprise'), 'le nom raccordé à rien doit être attrapé');
  assert.equal(horsConvention.length, 2, `attendu 2 noms hors convention, trouvé : ${horsConvention.join(', ')}`);
});

test('PREMIER CHIFFRE — les 4 rivières portées passent, et ce sont les SEULES à passer', () => {
  assert.deepEqual(acceptes.sort(), ['batiscan', 'bonaventure', 'matapedia', 'ristigouche']);
});

test('les codes de mandat sont refusés POUR UN ORCHESTRATEUR — et c’est la règle, pas un excès', () => {
  // 33 noms du parc sont des codes de mandat. Ils sont refusés SI on les proposait pour nommer
  // un orchestrateur : c'est exactement C1 — un orchestrateur porte plusieurs mandats
  // successifs, un code unique le décrirait mal. Les quatre orchestrateurs vivants qui portent
  // encore un code recevront leur rivière À LEUR RENAISSANCE, pas par un renommage : renommer
  // appartient à l'agent.
  const codes = refuses.filter((n) => CODE_DE_MANDAT.test(n));
  assert.equal(codes.length, 33, `le parc figé porte 33 codes de mandat, trouvé ${codes.length}`);
});

// ═══════════════ CHIFFRE 2 — CE QU'ELLE REFUSE À TORT

test('SECOND CHIFFRE — la garde ne refuse RIEN à tort dans son périmètre : 0 sur le parc', () => {
  // Un refus n'est « à tort » que si le nom DEVRAIT nommer un orchestrateur. Sur le parc figé :
  // les 4 rivières passent, les 33 codes et les 2 hors-convention sont refusés à raison, et
  // `charles-olivier` n'est PAS jugé (voir l'essai suivant). Reste : rien.
  const aTort = PARC.noms.filter(
    (n) => !jugerNomDOrchestrateur(n).conforme && !CODE_DE_MANDAT.test(n)
      && n !== 'orchestrateur' && n !== 'e-0004-reprise' && n !== 'charles-olivier',
  );
  assert.deepEqual(aTort, [], `la garde refuserait à tort : ${aTort.join(', ')}`);
});

test('SECOND CHIFFRE — un gestionnaire de client n’est JAMAIS jugé par cette garde', () => {
  // ⚠️ LE FAUX REFUS ÉVITÉ PAR CONSTRUCTION, ET IL EST CERTAIN. `charles-olivier` porte le
  // prénom de la personne qu'il représente — c'est légitime et distinct, et la garde le
  // refuserait si on l'y soumettait. Elle ne s'y applique pas : c'est le rôle qui décide, pas
  // le nom. Un essai le tient, sans quoi élargir la garde « pour être cohérent » ferait crier
  // la moitié du parc.
  const r = nomDeLAgentQuiNait({ role: 'representant', lieu: null, code: 'Charles-Olivier' });
  assert.equal(r.nom, 'charles-olivier');
  assert.equal(jugerNomDOrchestrateur('charles-olivier').conforme, false, 'la garde le refuserait, si on la lui appliquait');
});

test('SECOND CHIFFRE — LE COÛT ASSUMÉ DE LA LISTE BLANCHE, chiffré plutôt que passé sous silence', () => {
  // ⚠️ CE CHIFFRE-CI EST UN VRAI FAUX REFUS, et on ne le cache pas : huit rivières du Québec
  // que la liste ne porte pas seraient refusées alors qu'elles nomment parfaitement un
  // orchestrateur. C'est le prix d'une liste blanche, et il est PAYÉ EN CONNAISSANCE DE CAUSE :
  // une liste noire oublie toujours un cas, et ce dépôt a déjà tranché dans ce sens
  // (`lieu-nom.js`). Ce qui rend le prix supportable est que le refus DIT le geste qui le lève.
  const horsListe = PARC.rivieres_reelles_hors_liste.noms;
  const refusees = horsListe.filter((n) => !jugerNomDOrchestrateur(n).conforme);
  assert.equal(refusees.length, horsListe.length, 'la mesure porte sur des rivières réellement absentes de la liste');
  for (const n of refusees) {
    assert.match(
      jugerNomDOrchestrateur(n).message,
      /ajouter celle qui manque/,
      `le refus de « ${n} » doit dire comment le lever — sinon ce faux refus fait retirer la garde`,
    );
  }
});

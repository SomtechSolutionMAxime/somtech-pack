// un-lieu-reste-au-gabarit-ne-fait-pas-naitre.test.js — ce qui n'a pas été RENSEIGNÉ se
// reconnaît à ce qu'il est resté MOT POUR MOT ce que le gabarit avait déposé.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CES ESSAIS FERMENT (T-20260826-0043)
//
// La pose dépose `CONTEXTE.md` AVEC ses chevrons, et c'est voulu — la compétence l'écrit :
// « Remplis-le, ou fais-le remplir, avant la naissance ». Ce qui manquait est ce qui le fait
// respecter : ni la pose ni la naissance ne lisaient le CONTENU du fichier. Mesuré sur le
// parc le 2026-08-26 : CINQ lieux vivants sur dix-huit portent un `CONTEXTE.md` resté au
// gabarit intégral — ni à qui l'agent répond, ni sa portée. La pose avait rendu « ok », la
// naissance avait réussi, et l'agent l'a découvert en plein chantier, ou pas du tout.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI LA COMPARAISON AU GABARIT, ET JAMAIS UN MOTIF `<…>` CHERCHÉ À L'AVEUGLE
//
// Le faux positif n'est pas hypothétique, il est MESURÉ. Le lieu de `portneuf`
// (`constructiongauthier/.orchestrateur/d-20260819-0002`) est pleinement renseigné et porte
// dans sa prose « fly deploy -a <app> --build-secret github_token=<PAT de ~/.npmrc> ». Un
// grep de chevrons le rejetterait — donc refuserait une naissance parfaitement en règle,
// et une garde qui crie à tort finit par se faire retirer, en emportant ce qu'elle gardait.
//
// Ce qu'on cherche est donc BORNÉ à ce que le gabarit a déposé : un chevron qui n'y figure
// pas n'est jamais cherché. Le faux positif est fermé PAR CONSTRUCTION, pas par une liste
// d'exceptions qu'il faudrait tenir à jour.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rubriquesNonRenseignees, GABARIT_EN_ENTIER } from '../src/lieu-renseigne.js';

const GABARIT = [
  '# Ce qui est propre à ce dépôt',
  '',
  '## À qui tu réponds',
  '',
  '| **Le destinataire de tes topos** | `<qui décide sur ce dépôt — le dirigeant, ou quelqu’un d’autre>` |',
  '',
  '## Ta portée',
  '',
  '`<Le chantier dont tu réponds : son code au registre — D-…, P-… ou J-… — et ce qu’il recouvre.>`',
  '',
  '`<Ce dont tu ne t’occupes pas, nommément.>`',
].join('\n');

test('un fichier resté MOT POUR MOT le gabarit rend toutes ses rubriques', () => {
  const restees = rubriquesNonRenseignees(GABARIT, GABARIT);
  assert.equal(restees.length, 3, 'les trois chevrons du gabarit sont restés');
  assert.ok(restees.some((r) => r.includes('qui décide sur ce dépôt')));
  assert.ok(restees.some((r) => r.includes('Le chantier dont tu réponds')));
  assert.ok(restees.some((r) => r.includes('Ce dont tu ne t’occupes pas')));
});

test('un fichier pleinement renseigné ne rend rien', () => {
  const rempli = GABARIT
    .replace('`<qui décide sur ce dépôt — le dirigeant, ou quelqu’un d’autre>`', '**Maxime Leboeuf**, le dirigeant')
    .replace('`<Le chantier dont tu réponds : son code au registre — D-…, P-… ou J-… — et ce qu’il recouvre.>`', 'P-20260819-0001 — le parc d’agents.')
    .replace('`<Ce dont tu ne t’occupes pas, nommément.>`', 'Rien d’autre que ce chantier.');
  assert.deepEqual(rubriquesNonRenseignees(GABARIT, rempli), []);
});

test('un fichier à moitié rempli ne rend QUE ce qui est resté', () => {
  const moitie = GABARIT.replace(
    '`<qui décide sur ce dépôt — le dirigeant, ou quelqu’un d’autre>`',
    '**Maxime Leboeuf**, le dirigeant',
  );
  const restees = rubriquesNonRenseignees(GABARIT, moitie);
  assert.equal(restees.length, 2);
  assert.ok(!restees.some((r) => r.includes('qui décide sur ce dépôt')));
});

// ⚠️ LE FAUX POSITIF MESURÉ, ET C'EST L'ESSAI QUI COMPTE LE PLUS.
test('des chevrons LIBRES dans la prose ne sont jamais comptés — ils ne viennent pas du gabarit', () => {
  const renseigne = [
    '# Ce qui est propre à ce dépôt',
    '',
    '## À qui tu réponds',
    '',
    '| **Le destinataire de tes topos** | **Maxime Leboeuf**, le dirigeant |',
    '',
    '## Ta portée',
    '',
    'D-20260819-0002 — la reprise du site.',
    '',
    'Le déploiement passe par `fly deploy -a <app> --build-secret github_token=<PAT de ~/.npmrc>`.',
    '',
    'Rien d’autre que ce chantier.',
  ].join('\n');
  assert.deepEqual(
    rubriquesNonRenseignees(GABARIT, renseigne),
    [],
    'un chevron absent du gabarit n’est jamais cherché — sinon la garde refuserait un lieu en règle',
  );
});

test('un gabarit sans aucun chevron ne peut rien reprocher', () => {
  assert.deepEqual(rubriquesNonRenseignees('# Titre\n\nRien à remplir.', '# Titre\n\nRien à remplir.'), []);
});

// ⚠️ CE QUE LA GARDE NE DOIT JAMAIS FAIRE : conclure d'une mesure qu'elle n'a pas pu faire.
test('un gabarit illisible ne fait rien conclure — la mesure impossible se DIT, elle ne refuse pas', () => {
  assert.deepEqual(rubriquesNonRenseignees(null, GABARIT), []);
  assert.deepEqual(rubriquesNonRenseignees(GABARIT, null), []);
  assert.deepEqual(rubriquesNonRenseignees(undefined, undefined), []);
});

// Le fichier ENTIER resté identique au gabarit est le cas le plus grave, et il se nomme à part :
// rien n'a été écrit du tout, pas même une rubrique.
test('GABARIT_EN_ENTIER reconnaît un fichier que personne n’a touché', () => {
  assert.equal(GABARIT_EN_ENTIER(GABARIT, GABARIT), true);
  assert.equal(GABARIT_EN_ENTIER(GABARIT, `${GABARIT}\n\nune ligne ajoutée`), false);
  assert.equal(GABARIT_EN_ENTIER(null, GABARIT), false, 'une mesure impossible n’affirme rien');
});

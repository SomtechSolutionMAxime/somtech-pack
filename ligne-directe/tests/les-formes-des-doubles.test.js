// LES DOUBLES ONT LA FORME DE LA SOURCE — la garde qui manquait trois fois.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// Ce banc n'éprouve pas le recensement : il éprouve les FABRIQUES avec lesquelles les autres
// bancs le nourrissent, contre l'échantillon réel daté que `formes-reelles.js` porte.
//
// > Un banc ne peut pas être plus juste que la forme qu'on lui donne à manger.
//
// Ce qu'il attrape : une fabrique qui dérive de la source, et un échantillon qu'on aurait
// « corrigé » pour faire passer un banc. Ce qu'il n'attrape pas, et il faut le dire : que
// l'échantillon soit encore à jour. Ça, seule une remesure le dit — d'où sa date et sa
// provenance, écrites dans le fichier.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ECHANTILLON_PANES, unPaneDAgent, unPaneSansAgent, unPaneHabiteSansStatut,
} from './aide/formes-reelles.js';

test('L’ÉCHANTILLON EST COMPLET ET DATÉ — un relevé sans provenance ne vaut rien', () => {
  assert.match(ECHANTILLON_PANES.releve_le, /^\d{4}-\d{2}-\d{2}T/, 'un échantillon porte SA date');
  assert.ok(ECHANTILLON_PANES.provenance, 'et dit d’où il vient — sinon on ne peut pas le remesurer');
  const somme = ECHANTILLON_PANES.formes.reduce((n, f) => n + f.compte, 0);
  assert.equal(somme, ECHANTILLON_PANES.total, 'les formes couvrent TOUT le relevé, sans reste tu');
});

test('UN PANE D’AGENT PORTE LES TROIS MARQUES — clé, session, statut connu', () => {
  const p = unPaneDAgent();
  assert.equal(p.agent, 'claude');
  assert.ok(p.agent_session, 'la session est la marque qu’un agent HABITE le pane');
  assert.notEqual(p.agent_status, 'unknown', 'un agent que herdr voit a un statut connu');
  // La conformité, mesurée : cette forme existe dans l'échantillon.
  const attendue = ECHANTILLON_PANES.formes.find((f) => f.agent && f.agent_session);
  assert.ok(attendue, 'l’échantillon doit porter cette forme, sinon la fabrique invente');
});

test('UN PANE SANS AGENT N’A PAS DE CLÉ `agent` — écrire `agent: null` est le défaut', () => {
  const p = unPaneSansAgent();
  // ⚠️ LA LIGNE QUI PORTE TOUT. `herdr pane list` OMET la clé ; il ne rend jamais `null`. Un banc
  // qui écrit `{ agent: null }` éprouve une garde sur une forme que la production ne produit pas
  // — et c'est ce qui a laissé trois terminaux du poste passer pour des agents vivants.
  assert.equal(Object.hasOwn(p, 'agent'), false, 'la clé est ABSENTE, pas nulle');
  assert.equal(p.agent_status, 'unknown', 'et le statut dit que herdr sait qu’il n’y a personne');
  assert.equal(Boolean(p.agent_session), false, 'aucune session n’habite ce pane');
  assert.equal(
    ECHANTILLON_PANES.aucune_occurrence_dans_ce_releve['agent: null'],
    0,
    'l’échantillon confirme : aucune occurrence dans ce relevé',
  );
});

test('UNE SESSION PEUT HABITER UN PANE DONT herdr IGNORE LE STATUT — et ce n’est pas un terminal', () => {
  const p = unPaneHabiteSansStatut();
  assert.equal(Object.hasOwn(p, 'agent'), false, 'pas de clé `agent` — c’est ce qui trompe');
  assert.equal(p.agent_status, 'unknown', 'ni statut connu — c’est ce qui trompe aussi');
  // ⚠️ ET POURTANT UN AGENT L'HABITE. C'est la forme de T-20260820-0022 : la confondre avec un
  // terminal fait disparaître un agent vivant du registre, et le compte parmi ceux qui ont
  // DÉCLARÉ n'en porter aucun.
  assert.ok(p.agent_session, 'la session est la PREUVE de présence, et elle prime sur les deux');

  // ⚠️ ET LA TROISIÈME FABRIQUE EST CONFRONTÉE À L'ÉCHANTILLON, COMME LES DEUX AUTRES — c'est
  // l'omission qui a laissé passer le faux « jamais ». Cette forme n'a AUCUNE occurrence dans le
  // relevé du 22 août ET a été VUE ailleurs : l'échantillon doit porter les deux, sinon
  // « 0 occurrence » se relit « n'existe pas », et quelqu'un retire la protection.
  assert.equal(
    ECHANTILLON_PANES.aucune_occurrence_dans_ce_releve['agent_session sans clé agent'],
    0,
    'ce relevé-ci n’en a vu aucune…',
  );
  const ailleurs = ECHANTILLON_PANES.vu_ailleurs?.['agent_session sans clé agent'];
  assert.ok(ailleurs, '…mais l’échantillon DOIT dire qu’elle a été vue ailleurs');
  assert.match(ailleurs.ou, /T-\d{8}-\d{4}/, 'avec la mesure qui l’a vue, pour qu’on puisse la relire');
  assert.ok(ailleurs.consequence, 'et ce que sa méconnaissance coûterait');
});

test('AUCUN « JAMAIS » DANS L’ÉCHANTILLON — un compte n’est pas une propriété', () => {
  // ⚠️ LA GARDE QUI EMPÊCHE LE DÉFAUT DE REVENIR SOUS UN AUTRE NOM. Le champ s'appelait `jamais`
  // et affirmait une propriété du monde à partir d'un relevé d'un jour. Le mot est le piège : il
  // invite à conclure d'une absence. On garde donc le NOM autant que le contenu.
  const cles = Object.keys(ECHANTILLON_PANES);
  assert.equal(cles.includes('jamais'), false, 'un relevé compte ce qu’il a vu ; il ne dit pas « jamais »');
  assert.ok(cles.includes('aucune_occurrence_dans_ce_releve'), 'il dit ce que CE relevé n’a pas vu…');
  assert.ok(cles.includes('vu_ailleurs'), '…et ce qu’un autre a vu, sans quoi zéro se relit « n’existe pas »');
});

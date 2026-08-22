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

  // ⚠️ ET LE RELEVÉ DÉCLARE CE QU'IL N'A PAS VU — même exigence que le recensement lui-même.
  // « 13 sessions agrégées » disait une couverture complète là où 3 avaient répondu : la faute
  // exacte du `jamais`, commise une ligne plus bas.
  const ses = ECHANTILLON_PANES.sessions;
  assert.ok(ses, 'un relevé du parc dit combien de sessions il a pu interroger…');
  assert.equal(ses.repondu + ses.muettes, ses.interrogees, '…et le compte doit fermer');
  assert.equal(ECHANTILLON_PANES.nature_du_total, 'plancher', 'son total est un PLANCHER, jamais un total');
  assert.match(
    ECHANTILLON_PANES.provenance,
    new RegExp(`${ses.repondu}[^0-9]*${ses.interrogees}`),
    'et la provenance porte les DEUX chiffres, pas seulement le plus flatteur',
  );
});

test('CHAQUE ZÉRO DE L’ÉCHANTILLON DIT S’IL A ÉTÉ VU AILLEURS — sinon il se relit « n’existe pas »', () => {
  // ⚠️ RÉSERVE DU CYCLE 7, ET ELLE VISAIT LE REMÈDE LUI-MÊME : le correctif du `jamais` n'avait
  // été appliqué qu'à l'entrée qui l'avait déclenché. Les deux autres zéros restaient nus — dont
  // celui qui déclenche `panesIndecidables`, donc toute la distinction plancher / incertain. Un
  // lecteur appliquant le raisonnement CORRIGÉ aurait conclu que ces branches sont mortes.
  const zeros = Object.keys(ECHANTILLON_PANES.aucune_occurrence_dans_ce_releve);
  assert.ok(zeros.length >= 3, 'contrôle : le relevé porte bien plusieurs comptes à zéro');
  for (const forme of zeros) {
    const dit = ECHANTILLON_PANES.vu_ailleurs?.[forme];
    assert.ok(dit, `« ${forme} » est à zéro ici : l’échantillon DOIT dire si on l’a vue ailleurs`);
    assert.ok(dit.ou, '…en nommant la mesure, ou en avouant qu’il n’y en a pas');
    assert.ok(
      dit.consequence,
      `« ${forme} » doit dire ce que sa méconnaissance coûterait — sans quoi on retire la garde`,
    );
  }
});

test('LES LIGNES DE `formes` SONT GARDÉES UNE À UNE — pas seulement par leur somme', () => {
  // ⚠️ MUTATION SURVIVANTE DES DEUX PASSES DU CYCLE 7. Redistribuer les comptes en préservant le
  // total (3 terminaux → 0, 57 → 60) laissait tout vert : seule la somme était gardée. Ça efface
  // du relevé la forme même — clé absente, pas de session, statut inconnu — qui justifie
  // `unPaneSansAgent` et `panesSansAgent`, et c'est exactement la « correction » qu'on ferait
  // pour justifier de retirer cette garde. Le banc annonçait pourtant attraper « un échantillon
  // qu'on aurait corrigé pour faire passer un banc ».
  const f = ECHANTILLON_PANES.formes;
  const terminaux = f.find((x) => !x.agent && !x.agent_session && x.agent_status === 'unknown');
  assert.ok(terminaux, 'le relevé DOIT porter la forme du terminal — c’est elle qui justifie `panesSansAgent`');
  assert.ok(terminaux.compte > 0, 'et l’avoir réellement vue, sinon la garde n’a pas de cas');

  const porteurs = f.filter((x) => x.agent && x.agent_session);
  assert.ok(porteurs.length > 0, 'et la forme du pane d’agent, qui justifie tout le reste');
  assert.equal(
    porteurs.reduce((n, x) => n + x.compte, 0) + terminaux.compte,
    ECHANTILLON_PANES.total,
    'les deux familles couvrent le relevé : une troisième forme non déclarée serait un angle mort',
  );
  // ⚠️ ET AUCUNE LIGNE NE PORTE UNE FORME QUE LES ZÉROS DÉCLARENT ABSENTE — une falsification à
  // somme constante se trahit là.
  for (const x of f) {
    assert.equal(x.agent === true && x.agent_session === false, false, 'aucune forme « agent sans session »');
    assert.equal(x.agent === false && x.agent_session === true, false, 'aucune forme « session sans agent »');
  }
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

test('LE DOUBLE RÉELLEMENT BRANCHÉ EST CONFORME — c’est lui que les bancs câblés font manger au module', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // MUTATION SURVIVANTE, TROUVÉE AU CYCLE 7, ET C'ÉTAIT LA RACINE DE DEUX DÉFAUTS À LA FOIS.
  //
  // Cette garde comparait les trois FABRIQUES de `formes-reelles.js` à l'échantillon — et
  // ignorait `faux-herdr.js`, qui est le double effectivement branché sur `herdr.panes()` dans
  // les bancs de câblage. Résultat mesuré : y injecter `agent: null` — la forme canonique
  // interdite, celle qui a coûté un rejet et pour laquelle ce fichier existe — laissait les
  // 1356 essais VERTS. La réponse à « peut-on encore fabriquer une forme que la source ne
  // produit pas ? » était OUI, par la porte la plus fréquentée.
  //
  // ⚠️ ET SA NON-CONFORMITÉ EN PRODUISAIT UNE SECONDE. Ses panes n'ayant ni clé `agent` ni
  // `agent_session`, ils étaient tous INDÉCIDABLES : les bancs câblés éprouvaient un parc que la
  // borne refusait de qualifier de plancher, et l'un d'eux a fini par EXIGER que le journal
  // annonce un plancher quand même. Un double non conforme ne fait pas que rater un défaut : il
  // en fabrique un dans les gardes qui s'appuient dessus.
  const { posteHerdr } = await import('./aide/faux-herdr.js');
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const bac = mkdtempSync(join(tmpdir(), 'conformite-'));
  try {
    const p = posteHerdr(bac, [], 'conformite');
    // Ce qu'un banc écrit d'ordinaire : le minimum. Le double doit le COMPLÉTER en forme réelle.
    p.panes([
      { pane_id: 'w1:p1', foreground_cwd: '/x' },
      { pane_id: 'w1:p2', agent_status: 'unknown' }, // un terminal, demandé explicitement
    ]);
    const rendus = JSON.parse(readFileSync(join(p.etat, 'panes.json'), 'utf8'));

    const agent = rendus.find((x) => x.pane_id === 'w1:p1');
    assert.equal(agent.agent, 'claude', 'un pane d’agent porte la clé `agent`…');
    assert.ok(agent.agent_session, '…et sa session, la marque qu’un agent l’habite…');
    assert.notEqual(agent.agent_status, 'unknown', '…et un statut connu. Les trois vont ensemble.');

    const terminal = rendus.find((x) => x.pane_id === 'w1:p2');
    assert.equal(Object.hasOwn(terminal, 'agent'), false, 'un terminal n’a PAS la clé — il ne la porte pas à `null`');
    assert.equal(Boolean(terminal.agent_session), false, 'ni session');
    assert.equal(terminal.agent_status, 'unknown', 'et son statut dit que herdr sait qu’il n’y a personne');

    // ⚠️ ET AUCUN RENDU NE PORTE `agent: null` — la forme que l'échantillon compte à zéro et que
    // la source ne produit pas. C'est la mutation qui survivait.
    for (const x of rendus) {
      assert.notEqual(x.agent, null, `« ${x.pane_id} » ne doit JAMAIS porter \`agent: null\``);
    }
    // Ni la forme « pas de clé, statut connu » — celle qui rendait tous les bancs indécidables.
    for (const x of rendus) {
      assert.equal(
        !Object.hasOwn(x, 'agent') && !x.agent_session && x.agent_status !== 'unknown',
        false,
        `« ${x.pane_id} » porte une forme que herdr ne rend pas : ni agent, ni session, ni statut inconnu`,
      );
    }
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
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

// UN SUCCESSEUR NÉ AILLEURS REPREND LA LIGNE DE SON PRÉDÉCESSEUR (T-20260827-0033).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI EST ARRIVÉ, LE 2026-08-26 AU SOIR, SUR `P-20260815-0002`
//
// Un orchestrateur meurt avec sa copie de travail. Son successeur naît dans le dépôt
// principal, au MÊME lieu d'agent — `.orchestrateur/p-20260815-0002` —, sur le MÊME chantier,
// dans le MÊME rôle. L'identité d'une ligne retenait la COPIE DE TRAVAIL : deux chemins,
// donc deux clés, donc aucune reprise. La commande a créé un SECOND canal, suffixé `-2`, et le
// canal d'origine — libre, ouvert, non archivé, celui où le dirigeant continuait d'écrire —
// est resté hors d'atteinte. Ordre explicite reçu ce soir-là : « même channel ». Intenable.
//
// ⚠️ LE DÉFAUT NE SE VOIT PAS DANS SLACK. `creerCanal` REPREND un homonyme sur `name_taken` :
// si l'appel avait eu lieu, le canal d'origine serait revenu. Il n'a jamais eu lieu — c'est
// `nomsPris` qui, ne reconnaissant pas la ligne du prédécesseur comme la sienne, a fabriqué
// le `-2` AVANT d'appeler Slack. Un essai qui n'observerait que l'appel à Slack ne verrait
// rien. On observe donc le CANAL RENDU et le nombre de canaux du monde.
//
// ⚠️ CE QUE LE REMÈDE NE DOIT PAS EMPORTER. Retirer la copie de travail de la clé sans rien
// mettre à la place confondrait deux agents ORDINAIRES du même chantier dans deux copies de
// travail — ce que la clé sépare aujourd'hui. L'ancre est le LIEU de l'agent, et un chemin
// SANS lieu de rôle reste distinctif de bout en bout. Les deux moitiés sont éprouvées ici.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fauxSlack } from './aide/faux-slack.js';

const execFileAsync = promisify(execFile);
const ICI = dirname(fileURLToPath(import.meta.url));
const CLI = join(ICI, '..', 'bin', 'ligne-directe.js');

let Veilleur, sauverRegistre, chargerRegistre, cleDeLigne, ancreDeLigne;
let racine;
let binFaux;

const UDIR = 'UDIR';
const UMOI = 'UMOI';
const DIRIGEANT = { id: UDIR, courriel: 'dirigeant@somtech.ca' };

// Les deux chemins MESURÉS le 2026-08-26, à un détail près : le dépôt est `somcraft`.
const WT_PREDECESSEUR = '/Users/x/worktrees/somcraft/20260817-210120/.orchestrateur/p-20260815-0002';
const WT_SUCCESSEUR = '/Users/x/GitRepo.nosync/somcraft/.orchestrateur/p-20260815-0002';

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-successeur-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre, cleDeLigne, ancreDeLigne } = await import('../src/registre.js'));

  binFaux = join(racine, 'bin');
  mkdirSync(binFaux, { recursive: true });
  const faux = join(binFaux, 'herdr');
  // ⚠️ LA COPIE DE TRAVAIL VIENT DE L'ENVIRONNEMENT, et c'est tout l'objet de cet essai : le
  // double de `herdr` du dépôt rend un `/w` constant, donc il ne peut PAS exercer une
  // renaissance ailleurs. Un essai bâti dessus serait passé au vert sans rien éprouver.
  writeFileSync(
    faux,
    `#!${process.execPath}\n` +
      `const a = process.argv.slice(2).join(' ');\n` +
      `if (a === 'pane current') {\n` +
      `  process.stdout.write(JSON.stringify({ result: { pane: { pane_id: process.env.FAUX_PANE, foreground_cwd: process.env.FAUX_WT } } }));\n` +
      `} else {\n` +
      `  process.stdout.write(JSON.stringify({ error: { code: 'unsupported', message: a } }));\n` +
      `}\n`
  );
  chmodSync(faux, 0o755);
});

after(() => rmSync(racine, { recursive: true, force: true }));
beforeEach(() => sauverRegistre({ version: 1, lignes: [], communs: {}, commun: null, dirigeant: DIRIGEANT }));

function agentsQuiVivent({ panes }) {
  return {
    async vivant(pane) {
      return panes.includes(pane);
    },
    async remettre() {
      return { delivered: true };
    },
    async agents() {
      return panes.map((p) => ({ agent: 'claude', pane_id: p, herdr_socket: null }));
    },
    async panes() {
      return {
        panes: panes.map((p) => ({ pane_id: p, agent_session: { agent: 'claude' }, herdr_socket: null })),
        sessionsInterrogees: 1,
        sessionsRefusees: [],
      };
    },
  };
}

async function avecPoste({ canaux = [], lignes = null, panes = ['w1:p1', 'w2:p7'] }, corps) {
  const monde = fauxSlack({
    canaux,
    utilisateurs: [{ id: UDIR, name: 'maxime', profile: { real_name: 'Maxime', email: DIRIGEANT.courriel } }],
  }).installer();
  // ⚠️ LE REGISTRE S'ÉCRIT AVANT LE VEILLEUR, JAMAIS APRÈS. Le veilleur le charge à sa
  // naissance et travaille ensuite en mémoire : une ligne posée après coup n'existe pour
  // personne, et l'essai passerait au vert en n'éprouvant que le registre vide.
  if (lignes) sauverRegistre({ version: 1, communs: {}, commun: null, dirigeant: DIRIGEANT, lignes });
  const v = new Veilleur({
    cheminSocket: join(racine, 'veilleur.sock'),
    jetons: { robot: 'xoxb-x', ecoute: 'xapp-y' },
    identite: { equipe: 'T', utilisateur: UMOI },
    herdr: agentsQuiVivent({ panes }),
  });
  await v.ecouterLocal();
  const ld = async (args, { pane = 'w1:p1', wt = WT_PREDECESSEUR } = {}) => {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
        env: { ...process.env, LIGNE_DIRECTE_RACINE: racine, PATH: binFaux, FAUX_PANE: pane, FAUX_WT: wt },
      });
      return { code: 0, stdout, stderr };
    } catch (err) {
      return { code: err.code ?? 1, stdout: err.stdout || '', stderr: err.stderr || '' };
    }
  };
  try {
    return await corps({ monde, ld, veilleur: v });
  } finally {
    await v.arreter();
    monde.restaurer();
  }
}

// ═════════════════ 1. LA RENAISSANCE QUI A ÉCHOUÉ EN PRODUCTION

test('LE SUCCESSEUR NÉ DANS LE DÉPÔT PRINCIPAL REPREND LE CANAL — la recette du 2026-08-26', async () => {
  await avecPoste({}, async ({ monde, ld }) => {
    const premier = await ld(['ouvrir', 'P-20260815-0002', '--titre', 'espace client somcraft', '--au-dirigeant'], {
      pane: 'w1:p1',
      wt: WT_PREDECESSEUR,
    });
    assert.equal(premier.code, 0, premier.stderr);
    const canalDorigine = monde.canalNomme('espace-client-somcraft');
    assert.ok(canalDorigine, 'le canal d’origine doit exister');

    // Le prédécesseur meurt avec sa copie de travail ; le successeur naît ailleurs, au même
    // lieu, et redemande sa ligne. Sa ligne est TOUJOURS OUVERTE au registre — c'est le cas
    // mesuré : le prédécesseur a refusé d'archiver, et personne n'a fermé pour lui.
    const second = await ld(['ouvrir', 'P-20260815-0002', '--titre', 'espace client somcraft', '--au-dirigeant'], {
      pane: 'w2:p7',
      wt: WT_SUCCESSEUR,
    });
    assert.equal(second.code, 0, second.stderr);
    const rendu = JSON.parse(second.stdout);

    assert.equal(rendu.reprise, true, 'il REPREND la ligne, il n’en ouvre pas une seconde');
    assert.equal(rendu.canal_id, canalDorigine.id, 'et c’est le canal D’ORIGINE, pas un homonyme suffixé');
    assert.equal(monde.canalNomme('espace-client-somcraft-2'), null, 'aucun canal parasite n’est né');
    assert.equal(monde.canaux.length, 1, 'le monde ne porte qu’UN canal — le compte est ce qui prouve l’absence');
    assert.equal(chargerRegistre().lignes.length, 1, 'et le registre ne porte qu’UNE ligne');
  });
});

test('LA LIGNE SUIT LE SUCCESSEUR — ce qui tombe du canal arrive dans SON pane, pas dans celui du mort', async () => {
  // La reprise ne vaut que si le routage entrant suit. Sans ce rafraîchissement, l'agent
  // vivant aurait sa ligne « ouverte » et n'entendrait jamais le dirigeant — la panne la plus
  // silencieuse de ce dépôt, et exactement celle que le ticket décrit.
  await avecPoste({}, async ({ ld }) => {
    await ld(['ouvrir', 'P-20260815-0002', '--titre', 'espace client somcraft', '--au-dirigeant'], {
      pane: 'w1:p1',
      wt: WT_PREDECESSEUR,
    });
    await ld(['ouvrir', 'P-20260815-0002', '--titre', 'espace client somcraft', '--au-dirigeant'], {
      pane: 'w2:p7',
      wt: WT_SUCCESSEUR,
    });
    const ouvertes = chargerRegistre().lignes.filter((l) => !l.close_le);
    assert.equal(ouvertes.length, 1);
    assert.equal(ouvertes[0].pane, 'w2:p7', 'la ligne porte le pane du vivant');
  });
});

test('MÊME UNE LIGNE INSCRITE PAR LA VERSION D’AVANT SE RETROUVE — le parc existant n’a rien à migrer', async () => {
  // Le registre survit aux versions et RIEN NE MIGRE. Les lignes déjà ouvertes sur le poste du
  // dirigeant portent leur chemin complet, écrit par la version qui a mordu. Si l'ancre ne se
  // calculait qu'à l'écriture, le correctif ne corrigerait personne — dont le seul cas mesuré.
  const canalMesure = {
    id: 'C0BQV6U30AE',
    name: 'espace-client-somcraft',
    is_private: false,
    is_archived: false,
    membres: [UMOI, UDIR],
  };
  const ligneDavant = {
    chantier: 'P-20260815-0002',
    canal_id: 'C0BQV6U30AE',
    canal_nom: 'espace-client-somcraft',
    pane: 'w1:p1',
    worktree: WT_PREDECESSEUR,
    nature: 'interne',
    libelle: 'P-20260815-0002',
    autorises: [UDIR],
    pair: null,
    visage: null,
    ouverte_le: '2026-08-17T21:01:20.000Z',
    close_le: null,
  };
  await avecPoste({ canaux: [canalMesure], lignes: [ligneDavant] }, async ({ ld }) => {
    const r = await ld(['ouvrir', 'P-20260815-0002', '--titre', 'espace client somcraft', '--au-dirigeant'], {
      pane: 'w2:p7',
      wt: WT_SUCCESSEUR,
    });
    assert.equal(r.code, 0, r.stderr);
    const rendu = JSON.parse(r.stdout);
    assert.equal(rendu.reprise, true);
    assert.equal(rendu.canal_id, 'C0BQV6U30AE', 'c’est le canal mesuré ce soir-là qui revient');
  });
});

test('LA REPRISE INSCRIT LA COPIE DE TRAVAIL DU VIVANT — sinon l’hygiène dénonce une ligne bien vivante', async () => {
  // ⚠️ L'EFFET DE BORD QUE LA REPRISE OUVRE. `hygiene.js` signale les lignes ouvertes dont le
  // worktree a DISPARU du disque, et propose de les refermer. Une reprise qui laisserait au
  // registre le chemin du mort — une copie de travail effacée, c'est le cas nominal — ferait
  // dénoncer, chaque ronde, la ligne de l'agent vivant, avec le geste pour la couper. Le
  // registre doit dire OÙ EST CELUI QUI PORTE LA LIGNE, jamais où était son prédécesseur.
  await avecPoste({}, async ({ ld }) => {
    await ld(['ouvrir', 'P-20260815-0002', '--titre', 'espace client somcraft', '--au-dirigeant'], {
      pane: 'w1:p1',
      wt: WT_PREDECESSEUR,
    });
    await ld(['ouvrir', 'P-20260815-0002', '--titre', 'espace client somcraft', '--au-dirigeant'], {
      pane: 'w2:p7',
      wt: WT_SUCCESSEUR,
    });
    const [ligne] = chargerRegistre().lignes.filter((l) => !l.close_le);
    assert.equal(ligne.worktree, WT_SUCCESSEUR, 'la ligne porte la copie de travail du vivant');
  });
});

// ═════════════════ 2. CE QUE L'ANCRE NE DOIT PAS CONFONDRE

test('DEUX COPIES DE TRAVAIL SANS LIEU D’AGENT RESTENT DEUX LIGNES — le remède naïf est écarté', async () => {
  // Le ticket le dit : confondre deux agents ordinaires du même chantier produirait un routage
  // croisé. Un chemin qui ne porte AUCUN lieu de rôle reste donc distinctif de bout en bout.
  await avecPoste({}, async ({ monde, ld }) => {
    const a = await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], {
      pane: 'w1:p1',
      wt: '/Users/x/worktrees/pack/20260801-000000',
    });
    assert.equal(a.code, 0, a.stderr);
    const b = await ld(['ouvrir', 'j-9', '--titre', 'Chantier neuf', '--au-dirigeant'], {
      pane: 'w2:p7',
      wt: '/Users/x/worktrees/pack/20260802-000000',
    });
    assert.equal(b.code, 0, b.stderr);

    assert.equal(JSON.parse(b.stdout).reprise, false, 'deux copies de travail ordinaires ne se confondent pas');
    assert.equal(chargerRegistre().lignes.filter((l) => !l.close_le).length, 2, 'le registre porte les DEUX lignes');
    assert.ok(monde.canalNomme('chantier-neuf-2'), 'et la seconde a bien son canal à elle');
  });
});

// ═════════════════ 3. L'ANCRE, SEULE

test('L’ANCRE D’UNE LIGNE EST LE LIEU DE L’AGENT — pas le chemin qui le porte', () => {
  assert.equal(ancreDeLigne(WT_PREDECESSEUR), '.orchestrateur/p-20260815-0002');
  assert.equal(ancreDeLigne(WT_SUCCESSEUR), '.orchestrateur/p-20260815-0002');
  assert.equal(
    ancreDeLigne('/Users/x/GitRepo.nosync/acme/.gestionnaire/Charles-Olivier'),
    '.gestionnaire/charles-olivier',
    'la casse d’un segment de lieu n’identifie rien — le chantier est déjà aplati pour la même raison'
  );
});

test('UN CHEMIN SANS LIEU DE RÔLE EST RENDU TEL QUEL — on n’invente pas une ancre qu’on n’a pas', () => {
  assert.equal(ancreDeLigne('/Users/x/worktrees/pack/20260801-000000'), '/Users/x/worktrees/pack/20260801-000000');
  assert.equal(ancreDeLigne(''), '');
  assert.equal(ancreDeLigne(null), '');
  // Un dossier de rôle SANS segment derrière lui ne nomme aucun agent : ce n'est pas un lieu.
  assert.equal(ancreDeLigne('/Users/x/depot/.orchestrateur'), '/Users/x/depot/.orchestrateur');
});

test('DEUX LIEUX DIFFÉRENTS DU MÊME DÉPÔT NE PARTAGENT PAS DE CLÉ', () => {
  const a = cleDeLigne('d-1', '/Users/x/depot/.orchestrateur/d-1');
  const b = cleDeLigne('d-1', '/Users/x/depot/.gestionnaire/charles-olivier');
  assert.notEqual(a, b);
  assert.equal(a, cleDeLigne('D-1', '/Users/x/worktrees/depot/20260801-000000/.orchestrateur/d-1'));
});

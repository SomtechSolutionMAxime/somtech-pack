// Ce que la revue indépendante a démasqué : six mutations sur sept SURVIVAIENT.
//
// Les tests existants étaient bons là où ils existaient — le problème est là où ils
// n'existaient pas. Trois des garanties que les en-têtes de fichiers présentent comme le
// cœur du design n'étaient prouvées par rien : l'écriture atomique du registre, la
// déduplication des noms de canal DANS le câblage (et pas seulement dans la fonction pure),
// et la consultation de TOUTES les sessions herdr.
//
// Chaque test ci-dessous a été vérifié par la mutation qu'il est censé attraper.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let Veilleur, sauverRegistre, chargerRegistre, lignesOuvertes, CHEMIN_REGISTRE;
let racine;

before(async () => {
  racine = mkdtempSync(join(tmpdir(), 'ld-faux-'));
  process.env.LIGNE_DIRECTE_RACINE = racine;
  ({ Veilleur } = await import('../src/veilleur.js'));
  ({ sauverRegistre, chargerRegistre, lignesOuvertes, CHEMIN_REGISTRE } = await import('../src/registre.js'));
});

beforeEach(() => sauverRegistre({ version: 1, lignes: [] }));

function slackDouble() {
  return {
    postes: [],
    crees: [],
    async poster(_j, m) {
      this.postes.push(m);
      return '1';
    },
    async creerCanal(_j, nom) {
      this.crees.push(nom);
      return { id: `C_${nom}`, nom, reutilise: false };
    },
    async definirSujet() {},
    async inviter() {},
    async archiverCanal() {
      return true;
    },
  };
}

const veilleur = (opts = {}) =>
  new Veilleur({
    cheminSocket: join(racine, `${Math.abs(Number(process.hrtime.bigint() % 100000n))}.sock`),
    jetons: { robot: 'x', ecoute: 'y' },
    identite: { equipe: 'T', utilisateur: 'UMOI' },
    ...opts,
  });

// —————————————————————————————————————————————————— l'écriture atomique du registre

test("le registre n'est JAMAIS écrit en place — un veilleur tué ne le laisse pas tronqué", () => {
  // La garantie est annoncée en tête de `registre.js` et n'était prouvée par rien.
  //
  // Comment la PROUVER plutôt que la contempler : un renommage dépend des droits du
  // DOSSIER, une écriture directe dépend des droits du FICHIER. On rend donc la cible
  // non inscriptible. Le renommage passe ; `writeFileSync` échouerait. Un test qui se
  // contenterait de vérifier l'absence de résidu `.tmp` ne distinguerait pas les deux —
  // vérifié : cette version-là survivait à la mutation.
  const chemin = join(racine, 'atomique.json');
  writeFileSync(chemin, JSON.stringify({ version: 1, lignes: [{ chantier: 'ANCIEN' }] }));
  chmodSync(chemin, 0o444);

  sauverRegistre({ version: 1, lignes: [{ chantier: 'NOUVEAU' }] }, chemin);

  assert.equal(JSON.parse(readFileSync(chemin, 'utf8')).lignes[0].chantier, 'NOUVEAU');
  assert.ok(!readdirSync(racine).includes('atomique.json.tmp'), 'le temporaire doit avoir été consommé par le renommage');
});

test('un registre écrit puis relu conserve exactement ce qu’on y a mis', () => {
  const chemin = join(racine, 'fidele.json');
  const lignes = [{ chantier: 'D-1', canal_id: 'C1', autorises: ['U1', 'U2'], herdr_socket: '/s.sock', close_le: null }];
  sauverRegistre({ version: 1, lignes }, chemin);
  assert.deepEqual(chargerRegistre(chemin).lignes, lignes);
});

// ——————————————————————————————————— la déduplication DANS le câblage, pas juste en théorie

test('DEUX WORKTREES DU MÊME CHANTIER obtiennent DEUX canaux — vérifié sur `ouvrir`, pas sur la fonction pure', async () => {
  // La revue l'a montré : la déduplication était testée au niveau de `nomDeCanal`, jamais
  // dans `ouvrir()`. La désactiver dans le câblage passait la suite — alors que c'est là
  // que le dirigeant se met à parler au mauvais agent.
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: { async agents() { return []; } } });

  const a = await v.ouvrir({ chantier: 'D-20260805-0004', pane: 'w1:p1', worktree: '/w/a' });
  const b = await v.ouvrir({ chantier: 'D-20260805-0004', pane: 'w2:p2', worktree: '/w/b' });

  assert.equal(a.ok && b.ok, true);
  assert.notEqual(a.canal, b.canal, 'deux copies de travail du même dépôt ne doivent pas partager un canal');
  assert.equal(b.canal, `${a.canal}-2`);
  assert.equal(lignesOuvertes(chargerRegistre()).length, 2);
});

test('rouvrir depuis la MÊME copie de travail reprend le canal au lieu d’en créer un second', async () => {
  const s = slackDouble();
  const v = veilleur({ slack: s, herdr: { async agents() { return []; } } });

  await v.ouvrir({ chantier: 'D-1', pane: 'w1:p1', worktree: '/w/a' });
  const reprise = await v.ouvrir({ chantier: 'D-1', pane: 'w9:p9', worktree: '/w/a' });

  assert.equal(reprise.reprise, true);
  assert.equal(s.crees.length, 1, 'un seul canal doit avoir été créé');
  assert.equal(chargerRegistre().lignes[0].pane, 'w9:p9', 'le pane doit suivre l’agent relancé');
});

test('la ligne retient QUI a le droit de lui parler, dès son ouverture', async () => {
  const v = veilleur({ slack: slackDouble(), herdr: { async agents() { return []; } } });
  await v.ouvrir({ chantier: 'D-1', pane: 'w1:p1', worktree: '/w/a', invites: ['UDIR'] });
  assert.deepEqual(chargerRegistre().lignes[0].autorises, ['UDIR']);
});

// ————————————————————————————————————————————————— toutes les sessions herdr, pas une

// NON COUVERT, et c'est dit plutôt que maquillé : la DÉCOUVERTE des sessions herdr sur le
// disque (`socketsHerdr`) lit le dossier personnel réel — on ne peut pas la simuler sans
// détourner `homedir()`. Ce qui suit couvre l'AGRÉGATION (le comportement qui compte), pas
// la découverte. Un test qui se contenterait de vérifier que la fonction rend un tableau
// serait décoratif : c'est précisément ce que la revue reproche.

test('un agent vivant dans une session, absent d’une autre, reste VIVANT', async () => {
  sauverRegistre({
    version: 1,
    lignes: [
      { chantier: 'D-1', canal_id: 'C1', canal_nom: 'd-1', pane: 'w2:p2', worktree: '/w/b', visage: 'x', ouverte_le: 'h', close_le: null, autorises: ['UDIR'] },
    ],
  });
  const v = veilleur({
    slack: slackDouble(),
    herdr: {
      // Agrégation de deux sessions : la première ne connaît pas ce pane, la seconde si.
      async agents() {
        return [
          { agent: 'claude', pane_id: 'w1:p1', herdr_socket: '/a.sock' },
          { agent: 'claude', pane_id: 'w2:p2', herdr_socket: '/b.sock' },
        ];
      },
      async vivant(pane) {
        return ['w1:p1', 'w2:p2'].includes(pane);
      },
      async remettre() {
        return {};
      },
    },
  });

  await v.reconcilier();

  assert.equal(lignesOuvertes(chargerRegistre()).length, 1, "un agent d'une autre session ne doit pas être enterré");
});

// ————————————————————————————————————————————————————— le plafond de Slack est respecté

test('un plafonnement de Slack est ATTENDU puis réessayé, pas transformé en échec', async () => {
  // La mutation « ignorer le 429 » survivait : rien ne testait `slack.js`. Or l'annuaire des
  // membres, interrogé à chaque ouverture, est justement une méthode plafonnée bas.
  const { appeler } = await import('../src/slack.js');
  const vraiFetch = globalThis.fetch;
  let appels = 0;
  globalThis.fetch = async () => {
    appels += 1;
    if (appels === 1) {
      // Un vrai 429 se lit dans le STATUT et l'en-tête, pas dans le corps. Mettre
      // `error: ratelimited` dans le corps ferait passer le test par l'autre garde-fou et
      // masquerait la mutation — vérifié, cette version-là survivait.
      return { status: 429, headers: new Map([['retry-after', '0']]), async json() { return { ok: false }; } };
    }
    return { status: 200, headers: new Map(), async json() { return { ok: true, membres: [] }; } };
  };
  try {
    const d = await appeler('users.list', 'jeton');
    assert.equal(d.ok, true);
    assert.equal(appels, 2, 'le premier appel plafonné doit être réessayé, pas abandonné');
  } finally {
    globalThis.fetch = vraiFetch;
  }
});

test('une erreur Slack qui n’est pas un plafonnement remonte telle quelle', async () => {
  const { appeler, ErreurSlack } = await import('../src/slack.js');
  const vraiFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 200, headers: new Map(), async json() { return { ok: false, error: 'missing_scope' }; } });
  try {
    await assert.rejects(() => appeler('users.lookupByEmail', 'jeton'), (err) => {
      assert.ok(err instanceof ErreurSlack);
      // `not_authed` (aucun jeton) et `invalid_auth` (jeton refusé) ne veulent pas dire la
      // même chose : le code exact doit survivre jusqu'à l'appelant.
      assert.equal(err.code, 'missing_scope');
      return true;
    });
  } finally {
    globalThis.fetch = vraiFetch;
  }
});

// ———————————————————————————————————————————————— une ligne close refuse encore d'écrire

test('`dire` sur une ligne close échoue au lieu de poster dans un canal abandonné', async () => {
  const s = slackDouble();
  // Le registre est chargé À LA CONSTRUCTION du veilleur : il faut donc l'écrire avant.
  sauverRegistre({
    version: 1,
    lignes: [{ chantier: 'D-1', canal_id: 'C1', canal_nom: 'd-1', pane: 'w1:p1', worktree: '/w/a', visage: 'x', ouverte_le: 'h', close_le: 'hier' }],
  });
  const v = veilleur({ slack: s, herdr: { async agents() { return []; } } });

  const r = await v.dire({ canal_id: 'C1', texte: 'quelqu’un ?' });

  assert.equal(r.ok, false);
  assert.match(r.erreur, /close/i);
  assert.equal(s.postes.length, 0, 'rien ne doit partir vers une ligne close');
});

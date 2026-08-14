// naissance.test.js — le lieu n'est jamais créé ici (E-20260807-0002 le pose), et le garde
// est FUSIONNÉ dans son `.claude/settings.json` à CHAQUE naissance — jamais écrit à part,
// jamais en écrasant les permissions déjà là.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GABARITS } from '../../ligne-directe/src/representant.js';
import {
  cheminLieu,
  COMMANDE_GARDE,
  verifierLieu,
  LieuAbsent,
  fusionnerGarde,
  poserGarde,
  gardePose,
  commandesNaissance,
  nomAgentHerdr,
  lireReponseHerdr,
  agentDetecte,
  agentPorteLeNom,
  repertoireDeLaSession,
} from '../src/naissance.js';

const PERMISSIONS_DU_LIEU = { permissions: { allow: ['mcp__servicedesk__*'], deny: ['Edit', 'Write'] } };

function repoTemp() {
  return mkdtempSync(join(tmpdir(), 'smtk-naissance-'));
}

/** Un lieu COMPLET — les 4 fichiers que `ligne-directe representant` pose réellement. */
function poserLeLieu(repoRoot, client, { omettre = [], settings = PERMISSIONS_DU_LIEU } = {}) {
  const lieu = cheminLieu(repoRoot, client);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  const contenus = {
    'CLAUDE.md': '# Tu es le représentant de ce client\n',
    'CONTEXTE.md': "# Ce qu'on sait de ce client\n",
    '.mcp.json': '{"mcpServers":{"servicedesk":{}}}\n',
    [join('.claude', 'settings.json')]: `${JSON.stringify(settings)}\n`,
  };
  for (const [f, c] of Object.entries(contenus)) {
    if (!omettre.includes(f)) writeFileSync(join(lieu, f), c);
  }
  return lieu;
}

test('naître refuse quand le lieu n’a pas été posé du tout — la naissance ne le crée jamais', () => {
  const repoRoot = repoTemp();
  try {
    assert.throws(() => verifierLieu(repoRoot, 'acme'), LieuAbsent);
    assert.throws(() => poserGarde(repoRoot, 'acme'), LieuAbsent);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('naître refuse un lieu INCOMPLET — chacun des 4 gabarits est requis, un à la fois', () => {
  const repoRoot = repoTemp();
  try {
    for (const manquant of GABARITS) {
      const client = `acme-sans-${manquant.replace(/[/.]/g, '-')}`;
      poserLeLieu(repoRoot, client, { omettre: [manquant] });
      assert.throws(
        () => verifierLieu(repoRoot, client),
        (err) => err instanceof LieuAbsent && err.manquants.includes(manquant)
      );
    }
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('naître accepte un lieu posé avec ses 4 gabarits', () => {
  const repoRoot = repoTemp();
  try {
    poserLeLieu(repoRoot, 'acme');
    assert.equal(verifierLieu(repoRoot, 'acme'), cheminLieu(repoRoot, 'acme'));
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

// ═══════════════════════════════ fusionnerGarde — jamais écraser les permissions du lieu

test('fusionnerGarde préserve les permissions existantes intégralement', () => {
  const fusionne = fusionnerGarde(PERMISSIONS_DU_LIEU);
  assert.deepEqual(fusionne.permissions, PERMISSIONS_DU_LIEU.permissions);
});

test('fusionnerGarde ajoute le PreToolUse pointant le vrai garde, au bon chemin', () => {
  const fusionne = fusionnerGarde(PERMISSIONS_DU_LIEU);
  const commande = fusionne.hooks.PreToolUse[0].hooks[0].command;
  assert.match(commande, /naissance-representant\/hooks\/garde-ouverture-ligne\.js/);
});

test('fusionnerGarde est idempotent — reposer deux fois ne double pas le hook', () => {
  const uneFois = fusionnerGarde(PERMISSIONS_DU_LIEU);
  const deuxFois = fusionnerGarde(uneFois);
  assert.equal(deuxFois.hooks.PreToolUse.length, 1);
  assert.deepEqual(deuxFois, uneFois);
});

test('fusionnerGarde préserve un hook PreToolUse déjà présent, ajouté par ailleurs', () => {
  const avecAutreHook = { ...PERMISSIONS_DU_LIEU, hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'autre-chose' }] }] } };
  const fusionne = fusionnerGarde(avecAutreHook);
  assert.equal(fusionne.hooks.PreToolUse.length, 2);
  assert.ok(fusionne.hooks.PreToolUse.some((b) => b.hooks[0].command === 'autre-chose'));
});

// ═══════════════════════════ T-20260809-0032 — le garde ne porte AUCUN chemin de machine

test('T-20260809-0032 — la commande posée ne porte ni chemin de poste, ni trace du plan de travail', () => {
  const commande = fusionnerGarde(PERMISSIONS_DU_LIEU).hooks.PreToolUse[0].hooks[0].command;
  assert.ok(!/\/Users\//.test(commande), `un chemin de machine est parti dans un fichier versionné : ${commande}`);
  assert.ok(!/worktrees/.test(commande), `le plan de travail est parti dans un fichier versionné : ${commande}`);
  assert.ok(
    commande.includes('$HOME/.somtech/naissance-representant/hooks/garde-ouverture-ligne.js'),
    'le garde doit désigner l’installation de POSTE — le module porte `scope: poste` et n’est jamais copié dans un dépôt client'
  );
});

test('T-20260809-0032 — deux plans de travail différents posent le même octet', () => {
  const planA = repoTemp();
  const planB = repoTemp();
  try {
    poserLeLieu(planA, 'acme');
    poserLeLieu(planB, 'acme');
    poserGarde(planA, 'acme');
    poserGarde(planB, 'acme');
    const a = readFileSync(join(cheminLieu(planA, 'acme'), '.claude', 'settings.json'), 'utf8');
    const b = readFileSync(join(cheminLieu(planB, 'acme'), '.claude', 'settings.json'), 'utf8');
    assert.equal(a, b, 'naître depuis deux plans de travail ne doit plus salir le fichier versionné');
  } finally {
    rmSync(planA, { recursive: true, force: true });
    rmSync(planB, { recursive: true, force: true });
  }
});

test('T-20260809-0032 — reposer par-dessus un garde ancien en chemin absolu le REMPLACE, sans laisser le mort derrière', () => {
  const repoRoot = repoTemp();
  const ancienne =
    'node /Users/quelquun/worktrees/somtech-pack/20260809-092622/naissance-representant/hooks/garde-ouverture-ligne.js';
  try {
    poserLeLieu(repoRoot, 'acme', {
      settings: { ...PERMISSIONS_DU_LIEU, hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: ancienne }] }] } },
    });
    poserGarde(repoRoot, 'acme');
    const relu = gardePose(repoRoot, 'acme');
    const commandes = relu.hooks.PreToolUse.flatMap((b) => b.hooks.map((h) => h.command));
    assert.ok(!commandes.includes(ancienne), 'le garde mort doit disparaître — sinon il échoue à chaque appel d’outil');
    assert.equal(
      commandes.filter((c) => c.includes('garde-ouverture-ligne.js')).length,
      1,
      'un seul garde, jamais deux'
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

// ═══════════════ La commande posée, EXÉCUTÉE — pas relue. `/bin/sh` est le plus strict des
// shells que Claude Code puisse employer : ce qui passe ici passe partout.

const HERE_TEST = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = resolve(HERE_TEST, '..');

/** Un faux poste : `$HOME/.somtech/naissance-representant` pointe (ou non) sur le vrai module. */
function postTemp({ avecGarde }) {
  const h = mkdtempSync(join(tmpdir(), 'smtk-poste-'));
  mkdirSync(join(h, '.somtech'), { recursive: true });
  if (avecGarde) symlinkSync(MODULE_ROOT, join(h, '.somtech', 'naissance-representant'));
  return h;
}

function jouerLaCommande(commande, { home, cwd, requete }) {
  const stdout = execFileSync('/bin/sh', ['-c', commande], {
    input: JSON.stringify(requete),
    cwd,
    env: { ...process.env, HOME: home },
    timeout: 15000,
  });
  return JSON.parse(stdout).hookSpecificOutput;
}

test('T-20260809-0032 — la commande posée S’EXÉCUTE et rend la vraie décision (garde présent au poste)', () => {
  const home = postTemp({ avecGarde: true });
  const ailleurs = mkdtempSync(join(tmpdir(), 'smtk-ailleurs-'));
  try {
    // Hors du lieu d'un représentant : `src/hook.js` répond `allow` AVANT de toucher herdr.
    // Ce motif de réponse n'existe nulle part ailleurs — le lire prouve que la commande a
    // bien atteint le vrai garde, sans jamais approcher le vrai espace de conversation.
    const out = jouerLaCommande(COMMANDE_GARDE, {
      home,
      cwd: ailleurs,
      requete: { cwd: ailleurs, tool_name: 'Bash', tool_input: { command: 'git status' } },
    });
    assert.equal(out.hookEventName, 'PreToolUse');
    assert.equal(out.permissionDecision, 'allow');
    assert.match(out.permissionDecisionReason, /hors du lieu/);
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(ailleurs, { recursive: true, force: true });
  }
});

test('T-20260809-0032 — garde ABSENT du poste : la commande REFUSE et le dit, elle ne se tait pas', () => {
  // Le motif que le ticket nomme : « un hook qui ne pointe sur rien ne dit pas qu'il ne
  // garde plus ». Un `node <fichier absent>` sort en 1 sans rien écrire, et Claude Code
  // laisse alors passer l'appel d'outil : garde inerte, en silence. Refus par défaut.
  const home = postTemp({ avecGarde: false });
  const ailleurs = mkdtempSync(join(tmpdir(), 'smtk-ailleurs-'));
  try {
    const out = jouerLaCommande(COMMANDE_GARDE, {
      home,
      cwd: ailleurs,
      requete: { cwd: ailleurs, tool_name: 'Bash', tool_input: { command: 'git status' } },
    });
    assert.equal(out.permissionDecision, 'deny');
    assert.match(out.permissionDecisionReason, /introuvable/);
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(ailleurs, { recursive: true, force: true });
  }
});

// ═══════════════════════════════ poserGarde — écrit RÉELLEMENT, dans LEUR fichier

test('poserGarde fusionne dans .claude/settings.json du lieu, sans en créer un second', () => {
  const repoRoot = repoTemp();
  try {
    poserLeLieu(repoRoot, 'acme');
    const chemin = poserGarde(repoRoot, 'acme');
    assert.equal(chemin, join(cheminLieu(repoRoot, 'acme'), '.claude', 'settings.json'));
    assert.ok(!existsSync(join(cheminLieu(repoRoot, 'acme'), 'settings.json')), 'aucun settings.json à plat ne doit apparaître');

    const relu = gardePose(repoRoot, 'acme');
    assert.deepEqual(relu.permissions, PERMISSIONS_DU_LIEU.permissions, 'leurs permissions doivent survivre intactes');
    assert.match(
      relu.hooks.PreToolUse[0].hooks[0].command,
      /\$HOME\/\.somtech\/naissance-representant\/hooks\/garde-ouverture-ligne\.js/
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('poserGarde reste idempotent sur disque — reposer deux fois ne change plus rien', () => {
  const repoRoot = repoTemp();
  try {
    poserLeLieu(repoRoot, 'acme');
    poserGarde(repoRoot, 'acme');
    const premierContenu = readFileSync(join(cheminLieu(repoRoot, 'acme'), '.claude', 'settings.json'), 'utf8');
    poserGarde(repoRoot, 'acme');
    const secondContenu = readFileSync(join(cheminLieu(repoRoot, 'acme'), '.claude', 'settings.json'), 'utf8');
    assert.equal(premierContenu, secondContenu);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('VÉRIFICATION — deux naissances du même client posent un garde OCTET POUR OCTET identique', () => {
  // « Le représentant est-il le même à chaque naissance ? » — comparé ici sur ce que la
  // naissance elle-même écrit (le hook, une fois fusionné), sans relire le gabarit
  // CLAUDE.md/CONTEXTE.md : celui-ci est déjà comparé octet pour octet par
  // cli/test/lib/metier-representant.js (contrôle « aucune-substitution »).
  const repoRoot = repoTemp();
  try {
    poserLeLieu(repoRoot, 'acme');
    poserGarde(repoRoot, 'acme');
    const contenu1 = gardePose(repoRoot, 'acme');

    // Deux CLIENTS DIFFÉRENTS, avec des permissions de départ IDENTIQUES (le cas réel :
    // le même gabarit est copié pour chacun) : le garde fusionné doit être identique.
    poserLeLieu(repoRoot, 'autre-client');
    poserGarde(repoRoot, 'autre-client');
    const contenuAutre = gardePose(repoRoot, 'autre-client');
    assert.deepEqual(contenu1, contenuAutre, 'le garde doit être identique quel que soit le client');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

// ═══════════════════════════════ les commandes herdr — construites, jamais exécutées ici

test('commandesNaissance exige --workspace, sans deviner un défaut', () => {
  assert.throws(() => commandesNaissance('/repo', 'acme', {}), /--workspace/);
});

test('commandesNaissance construit des tableaux d’arguments herdr — AUCUN shell, comme herdr.js', () => {
  const c = commandesNaissance('/repo', 'acme', { workspace: 'w1' });
  assert.deepEqual(c.tabCreate, [
    'tab', 'create', '--workspace', 'w1', '--cwd', '/repo/.gestionnaire/acme', '--label', 'acme', '--no-focus',
  ]);
  assert.deepEqual(c.renommer('w1:p1'), ['agent', 'rename', 'w1:p1', 'acme']);
  assert.deepEqual(c.interroger('w1:p1'), ['agent', 'get', 'w1:p1']);
  assert.deepEqual(c.fermer('w1:p1'), ['pane', 'close', 'w1:p1']);
});

// T-20260809-0023, défaut le plus grave : le pane naissait là où herdr l'ouvrait, pas dans le
// lieu. Le `cd` de `pane run` ne suffit pas — une ligne écrite dans un shell qui n'est pas
// encore prêt est perdue en entier. Le lieu doit être posé à la CRÉATION du pane.
test('le pane naît DANS le lieu — `--cwd` à la création, pas seulement un `cd` écrit ensuite', () => {
  const c = commandesNaissance('/repo', 'acme', { workspace: 'w1' });
  const i = c.tabCreate.indexOf('--cwd');
  assert.notEqual(i, -1, '`tab create` doit porter --cwd : sans lui, la session naît n’importe où');
  assert.equal(c.tabCreate[i + 1], '/repo/.gestionnaire/acme');
});

test('commandesNaissance lance depuis le lieu lui-même (cd) — .mcp.json et .claude/settings.json s’y lisent sans drapeau', () => {
  const c = commandesNaissance('/repo', 'acme', { workspace: 'w1' });
  assert.deepEqual(c.paneRun('w1:p1'), ['pane', 'run', 'w1:p1', 'cd /repo/.gestionnaire/acme && claude']);
});

test('cheminLieu reste sous la racine passée', () => {
  assert.match(cheminLieu('/un/repo', 'acme'), /^\/un\/repo\/\.gestionnaire\/acme$/);
});

// ── Lire une réponse herdr — la porte par laquelle « 0 alors que rien n'a abouti » est passé.

test('une réponse herdr porteuse d’une `error` n’est JAMAIS un succès, même sortie en 0', () => {
  // C'est EXACTEMENT ce que le vrai service a rendu au premier usage réel (T-20260809-0023) :
  // `{"error":{"code":"agent_not_found"}}`. L'ancien code ne lisait pas ce résultat.
  const v = lireReponseHerdr('{"error":{"code":"agent_not_found","message":"agent target w26:p1Y not found"}}', {
    commande: ['agent', 'rename', 'w26:p1Y', 'maxime'],
  });
  assert.equal(v.ok, false);
  assert.match(v.message, /agent_not_found|not found/);
  assert.match(v.message, /herdr agent rename/, 'le message doit dire QUELLE commande a refusé');
});

test('une réponse sans `result` exploitable n’est pas un succès non plus', () => {
  assert.equal(lireReponseHerdr('{"result":null}').ok, false);
  assert.equal(lireReponseHerdr('{}').ok, false);
  assert.equal(lireReponseHerdr('').ok, false);
  assert.equal(lireReponseHerdr('pas du json du tout').ok, false);
});

test('une réponse pleine est un succès, et rend l’objet lu', () => {
  const v = lireReponseHerdr('{"result":{"root_pane":{"pane_id":"w9:p1"}}}', { commande: ['tab', 'create'] });
  assert.equal(v.ok, true);
  assert.equal(v.reponse.result.root_pane.pane_id, 'w9:p1');
});

test('un processus herdr en échec sans sortie JSON reste un échec, avec son message', () => {
  const v = lireReponseHerdr('', { commande: ['pane', 'run'], erreurProcessus: new Error('spawn herdr ENOENT') });
  assert.equal(v.ok, false);
  assert.match(v.message, /ENOENT/);
});

// Mesuré contre le vrai service : `herdr pane run` réussi ne rend RIEN. La première version
// du correctif l'exigeait quand même et faisait échouer une naissance parfaitement réussie —
// le double, lui, répondait `{"result":{"ok":true}}` et n'a rien vu.
test('une commande qui ne répond pas (pane run) réussit sur une sortie vide — et seulement si on l’a déclaré', () => {
  assert.equal(lireReponseHerdr('', { commande: ['pane', 'run'], resultatAttendu: false }).ok, true);
  assert.equal(lireReponseHerdr('   \n', { commande: ['pane', 'run'], resultatAttendu: false }).ok, true);
  assert.equal(lireReponseHerdr('', { commande: ['tab', 'create'] }).ok, false, 'là où un résultat est attendu, le silence reste un échec');
});

test('un refus reste un refus même pour une commande qui ne répond pas — le code de sortie ne décide rien', () => {
  const v = lireReponseHerdr('{"error":{"code":"pane_not_found"}}', {
    commande: ['pane', 'run'],
    resultatAttendu: false,
  });
  assert.equal(v.ok, false);
  assert.match(v.message, /pane_not_found/);
});

// ── Vérifier par le fait, jamais par le mot (/orchestrer-chantier §4b).

test('agentDetecte refuse `{"error":…,"result":null}` — le mot « result » y est pourtant', () => {
  assert.equal(agentDetecte({ error: { code: 'agent_not_found' }, result: null }), false);
  assert.equal(agentDetecte({ result: null }), false);
  assert.equal(agentDetecte({ result: {} }), false, 'un result sans agent n’est pas un agent détecté');
  assert.equal(agentDetecte({ result: { agent: { name: 'acme' } } }), true);
});

test('le nom porté se compare sans la casse — herdr impose les minuscules, la convention écrit en majuscules', () => {
  const rep = { result: { agent: { name: 'd-20260807-0005' } } };
  assert.equal(agentPorteLeNom(rep, 'D-20260807-0005'), true);
  assert.equal(agentPorteLeNom(rep, 'autre'), false);
  assert.equal(agentPorteLeNom({ result: {} }, 'acme'), false);
});

test('le répertoire réel est celui du processus au premier plan, pas celui du shell resté en arrière', () => {
  assert.equal(
    repertoireDeLaSession({ result: { agent: { cwd: '/depot', foreground_cwd: '/depot/.gestionnaire/acme' } } }),
    '/depot/.gestionnaire/acme'
  );
  assert.equal(repertoireDeLaSession({ result: { agent: { cwd: '/depot' } } }), '/depot');
  assert.equal(repertoireDeLaSession({ result: null }), null);
});

// ── Le nom de l'agent : refusé AVANT de créer un pane, jamais après.

test('nomAgentHerdr abaisse la casse — herdr refuse les majuscules (`invalid_agent_name`)', () => {
  assert.equal(nomAgentHerdr('Acme'), 'acme');
  assert.equal(nomAgentHerdr('maxime'), 'maxime');
  assert.equal(nomAgentHerdr('ville-de-quebec_2'), 'ville-de-quebec_2');
});

test('nomAgentHerdr refuse ce que herdr refuserait — et il le refuse AVANT qu’un pane existe', () => {
  assert.throws(() => nomAgentHerdr('2acme'), /minuscule/, 'un nom ne commence pas par un chiffre');
  assert.throws(() => nomAgentHerdr('acme corp'), /minuscule/, 'pas d’espace');
  assert.throws(() => nomAgentHerdr('acmé'), /minuscule/, 'pas d’accent');
  assert.throws(() => nomAgentHerdr(''), /minuscule/);
  assert.throws(() => nomAgentHerdr('a'.repeat(33)), /minuscule/, '32 caractères au plus');
});

test('commandesNaissance refuse un client innommable AVANT de construire quoi que ce soit', () => {
  // DEUX règles se prononcent ici, et depuis T-20260814-0101 elles ne sont plus la même :
  //
  //   • celle du LIEU (`lieu-nom.js`) — un seul segment de chemin, casse libre. Elle passe la
  //     PREMIÈRE, parce qu'elle est la garde de sécurité : un nom qui traverse un répertoire
  //     ne doit atteindre ni un `readdirSync`, ni la composition d'une commande shell ;
  //   • celle de HERDR (`nomAgentHerdr`) — minuscules, 32 caractères au plus.
  //
  // Un nom peut être un lieu valide et un agent impossible (33 caractères) : les deux gardes
  // doivent donc mordre séparément, et aucune ne doit avaler l'autre.
  assert.throws(
    () => commandesNaissance('/repo', 'Acme Corp', { workspace: 'w1' }),
    /segment de chemin/,
    'un espace ne fait pas un nom de dossier — refusé par la garde du lieu, avant toute construction',
  );
  assert.throws(
    () => commandesNaissance('/repo', '../evil', { workspace: 'w1' }),
    /segment de chemin/,
    'et un nom qui traverse un répertoire ne doit jamais atteindre la commande « cd <lieu> && claude »',
  );
  assert.throws(
    () => commandesNaissance('/repo', 'a'.repeat(33), { workspace: 'w1' }),
    /minuscule/,
    'un lieu parfaitement valide peut rester innommable pour herdr — la seconde garde doit mordre aussi',
  );
});

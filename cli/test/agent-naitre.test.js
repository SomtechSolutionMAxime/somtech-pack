// agent-naitre.test.js — LA PORTE D'ENTRÉE, et surtout sa moitié qui S'ARRÊTE (T-20260816-0038).
//
// La preuve attendue tient dans deux moitiés, et sans la seconde la première ne prouve rien :
// une naissance complète sans qu'un humain touche un écran, ET un arrêt franc qui nomme ce qui
// manque au lieu de rendre un succès à moitié. La première moitié se prouve par le fait, contre
// un vrai herdr et un vrai `claude` (voir `scripts/tests/`). C'est la seconde qui se prouve ici.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cmdAgent, cheminDeLaNaissance, racineDeLaNaissance, argumentsDeNaissance, espaceDeTravail, AIDE_AGENT,
} from '../src/commands/agent.js';

/** La racine de ce dépôt — cli/test → cli → racine. */
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function bac() {
  return mkdtempSync(join(tmpdir(), 'agent-naitre-'));
}

/** Un faux payload : juste assez pour que la résolution le reconnaisse. */
function payload(d, { avecNaissance = true } = {}) {
  writeFileSync(join(d, 'pack.json'), JSON.stringify({ modules: {} }));
  if (avecNaissance) {
    mkdirSync(join(d, 'naissance-representant', 'bin'), { recursive: true });
    writeFileSync(join(d, 'naissance-representant', 'bin', 'naitre.js'), '// factice\n');
  }
  return d;
}

/** Un double de `spawnSync` qui note ce qu'on lui a demandé de lancer. */
function lanceurFactice(status = 0) {
  const appels = [];
  const lancer = (bin, args, opts) => {
    appels.push({ bin, args, opts });
    return { status };
  };
  return { lancer, appels };
}

const silence = () => {
  const dits = [];
  const err = console.error;
  const log = console.log;
  console.error = (...a) => dits.push(a.join(' '));
  console.log = (...a) => dits.push(a.join(' '));
  return { dits, rendre: () => { console.error = err; console.log = log; } };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 — ELLE EXÉCUTE LE CODE DU PAQUET, JAMAIS CELUI D'UNE COPIE DE POSTE

test('la naissance lancée est celle du PAYLOAD — c’est ce qui ferme la dérive du geste n°3', () => {
  // MESURÉ le 2026-08-16 : `~/.somtech/naissance-representant/src/session.js` est ABSENT
  // alors que le payload le porte, et le poste tourne 1.55.0 quand le dépôt est en 1.56.0.
  // Une commande qui vivrait dans la copie de poste serait périodiquement en retard sur
  // elle-même, sans que personne le voie. Cet essai garde le chemin, pas l'intention.
  const d = payload(bac());
  const chemin = cheminDeLaNaissance({ source: d });
  assert.equal(chemin, join(resolve(d), 'naissance-representant', 'bin', 'naitre.js'));
  assert.ok(!chemin.includes('.somtech'), 'la porte ne doit jamais viser l’outillage de poste');
  rmSync(d, { recursive: true, force: true });
});

test('un paquet SANS le module s’arrête en le nommant — pas de succès à moitié', () => {
  const d = payload(bac(), { avecNaissance: false });
  assert.throws(
    () => cheminDeLaNaissance({ source: d }),
    (e) => {
      assert.match(e.message, /naissance-representant/, 'le module manquant doit être nommé');
      assert.match(e.message, /geste qui lève le blocage/, 'un arrêt sans geste laisse le lecteur bloqué');
      return true;
    }
  );
  rmSync(d, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 — L'ARRÊT FRANC, ET IL DOIT NOMMER

test('sans --depot, elle refuse et DIT pourquoi ça compte — elle ne vise pas un dépôt au hasard', async () => {
  const s = silence();
  const code = await cmdAgent(['naitre', 'j-20260814-0002']);
  s.rendre();
  assert.equal(code, 1);
  const dit = s.dits.join('\n');
  assert.match(dit, /--depot/);
  assert.match(dit, /dépôt du chantier/i, 'le refus doit dire à quoi sert ce qu’il réclame');
});

test('sans code de mandat, elle refuse — un agent sans code est un agent qu’on ne retrouve pas', async () => {
  const s = silence();
  const code = await cmdAgent(['naitre', '--depot', '/tmp']);
  s.rendre();
  assert.equal(code, 1);
  assert.match(s.dits.join('\n'), /code du mandat/i);
});

test('une sous-commande inconnue est refusée, et l’aide est montrée — jamais devinée', async () => {
  const s = silence();
  const code = await cmdAgent(['ressusciter', 'x']);
  s.rendre();
  assert.equal(code, 1);
  assert.match(s.dits.join('\n'), /Sous-commande inconnue/);
});

test('l’aide nomme les DEUX moitiés de la promesse — celle qui aboutit et celle qui s’arrête', () => {
  assert.match(AIDE_AGENT, /DÉCLARANT\s+le\s+modèle/i, 'le lancement nu est ce qu’on remplace : l’aide doit le dire');
  assert.match(AIDE_AGENT, /S'ARRÊTE|S’ARRÊTE/, 'la moitié qui s’arrête doit être promise autant que l’autre');
  assert.match(AIDE_AGENT, /succès à moitié/i);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 — CE QU'ELLE RELAIE, ET DANS QUEL ORDRE

test('les options de la naissance sont relayées telles quelles — la porte ne les redéclare pas', () => {
  const a = argumentsDeNaissance('p-20260815-0002', {
    depot: '/depot',
    workspace: 'w7',
    role: 'orchestrateur',
    session: 'somtech',
    modele: 'sonnet',
    mode: 'acceptEdits',
    amorceTexte: 'commence par lire le registre',
  });
  assert.deepEqual(a, [
    'p-20260815-0002',
    '--workspace', 'w7',
    '--depot', resolve('/depot'),
    '--role', 'orchestrateur',
    '--session', 'somtech',
    '--modele', 'sonnet',
    '--mode', 'acceptEdits',
    '--amorce-texte', 'commence par lire le registre',
  ]);
});

test('le rôle par défaut est ORCHESTRATEUR, à l’inverse de la commande sous-jacente', () => {
  // ⚠️ `naitre.js` a `representant` par défaut, et c'est délibéré chez lui : la commande existait
  // pour ce rôle, et un appelant déjà écrit ne doit pas changer de comportement. Mais cette
  // porte-ci est neuve, et elle sert le chantier d'un orchestrateur. Laisser le défaut de
  // l'autre ferait naître une représentante dans `.gestionnaire/<nom>` — et si les deux lieux
  // coexistent, elle RÉUSSIT en silence. C'est le défaut nommé au décompte, et il se referme ici
  // en écrivant le rôle à chaque fois plutôt qu'en l'omettant.
  const a = argumentsDeNaissance('j-1', { depot: '/d', workspace: 'w1' });
  assert.ok(a.includes('--role'));
  assert.equal(a[a.indexOf('--role') + 1], 'orchestrateur');
});

test('ce qui n’est pas demandé n’est pas relayé — pas d’option vide qui vaudrait valeur', () => {
  const a = argumentsDeNaissance('j-1', { depot: '/d', workspace: 'w1' });
  for (const absente of ['--session', '--amorce', '--amorce-texte']) {
    assert.ok(!a.includes(absente), `${absente} ne doit pas apparaître quand personne ne l’a demandée`);
  }
});

test('elle lance le naitre.js du payload avec les arguments construits, et rend SON code', async () => {
  const d = payload(bac());
  const { lancer, appels } = lanceurFactice(3);
  const s = silence();
  const code = await cmdAgent(
    ['naitre', 'j-20260814-0002', '--depot', d, '--workspace', 'w7', '--source', d],
    { lancer }
  );
  s.rendre();
  assert.equal(code, 3, 'un échec de la naissance doit ressortir tel quel — jamais avalé en 0');
  assert.equal(appels.length, 1);
  assert.equal(appels[0].args[0], join(resolve(d), 'naissance-representant', 'bin', 'naitre.js'));
  assert.ok(appels[0].args.includes('--workspace'));
  assert.equal(appels[0].args[appels[0].args.indexOf('--workspace') + 1], 'w7');
  rmSync(d, { recursive: true, force: true });
});

test('un lanceur qui meurt sans code de sortie compte comme un ÉCHEC, jamais comme un succès', async () => {
  const d = payload(bac());
  const s = silence();
  const code = await cmdAgent(
    ['naitre', 'j-1', '--depot', d, '--workspace', 'w7', '--source', d],
    { lancer: () => ({ status: null }) }
  );
  s.rendre();
  assert.equal(code, 1, 'status null veut dire tué par un signal : l’absence de code n’est pas un 0');
  rmSync(d, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 — L'ESPACE DE TRAVAIL

test('un espace donné est réutilisé — on n’en fabrique pas un à chaque relance', () => {
  const r = espaceDeTravail({ depot: '/d', code: 'j-1', workspace: 'w26' });
  assert.deepEqual(r, { id: 'w26', cree: false });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 — D'OÙ VIENT LE CODE QU'ON EXÉCUTE — mutation SURVIVANTE trouvée par la revue de fond
//
// ⚠️ TOUS LES ESSAIS CI-DESSUS PASSENT `--source`, QUI COURT-CIRCUITE LA DÉCISION. La fonction
// qui tranche « source du dépôt » contre « produit de build » — le cœur même du correctif de ce
// fichier — n'était appelée par aucun essai. On mesurait le chemin FORCÉ (l'indice) au lieu du
// chemin CHOISI (le fait) : exactement le motif que ce lot existe pour fermer, réintroduit dans
// l'essai du correctif.

test('sans --source, la SOURCE du dépôt l’emporte sur son propre produit de build', () => {
  // Le bug réel que ça laissait passer : `cli/payload` est ignoré par git et reconstruit par un
  // essai de temps en temps. S'il l'emportait, la commande exécuterait une version PÉRIMÉE
  // d'elle-même, en silence — la dérive `~/.somtech` rejouée à l'intérieur du dépôt.
  const racine = racineDeLaNaissance();
  assert.ok(existsSync(join(racine, 'pack.json')), 'la racine choisie doit porter un pack.json');
  assert.ok(existsSync(join(racine, '.git')), 'et être une copie de travail — c’est ce qui la qualifie de source');
  assert.ok(
    !racine.split(sep).includes('payload'),
    `la racine choisie est un produit de build : ${racine} — la commande serait périmée sans le dire`
  );
  assert.equal(racine, resolve(REPO), 'depuis ce dépôt, la source EST la racine du dépôt');
});

test('et le naitre.js visé sans --source est celui de la source, pas celui du build', () => {
  const chemin = cheminDeLaNaissance({});
  assert.equal(chemin, join(resolve(REPO), 'naissance-representant', 'bin', 'naitre.js'));
  assert.ok(existsSync(chemin), 'le chemin choisi doit exister — sinon la commande s’arrêterait sur un module absent');
});

test('un --source explicite reste souverain — il sert aux essais et aux cas tordus', () => {
  const d = payload(bac());
  assert.equal(cheminDeLaNaissance({ source: d }), join(resolve(d), 'naissance-representant', 'bin', 'naitre.js'));
  rmSync(d, { recursive: true, force: true });
});

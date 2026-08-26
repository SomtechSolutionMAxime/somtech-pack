// metier-garde-terminal.test.js — la garde qui ferme la brèche du terminal.
//
// Le classement par couche a nommé cette brèche : `GF-ORC-001` interdit d'écrire
// un fichier, et `permissions.deny` le garantit pour les outils d'édition — mais
// PAS pour le terminal. Une redirection écrit un fichier sans passer par eux, et
// le métier lui-même le reconnaît : « c'est à toi de ne pas le faire ».
//
// Ces tests gardent la décision PURE. Le fil qui la branche ne décide de rien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { juger } from '../src/metier/gardes/terminal.js';

const DEPOT = '/Users/x/worktrees/pack/20260820';

const permis = (cmd, opts = {}) => juger({ commande: cmd, depot: DEPOT, ...opts }).decision === 'allow';
const refuse = (cmd, opts = {}) => juger({ commande: cmd, depot: DEPOT, ...opts }).decision === 'deny';

test('une lecture passe — la garde ferme l écriture, pas le travail', () => {
  for (const c of ['git status', 'ls -la', 'cat fichier.md', 'grep -rn motif .',
                   'node --test test/x.test.js', 'git log --oneline -5', 'wc -l a b']) {
    assert.ok(permis(c), `« ${c} » doit passer`);
  }
});

test('une redirection qui écrit un fichier est REFUSÉE — c est la brèche nommée', () => {
  for (const c of ['echo x > fichier.md', 'cat a >> b.md', 'printf "y" >|z', 'ls . 1> out.txt']) {
    assert.ok(refuse(c), `« ${c} » écrit un fichier sans passer par un outil d édition`);
  }
});

test('les autres écritures du terminal sont refusées aussi — une porte sur deux ne ferme rien', () => {
  for (const c of ['tee fichier.md', 'sed -i "" s/a/b/ f.md', 'cp a b', 'mv a b', 'rm -f a',
                   'truncate -s 0 f', 'dd of=f', 'install -m 644 a b', 'ln -s a b',
                   'python3 -c "open(\'f\',\'w\').write(1)"', 'mkdir -p x']) {
    assert.ok(refuse(c), `« ${c} » écrit, et doit être refusé comme une redirection`);
  }
});

test('une redirection vers le VIDE ou vers la sortie standard passe — elle n écrit aucun fichier', () => {
  for (const c of ['grep x f 2>/dev/null', 'cmd > /dev/null', 'cmd 2>&1 | head']) {
    assert.ok(permis(c), `« ${c} » n écrit aucun fichier`);
  }
});

test('un chemin hors du dépôt du chantier est refusé — GF-ORC-007', () => {
  assert.ok(refuse('cat /Users/x/GitRepo.nosync/autre-projet/f.md'));
  assert.ok(refuse('git -C /Users/x/GitRepo.nosync/autre log'));
  assert.ok(permis('cat ' + DEPOT + '/README.md'));
  assert.ok(permis('cat ./README.md'));
});

test('le scratchpad et les lieux de session restent ouverts — sinon la garde empêche de travailler', () => {
  assert.ok(permis('cat /private/tmp/claude-501/abc/scratchpad/note.md'));
  assert.ok(permis('echo x > /private/tmp/claude-501/abc/scratchpad/note.md'));
});

test('le refus DIT ce qu il a mesuré et à qui le geste appartient', () => {
  const d = juger({ commande: 'echo x > f.md', depot: DEPOT });
  assert.equal(d.decision, 'deny');
  assert.match(d.raison, /redirection|écrit/i);
  assert.ok(d.raison.length > 40, 'un refus qui ne dit rien se contourne sans réfléchir');
});

test('devant une commande qu elle ne comprend pas, la garde REFUSE — un garde absent ne vaut jamais un garde permissif', () => {
  assert.ok(refuse(''), 'commande vide');
  assert.ok(refuse(undefined), 'commande absente');
  assert.ok(juger({ commande: 'ls', depot: undefined }).decision === 'deny', 'dépôt inconnu');
});

test('🔴 un rôle que la garde ne CONNAÎT pas est refusé — et cet essai disait le contraire', () => {
  // ⚠️ CET ESSAI GARDAIT LE DÉFAUT (T-20260826-0079). Il exigeait `allow` sur
  // `role: 'chef-equipe'`, au nom de « elle ne décide pas pour les autres ». Mais un rôle
  // absent de la table ne repartait pas neutre : il repartait AUTORISÉ, sans qu'une seule
  // ligne de sa commande soit examinée. Neuf rôles arbitrés (P-20260819-0001) allaient
  // passer par là, chacun sans garde de terminal, et la garde ne se serait pas tue — elle
  // aurait dit « d'accord ».
  //
  // L'en-tête de `terminal.js` prescrivait déjà l'inverse, et les deux autres gardes du
  // dispositif l'appliquaient : `ecriture.js` refuse un rôle inconnu, `ligne-cliente.js`
  // aussi. Celle-ci était la seule à ne pas le faire.
  assert.equal(juger({ commande: 'echo x > f.md', depot: DEPOT, role: 'chef-equipe' }).decision, 'deny');
  assert.equal(juger({ commande: 'echo x > f.md', depot: DEPOT, role: 'orchestrateur' }).decision, 'deny');
});

test('le refus par rôle inconnu NOMME sa cause et le geste qui débloque', () => {
  // Les deux refusent : l'issue seule ne les distingue pas, et c'est la cause que lit
  // celui qui est bloqué. « La règle te l'interdit » et « je n'ai pas su qui tu es »
  // n'appellent pas le même geste — sans cette garde, effacer la distinction ne
  // rougirait rien.
  const parRole = juger({ commande: 'echo x > f.md', depot: DEPOT, role: 'chef-equipe' }).raison;
  const parRegle = juger({ commande: 'echo x > f.md', depot: DEPOT, role: 'orchestrateur' }).raison;

  assert.match(parRole, /n'a pas su établir à quel rôle/,
    'le refus par prudence doit dire que le rôle n a pas été mesuré');
  assert.match(parRole, /roles-connus/,
    'un refus qui ne dit pas le geste qui le lève renvoie son lecteur à lui-même');
  assert.doesNotMatch(parRegle, /n'a pas su établir à quel rôle/,
    'un orchestrateur est refusé par la RÈGLE, pas parce qu on ignore qui il est');
  assert.notEqual(parRole, parRegle);
});

test('les deux noms du représentant sont jugés, jamais bloqués en bloc — le lieu et le registre ne le nomment pas pareil', () => {
  // MESURÉ : `lieu-agent.roleDuLieu()` rend la clé de registre (« representant »),
  // `gardes/ligne-cliente.js` rend le nom de gabarit (« gestionnaire-client »). La table
  // ne connaissait que le second. Sous le refus par défaut, le premier aurait fait
  // refuser TOUTES les commandes d un représentant correctement né.
  for (const role of ['representant', 'gestionnaire-client']) {
    assert.ok(permis('git status', { role }), `« ${role} » doit pouvoir travailler`);
    assert.ok(refuse('echo x > f.md', { role }), `« ${role} » n écrit pas plus qu un autre`);
  }
});

// ——— les deux faux refus mesurés sur du trafic réel, le 2026-08-20 ———
// RA-ORC-029 : une garde se juge sur DEUX chiffres — ce qu'elle attrape, et ce
// qu'elle refuse à tort. Mesurée sur les 53 lignes de commande que le métier
// prescrit lui-même à l'orchestrateur, elle en refusait 2. Les voici.

test('un interpréteur qui LIT passe ; seul celui qui écrit est refusé', () => {
  assert.ok(permis('| python3 -c "import json,sys;print(json.load(sys.stdin)[1])"'),
    'refuser toute commande python3 -c refuse aussi les lectures — mesuré sur trafic réel');
  assert.ok(permis("node -e \"console.log(require('./p.json').version)\""));
  assert.ok(refuse('python3 -c "open(\'f\',\'w\').write(1)"'));
  assert.ok(refuse('node -e "require(\'fs\').writeFileSync(\'f\',\'x\')"'));
  assert.ok(refuse('python3 -c "from pathlib import Path; Path(\'f\').write_text(1)"'));
});

test('une commande slash n est pas un chemin — `/goal` n est pas un répertoire', () => {
  assert.ok(permis(`herdr pane run "$P" '/goal <condition de fin>'`),
    '`/goal` était pris pour un chemin absolu hors du dépôt — mesuré sur trafic réel');
  assert.ok(permis("herdr pane run p '/model opus'"));
  assert.ok(permis("cmd '/clear'"));
  // ⚠️ et la correction ne doit pas rouvrir la porte qu'elle borde :
  assert.ok(refuse('cat /Users/x/autre-depot/f.md'), 'un vrai chemin absolu reste refusé');
  assert.ok(refuse('cat /etc/passwd'));
});

test('la copie distribuée de la décision est identique à sa source — deux copies divergent en silence', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/metier/gardes/terminal.js', import.meta.url), 'utf8');
  const distribuee = readFileSync(new URL('../../gardes/terminal-decision.js', import.meta.url), 'utf8');
  assert.equal(distribuee, source,
    'scripts/gardes/terminal-decision.js a divergé de cli/src/metier/gardes/terminal.js — ' +
    'une copie amputée laisse passer sans qu un seul essai rougisse');
});

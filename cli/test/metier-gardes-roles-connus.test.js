// metier-gardes-roles-connus.test.js — LA table des rôles que les gardes savent lire.
//
// DÉFAUT FERMÉ (T-20260826-0079) : `terminal.js` portait sa liste de rôles, et tout rôle
// absent de ses deux entrées repartait avec un `allow()` sans qu'une ligne de sa commande
// soit examinée. `ligne-cliente.js` portait la SIENNE, sous le même nom, avec un autre
// sens, et refusait le même cas. Deux gardes voisines, verdicts opposés.
//
// Ce qui suit garde trois choses, et elles ne sont pas interchangeables :
//   ① la table est UNE — et la copie déposée sur le poste ne dérive pas de celle-ci ;
//   ② un rôle inscrit au REGISTRE et absent de la table fait rougir ici, avant de faire
//      naître un agent que ses gardes ne savent pas lire ;
//   ③ quand la table manque au poste, le fil du hook échoue FERMÉ — un garde absent ne
//      vaut jamais un garde permissif, y compris au milieu d'une installation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ROLES_CONNUS, NOMS_DU_ROLE } from '../src/metier/gardes/roles-connus.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = join(RACINE, 'cli', 'src', 'metier', 'gardes');
const POSTE = join(RACINE, 'gardes');

test('la table est DÉRIVÉE de ses noms — une seconde énumération se désaccorderait au premier ajout', () => {
  assert.deepEqual([...ROLES_CONNUS].sort(), [...new Set(Object.values(NOMS_DU_ROLE).flat())].sort());
  assert.ok(ROLES_CONNUS.size >= 3,
    `${ROLES_CONNUS.size} nom(s) : un contrôle qui ne trouve presque rien à vérifier passe pour satisfait`);
});

test('les deux noms du représentant sont dans la table — le lieu et le registre ne le nomment pas pareil', () => {
  // MESURÉ le 2026-08-26, et c'est la divergence qui a motivé la mise en commun :
  //   • `ligne-directe/src/lieu-agent.js` → `roleDuLieu()` rend une CLÉ DE REGISTRE ;
  //   • `gardes/ligne-cliente.js` → son propre `roleDuLieu()` rend un NOM DE GABARIT.
  // Deux fonctions du même nom, deux mots pour le même rôle, et les deux atteignent une
  // garde. N'en connaître qu'un fait refuser tout à un agent correctement né.
  assert.deepEqual(NOMS_DU_ROLE.representant.slice().sort(), ['gestionnaire-client', 'representant']);
});

test('⚠️ TOUT module de décision a sa copie déposée sur le poste, à l identique — depuis la source', () => {
  // L essai jumeau (`metier-gardes-distribuees.test.js`) dérive sa liste du répertoire du
  // POSTE, donc d un fichier `<n>-decision.js`. Il ne voit pas ce qu on ajoute du côté du
  // CLI : `roles-connus.js` n est pas une décision, il n en porte pas le suffixe, et il
  // serait resté une TROISIÈME copie libre de dériver. Celui-ci part de la source.
  const modules = readdirSync(SOURCE).filter((f) => f.endsWith('.js')).sort();
  assert.ok(modules.length >= 4,
    `${modules.length} module(s) : le contrôle doit en voir au moins quatre — un contrôle qui ne `
    + 'trouve rien à vérifier passe pour satisfait');
  for (const f of modules) {
    const decision = join(POSTE, f.replace(/\.js$/, '-decision.js'));
    // Un module de décision voyage sous `<n>-decision.js` ; ses dépendances, sous leur
    // propre nom — le fil, lui, s appelle `<n>.js` et n est pas la même chose.
    const attendu = existsSync(decision) ? decision : join(POSTE, f);
    assert.ok(existsSync(attendu),
      `« ${f} » n a aucune copie déposée sous « gardes/ » : sur le poste, l import échouerait et la `
      + 'garde refuserait tout');
    assert.equal(readFileSync(attendu, 'utf8'), readFileSync(join(SOURCE, f), 'utf8'),
      `« ${attendu} » a dérivé de « ${f} » : deux copies d un même critère divergent en silence`);
  }
});

test('⚠️ tout rôle du REGISTRE est connu des gardes — sous SES DEUX noms', async () => {
  // C est la jointure des deux étages, et c est exactement le défaut du ticket vu une
  // marche plus haut : un rôle qu on inscrit au registre naît avec des gardes qui ne
  // savent pas le lire. Sous le refus par défaut, il naîtrait BLOQUÉ sur tous ses gestes
  // de terminal — bruyant, mais découvert par l agent plutôt qu ici.
  //
  // Ce que cet essai demande N EST PAS d ouvrir un droit : déclarer un nom à
  // `roles-connus.js` ne donne rien à personne, il rend le rôle LISIBLE. Ce qu il a le
  // droit de faire se décide dans chaque garde, une par une.
  const { rolesConnus, role } = await import('../../ligne-directe/src/roles.js');
  const cles = rolesConnus();
  assert.ok(cles.length >= 2, `${cles.length} rôle(s) au registre : le contrôle ne verrait rien à vérifier`);
  for (const cle of cles) {
    assert.ok(ROLES_CONNUS.has(cle),
      `le registre déclare « ${cle} », que les gardes ne savent pas lire — déclare-le à `
      + 'cli/src/metier/gardes/roles-connus.js (et sa copie gardes/roles-connus.js)');
    const gabarit = role(cle).gabarits;
    assert.ok(ROLES_CONNUS.has(gabarit),
      `« ${cle} » se présente aussi sous son nom de gabarit « ${gabarit} » — c est ce que rend le `
      + 'roleDuLieu de gardes/ligne-cliente.js — et les gardes ne le connaissent pas sous ce nom-là');
  }
});

test('⚠️ le fil du terminal échoue FERMÉ quand la table manque au poste — installation à moitié faite', () => {
  // Le fil importe la décision, qui importe la table. Sur un poste où la copie de la table
  // n est pas arrivée, cet import LÈVE. La question n est pas s il lève — c est ce qui sort
  // alors de la garde : un `allow` y serait la brèche que tout ce dispositif ferme.
  const tmp = mkdtempSync(join(tmpdir(), 'garde-poste-'));
  try {
    const gardes = join(tmp, 'gardes');
    mkdirSync(gardes);
    mkdirSync(join(tmp, '.git'));
    for (const f of ['terminal.js', 'terminal-decision.js']) copyFileSync(join(POSTE, f), join(gardes, f));

    const requete = JSON.stringify({ tool_name: 'Bash', cwd: tmp, tool_input: { command: 'echo x > f.md' } });
    const lancer = () => execFileSync(process.execPath, [join(gardes, 'terminal.js')],
      { input: requete, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

    let sortie = '';
    try { sortie = lancer(); } catch (e) { sortie = e.stdout || ''; }
    assert.doesNotMatch(sortie, /"permissionDecision":"allow"/,
      'sans sa table, la garde a laissé passer : une installation à moitié faite rouvrirait la brèche');

    // ET LE MÊME FIL, TABLE PRÉSENTE, REND BIEN UN VERDICT — sans quoi l essai ci-dessus
    // serait satisfait par une garde qui ne répond jamais rien, ce qui ne prouve rien.
    copyFileSync(join(POSTE, 'roles-connus.js'), join(gardes, 'roles-connus.js'));
    assert.match(lancer(), /"permissionDecision":"deny"/,
      'table présente, le fil doit rendre le verdict de la décision — ici un refus d écriture');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

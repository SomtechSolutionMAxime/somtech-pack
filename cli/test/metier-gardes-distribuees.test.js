// metier-gardes-distribuees.test.js — les gardes doivent ARRIVER sur le poste.
//
// Un `settings.json` rendu déclare `~/.somtech/gardes/<garde>.js`. Si rien ne l'y
// dépose, la commande de hook refuse par défaut (bonne polarité) — mais l'agent
// est alors bloqué sur tous ses gestes de terminal. La garde doit donc être
// distribuée comme les autres outils de poste. `T-20260820-0142`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('le pack déclare un module « gardes » de portée POSTE — jamais projet', () => {
  const m = JSON.parse(readFileSync(join(RACINE, 'pack.json'), 'utf8')).modules.gardes;
  assert.ok(m, 'aucun module « gardes » : rien ne les déposerait sur le poste');
  assert.equal(m.scope, 'poste', 'une garde vit sur le poste, pas dans le lieu d un agent');
  assert.deepEqual(m.paths, ['gardes/']);
});

test('le module porte la garde ET sa décision — le fil sans décision ne juge rien', () => {
  assert.ok(existsSync(join(RACINE, 'gardes', 'terminal.js')), 'le fil du hook');
  assert.ok(existsSync(join(RACINE, 'gardes', 'terminal-decision.js')), 'la décision qu il importe');
});

test('les gardes ne partent PAS dans les projets — elles ne sont pas sous un chemin du module core', () => {
  const pack = JSON.parse(readFileSync(join(RACINE, 'pack.json'), 'utf8'));
  for (const [nom, m] of Object.entries(pack.modules)) {
    if (m.scope === 'poste') continue;
    for (const chemin of m.paths || []) {
      assert.ok(!join(RACINE, 'gardes').startsWith(join(RACINE, chemin)),
        `les gardes tomberaient dans le module projet « ${nom} » (${chemin})`);
    }
  }
});

test('le chemin que le rendu écrit et celui où le pack dépose sont le MÊME', async () => {
  const { rendre } = await import('../src/metier/rendu.js');
  const r = rendre({
    role: 'r', version_abc: '1', hooks: [{ evenement: 'PreToolUse', outil: 'Bash', garde: 'terminal' }],
    items: [{ id: 'GF-R-001', nature: 'garde-fou', couche: 'hook', enonce: 'x', enonce_socle: 'c' }],
    chapitres: [],
  });
  const cmd = JSON.parse(r.artefacts['.claude/settings.json']).hooks.PreToolUse[0].hooks[0].command;
  // `pack setup` dépose les modules de portée poste sous ~/.somtech/<paths>
  assert.ok(cmd.includes('$HOME/.somtech/gardes/terminal.js'),
    'le rendu doit viser exactement là où le pack dépose — sinon le hook cherche au mauvais endroit');
});

/**
 * LES RÔLES DONT ON LIT LE CLASSEMENT — MESURÉS SUR LE DISQUE, PLUS ÉCRITS À LA MAIN
 * (T-20260826-0083).
 *
 * La liste valait `['orchestrateur', 'gestionnaire-client']`, en toutes lettres. Mesuré le
 * 2026-08-26 : un TROISIÈME rôle déposé sous `metier/developpeur/`, réellement rendu et
 * distribué, dont le classement déclarait `garde: "garde-qui-nexiste-pas"` — une garde que
 * `gardes/` ne porte pas — laissait les SIX contrôles de ce fichier au vert. Le rôle n'était
 * pas dans la liste, donc rien ne lisait son classement : l'agent serait né avec un hook qui
 * refuse tous ses gestes de terminal, exactement le mode de panne que ce fichier prétend
 * fermer.
 *
 * ⚠️ POURQUOI `metier/*` ET NON LE REGISTRE DES RÔLES (`cli/src/commands/representant.js`) —
 * les deux ont été mesurées, et le SUJET tranche : ce contrôle lit un CLASSEMENT, et un
 * classement ne vit que sous `metier/<rôle>/classement.json`. Un rôle inscrit au registre mais
 * sans dossier de métier ne déclare aucune garde : il n'a rien à mesurer ici. C'est
 * l'énumération qui coïncide avec ce qu'on lit, pas avec ce qu'on aimerait couvrir.
 *
 * ⚠️ AUCUN FILTRE À L'ENTRÉE, ET C'EST DÉLIBÉRÉ. On prend TOUS les sous-dossiers de `metier/`.
 * Le `if (!existsSync(chemin)) continue;` d'avant était un filtre silencieux : un rôle dont le
 * classement a disparu sortait du dénominateur sans un mot, au moment précis où il fallait le
 * signaler. Ce qui manque à un rôle est désormais NOMMÉ (voir le contrôle juste dessous).
 */
function rolesDuMetier(racine) {
  const base = join(racine, 'metier');
  if (!existsSync(base)) return { roles: [], raison: `« ${base} » n’existe pas` };
  const roles = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return { roles, raison: roles.length ? null : `« ${base} » ne porte aucun sous-dossier de rôle` };
}

test('🔴 le dénominateur de ce fichier est MESURÉ, il n’est pas vide, et chaque rôle a son classement', () => {
  // ⚠️ SANS CE CONTRÔLE, LA GARDE SE DÉSARME TOUTE SEULE. Le contrôle ci-dessous parcourt
  // `ROLES` : si l’énumération rend une liste VIDE — répertoire déplacé, renommé, filtre
  // resserré — la boucle ne lit AUCUN classement et le test passe au vert en n’ayant rien
  // mesuré. « Un test qui attend RIEN ne peut pas distinguer *rien trouvé* de *rien cherché* »
  // (feed du 2026-08-25). Celui-ci fait la différence, et il rougit du côté de « rien cherché ».
  const { roles, raison } = rolesDuMetier(RACINE);
  assert.equal(raison, null,
    `l’énumération des rôles n’a rien rendu : ${raison}. La jointure des deux étages n’est alors `
    + 'pas verte — elle n’existe pas.');
  assert.ok(roles.length > 0, 'aucun rôle énuméré — voir le message ci-dessus');

  const sansClassement = roles.filter((r) => !existsSync(join(RACINE, 'metier', r, 'classement.json')));
  assert.deepEqual(sansClassement, [],
    'un rôle de metier/ n’a pas de classement.json — il ne déclare donc aucune garde, et rien ne '
    + `dirait qu’il en déclarait une hier : ${sansClassement.join(', ')}`);
});

test('⚠️ toute garde qu un classement DÉCLARE existe dans le module — c est la jointure des deux étages', () => {
  // Chaque étage est juste séparément : le rendu écrit un chemin `~/.somtech/gardes/<garde>.js`
  // (gardé plus haut), et `pack setup` dépose le module `gardes` (gardé plus haut aussi). La
  // ligne qui les relie — que la garde NOMMÉE par un classement soit bien l'un des fichiers
  // déposés — ne l'était par aucun des deux. Un classement qui déclare `garde: "x"` sans que
  // `gardes/x.js` existe rend un hook qui refuse tout, en silence, chez l'agent.
  const { roles, raison } = rolesDuMetier(RACINE);
  assert.equal(raison, null, `rien à mesurer : ${raison}`);
  let declarees = 0;
  for (const role of roles) {
    const chemin = join(RACINE, 'metier', role, 'classement.json');
    if (!existsSync(chemin)) continue;   // NOMMÉ en rouge par le contrôle ci-dessus, pas ignoré
    for (const h of JSON.parse(readFileSync(chemin, 'utf8')).hooks || []) {
      // Un hook qui porte sa propre `commande` vise un autre module (la naissance) : le
      // chemin est alors dans la commande, et il est gardé là où ce module vit.
      if (h.commande) continue;
      declarees++;
      assert.ok(existsSync(join(RACINE, 'gardes', `${h.garde}.js`)),
        `le classement de « ${role} » déclare la garde « ${h.garde} », que le module ne porte pas`);
      assert.ok(existsSync(join(RACINE, 'gardes', `${h.garde}-decision.js`)),
        `la garde « ${h.garde} » n a pas de module de décision — un fil sans décision ne juge rien`);
    }
  }
  // ⚠️ CE CHIFFRE EST UNE BORNE D'ANTI-VACUITÉ, PAS UN DÉNOMINATEUR. Il ne dit pas « combien de
  // rôles il y a » — un rôle peut légitimement ne déclarer aucun hook. Il dit qu'un parcours qui
  // ne trouve RIEN à vérifier ne doit pas passer pour satisfait : c'est le second filet, sous
  // celui qui mesure l'énumération elle-même.
  assert.ok(declarees >= 2, `le contrôle doit avoir vu au moins deux gardes déclarées (${declarees}) — `
    + `un contrôle qui ne trouve rien à vérifier passe pour satisfait. Rôles parcourus : ${roles.join(', ')}`);
});

test('la décision distribuée et celle que le CLI teste sont le MÊME texte — deux copies divergent en silence', () => {
  // ⚠️ LA LISTE EST DÉRIVÉE, PLUS ÉNUMÉRÉE — trouvé par la revue de fond du
  // 2026-08-24 : elle disait `['terminal', 'ligne-cliente']`, et la garde `ecriture`,
  // créée le même jour avec exactement la même paire de fichiers dupliqués, n'y a
  // jamais été ajoutée. Mesuré : muter la copie déposée sans muter celle que le CLI
  // exerce laissait 27/27 puis 1096/1096 au vert. Une liste énumérée ne garde que
  // ce qu'on a pensé à y écrire — et on n'y pense pas le jour où l'on ajoute.
  const gardes = readdirSync(join(RACINE, 'gardes'))
    .filter((f) => f.endsWith('-decision.js'))
    .map((f) => f.replace('-decision.js', ''))
    .sort();
  assert.ok(gardes.length >= 3,
    `${gardes.length} garde(s) trouvée(s) : le contrôle doit en voir au moins trois — `
    + 'un contrôle qui ne trouve rien à vérifier passe pour satisfait');
  for (const garde of gardes) {
    const poste = readFileSync(join(RACINE, 'gardes', `${garde}-decision.js`), 'utf8');
    const cli = readFileSync(join(RACINE, 'cli', 'src', 'metier', 'gardes', `${garde}.js`), 'utf8');
    assert.equal(poste, cli, `« ${garde} » : la copie déposée sur le poste a dérivé de celle que les tests exercent`);
  }
});

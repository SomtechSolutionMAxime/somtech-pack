// approbation.test.js — le lieu approuvé avant la naissance, et la prudence que mérite un
// fichier dont dépendent TOUTES les sessions du poste.
//
// Le défaut que ce module corrige est décrit en tête de `src/approbation.js` : une session
// née dans un répertoire jamais vu s'arrête sur l'écran de confiance, détectée, dans le bon
// répertoire, portant son nom — et ne commence jamais.
//
// Ce que cette suite garde surtout, c'est le RISQUE INTRODUIT par le correctif : écrire dans
// `~/.claude.json`. Un correctif qui règle un défaut en cassant 102 projets serait pire que
// le défaut. Aucun test ici ne touche au vrai fichier du poste — le chemin est injecté.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, chmodSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  approuverLieu, avecApprobation, dejaApprouve, ConfigIllisible, cheminConfig,
  serveursDuLieu, formesDuLieu, droitsDuLieu,
} from '../src/approbation.js';

function bac() {
  return mkdtempSync(join(tmpdir(), 'approb-'));
}

/**
 * UNE ENTRÉE DE PROJET COMPLÈTE — la forme que Claude Code écrit lui-même (T-20260816-0032).
 *
 * Elle est ici plutôt que recopiée dans chaque essai pour une raison précise : le jour où une
 * clé de plus deviendra nécessaire, un fixture recopié à cinq endroits en oublierait quatre, et
 * les essais continueraient de dire que tout va bien pendant que l’écran reviendrait.
 */
function entreeComplete(extra = {}) {
  return {
    allowedTools: [], mcpContextUris: [], mcpServers: {},
    enabledMcpjsonServers: [], disabledMcpjsonServers: [],
    hasTrustDialogAccepted: true, projectOnboardingSeenCount: 1,
    hasClaudeMdExternalIncludesApproved: true, hasClaudeMdExternalIncludesWarningShown: true,
    hasCompletedProjectOnboarding: true,
    ...extra,
  };
}

test('le lieu devient approuvé — c’est ce qui empêche l’écran de confiance d’arrêter la session', () => {
  const d = bac();
  const config = join(d, 'config.json');
  writeFileSync(config, JSON.stringify({ projects: {} }));

  const r = approuverLieu('/un/lieu', { chemin: config });
  assert.equal(r.approuve, true);
  assert.equal(r.deja, false);
  assert.equal(JSON.parse(readFileSync(config, 'utf8')).projects['/un/lieu'].hasTrustDialogAccepted, true);
});

test('TOUT LE RESTE est conservé — on ajoute une approbation, on ne redéfinit pas le poste', () => {
  // Le vrai fichier porte une centaine de projets et une trentaine de clés de premier
  // niveau. En perdre une seule casserait quelque chose, et personne ne saurait quoi.
  const d = bac();
  const config = join(d, 'config.json');
  const avant = {
    numStartups: 41,
    theme: 'dark',
    projects: {
      '/autre/projet': { hasTrustDialogAccepted: true, allowedTools: ['Read'] },
      '/un/lieu': { allowedTools: ['Grep'], enabledMcpjsonServers: ['servicedesk'] },
    },
  };
  writeFileSync(config, JSON.stringify(avant));

  approuverLieu('/un/lieu', { chemin: config });
  const apres = JSON.parse(readFileSync(config, 'utf8'));

  assert.equal(apres.numStartups, 41);
  assert.equal(apres.theme, 'dark');
  assert.deepEqual(apres.projects['/autre/projet'], avant.projects['/autre/projet']);
  // Les clés du projet visé survivent aussi : on ajoute une approbation à un projet, on ne
  // le remplace pas — sinon ses outils permis et ses serveurs disparaîtraient en silence.
  assert.deepEqual(apres.projects['/un/lieu'].allowedTools, ['Grep']);
  assert.deepEqual(apres.projects['/un/lieu'].enabledMcpjsonServers, ['servicedesk']);
  assert.equal(apres.projects['/un/lieu'].hasTrustDialogAccepted, true);
});

test('déjà approuvé : AUCUNE écriture — la meilleure façon de ne pas corrompre est de ne pas ouvrir', () => {
  const d = bac();
  const config = join(d, 'config.json');
  // ⚠️ LE FIXTURE PORTE LE JEU DE CLÉS COMPLET depuis T-20260816-0032 : une entrée qui ne porte
  // que la confiance n’est plus tenue pour approuvée, parce qu’elle laisse revenir l’écran des
  // serveurs (mesuré sur Claude Code 2.1.233). Ce test garde « aucune écriture quand tout est
  // déjà là » ; c’est « tout » qui a changé de définition, pas ce qu’il garde.
  writeFileSync(config, JSON.stringify({ projects: { '/un/lieu': entreeComplete() } }));
  // Un fichier en lecture seule : toute tentative d'écriture ferait échouer l'appel. C'est la
  // preuve par le fait qu'aucune écriture n'a lieu, plutôt que par la comparaison du contenu.
  chmodSync(config, 0o444);

  const r = approuverLieu('/un/lieu', { chemin: config });
  assert.equal(r.deja, true);
  chmodSync(config, 0o644);
});

test('un fichier PRÉSENT mais illisible fait ÉCHOUER — jamais repartir d’un objet vide', () => {
  // Le mode de panne à éviter à tout prix : un JSON tronqué (par un disque plein, un
  // processus tué) qui serait « réparé » en écrasant 102 projets par un seul.
  const d = bac();
  const config = join(d, 'config.json');
  const tronque = '{"projects":{"/autre":{"hasTrustDialogAccepted":true}';
  writeFileSync(config, tronque);

  assert.throws(() => approuverLieu('/un/lieu', { chemin: config }), ConfigIllisible);
  assert.equal(readFileSync(config, 'utf8'), tronque, 'le fichier illisible a été réécrit');
});

test('un contenu qui n’est pas un objet est refusé au même titre', () => {
  const d = bac();
  const config = join(d, 'config.json');
  for (const contenu of ['[]', '"texte"', '42', 'null']) {
    writeFileSync(config, contenu);
    assert.throws(() => approuverLieu('/un/lieu', { chemin: config }), ConfigIllisible, `« ${contenu} » a été accepté`);
    assert.equal(readFileSync(config, 'utf8'), contenu);
  }
});

test('un poste neuf (fichier absent) part d’un objet vide — et n’efface rien, il n’y avait rien', () => {
  const d = bac();
  const config = join(d, 'config.json');
  const r = approuverLieu('/un/lieu', { chemin: config });
  assert.equal(r.approuve, true);
  assert.equal(JSON.parse(readFileSync(config, 'utf8')).projects['/un/lieu'].hasTrustDialogAccepted, true);
});

test('l’écriture est ATOMIQUE, et ne laisse aucun provisoire derrière elle', () => {
  // Écrire par-dessus laisserait, si le processus mourait à mi-course, un JSON tronqué là où
  // tout le poste va lire. Le voisin doit vivre dans le MÊME répertoire, sinon le renommage
  // traverse les systèmes de fichiers et cesse d'être atomique.
  const d = bac();
  const config = join(d, 'config.json');
  writeFileSync(config, JSON.stringify({ projects: {} }));
  approuverLieu('/un/lieu', { chemin: config });

  const restes = readdirSync(d).filter((f) => f !== 'config.json');
  assert.deepEqual(restes, [], `des fichiers provisoires subsistent : ${restes.join(', ')}`);
});

test('les DEUX portes sont exigées : le dossier de confiance ET les serveurs qu’il déclare', () => {
  // TROUVÉ EN REVUE (passe 1). Un lieu approuvé mais dont les serveurs ne sont pas activés
  // laisse la session s'arrêter sur le second écran — celui qui a coûté le deuxième aller-
  // retour. Ne vérifier qu'une porte ferait croire à l'appelant qu'il n'a rien à faire.
  const d = bac();
  writeFileSync(join(d, '.mcp.json'), JSON.stringify({ mcpServers: { servicedesk: {}, somcraft: {} } }));
  // Sur TOUTES les formes du lieu : « déjà approuvé » ne vaut que si chacune l'est, sinon la
  // session démarrerait sous la forme oubliée et retrouverait l'écran.
  const surToutesLesFormes = (projet) => ({
    projects: Object.fromEntries(formesDuLieu(d).map((f) => [f, projet])),
  });

  assert.equal(
    dejaApprouve(surToutesLesFormes({ hasTrustDialogAccepted: true }), d), false,
    'le dossier seul a suffi : le second écran arrêterait la session',
  );
  assert.equal(
    dejaApprouve(surToutesLesFormes({ hasTrustDialogAccepted: true, enabledMcpjsonServers: ['servicedesk'] }), d), false,
    'un seul serveur sur deux a suffi — « une porte sur deux »',
  );
  assert.equal(
    dejaApprouve(surToutesLesFormes(entreeComplete({ enabledMcpjsonServers: ['servicedesk', 'somcraft'] })), d),
    true,
  );
  // Et une seule forme approuvée ne suffit pas non plus — c'est le défaut mesuré du 2026-08-13.
  assert.equal(
    dejaApprouve(
      { projects: { [formesDuLieu(d)[0]]: entreeComplete({ enabledMcpjsonServers: ['servicedesk', 'somcraft'] }) } },
      d,
    ),
    formesDuLieu(d).length === 1,
    'une seule forme approuvée a suffi alors que le lieu en porte deux',
  );
});

test('les serveurs déclarés par le lieu sont ACTIVÉS — sinon la session s’arrête sur le second écran', () => {
  // TROUVÉ EN REVUE (passe 1) : aucun test ne prouvait la fusion elle-même. Oublier
  // `enabledMcpjsonServers` dans l'écriture serait resté vert.
  const d = bac();
  const config = join(d, 'config.json');
  writeFileSync(join(d, '.mcp.json'), JSON.stringify({ mcpServers: { servicedesk: {}, somcraft: {} } }));
  writeFileSync(config, JSON.stringify({ projects: {} }));

  approuverLieu(d, { chemin: config });
  const projet = JSON.parse(readFileSync(config, 'utf8')).projects[d];
  assert.deepEqual([...projet.enabledMcpjsonServers].sort(), ['servicedesk', 'somcraft']);
});

test('un serveur activé à la main pour ce lieu SURVIT — union, jamais remplacement', () => {
  const d = bac();
  const config = join(d, 'config.json');
  writeFileSync(join(d, '.mcp.json'), JSON.stringify({ mcpServers: { servicedesk: {} } }));
  writeFileSync(config, JSON.stringify({ projects: { [d]: { enabledMcpjsonServers: ['un-autre'] } } }));

  approuverLieu(d, { chemin: config });
  const actifs = JSON.parse(readFileSync(config, 'utf8')).projects[d].enabledMcpjsonServers;
  assert.deepEqual([...actifs].sort(), ['servicedesk', 'un-autre']);
});

test('la liste des serveurs vient du lieu, jamais d’une liste écrite en dur', () => {
  // Un gabarit qui gagne un serveur demain doit être couvert sans que ce module bouge — c'est
  // le même principe qu'ailleurs : énumérer depuis la source plutôt que compter en dur.
  const d = bac();
  writeFileSync(join(d, '.mcp.json'), JSON.stringify({ mcpServers: { alpha: {}, beta: {}, gamma: {} } }));
  assert.deepEqual(serveursDuLieu(d).sort(), ['alpha', 'beta', 'gamma']);

  // Un lieu sans `.mcp.json`, ou illisible, ne déclare rien — et ne fait échouer aucune
  // naissance : l'écran d'activation n'apparaît que s'il y a quelque chose à activer.
  assert.deepEqual(serveursDuLieu(bac()), []);
  const casse = bac();
  writeFileSync(join(casse, '.mcp.json'), '{ pas du json');
  assert.deepEqual(serveursDuLieu(casse), []);
});

test('les DEUX formes d’un même lieu sont approuvées quand elles diffèrent', () => {
  // TROUVÉ EN REVUE (passe 1) : la version d'avant s'appuyait sur `process.cwd()`, donc son
  // verdict dépendait du répertoire d'où on lançait la suite — verte en intégration continue,
  // rouge ailleurs. Un test dont le résultat dépend d'où on l'appelle ne prouve rien.
  //
  // ET LA VERSION SUIVANTE NE MORDAIT PAS DAVANTAGE, pour une raison plus fine : elle bouclait
  // sur ce que `formesDuLieu` rendait. Réduire cette fonction à une seule forme la laissait
  // VERTE — la garde se conformait à l'implémentation au lieu de la contraindre. C'est le
  // motif 1 du brief de revue, appliqué à une garde que j'écrivais moi-même.
  //
  // ET LA TROISIÈME A ÉTÉ TROUVÉE PAR LA CHAÎNE, PAS PAR MES SUITES : elle s'appuyait sur le
  // fait que les répertoires temporaires de ce poste sont derrière un lien (`/var` →
  // `/private/var` sur macOS). En intégration continue, où `/tmp` n'en est pas un, les deux
  // formes coïncidaient et le test échouait — sur un système où le défaut ne peut pas se
  // produire. Un test qui dépend de la forme du système d'accueil ne prouve rien de plus
  // qu'un test qui dépend du répertoire d'appel.
  //
  // On FABRIQUE donc la divergence — un lien vers le lieu — au lieu de l'espérer. La
  // propriété est alors éprouvée partout, et pour la même raison partout.
  const reel = bac();
  const lien = `${reel}-par-un-lien`;
  symlinkSync(reel, lien);
  assert.notEqual(realpathSync(lien), lien, 'le lien n’en est pas un : le cas à éprouver n’a pas été construit');

  const config = join(reel, 'config.json');
  writeFileSync(config, JSON.stringify({ projects: {} }));
  approuverLieu(lien, { chemin: config });

  const projets = JSON.parse(readFileSync(config, 'utf8')).projects;
  for (const forme of [lien, realpathSync(lien)]) {
    assert.equal(
      projets[forme]?.hasTrustDialogAccepted, true,
      `la forme « ${forme} » n’a pas été approuvée — la session démarrée sous ce nom retrouverait l’écran de confiance`,
    );
  }

  // Et une seule forme approuvée ne doit PAS suffire à dire « déjà approuvé » : sinon la
  // relance suivante ne réparerait pas l'oubli.
  assert.equal(
    dejaApprouve({ projects: { [lien]: projets[lien] } }, lien), false,
    'une seule forme a suffi — la session démarrée sous l’autre nom s’arrêterait quand même',
  );
});

test('la configuration visée est bien celle du poste', () => {
  assert.match(cheminConfig(), /\.claude\.json$/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// T-20260816-0032 — LA NAISSANCE NE MONTRE AUCUN ÉCRAN
//
// MESURÉ le 2026-08-16 sur Claude Code 2.1.233, en trois essais qui s'isolent proprement :
//
//   allow présent + les 2 clés d'origine       → écran de CONFIANCE renforcé
//   allow retiré  + les 2 clés d'origine       → écran des SERVEURS MCP
//   allow retiré  + jeu de clés COMPLET        → AUCUN écran, invite prête
//
// Les deux clés que ce module écrivait suffisaient quand elles ont été écrites. Elles ne
// suffisent plus, et l'essai qui le prouve est ci-dessous : il exige la forme qu'une entrée de
// projet ordinaire porte, parce que c'est celle que Claude Code écrit lui-même.

/** Un lieu factice qui déclare des droits, comme le gabarit le fera. */
function lieuAvecDroits(d, { droits = [], serveurs = ['servicedesk'], via = 'somtech' } = {}) {
  const lieu = join(d, 'lieu');
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(
    join(lieu, '.mcp.json'),
    JSON.stringify({ mcpServers: Object.fromEntries(serveurs.map((s) => [s, { type: 'http', url: 'x' }])) })
  );
  const settings =
    via === 'somtech'
      ? { permissions: { deny: ['Write'] }, somtech: { droitsAccordes: droits } }
      : { permissions: { deny: ['Write'], allow: droits } };
  writeFileSync(join(lieu, '.claude', 'settings.json'), JSON.stringify(settings, null, 2));
  return lieu;
}

test('les droits déclarés par le lieu passent dans allowedTools — sinon un lieu sans bloc allow naîtrait sans droits', () => {
  const d = bac();
  const config = join(d, 'config.json');
  writeFileSync(config, JSON.stringify({ projects: {} }));
  const lieu = lieuAvecDroits(d, { droits: ['Read', 'Bash(git log*)', 'mcp__servicedesk__*'] });

  approuverLieu(lieu, { chemin: config });
  const projet = JSON.parse(readFileSync(config, 'utf8')).projects[resolve(lieu)];
  assert.deepEqual(projet.allowedTools, ['Read', 'Bash(git log*)', 'mcp__servicedesk__*']);
});

test('l’entrée porte le jeu de clés COMPLET — les deux d’avant ne suffisent plus (mesuré sur 2.1.233)', () => {
  const d = bac();
  const config = join(d, 'config.json');
  writeFileSync(config, JSON.stringify({ projects: {} }));
  const lieu = lieuAvecDroits(d, { droits: ['Read'] });

  approuverLieu(lieu, { chemin: config });
  const projet = JSON.parse(readFileSync(config, 'utf8')).projects[resolve(lieu)];

  // Chacune de ces clés a été mesurée présente sur une entrée de projet ordinaire du poste,
  // et leur absence est ce qui laissait l'écran des serveurs apparaître.
  for (const cle of [
    'allowedTools', 'mcpContextUris', 'mcpServers', 'enabledMcpjsonServers', 'disabledMcpjsonServers',
    'hasTrustDialogAccepted', 'projectOnboardingSeenCount',
    'hasClaudeMdExternalIncludesApproved', 'hasClaudeMdExternalIncludesWarningShown',
    'hasCompletedProjectOnboarding',
  ]) {
    assert.ok(cle in projet, `clé manquante : ${cle} — l’écran réapparaîtrait`);
  }
});

test('une entrée écrite par l’ANCIENNE version n’est PAS tenue pour approuvée — sinon le correctif ne mordrait jamais', () => {
  // C'est le cas RÉEL du poste au 2026-08-16 : les trois lieux d'orchestrateur en production
  // portent exactement les deux clés d'avant. Si `dejaApprouve` s'en contentait, la naissance
  // sauterait l'écriture et l'écran resterait — un correctif juste et sans aucun effet, ce qui
  // est la pire des deux situations parce qu'elle a l'air réglée.
  const d = bac();
  const config = join(d, 'config.json');
  const lieu = lieuAvecDroits(d, { droits: ['Read'] });
  writeFileSync(
    config,
    JSON.stringify({ projects: { [resolve(lieu)]: { hasTrustDialogAccepted: true, enabledMcpjsonServers: ['servicedesk'] } } })
  );

  assert.equal(dejaApprouve(JSON.parse(readFileSync(config, 'utf8')), lieu), false);
  const r = approuverLieu(lieu, { chemin: config });
  assert.equal(r.deja, false, 'elle doit RÉÉCRIRE, pas se déclarer déjà faite');
});

test('un lieu sans droits déclarés est approuvé quand même, avec un allowedTools vide', () => {
  // On ne saute jamais l'écriture au prétexte qu'il n'y a rien à accorder : c'est l'écriture
  // elle-même qui supprime les écrans, pas son contenu.
  const d = bac();
  const config = join(d, 'config.json');
  writeFileSync(config, JSON.stringify({ projects: {} }));
  const lieu = lieuAvecDroits(d, { droits: [] });

  approuverLieu(lieu, { chemin: config });
  const projet = JSON.parse(readFileSync(config, 'utf8')).projects[resolve(lieu)];
  assert.deepEqual(projet.allowedTools, []);
  assert.equal(projet.hasTrustDialogAccepted, true);
});

test('un lieu ANCIEN qui porte encore permissions.allow voit ses droits repris — on ne laisse personne sans droits', () => {
  // Les lieux déjà posés portent leurs droits sous `permissions.allow`. Ils continueront de
  // montrer l'écran de confiance (c'est le fichier qui le déclenche), mais leurs droits doivent
  // survivre : on lit les DEUX déclarations, on ne choisit pas l'une contre l'autre.
  const d = bac();
  const config = join(d, 'config.json');
  writeFileSync(config, JSON.stringify({ projects: {} }));
  const lieu = lieuAvecDroits(d, { droits: ['Read', 'Glob'], via: 'permissions' });

  approuverLieu(lieu, { chemin: config });
  const projet = JSON.parse(readFileSync(config, 'utf8')).projects[resolve(lieu)];
  assert.deepEqual(projet.allowedTools, ['Read', 'Glob']);
});

test('un droit accordé à la main pour ce lieu SURVIT — union, jamais remplacement', () => {
  const d = bac();
  const config = join(d, 'config.json');
  const lieu = lieuAvecDroits(d, { droits: ['Read'] });
  writeFileSync(config, JSON.stringify({ projects: { [resolve(lieu)]: { allowedTools: ['Bash(ls*)'] } } }));

  approuverLieu(lieu, { chemin: config });
  const projet = JSON.parse(readFileSync(config, 'utf8')).projects[resolve(lieu)];
  assert.deepEqual([...projet.allowedTools].sort(), ['Bash(ls*)', 'Read']);
});

test('un fichier de droits illisible ne fait pas inventer de droits — la liste est vide, jamais devinée', () => {
  const d = bac();
  const config = join(d, 'config.json');
  writeFileSync(config, JSON.stringify({ projects: {} }));
  const lieu = lieuAvecDroits(d, { droits: ['Read'] });
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{ ceci n’est pas du JSON');

  approuverLieu(lieu, { chemin: config });
  const projet = JSON.parse(readFileSync(config, 'utf8')).projects[resolve(lieu)];
  assert.deepEqual(projet.allowedTools, []);
});

test('droitsDuLieu ne lit JAMAIS une liste écrite en dur — elle vient du fichier du lieu', () => {
  const d = bac();
  const lieu = lieuAvecDroits(d, { droits: ['Bash(quelque-chose-de-tres-improbable*)'] });
  assert.deepEqual(droitsDuLieu(lieu), ['Bash(quelque-chose-de-tres-improbable*)']);
  assert.deepEqual(droitsDuLieu(join(d, 'nulle-part')), []);
});

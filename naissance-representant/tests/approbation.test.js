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
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  approuverLieu, avecApprobation, dejaApprouve, ConfigIllisible, cheminConfig,
} from '../src/approbation.js';

function bac() {
  return mkdtempSync(join(tmpdir(), 'approb-'));
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
  writeFileSync(config, JSON.stringify({ projects: { '/un/lieu': { hasTrustDialogAccepted: true } } }));
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

test('le chemin est RÉSOLU — un lieu relatif et son absolu ne font pas deux entrées', () => {
  const config = { projects: { [process.cwd()]: { hasTrustDialogAccepted: true } } };
  assert.equal(dejaApprouve(config, '.'), true);
  assert.equal(Object.keys(avecApprobation(config, '.').projects).length, 1);
});

test('la configuration visée est bien celle du poste', () => {
  assert.match(cheminConfig(), /\.claude\.json$/);
});

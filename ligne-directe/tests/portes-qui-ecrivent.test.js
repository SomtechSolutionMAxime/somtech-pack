// portes-qui-ecrivent.test.js — le COMPTE des chemins qui écrivent, tenu comme une
// assertion plutôt que promis dans un commentaire.
//
// POURQUOI CE FICHIER EXISTE
//
// Le motif « une porte sur deux » s'est produit QUATRE fois sur ce dépôt : on corrige le
// chemin qu'on a sous les yeux, l'autre reste ouvert, et personne n'en parle. Il a coûté un
// `settings.json` posé là où Claude Code ne le lit jamais, un pack à demi déposé qui passait
// la garde de la source, un garde d'ouverture qui ne couvrait qu'une des deux formes de la
// commande, et un lieu de voisin emporté par une pose ratée.
//
// La parade n'est pas de mieux relire : c'est de COMPTER. Un chemin d'écriture ajouté sans
// que ce fichier soit édité fait rougir la suite — et l'édition, elle, se voit en revue.
//
// CE QU'ON MESURE : les appels qui touchent au disque dans les modules de la pose, relevés
// dans le SOURCE. C'est grossier, et c'est voulu : une garde qui essaierait d'être fine
// laisserait passer ce qu'elle ne saurait pas lire.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src');

/** Tout ce qui, dans `node:fs`, crée ou modifie quelque chose sur le disque. */
const ECRITURES = /\b(mkdirSync|writeFileSync|copyFileSync|appendFileSync|rmSync|rmdirSync|unlinkSync|cpSync|chmodSync|renameSync)\s*\(/g;

function ecrituresDe(fichier) {
  const source = readFileSync(join(SRC, fichier), 'utf8');
  return [...source.matchAll(ECRITURES)].map((m) => m[1]);
}

/**
 * Le compte attendu, module par module, avec le POURQUOI de chacun. Un chiffre nu se
 * réajuste sans réfléchir ; un chiffre accompagné de sa raison oblige à dire laquelle
 * change.
 */
const ATTENDU = {
  // Le seul point d'écriture de la pose (`mkdirSync` du lieu + `mkdirSync` du parent de
  // chaque fichier + `copyFileSync`), et le retrait de ce qu'une pose interrompue a commencé
  // (`rmSync` du lieu + `rmdirSync` du dossier de rôle, sans `recursive` — c'est le noyau qui
  // arbitre s'il reste un voisin).
  'lieu-agent.js': 5,
  // Aucune : ce module ne fait que la joignabilité d'un canal. Toute écriture qui
  // apparaîtrait ici serait une seconde porte vers le disque, hors des trois gardes.
  'representant.js': 0,
  // Aucune, pour la même raison : il ne mesure que la capacité du poste à ouvrir une ligne.
  'orchestrateur.js': 0,
  // Aucune : c'est une table de rôles.
  'roles.js': 0,
};

for (const [fichier, compte] of Object.entries(ATTENDU)) {
  test(`${fichier} : ${compte} chemin(s) qui écrivent, ni plus ni moins`, () => {
    const trouvees = ecrituresDe(fichier);
    assert.equal(
      trouvees.length, compte,
      `${fichier} porte ${trouvees.length} écriture(s) (${trouvees.join(', ')}) pour ${compte} attendue(s). `
        + `Si c'est voulu, édite ATTENDU dans ce fichier EN DISANT pourquoi : c'est cette édition, `
        + `visible en revue, qui remplace la relecture qui a laissé passer « une porte sur deux » quatre fois.`,
    );
  });
}

test('le point d’écriture de la pose est unique, et il est derrière les trois gardes', () => {
  // Le compte ci-dessus dit COMBIEN ; celui-ci dit OÙ. Une écriture déplacée avant les
  // gardes garderait le compte juste et le lieu naîtrait quand même sur un refus.
  const source = readFileSync(join(SRC, 'lieu-agent.js'), 'utf8');
  const debutPose = source.indexOf('export async function preparerLieu');
  assert.ok(debutPose > 0, 'la fonction de pose a été renommée : cette garde ne mord plus');

  const corps = source.slice(debutPose);
  // ⚠️ LA TROISIÈME GARDE EST DÉSIGNÉE PAR SON APPEL, PAS PAR SA DÉCLARATION (T-20260813-0054).
  //
  // Elle était épinglée sur « const ligne = await verifierLigne ». La vérification est désormais
  // ENTOURÉE d'un try/catch — un vérificateur qui jette doit rendre un refus structuré, jamais
  // laisser une exception traverser la pose sans contrat (le défaut mesuré côté représentant).
  // La déclaration s'écrit donc `let ligne;` et l'appel vit une ligne plus bas.
  //
  // Ce qui est gardé ici n'a pas bougé d'un pouce : la troisième garde EXISTE et vient APRÈS
  // les deux autres. C'est l'appel qui le dit, pas la forme de la déclaration — laquelle ne
  // garantissait rien de plus.
  const gardes = ['const etat = etatLieu', 'const source = etatSource', '= await verifierLigne'];
  const rangs = gardes.map((g) => corps.indexOf(g));
  for (const [i, rang] of rangs.entries()) {
    assert.ok(rang > 0, `la garde « ${gardes[i]} » a disparu de la pose`);
  }
  assert.deepEqual(
    [...rangs].sort((a, b) => a - b), rangs,
    'les trois gardes ne sont plus dans l’ordre : l’idempotence doit précéder la source, qui doit '
      + 'précéder la ligne — sinon relancer un lieu déjà posé coûte un appel réseau, et un refus '
      + 'qui ne dépend que du disque local attend le réseau pour rien',
  );

  const premiereEcriture = corps.search(/\b(mkdirSync|writeFileSync|copyFileSync)\s*\(/);
  assert.ok(
    premiereEcriture > Math.max(...rangs),
    'une écriture précède l’une des trois gardes : un refus laisserait quelque chose derrière lui',
  );
});

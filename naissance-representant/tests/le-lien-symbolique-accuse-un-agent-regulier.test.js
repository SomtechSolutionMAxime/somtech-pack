/**
 * ⚠️ CE QUE CE BANC GARDE — LA JOINTURE DES DEUX CÔTÉS PASSE PAR LE MÊME CHEMIN RÉEL.
 *
 * La déclaration inscrit l'espace de travail TEL QUE LE GESTE L'A COMPOSÉ
 * (`bin/naitre.js` : `espace: commandes.lieu`). L'agent, lui, porte l'espace
 * TEL QUE LE SHELL LE VOIT (`foreground_cwd`, rendu par herdr). Sur macOS ces
 * deux chaînes diffèrent pour un même répertoire — `/tmp/x` d'un côté,
 * `/private/tmp/x` de l'autre — parce que `/tmp` est un lien symbolique.
 *
 * `memeEspaceDeTravail` comparait des chaînes BRUTES. Conséquence mesurée : un
 * chef d'équipe régulier, déclaré, né par le geste, était vu SANS déclaration —
 * la garde de l'anonymat accusait celui qu'elle doit protéger. Et le défaut ne
 * se voyait dans AUCUN compteur : les deux compteurs de faux refus disaient 0,
 * parce qu'ils comptent les refus que la garde SAIT injustes, pas ceux qu'elle
 * croit fondés.
 *
 * 🔴 LE DÉPÔT AVAIT DÉJÀ LA RÉPONSE : `bin/naitre.js` porte `memeRepertoire`,
 * qui résout par `realpathSync` avec repli sur le chemin brut, écrit deux jours
 * plus tôt pour exactement cette raison. Elle n'est pas revenue là où elle
 * servait.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { memeEspaceDeTravail } from '../src/garde-des-naissances.js';

describe("la jointure : le chemin déclaré et le chemin vu par le shell", () => {
  test("🔴 un lien symbolique vers l'espace déclaré n'en fait pas un espace ÉTRANGER", () => {
    const racine = mkdtempSync(join(realpathSync(tmpdir()), 'lien-'));
    try {
      const reel = join(racine, 'reel');
      mkdirSync(reel);
      const alias = join(racine, 'alias');
      symlinkSync(reel, alias);

      // Le geste a déclaré l'espace par l'alias ; le shell le rend par le réel.
      assert.equal(memeEspaceDeTravail(reel, alias), true,
        "l'agent est dans l'espace déclaré, atteint par un autre chemin — " +
        'le refuser accuse un chef d\'équipe régulier');

      // Et symétriquement : déclaré par le réel, vu par l'alias.
      assert.equal(memeEspaceDeTravail(alias, reel), true,
        "le sens de la résolution ne doit rien changer");

      // ⚠️ ET LE SOUS-DOSSIER SURVIT À LA RÉSOLUTION : c'est le faux refus
      // symétrique, celui qu'on rouvrirait en résolvant sans garder le préfixe.
      const dedans = join(reel, 'cli', 'src');
      mkdirSync(dedans, { recursive: true });
      assert.equal(memeEspaceDeTravail(join(alias, 'cli', 'src'), reel), true,
        'un agent qui descend dans son worktree y travaille toujours');
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  test("🔴 un espace déclaré DISPARU du disque ne fait pas tomber la garde", () => {
    // LE REPLI EST ATTEINT PAR LE RÉEL, pas par construction : un worktree est
    // supprimé (`claude-swt-done`) alors que sa déclaration, elle, survit — elle
    // vit hors du dépôt. `realpathSync` jette alors ENOENT. Sans repli, la garde
    // ne refuserait pas : elle CASSERAIT, et un plantage n'est pas un verdict.
    const fantome = join(realpathSync(tmpdir()), 'worktree-qui-nexiste-plus-0002');
    assert.equal(memeEspaceDeTravail(fantome, fantome), true,
      'deux chemins identiques restent identiques même si le disque ne les porte plus');
    assert.equal(memeEspaceDeTravail(join(fantome, 'dedans'), fantome), true,
      'le préfixe tient encore quand la résolution est impossible');
    assert.equal(memeEspaceDeTravail(`${fantome}-voisin`, fantome), false,
      "et un VOISIN reste étranger — le repli ne doit pas devenir permissif");
  });

  test("🔴 la résolution n'apparie pas deux espaces réellement distincts", () => {
    const racine = mkdtempSync(join(realpathSync(tmpdir()), 'distincts-'));
    try {
      const a = join(racine, 'a'); const b = join(racine, 'b');
      mkdirSync(a); mkdirSync(b);
      assert.equal(memeEspaceDeTravail(a, b), false,
        'résoudre les chemins ne doit jamais fondre deux espaces séparés');
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  test("🔴 LE REPLI SUR LES FORMES BRUTES, ATTEINT PAR LE SEUL CAS QUI L'ATTEINT", () => {
    // ⚠️ CE BANC EXISTE PARCE QUE LE PRÉCÉDENT NE L'ATTEIGNAIT PAS, et le disait pourtant.
    // « un espace déclaré DISPARU » comparait le fantôme DES DEUX CÔTÉS : `realpathSync`
    // échouait alors identiquement pour les deux, donc `ar === a` et `dr === d`, et les deux
    // termes de `apparie(ar, dr) || apparie(a, d)` devenaient LA MÊME comparaison. Retirer le
    // second terme laissait ce fichier à 3/3 et `garde-des-naissances.test.js` à 45/45.
    // Trouvé par une passe de revue, prouvé par mutation, pas supposé.
    //
    // LE CAS QUI REND LES DEUX TERMES DIFFÉRENTS est l'asymétrie inverse de celle qu'on
    // imaginait : c'est l'espace de l'AGENT qui ne se résout plus, pendant que le DÉCLARÉ vit.
    // Il est réel — `foreground_cwd` est le répertoire du shell, et un shell survit à la
    // suppression du répertoire où il se trouve : herdr rapporte alors un chemin que le disque
    // ne porte plus, pour un agent dont le worktree, lui, est intact.
    const racine = mkdtempSync(join(realpathSync(tmpdir()), 'asym-'));
    try {
      const reel = join(racine, 'reel');
      mkdirSync(reel);
      const alias = join(racine, 'alias');
      symlinkSync(reel, alias);                      // le déclaré passera par l'alias

      const disparu = join(alias, 'sous-dossier-efface');   // jamais créé : ne se résout pas
      assert.equal(memeEspaceDeTravail(disparu, alias), true,
        "l'agent est dans un sous-dossier de l'espace déclaré que le disque ne porte plus — " +
        'le refuser accuse un chef d\'équipe régulier pour un `cd` dans un dossier effacé');

      // ⚠️ ET CE QUE CE REPLI NE DOIT PAS ÉLARGIR : un voisin reste étranger, résolu ou non.
      assert.equal(memeEspaceDeTravail(join(`${alias}-voisin`, 'x'), alias), false,
        'le repli sur les formes brutes ne doit apparier aucun espace étranger');
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});

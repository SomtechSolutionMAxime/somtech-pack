// foyer-de-reference.js — le FOYER que les suites de pose donnent à la garde de fraîcheur,
// pour que leur verdict dépende de ce qu'elles éprouvent et non de l'état du poste.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE FICHIER FERME (T-20260818-0133, nommé par `e-20260818-0014` en rendant
// le lot A plutôt que laissé au suivant)
//
// Les suites de pose fabriquent leur dépôt jetable EN COPIANT LES GABARITS DU DÉPÔT COURANT.
// Depuis la garde de fraîcheur (E-20260818-0014), la pose compare le gabarit qu'elle sert au
// pack installé SUR LE POSTE — sous `$HOME/.claude/plugins/marketplaces/…`. Les deux sources
// sont donc différentes dès qu'une branche touche à un gabarit : le dépôt porte la version en
// cours d'écriture, le poste porte la dernière publiée.
//
// MESURÉ SUR CETTE BRANCHE, AVANT CORRECTIF : une seule ligne de commentaire ajoutée à
// `.claude/templates/orchestrateur/CLAUDE.md` faisait rougir 34 essais dans trois suites —
// `lieu-versionnable`, `orchestrateur-lieu`, `la-convergence-porte-larmement`.
//
// ⚠️ ET L'ASYMÉTRIE EST LE VRAI PIÈGE : ça rougit SUR UN POSTE À JOUR, jamais en CI — la CI
// n'a pas de marketplace sous son `$HOME`, la garde y rend « je n'ai pas su mesurer », et ne
// refuse rien. L'auteur voit donc ses suites rouges pendant que la chaîne reste verte, et le
// premier réflexe devant ce tableau est de soupçonner son poste plutôt que la suite.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QU'IL NE FAIT PAS, ET C'EST LE POINT
//
// ⚠️ IL NE DÉSARME PAS LA GARDE — il la rend éprouvable. La garde compare toujours DEUX
// empreintes réelles, calculées sur deux répertoires réels ; on fixe seulement l'un des deux
// à la MÊME source que l'autre, au lieu de le laisser pointer sur un poste dont l'état ne
// regarde pas l'essai. Une suite qui veut voir la garde REFUSER modifie le gabarit du dépôt
// après la pose du foyer : les empreintes divergent alors pour de vrai (c'est ce que
// `fraicheur-du-gabarit.test.js` fait déjà, et il ne passe pas par ici).
//
// ⚠️ AUCUN APPELANT DE PRODUCTION NE PASSE DE FOYER, ET CE FICHIER N'EN OUVRE PAS LA PORTE.
// `fraicheur-du-gabarit.test.js` interdit par un essai dédié que le mot « foyer » apparaisse
// dans les façades de pose : l'injection qui rend la garde éprouvable serait sinon ce qui la
// désarme. On ne relaie donc RIEN à travers la production — on pose `HOME`, c'est-à-dire qu'on
// fait tourner l'essai SUR un poste fabriqué, plutôt que de tendre un paramètre à la garde.
// C'est plus fidèle en prime : la résolution réelle (`$HOME`) est celle qui s'exerce, y compris
// dans les sous-commandes du CLI, qui n'ont aucune option de foyer.
//
// ⚠️ SÛR PARCE QUE `node --test` DONNE UN PROCESSUS PAR FICHIER : `HOME` posé ici ne fuit pas
// vers une autre suite. Il est posé pour le fichier entier plutôt qu'autour de chaque appel —
// un `HOME` réel qui reparaît au milieu d'un essai est exactement le genre d'état qui rend un
// verdict dépendant de la machine.

import { cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Le sous-chemin, sous un répertoire personnel, où la garde va chercher sa référence.
 *
 * ⚠️ RECOPIÉ PLUTÔT QU'IMPORTÉ, ET C'EST DÉLIBÉRÉ. Importer `SOUS_CHEMIN_REFERENCE` de
 * `../src/fraicheur-gabarit.js` ferait fabriquer le foyer AU MÊME ENDROIT que la garde le
 * cherche, par construction : l'essai passerait même si quelqu'un changeait le sous-chemin
 * des deux côtés d'un coup, et il ne prouverait plus que les suites savent où poser leur
 * référence. Deux textes qui doivent s'accorder, et un essai qui rougit s'ils divergent —
 * c'est `verifierFraicheur` lui-même qui joue ce rôle ici : le jour où le sous-chemin change,
 * les 34 essais reviennent au rouge et désignent cette ligne.
 */
const SOUS_CHEMIN = join('.claude', 'plugins', 'marketplaces', 'somtech-pack', '.claude', 'templates');

/**
 * Un répertoire personnel jetable qui porte, comme référence, EXACTEMENT les gabarits qu'on
 * s'apprête à servir.
 *
 * @param {string} gabaritsSrc  le répertoire `.claude/templates` d'où viennent les gabarits
 *                              copiés dans le dépôt jetable — la MÊME source, jamais une autre
 * @param {string[]} roles      les dossiers de gabarit à rendre disponibles (« orchestrateur »…)
 * @param {string[]} [bacs]     un tableau où déposer le chemin, pour que la suite le nettoie
 * @returns {string} le chemin du foyer — à poser en `HOME`, jamais à relayer en production
 */
export function foyerDeReference(gabaritsSrc, roles, bacs) {
  const foyer = mkdtempSync(join(tmpdir(), 'foyer-ref-'));
  if (Array.isArray(bacs)) bacs.push(foyer);
  const racine = join(foyer, SOUS_CHEMIN);
  mkdirSync(racine, { recursive: true });
  for (const r of roles) {
    cpSync(join(gabaritsSrc, r), join(racine, r), { recursive: true });
  }
  return foyer;
}

/**
 * Le geste complet d'une suite de pose : fabriquer le foyer, l'installer en `HOME` pour la
 * durée du fichier, et le rendre pour ceux qui en ont besoin nommément (un sous-processus).
 *
 * Rend aussi le geste de restauration, que la suite appelle dans son `after` — jamais un
 * `process.on('exit')`, qui laisserait `HOME` faux si un essai fait tomber le processus
 * autrement.
 */
export function posteFabrique(gabaritsSrc, roles, bacs) {
  const foyer = foyerDeReference(gabaritsSrc, roles, bacs);
  const maison = process.env.HOME;
  process.env.HOME = foyer;
  return {
    foyer,
    rendre() {
      if (maison === undefined) delete process.env.HOME;
      else process.env.HOME = maison;
    },
  };
}

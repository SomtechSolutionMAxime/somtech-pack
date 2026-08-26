// lieu-renseigne.js — ce que le gabarit a déposé a-t-il été REMPLI ? Et rien d'autre.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE FICHIER FERME (T-20260826-0043)
//
// La pose dépose `CONTEXTE.md` avec ses chevrons, délibérément : il porte ce que le métier ne
// peut pas savoir — à qui l'agent répond, et sa portée. La compétence dit « remplis-le avant
// la naissance ». Rien ne le faisait respecter : ni la pose ni la naissance ne lisaient le
// CONTENU du fichier, elles ne vérifiaient que sa PRÉSENCE.
//
// Mesuré sur le parc le 2026-08-26 : CINQ lieux vivants sur dix-huit portent un `CONTEXTE.md`
// resté au gabarit intégral. Aucun ne dit à qui son agent répond. La pose avait rendu `ok`,
// la naissance avait réussi — c'est le motif dominant de ce dépôt, une fois de plus : vérifier
// qu'une chose est EN PLACE, jamais qu'elle est RENSEIGNÉE.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI ON COMPARE AU GABARIT, ET JAMAIS UN MOTIF `<…>` CHERCHÉ À L'AVEUGLE
//
// ⚠️ LE FAUX POSITIF EST MESURÉ, PAS IMAGINÉ. Le lieu de `portneuf` est pleinement renseigné
// et porte dans sa prose « fly deploy -a <app> --build-secret github_token=<PAT de ~/.npmrc> ».
// Une garde qui chercherait des chevrons refuserait cette naissance-là — donc refuserait un
// lieu en règle. Et une garde qui crie à tort finit par se faire retirer, en emportant avec
// elle ce qu'elle gardait vraiment : c'est la leçon que `fraicheur-gabarit.js` a déjà payée.
//
// Ce qu'on cherche est donc BORNÉ à ce que le gabarit a déposé. Un chevron qui n'y figure pas
// n'est jamais cherché : le faux positif est fermé PAR CONSTRUCTION, pas par une liste
// d'exceptions qu'il faudrait tenir à jour — et une liste d'exceptions se désarme par un geste
// qui ressemble à de l'entretien.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ UNE MESURE IMPOSSIBLE NE REFUSE RIEN. Gabarit illisible, fichier illisible : on ne
// conclut rien. C'est la même règle qu'ailleurs dans ce dépôt — « je n'ai pas pu regarder » et
// « c'est vide » mènent à deux conduites opposées, et les confondre est ce qui transforme une
// garde en garde qui crie à tort.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LES FICHIERS QU'UN HUMAIN REMPLIT, et les seuls que cette garde regarde.
 *
 * ⚠️ ELLE NE PEUT PAS ÊTRE « TOUS LES FICHIERS DU GABARIT QUI PORTENT DES CHEVRONS », et c'est
 * mesuré : les chapitres du métier en portent à la douzaine — `<ws>`, `<repo>`, `<pane>`,
 * `<timestamp>` — qui sont des espaces réservés dans des EXEMPLES DE COMMANDES. Ils sont
 * censés rester tels quels : personne ne les remplit, et les compter ferait refuser toutes les
 * naissances du parc.
 *
 * La liste est donc celle des fichiers ÉCRITS À LA MAIN — exactement ceux que la mise à jour
 * d'un lieu préserve (`PRESERVE`, `cli/src/commands/representant.js`). Les deux disent la même
 * chose et vivent dans deux paquets qui ne peuvent pas s'importer ; un essai miroir côté CLI
 * fait rougir la divergence plutôt que de la laisser s'installer.
 */
export const FICHIERS_A_RENSEIGNER = ['CONTEXTE.md', 'RONDE.md'];

/**
 * Ce qui, dans un gabarit, reste à renseigner : les segments entre chevrons.
 *
 * ⚠️ LES COMMENTAIRES HTML SONT ÉCARTÉS. `CLAUDE.md` en porte pour la traçabilité STD-047
 * (`<!-- GF-ORC-001 · hook -->`) ; ils ne sont pas des rubriques à remplir, et les compter
 * ferait reprocher à un fichier de porter sa propre traçabilité.
 *
 * Dédupliqué : un même intitulé peut revenir deux fois dans un gabarit, il ne fait qu'une
 * rubrique à remplir.
 */
export function chevronsDuGabarit(texteGabarit) {
  if (typeof texteGabarit !== 'string') return [];
  const vus = new Set();
  for (const [entier] of texteGabarit.matchAll(/<[^<>\n]+>/g)) {
    if (entier.startsWith('<!--')) continue;
    vus.add(entier);
  }
  return [...vus];
}

/**
 * Les rubriques du gabarit qui, dans le fichier POSÉ, sont restées MOT POUR MOT ce que le
 * gabarit avait déposé — donc celles que personne n'a renseignées.
 *
 * Rend une liste vide quand la mesure n'a pas pu se faire : voir la note en tête.
 *
 * @param {string} texteGabarit le gabarit du rôle, tel que le pack le distribue
 * @param {string} texteLieu    le fichier tel qu'il est dans le lieu de l'agent
 * @returns {string[]}          les segments restés à l'identique, dans l'ordre du gabarit
 */
export function rubriquesNonRenseignees(texteGabarit, texteLieu) {
  if (typeof texteGabarit !== 'string' || typeof texteLieu !== 'string') return [];
  return chevronsDuGabarit(texteGabarit).filter((c) => texteLieu.includes(c));
}

/**
 * Le cas le plus grave, et il se nomme à part : le fichier n'a PAS ÉTÉ TOUCHÉ DU TOUT.
 *
 * Il se distingue d'un fichier à demi rempli, parce que la conduite qu'il appelle n'est pas la
 * même : là où quelques rubriques restées se complètent, un fichier intact signale que
 * personne n'a jamais ouvert le lieu — et le message doit le dire autrement.
 *
 * ⚠️ Une mesure impossible n'affirme RIEN : elle rend `false`, jamais « oui c'est le gabarit ».
 */
export function GABARIT_EN_ENTIER(texteGabarit, texteLieu) {
  if (typeof texteGabarit !== 'string' || typeof texteLieu !== 'string') return false;
  return texteGabarit.trim() === texteLieu.trim();
}

/**
 * LE VERDICT, et le seul endroit où il se forme.
 *
 * Rend l'un de trois états, et jamais autre chose :
 *
 *   { renseigne: true,  verifie: true }              tout ce qui devait l'être l'est
 *   { renseigne: true,  verifie: false, raison }     on n'a PAS su mesurer → ne refuse rien
 *   { renseigne: false, verifie: true, manquant, intact, message }   → REFUS
 *
 * ⚠️ `renseigne: true` SUR UNE MESURE IMPOSSIBLE, ET C'EST VOULU. C'est la branche qui empêche
 * cette garde de crier à tort : un lieu posé par une version du pack qui ne portait pas encore
 * ce gabarit n'a rien fait de mal. « Je n'ai pas pu regarder » et « c'est resté au gabarit »
 * mènent à deux conduites opposées ; les confondre est ce qui fait retirer une garde, en
 * emportant ce qu'elle gardait vraiment.
 *
 * ⚠️ ET LA PRÉSENCE DES FICHIERS N'EST PAS SON AFFAIRE : un fichier absent du lieu ne se
 * reproche pas ici. C'est la pose qui juge la présence (`lieu_partiel`), et deux endroits qui
 * jugeraient la même chose se déphaseraient au premier correctif.
 *
 * @param {string} gabaritDir  le répertoire de gabarits du rôle, dans le dépôt cible
 * @param {string} racine      la racine du lieu de l'agent
 */
export function verifierLieuRenseigne({ gabaritDir, racine } = {}) {
  if (typeof gabaritDir !== 'string' || typeof racine !== 'string') {
    return { renseigne: true, verifie: false, raison: 'ni le gabarit ni le lieu n’ont été nommés — rien n’a été mesuré.' };
  }

  const manquant = [];
  let intact = false;
  let mesures = 0;
  const muets = [];

  for (const fichier of FICHIERS_A_RENSEIGNER) {
    const auGabarit = join(gabaritDir, fichier);
    const auLieu = join(racine, fichier);
    if (!existsSync(auGabarit) || !existsSync(auLieu)) { muets.push(fichier); continue; }
    let texteGabarit;
    let texteLieu;
    try {
      texteGabarit = readFileSync(auGabarit, 'utf8');
      texteLieu = readFileSync(auLieu, 'utf8');
    } catch { muets.push(fichier); continue; }
    mesures += 1;
    const rubriques = rubriquesNonRenseignees(texteGabarit, texteLieu);
    if (rubriques.length > 0) {
      manquant.push({ fichier, chemin: auLieu, rubriques });
      if (GABARIT_EN_ENTIER(texteGabarit, texteLieu)) intact = true;
    }
  }

  if (mesures === 0) {
    return {
      renseigne: true,
      verifie: false,
      raison:
        `rien n’a pu être comparé au gabarit (${muets.join(', ') || 'aucun fichier à renseigner'}` +
        ` — absent du gabarit du dépôt, du lieu, ou illisible) : on ne sait donc pas si ce lieu ` +
        `a été renseigné, et on n’en conclut rien.`,
    };
  }

  // `manquant` est TOUJOURS un tableau, même vide : un appelant qui itère dessus sans le
  // tester ne doit pas tomber selon le verdict rendu.
  if (manquant.length === 0) return { renseigne: true, verifie: true, manquant: [] };

  return { renseigne: false, verifie: true, manquant, intact, message: messageDeRefus({ racine, manquant, intact }) };
}

/**
 * ⚠️ IL DIT CE QU'IL A MESURÉ, JAMAIS CE QU'IL EN CONCLUT — et il ne met AUCUNE commande
 * destructrice dans la bouche de personne. Celui qui lit un message de refus a déjà un
 * problème : il fait confiance, et il colle. Le seul geste nommé ici est d'écrire.
 */
function messageDeRefus({ racine, manquant, intact }) {
  const lignes = [];
  lignes.push(
    intact
      ? `le lieu « ${racine} » n’a jamais été renseigné : son gabarit y est resté mot pour mot.`
      : `le lieu « ${racine} » n’est renseigné qu’à moitié.`,
  );
  for (const m of manquant) {
    lignes.push(`  ${m.fichier} — ${m.rubriques.length} rubrique(s) encore au gabarit :`);
    for (const r of m.rubriques) lignes.push(`      ${r}`);
  }
  lignes.push(
    `  Un agent né là ne saurait ni à qui il répond, ni quelle est sa portée : son métier est le`,
    `  même pour tous, et c’est ce fichier — et lui seul — qui porte ce que le métier ne sait pas.`,
    `  Le geste qui lève ce refus : remplis les rubriques ci-dessus dans « ${manquant[0].chemin} »,`,
    `  puis relance. Rien n’a été créé, et rien n’a été touché.`,
  );
  return lignes.join('\n');
}

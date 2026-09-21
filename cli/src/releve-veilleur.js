// releve-veilleur.js — la mise à jour du poste ne rend jamais un succès muet
// (T-20260818-0035, critère 2 du ticket).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT
//
// Le veilleur est un processus PERMANENT, indépendant de `pack setup`. Une mise à jour du
// pack copie du code neuf sur le disque, mais un veilleur déjà en cours ne le sait pas tout
// seul : il continue de servir l'ANCIEN jusqu'à ce que quelqu'un se souvienne de taper
// `ligne-directe relever`. Mesuré : trois jours d'écart, et `setup` avait annoncé un succès
// sans jamais regarder le veilleur.
//
// ⚠️ `ecartDeCode` N'EST PAS IMPORTÉ D'ICI. `identite-du-code.js` vit dans
// `ligne-directe/src/`, un module de PORTÉE POSTE que le paquet npm du CLI n'embarque pas
// comme bibliothèque — seuls `bin/`, `src/` et `payload/` sont publiés (même contrainte que
// `lieu-nom.js` et `fraicheur-gabarit.js`, voir leurs en-têtes). Un import statique vers
// `../../ligne-directe/src/identite-du-code.js` fonctionnerait dans CE dépôt et casserait
// chez un client ayant installé `@somtech-solutions/pack` en paquet npm : le dossier
// `ligne-directe/` n'existe simplement pas à côté de `cli/` sur son poste. La comparaison est
// donc réimplémentée ici, en quelques lignes, plutôt qu'importée — pas une duplication
// choisie par confort, une contrainte de DISTRIBUTION, comme les deux précédentes.
//
// `empreinteDuCode`, lui, EST injecté : c'est la seule pièce qui fait de l'I/O (lire un
// dossier de fichiers), et c'est ce qui rend ce module éprouvable sans toucher un vrai
// disque. `setup.js` l'importe DYNAMIQUEMENT depuis la copie INSTALLÉE (`destDir`), jamais
// depuis `payloadRoot` — voir le commentaire de `commands/setup.js` pour le pourquoi
// structurel (`reveillerVeilleur()` fait naître le veilleur depuis SON PROPRE dossier).

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * L'écart entre ce que sert un veilleur et ce que le poste a installé — copie MINIMALE de la
 * règle de `ligne-directe/src/identite-du-code.js` (voir l'en-tête de ce fichier pour le
 * pourquoi de la copie). Pas d'I/O ici, seulement les deux objets déjà mesurés par
 * `empreinteDuCode`.
 */
function ecart(servi, installee) {
  if (!servi?.empreinte || !installee?.empreinte) {
    const refus = servi?.refus || installee?.refus || 'empreinte manquante';
    return { perime: null, motif: `impossible de comparer le code servi au code installé : ${refus}` };
  }
  if (servi.empreinte === installee.empreinte) return { perime: false, motif: null };
  return { perime: true, motif: null };
}

/**
 * Vérifie le veilleur en cours contre ce que `setup` vient d'installer, et le relève au
 * besoin — en LOGGANT CHAQUE ISSUE, jamais en silence.
 *
 * Entièrement injectée : `parler`, `passerLaMain` et `empreinteDuCode` sont fournies par
 * l'appelant (voir `commands/setup.js`), qui les importe depuis la copie INSTALLÉE du poste.
 * Ce module lui-même n'importe ni `client.js` ni `identite-du-code.js` : le faire romprait
 * l'exigence structurelle documentée en tête de fichier.
 *
 * @param {object} deps
 * @param {string} deps.toolsDir           racine des outils de poste (~/.somtech par défaut)
 * @param {Function} deps.parler           `parler` de `ligne-directe/src/client.js`
 * @param {Function} deps.passerLaMain     `passerLaMain` de `ligne-directe/src/client.js`
 * @param {Function} deps.empreinteDuCode  `empreinteDuCode` de `ligne-directe/src/identite-du-code.js`
 * @param {Function} [deps.log]            reçoit chaque ligne à annoncer (def. `console.log`)
 */
export async function releverSiPerime({ toolsDir, parler, passerLaMain, empreinteDuCode, log = console.log }) {
  try {
    const racineLigneDirecte = join(toolsDir, 'ligne-directe');
    const cheminSocket = join(racineLigneDirecte, 'veilleur.sock');

    // 1. AUCUN SOCKET → rien à relever. Le prochain agent qui ouvrira sa ligne fera naître
    // un veilleur déjà à jour : ce n'est pas un défaut, c'est le cas nominal d'un poste où
    // rien ne tournait encore.
    if (!existsSync(cheminSocket)) {
      log('veilleur : aucun en cours (il naîtra à jour au premier geste)');
      return;
    }

    // 2. UN SOCKET EST LÀ : lui parler. `reveiller: false` — si personne ne répond, on ne
    // fait PAS naître un veilleur par-dessus une place qu'on n'a pas vérifiée libre ; c'est
    // le rôle de `passerLaMain`, plus bas, de la vérifier correctement.
    let reponse;
    try {
      reponse = await parler({ geste: 'ping' }, { reveiller: false, cheminSocket });
    } catch (err) {
      log(
        `⚠️ veilleur : un socket est présent mais il ne répond pas (${err?.message || err}) — ` +
          'relève-le à la main : ligne-directe relever'
      );
      return;
    }

    const installee = empreinteDuCode(join(racineLigneDirecte, 'src'));
    const servi = reponse?.code;

    // 4. UN VEILLEUR D'UNE VERSION ANTÉRIEURE À CE LOT ne rend pas `code` à son ping — il ne
    // sait tout simplement pas dire ce qu'il sert. On ne peut pas conclure « à jour » sur un
    // silence : c'est traité comme périmé, et on relève.
    const verdict = servi
      ? ecart(servi, installee)
      : { perime: true, motif: "le veilleur en cours ne sait pas dire quel code il sert (version antérieure à ce lot)" };

    if (verdict.perime === null) {
      log(`⚠️ veilleur : ${verdict.motif}`);
      return;
    }
    if (verdict.perime === false) {
      log(`veilleur : à jour (empreinte ${installee.empreinte})`);
      return;
    }

    // 3. PÉRIMÉ : on tente la relève, et l'ISSUE — succès ou échec — est TOUJOURS dite.
    try {
      await passerLaMain({ cheminSocket });
    } catch (err) {
      log(`⚠️ veilleur NON relevé : ${err?.message || err} — relève-le à la main : ligne-directe relever`);
      return;
    }

    // ⚠️ « RELEVÉ » EST UNE MESURE, PAS UNE AFFIRMATION SUR CE QU'ON VIENT DE POSER. C'est la
    // famille de défaut exacte de ce ticket : vérifier qu'une chose est EN PLACE (`passerLaMain`
    // a rendu `ok`) n'est pas vérifier qu'elle FONCTIONNE (le nouveau veilleur sert bien le code
    // qu'on croit). `passerLaMain` peut rendre `ok` alors qu'un revenant tient encore la place
    // à côté, ou que le veilleur qui a repris naît d'un autre dossier — on RE-PING donc, sur le
    // même socket, et on cite l'empreinte MESURÉE à ce second appel, jamais celle qu'on
    // s'attendait à trouver.
    let confirmation;
    try {
      confirmation = await parler({ geste: 'ping' }, { reveiller: false, cheminSocket });
    } catch (err) {
      log(
        `⚠️ relève tentée, mais le veilleur ne répond plus après : ${err?.message || err} — ` +
          'relève-le à la main : ligne-directe relever'
      );
      return;
    }

    const empreinteMesuree = confirmation?.code?.empreinte ?? null;
    if (empreinteMesuree !== installee.empreinte) {
      log(
        `⚠️ veilleur relevé mais il sert ${empreinteMesuree ?? '(aucune identité)'} et non ${installee.empreinte} — ` +
          'relève-le à la main : ligne-directe relever'
      );
      return;
    }

    log(
      `veilleur relevé : il sert maintenant ${empreinteMesuree} ` +
        `(l'ancien servait ${servi?.empreinte ?? '?'}, code du ${servi?.date ?? '?'})`
    );
  } catch (err) {
    // TOUTE EXCEPTION INATTENDUE EST LOGGÉE, JAMAIS AVALÉE, JAMAIS FATALE POUR `setup` : une
    // vérification de fraîcheur qui casse silencieusement `setup` serait pire que l'absence
    // de vérification — l'opérateur perdrait la MAJ elle-même pour une garde annexe.
    log(`⚠️ veilleur : la vérification a échoué de façon inattendue (${err?.message || err}) — relève-le à la main : ligne-directe relever`);
  }
}

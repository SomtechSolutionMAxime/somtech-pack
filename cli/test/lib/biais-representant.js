// Les garde-fous du représentant contre les biais des LLM — et la preuve qu'ils ne sont pas
// décoratifs.
//
// T-20260813-0063 (D-20260812-0001), standard STD-011. Ce fichier n'est pas un test : il est
// importé par `representant-biais.test.js`, qui exécute ses contrôles DEUX FOIS — sur le lieu
// réel, où ils doivent passer, et sur des versions retournées, où au moins un doit rougir.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE PERSONA MÉRITE PLUS QUE L'AUTRE, ET CE QUE ÇA CHANGE ICI
//
// Une erreur de l'orchestrateur reste chez nous. Une erreur du représentant SORT : elle
// arrive chez un client, sous l'en-tête de Somtech, et elle ne se retire pas. Un chiffre
// lâché, une échéance inventée, une citation reformulée puis attribuée deviennent en deux
// copies la version officielle de ce que le client croit savoir.
//
// D'où la règle d'écriture de ces contrôles, plus stricte que celle du harnais partagé : à
// biais égal, on garde la POLARITÉ (de quel côté d'une table une affirmation vit, la colonne
// désignée par son libellé d'en-tête), le COMPTE (combien d'angles sont écrits pour combien
// de gardés) et la MODALITÉ — et la modalité a ici DEUX axes, pas un.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DEUXIÈME AXE DE MODALITÉ, ET C'EST LE TICKET QUI L'A EXIGÉ
//
// `exigeImperatif` (harnais partagé) voit la PERMISSION (« tu peux », « facultatif »).
// `exigeSansReserve` (harnais du danger) voit en plus la RÉSERVE (« sauf si », « dans la
// mesure du possible »). Ni l'une ni l'autre ne voit le CONSEIL : « essaie de ne pas mettre
// de guillemets » garde chaque mot de la contrainte, n'ouvre aucune exception, ne demande
// aucune permission — et cesse d'obliger. C'est la mutation que T-20260813-0063 exige
// nommément, et elle survivrait aux deux gardes existantes.
//
// ⚠️ ET LA MÊME PANNE SILENCIEUSE LES GUETTE TOUTES. `CONSEIL` est une LISTE DE VOCABULAIRE :
// une alternative qui ne s'apparie à rien est vraie par construction, l'axe est réputé
// couvert et il ne l'est pas. Le cas s'est produit deux fois dans ce dépôt sur `\bà moins
// que` — en JavaScript, `à` n'est pas un caractère de mot, donc un `\b` posé devant ne
// s'apparie JAMAIS. La suite prouve chaque alternative VIVANTE par une sonde, et refuse tout
// `\b` devant une initiale accentuée.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUI EST MÉCANIQUE, ET CE QUI A ÉTÉ MESURÉ POUR L'ÉCRIRE
//
// Le lieu du représentant porte `.claude/settings.json`. Le ticket avertit : un fichier de
// permissions qu'on CROIT contraignant et qui ne l'est pas est pire que rien. Deux faits ont
// donc été mesurés, sur ce poste, en faisant réellement naître des sessions bornées — jamais
// déduits d'une documentation :
//
//   • un outil nommé dans `permissions.deny` N'EXISTE PLUS dans la session — la session
//     interrogée répond qu'aucun outil de ce genre ne lui a été chargé. Le refus mord, et il
//     mord même dans un répertoire que personne n'a approuvé ;
//   • un outil nommé dans `permissions.allow` est IGNORÉ tant que le dépôt n'a pas été
//     approuvé une fois par un humain (« this workspace has not been trusted »). La session
//     demande alors la permission au lieu de l'avoir.
//
// L'asymétrie décide de ce qu'on écrit : la garantie tient dans `deny`, jamais dans `allow`.
// C'est pourquoi `biais-droits-bornes` garde la liste de refus et refuse qu'un outil soit à
// la fois permis et refusé — et non l'inverse.
//
// ⚠️ CE QUE CES CONTRÔLES NE PEUVENT PAS FAIRE. Ils lisent un TEXTE. Ils prouvent que le
// gabarit dit ce qu'il doit dire et le dit de façon contraignante ; ils ne prouvent pas
// qu'un agent obéit. Le seul étage qui ne dépende d'aucune vigilance est le fichier de
// droits — et il ne couvre que ce qui s'y nomme.
//
// ⚠️ ET UNE LIMITE PRÉCISE, LAISSÉE OUVERTE SCIEMMENT PLUTÔT QUE PASSÉE SOUS SILENCE. La
// modalité est gardée sur l'énoncé QUI OBLIGE — la cellule de table, ou la ligne entière
// quand la contrainte y vit en texte courant. Elle ne l'est pas sur la PROSE VOISINE qui
// justifie cet énoncé : un paragraphe ajouté plus bas et qui contredirait une cellule
// (« sauf quand le client écrit en anglais ») ne ferait rougir personne. Un lecteur
// résoudrait la contradiction contre la cellule, qui est la seule normative — c'est pourquoi
// la garde s'arrête là, et non parce que le cas serait impossible.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  REPO,
  GABARIT_DIR,
  lireGabarits,
  sectionDe,
  tableDe,
  colonne,
  colonneDe,
  permuter,
} from './metier-representant.js';
import { exigeSansReserve } from './danger-representant.js';


/** Les droits du lieu — là où Claude Code les résout, jamais à plat (mesuré sur ce dépôt). */
export const CHEMIN_DROITS = join(GABARIT_DIR, '.claude', 'settings.json');

/** Le lieu entier : les deux gabarits du harnais partagé, plus les droits. */
export function lireLieu(racine = REPO) {
  return {
    ...lireGabarits(racine),
    droits: readFileSync(join(racine, CHEMIN_DROITS), 'utf8'),
  };
}

// ═════════════════════════════════════════ la modalité, deuxième axe

/**
 * Tournures qui transforment une contrainte en conseil.
 *
 * Elles ne demandent aucune permission et n'ouvrent aucune exception : elles gardent tous
 * les mots de l'obligation et lui retirent son caractère obligatoire. C'est la troisième
 * façon de vider une consigne, et les deux gardes existantes ne la voient pas.
 *
 * ⚠️ AUCUN `\b` DEVANT UNE INITIALE ACCENTUÉE (« évite ») : il ne s'apparierait jamais.
 * La suite le vérifie à la source, pas à ses effets.
 */
export const CONSEIL = /\bessaie de\b|\btâche de\b|\befforce-toi\b|évite de\b|\bmieux vaut\b|\btu devrais\b|dans l.idéal\b|\bil est préférable\b/i;

/**
 * Exige qu'un énoncé CONTRAIGNE : ni permission, ni réserve, ni conseil.
 *
 * Les trois axes sont cumulés délibérément. Une consigne peut être vidée par n'importe
 * lequel, et n'en fermer que deux reconduit le motif « un correctif ne couvre qu'une porte
 * sur deux » que ce dépôt a déjà payé.
 */
export function exigeContrainte(enonce, quoi) {
  exigeSansReserve(enonce, quoi);
  const conseil = enonce.match(CONSEIL);
  assert.ok(
    !conseil,
    `« ${quoi} » s'est changé en conseil (« ${conseil && conseil[0]} ») : tous les mots de la `
      + `contrainte y sont encore et elle n'oblige plus — « ${enonce.trim()} »`,
  );
}

/**
 * Mots qui présentent l'aveu d'ignorance comme un coût — sauf quand le gabarit les NIE.
 *
 * L'oubli du négatif serait fatal : le texte correct dit « c'est une permission, pas un
 * aveu » et « se sent comme un échec professionnel », deux formulations qui NOMMENT le coût
 * pour le refuser. Une sonde naïve rougirait sur le texte juste, et on la « corrigerait » en
 * la supprimant. Les occurrences niées sont donc ignorées.
 */
const COUTEUX = /(?<!pas un )(?<!pas une )(?<!jamais un )(?<!jamais une )\b(?:aveu|échec|faiblesse|incompétence)\b/i;

/** L'unique ligne dont la partie en gras répond à la sonde. */
function grasUnique(corps, sonde, quoi) {
  const lignes = corps
    .split('\n')
    .map((ligne) => ({ ligne, gras: [...ligne.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]).join(' ') }))
    .filter(({ gras }) => sonde.test(gras));
  assert.equal(
    lignes.length, 1,
    `« ${quoi} » doit être affirmé une fois exactement, en gras (${lignes.length} trouvée·s)`,
  );
  return lignes[0];
}

/** L'unique ligne d'une table dont la cellule de `colonne` répond à la sonde. */
function ligneUnique(table, i, sonde, quoi) {
  const trouvees = table.lignes.filter((l) => sonde.test(l[i] ?? ''));
  assert.equal(trouvees.length, 1, `« ${quoi} » doit figurer une fois exactement (${trouvees.length} trouvée·s)`);
  return trouvees[0];
}

// ═════════════════════════════════════════ les contrôles

export const CONTROLES_BIAIS = [
  {
    id: 'biais-contexte-quebecois',
    quoi: 'le contexte québécois est IMPOSÉ par ses marqueurs, et jamais du mauvais côté de la table',
    verifier({ metier }) {
      // C4 de la grille §7.1, le seul critère que le gabarit ne portait pas. Le représentant
      // est le seul des deux personas qui parle à un client : c'est donc lui, et lui seul,
      // qui peut écrire « LLC », chiffrer en dollars américains, ou invoquer une loi de
      // protection des renseignements qui n'est pas la Loi 25.
      //
      // GARDÉ PAR SES MARQUEURS, ET C'EST TOUT L'ENJEU. Un texte qui MENTIONNE le contexte
      // sans l'IMPOSER — « adapte-toi au contexte local » — laisse le modèle choisir, et il
      // choisira ce qu'il a le plus lu. C'est la nuance que le ticket exige de voir rougir,
      // et elle ne s'attrape qu'en exigeant les marqueurs eux-mêmes, appariés à leur côté.
      const s = sectionDe(metier, /réflexes/i, 'sur les réflexes');
      const table = tableDe(s.corps);
      const iNom = colonneDe(table, /^Le réflexe$/i, 'le nom du réflexe');
      const iPression = colonneDe(table, /^Ce que la pression te fait dire$/i, 'ce que la pression te fait dire');
      const iReponse = colonneDe(table, /^Ce que tu dis à la place$/i, 'ce que tu dis à la place');

      const ligne = ligneUnique(table, iNom, /québécois|québec/i, 'le réflexe du contexte québécois');
      const pression = ligne[iPression] ?? '';
      const reponse = ligne[iReponse] ?? '';

      // LES DEUX POLARITÉS, ET LES DEUX COMPTENT.
      // Présent du bon côté ne suffit pas : ajouter « des dollars américains » du côté des
      // réponses sans le retirer de l'autre laisserait le contrôle vert, et le représentant
      // chiffrerait en devise étrangère. C'est la porte que ce dépôt a déjà laissée ouverte
      // une fois, sur le prix, et qu'un correctif « une porte sur deux » n'avait pas fermée.
      const ETRANGER = [
        { quoi: 'la forme juridique étrangère (« LLC »)', sonde: /\bLLC\b/ },
        { quoi: 'la monnaie étrangère (dollars américains)', sonde: /américain/i },
        { quoi: 'la loi étrangère (RGPD ou autre)', sonde: /\bRGPD\b|\bGDPR\b|\bCCPA\b/ },
      ];
      const DICI = [
        { quoi: 'la forme juridique d’ici (« Inc. »)', sonde: /\bInc\b/ },
        { quoi: 'la monnaie d’ici (dollars canadiens)', sonde: /canadien/i },
        { quoi: 'la loi d’ici (la Loi 25)', sonde: /\bLoi\s*25\b/i },
      ];

      const toutesPressions = colonne(table, /^Ce que la pression te fait dire$/i, 'ce que la pression te fait dire').join(' ');
      const toutesReponses = colonne(table, /^Ce que tu dis à la place$/i, 'ce que tu dis à la place').join(' ');

      for (const { quoi, sonde } of ETRANGER) {
        assert.match(
          pression, sonde,
          `${quoi} doit être NOMMÉ du côté de ce que la pression fait dire — un réflexe qui ne `
            + `nomme pas la tournure qu'il remplace laisse le modèle écrire celle qu'il a le plus lue`,
        );
        assert.ok(
          !sonde.test(toutesReponses),
          `${quoi} figure du côté de ce qu'on dit au client — la polarité du contexte québécois est inversée`,
        );
      }
      for (const { quoi, sonde } of DICI) {
        assert.match(
          reponse, sonde,
          `${quoi} doit être IMPOSÉ du côté de ce qu'on dit — sans marqueur, il ne reste qu'une `
            + `invitation à « s'adapter au contexte local », que rien ne rend applicable`,
        );
        assert.ok(
          !sonde.test(toutesPressions),
          `${quoi} figure du côté de ce que la pression fait dire — la polarité est inversée`,
        );
      }

      // ET LA MODALITÉ : « essaie d'employer Inc. » garde les six marqueurs et n'oblige plus.
      exigeContrainte(reponse, 'la réponse du réflexe du contexte québécois');
    },
  },

  {
    id: 'biais-raccord-a-la-grille',
    quoi: 'chaque réflexe dit quel critère de la grille il réalise, et le bon',
    verifier({ metier }) {
      // Sans ce raccord, les réflexes sont ORPHELINS : l'audit mensuel prévu par le standard
      // (§7.1) ne peut pas s'exécuter sans que quelqu'un refasse la correspondance à la main.
      // Elle a été faite une fois ; elle ne doit pas avoir à se refaire.
      //
      // L'APPARIEMENT EST LA GARANTIE, pas la présence des étiquettes. Permuter deux cellules
      // de la colonne laisserait les cinq critères présents et ferait dire au gabarit que
      // l'anti-fabulation réalise l'anti-sycophantie — un audit qui s'y fierait conclurait
      // que C2 est couvert par un réflexe qui ne le couvre pas.
      const s = sectionDe(metier, /réflexes/i, 'sur les réflexes');
      const table = tableDe(s.corps);
      const iNom = colonneDe(table, /^Le réflexe$/i, 'le nom du réflexe');
      const iCritere = colonneDe(table, /^Ce qu.il tient de la grille$/i, 'le critère de la grille réalisé');

      const ATTENDU = [
        { critere: 'C1', reflexe: /complaisance/i, quoi: 'l’anti-complaisance réalise C1 (anti-sycophantie)' },
        { critere: 'C2', reflexe: /fabulation/i, quoi: 'l’anti-fabulation réalise C2 (anti-hallucinations)' },
        { critere: 'C3', reflexe: /calibration/i, quoi: 'la calibration réalise C3' },
        { critere: 'C4', reflexe: /québécois|québec/i, quoi: 'le contexte québécois réalise C4' },
        { critere: 'C5', reflexe: /ancrage/i, quoi: 'l’anti-ancrage réalise C5' },
      ];

      const criteres = table.lignes.map((l) => l[iCritere] ?? '');
      for (const { critere, reflexe, quoi } of ATTENDU) {
        const porteurs = criteres.filter((c) => new RegExp(`\\b${critere}\\b`).test(c));
        assert.equal(
          porteurs.length, 1,
          `${critere} doit être réalisé par un réflexe et un seul (${porteurs.length} le revendique·nt) — `
            + `deux réflexes qui revendiquent le même critère en laissent un autre sans personne`,
        );
        const ligne = ligneUnique(table, iNom, reflexe, quoi);
        assert.match(
          ligne[iCritere] ?? '', new RegExp(`\\b${critere}\\b`),
          `${quoi} — la colonne des critères dit « ${ligne[iCritere]} » : l'audit conclurait que `
            + `${critere} est couvert par un réflexe qui ne le couvre pas`,
        );
      }

      // Et le pointeur vers la grille elle-même. C'est une PRÉSENCE, assumée comme telle :
      // ce qui porte la garantie est l'appariement ci-dessus, pas ce nom.
      assert.match(
        s.corps, /STD-011/,
        'la section doit nommer le standard dont elle porte la grille — sinon les étiquettes C1…C5 ne renvoient à rien',
      );
    },
  },

  {
    id: 'biais-le-doute-est-permis',
    quoi: 'dire « je ne sais pas encore » est donné comme une permission, jamais comme un aveu',
    verifier({ metier }) {
      // Un agent invente surtout quand admettre son ignorance semble coûteux. Devant un
      // client qui attend, « je ne sais pas encore » se sent comme un échec professionnel —
      // et c'est le moment exact où l'anti-fabulation cède. Le réflexe le dit en creux ; il
      // doit le dire comme une PERMISSION EXPLICITE, sinon il ne tient pas là où il sert.
      const s = sectionDe(metier, /réflexes/i, 'sur les réflexes');
      const { ligne, gras } = grasUnique(s.corps, /je ne sais pas/i, 'la permission de ne pas savoir');

      assert.match(
        gras, /ne te coûte rien|c.est une permission|est permis/i,
        `« ${ligne.trim()} » ne PERMET plus rien : dit en creux, l'aveu d'ignorance reste coûteux, `
          + `et c'est précisément à ce moment-là qu'un agent comble le vide en inventant`,
      );

      // ET IL NE DOIT PAS ÊTRE REPRÉSENTÉ COMME UN COÛT. Le contresens tient en un mot :
      // « c'est un aveu » au lieu de « pas un aveu » garde la phrase, sa place et son gras.
      // Les formulations qui NIENT le coût (« pas un aveu ») sont ignorées — le gabarit
      // correct en emploie une, et une sonde naïve rougirait sur le texte juste.
      // ET LA PERMISSION NE SE REPREND PAS PLUS BAS. Même trou que sur la borne des sources,
      // trouvé du même coup : le gras porte l'octroi, mais une réserve ajoutée en texte
      // courant — « sauf devant un client qui insiste, où il vaut mieux avancer quelque
      // chose » — la retirerait au moment exact où elle sert, sans toucher au gras.
      //
      // La garde de RÉSERVE porte donc sur la ligne entière ; celle du COÛT reste sur le gras,
      // et ce n'est pas une inconséquence : la prose NOMME légitimement le coût pour le
      // refuser (« se sent comme un échec professionnel »), et l'y interdire ferait rougir le
      // texte juste.
      exigeSansReserve(ligne, 'la permission de ne pas savoir');

      const cout = gras.match(COUTEUX);
      assert.ok(
        !cout,
        `« ${ligne.trim()} » présente l'ignorance avouée comme un coût (« ${cout && cout[0]} ») : `
          + `c'est l'inverse exact de ce que cette permission existe pour dire`,
      );
    },
  },

  {
    id: 'biais-autorite-trois-angles',
    quoi: 'les trois angles de l’autorité — la parole, la citation, le chiffre — sont tenus ensemble, chacun avec sa contrainte',
    verifier({ metier }) {
      // L'AUTORITÉ APPARENTE, À L'ENVERS. Le standard décrit le biais n°10 comme la tendance
      // à ACCORDER trop d'autorité à ce qu'un modèle produit. Chez ce persona il joue dans
      // l'autre sens : ce qu'il écrit PORTE l'autorité de Somtech, qu'il le veuille ou non.
      //
      // TENUS ENSEMBLE, ET LE COMPTE EST CE QUI LE PROUVE. Trois règles voisines que rien ne
      // relie, c'est trois règles dont on applique une en oubliant les deux autres. Les
      // éclater en trois endroits fait disparaître la section, donc rougir ; en retirer une
      // fait tomber le compte.
      const s = sectionDe(metier, /porte notre nom/i, 'sur ce que son écrit engage');
      const table = tableDe(s.corps);
      const iAngle = colonneDe(table, /^Ce que tu écris$/i, 'ce que tu écris');
      const iEngage = colonneDe(table, /^Ce que ça engage$/i, 'ce que ça engage');
      const iFait = colonneDe(table, /^Ce que tu fais$/i, 'ce que tu fais');

      // ⚠️ LA COLONNE DU MILIEU A ÉTÉ LAISSÉE SANS GARDE DANS LA PREMIÈRE VERSION, et c'est
      // la revue de fond qui l'a dit, par une mutation restée verte : permuter l'enjeu de
      // « la parole » avec celui du « chiffre » ne faisait rougir personne. Un tiers d'une
      // table présentée comme « trois portes d'une même pièce » n'était vérifié par rien.
      //
      // Ce n'est pas un détail d'exhaustivité : cette colonne est ce qui DIT POURQUOI la
      // conduite d'en face oblige. Permutée, elle enseigne qu'un chiffre engage notre lecture
      // des faits et qu'une parole engage une facture — deux justifications fausses, sous
      // lesquelles la conduite juste devient incompréhensible, donc négociable.
      const ANGLES = [
        {
          quoi: 'la parole — un problème remonte avant d’être dit',
          angle: /la parole/i,
          engage: /responsabilité/i,
          fait: [/remonte/i, /avant/i],
        },
        {
          quoi: 'la citation — jamais de guillemets sur ce qu’on n’a pas lu',
          angle: /la citation/i,
          engage: /officiellement/i,
          fait: [/aucun guillemet/i, /textuellement/i],
        },
        {
          quoi: 'le chiffre — l’envergure seulement',
          angle: /le chiffre/i,
          engage: /facture/i,
          fait: [/aucun chiffre/i, /envergure/i],
        },
      ];

      assert.equal(
        table.lignes.length, ANGLES.length,
        `${table.lignes.length} angle(s) écrit(s) pour ${ANGLES.length} gardé(s) — un angle retiré `
          + `laisse une porte ouverte que les deux autres ne ferment pas`,
      );

      for (const { quoi, angle, engage, fait } of ANGLES) {
        const ligne = ligneUnique(table, iAngle, angle, quoi);
        const action = ligne[iFait] ?? '';

        // L'ENJEU, ET SES DEUX PORTES. Présent en face du bon angle NE SUFFIT PAS : permuter
        // deux cellules laisse les trois enjeux présents dans la table et les apparie tous
        // au mauvais angle. On exige donc aussi qu'il soit ABSENT des deux autres lignes.
        assert.match(
          ligne[iEngage] ?? '', engage,
          `« ${quoi} » : l'enjeu écrit en face est « ${ligne[iEngage]} », qui ne dit plus ce que `
            + `cet angle engage — la conduite d'en face perd sa raison d'obliger`,
        );
        const ailleurs = table.lignes
          .filter((l) => l !== ligne)
          .map((l) => l[iEngage] ?? '')
          .filter((c) => engage.test(c));
        assert.deepEqual(
          ailleurs, [],
          `l'enjeu de « ${quoi} » figure aussi en face d'un autre angle (« ${ailleurs.join(' · ')} ») — `
            + `les enjeux sont permutés, et chaque conduite est justifiée par le risque d'une autre`,
        );

        for (const sonde of fait) {
          assert.match(
            action, sonde,
            `« ${quoi} » : la conduite écrite en face est « ${action.trim()} », qui ne dit plus ce `
              + `que l'angle exige — permuter les colonnes ou les cellules retourne la règle sans `
              + `en changer un mot`,
          );
        }
        // ET LA MODALITÉ, SUR SON TROISIÈME AXE. « aucun guillemet sur ce que tu n'as pas lu
        // textuellement — essaie de t'y tenir » garde chaque mot de la contrainte, n'ouvre
        // aucune exception, ne demande aucune permission, et cesse d'obliger.
        exigeContrainte(action, `la conduite tenue pour « ${quoi} »`);
      }
    },
  },

  {
    id: 'biais-les-sources-sont-bornees',
    quoi: 'ses deux sources sont nommées, et le web est exclu — y compris par un chemin que ses droits ne ferment pas',
    verifier({ metier }) {
      // LA MOITIÉ QUE LA MÉCANIQUE NE PEUT PAS TENIR. Les droits du lieu retirent les portes
      // évidentes vers le web (`WebFetch`, `WebSearch`, `curl`, `wget`) ; ils n'en retirent
      // pas la capacité — `python3 -c` et une dizaine d'autres restent ouverts, et une
      // commande non listée s'exécute sans rien demander (mesuré).
      //
      // La compétence qui pose le lieu attribue donc le reste au métier. Cette garde existe
      // pour que cette attribution soit VRAIE : trouvée en contre-revue, où le métier ne
      // portait aucun interdit de ce genre et où la compétence promettait pourtant qu'il en
      // portait un. Une garantie renvoyée à un texte qui ne la dit pas n'est portée par rien.
      const s = sectionDe(metier, /porte notre nom/i, 'sur ce que son écrit engage');
      const { ligne, gras } = grasUnique(s.corps, /chercher ailleurs/i, 'la borne de ses sources');

      for (const { quoi, sonde } of [
        { quoi: 'le registre', sonde: /registre/i },
        { quoi: 'ce que le client lui a dit', sonde: /client/i },
      ]) {
        assert.match(
          ligne, sonde,
          `« ${ligne.trim()} » ne nomme plus ${quoi} comme source — un interdit qui ne dit pas où `
            + `chercher renvoie à chercher n'importe où`,
        );
      }
      assert.match(
        ligne, /le web n.en est pas une|jamais le web/i,
        `« ${ligne.trim()} » n'exclut plus le web : c'est la moitié de la garantie que les droits `
          + `du lieu ne peuvent pas tenir, et la seule qui couvre les chemins qu'ils laissent ouverts`,
      );

      // ⚠️ LA MODALITÉ SE GARDE SUR LA LIGNE ENTIÈRE, JAMAIS SUR LE SEUL GRAS — et c'est la
      // troisième passe de revue qui l'a dit, par une mutation restée verte.
      //
      // La première version appelait `exigeContrainte(gras, …)`. Or le gras ne porte ici que
      // l'annonce (« tu ne vas jamais chercher ailleurs ») ; la clause qui porte réellement le
      // poids — « le web n'en est pas une » — vit en texte courant. Lui ajouter « sauf en
      // dernier recours si le registre et le client ne disent rien tous les deux » laissait les
      // deux fragments en gras intacts, l'assertion de présence satisfaite (elle cherche un
      // motif sans ancrage de fin), et rouvrait la porte que ce contrôle existe pour fermer.
      //
      // C'est le motif « une porte sur deux » appliqué à une garde de modalité : on avait
      // vérifié la modalité de ce qui est mis en avant, pas celle de ce qui oblige.
      exigeContrainte(ligne, 'la borne des sources');
      assert.ok(gras.length > 0, 'la borne des sources doit rester mise en avant — elle se lit sinon comme un commentaire');
    },
  },

  {
    id: 'biais-droits-bornes',
    quoi: 'ce qui n’a rien à faire dans une conversation client est REFUSÉ par les droits du lieu, pas confié à sa vigilance',
    verifier({ droits }) {
      // LE SEUL ÉTAGE QUI NE DÉPENDE D'AUCUNE VIGILANCE. Tout le reste de ce fichier garde un
      // texte ; celui-ci garde un fait.
      //
      // MESURÉ, PAS SUPPOSÉ (voir l'en-tête) : un outil nommé dans `deny` disparaît de la
      // session, y compris dans un dépôt non approuvé ; un outil nommé dans `allow` est
      // IGNORÉ tant qu'un humain n'a pas approuvé le dépôt. La garantie tient donc dans la
      // liste de refus, et nulle part ailleurs.
      //
      // POURQUOI LE WEB. Le représentant n'a que deux sources : le registre et ce que le
      // client lui dit. Une recherche web est l'entrée la plus directe du biais anglo-
      // occidental — on y cherche une règle de protection des renseignements et on y trouve
      // le RGPD — et le chemin par lequel une phrase lue ailleurs repart chez le client sous
      // notre nom. Rien dans son métier ne l'emploie : le refuser ne lui retire rien.
      const config = JSON.parse(droits);
      const deny = config.permissions?.deny ?? [];
      const allow = config.permissions?.allow ?? [];
      assert.ok(Array.isArray(deny) && deny.length > 0, 'les droits du lieu doivent porter une liste de refus non vide');

      // ⚠️ CE QUE CE CONTRÔLE NE PROUVE PAS, ET LA REVUE DE FOND A EU RAISON DE L'EXIGER ICI.
      //
      // Refuser `WebFetch` et `WebSearch` retire DEUX OUTILS, pas UNE CAPACITÉ. Le troisième
      // fait mesuré (voir l'en-tête) est sans appel : une commande shell non listée s'exécute
      // sans rien demander. `curl` et `wget` sont donc refusés eux aussi — mais `python3 -c`
      // et une dizaine d'autres chemins restent ouverts.
      //
      // `deny` est une LISTE FINIE CONTRE UN PHÉNOMÈNE OUVERT. Ce contrôle garde les portes
      // qu'on prend sans y penser ; il ne clôt pas le shell, et personne ne doit lire son vert
      // comme « le web est fermé ». La compétence qui pose le lieu dit la même limite, dans
      // les mêmes termes — c'est délibéré : une garantie surestimée est pire qu'une absente.
      const REFUSES = [
        { quoi: 'la lecture d’une page web', outil: 'WebFetch' },
        { quoi: 'la recherche sur le web', outil: 'WebSearch' },
        { quoi: 'la porte de sortie la plus banale vers le web', outil: 'Bash(curl*)' },
        { quoi: 'sa jumelle', outil: 'Bash(wget*)' },
        { quoi: 'l’écriture de fichiers', outil: 'Edit' },
        { quoi: 'la création de fichiers', outil: 'Write' },
      ];
      for (const { quoi, outil } of REFUSES) {
        assert.ok(
          deny.includes(outil),
          `« ${outil} » (${quoi}) n'est plus refusé : la protection redevient une consigne que `
            + `le représentant doit se rappeler, au lieu d'un moyen qu'il n'a pas`,
        );
      }

      // ET AUCUN OUTIL DES DEUX CÔTÉS À LA FOIS. Le déplacer vers `allow` sans le retirer de
      // `deny` est l'édition à moitié faite la plus banale ; elle laisse un lecteur humain
      // croire que l'outil est permis, et le prochain qui « nettoie la contradiction » a une
      // chance sur deux de retirer la bonne ligne.
      const deuxCotes = allow.filter((a) => deny.includes(a));
      assert.deepEqual(
        deuxCotes, [],
        `${deuxCotes.join(', ')} figure(nt) à la fois dans les droits accordés et refusés — `
          + `la lecture humaine du fichier ne dit plus ce qui s'applique`,
      );
      for (const { outil } of REFUSES) {
        assert.ok(!allow.includes(outil), `« ${outil} » est accordé alors qu'il doit être refusé`);
      }
    },
  },
];

// ═════════════════════════════════════════ les reformulations légitimes
//
// Le pendant des mutations, et il compte autant. Une garde trop étroite casse la chaîne sur
// une édition qui ne change rien au sens — et pousse celui qui la subit à l'assouplir plutôt
// qu'à la corriger. C'est ainsi qu'une garantie meurt de la main d'un ami.
//
// Chacune est vérifiée OPÉRANTE comme une mutation, puis exigée VERTE.

export const REFORMULATIONS_LEGITIMES = [
  {
    id: 'la-loi-25-est-precisee',
    quoi: 'la Loi 25 est complétée de son numéro de projet de loi',
    fichier: 'metier',
    reecrire: (t) => t.replace('la **Loi 25**. Et si', 'la **Loi 25** (P-39.1). Et si'),
  },
  {
    id: 'la-monnaie-est-precisee',
    quoi: '« dollars canadiens » gagne son code de devise',
    fichier: 'metier',
    reecrire: (t) => t.replace('des dollars **canadiens**', 'des dollars **canadiens** (CAD)'),
  },
  {
    id: 'le-critere-est-annote',
    quoi: 'la colonne des critères nomme le critère en plus de le coder',
    fichier: 'metier',
    reecrire: (t) => t.replace('| **C4** |', '| **C4** — contexte québécois |'),
  },
  {
    id: 'la-permission-du-doute-passe-aux-guillemets-droits',
    quoi: 'la citation de la permission passe aux guillemets droits, mot pour mot identique',
    fichier: 'metier',
    reecrire: (t) => t.replace(
      '**Et dire « je ne sais pas encore » ne te coûte rien',
      '**Et dire "je ne sais pas encore" ne te coûte rien',
    ),
  },
  {
    id: 'l-angle-du-chiffre-change-de-ponctuation',
    quoi: 'la contrainte du chiffre est introduite par un tiret plutôt que par un deux-points',
    fichier: 'metier',
    reecrire: (t) => t.replace(
      "**aucun chiffre : l'envergure seulement**",
      "**aucun chiffre — l'envergure seulement**",
    ),
  },
  {
    id: 'un-outil-de-plus-est-refuse',
    quoi: 'la liste de refus s’allonge d’un outil que le métier n’emploie pas',
    fichier: 'droits',
    reecrire: (t) => t.replace('"WebFetch",', '"WebFetch",\n      "NotebookRead",'),
  },
];

// ═════════════════════════════════════════ les mutations

export const MUTATIONS_BIAIS = [
  // ── le contexte québécois
  {
    id: 'biais-le-contexte-quebecois-disparait',
    quoi: 'le réflexe du contexte québécois est retiré — le gabarit retombe à 4/5 sur la grille',
    cible: 'biais-contexte-quebecois',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| 5 \| \*\*Contexte québécois\*\*.*\n/m, ''),
  },
  {
    id: 'biais-le-contexte-devient-vague',
    quoi: 'le contexte québécois est remplacé par « adapte-toi au contexte local » — il MENTIONNE sans IMPOSER',
    cible: 'biais-contexte-quebecois',
    fichier: 'metier',
    // La mutation que le ticket exige nommément, et celle que le motif dominant du dépôt
    // attrape le moins bien : le réflexe garde sa ligne, son rang, son nom et sa modalité.
    // Seuls ses marqueurs disparaissent — et sans eux, le modèle choisit ce qu'il a le plus lu.
    muter: (t) => t.replace(
      /^\| 5 \| \*\*Contexte québécois\*\* \|.*$/m,
      '| 5 | **Contexte québécois** | Les habitudes d’ailleurs, quand elles viennent plus vite | Adapte-toi au contexte local du client | **C4** |',
    ),
  },
  {
    id: 'biais-le-quebec-passe-du-mauvais-cote',
    quoi: 'les deux cellules du réflexe québécois sont permutées — « Inc. » devient ce que la pression fait dire',
    cible: 'biais-contexte-quebecois',
    fichier: 'metier',
    muter: (t) => t.replace(
      "| « LLC », un montant en dollars américains, le RGPD ou une autre loi que ce client n'a jamais eu à connaître | Le pays où il travaille : **Inc.**, des dollars **canadiens**, la **Loi 25**. Et si tu n'es pas sûr de la règle qui s'applique, tu n'en nommes aucune |",
      "| Le pays où il travaille : **Inc.**, des dollars **canadiens**, la **Loi 25**. Et si tu n'es pas sûr de la règle qui s'applique, tu n'en nommes aucune | « LLC », un montant en dollars américains, le RGPD ou une autre loi que ce client n'a jamais eu à connaître |",
    ),
  },
  {
    id: 'biais-le-contexte-devient-facultatif',
    quoi: 'le contexte québécois garde ses six marqueurs et ne s’applique plus que « dans la mesure du possible »',
    cible: 'biais-contexte-quebecois',
    fichier: 'metier',
    muter: (t) => t.replace(
      "tu n'en nommes aucune | **C4** |",
      "tu n'en nommes aucune, dans la mesure du possible | **C4** |",
    ),
  },

  // ── le raccord à la grille
  {
    id: 'biais-le-raccord-a-la-grille-est-permute',
    quoi: 'C1 et C2 sont permutés — l’audit conclurait que l’anti-fabulation réalise l’anti-sycophantie',
    cible: 'biais-raccord-a-la-grille',
    fichier: 'metier',
    muter: (t) => permuter(t, '| **C1** |', '| **C2** |'),
  },
  {
    id: 'biais-le-raccord-a-la-grille-disparait',
    quoi: 'la colonne des critères perd son en-tête — l’audit mensuel n’a plus où se lire',
    cible: 'biais-raccord-a-la-grille',
    fichier: 'metier',
    muter: (t) => t.replace("| Ce qu'il tient de la grille |", '| Notes |'),
  },

  // ── la permission de ne pas savoir
  {
    id: 'biais-le-doute-devient-un-aveu',
    quoi: 'la permission de ne pas savoir est retournée en coût — la phrase, sa place et son gras sont intacts',
    cible: 'biais-le-doute-est-permis',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Et dire « je ne sais pas encore » ne te coûte rien : c'est une permission, pas un aveu.**",
      "**Et dire « je ne sais pas encore » se paie : c'est un aveu que le client retiendra.**",
    ),
  },
  {
    id: 'biais-la-permission-du-doute-prend-une-reserve-hors-du-gras',
    quoi: 'la permission de ne pas savoir est reprise en texte courant — le gras l’octroie encore, la suite la retire',
    cible: 'biais-le-doute-est-permis',
    fichier: 'metier',
    // Le jumeau du trou trouvé sur la borne des sources, fermé du même geste : une garantie
    // dont on ne garde que la mise en avant se reprend deux phrases plus bas. Et la réserve
    // écrite ici est celle qui viendrait vraiment — elle vise le moment exact où la
    // permission sert, c'est-à-dire devant quelqu'un qui insiste.
    muter: (t) => t.replace(
      'est une réponse entière, pas une dérobade.',
      'est une réponse entière, pas une dérobade — sauf devant un client qui insiste, où il vaut mieux avancer quelque chose.',
    ),
  },
  {
    id: 'biais-la-permission-du-doute-disparait',
    quoi: 'la permission de ne pas savoir est retirée — la calibration ne la dit plus qu’en creux',
    cible: 'biais-le-doute-est-permis',
    fichier: 'metier',
    muter: (t) => t.replace(/^\*\*Et dire « je ne sais pas encore ».*\n/m, ''),
  },

  // ── les trois angles de l'autorité
  {
    id: 'biais-l-angle-de-la-citation-disparait',
    quoi: 'l’angle de la citation est retiré — on applique les deux autres en oubliant celui-là',
    cible: 'biais-autorite-trois-angles',
    fichier: 'metier',
    muter: (t) => t.replace(/^\| \*\*La citation\*\*.*\n/m, ''),
  },
  {
    id: 'biais-les-en-tetes-de-l-autorite-permutes',
    quoi: 'les en-têtes des trois angles sont permutés — ce que ça engage se lit comme ce qu’il faut faire',
    cible: 'biais-autorite-trois-angles',
    fichier: 'metier',
    muter: (t) => t.replace(
      '| Ce que tu écris | Ce que ça engage | Ce que tu fais |',
      '| Ce que tu écris | Ce que tu fais | Ce que ça engage |',
    ),
  },
  {
    id: 'biais-les-enjeux-de-l-autorite-permutes',
    quoi: 'les enjeux de « la parole » et du « chiffre » sont permutés — chaque conduite est justifiée par le risque d’une autre',
    cible: 'biais-autorite-trois-angles',
    fichier: 'metier',
    // La mutation que la revue de fond a posée et qui est RESTÉE VERTE : la colonne du milieu
    // n'était lue par aucun contrôle. Elle reste ici pour que ce trou ne puisse pas revenir.
    muter: (t) => permuter(
      t,
      'notre responsabilité sur ta lecture des faits, et ta lecture de la première heure est souvent fausse',
      'une facture et une échéance, quelle que soit ta prudence de langage',
    ),
  },
  {
    id: 'biais-la-contrainte-devient-un-conseil',
    quoi: 'l’interdit de citer ce qu’on n’a pas lu garde TOUS ses mots et cesse d’obliger — « essaie de t’y tenir »',
    cible: 'biais-autorite-trois-angles',
    fichier: 'metier',
    // La seconde mutation que le ticket exige nommément. Elle est écrite pour n'être vue que
    // par l'axe MODALITÉ : le vocabulaire de la contrainte est intact, sa polarité aussi, son
    // compte aussi. Une garde de vocabulaire la laisserait passer.
    muter: (t) => t.replace(
      "**aucun guillemet sur ce que tu n'as pas lu textuellement.**",
      "**aucun guillemet sur ce que tu n'as pas lu textuellement** — essaie de t'y tenir.",
    ),
  },
  {
    id: 'biais-le-chiffre-se-donne-pour-situer',
    quoi: 'l’angle du chiffre autorise un ordre de grandeur chiffré « pour qu’il se situe »',
    cible: 'biais-autorite-trois-angles',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**aucun chiffre : l'envergure seulement**",
      "**un ordre de grandeur chiffré, pour qu'il se situe**",
    ),
  },

  // ── la borne des sources
  {
    id: 'biais-le-web-redevient-une-source',
    quoi: 'le web redevient une source « à vérifier au besoin » — la moitié que la mécanique ne tient pas s’ouvre',
    cible: 'biais-les-sources-sont-bornees',
    fichier: 'metier',
    muter: (t) => t.replace(
      "Le web n'en est pas une — ni par tes outils, ni par le terminal, ni par quelqu'un à qui tu le ferais chercher.",
      "Le web peut compléter, au besoin, quand le registre ne dit rien.",
    ),
  },
  {
    id: 'biais-la-borne-des-sources-prend-une-reserve-hors-du-gras',
    quoi: 'l’exclusion du web prend une réserve EN TEXTE COURANT — les deux fragments en gras sont intacts',
    cible: 'biais-les-sources-sont-bornees',
    fichier: 'metier',
    // Posée par la troisième passe de revue, et RESTÉE VERTE contre la première version du
    // contrôle : la modalité n'était gardée que sur le gras, et la clause qui oblige vit en
    // texte courant. « Sauf en dernier recours » est par ailleurs la réserve qui arrive
    // toujours — le registre et le client se taisent bien plus souvent qu'on ne le croit.
    muter: (t) => t.replace(
      "Le web n'en est pas une — ni par tes outils",
      "Le web n'en est pas une, sauf en dernier recours si le registre et le client ne disent rien tous les deux — ni par tes outils",
    ),
  },
  {
    id: 'biais-la-borne-des-sources-devient-un-conseil',
    quoi: 'la borne garde tous ses mots et cesse d’obliger — « mieux vaut ne pas aller chercher ailleurs »',
    cible: 'biais-les-sources-sont-bornees',
    fichier: 'metier',
    muter: (t) => t.replace(
      "**Et tu ne vas jamais chercher ailleurs ce que tu n'as pas.**",
      "**Et mieux vaut ne pas aller chercher ailleurs ce que tu n'as pas.**",
    ),
  },

  // ── les droits du lieu
  {
    id: 'biais-le-web-redevient-atteignable',
    quoi: 'la lecture de pages web n’est plus refusée — une phrase lue ailleurs peut repartir chez le client sous notre nom',
    cible: 'biais-droits-bornes',
    fichier: 'droits',
    muter: (t) => t.replace(/^\s*"WebFetch",\n/m, ''),
  },
  {
    id: 'biais-la-porte-de-sortie-du-shell-se-rouvre',
    quoi: 'la commande `curl` n’est plus refusée — le web redevient atteignable sans passer par aucun outil web',
    cible: 'biais-droits-bornes',
    fichier: 'droits',
    // Trouvée par la revue de fond : la première version refusait les deux OUTILS du web et
    // laissait la CAPACITÉ ouverte par le shell. Mesuré depuis : `Bash(curl*)` dans `deny`
    // fait refuser la commande, et une commande non listée s'exécute sans rien demander.
    muter: (t) => t.replace(/,\n\s*"Bash\(curl\*\)"/, ''),
  },
  {
    id: 'biais-le-web-passe-du-cote-permis',
    quoi: 'la recherche web est ajoutée aux droits accordés sans être retirée des refusés',
    cible: 'biais-droits-bornes',
    fichier: 'droits',
    muter: (t) => t.replace('      "Read",', '      "Read",\n      "WebSearch",'),
  },
];

// nom-de-riviere.js — QUEL NOM PORTE UN AGENT QUI NAÎT, et rien d'autre.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE FICHIER FERME (T-20260818-0124, T-20260818-0140, E-20260818-0017)
//
// Mesuré le 2026-08-18 : `0` occurrence de « rivière » dans tout le dépôt. Le nom d'un agent
// était SIMPLEMENT L'ARGUMENT TRANSMIS — `nomAgentHerdr` n'en ajustait que la casse. Les
// quatre rivières portées sur ce poste (`matapedia`, `batiscan`, `ristigouche`, `bonaventure`)
// ont TOUTES été données à la main ou par une amorce.
//
// **Ce n'était pas un mécanisme en panne : il n'y en avait jamais eu.** Conséquence directe,
// et le parc la portait déjà : sur 42 agents, `orchestrateur` (un rôle, que tous pourraient
// porter) et `rev-pr31` (un nom raccordé à une PR) — ni code de mandat, ni rivière, et
// personne ne s'en était aperçu. **Une règle que rien ne fait respecter produit ce parc-là.**
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QUI A ÉTÉ TRANCHÉ (C1, par `matapedia`, 2026-08-18)
//
//   • **Un ORCHESTRATEUR — qui arbitre — porte un nom de rivière.** Il vit longtemps et porte
//     plusieurs mandats successifs : un code unique le décrit mal par construction.
//   • **Un CHEF D'ÉQUIPE — qui exécute — porte le code de son mandat.** C'est `R3`, qui reste
//     entier pour la population pour laquelle il a été écrit, et qui dit désormais laquelle.
//   • **LE LIEU PORTE LE CODE DU MANDAT, L'AGENT PORTE LA RIVIÈRE.** Le lieu est attaché à un
//     chantier et versé dans son dépôt ; le nom sert à ADRESSER quelqu'un. `naitre.js` portait
//     déjà `avisDeCasse`, qui prévient quand l'agent ne portera pas le nom de son lieu : l'écart
//     était PRÉVU depuis T-20260814-0143, jamais interdit. La garde l'ACCEPTE en le disant.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ L'UNICITÉ NE SE MESURE PAS DANS SA SEULE FAMILLE, et le motif est déjà payé sur ce dépôt :
// un nom libre chez les agents peut être pris par un chantier, un canal ou un BRD. On relève
// donc le parc herdr, le registre des lignes (chantiers ET canaux) et les lieux posés — et **ce
// qu'on n'a pas pu mesurer se DIT**, dans un champ à part, plutôt que de se conclure.
//
// ⚠️ DEUX CHAMPS SÉPARÉS, ET C'EST LA LEÇON DU LOT A : `pris` porte des noms, `nonVerifie`
// porte des raisons. Le lot A a rendu un résultat qui changeait selon la machine — vert chez
// l'auteur, rouge en CI — parce qu'une raison de non-vérification s'était glissée dans une
// liste que des contrôles comptaient. Un compte qui pourrait avaler une phrase n'est pas un
// compte. Ils ne se mêlent jamais, et un essai l'exige.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LES RIVIÈRES — la liste, et elle est ÉCRITE plutôt que dérivée.
 *
 * ⚠️ D'OÙ ELLE VIENT ÉTAIT `[non établi]` (T-20260818-0124) : les quatre rivières du poste
 * avaient été choisies à la main, sans source. Elle est donc POSÉE ici, et c'est le seul
 * endroit : des rivières du Québec, écrites comme herdr les accepte — minuscules, sans
 * accent, tirets permis (`^[a-z][a-z0-9_-]{0,31}$`). `matapedia` et `ristigouche` s'y
 * retrouvent sous la forme exacte que les agents vivants portent déjà, sans quoi la garde
 * refuserait les noms qu'on a nous-mêmes donnés.
 *
 * ⚠️ CE QUI N'Y EST PAS, ET POURQUOI : les noms génériques (« noire », « rouge », « du
 * diable », « saint-jean ») sont écartés bien qu'ils désignent de vraies rivières. Un nom
 * d'agent sert à ADRESSER quelqu'un ; un mot qu'une phrase ordinaire contient déjà ne
 * distingue personne, et c'est exactement le défaut de `orchestrateur`.
 *
 * ⚠️ ELLE S'ALLONGE, ELLE NE SE DEVINE PAS. La garde est une LISTE BLANCHE : un nom hors
 * liste est refusé, y compris une rivière réelle qu'on n'aurait pas inscrite. C'est délibéré —
 * une liste noire oublie toujours un cas, et ce dépôt a déjà tranché dans ce sens
 * (`lieu-nom.js`). Le refus DIT le geste : ajouter la rivière ici.
 */
export const RIVIERES = Object.freeze([
  'matapedia', 'ristigouche', 'bonaventure', 'batiscan', 'saguenay', 'manicouagan',
  'mistassini', 'mistassibi', 'peribonka', 'ashuapmushuan', 'outaouais', 'gatineau',
  'richelieu', 'chaudiere', 'yamaska', 'nicolet', 'harricana', 'koksoak',
  'caniapiscau', 'eastmain', 'rupert', 'romaine', 'natashquan', 'moisie',
  'magpie', 'mingan', 'godbout', 'betsiamites', 'portneuf', 'escoumins',
  'malbaie', 'montmorency', 'jacques-cartier', 'etchemin', 'assomption', 'ouareau',
  'maskinonge', 'saint-maurice', 'mitis', 'matane', 'rimouski', 'cascapedia',
  'patapedia', 'kipawa', 'dumoine', 'coulonge', 'mattawin', 'vermillon',
  'bostonnais', 'metabetchouan', 'chicoutimi', 'shipshaw', 'valin', 'pentecote',
]);

const PAR_NOM = new Set(RIVIERES);

/** Ce nom est-il une rivière de la liste ? La comparaison est insensible à la casse. */
export function estUneRiviere(nom) {
  return PAR_NOM.has(String(nom ?? '').toLowerCase());
}

/**
 * LA RÈGLE, DITE EN FRANÇAIS — un seul texte, cité par le refus et par l'aide.
 *
 * Le motif vient de `lieu-nom.js`, et il a été payé là-bas : garder l'accord entre DEUX textes
 * échoue à la première réécriture de l'un des deux. Il n'y en a donc qu'un.
 */
export const REGLE_NOM_ORCHESTRATEUR =
  'un orchestrateur porte un nom de rivière — il arbitre, il vit plusieurs mandats, et un ' +
  'code de mandat unique le décrirait mal. Son LIEU, lui, garde le code du mandat. Un chef ' +
  'd\'équipe, qui exécute, continue de porter le code de son mandat.';

/**
 * LE VERDICT SUR UN NOM PROPOSÉ POUR UN ORCHESTRATEUR.
 *
 * Rend `{ conforme: true }` ou `{ conforme: false, motif, message }` — jamais autre chose, et
 * jamais un « peut-être ». Le motif est un code stable (`pas_une_riviere`), le message est ce
 * qu'un humain lit.
 *
 * ⚠️ ELLE NE JUGE QUE CE QU'ON LUI PROPOSE. Une naissance où personne ne demande de nom ne
 * passe pas par ici : elle passe par `attribuerRiviere`, qui en donne un. Confondre les deux
 * ferait refuser la naissance qu'on veut rendre normale.
 */
export function jugerNomDOrchestrateur(nom) {
  const propose = String(nom ?? '').toLowerCase();
  if (estUneRiviere(propose)) return { conforme: true };
  return {
    conforme: false,
    motif: 'pas_une_riviere',
    message:
      `« ${String(nom ?? '')} » ne peut pas nommer un orchestrateur : ${REGLE_NOM_ORCHESTRATEUR}\n` +
      `  Mesuré sur le parc du 2026-08-18 : deux agents sur 42 portaient un nom hors convention ` +
      `(« orchestrateur », un rôle que tous pourraient porter ; « rev-pr31 », raccordé à une PR) — ` +
      `on ne pouvait remonter d’aucun des deux à un chantier.\n` +
      `  Les gestes qui lèvent le blocage : laisser la naissance attribuer la rivière (ne rien ` +
      `passer), en nommer une de la liste, ou ajouter celle qui manque dans ` +
      `« ligne-directe/src/nom-de-riviere.js ».`,
  };
}

/**
 * LE PARC DES NOMS DÉJÀ PRIS — au-delà de la seule famille des agents.
 *
 * Trois sources sont mesurables sans réseau, et une quatrième ne l'est pas :
 *
 *   1. **les agents herdr** — ce que `herdr agent list` rend ;
 *   2. **le registre des lignes** — ses CHANTIERS et ses noms de CANAL. `matapedia` avait
 *      renoncé à le lire (« structure inattendue ») : `lignes` est un TABLEAU, pas une table ;
 *   3. **les lieux posés dans le dépôt** — `.orchestrateur/*` et `.gestionnaire/*` ;
 *   4. ⚠️ **le ServiceDesk et les BRD** — hors d'atteinte d'ici : ce module tourne sur le poste,
 *      sans jeton ni réseau. Ça ne se conclut donc pas, ça se DIT.
 *
 * @param {object} p
 * @param {string} [p.depot]         le dépôt où chercher les lieux posés
 * @param {() => string[]} [p.listerAgents]  rend les noms d'agents — lève si elle n'a pas pu
 * @param {() => object} [p.lireRegistre]    rend le registre — lève si elle n'a pas pu
 * @returns {{pris: string[], nonVerifie: string[]}} deux champs, qui ne se mêlent JAMAIS
 */
export function parcDesNoms({ depot, listerAgents, lireRegistre } = {}) {
  const pris = new Set();
  const nonVerifie = [];

  if (listerAgents) {
    try {
      for (const n of listerAgents()) if (n) pris.add(String(n).toLowerCase());
    } catch (err) {
      nonVerifie.push(`les agents de ce poste (${String(err?.message ?? err).trim()})`);
    }
  } else {
    nonVerifie.push('les agents de ce poste (aucun moyen de les lister n’a été fourni)');
  }

  if (lireRegistre) {
    try {
      const registre = lireRegistre();
      const lignes = Array.isArray(registre?.lignes) ? registre.lignes : [];
      for (const l of lignes) {
        if (l?.chantier) pris.add(String(l.chantier).toLowerCase());
        if (l?.canal_nom) pris.add(String(l.canal_nom).toLowerCase());
      }
      for (const c of Object.values(registre?.communs ?? {})) {
        if (c?.canal_nom) pris.add(String(c.canal_nom).toLowerCase());
      }
    } catch (err) {
      nonVerifie.push(`les chantiers et canaux du registre (${String(err?.message ?? err).trim()})`);
    }
  } else {
    nonVerifie.push('les chantiers et canaux du registre (aucun moyen de le lire n’a été fourni)');
  }

  if (depot) {
    for (const dossier of ['.orchestrateur', '.gestionnaire']) {
      try {
        for (const e of readdirSync(join(depot, dossier), { withFileTypes: true })) {
          if (e.isDirectory()) pris.add(e.name.toLowerCase());
        }
      } catch {
        // Un dossier de rôle absent n'est pas une anomalie : c'est le cas du premier lieu.
        // Rien à relever, et rien à signaler — il n'y a pas de mesure manquée, il n'y a rien.
      }
    }
  } else {
    nonVerifie.push('les lieux déjà posés (aucun dépôt n’a été donné)');
  }

  // ⚠️ CE QU'ON NE PEUT PAS ATTEINDRE D'ICI, ET QUI EST DIT PLUTÔT QUE SUPPOSÉ LIBRE.
  // C'est très exactement le point que `T-20260818-0124` laissait ouvert : `matapedia` a
  // proposé `bonaventure` en disant n'avoir vérifié ni les codes de chantier au ServiceDesk,
  // ni les BRD. La garde ne fait pas mieux que lui sur ce point — elle le DIT au lieu de le
  // taire, ce qui est toute la différence entre une mesure partielle et une conclusion fausse.
  nonVerifie.push('les codes de chantier du ServiceDesk et les BRD (hors d’atteinte du poste : ni jeton ni réseau ici)');

  return { pris: [...pris].sort(), nonVerifie };
}

/**
 * LA RIVIÈRE ATTRIBUÉE À UN MANDAT — déterministe, et libre au parc.
 *
 * ⚠️ DÉTERMINISTE, ET CE N'EST PAS UN DÉTAIL. Le point de départ vient d'une empreinte du code
 * du mandat, jamais d'un tirage : deux naissances du même mandat, sur le même parc, rendent la
 * même rivière. Un tirage au sort rendrait la commande inéprouvable et ferait changer de nom un
 * orchestrateur qui redémarre — donc inadressable, ce que le nom sert précisément à empêcher.
 *
 * La liste est parcourue en boucle depuis ce point : la première rivière libre gagne. Deux
 * mandats différents partent donc d'endroits différents, et ne se disputent une rivière que
 * lorsque la liste se remplit.
 *
 * @returns {{nom: string}|{nom: null, motif: string, message: string}} — l'épuisement de la
 *   liste est un REFUS nommé, jamais un repli sur un nom déjà pris.
 */
export function attribuerRiviere({ code, pris = [] } = {}) {
  const occupes = new Set([...pris].map((n) => String(n).toLowerCase()));
  const empreinte = createHash('sha256').update(String(code ?? ''), 'utf8').digest();
  const depart = empreinte.readUInt32BE(0) % RIVIERES.length;
  for (let i = 0; i < RIVIERES.length; i += 1) {
    const candidate = RIVIERES[(depart + i) % RIVIERES.length];
    if (!occupes.has(candidate)) return { nom: candidate };
  }
  return {
    nom: null,
    motif: 'rivieres_epuisees',
    message:
      `les ${RIVIERES.length} rivières de la liste sont déjà portées sur ce poste — aucune n’est ` +
      `libre pour « ${String(code ?? '')} ».\n` +
      `  Le geste qui lève le blocage : ferme les agents qui ne servent plus, ou ajoute des ` +
      `rivières dans « ligne-directe/src/nom-de-riviere.js ».`,
  };
}

/**
 * OÙ LE NOM D'UN AGENT EST INSCRIT DANS SON LIEU.
 *
 * ⚠️ IL EST PERSISTÉ, ET C'EST CE QUI REND LA RENAISSANCE FIDÈLE. Sans lui, un orchestrateur
 * qui redémarre après qu'une autre rivière a été prise dériverait vers un autre nom : le
 * dirigeant l'appellerait par un nom qu'il ne porte plus. Le fichier vit DANS le lieu, donc il
 * est versé avec lui, donc il survit au poste.
 *
 * ⚠️ IL N'APPARTIENT PAS AU GABARIT — la garde de fraîcheur compare des gabarits, pas des
 * lieux, et la convergence ne copie que ce que le gabarit porte. Ce fichier n'est donc ni
 * mesuré ni écrasé par elles.
 */
export const FICHIER_NOM_AGENT = '.nom-agent';

/**
 * Le nom que ce lieu porte déjà — et « je n'ai pas pu regarder » n'est PAS « il n'en porte pas ».
 *
 * ⚠️ RELEVÉ EN REVUE DE FOND (passe 2, E-20260818-0017), ET LE MODE DE PANNE EST SILENCIEUX. Un
 * `catch` unique avalait tout : un `.nom-agent` présent mais ILLISIBLE — permissions, montage
 * réseau qui décroche — se lisait « aucun nom », et la naissance attribuait alors une AUTRE
 * rivière que celle que le lieu portait. L'orchestrateur changeait de nom sans que rien ne le
 * dise, c'est-à-dire exactement ce que ce fichier existe pour empêcher.
 *
 * `ENOENT` est la seule absence : c'est le cas du premier baptême, et il est normal. Tout le
 * reste est une mesure MANQUÉE, et une mesure manquée ne conclut rien — elle se dit. C'est la
 * règle à trois états de `fraicheur-gabarit.js`, appliquée un cran plus bas.
 *
 * @returns {{nom: string|null, illisible?: string}} `nom: null` sans `illisible` = il n'en
 *   porte pas ; `illisible` renseigné = on n'a pas su lire, et on n'en conclut RIEN.
 */
export function nomInscritDansLeLieu(lieu) {
  try {
    const brut = readFileSync(join(lieu, FICHIER_NOM_AGENT), 'utf8').trim().toLowerCase();
    return { nom: brut || null };
  } catch (err) {
    if (err?.code === 'ENOENT') return { nom: null };
    return { nom: null, illisible: String(err?.message ?? err).trim() };
  }
}

/** Inscrit le nom dans le lieu — une ligne, rien d'autre à relire plus tard. */
export function inscrireNomDansLeLieu(lieu, nom) {
  writeFileSync(join(lieu, FICHIER_NOM_AGENT), `${nom}\n`);
}

/**
 * LE NOM QUE PORTERA L'AGENT QUI NAÎT — le seul endroit où la question se tranche.
 *
 * Quatre chemins, dans cet ordre, et il compte :
 *
 *   1. **un rôle qui n'est pas orchestrateur** → le nom de son lieu, comme avant ce lot. La
 *      règle ne déborde pas sur qui exécute, et un gestionnaire de client porte le prénom de
 *      la personne qu'il représente — c'est légitime et distinct (`charles-olivier`).
 *   2. **un nom PROPOSÉ** → jugé. Hors convention, c'est un refus, et l'appelant n'a encore
 *      rien créé.
 *   3. **un nom DÉJÀ INSCRIT dans le lieu** → repris tel quel. ⚠️ Il est repris MÊME s'il est
 *      hors convention, et c'est un choix : refuser rendrait un lieu déjà posé impossible à
 *      rouvrir, pour un fichier qu'aucune naissance n'a pu écrire — donc écrit à la main. On
 *      le SIGNALE (`avis`) plutôt que de bloquer quelqu'un sur l'erreur d'un autre.
 *   4. **rien** → on attribue, et c'est le cas qui fait tout ce lot : *une naissance dont
 *      personne ne demande le nom porte quand même sa rivière.*
 *
 * ⚠️ CE QUI EST RENDU NE CONCLUT PAS CE QU'IL N'A PAS MESURÉ : `nonVerifie` voyage avec le
 * nom, séparé de `pris`, pour que l'appelant puisse le DIRE à l'écran.
 *
 * @returns {{nom: string, source: string, attribue: boolean, avis: string|null, nonVerifie: string[]}}
 *          ou `{ nom: null, motif, message }` quand c'est un refus. `source` dit D'OÙ le nom
 *          vient — c'est ce qui permet à l'appelant de rattacher un refus ultérieur à sa cause
 *          plutôt que de laisser deux messages sans fil entre eux (relevé en revue de fond).
 */
export function nomDeLAgentQuiNait({ role, lieu, code, propose = null, depot, listerAgents, lireRegistre } = {}) {
  if (role !== 'orchestrateur') {
    return { nom: String(code ?? '').toLowerCase(), source: 'lieu_du_role', attribue: false, avis: null, nonVerifie: [] };
  }

  if (propose) {
    const verdict = jugerNomDOrchestrateur(propose);
    if (!verdict.conforme) return { nom: null, motif: verdict.motif, message: verdict.message };
    return { nom: String(propose).toLowerCase(), source: 'propose', attribue: false, avis: null, nonVerifie: [] };
  }

  const lu = lieu ? nomInscritDansLeLieu(lieu) : { nom: null };
  if (lu.illisible) {
    // ⚠️ ON REFUSE PLUTÔT QUE D'ATTRIBUER. Le lieu porte peut-être déjà un nom ; passer outre
    // en donnerait un second à quelqu'un qui en a un, et personne ne l'apprendrait. Un refus se
    // voit, une dérive de nom ne se voit pas.
    return {
      nom: null,
      motif: 'nom_du_lieu_illisible',
      message:
        `le lieu porte un « ${FICHIER_NOM_AGENT} » qu'on n'a pas su lire (${lu.illisible}) — on ne ` +
        `sait donc pas quel nom il portait, et on n'en attribue PAS un autre : ce serait le faire ` +
        `changer de nom sans que personne l'apprenne.\n` +
        `  Le geste qui lève le blocage : rends « ${FICHIER_NOM_AGENT} » lisible dans le lieu, ou ` +
        `efface-le pour qu'une rivière soit attribuée de nouveau.`,
    };
  }
  const inscrit = lu.nom;
  if (inscrit) {
    return {
      nom: inscrit,
      source: 'inscrit_dans_le_lieu',
      attribue: false,
      avis: estUneRiviere(inscrit)
        ? null
        : `le lieu porte déjà le nom « ${inscrit} », qui n’est pas une rivière — il est repris ` +
          `tel quel plutôt que de rendre ce lieu impossible à rouvrir. Aucune naissance n’a pu ` +
          `l’écrire : il a été posé à la main. Le corriger, c’est effacer « ${FICHIER_NOM_AGENT} » ` +
          `dans le lieu et refaire naître.`,
      nonVerifie: [],
    };
  }

  const { pris, nonVerifie } = parcDesNoms({ depot, listerAgents, lireRegistre });
  const tirage = attribuerRiviere({ code, pris });
  if (!tirage.nom) return { nom: null, motif: tirage.motif, message: tirage.message };
  return { nom: tirage.nom, source: 'attribue', attribue: true, avis: null, nonVerifie };
}

/** Le lieu porte-t-il déjà un nom inscrit ? — pour les appelants qui veulent le savoir sans lire. */
export function lieuPorteUnNom(lieu) {
  return Boolean(lieu) && existsSync(join(lieu, FICHIER_NOM_AGENT));
}

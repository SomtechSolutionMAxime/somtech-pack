// declaration-des-agents.js — CE QUE LA DÉCLARATION DE NAISSANCE DIT D'UN AGENT VIVANT.
// (T-20260825-0012, sous E-20260825-0002, D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CE MODULE EST, ET CE QU'IL N'EST PAS
//
// Il JOINT deux choses qui existaient déjà sans se connaître : le registre des déclarations
// (`naissance-representant/src/declaration.js`, hors dépôt, écrit par le geste de naissance) et
// le recensement du poste (`recensement.js`, qui mesure qui est vivant). Il ne LIT rien —
// aucun disque, aucun réseau — et c'est ce qui le rend éprouvable loin des agents vivants :
// les déclarations lui arrivent par paramètre, comme toute l'I/O de `recensement.js`.
//
// ⚠️ IL NE CONSTITUE AUCUN SECOND REGISTRE (RA-VUE-004). Le registre des agents est UNIQUE et
// c'est le recensement ; la déclaration s'y RATTACHE. Un agent qui n'apparaît pas au recensement
// n'existe pas parce qu'une déclaration porte son nom — une déclaration est un fait sur une
// naissance passée, pas une preuve de vie.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 DÉCLARÉ N'EST PAS ÉTABLI — RA-VUE-005/006, et c'est ce que ce module protège
//
// « établi » veut dire, dans le recensement, MESURÉ AU LIEU : les quatre fichiers du gabarit
// posés ET les en-têtes réels du métier (`roleDuLieu`). C'est un fait qu'on va vérifier sur le
// disque. Une déclaration, elle, est ce que le geste de naissance a ÉCRIT — un fait daté, avec
// un auteur, mais personne ne l'a re-mesurée depuis.
//
// Les deux ne se confondent donc jamais, et quand les deux existent, **le LIEU l'emporte** :
// le prouvé prime le déclaré. C'est aussi ce qui fait qu'ajouter cette source ne peut pas
// dégrader une ligne qui était déjà juste.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ POURQUOI LES LIBELLÉS DES RÔLES DÉCLARÉS NE VIVENT PAS DANS `roles.js`
//
// `roles.js` est la table des rôles QUI ONT UN LIEU : chacune de ses entrées déclare un
// `dossier`, des `gabarits` et des `entetes`, et tout le dépôt lit ces clés. `chef-equipe.js`
// l'a MESURÉ : y inscrire un rôle sans `entetes` fait tomber `roleDuLieuOuRefus` sur
// `Object.entries(undefined)`, dont dépend la naissance de TOUS les autres rôles. Un chef
// d'équipe n'a pas de lieu — EF-AGT-006 l'interdit — donc son rôle ne peut pas y entrer.
//
// Ce module NE RÉÉCRIT PAS pour autant les libellés qui existent : il demande d'abord à
// `roles.js`, et ne complète que ce qu'il ne sait pas. Et il n'ÉPELLE aucun nom de rôle —
// `ROLE_CHEF_EQUIPE` est importé de là où le producteur l'écrit, sans quoi le jour où ce mot
// change, la jointure se romprait en silence des deux côtés à la fois.
//
// 📌 REMONTÉ AU COORDONNATEUR : le lieu naturel de ces libellés est `chef-equipe.js`, avec le
// nom du rôle. Il est dans le lot `naissance-representant/` en cours de revue, qu'on ne touche
// pas ici. Le jour où il s'ouvre, ces deux lignes déménagent et ce module les importe.

import { role as roleDe } from './roles.js';
// ⚠️ LA JOINTURE D'ESPACE A UN SEUL ENDROIT OÙ VIVRE, ET C'EST CELUI QUI L'A PAYÉE. Elle résout
// les liens symboliques des DEUX côtés (`/tmp` contre `/private/tmp` sur macOS) et fait du
// séparateur — jamais du préfixe — la frontière d'un espace. Une seconde expression écrite ici
// divergerait au premier correctif appliqué d'un seul côté, et celle qui divergerait accuserait
// un chef d'équipe RÉGULIER d'être né hors dispositif (9dfad89), ou l'inverse.
//
// ⚠️ ET CET IMPORT FERME UN CYCLE — `garde-des-naissances.js` importe `recensement.js`, qui
// importe ce module. Il est SÛR parce que rien n'est lu au moment de l'évaluation : les deux
// côtés ne s'échangent que des DÉCLARATIONS DE FONCTION, qui sont hoistées avant tout code.
// Un banc éprouve les deux ordres d'entrée plutôt que de s'en remettre à ce raisonnement.
import { memeEspaceDeTravail } from '../../naissance-representant/src/garde-des-naissances.js';
// Même règle : le CHAMP `session_herdr` a deux étages qui n'y mettaient pas la même chose (un
// nom d'un côté, un chemin de socket de l'autre). `identiteDeSession` est la seule lecture, et
// elle est idempotente — c'est ce qui la rend posable des deux côtés de la comparaison.
import { identiteDeSession } from '../../naissance-representant/src/declaration.js';
import { ROLE_CHEF_EQUIPE } from '../../naissance-representant/src/chef-equipe.js';

/**
 * LA SOURCE, ÉCRITE UNE FOIS — et elle voyage avec le fait, jamais dans un rangement.
 *
 * ⚠️ RA-VUE-006 : un lien déclaré NE SE PRÉSENTE JAMAIS COMME UN LIEN PROUVÉ. Un lecteur qui
 * reçoit une entrée seule doit pouvoir dire d'où vient le rôle qu'elle porte, sans lire ce
 * fichier ni savoir dans quel tableau elle se trouvait.
 */
export const SOURCE_DECLAREE = 'déclarée';

/**
 * LES LIBELLÉS DES RÔLES QUE `roles.js` NE PEUT PAS PORTER — voir l'en-tête pour le pourquoi.
 *
 * ⚠️ LA CLÉ EST IMPORTÉE, JAMAIS ÉPELÉE. C'est la seule chose qui tient ce tableau accordé au
 * producteur : un `'chef-equipe'` écrit à la main ici cesserait d'apparier le jour où le mot
 * change chez lui, et le registre rendrait le nom brut sans que rien ne rougisse.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 C'EST UNE FONCTION, ET PAS UN OBJET DE MODULE — ET ÇA A COÛTÉ LE GESTE DE NAISSANCE.
 *
 * Écrit `const LIBELLES_DECLARES = { [ROLE_CHEF_EQUIPE]: … }`, ce tableau LISAIT une constante
 * IMPORTÉE au moment où ce module s'évalue. Dans le cycle que ce fichier ferme, cela suffit à
 * tout casser dès qu'on entre par le bon côté : `naitre.js` importe `chef-equipe.js`, qui
 * importe `garde-des-naissances.js` → `recensement.js` → ce module — lequel lisait alors
 * `ROLE_CHEF_EQUIPE` AVANT que `chef-equipe.js` n'ait atteint la ligne qui le pose.
 *
 *     $ node naissance-representant/bin/naitre.js --help
 *     ReferenceError: Cannot access 'ROLE_CHEF_EQUIPE' before initialization
 *
 * **Plus aucun agent ne pouvait naître**, et les 1 067 essais du dépôt restaient VERTS : aucun
 * n'entre par là. Le banc du cycle éprouvait trois portes choisies à la main — il en manquait
 * une, et c'était la seule qui soit un binaire de production.
 *
 * ⚠️ CE QUI REND LE CYCLE SÛR N'EST DONC PAS « il n'y a pas de cycle » : c'est que rien n'y soit
 * LU pendant l'évaluation. Les déclarations de fonction sont hoistées ; un `const` importé, non.
 * Le corps d'une fonction, lui, ne s'exécute qu'une fois tous les modules évalués. Le tableau
 * vit donc DANS la fonction, et le banc du cycle dérive désormais ses portes du GRAPHE plutôt
 * que d'une liste, pour qu'un module ajouté au cycle soit éprouvé sans qu'on y pense.
 */
function libellesDeclares() {
  return { [ROLE_CHEF_EQUIPE]: { libelle: 'chef d’équipe', pluriel: 'chefs d’équipe' } };
}

/**
 * COMMENT ON NOMME UN RÔLE DÉCLARÉ — et NOMMER NE DÉCIDE DE RIEN.
 *
 * ⚠️ CE REPLI N'EST PAS DE LA COURTOISIE, c'est la règle que `libellePluriel` écrit déjà pour
 * la même raison : `roleDe()` JETTE sur un rôle inconnu, et il a raison — décider sur un rôle
 * qu'on ne connaît pas reste interdit. Mais un registre qui mourrait entier parce qu'UNE
 * déclaration porte un rôle futur serait le contraire de sa conduite : il MESURE et REND.
 *
 * @returns `{ libelle, pluriel }` — le nom brut des deux côtés quand personne ne le connaît.
 */
export function libellesDuRoleDeclare(nom) {
  const brut = nom ? String(nom) : null;
  if (!brut) return { libelle: null, pluriel: null };
  const connus = libellesDeclares();
  if (connus[brut]) return connus[brut];
  try {
    const r = roleDe(brut);
    return { libelle: r.libelle, pluriel: r.libelle_pluriel };
  } catch {
    return { libelle: brut, pluriel: brut };
  }
}

/**
 * LA DÉCLARATION QUI COUVRE CETTE PLACE — par son pane DANS sa session, ou par son nom.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * DEUX CLÉS, ET LES DEUX SONT BORNÉES PAR L'ESPACE DE TRAVAIL.
 *
 *   ① **pane-dans-sa-session, dans l'espace déclaré.** Un identifiant de pane n'est unique QUE
 *      dans sa session — ce poste en porte quinze, et deux d'entre elles emploient le même
 *      `w5:p3`. Les deux côtés doivent donc être NOMMÉS : `identiteDeSession` rend `null` sur un
 *      socket hors forme, et laisser deux `null` se comparer égaux apparierait sur le seul pane,
 *      c'est-à-dire le défaut que cette clé existe pour fermer.
 *
 *   ② **le nom, dans l'espace déclaré.** Il existe parce que le PANE bouge : sans lui, un agent
 *      qu'on déplace perd son rôle. La borne d'espace, elle, existe parce que le nom SE PORTE —
 *      il ne s'obtient pas : un `herdr agent rename` vers un nom déjà déclaré suffirait, sans
 *      elle, à faire porter à n'importe qui le rôle ET LE COORDONNATEUR d'un autre.
 *
 * ⚠️ LA PLUS RÉCENTE L'EMPORTE, et ce n'est pas un hasard d'ordre. Reprendre une place est le
 * geste que le pack PRESCRIT (`claude-swt <horodatage>`) : le successeur et son prédécesseur
 * partagent alors pane, session et espace. `lireLesDeclarations` trie du plus récent au plus
 * ancien ; on prend donc la PREMIÈRE trouvée, et un banc relie ce choix à ce tri.
 *
 * ⚠️ ET ON NE VÉRIFIE PAS ICI QUE LA DÉCLARATION COUVRE CET OCCUPANT-CI PLUTÔT QUE LE PRÉCÉDENT.
 * Cette question-là est temporelle, elle demande la date de naissance de l'agent — que seule la
 * garde sait mesurer, en ouvrant les transcrits du poste (`couvertureDeLaDeclaration`). Le
 * recensement ne date pas les agents ; il rend donc un rôle DÉCLARÉ, avec la date d'inscription
 * sur la ligne, et n'affirme jamais l'avoir prouvé. C'est exactement ce que RA-VUE-005 permet à
 * une source déclarée, et rien de plus.
 *
 * @param agent  `{ pane, session, espace, nom }` — `nom` dans la forme à trois états de
 *               `nomDeLAgent` : « lu » · « aucun » · « refusée ». On ne lit que « lu ».
 * @param declarations  ce que `lireLesDeclarations` rend dans `declarations` — jamais l'objet
 *               entier : les `illisibles` ne sont pas des faits, et les mêler à une liste que
 *               l'on parcourt est un motif que ce dépôt a déjà payé.
 * @returns la déclaration, ou `null`.
 */
export function declarationDeLAgent({ pane, session, espace, nom } = {}, declarations = []) {
  const liste = Array.isArray(declarations) ? declarations : [];
  const nomme = nom?.mesure === 'lu' && nom.valeur ? nom.valeur : null;
  const laSession = identiteDeSession(session);

  const parLaPlace =
    laSession === null
      ? null
      : liste.find(
          (d) =>
            d?.pane &&
            d.pane === pane &&
            identiteDeSession(d.session_herdr) === laSession &&
            memeEspaceDeTravail(espace, d.espace)
        );
  if (parLaPlace) return parLaPlace;

  return (nomme ? liste.find((d) => d?.nom === nomme && memeEspaceDeTravail(espace, d.espace)) : null) || null;
}

/**
 * CE QUE LE RECENSEMENT REND D'UN RÔLE DÉCLARÉ — le quatrième état, et il ne se replie pas.
 *
 * ⚠️ `nom` PEUT MANQUER SUR UNE DÉCLARATION DÉJÀ INSCRITE. Le champ est obligatoire à
 * l'écriture, mais un fait écrit par une version antérieure du geste peut ne pas le porter, et
 * le combler ferait affirmer un rôle que personne n'a déclaré. On rend alors `null`, et
 * l'appelant retombe sur « non établi » : l'absence se montre (RA-VUE-003).
 *
 * @returns le bloc `role`, ou `null` quand la déclaration ne porte pas de rôle.
 */
export function roleDeclareDe(declaration) {
  const nom = declaration?.role ? String(declaration.role).trim() : '';
  if (!nom) return null;
  const { libelle } = libellesDuRoleDeclare(nom);
  return {
    mesure: SOURCE_DECLAREE,
    nom,
    libelle,
    // ⚠️ LE MANDAT ET LE COORDONNATEUR VIVENT ICI, PAS AU CHAMP `mandat` DE L'ENTRÉE. Celui-ci
    // est documenté « ce que le LIEU nomme » : y verser un fait déclaré le rendrait
    // indiscernable d'un fait prouvé, ce que RA-VUE-006 interdit.
    mandat: declaration.mandat ?? null,
    coordonnateur: declaration.coordonnateur ?? null,
    espace: declaration.espace ?? null,
    declaree_le: declaration.ne_le ?? null,
    pose_par: declaration.pose_par ?? null,
    source: SOURCE_DECLAREE,
    // La conséquence voyage avec le fait : qui lit cette ligne doit savoir ce qu'elle ne prouve
    // pas, sans avoir à ouvrir ce fichier.
    pourquoi:
      'son rôle vient de sa déclaration de naissance, pas d’un lieu mesuré — c’est un lien ' +
      'DÉCLARÉ (RA-VUE-005), horodaté et signé par le geste qui l’a fait naître, jamais un lien prouvé',
  };
}

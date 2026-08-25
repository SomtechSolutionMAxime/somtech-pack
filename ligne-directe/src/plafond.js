// LE PLAFOND D'APPELS SIMULTANÉS — combien la vue a le droit de demander au ServiceDesk À LA
// FOIS, et pourquoi ce chiffre-là. (E-20260824-0011, T-20260825-0001.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE MODULE EXISTE — LE COÛT DE LA VUE N'EST PAS LA LENTEUR DES APPELS
//
// Mesuré appel par appel le 2026-08-24, puis remesuré le 2026-08-25 : la vue coûtait ~90 s, et
// **86 % de ce temps était la jointure ServiceDesk faite en appels SÉQUENTIELS** — une liste
// par mandat, un `epics/list` par mandat, **un `tickets/list` par epic**. Sur le parc du
// 2026-08-25, cela fait **120 appels à la queue leu leu** : 1 pour la liste des applications,
// puis pour chacune des **14 lignes d'orchestrateur portant un code** une liste de famille et un
// `epics/list` (28), puis un `tickets/list` pour chacune des **91 lignes d'epic** rendues.
//
// ⚠️ LES UNITÉS SONT DITES PARCE QU'ELLES NE COÏNCIDENT PAS, et un chiffre juste mal étiqueté se
// fait CONFIRMER là où un chiffre faux se fait attraper. Ces 14 lignes portent **13 codes de
// chantier distincts** (un chantier est tenu par deux orchestrateurs) et ces 91 lignes d'epic
// portent **86 epics distincts**. C'est bien le nombre de LIGNES qui décide du nombre d'appels,
// pas le nombre d'objets distincts — sauf pour le chantier à deux porteurs, que ce lot fait
// justement lire une seule fois.
//
// 🔴 AUCUN DE CES APPELS N'EST LENT. Médiane 624-778 ms, max 976 ms, zéro délai dépassé. C'est
// le NOMBRE qui coûte, et il croît LINÉAIREMENT avec le parc : un parc qui double, deux minutes.
// Aucune borne d'attente ne rattrape ça — seul le parallélisme le rattrape.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 POURQUOI UN PLAFOND, ET PAS « TOUT D'UN COUP »
//
// **Le ServiceDesk est un service PARTAGÉ.** Tout ce que la vue prend, elle le prend à quelqu'un
// d'autre — les autres agents du poste, les autres postes, l'application elle-même. Lâcher 118
// appels simultanés parce que c'est plus rapide pour NOUS est le geste qu'on ne fait pas.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LE CHIFFRE EST MESURÉ CONTRE LE VRAI SERVICE, PAS DÉDUIT — 2026-08-25
//
// Sonde : des rafales de N `tickets/list` simultanés (lecture seule, epics réels du parc),
// N croissant, deux secondes de repos entre deux rafales. Ce qui a été relevé :
//
//     N     latence médiane     débit servi     échecs
//     1        480 ms             2,1 /s          0
//     4        391 ms             9,6 /s          0
//     8        492 ms             6,7 /s          0
//    16        432 ms            25,3 /s          0
//    32        514 ms            40,1 /s          0
//    48        642 ms            57,2 /s          0
//    64        770 ms            71,3 /s          0
//    96      1 024 ms            70,7 /s          0
//   128      1 438 ms            71,9 /s          0
//
// **Le service ne refuse à aucun N — il SATURE.** Le débit plafonne à ~71 appels/s dès N=64 ;
// au-delà, la latence enfle exactement dans la proportion où N grandit (770 → 1 024 → 1 438 ms)
// sans qu'un seul appel de plus ne soit servi. C'est de la file d'attente pure, payée par tout
// le monde. En dessous de 32, la latence reste à son PLANCHER : 492 ms à N=8 contre 480 ms à
// N=1 — la file ne coûte rien.
//
// ⚠️ CE QUE LA SONDE NE DIT PAS, ET IL FAUT LE DIRE : elle a mesuré des RAFALES COURTES depuis
// UN poste, un jour, sur UN geste (`tickets/list`). Elle ne dit rien d'une charge soutenue, ni
// de ce que le service portait déjà par ailleurs. Elle borne le choix, elle ne le prouve pas
// pour tous les régimes.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 D'OÙ 32 — ET LE CHIFFRE A ÉTÉ RÉVISÉ APRÈS COUP, CE QUI SE DIT PLUTÔT QUE SE MAQUILLE
//
// **Le premier chiffre posé était 8**, sur ce raisonnement : dans la bande de latence-plancher,
// un huitième de la capacité mesurée laissé aux autres, « et ça suffira ». Les deux premières
// raisons étaient mesurées. **La troisième était une supposition, et elle était fausse.**
//
// Mesuré en tapant la commande sur le poste réel, le 2026-08-25. **Le parc, recompté contre son
// unité** : 18 lignes d'orchestrateur, dont 14 portent un code de chantier pour 13 codes
// distincts · 91 lignes d'epic pour 86 epics distincts · 265 lignes de story.
//
//     plafond    la commande rend en        critère du lot (< 15 s)
//        8       16,0 · 16,2 · 16,4 · 17,6        NON TENU
//       16       12,8 → 15,4 (8 essais)           deux essais sur huit AU-DESSUS
//       32       11,8 → 13,7 (8 essais)           tenu ce jour-là
//
// **C'est le résultat qui a forcé la révision, pas la sonde** — et l'écrire compte plus que de
// reconstruire après coup une justification qui aurait précédé. Une borne se pose avant le
// résultat ; celle-ci a été reposée après, et voici le compte-rendu.
//
// 🔴 ET CES TROIS SÉRIES ONT ÉTÉ PRISES SUR UN POSTE QUE JE SALISSAIS MOI-MÊME. Chaque socle de
// mesure isolé faisait naître un veilleur qui ne se couchait jamais : **six tournaient en même
// temps** que je chronométrais. Une passe de revue les a trouvés. Refaite sur un poste sain, et
// surtout en ENTRELAÇANT l'avant et l'après tour par tour — pour que les deux chiffres portent
// le même parc au même instant, ce que les séries ci-dessus ne garantissaient pas :
//
//     tour        1        2        3        4        5
//     avant   89,38 s  65,91 s  68,08 s  75,86 s  65,77 s
//     après   15,55 s  14,30 s  14,87 s  14,97 s  13,08 s
//
// **Le gain est de 4,5× à 5,8×.** Mais le pire cas est à 15,55 s : le critère « moins de 15 s »
// n'est PAS tenu de façon fiable, et il faut le dire plutôt que de citer la meilleure série.
//
// ⚠️ CE QUI RESTE N'EST PLUS À NOUS. Le recensement du poste — qui n'est pas ce lot — prend
// **8,2 à 12,2 s** de ces ~14 s : les trois quarts. Aucun plafond ne fera descendre la vue sous
// ce plancher-là, et monter à 64 prendrait la moitié de la capacité mesurée du service partagé
// pour gagner une seconde sur un geste qui en coûtera dix quoi qu'il arrive.
//
// Ce que la sonde, elle, dit de 32 — et c'est ce qui rend le chiffre ADMISSIBLE, pas le fait
// qu'il tienne le critère :
//   1. **32 est encore dans la bande de latence-plancher** : 514 ms de médiane contre 480 ms
//      à un seul appel. La file d'attente ne coûte rien, ni à nous ni aux autres.
//   2. **La saturation est à 64**, pas à 32 : le débit servi monte encore (40/s à N=32, 71/s à
//      N=64), donc à 32 le service n'est pas au bout de ce qu'il sait faire.
//   3. **La rafale dure moins de quatre secondes** — la jointure ServiceDesk vaut désormais
//      ~2,5 à 3,9 s sur les ~12 s de la commande.
//   4. Zéro échec à TOUS les N mesurés, 1 à 128.
//
// ⚠️ CE QUI DOMINE MAINTENANT N'EST PLUS LE SERVICEDESK — chiffres détaillés plus bas, avec la
// campagne entrelacée qui les a établis.
//
// 🔴 CE PLAFOND SE PÉRIMERA, COMME LA BORNE QU'IL REMPLACE. Le jour où le service change de
// forme, la sonde est à refaire — elle vit dans le lot, pas dans une intuition.

/**
 * LE PLAFOND — écrit UNE fois, ici, et nulle part ailleurs.
 *
 * ⚠️ UN SEUL RÉGLAGE, ET C'EST VOULU. Un second plafond posé un étage plus haut (« au plus N
 * chantiers de front ») aurait l'air prudent et serait le défaut : deux réglages qu'on ne voit
 * jamais ensemble se contredisent en silence, et la mesure faite pour l'un s'appliquerait à
 * l'autre. Le plafond porte sur ce que la sonde a mesuré — **des appels HTTP en vol** — et le
 * reste du code a le droit de demander autant qu'il veut : c'est ici que ça se borne.
 */
export const PLAFOND_SERVICEDESK = 32;

/**
 * PLAFONNER UN TRANSPORT — il sert au plus `plafond` appels à la fois, les autres attendent.
 *
 * ⚠️ ELLE NE S'APPELLE PAS `borner`, ET CE N'EST PAS UN DÉTAIL DE GOÛT. Le module voisin
 * `tui-vue-du-parc.js` EXPORTE DÉJÀ un `borner(texte, largeur)` qui tronque une chaîne — une
 * sémantique sans aucun rapport. Aucun fichier n'importe les deux aujourd'hui ; le jour où l'un
 * le ferait, il prendrait l'un pour l'autre sans qu'aucun essai ne rougisse, parce que les deux
 * acceptent deux arguments et rendent quelque chose. On ne laisse pas ce nom en double.
 *
 * ⚠️ LA BORNE EST SUR L'APPEL, PAS SUR LE TRAVAIL QUI L'ENTOURE. Un appelant ne détient jamais
 * de place pendant qu'il attend AUTRE CHOSE — il en prend une au moment de l'appel, la rend au
 * retour. C'est ce qui rend l'interblocage impossible : aucune place n'est jamais tenue par
 * quelqu'un qui attend une place.
 *
 * 🔴 ET CETTE PROMESSE A UNE LIMITE, RELEVÉE EN REVUE ET ÉPROUVÉE PAR ELLE : **deux plafonds
 * imbriqués s'interbloquent.** Si un transport plafonné rappelait, DEPUIS SON PROPRE APPEL, le
 * même plafond, il tiendrait une place en attendant une place — et à `plafond: 1` il attendrait
 * pour toujours (mesuré par la passe de fond, sur un cas construit).
 *
 * ⚠️ AUCUN APPEL RÉEL NE FAIT ÇA AUJOURD'HUI — vérifié : `demander` n'est jamais rappelé depuis
 * l'intérieur d'un `appeler`, et `lecteurDeChantier` est le seul lieu qui plafonne. C'est donc
 * une propriété LATENTE, pas un défaut. On l'écrit ici plutôt que de la laisser se découvrir :
 * **ne plafonne pas un transport déjà plafonné.**
 *
 * ⚠️ ET LA PLACE SE REND MÊME QUAND L'APPEL JETTE. Un transport qui refuse — HTTP 500, délai
 * dépassé, service muet — doit libérer sa place comme un autre. Sans ça, un parc qui refuse
 * huit fois fige la vue pour toujours, et le symptôme serait « la vue ne rend plus », jamais
 * « le ServiceDesk refuse ». Un banc mute cette libération.
 *
 * @param appeler  `(nom, args) → corps` — le transport à plafonner. `null` traverse tel quel :
 *                 « aucun transport » n'est pas « un transport qui refuse », et cette
 *                 distinction porte tout le rendu « aucun accès au ServiceDesk » de la vue.
 * @param plafond  le nombre d'appels simultanés. Par défaut celui que la sonde a mesuré.
 */
export function plafonner(appeler, { plafond = PLAFOND_SERVICEDESK } = {}) {
  if (typeof appeler !== 'function') return appeler;
  // ⚠️ UN PLAFOND ILLISIBLE VAUT UN, PAS L'INFINI. Se replier sur « pas de borne » quand le
  // réglage est absurde, c'est faire du cas dégradé le cas le plus agressif pour le service
  // partagé — l'inverse de ce que la borne existe pour empêcher.
  const places = Number.isFinite(plafond) && plafond >= 1 ? Math.floor(plafond) : 1;
  let enVol = 0;
  const file = [];

  const servirLeSuivant = () => {
    while (enVol < places && file.length) {
      const partir = file.shift();
      enVol += 1;
      partir();
    }
  };

  return (...args) =>
    new Promise((resolve, reject) => {
      file.push(() => {
        let promesse;
        // ⚠️ UN TRANSPORT QUI JETTE **AVANT** DE RENDRE SA PROMESSE (une erreur synchrone) doit
        // rendre sa place comme les autres. Sans ce `try`, il la garderait pour toujours.
        try {
          promesse = Promise.resolve(appeler(...args));
        } catch (err) {
          promesse = Promise.reject(err);
        }
        promesse.then(resolve, reject).finally(() => {
          enVol -= 1;
          servirLeSuivant();
        });
      });
      servirLeSuivant();
    });
}

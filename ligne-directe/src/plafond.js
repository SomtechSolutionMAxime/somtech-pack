// LE PLAFOND D'APPELS SIMULTANÉS — combien la vue a le droit de demander au ServiceDesk À LA
// FOIS, et pourquoi ce chiffre-là. (E-20260824-0011, T-20260825-0001.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE MODULE EXISTE — LE COÛT DE LA VUE N'EST PAS LA LENTEUR DES APPELS
//
// Mesuré appel par appel le 2026-08-24, puis remesuré le 2026-08-25 : la vue coûtait ~90 s, et
// **86 % de ce temps était la jointure ServiceDesk faite en appels SÉQUENTIELS** — une liste
// par mandat, un `epics/list` par mandat, **un `tickets/list` par epic**. Sur le parc du
// 2026-08-25 (13 mandats codés, 91 epics), cela fait **118 appels à la queue leu leu**.
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
// **D'où 8**, et les trois raisons se tiennent ensemble :
//   1. **8 est dans la bande où la latence est au plancher** — 492 ms contre 480 ms seul. La
//      vue ne paie aucune file d'attente, et n'en fait payer aucune.
//   2. **8 laisse au service les sept huitièmes de la capacité qu'on lui a MESURÉE** (~64
//      simultanés avant saturation). Un poste qui affiche sa vue ne prend pas le service.
//   3. **8 suffit** : 118 appels à 8 de front, ~0,5 s chacun, c'est une poignée de secondes —
//      mesuré ensuite en tapant la commande, pas calculé ici.
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
export const PLAFOND_SERVICEDESK = 8;

/**
 * BORNER UN TRANSPORT — il sert au plus `plafond` appels à la fois, les autres attendent.
 *
 * ⚠️ LA BORNE EST SUR L'APPEL, PAS SUR LE TRAVAIL QUI L'ENTOURE. Un appelant ne détient jamais
 * de place pendant qu'il attend AUTRE CHOSE — il en prend une au moment de l'appel, la rend au
 * retour. C'est ce qui rend l'interblocage impossible : aucune place n'est jamais tenue par
 * quelqu'un qui attend une place.
 *
 * ⚠️ ET LA PLACE SE REND MÊME QUAND L'APPEL JETTE. Un transport qui refuse — HTTP 500, délai
 * dépassé, service muet — doit libérer sa place comme un autre. Sans ça, un parc qui refuse
 * huit fois fige la vue pour toujours, et le symptôme serait « la vue ne rend plus », jamais
 * « le ServiceDesk refuse ». Un banc mute cette libération.
 *
 * @param appeler  `(nom, args) → corps` — le transport à borner. `null` traverse tel quel :
 *                 « aucun transport » n'est pas « un transport qui refuse », et cette
 *                 distinction porte tout le rendu « aucun accès au ServiceDesk » de la vue.
 * @param plafond  le nombre d'appels simultanés. Par défaut celui que la sonde a mesuré.
 */
export function borner(appeler, { plafond = PLAFOND_SERVICEDESK } = {}) {
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

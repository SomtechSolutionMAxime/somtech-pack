// boucle.js — la boucle d'évolution du métier (P-20260820-0001 phase 4).
//
//   ronde → ticket → revue par un tiers → ABC amendé → rendu → convergence → renaissance
//
// Ce module tient la seule étape mécanisable de cette boucle : dire si une
// proposition est RECEVABLE. Il ne décide jamais de l'adopter — la machine peut
// proposer et refuser, jamais adopter seule.
//
// ⚠️ Le risque contre lequel il existe : la boucle industrialise la production
// de propositions alors qu'aucune garde de taille n'existait avant elle. Sans
// ces refus, elle regonfle le socle plus vite qu'il n'a grossi.
import { rendre, compterTokens, BUDGETS } from './rendu.js';

/** Les trois issues d'une revue. Deux d'entre elles ALLÈGENT — c'est délibéré. */
export const ISSUES = ['adopter', 'fusionner', 'retirer'];

/**
 * Dit si une proposition d'amélioration est recevable.
 *
 * @param {object} classement   le classement en vigueur
 * @param {object} proposition  { ajout?, retraits?[], issue?, propose_par?, accepte_par? }
 * @returns {{recevable:boolean, motifs:string[], cout_socle:number, mesures:object}}
 */
export function evaluerProposition(classement, proposition = {}) {
  const motifs = [];
  const { ajout, retraits = [], issue = 'adopter', propose_par, accepte_par } = proposition;

  if (!ISSUES.includes(issue)) {
    motifs.push(`issue « ${issue} » inconnue — une revue rend ${ISSUES.join(', ')}, et rien d'autre. ` +
      `Reporter n'est pas une issue : c'est ce qui a laissé quatorze demandes dormir trois semaines.`);
  }

  // La garde de contradiction : celui qui propose n'est jamais celui qui accepte.
  if (propose_par && accepte_par && propose_par === accepte_par) {
    motifs.push(`garde de contradiction : « ${propose_par} » ne peut pas accepter sa propre proposition — ` +
      `celui qui propose n'est jamais le même que celui qui accepte.`);
  }

  const ids = new Set((classement.items || []).map((i) => i.id));
  for (const r of retraits) {
    if (!ids.has(r)) motifs.push(`le retrait vise « ${r} », qui n'existe pas dans le classement — on ne compense pas avec du vide`);
  }

  // On simule : le classement tel qu'il serait APRÈS.
  const apres = {
    ...classement,
    items: [...(classement.items || []).filter((i) => !retraits.includes(i.id)), ...(ajout ? [ajout] : [])],
  };
  const avant = rendre(classement);
  const rendu = rendre(apres);

  // Ce que l'ajout coûte au socle, en tokens — un chiffre, pas une impression.
  const cout_socle = rendu.mesures.L1 - avant.mesures.L1;

  // Les refus du rendu qui ne préexistaient pas sont imputables à la proposition.
  const dejaLa = new Set(avant.erreurs);
  for (const e of rendu.erreurs) {
    if (dejaLa.has(e)) continue;
    if (e.includes('I2 —')) {
      motifs.push(
        `${e} La proposition n'est recevable qu'accompagnée d'un RETRAIT qui la compense : ` +
        `c'est une condition de recevabilité, pas un arbitrage.`,
      );
    } else {
      motifs.push(e);
    }
  }

  return {
    recevable: motifs.length === 0,
    motifs,
    cout_socle,
    mesures: { avant: avant.mesures, apres: rendu.mesures },
  };
}

/** Coût en tokens d'un énoncé de socle — exposé pour chiffrer une proposition sans la simuler. */
export const coutDe = (enonce) => compterTokens(enonce);
export { BUDGETS };

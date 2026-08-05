// nommage.js — comment un chantier devient un nom de canal Slack.
//
// Partie purement calculatoire, isolée pour être testable sans réseau ni trousseau.
//
// Slack n'accepte qu'un jeu de caractères restreint : minuscules, chiffres, tiret,
// souligné, 80 caractères au plus. Un code de chantier Somtech s'écrit en majuscules
// (`D-20260805-0004`), le canal portera donc sa forme minuscule — et TOUTE comparaison
// de noms est insensible à la casse, exactement comme pour les noms d'agents herdr.

const LONGUEUR_MAX = 80;

/**
 * Normalise un libellé en nom de canal Slack acceptable.
 * Les accents sont dépliés plutôt que supprimés : « clôture » donne « cloture », pas « clture ».
 */
export function normaliserNom(libelle) {
  const sansAccent = String(libelle)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const nettoye = sansAccent
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return nettoye.slice(0, LONGUEUR_MAX) || 'ligne';
}

/**
 * Nom de canal d'un chantier, évitant les noms déjà pris.
 *
 * Le cas qui compte n'est pas le chantier exotique : c'est DEUX COPIES DE TRAVAIL DU MÊME
 * DÉPÔT. `claude-swt` en crée une par session, c'est le mode nominal du parallélisme — et
 * deux agents peuvent donc porter le même code de chantier en même temps. Sans suffixe,
 * ils partageraient un canal et le dirigeant parlerait au mauvais.
 *
 * @param {string} chantier code du chantier (D-…, P-…, J-…, ou libellé libre)
 * @param {(nom: string) => boolean} estPris prédicat « ce nom est déjà utilisé »
 */
export function nomDeCanal(chantier, estPris = () => false) {
  const base = normaliserNom(chantier);
  if (!estPris(base)) return base;
  for (let n = 2; n <= 99; n += 1) {
    const suffixe = `-${n}`;
    const candidat = `${base.slice(0, LONGUEUR_MAX - suffixe.length)}${suffixe}`;
    if (!estPris(candidat)) return candidat;
  }
  throw new Error(`Impossible de nommer un canal pour « ${chantier} » : 99 variantes déjà prises.`);
}

/**
 * Emoji d'identité d'un chantier — stable, dérivé du nom, pour qu'un même chantier garde
 * le même visage d'une session à l'autre sans qu'on ait à le stocker.
 */
const VISAGES = ['🛠️', '🧭', '🚧', '🔧', '⚙️', '🧰', '📐', '🪛', '🔭', '🧪', '🗜️', '⛏️'];

export function visageDe(chantier) {
  const nom = normaliserNom(chantier);
  let somme = 0;
  for (let i = 0; i < nom.length; i += 1) somme = (somme * 31 + nom.charCodeAt(i)) % 100000;
  return VISAGES[somme % VISAGES.length];
}

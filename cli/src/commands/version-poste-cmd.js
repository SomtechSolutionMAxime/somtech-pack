// `pack version` — rend la version installée SUR CE POSTE, et l'écart avec le
// registre. T-20260816-0020.
//
// Les deux moitiés que le ticket exige, et qui ne se séparent pas : un numéro
// sans son écart ne répond pas à la question qu'on pose vraiment — *suis-je à
// jour ?* — et un écart calculé sur une valeur qu'on n'a pas pu lire est pire
// que pas d'écart du tout.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  lireVersionPoste, lireCachePublie, ecartVersions, verrousPerimes, direAge,
} from '../version-poste.js';

const PKG = '@somtech-solutions/pack';
const REGISTRY = 'https://npm.pkg.github.com';

/**
 * Interroge le registre. Rend la version publiée, ou null si on n'a pas pu regarder.
 *
 * ⚠️ `SOMTECH_PACK_REGISTRE` n'est PAS un repli : c'est un point d'injection pour
 * les bancs, qui ne doit jamais soustraire le chemin réel à l'épreuve. Le chemin
 * par défaut — `npm view` — reste celui de tous les appels, et il est éprouvé à
 * part avec un `exec` injecté. Un banc qui n'éprouverait QUE la couture laisserait
 * le vrai appel sans garde ; c'est ce qui a coûté un tour entier sur T-20260815-0013.
 */
export function interrogerRegistre({ exec = execFileSync } = {}) {
  const stub = process.env.SOMTECH_PACK_REGISTRE;
  if (stub !== undefined) return /^\d+\.\d+\.\d+/.test(stub) ? stub : null;
  try {
    const out = exec('npm', ['view', PKG, 'version', `--registry=${REGISTRY}`], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000,
    });
    const v = String(out).trim();
    return /^\d+\.\d+\.\d+/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Calcule l'état complet, sans rien afficher (pur, donc éprouvable).
 * `registre` est injecté pour que le banc n'ait jamais besoin du réseau.
 */
export function etatDuPoste({ toolsDir, maintenant, registre, ttlVerrou = 600 }) {
  const poste = lireVersionPoste(toolsDir);
  const cache = lireCachePublie(join(toolsDir, 'pack-latest.json'), maintenant);

  // Le registre fait foi ; le cache ne sert qu'à défaut, et JAMAIS sans son âge.
  const publiee = registre ?? cache.version ?? null;
  const sourcePubliee = registre ? 'REGISTRE' : (cache.version ? 'CACHE' : 'INCONNUE');

  const ecart = poste.etat === 'INSTALLEE' && publiee
    ? ecartVersions(poste.version, publiee)
    : 'INDETERMINE';

  return {
    poste,
    publiee,
    sourcePubliee,
    agePubliee: sourcePubliee === 'CACHE' ? cache.ageSecondes : 0,
    ecart,
    verrous: verrousPerimes(toolsDir, ttlVerrou, maintenant),
  };
}

/** Met l'état en mots. Rendu séparé du calcul : on éprouve les deux. */
export function rendreEtat(e) {
  const l = [];
  if (e.poste.etat === 'INSTALLEE') {
    l.push(`Version installée sur ce poste : ${e.poste.version}`);
  } else if (e.poste.etat === 'ABSENTE') {
    l.push('Version installée sur ce poste : AUCUNE INSTALLATION POSTE');
    l.push(`  ${e.poste.raison} (${e.poste.chemin})`);
    l.push('  Installe-la : npx @somtech-solutions/pack setup --yes');
  } else {
    l.push('Version installée sur ce poste : ILLISIBLE');
    l.push(`  ${e.poste.raison} (${e.poste.chemin})`);
  }

  if (e.sourcePubliee === 'REGISTRE') {
    l.push(`Dernière publiée (registre)     : ${e.publiee}`);
  } else if (e.sourcePubliee === 'CACHE') {
    // ⚠️ Un cache a le droit d'être en retard. Il n'a pas le droit de se taire
    // sur son âge : c'est ainsi qu'une valeur d'hier se cite comme celle du jour.
    l.push(`Dernière publiée (CACHE, ${direAge(e.agePubliee)})  : ${e.publiee}`);
    l.push('  ⚠️  registre injoignable — cette valeur peut être en retard.');
  } else {
    l.push('Dernière publiée                : INCONNUE (registre injoignable, aucun cache)');
  }

  const dit = {
    'A-JOUR': 'À JOUR',
    'EN-RETARD': 'EN RETARD',
    'EN-AVANCE': 'EN AVANCE sur le registre',
    INDETERMINE: 'INDÉTERMINÉ — on n’a pas pu comparer, ce n’est PAS « à jour »',
  }[e.ecart];
  l.push(`Écart                           : ${dit}`);
  if (e.ecart === 'EN-RETARD') {
    l.push('  Mets le poste à jour : npx @somtech-solutions/pack@latest setup --yes');
  }

  if (e.verrous.length) {
    l.push(`⚠️  ${e.verrous.length} verrou(x) de mise à jour périmé(s) :`);
    for (const v of e.verrous) l.push(`     ${v.nom} — ${direAge(v.ageSecondes)}`);
    l.push('   Ils empêcheront une mise à jour de partir sans dire pourquoi.');
    l.push('   Ramasse-les : npx @somtech-solutions/pack setup --yes');
  }
  return l;
}

/**
 * Code de retour : 0 seulement si la question a une réponse et qu'elle est
 * bonne. Un poste non installé ou un écart indéterminé ne rendent JAMAIS 0 —
 * un rc=0 se lit « tout va bien » par quiconque scripte cette commande.
 */
export function codeRetour(e) {
  if (e.poste.etat !== 'INSTALLEE') return 2;
  if (e.ecart === 'INDETERMINE') return 3;
  if (e.ecart === 'EN-RETARD') return 1;
  return 0;
}

export function cmdVersionPoste(flags = {}, deps = {}) {
  const toolsDir = flags.dest || join(homedir(), '.somtech');
  const maintenant = deps.maintenant ?? Date.now();
  const registre = deps.registre !== undefined ? deps.registre : interrogerRegistre(deps);
  const e = etatDuPoste({ toolsDir, maintenant, registre });
  for (const ligne of rendreEtat(e)) console.log(ligne);
  return codeRetour(e);
}

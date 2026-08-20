// ou-naitre.js — OÙ UN AGENT PEUT-IL NAÎTRE, dépôt par dépôt, avant qu'on tente la pose.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CETTE COMMANDE FERME (T-20260818-0043, critère 3)
//
// La réponse existait déjà et elle était juste : `etatSource` refuse une pose incomplète EN
// NOMMANT les fichiers manquants, et c'est le comportement voulu. Ce qui manquait n'est pas la
// mesure — c'est qu'on ne pouvait la POSER qu'en écrivant du JavaScript. Conséquence mesurée le
// 2026-08-20 : sur les 15 dépôts du poste portant un pack installé, ONZE refusent une pose
// d'orchestrateur, quatre l'acceptent, et **personne ne le savait**. On ne l'apprenait qu'en
// tentant une pose qui échoue.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ CE FICHIER NE MESURE RIEN LUI-MÊME, ET C'EST LA RÈGLE QUI LE GOUVERNE
//
//   Il APPELLE `etatSource`. Il ne la reproduit pas, ne la réimplémente pas, n'en garde pas de
//   copie. Écrire ici une détection « équivalente » ferait une DEUXIÈME SONDE sur le même état
//   — deux copies d'un critère divergent en silence, et le seul correctif fiable est de n'en
//   garder qu'UNE. C'est le motif que ce dépôt paie le plus cher ; il n'a pas besoin d'une
//   occurrence de plus dans la commande écrite pour le rendre visible.
//
//   Preuve à l'appui, du jour même : le recensement manuel a été compté avec `ls` → FAUX (il ne
//   descend pas dans les sous-dossiers, et `.claude/settings.json` vit un niveau plus bas), puis
//   avec `git ls-files` → FAUX AUSSI. `etatSource` rendait juste du premier coup.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ LE DISQUE, JAMAIS L'INDEX GIT — et ce n'est pas un détail de mise en œuvre
//
//   Mesuré des deux côtés : `git ls-files` sur les gabarits rend **0 chez les dépôts qui ont
//   REÇU le pack** (y compris les quatre qui fonctionnent) et **4 chez la SOURCE**, où ils sont
//   du code versionné. C'est le comportement attendu : le pack versionne ses gabarits,
//   l'installation les dépose sans les faire suivre par le git du client.
//
//   Un recensement fondé sur l'index git rendrait donc « 15 en panne » au lieu de « 11 » — faux,
//   et faux EN SILENCE, car il ne se trompe que sur les dépôts qui marchent. La pose, elle, lit
//   le disque. Le recensement doit lire ce que la pose lit, sinon il ne recense pas la pose.
//
//   La sonde est injectable (`sonde`) POUR QUE CE POINT SOIT ÉPROUVABLE : la contre-mesure lui
//   passe une sonde fondée sur `git ls-files` et exige que le verdict BASCULE. Si le verdict ne
//   bouge pas, le test ne teste pas ce qu'il prétend.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

import { racineDeLaNaissance } from './agent.js';

export const AIDE_OU_NAITRE = `somtech-pack agent ou-naitre [chemin…] [options]

Dit, pour chaque dépôt, s'il peut recevoir un agent — et sinon, QUELS FICHIERS lui manquent.

  chemin…            Un DÉPÔT (il porte .git ou .somtech-pack) est examiné tel quel.
                     Tout autre chemin est traité comme une RACINE : ses enfants directs
                     portant .somtech-pack/version.json sont examinés.
                     Sans chemin : \$SOMTECH_DEPOTS (séparé par « : »), sinon le dossier courant.

  --role <rôle>      Le rôle visé (défaut : orchestrateur).
  --json             Rend la mesure en JSON plutôt qu'en tableau.
  --help, -h         Affiche cette aide.

La mesure vient de \`etatSource\` — la MÊME fonction que la pose consulte pour refuser.
Elle lit le DISQUE : un dépôt peut parfaitement poser un agent avec des gabarits que son
git ne suit pas, et c'est le cas des dépôts servis.
`;

/** Le marqueur qu'une installation du pack laisse dans un dépôt. */
const MARQUEUR = join('.somtech-pack', 'version.json');

/** La version du pack installée dans ce dépôt, ou `null` si le dépôt n'en porte pas. */
export function versionInstallee(depot) {
  try {
    return JSON.parse(readFileSync(join(depot, MARQUEUR), 'utf8')).version ?? null;
  } catch {
    // Illisible vaut absent : on n'établit RIEN d'un fichier qu'on n'a pas pu lire.
    return null;
  }
}

/**
 * Ce chemin désigne-t-il un dépôt, ou une racine qui en contient ?
 *
 * ⚠️ UN CHEMIN NOMMÉ EXPLICITEMENT N'EST JAMAIS BALAYÉ COMME UNE RACINE s'il est lui-même un
 * dépôt. Sans cette règle, demander l'état d'un dépôt rendrait celui de ses sous-dossiers —
 * une réponse bien formée à une autre question.
 */
export function estUnDepot(chemin) {
  return existsSync(join(chemin, '.git')) || existsSync(join(chemin, '.somtech-pack'));
}

/**
 * Les dépôts qu'une racine porte — ses enfants DIRECTS qui ont reçu le pack.
 *
 * ⚠️ LA POPULATION EST « A REÇU LE PACK », PAS « EST UN DÉPÔT GIT », et c'est un choix.
 * Un dépôt qui n'a jamais reçu le pack n'est pas « en panne » : il n'est pas servi, et le
 * compter parmi les refus noierait les onze vrais écarts sous une trentaine de faux.
 * Un tel dépôt reste examinable — il suffit de le nommer, et la réponse dira ce qui manque.
 */
export function depotsSousRacine(racine, { lire = readdirSync } = {}) {
  let entrees;
  try {
    entrees = lire(racine);
  } catch {
    return [];
  }
  return entrees
    .map((nom) => join(racine, nom))
    .filter((chemin) => {
      try {
        return statSync(chemin).isDirectory() && existsSync(join(chemin, MARQUEUR));
      } catch {
        return false;
      }
    })
    .sort();
}

/** Développe les chemins donnés en la liste des dépôts à examiner, sans doublon. */
export function cibles(chemins) {
  const vus = new Set();
  const sortie = [];
  for (const brut of chemins) {
    const chemin = resolve(brut);
    const trouves = estUnDepot(chemin) ? [chemin] : depotsSousRacine(chemin);
    for (const d of trouves) {
      if (vus.has(d)) continue;
      vus.add(d);
      sortie.push(d);
    }
  }
  return sortie;
}

/** Les chemins à examiner quand l'appelant n'en donne aucun. */
export function cheminsParDefaut(env = process.env, cwd = process.cwd()) {
  const declares = (env.SOMTECH_DEPOTS || '').split(':').map((s) => s.trim()).filter(Boolean);
  return declares.length ? declares : [cwd];
}

/**
 * LA SONDE — `etatSource`, prise là où le paquet en cours d'exécution la porte.
 *
 * Même résolution que la naissance (`racineDeLaNaissance`) : dans une copie de travail la
 * SOURCE fait foi sur son produit de build ; dans un paquet publié le payload reprend son
 * rôle. Une seconde règle de résolution divergerait de la première au premier correctif.
 */
export async function sondeParDefaut() {
  const chemin = join(racineDeLaNaissance(), 'ligne-directe', 'src', 'lieu-agent.js');
  if (!existsSync(chemin)) {
    throw new Error(
      `le module « ligne-directe » n’est pas dans ce paquet (${chemin} est absent) — ` +
        `on ne peut pas dire quels dépôts peuvent recevoir un agent sans la sonde que la pose consulte.\n` +
        `  Le geste qui lève le blocage : republie le pack avec le module, ou lance la commande ` +
        `depuis le dépôt du pack.`
    );
  }
  const { etatSource } = await import(chemin);
  return etatSource;
}

/**
 * Le recensement : un verdict par dépôt, et les fichiers manquants quand c'est non.
 *
 * `sonde` n'a qu'une raison d'être injectable : rendre le point « disque, pas index git »
 * ÉPROUVABLE par mutation. Aucun appelant de production ne la passe.
 */
export async function recenserDepots(depots, { role = 'orchestrateur', sonde = null } = {}) {
  const mesurer = sonde || (await sondeParDefaut());
  return depots.map((depot) => {
    const etat = mesurer(depot, role);
    return {
      depot,
      nom: basename(depot),
      version: versionInstallee(depot),
      peutRecevoir: etat.complete,
      manquants: etat.manquants,
      source: etat.source,
    };
  });
}

/** Le tableau lisible, verdict d'abord, écarts nommés. */
export function rendreTexte(lignes, role) {
  if (!lignes.length) {
    return `Aucun dépôt à examiner.\n  Nomme un dépôt, une racine qui en contient, ou pose \$SOMTECH_DEPOTS.`;
  }
  const oui = lignes.filter((l) => l.peutRecevoir);
  const non = lignes.filter((l) => !l.peutRecevoir);
  const largeur = Math.max(...lignes.map((l) => l.nom.length));
  const out = [];
  out.push(`Peut recevoir un ${role} — ${oui.length} sur ${lignes.length} dépôt(s) examiné(s).`);
  out.push('');
  for (const l of [...oui, ...non]) {
    const marque = l.peutRecevoir ? '✓' : '✗';
    const version = l.version ? l.version : '(pack non installé)';
    const tete = `  ${marque} ${l.nom.padEnd(largeur)}  ${version}`;
    if (l.peutRecevoir) out.push(tete);
    else out.push(`${tete}  → manque : ${l.manquants.join(', ')}`);
  }
  if (non.length) {
    out.push('');
    out.push(
      `⚠️  ${non.length} dépôt(s) refuseraient la pose. Les fichiers manquants sont des GABARITS ` +
        `que le pack dépose : une mise à jour du pack dans ces dépôts les y pose.`
    );
  }
  return out.join('\n');
}

/** `somtech-pack agent ou-naitre …` */
export async function cmdOuNaitre(argv) {
  let role = 'orchestrateur';
  let json = false;
  const chemins = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { console.log(AIDE_OU_NAITRE); return 0; }
    else if (a === '--json') json = true;
    else if (a === '--role') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('-')) { console.error("✗ L'option --role attend une valeur"); return 1; }
      role = v;
    } else if (a.startsWith('-')) { console.error(`✗ Option inconnue : ${a}\n`); console.log(AIDE_OU_NAITRE); return 1; }
    else chemins.push(a);
  }

  const depots = cibles(chemins.length ? chemins : cheminsParDefaut());
  const lignes = await recenserDepots(depots, { role });

  if (json) console.log(JSON.stringify({ role, depots: lignes }, null, 2));
  else console.log(rendreTexte(lignes, role));

  // ⚠️ LE CODE DE SORTIE RESTE 0 MÊME QUAND DES DÉPÔTS REFUSENT. La commande RÉPOND à une
  // question ; elle ne constate pas un échec. Un code non nul la rendrait inutilisable dans un
  // enchaînement — et ferait passer « onze dépôts non servis », qui est le fait connu et
  // arbitré, pour une panne de la commande.
  return 0;
}

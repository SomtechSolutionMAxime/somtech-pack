// versement.js — VERSER LE LIEU AU DÉPÔT, sans qu'un humain ait à le faire (T-20260816-0038).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE, ET POURQUOI IL NE SUPPRIME PAS LA GARDE QU'IL SATISFAIT
//
// `avisDeVersionnement` (naissance.js) REFUSE de faire naître quand aucun commit ne porte le
// lieu. Ce refus n'est pas une formalité : il vient d'une mesure — sur cinq lieux clients
// posés, TROIS portaient une garde d'ouverture qu'aucun commit ne contenait (T-20260814-0139).
// Une garde non versée disparaît à la prochaine mise à jour du pack, et l'agent se met alors à
// parler sans sa ligne.
//
// La revue de phase 1 a établi le fait que tout le monde croyait autrement : ce gate n'est PAS
// une revue de code. Il n'interroge ni `gh`, ni le statut d'une PR, ni un relecteur — seulement
// `HEAD`. Un `git commit` local sur une branche jamais poussée le satisfait.
//
// ⚠️ D'OÙ LA CONCLUSION QUI COMMANDE CE FICHIER : ce n'est pas la garantie qui coûte, c'est le
// geste humain qui la satisfaisait. On garde donc la garantie ENTIÈRE et on retire l'humain —
// la commande verse elle-même. Le dirigeant a tranché dans ce sens le 2026-08-16 : la revue
// reste exigée pour les lieux de GESTIONNAIRE CLIENT (un canal que le client voit), elle est
// retirée pour les ORCHESTRATEURS, et le gate du commit reste pour les deux, sans exception.
//
// ⚠️ CE QU'ON NE FAIT JAMAIS ICI : pousser, ouvrir une PR, fusionner, changer de branche,
// toucher à quoi que ce soit qui ne soit pas le lieu. Un commit local est réversible d'un geste
// et ne sort pas du poste. Tout le reste appartient à celui qui relira.

import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

/** Le lieu, exprimé relativement au dépôt — la forme que git comprend. */
function cheminDansLeDepot(depot, lieu) {
  const rel = relative(resolve(depot), resolve(lieu));
  if (!rel || rel.startsWith('..')) {
    throw new Error(
      `le lieu (${lieu}) n’est pas dans le dépôt (${depot}) — refus de verser quoi que ce soit ` +
        'hors du dépôt visé'
    );
  }
  return rel;
}

function git(depot, args) {
  return execFileSync('git', ['-C', resolve(depot), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Ce que git voit du lieu, dit en clair : rien à verser, ou la liste de ce qui manque.
 *
 * On interroge `git status --porcelain` sur le CHEMIN DU LIEU seulement. Un `status` global
 * dirait tout ce qui traîne dans le dépôt, et la commande se mettrait à verser le travail de
 * quelqu'un d'autre — ce qui serait bien pire que de refuser.
 */
export function ceQuiResteAVerser(depot, lieu) {
  const rel = cheminDansLeDepot(depot, lieu);
  const sortie = git(depot, ['status', '--porcelain', '--', rel]);
  return sortie
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export class VersementImpossible extends Error {
  constructor(message, geste) {
    super(`${message}\n  Le geste qui lève le blocage : ${geste}`);
    this.name = 'VersementImpossible';
    this.geste = geste;
  }
}

/**
 * VERSER LE LIEU — idempotent, borné au lieu, et franc quand il ne peut pas.
 *
 * @returns {{verse: boolean, deja: boolean, fichiers: string[]}}
 *
 * `deja: true` quand il n'y avait rien à verser : c'est le cas nominal d'une relance, et il ne
 * doit produire aucun commit vide. Un commit vide à chaque lancement rendrait l'historique
 * illisible et ferait douter de tous les autres.
 */
/**
 * LE DÉPÔT EST-IL UN DÉPÔT ? — à demander AVANT de poser, jamais après.
 *
 * ⚠️ TROUVÉ PAR LA PREUVE RÉELLE, PAS PAR LA SUITE. La première version posait le lieu, puis
 * tentait de le verser, puis échouait « ce n'est pas un dépôt git » — en LAISSANT le lieu sur
 * disque. C'est un demi-succès, exactement ce que la commande promet de ne jamais rendre, et
 * l'essai de bout en bout l'a attrapé du premier coup.
 *
 * Une précondition se vérifie avant d'agir. Après, ce n'est plus une précondition : c'est un
 * regret.
 */
export function exigerUnDepotGit(depot) {
  try {
    git(depot, ['rev-parse', '--git-dir']);
  } catch {
    throw new VersementImpossible(
      `${depot} n’est pas un dépôt git — le lieu ne peut pas être versé, et la naissance exige ` +
        `qu’un commit le porte (le refus vient d’une mesure : 3 lieux sur 5 portaient une garde ` +
        `qu’aucun commit ne contenait). Rien n’a été posé.`,
      `initialise le dépôt (\`git init\`), ou vise le dépôt du chantier avec \`--depot\`.`
    );
  }
}

/**
 * Les branches dont un commit porte ce chemin — la mesure que `lieu-expose.js` attend
 * (T-20260814-0014).
 *
 * ⚠️ RENDS `null` QUAND ON N'A PAS PU MESURER, jamais `[]`. Une liste vide veut dire « mesuré,
 * et rien ne le porte » — l'alarme maximale. Confondre les deux ferait crier sur un lieu
 * parfaitement sain au motif qu'on n'a pas su regarder, et c'est le motif que ce dépôt ferme
 * partout ailleurs.
 */
export function branchesQuiPortent(depot, lieu) {
  if (!lieu) return null;
  // ⚠️ `git cat-file <branche>:<chemin>` veut un chemin RELATIF au dépôt. Lui donner l'absolu
  // — ce que porte `commandes.lieu` — ne trouve jamais rien : on lisait « aucune branche ne le
  // porte » là où il y en avait une, soit l'alarme maximale sur un lieu sain. Attrapé par
  // l'essai de bout en bout, pas par la lecture.
  const racine = resolve(depot);
  const abs = resolve(lieu);
  const relatif = abs.startsWith(racine) ? abs.slice(racine.length).replace(/^[/\\]+/, '') : lieu;
  lieu = relatif;
  try {
    const noms = git(depot, ['branch', '--all', '--format=%(refname:short)'])
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => !x.includes('->'));
    const porteuses = [];
    for (const b of noms) {
      try {
        git(depot, ['cat-file', '-e', `${b}:${lieu}`]);
        porteuses.push(b);
      } catch {
        /* cette branche ne le porte pas — c'est un fait, pas une panne */
      }
    }
    return porteuses;
  } catch {
    // git injoignable, dépôt illisible : on n'a RIEN mesuré, et on le dit.
    return null;
  }
}

export function verserLeLieu(depot, lieu, { quoi = 'le lieu', role = 'agent', nom = '' } = {}) {
  const rel = cheminDansLeDepot(depot, lieu);

  // Hors dépôt git : on ne fabrique pas un dépôt pour pouvoir committer. La précondition
  // ci-dessus l'a normalement déjà dit, avant que rien ne soit posé ; ce filet couvre les
  // appelants qui viendraient ici sans être passés par elle.
  exigerUnDepotGit(depot);

  const reste = ceQuiResteAVerser(depot, lieu);
  if (!reste.length) return { verse: false, deja: true, fichiers: [] };

  try {
    git(depot, ['add', '--', rel]);
  } catch (err) {
    throw new VersementImpossible(
      `git a refusé d’indexer ${rel} : ${String(err.stderr || err.message).trim()}`,
      `regarde ce que \`git status\` dit de ${rel}, puis relance.`
    );
  }

  // ⚠️ ON COMMIT UNIQUEMENT LE CHEMIN DU LIEU (`git commit -- <chemin>`), jamais l'index entier.
  // Un dépôt de travail porte presque toujours autre chose d'indexé ; l'emporter au passage
  // ferait signer à la commande un travail qu'elle n'a pas lu.
  const message =
    `chore(${role}): verse ${quoi}${nom ? ` ${nom}` : ''}\n\n` +
    `Versé par la naissance elle-même — le gate du commit (T-20260814-0139) reste entier, ` +
    `c’est le geste humain qui le satisfaisait qui disparaît.\n\n` +
    `Refs T-20260816-0038`;
  try {
    git(depot, ['commit', '-q', '-m', message, '--', rel]);
  } catch (err) {
    throw new VersementImpossible(
      `git a refusé de committer ${rel} : ${String(err.stderr || err.message).trim()}`,
      `vérifie que le dépôt a une identité (\`git config user.email\`) et qu’aucune fusion n’est en cours.`
    );
  }
  return { verse: true, deja: false, fichiers: reste };
}

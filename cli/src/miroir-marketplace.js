// miroir-marketplace.js — remettre à niveau la RÉFÉRENCE contre laquelle la garde de
// fraîcheur juge les gabarits, au moment où l'on met le poste à niveau. Et rien d'autre.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE FICHIER FERME (T-20260826-0069)
//
// `fraicheur-gabarit.js` compare le gabarit qu'un dépôt s'apprête à SERVIR à celui du clone
// que Claude Code tient sous « ~/.claude/plugins/marketplaces/somtech-pack » — c'est
// `SOUS_CHEMIN_REFERENCE`, et c'est délibérément une empreinte plutôt qu'un numéro.
//
// `npx @somtech-solutions/pack setup` installe le code du poste et ne touchait PAS ce clone.
// Les deux avançaient donc chacun de leur côté : au lendemain d'une publication, un dépôt
// PARFAITEMENT À JOUR se faisait comparer à une référence VIEILLE, la garde rendait
// `rc=1, motif gabarit_perime`, et plus aucun lieu ne se posait sur le poste — y compris
// depuis un dépôt irréprochable. Le message de refus recommande « pack update » dans le
// dépôt CIBLE, geste qui ne peut rien y faire : ce n'est pas le dépôt qui retarde.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QU'ON A MESURÉ SUR LE POSTE, LE 2026-08-26, ET QUI DÉCIDE DE LA FORME
//
// ⚠️ LE CLONE A UN PROPRIÉTAIRE, ET CE N'EST PAS NOUS. `~/.claude/plugins/known_marketplaces.json`
// porte, pour « somtech-pack » : `installLocation` = ce chemin exactement, `autoUpdate: true`,
// et un `lastUpdated` que Claude Code réécrit (mesuré à 15:06:58Z pendant que le dernier
// avancement réel du clone datait de 14:33Z — il VÉRIFIE plus souvent qu'il n'AVANCE). Le
// reflog du clone ne montre qu'une forme de geste : « pull origin HEAD: Fast-forward », huit
// fois en trois jours, à des heures irrégulières.
//
// Deux conséquences, et elles portent tout ce fichier :
//
//   ① On RATTRAPE, on ne REMPLACE pas. Le geste est le même que celui de Claude Code —
//      un `pull --ff-only` — et pas une copie du payload par-dessus. Écrire les gabarits du
//      paquet dans le clone rendrait la garde TAUTOLOGIQUE : elle comparerait le pack à
//      lui-même et ne pourrait plus jamais refuser. Une référence ne vaut que si elle vient
//      d'ailleurs que de ce qu'elle juge.
//
//   ② CLONE ABSENT ⇒ ON NE CLONE PAS. C'est contre-intuitif et c'est mesuré : un clone
//      déposé là sans entrée dans `known_marketplaces.json` n'est tenu par PERSONNE — pas
//      d'`autoUpdate`, donc figé à jamais. On fabriquerait, en croyant le fermer, le défaut
//      exact qu'on ferme, et en pire : définitif. Et on transformerait un poste neuf, qui
//      pose ses lieux sans encombre aujourd'hui (« référence introuvable ⇒ jamais un
//      refus », en tête de `fraicheur-gabarit.js`), en poste qui peut refuser. Le geste
//      juste pour un poste neuf est « /plugin marketplace add », et il appartient à
//      l'opérateur.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ÉCHOUER, OUI. SE TAIRE, JAMAIS.
//
// Un poste hors réseau doit pouvoir se configurer : faire échouer `setup` parce que GitHub
// ne répond pas échangerait une référence en retard — bruyante, contournable, documentée —
// contre un poste qu'on ne peut plus monter du tout. Le rafraîchissement est donc
// best-effort et ne décide JAMAIS du code de retour.
//
// Mais un rattrapage qui échoue EN SILENCE reconduit exactement le défaut de ce ticket :
// l'opérateur croirait sa référence à niveau et ne comprendrait pas le refus du lendemain.
// Chaque état non-nominal se dit, avec ce que git a répondu et le geste manuel qui répare.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { SOUS_CHEMIN_REFERENCE } from './fraicheur-gabarit.js';

/**
 * La racine du clone, sous un répertoire personnel.
 *
 * ⚠️ DÉRIVÉE DE `SOUS_CHEMIN_REFERENCE`, JAMAIS RÉÉCRITE. C'est le seul moyen que les deux
 * ne se déphasent pas : le jour où la garde ira chercher sa référence ailleurs, ce module la
 * suivra sans qu'on y pense. Le sous-chemin de la garde s'arrête sur « .claude/templates » —
 * deux crans au-dessus se trouve la racine du dépôt cloné.
 */
export const SOUS_CHEMIN_MIROIR = dirname(dirname(SOUS_CHEMIN_REFERENCE));

/** Ce que l'opérateur a à faire quand on n'a pas su rattraper à sa place. */
export const COMMANDE_MANUELLE = `git -C "<miroir>" pull --ff-only`;

/** Le geste qui fait naître la référence sur un poste qui ne l'a jamais eue — pas le nôtre. */
export const COMMANDE_AJOUT = '/plugin marketplace add SomtechSolutionMAxime/somtech-pack';

/**
 * Où se trouve le clone sur CE poste.
 *
 * `foyer` reprend, à l'identique, la résolution de `referenceDuPoste` — même ordre, mêmes
 * repli. Deux résolutions qui divergeraient feraient rafraîchir un répertoire pendant que la
 * garde en lit un autre, et le rattrapage n'aurait aucun effet visible.
 */
export function cheminDuMiroir({ foyer } = {}) {
  const maison = foyer ?? process.env.HOME ?? homedir();
  if (!maison) return null;
  return join(maison, SOUS_CHEMIN_MIROIR);
}

/** L'empreinte du commit courant, ou `null` si le dépôt ne s'est pas laissé interroger. */
function teteDe(depot, timeout) {
  try {
    return execFileSync('git', ['-C', depot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    }).trim();
  } catch {
    return null;
  }
}

/** Le nombre de lignes que `git status --porcelain` rend — `null` si on n'a pas su mesurer. */
function salissuresDe(depot, timeout) {
  try {
    const sortie = execFileSync('git', ['-C', depot, 'status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });
    return sortie.split('\n').filter((l) => l.trim() !== '').length;
  } catch {
    return null;
  }
}

/**
 * Rattraper le clone de référence.
 *
 * Rend l'un de six états, et jamais autre chose — `ok` dit seulement si le geste a abouti,
 * il ne commande JAMAIS le code de retour de l'appelant :
 *
 *   { etat: 'absent'      }  aucun clone sur ce poste → on ne clone pas, on le dit
 *   { etat: 'pas_un_depot'}  le chemin existe mais n'est pas un dépôt git → on n'y touche pas
 *   { etat: 'dry-run'     }  aperçu demandé → rien n'a été lancé
 *   { etat: 'a_jour'      }  la tête n'a pas bougé → le geste est idempotent, et le dit
 *   { etat: 'rafraichi'   }  la tête a avancé : `avant` → `apres`
 *   { etat: 'echec'       }  git a refusé (réseau, arbre sale, non fast-forward, sans amont)
 *
 * ⚠️ LE GESTE EST `pull --ff-only`, ET C'EST LUI QUI RÉPOND À « ET SI LE CLONE EST SALE, OU
 * SUR UNE AUTRE BRANCHE ? ». On ne réimplémente pas ces contrôles : git les fait déjà, mieux,
 * et il ne perd rien par construction — arbre sale dont un fichier serait écrasé, avance
 * impossible en fast-forward, branche sans amont, tête détachée, tous rendent un refus et
 * laissent le clone intact. Chacun de ces refus arrive ici en `echec` et se dit. Une garde
 * que j'écrirais en double serait une seconde écriture de la même règle, qui se déphaserait.
 *
 * ⚠️ ET LES MODIFICATIONS LOCALES SE RAPPORTENT MÊME QUAND LE PULL RÉUSSIT : un `--ff-only`
 * qui n'entre en conflit avec rien avance ET conserve la dérive locale. Le clone est alors à jour
 * ET différent du pack publié — donc toujours une cause de `gabarit_perime`, mais silencieuse.
 * On compte, on ne juge pas.
 *
 * @param {string}  [foyer]     le répertoire personnel — les tests seuls le passent
 * @param {boolean} [dryRun]    aperçu : aucune commande git qui écrit n'est lancée
 * @param {number}  [timeoutMs] borne d'attente d'un poste dont le réseau pend, sans réponse
 */
export function rafraichirMiroirMarketplace({ foyer, dryRun = false, timeoutMs = 60_000 } = {}) {
  const chemin = cheminDuMiroir({ foyer });
  if (!chemin) {
    return { ok: false, etat: 'absent', chemin: null, message: 'aucun répertoire personnel n’est connu de ce processus' };
  }
  if (!existsSync(chemin)) {
    // ⚠️ LA BRANCHE QUI NE CRÉE RIEN. Voir l'en-tête : cloner ici fabriquerait une référence
    // que personne ne tient, et rendrait refusable un poste qui ne l'était pas.
    return {
      ok: false,
      etat: 'absent',
      chemin,
      message:
        `aucun clone du marketplace sous « ${chemin} » — la garde de fraîcheur n’a donc pas de ` +
        `référence sur ce poste, et ne refusera rien. Pour lui en donner une : « ${COMMANDE_AJOUT} » ` +
        `dans Claude Code. Rien n’a été créé ici : un clone déposé hors du registre de Claude Code ` +
        `ne serait tenu à jour par personne.`,
    };
  }
  if (!existsSync(join(chemin, '.git'))) {
    return {
      ok: false,
      etat: 'pas_un_depot',
      chemin,
      message: `« ${chemin} » existe mais n’est pas un dépôt git — non touché.`,
    };
  }

  const avant = teteDe(chemin, timeoutMs);
  if (dryRun) {
    return { ok: true, etat: 'dry-run', chemin, avant, message: `${chemin} (tête ${avant ?? 'illisible'})` };
  }

  let refus = null;
  try {
    execFileSync('git', ['-C', chemin, 'pull', '--ff-only'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      // ⚠️ AUCUNE INVITE, JAMAIS. Le dépôt est privé et son remote est en HTTPS : sans ça,
      // un poste dont les identifiants ont expiré ferait PENDRE `pack setup` sur une invite
      // que personne ne voit — un setup qui ne rend jamais la main, pour un geste accessoire.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    });
  } catch (e) {
    refus = (e?.stderr || e?.stdout || e?.message || '').toString().trim().split('\n').slice(0, 4).join(' · ');
  }

  const apres = teteDe(chemin, timeoutMs);
  const sales = salissuresDe(chemin, timeoutMs);
  const deriveLocale = sales ? ` ⚠️ le clone porte ${sales} modification(s) locale(s) : sa référence n’est plus celle du pack publié.` : '';

  if (refus !== null) {
    return {
      ok: false,
      etat: 'echec',
      chemin,
      avant,
      apres,
      sales,
      message:
        `git n’a pas pu rattraper « ${chemin} » : ${refus}\n` +
        `    Rien n’a été perdu (« pull --ff-only » ne réécrit rien). La garde de fraîcheur ` +
        `continuera de comparer à la référence telle qu’elle est ; si elle refuse une pose, ` +
        `c’est ici qu’il faut regarder : « git -C ${chemin} pull --ff-only ».${deriveLocale}`,
    };
  }

  if (avant && apres && avant === apres) {
    return { ok: true, etat: 'a_jour', chemin, avant, apres, sales, message: `déjà à jour (${avant.slice(0, 7)})${deriveLocale}` };
  }
  return {
    ok: true,
    etat: 'rafraichi',
    chemin,
    avant,
    apres,
    sales,
    message: `rafraîchi ${(avant ?? '?').slice(0, 7)} → ${(apres ?? '?').slice(0, 7)}${deriveLocale}`,
  };
}

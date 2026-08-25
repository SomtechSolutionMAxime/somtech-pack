// chef-equipe.js — CE QU'UN CHEF D'ÉQUIPE A, ET CE QU'IL N'A PAS. (D-20260825-0002.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE RÔLE QUI N'A PAS DE LIEU — ET POURQUOI IL N'EST PAS DANS `ROLES`
//
// Les deux autres rôles du dépôt — représentant, orchestrateur — ont un LIEU : un dossier
// versionné, dans le dépôt du chantier, qui porte leur métier, leurs moyens et leurs droits.
// `ligne-directe/src/roles.js` est la table de CES rôles-là : chacune de ses entrées déclare
// un `dossier`, des `gabarits` et des `entetes`, et tout le dépôt lit ces clés.
//
// 🔴 UN CHEF D'ÉQUIPE N'A RIEN DE TOUT ÇA, ET L'Y INSCRIRE CASSE LE RESTE — MESURÉ. Une entrée
// sans `entetes` fait tomber `roleDuLieuOuRefus` sur `Object.entries(undefined)`
// (`lieu-agent.js:279`), dont le contrat est gelé et dont dépend le garde de naissance de TOUS
// les autres rôles. On ne range pas un rôle sans lieu dans la table des rôles qui en ont un :
// on paierait la naissance des deux autres pour loger celui-ci.
//
// Le rôle d'un chef d'équipe vit donc DANS SA DÉCLARATION (`declaration.js`), qui est
// précisément l'endroit prévu pour un fait qui n'a pas de dossier où s'écrire.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// CE QU'IL A À LA PLACE : UN ESPACE DE TRAVAIL, ET RIEN DEDANS
//
// Un worktree `<racine>/<dépôt>/<horodatage>` sur une branche-socle `wt/<horodatage>`, tiré de
// `origin/main`. C'est mot pour mot ce que /orchestrer-chantier §4-bis fait faire à la main
// aujourd'hui, et ce que le chapitre « Faire naître » du métier de l'orchestrateur ordonne.
//
// ⚠️ ET ON N'Y POSE RIEN. Pas de `.orchestrateur/`, pas de gabarit, pas de `.nom-agent`, pas de
// garde d'ouverture. Un chef d'équipe vit le temps d'un epic dans un arbre qu'on retirera : y
// verser un lieu ferait naître, à chaque epic, un dossier versionné dans le dépôt du chantier
// que personne ne relira jamais — et le gate de versement (T-20260814-0139) exigerait alors un
// commit pour chaque agent d'un jour.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

import { familleDuMandat, codeDuMandat } from '../../ligne-directe/src/mandat.js';
// ⚠️ LA FORME VIENT DE CELLE QUI JUGE, jamais d'une seconde expression écrite ici — voir
// `exigerUnHorodatageDEspace` plus bas pour ce que la divergence rouvrirait.
import { estUnHorodatageDeNaissance } from './garde-des-naissances.js';

/** Le nom du rôle, écrit UNE fois — un rôle épelé à deux endroits diverge au premier changement. */
export const ROLE_CHEF_EQUIPE = 'chef-equipe';

/** La base par défaut de l'espace — celle que la compétence ordonne, jamais la branche courante. */
export const BASE_PAR_DEFAUT = 'origin/main';

/** Le rôle nommé est-il celui qui n'a pas de lieu ? */
export function estChefDEquipe(role) {
  return role === ROLE_CHEF_EQUIPE;
}

/**
 * OÙ NAISSENT LES ESPACES — même forme de surcharge que `declaration.js` et `registre.js`, et
 * pour la même raison : c'est ce qui permet à une suite d'essais de mettre le `~/worktrees` du
 * poste hors de portée sans avoir à toucher au code.
 *
 * ⚠️ UNE FONCTION, PAS UNE CONSTANTE. Lue une seule fois à l'import, la valeur serait figée
 * avant qu'un essai ait pu poser sa surcharge — et l'essai écrirait dans le vrai `~/worktrees`
 * en paraissant réussir.
 */
export function racineDesEspaces() {
  return process.env.SOMTECH_WORKTREES_RACINE || join(homedir(), 'worktrees');
}

/** Levée quand l'espace de travail ne peut pas naître — avec le geste qui lève le blocage. */
export class EspaceDeTravailImpossible extends Error {
  constructor(message, geste) {
    super(geste ? `${message}\n  Le geste qui lève le blocage : ${geste}` : message);
    this.name = 'EspaceDeTravailImpossible';
    this.geste = geste || '';
  }
}

/** Levée quand le nom d'un chef d'équipe ne désigne aucun chantier au registre. */
export class MandatSansChantier extends Error {
  constructor(brut) {
    super(
      `« ${brut || '(vide)'} » n’est pas un code de chantier, et un chef d’équipe PORTE le code ` +
        `de son mandat — c'est par là qu'on le rattache à ce qu'il livre.\n` +
        `  Attendu : D-YYYYMMDD-NNNN, P-…, J-…, E-… ou T-… (par exemple E-20260825-0002).\n` +
        `  Un nom inventé (« revue-pr180 », « chef-equipe-orchestration ») fait naître un agent ` +
        `que rien ne raccorde à un chantier, et sa déclaration inscrirait un mandat qui ne ` +
        `désigne rien.`
    );
    this.name = 'MandatSansChantier';
    this.brut = brut;
  }
}

/**
 * Le mandat d'un chef d'équipe, exigé et normalisé.
 *
 * ⚠️ POURQUOI C'EST UN REFUS ET PAS UN AVERTISSEMENT. Le métier de l'orchestrateur l'écrit
 * comme une faute nommée — « ❌ `chef-equipe-orchestration`, `revue-pr180` — des noms inventés,
 * raccordés à rien » — et deux agents sur 42 étaient déjà dans ce cas sur ce poste. La
 * déclaration, elle, n'a pas de champ « à peu près » : le mandat qu'elle inscrit est lu comme
 * un fait. Mieux vaut refuser une naissance qu'inscrire un mandat qui ne désigne aucun
 * chantier — le premier se voit, le second se croit.
 *
 * @returns {string} le code tel que le ServiceDesk l'écrit (majuscules)
 * @throws  {MandatSansChantier}
 */
export function exigerUnMandatDeChantier(brut) {
  if (!familleDuMandat(brut)) throw new MandatSansChantier(brut);
  return codeDuMandat(brut);
}

/**
 * L'horodatage qui nomme l'espace et sa branche-socle.
 *
 * ⚠️ EN HEURE LOCALE, et ce n'est pas un détail : la compétence ordonne `date +%Y%m%d-%H%M%S`,
 * qui est local. Le rendre en UTC ferait naître des espaces dont le nom ne correspond à aucune
 * heure que le dirigeant a vécue — quatre heures d'écart l'été, sur un poste au Québec — et
 * `claude-swt <timestamp>`, qui reprend une session par son horodatage, ne les retrouverait
 * plus par ce qu'on lit à l'écran.
 */
export function horodatageDEspace(quand = new Date()) {
  const d = (n) => String(n).padStart(2, '0');
  return (
    `${quand.getFullYear()}${d(quand.getMonth() + 1)}${d(quand.getDate())}` +
    `-${d(quand.getHours())}${d(quand.getMinutes())}${d(quand.getSeconds())}`
  );
}

/** Levée quand un horodatage dicté n'a pas la forme que la garde des naissances sait lire. */
export class HorodatageHorsForme extends Error {
  constructor(brut) {
    super(
      `« ${brut || '(vide)'} » n’est pas un horodatage d’espace de travail.\n` +
        `  Attendu : AAAAMMJJ-HHMMSS (par exemple 20260825-083616) — la forme que \`claude-swt\` pose.\n` +
        `  ⚠️ CE N’EST PAS DU ZÈLE DE FORME. Cet horodatage nomme l’espace, donc le dernier segment ` +
        `du chemin où l’agent travaillera — et c’est ce segment que la GARDE DES NAISSANCES lit pour ` +
        `savoir qui elle a le droit de juger. Un nom qu’elle ne sait pas lire fait naître un agent ` +
        `qu’elle rangera en « hors portée » : il ne sera jamais jugé, et rien ne le dira.`
    );
    this.name = 'HorodatageHorsForme';
    this.brut = brut;
  }
}

/**
 * L'horodatage d'un espace, exigé sous la forme que la GARDE sait lire.
 *
 * ⚠️ LA FORME N'EST PAS RÉÉCRITE ICI. Elle vit chez `garde-des-naissances.js`, qui juge sur elle ;
 * en poser une seconde copie ici garantirait qu'un jour l'une accepte ce que l'autre refuse — et
 * la version qui divergerait serait celle-ci, celle qui produit, dont aucune garde ne relit la
 * population. On importe donc son verdict, on n'imite pas son expression.
 *
 * @returns {string} l'horodatage, RENDU TEL QUEL — on ne réécrit pas ce qu'on a accepté
 * @throws  {HorodatageHorsForme}
 */
export function exigerUnHorodatageDEspace(brut) {
  if (!estUnHorodatageDeNaissance(brut)) throw new HorodatageHorsForme(brut);
  return brut;
}

function git(depot, args) {
  return execFileSync('git', ['-C', depot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Le nom du dépôt PRINCIPAL — celui sous lequel les espaces se rangent.
 *
 * 🔴 `--show-toplevel` NE RÉPOND PAS À CETTE QUESTION, et l'écart est réel sur ce poste. Lancée
 * depuis un worktree — ce qui est le cas NORMAL, puisqu'un orchestrateur travaille lui-même
 * dans un plan de travail horodaté — elle rend le worktree :
 *
 *   git rev-parse --show-toplevel      → /Users/…/worktrees/somtech-pack/20260825-083616
 *   git rev-parse --git-common-dir     → /Users/…/GitRepo.nosync/somtech-pack/.git
 *
 * Le premier ferait naître `~/worktrees/20260825-083616/<ts>` : un dossier par session au lieu
 * d'un dossier par dépôt, et l'inventaire du poste cesserait de se lire. `--git-common-dir`
 * pointe le `.git` PARTAGÉ, donc le dépôt, depuis n'importe lequel de ses worktrees.
 */
export function nomDuDepotPrincipal(depot) {
  const commun = git(depot, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  // Un `.git` de dépôt ordinaire → son parent est le dépôt. Un dépôt `--bare` n'a pas de
  // parent porteur de sens : on prend alors son propre nom, débarrassé du « .git ».
  return basename(commun) === '.git' ? basename(dirname(commun)) : basename(commun).replace(/\.git$/, '');
}

/**
 * Fait naître l'espace de travail d'un chef d'équipe — un worktree, et rien d'autre.
 *
 * @param {object}  entree
 * @param {string}  entree.depot       le dépôt du chantier (un de ses worktrees fait l'affaire)
 * @param {string}  entree.horodatage  ce qui nomme l'espace ET sa branche-socle
 * @param {string} [entree.racine]     où ranger les espaces — `racineDesEspaces()` par défaut
 * @param {string} [entree.base]       d'où partir — `origin/main` par défaut
 *
 * @returns {{espace: string, branche: string, base: string, depot_principal: string}}
 * @throws  {EspaceDeTravailImpossible} et le refus n'a RIEN créé
 */
export function creerEspaceDeTravail({ depot, horodatage, racine = racineDesEspaces(), base = BASE_PAR_DEFAUT } = {}) {
  let nomDepot;
  try {
    nomDepot = nomDuDepotPrincipal(depot);
  } catch (err) {
    throw new EspaceDeTravailImpossible(
      `« ${depot} » n’est pas un dépôt git (${String(err?.message ?? err).trim().split('\n')[0]}) — ` +
        `un chef d’équipe naît dans un worktree, et un worktree se tire d’un dépôt.`,
      'vise le dépôt du chantier avec `--depot`.'
    );
  }

  // ⚠️ LA BASE SE MESURE AVANT DE CRÉER QUOI QUE CE SOIT. Sans elle, `git worktree add` retombe
  // sur `HEAD` — donc sur la branche courante du dépôt, qui porte peut-être le travail non
  // poussé de quelqu'un d'autre. Un espace né « quelque part » est pire qu'un refus : il a
  // l'air normal, et le lot en sortira greffé sur une base que personne n'a choisie.
  let socle;
  try {
    // ⚠️ ON GARDE LE COMMIT, PAS LE NOM. `origin/main` peut avancer entre la naissance de
    // l'espace et son défaire (un `fetch` d'un autre worktree suffit) : comparer la branche à
    // `origin/main` lirait alors « elle a bougé », donc « elle porte du travail », sur un arbre
    // où personne n'a rien fait — et l'orphelin resterait pour toujours. Le socle est le commit
    // RÉSOLU au moment où l'espace naît, c'est-à-dire le seul point fixe de la comparaison.
    socle = git(depot, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  } catch {
    throw new EspaceDeTravailImpossible(
      `« ${base} » est introuvable dans ${depot} — je ne sais pas d’où faire partir l’espace de ` +
        `travail, et je ne retombe PAS sur la branche courante : elle porte peut-être le travail ` +
        `de quelqu’un d’autre.`,
      `récupère la base (\`git -C ${depot} fetch origin\`), ou nomme-en une autre avec \`--base\`.`
    );
  }

  const espace = join(resolve(racine), nomDepot, horodatage);
  const branche = `wt/${horodatage}`;

  // ⚠️ ON REFUSE PLUTÔT QUE DE RÉUTILISER. Deux agents dans le même arbre partagent la branche,
  // l'index et le statut : ce qui ressemble à une économie est une collision silencieuse, où le
  // commit de l'un emporte le travail de l'autre. Mesuré sur ce dépôt.
  if (existsSync(espace)) {
    throw new EspaceDeTravailImpossible(
      `« ${espace} » existe déjà — je n’y fais naître personne : deux agents dans le même arbre ` +
        `partagent branche, index et statut, et le commit de l’un emporte le travail de l’autre.`,
      `donne un autre horodatage, ou retire l’espace s’il est fini ` +
        `(\`git -C ${depot} worktree remove ${espace}\`).`
    );
  }

  try {
    git(depot, ['worktree', 'add', espace, '-b', branche, base]);
  } catch (err) {
    // ⚠️ ON RELAIE LA PAROLE DE GIT, on ne la remplace pas par une formule. Les causes réelles —
    // une branche-socle déjà prise, un disque plein, un `.git` verrouillé — ne se devinent pas,
    // et un message qui les recouvre toutes envoie chercher au mauvais endroit.
    const dit = String(err?.stderr || err?.message || err).trim();
    throw new EspaceDeTravailImpossible(
      `git a refusé de créer l’espace de travail « ${espace} » sur « ${branche} » :\n  ${dit}`,
      'lis ce que git dit ci-dessus — la cause y est nommée.'
    );
  }

  return { espace, branche, base, socle, depot_principal: nomDepot };
}

/**
 * DÉFAIRE L'ESPACE DE TRAVAIL — l'arbre, sa branche-socle, et son enregistrement.
 *
 * 🔴 LE DÉFAUT QUE CECI FERME. « Un refus ne laisse rien derrière lui » est écrit dans trois
 * textes opposables (`chefs-equipe.md`, `orchestrer-chantier/SKILL.md`, `cli/src/commands/
 * agent.js`), et c'était FAUX de l'objet le plus lourd du geste. DIX refus de `naitre.js`
 * tombent APRÈS `creerEspaceDeTravail`, et le seul filet de sortie ne connaissait que l'espace
 * HERDR. Mesuré : l'arbre, `wt/<horodatage>` et l'entrée de `git worktree list` restaient tous
 * les trois. C'est la MÊME forme, un cran plus haut, que le défaut déjà fermé sur l'espace herdr.
 *
 * ⚠️ ET CE GESTE EST PLUS DANGEREUX QUE L'ORPHELIN QU'IL NETTOIE, si on le pose aveugle : un
 * arbre qui porte du travail est le travail de quelqu'un. Deux gardes le bornent, et elles ne
 * mesurent PAS la même chose :
 *
 *   ① LE SOCLE A-T-IL BOUGÉ ? Un arbre dont tout est commité est PROPRE au sens de
 *      `git status` — `worktree remove` l'emporterait sans un mot, et le travail ne vivrait
 *      plus que dans une branche que ce geste s'apprête à supprimer. On compare donc la
 *      branche à son socle AVANT de toucher à l'arbre, et un socle bougé arrête TOUT.
 *   ② `git worktree remove` SANS `--force`. C'est la garde de git contre l'arbre sale
 *      (modifié, ou porteur de fichiers non suivis) — on la relaie, on ne la contourne pas.
 *      `--force` ici serait rendre au dispositif le pouvoir de détruire ce qu'il ne comprend pas.
 *
 * ⚠️ ET LA BRANCHE NE PART QU'APRÈS L'ARBRE. Une branche supprimée sur un arbre qui reste
 * laisse un worktree détaché que plus rien ne nomme : la moitié du ménage est pire que rien.
 *
 * ⚠️ UN ESPACE DÉJÀ ABSENT N'EST PAS UNE PANNE. Retiré à la main entre-temps, il rend `ok` —
 * traiter l'absence comme un échec ferait écrire un avertissement d'orphelin là où il n'y en a
 * pas, et le bruit finit par faire ignorer le vrai.
 *
 * @param {object} entree
 * @param {string} entree.depot      le dépôt du chantier
 * @param {string} entree.espace     l'arbre, tel que `creerEspaceDeTravail` l'a rendu
 * @param {string} entree.branche    sa branche-socle
 * @param {string} [entree.socle]    le commit d'où elle est partie — absent, on ne défait RIEN
 * @returns {{ok: boolean, message: string}}  ne jette jamais : il tourne dans une sortie
 */
export function defaireEspaceDeTravail({ depot, espace, branche, socle } = {}) {
  const geste = `\`git -C ${depot} worktree remove ${espace}\``;

  // ⚠️ SANS SOCLE, ON NE DÉFAIT PAS. C'est la moitié qui refuse de deviner : ne pas savoir d'où
  // la branche est partie, c'est ne pas pouvoir dire si elle a bougé — donc ne pas pouvoir dire
  // si l'arbre porte du travail. Un défaire qui devine est un défaire qui détruit.
  if (!depot || !espace || !branche || !socle) {
    return {
      ok: false,
      message:
        `l’espace de travail « ${espace ?? '—'} » n’a PAS pu être défait : il manque de quoi ` +
        `prouver qu’il ne porte rien (dépôt, arbre, branche et socle sont tous requis) — ` +
        `retire-le à la main après avoir regardé : ${geste}`,
    };
  }

  // ① LE SOCLE — mesuré avant tout geste, sur la branche, jamais sur l'arbre.
  let tete;
  try {
    tete = git(depot, ['rev-parse', '--verify', '--quiet', `${branche}^{commit}`]);
  } catch {
    // La branche n'existe plus : il ne reste peut-être que l'arbre. On le dit, on ne devine pas.
    tete = null;
  }
  if (tete && tete !== socle) {
    return {
      ok: false,
      message:
        `l’espace de travail « ${espace} » porte des commits que « ${branche} » n’avait pas en ` +
        `naissant (${socle.slice(0, 8)} → ${tete.slice(0, 8)}) — je n’y touche PAS : c’est du ` +
        `travail, et un ménage qui détruit du travail est pire que l’orphelin qu’il nettoie.\n` +
        `  Regarde ce qu’il porte, puis retire-le toi-même : ${geste} && ` +
        `\`git -C ${depot} branch -D ${branche}\``,
    };
  }

  // ② L'ARBRE — et c'est git qui refuse s'il est sale, pas une seconde mesure écrite ici.
  if (existsSync(espace)) {
    try {
      git(depot, ['worktree', 'remove', espace]);
    } catch (err) {
      const dit = String(err?.stderr || err?.message || err).trim();
      return {
        ok: false,
        message:
          `l’espace de travail « ${espace} », créé par ce geste, n’a PAS pu être défait :\n  ${dit}\n` +
          `  Il porte quelque chose — et je ne force pas. Regarde, puis retire-le : ${geste}`,
      };
    }
  } else {
    // L'arbre est parti sans que git le sache : son enregistrement, lui, peut rester.
    try {
      git(depot, ['worktree', 'prune']);
    } catch {
      /* un `prune` qui échoue ne laisse rien de destructeur derrière lui — on continue. */
    }
  }

  // ③ LA BRANCHE-SOCLE — seulement maintenant, et seulement si elle n'a rien porté.
  if (tete) {
    try {
      git(depot, ['branch', '-D', branche]);
    } catch (err) {
      const dit = String(err?.stderr || err?.message || err).trim();
      return {
        ok: false,
        message:
          `l’arbre « ${espace} » est retiré, mais sa branche-socle « ${branche} » reste :\n  ${dit}\n` +
          `  Retire-la à la main : \`git -C ${depot} branch -D ${branche}\` — sinon la prochaine ` +
          `naissance du même horodatage sera refusée par git.`,
      };
    }
  }

  return { ok: true, message: `espace de travail « ${espace} » défait, avec « ${branche} »` };
}

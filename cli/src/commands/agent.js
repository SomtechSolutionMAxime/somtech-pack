// agent.js — LA PORTE D'ENTRÉE : une commande, joignable par `npx`, qui fait naître un agent
// du néant jusqu'à ce qu'il parle (T-20260816-0038).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI ELLE VIT DANS LE PAQUET PUBLIÉ, ET PAS SEULEMENT DANS `~/.somtech`
//
// Le geste n°3 du décompte de T-20260816-0004 — « créer un espace de travail sur la version à
// jour », noté « non documenté comme nécessaire » — n'est pas une étape du métier. C'est le
// SYMPTÔME d'une dérive, et elle a été mesurée le 2026-08-16 :
//
//   ~/.somtech/naissance-representant/src/session.js  →  ABSENT
//   <payload publié>/naissance-representant/src/session.js  →  PRÉSENT
//   ~/.somtech/pack-latest.json = 1.55.0   ·   VERSION du dépôt = 1.56.0
//
// L'outillage de poste est une COPIE que `pack setup` dépose une fois et qui vieillit. Une
// commande qui vit dedans est donc périodiquement en retard sur elle-même, et personne ne le
// voit. On ne peut pas fermer un défaut avec un outil qui le porte.
//
// Cette porte-ci exécute le `naitre.js` DU PAYLOAD — celui du paquet en train de tourner. Sous
// `npx @somtech-solutions/pack`, c'est la version publiée, fraîchement téléchargée ; depuis le
// dépôt, c'est la source. Dans les deux cas, elle ne peut pas être en retard sur elle-même.
//
// ⚠️ ET LE PAYLOAD LES PORTE DÉJÀ — vérifié, pas supposé. `pack.json` déclare
// `naissance-representant` et `ligne-directe` comme modules, `build-payload.mjs` itère TOUS les
// modules sans regarder leur défaut, et `cli/package.json` publie `files: ["bin","src","payload"]`.
// Comptage à l'appui : 30 fichiers au dépôt / 30 au payload, et 67 / 67. C'est ce qui a montré
// que le choix « la logique dans naitre.js » et le choix « joignable par npx » n'étaient pas
// exclusifs — un faux dilemme, tranché par la mesure.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QU'ELLE NE FAIT PAS
//
// Elle ne réimplémente RIEN. La pose, le versement, la naissance, la lecture d'écran et
// l'amorce vivent dans `naissance-representant`, avec le seul harnais du dépôt qui lance le
// vrai binaire contre un faux herdr. Une seconde implémentation ici créerait un troisième
// verdict là où le dépôt en a déjà deux de trop.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

import { resolvePayloadRoot } from '../modules.js';

export const AIDE_AGENT = `somtech-pack agent naitre <code> --depot <chemin> [options]
somtech-pack agent ou-naitre [chemin…] [--role <rôle>] [--json]
                        Dit quels dépôts peuvent recevoir un agent, et ce qui manque aux autres.
                        (\`agent ou-naitre --help\` pour le détail)


  Fait naître un agent, du néant jusqu'à ce qu'il parle sur sa ligne : elle pose le lieu s'il
  manque, le verse au dépôt, crée l'espace de travail au besoin, fait naître en DÉCLARANT le
  modèle et le mode, vérifie par l'écran que l'agent peut réellement recevoir, puis livre
  l'amorce et prouve qu'elle a été prise.

  Devant un état qu'elle ne reconnaît pas, elle S'ARRÊTE et le nomme. Elle ne rend jamais un
  succès à moitié.

Options :
  --depot <chemin>        le dépôt du chantier (obligatoire)
  --role <role>           orchestrateur (défaut) | representant | chef-equipe
  --workspace <id>        un espace herdr existant ; sans lui, la naissance en ouvre un
                          elle-même, APRÈS tous ses refus — un refus ne laisse donc rien
  --session <nom>         la session herdr visée, quand le poste en porte plusieurs
  --modele <alias>        le modèle déclaré au lancement (défaut : opus)
  --mode <mode>           le mode de permission déclaré (défaut : acceptEdits)
  --amorce <fichier>      le brief à livrer dès la naissance
  --amorce-texte "…"      le même, en clair
  --nom-agent <nom>       le nom que l'agent portera, quand il diffère du code du mandat.
                          SANS LUI, un orchestrateur reçoit une rivière ; c'est le cas normal,
                          et le seul qui ne dépende de personne. Le LIEU garde toujours le code
                          du mandat — seul le nom d'agent change.

Un CHEF D'ÉQUIPE (--role chef-equipe) — le rôle qui n'a PAS de lieu :
  Il reçoit son propre WORKTREE — ~/worktrees/<dépôt>/<horodatage>, sur une branche-socle
  wt/<horodatage> tirée de origin/main — et RIEN d'autre : aucun dossier posé, aucun gabarit,
  aucun commit dans le dépôt du chantier. Son nom est le code de son mandat (jamais une
  rivière : elle est réservée aux orchestrateurs), et sa naissance est INSCRITE — qui il est,
  pour quel mandat, qui l'a ouvert, où il travaille.

  ⚠️ « worktree » et non « espace de travail » : ce dernier désigne déjà l'espace HERDR, celui
  de --workspace. Les deux existent pour un chef d'équipe, et ce ne sont pas les mêmes.

  --coordonnateur <nom>   qui l'ouvre. C'est l'attache que rien d'autre ne porte : la structure
                          du chantier est au registre, l'ID de traçabilité est dans les branches,
                          mais le lien « cet agent, ce coordonnateur » disparaît avec le pane.
  --base <ref>            d'où part son worktree (défaut : origin/main)
  --horodatage <ts>       ce qui nomme son worktree et sa branche (défaut : l'instant présent)
`;

const ICI = dirname(fileURLToPath(import.meta.url)); // cli/src/commands

/**
 * D'OÙ VIENT LE CODE QU'ON EXÉCUTE — et la réponse n'est pas la même dans les deux vies du pack.
 *
 * ⚠️ TROUVÉ PAR LA PREUVE RÉELLE, ET C'EST LE MÊME DÉFAUT QUE CELUI QU'ON FERME, UN CRAN PLUS
 * PRÈS. `resolvePayloadRoot` regarde `cli/payload` AVANT la racine du dépôt. Or `cli/payload`
 * est un produit de build, **ignoré par git** (`.gitignore:13`), qu'un essai reconstruit de
 * temps en temps. Lancée depuis une copie de travail, la commande exécutait donc une version
 * PÉRIMÉE d'elle-même — en silence, et avec un message d'erreur d'une génération antérieure qui
 * envoyait chercher au mauvais endroit.
 *
 * C'est exactement la dérive `~/.somtech` que cette commande existe pour fermer, rejouée à
 * l'intérieur du dépôt. La règle est donc : **dans une copie de travail, la source fait foi sur
 * son propre produit de build.** Dans un paquet publié il n'y a pas de source au-dessus, et le
 * payload reprend son rôle sans rien changer.
 *
 * ⚠️ CE QUE ÇA NE RÈGLE PAS, et qui est nommé plutôt qu'escamoté : `init`, `update` et `setup`
 * continuent d'installer depuis `cli/payload`. Un payload périmé leur ferait poser des fichiers
 * périmés, avec la même discrétion. Ça se tranche sur un cas réel, pas ici.
 */
export function racineDeLaNaissance() {
  const source = resolve(ICI, '..', '..', '..'); // cli/src/commands → racine du dépôt
  if (existsSync(join(source, 'pack.json')) && existsSync(join(source, '.git'))) return source;
  return resolvePayloadRoot();
}

/** Le `naitre.js` du paquet en train de tourner — jamais celui d'une copie de poste. */
export function cheminDeLaNaissance({ source = null } = {}) {
  const racine = source ? resolvePayloadRoot({ source }) : racineDeLaNaissance();
  const chemin = join(racine, 'naissance-representant', 'bin', 'naitre.js');
  if (!existsSync(chemin)) {
    throw new Error(
      `le module « naissance-representant » n’est pas dans ce paquet (${chemin} est absent) — ` +
        `la naissance ne peut pas être lancée.\n` +
        `  Le geste qui lève le blocage : republie le pack avec le module, ou lance la commande ` +
        `depuis le dépôt du pack.`
    );
  }
  return chemin;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUE CETTE PORTE N'OUVRE PLUS — ET POURQUOI (défaut ①, D-20260825-0002)
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Elle appelait `herdr workspace create` ICI, avant de lancer la naissance. Mesuré sur la ligne
 * exacte que le métier prescrit, sans `--workspace` :
 *
 *     pack agent naitre revue-pr180 --role chef-equipe --depot <d> --coordonnateur moi
 *       → herdr workspace create --cwd <d> --label revue-pr180 --no-focus      (ici)
 *       → « Rien n'a été créé : ni espace de travail, ni onglet, ni agent. »   (la naissance, code 1)
 *
 * L'espace herdr restait, orphelin, et le refus mentait. Ce n'était pas propre à ce refus-là :
 * TOUS ceux du chemin chef d'équipe — mandat invalide, `--base` introuvable, espace de travail
 * occupé, nom que herdr refuse, session ambiguë — tombent après le lancement. Deux textes
 * opposables promettaient l'inverse (« avant le moindre appel à herdr », « un refus ne laisse
 * rien derrière lui ») : un texte qui promettait ce que le code ne faisait pas.
 *
 * ⚠️ POURQUOI DÉPLACER PLUTÔT QUE DÉFAIRE. Défaire après coup laisse la phrase « rien n'a été
 * créé » fausse à l'instant où on la lit, et dépend d'un second appel herdr qui peut lui-même
 * échouer. Ouvrir l'espace APRÈS les refus rend la promesse vraie par construction. (Le défaire
 * existe quand même, dans la naissance, pour les échecs qui surviennent APRÈS l'ouverture — ce
 * que l'ordre seul ne peut pas couvrir.)
 *
 * ⚠️ ET CE N'EST PAS QU'UN DÉPLACEMENT. Cet appel-ci partait vers `herdr` NU, c'est-à-dire vers
 * la session par défaut — donc vers rien depuis un terminal ordinaire. La naissance, elle,
 * RÉSOUT sa session avant d'ouvrir : l'espace naît sur la bonne, et le refus d'appartenance
 * qu'on pouvait déclencher soi-même disparaît avec.
 *
 * ⚠️ CE QUE LA PORTE GARDE : ne rien inventer. Un `--workspace` qu'on n'a pas donné n'est pas
 * relayé, sans quoi la naissance ne saurait jamais qu'il manque.
 */

/** Les arguments qu'on relaie à la naissance, dans l'ordre qu'elle attend. */
export function argumentsDeNaissance(
  code,
  { depot, workspace, role, session, modele, mode, amorce, amorceTexte, nomAgent, coordonnateur, base, horodatage }
) {
  const a = [code, '--depot', resolve(depot), '--role', role || 'orchestrateur'];
  // ⚠️ UN ESPACE QU'ON N'A PAS DONNÉ NE S'INVENTE PAS. Le relayer d'office — même vide — ferait
  // croire à la naissance qu'un espace lui a été désigné ; elle chercherait à en vérifier
  // l'appartenance au lieu d'en ouvrir un, après ses refus. C'est l'absence du drapeau qui lui
  // dit « à toi de l'ouvrir, et au bon moment ».
  if (workspace) a.push('--workspace', workspace);
  if (session) a.push('--session', session);
  if (modele) a.push('--modele', modele);
  if (mode) a.push('--mode', mode);
  if (amorce) a.push('--amorce', amorce);
  if (amorceTexte) a.push('--amorce-texte', amorceTexte);
  if (nomAgent) a.push('--nom-agent', nomAgent);
  // ⚠️ RELAYÉS, PAS INTERPRÉTÉS — et surtout pas conditionnés au rôle. Cette porte ne connaît
  // pas la table des rôles et n'a pas à la connaître : filtrer ici sur « chef-equipe » ferait
  // vivre la règle à DEUX endroits, et le second à diverger serait celui-ci, qui ne rougit
  // nulle part. La naissance, elle, sait quoi en faire — et ce qu'elle n'attend pas, elle
  // l'ignore, comme tous les autres drapeaux depuis toujours.
  if (coordonnateur) a.push('--coordonnateur', coordonnateur);
  if (base) a.push('--base', base);
  if (horodatage) a.push('--horodatage', horodatage);
  return a;
}

/**
 * `somtech-pack agent naitre <code> …`
 *
 * Les options sont celles de la naissance, pas celles du pack : cette porte les relaie plutôt
 * que de les redéclarer. Deux déclarations d'un même contrat divergent au premier changement de
 * l'une — c'est le motif que ce dépôt paie le plus cher, et il n'a pas besoin d'une occurrence
 * de plus dans la commande écrite pour le fermer.
 */
export async function cmdAgent(argv, { lancer = spawnSync } = {}) {
  const sous = argv[0];
  if (!sous || sous === '--help' || sous === '-h') {
    console.log(AIDE_AGENT);
    return sous ? 0 : 1;
  }
  // ⚠️ IMPORT DYNAMIQUE, ET C'EST VOULU : `ou-naitre.js` a besoin de `racineDeLaNaissance`, qui
  // vit ici. Un import statique croisé ferait un cycle, dont l'ordre d'évaluation ne se lit dans
  // aucun des deux fichiers. La porte, elle, ne charge que ce qu'elle appelle.
  if (sous === 'ou-naitre') {
    const { cmdOuNaitre } = await import('./ou-naitre.js');
    return cmdOuNaitre(argv.slice(1));
  }
  if (sous !== 'naitre') {
    console.error(`✗ Sous-commande inconnue : agent ${sous}\n`);
    console.log(AIDE_AGENT);
    return 1;
  }

  const reste = argv.slice(1);
  const code = reste[0];
  const opt = (nom) => {
    const i = reste.indexOf(nom);
    return i === -1 ? null : reste[i + 1] ?? null;
  };
  if (!code || code.startsWith('-')) {
    console.error('✗ le code du mandat au registre est requis (d-…, p-…, j-…)\n');
    console.log(AIDE_AGENT);
    return 1;
  }
  const depot = opt('--depot');
  if (!depot) {
    console.error(
      '✗ --depot est requis : le dépôt du chantier où le lieu sera posé et versé.\n' +
        "  Sans lui, la naissance viserait le dépôt qui héberge l’outil, et le refus « le lieu n’existe pas »\n" +
        '  porterait sur le mauvais endroit.'
    );
    return 1;
  }

  let naitre;
  try {
    naitre = cheminDeLaNaissance({ source: opt('--source') });
  } catch (err) {
    console.error(`✗ ${err.message}`);
    return 1;
  }

  const args = argumentsDeNaissance(code, {
    depot,
    workspace: opt('--workspace'),
    role: opt('--role'),
    session: opt('--session'),
    modele: opt('--modele'),
    mode: opt('--mode'),
    amorce: opt('--amorce'),
    amorceTexte: opt('--amorce-texte'),
    nomAgent: opt('--nom-agent'),
    coordonnateur: opt('--coordonnateur'),
    base: opt('--base'),
    horodatage: opt('--horodatage'),
  });

  const r = lancer(process.execPath, [naitre, ...args], { stdio: 'inherit' });
  return r.status === null ? 1 : r.status;
}

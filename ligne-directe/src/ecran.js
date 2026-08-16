// ecran.js — NOMMER CE QU'ON A DEVANT SOI, ou avouer qu'on ne le reconnaît pas (T-20260816-0033).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE
//
// Ce dépôt savait déjà lire une BOÎTE DE SAISIE (`boite.js`). Il ne savait pas lire un ÉCRAN.
// La différence a coûté trois agents en une journée :
//
//   • deux agents avalés par un écran de configuration, dont un a passé 36 minutes dessus
//     pendant que le dirigeant regardait une maquette périmée (T-20260815-0014) ;
//   • un agent parqué dans une revue plein cadre, à la fois immobile ET injoignable, parce que
//     le refus de remise — juste — ne disait pas CE QU'IL Y AVAIT à l'écran (T-20260816-0001) ;
//   • et la session du chef d'équipe qui écrit ces lignes, figée plus d'une heure sans que rien
//     ne le signale. C'est une ronde qui l'a découverte, pas le dispositif.
//
// MESURÉ le 2026-08-16 sur Claude Code 2.1.233, et c'est le fait qui commande tout ce module :
// `herdr agent start` rend `agent_status: idle` ET `interactive_ready: true` PENDANT que l'agent
// est parqué derrière un modal. La disponibilité que herdr annonce est un INDICE, pas le FAIT.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// L'INVARIANT — « une porte sur deux », la dixième fois
//
//   On vérifie le FAIT, jamais l'INDICE.
//   Devant un état qu'on ne reconnaît pas, on S'ARRÊTE et on le NOMME, avec le geste qui le lève.
//
// Deux conséquences que tout ce fichier applique, et dont aucune n'est négociable :
//
//   1. L'INCONNU N'EST JAMAIS « PRÊT ». Un écran qu'on ne reconnaît pas, un écran illisible, une
//      lecture ratée : tous rendent « pas prêt ». L'absence de mesure n'est pas une bonne
//      nouvelle — c'est le raisonnement exact qui a produit `aFichierEnvironnement` et le verrou
//      de sas, et il se réintroduit par la porte du confort à chaque fois.
//
//   2. ON N'INVENTE JAMAIS DE GESTE. Un écran nommé porte le geste qui le lève, parce qu'on l'a
//      vérifié. Un écran inconnu n'en porte AUCUN — il rend ce qu'il a vu, et il se tait sur la
//      suite. Un mauvais conseil se croit ; un aveu d'ignorance se vérifie. Le refus qui disait
//      « désigne-le par son pane » à celui qui venait d'échouer par son pane est le rappel qu'un
//      conseil faux coûte plus cher que pas de conseil du tout (T-20260816-0002).

import { sansGris } from './boite.js';

/** Un filet — la ligne de tirets qui encadre la boîte de saisie à l'écran. Même sonde que `boite.js`. */
const FILET = /^[─-╿]{8,}\s*$/;

/** La marque de la boîte de saisie. */
const INVITE = '❯';

/**
 * LES ÉCRANS QU'ON SAIT NOMMER — et rien de plus.
 *
 * ⚠️ CHAQUE ENTRÉE PORTE UN GESTE, et c'est gardé par un essai. Nommer un écran sans dire quoi
 * faire laisse le lecteur aussi bloqué qu'avant : on aurait remplacé « il est bloqué » par « il
 * est bloqué sur l'écran X », ce qui n'a jamais débloqué personne.
 *
 * ⚠️ LES SONDES DOIVENT ÊTRE DISJOINTES, et c'est gardé aussi. Une sonde trop large ferait
 * nommer un écran pour un autre, donc proposer le mauvais geste — pire que l'aveu d'ignorance.
 *
 * Les motifs sont recopiés d'écrans RÉELLEMENT mesurés, jamais écrits de mémoire.
 */
export const ECRANS_CONNUS = [
  {
    cle: 'confiance',
    sonde: /Is this a project you created or one you trust\?/i,
    quoi: 'Claude Code demande si le dossier est de confiance',
    geste:
      'pré-approuve le lieu avant de faire naître — `approuverLieu(<lieu>)` écrit la confiance et ' +
      'les serveurs dans ~/.claude.json ; et vérifie que le fichier de droits du lieu ne porte pas ' +
      'de bloc `permissions.allow`, qui déclenche cet écran même une fois la confiance accordée ' +
      '(mesuré sur Claude Code 2.1.233).',
  },
  {
    cle: 'serveurs-mcp',
    sonde: /new MCP servers found in this project/i,
    quoi: 'Claude Code demande quels serveurs MCP activer',
    geste:
      'pré-approuve le lieu avec le jeu de clés COMPLET d\'une entrée de projet — `enabledMcpjsonServers` ' +
      'seul ne suffit plus : il lui faut au moins `disabledMcpjsonServers`, `allowedTools`, ' +
      '`projectOnboardingSeenCount` et les deux clés d\'inclusions externes (mesuré sur 2.1.233).',
  },
];

/**
 * LE TEXTE HORS DE LA BOÎTE DE SAISIE.
 *
 * ⚠️ SANS CETTE SOUSTRACTION, LE MODULE SE DÉCLENCHE SUR SON PROPRE SUJET. Les briefs de ce
 * dépôt CITENT ces écrans — celui qui a produit ce fichier en citait deux. Sonder le dump entier
 * ferait donc passer pour parqué tout agent à qui on parle de ces défauts, et le dispositif
 * censé rendre les blocages visibles fabriquerait des blocages imaginaires.
 *
 * On retire donc l'intérieur du dernier couple de filets — c'est-à-dire ce que l'utilisateur est
 * en train d'écrire — et on ne sonde que ce que la session AFFICHE.
 */
function horsBoite(lignes) {
  const filets = [];
  for (let i = 0; i < lignes.length; i += 1) if (FILET.test(lignes[i].trim())) filets.push(i);
  if (filets.length < 2) return { texte: lignes.join('\n'), boiteLisible: false };

  const bas = filets[filets.length - 1];
  const haut = filets[filets.length - 2];
  const dedans = lignes.slice(haut + 1, bas);
  // Une boîte ne se reconnaît qu'à son invite : deux filets qui encadrent autre chose ne sont
  // pas une boîte, et retirer leur contenu aveuglerait la sonde sur un écran quelconque.
  const boiteLisible = dedans.length > 0 && dedans[0].includes(INVITE);
  if (!boiteLisible) return { texte: lignes.join('\n'), boiteLisible: false };

  return { texte: [...lignes.slice(0, haut + 1), ...lignes.slice(bas)].join('\n'), boiteLisible: true };
}

/** Combien de lignes du bas on garde pour dire ce qu'on a vu. Un résumé, pas un dump. */
const LIGNES_DU_RESUME = 6;
const RESUME_MAX = 600;

/**
 * CE QU'ON A VU, quand on n'a pas su le nommer.
 *
 * On garde les dernières lignes porteuses : un modal s'affiche EN BAS de l'écran, et c'est la
 * partie que quelqu'un pourra reconnaître d'un coup d'œil. Les filets et le vide sont jetés —
 * ils ne disent rien et prendraient toute la place.
 */
function resumeDeLEcran(texte) {
  const lignes = texte
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() && !FILET.test(l.trim()));
  if (!lignes.length) return null;
  const resume = lignes.slice(-LIGNES_DU_RESUME).join('\n').trim();
  return resume.length > RESUME_MAX ? `${resume.slice(0, RESUME_MAX - 1)}…` : resume;
}

/**
 * L'ÉTAT D'UN ÉCRAN — le verdict, et il ne ment dans aucun des deux sens.
 *
 * @param {string|null|undefined} texteTerminal ce que `herdr agent read` a rendu
 * @returns {{pretARecevoir: boolean, ecran: string|null, quoi: string|null, inconnu: boolean,
 *            resume: string|null, geste: string|null}}
 *
 * L'ORDRE DE DÉCISION EST LE CŒUR, et il est gardé par un essai adversarial : on cherche un écran
 * CONNU avant de conclure que la boîte est prête. Chercher la boîte d'abord ferait passer pour
 * joignable un agent dont le modal est affiché PAR-DESSUS un écran qui en porte une — c'est-à-dire
 * la porte-sur-deux, réintroduite dans le module écrit pour la fermer.
 */
export function etatDeLEcran(texteTerminal) {
  const brut = sansGris(texteTerminal);

  // Rien à lire n'est pas « rien à signaler ». On n'a pas mesuré, donc on ne conclut pas —
  // et le sens sûr est celui qui fait s'arrêter.
  if (!brut || !brut.trim()) {
    return {
      pretARecevoir: false,
      ecran: null,
      quoi: null,
      inconnu: true,
      resume: '(écran illisible — rien n’a pu être lu)',
      geste: null,
    };
  }

  const { texte: affiche, boiteLisible } = horsBoite(brut.split('\n'));

  for (const ec of ECRANS_CONNUS) {
    if (ec.sonde.test(affiche)) {
      return {
        pretARecevoir: false,
        ecran: ec.cle,
        quoi: ec.quoi,
        inconnu: false,
        resume: resumeDeLEcran(affiche),
        geste: ec.geste,
      };
    }
  }

  if (boiteLisible) {
    return { pretARecevoir: true, ecran: null, quoi: null, inconnu: false, resume: null, geste: null };
  }

  // Aucun écran connu, et pas de boîte reconnaissable : on ne sait pas où on est. On le dit, on
  // montre ce qu'on a vu, et on ne propose RIEN — inventer un geste ici serait deviner.
  return {
    pretARecevoir: false,
    ecran: null,
    quoi: null,
    inconnu: true,
    resume: resumeDeLEcran(affiche),
    geste: null,
  };
}

/**
 * LA PHRASE À DIRE quand on refuse à cause d'un écran — un seul endroit qui la compose.
 *
 * Elle existe parce que le refus doit NOMMER : « statut blocked » sans dire ce qu'il y a devant
 * est exactement ce qui a laissé un agent parqué et injoignable pendant qu'on cherchait pourquoi.
 */
export function refusDEcran(etat, { cible = 'la session' } = {}) {
  if (etat.pretARecevoir) return null;
  if (etat.ecran) {
    return `${cible} est parquée devant un écran connu — ${etat.quoi}. Le geste qui le lève : ${etat.geste}`;
  }
  return (
    `${cible} est devant un écran que je ne reconnais pas — je m’arrête plutôt que de tenter ma chance. ` +
    `Voici ce que j’ai vu :\n${etat.resume}`
  );
}

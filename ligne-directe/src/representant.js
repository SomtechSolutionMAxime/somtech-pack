// representant.js — le lieu d'un représentant client, et ce qui lui est PROPRE.
//
// Le corps de la pose — les trois gardes, le point d'écriture unique, le retrait de ce qui a
// été commencé — vit désormais dans `lieu-agent.js`, commun aux deux rôles qui posent un lieu
// (voir `roles.js` pour le pourquoi). Ce fichier ne garde que ce qui ne vaut QUE pour un
// représentant : la joignabilité de son canal client, qui existe déjà et où un humain doit
// avoir invité notre robot.
//
// Ses exports d'origine sont conservés tels quels — ils sont importés ailleurs
// (`naissance-representant/src/lieu.js` et `naissance.js` lisent `GABARITS` d'ici plutôt que
// de le reproduire) et la commande les appelle. Les déplacer sans les réexporter aurait fait
// exactement ce que ce lot cherche à éviter : casser un mécanisme éprouvé en le rangeant.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { trouverCanal, estMembreDuCanal, trouverMembre } from './slack.js';
import { verifierLieuRenseigne } from './lieu-renseigne.js';
import { lireJeton, SERVICE_ROBOT, JetonIllisible, JetonVide } from './trousseau.js';
import { verifierLigneOuvrable } from './orchestrateur.js';
import {
  GABARITS,
  FICHIERS_ENV_CONNUS,
  etatSource as etatSourceDuRole,
  etatLieu as etatLieuDuRole,
  aFichierEnvironnement,
  retirerCeQuiAEteCommence as retirerDuRole,
  preparerLieu,
} from './lieu-agent.js';

export { GABARITS, FICHIERS_ENV_CONNUS, aFichierEnvironnement };

/** Ce que la source offre pour un représentant, fichier par fichier. */
export function etatSource(depotClient) {
  return etatSourceDuRole(depotClient, 'representant');
}

/** Ce que le lieu d'un client contient déjà, sans jamais y toucher. */
export function etatLieu(depotClient, client) {
  return etatLieuDuRole(depotClient, 'representant', client);
}

/** Retire ce qu'une pose interrompue avait commencé — le lieu de CE client, et rien d'autre. */
export function retirerCeQuiAEteCommence(depotClient, client) {
  return retirerDuRole(depotClient, 'representant', client);
}

/**
 * Le canal est-il joignable, RÉELLEMENT — pas « existe-t-il », mais « notre robot peut-il y
 * être lu » ? Deux réponses négatives distinctes, parce que le geste qui lève chacune n'est
 * pas le même : un canal absent se crée ou se corrige (faute de frappe) ; un canal dont on
 * n'est pas membre se règle par une invitation humaine, jamais par du code — un robot ne
 * rejoint pas un canal privé (mesuré : `conversations.join` n'aboutit sur aucun canal privé,
 * quel que soit le droit accordé). On ne tente donc jamais de le rejoindre ici.
 *
 * @param {string} jetonRobot
 * @param {string} nomCanal
 */
export async function verifierCanalJoignable(jetonRobot, nomCanal) {
  const canal = await trouverCanal(jetonRobot, nomCanal);
  // ⚠️ « ABSENT » EST CE QUE LE ROBOT VOIT, PAS CE QUI EST (T-20260806-0197). Mesuré en
  // production : Slack ne rend à un jeton de robot aucun canal privé dont il n'est pas membre.
  // Un canal privé du client où personne ne l'a encore invité — le cas le plus ordinaire — se
  // voit donc exactement comme un canal inexistant, et le refus envoyait le faire CRÉER.
  // On ne peut pas départager : le verdict porte les deux causes et les deux gestes, en faits.
  // Le motif reste `absent` — c'est la clé que les appelants lisent, et elle dit vrai du point
  // de vue du robot.
  if (!canal) {
    return {
      joignable: false,
      motif: 'absent',
      canal: nomCanal,
      causes: ['absent', 'prive_sans_robot'],
      gestes: ['corriger_ou_faire_creer', 'invitation_humaine'],
    };
  }

  const membre = await estMembreDuCanal(jetonRobot, canal);
  if (!membre) return { joignable: false, motif: 'non_membre', canal: nomCanal, id: canal.id };

  return { joignable: true, canal: nomCanal, id: canal.id, prive: Boolean(canal.is_private) };
}

/**
 * Le canal du client est-il ouvrable — POSTE COMPRIS ?
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CETTE FONCTION EXISTE POUR RÉPARER (T-20260813-0054, élargissement au représentant)
 *
 * La lecture du jeton se faisait DANS L'ARGUMENT de la vérification, à l'appel :
 *
 *     verifierJoignabilite: async () => verifierCanalJoignable(await lireJeton(SERVICE_ROBOT), canal)
 *
 * Rien n'entourait ce `await`. Quand le trousseau ne rendait pas la valeur, l'exception
 * TRAVERSAIT toute la pose et finissait au filet global du binaire. MESURÉ, et les trois
 * conséquences comptent :
 *
 *   1. AUCUN JSON n'était rendu — alors qu'un refus `gabarits_absents`, lui, en rend un. Qui
 *      appelle la commande par contrat ne recevait rien à lire ;
 *   2. le « rien n'a été créé » n'était jamais dit — vrai dans les faits, jamais écrit ;
 *   3. le message BRUT de `JetonManquant` sortait — celui qui propose
 *      `security add-generic-password`, c'est-à-dire le geste qui écrase un secret vivant.
 *
 * L'orchestrateur, lui, entourait déjà sa lecture (`verifierLigneOuvrable`). Une porte sur
 * deux, pour la septième fois sur ce dépôt.
 *
 * ON NE DUPLIQUE PAS LE RENVERSEMENT : `trousseau.js` décide déjà, pour les DEUX rôles, de ce
 * qui est une absence prouvée et de ce qui ne l'est pas. Ici on ne fait que RELAYER son
 * verdict — et le ranger du côté du POSTE, qui n'a rien à voir avec le canal.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */
export async function verifierCanalOuvrable({
  canal,
  lireJetonRobot = () => lireJeton(SERVICE_ROBOT),
  verifier = verifierCanalJoignable,
}) {
  let jetonRobot;
  try {
    jetonRobot = await lireJetonRobot();
  } catch (err) {
    return {
      joignable: false,
      portee: 'poste',
      motif: err instanceof JetonIllisible ? 'jeton_illisible' : err instanceof JetonVide ? 'jeton_vide' : 'jeton_absent',
      canal,
      message:
        `${err.message}\n` +
        `  Rien n'a été créé : le lieu du représentant n'est posé qu'une fois la ligne établie.\n` +
        `  ⚠️ Ce refus parle du POSTE, pas du canal « ${canal} ». N'y cherche rien, et n'y invite ` +
        `personne : le canal n'a même pas été consulté.`,
    };
  }
  // ⚠️ LA SECONDE MOITIÉ DU MÊME DÉFAUT — RELEVÉE EN REVUE (passe 2), ET C'EST « UNE PORTE SUR
  // DEUX » DANS LE CORRECTIF QUI PRÉTENDAIT LA FERMER.
  //
  // La lecture du jeton était entourée ; l'interrogation de Slack qui suit ne l'était pas.
  // `verifierCanalJoignable` appelle le service : un jeton révoqué (`invalid_auth`), une
  // limite de débit, un hoquet réseau — et l'exception traversait de nouveau toute la pose
  // jusqu'au filet global du binaire. Aucun JSON de contrat, le « rien n'a été créé » jamais
  // dit : exactement ce que ce fichier affirme trois paragraphes plus haut avoir réparé.
  //
  // Et le motif suit le MÊME renversement que le trousseau : on ne sait pas si le canal existe,
  // on ne sait pas si le robot en est membre. Dire l'un ou l'autre enverrait créer un canal qui
  // existe, ou faire inviter un robot déjà invité. On dit donc ce qu'on sait : rien.
  try {
    const j = await verifier(jetonRobot, canal);
    return j.joignable ? j : { ...j, portee: 'canal' };
  } catch (err) {
    return {
      joignable: false,
      portee: 'canal',
      motif: 'canal_illisible',
      canal,
      message:
        `Le canal « ${canal} » n'a pas pu être interrogé — on ne sait donc ni s'il existe, ni si ` +
        `notre robot en est membre.\n` +
        `  ⚠️ CE N'EST NI L'UN NI L'AUTRE. Ne le fais pas créer et ne fais inviter personne sur la ` +
        `foi de ce refus : les deux gestes porteraient à faux.\n` +
        `  Cause brute, telle que Slack ou le réseau l'a rendue : ${String(err?.message ?? err).slice(0, 200)}\n` +
        `  Rien n'a été créé : le lieu du représentant n'est posé qu'une fois la ligne établie.`,
    };
  }
}

/**
 * LES DEUX LIGNES D'UN GESTIONNAIRE PEUVENT-ELLES EXISTER ? (T-20260813-0076)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI LA VÉRIFICATION S'ÉLARGIT, ET POURQUOI ELLE NE SE DUPLIQUE PAS
 *
 * Un gestionnaire naît désormais avec DEUX lignes : celle de son client (canal privé qui
 * existe déjà) et celle du dirigeant (canal interne, qu'il crée à sa naissance). Trois
 * choses doivent donc être vraies avant qu'un seul fichier soit posé, et chacune se lève par
 * un geste HUMAIN DIFFÉRENT — c'est ce qui interdit de les confondre en un seul refus :
 *
 *   1. LE POSTE peut ouvrir une ligne — les deux jetons. Le geste qui le lève est sur le
 *      trousseau. C'est EXACTEMENT la question de l'orchestrateur, et on appelle donc SA
 *      fonction : un second contrôle écrit ici aurait divergé du sien au premier correctif —
 *      le dépôt a déjà payé ça (« deux sources qui disent la même chose divergent »).
 *   2. LE CANAL DU CLIENT est joignable — le geste est une invitation dans Slack.
 *   3. LE DIRIGEANT existe dans l'espace — le geste est de corriger le courriel.
 *
 * L'ORDRE N'EST PAS LIBRE : le poste d'abord, parce qu'un trousseau muet rend les deux
 * questions suivantes inconnaissables, et qu'un refus qui parle du canal alors que le
 * trousseau est verrouillé envoie chercher une invitation Slack pour une panne locale — le
 * défaut mesuré de T-20260813-0054, dans l'autre sens.
 *
 * ⚠️ ON RÉSOUT LE DIRIGEANT ICI PLUTÔT QUE DANS LA COMMANDE, et ce n'est pas un rangement :
 * `preparerLieu` n'appelle cette vérification qu'APRÈS avoir refusé sur ce qui ne dépend que
 * du disque (gabarits absents). Un dépôt qui n'a pas reçu le pack ne paie donc AUCUN
 * aller-retour réseau — ce qui serait tombé si la commande avait résolu le courriel avant.
 */
export async function verifierLignesDuRepresentant({
  canal,
  courrielDirigeant,
  lireJetonRobot = () => lireJeton(SERVICE_ROBOT),
  verifierPoste = verifierLigneOuvrable,
  verifier = verifierCanalJoignable,
  chercherMembre = trouverMembre,
}) {
  // 1. LE POSTE. Sa ligne vers le dirigeant, il la CRÉE — il lui faut donc de quoi parler ET
  // de quoi entendre, comme un orchestrateur. Le contrôle d'avant ce lot ne lisait que le
  // jeton du robot : un gestionnaire pouvait naître capable de parler à son client et sourd à
  // son dirigeant, ce qui est précisément la panne que ce lot existe pour fermer.
  const poste = await verifierPoste();
  if (!poste.joignable) return { ...poste, portee: 'poste' };

  const canalOuvrable = await verifierCanalOuvrable({ canal, lireJetonRobot, verifier });
  if (!canalOuvrable.joignable) return canalOuvrable;

  // 3. LE DIRIGEANT. Un courriel qui ne désigne personne ne se rattrape pas plus tard : la
  // ligne s'ouvrirait sans aucun autorisé, donc refuserait la parole à tout le monde — au
  // dirigeant le premier. Et elle en aurait l'air ouverte.
  let jetonRobot;
  let id;
  try {
    jetonRobot = await lireJetonRobot();
    id = await chercherMembre(jetonRobot, courrielDirigeant);
  } catch (err) {
    // MÊME RENVERSEMENT QUE PARTOUT AILLEURS : on ne conclut rien de ce qu'on n'a pas su
    // mesurer. Une interrogation qui échoue ne dit PAS que le dirigeant est absent — et le
    // dire enverrait corriger une adresse parfaitement juste.
    return {
      joignable: false,
      portee: 'poste',
      motif: 'dirigeant_illisible',
      canal,
      message:
        `L'espace n'a pas pu être interrogé au sujet de « ${courrielDirigeant} » — on ne sait donc ` +
        `pas si ce dirigeant existe.\n` +
        `  ⚠️ N'en conclus RIEN : ne corrige pas l'adresse sur la foi de ce refus.\n` +
        `  Cause brute, telle que Slack ou le réseau l'a rendue : ${String(err?.message ?? err).slice(0, 200)}\n` +
        `  Rien n'a été créé : le lieu du représentant n'est posé qu'une fois les deux lignes établies.`,
    };
  }
  if (!id) {
    return {
      joignable: false,
      portee: 'dirigeant',
      motif: 'dirigeant_inconnu',
      canal,
      message:
        `aucun membre de cet espace ne répond au courriel « ${courrielDirigeant} » — le lieu n'est pas posé.\n` +
        `  ⚠️ Ce refus ne parle NI du canal « ${canal} », NI du trousseau : les deux ont été vérifiés ` +
        `et vont bien. N'y touche pas.\n` +
        `  Sans lui, la ligne du gestionnaire vers le dirigeant s'ouvrirait sans aucun autorisé : ` +
        `elle refuserait sa parole, à lui, en silence. Corrige le courriel, puis relance.`,
    };
  }

  return { ...canalOuvrable, dirigeant: { id, courriel: courrielDirigeant } };
}

/**
 * Le message de refus D'UN CANAL, écrit pour être lu et suivi — jamais pour être analysé par
 * un test.
 *
 * ⚠️ IL N'A PLUS DE CAS PAR DÉFAUT, et c'est le même renversement qu'au trousseau. Le `return`
 * final valait « fais inviter le robot » : tout motif qui n'était pas `absent` recevait donc
 * ce conseil, y compris un refus du poste égaré ici. Un humain aurait cherché une invitation
 * Slack pendant que son trousseau restait verrouillé.
 */
export function messageDeRefus(joignabilite) {
  if (joignabilite.motif === 'absent') {
    // LE TEXTE SE CONSTRUIT DEPUIS LES GESTES DU VERDICT, pas en dur : un geste retiré du verdict
    // disparaît du texte, et les deux ne peuvent pas diverger en silence (T-20260806-0197). Un
    // verdict qui n'en porte pas — un appelant d'avant — reçoit les deux, parce qu'un canal
    // introuvable par le robot peut toujours être un canal privé où il n'est pas invité.
    const gestes = joignabilite.gestes ?? ['corriger_ou_faire_creer', 'invitation_humaine'];
    const c = joignabilite.canal;
    const phrases = [];
    if (gestes.includes('corriger_ou_faire_creer')) {
      phrases.push(`s'il n'existe pas, vérifie le nom, ou fais-le créer par un humain`);
    }
    if (gestes.includes('invitation_humaine')) {
      phrases.push(
        `s'il existe en canal privé, notre robot n'y a pas été invité — Slack ne lui montre aucun canal ` +
          `privé dont il n'est pas membre : fais-le inviter à la main dans Slack ("/invite" depuis le canal)`
      );
    }
    if (!phrases.length) return `le canal « ${c} » est introuvable par notre robot, et ce verdict ne porte aucun geste.`;
    return (
      `le canal « ${c} » est introuvable par notre robot — ${phrases.length > 1 ? 'deux causes possibles, indiscernables de son côté : ' : ''}` +
      `${phrases.join(' ; ')}, puis relance.`
    );
  }
  if (joignabilite.motif === 'non_membre') {
    return (
      `notre robot n'est pas membre de « ${joignabilite.canal} » et ne peut pas s'y mettre ` +
      `lui-même — fais-le inviter à la main dans Slack ("/invite" depuis le canal), puis relance.`
    );
  }
  return (
    joignabilite.message ||
    `le canal « ${joignabilite.canal} » n'est pas joignable, et le motif rendu (« ` +
      `${joignabilite.motif ?? '—'} ») n'est pas un motif de canal — ne fais rien du côté de ` +
      `Slack sur la foi de ce refus.`
  );
}

/**
 * Prépare le lieu du représentant dans le dépôt du client.
 *
 * @param {object} p
 * @param {string} p.depotClient        racine du dépôt du client (celui qui reçoit le lieu)
 * @param {string} p.client             nom du client — dossier sous `.gestionnaire/`
 * @param {string} p.canal              nom du canal — message de refus, et inscrit (sans croisillon)
 *                                      dans CONTEXTE.md quand la pose le crée
 * @param {string} [p.titre]            titre de la ligne — inscrit s'il est fourni ; son absence est
 *                                      nommée dans `avertissements`
 * @param {() => Promise<{joignable: boolean, motif?: string}>} p.verifierJoignabilite
 */
export async function preparerLieuRepresentant({ depotClient, client, canal, titre, verifierJoignabilite, verifierVersionnable }) {
  const r = await preparerLieu({
    depot: depotClient,
    role: 'representant',
    nom: client,
    verifierVersionnable,
    // Le motif et le message restent formés ICI : ils parlent d'un canal client, que le
    // module commun ne connaît pas et n'a pas à connaître.
    verifierLigne: async () => {
      const j = await verifierJoignabilite();
      if (j.joignable) return j;
      // UN REFUS QUI PORTE DÉJÀ SON MESSAGE N'EST PAS RÉÉCRIT, et la liste ne se devine pas :
      // le réécrire l'aurait traduit en conseil de canal — « fais inviter le robot » — pour une
      // panne de trousseau, ou pour un courriel de dirigeant mal orthographié.
      //
      // ⚠️ ON TESTE CE QUI EST DU CANAL, PAS CE QUI NE L'EST PAS. La version d'avant listait
      // les portées à laisser passer (`=== 'poste'`) : chaque portée AJOUTÉE ensuite retombait
      // par défaut du côté qui réécrit — c'est « une porte sur deux », par la porte qu'on
      // n'avait pas encore ouverte. `dirigeant` est arrivé et serait tombé dedans.
      if (j.portee && j.portee !== 'canal') return j;
      return { ...j, portee: 'canal', canal, message: messageDeRefus({ ...j, canal }) };
    },
  });

  // ═══ CE QUE LA POSE TIENT, ELLE L'INSCRIT (T-20260809-0024) — et seulement quand elle CRÉE.
  //
  // Le défaut mesuré : la pose recevait le canal, le prouvait joignable contre Slack, puis le
  // jetait. Le `CONTEXTE.md` posé restait le gabarit à l'octet, et la naissance le refusait
  // ensuite pour une rubrique que la commande avait eue entre les mains.
  //
  // ⚠️ `r.cree` ET RIEN D'AUTRE. Un lieu déjà là (`deja_installe`) ou partiel n'est jamais
  // réécrit : `CONTEXTE.md` appartient à qui l'a rempli (RA-REL-014), et seule la pose qui vient
  // de le déposer sait qu'il n'y a encore rien de personne dedans.
  if (!r.ok || !r.cree) return r;

  const chemin = join(r.racine, 'CONTEXTE.md');
  const tenu = [
    { libelle: 'Le client', valeur: client },
    { libelle: 'Le canal où tu lui parles', valeur: String(canal ?? '').replace(/^#+/, '') },
  ];
  if (typeof titre === 'string' && titre.trim()) tenu.push({ libelle: 'Le titre de ta ligne', valeur: titre });

  const avertissements = [...(r.avertissements ?? [])];
  try {
    const { texte, introuvables } = inscrireRubriques(readFileSync(chemin, 'utf8'), tenu);
    writeFileSync(chemin, texte);
    // Une rubrique que le gabarit ne porte plus ne s'invente pas — mais elle se DIT : sinon la
    // valeur tenue serait jetée en silence, le défaut même que ce bloc ferme.
    for (const libelle of introuvables) {
      avertissements.push(
        `${chemin} : la rubrique « ${libelle} » est introuvable au gabarit — la valeur tenue par la pose ` +
          `n'a pas pu y être inscrite. Écris-la à la main.`
      );
    }
  } catch (err) {
    // La promesse de la pose vaut pour ce geste-ci : un lieu à demi écrit ne survit pas.
    retirerCeQuiAEteCommence(depotClient, client);
    return {
      ok: false,
      cree: false,
      role: r.role,
      nom: r.nom,
      refus: {
        motif: 'ecriture_interrompue',
        racine: r.racine,
        message:
          `l'inscription de ce que la pose tient dans « ${chemin} » s'est interrompue (${err.message}) — ` +
          `le lieu qui venait d'être posé a été retiré, rien ne subsiste. Corrige la cause, puis relance.`,
      },
    };
  }

  // ═══ CE QUI MANQUE AVANT QU'IL PUISSE NAÎTRE — mesuré par la MÊME garde que la naissance.
  //
  // Le rendu disait `avertissements: []` sur un lieu que la naissance allait refuser. On
  // n'écrit pas un second jugement : on appelle celui de la naissance (`lieu-renseigne.js`),
  // sur le lieu posé. Une mesure impossible (`verifie: false`) ne dit rien — même règle que là-bas.
  const verdict = verifierLieuRenseigne({ gabaritDir: etatSource(depotClient).source, racine: r.racine });
  if (verdict.renseigne === false) {
    const lignes = [`${r.racine} : ce lieu ne peut pas encore naître — la naissance refusera tant que ceci n'est pas renseigné :`];
    const sansTitre = !tenu.some((x) => x.libelle === 'Le titre de ta ligne');
    for (const m of verdict.manquant) {
      if (m.vide) { lignes.push(`  ${m.fichier} — vide.`); continue; }
      lignes.push(`  ${m.fichier} — ${m.rubriques.length} rubrique(s) :`);
      for (const rub of m.rubriques) lignes.push(`      ${rub}`);
    }
    if (sansTitre) {
      lignes.push(`  Le titre de la ligne n'a pas été fourni : relance une pose neuve avec --titre, ou écris-le dans CONTEXTE.md.`);
    }
    avertissements.push(lignes.join('\n'));
  }

  return { ...r, avertissements };
}

/**
 * Inscrit chaque valeur à la place du chevron de SA rubrique — la ligne de tableau dont la
 * première cellule porte le libellé. Rien d'autre du texte ne bouge.
 *
 * ⚠️ ON ANCRE SUR LE LIBELLÉ, PAS SUR LE TEXTE DU CHEVRON. Le chevron est une consigne qui se
 * reformule ; le libellé est ce que le représentant lit. Un libellé introuvable est RENDU, jamais
 * deviné.
 *
 * La valeur est aplatie pour tenir dans une cellule : fin de ligne → espace, `|` échappé, accent
 * grave remplacé — sinon elle casserait le tableau ou le code qui l'entoure.
 */
function inscrireRubriques(texte, tenu) {
  const lignes = texte.split('\n');
  const introuvables = [];
  for (const { libelle, valeur } of tenu) {
    const i = lignes.findIndex(
      (l) => l.startsWith('|') && l.split('|')[1]?.replace(/\*/g, '').trim() === libelle && /<[^<>\n]+>/.test(l)
    );
    if (i < 0) { introuvables.push(libelle); continue; }
    const propre = String(valeur).replace(/[\r\n]+/g, ' ').replace(/`/g, "'").replace(/\|/g, '\\|').trim();
    lignes[i] = lignes[i].replace(/<[^<>\n]+>/, () => propre);
  }
  return { texte: lignes.join('\n'), introuvables };
}

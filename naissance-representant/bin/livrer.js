#!/usr/bin/env node
// livrer.js — livrer un brief à une session déjà née, et PROUVER qu'elle l'a pris.
//
//   gestionnaire-livrer <pane|nom-d-agent> --brief <fichier>
//   gestionnaire-livrer <pane|nom-d-agent> --texte "…"
//
// C'EST AUSSI LA VOIE POUR PARLER À UN AGENT DÉJÀ NÉ (T-20260814-0138) — transmettre à un pair,
// relancer quelqu'un, rendre compte à son coordonnateur. Ces gestes se faisaient par
// `herdr agent prompt` nu, qui rend un succès même quand le message reste dans la boîte de
// saisie sans être soumis. Un compte rendu perdu de cette façon est muet des deux côtés :
// l'expéditeur a son accusé, le destinataire reste `idle`, et rien ne les détrompe.
//
// Le destinataire se désigne par son PANE ou par son NOM, et il est cherché DANS TOUTES LES
// SESSIONS du poste — onze y tournent, et le cas normal est qu'il ne soit pas dans la sienne.
//
// Le brief se passe par FICHIER de préférence : un retour à la ligne tapé dans un terminal
// soumet le message et le coupe en deux (/orchestrer-chantier §4a). Le fichier est lu ici et
// livré d'un seul tenant.
//
// POURQUOI CETTE COMMANDE EXISTE (T-20260809-0033)
// `herdr agent prompt` rend un succès que le brief soit pris ou non — et, mesuré contre le
// vrai service, écrire dans une boîte qui contient déjà quelque chose livre UN message : les
// deux textes collés. Le détail de ce qui a été mesuré est en tête de `src/livraison.js`.
//
// Cette commande ne corrige pas herdr (règle d'or n°7 : ce dépôt n'est pas le sien). Elle
// refuse de livrer dans une boîte qu'elle n'a pas trouvée vide, elle relit pour savoir si le
// brief a été pris, elle répare une fois le cas connu, et elle échoue bruyamment sinon.
//
// ET ELLE DÉLIVRE UNE BOÎTE BLOQUÉE — SANS JAMAIS L'ÉCRASER (T-20260816-0114).
// Une boîte laissée pleine affamait TOUS les émetteurs suivants, et seul le destinataire
// pouvait la libérer : c'est-à-dire le seul qui ne sait pas qu'elle bloque. Quatre occurrences
// en quatre rondes, et une fois sur trois l'auteur du texte coincé était déjà MORT.
// Elle attend donc, relit, et si le texte n'a pas bougé elle le SOUMET pour son auteur — la
// touche d'envoi seule, sans écrire un caractère. Si le texte a bougé, quelqu'un est devant ce
// pane : elle n'y touche pas. Si rien ne libère la boîte, le refus reste celui d'avant.
// Le détail, et ce que le geste coûte, sont en tête de `src/livraison.js`.

import { readFileSync } from 'node:fs';
import { livrerBrief, FENETRE_ENTRE_AGENTS_MS } from '../src/livraison.js';
import { appelHerdr, lireEcran } from '../src/appel-herdr.js';
import { trouverDestinataire } from '../src/destinataire.js';

// ⚠️ LA BORNE DE L'ATTENTE D'INSCRIPTION, ET ELLE EST POSÉE AVANT LE RÉSULTAT (T-20260819-0036).
//
// Une session qui vient de naître est INSCRITE AU REGISTRE AVANT DE L'ÊTRE COMPLÈTEMENT : elle y
// répond avec le statut `unknown` puis bascule à `idle`.
//
// ⚠️ LA POPULATION, EXACTEMENT, ET ELLE A ÉTÉ CORRIGÉE EN BAISSE AVANT D'ÊTRE ÉLARGIE. La
// première rédaction disait « 1,5 fois la plus grande de DEUX mesures ». L'une des deux n'en
// était pas une : le ~30 s de l'occurrence vécue de `w26:p46` venait d'un `sleep 8` suivi d'un
// seul relevé — une ESTIMATION à la main, présentée comme un chiffre, et c'est son auteur qui
// l'a retirée. La borne reposait donc sur UNE mesure et UNE approximation.
//
// TROIS MESURES RÉELLES ONT ÉTÉ PRISES LE 2026-09-20, par sonde en lecture seule à la seconde,
// sur DEUX chemins de naissance distincts :
//
//   `herdr pane run … "claude"`   →  fenêtre 2,3 s → 5,8 s   (3,5 s)
//   `herdr pane run … "claude"`   →  fenêtre 2,5 s → 5,8 s   (3,3 s)
//   `herdr agent start …`         →  fenêtre 1,2 s → 4,9 s   (3,7 s)
//
// 45 000 ms vaut donc ~12 fois la plus grande MESURE. Le chiffre n'a pas été rabaissé sur ces
// trois-là, et c'est délibéré : une borne se pose AVANT le résultat, et la rétrécir pour qu'elle
// épouse les données qu'on vient d'obtenir revient à la poser après. Elle couvre en outre la
// dizaine de secondes que l'estimation suggérait sans la prouver. Une borne trop large ne coûte
// qu'un refus retardé dans un cas pathologique ; une borne trop courte refuse à tort.
//
// ⚠️ ET LA TROISIÈME MESURE APPORTE UN FAIT QUE LES DEUX AUTRES NE DONNAIENT PAS : née par
// `herdr agent start`, la session PORTE DÉJÀ SON NOM pendant toute la fenêtre. Le discriminant
// ne peut donc pas être l'absence de nom — c'est `unknown`, et c'est maintenant mesuré sur les
// deux chemins, plus seulement argumenté.
//
// Si la fenêtre se révélait plus longue ailleurs, la borne MORD ET LE DIT — ce qu'un refus
// faisait déjà, en mentant sur la cause.
//
// ⚠️ ET ELLE EXISTE PARCE QU'UNE ATTENTE NON BORNÉE EST UNE PENDAISON. Le dispositif a déjà payé
// ce mode de panne sur la ronde : « une ronde qui pend n'en rate pas une, elle les ANNULE
// TOUTES ». Une attente sans borne ici ferait la même chose à son appelant, en silence.
const ENREGISTREMENT_BORNE_MS = Number(process.env.ENREGISTREMENT_BORNE_MS || 45000);
const ENREGISTREMENT_PAS_MS = Number(process.env.ENREGISTREMENT_PAS_MS || 1000);

const ESSAIS = Number(process.env.LIVRAISON_ESSAIS || 15);
const DELAI_MS = Number(process.env.LIVRAISON_DELAI_MS || 2000);
const ATTENTE_MS = Number(process.env.LIVRAISON_ATTENTE_MS || 20000);
// ⚠️ LE TEMPS LAISSÉ À UN TEXTE **TAPÉ** POUR BOUGER — six secondes (T-20260818-0076).
//
// C'ÉTAIT CINQ MINUTES, ET C'EST CE QUI A RENDU LE CRITÈRE ROUGE. Le chiffre venait de
// `IMMOBILITE_PAR_DEFAUT_MS`, réglé quand ce chemin était le seul ; le chemin de la parole du
// dirigeant est ensuite passé à dix secondes, et le lot qui l'a fait a annoncé « dix secondes »
// sans dire lequel des deux. Mesuré sur le poste : 300 secondes ici, pour un critère qui en
// demande moins de quinze. **Deux réglages qu'on ne voit jamais ensemble, ce sont deux
// comportements dont un seul est annoncé** — ils vivent maintenant côte à côte dans
// `delivrance.js`, auprès du geste qu'ils règlent, nommés par le chemin qu'ils servent. Celui-ci
// vaut six secondes parce que le critère du jalon borne ce chemin-ci de bout en bout ; la ligne
// du dirigeant garde les siennes, elle n'a pas ce budget.
//
// ⚠️ ELLE NE VAUT QUE POUR UN TEXTE TAPÉ. Devant un COLLAGE, `livrerBrief` n'attend rien : le
// texte est arrivé d'un seul coup, personne n'a les doigts dessus, et il n'y a rien à observer.
//
// ⚠️ CE RÉGLAGE RESTE LE PRIX D'UN GESTE IRRÉVERSIBLE — le baisser à zéro désarme l'observation
// du texte tapé. Ce qui protège n'est pas sa longueur seule : `delivrerLaBoite` relit avant de
// soumettre et s'abstient devant un texte qui a bougé, un dialogue, un écran illisible.
const IMMOBILITE_MS = Number(process.env.LIVRAISON_IMMOBILITE_MS || FENETRE_ENTRE_AGENTS_MS);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function usage(code) {
  process.stderr.write('gestionnaire-livrer <pane|nom-d-agent> (--brief <fichier> | --texte "…") [--en-attente]\n');
  process.exit(code);
}

function option(args, nom) {
  const i = args.indexOf(nom);
  return i === -1 ? null : args[i + 1] ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const cible = args[0];
  const fichier = option(args, '--brief');
  const direct = option(args, '--texte');
  // `--en-attente` : exiger un destinataire qui N'EST PAS en train de travailler. C'est la
  // garde du brief de NAISSANCE, où « la session a quitté l'attente » est la preuve de prise.
  // Elle n'est plus le défaut : un pair est occupé la plupart du temps, et l'exiger revenait à
  // n'avoir aucune voie vérifiée pour lui parler (voir `briefEstPris`, qui change de témoin).
  const enAttente = args.includes('--en-attente');
  if (!cible || cible.startsWith('--') || (!fichier && !direct)) usage(1);

  let texte;
  try {
    texte = fichier ? readFileSync(fichier, 'utf8') : direct;
  } catch (err) {
    process.stderr.write(`brief illisible (${fichier}) : ${err.message}\n`);
    process.exit(1);
  }
  texte = String(texte).trim();
  if (!texte) {
    process.stderr.write('un brief vide n’est pas un brief\n');
    process.exit(1);
  }

  // OÙ VIT LE DESTINATAIRE — sa session, et son pane si on l'a désigné par son nom.
  let ou = await trouverDestinataire(cible);
  if (!ou.ok) {
    process.stderr.write(`${ou.message}\n`);
    process.exit(1);
  }

  // ⚠️ L'ATTENTE DE FIN D'INSCRIPTION — BORNÉE, ET DITE (T-20260819-0036).
  //
  // C'EST ICI QUE LE CÂBLAGE SE FAIT, ET C'EST ICI QU'IL MANQUAIT. `trouverDestinataire` sait
  // désormais reconnaître le troisième état ; sans ces lignes, ce drapeau serait rendu et jamais
  // consulté — exactement la survivante que ce même binaire a déjà payée sur `parLePane`
  // (`tests/livrer-malgre-le-registre.test.js`, survivante M7 : le module savait basculer ses
  // verbes, la recherche savait trouver le pane, et personne ne vérifiait que les deux se
  // parlaient). Une garde qui remonte une information que personne ne lit ne garde rien.
  //
  // ⚠️ ET ELLE PARLE. Une attente muette et une commande figée produisent le même silence — le
  // motif que tout ce jalon combat. Chaque tour le dit, avec le temps écoulé et la borne.
  if (ou.enregistrementEnCours) {
    const debut = Date.now();
    while (ou.ok && ou.enregistrementEnCours && Date.now() - debut < ENREGISTREMENT_BORNE_MS) {
      const ecoule = Math.round((Date.now() - debut) / 1000);
      process.stderr.write(
        `« ${cible} » est EN COURS D’INSCRIPTION au registre herdr (statut « unknown ») — ` +
          `j’attends la fin, ${ecoule} s écoulées, borne ${ENREGISTREMENT_BORNE_MS} ms.\n`
      );
      await dormir(ENREGISTREMENT_PAS_MS);
      ou = await trouverDestinataire(cible);
    }
    if (!ou.ok) {
      // L'agent a disparu pendant l'attente — son refus à lui est plus précis que le nôtre.
      process.stderr.write(`${ou.message}\n`);
      process.exit(1);
    }
    if (ou.enregistrementEnCours) {
      // ⚠️ ON NE LIVRE PAS À L'AVEUGLE À LA BORNE. Pendant l'inscription, la famille `agent …`
      // n'est pas prouvée servie, et le témoin de prise (`briefEstPris`) repose dessus : livrer
      // ici rendrait un verdict qu'on ne sait pas lire. Le refus, lui, dit ce qu'il a vu et
      // combien de temps il a regardé — c'est ce qui manquait.
      // ⚠️ « BORNE ATTEINTE » N'APPARTIENT QU'À CE REFUS, et ce n'est pas décoratif. L'annonce
      // de la boucle ci-dessus porte déjà le chiffre de la borne : une garde qui cherchait
      // seulement ce chiffre dans la sortie se contentait de l'annonce, et DEUX mutations ont
      // survécu là-dessous — dont « la borne ne mord plus, on livre à l'aveugle ». Un refus qui
      // ne porte aucun mot à lui n'est pas gardable.
      process.stderr.write(
        `BORNE ATTEINTE — « ${cible} » est resté EN COURS D’INSCRIPTION au registre pendant toute ` +
          `la borne de ${ENREGISTREMENT_BORNE_MS} ms (statut « unknown », jamais passé à « idle »). Rien n’a ` +
          'été écrit. Ce n’est pas « ce pane n’existe pas » : le registre le connaît. Va voir son ' +
          `écran (\`herdr pane read ${ou.pane}\`) — une inscription qui ne finit pas est un ` +
          'défaut de herdr, pas une faute de frappe.\n'
      );
      process.exit(1);
    }
  }

  const pane = ou.pane;

  const resultat = await livrerBrief({
    pane,
    texte,
    socket: ou.socket,
    // Le repli par pane se propage jusqu'aux VERBES : `trouverDestinataire` a trouvé ce pane
    // là où le registre n'avait personne, et `agent read`/`agent prompt` lui sont fermés.
    // Sans cette ligne, la recherche aboutirait et la remise échouerait au dernier mètre.
    parLePane: Boolean(ou.parLePane),
    // ⚠️ ON NE PASSE PAS `enregistrementEnCours` ICI, ET C'EST MESURÉ, PAS OUBLIÉ. La boucle
    // ci-dessus ne rend la main que quand le drapeau est retombé — ce qui reste possible est
    // une bascule entre le dernier relevé et cette ligne, que RIEN ne peut éprouver. Le passer
    // quand même était du code mort : une mutation le remplaçant par `false` a survécu à la
    // suite entière (M14). On ne garde pas une ligne dont on ne sait pas écrire la garde ; on
    // la garde LÀ OÙ ELLE EST ATTEIGNABLE — chez le second appelant, la ronde, qui n'attend
    // pas (`bin/rendez-vous.js`, gardé bout en bout).
    pairOccupe: !enAttente,
    // ⚠️ LA DÉLIVRANCE NE VAUT QUE POUR UN AGENT DÉJÀ NÉ. `--en-attente` est la garde du brief
    // de naissance : la session attend, et sa boîte ne devrait rien porter. Si elle porte
    // quelque chose, c'est un état qu'on ne sait pas expliquer — on ne pose pas un geste
    // irréversible dessus.
    immobiliteMs: enAttente ? 0 : IMMOBILITE_MS,
    appelHerdr,
    lireEcran,
    dormir,
    essais: ESSAIS,
    delaiMs: DELAI_MS,
    attenteMs: ATTENTE_MS,
  });

  if (!resultat.ok) {
    process.stderr.write(`${resultat.message}\n`);
    // ⚠️ LE REFUS AUSSI REND SON ÉTAT, ET C'EST LA MOITIÉ QUI EN A LE PLUS BESOIN
    // (relevé par une passe de mutation, E-20260819-0015).
    //
    // C'est au refus que le lecteur doute : il vient de s'entendre dire « je n'écris pas », il a
    // l'écran devant les yeux, et sans l'état nommé il n'a rien pour trancher entre « l'outil se
    // trompe » et « il a vu quelque chose que je ne sais pas lire ». Six heures ont été perdues
    // exactement là. Le message reste sur `stderr` — la sortie lisible ne change pas —, et
    // `stdout` porte le même objet que le succès, avec `ok: false`.
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        pane,
        agent: ou.nom,
        message: resultat.message,
        statut: resultat.statut,
        delivre: Boolean(resultat.delivre),
        causeDelivre: resultat.causeDelivre,
        boite: resultat.boite ?? null,
        // `cause` et `gestes` — POURQUOI ON REND LA MAIN, ET CE QUI A DÉJÀ ÉTÉ POSÉ (T-20260818-0003).
        // Un budget épuisé n'est pas un obstacle vu : sans le champ, l'appelant ne lirait qu'une
        // prose à trier par mots, et ne saurait pas qu'un brief a peut-être déjà été écrit.
        cause: resultat.cause ?? null,
        gestes: resultat.gestes ?? [],
      })}\n`
    );
    process.exit(1);
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      pane,
      agent: ou.nom,
      caracteres: texte.length,
      statut: resultat.statut,
      repare: resultat.repare,
      // `causeRepare` — POURQUOI `repare` VAUT ÇA (T-20260818-0031, critère 3).
      //
      // ⚠️ CETTE LIGNE EST LA SECONDE PORTE, ET C'EST ELLE QUI DÉCIDE SI LE CORRECTIF SERT.
      // `livraison.js` peut très bien calculer le motif : s'il ne franchit pas ce JSON,
      // l'appelant — un agent, un orchestrateur, un script — lit le même `repare: false` muet
      // qu'avant, sur un code pourtant « corrigé ». C'est « une porte sur deux », le motif le
      // plus cher de ce dépôt, et il a déjà été commis deux fois DANS le correctif écrit pour
      // le fermer. Le banc `livrer-bin.test.js` lit donc cette sortie-ci, pas la fonction.
      //
      // Mesuré le 2026-08-18 : `{"ok":true,"statut":"done","repare":false,"delivre":false,
      // "attendu":false}` — trois faux, aucun mot, et personne pour savoir lequel était un
      // problème. Les valeurs sont nommées dans `CAUSES_REPARATION`.
      causeRepare: resultat.causeRepare,
      // `delivre` — LA BOÎTE ÉTAIT BLOQUÉE PAR LE TEXTE D'UN AUTRE, et on l'a soumis pour lui
      // (T-20260816-0114). C'est un fait qui doit remonter : il dit que le destinataire vient de
      // recevoir DEUX messages, dont un qui attendait peut-être depuis longtemps.
      delivre: Boolean(resultat.delivre),
      // `causeDelivre` — même exigence pour l'autre booléen à faux par défaut. Sa valeur vient
      // de `delivrerLaBoite`, qui la nomme déjà sur neuf branches (`bouge`, `dialogue`,
      // `sans-effet`…) ; elle mourait dans la fonction qui la produit. `non-tentee` quand la
      // boîte n'était pas encombrée ou que le geste était désarmé — la distinction entre
      // « je n'ai pas eu à délivrer » et « j'ai essayé et je n'ai pas pu ».
      causeDelivre: resultat.causeDelivre,
      // `attendu` — CE QUE HERDR A RAPPORTÉ DE SON CÔTÉ, jamais la preuve (T-20260815-0007).
      // Son sens dépend du destinataire : sur une session en attente, c'est une transition
      // observée ; sur un pair qui travaille déjà, on ne demande plus cette attente-là, et ce
      // champ ne dit plus que « l'appel a été accepté ». Dans les deux cas, ce qui tranche est
      // la relecture, pas lui.
      attendu: resultat.attendu,
      // `boite` — CE QUE LA BOÎTE PORTAIT **AVANT** QU'ON ÉCRIVE, nommé (E-20260819-0015).
      //
      // 🔴 SIX HEURES PERDUES LE 2026-08-19 FAUTE DE CE MOT. Deux orchestrateurs ont cru des
      // boîtes bloquées alors qu'elles portaient une SUGGESTION grisée — un texte que Claude
      // Code propose et que rien, dans un dump sans attributs, ne distingue d'un texte saisi.
      // Cette commande, elle, ne s'y trompait pas : elle lit en `--format ansi` et livrait
      // normalement. **Mais elle ne le DISAIT pas** — et un outil qui a raison en silence ne
      // détrompe personne, surtout pas quelqu'un qui a l'écran devant les yeux.
      //
      // ⚠️ C'EST LA SECONDE PORTE, comme `causeRepare` et `causeDelivre` avant elle. `livraison.js`
      // peut nommer l'état parfaitement : s'il ne franchit pas ce JSON, l'appelant lit la même
      // sortie muette qu'avant. « Une porte sur deux » est le motif le plus cher de ce dépôt, et
      // il a déjà été commis DANS le correctif écrit pour le fermer.
      boite: resultat.boite ?? null,
    })}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});

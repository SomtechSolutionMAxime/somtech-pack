#!/usr/bin/env node
// ligne-directe — la commande que tape un agent.
//
//   ligne-directe ouvrir <chantier> [--sujet "..."] [--inviter courriel]
//   ligne-directe dire "..."
//   ligne-directe demander "..."
//   ligne-directe fermer [--bilan "..."] [--sans-archiver]
//   ligne-directe representant <client> --canal <canal> [--depot <chemin>]
//   ligne-directe orchestrateur <nom> [--depot <chemin>]
//   ligne-directe etat
//   ligne-directe veilleur          (démarre le veilleur au premier plan, pour l'observer)
//
// Le chantier n'est demandé qu'à l'ouverture : ensuite, la commande retrouve la ligne
// par le pane depuis lequel elle est invoquée. Un agent n'a donc rien à retenir.

import { parler, passerLaMain } from '../src/client.js';
import { ligneDuPane, REFUS_SELECTION } from '../src/registre.js';
import { option, optionDonnee, optionsRepetees, premierLibre } from '../src/arguments.js';
import * as herdr from '../src/herdr.js';
import { trouverMembre } from '../src/slack.js';
import { resoudreAutorises } from '../src/canal-commun.js';
import { rolesConnus } from '../src/roles.js';
import { lireJeton, SERVICE_ROBOT } from '../src/trousseau.js';
import {
  preparerLieuRepresentant,
  verifierLignesDuRepresentant,
  retirerCeQuiAEteCommence,
} from '../src/representant.js';
import { preparerLieuOrchestrateur } from '../src/orchestrateur.js';

function usage(code = 0) {
  process.stdout.write(`ligne-directe — ouvrir une ligne de discussion avec le dirigeant

  ouvrir <chantier> [--titre "..."] [--sujet "..."] [--inviter courriel] [--nature client]
                    [--jetable]                            --jetable : le canal de cette ligne peut
                                                           etre ARCHIVE quand elle se referme. Sans
                                                           ce drapeau la ligne est DURABLE : son
                                                           canal survit a la fermeture, et elle peut
                                                           rouvrir sous le meme titre. Un canal
                                                           archive ne se rouvre pas — Slack reserve
                                                           le desarchivage a un compte humain.
                    [--au-dirigeant]                       --au-dirigeant : autorise LE DIRIGEANT
                                                           du poste sur cette ligne interne, sans
                                                           que tu aies a connaitre son adresse.
                                                           C'est ainsi que le gestionnaire ouvre
                                                           sa ligne vers lui :
                                                             ouvrir dirigeant --titre "ligne dirigeant <client>" --au-dirigeant
                                                           Sans dirigeant designe sur le poste, la
                                                           ligne est REFUSEE — une ligne interne
                                                           sans invite refuse la parole a tous.
                                                           ouvre le canal du chantier
                                                           (--titre nomme le canal ET signe chaque message ;
                                                            sans lui, en interne, c'est le code du chantier)
                                                           (--nature client : canal PRIVE, ou parlent les
                                                            gens du client qu'un humain y a invites.
                                                            --titre y est OBLIGATOIRE : le client ne doit
                                                            jamais voir un code de chantier.
                                                            Sans --nature, la ligne est interne : canal
                                                            public, autorisation par --inviter)
                    [--au-gestionnaire <nom-d-agent>]      PARTAGE cette ligne avec le gestionnaire
                                                           client nomme : ce que l'un dit arrive dans
                                                           le pane de l'autre, dans les deux sens.
                                                           C'est une conversation entre PAIRS — ce qui
                                                           s'y demande ne se commande pas.
                                                           Refuse sur une ligne CLIENTE, et refuse un
                                                           nom qu'aucun gestionnaire vivant ne porte :
                                                           la ligne n'est alors PAS ouverte.
                                                           S'utilise aussi a la REPRISE, pour accueillir
                                                           un gestionnaire sur une ligne deja ouverte.
  dire "texte" [--a <ligne>]                               rapporte un jalon
  demander "texte" [--a <ligne>]                           sollicite un arbitrage
  fermer [--bilan "texte"] [--sans-archiver] [--a <ligne>] referme la ligne
  renommer --titre "..." [--canal <id>] [--a <ligne>]      renomme le canal (Slack + registre)

  --a <ligne> NOMME LA LIGNE VISEE, et c'est le DESTINATAIRE qu'il nomme, jamais toi :
              depuis le pane d'un gestionnaire, « --a <le client> » / « --a dirigeant ».
              Le nom est le chantier de la ligne, ou le nom de son canal — c'est donc
              le nom sous lequel elle a ete OUVERTE. La ligne du dirigeant s'ouvre sur
              le chantier « dirigeant » ; celle du client, sur le nom du client.
              Un pane qui porte PLUSIEURS lignes exige ce nom : sans lui, le geste est
              REFUSE et rien n'est envoye — jamais la premiere ligne venue.
              Un pane qui n'en porte qu'une n'exige rien.
  commun <canal> --role <role> --dirigeant courriel [--dirigeant ...]
                                                           designe le CANAL COMMUN D'UN ROLE :
                                                           chacun de ses messages est remis aux
                                                           agents de CE role qui travaillent —
                                                           les autres ne le recoivent pas, un
                                                           chef d'equipe jamais. Un canal par
                                                           role (${rolesConnus().join(', ')}),
                                                           un role par canal. Descendant
                                                           seulement — aucun agent n'y ecrit,
                                                           aucune commande n'y poste. Le canal
                                                           doit exister et notre robot y etre
                                                           invite.
  dirigeant <courriel>                                     designe LE DIRIGEANT de ce poste, une
                                                           fois. Son adresse ne quitte jamais le
                                                           poste : les agents demandent « le
                                                           dirigeant », jamais son courriel.
  representant <client> --canal <canal> --dirigeant <courriel> [--depot <chemin>]
                                                           prepare le lieu d'un representant
                                                           dans <chemin> (defaut : le repertoire
                                                           courant) — refuse tout net et NE CREE
                                                           RIEN si <canal> n'est pas joignable,
                                                           si le poste ne peut pas ouvrir de
                                                           ligne, ou si <courriel> ne designe
                                                           personne dans l'espace
  orchestrateur <nom> [--depot <chemin>]                   prepare le lieu d'un orchestrateur,
                                                           nomme, dans <chemin> — refuse tout net
                                                           et NE CREE RIEN si le poste ne peut pas
                                                           ouvrir de ligne (sa ligne est obligatoire)
  etat                                                     ce qui est ouvert
  service installer|retirer|etat                           le veilleur revient après un redémarrage
  relever                                                  fait passer la main a un veilleur neuf
                                                           (a lancer apres chaque mise a jour du pack)
  veilleur                                                 lance le veilleur au premier plan

Le chantier est déduit du pane courant, sauf à l'ouverture.
`);
  process.exit(code);
}

/**
 * La ligne que ce geste vise — ou la sortie, sans rien envoyer.
 *
 * TROIS GESTES PASSENT PAR ICI — `dire`, `fermer`, `renommer` — et c'est la raison d'être de ce
 * point unique : les trois écrivent ou modifient un canal, et une garde recopiée à trois
 * endroits en oublie un. L'oubli mesuré sur le lot d'à côté était `fermer`, qui aurait posté
 * son bilan dans le mauvais canal PUIS l'aurait archivé.
 *
 * On ne devine jamais : dès qu'un pane porte plus d'une ligne, le nom est exigé. Le refus est
 * écrit ici, en clair — c'est le seul endroit qui parle à un humain ; la sélection, elle, rend
 * un motif nommé, pour que ce qui la prouve n'ait pas à lire une phrase.
 */
function ligneVisee(geste, ouvertes, ici, args) {
  // `--a` PRÉSENT MAIS SANS VALEUR N'EST PAS `--a` ABSENT : les confondre ferait passer
  // `dire "texte" --a` (la valeur oubliée) pour un appel sans nom — donc accepté en silence dès
  // qu'il n'y a qu'une ligne. La présence est demandée à `optionDonnee`, qui parcourt les jetons
  // et non le tableau : un `--a` qui est la VALEUR d'une autre option n'est pas ce drapeau.
  const drapeau = optionDonnee(args, '--a');
  const nom = drapeau.presente ? (drapeau.valeur ?? '') : null;
  const { ligne, refus } = ligneDuPane(ouvertes, ici.pane, nom);
  if (ligne) return ligne;
  const noms = refus.noms.map((n) => `--a ${n}`).join('  ou  ');
  if (refus.motif === REFUS_SELECTION.AUCUNE) {
    process.stderr.write(
      geste === 'renommer'
        ? 'aucune ligne ouverte depuis ce pane — precise --canal <id>\n'
        : "aucune ligne ouverte depuis ce pane — commence par : ligne-directe ouvrir <chantier>\n"
    );
  } else if (refus.motif === REFUS_SELECTION.NOM_REQUIS) {
    process.stderr.write(
      `ce pane porte ${refus.noms.length} lignes — « ${geste} » ne devine pas laquelle : nomme-la.\n` +
        `  ${noms}\n` +
        `  Le nom designe le DESTINATAIRE, jamais toi. Rien n'a ete envoye.\n`
    );
  } else if (refus.motif === REFUS_SELECTION.NOM_INCONNU) {
    process.stderr.write(
      String(refus.nom ?? '').trim()
        ? `aucune ligne « ${refus.nom} » depuis ce pane — rien n'a ete envoye.\n  ${noms}\n`
        : `« --a » attend le nom de la ligne visee — rien n'a ete envoye.\n  ${noms}\n`
    );
  } else {
    process.stderr.write(
      `« ${refus.nom} » designe plusieurs lignes de ce pane — rien n'a ete envoye.\n  ${noms}\n`
    );
  }
  process.exit(1);
}

function rendre(reponse) {
  if (reponse.ok) {
    process.stdout.write(`${JSON.stringify(reponse)}\n`);
    process.exit(0);
  }
  process.stderr.write(`${reponse.erreur || 'échec'}\n`);
  process.exit(1);
}

const [geste, ...args] = process.argv.slice(2);
if (!geste || geste === '--help' || geste === '-h') usage();

// Tout le corps est enveloppé : une erreur attendue — jeton absent, veilleur qui refuse de
// céder — porte un message écrit pour être lu et suivi. Le déverser sous une trace de pile
// Node, c'est le rendre invisible : personne ne lit la troisième ligne d'une trace.
try {

if (geste === 'relever') {
  const r = await passerLaMain();
  process.stdout.write(`${JSON.stringify(r)}\n`);
} else if (geste === 'service') {
  const { installerService, retirerService, etatService } = await import('../src/service.js');
  const quoi = args[0] || 'etat';
  if (quoi === 'installer') {
    const r = await installerService();
    if (!r.ok) {
      process.stderr.write(`installation refusée : ${r.erreur}\n`);
      process.exit(1);
    }
    process.stdout.write(`service installé (${r.chemin}) — le veilleur reviendra à chaque ouverture de session\n`);
  } else if (quoi === 'retirer') {
    const r = await retirerService();
    process.stdout.write(`service retiré (${r.chemin})\n`);
  } else {
    process.stdout.write(`${JSON.stringify(await etatService(), null, 2)}\n`);
  }
} else if (geste === 'veilleur') {
  await import('../src/demarrer-veilleur.js');
} else if (geste === 'ouvrir') {
  const chantier = premierLibre(args);
  if (!chantier) usage(1);
  // LE COURRIEL PART TEL QUEL — c'est le VEILLEUR qui le résout (T-20260814-0136).
  //
  // Il était résolu ici, ce qui obligeait la commande à lire le trousseau du poste et à appeler
  // Slack pour son compte. Un courriel qui ne désignait personne y produisait un avertissement
  // sur la sortie d'erreur, code 0, et la ligne s'ouvrait sans lui. Surtout, ce chemin était
  // INÉPROUVABLE : la cloison refuse le trousseau sous essais, donc aucun essai n'a jamais pu
  // exercer ce refus — celui qui essayait passait au vert parce que la commande TOMBAIT.
  const courriel = option(args, '--inviter');
  const ici = await herdr.paneCourant();
  rendre(
    await parler({
      geste: 'ouvrir',
      chantier,
      pane: ici.pane,
      worktree: ici.worktree,
      herdr_socket: ici.herdr_socket,
      sujet: option(args, '--sujet'),
      titre: option(args, '--titre'),
      // Transmise TELLE QUELLE, jamais normalisée ici : c'est le veilleur qui refuse une
      // nature inconnue. Rabattre une faute de frappe sur le défaut côté commande créerait
      // un canal public pour un client sans que rien ne le dise.
      nature: option(args, '--nature'),
      invites_courriels: courriel ? [courriel] : [],
      // LA PRÉSENCE EST LUE PAR `optionDonnee`, JAMAIS PAR `includes` — c'est la leçon exacte
      // de T-20260813-0078 : `--titre "--au-dirigeant"` contient le drapeau sans le porter, et
      // un `includes` y aurait vu une demande d'ouvrir la ligne du dirigeant. `optionDonnee`
      // parcourt les jetons et saute la valeur d'une option à valeur.
      au_dirigeant: optionDonnee(args, '--au-dirigeant').presente,
      // `--jetable` : cette ligne-ci meurt avec son chantier, son canal peut être archivé.
      // SANS CE DRAPEAU, LA LIGNE EST DURABLE — le canal survit à la fermeture et la ligne
      // pourra rouvrir sous le même titre (T-20260814-0085). Lu par `optionDonnee` pour la
      // même raison que `--au-dirigeant` : un `includes` verrait le mot dans un titre.
      jetable: optionDonnee(args, '--jetable').presente,
      // `--au-gestionnaire <nom>` PARTAGE CETTE LIGNE avec le gestionnaire client nommé
      // (T-20260814-0093) : à partir de là, ce que l'un dit arrive dans le pane de l'autre, dans
      // les deux sens. C'est une VALEUR, pas un drapeau — le nom d'agent est ce qui permet au
      // veilleur de le retrouver chez herdr, et un nom qu'on ne trouve pas est un REFUS.
      au_gestionnaire: option(args, '--au-gestionnaire'),
    })
  );
} else if (geste === 'dire' || geste === 'demander') {
  const texte = premierLibre(args);
  if (!texte) usage(1);
  const ici = await herdr.paneCourant();
  const etat = await parler({ geste: 'etat' });
  // `etat.ouvertes` ne porte QUE des lignes — le canal commun est rendu à côté, exprès : un
  // geste qui parle ne doit pas pouvoir le désigner, même par accident.
  const mienne = ligneVisee(geste, etat.ouvertes, ici, args);
  const corps = geste === 'demander' ? `❓ *J'attends ton arbitrage*\n\n${texte}` : texte;
  // ON DÉSIGNE LE CANAL, PAS LE CHANTIER — la clé qui identifie, comme le fait déjà le chemin
  // entrant. Le veilleur sait router par l'une ou par l'autre ; celle-ci est unique par
  // construction, et c'est la seule qui ne puisse pas rendre une autre ligne que celle visée.
  // ON DIT AUSSI D'OÙ ÇA PART. Une ligne de chantier peut être portée par DEUX panes
  // (T-20260814-0093) : sans le pane de l'émetteur, le veilleur ne peut pas savoir à qui faire
  // écho — et le seul repli disponible serait de renvoyer à quelqu'un sa propre parole, cadrée
  // comme celle de son pair. Sur une ligne sans pair, ce champ ne sert à rien et ne coûte rien.
  rendre(await parler({ geste: 'dire', canal_id: mienne.canal_id, texte: corps, pane: ici.pane }));
} else if (geste === 'fermer') {
  const ici = await herdr.paneCourant();
  const etat = await parler({ geste: 'etat' });
  const mienne = ligneVisee('fermer', etat.ouvertes, ici, args);
  rendre(
    await parler({
      geste: 'fermer',
      canal_id: mienne.canal_id,
      // D'OÙ PART LE GESTE — le veilleur refuse à un PAIR de refermer et d'archiver le chantier
      // de celui qui le mène (T-20260814-0093). Il parle sur cette ligne ; il n'en dispose pas.
      pane: ici.pane,
      bilan: option(args, '--bilan'),
      archiver: !args.includes('--sans-archiver'),
    })
  );
} else if (geste === 'renommer') {
  const titre = option(args, '--titre');
  if (!titre) usage(1);
  const canalId = option(args, '--canal');
  // LE PANE EST LU DANS LES DEUX CHEMINS, y compris celui qui désigne le canal explicitement :
  // sans lui, un pair contournerait le refus en nommant l'identifiant du canal, ce qui est
  // précisément la porte que ce chemin-là ouvre (il existe pour renommer depuis un pane qui ne
  // porte aucune ligne).
  const ici = await herdr.paneCourant();
  if (canalId) {
    rendre(await parler({ geste: 'renommer', canal_id: canalId, titre, pane: ici.pane }));
  } else {
    const etat = await parler({ geste: 'etat' });
    const mienne = ligneVisee('renommer', etat.ouvertes, ici, args);
    rendre(await parler({ geste: 'renommer', canal_id: mienne.canal_id, titre, pane: ici.pane }));
  }
} else if (geste === 'commun') {
  // Désigne le canal commun d'un RÔLE. Ce geste est celui de l'OPÉRATEUR du poste, une fois par
  // rôle — pas celui d'un agent : rien ici n'ouvre de ligne, n'inscrit de pane, ni ne poste.
  const canal = premierLibre(args);
  if (!canal) usage(1);
  const role = option(args, '--role');
  if (!role) usage(1);
  const nomsDirigeants = optionsRepetees(args, '--dirigeant');
  if (!nomsDirigeants.length) usage(1);

  // La résolution vit dans `src/canal-commun.js` — une boucle enfouie ici n'était exercée par
  // aucun test, et c'est là que « la liste amputée en silence » se réintroduit sans qu'on la voie.
  const r = await resoudreAutorises(await lireJeton(SERVICE_ROBOT), nomsDirigeants);
  if (!r.ok) {
    process.stderr.write(`aucun membre pour ${r.inconnu} — le canal n'est PAS designe\n`);
    process.exit(1);
  }
  rendre(await parler({ geste: 'commun', canal, role, autorises: r.autorises }));
} else if (geste === 'dirigeant') {
  // Le geste de l'OPÉRATEUR du poste, une fois — pas celui d'un agent. Rien ici n'ouvre de
  // ligne, n'inscrit de pane, ni ne poste quoi que ce soit : on nomme qui est le dirigeant.
  const courriel = premierLibre(args);
  if (!courriel) usage(1);
  const id = await trouverMembre(await lireJeton(SERVICE_ROBOT), courriel);
  if (!id) {
    process.stderr.write(
      `aucun membre pour ${courriel} — le dirigeant n'est PAS designe.\n` +
        `  Rien n'a change : les lignes deja ouvertes gardent leurs autorises.\n`
    );
    process.exit(1);
  }
  rendre(await parler({ geste: 'dirigeant', id, courriel }));
} else if (geste === 'representant') {
  const client = premierLibre(args);
  const canal = option(args, '--canal');
  // `--dirigeant` EST EXIGÉ, ET C'EST LE LOT LUI-MÊME (T-20260813-0076). Un gestionnaire posé
  // sans chemin vers le dirigeant est celui qu'on avait : tenu de remonter ce qui engage
  // Somtech, toute situation problématique et son topo du matin, sans aucun moyen de le faire.
  // Le rendre facultatif aurait laissé reparaître exactement ce manque, en silence.
  const courrielDirigeant = option(args, '--dirigeant');
  if (!client || !canal || !courrielDirigeant) usage(1);
  const depotClient = option(args, '--depot') || process.cwd();
  const r = await preparerLieuRepresentant({
    depotClient,
    client,
    canal,
    // La lecture du jeton passe DANS la vérification, jamais dans son argument : lue ici, son
    // échec traversait toute la pose sans produire le moindre JSON de contrat, et déversait
    // sur stderr un message qui proposait d'écraser un secret (T-20260813-0054).
    verifierJoignabilite: () => verifierLignesDuRepresentant({ canal, courrielDirigeant }),
  });

  // ═══ LA DÉSIGNATION VIENT APRÈS LA POSE, ET ELLE LA DÉFAIT SI ELLE ÉCHOUE.
  //
  // Elle ne peut pas venir avant : `preparerLieu` refuse d'abord sur ce qui ne dépend que du
  // disque local (gabarits absents), et payer un aller-retour au veilleur pour un dépôt qui
  // n'a pas reçu le pack serait le défaut que ce module a déjà nommé.
  //
  // Elle ne peut pas manquer non plus : un lieu posé dont le poste ignore le dirigeant est un
  // gestionnaire qui naîtra sans pouvoir ouvrir sa seconde ligne — le garde le tiendra fermé,
  // et personne ne saura pourquoi. Alors si elle échoue, on RETIRE ce qui vient d'être posé :
  // la promesse « pose interrompue → rien sur disque » vaut pour cette étape comme pour les
  // autres, sans quoi elle ne vaudrait que pour celles qu'on avait prévues.
  if (r.ok && r.cree) {
    const d = await parler({ geste: 'dirigeant', id: r.ligne?.dirigeant?.id, courriel: courrielDirigeant });
    if (!d.ok) {
      retirerCeQuiAEteCommence(depotClient, client);
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          cree: false,
          role: 'representant',
          nom: client,
          refus: { motif: 'dirigeant_non_designe', portee: 'poste', message: d.erreur },
        })}\n`
      );
      process.stderr.write(
        `${d.erreur}\n` +
          `  Le lieu qui venait d'etre pose a ete RETIRE : rien ne subsiste dans ${depotClient}.\n`
      );
      process.exit(1);
    }
  }
  process.stdout.write(`${JSON.stringify(r)}\n`);
  // Le JSON est le contrat de qui appelle ; le motif écrit en clair est celui de qui LIT. Sans
  // cette ligne, un refus ne laissait sur stderr que ce que Node y avait déversé lui-même — un
  // « ENOENT ... copyfile ... » brut, illisible et faux (T-20260807-0067).
  if (!r.ok && r.refus?.message) process.stderr.write(`${r.refus.message}\n`);
  process.exit(r.ok ? 0 : 1);
} else if (geste === 'orchestrateur') {
  const nom = premierLibre(args);
  if (!nom) usage(1);
  const depot = option(args, '--depot') || process.cwd();
  const r = await preparerLieuOrchestrateur({ depot, nom });
  process.stdout.write(`${JSON.stringify(r)}\n`);
  // Même contrat que `representant` : le JSON pour qui appelle, le motif en clair pour qui LIT.
  // Un refus qui ne laisse sur stderr que ce que Node y a déversé est illisible et faux.
  if (!r.ok && r.refus?.message) process.stderr.write(`${r.refus.message}\n`);
  process.exit(r.ok ? 0 : 1);
} else if (geste === 'etat') {
  const etat = await parler({ geste: 'etat' });
  process.stdout.write(`${JSON.stringify(etat, null, 2)}\n`);
} else {
  usage(1);
}
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}

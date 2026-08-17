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
import { livrerBrief, IMMOBILITE_PAR_DEFAUT_MS } from '../src/livraison.js';
import { appelHerdr, lireEcran } from '../src/appel-herdr.js';
import { trouverDestinataire } from '../src/destinataire.js';

const ESSAIS = Number(process.env.LIVRAISON_ESSAIS || 15);
const DELAI_MS = Number(process.env.LIVRAISON_DELAI_MS || 2000);
const ATTENTE_MS = Number(process.env.LIVRAISON_ATTENTE_MS || 20000);
// ⚠️ LE TEMPS LAISSÉ À UN TEXTE COINCÉ POUR BOUGER (T-20260816-0114) — cinq minutes, et le
// pourquoi de ce chiffre est en tête de `src/livraison.js`, là où il se décide. En deux mots :
// une demi-minute couvre « en train de taper », pas « a tapé la moitié puis est parti ».
//
// ⚠️ CE RÉGLAGE EST LE PRIX D'UN GESTE IRRÉVERSIBLE — le baisser à zéro désarme la délivrance,
// le baisser un peu la rend hasardeuse.
const IMMOBILITE_MS = Number(process.env.LIVRAISON_IMMOBILITE_MS || IMMOBILITE_PAR_DEFAUT_MS);

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
  const ou = await trouverDestinataire(cible);
  if (!ou.ok) {
    process.stderr.write(`${ou.message}\n`);
    process.exit(1);
  }
  const pane = ou.pane;

  const resultat = await livrerBrief({
    pane,
    texte,
    socket: ou.socket,
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
      // `delivre` — LA BOÎTE ÉTAIT BLOQUÉE PAR LE TEXTE D'UN AUTRE, et on l'a soumis pour lui
      // (T-20260816-0114). C'est un fait qui doit remonter : il dit que le destinataire vient de
      // recevoir DEUX messages, dont un qui attendait peut-être depuis longtemps.
      delivre: Boolean(resultat.delivre),
      // `attendu` — CE QUE HERDR A RAPPORTÉ DE SON CÔTÉ, jamais la preuve (T-20260815-0007).
      // Son sens dépend du destinataire : sur une session en attente, c'est une transition
      // observée ; sur un pair qui travaille déjà, on ne demande plus cette attente-là, et ce
      // champ ne dit plus que « l'appel a été accepté ». Dans les deux cas, ce qui tranche est
      // la relecture, pas lui.
      attendu: resultat.attendu,
    })}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
